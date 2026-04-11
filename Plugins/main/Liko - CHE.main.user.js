// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      2.4.0
// @description  聊天室紀錄匯出 | Chat History Export
// @author       莉柯莉絲(likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==
(function() {
    "use strict";

    let modApi;
    const modversion = "2.4.0";
    let currentMessageCount = 0;
    const AUTO_SAVE_INTERVAL = 5 * 60 * 1000;
    let autoSaveTimer = null;
    let lastSaveTime = Date.now();
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped";

    let messageObserver = null;
    let observerActive = false;

    window.cheErrorCount = 0;
    function logError(location, error) {
        window.cheErrorCount++;
        console.error(`[CHE-${window.cheErrorCount}] ${location}:`, error);
    }

    // =====================================================================
    // Language Detection
    // =====================================================================
    function isZh() {
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            return l === 'cn' || l === 'tw';
        }
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    // =====================================================================
    // Dynamic game asset URL (version-safe)
    // =====================================================================
    function gameAsset(path) {
        const m = window.location.href.match(/(https?:\/\/[^/]+\/R\d+\/BondageClub\/)/);
        return m ? m[1] + path : path;
    }

    // =====================================================================
    // UI i18n — plugin side (has game context)
    // =====================================================================
    const UI = {
        zh: {
            // Buttons
            btnHTML:         "📥 HTML匯出",
            btnExcel:        "📥 Excel匯出",
            btnClear:        "🗑️ 清除聊天室",
            btnCache:        "💾 緩存管理",
            btnModeCache:    "💾 緩存中",
            btnModeStopped:  "⏸️ 停用",
            tooltipTitle:    "聊天室記錄管理器 v2.4",
            // Prompts
            promptPrivate:   "請問是否保存包含\n悄悄話(whisper)與私信(beep)的信息?",
            promptClear:     "確定要清空當前聊天室的訊息嗎？\n（緩存數據庫不會被清空）",
            promptNoCache:   "沒有緩存數據。是否保存當前聊天室的訊息？",
            promptDelete:    n => `確定要刪除 ${n} 個日期的數據嗎？`,
            // Cache modal
            cacheTitle:      "💾 緩存管理",
            cacheDateLabel:  "選擇要操作的日期：",
            cacheSelectAll:  "✓ 全選",
            cacheExport:     "📤 匯出",
            cacheDelete:     "🗑️ 刪除",
            cacheAlertExport:"請選擇要匯出的日期",
            cacheAlertDelete:"請選擇要刪除的日期",
            cacheMsgCount:   n => `(${n} 條訊息)`,
            // Toasts
            toastXlsxFail:   "[CHE] ❌ XLSX庫未載入",
            toastNoMsg:      "[CHE] ❗ 沒有訊息可匯出",
            toastExcelWait:  "[CHE] 💾 正在生成Excel，請稍候...",
            toastExcelDone:  n => `[CHE] ✅ Excel匯出完成！${n} 條訊息`,
            toastExcelFail:  "[CHE] ❌ Excel匯出失敗",
            toastClearFail:  "[CHE] ❌ 找不到聊天室容器",
            toastCleared:    "[CHE] 🗑️ 當前聊天室已清空！",
            toastClearErr:   "[CHE] ❌ 清空失敗",
            toastHTMLWait:   "[CHE] 💾 正在匯出HTML，請稍候...",
            toastHTMLDone:   n => `[CHE] ✅ HTML匯出完成，${n} 條訊息`,
            toastHTMLFail:   "[CHE] ❌ HTML匯出失敗，請重試",
            toastCacheWait:  "[CHE] 💾 正在匯出緩存HTML，請稍候...",
            toastCacheDone:  n => `[CHE] ✅ 緩存HTML匯出完成，${n} 條訊息`,
            toastCacheFail:  "[CHE] ❌ 緩存HTML匯出失敗",
            toastNoContainer:"[CHE] ❌ 找不到聊天室容器或無訊息可匯出",
            toastNoMsgEx:    "[CHE] ❌ 沒有訊息可匯出",
            toastSaveFail:   "[CHE] ❌ 緩存保存失敗",
            toastDeleteN:    n => `[CHE] ✅ 已刪除 ${n} 個日期的數據`,
            toastDeleteNone: "[CHE] ❗ 沒有數據被刪除",
            toastDeleteFail: "[CHE] ❌ 刪除操作失敗",
            toastSaved:      "[CHE] ✅ 已保存當前訊息到緩存",
            toastNoCacheData:"[CHE] ❗ 選中日期沒有數據",
            toastAutoFail:   "[CHE] ❌ 自動保存失敗",
            toastRestore:    n => `[CHE] ✅ 恢復了 ${n} 條未保存的訊息`,
            toastRestoreFail:"[CHE] ❌ 恢復數據保存失敗",
            toastInitFail:   "[CHE] ❌ 初始化失敗",
            toastNotLoaded:  "❌ 聊天室尚未載入",
        },
        en: {
            btnHTML:         "📥 Export HTML",
            btnExcel:        "📥 Export Excel",
            btnClear:        "🗑️ Clear Chat",
            btnCache:        "💾 Cache Manager",
            btnModeCache:    "💾 Caching",
            btnModeStopped:  "⏸️ Stopped",
            tooltipTitle:    "Chat History Export v2.4",
            promptPrivate:   "Include whisper and beep messages in export?",
            promptClear:     "Clear current chat log?\n(Cache database will not be cleared)",
            promptNoCache:   "No cached data. Save current chat messages?",
            promptDelete:    n => `Delete data for ${n} date(s)?`,
            cacheTitle:      "💾 Cache Manager",
            cacheDateLabel:  "Select dates to manage:",
            cacheSelectAll:  "✓ Select All",
            cacheExport:     "📤 Export",
            cacheDelete:     "🗑️ Delete",
            cacheAlertExport:"Please select dates to export",
            cacheAlertDelete:"Please select dates to delete",
            cacheMsgCount:   n => `(${n} messages)`,
            toastXlsxFail:   "[CHE] ❌ XLSX library not loaded",
            toastNoMsg:      "[CHE] ❗ No messages to export",
            toastExcelWait:  "[CHE] 💾 Generating Excel, please wait...",
            toastExcelDone:  n => `[CHE] ✅ Excel export complete! ${n} messages`,
            toastExcelFail:  "[CHE] ❌ Excel export failed",
            toastClearFail:  "[CHE] ❌ Chat log container not found",
            toastCleared:    "[CHE] 🗑️ Chat log cleared!",
            toastClearErr:   "[CHE] ❌ Clear failed",
            toastHTMLWait:   "[CHE] 💾 Exporting HTML, please wait...",
            toastHTMLDone:   n => `[CHE] ✅ HTML export complete, ${n} messages`,
            toastHTMLFail:   "[CHE] ❌ HTML export failed, please retry",
            toastCacheWait:  "[CHE] 💾 Exporting cached HTML, please wait...",
            toastCacheDone:  n => `[CHE] ✅ Cache HTML export complete, ${n} messages`,
            toastCacheFail:  "[CHE] ❌ Cache HTML export failed",
            toastNoContainer:"[CHE] ❌ Chat log not found or no messages",
            toastNoMsgEx:    "[CHE] ❌ No messages to export",
            toastSaveFail:   "[CHE] ❌ Cache save failed",
            toastDeleteN:    n => `[CHE] ✅ Deleted ${n} date(s)`,
            toastDeleteNone: "[CHE] ❗ No data was deleted",
            toastDeleteFail: "[CHE] ❌ Delete operation failed",
            toastSaved:      "[CHE] ✅ Current messages saved to cache",
            toastNoCacheData:"[CHE] ❗ No data for selected dates",
            toastAutoFail:   "[CHE] ❌ Auto-save failed",
            toastRestore:    n => `[CHE] ✅ Restored ${n} unsaved messages`,
            toastRestoreFail:"[CHE] ❌ Failed to save restored data",
            toastInitFail:   "[CHE] ❌ Initialization failed",
            toastNotLoaded:  "❌ Chat room not loaded yet",
        }
    };

    function ui(key, ...args) {
        const table = isZh() ? UI.zh : UI.en;
        const val = table[key];
        if (typeof val === 'function') return val(...args);
        return val !== undefined ? val : key;
    }

    // =====================================================================
    // FIX 1: 多帳號隔離
    // =====================================================================
    function getAccountPrefix() {
        return String(window.Player?.MemberNumber || "0");
    }

    // =====================================================================
    // FIX 2: 時間正規化
    // =====================================================================
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
            } catch (e) {
                logError("DOMCache.getChatLog", e);
                this.chatLog = null;
                return null;
            }
        },
        getMessages() {
            try {
                const log = this.getChatLog();
                if (!log) return [];
                return Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
            } catch (e) { logError("DOMCache.getMessages", e); return []; }
        },
        getMessageCount() {
            try {
                const log = this.getChatLog();
                if (!log) return 0;
                return log.querySelectorAll(".ChatMessage, a.beep-link").length;
            } catch (e) { logError("DOMCache.getMessageCount", e); return 0; }
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
        },
        isToday(dateKey) {
            try { return dateKey === this.getDateKey(); } catch (e) { return false; }
        },
        getDaysAgo(days) {
            try {
                const date = new Date();
                date.setDate(date.getDate() - days);
                return this.getDateKey(date);
            } catch (e) { return this.getDateKey(); }
        },
        formatTimeForDisplay(date) {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "—";
            try {
                return date.toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } catch (e) {
                const h = String(date.getHours()).padStart(2,'0');
                const m = String(date.getMinutes()).padStart(2,'0');
                const s = String(date.getSeconds()).padStart(2,'0');
                return `${h}:${m}:${s}`;
            }
        }
    };

    // =====================================================================
    // CacheManager
    // =====================================================================
    const CacheManager = {
        async init() {
            const request = indexedDB.open("ChatLoggerV2", 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains("fragments")) db.deleteObjectStore("fragments");
                if (!db.objectStoreNames.contains("daily_fragments")) db.createObjectStore("daily_fragments");
            };
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => { logError("CacheManager.init", "IndexedDB init failed"); reject("IndexedDB init failed"); };
            });
        },
        _makeKey(dateStr) { return `${getAccountPrefix()}_${dateStr}`; },
        async saveToday(messages) {
            if (!messages || messages.length === 0) return;
            try {
                const db = await this.init();
                const fullKey = this._makeKey(DateUtils.getDateKey());
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");
                const existing = await new Promise((resolve, reject) => {
                    const req = store.get(fullKey);
                    req.onsuccess = () => resolve(req.result ? req.result.messages : []);
                    req.onerror = () => reject(req.error);
                });
                const existingKeys = new Set();
                existing.forEach(msg => {
                    const key = msg.msgid || `${msg.time}-${msg.id}-${(msg.content||"").substring(0,50)}`;
                    existingKeys.add(key);
                });
                const newMessages = messages.filter(msg => {
                    const key = msg.msgid || `${msg.time}-${msg.id}-${(msg.content||"").substring(0,50)}`;
                    return !existingKeys.has(key);
                });
                if (newMessages.length === 0) return 0;
                const allMessages = [...existing, ...newMessages];
                await new Promise((resolve, reject) => {
                    const req = store.put({ messages: allMessages, count: allMessages.length, lastUpdate: Date.now() }, fullKey);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error("Transaction aborted"));
                });
                return allMessages.length;
            } catch (e) {
                logError("CacheManager.saveToday", e);
                window.ChatRoomSendLocalStyled(ui('toastSaveFail'), 3000, "#ff0000");
                throw e;
            }
        },
        async getAvailableDates() {
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                const prefix = getAccountPrefix() + "_";
                const myKeys = keys.filter(k => k.startsWith(prefix));
                const result = [];
                for (const key of myKeys) {
                    const data = await new Promise((resolve, reject) => {
                        const req = store.get(key);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (data) {
                        const dateStr = key.slice(prefix.length);
                        result.push({ dateKey: key, count: data.count || 0, display: DateUtils.getDisplayDate(dateStr) });
                    }
                }
                return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
            } catch (e) { logError("CacheManager.getAvailableDates", e); return []; }
        },
        async getMessagesForDates(dateKeys) {
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");
                let allMessages = [];
                for (const dateKey of dateKeys) {
                    const data = await new Promise((resolve, reject) => {
                        const req = store.get(dateKey);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (data && data.messages) {
                        allMessages.push(...data.messages.map(msg => ({ ...msg, isFromCache: true })));
                    }
                }
                allMessages.sort((a, b) => {
                    const tA = new Date(a.time || "1970-01-01").getTime();
                    const tB = new Date(b.time || "1970-01-01").getTime();
                    return tA - tB;
                });
                return allMessages;
            } catch (e) { logError("CacheManager.getMessagesForDates", e); return []; }
        },
        async deleteDates(dateKeys) {
            if (!dateKeys || dateKeys.length === 0) return false;
            try {
                const db = await this.init();
                let successCount = 0;
                for (const dateKey of dateKeys) {
                    try {
                        const tx = db.transaction(["daily_fragments"], "readwrite");
                        const store = tx.objectStore("daily_fragments");
                        await new Promise(resolve => {
                            const req = store.delete(dateKey);
                            req.onsuccess = () => { successCount++; resolve(); };
                            req.onerror = () => resolve();
                        });
                        await new Promise(resolve => {
                            tx.oncomplete = () => resolve();
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
            const prefix = getAccountPrefix() + "_";
            const cutoffKey = prefix + cutoffDate;
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
                const keysToDelete = keys.filter(key => key.startsWith(prefix) && key < cutoffKey);
                for (const key of keysToDelete) {
                    await new Promise((resolve, reject) => {
                        const req = store.delete(key);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                    });
                }
            } catch (e) { logError("CacheManager.cleanOldData", e); }
        }
    };

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

        // Detect beep/whisper by content pattern as fallback for old cached data
        // where type may have been stored as "normal" before detectMessageType was fixed
        const isBceBeepContent = /^\(Beep (to|from)\b/i.test(content);
        const isSystemBeep = content.includes("好友私聊来自") ||
            content.includes("好友私聊") ||
            /\bBEEP\b/.test(content);

        // System beep (好友私聊来自 / BEEP keyword): always hide regardless of setting
        if (isSystemBeep) return true;

        const effectiveType = (messageType === "beep" || isBceBeepContent) ? "beep"
            : messageType;

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
                if (content.includes("好友私聊来自") || content.includes("BEEP")) {
                    if (content.includes("↩️") && !(msg.matches && msg.matches("a.beep-link"))) return "beep_duplicate";
                    return "beep";
                }
                if (content.includes("悄悄话") || content.includes("悄悄話")) return "whisper";
            }
            return "normal";
        } catch (e) { logError("detectMessageType", e); return "normal"; }
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
            // Strip internal anchor suffixes like "(#beep-1)", "(#anchor-3)" etc.
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
        if (!cleanColor.startsWith('#') || cleanColor.length !== 7) return cleanColor;
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
        } catch { return cleanColor; }
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

    function parseDBContent(msg) {
        const content = (msg.content || "").trim();
        const name = msg.name || "";
        if (!content) return { isSkip: true };
        if (content.startsWith('˅') || msg.type === 'separator') {
            const roomText = content.startsWith('˅') ? content.substring(1).trim() : content;
            return { isRoom: true, content: roomText, displayContent: content };
        }
        if (name) {
            if (content.startsWith('*') || content.startsWith('(')) return { isAction: true, displayContent: content };
            return { isUser: true, userName: name, userMessage: content, displayContent: content };
        }
        let cleanContent = content;
        const timeMatchOld = cleanContent.match(/^(\d{2}:\d{2}:\d{2})/);
        if (timeMatchOld) cleanContent = cleanContent.substring(timeMatchOld[1].length).trim();
        if (msg.id && cleanContent.startsWith(msg.id)) cleanContent = cleanContent.substring(msg.id.length).trim();
        cleanContent = cleanContent.replace(/\d{2}:\d{2}(?::\d{2})?\d+Reply?\s*$/i, '').trim();
        if (cleanContent.startsWith('˅')) return { isSkip: true };
        if (cleanContent.startsWith('*') || cleanContent.startsWith('(')) return { isAction: true, displayContent: cleanContent };
        const colonMatch = cleanContent.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/);
        if (colonMatch) {
            const potentialName = colonMatch[1].trim();
            const looksLikeTime = /^[\d]+$/.test(potentialName) || /[上下]午/.test(potentialName) || /^\d{1,2}$/.test(potentialName);
            if (!looksLikeTime) return { isUser: true, userName: potentialName, userMessage: colonMatch[2].trim(), displayContent: cleanContent };
        }
        return { isNormal: true, displayContent: cleanContent };
    }

    // =====================================================================
    // HTML Template — bilingual with embedded language toggle
    // =====================================================================
    async function generateHTMLTemplate(title) {
        // Detect language at export time for default
        const defaultLang = isZh() ? 'zh' : 'en';

        return `
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
:root {
    --bg-color:#111; --text-color:#eee; --muted-text:#aaa; --border-color:#444;
    --input-bg:#222; --input-border:#666; --button-bg:#444; --button-text:#fff;
    --separator-bg:rgba(129,0,231,0.2); --separator-border:#8100E7;
    --beep-color:#ff6b6b; --beep-bg:rgba(255,107,107,0.12);
    --accent:#7F53CD;
}
body.light {
    --bg-color:#fff; --text-color:#333; --muted-text:#666; --border-color:#ddd;
    --input-bg:#fff; --input-border:#ccc; --button-bg:#f0f0f0; --button-text:#333;
    --separator-bg:rgba(129,0,231,0.08); --separator-border:#8100E7;
    --beep-color:#d63031; --beep-bg:rgba(214,48,49,0.1);
}
body { font-family:sans-serif; background:var(--bg-color); color:var(--text-color); margin:0; padding:0; transition:all 0.3s; }
.chat-row { display:flex; align-items:flex-start; margin:2px 0; padding:2px 6px; border-radius:6px; }
.chat-meta { display:flex; flex-direction:column; align-items:flex-end; width:70px; font-size:0.8em; margin-right:8px; flex-shrink:0; }
.chat-time { color:var(--muted-text); }
.chat-id { font-weight:bold; }
.chat-content { flex:1; white-space:pre-wrap; word-wrap:break-word; }
.with-accent { border-left:4px solid transparent; }
.separator-row { background:var(--separator-bg); border-left:4px solid var(--separator-border); text-align:center; font-weight:bold; padding:8px; margin:4px 0; border-radius:8px; transition:opacity 0.2s; }
.separator-row.filter-hidden { display:none !important; }
.collapse-button { background:none; border:none; color:inherit; font-size:16px; cursor:pointer; padding:6px 10px; border-radius:4px; }
.collapse-button:hover { background:rgba(255,255,255,0.1); }
body.light .collapse-button:hover { background:rgba(0,0,0,0.08); }
.collapsible-content { display:block; }
.collapsible-content.collapsed { display:none; }
.collapsible-content.filter-expanded { display:block !important; }
#topbar { position:fixed; top:10px; right:10px; display:flex; gap:8px; z-index:1001; }
#topbar button {
    padding:8px 14px; border:none; border-radius:6px; cursor:pointer;
    font-weight:bold; box-shadow:0 2px 8px rgba(0,0,0,0.3);
    font-size:13px; transition:all 0.2s;
}
#toggleTheme { background:#fff; color:#000; }
body.light #toggleTheme { background:#333; color:#fff; }
#toggleLang { background:var(--accent); color:#fff; }
#searchPanel {
    position:sticky; top:0; background:var(--bg-color); padding:12px;
    border-bottom:1px solid var(--border-color); backdrop-filter:blur(10px); z-index:100;
}
#searchPanel .row1 { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
#searchPanel input, #searchPanel select {
    padding:6px 10px; border-radius:6px; border:1px solid var(--input-border);
    background:var(--input-bg); color:var(--text-color); font-size:14px;
}
#contentSearch { width:200px; }
#idFilter { width:200px; }
#clearBtn { padding:6px 12px; border-radius:6px; border:none; background:var(--button-bg); color:var(--button-text); cursor:pointer; font-size:14px; }
.type-filters { display:flex; gap:5px; flex-wrap:wrap; align-items:center; }
.type-chip {
    display:inline-flex; align-items:center; gap:4px;
    padding:3px 9px; border-radius:20px; font-size:11px; cursor:pointer;
    border:1px solid var(--border-color); color:var(--muted-text);
    transition:all 0.18s; user-select:none; background:transparent; white-space:nowrap;
}
.type-chip input[type=checkbox]{ display:none; }
.type-chip.active { border-color:var(--accent); color:var(--text-color); background:rgba(127,83,205,0.15); }
#pageStats { text-align:center; padding:10px; font-size:12px; color:var(--muted-text); position:sticky; bottom:0; background:var(--bg-color); border-top:1px solid var(--border-color); }
.user-name { font-weight:bold; }
.action-text { font-style:italic; opacity:0.9; }
.beep-msg { color:#5b8def; font-weight:bold; }
.enhanced-color { filter:brightness(1.2) saturate(1.1); }
body.light .enhanced-color { filter:brightness(0.8) saturate(1.2); }
/* Delete mode */
.chat-row { position:relative; }
.row-del {
    display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%);
    background:rgba(231,76,60,0.15); border:1px solid rgba(231,76,60,0.3); color:#e74c3c;
    border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:12px;
    line-height:1; padding:0; transition:all 0.15s; flex-shrink:0;
}
.row-del:hover { background:rgba(231,76,60,0.35); }
body.del-mode .row-del { display:flex; align-items:center; justify-content:center; }
body.del-mode .chat-row { padding-right:32px; }
/* Soft-delete row */
.chat-row.soft-deleted { display:none; }
body.del-mode .chat-row.soft-deleted {
    display:flex; opacity:0.38;
    background:rgba(231,76,60,0.07) !important;
    border-left-color:#e74c3c !important;
}
body.del-mode .chat-row.soft-deleted .row-del {
    background:rgba(46,204,113,0.2); color:#2ecc71; border-color:rgba(46,204,113,0.4);
}
/* row2 layout: chips centered, edit buttons at end */
.row2 { display:flex; align-items:center; margin-top:6px; gap:0; }
.row2-center { flex:1; display:flex; justify-content:center; flex-wrap:wrap; gap:5px; }
.row2-right  { display:flex; gap:6px; align-items:center; margin-left:auto; padding-left:16px; flex-shrink:0; }
/* Delete-mode toggle */
#toggleDelMode {
    padding:4px 10px; border-radius:20px; border:1px solid rgba(231,76,60,0.4);
    background:rgba(231,76,60,0.12); color:#e74c3c; cursor:pointer;
    font-size:12px; font-weight:600; white-space:nowrap;
}
body.del-mode #toggleDelMode { background:rgba(231,76,60,0.35); color:#fff; }
/* Export-after-edit button (injected into row2-right by JS, shown/hidden via inline style) */
#exportAfterDel {
    padding:4px 10px; border-radius:20px; border:none;
    background:var(--accent); color:#fff; cursor:pointer;
    font-size:12px; font-weight:600; white-space:nowrap;
}
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
            <button id="toggleDelMode">✂️</button>
            <!-- #exportAfterDel injected here by JS -->
        </div>
    </div>
</div>
<div id="chatlog">
`;
    }

    // =====================================================================
    // HTML Footer — bilingual JS + separator fix
    // =====================================================================
    function getHTMLFooter(defaultLang) {
        const def = (defaultLang || (isZh() ? 'zh' : 'en'));
        return `
</div>
<div id="pageStats"></div>
<script>
(function(){
    // ── i18n ──
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
            typeSystem:   "⚙ 系統"
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
            typeSystem:   "⚙ System"
        }
    };
    var currentLang = "${def}";
    function t(key){ return LANG[currentLang][key]; }

    // ── Type chip state ──
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
        document.getElementById("toggleLang").textContent   = t("langLabel");
        var isLight = document.body.classList.contains("light");
        document.getElementById("toggleTheme").textContent  = isLight ? t("darkMode") : t("lightMode");
        // Sync del-mode button text
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

    // ── Delete mode (soft-delete: rows are greyed, not removed; X toggles to +) ──
    var exportAfterDeleteBtn = null;

    // Inject export button into row2-left (after del toggle btn)
    function getOrCreateExportBtn() {
        if (exportAfterDeleteBtn) return exportAfterDeleteBtn;
        exportAfterDeleteBtn = document.createElement('button');
        exportAfterDeleteBtn.id = 'exportAfterDel';
        exportAfterDeleteBtn.addEventListener('click', function(){
            // Before serializing: temporarily remove soft-deleted rows from DOM
            var softDeleted = Array.from(document.querySelectorAll('.chat-row.soft-deleted'));
            var positions = softDeleted.map(function(r){
                return { row: r, parent: r.parentNode, next: r.nextSibling };
            });
            var wasDelMode = document.body.classList.contains('del-mode');
            document.body.classList.remove('del-mode');   // no del-mode in exported file
            exportAfterDeleteBtn.style.display = 'none';  // hide this btn in export
            softDeleted.forEach(function(r){ r.parentNode.removeChild(r); });

            var blob = new Blob([document.documentElement.outerHTML], {type:'text/html;charset=utf-8'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'edited_chatlog_' + new Date().toISOString().replace(/[:.]/g,'-') + '.html';
            a.click();
            URL.revokeObjectURL(a.href);

            // Restore DOM
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
        var btn = getOrCreateExportBtn();
        var label = currentLang === 'zh'
            ? '💾 匯出 (' + count + ' 筆隱藏)'
            : '💾 Export (' + count + ' hidden)';
        btn.textContent = label;
        btn.style.display = count > 0 ? 'inline-block' : 'none';
    }

    document.getElementById('toggleDelMode').addEventListener('click', function(){
        var isDelMode = document.body.classList.toggle('del-mode');
        var zh = currentLang === 'zh';
        this.textContent = isDelMode
            ? (zh ? '✂️ 編輯中' : '✂️ Editing')
            : (zh ? '✂️ 刪除' : '✂️ Delete');
        allChatRows = Array.from(document.querySelectorAll('.chat-row'));
        applyFilters();
    });

    // Delegate: click ✕ → soft-delete (grey + mark), click ＋ → restore
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

    // ── Build separator↔collapsible pairs ──
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
        if (el) el.classList.toggle('collapsed');
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

        // ── Filter message rows (soft-deleted rows skipped — CSS handles visibility) ──
        allChatRows.forEach(function(row) {
            if (row.classList.contains('soft-deleted')) {
                row.style.display = '';  // let CSS control (.soft-deleted / body.del-mode)
                return;
            }
            totalActive++;
            var visible = true;
            if (hiddenTypes.length > 0) {
                visible = hiddenTypes.indexOf(row.dataset.type || 'chat') === -1;
            }
            if (visible && contentTerm) {
                var content = (row.querySelector('.chat-content') || {textContent:""}).textContent.toLowerCase();
                visible = content.includes(contentTerm);
            }
            if (visible && idTerms.length > 0) {
                var id = ((row.querySelector('.chat-id') || {textContent:""}).textContent || "").toLowerCase();
                visible = idTerms.some(function(term){ return id.includes(term); });
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

        // ── Smart separator: show only sections with visible non-soft-deleted rows ──
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

    document.getElementById('contentSearch').addEventListener('input', applyFilters);
    document.getElementById('idFilter').addEventListener('input', applyFilters);
    document.getElementById('timeRange').addEventListener('change', applyFilters);
    document.getElementById('clearBtn').addEventListener('click', function(){
        document.getElementById('contentSearch').value = '';
        document.getElementById('idFilter').value = '';
        document.getElementById('timeRange').value = '';
        TYPE_KEYS.forEach(function(tp){ typeState[tp] = true; });
        buildTypeChips();
        applyFilters();
    });

    applyLangUI();
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

    // Convert a live DOM element -> normalized stored-format object
    function normalizeDOMMsg(el) {
        try {
            if (el.classList?.contains("chat-room-sep-div")) {
                const button = el.querySelector(".chat-room-sep-header");
                const roomName = button?.dataset?.room || "";
                const iconDiv = button?.querySelector(".chat-room-sep-image");
                const iconText = iconDiv ? (iconDiv.querySelector("span")?.innerText || "") : "";
                const collapseBtn = el.querySelector(".chat-room-sep-collapse");
                const isExpanded = collapseBtn && collapseBtn.getAttribute("aria-expanded") === "true";
                const label = `${isExpanded ? "\u25bc" : ">"} ${iconText ? iconText + " - " : ""}${roomName}`.trim();
                return { type: 'separator', roomName, content: label, expanded: isExpanded };
            }
            if (el.matches?.("a.beep-link")) return null;
            if (!el.dataset) return null;

            const time       = normalizeTime(el.dataset.time || "");
            const id         = el.dataset.sender || "";
            const nameButton = el.querySelector(".ChatMessageName");
            const name       = nameButton ? (nameButton.innerText || nameButton.textContent || "").trim() : "";
            const direction  = el.classList.contains("ChatMessageWhisper")
                ? (el.dataset.target ? 'outgoing' : 'incoming') : undefined;
            const isBceNotif = el.classList.contains("bce-notification") || !!el.querySelector('.bce-beep-link');

            let content = "";
            if (isBceNotif) {
                const beepLink = el.querySelector('.bce-beep-link');
                content = beepLink ? (beepLink.textContent || "").trim() : "";
            } else {
                const contentSpan       = el.querySelector(".chat-room-message-content");
                const originContentSpan = el.querySelector(".chat-room-message-original");
                if (contentSpan) {
                    content = (contentSpan.textContent || "").trim();
                    if (originContentSpan) content += '\n' + (originContentSpan.textContent || "").trim();
                } else {
                    const clone = el.cloneNode(true);
                    clone.querySelectorAll('.chat-room-message-popup, .chat-room-metadata, .ChatMessageName, .chat-room-message-original').forEach(e => e.remove());
                    clone.querySelectorAll('img[src]').forEach(img => img.replaceWith(document.createTextNode(img.getAttribute('src') || img.getAttribute('alt') || '')));
                    content = extractFullTextContent(clone).trim();
                }
                const orig = el.getAttribute('bce-original-text');
                if ((content === '[🌐]' || content.startsWith('[🌐] ')) && orig && !orig.startsWith('[🌐]') && orig.trim())
                    content = `${orig} [🌐] ${content.replace(/^\[🌐\]\s*/, '')}`;
            }

            const type      = detectMessageType(el, content);
            const color     = getLabelColor(el, nameButton);
            const className = Array.from(el.classList || []).join(" ");
            // Skip stray separator-marker messages (˅ prefix = room separator text leaked into ChatMessage)
            if (content.startsWith('˅')) return null;
            return { time, id, name, content, direction, type, color, className };
        } catch (e) {
            logError("normalizeDOMMsg", e);
            return null;
        }
    }

    // Unified row renderer - works on any normalized msg object
    // Returns HTML string or null if this row should be skipped
    function renderMsgRow(msg, includePrivate, lastSeparatorText) {
        if (!msg || msg.type === 'separator') return null;
        // Skip stray separator-marker content (˅ = room-change placeholder leaked into regular message)
        if (msg.content && msg.content.startsWith('˅')) return null;
        if (isFilteredMessage(msg.content, msg.type, includePrivate)) return null;
        // Only filter the first message right after a separator if it literally duplicates the room name
        // (BC sometimes emits a local announcement immediately after the sep div)
        // Limit this to short content to avoid over-filtering chat messages that happen to mention the room
        if (lastSeparatorText && msg.content.includes(lastSeparatorText) &&
            msg.content.length < lastSeparatorText.length + 12) return null;

        const adjustedColor = getEnhancedContrastColor(msg.color || "#888", true);
        const isBceNotif    = msg.className && msg.className.includes('bce-notification');

        // Determine rowType from stored type + className
        let rowType = 'chat';
        if (msg.type === 'whisper') {
            rowType = 'whisper';
        } else if (msg.type === 'beep' || isBceNotif) {
            rowType = 'beep';
        } else if (msg.className) {
            if      (msg.className.includes('ChatMessageEmote'))      rowType = 'emote';
            else if (msg.className.includes('ChatMessageActivity'))   rowType = 'activity';
            else if (msg.className.includes('ChatMessageAction'))     rowType = 'action';
            else if (msg.className.includes('ChatMessageEnterLeave')) rowType = 'enter';
            else if (msg.className.includes('LocalMessage') || msg.className.includes('NonDialogue')) rowType = 'system';
            else if (!msg.name && (msg.content.startsWith('*') || msg.content.startsWith('('))) rowType = 'emote';
        } else if (!msg.name && (msg.content.startsWith('*') || msg.content.startsWith('('))) {
            rowType = 'emote';
        }

        // Also catch system beep buried in chat messages
        if (rowType === 'chat' && msg.name &&
            (msg.content.includes("好友私聊来自") || msg.content.includes("BEEP"))) {
            rowType = 'beep';
        }

        let bgColor = toRGBA(adjustedColor, 0.12);
        let borderColor = adjustedColor;
        let content = '';

        if (rowType === 'beep') {
            bgColor = 'rgba(91,141,239,0.1)'; borderColor = '#5b8def';
            content = `<span class="beep-msg">${escapeHtml(msg.content)}</span>`;
        } else if (rowType === 'whisper') {
            if (!includePrivate) return null;
            const isOutgoing = msg.direction === 'outgoing';
            const prefix = isZh()
                ? (isOutgoing ? "悄悄话" : "悄悄话来自")
                : (isOutgoing ? "Whisper to" : "Whisper from");
            content = `<span style="color:${adjustedColor};font-style:italic;">${prefix}</span> <span class="user-name" style="color:${adjustedColor}">${escapeHtml(msg.name)}</span>: ${escapeHtml(msg.content)}`;
        } else if (rowType === 'system') {
            const sysColor = getEnhancedContrastColor('#3aa76d', true);
            bgColor = toRGBA(sysColor, 0.12); borderColor = sysColor;
            content = `<span style="color:${sysColor}">${escapeHtml(msg.content)}</span>`;
        } else if (rowType === 'chat' && msg.name) {
            content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(msg.name)}</span>: ${escapeHtml(msg.content)}`;
        } else {
            // emote / action / activity / enter / nameless chat
            content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(msg.content)}</span>`;
        }

        return `
            <div class="chat-row with-accent" data-type="${rowType}" style="background:${bgColor};border-left-color:${borderColor};">
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(msg.time || '')}</span>
                    <span class="chat-id">${escapeHtml(msg.id || '')}</span>
                </div>
                <div class="chat-content enhanced-color">${content}</div>
                <button class="row-del" title="Delete">&#x2715;</button>
            </div>`;
    }

    // Unified HTML generator - both cache and live export use this
    async function generateHTML(normalizedMsgs, includePrivate, title, filename) {
        const htmlTemplate = await generateHTMLTemplate(title);
        let html = htmlTemplate;
        let collapseId = 0;
        let openCollapsible = false;
        let processedCount = 0;
        let lastSeparatorText = "";

        for (const msg of normalizedMsgs) {
            if (!msg) continue;
            if (msg.type === 'separator') {
                if (openCollapsible) html += `</div>`;
                const collapsedClass = (msg.expanded === false) ? 'collapsed' : '';
                html += `
            <div class="separator-row">
                <button class="collapse-button" onclick="toggleCollapse(${collapseId})">
                    ${escapeHtml(msg.content)}
                </button>
            </div>
            <div id="collapse-${collapseId}" class="collapsible-content ${collapsedClass}">`;
                collapseId++;
                openCollapsible = true;
                lastSeparatorText = msg.roomName || msg.content;
                processedCount++;
                continue;
            }
            const rowHTML = renderMsgRow(msg, includePrivate, lastSeparatorText);
            if (!rowHTML) continue;
            // Reset after the first successful message so we don't keep filtering
            lastSeparatorText = "";
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

    // Cache export: stored objects -> unified renderer
    async function generateDBHTML(storedMessages, includePrivate) {
        window.ChatRoomSendLocalStyled(ui('toastCacheWait'), 3000, "#ffa500");
        await generateHTML(storedMessages, includePrivate, isZh() ? "緩存HTML" : "Cached Chat Log", "cached_chatlog");
    }

    // Live export: DOM elements -> normalize -> unified renderer
    async function generateChatHTML(domMessages, includePrivate) {
        const normalized = domMessages.map(el => normalizeDOMMsg(el)).filter(Boolean);
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
                    currentMessageCount = 0;
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
                    if (currentMessages.length > 0) { await CacheManager.saveToday(currentMessages); currentMessageCount = 0; }
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
            currentMessageCount = 0;
            window.ChatRoomSendLocalStyled(ui('toastCleared'), 3000, "#00ff00");
        } catch (e) {
            logError("clearCache", e);
            window.ChatRoomSendLocalStyled(ui('toastClearErr'), 3000, "#ff0000");
        }
    }

    // =====================================================================
    // processCurrentMessages
    // =====================================================================
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];
        messages.forEach(msg => {
            try {
                if (msg.classList?.contains("chat-room-sep-div")) {
                    const button = msg.querySelector(".chat-room-sep-header");
                    const roomName = button?.dataset?.room || "";
                    const iconDiv = button?.querySelector(".chat-room-sep-image");
                    const iconText = iconDiv ? (iconDiv.querySelector("span")?.innerText || "") : "";
                    const sepText = `˅${iconText ? iconText + " - " : ""}${roomName}`.trim();
                    processedMessages.push({ time: new Date().toISOString(), id: "", name: "", content: sepText, msgid: `sep_${roomName}_${Date.now()}`, type: "separator", color: "#8100E7" });
                    return;
                }
                if (msg.matches?.("a.beep-link")) return;
                if (!msg.dataset) return;

                const rawTime = msg.dataset.time || "";
                const normalizedTime = normalizeTime(rawTime);
                const senderId = msg.dataset.sender || "";
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton ? (nameButton.innerText || nameButton.textContent || "").trim() : "";
                const msgidAttr = msg.querySelector("span[msgid]")?.getAttribute("msgid") || "";

                // Whisper direction (for prefix in export)
                const direction = msg.classList.contains("ChatMessageWhisper")
                    ? (msg.dataset.target ? 'outgoing' : 'incoming')
                    : undefined;

                let content = "";
                let originContent = "";
                const isBceNotif = msg.classList.contains("bce-notification") || !!msg.querySelector('.bce-beep-link');
                const contentSpan = msg.querySelector(".chat-room-message-content");
                const originContentSpan = msg.querySelector(".chat-room-message-original");

                if (isBceNotif) {
                    // Extract text from the beep link element directly — avoids #anchor suffix
                    const beepLink = msg.querySelector('.bce-beep-link');
                    content = beepLink ? (beepLink.textContent || beepLink.innerText || "").trim() : "";
                } else if (contentSpan) {
                    content = (contentSpan.textContent || contentSpan.innerText || "").trim();
                    if (originContentSpan) {
                        originContent = (originContentSpan.textContent || originContentSpan.innerText || "").trim();
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

                const messageType = detectMessageType(msg, content);
                const labelColor = getLabelColor(msg, nameButton);
                processedMessages.push({ time: normalizedTime, id: senderId, name: senderName, content, direction, msgid: msgidAttr, type: messageType, color: labelColor, className: Array.from(msg.classList||[]).join(" ") });
            } catch (e) { logError("processCurrentMessages", e); }
        });
        return processedMessages;
    }

    // =====================================================================
    // Observer
    // =====================================================================
    function initMessageObserver() {
        cleanupObserver();
        const maxWait = 10 * 60 * 1000;
        const startTime = Date.now();
        const checkChatRoom = setInterval(() => {
            try {
                const chatLog = DOMCache.getChatLog();
                if (chatLog && document.contains(chatLog)) {
                    clearInterval(checkChatRoom);
                    currentMessageCount = DOMCache.getMessageCount();
                    messageObserver = new MutationObserver(handleMutations);
                    try {
                        messageObserver.observe(chatLog, { childList: true, subtree: true, attributes: false, characterData: false });
                        observerActive = true;
                        startAutoSave();
                    } catch (observerError) { logError("initMessageObserver.observe", observerError); cleanupObserver(); }
                } else if (Date.now() - startTime > maxWait) { clearInterval(checkChatRoom); }
            } catch (e) { logError("initMessageObserver.checkChatRoom", e); }
        }, 500);
    }

    function handleMutations(mutations) {
        if (!observerActive) return;
        try {
            let newMessages = 0;
            mutations.forEach(mutation => {
                if (!mutation.addedNodes || mutation.addedNodes.length === 0) return;
                mutation.addedNodes.forEach(node => {
                    try {
                        if (node.nodeType === Node.ELEMENT_NODE && node.matches && (node.matches(".ChatMessage") || node.matches("a.beep-link"))) newMessages++;
                    } catch {}
                });
            });
            if (newMessages > 0) currentMessageCount += newMessages;
        } catch (e) { logError("handleMutations", e); }
    }

    function cleanupObserver() {
        try { if (messageObserver) { messageObserver.disconnect(); messageObserver = null; } observerActive = false; } catch (e) { logError("cleanupObserver", e); }
    }

    function stopMessageObserver() { cleanupObserver(); stopAutoSave(); }

    function startAutoSave() {
        if (autoSaveTimer) clearInterval(autoSaveTimer);
        autoSaveTimer = setInterval(() => {
            if (currentMode === "cache") {
                if (Date.now() - lastSaveTime >= AUTO_SAVE_INTERVAL) saveCurrentMessages();
            }
        }, 60 * 1000);
    }

    function stopAutoSave() { if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; } }

    async function saveCurrentMessages() {
        if (currentMode !== "cache") return;
        const messages = processCurrentMessages();
        if (messages.length > 0) {
            try {
                await CacheManager.saveToday(messages);
                currentMessageCount = 0;
                lastSaveTime = Date.now();
            } catch (e) {
                logError("saveCurrentMessages", e);
                window.ChatRoomSendLocalStyled(ui('toastAutoFail'), 3000, "#ff0000");
            }
        }
    }

    function setupDataBackup() {
        window.addEventListener('beforeunload', () => {
            if (currentMode === "cache") saveToLocalStorage("beforeunload");
            cleanupObserver();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (observerActive) observerActive = false;
                if (currentMode === "cache") saveToLocalStorage("visibilitychange");
            } else {
                if (messageObserver && !observerActive) observerActive = true;
            }
        });
    }

    function saveToLocalStorage(reason) {
        try {
            const messages = processCurrentMessages();
            if (messages.length > 0) {
                const tempData = { messages, date: DateUtils.getDateKey(), accountPrefix: getAccountPrefix(), timestamp: Date.now(), count: messages.length, reason };
                localStorage.setItem(`che_temp_data_${getAccountPrefix()}`, JSON.stringify(tempData));
            }
        } catch (e) { logError("saveToLocalStorage", e); }
    }

    async function checkTempData() {
        const storageKey = `che_temp_data_${getAccountPrefix()}`;
        try {
            const tempDataStr = localStorage.getItem(storageKey);
            if (!tempDataStr) return;
            let tempData;
            try { tempData = JSON.parse(tempDataStr); } catch (parseError) { logError("checkTempData.parse", parseError); localStorage.removeItem(storageKey); return; }
            const currentDate = DateUtils.getDateKey();
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
            const yesterdayKey = DateUtils.getDateKey(yesterday);
            if ((tempData.date === currentDate || tempData.date === yesterdayKey) && tempData.messages?.length > 0) {
                try {
                    await CacheManager.saveToday(tempData.messages);
                    currentMessageCount = 0; lastSaveTime = Date.now();
                    window.ChatRoomSendLocalStyled(ui('toastRestore', tempData.messages.length), 4000, "#00ff00");
                } catch (saveError) {
                    logError("checkTempData.save", saveError);
                    window.ChatRoomSendLocalStyled(ui('toastRestoreFail'), 3000, "#ff0000");
                }
            }
            localStorage.removeItem(storageKey);
        } catch (e) { logError("checkTempData", e); try { localStorage.removeItem(storageKey); } catch {} }
    }

    // =====================================================================
    // UI
    // =====================================================================
    // =====================================================================
    // CHE Settings (localStorage)
    // =====================================================================
    const CHE_SETTINGS_KEY = "che_settings_v1";
    let cheSettings = { showBall: true, cacheEnabled: true };

    function loadCHESettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(CHE_SETTINGS_KEY) || "{}");
            cheSettings = Object.assign({ showBall: true, cacheEnabled: true }, saved);
            // Sync cacheEnabled → currentMode on load
            if (!cheSettings.cacheEnabled && currentMode === "cache") {
                currentMode = "stopped";
                localStorage.setItem("chatlogger_mode", "stopped");
            }
        } catch {}
    }

    function saveCHESettings() {
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
        // BC canvas: 2000x1000. Use MAT-style two-column layout.
        // Left col centre ~650, Right col centre ~1350
        CB: 64,
        // Shared Y positions
        Y: {
            back:    60,
            help:    60,
            title:  105,
            secL:   180,   // "── 顯示 ──"
            secR:   180,   // "── 匯出 ──"
            cb1:    220,   // showBall checkbox
            cb2:    310,   // cacheEnabled checkbox
            btn1:   220,   // Export HTML button
            btn2:   310,   // Export Excel button
            btn3:   400,   // Cache manager button
            divider:500,
            desc1:  545,
            desc2:  595,
            desc3:  645,
        },
        // Column centres
        LC: 650,   // left column centre
        RC: 1350,  // right column centre
        LCB_X: 460, // left checkbox X

        load() {},

        run() {
            const zh = isZh();
            const T = {
                title:    zh ? "書記官設定  v" + modversion : "CHE Settings  v" + modversion,
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

            // Top row: back + help
            DrawButton(1815, y.back, 90, 90, "", "White", "Icons/Exit.png", T.back);
            DrawButton(1710, y.help, 90, 90, "", "White", gameAsset("Icons/Question.png"), T.helpTip);

            // Title
            DrawText(T.title, 1000, y.title, "White", "Black");

            // ── Left: Display ──
            DrawText(T.secL, lc, y.secL, "#4CAF50", "Black");
            DrawCheckbox(lx, y.cb1, cb, cb, "", cheSettings.showBall);
            DrawCheckbox(lx, y.cb2, cb, cb, "", cheSettings.cacheEnabled);
            const prev = MainCanvas.textAlign;
            MainCanvas.textAlign = "left";
            DrawTextFit(T.showBall, lx + cb + 12, y.cb1 + cb/2 + 10, 420, "White");
            DrawTextFit(T.cacheOn,  lx + cb + 12, y.cb2 + cb/2 + 10, 420,
                cheSettings.cacheEnabled ? "White" : "#888888");
            MainCanvas.textAlign = prev;

            // ── Right: Export ──
            DrawText(T.secR, rc, y.secR, "#4CAF50", "Black");
            const bx = rc - btnW/2;
            DrawButton(bx, y.btn1, btnW, btnH, T.btnHTML,  "White", "", "");
            DrawButton(bx, y.btn2, btnW, btnH, T.btnExcel, "White", "", "");
            DrawButton(bx, y.btn3, btnW, btnH, T.btnCache, "White", "", "");

            // Divider
            DrawRect(395, y.divider, 1215, 2, "rgba(255,255,255,0.1)");

            // Description
            DrawText(T.desc1, 1000, y.desc1, "#cccccc", "Black");
            DrawText(T.desc2, 1000, y.desc2, "#aaaaaa", "Black");
            DrawText(T.desc3, 1000, y.desc3, "#aaaaaa", "Black");
        },

        click() {
            const y = this.Y; const cb = this.CB;
            const lx = this.LCB_X; const rc = this.RC;
            const btnW = 380; const btnH = 64;

            if (MouseIn(1815, y.back, 90, 90)) {
                if (typeof PreferenceExit === "function") PreferenceExit(); return;
            }
            if (MouseIn(1710, y.help, 90, 90)) { showHelpPopup(); return; }

            // Toggle: Show ball
            if (MouseIn(lx, y.cb1, cb, cb)) {
                cheSettings.showBall = !cheSettings.showBall;
                saveCHESettings(); applyBallVisibility(); return;
            }
            // Toggle: Enable cache
            if (MouseIn(lx, y.cb2, cb, cb)) {
                cheSettings.cacheEnabled = !cheSettings.cacheEnabled;
                saveCHESettings();
                if (cheSettings.cacheEnabled) {
                    currentMode = "cache";
                    localStorage.setItem("chatlogger_mode", "cache");
                    initMessageObserver();
                } else {
                    currentMode = "stopped";
                    localStorage.setItem("chatlogger_mode", "stopped");
                    stopMessageObserver();
                }
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
    // Onboarding (first-time guide)
    // =====================================================================
    const ONBOARD_KEY = "che_onboarded_v1";

    function showOnboarding() {
        if (localStorage.getItem(ONBOARD_KEY)) return;
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

        // Pulse the ball to draw attention
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
            localStorage.setItem(ONBOARD_KEY, "1");
            if (ball) ball.style.animation = "";
            document.getElementById("che-pulse-style")?.remove();
        };
    }

    function showHelpPopup() {
        localStorage.removeItem(ONBOARD_KEY);
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

        // ⚙️ Hide button (in toolbar, replaces old ? position)
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

        // Ball row: [💾 ball] [? question icon]
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

        // Question button hidden until toolbar opens
        questionBtn.style.display = "none";

        ballRow.appendChild(toggleButton);
        ballRow.appendChild(questionBtn);

        container.appendChild(toolbar);
        container.appendChild(ballRow);
        document.body.appendChild(container);

        // Apply saved ball visibility
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
            initMessageObserver();
        } else {
            currentMode = "stopped";
            stopMessageObserver();
        }
        localStorage.setItem("chatlogger_mode", currentMode);
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
    async function init() {
        try {
            loadCHESettings();
            await loadToastSystem();
            setupDataBackup();
            const waitForPlayer = setInterval(() => {
                if (window.Player?.Name) {
                    clearInterval(waitForPlayer);
                    console.log(`🐈‍⬛ [CHE] ⌛ Player loaded (${getAccountPrefix()}), initializing...`);
                    checkTempData().catch(e => logError("init.checkTempData", e));
                    CacheManager.cleanOldData().catch(e => logError("init.cleanOldData", e));
                    addUI();
                    if (currentMode === "cache") initMessageObserver();
                    // Show onboarding on first load
                    setTimeout(showOnboarding, 800);
                    console.log("🐈‍⬛ [CHE] ✅ Init complete, mode:", currentMode);
                }
            }, 1000);

            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE",
                    fullName: "Chat History Exporter",
                    version: modversion,
                    repository: "Chat room history export with 7-day cache",
                });
            }

            // Register extension settings page
            waitForPreference().then(() => {
                PreferenceRegisterExtensionSetting({
                    Identifier: "CHE",
                    ButtonText: isZh() ? "CHE設定" : "CHE Settings",
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
