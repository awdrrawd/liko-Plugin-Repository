// ==UserScript==
// @name         Liko - AEE
// @name:cn      Liko的外觀編輯拓展
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.5.1
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
  const MOD_Version = "0.5.1";
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
      tabEdit: '編輯', tabOpacity: '透明度', tabSettings: '設定',
      secPart: '部件', allParts: '整件衣服',
      opacity: '透明度',
      coord: '座標', coordDrag: '拖移',
      rotate: '旋轉', rotateDrag: '拖移',
      scale: '縮放', scaleDrag: '拖移',
      mirror: '鏡射', mirrorH: '水平', mirrorV: '垂直', mirrorCopy: '水平複製', mirrorCopyV: '垂直複製',
      rotHint: '拖動把手旋轉',
      colorEdit: '顏色',
      colorPickerTitle: '選色器',
      colorPickerConfirm: '確認', colorPickerCancel: '取消',
      harmSec: '和諧色', shadesSec: '漸層', savedSec: '已儲存',
      harmCompl: '互補', harmTriadic: '三角', harmAnalog: '類比', harmSplit: '分裂', harmTetr: '四角',
      colorSave: '儲存', colorClear: '清除',
      settingsEmpty: '⚙️ 設定\n功能擴充中',
    },
    en: {
      tabEdit: 'Edit', tabOpacity: 'Opacity', tabSettings: 'Settings',
      secPart: 'Layers', allParts: 'Whole Item',
      opacity: 'Opacity',
      coord: 'Position', coordDrag: 'Drag',
      rotate: 'Rotation', rotateDrag: 'Drag',
      scale: 'Scale', scaleDrag: 'Drag',
      mirror: 'Mirror', mirrorH: 'Horiz.', mirrorV: 'Vert.', mirrorCopy: 'Copy H', mirrorCopyV: 'Copy V',
      rotHint: 'Drag handle to rotate',
      colorEdit: 'Color',
      colorPickerTitle: 'Color Picker',
      colorPickerConfirm: 'Confirm', colorPickerCancel: 'Cancel',
      harmSec: 'Harmony', shadesSec: 'Shades', savedSec: 'Saved',
      harmCompl: 'Compl.', harmTriadic: 'Triadic', harmAnalog: 'Analog.', harmSplit: 'Split', harmTetr: 'Tetr.',
      colorSave: 'Save', colorClear: 'Clear',
      settingsEmpty: '⚙️ Settings\nMore features coming soon',
    }
  };

  function t(k) { return (isZh() ? LANG.zh : LANG.en)[k] ?? k; }

  // ============================================================
  // RENDER ENGINE
  // ============================================================

  let assetGroupMap = new Map();
  let transformData = new Map();
  let currentTransform = null;
  let isMirrorCopyPass = false;
  let isMirrorCopyVPass = false;

  function parseLayerName(filename, assetName) {
    const rest = filename.slice(assetName.length);
    const parts = rest.split('_').filter(Boolean);
    const sizeTags = new Set(['XLarge','Large','Medium','Small','Normal','White']);
    return parts.filter(p => !sizeTags.has(p)).join('_') || null;
  }

  modApi.hookFunction("GLDrawAppearanceBuild", 1, (args, next) => {
    const C = args[0];
    assetGroupMap.clear(); transformData.clear();
    C.AppearanceLayers?.forEach(layer => {
      const asset = layer.Asset?.Name, group = layer.Asset?.Group?.Name;
      if (asset && group) assetGroupMap.set(asset, group);
    });
    C.Appearance?.forEach(item => {
      const group = item.Asset?.Group?.Name;
      const layers = item.Asset?.Layer;
      const los = item.Property?.LayerOverrides;
      if (!group || !Array.isArray(los)) return;
      los.forEach((lo, i) => { if (lo?.Opacity != null && layers?.[i]) layers[i].Opacity = lo.Opacity; });
      los.forEach((lo, i) => {
        if (!lo) return;
        const hasT = lo.FlipX || lo.FlipY || lo.MirrorCopy || lo.MirrorCopyV || lo.ScaleX != null || lo.ScaleY != null || lo.Rotation != null;
        if (!hasT) return;
        const layerName = layers?.[i]?.Name ?? null;
        const key = layerName ? `${group}/${layerName}` : `${group}/*`;
        transformData.set(key, {
          flipX:!!lo.FlipX, flipY:!!lo.FlipY,
          mirrorCopy:!!lo.MirrorCopy, mirrorCopyV:!!lo.MirrorCopyV,
          scaleX:lo.ScaleX??1, scaleY:lo.ScaleY??1, rotation:lo.Rotation??0
        });
      });
    });
    return next(args);
  });

  modApi.hookFunction("GLDrawImage", 1, (args, next) => {
    if (isMirrorCopyPass || isMirrorCopyVPass) return next(args);
    currentTransform = null;
    if (typeof args[0] !== 'string') return next(args);
    const filename = args[0].split('/').pop().replace('.png','');
    assetGroupMap.forEach((group, asset) => {
      if (!filename.startsWith(asset)) return;
      const layerName = parseLayerName(filename, asset);
      const key = layerName ? `${group}/${layerName}` : null;
      const match = (key && transformData.get(key)) || transformData.get(`${group}/*`);
      if (match) currentTransform = match;
    });
    if (!currentTransform) return next(args);
    const t2 = currentTransform;
    args[4] = { ...args[4], Mirror: t2.flipX ? true : args[4].Mirror, Invert: t2.flipY ? true : args[4].Invert };
    const result = next(args);
    if (t2.mirrorCopy) {
      isMirrorCopyPass = true;
      next([...args.slice(0,4), { ...args[4], Mirror: !t2.flipX }, args[5]]);
      isMirrorCopyPass = false;
    }
    if (t2.mirrorCopyV) {
      isMirrorCopyVPass = true;
      next([...args.slice(0,4), { ...args[4], Invert: !t2.flipY }, args[5]]);
      isMirrorCopyVPass = false;
    }
    currentTransform = null;
    return result;
  });

  const _origMat = WebGL2RenderingContext.prototype.uniformMatrix4fv;
  WebGL2RenderingContext.prototype.uniformMatrix4fv = function(loc, tp, data) {
    if (currentTransform && data instanceof Float32Array && data.length === 16) {
      const { scaleX, scaleY, rotation } = currentTransform;
      if (scaleX !== 1 || scaleY !== 1 || rotation !== 0) {
        const m = new Float32Array(data);
        const cos = Math.cos(rotation * Math.PI / 180), sin = Math.sin(rotation * Math.PI / 180);
        const sx = Math.sqrt(m[0]**2 + m[1]**2) * scaleX, sy = Math.sqrt(m[4]**2 + m[5]**2) * scaleY;
        const sgx = m[0] < 0 ? -1 : 1, sgy = m[5] < 0 ? -1 : 1;
        m[0]=cos*sx*sgx; m[1]=sin*sx*sgx; m[4]=-sin*sy*sgy; m[5]=cos*sy*sgy;
        return _origMat.call(this, loc, tp, m);
      }
    }
    return _origMat.call(this, loc, tp, data);
  };

  // ============================================================
  // DATA HELPERS
  // ============================================================

  function getCurrentItem() {
    if (typeof CharacterAppearanceMode === 'undefined' || CharacterAppearanceMode !== 'Color') return null;
    return InventoryGet(CharacterAppearanceSelection, CharacterAppearanceColorPickerGroupName);
  }

  function ensureLO(item) {
    if (!item) return;
    if (!item.Property) item.Property = {};
    const count = item.Asset?.Layer?.length || 1;
    if (!Array.isArray(item.Property.LayerOverrides))
      item.Property.LayerOverrides = Array.from({ length: count }, () => ({}));
    while (item.Property.LayerOverrides.length < count) item.Property.LayerOverrides.push({});
  }

  function setLO(item, layerIdx, key, val) {
    ensureLO(item);
    const count = item.Asset?.Layer?.length || 1;
    const indices = layerIdx === 'all'
      ? Array.from({ length: count }, (_, i) => i)
      : [parseInt(layerIdx)];
    indices.forEach(i => {
      if (!item.Property.LayerOverrides[i]) item.Property.LayerOverrides[i] = {};
      item.Property.LayerOverrides[i][key] = val;
    });
    if (key === 'Opacity') {
      if (layerIdx === 'all') item.Property.Opacity = val;
      indices.forEach(i => { if (item.Asset?.Layer?.[i]) item.Asset.Layer[i].Opacity = val; });
    }
    CharacterRefresh(CharacterAppearanceSelection, false, false);
  }

  function getLO(item, idx) {
    const i = idx === 'all' ? 0 : parseInt(idx);
    return item?.Property?.LayerOverrides?.[i] || {};
  }

  // Get current color of layer (from BC's color system)
  function getLayerColor(item, layerIdx) {
    if (!item) return null;
    // Prefer Property.Color, fall back to item.Color
    const colors = item.Property?.Color ?? item.Color;
    if (!colors) return null;
    const idx = layerIdx === 'all' ? 0 : parseInt(layerIdx);
    if (Array.isArray(colors)) return colors[idx] ?? colors[0] ?? null;
    return typeof colors === 'string' ? colors : null;
  }

  // FIX: update both item.Color and item.Property.Color so BC renders correctly
  function setLayerColor(item, layerIdx, hexColor) {
    if (!item) return;
    const layers = item.Asset?.Layer;
    const count = layers?.length || 1;
    const idx = layerIdx === 'all' ? 'all' : parseInt(layerIdx);
    if (!item.Property) item.Property = {};

    // Initialize a color array from an existing color source
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
    CharacterRefresh(CharacterAppearanceSelection, false, false);
  }

  // ============================================================
  // CANVAS / ALIGNMENT
  // ============================================================

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
  };

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
      origX: lo.DrawingLeft?.[""]??0, origY: lo.DrawingTop?.[""]??0,
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
    CharacterRefresh(CharacterAppearanceSelection, false, false);
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
    const newSX = Math.max(0.05, +(scaleDragState.origSX + dx).toFixed(2));
    const newSY = Math.max(0.05, +(scaleDragState.origSY + dy).toFixed(2));
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
  // DRAG — ROTATION WHEEL OVERLAY
  // ============================================================

  let rotOverlayHost = null;
  let rotShadow = null;
  let rotDragState = null;
  const ROT_CX_PCT = 0.45;
  const ROT_CY_PCT = 0.80;
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
        #rot-overlay { position:absolute; display:none; pointer-events:none; }
        #rot-overlay.on { display:block; pointer-events:auto; }
        svg { overflow:visible; }
        #rot-ring { fill:none; stroke:rgba(124,106,247,0.5); stroke-width:2; }
        #rot-ring-bg { fill:rgba(0,0,0,0.35); stroke:rgba(124,106,247,0.3); stroke-width:1; }
        #rot-handle { fill:#7c6af7; stroke:#fff; stroke-width:1.5; cursor:grab; r:8; }
        #rot-handle:active { cursor:grabbing; }
        #rot-line { stroke:rgba(124,106,247,0.6); stroke-width:1.5; stroke-dasharray:4 3; }
        #rot-label { font-family:'Segoe UI',sans-serif; font-size:13px; font-weight:600;
          fill:#fff; text-anchor:middle; dominant-baseline:central;
          text-shadow:0 1px 3px #000; pointer-events:none; }
        #rot-hint { font-family:'Segoe UI',sans-serif; font-size:11px;
          fill:rgba(255,255,255,0.5); text-anchor:middle; pointer-events:none; }
      </style>
      <div id="rot-overlay">
        <svg id="rot-svg" width="1" height="1">
          <circle id="rot-ring-bg" />
          <circle id="rot-ring" />
          <line id="rot-line" />
          <circle id="rot-handle" />
          <text id="rot-label" />
          <text id="rot-hint" />
        </svg>
      </div>`;
    const handle = rotShadow.getElementById('rot-handle');
    handle.addEventListener('mousedown', onRotHandleDown);
  }

  function alignRotOverlay() {
    if (!rotOverlayHost) return;
    const r = getCanvasRect();
    if (!r) return;
    rotOverlayHost.style.left = r.left + 'px';
    rotOverlayHost.style.top  = r.top  + 'px';
    rotOverlayHost.style.width  = r.width  + 'px';
    rotOverlayHost.style.height = r.height + 'px';
    const svg = rotShadow?.getElementById('rot-svg');
    if (svg) { svg.setAttribute('width', r.width); svg.setAttribute('height', r.height); }
  }

  function updateRotOverlay(rotDeg) {
    if (!rotShadow) return;
    const r = getCanvasRect(); if (!r) return;
    const cx = r.width  * ROT_CX_PCT;
    const cy = r.height * ROT_CY_PCT;
    const rad = rotDeg * Math.PI / 180;
    const hx = cx + ROT_RADIUS * Math.sin(rad);
    const hy = cy - ROT_RADIUS * Math.cos(rad);

    rotShadow.getElementById('rot-ring-bg').setAttribute('cx', cx);
    rotShadow.getElementById('rot-ring-bg').setAttribute('cy', cy);
    rotShadow.getElementById('rot-ring-bg').setAttribute('r', ROT_RADIUS);
    rotShadow.getElementById('rot-ring').setAttribute('cx', cx);
    rotShadow.getElementById('rot-ring').setAttribute('cy', cy);
    rotShadow.getElementById('rot-ring').setAttribute('r', ROT_RADIUS);
    rotShadow.getElementById('rot-line').setAttribute('x1', cx);
    rotShadow.getElementById('rot-line').setAttribute('y1', cy);
    rotShadow.getElementById('rot-line').setAttribute('x2', hx);
    rotShadow.getElementById('rot-line').setAttribute('y2', hy);
    rotShadow.getElementById('rot-handle').setAttribute('cx', hx);
    rotShadow.getElementById('rot-handle').setAttribute('cy', hy);
    const label = rotShadow.getElementById('rot-label');
    label.setAttribute('x', cx); label.setAttribute('y', cy);
    label.textContent = Math.round(rotDeg) + '°';
    const hint = rotShadow.getElementById('rot-hint');
    hint.setAttribute('x', cx); hint.setAttribute('y', cy + ROT_RADIUS + 16);
    hint.textContent = t('rotHint');
  }

  function showRotOverlay() {
    buildRotOverlay();
    alignRotOverlay();
    const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
    const lo = getLO(item, state.selectedLayer);
    updateRotOverlay(lo.Rotation ?? 0);
    rotShadow.getElementById('rot-overlay').classList.add('on');
    rotOverlayHost.style.pointerEvents = 'auto';
  }

  function hideRotOverlay() {
    rotShadow?.getElementById('rot-overlay')?.classList.remove('on');
    if (rotOverlayHost) rotOverlayHost.style.pointerEvents = 'none';
  }

  function onRotHandleDown(e) {
    e.preventDefault();
    const r = getCanvasRect(); if (!r) return;
    const cx = r.left + r.width  * ROT_CX_PCT;
    const cy = r.top  + r.height * ROT_CY_PCT;
    rotDragState = { cx, cy };

    const onMove = (ev) => {
      const dx = ev.clientX - rotDragState.cx;
      const dy = ev.clientY - rotDragState.cy;
      let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      angle = Math.round(angle);
      const item = getCurrentItem(); if (!item || state.selectedLayer === null) return;
      setLO(item, state.selectedLayer, 'Rotation', angle);
      updateRotOverlay(angle);
      updateEditSection();
    };
    const onUp = () => {
      rotDragState = null;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }

  // ============================================================
  // COLOR PICKER — matching editor theme, i18n, canvas-scaled position
  // ============================================================

  let colorPickerHostEl = null;
  let colorPickerShadow = null;
  let colorPickerCallback = null;

  // Theme matches panel: --bg:#0d0d0f  --accent:#7c6af7  --accent2:#4ecdc4
  const CP_CSS = `
