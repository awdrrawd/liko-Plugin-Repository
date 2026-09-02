// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      2.6.1
// @description  聊天室紀錄匯出 | Chat History Export
// @author       莉柯莉絲(likolisu)
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CHE.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CHE.main.user.js
// ==/UserScript==
(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "2.6.1";
    if (window.Liko.CHE) return;
    window.Liko.CHE = MOD_VER;

    let modApi;
    let currentMode = "stopped";

    window.cheErrorCount = 0;
    function logError(location, error) {
        window.cheErrorCount++;
        console.error(`[CHE-${window.cheErrorCount}] ${location}:`, error);
    }

    function isZh() {
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            return l === 'cn' || l === 'tw';
        }
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    function gameAsset(path) {
        const m = window.location.href.match(/(https?:\/\/[^/]+\/R\d+\/BondageClub\/)/);
        return m ? m[1] + path : path;
    }

    const UI = {
        zh: {
            btnHTML:"📥 HTML匯出",btnExcel:"📥 Excel匯出",btnClear:"🗑️ 清除聊天室",
            btnCache:"💾 緩存管理",btnModeCache:"💾 緩存中",btnModeStopped:"⏸️ 停用",
            tooltipTitle:`聊天室記錄管理器 v${MOD_VER}`,
            promptPrivate:"請問是否保存包含\n悄悄話(whisper)與私信(beep)的信息?",
            promptClear:"確定要清空當前聊天室的訊息嗎？\n（緩存數據庫不會被清空）",
            promptNoCache:"沒有緩存數據。是否保存當前聊天室的訊息？",
            promptDelete:n=>`確定要刪除 ${n} 個日期的數據嗎？`,
            cacheTitle:"💾 緩存管理",cacheDateLabel:"選擇要操作的日期：",
            cacheSelectAll:"✓ 全選",cacheExport:"📤 匯出",cacheDelete:"🗑️ 刪除",
            cacheAlertExport:"請選擇要匯出的日期",cacheAlertDelete:"請選擇要刪除的日期",
            cacheMsgCount:n=>`(${n} 條訊息)`,
            toastXlsxFail:"[CHE] ❌ XLSX庫未載入",toastNoMsg:"[CHE] ❗ 沒有訊息可匯出",
            toastExcelWait:"[CHE] 💾 正在生成Excel，請稍候...",
            toastExcelDone:n=>`[CHE] ✅ Excel匯出完成！${n} 條訊息`,
            toastExcelFail:"[CHE] ❌ Excel匯出失敗",
            toastClearFail:"[CHE] ❌ 找不到聊天室容器",toastCleared:"[CHE] 🗑️ 當前聊天室已清空！",
            toastClearErr:"[CHE] ❌ 清空失敗",toastHTMLWait:"[CHE] 💾 正在匯出HTML，請稍候...",
            toastHTMLDone:n=>`[CHE] ✅ HTML匯出完成，${n} 條訊息`,
            toastHTMLFail:"[CHE] ❌ HTML匯出失敗，請重試",
            toastCacheWait:"[CHE] 💾 正在匯出緩存HTML，請稍候...",
            toastCacheDone:n=>`[CHE] ✅ 緩存HTML匯出完成，${n} 條訊息`,
            toastCacheFail:"[CHE] ❌ 緩存HTML匯出失敗",
            toastNoContainer:"[CHE] ❌ 找不到聊天室容器或無訊息可匯出",
            toastNoMsgEx:"[CHE] ❌ 沒有訊息可匯出",toastSaveFail:"[CHE] ❌ 緩存保存失敗",
            toastDeleteN:n=>`[CHE] ✅ 已刪除 ${n} 個日期的數據`,
            toastDeleteNone:"[CHE] ❗ 沒有數據被刪除",toastDeleteFail:"[CHE] ❌ 刪除操作失敗",
            toastSaved:"[CHE] ✅ 已保存當前訊息到緩存",toastNoCacheData:"[CHE] ❗ 選中日期沒有數據",
            toastAutoFail:"[CHE] ❌ 自動保存失敗",toastInitFail:"[CHE] ❌ 初始化失敗",
            toastNotLoaded:"❌ 聊天室尚未載入",
            prefButton:"CHE設定",
        },
        en: {
            btnHTML:"📥 Export HTML",btnExcel:"📥 Export Excel",btnClear:"🗑️ Clear Chat",
            btnCache:"💾 Cache Manager",btnModeCache:"💾 Caching",btnModeStopped:"⏸️ Stopped",
            tooltipTitle:`Chat History Export v${MOD_VER}`,
            promptPrivate:"Include whisper and beep messages in export?",
            promptClear:"Clear current chat log?\n(Cache database will not be cleared)",
            promptNoCache:"No cached data. Save current chat messages?",
            promptDelete:n=>`Delete data for ${n} date(s)?`,
            cacheTitle:"💾 Cache Manager",cacheDateLabel:"Select dates to manage:",
            cacheSelectAll:"✓ Select All",cacheExport:"📤 Export",cacheDelete:"🗑️ Delete",
            cacheAlertExport:"Please select dates to export",cacheAlertDelete:"Please select dates to delete",
            cacheMsgCount:n=>`(${n} messages)`,
            toastXlsxFail:"[CHE] ❌ XLSX library not loaded",toastNoMsg:"[CHE] ❗ No messages to export",
            toastExcelWait:"[CHE] 💾 Generating Excel, please wait...",
            toastExcelDone:n=>`[CHE] ✅ Excel export complete! ${n} messages`,
            toastExcelFail:"[CHE] ❌ Excel export failed",
            toastClearFail:"[CHE] ❌ Chat log container not found",toastCleared:"[CHE] 🗑️ Chat log cleared!",
            toastClearErr:"[CHE] ❌ Clear failed",toastHTMLWait:"[CHE] 💾 Exporting HTML, please wait...",
            toastHTMLDone:n=>`[CHE] ✅ HTML export complete, ${n} messages`,
            toastHTMLFail:"[CHE] ❌ HTML export failed, please retry",
            toastCacheWait:"[CHE] 💾 Exporting cached HTML, please wait...",
            toastCacheDone:n=>`[CHE] ✅ Cache HTML export complete, ${n} messages`,
            toastCacheFail:"[CHE] ❌ Cache HTML export failed",
            toastNoContainer:"[CHE] ❌ Chat log not found or no messages",
            toastNoMsgEx:"[CHE] ❌ No messages to export",toastSaveFail:"[CHE] ❌ Cache save failed",
            toastDeleteN:n=>`[CHE] ✅ Deleted ${n} date(s)`,
            toastDeleteNone:"[CHE] ❗ No data was deleted",toastDeleteFail:"[CHE] ❌ Delete operation failed",
            toastSaved:"[CHE] ✅ Current messages saved to cache",
            toastNoCacheData:"[CHE] ❗ No data for selected dates",toastAutoFail:"[CHE] ❌ Auto-save failed",toastInitFail:"[CHE] ❌ Initialization failed",
            toastNotLoaded:"❌ Chat room not loaded yet",
            prefButton:"CHE Settings",
        }
    };

    function ui(key, ...args) {
        const table = isZh() ? UI.zh : UI.en;
        const val = table[key];
        if (typeof val === 'function') return val(...args);
        return val !== undefined ? val : key;
    }

    function getAccountPrefix() {
        return String(window.Player?.MemberNumber || "0");
    }

    function normalizeTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return "";
        if (timeStr.includes('T') || /^\d{2}:\d{2}/.test(timeStr)) return timeStr;
        const m = timeStr.match(/([上下])午\s*0?(\d{1,2}):(\d{2})/);
        if (m) {
            let h = parseInt(m[2], 10);
            const min = m[3];
            const isPM = m[1] === '下';
            if (isPM && h !== 12) h += 12;
            if (!isPM && h === 12) h = 0;
            return `${String(h).padStart(2, '0')}:${min}`;
        }
        return timeStr;
    }

    const DOMCache = {
        chatLog: null,
        lastCheckTime: 0,
        getChatLog() {
            const now = Date.now();
            try {
                if (!this.chatLog || !document.contains(this.chatLog) || now - this.lastCheckTime > 5000) {
                    this.chatLog = document.querySelector("#TextAreaChatLog");
                    this.lastCheckTime = now;
                    if (!this.chatLog) return null;
                }
                return this.chatLog;
            } catch (e) { logError("DOMCache.getChatLog", e); this.chatLog = null; return null; }
        },
        getMessages() {
            try {
                const log = this.getChatLog();
                if (!log) return [];
                return Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
            } catch (e) { logError("DOMCache.getMessages", e); return []; }
        }
    };

    const DateUtils = {
        getDateKey(date = new Date()) {
            try {
                return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
            } catch (e) {
                logError("DateUtils.getDateKey", e);
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
            }
        },
        getDisplayDate(dateKey) {
            try {
                const parts = dateKey.split('-');
                if (parts.length !== 3) return dateKey;
                const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                if (isNaN(d.getTime())) return dateKey;
                return `${d.getMonth()+1}/${d.getDate()}`;
            } catch (e) { logError("DateUtils.getDisplayDate", e); return dateKey; }
        }
    };

    // =====================================================================
    // CacheManager
    // =====================================================================
    // 注意："ChatLoggerV2" 是沿用的資料庫名稱，不代表目前 schema 版本。
    // 真正版本是 indexedDB.open 的第二參數（目前為 4），所以舊版會在原 DB 升級。
    // 同一個資料庫並在原地升級，原 daily_fragments 仍可供下方 migration 讀取。
    const CHE_DB_NAME = "ChatLoggerV2";
    const CHE_DB_VERSION = 4;

    const CacheManager = {
        _dbPromise: null,
        _cryptoKeyPromise: null,
        async init() {
            if (this._dbPromise) return this._dbPromise;
            this._dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(CHE_DB_NAME, CHE_DB_VERSION);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains("fragments")) db.deleteObjectStore("fragments");
                    if (!db.objectStoreNames.contains("daily_fragments")) db.createObjectStore("daily_fragments");
                    if (!db.objectStoreNames.contains("messages")) {
                        const store = db.createObjectStore("messages", { keyPath: "_key" });
                        store.createIndex("account", "_account", { unique: false });
                        store.createIndex("accountDate", "_accountDate", { unique: false });
                    }
                    if (!db.objectStoreNames.contains("crypto_keys")) db.createObjectStore("crypto_keys", { keyPath: "id" });
                };
                request.onsuccess = async () => {
                    try {
                        await this._migrateLegacy(request.result);
                        await this._encryptPlaintextRecords(request.result);
                        resolve(request.result);
                    }
                    catch (e) { this._dbPromise = null; reject(e); }
                };
                request.onerror = () => {
                    this._dbPromise = null;
                    logError("CacheManager.init", request.error || "IndexedDB init failed");
                    reject(request.error || new Error("IndexedDB init failed"));
                };
            });
            return this._dbPromise;
        },

        async _migrateLegacy(db) {
            // 保留 v2 daily_fragments 相容遷移；遷移完成後會由 v4 加密流程
            // 將 messages store 中仍為明文的記錄全部轉換成 AES-GCM 密文。
            if (!db.objectStoreNames.contains("daily_fragments")) return;
            const tx = db.transaction(["daily_fragments", "messages"], "readwrite");
            const legacy = tx.objectStore("daily_fragments");
            const messages = tx.objectStore("messages");
            await new Promise((resolve, reject) => {
                const req = legacy.openCursor();
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor) return;
                    const key = String(cursor.key);
                    const split = key.indexOf("_");
                    // 早期 v2 key 只有 YYYY-MM-DD，後期才加入 account_YYYY-MM-DD 前綴；兩者都接。
                    const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(key);
                    const account = bareDate ? getAccountPrefix() : (split >= 0 ? key.slice(0, split) : getAccountPrefix());
                    const date = bareDate ? key : (split >= 0 ? key.slice(split + 1) : DateUtils.getDateKey());
                    const rows = Array.isArray(cursor.value?.messages) ? cursor.value.messages : [];
                    rows.forEach((msg, i) => {
                        const uid = msg._uid || msg.msgid || `legacy_${i}_${msg._ts || 0}`;
                        messages.put({ ...msg, _uid:uid, _account:account, _dateStr:date,
                            _accountDate:`${account}_${date}`, _key:`${account}_${date}_${uid}` });
                    });
                    cursor.delete();
                    cursor.continue();
                };
                req.onerror = () => reject(req.error);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error("Legacy migration aborted"));
            });
        },

        _makeKey(dateStr) { return `${getAccountPrefix()}_${dateStr}`; },

        async _getCryptoKey(db) {
            if (this._cryptoKeyPromise) return this._cryptoKeyPromise;
            this._cryptoKeyPromise = (async () => {
                if (!window.crypto?.subtle) throw new Error("Web Crypto API unavailable");
                const existing = await new Promise((resolve, reject) => {
                    const tx = db.transaction(["crypto_keys"], "readonly");
                    const req = tx.objectStore("crypto_keys").get("message-key-v1");
                    req.onsuccess = () => resolve(req.result?.key || null);
                    req.onerror = () => reject(req.error);
                });
                if (existing) return existing;
                const key = await crypto.subtle.generateKey({ name:"AES-GCM", length:256 }, false, ["encrypt", "decrypt"]);
                await new Promise((resolve, reject) => {
                    const tx = db.transaction(["crypto_keys"], "readwrite");
                    tx.objectStore("crypto_keys").put({ id:"message-key-v1", key, createdAt:Date.now() });
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(tx.error || new Error("Crypto key save aborted"));
                });
                return key;
            })().catch(e => { this._cryptoKeyPromise = null; throw e; });
            return this._cryptoKeyPromise;
        },

        async _encryptRecord(db, record) {
            if (record?._encrypted === 1) return record;
            const key = await this._getCryptoKey(db);
            const { _key, _account, _dateStr, _accountDate, _uid, ...privateData } = record;
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const aad = new TextEncoder().encode(_key);
            const plaintext = new TextEncoder().encode(JSON.stringify(privateData));
            const encrypted = await crypto.subtle.encrypt({ name:"AES-GCM", iv, additionalData:aad }, key, plaintext);
            return { _key, _account, _dateStr, _accountDate, _uid, _encrypted:1,
                _iv:Array.from(iv), _data:Array.from(new Uint8Array(encrypted)) };
        },

        async _decryptRecord(db, record) {
            if (record?._encrypted !== 1) return record;
            const key = await this._getCryptoKey(db);
            const iv = new Uint8Array(record._iv);
            const data = new Uint8Array(record._data);
            const aad = new TextEncoder().encode(record._key);
            const decrypted = await crypto.subtle.decrypt({ name:"AES-GCM", iv, additionalData:aad }, key, data);
            const privateData = JSON.parse(new TextDecoder().decode(decrypted));
            return { ...privateData, _key:record._key, _account:record._account, _dateStr:record._dateStr,
                _accountDate:record._accountDate, _uid:record._uid };
        },

        async _encryptPlaintextRecords(db) {
            const plaintextRows = await new Promise((resolve, reject) => {
                const tx = db.transaction(["messages"], "readonly");
                const req = tx.objectStore("messages").getAll();
                req.onsuccess = () => resolve(req.result.filter(row => row?._encrypted !== 1));
                req.onerror = () => reject(req.error);
            });
            if (!plaintextRows.length) return;
            const encryptedRows = await Promise.all(plaintextRows.map(row => this._encryptRecord(db, row)));
            await new Promise((resolve, reject) => {
                const tx = db.transaction(["messages"], "readwrite");
                const store = tx.objectStore("messages");
                encryptedRows.forEach(row => store.put(row));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error || new Error("Plaintext migration aborted"));
            });
            console.log(`🐈‍⬛ [CHE] 已加密 ${encryptedRows.length} 筆既有緩存`);
        },

        _prepareRecord(msg, dateKey) {
            const account = getAccountPrefix();
            const uid = msg.msgid || msg._uid || `${msg._ts || Date.now()}_${Math.random().toString(36).slice(2)}`;
            return { ...msg, _uid: uid, _account: account, _dateStr: dateKey,
                _accountDate: `${account}_${dateKey}`, _key: `${account}_${dateKey}_${uid}` };
        },

        async saveForDate(messages, dateKey) {
            if (!messages || messages.length === 0) return 0;
            try {
                const db = await this.init();
                const encryptedRecords = await Promise.all(messages.map(msg => this._encryptRecord(db, this._prepareRecord(msg, dateKey))));
                const tx = db.transaction(["messages"], "readwrite");
                const store = tx.objectStore("messages");
                encryptedRecords.forEach(record => store.put(record));
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error("Transaction aborted"));
                });
                return messages.length;
            } catch (e) {
                logError("CacheManager.saveForDate", e);
                window.ChatRoomSendLocalStyled(ui('toastSaveFail'), 3000, "#ff0000");
                throw e;
            }
        },

        async saveToday(messages) {
            return this.saveForDate(messages, DateUtils.getDateKey());
        },

        async getAvailableDates() {
            try {
                const db = await this.init();
                const tx = db.transaction(["messages"], "readonly");
                const index = tx.objectStore("messages").index("account");
                const rows = await new Promise((resolve, reject) => {
                    const req = index.getAll(IDBKeyRange.only(getAccountPrefix()));
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                const counts = new Map();
                rows.forEach(row => counts.set(row._dateStr, (counts.get(row._dateStr) || 0) + 1));
                const result = [...counts].map(([dateStr, count]) => ({
                    dateKey: this._makeKey(dateStr), count, display: DateUtils.getDisplayDate(dateStr)
                }));
                return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
            } catch (e) { logError("CacheManager.getAvailableDates", e); return []; }
        },

        // =====================================================================
        // 時序修復
        //
        // 跨日順序由 sortedKeys 升序迭代保證。每日內部：
        //   - 若整日訊息都帶擷取時間戳 _ts（v2.5.x 起），以 _ts 穩定排序，
        //     修正「復原/合併批次帶較早時間戳卻被 append 在尾端」造成的亂序；
        //     JS sort 穩定 → 同 _ts（同批次）維持原插入順序，不會打散同分鐘訊息。
        //   - 舊資料缺 _ts 時，維持原 DB 插入順序（不製造新亂序，7 天內自然汰換）。
        // =====================================================================
        async getMessagesForDates(dateKeys) {
            try {
                const db = await this.init();
                const tx = db.transaction(["messages"], "readonly");
                const index = tx.objectStore("messages").index("account");
                const prefix = getAccountPrefix() + "_";
                const selected = new Set(dateKeys.map(key => key.startsWith(prefix) ? key.slice(prefix.length) : key));
                const rows = await new Promise((resolve, reject) => {
                    const req = index.getAll(IDBKeyRange.only(getAccountPrefix()));
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                const decryptedRows = await Promise.all(rows.filter(row => selected.has(row._dateStr)).map(async row => {
                    try { return await this._decryptRecord(db, row); }
                    catch (e) { logError("CacheManager.decryptRecord", e); return null; }
                }));
                return decryptedRows.filter(Boolean)
                    .sort((a, b) => a._dateStr.localeCompare(b._dateStr) || (a._ts || 0) - (b._ts || 0))
                    .map(msg => ({ ...msg, isFromCache: true }));
            } catch (e) { logError("CacheManager.getMessagesForDates", e); return []; }
        },

        async deleteDates(dateKeys) {
            if (!dateKeys || dateKeys.length === 0) return false;
            try {
                const db = await this.init();
                let successCount = 0;
                for (const dateKey of dateKeys) {
                    try {
                        const prefix = getAccountPrefix() + "_";
                        const dateStr = dateKey.startsWith(prefix) ? dateKey.slice(prefix.length) : dateKey;
                        const tx = db.transaction(["messages"], "readwrite");
                        const index = tx.objectStore("messages").index("accountDate");
                        const range = IDBKeyRange.only(`${getAccountPrefix()}_${dateStr}`);
                        await new Promise(resolve => {
                            const req = index.openKeyCursor(range);
                            req.onsuccess = () => { const cursor = req.result; if (cursor) { tx.objectStore("messages").delete(cursor.primaryKey); cursor.continue(); } else resolve(); };
                            req.onerror = () => resolve();
                        });
                        await new Promise(resolve => {
                            tx.oncomplete = () => { successCount++; resolve(); };
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        });
                    } catch (itemError) { logError("CacheManager.deleteDates.item", itemError); }
                }
                if (successCount > 0) {
                    window.ChatRoomSendLocalStyled(ui('toastDeleteN', successCount), 3000, "#00ff00");
                    return true;
                } else {
                    window.ChatRoomSendLocalStyled(ui('toastDeleteNone'), 3000, "#ffa500");
                    return false;
                }
            } catch (e) {
                logError("CacheManager.deleteDates", e);
                window.ChatRoomSendLocalStyled(ui('toastDeleteFail'), 3000, "#ff0000");
                return false;
            }
        },

        async cleanOldData() {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoffDate = DateUtils.getDateKey(sevenDaysAgo);
            try {
                const db = await this.init();
                const tx = db.transaction(["messages"], "readwrite");
                const store = tx.objectStore("messages");
                const index = store.index("account");
                await new Promise((resolve, reject) => {
                    const req = index.openCursor(IDBKeyRange.only(getAccountPrefix()));
                    req.onsuccess = () => {
                        const cursor = req.result;
                        if (!cursor) { resolve(); return; }
                        if (cursor.value._dateStr < cutoffDate) cursor.delete();
                        cursor.continue();
                    };
                    req.onerror = () => reject(req.error);
                });
            } catch (e) { logError("CacheManager.cleanOldData", e); }
        }
    };

    // 真正的 v1 使用另一個資料庫名稱 "ChatLogger"，內容是無日期的 fragments；
    // 它無法套用七日規則，也從未被 v2 的 ChatLoggerV2 自動讀取。既然碎片復原已移除，
    // v2.6 僅檢測後清除此淘汰資料庫，避免殘留無法管理的聊天資料。
    // TODO(v2.7): 移除此一次性 v1 檢測/清理相容程式。
    async function cleanupLegacyV1Database() {
        if (typeof indexedDB.databases !== "function") return;
        try {
            const databases = await indexedDB.databases();
            if (!databases.some(info => info.name === "ChatLogger")) return;
            await new Promise((resolve, reject) => {
                const req = indexedDB.deleteDatabase("ChatLogger");
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
                req.onblocked = () => reject(new Error("Legacy ChatLogger database deletion blocked"));
            });
            console.log("🐈‍⬛ [CHE] 已清除淘汰的 v1 ChatLogger 碎片資料庫");
        } catch (e) { logError("cleanupLegacyV1Database", e); }
    }

    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Load failed"));
            document.head.appendChild(script);
        });
    }

    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        document.head.appendChild(script);
    }

    function isFilteredMessage(content, messageType, includePrivate = true) {
        const basicFilters = ["BCX commands tutorial", "BCX also provides", "(输入 /help 查看命令列表)"];
        if (basicFilters.some(f => content.includes(f))) return true;
        const isBceBeepContent = /^\(Beep (to|from)\b/i.test(content);
        const isSystemBeep = content.includes("好友私聊来自") || content.includes("好友私聊") || /\bBEEP\b/.test(content);
        if (isSystemBeep) return true;
        const effectiveType = (messageType === "beep" || messageType === "beep_duplicate" || isBceBeepContent) ? "beep" : messageType;
        if (!includePrivate) {
            if (effectiveType === "beep" || effectiveType === "whisper") return true;
            if (content.includes("↩️")) return true;
            const privateKeywords = ["悄悄話", "悄悄话"];
            if (privateKeywords.some(k => content.includes(k))) return true;
        }
        return false;
    }

    function detectMessageType(msg, content) {
        if (!msg || !content) return "normal";
        try {
            if (msg.classList?.contains('bce-notification') || msg.querySelector?.('.bce-beep-link')) return "beep";
            if (msg.matches && typeof msg.matches === 'function') {
                if (msg.matches("a.beep-link")) return "beep";
            }
            if (msg.classList && msg.classList.contains("ChatMessageWhisper")) return "whisper";
            if (typeof content === 'string') {
                if (content.includes("好友私聊来自") || content.includes("BEEP")) return "beep";
                if (content.includes("悄悄话") || content.includes("悄悄話")) return "whisper";
            }
            return "normal";
        } catch (e) { logError("detectMessageType", e); return "normal"; }
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function linkifyContent(text) {
        if (!text) return '';
        const urlRegex = /(https?:\/\/[^\s\n]+)/g;
        const imageExts = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?$/i;
        return text.split(urlRegex).map((part, i) => {
            if (i % 2 === 1) {
                // 剝除尾端 emoji / 非 ASCII 可列印字元，以及多餘標點
                const cleanPart = part.replace(/[^\x21-\x7E]+$/, '').replace(/[.,;:!?)]+$/, '');
                const safeUrl = escapeHtml(cleanPart);
                if (imageExts.test(cleanPart)) {
                    return `<a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;margin:4px 0;">` +
                        `<img src="${safeUrl}" style="max-width:240px;max-height:180px;border-radius:6px;vertical-align:middle;cursor:zoom-in;display:block;" ` +
                        `onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" loading="lazy">` +
                        `<span style="display:none;color:inherit;">${safeUrl}</span></a>`;
                }
                return `<a href="${safeUrl}" target="_blank" rel="noopener" style="color:inherit;opacity:0.8;text-decoration:underline;word-break:break-all;">${safeUrl}</a>`;
            }
            return escapeHtml(part);
        }).join('');
    }

    function extractFullTextContent(element) {
        if (!element) return "";
        try {
            const clone = element.cloneNode(true);
            clone.querySelectorAll('.chat-room-message-popup, .chat-room-metadata').forEach(el => el.remove());
            const links = clone.querySelectorAll('a[href]');
            links.forEach(function(link) {
                try {
                    const href = link.getAttribute('href') || '';
                    const text = link.innerText || link.textContent || '';
                    if (text && text !== href && !text.includes('http')) link.textContent = text + ' (' + href + ')';
                    else link.textContent = href;
                } catch {}
            });
            let result = (clone.textContent || clone.innerText || "").replace(/\s*\n\s*/g,'\n').trim();
            result = result.replace(/\s*\(#[\w-]+-?\d*\)/gi, '').trim();
            return result;
        } catch (e) {
            logError("extractFullTextContent", e);
            try { return element.textContent || element.innerText || ""; } catch { return ""; }
        }
    }

    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        try {
            let c = "";
            if (msg.style && typeof msg.style.getPropertyValue === 'function') c = msg.style.getPropertyValue("--label-color");
            if (!c && window.getComputedStyle) { try { c = getComputedStyle(msg).getPropertyValue("--label-color"); } catch {} }
            if (!c && nameButton) {
                try {
                    if (nameButton.style && typeof nameButton.style.getPropertyValue === 'function') c = nameButton.style.getPropertyValue("--label-color");
                    if (!c && window.getComputedStyle) c = getComputedStyle(nameButton).getPropertyValue("--label-color");
                } catch {}
            }
            c = (c || "").trim();
            if (c) return c;
            const colorSpan = msg.querySelector('[style*="color"]');
            if (colorSpan && colorSpan.style && colorSpan.style.color) return colorSpan.style.color;
            const fontEl = msg.querySelector("font[color]");
            if (fontEl && fontEl.color) return fontEl.color;
            return "#000";
        } catch (e) { logError("getLabelColor", e); return "#000"; }
    }

    function getEnhancedContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return isDarkTheme ? "#eee" : "#333";
        let cleanColor = hexColor.trim();
        if (cleanColor.startsWith('rgb')) {
            const match = cleanColor.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (match) {
                const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
                cleanColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            }
        }
        if (!cleanColor.startsWith('#') || cleanColor.length !== 7) return isDarkTheme ? "#eee" : "#333";
        try {
            const r = parseInt(cleanColor.slice(1,3),16), g = parseInt(cleanColor.slice(3,5),16), b = parseInt(cleanColor.slice(5,7),16);
            const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
            if (isDarkTheme) {
                if (luminance < 0.4) return lightenColor(cleanColor, 0.6);
                if (luminance < 0.6) return lightenColor(cleanColor, 0.3);
                return cleanColor;
            } else {
                if (luminance > 0.7) return darkenColor(cleanColor, 0.6);
                if (luminance > 0.5) return darkenColor(cleanColor, 0.3);
                return cleanColor;
            }
        } catch { return isDarkTheme ? "#eee" : "#333"; }
    }

    function lightenColor(color, amount) {
        try {
            const num = parseInt(color.slice(1),16);
            const r = Math.min(255,(num>>16)+Math.round(255*amount));
            const g = Math.min(255,((num>>8)&0x00FF)+Math.round(255*amount));
            const b = Math.min(255,(num&0x0000FF)+Math.round(255*amount));
            return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`;
        } catch { return color; }
    }

    function darkenColor(color, amount) {
        try {
            const num = parseInt(color.slice(1),16);
            const r = Math.max(0,(num>>16)-Math.round(255*amount));
            const g = Math.max(0,((num>>8)&0x00FF)-Math.round(255*amount));
            const b = Math.max(0,(num&0x0000FF)-Math.round(255*amount));
            return `#${(r<<16|g<<8|b).toString(16).padStart(6,'0')}`;
        } catch { return color; }
    }

    // =====================================================================
    // HTML Template
    //   確保深色/亮色主題切換時，所有訊息文字（包含 [🌐] 翻譯訊息）
    //   都能正確顯示，不因繼承鏈斷裂而顯示為黑字。
    //   同時移除 .enhanced-color { filter:brightness } 改由 CSS 變數管控。
    // =====================================================================
    async function generateHTMLTemplate(title) {
        return `
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
:root {
    --bg-color:#111; --text-color:#eee; --muted-text:#aaa; --border-color:#444;
    --input-bg:#222; --input-border:#666; --button-bg:#444; --button-text:#fff;
    --separator-bg:#2b193d; --separator-border:#9b5de5;
    --beep-color:#ff6b6b; --beep-bg:rgba(255,107,107,0.12);
    --accent:#7F53CD;
}
body.light {
    --bg-color:#f4f1f8; --text-color:#211b29; --muted-text:#62586d; --border-color:#cfc6d8;
    --input-bg:#fff; --input-border:#aaa0b5; --button-bg:#e8e1ef; --button-text:#241c2d;
    --separator-bg:#e9ddf6; --separator-border:#6f36a8;
    --beep-color:#a52b2d; --beep-bg:#f6dddd;
}
body { font-family:sans-serif; background:var(--bg-color); color:var(--text-color); margin:0; padding:0; transition:background .2s,color .2s; }
.chat-row { --resolved-name:var(--name-color); display:flex; align-items:flex-start; margin:3px 6px; padding:5px 8px; border-radius:7px; position:relative; background:var(--row-bg); border-left-color:var(--row-accent); }
body.light .chat-row { --resolved-name:color-mix(in srgb,var(--name-color),#241c2d 42%); background:color-mix(in srgb,var(--row-bg),#fff 58%); box-shadow:0 1px 0 rgba(48,32,60,.05); }
.chat-meta { display:flex; flex-direction:column; align-items:flex-end; width:70px; font-size:0.8em; margin-right:8px; flex-shrink:0; }
.chat-time { color:var(--muted-text); }
.chat-id { font-weight:bold; }
.chat-content { flex:1; white-space:pre-wrap; word-wrap:break-word; color:var(--text-color); }
.with-accent { border-left:4px solid transparent; }
.separator-row { position:sticky; top:var(--sticky-top,88px); z-index:60; background:var(--separator-bg); border-left:4px solid var(--separator-border); text-align:center; font-weight:bold; padding:8px; margin:4px 0; border-radius:8px; box-shadow:0 3px 10px rgba(0,0,0,.18); transition:opacity 0.2s; }
.separator-row.is-collapsed { position:relative; top:auto; z-index:1; box-shadow:none; }
.separator-row.filter-hidden { display:none !important; }
.collapse-button { background:none; border:none; color:inherit; font-size:16px; cursor:pointer; padding:6px 10px; border-radius:4px; }
.collapse-button:hover { background:rgba(255,255,255,0.1); }
body.light .collapse-button:hover { background:rgba(0,0,0,0.08); }
.collapsible-content { display:block; }
.collapsible-content.collapsed { display:none; }
.collapsible-content.filter-expanded { display:block !important; }
#topbar { position:fixed; top:10px; right:10px; display:flex; gap:8px; z-index:1001; }
#topbar button { padding:8px 14px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.3); font-size:13px; transition:all 0.2s; }
#toggleTheme { background:#fff; color:#000; }
body.light #toggleTheme { background:#333; color:#fff; }
#toggleLang { background:var(--accent); color:#fff; }
#searchPanel { position:sticky; top:0; background:color-mix(in srgb,var(--bg-color),transparent 4%); padding:12px; border-bottom:1px solid var(--border-color); backdrop-filter:blur(10px); z-index:100; box-shadow:0 3px 12px rgba(0,0,0,.1); }
#searchPanel .row1 { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
#searchPanel input, #searchPanel select { padding:6px 10px; border-radius:6px; border:1px solid var(--input-border); background:var(--input-bg); color:var(--text-color); font-size:14px; }
#contentSearch { width:200px; }
#idFilter { width:200px; }
#clearBtn { padding:6px 12px; border-radius:6px; border:none; background:var(--button-bg); color:var(--button-text); cursor:pointer; font-size:14px; }
.type-filters { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
.type-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:20px; font-size:11px; cursor:pointer; border:1px solid var(--border-color); color:var(--muted-text); transition:all 0.18s; user-select:none; background:transparent; white-space:nowrap; }
.type-chip input[type=checkbox]{ display:none; }
.type-chip.active { border-color:var(--accent); color:var(--text-color); background:rgba(127,83,205,0.15); }
#pageStats { text-align:center; padding:10px; font-size:12px; color:var(--muted-text); position:sticky; bottom:0; background:var(--bg-color); border-top:1px solid var(--border-color); }
.user-name { font-weight:bold; }
.action-text { font-style:italic; opacity:0.9; }
.beep-msg { color:#5b8def; font-weight:bold; }
.date-divider { text-align:center; padding:6px 0; font-size:12px; font-weight:600; color:var(--accent); border-top:1px solid rgba(127,83,205,0.25); border-bottom:1px solid rgba(127,83,205,0.25); margin:10px 0; letter-spacing:1px; }
.row-del { display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.3); color:#e74c3c; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:12px; line-height:1; padding:0; transition:all 0.15s; flex-shrink:0; }
.row-del:hover { background:rgba(231,76,60,0.35); }
body.del-mode .row-del { display:flex; align-items:center; justify-content:center; }
body.del-mode .chat-row { padding-right:32px; }
.chat-row.soft-deleted { display:none; }
body.del-mode .chat-row.soft-deleted { display:flex; opacity:0.38; background:rgba(231,76,60,0.07) !important; border-left-color:#e74c3c !important; }
body.del-mode .chat-row.soft-deleted .row-del { background:rgba(46,204,113,0.2); color:#2ecc71; border-color:rgba(46,204,113,0.4); }
.row2 { display:flex; align-items:center; margin-top:6px; gap:0; }
.row2-center { flex:1; display:flex; justify-content:center; flex-wrap:wrap; gap:5px; }
.row2-right { display:flex; gap:6px; align-items:center; margin-left:auto; padding-left:16px; flex-shrink:0; }
#toggleDelMode { padding:4px 10px; border-radius:20px; border:1px solid rgba(231,76,60,0.4); background:rgba(231,76,60,0.12); color:#e74c3c; cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; }
body.del-mode #toggleDelMode { background:rgba(231,76,60,0.35); color:#fff; }
#exportAfterDel { padding:4px 10px; border-radius:20px; border:none; background:var(--accent); color:#fff; cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; }
.privacy-panel { display:none; justify-content:center; align-items:center; flex-wrap:wrap; gap:6px; margin:9px auto 0; padding:9px; max-width:850px; border:1px solid var(--border-color); border-radius:9px; background:color-mix(in srgb,var(--input-bg),transparent 12%); }
.privacy-panel.open { display:flex; }
#privacyIds, #privacyKeywords { width:230px; }
.privacy-btn { padding:4px 10px; border-radius:20px; border:1px solid rgba(127,83,205,.5); background:rgba(127,83,205,.14); color:var(--text-color); cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; }
.privacy-btn:hover { background:rgba(127,83,205,.28); }
#togglePrivacy { padding:4px 10px; border-radius:20px; border:1px solid rgba(127,83,205,.5); background:rgba(127,83,205,.14); color:var(--text-color); cursor:pointer; font-size:12px; font-weight:600; white-space:nowrap; }
#togglePrivacy[aria-expanded="true"] { background:rgba(127,83,205,.35); }
.chat-id.privacy-masked, .chat-content.privacy-masked, .user-name.privacy-masked { color:var(--muted-text) !important; font-style:italic; }
.chat-content.privacy-masked { border:1px dashed var(--border-color); border-radius:5px; padding:3px 7px; }
@media(max-width:768px){
    .chat-meta{width:55px; font-size:0.7em;}
    #searchPanel .row1{flex-direction:column; align-items:stretch;}
    #searchPanel input,#searchPanel select{width:100%!important;}
    .row2{flex-wrap:wrap;}
    .row2-right{margin-left:0; margin-top:4px;}
}
</style>
</head>
<body>
<div id="topbar">
    <button id="toggleTheme"></button>
    <button id="toggleLang"></button>
</div>
<div id="searchPanel">
    <div class="row1" style="justify-content:center;">
        <input type="text" id="contentSearch" />
        <input type="text" id="idFilter" />
        <select id="timeRange">
            <option value="" data-zh="所有時間" data-en="All time"></option>
            <option value="1h" data-zh="近1小時" data-en="Last 1h"></option>
            <option value="3h" data-zh="近3小時" data-en="Last 3h"></option>
            <option value="6h" data-zh="近6小時" data-en="Last 6h"></option>
            <option value="12h" data-zh="近12小時" data-en="Last 12h"></option>
            <option value="24h" data-zh="近24小時" data-en="Last 24h"></option>
        </select>
        <button id="clearBtn"></button>
    </div>
    <div class="row2">
        <div class="row2-center" id="typeFilters"></div>
        <div class="row2-right" id="editBtns">
            <button id="togglePrivacy" aria-expanded="false"></button>
            <button id="toggleDelMode">✂️</button>
        </div>
    </div>
    <div class="privacy-panel" id="privacyPanel">
        <input type="text" id="privacyIds" />
        <button class="privacy-btn" id="maskIdsBtn"></button>
        <button class="privacy-btn" id="maskMessagesBtn"></button>
        <input type="text" id="privacyKeywords" />
        <button class="privacy-btn" id="maskKeywordsBtn"></button>
        <button class="privacy-btn" id="resetMasksBtn"></button>
    </div>
</div>
<div id="chatlog">
`;
    }

    // =====================================================================
    // HTML Footer
    // =====================================================================
    function getHTMLFooter(defaultLang) {
        const def = (defaultLang || (isZh() ? 'zh' : 'en'));
        return `
</div>
<div id="pageStats"></div>
<script>
(function(){
    var LANG = {
        zh: {
            searchPlaceholder: "搜尋內容...",
            idPlaceholder: "篩選ID（逗號分隔）...",
            clearBtn: "清除",
            lightMode: "✧ 淺色",
            darkMode: "✦ 深色",
            langLabel: "ENG",
            showing: function(v,t){ return "顯示 "+v+" / "+t+" 條訊息"; },
            typeChat:     "💬 聊天",
            typeEmote:    "✨ 表情動作",
            typeAction:   "🎭 交互動作",
            typeActivity: "🔗 綑綁活動",
            typeEnter:    "🚪 進出",
            typeWhisper:  "🔒 悄悄話",
            typeBeep:     "📨 私信",
            typeSystem:   "⚙ 系統",
            privacyPlaceholder: "遮蔽對象 ID（逗號分隔）...",
            keywordPlaceholder: "遮蔽關鍵字（逗號分隔）...",
            privacyButton: "🛡️ 遮蔽",
            maskIds: "🪪 遮蔽 ID＋名稱",
            maskMessages: "💬 遮蔽訊息",
            maskKeywords: "🔤 遮蔽關鍵字",
            resetMasks: "↩ 復原遮蔽",
            maskedId: "[ID 已遮蔽]",
            maskedName: "[名稱已遮蔽]",
            maskedKeyword: "[已遮蔽]",
            maskedMessage: "[訊息已遮蔽]"
        },
        en: {
            searchPlaceholder: "Search content...",
            idPlaceholder: "Filter ID (comma separated)...",
            clearBtn: "Clear",
            lightMode: "✧ Light",
            darkMode: "✦ Dark",
            langLabel: "中文",
            showing: function(v,t){ return "Showing "+v+" / "+t+" messages"; },
            typeChat:     "💬 Chat",
            typeEmote:    "✨ Emote",
            typeAction:   "🎭 Action",
            typeActivity: "🔗 Activity",
            typeEnter:    "🚪 Enter/Leave",
            typeWhisper:  "🔒 Whisper",
            typeBeep:     "📨 Beep",
            typeSystem:   "⚙ System",
            privacyPlaceholder: "IDs to mask (comma separated)...",
            keywordPlaceholder: "Keywords to mask (comma separated)...",
            privacyButton: "🛡️ Privacy",
            maskIds: "🪪 Mask IDs + names",
            maskMessages: "💬 Mask messages",
            maskKeywords: "🔤 Mask keywords",
            resetMasks: "↩ Undo masks",
            maskedId: "[ID masked]",
            maskedName: "[Name masked]",
            maskedKeyword: "[Masked]",
            maskedMessage: "[Message masked]"
        }
    };
    var currentLang = "${def}";
    function t(key){ return LANG[currentLang][key]; }

    var TYPE_KEYS = ['chat','emote','action','activity','enter','whisper','beep','system'];
    var typeState = {};
    TYPE_KEYS.forEach(function(k){ typeState[k] = true; });

    function buildTypeChips() {
        var container = document.getElementById('typeFilters');
        if (!container) return;
        container.innerHTML = '';
        var existingTypes = new Set();
        allChatRows.forEach(function(r){ existingTypes.add(r.dataset.type || 'chat'); });
        TYPE_KEYS.forEach(function(tp) {
            if (!existingTypes.has(tp)) return;
            var chip = document.createElement('label');
            chip.className = 'type-chip' + (typeState[tp] ? ' active' : '');
            chip.dataset.type = tp;
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = typeState[tp];
            chip.appendChild(cb);
            var key = 'type' + tp.charAt(0).toUpperCase() + tp.slice(1);
            chip.appendChild(document.createTextNode(t(key)));
            chip.addEventListener('click', function(e){
                e.preventDefault();
                typeState[tp] = !typeState[tp];
                chip.classList.toggle('active', typeState[tp]);
                applyFilters();
            });
            container.appendChild(chip);
        });
    }

    function applyLangUI() {
        document.getElementById("contentSearch").placeholder = t("searchPlaceholder");
        document.getElementById("idFilter").placeholder     = t("idPlaceholder");
        document.getElementById("clearBtn").textContent     = t("clearBtn");
        document.getElementById("privacyIds").placeholder  = t("privacyPlaceholder");
        document.getElementById("privacyKeywords").placeholder = t("keywordPlaceholder");
        document.getElementById("togglePrivacy").textContent = t("privacyButton");
        document.getElementById("maskIdsBtn").textContent = t("maskIds");
        document.getElementById("maskMessagesBtn").textContent = t("maskMessages");
        document.getElementById("maskKeywordsBtn").textContent = t("maskKeywords");
        document.getElementById("resetMasksBtn").textContent = t("resetMasks");
        document.getElementById("toggleLang").textContent   = t("langLabel");
        var isLight = document.body.classList.contains("light");
        document.getElementById("toggleTheme").textContent  = isLight ? t("darkMode") : t("lightMode");
        var delBtn = document.getElementById("toggleDelMode");
        if (delBtn) {
            var isDelMode = document.body.classList.contains("del-mode");
            delBtn.textContent = isDelMode
                ? (currentLang === 'zh' ? '✂️ 編輯中' : '✂️ Editing')
                : (currentLang === 'zh' ? '✂️ 刪除' : '✂️ Delete');
        }
        document.querySelectorAll("#timeRange option").forEach(function(opt){
            var key = "data-" + currentLang;
            if(opt.getAttribute(key)) opt.textContent = opt.getAttribute(key);
        });
        buildTypeChips();
        applyFilters();
        updateExportBtn();
    }

    document.getElementById("toggleLang").addEventListener("click", function(){
        currentLang = currentLang === "zh" ? "en" : "zh";
        applyLangUI();
    });
    document.getElementById("toggleTheme").addEventListener("click", function(){
        document.body.classList.toggle("light");
        var isLight = document.body.classList.contains("light");
        this.textContent = isLight ? t("darkMode") : t("lightMode");
    });

    var exportAfterDeleteBtn = null;

    function getOrCreateExportBtn() {
        if (exportAfterDeleteBtn) return exportAfterDeleteBtn;
        exportAfterDeleteBtn = document.createElement('button');
        exportAfterDeleteBtn.id = 'exportAfterDel';
        exportAfterDeleteBtn.addEventListener('click', function(){
            var softDeleted = Array.from(document.querySelectorAll('.chat-row.soft-deleted'));
            var positions = softDeleted.map(function(r){
                return { row: r, parent: r.parentNode, next: r.nextSibling };
            });
            var wasDelMode = document.body.classList.contains('del-mode');
            document.body.classList.remove('del-mode');
            exportAfterDeleteBtn.style.display = 'none';
            softDeleted.forEach(function(r){ r.parentNode.removeChild(r); });

            var exportRoot = document.documentElement.cloneNode(true);
            exportRoot.querySelectorAll('.chat-row.soft-deleted').forEach(function(r){ r.remove(); });
            exportRoot.querySelectorAll('.chat-row').forEach(function(r){ r.style.display = ''; });
            exportRoot.querySelectorAll('.chat-row[data-player-name]').forEach(function(r){ r.removeAttribute('data-player-name'); });
            exportRoot.querySelectorAll('.separator-row').forEach(function(r){ r.style.display = ''; });
            exportRoot.querySelectorAll('.filter-expanded').forEach(function(r){ r.classList.remove('filter-expanded'); });
            exportRoot.querySelectorAll('#contentSearch,#idFilter,#privacyIds,#privacyKeywords').forEach(function(input){ input.setAttribute('value',''); });
            var exportedPrivacyPanel = exportRoot.querySelector('#privacyPanel');
            if (exportedPrivacyPanel) exportedPrivacyPanel.classList.remove('open');
            var exportedPrivacyToggle = exportRoot.querySelector('#togglePrivacy');
            if (exportedPrivacyToggle) exportedPrivacyToggle.setAttribute('aria-expanded','false');
            var blob = new Blob(['<!DOCTYPE html>\\n' + exportRoot.outerHTML], {type:'text/html;charset=utf-8'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'edited_chatlog_' + new Date().toISOString().replace(/[:.]/g,'-') + '.html';
            a.click();
            URL.revokeObjectURL(a.href);

            positions.forEach(function(p){
                if (p.next) p.parent.insertBefore(p.row, p.next);
                else p.parent.appendChild(p.row);
            });
            if (wasDelMode) document.body.classList.add('del-mode');
            updateExportBtn();
            allChatRows = Array.from(document.querySelectorAll('.chat-row'));
            applyFilters();
        });
        var right = document.getElementById('editBtns') || document.querySelector('.row2-right');
        if (right) right.appendChild(exportAfterDeleteBtn);
        return exportAfterDeleteBtn;
    }

    function updateExportBtn() {
        var count = document.querySelectorAll('.chat-row.soft-deleted').length;
        var idCount = document.querySelectorAll('.chat-row.id-masked').length;
        var messageCount = document.querySelectorAll('.chat-row.message-masked').length;
        var keywordCount = document.querySelectorAll('.chat-row.keyword-masked').length;
        var btn = getOrCreateExportBtn();
        var label = currentLang === 'zh'
            ? '💾 二次匯出 (隱藏 ' + count + '／身分 ' + idCount + '／訊息 ' + messageCount + '／關鍵字 ' + keywordCount + ')'
            : '💾 Re-export (hidden ' + count + ' / identity ' + idCount + ' / messages ' + messageCount + ' / keywords ' + keywordCount + ')';
        btn.textContent = label;
        btn.style.display = (count + idCount + messageCount + keywordCount) > 0 ? 'inline-block' : 'none';
    }

    function selectedPrivacyIds() {
        return (document.getElementById('privacyIds').value || '').split(/[,，、;；\\s]+/)
            .map(function(id){ return id.trim().toLowerCase(); }).filter(Boolean);
    }

    function originalRowId(row) {
        if (row.__privacyOriginalId !== undefined) return row.__privacyOriginalId;
        return ((row.querySelector('.chat-id') || {}).textContent || '').trim();
    }

    function rowsForPrivacySelection() {
        var ids = selectedPrivacyIds();
        if (!ids.length) return [];
        return allChatRows.filter(function(row){ return ids.indexOf(originalRowId(row).toLowerCase()) !== -1; });
    }

    document.getElementById('maskIdsBtn').addEventListener('click', function(){
        rowsForPrivacySelection().forEach(function(row){
            var el = row.querySelector('.chat-id');
            if (!el || row.classList.contains('id-masked')) return;
            row.__privacyOriginalId = el.textContent || '';
            var contentEl = row.querySelector('.chat-content');
            if (contentEl && row.__privacyOriginalContent === undefined) row.__privacyOriginalContent = contentEl.innerHTML;
            el.textContent = t('maskedId');
            el.classList.add('privacy-masked');
            row.querySelectorAll('.user-name').forEach(function(nameEl){
                nameEl.textContent = t('maskedName');
                nameEl.classList.add('privacy-masked');
            });
            var playerName = (row.dataset.playerName || '').trim();
            if (contentEl && playerName) {
                var namePattern = new RegExp(escapeRegExp(playerName), 'gi');
                var walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
                var nameNodes = [], nameNode;
                while ((nameNode = walker.nextNode())) nameNodes.push(nameNode);
                nameNodes.forEach(function(textNode){
                    namePattern.lastIndex = 0;
                    textNode.nodeValue = textNode.nodeValue.replace(namePattern, t('maskedName'));
                });
            }
            row.classList.add('id-masked');
        });
        updateExportBtn();
        applyFilters();
    });

    function selectedPrivacyKeywords() {
        return (document.getElementById('privacyKeywords').value || '').split(/[,，、;；\\n]+/)
            .map(function(keyword){ return keyword.trim(); }).filter(Boolean);
    }

    function escapeRegExp(text) {
        var specialChars = ['\\\\','^','$','.','*','+','?','(',')','[',']','{','}','|','/'];
        return text.split('').map(function(ch){ return specialChars.indexOf(ch) >= 0 ? '\\\\' + ch : ch; }).join('');
    }

    document.getElementById('maskKeywordsBtn').addEventListener('click', function(){
        var keywords = selectedPrivacyKeywords();
        if (!keywords.length) return;
        var pattern = new RegExp(keywords.sort(function(a,b){ return b.length-a.length; }).map(escapeRegExp).join('|'), 'gi');
        allChatRows.forEach(function(row){
            var contentEl = row.querySelector('.chat-content');
            pattern.lastIndex = 0;
            if (!contentEl || row.classList.contains('message-masked') || !pattern.test(contentEl.textContent || '')) return;
            pattern.lastIndex = 0;
            if (row.__privacyOriginalContent === undefined) row.__privacyOriginalContent = contentEl.innerHTML;
            var walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT);
            var textNodes = [], node;
            while ((node = walker.nextNode())) textNodes.push(node);
            textNodes.forEach(function(textNode){
                pattern.lastIndex = 0;
                textNode.nodeValue = textNode.nodeValue.replace(pattern, t('maskedKeyword'));
            });
            row.classList.add('keyword-masked');
            row.__content = undefined;
        });
        updateExportBtn();
        applyFilters();
    });

    document.getElementById('maskMessagesBtn').addEventListener('click', function(){
        rowsForPrivacySelection().forEach(function(row){
            var el = row.querySelector('.chat-content');
            if (!el || row.classList.contains('message-masked')) return;
            row.__privacyOriginalContent = el.innerHTML;
            el.textContent = t('maskedMessage');
            el.classList.add('privacy-masked');
            row.classList.add('message-masked');
            row.__content = undefined;
        });
        updateExportBtn();
        applyFilters();
    });

    document.getElementById('resetMasksBtn').addEventListener('click', function(){
        allChatRows.forEach(function(row){
            var idEl = row.querySelector('.chat-id');
            var contentEl = row.querySelector('.chat-content');
            if (row.__privacyOriginalId !== undefined && idEl) idEl.textContent = row.__privacyOriginalId;
            if (row.__privacyOriginalContent !== undefined && contentEl) contentEl.innerHTML = row.__privacyOriginalContent;
            row.__privacyOriginalId = undefined;
            row.__privacyOriginalContent = undefined;
            row.__id = undefined;
            row.__content = undefined;
            row.classList.remove('id-masked','message-masked','keyword-masked');
            if (idEl) idEl.classList.remove('privacy-masked');
            if (contentEl) {
                contentEl.classList.remove('privacy-masked');
                contentEl.querySelectorAll('.privacy-masked').forEach(function(el){ el.classList.remove('privacy-masked'); });
            }
        });
        updateExportBtn();
        applyFilters();
    });

    document.getElementById('togglePrivacy').addEventListener('click', function(){
        var panel = document.getElementById('privacyPanel');
        var open = panel.classList.toggle('open');
        this.setAttribute('aria-expanded', String(open));
        requestAnimationFrame(updateStickyOffset);
    });

    document.getElementById('toggleDelMode').addEventListener('click', function(){
        var isDelMode = document.body.classList.toggle('del-mode');
        var zh = currentLang === 'zh';
        this.textContent = isDelMode
            ? (zh ? '✂️ 編輯中' : '✂️ Editing')
            : (zh ? '✂️ 刪除' : '✂️ Delete');
        allChatRows = Array.from(document.querySelectorAll('.chat-row'));
        applyFilters();
    });

    document.getElementById('chatlog').addEventListener('click', function(e){
        var btn = e.target.closest('.row-del');
        if (!btn) return;
        var row = btn.closest('.chat-row');
        if (!row) return;
        var isSoftDeleted = row.classList.toggle('soft-deleted');
        btn.textContent = isSoftDeleted ? '+' : '\u2715';
        updateExportBtn();
        applyFilters();
    });

    var allChatRows = Array.from(document.querySelectorAll('.chat-row'));
    var pairs = [];
    var node = document.getElementById('chatlog') ? document.getElementById('chatlog').firstElementChild : null;
    while (node) {
        if (node.classList.contains('separator-row')) {
            var next = node.nextElementSibling;
            if (next && next.classList.contains('collapsible-content')) {
                pairs.push({ sep: node, content: next });
            }
        }
        node = node.nextElementSibling;
    }

    function toggleCollapse(id) {
        var el = document.getElementById('collapse-' + id);
        if (el) {
            var collapsed = el.classList.toggle('collapsed');
            var separator = el.previousElementSibling;
            if (separator && separator.classList.contains('separator-row')) {
                separator.classList.toggle('is-collapsed', collapsed);
                var button = separator.querySelector('.collapse-button');
                if (button) button.setAttribute('aria-expanded', String(!collapsed));
            }
        }
    }
    window.toggleCollapse = toggleCollapse;

    function parseTimeString(timeStr) {
        if (!timeStr) return null;
        if (timeStr.includes('T')) return new Date(timeStr);
        var today = new Date();
        var parts = timeStr.split(':').map(Number);
        today.setHours(parts[0]||0, parts[1]||0, parts[2]||0, 0);
        return today;
    }

    function applyFilters() {
        var contentTerm = (document.getElementById('contentSearch').value || "").toLowerCase();
        var idRaw = document.getElementById('idFilter').value || "";
        var idTerms = idRaw.toLowerCase().split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        var timeRange = document.getElementById('timeRange').value;
        var hiddenTypes = TYPE_KEYS.filter(function(tp){ return !typeState[tp]; });
        var hasFilter = contentTerm || idTerms.length > 0 || timeRange || hiddenTypes.length > 0;
        var now = new Date();
        var visibleCount = 0;
        var totalActive = 0;

        allChatRows.forEach(function(row) {
            if (row.classList.contains('soft-deleted')) {
                row.style.display = '';
                return;
            }
            totalActive++;
            var visible = true;
            if (hiddenTypes.length > 0) {
                visible = hiddenTypes.indexOf(row.dataset.type || 'chat') === -1;
            }
            if (visible && contentTerm) {
                var content = row.__content;
                if (content === undefined) {
                    content = ((row.querySelector('.chat-content') || {}).textContent || "").toLowerCase();
                    row.__content = content;
                }
                visible = content.indexOf(contentTerm) !== -1;
            }
            if (visible && idTerms.length > 0) {
                var id = row.__id;
                if (id === undefined) {
                    id = ((row.querySelector('.chat-id') || {}).textContent || "").toLowerCase();
                    row.__id = id;
                }
                visible = idTerms.some(function(term){ return id.indexOf(term) !== -1; });
            }
            if (visible && timeRange) {
                var timeStr = (row.querySelector('.chat-time') || {textContent:""}).textContent || "";
                if (timeStr) {
                    try {
                        var msgTime = parseTimeString(timeStr);
                        if (msgTime) {
                            var h = (now - msgTime) / 3600000;
                            var limit = { '1h':1, '3h':3, '6h':6, '12h':12, '24h':24 }[timeRange];
                            if (limit && h > limit) visible = false;
                        }
                    } catch(e){}
                }
            }
            row.style.display = visible ? 'flex' : 'none';
            if (visible) visibleCount++;
        });

        pairs.forEach(function(pair) {
            if (!hasFilter) {
                pair.sep.style.display = '';
                pair.content.classList.remove('filter-expanded');
            } else {
                pair.content.classList.add('filter-expanded');
                var hasVisible = Array.from(pair.content.querySelectorAll('.chat-row')).some(function(r){
                    return !r.classList.contains('soft-deleted') && r.style.display !== 'none';
                });
                pair.sep.style.display = hasVisible ? '' : 'none';
            }
        });

        var stats = document.getElementById('pageStats');
        if (stats) stats.textContent = t("showing")(visibleCount, totalActive);
    }

    var filterTimer = null;
    function scheduleFilters() {
        if (filterTimer) clearTimeout(filterTimer);
        filterTimer = setTimeout(applyFilters, 150);
    }
    document.getElementById('contentSearch').addEventListener('input', scheduleFilters);
    document.getElementById('idFilter').addEventListener('input', scheduleFilters);
    document.getElementById('timeRange').addEventListener('change', applyFilters);
    document.getElementById('clearBtn').addEventListener('click', function(){
        document.getElementById('contentSearch').value = '';
        document.getElementById('idFilter').value = '';
        document.getElementById('privacyIds').value = '';
        document.getElementById('privacyKeywords').value = '';
        document.getElementById('timeRange').value = '';
        TYPE_KEYS.forEach(function(tp){ typeState[tp] = true; });
        buildTypeChips();
        applyFilters();
    });

    function updateStickyOffset() {
        var panel = document.getElementById('searchPanel');
        document.documentElement.style.setProperty('--sticky-top', ((panel ? panel.offsetHeight : 72) + 4) + 'px');
    }
    window.addEventListener('resize', updateStickyOffset);
    applyLangUI();
    requestAnimationFrame(updateStickyOffset);
})();
<\/script>
</body>
</html>
`;
    }

    // =====================================================================
    // Shared helpers
    // =====================================================================
    function toRGBA(color, alpha) {
        alpha = alpha || 0.12;
        if (!color) return "rgba(128,128,128,"+alpha+")";
        color = color.trim();
        const m = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (m) return "rgba("+m[1]+","+m[2]+","+m[3]+","+alpha+")";
        if (color[0] === "#") {
            let h = color.slice(1);
            if (h.length === 3) h = h.split("").map(c=>c+c).join("");
            if (h.length >= 6) {
                const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
                if([r,g,b].every(v=>!isNaN(v))) return "rgba("+r+","+g+","+b+","+alpha+")";
            }
        }
        return "rgba(128,128,128,"+alpha+")";
    }


    // =====================================================================
    // 訊息分類：把渲染時才推導的 emote/action/activity/… 標籤，提前到捕捉
    // 時算好並存進緩存記錄（msg.category），匯出與 HTML 過濾直接讀標籤。
    // =====================================================================
    function classifyCategory(msg) {
        const content = msg.content || "";
        const isBceNotif = msg.className && msg.className.includes('bce-notification');
        let rowType = 'chat';
        if (msg.type === 'whisper') {
            rowType = 'whisper';
        } else if (msg.type === 'beep' || msg.type === 'beep_duplicate' || isBceNotif) {
            rowType = 'beep';
        } else if (msg.className) {
            if      (msg.className.includes('ChatMessageEmote'))      rowType = 'emote';
            else if (msg.className.includes('ChatMessageActivity'))   rowType = 'activity';
            else if (msg.className.includes('ChatMessageAction'))     rowType = 'action';
            else if (msg.className.includes('ChatMessageEnterLeave')) rowType = 'enter';
            else if (msg.className.includes('LocalMessage') || msg.className.includes('NonDialogue')) rowType = 'system';
            else if (!msg.name && (content.startsWith('*') || content.startsWith('('))) rowType = 'emote';
        } else if (!msg.name && (content.startsWith('*') || content.startsWith('('))) {
            rowType = 'emote';
        }
        if (rowType === 'chat' && msg.name &&
            (content.includes("好友私聊来自") || content.includes("BEEP"))) {
            rowType = 'beep';
        }
        return rowType;
    }

    // =====================================================================
    // 深色模式文字顏色修正
    // 1. chat-with-name 分支：訊息內文包在 <span style="color:var(--text-color)"> 中
    // 2. whisper 分支：同上，確保主題切換時文字顏色正確
    // 3. 移除 .chat-content 的 enhanced-color class（filter 會干擾文字繼承色）
    // =====================================================================
    function renderMsgRow(msg, includePrivate, lastSeparatorRoomName) {
        if (!msg || msg.type === 'separator') return null;
        if (msg.content && msg.content.startsWith('˅')) return null;
        if (isFilteredMessage(msg.content, msg.type, includePrivate)) return null;
        if (lastSeparatorRoomName && msg.content.includes(lastSeparatorRoomName) &&
            msg.content.length < lastSeparatorRoomName.length + 12) return null;

        const adjustedColor = getEnhancedContrastColor(msg.color || "#888", true);
        // 舊記錄沒有 category 標籤時即時推導，維持向後相容
        const rowType = msg.category || classifyCategory(msg);

        let bgColor = toRGBA(adjustedColor, 0.12);
        let borderColor = adjustedColor;
        let content = '';

        if (rowType === 'beep') {
            bgColor = 'rgba(91,141,239,0.1)'; borderColor = '#5b8def';
            content = `<span class="beep-msg">${linkifyContent(msg.content)}</span>`;
        } else if (rowType === 'whisper') {
            if (!includePrivate) return null;
            const isOutgoing = msg.direction === 'outgoing';
            const prefix = isZh()
            ? (isOutgoing ? "悄悄话" : "悄悄话来自")
            : (isOutgoing ? "Whisper to" : "Whisper from");
            // FIX: 訊息內文加 color:var(--text-color)，避免深色模式下繼承失敗變黑字
            content = `<span style="color:var(--resolved-name);font-style:italic;">${prefix}</span> <span class="user-name" style="color:var(--resolved-name)">${escapeHtml(msg.name)}</span>: <span style="color:var(--text-color)">${linkifyContent(msg.content)}</span>`;
        } else if (rowType === 'system') {
            const sysColor = getEnhancedContrastColor('#3aa76d', true);
            bgColor = toRGBA(sysColor, 0.12); borderColor = sysColor;
            content = `<span style="color:${sysColor}">${linkifyContent(msg.content)}</span>`;
        } else if (rowType === 'chat' && msg.name) {
            // FIX: 訊息內文加 color:var(--text-color)，避免深色模式下繼承失敗變黑字
            // 特別修正：[🌐] 翻譯訊息在此分支不再出現黑字問題
            content = `<span class="user-name" style="color:var(--resolved-name)">${escapeHtml(msg.name)}</span>: <span style="color:var(--text-color)">${linkifyContent(msg.content)}</span>`;
        } else {
            content = `<span class="action-text" style="color:var(--resolved-name)">${linkifyContent(msg.content)}</span>`;
        }

        // FIX: 移除 enhanced-color class，filter:brightness 會干擾文字顏色繼承
        return `
            <div class="chat-row with-accent" data-type="${rowType}" data-player-name="${escapeHtml(msg.name || '')}" style="--row-bg:${bgColor};--row-accent:${borderColor};--name-color:${adjustedColor};">
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(msg.time || '')}</span>
                    <span class="chat-id">${escapeHtml(msg.id || '')}</span>
                </div>
                <div class="chat-content">${content}</div>
                <button class="row-del" title="Delete">&#x2715;</button>
            </div>`;
    }

    // =====================================================================
    // generateHTML — 新增跨日分隔線
    // =====================================================================
    async function generateHTML(normalizedMsgs, includePrivate, title, filename) {
        const htmlTemplate = await generateHTMLTemplate(title);
        let html = htmlTemplate;
        let collapseId = 0;
        let openCollapsible = false;
        let processedCount = 0;
        let lastSeparatorRoomName = "";
        let lastDateStr = "";

        for (const msg of normalizedMsgs) {
            if (!msg) continue;

            const msgDate = msg._dateStr || "";
            if (msgDate && msgDate !== lastDateStr) {
                html += `<div class="date-divider">📅 ${escapeHtml(msgDate)}</div>`;
                lastDateStr = msgDate;
            }

            if (msg.type === 'separator') {
                if (openCollapsible) html += `</div>`;
                const collapsedClass = (msg.expanded === false) ? 'collapsed' : '';
                html += `
            <div class="separator-row ${collapsedClass ? 'is-collapsed' : ''}">
                <button class="collapse-button" aria-expanded="${collapsedClass ? 'false' : 'true'}" onclick="toggleCollapse(${collapseId})">
                    ${escapeHtml(msg.content)}
                </button>
            </div>
            <div id="collapse-${collapseId}" class="collapsible-content ${collapsedClass}">`;
                collapseId++;
                openCollapsible = true;
                lastSeparatorRoomName = msg.roomName || "";
                processedCount++;
                continue;
            }

            const rowHTML = renderMsgRow(msg, includePrivate, lastSeparatorRoomName);
            if (!rowHTML) continue;
            lastSeparatorRoomName = "";
            html += rowHTML;
            processedCount++;
        }

        if (openCollapsible) html += `</div>`;
        html += getHTMLFooter();

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g,"-");
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${filename}_${timestamp}.html`;
            a.click();
            URL.revokeObjectURL(a.href);
            window.ChatRoomSendLocalStyled(ui('toastHTMLDone', processedCount), 3000, "#00ff00");
        } catch (e) {
            logError("generateHTML", e);
            window.ChatRoomSendLocalStyled(ui('toastHTMLFail'), 5000, "#ff0000");
        }
    }

    async function generateDBHTML(storedMessages, includePrivate) {
        window.ChatRoomSendLocalStyled(ui('toastCacheWait'), 3000, "#ffa500");
        await generateHTML(storedMessages, includePrivate, isZh() ? "緩存HTML" : "Cached Chat Log", "cached_chatlog");
    }

    async function generateChatHTML(domMessages, includePrivate) {
        const normalized = domMessages.map(el => normalizeChatMessageNode(el)).filter(Boolean);
        await generateHTML(normalized, includePrivate, isZh() ? "聊天室記錄" : "Chat Log", "chatlog");
    }


    // =====================================================================
    // Custom prompt
    // =====================================================================
    function showCustomPrompt(message, options = []) {
        return new Promise(function(resolve) {
            const modal = document.createElement("div");
            modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:2000;`;
            let buttons = '';
            if (options.length === 0) {
                const yesLabel = isZh() ? "是" : "Yes";
                const noLabel  = isZh() ? "否" : "No";
                buttons = `<button id="customPromptYes" style="margin:10px;padding:8px 16px;cursor:pointer;background:#0066cc;color:#fff;border:none;border-radius:4px;">${yesLabel}</button>
                           <button id="customPromptNo" style="margin:10px;padding:8px 16px;cursor:pointer;background:#666;color:#fff;border:none;border-radius:4px;">${noLabel}</button>`;
            } else {
                buttons = options.map(opt =>
                                      `<button data-value="${opt.value}" style="margin:5px;padding:8px 16px;cursor:pointer;background:#0066cc;color:#fff;border:none;border-radius:4px;">${opt.text}</button>`
                                     ).join('');
            }
            modal.innerHTML = `
                <div style="background:#333;color:#fff;padding:24px;border-radius:12px;max-width:500px;text-align:center;max-height:80vh;overflow-y:auto;">
                    <h3 style="margin-top:0;">${message.split('\n')[0]}</h3>
                    ${message.split('\n').slice(1).map(line=>`<p style="margin:8px 0;">${line}</p>`).join('')}
                    <div style="margin-top:20px;">${buttons}</div>
                </div>`;
            document.body.appendChild(modal);
            if (options.length === 0) {
                modal.querySelector("#customPromptYes").onclick = () => { document.body.removeChild(modal); resolve(true); };
                modal.querySelector("#customPromptNo").onclick  = () => { document.body.removeChild(modal); resolve(false); };
            } else {
                modal.querySelectorAll("button[data-value]").forEach(btn => {
                    btn.onclick = () => { document.body.removeChild(modal); resolve(btn.dataset.value); };
                });
            }
        });
    }

    // =====================================================================
    // Date selector modal
    // =====================================================================
    async function showDateSelector() {
        const availableDates = await CacheManager.getAvailableDates();

        if (availableDates.length === 0) {
            const saveCurrent = await showCustomPrompt(ui('promptNoCache'));
            if (saveCurrent) {
                const currentMessages = processCurrentMessages();
                if (currentMessages.length > 0) {
                    await CacheManager.saveToday(currentMessages);
                    window.ChatRoomSendLocalStyled(ui('toastSaved'), 3000, "#00ff00");
                }
            }
            return null;
        }

        return new Promise(resolve => {
            const modal = document.createElement("div");
            modal.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:2000;backdrop-filter:blur(5px);`;

            const dateOptions = availableDates.map(date =>
                                                   `<div class="date-option" data-value="${date.dateKey}" style="
                    position:relative;margin:8px 0;cursor:pointer;padding:12px;border-radius:8px;
                    background:linear-gradient(135deg,#2c3e50 0%,#34495e 100%);
                    border:2px solid transparent;transition:all 0.3s;color:#ecf0f1;font-weight:500;user-select:none;">
                    <span style="font-size:16px;">${date.display}</span>
                    <span style="color:#bdc3c7;margin-left:8px;">${ui('cacheMsgCount', date.count)}</span>
                </div>`
                                                  ).join('');

            modal.innerHTML = `
                <div style="background:linear-gradient(135deg,#2c3e50 0%,#34495e 100%);color:#ecf0f1;padding:30px;border-radius:16px;max-width:500px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);position:relative;">
                    <button id="closeBtn" style="position:absolute;top:15px;right:15px;background:none;border:none;color:#bdc3c7;font-size:20px;cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;">✕</button>
                    <h3 style="margin-top:0;font-size:24px;font-weight:600;text-align:center;color:#ecf0f1;margin-bottom:20px;">${ui('cacheTitle')}</h3>
                    <div style="margin:20px 0;text-align:left;">
                        <h4 style="color:#bdc3c7;margin-bottom:15px;font-size:16px;">${ui('cacheDateLabel')}</h4>
                        <div id="dateContainer" style="max-height:300px;overflow-y:auto;padding-right:8px;">${dateOptions}</div>
                    </div>
                    <div style="text-align:center;margin-top:25px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
                        <button id="selectAll" style="padding:10px 20px;background:linear-gradient(135deg,#27ae60 0%,#2ecc71 100%);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.3s;">${ui('cacheSelectAll')}</button>
                        <button id="exportBtn" style="padding:10px 20px;background:linear-gradient(135deg,#3498db 0%,#2980b9 100%);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.3s;">${ui('cacheExport')}</button>
                        <button id="deleteBtn" style="padding:10px 20px;background:linear-gradient(135deg,#e74c3c 0%,#c0392b 100%);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;transition:all 0.3s;">${ui('cacheDelete')}</button>
                    </div>
                </div>`;

            document.body.appendChild(modal);

            const dateStyle = document.createElement('style');
            dateStyle.textContent = `
                .date-option.selected{border-color:#9b59b6!important;background:linear-gradient(135deg,#8e44ad 0%,#9b59b6 100%)!important;}
                .date-option:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.2);}`;
            document.head.appendChild(dateStyle);

            const dateOptionElements = modal.querySelectorAll('.date-option');
            dateOptionElements.forEach(option => {
                option.addEventListener('click', () => option.classList.toggle('selected'));
            });

            modal.querySelector("#selectAll").onclick = () => {
                const allSelected = Array.from(dateOptionElements).every(o => o.classList.contains('selected'));
                dateOptionElements.forEach(o => { if (allSelected) o.classList.remove('selected'); else o.classList.add('selected'); });
            };
            modal.querySelector("#closeBtn").onclick = () => { document.body.removeChild(modal); dateStyle.remove(); resolve(null); };
            modal.querySelector("#exportBtn").onclick = async () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected')).map(o => o.dataset.value);
                if (selected.length === 0) { alert(ui('cacheAlertExport')); return; }
                document.body.removeChild(modal); dateStyle.remove();
                const today = CacheManager._makeKey(DateUtils.getDateKey());
                if (selected.includes(today)) {
                    const currentMessages = processCurrentMessages();
                    if (currentMessages.length > 0) { await CacheManager.saveToday(currentMessages); }
                }
                resolve({ action: 'export', dates: selected });
            };
            modal.querySelector("#deleteBtn").onclick = () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected')).map(o => o.dataset.value);
                if (selected.length === 0) { alert(ui('cacheAlertDelete')); return; }
                document.body.removeChild(modal); dateStyle.remove();
                resolve({ action: 'delete', dates: selected });
            };
        });
    }

    async function export_DB_HTML() {
        const result = await showDateSelector();
        if (!result) return;
        if (result.action === 'delete') {
            const confirmDelete = await showCustomPrompt(ui('promptDelete', result.dates.length));
            if (confirmDelete) await CacheManager.deleteDates(result.dates);
            return;
        }
        if (result.action === 'export' && result.dates.length > 0) {
            const messages = await CacheManager.getMessagesForDates(result.dates);
            if (messages.length === 0) { window.ChatRoomSendLocalStyled(ui('toastNoCacheData'), 3000, "#ffa500"); return; }
            const includePrivate = await showCustomPrompt(ui('promptPrivate'));
            await generateDBHTML(messages, includePrivate);
        }
    }

    async function exportChatAsHTML() {
        const log = DOMCache.getChatLog();
        const messages = log ? Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div")) : [];
        if (messages.length === 0) {
            window.ChatRoomSendLocalStyled(ui('toastNoMsgEx'), 3000, "#ffa500");
            return;
        }
        const includePrivate = await showCustomPrompt(ui('promptPrivate'));
        await generateChatHTML(messages, includePrivate);
    }

    async function exportHTML(fromCache = false) {
        if (fromCache) await export_DB_HTML();
        else await exportChatAsHTML();
    }

    async function exportExcel() {
        if (!window.XLSX?.utils) { window.ChatRoomSendLocalStyled(ui('toastXlsxFail'), 3000, "#ff0000"); return; }
        const messages = processCurrentMessages();
        if (messages.length === 0) { window.ChatRoomSendLocalStyled(ui('toastNoMsg'), 3000, "#ffa500"); return; }
        const includePrivate = await showCustomPrompt(ui('promptPrivate'));
        window.ChatRoomSendLocalStyled(ui('toastExcelWait'), 2000, "#ffa500");
        try {
            const data = [["Time", "ID", "Name", "Content"]];
            messages.forEach(msg => {
                if (isFilteredMessage(msg.content, msg.type, includePrivate)) return;
                data.push([msg.time||"", msg.id||"", msg.name||"", msg.content||""]);
            });
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ChatLog");
            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `chatlog_${new Date().toISOString().replace(/[:.]/g,"-")}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            window.ChatRoomSendLocalStyled(ui('toastExcelDone', data.length-1), 3000, "#00ff00");
        } catch (e) {
            logError("exportExcel", e);
            window.ChatRoomSendLocalStyled(ui('toastExcelFail'), 3000, "#ff0000");
        }
    }

    async function clearCache() {
        const confirm = await showCustomPrompt(ui('promptClear'));
        if (!confirm) return;
        try {
            const chatLog = DOMCache.getChatLog();
            if (!chatLog) { window.ChatRoomSendLocalStyled(ui('toastClearFail'), 3000, "#ff0000"); return; }
            const nodes = Array.from(chatLog.children);
            let lastRoomNode = null;
            for (let i = nodes.length-1; i >= 0; i--) {
                if (nodes[i].classList.contains("chat-room-sep") || nodes[i].classList.contains("chat-room-sep-last") || nodes[i].classList.contains("chat-room-sep-div")) {
                    lastRoomNode = nodes[i]; break;
                }
            }
            chatLog.innerHTML = "";
            if (lastRoomNode) chatLog.appendChild(lastRoomNode);
            window.ChatRoomSendLocalStyled(ui('toastCleared'), 3000, "#00ff00");
        } catch (e) {
            logError("clearCache", e);
            window.ChatRoomSendLocalStyled(ui('toastClearErr'), 3000, "#ff0000");
        }
    }


    // =====================================================================
    // Message normalization (shared by full-scan and incremental capture)
    // =====================================================================
    function restrictedMessageText() {
        return isZh() ? "[訊息遭限制（未顯示）]" : "[Message restricted (not displayed)]";
    }

    function normalizeChatMessageNode(msg) {
        try {
            if (msg.classList?.contains("chat-room-sep-div")) {
                const button = msg.querySelector(".chat-room-sep-header");
                const roomName = button?.dataset?.room || "";
                const iconDiv = button?.querySelector(".chat-room-sep-image");
                const iconText = iconDiv ? (iconDiv.querySelector("span")?.innerText || "") : "";
                const collapseBtn = msg.querySelector(".chat-room-sep-collapse");
                const expanded = collapseBtn ? collapseBtn.getAttribute("aria-expanded") === "true" : true;
                const sepText = `˅${iconText ? iconText + " - " : ""}${roomName}`.trim();
                return { time: new Date().toISOString(), id: "", name: "", content: sepText, msgid: `sep_${roomName}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, type: "separator", roomName, color: "#8100E7", expanded, _ts: Date.now(), _uid: crypto.randomUUID?.() || `sep_${Date.now()}_${Math.random()}` };
            }
            if (msg.matches?.("a.beep-link")) return null;
            if (!msg.dataset) return null;

            const rawTime = msg.dataset.time || "";
            const normalizedTime = normalizeTime(rawTime);
            const senderId = msg.dataset.sender || "";
            const nameButton = msg.querySelector(".ChatMessageName");
            const senderName = nameButton ? (nameButton.innerText || nameButton.textContent || "").trim() : "";
            const msgidAttr = msg.querySelector("span[msgid]")?.getAttribute("msgid") || "";

            const direction = msg.classList.contains("ChatMessageWhisper")
            ? (msg.dataset.target ? 'outgoing' : 'incoming')
            : undefined;

            let content = "";
            const isBceNotif = msg.classList.contains("bce-notification") || !!msg.querySelector('.bce-beep-link');
            const contentSpan = msg.querySelector(".chat-room-message-content");
            const originContentSpan = msg.querySelector(".chat-room-message-original");

            if (isBceNotif) {
                const beepLink = msg.querySelector('.bce-beep-link');
                content = beepLink ? (beepLink.textContent || beepLink.innerText || "").trim() : "";
            } else if (contentSpan) {
                const _clone = contentSpan.cloneNode(true);
                _clone.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());
                _clone.querySelectorAll('img[src]').forEach(img => {
                    img.replaceWith(document.createTextNode(img.getAttribute('src') || img.getAttribute('alt') || ''));
                });
                content = (_clone.textContent || _clone.innerText || "").trim();
                if (originContentSpan) {
                    const originContent = (originContentSpan.textContent || originContentSpan.innerText || "").trim();
                    content = content + '\n' + originContent;
                }
            } else {
                const clone = msg.cloneNode(true);
                clone.querySelectorAll('.chat-room-message-popup, .chat-room-metadata, .ChatMessageName, .chat-room-message-original').forEach(el => el.remove());
                clone.querySelectorAll('img[src]').forEach(img => { img.replaceWith(document.createTextNode(img.getAttribute('src') || img.getAttribute('alt') || '')); });
                content = (clone.textContent || clone.innerText || "").trim();
            }
            if (content === '[🌐]' || content.startsWith('[🌐] ')) {
                const originalText = msg.getAttribute('bce-original-text');
                if (originalText && !originalText.startsWith('[🌐]') && originalText.trim()) {
                    content = `${originalText} [🌐] ${content.replace(/^\[🌐\]\s*/, '')}`;
                }
            }
            // BCX 或 BC 的限制可能保留訊息外框、但不提供任何可見內文。
            // 不繞過限制保存原句，改為留下明確標記，避免匯出時出現無法解釋的空白紀錄。
            if (msg.dataset.cheRestrictedMessage === "1") content = restrictedMessageText();

            const messageType = detectMessageType(msg, content);
            const labelColor = getLabelColor(msg, nameButton);
            const className = Array.from(msg.classList||[]).join(" ");
            const record = { time: normalizedTime, id: senderId, name: senderName, content, direction, msgid: msgidAttr, type: messageType, color: labelColor, className, roomName: window.ChatRoomData?.Name || "", _ts: Date.now(), _uid: crypto.randomUUID?.() || `${Date.now()}_${Math.random()}` };
            record.category = classifyCategory(record);
            return record;
        } catch (e) {
            logError("normalizeChatMessageNode", e);
            return null;
        }
    }

    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];
        messages.forEach(msg => {
            const normalized = normalizeChatMessageNode(msg);
            if (normalized) processedMessages.push(normalized);
        });
        return processedMessages;
    }

    // 新增的 DOM 訊息會立刻轉成純資料並接到寫入鏈；每筆訊息各自成為
    // IndexedDB messages store 的一個 record。
    let recordWriteChain = Promise.resolve();
    let lastHookRoom = null;
    let captureObserver = null;
    let observedChatLog = null;
    let captureRootTimer = null;
    let captureReconcileTick = 0;
    const capturedNodes = new WeakSet();

    function queueRecord(record) {
        if (!record || currentMode !== "cache") return;
        const date = DateUtils.getDateKey();
        recordWriteChain = recordWriteChain
            .then(() => CacheManager.saveForDate([record], date))
            .catch(e => { logError("queueRecord", e); });
    }

    function flushRecordQueue() { return recordWriteChain; }

    function queueHookedNode(node) {
        if (!(node instanceof HTMLElement) || currentMode !== "cache") return;
        if (capturedNodes.has(node)) return;
        const record = normalizeChatMessageNode(node);
        if (!record) return;
        capturedNodes.add(node);
        const roomName = record.roomName || window.ChatRoomData?.Name || "";
        if (record.type !== "separator" && roomName && roomName !== lastHookRoom) {
            lastHookRoom = roomName;
            queueRecord({ time:new Date().toISOString(), id:"", name:"", content:`⌄ ${roomName}`,
                type:"separator", roomName, color:"#8100E7", expanded:true, _ts:Math.max(0, record._ts - 1),
                _uid:crypto.randomUUID?.() || `room_${Date.now()}_${Math.random()}` });
        }
        queueRecord(record);
    }

    function captureAddedTree(node) {
        if (!(node instanceof HTMLElement) || currentMode !== "cache") return;
        if (node.matches?.(".ChatMessage, .chat-room-sep-div")) queueHookedNode(node);
        node.querySelectorAll?.(".ChatMessage, .chat-room-sep-div").forEach(queueHookedNode);
    }

    function captureExistingMessages() {
        if (currentMode !== "cache") return;
        DOMCache.getMessages().forEach(queueHookedNode);
    }

    function connectCaptureObserver() {
        const chatLog = DOMCache.getChatLog();
        if (!chatLog || !document.contains(chatLog)) return false;
        if (captureObserver && observedChatLog === chatLog) return true;
        if (captureObserver) captureObserver.disconnect();
        observedChatLog = chatLog;
        captureObserver = new MutationObserver(mutations => {
            if (currentMode !== "cache") return;
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => captureAddedTree(node)));
        });
        captureObserver.observe(chatLog, { childList:true, subtree:true });
        captureExistingMessages();
        return true;
    }

    function startCaptureObserver() {
        connectCaptureObserver();
        if (!captureRootTimer) {
            captureRootTimer = setInterval(() => {
                try {
                    const previousRoot = observedChatLog;
                    const connected = connectCaptureObserver();
                    if (connected && currentMode === "cache" && previousRoot !== observedChatLog) captureExistingMessages();
                    // 低頻補掃只處理 WeakSet 尚未見過的節點，作為 observer 漏接時的保險。
                    if (connected && currentMode === "cache" && ++captureReconcileTick >= 30) {
                        captureReconcileTick = 0;
                        captureExistingMessages();
                    }
                } catch (e) { logError("captureObserver.reconnect", e); }
            }, 1000);
        }
        if (currentMode === "cache") captureExistingMessages();
    }

    function installCaptureHooks() {
        if (!modApi) return;
        // BCX 的接收限制可能直接中止 ChatRoomMessage，因而完全不建立 DOM；另一些
        // 感官/審查限制則只建立空白外框。包住整條 hook chain，比較呼叫前後的最後
        // 節點：正常訊息仍交給 DOM 正規化；沒有可見節點時留下「遭限制」紀錄。
        if (typeof window.ChatRoomMessage === "function") {
            modApi.hookFunction("ChatRoomMessage", 20, (args, next) => {
                if (currentMode !== "cache") return next(args);
                const data = args[0];
                const recordable = data && ["Chat", "Whisper", "Emote"].includes(data.Type)
                    && typeof data.Sender === "number" && typeof data.Content === "string";
                if (!recordable) return next(args);

                const log = DOMCache.getChatLog();
                const before = log?.lastElementChild;
                const result = next(args);
                const node = DOMCache.getChatLog()?.lastElementChild;
                if (node && node !== before && node.matches?.(".ChatMessage")) {
                    const body = node.querySelector(".chat-room-message-content");
                    const visibleBody = body
                        ? (body.innerText || body.textContent || "").trim()
                        : (() => {
                            const clone = node.cloneNode(true);
                            clone.querySelectorAll(".ChatMessageName,.chat-room-message-popup,.chat-room-metadata").forEach(el => el.remove());
                            return (clone.innerText || clone.textContent || "").trim();
                        })();
                    if (!visibleBody) node.dataset.cheRestrictedMessage = "1";
                    queueHookedNode(node);
                } else {
                    const sender = window.ChatRoomCharacter?.find?.(character => character?.MemberNumber === data.Sender);
                    const direction = data.Type === "Whisper"
                        ? (data.Sender === window.Player?.MemberNumber ? "outgoing" : "incoming")
                        : undefined;
                    const record = {
                        time: new Date().toISOString(), id: String(data.Sender),
                        name: sender ? (window.CharacterNickname?.(sender) || sender.Name || "") : "",
                        content: restrictedMessageText(), direction,
                        msgid: "", type: data.Type === "Whisper" ? "whisper" : data.Type === "Emote" ? "emote" : "normal",
                        color: sender?.LabelColor || "#000", className: "ChatMessage che-restricted-message",
                        roomName: window.ChatRoomData?.Name || "", _ts: Date.now(),
                        _uid: crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`,
                    };
                    record.category = classifyCategory(record);
                    queueRecord(record);
                }
                return result;
            });
        }

        // ServerAccountBeep 不經 ChatRoomMessage，保留獨立補強。
        if (typeof window.ServerAccountBeep === "function") {
            modApi.hookFunction("ServerAccountBeep", 20, (args, next) => {
                const log = DOMCache.getChatLog();
                const before = log?.lastElementChild;
                const result = next(args);
                const node = DOMCache.getChatLog()?.lastElementChild;
                if (node && node !== before) {
                    try { queueHookedNode(node); } catch (e) { logError("hook.ServerAccountBeep", e); }
                }
                return result;
            });
        }
    }

    // =====================================================================
    // CHE Settings (localStorage)
    // =====================================================================
    const CHE_SETTINGS_KEY = "che_settings_v1";
    let cheSettings = { showBall: true, cacheEnabled: true, mode: "stopped", onboarded: false };

    function loadCHESettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(CHE_SETTINGS_KEY) || "{}");
            const legacyMode = localStorage.getItem("chatlogger_mode");
            const legacyOnboarded = localStorage.getItem("che_onboarded_v1") === "1";
            cheSettings = Object.assign({ showBall: true, cacheEnabled: true, mode: "stopped", onboarded: false }, saved);
            if (saved.mode === undefined && legacyMode === "cache") cheSettings.mode = "cache";
            if (saved.onboarded === undefined && legacyOnboarded) cheSettings.onboarded = true;
            // v2.6 起 localStorage 僅保留這一份設定；清掉舊模式、導覽旗標與聊天碎片備份。
            localStorage.removeItem("chatlogger_mode");
            localStorage.removeItem("che_onboarded_v1");
            localStorage.removeItem("fragment_count");
            localStorage.removeItem("message_count_since_last_save");
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key?.startsWith("che_temp_data_")) localStorage.removeItem(key);
            }
            currentMode = cheSettings.mode === "cache" ? "cache" : "stopped";
            if (!cheSettings.cacheEnabled && currentMode === "cache") {
                currentMode = "stopped";
                cheSettings.mode = "stopped";
            }
            localStorage.setItem(CHE_SETTINGS_KEY, JSON.stringify(cheSettings));
        } catch {}
    }

    function saveCHESettings() {
        cheSettings.mode = currentMode;
        localStorage.setItem(CHE_SETTINGS_KEY, JSON.stringify(cheSettings));
    }

    function applyBallVisibility() {
        const el = document.querySelector("#chatlogger-container");
        if (!el) return;
        el.style.display = cheSettings.showBall ? "" : "none";
    }

    // =====================================================================
    // Extension Settings Screen (BC Preference panel)
    // =====================================================================
    function waitForPreference() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof PreferenceRegisterExtensionSetting === "function" && typeof TranslationLanguage !== "undefined") resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    const EXT_SCREEN = {
        CB: 64,
        Y: {
            back:    75,
            help:    75,
            title:  105,
            secL:   180,
            secR:   180,
            cb1:    220,
            cb2:    310,
            btn1:   220,
            btn2:   310,
            btn3:   400,
            divider:500,
            desc1:  545,
            desc2:  595,
            desc3:  645,
        },
        LC: 650,
        RC: 1350,
        LCB_X: 460,

        load() {},

        run() {
            const zh = isZh();
            const T = {
                title:    zh ? "書記官設定  v" + MOD_VER : "CHE Settings  v" + MOD_VER,
                back:     zh ? "返回" : "Back",
                helpTip:  zh ? "顯示說明" : "Show guide",
                secL:     zh ? "── 顯示 ──"  : "── Display ──",
                secR:     zh ? "── 匯出 ──"  : "── Export ──",
                showBall: zh ? "顯示浮懸球"  : "Show floating ball",
                cacheOn:  zh ? "啟用緩存"    : "Enable cache",
                btnHTML:  zh ? "匯出成 HTML" : "Export HTML",
                btnExcel: zh ? "匯出成 Excel": "Export Excel",
                btnCache: zh ? "緩存管理"    : "Cache manager",
                desc1: zh
                ? "氣球顯示與否不影響緩存，緩存設定為獨立開關"
                : "Ball visibility does not affect caching — they are independent",
                desc2: zh
                ? "緩存資料存於 IndexedDB，超過 7 天自動清除，停用後不再記錄新訊息（現有資料保留）"
                : "Cache is stored in IndexedDB, auto-cleaned after 7 days. Disabling stops new recording; existing data is kept.",
                desc3: zh
                ? "HTML 匯出支援搜尋、過濾、類型分類及逐行刪除等便利功能"
                : "HTML export supports search, filtering, type categories, and per-row deletion",
            };

            const y = this.Y; const cb = this.CB;
            const lc = this.LC; const rc = this.RC; const lx = this.LCB_X;
            const btnW = 380; const btnH = 64;

            DrawButton(1815, y.back, 90, 90, "", "White", "Icons/Exit.png", T.back);
            DrawButton(1710, y.help, 90, 90, "", "White", gameAsset("Icons/Question.png"), T.helpTip);
            DrawText(T.title, 1000, y.title, "Black", "White");
            DrawText(T.secL, lc, y.secL, "Black", "White");
            DrawCheckbox(lx, y.cb1, cb, cb, "", cheSettings.showBall);
            DrawCheckbox(lx, y.cb2, cb, cb, "", cheSettings.cacheEnabled);
            const prev = MainCanvas.textAlign;
            MainCanvas.textAlign = "left";
            DrawTextFit(T.showBall, lx + cb + 12, y.cb1 + cb/2 + 10, 420, "Black", "White");
            DrawTextFit(T.cacheOn,  lx + cb + 12, y.cb2 + cb/2 + 10, 420,
                        cheSettings.cacheEnabled ? "Black" : "White");
            MainCanvas.textAlign = prev;
            DrawText(T.secR, rc, y.secR, "Black", "White");
            const bx = rc - btnW/2;
            DrawButton(bx, y.btn1, btnW, btnH, T.btnHTML,  "White", "", "");
            DrawButton(bx, y.btn2, btnW, btnH, T.btnExcel, "White", "", "");
            DrawButton(bx, y.btn3, btnW, btnH, T.btnCache, "White", "", "");
            DrawRect(395, y.divider, 1215, 2, "rgba(255,255,255,0.1)");
            DrawText(T.desc1, 1000, y.desc1, "Black", "White");
            DrawText(T.desc2, 1000, y.desc2, "Black", "White");
            DrawText(T.desc3, 1000, y.desc3, "Black", "White");
        },

        click() {
            const y = this.Y; const cb = this.CB;
            const lx = this.LCB_X; const rc = this.RC;
            const btnW = 380; const btnH = 64;

            if (MouseIn(1815, y.back, 90, 90)) {
                if (typeof PreferenceExit === "function") PreferenceExit(); return;
            }
            if (MouseIn(1710, y.help, 90, 90)) { showHelpPopup(); return; }
            if (MouseIn(lx, y.cb1, cb, cb)) {
                cheSettings.showBall = !cheSettings.showBall;
                saveCHESettings(); applyBallVisibility(); return;
            }
            if (MouseIn(lx, y.cb2, cb, cb)) {
                cheSettings.cacheEnabled = !cheSettings.cacheEnabled;
                saveCHESettings();
                if (cheSettings.cacheEnabled) {
                    currentMode = "cache";
                    startCaptureObserver();
                } else {
                    currentMode = "stopped";
                    flushRecordQueue();
                }
                saveCHESettings();
                if (window.updateCHEModeBtn) window.updateCHEModeBtn();
                return;
            }

            const bx = rc - btnW/2;
            if (MouseIn(bx, y.btn1, btnW, btnH)) { exportChatAsHTML(); return; }
            if (MouseIn(bx, y.btn2, btnW, btnH)) { exportExcel();      return; }
            if (MouseIn(bx, y.btn3, btnW, btnH)) { export_DB_HTML();   return; }
        },

        unload() {},
        exit() {}
    };

    // =====================================================================
    // Onboarding
    // =====================================================================
    function showOnboarding() {
        if (cheSettings.onboarded) return;
        const zh = isZh();

        const overlay = document.createElement("div");
        overlay.id = "che-onboarding";
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:99999;
            background:rgba(0,0,0,0.72);backdrop-filter:blur(4px);
            display:flex;align-items:center;justify-content:center;
            font-family:'Noto Sans TC',sans-serif;
        `;

        const card = document.createElement("div");
        card.style.cssText = `
            background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);
            border-radius:18px;padding:30px 36px;max-width:420px;width:90%;
            box-shadow:0 24px 60px rgba(0,0,0,0.5);color:#eee;position:relative;
            user-select:none;-webkit-user-select:none;
        `;

        const lines = zh ? [
            ["💾", "點擊浮懸球展開工具列"],
            ["📥", "匯出當前聊天記錄為 HTML 或 Excel"],
            ["🗄️", "緩存最多 7 天記錄，隨時匯出"],
            ["🗑️", "可清除聊天室畫面（不影響緩存）"],
            ["⚙️", "浮懸球可隱藏，並在拓展設定頁重新顯示"],
        ] : [
            ["💾", "Click the floating ball to open the toolbar"],
            ["📥", "Export current chat as HTML or Excel"],
            ["🗄️", "Cache up to 7 days of logs for later export"],
            ["🗑️", "Clear the chat view (cache is unaffected)"],
            ["⚙️", "The ball can be hidden / re-shown in Extension Settings"],
        ];

        const title = zh ? "🐈‍⬛ 聊天室書記官說明 🐈‍⬛" : "🐈‍⬛ Chat History Exporter illustrate 🐈‍⬛";
        const btnText = zh ? "了解了，開始使用！" : "Got it, let's go!";

        card.innerHTML = `
            <h3 style="margin:0 0 16px;font-size:17px;color:#C4B5FD;">${title}</h3>
            ${lines.map(([icon, text]) => `
                <div style="display:flex;align-items:center;gap:12px;margin:10px 0;">
                    <span style="font-size:20px;flex-shrink:0;">${icon}</span>
                    <span style="font-size:13px;color:#d4c8f5;">${text}</span>
                </div>`).join('')}
            <button id="che-onboard-close" style="
                margin-top:20px;width:100%;padding:11px;border:none;border-radius:10px;
                background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;
                font-size:14px;cursor:pointer;font-family:inherit;font-weight:600;
            ">${btnText}</button>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        const ball = document.querySelector("#chatlogger-container button");
        if (ball) {
            ball.style.animation = "che-pulse 1s ease-in-out infinite";
            const st = document.createElement("style");
            st.id = "che-pulse-style";
            st.textContent = "@keyframes che-pulse{0%,100%{transform:scale(1);}50%{transform:scale(1.18);}}";
            document.head.appendChild(st);
        }

        card.querySelector("#che-onboard-close").onclick = () => {
            overlay.remove();
            cheSettings.onboarded = true;
            saveCHESettings();
            if (ball) ball.style.animation = "";
            document.getElementById("che-pulse-style")?.remove();
        };
    }

    function showHelpPopup() {
        cheSettings.onboarded = false;
        saveCHESettings();
        showOnboarding();
    }

    // =====================================================================
    // addUI
    // =====================================================================
    function addUI() {
        const existingContainer = document.querySelector("#chatlogger-container");
        if (existingContainer) existingContainer.remove();

        const container = document.createElement("div");
        container.id = "chatlogger-container";
        container.style.cssText = `position:fixed;bottom:20px;left:20px;z-index:1000;`;

        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "💾";
        toggleButton.style.cssText = `width:60px;height:60px;cursor:pointer;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;opacity:0.5;box-shadow:0 8px 32px rgba(102,126,234,0.4);transition:all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);font-size:24px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(10px);user-select:none;`;
        toggleButton.title = ui('tooltipTitle');

        let currentBaseColor = "#95a5a6";
        let currentShadowColor = "rgba(149,165,166,0.4)";

        toggleButton.onmouseover = () => { toggleButton.style.opacity="1"; toggleButton.style.transform="scale(1.1) rotate(5deg)"; toggleButton.style.boxShadow=`0 12px 48px ${currentShadowColor}`; };
        toggleButton.onmouseout  = () => { toggleButton.style.opacity="0.5"; toggleButton.style.transform="scale(1) rotate(0deg)"; toggleButton.style.background=currentBaseColor; toggleButton.style.boxShadow=`0 8px 32px ${currentShadowColor}`; };

        function updateButtonColors(mode) {
            if (mode === "cache") { currentBaseColor="#644CB0"; currentShadowColor="rgba(100,76,176,0.4)"; }
            else { currentBaseColor="#95a5a6"; currentShadowColor="rgba(149,165,166,0.4)"; }
            toggleButton.style.background = currentBaseColor;
            toggleButton.style.boxShadow = `0 8px 32px ${currentShadowColor}`;
        }

        const toolbar = document.createElement("div");
        toolbar.id = "chatlogger-toolbar";
        toolbar.style.cssText = `display:none;position:absolute;bottom:70px;left:0;background:linear-gradient(135deg,rgba(44,62,80,0.95) 0%,rgba(52,73,94,0.95) 100%);backdrop-filter:blur(15px);padding:15px;border-radius:12px;box-shadow:0 15px 35px rgba(0,0,0,0.3);flex-direction:column;gap:10px;min-width:180px;border:1px solid rgba(255,255,255,0.1);user-select:none;`;

        const createButton = (label, handler, gradient) => {
            gradient = gradient || "linear-gradient(135deg,#667eea 0%,#764ba2 100%)";
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.style.cssText = `padding:10px 15px;font-size:14px;text-align:left;font-weight:600;background:${gradient};color:#fff;border:none;border-radius:8px;cursor:pointer;transition:all 0.3s;white-space:nowrap;box-shadow:0 4px 15px rgba(0,0,0,0.2);user-select:none;`;
            btn.onmouseover = () => { btn.style.transform='translateY(-2px) scale(1.02)'; btn.style.boxShadow='0 8px 25px rgba(0,0,0,0.3)'; };
            btn.onmouseout  = () => { btn.style.transform='translateY(0) scale(1)'; btn.style.boxShadow='0 4px 15px rgba(0,0,0,0.2)'; };
            btn.onclick = () => { handler(); };
            return btn;
        };

        const btnHTML  = createButton(ui('btnHTML'),  () => exportHTML(false), "linear-gradient(135deg,#3498db 0%,#2980b9 100%)");
        const btnExcel = createButton(ui('btnExcel'), exportExcel,             "linear-gradient(135deg,#27ae60 0%,#2ecc71 100%)");
        const btnClear = createButton(ui('btnClear'), clearCache,              "linear-gradient(135deg,#e74c3c 0%,#c0392b 100%)");
        const btnCache = createButton(ui('btnCache'), export_DB_HTML,          "linear-gradient(135deg,#f39c12 0%,#e67e22 100%)");

        const btnHide = document.createElement("button");
        btnHide.textContent = isZh() ? "⚙️ 隱藏氣球" : "⚙️ Hide ball";
        btnHide.style.cssText = `padding:10px 15px;font-size:14px;text-align:left;font-weight:600;background:rgba(100,100,100,0.2);color:#aaa;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;transition:all 0.3s;white-space:nowrap;user-select:none;`;
        btnHide.onmouseover = () => { btnHide.style.background='rgba(231,76,60,0.15)'; btnHide.style.color='#e74c3c'; };
        btnHide.onmouseout  = () => { btnHide.style.background='rgba(100,100,100,0.2)'; btnHide.style.color='#aaa'; };
        btnHide.onclick = () => {
            cheSettings.showBall = false;
            saveCHESettings();
            applyBallVisibility();
        };

        const btnMode  = document.createElement("button");
        btnMode.style.cssText = `padding:10px 15px;font-size:14px;text-align:left;font-weight:600;border:none;border-radius:8px;cursor:pointer;transition:all 0.3s;white-space:nowrap;box-shadow:0 4px 15px rgba(0,0,0,0.2);user-select:none;color:#fff;`;
        btnMode.onmouseover = () => { btnMode.style.transform='translateY(-2px) scale(1.02)'; };
        btnMode.onmouseout  = () => { btnMode.style.transform='translateY(0) scale(1)'; };
        btnMode.onclick = () => { toggleMode(btnMode); updateButtonColors(currentMode); };

        function updateModeButton(btn) {
            if (currentMode === "cache") {
                btn.textContent = ui('btnModeCache');
                btn.style.background = "linear-gradient(135deg,#644CB0 0%,#552B90 100%)";
            } else {
                btn.textContent = ui('btnModeStopped');
                btn.style.background = "linear-gradient(135deg,#95a5a6 0%,#7f8c8d 100%)";
            }
        }
        updateModeButton(btnMode);
        window.updateCHEModeBtn = () => updateModeButton(btnMode);

        [btnHTML, btnExcel, btnClear, btnCache, btnMode, btnHide].forEach(btn => toolbar.appendChild(btn));

        const ballRow = document.createElement("div");
        ballRow.style.cssText = "display:flex;align-items:center;gap:8px;";

        const questionBtn = document.createElement("button");
        questionBtn.title = isZh() ? "顯示說明" : "Show guide";
        const qImg = document.createElement("img");
        qImg.src = gameAsset("Icons/Question.png");
        qImg.style.cssText = "width:28px;height:28px;pointer-events:none;";
        questionBtn.style.cssText = "width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.2s,background 0.2s;padding:0;flex-shrink:0;";
        questionBtn.appendChild(qImg);
        questionBtn.onmouseover = () => { questionBtn.style.opacity="1"; questionBtn.style.background="rgba(127,83,205,0.3)"; };
        questionBtn.onmouseout  = () => { questionBtn.style.opacity="0.7"; questionBtn.style.background="rgba(255,255,255,0.1)"; };
        questionBtn.onclick = (e) => { e.stopPropagation(); toolbar.style.display="none"; showHelpPopup(); };

        questionBtn.style.display = "none";

        ballRow.appendChild(toggleButton);
        ballRow.appendChild(questionBtn);

        container.appendChild(toolbar);
        container.appendChild(ballRow);
        document.body.appendChild(container);

        applyBallVisibility();

        toggleButton.onclick = (e) => {
            e.stopPropagation();
            const isVisible = toolbar.style.display === "flex";
            toolbar.style.display = isVisible ? "none" : "flex";
            questionBtn.style.display = isVisible ? "none" : "flex";
        };
        document.addEventListener("click", (e) => {
            if (!container.contains(e.target) && toolbar.style.display === "flex") {
                toolbar.style.display = "none";
                questionBtn.style.display = "none";
            }
        });

        updateButtonColors(currentMode);
        window.updateCHEButtonColors = updateButtonColors;
    }

    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "cache";
            startCaptureObserver();
        } else {
            currentMode = "stopped";
            flushRecordQueue();
        }
        saveCHESettings();
        if (currentMode === "cache") {
            btn.textContent = ui('btnModeCache');
            btn.style.background = "linear-gradient(135deg,#644CB0 0%,#552B90 100%)";
        } else {
            btn.textContent = ui('btnModeStopped');
            btn.style.background = "linear-gradient(135deg,#95a5a6 0%,#7f8c8d 100%)";
        }
        if (window.updateCHEButtonColors) window.updateCHEButtonColors(currentMode);
    }

    // =====================================================================
    // Init
    // =====================================================================
    function waitForLogin() {
        if (window.Player?.MemberNumber !== undefined) return Promise.resolve();
        return new Promise(resolve => {
            const remove = modApi.hookFunction("LoginResponse", 0, (args, next) => {
                const result = next(args);
                queueMicrotask(() => {
                    if (window.Player?.MemberNumber === undefined) return;
                    remove(); resolve();
                });
                return result;
            });
        });
    }

    async function init() {
        try {
            loadCHESettings();
            await loadToastSystem();
            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko - CHE",
                    fullName: "Chat History Exporter",
                    version: MOD_VER,
                    repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
                });
            }

            await waitForLogin();
            installCaptureHooks();
            startCaptureObserver();
            console.log(`🐈‍⬛ [CHE] ✅ v${MOD_VER} loaded`);
            await cleanupLegacyV1Database();
            // init() 會先把 v2 daily_fragments 遷移到 v3 records；完成後才依 _dateStr
            // 清除超過七天的資料，因此舊 v2 資料也受相同七日保留規則約束。
            CacheManager.cleanOldData().catch(e => logError("init.cleanOldData", e));
            addUI();
            setTimeout(showOnboarding, 800);

            waitForPreference().then(() => {
                PreferenceRegisterExtensionSetting({
                    Identifier: "CHE",
                    ButtonText: ui('prefButton'),
                    Image: gameAsset("Icons/Changelog.png"),
                    load:   () => EXT_SCREEN.load(),
                    run:    () => EXT_SCREEN.run(),
                    click:  () => EXT_SCREEN.click(),
                    unload: () => EXT_SCREEN.unload(),
                    exit:   () => EXT_SCREEN.exit(),
                });
            });
        } catch (e) {
            logError("init", e);
            window.ChatRoomSendLocalStyled?.(ui('toastInitFail'), 3000, "#ff0000");
        }
    }

    init();
})();
