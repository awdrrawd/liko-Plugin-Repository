// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      2.1.1
// @description  聊天室紀錄匯出
// @author       莉柯莉絲(likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==
(function() {
    "use strict";

    let modApi;
    const modversion = "2.1.1";
    let currentMessageCount = 0;
    const AUTO_SAVE_INTERVAL = 10 * 60 * 1000; // 10分钟保存一次碎片
    let autoSaveTimer = null;
    let lastSaveTime = Date.now();
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped";
    const validModes = ["stopped", "cache"];

    // 全局觀察器管理
    let messageObserver = null;
    let observerActive = false;

    // 統一的錯誤報告機制
    window.cheErrorCount = 0;
    function logError(location, error) {
        window.cheErrorCount++;
        console.error(`[CHE-${window.cheErrorCount}] ${location}:`, error);
    }

    // DOM 快取管理 - 加強錯誤處理
    const DOMCache = {
        chatLog: null,
        lastCheckTime: 0,

        getChatLog() {
            const now = Date.now();
            try {
                if (!this.chatLog || !document.contains(this.chatLog) || now - this.lastCheckTime > 5000) {
                    this.chatLog = document.querySelector("#TextAreaChatLog");
                    this.lastCheckTime = now;

                    if (!this.chatLog) {
                        console.warn("[CHE] ChatLog 元素未找到");
                        return null;
                    }
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

                const messages = log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div");
                return Array.from(messages);
            } catch (e) {
                logError("DOMCache.getMessages", e);
                return [];
            }
        },

        getMessageCount() {
            try {
                const log = this.getChatLog();
                if (!log) return 0;

                const messages = log.querySelectorAll(".ChatMessage, a.beep-link");
                return messages.length;
            } catch (e) {
                logError("DOMCache.getMessageCount", e);
                return 0;
            }
        }
    };

    // 改進的日期工具 - 支援用戶時區
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
                if (dateParts.length !== 3) {
                    console.warn("[CHE] 無效的日期格式:", dateKey);
                    return dateKey;
                }

                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1;
                const day = parseInt(dateParts[2]);

                const date = new Date(year, month, day);

                if (isNaN(date.getTime())) {
                    console.warn("[CHE] 無效的日期:", dateKey);
                    return dateKey;
                }

                const displayMonth = date.getMonth() + 1;
                const displayDay = date.getDate();
                return `${displayMonth}/${displayDay}`;
            } catch (e) {
                logError("DateUtils.getDisplayDate", e);
                return dateKey;
            }
        },

        isToday(dateKey) {
            try {
                const today = this.getDateKey();
                return dateKey === today;
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

        parseTimeString(timeStr) {
            if (!timeStr || typeof timeStr !== 'string') {
                console.warn("[CHE] parseTimeString: 無效的時間字符串");
                return new Date();
            }

            try {
                if (timeStr.includes('T')) {
                    const date = new Date(timeStr);
                    if (!isNaN(date.getTime())) {
                        return date;
                    }
                }

                if (timeStr.match(/^\d{2}:\d{2}:\d{2}$/)) {
                    const today = new Date();
                    const timeParts = timeStr.split(':');

                    if (timeParts.length === 3) {
                        const hours = parseInt(timeParts[0], 10);
                        const minutes = parseInt(timeParts[1], 10);
                        const seconds = parseInt(timeParts[2], 10);

                        if (hours >= 0 && hours <= 23 &&
                            minutes >= 0 && minutes <= 59 &&
                            seconds >= 0 && seconds <= 59) {

                            today.setHours(hours, minutes, seconds, 0);
                            return today;
                        }
                    }
                }

                const parsedDate = new Date(timeStr);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }

                console.warn("[CHE] 無法解析時間字符串:", timeStr);
                return new Date();

            } catch (e) {
                logError("DateUtils.parseTimeString", e);
                return new Date();
            }
        },

        formatTimeForDisplay(date) {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                console.warn("[CHE] formatTimeForDisplay: 無效的日期對象");
                return "無效時間";
            }

            try {
                return date.toLocaleTimeString('zh-CN', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } catch (e) {
                logError("DateUtils.formatTimeForDisplay", e);
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');
                return `${hours}:${minutes}:${seconds}`;
            }
        }
    };

    // 緩存管理器
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

        async saveToday(messages) {
            if (!messages || messages.length === 0) {
                console.log("[CHE] saveToday: 沒有訊息需要保存");
                return;
            }

            try {
                const db = await this.init();
                const dateKey = DateUtils.getDateKey();

                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                const existing = await new Promise((resolve, reject) => {
                    const req = store.get(dateKey);
                    req.onsuccess = () => {
                        const result = req.result;
                        resolve(result ? result.messages : []);
                    };
                    req.onerror = () => {
                        logError("CacheManager.saveToday.getExisting", req.error);
                        reject(req.error);
                    };
                });

                const existingKeys = new Set();
                existing.forEach(msg => {
                    const key = `${msg.time}-${msg.id}-${msg.content.substring(0, 50)}`;
                    existingKeys.add(key);
                });

                const newMessages = messages.filter(msg => {
                    const key = `${msg.time}-${msg.id}-${msg.content.substring(0, 50)}`;
                    return !existingKeys.has(key);
                });

                if (newMessages.length === 0) {
                    console.log("[CHE] saveToday: 所有消息都已存在，跳过保存");
                    return 0;
                }

                const allMessages = [...existing, ...newMessages];

                await new Promise((resolve, reject) => {
                    const data = {
                        messages: allMessages,
                        count: allMessages.length,
                        lastUpdate: Date.now()
                    };
                    const req = store.put(data, dateKey);
                    req.onsuccess = () => {
                        console.log(`[CHE] 成功保存 ${newMessages.length} 條新訊息到 ${dateKey}，總計 ${allMessages.length} 條`);
                        resolve();
                    };
                    req.onerror = () => {
                        logError("CacheManager.saveToday.put", req.error);
                        reject(req.error);
                    };
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

                const result = [];
                for (const key of keys) {
                    const data = await new Promise((resolve, reject) => {
                        const req = store.get(key);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });

                    if (data) {
                        result.push({
                            dateKey: key,
                            count: data.count || 0,
                            display: DateUtils.getDisplayDate(key)
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
                        const messagesWithFlag = data.messages.map(msg => ({
                            ...msg,
                            isFromCache: true
                        }));
                        allMessages.push(...messagesWithFlag);
                    }
                }

                allMessages.sort((a, b) => {
                    const timeA = new Date(a.time || "1970-01-01").getTime();
                    const timeB = new Date(b.time || "1970-01-01").getTime();
                    return timeA - timeB;
                });

                console.log(`[CHE] 從緩存獲取了 ${allMessages.length} 條訊息`);
                return allMessages;
            } catch (e) {
                logError("CacheManager.getMessagesForDates", e);
                return [];
            }
        },

        async deleteDates(dateKeys) {
            if (!dateKeys || dateKeys.length === 0) {
                console.log("[CHE] deleteDates: 沒有要刪除的日期");
                return false;
            }

            console.log(`[CHE] deleteDates: 開始刪除操作，目標日期:`, dateKeys);

            try {
                const db = await this.init();
                console.log("[CHE] deleteDates: 數據庫連接成功");

                let successCount = 0;
                for (const dateKey of dateKeys) {
                    try {
                        console.log(`[CHE] deleteDates: 處理日期 ${dateKey}`);

                        const tx = db.transaction(["daily_fragments"], "readwrite");
                        const store = tx.objectStore("daily_fragments");

                        await new Promise((resolve, reject) => {
                            const deleteReq = store.delete(dateKey);
                            deleteReq.onsuccess = () => {
                                console.log(`[CHE] deleteDates: ✓ 成功刪除 ${dateKey}`);
                                successCount++;
                                resolve();
                            };
                            deleteReq.onerror = () => {
                                logError("CacheManager.deleteDates.delete", deleteReq.error);
                                resolve();
                            };
                        });

                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        });

                    } catch (itemError) {
                        logError("CacheManager.deleteDates.item", itemError);
                    }
                }

                console.log(`[CHE] deleteDates: 刪除完成，成功刪除 ${successCount}/${dateKeys.length} 個項目`);

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

        async cleanOldData() {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoffKey = DateUtils.getDateKey(sevenDaysAgo);

            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                const keysToDelete = keys.filter(key => key < cutoffKey);

                if (keysToDelete.length > 0) {
                    for (const key of keysToDelete) {
                        await new Promise((resolve, reject) => {
                            const req = store.delete(key);
                            req.onsuccess = () => resolve();
                            req.onerror = () => reject(req.error);
                        });
                    }
                    console.log(`[CHE] 已清理 ${keysToDelete.length} 個過期日期的數據`);
                }
            } catch (e) {
                logError("CacheManager.cleanOldData", e);
            }
        }
    };

    // 載入樣式化訊息系統
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) {
                resolve();
                return;
            }
            const toastUrl = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js`;
            const script = document.createElement('script');
            script.src = toastUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    // XLSX 載入檢查
    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = () => console.log("[CHE] xlsx.full.min.js 載入完成");
        document.head.appendChild(script);
    }

    // 统一的消息过滤函数
    function isFilteredMessage(content, messageType, includePrivate = true) {
        const basicFilters = [
            "BCX commands tutorial",
            "BCX also provides",
            "(输入 /help 查看命令列表)"
        ];

        if (basicFilters.some(filter => content.includes(filter))) {
            return true;
        }

        if (includePrivate) {
            if (messageType === "beep") {
                return true;
            }
        } else {
            if (messageType === "whisper" || messageType === "beep") {
                return true;
            }

            if (content.includes("↩️")) {
                return true;
            }

            const privateKeywords = ["悄悄話", "悄悄话", "好友私聊", "BEEP"];
            if (privateKeywords.some(keyword => content.includes(keyword))) {
                return true;
            }
        }

        return false;
    }

    // 安全的消息類型檢測
    function detectMessageType(msg, content) {
        if (!msg || !content) {
            console.warn("[CHE] detectMessageType: 參數不完整");
            return "normal";
        }

        try {
            if (msg.matches && typeof msg.matches === 'function') {
                if (msg.matches("a.beep-link")) {
                    return "beep";
                }
            }

            if (msg.classList && msg.classList.contains("ChatMessageWhisper")) {
                return "whisper";
            }

            if (typeof content === 'string') {
                if (content.includes("好友私聊来自") || content.includes("BEEP")) {
                    if (content.includes("↩️") && !(msg.matches && msg.matches("a.beep-link"))) {
                        return "beep_duplicate";
                    }
                    return "beep";
                }

                if (content.includes("悄悄话") || content.includes("悄悄話")) {
                    return "whisper";
                }
            }

            return "normal";
        } catch (e) {
            logError("detectMessageType", e);
            return "normal";
        }
    }

    // HTML 轉義函數
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 安全的文本提取
    function extractFullTextContent(element) {
        if (!element) {
            console.warn("[CHE] extractFullTextContent: 元素為空");
            return "";
        }

        try {
            const clone = element.cloneNode(true);

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
                logError("extractFullTextContent.fallback", fallbackError);
                return "";
            }
        }
    }

    // 安全的標籤顏色獲取
    function getLabelColor(msg, nameButton) {
        if (!msg) {
            console.warn("[CHE] getLabelColor: msg 參數為空");
            return "#000";
        }

        try {
            let c = "";

            if (msg.style && typeof msg.style.getPropertyValue === 'function') {
                c = msg.style.getPropertyValue("--label-color");
            }

            if (!c && window.getComputedStyle) {
                try {
                    c = getComputedStyle(msg).getPropertyValue("--label-color");
                } catch (computedError) {
                    console.warn("[CHE] getComputedStyle 失敗:", computedError);
                }
            }

            if (!c && nameButton) {
                try {
                    if (nameButton.style && typeof nameButton.style.getPropertyValue === 'function') {
                        c = nameButton.style.getPropertyValue("--label-color");
                    }
                    if (!c && window.getComputedStyle) {
                        c = getComputedStyle(nameButton).getPropertyValue("--label-color");
                    }
                } catch (nameButtonError) {
                    console.warn("[CHE] nameButton 顏色獲取失敗:", nameButtonError);
                }
            }

            c = (c || "").trim();
            if (c) return c;

            const colorSpan = msg.querySelector('[style*="color"]');
            if (colorSpan && colorSpan.style && colorSpan.style.color) {
                return colorSpan.style.color;
            }

            const fontEl = msg.querySelector("font[color]");
            if (fontEl && fontEl.color) {
                return fontEl.color;
            }

            return "#000";
        } catch (e) {
            logError("getLabelColor", e);
            return "#000";
        }
    }

    // 改進的顏色對比度處理
    function getEnhancedContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return isDarkTheme ? "#eee" : "#333";

        let cleanColor = hexColor.trim();

        if (cleanColor.startsWith('rgb')) {
            const match = cleanColor.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
            if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                cleanColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
            }
        }

        if (!cleanColor.startsWith('#')) return cleanColor;
        if (cleanColor.length !== 7) return cleanColor;

        try {
            const r = parseInt(cleanColor.slice(1, 3), 16);
            const g = parseInt(cleanColor.slice(3, 5), 16);
            const b = parseInt(cleanColor.slice(5, 7), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            if (isDarkTheme) {
                if (luminance < 0.4) {
                    return lightenColor(cleanColor, 0.6);
                } else if (luminance < 0.6) {
                    return lightenColor(cleanColor, 0.3);
                }
                return cleanColor;
            } else {
                if (luminance > 0.7) {
                    return darkenColor(cleanColor, 0.6);
                } else if (luminance > 0.5) {
                    return darkenColor(cleanColor, 0.3);
                }
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
        } catch (e) {
            return color;
        }
    }

    function darkenColor(color, amount) {
        try {
            const num = parseInt(color.slice(1), 16);
            const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
            const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
            const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
            return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
        } catch (e) {
            return color;
        }
    }

    // DB專用的內容解析函數
    function parseDBContent(content, id, time) {
        if (!content) return { isNormal: true, displayContent: "" };

        if (content.startsWith('˅')) {
            return {
                isRoom: true,
                content: content,
                displayContent: content
            };
        }

        let cleanContent = content;

        const timeMatch = content.match(/^(\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
            cleanContent = content.substring(timeMatch[1].length);
        }

        if (id && cleanContent.startsWith(id)) {
            cleanContent = cleanContent.substring(id.length);
        }

        const endPattern = /(\d{2}:\d{2}:\d{2}\d+(?:Reply)?)$/;
        cleanContent = cleanContent.replace(endPattern, '');

        if (cleanContent.startsWith('˅')) {
            return { isSkip: true };
        }

        if (cleanContent.startsWith('*') || cleanContent.startsWith('(')) {
            return {
                isAction: true,
                displayContent: cleanContent.trim()
            };
        }

        const first20 = cleanContent.substring(0, 20);
        const colonIndex = first20.indexOf(':');

        if (colonIndex !== -1 && colonIndex > 0) {
            const userName = cleanContent.substring(0, colonIndex);
            const userMessage = cleanContent.substring(colonIndex + 1);
            return {
                isUser: true,
                userName: userName.trim(),
                userMessage: userMessage.trim(),
                displayContent: cleanContent
            };
        }

        return {
            isNormal: true,
            displayContent: cleanContent.trim()
        };
    }

    // HTML模板生成函數
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

            body {
                font-family: sans-serif;
                background: var(--bg-color);
                color: var(--text-color);
                transition: all 0.3s ease;
                margin: 0;
                padding: 0;
            }

            .chat-row {
                display: flex;
                align-items: flex-start;
                margin: 2px 0;
                padding: 2px 6px;
                border-radius: 6px;
            }

            .chat-meta {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                width: 70px;
                font-size: 0.8em;
                margin-right: 8px;
                flex-shrink: 0;
            }

            .chat-time {
                color: var(--muted-text);
            }

            .chat-id {
                font-weight: bold;
            }

            .chat-content {
                flex: 1;
                white-space: pre-wrap;
                word-wrap: break-word;
            }

            .with-accent {
                border-left: 4px solid transparent;
            }

            .separator-row {
                background: var(--separator-bg);
                border-left: 4px solid var(--separator-border);
                text-align: center;
                font-weight: bold;
                padding: 8px;
                margin: 4px 0;
                border-radius: 8px;
            }

            .collapse-button {
                background: none;
                border: none;
                color: inherit;
                font-size: 16px;
                cursor: pointer;
                padding: 6px 10px;
                border-radius: 4px;
            }

            .collapse-button:hover {
                background: rgba(255,255,255,0.1);
            }

            body.light .collapse-button:hover {
                background: rgba(0,0,0,0.1);
            }

            .collapsible-content {
                display: block;
            }

            .collapsible-content.collapsed {
                display: none;
            }

            #toggleTheme {
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                background: #fff;
                color: #000;
                transition: all 0.3s ease;
                font-weight: bold;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                z-index: 1001;
            }

            body.light #toggleTheme {
                background: #333;
                color: #fff;
            }

            .user-name {
                font-weight: bold;
            }

            .action-text {
                font-style: italic;
                opacity: 0.9;
            }

            .beep {
                color: var(--beep-color);
                font-weight: bold;
            }

            input::placeholder, select option {
                color: var(--muted-text) !important;
            }

            .enhanced-color {
                filter: brightness(1.2) saturate(1.1);
            }

            body.light .enhanced-color {
                filter: brightness(0.8) saturate(1.2);
            }

            @media (max-width: 768px) {
                .chat-meta {
                    width: 60px;
                    font-size: 0.7em;
                }

                #searchPanel > div {
                    flex-direction: column;
                    align-items: stretch;
                }

                #searchPanel input, #searchPanel select {
                    width: 100% !important;
                    margin-bottom: 5px;
                }
            }
        </style>
    </head>
    <body>
        <button id="toggleTheme">🌞 淺色模式</button>
        ${searchControls}
        <div id="chatlog">
    `;
    }

    // HTML footer
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
                if (timeStr.includes('T')) {
                    return new Date(timeStr);
                }
                const today = new Date();
                const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                today.setHours(hours, minutes, seconds || 0, 0);
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
                            } catch (e) {
                                // 時間解析失敗保持可見
                            }
                        }
                    }

                    row.style.display = visible ? 'flex' : 'none';
                    if (visible) visibleCount++;
                });

                document.getElementById('filterStats').textContent =
                    \`顯示 \${visibleCount} / \${allChatRows.length} 條訊息\`;
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
                this.innerHTML = isLight ? "🌙 暗色模式" : "🌞 淺色模式";
            };

            applyFilters();
        </script>
    </body>
    </html>
    `;
    }

    // 修改后的processCurrentMessages函数
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];

        messages.forEach(msg => {
            try {
                const rawContent = extractFullTextContent(msg);
                const messageType = detectMessageType(msg, rawContent);

                let messageData = {
                    time: msg.dataset?.time || new Date().toISOString(),
                    id: msg.dataset?.sender || "",
                    content: rawContent,
                    type: messageType,
                    color: getLabelColor(msg, msg.querySelector(".ChatMessageName"))
                };

                processedMessages.push(messageData);

            } catch (e) {
                logError("processCurrentMessages", e);
            }
        });

        return processedMessages;
    }

    // 修改后的DB HTML生成函数
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
            const parsed = parseDBContent(msg.content, msg.id, msg.time);

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

            if (isFilteredMessage(msg.content, msg.type, includePrivate)) {
                continue;
            }

            if (lastSeparatorText && msg.content.includes(lastSeparatorText)) continue;

            let timeDisplay = msg.time;
            if (typeof msg.time === 'string') {
                if (msg.time.includes('T')) {
                    try {
                        timeDisplay = DateUtils.formatTimeForDisplay(new Date(msg.time));
                    } catch (e) {
                        console.warn("[CHE] 时间转换失败:", msg.time);
                        timeDisplay = msg.time;
                    }
                }
            }

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

    // 修改後的Chat HTML生成函數
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

                if (msg.matches && msg.matches("a.beep-link")) {
                    continue;
                }

                if (!msg.dataset) continue;

                const time = msg.dataset.time || "";
                const senderId = msg.dataset.sender || "";
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton ? nameButton.innerText : "";
                let labelColor = getLabelColor(msg, nameButton);
                const adjustedColor = getEnhancedContrastColor(labelColor, isDarkTheme);

                let rawText = "";
                const textNode = msg.querySelector(".chat-room-message-content");
                if (textNode) {
                    rawText = extractFullTextContent(textNode);
                } else {
                    const clonedMsg = msg.cloneNode(true);
                    clonedMsg.querySelectorAll('.chat-room-metadata, .chat-room-message-popup, .ChatMessageName').forEach(meta => meta.remove());
                    rawText = extractFullTextContent(clonedMsg).trim();
                }

                const messageType = detectMessageType(msg, rawText);

                if (isFilteredMessage(rawText, messageType, includePrivate)) {
                    continue;
                }

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
                    const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                    content = `${prefix} <span class="user-name" style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                } else if (
                    msg.classList.contains("ChatMessageAction") ||
                    msg.classList.contains("ChatMessageActivity") ||
                    msg.classList.contains("ChatMessageEmote") ||
                    msg.classList.contains("ChatMessageEnterLeave")
                ) {
                    content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
                } else if (msg.classList.contains("ChatMessageLocalMessage") || msg.classList.contains("ChatMessageNonDialogue")) {
                    const systemColor = getEnhancedContrastColor('#3aa76d', isDarkTheme);
                    content = `<span style="color:${systemColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
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
                buttons = options.map((opt, idx) =>
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
                modal.querySelector("#customPromptYes").onclick = () => {
                    document.body.removeChild(modal);
                    resolve(true);
                };
                modal.querySelector("#customPromptNo").onclick = () => {
                    document.body.removeChild(modal);
                    resolve(false);
                };
            } else {
                modal.querySelectorAll("button[data-value]").forEach(btn => {
                    btn.onclick = () => {
                        document.body.removeChild(modal);
                        resolve(btn.dataset.value);
                    };
                });
            }
        });
    }

    // 改進的日期選擇器 - 簡化UI
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

            // 添加樣式表
            const dateStyle = document.createElement('style');
            dateStyle.textContent = `
                .date-option {
                    position: relative;
                    overflow: hidden;
                }

                .date-option.selected {
                    border-color: #9b59b6 !important;
                    background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%) !important;
                    box-shadow: 0 4px 15px rgba(155, 89, 182, 0.4) !important;
                }

                .date-option.selected::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 0;
                    height: 0;
                    border-style: solid;
                    border-width: 20px 20px 0 0;
                    border-color: #e74c3c transparent transparent transparent;
                    z-index: 1;
                }

                .date-option.selected::after {
                    content: '✓';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    color: white;
                    font-size: 12px;
                    font-weight: bold;
                    z-index: 2;
                }

                .date-option:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                }

                #closeBtn:hover {
                    background: rgba(231, 76, 60, 0.2) !important;
                    color: #e74c3c !important;
                }
            `;
            document.head.appendChild(dateStyle);

            // 日期选项点击事件
            const dateOptionElements = modal.querySelectorAll('.date-option');
            dateOptionElements.forEach(option => {
                option.addEventListener('click', () => {
                    option.classList.toggle('selected');
                });

                option.addEventListener('mouseenter', () => {
                    if (!option.classList.contains('selected')) {
                        option.style.borderColor = '#3498db';
                        option.style.background = 'linear-gradient(135deg, #34495e 0%, #2c3e50 100%)';
                    }
                });

                option.addEventListener('mouseleave', () => {
                    if (!option.classList.contains('selected')) {
                        option.style.borderColor = 'transparent';
                        option.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
                    }
                });
            });

            // 添加懸停效果
            const buttons = modal.querySelectorAll('button:not(#closeBtn)');
            buttons.forEach(btn => {
                btn.addEventListener('mouseenter', () => {
                    btn.style.transform = 'translateY(-2px) scale(1.05)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.transform = 'translateY(0) scale(1)';
                });
            });

            // 事件處理
            modal.querySelector("#selectAll").onclick = () => {
                const allSelected = Array.from(dateOptionElements).every(opt => opt.classList.contains('selected'));
                dateOptionElements.forEach(opt => {
                    if (allSelected) {
                        opt.classList.remove('selected');
                    } else {
                        opt.classList.add('selected');
                    }
                });
            };

            modal.querySelector("#closeBtn").onclick = () => {
                document.body.removeChild(modal);
                dateStyle.remove();
                resolve(null);
            };

            modal.querySelector("#exportBtn").onclick = async () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected'))
                    .map(opt => opt.dataset.value);
                if (selected.length === 0) {
                    alert('請選擇要匯出的日期');
                    return;
                }

                document.body.removeChild(modal);
                dateStyle.remove();

                // 檢查是否包含今天，如果包含則先合併當前碎片
                const today = DateUtils.getDateKey();
                if (selected.includes(today)) {
                    console.log("[CHE] 匯出包含今天，先保存當前訊息");
                    const currentMessages = processCurrentMessages();
                    if (currentMessages.length > 0) {
                        await CacheManager.saveToday(currentMessages);
                        currentMessageCount = 0;
                    }
                }

                resolve({ action: 'export', dates: selected });
            };

            modal.querySelector("#deleteBtn").onclick = () => {
                const selected = Array.from(modal.querySelectorAll('.date-option.selected'))
                    .map(opt => opt.dataset.value);
                if (selected.length === 0) {
                    alert('請選擇要刪除的日期');
                    return;
                }
                document.body.removeChild(modal);
                dateStyle.remove();
                resolve({ action: 'delete', dates: selected });
            };
        });
    }

    // 修復的DB匯出函數
    async function export_DB_HTML() {
        const result = await showDateSelector();
        if (!result) return;

        if (result.action === 'delete') {
            const confirmDelete = await showCustomPrompt(`確定要刪除 ${result.dates.length} 個日期的數據嗎？`);
            if (confirmDelete) {
                await CacheManager.deleteDates(result.dates);
            }
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

    // 修復的Chat匯出函數
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

    // 簡化的匯出HTML函數
    async function exportHTML(fromCache = false) {
        if (fromCache) {
            await export_DB_HTML();
        } else {
            await exportChatAsHTML();
        }
    }

    // 修改后的Excel导出函数
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
            const data = [["時間", "ID", "內容"]];

            messages.forEach(msg => {
                if (isFilteredMessage(msg.content, msg.type, includePrivate)) {
                    return;
                }

                const timeDisplay = typeof msg.time === 'string' && msg.time.includes('T')
                ? new Date(msg.time).toLocaleString()
                : msg.time;

                data.push([timeDisplay, msg.id, msg.content]);
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

    // 清空當前聊天室
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

    // 改進的訊息監控
    function initMessageObserver() {
        console.log("[CHE] 開始初始化訊息監控");

        cleanupObserver();

        const maxWaitTime = 10 * 60 * 1000;
        const startTime = Date.now();

        const checkChatRoom = setInterval(() => {
            try {
                const chatLog = DOMCache.getChatLog();
                if (chatLog && document.contains(chatLog)) {
                    clearInterval(checkChatRoom);
                    console.log("[CHE] 聊天室容器已找到，啟動訊息監控");

                    currentMessageCount = DOMCache.getMessageCount();
                    console.log("[CHE] 初始訊息數量:", currentMessageCount);

                    messageObserver = new MutationObserver(handleMutations);

                    const observerConfig = {
                        childList: true,
                        subtree: true,
                        attributes: false,
                        characterData: false
                    };

                    try {
                        messageObserver.observe(chatLog, observerConfig);
                        observerActive = true;
                        console.log("[CHE] MutationObserver 已啟動");

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

    // 處理 DOM 變化
    function handleMutations(mutations) {
        if (!observerActive) return;

        try {
            let newMessages = 0;

            mutations.forEach((mutation) => {
                if (!mutation.addedNodes || mutation.addedNodes.length === 0) return;

                mutation.addedNodes.forEach((node) => {
                    try {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && (
                                node.matches(".ChatMessage") ||
                                node.matches("a.beep-link")
                            )) {
                                newMessages++;
                            }
                        }
                    } catch (nodeError) {
                        console.warn("[CHE] 處理新增節點時錯誤:", nodeError);
                    }
                });
            });

            if (newMessages > 0) {
                currentMessageCount += newMessages;
                console.log(`[CHE] 檢測到 ${newMessages} 條新訊息，當前總數: ${currentMessageCount}`);
            }

        } catch (e) {
            logError("handleMutations", e);
        }
    }

    // 清理觀察器
    function cleanupObserver() {
        try {
            if (messageObserver) {
                messageObserver.disconnect();
                messageObserver = null;
                console.log("[CHE] MutationObserver 已清理");
            }
            observerActive = false;
        } catch (e) {
            logError("cleanupObserver", e);
        }
    }

    // 停止觀察器
    function stopMessageObserver() {
        console.log("[CHE] 停止訊息監控");
        cleanupObserver();
        stopAutoSave();
    }

    // 启动自动保存定时器
    function startAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
        }

        autoSaveTimer = setInterval(() => {
            if (currentMode === "cache") {
                const now = Date.now();
                const timeSinceLastSave = now - lastSaveTime;

                //console.log(`[CHE] 定時檢查: 距離上次保存 ${Math.round(timeSinceLastSave / 1000)} 秒`);

                if (timeSinceLastSave >= AUTO_SAVE_INTERVAL) {
                    console.log("[CHE] 達到10分鐘間隔，觸發自動保存");
                    saveCurrentMessages();
                }
            }
        }, 60 * 1000);

        console.log("[CHE] 自動保存定時器已啟動 (10分鐘間隔)");
    }

    // 停止自动保存定时器
    function stopAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
            console.log("[CHE] 自動保存定時器已停止");
        }
    }

    // 修改的保存當前訊息函數 - 移除頻繁提示
    async function saveCurrentMessages() {
        if (currentMode !== "cache") {
            console.log("[CHE] saveCurrentMessages: 非緩存模式，跳過保存");
            return;
        }

        console.log("[CHE] saveCurrentMessages: 開始自動保存當前訊息");
        const messages = processCurrentMessages();

        if (messages.length > 0) {
            try {
                const savedCount = await CacheManager.saveToday(messages);
                currentMessageCount = 0;
                lastSaveTime = Date.now();

                console.log(`[CHE] 自動保存完成：${savedCount} 條訊息，時間: ${new Date().toLocaleTimeString()}`);

                const chatLog = DOMCache.getChatLog();
                if (chatLog) {
                    const allMessages = Array.from(chatLog.querySelectorAll(".ChatMessage, a.beep-link"));
                    if (allMessages.length > 500) {
                        const toRemove = allMessages.slice(0, allMessages.length - 500);
                        toRemove.forEach(msg => msg.remove());
                        console.log(`[CHE] 清理了 ${toRemove.length} 條舊訊息，保留最新500條`);
                    }
                }
            } catch (e) {
                logError("saveCurrentMessages", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 自動保存失敗", 3000, "#ff0000");
            }
        } else {
            console.log("[CHE] saveCurrentMessages: 沒有新訊息需要保存");
        }
    }

    // 退出時保存和定期備份
    function setupDataBackup() {
        window.addEventListener('beforeunload', (e) => {
            if (currentMode === "cache") {
                saveToLocalStorage("beforeunload事件");
            }
            cleanupObserver();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (observerActive) {
                    //console.log("[CHE] 頁面隱藏，暫停觀察器");
                    observerActive = false;
                }
                if (currentMode === "cache") {
                    saveToLocalStorage("頁面隱藏");
                }
            } else {
                if (messageObserver && !observerActive) {
                    //console.log("[CHE] 頁面顯示，恢復觀察器");
                    observerActive = true;
                }
            }
        });
    }

    function saveToLocalStorage(reason) {
        try {
            const messages = processCurrentMessages();
            console.log(`[CHE] ${reason}: 準備保存 ${messages.length} 條訊息`);

            if (messages.length > 0) {
                const tempData = {
                    messages: messages,
                    date: DateUtils.getDateKey(),
                    timestamp: Date.now(),
                    count: messages.length,
                    reason: reason
                };

                localStorage.setItem('che_temp_data', JSON.stringify(tempData));
                console.log(`[CHE] ${reason}: 已臨時保存 ${messages.length} 條訊息`);
            } else {
                console.log(`[CHE] ${reason}: 沒有訊息需要保存`);
            }
        } catch (e) {
            logError("saveToLocalStorage", e);
        }
    }

    // 修改的頁面載入時檢查臨時數據
    async function checkTempData() {
        console.log("[CHE] checkTempData: 開始檢查臨時數據");

        try {
            const tempDataStr = localStorage.getItem('che_temp_data');

            if (!tempDataStr) {
                console.log("[CHE] checkTempData: 沒有找到臨時數據");
                return;
            }

            console.log("[CHE] checkTempData: 找到臨時數據，長度:", tempDataStr.length);

            let tempData;
            try {
                tempData = JSON.parse(tempDataStr);
                console.log("[CHE] checkTempData: 解析臨時數據成功:", {
                    date: tempData.date,
                    count: tempData.count,
                    reason: tempData.reason,
                    timestamp: new Date(tempData.timestamp).toLocaleString()
                });
            } catch (parseError) {
                logError("checkTempData.parse", parseError);
                localStorage.removeItem('che_temp_data');
                return;
            }

            const currentDate = DateUtils.getDateKey();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = DateUtils.getDateKey(yesterday);

            if (tempData.date === currentDate || tempData.date === yesterdayKey) {
                if (tempData.messages && tempData.messages.length > 0) {
                    console.log(`[CHE] checkTempData: 準備恢復 ${tempData.messages.length} 條訊息 (${tempData.date})`);

                    try {
                        await CacheManager.saveToday(tempData.messages);
                        currentMessageCount = 0;
                        lastSaveTime = Date.now();
                        console.log("[CHE] checkTempData: 恢復後重置計數器和時間");

                        window.ChatRoomSendLocalStyled(`[CHE] 恢復了 ${tempData.messages.length} 條未保存的訊息 (${tempData.reason})`, 4000, "#00ff00");
                        console.log(`[CHE] checkTempData: 成功恢復 ${tempData.messages.length} 條訊息`);
                    } catch (saveError) {
                        logError("checkTempData.save", saveError);
                        window.ChatRoomSendLocalStyled("[CHE] ❌ 恢復數據保存失敗", 3000, "#ff0000");
                    }
                } else {
                    console.log("[CHE] checkTempData: 臨時數據中沒有訊息");
                }
            } else {
                console.log(`[CHE] checkTempData: 臨時數據日期 ${tempData.date} 過舊，跳過恢復 (當前: ${currentDate})`);
            }

            localStorage.removeItem('che_temp_data');
            console.log("[CHE] checkTempData: 已清除臨時數據");

        } catch (e) {
            logError("checkTempData", e);
            try {
                localStorage.removeItem('che_temp_data');
            } catch (cleanupError) {
                logError("checkTempData.cleanup", cleanupError);
            }
        }
    }

    // 修復toggleButton懸停顏色問題的UI
    function addUI() {
        const existingContainer = document.querySelector("#chatlogger-container");
        if (existingContainer) {
            existingContainer.remove();
        }

        const container = document.createElement("div");
        container.id = "chatlogger-container";
        container.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; z-index: 1000;
        `;

        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "💾";
        toggleButton.style.cssText = `
            width: 60px; height: 60px; cursor: pointer; border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff; border: none; opacity: 0.9;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-size: 24px; display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(10px);
        `;
        toggleButton.title = "聊天室記錄管理器 v2.1";

        // 記錄當前模式的顏色
        let currentBaseColor = "#95a5a6";
        let currentShadowColor = "rgba(149, 165, 166, 0.4)";

        toggleButton.style.opacity = "0.5"; // 默認透明度50%

        toggleButton.onmouseover = () => {
            toggleButton.style.opacity = "1";
            toggleButton.style.transform = "scale(1.1) rotate(5deg)";
            toggleButton.style.boxShadow = `0 12px 48px ${currentShadowColor}`;
        };

        toggleButton.onmouseout = () => {
            toggleButton.style.opacity = "0.5";
            toggleButton.style.transform = "scale(1) rotate(0deg)";
            toggleButton.style.background = currentBaseColor;
            toggleButton.style.boxShadow = `0 8px 32px ${currentShadowColor}`;
        };

        // 更新按鈕顏色的函數
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
            border: 1px solid rgba(255,255,255,0.1);
        `;

        const createButton = (label, handler, gradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)") => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.style.cssText = `
                padding: 10px 15px; font-size: 14px; text-align: left; font-weight: 600;
                background: ${gradient}; color: #fff; border: none; border-radius: 8px;
                cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            `;

            btn.onmouseover = () => {
                btn.style.transform = 'translateY(-2px) scale(1.02)';
                btn.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
            };
            btn.onmouseout = () => {
                btn.style.transform = 'translateY(0) scale(1)';
                btn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            };

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
        const btnMode = createButton("⏸️ 停用", () => {
            toggleMode(btnMode);
            updateButtonColors(currentMode);
        }, "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)");

        [btnHTML, btnExcel, btnClear, btnCache, btnMode].forEach(btn => toolbar.appendChild(btn));

        container.appendChild(toggleButton);
        container.appendChild(toolbar);
        document.body.appendChild(container);

        toggleButton.onclick = () => {
            const isVisible = toolbar.style.display === "flex";
            toolbar.style.display = isVisible ? "none" : "flex";

            if (!isVisible) {
                toolbar.style.animation = "slideUp 0.3s ease-out";
            }
        };

        // 更新模式按鈕的函數也需要調用顏色更新
        function updateModeButton(btn) {
            if (currentMode === "cache") {
                btn.textContent = "💾 緩存中";
                btn.style.background = "linear-gradient(135deg, #644CB0 0%, #552B90 100%)";
                console.log("[CHE] 緩存模式：每10分鐘自動保存");
            } else {
                btn.textContent = "⏸️ 停用";
                btn.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
                console.log("[CHE] 已停用自動緩存");
            }
        }

        updateModeButton(btnMode);
        updateButtonColors(currentMode);

        // 添加CSS動畫
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        // 返回updateButtonColors函數供外部使用
        window.updateCHEButtonColors = updateButtonColors;

        console.log("[CHE] 現代化UI已載入，當前模式:", currentMode);
    }

    // 修改的模式切換
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "cache";
            initMessageObserver();
        } else {
            currentMode = "stopped";
            stopMessageObserver();
        }

        localStorage.setItem("chatlogger_mode", currentMode);

        // 更新按鈕文字和顏色
        if (currentMode === "cache") {
            btn.textContent = "💾 緩存中";
            btn.style.background = "linear-gradient(135deg, #644CB0 0%, #552B90 100%)";
            console.log("[CHE] 緩存模式：每10分鐘自動保存");
        } else {
            btn.textContent = "⏸️ 停用";
            btn.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
            console.log("[CHE] 已停用自動緩存");
        }

        // 更新主按鈕顏色
        if (window.updateCHEButtonColors) {
            window.updateCHEButtonColors(currentMode);
        }

        console.log("[CHE] 模式已切換:", currentMode);
    }

    // 初始化
    async function init() {
        try {
            await loadToastSystem();

            setupDataBackup();

            const waitForPlayer = setInterval(() => {
                if (window.Player?.Name) {
                    clearInterval(waitForPlayer);

                    console.log("[CHE] 玩家數據已載入，開始初始化插件");

                    checkTempData().then(() => {
                        console.log("[CHE] 臨時數據檢查完成");
                    }).catch(e => {
                        logError("init.checkTempData", e);
                    });

                    CacheManager.cleanOldData().then(() => {
                        console.log("[CHE] 舊數據清理檢查完成");
                    }).catch(e => {
                        logError("init.cleanOldData", e);
                    });

                    addUI();

                    if (currentMode === "cache") {
                        console.log("[CHE] 緩存模式，啟動訊息監控");
                        initMessageObserver();
                    }

                    console.log("[CHE] 插件初始化完成，當前模式:", currentMode);
                }
            }, 1000);

            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE Enhanced",
                    fullName: "Chat History Export Enhanced v2.1",
                    version: modversion,
                    repository: "Enhanced chat room history export with 7-day cache",
                });
                console.log("[CHE] 已註冊到 bcModSdk");
            }

        } catch (e) {
            logError("init", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 初始化失敗", 3000, "#ff0000");
        }
    }

    init();
})();
