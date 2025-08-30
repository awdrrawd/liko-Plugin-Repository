// ==UserScript==
// @name         Liko - BC UI 座標繪製工具
// @namespace    https://likulisu.dev/
// @version      1.0
// @description  在畫面上顯示 UI 座標與滑鼠位置，方便 UI 對齊調整
// @author       Likolisu
// @match        https://bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// ==/UserScript==

//SDK
var bcModSdk=function(){"use strict";const o="1.2.0";function e(o){alert("Mod ERROR:\n"+o);const e=new Error(o);throw console.error(e),e}const t=new TextEncoder;function n(o){return!!o&&"object"==typeof o&&!Array.isArray(o)}function r(o){const e=new Set;return o.filter((o=>!e.has(o)&&e.add(o)))}const i=new Map,a=new Set;function c(o){a.has(o)||(a.add(o),console.warn(o))}function s(o){const e=[],t=new Map,n=new Set;for(const r of f.values()){const i=r.patching.get(o.name);if(i){e.push(...i.hooks);for(const[e,a]of i.patches.entries())t.has(e)&&t.get(e)!==a&&c(`ModSDK: Mod '${r.name}' is patching function ${o.name} with same pattern that is already applied by different mod, but with different pattern:\nPattern:\n${e}\nPatch1:\n${t.get(e)||""}\nPatch2:\n${a}`),t.set(e,a),n.add(r.name)}}e.sort(((o,e)=>e.priority-o.priority));const r=function(o,e){if(0===e.size)return o;let t=o.toString().replaceAll("\r\n","\n");for(const[n,r]of e.entries())t.includes(n)||c(`ModSDK: Patching ${o.name}: Patch ${n} not applied`),t=t.replaceAll(n,r);return(0,eval)(`(${t})`)}(o.original,t);let i=function(e){var t,i;const a=null===(i=(t=m.errorReporterHooks).hookChainExit)||void 0===i?void 0:i.call(t,o.name,n),c=r.apply(this,e);return null==a||a(),c};for(let t=e.length-1;t>=0;t--){const n=e[t],r=i;i=function(e){var t,i;const a=null===(i=(t=m.errorReporterHooks).hookEnter)||void 0===i?void 0:i.call(t,o.name,n.mod),c=n.hook.apply(this,[e,o=>{if(1!==arguments.length||!Array.isArray(e))throw new Error(`Mod ${n.mod} failed to call next hook: Expected args to be array, got ${typeof o}`);return r.call(this,o)}]);return null==a||a(),c}}return{hooks:e,patches:t,patchesSources:n,enter:i,final:r}}function l(o,e=!1){let r=i.get(o);if(r)e&&(r.precomputed=s(r));else{let e=window;const a=o.split(".");for(let t=0;t<a.length-1;t++)if(e=e[a[t]],!n(e))throw new Error(`ModSDK: Function ${o} to be patched not found; ${a.slice(0,t+1).join(".")} is not object`);const c=e[a[a.length-1]];if("function"!=typeof c)throw new Error(`ModSDK: Function ${o} to be patched not found`);const l=function(o){let e=-1;for(const n of t.encode(o)){let o=255&(e^n);for(let e=0;e<8;e++)o=1&o?-306674912^o>>>1:o>>>1;e=e>>>8^o}return((-1^e)>>>0).toString(16).padStart(8,"0").toUpperCase()}(c.toString().replaceAll("\r\n","\n")),d={name:o,original:c,originalHash:l};r=Object.assign(Object.assign({},d),{precomputed:s(d),router:()=>{},context:e,contextProperty:a[a.length-1]}),r.router=function(o){return function(...e){return o.precomputed.enter.apply(this,[e])}}(r),i.set(o,r),e[r.contextProperty]=r.router}return r}function d(){for(const o of i.values())o.precomputed=s(o)}function p(){const o=new Map;for(const[e,t]of i)o.set(e,{name:e,original:t.original,originalHash:t.originalHash,sdkEntrypoint:t.router,currentEntrypoint:t.context[t.contextProperty],hookedByMods:r(t.precomputed.hooks.map((o=>o.mod))),patchedByMods:Array.from(t.precomputed.patchesSources)});return o}const f=new Map;function u(o){f.get(o.name)!==o&&e(`Failed to unload mod '${o.name}': Not registered`),f.delete(o.name),o.loaded=!1,d()}function g(o,t){o&&"object"==typeof o||e("Failed to register mod: Expected info object, got "+typeof o),"string"==typeof o.name&&o.name||e("Failed to register mod: Expected name to be non-empty string, got "+typeof o.name);let r=`'${o.name}'`;"string"==typeof o.fullName&&o.fullName||e(`Failed to register mod ${r}: Expected fullName to be non-empty string, got ${typeof o.fullName}`),r=`'${o.fullName} (${o.name})'`,"string"!=typeof o.version&&e(`Failed to register mod ${r}: Expected version to be string, got ${typeof o.version}`),o.repository||(o.repository=void 0),void 0!==o.repository&&"string"!=typeof o.repository&&e(`Failed to register mod ${r}: Expected repository to be undefined or string, got ${typeof o.version}`),null==t&&(t={}),t&&"object"==typeof t||e(`Failed to register mod ${r}: Expected options to be undefined or object, got ${typeof t}`);const i=!0===t.allowReplace,a=f.get(o.name);a&&(a.allowReplace&&i||e(`Refusing to load mod ${r}: it is already loaded and doesn't allow being replaced.\nWas the mod loaded multiple times?`),u(a));const c=o=>{let e=g.patching.get(o.name);return e||(e={hooks:[],patches:new Map},g.patching.set(o.name,e)),e},s=(o,t)=>(...n)=>{var i,a;const c=null===(a=(i=m.errorReporterHooks).apiEndpointEnter)||void 0===a?void 0:a.call(i,o,g.name);g.loaded||e(`Mod ${r} attempted to call SDK function after being unloaded`);const s=t(...n);return null==c||c(),s},p={unload:s("unload",(()=>u(g))),hookFunction:s("hookFunction",((o,t,n)=>{"string"==typeof o&&o||e(`Mod ${r} failed to patch a function: Expected function name string, got ${typeof o}`);const i=l(o),a=c(i);"number"!=typeof t&&e(`Mod ${r} failed to hook function '${o}': Expected priority number, got ${typeof t}`),"function"!=typeof n&&e(`Mod ${r} failed to hook function '${o}': Expected hook function, got ${typeof n}`);const s={mod:g.name,priority:t,hook:n};return a.hooks.push(s),d(),()=>{const o=a.hooks.indexOf(s);o>=0&&(a.hooks.splice(o,1),d())}})),patchFunction:s("patchFunction",((o,t)=>{"string"==typeof o&&o||e(`Mod ${r} failed to patch a function: Expected function name string, got ${typeof o}`);const i=l(o),a=c(i);n(t)||e(`Mod ${r} failed to patch function '${o}': Expected patches object, got ${typeof t}`);for(const[n,i]of Object.entries(t))"string"==typeof i?a.patches.set(n,i):null===i?a.patches.delete(n):e(`Mod ${r} failed to patch function '${o}': Invalid format of patch '${n}'`);d()})),removePatches:s("removePatches",(o=>{"string"==typeof o&&o||e(`Mod ${r} failed to patch a function: Expected function name string, got ${typeof o}`);const t=l(o);c(t).patches.clear(),d()})),callOriginal:s("callOriginal",((o,t,n)=>{"string"==typeof o&&o||e(`Mod ${r} failed to call a function: Expected function name string, got ${typeof o}`);const i=l(o);return Array.isArray(t)||e(`Mod ${r} failed to call a function: Expected args array, got ${typeof t}`),i.original.apply(null!=n?n:globalThis,t)})),getOriginalHash:s("getOriginalHash",(o=>{"string"==typeof o&&o||e(`Mod ${r} failed to get hash: Expected function name string, got ${typeof o}`);return l(o).originalHash}))},g={name:o.name,fullName:o.fullName,version:o.version,repository:o.repository,allowReplace:i,api:p,loaded:!0,patching:new Map};return f.set(o.name,g),Object.freeze(p)}function h(){const o=[];for(const e of f.values())o.push({name:e.name,fullName:e.fullName,version:e.version,repository:e.repository});return o}let m;const y=void 0===window.bcModSdk?window.bcModSdk=function(){const e={version:o,apiVersion:1,registerMod:g,getModsInfo:h,getPatchingInfo:p,errorReporterHooks:Object.seal({apiEndpointEnter:null,hookEnter:null,hookChainExit:null})};return m=e,Object.freeze(e)}():(n(window.bcModSdk)||e("Failed to init Mod SDK: Name already in use"),1!==window.bcModSdk.apiVersion&&e(`Failed to init Mod SDK: Different version already loaded ('1.2.0' vs '${window.bcModSdk.version}')`),window.bcModSdk.version!==o&&alert(`Mod SDK warning: Loading different but compatible versions ('1.2.0' vs '${window.bcModSdk.version}')\nOne of mods you are using is using an old version of SDK. It will work for now but please inform author to update`),window.bcModSdk);return"undefined"!=typeof exports&&(Object.defineProperty(exports,"__esModule",{value:!0}),exports.default=y),y}();
//SDK end

