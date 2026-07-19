/**
 * =============================================================================
 *  BC Color API (BC_ThemeColorCheck.js)
 * =============================================================================
 *
 *  取得 BC 介面顏色，並判斷亮暗。
 *
 *  兩條取色路線，能用哪條就用哪條：
 *
 *    A. 讀「宣告值」（準確，v2.0 新增）—— BC 的介面不是圖片，是 DrawRect / DrawButton
 *       這些函式畫出來的，顏色就寫在參數裡。只要 hook 這些函式，就能直接拿到
 *       「#212121」這種精確值，不必猜、不必取樣、不受抗鋸齒與疊圖影響。
 *       需要 bcModSdk；沒有的話這條自動停用。
 *
 *    B. 讀「像素」（後備）—— 從 canvas 上實際渲染的結果取樣。
 *       v2.0 改用「眾數」而非「平均」：一塊區域裡出現次數最多的顏色就是背景色本身，
 *       平均則會把邊緣的抗鋸齒像素混進來，得到一個既不是背景也不是前景的髒色。
 *
 *  API（掛在 window.Liko.__Sys_ColorAPI__）：
 *    getThemeColor()            取得目前介面的主題底色（建議用這個）
 *    getUIColor({x, y})         讀某座標上那個元件的宣告顏色
 *    getCanvasColor({x,y,size}) 讀某區域實際渲染出來的顏色
 *    isDark(color, threshold)   判斷亮暗
 *    setOverride(color, isDark) 手動覆寫某顏色的亮暗結論
 *    clearOverrides()
 *
 *  用法：當一般 <script> 載入即可。若頁面上有 bcModSdk（大多數插件都會 @require），
 *  精確路線會自動啟用。
 * =============================================================================
 */
