// ==UserScript==
// @name         BC - Machine Translation (test)
// @namespace    https://bc-translator.dev/
// @version      1.0
// @description  Auto translate BC chat messages
// @author       YourName
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';

    let modApi;
    let observer = null;


    // 設定選項 - 會自動保存到 OnlineSettings
    let config = {
        enabled: true,
        sendLang: 'en',           // 發送翻譯的目標語言
        recvLang: 'zh',           // 接收翻譯的目標語言
        translateReceived: true,  // 翻譯別人的消息
        translateSent: false,     // 翻譯自己的消息（預設關閉）
        apiService: 'google'
    };

    // 常用語言
    const languages = {
        'zh': '🇨🇳 中文', 'en': '🇺🇸 英文', 'ja': '🇯🇵 日文', 'ko': '🇰🇷 韓文',
        'de': '🇩🇪 德文', 'fr': '🇫🇷 法文', 'es': '🇪🇸 西文', 'ru': '🇷🇺 俄文'
    };

    // 初始化模組
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "MachineTranslation",
                fullName: "BC - Machine Translation (MT)",
                version: "1.0",
                repository: "Auto translate chat messages",
            });
            console.log("✅ BC Machine Translation loaded");
        }
    } catch (e) {
        console.error("❌ BC Machine Translation failed to load:", e);
    }

    // === 初始化设定 ===

    function initializeConfig() {
        // 确保 config 始终是有效对象
        if (!config || typeof config !== 'object') {
            config = {
                enabled: true,
                sendLang: 'en',
                recvLang: 'zh',
                translateReceived: true,
                translateSent: false,
                apiService: 'google'
            };
            console.log("[MT] Config initialized with defaults");
        }

        // 确保所有必要的属性都存在
        const defaults = {
            enabled: true,
            sendLang: 'en',
            recvLang: 'zh',
            translateReceived: true,
            translateSent: false,
            apiService: 'google'
        };

        for (const [key, defaultValue] of Object.entries(defaults)) {
            if (config[key] === undefined) {
                config[key] = defaultValue;
                console.log(`[MT] Added missing config property: ${key} = ${defaultValue}`);
            }
        }
    }

    // === 設定保存/讀取 ===
    function saveSettings() {
        if (!Player || !Player.OnlineSettings) {
            ChatRoomSendLocalStyled("⚠️ 未登入，無法保存翻譯設定", 4000, "#FFA500");
            return;
        }

        Player.OnlineSettings.BCMachineTranslation = config;

        if (typeof ServerAccountUpdate?.QueueData === "function") {
            ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
            console.log("[MT] 翻譯設定已保存:", config);
        } else {
            ChatRoomSendLocalStyled("⚠️ 無法同步翻譯設定", 4000, "#FFA500");
        }
    }
    function loadSettings() {
        if (Player?.OnlineSettings?.BCMachineTranslation) {
            const settings = Player.OnlineSettings.BCMachineTranslation;
            config = { ...config, ...settings };
            console.log("[MT] 已載入設定:", config);
        } else {
            console.warn("[MT] 找不到 OnlineSettings，使用預設值");
        }
    }

    // === 翻譯 API 函數 ===

    async function detectLanguage(text) {
        const patterns = {
            'zh': /[\u4e00-\u9fff]/,
            'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
            'ko': /[\uac00-\ud7af]/,
            'ru': /[\u0400-\u04ff]/,
            'ar': /[\u0600-\u06ff]/,
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) return lang;
        }

        return 'en';
    }

    async function translateGoogle(text, target) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            const data = await response.json();
            return data[0][0][0] || text;
        } catch (error) {
            console.error('Google Translate failed:', error);
            return text;
        }
    }

    async function smartTranslate(text, targetLang) {
        if (!config.enabled || !text) return text;

        // 過濾系統訊息
        if (text.includes('BCX_') || text.match(/^[\d\s:]+$/) || text.includes('[🌐]')) return text;

        try {
            const detectedLang = await detectLanguage(text);

            // 如果檢測語言 = 目標語言，不翻譯
            if (detectedLang === targetLang) {
                return text;
            }

            const translated = await translateGoogle(text, targetLang);
            console.log(`[MT] "${text}" -> "${translated}" (${detectedLang} -> ${targetLang})`);
            return translated;
        } catch (error) {
            console.error('[MT] Error:', error);
            return text;
        }
    }

    // === 接收翻譯：監控聊天記錄 ===

    function startObserver() {
        if (observer) return;

        const log = document.querySelector("#TextAreaChatLog");
        if (!log) {
            setTimeout(startObserver, 1000);
            return;
        }

        observer = new MutationObserver(async (mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    await handleReceivedMessage(node);
                }
            }
        });

        observer.observe(log, { childList: true });
        console.log("[MT] Observer started for received messages");
    }

    function stopObserver() {
        if (!observer) return;
        try { observer.disconnect(); } catch {}
        observer = null;
    }

    async function handleReceivedMessage(node) {
        if (!config.enabled || !config.translateReceived) return;
        if (!(node instanceof HTMLElement)) return;

        // 檢查是否為聊天消息
        if (!node.classList.contains('ChatMessage')) return;

        // 跳過已處理的和翻譯標記的
        if (node.classList.contains("mt-processed") ||
            node.textContent.includes('[🌐]')) return;

        // 檢查是否為自己發送的消息
        const senderElement = node.querySelector('.chat-room-sender');
        if (senderElement) {
            const senderNumber = senderElement.textContent;
            if (senderNumber == Player?.MemberNumber) {
                return; // 跳過自己的消息
            }
        }

        node.classList.add("mt-processed");

        const message = extractCleanMessage(node);
        if (!message) {
            console.log("[MT] No message extracted from:", node.textContent);
            return;
        }

        console.log("[MT] Processing received message:", message);
        const translatedMessage = await smartTranslate(message, config.recvLang);

        if (translatedMessage !== message) {
            // 創建翻譯版本的DIV
            createTranslatedDiv(node, translatedMessage);
        }
    }

    function extractCleanMessage(node) {
        // 獲取純文字內容，避免HTML結構干擾
        let rawMessage = node.innerText || node.textContent || '';

        console.log("[MT] Raw message before clean:", rawMessage);

        // 移除時間戳記 (HH:MM:SS 或 HH:MM)
        rawMessage = rawMessage.replace(/\d{1,2}:\d{2}(:\d{2})?/g, '');

        // 移除發送者編號（行首的數字）
        rawMessage = rawMessage.replace(/^\d+\s*/, '');

        // 移除 Reply 標記（包括中英文）- 更嚴格的匹配
        rawMessage = rawMessage.replace(/\s*\d*Reply\s*$/gi, '');
        rawMessage = rawMessage.replace(/\s*回复\s*$/g, '');

        // 移除悄悄話和私聊前綴
        rawMessage = rawMessage.replace(/^\*?悄悄话来自\s+[^:]+:\s*/g, '');
        rawMessage = rawMessage.replace(/^\*?好友私聊来自\s+[^:]+:\s*/g, '');
        rawMessage = rawMessage.replace(/^\*?Whisper from\s+[^:]+:\s*/g, '');

        // 移除用戶名前綴（更準確）
        rawMessage = rawMessage.replace(/^[^:]+:\s*/g, '');

        // 移除常見符號和空格
        rawMessage = rawMessage.replace(/^[\s\*\(\)]+|[\s\*\(\)]+$/g, '').trim();

        rawMessage = rawMessage.replace(/^\d+(\s|\n)*/, "");


        console.log("[MT] Cleaned message:", rawMessage);
        return rawMessage;
    }

    function isUserMessage(text) {
        // 排除特定系统指令
        const systemCommands = ['enablelianchat','reqroom'];
        if (systemCommands.includes(text.toLowerCase())) return false;
        return true;
    }

    function createTranslatedDiv(originalNode, translatedText) {
        // 複製原節點
        const translatedDiv = originalNode.cloneNode(true);

        // 移除原有標記
        translatedDiv.classList.remove("mt-processed");
        translatedDiv.classList.add("mt-translated");

        // 根據消息類型找到正確的內容元素並替換
        let contentUpdated = false;

        // 1. Chat/Emote/Whisper: 查找 .chat-room-message-content
        const messageContent = translatedDiv.querySelector('.chat-room-message-content');
        if (messageContent) {
            messageContent.textContent = `[🌐] ${translatedText}`;
            contentUpdated = true;
            console.log("[MT] Updated message-content for Chat/Emote/Whisper");
        }

        // 2. BEEP: 查找 .beep-link
        if (!contentUpdated) {
            const beepLink = translatedDiv.querySelector('.beep-link');
            if (beepLink) {
                // 保留前綴，只替換消息部分
                const originalText = beepLink.textContent;
                const match = originalText.match(/^(.*:\s*)(.*)/);
                if (match) {
                    beepLink.textContent = `${match[1]}[🌐] ${translatedText}`;
                } else {
                    beepLink.textContent = `[🌐] ${translatedText}`;
                }
                contentUpdated = true;
                console.log("[MT] Updated beep-link");
            }
        }

        // 3. Action: 查找直接的文字節點（跳過metadata，保留ID）
        if (!contentUpdated && (translatedDiv.classList.contains('ChatMessageAction') ||
                                translatedDiv.classList.contains('ChatMessageActivity'))) {

            // 查找主DIV的直接子文字節點（不是metadata）
            for (let i = 0; i < translatedDiv.childNodes.length; i++) {
                const child = translatedDiv.childNodes[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent.trim();
                    // 只替換包含括號或中文的文字節點（實際消息內容）
                    if (text.length > 1 && (text.includes('(') || text.match(/[\u4e00-\u9fff]/))) {
                        child.textContent = `[🌐] ${translatedText})`;
                        contentUpdated = true;
                        console.log("[MT] Updated Action text node (preserved metadata):", text);
                        break;
                    }
                }
            }

            // 如果沒找到直接文字節點，查找非metadata的元素中的文字
            if (!contentUpdated) {
                for (let i = 0; i < translatedDiv.children.length; i++) {
                    const child = translatedDiv.children[i];
                    if (!child.classList.contains('chat-room-metadata') &&
                        !child.classList.contains('menubar') &&
                        !child.id.includes('menu') &&
                        child.textContent.trim()) {
                        child.textContent = `[🌐] ${translatedText}`;
                        contentUpdated = true;
                        console.log("[MT] Updated Action child element text");
                        break;
                    }
                }
            }
        }

        // 4. 最後備用方案：找到第一個非metadata的文字節點
        if (!contentUpdated) {
            const walker = document.createTreeWalker(
                translatedDiv,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: function(node) {
                        // 跳過metadata相關的節點
                        const parent = node.parentElement;
                        if (parent && (
                            parent.classList.contains('chat-room-time') ||
                            parent.classList.contains('chat-room-sender') ||
                            parent.classList.contains('chat-room-metadata') ||
                            parent.tagName === 'TIME'
                        )) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        // 只選擇有意義的文字節點
                        if (node.textContent.trim().length > 1) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    }
                },
                false
            );

            const textNode = walker.nextNode();
            if (textNode) {
                textNode.textContent = `[🌐] ${translatedText}`;
                contentUpdated = true;
                console.log("[MT] Updated with fallback method");
            }
        }

        if (!contentUpdated) {
            console.warn("[MT] Failed to update content for:", originalNode.className);
            return; // 如果無法更新內容，就不創建翻譯DIV
        }

        // 設定樣式
        translatedDiv.style.backgroundColor = "rgba(76, 175, 80, 0.1)";
        translatedDiv.style.borderLeft = "3px solid #4CAF50";
        translatedDiv.style.marginTop = "2px";

        // 插入到原節點後面
        originalNode.parentNode.insertBefore(translatedDiv, originalNode.nextSibling);

        console.log("[MT] Translation div created successfully");
    }

    // === 發送翻譯：攔截發送函數 ===

    function hookSendFunctions() {
        if (!modApi) return;

        // Hook ServerSend
        modApi.hookFunction("ServerSend", 10, async (args, next) => {
            const [command, data] = args;

            if (config.enabled && config.translateSent && command === "ChatRoomChat" && data.Type === "Chat") {
                const originalText = data.Content;
                if (originalText && !originalText.includes('[🌐]')) {
                    const translatedText = await smartTranslate(originalText, config.sendLang);
                    if (translatedText !== originalText) {
                        // 發送原文
                        next(args);
                        // 發送翻譯
                        setTimeout(() => {
                            ServerSend("ChatRoomChat", {
                                Content: `[🌐] ${translatedText}`,
                                Type: "Chat"
                            });
                        }, 100);
                        return;
                    }
                }
            }

            // Hook Action
            if (config.enabled && config.translateSent && command === "ChatRoomChat" && data.Type === "Action") {
                if (data.Dictionary && data.Dictionary[0] && data.Dictionary[0].Text) {
                    const originalText = data.Dictionary[0].Text;
                    if (!originalText.includes('[🌐]')) {
                        const translatedText = await smartTranslate(originalText, config.sendLang);
                        if (translatedText !== originalText) {
                            next(args);
                            setTimeout(() => {
                                ServerSend("ChatRoomChat", {
                                    Type: "Action",
                                    Content: "CUSTOM_SYSTEM_ACTION",
                                    Dictionary: [{
                                        Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION',
                                        Text: `[🌐] ${translatedText}`
                                    }]
                                });
                            }, 100);
                            return;
                        }
                    }
                }
            }

            // Hook Whisper
            if (config.enabled && config.translateSent && command === "ChatRoomChat" && data.Type === "Whisper") {
                const originalText = data.Content;
                if (originalText && !originalText.includes('[🌐]')) {
                    const translatedText = await smartTranslate(originalText, config.sendLang);
                    if (translatedText !== originalText) {
                        next(args);
                        setTimeout(() => {
                            ServerSend("ChatRoomChat", {
                                Content: `[🌐] ${translatedText}`,
                                Type: "Whisper",
                                Target: data.Target,
                                Sender: data.Sender
                            });
                        }, 100);
                        return;
                    }
                }
            }

            // Hook BEEP
            if (config.enabled && config.translateSent && command === "AccountBeep") {
                const originalText = data.Message;
                if (originalText && !originalText.includes('[🌐]') && isUserMessage(originalText)) {
                    const translatedText = await smartTranslate(originalText, config.sendLang);
                    if (translatedText !== originalText) {
                        next(args);
                        setTimeout(() => {
                            ServerSend("AccountBeep", {
                                MemberNumber: data.MemberNumber,
                                Message: `[🌐] ${translatedText}`
                            });
                        }, 100);
                        return;
                    }
                }
            }

            return next(args);
        });

        // Hook Emote
        modApi.hookFunction("ChatRoomSendEmote", 10, async (args, next) => {
            if (config.enabled && config.translateSent) {
                const [originalText] = args;
                if (originalText && !originalText.includes('[🌐]')) {
                    const translatedText = await smartTranslate(originalText, config.sendLang);
                    if (translatedText !== originalText) {
                        next(args);
                        setTimeout(() => {
                            ChatRoomSendEmote(`[🌐] ${translatedText}`);
                        }, 100);
                        return;
                    }
                }
            }
            return next(args);
        });

        console.log("[MT] Send hooks installed");
    }

    // === 指令系統 ===

    function waitForGame() {
        if (typeof Player?.MemberNumber === "number" && typeof CommandCombine === "function") {
            initializeConfig(); // 初始化设定
            loadSettings(); // 载入设定
            registerCommands();
            hookSendFunctions();
            if (config.enabled) startObserver();
        } else {
            setTimeout(waitForGame, 1000);
        }
    }

    function registerCommands() {
        CommandCombine([{
            Tag: "mt",
            Description: "Machine Translation settings (/mt help)",
            Action: function(text) {
                const args = text.split(" ");
                const cmd = args[0]?.toLowerCase();

                switch(cmd) {
                    case "":
                    case "help":
                        showHelp();
                        break;
                    case "on":
                        config.enabled = true;
                        startObserver();
                        saveSettings();
                        ChatRoomSendLocal("✅ 機器翻譯已開啟");
                        break;
                    case "off":
                        config.enabled = false;
                        stopObserver();
                        saveSettings();
                        ChatRoomSendLocal("❌ 機器翻譯已關閉");
                        break;
                    case "recv":
                        config.translateReceived = !config.translateReceived;
                        saveSettings();
                        ChatRoomSendLocal(`接收翻譯: ${config.translateReceived ? '✅ 開啟' : '❌ 關閉'}`);
                        break;
                    case "send":
                        config.translateSent = !config.translateSent;
                        saveSettings();
                        ChatRoomSendLocal(`發送翻譯: ${config.translateSent ? '✅ 開啟' : '❌ 關閉'}`);
                        break;
                    case "sendlang":
                        handleLangCommand(args[1], 'send');
                        break;
                    case "recvlang":
                        handleLangCommand(args[1], 'recv');
                        break;
                    case "test":
                        testTranslation(args.slice(1).join(" "));
                        break;
                    case "status":
                        showStatus();
                        break;
                    default:
                        ChatRoomSendLocal("❓ 未知指令，使用 /mt help");
                }
            }
        }]);

        ChatRoomSendLocal("🌐 BC Machine Translation loaded! Use /mt help");
    }

    function showHelp() {
        const helpText = `
            <div style='background:#1a1a2e; color:#eee; padding:10px; border-radius:5px;'>
                <h3 style='color:#4CAF50;'>🌐 BC Machine Translation (MT) 使用說明</h3>

                <div style='background:#2d2d44; padding:5px; border-radius:3px; margin:5px 0;'>
                    <b style='color:#87CEEB;'>/mt on/off</b> - 開啟/關閉翻譯<br>
                    <b style='color:#87CEEB;'>/mt recv</b> - 切換接收翻譯（翻譯別人的話）<br>
                    <b style='color:#87CEEB;'>/mt send</b> - 切換發送翻譯（翻譯自己的話）<br>
                    <b style='color:#87CEEB;'>/mt recvlang [代碼]</b> - 設定接收翻譯語言<br>
                    <b style='color:#87CEEB;'>/mt sendlang [代碼]</b> - 設定發送翻譯語言<br>
                    <b style='color:#87CEEB;'>/mt test [文字]</b> - 測試翻譯<br>
                    <b style='color:#87CEEB;'>/mt status</b> - 查看狀態
                </div>

                <div style='background:#2d2d44; padding:5px; border-radius:3px; margin:5px 0;'>
                    <b style='color:#FFD700;'>常用語言:</b><br>
                    zh(中文) en(英文) ja(日文) ko(韓文)<br>
                    de(德文) fr(法文) es(西文) ru(俄文)
                </div>

                <span style='color:#90EE90;'>🔄 設定會自動保存，支援雙向翻譯</span>
            </div>
        `;
        ChatRoomSendLocal(helpText);
    }

    function handleLangCommand(langCode, type) {
        if (langCode) {
            if (languages[langCode]) {
                if (type === 'send') {
                    config.sendLang = langCode;
                    saveSettings();
                    ChatRoomSendLocal(`✅ 發送翻譯語言設定為: ${languages[langCode]} (${langCode})`);
                } else if (type === 'recv') {
                    config.recvLang = langCode;
                    saveSettings();
                    ChatRoomSendLocal(`✅ 接收翻譯語言設定為: ${languages[langCode]} (${langCode})`);
                }
            } else {
                ChatRoomSendLocal(`❌ 不支援的語言: ${langCode}`);
            }
        } else {
            showLanguages();
        }
    }

    function showLanguages() {
        const sendLang = languages[config.sendLang] || config.sendLang;
        const recvLang = languages[config.recvLang] || config.recvLang;
        ChatRoomSendLocal(`當前設定 - 發送: ${sendLang} | 接收: ${recvLang}`);
    }

    function showStatus() {
        const sendLangDisplay = languages[config.sendLang] || config.sendLang;
        const recvLangDisplay = languages[config.recvLang] || config.recvLang;
        const statusText = `
            <div style='background:#1a1a2e; color:#eee; padding:8px; border-radius:5px;'>
                <h4 style='color:#4CAF50;'>📊 機器翻譯狀態</h4>
                <b>總開關:</b> ${config.enabled ? '🟢 開啟' : '🔴 關閉'}<br>
                <b>接收翻譯:</b> ${config.translateReceived ? '✅ 開啟' : '❌ 關閉'} → ${recvLangDisplay}<br>
                <b>發送翻譯:</b> ${config.translateSent ? '✅ 開啟' : '❌ 關閉'} → ${sendLangDisplay}<br>
                <b>翻譯服務:</b> ${config.apiService}
            </div>
        `;
        ChatRoomSendLocal(statusText);
    }

    async function testTranslation(text) {
        if (!text) {
            ChatRoomSendLocal("請提供要測試的文字");
            return;
        }

        ChatRoomSendLocal("翻譯中...");
        const resultRecv = await smartTranslate(text, config.recvLang);
        const resultSend = await smartTranslate(text, config.sendLang);
        ChatRoomSendLocal(`接收翻譯: ${resultRecv}<br>發送翻譯: ${resultSend}`);
    }

    // 離開房間時停止
    modApi?.hookFunction?.("ChatRoomLeave", 4, (args, next) => {
        stopObserver();
        return next(args);
    });

    // 啟動
    waitForGame();

})();