:host { all:initial; display:block; }
*{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-user-select:none}
#cp-outer {
  position:fixed; z-index:1000001;
  display:none;
}
#cp-outer.open { display:block; }
#cp-backdrop {
  position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:-1;
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
  transform-origin: top left;
}
#cp {
  width:480px;
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

    // Build HTML using t() so translations are baked in at construction time
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
        <canvas id="cp-sv-canvas" width="240" height="140" style="border-radius:7px;border:1px solid var(--color-border-tertiary);cursor:crosshair;flex-shrink:0;margin-left:2px"></canvas>
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
    }
    function setC(h,s,v,a){cpH=h;cpS=s;cpV=v;cpA=(a===undefined?cpA:a);updAll();}

    // Track interactions
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
      closeColorPicker();
      if (colorPickerCallback) colorPickerCallback(hex);
    });
    sd.getElementById('cp-cancel').addEventListener('click',()=>closeColorPicker());
    sd.getElementById('cp-backdrop').addEventListener('click',()=>closeColorPicker());

    // Expose setC for opening with initial color
    colorPickerHostEl._cpSetColor = (hex) => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
        const{h,s,v}=x2h(hex);setC(h,s,v,255);
      } else { setC(220,70,90,255); }
      rSaved();
    };

    rSaved(); updAll();
  }

  // Position the color picker relative to the BC canvas, scaled appropriately
  function positionColorPicker() {
    if (!colorPickerShadow) return;
    const outer = colorPickerShadow.getElementById('cp-outer');
    const wrap  = colorPickerShadow.getElementById('cp-wrap');
    if (!outer || !wrap) return;

    const r = getCanvasRect();
    if (!r) {
      outer.style.left = '50%';
      outer.style.top  = '50%';
      wrap.style.transform = 'translate(-50%,-50%)';
      wrap.style.transformOrigin = 'top left';
      return;
    }

    // Scale factor: canvas screen width / BC logical width (2000)
    const scale = r.width / 2000;

    // Apply scale to picker content so it matches BC's zoom level
    wrap.style.transform = `scale(${scale})`;
    wrap.style.transformOrigin = 'top left';

    // Picker logical position: right 1/4 of BC canvas (logical x ≈ 1520), y ≥ 100
    const logLeft = 1520; // right side, leaving 480px of picker width (2000-480=1520)
    const logTop  = 110;
    const screenLeft = r.left + logLeft  * (r.width  / 2000);
    const screenTop  = r.top  + logTop   * (r.height / 1000);

    // Clamp so it doesn't overflow viewport
    const pickerScreenW = 480 * scale;
    const clampedLeft = Math.min(screenLeft, window.innerWidth - pickerScreenW - 8);

    outer.style.left = Math.max(clampedLeft, r.left + r.width * 0.5) + 'px';
    outer.style.top  = Math.max(screenTop, r.top + 60) + 'px';
  }

  function openColorPicker(initialHex, callback) {
    buildColorPicker();
    colorPickerCallback = callback;
    colorPickerHostEl._cpSetColor?.(initialHex || '#FFFFFF');
    positionColorPicker();
    colorPickerShadow.getElementById('cp-outer').classList.add('open');
    colorPickerHostEl.style.pointerEvents = 'auto';
  }

  function closeColorPicker() {
    colorPickerShadow?.getElementById('cp-outer')?.classList.remove('open');
    if (colorPickerHostEl) colorPickerHostEl.style.pointerEvents = 'none';
    colorPickerCallback = null;
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
  width:14vw; min-width:300px; max-width:380px; height:100%;
  background:var(--bg); border-right:1px solid var(--border);
  color:var(--text); display:flex; flex-direction:column;
  z-index:999999; overflow:hidden;
  user-select:none;
}
#panel.collapsed { display:none; }

