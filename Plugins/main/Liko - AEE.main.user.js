// ==UserScript==
// @name         Liko - AEE
// @name:cn      Liko的外觀編輯拓展
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.7.3
// @description  Likolisu's Appearance editing extension.
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20AEE.main.user.js
// @updateURL    https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20AEE.main.user.js
// ==/UserScript==

(function () {
  'use strict';

  const MOD_NAME = "Liko - AEE";
  const MOD_Version = "0.7.3";
  if (typeof bcModSdk !== "object" || typeof bcModSdk.registerMod !== "function") return;
  const modApi = bcModSdk.registerMod({
    name: MOD_NAME, fullName: "Liko - Appearance Editor",
    version: MOD_Version, repository: "外觀編輯拓展 | Appearance editing extension."
  });

  // ============================================================
  // LANGUAGE SYSTEM
  // ============================================================

  function isZh() {
    if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
      const l = TranslationLanguage.toLowerCase();
      return l === 'cn' || l === 'tw';
    }
    return (navigator.language || '').toLowerCase().startsWith('zh');
  }

  const LANG = {
    zh: {
      tabEdit: '編輯', tabOpacity: '透明度', tabLayers: '圖層', tabSettings: '設定',
      secPart: '部件', allParts: '整件衣服',
      opacity: '透明度',
      coord: '座標', coordDrag: '拖移',
      rotate: '旋轉', rotateDrag: '拖移',
      scale: '縮放', scaleDrag: '拖移',
      skew: '傾斜',
      mirror: '鏡射', mirrorH: '水平', mirrorV: '垂直', mirrorCopy: '水平複製', mirrorCopyV: '垂直複製',
      mirrorCenter: '鏡射',
      rotHint: '拖動把手旋轉',
      colorPickerTitle: '選色器',
      colorPickerConfirm: '確認', colorPickerCancel: '取消',
      harmSec: '和諧色', shadesSec: '漸層', savedSec: '已儲存',
      harmCompl: '互補', harmTriadic: '三角', harmAnalog: '類比', harmSplit: '分裂', harmTetr: '四角',
      colorSave: '儲存', colorClear: '清除',
      layerPriority: '優先度', noLayers: '此物品無可編輯圖層',
      settingsEmpty: '⚙️ 設定\n功能擴充中',
    },
    en: {
      tabEdit: 'Edit', tabOpacity: 'Opacity', tabLayers: 'Layers', tabSettings: '⚙',
      secPart: 'Layers', allParts: 'Whole Item',
      opacity: 'Opacity',
      coord: 'Position', coordDrag: 'Drag',
      rotate: 'Rotation', rotateDrag: 'Drag',
      scale: 'Scale', scaleDrag: 'Drag',
      skew: 'Skew',
      mirror: 'Mirror', mirrorH: 'Horiz.', mirrorV: 'Vert.', mirrorCopy: 'Copy H', mirrorCopyV: 'Copy V',
      mirrorCenter: 'Axis',
      rotHint: 'Drag handle to rotate',
      colorPickerTitle: 'Color Picker',
      colorPickerConfirm: 'Confirm', colorPickerCancel: 'Cancel',
      harmSec: 'Harmony', shadesSec: 'Shades', savedSec: 'Saved',
      harmCompl: 'Compl.', harmTriadic: 'Triadic', harmAnalog: 'Analog.', harmSplit: 'Split', harmTetr: 'Tetr.',
      colorSave: 'Save', colorClear: 'Clear',
      layerPriority: 'Priority', noLayers: 'No editable layers',
      settingsEmpty: '⚙️ Settings\nMore features coming soon',
    }
  };

  function t(k) { return (isZh() ? LANG.zh : LANG.en)[k] ?? k; }

  // ============================================================
  // RENDER ENGINE
  //
  // v0.7.0 重構說明（根據 estsanatlehi 的建議）：
  //
  //  ✅ 已移除：session stack、_charMatOffset、name-keyed session.map
  //     原因：estsanatlehi 指出 BeforeDraw 直接給你 Item，不需要預建 map
  //     「BeforeDraw is passing you the Item, so you could just peek...」
  //
  //  ✅ 現在：使用簡單全域變數 (_aeePendingTd 等)
  //     JS 渲染迴圈是 single-threaded，單一全域變數就夠了
  //
  //  ✅ GLDrawImage 已原生支援：Mirror (FlipX)、Invert (FlipY)、Zoom（均勻縮放）
  //     TODO: 改為透過 GLDrawImage 參數傳遞 FlipX/FlipY（需搭配 ScriptDraw）
  //
  //  ⚠️  仍保留 prototype patch 的功能（只剩必要的部分）：
  //     - uniformMatrix4fv：rotation + non-uniform scale（GLDrawImage 真正缺少的）
  //     - drawArrays：MirrorCopy extra draw call（GLDrawImage 原生無法做到）
  //
  //  ⚠️  TODO（低端機器 / Canvas 2D fallback）：
  //     - BeforeDraw 可被 BC 的 dynamic drawing 開關停用
  //     - 長期需要不依賴 BeforeDraw 的渲染路徑
  //     - Canvas 2D 路徑（GLDrawLoad(null, true)）仍待完整支援
  //
  //  📋 屬性格式：待與 LSCG 開發者 Sera 協調統一命名
  //     (LayerOverrides: FlipX, FlipY, ScaleX, ScaleY, Rotation, MirrorCopy, MirrorCopyV,
  //      DrawingLeft, DrawingTop, Opacity)
  // ============================================================

  let assetGroupMap = new Map();
  let currentRenderChar = null;

  // ── DEBUG ──
  const AEE_DEBUG = false;
  function aeeLog(...a) { if (AEE_DEBUG) console.log("🐈‍⬛[AEE]", ...a); }

  // ── 渲染狀態全域變數（取代舊的 session stack） ──
  // 由 BeforeDraw hook 設定，由 uniformMatrix4fv / drawArrays 消費
  let _aeePendingTd      = null; // 當前 layer 的 transform data
  let _aeePendingApplied = 0;    // 同一 layer 可能有 2 次 uniformMatrix4fv call（main + mask）
  let _aeeMCFlags        = null; // { mirrorCopy, mirrorCopyV }，專供 drawArrays hook 使用
  let _aeeLastMatData    = null; // 儲存最後一次的 matrix，供 MirrorCopy 第二次 draw 使用
  let _aeeLastMatLoc     = null;
  let _aeeLastGl         = null;

  const _origMat  = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  const _origDraw = WebGL2RenderingContext.prototype.drawArrays;

  // ============================================================
  // GLDrawAppearanceBuild HOOK
  // 只負責：套用 Opacity + Priority overrides（需在 BC build 前套用）
  // 不再建立 session，不再建 name-keyed map
  // Transform 資料由 BeforeDraw hook 在每個 layer 繪製時直接讀取
  // ============================================================

  modApi.hookFunction("GLDrawAppearanceBuild", 1, (args, next) => {
    const C = args[0];
    currentRenderChar = C;

    // ── PHASE 1：Priority only ──
    //
    // 透明度策略（與 LSCG 對齊，不再在此處理）：
    //   整件衣服：Property.Opacity（BC 原生 per-layer float 陣列，server sync，所有人看得到）
    //   個別圖層：LayerOverrides[i].Opacity，由 BeforeDraw 回傳 Alpha 覆蓋
    //   此 hook 完全不碰 opacity，避免與 BC / LSCG 衝突
    const savedPri = [];
    C.Appearance?.forEach(item => {
      const assetLayers = item.Asset?.Layer;
      const over = item.Property?.OverridePriority;
      if (over != null) {
        assetLayers?.forEach(layer => {
          const newPri = typeof over === 'number' ? over :
            (typeof over === 'object' && over[layer.Name] != null ? over[layer.Name] : null);
          if (newPri != null) {
            savedPri.push({ layer, original: layer.Priority });
            layer.Priority = newPri;
          }
        });
      }
    });

    const result = next(args);

    savedPri.forEach(({ layer, original }) => { layer.Priority = original; });

    C.AppearanceLayers?.forEach(layer => {
      const asset = layer.Asset?.Name, group = layer.Asset?.Group?.Name;
      if (asset && group) assetGroupMap.set(asset, group);
    });

    return result;
  });

  // GLDrawImage 說明：
  // BC 已原生支援 Mirror (FlipX)、Invert (FlipY)、Zoom（均勻縮放）
  // 目前只有 rotation 和 MirrorCopy 真正缺少原生支援
  // 此 hook 保留為未來擴充點（例如：當 BC 正式支援 rotation 後從此接入）
  modApi.hookFunction("GLDrawImage", 1, (args, next) => {
    return next(args);
  });

  // ============================================================
  // WebGL prototype patch（最小化版）
  //
  // uniformMatrix4fv：注入 rotation + non-uniform scale
  //   - FlipX/FlipY 暫時仍在此處理（TODO: 改用 GLDrawImage Mirror/Invert 參數）
  //   - 保留 pendingApplied 計數：同一 layer 有 main + mask 共 2 次 call
  //
  // drawArrays：僅處理 MirrorCopy（第二次鏡像 draw call）
  //   - 這是 GLDrawImage 目前真正做不到的功能
  // ============================================================

  WebGL2RenderingContext.prototype.uniformMatrix4fv = function(loc, tp, data) {
    if (data instanceof Float32Array && data.length === 16 && _aeePendingTd) {
      const td = _aeePendingTd;

      // 同一 layer 最多消費 2 次（main draw + mask draw）
      _aeePendingApplied++;
      if (_aeePendingApplied >= 2) {
        _aeePendingTd      = null;
        _aeePendingApplied = 0;
      }

      const m = new Float32Array(data);

      // ── Rotation + non-uniform scale ──
      // ── Rotation + non-uniform scale（中心錨點）──
      // 記錄改動前的基底向量，改完後補償平移，使影像中心保持不動
      if (td.rotation !== 0 || td.scaleX !== 1 || td.scaleY !== 1) {
        const old0 = m[0], old1 = m[1], old4 = m[4], old5 = m[5];
        const rad = -td.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const sx  = Math.sqrt(old0**2 + old1**2) * td.scaleX;
        const sy  = Math.sqrt(old4**2 + old5**2) * td.scaleY;
        const sgx = old0 < 0 ? -1 : 1;
        const sgy = old5 < 0 ? -1 : 1;
        m[0] =  cos * sx * sgx;
        m[1] =  sin * sx * sgx;
        m[4] = -sin * sy * sgy;
        m[5] =  cos * sy * sgy;
        // 中心補償：new_center - old_center = 0.5 * (new_basis - old_basis)
        m[12] -= 0.5 * (m[0] + m[4] - old0 - old4);
        m[13] -= 0.5 * (m[1] + m[5] - old1 - old5);
      }

      // ── Skew（傾斜）── 中心錨點
      // 先記錄原始基底向量，skewX/skewY 各自補償平移，使影像中心保持不動
      if (td.skewX !== 0 || td.skewY !== 0) {
        const bx0 = m[0], by0 = m[1]; // X 基底（skewY 要用原始值）
        const bx4 = m[4], by5 = m[5]; // Y 基底（skewX 要用原始值）
        if (td.skewX !== 0) {
          const tx = Math.tan(td.skewX * Math.PI / 180);
          m[4] += tx * bx0;
          m[5] += tx * by0;
          // 中心補償：中心點因 skewX 位移了 0.5*tx*basis，反向修正平移
          m[12] -= 0.5 * tx * bx0;
          m[13] -= 0.5 * tx * by0;
        }
        if (td.skewY !== 0) {
          const ty = Math.tan(td.skewY * Math.PI / 180);
          m[0] += ty * bx4;
          m[1] += ty * by5;
          m[12] -= 0.5 * ty * bx4;
          m[13] -= 0.5 * ty * by5;
        }
      }

      // ── FlipX / FlipY（中心鏡射，固定用 0.5）──
      if (td.flipX) {
        m[12] += m[0]; // 0.5 * 2 * m[0]
        m[13] += m[1];
        m[0] = -m[0]; m[1] = -m[1];
      }
      if (td.flipY) {
        m[12] += m[4]; // 0.5 * 2 * m[4]
        m[13] += m[5];
        m[4] = -m[4]; m[5] = -m[5];
      }

      // ── 儲存 matrix 供 MirrorCopy drawArrays hook 使用 ──
      if (td.mirrorCopy || td.mirrorCopyV) {
        _aeeLastMatData = m;
        _aeeLastMatLoc  = loc;
        _aeeLastGl      = this;
        _aeeMCFlags     = { mirrorCopy: td.mirrorCopy, mirrorCopyV: td.mirrorCopyV,
                            mirrorCopyAxisX: td.mirrorCopyAxisX ?? 0.5, mirrorCopyAxisY: td.mirrorCopyAxisY ?? 0.5 };
      } else {
        _aeeLastMatData = null;
        _aeeMCFlags     = null;
      }

      aeeLog(`mat: rot=${td.rotation} sx=${td.scaleX} sy=${td.scaleY} flip=${td.flipX}/${td.flipY}`);
      return _origMat.call(this, loc, tp, m);
    }

    // 無 pendingTd：清除 MirrorCopy 殘留狀態，避免跨 layer 污染
    if (!_aeePendingTd) {
      _aeeLastMatData = null;
      _aeeMCFlags     = null;
    }
    return _origMat.call(this, loc, tp, data);
  };

  WebGL2RenderingContext.prototype.drawArrays = function(mode, first, count) {
    const result = _origDraw.call(this, mode, first, count);

    // MirrorCopy：在原始 draw call 後額外繪製鏡像 copy
    // 這是 GLDrawImage 目前無法原生支援的功能（需要第二次 draw call）
    if (!_aeeMCFlags || !_aeeLastMatData || _aeeLastGl !== this) return result;

    if (_aeeMCFlags.mirrorCopy) {
      const mM = new Float32Array(_aeeLastMatData);
      mM[0] = -mM[0]; mM[1] = -mM[1];
      const ax = 2 * (_aeeMCFlags.mirrorCopyAxisX ?? 0.5) - 1; // 0-1 → clip space(-1~1), 0.5→0(畫面中心)
      mM[12] = 2 * ax - mM[12];
      _origMat.call(this, _aeeLastMatLoc, false, mM);
      _origDraw.call(this, mode, first, count);
      aeeLog('MirrorCopy draw');
    }
    if (_aeeMCFlags.mirrorCopyV) {
      const mV = new Float32Array(_aeeLastMatData);
      mV[4] = -mV[4]; mV[5] = -mV[5];
      const ay = 2 * (_aeeMCFlags.mirrorCopyAxisY ?? 0.5) - 1;
      mV[13] = 2 * ay - mV[13];
      _origMat.call(this, _aeeLastMatLoc, false, mV);
      _origDraw.call(this, mode, first, count);
      aeeLog('MirrorCopyV draw');
    }

    // MirrorCopy 只在第一個 drawArrays 後執行一次，之後清除避免重複
    _aeeLastMatData = null;
    _aeeMCFlags     = null;

    return result;
  };

  // ============================================================
  // DATA HELPERS
  // ============================================================

  // Resolve current item from either wardrobe or dialog (restraint) context
  function getCurrentItem() {
    if (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode === 'Color') {
      return InventoryGet(CharacterAppearanceSelection, CharacterAppearanceColorPickerGroupName);
    }
    if (_aeeItemColorItem) return _aeeItemColorItem;
    return null;
  }

  function getCurrentGroup() {
    if (typeof CharacterAppearanceColorPickerGroupName !== 'undefined' && CharacterAppearanceColorPickerGroupName)
      return CharacterAppearanceColorPickerGroupName;
    if (_aeeItemColorItem) return _aeeItemColorItem.Asset?.Group?.Name || null;
    return null;
  }

  function ensureLO(item) {
    if (!item) return;
    if (!item.Property) item.Property = {};
    const count = item.Asset?.Layer?.length || 1;
    if (!Array.isArray(item.Property.LayerOverrides))
      item.Property.LayerOverrides = Array.from({ length: count }, () => ({}));
    while (item.Property.LayerOverrides.length < count) item.Property.LayerOverrides.push({});
  }

  // ── Opacity 架構說明 ──────────────────────────────────────────────────────
  // LayerOverrides[i].Opacity  = 每個 layer 自己的值（undefined = 未設定 = 1.0）
  // Property.Opacity[i]        = BC 最終渲染值，由 recomputeOpacity() 從上面計算
  //
  // 「整件」slider 只是 UI 方便操作：一次把所有 LayerOverrides[i].Opacity 設成同值。
  // 個別 layer 之後再改就只影響那個 slot。不需要任何自訂欄位。
  // （和 LSCG setOpacityInProperty 邏輯相同：scalar → 展開為陣列）
  // ─────────────────────────────────────────────────────────────────────────

  // ── Opacity 架構 ───────────────────────────────────────────────────────────
  // LayerOverrides[i].Opacity  : 每個 layer 的渲染值（undefined = 未設定 = BC 預設）
  // Property.Opacity[i]        : BC 實際渲染（與 LayerOverrides[i].Opacity 同步）
  //
  // 規則：
  //   "整件" 完全沒有自己的儲存值，只是「同時對所有 slot 執行個別設定」的快捷鍵。
  //   設整件 X → 對所有 i：LayerOverrides[i].Opacity = X，Property.Opacity[i] = X
  //   設個別 i X → LayerOverrides[i].Opacity = X，Property.Opacity[i] = X（其他 slot 不動）
  //   讀整件 slider 顯示 → 若所有已設定的 slot 值相同則顯示該值，否則顯示 null（UI 顯示 —）
  //   讀個別 slot → LayerOverrides[i].Opacity ?? Property.Opacity[i] ?? 1
  // ─────────────────────────────────────────────────────────────────────────

  function _ensureOpacityArray(item) {
    const layerCount = item.Asset?.Layer?.length || 1;
    if (!Array.isArray(item.Property.Opacity) || item.Property.Opacity.length !== layerCount) {
      // 手動建立陣列，不呼叫 ItemColorSanitizeProperty（它會把值重設為 asset 預設，蓋掉我們的設定）
      // 保留現有值（如果是 scalar）或補滿 1
      const existing = item.Property.Opacity;
      const base = typeof existing === 'number' ? existing : 1;
      item.Property.Opacity = Array(layerCount).fill(base);
    }
  }

  function setLO(item, layerIdx, key, val) {
    ensureLO(item);
    const count = item.Asset?.Layer?.length || 1;
    const indices = layerIdx === 'all'
      ? Array.from({ length: count }, (_, i) => i)
      : [parseInt(layerIdx)];

    if (key === 'Opacity') {
      _ensureOpacityArray(item);
      indices.forEach(i => {
        const layer = item.Asset?.Layer?.[i];
        const clamped = Math.min(Math.max(val, layer?.MinOpacity ?? 0), layer?.MaxOpacity ?? 1);
        if (!item.Property.LayerOverrides[i]) item.Property.LayerOverrides[i] = {};
        item.Property.LayerOverrides[i].Opacity = clamped;
        if (i < item.Property.Opacity.length) item.Property.Opacity[i] = clamped;
      });
      // Opacity 必須重繪 canvas 才能生效（CharacterRefresh 只更新資料模型，不觸發 canvas redraw）
      const _rc = CharacterAppearanceSelection || _aeeItemColorChar;
      if (_rc) {
        try { CharacterLoadCanvas(_rc); } catch(e) {}
        if (_aeeItemColorChar && _aeeItemColorChar !== _rc) {
          _aeeItemColorDirty = true;
          try { CharacterLoadCanvas(_aeeItemColorChar); } catch(e) {}
        }
      }

    } else {
      indices.forEach(i => {
        if (!item.Property.LayerOverrides[i]) item.Property.LayerOverrides[i] = {};
        item.Property.LayerOverrides[i][key] = val;
      });
      // transform 類屬性走 BeforeDraw，CharacterRefresh 就夠
      const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) {
        CharacterRefresh(_rc, false, false);
        if (_aeeItemColorChar) {
          _aeeItemColorDirty = true;
          try { if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(_aeeItemColorChar); } catch(e) {}
        }
      }
    }
  }

  // 讀取指定 slot 的 opacity 值（整件時回傳 null 若各 slot 不一致）
  function getOpacity(item, idx) {
    if (idx === 'all') {
      // 整件：若所有 layer 值相同則回傳，否則 null（UI 顯示 —）
      const count = item?.Asset?.Layer?.length || 1;
      let commonVal = null;
      for (let i = 0; i < count; i++) {
        const lo = item?.Property?.LayerOverrides?.[i];
        const v  = lo?.Opacity ?? (Array.isArray(item.Property?.Opacity) ? item.Property.Opacity[i] : 1) ?? 1;
        if (i === 0) commonVal = v;
        else if (Math.abs(v - commonVal) > 0.005) return null; // 不一致
      }
      return commonVal;
    } else {
      const i  = parseInt(idx);
      const lo = item?.Property?.LayerOverrides?.[i];
      if (lo?.Opacity != null) return lo.Opacity;
      const rawOp = item?.Property?.Opacity;
      return Array.isArray(rawOp) ? rawOp[i] : (typeof rawOp === 'number' ? rawOp : 1);
    }
  }

  function getLO(item, idx) {
    const i = idx === 'all' ? 0 : parseInt(idx);
    const lo = item?.Property?.LayerOverrides?.[i] || {};
    const opacity = getOpacity(item, idx) ?? 1;
    return { ...lo, Opacity: opacity };
  }

  function getLayerDisplayName(layer, i) {
    if (!layer) return `Layer ${i}`;
    try {
      if (typeof ItemColorLayerNames !== 'undefined' && ItemColorLayerNames) {
        const asset = layer.Asset;
        const key   = (asset?.DynamicGroupName ?? '') + (asset?.Name ?? '') + (layer.Name ?? '');
        const text  = ItemColorLayerNames.get(key);
        if (text && !text.startsWith('MISSING') && text !== key) return text;
      }
    } catch(e) {}
    return layer.Name || `Layer ${i}`;
  }

  function getLayerColor(item, layerIdx) {
    if (!item) return null;
    const colors = item.Property?.Color ?? item.Color;
    if (!colors) return null;
    const idx = layerIdx === 'all' ? 0 : parseInt(layerIdx);
    if (Array.isArray(colors)) return colors[idx] ?? colors[0] ?? null;
    return typeof colors === 'string' ? colors : null;
  }

  function setLayerColor(item, layerIdx, hexColor) {
    if (!item) return;
    const layers = item.Asset?.Layer;
    const count = layers?.length || 1;
    const idx = layerIdx === 'all' ? 'all' : parseInt(layerIdx);
    if (!item.Property) item.Property = {};

    function initColorArr(src) {
      if (Array.isArray(src)) return src.slice();
      const base = typeof src === 'string' ? src : '#FFFFFF';
      return Array.from({ length: count }, () => base);
    }

    if (!Array.isArray(item.Property.Color))
      item.Property.Color = initColorArr(item.Property.Color ?? item.Color);
    if (!Array.isArray(item.Color))
      item.Color = initColorArr(item.Color);

    if (idx === 'all') {
      for (let i = 0; i < count; i++) {
        item.Property.Color[i] = hexColor;
        item.Color[i] = hexColor;
      }
    } else {
      while (item.Property.Color.length <= idx) item.Property.Color.push('#FFFFFF');
      while (item.Color.length <= idx) item.Color.push('#FFFFFF');
      item.Property.Color[idx] = hexColor;
      item.Color[idx] = hexColor;
    }
    { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
  }

  // 同步更新 UI 上所有與該圖層顏色相關的色塊（chip + dot）
  function updateColorUI(layerIdx, hex) {
    if (!shadowRoot) return;
    shadowRoot.querySelectorAll(`[data-color-edit="${layerIdx}"] .color-chip-inner`).forEach(el => { el.style.background = hex; });
    shadowRoot.querySelectorAll(`[data-color-dot="${layerIdx}"]`).forEach(el => { el.style.background = hex; });
    if (layerIdx === 'all') {
      // 整件變色時，所有個別圖層的 chip 和 dot 一起更新
      shadowRoot.querySelectorAll('.color-chip-inner').forEach(el => { el.style.background = hex; });
      shadowRoot.querySelectorAll('[data-color-dot]').forEach(el => { el.style.background = hex; });
    }
  }

  function getCanvas() { return document.getElementById('MainCanvas') || document.querySelector('canvas'); }
  function getCanvasRect() { const c = getCanvas(); return c ? c.getBoundingClientRect() : null; }

  function alignHost() {
    if (!hostEl) return;
    const r = getCanvasRect();
    if (!r) return;
    hostEl.style.left = r.left + 'px';
    hostEl.style.top  = r.top  + 'px';
    hostEl.style.width  = r.width  + 'px';
    hostEl.style.height = r.height + 'px';
  }

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    tab: 'edit',
    selectedLayer: null,
    collapsed: false,
    activeDrag: null,
    scaleLock: true,
  };

  const LOCKED_GROUPS = new Set(['BodyUpper','BodyLower','Nipples','Pussy','Head']);
  function getCurrentGroupName() {
    return getCurrentItem()?.Asset?.Group?.Name ?? null;
  }
  function isGroupLocked() {
    return LOCKED_GROUPS.has(getCurrentGroupName());
  }

  // ============================================================
  // DRAG — XY
  // ============================================================

  let xyDragState = null;

  document.addEventListener('mousedown', e => {
    if (hostEl && hostEl.contains(e.target)) return;
    if (colorPickerHostEl && colorPickerHostEl.contains(e.target)) return;
    if (state.activeDrag !== 'xy' || state.selectedLayer === null) return;
    const c = getCanvas(); if (!c) return;
    const r = c.getBoundingClientRect();
    const cx = (e.clientX - r.left) * ((c.width||2000)/r.width);
    const cy = (e.clientY - r.top)  * ((c.height||1000)/r.height);
    if (cx < 300 || cx > 1700 || cy < 50 || cy > 950) return;
    const item = getCurrentItem(); if (!item) return;
    const lo = getLO(item, state.selectedLayer);
    xyDragState = {
      layerIdx: state.selectedLayer,
      startX: e.clientX, startY: e.clientY,
      origX: lo.DrawingLeft?.[""] ?? (typeof item.Asset?.Layer?.[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)]?.DrawingLeft === 'object' ? (item.Asset.Layer[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)].DrawingLeft?.['']??0) : (item.Asset?.Layer?.[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)]?.DrawingLeft??0)),
      origY: lo.DrawingTop?.[""]  ?? (typeof item.Asset?.Layer?.[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)]?.DrawingTop  === 'object' ? (item.Asset.Layer[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)].DrawingTop?.[''] ??0) : (item.Asset?.Layer?.[state.selectedLayer==='all'?0:parseInt(state.selectedLayer)]?.DrawingTop ??0)),
      flipX: !!lo.FlipX, flipY: !!lo.FlipY,
    };
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mousemove', e => {
    if (!xyDragState) return;
    const c = getCanvas(); if (!c) return;
    const r = c.getBoundingClientRect();
    const sx = (c.width||2000)/r.width, sy = (c.height||1000)/r.height;
    const dx = (e.clientX - xyDragState.startX)*sx;
    const dy = (e.clientY - xyDragState.startY)*sy;
    const item = getCurrentItem(); if (!item) return;
    ensureLO(item);
    const count = item.Asset?.Layer?.length||1;
    const indices = xyDragState.layerIdx === 'all'
      ? Array.from({length:count},(_,i)=>i)
      : [parseInt(xyDragState.layerIdx)];
    indices.forEach(i => {
      const lo = item.Property.LayerOverrides[i]||{};
      lo.DrawingLeft = {"": Math.round(xyDragState.origX + (xyDragState.flipX?-dx:dx))};
      lo.DrawingTop  = {"": Math.round(xyDragState.origY + (xyDragState.flipY?-dy:dy))};
      item.Property.LayerOverrides[i] = lo;
    });
    { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    updateEditSection();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mouseup', e => {
    if (!xyDragState) return;
    xyDragState = null;
    e.stopImmediatePropagation();
  }, true);

  // ============================================================
  // DRAG — SCALE
  // ============================================================

  let scaleDragState = null;

  document.addEventListener('mousedown', e => {
    if (hostEl && hostEl.contains(e.target)) return;
    if (colorPickerHostEl && colorPickerHostEl.contains(e.target)) return;
    if (state.activeDrag !== 'scale' || state.selectedLayer === null) return;
    const c = getCanvas(); if (!c) return;
    const r = c.getBoundingClientRect();
    const cx = (e.clientX - r.left) * ((c.width||2000)/r.width);
    const cy = (e.clientY - r.top)  * ((c.height||1000)/r.height);
    if (cx < 300 || cx > 1700 || cy < 50 || cy > 950) return;
    const item = getCurrentItem(); if (!item) return;
    const lo = getLO(item, state.selectedLayer);
    scaleDragState = {
      layerIdx: state.selectedLayer,
      startX: e.clientX, startY: e.clientY,
      origSX: lo.ScaleX??1, origSY: lo.ScaleY??1,
    };
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mousemove', e => {
    if (!scaleDragState) return;
    const c = getCanvas(); if (!c) return;
    const scalePerPx = 0.005;
    const dx = (e.clientX - scaleDragState.startX) * scalePerPx;
    const dy = (e.clientY - scaleDragState.startY) * scalePerPx;
    const item = getCurrentItem(); if (!item) return;
    let newSX, newSY;
    if (state.scaleLock) {
      const avgDelta = (dx + dy) / 2;
      const ratio = scaleDragState.origSX > 0 ? scaleDragState.origSY / scaleDragState.origSX : 1;
      newSX = Math.max(0.05, +(scaleDragState.origSX + avgDelta).toFixed(2));
      newSY = Math.max(0.05, +(newSX * ratio).toFixed(2));
    } else {
      newSX = Math.max(0.05, +(scaleDragState.origSX + dx).toFixed(2));
      newSY = Math.max(0.05, +(scaleDragState.origSY + dy).toFixed(2));
    }
    setLO(item, scaleDragState.layerIdx, 'ScaleX', newSX);
    setLO(item, scaleDragState.layerIdx, 'ScaleY', newSY);
    updateEditSection();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mouseup', e => {
    if (!scaleDragState) return;
    scaleDragState = null;
    e.stopImmediatePropagation();
  }, true);

  // ============================================================
  // DRAG — SKEW
  // ============================================================

  let skewDragState = null;

  document.addEventListener('mousedown', e => {
    if (hostEl && hostEl.contains(e.target)) return;
    if (colorPickerHostEl && colorPickerHostEl.contains(e.target)) return;
    if (state.activeDrag !== 'skew' || state.selectedLayer === null) return;
    const c = getCanvas(); if (!c) return;
    const r = c.getBoundingClientRect();
    const cx = (e.clientX - r.left) * ((c.width||2000)/r.width);
    const cy = (e.clientY - r.top)  * ((c.height||1000)/r.height);
    if (cx < 300 || cx > 1700 || cy < 50 || cy > 950) return;
    const item = getCurrentItem(); if (!item) return;
    const lo = getLO(item, state.selectedLayer);
    skewDragState = {
      layerIdx: state.selectedLayer,
      startX: e.clientX, startY: e.clientY,
      origSX: lo.SkewX ?? 0, origSY: lo.SkewY ?? 0,
    };
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mousemove', e => {
    if (!skewDragState) return;
    const degPerPx = 0.3;
    const dx = (e.clientX - skewDragState.startX) * degPerPx;
    const dy = (e.clientY - skewDragState.startY) * degPerPx;
    const item = getCurrentItem(); if (!item) return;
    setLO(item, skewDragState.layerIdx, 'SkewX', +(skewDragState.origSX + dx).toFixed(1));
    setLO(item, skewDragState.layerIdx, 'SkewY', +(skewDragState.origSY + dy).toFixed(1));
    updateEditSection();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('mouseup', e => {
    if (!skewDragState) return;
    skewDragState = null;
    e.stopImmediatePropagation();
  }, true);

  // ── Opacity Overlay（收納模式透明度調整浮層，可拖動） ─────────────────────
  let opOverlayHost = null;
  let opShadow = null;
  // 位置：相對 canvas，預設右下偏上（往上200px、往右300px 於角色腳下基準）
  const OP_BASE_CX = 0.50;
  const OP_BASE_CY = 0.97;
  const OP_OFFSET_X = 300;
  const OP_OFFSET_Y = -200;
  let _opDrag = null; // { startX, startY, startOffX, startOffY }
  let _opCustomOffset = null; // { x, y } — user dragged position

  function buildOpOverlay() {
    if (opOverlayHost) return;
    opOverlayHost = document.createElement('div');
    opOverlayHost.style.cssText = 'position:fixed;z-index:999996;pointer-events:none;';
    document.body.appendChild(opOverlayHost);
    opShadow = opOverlayHost.attachShadow({ mode: 'open' });
    opShadow.innerHTML = `
      <style>
        :host { all:initial; display:block; }
        * { user-select:none; -webkit-user-select:none; box-sizing:border-box; }
        #op-overlay { position:absolute; display:none; pointer-events:none; }
        #op-overlay.on { display:block; }
        #op-panel {
          position:absolute;
          display:flex; flex-direction:column; align-items:center; gap:5px;
          background:rgba(15,10,40,0.88); border:1px solid rgba(124,106,247,0.4);
          border-radius:10px; padding:6px 14px 10px;
          pointer-events:all;
          backdrop-filter:blur(6px);
          transform:translateX(-50%);
          min-width:200px;
        }
        #op-drag-handle {
          width:100%; height:16px; cursor:grab; display:flex; align-items:center; justify-content:center;
          color:rgba(255,255,255,0.25); font-size:11px; letter-spacing:3px;
          margin-bottom:-2px;
        }
        #op-drag-handle:active { cursor:grabbing; }
        #op-title {
          font-family:'Segoe UI',sans-serif; font-size:11px; font-weight:600;
          color:rgba(255,255,255,0.55); letter-spacing:.04em; text-align:center;
        }
        #op-val-label {
          font-family:'Segoe UI',sans-serif; font-size:14px; font-weight:700;
          color:#fff; text-align:center; min-width:42px;
        }
        #op-row { display:flex; align-items:center; gap:6px; }
        .op-step-btn {
          width:22px; height:22px; border-radius:5px; border:1px solid rgba(124,106,247,0.4);
          background:rgba(124,106,247,0.15); color:#fff; font-size:14px; line-height:1;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          pointer-events:all; flex-shrink:0;
        }
        .op-step-btn:hover { background:rgba(124,106,247,0.35); }
        #op-slider {
          -webkit-appearance:none; appearance:none;
          width:140px; height:6px; border-radius:3px; outline:none; cursor:pointer;
          background:linear-gradient(to right, rgba(124,106,247,0.9) var(--pct,100%), rgba(255,255,255,0.15) var(--pct,100%));
          pointer-events:all;
        }
        #op-slider::-webkit-slider-thumb {
          -webkit-appearance:none; width:15px; height:15px; border-radius:50%;
          background:#7c6af7; border:2px solid #fff; cursor:pointer;
        }
        #op-close {
          position:absolute; top:3px; right:7px; background:none; border:none;
          color:rgba(255,255,255,0.3); font-size:13px; cursor:pointer; line-height:1;
          pointer-events:all;
        }
        #op-close:hover { color:rgba(255,255,255,0.7); }
      </style>
      <div id="op-overlay">
        <div id="op-panel">
          <button id="op-close">✕</button>
          <div id="op-drag-handle">· · ·</div>
          <div id="op-title">${isZh() ? '透明度' : 'Opacity'}</div>
          <div id="op-row">
            <button class="op-step-btn" id="op-minus">−</button>
            <input type="range" id="op-slider" min="0" max="100" step="1" value="100"/>
            <button class="op-step-btn" id="op-plus">+</button>
          </div>
          <div id="op-val-label">100%</div>
        </div>
      </div>`;

    const shadow  = opShadow;
    const slider  = shadow.getElementById('op-slider');
    const valLbl  = shadow.getElementById('op-val-label');

    function syncUI(val) {
      slider.value = val;
      valLbl.textContent = val + '%';
      slider.style.setProperty('--pct', val + '%');
    }
    function applyVal(val) {
      syncUI(val);
      const item = getCurrentItem();
      if (!item || state.selectedLayer === null) return;
      setLO(item, state.selectedLayer, 'Opacity', val / 100);
      updateOpacityTab();
    }

    slider.addEventListener('input', () => applyVal(parseInt(slider.value)));
    shadow.getElementById('op-minus').addEventListener('click', () => applyVal(Math.max(0, parseInt(slider.value) - 1)));
    shadow.getElementById('op-plus').addEventListener('click',  () => applyVal(Math.min(100, parseInt(slider.value) + 1)));
    shadow.getElementById('op-close').addEventListener('click', hideOpOverlay);

    // drag handle — use pointer capture so BC canvas can't steal events
    const handle = shadow.getElementById('op-drag-handle');
    handle.addEventListener('pointerdown', ev => {
      ev.preventDefault();
      handle.setPointerCapture(ev.pointerId);
      const panel = shadow.getElementById('op-panel');
      const px = parseFloat(panel.style.left) || 0;
      const py = parseFloat(panel.style.top)  || 0;
      _opDrag = { startX: ev.clientX, startY: ev.clientY, startPX: px, startPY: py };
    });
    handle.addEventListener('pointermove', ev => {
      if (!_opDrag) return;
      const panel = shadow.getElementById('op-panel');
      panel.style.left = (_opDrag.startPX + ev.clientX - _opDrag.startX) + 'px';
      panel.style.top  = (_opDrag.startPY + ev.clientY - _opDrag.startY) + 'px';
      _opCustomOffset  = { x: parseFloat(panel.style.left), y: parseFloat(panel.style.top) };
    });
    handle.addEventListener('pointerup',   () => { _opDrag = null; });
    handle.addEventListener('pointercancel', () => { _opDrag = null; });
  }

  function alignOpOverlay() {
    if (!opOverlayHost) return;
    const r = getCanvasRect(); if (!r) return;
    opOverlayHost.style.left   = r.left + 'px';
    opOverlayHost.style.top    = r.top  + 'px';
    opOverlayHost.style.width  = r.width + 'px';
    opOverlayHost.style.height = r.height + 'px';
    // only reposition if user hasn't dragged
    if (!_opCustomOffset) {
      const panel = opShadow?.getElementById('op-panel');
      if (panel) {
        panel.style.left = (r.width  * OP_BASE_CX + OP_OFFSET_X) + 'px';
        panel.style.top  = (r.height * OP_BASE_CY + OP_OFFSET_Y) + 'px';
      }
    }
  }

  function showOpOverlay() {
    buildOpOverlay();
    alignOpOverlay();
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const lo  = getLO(item, state.selectedLayer);
    const val = Math.round((lo.Opacity ?? 1) * 100);
    const shadow = opShadow;
    shadow.getElementById('op-slider').value = val;
    shadow.getElementById('op-val-label').textContent = val + '%';
    shadow.getElementById('op-slider').style.setProperty('--pct', val + '%');
    shadow.getElementById('op-overlay').classList.add('on');
    opOverlayHost.style.pointerEvents = 'auto'; // must be auto so shadow panel receives events
  }

  function hideOpOverlay() {
    opShadow?.getElementById('op-overlay')?.classList.remove('on');
    if (opOverlayHost) opOverlayHost.style.pointerEvents = 'none';
    updateToggleIcons();
  }

  // sync opacity tab sliders when op changes
  function updateOpacityTab() {
    if (!shadowRoot) return;
    const item = getCurrentItem(); if (!item) return;

    // 個別 layer sliders
    shadowRoot.querySelectorAll('[data-op-layer]:not([data-op-layer="all"])').forEach(el => {
      const idx = el.dataset.opLayer;
      const v   = getOpacity(item, idx) ?? 1;
      const val = Math.round(v * 100);
      el.value  = val;
      const label = shadowRoot.getElementById('op-val-' + idx);
      if (label) label.textContent = val + '%';
    });

    // 整件 row：null = 不一致，顯示 —
    const allSlider = shadowRoot.querySelector('[data-op-layer="all"]');
    const allLabel  = shadowRoot.getElementById('op-val-all');
    const allV      = getOpacity(item, 'all');
    if (allSlider) allSlider.value = allV === null ? 100 : Math.round(allV * 100);
    if (allLabel)  allLabel.textContent = allV === null ? '—' : Math.round(allV * 100) + '%';

    // edit section
    const lo2 = getLO(item, state.selectedLayer ?? 'all');
    const opEl = shadowRoot.getElementById('edit-op-val');
    if (opEl) opEl.textContent = Math.round((lo2.Opacity ?? 1) * 100) + '%';
    const opRange = shadowRoot.querySelector('[data-edit-op]');
    if (opRange) opRange.value = Math.round((lo2.Opacity ?? 1) * 100);

    // op overlay
    if (opShadow?.getElementById('op-overlay')?.classList.contains('on')) {
      const v2 = getOpacity(item, state.selectedLayer ?? 'all');
      const pct = v2 === null ? 100 : Math.round(v2 * 100);
      const sl  = opShadow.getElementById('op-slider');
      const lb  = opShadow.getElementById('op-val-label');
      if (sl) { sl.value = pct; sl.style.setProperty('--pct', pct + '%'); }
      if (lb)  lb.textContent = v2 === null ? '—' : pct + '%';
    }
  }

  let rotOverlayHost = null;
  let rotShadow = null;
  let rotDragState = null;
  const ROT_CX_PCT = 0.50;
  const ROT_CY_PCT = 0.89;
  const ROT_RADIUS = 60;

  function buildRotOverlay() {
    if (rotOverlayHost) return;
    rotOverlayHost = document.createElement('div');
    rotOverlayHost.style.cssText = 'position:fixed;z-index:999997;pointer-events:none;';
    document.body.appendChild(rotOverlayHost);
    rotShadow = rotOverlayHost.attachShadow({ mode: 'open' });
    rotShadow.innerHTML = `
      <style>
        :host { all:initial; display:block; }
        * { user-select:none; -webkit-user-select:none; }
        #rot-overlay { position:absolute; display:none; pointer-events:none; }
        #rot-overlay.on { display:block; }
        svg { overflow:visible; pointer-events:none; }
        #rot-hit {
          fill:rgba(0,0,0,0.01); stroke:transparent; stroke-width:28;
          cursor:crosshair; pointer-events:all;
        }
        #rot-ring-bg { fill:rgba(0,0,0,0.3); stroke:rgba(124,106,247,0.25); stroke-width:1; pointer-events:none; }
        #rot-ring    { fill:none; stroke:rgba(124,106,247,0.6); stroke-width:2; pointer-events:none; }
        #rot-line    { stroke:rgba(124,106,247,0.7); stroke-width:1.5; stroke-dasharray:5 3; pointer-events:none; }
        #rot-handle  { fill:#7c6af7; stroke:#fff; stroke-width:2; pointer-events:none; }
        #rot-label {
          font-family:'Segoe UI',sans-serif; font-size:14px; font-weight:700;
          fill:#fff; text-anchor:middle; dominant-baseline:central;
          pointer-events:none;
        }
        #rot-hint {
          font-family:'Segoe UI',sans-serif; font-size:11px;
          fill:rgba(255,255,255,0.45); text-anchor:middle;
          pointer-events:none;
        }
        #rot-center { fill:rgba(124,106,247,0.5); pointer-events:none; }
      </style>
      <div id="rot-overlay">
        <svg id="rot-svg" width="1" height="1">
          <circle id="rot-ring-bg"/>
          <circle id="rot-ring"/>
          <line   id="rot-line"/>
          <circle id="rot-handle"/>
          <text   id="rot-label"/>
          <text   id="rot-hint"/>
          <circle id="rot-center" r="4"/>
          <circle id="rot-hit"/>
        </svg>
      </div>`;
    rotShadow.getElementById('rot-hit').addEventListener('mousedown', onRotHandleDown);
  }

  function alignRotOverlay() {
    if (!rotOverlayHost) return;
    const r = getCanvasRect();
    if (!r) return;
    rotOverlayHost.style.left   = r.left   + 'px';
    rotOverlayHost.style.top    = r.top    + 'px';
    rotOverlayHost.style.width  = r.width  + 'px';
    rotOverlayHost.style.height = r.height + 'px';
    const svg = rotShadow?.getElementById('rot-svg');
    if (svg) { svg.setAttribute('width', r.width); svg.setAttribute('height', r.height); }
  }

  function _rotCenter() {
    const r = getCanvasRect();
    if (!r) return { cx: 0, cy: 0 };
    return { cx: r.width * ROT_CX_PCT, cy: r.height * ROT_CY_PCT };
  }

  function updateRotOverlay(rotDeg) {
    if (!rotShadow) return;
    const { cx, cy } = _rotCenter();
    const rad = rotDeg * Math.PI / 180;
    const hx = cx + ROT_RADIUS * Math.sin(rad);
    const hy = cy - ROT_RADIUS * Math.cos(rad);
    const setA = (id, attrs) => {
      const el = rotShadow.getElementById(id); if (!el) return;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    };
    setA('rot-ring-bg', { cx, cy, r: ROT_RADIUS });
    setA('rot-ring',    { cx, cy, r: ROT_RADIUS });
    setA('rot-hit',     { cx, cy, r: ROT_RADIUS });
    setA('rot-line',    { x1: cx, y1: cy, x2: hx, y2: hy });
    setA('rot-handle',  { cx: hx, cy: hy, r: 9 });
    setA('rot-center',  { cx, cy });
    const label = rotShadow.getElementById('rot-label');
    if (label) { label.setAttribute('x', cx); label.setAttribute('y', cy); label.textContent = Math.round(rotDeg) + '°'; }
    const hint = rotShadow.getElementById('rot-hint');
    if (hint) { hint.setAttribute('x', cx); hint.setAttribute('y', cy + ROT_RADIUS + 18); hint.textContent = t('rotHint'); }
  }

  function showRotOverlay() {
    buildRotOverlay();
    alignRotOverlay();
    const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
    const lo = getLO(item, state.selectedLayer);
    updateRotOverlay(lo.Rotation ?? 0);
    rotShadow.getElementById('rot-overlay').classList.add('on');
    rotOverlayHost.style.pointerEvents = 'none';
  }

  function hideRotOverlay() {
    rotShadow?.getElementById('rot-overlay')?.classList.remove('on');
  }

  function _calcAngle(clientX, clientY) {
    const r = getCanvasRect(); if (!r) return 0;
    const cx = r.left + r.width  * ROT_CX_PCT;
    const cy = r.top  + r.height * ROT_CY_PCT;
    let angle = Math.atan2(clientX - cx, -(clientY - cy)) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    return Math.round(angle);
  }

  function onRotHandleDown(e) {
    e.preventDefault();
    e.stopPropagation();
    const angle = _calcAngle(e.clientX, e.clientY);
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    setLO(item, state.selectedLayer, 'Rotation', angle);
    updateRotOverlay(angle);
    updateEditSection();
    rotDragState = true;
    const onMove = (ev) => {
      const a = _calcAngle(ev.clientX, ev.clientY);
      const item2 = getCurrentItem(); if (!item2 || state.selectedLayer === null) return;
      setLO(item2, state.selectedLayer, 'Rotation', a);
      updateRotOverlay(a);
      updateEditSection();
    };
    const onUp = () => {
      rotDragState = null;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup',   onUp,   true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup',   onUp,   true);
  }

  // ============================================================
  // COLOR PICKER
  // ============================================================

  let colorPickerHostEl = null;
  let colorPickerShadow = null;

  const CP_CSS = `
:host { all:initial; display:block; }
*{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-user-select:none}
#cp-outer {
  position:fixed; z-index:1000001;
  display:none;
}
#cp-outer.open { display:block; }
#cp-backdrop {
  position:fixed; inset:0; background:transparent; z-index:-1;
}
#cp-wrap {
  display:inline-flex; flex-direction:column; align-items:flex-start; gap:0; position:relative;
  --color-background-primary:#0d0d0f;
  --color-background-secondary:#161619;
  --color-background-tertiary:#1e1e23;
  --color-border-primary:#7c6af7;
  --color-border-secondary:#2a2a35;
  --color-border-tertiary:#2a2a35;
  --color-text-primary:#ffffff;
  --color-text-secondary:#a0a0b0;
  --color-accent:#7c6af7;
  --color-accent2:#4ecdc4;
  --border-radius-lg:12px;
  --font-sans:'Segoe UI',system-ui,-apple-system,sans-serif;
  --font-mono:'SF Mono','Fira Mono',monospace;
}
#cp {
  width:500px;
  background:var(--color-background-primary);
  border:1px solid var(--color-border-secondary);
  border-radius:var(--border-radius-lg);
  display:flex; flex-direction:column;
  padding:12px; gap:7px;
  font-family:var(--font-sans); font-size:13px;
  color:var(--color-text-primary);
  box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,106,247,0.15);
}
#cp-footer-row {
  display:flex; gap:8px; padding-top:6px; border-top:1px solid var(--color-border-tertiary);
}
.cp-footer-btn {
  flex:1; padding:9px; border:1px solid var(--color-border-tertiary);
  border-radius:8px; cursor:pointer; font-size:13px; font-weight:700;
  font-family:var(--font-sans); letter-spacing:.02em;
}
#cp-confirm { background:var(--color-accent); color:#fff; border-color:var(--color-accent); }
#cp-confirm:hover { background:#9080ff; border-color:#9080ff; }
#cp-cancel { background:var(--color-background-secondary); color:var(--color-text-secondary); }
#cp-cancel:hover { background:var(--color-background-tertiary); color:var(--color-text-primary); }
#cp-title-row { font-size:11px; font-weight:700; color:var(--color-accent); letter-spacing:.12em; text-transform:uppercase; padding-bottom:2px; }
.row{display:flex;align-items:center;gap:7px}
.lbl{font-size:11px;color:var(--color-text-secondary);width:16px;text-align:right;flex-shrink:0}
.val-input{font-size:11px;color:var(--color-text-primary);width:36px;text-align:right;flex-shrink:0;font-family:var(--font-mono);background:transparent;border:none;border-bottom:1px solid var(--color-border-tertiary);outline:none;padding:1px 2px;user-select:text;-webkit-user-select:text}
.val-input:focus{border-bottom-color:var(--color-accent)}
.tw{flex:1;height:14px;border-radius:7px;position:relative;cursor:pointer;border:1px solid var(--color-border-tertiary)}
.tt{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);pointer-events:none}
hr{border:none;border-top:1px solid var(--color-border-tertiary)}
.sec{font-size:11px;color:var(--color-text-secondary);letter-spacing:.05em;flex-shrink:0}
.btn-sm{font-size:11px;padding:3px 9px;border-radius:20px;border:1px solid var(--color-border-tertiary);background:transparent;color:var(--color-text-secondary);cursor:pointer;white-space:nowrap;font-family:var(--font-sans)}
.btn-sm:hover{background:var(--color-background-secondary);color:var(--color-text-primary)}
.btn-sm.active{background:rgba(124,106,247,0.15);border-color:var(--color-accent);color:var(--color-accent)}
.sw{flex:1;border-radius:6px;border:1px solid var(--color-border-tertiary);cursor:pointer;position:relative;min-width:0;height:32px}
.sw:hover{border-color:var(--color-accent2)}
.sw-hex{position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;font-family:var(--font-mono);color:rgba(255,255,255,.9);text-shadow:0 1px 2px rgba(0,0,0,.7);pointer-events:none;opacity:0}
.sw:hover .sw-hex{opacity:1}
.sh{flex:1;height:24px;border-radius:6px;border:1px solid var(--color-border-tertiary);cursor:pointer;min-width:0}
.sh:hover{border-color:var(--color-accent2)}
.saved-grid{display:grid;grid-template-columns:repeat(9,1fr);gap:3px}
.sc{aspect-ratio:1;border-radius:4px;border:1px solid var(--color-border-tertiary);cursor:pointer;background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/8px 8px;position:relative}
.sc-c{position:absolute;inset:0;border-radius:3px}
.sc:hover .sc-c{outline:2px solid var(--color-border-secondary)}
.sc.sel .sc-c{outline:2px solid var(--color-accent)}
.swatch-main{width:100px;height:100px;border-radius:9px;border:1px solid var(--color-border-tertiary);flex-shrink:0;background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/10px 10px;position:relative}
.swatch-main-c{position:absolute;inset:0;border-radius:8px}
.hex-in{font-family:var(--font-mono);font-size:12px;width:74px;flex-shrink:0;user-select:text;-webkit-user-select:text;background:transparent;border:1px solid var(--color-border-tertiary);border-radius:4px;color:var(--color-text-primary);padding:2px 4px;outline:none}
.hex-in:focus{border-color:var(--color-accent)}
.alp-in{font-family:var(--font-mono);font-size:12px;width:46px;flex-shrink:0;user-select:text;-webkit-user-select:text;background:transparent;border:1px solid var(--color-border-tertiary);border-radius:4px;color:var(--color-text-primary);padding:2px 4px;outline:none}
.alp-in:focus{border-color:var(--color-accent)}
.hex-code{font-family:var(--font-mono);font-size:11px;color:var(--color-text-secondary);text-align:center;padding-top:3px}
.side-btns{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.icon-btn{width:30px;height:30px;border-radius:7px;border:1px solid var(--color-border-tertiary);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--color-text-secondary)}
.icon-btn:hover{background:var(--color-background-secondary);color:var(--color-accent);border-color:var(--color-accent)}
.rgb-val{font-size:11px;font-family:var(--font-mono);color:var(--color-text-primary);width:24px}
`;

  function buildColorPicker() {
    if (colorPickerHostEl) return;
    colorPickerHostEl = document.createElement('div');
    colorPickerHostEl.id = 'liko-cp-host';
    colorPickerHostEl.style.cssText = 'position:fixed;z-index:1000000;pointer-events:none;inset:0;';
    document.body.appendChild(colorPickerHostEl);
    colorPickerShadow = colorPickerHostEl.attachShadow({ mode: 'open' });

    colorPickerShadow.innerHTML = `<style>${CP_CSS}</style>
<div id="cp-outer">
  <div id="cp-backdrop"></div>
  <div id="cp-wrap">
    <div id="cp">
      <div id="cp-title-row">— ${t('colorPickerTitle').toUpperCase()} —</div>
      <div class="row" style="gap:8px;align-items:flex-start">
        <div class="side-btns" style="justify-content:flex-start;padding-top:4px">
          <button class="icon-btn" id="cp-copy-btn" title="Copy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="icon-btn" id="cp-paste-btn" title="Paste">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </button>
          <button class="icon-btn" id="cp-eye-btn" title="Eyedropper">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:center">
          <div class="swatch-main"><div class="swatch-main-c" id="cp-sw-main"></div></div>
          <div class="hex-code" id="cp-hex-display">#000000</div>
          <div class="row" style="gap:4px">
            <input type="text" class="hex-in" id="cp-hex-in" maxlength="7" placeholder="#RRGGBB">
            <input type="text" class="alp-in" id="cp-alp-in" maxlength="4" placeholder="100%">
          </div>
          <div class="row" style="gap:3px">
            <span class="lbl" style="width:auto;font-size:10px">R</span><span id="cp-rv" class="rgb-val">000</span>
            <span class="lbl" style="width:auto;font-size:10px">G</span><span id="cp-gv" class="rgb-val">000</span>
            <span class="lbl" style="width:auto;font-size:10px">B</span><span id="cp-bv" class="rgb-val">000</span>
          </div>
        </div>
        <canvas id="cp-sv-canvas" width="260" height="140" style="border-radius:7px;border:1px solid var(--color-border-tertiary);cursor:crosshair;flex-shrink:0;margin-left:2px"></canvas>
      </div>
      <div class="row"><span class="lbl">H</span>
        <div class="tw" id="cp-h-tr" style="background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"><div class="tt" id="cp-h-tt"></div></div>
        <input class="val-input" id="cp-h-v" type="text" value="220" maxlength="3">
      </div>
      <div class="row"><span class="lbl">S</span>
        <div class="tw" id="cp-s-tr"><div class="tt" id="cp-s-tt"></div></div>
        <input class="val-input" id="cp-s-v" type="text" value="70" maxlength="3">
      </div>
      <div class="row"><span class="lbl">V</span>
        <div class="tw" id="cp-v-tr"><div class="tt" id="cp-v-v2"></div></div>
        <input class="val-input" id="cp-v-v" type="text" value="90" maxlength="3">
      </div>
      <div class="row"><span class="lbl">A</span>
        <div class="tw" id="cp-a-tr" style="background:repeating-conic-gradient(#444 0% 25%,#222 0% 50%) 0 0/8px 8px">
          <div id="cp-a-ov" style="position:absolute;inset:0;border-radius:7px"></div>
          <div class="tt" id="cp-a-tt" style="border-color:#ccc"></div>
        </div>
        <input class="val-input" id="cp-a-v" type="text" value="100%" maxlength="4" style="width:42px">
      </div>
      <hr>
      <div class="row">
        <span class="sec">${t('harmSec')}</span>
        <div style="display:flex;gap:4px;flex:1;margin-left:6px;overflow-x:auto">
          <button class="btn-sm active" data-r="complementary">${t('harmCompl')}</button>
          <button class="btn-sm" data-r="triadic">${t('harmTriadic')}</button>
          <button class="btn-sm" data-r="analogous">${t('harmAnalog')}</button>
          <button class="btn-sm" data-r="split">${t('harmSplit')}</button>
          <button class="btn-sm" data-r="tetradic">${t('harmTetr')}</button>
        </div>
      </div>
      <div class="row" style="height:32px"><div style="display:flex;gap:5px;flex:1" id="cp-harm-row"></div></div>
      <div class="row">
        <span class="sec" style="width:46px">${t('shadesSec')}</span>
        <div style="display:flex;gap:4px;flex:1" id="cp-shade-row"></div>
      </div>
      <hr>
      <div class="row">
        <span class="sec">${t('savedSec')}</span>
        <span style="flex:1"></span>
        <button class="btn-sm" id="cp-save-btn">${t('colorSave')}</button>
        <button class="btn-sm" id="cp-clr-btn">${t('colorClear')}</button>
      </div>
      <div class="saved-grid" id="cp-sg1"></div>
      <div class="saved-grid" id="cp-sg2"></div>
      <div id="cp-footer-row">
        <button class="cp-footer-btn" id="cp-confirm">${t('colorPickerConfirm')}</button>
        <button class="cp-footer-btn" id="cp-cancel">${t('colorPickerCancel')}</button>
      </div>
    </div>
  </div>
</div>`;

    initColorPickerLogic();
  }

  function initColorPickerLogic() {
    const sd = colorPickerShadow;
    let cpH=220, cpS=70, cpV=90, cpA=255;
    let cpRule='complementary', cpSelSaved=0;
    const cpSaved = Array(18).fill(0).map((_,i)=>({h:(i*20)%360,s:45,v:80,a:255}));
    const cl=(x,a,b)=>Math.max(a,Math.min(b,x));

    function h2r(h,s,v){
      s/=100;v/=100;
      const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
      let r=0,g=0,b=0;
      if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}
      return[Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
    }
    function r2x(r,g,b){return'#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join('')}
    function h2x(h,s,v){return r2x(...h2r(h,s,v))}
    function x2h(hex){
      const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
      const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
      let h=0;
      if(d){if(max===r)h=((g-b)/d+6)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}
      return{h:Math.round(h),s:Math.round(max?d/max*100:0),v:Math.round(max*100)};
    }
    function hsvaStr(h,s,v,a){const[r,g,b]=h2r(h,s,v);return`rgba(${r},${g},${b},${(a/255).toFixed(3)})`}
    function setTT(id,pct){sd.getElementById(id).style.left=cl(pct,0,100)+'%'}

    function drawSV(){
      const cvs=sd.getElementById('cp-sv-canvas'),ctx=cvs.getContext('2d');
      const W=cvs.width,H2=cvs.height;
      const base=h2x(cpH,100,100);
      const gH=ctx.createLinearGradient(0,0,W,0);
      gH.addColorStop(0,'#fff');gH.addColorStop(1,base);
      ctx.fillStyle=gH;ctx.fillRect(0,0,W,H2);
      const gV=ctx.createLinearGradient(0,0,0,H2);
      gV.addColorStop(0,'rgba(0,0,0,0)');gV.addColorStop(1,'#000');
      ctx.fillStyle=gV;ctx.fillRect(0,0,W,H2);
      const px=cpS/100*W,py=(1-cpV/100)*H2;
      ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);
      ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();
    }
    function updTracks(){
      const hex=h2x(cpH,cpS,cpV);
      sd.getElementById('cp-s-tr').style.background=`linear-gradient(to right,${h2x(cpH,0,cpV)},${h2x(cpH,100,cpV)})`;
      sd.getElementById('cp-v-tr').style.background=`linear-gradient(to right,${h2x(cpH,cpS,0)},${h2x(cpH,cpS,100)})`;
      sd.getElementById('cp-a-ov').style.background=`linear-gradient(to right,transparent,${hex})`;
      sd.getElementById('cp-h-tt').style.background=h2x(cpH,100,100);
      sd.getElementById('cp-s-tt').style.background=hex;
      sd.getElementById('cp-v-v2').style.background=hex;
      sd.getElementById('cp-a-tt').style.background=`rgba(${h2r(cpH,cpS,cpV).join(',')},${cpA/255})`;
    }
    function harm(){
      const m={
        complementary:[[cpH,cpS,cpV],[(cpH+180)%360,cpS,cpV]],
        triadic:[[cpH,cpS,cpV],[(cpH+120)%360,cpS,cpV],[(cpH+240)%360,cpS,cpV]],
        analogous:[[cpH,cpS,cpV],[(cpH+30)%360,cpS,cpV],[(cpH+330)%360,cpS,cpV],[(cpH+60)%360,cpS,cpV]],
        split:[[cpH,cpS,cpV],[(cpH+150)%360,cpS,cpV],[(cpH+210)%360,cpS,cpV]],
        tetradic:[[cpH,cpS,cpV],[(cpH+90)%360,cpS,cpV],[(cpH+180)%360,cpS,cpV],[(cpH+270)%360,cpS,cpV]],
      };
      return m[cpRule]||m.complementary;
    }
    function shades(){
      return[
        [cpH,cl(cpS-35,0,100),cl(cpV+15,0,100)],
        [cpH,cl(cpS-15,0,100),cl(cpV+7,0,100)],
        [cpH,cpS,cpV],
        [cpH,cl(cpS+12,0,100),cl(cpV-20,0,100)],
        [cpH,cl(cpS+22,0,100),cl(cpV-38,0,100)],
      ];
    }
    function rHarm(){
      const row=sd.getElementById('cp-harm-row');row.innerHTML='';
      harm().forEach(([h,s,v])=>{
        const hex=h2x(h,s,v);
        const d=document.createElement('div');d.className='sw';d.style.background=hex;
        const tt=document.createElement('div');tt.className='sw-hex';tt.textContent=hex;
        d.appendChild(tt);d.onclick=()=>setC(h,s,v,cpA);row.appendChild(d);
      });
    }
    function rShade(){
      const row=sd.getElementById('cp-shade-row');row.innerHTML='';
      shades().forEach(([h,s,v])=>{
        const hex=h2x(h,s,v);
        const d=document.createElement('div');d.className='sh';d.style.background=hex;
        d.title=hex;d.onclick=()=>setC(h,s,v,cpA);row.appendChild(d);
      });
    }
    function rSaved(){
      [sd.getElementById('cp-sg1'),sd.getElementById('cp-sg2')].forEach((grid,gi)=>{
        grid.innerHTML='';
        for(let i=0;i<9;i++){
          const idx=gi*9+i;const c=cpSaved[idx];
          const cell=document.createElement('div');cell.className='sc'+(idx===cpSelSaved?' sel':'');
          const inner=document.createElement('div');inner.className='sc-c';
          inner.style.background=hsvaStr(c.h,c.s,c.v,c.a);
          cell.appendChild(inner);
          cell.onclick=()=>{cpSelSaved=idx;setC(c.h,c.s,c.v,c.a);rSaved()};
          grid.appendChild(cell);
        }
      });
    }
    function updAll(){
      const[r,g,b]=h2r(cpH,cpS,cpV);
      const hex=r2x(r,g,b);
      const aPct=Math.round(cpA/255*100);
      sd.getElementById('cp-sw-main').style.background=hsvaStr(cpH,cpS,cpV,cpA);
      sd.getElementById('cp-hex-display').textContent=hex;
      sd.getElementById('cp-hex-in').value=hex;
      sd.getElementById('cp-alp-in').value=aPct+'%';
      sd.getElementById('cp-rv').textContent=String(r).padStart(3,'0');
      sd.getElementById('cp-gv').textContent=String(g).padStart(3,'0');
      sd.getElementById('cp-bv').textContent=String(b).padStart(3,'0');
      sd.getElementById('cp-h-v').value=cpH;
      sd.getElementById('cp-s-v').value=cpS;
      sd.getElementById('cp-v-v').value=cpV;
      sd.getElementById('cp-a-v').value=aPct+'%';
      setTT('cp-h-tt',cpH/360*100);setTT('cp-s-tt',cpS);setTT('cp-v-v2',cpV);setTT('cp-a-tt',cpA/255*100);
      updTracks();drawSV();rHarm();rShade();
      const lc = colorPickerHostEl?._cpOnLiveChange;
      if (lc) lc(hex);
    }
    function setC(h,s,v,a){cpH=h;cpS=s;cpV=v;cpA=(a===undefined?cpA:a);updAll();}

    function trk(id,cb){
      const el=sd.getElementById(id);let drag=false;
      function pick(e){
        const r=el.getBoundingClientRect();
        const cx=e.touches?e.touches[0].clientX:e.clientX;
        cb(cl((cx-r.left)/r.width,0,1));
      }
      el.addEventListener('mousedown',e=>{drag=true;pick(e);e.stopPropagation();});
      document.addEventListener('mousemove',e=>{if(drag)pick(e)});
      document.addEventListener('mouseup',()=>drag=false);
    }
    trk('cp-h-tr',p=>{cpH=Math.round(p*360);updAll()});
    trk('cp-s-tr',p=>{cpS=Math.round(p*100);updAll()});
    trk('cp-v-tr',p=>{cpV=Math.round(p*100);updAll()});
    trk('cp-a-tr',p=>{cpA=Math.round(p*255);updAll()});

    const svCvs=sd.getElementById('cp-sv-canvas');let svDrag=false;
    function svPick(e){
      const r=svCvs.getBoundingClientRect();
      const cx=e.touches?e.touches[0].clientX:e.clientX;
      const cy=e.touches?e.touches[0].clientY:e.clientY;
      cpS=Math.round(cl((cx-r.left)/r.width,0,1)*100);
      cpV=Math.round((1-cl((cy-r.top)/r.height,0,1))*100);
      updAll();
    }
    svCvs.addEventListener('mousedown',e=>{svDrag=true;svPick(e);e.stopPropagation();});
    document.addEventListener('mousemove',e=>{if(svDrag)svPick(e)});
    document.addEventListener('mouseup',()=>svDrag=false);

    sd.getElementById('cp-hex-in').addEventListener('change',e=>{
      const v=e.target.value.trim();
      if(/^#[0-9a-fA-F]{6}$/.test(v)){const{h,s,v:vv}=x2h(v);setC(h,s,vv,cpA)}
    });
    sd.getElementById('cp-alp-in').addEventListener('change',e=>{
      const n=parseInt(e.target.value);
      if(!isNaN(n)){cpA=Math.round(cl(n,0,100)/100*255);updAll()}
    });
    function bindVI(id,min,max,setter){
      const el=sd.getElementById(id);
      el.addEventListener('change',e=>{
        let raw=e.target.value.replace('%','').trim();
        const n=parseInt(raw);
        if(!isNaN(n)){setter(cl(n,min,max));updAll()}
      });
      el.addEventListener('mousedown',e=>e.stopPropagation());
      el.addEventListener('click',e=>e.stopPropagation());
    }
    bindVI('cp-h-v',0,360,v=>cpH=v);
    bindVI('cp-s-v',0,100,v=>cpS=v);
    bindVI('cp-v-v',0,100,v=>cpV=v);
    bindVI('cp-a-v',0,100,v=>cpA=Math.round(v/100*255));

    sd.getElementById('cp-copy-btn').addEventListener('click',()=>{
      const[r,g,b]=h2r(cpH,cpS,cpV);
      navigator.clipboard?.writeText(r2x(r,g,b)+(cpA<255?cpA.toString(16).padStart(2,'0'):''));
    });
    sd.getElementById('cp-paste-btn').addEventListener('click',()=>{
      navigator.clipboard?.readText().then(txt=>{
        txt=txt.trim();
        if(/^#[0-9a-fA-F]{6,8}$/.test(txt)){
          const{h,s,v}=x2h(txt.slice(0,7));
          setC(h,s,v,txt.length===9?parseInt(txt.slice(7),16):255);
        }
      });
    });
    sd.getElementById('cp-eye-btn').addEventListener('click',async()=>{
      if(!window.EyeDropper){return;}
      try{const ed=new EyeDropper();const r=await ed.open();const{h,s,v}=x2h(r.sRGBHex);setC(h,s,v,cpA);}catch(e){}
    });
    sd.getElementById('cp-save-btn').addEventListener('click',()=>{cpSaved[cpSelSaved]={h:cpH,s:cpS,v:cpV,a:cpA};rSaved()});
    sd.getElementById('cp-clr-btn').addEventListener('click',()=>{cpSaved[cpSelSaved]={h:0,s:0,v:100,a:255};rSaved()});
    sd.querySelectorAll('[data-r]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        sd.querySelectorAll('[data-r]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');cpRule=btn.dataset.r;updAll();
      });
    });

    sd.getElementById('cp-confirm').addEventListener('click',()=>{
      const[r,g,b]=h2r(cpH,cpS,cpV);
      const hex=r2x(r,g,b);
      const lc = colorPickerHostEl?._cpOnLiveChange;
      closeColorPicker();
      if (lc) lc(hex);
    });
    function doCancel() {
      const initHex = colorPickerHostEl?._cpInitialHex;
      const lc = colorPickerHostEl?._cpOnLiveChange;
      closeColorPicker();
      if (lc && initHex) lc(initHex);
    }
    sd.getElementById('cp-cancel').addEventListener('click', doCancel);
    sd.getElementById('cp-backdrop').addEventListener('click', doCancel);

    colorPickerHostEl._cpSetColor = (hex) => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        const{h,s,v}=x2h(hex);setC(h,s,v,255);
      } else { setC(220,70,90,255); }
      rSaved();
    };

    rSaved(); updAll();
  }

  function positionColorPicker() {
    if (!colorPickerShadow) return;
    const outer = colorPickerShadow.getElementById('cp-outer');
    const wrap  = colorPickerShadow.getElementById('cp-wrap');
    if (!outer || !wrap) return;
    const r = getCanvasRect();
    if (!r) {
      wrap.style.transform = '';
      outer.style.left = Math.max(8, (window.innerWidth - 510) / 2) + 'px';
      outer.style.top  = '130px';
      return;
    }
    const scale = r.width / 1500;
    wrap.style.transform = `scale(${scale})`;
    wrap.style.transformOrigin = 'top left';
    const pickerScreenW = 500 * scale;
    const left = Math.max(8, Math.min(r.right - pickerScreenW - 10, window.innerWidth - pickerScreenW - 8));
    const top  = Math.max(r.top + 60, r.top + 130);
    outer.style.left = left + 'px';
    outer.style.top  = top  + 'px';
  }

  function openColorPicker(initialHex, onLiveChange) {
    buildColorPicker();
    if (colorPickerHostEl) {
      colorPickerHostEl._cpInitialHex = initialHex || '#FFFFFF';
      colorPickerHostEl._cpOnLiveChange = null;
    }
    colorPickerHostEl._cpSetColor?.(initialHex || '#FFFFFF');
    if (colorPickerHostEl) {
      colorPickerHostEl._cpOnLiveChange = onLiveChange;
    }
    positionColorPicker();
    colorPickerShadow.getElementById('cp-outer').classList.add('open');
    colorPickerHostEl.style.pointerEvents = 'auto';
    updateToggleIcons();
  }

  function closeColorPicker() {
    colorPickerShadow?.getElementById('cp-outer')?.classList.remove('open');
    if (colorPickerHostEl) {
      colorPickerHostEl.style.pointerEvents = 'none';
      colorPickerHostEl._cpOnLiveChange = null;
      colorPickerHostEl._cpInitialHex   = null;
    }
    updateToggleIcons();
  }

  // ============================================================
  // SHADOW DOM HOST + CSS
  // ============================================================

  let hostEl = null;
  let shadowRoot = null;

  const CSS = `
:host {
  --bg:#0d0d0f; --bg2:#161619; --bg3:#1e1e23; --border:#2a2a35;
  --accent:#7c6af7; --accent2:#4ecdc4;
  --text:#ffffff; --text-dim:#a0a0b0; --text-sec:#ccccdd;
  font-family:'Segoe UI',system-ui,sans-serif; font-size:14px;
  all:initial; display:block;
}
*,*::before,*::after { box-sizing:border-box; }
#panel {
  position:absolute; left:0; top:0;
  width:14vw; min-width:270px; max-width:350px; height:100%;
  background:var(--bg); border-right:1px solid var(--border);
  color:var(--text); display:flex; flex-direction:column;
  z-index:999999; overflow:hidden; user-select:none;
}
#panel.collapsed { display:none; }
#toggle {
  position:absolute; top:50%; transform:translateY(-50%);
  width:25px;
  background:var(--bg); border:1px solid var(--border); border-left:none;
  border-radius:0 6px 6px 0;
  display:flex; flex-direction:column; align-items:center;
  padding:5px 0; gap:4px;
  z-index:1000000;
}
#toggle-icons {
  display:none; flex-direction:column; align-items:center; gap:5px;
  margin-bottom:2px;
}
#toggle.show-icons #toggle-icons { display:flex; }
.tgl-icon {
  width:28px; height:28px; border-radius:4px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text-dim);
  transition:color .12s, background .12s;
}
.tgl-icon:hover { color:var(--accent1); background:rgba(124,106,247,0.15); }
.tgl-icon.active { color:#a89ef8; background:rgba(124,106,247,0.30); box-shadow:inset -2px 0 0 #7c6af7; }
#toggle-arrow {
  width:22px; height:22px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text-dim); font-size:11px;
  transition:color .12s; user-select:none; -webkit-user-select:none;
}
#toggle-arrow:hover { color:var(--accent); }
#tabs {
  display:flex; border-bottom:1px solid var(--border); flex-shrink:0;
}
.tab {
  flex:1; height:34px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text-dim); font-size:12px; font-weight:600;
  letter-spacing:.03em; border-bottom:2px solid transparent;
  transition:color .15s, border-color .15s;
}
.tab:hover { color:var(--text); }
.tab.active { color:var(--accent); border-bottom-color:var(--accent); }
#item-name {
  padding:5px 10px; font-size:13px; font-weight:700; color:var(--text);
  display:flex; align-items:center; gap:8px;
  background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0;
  min-width:0;
}
#item-name-text {
  flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.iname-btn {
  flex-shrink:0; width:34px; height:34px;
  background:transparent; border:1px solid var(--border); border-radius:50%;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:var(--text-dim); transition:border-color .12s, color .12s, background .12s;
}
.iname-btn:hover { border-color:var(--accent); color:var(--accent); }
#parts-toggle-btn.active { border-color:var(--accent); color:var(--accent); background:rgba(124,106,247,0.12); }
#parts-float {
  position:absolute; width:200px; min-height:80px; max-height:260px;
  background:var(--bg); border:1px solid var(--border); border-radius:8px;
  box-shadow:0 4px 20px rgba(0,0,0,0.7);
  display:none; flex-direction:column;
  z-index:1000001; pointer-events:auto; overflow:hidden;
  top:60px; left:10px;
}
#parts-float.open { display:flex; }
#parts-float-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:5px 8px; background:var(--bg2); border-bottom:1px solid var(--border);
  cursor:grab; flex-shrink:0;
  font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
  color:var(--text-dim); user-select:none; -webkit-user-select:none;
}
#parts-float-header:active { cursor:grabbing; }
#parts-float-close {
  width:16px; height:16px; border-radius:3px; border:none; background:transparent;
  cursor:pointer; color:var(--text-dim); font-size:13px; line-height:1;
  display:flex; align-items:center; justify-content:center;
  transition:color .1s, background .1s;
}
#parts-float-close:hover { color:#f87; background:rgba(255,80,80,0.1); }
#parts-float-body {
  overflow-y:auto; flex:1; padding:5px 6px; user-select:none; -webkit-user-select:none;
}
#parts-float-body::-webkit-scrollbar { width:4px; }
#parts-float-body::-webkit-scrollbar-thumb { background:rgba(124,106,247,0.5); border-radius:2px; }
#parts-float-body::-webkit-scrollbar-thumb:hover { background:var(--accent); }
#content { flex:1; overflow-y:auto; }
#content::-webkit-scrollbar { width:4px; }
#content::-webkit-scrollbar-thumb { background:rgba(124,106,247,0.5); border-radius:2px; }
#content::-webkit-scrollbar-thumb:hover { background:var(--accent); }
#content::-webkit-scrollbar-track { background:transparent; }
.section { padding:8px 10px; border-bottom:1px solid var(--border); }
.sec-title {
  font-size:13px; font-weight:700; letter-spacing:.07em; text-transform:uppercase;
  color:var(--text); text-align:center; margin-bottom:6px;
}
.edit-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:8px; margin-bottom:8px;
}
.edit-header-left { flex:1; min-width:0; }
.color-edit-btn {
  width:36px; height:54px;
  border:1.5px solid var(--border); border-radius:5px;
  cursor:pointer; overflow:hidden; flex-shrink:0;
  position:relative;
  background:repeating-conic-gradient(#1a1a1a 0% 25%,#111 0% 50%) 0 0/6px 6px;
  transition:border-color .12s;
}
.color-edit-btn:hover { border-color:var(--accent2); }
.color-edit-inner { position:absolute; inset:0; }
.color-edit-label {
  position:absolute; bottom:0; left:0; right:0;
  font-size:8px; color:rgba(255,255,255,0.75); text-align:center;
  background:rgba(0,0,0,0.5); padding:2px 0; line-height:1.2;
  text-transform:uppercase; letter-spacing:.04em;
}
.layer-btn-row {
  display:flex; align-items:center; gap:6px; margin-bottom:4px;
}
.layer-btn {
  flex:1; padding:6px 10px;
  background:var(--bg2); border:1px solid var(--border); border-radius:4px;
  cursor:pointer; color:var(--text);
  text-align:left; font-size:14px; font-weight:600;
  transition:border-color .12s, background .12s, color .12s;
  min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  display:flex; align-items:center; justify-content:space-between; gap:6px;
}
.layer-btn:hover { border-color:var(--accent); }
.layer-btn.selected { background:#17143a; border-color:var(--accent); color:var(--accent); }
.layer-btn-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.layer-color-dot {
  width:14px; height:14px; border-radius:3px; flex-shrink:0;
  border:1px solid rgba(255,255,255,0.15);
  background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/6px 6px;
  position:relative; overflow:hidden;
}
.layer-color-dot-fill { position:absolute; inset:0; }
.prop-group { margin-bottom:10px; }
.prop-group-header {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:4px;
}
.prop-group-title {
  font-size:13px; font-weight:700; color:var(--text); letter-spacing:.03em;
}
.drag-check-label {
  display:flex; align-items:center; gap:5px;
  font-size:12px; color:var(--text-dim); cursor:pointer;
  padding:2px 6px; border:1px solid var(--border); border-radius:3px;
  transition:border-color .12s, color .12s, background .12s;
}
.drag-check-label:hover { border-color:var(--accent2); color:var(--accent2); }
.drag-check-label.active { border-color:var(--accent2); color:var(--accent2); background:rgba(78,205,196,0.08); }
.drag-check-label input { display:none; }
.prop-row { margin-bottom:5px; }
.prop-row-label {
  display:flex; align-items:center; justify-content:space-between;
  font-size:12px; color:var(--text-sec); margin-bottom:3px;
}
.prop-val-input {
  color:var(--accent2); font-variant-numeric:tabular-nums; font-size:12px;
  background:transparent; border:none; border-bottom:1px solid transparent;
  outline:none; width:56px; text-align:right; cursor:text;
  transition:border-color .12s;
}
.prop-val-input:focus { border-bottom-color:var(--accent2); background:rgba(78,205,196,0.07); border-radius:2px; }
.stepper { display:flex; gap:2px; }
.step {
  flex:1; height:24px; background:var(--bg3); border:1px solid var(--border);
  border-radius:3px; color:var(--text); font-size:11px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background .1s, border-color .1s;
}
.step:hover { background:var(--accent); border-color:var(--accent); color:#fff; }
.step:active { opacity:.8; }
.step-reset {
  width:26px; flex:none; height:24px; background:var(--bg3); border:1px solid var(--border);
  border-radius:3px; color:var(--text-dim); font-size:13px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background .1s, border-color .1s, color .1s;
}
.step-reset:hover { background:#3a1a1a; border-color:#f87; color:#f87; }
.step-reset:active { opacity:.8; }
.op-group { margin-bottom:10px; }
.op-row-label {
  display:flex; justify-content:space-between; align-items:center;
  font-size:12px; color:var(--text); margin-bottom:3px;
}
.op-row-label span { color:var(--accent2); font-variant-numeric:tabular-nums; }
.range {
  width:100%; height:3px; appearance:none; background:var(--bg3);
  border-radius:2px; outline:none; cursor:pointer;
}
.range::-webkit-slider-thumb {
  appearance:none; width:13px; height:13px; border-radius:50%;
  background:var(--accent); cursor:pointer; border:2px solid var(--bg);
}
.scale-lock-btn {
  flex-shrink:0; width:24px; height:24px;
  background:transparent; border:1px solid var(--border); border-radius:3px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:var(--text-dim); transition:border-color .12s, color .12s, background .12s;
  transform:rotate(90deg);
  user-select:none; -webkit-user-select:none;
}
.scale-lock-btn:hover { border-color:var(--accent2); color:var(--accent2); }
.scale-lock-btn.locked { border-color:var(--accent2); color:var(--accent2); background:rgba(78,205,196,0.12); }
.mirror-grid { display:flex; gap:8px; margin-top:4px; }
.mirror-group { flex:1; }
.mirror-group-title {
  font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;
  color:var(--text-dim); text-align:center; margin-bottom:4px;
}
.mirror-pair { display:flex; gap:4px; }
.mirror-btn {
  flex:1; height:28px;
  background:var(--bg2); border:1.5px solid var(--border);
  border-radius:4px; color:var(--text-sec); font-size:11px; font-weight:600;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:border-color .12s, color .12s, background .12s;
}
.mirror-btn:hover { border-color:var(--accent); }
.mirror-btn.active { background:#17143a; border-color:var(--accent); color:var(--accent); }
.op-tab-row { padding:6px 10px; border-bottom:1px solid var(--border); }
.op-tab-name {
  display:flex; align-items:center; justify-content:space-between;
  font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;
}
.op-tab-val { color:var(--accent2); font-variant-numeric:tabular-nums; }
.op-step-row { display:flex; align-items:center; gap:3px; flex-shrink:0; }
.op-step {
  width:26px; height:20px; background:var(--bg3); border:1px solid var(--border);
  border-radius:3px; color:var(--text); font-size:11px; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background .1s, border-color .1s; user-select:none; flex-shrink:0;
}
.op-step:hover { background:var(--accent); border-color:var(--accent); color:#fff; }
.op-step:active { opacity:.8; }
.op-val-display { color:var(--accent2); font-variant-numeric:tabular-nums; font-size:12px; min-width:32px; text-align:center; flex-shrink:0; }
.sec-title-row {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:6px;
}
.color-chip {
  width:40px; height:22px;
  border:1px solid var(--border); border-radius:3px;
  cursor:pointer; flex-shrink:0; position:relative; overflow:hidden;
  background:repeating-conic-gradient(#1a1a1a 0% 25%,#111 0% 50%) 0 0/5px 5px;
  transition:border-color .12s;
}
.color-chip:hover { border-color:var(--accent2); }
.color-chip-inner { position:absolute; inset:0; }
.layer-pri-row {
  display:flex; align-items:center; gap:6px;
  padding:6px 10px; border-bottom:1px solid var(--border);
}
.layer-pri-name {
  flex:1; font-size:13px; color:var(--text);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pri-input {
  width:44px; text-align:center;
  background:var(--bg3); border:1px solid var(--border); border-radius:3px;
  color:var(--accent2); font-size:12px; padding:3px 4px;
  outline:none; user-select:text; -webkit-user-select:text;
}
.pri-input:focus { border-color:var(--accent2); }
.settings-empty {
  padding:28px 14px; text-align:center;
  color:var(--text-dim); font-size:14px; line-height:1.7;
  white-space:pre-line;
}
`;

  // ============================================================
  // BUILD PANEL
  // ============================================================

  function buildPanel() {
    if (hostEl) { alignHost(); return; }

    hostEl = document.createElement('div');
    hostEl.id = 'liko-ae-host';
    hostEl.style.cssText = 'position:fixed;z-index:999998;pointer-events:none;';
    document.body.appendChild(hostEl);
    shadowRoot = hostEl.attachShadow({ mode:'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    shadowRoot.appendChild(styleEl);

    const toggleEl = document.createElement('div');
    toggleEl.id = 'toggle';
    toggleEl.style.pointerEvents = 'auto';
    toggleEl.innerHTML = `
      <div id="toggle-icons">
        <div class="tgl-icon" id="tgl-open" data-tgl-action="open-panel" title="${isZh()?'部件':'Layers'}">
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-xy" data-drag-toggle="xy" title="${isZh()?'座標':'Position'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M8 2v12M2 8h12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-rot" data-drag-toggle="rot" title="${isZh()?'旋轉':'Rotate'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5.25 12.76A5.5 5.5 0 1 1 10.75 3.24"/>
            <path d="M10.75 3.24A5.5 5.5 0 0 1 5.25 12.76" stroke-dasharray="2 1.8"/>
            <polyline points="13,3.5 10.75,3.24 12,5.2"/>
            <rect x="6.3" y="6.3" width="3.4" height="3.4" transform="rotate(45 8 8)" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-scale" data-drag-toggle="scale" title="${isZh()?'縮放':'Scale'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-skew" data-drag-toggle="skew" title="${isZh()?'傾斜':'Skew'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 13h6M5 3h6"/>
            <line x1="3" y1="13" x2="5" y2="3"/>
            <line x1="9" y1="13" x2="11" y2="3"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-colorpicker" data-tgl-action="open-colorpicker" title="${isZh()?'調色':'Color Picker'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- bucket body: rotated square, centered at 6.5,6.5 -->
            <g transform="rotate(45 6.5 6.5)">
              <rect x="2.5" y="2.5" width="8" height="8" rx="0.8" fill="currentColor"/>
              <path d="M2.9 6.5 L2.9 3.3 Q2.9 2.9 3.3 2.9 L9.2 2.9 Q9.6 2.9 9.6 3.3 Z" fill="var(--bg,#1a1a2e)"/>
            </g>
            <!-- water drop -->
            <ellipse cx="13.2" cy="13.2" rx="1.3" ry="1.6" fill="currentColor"/>
            <!-- stream from bucket lower-right corner to drop -->
            <line x1="10.2" y1="10.2" x2="12.2" y2="12.0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-opacity" data-tgl-action="open-opacity" title="${isZh()?'透明度':'Opacity'}">
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect width="16" height="16" rx="2" fill="rgba(255,255,255,0.2)"/>
            <rect x="0" y="0" width="8" height="8" fill="currentColor" opacity="0.7"/>
            <rect x="8" y="8" width="8" height="8" fill="currentColor" opacity="0.7"/>
            <rect width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/>
          </svg>
        </div>
        <div class="tgl-icon" id="tgl-reset" data-tgl-action="reset-transform" title="${isZh()?'重置座標/旋轉/縮放':'Reset transforms'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 8A5 5 0 1 0 4 4.5"/>
            <path d="M1 2v3h3"/>
            <line x1="8" y1="5" x2="8" y2="8"/><line x1="8" y1="8" x2="10" y2="10"/>
          </svg>
        </div>
      </div>
      <div id="toggle-arrow">◀</div>
    `;
    toggleEl.querySelector('#toggle-arrow').addEventListener('click', toggleCollapse);
    toggleEl.querySelector('#toggle-icons').addEventListener('click', e => {
      const dragIcon = e.target.closest('[data-drag-toggle]');
      if (dragIcon) {
        const mode = dragIcon.dataset.dragToggle;
        state.activeDrag = (state.activeDrag === mode) ? null : mode;
        if (state.activeDrag === 'rot') showRotOverlay(); else hideRotOverlay();
        updateToggleIcons();
        return;
      }
      const actionIcon = e.target.closest('[data-tgl-action]');
      if (!actionIcon) return;
      const action = actionIcon.dataset.tglAction;
      if (action === 'open-opacity') {
        const isOn = opShadow?.getElementById('op-overlay')?.classList.contains('on');
        if (isOn) { hideOpOverlay(); } else { showOpOverlay(); }
        updateToggleIcons();
        return;
      }
      if (action === 'open-colorpicker') {
        const item = getCurrentItem();
        const idx  = state.selectedLayer ?? 'all';
        const cur  = getLayerColor(item, idx) || '#FFFFFF';
        openColorPicker(cur, (hex) => {
          if (!item) return;
          setLayerColor(item, idx, hex);
          updateColorUI(idx, hex);
        });
        return;
      }
      if (action === 'open-panel') {
        const pf  = shadowRoot?.getElementById('parts-float');
        const btn = shadowRoot?.getElementById('parts-toggle-btn');
        if (!pf) return;
        if (pf.classList.contains('open')) {
          pf.classList.remove('open');
          btn?.classList.remove('active');
        } else {
          pf.classList.add('open');
          btn?.classList.add('active');
          updatePartsPanel();
        }
        updateToggleIcons();
      } else if (action === 'reset-transform') {
        const item = getCurrentItem();
        if (!item || state.selectedLayer === null) return;
        const idx = state.selectedLayer;
        const _li = idx === 'all' ? null : parseInt(idx);
        if (item.Property?.LayerOverrides) {
          if (_li === null) item.Property.LayerOverrides.forEach(l => l && (delete l.DrawingLeft, delete l.DrawingTop));
          else if (item.Property.LayerOverrides[_li]) { delete item.Property.LayerOverrides[_li].DrawingLeft; delete item.Property.LayerOverrides[_li].DrawingTop; }
        }
        { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
        setLO(item, idx, 'DrawingTop',  {"": 0});
        setLO(item, idx, 'ScaleX', 1);
        setLO(item, idx, 'ScaleY', 1);
        setLO(item, idx, 'Rotation', 0);
        setLO(item, idx, 'SkewX', 0);
        setLO(item, idx, 'SkewY', 0);
        if (state.activeDrag === 'rot') updateRotOverlay(0);
      }
    });
    shadowRoot.appendChild(toggleEl);

    const partsFloat = document.createElement('div');
    partsFloat.id = 'parts-float';
    partsFloat.style.pointerEvents = 'auto';
    partsFloat.innerHTML = `
      <div id="parts-float-header">
        <span>${isZh()?'部件':'Layers'}</span>
        <button id="parts-float-close">✕</button>
      </div>
      <div id="parts-float-body"></div>
    `;
    shadowRoot.appendChild(partsFloat);

    let _pfDrag = null;
    partsFloat.querySelector('#parts-float-header').addEventListener('mousedown', e => {
      if (e.target.closest('#parts-float-close')) return;
      const r = partsFloat.getBoundingClientRect();
      _pfDrag = { ox: e.clientX - r.left, oy: e.clientY - r.top };
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!_pfDrag) return;
      const hr = getCanvasRect(); if (!hr) return;
      partsFloat.style.left = Math.max(0, Math.min(e.clientX - hr.left - _pfDrag.ox, hr.width - 210)) + 'px';
      partsFloat.style.top  = Math.max(0, Math.min(e.clientY - hr.top  - _pfDrag.oy, hr.height - 100)) + 'px';
    });
    document.addEventListener('mouseup', () => { _pfDrag = null; });
    partsFloat.querySelector('#parts-float-close').addEventListener('click', () => {
      partsFloat.classList.remove('open');
      shadowRoot.getElementById('parts-toggle-btn')?.classList.remove('active');
      updateToggleIcons();
    });
    partsFloat.querySelector('#parts-float-body').addEventListener('click', e => {
      const btn = e.target.closest('[data-select-layer]');
      if (!btn) return;
      state.selectedLayer = btn.dataset.selectLayer;
      partsFloat.querySelectorAll('[data-select-layer]').forEach(b =>
        b.classList.toggle('selected', b.dataset.selectLayer === state.selectedLayer));
      renderContent();
      updateOpacityTab(); // sync op-panel to new layer's opacity
      partsFloat.classList.add('open');
      shadowRoot.getElementById('parts-toggle-btn')?.classList.add('active');
    });

    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.style.pointerEvents = 'auto';
    panel.innerHTML = `
      <div id="tabs">
        <div class="tab active" data-tab="edit">${t('tabEdit')}</div>
        <div class="tab" data-tab="opacity">${t('tabOpacity')}</div>
        <div class="tab" data-tab="layers">${t('tabLayers')}</div>
        <div class="tab" data-tab="settings">${t('tabSettings')}</div>
      </div>
      <div id="item-name">
        <span id="item-name-text">—</span>
        <button id="parts-toggle-btn" class="iname-btn" title="${isZh()?'部件':'Layers'}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/>
          </svg>
        </button>
      </div>
      <div id="content"></div>
    `;
    shadowRoot.appendChild(panel);

    panel.querySelector('#parts-toggle-btn').addEventListener('click', () => {
      const btn = panel.querySelector('#parts-toggle-btn');
      const pf  = shadowRoot.getElementById('parts-float');
      if (pf.classList.contains('open')) {
        pf.classList.remove('open'); btn.classList.remove('active');
      } else {
        pf.classList.add('open'); btn.classList.add('active');
        updatePartsPanel();
      }
    });

    panel.querySelector('#tabs').addEventListener('click', e => {
      const tab = e.target.closest('.tab'); if (!tab) return;
      state.tab = tab.dataset.tab;
      panel.querySelectorAll('.tab').forEach(tb => tb.classList.remove('active'));
      tab.classList.add('active');
      renderContent();
    });

    const content = panel.querySelector('#content');
    content.addEventListener('click', onContentClick);
    content.addEventListener('change', onContentChange);
    content.addEventListener('input', onContentInput);

    let _stepRepeatTimer = null;
    let _stepRepeatBtn   = null;
    let _stepRepeatType  = null;
    const _startStepRepeat = (btn, type) => {
      _stepRepeatBtn  = btn;
      _stepRepeatType = type;
      _stepRepeatTimer = setTimeout(() => {
        _stepRepeatTimer = setInterval(() => {
          if (!_stepRepeatBtn) return;
          if (_stepRepeatType === 'op')  handleOpStep(_stepRepeatBtn);
          else if (_stepRepeatType === 'pri') handlePriorityStep(_stepRepeatBtn);
          else handleStep(_stepRepeatBtn);
        }, 80);
      }, 400);
    };
    const _stopStepRepeat = () => {
      clearTimeout(_stepRepeatTimer);
      clearInterval(_stepRepeatTimer);
      _stepRepeatTimer = null;
      _stepRepeatBtn   = null;
      _stepRepeatType  = null;
    };
    content.addEventListener('mousedown', e => {
      const opBtn  = e.target.closest('[data-op-step]');
      if (opBtn)  { e.preventDefault(); _startStepRepeat(opBtn,  'op');  return; }
      const priBtn = e.target.closest('[data-pri-step]');
      if (priBtn) { e.preventDefault(); _startStepRepeat(priBtn, 'pri'); return; }
      const btn    = e.target.closest('[data-step]');
      if (btn)    { e.preventDefault(); _startStepRepeat(btn,    'prop'); }
    });
    content.addEventListener('mouseleave', _stopStepRepeat);
    document.addEventListener('mouseup', _stopStepRepeat);

    alignHost(); updateTogglePos();
    buildRotOverlay(); alignRotOverlay();
    buildColorPicker();
  }

  function updateTogglePos() {
    if (!shadowRoot) return;
    const panel = shadowRoot.getElementById('panel');
    const toggleEl = shadowRoot.getElementById('toggle');
    if (!panel || !toggleEl) return;
    if (state.collapsed) {
      toggleEl.style.left = '0px';
    } else {
      const w = panel.offsetWidth || parseInt(getComputedStyle(panel).width) || 270;
      toggleEl.style.left = w + 'px';
    }
  }

  function updateToggleIcons() {
    if (!shadowRoot) return;
    ['xy','rot','scale','skew'].forEach(mode => {
      const el = shadowRoot.getElementById('tgl-' + mode);
      if (el) el.classList.toggle('active', state.activeDrag === mode);
    });
    // action icons: active when their overlay/panel is open
    const cpEl = shadowRoot.getElementById('tgl-colorpicker');
    // 選色器：我們自己的 cp-outer 有 .open class 時才算開啟
    const cpOpen = colorPickerShadow?.getElementById('cp-outer')?.classList.contains('open') ?? false;
    if (cpEl) cpEl.classList.toggle('active', cpOpen);
    const opEl = shadowRoot.getElementById('tgl-opacity');
    if (opEl) opEl.classList.toggle('active', opShadow?.getElementById('op-overlay')?.classList.contains('on') ?? false);
    const partsEl = shadowRoot.getElementById('tgl-open');
    if (partsEl) partsEl.classList.toggle('active', shadowRoot.getElementById('parts-float')?.classList.contains('open') ?? false);
  }

  function toggleCollapse() {
    const panel    = shadowRoot?.getElementById('panel');
    const toggleEl = shadowRoot?.getElementById('toggle');
    const arrow    = shadowRoot?.getElementById('toggle-arrow');
    if (!panel || !toggleEl) return;
    if (!state.collapsed) {
      panel.classList.add('collapsed');
      toggleEl.classList.add('show-icons');
      if (arrow) arrow.textContent = '▶';
      state.collapsed = true;
      toggleEl.style.left = '0px';
    } else {
      toggleEl.style.display = 'none';
      panel.classList.remove('collapsed');
      toggleEl.classList.remove('show-icons');
      state.collapsed = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toggleEl.style.display = '';
          const w = panel.offsetWidth || 270;
          toggleEl.style.left = w + 'px';
          if (arrow) arrow.textContent = '◀';
        });
      });
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function onContentClick(e) {
    const colorEditBtn = e.target.closest('[data-color-edit]');
    if (colorEditBtn) {
      const layerIdx = colorEditBtn.dataset.colorEdit;
      const curColor = getLayerColor(getCurrentItem(), layerIdx) || '#FFFFFF';
      openColorPicker(curColor, (hex) => {
        const item = getCurrentItem(); if (!item) return;
        setLayerColor(item, layerIdx, hex);
        updateColorUI(layerIdx, hex);
      });
      return;
    }
    const priStep  = e.target.closest('[data-pri-step]');
    if (priStep)  { handlePriorityStep(priStep);  return; }
    const priReset = e.target.closest('[data-pri-reset]');
    if (priReset) { handlePriorityReset(priReset); return; }
    const layerBtn = e.target.closest('[data-select-layer]');
    if (layerBtn) {
      state.selectedLayer = layerBtn.dataset.selectLayer;
      renderContent();
      updateOpacityTab();
      return;
    }
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { handleStep(stepBtn); return; }
    const opStepBtn = e.target.closest('[data-op-step]');
    if (opStepBtn) { handleOpStep(opStepBtn); return; }
    const resetBtn = e.target.closest('[data-reset]');
    if (resetBtn) { handleReset(resetBtn.dataset.reset); return; }
    const scaleLockBtn = e.target.closest('#scale-lock-btn');
    if (scaleLockBtn) {
      state.scaleLock = !state.scaleLock;
      scaleLockBtn.classList.toggle('locked', state.scaleLock);
      scaleLockBtn.innerHTML = state.scaleLock
        ? '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4"/><rect x="9" y="2" width="10" height="10" rx="4"/></svg>'
        : '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4" opacity="0.35"/><rect x="10" y="2" width="10" height="10" rx="4"/></svg>';
      return;
    }
    const settingChk = e.target.closest('[data-setting]');
    if (settingChk && settingChk.tagName === 'INPUT') {
      setAeeSetting(settingChk.dataset.setting, settingChk.checked);
      renderContent();
      return;
    }
    const mirrorBtn = e.target.closest('[data-mirror]');
    if (mirrorBtn) { handleMirror(mirrorBtn.dataset.mirror); return; }
  }

  function onContentChange(e) {
    const el = e.target;
    if (el.dataset.dragMode !== undefined) {
      const mode = el.dataset.dragMode;
      if (el.checked) {
        if (state.activeDrag === 'rot' && mode !== 'rot') hideRotOverlay();
        state.activeDrag = mode;
        updateToggleIcons();
        if (mode === 'rot') showRotOverlay();
        shadowRoot.querySelectorAll('[data-drag-mode]').forEach(cb => {
          if (cb !== el) cb.checked = false;
          cb.closest('.drag-check-label')?.classList.toggle('active', cb.checked);
        });
        el.closest('.drag-check-label')?.classList.add('active');
      } else {
        state.activeDrag = null;
        updateToggleIcons();
        if (mode === 'rot') hideRotOverlay();
        el.closest('.drag-check-label')?.classList.remove('active');
      }
      return;
    }
    if (el.dataset.opLayer !== undefined) {
      const item = getCurrentItem(); if (!item) return;
      const val = parseFloat(el.value) / 100;
      setLO(item, el.dataset.opLayer, 'Opacity', val);
      if (el.dataset.opLayer === 'all') syncOpacityUI(val);
      else updateOpValLabel(el.dataset.opLayer, val);
    }
  }

  function onContentInput(e) {
    const el = e.target;
    if (el.dataset.editOp && state.selectedLayer !== null) {
      const item = getCurrentItem(); if (!item) return;
      const val = parseFloat(el.value) / 100;
      setLO(item, state.selectedLayer, 'Opacity', val);
      const v = shadowRoot.getElementById('edit-op-val');
      if (v) v.textContent = Math.round(val*100) + '%';
      return;
    }
    if (el.dataset.opLayer !== undefined) {
      const item = getCurrentItem(); if (!item) return;
      const val = parseFloat(el.value) / 100;
      setLO(item, el.dataset.opLayer, 'Opacity', val);
      if (el.dataset.opLayer === 'all') syncOpacityUI(val);
      else updateOpValLabel(el.dataset.opLayer, val);
    }
  }

  function onPropValInput(el) {
    const ctrl = el.dataset.propInput;
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null || !ctrl) return;
    const idx = state.selectedLayer;
    const raw = parseFloat(el.value);
    if (isNaN(raw)) return;
    if (ctrl === 'x') setLO(item, idx, 'DrawingLeft', {"": Math.round(raw)});
    else if (ctrl === 'y') setLO(item, idx, 'DrawingTop', {"": Math.round(raw)});
    else if (ctrl === 'sx') setLO(item, idx, 'ScaleX', Math.max(0.05, +raw.toFixed(2)));
    else if (ctrl === 'sy') setLO(item, idx, 'ScaleY', Math.max(0.05, +raw.toFixed(2)));
    else if (ctrl === 'rot') setLO(item, idx, 'Rotation', ((Math.round(raw) % 360) + 360) % 360);
    else if (ctrl === 'skx') setLO(item, idx, 'SkewX', +raw.toFixed(1));
    else if (ctrl === 'sky') setLO(item, idx, 'SkewY', +raw.toFixed(1));
    else if (ctrl === 'fcx') setLO(item, idx, 'MirrorCopyAxisX', Math.max(0, Math.min(1, +raw.toFixed(2))));
    else if (ctrl === 'fcy') setLO(item, idx, 'MirrorCopyAxisY', Math.max(0, Math.min(1, +raw.toFixed(2))));
    updateEditSection();
    if (ctrl === 'rot' && state.activeDrag === 'rot') {
      const lo2 = getLO(getCurrentItem(), idx);
      updateRotOverlay(lo2.Rotation ?? 0);
    }
  }

  function syncOpacityUI(val) {
    const pct = Math.round(val * 100);
    shadowRoot.querySelectorAll('[data-op-layer]').forEach(el => { el.value = pct; });
    // 更新所有透明度百分比顯示（Opacity tab 的 op-val-* + Edit tab 的 edit-op-val）
    shadowRoot.querySelectorAll('[id^="op-val-"]').forEach(el => { el.textContent = pct + '%'; });
    const editOpVal = shadowRoot.getElementById('edit-op-val');
    if (editOpVal) editOpVal.textContent = pct + '%';
  }

  function updateOpValLabel(layerIdx, val) {
    const el = shadowRoot.getElementById(`op-val-${layerIdx}`);
    if (el) el.textContent = Math.round(val*100) + '%';
  }

  function _assetBaseXY(item, layerIdx) {
    const i   = layerIdx === 'all' ? 0 : parseInt(layerIdx);
    const lay = item.Asset?.Layer?.[i];
    const bx  = typeof lay?.DrawingLeft === 'object' ? (lay.DrawingLeft?.[''] ?? 0) : (lay?.DrawingLeft ?? 0);
    const by  = typeof lay?.DrawingTop  === 'object' ? (lay.DrawingTop?.['']  ?? 0) : (lay?.DrawingTop  ?? 0);
    return { bx, by };
  }

  function handleStep(btn) {
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const idx = state.selectedLayer;
    const ctrl = btn.dataset.step;
    const delta = parseFloat(btn.dataset.delta);
    const lo = getLO(item, idx);
    const { bx, by } = _assetBaseXY(item, idx);
    if (ctrl==='x')   setLO(item,idx,'DrawingLeft',{"":( lo.DrawingLeft?.[""]??bx)+delta});
    else if(ctrl==='y')   setLO(item,idx,'DrawingTop', {"":( lo.DrawingTop?.[""] ??by)+delta});
    else if(ctrl==='sx')  setLO(item,idx,'ScaleX', Math.max(0.05,+((lo.ScaleX??1)+delta).toFixed(2)));
    else if(ctrl==='sy')  setLO(item,idx,'ScaleY', Math.max(0.05,+((lo.ScaleY??1)+delta).toFixed(2)));
    else if(ctrl==='rot') setLO(item,idx,'Rotation',((lo.Rotation??0)+delta+360)%360);
    else if(ctrl==='skx') setLO(item,idx,'SkewX', +((lo.SkewX??0)+delta).toFixed(1));
    else if(ctrl==='sky') setLO(item,idx,'SkewY', +((lo.SkewY??0)+delta).toFixed(1));
    else if(ctrl==='fcx') setLO(item,idx,'MirrorCopyAxisX', Math.max(0,Math.min(1,+((lo.MirrorCopyAxisX??0.5)+delta).toFixed(2))));
    else if(ctrl==='fcy') setLO(item,idx,'MirrorCopyAxisY', Math.max(0,Math.min(1,+((lo.MirrorCopyAxisY??0.5)+delta).toFixed(2))));
    updateEditSection();
    if (state.activeDrag === 'rot') {
      const lo2 = getLO(getCurrentItem(), idx);
      updateRotOverlay(lo2.Rotation??0);
    }
  }

  function handleOpStep(btn) {
    const layerIdx = btn.dataset.opStep;   // 'all' | '0' | '1' | ...
    const delta    = parseInt(btn.dataset.opDelta); // +1 or -1
    const item = getCurrentItem(); if (!item) return;
    const lo = getLO(item, layerIdx);
    const current = Math.round((lo.Opacity ?? 1) * 100);
    const newPct  = Math.max(0, Math.min(100, current + delta));
    const newVal  = newPct / 100;
    setLO(item, layerIdx, 'Opacity', newVal);

    // 同步 Opacity tab 的 val 顯示 + slider
    const valEl   = shadowRoot?.getElementById(`op-val-${layerIdx}`);
    const rangeEl = shadowRoot?.querySelector(`[data-op-layer="${layerIdx}"]`);
    if (valEl)   valEl.textContent = newPct + '%';
    if (rangeEl) rangeEl.value     = newPct;

    // 同步 Edit tab 的 opacity
    if (layerIdx === state.selectedLayer || layerIdx === 'all') {
      const editVal   = shadowRoot?.getElementById('edit-op-val');
      const editRange = shadowRoot?.querySelector('[data-edit-op]');
      if (editVal)   editVal.textContent = newPct + '%';
      if (editRange) editRange.value     = newPct;
    }

    // 若是 all，同步所有子圖層的 slider
    if (layerIdx === 'all') {
      shadowRoot?.querySelectorAll('[data-op-layer]:not([data-op-layer="all"])').forEach(el => {
        el.value = newPct;
      });
      shadowRoot?.querySelectorAll('[id^="op-val-"]:not(#op-val-all)').forEach(el => {
        el.textContent = newPct + '%';
      });
    }
  }

  function handleReset(ctrl) {
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const idx = state.selectedLayer;
    if (ctrl==='x') {
      if (idx === 'all') {
        item.Property?.LayerOverrides?.forEach(lo => { if (lo) delete lo.DrawingLeft; });
      } else {
        const li = parseInt(idx);
        if (item.Property?.LayerOverrides?.[li]) delete item.Property.LayerOverrides[li].DrawingLeft;
      }
      { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    }
    else if (ctrl==='y') {
      if (idx === 'all') {
        item.Property?.LayerOverrides?.forEach(lo => { if (lo) delete lo.DrawingTop; });
      } else {
        const li = parseInt(idx);
        if (item.Property?.LayerOverrides?.[li]) delete item.Property.LayerOverrides[li].DrawingTop;
      }
      { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    }
    else if(ctrl==='op') {
      ensureLO(item);
      const count = item.Asset?.Layer?.length || 1;
      const resetIndices = idx === 'all'
        ? Array.from({ length: count }, (_, i) => i)
        : [parseInt(idx)];
      if (!Array.isArray(item.Property.Opacity)) item.Property.Opacity = Array(count).fill(1);
      resetIndices.forEach(i => {
        const layer = item.Asset?.Layer?.[i];
        const def = layer?.Opacity ?? 1;
        if (item.Property.LayerOverrides?.[i]) delete item.Property.LayerOverrides[i].Opacity;
        if (i < item.Property.Opacity.length) item.Property.Opacity[i] = def;
      });
      { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) {
        try { CharacterLoadCanvas(_rc); } catch(e) {}
        if (_aeeItemColorChar && _aeeItemColorChar !== _rc) {
          _aeeItemColorDirty = true; try { CharacterLoadCanvas(_aeeItemColorChar); } catch(e) {}
        }
      } }
    }
    else if(ctrl==='sx')  setLO(item,idx,'ScaleX',1);
    else if(ctrl==='sy')  setLO(item,idx,'ScaleY',1);
    else if(ctrl==='rot') { setLO(item,idx,'Rotation',0); if(state.activeDrag==='rot') updateRotOverlay(0); }
    else if(ctrl==='skx') setLO(item,idx,'SkewX',0);
    else if(ctrl==='sky') setLO(item,idx,'SkewY',0);
    else if(ctrl==='fcx' || ctrl==='mc') { setLO(item,idx,'MirrorCopyAxisX',0.5); setLO(item,idx,'MirrorCopyAxisY',0.5); }
    updateEditSection();
  }

  function handleMirror(key) {
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const lo = getLO(item, state.selectedLayer);
    let cur;
    if (key === 'MirrorCopy') cur = !!lo.MirrorCopy;
    else if (key === 'MirrorCopyV') cur = !!lo.MirrorCopyV;
    else if (key === 'FlipX') cur = !!lo.FlipX;
    else cur = !!lo.FlipY;
    setLO(item, state.selectedLayer, key, !cur);
    updateEditSection();
    const sec = shadowRoot.getElementById('edit-section');
    if (!sec) return;
    const lo2 = getLO(getCurrentItem(), state.selectedLayer);
    sec.querySelector('[data-mirror="FlipX"]')?.classList.toggle('active', !!lo2.FlipX);
    sec.querySelector('[data-mirror="FlipY"]')?.classList.toggle('active', !!lo2.FlipY);
    sec.querySelector('[data-mirror="MirrorCopy"]')?.classList.toggle('active', !!lo2.MirrorCopy);
    sec.querySelector('[data-mirror="MirrorCopyV"]')?.classList.toggle('active', !!lo2.MirrorCopyV);
  }

  // ============================================================
  // RENDER
  // ============================================================

  function renderContent() {
    if (!shadowRoot) return;
    const item  = getCurrentItem();
    const group = getCurrentGroup();
    const isWardrobeColor = (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode === 'Color');
    const isItemColor     = !!_aeeItemColorItem;

    if (!item || !group || (!isWardrobeColor && !isItemColor)) {
      hostEl.style.display = 'none';
      hideRotOverlay();
      return;
    }
    hostEl.style.display = 'block';
    alignHost(); updateTogglePos();

    const _nameEl = shadowRoot.getElementById('item-name-text');
    if (_nameEl) _nameEl.textContent = `${group} / ${item.Asset?.Description || item.Asset?.Name || ''}`;

    const layers  = item.Asset?.Layer || [];
    const content = shadowRoot.getElementById('content');

    if      (state.tab === 'edit')    content.innerHTML = renderEditTab(item, layers);
    else if (state.tab === 'opacity') content.innerHTML = renderOpacityTab(item, layers);
    else if (state.tab === 'layers')  content.innerHTML = renderLayersTab(item, layers);
    else content.innerHTML = renderSettingsTab();

    content.querySelectorAll('[data-prop-input]').forEach(input => {
      input.addEventListener('change', () => onPropValInput(input));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { onPropValInput(input); input.blur(); } });
      input.addEventListener('mousedown', e => e.stopPropagation());
      input.addEventListener('click', e => e.stopPropagation());
    });

    content.querySelectorAll('[data-pri-input]').forEach(input => {
      input.addEventListener('change', () => handlePriorityInput(input));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { handlePriorityInput(input); input.blur(); } });
      input.addEventListener('mousedown', e => e.stopPropagation());
      input.addEventListener('click',     e => e.stopPropagation());
    });

    if (state.activeDrag === 'rot') showRotOverlay();
    else hideRotOverlay();
  }

  function updatePartsPanel() {
    if (!shadowRoot) return;
    const item   = getCurrentItem(); if (!item) return;
    const layers = item.Asset?.Layer || [];
    const body   = shadowRoot.getElementById('parts-float-body');
    if (!body) return;
    body.innerHTML =
      layerBtnRow('all', t('allParts'), getLayerColor(item, 0)) +
      layers.map((l, i) => layerBtnRow(String(i), getLayerDisplayName(l, i), getLayerColor(item, i))).join('');
    body.querySelectorAll('[data-select-layer]').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.selectLayer === state.selectedLayer);
    });
  }

  function renderEditTab(item, layers) {
    const idx = state.selectedLayer;
    let editHtml = '';

    if (idx !== null) {
      const lo    = getLO(item, idx);
      const label = idx==='all' ? t('allParts') : getLayerDisplayName(layers[parseInt(idx)], idx);
      const _al  = idx === 'all' ? layers[0] : layers[parseInt(idx)];
      const _axB = typeof _al?.DrawingLeft === 'object' ? (_al.DrawingLeft?.['']??0) : (_al?.DrawingLeft??0);
      const _ayB = typeof _al?.DrawingTop  === 'object' ? (_al.DrawingTop?.[''] ??0) : (_al?.DrawingTop ??0);
      const x = lo.DrawingLeft?.[""] ?? _axB;
      const y = lo.DrawingTop?.[""]  ?? _ayB;
      const sx    = lo.ScaleX ?? 1;
      const sy    = lo.ScaleY ?? 1;
      const rot   = lo.Rotation ?? 0;
      const op    = Math.round((lo.Opacity??1)*100);
      const color = getLayerColor(item, idx);

      editHtml = `<div class="section" id="edit-section">
  <div class="sec-title-row">
    <span class="sec-title">✦ ${label}</span>
    <div class="color-chip" data-color-edit="${idx}">
      <div class="color-chip-inner" style="${color ? 'background:' + color : ''}"></div>
    </div>
  </div>

  <div class="op-group">
    <div class="op-row-label">
      ${t('opacity')}
      <div class="op-step-row">
        <button class="op-step" data-op-step="${idx}" data-op-delta="-1">−1</button>
        <span class="op-val-display" id="edit-op-val">${op}%</span>
        <button class="op-step" data-op-step="${idx}" data-op-delta="1">+1</button>
      </div>
    </div>
    <input type="range" class="range" data-edit-op="1" min="0" max="100" step="1" value="${op}">
  </div>

  ${(function(){
    if (isGroupLocked()) return '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:10px;line-height:1.8;">' + (isZh()?'此部位已鎖定變形編輯<br><span style="font-size:10px;">仍可編輯透明度與圖層</span>':'Transform editing locked<br><span style="font-size:10px;">Opacity &amp; layers still available</span>') + '</div>';
    return '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('coord') + '</span>' + dragCheckbox('xy',t('coordDrag')) + '</div>' + propRow('X',x,'x',[-5,-1,1,5]) + propRow('Y',y,'y',[-5,-1,1,5]) + '</div>';
  })()}

  ${(function(){
    if (isGroupLocked()) return '';
    const scaleLockSvg = state.scaleLock
      ? '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4"/><rect x="9" y="2" width="10" height="10" rx="4"/></svg>'
      : '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4" opacity="0.35"/><rect x="10" y="2" width="10" height="10" rx="4"/></svg>';
    const rotHtml = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('rotate') + '</span>' + dragCheckbox('rot',t('rotateDrag')) + '</div>' + propRow('°',rot,'rot',[-5,-1,1,5]) + '</div>';
    const scaleHtml = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('scale') + '</span><button class="scale-lock-btn' + (state.scaleLock?' locked':'') + '" id="scale-lock-btn" title="' + (isZh()?'等比縮放':'Proportional scale') + '">' + scaleLockSvg + '</button>' + dragCheckbox('scale',t('scaleDrag')) + '</div>' + propRow('X',sx.toFixed(2),'sx',[-0.3,-0.1,0.1,0.3]) + propRow('Y',sy.toFixed(2),'sy',[-0.3,-0.1,0.1,0.3]) + '</div>';
    const skewHtml = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('skew') + '</span>' + dragCheckbox('skew', t('coordDrag')) + '</div>' + propRow('X°',(lo.SkewX??0).toFixed(1),'skx',[-5,-1,1,5]) + propRow('Y°',(lo.SkewY??0).toFixed(1),'sky',[-5,-1,1,5]) + '</div>';
    const mirrorHtml = (function(){
      const mcx = (lo.MirrorCopyAxisX??0.5).toFixed(2);
      const mcy = (lo.MirrorCopyAxisY??0.5).toFixed(2);
      const copyAxisRow = `<div style="display:flex;align-items:center;gap:4px;margin-top:5px;font-size:11px;color:var(--text-dim)">
        <span style="flex-shrink:0">${t('mirrorCenter')}</span>
        <span style="flex-shrink:0">H</span>
        <button class="step" style="width:20px;height:18px;font-size:9px" data-step="fcx" data-delta="-0.05">-</button>
        <input class="prop-val-input" data-prop-input="fcx" value="${mcx}" style="width:34px;font-size:11px">
        <button class="step" style="width:20px;height:18px;font-size:9px" data-step="fcx" data-delta="0.05">+</button>
        <span style="flex-shrink:0;margin-left:2px">V</span>
        <button class="step" style="width:20px;height:18px;font-size:9px" data-step="fcy" data-delta="-0.05">-</button>
        <input class="prop-val-input" data-prop-input="fcy" value="${mcy}" style="width:34px;font-size:11px">
        <button class="step" style="width:20px;height:18px;font-size:9px" data-step="fcy" data-delta="0.05">+</button>
        <button class="step-reset" data-reset="mc" title="↺" style="width:18px;height:18px;font-size:11px">↺</button>
      </div>`;
      return '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('mirror') + '</span></div>'
        + '<div class="mirror-grid">'
        + '<div class="mirror-group"><div class="mirror-group-title">' + (isZh()?'鏡射':'Mirror') + '</div>'
        + '<div class="mirror-pair"><button class="mirror-btn ' + (lo.FlipX?'active':'') + '" data-mirror="FlipX">' + t('mirrorH') + '</button>'
        + '<button class="mirror-btn ' + (lo.FlipY?'active':'') + '" data-mirror="FlipY">' + t('mirrorV') + '</button></div></div>'
        + '<div class="mirror-group"><div class="mirror-group-title">' + (isZh()?'複製':'Copy') + '</div>'
        + '<div class="mirror-pair"><button class="mirror-btn ' + (lo.MirrorCopy?'active':'') + '" data-mirror="MirrorCopy">' + t('mirrorH') + '</button>'
        + '<button class="mirror-btn ' + (lo.MirrorCopyV?'active':'') + '" data-mirror="MirrorCopyV">' + t('mirrorV') + '</button></div></div>'
        + '</div>'
        + copyAxisRow
        + '</div>';
    })();
    return rotHtml + scaleHtml + skewHtml + mirrorHtml;
  })()}
</div>`;
    }

    return editHtml + `<div class="section">
  <div class="sec-title">${t('secPart')}</div>
  ${layerBtnRow('all', t('allParts'), getLayerColor(item, 0))}
  ${layers.map((l,i)=>layerBtnRow(String(i), getLayerDisplayName(l, i), getLayerColor(item, i))).join('')}
</div>`;
  }

  function renderOpacityTab(item, layers) {
    // 整件：若各 slot 值不同則 null（顯示 —）
    const allOpacity = getOpacity(item, 'all');
    const allDisplay = allOpacity === null ? '—' : Math.round(allOpacity * 100) + '%';
    const allVal     = allOpacity === null ? 100 : Math.round(allOpacity * 100); // slider 預設
    const opRow = (layerIdx, name, opPct, isAll) => `<div class="op-tab-row">
      <div class="op-tab-name">
        <span class="op-tab-label">${name}</span>
        <div class="op-step-row">
          <button class="op-step" data-op-step="${layerIdx}" data-op-delta="-1">−1</button>
          <span class="op-val-display" id="op-val-${layerIdx}">${isAll ? allDisplay : opPct + '%'}</span>
          <button class="op-step" data-op-step="${layerIdx}" data-op-delta="1">+1</button>
        </div>
      </div>
      <input type="range" class="range" data-op-layer="${layerIdx}" min="0" max="100" step="1" value="${isAll ? allVal : opPct}">
    </div>`;
    let html = opRow('all', t('allParts'), allVal, true);
    layers.forEach((layer,i) => {
      const v = getOpacity(item, String(i));
      html += opRow(String(i), getLayerDisplayName(layer, i), Math.round((v ?? 1) * 100), false);
    });
    return html;
  }

  function updateEditSection() {
    if (!shadowRoot) return;
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const lo  = getLO(item, state.selectedLayer);
    const sec = shadowRoot.getElementById('edit-section');
    if (!sec) return;
    const vals = {
      x: lo.DrawingLeft?.[""] ?? (typeof item.Asset?.Layer?.[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)]?.DrawingLeft === 'object' ? (item.Asset.Layer[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)].DrawingLeft?.['']??0) : (item.Asset?.Layer?.[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)]?.DrawingLeft??0)),
      y: lo.DrawingTop?.[""]  ?? (typeof item.Asset?.Layer?.[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)]?.DrawingTop  === 'object' ? (item.Asset.Layer[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)].DrawingTop?.[''] ??0) : (item.Asset?.Layer?.[state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer)]?.DrawingTop ??0)),
      sx: (lo.ScaleX??1).toFixed(2),
      sy: (lo.ScaleY??1).toFixed(2),
      rot: lo.Rotation??0,
      skx: (lo.SkewX??0).toFixed(1),
      sky: (lo.SkewY??0).toFixed(1),
      fcx: (lo.MirrorCopyAxisX??0.5).toFixed(2),
      fcy: (lo.MirrorCopyAxisY??0.5).toFixed(2),
    };
    sec.querySelectorAll('[data-prop-input]').forEach(el => {
      if (el.dataset.propInput && vals[el.dataset.propInput] !== undefined) {
        if (el !== sec.querySelector(':focus')) el.value = vals[el.dataset.propInput];
      }
    });
    const opVal = Math.round((lo.Opacity??1)*100);
    const opEl = shadowRoot.getElementById('edit-op-val');
    if (opEl) opEl.textContent = opVal + '%';
    const opRange = sec.querySelector('[data-edit-op]');
    if (opRange) opRange.value = opVal;
  }

  // ============================================================
  // HTML HELPERS
  // ============================================================

  function dragCheckbox(mode, label) {
    const isActive = state.activeDrag === mode;
    return `<label class="drag-check-label ${isActive?'active':''}">
  <input type="checkbox" data-drag-mode="${mode}" ${isActive?'checked':''}>
  ${label}
</label>`;
  }

  function propRow(label, val, ctrl, deltas) {
    return `<div class="prop-row">
  <div class="prop-row-label">
    ${label}
    <input type="text" class="prop-val-input" data-prop-input="${ctrl}" value="${val}">
  </div>
  <div class="stepper">
    ${deltas.map(d=>`<button class="step" data-step="${ctrl}" data-delta="${d}">${d>0?'+':''}${d}</button>`).join('')}
    <button class="step-reset" data-reset="${ctrl}" title="↺">↺</button>
  </div>
</div>`;
  }

  function clampPri(v) { return Math.max(-99, Math.min(99, v)); }

  function applyPriority(item, rawIdx, newVal) {
    newVal = clampPri(newVal);
    if (!item.Property) item.Property = {};
    const layers = item.Asset?.Layer || [];
    if (rawIdx === 'all') {
      item.Property.OverridePriority = newVal;
    } else {
      const layerName = layers[parseInt(rawIdx)]?.Name;
      if (!layerName) return newVal;
      if (typeof item.Property.OverridePriority !== 'object' || item.Property.OverridePriority == null) {
        item.Property.OverridePriority = {};
      }
      item.Property.OverridePriority[layerName] = newVal;
    }
    { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    return newVal;
  }

  function handlePriorityStep(btn) {
    const item = getCurrentItem(); if (!item) return;
    const rawIdx = btn.dataset.priStep;
    const delta  = parseInt(btn.dataset.priDelta);
    const layers = item.Asset?.Layer || [];
    let current;
    if (rawIdx === 'all') {
      const op = item.Property?.OverridePriority;
      current = typeof op === 'number' ? op : (item.Asset?.DrawingPriority ?? 0);
    } else {
      const i  = parseInt(rawIdx);
      const layerName = layers[i]?.Name;
      const op = item.Property?.OverridePriority;
      current = (typeof op === 'object' && op?.[layerName] != null)
        ? op[layerName]
        : (layers[i]?.Priority ?? 0);
    }
    const newVal = applyPriority(item, rawIdx, current + delta);
    const input  = shadowRoot?.querySelector(`[data-pri-input="${rawIdx}"]`);
    if (input) input.value = newVal;
  }

  function handlePriorityInput(input) {
    const item = getCurrentItem(); if (!item) return;
    const rawIdx = input.dataset.priInput;
    const val    = parseInt(input.value);
    if (isNaN(val)) return;
    applyPriority(item, rawIdx, val);
    input.value = clampPri(val);
  }

  function handlePriorityReset(btn) {
    const item = getCurrentItem(); if (!item) return;
    const rawIdx = btn.dataset.priReset;
    const layers = item.Asset?.Layer || [];
    if (rawIdx === 'all') {
      if (item.Property) delete item.Property.OverridePriority;
      const base  = item.Asset?.DrawingPriority ?? 0;
      const input = shadowRoot?.querySelector('[data-pri-input="all"]');
      if (input) input.value = base;
    } else {
      const i = parseInt(rawIdx);
      const layerName = layers[i]?.Name;
      if (layerName && typeof item.Property?.OverridePriority === 'object') {
        delete item.Property.OverridePriority[layerName];
        if (Object.keys(item.Property.OverridePriority).length === 0)
          delete item.Property.OverridePriority;
      }
      const base  = layers[i]?.Priority ?? 0;
      const input = shadowRoot?.querySelector(`[data-pri-input="${rawIdx}"]`);
      if (input) input.value = base;
    }
    { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
  }

  const _aeeSettings = (() => {
    try { return JSON.parse(localStorage.getItem('liko-aee-settings') || '{}'); } catch { return {}; }
  })();
  function _saveAeeSettings() {
    try { localStorage.setItem('liko-aee-settings', JSON.stringify(_aeeSettings)); } catch {}
  }
  function getAeeSetting(k, def) { return _aeeSettings[k] ?? def; }
  function setAeeSetting(k, v) { _aeeSettings[k] = v; _saveAeeSettings(); }

  function renderSettingsTab() {
    return '<div class="settings-empty">' + (isZh() ? '⚙️ 設定\n功能擴充中' : '⚙️ Settings\nMore features coming soon') + '</div>';
  }

  function renderLayersTab(item, layers) {
    if (!layers.length) return `<div class="settings-empty">${t('noLayers')}</div>`;
    const itemBase    = typeof item.Asset?.DrawingPriority === 'number' ? item.Asset.DrawingPriority : 0;
    const overPri     = item.Property?.OverridePriority;
    const itemCurrent = typeof overPri === 'number' ? overPri : itemBase;
    const allOverride = typeof overPri === 'number';

    const allRow = `<div class="layer-pri-row" style="border-bottom:2px solid var(--border)">
  <span class="layer-pri-name" style="font-weight:700;${allOverride ? 'color:var(--accent2)' : ''}">
    ${t('allParts')} <span style="font-size:10px;color:var(--text-dim)">(base:${itemBase})</span>
  </span>
  <button class="step" style="width:28px;flex:none" data-pri-step="all" data-pri-delta="-1">-1</button>
  <input type="text" class="pri-input" data-pri-input="all" value="${itemCurrent}" min="-99" max="99">
  <button class="step" style="width:28px;flex:none" data-pri-step="all" data-pri-delta="1">+1</button>
  <button class="step-reset" data-pri-reset="all" title="↺" style="width:22px">↺</button>
</div>`;

    const layerRows = layers.map((layer, i) => {
      const basePri     = typeof layer?.Priority === 'number' ? layer.Priority : 0;
      const op          = item.Property?.OverridePriority;
      const currentPri  = (typeof op === 'object' && op?.[layer.Name] != null)
        ? op[layer.Name]
        : basePri;
      const isOverridden = typeof op === 'object' && op?.[layer.Name] != null;
      const name        = getLayerDisplayName(layer, i);
      return `<div class="layer-pri-row">
  <span class="layer-pri-name" style="${isOverridden ? 'color:var(--accent2)' : ''}">${name}
    <span style="font-size:10px;color:var(--text-dim)">(${basePri})</span>
  </span>
  <button class="step" style="width:28px;flex:none" data-pri-step="${i}" data-pri-delta="-1">-1</button>
  <input type="text" class="pri-input" data-pri-input="${i}" value="${currentPri}" min="-99" max="99">
  <button class="step" style="width:28px;flex:none" data-pri-step="${i}" data-pri-delta="1">+1</button>
  <button class="step-reset" data-pri-reset="${i}" title="↺" style="width:22px">↺</button>
</div>`;
    }).join('');
    return allRow + layerRows;
  }

  function layerBtnRow(idx, name, color) {
    const dotFill = color ? `style="background:${color}"` : '';
    return `<div class="layer-btn-row">
  <button class="layer-btn ${state.selectedLayer===idx?'selected':''}" data-select-layer="${idx}">
    <span class="layer-btn-label">${name}</span>
    <span class="layer-color-dot"><span class="layer-color-dot-fill" data-color-dot="${idx}" ${dotFill}></span></span>
  </button>
</div>`;
  }

  // ============================================================
  // MAIN LOOP HOOKS
  // ============================================================

  let lastGroup = null, lastAsset = null, lastMode = null;

  function aeeCheckAndRender() {
    const item  = getCurrentItem();
    const group = getCurrentGroup();
    const mode  = typeof CharacterAppearanceMode !== 'undefined' ? CharacterAppearanceMode : null;

    buildPanel();

    const itemChanged = (group !== lastGroup || item?.Asset?.Name !== lastAsset);
    if (itemChanged || mode !== lastMode) {
      if (itemChanged) {
        state.selectedLayer = null;
        state.activeDrag = null;
        hideRotOverlay();
        updateToggleIcons();
        const pf  = shadowRoot?.getElementById('parts-float');
        const btn = shadowRoot?.getElementById('parts-toggle-btn');
        if (pf)  { pf.classList.remove('open'); }
        if (btn) { btn.classList.remove('active'); }
        setTimeout(() => {
          if (shadowRoot && hostEl?.style.display !== 'none') renderContent();
        }, 350);
      }
      lastGroup = group; lastAsset = item?.Asset?.Name; lastMode = mode;
      renderContent();
      const pf = shadowRoot?.getElementById('parts-float');
      if (pf?.classList.contains('open')) updatePartsPanel();
    }
  }

  try {
    modApi.hookFunction("CharacterLoadCanvas", 0, (args, next) => {
      if (args[0]) currentRenderChar = args[0];
      return next(args);
    });
  } catch(e) {}

  // ── CommonDrawAppearanceBuild：對有 transform 的 item 設 DynamicBeforeDraw ──
  // 確保 BC 呼叫 BeforeDraw，讓我們有機會在每個 layer 繪製前設定 _aeePendingTd
  // TODO: 低端機器模式下 dynamic drawing 可被停用，此時 BeforeDraw 不會被呼叫
  //       長期需要不依賴 BeforeDraw 的渲染路徑（例如 ScriptDraw 或 GLDrawImage 擴充）
  try {
    modApi.hookFunction("CommonDrawAppearanceBuild", 1, (args, next) => {
      const C = args[0];
      C?.Appearance?.forEach(item => {
        const los = item.Property?.LayerOverrides;
        if (!Array.isArray(los)) return;
        const needsBeforeDraw = los.some(lo => lo &&
          (lo.DrawingLeft != null || lo.DrawingTop != null ||
           lo.Rotation != null || lo.ScaleX != null || lo.ScaleY != null ||
           lo.SkewX != null || lo.SkewY != null ||
           lo.FlipX || lo.FlipY || lo.MirrorCopy || lo.MirrorCopyV));
        if (needsBeforeDraw) item.Asset.DynamicBeforeDraw = true;
      });
      return next(args);
    });
  } catch(e) {}

  // ── BeforeDraw hook（priority 3）──
  // 重構重點：直接從 params.CA.Property.LayerOverrides 讀取 transform，
  // 不再查 session map。estsanatlehi：「BeforeDraw is passing you the Item」
  try {
    modApi.hookFunction("CommonCallFunctionByNameWarn", 3, (args, next) => {
      const funcName = args[0];
      const params   = args[1];
      if (!params || !/Assets(.+)BeforeDraw/i.test(funcName)) return next(args);

      // ── 重置狀態，直接從 Item 讀取 transform ──
      _aeePendingTd      = null;
      _aeePendingApplied = 0;

      const CA = params.CA;
      if (CA) {
        // 從 layer name 找 layer index
        let layerName = (params.L ?? '').trim();
        if (layerName[0] === '_') layerName = layerName.slice(1);
        const layerIdx = CA.Asset?.Layer?.findIndex(l => (l.Name ?? '') === layerName) ?? -1;

        if (layerIdx >= 0) {
          const lo = CA.Property?.LayerOverrides?.[layerIdx];
          if (lo) {
            const hasTransform =
              lo.FlipX || lo.FlipY || lo.MirrorCopy || lo.MirrorCopyV ||
              lo.ScaleX != null || lo.ScaleY != null || lo.Rotation != null ||
              lo.SkewX != null || lo.SkewY != null;
            if (hasTransform) {
              _aeePendingTd = {
                flipX:       !!lo.FlipX,
                flipY:       !!lo.FlipY,
                mirrorCopy:  !!lo.MirrorCopy,
                mirrorCopyV: !!lo.MirrorCopyV,
                mirrorCopyAxisX: lo.MirrorCopyAxisX ?? 0.5,
                mirrorCopyAxisY: lo.MirrorCopyAxisY ?? 0.5,
                scaleX:      lo.ScaleX ?? 1,
                scaleY:      lo.ScaleY ?? 1,
                rotation:    lo.Rotation ?? 0,
                skewX:       lo.SkewX ?? 0,
                skewY:       lo.SkewY ?? 0,
              };
              aeeLog(`BeforeDraw: ${CA.Asset?.Name}[${layerIdx}]=${layerName} → td set rot=${_aeePendingTd.rotation}`);
            }
          }
        }
      }

      // ── 呼叫 next，讓 LSCG / BC 原生處理 ──
      const ret = next(args) ?? {};

      // ── AEE-only 位移（X/Y）──
      // BeforeDraw 原生支援返回 {X, Y}，不需要 prototype patch
      const Property = params.Property;
      if (CA && Property) {
        let rawName = (params.L ?? '').trim();
        if (rawName[0] === '_') rawName = rawName.slice(1);
        const layerIx = CA.Asset?.Layer?.findIndex(l => (l.Name ?? '') === rawName) ?? -1;
        if (layerIx >= 0) {
          const lo = Property?.LayerOverrides?.[layerIx];
          if (lo) {
            const dx = lo.DrawingLeft?.[''];
            const dy = lo.DrawingTop?.[''];
            if (dx != null && ret.X == null) ret.X = dx;
            if (dy != null && ret.Y == null)
              ret.Y = dy + (typeof CanvasUpperOverflow !== 'undefined' ? CanvasUpperOverflow : 0);
            // Opacity 已改為直接寫 Property.Opacity[i]（BC native 路徑）
            // BeforeDraw Alpha 路線已確認無效，移除
          }
        }
      }
      return ret;
    });
  } catch(e) {}

  modApi.hookFunction("AppearanceRun", 1, (args, next) => {
    aeeCheckAndRender();
    return next(args);
  });

  let _aeeItemColorChar = null;
  let _aeeItemColorItem = null;
  let _aeeItemColorDirty = false;
  try {
    modApi.hookFunction("ItemColorLoad", 0, (args, next) => {
      _aeeItemColorChar  = args[0];
      _aeeItemColorItem  = args[1];
      _aeeItemColorDirty = false;
      const result = next(args);
      aeeCheckAndRender();
      Promise.resolve(result).then(() => {
        setTimeout(() => {
          if (shadowRoot && hostEl?.style.display !== 'none') renderContent();
        }, 300);
      });
      return result;
    });
  } catch(e) {}

  try {
    modApi.hookFunction("ItemColorDraw", 0, (args, next) => {
      if (args[0]) _aeeItemColorChar = args[0];
      if (args[0] && args[1]) _aeeItemColorItem = InventoryGet(args[0], args[1]);
      return next(args);
    });
  } catch(e) {}

  try {
    modApi.hookFunction("ItemColorFireExit", 0, (args, next) => {
      const wasDirty = _aeeItemColorDirty;
      const dirtyChar = _aeeItemColorChar;
      const item = _aeeItemColorItem;

      // 我們已移除 editOpacity 強制開啟，BC 選色器不再寫 Property.Opacity[i]，
      // 所以不需要從 Property.Opacity 反向 sync 回 LayerOverrides。

      const result = next(args);
      _aeeItemColorChar  = null;
      _aeeItemColorItem  = null;
      _aeeItemColorDirty = false;
      if (wasDirty && dirtyChar) {
        try {
          if (typeof ChatRoomCharacterUpdate === 'function') {
            ChatRoomCharacterUpdate(dirtyChar);
          }
        } catch(e) {}
      }
      aeeCheckAndRender();
      return result;
    });
  } catch(e) {}

  try { modApi.hookFunction("DialogRun", 0, (args, next) => { aeeCheckAndRender(); return next(args); }); } catch(e) {}

  window.addEventListener('resize', () => {
    alignHost(); updateTogglePos(); alignRotOverlay(); alignOpOverlay();
    positionColorPicker();
    if (state.activeDrag === 'rot') {
      const item = getCurrentItem();
      if (item && state.selectedLayer !== null) {
        const lo = getLO(item, state.selectedLayer);
        updateRotOverlay(lo.Rotation??0);
      }
    }
  });

  console.log("🐈‍⬛ [AEE] ✅ 初始化完成 v" + MOD_Version);
})();
