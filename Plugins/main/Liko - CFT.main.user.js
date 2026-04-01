// ==UserScript==
// @name         Liko - Chat Filter Tool
// @name:zh      Liko的聊天室信息過濾器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1
// @description  聊天室信息過濾
// @author       Liko
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    let modApi = null;
    const modversion = "1.1";
    const BtnX = 955, BtnY = 900, BtnSize = 45;

    modApi = bcModSdk.registerMod({
        name: "Liko's CFT",
        fullName: "Liko's Chat Filter Tool",
        version: modversion,
        repository: "聊天室信息過濾 | Chat room message filtering",
    });

    // ===== 語言偵測 =====
    function isZh() {
        try {
            if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
                const l = TranslationLanguage.toLowerCase();
                if (l.startsWith('zh') || l === 'cn' || l === 'tw') return true;
            }
        } catch (e) {}
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    const LANG = {
        zh: {
            title: "聊天室過濾",
            modeOff: "停用", modeFilter: "過濾", modeClean: "節能",
            cleanWarn: "⚠ 節能模式將永久刪除訊息，此操作無法復原",
            types: "顯示類型",
            chat: "聊天與OOC", emote: "表情", action: "交互動作", activity: "綑綁或其他",
            autoScroll: "自動捲動",
            maxMsg: "最大訊息數",
            maxHint: "訊息保留數，超過時根據模式處理訊息，最低設置 20 筆",
            others: "其他項目",
            whitelist: "白名單（成員 ID）",
            wlDesc: "啟用後只顯示名單人員的信息",
            wlInputHint: "輸入 ID 後按 Enter 或逗號添加",
            blacklist: "黑名單（成員 ID）",
            blDesc: "啟用後只隱藏名單人員的信息",
            blInputHint: "輸入 ID 後按 Enter 或逗號添加",
            keywords: "關鍵字過濾",
            kwDesc: "啟用後隱藏帶有關鍵字的信息",
            kwInputHint: "輸入關鍵字後按 Enter 或逗號添加",
            conflictBl: "該成員已被加入黑名單，請先確認",
            conflictWl: "該成員已被加入白名單，請先確認",
            togOn: "開啟", togOff: "關閉",
            apply: "套用", close: "關閉", toast: "✓ 設定已套用",
        },
        en: {
            title: "Chat Filter",
            modeOff: "Off", modeFilter: "Filter", modeClean: "Eco",
            cleanWarn: "⚠ Eco mode permanently deletes messages and cannot be undone",
            types: "Show Types",
            chat: "Chat", emote: "Emote", action: "Action", activity: "Activity",
            autoScroll: "Auto Scroll",
            maxMsg: "Max Messages",
            maxHint: "Messages to keep; excess handled per mode. Minimum: 20",
            others: "Other Filters",
            whitelist: "Whitelist (Member ID)",
            wlDesc: "When enabled, only show messages from listed members",
            wlInputHint: "Type an ID, press Enter or comma to add",
            blacklist: "Blacklist (Member ID)",
            blDesc: "When enabled, hide messages from listed members",
            blInputHint: "Type an ID, press Enter or comma to add",
            keywords: "Keyword Filter",
            kwDesc: "When enabled, hide messages containing these keywords",
            kwInputHint: "Type a keyword, press Enter or comma to add",
            conflictBl: "This member is already in the Blacklist. Please check first.",
            conflictWl: "This member is already in the Whitelist. Please check first.",
            togOn: "On", togOff: "Off",
            apply: "Apply", close: "Close", toast: "✓ Settings Applied",
        }
    };

    function t(k) { return (isZh() ? LANG.zh : LANG.en)[k] || k; }

    const MODE = { OFF: "off", FILTER: "filter", CLEAN: "clean" };

    let settings = {
        mode: MODE.OFF,
        showChat: true, showAction: true, showEmote: true, showActivity: true,
        blacklist: [], blacklistEnabled: false,   // 預設關閉
        whitelist: [], whitelistEnabled: false,
        keywords: [], keywordsEnabled: false,     // 預設關閉
        autoScroll: true,
        maxMessages: 200, maxMessagesEnabled: false,
        othersExpanded: false,
    };

    function save() { localStorage.setItem("bc_cfp_v2", JSON.stringify(settings)); }
    function load() {
        try { Object.assign(settings, JSON.parse(localStorage.getItem("bc_cfp_v2") || "{}")); } catch (e) {}
    }
    load();

    // ===== 過濾邏輯 =====
    function shouldHide(node) {
        if (node.classList.contains("ChatMessageChat")     && !settings.showChat)     return true;
        if (node.classList.contains("ChatMessageAction")   && !settings.showAction)   return true;
        if (node.classList.contains("ChatMessageEmote")    && !settings.showEmote)    return true;
        if (node.classList.contains("ChatMessageActivity") && !settings.showActivity) return true;

        const sender = node.getAttribute("data-sender");
        const senderNum = sender ? Number(sender) : null;

        if (settings.blacklistEnabled && senderNum !== null && settings.blacklist.includes(senderNum)) return true;

        if (settings.whitelistEnabled && settings.whitelist.length > 0) {
            if (senderNum !== null && !settings.whitelist.includes(senderNum)) return true;
        }

        if (settings.keywordsEnabled && settings.keywords.length > 0) {
            const text = node.textContent || '';
            if (settings.keywords.some(kw => kw && text.includes(kw))) return true;
        }
        return false;
    }

    function applyFilter(node) {
        if (settings.mode === MODE.OFF) { node.style.display = ""; return; }
        const hide = shouldHide(node);
        if (settings.mode === MODE.FILTER) node.style.display = hide ? "none" : "";
        if (settings.mode === MODE.CLEAN && hide) node.remove();
    }

    function refreshAll() {
        document.querySelectorAll(
            ".ChatMessageChat,.ChatMessageAction,.ChatMessageActivity,.ChatMessageEmote"
        ).forEach(n => applyFilter(n));
    }

    // ===== Observer =====
    let observer = null;
    function startObserver() {
        if (observer) return;
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) return;
        observer = new MutationObserver(muts => {
            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (!node.matches(".ChatMessageChat,.ChatMessageAction,.ChatMessageActivity,.ChatMessageEmote")) continue;
                    applyFilter(node);
                    if (settings.maxMessagesEnabled && settings.maxMessages > 0 && log.children.length > settings.maxMessages) {
                        const excess = log.children.length - settings.maxMessages;
                        for (let i = 0; i < excess && log.firstChild; i++) log.firstChild.remove();
                    }
                    if (settings.autoScroll) log.scrollTop = log.scrollHeight;
                }
            }
        });
        observer.observe(log, { childList: true });
    }

    // ===== 樣式 =====
    function injectStyles() {
        if (document.getElementById("cfp-styles")) return;
        const s = document.createElement("style");
        s.id = "cfp-styles";
        s.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600&display=swap');

        #cfp-panel, #cfp-panel * {
            box-sizing: border-box;
            font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none; -webkit-user-select: none; -moz-user-select: none;
        }
        #cfp-panel .cfp-tag-input, #cfp-panel input[type="number"] {
            user-select: text !important; -webkit-user-select: text !important;
        }

        /* ── Panel ── */
        #cfp-panel {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 370px; max-height: 88vh;
            background: rgba(16,20,32,0.97);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 20px; z-index: 99999;
            display: none; flex-direction: column;
            box-shadow: 0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(74,125,224,0.08);
            color: #d8e6f8; font-size: 13px; overflow: hidden;
        }
        #cfp-panel.open { display: flex; }

        /* ── Header ── */
        #cfp-header {
            background: linear-gradient(135deg,#253e82 0%,#3f6fd4 100%);
            padding: 13px 15px; display: flex; align-items: center;
            justify-content: space-between; cursor: grab; flex-shrink: 0;
            position: relative; overflow: hidden;
        }
        #cfp-header:active { cursor: grabbing; }
        #cfp-header::before {
            content:''; position:absolute; top:0; left:-100%; width:40%; height:100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
            animation: cfp-shimmer 5s ease-in-out infinite; pointer-events:none;
        }
        @keyframes cfp-shimmer { 0%{transform:translateX(0)} 100%{transform:translateX(600%)} }
        #cfp-title { font-size:14px; font-weight:600; color:#fff; position:relative; z-index:1; letter-spacing:0.02em; }
        #cfp-hclose {
            background:rgba(255,255,255,0.14); border:none; border-radius:7px; color:#fff;
            width:27px; height:27px; cursor:pointer; font-size:14px;
            display:flex; align-items:center; justify-content:center;
            transition:background 0.18s; position:relative; z-index:1; flex-shrink:0;
        }
        #cfp-hclose:hover { background:rgba(255,255,255,0.26); }

        /* ── Content ── */
        #cfp-content {
            padding: 14px 15px 4px; overflow-y:auto; overflow-x:hidden; flex:1;
            scrollbar-width:thin; scrollbar-color:rgba(63,111,212,0.6) rgba(255,255,255,0.04);
        }
        #cfp-content::-webkit-scrollbar { width:5px; }
        #cfp-content::-webkit-scrollbar-track { background:rgba(255,255,255,0.03); border-radius:3px; }
        #cfp-content::-webkit-scrollbar-thumb { background:linear-gradient(135deg,#253e82,#3f6fd4); border-radius:3px; }

        .cfp-section { margin-bottom:12px; }
        .cfp-hr { height:1px; background:rgba(255,255,255,0.06); margin:2px 0 12px; }

        /* ── 置中大標題 ── */
        .cfp-lbl-center {
            font-size:13px; font-weight:600; color:#7aa4d8;
            text-align:center; letter-spacing:0.06em; margin-bottom:9px;
        }

        /* ── Mode buttons ── */
        .cfp-mode-group { display:flex; gap:6px; }
        .cfp-mode-btn {
            flex:1; padding:8px 4px;
            border:1px solid rgba(255,255,255,0.09); border-radius:10px;
            background:rgba(255,255,255,0.04); color:#607898;
            cursor:pointer; font-size:12px; font-weight:500; text-align:center;
            transition:all 0.2s ease; font-family:inherit;
        }
        .cfp-mode-btn:hover { background:rgba(63,111,212,0.12); border-color:rgba(63,111,212,0.3); color:#90b4f0; }
        .cfp-mode-btn[data-mode="off"].act  { background:rgba(130,140,160,0.2); border-color:rgba(160,170,190,0.45); color:#c0cce0; font-weight:600; }
        .cfp-mode-btn[data-mode="filter"].act { background:rgba(63,111,212,0.18); border-color:rgba(63,111,212,0.5); color:#80b0ff; font-weight:600; }
        .cfp-mode-btn[data-mode="clean"].act { background:rgba(210,105,40,0.18); border-color:rgba(210,105,40,0.5); color:#ffb070; font-weight:600; }
        #cfp-clean-warn {
            margin-top:7px; padding:8px 10px;
            background:rgba(190,60,20,0.13); border:1px solid rgba(220,90,40,0.32);
            border-radius:9px; color:#ff9070; font-size:11px; line-height:1.45; display:none;
        }
        #cfp-clean-warn.show { display:block; }

        /* ── Checkbox grid ── */
        .cfp-check-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .cfp-check-item {
            display:flex; align-items:center; gap:8px; padding:8px 10px;
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);
            border-radius:9px; cursor:pointer; transition:all 0.2s;
        }
        .cfp-check-item:hover { background:rgba(63,111,212,0.1); border-color:rgba(63,111,212,0.28); }
        .cfp-check-item.on { background:rgba(63,111,212,0.12); border-color:rgba(63,111,212,0.32); }

        /* ── Toggle knob ── */
        .cfp-tog {
            width:32px; height:17px; background:rgba(255,255,255,0.14);
            border-radius:9px; position:relative; flex-shrink:0; transition:background 0.24s;
        }
        .cfp-tog::after {
            content:''; position:absolute; top:2px; left:2px;
            width:13px; height:13px; background:#fff; border-radius:50%;
            transition:left 0.24s cubic-bezier(0.25,0.46,0.45,0.94);
            box-shadow:0 1px 4px rgba(0,0,0,0.3);
        }
        .cfp-check-item.on .cfp-tog { background:linear-gradient(135deg,#253e82,#3f6fd4); }
        .cfp-check-item.on .cfp-tog::after { left:17px; }
        .cfp-check-label { font-size:12px; color:#607898; transition:color 0.18s; }
        .cfp-check-item.on .cfp-check-label { color:#b0ccf0; }

        /* ── Generic toggle row ── */
        .cfp-row {
            display:flex; align-items:center; justify-content:space-between;
            padding:8px 10px; background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,0.07); border-radius:9px;
        }
        .cfp-row.click { cursor:pointer; }
        .cfp-row.click:hover { background:rgba(63,111,212,0.08); }
        .cfp-row.on .cfp-tog { background:linear-gradient(135deg,#253e82,#3f6fd4); }
        .cfp-row.on .cfp-tog::after { left:17px; }
        .cfp-row-lbl { font-size:12px; color:#607898; }
        .cfp-row.on .cfp-row-lbl { color:#b0ccf0; }

        /* ── Max messages row ── */
        .cfp-max-row {
            display:flex; align-items:center; justify-content:space-between;
            padding:8px 10px; background:rgba(255,255,255,0.04);
            border:1px solid rgba(255,255,255,0.07); border-radius:9px; gap:8px;
            cursor:pointer; transition:background 0.2s;
        }
        .cfp-max-row:hover { background:rgba(63,111,212,0.06); }
        .cfp-max-lbl { font-size:12px; color:#607898; flex:1; }
        .cfp-max-controls { display:flex; align-items:center; gap:8px; }
        .cfp-num {
            width:62px; padding:4px 8px;
            background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
            border-radius:7px; color:#b0ccff; font-size:12px; text-align:center;
            outline:none; font-family:inherit; transition:border-color 0.2s,background 0.2s;
        }
        .cfp-num:focus { border-color:rgba(63,111,212,0.6); background:rgba(63,111,212,0.08); }
        .cfp-num:disabled { opacity:0.32; cursor:not-allowed; }
        .cfp-max-row.on .cfp-tog { background:linear-gradient(135deg,#253e82,#3f6fd4); }
        .cfp-max-row.on .cfp-tog::after { left:17px; }
        .cfp-max-row.on .cfp-max-lbl { color:#b0ccf0; }

        .cfp-hint { font-size:10px; color:#7a9cc0; margin-top:4px; padding:0 2px; line-height:1.4; }

        /* ── Others collapsible button ── */
        .cfp-others-btn {
            width:100%; padding:9px 14px;
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09);
            border-radius:11px; color:#7aa4d8; font-size:13px; font-weight:600;
            cursor:pointer; display:flex; align-items:center; justify-content:center;
            gap:8px; letter-spacing:0.05em; font-family:inherit;
            transition:background 0.2s, border-color 0.2s;
        }
        .cfp-others-btn:hover { background:rgba(63,111,212,0.1); border-color:rgba(63,111,212,0.3); }
        .cfp-others-btn.open { background:rgba(63,111,212,0.1); border-color:rgba(63,111,212,0.28); color:#90b8e8; }
        .cfp-chevron {
            font-size:11px; display:inline-block;
            transition:transform 0.26s cubic-bezier(0.25,0.46,0.45,0.94);
            color:#4a70b0;
        }
        .cfp-others-btn.open .cfp-chevron { transform:rotate(180deg); }

        /* ── Others collapsible body ── */
        .cfp-others-body {
            overflow:hidden;
            max-height:0;
            transition:max-height 0.32s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.22s;
            opacity:0;
        }
        .cfp-others-body.open { max-height:900px; opacity:1; }
        .cfp-others-inner { padding-top:12px; }

        /* ── Sub-section header（白名單 / 黑名單 / 關鍵字標題行）── */
        .cfp-sub-header {
            display:flex; align-items:center; justify-content:space-between;
            margin-bottom:4px;
        }
        .cfp-sub-lbl { font-size:13px; font-weight:600; color:#8ab4e0; letter-spacing:0.03em; }
        .cfp-tog-wrap { display:flex; align-items:center; gap:5px; cursor:pointer; }
        .cfp-tog-status { font-size:10px; color:#405878; transition:color 0.18s; }

        /* 開啟（藍） */
        .cfp-sub-header.on .cfp-tog { background:linear-gradient(135deg,#253e82,#3f6fd4); }
        .cfp-sub-header.on .cfp-tog::after { left:17px; }
        .cfp-sub-header.on .cfp-tog-status { color:#6090d0; }

        /* 開啟（綠，白名單）*/
        .cfp-sub-header.wl-on .cfp-tog { background:linear-gradient(135deg,#1a6b40,#2db870); }
        .cfp-sub-header.wl-on .cfp-tog::after { left:17px; }
        .cfp-sub-header.wl-on .cfp-tog-status { color:#4dbe80; }

        /* ── 描述文字（標題下方）── */
        .cfp-sub-desc {
            font-size:10px; color:#7a9cc0; margin-bottom:6px; padding:0 1px; line-height:1.4;
        }

        /* ── Tag area ── */
        .cfp-tag-area {
            background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);
            border-radius:10px; padding:7px 8px; min-height:40px; cursor:text;
            transition:border-color 0.2s,background 0.2s;
        }
        .cfp-tag-area:focus-within { border-color:rgba(63,111,212,0.48); background:rgba(63,111,212,0.05); }
        .cfp-tag-area.wl-area:focus-within { border-color:rgba(50,180,110,0.5); background:rgba(40,160,100,0.05); }
        .cfp-tag-wrap { display:flex; flex-wrap:wrap; gap:5px; align-items:center; }
        .cfp-chip {
            display:inline-flex; align-items:center; gap:3px; padding:3px 6px 3px 9px;
            background:rgba(63,111,212,0.16); border:1px solid rgba(63,111,212,0.36);
            border-radius:12px; color:#80b0ff; font-size:11px; font-weight:500;
        }
        .cfp-chip.wl-chip { background:rgba(40,160,100,0.15); border-color:rgba(50,180,110,0.4); color:#6de8a8; }
        .cfp-chip-x { cursor:pointer; font-size:14px; color:#405878; line-height:1; transition:color 0.14s; padding:0 1px; user-select:none; }
        .cfp-chip-x:hover { color:#ff7070; }
        .cfp-tag-input {
            border:none; background:transparent; color:#9ab8e0; font-size:12px;
            outline:none; min-width:80px; flex:1; padding:2px 3px; font-family:inherit;
        }
        .cfp-tag-input::placeholder { color:#5a7a9a; }

        /* 輸入說明 hint（在 tag area 下方）*/
        .cfp-input-hint { font-size:10px; color:#6a8aaa; margin-top:4px; padding:0 2px; }

        /* 衝突提示 */
        .cfp-conflict {
            font-size:10px; color:#ffaa60; margin-top:4px; padding:5px 8px;
            background:rgba(200,100,30,0.12); border:1px solid rgba(200,120,40,0.3);
            border-radius:7px; display:none; line-height:1.4;
        }
        .cfp-conflict.show { display:block; }

        /* ── Footer ── */
        #cfp-footer {
            display:flex; gap:8px; padding:11px 15px;
            background:rgba(0,0,0,0.18); flex-shrink:0;
            border-top:1px solid rgba(255,255,255,0.05);
        }
        .cfp-btn { flex:1; padding:9px; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .cfp-btn-apply { background:linear-gradient(135deg,#253e82,#3f6fd4); color:#fff; }
        .cfp-btn-apply:hover { background:linear-gradient(135deg,#30519a,#5080e0); box-shadow:0 4px 16px rgba(63,111,212,0.35); transform:translateY(-1px); }
        .cfp-btn-close { background:rgba(255,255,255,0.06); color:#607898; border:1px solid rgba(255,255,255,0.08); }
        .cfp-btn-close:hover { background:rgba(255,255,255,0.1); color:#90a8c0; }

        /* ── Toast ── */
        #cfp-toast {
            position:fixed; bottom:26px; left:50%;
            transform:translateX(-50%) translateY(14px);
            background:linear-gradient(135deg,#253e82,#3f6fd4); color:#fff;
            padding:9px 22px; border-radius:12px; font-size:13px;
            font-family:'Noto Sans TC',sans-serif;
            box-shadow:0 6px 20px rgba(37,62,130,0.45);
            z-index:100000; opacity:0; pointer-events:none;
            transition:opacity 0.26s,transform 0.26s; white-space:nowrap;
        }
        #cfp-toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
        `;
        document.head.appendChild(s);
    }

    // ===== Toast =====
    let toastTimer = null;
    function showToast(msg) {
        let el = document.getElementById("cfp-toast");
        if (!el) { el = document.createElement("div"); el.id = "cfp-toast"; document.body.appendChild(el); }
        el.textContent = msg; el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
    }

    // ===== Tag Area 工廠 =====
    function makeTagArea(numericOnly, isWhitelist, inputHintKey, getConflict) {
        const area = document.createElement("div");
        area.className = "cfp-tag-area" + (isWhitelist ? " wl-area" : "");

        const wrap = document.createElement("div"); wrap.className = "cfp-tag-wrap";
        const input = document.createElement("input");
        input.type = "text"; input.className = "cfp-tag-input";
        wrap.appendChild(input);
        area.appendChild(wrap);

        const conflictEl = document.createElement("div"); conflictEl.className = "cfp-conflict";
        area.appendChild(conflictEl);

        area.addEventListener("click", () => input.focus());

        // 說明文字放在 area 下方（由呼叫端添加）
        let conflictTimer = null;
        function showConflict(msg) {
            conflictEl.textContent = msg; conflictEl.classList.add("show");
            clearTimeout(conflictTimer);
            conflictTimer = setTimeout(() => conflictEl.classList.remove("show"), 3000);
        }

        function getValues() {
            return [...wrap.querySelectorAll(".cfp-chip")].map(c =>
                numericOnly ? Number(c.dataset.val) : c.dataset.val
            );
        }

        function addChip(label, value) {
            if (getValues().map(String).includes(String(value))) return;
            if (getConflict) { const msg = getConflict(value); if (msg) { showConflict(msg); return; } }
            const chip = document.createElement("span");
            chip.className = "cfp-chip" + (isWhitelist ? " wl-chip" : "");
            chip.dataset.val = value; chip.textContent = label;
            const x = document.createElement("span"); x.className = "cfp-chip-x"; x.textContent = "×";
            x.addEventListener("click", e => { e.stopPropagation(); chip.remove(); });
            chip.appendChild(x); wrap.insertBefore(chip, input);
        }

        function commit(raw) {
            const val = raw.trim().replace(/[,，]/g, "");
            if (!val) return;
            if (numericOnly) {
                const n = Number(val);
                if (!Number.isInteger(n) || isNaN(n) || n <= 0) { input.value = ""; return; }
                addChip(String(n), n);
            } else { addChip(val, val); }
            input.value = "";
        }

        function setValues(vals) {
            wrap.querySelectorAll(".cfp-chip").forEach(c => c.remove());
            (vals || []).forEach(v => addChip(String(v), v));
        }

        input.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); commit(input.value); }
            else if (e.key === "," || e.key === "，") { e.preventDefault(); commit(input.value); }
            else if (e.key === "Backspace" && !input.value) {
                const chips = wrap.querySelectorAll(".cfp-chip");
                if (chips.length) chips[chips.length - 1].remove();
            }
        });
        input.addEventListener("input", () => {
            const v = input.value;
            if (v.endsWith(",") || v.endsWith("，")) commit(v.slice(0, -1));
        });

        // 包裝成含 hint 的容器
        const wrapper = document.createElement("div");
        wrapper.appendChild(area);
        const hintEl = document.createElement("div"); hintEl.className = "cfp-input-hint";
        hintEl.textContent = t(inputHintKey);
        wrapper.appendChild(hintEl);

        return { el: wrapper, getValues, setValues };
    }

    // ===== 面板 =====
    let panel = null;
    let currentMode = settings.mode;
    let refs = {};
    let drag = { on: false, sx: 0, sy: 0, px: 0, py: 0 };

    function mkHr() { const h = document.createElement("div"); h.className = "cfp-hr"; return h; }

    /* 子項目標題 + 開關 */
    function makeSubHeader(labelText, isWl) {
        const row = document.createElement("div"); row.className = "cfp-sub-header";
        const lbl = document.createElement("span"); lbl.className = "cfp-sub-lbl"; lbl.textContent = labelText;
        row.appendChild(lbl);

        const togWrap = document.createElement("div"); togWrap.className = "cfp-tog-wrap";
        const status = document.createElement("span"); status.className = "cfp-tog-status";
        const tog = document.createElement("div"); tog.className = "cfp-tog";
        togWrap.appendChild(status); togWrap.appendChild(tog); row.appendChild(togWrap);

        function setOn(on) {
            if (isWl) {
                row.classList.toggle("wl-on", on);
                row.classList.remove("on");
            } else {
                row.classList.toggle("on", on);
            }
            status.textContent = on ? t('togOn') : t('togOff');
        }
        togWrap.addEventListener("click", () => {
            const cur = isWl ? row.classList.contains("wl-on") : row.classList.contains("on");
            setOn(!cur);
        });
        setOn(false);
        return { el: row, setOn, isOn: () => isWl ? row.classList.contains("wl-on") : row.classList.contains("on") };
    }

    function buildPanel() {
        if (panel) return;
        injectStyles();
        panel = document.createElement("div"); panel.id = "cfp-panel";

        // ── Header ──
        const header = document.createElement("div"); header.id = "cfp-header";
        const titleEl = document.createElement("span"); titleEl.id = "cfp-title"; titleEl.textContent = t('title');
        const hClose = document.createElement("button"); hClose.id = "cfp-hclose"; hClose.textContent = "✕";
        hClose.addEventListener("click", closePanel);
        header.appendChild(titleEl); header.appendChild(hClose); panel.appendChild(header);
        header.addEventListener("mousedown", e => {
            if (e.target === hClose) return;
            drag.on = true; drag.sx = e.clientX; drag.sy = e.clientY;
            const r = panel.getBoundingClientRect(); drag.px = r.left; drag.py = r.top;
            panel.style.transform = "none"; panel.style.left = drag.px+"px"; panel.style.top = drag.py+"px";
            e.preventDefault();
        });

        const content = document.createElement("div"); content.id = "cfp-content";

        // 1. 模式
        const modeSec = document.createElement("div"); modeSec.className = "cfp-section";
        const modeGroup = document.createElement("div"); modeGroup.className = "cfp-mode-group";
        refs.modeButtons = {};
        [{k:MODE.OFF,lk:'modeOff'},{k:MODE.FILTER,lk:'modeFilter'},{k:MODE.CLEAN,lk:'modeClean'}]
            .forEach(({ k, lk }) => {
                const btn = document.createElement("button"); btn.className = "cfp-mode-btn";
                btn.dataset.mode = k; btn.textContent = t(lk);
                btn.addEventListener("click", () => setMode(k));
                modeGroup.appendChild(btn); refs.modeButtons[k] = btn;
            });
        const cleanWarn = document.createElement("div"); cleanWarn.id = "cfp-clean-warn"; cleanWarn.textContent = t('cleanWarn');
        refs.cleanWarn = cleanWarn;
        modeSec.appendChild(modeGroup); modeSec.appendChild(cleanWarn);
        content.appendChild(modeSec); content.appendChild(mkHr());

        // 2. 顯示類型
        const typesSec = document.createElement("div"); typesSec.className = "cfp-section";
        const typesLbl = document.createElement("div"); typesLbl.className = "cfp-lbl-center"; typesLbl.textContent = t('types');
        const typesGrid = document.createElement("div"); typesGrid.className = "cfp-check-grid";
        refs.typeItems = {};
        [{key:"showChat",lk:"chat"},{key:"showEmote",lk:"emote"},{key:"showAction",lk:"action"},{key:"showActivity",lk:"activity"}]
            .forEach(({ key, lk }) => {
                const item = document.createElement("div"); item.className = "cfp-check-item";
                const tog = document.createElement("div"); tog.className = "cfp-tog";
                const clbl = document.createElement("span"); clbl.className = "cfp-check-label"; clbl.textContent = t(lk);
                item.appendChild(tog); item.appendChild(clbl);
                item.addEventListener("click", () => item.classList.toggle("on"));
                typesGrid.appendChild(item); refs.typeItems[key] = item;
            });
        typesSec.appendChild(typesLbl); typesSec.appendChild(typesGrid);
        content.appendChild(typesSec); content.appendChild(mkHr());

        // 3. 自動捲動
        const scrollSec = document.createElement("div"); scrollSec.className = "cfp-section";
        const scrollRow = document.createElement("div"); scrollRow.className = "cfp-row click";
        const scrollLbl = document.createElement("span"); scrollLbl.className = "cfp-row-lbl"; scrollLbl.textContent = t('autoScroll');
        const scrollTog = document.createElement("div"); scrollTog.className = "cfp-tog";
        scrollRow.appendChild(scrollLbl); scrollRow.appendChild(scrollTog);
        scrollRow.addEventListener("click", () => scrollRow.classList.toggle("on"));
        refs.scrollRow = scrollRow; scrollSec.appendChild(scrollRow);
        content.appendChild(scrollSec); content.appendChild(mkHr());

        // 4. 最大訊息數
        const maxSec = document.createElement("div"); maxSec.className = "cfp-section";
        const maxRow = document.createElement("div"); maxRow.className = "cfp-max-row";
        const maxLbl = document.createElement("span"); maxLbl.className = "cfp-max-lbl"; maxLbl.textContent = t('maxMsg');
        const maxControls = document.createElement("div"); maxControls.className = "cfp-max-controls";
        const maxNum = document.createElement("input"); maxNum.type = "number"; maxNum.className = "cfp-num";
        maxNum.min = "20"; maxNum.value = 200; maxNum.disabled = true;
        const maxTog = document.createElement("div"); maxTog.className = "cfp-tog";
        maxControls.appendChild(maxNum); maxControls.appendChild(maxTog);
        maxRow.appendChild(maxLbl); maxRow.appendChild(maxControls);
        maxRow.addEventListener("click", e => {
            if (e.target === maxNum) return;
            maxRow.classList.toggle("on");
            maxNum.disabled = !maxRow.classList.contains("on");
        });
        refs.maxRow = maxRow; refs.maxInput = maxNum;
        const maxHint = document.createElement("div"); maxHint.className = "cfp-hint"; maxHint.textContent = t('maxHint');
        maxSec.appendChild(maxRow); maxSec.appendChild(maxHint);
        content.appendChild(maxSec); content.appendChild(mkHr());

        // 5. 其他項目（可折疊）
        const othersSec = document.createElement("div"); othersSec.className = "cfp-section";

        // 折疊按鈕
        const othersBtn = document.createElement("button"); othersBtn.className = "cfp-others-btn";
        const btnText = document.createElement("span"); btnText.textContent = t('others');
        const chevron = document.createElement("span"); chevron.className = "cfp-chevron"; chevron.textContent = "▼";
        othersBtn.appendChild(btnText); othersBtn.appendChild(chevron);

        // 折疊內容
        const othersBody = document.createElement("div"); othersBody.className = "cfp-others-body";
        const othersInner = document.createElement("div"); othersInner.className = "cfp-others-inner";
        othersBody.appendChild(othersInner);

        othersBtn.addEventListener("click", () => {
            const open = othersBody.classList.toggle("open");
            othersBtn.classList.toggle("open", open);
            settings.othersExpanded = open;
        });

        // — 白名單 —
        const wlHdr = makeSubHeader(t('whitelist'), true); refs.wlHeader = wlHdr;
        othersInner.appendChild(wlHdr.el);
        const wlDesc = document.createElement("div"); wlDesc.className = "cfp-sub-desc"; wlDesc.textContent = t('wlDesc');
        othersInner.appendChild(wlDesc);
        const wlArea = makeTagArea(true, true, 'wlInputHint', (val) => {
            const blVals = refs.blArea ? refs.blArea.getValues().map(String) : [];
            if (blVals.includes(String(val))) return t('conflictBl');
            return null;
        });
        refs.wlArea = wlArea; othersInner.appendChild(wlArea.el);
        othersInner.appendChild(mkHr());

        // — 黑名單 —
        const blHdr = makeSubHeader(t('blacklist'), false); refs.blHeader = blHdr;
        othersInner.appendChild(blHdr.el);
        const blDesc = document.createElement("div"); blDesc.className = "cfp-sub-desc"; blDesc.textContent = t('blDesc');
        othersInner.appendChild(blDesc);
        const blArea = makeTagArea(true, false, 'blInputHint', (val) => {
            const wlVals = refs.wlArea ? refs.wlArea.getValues().map(String) : [];
            if (wlVals.includes(String(val))) return t('conflictWl');
            return null;
        });
        refs.blArea = blArea; othersInner.appendChild(blArea.el);
        othersInner.appendChild(mkHr());

        // — 關鍵字 —
        const kwHdr = makeSubHeader(t('keywords'), false); refs.kwHeader = kwHdr;
        othersInner.appendChild(kwHdr.el);
        const kwDesc = document.createElement("div"); kwDesc.className = "cfp-sub-desc"; kwDesc.textContent = t('kwDesc');
        othersInner.appendChild(kwDesc);
        const kwArea = makeTagArea(false, false, 'kwInputHint', null);
        refs.kwArea = kwArea; othersInner.appendChild(kwArea.el);

        othersSec.appendChild(othersBtn);
        othersSec.appendChild(othersBody);
        content.appendChild(othersSec);
        panel.appendChild(content);

        // ── Footer ──
        const footer = document.createElement("div"); footer.id = "cfp-footer";
        const applyBtn = document.createElement("button"); applyBtn.className = "cfp-btn cfp-btn-apply"; applyBtn.textContent = t('apply');
        applyBtn.addEventListener("click", applyAndSave);
        const closeBtn = document.createElement("button"); closeBtn.className = "cfp-btn cfp-btn-close"; closeBtn.textContent = t('close');
        closeBtn.addEventListener("click", closePanel);
        footer.appendChild(applyBtn); footer.appendChild(closeBtn); panel.appendChild(footer);

        document.body.appendChild(panel);
        document.addEventListener("mousemove", e => {
            if (!drag.on) return;
            panel.style.left = (drag.px + e.clientX - drag.sx)+"px";
            panel.style.top  = (drag.py + e.clientY - drag.sy)+"px";
        });
        document.addEventListener("mouseup", () => { drag.on = false; });
        document.addEventListener("mousedown", e => {
            if (panel.classList.contains("open") && !panel.contains(e.target)) closePanel();
        });

        // 記住上次展開狀態
        refs.othersBtn = othersBtn;
        refs.othersBody = othersBody;
    }

    function setMode(m) {
        currentMode = m;
        Object.values(refs.modeButtons).forEach(b => b.classList.remove("act"));
        refs.modeButtons[m].classList.add("act");
        refs.cleanWarn.classList.toggle("show", m === MODE.CLEAN);
    }

    function openPanel() {
        buildPanel();
        panel.classList.add("open");
        setMode(settings.mode);
        Object.entries(refs.typeItems).forEach(([key, item]) => item.classList.toggle("on", !!settings[key]));
        refs.scrollRow.classList.toggle("on", settings.autoScroll);
        refs.maxRow.classList.toggle("on", !!settings.maxMessagesEnabled);
        refs.maxInput.value = settings.maxMessages > 0 ? settings.maxMessages : 200;
        refs.maxInput.disabled = !settings.maxMessagesEnabled;

        // 其他項目展開狀態
        const expanded = !!settings.othersExpanded;
        refs.othersBody.classList.toggle("open", expanded);
        refs.othersBtn.classList.toggle("open", expanded);

        refs.wlArea.setValues(settings.whitelist || []);
        refs.wlHeader.setOn(!!settings.whitelistEnabled);
        refs.blArea.setValues(settings.blacklist || []);
        refs.blHeader.setOn(!!settings.blacklistEnabled);
        refs.kwArea.setValues(settings.keywords || []);
        refs.kwHeader.setOn(!!settings.keywordsEnabled);
    }

    function closePanel() { if (panel) panel.classList.remove("open"); }

    function applyAndSave() {
        settings.mode = currentMode;
        Object.entries(refs.typeItems).forEach(([key, item]) => { settings[key] = item.classList.contains("on"); });
        settings.autoScroll = refs.scrollRow.classList.contains("on");
        settings.maxMessagesEnabled = refs.maxRow.classList.contains("on");
        const rawMax = Number(refs.maxInput.value);
        settings.maxMessages = (!rawMax || rawMax < 20) ? 200 : Math.floor(rawMax);
        refs.maxInput.value = settings.maxMessages;
        settings.whitelist = refs.wlArea.getValues();
        settings.whitelistEnabled = refs.wlHeader.isOn();
        settings.blacklist = refs.blArea.getValues();
        settings.blacklistEnabled = refs.blHeader.isOn();
        settings.keywords = refs.kwArea.getValues();
        settings.keywordsEnabled = refs.kwHeader.isOn();
        save(); refreshAll(); showToast(t('toast'));
    }

    // ===== BC 按鈕 =====
    function getBtnColor() {
        if (settings.mode === MODE.FILTER) return "Green";
        if (settings.mode === MODE.CLEAN)  return "Orange";
        return "Gray";
    }
    modApi.hookFunction("ChatRoomMenuDraw", 10, (args, next) => {
        next(args);
        DrawButton(BtnX, BtnY, BtnSize, BtnSize, "📋", getBtnColor(), "", "Chat Filter");
    });
    modApi.hookFunction("ChatRoomClick", 10, (args, next) => {
        if (MouseIn(BtnX, BtnY, BtnSize, BtnSize)) { openPanel(); return; }
        next(args);
    });

    function waitForLog() {
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) return setTimeout(waitForLog, 500);
        startObserver();
    }
    waitForLog();

})();