(function (global) {
  'use strict';

  // 防重複載入旗標：檔尾把 API 掛到 global.Liko.__Sys_ColorAPI__（系統擴充統一以 __Sys_ 開頭）
  global.Liko = global.Liko ?? {};
  if (global.Liko.__Sys_ColorAPI__) return;
  const MOD_VER = "2.1";

  // ---------------------------------------------------------------------------
  // 共用小工具
  // ---------------------------------------------------------------------------

  // 注意：MainCanvas 在 Drawing.js 是用 let 宣告的，不會掛到 window 上，
  // 所以不能寫 global.MainCanvas，只能用裸識別字讀（配 typeof 防未載入時 ReferenceError）。
  function _getCtx() {
    try {
      if (typeof MainCanvas !== 'undefined' && MainCanvas) return MainCanvas;
    } catch { /* Drawing.js 還沒載入 */ }
    return null;
  }

  function _getCanvasElement() {
    const ctx = _getCtx();
    if (ctx && ctx.canvas) return ctx.canvas;
    return document.getElementById('MainCanvas') || document.querySelector('canvas');
  }

  function toHex2(n) {
    return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  }

  function rgbToHex(r, g, b) {
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  }

  /** 把任何 CSS 顏色（'White'、'rgb(1,2,3)'、'#abc'）正規化成 '#rrggbb'；看不懂回 null */
  let _probeCtx = null;
  function normalizeColor(c) {
    if (typeof c !== 'string' || !c) return null;
    if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
    try {
      if (!_probeCtx) _probeCtx = document.createElement('canvas').getContext('2d');
      _probeCtx.fillStyle = '#000000';
      _probeCtx.fillStyle = c;
      const v = _probeCtx.fillStyle;
      return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
    } catch { return null; }
  }

  // 失敗訊息節流：同一原因短時間只印一次，避免每幀呼叫時洗版 console。
  let _lastWarnAt = 0;
  function _warnThrottled(msg, err) {
    const now = Date.now();
    if (now - _lastWarnAt < 5000) return;
    _lastWarnAt = now;
    console.warn(msg, err);
  }

  // ---------------------------------------------------------------------------
  // 取色的健壯性：快取「上次成功的顏色」+ 跨域汙染偵測 + DOM 後備
  //   目標：一旦讀到過顏色，之後即使某一幀讀失敗（汙染、還沒渲染、座標超界），
  //   也回上次成功值而不是 null——呼叫端永遠拿得到色。
  // ---------------------------------------------------------------------------
  let _lastGoodTheme = null;   // getThemeColor 的最後成功值
  let _lastGoodCanvas = null;  // getCanvasColor 的最後成功值
  let _tainted = false;        // MainCanvas 是否已被跨域圖片汙染（getImageData 會丟 SecurityError）
  let _taintedEl = null;       // 記住是哪個 canvas 元素被汙染，換了新畫布就重試

  /** 絕對後備：讀畫布元素 / body / html 的 CSS 背景色（不透明才算數） */
  function _readDomBg() {
    try {
      for (const node of [_getCanvasElement(), document.body, document.documentElement]) {
        if (!node) continue;
        const hex = normalizeColor(getComputedStyle(node).backgroundColor);
        if (hex) return hex;
      }
    } catch { /* getComputedStyle 在極少數環境會丟 */ }
    return null;
  }

  // ---------------------------------------------------------------------------
  // A. 宣告值路線：hook 繪製函式，直接讀顏色參數
  // ---------------------------------------------------------------------------

  // 每幀累積 / 上一幀完整的「有顏色的矩形繪製」清單。
  // 只記 DrawRect / DrawButton / DrawEmptyRect 這三個，量很小（通常幾十筆）。
  let _cur = [];
  let _last = [];
  let _hooked = false;
  let _armed = false;      // 是否正在記錄
  let _lastUseAt = 0;      // 最後一次有人用宣告值路線的時間

  // 沒人用就自動停掉，避免白白吃效能
  const IDLE_MS = 10000;

  function _installHooks() {
    if (_hooked) return false;
    if (!global.bcModSdk || typeof global.DrawRect !== 'function') return false;

    let api;
    try {
      api = global.bcModSdk.registerMod({
        name: 'LikoColorAPI',
        fullName: 'Liko Color API',
        version: MOD_VER,
        repository: 'https://github.com/awdrrawd/liko-Plugin-Repository',
      });
    } catch (err) {
      _warnThrottled('[Liko.__Sys_ColorAPI__] bcModSdk 註冊失敗，改用像素取樣', err);
      return false;
    }

    // priority 0 = 最內層，代表其他插件（例如主題插件）改過的顏色我們看到的是最終值
    const rec = (name, colorIdx) => {
      api.hookFunction(name, 0, (args, next) => {
        if (_armed) {
          const hex = normalizeColor(args[colorIdx]);
          if (hex) _cur.push({ x: args[0], y: args[1], w: args[2], h: args[3], hex, fn: name });
        }
        return next(args);
      });
    };
    rec('DrawRect', 4);
    rec('DrawEmptyRect', 4);
    rec('DrawButton', 5);

    // 每幀換頁：DrawProcess 跑完後，這一幀的清單才算完整
    api.hookFunction('DrawProcess', 0, (args, next) => {
      if (_armed) _cur = [];
      const r = next(args);
      if (_armed) {
        _last = _cur;
        _cur = [];
        if (Date.now() - _lastUseAt > IDLE_MS) _armed = false; // 沒人用就休息
      }
      return r;
    });

    _hooked = true;
    return true;
  }

  /** 有人要用宣告值路線了：確保 hook 裝好、記錄打開 */
  function _arm() {
    _lastUseAt = Date.now();
    if (!_hooked && !_installHooks()) return false;
    if (!_armed) { _armed = true; _cur = []; }
    return true;
  }

  function _pointIn(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /**
   * 讀出某座標上那個元件的「宣告顏色」——也就是 BC 呼叫 DrawRect/DrawButton 時
   * 傳進去的那個值，不是螢幕上取樣的結果。
   *
   * @param {{x?: number, y?: number}} [options] canvas 內部座標（2000x1000），預設 1910,60
   * @returns {string|null} '#rrggbb'；沒有 bcModSdk、或該點沒有帶顏色的元件時回 null。
   *   注意：第一次呼叫時清單還是空的（要等一幀），會回 null，之後才有值。
   */
  function getUIColor(options = {}) {
    const { x = 1910, y = 60 } = options;
    if (!_arm()) return null;
    // 反向掃 = 由最上層往下找，第一個蓋住這點的就是看得到的那個
    for (let i = _last.length - 1; i >= 0; i--) {
      if (_pointIn(x, y, _last[i])) return _last[i].hex;
    }
    return null;
  }

  /**
   * 取得目前介面的主題底色。
   *
   * 作法：找出上一幀「面積最大且蓋住畫面中心」的矩形——主題插件就是靠畫一張滿版
   * DrawRect 來換底色的，所以那張的顏色就是主題色本身，精確到位。
   * 拿不到就退回宣告值查詢，再拿不到就退回像素取樣。
   *
   * @returns {string|null} '#rrggbb'
   */
  function getThemeColor() {
    let result = null;

    if (_arm()) {
      // 1) 找滿版底色矩形（主題插件換底色的手法）
      let best = null;
      for (const r of _last) {
        if (!isFinite(r.w) || !isFinite(r.h)) continue;
        const area = r.w * r.h;
        if (area < 2000 * 1000 / 4) continue;      // 至少蓋住畫面四分之一
        if (!_pointIn(1000, 500, r)) continue;      // 且蓋住畫面中心
        if (!best || area > best.area) best = { area, hex: r.hex };
      }
      if (best) result = best.hex;
      // 2) 退一步：查右上角那個元件的宣告顏色
      if (!result) result = getUIColor();
    }

    // 3) 再退：像素取樣（本身會在汙染時回快取 / DOM）
    if (!result) result = getCanvasColor();
    // 4) 最後保底：上次成功值 → DOM 背景
    if (!result) result = _lastGoodTheme ?? _readDomBg();

    if (result) _lastGoodTheme = result;
    return result;
  }

  // ---------------------------------------------------------------------------
  // B. 像素路線（後備）
  // ---------------------------------------------------------------------------

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

  /**
   * 讀出 canvas 上某個區域實際渲染出來的顏色。
   *
   * v2.0 起取的是「眾數」而不是「平均」：一塊 UI 背景區域裡出現次數最多的顏色，
   * 就是那個背景色本身。舊版取平均會把文字邊緣、圓角的抗鋸齒像素一起平均進去，
   * 算出一個畫面上根本不存在的顏色——這是舊版判斷不準的主因。
   *
   * @param {{ x?: number, y?: number, size?: number }} [options]
   *   x, y: 取樣區域左上角座標（canvas 內部座標系，預設 1910,60，也就是畫面右上角）
   *   size: 取樣區域邊長，預設 8
   * @returns {string|null} 例如 '#eeeeee'，讀取失敗（例如 canvas 還沒畫出來）回傳 null
   */
  function getCanvasColor(options = {}) {
    const { x = 1910, y = 60, size = 8 } = options;
    const canvas = _getCanvasElement();
    if (!canvas) return _lastGoodCanvas ?? _readDomBg();

    // 已知汙染：同一張畫布再讀還是會丟 SecurityError，別浪費效能也別洗版。
    // 但若畫布被 BC 重建過（解析度切換等），元素會換一個，這時清掉旗標重試。
    if (_tainted) {
      if (canvas === _taintedEl) return _lastGoodCanvas ?? _readDomBg();
      _tainted = false; _taintedEl = null;
    }

    try {
      const sctx = _getSampleCtx(size, size);
      if (!sctx) return _lastGoodCanvas ?? _readDomBg();
      // 從 BC 畫布把取樣區塊畫進離屏畫布，再從離屏畫布讀（讀取端具 willReadFrequently）
      sctx.clearRect(0, 0, size, size);
      sctx.drawImage(canvas, x, y, size, size, 0, 0, size, size);
      const { data } = sctx.getImageData(0, 0, size, size);

      // 統計每個顏色出現幾次，取最多的那個
      const tally = new Map();
      let bestKey = null, bestCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue; // 全透明的不算
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        const n = (tally.get(key) || 0) + 1;
        tally.set(key, n);
        if (n > bestCount) { bestCount = n; bestKey = key; }
      }
      if (bestKey === null) return _lastGoodCanvas ?? _readDomBg();
      const hex = rgbToHex((bestKey >> 16) & 255, (bestKey >> 8) & 255, bestKey & 255);
      _lastGoodCanvas = hex;   // 記住這次成功值
      return hex;
    } catch (err) {
      // 跨域汙染是永久性的（除非畫布重建）：標記起來走後備，不再逐幀重試觸發同一個錯
      if (err && (err.name === 'SecurityError' || /taint|cross-origin/i.test(String(err && err.message)))) {
        _tainted = true; _taintedEl = canvas;
        _warnThrottled('[Liko.__Sys_ColorAPI__] canvas 已被跨域圖片汙染，像素路線停用，改走宣告值 / DOM / 快取', err);
      } else {
        // 其他常見原因：canvas 尚未渲染、座標超出範圍
        _warnThrottled('[Liko.__Sys_ColorAPI__] getCanvasColor 讀取失敗', err);
      }
      return _lastGoodCanvas ?? _readDomBg();
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

  /** 目前用的是哪條路線，除錯用 */
  function getMode() {
    return {
      version: MOD_VER,
      hooked: _hooked, armed: _armed, tainted: _tainted,
      lastFrameRects: _last.length,
      lastGoodTheme: _lastGoodTheme, lastGoodCanvas: _lastGoodCanvas,
    };
  }

  // ---------------------------------------------------------------------------
  // 對外導出
  // ---------------------------------------------------------------------------

  const API = {
    version: MOD_VER,
    getThemeColor,   // v2.0 新增，建議優先使用
    getUIColor,      // v2.0 新增
    getCanvasColor,
    isDark,
    setOverride,
    clearOverrides,
    getMode,
  };

  // 掛上系統擴充命名（下方腳本會改名為 __Sys_ColorAPI__；版本讀 API.version）
  global.Liko.__Sys_ColorAPI__ = API;
  console.log(`🐈‍⬛ [ColorAPI] ✅ v${MOD_VER} loaded`);
})(typeof window !== 'undefined' ? window : globalThis);
