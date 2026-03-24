// ==UserScript==
// @name         Liko - MAT
// @name:zh      Liko的自動翻譯(使用Google api)
// @namespace    https://likolisu.dev/
// @version      1.1.1
// @description  Automatically translate BC chat messages using Google API.
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';

    let modApi;
    let myversion = "1.1.1";
    let observer = null;

    let config = {
        enabled: true,
        sendLang: 'en',
        recvLang: 'zh',
        translateReceived: true,
        translateSent: false,
        translateSelection: true,
        translateChat: true
        // Bio 翻譯沒有總開關，永遠可用
    };

    // === CSS ===
    (function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .menubar .mat-globe-btn,
            .menubar .mat-alt-btn {
                all: unset !important;
                box-sizing: border-box !important;
                width: 1.8em !important;
                height: 1.8em !important;
                display: none !important;
                align-items: center !important;
                justify-content: center !important;
                flex-shrink: 0 !important;
                cursor: pointer !important;
                opacity: 0.75 !important;
                border-radius: 3px !important;
                transition: opacity 0.15s, background 0.15s !important;
                font-size: inherit !important;
            }
            .ChatMessage.mat-btn-added:hover .menubar .mat-globe-btn,
            .ChatMessage.mat-btn-added:hover .menubar .mat-alt-btn {
                display: inline-flex !important;
            }
            .menubar .mat-globe-btn:hover,
            .menubar .mat-alt-btn:hover {
                opacity: 1 !important;
                background: rgba(76,175,80,0.2) !important;
            }
            .mat-action-btn-wrap {
                display: none !important;
                vertical-align: middle !important;
                margin-right: 0.3em !important;
                gap: 2px !important;
            }
            .ChatMessage.mat-btn-added:hover .mat-action-btn-wrap {
                display: inline-flex !important;
            }
        `;
        document.head.appendChild(style);
    })();

    // === SDK 初始化 ===
    function initSDK() {
        return new Promise((resolve) => {
            const existing = window.bcModSdk || (typeof bcModSdk !== 'undefined' ? bcModSdk : null);
            if (existing?.registerMod) { resolve(existing); return; }
            let waited = 0;
            const timer = setInterval(() => {
                const sdk = window.bcModSdk;
                if (sdk?.registerMod) { clearInterval(timer); resolve(sdk); return; }
                waited += 200;
                if (waited >= 10000) {
                    clearInterval(timer);
                    console.warn("[MAT] bcModSdk 等待超時，插件無法載入");
                    resolve(null);
                }
            }, 200);
        });
    }

    initSDK().then(sdk => {
        if (!sdk) return;
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko - MAT",
                fullName: "Liko's Messages Auto Translator",
                version: myversion,
                repository: "Auto translate chat messages(Supports bio translation)",
            });
            console.log("[MAT]✅ loaded");
        } catch (e) {
            console.error("[MAT]❌ failed to load:", e);
            return;
        }
        waitForGame();
    });

    function initializeConfig() {
        const defaults = {
            enabled: true,
            sendLang: 'en',
            recvLang: 'zh',
            translateReceived: true,
            translateSent: false,
            translateSelection: true,
            translateChat: true
        };
        if (!config || typeof config !== 'object') config = { ...defaults };
        for (const [key, val] of Object.entries(defaults)) {
            if (config[key] === undefined) config[key] = val;
        }
    }

    function saveSettings() {
        if (!Player?.OnlineSettings) { ChatRoomSendLocal("⚠️ 未登入，無法保存翻譯設定"); return; }
        Player.OnlineSettings.BCMachineTranslation = config;
        if (typeof ServerAccountUpdate?.QueueData === "function") {
            ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
        }
    }

    function loadSettings() {
        if (Player?.OnlineSettings?.BCMachineTranslation) {
            config = { ...config, ...Player.OnlineSettings.BCMachineTranslation };
        }
    }

    // === 翻譯請求隊列 ===
    const translateQueue = {
        queue: [], processing: false, minInterval: 300, lastRequestTime: 0,
        async add(text, targetLang) {
            return new Promise(resolve => {
                this.queue.push({ text, targetLang, resolve });
                if (!this.processing) this.process();
            });
        },
        async process() {
            if (this.queue.length === 0) { this.processing = false; return; }
            this.processing = true;
            const elapsed = Date.now() - this.lastRequestTime;
            if (elapsed < this.minInterval) await new Promise(r => setTimeout(r, this.minInterval - elapsed));
            const item = this.queue.shift();
            this.lastRequestTime = Date.now();
            try { item.resolve(await translateGoogle(item.text, item.targetLang)); }
            catch (e) { item.resolve({ translated: item.text, detectedLang: null }); }
            this.process();
        }
    };

    async function translateGoogle(text, target) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const data = await (await fetch(url)).json();
            return { translated: data[0][0][0] || text, detectedLang: data[2] || null };
        } catch (e) {
            console.error('Google Translate failed:', e);
            return { translated: text, detectedLang: null };
        }
    }

    const TRANSLATE_MARKER = '[MAT]';

    // 聊天室翻譯（受 config.enabled 影響）
    async function smartTranslate(text, targetLang) {
        if (!config.enabled || !text) return text;
        if (text.includes('BCX_') || text.match(/^[\d\s:]+$/) ||
            text.includes(TRANSLATE_MARKER) || text.includes('[🌐]')) return text;
        try {
            const { translated } = await translateQueue.add(text, targetLang);
            return translated;
        } catch (e) {
            console.error('[MAT] Error:', e);
            return text;
        }
    }

    // ============================================================
    // Bio 翻譯（逐行翻、空白行跳過、即時更新顯示）
    // ============================================================

    // 不需送翻的行：空白、URL、純符號分隔線
    function isBioSkipLine(line) {
        if (!line.trim()) return true;
        if (/^https?:\/\//.test(line.trim())) return true;
        if (/^[=\-_*#]{3,}$/.test(line.trim())) return true;
        return false;
    }

    async function translateBioSmart(normalized, targetLang) {
        const lines = normalized.split('\n');
        const resultLines = new Array(lines.length).fill('');

        // 先把所有不需翻譯的行填進結果，讓 display 第一次更新時就有骨架
        for (let i = 0; i < lines.length; i++) {
            if (isBioSkipLine(lines[i])) {
                resultLines[i] = lines[i];
            }
        }

        // 逐行翻譯，每翻完一行立即更新畫面
        for (let i = 0; i < lines.length; i++) {
            if (isBioSkipLine(lines[i])) continue; // 已處理，跳過

            try {
                const { translated } = await translateQueue.add(lines[i], targetLang);
                resultLines[i] = translated;
            } catch (e) {
                resultLines[i] = lines[i]; // 失敗保留原文
            }

            // 每行翻完就即時刷新顯示框
            updateBioTranslationDisplay(resultLines.join('\n'));
        }

        return resultLines.join('\n');
    }

    // === Observer ===
    function startObserver() {
        if (observer) return;
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) { setTimeout(startObserver, 1000); return; }
        observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    await handleReceivedMessage(node);
                    // 手動翻譯按鈕：受 translateChat 控制
                    if (config.translateChat) addTranslateButtonToMessage(node);
                }
            }
        });
        observer.observe(log, { childList: true });
        if (config.translateChat) {
            log.querySelectorAll('.ChatMessage').forEach(addTranslateButtonToMessage);
        }
        console.log("[MAT] Observer started");
    }

    function stopObserver() {
        if (!observer) return;
        try { observer.disconnect(); } catch {}
        observer = null;
    }

    async function handleReceivedMessage(node) {
        // 整句自動翻譯：需要 enabled 且 translateReceived
        if (!config.enabled || !config.translateReceived) return;
        if (!(node instanceof HTMLElement)) return;
        if (!node.classList.contains('ChatMessage')) return;
        if (node.classList.contains("mat-processed") ||
            node.classList.contains("mat-translated") ||
            node.classList.contains("mat-manual-translated") ||
            node.textContent.includes(TRANSLATE_MARKER) ||
            node.textContent.includes('[🌐]')) return;

        const senderEl = node.querySelector('.chat-room-sender');
        if (senderEl?.textContent == Player?.MemberNumber) return;

        if (node.classList.contains('ChatMessageBeep')) {
            const beepLink = node.querySelector('.beep-link');
            if (!beepLink) return;
            const beepText = beepLink.textContent.trim();
            if (beepText.includes('{') || beepText.includes('[🌐]')) return;
            node.classList.add("mat-processed");
            const colonIdx = beepText.indexOf(': ');
            const msg = colonIdx >= 0 ? beepText.slice(colonIdx + 2) : beepText;
            if (!msg.trim()) return;
            const translated = await smartTranslate(msg, config.recvLang);
            if (translated !== msg) createTranslatedDiv(node, translated);
            return;
        }

        node.classList.add("mat-processed");
        const message = extractCleanMessage(node);
        if (!message) return;
        const translated = await smartTranslate(message, config.recvLang);
        if (translated !== message) createTranslatedDiv(node, translated);
    }

    function extractCleanMessage(node) {
        const contentEl = node.querySelector('.chat-room-message-content');
        if (contentEl) return contentEl.textContent.trim();

        const isAction = node.classList.contains('ChatMessageAction') ||
                         node.classList.contains('ChatMessageNonDialogue');
        const clone = node.cloneNode(true);
        clone.querySelectorAll('.chat-room-metadata, .menubar, .mat-action-btn-wrap, .mat-translated, .mat-manual-translated').forEach(el => el.remove());
        let raw = clone.textContent || '';
        raw = raw.replace(/(上午|下午|凌晨|早上|晚上)?\s*\d{1,2}:\d{2}(:\d{2})?/g, '');
        raw = raw.replace(/\n\s*\n/g, '\n').trim();
        raw = raw.replace(/^\*?悄悄话来自\s+[^:]+:\s*/g, '');
        raw = raw.replace(/^\*?好友私聊来自\s+[^:]+:\s*/g, '');
        raw = raw.replace(/^\*?Whisper from\s+[^:]+:\s*/g, '');
        raw = raw.replace(/^\d+\s*/, '');
        raw = raw.replace(/^.{0,50}?:\s/, '');
        raw = raw.replace(/\s*\d*\s*Reply\s*$/gi, '');
        raw = raw.replace(/\s*回复\s*$/g, '');
        raw = raw.replace(/\n.*?:\s*↳.*$/gs, '').trim();
        raw = raw.replace(/↳.*$/gm, '').trim();
        if (isAction) raw = raw.replace(/^[\s\*]+|[\s\*]+$/g, '').trim();
        else raw = raw.replace(/^[\s\*\(\)]+|[\s\*\(\)]+$/g, '').trim();
        return raw;
    }

    function isUserMessage(text) {
        return !['enablelianchat', 'reqroom'].includes(text.toLowerCase());
    }

    function createTranslatedDiv(originalNode, translatedText) {
        const div = document.createElement('div');
        const cls = [...originalNode.classList].find(c => c.startsWith('ChatMessage') && c !== 'ChatMessage');
        div.classList.add('ChatMessage', 'mat-translated');
        if (cls) div.classList.add(cls);
        div.textContent = `[🌐] ${translatedText}`;
        div.style.cssText = 'background:rgba(76,175,80,0.1);border-left:3px solid #4CAF50;padding:2px 6px;margin-top:2px;font-size:0.95em;opacity:0.9';
        originalNode.parentNode.insertBefore(div, originalNode.nextSibling);
    }

    // ============================================================
    // 手動翻譯按鈕
    // ============================================================

    function openLangSelect(target, x, y) {
        closeLangSelect();
        const sel = document.createElement('select');
        sel.id = 'mat-lang-select';
        sel.style.cssText = `position:fixed;z-index:99999;left:${x}px;top:${y}px;font-size:1.2vw;padding:0.3vh 0.5vw;border:2px solid #4CAF50;border-radius:4px;background:#1a1a2e;color:#eee;cursor:pointer;min-width:9vw;max-height:35vh;`;
        const curIdx = target === 'send' ? uiSendIdx : uiRecvIdx;
        langCodes.forEach((code, i) => {
            const opt = document.createElement('option');
            const uiName = isZH() ? langNameZH[i] : langNameEN[i];
            const native = langNameNative[i];
            opt.value = code;
            opt.textContent = uiName === native ? uiName : `${uiName} / ${native}`;
            if (i === curIdx) opt.selected = true;
            sel.appendChild(opt);
        });
        let settled = false;
        sel.addEventListener('change', () => {
            settled = true;
            const idx = langCodes.indexOf(sel.value);
            if (idx === -1) return;
            if (target === 'send') { uiSendIdx = idx; config.sendLang = langCodes[idx]; }
            else { uiRecvIdx = idx; config.recvLang = langCodes[idx]; }
            saveSettings(); closeLangSelect();
        });
        sel.addEventListener('blur', () => { setTimeout(() => { if (!settled) closeLangSelect(); }, 100); });
        document.body.appendChild(sel);
        setTimeout(() => sel.focus(), 0);
    }

    function closeLangSelect() {
        const el = document.getElementById('mat-lang-select');
        if (el && el.parentNode) el.remove();
    }

    function openMATLangSelect(anchor, onSelect) {
        document.getElementById('mat-inline-lang-select')?.remove();
        const sel = document.createElement('select');
        sel.id = 'mat-inline-lang-select';
        const rect = anchor.getBoundingClientRect();
        const selW = window.innerWidth * 0.12;
        let left = rect.right + 4;
        if (left + selW > window.innerWidth - 8) left = rect.left - selW - 4;
        sel.style.cssText = `position:fixed;z-index:99999;left:${Math.max(4,left)}px;top:${Math.max(4,rect.top-4)}px;font-size:1vw;padding:0.2vh 0.3vw;border:1px solid #4CAF50;border-radius:4px;background:#1a1a2e;color:#eee;cursor:pointer;max-height:35vh;min-width:9vw;`;
        langCodes.forEach((code, i) => {
            const opt = document.createElement('option');
            const uiName = isZH() ? langNameZH[i] : langNameEN[i];
            const native = langNameNative[i];
            opt.value = code;
            opt.textContent = uiName === native ? uiName : `${uiName} / ${native}`;
            if (code === config.recvLang) opt.selected = true;
            sel.appendChild(opt);
        });
        let settled = false;
        sel.addEventListener('change', () => {
            settled = true; onSelect(sel.value);
            if (sel.parentNode) sel.remove();
        });
        sel.addEventListener('blur', () => { setTimeout(() => { if (!settled && sel.parentNode) sel.remove(); }, 100); });
        document.body.appendChild(sel);
        setTimeout(() => sel.focus(), 0);
    }

    function addTranslateButtonToMessage(node) {
        if (!(node instanceof HTMLElement)) return;
        if (!node.classList.contains('ChatMessage')) return;
        if (node.classList.contains('mat-translated') || node.classList.contains('mat-manual-translated')) return;
        if (node.classList.contains('mat-btn-added')) return;
        node.classList.add('mat-btn-added');

        const menubar = node.querySelector('.menubar');

        if (menubar) {
            const replyBtn = menubar.querySelector('[name="reply"]');

            const globeBtn = document.createElement('button');
            globeBtn.type = 'button';
            globeBtn.className = 'blank-button button HideOnPopup mat-globe-btn';
            globeBtn.setAttribute('role', 'menuitem');
            globeBtn.setAttribute('tabindex', '0');
            globeBtn.innerHTML = `<span style="font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;">🌐</span><div role="tooltip" class="button-tooltip button-tooltip-left" style="font-size:12px;">翻譯為 ${config.recvLang.toUpperCase()}</div>`;
            globeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tip = globeBtn.querySelector('[role="tooltip"]');
                if (tip) tip.textContent = `翻譯為 ${config.recvLang.toUpperCase()}`;
                await manualTranslateMessage(node, globeBtn, config.recvLang);
            });

            const altBtn = document.createElement('button');
            altBtn.type = 'button';
            altBtn.className = 'blank-button button HideOnPopup mat-alt-btn';
            altBtn.setAttribute('role', 'menuitem');
            altBtn.setAttribute('tabindex', '0');
            altBtn.innerHTML = `<span style="font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-weight:bold;">▾</span><div role="tooltip" class="button-tooltip button-tooltip-left" style="font-size:12px;">${isZH() ? '選擇語言翻譯' : 'Translate to...'}</div>`;
            altBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openMATLangSelect(altBtn, async (tmpLang) => manualTranslateMessage(node, altBtn, tmpLang));
            });

            if (replyBtn) { menubar.insertBefore(altBtn, replyBtn); menubar.insertBefore(globeBtn, altBtn); }
            else { menubar.appendChild(globeBtn); menubar.appendChild(altBtn); }

        } else if (node.classList.contains('ChatMessageAction') || node.classList.contains('ChatMessageNonDialogue')) {
            const wrap = document.createElement('span');
            wrap.className = 'mat-action-btn-wrap';

            const globeBtn = document.createElement('button');
            globeBtn.type = 'button';
            globeBtn.style.cssText = 'all:unset;cursor:pointer;font-size:1em;line-height:1;display:inline-flex;align-items:center;padding:0 2px;';
            globeBtn.textContent = '🌐';
            globeBtn.title = `翻譯為 ${config.recvLang.toUpperCase()}`;
            globeBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); e.preventDefault();
                await manualTranslateMessage(node, globeBtn, config.recvLang);
            });

            const altBtn = document.createElement('button');
            altBtn.type = 'button';
            altBtn.style.cssText = 'all:unset;cursor:pointer;font-size:1em;line-height:1;display:inline-flex;align-items:center;padding:0 2px;color:rgba(180,255,180,0.8);font-weight:bold;';
            altBtn.textContent = '▾';
            altBtn.title = isZH() ? '臨時選擇翻譯語言' : 'Translate to...';
            altBtn.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                openMATLangSelect(altBtn, async (tmpLang) => manualTranslateMessage(node, altBtn, tmpLang));
            });

            wrap.appendChild(globeBtn);
            wrap.appendChild(altBtn);

            let firstTextNode = null;
            for (let i = 0; i < node.childNodes.length; i++) {
                if (node.childNodes[i].nodeType === Node.TEXT_NODE && node.childNodes[i].textContent.trim()) {
                    firstTextNode = node.childNodes[i]; break;
                }
            }
            if (firstTextNode) firstTextNode.before(wrap); else node.appendChild(wrap);
        }
    }

    async function manualTranslateMessage(node, btn, targetLang) {
        const lang = targetLang || config.recvLang;
        const getTip = () => btn.querySelector?.('[role="tooltip"]') || btn.querySelector?.('.mat-tooltip');

        const existing = node.nextElementSibling;
        if (existing?.classList.contains('mat-manual-translated') && existing.dataset.lang === lang) {
            existing.remove();
            const tip = getTip();
            if (tip) tip.textContent = `翻譯為 ${config.recvLang.toUpperCase()}`;
            return;
        }

        const message = extractCleanMessage(node);
        if (!message) return;

        const tip = getTip();
        if (tip) tip.textContent = isZH() ? '翻譯中...' : 'Translating...';

        // 手動翻譯不受 config.enabled 影響，直接走 queue
        const { translated } = await translateQueue.add(message, lang);

        if (tip) tip.textContent = isZH() ? '點擊移除翻譯' : 'Click to remove';

        const div = document.createElement('div');
        div.dataset.lang = lang;
        const cls = [...node.classList].find(c => c.startsWith('ChatMessage') && c !== 'ChatMessage' && c !== 'ChatMessageNonDialogue');
        div.classList.add('ChatMessage', 'mat-manual-translated');
        if (cls) div.classList.add(cls);
        div.textContent = `[🌐${lang.toUpperCase()}] ${translated}`;
        div.style.cssText = 'background:rgba(33,150,243,0.12);border-left:3px solid #2196F3;padding:2px 6px;margin-top:2px;font-size:0.95em;opacity:0.95;cursor:pointer';
        div.title = isZH() ? '點擊移除翻譯' : 'Click to remove';
        div.addEventListener('click', () => {
            div.remove();
            const t = getTip();
            if (t) t.textContent = `翻譯為 ${config.recvLang.toUpperCase()}`;
        });

        let insertAfter = node;
        while (insertAfter.nextElementSibling?.classList.contains('mat-translated') ||
               insertAfter.nextElementSibling?.classList.contains('mat-manual-translated')) {
            insertAfter = insertAfter.nextElementSibling;
        }
        node.parentNode.insertBefore(div, insertAfter.nextSibling);

        const log = document.querySelector('#TextAreaChatLog');
        if (log) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 50);
    }

    // ============================================================
    // 選取翻譯氣泡（受 config.translateSelection 控制）
    // ============================================================
    let selectionPopup = null;
    let selectionTimer = null;

    function createSelectionPopup() {
        if (selectionPopup) return;
        selectionPopup = document.createElement('div');
        selectionPopup.id = 'mat-selection-popup';
        selectionPopup.style.cssText = 'position:fixed;z-index:99999;background:#1a1a2e;border:1px solid #4CAF50;border-radius:6px;padding:4px 8px;box-shadow:0 4px 16px rgba(0,0,0,0.5);display:none;flex-direction:column;gap:4px;min-width:80px;max-width:280px;font-family:sans-serif;font-size:13px;color:#eee;pointer-events:all;';

        const translateBtn = document.createElement('button');
        translateBtn.id = 'mat-sel-btn';
        translateBtn.textContent = `🌐 ${config.recvLang.toUpperCase()}`;
        translateBtn.style.cssText = 'background:#4CAF50;color:white;border:none;border-radius:4px 0 0 4px;padding:4px 10px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap;';
        translateBtn.addEventListener('mousedown', async (e) => {
            e.preventDefault(); e.stopPropagation();
            translateBtn.textContent = `🌐 ${config.recvLang.toUpperCase()}`;
            await translateSelectedText(config.recvLang);
        });

        const altLangBtn = document.createElement('button');
        altLangBtn.textContent = '▾';
        altLangBtn.title = isZH() ? '臨時選擇語言' : 'Other language';
        altLangBtn.style.cssText = 'background:#388E3C;color:white;border:none;border-left:1px solid rgba(255,255,255,0.3);border-radius:0 4px 4px 0;padding:4px 8px;cursor:pointer;font-size:15px;font-weight:bold;';
        altLangBtn.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            openMATLangSelect(altLangBtn, async (tmpLang) => translateSelectedText(tmpLang));
        });

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;align-items:stretch;';
        btnRow.appendChild(translateBtn);
        btnRow.appendChild(altLangBtn);
        selectionPopup.appendChild(btnRow);

        const result = document.createElement('div');
        result.id = 'mat-selection-result';
        result.style.cssText = 'display:none;background:rgba(76,175,80,0.08);border-radius:4px;padding:4px 6px;color:#cfc;font-size:12px;line-height:1.5;word-break:break-word;max-height:120px;overflow-y:auto;';
        selectionPopup.appendChild(result);
        document.body.appendChild(selectionPopup);
    }

    function showSelectionPopup(x, y) {
        if (!selectionPopup) createSelectionPopup();
        const result = document.getElementById('mat-selection-result');
        if (result) { result.style.display = 'none'; result.textContent = ''; }
        const btn = document.getElementById('mat-sel-btn');
        if (btn) btn.textContent = `🌐 ${config.recvLang.toUpperCase()}`;

        selectionPopup.style.display = 'flex';

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0).getBoundingClientRect();
            x = range.left + range.width / 2;
            y = range.top - 8;
        } else {
            y = y - 50;
        }

        const pw = selectionPopup.offsetWidth || 180;
        const ph = selectionPopup.offsetHeight || 40;
        let left = x - pw / 2;
        let top = y - ph - 4;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (left < 4) left = 4;
        if (top < 4) top = y + 18;

        selectionPopup.style.left = `${left}px`;
        selectionPopup.style.top = `${top}px`;
    }

    function hideSelectionPopup() {
        if (!selectionPopup) return;
        selectionPopup.style.display = 'none';
        const result = document.getElementById('mat-selection-result');
        if (result) { result.style.display = 'none'; result.textContent = ''; }
    }

    async function translateSelectedText(targetLang) {
        const lang = targetLang || config.recvLang;
        const selected = window.getSelection()?.toString().trim();
        if (!selected) return;
        const result = document.getElementById('mat-selection-result');
        if (!result) return;
        result.style.display = 'block';
        result.style.color = '#888';
        result.textContent = isZH() ? '翻譯中...' : 'Translating...';
        // 選取翻譯不受 config.enabled 影響，直接走 queue
        const { translated } = await translateQueue.add(selected, lang);
        result.style.color = '#aeffae';
        result.textContent = `[${lang.toUpperCase()}] ${translated}`;
    }

    function setupSelectionListener() {
        document.addEventListener('mouseup', (e) => {
            // 選取翻譯：受 translateSelection 控制
            if (!config.translateSelection) return;
            if (selectionPopup?.contains(e.target)) return;
            clearTimeout(selectionTimer);
            selectionTimer = setTimeout(() => {
                const sel = window.getSelection();
                const txt = sel?.toString().trim();
                if (txt && txt.length > 1) showSelectionPopup(e.clientX, e.clientY);
                else hideSelectionPopup();
            }, 200);
        });
        document.addEventListener('mousedown', (e) => {
            if (selectionPopup?.contains(e.target)) return;
            hideSelectionPopup();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideSelectionPopup();
        });
    }

    // === 發送翻譯 ===
    function hookSendFunctions() {
        if (!modApi) return;

        modApi.hookFunction("ServerSend", 10, (args, next) => {
            const [command, data] = args;
            if (!config.enabled || !config.translateSent) return next(args);
            const safeStr = (v) => typeof v === 'string' ? v : null;

            if (command === "ChatRoomChat" && data.Type === "Chat") {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== t) ServerSend("ChatRoomChat", { Content: `[🌐] ${r}`, Type: "Chat" });
                    });
                    return;
                }
            }
            if (command === "ChatRoomChat" && data.Type === "Action") {
                const t = safeStr(data.Dictionary?.[0]?.Text);
                if (t && !t.includes('[🌐]')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== t) ServerSend("ChatRoomChat", {
                            Type: "Action", Content: "CUSTOM_SYSTEM_ACTION",
                            Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: `[🌐] ${r}` }]
                        });
                    });
                    return;
                }
            }
            if (command === "ChatRoomChat" && data.Type === "Whisper") {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== t) ServerSend("ChatRoomChat", { Content: `[🌐] ${r}`, Type: "Whisper", Target: data.Target, Sender: data.Sender });
                    });
                    return;
                }
            }
            if (command === "AccountBeep") {
                const t = safeStr(data.Message);
                if (t && !t.includes('[🌐]') && (!data.BeepType || data.BeepType === '') && isUserMessage(t) && !t.trim().startsWith('{')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== t) ServerSend("AccountBeep", { MemberNumber: data.MemberNumber, Message: `[🌐] ${r}` });
                    });
                    return;
                }
            }
            return next(args);
        });

        modApi.hookFunction("ChatRoomSendEmote", 10, (args, next) => {
            if (!config.enabled || !config.translateSent) return next(args);
            const [t] = args;
            if (t && !t.includes('[🌐]')) {
                next(args);
                smartTranslate(t, config.sendLang).then(r => { if (r !== t) ChatRoomSendEmote(`[🌐] ${r}`); });
                return;
            }
            return next(args);
        });

        console.log("[MAT] Send hooks installed");
    }

    // === 語言 ===
    function isZH() {
        if (typeof TranslationLanguage !== "undefined") {
            const l = TranslationLanguage.toLowerCase();
            return l.startsWith("zh") || l.includes("cn");
        }
        return (navigator.language || "en").toLowerCase().startsWith("zh");
    }

    const langCodes   = ['zh','en','ja','ko','de','fr','es','ru','it','pt','ar','th','vi','id','pl','nl','tr','sv'];
    const langNameZH  = ['中文','英文','日文','韓文','德文','法文','西文','俄文','義大利文','葡文','阿拉伯文','泰文','越文','印尼文','波蘭文','荷文','土耳其文','瑞典文'];
    const langNameEN  = ['Chinese','English','Japanese','Korean','German','French','Spanish','Russian','Italian','Portuguese','Arabic','Thai','Vietnamese','Indonesian','Polish','Dutch','Turkish','Swedish'];
    const langNameNative = ['中文','English','日本語','한국어','Deutsch','Français','Español','Русский','Italiano','Português','العربية','ภาษาไทย','Tiếng Việt','Bahasa Indonesia','Polski','Nederlands','Türkçe','Svenska'];
    let uiSendIdx = 0;
    let uiRecvIdx = 0;

    function getLangName(code) {
        const idx = langCodes.indexOf(code);
        if (idx === -1) return code;
        return isZH() ? langNameZH[idx] : langNameEN[idx];
    }

    // ============================================================
    // 設定頁
    // ============================================================
    const matSettingsScreen = {
        load() {
            uiSendIdx = Math.max(0, langCodes.indexOf(config.sendLang));
            uiRecvIdx = Math.max(0, langCodes.indexOf(config.recvLang));
        },
        run() {
            const zh = isZH();
            const names = langNameNative;
            const T = {
                title        : zh ? "機器翻譯設定  v1.1.1" : "Machine Translation Settings  v1.1.1",
                secLeft      : zh ? "── 即時翻譯 ──" : "── Live Translation ──",
                secRight     : zh ? "── 語言設定 ──" : "── Language Settings ──",
                enabled      : zh ? "啟用"           : "Enable",
                recv         : zh ? "接收翻譯"        : "Translate Received",
                send         : zh ? "發送翻譯"        : "Translate Sent",
                chat         : zh ? "手動翻譯按鈕"    : "Manual Translate Button",
                selection    : zh ? "選取翻譯"        : "Selection Translate",
                recvLangLabel: zh ? "接收語言："       : "Recv Lang: ",
                sendLangLabel: zh ? "發送語言："       : "Send Lang: ",
                recvLangTip  : zh ? "接收語言"        : "Recv Lang",
                sendLangTip  : zh ? "發送語言"        : "Send Lang",
                desc12: zh ? "該插件為聊天室即時翻譯插件，支援 Bio 翻譯，使用 Google 翻譯 API" : "Chat room live translation plugin with Bio support, powered by Google Translate API",
                desc3 : zh ? "插件停用時不影響 Bio 與選取翻譯（需開啟）的功能" : "Disabling does not affect Bio or Selection translate (if enabled)",
                desc4 : zh ? "請依照需求設定語言與功能，另外也支援 /mat 即時設定" : "Configure as needed. You can also use /mat for live settings",
                back  : zh ? "返回" : "Back",
            };

            const L_CB   = 400;
            const L_TXT  = 484;
            const L_TXTW = 500;
            const R_LBL  = 1050;
            const R_LBLW = 220;
            const R_BTN  = 1290;
            const BTN_W  = 280;
            const CB_SZ  = 64;

            const secY       = 185;
            const enabledY   = 225;
            const recvY      = 315;
            const sendY      = 405;
            const chatY      = 495;
            const selectionY = 585;

            const withLeft = (fn) => {
                const prev = MainCanvas.textAlign;
                MainCanvas.textAlign = "left";
                try { fn(); } finally { MainCanvas.textAlign = prev; }
            };

            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", T.back);
            DrawText(T.title, 1000, 105, "White", "Black");
            DrawText(T.secLeft,  630,  secY, "#4CAF50", "Black");
            DrawText(T.secRight, 1300, secY, "#4CAF50", "Black");

            DrawCheckbox(L_CB, enabledY,   CB_SZ, CB_SZ, "", config.enabled);
            DrawCheckbox(L_CB, recvY,      CB_SZ, CB_SZ, "", config.translateReceived,  !config.enabled);
            DrawCheckbox(L_CB, sendY,      CB_SZ, CB_SZ, "", config.translateSent,      !config.enabled);
            DrawCheckbox(L_CB, chatY,      CB_SZ, CB_SZ, "", config.translateChat,      !config.enabled);
            DrawCheckbox(L_CB, selectionY, CB_SZ, CB_SZ, "", config.translateSelection);

            withLeft(() => {
                const lx = L_TXT, lw = L_TXTW;
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(T.enabled,   lx, rowMid(enabledY),   lw, "White");
                DrawTextFit(T.recv,      lx, rowMid(recvY),      lw, config.enabled ? "White" : "Gray");
                DrawTextFit(T.send,      lx, rowMid(sendY),      lw, config.enabled ? "White" : "Gray");
                DrawTextFit(T.chat,      lx, rowMid(chatY),      lw, config.enabled ? "White" : "Gray");
                DrawTextFit(T.selection, lx, rowMid(selectionY), lw, "White");
            });

            withLeft(() => {
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(T.recvLangLabel, R_LBL, rowMid(recvY), R_LBLW, "White");
                DrawTextFit(T.sendLangLabel, R_LBL, rowMid(sendY), R_LBLW, "White");
            });
            DrawButton(R_BTN, recvY, BTN_W, CB_SZ, names[uiRecvIdx], "White", "", T.recvLangTip);
            DrawButton(R_BTN, sendY, BTN_W, CB_SZ, names[uiSendIdx], "White", "", T.sendLangTip);

            DrawRect(395, 665, 1180, 2, "rgba(255,255,255,0.15)");

            DrawText(T.desc12, 1000, 705, "Silver",  "Black");
            DrawText(T.desc3,  1000, 760, "#aaffaa", "Black");
            DrawText(T.desc4,  1000, 815, "Gray",    "Black");
        },
        click() {
            if (MouseIn(1815, 75, 90, 90)) { closeLangSelect(); if (typeof PreferenceExit === "function") PreferenceExit(); return; }

            const L_CB = 400;
            const CB_SZ = 64;
            const enabledY   = 225;
            const recvY      = 315;
            const sendY      = 405;
            const chatY      = 495;
            const selectionY = 585;
            const R_BTN = 1290, BTN_W = 280;

            if (MouseIn(L_CB, enabledY, CB_SZ, CB_SZ)) {
                config.enabled = !config.enabled;
                if (config.enabled) startObserver(); else stopObserver();
                saveSettings(); return;
            }
            if (config.enabled && MouseIn(L_CB, recvY, CB_SZ, CB_SZ)) {
                config.translateReceived = !config.translateReceived; saveSettings(); return;
            }
            if (config.enabled && MouseIn(L_CB, sendY, CB_SZ, CB_SZ)) {
                config.translateSent = !config.translateSent; saveSettings(); return;
            }
            if (MouseIn(R_BTN, sendY, BTN_W, CB_SZ)) {
                const canvas = document.querySelector('canvas');
                const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:2000,height:1000};
                openLangSelect('send', rect.left + R_BTN*(rect.width/2000), rect.top + sendY*(rect.height/1000));
                return;
            }
            if (config.enabled && MouseIn(L_CB, chatY, CB_SZ, CB_SZ)) {
                config.translateChat = !config.translateChat;
                stopObserver();
                if (config.enabled) setTimeout(startObserver, 100);
                saveSettings(); return;
            }
            if (MouseIn(R_BTN, recvY, BTN_W, CB_SZ)) {
                const canvas = document.querySelector('canvas');
                const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:2000,height:1000};
                openLangSelect('recv', rect.left + R_BTN*(rect.width/2000), rect.top + recvY*(rect.height/1000));
                return;
            }
            if (MouseIn(L_CB, selectionY, CB_SZ, CB_SZ)) {
                config.translateSelection = !config.translateSelection;
                if (!config.translateSelection) hideSelectionPopup();
                saveSettings(); return;
            }
        },
        unload() { closeLangSelect(); },
        exit() { closeLangSelect(); }
    };

    function waitForPreference() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof PreferenceRegisterExtensionSetting === "function" && typeof TranslationLanguage !== "undefined") resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    waitForPreference().then(() => {
        PreferenceRegisterExtensionSetting({
            Identifier: "MachineTranslation",
            ButtonText: isZH() ? "機器翻譯設定" : "MAT Settings",
            Image: "Icons/Chat.png",
            load:   () => matSettingsScreen.load(),
            run:    () => matSettingsScreen.run(),
            click:  () => matSettingsScreen.click(),
            unload: () => matSettingsScreen.unload(),
            exit:   () => matSettingsScreen.exit()
        });
    });

    // === 房間事件 ===
    function hookRoomEvents() {
        if (!modApi) return;
        modApi.hookFunction("ChatRoomLeave", 4, (args, next) => { stopObserver(); return next(args); });
        modApi.hookFunction("ChatRoomSync", 4, (args, next) => {
            const result = next(args);
            if (config.enabled) { stopObserver(); setTimeout(startObserver, 500); }
            return result;
        });
    }

    // ============================================================
    // Bio 翻譯
    //
    // 快取設計：
    //   key   = "{memberNumber}_{recvLang}"  （玩家ID + 目標語言）
    //   value = { hash: strHash(Bio內容), translated: "...", ts: Date.now() }
    //   命中條件：key 存在 AND hash 相符 AND 未超過 TTL
    //   → Bio 更新後 hash 不同，自動重翻，不受 TTL 限制
    //   → 同一 session 重複查同一人且 Bio 沒變，直接返回快取
    //   TTL = 10 分鐘（正常不會重複查，到期自動清）
    //   Max entries = 30（LRU 淘汰最舊）
    // ============================================================
    const BIO_TRANS_ID = 'mat-bio-translated';
    let bioTranslating = false;
    let bioCurrentMemberNumber = null; // 當前查閱的玩家 ID，由 hook 設定
    const bioCache = new Map();
    const BIO_CACHE_TTL = 10 * 60 * 1000; // 10 分鐘

    function bioCacheGet(memberNum, recvLang, contentHash) {
        const key = `${memberNum}_${recvLang}`;
        const e = bioCache.get(key);
        if (!e) return null;
        if (Date.now() - e.ts > BIO_CACHE_TTL) { bioCache.delete(key); return null; } // TTL 過期
        if (e.hash !== contentHash) { bioCache.delete(key); return null; }             // Bio 內容有變
        return e.translated;
    }

    function bioCacheSet(memberNum, recvLang, contentHash, translated) {
        const key = `${memberNum}_${recvLang}`;
        if (bioCache.size >= 30) {
            // LRU：淘汰最舊的一筆
            const oldest = [...bioCache.entries()].sort((a,b) => a[1].ts - b[1].ts)[0][0];
            bioCache.delete(oldest);
        }
        bioCache.set(key, { hash: contentHash, translated, ts: Date.now() });
    }

    function strHash(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
        return (h >>> 0).toString(36);
    }

    function normalizeUnicodeText(text) {
        const ranges = [
            [0x1D400,0x41,26],[0x1D41A,0x61,26],[0x1D434,0x41,26],[0x1D44E,0x61,26],
            [0x1D468,0x41,26],[0x1D482,0x61,26],[0x1D49C,0x41,26],[0x1D4B6,0x61,26],
            [0x1D4D0,0x41,26],[0x1D4EA,0x61,26],[0x1D504,0x41,26],[0x1D51E,0x61,26],
            [0x1D538,0x41,26],[0x1D552,0x61,26],[0x1D56C,0x41,26],[0x1D586,0x61,26],
            [0x1D5A0,0x41,26],[0x1D5BA,0x61,26],[0x1D5D4,0x41,26],[0x1D5EE,0x61,26],
            [0x1D608,0x41,26],[0x1D622,0x61,26],[0x1D63C,0x41,26],[0x1D656,0x61,26],
            [0x1D670,0x41,26],[0x1D68A,0x61,26],[0x1D7CE,0x30,10],[0x1D7D8,0x30,10],
            [0x1D7E2,0x30,10],[0x1D7EC,0x30,10],[0x1D7F6,0x30,10],
            [0xFF21,0x41,26],[0xFF41,0x61,26],[0xFF10,0x30,10],[0x24B6,0x41,26],[0x24D0,0x61,26],
        ];
        const map = new Map();
        for (const [from, to, len] of ranges) for (let i = 0; i < len; i++) map.set(from+i, to+i);
        const exc = {0x1D49E:0x43,0x1D4A0:0x45,0x1D4A1:0x46,0x1D4A3:0x48,0x1D4A4:0x49,
            0x1D4A7:0x4C,0x1D4A8:0x4D,0x1D4AD:0x52,0x1D4BA:0x65,0x1D4BC:0x67,
            0x1D4C4:0x6F,0x1D506:0x43,0x1D50B:0x48,0x1D50C:0x49,0x1D515:0x52,
            0x1D51D:0x5A,0x1D53A:0x43,0x1D53F:0x48,0x1D545:0x4E,0x1D547:0x50,
            0x1D548:0x51,0x1D551:0x5A};
        for (const [k,v] of Object.entries(exc)) map.set(Number(k), v);
        let out = '';
        for (let i = 0; i < text.length; i++) {
            const cp = text.codePointAt(i);
            if (cp > 0xFFFF) i++;
            out += String.fromCodePoint(map.get(cp) ?? cp);
        }
        return out;
    }

    function getBioText() {
        const rich = document.getElementById('bceRichOnlineProfile');
        if (rich) { const orig = rich.getAttribute('bce-original-text'); if (orig) return orig; return rich.textContent || ''; }
        const input = document.getElementById('DescriptionInput');
        return input ? (input.value || '') : '';
    }

    // 更新已存在的翻譯框；若不存在則建立
    function updateBioTranslationDisplay(text) {
        let div = document.getElementById(BIO_TRANS_ID);
        if (!div) {
            showBioTranslation(text);
            return;
        }
        div.textContent = `[🌐 MAT]\n${text}`;
    }

    function showBioTranslation(translatedText) {
        removeBioTranslation();
        const ref = document.getElementById('bceRichOnlineProfile') || document.getElementById('DescriptionInput');
        const div = document.createElement('div');
        div.id = BIO_TRANS_ID;
        div.style.cssText = 'overflow-y:scroll;overflow-x:hidden;overflow-wrap:break-word;white-space:pre-wrap;background:rgb(220,240,220);color:rgb(27,45,27);border:2px solid #4CAF50;padding:2px;position:fixed;z-index:999;font-family:Arial,sans-serif;cursor:pointer;';
        if (ref) {
            const cs = window.getComputedStyle(ref);
            div.style.fontSize = cs.fontSize;
            div.style.left = ref.style.left || cs.left;
            div.style.top = ref.style.top || cs.top;
            div.style.width = ref.style.width || cs.width;
            div.style.height = ref.style.height || cs.height;
        } else {
            Object.assign(div.style, {fontSize:'8.4px', left:'23px', top:'256px', width:'415px', height:'174px'});
        }
        div.title = isZH() ? '點擊關閉翻譯' : 'Click to close';
        div.textContent = `[🌐 MAT]\n${translatedText}`;
        div.addEventListener('click', removeBioTranslation);
        document.body.appendChild(div);
    }

    function removeBioTranslation() { document.getElementById(BIO_TRANS_ID)?.remove(); }

    async function translateBio() {
        if (bioTranslating) return;
        const raw = getBioText();
        if (!raw.trim()) return;
        const normalized = normalizeUnicodeText(raw);
        const contentHash = strHash(normalized);

        // memberNumber 未知時 fallback 到 'unknown'，仍可正常運作
        const memberNum = bioCurrentMemberNumber ?? 'unknown';
        const cached = bioCacheGet(memberNum, config.recvLang, contentHash);
        if (cached) { showBioTranslation(cached); return; }

        bioTranslating = true;
        try {
            const result = await translateBioSmart(normalized, config.recvLang);
            bioCacheSet(memberNum, config.recvLang, contentHash, result);
            updateBioTranslationDisplay(result); // 最終完整版再刷一次確保正確
        } finally {
            bioTranslating = false;
        }
    }

    function hookOnlineProfile() {
        if (!modApi) return;
        try {
            modApi.hookFunction("OnlineProfileRun", 4, (args, next) => {
                const result = next(args);
                DrawButton(1415, 60, 90, 90, "", bioTranslating ? "Gray" : "White", "Icons/Chat.png",
                    isZH() ? (bioTranslating ? "翻譯中..." : "翻譯Bio") : (bioTranslating ? "Translating..." : "Translate Bio"));
                return result;
            });
            modApi.hookFunction("OnlineProfileLoad", 4, (args, next) => {
                // 記錄當前查閱的玩家 ID
                // BC 慣例：CurrentCharacter 或 InspectCharacter 指向被查閱的角色
                try {
                    const target = typeof InspectCharacter !== "undefined" ? InspectCharacter
                                 : typeof CurrentCharacter !== "undefined" ? CurrentCharacter
                                 : null;
                    bioCurrentMemberNumber = target?.MemberNumber ?? null;
                } catch { bioCurrentMemberNumber = null; }
                return next(args);
            });
            modApi.hookFunction("OnlineProfileClick", 4, (args, next) => {
                if (MouseIn(1415, 60, 90, 90)) {
                    document.getElementById(BIO_TRANS_ID) ? removeBioTranslation() : translateBio();
                    return;
                }
                return next(args);
            });
            modApi.hookFunction("OnlineProfileUnload", 4, (args, next) => {
                removeBioTranslation();
                bioTranslating = false;
                bioCurrentMemberNumber = null;
                return next(args);
            });
            console.log("[MAT] OnlineProfile hook installed");
        } catch(e) { console.warn("[MAT] OnlineProfile hook failed:", e); }
    }

    // === 初始化 ===
    function waitForSettings(callback, retries = 30) {
        if (Player?.OnlineSettings) callback();
        else if (retries > 0) setTimeout(() => waitForSettings(callback, retries - 1), 500);
        else { console.warn("[MAT] OnlineSettings timeout, forcing init"); callback(); }
    }

    function waitForGame() {
        if (typeof Player?.MemberNumber === "number" && typeof CommandCombine === "function") {
            initializeConfig();
            waitForSettings(() => {
                loadSettings();
                registerCommands();
                hookSendFunctions();
                hookRoomEvents();
                hookOnlineProfile();
                setupSelectionListener();
                if (config.enabled) startObserver();
            });
        } else {
            setTimeout(waitForGame, 500);
        }
    }

    function registerCommands() {
        CommandCombine([{
            Tag: "mat",
            Description: "Machine Translation settings (/mat help)",
            Action: function(text) {
                const args = text.split(" ");
                const cmd = args[0]?.toLowerCase();
                switch(cmd) {
                    case "": case "help": showHelp(); break;
                    case "on":  config.enabled = true;  startObserver(); saveSettings(); ChatRoomSendLocal("✅ 聊天室翻譯已開啟"); break;
                    case "off": config.enabled = false; stopObserver();  saveSettings(); ChatRoomSendLocal("❌ 聊天室翻譯已關閉"); break;
                    case "recv":      config.translateReceived  = !config.translateReceived;  saveSettings(); ChatRoomSendLocal(`整句自動翻譯: ${config.translateReceived  ? '✅' : '❌'}`); break;
                    case "send":      config.translateSent      = !config.translateSent;      saveSettings(); ChatRoomSendLocal(`發送翻譯: ${config.translateSent      ? '✅' : '❌'}`); break;
                    case "chat":      config.translateChat      = !config.translateChat;      stopObserver(); if(config.enabled) setTimeout(startObserver,100); saveSettings(); ChatRoomSendLocal(`手動翻譯按鈕: ${config.translateChat      ? '✅' : '❌'}`); break;
                    case "selection": config.translateSelection = !config.translateSelection; if(!config.translateSelection) hideSelectionPopup(); saveSettings(); ChatRoomSendLocal(`選取翻譯: ${config.translateSelection ? '✅' : '❌'}`); break;
                    case "sendlang":  handleLangCommand(args[1], 'send'); break;
                    case "recvlang":  handleLangCommand(args[1], 'recv'); break;
                    case "test":   testTranslation(args.slice(1).join(" ")); break;
                    case "status": showStatus(); break;
                    default: ChatRoomSendLocal("❓ 未知指令，使用 /mat help");
                }
            }
        }]);
        ChatRoomSendLocal("🌐 [MAT] v1.1.1 loaded! Use /mat help");
    }

    function showHelp() {
        ChatRoomSendLocal(`<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;font-size:13px;'>
            <h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v1.1.1</h3>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>開關指令</b><br>
                <b style='color:#87CEEB;'>/mat on/off</b> — 聊天室翻譯總開關<br>
                <b style='color:#87CEEB;'>/mat recv</b> — 切換整句自動翻譯<br>
                <b style='color:#87CEEB;'>/mat send</b> — 切換發送翻譯<br>
                <b style='color:#87CEEB;'>/mat chat</b> — 切換手動翻譯按鈕<br>
                <b style='color:#87CEEB;'>/mat selection</b> — 切換選取翻譯（獨立）<br>
                <b style='color:#87CEEB;'>/mat recvlang/sendlang [代碼]</b> — 設定語言<br>
                <b style='color:#87CEEB;'>/mat test [文字]</b> — 測試翻譯<br>
                <b style='color:#87CEEB;'>/mat status</b> — 查看狀態
            </div>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>功能</b><br>
                <span style='color:#aaa'>・ hover 訊息 → 🌐 翻譯 / ▾ 選語言（需手動按鈕開啟）</span><br>
                <span style='color:#aaa'>・ 選取文字 → 氣泡翻譯（獨立開關）</span><br>
                <span style='color:#aaa'>・ Bio 翻譯永遠可用，逐行顯示不卡頓</span><br>
                <span style='color:#aaa'>・ 裝飾字體自動轉換（𝕙𝕖𝕝𝕝𝕠→hello）</span>
            </div>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>18 種語言</b><br>
                zh en ja ko de fr es ru it pt ar th vi id pl nl tr sv
            </div>
        </div>`);
    }

    function handleLangCommand(langCode, type) {
        if (langCode && langCodes.includes(langCode)) {
            if (type === 'send') { config.sendLang = langCode; saveSettings(); ChatRoomSendLocal(`✅ 發送語言: ${getLangName(langCode)}`); }
            else { config.recvLang = langCode; saveSettings(); ChatRoomSendLocal(`✅ 接收語言: ${getLangName(langCode)}`); }
        } else {
            ChatRoomSendLocal(`當前 - 發送: ${getLangName(config.sendLang)} | 接收: ${getLangName(config.recvLang)}`);
        }
    }

    function showStatus() {
        ChatRoomSendLocal(`<div style='background:#1a1a2e;color:#eee;padding:8px;border-radius:5px;'>
            <h4 style='color:#4CAF50;'>📊 MAT v1.1.1 狀態</h4>
            聊天室總開關: ${config.enabled ? '🟢' : '🔴'}<br>
            整句自動翻譯: ${config.translateReceived ? '✅' : '❌'} → ${getLangName(config.recvLang)}<br>
            發送翻譯: ${config.translateSent ? '✅' : '❌'} → ${getLangName(config.sendLang)}<br>
            手動翻譯按鈕: ${config.translateChat ? '✅' : '❌'}<br>
            選取翻譯（獨立）: ${config.translateSelection ? '✅' : '❌'}<br>
            Bio翻譯: 🟢 永遠可用（逐行顯示）
        </div>`);
    }

    async function testTranslation(text) {
        if (!text) { ChatRoomSendLocal("請提供要測試的文字"); return; }
        ChatRoomSendLocal("翻譯中...");
        const r1 = await translateQueue.add(text, config.recvLang);
        const r2 = await translateQueue.add(text, config.sendLang);
        ChatRoomSendLocal(`接收翻譯: ${r1.translated}<br>發送翻譯: ${r2.translated}`);
    }

})();
