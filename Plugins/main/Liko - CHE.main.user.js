// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      2.2.2
// @description  聊天室紀錄匯出
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
    const modversion = "2.2.2";
    let currentMessageCount = 0;
    const AUTO_SAVE_INTERVAL = 5 * 60 * 1000;
    let autoSaveTimer = null;
    let lastSaveTime = Date.now();
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped";

    // 全局觀察器管理
    let messageObserver = null;
    let observerActive = false;

    // 統一的錯誤報告機制
    window.cheErrorCount = 0;
    function logError(location, error) {
        window.cheErrorCount++;
        console.error(`[CHE-${window.cheErrorCount}] ${location}:`, error);
    }

    // =====================================================================
    // FIX 1: 多帳號隔離 - 取得當前帳號前綴
    // =====================================================================
    function getAccountPrefix() {
        return String(window.Player?.MemberNumber || "0");
    }

    // =====================================================================
    // FIX 2: 時間正規化 - 統一轉為 24 小時制
    // =====================================================================
    function normalizeTime(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return "";
        // 已是 ISO 格式或 HH:MM / HH:MM:SS → 直接返回
        if (timeStr.includes('T') || /^\d{2}:\d{2}/.test(timeStr)) return timeStr;
        // 中文 12 小時制：上午/下午 H:MM 或 HH:MM
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

    // DOM 快取管理
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
            } catch (e) {
                logError("DOMCache.getMessages", e);
                return [];
            }
        },

        getMessageCount() {
            try {
                const log = this.getChatLog();
                if (!log) return 0;
                return log.querySelectorAll(".ChatMessage, a.beep-link").length;
            } catch (e) {
                logError("DOMCache.getMessageCount", e);
                return 0;
            }
        }
    };

    // 日期工具
    const DateUtils = {
        getDateKey(date = new Date()) {
            try {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (e) {
                logError("DateUtils.getDateKey", e);
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            }
        },

        getDisplayDate(dateKey) {
            try {
                const dateParts = dateKey.split('-');
                if (dateParts.length !== 3) return dateKey;
                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const day = parseInt(dateParts[2]);
                const date = new Date(year, month, day);
                if (isNaN(date.getTime())) return dateKey;
                return `${date.getMonth() + 1}/${date.getDate()}`;
            } catch (e) {
                logError("DateUtils.getDisplayDate", e);
                return dateKey;
            }
        },

        isToday(dateKey) {
            try {
                return dateKey === this.getDateKey();
            } catch (e) {
                logError("DateUtils.isToday", e);
                return false;
            }
        },

        getDaysAgo(days) {
            try {
                const date = new Date();
                date.setDate(date.getDate() - days);
                return this.getDateKey(date);
            } catch (e) {
                logError("DateUtils.getDaysAgo", e);
                return this.getDateKey();
            }
        },

        formatTimeForDisplay(date) {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "無效時間";
            try {
                return date.toLocaleTimeString('zh-TW', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (e) {
                logError("DateUtils.formatTimeForDisplay", e);
                const h = String(date.getHours()).padStart(2, '0');
                const m = String(date.getMinutes()).padStart(2, '0');
                const s = String(date.getSeconds()).padStart(2, '0');
                return `${h}:${m}:${s}`;
            }
        }
    };

    // =====================================================================
    // FIX 1 + 3: 緩存管理器 - 帳號隔離 + msgid 去重
    // =====================================================================
    const CacheManager = {
        async init() {
            const request = indexedDB.open("ChatLoggerV2", 2);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains("fragments")) {
                    db.deleteObjectStore("fragments");
                }
                if (!db.objectStoreNames.contains("daily_fragments")) {
                    db.createObjectStore("daily_fragments");
                }
            };
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    logError("CacheManager.init", "IndexedDB 初始化失敗");
                    reject("IndexedDB 初始化失敗");
                };
            });
        },

        // FIX 1: dateKey 加入帳號前綴
        _makeKey(dateStr) {
            return `${getAccountPrefix()}_${dateStr}`;
        },

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

                // FIX 3: 優先用 msgid 去重，fallback 用 time-id-content
                const existingKeys = new Set();
                existing.forEach(msg => {
                    const key = msg.msgid || `${msg.time}-${msg.id}-${(msg.content || "").substring(0, 50)}`;
                    existingKeys.add(key);
                });

                const newMessages = messages.filter(msg => {
                    const key = msg.msgid || `${msg.time}-${msg.id}-${(msg.content || "").substring(0, 50)}`;
                    return !existingKeys.has(key);
                });

                if (newMessages.length === 0) return 0;

                const allMessages = [...existing, ...newMessages];

                await new Promise((resolve, reject) => {
                    const data = { messages: allMessages, count: allMessages.length, lastUpdate: Date.now() };
                    const req = store.put(data, fullKey);
                    req.onsuccess = () => resolve();
                    req.onerror = () => reject(req.error);
                });

                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error("事務被中止"));
                });

                return allMessages.length;
            } catch (e) {
                logError("CacheManager.saveToday", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 緩存保存失敗", 3000, "#ff0000");
                throw e;
            }
        },

        // FIX 1: 只顯示當前帳號的日期
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
                        result.push({
                            dateKey: key,
                            count: data.count || 0,
                            display: DateUtils.getDisplayDate(dateStr)
                        });
                    }
                }

                return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
            } catch (e) {
                logError("CacheManager.getAvailableDates", e);
                return [];
            }
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
            } catch (e) {
                logError("CacheManager.getMessagesForDates", e);
                return [];
            }
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
                        await new Promise((resolve) => {
                            const req = store.delete(dateKey);
                            req.onsuccess = () => { successCount++; resolve(); };
                            req.onerror = () => resolve();
                        });
                        await new Promise((resolve) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        });
                    } catch (itemError) {
                        logError("CacheManager.deleteDates.item", itemError);
                    }
                }
                if (successCount > 0) {
                    window.ChatRoomSendLocalStyled(`[CHE] 已刪除 ${successCount} 個日期的數據`, 3000, "#00ff00");
                    return true;
                } else {
                    window.ChatRoomSendLocalStyled("[CHE] 沒有數據被刪除", 3000, "#ffa500");
                    return false;
                }
            } catch (e) {
                logError("CacheManager.deleteDates", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 刪除操作失敗", 3000, "#ff0000");
                return false;
            }
        },

        // FIX 1: 只清理當前帳號的舊數據
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
            } catch (e) {
                logError("CacheManager.cleanOldData", e);
            }
        }
    };

    // 載入樣式化訊息系統
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = () => console.log("[CHE] xlsx.full.min.js 載入完成");
        document.head.appendChild(script);
    }

    function isFilteredMessage(content, messageType, includePrivate = true) {
        const basicFilters = [
            "BCX commands tutorial",
            "BCX also provides",
            "(输入 /help 查看命令列表)"
        ];
        if (basicFilters.some(f => content.includes(f))) return true;
        if (includePrivate) {
            if (messageType === "beep") return true;
        } else {
            if (messageType === "whisper" || messageType === "beep") return true;
            if (content.includes("↩️")) return true;
            const privateKeywords = ["悄悄話", "悄悄话", "好友私聊", "BEEP"];
            if (privateKeywords.some(k => content.includes(k))) return true;
        }
        return false;
    }

    function detectMessageType(msg, content) {
        if (!msg || !content) return "normal";
        try {
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
        } catch (e) {
            logError("detectMessageType", e);
            return "normal";
        }
    }

    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function extractFullTextContent(element) {
        if (!element) return "";
        try {
            const clone = element.cloneNode(true);
            // FIX 5: 移除 popup 和 metadata，避免時間/ID/Reply 污染內容
            clone.querySelectorAll('.chat-room-message-popup, .chat-room-metadata').forEach(el => el.remove());

            const links = clone.querySelectorAll('a[href]');
            links.forEach(function(link) {
                try {
                    const href = link.getAttribute('href') || '';
                    const text = link.innerText || link.textContent || '';
                    if (text && text !== href && !text.includes('http')) {
                        link.textContent = text + ' (' + href + ')';
                    } else {
                        link.textContent = href;
                    }
                } catch (linkError) {
                    console.warn("[CHE] 處理鏈接時錯誤:", linkError);
                }
            });

            let text = clone.textContent || clone.innerText || "";
            return text.replace(/\s*\n\s*/g, '\n').trim();
        } catch (e) {
            logError("extractFullTextContent", e);
            try {
                return element.textContent || element.innerText || "";
            } catch (fallbackError) {
                return "";
            }
        }
    }

    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        try {
            let c = "";
            if (msg.style && typeof msg.style.getPropertyValue === 'function') {
                c = msg.style.getPropertyValue("--label-color");
            }
            if (!c && window.getComputedStyle) {
                try { c = getComputedStyle(msg).getPropertyValue("--label-color"); } catch (_) {}
            }
            if (!c && nameButton) {
                try {
                    if (nameButton.style && typeof nameButton.style.getPropertyValue === 'function') {
                        c = nameButton.style.getPropertyValue("--label-color");
                    }
                    if (!c && window.getComputedStyle) {
                        c = getComputedStyle(nameButton).getPropertyValue("--label-color");
                    }
                } catch (_) {}
            }
            c = (c || "").trim();
            if (c) return c;
            const colorSpan = msg.querySelector('[style*="color"]');
            if (colorSpan && colorSpan.style && colorSpan.style.color) return colorSpan.style.color;
            const fontEl = msg.querySelector("font[color]");
            if (fontEl && fontEl.color) return fontEl.color;
            return "#000";
        } catch (e) {
            logError("getLabelColor", e);
            return "#000";
        }
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
            const r = parseInt(cleanColor.slice(1, 3), 16);
            const g = parseInt(cleanColor.slice(3, 5), 16);
            const b = parseInt(cleanColor.slice(5, 7), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            if (isDarkTheme) {
                if (luminance < 0.4) return lightenColor(cleanColor, 0.6);
                if (luminance < 0.6) return lightenColor(cleanColor, 0.3);
                return cleanColor;
            } else {
                if (luminance > 0.7) return darkenColor(cleanColor, 0.6);
                if (luminance > 0.5) return darkenColor(cleanColor, 0.3);
                return cleanColor;
            }
        } catch (e) {
            return cleanColor;
        }
    }

    function lightenColor(color, amount) {
        try {
            const num = parseInt(color.slice(1), 16);
            const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
            const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * amount));
            const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * amount));
            return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
        } catch (e) { return color; }
    }

    function darkenColor(color, amount) {
        try {
            const num = parseInt(color.slice(1), 16);
            const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
            const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
            const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
            return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
        } catch (e) { return color; }
    }

    // =====================================================================
    // FIX 6 + 5 + 4: parseDBContent 支援新格式（name 為獨立欄位）
    //   同時保留對舊格式緩存的向後相容解析
    // =====================================================================
    function parseDBContent(msg) {
        const content = (msg.content || "").trim();
        const name = msg.name || "";

        if (!content) return { isSkip: true };

        // Separator
        if (content.startsWith('˅') || msg.type === 'separator') {
            const roomText = content.startsWith('˅') ? content.substring(1).trim() : content;
            return { isRoom: true, content: roomText, displayContent: content };
        }

        // ── 新格式（2.2.0+）：name 欄位已存在，content 是純訊息內容 ──
        if (name) {
            if (content.startsWith('*') || content.startsWith('(')) {
                return { isAction: true, displayContent: content };
            }
            return { isUser: true, userName: name, userMessage: content, displayContent: content };
        }

        // ── 舊格式向後相容：content 含完整原始 textContent ──
        let cleanContent = content;

        // 嘗試去除開頭的 HH:MM:SS（舊 24h 格式）
        const timeMatchOld = cleanContent.match(/^(\d{2}:\d{2}:\d{2})/);
        if (timeMatchOld) {
            cleanContent = cleanContent.substring(timeMatchOld[1].length).trim();
        }

        // 嘗試去除開頭的 ID
        if (msg.id && cleanContent.startsWith(msg.id)) {
            cleanContent = cleanContent.substring(msg.id.length).trim();
        }

        // 去除尾部的 時間+ID+Reply 殘留
        cleanContent = cleanContent.replace(/\d{2}:\d{2}(?::\d{2})?\d+Reply?\s*$/i, '').trim();

        if (cleanContent.startsWith('˅')) return { isSkip: true };
        if (cleanContent.startsWith('*') || cleanContent.startsWith('(')) {
            return { isAction: true, displayContent: cleanContent };
        }

        // 尋找 名字:訊息 分隔點
        // 使用非貪婪匹配，排除時間模式（HH: 或 上午/下午H:）
        const colonMatch = cleanContent.match(/^([^:\n]{1,40}):\s*([\s\S]*)$/);
        if (colonMatch) {
            const potentialName = colonMatch[1].trim();
            // 排除看起來像時間的假名字（純數字+冒號、上午、下午等）
            const looksLikeTime = /^[\d]+$/.test(potentialName) ||
                  /[上下]午/.test(potentialName) ||
                  /^\d{1,2}$/.test(potentialName);
            if (!looksLikeTime) {
                return {
                    isUser: true,
                    userName: potentialName,
                    userMessage: colonMatch[2].trim(),
                    displayContent: cleanContent
                };
            }
        }

        return { isNormal: true, displayContent: cleanContent };
    }

    // HTML 模板
    async function generateHTMLTemplate(title) {
        const searchControls = `
        <div id="searchPanel" style="position: sticky; top: 0; background: inherit; padding: 12px; border-bottom: 1px solid var(--border-color); backdrop-filter: blur(10px); z-index: 100;">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="contentSearch" placeholder="搜尋內容..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); width: 200px; font-size: 14px;">
                <input type="text" id="idFilter" placeholder="篩選ID (用逗號分隔多個)..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); width: 200px; font-size: 14px;">
                <select id="timeRange" style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--input-border); background: var(--input-bg); color: var(--text-color); font-size: 14px;">
                    <option value="">所有時間</option>
                    <option value="1h">近1小時</option>
                    <option value="6h">近6小時</option>
                    <option value="24h">近24小時</option>
                </select>
                <button onclick="clearAllFilters()" style="padding: 6px 12px; border-radius: 6px; border: none; background: var(--button-bg); color: var(--button-text); cursor: pointer; font-size: 14px;">清除</button>
            </div>
            <div style="margin-top: 8px; font-size: 13px;">
                <span id="filterStats" style="color: var(--muted-text);"></span>
            </div>
        </div>`;

        return `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            :root {
                --bg-color: #111;
                --text-color: #eee;
                --muted-text: #aaa;
                --border-color: #444;
                --input-bg: #222;
                --input-border: #666;
                --button-bg: #666;
                --button-text: #fff;
                --separator-bg: rgba(129, 0, 231, 0.2);
                --separator-border: #8100E7;
                --beep-color: #ff6b6b;
                --beep-bg: rgba(255, 107, 107, 0.12);
            }
            body.light {
                --bg-color: #fff;
                --text-color: #333;
                --muted-text: #666;
                --border-color: #ddd;
                --input-bg: #fff;
                --input-border: #ccc;
                --button-bg: #f5f5f5;
                --button-text: #333;
                --separator-bg: rgba(129, 0, 231, 0.1);
                --separator-border: #8100E7;
                --beep-color: #d63031;
                --beep-bg: rgba(214, 48, 49, 0.12);
            }
            body { font-family: sans-serif; background: var(--bg-color); color: var(--text-color); transition: all 0.3s ease; margin: 0; padding: 0; }
            .chat-row { display: flex; align-items: flex-start; margin: 2px 0; padding: 2px 6px; border-radius: 6px; }
            .chat-meta { display: flex; flex-direction: column; align-items: flex-end; width: 70px; font-size: 0.8em; margin-right: 8px; flex-shrink: 0; }
            .chat-time { color: var(--muted-text); }
            .chat-id { font-weight: bold; }
            .chat-content { flex: 1; white-space: pre-wrap; word-wrap: break-word; }
            .with-accent { border-left: 4px solid transparent; }
            .separator-row { background: var(--separator-bg); border-left: 4px solid var(--separator-border); text-align: center; font-weight: bold; padding: 8px; margin: 4px 0; border-radius: 8px; }
            .collapse-button { background: none; border: none; color: inherit; font-size: 16px; cursor: pointer; padding: 6px 10px; border-radius: 4px; }
            .collapse-button:hover { background: rgba(255,255,255,0.1); }
            body.light .collapse-button:hover { background: rgba(0,0,0,0.1); }
            .collapsible-content { display: block; }
            .collapsible-content.collapsed { display: none; }
            #toggleTheme { position: fixed; top: 10px; right: 10px; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; background: #fff; color: #000; transition: all 0.3s ease; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 1001; }
            body.light #toggleTheme { background: #333; color: #fff; }
            .user-name { font-weight: bold; }
            .action-text { font-style: italic; opacity: 0.9; }
            .beep { color: var(--beep-color); font-weight: bold; }
            .enhanced-color { filter: brightness(1.2) saturate(1.1); }
            body.light .enhanced-color { filter: brightness(0.8) saturate(1.2); }
            @media (max-width: 768px) {
                .chat-meta { width: 60px; font-size: 0.7em; }
                #searchPanel > div { flex-direction: column; align-items: stretch; }
                #searchPanel input, #searchPanel select { width: 100% !important; margin-bottom: 5px; }
            }
        </style>
    </head>
    <body>
        <button id="toggleTheme">✧ 淺色模式</button>
        ${searchControls}
        <div id="chatlog">
    `;
    }

    function getHTMLFooter() {
        return `
        </div>
        <script>
            let allChatRows = Array.from(document.querySelectorAll('.chat-row'));

            function toggleCollapse(id) {
                const element = document.getElementById('collapse-' + id);
                if (element) element.classList.toggle('collapsed');
            }

            function parseTimeString(timeStr) {
                if (timeStr.includes('T')) return new Date(timeStr);
                const today = new Date();
                const parts = timeStr.split(':').map(Number);
                today.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
                return today;
            }

            function applyFilters() {
                const contentTerm = document.getElementById('contentSearch').value.toLowerCase();
                const idTerms = document.getElementById('idFilter').value.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
                const timeRange = document.getElementById('timeRange').value;
                let visibleCount = 0;
                const now = new Date();

                allChatRows.forEach(row => {
                    let visible = true;
                    if (contentTerm) {
                        const content = row.querySelector('.chat-content')?.textContent.toLowerCase() || '';
                        visible = visible && content.includes(contentTerm);
                    }
                    if (idTerms.length > 0) {
                        const id = row.querySelector('.chat-id')?.textContent.toLowerCase() || '';
                        visible = visible && idTerms.some(term => id.includes(term));
                    }
                    if (timeRange && visible) {
                        const timeStr = row.querySelector('.chat-time')?.textContent || '';
                        if (timeStr) {
                            try {
                                const msgTime = parseTimeString(timeStr);
                                const hoursDiff = (now - msgTime) / (1000 * 60 * 60);
                                switch(timeRange) {
                                    case '1h': visible = hoursDiff <= 1; break;
                                    case '6h': visible = hoursDiff <= 6; break;
                                    case '24h': visible = hoursDiff <= 24; break;
                                }
                            } catch (e) {}
                        }
                    }
                    row.style.display = visible ? 'flex' : 'none';
                    if (visible) visibleCount++;
                });

                document.getElementById('filterStats').textContent =
                    '顯示 ' + visibleCount + ' / ' + allChatRows.length + ' 條訊息';
            }

            ['contentSearch', 'idFilter'].forEach(id => {
                document.getElementById(id).addEventListener('input', applyFilters);
            });
            document.getElementById('timeRange').addEventListener('change', applyFilters);

            function clearAllFilters() {
                document.getElementById('contentSearch').value = '';
                document.getElementById('idFilter').value = '';
                document.getElementById('timeRange').value = '';
                applyFilters();
            }

            document.getElementById("toggleTheme").onclick = function() {
                document.body.classList.toggle("light");
                const isLight = document.body.classList.contains("light");
                this.innerHTML = isLight ? "✦ 深色模式" : "✧ 淺色模式";
            };

            applyFilters();
        <\/script>
    </body>
    </html>
    `;
    }

    // =====================================================================
    // FIX 4 + 5 + 6: processCurrentMessages - 乾淨提取，含名字和 msgid
    // =====================================================================
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];

        messages.forEach(msg => {
            try {
                // 分隔符
                if (msg.classList?.contains("chat-room-sep-div")) {
                    const button = msg.querySelector(".chat-room-sep-header");
                    const roomName = button?.dataset?.room || "";
                    const iconDiv = button?.querySelector(".chat-room-sep-image");
                    const iconText = iconDiv ? (iconDiv.querySelector("span")?.innerText || "") : "";
                    const sepText = `˅${iconText ? iconText + " - " : ""}${roomName}`.trim();
                    processedMessages.push({
                        time: new Date().toISOString(),
                        id: "",
                        name: "",
                        content: sepText,
                        msgid: `sep_${roomName}_${Date.now()}`,
                        type: "separator",
                        color: "#8100E7"
                    });
                    return;
                }

                // 略過 beep-link
                if (msg.matches?.("a.beep-link")) return;

                if (!msg.dataset) return;

                // FIX 2: 時間正規化為 24 小時制
                const rawTime = msg.dataset.time || "";
                const normalizedTime = normalizeTime(rawTime);
                const senderId = msg.dataset.sender || "";

                // FIX 6: 取得真實顯示名稱（非 ID）
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton
                ? (nameButton.innerText || nameButton.textContent || "").trim()
                : "";

                // FIX 3: 取得 msgid 作為去重主鍵
                const msgidAttr = msg.querySelector("span[msgid]")?.getAttribute("msgid") || "";

                // FIX 5 + 4: 只取訊息內容，排除 popup 和 metadata
                let content = "";
                let originContent = "";
                const contentSpan = msg.querySelector(".chat-room-message-content");
                const originContentSpan = msg.querySelector(".chat-room-message-original");
                if (contentSpan) {
                    // 優先取 .chat-room-message-content（最乾淨）
                    content = (contentSpan.textContent || contentSpan.innerText || "").trim();
                    if (originContentSpan) {
                        originContent = (originContentSpan.textContent || originContentSpan.innerText || "").trim();
                        content = content + '\n' + originContent
                    }
                } else {
                    const clone = msg.cloneNode(true);
                    clone.querySelectorAll(
                        '.chat-room-message-popup, .chat-room-metadata, .ChatMessageName'
                    ).forEach(el => el.remove());
                    // FIX IMG: 備援路徑同樣處理圖片
                    clone.querySelectorAll('img[src]').forEach(img => {
                        img.replaceWith(document.createTextNode(img.getAttribute('src') || img.getAttribute('alt') || ''));
                    });
                    content = (clone.textContent || clone.innerText || "").trim();
                }

                // FIX 4: [🌐] 自動翻譯 - 嘗試保留原文
                if (content === '[🌐]' || content.startsWith('[🌐] ')) {
                    const originalText = msg.getAttribute('bce-original-text');
                    if (originalText && !originalText.startsWith('[🌐]') && originalText.trim()) {
                        // 記錄原文 + 譯文
                        content = `${originalText} [🌐] ${content.replace(/^\[🌐\]\s*/, '')}`;
                    }
                }

                const messageType = detectMessageType(msg, content);
                const labelColor = getLabelColor(msg, nameButton);

                processedMessages.push({
                    time: normalizedTime,
                    id: senderId,
                    name: senderName,       // FIX 6: 儲存顯示名稱
                    content: content,        // FIX 5: 乾淨內容
                    msgid: msgidAttr,        // FIX 3: 去重主鍵
                    type: messageType,
                    color: labelColor,
                    className: Array.from(msg.classList || []).join(" ")
                });

            } catch (e) {
                logError("processCurrentMessages", e);
            }
        });

        return processedMessages;
    }

    // =====================================================================
    // FIX 5 + 6: generateDBHTML - 使用新格式 parseDBContent
    // =====================================================================
    async function generateDBHTML(messages, includePrivate) {
        window.ChatRoomSendLocalStyled("[CHE] 正在匯出緩存HTML，請稍候...", 3000, "#ffa500");

        function toRGBA(color, alpha = 0.12) {
            if (!color) return `rgba(128,128,128,${alpha})`;
            color = color.trim();
            let m = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
            if (color[0] === "#") {
                let h = color.slice(1);
                if (h.length === 3) h = h.split("").map(c => c + c).join("");
                if (h.length >= 6) {
                    const r = parseInt(h.slice(0, 2), 16);
                    const g = parseInt(h.slice(2, 4), 16);
                    const b = parseInt(h.slice(4, 6), 16);
                    if ([r, g, b].every(v => !isNaN(v))) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
            }
            return `rgba(128,128,128,${alpha})`;
        }

        const htmlTemplate = await generateHTMLTemplate("緩存HTML");
        let html = htmlTemplate;
        let collapseId = 0;
        let openCollapsible = false;
        let processedCount = 0;
        let lastSeparatorText = "";

        for (const msg of messages) {
            // FIX 6: 傳入整個 msg 物件而非拆散的參數
            const parsed = parseDBContent(msg);

            if (parsed.isSkip) continue;

            if (parsed.isRoom) {
                if (openCollapsible) html += `</div>`;
                html += `
            <div class="separator-row">
                <button class="collapse-button" onclick="toggleCollapse(${collapseId})">
                    ▼ ${escapeHtml(parsed.content)}
                </button>
            </div>
            <div id="collapse-${collapseId}" class="collapsible-content">`;
                collapseId++;
                openCollapsible = true;
                lastSeparatorText = parsed.content;
                processedCount++;
                continue;
            }

            if (isFilteredMessage(msg.content, msg.type, includePrivate)) continue;
            if (lastSeparatorText && msg.content.includes(lastSeparatorText)) continue;

            // FIX 2: time 已在存入時正規化，直接顯示
            const timeDisplay = msg.time || "";

            const adjustedColor = getEnhancedContrastColor(msg.color || "#888", true);
            const bgColor = toRGBA(adjustedColor, 0.12);

            let content = "";
            if (parsed.isUser) {
                content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(parsed.userName)}</span>: ${escapeHtml(parsed.userMessage)}`;
            } else if (parsed.isAction) {
                content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(parsed.displayContent)}</span>`;
            } else {
                content = escapeHtml(parsed.displayContent);
            }

            html += `
            <div class="chat-row with-accent" style="background:${bgColor}; border-left-color:${adjustedColor};">
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(timeDisplay)}</span>
                    <span class="chat-id">${escapeHtml(msg.id || '')}</span>
                </div>
                <div class="chat-content enhanced-color">${content}</div>
            </div>`;
            processedCount++;
        }

        if (openCollapsible) html += `</div>`;
        html += getHTMLFooter();

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `cached_chatlog_${timestamp}.html`;
            a.click();
            URL.revokeObjectURL(a.href);
            window.ChatRoomSendLocalStyled(`[CHE] 緩存HTML匯出完成，${processedCount} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            logError("generateDBHTML", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 緩存HTML匯出失敗", 5000, "#ff0000");
        }
    }

    // =====================================================================
    // FIX 2 + 5: generateChatHTML - 正規化時間，排除 popup
    // =====================================================================
    async function generateChatHTML(messages, includePrivate) {
        window.ChatRoomSendLocalStyled("[CHE] 正在匯出HTML，請稍候...", 3000, "#ffa500");

        function toRGBA(color, alpha = 0.12) {
            if (!color) return `rgba(128,128,128,${alpha})`;
            color = color.trim();
            let m = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
            if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
            if (color[0] === "#") {
                let h = color.slice(1);
                if (h.length === 3) h = h.split("").map(c => c + c).join("");
                if (h.length >= 6) {
                    const r = parseInt(h.slice(0, 2), 16);
                    const g = parseInt(h.slice(2, 4), 16);
                    const b = parseInt(h.slice(4, 6), 16);
                    if ([r, g, b].every(v => !isNaN(v))) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                }
            }
            return `rgba(128,128,128,${alpha})`;
        }

        const htmlTemplate = await generateHTMLTemplate("HTML");
        let html = htmlTemplate;
        let collapseId = 0;
        let openCollapsible = false;
        let lastSeparatorText = "";
        let processedCount = 0;
        const isDarkTheme = true;

        for (const msg of messages) {
            try {
                if (msg.classList?.contains("chat-room-sep-div")) {
                    const button = msg.querySelector(".chat-room-sep-header");
                    if (button) {
                        const roomName = button.dataset.room || "";
                        const iconDiv = button.querySelector(".chat-room-sep-image");
                        const iconText = iconDiv ? iconDiv.querySelector("span")?.innerText || "" : "";
                        const collapseBtn = msg.querySelector(".chat-room-sep-collapse");
                        const isExpanded = collapseBtn && collapseBtn.getAttribute("aria-expanded") === "true";
                        const separatorText = `${isExpanded ? "▼" : ">"} ${iconText} - ${roomName}`.trim();
                        if (openCollapsible) html += `</div>`;
                        html += `
                <div class="separator-row">
                    <button class="collapse-button" onclick="toggleCollapse(${collapseId})">
                        ${escapeHtml(separatorText)}
                    </button>
                </div>
                <div id="collapse-${collapseId}" class="collapsible-content ${isExpanded ? "" : "collapsed"}">`;
                        collapseId++;
                        openCollapsible = true;
                        lastSeparatorText = roomName;
                        processedCount++;
                        continue;
                    }
                }

                if (msg.matches && msg.matches("a.beep-link")) continue;
                if (!msg.dataset) continue;

                // FIX 2: 正規化時間為 24 小時制
                const time = normalizeTime(msg.dataset.time || "");
                const senderId = msg.dataset.sender || "";
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton ? nameButton.innerText : "";
                let labelColor = getLabelColor(msg, nameButton);
                const adjustedColor = getEnhancedContrastColor(labelColor, isDarkTheme);

                // FIX 5: 先從 .chat-room-message-content 取乾淨內容
                let rawText = "";
                let originRawText = "";
                const contentSpan = msg.querySelector(".chat-room-message-content");
                const originContentSpan = msg.querySelector(".chat-room-message-original");
                if (contentSpan) {
                    rawText = (contentSpan.textContent || contentSpan.innerText || "").trim();
                    if (originContentSpan) {
                        originRawText = (originContentSpan.textContent || originContentSpan.innerText || "").trim();
                        rawText = rawText + '\n' + originRawText
                    }
                } else {
                    const clonedMsg = msg.cloneNode(true);
                    clonedMsg.querySelectorAll(
                        '.chat-room-metadata, .chat-room-message-popup, .ChatMessageName'
                    ).forEach(meta => meta.remove());
                    // FIX IMG: 備援路徑同樣處理圖片
                    clonedMsg.querySelectorAll('img[src]').forEach(img => {
                        img.replaceWith(document.createTextNode(img.getAttribute('src') || img.getAttribute('alt') || ''));
                    });
                    rawText = extractFullTextContent(clonedMsg).trim();
                }

                // FIX 4: 保留 [🌐] 翻譯原文
                if (rawText === '[🌐]' || rawText.startsWith('[🌐] ')) {
                    const originalText = msg.getAttribute('bce-original-text');
                    if (originalText && !originalText.startsWith('[🌐]') && originalText.trim()) {
                        rawText = `${originalText} [🌐] ${rawText.replace(/^\[🌐\]\s*/, '')}`;
                    }
                }

                const messageType = detectMessageType(msg, rawText);
                if (isFilteredMessage(rawText, messageType, includePrivate)) continue;
                if (lastSeparatorText && rawText.includes(lastSeparatorText)) continue;

                let content = "";
                let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

                if (msg.classList.contains("ChatMessageChat")) {
                    if (rawText.startsWith('*') || rawText.startsWith('(')) {
                        content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(rawText.trim())}</span>`;
                    } else {
                        content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                    }
                } else if (msg.classList.contains("ChatMessageWhisper")) {
                    if (!includePrivate) continue;
                    const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄話";
                    content = `${prefix} <span class="user-name" style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                } else if (
                    msg.classList.contains("ChatMessageAction") ||
                    msg.classList.contains("ChatMessageActivity") ||
                    msg.classList.contains("ChatMessageEmote") ||
                    msg.classList.contains("ChatMessageEnterLeave")
                ) {
                    content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(rawText.trim())}</span>`;
                } else if (msg.classList.contains("ChatMessageLocalMessage") || msg.classList.contains("ChatMessageNonDialogue")) {
                    const systemColor = getEnhancedContrastColor('#3aa76d', isDarkTheme);
                    content = `<span style="color:${systemColor}">${escapeHtml(rawText.trim())}</span>`;
                    rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(systemColor, 0.12)}; border-left-color:${systemColor};"`;
                } else {
                    content = escapeHtml(rawText.trim());
                }

                html += `
            <div ${rowStyleInline}>
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(time)}</span>
                    <span class="chat-id">${escapeHtml(senderId)}</span>
                </div>
                <div class="chat-content enhanced-color">${content}</div>
            </div>`;
                processedCount++;
            } catch (e) {
                logError("generateChatHTML.loop", e);
            }
        }

        if (openCollapsible) html += `</div>`;
        html += getHTMLFooter();

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `chatlog_${timestamp}.html`;
            a.click();
            URL.revokeObjectURL(a.href);
            window.ChatRoomSendLocalStyled(`[CHE] HTML匯出完成，${processedCount} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            logError("generateChatHTML", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ HTML匯出失敗，請重試", 5000, "#ff0000");
        }
    }

    // 自訂提示視窗
    function showCustomPrompt(message, options = []) {
        return new Promise(function(resolve) {
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
                z-index: 2000;
            `;

            let buttons = '';
            if (options.length === 0) {
                buttons = `
                    <button id="customPromptYes" style="margin: 10px; padding: 8px 16px; cursor: pointer; background: #0066cc; color: #fff; border: none; border-radius: 4px;">是</button>
                    <button id="customPromptNo" style="margin: 10px; padding: 8px 16px; cursor: pointer; background: #666; color: #fff; border: none; border-radius: 4px;">否</button>
                `;
            } else {
                buttons = options.map((opt) =>
                                      `<button data-value="${opt.value}" style="margin: 5px; padding: 8px 16px; cursor: pointer; background: #0066cc; color: #fff; border: none; border-radius: 4px;">${opt.text}</button>`
                                     ).join('');
            }

            modal.innerHTML = `
                <div style="background: #333; color: #fff; padding: 24px; border-radius: 12px; max-width: 500px; text-align: center; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin-top: 0;">${message.split('\n')[0]}</h3>
                    ${message.split('\n').slice(1).map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                    <div style="margin-top: 20px;">
                        ${buttons}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            if (options.length === 0) {
                modal.querySelector("#customPromptYes").onclick = () => { document.body.removeChild(modal); resolve(true); };
                modal.querySelector("#customPromptNo").onclick = () => { document.body.removeChild(modal); resolve(false); };
            } else {
                modal.querySelectorAll("button[data-value]").forEach(btn => {
                    btn.onclick = () => { document.body.removeChild(modal); resolve(btn.dataset.value); };
                });
            }
        });
    }

    async function showDateSelector() {
        const availableDates = await CacheManager.getAvailableDates();

        if (availableDates.length === 0) {
            const saveCurrent = await showCustomPrompt("沒有緩存數據。是否保存當前聊天室的訊息？");
            if (saveCurrent) {
                const currentMessages = processCurrentMessages();
                if (currentMessages.length > 0) {
                    await CacheManager.saveToday(currentMessages);
                    currentMessageCount = 0;
                    window.ChatRoomSendLocalStyled("[CHE] 已保存當前訊息到緩存", 3000, "#00ff00");
                }
            }
            return null;
        }

        return new Promise(resolve => {
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center;
                z-index: 2000; backdrop-filter: blur(5px);
            `;

            const dateOptions = availableDates.map(date =>
                                                   `<div class="date-option" data-value="${date.dateKey}" style="
                    position: relative; margin: 8px 0; cursor: pointer; padding: 12px; border-radius: 8px;
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                    border: 2px solid transparent; transition: all 0.3s ease;
                    color: #ecf0f1; font-weight: 500; user-select: none;
                ">
                    <span style="font-size: 16px;">${date.display}</span>
                    <span style="color: #bdc3c7; margin-left: 8px;">(${date.count} 條訊息)</span>
                </div>`
                                                  ).join('');

            modal.innerHTML = `
                <div style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                    color: #ecf0f1; padding: 30px; border-radius: 16px; max-width: 500px;
                    max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    border: 1px solid rgba(255,255,255,0.1); position: relative;">
                    <button id="closeBtn" style="position: absolute; top: 15px; right: 15px;
                        background: none; border: none; color: #bdc3c7; font-size: 20px;
                        cursor: pointer; width: 30px; height: 30px; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        transition: all 0.3s ease;">✕</button>
                    <h3 style="margin-top: 0; font-size: 24px; font-weight: 600; text-align: center;
                        color: #ecf0f1; margin-bottom: 20px;">💾 緩存管理</h3>
                    <div style="margin: 20px 0; text-align: left;">
                        <h4 style="color: #bdc3c7; margin-bottom: 15px; font-size: 16px;">選擇要操作的日期：</h4>
                        <div id="dateContainer" style="max-height: 300px; overflow-y: auto; padding-right: 8px;">
                            ${dateOptions}
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 25px; display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;">
                        <button id="selectAll" style="padding: 10px 20px; background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                            color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4);">✓ 全選</button>
                        <button id="exportBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                            color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(52, 152, 219, 0.4);">📤 匯出</button>
                        <button id="deleteBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                            color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                            transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);">🗑️ 刪除</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const dateStyle = document.createElement('style');
            dateStyle.textContent = `
                .date-option { position: relative; overflow: hidden; }
                .date-option.selected { border-color: #9b59b6 !important; background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%) !important; box-shadow: 0 4px 15px rgba(155, 89, 182, 0.4) !important; }
                .date-option.selected::before { content: ''; position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid; border-width: 20px 20px 0 0; border-color: #e74c3c transparent transparent transparent; z-index: 1; }
                .date-option.selected::after { content: '✓'; position: absolute; top: 2px; left: 2px; color: white; font-size: 12px; font-weight: bold; z-index: 2; }
                .date-option:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
                #closeBtn:hover { background: rgba(231, 76, 60, 0.2) !important; color: #e74c3c !important; }
            `;
            document.head.appendChild(dateStyle);

            const dateOptionElements = modal.querySelectorAll('.date-option');
            dateOptionElements.forEach(option => {
                option.addEventListener('click', () => option.classList.toggle('selected'));
                option.addEventListener('mouseenter', () => { if (!option.classList.contains('selected')) { option.style.borderColor = '#3498db'; option.style.background = 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)'; } });
                option.addEventListener('mouseleave', () => { if (!option.classList.contains('selected')) { option.style.borderColor = 'transparent'; option.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)'; } });
            });

            const actionButtons = modal.querySelectorAll('button:not(#closeBtn)');
            actionButtons.forEach(btn => {
                btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-2px) scale(1.05)'; });
                btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateY(0) scale(1)'; });
            });

            modal.querySelector("#selectAll").onclick = () => {
                const allSelected = Array.from(dateOptionElements).every(opt => opt.classList.contains('selected'));
                dateOptionElements.forEach(opt => {
                    if (allSelected) opt.classList.remove('selected');
                    else opt.classList.add('selected');
                });
            };

            modal.querySelector("#closeBtn").onclick = () => { document.body.removeChild(modal); dateStyle.remove(); resolve(null); };

            modal.querySelector("#exportBtn").onclick = async () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected')).map(opt => opt.dataset.value);
                if (selected.length === 0) { alert('請選擇要匯出的日期'); return; }
                document.body.removeChild(modal);
                dateStyle.remove();
                const today = CacheManager._makeKey(DateUtils.getDateKey());
                if (selected.includes(today)) {
                    const currentMessages = processCurrentMessages();
                    if (currentMessages.length > 0) {
                        await CacheManager.saveToday(currentMessages);
                        currentMessageCount = 0;
                    }
                }
                resolve({ action: 'export', dates: selected });
            };

            modal.querySelector("#deleteBtn").onclick = () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected')).map(opt => opt.dataset.value);
                if (selected.length === 0) { alert('請選擇要刪除的日期'); return; }
                document.body.removeChild(modal);
                dateStyle.remove();
                resolve({ action: 'delete', dates: selected });
            };
        });
    }

    async function export_DB_HTML() {
        const result = await showDateSelector();
        if (!result) return;

        if (result.action === 'delete') {
            const confirmDelete = await showCustomPrompt(`確定要刪除 ${result.dates.length} 個日期的數據嗎？`);
            if (confirmDelete) await CacheManager.deleteDates(result.dates);
            return;
        }

        if (result.action === 'export' && result.dates.length > 0) {
            const messages = await CacheManager.getMessagesForDates(result.dates);
            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] 選中日期沒有數據", 3000, "#ffa500");
                return;
            }
            const includePrivate = await showCustomPrompt("請問是否保存包含\n悄悄話(whisper)與私信(beep)的信息?");
            await generateDBHTML(messages, includePrivate);
        }
    }

    async function exportChatAsHTML() {
        const includePrivate = await showCustomPrompt("請問是否保存包含\n悄悄話(whisper)與私信(beep)的信息?");
        const log = DOMCache.getChatLog();
        if (!log || log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length === 0) {
            window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器或無訊息可匯出", 5000, "#ff0000");
            return;
        }
        const messages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
        if (messages.length === 0) {
            window.ChatRoomSendLocalStyled("[CHE] ❌ 沒有訊息可匯出", 5000, "#ff0000");
            return;
        }
        await generateChatHTML(messages, includePrivate);
    }

    async function exportHTML(fromCache = false) {
        if (fromCache) await export_DB_HTML();
        else await exportChatAsHTML();
    }

    async function exportExcel() {
        if (!window.XLSX?.utils) {
            window.ChatRoomSendLocalStyled("[CHE] ❌ XLSX庫未載入", 3000, "#ff0000");
            return;
        }
        const messages = processCurrentMessages();
        if (messages.length === 0) {
            window.ChatRoomSendLocalStyled("[CHE] 沒有訊息可匯出", 3000, "#ffa500");
            return;
        }
        const includePrivate = await showCustomPrompt("是否包含悄悄話和私信？");
        window.ChatRoomSendLocalStyled("[CHE] 正在生成Excel，請稍候...", 2000, "#ffa500");
        try {
            const data = [["時間", "ID", "名稱", "內容"]];
            messages.forEach(msg => {
                if (isFilteredMessage(msg.content, msg.type, includePrivate)) return;
                data.push([msg.time || "", msg.id || "", msg.name || "", msg.content || ""]);
            });
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ChatLog");
            const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
            const blob = new Blob([wbout], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `chatlog_${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            window.ChatRoomSendLocalStyled(`[CHE] Excel匯出完成！${data.length - 1} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            logError("exportExcel", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ Excel匯出失敗", 3000, "#ff0000");
        }
    }

    async function clearCache() {
        const confirm = await showCustomPrompt("確定要清空當前聊天室的訊息嗎？\n（緩存數據庫不會被清空）");
        if (!confirm) return;
        try {
            const chatLog = DOMCache.getChatLog();
            if (!chatLog) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器", 3000, "#ff0000");
                return;
            }
            const nodes = Array.from(chatLog.children);
            let lastRoomNode = null;
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].classList.contains("chat-room-sep") || nodes[i].classList.contains("chat-room-sep-last") || nodes[i].classList.contains("chat-room-sep-div")) {
                    lastRoomNode = nodes[i];
                    break;
                }
            }
            chatLog.innerHTML = "";
            if (lastRoomNode) chatLog.appendChild(lastRoomNode);
            currentMessageCount = 0;
            window.ChatRoomSendLocalStyled("[CHE] 當前聊天室已清空！", 3000, "#00ff00");
        } catch (e) {
            logError("clearCache", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 清空失敗", 3000, "#ff0000");
        }
    }

    function initMessageObserver() {
        cleanupObserver();
        const maxWaitTime = 10 * 60 * 1000;
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
                    } catch (observerError) {
                        logError("initMessageObserver.observe", observerError);
                        cleanupObserver();
                    }
                } else if (Date.now() - startTime > maxWaitTime) {
                    console.error("[CHE] 聊天室載入超時，停止等待");
                    clearInterval(checkChatRoom);
                }
            } catch (e) {
                logError("initMessageObserver.checkChatRoom", e);
            }
        }, 500);
    }

    function handleMutations(mutations) {
        if (!observerActive) return;
        try {
            let newMessages = 0;
            mutations.forEach((mutation) => {
                if (!mutation.addedNodes || mutation.addedNodes.length === 0) return;
                mutation.addedNodes.forEach((node) => {
                    try {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && (node.matches(".ChatMessage") || node.matches("a.beep-link"))) {
                                newMessages++;
                            }
                        }
                    } catch (nodeError) {
                        console.warn("[CHE] 處理新增節點時錯誤:", nodeError);
                    }
                });
            });
            if (newMessages > 0) currentMessageCount += newMessages;
        } catch (e) {
            logError("handleMutations", e);
        }
    }

    function cleanupObserver() {
        try {
            if (messageObserver) {
                messageObserver.disconnect();
                messageObserver = null;
            }
            observerActive = false;
        } catch (e) {
            logError("cleanupObserver", e);
        }
    }

    function stopMessageObserver() {
        cleanupObserver();
        stopAutoSave();
    }

    function startAutoSave() {
        if (autoSaveTimer) clearInterval(autoSaveTimer);
        autoSaveTimer = setInterval(() => {
            if (currentMode === "cache") {
                const timeSinceLastSave = Date.now() - lastSaveTime;
                if (timeSinceLastSave >= AUTO_SAVE_INTERVAL) saveCurrentMessages();
            }
        }, 60 * 1000);
        console.log("[CHE] 自動保存定時器已啟動 (5分鐘間隔)");
    }

    function stopAutoSave() {
        if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
    }

    async function saveCurrentMessages() {
        if (currentMode !== "cache") return;
        const messages = processCurrentMessages();
        if (messages.length > 0) {
            try {
                const savedCount = await CacheManager.saveToday(messages);
                currentMessageCount = 0;
                lastSaveTime = Date.now();
            } catch (e) {
                logError("saveCurrentMessages", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 自動保存失敗", 3000, "#ff0000");
            }
        }
    }

    function setupDataBackup() {
        window.addEventListener('beforeunload', () => {
            if (currentMode === "cache") saveToLocalStorage("beforeunload事件");
            cleanupObserver();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (observerActive) observerActive = false;
                if (currentMode === "cache") saveToLocalStorage("頁面隱藏");
            } else {
                if (messageObserver && !observerActive) observerActive = true;
            }
        });
    }

    function saveToLocalStorage(reason) {
        try {
            const messages = processCurrentMessages();
            if (messages.length > 0) {
                const tempData = {
                    messages: messages,
                    date: DateUtils.getDateKey(),
                    accountPrefix: getAccountPrefix(),
                    timestamp: Date.now(),
                    count: messages.length,
                    reason: reason
                };
                localStorage.setItem(`che_temp_data_${getAccountPrefix()}`, JSON.stringify(tempData));
            }
        } catch (e) {
            logError("saveToLocalStorage", e);
        }
    }

    async function checkTempData() {
        const storageKey = `che_temp_data_${getAccountPrefix()}`;
        try {
            const tempDataStr = localStorage.getItem(storageKey);
            if (!tempDataStr) return;

            let tempData;
            try {
                tempData = JSON.parse(tempDataStr);
            } catch (parseError) {
                logError("checkTempData.parse", parseError);
                localStorage.removeItem(storageKey);
                return;
            }

            const currentDate = DateUtils.getDateKey();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = DateUtils.getDateKey(yesterday);

            if ((tempData.date === currentDate || tempData.date === yesterdayKey) && tempData.messages?.length > 0) {
                try {
                    await CacheManager.saveToday(tempData.messages);
                    currentMessageCount = 0;
                    lastSaveTime = Date.now();
                    window.ChatRoomSendLocalStyled(`[CHE] 恢復了 ${tempData.messages.length} 條未保存的訊息`, 4000, "#00ff00");
                } catch (saveError) {
                    logError("checkTempData.save", saveError);
                    window.ChatRoomSendLocalStyled("[CHE] ❌ 恢復數據保存失敗", 3000, "#ff0000");
                }
            }
            localStorage.removeItem(storageKey);
        } catch (e) {
            logError("checkTempData", e);
            try { localStorage.removeItem(storageKey); } catch (_) {}
        }
    }

    function addUI() {
        const existingContainer = document.querySelector("#chatlogger-container");
        if (existingContainer) existingContainer.remove();

        const container = document.createElement("div");
        container.id = "chatlogger-container";
        container.style.cssText = `position: fixed; bottom: 20px; left: 20px; z-index: 1000;`;

        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "💾";
        toggleButton.style.cssText = `
            width: 60px; height: 60px; cursor: pointer; border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff; border: none; opacity: 0.5;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-size: 24px; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(10px); user-select: none;
        `;
        toggleButton.title = "聊天室記錄管理器 v2.2";

        let currentBaseColor = "#95a5a6";
        let currentShadowColor = "rgba(149, 165, 166, 0.4)";

        toggleButton.onmouseover = () => { toggleButton.style.opacity = "1"; toggleButton.style.transform = "scale(1.1) rotate(5deg)"; toggleButton.style.boxShadow = `0 12px 48px ${currentShadowColor}`; };
        toggleButton.onmouseout = () => { toggleButton.style.opacity = "0.5"; toggleButton.style.transform = "scale(1) rotate(0deg)"; toggleButton.style.background = currentBaseColor; toggleButton.style.boxShadow = `0 8px 32px ${currentShadowColor}`; };

        function updateButtonColors(mode) {
            if (mode === "cache") {
                currentBaseColor = "#644CB0";
                currentShadowColor = "rgba(100, 76, 176, 0.4)";
            } else {
                currentBaseColor = "#95a5a6";
                currentShadowColor = "rgba(149, 165, 166, 0.4)";
            }
            toggleButton.style.background = currentBaseColor;
            toggleButton.style.boxShadow = `0 8px 32px ${currentShadowColor}`;
        }

        const toolbar = document.createElement("div");
        toolbar.id = "chatlogger-toolbar";
        toolbar.style.cssText = `
            display: none; position: absolute; bottom: 70px; left: 0;
            background: linear-gradient(135deg, rgba(44, 62, 80, 0.95) 0%, rgba(52, 73, 94, 0.95) 100%);
            backdrop-filter: blur(15px); padding: 15px; border-radius: 12px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.3), 0 5px 15px rgba(0,0,0,0.2);
            flex-direction: column; gap: 10px; min-width: 160px;
            border: 1px solid rgba(255,255,255,0.1); user-select: none;
        `;

        const createButton = (label, handler, gradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)") => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.style.cssText = `
                padding: 10px 15px; font-size: 14px; text-align: left; font-weight: 600;
                background: ${gradient}; color: #fff; border: none; border-radius: 8px;
                cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.2); user-select: none;
            `;
            btn.onmouseover = () => { btn.style.transform = 'translateY(-2px) scale(1.02)'; btn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)'; };
            btn.onmouseout = () => { btn.style.transform = 'translateY(0) scale(1)'; btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)'; };
            btn.onclick = () => {
                if (!DOMCache.getChatLog()) {
                    window.ChatRoomSendLocalStyled("❌ 聊天室尚未載入", 3000, "#ff0000");
                    return;
                }
                handler();
            };
            return btn;
        };

        const btnHTML = createButton("📥 HTML匯出", () => exportHTML(false), "linear-gradient(135deg, #3498db 0%, #2980b9 100%)");
        const btnExcel = createButton("📥 Excel匯出", exportExcel, "linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)");
        const btnClear = createButton("🗑️ 清除聊天室", clearCache, "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)");
        const btnCache = createButton("💾 緩存管理", export_DB_HTML, "linear-gradient(135deg, #f39c12 0%, #e67e22 100%)");
        const btnMode = createButton("⏸️ 停用", () => { toggleMode(btnMode); updateButtonColors(currentMode); }, "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)");

        [btnHTML, btnExcel, btnClear, btnCache, btnMode].forEach(btn => toolbar.appendChild(btn));

        container.appendChild(toggleButton);
        container.appendChild(toolbar);
        document.body.appendChild(container);

        toggleButton.onclick = () => {
            const isVisible = toolbar.style.display === "flex";
            toolbar.style.display = isVisible ? "none" : "flex";
        };

        function updateModeButton(btn) {
            if (currentMode === "cache") {
                btn.textContent = "💾 緩存中";
                btn.style.background = "linear-gradient(135deg, #644CB0 0%, #552B90 100%)";
            } else {
                btn.textContent = "⏸️ 停用";
                btn.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
            }
        }

        updateModeButton(btnMode);
        updateButtonColors(currentMode);

        const style = document.createElement('style');
        style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
        document.head.appendChild(style);

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
            btn.textContent = "💾 緩存中";
            btn.style.background = "linear-gradient(135deg, #644CB0 0%, #552B90 100%)";
        } else {
            btn.textContent = "⏸️ 停用";
            btn.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
        }

        if (window.updateCHEButtonColors) window.updateCHEButtonColors(currentMode);
    }

    async function init() {
        try {
            await loadToastSystem();
            setupDataBackup();

            const waitForPlayer = setInterval(() => {
                if (window.Player?.Name) {
                    clearInterval(waitForPlayer);
                    console.log(`[CHE] 玩家數據已載入 (帳號: ${getAccountPrefix()})，開始初始化插件`);

                    checkTempData().catch(e => logError("init.checkTempData", e));
                    CacheManager.cleanOldData().catch(e => logError("init.cleanOldData", e));

                    addUI();

                    if (currentMode === "cache") initMessageObserver();

                    console.log("[CHE] 插件初始化完成，當前模式:", currentMode);
                }
            }, 1000);

            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE Enhanced",
                    fullName: "Chat History Export Enhanced v2.2",
                    version: modversion,
                    repository: "Enhanced chat room history export with 7-day cache",
                });
            }
        } catch (e) {
            logError("init", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 初始化失敗", 3000, "#ff0000");
        }
    }

    init();
})();
