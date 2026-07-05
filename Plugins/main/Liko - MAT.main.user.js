// ==UserScript==
// @name         Liko - MAT
// @name:zh      Liko的自動翻譯(使用Google api)
// @namespace    https://likolisu.dev/
// @version      1.5.0
// @description  Automatically translate BC chat messages using Google API.
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.5.0";
    if (window.Liko.MAT) return;
    window.Liko.MAT = MOD_VER;

    let modApi;
    let observer = null;

    // 預設熱鍵；用工廠回傳新物件，避免多處共用同一參考被意外改到
    function makeDefaultHotkeys() {
        return { toggle: { key: 'KeyM', modifiers: ['Ctrl'] } };
    }

    let config = {
        enabled: true,
        sendLang: 'en',
        recvLang: null, // 預設依瀏覽器語言決定，見 initializeConfig / detectDefaultRecvLang
        translateReceived: true,
        translateSent: false,
        translateSelection: true,
        translateChat: true,
        autoScroll: true,
        skipStutter: true,
        hotkeys: makeDefaultHotkeys()
    };

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
        if (typeof window.Liko?.i18n?.ensure !== 'function') await loadScript(LIKO_I18N_ENGINE_URL);
        if (typeof window.Liko?.i18n?.ensure === 'function') await window.Liko.i18n.ensure(I18N_NS, LIKO_MAT_STRINGS_URL);
    }

    // 取翻譯字串；引擎尚未就緒時回傳 key 本身，不丟例外。vars 以 {name} 佔位代入。
    function ui(key, vars) {
        const fn = window.Liko?.i18n?.t;
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
                repository: "Auto translate chat messages(Supports bio translation)",
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
        const defaults = {
            enabled: true,
            sendLang: 'en',
            recvLang: detectDefaultRecvLang(),
            translateReceived: true,
            translateSent: false,
            translateSelection: true,
            translateChat: true,
            autoScroll: true,
            skipStutter: true,
            hotkeys: makeDefaultHotkeys()
        };
        if (!config || typeof config !== 'object') config = { ...defaults };
        for (const [key, val] of Object.entries(defaults)) {
            if (config[key] === undefined || config[key] === null) config[key] = val;
        }
        if (!config.hotkeys || typeof config.hotkeys !== 'object') config.hotkeys = makeDefaultHotkeys();
        if (!config.hotkeys.toggle) config.hotkeys.toggle = makeDefaultHotkeys().toggle;
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
        if (!config.hotkeys || typeof config.hotkeys !== 'object') {
            config.hotkeys = makeDefaultHotkeys();
        }
        if (!config.hotkeys.toggle) {
            config.hotkeys.toggle = makeDefaultHotkeys().toggle;
        }
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

    async function translateGoogle(text, target, attempt = 0) {
        const MAX_RETRY = 2;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const resp = await fetch(url);

            if (resp.status === 429) throw new Error('rate_limit');
            if (resp.status === 403) throw new Error('blocked');
            if (!resp.ok) throw new Error(`http_${resp.status}`);

            const data = await resp.json();
            const translated = data[0]?.map(seg => seg?.[0] || '').join('') || text;
            return { translated, detectedLang: data[2] || null };
        } catch (e) {
            // fetch 本身失敗（網路斷線、timeout）會是 TypeError
            const isNetwork = e instanceof TypeError;
            const reason = isNetwork ? 'network' : (e.message || 'unknown');
            // 5xx 伺服器錯誤與網路中斷屬暫時性，退避後重試（600ms、1200ms）
            const transient = isNetwork || /^http_5\d\d$/.test(reason);
            if (transient && attempt < MAX_RETRY) {
                await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
                return translateGoogle(text, target, attempt + 1);
            }
            return { translated: null, detectedLang: null, error: reason };
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

    // 取 Action 訊息真正要翻的文字：最後一個有 Text 的 entry。
    // form1（CUSTOM_SYSTEM_ACTION，文字在 dict[0]）與 form2（Beep 鏈代換，文字在最後一個）通吃，
    // 並自動略過無 Text 的 LikoMAT 旗標 entry。
    function lastDictText(data) {
        if (!Array.isArray(data.Dictionary)) return null;
        for (let i = data.Dictionary.length - 1; i >= 0; i--) {
            const e = data.Dictionary[i];
            if (e && typeof e.Text === 'string') return e.Text;
        }
        return null;
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

    // 自動翻譯的統一跳過判斷：送出端據此決定要不要夾旗標、接收端據此跳過——兩邊必須一致，
    // 否則「不該翻的句子」被夾了旗標，接收端會空等 1 秒造成爆量塞車。
    function isUntranslatable(text) {
        if (!text) return true;
        if (text.includes('BCX_') || /^[\d\s:]+$/.test(text) ||
            text.includes(TRANSLATE_MARKER) || text.includes('[🌐]') ||
            text.includes('🔊') || text.includes('📞')) return true;
        if (isPureUrl(text)) return true;
        if (!/\p{L}/u.test(text)) return true;   // 純顏文字/符號/emoji
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

    function scrollChatToBottom() {
        if (!config.autoScroll) return;
        const log = document.querySelector('#TextAreaChatLog');
        if (!log) return;
        const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 150;
        if (nearBottom) setTimeout(() => { log.scrollTop = log.scrollHeight; }, 60);
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
            if (translated !== null && translated !== msg) createTranslatedDiv(node, translated);
            return;
        }

        node.classList.add("mat-processed");
        const message = extractCleanMessage(node);
        if (!message) return;
        // 對方已標記要翻成我的語言（mat-skip）：先等其 [🌐] 廣播，最多 1 秒；沒到（對方翻譯失敗）才自翻
        if (node.classList.contains('mat-skip') && await waitForRemoteTranslation(node)) return;
        const translated = await smartTranslate(message, config.recvLang);
        if (translated !== null && translated !== message) createTranslatedDiv(node, translated);
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
        originalNode.parentNode.insertBefore(div, originalNode.nextSibling);
        scrollChatToBottom();
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

        modApi.hookFunction("ServerSend", 10, (args, next) => {
            const [command, data] = args;
            if (!config.enabled || !config.translateSent) return next(args);
            const safeStr = (v) => typeof v === 'string' ? v : null;

            // 夾意圖旗標到原句：只夾「會被翻譯廣播」的句子；顏文字/編碼/[🌐] 不夾，免接收端空等 1 秒
            if (command === "ChatRoomChat" && MAT_FLAG_TYPES.includes(data.Type)) {
                const ot = data.Type === "Action" ? lastDictText(data) : safeStr(data.Content);
                if (ot && !isUntranslatable(ot)) addMATFlag(data);
            }

            if (command === "ChatRoomChat" && data.Type === "Chat") {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== null && r !== t) ServerSend("ChatRoomChat", { Content: `[🌐] ${r}`, Type: "Chat" });
                    });
                    return;
                }
            }
            if (command === "ChatRoomChat" && data.Type === "Action") {
                const t = lastDictText(data);
                if (t && !t.includes('[🌐]')) {
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
            if (command === "ChatRoomChat" && data.Type === "Whisper") {
                const t = safeStr(data.Content);
                if (t && !t.includes('[🌐]')) {
                    next(args);
                    smartTranslate(t, config.sendLang).then(r => {
                        if (r !== null && r !== t) ServerSend("ChatRoomChat", { Content: `[🌐] ${r}`, Type: "Whisper", Target: data.Target, Sender: data.Sender });
                    });
                    return;
                }
            }
            if (command === "AccountBeep") {
                const t = safeStr(data.Message);
                if (t && !t.includes('[🌐]') && (!data.BeepType || data.BeepType === '') && isUserMessage(t) && !t.trim().startsWith('{')) {
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
            if (!config.enabled || !config.translateSent) return next(args);
            const [t] = args;
            if (t && !t.includes('[🌐]')) {
                next(args);
                smartTranslate(t, config.sendLang).then(r => {
                    if (r !== null && r !== t) ChatRoomSendEmote(`[🌐] ${r}`);
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
                if (lang && lang === config.recvLang) {
                    findFlaggedNode(data)?.classList.add('mat-skip');
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

    function setupHotkeyListener() {
        document.addEventListener('keydown', (e) => {
            if (e.isComposing || e.keyCode === 229) return;
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
                ChatRoomSendLocal(config.enabled
                                  ? ui('hotkeyEnabled', { hk: hotkeyToString(hk) })
                                  : ui('hotkeyDisabled', { hk: hotkeyToString(hk) }));
                if (config.enabled) startObserver(); else stopObserver();
                saveSettings();
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
    // 版面座標：run() 繪製與 click() 命中判定共用同一份，避免兩邊各寫一份不同步
    const MAT_LAYOUT = {
        L_CB: 400, L_TXT: 484, L_TXTW: 500,
        R_LBL: 1050, R_LBLW: 220, R_BTN: 1290, BTN_W: 280, CB_SZ: 64,
        secY: 185, enabledY: 225, recvY: 305, sendY: 385,
        chatY: 465, selectionY: 545, autoScrollY: 625, skipStutterY: 705,
        RLANG_RECV_Y: 225, RLANG_SEND_Y: 305,
        HK_SEC_Y: 410, HK_ROW1_Y: 450,
        HK_BTN_X: 1290, HK_BTN_W: 200, HK_CLR_X: 1500, HK_CLR_W: 70,
    };

    const matSettingsScreen = {
        load() {
            uiSendIdx = Math.max(0, langCodes.indexOf(config.sendLang));
            uiRecvIdx = Math.max(0, langCodes.indexOf(config.recvLang));
        },
        run() {
            const names = langNameNative;

            const {
                L_CB, L_TXT, L_TXTW, R_LBL, R_LBLW, R_BTN, BTN_W, CB_SZ,
                secY, enabledY, recvY, sendY, chatY, selectionY, autoScrollY, skipStutterY,
                RLANG_RECV_Y, RLANG_SEND_Y, HK_SEC_Y, HK_ROW1_Y,
                HK_BTN_X, HK_BTN_W, HK_CLR_X, HK_CLR_W,
            } = MAT_LAYOUT;

            const withLeft = (fn) => {
                const prev = MainCanvas.textAlign;
                MainCanvas.textAlign = "left";
                try { fn(); } finally { MainCanvas.textAlign = prev; }
            };

            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", ui('btnBack'));
            DrawText(ui('pageTitle', { v: MOD_VER }), 1000, 105, "Black", "Gray");
            DrawText(ui('secLive'), 630,  secY, "#2e7d32", "Gray");
            DrawText(ui('secLang'), 1300, secY, "#2e7d32", "Gray");

            DrawCheckbox(L_CB, enabledY,    CB_SZ, CB_SZ, "", config.enabled);
            DrawCheckbox(L_CB, recvY,       CB_SZ, CB_SZ, "", config.translateReceived,  !config.enabled);
            DrawCheckbox(L_CB, sendY,       CB_SZ, CB_SZ, "", config.translateSent,      !config.enabled);
            DrawCheckbox(L_CB, chatY,       CB_SZ, CB_SZ, "", config.translateChat,      !config.enabled);
            DrawCheckbox(L_CB, selectionY,  CB_SZ, CB_SZ, "", config.translateSelection);
            DrawCheckbox(L_CB, autoScrollY, CB_SZ, CB_SZ, "", config.autoScroll);
            DrawCheckbox(L_CB, skipStutterY, CB_SZ, CB_SZ, "", config.skipStutter);

            withLeft(() => {
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(ui('optEnabled'),    L_TXT, rowMid(enabledY),    L_TXTW, "Black");
                DrawTextFit(ui('optRecv'),       L_TXT, rowMid(recvY),       L_TXTW, config.enabled ? "Black" : "Gray");
                DrawTextFit(ui('optSend'),       L_TXT, rowMid(sendY),       L_TXTW, config.enabled ? "Black" : "Gray");
                DrawTextFit(ui('optChat'),       L_TXT, rowMid(chatY),       L_TXTW, config.enabled ? "Black" : "Gray");
                DrawTextFit(ui('optSelection'),  L_TXT, rowMid(selectionY),  L_TXTW, "Black");
                DrawTextFit(ui('optAutoScroll'), L_TXT, rowMid(autoScrollY), L_TXTW, "Black");
                DrawTextFit(ui('optSkipStutter'), L_TXT, rowMid(skipStutterY), L_TXTW, "Black");
            });

            withLeft(() => {
                const rowMid = (y) => y + CB_SZ / 2 + 9;
                DrawTextFit(ui('lblRecvLang'), R_LBL, rowMid(RLANG_RECV_Y), R_LBLW, "Black");
                DrawTextFit(ui('lblSendLang'), R_LBL, rowMid(RLANG_SEND_Y), R_LBLW, "Black");
            });
            DrawButton(R_BTN, RLANG_RECV_Y, BTN_W, CB_SZ, names[uiRecvIdx], "White", "", ui('tipRecvLang'));
            DrawButton(R_BTN, RLANG_SEND_Y, BTN_W, CB_SZ, names[uiSendIdx], "White", "", ui('tipSendLang'));

            DrawText(ui('secHotkey'), 1300, HK_SEC_Y, "#2e7d32", "Gray");
            withLeft(() => {
                DrawTextFit(ui('lblHotkeyToggle'), R_LBL, HK_ROW1_Y + CB_SZ / 2 + 9, R_LBLW, "Black");
            });

            const isRecording = hotkeyRecording && hotkeyRecordingTarget === 'toggle';
            DrawButton(HK_BTN_X, HK_ROW1_Y, HK_BTN_W, CB_SZ,
                       isRecording ? ui('hotkeyRecording') : hotkeyToString(config.hotkeys.toggle),
                       isRecording ? "#FFD700" : "White", "", ui('tipHotkeySet'));
            DrawButton(HK_CLR_X, HK_ROW1_Y, HK_CLR_W, CB_SZ, ui('btnHotkeyClear'), "White", "", ui('btnHotkeyClear'));

            DrawRect(395, 795, 1180, 2, "rgba(0,0,0,0.15)");
            DrawText(ui('desc1'), 1000, 825, "Gray", "Silver");
            DrawText(ui('desc2'), 1000, 880, "Gray", "Silver");
            DrawText(ui('desc3'), 1000, 935, "Gray", "Silver");
        },
        click() {
            if (MouseIn(1815, 75, 90, 90)) { if (typeof PreferenceExit === "function") PreferenceExit(); return; }

            const {
                L_CB, CB_SZ, R_BTN, BTN_W,
                enabledY, recvY, sendY, chatY, selectionY, autoScrollY, skipStutterY,
                RLANG_RECV_Y, RLANG_SEND_Y,
                HK_ROW1_Y, HK_BTN_X, HK_BTN_W, HK_CLR_X, HK_CLR_W,
            } = MAT_LAYOUT;

            const makeFakeAnchor = (btnX, btnY) => ({ getBoundingClientRect: () => {
                const canvas = document.querySelector('canvas');
                const rect = canvas ? canvas.getBoundingClientRect() : {left:0,top:0,width:2000,height:1000};
                return {
                    left:  rect.left + btnX * (rect.width / 2000),
                    right: rect.left + (btnX + BTN_W) * (rect.width / 2000),
                    top:   rect.top  + btnY * (rect.height / 1000)
                };
            }});

            if (MouseIn(L_CB, enabledY, CB_SZ, CB_SZ)) {
                config.enabled = !config.enabled;
                if (config.enabled) startObserver(); else stopObserver();
                saveSettings(); return;
            }
            if (config.enabled && MouseIn(L_CB, recvY, CB_SZ, CB_SZ))       { config.translateReceived  = !config.translateReceived;  saveSettings(); return; }
            if (config.enabled && MouseIn(L_CB, sendY, CB_SZ, CB_SZ))       { config.translateSent      = !config.translateSent;      saveSettings(); return; }
            if (config.enabled && MouseIn(L_CB, chatY, CB_SZ, CB_SZ))       { config.translateChat      = !config.translateChat;      if (!config.translateChat) hideClickToolbar(); saveSettings(); return; }
            if (MouseIn(L_CB, selectionY,  CB_SZ, CB_SZ))                   { config.translateSelection = !config.translateSelection; if (!config.translateSelection) hideSelectionPopup(); saveSettings(); return; }
            if (MouseIn(L_CB, autoScrollY, CB_SZ, CB_SZ))                   { config.autoScroll         = !config.autoScroll;         saveSettings(); return; }
            if (MouseIn(L_CB, skipStutterY, CB_SZ, CB_SZ))                  { config.skipStutter        = !config.skipStutter;        saveSettings(); return; }

            if (MouseIn(R_BTN, RLANG_RECV_Y, BTN_W, CB_SZ)) {
                openMATLangSelect(makeFakeAnchor(R_BTN, RLANG_RECV_Y), (code) => {
                    const idx = langCodes.indexOf(code); if (idx === -1) return;
                    uiRecvIdx = idx; config.recvLang = code; saveSettings();
                }); return;
            }
            if (MouseIn(R_BTN, RLANG_SEND_Y, BTN_W, CB_SZ)) {
                openMATLangSelect(makeFakeAnchor(R_BTN, RLANG_SEND_Y), (code) => {
                    const idx = langCodes.indexOf(code); if (idx === -1) return;
                    uiSendIdx = idx; config.sendLang = code; saveSettings();
                }); return;
            }

            if (MouseIn(HK_BTN_X, HK_ROW1_Y, HK_BTN_W, CB_SZ)) {
                if (hotkeyRecording && hotkeyRecordingTarget === 'toggle') { hotkeyRecording = false; hotkeyRecordingTarget = null; }
                else { startHotkeyRecording('toggle'); }
                return;
            }
            if (MouseIn(HK_CLR_X, HK_ROW1_Y, HK_CLR_W, CB_SZ)) {
                clearHotkey('toggle'); hotkeyRecording = false; hotkeyRecordingTarget = null; return;
            }
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

        ChatRoomSendLocal(ui('loaded', { v: MOD_VER }));
    }

    // /mat settings：直接開啟拓展設定內的 MAT 子頁
    function openSettingsScreen() {
        if (typeof PreferenceSubscreenExtensionsOpen !== 'function') return;
        PreferenceSubscreenExtensionsOpen("Liko_MAT_Settings");
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
                        Image: "Icons/Chat.png",
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
                    if (config.enabled) startObserver();
                });
            });
        } else {
            setTimeout(waitForGame, 500);
        }
    }
    console.log(`🐈‍⬛ [MAT] ✅ v${MOD_VER} Ready`)
})();