#toggle {
  position:absolute; top:50%; transform:translateY(-50%);
  width:18px; height:48px;
  background:var(--bg); border:1px solid var(--border); border-left:none;
  border-radius:0 5px 5px 0; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  color:var(--text-dim); font-size:10px; z-index:1000000;
  transition:background .15s, color .15s;
}
#toggle:hover { background:var(--bg3); color:var(--accent); }

#tabs {
  display:flex; border-bottom:1px solid var(--border); flex-shrink:0;
}
.tab {
  flex:1; height:34px; display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text-dim); font-size:13px; font-weight:600;
  letter-spacing:.04em; border-bottom:2px solid transparent;
  transition:color .15s, border-color .15s;
}
.tab:hover { color:var(--text); }
.tab.active { color:var(--accent); border-bottom-color:var(--accent); }

#item-name {
  padding:7px 12px; font-size:14px; font-weight:700; color:var(--text);
  text-align:center;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  background:var(--bg2); border-bottom:1px solid var(--border); flex-shrink:0;
}

#content { flex:1; overflow-y:auto; }
#content::-webkit-scrollbar { width:3px; }
#content::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

/* ── SECTIONS ── */
.section { padding:8px 10px; border-bottom:1px solid var(--border); }
.sec-title {
  font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
  color:var(--text-dim); margin-bottom:6px;
}

