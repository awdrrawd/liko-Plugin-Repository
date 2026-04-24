// ==UserScript==
// @name         Liko - MAT
// @name:zh      Liko的自動翻譯(使用Google api)
// @namespace    https://likolisu.dev/
// @version      1.2.2
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
    let myversion = "1.2.2";
    let observer = null;

    let config = {
        enabled: true,
        sendLang: 'en',
        recvLang: 'zh-CN',
        translateReceived: true,
        translateSent: false,
        translateSelection: true,
        translateChat: true,
        autoScroll: true,
        // 快捷鍵設定
        hotkeys: {
            toggle: { key: 'KeyM', modifiers: ['Ctrl'] }
        }
    };

    (function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `/* MAT v${myversion} */`;
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
                    console.warn("🐈‍⬛ [MAT] ❌ bcModSdk 等待超時，插件無法載入");
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
            console.log("🐈‍⬛ [MAT] ✅ loaded");
        } catch (e) {
            console.error("🐈‍⬛ [MAT] ❌ failed to load:", e);
            return;
        }
        waitForGame();
    });

    function initializeConfig() {
        const defaults = {
            enabled: true,
            sendLang: 'en',
            recvLang: 'zh-CN',
            translateReceived: true,
            translateSent: false,
            translateSelection: true,
            translateChat: true,
            autoScroll: true,
            hotkeys: {
                toggle: { key: 'KeyM', modifiers: ['Ctrl'] }
            }
        };
        if (!config || typeof config !== 'object') config = { ...defaults };
        for (const [key, val] of Object.entries(defaults)) {
            if (config[key] === undefined) config[key] = val;
        }
        // 確保 hotkeys 結構完整（向下相容舊版設定）
        if (!config.hotkeys || typeof config.hotkeys !== 'object') config.hotkeys = defaults.hotkeys;
        if (!config.hotkeys.toggle) config.hotkeys.toggle = defaults.hotkeys.toggle;
    }

    function saveSettings() {
        if (!Player?.ExtensionSettings) {
            ChatRoomSendLocal("⚠️ 未登入，無法保存翻譯設定");
            return;
        }
        Player.ExtensionSettings.BCMachineTranslation = { ...config };
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync("BCMachineTranslation");
        }
    }

    function loadSettings() {
        if (!Player?.ExtensionSettings?.BCMachineTranslation) return;
        config = { ...config, ...Player.ExtensionSettings.BCMachineTranslation };
        if (!config.hotkeys || typeof config.hotkeys !== 'object') {
            config.hotkeys = { toggle: { key: 'KeyM', modifiers: ['Ctrl'] } };
        }
        if (!config.hotkeys.toggle) {
            config.hotkeys.toggle = { key: 'KeyM', modifiers: ['Ctrl'] };
        }
    }

    const MIGRATE_KEYS = ['BCMachineTranslation'];

    function migrateOnlineToExtensionSettings() {
        if (!Player?.OnlineSettings || !Player?.ExtensionSettings) return;
        let migrated = false;
        for (const key of MIGRATE_KEYS) {
            if (Player.OnlineSettings[key] !== undefined) {
                // 只有 ExtensionSettings 還沒有這筆資料時才搬
                if (Player.ExtensionSettings[key] === undefined) {
                    Player.ExtensionSettings[key] = Player.OnlineSettings[key];
                }
                // 無論如何都刪除 OnlineSettings 的舊資料
                delete Player.OnlineSettings[key];
                migrated = true;
            }
        }
        if (migrated) {
            // 只需要更新 OnlineSettings（告訴伺服器刪除舊資料）
            // 不需要 sync ExtensionSettings，因為 loadSettings 之後 saveSettings 會處理
            if (typeof ServerAccountUpdate?.QueueData === "function") {
                ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
            }
            console.log("🐈‍⬛ [MAT] ✅ 舊版設定遷移完成");
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
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const translated = data[0]?.map(seg => seg?.[0] || '').join('') || text;
            return { translated, detectedLang: data[2] || null };
        } catch (e) {
            console.error('Google Translate failed:', e);
            return { translated: text, detectedLang: null, error: e.message };
        }
    }

    const TRANSLATE_MARKER = '[MAT]';

    function isPureUrl(text) {
        if (!text) return false;
        const trimmed = text.trim().replace(/^[\s\(\[\*]+|[\s\)\]\*]+$/g, '').trim();
        return /^https?:\/\//i.test(trimmed);
    }

    async function smartTranslate(text, targetLang) {
        if (!config.enabled || !text) return text;
        if (text.includes('BCX_') || text.match(/^[\d\s:]+$/) ||
            text.includes(TRANSLATE_MARKER) || text.includes('[🌐]')) return text;
        if (isPureUrl(text)) return text;
        try {
            const { translated, error } = await translateQueue.add(message, lang);
            if (error || translated === message) {
                updateClickToolbarStatus(null);
                ChatRoomSendLocal(isZH()
                    ? '⚠️ 翻譯失敗，請確認 Google API 是否可用（俄羅斯等地區可能被封鎖）'
                    : '⚠️ Translation failed. Google API may be blocked in your region.');
                return;
            }
            return translated;
        } catch (e) {
            console.error('🐈‍⬛ [MAT] ❌ Error:', e);
            return text;
        }
    }

    function scrollChatToBottom() {
        if (!config.autoScroll) return;
        const log = document.querySelector('#TextAreaChatLog');
        if (!log) return;
        const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 150;
        if (nearBottom) {
            setTimeout(() => { log.scrollTop = log.scrollHeight; }, 60);
        }
    }

    // ============================================================
    // Bio 翻譯
    // ============================================================
    function isBioSkipLine(line) {
        if (!line.trim()) return true;
        if (/^https?:\/\//.test(line.trim())) return true;
        if (/^[=\-_*#]{3,}$/.test(line.trim())) return true;
        return false;
    }

    async function translateBioSmart(normalized, targetLang, abortToken) {
        const lines = normalized.split('\n');
        const resultLines = [...lines];
        for (let i = 0; i < lines.length; i++) {
            if (abortToken.cancelled) break;
            if (isBioSkipLine(lines[i])) continue;
            try {
                const { translated } = await translateQueue.add(lines[i], targetLang);
                if (abortToken.cancelled) break;
                resultLines[i] = translated;
            } catch (e) {
                resultLines[i] = lines[i];
            }
            if (!abortToken.cancelled) {
                updateBioTranslationDisplay(resultLines.join('\n'));
            }
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
                }
            }
        });
        observer.observe(log, { childList: true });
    }

    function stopObserver() {
        if (!observer) return;
        try { observer.disconnect(); } catch {}
        observer = null;
    }

    async function handleReceivedMessage(node) {
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
        scrollChatToBottom();
    }

    // ============================================================
    // 語言選擇下拉（選取氣泡 & 點選工具列共用）
    // ============================================================
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

    // ============================================================
    // 手動翻譯核心
    // ============================================================
    async function manualTranslateMessage(node, targetLang) {
        const lang = targetLang || config.recvLang;

        let sibling = node.nextElementSibling;
        while (sibling && (sibling.classList.contains('mat-translated') || sibling.classList.contains('mat-manual-translated'))) {
            const next = sibling.nextElementSibling;
            if (sibling.classList.contains('mat-manual-translated')) sibling.remove();
            sibling = next;
        }

        const message = extractCleanMessage(node);
        if (!message) return;

        updateClickToolbarStatus(isZH() ? '翻譯中...' : 'Translating...');

        const { translated } = await translateQueue.add(message, lang);

        updateClickToolbarStatus(null);

        const div = document.createElement('div');
        div.dataset.lang = lang;
        const cls = [...node.classList].find(c => c.startsWith('ChatMessage') && c !== 'ChatMessage' && c !== 'ChatMessageNonDialogue');
        div.classList.add('ChatMessage', 'mat-manual-translated');
        if (cls) div.classList.add(cls);
        div.textContent = `[🌐${lang.toUpperCase()}] ${translated}`;
        div.style.cssText = 'position:relative;background:rgba(33,150,243,0.12);border-left:3px solid #2196F3;padding:2px 24px 2px 6px;margin-top:2px;font-size:0.95em;opacity:0.95;user-select:text;cursor:text;';
        div.title = isZH() ? '雙擊移除翻譯' : 'Double-click to remove';

        div.addEventListener('dblclick', () => div.remove());

        const closeX = document.createElement('span');
        closeX.textContent = '✕';
        closeX.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);color:#888;font-size:11px;cursor:pointer;opacity:0;transition:opacity 0.15s;padding:0 2px;line-height:1;';
        closeX.title = isZH() ? '移除翻譯' : 'Remove';
        closeX.addEventListener('click', (e) => { e.stopPropagation(); div.remove(); });
        div.addEventListener('mouseenter', () => { closeX.style.opacity = '1'; });
        div.addEventListener('mouseleave', () => { closeX.style.opacity = '0'; });
        div.appendChild(closeX);

        let insertAfter = node;
        while (insertAfter.nextElementSibling?.classList.contains('mat-translated') ||
               insertAfter.nextElementSibling?.classList.contains('mat-manual-translated')) {
            insertAfter = insertAfter.nextElementSibling;
        }
        node.parentNode.insertBefore(div, insertAfter.nextSibling);
        scrollChatToBottom();
    }

    // ============================================================
    // 選取翻譯氣泡
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
        const { translated } = await translateQueue.add(selected, lang);
        result.style.color = '#aeffae';
        result.textContent = `[${lang.toUpperCase()}] ${translated}`;
    }

    function setupSelectionListener() {
        document.addEventListener('mouseup', (e) => {
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

    // ============================================================
    // 點選訊息顯示固定翻譯工具列
    // ============================================================
    let clickToolbar = null;
    let clickToolbarTarget = null;

    function createClickToolbar() {
        if (clickToolbar) return;
        clickToolbar = document.createElement('div');
        clickToolbar.id = 'mat-click-toolbar';
        clickToolbar.style.cssText = [
            'position:fixed',
            'z-index:99998',
            'display:none',
            'align-items:center',
            'gap:4px',
            'background:#1a1a2e',
            'border:1px solid #4CAF50',
            'border-radius:6px',
            'padding:3px 8px',
            'box-shadow:0 2px 8px rgba(0,0,0,0.5)',
            'pointer-events:all',
            'user-select:none',
        ].join(';');

        const globeBtn = document.createElement('button');
        globeBtn.id = 'mat-click-globe';
        globeBtn.style.cssText = 'all:unset;cursor:pointer;color:#4CAF50;font-size:14px;padding:3px 6px;border-radius:4px;display:flex;align-items:center;gap:4px;white-space:nowrap;';
        globeBtn.innerHTML = `🌐 <span style="font-size:11px;color:#aaa;">${config.recvLang.toUpperCase()}</span>`;
        globeBtn.addEventListener('mousedown', async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (clickToolbarTarget) await manualTranslateMessage(clickToolbarTarget, config.recvLang);
        });

        const altBtn = document.createElement('button');
        altBtn.id = 'mat-click-alt';
        altBtn.style.cssText = 'all:unset;cursor:pointer;color:#aaa;font-size:14px;padding:3px 6px;border-radius:4px;display:flex;align-items:center;font-weight:bold;';
        altBtn.textContent = '▾';
        altBtn.title = isZH() ? '選擇語言翻譯' : 'Translate to...';
        altBtn.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            const frozenTarget = clickToolbarTarget;
            openMATLangSelect(altBtn, async (tmpLang) => {
                if (frozenTarget) await manualTranslateMessage(frozenTarget, tmpLang);
            });
        });

        const sep = document.createElement('span');
        sep.style.cssText = 'width:1px;height:16px;background:rgba(255,255,255,0.15);margin:0 2px;flex-shrink:0;';

        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'all:unset;cursor:pointer;color:#666;font-size:13px;padding:3px 4px;border-radius:4px;display:flex;align-items:center;';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            hideClickToolbar();
        });

        clickToolbar.appendChild(globeBtn);
        clickToolbar.appendChild(altBtn);
        clickToolbar.appendChild(sep);
        clickToolbar.appendChild(closeBtn);
        document.body.appendChild(clickToolbar);
    }

    function updateClickToolbarStatus(statusText) {
        const globeBtn = document.getElementById('mat-click-globe');
        if (!globeBtn) return;
        if (statusText) {
            globeBtn.innerHTML = `<span style="font-size:11px;color:#FFD700;">${statusText}</span>`;
            globeBtn.style.pointerEvents = 'none';
        } else {
            globeBtn.innerHTML = `🌐 <span style="font-size:11px;color:#aaa;">${config.recvLang.toUpperCase()}</span>`;
            globeBtn.style.pointerEvents = '';
        }
    }

    function showClickToolbar(node) {
        createClickToolbar();

        const globeBtn = document.getElementById('mat-click-globe');
        if (globeBtn) {
            globeBtn.innerHTML = `🌐 <span style="font-size:11px;color:#aaa;">${config.recvLang.toUpperCase()}</span>`;
            globeBtn.style.pointerEvents = '';
        }

        if (clickToolbarTarget && clickToolbarTarget !== node) {
            clickToolbarTarget.style.outline = '';
            clickToolbarTarget.style.borderRadius = '';
        }

        clickToolbarTarget = node;
        clickToolbar.style.display = 'flex';

        const rect = node.getBoundingClientRect();
        const tbW = clickToolbar.offsetWidth || 130;
        const tbH = clickToolbar.offsetHeight || 32;

        let left = rect.left;
        let top  = rect.top - tbH - 4;

        if (left + tbW > window.innerWidth - 8) left = window.innerWidth - tbW - 8;
        if (left < 4) left = 4;
        if (top < 4) top = rect.bottom + 4;

        clickToolbar.style.left = `${left}px`;
        clickToolbar.style.top  = `${top}px`;

        node.style.outline = '1px solid rgba(76,175,80,0.4)';
        node.style.borderRadius = '3px';
    }

    function hideClickToolbar() {
        if (!clickToolbar) return;
        clickToolbar.style.display = 'none';
        if (clickToolbarTarget) {
            clickToolbarTarget.style.outline = '';
            clickToolbarTarget.style.borderRadius = '';
        }
        clickToolbarTarget = null;
    }

    function setupClickTranslateListener() {
        const log = document.querySelector('#TextAreaChatLog');
        if (!log) { setTimeout(setupClickTranslateListener, 1000); return; }

        log.addEventListener('click', (e) => {
            if (!config.translateChat) return;
            if (clickToolbar?.contains(e.target)) return;

            const msg = e.target.closest('.ChatMessage');
            if (!msg ||
                msg.classList.contains('mat-translated') ||
                msg.classList.contains('mat-manual-translated')) {
                hideClickToolbar();
                return;
            }

            if (e.target.closest('.menubar')) return;

            if (clickToolbarTarget === msg) {
                hideClickToolbar();
                return;
            }

            showClickToolbar(msg);
        });

        document.addEventListener('mousedown', (e) => {
            if (!clickToolbar || clickToolbar.style.display === 'none') return;
            if (clickToolbar.contains(e.target)) return;
            if (e.target.closest('#TextAreaChatLog')) return;
            hideClickToolbar();
        });

        log.addEventListener('scroll', () => {
            if (!clickToolbarTarget || !clickToolbar || clickToolbar.style.display === 'none') return;
            const rect = clickToolbarTarget.getBoundingClientRect();
            const tbH = clickToolbar.offsetHeight || 32;
            const tbW = clickToolbar.offsetWidth || 130;
            let top = rect.top - tbH - 4;
            if (top < 4) top = rect.bottom + 4;
            let left = rect.left;
            if (left + tbW > window.innerWidth - 8) left = window.innerWidth - tbW - 8;
            if (left < 4) left = 4;
            clickToolbar.style.top  = `${top}px`;
            clickToolbar.style.left = `${left}px`;
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
    }

    // === 語言 ===
    function isZH() {
        if (typeof TranslationLanguage !== "undefined") {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        return (navigator.language || "en").toLowerCase().startsWith("zh");
    }

    const langCodes = ['zh-TW','zh-CN','en','ja','ko','de','fr','es','ru','it','pt','pl','nl','tr','sv','uk','cs','hu','ro','ar','th','vi','id','ms'];
    const langNameEN = ['Chinese (Traditional)','Chinese (Simplified)','English','Japanese','Korean','German','French','Spanish','Russian','Italian','Portuguese','Polish','Dutch','Turkish','Swedish','Ukrainian','Czech','Hungarian','Romanian','Arabic','Thai','Vietnamese','Indonesian','Malay'];
    const langNameZH = ['繁體中文','簡體中文','英文','日文','韓文','德文','法文','西班牙文','俄文','義大利文','葡萄牙文','波蘭文','荷蘭文','土耳其文','瑞典文','烏克蘭文','捷克文','匈牙利文','羅馬尼亞文','阿拉伯文','泰文','越南文','印尼文','馬來文'];
    const langNameNative = ['繁體中文','简体中文','English','日本語','한국어','Deutsch','Français','Español','Русский','Italiano','Português','Polski','Nederlands','Türkçe','Svenska','Українська','Čeština','Magyar','Română','العربية','ภาษาไทย','Tiếng Việt','Bahasa Indonesia','Bahasa Melayu'];
    let uiSendIdx = 0;
    let uiRecvIdx = 0;

    function getLangName(code) {
        const idx = langCodes.indexOf(code);
        if (idx === -1) return code;
        return isZH() ? langNameZH[idx] : langNameEN[idx];
    }

    // ============================================================
    // 快捷鍵系統
    // ============================================================

    // 可用的按鍵代碼 → 顯示名稱映射（與 BC KeybindingManager.ASCIIKeyboardMap 一致）
    const KEY_DISPLAY = {
        KeyA:'A', KeyB:'B', KeyC:'C', KeyD:'D', KeyE:'E', KeyF:'F',
        KeyG:'G', KeyH:'H', KeyI:'I', KeyJ:'J', KeyK:'K', KeyL:'L',
        KeyM:'M', KeyN:'N', KeyO:'O', KeyP:'P', KeyQ:'Q', KeyR:'R',
        KeyS:'S', KeyT:'T', KeyU:'U', KeyV:'V', KeyW:'W', KeyX:'X',
        KeyY:'Y', KeyZ:'Z',
        Digit0:'0', Digit1:'1', Digit2:'2', Digit3:'3', Digit4:'4',
        Digit5:'5', Digit6:'6', Digit7:'7', Digit8:'8', Digit9:'9',
        F1:'F1', F2:'F2', F3:'F3', F4:'F4', F5:'F5',
        F6:'F6', F7:'F7', F8:'F8', F9:'F9', F10:'F10', F11:'F11', F12:'F12',
    };

    /** 將快捷鍵設定轉成可讀字串，例如 "Ctrl+M" */
    function hotkeyToString(hk) {
        if (!hk || !hk.key) return isZH() ? '（未設定）' : '(none)';
        const mods = (hk.modifiers || []);
        const parts = [];
        if (mods.includes('Ctrl'))  parts.push('Ctrl');
        if (mods.includes('Alt'))   parts.push('Alt');
        if (mods.includes('Shift')) parts.push('Shift');
        parts.push(KEY_DISPLAY[hk.key] || hk.key);
        return parts.join('+');
    }

    /** 比對一個 KeyboardEvent 是否符合快捷鍵設定 */
    function matchesHotkey(event, hk) {
        if (!hk || !hk.key) return false;
        if (event.code !== hk.key) return false;
        const mods = hk.modifiers || [];
        if (event.ctrlKey  !== mods.includes('Ctrl'))  return false;
        if (event.altKey   !== mods.includes('Alt'))   return false;
        if (event.shiftKey !== mods.includes('Shift')) return false;
        return true;
    }

    /** 全局 keydown 監聽，負責觸發 MAT 快捷鍵 */
    function setupHotkeyListener() {
        document.addEventListener('keydown', (e) => {
            // IME 組字中不觸發（避免干擾中文輸入）
            if (e.isComposing || e.keyCode === 229) return;

            // 沒有修飾鍵時不在輸入框觸發（避免攔截純文字輸入）
            // 有 Ctrl / Alt 修飾鍵時允許在輸入框內觸發，與 BC 原生行為一致
            const hk = config.hotkeys.toggle;
            const mods = hk?.modifiers || [];
            const hasModifier = mods.includes('Ctrl') || mods.includes('Alt');
            if (!hasModifier) {
                const tag = document.activeElement?.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea') return;
            }

            if (matchesHotkey(e, hk)) {
                e.preventDefault();
                config.enabled = !config.enabled;
                if (config.enabled) {
                    startObserver();
                    ChatRoomSendLocal(`✅ MAT ${isZH() ? '已開啟' : 'enabled'} (${hotkeyToString(hk)})`);
                } else {
                    stopObserver();
                    ChatRoomSendLocal(`❌ MAT ${isZH() ? '已關閉' : 'disabled'} (${hotkeyToString(hk)})`);
                }
                saveSettings();
            }
        }, true); // useCapture=true，確保最優先
    }

    // ============================================================
    // 快捷鍵設定 UI（嵌入在 MAT 設定畫面的右欄下方）
    // ============================================================

    // 錄製狀態
    let hotkeyRecording = false;
    let hotkeyRecordingTarget = null; // 目前正在錄製的快捷鍵名稱，例如 'toggle'

    /** 開始錄製快捷鍵，點擊按鈕後呼叫 */
    function startHotkeyRecording(actionName) {
        hotkeyRecording = true;
        hotkeyRecordingTarget = actionName;
    }

    /** keydown 回呼：在錄製模式下捕捉按鍵 */
    function handleHotkeyRecording(e) {
        if (!hotkeyRecording || !hotkeyRecordingTarget) return false;

        // 單純修飾鍵不記錄
        if (['Control','Alt','Shift','Meta'].includes(e.key)) return false;

        e.preventDefault();
        e.stopPropagation();

        const mods = [];
        if (e.ctrlKey)  mods.push('Ctrl');
        if (e.altKey)   mods.push('Alt');
        if (e.shiftKey) mods.push('Shift');

        if (e.key === 'Escape') {
            // Esc = 取消錄製
            hotkeyRecording = false;
            hotkeyRecordingTarget = null;
            return true;
        }

        if (!(e.code in KEY_DISPLAY)) {
            // 不支援的按鍵，略過
            return false;
        }

        config.hotkeys[hotkeyRecordingTarget] = { key: e.code, modifiers: mods };
        hotkeyRecording = false;
        hotkeyRecordingTarget = null;
        saveSettings();
        return true;
    }

    /** 清除快捷鍵 */
    function clearHotkey(actionName) {
        config.hotkeys[actionName] = { key: null, modifiers: [] };
        saveSettings();
    }

    // 把快捷鍵錄製的 keydown 掛到 document（capture 最先）
    document.addEventListener('keydown', (e) => {
        handleHotkeyRecording(e);
    }, true);

    // ============================================================
    // 設定畫面（整合快捷鍵區塊）
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
                title        : zh ? `機器翻譯設定  v${myversion}` : `Machine Translation Settings  v${myversion}`,
                secLeft      : zh ? "── 即時翻譯 ──"     : "── Live Translation ──",
                secRight     : zh ? "── 語言設定 ──"     : "── Language Settings ──",
                secHotkey    : zh ? "── 快捷鍵 ──"       : "── Hotkeys ──",
                enabled      : zh ? "啟用"               : "Enable",
                recv         : zh ? "接收翻譯"           : "Translate Received",
                send         : zh ? "發送翻譯"           : "Translate Sent",
                chat         : zh ? "點選翻譯按鈕"       : "Click-to-Translate Button",
                selection    : zh ? "選取翻譯"           : "Selection Translate",
                autoScroll   : zh ? "翻譯後自動捲動"     : "Auto-Scroll After Translate",
                recvLangLabel: zh ? "接收語言："          : "Recv Lang: ",
                sendLangLabel: zh ? "發送語言："          : "Send Lang: ",
                recvLangTip  : zh ? "接收語言"           : "Recv Lang",
                sendLangTip  : zh ? "發送語言"           : "Send Lang",
                hotkeyToggle : zh ? "開關翻譯："         : "Toggle MAT: ",
                hotkeySet    : zh ? "點擊設定"           : "Click to set",
                hotkeyClear  : zh ? "清除"               : "Clear",
                hotkeyRecording: zh ? "按下新快捷鍵... (Esc取消)" : "Press a key... (Esc=cancel)",
                desc1: zh ? "該插件為聊天室即時翻譯插件，支援 Bio 翻譯，使用 Google 翻譯 API" : "Chat room live translation plugin with Bio support, powered by Google Translate API",
                desc2: zh ? "插件停用時不影響 Bio 與選取翻譯（需開啟）的功能" : "Disabling does not affect Bio or Selection translate (if enabled)",
                desc3: zh ? "請依照需求設定語言與功能，另外也支援聊天室指令 /mat 即時設定" : "Configure as needed. You can also use chatroom commands /mat for live settings",
                back : zh ? "返回" : "Back",
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
            const recvY      = 305;
            const sendY      = 385;
            const chatY      = 465;
            const selectionY = 545;
            const autoScrollY= 625;

            // 右欄：語言設定往上對齊左欄前兩行
            const RLANG_RECV_Y = 225; // 與 enabledY 同高
            const RLANG_SEND_Y = 305; // 與 recvY 同高

            // 快捷鍵區塊 Y（右欄，語言設定下方）
            const HK_SEC_Y   = 410;
            const HK_ROW1_Y  = 450;
            const HK_BTN_X   = 1290;
            const HK_BTN_W   = 200;
            const HK_CLR_X   = 1500;
            const HK_CLR_W   = 70;

            const withLeft = (fn) => {
                const prev = MainCanvas.textAlign;
                MainCanvas.textAlign = "left";
                try { fn(); } finally { MainCanvas.textAlign = prev; }
            };

            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", T.back);
            DrawText(T.title, 1000, 105, "Black", "Gray");
            DrawText(T.secLeft,  630,  secY, "#2e7d32", "Gray");
            DrawText(T.secRight, 1300, secY, "#2e7d32", "Gray");

            DrawCheckbox(L_CB, enabledY,    CB_SZ, CB_SZ, "", config.enabled);
            DrawCheckbox(L_CB, recvY,       CB_SZ, CB_SZ, "", config.translateReceived,  !config.enabled);
            DrawCheckbox(L_CB, sendY,       CB_SZ, CB_SZ, "", config.translateSent,      !config.enabled);
            DrawCheckbox(L_CB, chatY,       CB_SZ, CB_SZ, "", config.translateChat,      !config.enabled);
            DrawCheckbox(L_CB, selectionY,  CB_SZ, CB_SZ, "", config.translateSelection);
            DrawCheckbox(L_CB, autoScrollY, CB_SZ, CB_SZ, "", config.autoScroll);

            withLeft(() => {
                const lx = L_TXT, lw = L_TXTW;
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(T.enabled,    lx, rowMid(enabledY),    lw, "Black");
                DrawTextFit(T.recv,       lx, rowMid(recvY),       lw, config.enabled ? "Black" : "Gray");
                DrawTextFit(T.send,       lx, rowMid(sendY),       lw, config.enabled ? "Black" : "Gray");
                DrawTextFit(T.chat,       lx, rowMid(chatY),       lw, config.enabled ? "Black" : "Gray");
                DrawTextFit(T.selection,  lx, rowMid(selectionY),  lw, "Black");
                DrawTextFit(T.autoScroll, lx, rowMid(autoScrollY), lw, "Black");
            });

            withLeft(() => {
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(T.recvLangLabel, R_LBL, rowMid(RLANG_RECV_Y), R_LBLW, "Black");
                DrawTextFit(T.sendLangLabel, R_LBL, rowMid(RLANG_SEND_Y), R_LBLW, "Black");
            });
            DrawButton(R_BTN, RLANG_RECV_Y, BTN_W, CB_SZ, names[uiRecvIdx], "White", "", T.recvLangTip);
            DrawButton(R_BTN, RLANG_SEND_Y, BTN_W, CB_SZ, names[uiSendIdx], "White", "", T.sendLangTip);

            // ── 快捷鍵區塊 ──
            DrawText(T.secHotkey, 1300, HK_SEC_Y, "#2e7d32", "Gray");

            withLeft(() => {
                DrawTextFit(T.hotkeyToggle, R_LBL, HK_ROW1_Y + CB_SZ / 2 + 9, R_LBLW, "Black");
            });

            const isRecording = hotkeyRecording && hotkeyRecordingTarget === 'toggle';
            const toggleLabel = isRecording
                ? T.hotkeyRecording
                : hotkeyToString(config.hotkeys.toggle);
            const toggleBtnColor = isRecording ? "#FFD700" : "White";

            DrawButton(HK_BTN_X, HK_ROW1_Y, HK_BTN_W, CB_SZ, toggleLabel, toggleBtnColor, "", T.hotkeySet);
            DrawButton(HK_CLR_X, HK_ROW1_Y, HK_CLR_W, CB_SZ, T.hotkeyClear, "White", "", T.hotkeyClear);

            DrawRect(395, 715, 1180, 2, "rgba(0,0,0,0.15)");
            DrawText(T.desc1,  1000, 745, "Gray", "Silver");
            DrawText(T.desc2,  1000, 800, "Gray", "Silver");
            DrawText(T.desc3,  1000, 855, "Gray", "Silver");
        },
        click() {
            if (MouseIn(1815, 75, 90, 90)) { if (typeof PreferenceExit === "function") PreferenceExit(); return; }

            const L_CB = 400;
            const CB_SZ = 64;
            const enabledY   = 225;
            const recvY      = 305;
            const sendY      = 385;
            const chatY      = 465;
            const selectionY = 545;
            const autoScrollY= 625;
            const R_BTN = 1290, BTN_W = 280;

            const RLANG_RECV_Y = 225;
            const RLANG_SEND_Y = 305;

            const HK_ROW1_Y  = 450;
            const HK_BTN_X   = 1290;
            const HK_BTN_W   = 200;
            const HK_CLR_X   = 1500;
            const HK_CLR_W   = 70;

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
            if (MouseIn(R_BTN, RLANG_SEND_Y, BTN_W, CB_SZ)) {
                const fakeAnchor = { getBoundingClientRect: () => {
                    const canvas = document.querySelector('canvas');
                    const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:2000,height:1000};
                    return { left: rect.left + R_BTN*(rect.width/2000), right: rect.left + (R_BTN+BTN_W)*(rect.width/2000), top: rect.top + RLANG_SEND_Y*(rect.height/1000) };
                }};
                openMATLangSelect(fakeAnchor, (code) => {
                    const idx = langCodes.indexOf(code);
                    if (idx === -1) return;
                    uiSendIdx = idx; config.sendLang = code; saveSettings();
                });
                return;
            }
            if (config.enabled && MouseIn(L_CB, chatY, CB_SZ, CB_SZ)) {
                config.translateChat = !config.translateChat;
                if (!config.translateChat) hideClickToolbar();
                saveSettings(); return;
            }
            if (MouseIn(R_BTN, RLANG_RECV_Y, BTN_W, CB_SZ)) {
                const fakeAnchor = { getBoundingClientRect: () => {
                    const canvas = document.querySelector('canvas');
                    const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:2000,height:1000};
                    return { left: rect.left + R_BTN*(rect.width/2000), right: rect.left + (R_BTN+BTN_W)*(rect.width/2000), top: rect.top + RLANG_RECV_Y*(rect.height/1000) };
                }};
                openMATLangSelect(fakeAnchor, (code) => {
                    const idx = langCodes.indexOf(code);
                    if (idx === -1) return;
                    uiRecvIdx = idx; config.recvLang = code; saveSettings();
                });
                return;
            }
            if (MouseIn(L_CB, selectionY, CB_SZ, CB_SZ)) {
                config.translateSelection = !config.translateSelection;
                if (!config.translateSelection) hideSelectionPopup();
                saveSettings(); return;
            }
            if (MouseIn(L_CB, autoScrollY, CB_SZ, CB_SZ)) {
                config.autoScroll = !config.autoScroll;
                saveSettings(); return;
            }

            // 快捷鍵按鈕
            if (MouseIn(HK_BTN_X, HK_ROW1_Y, HK_BTN_W, CB_SZ)) {
                if (hotkeyRecording && hotkeyRecordingTarget === 'toggle') {
                    // 再次點擊 = 取消錄製
                    hotkeyRecording = false;
                    hotkeyRecordingTarget = null;
                } else {
                    startHotkeyRecording('toggle');
                }
                return;
            }
            if (MouseIn(HK_CLR_X, HK_ROW1_Y, HK_CLR_W, CB_SZ)) {
                clearHotkey('toggle');
                hotkeyRecording = false;
                hotkeyRecordingTarget = null;
                return;
            }
        },
        unload() {
            // 離開設定頁時若還在錄製，取消
            hotkeyRecording = false;
            hotkeyRecordingTarget = null;
        },
        exit() {
            hotkeyRecording = false;
            hotkeyRecordingTarget = null;
        }
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
        modApi.hookFunction("ChatRoomLeave", 4, (args, next) => {
            stopObserver();
            hideClickToolbar();
            return next(args);
        });
        modApi.hookFunction("ChatRoomSync", 4, (args, next) => {
            const result = next(args);
            if (config.enabled) { stopObserver(); setTimeout(startObserver, 500); }
            hideClickToolbar();
            return result;
        });
    }

    // ============================================================
    // Bio 翻譯
    // ============================================================
    const BIO_TRANS_ID = 'mat-bio-translated';
    let bioTranslating = false;
    let bioCurrentMemberNumber = null;
    let bioAbortToken = null;
    const bioCache = new Map();
    const BIO_CACHE_TTL = 10 * 60 * 1000;

    function bioCacheGet(memberNum, recvLang, contentHash) {
        const key = `${memberNum}_${recvLang}`;
        const e = bioCache.get(key);
        if (!e) return null;
        if (Date.now() - e.ts > BIO_CACHE_TTL) { bioCache.delete(key); return null; }
        if (e.hash !== contentHash) { bioCache.delete(key); return null; }
        return e.translated;
    }

    function bioCacheSet(memberNum, recvLang, contentHash, translated) {
        const key = `${memberNum}_${recvLang}`;
        if (bioCache.size >= 30) {
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

    function updateBioTranslationDisplay(text) {
        let div = document.getElementById(BIO_TRANS_ID);
        if (!div) { showBioTranslation(text); return; }
        div.firstChild.textContent = `[🌐 MAT]\n${text}`;
    }

    function showBioTranslation(translatedText) {
        removeBioTranslation();
        const ref = document.getElementById('bceRichOnlineProfile') || document.getElementById('DescriptionInput');
        const div = document.createElement('div');
        div.id = BIO_TRANS_ID;
        div.style.cssText = 'overflow-x:hidden;overflow-wrap:break-word;white-space:pre-wrap;background:rgb(220,240,220);color:rgb(27,45,27);border:2px solid #4CAF50;padding:2px;position:fixed;z-index:999;font-family:Arial,sans-serif;display:flex;flex-direction:column;';

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

        const textNode = document.createElement('div');
        textNode.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;user-select:text;cursor:text;';
        textNode.textContent = `[🌐 MAT]\n${translatedText}`;
        div.appendChild(textNode);
        document.body.appendChild(div);
    }

    function removeBioTranslation() { document.getElementById(BIO_TRANS_ID)?.remove(); }

    function cancelBioTranslation() {
        if (bioAbortToken) bioAbortToken.cancelled = true;
        bioTranslating = false;
        removeBioTranslation();
    }

    async function translateBio() {
        if (bioTranslating) return;
        const raw = getBioText();
        if (!raw.trim()) return;
        const normalized = normalizeUnicodeText(raw);
        const contentHash = strHash(normalized);

        const memberNum = bioCurrentMemberNumber ?? 'unknown';
        const cached = bioCacheGet(memberNum, config.recvLang, contentHash);
        if (cached) { showBioTranslation(cached); return; }

        const token = { cancelled: false };
        bioAbortToken = token;
        bioTranslating = true;

        try {
            const result = await translateBioSmart(normalized, config.recvLang, token);
            if (!token.cancelled) {
                bioCacheSet(memberNum, config.recvLang, contentHash, result);
                showBioTranslation(result);
            }
        } finally {
            if (bioAbortToken === token) {
                bioTranslating = false;
            }
        }
    }

    function hookOnlineProfile() {
        if (!modApi) return;
        try {
            modApi.hookFunction("OnlineProfileRun", 4, (args, next) => {
                const result = next(args);
                const isOpen = !!document.getElementById(BIO_TRANS_ID);
                if (bioTranslating) {
                    DrawButton(1415, 60, 90, 90, "", "#FFD700", "Icons/Cancel.png",
                               isZH() ? "點擊取消翻譯" : "Click to cancel");
                } else if (isOpen) {
                    DrawButton(1415, 60, 90, 90, "", "White", "Icons/Cancel.png",
                               isZH() ? "關閉翻譯" : "Close Translation");
                } else {
                    DrawButton(1415, 60, 90, 90, "", "White", "Icons/Chat.png",
                               isZH() ? "翻譯Bio" : "Translate Bio");
                }
                return result;
            });
            modApi.hookFunction("OnlineProfileLoad", 4, (args, next) => {
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
                    if (bioTranslating) { cancelBioTranslation(); return; }
                    document.getElementById(BIO_TRANS_ID) ? removeBioTranslation() : translateBio();
                    return;
                }
                return next(args);
            });
            modApi.hookFunction("OnlineProfileUnload", 4, (args, next) => {
                cancelBioTranslation();
                bioCurrentMemberNumber = null;
                return next(args);
            });
        } catch(e) { console.warn("🐈‍⬛ [MAT] ❌ OnlineProfile hook failed:", e); }
    }

    // === 初始化 ===
    function waitForSettings(callback, retries = 30) {
        if (Player?.ExtensionSettings !== undefined) callback();
        else if (retries > 0) setTimeout(() => waitForSettings(callback, retries - 1), 500);
        else { console.warn("🐈‍⬛ [MAT] ❌ ExtensionSettings timeout, forcing init"); callback(); }
    }

    function waitForGame() {
        if (typeof Player?.MemberNumber === "number" && typeof CommandCombine === "function") {
            initializeConfig();
            waitForSettings(() => {
                migrateOnlineToExtensionSettings();
                loadSettings();
                registerCommands();
                hookSendFunctions();
                hookRoomEvents();
                hookOnlineProfile();
                setupSelectionListener();
                setupClickTranslateListener();
                setupHotkeyListener(); // ← 快捷鍵監聽
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
                    case "recv":       config.translateReceived  = !config.translateReceived;  saveSettings(); ChatRoomSendLocal(`整句自動翻譯: ${config.translateReceived  ? '✅' : '❌'}`); break;
                    case "send":       config.translateSent      = !config.translateSent;      saveSettings(); ChatRoomSendLocal(`發送翻譯: ${config.translateSent      ? '✅' : '❌'}`); break;
                    case "chat":       config.translateChat      = !config.translateChat;      if (!config.translateChat) hideClickToolbar(); saveSettings(); ChatRoomSendLocal(`點選翻譯按鈕: ${config.translateChat ? '✅' : '❌'}`); break;
                    case "selection":  config.translateSelection = !config.translateSelection; if(!config.translateSelection) hideSelectionPopup(); saveSettings(); ChatRoomSendLocal(`選取翻譯: ${config.translateSelection ? '✅' : '❌'}`); break;
                    case "autoscroll": config.autoScroll = !config.autoScroll; saveSettings(); ChatRoomSendLocal(`翻譯後自動捲動: ${config.autoScroll ? '✅' : '❌'}`); break;
                    case "sendlang":   handleLangCommand(args[1], 'send'); break;
                    case "recvlang":   handleLangCommand(args[1], 'recv'); break;
                    case "test":   testTranslation(args.slice(1).join(" ")); break;
                    case "status": showStatus(); break;
                    // 快捷鍵指令
                    case "hotkey": handleHotkeyCommand(args.slice(1)); break;
                    default: ChatRoomSendLocal("❓ 未知指令，使用 /mat help");
                }
            }
        }]);
        ChatRoomSendLocal(`🌐 [MAT] v${myversion} loaded! Use /mat help`);
    }

    /**
     * /mat hotkey [action] [key]
     * 例：/mat hotkey toggle ctrl+m
     *     /mat hotkey toggle clear
     *     /mat hotkey（查看目前設定）
     */
    function handleHotkeyCommand(args) {
        const action = args[0]?.toLowerCase();
        const keyStr = args[1]?.toLowerCase();

        if (!action) {
            // 列出目前快捷鍵
            ChatRoomSendLocal(`⌨️ MAT 快捷鍵設定：\n開關翻譯 (toggle): ${hotkeyToString(config.hotkeys.toggle)}\n\n用法: /mat hotkey toggle [ctrl+][alt+][shift+]KEY\n例如: /mat hotkey toggle ctrl+m`);
            return;
        }

        if (!['toggle'].includes(action)) {
            ChatRoomSendLocal(`❓ 未知快捷鍵動作: ${action}，目前支援: toggle`);
            return;
        }

        if (!keyStr || keyStr === 'clear') {
            clearHotkey(action);
            ChatRoomSendLocal(`✅ 已清除 ${action} 快捷鍵`);
            return;
        }

        // 解析 "ctrl+alt+m" 格式
        const parts = keyStr.split('+');
        const mods = [];
        let keyName = null;
        for (const part of parts) {
            if (part === 'ctrl')  { mods.push('Ctrl'); continue; }
            if (part === 'alt')   { mods.push('Alt');  continue; }
            if (part === 'shift') { mods.push('Shift'); continue; }
            keyName = part.toUpperCase();
        }

        // 找到對應的 event.code
        const code = Object.entries(KEY_DISPLAY).find(([, v]) => v === keyName)?.[0];
        if (!code) {
            ChatRoomSendLocal(`❓ 不支援的按鍵: ${keyName}，請使用 A-Z 或 0-9`);
            return;
        }

        config.hotkeys[action] = { key: code, modifiers: mods };
        saveSettings();
        ChatRoomSendLocal(`✅ ${action} 快捷鍵已設為: ${hotkeyToString(config.hotkeys[action])}`);
    }

    function showHelp() {
        ChatRoomSendLocal(`<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;font-size:13px;'>
            <h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v${myversion}</h3>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>開關指令</b><br>
                <b style='color:#87CEEB;'>/mat on/off</b> — 聊天室翻譯總開關<br>
                <b style='color:#87CEEB;'>/mat recv</b> — 切換整句自動翻譯<br>
                <b style='color:#87CEEB;'>/mat send</b> — 切換發送翻譯<br>
                <b style='color:#87CEEB;'>/mat chat</b> — 切換點選翻譯按鈕<br>
                <b style='color:#87CEEB;'>/mat selection</b> — 切換選取翻譯（獨立）<br>
                <b style='color:#87CEEB;'>/mat autoscroll</b> — 切換翻譯後自動捲動<br>
                <b style='color:#87CEEB;'>/mat recvlang/sendlang [代碼]</b> — 設定語言<br>
                <b style='color:#87CEEB;'>/mat hotkey [action] [key]</b> — 快捷鍵設定<br>
                <b style='color:#87CEEB;'>/mat test [文字]</b> — 測試翻譯<br>
                <b style='color:#87CEEB;'>/mat status</b> — 查看狀態
            </div>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>功能</b><br>
                <span style='color:#aaa'>・ 點選訊息 → 上方出現 🌐 / ▾ 工具列（需點選翻譯按鈕開啟）</span><br>
                <span style='color:#aaa'>・ 選取文字 → 氣泡翻譯（獨立開關）</span><br>
                <span style='color:#aaa'>・ Bio 翻譯：逐行顯示，翻譯中可點擊黃色按鈕取消</span><br>
                <span style='color:#aaa'>・ 裝飾字體自動轉換（𝕙𝕖𝕝𝕝𝕠→hello）</span><br>
                <span style='color:#aaa'>・ 純連結自動跳過翻譯</span><br>
                <span style='color:#aaa'>・ 快捷鍵：預設 Ctrl+M 開關（設定頁可修改）</span>
            </div>
            <div style='background:#2d2d44;padding:6px 8px;border-radius:3px;margin:5px 0;'>
                <b style='color:#FFD700;'>19 種語言</b><br>
                zh cn en ja ko de fr es ru it pt ar th vi id pl nl tr sv
            </div>
        </div>`);
    }

    function handleLangCommand(langCode, type) {
        // 別名映射：將簡短輸入轉換為 Google 正確代碼
        const aliasMap = {
            'zh': 'zh-TW',   // zh 預設對應繁體（Google 代碼需明確指定）
            'tw': 'zh-TW',
            'cn': 'zh-CN',
            'zh-cn': 'zh-CN',
            'zh-tw': 'zh-TW',
        };
        const resolved = aliasMap[langCode?.toLowerCase()] || langCode;
    
        if (resolved && langCodes.includes(resolved)) {
            if (type === 'send') { config.sendLang = resolved; saveSettings(); ChatRoomSendLocal(`✅ 發送語言: ${getLangName(resolved)}`); }
            else { config.recvLang = resolved; saveSettings(); ChatRoomSendLocal(`✅ 接收語言: ${getLangName(resolved)}`); }
        } else {
            ChatRoomSendLocal(`當前 - 發送: ${getLangName(config.sendLang)} | 接收: ${getLangName(config.recvLang)}`);
        }
    }

    function showStatus() {
        ChatRoomSendLocal(`<div style='background:#1a1a2e;color:#eee;padding:8px;border-radius:5px;'>
            <h4 style='color:#4CAF50;'>📊 MAT v${myversion} 狀態</h4>
            聊天室總開關: ${config.enabled ? '🟢' : '🔴'}<br>
            整句自動翻譯: ${config.translateReceived ? '✅' : '❌'} → ${getLangName(config.recvLang)}<br>
            發送翻譯: ${config.translateSent ? '✅' : '❌'} → ${getLangName(config.sendLang)}<br>
            點選翻譯按鈕: ${config.translateChat ? '✅' : '❌'}<br>
            選取翻譯（獨立）: ${config.translateSelection ? '✅' : '❌'}<br>
            翻譯後自動捲動: ${config.autoScroll ? '✅' : '❌'}<br>
            純連結跳過翻譯: ✅ 永遠啟用<br>
            Bio翻譯: 🟢 永遠可用（逐行顯示，可中途取消）<br>
            快捷鍵（開關）: ⌨️ ${hotkeyToString(config.hotkeys.toggle)}<br>
            設定儲存位置: ExtensionSettings ✅
        </div>`);
    }

    async function testTranslation(text) {
        if (!text) { ChatRoomSendLocal("請提供要測試的文字"); return; }
        if (isPureUrl(text)) { ChatRoomSendLocal("⚠️ 此文字為純連結，會跳過翻譯"); return; }
        ChatRoomSendLocal("翻譯中...");
        const r1 = await translateQueue.add(text, config.recvLang);
        const r2 = await translateQueue.add(text, config.sendLang);
        ChatRoomSendLocal(`接收翻譯: ${r1.translated}<br>發送翻譯: ${r2.translated}`);
    }
})();
