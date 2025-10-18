// ==UserScript==
// @name         Liko - CHE Enhanced v2.1
// @name:zh      Liko的聊天室書記官 (增強版v2.1)
// @namespace    https://likolisu.dev/
// @version      2.1
// @description  聊天室紀錄匯出增強版 - 7天緩存、搜尋過濾、DOM優化、修復重複問題
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

    // ===== 全局變量定義 =====
    let modApi; // bcModSdk註冊的mod API對象，用於與遊戲框架交互
    const modversion = "2.1"; // 插件版本號
    let currentMessageCount = 0; // 當前聊天室中的消息數量計數器，用於監控消息增長
    const AUTO_SAVE_INTERVAL = 10 * 60 * 1000; // 自動保存間隔時間：10分鐘（毫秒）
    let autoSaveTimer = null; // 自動保存定時器對象，用於管理定時保存
    let lastSaveTime = Date.now(); // 上次保存的時間戳，用於計算是否達到保存間隔
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped"; // 當前工作模式：stopped(停用) 或 cache(緩存)
    const validModes = ["stopped", "cache"]; // 有效的工作模式列表，用於驗證模式切換

    // ===== DOM快取管理系統 =====
    // 用於優化DOM查詢性能，避免重複查找聊天室元素
    const DOMCache = {
        chatLog: null, // 緩存的聊天室主容器DOM元素
        lastCheckTime: 0, // 上次檢查DOM的時間戳

        // 獲取聊天室容器，帶緩存和失效檢查
        getChatLog() {
            const now = Date.now();
            // 如果緩存失效（元素不存在、被移除或超過5秒）則重新查找
            if (!this.chatLog || !document.contains(this.chatLog) || now - this.lastCheckTime > 5000) {
                this.chatLog = document.querySelector("#TextAreaChatLog");
                this.lastCheckTime = now;
            }
            return this.chatLog;
        },

        // 獲取所有聊天消息（包括普通消息、BEEP、房間分隔符）
        getMessages() {
            const log = this.getChatLog();
            return log ? Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div")) : [];
        },

        // 獲取當前消息總數（不包括房間分隔符）
        getMessageCount() {
            const log = this.getChatLog();
            return log ? log.querySelectorAll(".ChatMessage, a.beep-link").length : 0;
        }
    };

    // ===== 日期工具函數 =====
    // 處理日期格式化和轉換的工具集
    const DateUtils = {
        // 將日期對象轉換為YYYY-MM-DD格式的字符串，用作數據庫鍵
        getDateKey(date = new Date()) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份補零
            const day = String(date.getDate()).padStart(2, '0'); // 日期補零
            return `${year}-${month}-${day}`;
        },

        // 將日期鍵轉換為用戶友好的顯示格式（M/D）
        getDisplayDate(dateKey) {
            try {
                const date = new Date(dateKey + 'T00:00:00'); // 添加時間部分避免時區問題
                const month = date.getMonth() + 1;
                const day = date.getDate();
                return `${month}/${day}`;
            } catch (e) {
                console.error("[CHE] getDisplayDate 錯誤:", e);
                return dateKey; // 轉換失敗時返回原始值
            }
        }
    };

    // ===== IndexedDB緩存管理器 =====
    // 負責管理本地數據庫的所有操作，包括保存、讀取、刪除消息
    const CacheManager = {
        // 初始化IndexedDB數據庫，創建必要的對象存儲
        async init() {
            const request = indexedDB.open("ChatLoggerV2", 2); // 版本2的數據庫

            // 數據庫升級時的處理邏輯
            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // 清理舊版本的存儲（如果存在）
                if (db.objectStoreNames.contains("fragments")) {
                    db.deleteObjectStore("fragments");
                }

                // 創建新的每日消息片段存儲
                if (!db.objectStoreNames.contains("daily_fragments")) {
                    db.createObjectStore("daily_fragments"); // 以日期為鍵的鍵值存儲
                }
            };

            // 返回Promise包裝的數據庫連接
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => {
                    console.error("[CHE] IndexedDB 初始化失敗");
                    reject("IndexedDB 初始化失敗");
                };
            });
        },

        // 將消息保存到今天的數據片段中，包含去重邏輯
        async saveToday(messages) {
            if (!messages || messages.length === 0) {
                console.log("[CHE] saveToday: 沒有訊息需要保存");
                return;
            }

            try {
                const db = await this.init();
                const dateKey = DateUtils.getDateKey(); // 獲取今天的日期鍵

                // 開始數據庫事務
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                // 獲取今天已存在的消息
                const existing = await new Promise((resolve, reject) => {
                    const req = store.get(dateKey);
                    req.onsuccess = () => {
                        const result = req.result;
                        resolve(result ? result.messages : []); // 返回現有消息或空數組
                    };
                    req.onerror = () => {
                        console.error("[CHE] 獲取現有數據失敗:", req.error);
                        reject(req.error);
                    };
                });

                // 去重邏輯：使用時間+ID+內容前50字符作為唯一鍵
                const existingKeys = new Set();
                existing.forEach(msg => {
                    const key = `${msg.time}-${msg.id}-${msg.content.substring(0, 50)}`;
                    existingKeys.add(key);
                });

                // 過濾出真正的新消息
                const newMessages = messages.filter(msg => {
                    const key = `${msg.time}-${msg.id}-${msg.content.substring(0, 50)}`;
                    return !existingKeys.has(key);
                });

                if (newMessages.length === 0) {
                    console.log("[CHE] saveToday: 所有消息都已存在，跳過保存");
                    return 0;
                }

                // 合併現有消息和新消息
                const allMessages = [...existing, ...newMessages];

                // 保存到數據庫
                await new Promise((resolve, reject) => {
                    const data = {
                        messages: allMessages, // 完整的消息列表
                        count: allMessages.length, // 消息總數
                        lastUpdate: Date.now() // 最後更新時間
                    };
                    const req = store.put(data, dateKey);
                    req.onsuccess = () => {
                        console.log(`[CHE] 成功保存 ${newMessages.length} 條新訊息到 ${dateKey}，總計 ${allMessages.length} 條`);
                        resolve();
                    };
                    req.onerror = () => {
                        console.error("[CHE] 保存數據失敗:", req.error);
                        reject(req.error);
                    };
                });

                // 等待事務完成
                await new Promise((resolve, reject) => {
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.onabort = () => reject(new Error("事務被中止"));
                });

                // 顯示成功消息
                window.ChatRoomSendLocalStyled(`[CHE] 已緩存 ${newMessages.length} 條新訊息`, 2000, "#00ff00");
                return allMessages.length;
            } catch (e) {
                console.error("[CHE] saveToday 保存失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 緩存保存失敗", 3000, "#ff0000");
                throw e;
            }
        },

        // 獲取所有可用日期的列表，用於日期選擇器
        async getAvailableDates() {
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");

                // 獲取所有日期鍵
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                // 構建日期信息對象數組
                const result = [];
                for (const key of keys) {
                    const data = await new Promise((resolve, reject) => {
                        const req = store.get(key);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });

                    if (data) {
                        result.push({
                            dateKey: key, // 原始日期鍵（YYYY-MM-DD）
                            count: data.count || 0, // 該日期的消息數量
                            display: DateUtils.getDisplayDate(key) // 用戶友好的顯示格式
                        });
                    }
                }

                // 按日期倒序排列（最新的在前）
                return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
            } catch (e) {
                console.error("[CHE] 獲取日期列表失敗:", e);
                return [];
            }
        },

        // 根據日期鍵數組獲取對應的所有消息
        async getMessagesForDates(dateKeys) {
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");

                let allMessages = [];
                // 遍歷每個日期鍵
                for (const dateKey of dateKeys) {
                    const data = await new Promise((resolve, reject) => {
                        const req = store.get(dateKey);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });

                    if (data && data.messages) {
                        // 為每條消息添加來源標記
                        const messagesWithFlag = data.messages.map(msg => ({
                            ...msg,
                            isFromCache: true // 標記消息來自緩存
                        }));
                        allMessages.push(...messagesWithFlag);
                    }
                }

                // 按時間順序排序所有消息
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

        // 刪除指定日期的數據
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
                // 逐個刪除每個日期的數據
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
                                resolve(); // 即使失敗也繼續處理下一個
                            };
                        });

                        // 等待事務完成
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

                // 顯示結果
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

        // 清理7天前的舊數據，自動維護數據庫大小
        async cleanOldData() {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const cutoffKey = DateUtils.getDateKey(sevenDaysAgo); // 7天前的日期鍵

            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                // 獲取所有日期鍵
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                // 找出需要刪除的過期鍵
                const keysToDelete = keys.filter(key => key < cutoffKey);

                if (keysToDelete.length > 0) {
                    // 刪除過期數據
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

    // ===== 外部依賴載入系統 =====
    // 載入樣式化訊息系統（用於顯示彩色提示消息）
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) {
                resolve(); // 如果已經載入則直接返回
                return;
            }
            // 動態載入外部腳本
            const toastUrl = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            const script = document.createElement('script');
            script.src = toastUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    // 檢查並載入XLSX庫（用於Excel導出功能）
    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = () => console.log("[CHE] xlsx.full.min.js 載入完成");
        document.head.appendChild(script);
    }

    // ===== 消息過濾系統 =====
    // 統一的消息過濾函數，根據用戶設置決定哪些消息需要被過濾掉
    function isFilteredMessage(content, messageType, includePrivate = true) {
        // 基础过滤条件：過濾系統提示和幫助信息
        const basicFilters = [
            "BCX commands tutorial",
            "BCX also provides",
            "(输入 /help 查看命令列表)"
        ];
        
        if (basicFilters.some(filter => content.includes(filter))) {
            return true;
        }
        
        if (includePrivate) {
            // 保存所有信息时：只过滤BEEP消息，保留↩️但不是BEEP的信息
            if (messageType === "beep") {
                return true;
            }
        } else {
            // 略过所有悄悄话时：过滤↩️、BEEP、whisper
            if (messageType === "whisper" || messageType === "beep") {
                return true;
            }
            
            // 过滤包含↩️的消息
            if (content.includes("↩️")) {
                return true;
            }
            
            // 额外过滤包含私聊关键词的消息
            const privateKeywords = ["悄悄話", "悄悄话", "好友私聊", "BEEP"];
            if (privateKeywords.some(keyword => content.includes(keyword))) {
                return true;
            }
        }
        
        return false;
    }

    // 檢測消息類型的函數，用於準確識別不同類型的消息
    function detectMessageType(msg, content) {
        // 優先檢測DOM元素類型（最準確的方法）
        if (msg.matches && msg.matches("a.beep-link")) {
            return "beep"; // BEEP私信鏈接
        }
        
        if (msg.classList && msg.classList.contains("ChatMessageWhisper")) {
            return "whisper"; // 悄悄話消息
        }
        
        // 通過內容檢測（作為備選方案）
        if (content.includes("好友私聊来自") || content.includes("BEEP")) {
            // 如果有↩️但不是真正的beep元素，可能是重複消息
            if (content.includes("↩️") && !(msg.matches && msg.matches("a.beep-link"))) {
                return "beep_duplicate"; // 重複的BEEP消息
            }
            return "beep";
        }
        
        if (content.includes("悄悄话") || content.includes("悄悄話")) {
            return "whisper";
        }
        
        return "normal"; // 普通消息
    }

    // ===== 文本處理工具函數 =====
    // HTML轉義函數，防止XSS攻擊
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 提取DOM元素的完整文本內容，處理鏈接等特殊元素
    function extractFullTextContent(element) {
        if (!element) return "";
        try {
            const clone = element.cloneNode(true); // 克隆元素避免修改原始DOM
            const links = clone.querySelectorAll('a[href]');
            
            // 處理鏈接：顯示文本和URL
            links.forEach(function(link) {
                const href = link.getAttribute('href');
                const text = link.innerText || link.textContent || '';
                if (text && text !== href && !text.includes('http')) {
                    link.textContent = text + ' (' + href + ')'; // 格式：文本 (URL)
                } else {
                    link.textContent = href; // 只顯示URL
                }
            });

            let text = clone.textContent || clone.innerText || "";
            return text.replace(/\s*\n\s*/g, '\n').trim(); // 清理多餘空白
        } catch (e) {
            console.error("[CHE] extractFullTextContent 錯誤:", e);
            return element.textContent || element.innerText || "";
        }
    }

    // 獲取消息的標籤顏色（用戶名顏色）
    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        
        // 嘗試多種方式獲取顏色
        let c =
            msg.style?.getPropertyValue("--label-color") ||
            getComputedStyle(msg).getPropertyValue("--label-color") ||
            (nameButton && (nameButton.style?.getPropertyValue("--label-color") || getComputedStyle(nameButton).getPropertyValue("--label-color"))) ||
            "";
        c = c.trim();
        if (c) return c;
        
        // 從內聯樣式獲取顏色
        const colorSpan = msg.querySelector('[style*="color"]');
        if (colorSpan && colorSpan.style?.color) return colorSpan.style.color;
        
        // 從font標籤獲取顏色
        const fontEl = msg.querySelector("font[color]");
        if (fontEl && fontEl.color) return fontEl.color;
        
        return "#000"; // 默認黑色
    }

    // ===== 顏色處理系統 =====
    // 改進對比度的顏色處理，確保在不同主題下的可讀性
    function getEnhancedContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return isDarkTheme ? "#eee" : "#333";

        let cleanColor = hexColor.trim();
        
        // 處理RGB格式轉換為HEX
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
            // 計算顏色亮度
            const r = parseInt(cleanColor.slice(1, 3), 16);
            const g = parseInt(cleanColor.slice(3, 5), 16);
            const b = parseInt(cleanColor.slice(5, 7), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 亮度公式

            if (isDarkTheme) {
                // 暗色模式：確保顏色足夠亮
                if (luminance < 0.4) {
                    return lightenColor(cleanColor, 0.6);
                } else if (luminance < 0.6) {
                    return lightenColor(cleanColor, 0.3);
                }
                return cleanColor;
            } else {
                // 淺色模式：確保顏色足夠暗
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

    // 顏色變亮函數
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

    // 顏色變暗函數
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

    // ===== 數據庫內容解析系統 =====
    // 專門用於解析數據庫中存儲的消息內容格式
    function parseDBContent(content, id, time) {
        if (!content) return { isNormal: true, displayContent: "" };
        
        // 檢測房間信息（以˅開頭）
        if (content.startsWith('˅')) {
            return {
                isRoom: true,
                content: content,
                displayContent: content
            };
        }
        
        let cleanContent = content;
        
        // 清理時間戳格式（HH:MM:SS）
        const timeMatch = content.match(/^(\d{2}:\d{2}:\d{2})/);
        if (timeMatch) {
            cleanContent = content.substring(timeMatch[1].length);
        }
        
        // 清理用戶ID
        if (id && cleanContent.startsWith(id)) {
            cleanContent = cleanContent.substring(id.length);
        }

        // 清理末尾的時間+ID+Reply模式
        const endPattern = /(\d{2}:\d{2}:\d{2}\d+(?:Reply)?)$/;
        cleanContent = cleanContent.replace(endPattern, '');

        // 再次檢查是否為房間信息
        if (cleanContent.startsWith('˅')) {
            return { isSkip: true };
        }
        
        // 檢測動作文本（以*或(開頭）
        if (cleanContent.startsWith('*') || cleanContent.startsWith('(')) {
            return {
                isAction: true,
                displayContent: cleanContent.trim()
            };
        }

        // 檢測用戶消息（前20字符內包含冒號）
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

    // ===== HTML模板生成系統 =====
    // 生成HTML導出文件的模板，包含搜索控件和樣式
    async function generateHTMLTemplate(title) {
        // 搜索和過濾控件的HTML
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

        // 完整的HTML模板，包含CSS變量和響應式設計
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

    // HTML文件的尾部，包含JavaScript交互功能
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

    // ===== 消息處理系統 =====
    // 處理當前聊天室中的所有消息，轉換為標準格式
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];

        messages.forEach(msg => {
            try {
                const rawContent = extractFullTextContent(msg); // 提取文本內容
                const messageType = detectMessageType(msg, rawContent); // 檢測消息類型
                
                // 構建標準消息對象
                let messageData = {
                    time: msg.dataset?.time || new Date().toISOString(), // 時間戳
                    id: msg.dataset?.sender || "", // 發送者ID
                    content: rawContent, // 消息內容
                    type: messageType, // 消息類型
                    color: getLabelColor(msg, msg.querySelector(".ChatMessageName")) // 用戶名顏色
                };

                processedMessages.push(messageData);
                
            } catch (e) {
                console.error("[CHE] processCurrentMessages: 訊息處理錯誤", e);
            }
        });

        return processedMessages;
    }

    // ===== HTML導出系統 =====
    // 生成數據庫緩存的HTML文件
    async function generateDBHTML(messages, includePrivate) {
        window.ChatRoomSendLocalStyled("[CHE] 正在匯出緩存HTML，請稍候...", 3000, "#ffa500");

        // 顏色轉RGBA的工具函數
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

        let collapseId = 0; // 折疊區域ID計數器
        let openCollapsible = false; // 當前是否有開啟的折疊區域
        let processedCount = 0; // 處理的消息計數
        let lastSeparatorText = ""; // 最後一個房間分隔符的文本

        // 遍歷所有消息進行處理
        for (const msg of messages) {
            // 解析數據庫格式的消息內容
            const parsed = parseDBContent(msg.content, msg.id, msg.time);
            
            if (parsed.isSkip) continue; // 跳過需要忽略的消息

            // 處理房間信息分隔符
            if (parsed.isRoom) {
                if (openCollapsible) html += `</div>`; // 關閉前一個折疊區域
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

            // 應用消息過濾規則
            if (isFilteredMessage(msg.content, msg.type, includePrivate)) {
                console.log(`[CHE] DB过滤消息: ${msg.content.substring(0, 50)}...`);
                continue;
            }

            // 過濾與房間分隔符重複的信息
            if (lastSeparatorText && msg.content.includes(lastSeparatorText)) continue;

            // 統一處理不同的時間格式
            let timeDisplay = msg.time;
            if (typeof msg.time === 'string') {
                if (msg.time.includes('T')) {
                    // ISO格式轉換為本地時間格式
                    try {
                        timeDisplay = new Date(msg.time).toLocaleTimeString('zh-CN', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                    } catch (e) {
                        console.warn("[CHE] 时间转换失败:", msg.time);
                        timeDisplay = msg.time;
                    }
                }
                // 如果已經是HH:MM:SS格式，保持不變
            }

            // 設置顏色和背景樣式
            const adjustedColor = getEnhancedContrastColor(msg.color || "#888", true);
            const bgColor = toRGBA(adjustedColor, 0.12);

            // 根據消息類型構建內容HTML
            let content = "";
            if (parsed.isUser) {
                content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(parsed.userName)}</span>: ${escapeHtml(parsed.userMessage)}`;
            } else if (parsed.isAction) {
                content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(parsed.displayContent)}</span>`;
            } else {
                content = escapeHtml(parsed.displayContent);
            }

            // 生成消息行HTML
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

        if (openCollapsible) html += `</div>`; // 關閉最後一個折疊區域
        html += getHTMLFooter(); // 添加HTML尾部

        // 下載生成的HTML文件
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
            console.error("[CHE] 緩存HTML匯出失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 緩存HTML匯出失敗", 5000, "#ff0000");
        }
    }

    // 生成當前聊天室的HTML文件
    async function generateChatHTML(messages, includePrivate) {
        window.ChatRoomSendLocalStyled("[CHE] 正在匯出HTML，請稍候...", 3000, "#ffa500");

        // 顏色處理函數（與DB導出相同）
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
        const isDarkTheme = true; // 假設為暗色主題

        // 處理每個DOM消息元素
        for (const msg of messages) {
            // 處理房間分隔符
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

            // 跳過真正的BEEP元素避免重複
            if (msg.matches && msg.matches("a.beep-link")) {
                console.log("[CHE] Chat跳过BEEP元素避免重复");
                continue;
            }

            if (!msg.dataset) continue; // 跳過沒有數據屬性的元素

            // 提取消息信息
            const time = msg.dataset.time || "";
            const senderId = msg.dataset.sender || "";
            const nameButton = msg.querySelector(".ChatMessageName");
            const senderName = nameButton ? nameButton.innerText : "";
            let labelColor = getLabelColor(msg, nameButton);
            const adjustedColor = getEnhancedContrastColor(labelColor, isDarkTheme);

            // 提取消息文本內容
            let rawText = "";
            const textNode = msg.querySelector(".chat-room-message-content");
            if (textNode) {
                rawText = extractFullTextContent(textNode);
            } else {
                const clonedMsg = msg.cloneNode(true);
                clonedMsg.querySelectorAll('.chat-room-metadata, .chat-room-message-popup, .ChatMessageName').forEach(meta => meta.remove());
                rawText = extractFullTextContent(clonedMsg).trim();
            }

            // 檢測消息類型並應用過濾
            const messageType = detectMessageType(msg, rawText);
            if (isFilteredMessage(rawText, messageType, includePrivate)) {
                console.log(`[CHE] Chat过滤消息: ${rawText.substring(0, 50)}...`);
                continue;
            }

            if (lastSeparatorText && rawText.includes(lastSeparatorText)) continue;

            // 根據消息類型構建內容和樣式
            let content = "";
            let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

            if (msg.classList.contains("ChatMessageChat")) {
                // 普通聊天消息
                if (rawText.startsWith('*') || rawText.startsWith('(')) {
                    content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(rawText.trim())}</span>`;
                } else {
                    content = `<span class="user-name" style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                }
            } else if (msg.classList.contains("ChatMessageWhisper")) {
                // 悄悄話消息
                if (!includePrivate) continue;
                const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                content = `${prefix} <span class="user-name" style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
            } else if (
                msg.classList.contains("ChatMessageAction") ||
                msg.classList.contains("ChatMessageActivity") ||
                msg.classList.contains("ChatMessageEmote") ||
                msg.classList.contains("ChatMessageEnterLeave")
            ) {
                // 動作、活動、表情、進出房間消息
                content = `<span class="action-text" style="color:${adjustedColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
            } else if (msg.classList.contains("ChatMessageLocalMessage") || msg.classList.contains("ChatMessageNonDialogue")) {
                // 本地消息和非對話消息
                const systemColor = getEnhancedContrastColor('#3aa76d', isDarkTheme);
                content = `<span style="color:${systemColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
                rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(systemColor, 0.12)}; border-left-color:${systemColor};"`;
            } else {
                // 其他類型消息
                content = escapeHtml(rawText.trim());
            }

            // 生成消息行HTML
            html += `
            <div ${rowStyleInline}>
                <div class="chat-meta">
                    <span class="chat-time">${escapeHtml(time)}</span>
                    <span class="chat-id">${escapeHtml(senderId)}</span>
                </div>
                <div class="chat-content enhanced-color">${content}</div>
            </div>`;
            processedCount++;
        }

        if (openCollapsible) html += `</div>`;
        html += getHTMLFooter();

        // 下載生成的HTML文件
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
            console.error("[CHE] HTML匯出失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ HTML匯出失敗，請重試", 5000, "#ff0000");
        }
    }

    // ===== 用戶界面系統 =====
    // 自定義提示視窗，用於用戶確認操作
    function showCustomPrompt(message, options = []) {
        return new Promise(function(resolve) {
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
                z-index: 2000;
            `;

            // 構建按鈕HTML
            let buttons = '';
            if (options.length === 0) {
                // 默認是/否按鈕
                buttons = `
                    <button id="customPromptYes" style="margin: 10px; padding: 8px 16px; cursor: pointer; background: #0066cc; color: #fff; border: none; border-radius: 4px;">是</button>
                    <button id="customPromptNo" style="margin: 10px; padding: 8px 16px; cursor: pointer; background: #666; color: #fff; border: none; border-radius: 4px;">否</button>
                `;
            } else {
                // 自定義選項按鈕
                buttons = options.map((opt, idx) =>
                    `<button data-value="${opt.value}" style="margin: 5px; padding: 8px 16px; cursor: pointer; background: #0066cc; color: #fff; border: none; border-radius: 4px;">${opt.text}</button>`
                ).join('');
            }

            // 構建完整的模態框HTML
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

            // 綁定按鈕事件
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

    // 日期選擇器界面，用於緩存管理
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

            // 生成日期選項列表
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

            // 綁定按鈕事件
            modal.querySelector("#selectAll").onclick = () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked); // 切換全選狀態
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

    // ===== 主要功能函數 =====
    // 數據庫HTML導出的主控制函數
    async function export_DB_HTML() {
        const result = await showDateSelector();
        if (!result) return;

        if (result.action === 'save_current') {
            // 保存當前消息到緩存
            const currentMessages = processCurrentMessages();
            if (currentMessages.length > 0) {
                await CacheManager.saveToday(currentMessages);
                // 保存後重置計數器（重要：避免重複累積）
                currentMessageCount = 0;
                console.log("[CHE] save_current: 保存後重置計數器");
                window.ChatRoomSendLocalStyled("[CHE] 已保存當前訊息到緩存", 3000, "#00ff00");
            }
            return;
        }

        if (result.action === 'delete') {
            // 刪除選中的日期數據
            const confirmDelete = await showCustomPrompt(`確定要刪除 ${result.dates.length} 個日期的數據嗎？`);
            if (confirmDelete) {
                await CacheManager.deleteDates(result.dates);
            }
            return;
        }

        if (result.action === 'export' && result.dates.length > 0) {
            // 導出選中日期的數據
            const messages = await CacheManager.getMessagesForDates(result.dates);
            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] 選中日期沒有數據", 3000, "#ffa500");
                return;
            }

            const includePrivate = await showCustomPrompt("是否包含悄悄話和私信？");
            await generateDBHTML(messages, includePrivate);
        }
    }

    // 當前聊天室HTML導出函數
    async function exportChatAsHTML() {
        const includePrivate = await showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?");
        
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

    // HTML導出的統一入口函數
    async function exportHTML(fromCache = false) {
        if (fromCache) {
            await export_DB_HTML(); // 從緩存導出
        } else {
            await exportChatAsHTML(); // 從當前聊天室導出
        }
    }

    // Excel導出函數
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
            const data = [["時間", "ID", "內容"]]; // Excel表頭

            messages.forEach(msg => {
                // 應用統一的過濾邏輯
                if (isFilteredMessage(msg.content, msg.type, includePrivate)) {
                    return;
                }

                // 格式化時間顯示
                const timeDisplay = typeof msg.time === 'string' && msg.time.includes('T')
                    ? new Date(msg.time).toLocaleString()
                    : msg.time;

                data.push([timeDisplay, msg.id, msg.content]);
            });

            // 創建Excel工作簿
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ChatLog");

            // 下載Excel文件
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

    // 清空當前聊天室函數
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
            
            // 找到最後一個房間分隔符
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].classList.contains("chat-room-sep") || 
                    nodes[i].classList.contains("chat-room-sep-last") || 
                    nodes[i].classList.contains("chat-room-sep-div")) {
                    lastRoomNode = nodes[i];
                    break;
                }
            }

            // 清空聊天室，保留房間分隔符
            chatLog.innerHTML = "";
            if (lastRoomNode) chatLog.appendChild(lastRoomNode);

            currentMessageCount = 0; // 重置消息計數
            window.ChatRoomSendLocalStyled("[CHE] 當前聊天室已清空！", 3000, "#00ff00");
        } catch (e) {
            console.error("[CHE] 清空聊天室失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 清空失敗", 3000, "#ff0000");
        }
    }

    // ===== 自動保存系統 =====
    // 修改的訊息監控 - 改為基於時間的自動保存
    function initMessageObserver() {
        console.log("[CHE] 開始初始化訊息監控");
        const maxWaitTime = 10 * 60 * 1000; // 最大等待時間：10分鐘
        const startTime = Date.now();

        // 定期檢查聊天室是否載入
        const checkChatRoom = setInterval(() => {
            const chatLog = DOMCache.getChatLog();
            if (chatLog) {
                clearInterval(checkChatRoom);
                console.log("[CHE] 訊息監控已啟動");

                currentMessageCount = DOMCache.getMessageCount();
                console.log("[CHE] 初始訊息數量:", currentMessageCount);

                // 創建MutationObserver監控DOM變化
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
                    }
                });

                // 開始監控聊天室容器的變化
                observer.observe(chatLog, {
                    childList: true, // 監控子節點的添加/刪除
                    subtree: true // 監控所有後代節點
                });

                // 啟動定時保存系統
                startAutoSave();
                console.log("[CHE] MutationObserver 和定時保存已啟動");
            } else if (Date.now() - startTime > maxWaitTime) {
                console.error("[CHE] 聊天室載入超時");
                clearInterval(checkChatRoom);
            }
        }, 500);
    }

    // 啟動自動保存定時器
    function startAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer); // 清除現有定時器
        }

        // 每分鐘檢查一次是否需要保存
        autoSaveTimer = setInterval(() => {
            if (currentMode === "cache") {
                const now = Date.now();
                const timeSinceLastSave = now - lastSaveTime;
                
                console.log(`[CHE] 定時檢查: 距離上次保存 ${Math.round(timeSinceLastSave / 1000)} 秒`);
                
                // 如果達到10分鐘間隔則觸發保存
                if (timeSinceLastSave >= AUTO_SAVE_INTERVAL) {
                    console.log("[CHE] 達到10分鐘間隔，觸發自動保存");
                    saveCurrentMessages();
                }
            }
        }, 60 * 1000); // 每分鐘檢查一次

        console.log("[CHE] 自動保存定時器已啟動 (10分鐘間隔)");
    }

    // 停止自動保存定時器
    function stopAutoSave() {
        if (autoSaveTimer) {
            clearInterval(autoSaveTimer);
            autoSaveTimer = null;
            console.log("[CHE] 自動保存定時器已停止");
        }
    }

    // 保存當前消息的主要函數
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
                // 保存成功後重置計數器和更新保存時間（重要：避免重複累積）
                currentMessageCount = 0;
                lastSaveTime = Date.now();
                console.log("[CHE] saveCurrentMessages: 保存完成，計數器和時間已重置");

                // 清理舊消息，保持界面性能
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

    // ===== 數據備份系統 =====
    // 設置退出時保存和緊急備份
    function setupDataBackup() {
        // 瀏覽器關閉前的緊急保存
        window.addEventListener('beforeunload', (e) => {
            if (currentMode === "cache") {
                saveToLocalStorage("beforeunload事件");
            }
        });

        // 頁面隱藏時的保存（例如切換標籤頁）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && currentMode === "cache") {
                saveToLocalStorage("頁面隱藏");
            }
        });
    }

    // 緊急保存到localStorage（臨時存儲）
    function saveToLocalStorage(reason) {
        try {
            const messages = processCurrentMessages();
            console.log(`[CHE] ${reason}: 準備保存 ${messages.length} 條訊息`);

            if (messages.length > 0) {
                const tempData = {
                    messages: messages, // 消息數據
                    date: DateUtils.getDateKey(), // 日期
                    timestamp: Date.now(), // 時間戳
                    count: messages.length, // 消息數量
                    reason: reason // 保存原因
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

    // 檢查並恢復臨時數據
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

            // 檢查數據是否在有效期內（今天或昨天）
            const currentDate = DateUtils.getDateKey();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayKey = DateUtils.getDateKey(yesterday);

            if (tempData.date === currentDate || tempData.date === yesterdayKey) {
                if (tempData.messages && tempData.messages.length > 0) {
                    console.log(`[CHE] checkTempData: 準備恢復 ${tempData.messages.length} 條訊息 (${tempData.date})`);

                    try {
                        await CacheManager.saveToday(tempData.messages);
                        // 恢復後重置狀態（重要：避免重複累積）
                        currentMessageCount = 0;
                        lastSaveTime = Date.now();
                        console.log("[CHE] checkTempData: 恢復後重置計數器和時間");
                        
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

            // 清除臨時數據
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

    // ===== 用戶界面創建 =====
    // 創建插件的主要用戶界面
    function addUI() {
        // 清除已存在的界面（防止重複創建）
        const existingContainer = document.querySelector("#chatlogger-container");
        if (existingContainer) {
            existingContainer.remove();
        }

        // 創建主容器
        const container = document.createElement("div");
        container.id = "chatlogger-container";
        container.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; z-index: 1000;
        `;

        // 創建主按鈕
        const toggleButton = document.createElement("button");
        toggleButton.innerHTML = "💾";
        toggleButton.style.cssText = `
            width: 50px; height: 50px; cursor: pointer; border-radius: 50%;
            background: #333; color: #fff; border: none; opacity: 0.8;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.3s ease;
            font-size: 20px; display: flex; align-items: center; justify-content: center;
        `;
        toggleButton.title = "聊天室記錄管理器 v2.1";

        // 懸停效果
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

        // 創建工具欄
        const toolbar = document.createElement("div");
        toolbar.id = "chatlogger-toolbar";
        toolbar.style.cssText = `
            display: none; position: absolute; bottom: 60px; left: 0;
            background: #333; padding: 10px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            flex-direction: column; gap: 8px; min-width: 150px;
        `;

        // 按鈕創建函數
        const createButton = (label, handler, color = "#555") => {
            const btn = document.createElement("button");
            btn.textContent = label;
            btn.style.cssText = `
                padding: 8px 12px; font-size: 13px; text-align: left;
                background: ${color}; color: #fff; border: none; border-radius: 4px;
                cursor: pointer; transition: background 0.2s; white-space: nowrap;
            `;
            btn.onmouseover = () => btn.style.background = "#E37736"; // 懸停時變色
            btn.onmouseout = () => btn.style.background = color; // 恢復原色
            btn.onclick = () => {
                // 檢查聊天室是否已載入
                if (!DOMCache.getChatLog()) {
                    window.ChatRoomSendLocalStyled("❌ 聊天室尚未載入", 3000, "#ff0000");
                    return;
                }
                handler(); // 執行按鈕功能
            };
            return btn;
        };

        // 創建各功能按鈕
        const btnHTML = createButton("📥 HTML匯出", () => exportHTML(false)); // 導出當前聊天室為HTML
        const btnExcel = createButton("📊 Excel匯出", exportExcel); // 導出為Excel文件
        const btnCache = createButton("📂 緩存管理", export_DB_HTML); // 管理緩存數據
        const btnClear = createButton("🗑️ 清空緩存", clearCache, "#cc0000"); // 清空當前聊天室（紅色警告色）
        const btnMode = createButton("⏸️ 停用", () => toggleMode(btnMode)); // 模式切換按鈕

        // 將所有按鈕添加到工具欄
        [btnHTML, btnExcel, btnCache, btnClear, btnMode].forEach(btn => toolbar.appendChild(btn));

        // 組裝界面元素
        container.appendChild(toggleButton);
        container.appendChild(toolbar);
        document.body.appendChild(container);

        // 主按鈕點擊事件：切換工具欄顯示/隱藏
        toggleButton.onclick = () => {
            toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
        };

        // 初始化模式按鈕狀態
        updateModeButton(btnMode);
        console.log("[CHE] UI已載入，當前模式:", currentMode);
    }

    // 更新模式按鈕的顯示狀態
    function updateModeButton(btn) {
        if (currentMode === "cache") {
            // 緩存模式：橙色，顯示緩存狀態
            btn.textContent = "💾 緩存中";
            btn.style.background = "#ff8800";
            window.ChatRoomSendLocalStyled("[CHE] 緩存模式：每10分鐘自動保存", 3000, "#ff8800");
        } else {
            // 停用模式：灰色，顯示停用狀態
            btn.textContent = "⏸️ 停用";
            btn.style.background = "#555";
            window.ChatRoomSendLocalStyled("[CHE] 已停用自動緩存", 3000, "#ffa500");
        }
    }

    // 模式切換函數
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            // 從停用切換到緩存模式
            currentMode = "cache";
            initMessageObserver(); // 啟動消息監控
        } else {
            // 從緩存切換到停用模式
            currentMode = "stopped";
            stopAutoSave(); // 停止自動保存
        }

        // 保存模式設置到localStorage
        localStorage.setItem("chatlogger_mode", currentMode);
        updateModeButton(btn); // 更新按鈕顯示
        console.log("[CHE] 模式已切換:", currentMode);
    }

    // ===== 插件初始化系統 =====
    // 主初始化函數，負責啟動所有插件功能
    async function init() {
        try {
            // 1. 載入必要的外部依賴
            await loadToastSystem();

            // 2. 設置數據備份機制
            setupDataBackup();

            // 3. 等待遊戲玩家數據載入完成
            const waitForPlayer = setInterval(() => {
                if (window.Player?.Name) { // 檢查玩家對象是否存在
                    clearInterval(waitForPlayer);

                    console.log("[CHE] 玩家數據已載入，開始初始化插件");

                    // 4. 檢查並恢復臨時數據
                    checkTempData().then(() => {
                        console.log("[CHE] 臨時數據檢查完成");
                    }).catch(e => {
                        console.error("[CHE] 臨時數據檢查失敗:", e);
                    });

                    // 5. 清理7天前的舊數據
                    CacheManager.cleanOldData().then(() => {
                        console.log("[CHE] 舊數據清理完成");
                    }).catch(e => {
                        console.error("[CHE] 舊數據清理失敗:", e);
                    });

                    // 6. 創建用戶界面
                    addUI();

                    // 7. 根據當前模式啟動相應功能
                    if (currentMode === "cache") {
                        console.log("[CHE] 緩存模式，啟動訊息監控");
                        initMessageObserver(); // 啟動消息監控和自動保存
                    }

                    console.log("[CHE] 插件初始化完成，當前模式:", currentMode);
                }
            }, 1000); // 每秒檢查一次玩家數據

            // 8. 嘗試註冊到bcModSdk（如果可用）
            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE Enhanced", // 插件名稱
                    fullName: "Chat History Export Enhanced v2.1", // 完整名稱
                    version: modversion, // 版本號
                    repository: "Enhanced chat room history export with 7-day cache", // 描述
                });
                console.log("[CHE] 已註冊到 bcModSdk");
            }

        } catch (e) {
            // 初始化失敗時的錯誤處理
            console.error("[CHE] 初始化失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 初始化失敗", 3000, "#ff0000");
        }
    }

    // ===== 插件啟動 =====
    // 立即執行初始化函數，啟動整個插件
    init();

})(); // 立即執行函數表達式(IIFE)結束