/* ── EDIT HEADER (layer name + color button) ── */
.edit-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:8px; margin-bottom:8px;
}
.edit-header-left { flex:1; min-width:0; }


/* ── LAYER BUTTONS ── */
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
}
.layer-btn:hover { border-color:var(--accent); }
.layer-btn.selected { background:#17143a; border-color:var(--accent); color:var(--accent); }

/* ── PROP GROUP ── */
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

/* ── PROP ROW ── */
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

/* ── OPACITY RANGE ── */
.op-group { margin-bottom:10px; }
.op-row-label {
  display:flex; justify-content:space-between; align-items:center;
  font-size:12px; color:var(--text-sec); margin-bottom:3px;
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

/* ── MIRROR BUTTONS — taller for two-line text ── */
.mirror-row { display:flex; gap:6px; margin-top:2px; flex-wrap:wrap; }
.mirror-btn {
  flex:1; min-width:52px; min-height:44px; height:auto;
  background:var(--bg2); border:1.5px solid var(--border);
  border-radius:4px; color:var(--text-sec); font-size:12px; font-weight:600;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  text-align:center; white-space:normal; word-break:keep-all; line-height:1.3;
  padding:6px 4px;
  transition:border-color .12s, color .12s, background .12s;
}
.mirror-btn:hover { border-color:var(--accent); }
.mirror-btn.active { background:#17143a; border-color:var(--accent); color:var(--accent); }

/* ── OPACITY TAB ── */
.op-tab-row { padding:6px 10px; border-bottom:1px solid var(--border); }
.op-tab-name {
  display:flex; justify-content:space-between;
  font-size:14px; font-weight:600; color:var(--text); margin-bottom:4px;
}
.op-tab-val { color:var(--accent2); font-variant-numeric:tabular-nums; }

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
    toggleEl.id = 'toggle'; toggleEl.textContent = '◀';
    toggleEl.style.pointerEvents = 'auto';
    toggleEl.addEventListener('click', toggleCollapse);
    shadowRoot.appendChild(toggleEl);

    const panel = document.createElement('div');
    panel.id = 'panel';
    panel.style.pointerEvents = 'auto';
    panel.innerHTML = `
      <div id="tabs">
        <div class="tab active" data-tab="edit">${t('tabEdit')}</div>
        <div class="tab" data-tab="opacity">${t('tabOpacity')}</div>
        <div class="tab" data-tab="settings">${t('tabSettings')}</div>
      </div>
      <div id="item-name">—</div>
      <div id="content"></div>
    `;
    shadowRoot.appendChild(panel);

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
      const w = panel.offsetWidth || parseInt(getComputedStyle(panel).width) || 300;
      toggleEl.style.left = w + 'px';
    }
  }

  function toggleCollapse() {
    const panel = shadowRoot?.getElementById('panel');
    const toggleEl = shadowRoot?.getElementById('toggle');
    if (!panel || !toggleEl) return;

    if (!state.collapsed) {
      panel.classList.add('collapsed');
      toggleEl.textContent = '▶';
      state.collapsed = true;
      toggleEl.style.left = '0px';
    } else {
      toggleEl.style.display = 'none';
      panel.classList.remove('collapsed');
      state.collapsed = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toggleEl.style.display = '';
          const w = panel.offsetWidth || 300;
          toggleEl.style.left = w + 'px';
          toggleEl.textContent = '◀';
        });
      });
    }
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  function onContentClick(e) {
    // Color edit button (in edit section header)
    const colorEditBtn = e.target.closest('[data-color-edit]');
    if (colorEditBtn) {
      const layerIdx = colorEditBtn.dataset.colorEdit;
      const item = getCurrentItem(); if (!item) return;
      const curColor = getLayerColor(item, layerIdx) || '#FFFFFF';
      openColorPicker(curColor, (newHex) => {
        setLayerColor(item, layerIdx, newHex);
        // Update the swatch immediately without full re-render
        const inner = shadowRoot?.querySelector(`[data-color-edit="${layerIdx}"] .color-edit-inner`);
        if (inner) inner.style.background = newHex;
      });
      return;
    }
    // Layer select
    const layerBtn = e.target.closest('[data-select-layer]');
    if (layerBtn) {
      state.selectedLayer = layerBtn.dataset.selectLayer;
      renderContent(); return;
    }
    // Step buttons
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn) { handleStep(stepBtn); return; }
    // Reset buttons
    const resetBtn = e.target.closest('[data-reset]');
    if (resetBtn) { handleReset(resetBtn.dataset.reset); return; }
    // Mirror toggle buttons
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
        if (mode === 'rot') showRotOverlay();
        shadowRoot.querySelectorAll('[data-drag-mode]').forEach(cb => {
          if (cb !== el) cb.checked = false;
          cb.closest('.drag-check-label')?.classList.toggle('active', cb.checked);
        });
        el.closest('.drag-check-label')?.classList.add('active');
      } else {
        state.activeDrag = null;
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
    updateEditSection();
    if (ctrl === 'rot' && state.activeDrag === 'rot') {
      const lo2 = getLO(getCurrentItem(), idx);
      updateRotOverlay(lo2.Rotation ?? 0);
    }
  }

  function syncOpacityUI(val) {
    const pct = Math.round(val * 100);
    shadowRoot.querySelectorAll('[data-op-layer]').forEach(el => { el.value = pct; });
    shadowRoot.querySelectorAll('[data-op-val]').forEach(el => { el.textContent = pct + '%'; });
  }

  function updateOpValLabel(layerIdx, val) {
    const el = shadowRoot.getElementById(`op-val-${layerIdx}`);
    if (el) el.textContent = Math.round(val*100) + '%';
  }

  function handleStep(btn) {
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const idx = state.selectedLayer;
    const ctrl = btn.dataset.step;
    const delta = parseFloat(btn.dataset.delta);
    const lo = getLO(item, idx);
    if (ctrl==='x')   setLO(item,idx,'DrawingLeft',{"":( lo.DrawingLeft?.[""]??0)+delta});
    else if(ctrl==='y')   setLO(item,idx,'DrawingTop', {"":( lo.DrawingTop?.[""] ??0)+delta});
    else if(ctrl==='sx')  setLO(item,idx,'ScaleX', Math.max(0.05,+((lo.ScaleX??1)+delta).toFixed(2)));
    else if(ctrl==='sy')  setLO(item,idx,'ScaleY', Math.max(0.05,+((lo.ScaleY??1)+delta).toFixed(2)));
    else if(ctrl==='rot') setLO(item,idx,'Rotation',((lo.Rotation??0)+delta+360)%360);
    updateEditSection();
    if (state.activeDrag === 'rot') {
      const lo2 = getLO(getCurrentItem(), idx);
      updateRotOverlay(lo2.Rotation??0);
    }
  }

  function handleReset(ctrl) {
    const item = getCurrentItem();
    if (!item || state.selectedLayer === null) return;
    const idx = state.selectedLayer;
    if (ctrl==='x')   setLO(item,idx,'DrawingLeft',{"":0});
    else if(ctrl==='y')   setLO(item,idx,'DrawingTop', {"":0});
    else if(ctrl==='sx')  setLO(item,idx,'ScaleX',1);
    else if(ctrl==='sy')  setLO(item,idx,'ScaleY',1);
    else if(ctrl==='rot') { setLO(item,idx,'Rotation',0); if(state.activeDrag==='rot') updateRotOverlay(0); }
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
    const group = typeof CharacterAppearanceColorPickerGroupName !== 'undefined' ? CharacterAppearanceColorPickerGroupName : null;
    const mode  = typeof CharacterAppearanceMode !== 'undefined' ? CharacterAppearanceMode : null;

    if (!item || !group || mode !== 'Color') {
      hostEl.style.display = 'none';
      hideRotOverlay();
      return;
    }
    hostEl.style.display = 'block';
    alignHost(); updateTogglePos();

    shadowRoot.getElementById('item-name').textContent = `${group} / ${item.Asset?.Name||''}`;

    const layers  = item.Asset?.Layer || [];
    const content = shadowRoot.getElementById('content');

    if (state.tab === 'edit')         content.innerHTML = renderEditTab(item, layers);
    else if (state.tab === 'opacity') content.innerHTML = renderOpacityTab(item, layers);
    else content.innerHTML = `<div class="settings-empty">${t('settingsEmpty')}</div>`;

    // Bind prop-val direct input listeners
    content.querySelectorAll('[data-prop-input]').forEach(input => {
      input.addEventListener('change', () => onPropValInput(input));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { onPropValInput(input); input.blur(); } });
      input.addEventListener('mousedown', e => e.stopPropagation());
      input.addEventListener('click', e => e.stopPropagation());
    });

    if (state.activeDrag === 'rot') showRotOverlay();
    else hideRotOverlay();
  }

  function renderEditTab(item, layers) {
    const idx = state.selectedLayer;
    let editHtml = '';

    if (idx !== null) {
      const lo    = getLO(item, idx);
      const label = idx==='all' ? t('allParts') : (layers[parseInt(idx)]?.Name || `Layer ${idx}`);
      const x     = lo.DrawingLeft?.[""] ?? 0;
      const y     = lo.DrawingTop?.[""]  ?? 0;
      const sx    = lo.ScaleX ?? 1;
      const sy    = lo.ScaleY ?? 1;
      const rot   = lo.Rotation ?? 0;
      const op    = Math.round((lo.Opacity??1)*100);
      const color = getLayerColor(item, idx);
      const colorStyle = color ? `background:${color}` : '';

            editHtml = `<div class="section" id="edit-section">
  <div class="sec-title">✦ ${label}</div>

  <!-- 透明度 -->
  <div class="op-group">
    <div class="op-row-label">${t('opacity')} <span id="edit-op-val">${op}%</span></div>
    <input type="range" class="range" data-edit-op="1" min="0" max="100" step="1" value="${op}">
  </div>

  <!-- 座標 -->
  <div class="prop-group">
    <div class="prop-group-header">
      <span class="prop-group-title">${t('coord')}</span>
      ${dragCheckbox('xy', t('coordDrag'))}
    </div>
    ${propRow('X', x, 'x', [-5,-1,1,5])}
    ${propRow('Y', y, 'y', [-5,-1,1,5])}
  </div>

  <!-- 旋轉 -->
  <div class="prop-group">
    <div class="prop-group-header">
      <span class="prop-group-title">${t('rotate')}</span>
      ${dragCheckbox('rot', t('rotateDrag'))}
    </div>
    ${propRow('°', rot, 'rot', [-5,-1,1,5])}
  </div>

  <!-- 縮放 -->
  <div class="prop-group">
    <div class="prop-group-header">
      <span class="prop-group-title">${t('scale')}</span>
      ${dragCheckbox('scale', t('scaleDrag'))}
    </div>
    ${propRow('X', sx.toFixed(2), 'sx', [-0.3,-0.1,0.1,0.3])}
    ${propRow('Y', sy.toFixed(2), 'sy', [-0.3,-0.1,0.1,0.3])}
  </div>

  <!-- 鏡射 -->
  <div class="prop-group">
    <div class="prop-group-header">
      <span class="prop-group-title">${t('mirror')}</span>
    </div>
    <div class="mirror-row">
      <button class="mirror-btn ${lo.FlipX?'active':''}" data-mirror="FlipX">${t('mirrorH')}</button>
      <button class="mirror-btn ${lo.FlipY?'active':''}" data-mirror="FlipY">${t('mirrorV')}</button>
      <button class="mirror-btn ${lo.MirrorCopy?'active':''}" data-mirror="MirrorCopy">${t('mirrorCopy')}</button>
      <button class="mirror-btn ${lo.MirrorCopyV?'active':''}" data-mirror="MirrorCopyV">${t('mirrorCopyV')}</button>
    </div>
  </div>
</div>`;
    }

    return editHtml + `<div class="section">
  <div class="sec-title">${t('secPart')}</div>
  ${layerBtnRow('all', t('allParts'), item)}
  ${layers.map((l,i)=>layerBtnRow(String(i), l.Name||`Layer ${i}`, item)).join('')}
</div>`;
  }

  function renderOpacityTab(item, layers) {
    const opAll = Math.round((item.Property?.Opacity ?? getLO(item,0).Opacity ?? 1)*100);
    let html = `<div class="op-tab-row">
      <div class="op-tab-name">${t('allParts')} <span class="op-tab-val" data-op-val id="op-val-all">${opAll}%</span></div>
      <input type="range" class="range" data-op-layer="all" min="0" max="100" step="1" value="${opAll}">
    </div>`;
    layers.forEach((layer,i) => {
      const op = Math.round((getLO(item,i).Opacity??1)*100);
      html += `<div class="op-tab-row">
        <div class="op-tab-name">${layer.Name||`Layer ${i}`} <span class="op-tab-val" data-op-val id="op-val-${i}">${op}%</span></div>
        <input type="range" class="range" data-op-layer="${i}" min="0" max="100" step="1" value="${op}">
      </div>`;
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
      x: lo.DrawingLeft?.[""]??0,
      y: lo.DrawingTop?.[""] ??0,
      sx: (lo.ScaleX??1).toFixed(2),
      sy: (lo.ScaleY??1).toFixed(2),
      rot: lo.Rotation??0,
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

  // Layer button row — no color swatch (color button is now in the edit section header)
  function layerBtnRow(idx, name, item) {
    return `<div class="layer-btn-row">
  <button class="layer-btn ${state.selectedLayer===idx?'selected':''}" data-select-layer="${idx}">${name}</button>
</div>`;
  }

  // ============================================================
  // MAIN LOOP
  // ============================================================

  let lastGroup = null, lastAsset = null, lastMode = null;

  modApi.hookFunction("AppearanceRun", 1, (args, next) => {
    const item  = getCurrentItem();
    const group = typeof CharacterAppearanceColorPickerGroupName !== 'undefined' ? CharacterAppearanceColorPickerGroupName : null;
    const mode  = typeof CharacterAppearanceMode !== 'undefined' ? CharacterAppearanceMode : null;

    buildPanel();

    if (group !== lastGroup || item?.Asset?.Name !== lastAsset || mode !== lastMode) {
      if (group !== lastGroup) { state.selectedLayer = null; state.activeDrag = null; hideRotOverlay(); }
      lastGroup = group; lastAsset = item?.Asset?.Name; lastMode = mode;
      renderContent();
    }
    return next(args);
  });

  window.addEventListener('resize', () => {
    alignHost(); updateTogglePos(); alignRotOverlay();
    positionColorPicker(); // reposition/rescale picker when window resizes
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
