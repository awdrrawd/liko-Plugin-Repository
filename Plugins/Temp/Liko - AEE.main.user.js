// ==UserScript==
// @name         Liko - AEE
// @name:cn      Liko的外觀編輯拓展
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.8.0-2
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
    window.Liko = window.Liko ?? {};
    const MOD_VER = "0.8.0";
    if (window.Liko.AEE) return;
    window.Liko.AEE = MOD_VER;

    const MOD_NAME = "Liko - AEE";
    if (typeof bcModSdk !== "object" || typeof bcModSdk.registerMod !== "function") return;
    const modApi = bcModSdk.registerMod({
        name: MOD_NAME, fullName: "Liko - Appearance Editor",
        version: MOD_VER, repository: "外觀編輯拓展 | Appearance editing extension."
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
            tabEdit: 'Edit', tabOpacity: 'Opacity', tabLayers: 'Layers', tabSettings: 'Settings',
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
    // WebGL prototype patch：注入 rotation、non-uniform scale、skew、flip、MirrorCopy
    // BeforeDraw hook 在每個 layer 繪製前設定 _aeePendingTd，由 uniformMatrix4fv 消費
    // ============================================================

    let assetGroupMap = new Map();
    let currentRenderChar = null;

    const AEE_DEBUG = false;
    function aeeLog(...a) { if (AEE_DEBUG) console.log("🐈‍⬛[AEE]", ...a); }

    let _aeePendingTd      = null;
    let _aeePendingApplied = 0;
    let _aeeMCFlags        = null;
    let _aeeLastMatData    = null;
    let _aeeLastMatLoc     = null;
    let _aeeLastGl         = null;

    const _origMat  = WebGL2RenderingContext.prototype.uniformMatrix4fv;
    const _origDraw = WebGL2RenderingContext.prototype.drawArrays;

    // ── Priority overrides（在 BC build 前套用，build 後還原）──
    modApi.hookFunction("GLDrawAppearanceBuild", 1, (args, next) => {
        const C = args[0];
        currentRenderChar = C;
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

    modApi.hookFunction("GLDrawImage", 1, (args, next) => {
        return next(args);
    });

    // ── uniformMatrix4fv：注入 rotation / scale / skew / flip ──
    WebGL2RenderingContext.prototype.uniformMatrix4fv = function(loc, tp, data) {
        if (data instanceof Float32Array && data.length === 16 && _aeePendingTd) {
            const td = _aeePendingTd;
            _aeePendingApplied++;
            if (_aeePendingApplied >= 2) { _aeePendingTd = null; _aeePendingApplied = 0; }

            const m = new Float32Array(data);

            if (td.rotation !== 0 || td.scaleX !== 1 || td.scaleY !== 1) {
                const old0 = m[0], old1 = m[1], old4 = m[4], old5 = m[5];
                const rad = -td.rotation * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                const sx  = Math.sqrt(old0**2 + old1**2) * td.scaleX;
                const sy  = Math.sqrt(old4**2 + old5**2) * td.scaleY;
                const sgx = old0 < 0 ? -1 : 1;
                const sgy = old5 < 0 ? -1 : 1;
                m[0] =  cos * sx * sgx; m[1] =  sin * sx * sgx;
                m[4] = -sin * sy * sgy; m[5] =  cos * sy * sgy;
                m[12] -= 0.5 * (m[0] + m[4] - old0 - old4);
                m[13] -= 0.5 * (m[1] + m[5] - old1 - old5);
            }

            if (td.skewX !== 0 || td.skewY !== 0) {
                const bx0 = m[0], by0 = m[1], bx4 = m[4], by5 = m[5];
                if (td.skewX !== 0) {
                    const tx = Math.tan(td.skewX * Math.PI / 180);
                    m[4] += tx * bx0; m[5] += tx * by0;
                    m[12] -= 0.5 * tx * bx0; m[13] -= 0.5 * tx * by0;
                }
                if (td.skewY !== 0) {
                    const ty = Math.tan(td.skewY * Math.PI / 180);
                    m[0] += ty * bx4; m[1] += ty * by5;
                    m[12] -= 0.5 * ty * bx4; m[13] -= 0.5 * ty * by5;
                }
            }

            if (td.flipX) { m[12] += m[0]; m[13] += m[1]; m[0] = -m[0]; m[1] = -m[1]; }
            if (td.flipY) { m[12] += m[4]; m[13] += m[5]; m[4] = -m[4]; m[5] = -m[5]; }

            if (td.mirrorCopy || td.mirrorCopyV) {
                _aeeLastMatData = m; _aeeLastMatLoc = loc; _aeeLastGl = this;
                _aeeMCFlags = { mirrorCopy: td.mirrorCopy, mirrorCopyV: td.mirrorCopyV,
                                mirrorCopyAxisX: td.mirrorCopyAxisX ?? 0.5, mirrorCopyAxisY: td.mirrorCopyAxisY ?? 0.5 };
            } else {
                _aeeLastMatData = null; _aeeMCFlags = null;
            }

            aeeLog(`mat: rot=${td.rotation} sx=${td.scaleX} sy=${td.scaleY} flip=${td.flipX}/${td.flipY}`);
            return _origMat.call(this, loc, tp, m);
        }

        if (!_aeePendingTd) { _aeeLastMatData = null; _aeeMCFlags = null; }
        return _origMat.call(this, loc, tp, data);
    };

    // ── drawArrays：MirrorCopy 需要第二次 draw call，GLDrawImage 原生不支援 ──
    WebGL2RenderingContext.prototype.drawArrays = function(mode, first, count) {
        const result = _origDraw.call(this, mode, first, count);
        if (!_aeeMCFlags || !_aeeLastMatData || _aeeLastGl !== this) return result;

        if (_aeeMCFlags.mirrorCopy) {
            const mM = new Float32Array(_aeeLastMatData);
            mM[0] = -mM[0]; mM[1] = -mM[1];
            const ax = 2 * (_aeeMCFlags.mirrorCopyAxisX ?? 0.5) - 1;
            mM[12] = 2 * ax - mM[12];
            _origMat.call(this, _aeeLastMatLoc, false, mM);
            _origDraw.call(this, mode, first, count);
        }
        if (_aeeMCFlags.mirrorCopyV) {
            const mV = new Float32Array(_aeeLastMatData);
            mV[4] = -mV[4]; mV[5] = -mV[5];
            const ay = 2 * (_aeeMCFlags.mirrorCopyAxisY ?? 0.5) - 1;
            mV[13] = 2 * ay - mV[13];
            _origMat.call(this, _aeeLastMatLoc, false, mV);
            _origDraw.call(this, mode, first, count);
        }

        _aeeLastMatData = null; _aeeMCFlags = null;
        return result;
    };

    // ============================================================
    // HOVER HIGHLIGHT
    // 兩種閃爍：
    //   hoverHighlight     — AEE 部件列表懸停時，用 Property.Opacity 做 sine 波動畫
    //   hoverHighlightChar — BC Appearance 部件列表懸停時，角色身上對應衣服閃爍
    // ============================================================

    // ── AEE 部件列表閃爍 ──
    let _hoverHighlightAnimFrame = null;
    let _hoverHighlightStartTime = null;
    let _hoverFlashData          = null; // { item, overrides: Map<layerIdx, opacity> }
    let _hoverCharFlashData      = null; // { item, overrides: Map<layerIdx, opacity> }
    // ── 閃爍實作：完全透過 _hoverFlashData + BeforeDraw 臨時 override opacity ──
    // 完全不修改 Property.Opacity，退出時無殘留（0.7.6 原始做法）

    function _startHoverHighlight(item, layerIdx) {
        if (!state.hoverHighlight || !item) return;
        if (_hoverHighlightAnimFrame !== null && _hoverFlashData?.item === item) return; // 同物件已在閃爍
        _stopHoverHighlight(item, false);

        const indices = layerIdx === 'all'
            ? Array.from({ length: item.Asset?.Layer?.length || 1 }, (_, i) => i)
            : [parseInt(layerIdx)];

        _hoverHighlightStartTime = performance.now();

        function animate() {
            if (!_hoverHighlightAnimFrame) return; // 已被停止
            const t = ((performance.now() - _hoverHighlightStartTime) % 1500) / 1500;
            const opacity = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
            const overrides = new Map();
            indices.forEach(i => overrides.set(i, opacity));
            _hoverFlashData = { item, overrides };
            const _rc = CharacterAppearanceSelection || _aeeItemColorChar;
            if (_rc) { try { CharacterLoadCanvas(_rc); } catch(e) {} }
            _hoverHighlightAnimFrame = requestAnimationFrame(animate);
        }
        _hoverHighlightAnimFrame = requestAnimationFrame(animate);
    }

    function _stopHoverHighlight(item, refresh) {
        if (_hoverHighlightAnimFrame !== null) {
            cancelAnimationFrame(_hoverHighlightAnimFrame);
            _hoverHighlightAnimFrame = null;
        }
        _hoverFlashData = null;          // 清除臨時 override，BeforeDraw 不再套用
        _hoverHighlightStartTime = null;
        if (refresh) {
            const _rc = CharacterAppearanceSelection || _aeeItemColorChar;
            if (_rc) { try { CharacterLoadCanvas(_rc); } catch(e) {} }
        }
    }

    // ── 角色身上衣服閃爍（BC Appearance 部件列表）──
    let _hoverCharGroup = null;
    let _hoverCharActive = false;
    let _hoverCharHiddenGroup = new Set(); // 僅供 fallback 硬切使用
    let _hoverCharAnimFrame = null;
    let _hoverCharTimer = null;
    let _hoverCharStartTime = null;
    let _hoverCharOriginalOpacities = new Map();

    function _startHoverCharHighlight(groupName) {
        _hoverCharStartTime = performance.now();
        const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
        if (!C) return;

        const item = typeof InventoryGet === 'function' ? InventoryGet(C, groupName) : null;
        if (!item) { _startHoverCharHighlightFallback(groupName); return; }

        // 0.7.6 方式：透過 _hoverCharFlashData + BeforeDraw 臨時 override，不碰 Property.Opacity
        const layerCount = item.Asset?.Layer?.length || 1;

        function animate() {
            if (!_hoverCharActive || _hoverCharGroup !== groupName) return;
            const t = ((performance.now() - _hoverCharStartTime) % 1500) / 1500;
            const opacity = 0.2 + 0.8 * Math.abs(Math.cos(t * Math.PI));
            const overrides = new Map();
            for (let i = 0; i < layerCount; i++) overrides.set(i, opacity);
            _hoverCharFlashData = { item, overrides };
            if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
            _hoverCharAnimFrame = requestAnimationFrame(animate);
        }
        _hoverCharActive = true;
        _hoverCharAnimFrame = requestAnimationFrame(animate);
    }

    // fallback：item 為 None 時改用顯示/隱藏交替（透過 CharacterAppearanceVisible hook）
    function _startHoverCharHighlightFallback(groupName) {
        const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
        const blink = () => {
            if (_hoverCharGroup !== groupName) return;
            if (_hoverCharHiddenGroup.has(groupName)) _hoverCharHiddenGroup.delete(groupName);
            else _hoverCharHiddenGroup.add(groupName);
            if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
            _hoverCharTimer = setTimeout(blink, _hoverCharHiddenGroup.has(groupName) ? 200 : 800);
        };
        _hoverCharHiddenGroup.add(groupName);
        if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
        _hoverCharTimer = setTimeout(blink, 200);
    }

    function _stopHoverCharHighlight() {
        _hoverCharActive    = false;
        _hoverCharFlashData = null;    // 清除臨時 override
        _hoverCharGroup     = null;
        _hoverCharStartTime = null;
        _hoverCharHiddenGroup.clear();
        if (_hoverCharAnimFrame !== null) { cancelAnimationFrame(_hoverCharAnimFrame); _hoverCharAnimFrame = null; }
        if (_hoverCharTimer     !== null) { clearTimeout(_hoverCharTimer);             _hoverCharTimer     = null; }
        const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
        if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
    }

    // fallback 用：攔截 CharacterAppearanceVisible 隱藏對應部件
    modApi.hookFunction("CharacterAppearanceVisible", 1, (args, next) => {
        if (!state.hoverHighlightChar) return next(args);
        const C = args[0];
        const groupName = args[2];
        const isAppearanceChar = typeof CharacterAppearanceSelection !== 'undefined'
            && CharacterAppearanceSelection === C;
        if (isAppearanceChar && _hoverCharGroup && groupName === _hoverCharGroup
            && _hoverCharHiddenGroup.has(groupName)) {
            return false;
        }
        return next(args);
    });

    // ============================================================
    // DATA HELPERS
    // ============================================================

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

    // Opacity 架構：
    //   Property.Opacity[i]        ← BC 實際渲染值
    //   LayerOverrides[i].Opacity  ← AEE 設定值（同步寫入 Property.Opacity）
    //   "整件" 是快捷鍵，對所有 slot 同時操作，無獨立儲存欄位
    function _ensureOpacityArray(item) {
        const layerCount = item.Asset?.Layer?.length || 1;
        if (!Array.isArray(item.Property.Opacity) || item.Property.Opacity.length !== layerCount) {
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
        if (_aeeItemColorChar) _aeeItemColorDirty = true;

        if (key === 'Opacity') {
            _ensureOpacityArray(item);
            indices.forEach(i => {
                const layer = item.Asset?.Layer?.[i];
                const clamped = Math.min(Math.max(val, layer?.MinOpacity ?? 0), layer?.MaxOpacity ?? 1);
                if (!item.Property.LayerOverrides[i]) item.Property.LayerOverrides[i] = {};
                item.Property.LayerOverrides[i].Opacity = clamped;
                if (i < item.Property.Opacity.length) item.Property.Opacity[i] = clamped;
            });
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
            const _rc = CharacterAppearanceSelection || _aeeItemColorChar;
            if (_rc) {
                CharacterRefresh(_rc, false, false);
                if (_aeeItemColorChar) {
                    _aeeItemColorDirty = true;
                    try { if (typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(_aeeItemColorChar); } catch(e) {}
                }
            }
        }
    }

    function getOpacity(item, idx) {
        if (idx === 'all') {
            const count = item?.Asset?.Layer?.length || 1;
            let commonVal = null;
            for (let i = 0; i < count; i++) {
                const lo = item?.Property?.LayerOverrides?.[i];
                const v  = lo?.Opacity ?? (Array.isArray(item.Property?.Opacity) ? item.Property.Opacity[i] : 1) ?? 1;
                if (i === 0) commonVal = v;
                else if (Math.abs(v - commonVal) > 0.005) return null;
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
            for (let i = 0; i < count; i++) { item.Property.Color[i] = hexColor; item.Color[i] = hexColor; }
        } else {
            while (item.Property.Color.length <= idx) item.Property.Color.push('#FFFFFF');
            while (item.Color.length <= idx) item.Color.push('#FFFFFF');
            item.Property.Color[idx] = hexColor;
            item.Color[idx] = hexColor;
        }
        { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    }

    function updateColorUI(layerIdx, hex) {
        if (!shadowRoot) return;
        shadowRoot.querySelectorAll(`[data-color-edit="${layerIdx}"] .color-chip-inner`).forEach(el => { el.style.background = hex; });
        shadowRoot.querySelectorAll(`[data-color-dot="${layerIdx}"]`).forEach(el => { el.style.background = hex; });
        if (layerIdx === 'all') {
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
        tab: 'edit', selectedLayer: null, collapsed: false, activeDrag: null, scaleLock: true,
        hoverHighlight: false, hoverHighlightChar: false,
        hideLscgLayers: false, showCharCtrl: false,
        hideCloseup: false, hideFullbody: false, fullbodyOffsetX: 0,
    };

    const LOCKED_GROUPS = new Set(['BodyUpper','BodyLower','Nipples','Pussy','Head']);
    function getCurrentGroupName() { return getCurrentItem()?.Asset?.Group?.Name ?? null; }
    function isGroupLocked() { return LOCKED_GROUPS.has(getCurrentGroupName()); }

    // ============================================================
    // DRAG — XY
    // ============================================================

    let xyDragState = null;

    function _startXyDrag(e) {
        if (state.activeDrag !== 'xy' || state.selectedLayer === null) return;
        const c = getCanvas(); if (!c) return;
        const r = c.getBoundingClientRect();
        const cx = (e.clientX - r.left) * ((c.width||2000)/r.width);
        const cy = (e.clientY - r.top)  * ((c.height||1000)/r.height);
        if (cx < 300 || cx > 1700 || cy < 50 || cy > 950) return;
        const item = getCurrentItem(); if (!item) return;
        const lo = getLO(item, state.selectedLayer);
        const layerI = state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer);
        const baseLeft = item.Asset?.Layer?.[layerI]?.DrawingLeft;
        const baseTop  = item.Asset?.Layer?.[layerI]?.DrawingTop;
        xyDragState = {
            layerIdx: state.selectedLayer,
            startX: e.clientX, startY: e.clientY,
            origX: lo.DrawingLeft?.[""] ?? (typeof baseLeft === 'object' ? (baseLeft?.['']??0) : (baseLeft??0)),
            origY: lo.DrawingTop?.[""]  ?? (typeof baseTop  === 'object' ? (baseTop?.[''] ??0) : (baseTop ??0)),
            flipX: !!lo.FlipX, flipY: !!lo.FlipY,
        };
        e.stopImmediatePropagation();
    }

    document.addEventListener('mousedown', e => {
        if (hostEl && hostEl.contains(e.target)) return;
        if (colorPickerHostEl && colorPickerHostEl.contains(e.target)) return;
        if (e.target === _touchBlocker) return;
        _startXyDrag(e);
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
        scaleDragState = { layerIdx: state.selectedLayer, startX: e.clientX, startY: e.clientY, origSX: lo.ScaleX??1, origSY: lo.ScaleY??1 };
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
        skewDragState = { layerIdx: state.selectedLayer, startX: e.clientX, startY: e.clientY, origSX: lo.SkewX ?? 0, origSY: lo.SkewY ?? 0 };
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

    // ============================================================
    // OPACITY OVERLAY（收納模式的浮動透明度調整面板）
    // ============================================================

    let opOverlayHost = null;
    let opShadow = null;
    const OP_BASE_CX = 0.50, OP_BASE_CY = 0.97, OP_OFFSET_X = 300, OP_OFFSET_Y = -200;
    let _opDrag = null;
    let _opCustomOffset = null;

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
          position:absolute; display:flex; flex-direction:column; align-items:center; gap:5px;
          background:rgba(15,10,40,0.88); border:1px solid rgba(124,106,247,0.4);
          border-radius:10px; padding:6px 14px 10px; pointer-events:all;
          backdrop-filter:blur(6px); transform:translateX(-50%); min-width:200px;
        }
        #op-drag-handle { width:100%; height:16px; cursor:grab; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.25); font-size:11px; letter-spacing:3px; margin-bottom:-2px; }
        #op-drag-handle:active { cursor:grabbing; }
        #op-title { font-family:'Segoe UI',sans-serif; font-size:11px; font-weight:600; color:rgba(255,255,255,0.55); letter-spacing:.04em; text-align:center; }
        #op-val-label { font-family:'Segoe UI',sans-serif; font-size:14px; font-weight:700; color:#fff; text-align:center; min-width:42px; }
        #op-row { display:flex; align-items:center; gap:6px; }
        .op-step-btn { width:22px; height:22px; border-radius:5px; border:1px solid rgba(124,106,247,0.4); background:rgba(124,106,247,0.15); color:#fff; font-size:14px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; pointer-events:all; flex-shrink:0; }
        .op-step-btn:hover { background:rgba(124,106,247,0.35); }
        #op-slider { -webkit-appearance:none; appearance:none; width:140px; height:6px; border-radius:3px; outline:none; cursor:pointer; background:linear-gradient(to right, rgba(124,106,247,0.9) var(--pct,100%), rgba(255,255,255,0.15) var(--pct,100%)); pointer-events:all; }
        #op-slider::-webkit-slider-thumb { -webkit-appearance:none; width:15px; height:15px; border-radius:50%; background:#7c6af7; border:2px solid #fff; cursor:pointer; }
        #op-close { position:absolute; top:3px; right:7px; background:none; border:none; color:rgba(255,255,255,0.3); font-size:13px; cursor:pointer; line-height:1; pointer-events:all; }
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

        const shadow = opShadow;
        const slider = shadow.getElementById('op-slider');
        const valLbl = shadow.getElementById('op-val-label');

        function syncUI(val) { slider.value = val; valLbl.textContent = val + '%'; slider.style.setProperty('--pct', val + '%'); }
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

        const handle = shadow.getElementById('op-drag-handle');
        handle.addEventListener('pointerdown', ev => {
            ev.preventDefault();
            handle.setPointerCapture(ev.pointerId);
            const panel = shadow.getElementById('op-panel');
            _opDrag = { startX: ev.clientX, startY: ev.clientY, startPX: parseFloat(panel.style.left)||0, startPY: parseFloat(panel.style.top)||0 };
        });
        handle.addEventListener('pointermove', ev => {
            if (!_opDrag) return;
            const panel = shadow.getElementById('op-panel');
            panel.style.left = (_opDrag.startPX + ev.clientX - _opDrag.startX) + 'px';
            panel.style.top  = (_opDrag.startPY + ev.clientY - _opDrag.startY) + 'px';
            _opCustomOffset = { x: parseFloat(panel.style.left), y: parseFloat(panel.style.top) };
        });
        handle.addEventListener('pointerup',     () => { _opDrag = null; });
        handle.addEventListener('pointercancel', () => { _opDrag = null; });
    }

    function alignOpOverlay() {
        if (!opOverlayHost) return;
        const r = getCanvasRect(); if (!r) return;
        opOverlayHost.style.left = r.left + 'px'; opOverlayHost.style.top = r.top + 'px';
        opOverlayHost.style.width = r.width + 'px'; opOverlayHost.style.height = r.height + 'px';
        if (!_opCustomOffset) {
            const panel = opShadow?.getElementById('op-panel');
            if (panel) { panel.style.left = (r.width * OP_BASE_CX + OP_OFFSET_X) + 'px'; panel.style.top = (r.height * OP_BASE_CY + OP_OFFSET_Y) + 'px'; }
        }
    }

    function showOpOverlay() {
        buildOpOverlay(); alignOpOverlay();
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const lo  = getLO(item, state.selectedLayer);
        const val = Math.round((lo.Opacity ?? 1) * 100);
        const shadow = opShadow;
        shadow.getElementById('op-slider').value = val;
        shadow.getElementById('op-val-label').textContent = val + '%';
        shadow.getElementById('op-slider').style.setProperty('--pct', val + '%');
        shadow.getElementById('op-overlay').classList.add('on');
        opOverlayHost.style.pointerEvents = 'auto';
    }

    function hideOpOverlay() {
        opShadow?.getElementById('op-overlay')?.classList.remove('on');
        if (opOverlayHost) opOverlayHost.style.pointerEvents = 'none';
        updateToggleIcons();
    }

    function updateOpacityTab() {
        if (!shadowRoot) return;
        const item = getCurrentItem(); if (!item) return;
        shadowRoot.querySelectorAll('[data-op-layer]:not([data-op-layer="all"])').forEach(el => {
            const idx = el.dataset.opLayer;
            const v   = getOpacity(item, idx) ?? 1;
            const val = Math.round(v * 100);
            el.value  = val;
            const label = shadowRoot.getElementById('op-val-' + idx);
            if (label) label.textContent = val + '%';
        });
        const allSlider = shadowRoot.querySelector('[data-op-layer="all"]');
        const allLabel  = shadowRoot.getElementById('op-val-all');
        const allV      = getOpacity(item, 'all');
        if (allSlider) allSlider.value = allV === null ? 100 : Math.round(allV * 100);
        if (allLabel)  allLabel.textContent = allV === null ? '—' : Math.round(allV * 100) + '%';
        const lo2 = getLO(item, state.selectedLayer ?? 'all');
        const opEl = shadowRoot.getElementById('edit-op-val');
        if (opEl) opEl.textContent = Math.round((lo2.Opacity ?? 1) * 100) + '%';
        const opRange = shadowRoot.querySelector('[data-edit-op]');
        if (opRange) opRange.value = Math.round((lo2.Opacity ?? 1) * 100);
        if (opShadow?.getElementById('op-overlay')?.classList.contains('on')) {
            const v2  = getOpacity(item, state.selectedLayer ?? 'all');
            const pct = v2 === null ? 100 : Math.round(v2 * 100);
            const sl  = opShadow.getElementById('op-slider');
            const lb  = opShadow.getElementById('op-val-label');
            if (sl) { sl.value = pct; sl.style.setProperty('--pct', pct + '%'); }
            if (lb)  lb.textContent = v2 === null ? '—' : pct + '%';
        }
    }

    // ============================================================
    // TOUCH / CLICK BLOCKER
    // BC canvas 用 capture:true 監聽，普通 overlay 攔不住，需在 capture 層搶先攔截
    // z-index: BC canvas(0) < touchBlocker(5000) < hostEl(999998) < rotOverlay(999997) < opOverlay(999996) < colorPicker(1000000)
    // ============================================================

    let _touchBlocker = null;

    function _buildTouchBlocker() {
        if (_touchBlocker) return;
        _touchBlocker = document.createElement('div');
        _touchBlocker.style.cssText = 'position:fixed;z-index:5000;pointer-events:none;background:transparent;touch-action:none;cursor:default;';
        document.body.appendChild(_touchBlocker);
    }

    function _alignTouchBlocker() {
        if (!_touchBlocker) return;
        const r = getCanvasRect(); if (!r) return;
        _touchBlocker.style.left = r.left + 'px'; _touchBlocker.style.top = r.top + 'px';
        _touchBlocker.style.width = r.width + 'px'; _touchBlocker.style.height = r.height + 'px';
    }

    function _updateBlockerCursor() {
        if (!_touchBlocker) return;
        const cursors = { xy:'grab', rot:'crosshair', scale:'nwse-resize', skew:'ew-resize' };
        _touchBlocker.style.cursor = cursors[state.activeDrag] || 'default';
    }

    function showTouchBlocker() {
        _buildTouchBlocker(); _alignTouchBlocker();
        _touchBlocker.style.display = state.activeDrag ? 'block' : 'none';
        _updateBlockerCursor();
    }

    function hideTouchBlocker() { if (_touchBlocker) _touchBlocker.style.display = 'none'; }

    function _shouldIntercept(e) {
        if (!_aeeIsEditing()) return false;
        const ourHosts = [hostEl, rotOverlayHost, opOverlayHost, colorPickerHostEl, _touchBlocker];
        for (const h of ourHosts) { if (h && h.contains(e.target)) return false; }
        if (e.target?.closest?.('.screen-main-container, .screen-main, fieldset[name="color-picker"]')) return false;
        if (e.target?.closest?.('[role="menu"], [role="menuitem"], [role="radiogroup"]')) return false;
        const cx = e.clientX ?? e.touches?.[0]?.clientX;
        const cy = e.clientY ?? e.touches?.[0]?.clientY;
        if (cx == null || cy == null) return false;
        const canvas = getCanvas();
        const r = canvas?.getBoundingClientRect();
        if (!r) return false;
        const gw = canvas.width || 2000, gh = canvas.height || 1000;
        const sx = r.width / gw, sy = r.height / gh;
        if (cx < r.left + 300*sx || cx > r.left + 1700*sx || cy < r.top + 50*sy || cy > r.top + 950*sy) return false;
        return true;
    }

    const _interceptOpts = { capture: true };
    const _interceptOptsPassive = { capture: true, passive: false };

    document.addEventListener('pointerdown', e => { if (!_shouldIntercept(e)) return; e.stopImmediatePropagation(); if (state.activeDrag === 'xy') _startXyDrag(e); }, _interceptOpts);
    document.addEventListener('pointerup',   e => { if (!_shouldIntercept(e)) return; e.stopImmediatePropagation(); _updateBlockerCursor(); }, _interceptOpts);
    document.addEventListener('mousedown',   e => { if (!_shouldIntercept(e)) return; e.stopImmediatePropagation(); if (state.activeDrag === 'xy') _startXyDrag(e); }, _interceptOpts);
    document.addEventListener('mouseup',     e => { if (!_shouldIntercept(e)) return; if (rotDragState) return; e.stopImmediatePropagation(); _updateBlockerCursor(); }, _interceptOpts);
    document.addEventListener('touchstart',  e => { if (!_shouldIntercept(e)) return; e.stopImmediatePropagation(); }, _interceptOptsPassive);

    // ============================================================
    // ROTATION OVERLAY
    // ============================================================

    let rotOverlayHost = null;
    let rotShadow = null;
    let rotDragState = null;
    const ROT_CX_PCT = 0.50, ROT_CY_PCT = 0.89, ROT_RADIUS = 60;

    function buildRotOverlay() {
        if (rotOverlayHost) return;
        rotOverlayHost = document.createElement('div');
        rotOverlayHost.style.cssText = 'position:fixed;z-index:999997;pointer-events:none;';
        document.body.appendChild(rotOverlayHost);
        rotShadow = rotOverlayHost.attachShadow({ mode: 'open' });
        rotShadow.innerHTML = `
      <style>
        :host { all:initial; display:block; } * { user-select:none; -webkit-user-select:none; }
        #rot-overlay { position:absolute; display:none; pointer-events:none; }
        #rot-overlay.on { display:block; }
        svg { overflow:visible; pointer-events:none; }
        #rot-hit { fill:rgba(0,0,0,0.01); stroke:transparent; stroke-width:28; cursor:crosshair; pointer-events:all; }
        #rot-ring-bg { fill:rgba(0,0,0,0.3); stroke:rgba(124,106,247,0.25); stroke-width:1; pointer-events:none; }
        #rot-ring    { fill:none; stroke:rgba(124,106,247,0.6); stroke-width:2; pointer-events:none; }
        #rot-line    { stroke:rgba(124,106,247,0.7); stroke-width:1.5; stroke-dasharray:5 3; pointer-events:none; }
        #rot-handle  { fill:#7c6af7; stroke:#fff; stroke-width:2; pointer-events:none; }
        #rot-label   { font-family:'Segoe UI',sans-serif; font-size:14px; font-weight:700; fill:#fff; text-anchor:middle; dominant-baseline:central; pointer-events:none; }
        #rot-hint    { font-family:'Segoe UI',sans-serif; font-size:11px; fill:rgba(255,255,255,0.45); text-anchor:middle; pointer-events:none; }
        #rot-center  { fill:rgba(124,106,247,0.5); pointer-events:none; }
      </style>
      <div id="rot-overlay">
        <svg id="rot-svg" width="1" height="1">
          <circle id="rot-ring-bg"/><circle id="rot-ring"/><line id="rot-line"/>
          <circle id="rot-handle"/><text id="rot-label"/><text id="rot-hint"/>
          <circle id="rot-center" r="4"/><circle id="rot-hit"/>
        </svg>
      </div>`;
        rotShadow.getElementById('rot-hit').addEventListener('mousedown', onRotHandleDown);
    }

    function alignRotOverlay() {
        if (!rotOverlayHost) return;
        const r = getCanvasRect(); if (!r) return;
        rotOverlayHost.style.left = r.left + 'px'; rotOverlayHost.style.top = r.top + 'px';
        rotOverlayHost.style.width = r.width + 'px'; rotOverlayHost.style.height = r.height + 'px';
        const svg = rotShadow?.getElementById('rot-svg');
        if (svg) { svg.setAttribute('width', r.width); svg.setAttribute('height', r.height); }
    }

    function _rotCenter() {
        const r = getCanvasRect(); if (!r) return { cx: 0, cy: 0 };
        return { cx: r.width * ROT_CX_PCT, cy: r.height * ROT_CY_PCT };
    }

    function updateRotOverlay(rotDeg) {
        if (!rotShadow) return;
        const { cx, cy } = _rotCenter();
        const rad = rotDeg * Math.PI / 180;
        const hx = cx + ROT_RADIUS * Math.sin(rad), hy = cy - ROT_RADIUS * Math.cos(rad);
        const setA = (id, attrs) => {
            const el = rotShadow.getElementById(id); if (!el) return;
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        };
        setA('rot-ring-bg', { cx, cy, r: ROT_RADIUS }); setA('rot-ring', { cx, cy, r: ROT_RADIUS });
        setA('rot-hit', { cx, cy, r: ROT_RADIUS }); setA('rot-line', { x1: cx, y1: cy, x2: hx, y2: hy });
        setA('rot-handle', { cx: hx, cy: hy, r: 9 }); setA('rot-center', { cx, cy });
        const label = rotShadow.getElementById('rot-label');
        if (label) { label.setAttribute('x', cx); label.setAttribute('y', cy); label.textContent = Math.round(rotDeg) + '°'; }
        const hint = rotShadow.getElementById('rot-hint');
        if (hint) { hint.setAttribute('x', cx); hint.setAttribute('y', cy + ROT_RADIUS + 18); hint.textContent = t('rotHint'); }
    }

    function showRotOverlay() {
        buildRotOverlay(); alignRotOverlay();
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const lo = getLO(item, state.selectedLayer);
        updateRotOverlay(lo.Rotation ?? 0);
        rotShadow.getElementById('rot-overlay').classList.add('on');
        rotOverlayHost.style.pointerEvents = 'none';
    }

    function hideRotOverlay() { rotShadow?.getElementById('rot-overlay')?.classList.remove('on'); }

    function _calcAngle(clientX, clientY) {
        const r = getCanvasRect(); if (!r) return 0;
        const cx = r.left + r.width * ROT_CX_PCT, cy = r.top + r.height * ROT_CY_PCT;
        let angle = Math.atan2(clientX - cx, -(clientY - cy)) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        return Math.round(angle);
    }

    function onRotHandleDown(e) {
        e.preventDefault(); e.stopPropagation();
        const angle = _calcAngle(e.clientX, e.clientY);
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        setLO(item, state.selectedLayer, 'Rotation', angle);
        updateRotOverlay(angle); updateEditSection();
        rotDragState = true;
        const onMove = (ev) => {
            const a = _calcAngle(ev.clientX, ev.clientY);
            const item2 = getCurrentItem(); if (!item2 || state.selectedLayer === null) return;
            setLO(item2, state.selectedLayer, 'Rotation', a);
            updateRotOverlay(a); updateEditSection();
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
#cp-outer { position:fixed; z-index:100; display:none; }
#cp-outer.open { display:block; }
#cp-outer-flex { display:inline-flex; align-items:center; }
#cp-collapse-btn {
  display:none; position:fixed; width:20px; height:48px;
  background:#0d0d0f; border:1px solid #2a2a35; border-right:none;
  border-radius:6px 0 0 6px; cursor:pointer; color:#a0a0b0; font-size:11px;
  align-items:center; justify-content:center; pointer-events:auto; z-index:100001;
}
#cp-collapse-btn:hover { color:#7c6af7; }
#cp-backdrop { position:fixed; inset:0; background:transparent; z-index:-1; }
#cp-wrap {
  display:inline-flex; flex-direction:column; align-items:flex-start; gap:0; position:relative;
  --color-background-primary:#0d0d0f; --color-background-secondary:#161619; --color-background-tertiary:#1e1e23;
  --color-border-primary:#7c6af7; --color-border-secondary:#2a2a35; --color-border-tertiary:#2a2a35;
  --color-text-primary:#ffffff; --color-text-secondary:#a0a0b0;
  --color-accent:#7c6af7; --color-accent2:#4ecdc4;
  --border-radius-lg:12px; --font-sans:'Segoe UI',system-ui,-apple-system,sans-serif; --font-mono:'SF Mono','Fira Mono',monospace;
}
#cp { width:500px; background:var(--color-background-primary); border:1px solid var(--color-border-secondary); border-radius:var(--border-radius-lg); display:flex; flex-direction:column; padding:12px; gap:7px; font-family:var(--font-sans); font-size:13px; color:var(--color-text-primary); box-shadow:0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,106,247,0.15); }
#cp-footer-row { display:flex; gap:8px; padding-top:6px; border-top:1px solid var(--color-border-tertiary); }
.cp-footer-btn { flex:1; padding:9px; border:1px solid var(--color-border-tertiary); border-radius:8px; cursor:pointer; font-size:13px; font-weight:700; font-family:var(--font-sans); letter-spacing:.02em; }
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
        colorPickerHostEl.style.cssText = 'position:fixed;z-index:5000;pointer-events:none;inset:0;';
        document.body.appendChild(colorPickerHostEl);
        colorPickerShadow = colorPickerHostEl.attachShadow({ mode: 'open' });

        colorPickerShadow.innerHTML = `<style>${CP_CSS}</style>
<div id="cp-outer">
  <div id="cp-backdrop"></div>
  <div id="cp-outer-flex">
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
    <button id="cp-collapse-btn">▶</button>
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

        function h2r(h,s,v){s/=100;v/=100;const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;let r=0,g=0,b=0;if(h<60){r=c;g=x}else if(h<120){r=x;g=c}else if(h<180){g=c;b=x}else if(h<240){g=x;b=c}else if(h<300){r=x;b=c}else{r=c;b=x}return[Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];}
        function r2x(r,g,b){return'#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join('')}
        function h2x(h,s,v){return r2x(...h2r(h,s,v))}
        function x2h(hex){const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=0;if(d){if(max===r)h=((g-b)/d+6)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}return{h:Math.round(h),s:Math.round(max?d/max*100:0),v:Math.round(max*100)};}
        function hsvaStr(h,s,v,a){const[r,g,b]=h2r(h,s,v);return`rgba(${r},${g},${b},${(a/255).toFixed(3)})`}
        function setTT(id,pct){sd.getElementById(id).style.left=cl(pct,0,100)+'%'}

        function drawSV(){
            const cvs=sd.getElementById('cp-sv-canvas'),ctx=cvs.getContext('2d');
            const W=cvs.width,H2=cvs.height,base=h2x(cpH,100,100);
            const gH=ctx.createLinearGradient(0,0,W,0);gH.addColorStop(0,'#fff');gH.addColorStop(1,base);
            ctx.fillStyle=gH;ctx.fillRect(0,0,W,H2);
            const gV=ctx.createLinearGradient(0,0,0,H2);gV.addColorStop(0,'rgba(0,0,0,0)');gV.addColorStop(1,'#000');
            ctx.fillStyle=gV;ctx.fillRect(0,0,W,H2);
            const px=cpS/100*W,py=(1-cpV/100)*H2;
            ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
            ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=1;ctx.stroke();
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
            const m={complementary:[[cpH,cpS,cpV],[(cpH+180)%360,cpS,cpV]],triadic:[[cpH,cpS,cpV],[(cpH+120)%360,cpS,cpV],[(cpH+240)%360,cpS,cpV]],analogous:[[cpH,cpS,cpV],[(cpH+30)%360,cpS,cpV],[(cpH+330)%360,cpS,cpV],[(cpH+60)%360,cpS,cpV]],split:[[cpH,cpS,cpV],[(cpH+150)%360,cpS,cpV],[(cpH+210)%360,cpS,cpV]],tetradic:[[cpH,cpS,cpV],[(cpH+90)%360,cpS,cpV],[(cpH+180)%360,cpS,cpV],[(cpH+270)%360,cpS,cpV]]};
            return m[cpRule]||m.complementary;
        }
        function shades(){return[[cpH,cl(cpS-35,0,100),cl(cpV+15,0,100)],[cpH,cl(cpS-15,0,100),cl(cpV+7,0,100)],[cpH,cpS,cpV],[cpH,cl(cpS+12,0,100),cl(cpV-20,0,100)],[cpH,cl(cpS+22,0,100),cl(cpV-38,0,100)]];}
        function rHarm(){const row=sd.getElementById('cp-harm-row');row.innerHTML='';harm().forEach(([h,s,v])=>{const hex=h2x(h,s,v);const d=document.createElement('div');d.className='sw';d.style.background=hex;const tt=document.createElement('div');tt.className='sw-hex';tt.textContent=hex;d.appendChild(tt);d.onclick=()=>setC(h,s,v,cpA);row.appendChild(d);});}
        function rShade(){const row=sd.getElementById('cp-shade-row');row.innerHTML='';shades().forEach(([h,s,v])=>{const hex=h2x(h,s,v);const d=document.createElement('div');d.className='sh';d.style.background=hex;d.title=hex;d.onclick=()=>setC(h,s,v,cpA);row.appendChild(d);});}
        function rSaved(){
            [sd.getElementById('cp-sg1'),sd.getElementById('cp-sg2')].forEach((grid,gi)=>{
                grid.innerHTML='';
                for(let i=0;i<9;i++){
                    const idx=gi*9+i;const c=cpSaved[idx];
                    const cell=document.createElement('div');cell.className='sc'+(idx===cpSelSaved?' sel':'');
                    const inner=document.createElement('div');inner.className='sc-c';inner.style.background=hsvaStr(c.h,c.s,c.v,c.a);
                    cell.appendChild(inner);cell.onclick=()=>{cpSelSaved=idx;setC(c.h,c.s,c.v,c.a);rSaved()};grid.appendChild(cell);
                }
            });
        }
        function updAll(){
            const[r,g,b]=h2r(cpH,cpS,cpV);const hex=r2x(r,g,b);const aPct=Math.round(cpA/255*100);
            sd.getElementById('cp-sw-main').style.background=hsvaStr(cpH,cpS,cpV,cpA);
            sd.getElementById('cp-hex-display').textContent=hex;
            sd.getElementById('cp-hex-in').value=hex;
            sd.getElementById('cp-alp-in').value=aPct+'%';
            sd.getElementById('cp-rv').textContent=String(r).padStart(3,'0');
            sd.getElementById('cp-gv').textContent=String(g).padStart(3,'0');
            sd.getElementById('cp-bv').textContent=String(b).padStart(3,'0');
            sd.getElementById('cp-h-v').value=cpH;sd.getElementById('cp-s-v').value=cpS;sd.getElementById('cp-v-v').value=cpV;
            sd.getElementById('cp-a-v').value=aPct+'%';
            setTT('cp-h-tt',cpH/360*100);setTT('cp-s-tt',cpS);setTT('cp-v-v2',cpV);setTT('cp-a-tt',cpA/255*100);
            updTracks();drawSV();rHarm();rShade();
            const lc = colorPickerHostEl?._cpOnLiveChange;
            if (lc) lc(hex);
        }
        function setC(h,s,v,a){cpH=h;cpS=s;cpV=v;cpA=(a===undefined?cpA:a);updAll();}

        function trk(id,cb){
            const el=sd.getElementById(id);let drag=false;
            function pick(e){const r=el.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;cb(cl((cx-r.left)/r.width,0,1));}
            el.addEventListener('mousedown',e=>{drag=true;pick(e);e.stopPropagation();});
            document.addEventListener('mousemove',e=>{if(drag)pick(e)});
            document.addEventListener('mouseup',()=>drag=false);
        }
        trk('cp-h-tr',p=>{cpH=Math.round(p*360);updAll()});
        trk('cp-s-tr',p=>{cpS=Math.round(p*100);updAll()});
        trk('cp-v-tr',p=>{cpV=Math.round(p*100);updAll()});
        trk('cp-a-tr', p => {
            cpA = Math.round(p * 255); updAll();
            // 同步 BC 原生選色器的 opacity 輸入
            const cpRoot = document.getElementById('color-picker');
            const opInput = cpRoot?.querySelector('input[name="opacity"]');
            if (opInput) {
                opInput.value = String(cpA);
                opInput.dispatchEvent(new Event('input', { bubbles: true }));
                opInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        const svCvs=sd.getElementById('cp-sv-canvas');let svDrag=false;
        function svPick(e){const r=svCvs.getBoundingClientRect();const cx=e.touches?e.touches[0].clientX:e.clientX;const cy=e.touches?e.touches[0].clientY:e.clientY;cpS=Math.round(cl((cx-r.left)/r.width,0,1)*100);cpV=Math.round((1-cl((cy-r.top)/r.height,0,1))*100);updAll();}
        svCvs.addEventListener('mousedown',e=>{svDrag=true;svPick(e);e.stopPropagation();});
        document.addEventListener('mousemove',e=>{if(svDrag)svPick(e)});
        document.addEventListener('mouseup',()=>svDrag=false);

        sd.getElementById('cp-hex-in').addEventListener('change',e=>{const v=e.target.value.trim();if(/^#[0-9a-fA-F]{6}$/.test(v)){const{h,s,v:vv}=x2h(v);setC(h,s,vv,cpA)}});
        sd.getElementById('cp-alp-in').addEventListener('change',e=>{const n=parseInt(e.target.value);if(!isNaN(n)){cpA=Math.round(cl(n,0,100)/100*255);updAll()}});

        function bindVI(id,min,max,setter){
            const el=sd.getElementById(id);
            el.addEventListener('change',e=>{let raw=e.target.value.replace('%','').trim();const n=parseInt(raw);if(!isNaN(n)){setter(cl(n,min,max));updAll()}});
            el.addEventListener('mousedown',e=>e.stopPropagation());
            el.addEventListener('click',e=>e.stopPropagation());
        }
        bindVI('cp-h-v',0,360,v=>cpH=v);bindVI('cp-s-v',0,100,v=>cpS=v);bindVI('cp-v-v',0,100,v=>cpV=v);bindVI('cp-a-v',0,100,v=>cpA=Math.round(v/100*255));

        sd.getElementById('cp-copy-btn').addEventListener('click',()=>{const[r,g,b]=h2r(cpH,cpS,cpV);navigator.clipboard?.writeText(r2x(r,g,b)+(cpA<255?cpA.toString(16).padStart(2,'0'):''));});
        sd.getElementById('cp-paste-btn').addEventListener('click',()=>{navigator.clipboard?.readText().then(txt=>{txt=txt.trim();if(/^#[0-9a-fA-F]{6,8}$/.test(txt)){const{h,s,v}=x2h(txt.slice(0,7));setC(h,s,v,txt.length===9?parseInt(txt.slice(7),16):255);}});});
        sd.getElementById('cp-eye-btn').addEventListener('click',async()=>{if(!window.EyeDropper){return;}try{const ed=new EyeDropper();const r=await ed.open();const{h,s,v}=x2h(r.sRGBHex);setC(h,s,v,cpA);}catch(e){}});
        sd.getElementById('cp-save-btn').addEventListener('click',()=>{cpSaved[cpSelSaved]={h:cpH,s:cpS,v:cpV,a:cpA};rSaved()});
        sd.getElementById('cp-clr-btn').addEventListener('click',()=>{cpSaved[cpSelSaved]={h:0,s:0,v:100,a:255};rSaved()});
        sd.querySelectorAll('[data-r]').forEach(btn=>{btn.addEventListener('click',()=>{sd.querySelectorAll('[data-r]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');cpRule=btn.dataset.r;updAll();});});

        sd.getElementById('cp-collapse-btn').addEventListener('click', () => {
            const wrap = sd.getElementById('cp-wrap');
            const btn  = sd.getElementById('cp-collapse-btn');
            const isCollapsed = wrap.style.display === 'none';
            wrap.style.display = isCollapsed ? '' : 'none';
            btn.textContent    = isCollapsed ? '▶' : '◀';
            positionColorPicker();
            // hgroup 跟著收納/展開（同 0.7.7-3）
            const hgroup = document.getElementById('color-picker-hgroup');
            if (hgroup) hgroup.style.display = isCollapsed ? '' : 'none';
        });

        sd.getElementById('cp-confirm').addEventListener('click', () => {
            const [r,g,b] = h2r(cpH,cpS,cpV);
            const hex = r2x(r,g,b);
            const lc = colorPickerHostEl?._cpOnLiveChange;
            if (colorPickerHostEl?._cpIsBCMode) { if (lc) lc(hex); }
            else { closeColorPicker(); if (lc) lc(hex); _aeeRestoreBCColorPicker(); }
        });

        function doCancel() {
            const initHex = colorPickerHostEl?._cpInitialHex;
            const lc = colorPickerHostEl?._cpOnLiveChange;
            if (colorPickerHostEl?._cpIsBCMode) { if (lc && initHex) lc(initHex); }
            else { closeColorPicker(); if (lc && initHex) lc(initHex); _aeeRestoreBCColorPicker(); }
        }
        sd.getElementById('cp-cancel').addEventListener('click', doCancel);
        sd.getElementById('cp-backdrop').addEventListener('click', doCancel);

        colorPickerHostEl._cpSetColor = (hex, opacityPct) => {
            const a = opacityPct !== undefined ? Math.round(opacityPct / 100 * 255) : 255;
            if (/^#[0-9a-fA-F]{6}$/.test(hex)) { const{h,s,v}=x2h(hex);setC(h,s,v,a); }
            else { setC(220,70,90,a); }
            rSaved();
        };
        colorPickerHostEl._getCpA = () => cpA;
        rSaved(); updAll();
    }

    function positionPanel() {
        if (!shadowRoot) return;
        const panel = shadowRoot.getElementById('panel'); if (!panel) return;
        const r = getCanvasRect(); if (!r) return;
        const clampedW = Math.max(200, Math.min(320, r.width * 0.27));
        panel.style.width = clampedW + 'px';
    }

    function positionColorPicker() {
        if (!colorPickerShadow) return;
        const outer = colorPickerShadow.getElementById('cp-outer');
        const wrap  = colorPickerShadow.getElementById('cp-wrap');
        const btn   = colorPickerShadow.getElementById('cp-collapse-btn');
        if (!outer || !wrap) return;

        const r = getCanvasRect();
        if (!r) { wrap.style.zoom = ''; outer.style.left = '66%'; outer.style.top = '20%'; return; }

        const scale     = (r.width * 0.33) / 500;
        const outerLeft = r.left + r.width * 0.66;
        const outerTop  = r.top  + r.height * 0.20;

        wrap.style.zoom = scale;
        wrap.style.transform = ''; wrap.style.transformOrigin = '';
        outer.style.left = outerLeft + 'px'; outer.style.top = outerTop + 'px';

        // collapse btn 定位：展開貼在 cp-wrap 左側，收納貼在 canvas 右側，Y 均為 canvas 50%（0.7.7-3 原版）
        if (btn && btn.style.display !== 'none') {
            const isCollapsed = wrap.style.display === 'none';
            btn.style.left = isCollapsed ? (r.right - 20) + 'px' : (outerLeft - 20) + 'px';
            btn.style.top  = (r.top + r.height * 0.5 - 24) + 'px';
        }
    }

    // ── 調色盤拖移（每次開啟重置位置，開著時可拖移）──
    let _cpDragState = null;
    function _initColorPickerDrag() {
        if (!colorPickerShadow) return;
        const outer = colorPickerShadow.getElementById('cp-outer');
        const wrap  = colorPickerShadow.getElementById('cp-wrap');
        const titleRow = colorPickerShadow.getElementById('cp-title-row');
        if (!outer || !wrap || !titleRow) return;
        // 確保 outer 為 relative/fixed，wrap 直接移動
        // 拖移把手：title row
        if (titleRow._cpDragBound) return; // 避免重複綁定
        titleRow._cpDragBound = true;
        titleRow.style.cursor = 'grab';
        titleRow.addEventListener('pointerdown', ev => {
            if (ev.target.closest('#cp-cancel, #cp-confirm, [id$="-btn"]')) return;
            ev.preventDefault();
            titleRow.setPointerCapture(ev.pointerId);
            const or = outer.getBoundingClientRect();
            _cpDragState = { sx: ev.clientX, sy: ev.clientY, ol: or.left, ot: or.top };
            titleRow.style.cursor = 'grabbing';
        });
        titleRow.addEventListener('pointermove', ev => {
            if (!_cpDragState) return;
            const dx = ev.clientX - _cpDragState.sx;
            const dy = ev.clientY - _cpDragState.sy;
            outer.style.left = (_cpDragState.ol + dx) + 'px';
            outer.style.top  = (_cpDragState.ot + dy) + 'px';
        });
        titleRow.addEventListener('pointerup', () => {
            _cpDragState = null; titleRow.style.cursor = 'grab';
        });
        titleRow.addEventListener('pointercancel', () => { _cpDragState = null; });
    }

        function openColorPicker(initialHex, onLiveChange, isBCMode = false) {
        buildColorPicker();
        if (colorPickerHostEl) {
            colorPickerHostEl._cpInitialHex = initialHex || '#FFFFFF';
            colorPickerHostEl._cpOnLiveChange = null;
            colorPickerHostEl._cpIsBCMode = isBCMode;
        }
        colorPickerHostEl._cpSetColor?.(initialHex || '#FFFFFF');
        if (colorPickerHostEl) colorPickerHostEl._cpOnLiveChange = onLiveChange;

        const collapseBtn = colorPickerShadow?.getElementById('cp-collapse-btn');
        if (collapseBtn) {
            collapseBtn.style.display = isBCMode ? 'flex' : 'none';
            collapseBtn.textContent = '▶';
        }
        // collapse-btn：只在 BC 染色模式顯示（0.7.7-3 原版）
        const _cpCollapseBtn = colorPickerShadow?.getElementById('cp-collapse-btn');
        if (_cpCollapseBtn) { _cpCollapseBtn.style.display = isBCMode ? 'flex' : 'none'; _cpCollapseBtn.textContent = '▶'; }
        // 每次開啟強制展開 cp-wrap
        const _cpWrapEl = colorPickerShadow?.getElementById('cp-wrap');
        if (_cpWrapEl) _cpWrapEl.style.display = '';
        // 每次開啟還原 hgroup
        const _hgroupEl = document.getElementById('color-picker-hgroup');
        if (_hgroupEl) _hgroupEl.style.display = '';
        // 每次開啟重置位置（不記憶拖移座標）
        _cpDragOffset = null;
        positionColorPicker();
        colorPickerShadow.getElementById('cp-outer').classList.add('open');
        colorPickerHostEl.style.pointerEvents = 'none';
        colorPickerShadow?.getElementById('cp-outer')?.setAttribute('style', colorPickerShadow.getElementById('cp-outer').getAttribute('style') + ';pointer-events:auto');
        // 每次開啟後初始化拖移（套用在 cp-wrap 上）
        _initColorPickerDrag();
        updateToggleIcons();

        const footerRow = colorPickerShadow?.getElementById('cp-footer-row');
        if (footerRow) footerRow.style.display = isBCMode ? 'none' : 'flex';

        const backdrop = colorPickerShadow?.getElementById('cp-backdrop');
        if (backdrop) backdrop.style.display = isBCMode ? 'none' : '';
        // BC 染色模式：移動 hgroup 避免遮擋
        if (isBCMode) {
            if (_hgroupEl) { _hgroupEl.style.marginLeft = '140px'; _hgroupEl.style.transition = 'margin-left 0.15s'; }
        } else {
            if (_hgroupEl) { _hgroupEl.style.marginLeft = ''; _hgroupEl.style.transition = ''; }
        }
    }

    function _aeeRestoreBCColorPicker() {
        const main = document.getElementById('color-picker-main');
        const originalFieldset = main?.querySelector('fieldset[name="color-picker"]');
        if (!originalFieldset || originalFieldset.style.display !== 'none') return;
        const hexInput = main.querySelector('input[name="output"]');
        const domHex6 = hexInput?.value?.match(/^#[0-9a-fA-F]{6}$/) ? hexInput.value
                      : hexInput?.value?.match(/^#[0-9a-fA-F]{8}$/) ? hexInput.value.slice(0, 7) : '#FFFFFF';
        const idx = state.selectedLayer ?? 'all';
        openColorPicker(domHex6, (hex) => {
            const cpRoot = document.getElementById('color-picker');
            if (!cpRoot) return;
            const opInput = cpRoot.querySelector('input[name="opacity"]');
            const hInput  = cpRoot.querySelector('input[name="output"]');
            if (hInput) { hInput.value = hex; hInput.dispatchEvent(new Event('input', { bubbles: true })); hInput.dispatchEvent(new Event('change', { bubbles: true })); }
            if (opInput) {
                const currentCpA = colorPickerHostEl?._getCpA?.() ?? 255;
                opInput.value = String(currentCpA);
                opInput.dispatchEvent(new Event('input', { bubbles: true })); opInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateColorUI(idx, hex);
        }, true);
        const backdrop = colorPickerShadow?.getElementById('cp-backdrop');
        if (backdrop) backdrop.style.display = 'none';
    }

    function closeColorPicker() {
        const _btnClose = colorPickerShadow?.getElementById('cp-collapse-btn');
        if (_btnClose) _btnClose.style.display = 'none';
        const _cpOuter = colorPickerShadow?.getElementById('cp-outer');
        if (_cpOuter) _cpOuter.style.pointerEvents = '';
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
#panel { position:absolute; left:0; top:0; width:auto; min-width:0; max-width:none; height:100%; background:var(--bg); border-right:1px solid var(--border); color:var(--text); display:flex; flex-direction:column; z-index:999999; overflow:hidden; user-select:none; }
#panel.collapsed { display:none; }
#toggle { position:absolute; top:50%; transform:translateY(-50%); width:25px; background:var(--bg); border:1px solid var(--border); border-left:none; border-radius:0 6px 6px 0; display:flex; flex-direction:column; align-items:center; padding:5px 0; gap:4px; z-index:1000000; }
#toggle-icons { display:none; flex-direction:column; align-items:center; gap:5px; margin-bottom:2px; }
#toggle.show-icons #toggle-icons { display:flex; }
.tgl-icon { width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-dim); transition:color .12s, background .12s; }
.tgl-icon:hover { color:var(--accent1); background:rgba(124,106,247,0.15); }
.tgl-icon.active { color:#a89ef8; background:rgba(124,106,247,0.30); box-shadow:inset -2px 0 0 #7c6af7; }
#toggle-arrow { width:20px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-dim); font-size:11px; transition:color .12s; user-select:none; -webkit-user-select:none; }
#toggle-arrow:hover { color:var(--accent); }
#tabs { display:flex; border-bottom:1px solid var(--border); flex-shrink:0; }
.tab { flex:1; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text-dim); font-size:12px; font-weight:600; letter-spacing:.03em; border-bottom:2px solid transparent; transition:color .15s, border-color .15s; }
.tab:hover { color:var(--text); }
.tab.active { color:var(--accent); border-bottom-color:var(--accent); }
#item-name { padding:5px 10px; font-size:13px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:8px; background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0; min-width:0; }
#item-name-text { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.iname-btn { flex-shrink:0; width:34px; height:34px; background:transparent; border:1px solid var(--border); border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-dim); transition:border-color .12s, color .12s, background .12s; }
.iname-btn:hover { border-color:var(--accent); color:var(--accent); }
#parts-toggle-btn.active { border-color:var(--accent); color:var(--accent); background:rgba(124,106,247,0.12); }
#parts-float { position:absolute; width:200px; min-height:80px; max-height:260px; background:var(--bg); border:1px solid var(--border); border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,0.7); display:none; flex-direction:column; z-index:1000001; pointer-events:auto; overflow:hidden; top:60px; left:10px; }
#parts-float.open { display:flex; }
#parts-float-header { display:flex; align-items:center; justify-content:space-between; padding:5px 8px; background:var(--bg2); border-bottom:1px solid var(--border); cursor:grab; flex-shrink:0; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim); user-select:none; -webkit-user-select:none; }
#parts-float-header:active { cursor:grabbing; }
#parts-float-close { width:16px; height:16px; border-radius:3px; border:none; background:transparent; cursor:pointer; color:var(--text-dim); font-size:13px; line-height:1; display:flex; align-items:center; justify-content:center; transition:color .1s, background .1s; }
#parts-float-close:hover { color:#f87; background:rgba(255,80,80,0.1); }
#parts-float-body { overflow-y:auto; flex:1; padding:5px 6px; user-select:none; -webkit-user-select:none; }
#parts-float-body::-webkit-scrollbar { width:4px; }
#parts-float-body::-webkit-scrollbar-thumb { background:rgba(124,106,247,0.5); border-radius:2px; }
#parts-float-body::-webkit-scrollbar-thumb:hover { background:var(--accent); }
#content { flex:1; overflow-y:auto; }
#content::-webkit-scrollbar { width:4px; }
#content::-webkit-scrollbar-thumb { background:rgba(124,106,247,0.5); border-radius:2px; }
#content::-webkit-scrollbar-thumb:hover { background:var(--accent); }
#content::-webkit-scrollbar-track { background:transparent; }
.section { padding:8px 10px; border-bottom:1px solid var(--border); }
.sec-title { font-size:13px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--text); text-align:center; margin-bottom:6px; }
.color-edit-btn { width:36px; height:54px; border:1.5px solid var(--border); border-radius:5px; cursor:pointer; overflow:hidden; flex-shrink:0; position:relative; background:repeating-conic-gradient(#1a1a1a 0% 25%,#111 0% 50%) 0 0/6px 6px; transition:border-color .12s; }
.color-edit-btn:hover { border-color:var(--accent2); }
.color-edit-inner { position:absolute; inset:0; }
.layer-btn-row { display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.layer-btn { flex:1; padding:6px 10px; background:var(--bg2); border:1px solid var(--border); border-radius:4px; cursor:pointer; color:var(--text); text-align:left; font-size:14px; font-weight:600; transition:border-color .12s, background .12s, color .12s; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; justify-content:space-between; gap:6px; }
.layer-btn:hover { border-color:var(--accent); }
.layer-btn.selected { background:#17143a; border-color:var(--accent); color:var(--accent); }
.layer-btn-label { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; }
.layer-color-dot { width:14px; height:14px; border-radius:3px; flex-shrink:0; border:1px solid rgba(255,255,255,0.15); background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/6px 6px; position:relative; overflow:hidden; }
.layer-color-dot-fill { position:absolute; inset:0; }
.prop-group { margin-bottom:10px; }
.prop-group-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
.prop-group-title { font-size:13px; font-weight:700; color:var(--text); letter-spacing:.03em; }
.drag-check-label { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-dim); cursor:pointer; padding:2px 6px; border:1px solid var(--border); border-radius:3px; transition:border-color .12s, color .12s, background .12s; }
.drag-check-label:hover { border-color:var(--accent2); color:var(--accent2); }
.drag-check-label.active { border-color:var(--accent2); color:var(--accent2); background:rgba(78,205,196,0.08); }
.drag-check-label input { display:none; }
.prop-row { margin-bottom:5px; }
.prop-row-label { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:var(--text-sec); margin-bottom:3px; }
.prop-val-input { color:var(--accent2); font-variant-numeric:tabular-nums; font-size:12px; background:transparent; border:none; border-bottom:1px solid transparent; outline:none; width:56px; text-align:right; cursor:text; transition:border-color .12s; }
.prop-val-input:focus { border-bottom-color:var(--accent2); background:rgba(78,205,196,0.07); border-radius:2px; }
.stepper { display:flex; gap:2px; }
.step { flex:1; height:24px; background:var(--bg3); border:1px solid var(--border); border-radius:3px; color:var(--text); font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .1s, border-color .1s; }
.step:hover { background:var(--accent); border-color:var(--accent); color:#fff; }
.step:active { opacity:.8; }
.step-reset { width:26px; flex:none; height:24px; background:var(--bg3); border:1px solid var(--border); border-radius:3px; color:var(--text-dim); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .1s, border-color .1s, color .1s; }
.step-reset:hover { background:#3a1a1a; border-color:#f87; color:#f87; }
.step-reset:active { opacity:.8; }
.op-group { margin-bottom:10px; }
.op-row-label { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text); margin-bottom:3px; }
.op-row-label span { color:var(--accent2); font-variant-numeric:tabular-nums; }
.range { width:100%; height:3px; appearance:none; background:var(--bg3); border-radius:2px; outline:none; cursor:pointer; }
.range::-webkit-slider-thumb { appearance:none; width:13px; height:13px; border-radius:50%; background:var(--accent); cursor:pointer; border:2px solid var(--bg); }
.scale-lock-btn { flex-shrink:0; width:24px; height:24px; background:transparent; border:1px solid var(--border); border-radius:3px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-dim); transition:border-color .12s, color .12s, background .12s; transform:rotate(90deg); user-select:none; -webkit-user-select:none; }
.scale-lock-btn:hover { border-color:var(--accent2); color:var(--accent2); }
.scale-lock-btn.locked { border-color:var(--accent2); color:var(--accent2); background:rgba(78,205,196,0.12); }
.mirror-grid { display:flex; gap:8px; margin-top:4px; }
.mirror-group { flex:1; }
.mirror-group-title { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-dim); text-align:center; margin-bottom:4px; }
.mirror-pair { display:flex; gap:4px; }
.mirror-btn { flex:1; height:28px; background:var(--bg2); border:1.5px solid var(--border); border-radius:4px; color:var(--text-sec); font-size:11px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:border-color .12s, color .12s, background .12s; }
.mirror-btn:hover { border-color:var(--accent); }
.mirror-btn.active { background:#17143a; border-color:var(--accent); color:var(--accent); }
.op-tab-row { padding:6px 10px; border-bottom:1px solid var(--border); }
.op-tab-name { display:flex; align-items:center; justify-content:space-between; font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px; }
.op-tab-val { color:var(--accent2); font-variant-numeric:tabular-nums; }
.op-step-row { display:flex; align-items:center; gap:3px; flex-shrink:0; }
.op-step { width:26px; height:20px; background:var(--bg3); border:1px solid var(--border); border-radius:3px; color:var(--text); font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .1s, border-color .1s; user-select:none; flex-shrink:0; }
.op-step:hover { background:var(--accent); border-color:var(--accent); color:#fff; }
.op-step:active { opacity:.8; }
.op-val-display { color:var(--accent2); font-variant-numeric:tabular-nums; font-size:12px; min-width:32px; text-align:center; flex-shrink:0; }
.sec-title-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.color-chip { width:40px; height:22px; border:1px solid var(--border); border-radius:3px; cursor:pointer; flex-shrink:0; position:relative; overflow:hidden; background:repeating-conic-gradient(#1a1a1a 0% 25%,#111 0% 50%) 0 0/5px 5px; transition:border-color .12s; }
.color-chip:hover { border-color:var(--accent2); }
.color-chip-inner { position:absolute; inset:0; }
.layer-pri-row { display:flex; align-items:center; gap:6px; padding:6px 10px; border-bottom:1px solid var(--border); }
.layer-pri-name { flex:1; font-size:13px; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pri-input { width:44px; text-align:center; background:var(--bg3); border:1px solid var(--border); border-radius:3px; color:var(--accent2); font-size:12px; padding:3px 4px; outline:none; user-select:text; -webkit-user-select:text; }
.pri-input:focus { border-color:var(--accent2); }
.settings-empty { padding:28px 14px; text-align:center; color:var(--text-dim); font-size:14px; line-height:1.7; white-space:pre-line; }
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
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-xy" data-drag-toggle="xy" title="${isZh()?'座標':'Position'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 2v12M2 8h12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-rot" data-drag-toggle="rot" title="${isZh()?'旋轉':'Rotate'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.25 12.76A5.5 5.5 0 1 1 10.75 3.24"/><path d="M10.75 3.24A5.5 5.5 0 0 1 5.25 12.76" stroke-dasharray="2 1.8"/><polyline points="13,3.5 10.75,3.24 12,5.2"/><rect x="6.3" y="6.3" width="3.4" height="3.4" transform="rotate(45 8 8)" fill="currentColor" stroke="none"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-scale" data-drag-toggle="scale" title="${isZh()?'縮放':'Scale'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6V1h5M10 1h5v5M15 10v5h-5M6 15H1v-5"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-skew" data-drag-toggle="skew" title="${isZh()?'傾斜':'Skew'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h6M5 3h6"/><line x1="3" y1="13" x2="5" y2="3"/><line x1="9" y1="13" x2="11" y2="3"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-colorpicker" data-tgl-action="open-colorpicker" title="${isZh()?'調色':'Color Picker'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(45 6.5 6.5)"><rect x="2.5" y="2.5" width="8" height="8" rx="0.8" fill="currentColor"/><path d="M2.9 6.5 L2.9 3.3 Q2.9 2.9 3.3 2.9 L9.2 2.9 Q9.6 2.9 9.6 3.3 Z" fill="var(--bg,#1a1a2e)"/></g><ellipse cx="13.2" cy="13.2" rx="1.3" ry="1.6" fill="currentColor"/><line x1="10.2" y1="10.2" x2="12.2" y2="12.0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-opacity" data-tgl-action="open-opacity" title="${isZh()?'透明度':'Opacity'}">
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" rx="2" fill="rgba(255,255,255,0.2)"/><rect x="0" y="0" width="8" height="8" fill="currentColor" opacity="0.7"/><rect x="8" y="8" width="8" height="8" fill="currentColor" opacity="0.7"/><rect width="16" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.4"/></svg>
        </div>
        <div class="tgl-icon" id="tgl-reset" data-tgl-action="reset-transform" title="${isZh()?'重置座標/旋轉/縮放':'Reset transforms'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8A5 5 0 1 0 4 4.5"/><path d="M1 2v3h3"/><line x1="8" y1="5" x2="8" y2="8"/><line x1="8" y1="8" x2="10" y2="10"/></svg>
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
                if (state.activeDrag === 'rot') showRotOverlay(); else hideRotOverlay(); hideTouchBlocker();
                if (state.activeDrag) showTouchBlocker(); else hideTouchBlocker();
                updateToggleIcons(); return;
            }
            const actionIcon = e.target.closest('[data-tgl-action]');
            if (!actionIcon) return;
            const action = actionIcon.dataset.tglAction;
            if (action === 'open-opacity') {
                const isOn = opShadow?.getElementById('op-overlay')?.classList.contains('on');
                if (isOn) hideOpOverlay(); else showOpOverlay();
                updateToggleIcons(); return;
            }
            if (action === 'open-colorpicker') {
                const item = getCurrentItem();
                const idx  = state.selectedLayer ?? 'all';
                const cur  = getLayerColor(item, idx) || '#FFFFFF';
                openColorPicker(cur, (hex) => { if (!item) return; setLayerColor(item, idx, hex); updateColorUI(idx, hex); });
                return;
            }
            if (action === 'open-panel') {
                const pf  = shadowRoot?.getElementById('parts-float');
                const btn = shadowRoot?.getElementById('parts-toggle-btn');
                if (!pf) return;
                if (pf.classList.contains('open')) { pf.classList.remove('open'); btn?.classList.remove('active'); }
                else { pf.classList.add('open'); btn?.classList.add('active'); updatePartsPanel(); }
                updateToggleIcons();
            } else if (action === 'reset-transform') {
                const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
                const idx = state.selectedLayer;
                const _li = idx === 'all' ? null : parseInt(idx);
                if (item.Property?.LayerOverrides) {
                    if (_li === null) item.Property.LayerOverrides.forEach(l => l && (delete l.DrawingLeft, delete l.DrawingTop));
                    else if (item.Property.LayerOverrides[_li]) { delete item.Property.LayerOverrides[_li].DrawingLeft; delete item.Property.LayerOverrides[_li].DrawingTop; }
                }
                { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
                setLO(item, idx, 'ScaleX', 1); setLO(item, idx, 'ScaleY', 1);
                setLO(item, idx, 'Rotation', 0); setLO(item, idx, 'SkewX', 0); setLO(item, idx, 'SkewY', 0);
                if (state.activeDrag === 'rot') updateRotOverlay(0);
            }
        });
        shadowRoot.appendChild(toggleEl);

        const partsFloat = document.createElement('div');
        partsFloat.id = 'parts-float';
        partsFloat.style.pointerEvents = 'auto';
        partsFloat.innerHTML = `
      <div id="parts-float-header"><span>${isZh()?'部件':'Layers'}</span><button id="parts-float-close">✕</button></div>
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
            const btn = e.target.closest('[data-select-layer]'); if (!btn) return;
            state.selectedLayer = btn.dataset.selectLayer;
            partsFloat.querySelectorAll('[data-select-layer]').forEach(b => b.classList.toggle('selected', b.dataset.selectLayer === state.selectedLayer));
            renderContent(); updateOpacityTab();
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
        <span id="item-name-text" style="font-size:11px;color:var(--text-dim);font-weight:400">AEE v${MOD_VER}</span>
        <button id="parts-toggle-btn" class="iname-btn" title="${isZh()?'部件':'Layers'}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1" y="1" width="12" height="3" rx="1"/><rect x="1" y="5.5" width="12" height="3" rx="1"/><rect x="1" y="10" width="12" height="3" rx="1"/></svg>
        </button>
      </div>
      <div id="content"></div>
    `;
        shadowRoot.appendChild(panel);

        panel.querySelector('#parts-toggle-btn').addEventListener('click', () => {
            const btn = panel.querySelector('#parts-toggle-btn');
            const pf  = shadowRoot.getElementById('parts-float');
            if (pf.classList.contains('open')) { pf.classList.remove('open'); btn.classList.remove('active'); }
            else { pf.classList.add('open'); btn.classList.add('active'); updatePartsPanel(); }
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

        // 長按步進按鈕（mousedown 持續觸發）
        let _stepRepeatTimer = null, _stepRepeatBtn = null, _stepRepeatType = null;
        const _startStepRepeat = (btn, type) => {
            _stepRepeatBtn = btn; _stepRepeatType = type;
            _stepRepeatTimer = setTimeout(() => {
                _stepRepeatTimer = setInterval(() => {
                    if (!_stepRepeatBtn) return;
                    if (_stepRepeatType === 'op') handleOpStep(_stepRepeatBtn);
                    else if (_stepRepeatType === 'pri') handlePriorityStep(_stepRepeatBtn);
                    else handleStep(_stepRepeatBtn);
                }, 80);
            }, 400);
        };
        const _stopStepRepeat = () => { clearTimeout(_stepRepeatTimer); clearInterval(_stepRepeatTimer); _stepRepeatTimer = null; _stepRepeatBtn = null; _stepRepeatType = null; };
        content.addEventListener('mousedown', e => {
            const opBtn  = e.target.closest('[data-op-step]');  if (opBtn)  { e.preventDefault(); _startStepRepeat(opBtn,  'op');  return; }
            const priBtn = e.target.closest('[data-pri-step]');
            if (priBtn && !e.target.closest('[data-pri-reset]')) { e.preventDefault(); _startStepRepeat(priBtn, 'pri'); return; }
            const btn    = e.target.closest('[data-step]');     if (btn)    { e.preventDefault(); _startStepRepeat(btn,    'prop'); }
        });
        content.addEventListener('mouseleave', _stopStepRepeat);
        document.addEventListener('mouseup', _stopStepRepeat);

        // 懸停閃爍：mouseover 啟動，mouseout 停止
        // 每幀 mousemove 判斷（AppearanceRun 裡）也會自動停止不在按鈕上的閃爍
        function _setupLayerHover(container) {
            if (!container || container._hoverBound) return;
            container._hoverBound = true;
            container.addEventListener('mouseover', e => {
                if (!state.hoverHighlight) return;
                const btn = e.target.closest('[data-select-layer]'); if (!btn) return;
                const item = getCurrentItem(); if (!item) return;
                _startHoverHighlight(item, btn.dataset.selectLayer);
            });
            container.addEventListener('mouseout', e => {
                if (!state.hoverHighlight) return;
                const btn = e.target.closest('[data-select-layer]'); if (!btn) return;
                // 確認真的離開按鈕（不是移到子元素）
                if (btn.contains(e.relatedTarget)) return;
                // 確認沒有移到另一個同容器的 select-layer 按鈕
                const relBtn = e.relatedTarget?.closest('[data-select-layer]');
                if (relBtn && container.contains(relBtn)) {
                    // 移到另一個按鈕，讓 mouseover 接手
                    return;
                }
                const item = getCurrentItem(); if (!item) return;
                _stopHoverHighlight(item, true);
            });
        }
        _setupLayerHover(content);
        // parts-float（可能在 buildPanel 後才出現，延遲綁定）
        const partsBody = shadowRoot?.getElementById('parts-float-body');
        if (partsBody) _setupLayerHover(partsBody);
        // 動態產生的 parts-float 也要支援：透過 MutationObserver 監聽
        if (shadowRoot) {
            const _partsMO = new MutationObserver(() => {
                const pb = shadowRoot.getElementById('parts-float-body');
                if (pb) _setupLayerHover(pb);
            });
            _partsMO.observe(shadowRoot, { childList: true, subtree: true });
        }

        alignHost(); positionPanel(); updateTogglePos();
        buildRotOverlay(); alignRotOverlay();
        buildColorPicker();
    }

    function updateTogglePos() {
        if (!shadowRoot) return;
        const panel = shadowRoot.getElementById('panel');
        const toggleEl = shadowRoot.getElementById('toggle');
        if (!panel || !toggleEl) return;
        if (state.collapsed) { toggleEl.style.left = '0px'; }
        else { const w = panel.offsetWidth || parseInt(getComputedStyle(panel).width) || 270; toggleEl.style.left = w + 'px'; }
    }

    function updateToggleIcons() {
        if (!shadowRoot) return;
        ['xy','rot','scale','skew'].forEach(mode => {
            const el = shadowRoot.getElementById('tgl-' + mode);
            if (el) el.classList.toggle('active', state.activeDrag === mode);
        });
        const cpEl = shadowRoot.getElementById('tgl-colorpicker');
        const cpOpen = colorPickerShadow?.getElementById('cp-outer')?.classList.contains('open') ?? false;
        const cpIsBCMode = colorPickerHostEl?._cpIsBCMode ?? false;
        if (cpEl) cpEl.classList.toggle('active', cpOpen && !cpIsBCMode);
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
            panel.classList.add('collapsed'); toggleEl.classList.add('show-icons');
            if (arrow) arrow.textContent = '▶';
            state.collapsed = true; toggleEl.style.left = '0px';
        } else {
            toggleEl.style.display = 'none'; panel.classList.remove('collapsed'); toggleEl.classList.remove('show-icons');
            state.collapsed = false;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                toggleEl.style.display = '';
                const w = panel.offsetWidth || 270;
                toggleEl.style.left = w + 'px';
                if (arrow) arrow.textContent = '◀';
            }));
        }
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================

    function onContentClick(e) {
        // 點擊時清除閃爍並設冷卻（防止下一幀立即重啟）
        _hoverCooldownUntil = Date.now() + 800;
        _stopHoverHighlight(null, true);
        _hoverLayerIdx = null;
        const colorEditBtn = e.target.closest('[data-color-edit]');
        if (colorEditBtn) {
            const layerIdx = colorEditBtn.dataset.colorEdit;
            const curColor = getLayerColor(getCurrentItem(), layerIdx) || '#FFFFFF';
            openColorPicker(curColor, (hex) => { const item = getCurrentItem(); if (!item) return; setLayerColor(item, layerIdx, hex); updateColorUI(layerIdx, hex); }, false);
            return;
        }
        const priStep  = e.target.closest('[data-pri-step]');  if (priStep)  { handlePriorityStep(priStep);   return; }
        const priReset = e.target.closest('[data-pri-reset]'); if (priReset) { handlePriorityReset(priReset); return; }
        const priRange = e.target.closest('[data-pri-range]'); if (priRange) { handlePriorityRange(priRange); return; }
        const layerBtn = e.target.closest('[data-select-layer]');
        if (layerBtn) { state.selectedLayer = layerBtn.dataset.selectLayer; renderContent(); updateOpacityTab(); return; }
        const stepBtn    = e.target.closest('[data-step]');    if (stepBtn)    { handleStep(stepBtn);    return; }
        const opStepBtn  = e.target.closest('[data-op-step]'); if (opStepBtn)  { handleOpStep(opStepBtn); return; }
        const resetBtn   = e.target.closest('[data-reset]');   if (resetBtn)   { handleReset(resetBtn.dataset.reset); return; }
        const scaleLockBtn = e.target.closest('#scale-lock-btn');
        if (scaleLockBtn) {
            state.scaleLock = !state.scaleLock;
            scaleLockBtn.classList.toggle('locked', state.scaleLock);
            scaleLockBtn.innerHTML = state.scaleLock
                ? '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4"/><rect x="9" y="2" width="10" height="10" rx="4"/></svg>'
                : '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="10" height="10" rx="4" opacity="0.35"/><rect x="10" y="2" width="10" height="10" rx="4"/></svg>';
            return;
        }
        // checkbox 設定項由 onContentChange 處理（change event 更可靠）
        const mirrorBtn = e.target.closest('[data-mirror]');
        if (mirrorBtn) { handleMirror(mirrorBtn.dataset.mirror); return; }
    }

    function onContentChange(e) {
        const el = e.target;
        // checkbox 設定項：change event 是最可靠的時機（checked 已更新）
        if (el.tagName === 'INPUT' && el.type === 'checkbox' && el.dataset.setting) {
            setAeeSetting(el.dataset.setting, el.checked);
            if (el.dataset.setting === 'hoverHighlight') {
                state.hoverHighlight = el.checked;
                if (!el.checked) { _stopHoverHighlight(null, true); _hoverLayerIdx = null; }
            } else if (el.dataset.setting === 'hoverHighlightChar') {
                state.hoverHighlightChar = el.checked;
                if (!el.checked) _stopHoverCharHighlight();
            } else if (el.dataset.setting === 'hideLscgLayers') {
                state.hideLscgLayers = el.checked;
                _applyLscgLayersVisibility();
            } else if (el.dataset.setting === 'showCharCtrl') {
                state.showCharCtrl = el.checked;
                if (!el.checked) _hideCharCtrlPanel();
                else if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'Appearance') _showCharCtrlPanel();
            }
            renderContent(); return;
        }
        if (el.dataset.dragMode !== undefined) {
            const mode = el.dataset.dragMode;
            if (el.checked) {
                if (state.activeDrag === 'rot' && mode !== 'rot') hideRotOverlay(); hideTouchBlocker();
                state.activeDrag = mode; updateToggleIcons();
                if (mode === 'rot') showRotOverlay();
                shadowRoot.querySelectorAll('[data-drag-mode]').forEach(cb => {
                    if (cb !== el) cb.checked = false;
                    cb.closest('.drag-check-label')?.classList.toggle('active', cb.checked);
                });
                el.closest('.drag-check-label')?.classList.add('active');
            } else {
                state.activeDrag = null; updateToggleIcons();
                if (mode === 'rot') hideRotOverlay(); hideTouchBlocker();
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
        // 圖層優先度 range slider
        if (el.dataset.priRange !== undefined) {
            handlePriorityRange(el);
            return;
        }
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
        const item = getCurrentItem(); if (!item || state.selectedLayer === null || !ctrl) return;
        const idx = state.selectedLayer;
        const raw = parseFloat(el.value); if (isNaN(raw)) return;
        if      (ctrl === 'x')   setLO(item, idx, 'DrawingLeft',      {"": Math.round(raw)});
        else if (ctrl === 'y')   setLO(item, idx, 'DrawingTop',       {"": Math.round(raw)});
        else if (ctrl === 'sx')  setLO(item, idx, 'ScaleX',           Math.max(0.05, +raw.toFixed(2)));
        else if (ctrl === 'sy')  setLO(item, idx, 'ScaleY',           Math.max(0.05, +raw.toFixed(2)));
        else if (ctrl === 'rot') setLO(item, idx, 'Rotation',         ((Math.round(raw) % 360) + 360) % 360);
        else if (ctrl === 'skx') setLO(item, idx, 'SkewX',            +raw.toFixed(1));
        else if (ctrl === 'sky') setLO(item, idx, 'SkewY',            +raw.toFixed(1));
        else if (ctrl === 'fcx') setLO(item, idx, 'MirrorCopyAxisX',  Math.max(0, Math.min(1, +raw.toFixed(2))));
        else if (ctrl === 'fcy') setLO(item, idx, 'MirrorCopyAxisY',  Math.max(0, Math.min(1, +raw.toFixed(2))));
        updateEditSection();
        if (ctrl === 'rot' && state.activeDrag === 'rot') { const lo2 = getLO(getCurrentItem(), idx); updateRotOverlay(lo2.Rotation ?? 0); }
    }

    function syncOpacityUI(val) {
        const pct = Math.round(val * 100);
        shadowRoot.querySelectorAll('[data-op-layer]').forEach(el => { el.value = pct; });
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
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const idx = state.selectedLayer;
        const ctrl = btn.dataset.step, delta = parseFloat(btn.dataset.delta);
        const lo = getLO(item, idx);
        const { bx, by } = _assetBaseXY(item, idx);
        if      (ctrl==='x')   setLO(item,idx,'DrawingLeft',      {"":( lo.DrawingLeft?.[""]??bx)+delta});
        else if (ctrl==='y')   setLO(item,idx,'DrawingTop',       {"":( lo.DrawingTop?.[""] ??by)+delta});
        else if (ctrl==='sx')  setLO(item,idx,'ScaleX',           Math.max(0.05,+((lo.ScaleX??1)+delta).toFixed(2)));
        else if (ctrl==='sy')  setLO(item,idx,'ScaleY',           Math.max(0.05,+((lo.ScaleY??1)+delta).toFixed(2)));
        else if (ctrl==='rot') setLO(item,idx,'Rotation',         ((lo.Rotation??0)+delta+360)%360);
        else if (ctrl==='skx') setLO(item,idx,'SkewX',            +((lo.SkewX??0)+delta).toFixed(1));
        else if (ctrl==='sky') setLO(item,idx,'SkewY',            +((lo.SkewY??0)+delta).toFixed(1));
        else if (ctrl==='fcx') setLO(item,idx,'MirrorCopyAxisX',  Math.max(0,Math.min(1,+((lo.MirrorCopyAxisX??0.5)+delta).toFixed(2))));
        else if (ctrl==='fcy') setLO(item,idx,'MirrorCopyAxisY',  Math.max(0,Math.min(1,+((lo.MirrorCopyAxisY??0.5)+delta).toFixed(2))));
        updateEditSection();
        if (state.activeDrag === 'rot') { const lo2 = getLO(getCurrentItem(), idx); updateRotOverlay(lo2.Rotation??0); }
    }

    function handleOpStep(btn) {
        const layerIdx = btn.dataset.opStep, delta = parseInt(btn.dataset.opDelta);
        const item = getCurrentItem(); if (!item) return;
        const lo = getLO(item, layerIdx);
        const newPct = Math.max(0, Math.min(100, Math.round((lo.Opacity ?? 1) * 100) + delta));
        setLO(item, layerIdx, 'Opacity', newPct / 100);
        const valEl   = shadowRoot?.getElementById(`op-val-${layerIdx}`);
        const rangeEl = shadowRoot?.querySelector(`[data-op-layer="${layerIdx}"]`);
        if (valEl)   valEl.textContent = newPct + '%';
        if (rangeEl) rangeEl.value     = newPct;
        if (layerIdx === state.selectedLayer || layerIdx === 'all') {
            const editVal   = shadowRoot?.getElementById('edit-op-val');
            const editRange = shadowRoot?.querySelector('[data-edit-op]');
            if (editVal)   editVal.textContent = newPct + '%';
            if (editRange) editRange.value     = newPct;
        }
        if (layerIdx === 'all') {
            shadowRoot?.querySelectorAll('[data-op-layer]:not([data-op-layer="all"])').forEach(el => { el.value = newPct; });
            shadowRoot?.querySelectorAll('[id^="op-val-"]:not(#op-val-all)').forEach(el => { el.textContent = newPct + '%'; });
        }
    }

    function handleReset(ctrl) {
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const idx = state.selectedLayer;
        if (ctrl==='x') {
            if (idx === 'all') item.Property?.LayerOverrides?.forEach(lo => { if (lo) delete lo.DrawingLeft; });
            else if (item.Property?.LayerOverrides?.[parseInt(idx)]) delete item.Property.LayerOverrides[parseInt(idx)].DrawingLeft;
            { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
        } else if (ctrl==='y') {
            if (idx === 'all') item.Property?.LayerOverrides?.forEach(lo => { if (lo) delete lo.DrawingTop; });
            else if (item.Property?.LayerOverrides?.[parseInt(idx)]) delete item.Property.LayerOverrides[parseInt(idx)].DrawingTop;
            { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
        } else if (ctrl==='op') {
            ensureLO(item);
            const count = item.Asset?.Layer?.length || 1;
            const resetIndices = idx === 'all' ? Array.from({ length: count }, (_, i) => i) : [parseInt(idx)];
            if (!Array.isArray(item.Property.Opacity)) item.Property.Opacity = Array(count).fill(1);
            resetIndices.forEach(i => {
                const def = item.Asset?.Layer?.[i]?.Opacity ?? 1;
                if (item.Property.LayerOverrides?.[i]) delete item.Property.LayerOverrides[i].Opacity;
                if (i < item.Property.Opacity.length) item.Property.Opacity[i] = def;
            });
            { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) { try { CharacterLoadCanvas(_rc); } catch(e) {} if (_aeeItemColorChar && _aeeItemColorChar !== _rc) { _aeeItemColorDirty = true; try { CharacterLoadCanvas(_aeeItemColorChar); } catch(e) {} } } }
        }
        else if (ctrl==='sx')  setLO(item,idx,'ScaleX',1);
        else if (ctrl==='sy')  setLO(item,idx,'ScaleY',1);
        else if (ctrl==='rot') { setLO(item,idx,'Rotation',0); if(state.activeDrag==='rot') updateRotOverlay(0); }
        else if (ctrl==='skx') setLO(item,idx,'SkewX',0);
        else if (ctrl==='sky') setLO(item,idx,'SkewY',0);
        else if (ctrl==='fcx' || ctrl==='mc') { setLO(item,idx,'MirrorCopyAxisX',0.5); setLO(item,idx,'MirrorCopyAxisY',0.5); }
        updateEditSection();
    }

    function handleMirror(key) {
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const lo = getLO(item, state.selectedLayer);
        const cur = key === 'MirrorCopy' ? !!lo.MirrorCopy : key === 'MirrorCopyV' ? !!lo.MirrorCopyV : key === 'FlipX' ? !!lo.FlipX : !!lo.FlipY;
        setLO(item, state.selectedLayer, key, !cur);
        updateEditSection();
        const sec = shadowRoot.getElementById('edit-section'); if (!sec) return;
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
        // 渲染前停止閃爍，避免殘留（0.7.6 原始邏輯）
        _stopHoverHighlight(null, true);
        _hoverLayerIdx = null;
        _hoverCooldownUntil = Date.now() + 300;
        const item  = getCurrentItem();
        const group = getCurrentGroup();
        const isWardrobeColor = (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode === 'Color');
        const isItemColor     = !!_aeeItemColorItem;

        if (!item || !group || (!isWardrobeColor && !isItemColor)) {
            hostEl.style.display = 'none'; hideRotOverlay(); hideTouchBlocker(); return;
        }
        hostEl.style.display = 'block';
        alignHost(); positionPanel(); updateTogglePos();
        showTouchBlocker();

        // item-name 顯示版本號，不更新 item 名稱

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
        else hideRotOverlay(); hideTouchBlocker();
    }

    function updatePartsPanel() {
        if (!shadowRoot) return;
        const item   = getCurrentItem(); if (!item) return;
        const layers = item.Asset?.Layer || [];
        const body   = shadowRoot.getElementById('parts-float-body'); if (!body) return;
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
            const sx  = lo.ScaleX ?? 1, sy = lo.ScaleY ?? 1;
            const rot = lo.Rotation ?? 0;
            const op  = Math.round((lo.Opacity??1)*100);
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
      const rotHtml   = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('rotate') + '</span>' + dragCheckbox('rot',t('rotateDrag')) + '</div>' + propRow('°',rot,'rot',[-5,-1,1,5]) + '</div>';
      const scaleHtml = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('scale') + '</span><button class="scale-lock-btn' + (state.scaleLock?' locked':'') + '" id="scale-lock-btn" title="' + (isZh()?'等比縮放':'Proportional scale') + '">' + scaleLockSvg + '</button>' + dragCheckbox('scale',t('scaleDrag')) + '</div>' + propRow('X',sx.toFixed(2),'sx',[-0.3,-0.1,0.1,0.3]) + propRow('Y',sy.toFixed(2),'sy',[-0.3,-0.1,0.1,0.3]) + '</div>';
      const skewHtml  = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('skew') + '</span>' + dragCheckbox('skew', t('coordDrag')) + '</div>' + propRow('X°',(lo.SkewX??0).toFixed(1),'skx',[-5,-1,1,5]) + propRow('Y°',(lo.SkewY??0).toFixed(1),'sky',[-5,-1,1,5]) + '</div>';
      const mcx = (lo.MirrorCopyAxisX??0.5).toFixed(2), mcy = (lo.MirrorCopyAxisY??0.5).toFixed(2);
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
      const mirrorHtml = '<div class="prop-group"><div class="prop-group-header"><span class="prop-group-title">' + t('mirror') + '</span></div>'
          + '<div class="mirror-grid">'
          + '<div class="mirror-group"><div class="mirror-group-title">' + (isZh()?'鏡射':'Mirror') + '</div>'
          + '<div class="mirror-pair"><button class="mirror-btn ' + (lo.FlipX?'active':'') + '" data-mirror="FlipX">' + t('mirrorH') + '</button>'
          + '<button class="mirror-btn ' + (lo.FlipY?'active':'') + '" data-mirror="FlipY">' + t('mirrorV') + '</button></div></div>'
          + '<div class="mirror-group"><div class="mirror-group-title">' + (isZh()?'複製':'Copy') + '</div>'
          + '<div class="mirror-pair"><button class="mirror-btn ' + (lo.MirrorCopy?'active':'') + '" data-mirror="MirrorCopy">' + t('mirrorH') + '</button>'
          + '<button class="mirror-btn ' + (lo.MirrorCopyV?'active':'') + '" data-mirror="MirrorCopyV">' + t('mirrorV') + '</button></div></div>'
          + '</div>' + copyAxisRow + '</div>';
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
        const allOpacity = getOpacity(item, 'all');
        const allDisplay = allOpacity === null ? '—' : Math.round(allOpacity * 100) + '%';
        const allVal     = allOpacity === null ? 100 : Math.round(allOpacity * 100);
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
        layers.forEach((layer,i) => { const v = getOpacity(item, String(i)); html += opRow(String(i), getLayerDisplayName(layer, i), Math.round((v ?? 1) * 100), false); });
        return html;
    }

    function updateEditSection() {
        if (!shadowRoot) return;
        const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
        const lo  = getLO(item, state.selectedLayer);
        const sec = shadowRoot.getElementById('edit-section'); if (!sec) return;
        const layerI = state.selectedLayer === 'all' ? 0 : parseInt(state.selectedLayer);
        const baseLeft = item.Asset?.Layer?.[layerI]?.DrawingLeft;
        const baseTop  = item.Asset?.Layer?.[layerI]?.DrawingTop;
        const vals = {
            x:   lo.DrawingLeft?.[""] ?? (typeof baseLeft === 'object' ? (baseLeft?.['']??0) : (baseLeft??0)),
            y:   lo.DrawingTop?.[""]  ?? (typeof baseTop  === 'object' ? (baseTop?.[''] ??0) : (baseTop ??0)),
            sx:  (lo.ScaleX??1).toFixed(2), sy: (lo.ScaleY??1).toFixed(2),
            rot: lo.Rotation??0,
            skx: (lo.SkewX??0).toFixed(1), sky: (lo.SkewY??0).toFixed(1),
            fcx: (lo.MirrorCopyAxisX??0.5).toFixed(2), fcy: (lo.MirrorCopyAxisY??0.5).toFixed(2),
        };
        sec.querySelectorAll('[data-prop-input]').forEach(el => {
            if (el.dataset.propInput && vals[el.dataset.propInput] !== undefined) {
                if (el !== sec.querySelector(':focus')) el.value = vals[el.dataset.propInput];
            }
        });
        const opVal = Math.round((lo.Opacity??1)*100);
        const opEl = shadowRoot.getElementById('edit-op-val'); if (opEl) opEl.textContent = opVal + '%';
        const opRange = sec.querySelector('[data-edit-op]'); if (opRange) opRange.value = opVal;
    }

    // ============================================================
    // HTML HELPERS
    // ============================================================

    function dragCheckbox(mode, label) {
        const isActive = state.activeDrag === mode;
        return `<label class="drag-check-label ${isActive?'active':''}">
  <input type="checkbox" data-drag-mode="${mode}" ${isActive?'checked':''}>${label}
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
            const layerName = layers[parseInt(rawIdx)]?.Name; if (!layerName) return newVal;
            if (typeof item.Property.OverridePriority !== 'object' || item.Property.OverridePriority == null)
                item.Property.OverridePriority = {};
            item.Property.OverridePriority[layerName] = newVal;
        }
        { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
        return newVal;
    }

    function handlePriorityStep(btn) {
        const item = getCurrentItem(); if (!item) return;
        const rawIdx = btn.dataset.priStep, delta = parseInt(btn.dataset.priDelta);
        const layers = item.Asset?.Layer || [];
        let current;
        if (rawIdx === 'all') {
            const op = item.Property?.OverridePriority;
            current = typeof op === 'number' ? op : (item.Asset?.DrawingPriority ?? 0);
        } else {
            const i = parseInt(rawIdx), layerName = layers[i]?.Name, op = item.Property?.OverridePriority;
            current = (typeof op === 'object' && op?.[layerName] != null) ? op[layerName] : (layers[i]?.Priority ?? 0);
        }
        const newVal = applyPriority(item, rawIdx, current + delta);
        // 同步 range slider 和 val display
        const rangeEl = shadowRoot?.querySelector(`[data-pri-range="${rawIdx}"]`);
        if (rangeEl) rangeEl.value = newVal;
        const valSpan = shadowRoot?.getElementById('pri-val-' + rawIdx);
        if (valSpan) valSpan.textContent = newVal;
    }

    function handlePriorityInput(input) {
        const item = getCurrentItem(); if (!item) return;
        const rawIdx = input.dataset.priInput, val = parseInt(input.value);
        if (isNaN(val)) return;
        applyPriority(item, rawIdx, val);
        input.value = clampPri(val);
    }

    function handlePriorityReset(btn) {
        const item = getCurrentItem(); if (!item) return;
        const rawIdx = btn.dataset.priReset, layers = item.Asset?.Layer || [];
        let resetVal;
        if (rawIdx === 'all') {
            if (item.Property) delete item.Property.OverridePriority;
            resetVal = item.Asset?.DrawingPriority ?? 0;
        } else {
            const i = parseInt(rawIdx), layerName = layers[i]?.Name;
            if (layerName && typeof item.Property?.OverridePriority === 'object') {
                delete item.Property.OverridePriority[layerName];
                if (Object.keys(item.Property.OverridePriority).length === 0) delete item.Property.OverridePriority;
            }
            resetVal = layers[parseInt(rawIdx)]?.Priority ?? 0;
        }
        // 同步 range slider 和 val display
        const rangeEl = shadowRoot?.querySelector(`[data-pri-range="${rawIdx}"]`);
        if (rangeEl) rangeEl.value = resetVal;
        const valSpan = shadowRoot?.getElementById('pri-val-' + rawIdx);
        if (valSpan) valSpan.textContent = resetVal;
        { const _rc = CharacterAppearanceSelection || _aeeItemColorChar; if (_rc) CharacterRefresh(_rc, false, false); }
    }

    // ============================================================
    // SETTINGS（localStorage，無需 BC DB）
    // ============================================================

    const _aeeSettings = (() => {
        try { return JSON.parse(localStorage.getItem('liko-aee-settings') || '{}'); } catch { return {}; }
    })();
    function _saveAeeSettings() { try { localStorage.setItem('liko-aee-settings', JSON.stringify(_aeeSettings)); } catch {} }
    function getAeeSetting(k, def) { return _aeeSettings[k] ?? def; }
    function setAeeSetting(k, v) { _aeeSettings[k] = v; _saveAeeSettings(); }

    // 初始化 state 設定值
    state.hoverHighlight     = getAeeSetting('hoverHighlight', false);
    state.hoverHighlightChar = getAeeSetting('hoverHighlightChar', false);
    state.hideLscgLayers     = getAeeSetting('hideLscgLayers', false);
    state.showCharCtrl       = getAeeSetting('showCharCtrl', false);
    state.hideCloseup        = getAeeSetting('hideCloseup', false);
    state.hideFullbody       = getAeeSetting('hideFullbody', false);
    state.fullbodyOffsetX    = getAeeSetting('fullbodyOffsetX', 0);

    // ── CharCtrl 面板狀態 ──
    let _charCtrlHost = null, _charCtrlShadow = null, _charCtrlOpen = false, _charCtrlDrag = null;
    let _charCtrlCustomPos = null;
    // 展開方向設定（持久化）
    let _ctrlExpandUp  = getAeeSetting('ctrlExpandUp',  true);  // true=向上, false=向下
    let _ctrlSubLeft   = getAeeSetting('ctrlSubLeft',   true);  // true=子清單向左, false=向右
    const _savedCtrlPos = getAeeSetting('charCtrlPos', null);
    if (_savedCtrlPos) _charCtrlCustomPos = _savedCtrlPos;
    const _CTRL_BTN_SIZE   = 52;
    const _CTRL_ICON_MAIN  = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/AEE_ICON.png';
    const _CTRL_ICON_FRAME = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/AEE_ICON2.png';

    // ── 背景系統狀態 ──
    let _bgEnabled       = getAeeSetting('bgEnabled',      false);
    let _bgColor         = getAeeSetting('bgColor',        '#87CEEB');
    let _bgGridEnabled   = getAeeSetting('bgGridEnabled',  false);
    let _bgGridMode      = getAeeSetting('bgGridMode',     'line');
    let _bgGridPx        = getAeeSetting('bgGridPx',       25);
    let _bgGridColor     = getAeeSetting('bgGridColor',    '#ffffff');
    let _bgGridOpacity   = getAeeSetting('bgGridOpacity',  0.25);
    let _bgGridLayer     = getAeeSetting('bgGridLayer',    'below');
    let _bgImgEnabled    = getAeeSetting('bgImgEnabled',   false);
    let _bgImgBtnVisible = getAeeSetting('bgImgBtnVisible',false);
    let _bgImgUrl        = getAeeSetting('bgImgUrl',       '');
    let _bgImgEl = null, _bgOrigDrawImage = null;
    let _bgSettingHost = null, _bgSettingOpen = false;
    let _bgSubOpen     = false;
    let _cpDragOffset  = null;

    // ── 位移面板 / POSE 狀態 ──
    let _offsetPanelHost = null, _offsetPanelOpen = false, _offsetPanelCollapsed = false;
    let _charOffsetX = getAeeSetting('charOffsetX', 0);
    let _charOffsetY = getAeeSetting('charOffsetY', 0);
    let _charScale   = getAeeSetting('charScale',   1.0);
    let _wheelCtrlOn = false, _wheelMoveMode = false;
    let _poseFloatHost = null, _poseFloatOpen = false;

    function renderSettingsTab() {
        const useAeeCP    = getAeeSetting('useAeeColorPicker', false);
        const hoverHL     = getAeeSetting('hoverHighlight', false);
        const hoverHLChar = getAeeSetting('hoverHighlightChar', false);
        const row = (label, key, val) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
            <span style="font-size:13px;color:var(--text-sec)">${label}</span>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="checkbox" data-setting="${key}" ${val?'checked':''}>
                <span style="font-size:12px;color:var(--text-dim)">${val?(isZh()?'啟用':'ON'):(isZh()?'停用':'OFF')}</span>
            </label>
        </div>`;
        const showCharCtrl  = getAeeSetting('showCharCtrl', false);
        const hideLscg      = getAeeSetting('hideLscgLayers', false);
        const aeeMenu = getAeeSetting('enableAeeMenu', false);
        return `<div class="section">
            ${row(isZh()?'更衣室視圖控制':'Appearance View Control', 'showCharCtrl', showCharCtrl)}
            ${row(isZh()?'取代 BC 調色盤':'Replace BC color picker', 'useAeeColorPicker', useAeeCP)}
            ${row(isZh()?'懸停圖層閃爍（AEE）':'Hover layer highlight (AEE)', 'hoverHighlight', hoverHL)}
            ${row(isZh()?'懸停衣服閃爍（角色身上）':'Hover item highlight (character)', 'hoverHighlightChar', hoverHLChar)}
            ${row(isZh()?'隱藏 LSCG 圖層面板':'Hide LSCG layers panel', 'hideLscgLayers', hideLscg)}
            ${row(isZh()?'啟用按鈕替換（匯出/匯入）':'Enable button replacement (Export/Import)', 'enableAeeMenu', aeeMenu)}
        </div>
        <div class="settings-empty" style="text-align:left;padding:16px 14px;font-size:12px;color:var(--text-dim);line-height:1.9">
            ${(()=>{ const zh=isZh(); return zh
              ? '<b style="color:var(--text-sec);font-size:13px">關於 AEE</b><br>• 不需要 LSCG 也能使用透明度與位移效果<br>• 旋轉、縮放、傾斜、鏡射為測試功能，不保證長期穩定<br>• 插件具有高度自定義功能，可能存在少量錯誤<br>• 如遇問題歡迎回報'
              : '<b style="color:var(--text-sec);font-size:13px">About AEE</b><br>• Opacity &amp; offset work without LSCG<br>• Rotate / scale / skew / mirror are experimental<br>• Highly customizable — minor bugs may occur<br>• Feedback welcome if issues arise'; })()}
        </div>`;
    }

    function renderLayersTab(item, layers) {
        if (!layers.length) return `<div class="settings-empty">${t('noLayers')}</div>`;
        const itemBase    = typeof item.Asset?.DrawingPriority === 'number' ? item.Asset.DrawingPriority : 0;
        const overPri     = item.Property?.OverridePriority;
        const itemCurrent = typeof overPri === 'number' ? overPri : itemBase;
        const allOverride = typeof overPri === 'number';

        const priRow = (priKey, name, base, current, isOverridden, isAll) => `<div class="op-tab-row">
  <div class="op-tab-name">
    <span class="op-tab-label" style="${isOverridden?'color:var(--accent2)':''}">${name}<span style="font-size:10px;color:var(--text-dim);margin-left:4px">(${base})</span></span>
    <div class="op-step-row">
      <button class="op-step" data-pri-step="${priKey}" data-pri-delta="-1">−1</button>
      <span class="op-val-display" id="pri-val-${priKey}">${current}</span>
      <button class="op-step" data-pri-step="${priKey}" data-pri-delta="1">+1</button>
      <button class="op-step" data-pri-reset="${priKey}" style="min-width:22px;padding:0 4px" title="↺">↺</button>
    </div>
  </div>
  <div style="position:relative;display:flex;align-items:center;">
    <input type="range" class="range" data-pri-range="${priKey}" min="-99" max="99" step="1" value="${Math.max(-99,Math.min(99,current))}" style="flex:1">
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:2px;height:10px;background:rgba(124,106,247,0.5);pointer-events:none;border-radius:1px"></div>
  </div>
</div>`;

        let html = priRow('all', `<strong>${t('allParts')}</strong>`, itemBase, itemCurrent, allOverride, true);
        layers.forEach((layer, i) => {
            const basePri    = typeof layer?.Priority === 'number' ? layer.Priority : 0;
            const op         = item.Property?.OverridePriority;
            const currentPri = (typeof op === 'object' && op?.[layer.Name] != null) ? op[layer.Name] : basePri;
            const isOverridden = typeof op === 'object' && op?.[layer.Name] != null;
            html += priRow(String(i), getLayerDisplayName(layer, i), basePri, currentPri, isOverridden, false);
        });
        return html;
    }

    function handlePriorityRange(rangeEl) {
        const item = getCurrentItem(); if (!item) return;
        const key = rangeEl.dataset.priRange;
        const val = parseInt(rangeEl.value);
        applyPriority(item, key, val);
        const valSpan = shadowRoot?.getElementById('pri-val-' + key);
        if (valSpan) valSpan.textContent = val;
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
        _applyLscgLayersVisibility();

        const itemChanged = (group !== lastGroup || item?.Asset?.Name !== lastAsset);
        if (itemChanged || mode !== lastMode) {
            if (itemChanged) {
                state.selectedLayer = null; state.activeDrag = null;
                hideRotOverlay(); hideTouchBlocker(); updateToggleIcons();
                const pf  = shadowRoot?.getElementById('parts-float');
                const btn = shadowRoot?.getElementById('parts-toggle-btn');
                if (pf)  pf.classList.remove('open');
                if (btn) btn.classList.remove('active');
                setTimeout(() => { if (shadowRoot && hostEl?.style.display !== 'none') renderContent(); }, 350);
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
            const result = next(args);

            return result;
        });
    } catch(e) {}

    // 對有 transform 的 item 暫時開啟 DynamicBeforeDraw，確保 BC 呼叫 BeforeDraw hook
    try {
        modApi.hookFunction("CommonDrawAppearanceBuild", 1, (args, next) => {
            const C = args[0];
            const toRestore = [];
            C?.Appearance?.forEach(item => {
                const los = item.Property?.LayerOverrides;
                const needsTransform = Array.isArray(los) && los.some(lo => lo &&
                    (lo.DrawingLeft != null || lo.DrawingTop != null || lo.Rotation != null ||
                     lo.ScaleX != null || lo.ScaleY != null || lo.SkewX != null || lo.SkewY != null ||
                     lo.FlipX || lo.FlipY || lo.MirrorCopy || lo.MirrorCopyV));
                // 閃爍的 item 也需要 DynamicBeforeDraw 才能讓 BeforeDraw hook 被呼叫
                const needsFlash = (item === _hoverFlashData?.item || item === _hoverCharFlashData?.item);
                if (needsTransform || needsFlash) {
                    toRestore.push({ asset: item.Asset, orig: item.Asset.DynamicBeforeDraw });
                    item.Asset.DynamicBeforeDraw = true;
                }
            });
            const result = next(args);
            toRestore.forEach(({ asset, orig }) => { asset.DynamicBeforeDraw = orig; });
            return result;
        });
    } catch(e) {}

    // BeforeDraw hook：從 Item 讀取 transform 設定 _aeePendingTd，並處理 X/Y 位移
    try {
        modApi.hookFunction("CommonCallFunctionByNameWarn", 3, (args, next) => {
            const funcName = args[0], params = args[1];
            if (!params || !/Assets(.+)BeforeDraw/i.test(funcName)) return next(args);

            _aeePendingTd = null; _aeePendingApplied = 0;

            const CA = params.CA;
            if (CA) {
                let layerName = (params.L ?? '').trim();
                if (layerName[0] === '_') layerName = layerName.slice(1);
                const layerIdx = CA.Asset?.Layer?.findIndex(l => (l.Name ?? '') === layerName) ?? -1;
                if (layerIdx >= 0) {
                    const lo = CA.Property?.LayerOverrides?.[layerIdx];
                    if (lo) {
                        const hasTransform = lo.FlipX || lo.FlipY || lo.MirrorCopy || lo.MirrorCopyV ||
                            lo.ScaleX != null || lo.ScaleY != null || lo.Rotation != null || lo.SkewX != null || lo.SkewY != null;
                        if (hasTransform) {
                            _aeePendingTd = {
                                flipX: !!lo.FlipX, flipY: !!lo.FlipY,
                                mirrorCopy: !!lo.MirrorCopy, mirrorCopyV: !!lo.MirrorCopyV,
                                mirrorCopyAxisX: lo.MirrorCopyAxisX ?? 0.5, mirrorCopyAxisY: lo.MirrorCopyAxisY ?? 0.5,
                                scaleX: lo.ScaleX ?? 1, scaleY: lo.ScaleY ?? 1,
                                rotation: lo.Rotation ?? 0, skewX: lo.SkewX ?? 0, skewY: lo.SkewY ?? 0,
                            };
                            aeeLog(`BeforeDraw: ${CA.Asset?.Name}[${layerIdx}]=${layerName} rot=${_aeePendingTd.rotation}`);
                        }
                    }
                }
            }

            const fnExists = typeof window[funcName] === 'function';
            const ret = fnExists ? (next(args) ?? {}) : {};

            // X/Y 位移透過 BeforeDraw 回傳值傳入，不走 prototype patch
            const Property = params.Property;
            if (CA && Property) {
                let rawName = (params.L ?? '').trim();
                if (rawName[0] === '_') rawName = rawName.slice(1);
                const layerIx = CA.Asset?.Layer?.findIndex(l => (l.Name ?? '') === rawName) ?? -1;
                if (layerIx >= 0) {
                    const lo = Property?.LayerOverrides?.[layerIx];
                    if (lo) {
                        const dx = lo.DrawingLeft?.[''], dy = lo.DrawingTop?.[''];
                        if (dx != null && ret.X == null) ret.X = dx;
                        if (dy != null && ret.Y == null) ret.Y = dy + (typeof CanvasUpperOverflow !== 'undefined' ? CanvasUpperOverflow : 0);
                    }
                }
            }
            // 閃爍 opacity（透過 BeforeDraw 回傳，不碰 Property.Opacity）
            if (CA) {
                let rawName2 = (params.L ?? '').trim();
                if (rawName2[0] === '_') rawName2 = rawName2.slice(1);
                const layerIx2 = CA.Asset?.Layer?.findIndex(l => (l.Name ?? '') === rawName2) ?? -1;
                if (layerIx2 >= 0) {
                    if (_hoverFlashData?.item === CA && _hoverFlashData.overrides.has(layerIx2))
                        ret.Opacity = _hoverFlashData.overrides.get(layerIx2);
                    else if (_hoverCharFlashData?.item === CA && _hoverCharFlashData.overrides.has(layerIx2))
                        ret.Opacity = _hoverCharFlashData.overrides.get(layerIx2);
                }
            }

            return ret;
        });
    } catch(e) {}

    // ============================================================
    // AppearanceMenu 按鈕操作（參考 CDB）
    // 刪除：WearRandom、Random
    // 替換：Copy→AEE匯出、Paste→AEE匯入（帶衣服種類選擇）
    // ============================================================

    // BCX 格式匯出匯入（來自 CDB）
    function _bcxExport(C) {
        try {
            // BCX 格式：{ Group, Name, Color?, Property?, Difficulty? }
            const bundle = (C.Appearance || []).map(item => {
                const e = {
                    Group: item.Asset?.Group?.Name ?? item.Group,
                    Name:  item.Asset?.Name        ?? item.Name
                };
                if (!e.Group || !e.Name) return null;
                if (item.Color      != null) e.Color      = item.Color;
                if (item.Property   != null) e.Property   = item.Property;
                if (item.Difficulty != null) e.Difficulty = item.Difficulty;
                return e;
            }).filter(Boolean);

            if (!bundle.length) { alert('[AEE] No appearance data'); return; }

            if (typeof LZString === 'undefined') {
                alert('[AEE] LZString not available - cannot export in BCX format');
                return;
            }
            const out = LZString.compressToBase64(JSON.stringify(bundle));
            navigator.clipboard.writeText(out).then(() => {
                if (typeof ChatRoomSendLocal === 'function')
                    ChatRoomSendLocal(isZh() ? `✅ [AEE] 外觀已匯出（${bundle.length} 件）` : `✅ [AEE] Exported ${bundle.length} items`);
            }).catch(e => {
                // clipboard 失敗時 fallback：顯示字串讓用戶手動複製
                prompt('[AEE] Copy this:', out);
            });
        } catch(e) { console.error('[AEE] 匯出失敗:', e); alert('[AEE] Export failed: ' + e); }
    }

    async function _bcxImport(C) {
        let bcxCode;
        try { bcxCode = await navigator.clipboard.readText(); }
        catch(e) { console.error('[AEE] 讀取剪貼板失敗:', e); return; }
        try {
            const appearance = JSON.parse(LZString.decompressFromBase64(bcxCode));
            if (!Array.isArray(appearance)) throw new Error('invalid format');
            if (typeof ServerAppearanceLoadFromBundle === 'function') {
                ServerAppearanceLoadFromBundle(C, C.AssetFamily, appearance, Player.MemberNumber);
                CharacterRefresh(C, false);
                if (typeof ChatRoomCharacterUpdate === 'function' && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom')
                    ChatRoomCharacterUpdate(C);
            } else {
                for (const entry of appearance) {
                    if (entry.Group && entry.Name && typeof AppearanceGroupAllowed === 'function' && AppearanceGroupAllowed(C, entry.Group))
                        InventoryWear(C, entry.Name, entry.Group, entry.Color ?? null, null, null, entry.Property ?? null, false);
                }
                CharacterRefresh(C, false);
            }
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal('✅ [AEE] Appearance Imported');
        } catch(e) {
            // 嘗試 BC 原生格式
            try { if (typeof CharacterAppearancePaste === 'function') CharacterAppearancePaste(C, bcxCode, false); }
            catch(_) {}
        }
    }

    // 判斷 Appearance item 的種類
    // item 可能是 { Group:'BodyUpper', Name:'...' } 或 { Asset:{Group:{Name:'...'}} }
    function _getAppearanceItemCat(item) {
        const groupName = item.Asset?.Group?.Name ?? item.Group;
        if (!groupName) return 'other';
        // 從 BC 全域 AssetGroup 陣列查找 group 物件
        const g = typeof AssetGroup !== 'undefined'
            ? AssetGroup.find(x => x.Name === groupName)
            : null;
        if (!g) return 'other';
        // BC Category：'Appearance' 是外觀，'Item' 是物件/拘束
        if (g.Category === 'Appearance') {
            // Clothing=false 通常是身體部位（皮膚、眼睛、頭髮等）
            if (g.Clothing === false) return 'body';
            return 'clothes';  // Cosplay 也歸入衣服（待之後確認 BC 分類）
        }
        return 'restraints';
    }

    // 匯入種類勾選 UI
    function _showImportCategoryUI(C, appearance) {
        if (!Array.isArray(appearance) || !appearance.length) {
            alert('[AEE] ' + (isZh() ? '無法解析外觀資料' : 'Cannot parse appearance data'));
            return;
        }

        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;z-index:999999;inset:0;pointer-events:all;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(host);

        const cats = [
            { key: 'clothes',    zh: '衣服',   en: 'Clothes',    icon: '👗', on: true  },
            { key: 'body',       zh: '身體',   en: 'Body',        icon: '🧍', on: true  },
            { key: 'restraints', zh: '拘束',   en: 'Restraints',  icon: '⛓',  on: false },
        ];

        const panel = document.createElement('div');
        panel.style.cssText = 'background:#0d0d0f;border:1px solid #7c6af7;border-radius:12px;padding:20px;min-width:280px;font-family:"Segoe UI",sans-serif;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.8)';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:14px;font-weight:700;color:#a89ef8;margin-bottom:14px';
        title.textContent = isZh() ? '選擇匯入種類' : 'Select Import Categories';
        panel.appendChild(title);

        const catsEl = document.createElement('div');
        catsEl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:16px';
        panel.appendChild(catsEl);

        cats.forEach(cat => {
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;background:#161619;border:1px solid #2a2a35;border-radius:6px;cursor:pointer';
            const cb = document.createElement('input');
            cb.type = 'checkbox'; cb.checked = cat.on; cb.dataset.catKey = cat.key;
            cb.style.cssText = 'width:16px;height:16px;accent-color:#7c6af7;cursor:pointer;flex-shrink:0';
            const sp = document.createElement('span');
            sp.textContent = cat.icon + ' ' + (isZh() ? cat.zh : cat.en);
            sp.style.cssText = 'font-size:13px;color:#fff';
            lbl.appendChild(cb); lbl.appendChild(sp);
            catsEl.appendChild(lbl);
        });

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px';
        const btnOK = document.createElement('button');
        btnOK.textContent = isZh() ? '匯入' : 'Import';
        btnOK.style.cssText = 'flex:1;padding:9px;background:#7c6af7;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;font-weight:700';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = isZh() ? '取消' : 'Cancel';
        btnCancel.style.cssText = 'flex:1;padding:9px;background:#1e1e23;border:1px solid #2a2a35;border-radius:6px;color:#a0a0b0;cursor:pointer;font-size:13px';
        btnRow.appendChild(btnOK); btnRow.appendChild(btnCancel);
        panel.appendChild(btnRow);
        host.appendChild(panel);

        btnOK.onclick = () => {
            const selected = new Set([...catsEl.querySelectorAll('input[type=checkbox]')].filter(cb => cb.checked).map(cb => cb.dataset.catKey));
            document.body.removeChild(host);
            const filtered = appearance.filter(item => selected.has(_getAppearanceItemCat(item)));
            if (!filtered.length) { alert('[AEE] ' + (isZh() ? '沒有符合的物件' : 'No matching items')); return; }

            try {
                // 步驟1：移除所選種類的所有現有物件（讓匯入結果跟 bundle 完全一致）
                const existingToRemove = C.Appearance.filter(a => {
                    const gn = a.Asset?.Group?.Name ?? a.Group;
                    if (!gn) return false;
                    return selected.has(_getAppearanceItemCat({ Group: gn }));
                });
                for (const a of existingToRemove) {
                    const gn = a.Asset?.Group?.Name ?? a.Group;
                    if (typeof InventoryRemove === 'function') {
                        try { InventoryRemove(C, gn, false); } catch(_) {}
                    } else {
                        const idx = C.Appearance.findIndex(x => (x.Asset?.Group?.Name ?? x.Group) === gn);
                        if (idx >= 0) C.Appearance.splice(idx, 1);
                    }
                }

                // 步驟2：穿上新物件並完整複製 Property
                for (const entry of filtered) {
                    const groupName = entry.Asset?.Group?.Name ?? entry.Group;
                    const itemName  = entry.Asset?.Name        ?? entry.Name;
                    if (!groupName || !itemName) continue;
                    try {
                        if (typeof InventoryWear === 'function') {
                            InventoryWear(C, itemName, groupName,
                                entry.Color ?? 'Default',
                                null, null, null, false);
                            if (entry.Property != null) {
                                const worn = typeof InventoryGet === 'function'
                                    ? InventoryGet(C, groupName)
                                    : C.Appearance.find(a => (a.Asset?.Group?.Name ?? a.Group) === groupName);
                                if (worn) worn.Property = JSON.parse(JSON.stringify(entry.Property));
                            }
                            if (entry.Difficulty != null) {
                                const worn2 = typeof InventoryGet === 'function'
                                    ? InventoryGet(C, groupName)
                                    : C.Appearance.find(a => (a.Asset?.Group?.Name ?? a.Group) === groupName);
                                if (worn2) worn2.Difficulty = entry.Difficulty;
                            }
                        }
                    } catch(e) { console.warn('[AEE] InventoryWear failed:', groupName, itemName, e); }
                }
                if (typeof CharacterRefresh === 'function') CharacterRefresh(C, false);
                if (typeof ChatRoomCharacterUpdate === 'function' && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom')
                    ChatRoomCharacterUpdate(C);
                if (typeof ChatRoomSendLocal === 'function')
                    ChatRoomSendLocal(isZh() ? `✅ [AEE] 已匯入 ${filtered.length} 個物件` : `✅ [AEE] Imported ${filtered.length} items`);
            } catch(e) { console.error('[AEE] 匯入失敗:', e); alert('[AEE] Import failed: ' + e); }
        };
        btnCancel.onclick = () => document.body.removeChild(host);
        host.onclick = (e) => { if (e.target === host) document.body.removeChild(host); };
    }

    async function _bcxImportWithCategory(C) {
        let bcxCode;
        try { bcxCode = await navigator.clipboard.readText(); }
        catch(e) { console.error('[AEE] 讀取剪貼板失敗:', e); alert('[AEE] Cannot read clipboard'); return; }
        if (!bcxCode || !bcxCode.trim()) { alert('[AEE] Clipboard is empty'); return; }
        bcxCode = bcxCode.trim();

        // BCX/AEE 格式：LZString.compressToBase64(JSON.stringify(Appearance[]))
        // Appearance 陣列每個元素是 BC Appearance item（有 Asset.Group.Name, Asset.Name, Color, Property 等）
        let appearance = null;

        // 方式1: LZString（BCX 格式）
        if (typeof LZString !== 'undefined') {
            try {
                const dec = LZString.decompressFromBase64(bcxCode);
                if (dec) {
                    const arr = JSON.parse(dec);
                    if (Array.isArray(arr) && arr.length) appearance = arr;
                }
            } catch(_) {}
        }
        // 方式2: btoa（AEE 自己的 fallback）
        if (!appearance) {
            try {
                const dec = decodeURIComponent(escape(atob(bcxCode)));
                const arr = JSON.parse(dec);
                if (Array.isArray(arr) && arr.length) appearance = arr;
            } catch(_) {}
        }

        if (appearance) {
            // 正規化：BCX 格式 item 可能有 Asset 物件（完整 BC item）或只有 Group/Name 字串
            const normalized = appearance.map(item => {
                if (item.Asset) return item; // 完整格式
                // 最小格式 {Group, Name, Color, Property}
                return {
                    Asset: { Group: { Name: item.Group }, Name: item.Name },
                    Group: item.Group, Name: item.Name,
                    Color: item.Color, Property: item.Property, Difficulty: item.Difficulty
                };
            });
            _showImportCategoryUI(C, normalized);
            return;
        }

        // Fallback：BC 原生 CharacterAppearancePaste
        if (typeof CharacterAppearancePaste === 'function') {
            try { CharacterAppearancePaste(C, bcxCode, false); return; } catch(_) {}
        }
        alert('[AEE] ' + (isZh() ? '無法解析剪貼板內容（請先用 AEE/BCX 匯出）' : 'Cannot parse clipboard content (please export with AEE/BCX first)'));
    }

    try {
        modApi.hookFunction('AppearanceMenuBuild', 10, (args, next) => {
            next(args);
            if (!getAeeSetting('enableAeeMenu', false)) return;
            if (typeof CharacterAppearanceMode === 'undefined' || CharacterAppearanceMode !== '') return;
            // 刪除 WearRandom、Random
            AppearanceMenu = AppearanceMenu.filter(b => b !== 'WearRandom' && b !== 'Random');
            // 替換 Copy→AEE_Export、Paste→AEE_Import
            AppearanceMenu = AppearanceMenu.map(b => {
                if (b === 'Copy')  return 'AEE_Export';
                if (b === 'Paste') return 'AEE_Import';
                return b;
            });
            // 注入文字避免 MISSING TEXT（若 TextGet 函式存在）
            if (typeof TextGet === 'function' && typeof TextCache !== 'undefined') {
                try {
                    TextCache['Text_Appearance'] = TextCache['Text_Appearance'] || {};
                    TextCache['Text_Appearance']['AEE_Export'] = isZh() ? 'BCX匯出' : 'Export';
                    TextCache['Text_Appearance']['AEE_Import'] = isZh() ? 'BCX匯入' : 'Import';
                } catch(_) {}
            }
        });
    } catch(e) {}

    try {
        modApi.hookFunction('AppearanceMenuDraw', 10, (args, next) => {
            next(args);  // 先讓 BC 畫完
            if (!getAeeSetting('enableAeeMenu', false)) return;
            const menu = AppearanceMenu;
            const X = 2000 - menu.length * 117;
            for (let B = 0; B < menu.length; B++) {
                const btnX = X + 117 * B;
                // 蓋掉 BC 畫的（空白或 MISSING TEXT），重新用正確圖示畫
                if (menu[B] === 'AEE_Export') {
                    DrawButton(btnX, 25, 90, 90, '', 'White', 'Icons/Copy.png', isZh() ? 'BCX 匯出外觀至剪貼板' : 'BCX Export appearance to clipboard');
                }
                if (menu[B] === 'AEE_Import') {
                    DrawButton(btnX, 25, 90, 90, '', 'White', 'Icons/Paste.png', isZh() ? 'BCX 匯入外觀（選擇種類）' : 'BCX Import appearance (select categories)');
                }
            }
        });
    } catch(e) {}

    try {
        modApi.hookFunction('AppearanceMenuClick', 10, (args, next) => {
            const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
            const menu = AppearanceMenu;
            const X = 2000 - menu.length * 117;
            for (let B = 0; B < menu.length; B++) {
                if (!MouseXIn(X + 117 * B, 90)) continue;
                if (menu[B] === 'AEE_Export') { _bcxExport(C); return; }
                if (menu[B] === 'AEE_Import') { _bcxImportWithCategory(C); return; }
            }
            return next(args);
        });
    } catch(e) {}

    // AppearanceRun：aeeCheckAndRender + hoverHighlightChar 偵測
    let _aeeInAppearanceRun = false;
    modApi.hookFunction("AppearanceRun", 1, (args, next) => {
        const isAppearance = typeof CurrentScreen !== 'undefined' && CurrentScreen === 'Appearance';
        if (isAppearance && state.showCharCtrl) _showCharCtrlPanel();
        aeeCheckAndRender();

        if (state.hoverHighlightChar && isAppearance &&
            typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode === '' &&
            typeof CharacterAppearanceGroups !== 'undefined' &&
            typeof CharacterAppearanceOffset !== 'undefined' &&
            typeof CharacterAppearanceNumGroupPerPage !== 'undefined') {

            let hoveredGroup = null;
            if (typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined' &&
                MouseX >= 1120 && MouseX < 1975 && MouseY >= 145 && MouseY < 980) {
                for (let A = CharacterAppearanceOffset; A < CharacterAppearanceGroups.length && A < CharacterAppearanceOffset + CharacterAppearanceNumGroupPerPage; A++) {
                    const itemY = 145 + (A - CharacterAppearanceOffset) * 95;
                    if (MouseY >= itemY && MouseY < itemY + 65) { hoveredGroup = CharacterAppearanceGroups[A].Name; break; }
                }
            }
            if (hoveredGroup !== _hoverCharGroup) {
                _stopHoverCharHighlight();
                _hoverCharGroup = hoveredGroup;
                if (hoveredGroup) _startHoverCharHighlight(hoveredGroup);
            }
        } else {
            if (_hoverCharGroup !== null) _stopHoverCharHighlight();
        }

        _aeeInAppearanceRun = true;
        const result = next(args);
        _aeeInAppearanceRun = false;

        // 格線 above：在角色繪製完後疊上去
        if (_bgGridEnabled && _bgGridLayer === 'above' && isAppearance) {
            try {
                const mc = getCanvas();
                if (mc) {
                    const mctx = mc.getContext('2d');
                    _drawBgGrid(mctx, mc, 'above');
                }
            } catch(e) {}
        }
        return result;
    });

    // DrawCharacter hook：更衣室特寫/全身隱藏、位移、縮放
    try {
        modApi.hookFunction("DrawCharacter", 1, (args, next) => {
            if (!_aeeInAppearanceRun) return next(args);
            const C     = args[0];
            const scale = args[3];
            const isTarget = C && typeof CharacterAppearanceSelection !== 'undefined'
                && C === CharacterAppearanceSelection;

            // 特寫（scale=4）：只對目標角色套用隱藏
            if (scale === 4) {
                if (!isTarget) return next(args);
                if (state.hideCloseup) return;
                return next(args);
            }

            // 全身（scale≈1）
            if (Math.abs(scale - 1) < 0.1 || Math.abs(scale - 0.95) < 0.05) {
                if (!isTarget) return next(args);
                if (state.hideFullbody) return;

                const hasOffset = _charOffsetX !== 0 || _charOffsetY !== 0 || _charScale !== 1;
                if (hasOffset) {
                    const n = [...args];
                    n[1] = args[1] + _charOffsetX;
                    n[2] = args[2] + _charOffsetY;
                    n[3] = args[3] * _charScale;
                    return next(n);
                }
                return next(args);
            }
            return next(args);
        });
    } catch(e) {}

    // 更衣室進出
    modApi.hookFunction("AppearanceExit", 1, (args, next) => { _hideCharCtrlPanel(); _removeBgHook(); return next(args); });
    try { modApi.hookFunction("CharacterAppearanceExit", 1, (args, next) => { _hideCharCtrlPanel(); return next(args); }); } catch(e) {}
    try { modApi.hookFunction("CharacterAppearanceWardrobeLoad", 1, (args, next) => { _hideCharCtrlPanel(); return next(args); }); } catch(e) {}
    try {
        modApi.hookFunction("CommonSetScreen", 1, (args, next) => {
            const result = next(args);
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'Appearance') _hideCharCtrlPanel();
            return result;
        });
    } catch(e) {}

    function _aeeIsEditing() { return !!(hostEl && hostEl.style.display !== 'none' && state.activeDrag); }

    function _aeeCloseBCColorPicker() {
        if (!colorPickerShadow?.getElementById('cp-outer')?.classList.contains('open')) return;
        closeColorPicker();
        const backdrop = colorPickerShadow?.getElementById('cp-backdrop');
        if (backdrop) backdrop.style.display = '';
        const main = document.getElementById('color-picker-main');
        const fs = main?.querySelector('fieldset[name="color-picker"]');
        if (fs) fs.style.display = '';
    }

    function _aeeIsBodyClick() {
        const mx = (typeof MouseX !== 'undefined') ? MouseX : 9999;
        const my = (typeof MouseY !== 'undefined') ? MouseY : 9999;
        if (my < 90) return false;
        const mode   = (typeof CharacterAppearanceMode !== 'undefined') ? CharacterAppearanceMode : '';
        if (mode === 'Color') return false;
        const screen = (typeof CurrentScreen !== 'undefined') ? CurrentScreen : '';
        if (screen === 'ChatRoom' || screen === 'ChatSearch' || screen === 'Appearance') return mx < 1000;
        return false;
    }

    try {
        modApi.hookFunction("AppearanceClick", 0, (args, next) => {
            if (_aeeIsEditing()) {
                const mode = (typeof CharacterAppearanceMode !== 'undefined') ? CharacterAppearanceMode : '';
                if (mode === 'Color' || mode === 'Cloth' || mode === 'Permissions') return next(args);
                if (typeof MouseY !== 'undefined' && MouseY > 90) return;
            }
            return next(args);
        });
    } catch(e) {}

    // BC + BCX 互動 bug：preview 角色的 CharacterID 可能為 undefined
    try {
        modApi.hookFunction("AppearancePreviewCleanup", 0, (args, next) => {
            try { return next(args); } catch(e) {
                try { window.AppearancePreviews = []; } catch(e2) {}
                try { window.Character.filter(c => c?.CharacterID?.startsWith?.("AppearancePreview-")).forEach(c => { try { CharacterDelete(c); } catch(e3) {} }); } catch(e4) {}
            }
        });
    } catch(e) {}

    try { modApi.hookFunction("CommonClick", 0, (args, next) => { if (_aeeIsEditing() && _aeeIsBodyClick()) return; return next(args); }); } catch(e) {}
    try { modApi.hookFunction("DialogClick",  0, (args, next) => { if (_aeeIsEditing() && _aeeIsBodyClick()) return; return next(args); }); } catch(e) {}

    let _aeeItemColorChar = null, _aeeItemColorItem = null, _aeeItemColorDirty = false;

    // ItemColor 模式的閃爍偵測（每幀透過 ItemColorDraw hook）
    // BC 的 MouseX/MouseY 是遊戲座標，需轉換為 clientX/Y 後對比 DOM 按鈕位置
    let _hoverLayerIdx = null;
    let _hoverCooldownUntil = 0; // 點擊後冷卻時間戳（ms）
    try {
        modApi.hookFunction("ItemColorDraw", 0, (args, next) => {
            if (args[0]) _aeeItemColorChar = args[0];
            if (args[0] && args[1]) _aeeItemColorItem = InventoryGet(args[0], args[1]);

            if (shadowRoot && hostEl?.style.display !== 'none' && (state.hoverHighlight || state.hoverHighlightChar)) {
                const item = getCurrentItem();
                if (item) {
                    const allBtns = shadowRoot.querySelectorAll('[data-select-layer]');
                    let foundIdx = null;
                    if (typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined') {
                        const canvas = getCanvas(), cr = canvas?.getBoundingClientRect();
                        if (cr) {
                            const clientX = cr.left + (MouseX / (canvas.width || 2000)) * cr.width;
                            const clientY = cr.top  + (MouseY / (canvas.height || 1000)) * cr.height;
                            allBtns.forEach(btn => {
                                const r = btn.getBoundingClientRect();
                                if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom)
                                    foundIdx = btn.dataset.selectLayer;
                            });
                        }
                    }
                    // BC 分層面板（#layering）開啟時停止閃爍
                    const _layeringOpen = !!document.getElementById('layering');
                    // 冷卻期間或分層面板開啟時停止閃爍
                    if (Date.now() < _hoverCooldownUntil || _layeringOpen) {
                        if (_hoverLayerIdx !== null) { _stopHoverHighlight(null, true); _hoverLayerIdx = null; }
                    } else if (foundIdx !== _hoverLayerIdx) {
                        if (_hoverLayerIdx !== null) _stopHoverHighlight(null, true);
                        _hoverLayerIdx = foundIdx;
                        if (foundIdx !== null) _startHoverHighlight(item, foundIdx);
                    }
                }
            }

            return next(args);
        });
    } catch(e) {}

    try {
        modApi.hookFunction("ItemColorLoad", 0, (args, next) => {
            _aeeItemColorChar = args[0]; _aeeItemColorItem = args[1]; _aeeItemColorDirty = false;
            const result = next(args);
            aeeCheckAndRender();
            Promise.resolve(result).then(() => { setTimeout(() => { if (shadowRoot && hostEl?.style.display !== 'none') renderContent(); }, 300); });
            return result;
        });
    } catch(e) {}

    let _aeePickerContext = null;
    try {
        modApi.hookFunction("ItemColorOpenPicker", 0, (args, next) => {
            const item = typeof ItemColorItem !== 'undefined' ? ItemColorItem : _aeeItemColorItem;
            const indices     = typeof ItemColorPickerIndices !== 'undefined' ? [...ItemColorPickerIndices] : null;
            const pickerLayers = typeof ItemColorPickerLayers !== 'undefined' ? [...ItemColorPickerLayers] : null;
            _aeePickerContext = { item, indices, pickerLayers };
            return next(args);
        });
    } catch(e) {}

    try { modApi.hookFunction("ColorPickerUnload", 0, (args, next) => { _aeeCloseBCColorPicker(); return next(args); }); } catch(e) {}

    try {
        modApi.hookFunction("ItemColorFireExit", 0, (args, next) => {
            const dirtyChar = _aeeItemColorChar;
            let result;
            try { result = next(args); }
            catch(e) { console.warn('[AEE] ItemColorFireExit chain error (suppressed):', e?.message ?? e); result = undefined; }
            finally {
                _aeeItemColorChar = null; _aeeItemColorItem = null; _aeeItemColorDirty = false;
                if (colorPickerShadow?.getElementById('cp-outer')?.classList.contains('open')) {
                    closeColorPicker();
                    const backdrop = colorPickerShadow?.getElementById('cp-backdrop');
                    if (backdrop) backdrop.style.display = '';
                    const main = document.getElementById('color-picker-main');
                    const fs = main?.querySelector('fieldset[name="color-picker"]');
                    if (fs) fs.style.display = '';
                }
                _aeeCloseBCColorPicker();
            }
            if (args[0] === true && dirtyChar) { try { if (typeof ChatRoomCharacterUpdate === 'function') ChatRoomCharacterUpdate(dirtyChar); } catch(e) {} }
            try { aeeCheckAndRender(); } catch(e) {}
            return result;
        });
    } catch(e) {}

    try {
        modApi.hookFunction("ColorPickerInit", 0, async (args, next) => {
            if (!getAeeSetting('useAeeColorPicker', false)) return await next(args);
            if (args[0]?.dispatch === false) return await next(args);

            const result = await next(args);
            const main = document.getElementById('color-picker-main'); if (!main) return result;
            const originalFieldset = main.querySelector('fieldset[name="color-picker"]'); if (!originalFieldset) return result;
            originalFieldset.style.display = 'none';

            const backdrop = colorPickerShadow?.getElementById('cp-backdrop');
            if (backdrop) backdrop.style.display = 'none';

            const bcItem = (typeof ItemColorItem !== 'undefined' ? ItemColorItem : null) || _aeeItemColorItem;
            const idx = state.selectedLayer ?? 'all';
            const hexInput = main.querySelector('input[name="output"]');
            const domHex6 = hexInput?.value?.match(/^#[0-9a-fA-F]{6}$/) ? hexInput.value
                          : hexInput?.value?.match(/^#[0-9a-fA-F]{8}$/) ? hexInput.value.slice(0, 7) : null;
            colorPickerHostEl._cpIsDefault = !domHex6;
            const cachedHex = domHex6 || (bcItem ? getLayerColor(bcItem, idx) : null) || '#FFFFFF';

            const h1 = document.getElementById('color-picker-h1');
            const fullName  = h1?.querySelector('q')?.textContent;
            const layerName = fullName?.includes('/') ? fullName.split('/').pop() : fullName;

            let pickerLayerIdx = -1;
            if (layerName && _aeePickerContext?.item) {
                const layers = _aeePickerContext.item.Asset?.Layer;
                pickerLayerIdx = layers?.findIndex((l, i) =>
                    getLayerDisplayName(l, i) === layerName || l.Name === layerName || layerName.includes(l.Name)
                ) ?? -1;
            }

            let currentOpacityPct = 100;
            if (hexInput?.value?.match(/^#[0-9a-fA-F]{8}$/)) {
                currentOpacityPct = Math.round(parseInt(hexInput.value.slice(7, 9), 16) / 255 * 100);
            } else if (_aeePickerContext?.indices?.length === 1 && _aeePickerContext?.item) {
                const lIdx = pickerLayerIdx >= 0 ? pickerLayerIdx : _aeePickerContext.indices[0];
                const op = _aeePickerContext.item.Property?.Opacity?.[lIdx + 1] ?? _aeePickerContext.item.Property?.Opacity?.[lIdx];
                if (op !== undefined) currentOpacityPct = Math.round(op * 100);
            }

            openColorPicker(cachedHex, (hex) => {
                if (colorPickerHostEl._cpIsDefault) { colorPickerHostEl._cpIsDefault = false; return; }
                const cpRoot = document.getElementById('color-picker');
                if (!cpRoot) { updateColorUI(idx, hex); return; }
                const opInput  = cpRoot.querySelector('input[name="opacity"]');
                const hexInput = cpRoot.querySelector('input[name="output"]');
                if (hexInput) { hexInput.value = hex; hexInput.dispatchEvent(new Event('input', { bubbles: true })); hexInput.dispatchEvent(new Event('change', { bubbles: true })); }
                if (opInput) {
                    opInput.value = String(colorPickerHostEl?._getCpA?.() ?? 255);
                    opInput.dispatchEvent(new Event('input', { bubbles: true })); opInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                updateColorUI(idx, hex);
            }, true);
            colorPickerHostEl._cpSetColor?.(cachedHex, currentOpacityPct);
            return result;
        });
    } catch(e) {}

    try {
        modApi.hookFunction("DialogRun", 0, (args, next) => {
            aeeCheckAndRender();
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'Appearance') _hideCharCtrlPanel();
            return next(args);
        });
    } catch(e) {}

    window.addEventListener('resize', () => {
        alignHost(); alignRotOverlay(); alignOpOverlay(); _alignTouchBlocker(); positionPanel(); updateTogglePos(); positionColorPicker();
        _alignCharCtrlPanel();
        if (_bgSettingOpen) _bgSettingHost?._reposition?.();
        if (state.activeDrag === 'rot') {
            const item = getCurrentItem();
            if (item && state.selectedLayer !== null) { const lo = getLO(item, state.selectedLayer); updateRotOverlay(lo.Rotation??0); }
        }
    });


    // ============================================================
    // LSCG 圖層面板隱藏
    // ============================================================
    function _applyLscgLayersVisibility() {
        const el = document.getElementById('lscg-layers'); if (!el) return;
        el.style.display = state.hideLscgLayers ? 'none' : '';
    }

    // ============================================================
    // 背景系統
    // ============================================================
    function _hexToRgbBg(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : {r:128,g:128,b:128};
    }

    function _drawBgGrid(ctx, canvas, forceLayer) {
        if (!_bgGridEnabled) return;
        const layer = forceLayer || _bgGridLayer;
        ctx.save();
        const op = _bgGridOpacity;
        const hex = _bgGridColor || '#ffffff';
        const rgb = _hexToRgbBg(hex);
        const clr  = `rgba(${rgb.r},${rgb.g},${rgb.b},${op})`;
        const clr2 = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1, op + 0.15)})`;
        const px = _bgGridPx || 25;
        const bigPx = px * 4;
        if (_bgGridMode === 'line') {
            ctx.lineWidth = 1; ctx.strokeStyle = clr;
            for (let x = 0; x < canvas.width; x += px) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
            for (let y = 0; y < canvas.height; y += px) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
            ctx.strokeStyle = clr2; ctx.lineWidth = 1.5;
            for (let x = 0; x < canvas.width; x += bigPx) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
            for (let y = 0; y < canvas.height; y += bigPx) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }
        } else {
            const sz = px;
            for (let x = 0; x < canvas.width; x += sz) {
                for (let y = 0; y < canvas.height; y += sz) {
                    const even = (Math.floor(x/sz)+Math.floor(y/sz)) % 2 === 0;
                    const r2 = _hexToRgbBg(hex);
                    ctx.fillStyle = even
                        ? `rgba(${r2.r},${r2.g},${r2.b},${op})`
                        : `rgba(${Math.max(0,r2.r-60)},${Math.max(0,r2.g-60)},${Math.max(0,r2.b-60)},${op})`;
                    ctx.fillRect(x, y, sz, sz);
                }
            }
        }
        ctx.restore();
    }

    function _applyBgHook() {
        if (_bgOrigDrawImage) return;
        _bgOrigDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(img, ...rest) {
            if (typeof img?.src === 'string' && img.src.includes('Backgrounds/Dressing') &&
                typeof CurrentScreen !== 'undefined' && CurrentScreen === 'Appearance') {
                const cv = this.canvas;
                if (cv?.width > 0 && cv?.height > 0) {
                    this.save();
                    const hasBg = _bgEnabled || (_bgImgEnabled && _bgImgEl?.complete);
                    if (!hasBg && !_bgGridEnabled) {
                        this.restore(); return _bgOrigDrawImage.apply(this,[img,...rest]);
                    }
                    if (_bgEnabled) { this.fillStyle = _bgColor; this.fillRect(0,0,cv.width,cv.height); }
                    if (_bgImgEnabled && _bgImgEl?.complete)
                        _bgOrigDrawImage.call(this, _bgImgEl, 0,0,_bgImgEl.width,_bgImgEl.height, 0,0,cv.width,cv.height);
                    if (!hasBg) _bgOrigDrawImage.apply(this,[img,...rest]); // 無背景但有格線：先畫原背景
                    if (_bgGridLayer === 'below') _drawBgGrid(this, cv, 'below');
                    this.restore(); return;
                }
            }
            return _bgOrigDrawImage.apply(this,[img,...rest]);
        };
    }

    function _removeBgHook() {
        if (!_bgOrigDrawImage) return;
        CanvasRenderingContext2D.prototype.drawImage = _bgOrigDrawImage;
        _bgOrigDrawImage = null;
    }

    function _bgSaveAndRefresh() {
        setAeeSetting('bgEnabled',       _bgEnabled);
        setAeeSetting('bgColor',         _bgColor);
        setAeeSetting('bgGridEnabled',   _bgGridEnabled);
        setAeeSetting('bgGridMode',      _bgGridMode);
        setAeeSetting('bgGridPx',        _bgGridPx);
        setAeeSetting('bgGridColor',     _bgGridColor);
        setAeeSetting('bgGridOpacity',   _bgGridOpacity);
        setAeeSetting('bgGridLayer',     _bgGridLayer);
        setAeeSetting('bgImgEnabled',    _bgImgEnabled);
        setAeeSetting('bgImgBtnVisible', _bgImgBtnVisible);
        setAeeSetting('bgImgUrl',        _bgImgUrl);
        const needHook = _bgEnabled || (_bgImgEnabled && _bgImgEl?.complete) || _bgGridEnabled;
        if (needHook) _applyBgHook(); else _removeBgHook();
        const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
        if (C) { try { CharacterLoadCanvas(C); } catch(e) {} }
        _rebuildCharCtrlButtons();
        _syncBgSettingPanel();
    }

    function _loadBgImage(url) {
        _bgImgEl = null; if (!url) return;
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => { _bgImgEl = img; _bgSaveAndRefresh(); };
        img.onerror = () => { _bgImgEl = null; };
        img.src = url;
    }

    // 初始化背景 hook
    if (_bgImgEnabled && _bgImgUrl) _loadBgImage(_bgImgUrl);
    if (_bgEnabled || _bgGridEnabled) _applyBgHook();

    // ── 背景設定面板 ──
    // ── 背景子按鈕列展開狀態（BG主按鈕控制）──
    function _buildBgSettingPanel() {
        if (_bgSettingHost) return;
        _bgSettingHost = document.createElement('div');
        _bgSettingHost.style.cssText = 'position:fixed;z-index:999992;pointer-events:none;top:0;left:0;width:0;height:0;overflow:visible;';
        document.body.appendChild(_bgSettingHost);
        const sd = _bgSettingHost.attachShadow({ mode: 'open' });

        // AEE 風格 CSS
        const CSS = `
:host{all:initial;display:block}*{box-sizing:border-box;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',sans-serif}
#outer{position:fixed;top:0;left:0;display:none;pointer-events:none;width:0;height:0;overflow:visible}
#outer.open{display:block}
#panel{
  position:fixed;width:360px;
  background:#0d0d0f;border:1px solid #2a2a35;border-radius:12px;overflow:hidden;
  box-shadow:0 8px 32px rgba(0,0,0,0.8),0 0 0 1px rgba(124,106,247,0.1);
  pointer-events:all;
}
#drag-handle{
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 12px;background:#161619;border-bottom:1px solid #2a2a35;
  cursor:grab;flex-shrink:0;
}
#drag-handle:active{cursor:grabbing}
#hdr-title{font-size:11px;font-weight:700;color:#7c6af7;letter-spacing:.08em;text-transform:uppercase}
#close-btn{width:20px;height:20px;background:transparent;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:13px;display:flex;align-items:center;justify-content:center;line-height:1}
#close-btn:hover{border-color:#f87;color:#f87;background:rgba(255,80,80,0.1)}
.body{padding:10px 12px;display:flex;flex-direction:column;gap:10px}
/* section */
.sec{background:#161619;border:1px solid #2a2a35;border-radius:8px;overflow:hidden}
.sec-hdr{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid #1e1e23}
.sec-title{font-size:12px;font-weight:700;color:#ffffff;letter-spacing:.03em}
.sec-body{padding:8px 10px;display:flex;flex-direction:column;gap:7px}
/* toggle */
.tog-row{display:flex;align-items:center;gap:8px}
.tog{width:34px;height:18px;border-radius:9px;background:#2a2a35;position:relative;border:none;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}
.tog.on{background:#7c6af7}
.tog::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
.tog.on::after{left:18px}
.tog-label{font-size:11px;color:#a0a0b0;flex:1}
/* color chip */
.color-chip{width:30px;height:30px;border-radius:5px;border:1px solid #2a2a35;cursor:pointer;flex-shrink:0;position:relative;overflow:hidden;background:repeating-conic-gradient(#1a1a1a 0% 25%,#111 0% 50%) 0 0/6px 6px;transition:border-color .12s}
.color-chip:hover{border-color:#7c6af7}
.color-chip-fill{position:absolute;inset:0}
/* row */
.row{display:flex;align-items:center;gap:8px}
.row-label{font-size:11px;color:#a0a0b0;white-space:nowrap;min-width:52px}
.row-val{font-size:11px;color:#7c6af7;min-width:30px;text-align:right;font-variant-numeric:tabular-nums}
/* slider */
.sl{flex:1;height:3px;appearance:none;border-radius:2px;outline:none;cursor:pointer;background:#2a2a35}
.sl::-webkit-slider-thumb{appearance:none;width:13px;height:13px;border-radius:50%;background:#7c6af7;border:2px solid #fff;cursor:pointer}
/* mode btns */
.mode-row{display:flex;gap:5px}
.mode-btn{flex:1;padding:4px 2px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:10px;font-weight:600;text-align:center;transition:all .12s}
.mode-btn.active,.mode-btn:hover{border-color:#7c6af7;color:#a89ef8;background:rgba(124,106,247,0.15)}
/* layer btns */
.layer-row{display:flex;gap:5px}
.layer-btn{flex:1;padding:4px 2px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:10px;font-weight:600;text-align:center;transition:all .12s}
.layer-btn.active,.layer-btn:hover{border-color:#4ecdc4;color:#4ecdc4;background:rgba(78,205,196,0.1)}
/* url */
.url-row{display:flex;gap:6px}
.url-in{flex:1;background:#0d0d0f;border:1px solid #2a2a35;border-radius:5px;color:#fff;padding:5px 8px;font-size:11px;outline:none;font-family:'Segoe UI',sans-serif}
.url-in:focus{border-color:#7c6af7}
.url-btn,.url-del{padding:5px 10px;background:rgba(124,106,247,0.15);border:1px solid rgba(124,106,247,0.3);border-radius:5px;color:#a89ef8;cursor:pointer;font-size:10px;white-space:nowrap;font-family:'Segoe UI',sans-serif;transition:background .12s}
.url-btn:hover{background:rgba(124,106,247,0.3)}
.url-del{background:rgba(255,80,80,0.1);border-color:rgba(255,80,80,0.3);color:#f87}
.url-del:hover{background:rgba(255,80,80,0.25)}
/* px input */
.px-in{width:46px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:4px;color:#7c6af7;padding:3px 5px;font-size:11px;outline:none;text-align:center;font-family:'SF Mono','Fira Mono',monospace;user-select:text;-webkit-user-select:text}
.px-in:focus{border-color:#7c6af7}`;

        sd.innerHTML = `<style>${CSS}</style>
<div id="outer">
  <div id="panel">
    <div id="drag-handle">
      <span id="hdr-title">🎨 ${isZh()?'背景設定':'BG Settings'}</span>
      <button id="close-btn">✕</button>
    </div>
    <div class="body">
      <!-- 素色背景 -->
      <div class="sec">
        <div class="sec-hdr">
          <span class="sec-title">${isZh()?'素色背景':'Solid Color'}</span>
          <div class="tog-row">
            <button class="tog ${_bgEnabled?'on':''}" id="tog-solid"></button>
            <span class="tog-label">${_bgEnabled?(isZh()?'啟用':'ON'):(isZh()?'停用':'OFF')}</span>
          </div>
        </div>
        <div class="sec-body">
          <div class="row">
            <div class="color-chip" id="color-chip"><div class="color-chip-fill" id="color-fill" style="background:${_bgColor}"></div></div>
            <span style="font-size:11px;color:#a0a0b0;flex:1">${isZh()?'點擊選色':'Click to pick'}</span>
          </div>
        </div>
      </div>
      <!-- 格線 -->
      <div class="sec">
        <div class="sec-hdr">
          <span class="sec-title">${isZh()?'格線':'Grid'}</span>
          <div class="tog-row">
            <button class="tog ${_bgGridEnabled?'on':''}" id="tog-grid"></button>
            <span class="tog-label">${_bgGridEnabled?(isZh()?'啟用':'ON'):(isZh()?'停用':'OFF')}</span>
          </div>
        </div>
        <div class="sec-body">
          <div class="mode-row">
            <button class="mode-btn ${_bgGridMode==='line'?'active':''}" data-gm="line">☰ ${isZh()?'線格':'Line'}</button>
            <button class="mode-btn ${_bgGridMode==='checker'?'active':''}" data-gm="checker">▦ ${isZh()?'棋盤':'Checker'}</button>
          </div>
          <div class="row">
            <span class="row-label">${isZh()?'顏色':'Color'}</span>
            <div class="color-chip" id="grid-chip"><div class="color-chip-fill" id="grid-fill" style="background:${_bgGridColor}"></div></div>
          </div>
          <div class="row">
            <span class="row-label">${isZh()?'大小 (px)':'Size (px)'}</span>
            <input type="number" class="px-in" id="grid-px" min="5" max="200" step="5" value="${_bgGridPx}">
          </div>
          <div class="row">
            <span class="row-label">${isZh()?'透明度':'Opacity'}</span>
            <input type="range" class="sl" id="op-sl" min="5" max="80" step="5" value="${Math.round(_bgGridOpacity*100)}">
            <span class="row-val" id="op-val">${Math.round(_bgGridOpacity*100)}%</span>
          </div>
          <div class="row">
            <span class="row-label">${isZh()?'圖層':'Layer'}</span>
            <div class="layer-row" style="flex:1">
              <button class="layer-btn ${_bgGridLayer==='below'?'active':''}" data-gl="below">${isZh()?'人物下':'Below'}</button>
              <button class="layer-btn ${_bgGridLayer==='above'?'active':''}" data-gl="above">${isZh()?'人物上':'Above'}</button>
            </div>
          </div>
          <div class="row">
            <span class="row-label">${isZh()?'圖層透明':'Layer op'}</span>
            <input type="range" class="sl" id="layer-op-sl" min="0" max="100" step="5" value="${Math.round(_bgGridOpacity*100)}" style="background:#2a2a35">
            <span class="row-val" id="layer-op-val">${Math.round(_bgGridOpacity*100)}%</span>
          </div>
        </div>
      </div>
      <!-- 圖片背景 -->
      <div class="sec">
        <div class="sec-hdr">
          <span class="sec-title">${isZh()?'圖片背景':'Image BG'}</span>
          <div class="tog-row">
            <span class="tog-label" style="flex:1">${isZh()?'啟用':'Enable'}</span>
            <button class="tog ${_bgImgEnabled?'on':''}" id="tog-img"></button>
          </div>
        </div>
        <div class="sec-body">
          <div class="url-row">
            <input type="text" class="url-in" id="url-in" value="${_bgImgUrl||''}" placeholder="${isZh()?'圖片網址...':'Image URL...'}">
            <button class="url-btn" id="url-load">${isZh()?'載入':'Load'}</button>
            <button class="url-del" id="url-del" title="${isZh()?'清除':'Clear'}">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`;

        // ── 位置：固定在 canvas 右側 66%，每次開啟重置 ──
        function _resetPos() {
            const r = getCanvasRect(); if (!r) return;
            const panel = sd.getElementById('panel');
            panel.style.left = (r.left + r.width * 0.38) + 'px';
            panel.style.top  = (r.top  + r.height * 0.15) + 'px';
        }
        _bgSettingHost._reposition = _resetPos;

        // ── 拖移 ──
        const dragHandle = sd.getElementById('drag-handle');
        const panel = sd.getElementById('panel');
        let _bgPanelDrag = null;
        dragHandle.addEventListener('pointerdown', ev => {
            if (ev.target === sd.getElementById('close-btn')) return;
            ev.preventDefault(); dragHandle.setPointerCapture(ev.pointerId);
            _bgPanelDrag = { sx: ev.clientX, sy: ev.clientY, ol: parseFloat(panel.style.left)||0, ot: parseFloat(panel.style.top)||0 };
        });
        dragHandle.addEventListener('pointermove', ev => {
            if (!_bgPanelDrag) return;
            panel.style.left = (_bgPanelDrag.ol + ev.clientX - _bgPanelDrag.sx) + 'px';
            panel.style.top  = (_bgPanelDrag.ot + ev.clientY - _bgPanelDrag.sy) + 'px';
        });
        dragHandle.addEventListener('pointerup', () => { _bgPanelDrag = null; });

        // ── 關閉 ──
        sd.getElementById('close-btn').addEventListener('click', _closeBgSetting);

        // ── 素色 toggle ──
        const togSolid = sd.getElementById('tog-solid');
        togSolid.addEventListener('click', () => {
            _bgEnabled = !_bgEnabled;
            togSolid.classList.toggle('on', _bgEnabled);
            togSolid.nextElementSibling.textContent = _bgEnabled ? (isZh()?'啟用':'ON') : (isZh()?'停用':'OFF');
            _bgSaveAndRefresh();
        });

        // ── 素色調色盤（呼叫 AEE 調色盤，設定面板置頂確保不被蓋住）──
        sd.getElementById('color-chip').addEventListener('click', () => {
            openColorPicker(_bgColor, (hex) => {
                _bgColor = hex;
                const fill = sd.getElementById('color-fill'); if (fill) fill.style.background = hex;
                _bgSaveAndRefresh();
            }, false);
        });

        // ── 格線 toggle ──
        const togGrid = sd.getElementById('tog-grid');
        togGrid.addEventListener('click', () => {
            _bgGridEnabled = !_bgGridEnabled;
            togGrid.classList.toggle('on', _bgGridEnabled);
            togGrid.nextElementSibling.textContent = _bgGridEnabled ? (isZh()?'啟用':'ON') : (isZh()?'停用':'OFF');
            _bgSaveAndRefresh();
        });

        // ── 格線模式 ──
        sd.querySelectorAll('[data-gm]').forEach(btn => {
            btn.addEventListener('click', () => {
                _bgGridMode = btn.dataset.gm;
                sd.querySelectorAll('[data-gm]').forEach(b => b.classList.toggle('active', b.dataset.gm === _bgGridMode));
                _bgSaveAndRefresh();
            });
        });

        // ── 格線顏色 ──
        sd.getElementById('grid-chip').addEventListener('click', () => {
            openColorPicker(_bgGridColor, (hex) => {
                _bgGridColor = hex;
                const fill = sd.getElementById('grid-fill'); if (fill) fill.style.background = hex;
                _bgSaveAndRefresh();
            }, false);
        });

        // ── 格線 px ──
        const gridPxIn = sd.getElementById('grid-px');
        gridPxIn.addEventListener('change', () => {
            const v = Math.max(5, Math.min(200, parseInt(gridPxIn.value) || 25));
            _bgGridPx = v; gridPxIn.value = v; _bgSaveAndRefresh();
        });
        gridPxIn.addEventListener('mousedown', e => e.stopPropagation());
        gridPxIn.addEventListener('click', e => e.stopPropagation());

        // ── 格線透明度 ──
        const opSl = sd.getElementById('op-sl'), opValEl = sd.getElementById('op-val');
        opSl.addEventListener('input', () => {
            const v = parseInt(opSl.value);
            _bgGridOpacity = v / 100;
            opValEl.textContent = v + '%';
            _bgSaveAndRefresh();
        });

        // ── 格線圖層 ──
        sd.querySelectorAll('[data-gl]').forEach(btn => {
            btn.addEventListener('click', () => {
                _bgGridLayer = btn.dataset.gl;
                sd.querySelectorAll('[data-gl]').forEach(b => b.classList.toggle('active', b.dataset.gl === _bgGridLayer));
                _bgSaveAndRefresh();
            });
        });

        const layerOpSl = sd.getElementById('layer-op-sl');
        const layerOpVal = sd.getElementById('layer-op-val');
        if (layerOpSl) layerOpSl.addEventListener('input', () => {
            const v = parseInt(layerOpSl.value);
            _bgGridOpacity = v / 100;
            if (layerOpVal) layerOpVal.textContent = v + '%';
            // 同步上方透明度 slider
            const opSl2 = sd.getElementById('op-sl');
            const opVal2 = sd.getElementById('op-val');
            if (opSl2) opSl2.value = v;
            if (opVal2) opVal2.textContent = v + '%';
            _bgSaveAndRefresh();
        });

        // ── 圖片顯示按鈕 toggle ──
        // ── 圖片啟用 toggle ──
        const togImg = sd.getElementById('tog-img');
        togImg.addEventListener('click', () => {
            _bgImgEnabled = !_bgImgEnabled;
            togImg.classList.toggle('on', _bgImgEnabled);
            _bgSaveAndRefresh();
        });

        // ── 載入圖片 ──
        sd.getElementById('url-load').addEventListener('click', () => {
            const url = sd.getElementById('url-in').value.trim(); if (!url) return;
            _bgImgUrl = url; _loadBgImage(url);
        });

        // ── 清除圖片 ──
        sd.getElementById('url-del').addEventListener('click', () => {
            _bgImgUrl = ''; _bgImgEnabled = false; _bgImgEl = null;
            sd.getElementById('url-in').value = '';
            togImg.classList.remove('on');
            _bgSaveAndRefresh();
        });
    }

    function _syncBgSettingPanel() {
        if (!_bgSettingHost) return;
        const sd = _bgSettingHost.shadowRoot;
        const fill = sd?.getElementById('color-fill'); if (fill) fill.style.background = _bgColor;
        const gfill = sd?.getElementById('grid-fill'); if (gfill) gfill.style.background = _bgGridColor;
    }

        function _syncBgSettingPanel() {
        if (!_bgSettingHost) return;
        const fill = _bgSettingHost.shadowRoot?.getElementById('color-fill');
        if (fill) fill.style.background = _bgColor;
    }

    function _openBgSetting() {
        _buildBgSettingPanel(); _bgSettingOpen = true;
        const outer = _bgSettingHost.shadowRoot.getElementById('outer');
        if (outer) outer.classList.add('open');
        _bgSettingHost.style.pointerEvents = 'auto';
        requestAnimationFrame(() => { _bgSettingHost._reposition?.(); });
    }

    function _closeBgSetting() {
        _bgSettingOpen = false;
        _bgSettingHost?.shadowRoot?.getElementById('outer')?.classList.remove('open');
        if (_bgSettingHost) _bgSettingHost.style.pointerEvents = 'none';
        _rebuildCharCtrlButtons();
    }

    // ============================================================
    // 位移面板（CharOffset）
    // ============================================================
    function _buildOffsetPanel() {
        if (_offsetPanelHost) return;
        _offsetPanelHost = document.createElement('div');
        _offsetPanelHost.style.cssText = 'position:fixed;z-index:999993;pointer-events:none;top:0;left:0;width:0;height:0;overflow:visible;';
        document.body.appendChild(_offsetPanelHost);
        const sd = _offsetPanelHost.attachShadow({ mode: 'open' });

        sd.innerHTML = `
<style>
  :host{all:initial;display:block}*{box-sizing:border-box;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',sans-serif}
  #win{position:fixed;width:260px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:10px;display:none;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.8);overflow:hidden}
  #win.open{display:flex}
  #hdr{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#161619;border-bottom:1px solid #2a2a35;cursor:grab;flex-shrink:0}
  #hdr:active{cursor:grabbing}
  #hdr-title{font-size:11px;font-weight:700;color:#7c6af7;letter-spacing:.06em;text-transform:uppercase}
  .hdr-btns{display:flex;gap:5px}
  .hdr-btn{width:22px;height:22px;background:transparent;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:11px;display:flex;align-items:center;justify-content:center;transition:border-color .12s,color .12s}
  .hdr-btn:hover{border-color:#7c6af7;color:#a89ef8}
  .hdr-btn.active{border-color:#7c6af7;color:#a89ef8;background:rgba(124,106,247,0.15)}
  #body{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
  #body.collapsed{display:none}
  .row{display:flex;align-items:center;gap:6px}
  .row-label{font-size:11px;color:#a0a0b0;width:36px;flex-shrink:0}
  .row-val{font-size:11px;color:#7c6af7;min-width:36px;text-align:right;font-variant-numeric:tabular-nums}
  .sl{flex:1;height:3px;appearance:none;border-radius:2px;outline:none;cursor:pointer;background:#2a2a35}
  .sl::-webkit-slider-thumb{appearance:none;width:13px;height:13px;border-radius:50%;background:#7c6af7;border:2px solid #fff;cursor:pointer}
  .reset-btn{width:22px;height:22px;background:transparent;border:1px solid #2a2a35;border-radius:3px;cursor:pointer;color:#a0a0b0;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .12s,color .12s}
  .reset-btn:hover{border-color:#f87;color:#f87}
  .divider{height:1px;background:#1e1e23;margin:2px 0}
  .wheel-row{display:flex;align-items:center;justify-content:space-between;gap:6px}
  .wheel-label{font-size:11px;color:#a0a0b0;flex:1}
  .tog{width:34px;height:18px;border-radius:9px;background:#2a2a35;position:relative;border:none;cursor:pointer;padding:0;transition:background .15s;flex-shrink:0}
  .tog.on{background:#7c6af7}
  .tog::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
  .tog.on::after{left:18px}
  .hint{font-size:9px;color:#555;line-height:1.4}
</style>
<div id="win">
  <div id="hdr">
    <span id="hdr-title">⟳ ${isZh()?'位移控制':'Offset'}</span>
    <div class="hdr-btns">
      <button class="hdr-btn" id="lock-btn" title="${isZh()?'收納/展開':'Collapse'}">▼</button>
      <button class="hdr-btn" id="reset-all-btn" title="${isZh()?'全部重置':'Reset All'}">↺</button>
      <button class="hdr-btn" id="close-btn">✕</button>
    </div>
  </div>
  <!-- 小地圖（canvas 2:1，人物區域約 1:2，顯示人物在哪裡）-->
  <div id="minimap-wrap" style="padding:6px 10px 0;background:#0d0d0f">
    <div id="minimap" style="
      position:relative;width:100%;height:120px;
      background:#111;border:1px solid #2a2a35;border-radius:4px;
      cursor:crosshair;overflow:visible;flex-shrink:0;
    ">
      <!-- 人物指示點 -->
      <div id="mm-char" style="
        position:absolute;width:10px;height:10px;border-radius:50%;
        background:#7c6af7;border:2px solid #fff;transform:translate(-50%,-50%);
        pointer-events:none;transition:left .05s,top .05s;
      "></div>
      <!-- 視圖框（遊戲顯示區，固定為整個 canvas，這裡不需要但保留擴展空間）-->
    </div>
    <div style="font-size:9px;color:#444;text-align:center;margin-top:2px;letter-spacing:.03em">
      ${isZh()?'點擊/拖移移動人物':'Click/drag to move character'}
    </div>
  </div>
  <div id="body">
    <div class="row">
      <span class="row-label">${isZh()?'左右':'X'}</span>
      <input type="range" class="sl" id="sl-x" min="-700" max="800" step="10" value="0">
      <span class="row-val" id="val-x">0</span>
      <button class="reset-btn" id="reset-x">↺</button>
    </div>
    <div class="row">
      <span class="row-label">${isZh()?'上下':'Y'}</span>
      <input type="range" class="sl" id="sl-y" min="-2000" max="2000" step="10" value="0">
      <span class="row-val" id="val-y">0</span>
      <button class="reset-btn" id="reset-y">↺</button>
    </div>
    <div class="row">
      <span class="row-label">${isZh()?'縮放':'Scale'}</span>
      <input type="range" class="sl" id="sl-sc" min="20" max="500" step="5" value="100">
      <span class="row-val" id="val-sc">100%</span>
      <button class="reset-btn" id="reset-sc">↺</button>
    </div>
    <div class="divider"></div>
    <div class="wheel-row">
      <span class="wheel-label">${isZh()?'滾輪/鍵盤控制':'Wheel/Key ctrl'}</span>
      <button class="tog" id="tog-wheel"></button>
    </div>
    <div class="hint" id="wheel-hint" style="display:none">${isZh()?'滾輪按住/空白鍵=移動\n滾動/Ctrl+±=縮放':'Hold wheel/Space=Move\nScroll/Ctrl+±=Scale'}</div>
  </div>
</div>`;

        const win  = sd.getElementById('win');
        const hdr  = sd.getElementById('hdr');
        const body = sd.getElementById('body');

        // 小地圖互動
        const minimap = sd.getElementById('minimap');
        const mmChar  = sd.getElementById('mm-char');

        // X: -700~+800 (range 1500), offset=0 → 700/1500≈46.7%
        // Y: -2000~+2000 (range 4000), offset=0 → 50%
        const MM_X_MIN = -700, MM_X_MAX = 800, MM_X_RANGE = 1500;
        const MM_Y_MIN = -2000, MM_Y_MAX = 2000, MM_Y_RANGE = 4000;

        function _updateMinimap() {
            if (!minimap || !mmChar) return;
            const px = Math.max(2, Math.min(98, ((_charOffsetX - MM_X_MIN) / MM_X_RANGE) * 100));
            const py = Math.max(2, Math.min(98, ((_charOffsetY - MM_Y_MIN) / MM_Y_RANGE) * 100));
            mmChar.style.left = px + '%';
            mmChar.style.top  = py + '%';
        }

        function _minimapToOffset(clientX, clientY) {
            const r = minimap.getBoundingClientRect();
            const rx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
            const ry = Math.max(0, Math.min(1, (clientY - r.top)  / r.height));
            _charOffsetX = Math.round(MM_X_MIN + rx * MM_X_RANGE);
            _charOffsetY = Math.round(MM_Y_MIN + ry * MM_Y_RANGE);
            setAeeSetting('charOffsetX', _charOffsetX);
            setAeeSetting('charOffsetY', _charOffsetY);
            _syncSliders(); _updateMinimap(); _rebuildCharCtrlButtons();
        }

        let _mmDragging = false;
        minimap.addEventListener('pointerdown', ev => {
            _mmDragging = true; minimap.setPointerCapture(ev.pointerId);
            _minimapToOffset(ev.clientX, ev.clientY); ev.preventDefault();
        });
        minimap.addEventListener('pointermove', ev => {
            if (!_mmDragging) return;
            _minimapToOffset(ev.clientX, ev.clientY);
        });
        minimap.addEventListener('pointerup', () => { _mmDragging = false; });

        // 同步 slider 初始值
        function _syncSliders() {
            const slX = sd.getElementById('sl-x'), slY = sd.getElementById('sl-y'), slSc = sd.getElementById('sl-sc');
            const vX  = sd.getElementById('val-x'),vY  = sd.getElementById('val-y'),vSc  = sd.getElementById('val-sc');
            if (slX)  { slX.value = _charOffsetX;  if (vX)  vX.textContent  = (_charOffsetX>0?'+':'')+_charOffsetX; }
            if (slY)  { slY.value = Math.max(-2000, Math.min(2000, _charOffsetY));  if (vY)  vY.textContent  = (_charOffsetY>0?'+':'')+_charOffsetY; }
            if (slSc) { slSc.value = Math.round(_charScale*100); if (vSc) vSc.textContent = Math.round(_charScale*100)+'%'; }
            const tog = sd.getElementById('tog-wheel');
            if (tog) tog.classList.toggle('on', _wheelCtrlOn);
            const hint = sd.getElementById('wheel-hint');
            if (hint) hint.style.display = _wheelCtrlOn ? 'block' : 'none';
            _updateMinimap();
        }
        _syncSliders();

        // X slider
        const slX = sd.getElementById('sl-x');
        slX.addEventListener('input', () => {
            _charOffsetX = parseInt(slX.value);
            sd.getElementById('val-x').textContent = (_charOffsetX>0?'+':'')+_charOffsetX;
            setAeeSetting('charOffsetX', _charOffsetX);
            _updateMinimap(); _rebuildCharCtrlButtons();
        });
        // Y slider
        const slY = sd.getElementById('sl-y');
        slY.addEventListener('input', () => {
            _charOffsetY = parseInt(slY.value);
            sd.getElementById('val-y').textContent = (_charOffsetY>0?'+':'')+_charOffsetY;
            setAeeSetting('charOffsetY', _charOffsetY);
            _updateMinimap(); _rebuildCharCtrlButtons();
        });
        // Scale slider
        const slSc = sd.getElementById('sl-sc');
        slSc.addEventListener('input', () => {
            _charScale = parseInt(slSc.value) / 100;
            sd.getElementById('val-sc').textContent = Math.round(_charScale*100)+'%';
            setAeeSetting('charScale', _charScale);
            _rebuildCharCtrlButtons();
        });
        // Reset buttons
        sd.getElementById('reset-x').addEventListener('click', () => {
            _charOffsetX = 0; slX.value = 0; sd.getElementById('val-x').textContent = '0';
            setAeeSetting('charOffsetX', 0); _rebuildCharCtrlButtons();
        });
        sd.getElementById('reset-y').addEventListener('click', () => {
            _charOffsetY = 0; slY.value = 0; sd.getElementById('val-y').textContent = '0';
            setAeeSetting('charOffsetY', 0); _rebuildCharCtrlButtons();
        });
        sd.getElementById('reset-sc').addEventListener('click', () => {
            _charScale = 1; slSc.value = 100; sd.getElementById('val-sc').textContent = '100%';
            setAeeSetting('charScale', 1); _rebuildCharCtrlButtons();
        });
        sd.getElementById('reset-all-btn').addEventListener('click', () => {
            _charOffsetX = 0; _charOffsetY = 0; _charScale = 1;
            setAeeSetting('charOffsetX', 0); setAeeSetting('charOffsetY', 0); setAeeSetting('charScale', 1);
            _syncSliders(); _updateMinimap(); _rebuildCharCtrlButtons();
        });

        // 滾輪/鍵盤開關
        const togWheel = sd.getElementById('tog-wheel');
        togWheel.addEventListener('click', () => {
            _wheelCtrlOn = !_wheelCtrlOn;
            togWheel.classList.toggle('on', _wheelCtrlOn);
            const hint = sd.getElementById('wheel-hint');
            if (hint) hint.style.display = _wheelCtrlOn ? 'block' : 'none';
        });

        // 收納/展開
        const lockBtn = sd.getElementById('lock-btn');
        lockBtn.addEventListener('click', () => {
            _offsetPanelCollapsed = !_offsetPanelCollapsed;
            body.style.display = _offsetPanelCollapsed ? 'none' : '';
            lockBtn.textContent = _offsetPanelCollapsed ? '▲' : '▼';
        });

        // 關閉
        sd.getElementById('close-btn').addEventListener('click', _closeOffsetPanel);

        // 拖移
        let _opDrag = null;
        hdr.addEventListener('pointerdown', ev => {
            if (ev.target !== hdr && !ev.target.classList.contains('hdr-title') && ev.target.id !== 'hdr-title') {
                if (ev.target.closest('.hdr-btn')) return;
            }
            ev.preventDefault(); hdr.setPointerCapture(ev.pointerId);
            _opDrag = { sx: ev.clientX, sy: ev.clientY, ol: parseFloat(win.style.left)||0, ot: parseFloat(win.style.top)||0 };
        });
        hdr.addEventListener('pointermove', ev => {
            if (!_opDrag) return;
            win.style.left = (_opDrag.ol + ev.clientX - _opDrag.sx) + 'px';
            win.style.top  = (_opDrag.ot + ev.clientY - _opDrag.sy) + 'px';
        });
        hdr.addEventListener('pointerup', () => { _opDrag = null; });

        _offsetPanelHost._syncSliders   = _syncSliders;
        _offsetPanelHost._updateMinimap = _updateMinimap;
    }

    function _openOffsetPanel() {
        _buildOffsetPanel(); _offsetPanelOpen = true;
        _offsetPanelHost.style.pointerEvents = 'auto';
        const win = _offsetPanelHost.shadowRoot?.getElementById('win');
        if (win) {
            win.classList.add('open');
            if (!win.style.left) {
                const r = getCanvasRect();
                if (r) {
                    win.style.left = (r.left + r.width * 0.40) + 'px';
                    win.style.top  = (r.top  + r.height * 0.30) + 'px';
                }
            }
        }
        _offsetPanelHost._syncSliders?.();
        _rebuildCharCtrlButtons();
    }

    function _closeOffsetPanel() {
        _offsetPanelOpen = false;
        if (_offsetPanelHost) _offsetPanelHost.style.pointerEvents = 'none';
        _offsetPanelHost?.shadowRoot?.getElementById('win')?.classList.remove('open');
        _rebuildCharCtrlButtons();
    }

    // 滾輪+鍵盤控制人物（_wheelCtrlOn 啟用時）
    (function() {
        let _spaceDown = false;
        let _wheelBtnDown = false;

        // ── 鍵盤 ──
        document.addEventListener('keydown', e => {
            if (!_wheelCtrlOn) return;
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'Appearance') return;
            if (e.code === 'Space' && !e.repeat) { _spaceDown = true; e.preventDefault(); }
            if (e.ctrlKey && (e.code === 'Equal' || e.code === 'NumpadAdd')) {
                _charScale = Math.min(5, +(_charScale + 0.05).toFixed(2));
                setAeeSetting('charScale', _charScale);
                _offsetPanelHost?._syncSliders?.(); _rebuildCharCtrlButtons(); e.preventDefault();
            }
            if (e.ctrlKey && (e.code === 'Minus' || e.code === 'NumpadSubtract')) {
                _charScale = Math.max(0.1, +(_charScale - 0.05).toFixed(2));
                setAeeSetting('charScale', _charScale);
                _offsetPanelHost?._syncSliders?.(); _rebuildCharCtrlButtons(); e.preventDefault();
            }
        }, true);
        document.addEventListener('keyup', e => {
            if (e.code === 'Space') _spaceDown = false;
        }, true);

        // ── 滾輪中鍵 + 空白鍵左鍵 → mousemove 拖移 ──
        document.addEventListener('mousedown', e => {
            if (!_wheelCtrlOn) return;
            if (e.button === 1) { _wheelBtnDown = true; e.preventDefault(); }
        }, true);
        document.addEventListener('mouseup', e => {
            if (e.button === 1) _wheelBtnDown = false;
        }, true);
        document.addEventListener('mousemove', e => {
            if (!_wheelCtrlOn) return;
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'Appearance') return;
            const isDragging = _wheelBtnDown || (_spaceDown && e.buttons === 1);
            if (!isDragging) return;
            const c = getCanvas(); if (!c) return;
            const r = c.getBoundingClientRect();
            const sc = (c.width || 2000) / r.width;
            _charOffsetX = Math.max(-700,  Math.min(800,  _charOffsetX + Math.round(e.movementX * sc)));
            _charOffsetY = Math.max(-2000, Math.min(2000, _charOffsetY + Math.round(e.movementY * sc)));
            setAeeSetting('charOffsetX', _charOffsetX);
            setAeeSetting('charOffsetY', _charOffsetY);
            _offsetPanelHost?._syncSliders?.(); _offsetPanelHost?._updateMinimap?.(); _rebuildCharCtrlButtons();
        }, true);

        // ── 滾輪 → 縮放（以滑鼠位置為中心點）──
        document.addEventListener('wheel', e => {
            if (!_wheelCtrlOn) return;
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'Appearance') return;
            if (_spaceDown || _wheelBtnDown) return;
            const c = getCanvas(); if (!c) return;
            const r = c.getBoundingClientRect();
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
            e.preventDefault();
            const oldScale = _charScale;
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            const newScale = Math.max(0.1, Math.min(5, +(oldScale + delta).toFixed(2)));
            if (newScale === oldScale) return;
            // 計算滑鼠在 canvas 上的位置（canvas 座標，2000x1000）
            const cw = c.width || 2000, ch = c.height || 1000;
            const mouseCanvasX = (e.clientX - r.left) / r.width * cw;
            const mouseCanvasY = (e.clientY - r.top)  / r.height * ch;
            // 縮放以滑鼠位置為中心，調整 offset 使滑鼠指向的點保持不動
            // 人物繪製參考點約在 canvas (500, 0)，offset 是相對偏移
            const CHAR_BASE_X = 500, CHAR_BASE_Y = 0;
            const pivotX = mouseCanvasX - CHAR_BASE_X;
            const pivotY = mouseCanvasY - CHAR_BASE_Y;
            const ratio = newScale / oldScale;
            _charOffsetX = Math.round(pivotX + (_charOffsetX - pivotX) * ratio);
            _charOffsetY = Math.round(pivotY + (_charOffsetY - pivotY) * ratio);
            _charScale = newScale;
            setAeeSetting('charScale', _charScale);
            setAeeSetting('charOffsetX', _charOffsetX);
            setAeeSetting('charOffsetY', _charOffsetY);
            _offsetPanelHost?._syncSliders?.(); _offsetPanelHost?._updateMinimap?.(); _rebuildCharCtrlButtons();
        }, { passive: false });
    })();

        // ============================================================
    // POSE 浮動視窗
    // ============================================================
    const _POSES = [
        {name:'BaseUpper',      zh:'放鬆手臂', en:'Arms Relaxed'},
        {name:'Yoked',          zh:'高舉雙手', en:'Hands Raised'},
        {name:'OverTheHead',    zh:'雙手過頭', en:'Over Head'},
        {name:'BackBoxTie',     zh:'反綁雙手', en:'Box Tie'},
        {name:'BackElbowTouch', zh:'肘部相觸', en:'Elbow Touch'},
        {name:'BackCuffs',      zh:'右手反抓', en:'Back Cuffs'},
        {name:'BaseLower',      zh:'站立',     en:'Standing'},
        {name:'LegsClosed',     zh:'併腿',     en:'Legs Closed'},
        {name:'Kneel',          zh:'跪下',     en:'Kneeling'},
        {name:'KneelingSpread', zh:'跪姿分腿', en:'Kneeling Spread'},
        {name:'AllFours',       zh:'趴跪',     en:'All Fours'},
    ];

    function _getPoseIconURL(name) {
        const href = window.location.href;
        return href.substring(0, href.lastIndexOf('/')+1) + 'Icons/Poses/' + name + '.png';
    }

    function _buildPoseWindow() {
        if (_poseFloatHost) return;
        _poseFloatHost = document.createElement('div');
        _poseFloatHost.style.cssText = 'position:fixed;z-index:999990;pointer-events:none;top:0;left:0;width:0;height:0;overflow:visible;';
        document.body.appendChild(_poseFloatHost);
        const sd = _poseFloatHost.attachShadow({ mode: 'open' });
        const BTN=58, GAP=6, COLS=4;

        sd.innerHTML = `
<style>
  :host{all:initial;display:block}*{box-sizing:border-box;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',sans-serif}
  #win{position:absolute;pointer-events:all;background:#0d0d0f;border:1px solid #2a2a35;border-radius:10px;display:none;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.8);width:${COLS*(BTN+GAP)-GAP+20}px}
  #win.open{display:flex}
  #header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#161619;border-bottom:1px solid #2a2a35;border-radius:9px 9px 0 0;cursor:grab;flex-shrink:0}
  #header:active{cursor:grabbing}
  #title{font-size:11px;font-weight:700;color:#7c6af7;letter-spacing:.06em;text-transform:uppercase}
  #close-btn{width:20px;height:20px;background:transparent;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:13px;display:flex;align-items:center;justify-content:center;transition:border-color .12s,color .12s}
  #close-btn:hover{border-color:#f87;color:#f87}
  #grid{display:grid;grid-template-columns:repeat(${COLS},${BTN}px);gap:${GAP}px;padding:10px}
  .pb{width:${BTN}px;height:${BTN}px;padding:2px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:7px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:background .12s,border-color .12s;overflow:hidden}
  .pb:hover,.pb.active{background:rgba(124,106,247,0.35);border-color:#7c6af7}
  .pb img{width:${BTN-16}px;height:${BTN-16}px;object-fit:contain;pointer-events:none;display:block}
  .pn{font-size:7px;color:#a0a0b0;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;padding:0 2px;pointer-events:none}
  .pb.active .pn{color:#a89ef8}
</style>
<div id="win">
  <div id="header">
    <span id="title">🧍 ${isZh()?'POSE 選擇':'Pose Select'}</span>
    <button id="close-btn">✕</button>
  </div>
  <div id="grid"></div>
</div>`;

        const win = sd.getElementById('win'), header = sd.getElementById('header');
        const grid = sd.getElementById('grid');

        _POSES.forEach((pose, idx) => {
            const btn = document.createElement('button');
            btn.className = 'pb'; btn.dataset.poseIdx = idx;
            btn.title = isZh() ? pose.zh : pose.en;
            const img = document.createElement('img');
            img.src = _getPoseIconURL(pose.name); img.alt = pose.name;
            img.onerror = () => { img.style.display = 'none'; };
            const name = document.createElement('div');
            name.className = 'pn'; name.textContent = isZh() ? pose.zh : pose.en;
            btn.appendChild(img); btn.appendChild(name);
            btn.addEventListener('click', () => _applyPose(idx));
            grid.appendChild(btn);
        });

        sd.getElementById('close-btn').addEventListener('click', _closePoseWindow);

        let _wd = null;
        header.addEventListener('pointerdown', ev => {
            if (ev.target === sd.getElementById('close-btn')) return;
            ev.preventDefault(); header.setPointerCapture(ev.pointerId);
            _wd = { sx: ev.clientX, sy: ev.clientY, ol: parseFloat(win.style.left)||0, ot: parseFloat(win.style.top)||0 };
        });
        header.addEventListener('pointermove', ev => {
            if (!_wd) return;
            win.style.left = (_wd.ol + ev.clientX - _wd.sx)+'px';
            win.style.top  = (_wd.ot + ev.clientY - _wd.sy)+'px';
        });
        header.addEventListener('pointerup', () => { _wd = null; });

        _poseFloatHost._updateActive = (activeIdx) => {
            sd.querySelectorAll('.pb').forEach(b => b.classList.toggle('active', parseInt(b.dataset.poseIdx) === activeIdx));
        };
    }

    function _applyPose(idx) {
        const pose = _POSES[idx]; if (!pose) return;
        try {
            const C = typeof CharacterAppearanceSelection !== 'undefined' ? CharacterAppearanceSelection : null;
            const target = C || (typeof Player !== 'undefined' ? Player : null);
            if (!target) return;
            if (typeof CharacterSetActivePose === 'function') {
                CharacterSetActivePose(target, pose.name);
                if (typeof CharacterRefresh === 'function') CharacterRefresh(target);
            }
            _poseFloatHost?._updateActive(idx);
        } catch(e) {}
    }

    function _openPoseWindow() {
        _buildPoseWindow(); _poseFloatOpen = true;
        _poseFloatHost.style.pointerEvents = 'auto';
        const win = _poseFloatHost.shadowRoot?.getElementById('win');
        if (win) {
            win.classList.add('open');
            if (!win.style.left) {
                const r = getCanvasRect();
                if (r) { win.style.left = Math.round(r.left + r.width*0.36)+'px'; win.style.top = Math.round(r.top + r.height*0.08)+'px'; }
            }
        }
        _rebuildCharCtrlButtons();
    }

    function _closePoseWindow() {
        _poseFloatOpen = false;
        if (_poseFloatHost) _poseFloatHost.style.pointerEvents = 'none';
        _poseFloatHost?.shadowRoot?.getElementById('win')?.classList.remove('open');
        _rebuildCharCtrlButtons();
    }

    // ============================================================
    // 更衣室視圖控制浮動面板（CharCtrl）
    // ============================================================
    function _updateExpandDirection() {
        if (!_charCtrlShadow) return;
        const sd2      = _charCtrlShadow;
        const expanded = sd2.getElementById('expanded');
        // bg-row 和 hide-row 已改為 absolute 定位，不再需要 flexDirection 控制
        if (!expanded) return;

        // 上/下展開
        expanded.style.left = '0px';
        expanded.style.removeProperty('right');
        if (_ctrlExpandUp) {
            expanded.style.removeProperty('top');
            expanded.style.bottom = (_CTRL_BTN_SIZE + 8) + 'px';
            expanded.style.flexDirection = 'column-reverse';
        } else {
            expanded.style.removeProperty('bottom');
            expanded.style.top = (_CTRL_BTN_SIZE + 8) + 'px';
            expanded.style.flexDirection = 'column';
        }

        // 子清單左/右展開：absolute 定位，直接設 left 或 right
        const S2 = _CTRL_BTN_SIZE;
        const gap2 = 6;
        const bgSubEl   = _charCtrlShadow?.getElementById('bg-sub');
        const hideSubEl = _charCtrlShadow?.getElementById('hide-sub');
        if (_ctrlSubLeft) {
            // 向左：sub 出現在主按鈕左邊
            if (bgSubEl)   { bgSubEl.style.left = 'auto'; bgSubEl.style.right = (S2 + gap2) + 'px'; bgSubEl.style.flexDirection = 'row-reverse'; }
            if (hideSubEl) { hideSubEl.style.left = 'auto'; hideSubEl.style.right = (S2 + gap2) + 'px'; hideSubEl.style.flexDirection = 'row-reverse'; }
        } else {
            // 向右：sub 出現在主按鈕右邊
            if (bgSubEl)   { bgSubEl.style.left = (S2 + gap2) + 'px'; bgSubEl.style.right = 'auto'; bgSubEl.style.flexDirection = 'row'; }
            if (hideSubEl) { hideSubEl.style.left = (S2 + gap2) + 'px'; hideSubEl.style.right = 'auto'; hideSubEl.style.flexDirection = 'row'; }
        }
        // expanded 本身靠左（所有主按鈕 X = main-btn X）
        expanded.style.alignItems = 'flex-start';
    }

    function _buildCharCtrlPanel() {
        if (_charCtrlHost) return;
        _charCtrlHost = document.createElement('div');
        _charCtrlHost.style.cssText = 'position:fixed;z-index:999995;pointer-events:none;';
        document.body.appendChild(_charCtrlHost);
        _charCtrlShadow = _charCtrlHost.attachShadow({ mode: 'open' });
        const S = _CTRL_BTN_SIZE;

        _charCtrlShadow.innerHTML = `
<style>
  :host{all:initial;display:block}*{box-sizing:border-box;user-select:none;-webkit-user-select:none;font-family:'Segoe UI',sans-serif}
  #wrap{position:absolute;width:${S}px;height:${S}px;pointer-events:none}
  #main-btn{position:absolute;top:0;left:0;width:${S}px;height:${S}px;cursor:grab;pointer-events:all;border-radius:8px;overflow:hidden;border:none;background:transparent;padding:0}
  #main-btn:active{cursor:grabbing;opacity:0.85}
  #main-btn img{width:100%;height:100%;display:block;pointer-events:none}
  #expanded{position:absolute;display:none;flex-direction:column-reverse;gap:6px;pointer-events:none;align-items:flex-start}
  #expanded.open{display:flex}
  #offset-row,#bg-row,#hide-row{display:flex;flex-direction:row;align-items:center;gap:6px;pointer-events:all}
  .char-btn-row{display:flex;pointer-events:all}
  .ctrl-btn{width:${S}px;height:${S}px;flex-shrink:0;position:relative;cursor:pointer;pointer-events:all;border:none;background:transparent;padding:0;border-radius:8px;overflow:hidden}
  .ctrl-btn .frame{position:absolute;inset:0;background-image:url('${_CTRL_ICON_FRAME}');background-size:100% 100%;pointer-events:none}
  .ctrl-btn .icon{position:absolute;inset:8px;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .ctrl-btn .icon svg{width:28px;height:28px}
  .ctrl-btn .label{position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.9);pointer-events:none;letter-spacing:.04em}
  .ctrl-btn.active .frame{filter:hue-rotate(160deg) brightness(1.3)}
  #bg-sub,#hide-sub{
    display:none;flex-direction:row;gap:4px;pointer-events:all;
    position:absolute;top:0;
  }
  #bg-sub.open,#hide-sub.open{display:flex;}
  .sub-btn{width:${S}px;height:${S}px;flex-shrink:0;position:relative;cursor:pointer;pointer-events:all;border:none;background:transparent;padding:0;border-radius:8px;overflow:hidden}
  .sub-btn .frame{position:absolute;inset:0;background-image:url('${_CTRL_ICON_FRAME}');background-size:100% 100%;pointer-events:none}
  .sub-btn .icon{position:absolute;inset:8px;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .sub-btn .icon svg{width:28px;height:28px}
  .sub-btn .label{position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.9);pointer-events:none;letter-spacing:.04em}
  .sub-btn.active .frame{filter:hue-rotate(160deg) brightness(1.3)}
</style>
<div id="wrap">
  <button id="main-btn" title="${isZh()?'視圖控制':'View Control'}">
    <img src="${_CTRL_ICON_MAIN}" alt="AEE">
  </button>
  <div id="expanded">
    <!-- 位移按鈕 -->
    <div class="char-btn-row">
      <button class="ctrl-btn ${_charOffsetX||_charOffsetY||_charScale!==1?'active':''}" id="btn-offset" title="${isZh()?'位移':'Offset'}">
        <div class="frame"></div>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M5 12l4-4M5 12l4 4M19 12l-4-4M19 12l-4 4"/><path d="M12 5v14M8 9l4-4 4 4M8 15l4 4 4-4"/></svg></div>
        <div class="label">${isZh()?'位移':'Offset'}</div>
      </button>
    </div>
    <!-- 背景：btn-bg + 絕對定位的 bg-sub -->
    <div class="char-btn-row" style="position:relative">
      <button class="ctrl-btn ${_bgEnabled||_bgGridEnabled?'active':''}" id="btn-bg" title="${isZh()?'背景':'BG'}">
        <div class="frame"></div>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#fff" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg></div>
        <div class="label">${isZh()?'背景':'BG'}</div>
      </button>
      <div id="bg-sub" style="display:none;position:absolute;top:0;left:${S+6}px;flex-direction:row;gap:4px">
        <button class="sub-btn ${_bgEnabled?'active':''}" id="sub-solid" title="${isZh()?'素色':'Solid'}">
          <div class="frame"></div>
          <div class="icon"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3" fill="#fff" opacity="0.8"/></svg></div>
          <div class="label">${isZh()?'素色':'Solid'}</div>
        </button>
        <button class="sub-btn ${_bgGridEnabled?'active':''}" id="sub-grid" title="${isZh()?'格線':'Grid'}">
          <div class="frame"></div>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M3 8h18M3 16h18M8 3v18M16 3v18"/></svg></div>
          <div class="label">${isZh()?'格線':'Grid'}</div>
        </button>
        <button class="sub-btn ${_bgImgEnabled?'active':''}" id="sub-img" title="${isZh()?'圖片':'Image'}" style="display:block">
          <div class="frame"></div>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="#fff" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg></div>
          <div class="label">${isZh()?'圖片':'Image'}</div>
        </button>
        <button class="sub-btn ${_bgSettingOpen?'active':''}" id="sub-setting" title="${isZh()?'設定':'Setting'}">
          <div class="frame"></div>
          <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
          <div class="label">${isZh()?'設定':'Setting'}</div>
        </button>
      </div>
    </div>
    <!-- POSE -->
    <div class="char-btn-row">
      <button class="ctrl-btn" id="btn-pose" title="POSE">
        <div class="frame"></div>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4" r="2"/><path d="M9 8h6l-1 6H10zM10 14l-2 7M14 14l2 7M9 11l-3 2M15 11l3 2"/></svg></div>
        <div class="label">POSE</div>
      </button>
    </div>
    <!-- 隱藏：btn-hide + 絕對定位的 hide-sub -->
    <div class="char-btn-row" style="position:relative">
      <button class="ctrl-btn ${state.hideCloseup||state.hideFullbody?'active':''}" id="btn-hide" title="${isZh()?'隱藏':'Hide'}">
        <div class="frame"></div>
        <div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg></div>
        <div class="label">${isZh()?'隱藏':'Hide'}</div>
      </button>
      <div id="hide-sub" style="display:none;position:absolute;top:0;left:${S+6}px;flex-direction:row;gap:4px">
        <button class="sub-btn ${state.hideFullbody?'active':''}" id="sub-fullbody" title="${isZh()?'全身':'Fullbody'}">
          <div class="frame"></div>
          <div class="icon" id="icon-fullbody"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v7M9 10l3 2 3-2M9 21l3-7 3 7"/>${state.hideFullbody?'<line x1="3" y1="3" x2="21" y2="21" stroke=\"#f87\"/>':''}</svg></div>
          <div class="label">${isZh()?'全身':'Full'}</div>
        </button>
        <button class="sub-btn ${state.hideCloseup?'active':''}" id="sub-closeup" title="${isZh()?'特寫':'Closeup'}">
          <div class="frame"></div>
          <div class="icon" id="icon-closeup"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>${state.hideCloseup?'<line x1="3" y1="3" x2="21" y2="21" stroke=\"#f87\"/>':''}</svg></div>
          <div class="label">${isZh()?'特寫':'Close'}</div>
        </button>
      </div>
    </div>
    <!-- 方向控制列：半高，兩個按鈕並排 -->
    <div class="char-btn-row" id="dir-row" style="pointer-events:all;gap:2px">
      <button id="dir-updown" title="${isZh()?'上下展開':'Vertical'}"
        style="width:${Math.floor(S/2)-1}px;height:${Math.floor(S/2)}px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:11px;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:all;flex-shrink:0">
        ${_ctrlExpandUp ? '▲' : '▼'}
      </button>
      <button id="dir-leftright" title="${isZh()?'左右展開':'Horizontal'}"
        style="width:${Math.floor(S/2)-1}px;height:${Math.floor(S/2)}px;background:#0d0d0f;border:1px solid #2a2a35;border-radius:4px;cursor:pointer;color:#a0a0b0;font-size:11px;font-family:'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;pointer-events:all;flex-shrink:0">
        ${_ctrlSubLeft ? '◀' : '▶'}
      </button>
    </div>
  </div>
</div>`;

        // 宣告面板內元素
        const sd         = _charCtrlShadow;
        const mainBtn    = sd.getElementById('main-btn');
        const expanded   = sd.getElementById('expanded');

        // 預設方向
        // expanded 向上展開（從主按鈕上方依序排列）
        expanded.style.removeProperty('right');
        expanded.style.left = '0px';
        expanded.style.bottom = (_CTRL_BTN_SIZE + 8) + 'px';
        expanded.style.removeProperty('top');
        expanded.style.flexDirection = 'column-reverse';
        // 背景子按鈕列預設收納
        const bgSubInit = sd.getElementById('bg-sub');
        if (bgSubInit) bgSubInit.style.display = 'none';

        // 主按鈕拖移 / 點擊
        let _didDrag = false;
        mainBtn.addEventListener('pointerdown', ev => {
            ev.preventDefault(); mainBtn.setPointerCapture(ev.pointerId);
            const wrap = sd.getElementById('wrap');
            _charCtrlDrag = { startX: ev.clientX, startY: ev.clientY, origLeft: parseFloat(wrap.style.left)||0, origTop: parseFloat(wrap.style.top)||0 };
            _didDrag = false;
        });
        mainBtn.addEventListener('pointermove', ev => {
            if (!_charCtrlDrag) return;
            const dx = ev.clientX - _charCtrlDrag.startX, dy = ev.clientY - _charCtrlDrag.startY;
            if (Math.abs(dx)>3||Math.abs(dy)>3) _didDrag = true;
            if (_didDrag) {
                const wrap = sd.getElementById('wrap');
                const r = getCanvasRect();
                let left = _charCtrlDrag.origLeft + dx, top = _charCtrlDrag.origTop + dy;
                if (r) { left=Math.max(0,Math.min(r.width-_CTRL_BTN_SIZE,left)); top=Math.max(0,Math.min(r.height-_CTRL_BTN_SIZE,top)); }
                wrap.style.left=left+'px'; wrap.style.top=top+'px';
                _charCtrlCustomPos = { left, top };
            }
        });
        mainBtn.addEventListener('pointerup', () => {
            if (!_didDrag) {
                if (!_charCtrlOpen) _updateExpandDirection();
                _charCtrlOpen = !_charCtrlOpen;
                expanded.classList.toggle('open', _charCtrlOpen);
                mainBtn.classList.toggle('open', _charCtrlOpen);
                // 收納主按鈕時不關閉位移面板（面板獨立）
                // if (!_charCtrlOpen) _closeOffsetPanel();
            } else {
                const r = getCanvasRect(); const wrap = sd.getElementById('wrap');
                if (r && wrap) { _clampCharCtrlPos(wrap, r); setAeeSetting('charCtrlPos', _charCtrlCustomPos); }
            }
            _charCtrlDrag = null; _didDrag = false;
        });
        mainBtn.addEventListener('pointercancel', () => { _charCtrlDrag = null; _didDrag = false; });

        // 位移按鈕：開/關位移面板
        sd.getElementById('btn-offset').addEventListener('click', () => {
            if (_offsetPanelOpen) _closeOffsetPanel(); else _openOffsetPanel();
        });

        // 背景主按鈕：展開/收納子按鈕列
        sd.getElementById('btn-bg').addEventListener('click', () => {
            _bgSubOpen = !_bgSubOpen;
            const bgSub = sd.getElementById('bg-sub');
            if (bgSub) { bgSub.style.display = _bgSubOpen ? 'flex' : 'none'; }
            _updateExpandDirection();
            sd.getElementById('btn-bg').classList.toggle('active', _bgSubOpen || _bgEnabled || _bgGridEnabled);
        });
        sd.getElementById('sub-solid').addEventListener('click', () => { _bgEnabled = !_bgEnabled; _bgSaveAndRefresh(); });
        sd.getElementById('sub-grid').addEventListener('click',  () => { _bgGridEnabled = !_bgGridEnabled; _bgSaveAndRefresh(); });
        sd.getElementById('sub-img').addEventListener('click',   () => {
            if (!_bgImgUrl) { _openBgSetting(); return; }
            _bgImgEnabled = !_bgImgEnabled; _bgSaveAndRefresh();
        });
        sd.getElementById('sub-setting').addEventListener('click', () => {
            if (_bgSettingOpen) _closeBgSetting(); else _openBgSetting();
        });

        // POSE
        sd.getElementById('btn-pose').addEventListener('click', () => {
            if (_poseFloatOpen) _closePoseWindow(); else _openPoseWindow();
        });

        // 方向設定按鈕
        sd.getElementById('dir-updown').addEventListener('click', () => {
            _ctrlExpandUp = !_ctrlExpandUp;
            setAeeSetting('ctrlExpandUp', _ctrlExpandUp);
            const btn = sd.getElementById('dir-updown');
            if (btn) btn.textContent = _ctrlExpandUp ? '▲' : '▼';
            _updateExpandDirection();
        });
        sd.getElementById('dir-leftright').addEventListener('click', () => {
            _ctrlSubLeft = !_ctrlSubLeft;
            setAeeSetting('ctrlSubLeft', _ctrlSubLeft);
            const btn = sd.getElementById('dir-leftright');
            if (btn) btn.textContent = _ctrlSubLeft ? '◀' : '▶';
            _updateExpandDirection();
        });

        // 隱藏主按鈕：展開/收納子按鈕列
        sd.getElementById('btn-hide').addEventListener('click', () => {
            const hideSub = sd.getElementById('hide-sub');
            const isOpen = hideSub.style.display !== 'none';
            hideSub.style.display = isOpen ? 'none' : 'flex';
        });
        // 隱藏子按鈕
        sd.getElementById('sub-fullbody').addEventListener('click', () => {
            state.hideFullbody = !state.hideFullbody;
            setAeeSetting('hideFullbody', state.hideFullbody);
            _rebuildCharCtrlButtons();
        });
        sd.getElementById('sub-closeup').addEventListener('click', () => {
            state.hideCloseup = !state.hideCloseup;
            setAeeSetting('hideCloseup', state.hideCloseup);
            _rebuildCharCtrlButtons();
        });
    }

    function _rebuildCharCtrlButtons() {
        if (!_charCtrlShadow) return;
        const sd = _charCtrlShadow;

        // 展開方向（由設定控制）
        _updateExpandDirection();

        // bg-sub 展開狀態同步
        const bgSub2 = sd.getElementById('bg-sub');
        if (bgSub2) bgSub2.style.display = _bgSubOpen ? 'flex' : 'none';
        // 圖片按鈕：永遠顯示
        const subImg2 = sd.getElementById('sub-img');
        if (subImg2) subImg2.style.display = 'block';
        // 套用方向設定
        _updateExpandDirection();

        // 各按鈕 active
        const btnBg  = sd.getElementById('btn-bg');
        if (btnBg)   btnBg.classList.toggle('active', _bgSubOpen || _bgEnabled || _bgGridEnabled || (_bgImgEnabled && !!_bgImgEl?.complete));
        const subSolid = sd.getElementById('sub-solid'); if (subSolid) subSolid.classList.toggle('active', _bgEnabled);
        const subGrid  = sd.getElementById('sub-grid');  if (subGrid)  subGrid.classList.toggle('active',  _bgGridEnabled);
        const subImg   = sd.getElementById('sub-img');   if (subImg)   subImg.classList.toggle('active',   _bgImgEnabled && !!_bgImgEl?.complete);
        const subSet   = sd.getElementById('sub-setting'); if (subSet) subSet.classList.toggle('active', _bgSettingOpen);

        const btnOffset = sd.getElementById('btn-offset');
        if (btnOffset) btnOffset.classList.toggle('active', _offsetPanelOpen || _charOffsetX !== 0 || _charOffsetY !== 0 || _charScale !== 1);

        const btnPose = sd.getElementById('btn-pose');
        if (btnPose)  btnPose.classList.toggle('active', _poseFloatOpen);

        // 隱藏按鈕
        const btnHide = sd.getElementById('btn-hide');
        if (btnHide) btnHide.classList.toggle('active', state.hideCloseup || state.hideFullbody);

        // 方向按鈕圖示同步（只在需要時更新，避免每幀重繪）
        const dirUD = sd.getElementById('dir-updown');
        const dirLR = sd.getElementById('dir-leftright');
        const wantUD = _ctrlExpandUp ? '▲' : '▼';
        const wantLR = _ctrlSubLeft  ? '◀' : '▶';
        if (dirUD && dirUD.textContent !== wantUD) dirUD.textContent = wantUD;
        if (dirLR && dirLR.textContent !== wantLR) dirLR.textContent = wantLR;

        const subFull   = sd.getElementById('sub-fullbody');
        const subClose  = sd.getElementById('sub-closeup');
        if (subFull)  subFull.classList.toggle('active',  state.hideFullbody);
        if (subClose) subClose.classList.toggle('active', state.hideCloseup);

        // 更新隱藏圖示
        const iconFull  = sd.getElementById('icon-fullbody');
        const iconClose = sd.getElementById('icon-closeup');
        if (iconFull)  iconFull.innerHTML  = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v7M9 10l3 2 3-2M9 21l3-7 3 7"/>${state.hideFullbody?'<line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/>':''}</svg>`;
        if (iconClose) iconClose.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>${state.hideCloseup?'<line x1="3" y1="3" x2="21" y2="21" stroke="#f87"/>':''}</svg>`;
    }

    function _clampCharCtrlPos(wrap, r) {
        if (!wrap||!r) return;
        let left = _charCtrlCustomPos!=null ? _charCtrlCustomPos.left : (parseFloat(wrap.style.left)||0);
        let top  = _charCtrlCustomPos!=null ? _charCtrlCustomPos.top  : (parseFloat(wrap.style.top) ||0);
        left = Math.max(0, Math.min(r.width -_CTRL_BTN_SIZE, left));
        top  = Math.max(0, Math.min(r.height-_CTRL_BTN_SIZE, top));
        wrap.style.left=left+'px'; wrap.style.top=top+'px';
        _charCtrlCustomPos = { left, top };
    }

    function _alignCharCtrlPanel() {
        if (!_charCtrlHost) return;
        const r = getCanvasRect(); if (!r) return;
        _charCtrlHost.style.left=r.left+'px'; _charCtrlHost.style.top=r.top+'px';
        _charCtrlHost.style.width=r.width+'px'; _charCtrlHost.style.height=r.height+'px';
        const wrap = _charCtrlShadow?.getElementById('wrap'); if (!wrap) return;
        if (_charCtrlCustomPos) _clampCharCtrlPos(wrap, r);
        else { wrap.style.left=(r.width*0.01)+'px'; wrap.style.top=(r.height*0.87)+'px'; }
    }

    function _showCharCtrlPanel() {
        _buildCharCtrlPanel(); _rebuildCharCtrlButtons(); _updateExpandDirection();
        _charCtrlHost.style.display='block'; _alignCharCtrlPanel();
        if (_bgEnabled || _bgGridEnabled || (_bgImgEnabled&&_bgImgEl?.complete)) _applyBgHook();
    }

    function _hideCharCtrlPanel() {
        if (!_charCtrlHost) return;
        _charCtrlHost.style.display='none'; _charCtrlOpen=false;
        _charCtrlShadow?.getElementById('expanded')?.classList.remove('open');
        _charCtrlShadow?.getElementById('main-btn')?.classList.remove('open');
        _charCtrlShadow?.getElementById('slider-panel')?.classList.remove('open');
        _closeOffsetPanel(); _closePoseWindow(); _closeBgSetting();
    }

    console.log(`🐈‍⬛ [AEE] ✅ 初始化完成 v${MOD_VER}`);
})();
