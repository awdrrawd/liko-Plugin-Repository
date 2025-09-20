// ==UserScript==
// @name         Liko - CHE Enhanced
// @name:zh      Liko的聊天室書記官 (增強版)
// @namespace    https://likolisu.dev/
// @version      2.1
// @description  聊天室紀錄匯出增強版 - 7天緩存、搜尋過濾、DOM優化
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
    const modversion = "2.1";
    let currentMessageCount = 0;
    const MESSAGE_SAVE_THRESHOLD = 1000;
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped";
    const validModes = ["stopped", "cache"];

    // DOM 快取管理
    const DOMCache = {
        chatLog: null,
        lastCheckTime: 0,

        getChatLog() {
            const now = Date.now();
            if (!this.chatLog || !document.contains(this.chatLog) || now - this.lastCheckTime > 5000) {
                this.chatLog = document.querySelector("#TextAreaChatLog");
                this.lastCheckTime = now;
            }
            return this.chatLog;
        },

        getMessages() {
            const log = this.getChatLog();
            return log ? Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div")) : [];
        },

        getMessageCount() {
            const log = this.getChatLog();
            return log ? log.querySelectorAll(".ChatMessage, a.beep-link").length : 0;
        }
    };

    // 日期工具
    const DateUtils = {
        getDateKey(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },

        getDisplayDate(dateKey) {
            try {
                const date = new Date(dateKey + 'T00:00:00');
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return `${month}/${day}`;
            } catch (e) {
                console.error("[CHE] getDisplayDate 錯誤:", e);
                return dateKey;
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
                    console.error("[CHE] IndexedDB 初始化失敗");
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
                        console.error("[CHE] 獲取現有數據失敗:", req.error);
                        reject(req.error);
                    };
                });

                const allMessages = [...existing, ...messages];

                await new Promise((resolve, reject) => {
                    const data = {
                        messages: allMessages,
                        count: allMessages.length,
                        lastUpdate: Date.now()
                    };
                    const req = store.put(data, dateKey);
                    req.onsuccess = () => {
                        console.log(`[CHE] 成功保存 ${messages.length} 條新訊息到 ${dateKey}，總計 ${allMessages.length} 條`);
                        resolve();
                    };
                    req.onerror = () => {
                        console.error("[CHE] 保存數據失敗:", req.error);
                        reject(req.error);
                    };
                });

                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error("事務被中止"));
                });

                window.ChatRoomSendLocalStyled(`[CHE] 已緩存 ${messages.length} 條新訊息`, 2000, "#00ff00");
                return allMessages.length;
            } catch (e) {
                console.error("[CHE] saveToday 保存失敗:", e);
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
                console.error("[CHE] 獲取日期列表失敗:", e);
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
                console.error("[CHE] 獲取訊息失敗:", e);
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
                                console.error(`[CHE] deleteDates: ✗ 刪除 ${dateKey} 失敗:`, deleteReq.error);
                                resolve();
                            };
                        });

                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        });

                    } catch (itemError) {
                        console.error(`[CHE] deleteDates: 處理 ${dateKey} 時出現錯誤:`, itemError);
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
                console.error("[CHE] deleteDates: 整體操作失敗:", e);
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
                console.error("[CHE] 清理舊數據失敗:", e);
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

    // 訊息過濾函數
    function isFilteredMessage(text, isPrivate) {
        return (
            text.includes("BCX commands tutorial") ||
            text.includes("BCX also provides") ||
            text.includes("(输入 /help 查看命令列表)") ||
            (isPrivate && (text.includes("悄悄話") || text.includes("好友私聊") || text.includes("BEEP")))
        );
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

    // 提取文本內容
    function extractFullTextContent(element) {
        if (!element) return "";
        try {
            const clone = element.cloneNode(true);
            const links = clone.querySelectorAll('a[href]');
            links.forEach(function(link) {
                const href = link.getAttribute('href');
                const text = link.innerText || link.textContent || '';
                if (text && text !== href && !text.includes('http')) {
                    link.textContent = text + ' (' + href + ')';
                } else {
                    link.textContent = href;
                }
            });

            let text = clone.textContent || clone.innerText || "";
            return text.replace(/\s*\n\s*/g, '\n').trim();
        } catch (e) {
            console.error("[CHE] extractFullTextContent 錯誤:", e);
            return element.textContent || element.innerText || "";
        }
    }

    // 獲取標籤顏色
    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        let c =
            msg.style?.getPropertyValue("--label-color") ||
            getComputedStyle(msg).getPropertyValue("--label-color") ||
            (nameButton && (nameButton.style?.getPropertyValue("--label-color") || getComputedStyle(nameButton).getPropertyValue("--label-color"))) ||
            "";
        c = c.trim();
        if (c) return c;
        const colorSpan = msg.querySelector('[style*="color"]');
        if (colorSpan && colorSpan.style?.color) return colorSpan.style.color;
        const fontEl = msg.querySelector("font[color]");
        if (fontEl && fontEl.color) return fontEl.color;
        return "#000";
    }

    // 顏色對比度調整
    function getContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return "#000";

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
                if (luminance < 0.3) {
                    return lightenColor(cleanColor, 0.5);
                } else if (luminance < 0.5) {
                    return lightenColor(cleanColor, 0.2);
                }
                return cleanColor;
            } else {
                if (luminance > 0.8) {
                    return darkenColor(cleanColor, 0.5);
                } else if (luminance > 0.6) {
                    return darkenColor(cleanColor, 0.2);
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

    // 日期選擇器
    async function showDateSelector() {
        const availableDates = await CacheManager.getAvailableDates();

        if (availableDates.length === 0) {
            const saveCurrent = await showCustomPrompt("沒有緩存數據。是否保存當前聊天室的訊息？");
            if (saveCurrent) {
                return { action: 'save_current' };
            }
            window.ChatRoomSendLocalStyled("[CHE] 沒有可用的緩存數據", 3000, "#ffa500");
            return null;
        }

        return new Promise(resolve => {
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
                z-index: 2000;
            `;

            const dateOptions = availableDates.map(date =>
                `<label style="display: block; margin: 8px 0; cursor: pointer; padding: 8px; border-radius: 4px; background: #444;">
                    <input type="checkbox" value="${date.dateKey}" style="margin-right: 8px;">
                    ${date.display} - ${date.count} 條訊息
                </label>`
            ).join('');

            modal.innerHTML = `
                <div style="background: #333; color: #fff; padding: 24px; border-radius: 12px; max-width: 500px; max-height: 80vh; overflow-y: auto;">
                    <h3 style="margin-top: 0;">緩存管理</h3>
                    <div style="margin: 16px 0; text-align: left;">
                        <h4 style="color: #ccc; margin-bottom: 10px;">選擇要操作的日期：</h4>
                        ${dateOptions}
                    </div>
                    <div style="text-align: center; margin-top: 20px;">
                        <button id="selectAll" style="margin: 5px; padding: 6px 12px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">全選</button>
                        <button id="saveCurrent" style="margin: 5px; padding: 8px 16px; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer;">💾 保存當前</button>
                        <button id="exportBtn" style="margin: 5px; padding: 8px 16px; background: #0066cc; color: #fff; border: none; border-radius: 4px; cursor: pointer;">📥 匯出選中</button>
                        <button id="deleteBtn" style="margin: 5px; padding: 8px 16px; background: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🗑️ 刪除選中</button>
                        <br>
                        <button id="cancelBtn" style="margin: 5px; padding: 8px 16px; background: #6c757d; color: #fff; border: none; border-radius: 4px; cursor: pointer;">取消</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector("#selectAll").onclick = () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
            };

            modal.querySelector("#saveCurrent").onclick = () => {
                document.body.removeChild(modal);
                resolve({ action: 'save_current' });
            };

            modal.querySelector("#cancelBtn").onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };

            modal.querySelector("#exportBtn").onclick = () => {
                const selected = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);
                if (selected.length === 0) {
                    alert('請選擇要匯出的日期');
                    return;
                }
                document.body.removeChild(modal);
                resolve({ action: 'export', dates: selected });
            };

            modal.querySelector("#deleteBtn").onclick = () => {
                const selected = Array.from(modal.querySelectorAll('input[type="checkbox"]:checked'))
                                    .map(cb => cb.value);
                if (selected.length === 0) {
                    alert('請選擇要刪除的日期');
                    return;
                }
                document.body.removeChild(modal);
                resolve({ action: 'delete', dates: selected });
            };
        });
    }

    // 處理當前訊息
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];

        messages.forEach(msg => {
            try {
                let messageData = {
                    time: msg.dataset?.time || new Date().toISOString(),
                    id: msg.dataset?.sender || "",
                    content: extractFullTextContent(msg),
                    type: "normal",
                    color: "#000"
                };

                if (msg.classList.contains("ChatMessageWhisper")) {
                    messageData.type = "whisper";
                } else if (msg.matches && msg.matches("a.beep-link")) {
                    messageData.type = "beep";
                }

                messageData.color = getLabelColor(msg, msg.querySelector(".ChatMessageName"));

                if (!isFilteredMessage(messageData.content, messageData.type === "whisper")) {
                    processedMessages.push(messageData);
                }
            } catch (e) {
                console.error("[CHE] processCurrentMessages: 訊息處理錯誤", e);
            }
        });

        return processedMessages;
    }

    // 處理DB資料的內容解析函數
    function parseDBContent(content, id, time) {
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

        if (cleanContent.startsWith('˅')) {
            return {
                isSkip: true
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

    // 生成DB HTML的主函數
    async function generateDBHTML(messages, includePrivate) {
        window.ChatRoomSendLocalStyled("[CHE] 正在匯出緩存 HTML，請稍候...", 3000, "#ffa500");

        function toRGBA(color, alpha = 0.12) {
            if (!color) return `rgba(0,0,0,${alpha})`;
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
            return `rgba(0,0,0,${alpha})`;
        }

        const searchControls = `
        <div id="searchPanel" style="position: sticky; top: 0; background: inherit; padding: 12px; border-bottom: 1px solid #444; backdrop-filter: blur(10px); z-index: 100;">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="contentSearch" placeholder="搜尋內容..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; width: 200px; font-size: 14px;">
                <input type="text" id="idFilter" placeholder="篩選ID (用逗號分隔多個)..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; width: 200px; font-size: 14px;">
                <select id="timeRange" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; font-size: 14px;">
                    <option value="">所有時間</option>
                    <option value="1h">近1小時</option>
                    <option value="6h">近6小時</option>
                    <option value="24h">近24小時</option>
                </select>
                <button onclick="clearAllFilters()" style="padding: 6px 12px; border-radius: 6px; border: none; background: #666; color: #fff; cursor: pointer; font-size: 14px;">清除</button>
            </div>
            <div style="margin-top: 8px; font-size: 13px;">
                <span id="filterStats" style="color: #aaa;"></span>
            </div>
        </div>`;

        let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: sans-serif;
                background: #111;
                color: #eee;
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
            }
            .chat-time {
                color: #aaa;
            }
            .chat-id {
                font-weight: bold;
            }
            .chat-content {
                flex: 1;
                white-space: pre-wrap;
            }
            .with-accent {
                border-left: 4px solid transparent;
            }
            .separator-row {
                background: rgba(129, 0, 231, 0.2);
                border-left: 4px solid #8100E7;
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
            }

            /* 淺色模式 */
            body.light {
                background: #fff;
                color: #333;
            }
            body.light .chat-time {
                color: #666;
            }
            body.light .separator-row {
                background: rgba(129, 0, 231, 0.1);
                color: #333;
            }
            body.light .collapse-button:hover {
                background: rgba(0,0,0,0.1);
            }
            body.light #toggleTheme {
                background: #333;
                color: #fff;
            }
            body.light #searchPanel {
                border-bottom-color: #ddd !important;
                background: #f8f9fa !important;
            }
            body.light #contentSearch, body.light #idFilter, body.light #timeRange {
                background: #fff !important;
                color: #333 !important;
                border-color: #ccc !important;
            }
            body.light #contentSearch::placeholder, body.light #idFilter::placeholder {
                color: #999 !important;
            }

            .user-name {
                font-weight: bold;
            }

            body:not(.light) .chat-content {
                filter: brightness(1.1);
            }

            body.light .chat-content {
                filter: brightness(0.8);
            }
        </style>
    </head>
    <body>
        <button id="toggleTheme">🌞 淺色模式</button>
        ${searchControls}
        <div id="chatlog">
    `;

        let collapseId = 0;
        let openCollapsible = false;
        let processedCount = 0;

        for (const msg of messages) {
            if (!includePrivate && (msg.type === "whisper" || msg.type === "beep")) {
                continue;
            }

            const parsed = parseDBContent(msg.content, msg.id, msg.time);

            if (parsed.isSkip) {
                continue;
            }

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
                processedCount++;
                continue;
            }

            let timeDisplay = msg.time;
            if (typeof msg.time === 'string' && msg.time.includes('T')) {
                timeDisplay = new Date(msg.time).toLocaleTimeString();
            }

            const adjustedColor = getContrastColor(msg.color || "#000", true);
            const bgColor = toRGBA(adjustedColor, 0.12);

            let content = "";
            if (parsed.isUser) {
                content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(parsed.userName)}</span>: ${escapeHtml(parsed.userMessage)}`;
            } else {
                content = escapeHtml(parsed.displayContent);
            }

            html += `
            <div class="chat-row with-accent" style="background:${bgColor}; border-left-color:${adjustedColor};">
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(timeDisplay)}</span>
                    <span class="chat-id">${escapeHtml(msg.id || '')}</span>
                </div>
                <div class="chat-content">${content}</div>
            </div>`;
            processedCount++;
        }

        if (openCollapsible) html += `</div>`;
        html += `
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

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `cached_chatlog_${timestamp}.html`;
            a.click();
            URL.revokeObjectURL(a.href);

            window.ChatRoomSendLocalStyled(`[CHE] 緩存 HTML 匯出完成，${processedCount} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            console.error("[CHE] 緩存 HTML 匯出失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 緩存 HTML 匯出失敗", 5000, "#ff0000");
        }
    }

    // 新的DB資料匯出函數
    async function export_DB_HTML() {
        const result = await showDateSelector();
        if (!result) return;

        if (result.action === 'save_current') {
            const currentMessages = processCurrentMessages();
            if (currentMessages.length > 0) {
                await CacheManager.saveToday(currentMessages);
                window.ChatRoomSendLocalStyled("[CHE] 已保存當前訊息到緩存", 3000, "#00ff00");
            }
            return;
        }

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

            const includePrivate = await showCustomPrompt("是否包含悄悄話和私信？");
            await generateDBHTML(messages, includePrivate);
        }
    }

    // 匯出HTML（簡化版，移除includePrivate參數）
    async function exportChatAsHTML() {
        const includePrivate = await showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?");

        window.ChatRoomSendLocalStyled("[CHE] 正在匯出 HTML，請稍候...", 3000, "#ffa500");
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

        function toRGBA(color, alpha = 0.12) {
            if (!color) return `rgba(0,0,0,${alpha})`;
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
            return `rgba(0,0,0,${alpha})`;
        }

        const searchControls = `
        <div id="searchPanel" style="position: sticky; top: 0; background: inherit; padding: 12px; border-bottom: 1px solid #444; backdrop-filter: blur(10px); z-index: 100;">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <input type="text" id="contentSearch" placeholder="搜尋內容..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; width: 200px; font-size: 14px;">
                <input type="text" id="idFilter" placeholder="篩選ID (用逗號分隔多個)..." style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; width: 200px; font-size: 14px;">
                <select id="timeRange" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #666; background: #222; color: #fff; font-size: 14px;">
                    <option value="">所有時間</option>
                    <option value="1h">近1小時</option>
                    <option value="6h">近6小時</option>
                    <option value="24h">近24小時</option>
                </select>
                <button onclick="clearAllFilters()" style="padding: 6px 12px; border-radius: 6px; border: none; background: #666; color: #fff; cursor: pointer; font-size: 14px;">清除</button>
            </div>
            <div style="margin-top: 8px; font-size: 13px;">
                <span id="filterStats" style="color: #aaa;"></span>
            </div>
        </div>`;

        let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: sans-serif;
                background: #111;
                color: #eee;
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
            }
            .chat-time {
                color: #aaa;
            }
            .chat-id {
                font-weight: bold;
            }
            .chat-content {
                flex: 1;
                white-space: pre-wrap;
            }
            .system {
                font-style: italic;
            }
            .beep {
                color: #ff6b6b;
                font-weight: bold;
            }
            .with-accent {
                border-left: 4px solid transparent;
            }
            .separator-row {
                background: rgba(129, 0, 231, 0.2);
                border-left: 4px solid #8100E7;
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
            }

            body.light {
                background: #fff;
                color: #333;
            }
            body.light .chat-time {
                color: #666;
            }
            body.light .beep {
                color: #d63031;
            }
            body.light .separator-row {
                background: rgba(129, 0, 231, 0.1);
                color: #333;
            }
            body.light .collapse-button:hover {
                background: rgba(0,0,0,0.1);
            }
            body.light #toggleTheme {
                background: #333;
                color: #fff;
            }
            body.light #searchPanel {
                border-bottom-color: #ddd !important;
                background: #f8f9fa !important;
            }
            body.light #contentSearch, body.light #idFilter, body.light #timeRange {
                background: #fff !important;
                color: #333 !important;
                border-color: #ccc !important;
            }
            body.light #contentSearch::placeholder, body.light #idFilter::placeholder {
                color: #999 !important;
            }

            body:not(.light) .chat-content span[style*="color"] {
                filter: brightness(1.3) saturate(0.9);
            }
            body:not(.light) .chat-content span[style*="color:#000"],
            body:not(.light) .chat-content span[style*="color: #000"],
            body:not(.light) .chat-content span[style*="color:black"],
            body:not(.light) .chat-content span[style*="color: black"] {
                color: #e0e0e0 !important;
            }

            body.light .chat-content span[style*="color"] {
                filter: brightness(0.7) saturate(1.1);
            }
            body.light .chat-content span[style*="color:#fff"],
            body.light .chat-content span[style*="color: #fff"],
            body.light .chat-content span[style*="color:#ffffff"],
            body.light .chat-content span[style*="color: #ffffff"],
            body.light .chat-content span[style*="color:white"],
            body.light .chat-content span[style*="color: white"] {
                color: #333 !important;
            }
            body.light .chat-content span[style*="color:#eee"],
            body.light .chat-content span[style*="color: #eee"],
            body.light .chat-content span[style*="color:#eeeeee"],
            body.light .chat-content span[style*="color: #eeeeee"] {
                color: #444 !important;
            }
        </style>
    </head>
    <body>
        <button id="toggleTheme">🌞 淺色模式</button>
        ${searchControls}
        <div id="chatlog">
    `;

        const processedBeeps = new Set();
        let collapseId = 0;
        let openCollapsible = false;
        let lastSeparatorText = "";
        let processedCount = 0;
        const isDarkTheme = !document.body.classList.contains('light');

        for (const msg of messages) {
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
                if (!includePrivate) continue;
                const beepContent = escapeHtml(extractFullTextContent(msg).trim());
                if (processedBeeps.has(beepContent)) continue;
                processedBeeps.add(beepContent);
                html += `
        <div class="chat-row with-accent" style="background: ${toRGBA('#ff6b6b', 0.12)}; border-left-color: #ff6b6b;">
            <div class="chat-meta"></div>
            <div class="chat-content beep">${beepContent}</div>
        </div>`;
                processedCount++;
                continue;
            }

            if (!msg.dataset) continue;

            const time = msg.dataset.time || "";
            const senderId = msg.dataset.sender || "";
            const nameButton = msg.querySelector(".ChatMessageName");
            const senderName = nameButton ? nameButton.innerText : "";
            let labelColor = getLabelColor(msg, nameButton);

            const adjustedColor = getContrastColor(labelColor, isDarkTheme);

            let rawText = "";
            const textNode = msg.querySelector(".chat-room-message-content");

            if (textNode) {
                rawText = extractFullTextContent(textNode);
            } else {
                const clonedMsg = msg.cloneNode(true);
                clonedMsg.querySelectorAll('.chat-room-metadata, .chat-room-message-popup, .ChatMessageName').forEach(meta => meta.remove());
                rawText = extractFullTextContent(clonedMsg).trim();
            }

            if (isFilteredMessage(rawText, msg.classList.contains("ChatMessageWhisper") && !includePrivate)) continue;
            if (lastSeparatorText && rawText.includes(lastSeparatorText)) continue;

            let content = "";
            let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

            if (msg.classList.contains("ChatMessageChat")) {
                content = `<span style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
            } else if (msg.classList.contains("ChatMessageWhisper")) {
                if (!includePrivate) continue;
                const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                content = `${prefix} <span style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
            } else if (
                msg.classList.contains("ChatMessageAction") ||
                msg.classList.contains("ChatMessageActivity") ||
                msg.classList.contains("ChatMessageEmote") ||
                msg.classList.contains("ChatMessageEnterLeave")
            ) {
                content = `<span style="color:${adjustedColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
            } else if (msg.classList.contains("ChatMessageLocalMessage") || msg.classList.contains("ChatMessageNonDialogue")) {
                const styledP = msg.querySelector("p[style]");
                if (styledP) {
                    const originalStyle = styledP.getAttribute("style");
                    const adjustedStyle = originalStyle.replace(/color:\s*([^;]+)/g, (match, color) => {
                        const newColor = getContrastColor(color.trim(), isDarkTheme);
                        return `color: ${newColor}`;
                    });
                    content = `<div style="${adjustedStyle}">${escapeHtml(extractFullTextContent(styledP))}</div>`;
                } else {
                    const fontEl = msg.querySelector("font");
                    if (fontEl && fontEl.color) {
                        const adjustedFontColor = getContrastColor(fontEl.color, isDarkTheme);
                        content = `<span style="color:${adjustedFontColor}">${escapeHtml(extractFullTextContent(fontEl))}</span>`;
                    } else {
                        content = escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim());
                    }
                }
                const systemColor = getContrastColor('#3aa76d', isDarkTheme);
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
            <div class="chat-content">${content}</div>
        </div>`;
            processedCount++;
        }

        if (openCollapsible) html += `</div>`;
        html += `
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

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `chatlog_${timestamp}.html`;
            a.click();
            URL.revokeObjectURL(a.href);

            window.ChatRoomSendLocalStyled(`[CHE] HTML 匯出完成，${processedCount} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            console.error("[CHE] HTML 匯出失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ HTML 匯出失敗，請重試", 5000, "#ff0000");
        }
    }

    // 匯出HTML（簡化函數）
    async function exportHTML(fromCache = false) {
        if (fromCache) {
            await export_DB_HTML();
        } else {
            await exportChatAsHTML();
        }
    }

    // 匯出Excel
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
                if (!includePrivate && msg.type === "whisper") return;
                if (isFilteredMessage(msg.content, msg.type === "whisper")) return;

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
            console.error("[CHE] Excel匯出失敗:", e);
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
            console.error("[CHE] 清空聊天室失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 清空失敗", 3000, "#ff0000");
        }
    }

    // 訊息監控
    function initMessageObserver() {
        console.log("[CHE] 開始初始化訊息監控");
        const maxWaitTime = 10 * 60 * 1000;
        const startTime = Date.now();

        const checkChatRoom = setInterval(() => {
            const chatLog = DOMCache.getChatLog();
            if (chatLog) {
                clearInterval(checkChatRoom);
                console.log("[CHE] 訊息監控已啟動，當前計數:", currentMessageCount);

                currentMessageCount = DOMCache.getMessageCount();
                console.log("[CHE] 初始訊息數量:", currentMessageCount);

                const observer = new MutationObserver((mutations) => {
                    let newMessages = 0;
                    mutations.forEach((mutation) => {
                        if (mutation.addedNodes.length) {
                            mutation.addedNodes.forEach((node) => {
                                if (node.matches && (node.matches(".ChatMessage") || node.matches("a.beep-link"))) {
                                    newMessages++;
                                }
                            });
                        }
                    });

                    if (newMessages > 0) {
                        currentMessageCount += newMessages;
                        console.log(`[CHE] 新增 ${newMessages} 條訊息，當前總數: ${currentMessageCount}`);

                        if (currentMessageCount >= MESSAGE_SAVE_THRESHOLD) {
                            console.log(`[CHE] 達到 ${MESSAGE_SAVE_THRESHOLD} 條訊息，觸發自動保存`);
                            saveCurrentMessages();
                        }
                    }
                });

                observer.observe(chatLog, {
                    childList: true,
                    subtree: true
                });

                console.log("[CHE] MutationObserver 已啟動");
            } else if (Date.now() - startTime > maxWaitTime) {
                console.error("[CHE] 聊天室載入超時");
                clearInterval(checkChatRoom);
            }
        }, 500);
    }

    // 保存當前訊息
    async function saveCurrentMessages() {
        if (currentMode !== "cache") {
            console.log("[CHE] saveCurrentMessages: 非緩存模式，跳過保存");
            return;
        }

        console.log("[CHE] saveCurrentMessages: 開始保存當前訊息");
        const messages = processCurrentMessages();

        if (messages.length > 0) {
            try {
                await CacheManager.saveToday(messages);
                currentMessageCount = 0;
                console.log("[CHE] saveCurrentMessages: 保存完成，計數器已重置");

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
                console.error("[CHE] saveCurrentMessages 失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 自動保存失敗", 3000, "#ff0000");
            }
        } else {
            console.log("[CHE] saveCurrentMessages: 沒有訊息需要保存");
        }
    }

    // 退出時保存和定期備份
    function setupDataBackup() {
        window.addEventListener('beforeunload', (e) => {
            if (currentMode === "cache") {
                saveToLocalStorage("beforeunload事件");
            }
        });

        setInterval(() => {
            if (currentMode === "cache") {
                saveToLocalStorage("定期備份");
            }
        }, 5 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && currentMode === "cache") {
                saveToLocalStorage("頁面隱藏");
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
            console.error(`[CHE] ${reason} 保存失敗:`, e);
        }
    }

    // 頁面載入時檢查臨時數據
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
                console.error("[CHE] checkTempData: JSON解析失敗:", parseError);
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
                        window.ChatRoomSendLocalStyled(`[CHE] 恢復了 ${tempData.messages.length} 條未保存的訊息 (${tempData.reason})`, 4000, "#00ff00");
                        console.log(`[CHE] checkTempData: 成功恢復 ${tempData.messages.length} 條訊息`);
                    } catch (saveError) {
                        console.error("[CHE] checkTempData: 保存恢復數據失敗:", saveError);
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
            console.error("[CHE] checkTempData: 整體處理失敗:", e);
            try {
                localStorage.removeItem('che_temp_data');
            } catch (cleanupError) {
                console.error("[CHE] checkTempData: 清理失敗:", cleanupError);
            }
        }
    }

    // 添加UI
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
            width: 50px; height: 50px; cursor: pointer; border-radius: 50%;
            background: #333; color: #fff; border: none; opacity: 0.8;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s ease;
            font-size: 20px; display: flex; align-items: center; justify-content: center;
        `;
        toggleButton.title = "聊天室記錄管理器 v2.0";

        toggleButton.onmouseover = () => {
            toggleButton.style.opacity = "1";
            toggleButton.style.background = "#AC66E4";
            toggleButton.style.transform = "scale(1.1)";
        };
        toggleButton.onmouseout = () => {
            toggleButton.style.opacity = "0.8";
            toggleButton.style.background = "#333";
            toggleButton.style.transform = "scale(1)";
        };

        const toolbar = document.createElement("div");
        toolbar.id = "chatlogger-toolbar";
        toolbar.style.cssText = `
            display: none; position: absolute; bottom: 60px; left: 0;
            background: #333; padding: 10px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            flex-direction: column; gap: 8px; min-width: 150px;
        `;

        const createButton = (label, handler, color = "#555") => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.style.cssText = `
                padding: 8px 12px; font-size: 13px; text-align: left;
                background: ${color}; color: #fff; border: none; border-radius: 4px;
                cursor: pointer; transition: background 0.2s; white-space: nowrap;
            `;
            btn.onmouseover = () => btn.style.background = "#E37736";
            btn.onmouseout = () => btn.style.background = color;
            btn.onclick = () => {
                if (!DOMCache.getChatLog()) {
                    window.ChatRoomSendLocalStyled("❌ 聊天室尚未載入", 3000, "#ff0000");
                    return;
                }
                handler();
            };
            return btn;
        };

        const btnHTML = createButton("📥 HTML匯出", () => exportHTML(false));
        const btnExcel = createButton("📊 Excel匯出", exportExcel);
        const btnCache = createButton("📂 緩存管理", export_DB_HTML);
        const btnClear = createButton("🗑️ 清空緩存", clearCache, "#cc0000");
        const btnMode = createButton("⏸️ 停用", () => toggleMode(btnMode));

        [btnHTML, btnExcel, btnCache, btnClear, btnMode].forEach(btn => toolbar.appendChild(btn));

        container.appendChild(toggleButton);
        container.appendChild(toolbar);
        document.body.appendChild(container);

        toggleButton.onclick = () => {
            toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
        };

        updateModeButton(btnMode);
        console.log("[CHE] UI已載入，當前模式:", currentMode);
    }

    // 更新模式按鈕
    function updateModeButton(btn) {
        if (currentMode === "cache") {
            btn.textContent = "💾 緩存中";
            btn.style.background = "#ff8800";
            window.ChatRoomSendLocalStyled("[CHE] 緩存模式：訊息將自動保存7天", 3000, "#ff8800");
        } else {
            btn.textContent = "⏸️ 停用";
            btn.style.background = "#555";
            window.ChatRoomSendLocalStyled("[CHE] 已停用自動緩存", 3000, "#ffa500");
        }
    }

    // 模式切換
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "cache";
            initMessageObserver();
        } else {
            currentMode = "stopped";
        }

        localStorage.setItem("chatlogger_mode", currentMode);
        updateModeButton(btn);
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
                        console.error("[CHE] 臨時數據檢查失敗:", e);
                    });

                    CacheManager.cleanOldData().then(() => {
                        console.log("[CHE] 舊數據清理完成");
                    }).catch(e => {
                        console.error("[CHE] 舊數據清理失敗:", e);
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
                    fullName: "Chat History Export Enhanced v2.0",
                    version: modversion,
                    repository: "Enhanced chat room history export with 7-day cache",
                });
                console.log("[CHE] 已註冊到 bcModSdk");
            }

        } catch (e) {
            console.error("[CHE] 初始化失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 初始化失敗", 3000, "#ff0000");
        }
    }

    init();
})();
