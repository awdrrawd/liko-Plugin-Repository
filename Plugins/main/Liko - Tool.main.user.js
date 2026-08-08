// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      2.1.0
// @description  Bondage Club - Likolisu's tool (R121 Compatible) + UI Panel + 角色选择器 + Canvas SVG图标 + 拖拽排序 + 主题自定义 + 无视绑缚 + 无视衣物阻挡 + 勿扰模式 + 说话总是OOC
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_ChatRoomButtons.js
// @run-at       document-end
// ==/UserScript==

/*
 * 原作者 (Original Author): Liko (Likolisu)
 *   脚本原始版本由 Liko 开发，感谢 Liko 提供如此优秀的工具！
 */

// ── 防重複加载 guard ──────────────────────────────────────────────────────────

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_Version = "2.1.2";
    if (window.Liko.LT) return;
    window.Liko.LT = MOD_Version;
    let modApi = null;

    const rpBtnX    = 955;
    const rpBtnY    = 855;
    const rpBtnSize = 45;
    const rpIconUrl = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/likorp.png";

    const TOGGLE_MSG_MS = 5000; // 所有开关提示讯息 5 秒后消失

    /* ── 工具面板默认锚点（触发按钮已移至 #chat-room-buttons）── */
    const TOOL_BTN_X = 955;
    const TOOL_BTN_Y = 555;
    const STORAGE_TOOL_PANEL = 'likoTool_ui_panel';
    const STORAGE_TOOL_THEME = 'likoTool_theme';
    const STORAGE_TOOL_ORDER = 'likoTool_btn_order';
    let toolPanelEl = null;
    let toolPanelVisible = false;
    let _toolDragging = false;
    let actionGridEl = null;
    // 手机式导航：页面栈 + 视口/头部引用
    let phonePages = [];
    let phoneViewportEl = null;
    let phoneHeaderEls = null;

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
    };

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
    };
    const BADGE_COLOR = { dnd: '#d03030', free: '#2d8bc4' };
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
        { id: 'purple', name: '紫', accent: '#8b2dc4', accentDark: '#3a1070', accentLight: '#a060e0' },
        { id: 'blue',   name: '蓝', accent: '#2d6bc4', accentDark: '#103a70', accentLight: '#6090e0' },
        { id: 'teal',   name: '青', accent: '#1aaa88', accentDark: '#0a6048', accentLight: '#40c8a8' },
        { id: 'pink',   name: '粉', accent: '#c42d8b', accentDark: '#70103a', accentLight: '#e060a0' },
        { id: 'orange', name: '橙', accent: '#c47b2d', accentDark: '#704010', accentLight: '#e0a060' },
        { id: 'red',    name: '红', accent: '#c42d2d', accentDark: '#701010', accentLight: '#e06060' },
    ];

    // ════════════════════════════════════════════════════════════════════════
    // 主题系统
    // ════════════════════════════════════════════════════════════════════════
    function loadTheme() {
        try {
            const s = localStorage.getItem(STORAGE_TOOL_THEME);
            if (s) {
                const parsed = JSON.parse(s);
                if (parsed && parsed.mode && parsed.accentId) return parsed;
            }
        } catch (_) {}
        return { mode: 'dark', accentId: 'purple' };
    }

    function saveTheme(theme) {
        try { localStorage.setItem(STORAGE_TOOL_THEME, JSON.stringify(theme)); } catch (_) {}
    }

    let currentTheme = loadTheme();

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
                '#lt-quick-panel,.lt-panel{',
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
                '#lt-quick-panel,.lt-panel{',
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

        document.querySelectorAll('#lt-quick-panel,.lt-panel').forEach(function(el) {
            if (currentTheme.mode === 'light') el.classList.add('lt-light');
            else el.classList.remove('lt-light');
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 按钮顺序系统
    // ════════════════════════════════════════════════════════════════════════
    function loadBtnOrder() {
        try {
            var s = localStorage.getItem(STORAGE_TOOL_ORDER);
            if (s) {
                var order = JSON.parse(s);
                var validIds = ALL_ACTIONS.map(function(a) { return a.id; });
                if (Array.isArray(order) && order.length === validIds.length && order.every(function(id) { return validIds.includes(id); })) {
                    return order;
                }
            }
        } catch (_) {}
        return ALL_ACTIONS.map(function(a) { return a.id; });
    }

    function saveBtnOrder(order) {
        try { localStorage.setItem(STORAGE_TOOL_ORDER, JSON.stringify(order)); } catch (_) {}
    }

    function getOrderedActions() {
        var order = loadBtnOrder();
        return order.map(function(id) {
            return ALL_ACTIONS.find(function(a) { return a.id === id; });
        }).filter(Boolean);
    }

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
            heightFixOn:     "拉高功能已启用（趴跪姿自动拉高）",
            heightFixOff:    "拉高功能已停用",
            heightLockOn:    "身高锁定已启用（强制身高为标准值）",
            heightLockOff:   "身高锁定已停用",
            fhOn:            "无视绑缚已启用（被绑时仍可使用双手，不解开道具）",
            fhOff:           "无视绑缚已停用",
            dndOn:           "勿扰模式已启用（除自己外，任何人对你外观的编辑都会立即复原）",
            dndOff:          "勿扰模式已停用",
            dndReverted:     "{src} 对 {who} 修改了外观，但很快地复原了",
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
                "/lt heightfix         - 趴跪姿时自动拉高\n" +
                "/lt heightlock        - 锁定身高为标准值\n" +
                "/lt ooc               - 说话总是OOC（聊天/密语自动加括号转 OOC）\n" +
                "/lt dnd               - 勿扰模式（除自己外，他人对你外观的编辑立即复原）\n" +
                "/lt freehands         - 无视绑缚（被绑时仍可使用双手，不解开道具）\n" +
                "/lt ignoreblock       - 无视衣物阻挡（被遮挡的格子仍可换装、装拘束）\n" +
                "/lt geteverything     - 增强功能\n" +
                "/lt wardrobe          - 开启衣柜",

            loaded: "莉柯莉丝工具 v{v} 载入！使用 /lt help 查看说明",
        },
        en: {
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
            heightFixOn:     "Height fix enabled (auto-raise when kneeling/prone)",
            heightFixOff:    "Height fix disabled",
            heightLockOn:    "Height lock enabled (forces standard height)",
            heightLockOff:   "Height lock disabled",
            fhOn:            "Free Hands enabled (use hands while restrained, keeps items on)",
            fhOff:           "Free Hands disabled",
            dndOn:           "Do Not Disturb enabled (anyone but you editing your appearance is instantly reverted)",
            dndOff:          "Do Not Disturb disabled",
            dndReverted:     "{src} changed {who}'s appearance, but it was quickly restored",
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
                "/lt heightfix         - Auto-raise when kneeling/prone\n" +
                "/lt heightlock        - Lock height to standard value\n" +
                "/lt ooc               - Always OOC (auto-wrap chat/whisper in parentheses)\n" +
                "/lt dnd               - Do Not Disturb (others' edits to your appearance auto-revert)\n" +
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

    // ──────────────────────────────────────────
    // 等待系列
    // ──────────────────────────────────────────
    function waitForBcModSdk() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    function waitFor(condition) {
        return new Promise(resolve => {
            const check = () => {
                if (condition()) resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    // ──────────────────────────────────────────
    // 初始化 modApi
    // ──────────────────────────────────────────
    async function initializeModApi() {
        await waitForBcModSdk();
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko - tool",
                fullName: "Liko's tool",
                version: MOD_Version,
                repository: '莉柯莉絲的工具包'
            });
            console.log("🐈‍⬛ [LT] ✅ modApi 初始化完成");
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
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Toast 载入失敗"));
            document.head.appendChild(script);
        });
    }

    // ──────────────────────────────────────────
    // ExtensionSettings 存取器
    // ──────────────────────────────────────────
    function getES() {
        if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
        if (!Player.ExtensionSettings.LikoTOOL) {
            Player.ExtensionSettings.LikoTOOL = { heightFix: 0, heightLock: 0, rpBtnVisible: 0, stealthRp: 0, rpModeLocal: 0, freeHands: 0, ignoreBlock: 0, dnd: 0, alwaysOOC: 0 };
        }
        const s = Player.ExtensionSettings.LikoTOOL;
        if (typeof s.heightFix        === 'undefined') s.heightFix        = 0;
        if (typeof s.heightLock       === 'undefined') s.heightLock       = 0;
        if (typeof s.rpBtnVisible     === 'undefined') s.rpBtnVisible     = 0;
        if (typeof s.stealthRp        === 'undefined') s.stealthRp        = 0;
        if (typeof s.rpModeLocal      === 'undefined') s.rpModeLocal      = 0;
        if (typeof s.freeHands        === 'undefined') s.freeHands        = 0;
        if (typeof s.ignoreBlock      === 'undefined') s.ignoreBlock      = 0;
        if (typeof s.dnd              === 'undefined') s.dnd              = 0;
        if (typeof s.alwaysOOC        === 'undefined') s.alwaysOOC        = 0;
        return s;
    }

    function saveES() {
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync("LikoTOOL");
        }
    }

    // ──────────────────────────────────────────
    // 初始化储存
    // ──────────────────────────────────────────
    function initializeStorage() {
        if (!Player.LikoTool) {
            Player.LikoTool = { bypassActivities: false };
        }
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) {
            Player.OnlineSharedSettings.LikoTOOL = { RPmode: 0 };
        }
        const oss = Player.OnlineSharedSettings.LikoTOOL;
        if (typeof oss.RPmode    === 'undefined') oss.RPmode    = 0;
        if (typeof oss.DND       === 'undefined') oss.DND       = 0; // 广播：勿扰徽章
        if (typeof oss.FreeHands === 'undefined') oss.FreeHands = 0; // 广播：无视绑缚徽章
        getES();
        // 把本地持久化的开关镜像到广播设定，让重登后徽章状态一致
        oss.DND       = getES().dnd === 1 ? 1 : 0;
        oss.FreeHands = getES().freeHands === 1 ? 1 : 0;
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
                : Player.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
        }
        return character.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
    }

    function setRpMode(enabled) {
        const s = getES();
        if (s.stealthRp === 1) {
            s.rpModeLocal = enabled ? 1 : 0;
            saveES();
        } else {
            if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
            if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
            Player.OnlineSharedSettings.LikoTOOL.RPmode = enabled ? 1 : 0;
            if (typeof ServerAccountUpdate?.QueueData === 'function') {
                ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
            }
        }
        if (typeof window.__LT_updateToggles === 'function') window.__LT_updateToggles();
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

    // 把某个本地开关镜像到 OnlineSharedSettings 并广播（让别人看得到徽章）
    function broadcastShared(key, enabled) {
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
        Player.OnlineSharedSettings.LikoTOOL[key] = enabled ? 1 : 0;
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
    }

    // ──────────────────────────────────────────
    // 身高系統
    // ──────────────────────────────────────────
    let heightTargetChar = null;

    const GROUND_POSES = ['Kneel', 'Hogtied', 'AllFours', 'Suspension', 'KneelingSpread'];

    function isGroundPose(C) {
        if (!C) return false;
        const poses  = C.ActivePose || [];
        const drawPM = C.DrawPoseMapping || C.PoseMapping || {};
        return GROUND_POSES.some(p =>
            poses.includes(p) || Object.values(drawPM).includes(p)
        );
    }

    function _ltGetRealRatio(C) {
        return Object.prototype.hasOwnProperty.call(C, '_ltRealHeightRatio')
            ? C._ltRealHeightRatio
            : C.HeightRatio;
    }
    function _ltGetRealModifier(C) {
        return Object.prototype.hasOwnProperty.call(C, '_ltRealHeightModifier')
            ? C._ltRealHeightModifier
            : C.HeightModifier;
    }

    function _ltClearHeightDefine(C) {
        const r = _ltGetRealRatio(C);
        const m = _ltGetRealModifier(C);
        try { delete C.HeightRatio;    } catch (e) {}
        try { delete C.HeightModifier; } catch (e) {}
        delete C._ltRealHeightRatio;
        delete C._ltRealHeightModifier;
        delete C._ltHeightLocked;
        delete C._ltHeightFixed;
        C.HeightRatio    = r;
        C.HeightModifier = m;
    }

    function applyHeightLock(C) {
        if (!C || C._ltHeightLocked) return;
        if (C._ltHeightFixed) _ltClearHeightDefine(C);
        const realRatio    = _ltGetRealRatio(C);
        const realModifier = _ltGetRealModifier(C);
        try { delete C.HeightRatio;    } catch (e) {}
        try { delete C.HeightModifier; } catch (e) {}
        C._ltRealHeightRatio    = realRatio;
        C._ltRealHeightModifier = realModifier;
        Object.defineProperty(C, 'HeightRatio', {
            get()  { const r = this._ltRealHeightRatio; return (r < 0.8 || r > 1) ? 1.0 : r; },
            set(v) { this._ltRealHeightRatio = v; },
            configurable: true, enumerable: true
        });
        Object.defineProperty(C, 'HeightModifier', {
            get()  { return 0; },
            set(v) { this._ltRealHeightModifier = v; },
            configurable: true, enumerable: true
        });
        C._ltHeightLocked = true;
        console.log("🐈‍⬛ [LT] heightlock 套用 → " + C.Name);
    }

    function applyHeightFix(C) {
        if (!C || C._ltHeightFixed || C._ltHeightLocked) return;
        const realRatio    = _ltGetRealRatio(C);
        const realModifier = _ltGetRealModifier(C);
        try { delete C.HeightRatio;    } catch (e) {}
        try { delete C.HeightModifier; } catch (e) {}
        C._ltRealHeightRatio    = realRatio;
        C._ltRealHeightModifier = realModifier;
        Object.defineProperty(C, 'HeightRatio', {
            get()  { return isGroundPose(this) ? 1.0 : this._ltRealHeightRatio; },
            set(v) { this._ltRealHeightRatio = v; },
            configurable: true, enumerable: true
        });
        Object.defineProperty(C, 'HeightModifier', {
            get()  { return isGroundPose(this) ? 0 : this._ltRealHeightModifier; },
            set(v) { this._ltRealHeightModifier = v; },
            configurable: true, enumerable: true
        });
        C._ltHeightFixed = true;
        console.log("🐈‍⬛ [LT] heightfix 套用 → " + C.Name);
    }

    function removeHeightHijack(C) {
        if (!C || (!C._ltHeightLocked && !C._ltHeightFixed)) return;
        _ltClearHeightDefine(C);
        console.log("🐈‍⬛ [LT] 身高还原 → " + C.Name);
    }

    function applyHeightToTarget(C) {
        if (!C) return;
        const s = getES();
        if (s.heightLock === 1)     applyHeightLock(C);
        else if (s.heightFix === 1) applyHeightFix(C);
    }

    // ──────────────────────────────────────────
    // Canvas：绘制头顶状态徽章（从固定高度往下堆叠；只画开启的，顺序 RP > 勿扰 > 无视绑缚）
    // ──────────────────────────────────────────
    function drawStateBadges(C, CharX, CharY, Zoom) {
        const keys = [];
        if (getRpMode(C))         keys.push('rp');
        if (getDndMode(C))        keys.push('dnd');
        if (getFreeHandsShared(C)) keys.push('free');
        if (!keys.length) return;
        const baseY = (C.IsKneeling && C.IsKneeling()) ? 300 : 40; // 固定锚点：跪姿往下移
        const x = CharX + 340 * Zoom;
        const size = 45 * Zoom;
        const step = 55 * Zoom;
        keys.forEach((key, i) => {
            const y = CharY + baseY * Zoom + i * step;
            if (key === 'rp') DrawImageResize(rpIconUrl, x, y, size, 50 * Zoom); // RP 沿用原本 PNG 徽章
            else drawBadgeDisc(key, x, y, size);
        });
    }

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
        if (Player.LikoTool?.bypassActivities) return true;
        return typeof ServerChatRoomGetAllowItem === "function"
            ? ServerChatRoomGetAllowItem(Player, target)
            : true;
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
            ".lt-panel,.lt-panel *,#lt-quick-panel,#lt-quick-panel *{box-sizing:border-box;font-family:'Noto Sans TC',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;user-select:none;-webkit-user-select:none;}",

            // ═══ 弹窗 Panel ════════════════════════════════════════════════════
            ".lt-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);min-width:340px;max-width:600px;max-height:90vh;background:var(--lt-bg,rgba(14,18,30,0.98));backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);border:1px solid var(--lt-border,rgba(255,255,255,0.08));border-radius:18px;z-index:99999;display:flex;flex-direction:column;box-shadow:0 2px 4px rgba(0,0,0,0.2),0 8px 32px rgba(0,0,0,0.4),0 24px 64px var(--lt-shadow,rgba(0,0,0,0.5)),inset 0 1px 0 rgba(255,255,255,0.06),0 0 0 1px var(--lt-accent-glow,transparent);color:var(--lt-text,#d8e6f8);font-size:13px;overflow:hidden;animation:lt-modal-in 0.22s cubic-bezier(0.16,1,0.3,1);}",
            "@keyframes lt-modal-in{from{opacity:0;transform:translate(-50%,-50%) scale(0.93)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}",

            // ── Modal Header ──
            ".lt-header{background:var(--lt-header-grad);padding:13px 18px;display:flex;align-items:center;justify-content:space-between;cursor:grab;flex-shrink:0;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.15);}",
            ".lt-header:active{cursor:grabbing;}",
            ".lt-header::before{content:'';position:absolute;top:0;left:-100%;width:40%;height:100%;background:linear-gradient(to right,transparent,rgba(255,255,255,0.1),transparent);animation:lt-shimmer 6s ease-in-out infinite;pointer-events:none;}",
            "@keyframes lt-shimmer{0%{transform:translateX(0)}100%{transform:translateX(600%)}}",
            ".lt-title{font-size:13px;font-weight:600;color:#fff;position:relative;z-index:1;letter-spacing:0.03em;text-shadow:0 1px 2px rgba(0,0,0,0.2);}",
            ".lt-hclose{background:rgba(255,255,255,0.1);border:none;border-radius:7px;color:#fff;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);position:relative;z-index:1;flex-shrink:0;padding:0;box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);}",
            ".lt-hclose:hover{background:rgba(255,255,255,0.2);box-shadow:inset 0 1px 0 rgba(255,255,255,0.15),0 0 8px rgba(255,255,255,0.08);}",
            ".lt-hclose:active{transform:scale(0.9);}",
            ".lt-hclose svg{width:14px;height:14px;}",

            // ── Modal Content ──
            ".lt-content{padding:16px 18px 8px;overflow-y:auto;overflow-x:hidden;flex:1;scrollbar-width:thin;scrollbar-color:var(--lt-scrollbar,rgba(139,45,196,0.4)) transparent;}",
            ".lt-content::-webkit-scrollbar{width:4px;}",
            ".lt-content::-webkit-scrollbar-thumb{background:var(--lt-scrollbar,rgba(139,45,196,0.4));border-radius:2px;}",
            ".lt-content::-webkit-scrollbar-track{background:transparent;}",
            ".lt-section{margin-bottom:12px;}",
            ".lt-hr{height:1px;background:var(--lt-border,rgba(255,255,255,0.05));margin:4px 0 12px;}",

            // ── Button List (modal) ──
            ".lt-btn-list{display:flex;flex-direction:column;gap:6px;}",
            ".lt-list-btn{width:100%;padding:11px 14px;text-align:left;background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.04)),rgba(255,255,255,0.01));border:1px solid var(--lt-border,rgba(255,255,255,0.06));border-radius:10px;color:var(--lt-text-secondary,#b8c8e0);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            ".lt-list-btn:hover{background:linear-gradient(180deg,var(--lt-surface-hover),var(--lt-surface,rgba(255,255,255,0.02)));border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 2px 8px var(--lt-accent-glow);}",
            ".lt-list-btn:active{transform:scale(0.985);}",
            ".lt-list-btn.selected{background:var(--lt-surface-hover);border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 0 0 1px var(--lt-border-hover);}",
            ".lt-list-btn .lt-check{font-size:14px;color:var(--lt-accent);opacity:0.2;transition:opacity 0.18s;}",
            ".lt-list-btn.selected .lt-check{opacity:1;}",

            // ── Undo Meta ──
            ".lt-undo-meta{background:var(--lt-surface,rgba(255,255,255,0.03));border:1px solid var(--lt-border,rgba(255,255,255,0.05));border-radius:10px;padding:11px 13px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.02);}",
            ".lt-undo-meta-row{font-size:11px;color:var(--lt-text-dim,#6a8ab0);margin-bottom:4px;}",
            ".lt-undo-meta-row:last-child{margin-bottom:0;}",
            ".lt-undo-meta-row span{color:var(--lt-accent-light,#a0c0e8);font-weight:500;}",

            // ── Nav Buttons ──
            ".lt-nav-btn{flex:1;padding:9px 4px;background:linear-gradient(180deg,var(--lt-surface,rgba(255,255,255,0.04)),rgba(255,255,255,0.01));border:1px solid var(--lt-border,rgba(255,255,255,0.06));border-radius:9px;color:var(--lt-text-dim,#6a6a9a);font-size:11px;cursor:pointer;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;display:flex;align-items:center;justify-content:center;gap:4px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.03);}",
            ".lt-nav-btn svg{width:12px;height:12px;}",
            ".lt-nav-btn:hover:not(:disabled){background:var(--lt-surface-hover);border-color:var(--lt-border-hover);color:var(--lt-accent-light);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 2px 6px var(--lt-accent-glow);}",
            ".lt-nav-btn:disabled{opacity:0.25;cursor:not-allowed;}",

            // ── Footer ──
            ".lt-footer{display:flex;gap:8px;padding:12px 18px;background:rgba(0,0,0,0.15);flex-shrink:0;border-top:1px solid var(--lt-border,rgba(255,255,255,0.04));box-shadow:inset 0 1px 0 rgba(0,0,0,0.1);}",
            ".lt-btn{flex:1;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.18s cubic-bezier(0.16,1,0.3,1);font-family:inherit;}",
            ".lt-btn-primary{background:var(--lt-header-grad);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,0.15),0 2px 8px rgba(0,0,0,0.2);}",
            ".lt-btn-primary:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,0.2),0 4px 16px var(--lt-accent-glow),0 2px 8px rgba(0,0,0,0.2);filter:brightness(1.08);}",
            ".lt-btn-primary:active{transform:scale(0.97);}",
            ".lt-btn-secondary{background:linear-gradient(180deg,var(--lt-surface-2,rgba(255,255,255,0.06)),rgba(255,255,255,0.02));color:var(--lt-text-dim,#5a7a9a);border:1px solid var(--lt-border,rgba(255,255,255,0.06));box-shadow:inset 0 1px 0 rgba(255,255,255,0.04);}",
            ".lt-btn-secondary:hover{background:var(--lt-surface-hover);color:var(--lt-text-secondary);border-color:var(--lt-border-hover);}",
            ".lt-btn-secondary:active{transform:scale(0.97);}",
            ".lt-empty{text-align:center;color:var(--lt-text-dim,#4a6a8a);font-size:13px;padding:20px 0;}",

            // ═══ 快捷面板 Quick Panel ═══════════════════════════════════════════
            "#lt-quick-panel{position:fixed;z-index:99998;width:340px;height:min(88vh,680px);display:flex;flex-direction:column;border-radius:26px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.15),0 12px 32px rgba(0,0,0,0.4),0 28px 72px var(--lt-shadow,rgba(0,0,0,0.5)),inset 0 1px 0 rgba(255,255,255,0.08),0 0 0 1px var(--lt-accent-glow,transparent);background:var(--lt-bg,rgba(14,18,30,0.98));backdrop-filter:blur(28px) saturate(1.4);-webkit-backdrop-filter:blur(28px) saturate(1.4);border:1px solid var(--lt-border,rgba(255,255,255,0.08));opacity:0;transform:scale(0.96) translateY(8px);pointer-events:none;transition:opacity 0.22s ease,transform 0.22s cubic-bezier(0.16,1,0.3,1);}",
            "#lt-quick-panel.show{opacity:1;transform:scale(1) translateY(0);pointer-events:auto;}",
            "#lt-quick-panel.lt-light{backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);}",
            // ── Phone 导航：视口 + 滑动页面 ──
            "#lt-quick-panel .ltp-viewport{position:relative;flex:1;overflow:hidden;min-height:0;}",
            "#lt-quick-panel .ltp-page{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--lt-bg,rgba(14,18,30,0.98));transition:transform 0.28s cubic-bezier(0.16,1,0.3,1);will-change:transform;}",
            "#lt-quick-panel .ltp-page.ltp-enter{transform:translateX(100%);}",
            "#lt-quick-panel .ltp-page.ltp-leave{transform:translateX(100%);}",
            "#lt-quick-panel .ltp-home{transform:none!important;}",

            // ── Quick Panel Header ──
            "#lt-quick-panel .ltq-hdr{background:var(--lt-header-grad);color:#fff;font-size:13px;font-weight:600;padding:8px 12px;cursor:move;display:flex;align-items:center;justify-content:space-between;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.15);}",
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
            "#lt-quick-panel .ltq-body{padding:10px;display:flex;flex-direction:column;gap:3px;flex:1;min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--lt-scrollbar,rgba(139,45,196,0.35)) transparent;}",
            "#lt-quick-panel .ltq-body::-webkit-scrollbar{width:3px;}",
            "#lt-quick-panel .ltq-body::-webkit-scrollbar-thumb{background:var(--lt-scrollbar,rgba(139,45,196,0.35));border-radius:2px;}",

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
            "#lt-quick-panel .ltq-action .ltq-grip{position:absolute;top:4px;right:4px;width:12px;height:12px;opacity:0;transition:opacity 0.18s;color:var(--lt-text-faint,#4a5a7a);cursor:grab;}",
            "#lt-quick-panel .ltq-action .ltq-grip svg{width:100%;height:100%;}",
            "#lt-quick-panel .ltq-action:hover .ltq-grip{opacity:0.45;}",
            "#lt-quick-panel .ltq-action .ltq-grip:active{cursor:grabbing;}",

            // ── Drag-over state ──
            "#lt-quick-panel .ltq-action.ltq-drag-over{border-color:var(--lt-accent);border-style:dashed;background:var(--lt-surface-hover);transform:scale(1.04);box-shadow:0 0 0 2px var(--lt-accent-glow),0 4px 16px var(--lt-accent-glow);}",
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

            // ═══ Edit button (toggle row) ═════════════════════════════════════
            "#lt-quick-panel .ltq-edit-btn{width:20px;height:20px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--lt-text-dim);cursor:pointer;opacity:0.5;transition:opacity 0.18s;padding:0;flex-shrink:0;}",
            "#lt-quick-panel .ltq-edit-btn:hover{opacity:1;color:var(--lt-accent);}",
            "#lt-quick-panel .ltq-edit-btn svg{width:14px;height:14px;}",

            // ═══ Release Maid word chips ═════════════════════════════════════
            ".lt-rm-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:7px;font-size:11px;font-weight:500;line-height:1.4;white-space:nowrap;}",
            ".lt-rm-default{background:var(--lt-surface-2);color:var(--lt-text-dim);border:1px solid var(--lt-border);}",
            ".lt-rm-custom{background:var(--lt-surface-hover);color:var(--lt-accent-light);border:1px solid var(--lt-border-hover);cursor:default;}",
            ".lt-rm-tag{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.6;padding:1px 3px;border-radius:3px;background:rgba(255,255,255,0.08);}",
            ".lt-rm-del{cursor:pointer;font-size:14px;line-height:1;opacity:0.5;transition:opacity 0.15s;padding:0 0 0 2px;}",
            ".lt-rm-del:hover{opacity:1;color:var(--lt-accent);}",
        ].join("\n");
        document.head.appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 所有动作定义（含 SVG 图标）
    // ════════════════════════════════════════════════════════════════════════
    const ALL_ACTIONS = [
        { id: 'free',      icon: SVG.free,      label: '解除束缚', title: '选择性移除束缚物品（可全选）', fn: async function() {
            const target = await requestCharacter('选择要解除束缚的目标');
            if (target) free(getNickname(target));
        }},
        { id: 'undo',      icon: SVG.undo,      label: '回滚',    title: '回滚外观到之前的状态', fn: async function() {
            const target = await requestCharacter('选择要回滚外观的目标');
            if (target) undoCommand(getNickname(target));
        }},
        { id: 'lock',      icon: SVG.lock,      label: '上锁',    title: '为束缚添加锁', fn: async function() {
            const target = await requestCharacter('选择要上锁的目标');
            if (!target) return;
            const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
            if (!itemMiscGroup) { ChatRoomSendLocal('无法获取锁类型列表'); return; }
            const validLocks = itemMiscGroup.Asset.filter(a => a.IsLock).map(a => ({ Name: a.Name, Description: a.Description || a.Name }));
            if (!validLocks.length) { ChatRoomSendLocal('没有可用的锁类型'); return; }
            const lockOpts = validLocks.map(l => ({ text: l.Description }));
            const selectedLock = await requestButtons('选择锁类型', lockOpts, false);
            if (!selectedLock) return;
            const lock = validLocks.find(l => l.Description === selectedLock);
            if (!lock) return;
            fullLock(getNickname(target) + ' ' + lock.Name);
        }},
        { id: 'unlock',    icon: SVG.unlock,    label: '解锁',  title: '选择要解除的锁（跳过主人/恋人/拓展锁）', fn: async function() {
            const target = await requestCharacter('选择要解锁的目标');
            if (target) fullUnlock(getNickname(target));
        }},
        { id: 'editcraft', icon: SVG.craftEdit, label: '编辑订制属性', title: '批量编辑束缚的订制属性（名称/描述/私有）', fn: async function() {
            const target = await requestCharacter('选择要编辑属性的目标');
            if (target) editCraftBatch(target);
        }},
        { id: 'clearcraft',icon: SVG.craftClear,label: '清除订制属性', title: '清除对象身上所有束缚的订制属性', fn: async function() {
            const target = await requestCharacter('选择要清除订制属性的目标');
            if (target) clearAllCraft(target);
        }},
        { id: 'wardrobe',  icon: SVG.wardrobe,  label: '衣柜',    title: '打开衣柜', fn: function() { wardrobe(); } },
        { id: 'bcx',       icon: SVG.bcx,       label: 'BCX导入', title: '从剪贴板导入 BCX 外观', fn: async function() {
            const target = await requestCharacter('选择要导入外观的目标');
            if (target) bcxImport(getNickname(target));
        }},
        { id: 'struggle',  icon: SVG.struggle,  label: '挣扎',    title: 'LSCG 挣脱指令', fn: function() { execChatCommand('/lscg escape'); } },
        { id: 'enhance',   icon: SVG.enhance,   label: '增强',    title: '获取道具/金钱/技能', fn: function() { getEverything(); } },
    ];

    // ════════════════════════════════════════════════════════════════════════
    // 工具快捷面板 — v2.1 SVG图标 + 拖拽排序 + 主题
    // ════════════════════════════════════════════════════════════════════════
    function loadToolPanelPos() {
        try {
            const s = localStorage.getItem(STORAGE_TOOL_PANEL);
            if (s) return JSON.parse(s);
        } catch (_) {}
        return { x: TOOL_BTN_X, y: TOOL_BTN_Y + 55 };
    }
    function saveToolPanelPos() {
        try { localStorage.setItem(STORAGE_TOOL_PANEL, JSON.stringify(toolPanelPos)); } catch (_) {}
    }
    let toolPanelPos = loadToolPanelPos();

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

    // ── 手机式页面导航 ──────────────────────────────────────────────
    function updatePhoneHeader() {
        if (!phoneHeaderEls || !toolPanelEl) return;
        if (phonePages.length > 0) {
            toolPanelEl.classList.add('ltp-sub');
            phoneHeaderEls.title.textContent = phonePages[phonePages.length - 1].title || '';
            phoneHeaderEls.settings.style.display = 'none';
        } else {
            toolPanelEl.classList.remove('ltp-sub');
            phoneHeaderEls.title.textContent = phoneHeaderEls.homeTitle;
            phoneHeaderEls.settings.style.display = '';
        }
    }

    // 推入一个子页面（内容 + 可选底栏）；返回页面元素，其 .remove() 会以“程序方式”弹出（不触发 onClose）
    function pushPage(titleText, contentEl, footerEl, onClose) {
        ensureToolPanel();
        const page = document.createElement('div');
        page.className = 'ltp-page ltp-enter';
        const content = document.createElement('div');
        content.className = 'lt-content';
        content.appendChild(contentEl);
        page.appendChild(content);
        if (footerEl) {
            const f = document.createElement('div');
            f.className = 'lt-footer';
            f.appendChild(footerEl);
            page.appendChild(f);
        }
        phoneViewportEl.appendChild(page);
        void page.offsetWidth;                 // 强制 reflow，触发滑入过渡
        page.classList.remove('ltp-enter');
        phonePages.push({ el: page, title: titleText, onClose: onClose || null, settled: false });
        updatePhoneHeader();
        page.remove = function () { popPage(page, false); };
        return page;
    }

    // 弹出页面。invokeOnClose=true 时（返回键 / 关闭）调用其 onClose 以结算等待中的 Promise
    function popPage(pageEl, invokeOnClose) {
        const idx = phonePages.findIndex(p => p.el === pageEl);
        if (idx === -1) return;
        const entry = phonePages[idx];
        if (invokeOnClose && !entry.settled && typeof entry.onClose === 'function') {
            entry.settled = true;
            try { entry.onClose(); } catch (e) {}
        }
        phonePages.splice(idx, 1);
        pageEl.classList.add('ltp-leave');
        setTimeout(function () { if (pageEl.parentNode) pageEl.parentNode.removeChild(pageEl); }, 300);
        updatePhoneHeader();
    }

    function phoneBack() {
        if (!phonePages.length) return;
        popPage(phonePages[phonePages.length - 1].el, true);
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
        backBtn.title = isZh() ? '返回' : 'Back';
        backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

        var titleSpan = document.createElement('span');
        titleSpan.className = 'ltq-title';
        titleSpan.textContent = isZh() ? '工具箱' : 'Toolbox';

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

        hdrBtns.appendChild(settingsBtn);
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
        phoneHeaderEls = { back: backBtn, title: titleSpan, settings: settingsBtn, close: closeBtn, homeTitle: (isZh() ? '工具箱' : 'Toolbox') };
        phonePages = [];

        // ── Action Grid (2-column, draggable) ──
        actionGridEl = document.createElement('div');
        actionGridEl.className = 'ltq-grid';
        body.appendChild(actionGridEl);
        rebuildActionGrid();

        // ── Toggle Section ──
        const sectionLabel = document.createElement('div');
        sectionLabel.className = 'ltq-section';
        sectionLabel.textContent = isZh() ? '开关' : 'Toggles';
        body.appendChild(sectionLabel);

        const toggleBtnRefs = {};

        const toggles = [
            { icon: SVG.rp,        label: isZh() ? 'RP模式'  : 'RP Mode',    title: isZh() ? '开启后屏蔽游戏 Action 消息' : 'Block game Action messages', toggle: 'rp', fn: function() { rpmode(); updateToggleBtns(); } },
            { icon: SVG.dnd,       label: isZh() ? '勿扰模式' : 'Do Not Disturb', title: isZh() ? '除自己外，任何人对你外观的编辑（换衣/拘束）都会立即复原' : 'Anyone but you editing your appearance is instantly reverted', toggle: 'dnd', fn: function() { dndCommand(); updateToggleBtns(); } },
            { icon: SVG.free,      label: isZh() ? '无视绑缚' : 'Free Hands', title: isZh() ? '被绑缚时仍可使用双手（不会实际解开道具）' : 'Use hands while restrained (does not remove items)', toggle: 'freeHands', fn: function() { freeHandsCommand(); updateToggleBtns(); } },
            { icon: SVG.ignoreBlock,label: isZh() ? '无视衣物阻挡' : 'Ignore Clothing Block', title: isZh() ? '被服装/道具遮挡的格子仍可换装、装拘束（不必先脱）' : 'Equip on slots covered by clothing/items (no need to strip first)', toggle: 'ignoreBlock', fn: function() { ignoreBlockCommand(); updateToggleBtns(); } },
            { icon: SVG.heightFix, label: isZh() ? '拉高'    : 'Height Fix', title: isZh() ? '趴跪姿时自动拉高视角' : 'Auto-raise when kneeling/prone', toggle: 'heightFix', fn: function() { heightFixCommand(); updateToggleBtns(); } },
            { icon: SVG.heightLock,label: isZh() ? '身高锁'  : 'Height Lock',title: isZh() ? '强制身高为标准值' : 'Force standard height', toggle: 'heightLock', fn: function() { heightLockCommand(); updateToggleBtns(); } },
            { icon: SVG.ooc,       label: isZh() ? '说话总是OOC' : 'Always OOC', title: isZh() ? '聊天/密语时自动加括号转为 OOC（不会被口塞乱码）' : 'Auto-wrap chat/whisper in parentheses as OOC', toggle: 'alwaysOOC', fn: function() { oocCommand(); updateToggleBtns(); } },
            { icon: SVG.rpBtn,     label: isZh() ? '显示RP按钮' : 'Show RP Btn', title: isZh() ? '在游戏画面显示 RP 切换按钮' : 'Show RP toggle button on canvas', toggle: 'rpBtn', fn: function() { rpbtn(); updateToggleBtns(); } },
        ];

        toggles.forEach(function(tg) {
            const row = document.createElement('div');
            row.className = 'ltq-toggle';
            row.title = tg.title;

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

            toggleBtnRefs[tg.toggle] = { sw: sw, row: row };
            updateToggleState(toggleBtnRefs[tg.toggle], tg.toggle);

            row.addEventListener('click', tg.fn);
            body.appendChild(row);
        });

        function updateToggleState(ref, key) {
            var isOn = false;
            if (key === 'rp') isOn = getRpMode(Player);
            else if (key === 'dnd') isOn = getES().dnd === 1;
            else if (key === 'rpBtn') isOn = getES().rpBtnVisible === 1;
            else if (key === 'heightFix') isOn = getES().heightFix === 1;
            else if (key === 'heightLock') isOn = getES().heightLock === 1;
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
        window.__LT_updateToggles = updateToggleBtns;

        // ── Assemble ──
        toolPanelEl.appendChild(hdr);
        toolPanelEl.appendChild(viewport);
        document.body.appendChild(toolPanelEl);
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

        hdr.addEventListener('mousedown', function (e) {
            if (e.target.closest('.ltq-icon-btn') || e.target.closest('.ltq-back')) return;
            drag.on = true;
            drag.dx = e.clientX - toolPanelEl.offsetLeft;
            drag.dy = e.clientY - toolPanelEl.offsetTop;
            _toolDragging = true;
            e.preventDefault();
        });

        document.addEventListener('mousemove', function (e) {
            if (!drag.on) return;
            toolPanelPos.x = e.clientX - drag.dx;
            toolPanelPos.y = e.clientY - drag.dy;
            toolPanelEl.style.left = toolPanelPos.x + 'px';
            toolPanelEl.style.top  = toolPanelPos.y + 'px';
        });

        document.addEventListener('mouseup', function () {
            if (drag.on) {
                drag.on = false;
                _toolDragging = false;
                saveToolPanelPos();
            }
        });

        // ── ESC：有子页面则返回，否则关闭 ──
        document.addEventListener('keydown', function(e) {
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
        actionGridEl.innerHTML = '';
        var dragSrc = null;

        var orderedActions = getOrderedActions();
        orderedActions.forEach(function(a) {
            var btn = document.createElement('div');
            btn.className = 'ltq-action';
            btn.title = a.title;
            btn.dataset.id = a.id;
            btn.draggable = true;

            var iconEl = document.createElement('span');
            iconEl.className = 'ltq-action-icon';
            iconEl.innerHTML = a.icon;

            var labelEl = document.createElement('span');
            labelEl.className = 'ltq-label';
            labelEl.textContent = a.label;

            var gripEl = document.createElement('span');
            gripEl.className = 'ltq-grip';
            gripEl.innerHTML = SVG.grip;

            btn.appendChild(iconEl);
            btn.appendChild(labelEl);
            btn.appendChild(gripEl);

            // Click action
            btn.addEventListener('click', function(e) {
                if (btn.dataset.dragged === '1') {
                    btn.dataset.dragged = '';
                    return;
                }
                a.fn();
            });

            // Drag-and-drop
            btn.addEventListener('dragstart', function(e) {
                dragSrc = btn;
                btn.classList.add('ltq-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', a.id);
            });

            btn.addEventListener('dragend', function() {
                btn.classList.remove('ltq-dragging');
                btn.dataset.dragged = '1';
                actionGridEl.querySelectorAll('.ltq-drag-over').forEach(function(el) {
                    el.classList.remove('ltq-drag-over');
                });
                setTimeout(function() { btn.dataset.dragged = ''; }, 50);
            });

            btn.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (btn !== dragSrc) btn.classList.add('ltq-drag-over');
            });

            btn.addEventListener('dragleave', function() {
                btn.classList.remove('ltq-drag-over');
            });

            btn.addEventListener('drop', function(e) {
                e.preventDefault();
                btn.classList.remove('ltq-drag-over');
                if (!dragSrc || dragSrc === btn) return;

                var srcId = dragSrc.dataset.id;
                var dstId = btn.dataset.id;
                var order = loadBtnOrder();
                var srcIdx = order.indexOf(srcId);
                var dstIdx = order.indexOf(dstId);
                order.splice(dstIdx, 0, order.splice(srcIdx, 1)[0]);
                saveBtnOrder(order);
                rebuildActionGrid();
            });

            actionGridEl.appendChild(btn);
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
        if (toolPanelEl) toolPanelEl.classList.remove('show');
        popAllPages(); // 关闭时回到首页，下次打开从主选单开始
    }

    function toggleToolPanel() {
        if (toolPanelVisible) hideToolPanel(); else showToolPanel();
    }

    // ════════════════════════════════════════════════════════════════════════
    // 聊天室触发按钮 — 注入到 #chat-room-buttons（顺位 9，参考 BC_ChatRoomButtons）
    // ════════════════════════════════════════════════════════════════════════
    const TOOL_CRB_ID = 'likotool';
    const TOOL_CRB_ORDER = 9;
    const TOOL_BTN_DOM_ID = 'lt-tool-trigger-btn';
    const TOOL_BTN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';

    function injectToolBtnStyle() {
        if (document.getElementById('lt-tool-btn-style')) return;
        var st = document.createElement('style');
        st.id = 'lt-tool-btn-style';
        st.textContent = [
            '#' + TOOL_BTN_DOM_ID + '.chat-room-button{border-radius:12px !important;}',
            // 只在“未收合”时套用 flex 置中；否则 display:flex!important 会盖过 [hidden] 的 display:none，
            // 导致收合按钮列时本按钮无法隐藏（收合动画期间由 BC_ChatRoomButtons 的 .lk-crb-anim 规则接手）。
            '#' + TOOL_BTN_DOM_ID + '.chat-room-button:not([hidden]){display:flex !important;align-items:center !important;justify-content:center !important;}',
            '#' + TOOL_BTN_DOM_ID + '.chat-room-button svg{width:60% !important;height:60% !important;color:#fff !important;stroke:#fff !important;}',
        ].join('\n');
        document.head.appendChild(st);
    }

    // 工厂函式：每次(重)建按钮都会被协调器呼叫、回传一颗全新按钮（自带样式注入）。
    function createToolButton() {
        injectToolBtnStyle();
        var btn = document.createElement('button');
        btn.id = TOOL_BTN_DOM_ID;
        btn.type = 'button';
        btn.className = 'blank-button button HideOnPopup chat-room-button';
        btn.setAttribute('role', 'menuitem');
        btn.title = isZh() ? '工具箱' : 'Toolbox';
        btn.style.backgroundColor = getAccentPreset().accent;
        btn.innerHTML = TOOL_BTN_SVG;
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggleToolPanel(); });
        return btn;
    }

    function startToolButtonInjector() {
        // 交给共用协调器 BC_ChatRoomButtons 中央託管（{plain:true} 关掉原生底色露出 SVG）。
        // 同步登记 spec，不绑载入时机：协调器已载入就直接 add，否则推进待处理队列等其初始化排空。
        // 协调器由本脚本的 @require 载入（见档头），standalone 也保证有。
        var spec = [TOOL_CRB_ID, TOOL_CRB_ORDER, createToolButton, { plain: true }];
        var L = window.Liko = window.Liko || {};
        if (L.__Sys_ChatRoomButtons__ && L.__Sys_ChatRoomButtons__.add) L.__Sys_ChatRoomButtons__.add.apply(null, spec);
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

        darkOption.addEventListener('click', function() {
            currentTheme.mode = 'dark';
            saveTheme(currentTheme);
            applyTheme();
            darkOption.classList.add('selected');
            lightOption.classList.remove('selected');
        });

        lightOption.addEventListener('click', function() {
            currentTheme.mode = 'light';
            saveTheme(currentTheme);
            applyTheme();
            lightOption.classList.add('selected');
            darkOption.classList.remove('selected');
        });

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
            swatch.title = preset.name;
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
        var footerEl = document.createElement('div');
        footerEl.style.cssText = 'width:100%;display:flex;gap:8px;';
        var resetBtn = document.createElement('button');
        resetBtn.className = 'lt-btn lt-btn-secondary';
        resetBtn.textContent = t('settingsReset');
        resetBtn.style.flex = '1';
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
            panel.remove();
        });

        var panel = createPanel(t('settingsTitle'), content, footerEl);
        panel.style.width = '340px';
        if (currentTheme.mode === 'light') panel.classList.add('lt-light');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 通用面板建构器 — 手机式：把内容作为“子页面”推入工具箱窗口
    //   opts.onClose：当用户以返回键/关闭键离开该页时调用一次（用于结算等待中的 Promise）；
    //   通过页面自身按钮触发的 panel.remove() 不会调用 onClose（调用方已自行 resolve）。
    // ════════════════════════════════════════════════════════════════════════
    function createPanel(titleText, contentEl, footerEl, opts) {
        injectLtStyles();
        applyTheme();
        ensureToolPanel();
        return pushPage(titleText, contentEl, footerEl, opts && opts.onClose);
    }

    // ──────────────────────────────────────────
    // 通用按鈕选单
    // ──────────────────────────────────────────
    function requestButtons(promptText, buttons, multiSelect = false) {
        return new Promise(resolve => {
            const listEl = document.createElement("div");
            listEl.className = "lt-btn-list";

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
                const textSpan = document.createElement("span");
                textSpan.style.fontFamily = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif';
                textSpan.textContent = btn.text;
                const check = document.createElement("span");
                check.className = "lt-check";
                check.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="12" cy="12" r="7"/></svg>';
                el.appendChild(textSpan);
                el.appendChild(check);

                if (multiSelect) {
                    itemEls.push({ el, text: btn.text });
                    el.onclick = () => {
                        if (selected.has(btn.text)) { selected.delete(btn.text); el.classList.remove("selected"); }
                        else { selected.add(btn.text); el.classList.add("selected"); }
                    };
                } else {
                    el.onclick = () => { panel.remove(); resolve(btn.text); };
                }
                listEl.appendChild(el);
            });

            let footerEl = null;
            if (multiSelect) {
                footerEl = document.createElement("div");
                footerEl.style.cssText = "display:flex;gap:8px;width:100%;";
                const selectAllBtn = document.createElement("button");
                selectAllBtn.className = "lt-btn lt-btn-secondary";
                selectAllBtn.textContent = t('selectAll');
                selectAllBtn.onclick = () => {
                    const allOn = selected.size === itemEls.length && itemEls.length > 0;
                    itemEls.forEach(({ el, text }) => {
                        if (allOn) { selected.delete(text); el.classList.remove("selected"); }
                        else { selected.add(text); el.classList.add("selected"); }
                    });
                };
                const cancelBtn = document.createElement("button");
                cancelBtn.className = "lt-btn lt-btn-secondary";
                cancelBtn.textContent = t('cancel');
                cancelBtn.onclick = () => { panel.remove(); resolve([]); };
                const confirmBtn = document.createElement("button");
                confirmBtn.className = "lt-btn lt-btn-primary";
                confirmBtn.textContent = t('confirm');
                confirmBtn.onclick = () => { panel.remove(); resolve([...selected]); };
                footerEl.appendChild(selectAllBtn);
                footerEl.appendChild(cancelBtn);
                footerEl.appendChild(confirmBtn);
            }

            const panel = createPanel(promptText, listEl, footerEl, {
                onClose: () => resolve(multiSelect ? [] : null)
            });
        });
    }

    /* ── 角色选择器 ── */
    function requestCharacter(title) {
        return new Promise(resolve => {
            const targets = [...(ChatRoomCharacter || [])].sort((a, b) => (b.IsPlayer?.() ? 1 : 0) - (a.IsPlayer?.() ? 1 : 0));
            if (!targets.length) {
                ChatRoomSendLocal('房间内没有玩家');
                resolve(null);
                return;
            }
            const listEl = document.createElement("div");
            listEl.className = "lt-btn-list";
            targets.forEach(target => {
                const el = document.createElement("button");
                el.className = "lt-list-btn";
                const isMe = target.IsPlayer && target.IsPlayer();
                const textSpan = document.createElement("span");
                textSpan.style.fontFamily = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif';
                textSpan.textContent = getNickname(target) + ' (#' + target.MemberNumber + ')';
                el.appendChild(textSpan);
                if (isMe) {
                    el.style.borderColor = 'var(--lt-accent)';
                    el.style.background = 'var(--lt-surface-hover)';
                }
                el.onclick = () => { panel.remove(); resolve(target); };
                listEl.appendChild(el);
            });
            const panel = createPanel(title, listEl, null, { onClose: () => resolve(null) });
        });
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
            if (!input) { ChatRoomSendLocal('找不到聊天输入框'); return; }
            input.value = cmd;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            const sendBtn = document.getElementById('ChatSend');
            if (sendBtn) { sendBtn.click(); return; }
            input.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', keyCode:13, bubbles:true, cancelable:true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key:'Enter', keyCode:13, bubbles:true, cancelable:true }));
        } catch(e) { ChatRoomSendLocal('执行命令失败: ' + e.message); }
    }

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
    // Undo 系統
    // ──────────────────────────────────────────
    const UNDO_MAX_PER_CHARACTER = 20;
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
        undoHistory[id].push({ timestamp: Date.now(), changedBy: changedByNumber ?? null, bundle });
        if (undoHistory[id].length > UNDO_MAX_PER_CHARACTER) undoHistory[id].shift();
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
        const history = undoHistory[id];
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
        topNavEl.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:10px;";
        const prevBtn = document.createElement("button");
        prevBtn.className = "lt-nav-btn";
        prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M15 18l-6-6 6-6"/></svg>' + t('undoPrev');
        prevBtn.style.flex = "1";
        const counterEl = document.createElement("div");
        counterEl.style.cssText = "flex:1;text-align:center;font-size:12px;color:var(--lt-accent);font-weight:600;white-space:nowrap;";
        const nextBtn = document.createElement("button");
        nextBtn.className = "lt-nav-btn";
        nextBtn.innerHTML = t('undoNext') + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M9 18l6-6-6-6"/></svg>';
        nextBtn.style.flex = "1";
        const metaEl = document.createElement("div");
        metaEl.className = "lt-undo-meta"; metaEl.style.marginBottom = "8px";
        const timeRow = document.createElement("div"); timeRow.className = "lt-undo-meta-row";
        const byRow   = document.createElement("div"); byRow.className   = "lt-undo-meta-row";
        metaEl.appendChild(timeRow); metaEl.appendChild(byRow);
        topNavEl.appendChild(prevBtn); topNavEl.appendChild(counterEl); topNavEl.appendChild(nextBtn);

        const canvasWrap = document.createElement("div");
        canvasWrap.style.cssText = "width:100%;display:flex;justify-content:center;align-items:center;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:12px;overflow:hidden;margin-bottom:10px;height:360px;position:relative;";
        const canvas = document.createElement("canvas");
        canvas.width = 500; canvas.height = 1000;
        canvas.style.cssText = "width:220px;height:440px;display:block;";
        canvasWrap.appendChild(canvas);

        const footerBtns = document.createElement("div");
        footerBtns.style.cssText = "width:100%;display:flex;gap:8px;";
        const applyBtn = document.createElement("button");
        applyBtn.className = "lt-btn lt-btn-primary"; applyBtn.textContent = t('undoApply'); applyBtn.style.flex = "1";
        const closeBtn = document.createElement("button");
        closeBtn.className = "lt-btn lt-btn-secondary"; closeBtn.textContent = t('close'); closeBtn.style.flex = "1";
        footerBtns.appendChild(applyBtn); footerBtns.appendChild(closeBtn);

        const contentEl = document.createElement("div");
        contentEl.appendChild(topNavEl); contentEl.appendChild(metaEl); contentEl.appendChild(canvasWrap);

        const panel = createPanel(t('undoTitle') + " — " + getNickname(target), contentEl, footerBtns);
        panel.style.width = "320px";
        closeBtn.onclick = () => panel.remove();

        function renderPreview() {
            if (!canvasCharacter) return;
            try {
                const entry = history[currentIndex];
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvasCharacter.Appearance = entry.bundle.map(b => ServerBundledItemToAppearanceItem(target.AssetFamily, b));
                CharacterRefresh(canvasCharacter);
                DrawCharacter(canvasCharacter, 40, 100, 0.85, false, ctx);
            } catch (e) { console.error("🐈‍⬛ [LT] ❌ 预览渲染失敗:", e.message); }
        }

        const renderInterval = setInterval(renderPreview, 200);
        const undoObs = new MutationObserver(() => {
            if (!document.body.contains(panel)) {
                clearInterval(renderInterval);
                try { if (canvasCharacter) CharacterDelete(canvasCharacter.ID); } catch (e) {}
                undoObs.disconnect();
            }
        });
        undoObs.observe(document.body, { childList: true, subtree: true });

        function updateMeta() {
            const entry = history[currentIndex];
            const timeStr = new Date(entry.timestamp).toLocaleString();
            const byChar  = entry.changedBy ? ChatRoomCharacter?.find(c => c.MemberNumber === entry.changedBy) : null;
            const byName  = byChar ? getNickname(byChar) : entry.changedBy ? "#" + entry.changedBy : "—";
            timeRow.innerHTML = t('undoChangedAt') + "：<span>" + timeStr + "</span>";
            byRow.innerHTML   = t('undoChangedBy') + "：<span>" + byName + "</span>";
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
            chatSendCustomAction(getNickname(Player) + " 将 " + getNickname(target) + " 的外观回滚到 " + new Date(entry.timestamp).toLocaleTimeString() + " 的状态！");
            undoHistory[id].splice(currentIndex + 1);
            panel.remove();
        };

        updateMeta();
        renderPreview();
    }

    // ──────────────────────────────────────────
    // Hooks
    // ──────────────────────────────────────────
    function setupHooks() {

        // 离开聊天室（如前往衣柜）时关闭工具箱
        safeHookFunction("CommonSetScreen", 10, (args, next) => {
            const result = next(args);
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'ChatRoom' && toolPanelVisible) {
                hideToolPanel();
            }
            return result;
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
                        getRpMode(Player) ? "Orange" : "Gray", "", "RP模式切換");
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

        // 身高：开启对话框时套用
        safeHookFunction("CharacterSetCurrent", 10, (args, next) => {
            const [C] = args;
            if (heightTargetChar && heightTargetChar !== C) {
                removeHeightHijack(heightTargetChar);
                heightTargetChar = null;
            }
            const result = next(args);
            if (C?.MemberNumber) {
                heightTargetChar = C;
                applyHeightToTarget(C);
            }
            return result;
        });

        // 身高：离开对话框时还原
        safeHookFunction("DialogLeave", 10, (args, next) => {
            if (heightTargetChar) { removeHeightHijack(heightTargetChar); heightTargetChar = null; }
            return next(args);
        });

        // Undo hooks
        safeHookFunction("ChatRoomSync", -10, (args, next) => {
            const result = next(args);
            setTimeout(scanAllCharacters, 0);
            return result;
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
    // 指令實作
    // ──────────────────────────────────────────
    async function free(args) {
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        const restraints = [];
        for (const group of AssetGroup) {
            if (group.Name.startsWith("Item")) {
                const item = InventoryGet(target, group.Name);
                if (item) {
                    if (isHeartLock(item)) continue; // AFC 心锁：跳过，不列入可解除清单
                    const lock     = item.Property?.LockedBy ? "[锁] " + item.Property.LockedBy : "";
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
        const selected = await requestButtons(t('freeTitle') + " — " + getNickname(target), restraints, true);
        if (!selected.length) return true;
        try {
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (group) InventoryRemove(target, group);
            });
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(getNickname(Player) + " " + t('freeDone') + " " + getNickname(target) + " 的 " + selected.join("、"));
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ free 错误:", e.message); }
        return true;
    }

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
        const selected = await requestButtons(t('craftClearTitle') + " — " + getNickname(target), restraints, true);
        if (!selected.length) return;
        try {
            let count = 0;
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (!group) return;
                const item = InventoryGet(target, group);
                if (item?.Craft) { delete item.Craft; count++; }
            });
            if (!count) return;
            ChatRoomCharacterUpdate(target);
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
        const selected = await requestButtons(t('craftPickTitle') + " — " + getNickname(target), restraints, true);
        if (!selected.length) return;
        const craft = await requestCraftEdit();
        if (!craft) return;
        try {
            let count = 0;
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (!group) return;
                const item = InventoryGet(target, group);
                if (!item) return;
                const existing = item.Craft || {};
                const defaults = {
                    Color: Array.isArray(item.Color) ? item.Color.join(",") : (typeof item.Color === "string" ? item.Color : ""),
                    Lock: "",
                    Effects: {},
                    Item: item.Asset?.Name ?? "",
                };
                item.Craft = Object.assign({}, defaults, existing, {
                    Name: craft.name,
                    Description: craft.description,
                    Private: craft.private,
                    Item: item.Asset?.Name ?? existing.Item ?? "",
                    MemberName: Player.Nickname || Player.Name || "",
                    MemberNumber: Player.MemberNumber,
                });
                count++;
            });
            if (!count) return;
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(getNickname(Player) + " → " + getNickname(target) + "：" + count + " " + t('craftEditDone') + "「" + craft.name + "」");
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ editCraftBatch 错误:", e.message); }
    }

    // craft 编辑表单：名称 / 描述 / 私有 → resolve({name, description, private}) 或 null
    function requestCraftEdit() {
        return new Promise(resolve => {
            let done = false;
            const wrap = document.createElement('div');
            wrap.className = 'lt-settings';

            const mkLabel = (txt) => { const l = document.createElement('div'); l.className = 'lt-settings-label'; l.textContent = txt; l.style.marginBottom = '4px'; return l; };
            const inputCss = 'width:100%;background:var(--lt-surface);border:1px solid var(--lt-border);border-radius:8px;padding:6px 10px;color:var(--lt-text);font-size:12px;outline:none;';

            wrap.appendChild(mkLabel(t('craftName')));
            const nameInput = document.createElement('input');
            nameInput.type = 'text'; nameInput.maxLength = 100; nameInput.style.cssText = inputCss + 'margin-bottom:12px;';
            wrap.appendChild(nameInput);

            wrap.appendChild(mkLabel(t('craftDesc')));
            const descInput = document.createElement('textarea');
            descInput.rows = 3; descInput.maxLength = 200; descInput.style.cssText = inputCss + 'margin-bottom:12px;resize:vertical;font-family:inherit;';
            wrap.appendChild(descInput);

            const privRow = document.createElement('label');
            privRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--lt-text);';
            const privCheck = document.createElement('input');
            privCheck.type = 'checkbox';
            const privText = document.createElement('span'); privText.textContent = t('craftPrivate');
            privRow.appendChild(privCheck); privRow.appendChild(privText);
            wrap.appendChild(privRow);

            const footerEl = document.createElement('div');
            footerEl.style.cssText = 'display:flex;gap:8px;width:100%;';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'lt-btn lt-btn-secondary'; cancelBtn.textContent = t('cancel'); cancelBtn.style.flex = '1';
            cancelBtn.onclick = () => { if (done) return; done = true; panel.remove(); resolve(null); };
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'lt-btn lt-btn-primary'; confirmBtn.textContent = t('confirm'); confirmBtn.style.flex = '1';
            confirmBtn.onclick = () => {
                if (done) return;
                const name = nameInput.value.trim();
                if (!name) { nameInput.focus(); return; }
                done = true; panel.remove();
                resolve({ name, description: descInput.value.trim(), private: privCheck.checked });
            };
            footerEl.appendChild(cancelBtn); footerEl.appendChild(confirmBtn);

            const panel = createPanel(t('craftEditTitle'), wrap, footerEl, {
                onClose: () => { if (!done) { done = true; resolve(null); } }
            });
            setTimeout(() => { try { nameInput.focus(); } catch (_) {} }, 0);
        });
    }

    function clearCraftCommand(args) {
        const target = getPlayer((args || '').trim());
        clearAllCraft(target);
        return true;
    }
    function editCraftCommand(args) {
        const target = getPlayer((args || '').trim());
        editCraftBatch(target);
        return true;
    }

    async function bcxImport(args) {
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        let bcxCode;
        try { bcxCode = await navigator.clipboard.readText(); }
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

    function rpmode() {
        const newRpMode = !getRpMode(Player);
        setRpMode(newRpMode);
        ChatRoomSendLocal(newRpMode ? t('rpOn') : t('rpOff'), TOGGLE_MSG_MS);
        return true;
    }

    function rpbtn() {
        const s = getES();
        s.rpBtnVisible = s.rpBtnVisible !== 1 ? 1 : 0;
        saveES();
        ChatRoomSendLocal(s.rpBtnVisible === 1 ? t('rpBtnShow') : t('rpBtnHide'), TOGGLE_MSG_MS);
        return true;
    }

    // ──────────────────────────────────────────
    // 隐藏快捷键：长按 Shift + P 1.5 秒，切换 RP 隐身模式
    //   - stealthRp ON  → 别人看不到你头顶的 RP 图标
    //   - stealthRp OFF → 别人能看到你头顶的 RP 图标
    //   - 完全隐晦：UI 上不显示任何入口，只有开发者知道
    //   - 普通人按不出：必须 Shift + P 同时按住 1.5 秒
    // ──────────────────────────────────────────
    (function setupHiddenRpBtnShortcut() {
        let held = false;
        let timer = null;
        const HOLD_MS = 1500;
        document.addEventListener('keydown', function(e) {
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
                ChatRoomSendLocal('[LT] RP 隐身: ' + (s.stealthRp === 1 ? 'ON (别人看不到图标)' : 'OFF (别人能看到图标)'));
            }, HOLD_MS);
        });
        document.addEventListener('keyup', function(e) {
            if (e.key === 'P' || e.key === 'p' || e.key === 'Shift') {
                if (timer) { clearTimeout(timer); timer = null; }
                held = false;
            }
        });
    })();

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

    async function getEverything() {
        const options = [{ text: t('geItems') }, { text: t('geMoney') }, { text: t('geSkills') }];
        const selected = await requestButtons(t('geTitle'), options, true);
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

    function fullLock(args) {
        const params           = args.trim().split(/\s+/);
        const targetIdentifier = params[0] || "";
        const lockName         = params[1] || "";
        const target           = getPlayer(targetIdentifier);
        if (target === Player && !targetIdentifier) { ChatRoomSendLocal(t('lockSpecify')); return true; }
        if (!ChatRoomCharacter?.find(c => c.MemberNumber === target.MemberNumber)) {
            ChatRoomSendLocal(getNickname(target) + " " + t('notInRoom') + "！"); return true;
        }
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(t('noPermission') + " " + getNickname(target) + "。"); return true; }
        const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
        if (!itemMiscGroup) return true;
        const validLocks = itemMiscGroup.Asset.filter(a => a.IsLock).map(a => ({ Name: a.Name, Description: a.Description || a.Name }));
        const lock = validLocks.find(l => l.Name.toLowerCase() === lockName.toLowerCase() || l.Description.toLowerCase() === lockName.toLowerCase());
        if (!lock) {
            ChatRoomSendLocal(t('lockInvalid') + "：" + lockName + "。" + t('lockAvailable') + "：" + validLocks.map(l => l.Description).join("、"));
            return true;
        }
        try {
            let count = 0;
            for (const item of target.Appearance) {
                const groupName = item.Asset?.Group?.Name || "";
                if (groupName.startsWith("Item") && item.Asset?.AllowLock !== false && !item.Property?.LockedBy) {
                    InventoryLock(target, item, { Asset: AssetGet(Player.AssetFamily, "ItemMisc", lock.Name) }, Player.MemberNumber);
                    count++;
                }
            }
            if (!count) { ChatRoomSendLocal(getNickname(target) + " " + t('lockNone') + "！"); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(getNickname(Player) + " 为 " + getNickname(target) + " 的 " + count + " " + t('lockDone') + " " + lock.Description + "！");
        } catch (e) { console.error("🐈‍⬛ [LT] ❌ fullLock 错误:", e.message); }
        return true;
    }

    function heightFixCommand() {
        const s = getES();
        s.heightFix = s.heightFix !== 1 ? 1 : 0;
        saveES();
        if (s.heightFix === 1) {
            if (heightTargetChar && s.heightLock !== 1) applyHeightFix(heightTargetChar);
        } else {
            if (heightTargetChar && s.heightLock !== 1) removeHeightHijack(heightTargetChar);
        }
        ChatRoomSendLocal(s.heightFix === 1 ? t('heightFixOn') : t('heightFixOff'), TOGGLE_MSG_MS);
        return true;
    }

    function heightLockCommand() {
        const s = getES();
        s.heightLock = s.heightLock !== 1 ? 1 : 0;
        saveES();
        if (s.heightLock === 1) {
            if (heightTargetChar) {
                if (heightTargetChar._ltHeightFixed) removeHeightHijack(heightTargetChar);
                applyHeightLock(heightTargetChar);
            }
        } else {
            if (heightTargetChar) {
                removeHeightHijack(heightTargetChar);
                if (s.heightFix === 1) applyHeightFix(heightTargetChar);
            }
        }
        ChatRoomSendLocal(s.heightLock === 1 ? t('heightLockOn') : t('heightLockOff'), TOGGLE_MSG_MS);
        return true;
    }

    async function undoCommand(args) {
        await openUndoPanel(getPlayer(args.trim()));
        return true;
    }

    // ──────────────────────────────────────────
    // Free Hands 无视绑缚（被绑时仍可使用双手，不解开任何拘束道具）
    //  - 只在开关开启时临时覆盖 Player 的 CanInteract / IsRestrained /
    //    CanChangeOwnClothes；关闭时完整还原为原函式。
    //  - 关闭状态下不留下任何修改，避免被其他工具误判为“未知 MOD”。
    // ──────────────────────────────────────────
    let _fhOrig = null;
    function _fhPatch() {
        if (_fhOrig || !Player) return;
        _fhOrig = {
            CanInteract: Player.CanInteract,
            IsRestrained: Player.IsRestrained,
            CanChangeOwnClothes: Player.CanChangeOwnClothes,
        };
        Player.CanInteract  = function () { return true;  };
        Player.IsRestrained = function () { return false; };
        if (typeof _fhOrig.CanChangeOwnClothes === 'function') Player.CanChangeOwnClothes = function () { return true; };
    }
    function _fhUnpatch() {
        if (!_fhOrig || !Player) { _fhOrig = null; return; }
        Player.CanInteract  = _fhOrig.CanInteract;
        Player.IsRestrained = _fhOrig.IsRestrained;
        if (typeof _fhOrig.CanChangeOwnClothes === 'function') Player.CanChangeOwnClothes = _fhOrig.CanChangeOwnClothes;
        _fhOrig = null;
    }
    // 依据设定套用/还原（初始化与切换时都走这里；关闭=默认→不套用任何 patch）
    function applyFreeHands() {
        if (getES().freeHands === 1) _fhPatch(); else _fhUnpatch();
    }

    function freeHandsCommand() {
        const s = getES();
        s.freeHands = s.freeHands !== 1 ? 1 : 0;
        saveES();
        applyFreeHands();
        broadcastShared('FreeHands', s.freeHands === 1); // 徽章广播
        ChatRoomSendLocal(s.freeHands === 1 ? t('fhOn') : t('fhOff'), TOGGLE_MSG_MS);
        if (typeof window.__LT_updateToggles === 'function') window.__LT_updateToggles();
        return true;
    }

    // ──────────────────────────────────────────
    // 勿扰模式：除自己外，任何人对本玩家外观的编辑（换衣/拘束）都立即复原
    //  - _dndBaseline 记录「授权状态」：开启时、以及自己/全量同步造成的变更后都会更新。
    //  - 他人造成的变更 → 载回 baseline 并广播，覆盖对方的修改，同时发一则动作讯息。
    //  ponytail: 用「变更来源号码」区分自己 vs 他人的启发式；来源为 null（全量同步）视为授权。
    // ──────────────────────────────────────────
    let _dndBaseline = null;
    let _dndLastAnnounce = 0;
    let _dndInSync = false; // 处理「他人造成的同步」期间为 true，避免把对方的状态误存成基准

    function dndCaptureBaseline() {
        try { _dndBaseline = ServerAppearanceBundle(Player.Appearance); } catch (e) {}
    }

    function dndRevert(sourceNumber) {
        if (!_dndBaseline) { dndCaptureBaseline(); return; }
        try {
            ServerAppearanceLoadFromBundle(Player, Player.AssetFamily, _dndBaseline, Player.MemberNumber);
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
        const s = getES();
        s.dnd = s.dnd !== 1 ? 1 : 0;
        saveES();
        if (s.dnd === 1) dndCaptureBaseline();
        broadcastShared('DND', s.dnd === 1); // 徽章广播
        ChatRoomSendLocal(s.dnd === 1 ? t('dndOn') : t('dndOff'), TOGGLE_MSG_MS);
        if (typeof window.__LT_updateToggles === 'function') window.__LT_updateToggles();
        return true;
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

    function oocCommand() {
        const s = getES();
        s.alwaysOOC = s.alwaysOOC !== 1 ? 1 : 0;
        saveES();
        ltRefreshOOCPlaceholder();
        ChatRoomSendLocal(s.alwaysOOC === 1 ? t('oocOn') : t('oocOff'), TOGGLE_MSG_MS);
        if (typeof window.__LT_updateToggles === 'function') window.__LT_updateToggles();
        return true;
    }

    // ──────────────────────────────────────────
    // Ignore Clothing Block 无视衣物阻挡
    //  - 拿掉「其他道具 Block 此格子」+ 衣物遮挡类前置条件（RemoveClothesForItem 一般衣物/外套、
    //    UnZipSuitForItem 连体衣/外套遮住乳环），让被服装/道具遮挡的格子仍可直接换装、装拘束。
    //  - enclose / 距离 / 主人规则 / 其它前置条件(姿势/贞操/冲突拘束)全部保留。
    //  - 透过 modApi.hookFunction 挂钩（不直接改写全局函式），否则会被 ModSDK 判为「未知 MOD」。
    //    关闭时呼叫 hookFunction 回传的移除器还原，不留下任何修改。
    // ──────────────────────────────────────────
    let _ibHooks = null;
    function _ibPatch() {
        if (_ibHooks || !modApi || typeof modApi.hookFunction !== 'function') return;
        _ibHooks = [
            modApi.hookFunction('InventoryGroupIsBlockedForCharacter', 10, (args) => {
                const C = args[0], GroupName = args[1];
                let Activity = args[2] || false;
                const restraints = C.Appearance.filter(i => i.Asset.Group.IsItem());
                if (Activity && !restraints.some(i => i.Asset.AllowActivityOn.includes(GroupName) || i.Property?.AllowActivityOn?.includes(GroupName)))
                    Activity = false;
                // 原本此处是 item-Block-item 检查，被无视
                if (!C.IsPlayer() && C.IsEnclose())
                    return !restraints.some(i => i.Asset.Group.Name == GroupName && InventoryItemHasEffect(i, "Enclose", true));
                return false;
            }),
            modApi.hookFunction('InventoryPrerequisiteMessage', 10, (args, next) => {
                const msg = next(args);
                // 衣物遮挡类前置条件全部放行：RemoveClothesForItem（一般衣物/外套遮挡）、
                // UnZipSuitForItem（连体衣/外套遮住乳环等 ItemNipplesPiercings 项目）。
                // 其它（姿势/贞操/MustFree*/MustHave* 等结构性条件）保留。
                return (msg === "RemoveClothesForItem" || msg === "UnZipSuitForItem") ? "" : msg;
            }),
        ];
    }
    function _ibUnpatch() {
        if (!_ibHooks) return;
        _ibHooks.forEach(remove => { try { remove(); } catch (e) {} });
        _ibHooks = null;
    }
    function applyIgnoreBlock() {
        if (getES().ignoreBlock === 1) _ibPatch(); else _ibUnpatch();
    }

    function ignoreBlockCommand() {
        const s = getES();
        s.ignoreBlock = s.ignoreBlock !== 1 ? 1 : 0;
        saveES();
        applyIgnoreBlock();
        ChatRoomSendLocal(s.ignoreBlock === 1 ? t('ibOn') : t('ibOff'), TOGGLE_MSG_MS);
        return true;
    }

    // ── AFC 心锁（拓展锁）识别：解除拘束 / 解锁时跳过，避免破坏 AFC 心锁 ──
    const AFC_HEARTLOCK_NAME = 'Heart Padlock';
    function isHeartLock(item) {
        const p = item?.Property;
        return !!p && (p.Name === AFC_HEARTLOCK_NAME || !!p.HeartLockId);
    }

    // ──────────────────────────────────────────
    // 指令入口
    // ──────────────────────────────────────────
    function handleLtCommand(text) {
        if (!Player.LikoTool) initializeStorage();
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

    // ──────────────────────────────────────────
    // 主初始化
    // ──────────────────────────────────────────
    async function initialize() {
        console.log("🐈‍⬛ [LT] ⌛ 开始初始化插件...");
        await initializeModApi();
        try { await loadToastSystem(); }
        catch (e) { console.warn("🐈‍⬛ [LT] ❌ Toast system 载入失敗，備用模式運行:", e.message); }

        console.log("🐈‍⬛ [LT] ⌛ 等待玩家登入...");
        await waitFor(() => { try { return typeof Player?.MemberNumber === "number"; } catch { return false; } });

        initializeStorage();
        applyFreeHands();
        applyIgnoreBlock();
        if (getES().dnd === 1) dndCaptureBaseline();
        // 广播持久化的徽章状态（DND / FreeHands），让别人一进房就看得到
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
        applyTheme();
        setupHooks();
        startToolButtonInjector();

        const registerCommand = () => {
            CommandCombine([{ Tag: "lt", Description: "Execute Liko Tool command", Action: handleLtCommand }]);
            console.log("🐈‍⬛ [LT] ✅ /lt 指令注册成功");
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
            ChatRoomSendLocal(t('loaded', { v: MOD_Version }), 30000);
        });

        console.log("🐈‍⬛ [LT] ✅ 插件已载入 (v" + MOD_Version + ")");
    }

    // ──────────────────────────────────────────
    // 卸载清理
    // ──────────────────────────────────────────
    function setupUnloadHandler() {
        if (modApi && typeof modApi.onUnload === 'function') {
            modApi.onUnload(() => {
                if (heightTargetChar) { removeHeightHijack(heightTargetChar); heightTargetChar = null; }
                _fhUnpatch();
                _ibUnpatch();
                delete window.__LikoToolLoaded__;
                console.log("🐈‍⬛ [LT] 🗑️ 插件卸载");
            });
        }
    }

    initialize().then(() => { setupUnloadHandler(); })
    .catch(error => { console.error("🐈‍⬛ [LT] ❌ 初始化失敗:", error); });

})();
