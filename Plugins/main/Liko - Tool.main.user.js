// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      2.3.1
// @description  Bondage Club - Likolisu's tool
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_ChatRoomButtons.js
// @run-at       document-end
// ==/UserScript==

(function () {
    // 防重複載入必須先於生命週期資源、事件與初始化。
    window.Liko = window.Liko ?? {};
    if (window.Liko.LT) return;
    const MOD_Version = "2.3.1";
    window.Liko.LT = MOD_Version;

    // 閱讀順序：生命週期 → 靜態資源／語系 → 設定 → 共用操作 → UI → 功能 → Hook → 啟動。
    // 區塊以 SECTION 編號定位；功能所屬狀態與函式放在一起。
    // 頂層僅定義資料與函式，事件／Hook 由 initialize() 在登入後註冊。

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 01 生命週期：排程、事件與等待
    // ════════════════════════════════════════════════════════════════════════
    let disposed = false;

    const lifecycle = new AbortController();

    const timers = new Set(), intervals = new Set(), frames = new Set(), cleanupTasks = new Set();

    function setTimeout(fn, ms, ...args) {
        if (disposed) return null;
        const id = globalThis.setTimeout(() => { timers.delete(id); if (!disposed) fn(...args); }, ms);
        timers.add(id); return id;
    }

    function clearTimeout(id) { globalThis.clearTimeout(id); timers.delete(id); }

    function setInterval(fn, ms) {
        if (disposed) return null;
        const id = globalThis.setInterval(() => { if (!disposed) fn(); }, ms);
        intervals.add(id); return id;
    }

    function clearInterval(id) { globalThis.clearInterval(id); intervals.delete(id); }

    function requestAnimationFrame(fn) {
        if (disposed) return null;
        const id = globalThis.requestAnimationFrame(time => { frames.delete(id); if (!disposed) fn(time); });
        frames.add(id); return id;
    }

    function listen(target, type, fn, options = {}) {
        target.addEventListener(type, fn, { ...(typeof options === 'boolean' ? { capture: options } : options), signal: lifecycle.signal });
    }

    function stopLifecycle() {
        disposed = true; lifecycle.abort();
        timers.forEach(id => globalThis.clearTimeout(id)); timers.clear();
        intervals.forEach(id => globalThis.clearInterval(id)); intervals.clear();
        frames.forEach(id => globalThis.cancelAnimationFrame(id)); frames.clear();
        cleanupTasks.forEach(fn => { try { fn(); } catch (error) { console.warn(error); } });
        cleanupTasks.clear();
    }

    function waitFor(check, interval = 200, timeout = 0) {
        return new Promise(resolve => {
            let timer; const started = Date.now();
            const finish = value => { clearTimeout(timer); lifecycle.signal.removeEventListener('abort', cancel); resolve(value); };
            const cancel = () => finish(false);
            function poll() {
                if (disposed) return finish(false);
                try { if (check()) return finish(true); } catch {}
                if (timeout && Date.now() - started >= timeout) return finish(false);
                timer = setTimeout(poll, interval);
            }
            lifecycle.signal.addEventListener('abort', cancel, { once: true });
            poll();
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 02 靜態資源：座標、圖示、徽章與色彩
    // ════════════════════════════════════════════════════════════════════════
    const rpBtnX    = 955;

    const rpBtnY    = 855;

    const rpBtnSize = 45;

    const rpIconUrl = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/likorp.png";

    const TOGGLE_MSG_MS = 5000; // 所有开关提示讯息 5 秒后消失

    /* ── 工具面板默认锚点（触发按钮已移至 #chat-room-buttons）── */
    const TOOL_BTN_X = 955;

    const TOOL_BTN_Y = 555;

    // ════════════════════════════════════════════════════════════════════════
    // 聊天室触发按钮 — 注入到 #chat-room-buttons（顺位 9，参考 BC_ChatRoomButtons）
    // ════════════════════════════════════════════════════════════════════════
    const TOOL_CRB_ID = 'likotool';

    const TOOL_CRB_ORDER = 9;

    const TOOL_BTN_DOM_ID = 'lt-tool-trigger-btn';

    // APNG 的懸停播放與靜止 poster 由 CRB 統一處理。
    const TOOL_ICON_URL = 'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/Tool/Tool-icon.png';

    // ════════════════════════════════════════════════════════════════════════
    // SVG 图标库 — 线条风格，stroke=currentColor
    // ════════════════════════════════════════════════════════════════════════
    const SVG = {
        wardrobe:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
        undo:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7"/></svg>',
        free:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></svg>',
        lock:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.5"/></svg>',
        freetotal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1"/></svg>',
        unlock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/></svg>',
        password:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
        struggle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><path d="M8 10l4 1 4-1"/><path d="M10 13l-2 7M14 13l2 7"/></svg>',
        enhance:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 5L19 9.5 13.5 11 12 16l-1.5-5L5 9.5 10.5 8z"/><path d="M19 15v3M20.5 16.5h-3M5 17v2M6 18H4"/></svg>',
        bcx:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>',
        settings:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>',
        dark:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
        light:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
        grip:      '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/></svg>',
        close:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        chevron:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
        rp:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="22" y1="2" x2="2" y2="22"/></svg>',
        dnd:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="7.5" y1="12" x2="16.5" y2="12"/></svg>',
        ooc:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/><path d="M10 8.7c-1 1-1 5.6 0 6.6M14 8.7c1 1 1 5.6 0 6.6"/></svg>',
        heightFix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
        heightLock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 9v3M11 9v3M15 9v3M19 9v3"/></svg>',
        rpBtn:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="8" cy="12" r="1.5"/></svg>',
        edit:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        craftEdit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.4"/></svg>',
        craftClear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M4 4l16 16"/></svg>',
        ignoreBlock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/><path d="M3 3l18 18"/></svg>',
        magicDefense:'<svg viewBox="0 0 100 100" fill="currentColor"><path fill-rule="evenodd" d="m23.17 6c.57 0 2.04 3.49 5.48 15.5l7.69 2.5c4.22 1.38 7.68 2.84 7.67 3.25 0 .41-3.5 1.86-15.51 5.71L26 40.5c-1.38 4.14-2.84 7.53-3.25 7.52-.41-.01-1.7-3.06-2.87-6.77-1.16-3.71-2.63-7.26-3.25-7.88-.62-.62-4.17-2.09-7.88-3.25-3.71-1.17-6.76-2.46-6.77-2.87-.01-.41 3.38-1.88 15.06-5.75l2.55-7.75C20.99 9.49 22.6 6 23.17 6Zm41.97 16.59c.37.5 2.69 5.86 9.66 22.91l11.35 4.82c6.24 2.65 11.71 5.12 12.14 5.5.44.37-4.6 2.93-23.19 10.68L70.26 78c-2.65 6.33-5.23 11.5-5.71 11.5-.49 0-3.03-5.17-10.44-23l-12.05-5c-6.62-2.75-11.71-5.29-11.3-5.65.41-.36 5.46-2.56 11.24-4.91 5.78-2.34 11.02-4.75 11.66-5.35.63-.6 2.82-5.14 4.86-10.09 2.03-4.95 4.21-10.09 4.83-11.41.62-1.33 1.43-2 1.79-1.5ZM56 54.3l-4.5 1.99c8.16 3.53 9.39 4.76 11.07 8.55l2.08 4.66c3.53-7.95 4.98-9.47 8.21-11 2.31-1.1 4.2-2.23 4.2-2.5-.01-.28-1.86-1.17-4.12-2-3.27-1.19-4.5-2.37-6.03-5.75-1.05-2.34-2.16-4.25-2.47-4.25-.31 0-1.33 1.87-2.25 4.16-1.35 3.32-2.6 4.56-6.19 6.14ZM23.24 68c.56 0 1.55 2.14 2.19 4.75 1.06 4.28 1.58 4.9 5.28 6.25 2.26.83 4.49 1.8 4.95 2.17.46.38-1.41 1.37-4.16 2.22-4.62 1.42-5.11 1.89-6.5 6.1-.83 2.51-1.84 4.56-2.25 4.54-.41-.02-1.36-1.94-2.1-4.28-.75-2.34-1.99-4.58-2.75-4.98-.77-.41-2.98-1.36-4.9-2.13-3.11-1.24-3.28-1.49-1.5-2.17 1.1-.42 3.35-1.29 5-1.94 2.36-.92 3.29-2.18 4.36-5.85.74-2.58 1.81-4.68 2.38-4.68Z"/></svg>',
    };

    // ──────────────────────────────────────────
    // 通用按鈕选单
    // ──────────────────────────────────────────
    const ZONE_VIEW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

    const LIST_VIEW_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

    const TOOL_SETTINGS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" opacity=".99"><path fill-rule="evenodd" d="m50.05 4c5.78 0 7.02 0.29 7.39 1.75 0.25 0.96 0.7 3.89 1 6.5 0.49 4.18 0.97 4.96 7.5 8.25l5.28-3.73c2.91-2.05 5.73-3.76 6.28-3.79 0.55-0.04 2.91 1.98 5.25 4.48 2.34 2.5 4.25 4.77 4.25 5.04 0 0.27-1.69 3-3.75 6.05-3.7 5.47-3.73 5.59-2.14 8.75 1.44 2.89 2.23 3.3 14.39 5.2l0.27 7c0.19 4.87-0.12 7.21-1 7.69-0.7 0.37-3.63 0.94-6.52 1.25-4.76 0.51-5.41 0.88-8.75 7.5l3.73 5.28c2.05 2.91 3.73 5.73 3.74 6.28 0 0.55-1.9 2.92-4.23 5.26-2.33 2.35-4.58 4.26-4.99 4.25-0.41 0-3.25-1.7-11.85-7.51l-3.45 1.75c-3.03 1.54-3.52 2.33-4.01 6.5-0.3 2.61-0.75 5.54-1 6.5-0.37 1.46-1.61 1.75-7.44 1.75-4.72 0-7.13-0.41-7.4-1.25-0.23-0.69-0.79-3.68-1.25-6.65-0.74-4.71-1.26-5.61-4.05-7-3.15-1.58-3.28-1.54-8.75 2.15-3.05 2.06-5.89 3.76-6.3 3.76-0.41 0.01-2.66-1.9-4.99-4.25-2.33-2.34-4.24-4.71-4.25-5.26 0-0.55 1.57-3.36 3.49-6.25 3.31-4.96 3.43-5.43 2.17-8.5-1.15-2.84-1.95-3.35-6.25-4.06-2.7-0.44-5.71-1-6.67-1.25-1.46-0.37-1.75-1.61-1.75-7.44 0-4.72 0.41-7.13 1.25-7.4 0.69-0.23 3.69-0.79 6.67-1.25 4.96-0.78 5.54-1.14 6.8-4.35 1.34-3.37 1.26-3.69-2.17-8.75-1.95-2.89-3.54-5.59-3.54-6 0.01-0.41 1.89-2.66 4.19-5 2.29-2.34 4.65-4.25 5.23-4.25 0.59 0 3.46 1.69 11.71 7.5l3.43-1.75c3.16-1.61 3.48-2.2 4.03-7.5 0.33-3.16 0.8-6.09 1.05-6.5 0.25-0.41 3.58-0.75 7.4-0.75zm-4.98 10.25c-0.62 3.44-1.22 6.26-1.34 6.28-0.13 0.01-2.48 0.97-5.23 2.13l-5 2.11-10.55-7.27-5.45 5.4 7.34 10.6c-3.14 6.97-4.79 9.54-5.7 10.21-0.9 0.66-3.78 1.45-6.39 1.75l-4.75 0.54v8c7.36 0.84 10.24 1.63 11.14 2.29 0.91 0.67 2.55 3.23 3.65 5.71l2.01 4.5-7.3 10.55 5.4 5.45 10.6-7.32c7.75 3.31 10.1 4.28 10.23 4.29 0.12 0.02 0.68 2.84 1.25 6.28l1.02 6.25h8c1.59-9.69 2.15-12.51 2.27-12.53 0.13-0.01 2.48-0.98 5.23-2.16l5-2.13 10.6 7.32 5.4-5.4-7.32-10.6c3.31-7.75 4.28-10.1 4.29-10.23 0.02-0.12 2.84-0.68 6.28-1.25l6.25-1.02v-8c-9.69-1.59-12.51-2.15-12.53-2.27-0.01-0.13-0.98-2.48-2.16-5.23l-2.13-5 7.32-10.6-5.45-5.4-10.12 7c-10.63-3.92-10.88-4.18-11.89-8.75-0.57-2.61-1.04-5.43-1.04-6.25 0-1.08-1.1-1.5-3.91-1.5h-3.91zm4.69 19.79c1.78-0.02 4.71 0.56 6.5 1.29 1.78 0.74 4.48 2.76 6 4.5 1.51 1.74 3.02 4.86 3.36 6.92 0.33 2.06 0.29 5.33-0.11 7.25-0.41 2.02-2.26 5.04-4.36 7.14q-3.64 3.64-7.64 4.37c-2.2 0.39-5.58 0.39-7.5 0-2.02-0.42-5.05-2.26-7.15-4.37q-3.64-3.64-4.36-7.64c-0.39-2.2-0.44-5.46-0.11-7.25 0.34-1.79 1.67-4.66 2.96-6.38 1.29-1.73 3.87-3.73 5.75-4.46 1.87-0.73 4.87-1.35 6.66-1.37zm-8.9 8.39c-1.78 2.07-2.35 3.93-2.35 7.63 0 4.2 0.46 5.37 3.27 8.17 2.81 2.81 3.96 3.27 8.23 3.27 4.27 0 5.41-0.46 8.23-3.27 2.81-2.81 3.27-3.96 3.27-8.23 0-4.17-0.48-5.45-3-8.02-2.07-2.1-4.25-3.19-7-3.5-2.2-0.25-4.97-0.08-6.15 0.38-1.18 0.47-3.21 2.07-4.5 3.57z"/></svg>';

    // ════════════════════════════════════════════════════════════════════════
    // Canvas 图标渲染 — SVG → Image → MainCanvas.drawImage
    // ════════════════════════════════════════════════════════════════════════
    var _canvasIconCache = {};

    function _makeCanvasSvg(paths, color) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + (color || '#ffffff') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
    }

    var CANVAS_ICONS = {
        tool: _makeCanvasSvg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
        rp:   _makeCanvasSvg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="22" y1="2" x2="2" y2="22"/>'),
    };

    function getCanvasIcon(key) {
        if (_canvasIconCache[key]) return _canvasIconCache[key];
        var img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(CANVAS_ICONS[key]);
        _canvasIconCache[key] = img;
        return img;
    }

    function drawCanvasIconOnButton(key, btnX, btnY, btnW, btnH, iconSize) {
        var img = getCanvasIcon(key);
        if (img.complete && img.naturalWidth > 0) {
            var sz = iconSize || 22;
            var x = btnX + (btnW - sz) / 2;
            var y = btnY + (btnH - sz) / 2;
            try { MainCanvas.drawImage(img, x, y, sz, sz); } catch (e) {}
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 角色头顶状态徽章（画在人物身上，广播状态让别人看得到）— 白色图标 + 彩色圆底
    // ════════════════════════════════════════════════════════════════════════
    const BADGE_SVG = {
        // 勿扰：抓痕
        dnd:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffffff" d="m1.35 2.75c-0.44 1.29 2.38 4.7 10.78 13.01 6.25 6.19 12.16 11.25 13.12 11.25 1-0.01 1.75-0.76 1.76-1.76 0-0.96-5.06-6.81-11.25-12.99-6.2-6.19-11.83-11.25-12.53-11.25-0.71-0.01-1.55 0.78-1.88 1.74zm45.1 0.47c-1.39 1.88-1.63 4.98-1.55 20.25l0.09 18.03c29.4 29.45 38.29 37.63 38.72 37.17 0.44-0.46 0.93-11.48 1.11-24.5 0.17-13.02 0.06-24.68-0.25-25.92-0.36-1.43-1.58-2.46-3.32-2.83-1.92-0.41-3.29-0.03-4.53 1.25-1.49 1.53-1.78 3.59-1.75 12.58 0.02 6.2-0.39 10.96-0.97 11.25-0.55 0.27-1.7-0.06-2.54-0.75-1.3-1.05-1.54-4.21-1.5-19.5 0.04-17.27-0.07-18.3-1.96-19.25-1.1-0.55-2.34-0.99-2.75-0.98-0.41 0-1.42 0.44-2.25 0.96-1.2 0.75-1.6 4.29-2 17.73-0.48 15.96-0.6 16.79-2.5 16.79-1.92 0-2.02-0.83-2.5-21.29-0.41-17.45-0.77-21.46-2-22.23-0.83-0.52-2.49-0.96-3.7-0.96-1.21-0.01-2.94 0.98-3.85 2.2zm-14.45 8.78c-1.57 1.57-2 3.34-2.01 8.25-0.01 6.13 0.07 6.34 4.75 10.99 2.62 2.6 5.1 4.74 5.51 4.75 0.41 0 0.75-4.83 0.76-10.74 0-7.93-0.39-11.34-1.5-13-0.83-1.24-2.41-2.25-3.51-2.25-1.1 0-2.9 0.9-4 2zm-2 34.25l0.01 11.25c10.53 10.13 12.8 13.07 12.49 14-0.28 0.83-1.06 1.48-1.75 1.46-0.69-0.02-7.1-5.36-14.25-11.85-7.15-6.5-14.01-12.11-15.25-12.46-1.63-0.47-2.94 0.04-4.75 1.85-1.38 1.37-2.5 2.95-2.5 3.5 0 0.55 3.04 5.4 6.75 10.79 3.71 5.38 10.57 15.29 15.25 22.01l8.5 12.23 42 0.03c2.11-4.31 3.36-7.36 4.14-9.56l1.41-4c-39.18-39.14-50.89-50.5-51.3-50.5-0.41 0-0.75 5.06-0.75 11.25zm54.99 40.5c-0.01 0.96 2.35 4.11 5.25 6.99 2.89 2.88 6.05 5.24 7.01 5.25 1 0.01 1.75-0.74 1.76-1.74 0.01-0.96-2.35-4.11-5.25-6.99-2.89-2.88-6.05-5.24-7.01-5.25-1-0.01-1.75 0.74-1.76 1.74z"/></svg>',
        // 无视绑缚：麦束
        free: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffffff" d="m41 8.45c-4.67 0.64-9.51 1.7-10.75 2.36-1.42 0.75-2.25 2.12-2.25 3.69 0 1.38 0.68 2.73 1.5 3 0.82 0.27 6.56 0.49 12.75 0.48 10.5-0.01 11.47 0.15 14.5 2.5l3.25 2.52c-13.56 9.47-18.28 13.19-19.23 14.36-0.95 1.18-1.73 3.49-1.74 5.14-0.01 2.12 2.12 6.06 7.33 13.5l7.34 10.5c-17.98 1.55-23.76 2.34-24.45 2.75-0.69 0.41-1.25 2.1-1.25 3.75q0 3 2 4c1.1 0.55 9.83 1 19.5 1 9.67 0 18.4-0.45 19.5-1 1.28-0.64 1.99-1.98 1.98-3.75-0.02-1.68-2.78-7.03-7.12-13.75-6.68-10.37-6.98-11.08-5.22-12.34 1.02-0.73 6.14-4.11 11.36-7.5 7.37-4.78 9.56-6.72 9.78-8.66 0.17-1.51-1.03-4.48-3.01-7.5-2.28-3.47-5.89-6.76-11.78-10.77-6.69-4.54-9.23-5.73-11.99-5.6-1.92 0.08-7.33 0.68-12 1.32zm41.97 2.08c-2.24 2.46-3.18 4.45-3.1 6.5 0.09 1.95 1.33 4.17 3.63 6.47 2.13 2.13 4.48 3.5 6 3.5 1.38 0 3.74-0.62 5.25-1.38 1.51-0.76 3.31-2.56 4-4 0.69-1.44 1.25-3.52 1.25-4.62 0-1.1-0.5-3.01-1.12-4.25-0.61-1.24-2.07-3.03-3.25-3.98-1.17-0.95-3.77-1.74-5.78-1.75-2.92-0.02-4.3 0.69-6.88 3.51zm-82.42 14.47c-0.3 0.55-0.33 1.45-0.05 2 0.31 0.62 8.33 1 21 1 19.83 0 20.5-0.07 20.5-2 0-1.93-0.67-2-20.45-2-12.6 0-20.66 0.38-21 1zm0 10c-0.3 0.55-0.33 1.45-0.05 2 0.3 0.6 6.67 1 16 1 14.83 0 15.5-0.09 15.5-2 0-1.91-0.67-2-15.45-2-9.27 0-15.67 0.4-16 1zm0 10c-0.3 0.55-0.33 1.45-0.05 2 0.3 0.6 6.67 1 16 1 14.83 0 15.5-0.09 15.5-2 0-1.91-0.67-2-15.45-2-9.27 0-15.67 0.4-16 1zm0 10c-0.3 0.55-0.33 1.45-0.05 2 0.31 0.62 8 1 20 1 18.83 0 19.5-0.07 19.5-2 0-1.93-0.67-2-19.45-2-11.94 0-19.66 0.39-20 1zm34.05 32.25c-2.5 2.89-4.75 5.92-4.99 6.75-0.24 0.83 0.2 2.51 0.97 3.75 0.78 1.24 2.32 2.25 3.42 2.25 1.16 0 5.87-3.75 11.25-8.97l9.25-8.98-15.35-0.05zm40.36-45.94c-3.32 2.33-4.43 3.73-4.14 5.19 0.21 1.1 0.91 2.62 1.53 3.37 0.91 1.08 3.31 1.22 11.65 0.64 5.77-0.4 11.28-1.13 12.25-1.62 1.14-0.58 1.66-1.85 1.5-3.64-0.21-2.27-0.78-2.79-3.25-3-1.65-0.14-5.37-0.48-8.25-0.75-3.78-0.36-5.25-0.92-5.25-2 0-0.83-0.34-1.48-0.75-1.44-0.42 0.03-2.8 1.49-5.29 3.25z"/></svg>',
        magicDefense: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffffff" fill-rule="evenodd" d="m23.17 6c.57 0 2.04 3.49 5.48 15.5l7.69 2.5c4.22 1.38 7.68 2.84 7.67 3.25 0 .41-3.5 1.86-15.51 5.71L26 40.5c-1.38 4.14-2.84 7.53-3.25 7.52-.41-.01-1.7-3.06-2.87-6.77-1.16-3.71-2.63-7.26-3.25-7.88-.62-.62-4.17-2.09-7.88-3.25-3.71-1.17-6.76-2.46-6.77-2.87-.01-.41 3.38-1.88 15.06-5.75l2.55-7.75C20.99 9.49 22.6 6 23.17 6Zm41.97 16.59c.37.5 2.69 5.86 9.66 22.91l11.35 4.82c6.24 2.65 11.71 5.12 12.14 5.5.44.37-4.6 2.93-23.19 10.68L70.26 78c-2.65 6.33-5.23 11.5-5.71 11.5-.49 0-3.03-5.17-10.44-23l-12.05-5c-6.62-2.75-11.71-5.29-11.3-5.65.41-.36 5.46-2.56 11.24-4.91 5.78-2.34 11.02-4.75 11.66-5.35.63-.6 2.82-5.14 4.86-10.09 2.03-4.95 4.21-10.09 4.83-11.41.62-1.33 1.43-2 1.79-1.5ZM56 54.3l-4.5 1.99c8.16 3.53 9.39 4.76 11.07 8.55l2.08 4.66c3.53-7.95 4.98-9.47 8.21-11 2.31-1.1 4.2-2.23 4.2-2.5-.01-.28-1.86-1.17-4.12-2-3.27-1.19-4.5-2.37-6.03-5.75-1.05-2.34-2.16-4.25-2.47-4.25-.31 0-1.33 1.87-2.25 4.16-1.35 3.32-2.6 4.56-6.19 6.14ZM23.24 68c.56 0 1.55 2.14 2.19 4.75 1.06 4.28 1.58 4.9 5.28 6.25 2.26.83 4.49 1.8 4.95 2.17.46.38-1.41 1.37-4.16 2.22-4.62 1.42-5.11 1.89-6.5 6.1-.83 2.51-1.84 4.56-2.25 4.54-.41-.02-1.36-1.94-2.1-4.28-.75-2.34-1.99-4.58-2.75-4.98-.77-.41-2.98-1.36-4.9-2.13-3.11-1.24-3.28-1.49-1.5-2.17 1.1-.42 3.35-1.29 5-1.94 2.36-.92 3.29-2.18 4.36-5.85.74-2.58 1.81-4.68 2.38-4.68Z"/></svg>',
    };

    const BADGE_COLOR = { dnd: '#d03030', free: '#2d8bc4', magicDefense: '#7a45c4' };

    var _badgeImgCache = {};

    function getBadgeImg(key) {
        if (_badgeImgCache[key]) return _badgeImgCache[key];
        var img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(BADGE_SVG[key]);
        _badgeImgCache[key] = img;
        return img;
    }

    // 画一颗徽章：彩色圆底 + 白描边 + 白色图标
    function drawBadgeDisc(key, x, y, size) {
        try {
            const cx = x + size / 2, cy = y + size / 2, r = size / 2;
            MainCanvas.save();
            MainCanvas.beginPath();
            MainCanvas.arc(cx, cy, r, 0, Math.PI * 2);
            MainCanvas.fillStyle = BADGE_COLOR[key] || '#333';
            MainCanvas.fill();
            MainCanvas.lineWidth = Math.max(2, size * 0.07);
            MainCanvas.strokeStyle = 'rgba(255,255,255,0.9)';
            MainCanvas.stroke();
            MainCanvas.restore();
        } catch (e) {}
        const img = getBadgeImg(key);
        if (img.complete && img.naturalWidth > 0) {
            const pad = size * 0.24;
            try { MainCanvas.drawImage(img, x + pad, y + pad, size - 2 * pad, size - 2 * pad); } catch (e) {}
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 强调色预设
    // ════════════════════════════════════════════════════════════════════════
    const ACCENT_PRESETS = [
        { id: 'purple', accent: '#8b2dc4', accentDark: '#3a1070', accentLight: '#a060e0' },
        { id: 'blue', accent: '#2d6bc4', accentDark: '#103a70', accentLight: '#6090e0' },
        { id: 'teal', accent: '#1aaa88', accentDark: '#0a6048', accentLight: '#40c8a8' },
        { id: 'pink', accent: '#c42d8b', accentDark: '#70103a', accentLight: '#e060a0' },
        { id: 'orange', accent: '#c47b2d', accentDark: '#704010', accentLight: '#e0a060' },
        { id: 'red', accent: '#c42d2d', accentDark: '#701010', accentLight: '#e06060' },
    ];

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 03 語系：文字資料與翻譯入口
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // 雙語言系統
    // ──────────────────────────────────────────
    function isZh() {
        if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
            const l = TranslationLanguage.toLowerCase();
            return l === 'cn' || l === 'tw';
        }
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    const LANG = {
        zh: {
            scrollbar: "垂直捲軸",
            back: "返回",
            toolbox: "工具箱",
            menuEdit: "編輯順序與顯示功能",
            toggleSection: "开关",
            toggleRp: "RP模式",
            toggleRpHelp: "开启后屏蔽游戏 Action 消息",
            toggleDnd: "勿扰模式",
            toggleDndHelp: "除自己外，任何人对你外观的编辑（换衣/拘束）都会立即复原",
            toggleMagic: "魔法防御",
            toggleMagicHelp: "抵御所有对你施放的 LSCG 魔法",
            toggleFree: "无视绑缚",
            toggleFreeHelp: "被绑缚时仍可使用双手（不会实际解开道具）",
            toggleBlock: "无视衣物阻挡",
            toggleBlockHelp: "被服装/道具遮挡的格子仍可换装、装拘束（不必先脱）",
            toggleRaise: "拉高視角",
            toggleRaiseHelp: "互動畫面消除 HeightModifier 位移，不改寫人物屬性",
            toggleScale: "固定身高比例",
            toggleScaleHelp: "人物與互動格使用顯示比例 1，不改寫人物屬性",
            toggleOoc: "说话总是OOC",
            toggleOocHelp: "聊天/密语时自动加括号转为 OOC（不会被口塞乱码）",
            toggleRpButton: "显示RP按钮",
            toggleRpButtonHelp: "在游戏画面显示 RP 切换按钮",
            viewCharacterHint: "目前：人物模式；點擊切換清單",
            viewListHint: "目前：清單模式；點擊切換人物",
            craftItemChanged: "物品已變更，請重新選取。",
            craftSaved: "已保存，可繼續編輯。",
            export: "匯出",
            craftCopyFailed: "複製失敗，請重試。",
            craftCopied: "已複製，可在遊戲 Craft 匯入。",
            craftSingleTitle: "單項屬性編輯",
            craftBatch: "批量編輯",
            craftSingle: "單項編輯",
            undoDiffPrefix: "与目前外观比较：",
            undoDiffHelp: "新增 / 移除 / 修改的装备组数",
            fixedScalePrefix: "固定顯示比例：",
            menuVisibility: "點擊隱藏／顯示；長按後拖移排序",
            menuDragHint: "長按後拖移排序",
            accentPurple: "紫色",
            accentBlue: "藍色",
            accentTeal: "青色",
            accentPink: "粉色",
            accentOrange: "橙色",
            accentRed: "紅色",
            close:        "关闭",
            confirm:      "确认",
            cancel:       "取消",
            noPermission: "无权限互动",
            notInRoom:    "不在房间内",
            unknown:      "未知",
            notInChat:    "不在聊天室",

            undoTitle:       "外观回滚",
            undoNoRecord:    "没有外观变更记录",
            undoChangedAt:   "变更时间",
            undoChangedBy:   "操作者",
            undoPrev:        "上一条",
            undoNext:        "下一条",
            undoApply:       "应用此状态",
            undoCount:       "共",
            undoCountUnit:   "条记录",
            undoApplyDone:   "外观已回滚",
            undoApplySize:   "变更大小",

            freeNoItem:      "没有束缚物品",
            freeDone:        "解除束缚",
            selectAll:       "全选",
            craftNoItem:     "没有可编辑的束缚物品",
            craftClearNone:  "没有可清除的订制物品属性",
            craftClearTitle: "选择要清除订制属性的束缚",
            craftClearDone:  "清除了订制物品属性",
            craftEditTitle:  "编辑订制物品属性（批量套用到所选束缚）",
            craftName:       "物品名称",
            craftDesc:       "物品描述",
            craftPrivate:    "设为私有（仅自己可见名称）",
            craftEditDone:   "个束缚已套用订制属性",
            craftPickTitle:  "选择要编辑订制属性的束缚",
            unlockNone:      "没有可移除的锁",
            unlockTitle:     "选择要解除的锁",
            unlockDone:      "移除了所选的锁",
            lockNone:        "没有可锁定的束缚",
            lockDone:        "个束缚添加了",
            lockInvalid:     "无效的锁名称",
            lockAvailable:   "可用锁",
            lockSpecify:     "请指定目标（例如 /lt fulllock [目标] [锁名称]）",
            wardrobeDone:    "已开启衣柜",
            clipboardFail:   "无法读取剪贴板",
            bcxInvalid:      "无效的 BCX 代码",
            bcxDone:         "导入了 BCX 外观",
            rpOn:            "RP模式已开启",
            rpOff:           "RP模式已关闭",
            rpBtnShow:       "RP按钮已显示",
            rpBtnHide:       "RP按钮已隐藏",
            heightFixOn:     "拉高視角已啟用（消除互動畫面的垂直位移）",
            heightFixOff:    "拉高功能已停用",
            heightLockOn:    "固定顯示比例已啟用（人物與互動格使用顯示比例 1）",
            heightLockOff:   "固定顯示比例已停用",
            fhOn:            "无视绑缚已启用（被绑时仍可使用双手，不解开道具）",
            fhOff:           "无视绑缚已停用",
            dndOn:           "勿扰模式已启用（除自己外，任何人对你外观的编辑都会立即复原）",
            dndOff:          "勿扰模式已停用",
            dndReverted:     "{src} 对 {who} 修改了外观，但很快地复原了",
            magicDefenseOn:  "魔法防御已启用（LSCG 魔法无法对你生效）",
            magicDefenseOff: "魔法防御已停用",
            magicDeflected:  "{who}受到了魔法的攻击，但很快的就失去效力了",
            oocOn:           "说话总是OOC 已启用（聊天/密语自动加上括号转为 OOC）",
            oocOff:          "说话总是OOC 已停用",
            oocPlaceholder:  "现在讯息为 OOC",
            ibOn:            "无视衣物阻挡已启用（被服装/道具遮挡的格子仍可换装、装拘束）",
            ibOff:           "无视衣物阻挡已停用",
            sendFail:        "自定义动作发送失败，可能有插件冲突",
            cmdFail:         "执行失败",
            unknownCmd:      "未知指令",

            geTitle:      "选择增强功能",
            geItems:      "获得所有道具",
            geMoney:      "设置金钱为 999,999",
            geSkills:     "所有技能升至 10 级",
            geItemsDone:  "个新物品已添加",
            geMoneyDone:  "金钱已设置为 999,999",
            geSkillsDone: "所有技能已升至 10 级",

            freeTitle:    "选择要移除的束缚",
            password:     "密码",

            settingsTitle:    "设置",
            settingsTheme:    "主题模式",
            settingsDark:     "深色",
            settingsLight:    "浅色",
            settingsAccent:   "主题色",
            settingsReset:    "重置全部",
            settingsResetDone:"设置已重置",
            settingsOrderReset:"按钮顺序已重置",

            // 动作网格 label / title
            actFree:        "解除束缚",
            actFreeT:       "选择性移除束缚物品（可全选）",
            actUndo:        "回滚",
            actUndoT:       "回滚外观到之前的状态",
            actLock:        "上锁",
            actLockT:       "为束缚添加锁",
            actUnlock:      "解锁",
            actUnlockT:     "选择要解除的锁（跳过主人/恋人/拓展锁）",
            actEditCraft:   "编辑订制属性",
            actEditCraftT:  "批量编辑束缚的订制属性（名称/描述/私有）",
            actClearCraft:  "清除订制属性",
            actClearCraftT: "清除对象身上所有束缚的订制属性",
            actWardrobe:    "衣柜",
            actWardrobeT:   "打开衣柜",
            actBcx:         "BCX导入",
            actBcxT:        "从剪贴板导入 BCX 外观",
            actStruggle:    "挣扎",
            actStruggleT:   "LSCG 挣脱指令",
            actEnhance:     "增强",
            actEnhanceT:    "获取道具/金钱/技能",
            // 角色选择器提示
            pickFree:       "选择要解除束缚的目标",
            pickUndo:       "选择要回滚外观的目标",
            pickLock:       "选择要上锁的目标",
            pickUnlock:     "选择要解锁的目标",
            pickEditCraft:  "选择要编辑属性的目标",
            pickClearCraft: "选择要清除订制属性的目标",
            pickBcx:        "选择要导入外观的目标",
            // 上锁流程
            lockTypeTitle:  "选择锁类型",
            lockTypeFail:   "无法获取锁类型列表",
            lockTypeNone:   "没有可用的锁类型",
            lockPrefix:     "[锁]",
            // 其他 UI 讯息
            noPlayers:      "房间内没有玩家",
            noInputBox:     "找不到聊天输入框",
            execFail:       "执行命令失败",
            rpBtnTip:       "RP模式切换",
            stealthLabel:   "RP 隐身",
            stealthOn:      "开启（别人看不到图标）",
            stealthOff:     "关闭（别人能看到图标）",
            // 广播动作讯息
            actFreeMsg:     "{src} 解除了 {who} 的 {items}",
            actLockMsg:     "{src} 为 {who} 的 {count} 个束缚上了 {lock}！",
            actUndoMsg:     "{src} 将 {who} 的外观回滚到 {time} 的状态！",

            helpText:
            "莉柯莉丝工具 使用说明\n\n" +
            "/lt show              - 显示工具面板\n" +
            "/lt free [目标]       - 选择移除束缚（面板可全选）\n" +
            "/lt editcraft [目标]  - 批量编辑束缚的订制属性（名称/描述/私有）\n" +
            "/lt clearcraft [目标] - 清除束缚的所有订制属性\n" +
            "/lt bcximport [目标]  - 导入 BCX 外观\n" +
            "/lt fullunlock [目标] - 移除所有锁\n" +
            "/lt fulllock [目标] [锁名称] - 添加锁\n" +
            "/lt undo [目标]       - 外观回滚\n" +
            "/lt rpmode            - 切换 RP 模式\n" +
            "/lt rpbtn             - 显示/隐藏 RP 按钮\n" +
            "/lt heightfix         - 拉高互動視角（消除垂直位移）\n" +
            "/lt heightlock        - 固定人物與互動格顯示比例（不改人物資料）\n" +
            "/lt ooc               - 说话总是OOC（聊天/密语自动加括号转 OOC）\n" +
            "/lt dnd               - 勿扰模式（除自己外，他人对你外观的编辑立即复原）\n" +
            "/lt magicdefense      - 魔法防御（使 LSCG 魔法无法生效）\n" +
            "/lt freehands         - 无视绑缚（被绑时仍可使用双手，不解开道具）\n" +
            "/lt ignoreblock       - 无视衣物阻挡（被遮挡的格子仍可换装、装拘束）\n" +
            "/lt geteverything     - 增强功能\n" +
            "/lt wardrobe          - 开启衣柜",

            loaded: "莉柯莉丝工具 v{v} 载入！使用 /lt help 查看说明",
        },
        en: {
            scrollbar: "Vertical scrollbar",
            back: "Back",
            toolbox: "Toolbox",
            menuEdit: "Edit feature order and visibility",
            toggleSection: "Toggles",
            toggleRp: "RP Mode",
            toggleRpHelp: "Block game Action messages",
            toggleDnd: "Do Not Disturb",
            toggleDndHelp: "Anyone but you editing your appearance is instantly reverted",
            toggleMagic: "Magic Defense",
            toggleMagicHelp: "Prevent all LSCG magic cast on you from taking effect",
            toggleFree: "Free Hands",
            toggleFreeHelp: "Use hands while restrained (does not remove items)",
            toggleBlock: "Ignore Clothing Block",
            toggleBlockHelp: "Equip on slots covered by clothing/items (no need to strip first)",
            toggleRaise: "Raise view",
            toggleRaiseHelp: "Remove HeightModifier displacement in the dialog view only",
            toggleScale: "Fixed view scale",
            toggleScaleHelp: "Draw the character and zones at view scale 1 without changing character properties",
            toggleOoc: "Always OOC",
            toggleOocHelp: "Auto-wrap chat/whisper in parentheses as OOC",
            toggleRpButton: "Show RP Btn",
            toggleRpButtonHelp: "Show RP toggle button on canvas",
            viewCharacterHint: "Character view; click for list",
            viewListHint: "List view; click for character",
            craftItemChanged: "Item changed. Select it again.",
            craftSaved: "Saved. You can keep editing.",
            export: "Export",
            craftCopyFailed: "Copy failed. Please retry.",
            craftCopied: "Copied. Import in Crafting.",
            craftSingleTitle: "Edit item craft",
            craftBatch: "Batch edit",
            craftSingle: "Single edit",
            undoDiffPrefix: "Compared with current appearance: ",
            undoDiffHelp: "Added / removed / changed equipment groups",
            fixedScalePrefix: "Fixed view scale: ",
            menuVisibility: "Click to hide / show; hold to reorder",
            menuDragHint: "Hold to reorder",
            accentPurple: "Purple",
            accentBlue: "Blue",
            accentTeal: "Teal",
            accentPink: "Pink",
            accentOrange: "Orange",
            accentRed: "Red",
            close:        "Close",
            confirm:      "Confirm",
            cancel:       "Cancel",
            noPermission: "No permission to interact with",
            notInRoom:    "is not in the room",
            unknown:      "Unknown",
            notInChat:    "Not in chat room",

            undoTitle:       "Appearance Rollback",
            undoNoRecord:    "No appearance change records",
            undoChangedAt:   "Changed at",
            undoChangedBy:   "Changed by",
            undoPrev:        "Previous",
            undoNext:        "Next",
            undoApply:       "Apply this state",
            undoCount:       "",
            undoCountUnit:   "records",
            undoApplyDone:   "Appearance rolled back",
            undoApplySize:   "Change size",

            freeNoItem:      "has no restrained items",
            freeDone:        "removed restraints",
            selectAll:       "Select All",
            craftNoItem:     "has no editable restraint items",
            craftClearNone:  "has no craft properties to clear",
            craftClearTitle: "Select restraints to clear craft",
            craftClearDone:  "cleared craft from",
            craftEditTitle:  "Edit craft (batch-apply to selected restraints)",
            craftName:       "Item name",
            craftDesc:       "Item description",
            craftPrivate:    "Private (only you see the name)",
            craftEditDone:   "restraints updated with craft",
            craftPickTitle:  "Select restraints to edit craft",
            unlockNone:      "has no removable locks",
            unlockTitle:     "Select locks to remove",
            unlockDone:      "removed selected locks from",
            lockNone:        "has no lockable restraints",
            lockDone:        "restraints locked with",
            lockInvalid:     "Invalid lock name",
            lockAvailable:   "Available locks",
            lockSpecify:     "Please specify a target (e.g. /lt fulllock [target] [lock name])",
            wardrobeDone:    "Wardrobe opened",
            clipboardFail:   "Cannot read clipboard",
            bcxInvalid:      "Invalid BCX code",
            bcxDone:         "imported BCX appearance for",
            rpOn:            "RP Mode enabled",
            rpOff:           "RP Mode disabled",
            rpBtnShow:       "RP button shown",
            rpBtnHide:       "RP button hidden",
            heightFixOn:     "Raise view enabled (remove dialog vertical displacement)",
            heightFixOff:    "Raise view disabled",
            heightLockOn:    "Fixed view scale enabled (character and interaction grid use display scale 1)",
            heightLockOff:   "Fixed view scale disabled",
            fhOn:            "Free Hands enabled (use hands while restrained, keeps items on)",
            fhOff:           "Free Hands disabled",
            dndOn:           "Do Not Disturb enabled (anyone but you editing your appearance is instantly reverted)",
            dndOff:          "Do Not Disturb disabled",
            dndReverted:     "{src} changed {who}'s appearance, but it was quickly restored",
            magicDefenseOn:  "Magic Defense enabled (LSCG magic cannot affect you)",
            magicDefenseOff: "Magic Defense disabled",
            magicDeflected:  "{who} was struck by magic, but it quickly lost its effect",
            oocOn:           "Always OOC enabled (chat/whisper auto-wrapped in parentheses as OOC)",
            oocOff:          "Always OOC disabled",
            oocPlaceholder:  "Messages are OOC now",
            ibOn:            "Ignore Clothing Block enabled (equip on slots covered by clothing/items)",
            ibOff:           "Ignore Clothing Block disabled",
            sendFail:        "Custom action failed, possible plugin conflict",
            cmdFail:         "Command failed",
            unknownCmd:      "Unknown command",

            geTitle:      "Select enhancement",
            geItems:      "Get all items",
            geMoney:      "Set money to 999,999",
            geSkills:     "Max all skills to level 10",
            geItemsDone:  "new items added",
            geMoneyDone:  "Money set to 999,999",
            geSkillsDone: "All skills maxed to level 10",

            freeTitle:    "Select restraints to remove",
            password:     "Password",

            settingsTitle:    "Settings",
            settingsTheme:    "Theme",
            settingsDark:     "Dark",
            settingsLight:    "Light",
            settingsAccent:   "Accent Color",
            settingsReset:    "Reset All",
            settingsResetDone:"Settings reset",
            settingsOrderReset:"Button order reset",

            // Action grid label / title
            actFree:        "Unrestrain",
            actFreeT:       "Selectively remove restraints (Select All available)",
            actUndo:        "Rollback",
            actUndoT:       "Roll appearance back to a previous state",
            actLock:        "Lock",
            actLockT:       "Add a lock to restraints",
            actUnlock:      "Unlock",
            actUnlockT:     "Select locks to remove (skips owner/lover/extension locks)",
            actEditCraft:   "Edit Craft",
            actEditCraftT:  "Batch-edit restraint craft (name/description/private)",
            actClearCraft:  "Clear Craft",
            actClearCraftT: "Clear all craft properties on the target's restraints",
            actWardrobe:    "Wardrobe",
            actWardrobeT:   "Open the wardrobe",
            actBcx:         "BCX Import",
            actBcxT:        "Import a BCX appearance from the clipboard",
            actStruggle:    "Struggle",
            actStruggleT:   "LSCG escape command",
            actEnhance:     "Enhance",
            actEnhanceT:    "Get items / money / skills",
            // Character picker prompts
            pickFree:       "Select a target to unrestrain",
            pickUndo:       "Select a target to roll back",
            pickLock:       "Select a target to lock",
            pickUnlock:     "Select a target to unlock",
            pickEditCraft:  "Select a target to edit craft",
            pickClearCraft: "Select a target to clear craft",
            pickBcx:        "Select a target to import appearance",
            // Lock flow
            lockTypeTitle:  "Select a lock type",
            lockTypeFail:   "Cannot get lock type list",
            lockTypeNone:   "No lock types available",
            lockPrefix:     "[Lock]",
            // Other UI messages
            noPlayers:      "No players in the room",
            noInputBox:     "Chat input box not found",
            execFail:       "Failed to run command",
            rpBtnTip:       "Toggle RP mode",
            stealthLabel:   "RP Stealth",
            stealthOn:      "ON (others can't see the icon)",
            stealthOff:     "OFF (others can see the icon)",
            // Broadcast action messages
            actFreeMsg:     "{src} removed {items} from {who}",
            actLockMsg:     "{src} locked {count} restraint(s) on {who} with {lock}!",
            actUndoMsg:     "{src} rolled back {who}'s appearance to the {time} state!",

            helpText:
            "Liko Tool Help\n\n" +
            "/lt show              - Show the tool panel\n" +
            "/lt free [target]     - Select restraints to remove (panel has Select All)\n" +
            "/lt editcraft [target]- Batch-edit restraint craft (name/desc/private)\n" +
            "/lt clearcraft [target]-Clear all craft on restraints\n" +
            "/lt bcximport [target]- Import BCX appearance\n" +
            "/lt fullunlock [target]-Remove all locks\n" +
            "/lt fulllock [target] [lock] - Add lock\n" +
            "/lt undo [target]     - Rollback appearance\n" +
            "/lt rpmode            - Toggle RP mode\n" +
            "/lt rpbtn             - Show/hide RP button\n" +
            "/lt heightfix         - Raise dialog view (remove vertical offset)\n" +
            "/lt heightlock        - Fixed dialog view scale (does not change character data)\n" +
            "/lt ooc               - Always OOC (auto-wrap chat/whisper in parentheses)\n" +
            "/lt dnd               - Do Not Disturb (others' edits to your appearance auto-revert)\n" +
            "/lt magicdefense      - Block LSCG magic from taking effect\n" +
            "/lt freehands         - Free hands (use hands while restrained, keeps items on)\n" +
            "/lt ignoreblock       - Ignore clothing block (equip on covered slots)\n" +
            "/lt geteverything     - Enhancement menu\n" +
            "/lt wardrobe          - Open wardrobe",

            loaded: "Liko Tool v{v} loaded! Use /lt help for help",
        }
    };

    function t(key, vars = {}) {
        const lang = isZh() ? LANG.zh : LANG.en;
        let str = lang[key] || key;
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace("{" + k + "}", v);
        }
        return str;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 04 設定：預設值、舊資料遷移、保存與廣播
    // ════════════════════════════════════════════════════════════════════════
    const STORAGE_TOOL_PANEL = 'likoTool_ui_panel';

    const STORAGE_TOOL_THEME = 'likoTool_theme';

    const STORAGE_TOOL_ORDER = 'likoTool_btn_order';

    const STORAGE_TOOL_LAYOUT = 'likoTool_ui_layout';

    // ──────────────────────────────────────────
    // ExtensionSettings 存取器
    // ──────────────────────────────────────────
    let _esRaw, _esObj = null, _esMember;

    const ES_DEFAULTS = { heightFix: 0, heightLock: 0, rpBtnVisible: 0, stealthRp: 0,
                         rpModeLocal: 0, freeHands: 0, ignoreBlock: 0, dnd: 0, magicDefense: 0, alwaysOOC: 0, bypassActivities: false, itemViewMode: 'list' };

    function getES() {
        if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
        const raw = Player.ExtensionSettings.LikoTOOL;
        if (_esObj && raw === _esRaw && _esMember === Player.MemberNumber) return _esObj;
        let saved = {};
        try {
            if (typeof raw === 'string') saved = JSON.parse(LZString.decompressFromBase64(raw)) || {};
            else if (raw && typeof raw === 'object' && !Array.isArray(raw)) saved = raw;   // 相容舊格式
        } catch (e) { /* 資料損毀就用預設值 */ }
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
        _esObj = Object.assign({}, ES_DEFAULTS, saved);
        if (saved.fixedZones === undefined) _esObj.fixedZones = saved.heightLock === 1 ? 1 : 0;
        // One-time migration: account settings always take precedence over browser data.
        const legacy = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
        if (saved.uiSettingsMigrated !== true) {
            _esObj.theme ??= legacy(STORAGE_TOOL_THEME);
            _esObj.buttonOrder ??= legacy(STORAGE_TOOL_ORDER);
            _esObj.menuLayout ??= legacy(STORAGE_TOOL_LAYOUT);
            _esObj.panelPosition ??= legacy(STORAGE_TOOL_PANEL);
            _esObj.uiSettingsMigrated = true;
        }
        if (!_esObj.theme?.mode || !_esObj.theme?.accentId) _esObj.theme = { mode: 'dark', accentId: 'purple' };
        if (!Array.isArray(_esObj.buttonOrder)) _esObj.buttonOrder = [];
        const layout = _esObj.menuLayout;
        _esObj.menuLayout = { hidden: Array.isArray(layout?.hidden) ? layout.hidden : [], toggles: Array.isArray(layout?.toggles) ? layout.toggles : [] };
        if (!Number.isFinite(_esObj.panelPosition?.x) || !Number.isFinite(_esObj.panelPosition?.y)) _esObj.panelPosition = { x: TOOL_BTN_X, y: TOOL_BTN_Y + 55 };
        _esObj.itemViewMode = _esObj.itemViewMode === 'character' ? 'character' : 'list';
        if (saved.rpMode === undefined) _esObj.rpMode = Player.OnlineSharedSettings?.LikoTOOL?.RPmode === 1 ? 1 : 0;
        if (saved.bypassActivities === undefined) _esObj.bypassActivities = !!Player.LikoTool?.bypassActivities;
        Player.ExtensionSettings.LikoTOOL = _esObj;
        _esRaw = _esObj;
        _esMember = Player.MemberNumber;
        return _esObj;
    }

    function saveES() {
        if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
        _esRaw = getES();
        Player.ExtensionSettings.LikoTOOL = _esRaw;
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync("LikoTOOL");
        }
    }

    function toggleSetting(key, { on, off, shared, update, apply, message } = {}) {
        const settings = getES();
        const enabled = settings[key] !== 1;
        settings[key] = enabled ? 1 : 0;
        update?.(settings, enabled);
        saveES();
        apply?.(enabled);
        if (shared) broadcastShared(shared, enabled);
        if (message || on) ChatRoomSendLocal(message ? message(enabled) : t(enabled ? on : off), TOGGLE_MSG_MS);
        updateTogglesOwner?.();
        return true;
    }

    // ──────────────────────────────────────────
    // 初始化储存
    // ──────────────────────────────────────────
    function initializeStorage() {
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) {
            Player.OnlineSharedSettings.LikoTOOL = { RPmode: 0 };
        }
        const oss = Player.OnlineSharedSettings.LikoTOOL;
        if (typeof oss.RPmode    === 'undefined') oss.RPmode    = 0;
        if (typeof oss.DND       === 'undefined') oss.DND       = 0; // 广播：勿扰徽章
        if (typeof oss.FreeHands === 'undefined') oss.FreeHands = 0; // 广播：无视绑缚徽章
        if (typeof oss.MagicDefense === 'undefined') oss.MagicDefense = 0; // 广播：魔法防御徽章
        getES();
        currentTheme = loadTheme();
        toolPanelPos = loadToolPanelPos();
        saveES();
        oss.RPmode = getES().rpMode === 1 ? 1 : 0;
        // 把本地持久化的开关镜像到广播设定，让重登后徽章状态一致
        oss.DND       = getES().dnd === 1 ? 1 : 0;
        oss.FreeHands = getES().freeHands === 1 ? 1 : 0;
        oss.MagicDefense = getES().magicDefense === 1 ? 1 : 0;
    }

    // ──────────────────────────────────────────
    // 勿扰 / 无视绑缚 的广播状态（供徽章读取；本地开关仍存 ExtensionSettings）
    // ──────────────────────────────────────────
    function _readShared(character, key, localFn) {
        if (!character) return false;
        if (character.IsPlayer && character.IsPlayer()) return localFn();
        return character.OnlineSharedSettings?.LikoTOOL?.[key] === 1;
    }

    function getDndMode(character)  { return _readShared(character, 'DND',       () => getES().dnd === 1); }

    function getFreeHandsShared(character) { return _readShared(character, 'FreeHands', () => getES().freeHands === 1); }

    function getMagicDefenseShared(character) { return _readShared(character, 'MagicDefense', () => getES().magicDefense === 1); }

    // 把某个本地开关镜像到 OnlineSharedSettings 并广播（让别人看得到徽章）
    function broadcastShared(key, enabled) {
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
        Player.OnlineSharedSettings.LikoTOOL[key] = enabled ? 1 : 0;
        if (typeof globalThis.ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 05 共用遊戲操作：角色、權限與訊息
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // 工具函数
    // ──────────────────────────────────────────
    function ChatRoomSendLocal(message, sec = 0) {
        if (CurrentScreen !== "ChatRoom") { console.warn("🐈‍⬛ [LT] ❗ " + t('notInChat')); return; }
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: '<font color="#FF69B4">[LT] ' + message + '</font>',
                Timeout: sec
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 发送本地讯息错误:", e.message);
        }
    }

    function getPlayer(identifier) {
        if (!identifier || identifier.trim() === "") return Player;
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            return ChatRoomCharacter?.find(c => c.MemberNumber === parseInt(identifier)) || Player;
        }
        return ChatRoomCharacter?.find(c =>
                                       c.Name.toLowerCase()        === identifier.toLowerCase() ||
                                       c.Nickname?.toLowerCase()   === identifier.toLowerCase() ||
                                       c.AccountName.toLowerCase() === identifier.toLowerCase()
                                      ) || Player;
    }

    function getNickname(character) {
        return character?.Nickname || character?.Name || character?.AccountName || t('unknown');
    }

    function resolveToolTarget(target) {
        if (target?.MemberNumber === Player.MemberNumber) return Player;
        return window.ChatRoomCharacter?.find(C => C.MemberNumber === target?.MemberNumber) || null;
    }

    function chatSendCustomAction(message) {
        if (CurrentScreen !== "ChatRoom") return;
        try {
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: message }]
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 自訂动作发送错误:", e.message);
            ChatRoomSendLocal(t('sendFail'));
        }
    }

    function hasBCItemPermission(target) {
        if (getES().bypassActivities) return true;
        return typeof ServerChatRoomGetAllowItem === "function"
            ? ServerChatRoomGetAllowItem(Player, target)
        : true;
    }

    /* ── 执行聊天命令辅助函数 ── */
    function execChatCommand(cmd) {
        try {
            if (typeof ElementValue === 'function' && typeof ChatRoomSendChat === 'function') {
                ElementValue('InputChat', cmd);
                ChatRoomSendChat();
                return;
            }
            const input = document.getElementById('InputChat');
            if (!input) { ChatRoomSendLocal(t('noInputBox')); return; }
            input.value = cmd;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const sendBtn = document.getElementById('ChatSend');
            if (sendBtn) { sendBtn.click(); return; }
            input.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true, cancelable:true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', keyCode:13, bubbles:true, cancelable:true }));
        } catch(e) { ChatRoomSendLocal(t('execFail') + ': ' + e.message); }
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 06 視覺樣式：主題與集中 CSS
    // ════════════════════════════════════════════════════════════════════════
    // Player is not available until login; hydrate in initializeStorage.
    let currentTheme = { mode: 'dark', accentId: 'purple' };

    // ════════════════════════════════════════════════════════════════════════
    // 主题系统
    // ════════════════════════════════════════════════════════════════════════
    function loadTheme() { return { ...getES().theme }; }

    function saveTheme(theme) { getES().theme = { ...theme }; saveES(); }

    function getAccentPreset() {
        return ACCENT_PRESETS.find(function(p) { return p.id === currentTheme.accentId; }) || ACCENT_PRESETS[0];
    }

    function applyTheme() {
        var preset = getAccentPreset();
        var isDark = currentTheme.mode !== 'light';
        var a = preset.accent;
        var ad = preset.accentDark;
        var al = preset.accentLight;

        var styleEl = document.getElementById('lt-theme-vars');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'lt-theme-vars';
            document.head.appendChild(styleEl);
        }

        if (isDark) {
            styleEl.textContent = [
                '#lt-quick-panel{',
                '--lt-bg:rgba(12,16,26,0.98);',
                '--lt-surface:rgba(255,255,255,0.04);',
                '--lt-surface-2:rgba(255,255,255,0.07);',
                '--lt-surface-hover:' + a + '1a;',
                '--lt-border:rgba(255,255,255,0.07);',
                '--lt-border-hover:' + a + '4d;',
                '--lt-text:#dde8f8;',
                '--lt-text-secondary:#b8c8e0;',
                '--lt-text-dim:#6a8ab0;',
                '--lt-text-faint:#4a5a7a;',
                '--lt-accent:' + a + ';',
                '--lt-accent-dark:' + ad + ';',
                '--lt-accent-light:' + al + ';',
                '--lt-accent-glow:' + a + '40;',
                '--lt-header-grad:linear-gradient(135deg,' + ad + ' 0%,' + a + ' 100%);',
                '--lt-shadow:rgba(0,0,0,0.5);',
                '--lt-scrollbar:' + a + '59;',
                '--lt-switch-on:' + a + ';',
                '--lt-switch-glow:' + a + '80;',
                '}'
            ].join('');
        } else {
            styleEl.textContent = [
                '#lt-quick-panel{',
                '--lt-bg:rgba(248,250,252,0.98);',
                '--lt-surface:rgba(0,0,0,0.025);',
                '--lt-surface-2:rgba(0,0,0,0.05);',
                '--lt-surface-hover:' + a + '14;',
                '--lt-border:rgba(0,0,0,0.07);',
                '--lt-border-hover:' + a + '40;',
                '--lt-text:#2a3a4a;',
                '--lt-text-secondary:#4a5a6a;',
                '--lt-text-dim:#7a8a9a;',
                '--lt-text-faint:#aab4c0;',
                '--lt-accent:' + a + ';',
                '--lt-accent-dark:' + ad + ';',
                '--lt-accent-light:' + al + ';',
                '--lt-accent-glow:' + a + '33;',
                '--lt-header-grad:linear-gradient(135deg,' + ad + ' 0%,' + a + ' 100%);',
                '--lt-shadow:rgba(0,0,0,0.15);',
                '--lt-scrollbar:' + a + '40;',
                '--lt-switch-on:' + a + ';',
                '--lt-switch-glow:' + a + '80;',
                '}'
            ].join('');
        }

        document.querySelectorAll('#lt-quick-panel').forEach(function(el) {
            if (currentTheme.mode === 'light') el.classList.add('lt-light');
            else el.classList.remove('lt-light');
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // UI 樣式注入 — v2.1 CSS 变量 + 双主题
    // ════════════════════════════════════════════════════════════════════════
    function injectLtStyles() {
        if (document.getElementById("lt-styles")) return;
        const s = document.createElement("style");
        s.id = "lt-styles";
        s.textContent = [
            "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&display=swap');",

            // ── Global reset ──
            "#lt-quick-panel,#lt-quick-panel *{box-sizing:border-box;font-family:'Noto Sans TC',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;user-select:none;-webkit-user-select:none;}",

            "@keyframes lt-shimmer{0%{transform:translateX(0)}100%{transform:translateX(600%)}}",
            // ── Modal Content ──
            ".lt-content{min-height:0;min-width:0;overscroll-behavior:contain;padding:16px 10px 8px;overflow-y:auto;overflow-x:hidden;flex:1;}",

            // ── Button List (modal) ──
            ".lt-btn-list{display:flex;flex-direction:column;gap:6px;}",
            ".lt-list-btn{width:100%;padding:11px 14px;text-align:left;background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.04)),rgba(255,255,255,0.01));border:1px solid var(--lt-border,rgba(255,255,255,0.06));border-radius:10px;color:var(--lt-text-secondary,#b8c8e0);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            ".lt-list-btn:hover{background:linear-gradient(180deg,var(--lt-surface-hover),var(--lt-surface,rgba(255,255,255,0.02)));border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 2px 8px var(--lt-accent-glow);}",
            ".lt-list-btn:active{transform:scale(0.985);}",
            ".lt-list-btn.selected{background:var(--lt-surface-hover);border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 0 0 1px var(--lt-border-hover);}",
            ".lt-list-btn .lt-check{font-size:14px;color:var(--lt-accent);opacity:0.2;transition:opacity 0.18s;}",
            ".lt-list-btn.selected .lt-check{opacity:1;}",

            // ── Undo Meta ──
            ".lt-undo-meta{margin-bottom:8px;background:var(--lt-surface,rgba(255,255,255,0.03));border:1px solid var(--lt-border,rgba(255,255,255,0.05));border-radius:10px;padding:11px 13px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02);}",
            ".lt-undo-meta-row{font-size:11px;color:var(--lt-text-dim,#6a8ab0);margin-bottom:4px;}",
            ".lt-undo-meta-row:last-child{margin-bottom:0;}",
            ".lt-undo-meta-row span{color:var(--lt-accent-light,#a0c0e8);font-weight:500;}",

            // ── Nav Buttons ──
            ".lt-nav-btn{flex:1;padding:9px 4px;background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.04)),rgba(255,255,255,0.01));border:1px solid var(--lt-border,rgba(255,255,255,0.06));border-radius:9px;color:var(--lt-text-dim,#6a6a9a);font-size:11px;cursor:pointer;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            ".lt-nav-btn svg{width:12px;height:12px;}",
            ".lt-nav-btn:hover:not(:disabled){background:var(--lt-surface-hover);border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 2px 6px var(--lt-accent-glow);}",
            ".lt-nav-btn:disabled{opacity:0.25;cursor:not-allowed;}",

            // Native scrolling, with one DOM scrollbar renderer for every scroll host.
            "#lt-quick-panel *{scrollbar-width:none!important;}",
            "#lt-quick-panel ::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}",
            "#lt-quick-panel textarea{overflow-x:hidden;padding-right:14px;}",
            "#lt-quick-panel .lt-scroll-layer{position:absolute;inset:0;z-index:10000;pointer-events:none;overflow:hidden;}",
            "#lt-quick-panel .lt-scroll-track{position:absolute;width:8px;border-radius:4px;background:var(--lt-surface-2);pointer-events:auto;touch-action:none;}",
            "#lt-quick-panel .lt-scroll-thumb{position:absolute;top:0;left:1px;width:6px;border-radius:4px;background:var(--lt-scrollbar);cursor:grab;touch-action:none;}",
            "#lt-quick-panel .lt-scroll-track:hover .lt-scroll-thumb,#lt-quick-panel .lt-scroll-track:focus-visible .lt-scroll-thumb{background:var(--lt-accent);}",
            "#lt-quick-panel .lt-scroll-track:focus-visible{outline:1px solid var(--lt-accent-light);outline-offset:1px;}",
            "#lt-quick-panel .lt-scroll-thumb:active{cursor:grabbing;}",

            // ── Shared form / selection / navigation components ──
            ".lt-button-row{display:flex;flex:1;gap:8px;width:100%;min-width:0;}",
            ".lt-option-label{font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}",
            ".lt-self-option{border-color:var(--lt-accent);background:var(--lt-surface-hover);}",
            ".lt-craft-fields>.lt-settings-label{display:block;}",
            ".lt-craft-fields input[type=text],.lt-craft-fields textarea{box-sizing:border-box;width:100%;margin:5px 0 12px;padding:8px;background:var(--lt-surface);color:var(--lt-text);border:1px solid var(--lt-border);border-radius:8px;font-family:inherit;font-size:13px;font-weight:400;user-select:text;-webkit-user-select:text;}",
            ".lt-craft-fields textarea{resize:vertical;}",
            ".lt-checkbox-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--lt-text);}",
            ".lt-undo-nav{display:flex;align-items:center;gap:6px;margin-bottom:10px;}",
            ".lt-undo-counter{flex:1;text-align:center;font-size:12px;color:var(--lt-accent);font-weight:600;white-space:nowrap;}",
            "#lt-quick-panel .lt-single-craft-page>.lt-content{overflow:hidden;}",

            // ── Footer ──
            ".lt-footer{flex-grow:0;display:flex;gap:8px;padding:12px 18px;background:rgba(0,0,0,0.15);flex-shrink:0;border-top:1px solid var(--lt-border,rgba(255,255,255,0.04));box-shadow:inset 0 1px 0 rgba(0,0,0,0.1);}",
            ".lt-btn{flex:1;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;}",
            ".lt-btn-primary{background:var(--lt-header-grad);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.15),0 2px 8px rgba(0,0,0,0.2);}",
            ".lt-btn-primary:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 4px 16px var(--lt-accent-glow),0 2px 8px rgba(0,0,0,0.2);filter:brightness(1.08);}",
            ".lt-btn-primary:active{transform:scale(0.97);}",
            ".lt-btn-secondary{background:linear-gradient(180deg,var(--lt-surface-2,rgba(255,255,255,0.06)),rgba(255,255,255,0.02));color:var(--lt-text-dim,#5a7a9a);border:1px solid var(--lt-border,rgba(255,255,255,0.06));box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);}",
            ".lt-btn-secondary:hover{background:var(--lt-surface-hover);color:var(--lt-text-secondary);border-color:var(--lt-border-hover);}",
            ".lt-btn-secondary:active{transform:scale(0.97);}",
            ".lt-empty{text-align:center;color:var(--lt-text-dim,#4a6a8a);font-size:13px;padding:20px 0;}",

            // ═══ 快捷面板 Quick Panel ═══════════════════════════════════════════
            "#lt-quick-panel{position:fixed;z-index:99998;width:340px;max-width:calc(100vw - 8px);height:min(88vh,680px);display:flex;flex-direction:column;border-radius:26px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.15),0 12px 32px rgba(0,0,0,0.4),0 28px 72px var(--lt-shadow,rgba(0,0,0,0.5)),inset 0 1px 0 rgba(255,255,255,0.08),0 0 0 1px var(--lt-accent-glow,transparent);background:var(--lt-bg,rgba(14,18,30,0.98));backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);border:1px solid var(--lt-border,rgba(255,255,255,0.08));opacity:0;transform:scale(0.96) translateY(8px);pointer-events:none;transition:width .28s ease,opacity 0.22s ease,transform 0.22s cubic-bezier(0.16,1,0.3,1);}",
            "#lt-quick-panel.show{opacity:1;transform:scale(1) translateY(0);pointer-events:auto;}",
            "#lt-quick-panel.lt-light{backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);}",
            "#lt-quick-panel [hidden]{display:none!important;}",
            "#lt-quick-panel .ltp-covered{visibility:hidden;opacity:0;pointer-events:none;}",
            "#lt-quick-panel .ltq-toggles{display:flex;flex-direction:column;gap:3px;}",
            "#lt-quick-panel .ltq-delete{display:none;background:transparent;color:inherit;border:0;padding:2px;cursor:pointer;width:24px;height:24px;flex-shrink:0;}",
            "#lt-quick-panel .ltq-delete svg{width:18px;height:18px;fill:none;}",
            "#lt-quick-panel .ltq-delete[aria-pressed=true]{color:var(--lt-accent-light);filter:drop-shadow(0 0 3px var(--lt-accent));}",
            "#lt-quick-panel .ltq-delete[aria-pressed=true] svg{fill:currentColor;}",
            "#lt-quick-panel.ltq-editing .ltq-delete{display:block;}",
            "#lt-quick-panel .ltq-action .ltq-delete{position:absolute;right:0;top:0;}",
            "#lt-quick-panel.ltq-editing .ltq-switch{display:none;}",
            "#lt-quick-panel.ltq-editing [data-menu-id]{touch-action:none;cursor:grab;}",
            "#lt-quick-panel .ltq-hidden-feature{filter:grayscale(1);opacity:.4;}",
            "#lt-quick-panel .ltq-dragging{opacity:.45;}",
            "#lt-quick-panel .lt-undo-content{display:flex;flex-direction:column;height:100%;min-height:0;}",
            "#lt-quick-panel .lt-undo-preview{width:100%;display:flex;justify-content:center;align-items:center;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:12px;overflow:hidden;margin-bottom:10px;position:relative;flex:1;min-height:120px;}",
            "#lt-quick-panel .lt-lock-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}",
            "#lt-quick-panel .lt-lock-grid .lt-list-btn{flex-direction:column;text-align:center;justify-content:flex-start;padding:8px 3px;font-size:11px;overflow-wrap:anywhere;}",
            "#lt-quick-panel .lt-lock-grid img{width:64px;height:64px;object-fit:contain;max-width:100%;}",
            "#lt-quick-panel.ltp-wide{width:min(700px,calc(100vw - 8px));}",
            "#lt-quick-panel .lt-craft-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,0fr);height:100%;min-height:0;gap:0;transition:grid-template-columns .28s ease,gap .28s ease;}",
            "#lt-quick-panel .lt-craft-layout:has(.is-open){grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;}",
            "#lt-quick-panel .lt-craft-side:not(.is-open){visibility:hidden;opacity:0;transform:translateX(16px);padding-left:0;border-left-width:0;overflow:hidden;pointer-events:none;}",
            "@media(prefers-reduced-motion:reduce){#lt-quick-panel,#lt-quick-panel .lt-craft-layout,#lt-quick-panel .lt-craft-side{transition:none!important;}}",
            "#lt-quick-panel .lt-has-side .lt-craft-items{padding-right:12px;}",
            "#lt-quick-panel .lt-craft-items{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;}",
            "#lt-quick-panel .lt-craft-side{opacity:1;transform:translateX(0);transition:opacity .28s ease,transform .28s ease,visibility .28s,padding .28s;display:flex;flex:1;min-width:0;flex-direction:column;border-left:1px solid var(--lt-border);padding-left:12px;overflow-y:auto;overflow-x:hidden;color:var(--lt-text);font-size:12px;}",
            "#lt-quick-panel .lt-craft-side .lt-settings{gap:10px;}",
            "#lt-quick-panel .lt-craft-side [role=status]{margin:12px 0;color:var(--lt-accent-light);}",
            "#lt-quick-panel .lt-craft-side .lt-footer{padding:12px 0;margin-top:auto;}",
            "#lt-quick-panel .lt-btn-cancel{order:100;}",
            "#lt-quick-panel .lt-single-craft-page.lt-has-side > .lt-footer{display:none;}",
            "#lt-quick-panel canvas{position:static;inset:auto;margin:0;padding:0;transform:none;max-width:none;max-height:none;}",
            "#lt-quick-panel .lt-picker-map-content{overflow:hidden;display:flex;flex-direction:column;}",
            "#lt-quick-panel .lt-item-picker.is-map{height:100%;min-height:0;flex:1;display:flex;align-items:center;justify-content:center;overflow:clip;}",
            "#lt-quick-panel .lt-item-map{position:relative;flex:none;overflow:visible;}",
            "#lt-quick-panel .lt-item-map canvas{width:100%;height:100%;display:block;}",
            "#lt-quick-panel .lt-undo-preview canvas{display:block;width:auto;height:100%;max-width:100%;object-fit:contain;}",
            "#lt-quick-panel .lt-item-picker .lt-list-btn.selected{background:var(--lt-accent);color:#fff;border-color:var(--lt-accent-light);}",
            "#lt-quick-panel .lt-zone-button{box-sizing:border-box;position:absolute;border:1px solid #9a9a9a;background:rgba(100,100,100,.10);padding:0;cursor:pointer;}",
            "#lt-quick-panel .lt-zone-button.occupied{border-color:#e6b858;background:rgba(230,184,88,.18);}",
            "#lt-quick-panel .lt-zone-button.selected{border:2px solid #42dfff;background:rgba(66,223,255,.3);}",
            "#lt-quick-panel .lt-zone-button:disabled{pointer-events:none;}",
            "@media(max-width:520px){#lt-quick-panel .lt-craft-layout{gap:6px;}#lt-quick-panel .lt-craft-side{padding-left:6px;}#lt-quick-panel .lt-craft-side .lt-footer{flex-wrap:wrap;}}",
            // ── Phone 导航：视口 + 滑动页面 ──
            "#lt-quick-panel .ltp-viewport{position:relative;flex:1;overflow:clip;min-height:0;}",
            "#lt-quick-panel .ltp-page{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--lt-bg,rgba(14,18,30,0.98));transition:transform 0.28s cubic-bezier(0.16,1,0.3,1);will-change:transform;}",
            "#lt-quick-panel .ltp-page.ltp-enter,#lt-quick-panel .ltp-page.ltp-leave{transform:translateX(100%);}",
            "#lt-quick-panel .ltp-page.ltp-leave{pointer-events:none;}",
            "#lt-quick-panel .ltp-page.ltp-underlay{visibility:visible;opacity:1;}",

            // ── Quick Panel Header ──
            "#lt-quick-panel .ltq-hdr{touch-action:none;background:var(--lt-header-grad);color:#fff;font-size:13px;font-weight:600;padding:8px 12px;cursor:move;display:flex;align-items:center;justify-content:space-between;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.15);}",
            "#lt-quick-panel .ltq-hdr::before{content:'';position:absolute;top:0;left:-100%;width:40%;height:100%;background:linear-gradient(to right,transparent,rgba(255,255,255,0.1),transparent);animation:lt-shimmer 6s ease-in-out infinite;pointer-events:none;}",
            "#lt-quick-panel .ltq-hdr .ltq-title{pointer-events:none;position:relative;z-index:1;font-size:13px;letter-spacing:0.03em;text-shadow:0 1px 2px rgba(0,0,0,0.2);}",
            "#lt-quick-panel .ltq-hdr .ltq-hdr-btns{display:flex;align-items:center;gap:2px;position:relative;z-index:1;}",
            "#lt-quick-panel .ltq-hdr .ltq-icon-btn{cursor:pointer;opacity:0.55;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);background:none;border:none;color:#fff;padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;}",
            "#lt-quick-panel .ltq-hdr .ltq-icon-btn:hover{opacity:1;background:rgba(255,255,255,0.14);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);}",
            "#lt-quick-panel .ltq-hdr .ltq-icon-btn:active{transform:scale(0.9);}",
            "#lt-quick-panel .ltq-hdr .ltq-icon-btn svg{width:16px;height:16px;}",
            // ── 返回按钮（仅子页面显示）──
            "#lt-quick-panel .ltq-hdr .ltq-back{cursor:pointer;background:none;border:none;color:#fff;padding:4px 6px;border-radius:6px;display:none;align-items:center;justify-content:center;opacity:0.85;position:relative;z-index:1;margin-right:2px;}",
            "#lt-quick-panel .ltq-hdr .ltq-back:hover{opacity:1;background:rgba(255,255,255,0.14);}",
            "#lt-quick-panel .ltq-hdr .ltq-back:active{transform:scale(0.9);}",
            "#lt-quick-panel .ltq-hdr .ltq-back svg{width:18px;height:18px;}",
            "#lt-quick-panel.ltp-sub .ltq-hdr .ltq-back{display:flex;}",

            // ── Quick Panel Body ──
            "#lt-quick-panel .ltq-body{padding:10px;display:flex;flex-direction:column;gap:3px;flex:1;min-height:0;overflow-y:auto;}",

            // ── Action Grid (2-column, draggable) ──
            "#lt-quick-panel .ltq-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;}",
            "#lt-quick-panel .ltq-action{background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.04)),rgba(255,255,255,0.01));color:var(--lt-text-secondary,#b8c8e0);border:1px solid var(--lt-border,rgba(255,255,255,0.06));border-radius:8px;padding:7px 4px 6px;font-size:10.5px;cursor:pointer;text-align:center;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);display:flex;flex-direction:column;align-items:center;gap:4px;font-family:inherit;font-weight:500;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            "#lt-quick-panel .ltq-action::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:var(--lt-accent);opacity:0.2;transition:opacity 0.18s;}",
            "#lt-quick-panel .ltq-action:hover{background:linear-gradient(180deg,var(--lt-surface-hover),var(--lt-surface,rgba(255,255,255,0.02)));border-color:var(--lt-border-hover);color:var(--lt-accent-light);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,0.06),0 4px 12px var(--lt-accent-glow);}",
            "#lt-quick-panel .ltq-action:hover::before{opacity:0.6;}",
            "#lt-quick-panel .ltq-action:active{transform:scale(0.94);}",
            "#lt-quick-panel .ltq-action .ltq-action-icon{width:18px;height:18px;color:var(--lt-accent);opacity:0.75;transition:all 0.18s;}",
            "#lt-quick-panel .ltq-action .ltq-action-icon svg{width:100%;height:100%;}",
            "#lt-quick-panel .ltq-action:hover .ltq-action-icon{opacity:1;transform:scale(1.08);}",
            "#lt-quick-panel .ltq-action .ltq-label{font-size:10.5px;line-height:1.15;}",

            // ── Drag-over state ──
            "#lt-quick-panel .ltq-action.ltq-dragging{opacity:0.25;}",

            // ── Section Label ──
            "#lt-quick-panel .ltq-section{font-size:10px;font-weight:600;color:var(--lt-text-faint,#5a4a7a);text-transform:uppercase;letter-spacing:0.12em;display:flex;align-items:center;gap:8px;margin:6px 2px 3px;}",
            "#lt-quick-panel .ltq-section::after{content:'';flex:1;height:1px;background:linear-gradient(to right,var(--lt-border,rgba(255,255,255,0.06)),transparent);}",

            // ── Toggle Row ──
            "#lt-quick-panel .ltq-toggle{display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.03)),rgba(255,255,255,0.01));border:1px solid var(--lt-border,rgba(255,255,255,0.05));border-radius:8px;font-size:11.5px;color:var(--lt-text-secondary,#a0b0c8);cursor:pointer;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02);}",
            "#lt-quick-panel .ltq-toggle:hover{background:linear-gradient(180deg,var(--lt-surface-hover),var(--lt-surface,rgba(255,255,255,0.02)));border-color:var(--lt-border-hover);color:var(--lt-accent-light);}",
            "#lt-quick-panel .ltq-toggle:active{transform:scale(0.98);}",
            "#lt-quick-panel .ltq-toggle.on{border-color:var(--lt-border-hover);color:var(--lt-accent-light);background:linear-gradient(180deg,var(--lt-surface-hover),var(--lt-surface,rgba(255,255,255,0.01)));box-shadow:inset 0 1px 0 rgba(255,255,255,0.04),inset 2px 0 0 var(--lt-accent);}",
            "#lt-quick-panel .ltq-toggle-label{display:flex;align-items:center;gap:8px;}",
            "#lt-quick-panel .ltq-toggle-icon{width:16px;height:16px;color:var(--lt-accent);opacity:0.65;transition:opacity 0.18s;}",
            "#lt-quick-panel .ltq-toggle-icon svg{width:100%;height:100%;}",
            "#lt-quick-panel .ltq-toggle.on .ltq-toggle-icon{opacity:1;}",

            // ── Toggle Switch (iOS-style) ──
            "#lt-quick-panel .ltq-switch{width:36px;height:20px;border-radius:10px;background:var(--lt-surface-2,rgba(255,255,255,0.08));position:relative;transition:background 0.25s ease;flex-shrink:0;box-shadow:inset 0 1px 2px rgba(0,0,0,0.25);}",
            "#lt-quick-panel .ltq-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:linear-gradient(180deg,#888894,#60606c);transition:all 0.28s cubic-bezier(0.16,1,0.3,1);box-shadow:0 1px 3px rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.15);}",
            "#lt-quick-panel .ltq-switch.on{background:var(--lt-switch-on,#8b2dc4);box-shadow:inset 0 1px 2px rgba(0,0,0,0.2),0 0 8px var(--lt-switch-glow);}",
            "#lt-quick-panel .ltq-switch.on::after{left:18px;background:linear-gradient(180deg,#fff,#e8e8f0);box-shadow:0 1px 3px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.3),0 0 8px var(--lt-switch-glow);}",

            // ═══ 设置面板样式 ═══════════════════════════════════════════════════
            ".lt-settings{display:flex;flex-direction:column;gap:20px;padding:4px 0;}",
            ".lt-settings-label{font-size:10px;font-weight:600;color:var(--lt-text-dim,#6a8ab0);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;}",
            ".lt-theme-row{display:flex;gap:10px;}",
            ".lt-theme-option{flex:1;padding:16px 8px;border-radius:12px;border:2px solid var(--lt-border,rgba(255,255,255,0.08));background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.03)),rgba(255,255,255,0.01));cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;color:var(--lt-text-secondary,#b8c8e0);font-size:12px;font-weight:500;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            ".lt-theme-option:hover{border-color:var(--lt-border-hover);background:var(--lt-surface-hover);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 2px 8px var(--lt-accent-glow);}",
            ".lt-theme-option.selected{border-color:var(--lt-accent);background:var(--lt-surface-hover);color:var(--lt-accent-light);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 0 0 1px var(--lt-accent-glow),0 2px 12px var(--lt-accent-glow);}",
            ".lt-theme-option svg{width:22px;height:22px;}",
            ".lt-theme-preview{width:100%;height:32px;border-radius:6px;margin-top:3px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.15);}",
            ".lt-theme-preview.dark{background:linear-gradient(135deg,#0e121e 0%,#2a2040 100%);border:1px solid rgba(255,255,255,0.1);}",
            ".lt-theme-preview.light{background:linear-gradient(135deg,#f8fafc 0%,#e8ecf0 100%);border:1px solid rgba(0,0,0,0.08);}",
            ".lt-accent-row{display:flex;gap:12px;flex-wrap:wrap;}",
            ".lt-accent-swatch{width:34px;height:34px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);position:relative;box-shadow:0 2px 6px rgba(0,0,0,0.2),inset 0 1px 0 rgba(255,255,255,0.15);}",
            ".lt-accent-swatch:hover{transform:scale(1.12);box-shadow:0 4px 12px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.2);}",
            ".lt-accent-swatch.selected{border-color:var(--lt-text,#fff);box-shadow:0 0 0 2px var(--lt-accent),0 4px 12px var(--lt-accent-glow);}",
            ".lt-accent-swatch.selected::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);}",


        ].join("\n");
        document.head.appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 07 工具箱：狀態、共用元件、頁面堆疊與主選單
    // ════════════════════════════════════════════════════════════════════════
    let toolPanelEl = null;

    let toolPanelVisible = false;

    let _toolDragging = false;

    let actionGridEl = null;

    let menuEditing = false, refreshMenuLayout = null, updateTogglesOwner = null;

    // 手机式导航：页面栈 + 视口/头部引用
    let phonePages = [];

    let phoneViewportEl = null;

    let phoneHeaderEls = null;

    let toolPanelPos = { x: TOOL_BTN_X, y: TOOL_BTN_Y + 55 };

    // ── 手机式页面导航 ──────────────────────────────────────────────
    let pageSequence = 0;

    // Owns all scrollbars in the toolbox, including dynamically mounted textarea fields.
    // No wrappers are inserted around content, so page/flex layout remains unchanged.
    function setupToolScrollbars(panel) {
        const selector = '.ltq-body,.lt-content,.lt-craft-items,.lt-craft-side,textarea';
        const layer = document.createElement('div'); layer.className = 'lt-scroll-layer'; panel.append(layer);
        const entries = new Map();
        let queued = false, dead = false, sequence = 0, animateUntil = 0;
        const resize = new ResizeObserver(schedule);
        function schedule() {
            if (queued || dead) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; if (!dead) update(); });
        }
        function add(host) {
            const track = document.createElement('div'); track.className = 'lt-scroll-track'; track.hidden = true;
            const thumb = document.createElement('div'); thumb.className = 'lt-scroll-thumb'; track.append(thumb);
            host.id ||= 'lt-scroll-region-' + (++sequence);
            track.tabIndex = 0; track.setAttribute('role', 'scrollbar');
            track.setAttribute('aria-controls', host.id); track.setAttribute('aria-orientation', 'vertical');
            track.setAttribute('aria-label', t('scrollbar')); track.setAttribute('aria-valuemin', '0');
            const entry = { track, thumb, max: 0, travel: 0, drag: null };
            track.addEventListener('keydown', event => {
                const steps = { ArrowUp: -40, ArrowDown: 40, PageUp: -host.clientHeight, PageDown: host.clientHeight };
                if (event.key === 'Home') host.scrollTop = 0;
                else if (event.key === 'End') host.scrollTop = entry.max;
                else if (event.key in steps) host.scrollTop += steps[event.key];
                else return;
                event.preventDefault(); event.stopPropagation(); schedule();
            });
            track.addEventListener('pointerdown', event => {
                if (event.button !== 0 || !event.isPrimary) return;
                event.preventDefault(); event.stopPropagation();
                if (event.target === thumb) {
                    entry.drag = { id: event.pointerId, y: event.clientY, scroll: host.scrollTop };
                    thumb.setPointerCapture(event.pointerId);
                } else {
                    host.scrollTop += (event.clientY < thumb.getBoundingClientRect().top ? -1 : 1) * host.clientHeight * .85;
                    schedule();
                }
            });
            thumb.addEventListener('pointermove', event => {
                if (!entry.drag || entry.drag.id !== event.pointerId) return;
                const scale = panel.getBoundingClientRect().height / panel.offsetHeight || 1;
                host.scrollTop = entry.drag.scroll + (event.clientY - entry.drag.y) / scale * entry.max / Math.max(1, entry.travel);
                schedule();
            });
            const finish = event => {
                if (!entry.drag || entry.drag.id !== event.pointerId) return;
                entry.drag = null;
                if (thumb.hasPointerCapture(event.pointerId)) thumb.releasePointerCapture(event.pointerId);
            };
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) thumb.addEventListener(type, finish);
            track.addEventListener('wheel', event => {
                const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1;
                host.scrollTop += event.deltaY * unit; event.preventDefault(); event.stopPropagation(); schedule();
            }, { passive: false });
            layer.append(track); entries.set(host, entry);
        }
        function update() {
            const hosts = new Set(panel.querySelectorAll(selector));
            for (const [host, entry] of entries) if (!hosts.has(host)) { entry.track.remove(); entries.delete(host); }
            for (const host of hosts) if (!entries.has(host)) add(host);
            const base = panel.getBoundingClientRect();
            const sx = base.width / panel.offsetWidth || 1, sy = base.height / panel.offsetHeight || 1;
            for (const [host, entry] of entries) {
                const rect = host.getBoundingClientRect(), style = getComputedStyle(host);
                entry.max = Math.max(0, host.scrollHeight - host.clientHeight);
                const visible = toolPanelVisible && entry.max > 1 && host.clientHeight > 0 && rect.width > 0 &&
                    style.visibility !== 'hidden' && /^(auto|scroll)$/.test(style.overflowY) && !host.closest('.ltp-covered,.ltp-leave');
                entry.track.hidden = !visible;
                if (!visible) { entry.drag = null; continue; }
                const height = Math.max(0, host.clientHeight - 8);
                const thumbHeight = Math.min(height, Math.max(24, height * host.clientHeight / host.scrollHeight));
                entry.travel = height - thumbHeight;
                // Full-width pages share the panel's right gutter. Only the left column
                // of an expanded editor and textareas own an internal scrollbar gutter.
                const internal = host.tagName === 'TEXTAREA' ||
                    (host.classList.contains('lt-craft-items') && host.closest('.lt-has-side'));
                const frame = internal ? host : host.closest('.ltp-page') || host;
                const right = frame.getBoundingClientRect().right;
                entry.track.style.left = ((right - base.left) / sx - panel.clientLeft - 9) + 'px';
                entry.track.style.top = ((rect.top - base.top) / sy + host.clientTop + 4) + 'px';
                entry.track.style.height = height + 'px';
                entry.thumb.style.height = thumbHeight + 'px';
                entry.thumb.style.transform = 'translateY(' + (host.scrollTop / entry.max * entry.travel) + 'px)';
                entry.track.setAttribute('aria-valuemax', String(entry.max));
                entry.track.setAttribute('aria-valuenow', String(Math.round(host.scrollTop)));
                // Match clipping of nested scroll regions, especially a textarea in the side editor.
                let top = rect.top, bottom = rect.bottom;
                for (let parent = host.parentElement; parent && parent !== panel; parent = parent.parentElement) {
                    if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowY)) {
                        const bounds = parent.getBoundingClientRect(); top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom);
                    }
                }
                if (bottom <= top) entry.track.hidden = true;
                entry.track.style.clipPath = `inset(${Math.max(0, (top - rect.top) / sy - 4)}px 0 ${Math.max(0, (rect.bottom - bottom) / sy - 4)}px 0)`;
            }
            if (performance.now() < animateUntil) schedule();
        }
        const observed = new Set();
        function observeSizes() {
            const wanted = new Set([panel]);
            for (const host of panel.querySelectorAll(selector)) {
                wanted.add(host); for (const child of host.children) wanted.add(child);
            }
            for (const node of observed) if (!wanted.has(node)) { resize.unobserve(node); observed.delete(node); }
            for (const node of wanted) if (!observed.has(node)) { resize.observe(node); observed.add(node); }
        }
        const mutation = new MutationObserver(records => {
            const relevant = records.filter(record => !(record.target.nodeType === 1 ? record.target : record.target.parentElement)?.closest('.lt-scroll-layer'));
            if (!relevant.length) return;
            // Keep existing observations: re-observing on each style change reissues size notifications.
            if (relevant.some(record => record.type === 'childList')) observeSizes();
            schedule();
        });
        mutation.observe(panel, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        listen(panel, 'scroll', schedule, { capture: true, passive: true });
        listen(panel, 'input', schedule);
        listen(panel, 'transitionrun', event => {
            if (event.target.closest('.lt-scroll-layer')) return;
            animateUntil = performance.now() + 350; schedule();
        });
        listen(panel, 'transitionend', schedule); listen(window, 'resize', schedule);
        const cleanup = () => { dead = true; mutation.disconnect(); resize.disconnect(); observed.clear(); entries.clear(); layer.remove(); cleanupTasks.delete(cleanup); };
        cleanupTasks.add(cleanup); observeSizes(); schedule();
    }

    function makeToolButton(text, callback, primary = false) {
        const button = document.createElement('button');
        button.className = 'lt-btn ' + (primary ? 'lt-btn-primary' : 'lt-btn-secondary');
        button.type = 'button'; button.textContent = text; button.onclick = callback;
        return button;
    }

    function makeButtonRow(...buttons) {
        const row = document.createElement('div'); row.className = 'lt-button-row';
        row.append(...buttons.filter(Boolean));
        return row;
    }

    function makeFooter(content = null) {
        const footer = makeButtonRow(...(content?.classList.contains('lt-button-row') ? [...content.children] : [content]));
        const cancel = makeToolButton(t('cancel'), cancelToolFeature);
        cancel.classList.add('lt-btn-cancel');
        footer.append(cancel);
        return footer;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 工具快捷面板 — v2.1 SVG图标 + 拖拽排序 + 主题
    // ════════════════════════════════════════════════════════════════════════
    function loadToolPanelPos() { return { ...getES().panelPosition }; }

    function saveToolPanelPos() { getES().panelPosition = { ...toolPanelPos }; saveES(); }

    // 位置钳制：确保手机窗口不超出可视范围
    function clampToolPanelPos() {
        if (!toolPanelEl) return;
        const w = toolPanelEl.offsetWidth || 340;
        const h = toolPanelEl.offsetHeight || 640;
        let x = Math.max(4, Math.min(toolPanelPos.x, window.innerWidth  - w - 4));
        let y = Math.max(4, Math.min(toolPanelPos.y, window.innerHeight - h - 4));
        toolPanelPos.x = x; toolPanelPos.y = y;
        toolPanelEl.style.left = x + 'px';
        toolPanelEl.style.top  = y + 'px';
    }

    function readMenuLayout() {
        try { const data = getES().menuLayout;
            return { hidden: Array.isArray(data?.hidden) ? data.hidden : [], toggles: Array.isArray(data?.toggles) ? data.toggles : [] };
        } catch { return { hidden: [], toggles: [] }; }
    }

    function saveMenuLayout(data) { getES().menuLayout = data; saveES(); }

    function toggleMenuHidden(id) {
        const data = readMenuLayout();
        data.hidden = data.hidden.includes(id) ? data.hidden.filter(key => key !== id) : [...data.hidden, id];
        saveMenuLayout(data); refreshMenuLayout?.();
    }

    function setMenuEditing(value) {
        menuEditing = value;
        toolPanelEl?.classList.toggle('ltq-editing', value);
        phoneHeaderEls?.edit.setAttribute('aria-pressed', String(value));
        refreshMenuLayout?.();
    }

    function menuDeleteButton(id) {
        const button = document.createElement('button');
        button.className = 'ltq-delete'; button.type = 'button';
        button.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/></svg>';
        button.setAttribute('aria-pressed', String(!readMenuLayout().hidden.includes(id)));
        button.title = t('menuVisibility');
        button.setAttribute('aria-label', button.title);
        button.onclick = event => { event.stopPropagation(); toggleMenuHidden(id); };
        return button;
    }

    function bindMenuDrag(element, id, container, getOrder, saveOrder) {
        const HOLD_MS = 400, MOVE_TOLERANCE = 8;
        let pointer = null, holdTimer = null, suppressClick = false;
        element.draggable = false;
        const finish = event => {
            if (!pointer || (event && pointer.id !== event.pointerId)) return;
            clearTimeout(holdTimer); holdTimer = null;
            const current = pointer; pointer = null;
            suppressClick = current.dragging || current.moved || event?.type !== 'pointerup';
            element.classList.remove('ltq-dragging');
            if (current.capture.hasPointerCapture(current.id)) current.capture.releasePointerCapture(current.id);
        };
        element.addEventListener('pointerdown', event => {
            if (!menuEditing || event.button !== 0 || !event.isPrimary || pointer) return;
            suppressClick = false;
            // Capture the original button so a short click still reaches the visibility circle.
            const capture = event.target.closest('button') || element;
            pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, capture, dragging: false, moved: false };
            capture.setPointerCapture(event.pointerId);
            holdTimer = setTimeout(() => {
                holdTimer = null;
                if (!pointer || pointer.moved || !menuEditing || !element.isConnected) return;
                pointer.dragging = true;
                element.classList.add('ltq-dragging');
            }, HOLD_MS);
        });
        element.addEventListener('pointermove', event => {
            if (!pointer || pointer.id !== event.pointerId) return;
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < MOVE_TOLERANCE) return;
            pointer.moved = true;
            if (!pointer.dragging) { clearTimeout(holdTimer); holdTimer = null; return; }
            if (!menuEditing) { finish(event); return; }
            const over = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-menu-id]');
            if (!over || over === element || over.parentElement !== container) return;
            const order = getOrder(), from = order.indexOf(id), to = order.indexOf(over.dataset.menuId);
            if (from < 0 || to < 0) return;
            order.splice(to, 0, order.splice(from, 1)[0]); saveOrder(order);
            if (from < to) over.after(element); else over.before(element);
            pointer.capture.setPointerCapture(pointer.id);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, finish);
        element.addEventListener('contextmenu', event => { if (menuEditing) event.preventDefault(); });
        element.addEventListener('click', event => {
            if (suppressClick && event.detail !== 0) {
                suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
            }
        }, true);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 按钮顺序系统
    // ════════════════════════════════════════════════════════════════════════
    function loadBtnOrder() {
        const validIds = ALL_ACTIONS.map(a => a.id);
        const order = getES().buttonOrder;
        return [...new Set([...order.filter(id => validIds.includes(id)), ...validIds])];
    }

    function saveBtnOrder(order) { getES().buttonOrder = [...order]; saveES(); }

    function getOrderedActions() {
        var order = loadBtnOrder();
        return order.map(function(id) {
            return ALL_ACTIONS.find(function(a) { return a.id === id; });
        }).filter(Boolean);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 所有动作定义（含 SVG 图标）
    // ════════════════════════════════════════════════════════════════════════
    const ALL_ACTIONS = [
        { id: 'free',      icon: SVG.free,      label: 'actFree',      title: 'actFreeT', fn: async function() {
            const target = await requestCharacter(t('pickFree'));
            if(disposed) return;
            if (target) free(getNickname(target));
        }},
        { id: 'undo',      icon: SVG.undo,      label: 'actUndo',      title: 'actUndoT', fn: async function() {
            const target = await requestCharacter(t('pickUndo'));
            if(disposed) return;
            if (target) undoCommand(getNickname(target));
        }},
        { id: 'lock',      icon: SVG.lock,      label: 'actLock',      title: 'actLockT', fn: async function() {
            const target = await requestCharacter(t('pickLock'));
            if(disposed) return;
            if (!target) return;
            const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
            if (!itemMiscGroup) { ChatRoomSendLocal(t('lockTypeFail')); return; }
            const validLocks = itemMiscGroup.Asset.filter(a => a.IsLock);
            if (!validLocks.length) { ChatRoomSendLocal(t('lockTypeNone')); return; }
            const lockOpts = validLocks.map(l => ({ text: l.Description || l.Name, value: l.Name, image: toolLockPreview(l) }));
            const selectedLock = await requestButtons(t('lockTypeTitle'), lockOpts, false, { grid: true });
            if(disposed) return;
            if (!selectedLock) return;
            const lock = validLocks.find(l => l.Name === selectedLock);
            if (!lock) return;
            fullLock('', target, lock);
        }},
        { id: 'unlock',    icon: SVG.unlock,    label: 'actUnlock',    title: 'actUnlockT', fn: async function() {
            const target = await requestCharacter(t('pickUnlock'));
            if(disposed) return;
            if (target) fullUnlock(getNickname(target));
        }},
        { id: 'editcraft', icon: SVG.craftEdit, label: 'actEditCraft', title: 'actEditCraftT', fn: async function() {
            openCraftTargetPicker();
        }},
        { id: 'clearcraft',icon: SVG.craftClear,label: 'actClearCraft',title: 'actClearCraftT', fn: async function() {
            const target = await requestCharacter(t('pickClearCraft'));
            if(disposed) return;
            if (target) clearAllCraft(target);
        }},
        { id: 'wardrobe',  icon: SVG.wardrobe,  label: 'actWardrobe',  title: 'actWardrobeT', fn: function() { wardrobe(); } },
        { id: 'bcx',       icon: SVG.bcx,       label: 'actBcx',       title: 'actBcxT', fn: async function() {
            const target = await requestCharacter(t('pickBcx'));
            if(disposed) return;
            if (target) bcxImport(getNickname(target));
        }},
        { id: 'struggle',  icon: SVG.struggle,  label: 'actStruggle',  title: 'actStruggleT', fn: function() { execChatCommand('/lscg escape'); } },
        { id: 'enhance',   icon: SVG.enhance,   label: 'actEnhance',   title: 'actEnhanceT', fn: function() { getEverything(); } },
    ];

    function updatePhoneHeader() {
        if (!phoneHeaderEls || !toolPanelEl) return;
        const top = phonePages.at(-1);
        const home = phoneViewportEl.querySelector('.ltp-home');
        if (home) {
            home.inert = !!top; home.classList.toggle('ltp-covered', !!top);
            home.classList.toggle('ltp-underlay', !!top?.entering && phonePages.length === 1);
        }
        phonePages.forEach(entry => {
            entry.el.inert = entry !== top;
            entry.el.classList.toggle('ltp-covered', entry !== top);
            entry.el.classList.toggle('ltp-underlay', !!top?.entering && entry === phonePages.at(-2));
        });
        phoneHeaderEls.edit.hidden = !!top;
        phoneHeaderEls.view.hidden = !top?.viewToggle;
        if (top?.viewToggle) {
            phoneHeaderEls.view.innerHTML = top.viewToggle.icon();
            phoneHeaderEls.view.title = top.viewToggle.title();
        }
        toolPanelEl.classList.toggle('ltp-wide', !!top?.el.querySelector('.lt-craft-side.is-open'));
        if (top) top.el.classList.toggle('lt-has-side', !!top.el.querySelector('.lt-craft-side.is-open'));
        if (phonePages.length > 0) {
            toolPanelEl.classList.add('ltp-sub');
            phoneHeaderEls.title.textContent = phonePages[phonePages.length - 1].title || '';
            phoneHeaderEls.settings.hidden = true;
        } else {
            toolPanelEl.classList.remove('ltp-sub');
            phoneHeaderEls.title.textContent = phoneHeaderEls.homeTitle;
            phoneHeaderEls.settings.hidden = false;
        }
    }

    // All pages share one stack, footer and transition lifecycle.
    // Completion: popPage(page, false); navigation/cancellation: popPage(page, true).
    function createPanel(titleText, contentEl, footerEl = null, { onClose = null } = {}) {
        ensureToolPanel();
        const page = document.createElement('div');
        page.className = 'ltp-page ltp-enter';
        page.style.zIndex = String(++pageSequence);
        const content = document.createElement('div');
        content.className = 'lt-content';
        content.appendChild(contentEl);
        page.appendChild(content);
        const footer = makeFooter(footerEl);
        footer.classList.add('lt-footer');
        page.appendChild(footer);
        phoneViewportEl.appendChild(page);
        void page.offsetWidth;                 // 强制 reflow，触发滑入过渡
        page.classList.remove('ltp-enter');
        const entry = { el: page, title: titleText, onClose: onClose || null, settled: false, entering: true };
        phonePages.push(entry);
        setTimeout(() => { entry.entering = false; updatePhoneHeader(); }, 300);
        updatePhoneHeader();
        return page;
    }

    // 弹出页面。invokeOnClose=true 时（返回键 / 关闭）调用其 onClose 以结算等待中的 Promise
    function popPage(pageEl, invokeOnClose) {
        const idx = phonePages.findIndex(p => p.el === pageEl);
        if (idx === -1) return;
        const entry = phonePages[idx];
        if (invokeOnClose && !entry.settled && typeof entry.onClose === 'function') {
            entry.settled = true;
            try { entry.onClose(); } catch (e) { console.warn(e); }
        }
        // Removing a parent also cancels its descendants, settling every pending picker.
        while (phonePages.length > idx + 1) popPage(phonePages.at(-1).el, true);
        phonePages.splice(idx, 1);
        pageEl.inert = true;
        entry.cleanup?.();
        pageEl.classList.remove('ltp-covered');
        pageEl.classList.add('ltp-leave');
        setTimeout(function () { if (pageEl.parentNode) pageEl.parentNode.removeChild(pageEl); }, 300);
        updatePhoneHeader();
    }

    function phoneBack() {
        if (!phonePages.length) return;
        const side = phonePages.at(-1).el.querySelector('.lt-craft-side.is-open');
        if (side) { setCraftSideOpen(side, false); return; }
        popPage(phonePages[phonePages.length - 1].el, true);
    }

    function cancelToolFeature() {
        popAllPages();
        setMenuEditing(false);
        updatePhoneHeader();
    }

    function popAllPages() {
        while (phonePages.length) popPage(phonePages[phonePages.length - 1].el, true);
    }

    function ensureToolPanel() {
        if (!toolPanelEl) buildToolPanel();
        if (!toolPanelVisible) showToolPanel();
    }

    function buildToolPanel() {
        if (toolPanelEl) return;
        injectLtStyles();
        applyTheme();

        toolPanelEl = document.createElement('div');
        toolPanelEl.id = 'lt-quick-panel';
        toolPanelEl.style.left = toolPanelPos.x + 'px';
        toolPanelEl.style.top  = toolPanelPos.y + 'px';

        // ── 共用头部（返回 / 标题 / 设置 / 关闭）──
        const hdr = document.createElement('div');
        hdr.className = 'ltq-hdr';

        var backBtn = document.createElement('button');
        backBtn.className = 'ltq-back';
        backBtn.title = t('back');
        backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

        var titleSpan = document.createElement('span');
        titleSpan.className = 'ltq-title';
        titleSpan.textContent = t('toolbox');

        var hdrBtns = document.createElement('div');
        hdrBtns.className = 'ltq-hdr-btns';

        var settingsBtn = document.createElement('button');
        settingsBtn.className = 'ltq-icon-btn';
        settingsBtn.title = t('settingsTitle');
        settingsBtn.innerHTML = SVG.settings;

        var closeBtn = document.createElement('button');
        closeBtn.className = 'ltq-icon-btn';
        closeBtn.title = t('close');
        closeBtn.innerHTML = SVG.close;

        const editBtn = document.createElement('button');
        editBtn.className = 'ltq-icon-btn'; editBtn.innerHTML = TOOL_SETTINGS_ICON;
        editBtn.title = t('menuEdit');
        editBtn.onclick = () => setMenuEditing(!menuEditing);
        const viewBtn = document.createElement('button');
        viewBtn.className = 'ltq-icon-btn'; viewBtn.hidden = true;
        viewBtn.onclick = () => { phonePages.at(-1)?.viewToggle?.toggle(); updatePhoneHeader(); };
        settingsBtn.innerHTML = SVG.light;
        hdrBtns.appendChild(settingsBtn);
        hdrBtns.appendChild(editBtn); hdrBtns.appendChild(viewBtn);
        hdrBtns.appendChild(closeBtn);
        hdr.appendChild(backBtn);
        hdr.appendChild(titleSpan);
        hdr.appendChild(hdrBtns);

        // ── 视口 + 首页 ──
        const viewport = document.createElement('div');
        viewport.className = 'ltp-viewport';
        const homePage = document.createElement('div');
        homePage.className = 'ltp-page ltp-home';
        const body = document.createElement('div');
        body.className = 'ltq-body';
        homePage.appendChild(body);
        viewport.appendChild(homePage);

        phoneViewportEl = viewport;
        phoneHeaderEls = { edit: editBtn, view: viewBtn, back: backBtn, title: titleSpan, settings: settingsBtn, close: closeBtn, homeTitle: (t('toolbox')) };
        phonePages = [];

        // ── Action Grid (2-column, draggable) ──
        actionGridEl = document.createElement('div');
        actionGridEl.className = 'ltq-grid';
        body.appendChild(actionGridEl);
        rebuildActionGrid();

        // ── Toggle Section ──
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'ltq-section';
        sectionLabel.textContent = t('toggleSection');
        body.appendChild(sectionLabel);

        const toggleBtnRefs = {};

        const toggles = [
            { icon: SVG.rp,        label: t('toggleRp'),    title: t('toggleRpHelp'), toggle: 'rp', fn: rpmode },
            { icon: SVG.dnd,       label: t('toggleDnd'), title: t('toggleDndHelp'), toggle: 'dnd', fn: dndCommand },
            { icon: SVG.magicDefense,label: t('toggleMagic'), title: t('toggleMagicHelp'), toggle: 'magicDefense', fn: magicDefenseCommand },
            { icon: SVG.free,      label: t('toggleFree'), title: t('toggleFreeHelp'), toggle: 'freeHands', fn: freeHandsCommand },
            { icon: SVG.ignoreBlock,label: t('toggleBlock'), title: t('toggleBlockHelp'), toggle: 'ignoreBlock', fn: ignoreBlockCommand },
            { icon: SVG.heightFix, label: t('toggleRaise'), title: t('toggleRaiseHelp'), toggle: 'heightFix', fn: heightFixCommand },
            { icon: SVG.heightLock, label: t('toggleScale'), title: t('toggleScaleHelp'), toggle: 'fixedZones', fn: heightLockCommand },
            { icon: SVG.ooc,       label: t('toggleOoc'), title: t('toggleOocHelp'), toggle: 'alwaysOOC', fn: oocCommand },
            { icon: SVG.rpBtn,     label: t('toggleRpButton'), title: t('toggleRpButtonHelp'), toggle: 'rpBtn', fn: rpbtn },
        ];

        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'ltq-toggles'; body.appendChild(toggleContainer);
        toggles.forEach(function(tg) {
            const row = document.createElement('div');
            row.className = 'ltq-toggle';
            row.title = tg.title;
            row.dataset.menuId = tg.toggle;

            const labelWrap = document.createElement('div');
            labelWrap.className = 'ltq-toggle-label';
            const iconEl = document.createElement('span');
            iconEl.className = 'ltq-toggle-icon';
            iconEl.innerHTML = tg.icon;
            const labelEl = document.createElement('span');
            labelEl.textContent = tg.label;
            labelWrap.appendChild(iconEl);
            labelWrap.appendChild(labelEl);

            const sw = document.createElement('div');
            sw.className = 'ltq-switch';

            row.appendChild(labelWrap);
            row.appendChild(sw);
            row.appendChild(menuDeleteButton('toggle:' + tg.toggle));

            toggleBtnRefs[tg.toggle] = { sw: sw, row: row };
            updateToggleState(toggleBtnRefs[tg.toggle], tg.toggle);

            row.addEventListener('click', () => { if (!menuEditing) tg.fn(); });
            toggleContainer.appendChild(row);
            bindMenuDrag(row, tg.toggle, toggleContainer,
                () => [...toggleContainer.children].map(el => el.dataset.menuId),
                order => { const data = readMenuLayout(); data.toggles = order; saveMenuLayout(data); });
        });

        function updateToggleState(ref, key) {
            var isOn = false;
            if (key === 'rp') isOn = getRpMode(Player);
            else if (key === 'dnd') isOn = getES().dnd === 1;
            else if (key === 'magicDefense') isOn = getES().magicDefense === 1;
            else if (key === 'rpBtn') isOn = getES().rpBtnVisible === 1;
            else if (key === 'fixedZones') isOn = getES().fixedZones === 1;
            else if (key === 'heightFix') isOn = getES().heightFix === 1;
            else if (key === 'freeHands') isOn = getES().freeHands === 1;
            else if (key === 'ignoreBlock') isOn = getES().ignoreBlock === 1;
            else if (key === 'alwaysOOC') isOn = getES().alwaysOOC === 1;
            ref.sw.classList.toggle('on', isOn);
            ref.row.classList.toggle('on', isOn);
        }

        function updateToggleBtns() {
            Object.keys(toggleBtnRefs).forEach(function(key) {
                updateToggleState(toggleBtnRefs[key], key);
            });
        }
        updateTogglesOwner = updateToggleBtns;
        refreshMenuLayout = () => {
            rebuildActionGrid();
            const data = readMenuLayout();
            const order = [...new Set([...data.toggles, ...toggles.map(tg => tg.toggle)])];
            order.forEach(key => {
                const row = toggleBtnRefs[key]?.row; if (!row) return;
                const hidden = data.hidden.includes('toggle:' + key);
                row.hidden = !menuEditing && hidden;
                row.title = toggles.find(tg => tg.toggle === key).title + (menuEditing ? ' — ' + t('menuDragHint') : '');
                row.classList.toggle('ltq-hidden-feature', hidden);
                row.querySelector('.ltq-delete').setAttribute('aria-pressed', String(!hidden));
                toggleContainer.appendChild(row);
            });
        };
        refreshMenuLayout();

        // ── Assemble ──
        toolPanelEl.appendChild(hdr);
        toolPanelEl.appendChild(viewport);
        document.body.appendChild(toolPanelEl);
        setupToolScrollbars(toolPanelEl);
        clampToolPanelPos();

        // Apply theme class
        if (currentTheme.mode === 'light') toolPanelEl.classList.add('lt-light');

        // ── Back button ──
        backBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            phoneBack();
        });

        // ── Settings button ──
        settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            openSettingsPanel();
        });

        // ── Close button ──
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideToolPanel();
        });

        // ── Drag logic (panel move) ──
        let drag = { on: false, dx: 0, dy: 0 };

        hdr.addEventListener('pointerdown', function (e) {
            if (e.target.closest('.ltq-icon-btn') || e.target.closest('.ltq-back')) return;
            if (e.button !== 0 || !e.isPrimary) return;
            hdr.setPointerCapture(e.pointerId);
            drag.on = true;
            drag.dx = e.clientX - toolPanelEl.offsetLeft;
            drag.dy = e.clientY - toolPanelEl.offsetTop;
            _toolDragging = true;
            e.preventDefault();
        });

        listen(document, 'pointermove', function (e) {
            if (!drag.on) return;
            toolPanelPos.x = e.clientX - drag.dx;
            toolPanelPos.y = e.clientY - drag.dy;
            toolPanelEl.style.left = toolPanelPos.x + 'px';
            toolPanelEl.style.top  = toolPanelPos.y + 'px';
        });

        function finishPanelDrag() {
            if (drag.on) {
                drag.on = false;
                _toolDragging = false;
                clampToolPanelPos();
                saveToolPanelPos();
            }
        }
        listen(document, 'pointerup', finishPanelDrag);
        listen(document, 'pointercancel', finishPanelDrag);
        listen(window, 'resize', clampToolPanelPos);

        // ── ESC：有子页面则返回，否则关闭 ──
        listen(document, 'keydown', function(e) {
            if (e.key !== 'Escape' || !toolPanelVisible) return;
            if (phonePages.length) phoneBack();
            else hideToolPanel();
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 动作网格重建（拖拽排序后调用）
    // ════════════════════════════════════════════════════════════════════════
    function rebuildActionGrid() {
        if (!actionGridEl) return;
        actionGridEl.replaceChildren();
        const hidden = readMenuLayout().hidden;
        getOrderedActions().forEach(action => {
            const id = 'action:' + action.id, isHidden = hidden.includes(id);
            if (isHidden && !menuEditing) return;
            const button = document.createElement('div');
            button.className = 'ltq-action'; button.title = t(action.title) + (menuEditing ? ' — ' + t('menuDragHint') : '');
            button.dataset.menuId = action.id;
            button.classList.toggle('ltq-hidden-feature', isHidden);
            const icon = document.createElement('span'); icon.className = 'ltq-action-icon'; icon.innerHTML = action.icon;
            const label = document.createElement('span'); label.className = 'ltq-label'; label.textContent = t(action.label);
            button.append(icon, label, menuDeleteButton(id));
            button.onclick = () => { if (!menuEditing) action.fn(); };
            bindMenuDrag(button, action.id, actionGridEl, loadBtnOrder, saveBtnOrder);
            actionGridEl.appendChild(button);
        });
    }

    function showToolPanel() {
        if (!toolPanelEl) buildToolPanel();
        toolPanelVisible = true;
        if (toolPanelEl) {
            clampToolPanelPos();
            requestAnimationFrame(function() {
                toolPanelEl.classList.add('show');
            });
        }
    }

    function hideToolPanel() {
        toolPanelVisible = false;
        setMenuEditing(false);
        if (toolPanelEl) toolPanelEl.classList.remove('show');
        popAllPages(); // 关闭时回到首页，下次打开从主选单开始
    }

    function toggleToolPanel() {
        if(disposed) return;
        if (toolPanelVisible) hideToolPanel(); else showToolPanel();
    }

    function startToolButtonInjector() {
        // 交给共用协调器 BC_ChatRoomButtons 中央託管（{plain:true} 关掉原生底色露出 SVG）。
        // 同步登记 spec，不绑载入时机：协调器已载入就直接 add，否则推进待处理队列等其初始化排空。
        // 协调器由本脚本的 @require 载入（见档头），standalone 也保证有。
        var spec = {
            id: TOOL_CRB_ID,
            buttonId: TOOL_BTN_DOM_ID,
            order: TOOL_CRB_ORDER,
            icon: { src: TOOL_ICON_URL, animated: true },
            tooltip: t('toolbox'),
            background: getAccentPreset().accent,
            onClick: toggleToolPanel
        };
        var L = window.Liko = window.Liko || {};
        if (L.__Sys_ChatRoomButtons__ && L.__Sys_ChatRoomButtons__.add) L.__Sys_ChatRoomButtons__.add(spec);
        else { L.__CRB_pending__ = L.__CRB_pending__ || []; L.__CRB_pending__.push(spec); }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 设置面板
    // ════════════════════════════════════════════════════════════════════════
    function openSettingsPanel() {
        injectLtStyles();
        applyTheme();

        var content = document.createElement('div');
        content.className = 'lt-settings';

        // ── Theme mode ──
        var themeSection = document.createElement('div');
        var themeLabel = document.createElement('div');
        themeLabel.className = 'lt-settings-label';
        themeLabel.textContent = t('settingsTheme');
        themeSection.appendChild(themeLabel);

        var themeRow = document.createElement('div');
        themeRow.className = 'lt-theme-row';

        var darkOption = document.createElement('div');
        darkOption.className = 'lt-theme-option' + (currentTheme.mode !== 'light' ? ' selected' : '');
        darkOption.innerHTML = SVG.dark + '<span>' + t('settingsDark') + '</span><div class="lt-theme-preview dark"></div>';

        var lightOption = document.createElement('div');
        lightOption.className = 'lt-theme-option' + (currentTheme.mode === 'light' ? ' selected' : '');
        lightOption.innerHTML = SVG.light + '<span>' + t('settingsLight') + '</span><div class="lt-theme-preview light"></div>';

        themeRow.appendChild(darkOption);
        themeRow.appendChild(lightOption);
        themeSection.appendChild(themeRow);
        content.appendChild(themeSection);

        for (const [option, mode] of [[darkOption, 'dark'], [lightOption, 'light']]) {
            option.addEventListener('click', () => {
                currentTheme.mode = mode;
                saveTheme(currentTheme); applyTheme();
                darkOption.classList.toggle('selected', mode === 'dark');
                lightOption.classList.toggle('selected', mode === 'light');
            });
        }

        // ── Accent color ──
        var accentSection = document.createElement('div');
        var accentLabel = document.createElement('div');
        accentLabel.className = 'lt-settings-label';
        accentLabel.textContent = t('settingsAccent');
        accentSection.appendChild(accentLabel);

        var accentRow = document.createElement('div');
        accentRow.className = 'lt-accent-row';

        ACCENT_PRESETS.forEach(function(preset) {
            var swatch = document.createElement('div');
            swatch.className = 'lt-accent-swatch' + (currentTheme.accentId === preset.id ? ' selected' : '');
            swatch.style.background = preset.accent;
            swatch.title = t('accent' + preset.id[0].toUpperCase() + preset.id.slice(1));
            swatch.addEventListener('click', function() {
                currentTheme.accentId = preset.id;
                saveTheme(currentTheme);
                applyTheme();
                accentRow.querySelectorAll('.lt-accent-swatch').forEach(function(s) { s.classList.remove('selected'); });
                swatch.classList.add('selected');
            });
            accentRow.appendChild(swatch);
        });

        accentSection.appendChild(accentRow);
        content.appendChild(accentSection);

        // ── Reset button ──
        var footerEl = makeButtonRow();
        var resetBtn = makeToolButton(t('settingsReset'));
        footerEl.appendChild(resetBtn);

        resetBtn.addEventListener('click', function() {
            // Reset theme
            currentTheme = { mode: 'dark', accentId: 'purple' };
            saveTheme(currentTheme);
            applyTheme();
            // Reset button order
            saveBtnOrder(ALL_ACTIONS.map(function(a) { return a.id; }));
            rebuildActionGrid();
            // Update UI
            darkOption.classList.add('selected');
            lightOption.classList.remove('selected');
            accentRow.querySelectorAll('.lt-accent-swatch').forEach(function(s) { s.classList.remove('selected'); });
            accentRow.querySelector('.lt-accent-swatch').classList.add('selected');
            ChatRoomSendLocal(t('settingsResetDone'));
            popPage(panel, false);
        });

        var panel = createPanel(t('settingsTitle'), content, footerEl);
        if (currentTheme.mode === 'light') panel.classList.add('lt-light');
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 08 選擇器與人物預覽：清單、互動格、尺寸與 ECHO 相容
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // 身高系統
    // ──────────────────────────────────────────
    function isToolDialogCharacter(C) {
        return typeof CurrentCharacter !== 'undefined' && !!CurrentCharacter && (C === CurrentCharacter || C === Player);
    }

    function toolViewRatio(C) { return getES().fixedZones === 1 ? 1 : C.HeightRatio ?? 1; }

    function toolViewYOffset(C, ratio) {
        return getES().heightFix === 1
            ? 1000 * (1 - ratio) * (C.HeightRatioProportion ?? 1)
            : CharacterAppearanceYOffset(C, ratio);
    }

    function toolPreviewZone(C, zone) {
        const ratio = toolViewRatio(C);
        const left = CharacterAppearanceXOffset(C, ratio) + zone[0] * ratio;
        const y = toolViewYOffset(C, ratio);
        const top = CharacterAppearsInverted(C) ? 1000 - (y + (zone[1] + zone[3]) * ratio) : y + zone[1] * ratio;
        return [left, top, zone[2] * ratio, zone[3] * ratio];
    }

    // DrawCharacter's optional canvas still writes UI to MainCanvas in R132.
    // Blit only the character canvas with the native geometry, keeping previews local.
    function toolCharacterCanvasOffset(C) {
        const mods = globalThis.bcModSdk?.getModsInfo?.() || [];
        const echoLoaded = mods.some(mod => mod.name === 'echo-clothing-ext' ||
            /(?:^|\/)SugarChain-Studio\/echo-clothing-ext(?:\.git)?\/?$/i.test(mod.repository || ''));
        return echoLoaded && C.Canvas?.width === 1000 ? 250 : 0;
    }

    function drawToolCharacter(C, ctx, x = 0, y = 0, zoom = 1, resize = true) {
        if (C.FixedImage) {
            const image = DrawGetImage(C.FixedImage);
            if (image?.complete && image.naturalWidth) {
                const scale = Math.min(500 / image.naturalWidth, 1000 / image.naturalHeight) * zoom;
                ctx.drawImage(image, x + (500 * zoom - image.naturalWidth * scale) / 2, y, image.naturalWidth * scale, image.naturalHeight * scale);
            }
            return;
        }
        if (C.MustDraw) CharacterRefresh(C, false, false);
        const source = C.Canvas;
        if (!source) return;
        const ratio = resize ? toolViewRatio(C) : 1;
        if (!Number.isFinite(ratio) || ratio <= 0) return;
        const offsetX = CharacterAppearanceXOffset(C, ratio);
        const offsetY = resize ? toolViewYOffset(C, ratio) : 0;
        const inverted = CharacterAppearsInverted(C);
        // Use the lower-level native extractor: DrawCharacterSegment may already
        // carry ECHO's unconditional +250 patch. Apply the detected offset once.
        const segment = DrawCanvasSegment(source, toolCharacterCanvasOffset(C), CanvasUpperOverflow, 500, 1000);
        ctx.save();
        try {
            ctx.translate(x + offsetX * zoom, y);
            if (inverted) { ctx.translate(500 * ratio * zoom, 1000 * zoom); ctx.scale(-1, -1); }
            ctx.drawImage(segment, 0, 0, segment.width, segment.height,
                0, offsetY * zoom, 500 * ratio * zoom, 1000 * ratio * zoom);
        } finally { ctx.restore(); }
    }

    function attachItemViewHeader(panel, picker) {
        const entry = phonePages.find(page => page.el === panel);
        entry.viewToggle = {
            icon: () => picker.isMap() ? ZONE_VIEW_ICON : LIST_VIEW_ICON,
            title: () => picker.isMap() ? (t('viewCharacterHint')) : (t('viewListHint')),
            toggle: () => picker.toggle(),
        };
        const cleanup = entry.cleanup;
        entry.cleanup = () => { cleanup?.(); picker.destroy(); };
        picker.refreshView();
        updatePhoneHeader();
    }

    // Group names, rather than translated display labels, identify selections in both views.
    function createItemPicker(target, options, multiple, onSelection) {
        const root = document.createElement('div'); root.className = 'lt-item-picker';
        const list = document.createElement('div'); list.className = 'lt-btn-list';
        const map = document.createElement('div'); map.className = 'lt-item-map'; map.hidden = true;
        const canvas = document.createElement('canvas'); canvas.width = 500; canvas.height = 1000; map.append(canvas);
        root.append(list, map);
        const selected = new Set(), controls = new Map();
        let mapMode = getES().itemViewMode === 'character', dead = false;
        const currentTarget = () => resolveToolTarget(target);
        function sync() {
            controls.forEach((elements, group) => elements.forEach(el => {
                el.classList.toggle('selected', selected.has(group));
                el.setAttribute('aria-pressed', String(selected.has(group)));
            }));
        }
        function select(group) {
            if (multiple) { if (selected.has(group)) selected.delete(group); else selected.add(group); }
            else { selected.clear(); selected.add(group); }
            sync(); onSelection?.([...selected]);
        }
        function register(button, group) {
            if (!controls.has(group)) controls.set(group, []);
            controls.get(group).push(button);
            button.onclick = () => select(group);
        }
        options.forEach(option => {
            for (const host of [list]) {
                const button = document.createElement('button'); button.className = 'lt-list-btn';
                button.textContent = option.text; register(button, option.group); host.append(button);
            }
        });
        const zoneControls = [];
        const eligible = new Set(options.map(option => option.group));
        for (const group of AssetGroup) {
            if (!group.Name.startsWith('Item')) continue;
            for (const zone of group.Zone || []) {
                const button = document.createElement('button'); button.className = 'lt-zone-button';
                const option = options.find(item => item.group === group.Name);
                button.title = option?.text || group.Description || group.Name;
                button.setAttribute('aria-label', button.title);
                button.disabled = !eligible.has(group.Name);
                if (eligible.has(group.Name)) register(button, group.Name);
                map.append(button); zoneControls.push({ button, group, zone });
            }
        }
        function draw() {
            if (!mapMode || dead || !root.isConnected || root.closest('.ltp-covered')) return;
            const C = currentTarget(), ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 500, 1000);
            if (!C) return;
            try {
                drawToolCharacter(C, ctx);
                zoneControls.forEach(({button, group, zone}) => {
                    const [x,y,w,h] = toolPreviewZone(C, zone);
                    button.style.left = x / 5 + '%'; button.style.top = y / 10 + '%';
                    button.style.width = w / 5 + '%'; button.style.height = h / 10 + '%';
                    // Highlight only this operation's selectable items; clothing occlusion is irrelevant.
                    button.classList.toggle('occupied', eligible.has(group.Name) && !!InventoryGet(C, group.Name));
                });
            } catch (error) { console.warn('[LT] Item zone preview:', error); }
        }
        function fitMap() {
            if (!mapMode || dead) return;
            const scale = Math.max(0, Math.min((root.clientWidth - 8) / 500, (root.clientHeight - 8) / 1000));
            const width = 500 * scale + 'px', height = 1000 * scale + 'px';
            if (map.style.width !== width) map.style.width = width;
            if (map.style.height !== height) map.style.height = height;
        }
        function refreshView() {
            list.hidden = mapMode; map.hidden = !mapMode;
            root.classList.toggle('is-map', mapMode);
            if (root.parentElement?.classList.contains('lt-content')) root.parentElement.classList.toggle('lt-picker-map-content', mapMode);
            fitMap(); draw();
        }
        // ResizeObserver must not synchronously write sizes back into its observed layout.
        let fitQueued = false;
        const observer = new ResizeObserver(() => {
            if (fitQueued || dead) return;
            fitQueued = true;
            requestAnimationFrame(() => { fitQueued = false; fitMap(); });
        });
        observer.observe(root);
        const timer = setInterval(draw, 200);
        const destroy = () => { dead = true; observer.disconnect(); clearInterval(timer); cleanupTasks.delete(destroy); };
        cleanupTasks.add(destroy);
        return {
            root, selected, refreshView, isMap: () => mapMode,
            updateLabel(group, text) {
                controls.get(group)?.forEach(button => {
                    button.title = text;
                    if (button.classList.contains('lt-list-btn')) button.textContent = text;
                    else button.setAttribute('aria-label', text);
                });
            },
            toggle() {
                mapMode = !mapMode;
                getES().itemViewMode = mapMode ? 'character' : 'list'; saveES();
                refreshView();
            },
            selectAll() { const all = selected.size === options.length; selected.clear(); if (!all) options.forEach(o => selected.add(o.group)); sync(); onSelection?.([...selected]); },
            destroy,
        };
    }

    function requestItemSelection(title, target, items, onConfirm = null) {
        return new Promise(resolve => {
            let busy = false, closed = false;
            const picker = createItemPicker(target, items, true);
            const footer = makeButtonRow();
            const finish = values => { if (closed) return; closed = true; popPage(panel, false); resolve(values); };
            footer.append(makeToolButton(t('selectAll'), () => picker.selectAll()),
                makeToolButton(t('confirm'), async () => {
                    if (busy || closed) return;
                    const selected = [...picker.selected];
                    if (onConfirm && !selected.length) return;
                    busy = true;
                    try {
                        // Keep this page below the form, just like every other forward navigation.
                        if (onConfirm && await onConfirm(selected) === false) return;
                        if (!disposed && !closed) finish(selected);
                    } finally { busy = false; }
                }, true));
            const panel = createPanel(title, picker.root, footer, { onClose: () => { closed = true; resolve([]); } });
            attachItemViewHeader(panel, picker);
        });
    }

    function requestButtons(promptText, buttons, multiSelect = false, options = {}) {
        return new Promise(resolve => {
            const listEl = document.createElement("div");
            listEl.className = options.grid ? 'lt-lock-grid' : 'lt-btn-list';

            if (!buttons.length) {
                const empty = document.createElement("div");
                empty.className = "lt-empty";
                empty.textContent = promptText;
                listEl.appendChild(empty);
            }

            let selected = new Set();
            const itemEls = [];

            buttons.forEach(btn => {
                const el = document.createElement("button");
                el.className = "lt-list-btn";
                el.type = "button";
                el.classList.toggle("lt-self-option", !!btn.highlight);
                const value = btn.value ?? btn.text;
                const textSpan = document.createElement("span");
                textSpan.className = 'lt-option-label';
                textSpan.textContent = btn.text;
                const check = document.createElement("span");
                check.className = "lt-check";
                check.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="12" cy="12" r="7"/></svg>';
                if (btn.image) {
                    const image = document.createElement('img'); image.src = btn.image; image.alt = ''; image.loading = 'lazy';
                    el.appendChild(image);
                }
                el.appendChild(textSpan);
                if (multiSelect) el.appendChild(check);

                if (multiSelect) {
                    itemEls.push({ el, value });
                    el.onclick = () => {
                        if (selected.has(value)) { selected.delete(value); el.classList.remove("selected"); }
                        else { selected.add(value); el.classList.add("selected"); }
                    };
                } else {
                    el.onclick = () => { popPage(panel, false); resolve(value); };
                }
                listEl.appendChild(el);
            });

            const footerEl = multiSelect ? makeButtonRow(
                makeToolButton(t('selectAll'), () => {
                    const allOn = selected.size === itemEls.length && itemEls.length > 0;
                    itemEls.forEach(({ el, value }) => {
                        if (allOn) selected.delete(value); else selected.add(value);
                        el.classList.toggle('selected', !allOn);
                    });
                }),
                makeToolButton(t('confirm'), () => { popPage(panel, false); resolve([...selected]); }, true)
            ) : null;

            const panel = createPanel(promptText, listEl, footerEl, {
                onClose: () => resolve(multiSelect ? [] : null)
            });
        });
    }

    /* ── 角色选择器 ── */
    function requestCharacter(title) {
        const targets = [...(ChatRoomCharacter || [])].sort((a, b) => (b.IsPlayer?.() ? 1 : 0) - (a.IsPlayer?.() ? 1 : 0));
        if (!targets.length) { ChatRoomSendLocal(t('noPlayers')); return Promise.resolve(null); }
        return requestButtons(title, targets.map(target => ({
            text: getNickname(target) + ' (#' + target.MemberNumber + ')',
            value: target, highlight: target.IsPlayer?.(),
        })));
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 09 Craft：共用欄位、單項與批量編輯
    // ════════════════════════════════════════════════════════════════════════
    // ── Craft 属性：清除 / 批量编辑（只提供 名称 / 描述 / 私有）──
    // 收集对象身上所有 Item* 组的束缚物品
    function collectRestraintItems(target) {
        const items = [];
        for (const group of AssetGroup) {
            if (!group.Name.startsWith("Item")) continue;
            const item = InventoryGet(target, group.Name);
            if (item) items.push({ item, group: group.Name, groupDesc: group.Description });
        }
        return items;
    }

    function craftForEdit(item, values) {
        return Object.assign({
            Color: Array.isArray(item.Color) ? item.Color.join(',') : typeof item.Color === 'string' ? item.Color : '',
            Lock: '', Effects: {},
        }, structuredClone(item.Craft || {}), {
            Name: values.name, Description: values.description, Private: values.private,
            Item: item.Asset.Name,
            MemberName: Player.Nickname || Player.Name || '', MemberNumber: Player.MemberNumber,
        });
    }

    function createCraftFields(craft = {}) {
        const root = document.createElement('div'); root.className = 'lt-settings lt-craft-fields';
        const field = (label, element) => {
            const wrapper = document.createElement('label'); wrapper.className = 'lt-settings-label';
            wrapper.textContent = label;
            wrapper.append(element); root.append(wrapper); return element;
        };
        const name = field(t('craftName'), document.createElement('input')); name.type = 'text'; name.maxLength = 30; name.value = craft.Name || '';
        const description = field(t('craftDesc'), document.createElement('textarea')); description.maxLength = 200; description.rows = 5; description.value = craft.Description || '';
        const privateInput = document.createElement('input'); privateInput.type = 'checkbox'; privateInput.checked = !!craft.Private;
        const privateLabel = document.createElement('label'); privateLabel.className = 'lt-checkbox-label'; privateLabel.append(privateInput, document.createTextNode(t('craftPrivate'))); root.append(privateLabel);
        return { root, focus() { name.focus({ preventScroll: true }); }, read() {
            if (!name.value.trim()) { name.focus(); return null; }
            return { name: name.value.trim(), description: description.value.trim(), private: privateInput.checked };
        } };
    }

    // craft 编辑表单：名称 / 描述 / 私有 → resolve({name, description, private}) 或 null
    function requestCraftEdit() {
        return new Promise(resolve => {
            let done = false;
            const fields = createCraftFields();
            const confirm = makeToolButton(t('confirm'), () => {
                if (done) return;
                const values = fields.read(); if (!values) return;
                done = true; popPage(panel, false); resolve(values);
            }, true);
            const panel = createPanel(t('craftEditTitle'), fields.root, confirm, {
                onClose: () => { if (!done) { done = true; resolve(null); } }
            });
            setTimeout(() => {
                if (phonePages.at(-1)?.el === panel) fields.focus();
            }, 300);
        });
    }

    function setCraftSideOpen(side, open) {
        if (open && side.hidden) {
            side.hidden = false;
            // Establish the collapsed state before starting the CSS transition.
            void side.offsetWidth;
        }
        side.inert = !open;
        side.classList.toggle('is-open', open);
        if (open && toolPanelEl) {
            const width = Math.min(702, innerWidth - 6);
            const left = toolPanelEl.getBoundingClientRect().left;
            toolPanelEl.style.left = Math.max(4, Math.min(left, innerWidth - width - 4)) + 'px';
        }
        updatePhoneHeader();
    }

    function openSingleCraftEditor(target) {
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission')); return; }
        const items = collectRestraintItems(target).map(r => ({ group: r.group,
            text: (r.item.Craft?.Name || r.item.Asset.Description || r.item.Asset.Name) + ' (' + r.groupDesc + ')' }));
        if (!items.length) { ChatRoomSendLocal(t('craftNoItem')); return; }
        const layout = document.createElement('div'); layout.className = 'lt-craft-layout';
        const left = document.createElement('div'); left.className = 'lt-craft-items';
        const side = document.createElement('div'); side.className = 'lt-craft-side'; side.hidden = true;
        let selectedGroup = null, selectedAsset = null;
        const currentTarget = () => resolveToolTarget(target);
        function edit(group) {
            const C = currentTarget();
            const item = C && InventoryGet(C, group); if (!item) return;
            selectedGroup = group; selectedAsset = item.Asset;
            side.replaceChildren();
            const fields = createCraftFields(item.Craft || { Name: item.Asset.Description || item.Asset.Name });
            const status = document.createElement('div'); status.setAttribute('role', 'status');
            const footer = makeFooter(); footer.classList.add('lt-footer');
            function draft() {
                const C = currentTarget(), live = C && InventoryGet(C, selectedGroup);
                if (!live || live.Asset !== selectedAsset) { status.textContent = t('craftItemChanged'); return null; }
                const values = fields.read(); if (!values) return null;
                return { C, live, craft: craftForEdit(live, values) };
            }
            footer.prepend(makeToolButton(t('confirm'), () => {
                const data = draft(); if (!data) return;
                if (!hasBCItemPermission(data.C)) { status.textContent = t('noPermission'); return; }
                data.live.Craft = data.craft; ChatRoomCharacterUpdate(data.C);
                picker.updateLabel(selectedGroup, data.craft.Name + ' (' + data.live.Asset.Group.Description + ')');
                status.textContent = t('craftSaved');
            }, true),
            makeToolButton(t('export'), () => {
                const data = draft(); if (!data) return;
                // Same payload/encoding as native Crafting's single-item download.
                const craft = structuredClone(data.craft);
                delete craft.MemberName; delete craft.MemberNumber; craft.Partial = false;
                CommonClipboardWrite(LZString.compressToBase64(JSON.stringify(craft)), result => {
                    if (disposed || !side.isConnected) return;
                    status.textContent = result.err ? (t('craftCopyFailed')) : (t('craftCopied'));
                });
            }));
            side.append(fields.root, status, footer); setCraftSideOpen(side, true);
        }
        const picker = createItemPicker(target, items, false, groups => edit(groups[0]));
        left.append(picker.root); layout.append(left, side);
        const panel = createPanel((t('craftSingleTitle')) + ' — ' + getNickname(target), layout, null);
        panel.classList.add('lt-single-craft-page');
        attachItemViewHeader(panel, picker);
    }

    function openCraftTargetPicker(initialTarget = null) {
        const list = document.createElement('div'); list.className = 'lt-btn-list';
        const footer = makeButtonRow();
        let selected = initialTarget;
        const targets = [...(window.ChatRoomCharacter || [])].sort((a,b) => Number(b === Player) - Number(a === Player));
        if (initialTarget && !targets.includes(initialTarget)) targets.unshift(initialTarget);
        targets.forEach(target => {
            const button = document.createElement('button'); button.className = 'lt-list-btn';
            button.textContent = getNickname(target) + ' (#' + target.MemberNumber + ')';
            button.classList.toggle('selected', selected === target);
            button.onclick = () => { selected = target; [...list.children].forEach(el => el.classList.toggle('selected', el === button)); batch.disabled = single.disabled = false; };
            list.append(button);
        });
        const batch = makeToolButton(t('craftBatch'), () => editCraftBatch(selected), true);
        const single = makeToolButton(t('craftSingle'), () => openSingleCraftEditor(selected), true);
        batch.disabled = single.disabled = !selected;
        footer.append(batch, single);
        const panel = createPanel(t('pickEditCraft'), list, footer);
    }

    async function clearAllCraft(target) {
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return; }
        // 只列出「确实带有 craft」的束缚，供逐个选或全选
        const restraints = collectRestraintItems(target)
        .filter(r => r.item.Craft)
        .map(r => ({
            text: (r.item.Craft?.Name || r.item.Asset?.Description || r.item.Asset?.Name || t('unknown')) + " (" + r.groupDesc + ")",
            group: r.group
        }));
        if (!restraints.length) { ChatRoomSendLocal(getNickname(target) + " " + t('craftClearNone') + "！"); return; }
        const selected = await requestItemSelection(t('craftClearTitle') + " — " + getNickname(target), target, restraints);
        if(disposed) return;
        if (!selected.length) return;
        const current = resolveToolTarget(target);
        if (!current) { ChatRoomSendLocal(t('notInRoom')); return; }
        if (!hasBCItemPermission(current)) { ChatRoomSendLocal(t('noPermission')); return; }
        try {
            let count = 0;
            selected.forEach(group => {
                const item = InventoryGet(current, group);
                if (item?.Craft) { delete item.Craft; count++; }
            });
            if (!count) return;
            ChatRoomCharacterUpdate(current);
            chatSendCustomAction(getNickname(Player) + " " + t('craftClearDone') + " " + getNickname(target) + "！");
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ clearAllCraft 错误:", e.message); }
    }

    async function editCraftBatch(target) {
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return; }
        const restraints = collectRestraintItems(target).map(r => ({
            text: (r.item.Craft?.Name || r.item.Asset?.Description || r.item.Asset?.Name || t('unknown')) + " (" + r.groupDesc + ")",
            group: r.group
        }));
        if (!restraints.length) { ChatRoomSendLocal(getNickname(target) + " " + t('craftNoItem') + "！"); return; }
        await requestItemSelection(t('craftPickTitle') + " — " + getNickname(target), target, restraints, async selected => {
            const craft = await requestCraftEdit();
            if (disposed || !craft) return false;
            const current = resolveToolTarget(target);
            if (!current) { ChatRoomSendLocal(t('notInRoom')); return false; }
            try {
                let count = 0;
                if (!hasBCItemPermission(current)) { ChatRoomSendLocal(t('noPermission')); return false; }
                selected.forEach(group => {
                    const item = InventoryGet(current, group);
                    if (!item) return;
                    item.Craft = craftForEdit(item, craft);
                    count++;
                });
                if (!count) return false;
                ChatRoomCharacterUpdate(current);
                chatSendCustomAction(getNickname(Player) + " → " + getNickname(current) + "：" + count + " " + t('craftEditDone') + "「" + craft.name + "」");
                return true;
            } catch (e) { console.error("🐈‍⬛ [LT] ❌ editCraftBatch 错误:", e.message); return false; }
        });
    }

    function clearCraftCommand(args) {
        const target = getPlayer((args || '').trim());
        clearAllCraft(target);
        return true;
    }

    function editCraftCommand(args) {
        const target = getPlayer((args || '').trim());
        openCraftTargetPicker(target);
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 10 外觀回滾：快照、預覽與指令
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // Undo 系統
    // ──────────────────────────────────────────
    const UNDO_MAX_PER_CHARACTER = 30;

    const UNDO_MAX_CHARACTERS = 100;

    const undoHistory = {};

    function saveUndoSnapshot(target, changedByNumber) {
        const id = target?.MemberNumber;
        if (!id) return;
        const bundle = ServerAppearanceBundle(target.Appearance);
        if (!bundle?.length) return;
        if (undoHistory[id]?.length > 0) {
            const last = undoHistory[id].slice(-1)[0];
            if (JSON.stringify(last.bundle) === JSON.stringify(bundle)) return;
        }
        if (!undoHistory[id]) undoHistory[id] = [];
        undoHistory[id].push({ timestamp: Date.now(), changedBy: changedByNumber ?? null, bundle: structuredClone(bundle) });
        if (undoHistory[id].length > UNDO_MAX_PER_CHARACTER) undoHistory[id].shift();
        const ids = Object.keys(undoHistory);
        if (ids.length > UNDO_MAX_CHARACTERS) {
            ids.sort((a, b) => undoHistory[a].at(-1).timestamp - undoHistory[b].at(-1).timestamp);
            delete undoHistory[ids[0]];
        }
    }

    function summarizeAppearanceDiff(before, after) {
        const index = bundle => new Map(bundle.map(item => [item.Group, item]));
        const old = index(before), next = index(after);
        let added=0, removed=0, changed=0;
        next.forEach((item,key) => { if (!old.has(key)) added++; else if (JSON.stringify(old.get(key)) !== JSON.stringify(item)) changed++; });
        old.forEach((_item,key) => { if (!next.has(key)) removed++; });
        return {added,removed,changed};
    }

    function scanAllCharacters() {
        if (!Array.isArray(ChatRoomCharacter)) return;
        ChatRoomCharacter.forEach(c => { if (c?.MemberNumber) saveUndoSnapshot(c, null); });
    }

    // ──────────────────────────────────────────
    // Undo 外觀预览面板
    // ──────────────────────────────────────────
    async function openUndoPanel(target) {
        const id = target?.MemberNumber;
        const history = structuredClone(undoHistory[id] || []);
        if (!history?.length) { ChatRoomSendLocal(getNickname(target) + "：" + t('undoNoRecord')); return; }

        injectLtStyles();
        applyTheme();
        let canvasCharacter = null;
        try {
            canvasCharacter = CharacterCreate(target.AssetFamily, CharacterType.NPC, "LT_UndoPreview");
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 建立预览角色失敗:", e.message);
        }

        let currentIndex = history.length - 1;

        const topNavEl = document.createElement("div");
        topNavEl.className = 'lt-undo-nav';
        const prevBtn = document.createElement("button");
        prevBtn.className = "lt-nav-btn";
        prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>' + t('undoPrev');
        const counterEl = document.createElement("div");
        counterEl.className = 'lt-undo-counter';
        const nextBtn = document.createElement("button");
        nextBtn.className = "lt-nav-btn";
        nextBtn.innerHTML = t('undoNext') + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        const metaEl = document.createElement("div");
        metaEl.className = "lt-undo-meta";
        const timeRow = document.createElement("div"); timeRow.className = "lt-undo-meta-row";
        const diffRow = document.createElement('div'); diffRow.className = 'lt-undo-meta-row';
        metaEl.appendChild(timeRow);
        metaEl.appendChild(diffRow);
        topNavEl.appendChild(prevBtn); topNavEl.appendChild(counterEl); topNavEl.appendChild(nextBtn);

        const canvasWrap = document.createElement("div");
        const canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 1000;
        canvasWrap.appendChild(canvas);

        const applyBtn = makeToolButton(t('undoApply'), null, true);
        const footerBtns = makeButtonRow(applyBtn);

        const contentEl = document.createElement("div");
        contentEl.appendChild(topNavEl); contentEl.appendChild(metaEl); contentEl.appendChild(canvasWrap);

        const panel = createPanel(t('undoTitle') + " — " + getNickname(target), contentEl, footerBtns);
        panel.classList.add('lt-undo-page');
        contentEl.className = 'lt-undo-content';
        canvasWrap.className = 'lt-undo-preview';

        let renderedIndex = -1;
        function renderPreview() {
            if (!canvasCharacter) return;
            try {
                const entry = history[currentIndex];
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (renderedIndex !== currentIndex) {
                    canvasCharacter.Appearance = structuredClone(entry.bundle).map(b => ServerBundledItemToAppearanceItem(target.AssetFamily, b));
                    CharacterRefresh(canvasCharacter, false, false);
                    renderedIndex = currentIndex;
                }
                drawToolCharacter(canvasCharacter, ctx, 40, 100, 0.85, false);
            } catch (e) { console.error("🐈‍⬛ [LT] ❌ 预览渲染失敗:", e.message); }
        }

        const renderInterval = setInterval(renderPreview, 200);
        const cleanupPreview = () => {
            clearInterval(renderInterval);
            try { if (canvasCharacter) CharacterDelete(canvasCharacter.ID); } catch (e) {}
            canvasCharacter = null;
            cleanupTasks.delete(cleanupPreview);
        };
        cleanupTasks.add(cleanupPreview);
        phonePages.find(entry => entry.el === panel).cleanup = cleanupPreview;

        function updateMeta() {
            const entry = history[currentIndex];
            const timeStr = new Date(entry.timestamp).toLocaleString();
            timeRow.textContent = t('undoChangedAt') + '：' + timeStr;
            const diff = summarizeAppearanceDiff(ServerAppearanceBundle(target.Appearance), entry.bundle);
            diffRow.textContent = (t('undoDiffPrefix')) + `+${diff.added} / −${diff.removed} / Δ${diff.changed}`;
            diffRow.title = t('undoDiffHelp');
            counterEl.textContent = (currentIndex + 1) + " / " + history.length + " " + t('undoCountUnit');
            prevBtn.disabled = currentIndex <= 0;
            nextBtn.disabled = currentIndex >= history.length - 1;
        }

        prevBtn.onclick = () => { if (currentIndex > 0) { currentIndex--; updateMeta(); renderPreview(); } };
        nextBtn.onclick = () => { if (currentIndex < history.length - 1) { currentIndex++; updateMeta(); renderPreview(); } };

        applyBtn.onclick = () => {
            if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return; }
            const entry = history[currentIndex];
            const oldBundle = ServerAppearanceBundle(target.Appearance);
            ServerSend("ChatRoomCharacterUpdate", {
                ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
                ActivePose: target.ActivePose,
                Appearance: entry.bundle
            });
            const sizeKb = (Math.abs(JSON.stringify(oldBundle).length - JSON.stringify(entry.bundle).length) / 1024).toFixed(1);
            ChatRoomSendLocal(getNickname(target) + " " + t('undoApplyDone') + "（" + t('undoApplySize') + ": " + sizeKb + "kB）");
            chatSendCustomAction(t('actUndoMsg', { src: getNickname(Player), who: getNickname(target), time: new Date(entry.timestamp).toLocaleTimeString() }));
            // Keep live history intact: new snapshots may have arrived while previewing.
            popPage(panel, false);
        };

        updateMeta();
        renderPreview();
    }

    async function undoCommand(args) {
        await openUndoPanel(getPlayer(args.trim()));
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 11 外觀操作：鎖、解除拘束、匯入與衣櫃
    // ════════════════════════════════════════════════════════════════════════
    // ── AFC 心锁（拓展锁）识别：解除拘束 / 解锁时跳过，避免破坏 AFC 心锁 ──
    const AFC_HEARTLOCK_NAME = 'Heart Padlock';

    function isHeartLock(item) {
        const p = item?.Property;
        return !!p && (p.Name === AFC_HEARTLOCK_NAME || !!p.HeartLockId);
    }

    function toolLockPreview(asset) {
        if (asset.Name === 'DeviousPadlock') return 'https://cdn.jsdelivr.net/gh/FurryZoi/Devious-Obligate-Great-Stuff@main/src/images/devious-padlock.png';
        if (asset.Name === '淫纹锁LuziPadlock') return 'https://cdn.jsdelivr.net/gh/SugarChain-Studio/echo-clothing-ext@52afa10aaa854907422727eb623c658b20ee1b4d/resources/Assets/Female3DCG/ItemMisc/Preview/%E6%B7%AB%E7%BA%B9%E9%94%81LuziPadlock.png';
        if (asset.Name === 'Heart Padlock') return 'https://cdn.jsdelivr.net/gh/awdrrawd/BC-AFC@main/Images/AFC-Heart_Lock.png';
        return AssetGetPreviewPath(asset) + '/' + asset.Name + '.png';
    }

    // ──────────────────────────────────────────
    // 指令實作
    // ──────────────────────────────────────────
    async function free(args) {
        let target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        const restraints = [];
        for (const group of AssetGroup) {
            if (group.Name.startsWith("Item")) {
                const item = InventoryGet(target, group.Name);
                if (item) {
                    if (isHeartLock(item)) continue; // AFC 心锁：跳过，不列入可解除清单
                    const lock     = item.Property?.LockedBy ? t('lockPrefix') + " " + item.Property.LockedBy : "";
                    const password = item.Property?.Password || item.Property?.CombinationNumber || "";
                    const itemName = item.Craft?.Name || item.Asset?.Description || item.Asset?.Name || t('unknown');
                    restraints.push({
                        text: (lock ? lock + " " : "") + itemName + " (" + group.Description + (password ? ", " + t('password') + ": " + password : "") + ")",
                        group: group.Name
                    });
                }
            }
        }
        if (!restraints.length) { ChatRoomSendLocal(getNickname(target) + " " + t('freeNoItem') + "！"); return true; }
        const selected = await requestItemSelection(t('freeTitle') + " — " + getNickname(target), target, restraints);
        if(disposed) return;
        if (!selected.length) return true;
        target = resolveToolTarget(target);
        if (!target) { ChatRoomSendLocal(t('notInRoom')); return true; }
        try {
            if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission')); return true; }
            selected.forEach(group => {
                const item = InventoryGet(target, group);
                if (item && !isHeartLock(item)) InventoryRemove(target, group);
            });
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(t('actFreeMsg', { src: getNickname(Player), who: getNickname(target), items: selected.map(group => restraints.find(r => r.group === group)?.text || group).join(isZh() ? "、" : ", ") }));
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ free 错误:", e.message); }
        return true;
    }

    function fullLock(args, selectedTarget = null, selectedLock = null) {
        const params           = args.trim().split(/\s+/);
        const targetIdentifier = params[0] || "";
        const lockName         = params.slice(1).join(" ");
        const target           = selectedTarget || getPlayer(targetIdentifier);
        if (target === Player && !targetIdentifier && !selectedTarget) { ChatRoomSendLocal(t('lockSpecify')); return true; }
        if (!ChatRoomCharacter?.find(c => c.MemberNumber === target.MemberNumber)) {
            ChatRoomSendLocal(getNickname(target) + " " + t('notInRoom') + "！"); return true;
        }
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
        if (!itemMiscGroup) return true;
        const validLocks = itemMiscGroup.Asset.filter(a => a.IsLock);
        const lock = selectedLock ? validLocks.find(l => l.Name === selectedLock.Name) : validLocks.find(l => l.Name.toLowerCase() === lockName.toLowerCase() || l.Description?.toLowerCase() === lockName.toLowerCase());
        if (!lock) {
            ChatRoomSendLocal(t('lockInvalid') + "：" + lockName + "。" + t('lockAvailable') + "：" + validLocks.map(l => l.Description).join("、"));
            return true;
        }
        try {
            let count = 0;
            for (const item of target.Appearance) {
                const groupName = item.Asset?.Group?.Name || "";
                if (groupName.startsWith("Item") && item.Asset?.AllowLock !== false && !item.Property?.LockedBy) {
                    if (lock.Name === 'DeviousPadlock' && typeof InventoryIsPermissionBlocked === 'function' &&
                        InventoryIsPermissionBlocked(target, lock.Name, groupName)) continue;
                    InventoryLock(target, item, { Asset: AssetGet(Player.AssetFamily, "ItemMisc", lock.Name) }, Player.MemberNumber);
                    count++;
                }
            }
            if (!count) { ChatRoomSendLocal(getNickname(target) + " " + t('lockNone') + "！"); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(t('actLockMsg', { src: getNickname(Player), who: getNickname(target), count: count, lock: lock.Description }));
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ fullLock 错误:", e.message); }
        return true;
    }

    async function fullUnlock(args) {
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        // 跳过主人锁 / 恋人锁 / AFC 心锁（拓展锁）
        const skipLocks = ["OwnerPadlock", "OwnerTimerPadlock", "LoversPadlock", "LoversTimerPadlock"];
        const locks = collectRestraintItems(target)
        .filter(r => {
            const lb = r.item.Property?.LockedBy;
            return lb && !skipLocks.includes(lb) && !isHeartLock(r.item);
        })
        .map(r => {
            const pw = r.item.Property?.Password || r.item.Property?.CombinationNumber || "";
            return {
                text: (r.item.Craft?.Name || r.item.Asset?.Description || r.item.Asset?.Name || t('unknown')) + " (" + r.groupDesc + ") [" + r.item.Property.LockedBy + (pw ? ", " + t('password') + ": " + pw : "") + "]",
                group: r.group
            };
        });
        if (!locks.length) { ChatRoomSendLocal(getNickname(target) + " " + t('unlockNone') + "！"); return true; }
        const selected = await requestButtons(t('unlockTitle') + " — " + getNickname(target), locks, true);
        if(disposed) return;
        if (!selected.length) return true;
        try {
            let count = 0;
            selected.forEach(txt => {
                const group = locks.find(l => l.text === txt)?.group;
                if (!group) return;
                const item = InventoryGet(target, group);
                if (item && item.Property?.LockedBy) { InventoryUnlock(target, item); count++; }
            });
            if (!count) return true;
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(getNickname(Player) + " " + t('unlockDone') + " " + getNickname(target) + "！");
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ fullUnlock 错误:", e.message); }
        return true;
    }

    async function bcxImport(args) {
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        let bcxCode;
        try { bcxCode = await navigator.clipboard.readText(); if(disposed) return; }
        catch (e) { ChatRoomSendLocal(t('clipboardFail')); return true; }
        try {
            const appearance = JSON.parse(LZString.decompressFromBase64(bcxCode));
            if (!Array.isArray(appearance)) throw new Error("invalid");
            ServerAppearanceLoadFromBundle(target, target.AssetFamily, appearance, Player.MemberNumber);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(getNickname(Player) + " " + t('bcxDone') + " " + getNickname(target) + "！");
        } catch (e) { ChatRoomSendLocal(t('bcxInvalid')); }
        return true;
    }

    async function getEverything() {
        const options = [{ text: t('geItems') }, { text: t('geMoney') }, { text: t('geSkills') }];
        const selected = await requestButtons(t('geTitle'), options, true);
        if(disposed) return;
        if (!selected.length) return true;
        try {
            if (selected.includes(t('geItems'))) {
                const ids = [];
                AssetFemale3DCG.forEach(group => {
                    group.Asset.forEach(item => {
                        if (item.Name && !Player.Inventory.some(inv => inv.Name === item.Name && inv.Group === group.Group) && item.InventoryID) {
                            InventoryAdd(Player, item.Name, group.Group, false);
                            ids.push(item.InventoryID);
                        }
                    });
                });
                ServerPlayerInventorySync();
                ChatRoomSendLocal(ids.length + " " + t('geItemsDone') + "！");
            }
            if (selected.includes(t('geMoney'))) {
                Player.Money = 999999; ServerPlayerSync();
                ChatRoomSendLocal(t('geMoneyDone') + "！");
            }
            if (selected.includes(t('geSkills'))) {
                ["LockPicking", "Evasion", "Willpower", "Bondage", "SelfBondage", "Dressage", "Infiltration"]
                    .forEach(skill => SkillChange(Player, skill, 10, 0, true));
                ChatRoomSendLocal(t('geSkillsDone') + "！");
            }
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ getEverything 错误:", e.message); }
        return true;
    }

    function wardrobe() {
        try { ChatRoomAppearanceLoadCharacter(Player); ChatRoomSendLocal(t('wardrobeDone')); }
        catch (e) { console.error("🐈‍⬛ [LT] ❌ wardrobe 错误:", e.message); }
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 12 顯示與 RP：比例開關、狀態徽章與快捷鍵
    // ════════════════════════════════════════════════════════════════════════
    function heightFixCommand() { return toggleSetting('heightFix', { on: 'heightFixOn', off: 'heightFixOff' }); }

    function heightLockCommand() {
        return toggleSetting('fixedZones', {
            update: settings => { settings.heightLock = settings.fixedZones; },
            message: enabled => (t('fixedScalePrefix')) + (enabled ? 'ON' : 'OFF'),
        });
    }

    // ──────────────────────────────────────────
    // RP 模式（支持隐身：stealthRp=1 时状态纯本地，不广播）
    //  - stealthRp ON  → 自己能看到图标，别人看不到（存 ExtensionSettings）
    //  - stealthRp OFF → 所有人都能看到图标（存 OnlineSharedSettings 广播）
    //  - Shift+P 长按 1.5 秒切换 stealthRp
    // ──────────────────────────────────────────
    function getRpMode(character) {
        if (!character) return false;
        if (character.IsPlayer && character.IsPlayer()) {
            return getES().stealthRp === 1
                ? getES().rpModeLocal === 1
            : getES().rpMode === 1;
        }
        return character.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
    }

    function setRpMode(enabled) {
        const settings = getES();
        settings[settings.stealthRp === 1 ? 'rpModeLocal' : 'rpMode'] = enabled ? 1 : 0;
        saveES();
        if (settings.stealthRp !== 1) broadcastShared('RPmode', enabled);
        updateTogglesOwner?.();
    }

    // ──────────────────────────────────────────
    // Canvas：绘制头顶状态徽章（从固定高度往下堆叠；只画开启的，顺序 RP > 勿扰 > 无视绑缚）
    // ──────────────────────────────────────────
    function drawStateBadges(C, CharX, CharY, Zoom) {
        const keys = [];
        if (getRpMode(C))         keys.push('rp');
        if (getDndMode(C))        keys.push('dnd');
        if (getFreeHandsShared(C)) keys.push('free');
        if (getMagicDefenseShared(C)) keys.push('magicDefense');
        if (!keys.length) return;
        const baseY = (C.IsKneeling && C.IsKneeling()) ? 300 : 40; // 固定锚点：跪姿往下移
        const x = CharX +35+340 * Zoom;
        const size = 45 * Zoom;
        const step = 55 * Zoom;
        keys.forEach((key, i) => {
            const y = CharY +45+ baseY * Zoom + i * step;
            if (key === 'rp') DrawImageResize(rpIconUrl, x, y, size, 50 * Zoom); // RP 沿用原本 PNG 徽章
            else drawBadgeDisc(key, x, y, size);
        });
    }

    function rpmode() {
        const newRpMode = !getRpMode(Player);
        setRpMode(newRpMode);
        ChatRoomSendLocal(newRpMode ? t('rpOn') : t('rpOff'), TOGGLE_MSG_MS);
        return true;
    }

    function rpbtn() { return toggleSetting('rpBtnVisible', { on: 'rpBtnShow', off: 'rpBtnHide' }); }

    // ──────────────────────────────────────────
    // 隐藏快捷键：长按 Shift + P 1.5 秒，切换 RP 隐身模式
    //   - stealthRp ON  → 别人看不到你头顶的 RP 图标
    //   - stealthRp OFF → 别人能看到你头顶的 RP 图标
    //   - 完全隐晦：UI 上不显示任何入口，只有开发者知道
    //   - 普通人按不出：必须 Shift + P 同时按住 1.5 秒
    // ──────────────────────────────────────────
    function setupHiddenRpBtnShortcut() {
        let held = false;
        let timer = null;
        const HOLD_MS = 1500;
        listen(document, 'keydown', function(e) {
            if (e.repeat) return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key !== 'P' && e.key !== 'p') return;
            if (!e.shiftKey) return;
            if (held) return;
            held = true;
            timer = setTimeout(function() {
                const s = getES();
                const wasOn = getRpMode(Player);
                s.stealthRp = s.stealthRp !== 1 ? 1 : 0;
                saveES();
                // 如果之前 RP 已开，把状态迁移到新的存储方式
                if (wasOn) {
                    setRpMode(false);
                    setRpMode(true);
                }
                ChatRoomSendLocal(t('stealthLabel') + ': ' + (s.stealthRp === 1 ? t('stealthOn') : t('stealthOff')));
            }, HOLD_MS);
        });
        listen(document, 'keyup', function(e) {
            if (e.key === 'P' || e.key === 'p' || e.key === 'Shift') {
                if (timer) { clearTimeout(timer); timer = null; }
                held = false;
            }
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 13 功能 Hook：無視綁縛、勿擾、魔法防禦、OOC 與遮擋
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // Free Hands 无视绑缚（被绑时仍可使用双手，不解开任何拘束道具）
    //  - 透过 ModSDK 挂钩 Player 的实例方法（点路径 "Player.X"，ModSDK 会解析 window.Player.X），
    //    让修改登记在本 mod 名下 → 不会被其他工具判为「未使用 ModSDK 的未知修改」。
    //  - 只挂一次；实际启停由 getES().freeHands 决定（关闭时走 next(args) 原逻辑，零副作用）。
    //  ponytail: 挂钩在 hook 时解析当前 Player 实例；同页内重登录换了 Player 物件需重挂（init 会重跑）。
    // ──────────────────────────────────────────
    let freeHandsPlayer = null, freeHandsRemovers = [];

    function setupFreeHandsHooks() {
        const player = window.Player;
        if (freeHandsPlayer === player || !modApi || !player?.MemberNumber) return;
        freeHandsRemovers.forEach(remove => remove());
        freeHandsRemovers = []; freeHandsPlayer = null;
        try {
            for (const [name, value] of [['CanInteract', true], ['IsRestrained', false], ['CanChangeOwnClothes', true]]) {
                freeHandsRemovers.push(modApi.hookFunction('Player.' + name, 2,
                    (args, next) => getES().freeHands === 1 ? value : next(args)));
            }
            freeHandsPlayer = player;
        } catch (error) {
            freeHandsRemovers.forEach(remove => remove()); freeHandsRemovers = [];
            console.error('[LT] FreeHands hooks:', error);
        }
    }

    function freeHandsCommand() { return toggleSetting('freeHands', { on: 'fhOn', off: 'fhOff', shared: 'FreeHands' }); }

    // ──────────────────────────────────────────
    // 勿扰模式：除自己外，任何人对本玩家外观的编辑（换衣/拘束）都立即复原
    //  - _dndBaseline 记录「授权状态」：开启时、以及自己/全量同步造成的变更后都会更新。
    //  - 他人造成的变更 → 载回 baseline 并广播，覆盖对方的修改，同时发一则动作讯息。
    //  ponytail: 用「变更来源号码」区分自己 vs 他人的启发式；来源为 null（全量同步）视为授权。
    // ──────────────────────────────────────────
    let _dndBaseline = null;

    let _dndLastAnnounce = 0;

    let _dndInSync = false; // 处理「他人造成的同步」期间为 true，避免把对方的状态误存成基准

    // 勿扰放行清单：ECHO「贴贴」(ItemMisc) — 抱入/钻怀时用来固定两人，勿扰不复原它（加/移除都放行）
    const DND_EXEMPT = { Group: "ItemMisc", Name: "贴贴" };

    function _dndIsExempt(i) { return i && i.Group === DND_EXEMPT.Group && i.Name === DND_EXEMPT.Name; }

    // 非放行部分的指纹（依 Group 排序求稳定序），用来判断「除了贴贴之外有没有真的被改动」
    function _dndFingerprint(bundle) {
        return JSON.stringify(bundle.filter(i => !_dndIsExempt(i))
                              .slice().sort((a, b) => (a.Group > b.Group ? 1 : a.Group < b.Group ? -1 : 0)));
    }

    // 复原用 bundle：非放行部分回到 baseline，贴贴则保留「当前」状态（让 ECHO 抱抱不被撤销）
    function _dndBuildRevertBundle(currentBundle) {
        let bundle = _dndBaseline.filter(i => !_dndIsExempt(i));
        const currExempt = currentBundle.find(_dndIsExempt);
        if (currExempt) {
            bundle = bundle.filter(i => i.Group !== DND_EXEMPT.Group); // 让出贴贴所在格子
            bundle.push(currExempt);
        }
        return bundle;
    }

    function dndCaptureBaseline() {
        try { _dndBaseline = ServerAppearanceBundle(Player.Appearance); } catch (e) {}
    }

    function dndRevert(sourceNumber) {
        if (!_dndBaseline) { dndCaptureBaseline(); return; }
        let currentBundle, mergedBundle;
        try {
            currentBundle = ServerAppearanceBundle(Player.Appearance);
            mergedBundle  = _dndBuildRevertBundle(currentBundle);
            // 只有「贴贴」被加/移除 → 没有需要复原的改动，直接放行（不复原、不广播）
            if (_dndFingerprint(currentBundle) === _dndFingerprint(_dndBaseline)) return;
        } catch (e) { mergedBundle = _dndBaseline; }
        try {
            ServerAppearanceLoadFromBundle(Player, Player.AssetFamily, mergedBundle, Player.MemberNumber);
            CharacterRefresh(Player, false); // Push=false：别再触发 ServerPlayerAppearanceSync（会重入并污染基准）
            ChatRoomCharacterUpdate(Player); // 手动广播复原后的外观，覆盖对方的修改
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ DND 复原错误:", e.message); return; }
        const now = Date.now();
        if (now - _dndLastAnnounce > 3000) { // 节流，避免对方连点洗版
            _dndLastAnnounce = now;
            const src = ChatRoomCharacter?.find(c => c.MemberNumber === sourceNumber);
            chatSendCustomAction(t('dndReverted', { src: getNickname(src || {}), who: getNickname(Player) }));
        }
    }

    // 收到「本玩家外观被变更」的同步时调用；target/source 由各 sync hook 解出
    function dndHandleIncoming(target, sourceNumber) {
        if (getES().dnd !== 1) return;
        if (!target || target.MemberNumber !== Player.MemberNumber) return; // 只保护自己
        if (sourceNumber == null || sourceNumber === Player.MemberNumber) {
            dndCaptureBaseline(); // 自己的变更或全量同步 → 更新授权基准
            return;
        }
        dndRevert(sourceNumber);
    }

    function dndCommand() {
        return toggleSetting('dnd', { on: 'dndOn', off: 'dndOff', shared: 'DND',
            apply: enabled => { if (enabled) dndCaptureBaseline(); } });
    }

    // ──────────────────────────────────────────
    // LSCG 魔法防御：在 LSCG 套用任何效果前拦截接收入口。
    // 同时覆盖远端施法、本地/自施法及配对魔法，避免短暂的换装、催眠、失明等副作用。
    // ──────────────────────────────────────────
    let _magicDefenseModule = null;

    let _magicDefenseOriginals = null;

    let _magicDefenseTimer = null;

    function announceMagicDefense() {
        chatSendCustomAction(t('magicDeflected', { who: getNickname(Player) }));
    }

    function restoreMagicDefenseHooks() {
        if (_magicDefenseModule && _magicDefenseOriginals) {
            Object.keys(_magicDefenseOriginals).forEach(function(name) {
                if (_magicDefenseModule[name]?._ltMagicDefenseWrapper) {
                    _magicDefenseModule[name] = _magicDefenseOriginals[name];
                }
            });
        }
        _magicDefenseModule = null;
        _magicDefenseOriginals = null;
    }

    function setupMagicDefenseHooks() {
        let magic = null;
        try { magic = window.LSCG?.getModule?.('MagicModule'); } catch (e) {}
        if (!magic || magic === _magicDefenseModule) return;
        restoreMagicDefenseHooks();

        const originals = {};
        ['IncomingSpellCommand', 'IncomingSpell', 'IncomingSpellPair'].forEach(function(name) {
            if (typeof magic[name] !== 'function') return;
            const original = magic[name];
            originals[name] = original;
            const wrapper = function() {
                if (!disposed && getES().magicDefense === 1) {
                    announceMagicDefense();
                    return;
                }
                return original.apply(this, arguments);
            };
            wrapper._ltMagicDefenseWrapper = true;
            magic[name] = wrapper;
        });
        if (Object.keys(originals).length) {
            _magicDefenseModule = magic;
            _magicDefenseOriginals = originals;
        }
    }

    function startMagicDefenseHooks() {
        setupMagicDefenseHooks();
        if (!_magicDefenseTimer) _magicDefenseTimer = setInterval(setupMagicDefenseHooks, 1000);
    }

    function magicDefenseCommand() {
        return toggleSetting('magicDefense', { on: 'magicDefenseOn', off: 'magicDefenseOff',
            shared: 'MagicDefense', apply: setupMagicDefenseHooks });
    }

    // ──────────────────────────────────────────
    // 说话总是 OOC：聊天/密语时自动把讯息包成 (...) 转为 OOC（略过指令 / / 动作 * / 已是 OOC）
    //  另外把输入框 placeholder（BC 的「对话状态」提示）在启用时前缀「现在讯息为 OOC」。
    // ──────────────────────────────────────────
    // 自愈式刷新 placeholder：大多数帧只做一次 startsWith 比对就返回，仅在不一致时才重建。
    // ponytail: 每帧检查，但已用「状态一致即短路」把成本压到近乎为零。
    function ltRefreshOOCPlaceholder() {
        if (CurrentScreen !== "ChatRoom") return;
        const el = document.getElementById("InputChat");
        if (!el) return;
        const on = getES().alwaysOOC === 1;
        const tag = t('oocPlaceholder');
        const hasTag = (el.getAttribute("placeholder") || "").startsWith(tag);
        if (on === hasTag) return; // 已一致，短路
        // 重建 BC 原生 placeholder（密语目标 / 公开）
        let base;
        const tgt = (typeof ChatRoomTargetMemberNumber === 'number' && ChatRoomTargetMemberNumber >= 0)
        ? ChatRoomCharacter?.find(c => c.MemberNumber === ChatRoomTargetMemberNumber) : null;
        if (tgt) base = TextGetInScope("Screens/Online/ChatRoom/Text_ChatRoom.csv", "WhisperTo") + " " + CharacterNickname(tgt);
        else base = TextGetInScope("Screens/Online/ChatRoom/Text_ChatRoom.csv", "PublicChat");
        el.setAttribute("placeholder", on ? (tag + " · " + base) : base);
    }

    function oocCommand() { return toggleSetting('alwaysOOC', { on: 'oocOn', off: 'oocOff', apply: ltRefreshOOCPlaceholder }); }

    // ──────────────────────────────────────────
    // Ignore Clothing Block 无视衣物阻挡
    //  - 拿掉「其他道具 Block 此格子」+ 衣物遮挡类前置条件（RemoveClothesForItem 一般衣物/外套、
    //    UnZipSuitForItem 连体衣/外套遮住乳环），让被服装/道具遮挡的格子仍可直接换装、装拘束。
    //  - enclose / 距离 / 主人规则 / 其它前置条件(姿势/贞操/冲突拘束)全部保留。
    //  - 透过 modApi.hookFunction 挂钩（不直接改写全局函式），否则会被 ModSDK 判为「未知 MOD」。
    //    关闭时呼叫 hookFunction 回传的移除器还原，不留下任何修改。
    // ──────────────────────────────────────────
    let _ibHooks = null;

    function installIgnoreBlockHooks() {
        if (_ibHooks || !modApi || typeof modApi.hookFunction !== 'function') return;
        const installed = [];
        try {
            installed.push(modApi.hookFunction('InventoryGroupIsBlockedForCharacter', 10, (args, next) => {
                const C = args[0], GroupName = args[1];
                let Activity = args[2] || false;
                const restraints = C.Appearance.filter(i => i.Asset.Group.IsItem());
                if (Activity && !restraints.some(i => i.Asset.AllowActivityOn.includes(GroupName) || i.Property?.AllowActivityOn?.includes(GroupName)))
                    Activity = false;
                const blocked = next(args);
                const itemBlocked = !Activity && restraints.some(i => i.Asset.Block?.includes(GroupName) || i.Property?.Block?.includes(GroupName));
                if (!itemBlocked) return blocked;
                // Only bypass native item-to-item blocking; enclosure remains protected.
                if (!C.IsPlayer() && C.IsEnclose())
                    return !restraints.some(i => i.Asset.Group.Name == GroupName && InventoryItemHasEffect(i, "Enclose", true));
                return false;
            }));
            installed.push(modApi.hookFunction('InventoryPrerequisiteMessage', 10, (args, next) => {
                const msg = next(args);
                // 衣物遮挡类前置条件全部放行：RemoveClothesForItem（一般衣物/外套遮挡）、
                // UnZipSuitForItem（连体衣/外套遮住乳环等 ItemNipplesPiercings 项目）。
                // 其它（姿势/贞操/MustFree*/MustHave* 等结构性条件）保留。
                return (msg === "RemoveClothesForItem" || msg === "UnZipSuitForItem") ? "" : msg;
            }));
            _ibHooks = installed;
        } catch (error) {
            installed.forEach(remove => remove());
            throw error;
        }
    }

    function removeIgnoreBlockHooks() {
        if (!_ibHooks) return;
        _ibHooks.forEach(remove => { try { remove(); } catch (e) {} });
        _ibHooks = null;
    }

    function applyIgnoreBlock() {
        if (getES().ignoreBlock === 1) installIgnoreBlockHooks(); else removeIgnoreBlockHooks();
    }

    function ignoreBlockCommand() { return toggleSetting('ignoreBlock', { on: 'ibOn', off: 'ibOff', apply: applyIgnoreBlock }); }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 14 整合入口：SDK Hook 與聊天指令派發
    // ════════════════════════════════════════════════════════════════════════
    let modApi = null;

    // ─────────────────────────────────────────
    // 安全 hook 包装
    // ──────────────────────────────────────────
    function safeHookFunction(functionName, priority, callback) {
        if (!modApi) return;
        if (typeof window[functionName] === 'undefined') {
            console.warn("🐈‍⬛ [LT] ⚠️ " + functionName + " 不存在，跳过 hook");
            return;
        }
        try { modApi.hookFunction(functionName, priority, callback); }
        catch (e) { console.error("🐈‍⬛ [LT] ❌ Hook " + functionName + " 失敗:", e.message); }
    }

    // ──────────────────────────────────────────
    // Hooks
    // ──────────────────────────────────────────
    function setupHooks() {

        // 离开聊天室（如前往衣柜）时关闭工具箱
        safeHookFunction("CommonSetScreen", 10, (args, next) => {
            return Promise.resolve(next(args)).then(result => {
                if (!disposed && CurrentScreen !== 'ChatRoom' && toolPanelVisible) hideToolPanel();
                return result;
            });
        });

        // 说话总是 OOC：送出前把输入框内容包成 (...)（略过空 / 指令 / / 动作 * : / 已是 OOC ( ）
        safeHookFunction("ChatRoomSendChat", 20, (args, next) => {
            if (getES().alwaysOOC === 1) {
                const el = document.getElementById("InputChat");
                if (el && el.value) {
                    const m = el.value.trim();
                    const isEmote = m.startsWith("*") || (Player.ChatSettings?.MuStylePoses && m.startsWith(":") && m.length > 3);
                    if (m && !m.startsWith("/") && !m.startsWith("(") && !isEmote) {
                        el.value = "(" + m + ")";
                    }
                }
            }
            return next(args);
        });

        // RP 模式：攔截 Action 讯息
        safeHookFunction("ServerSend", 20, (args, next) => {
            if (!getRpMode(Player) || CurrentScreen !== "ChatRoom") return next(args);
            const [messageType, data] = args;
            if (messageType === "ChatRoomChat" && data.Type === "Action") return;
            return next(args);
        });

        // 绘制头顶状态徽章
        safeHookFunction("ChatRoomCharacterViewDrawOverlay", 10, (args, next) => {
            const result = next(args);
            const [C, CharX, CharY, Zoom] = args;
            if (C?.MemberNumber && CurrentScreen === "ChatRoom" &&
                (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
                drawStateBadges(C, CharX, CharY, Zoom);
            }
            return result;
        });

        // 绘制 RP 按鈕 + 工具觸发按鈕
        safeHookFunction("DrawProcess", 4, (args, next) => {
            const result = next(args);
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                ltRefreshOOCPlaceholder(); // 自愈式同步「现在讯息为 OOC」提示
            }
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' &&
                (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
                if (getES().rpBtnVisible === 1) {
                    DrawButton(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize, '',
                               getRpMode(Player) ? "Orange" : "Gray", "", t('rpBtnTip'));
                    drawCanvasIconOnButton('rp', rpBtnX, rpBtnY, rpBtnSize, rpBtnSize, 24);
                }
            }
            return result;
        });

        // 點擊 RP 按鈕 + 工具觸发按鈕
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            if (getES().rpBtnVisible === 1 && MouseIn(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize)) {
                const newRpMode = !getRpMode(Player);
                setRpMode(newRpMode);
                if (typeof ChatRoomSendLocalStyled === 'function') {
                    ChatRoomSendLocalStyled(newRpMode ? t('rpOn') : t('rpOff'), TOGGLE_MSG_MS);
                } else {
                    ChatRoomSendLocal(newRpMode ? t('rpOn') : t('rpOff'), TOGGLE_MSG_MS);
                }
                return;
            }
            return next(args);
        });

        // Mirror native raise-view positioning without changing character height fields.
        // IgnoreUpButton=true is used during asset construction and must remain untouched.
        safeHookFunction('CharacterAppearanceYOffset', 10, (args, next) => {
            const offset = next(args);
            const [C, ratio, ignoreUpButton] = args;
            if (ignoreUpButton || getES().heightFix !== 1 || !isToolDialogCharacter(C)) return offset;
            return 1000 * (1 - ratio) * (C.HeightRatioProportion ?? 1);
        });

        safeHookFunction('DrawCharacter', 10, (args, next) => {
            if (getES().fixedZones !== 1 || !isToolDialogCharacter(args[0])) return next(args);
            const drawArgs = [...args];
            drawArgs[4] = false; // Native display-only ratio=1; C.HeightRatio remains untouched.
            return next(drawArgs);
        });

        // Both native zone drawing and hit testing use this same geometry function.
        safeHookFunction("DialogGetCharacterZone", 10, (args, next) => {
            if (getES().fixedZones !== 1 || !isToolDialogCharacter(args[0])) return next(args);
            const zoneArgs = [...args]; zoneArgs[5] = 1;
            return next(zoneArgs);
        });

        // Undo hooks
        safeHookFunction("ChatRoomSync", -10, (args, next) => {
            const result = next(args);
            const room = typeof ChatRoomData === 'undefined' ? null : ChatRoomData;
            return Promise.resolve(result).then(value => {
                if (!disposed && CurrentScreen === 'ChatRoom' && ChatRoomData === room) scanAllCharacters();
                return value;
            });
        });
        safeHookFunction("ChatRoomSyncMemberJoin", -10, (args, next) => {
            const result = next(args);
            const [data] = args;
            const newChar = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Character?.MemberNumber);
            if (newChar) saveUndoSnapshot(newChar, null);
            return result;
        });
        safeHookFunction("ChatRoomCharacterItemUpdate", -10, (args, next) => {
            const result = next(args);
            const [target] = args;
            dndHandleIncoming(target, Player.MemberNumber); // 自己动的 → 刷新勿扰基准，不会撤销
            saveUndoSnapshot(target, Player.MemberNumber);
            return result;
        });
        safeHookFunction("ChatRoomSyncItem", -10, (args, next) => {
            _dndInSync = true;
            let result;
            try {
                result = next(args);
                const [data] = args;
                const target = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Item?.Target);
                if (target) { dndHandleIncoming(target, data?.Source); saveUndoSnapshot(target, data?.Source); }
            } finally { _dndInSync = false; }
            return result;
        });
        safeHookFunction("ChatRoomSyncSingle", -10, (args, next) => {
            _dndInSync = true;
            let result;
            try {
                result = next(args);
                const [data] = args;
                const target = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Character?.MemberNumber);
                if (target) { dndHandleIncoming(target, data?.SourceMemberNumber); saveUndoSnapshot(target, data?.SourceMemberNumber); }
            } finally { _dndInSync = false; }
            return result;
        });

        // 勿扰：玩家自己同步外观（换衣/自缚等）时更新授权基准；但「他人同步」期间(_dndInSync)不采信，
        // 否则 CharacterRefresh(Player) 会在攻击处理中触发本函式、把对方状态误存成基准，导致复原失效。
        safeHookFunction("ServerPlayerAppearanceSync", 10, (args, next) => {
            const result = next(args);
            if (getES().dnd === 1 && !_dndInSync) dndCaptureBaseline();
            return result;
        });
    }

    // ──────────────────────────────────────────
    // 指令入口
    // ──────────────────────────────────────────
    function handleLtCommand(text) {
        if (disposed) return;
        if (!Player.ExtensionSettings?.LikoTOOL) initializeStorage();
        const args       = text.trim().split(/\s+/);
        const subCommand = args[0]?.toLowerCase() || "";
        const commandText = args.slice(1).join(" ");

        if (!subCommand || subCommand === "help") { ChatRoomSendLocal(t('helpText')); return true; }

        const commands = {
            show:          showToolPanel,
            free,
            clearcraft:    clearCraftCommand,
            editcraft:     editCraftCommand,
            bcximport:     bcxImport,
            rpmode,
            rpbtn,
            fullunlock:    fullUnlock,
            geteverything: getEverything,
            wardrobe,
            fulllock:      fullLock,
            heightfix:     heightFixCommand,
            heightlock:    heightLockCommand,
            ooc:           oocCommand,
            dnd:           dndCommand,
            magicdefense:  magicDefenseCommand,
            freehands:     freeHandsCommand,
            ignoreblock:   ignoreBlockCommand,
            undo:          undoCommand,
        };

        if (commands[subCommand]) {
            try { commands[subCommand](commandText); }
            catch (e) {
                console.error("🐈‍⬛ [LT] ❌ 命令 " + subCommand + " 执行错误:", e.message);
                ChatRoomSendLocal(t('cmdFail') + "：/lt " + subCommand);
            }
        } else {
            ChatRoomSendLocal(t('unknownCmd') + "：/lt " + subCommand);
        }
        return true;
    }

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 15 啟動與卸載：依賴、登入、註冊與完整清理
    // ════════════════════════════════════════════════════════════════════════
    // ──────────────────────────────────────────
    // 等待系列
    // ──────────────────────────────────────────
    // ──────────────────────────────────────────
    // 初始化 modApi
    // ──────────────────────────────────────────
    function waitForLogin() { return waitFor(() => window.Player?.MemberNumber !== undefined); }

    async function initializeModApi() {
        if (!(await waitFor(() => typeof bcModSdk !== "undefined" && bcModSdk?.registerMod)) || disposed) return;
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko - tool",
                fullName: "Liko's tool",
                version: MOD_Version,
                repository: 'https://github.com/awdrrawd/liko-Plugin-Repository'
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 初始化 modApi 失敗:", e.message);
        }
    }

    // ──────────────────────────────────────────
    // 载入 Toast 系統
    // ──────────────────────────────────────────
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js";
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                lifecycle.signal.removeEventListener('abort', cancel);
                script.onload = script.onerror = null;
                script.remove();
                if (error) reject(error); else resolve();
            };
            const cancel = () => finish();
            const timeout = setTimeout(() => finish(new Error('Toast load timed out')), 10000);
            lifecycle.signal.addEventListener('abort', cancel, { once: true });
            script.onload = () => finish();
            script.onerror = () => finish(new Error("Toast 载入失敗"));
            document.head.appendChild(script);
        });
    }

    // ──────────────────────────────────────────
    // 主初始化
    // ──────────────────────────────────────────
    async function initialize() {
        await initializeModApi();
        if (disposed) return;
        if (!modApi) throw new Error("SDK unavailable");
        try { await loadToastSystem(); }
        catch (e) { console.warn("🐈‍⬛ [LT] ❌ Toast system 载入失敗，備用模式運行:", e.message); }

        if (!(await waitForLogin()) || disposed) return;

        initializeStorage();
        setupHiddenRpBtnShortcut();
        setupFreeHandsHooks();
        setInterval(setupFreeHandsHooks, 1000);
        applyIgnoreBlock();
        startMagicDefenseHooks();
        if (getES().dnd === 1) dndCaptureBaseline();
        // 广播持久化的徽章状态（DND / FreeHands / MagicDefense），让别人一进房就看得到
        if (typeof globalThis.ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
        applyTheme();
        setupHooks();
        startToolButtonInjector();

        const registerCommand = () => {
            if (disposed) return;
            CommandCombine([{ Tag: "lt", Description: "Execute Liko Tool command", Action: handleLtCommand }]);
        };
        if (typeof CommandCombine === "function") {
            try { registerCommand(); }
            catch (e) { console.error("🐈‍⬛ [LT] ❌ 注册命令错误:", e.message); }
        } else {
            waitFor(() => typeof CommandCombine === "function").then(() => {
                try { registerCommand(); }
                catch (e) { console.error("🐈‍⬛ [LT] ❌ 延遲注册命令错误:", e.message); }
            });
        }

        waitFor(() => CurrentScreen === "ChatRoom").then(() => {
            if (disposed) return;
            ChatRoomSendLocal(t('loaded', { v: MOD_Version }), 30000);
        });
        console.log(`🐈‍⬛ [LT] ✅ v${MOD_Version} loaded`);
    }

    // ──────────────────────────────────────────
    // 卸载清理
    // ──────────────────────────────────────────
    function destroy() {
        if (disposed) return;
        hideToolPanel();
        stopLifecycle();
        removeIgnoreBlockHooks(); restoreMagicDefenseHooks();
        try { modApi?.unload(); } catch (error) { console.warn(error); }
        modApi=null;
        window.Liko.__Sys_ChatRoomButtons__?.remove(TOOL_CRB_ID);
        if (Array.isArray(window.Liko.__CRB_pending__)) window.Liko.__CRB_pending__ = window.Liko.__CRB_pending__.filter(s => s.id !== TOOL_CRB_ID);
        toolPanelEl?.remove(); toolPanelEl=null;
        refreshMenuLayout = updateTogglesOwner = null;
        actionGridEl = phoneHeaderEls = phoneViewportEl = null;
        document.getElementById('lt-styles')?.remove();
        document.getElementById('lt-theme-vars')?.remove();
        if (typeof Command !== 'undefined' && Array.isArray(Command)) {
            for(let i=Command.length-1;i>=0;i--) if(Command[i].Action===handleLtCommand) Command.splice(i,1);
        }
        for (const id of Object.keys(undoHistory)) delete undoHistory[id];
        if (window.Liko.Tool?.Destroy === destroy) delete window.Liko.Tool;
        delete window.Liko.LT;
    }

    // 公開生命週期 API，所有宣告就緒後才開始非同步初始化。
    window.Liko.Tool = { version: MOD_Version, Destroy: destroy };
    initialize().catch(error => { console.error('[LT] Initialization failed:', error); destroy(); });
})();