/*
===== 插件架構總結 =====

這個插件的主要組件和工作流程：

1. **全局變量管理**
   - 版本控制、模式狀態、定時器管理
   - 使用localStorage持久化用戶設置

2. **DOM快取系統 (DOMCache)**
   - 優化DOM查詢性能，避免重複查找
   - 智能緩存失效機制

3. **日期工具 (DateUtils)**  
   - 統一的日期格式處理
   - 支援多種日期格式轉換

4. **緩存管理器 (CacheManager)**
   - IndexedDB數據庫操作
   - 7天數據保留策略
   - 自動去重機制

5. **消息處理系統**
   - 統一的消息過濾邏輯
   - 消息類型檢測
   - 內容解析和格式化

6. **導出系統**
   - HTML導出（支援搜索和主題切換）
   - Excel導出
   - 緩存數據導出

7. **自動保存系統**
   - 10分鐘定時保存
   - DOM變化監控
   - 緊急備份機制

8. **用戶界面**
   - 浮動工具欄
   - 模態對話框
   - 日期選擇器

9. **數據備份系統**
   - 瀏覽器關閉前保存
   - 頁面隱藏時保存
   - 啟動時數據恢復

主要特點：
- 模組化設計，每個功能獨立
- 完善的錯誤處理機制  
- 性能優化（DOM緩存、去重等）
- 用戶友好的界面設計
- 數據安全保障（多重備份）

使用方式：
1. 安裝腳本後會在左下角顯示💾按鈕
2. 點擊主按鈕展開工具欄
3. 切換到"緩存中"模式開始自動保存
4. 使用各種導出功能匯出數據
5. 通過緩存管理進行數據維護

注意事項：
- 緩存數據會自動保留7天
- 10分鐘自動保存一次（緩存模式下）
- 支援瀏覽器異常關閉的數據恢復
- 所有導出功能都有過濾選項
*/
