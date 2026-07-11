/**
 * =============================================================================
 *  BC Color API (BC_ThemeColorCheck.js)
 * =============================================================================
 *
 *  這支 API 只做三件事：
 *    1. getCanvasColor()  讀出目前 canvas 上某個位置實際的顏色
 *    2. isDark(color)     用自己的算法判斷一個顏色是亮還是暗
 *    3. setOverride(color, isDark)
 *                         如果你覺得演算法判斷錯了，把那個顏色手動標記成
 *                         亮/暗，之後 isDark() 遇到同一個顏色就用你的判斷
 *
 *  用法：當一般 <script> 載入即可，API 掛在 window.Liko.__Sys_ColorAPI__ 上。
 * =============================================================================
 */
(function (global) {
  'use strict';

  // 防重複載入旗標：檔尾把 API 掛到 global.Liko.__Sys_ColorAPI__（系統擴充統一以 __Sys_ 開頭）
  global.Liko = global.Liko ?? {};
  if (global.Liko.__Sys_ColorAPI__) return;
  const MOD_VER = "1.1";

  // ---------------------------------------------------------------------------
  // 找到 BC 實際在畫的那個 <canvas> 元素
  // ---------------------------------------------------------------------------
  function _getCanvasElement() {
    if (global.MainCanvas && global.MainCanvas.canvas) return global.MainCanvas.canvas;
    return document.getElementById('MainCanvas') || document.querySelector('canvas');
  }

  function toHex2(n) {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }

  function rgbToHex(r, g, b) {
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }

  /**
   * 讀取目前 canvas 上某個區域實際渲染出來的顏色（取平均，避免單一像素受
   * 邊緣鋸齒/雜訊影響）。
   *
   * @param {{ x?: number, y?: number, size?: number }} [options]
   *   x, y: 取樣區域左上角座標（canvas 內部座標系，預設 1910,60，也就是畫面右上角，約返回上方）
   *   size: 取樣區域邊長，預設 4（4x4 像素取平均）
   * @returns {string|null} 例如 '#eeeeee'，讀取失敗（例如 canvas 還沒畫出來）回傳 null
   */
  // 重用的離屏取樣畫布：用 willReadFrequently 建立。
  //  不直接對 BC 的 MainCanvas 做 getImageData——那個 2D context 由 BC 建立、無法補上
  //  willReadFrequently 旗標，被頻繁讀取時 Chrome 會一直噴
  //  「Multiple readback operations using getImageData are faster with willReadFrequently」。
  //  改成把取樣區塊 drawImage 進這張自己的畫布再讀，讀取端就有旗標、不再噴提示。
  let _sampleCv = null, _sampleCtx = null;
  function _getSampleCtx(w, h) {
    if (!_sampleCv) {
      _sampleCv = document.createElement('canvas');
      _sampleCtx = _sampleCv.getContext('2d', { willReadFrequently: true });
    }
    if (_sampleCv.width !== w || _sampleCv.height !== h) { _sampleCv.width = w; _sampleCv.height = h; }
    return _sampleCtx;
  }

  // 失敗訊息節流：同一原因短時間只印一次，避免每幀呼叫時洗版 console。
  let _lastWarnAt = 0;
  function _warnThrottled(msg, err) {
    const now = Date.now();
    if (now - _lastWarnAt < 5000) return;
    _lastWarnAt = now;
    console.warn(msg, err);
  }

  function getCanvasColor(options = {}) {
    const { x = 1910, y = 60, size = 4 } = options;
    const canvas = _getCanvasElement();
    if (!canvas) return null;

    try {
      const sctx = _getSampleCtx(size, size);
      if (!sctx) return null;
      // 從 BC 畫布把取樣區塊畫進離屏畫布，再從離屏畫布讀（讀取端具 willReadFrequently）
      sctx.clearRect(0, 0, size, size);
      sctx.drawImage(canvas, x, y, size, size, 0, 0, size, size);
      const { data } = sctx.getImageData(0, 0, size, size);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      return rgbToHex(r / count, g / count, b / count);
    } catch (err) {
      // 常見原因：canvas 尚未渲染、座標超出範圍、或畫布被跨域圖片汙染
      _warnThrottled('[Liko.__Sys_ColorAPI__] getCanvasColor 讀取失敗', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 亮 / 暗 判斷
  // ---------------------------------------------------------------------------

  const _overrides = new Map(); // hex -> boolean(isDark)

  function _parseHex(color) {
    if (typeof color !== 'string') return null;
    const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    return '#' + hex;
  }

  /** WCAG 相對亮度公式，0(最暗)~1(最亮) */
  function _getLuminance(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  /**
   * 判斷一個顏色是亮還是暗。
   * 如果這個顏色曾用 setOverride() 手動標記過，優先採用你的標記；
   * 否則用明度公式加閾值自動判斷。
   *
   * @param {string} color 例如 '#eeeeee'
   * @param {number} [threshold] 明度閾值，預設 0.5，數字越小代表越容易被判定為「暗」
   * @returns {boolean|null} 顏色格式看不懂時回傳 null
   */
  function isDark(color, threshold = 0.5) {
    const hex = _parseHex(color);
    if (!hex) return null;

    if (_overrides.has(hex)) return _overrides.get(hex);

    const luminance = _getLuminance(hex);
    return luminance < threshold;
  }

  /**
   * 手動覆寫某個顏色的亮暗判斷（例如自動算法覺得是亮，但你覺得應該算暗）。
   * @param {string} color 例如 '#eeeeee'
   * @param {boolean} isDarkValue true = 之後都當作暗色，false = 之後都當作亮色
   */
  function setOverride(color, isDarkValue) {
    const hex = _parseHex(color);
    if (!hex) return;
    _overrides.set(hex, !!isDarkValue);
  }

  /** 清除所有手動覆寫，恢復成只用自動算法判斷 */
  function clearOverrides() {
    _overrides.clear();
  }

  // ---------------------------------------------------------------------------
  // 對外導出
  // ---------------------------------------------------------------------------

  const API = {
    version: MOD_VER,
    getCanvasColor,
    isDark,
    setOverride,
    clearOverrides,
  };

  // 掛上系統擴充命名（下方腳本會改名為 __Sys_ColorAPI__；版本讀 API.version）
  global.Liko.__Sys_ColorAPI__ = API;
  console.log(`🐈‍⬛ [ColorAPI] ✅ v${MOD_VER} loaded`);
})(typeof window !== 'undefined' ? window : globalThis);
