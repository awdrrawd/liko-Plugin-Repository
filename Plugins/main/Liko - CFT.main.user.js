// ==UserScript==
// @name         Liko - Chat Filter Tool
// @name:zh      Liko的聊天室信息過濾器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
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
    const modversion = "1.0";
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
            mode: "模式",
            modeOff: "停用",
            modeFilter: "過濾",
            modeClean: "節能",
            cleanWarn: "⚠ 節能模式將永久刪除訊息，此操作無法復原",
            types: "顯示類型",
            chat: "Chat", emote: "Emote", action: "Action", activity: "Activity",
            autoScroll: "自動捲動",
            maxMsg: "最大訊息數",
            maxHint: "0 或留空 = 無限制；啟用限制時最低 50 條",
            blacklist: "黑名單（成員 ID）",
            blHint: "輸入 ID，按 Enter 或逗號確認",
            keywords: "關鍵字過濾",
            kwHint: "輸入關鍵字，按 Enter 或逗號確認",
            apply: "套用",
            close: "關閉",
            toast: "✓ 設定已套用",
        },
        en: {
            title: "Chat Filter",
            mode: "Mode",
            modeOff: "Off",
            modeFilter: "Filter",
            modeClean: "Eco",
            cleanWarn: "⚠ Eco mode permanently deletes messages and cannot be undone",
            types: "Show Types",
            chat: "Chat", emote: "Emote", action: "Action", activity: "Activity",
            autoScroll: "Auto Scroll",
            maxMsg: "Max Messages",
            maxHint: "0 or empty = unlimited; minimum 50 if limit is enabled",
            blacklist: "Blacklist (Member ID)",
            blHint: "Type an ID, press Enter or comma",
            keywords: "Keyword Filter",
            kwHint: "Type a keyword, press Enter or comma",
            apply: "Apply",
            close: "Close",
            toast: "✓ Settings Applied",
        }
    };

    function t(k) { return (isZh() ? LANG.zh : LANG.en)[k] || k; }

    // ===== 模式 =====
    const MODE = { OFF: "off", FILTER: "filter", CLEAN: "clean" };

    // ===== 設定 =====
    let settings = {
        mode: MODE.FILTER,
        showChat: true, showAction: true, showEmote: true, showActivity: true,
        blacklist: [],
        keywords: [],
        autoScroll: true,
        maxMessages: 0,
    };

    function save() {
        localStorage.setItem("bc_cfp_v2", JSON.stringify(settings));
    }
    function load() {
        try {
            Object.assign(settings, JSON.parse(localStorage.getItem("bc_cfp_v2") || "{}"));
        } catch (e) {}
        // 從 v1 遷移
        if (!localStorage.getItem("bc_cfp_v2")) {
            try {
                const old = JSON.parse(localStorage.getItem("bc_chat_filter_panel") || "{}");
                if (old.mode) Object.assign(settings, { ...old, keywords: [] });
            } catch (e) {}
        }
    }
    load();

    // ===== 過濾邏輯 =====
    function shouldHide(node) {
        if (node.classList.contains("ChatMessageChat")     && !settings.showChat)     return true;
        if (node.classList.contains("ChatMessageAction")   && !settings.showAction)   return true;
        if (node.classList.contains("ChatMessageEmote")    && !settings.showEmote)    return true;
        if (node.classList.contains("ChatMessageActivity") && !settings.showActivity) return true;
        const sender = node.getAttribute("data-sender");
        if (sender && settings.blacklist.includes(Number(sender))) return true;
        if (settings.keywords.length > 0) {
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
                    if (!node.matches(
                        ".ChatMessageChat,.ChatMessageAction,.ChatMessageActivity,.ChatMessageEmote"
                    )) continue;
                    applyFilter(node);
                    if (settings.maxMessages > 0 && log.children.length > settings.maxMessages) {
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
        const style = document.createElement("style");
        style.id = "cfp-styles";
        style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600&display=swap');

        #cfp-panel, #cfp-panel * {
            box-sizing: border-box;
            font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
        }
        #cfp-panel .cfp-tag-input,
        #cfp-panel input[type="number"] {
            user-select: text !important;
            -webkit-user-select: text !important;
        }

        /* ── Panel ── */
        #cfp-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 360px;
            max-height: 86vh;
            background: rgba(16, 20, 32, 0.97);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 20px;
            z-index: 99999;
            display: none;
            flex-direction: column;
            box-shadow: 0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(74,125,224,0.08);
            color: #d8e6f8;
            font-size: 13px;
            overflow: hidden;
        }
        #cfp-panel.open { display: flex; }

        /* ── Header ── */
        #cfp-header {
            background: linear-gradient(135deg, #253e82 0%, #3f6fd4 100%);
            padding: 13px 15px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: grab;
            flex-shrink: 0;
            position: relative;
            overflow: hidden;
        }
        #cfp-header:active { cursor: grabbing; }
        #cfp-header::before {
            content: '';
            position: absolute; top: 0; left: -100%; width: 40%; height: 100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
            animation: cfp-shimmer 5s ease-in-out infinite;
            pointer-events: none;
        }
        @keyframes cfp-shimmer {
            0%   { transform: translateX(0); }
            100% { transform: translateX(600%); }
        }
        #cfp-title {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            position: relative;
            z-index: 1;
            letter-spacing: 0.02em;
        }
        #cfp-hclose {
            background: rgba(255,255,255,0.14);
            border: none;
            border-radius: 7px;
            color: #fff;
            width: 27px;
            height: 27px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.18s;
            position: relative;
            z-index: 1;
            flex-shrink: 0;
        }
        #cfp-hclose:hover { background: rgba(255,255,255,0.26); }

        /* ── Content ── */
        #cfp-content {
            padding: 15px 15px 4px;
            overflow-y: auto;
            overflow-x: hidden;
            flex: 1;
            scrollbar-width: thin;
            scrollbar-color: rgba(63,111,212,0.6) rgba(255,255,255,0.04);
        }
        #cfp-content::-webkit-scrollbar { width: 5px; }
        #cfp-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 3px; }
        #cfp-content::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #253e82, #3f6fd4);
            border-radius: 3px;
        }

        .cfp-section { margin-bottom: 13px; }
        .cfp-lbl {
            font-size: 10px;
            font-weight: 600;
            color: #4a70b0;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 7px;
        }
        .cfp-hr { height: 1px; background: rgba(255,255,255,0.06); margin: 2px 0 13px; }

        /* ── Mode buttons ── */
        .cfp-mode-group { display: flex; gap: 6px; }
        .cfp-mode-btn {
            flex: 1;
            padding: 8px 4px;
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 10px;
            background: rgba(255,255,255,0.04);
            color: #607898;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            text-align: center;
            transition: all 0.2s ease;
            font-family: inherit;
        }
        .cfp-mode-btn:hover {
            background: rgba(63,111,212,0.12);
            border-color: rgba(63,111,212,0.3);
            color: #90b4f0;
        }
        .cfp-mode-btn[data-mode="off"].act {
            background: rgba(130,140,160,0.2);
            border-color: rgba(160,170,190,0.45);
            color: #c0cce0;
            font-weight: 600;
        }
        .cfp-mode-btn[data-mode="filter"].act {
            background: rgba(63,111,212,0.18);
            border-color: rgba(63,111,212,0.5);
            color: #80b0ff;
            font-weight: 600;
        }
        .cfp-mode-btn[data-mode="clean"].act {
            background: rgba(210,105,40,0.18);
            border-color: rgba(210,105,40,0.5);
            color: #ffb070;
            font-weight: 600;
        }

        /* ── Clean warning ── */
        #cfp-clean-warn {
            margin-top: 7px;
            padding: 8px 10px;
            background: rgba(190,60,20,0.13);
            border: 1px solid rgba(220,90,40,0.32);
            border-radius: 9px;
            color: #ff9070;
            font-size: 11px;
            line-height: 1.45;
            display: none;
        }
        #cfp-clean-warn.show { display: block; }

        /* ── Checkbox grid ── */
        .cfp-check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .cfp-check-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 9px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .cfp-check-item:hover {
            background: rgba(63,111,212,0.1);
            border-color: rgba(63,111,212,0.28);
        }
        .cfp-check-item.on {
            background: rgba(63,111,212,0.12);
            border-color: rgba(63,111,212,0.32);
        }

        /* ── Toggle knob (shared) ── */
        .cfp-tog {
            width: 32px;
            height: 17px;
            background: rgba(255,255,255,0.14);
            border-radius: 9px;
            position: relative;
            flex-shrink: 0;
            transition: background 0.24s;
        }
        .cfp-tog::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 13px;
            height: 13px;
            background: #fff;
            border-radius: 50%;
            transition: left 0.24s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        /* check-item toggled */
        .cfp-check-item.on .cfp-tog { background: linear-gradient(135deg, #253e82, #3f6fd4); }
        .cfp-check-item.on .cfp-tog::after { left: 17px; }
        .cfp-check-label { font-size: 12px; color: #607898; transition: color 0.18s; }
        .cfp-check-item.on .cfp-check-label { color: #b0ccf0; }

        /* ── Rows ── */
        .cfp-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 9px;
            margin-bottom: 6px;
        }
        .cfp-row.click { cursor: pointer; }
        .cfp-row.click:hover { background: rgba(63,111,212,0.08); }
        /* row toggled (for autoScroll) */
        .cfp-row.on .cfp-tog { background: linear-gradient(135deg, #253e82, #3f6fd4); }
        .cfp-row.on .cfp-tog::after { left: 17px; }
        .cfp-row-lbl { font-size: 12px; color: #607898; }
        .cfp-row.on .cfp-row-lbl { color: #b0ccf0; }

        /* ── Number input ── */
        .cfp-num {
            width: 70px;
            padding: 4px 8px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 7px;
            color: #b0ccff;
            font-size: 12px;
            text-align: center;
            outline: none;
            font-family: inherit;
            transition: border-color 0.2s, background 0.2s;
        }
        .cfp-num:focus {
            border-color: rgba(63,111,212,0.6);
            background: rgba(63,111,212,0.08);
        }
        .cfp-hint {
            font-size: 10px;
            color: #3c5470;
            margin-top: 3px;
            padding: 0 2px;
            line-height: 1.4;
        }

        /* ── Tag area ── */
        .cfp-tag-area {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 7px 8px;
            min-height: 40px;
            cursor: text;
            transition: border-color 0.2s, background 0.2s;
        }
        .cfp-tag-area:focus-within {
            border-color: rgba(63,111,212,0.48);
            background: rgba(63,111,212,0.05);
        }
        .cfp-tag-wrap { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .cfp-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 3px 6px 3px 9px;
            background: rgba(63,111,212,0.16);
            border: 1px solid rgba(63,111,212,0.36);
            border-radius: 12px;
            color: #80b0ff;
            font-size: 11px;
            font-weight: 500;
        }
        .cfp-chip-x {
            cursor: pointer;
            font-size: 14px;
            color: #405878;
            line-height: 1;
            transition: color 0.14s;
            padding: 0 1px;
            user-select: none;
        }
        .cfp-chip-x:hover { color: #ff7070; }
        .cfp-tag-input {
            border: none;
            background: transparent;
            color: #9ab8e0;
            font-size: 12px;
            outline: none;
            min-width: 90px;
            flex: 1;
            padding: 2px 3px;
            font-family: inherit;
        }
        .cfp-tag-input::placeholder { color: #304460; }

        /* ── Footer ── */
        #cfp-footer {
            display: flex;
            gap: 8px;
            padding: 11px 15px;
            background: rgba(0,0,0,0.18);
            flex-shrink: 0;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        .cfp-btn {
            flex: 1;
            padding: 9px;
            border: none;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            font-family: inherit;
        }
        .cfp-btn-apply {
            background: linear-gradient(135deg, #253e82, #3f6fd4);
            color: #fff;
        }
        .cfp-btn-apply:hover {
            background: linear-gradient(135deg, #30519a, #5080e0);
            box-shadow: 0 4px 16px rgba(63,111,212,0.35);
            transform: translateY(-1px);
        }
        .cfp-btn-close {
            background: rgba(255,255,255,0.06);
            color: #607898;
            border: 1px solid rgba(255,255,255,0.08);
        }
        .cfp-btn-close:hover { background: rgba(255,255,255,0.1); color: #90a8c0; }

        /* ── Toast ── */
        #cfp-toast {
            position: fixed;
            bottom: 26px;
            left: 50%;
            transform: translateX(-50%) translateY(14px);
            background: linear-gradient(135deg, #253e82, #3f6fd4);
            color: #fff;
            padding: 9px 22px;
            border-radius: 12px;
            font-size: 13px;
            font-family: 'Noto Sans TC', sans-serif;
            box-shadow: 0 6px 20px rgba(37,62,130,0.45);
            z-index: 100000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.26s, transform 0.26s;
            white-space: nowrap;
        }
        #cfp-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
        `;
        document.head.appendChild(style);
    }

    // ===== Toast =====
    let toastTimer = null;
    function showToast(msg) {
        let el = document.getElementById("cfp-toast");
        if (!el) {
            el = document.createElement("div");
            el.id = "cfp-toast";
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
    }

    // ===== Tag Area 工廠 =====
    function makeTagArea(placeholder, numericOnly) {
        const area = document.createElement("div");
        area.className = "cfp-tag-area";
        const wrap = document.createElement("div");
        wrap.className = "cfp-tag-wrap";
        const input = document.createElement("input");
        input.type = "text";
        input.className = "cfp-tag-input";
        input.placeholder = placeholder;
        wrap.appendChild(input);
        area.appendChild(wrap);
        area.addEventListener("click", () => input.focus());

        function getValues() {
            return [...wrap.querySelectorAll(".cfp-chip")].map(c =>
                numericOnly ? Number(c.dataset.val) : c.dataset.val
            );
        }

        function addChip(label, value) {
            if (getValues().map(String).includes(String(value))) return;
            const chip = document.createElement("span");
            chip.className = "cfp-chip";
            chip.dataset.val = value;
            chip.textContent = label;
            const x = document.createElement("span");
            x.className = "cfp-chip-x";
            x.textContent = "×";
            x.addEventListener("click", e => { e.stopPropagation(); chip.remove(); });
            chip.appendChild(x);
            wrap.insertBefore(chip, input);
        }

        function commit(raw) {
            const val = raw.trim().replace(/[,，]/g, "");
            if (!val) return;
            if (numericOnly) {
                const n = Number(val);
                if (!Number.isInteger(n) || isNaN(n) || n <= 0) { input.value = ""; return; }
                addChip(String(n), n);
            } else {
                addChip(val, val);
            }
            input.value = "";
        }

        function setValues(vals) {
            wrap.querySelectorAll(".cfp-chip").forEach(c => c.remove());
            (vals || []).forEach(v => addChip(String(v), v));
        }

        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                commit(input.value);
            } else if (e.key === "," || e.key === "，") {
                e.preventDefault();
                commit(input.value);
            } else if (e.key === "Backspace" && !input.value) {
                const chips = wrap.querySelectorAll(".cfp-chip");
                if (chips.length) chips[chips.length - 1].remove();
            }
        });
        input.addEventListener("input", () => {
            const v = input.value;
            if (v.endsWith(",") || v.endsWith("，")) commit(v.slice(0, -1));
        });

        return { el: area, getValues, setValues };
    }

    // ===== 面板建構 =====
    let panel = null;
    let currentMode = settings.mode;
    let refs = {};
    let drag = { on: false, sx: 0, sy: 0, px: 0, py: 0 };

    function mkSec(label) {
        const sec = document.createElement("div");
        sec.className = "cfp-section";
        if (label) {
            const l = document.createElement("div");
            l.className = "cfp-lbl";
            l.textContent = label;
            sec.appendChild(l);
        }
        return sec;
    }

    function mkHr() {
        const hr = document.createElement("div");
        hr.className = "cfp-hr";
        return hr;
    }

    function buildModeSection() {
        const sec = mkSec(t('mode'));
        const group = document.createElement("div");
        group.className = "cfp-mode-group";
        refs.modeButtons = {};
        [
            { k: MODE.OFF,     lk: 'modeOff' },
            { k: MODE.FILTER,  lk: 'modeFilter' },
            { k: MODE.CLEAN,   lk: 'modeClean' },
        ].forEach(({ k, lk }) => {
            const btn = document.createElement("button");
            btn.className = "cfp-mode-btn";
            btn.dataset.mode = k;
            btn.textContent = t(lk);
            btn.addEventListener("click", () => setMode(k));
            group.appendChild(btn);
            refs.modeButtons[k] = btn;
        });
        const warn = document.createElement("div");
        warn.id = "cfp-clean-warn";
        warn.textContent = t('cleanWarn');
        refs.cleanWarn = warn;
        sec.appendChild(group);
        sec.appendChild(warn);
        return sec;
    }

    function buildTypesSection() {
        const sec = mkSec(t('types'));
        const grid = document.createElement("div");
        grid.className = "cfp-check-grid";
        refs.typeItems = {};
        [
            { key: "showChat",     lk: "chat" },
            { key: "showEmote",    lk: "emote" },
            { key: "showAction",   lk: "action" },
            { key: "showActivity", lk: "activity" },
        ].forEach(({ key, lk }) => {
            const item = document.createElement("div");
            item.className = "cfp-check-item";
            const tog = document.createElement("div");
            tog.className = "cfp-tog";
            const lbl = document.createElement("span");
            lbl.className = "cfp-check-label";
            lbl.textContent = t(lk);
            item.appendChild(tog);
            item.appendChild(lbl);
            item.addEventListener("click", () => item.classList.toggle("on"));
            grid.appendChild(item);
            refs.typeItems[key] = item;
        });
        sec.appendChild(grid);
        return sec;
    }

    function buildScrollAndMaxSection() {
        const sec = mkSec("");

        // AutoScroll row
        const scrollRow = document.createElement("div");
        scrollRow.className = "cfp-row click";
        const scrollLbl = document.createElement("span");
        scrollLbl.className = "cfp-row-lbl";
        scrollLbl.textContent = t('autoScroll');
        const scrollTog = document.createElement("div");
        scrollTog.className = "cfp-tog";
        scrollRow.appendChild(scrollLbl);
        scrollRow.appendChild(scrollTog);
        scrollRow.addEventListener("click", () => scrollRow.classList.toggle("on"));
        refs.scrollRow = scrollRow;
        sec.appendChild(scrollRow);

        // MaxMessages row
        const maxRow = document.createElement("div");
        maxRow.className = "cfp-row";
        const maxLbl = document.createElement("span");
        maxLbl.className = "cfp-row-lbl";
        maxLbl.textContent = t('maxMsg');
        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.className = "cfp-num";
        maxInput.min = "0";
        maxInput.placeholder = "0";
        maxRow.appendChild(maxLbl);
        maxRow.appendChild(maxInput);
        refs.maxInput = maxInput;
        sec.appendChild(maxRow);

        const hint = document.createElement("div");
        hint.className = "cfp-hint";
        hint.textContent = t('maxHint');
        sec.appendChild(hint);

        return sec;
    }

    function buildTagSection(titleKey, hintKey, isNumeric, refKey) {
        const sec = mkSec(t(titleKey));
        const tagArea = makeTagArea(t(hintKey), isNumeric);
        refs[refKey] = tagArea;
        sec.appendChild(tagArea.el);
        return sec;
    }

    function buildPanel() {
        if (panel) return;
        injectStyles();

        panel = document.createElement("div");
        panel.id = "cfp-panel";

        // ── Header ──
        const header = document.createElement("div");
        header.id = "cfp-header";
        const titleEl = document.createElement("span");
        titleEl.id = "cfp-title";
        titleEl.textContent = t('title');
        const hClose = document.createElement("button");
        hClose.id = "cfp-hclose";
        hClose.textContent = "✕";
        hClose.addEventListener("click", closePanel);
        header.appendChild(titleEl);
        header.appendChild(hClose);
        panel.appendChild(header);

        // Drag
        header.addEventListener("mousedown", e => {
            if (e.target === hClose) return;
            drag.on = true;
            drag.sx = e.clientX;
            drag.sy = e.clientY;
            const r = panel.getBoundingClientRect();
            drag.px = r.left;
            drag.py = r.top;
            panel.style.transform = "none";
            panel.style.left = drag.px + "px";
            panel.style.top  = drag.py + "px";
            e.preventDefault();
        });

        // ── Content ──
        const content = document.createElement("div");
        content.id = "cfp-content";
        content.appendChild(buildModeSection());
        content.appendChild(mkHr());
        content.appendChild(buildTypesSection());
        content.appendChild(mkHr());
        content.appendChild(buildScrollAndMaxSection());
        content.appendChild(mkHr());
        content.appendChild(buildTagSection('blacklist', 'blHint', true, 'blArea'));
        content.appendChild(mkHr());
        content.appendChild(buildTagSection('keywords', 'kwHint', false, 'kwArea'));
        panel.appendChild(content);

        // ── Footer ──
        const footer = document.createElement("div");
        footer.id = "cfp-footer";
        const applyBtn = document.createElement("button");
        applyBtn.className = "cfp-btn cfp-btn-apply";
        applyBtn.textContent = t('apply');
        applyBtn.addEventListener("click", applyAndSave);
        const closeBtn = document.createElement("button");
        closeBtn.className = "cfp-btn cfp-btn-close";
        closeBtn.textContent = t('close');
        closeBtn.addEventListener("click", closePanel);
        footer.appendChild(applyBtn);
        footer.appendChild(closeBtn);
        panel.appendChild(footer);

        document.body.appendChild(panel);

        // Global drag/close events
        document.addEventListener("mousemove", e => {
            if (!drag.on) return;
            panel.style.left = (drag.px + e.clientX - drag.sx) + "px";
            panel.style.top  = (drag.py + e.clientY - drag.sy) + "px";
        });
        document.addEventListener("mouseup", () => { drag.on = false; });
        document.addEventListener("mousedown", e => {
            if (panel.classList.contains("open") && !panel.contains(e.target)) closePanel();
        });
    }

    // ===== 面板邏輯 =====
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
        Object.entries(refs.typeItems).forEach(([key, item]) => {
            item.classList.toggle("on", !!settings[key]);
        });
        refs.scrollRow.classList.toggle("on", settings.autoScroll);
        refs.maxInput.value = settings.maxMessages > 0 ? settings.maxMessages : "";
        refs.blArea.setValues(settings.blacklist || []);
        refs.kwArea.setValues(settings.keywords || []);
    }

    function closePanel() {
        if (panel) panel.classList.remove("open");
    }

    function applyAndSave() {
        settings.mode = currentMode;
        Object.entries(refs.typeItems).forEach(([key, item]) => {
            settings[key] = item.classList.contains("on");
        });
        settings.autoScroll = refs.scrollRow.classList.contains("on");
        const raw = Number(refs.maxInput.value);
        settings.maxMessages = (!raw || raw <= 0) ? 0 : Math.max(50, Math.floor(raw));
        refs.maxInput.value = settings.maxMessages > 0 ? settings.maxMessages : "";
        settings.blacklist = refs.blArea.getValues();
        settings.keywords  = refs.kwArea.getValues();
        save();
        refreshAll();
        showToast(t('toast'));
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
        if (MouseIn(BtnX, BtnY, BtnSize, BtnSize)) {
            openPanel();
            return;
        }
        next(args);
    });

    // ===== 初始化 =====
    function waitForLog() {
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) return setTimeout(waitForLog, 500);
        startObserver();
    }
    waitForLog();

})();
