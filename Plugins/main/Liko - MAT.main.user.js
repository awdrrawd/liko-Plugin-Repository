// ==UserScript==
// @name         Liko - MAT
// @name:zh      Liko的自動翻譯(使用Google api)
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.6.4
// @description  Automatically translate BC chat messages using Google API.
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MAT.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MAT.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.6.4";
    if (window.Liko.MAT) return;
    window.Liko.MAT = MOD_VER;

    // MAT 圖示（偏好設定按鈕 + 聊天室快捷按鈕共用）。以 data URI 交給 <img> / BC 圖片載入器。
    const MAT_ICON_SVG = `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><style>.s0 { opacity: .99;fill: #000000 } </style><path id="Path 0" fill-rule="evenodd" class="s0" d="m49.97 7.98c25.92-0.02 26.63 0.03 31.03 2.33 2.51 1.3 5.83 4.23 10.5 10.86v28.17c0 26.62-0.11 28.38-2.09 32.16-1.15 2.2-4 5.35-10.58 10h-57.66l-4.26-3c-2.34-1.65-5.33-5.03-6.64-7.5-2.36-4.47-2.37-4.68-1.77-59.83l3.01-4.25c1.65-2.33 5.01-5.3 7.46-6.58 4.35-2.28 5.14-2.34 31-2.36zm-34.63 9.89c-1.29 1.72-2.59 4.59-2.9 6.38-0.3 1.79-0.42 14.58-0.25 28.43 0.29 23.34 0.46 25.38 2.31 27.88 1.1 1.48 3.27 3.65 4.82 4.82 2.72 2.04 3.85 2.12 30.68 2.12 26.29 0 28.01-0.11 30.56-2 1.48-1.1 3.65-3.27 4.82-4.82 2.04-2.72 2.12-3.85 2.12-30.68 0-26.83-0.08-27.96-2.12-30.68-1.17-1.55-3.34-3.72-4.82-4.82-2.52-1.87-4.47-2.02-29.38-2.23-20.53-0.19-27.47 0.07-30.09 1.11-1.87 0.75-4.46 2.76-5.75 4.49zm36.66 2.53c4.02 0.31 8.41 1.44 11.5 2.96 2.75 1.35 6.54 4.19 8.43 6.3 1.88 2.11 4.3 5.86 5.37 8.34 1.07 2.48 2.17 6.75 2.93 14.5l-28.23-0.5-0.01 23.5 5.51 3.35-3 0.72c-1.65 0.39-5.25 0.42-8 0.08-2.75-0.35-7.25-1.72-10-3.05-2.75-1.33-6.54-4.15-8.43-6.26-1.88-2.11-4.22-5.64-5.19-7.84-0.97-2.2-2.1-6.02-3.27-13l2.19 2.25c1.21 1.24 2.89 4.16 3.74 6.5 0.85 2.34 2.2 5.04 3 6 1.25 1.5 1.83 1.57 3.99 0.5 1.48-0.73 2.51-2.08 2.49-3.25-0.02-1.1-0.37-3.7-0.78-5.77-0.47-2.39-1.29-3.75-2.24-3.71-0.89 0.03-0.38-0.78 1.25-1.99 2.05-1.51 4.28-2.03 14.75-2.03l0.03-11.75c0.02-11.54-0.02-11.78-2.52-13.25-1.85-1.09-2.19-1.72-1.27-2.3 0.69-0.44 4.18-0.58 7.76-0.3zm0 15.6c5.04-1 6.73-1.46 7-1.67 0.28-0.21-0.29-1.94-1.25-3.85-0.96-1.92-2.62-3.95-3.69-4.52-1.81-0.96-1.95-0.66-2 4.5zm10-5.5c0.88 2.2 1.27 2.37 3.25 1.37l2.25-1.13c-3.88-2.96-5.34-3.8-5.75-3.78-0.41 0.03-0.75 0.27-0.75 0.54 0 0.28 0.45 1.63 1 3zm3.5 11.94l1 5.59 9.5-0.03c-0.95-5.03-2.18-8.19-3.36-10.27-1.18-2.07-2.37-3.74-2.64-3.71-0.28 0.04-1.63 0.69-3 1.45-2.42 1.33-2.47 1.57-1.5 6.97zm-13.74 1.64l0.24 3.92c8.32 0 10-0.41 10.01-1.25 0.01-0.68-0.33-2.72-0.75-4.52-0.62-2.68-1.22-3.25-3.26-3.13-1.38 0.07-3.4 0.34-4.49 0.59-1.63 0.38-1.95 1.18-1.75 4.39zm-13.02 13.7c0.55 2.37 1.31 3.26 2.76 3.23 1.1-0.02 3.01-0.25 4.25-0.52 1.87-0.4 2.25-1.15 2.25-4.49v-4c-8.33 0-10.01 0.42-10.01 1.25-0.01 0.69 0.33 2.73 0.75 4.53zm2.23 8.47c-0.02 0.69 1 2.8 2.25 4.68 1.25 1.88 2.84 3.57 3.53 3.75 0.89 0.23 1.25-1.27 1.25-5.18 0-3.02-0.11-5.42-0.25-5.34-0.14 0.09-1.71 0.32-3.5 0.5-1.79 0.19-3.26 0.91-3.28 1.59zm-5.58 5c1.44 0.97 2.83 1.53 3.11 1.25 0.27-0.27-0.08-1.63-0.79-3.01-1.11-2.18-1.53-2.35-3.1-1.25-1.72 1.19-1.67 1.37 0.78 3.01zm-4.39-47.25c7.66 0 9.29 0.3 11 2 1.55 1.56 2 3.34 2 8 0 4.67-0.45 6.45-2 8-1.1 1.1-3.13 2-4.5 2-1.38 0-4.41 1.4-6.75 3.11-2.34 1.71-4.81 2.84-5.5 2.5-0.69-0.33-1.25-1.73-1.25-3.11 0-1.37-0.45-2.5-1-2.5-0.55 0-1.9-0.9-3-2-1.56-1.55-2-3.33-2-8 0-4.66 0.44-6.44 2-8 1.7-1.7 3.33-2 11-2zm-8.79 11c0.24 3.83 0.63 4.54 2.54 4.75 1.24 0.14 2.59 1.15 3 2.24 0.71 1.9 0.84 1.91 2.63 0.25 1.03-0.95 3.51-1.97 5.5-2.25l3.62-0.52v-10.97c-14.23-0.5-16.62-0.23-17.03 0.71-0.31 0.71-0.43 3.32-0.26 5.79zm46.79 21c7.66 0 9.29 0.3 11 2 1.55 1.56 2 3.34 2 8 0 4.67-0.45 6.45-2 8-1.1 1.1-2.45 2-3 2-0.55 0-1 1.13-1 2.5 0 1.38-0.56 2.78-1.25 3.11-0.69 0.34-3.16-0.79-5.5-2.5-2.34-1.71-5.38-3.11-6.75-3.11-1.38 0-3.4-0.9-4.5-2-1.56-1.55-2-3.33-2-8 0-4.66 0.44-6.44 2-8 1.7-1.7 3.33-2 11-2zm-8.79 10.99c0.28 4.33 0.42 4.51 3.91 5 1.99 0.28 4.46 1.3 5.5 2.25 1.79 1.66 1.91 1.65 2.63-0.25 0.41-1.09 1.76-2.1 3-2.24 2.03-0.22 2.25-0.78 2.25-5.75v-5.5c-14.23-0.5-16.62-0.23-17.03 0.71-0.31 0.71-0.43 3.31-0.26 5.78z"/></svg>`;
    const MAT_ICON_URI = 'data:image/svg+xml,' + encodeURIComponent(MAT_ICON_SVG);

    let modApi;
    let observer = null;
    const sys_CRB = "2"; //#chat-room-buttons 順位設定

    // 預設熱鍵；用工廠回傳新物件，避免多處共用同一參考被意外改到。
    // 三個動作各帶 enabled 旗標：總開關預設啟用，接收/發送快捷鍵預設關閉。
    function makeDefaultHotkeys() {
        return {
            toggle: { key: 'KeyM', modifiers: ['Ctrl'], enabled: true },
            recv:   { key: 'KeyR', modifiers: ['Ctrl'], enabled: false },
            send:   { key: 'KeyS', modifiers: ['Ctrl'], enabled: false },
        };
    }

    // 把 config.hotkeys 補齊成三動作 + enabled 布林（讀舊設定或殘缺時修復）
    function normalizeHotkeys() {
        const def = makeDefaultHotkeys();
        if (!config.hotkeys || typeof config.hotkeys !== 'object') config.hotkeys = def;
        for (const k of ['toggle', 'recv', 'send']) {
            const cur = config.hotkeys[k];
            if (!cur || typeof cur !== 'object') config.hotkeys[k] = { ...def[k] };
            else if (typeof cur.enabled !== 'boolean') cur.enabled = def[k].enabled;
        }
    }

    // 單一預設來源：頂層初值與 initializeConfig 都取自這裡，避免兩份清單各自漂移。
    // recvLang 維持 null（需登入後由 detectDefaultRecvLang 計算，見 initializeConfig）。
    function defaultConfig() {
        return {
            enabled: true,
            // ── 基本 ──
            translateReceived: true,
            recvLang: null,
            translateSent: true,
            sendLang: 'en',
            // ── 發送分類（動作/互動/悄悄話/私信；一般聊天 Chat 恆受總發送開關管）──
            sendEmote: true,
            sendAction: true,
            sendWhisper: true,
            sendBeep: true,
            sendSkipZhVariant: true,   // 發送語言為中文時，內容已是中文則跳過翻譯
            sendHideOriginal: false,   // 隱藏原句、僅送出譯文（Chat/Whisper；翻譯失敗才補送原文）
            // ── 接收分類（動作/互動/悄悄話/私信/系統 Local）──
            recvEmote: true,
            recvAction: true,
            recvWhisper: true,
            recvBeep: true,
            recvLocal: false,
            recvSkipZhVariant: true,   // 接收語言為中文時，收到內容為中文則跳過翻譯
            recvHideOriginal: false,   // 隱藏原句、僅顯示譯文（Chat/Whisper；翻譯成功才隱藏）
            // ── 其他 ──
            loginNotice: true,
            translateChat: true,       // 手動翻譯（點選訊息出現翻譯按鈕）
            translateSelection: true,
            chatScrollFreeze: false,   // 是否載入並啟用 BC_ChatScrollFreeze（聊天室訊息凍結／搜尋擴充）
            skipStutter: true,
            chatButton: true,          // 聊天室快捷按鈕
            hotkeys: makeDefaultHotkeys()
        };
    }

    let config = defaultConfig();

    // ============================================================
    // 語系偵測（遊戲就緒後才準確）
    // ============================================================
    function isZH() {
        if (typeof TranslationLanguage !== "undefined") {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        return (navigator.language || "en").toLowerCase().startsWith("zh");
    }

    // ============================================================
    // i18n 系統
    // ============================================================
    // production 走 CDN；本地測試由 window.LikoDevBase 覆寫成 http://localhost/…/Plugins/
    const _I18N_BASE = (typeof window !== 'undefined' && window.LikoDevBase) || 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/';
    const LIKO_I18N_ENGINE_URL = _I18N_BASE + 'expand/BC_i18n.js';
    const LIKO_MAT_STRINGS_URL = _I18N_BASE + 'Translation/MAT-i18n.js';
    const I18N_NS = 'MAT';

    function loadScript(url) {
        return fetch(url)
            .then(res => { if (!res.ok) throw new Error(`[MAT] 無法載入 ${url} (${res.status})`); return res.text(); })
            .then(code => { new Function(code)(); });
    }

    // 用能力偵測（ensure）判斷 v2 引擎是否就緒 —— 舊版 v1 只有 version，會被誤判為已載入而擋掉 v2。
    // 字庫改用引擎的 ensure() 載入（依 URL 去重，不需自訂旗標）。
    async function ensureI18n() {
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') await loadScript(LIKO_I18N_ENGINE_URL);
        if (typeof window.Liko?.__Sys_i18n__?.ensure === 'function') await window.Liko.__Sys_i18n__.ensure(I18N_NS, LIKO_MAT_STRINGS_URL);
    }

    // 取翻譯字串；引擎尚未就緒時回傳 key 本身，不丟例外。vars 以 {name} 佔位代入。
    function ui(key, vars) {
        const fn = window.Liko?.__Sys_i18n__?.t;
        return fn ? fn(I18N_NS, key, vars) : key;
    }

    const mk = b => b ? '✅' : '❌';

    // 將錯誤代碼轉成對應的提示字串
    function apiHint(err) {
        const map = { rate_limit: 'hint_rate_limit', blocked: 'hint_blocked', network: 'hint_network' };
        return ui(map[err] || 'hint_unknown', { err: err || 'unknown' });
    }

    // ============================================================
    // SDK 初始化（訪問 BC 就開始，不依賴遊戲狀態）
    // ============================================================
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
                    console.warn(`🐈‍⬛ [MAT] ❌ ${ui('sdkTimeout')}`);
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
                version: MOD_VER,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
            });
        } catch (e) {
            console.error("🐈‍⬛ [MAT] ❌ failed to load:", e);
            return;
        }
        waitForGame();
    });

    // ============================================================
    // 設定管理
    // ============================================================
    function initializeConfig() {
        // 同一份 defaultConfig()，僅補上需登入後才能算的 recvLang。
        const defaults = { ...defaultConfig(), recvLang: detectDefaultRecvLang() };
        if (!config || typeof config !== 'object') config = { ...defaults };
        for (const [key, val] of Object.entries(defaults)) {
            if (config[key] === undefined || config[key] === null) config[key] = val;
        }
        normalizeHotkeys();
    }

    const SETTINGS_KEY = "Liko_MAT";
    const LEGACY_SETTINGS_KEY = "BCMachineTranslation";

    function saveSettings() {
        if (!Player?.ExtensionSettings) {
            ChatRoomSendLocal(ui('cmdNotLoggedIn'));
            return;
        }
        Player.ExtensionSettings[SETTINGS_KEY] = { ...config };
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
        }
    }

    function loadSettings() {
        const saved = Player?.ExtensionSettings?.[SETTINGS_KEY];
        if (!saved) return;
        config = { ...config, ...saved };
        normalizeHotkeys();
    }

    // 舊版設定以 BCMachineTranslation 為鍵，現改名為 Liko_MAT。
    function migrateSettingsKey() {
        const ext = Player?.ExtensionSettings;
        if (!ext) return;
        const legacy = ext[LEGACY_SETTINGS_KEY];
        if (legacy === undefined || ext[SETTINGS_KEY] !== undefined) return;
        ext[SETTINGS_KEY] = { ...legacy };
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
        }
    }

    // ============================================================
    // 翻譯請求隊列
    // ============================================================
    const translateQueue = {
        queue: [], processing: false, lastRequestTime: 0,
        baseInterval: 300, minInterval: 300, maxInterval: 3000,
        // 連續失敗時拉長間隔，成功後逐步恢復，避免錯誤雪崩式連發
        backoff() { this.minInterval = Math.min(this.maxInterval, this.minInterval * 2); },
        recover() {
            if (this.minInterval > this.baseInterval) {
                this.minInterval = Math.max(this.baseInterval, Math.floor(this.minInterval / 1.5));
            }
        },
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
            try {
                const res = await translateGoogle(item.text, item.targetLang);
                if (res.error) this.backoff(); else this.recover();
                item.resolve(res);
            } catch (e) {
                this.backoff();
                item.resolve({ translated: null, detectedLang: null, error: e.message });
            }
            this.process();
        }
    };

    // 單筆翻譯字數上限：超過就在標點／分段處切成多段送出，避免過長 URL 觸發 http_500
    const MAX_TRANSLATE_LEN = 500;

    // 將過長文字依「換行 > 句末標點 > 子句標點 > 空白」優先序切段，
    // 盡量切在語意邊界，避免在句子中間硬切導致翻譯錯誤；都找不到才硬切。
    function splitTextForTranslation(text, maxLen = MAX_TRANSLATE_LEN) {
        if (!text || text.length <= maxLen) return [text];
        const boundaries = [
            /\n/g,                                  // 換行
            /[.!?。！？…〜~]['"」』”’\)\]\s]*/g,      // 句末標點（含其後的引號／括號／空白）
            /[,;:、，；：·\)\]》」』]['"”’\s]*/g,      // 子句標點
            /\s+/g,                                 // 任意空白
        ];
        const chunks = [];
        let rest = text;
        while (rest.length > maxLen) {
            const window = rest.slice(0, maxLen);
            const floor = Math.floor(maxLen * 0.5);   // 太靠前的邊界不採用，避免切出過小段落
            let cut = -1;
            for (const re of boundaries) {
                re.lastIndex = 0;
                let m, last = -1;
                while ((m = re.exec(window)) !== null) {
                    const end = m.index + m[0].length;
                    if (end >= floor) last = end;
                    if (re.lastIndex === m.index) re.lastIndex++;
                }
                if (last > 0) { cut = last; break; }
            }
            if (cut <= 0) {
                cut = maxLen;
                const code = rest.charCodeAt(cut - 1);   // 別把代理對（emoji）切成兩半
                if (code >= 0xD800 && code <= 0xDBFF) cut--;
            }
            chunks.push(rest.slice(0, cut));
            rest = rest.slice(cut);
        }
        if (rest) chunks.push(rest);
        return chunks;
    }

    // 長文字分段翻譯後再接回；任一段失敗即視為整體失敗。各段仍走佇列以維持節流。
    async function translateChunked(text, target) {
        const chunks = splitTextForTranslation(text, MAX_TRANSLATE_LEN);
        if (chunks.length <= 1) return translateQueue.add(text, target);
        let combined = '', detectedLang = null;
        for (const chunk of chunks) {
            const res = await translateQueue.add(chunk, target);
            if (res.error || res.translated === null) {
                return { translated: null, detectedLang: null, error: res.error || 'unknown' };
            }
            combined += res.translated;
            if (!detectedLang && res.detectedLang) detectedLang = res.detectedLang;
        }
        return { translated: combined, detectedLang };
    }

    // API 失敗通知器：30 秒 cooldown，避免洗頻
    const apiErrorNotifier = {
        lastNotified: 0,
        cooldown: 30000,
        notify(reason) {
            const now = Date.now();
            if (now - this.lastNotified < this.cooldown) return;
            this.lastNotified = now;
            ChatRoomSendLocal(ui('apiFail', { hint: apiHint(reason) }));
        }
    };

    // 單次請求逾時：某個 fetch 若永久 hang 住，序列佇列會整條卡死、其後訊息全部靜默不翻，
    // 那是最大批量丟失來源。逾時後 abort 併入下方 transient 路徑重試，不會直接算失敗丟棄。
    const FETCH_TIMEOUT = 10000;
    async function translateGoogle(text, target, attempt = 0) {
        const MAX_RETRY = 2;
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const resp = await fetch(url, { signal: ctrl.signal });

            if (resp.status === 429) throw new Error('rate_limit');
            if (resp.status === 403) throw new Error('blocked');
            if (!resp.ok) throw new Error(`http_${resp.status}`);

            const data = await resp.json();
            const translated = data[0]?.map(seg => seg?.[0] || '').join('') || text;
            return { translated, detectedLang: data[2] || null };
        } catch (e) {
            // fetch 本身失敗（網路斷線、timeout）會是 TypeError；逾時 abort 為 AbortError，一併視為網路暫時性
            const isNetwork = e instanceof TypeError || e.name === 'AbortError';
            const reason = isNetwork ? 'network' : (e.message || 'unknown');
            // 5xx 伺服器錯誤與網路中斷屬暫時性，退避後重試（600ms、1200ms）
            const transient = isNetwork || /^http_5\d\d$/.test(reason);
            if (transient && attempt < MAX_RETRY) {
                await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                return translateGoogle(text, target, attempt + 1);
            }
            return { translated: null, detectedLang: null, error: reason };
        } finally {
            clearTimeout(to);
        }
    }

    const TRANSLATE_MARKER = '[MAT]';

    // ============================================================
    // MAT 意圖旗標：夾在送出訊息的 Dictionary，告訴對方「我會把這句翻成 X 並廣播 [🌐]」。
    // 用 BC 不認得的欄位名（long）載語言碼：伺服器會保留、BC 不會渲染或當文字替換。
    // 接收端據此跳過重複翻譯。詳見記憶 bc-chat-dictionary-survival。
    // ============================================================
    const LIKO_MAT_TAG = 'LikoMAT';
    const LIKO_MAT_FIELD = 'long';
    const MAT_FLAG_TYPES = ['Chat', 'Emote', 'Whisper', 'Action'];

    // 把旗標推到 Dictionary 末端（不動既有 entry，例如 Action 仍靠 dict[0].Text）
    function addMATFlag(data) {
        if (!Array.isArray(data.Dictionary)) data.Dictionary = data.Dictionary == null ? [] : [data.Dictionary];
        if (data.Dictionary.some(e => e && e.Tag === LIKO_MAT_TAG)) return;
        data.Dictionary.push({ Tag: LIKO_MAT_TAG, [LIKO_MAT_FIELD]: config.sendLang });
    }

    // 從收到的訊息讀旗標語言碼；沒有則回 null
    function readMATFlag(data) {
        if (!data || !Array.isArray(data.Dictionary)) return null;
        const e = data.Dictionary.find(x => x && x.Tag === LIKO_MAT_TAG);
        return e ? (e[LIKO_MAT_FIELD] ?? null) : null;
    }

    // 取出 BC 原生「回覆」功能夾在 Dictionary 裡的 ReplyId（該訊息是回覆哪一則訊息）。
    // 修正：MAT 送出翻譯廣播（[🌐] ...）時原本沒有把這個 ReplyId 一起帶過去，
    // 導致翻譯後的那則訊息在畫面上遺失「回覆/引用」的關聯，讀起來像是憑空冒出的訊息。
    function getReplyIdFromDictionary(dict) {
        if (!Array.isArray(dict)) return null;
        const e = dict.find(x => x && x.Tag === 'ReplyId' && x.ReplyId);
        return e ? e.ReplyId : null;
    }

    function isPureUrl(text) {
        if (!text) return false;
        const trimmed = text.trim().replace(/^[\s\(\[\*]+|[\s\)\]\*]+$/g, '').trim();
        return /^https?:\/\//i.test(trimmed);
    }

    // 編碼/壓縮資料（LZString / base64 / hex / hash）——翻了沒意義又浪費 API。
    // 只看「最長的單一無空格 token」：正常句子有空格、CJK 不在字元集，幾乎不會誤殺。
    function looksEncoded(text) {
        const longest = text.trim().split(/\s+/).reduce((a, b) => b.length > a.length ? b : a, '');
        if (longest.length < 24) return false;
        // LZString 壓縮 JSON 常見開頭（高信心，短的也攔；只留特異性高的，避免誤殺正常單字）
        if (/^(N4Ig|NobwRA)/.test(longest)) return true;
        // 通用：夠長 + 純編碼字元集 + 大小寫數字混合
        if (longest.length >= 40
            && /^[A-Za-z0-9+\-$/=_]+$/.test(longest)
            && /[A-Z]/.test(longest) && /[a-z]/.test(longest) && /\d/.test(longest)) return true;
        return false;
    }

    // 短顏文字過濾：收到 ≤10 字的短句，若字母數 <3（1~2 個）且彼此不相鄰（無連續字母），
    // 視為顏文字（:D、o.O、T_T、>w< …）跳過。含中日韓/假名/諺文則豁免——單一「好/はい/네」
    // 是有意義的字，需翻譯。兩個相鄰字母（hi/ok/xD）視為真的短單字，不過濾。
    function looksLikeShortKaomoji(text) {
        const t = (text || '').trim();
        if (!t || t.length > 10) return false;
        if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t)) return false;
        const letters = t.match(/\p{L}/gu) || [];
        if (letters.length >= 3) return false;
        if (/\p{L}\p{L}/u.test(t)) return false;   // 有相鄰字母 → 可能是真的短單字
        return true;
    }

    // 是否為中文文本：含漢字，且不含日文假名 / 韓文諺文（用來與日、韓區分）。
    function isChineseText(text) {
        if (!/\p{Script=Han}/u.test(text)) return false;
        if (/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(text)) return false;
        return true;
    }
    // 「設定語言為中文時跳過簡繁翻譯」：己方目標為中文且內容已是中文 → 中翻中無意義，跳過。
    function skipZhSend(text) { return config.sendSkipZhVariant && /^zh/i.test(config.sendLang) && isChineseText(text); }
    function skipZhRecv(text) { return config.recvSkipZhVariant && /^zh/i.test(config.recvLang) && isChineseText(text); }

    // 自動翻譯的統一跳過判斷：送出端據此決定要不要夾旗標、接收端據此跳過——兩邊必須一致，
    // 否則「不該翻的句子」被夾了旗標，接收端會空等 1 秒造成爆量塞車。
    function isUntranslatable(text) {
        if (!text) return true;
        if (text.includes('BCX_') || /^[\d\s:]+$/.test(text) ||
            text.includes(TRANSLATE_MARKER) || text.includes('[🌐]') ||
            text.includes('🔊') || text.includes('📞')) return true;
        if (isPureUrl(text)) return true;
        if (!/\p{L}/u.test(text)) return true;   // 純顏文字/符號/emoji
        if (looksLikeShortKaomoji(text)) return true;  // 短顏文字（含 1~2 個不連續字母）
        if (looksEncoded(text)) return true;     // LZString/base64/hex/hash
        return false;
    }

    // BC 結巴語法：結巴時會在詞首插入「同字 + 連字號」，例如 "n-no problem"、"I-I-I love"、"我-我好累"。
    // 翻譯前先移除這類前綴，避免被翻成「N-沒問題」這種破碎結果。
    // 判斷依據：連字號前是位於詞首的單一字元，且與其後緊接的詞首字相同（英文不分大小寫）才視為結巴；
    //          因此 "co-op"、"e-mail"、"x-ray" 等正常連字號詞不會被誤刪。
    const STUTTER_CLASS = 'A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF\\u3040-\\u30FF\\u4E00-\\u9FFF\\uAC00-\\uD7A3';
    const STUTTER_RE = new RegExp(`(?<![${STUTTER_CLASS}])([${STUTTER_CLASS}])(?:-\\1)*-(?=\\1)`, 'gi');
    function stripStutter(text) {
        if (!config.skipStutter || !text) return text;
        return text.replace(STUTTER_RE, '');
    }

    async function smartTranslate(text, targetLang) {
        if (!config.enabled || isUntranslatable(text)) return null;
        text = stripStutter(text);
        try {
            const { translated, error } = await translateChunked(text, targetLang);
            if (error || translated === null) {
                apiErrorNotifier.notify(error || '');
                return null;
            }
            return translated;
        } catch (e) {
            console.error('🐈‍⬛ [MAT] ❌ Error:', e);
            return null;
        }
    }

    // 捲動採 BC 原生語義（Element.js 的 ElementIsScrolledToEnd / ElementScrollToEnd），
    // 分成「插入前判斷」＋「插入後才捲」兩段——這正是 BC 收到新訊息時的作法：只有你本來就
    // 停在最底部，新內容才把你帶到底；你往上看歷史就不動你。因為判斷放在插入「之前」，
    // 不必再用 150px 容差去猜，也不會因剛插入的長翻譯撐高而誤判成「不在底部」。

    // 插入翻譯「之前」呼叫：聊天室本來是否就捲在最底部。
    // 凍結中（使用者往上看歷史）一律回 false，交給 ChatScrollFreeze 決定、MAT 不搶。
    function chatWasAtEnd() {
        if (window.Liko.__Sys_ChatScrollFreeze__?.isFrozen?.()) return false;
        const log = document.querySelector('#TextAreaChatLog');
        if (!log) return false;
        return (typeof ElementIsScrolledToEnd === 'function')
            ? ElementIsScrolledToEnd(log)
            : (log.scrollHeight - log.scrollTop - log.clientHeight <= 1);
    }

    // 插入翻譯「之後」呼叫：只有插入前本來就在底部才捲到底。
    // 這 60ms 內若使用者已往上捲觸發凍結就放棄，避免把人拉回底部。
    function scrollChatToEndIfWasAtEnd(wasAtEnd) {
        if (!wasAtEnd) return;
        setTimeout(() => {
            if (window.Liko.__Sys_ChatScrollFreeze__?.isFrozen?.()) return;
            if (typeof ElementScrollToEnd === 'function') ElementScrollToEnd('TextAreaChatLog');
            else { const log = document.querySelector('#TextAreaChatLog'); if (log) log.scrollTop = log.scrollHeight; }
        }, 60);
    }

    // ============================================================
    // Observer
    // ============================================================
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

    // 依旗標定位剛 render 的訊息節點：先用 MsgId 精準，後備用最後一則 + 發送者相符
    function findFlaggedNode(data) {
        const log = document.querySelector('#TextAreaChatLog');
        if (!log) return null;
        let msgId = null;
        if (Array.isArray(data.Dictionary)) {
            const e = data.Dictionary.find(x => x && typeof x.MsgId === 'string');
            msgId = e?.MsgId || null;
        }
        if (msgId) {
            const node = log.querySelector(`[msgid="${msgId}"]`)?.closest('.ChatMessage');
            if (node) return node;
        }
        const last = log.lastElementChild;
        if (last?.classList?.contains('ChatMessage') && String(data.Sender) === last.dataset?.sender) return last;
        return null;
    }

    // 節點之後是否已出現同一發送者的 [🌐] 翻譯（對方廣播已到）
    function hasRemoteTranslation(node) {
        let sib = node.nextElementSibling, hops = 0;
        while (sib && hops < 8) {
            if (sib.classList?.contains('ChatMessage') &&
                !sib.classList.contains('mat-translated') &&
                !sib.classList.contains('mat-manual-translated') &&
                sib.dataset?.sender === node.dataset?.sender &&
                sib.textContent.includes('[🌐]')) return true;
            sib = sib.nextElementSibling; hops++;
        }
        return false;
    }

    // 跳過自翻後，最多等 timeout 毫秒讓對方的 [🌐] 廣播到達；到了回 true（不需自翻）
    async function waitForRemoteTranslation(node, timeout = 1000, step = 150) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (hasRemoteTranslation(node)) return true;
            await new Promise(r => setTimeout(r, step));
        }
        return hasRemoteTranslation(node);
    }

    // 依訊息類型的 CSS class 對應接收分類開關（BC 訊息 class 為 ChatMessage${Type}）。
    // 一般聊天 ChatMessageChat 只受總接收開關管，回傳 true。
    function recvGateAllows(node) {
        const cl = node.classList;
        if (cl.contains('ChatMessageBeep')) return config.recvBeep;
        if (cl.contains('ChatMessageWhisper')) return config.recvWhisper;
        if (cl.contains('ChatMessageEmote')) return config.recvEmote;
        if (cl.contains('ChatMessageAction') || cl.contains('ChatMessageActivity')) return config.recvAction;
        if (cl.contains('ChatMessageLocalMessage') || cl.contains('ChatMessageServerMessage')) return config.recvLocal;
        return true;
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

        if (!recvGateAllows(node)) return;

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
            if (!msg.trim() || skipZhRecv(msg)) return;
            const translated = await smartTranslate(msg, config.recvLang);
            if (translated !== null && translated !== msg) createTranslatedDiv(node, translated);
            return;
        }

        node.classList.add("mat-processed");
        const message = extractCleanMessage(node);
        if (!message) return;
        if (skipZhRecv(message)) return;
        // 對方已標記要翻成我的語言（mat-skip）：先等其 [🌐] 廣播，最多 1 秒；沒到（對方翻譯失敗）才自翻
        if (node.classList.contains('mat-skip') && await waitForRemoteTranslation(node)) return;
        const translated = await smartTranslate(message, config.recvLang);
        if (translated !== null && translated !== message) {
            createTranslatedDiv(node, translated);
            // 隱藏原句、僅留譯文：只在確實產生譯文後、且為 Chat/Whisper 時隱藏（失敗/簡繁跳過不隱藏，免訊息消失）
            if (config.recvHideOriginal &&
                (node.classList.contains('ChatMessageChat') || node.classList.contains('ChatMessageWhisper'))) {
                node.style.display = 'none';
            }
        }
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
        let body = translatedText;
        if (originalNode.classList.contains('ChatMessageChat')) {
            const name = originalNode.querySelector('.ChatMessageName')?.textContent?.trim();
            if (name) body = `${name}: ${translatedText}`;
        }
        div.textContent = `[🌐] ${body}`;
        div.style.cssText = 'background:rgba(76,175,80,0.1);border-left:3px solid #4CAF50;padding:2px 6px;margin-top:2px;font-size:0.95em;opacity:0.9';
        const wasAtEnd = chatWasAtEnd();   // 插入前先判斷是否本來就在底部
        originalNode.parentNode.insertBefore(div, originalNode.nextSibling);
        scrollChatToEndIfWasAtEnd(wasAtEnd);
    }

    // ============================================================
    // 語言選擇下拉
    // ============================================================
    function openMATLangSelect(anchor, onSelect) {
        document.getElementById('mat-inline-lang-select')?.remove();
        const sel = document.createElement('select');
        sel.id = 'mat-inline-lang-select';
        const rect = anchor.getBoundingClientRect();
        const selW = window.innerWidth * 0.12;
        let left = rect.right + 4;
        if (left + selW > window.innerWidth - 8) left = rect.left - selW - 4;
        sel.style.cssText = `position:fixed;z-index:99999;left:${Math.max(4,left)}px;top:${Math.max(4,rect.top-4)}px;font-size:1vw;padding:0.2vh 0.3vw;border:1px solid #4CAF50;border-radius:4px;background:#1a1a2e;color:#eee;cursor:pointer;max-height:35vh;min-width:9vw;font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;`;
        langCodes.forEach((code, i) => {
            const opt = document.createElement('option');
            const uiName = isZH() ? langNameZH[i] : langNameEN[i];
            const native = langNameNative[i];
            opt.value = code;
            const nm = uiName === native ? uiName : `${uiName} / ${native}`;
            opt.textContent = langFlags[i] ? `${langFlags[i]} ${nm}` : nm;
            if (code === config.recvLang) opt.selected = true;
            sel.appendChild(opt);
        });
        let settled = false;
        sel.addEventListener('change', () => { settled = true; onSelect(sel.value); if (sel.parentNode) sel.remove(); });
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

        const message = stripStutter(extractCleanMessage(node));
        if (!message) return;

        updateClickToolbarStatus(ui('translating'));

        const { translated, error } = await translateChunked(message, lang);

        if (error || translated === null) {
            updateClickToolbarStatus(null);
            ChatRoomSendLocal(ui('translateFail', { hint: apiHint(error) }));
            return;
        }

        if (translated === message) { updateClickToolbarStatus(null); return; }

        updateClickToolbarStatus(null);

        const div = document.createElement('div');
        div.dataset.lang = lang;
        const cls = [...node.classList].find(c => c.startsWith('ChatMessage') && c !== 'ChatMessage' && c !== 'ChatMessageNonDialogue');
        div.classList.add('ChatMessage', 'mat-manual-translated');
        if (cls) div.classList.add(cls);
        div.textContent = `[🌐${lang.toUpperCase()}] ${translated}`;
        div.style.cssText = 'position:relative;background:rgba(33,150,243,0.12);border-left:3px solid #2196F3;padding:2px 24px 2px 6px;margin-top:2px;font-size:0.95em;opacity:0.95;user-select:text;cursor:text;';
        div.title = ui('dblClickRemove');
        div.addEventListener('dblclick', () => div.remove());

        const closeX = document.createElement('span');
        closeX.textContent = '✕';
        closeX.style.cssText = 'position:absolute;right:4px;top:50%;transform:translateY(-50%);color:#888;font-size:11px;cursor:pointer;opacity:0;transition:opacity 0.15s;padding:0 2px;line-height:1;';
        closeX.title = ui('removeTranslation');
        closeX.addEventListener('click', (e) => { e.stopPropagation(); div.remove(); });
        div.addEventListener('mouseenter', () => { closeX.style.opacity = '1'; });
        div.addEventListener('mouseleave', () => { closeX.style.opacity = '0'; });
        div.appendChild(closeX);

        let insertAfter = node;
        while (insertAfter.nextElementSibling?.classList.contains('mat-translated') ||
               insertAfter.nextElementSibling?.classList.contains('mat-manual-translated')) {
            insertAfter = insertAfter.nextElementSibling;
        }
        const wasAtEnd = chatWasAtEnd();   // 插入前先判斷是否本來就在底部
        node.parentNode.insertBefore(div, insertAfter.nextSibling);
        scrollChatToEndIfWasAtEnd(wasAtEnd);
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
        altLangBtn.title = ui('otherLang');
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
        result.textContent = ui('translating');
        const { translated, error } = await translateChunked(selected, lang);
        if (error || translated === null) {
            result.style.color = '#ff8a80';
            result.textContent = ui('selectionFail');
            return;
        }
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
    // 點選訊息顯示翻譯工具列
    // ============================================================
    let clickToolbar = null;
    let clickToolbarTarget = null;

    function createClickToolbar() {
        if (clickToolbar) return;
        clickToolbar = document.createElement('div');
        clickToolbar.id = 'mat-click-toolbar';
        clickToolbar.style.cssText = [
            'position:fixed', 'z-index:99998', 'display:none', 'align-items:center',
            'gap:4px', 'background:#1a1a2e', 'border:1px solid #4CAF50', 'border-radius:6px',
            'padding:3px 8px', 'box-shadow:0 2px 8px rgba(0,0,0,0.5)', 'pointer-events:all', 'user-select:none',
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
        altBtn.title = ui('translateTo');
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
        closeBtn.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); hideClickToolbar(); });

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
            if (!msg || msg.classList.contains('mat-translated') || msg.classList.contains('mat-manual-translated')) {
                hideClickToolbar(); return;
            }
            if (e.target.closest('.menubar')) return;
            if (clickToolbarTarget === msg) { hideClickToolbar(); return; }
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

    // ============================================================
    // 發送翻譯
    // ============================================================
    function hookSendFunctions() {
        if (!modApi) return;
        const safeStr = (v) => typeof v === 'string' ? v : null;

        // 隱藏原句模式：翻譯失敗時要補送原文，但直接 ServerSend(原data) 會重入本 hook 再翻一次而死循環。
        // 用同步旗標放行這一次補送（ServerSend→hook 是同步的，補送完立即歸位）。
        let matBypass = false;
        const sendRaw = (args) => { matBypass = true; try { ServerSend(...args); } finally { matBypass = false; } };

        modApi.hookFunction("ServerSend", 10, (args, next) => {
            if (matBypass) return next(args);
            const [command, data] = args;
            if (!config.enabled || !config.translateSent) return next(args);

            // 夾語言旗標（config.sendLang）到 Dictionary：
            //  - 原句：夾「我會翻成 X 並廣播」意圖旗標，接收端據此跳過重複翻譯（顏文字/編碼/[🌐]/
            //    關閉的分類不夾，免接收端空等 1 秒）。
            //  - 廣播出去的 [🌐] 翻譯本身：也夾旗標標明其語言，接收端可純憑屬性判斷（中文變體就隱藏）。
            if (command === "ChatRoomChat" && MAT_FLAG_TYPES.includes(data.Type)) {
                const typeOn = { Chat: true, Emote: config.sendEmote, Whisper: config.sendWhisper, Action: config.sendAction };
                const ot = data.Type === "Action" ? safeStr(data.Dictionary?.[0]?.Text) : safeStr(data.Content);
                const isBroadcast = ot ? ot.includes('[🌐]') : false;
                if (ot && typeOn[data.Type] && (isBroadcast || (!isUntranslatable(ot) && !skipZhSend(ot)))) addMATFlag(data);
            }

            if (command === "ChatRoomChat" && data.Type === "Chat") {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]') && !skipZhSend(t)) {
                    const replyId = getReplyIdFromDictionary(data.Dictionary);
                    const hide = config.sendHideOriginal;
                    if (!hide) next(args);   // 隱藏原句：先不送原文，等譯文；失敗才補送
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r === null || r === t) { if (hide) sendRaw(args); return; }
                        const payload = { Content: `[🌐] ${r}`, Type: "Chat" };
                        if (replyId) payload.Dictionary = [{ ReplyId: replyId, Tag: "ReplyId" }];
                        ServerSend("ChatRoomChat", payload);
                    }).catch(() => { if (hide) sendRaw(args); });
                    return;
                }
            }
            if (command === "ChatRoomChat" && data.Type === "Action" && config.sendAction) {
                const t = safeStr(data.Dictionary?.[0]?.Text);
                if (t && !t.includes('[🌐]') && !skipZhSend(t)) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== null && r !== t) ServerSend("ChatRoomChat", {
                            Type: "Action", Content: "CUSTOM_SYSTEM_ACTION",
                            Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: `[🌐] ${r}` }]
                        });
                    });
                    return;
                }
            }
            if (command === "ChatRoomChat" && data.Type === "Whisper" && config.sendWhisper) {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]') && !skipZhSend(t)) {
                    const replyId = getReplyIdFromDictionary(data.Dictionary);
                    const hide = config.sendHideOriginal;
                    if (!hide) next(args);   // 隱藏原句：先不送原文，等譯文；失敗才補送
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r === null || r === t) { if (hide) sendRaw(args); return; }
                        const payload = { Content: `[🌐] ${r}`, Type: "Whisper", Target: data.Target, Sender: data.Sender };
                        if (replyId) payload.Dictionary = [{ ReplyId: replyId, Tag: "ReplyId" }];
                        ServerSend("ChatRoomChat", payload);
                    }).catch(() => { if (hide) sendRaw(args); });
                    return;
                }
            }
            if (command === "AccountBeep" && config.sendBeep) {
                const t = safeStr(data.Message);
                if (t && !t.includes('[🌐]') && (!data.BeepType || data.BeepType === '') && isUserMessage(t) && !t.trim().startsWith('{') && !skipZhSend(t)) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== null && r !== t) ServerSend("AccountBeep", { MemberNumber: data.MemberNumber, Message: `[🌐] ${r}` });
                    });
                    return;
                }
            }
            return next(args);
        });

        modApi.hookFunction("ChatRoomSendEmote", 10, (args, next) => {
            if (!config.enabled || !config.translateSent || !config.sendEmote) return next(args);
            const [t] = args;
            if (t && !t.includes('[🌐]') && !skipZhSend(t)) {
                // BC 的 ChatRoomMessageGetReplyId() 是讀輸入框的 reply-id 屬性；
                // 原文送出後 ChatRoomGenerateChatRoomChatMessage 會呼叫 ChatRoomMessageReplyStop()
                // 把它清掉，所以要先記下來，翻譯版送出前再暫時放回去，讓它照原生流程夾進 Dictionary。
                const replyId = ChatRoomMessageGetReplyId();
                next(args);
                smartTranslate(t, config.sendLang).then(r => {
                    if (r === null || r === t) return;
                    if (replyId) document.getElementById('InputChat')?.setAttribute('reply-id', replyId);
                    ChatRoomSendEmote(`[🌐] ${r}`);
                });
                return;
            }
            return next(args);
        });
    }

    // 接收端：讀對方夾的意圖旗標，若其目標語言 == 我的接收語言，標記節點 mat-skip 讓 observer 跳過自翻
    function hookReceiveFlag() {
        if (!modApi) return;
        modApi.hookFunction("ChatRoomMessage", 10, (args, next) => {
            const result = next(args);
            try {
                if (!config.enabled || !config.translateReceived) return result;
                const data = args[0];
                if (!data || typeof data !== 'object') return result;
                if (data.Sender === Player?.MemberNumber) return result;
                const lang = readMATFlag(data);
                if (!lang) return result;
                const node = findFlaggedNode(data);
                // 對方廣播的翻譯（含 [🌐]）夾了語言旗標：若標的是中文變體、我又開了簡繁跳過 →
                // 直接隱藏，免與原文並列成兩筆（純憑屬性判斷，不必猜內容是不是中文）。
                if (node && /^zh/i.test(lang) && config.recvSkipZhVariant && /^zh/i.test(config.recvLang)
                    && node.textContent.includes('[🌐]')) {
                    node.style.display = 'none';
                } else if (lang === config.recvLang) {
                    node?.classList.add('mat-skip');
                }
            } catch (e) {
                console.warn('🐈‍⬛ [MAT] ❌ recv flag hook:', e);
            }
            return result;
        });
    }

    // ============================================================
    // 語言定義
    // ============================================================
    const langCodes    = ['zh-TW','zh-CN','en','ja','ko','de','fr','es','ru','it','pt','pl','nl','tr','sv','uk','cs','hu','ro','ar','th','vi','id','ms'];
    const langNameEN   = ['Chinese (Traditional)','Chinese (Simplified)','English','Japanese','Korean','German','French','Spanish','Russian','Italian','Portuguese','Polish','Dutch','Turkish','Swedish','Ukrainian','Czech','Hungarian','Romanian','Arabic','Thai','Vietnamese','Indonesian','Malay'];
    const langNameZH   = ['繁體中文','簡體中文','英文','日文','韓文','德文','法文','西班牙文','俄文','義大利文','葡萄牙文','波蘭文','荷蘭文','土耳其文','瑞典文','烏克蘭文','捷克文','匈牙利文','羅馬尼亞文','阿拉伯文','泰文','越南文','印尼文','馬來文'];
    const langNameNative = ['繁體中文','简体中文','English','日本語','한국어','Deutsch','Français','Español','Русский','Italiano','Português','Polski','Nederlands','Türkçe','Svenska','Українська','Čeština','Magyar','Română','العربية','ภาษาไทย','Tiếng Việt','Bahasa Indonesia','Bahasa Melayu'];
    // 與 langCodes 對齊的國旗 emoji（國旗字元是「國家碼」regional indicator，非語言碼）。
    // 顯示需白嫖 BC country-flag polyfill 注入的 "Twemoji Country Flags" 字體，見 openMATLangSelect。
    const langFlags = ['🇹🇼','🇨🇳','🇬🇧','🇯🇵','🇰🇷','🇩🇪','🇫🇷','🇪🇸','🇷🇺','🇮🇹','🇵🇹','🇵🇱','🇳🇱','🇹🇷','🇸🇪','🇺🇦','🇨🇿','🇭🇺','🇷🇴','🇸🇦','🇹🇭','🇻🇳','🇮🇩','🇲🇾'];
    // 語言碼 → 國旗（查無回空字串）。用於聊天室快捷選單的發送/接收翻譯鈕標示「當前目標語言」。
    const flagOf = (code) => { const i = langCodes.indexOf(code); return i >= 0 ? langFlags[i] : ''; };
    let uiSendIdx = 0;
    let uiRecvIdx = 0;

    // 依瀏覽器語言決定預設接收語言；不在 MAT 翻譯列表(langCodes)內則退回英文。
    // 僅作為「未曾修改設定」時的預設值——若使用者已存過設定，loadSettings 會覆蓋此值。
    function detectDefaultRecvLang() {
        const low = (navigator.language || 'en').toLowerCase();
        // 中文需區分繁簡，不能只取前兩碼
        if (/^zh(-|_)?(tw|hant|hk|mo)/.test(low)) return 'zh-TW';
        if (/^zh/.test(low)) return 'zh-CN';
        const base = low.split(/[-_]/)[0];
        return langCodes.includes(base) ? base : 'en';
    }

    // ============================================================
    // 快捷鍵系統
    // ============================================================
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

    function hotkeyToString(hk) {
        if (!hk || !hk.key) return ui('hotkeyNone');
        const mods = (hk.modifiers || []);
        const parts = [];
        if (mods.includes('Ctrl'))  parts.push('Ctrl');
        if (mods.includes('Alt'))   parts.push('Alt');
        if (mods.includes('Shift')) parts.push('Shift');
        parts.push(KEY_DISPLAY[hk.key] || hk.key);
        return parts.join('+');
    }

    function matchesHotkey(event, hk) {
        if (!hk || !hk.key) return false;
        if (event.code !== hk.key) return false;
        const mods = hk.modifiers || [];
        if (event.ctrlKey  !== mods.includes('Ctrl'))  return false;
        if (event.altKey   !== mods.includes('Alt'))   return false;
        if (event.shiftKey !== mods.includes('Shift')) return false;
        return true;
    }

    // 三個快捷鍵動作：總開關 / 接收翻譯 / 發送翻譯。各自帶 enabled 旗標，關閉則不觸發。
    function hotkeyActionToggle() {
        const hk = config.hotkeys.toggle;
        config.enabled = !config.enabled;
        ChatRoomSendLocal(config.enabled
                          ? ui('hotkeyEnabled',  { hk: hotkeyToString(hk) })
                          : ui('hotkeyDisabled', { hk: hotkeyToString(hk) }));
        if (config.enabled) startObserver(); else stopObserver();
    }
    function hotkeyActionRecv() {
        config.translateReceived = !config.translateReceived;
        ChatRoomSendLocal(config.translateReceived ? ui('hkRecvOn') : ui('hkRecvOff'));
    }
    function hotkeyActionSend() {
        config.translateSent = !config.translateSent;
        ChatRoomSendLocal(config.translateSent ? ui('hkSendOn') : ui('hkSendOff'));
    }

    function setupHotkeyListener() {
        const actions = { toggle: hotkeyActionToggle, recv: hotkeyActionRecv, send: hotkeyActionSend };
        document.addEventListener('keydown', (e) => {
            if (e.isComposing || e.keyCode === 229) return;
            if (hotkeyRecording) return;   // 錄製新鍵時不觸發動作
            for (const name of ['toggle', 'recv', 'send']) {
                const hk = config.hotkeys[name];
                if (!hk || !hk.enabled || !hk.key) continue;
                const mods = hk.modifiers || [];
                const hasModifier = mods.includes('Ctrl') || mods.includes('Alt');
                if (!hasModifier) {
                    const tag = document.activeElement?.tagName?.toLowerCase();
                    if (tag === 'input' || tag === 'textarea') continue;
                }
                if (matchesHotkey(e, hk)) {
                    e.preventDefault();
                    actions[name]();
                    saveSettings();
                    return;
                }
            }
        }, true);
    }

    // ============================================================
    // 快捷鍵錄製
    // ============================================================
    let hotkeyRecording = false;
    let hotkeyRecordingTarget = null;

    function startHotkeyRecording(actionName) {
        hotkeyRecording = true;
        hotkeyRecordingTarget = actionName;
    }

    function handleHotkeyRecording(e) {
        if (!hotkeyRecording || !hotkeyRecordingTarget) return false;
        if (['Control','Alt','Shift','Meta'].includes(e.key)) return false;
        e.preventDefault(); e.stopPropagation();
        const mods = [];
        if (e.ctrlKey)  mods.push('Ctrl');
        if (e.altKey)   mods.push('Alt');
        if (e.shiftKey) mods.push('Shift');
        if (e.key === 'Escape') { hotkeyRecording = false; hotkeyRecordingTarget = null; return true; }
        if (!(e.code in KEY_DISPLAY)) return false;
        config.hotkeys[hotkeyRecordingTarget] = { key: e.code, modifiers: mods };
        hotkeyRecording = false;
        hotkeyRecordingTarget = null;
        saveSettings();
        return true;
    }

    function clearHotkey(actionName) {
        config.hotkeys[actionName] = { key: null, modifiers: [] };
        saveSettings();
    }

    document.addEventListener('keydown', (e) => { handleHotkeyRecording(e); }, true);

    // ============================================================
    // 設定畫面
    // ============================================================
    // 分頁式版面：左側頁簽（總開關/基本/發送/接收/其他）、中間設定、右側說明框。
    // run() 每幀重建互動命中區 _hits，click() 直接比對，兩邊不需各寫一份座標。
    const matSettingsScreen = {
        tab: 1,             // 內容頁：1基本 2發送 3接收 4其他（左側第 0 鍵為總開關直接切換）
        hoverDesc: '',
        _hits: [],          // [{x,y,w,h,onClick}]

        C: {
            TAB_X: 90, TAB_Y0: 210, TAB_W: 300, TAB_H: 66, TAB_GAP: 78,
            // CB_SZ=64：BC 的打勾圖以原生尺寸（約 60×60）畫在框內 +2 偏移處，框需 64 才裝得下
            CBX: 490, CB_SZ: 64, LBL_X: 575, LBL_W: 460,
            SEL_X: 1060, SEL_W: 250,
            ROW_Y0: 225, ROW_H: 80,
            HK_KEY_X: 970, HK_KEY_W: 210, HK_CLR_X: 1195, HK_CLR_W: 90,
            HELP_X: 1350, HELP_Y: 200, HELP_W: 560, HELP_H: 700,
        },

        load() {
            uiSendIdx = Math.max(0, langCodes.indexOf(config.sendLang));
            uiRecvIdx = Math.max(0, langCodes.indexOf(config.recvLang));
        },

        // 螢幕座標錨點（供語言下拉定位於按鈕旁）
        _anchor(btnX, btnY, w) {
            return { getBoundingClientRect: () => {
                const canvas = document.querySelector('canvas');
                const r = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 2000, height: 1000 };
                return {
                    left:  r.left + btnX * (r.width / 2000),
                    right: r.left + (btnX + w) * (r.width / 2000),
                    top:   r.top  + btnY * (r.height / 1000)
                };
            }};
        },
        _hit(x, y, w, h, onClick) { this._hits.push({ x, y, w, h, onClick }); },
        _rowMid(y) { return y + this.C.CB_SZ / 2 + 9; },
        _left(fn) { const p = MainCanvas.textAlign; MainCanvas.textAlign = "left"; try { fn(); } finally { MainCanvas.textAlign = p; } },

        // checkbox 列：勾選框 + 標籤，hover 顯示說明
        _cb(y, label, val, desc, onClick, disabled) {
            const { CBX, CB_SZ, LBL_X, LBL_W } = this.C;
            DrawCheckbox(CBX, y, CB_SZ, CB_SZ, "", val, disabled);
            this._left(() => DrawTextFit(label, LBL_X, this._rowMid(y), LBL_W, disabled ? "Gray" : "Black"));
            if (!disabled) this._hit(CBX, y, CB_SZ, CB_SZ, onClick);
            if (desc && MouseIn(CBX, y, LBL_X - CBX + LBL_W, CB_SZ)) this.hoverDesc = desc;
        },

        // 語言選擇列：標籤 + 顯示目前語言的按鈕（點開下拉）
        _lang(y, label, idx, desc, onSelect) {
            const { CB_SZ, LBL_X, LBL_W, SEL_X, SEL_W } = this.C;
            this._left(() => DrawTextFit(label, LBL_X, this._rowMid(y), LBL_W, "Black"));
            DrawButton(SEL_X, y, SEL_W, CB_SZ, langNameNative[idx], "White", "", "");
            this._hit(SEL_X, y, SEL_W, CB_SZ, () => openMATLangSelect(this._anchor(SEL_X, y, SEL_W), onSelect));
            if (desc && MouseIn(LBL_X, y, SEL_X - LBL_X + SEL_W, CB_SZ)) this.hoverDesc = desc;
        },

        // 熱鍵列：啟用勾選框 + 標籤 + 綁定鈕（點擊錄製）+ 清除鈕
        _hotkey(y, label, actionName, desc) {
            const { CBX, CB_SZ, LBL_X, HK_KEY_X, HK_KEY_W, HK_CLR_X, HK_CLR_W } = this.C;
            const hk = config.hotkeys[actionName] || {};
            DrawCheckbox(CBX, y, CB_SZ, CB_SZ, "", !!hk.enabled);
            this._hit(CBX, y, CB_SZ, CB_SZ, () => { hk.enabled = !hk.enabled; config.hotkeys[actionName] = hk; saveSettings(); });
            this._left(() => DrawTextFit(label, LBL_X, this._rowMid(y), HK_KEY_X - LBL_X - 10, "Black"));
            const rec = hotkeyRecording && hotkeyRecordingTarget === actionName;
            DrawButton(HK_KEY_X, y, HK_KEY_W, CB_SZ, rec ? ui('hotkeyRecording') : hotkeyToString(hk), rec ? "#FFD700" : "White", "", ui('tipHotkeySet'));
            this._hit(HK_KEY_X, y, HK_KEY_W, CB_SZ, () => {
                if (hotkeyRecording && hotkeyRecordingTarget === actionName) { hotkeyRecording = false; hotkeyRecordingTarget = null; }
                else startHotkeyRecording(actionName);
            });
            DrawButton(HK_CLR_X, y, HK_CLR_W, CB_SZ, ui('btnHotkeyClear'), "White", "", "");
            this._hit(HK_CLR_X, y, HK_CLR_W, CB_SZ, () => { clearHotkey(actionName); });
            if (desc && MouseIn(CBX, y, HK_KEY_X - CBX - 10, CB_SZ)) this.hoverDesc = desc;
        },

        _tabLabels() { return [ui('tab_basic'), ui('tab_send'), ui('tab_recv'), ui('tab_other')]; },
        _tabDesc()   { return [ui('descBasic'), ui('descSend'), ui('descRecv'), ui('descOther')][this.tab - 1]; },

        run() {
            this.hoverDesc = '';
            this._hits = [];
            const { TAB_X, TAB_Y0, TAB_W, TAB_H, TAB_GAP, HELP_X, HELP_Y, HELP_W, HELP_H } = this.C;

            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", ui('btnBack'));
            DrawText(ui('pageTitle', { v: MOD_VER }), 1000, 110, "Black", "Gray");

            // 左側第 0 鍵：總開關（直接切換，顏色反映啟用狀態）
            DrawButton(TAB_X, TAB_Y0, TAB_W, TAB_H,
                       config.enabled ? ui('masterOn') : ui('masterOff'),
                       config.enabled ? "#2e7d32" : "#c62828", "", "");
            this._hit(TAB_X, TAB_Y0, TAB_W, TAB_H, () => {
                config.enabled = !config.enabled;
                if (config.enabled) startObserver(); else stopObserver();
                saveSettings();
            });
            if (MouseIn(TAB_X, TAB_Y0, TAB_W, TAB_H)) this.hoverDesc = ui('descMaster');

            // 左側其餘頁簽（基本 / 發送 / 接收 / 其他）
            this._tabLabels().forEach((lb, i) => {
                const idx = i + 1;
                const y = TAB_Y0 + idx * TAB_GAP;
                DrawButton(TAB_X, y, TAB_W, TAB_H, lb, this.tab === idx ? "#4CAF50" : "White", "", "");
                this._hit(TAB_X, y, TAB_W, TAB_H, () => { this.tab = idx; });
            });

            // 右側說明框
            DrawEmptyRect(HELP_X, HELP_Y, HELP_W, HELP_H, "#888");

            // 中間內容
            [this._runBasic, this._runSend, this._runRecv, this._runOther][this.tab - 1].call(this);

            // 說明文字（hover 優先，否則顯示分頁常駐說明）
            const desc = this.hoverDesc || this._tabDesc();
            if (desc) DrawTextWrap(desc, HELP_X + 25, HELP_Y + 20, HELP_W - 50, HELP_H - 40, "Black", undefined, 8);
        },

        _runBasic() {
            let y = this.C.ROW_Y0; const H = this.C.ROW_H;
            DrawText(ui('tab_basic'), 850, 200, "#2e7d32", "Gray");
            this._cb(y, ui('optRecv'), config.translateReceived, ui('dRecv'), () => { config.translateReceived = !config.translateReceived; saveSettings(); }); y += H;
            this._lang(y, ui('lblRecvLang'), uiRecvIdx, ui('dRecvLang'), code => { const i = langCodes.indexOf(code); if (i < 0) return; uiRecvIdx = i; config.recvLang = code; saveSettings(); }); y += H;
            this._cb(y, ui('optSend'), config.translateSent, ui('dSend'), () => { config.translateSent = !config.translateSent; saveSettings(); }); y += H;
            this._lang(y, ui('lblSendLang'), uiSendIdx, ui('dSendLang'), code => { const i = langCodes.indexOf(code); if (i < 0) return; uiSendIdx = i; config.sendLang = code; saveSettings(); }); y += H;
        },

        _runSend() {
            let y = this.C.ROW_Y0; const H = this.C.ROW_H;
            DrawText(ui('tab_send'), 850, 200, "#2e7d32", "Gray");
            const dis = !config.translateSent;
            this._cb(y, ui('optEmote'),   config.sendEmote,        ui('dEmote'),   () => { config.sendEmote = !config.sendEmote; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optAction'),  config.sendAction,       ui('dAction'),  () => { config.sendAction = !config.sendAction; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optWhisper'), config.sendWhisper,      ui('dWhisper'), () => { config.sendWhisper = !config.sendWhisper; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optBeep'),    config.sendBeep,         ui('dBeep'),    () => { config.sendBeep = !config.sendBeep; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optSkipZh'),  config.sendSkipZhVariant, ui('dSkipZh'), () => { config.sendSkipZhVariant = !config.sendSkipZhVariant; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optHideOrig'), config.sendHideOriginal, ui('dHideOrigSend'), () => { config.sendHideOriginal = !config.sendHideOriginal; saveSettings(); }, dis); y += H;
        },

        _runRecv() {
            let y = this.C.ROW_Y0; const H = this.C.ROW_H;
            DrawText(ui('tab_recv'), 850, 200, "#2e7d32", "Gray");
            const dis = !config.translateReceived;
            this._cb(y, ui('optEmote'),   config.recvEmote,        ui('dEmote'),   () => { config.recvEmote = !config.recvEmote; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optAction'),  config.recvAction,       ui('dAction'),  () => { config.recvAction = !config.recvAction; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optWhisper'), config.recvWhisper,      ui('dWhisper'), () => { config.recvWhisper = !config.recvWhisper; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optBeep'),    config.recvBeep,         ui('dBeep'),    () => { config.recvBeep = !config.recvBeep; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optLocal'),   config.recvLocal,        ui('dLocal'),   () => { config.recvLocal = !config.recvLocal; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optSkipZh'),  config.recvSkipZhVariant, ui('dSkipZh'), () => { config.recvSkipZhVariant = !config.recvSkipZhVariant; saveSettings(); }, dis); y += H;
            this._cb(y, ui('optHideOrig'), config.recvHideOriginal, ui('dHideOrigRecv'), () => { config.recvHideOriginal = !config.recvHideOriginal; saveSettings(); }, dis); y += H;
        },

        _runOther() {
            let y = 240; const H = 70;
            DrawText(ui('tab_other'), 850, 200, "#2e7d32", "Gray");
            this._cb(y, ui('optLoginNotice'), config.loginNotice,        ui('dLoginNotice'), () => { config.loginNotice = !config.loginNotice; saveSettings(); }); y += H;
            this._cb(y, ui('optManual'),      config.translateChat,      ui('dManual'),      () => { config.translateChat = !config.translateChat; if (!config.translateChat) hideClickToolbar(); saveSettings(); }); y += H;
            this._cb(y, ui('optSelection'),   config.translateSelection, ui('dSelection'),   () => { config.translateSelection = !config.translateSelection; if (!config.translateSelection) hideSelectionPopup(); saveSettings(); }); y += H;
            this._cb(y, ui('optChatScrollFreeze'), config.chatScrollFreeze, ui('dChatScrollFreeze'), () => { config.chatScrollFreeze = !config.chatScrollFreeze; saveSettings(); applyChatScrollFreezeConfig(); }); y += H;
            this._cb(y, ui('optSkipStutter'), config.skipStutter,        ui('dSkipStutter'), () => { config.skipStutter = !config.skipStutter; saveSettings(); }); y += H;
            this._cb(y, ui('optChatButton'),  config.chatButton,         ui('dChatButton'),  () => { config.chatButton = !config.chatButton; saveSettings(); updateChatButton(); }); y += H;
            this._hotkey(y, ui('hkToggle'), 'toggle', ui('dHkToggle')); y += H;
            this._hotkey(y, ui('hkRecv'),   'recv',   ui('dHkRecv'));   y += H;
            this._hotkey(y, ui('hkSend'),   'send',   ui('dHkSend'));   y += H;
        },

        click() {
            if (MouseIn(1815, 75, 90, 90)) { if (typeof PreferenceExit === "function") PreferenceExit(); return; }
            for (const h of this._hits) { if (MouseIn(h.x, h.y, h.w, h.h)) { h.onClick(); return; } }
        },
        unload() { hotkeyRecording = false; hotkeyRecordingTarget = null; },
        exit()   { hotkeyRecording = false; hotkeyRecordingTarget = null; }
    };

    // ============================================================
    // 房間事件
    // ============================================================
    function hookRoomEvents() {
        if (!modApi) return;
        modApi.hookFunction("ChatRoomLeave", 4, (args, next) => {
            stopObserver(); hideClickToolbar();
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
                const { translated, error } = await translateChunked(lines[i], targetLang);
                if (abortToken.cancelled) break;
                if (error || translated === null) {
                    apiErrorNotifier.notify(error || '');
                    resultLines[i] = lines[i];
                } else {
                    resultLines[i] = translated;
                }
            } catch (e) {
                resultLines[i] = lines[i];
            }
            if (!abortToken.cancelled) updateBioTranslationDisplay(resultLines.join('\n'));
        }
        return resultLines.join('\n');
    }

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
        //bio翻譯UI設定
        div.style.cssText = 'overflow-x:hidden;overflow-wrap:break-word;white-space:pre-wrap;background:rgb(187,196,255);color:rgb(27,45,27);border:2px solid #4CAF50;padding:2px;position:fixed;z-index:999;font-family:Arial,sans-serif;display:flex;flex-direction:column;';
        if (ref) {
            const cs = window.getComputedStyle(ref);
            div.style.fontSize = cs.fontSize;
            div.style.left  = ref.style.left  || cs.left;
            div.style.top   = ref.style.top   || cs.top;
            div.style.width = ref.style.width || cs.width;
            div.style.height= ref.style.height|| cs.height;
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
            if (bioAbortToken === token) bioTranslating = false;
        }
    }

    function hookOnlineProfile() {
        if (!modApi) return;
        try {
            modApi.hookFunction("OnlineProfileRun", 4, (args, next) => {
                const result = next(args);
                const isOpen = !!document.getElementById(BIO_TRANS_ID);
                if (bioTranslating) {
                    DrawButton(1415, 60, 90, 90, "", "#FFD700", "Icons/Cancel.png", ui('bioCancelTranslate'));
                } else if (isOpen) {
                    DrawButton(1415, 60, 90, 90, "", "White", "Icons/Cancel.png", ui('bioClose'));
                } else {
                    DrawButton(1415, 60, 90, 90, "", "White", "Icons/Chat.png", ui('bioTranslate'));
                }
                return result;
            });
            modApi.hookFunction("OnlineProfileLoad", 4, (args, next) => {
                try {
                    const target = typeof InspectCharacter !== "undefined" ? InspectCharacter
                    : typeof CurrentCharacter !== "undefined" ? CurrentCharacter : null;
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

    // ============================================================
    // 指令
    // ============================================================
    function registerCommands() {
        CommandCombine([{
            Tag: "mat",
            Description: "Machine Translation settings (/mat help)",
            Action: function(text) {
                const args = text.split(" ");
                const cmd = args[0]?.toLowerCase();
                switch(cmd) {
                    case "": case "help":   ChatRoomSendLocal(ui('help', { v: MOD_VER })); break;
                    case "on":              config.enabled = true;  startObserver(); saveSettings(); ChatRoomSendLocal(ui('cmdOn'));  break;
                    case "off":             config.enabled = false; stopObserver();  saveSettings(); ChatRoomSendLocal(ui('cmdOff')); break;
                    case "send":            config.translateSent = !config.translateSent; saveSettings(); ChatRoomSendLocal(ui('cmdSend', { v: mk(config.translateSent) })); break;
                    case "chat":            config.translateChat = !config.translateChat; if (!config.translateChat) hideClickToolbar(); saveSettings(); ChatRoomSendLocal(ui('cmdChat', { v: mk(config.translateChat) })); break;
                    case "setting": case "settings": openSettingsScreen(); break;
                    default:                ChatRoomSendLocal(ui('cmdUnknown'));
                }
            }
        }]);
    }

    // 登入通知：ChatRoomSendLocal 只在房間內有效，故等進入 ChatRoom 後延遲 1 秒顯示一次（仿 HSC）
    function notifyLoginOnce() {
        let done = false;
        const timer = setInterval(() => {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
            clearInterval(timer);
            if (done) return;
            done = true;
            setTimeout(() => { if (config.loginNotice) ChatRoomSendLocal(ui('loginNotice', { v: MOD_VER })); }, 1000);
        }, 500);
    }

    // /mat settings：直接開啟拓展設定內的 MAT 子頁
    function openSettingsScreen() {
        if (typeof PreferenceSubscreenExtensionsOpen !== 'function') return;
        PreferenceSubscreenExtensionsOpen("Liko_MAT_Settings");
    }

    // ============================================================
    // 聊天室快捷按鈕（#chat-room-buttons）
    // 點擊向上展開小選單：總開關 / 發送 / 接收 / 前往設定。
    // ============================================================
    // 共用系統擴充載入器：先判斷是否存在，不存在才上網抓。不再自帶精簡版（避免多處維護）。
    // 通常經 PCM 路徑早已載好，這裡是罕見的獨立安裝 fallback；抓來的檔案自身都有防重複載入守衛。
    const _EXPAND_BASES = (typeof window !== 'undefined' && window.LikoDevBase)
        ? [window.LikoDevBase]
        : [
            'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/',
            'https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/',
            'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/',
        ];
    const _expandDepPromises = {};
    function ensureExpandDep(rel, ready) {
        if (ready && ready()) return Promise.resolve();
        if (_expandDepPromises[rel]) return _expandDepPromises[rel];
        _expandDepPromises[rel] = (async () => {
            let lastErr;
            for (const base of _EXPAND_BASES) {
                try {
                    const res = await fetch(base + rel, { cache: 'no-store' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const text = await res.text();
                    if (!text || text.trimStart().startsWith('<')) throw new Error('bad content');
                    const s = document.createElement('script');
                    s.textContent = text + '\n//# sourceURL=' + rel;
                    document.head.appendChild(s);
                    return;
                } catch (e) { lastErr = e; console.warn('🐈‍⬛ [MAT] ⚠️ ' + base + rel + ': ' + e.message); }
            }
            throw lastErr ?? new Error('all bases failed: ' + rel);
        })();
        return _expandDepPromises[rel];
    }

    // 共用按鈕順序協調器：儘早開始載入（能力偵測 ?.add）。按鈕規格由 setupChatButton 同步登記，
    // 不綁在此處的載入 promise 上——協調器早晚/被誰載入都會把已登記的按鈕建/補回。
    ensureExpandDep('expand/BC_ChatRoomButtons.js', () => window.Liko.__Sys_ChatRoomButtons__?.add)
        .catch(e => console.warn('🐈‍⬛ [MAT] ⚠️ ChatRoomButtons 載入失敗，按鈕無法加入:', e.message));

    // 聊天室凍結/捲動協調器：讓「使用者往上看歷史時不要被捲走」由這個共用系統統一決定，
    // MAT 不再自帶捲動手段去跟別人搶（見下方 chatWasAtEnd / scrollChatToEndIfWasAtEnd：凍結中一律不捲）。
    //
    // 這個開關只決定「MAT 要不要主動載入」，不決定「要不要移除」。BC_ChatScrollFreeze 是多個 Liko
    // 插件（MAT / LCE …）共用的同一支系統擴充，載入與否是「任一方要就載」的 OR 關係，去重靠模組
    // 本體開頭的 `if (window.Liko.__Sys_ChatScrollFreeze__) return;` 守衛。
    // 【勿再於 else 分支 teardown()／delete 全域】：那會在「自己沒開、但別的插件開著」時，把人家
    //   已載入的實體一起砍掉（實測過的反例：MAT 沒開、LCE 有開，卻被 MAT 的 else 分支 teardown 掉，
    //   結果整個沒載入）。停用只代表 MAT 這次不主動載，已載入的維持載入（要移除得重整頁面）。
    const CSF_REL = 'expand/BC_ChatScrollFreeze.js';
    function applyChatScrollFreezeConfig() {
        if (!config.chatScrollFreeze) return;   // 不主動載入；但不動別人已載入的實體
        ensureExpandDep(CSF_REL, () => window.Liko.__Sys_ChatScrollFreeze__)
            .catch(e => console.warn('🐈‍⬛ [MAT] ⚠️ ChatScrollFreeze 載入失敗:', e.message));
    }

    const MAT_BTN_ID = 'lk-mat-trigger-btn';
    const MAT_MENU_ID = 'lk-mat-quick-menu';

    // 快速選單開合動畫：向上展開／向下收回，速度與 easing 對齊 BC_ChatRoomButtons 的按鈕動畫。
    const MAT_MENU_SLIDE_PX = 10;
    const MAT_MENU_REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MAT_MENU_ANIM_MS = MAT_MENU_REDUCE_MOTION ? 0 : 200;

    function matQuickToggle(kind) {
        if (kind === 'master') {
            config.enabled = !config.enabled;
            if (config.enabled) startObserver(); else stopObserver();
            ChatRoomSendLocal(config.enabled ? ui('cmdOn') : ui('cmdOff'));
        } else if (kind === 'send') {
            config.translateSent = !config.translateSent;
            ChatRoomSendLocal(config.translateSent ? ui('hkSendOn') : ui('hkSendOff'));
        } else if (kind === 'recv') {
            config.translateReceived = !config.translateReceived;
            ChatRoomSendLocal(config.translateReceived ? ui('hkRecvOn') : ui('hkRecvOff'));
        }
        saveSettings();
        refreshMatQuickMenu();
    }

    function refreshMatQuickMenu() {
        const menu = document.getElementById(MAT_MENU_ID);
        if (!menu) return;
        const paint = (cls, on) => {
            const b = menu.querySelector('.' + cls);
            if (b) b.style.background = on ? 'rgba(76,175,80,0.9)' : 'rgba(60,60,80,0.85)';
        };
        paint('lk-mat-q-master', config.enabled);
        paint('lk-mat-q-send', config.translateSent);
        paint('lk-mat-q-recv', config.translateReceived);
        // 發送/接收鈕末端補上「當前目標語言」國旗，一眼看出設定（國旗字體見選單 cssText）。
        const setLabel = (cls, base, code) => {
            const b = menu.querySelector('.' + cls);
            if (!b) return;
            const f = flagOf(code);
            b.textContent = f ? `${base} ${f}` : base;
        };
        setLabel('lk-mat-q-send', ui('cbtnSend'), config.sendLang);
        setLabel('lk-mat-q-recv', ui('cbtnRecv'), config.recvLang);
    }

    function buildMatQuickMenu() {
        let menu = document.getElementById(MAT_MENU_ID);
        if (menu) return menu;
        menu = document.createElement('div');
        menu.id = MAT_MENU_ID;
        menu.style.cssText = 'position:fixed;z-index:100000;display:none;flex-direction:column;gap:4px;background:#1a1a2e;border:1px solid #4CAF50;border-radius:8px;padding:6px;box-shadow:0 4px 16px rgba(0,0,0,0.5);min-width:132px;' +
            // 國旗字體：按鈕 all:unset 會讓 font-family 繼承此選單，白嫖 BC 的 "Twemoji Country Flags"。
            'font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;' +
            'opacity:0;transform:translateY(' + MAT_MENU_SLIDE_PX + 'px);pointer-events:none;' +
            'transition:opacity ' + MAT_MENU_ANIM_MS + 'ms ease,transform ' + MAT_MENU_ANIM_MS + 'ms ease;';
        const mkBtn = (cls, label, kind) => {
            const b = document.createElement('button');
            b.className = cls;
            b.textContent = label;
            b.style.cssText = 'all:unset;box-sizing:border-box;width:100%;cursor:pointer;color:#fff;font-size:13px;text-align:center;padding:6px 10px;border-radius:5px;background:rgba(60,60,80,0.85);white-space:nowrap;';
            b.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (kind) matQuickToggle(kind);
                else { hideMatQuickMenu(); openSettingsScreen(); }
            });
            return b;
        };
        menu.appendChild(mkBtn('lk-mat-q-master',   ui('cbtnMaster'),   'master'));
        menu.appendChild(mkBtn('lk-mat-q-send',     ui('cbtnSend'),     'send'));
        menu.appendChild(mkBtn('lk-mat-q-recv',     ui('cbtnRecv'),     'recv'));
        menu.appendChild(mkBtn('lk-mat-q-settings', ui('cbtnSettings'), null));
        document.body.appendChild(menu);
        return menu;
    }

    function positionMatQuickMenu(menu) {
        // opacity:0 期間量測不會有任何閃現，不必再靠移出畫面外那招
        const btn = document.getElementById(MAT_BTN_ID);
        const r = btn ? btn.getBoundingClientRect() : { left: 100, top: 100, right: 140, bottom: 140, width: 40, height: 40 };
        const mw = menu.offsetWidth, mh = menu.offsetHeight;
        let left = r.left + r.width / 2 - mw / 2;
        left = Math.max(4, Math.min(left, window.innerWidth - mw - 4));
        let top = r.top - mh - 6;
        if (top < 4) top = r.bottom + 6;
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    function toggleMatQuickMenu() {
        const menu = buildMatQuickMenu();
        if (menu.dataset.open === '1') { hideMatQuickMenu(); return; }
        clearTimeout(menu._lkHideTimer);
        refreshMatQuickMenu();
        menu.dataset.open = '1';
        menu.style.display = 'flex'; // 此時 opacity 仍是初始的 0，量測/定位不會被使用者看到
        positionMatQuickMenu(menu);
        // 定位完成後才在下一影格淡入＋從按鈕位置往上滑到定位，呼應「向上展開」的方向
        requestAnimationFrame(() => {
            menu.style.opacity = '1';
            menu.style.transform = 'translateY(0)';
            menu.style.pointerEvents = 'auto';
        });
    }

    function hideMatQuickMenu() {
        const menu = document.getElementById(MAT_MENU_ID);
        if (!menu || menu.dataset.open !== '1') return;
        menu.dataset.open = '0';
        menu.style.opacity = '0';
        menu.style.transform = 'translateY(' + MAT_MENU_SLIDE_PX + 'px)'; // 向下收回，回到按鈕的方向
        menu.style.pointerEvents = 'none';
        clearTimeout(menu._lkHideTimer);
        menu._lkHideTimer = setTimeout(() => { menu.style.display = 'none'; }, MAT_MENU_ANIM_MS + 30);
    }

    document.addEventListener('mousedown', (e) => {
        const menu = document.getElementById(MAT_MENU_ID);
        if (!menu || menu.dataset.open !== '1') return;
        if (menu.contains(e.target)) return;
        if (e.target.closest && e.target.closest('#' + MAT_BTN_ID)) return;
        hideMatQuickMenu();
    });

    // 圖示用 CSS mask 上色（白色勾勒在綠底上），不受 SVG 自身 #000 填色與深色主題影響——
    // 與 Kaomoji 同一手法，已驗證可在 BC 環境正常顯示（避免黑圖貼在深色按鈕上看不見）。
    function injectMatStyles() {
        if (document.getElementById('lk-mat-style')) return;
        const maskUrl = `url("${MAT_ICON_URI}")`;
        const style = document.createElement('style');
        style.id = 'lk-mat-style';
        style.textContent = [
            '#' + MAT_BTN_ID + '.chat-room-button{',
            '  background-color:rgba(76,175,80,0.9) !important;',
            '  border-radius:12px !important;',
            '  position:relative !important;',
            '  overflow:hidden !important;',
            '}',
            '#' + MAT_BTN_ID + '.chat-room-button::before{',
            '  content:"" !important;',
            '  position:absolute !important;',
            '  top:0 !important; left:0 !important;',
            '  width:100% !important; height:100% !important;',
            '  background-color:#ffffff !important;',
            '  mask-position:center center !important;',
            '  mask-size:62% 62% !important;',
            '  mask-repeat:no-repeat !important;',
            '  -webkit-mask-position:center center !important;',
            '  -webkit-mask-size:62% 62% !important;',
            '  -webkit-mask-repeat:no-repeat !important;',
            '  mask-image:' + maskUrl + ' !important;',
            '  -webkit-mask-image:' + maskUrl + ' !important;',
            '}',
            '#' + MAT_BTN_ID + '.chat-room-button:hover{',
            '  background-color:rgba(102,187,106,0.95) !important;',
            '}',
        ].join('\n');
        document.head.appendChild(style);
    }

    // 工廠函式：協調器每次(重)建都會呼叫、回傳全新按鈕（自帶樣式注入；圖示由 ::before mask 繪製）。
    function createMatButton() {
        injectMatStyles();
        const btn = document.createElement('button');
        btn.id = MAT_BTN_ID;
        btn.type = 'button';
        btn.className = 'blank-button button HideOnPopup chat-room-button';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('aria-label', ui('prefButton'));
        btn.title = ui('prefButton');
        // 圖示由 injectMatStyles 的 ::before mask 繪製，這裡不放 <img>
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleMatQuickMenu(); });
        return btn;
    }
    // 交給協調器中央託管；MAT 用自帶 ::before mask 當圖示，故不需 plain。
    // config.chatButton 切換：開 → 登記(直接 add 或推進待處理佇列)；關 → remove 並清掉佇列殘留。
    function applyChatButton() {
        const L = window.Liko;
        const crb = L.__Sys_ChatRoomButtons__;
        if (config.chatButton) {
            const spec = ["mat", sys_CRB, createMatButton, {}];
            if (crb?.add) crb.add(...spec);
            else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);
        } else {
            crb?.remove?.("mat");
            const q = L.__CRB_pending__;
            if (Array.isArray(q)) { const i = q.findIndex(s => s && s[0] === "mat"); if (i >= 0) q.splice(i, 1); }
            hideMatQuickMenu();
        }
    }

    // 設定頁切換 chatButton 時呼叫。
    function updateChatButton() { applyChatButton(); }

    function setupChatButton() {
        // 同步登記按鈕規格（不綁在載入 promise 上）；容器建立/重建、收合同步、順位皆由協調器統一處理。
        applyChatButton();
    }

    // ============================================================
    // 統一遊戲等待入口
    // 條件：Player 已登入 + CommandCombine + TranslationLanguage + PreferenceRegisterExtensionSetting
    // ============================================================
    function waitForSettings(callback, retries = 30) {
        if (Player?.ExtensionSettings !== undefined) callback();
        else if (retries > 0) setTimeout(() => waitForSettings(callback, retries - 1), 500);
        else { console.warn("🐈‍⬛ [MAT] ❌ ExtensionSettings timeout, forcing init"); callback(); }
    }

    function waitForGame() {
        const gameReady =
              typeof Player?.MemberNumber === "number" &&
              typeof CommandCombine === "function" &&
              typeof TranslationLanguage !== "undefined" &&
              typeof PreferenceRegisterExtensionSetting === "function";

        if (gameReady) {
            initializeConfig();
            waitForSettings(() => {
                migrateSettingsKey();
                loadSettings();

                // 先確保 i18n 就緒，再註冊 UI 與指令（載入失敗則以 key 原文 fallback）
                ensureI18n()
                    .catch(e => console.warn("🐈‍⬛ [MAT] ❌ i18n loading failed; displaying instead by key.", e))
                    .finally(() => {
                    PreferenceRegisterExtensionSetting({
                        Identifier: "Liko_MAT_Settings",
                        ButtonText: ui('prefButton'),
                        Image: MAT_ICON_URI,
                        load:   () => matSettingsScreen.load(),
                        run:    () => matSettingsScreen.run(),
                        click:  () => matSettingsScreen.click(),
                        unload: () => matSettingsScreen.unload(),
                        exit:   () => matSettingsScreen.exit()
                    });

                    registerCommands();
                    hookSendFunctions();
                    hookReceiveFlag();
                    hookRoomEvents();
                    hookOnlineProfile();
                    setupSelectionListener();
                    setupClickTranslateListener();
                    setupHotkeyListener();
                    setupChatButton();
                    applyChatScrollFreezeConfig();
                    notifyLoginOnce();
                    if (config.enabled) startObserver();
                });
            });
        } else {
            setTimeout(waitForGame, 500);
        }
    }
    console.log(`🐈‍⬛ [MAT] ✅ v${MOD_VER} loaded`)
})();