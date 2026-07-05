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
 *  用法：當一般 <script> 載入即可，API 掛在 window.Liko.ColorAPI 上。
 * =============================================================================
 */
(function (global) {
  'use strict';

  // 統一防重複載入 + 註冊：__SystemAPI__.ColorAPI 與 global.Liko.ColorAPI 指向同一物件（見檔尾登記）
  global.Liko = global.Liko ?? {};
  global.Liko.__SystemAPI__ = global.Liko.__SystemAPI__ ?? {};
  if (global.Liko.__SystemAPI__.ColorAPI) return;
  const MOD_VER = "1.0";

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
  function getCanvasColor(options = {}) {
    const { x = 1910, y = 60, size = 4 } = options;
    const canvas = _getCanvasElement();
    if (!canvas) return null;

    try {
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(x, y, size, size);
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      return rgbToHex(r / count, g / count, b / count);
    } catch (err) {
      // 常見原因：canvas 尚未渲染、或座標超出範圍
      console.warn('[Liko.ColorAPI] getCanvasColor 讀取失敗', err);
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

  // 統一登記：__SystemAPI__.ColorAPI 與 global.Liko.ColorAPI 指向同一物件（版本讀 API.version）
  global.Liko.ColorAPI = API;
  global.Liko.__SystemAPI__.ColorAPI = API;
  console.log(`🐈‍⬛ [ColorAPI] ✅ v${MOD_VER} loaded (Liko.ColorAPI)`);
})(typeof window !== 'undefined' ? window : globalThis);