(() => {
    const modApi = bcModSdk.registerMod({
        name: 'Coordinate drawing tool',
        fullName: 'Bondage Club - Coordinate adjustment tool',
        version: '1.0',
        repository: '座標繪製工具 // Coordinate adjustment tool',
    });

  if (window.BCUIDebugger) return;

  window.BCUIDebugger = {
    enabled: false,
    elements: [],
    gridSize: 50,
    majorGridSize: 200,
    drag: { active: false, startX: 0, startY: 0, endX: 0, endY: 0, target: null, offsetX: 0, offsetY: 0 },

    toggle() {
      this.enabled = !this.enabled;
      console.log(`🔧 BCUIDebugger: ${this.enabled ? "啟用" : "停用"}`);
    },

    addElement(label, x, y, w, h) {
      this.elements.push({ label, x, y, w, h });
      console.log(`📍 標記 ${label}: (${x}, ${y}, ${w}, ${h})`);
    },

    clear() {
      this.elements = [];
      console.log("🧹 已清除所有標記");
    },

    drawGrid() {
      if (!this.enabled) return;
      for (let x = 0; x <= 2000; x += this.gridSize) {
        const isMajor = x % this.majorGridSize === 0;
        DrawRect(x, 0, 1, 1000, isMajor ? "#666" : "#333", 1);
        if (isMajor) DrawText(x.toString(), x + 2, 15, "#666", "Arial", 12);
      }
      for (let y = 0; y <= 1000; y += this.gridSize) {
        const isMajor = y % this.majorGridSize === 0;
        DrawRect(0, y, 2000, 1, isMajor ? "#666" : "#333", 1);
        if (isMajor) DrawText(y.toString(), 2, y + 12, "#666", "Arial", 12);
      }
    },

    drawMouse() {
      if (!this.enabled || typeof MouseX === "undefined") return;
      DrawText(`滑鼠: (${MouseX},${MouseY})`, 10, 30, "Yellow", "Arial", 18);
      DrawRect(MouseX - 10, MouseY, 20, 1, "Yellow", 1);
      DrawRect(MouseX, MouseY - 10, 1, 20, "Yellow", 1);
    },

    drawElements() {
      if (!this.enabled) return;
      this.elements.forEach(e => {
        DrawRect(e.x, e.y, e.w, e.h, "rgba(255,0,0,0.3)");
        DrawTextFit(e.label, e.x + e.w/2, e.y + e.h/2, e.w, "Black");
      });
    },

    drawDragBox() {
      if (!this.enabled || !this.drag.active || this.drag.target) return;
      const { startX, startY, endX, endY } = this.drag;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      DrawRect(x, y, w, h, "rgba(0,255,0,0.3)");
      DrawTextFit(`(${x},${y}) ${w}×${h}`, x + w/2, y + h/2, w, "Black");
    },

    draw() {
      if (!this.enabled) return;
      this.drawGrid();
      this.drawMouse();
      this.drawElements();
      this.drawDragBox();
    }
  };

  // ===== Hook 畫面更新 =====
  const oldDraw = window.PreferenceSubscreenExtensionsRun;
  window.PreferenceSubscreenExtensionsRun = function() {
    if (oldDraw) oldDraw.apply(this, arguments);
    BCUIDebugger.draw();
  };

  // ===== 監聽滑鼠事件 =====
  window.addEventListener("mousedown", e => {
    if (!BCUIDebugger.enabled) return;
    if (typeof MouseX === "undefined") return;

    // 檢查是否點擊已標記元素 → 拖動模式
    const clicked = BCUIDebugger.elements.find(el =>
      MouseX >= el.x && MouseX <= el.x + el.w &&
      MouseY >= el.y && MouseY <= el.y + el.h
    );
    if (clicked) {
      BCUIDebugger.drag.active = true;
      BCUIDebugger.drag.target = clicked;
      BCUIDebugger.drag.offsetX = MouseX - clicked.x;
      BCUIDebugger.drag.offsetY = MouseY - clicked.y;
    } else {
      // 拖拉新框
      BCUIDebugger.drag.active = true;
      BCUIDebugger.drag.startX = MouseX;
      BCUIDebugger.drag.startY = MouseY;
      BCUIDebugger.drag.endX = MouseX;
      BCUIDebugger.drag.endY = MouseY;
      BCUIDebugger.drag.target = null;
    }
  });

  window.addEventListener("mousemove", e => {
    if (!BCUIDebugger.enabled || !BCUIDebugger.drag.active) return;
    if (typeof MouseX === "undefined") return;
    if (BCUIDebugger.drag.target) {
      // 拖動已標記元素
      BCUIDebugger.drag.target.x = MouseX - BCUIDebugger.drag.offsetX;
      BCUIDebugger.drag.target.y = MouseY - BCUIDebugger.drag.offsetY;
    } else {
      BCUIDebugger.drag.endX = MouseX;
      BCUIDebugger.drag.endY = MouseY;
    }
  });

  window.addEventListener("mouseup", e => {
    if (!BCUIDebugger.enabled || !BCUIDebugger.drag.active) return;
    if (typeof MouseX === "undefined") return;
    BCUIDebugger.drag.active = false;

    if (!BCUIDebugger.drag.target) {
      // 拖拉新框完成
      const x = Math.min(BCUIDebugger.drag.startX, BCUIDebugger.drag.endX);
      const y = Math.min(BCUIDebugger.drag.startY, BCUIDebugger.drag.endY);
      const w = Math.abs(BCUIDebugger.drag.endX - BCUIDebugger.drag.startX);
      const h = Math.abs(BCUIDebugger.drag.endY - BCUIDebugger.drag.startY);

      if (w > 5 && h > 5) {
        const label = prompt(`抓取到框框 (${x},${y}) ${w}×${h}\n要加入 BCUIDebugger 嗎？輸入標籤文字，取消則不加入`);
        if (label) BCUIDebugger.addElement(label, x, y, w, h);
      }
    } else {
      // 拖動已標記元素結束
      BCUIDebugger.drag.target = null;
    }
  });

  console.log("✅ BCUIDebugger 已載入 (拖拉新框 & 拖動已標記框功能已啟用)");
  console.log("BCUIDebugger.toggle() - 開關調試模式");
  console.log("BCUIDebugger.addElement('按鈕1', 100, 200, 120, 40) - 手動標記元素");
  console.log("BCUIDebugger.clear() - 清除所有標記");
})();
