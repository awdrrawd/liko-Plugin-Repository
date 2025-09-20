// ==UserScript==
// @name         Liko - CHE Enhanced
// @name:zh      Liko的聊天室書記官 (增強版)
// @namespace    https://likolisu.dev/
// @version      2.0
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

    // ==================== 全局變量 ====================
    let modApi; // bcModSdk註冊的mod API對象
    const modversion = "2.0"; // 插件版本號
    let currentMessageCount = 0; // 當前聊天室中的消息數量計數器
    const MESSAGE_SAVE_THRESHOLD = 1000; // 觸發自動保存的消息數量閾值（1000條時自動保存）
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped"; // 當前工作模式：stopped(停用) 或 cache(緩存)
    const validModes = ["stopped", "cache"]; // 有效的工作模式列表

    // ==================== DOM 快取管理 ====================
    // 管理聊天室DOM元素的快取，避免頻繁查詢DOM提升性能
    const DOMCache = {
        chatLog: null, // 緩存的聊天日誌容器元素
        lastCheckTime: 0, // 上次檢查DOM的時間戳

        /**
         * 獲取聊天日誌容器元素
         * @returns {Element|null} 聊天日誌容器元素
         */
        getChatLog() {
            // 每5秒重新檢查一次，防止頁面變化導致元素失效
            const now = Date.now();
            if (!this.chatLog || !document.contains(this.chatLog) || now - this.lastCheckTime > 5000) {
                this.chatLog = document.querySelector("#TextAreaChatLog");
                this.lastCheckTime = now;
            }
            return this.chatLog;
        },

        /**
         * 獲取所有聊天消息元素
         * @returns {Array} 消息元素數組
         */
        getMessages() {
            const log = this.getChatLog();
            return log ? Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div")) : [];
        },

        /**
         * 獲取消息總數
         * @returns {number} 消息數量
         */
        getMessageCount() {
            const log = this.getChatLog();
            return log ? log.querySelectorAll(".ChatMessage, a.beep-link").length : 0;
        }
    };

    // ==================== 日期工具 ====================
    // 處理日期格式化和轉換的工具函數
    const DateUtils = {
        /**
         * 獲取日期鍵值（YYYY-MM-DD格式）
         * @param {Date} date - 日期對象，默認為當前日期
         * @returns {string} 格式化的日期字符串
         */
        getDateKey(date = new Date()) {
            // 使用本地時間而不是UTC時間，避免時區問題
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`; // 返回 YYYY-MM-DD 格式
        },

        /**
         * 獲取顯示用的日期格式（M/D）
         * @param {string} dateKey - 日期鍵值
         * @returns {string} 顯示格式的日期
         */
        getDisplayDate(dateKey) {
            try {
                const date = new Date(dateKey + 'T00:00:00'); // 避免時區問題
                const month = date.getMonth() + 1;
                const day = date.getDate();

                // 直接返回 M/D 格式，例如 9/19, 9/18
                return `${month}/${day}`;
            } catch (e) {
                console.error("[CHE] getDisplayDate 錯誤:", e);
                return dateKey; // 如果解析失敗，返回原始字符串
            }
        }
    };

    // ==================== 緩存管理器 ====================
    // 使用IndexedDB管理聊天記錄的本地緩存
    const CacheManager = {
        /**
         * 初始化IndexedDB數據庫
         * @returns {Promise<IDBDatabase>} 數據庫連接
         */
        async init() {
            const request = indexedDB.open("ChatLoggerV2", 2);

            // 數據庫升級處理
            request.onupgradeneeded = (e) => {
                const db = e.target.result;

                // 刪除舊的存儲結構
                if (db.objectStoreNames.contains("fragments")) {
                    db.deleteObjectStore("fragments");
                }

                // 創建新的按日期存儲的結構
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

        /**
         * 保存今日的消息到數據庫
         * @param {Array} messages - 要保存的消息數組
         * @returns {Promise<number>} 保存後的總消息數
         */
        async saveToday(messages) {
            if (!messages || messages.length === 0) {
                console.log("[CHE] saveToday: 沒有訊息需要保存");
                return;
            }

            try {
                const db = await this.init();
                const dateKey = DateUtils.getDateKey(); // 獲取今日日期鍵

                // 開始數據庫事務
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                // 獲取今天已有的數據
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

                // 簡單合併，不去重（保留所有數據）
                const allMessages = [...existing, ...messages];

                // 保存合併後的數據
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

                // 等待事務完成
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

        /**
         * 獲取所有可用的日期列表
         * @returns {Promise<Array>} 包含日期信息的數組
         */
        async getAvailableDates() {
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");

                // 獲取所有鍵值
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                const result = [];
                for (const key of keys) {
                    // 獲取每個日期的詳細數據
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

                // 按日期排序，最新的在前
                return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
            } catch (e) {
                console.error("[CHE] 獲取日期列表失敗:", e);
                return [];
            }
        },

        /**
         * 獲取指定日期的消息
         * @param {Array} dateKeys - 日期鍵值數組
         * @returns {Promise<Array>} 消息數組
         */
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
                        // 為緩存的訊息數據添加標識，以便在HTML中正確處理
                        const messagesWithFlag = data.messages.map(msg => ({
                            ...msg,
                            isFromCache: true
                        }));
                        allMessages.push(...messagesWithFlag);
                    }
                }

                // 按時間排序
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

        /**
         * 刪除指定日期的數據
         * @param {Array} dateKeys - 要刪除的日期鍵值數組
         * @returns {Promise<boolean>} 是否成功刪除
         */
        async deleteDates(dateKeys) {
            if (!dateKeys || dateKeys.length === 0) {
                console.log("[CHE] deleteDates: 沒有要刪除的日期");
                return false;
            }

            console.log(`[CHE] deleteDates: 開始刪除操作，目標日期:`, dateKeys);

            try {
                const db = await this.init();
                console.log("[CHE] deleteDates: 數據庫連接成功");

                // 為每個日期創建獨立事務進行刪除
                let successCount = 0;
                for (const dateKey of dateKeys) {
                    try {
                        console.log(`[CHE] deleteDates: 處理日期 ${dateKey}`);

                        // 為每個刪除操作創建獨立事務
                        const tx = db.transaction(["daily_fragments"], "readwrite");
                        const store = tx.objectStore("daily_fragments");

                        // 先檢查數據是否存在
                        const getReq = store.get(dateKey);
                        const exists = await new Promise((resolve, reject) => {
                            getReq.onsuccess = () => {
                                const result = getReq.result;
                                console.log(`[CHE] deleteDates: ${dateKey} 存在檢查:`, result ? "存在" : "不存在");
                                resolve(result !== undefined);
                            };
                            getReq.onerror = () => {
                                console.error(`[CHE] deleteDates: 檢查 ${dateKey} 時出錯:`, getReq.error);
                                reject(getReq.error);
                            };
                        });

                        if (exists) {
                            // 執行刪除操作
                            const deleteReq = store.delete(dateKey);
                            await new Promise((resolve, reject) => {
                                deleteReq.onsuccess = () => {
                                    console.log(`[CHE] deleteDates: ✓ 成功刪除 ${dateKey}`);
                                    successCount++;
                                    resolve();
                                };
                                deleteReq.onerror = () => {
                                    console.error(`[CHE] deleteDates: ✗ 刪除 ${dateKey} 失敗:`, deleteReq.error);
                                    reject(deleteReq.error);
                                };
                            });
                        } else {
                            console.log(`[CHE] deleteDates: ${dateKey} 不存在，跳過`);
                        }

                        // 等待事務完成
                        await new Promise((resolve, reject) => {
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => reject(tx.error);
                            tx.onabort = () => reject(new Error("事務被中止"));
                        });

                    } catch (itemError) {
                        console.error(`[CHE] deleteDates: 處理 ${dateKey} 時出現錯誤:`, itemError);
                        // 繼續處理下一個，不中斷整個流程
                    }
                }

                console.log(`[CHE] deleteDates: 刪除完成，成功刪除 ${successCount}/${dateKeys.length} 個項目`);

                if (successCount > 0) {
                    window.ChatRoomSendLocalStyled(`[CHE] 已刪除 ${successCount} 個日期的數據`, 3000, "#00ff00");

                    // 強制清理：嘗試清理可能的殘留數據
                    try {
                        await this.forceCleanup();
                    } catch (cleanupError) {
                        console.error("[CHE] deleteDates: 強制清理失敗:", cleanupError);
                    }

                    return true;
                } else {
                    window.ChatRoomSendLocalStyled("[CHE] 沒有數據被刪除（可能已不存在）", 3000, "#ffa500");
                    return false;
                }

            } catch (e) {
                console.error("[CHE] deleteDates: 整體操作失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ 刪除操作失敗", 3000, "#ff0000");
                return false;
            }
        },

        /**
         * 強制清理數據庫的驗證方法
         */
        async forceCleanup() {
            console.log("[CHE] forceCleanup: 開始強制清理");
            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readonly");
                const store = tx.objectStore("daily_fragments");

                // 獲取所有鍵值，驗證數據
                const allKeys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                console.log("[CHE] forceCleanup: 清理後剩餘的鍵值:", allKeys);

            } catch (e) {
                console.error("[CHE] forceCleanup: 清理檢查失敗:", e);
            }
        },

        /**
         * 清理7天以前的舊數據
         */
        async cleanOldData() {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // 計算7天前的日期
            const cutoffKey = DateUtils.getDateKey(sevenDaysAgo);

            try {
                const db = await this.init();
                const tx = db.transaction(["daily_fragments"], "readwrite");
                const store = tx.objectStore("daily_fragments");

                // 獲取所有鍵值
                const keys = await new Promise((resolve, reject) => {
                    const req = store.getAllKeys();
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });

                // 篩選出需要刪除的舊數據
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

    // ==================== 外部庫載入 ====================
    /**
     * 載入樣式化訊息系統
     * @returns {Promise} 載入完成的Promise
     */
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

    // 檢查並載入XLSX庫
    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = () => console.log("[CHE] xlsx.full.min.js 載入完成");
        document.head.appendChild(script);
    }

    // ==================== 消息過濾函數 ====================
    /**
     * 判斷消息是否應該被過濾掉
     * @param {string} text - 消息文本
     * @param {boolean} isPrivate - 是否為私人消息
     * @returns {boolean} 是否應該過濾
     */
    function isFilteredMessage(text, isPrivate) {
        return (
            text.includes("BCX commands tutorial") ||
            text.includes("BCX also provides") ||
            text.includes("(输入 /help 查看命令列表)") ||
            (isPrivate && (text.includes("悄悄話") || text.includes("好友私聊") || text.includes("BEEP")))
        );
    }

    // ==================== HTML 處理工具 ====================
    /**
     * HTML轉義函數，防止XSS攻擊
     * @param {string} text - 要轉義的文本
     * @returns {string} 轉義後的安全文本
     */
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * 提取DOM元素的完整文本內容，包括鏈接處理
     * @param {Element} element - 要提取文本的DOM元素
     * @returns {string} 提取的文本內容
     */
    function extractFullTextContent(element) {
        if (!element) return "";
        try {
            const clone = element.cloneNode(true); // 克隆元素避免修改原DOM
            const links = clone.querySelectorAll('a[href]');
            
            // 處理鏈接，將href添加到文本中
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
            return text.replace(/\s*\n\s*/g, '\n').trim(); // 清理多餘的空白字符
        } catch (e) {
            console.error("[CHE] extractFullTextContent 錯誤:", e);
            return element.textContent || element.innerText || "";
        }
    }

    // ==================== 顏色處理工具 ====================
    /**
     * 獲取消息標籤的顏色
     * @param {Element} msg - 消息元素
     * @param {Element} nameButton - 名稱按鈕元素
     * @returns {string} 顏色值
     */
    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        
        // 嘗試從多個位置獲取顏色信息
        let c =
            msg.style?.getPropertyValue("--label-color") ||
            getComputedStyle(msg).getPropertyValue("--label-color") ||
            (nameButton && (nameButton.style?.getPropertyValue("--label-color") || getComputedStyle(nameButton).getPropertyValue("--label-color"))) ||
            "";
        c = c.trim();
        if (c) return c;
        
        // 從樣式中查找顏色
        const colorSpan = msg.querySelector('[style*="color"]');
        if (colorSpan && colorSpan.style?.color) return colorSpan.style.color;
        
        const fontEl = msg.querySelector("font[color]");
        if (fontEl && fontEl.color) return fontEl.color;
        
        return "#000";
    }

    /**
     * 根據主題調整顏色對比度
     * @param {string} hexColor - 原始顏色
     * @param {boolean} isDarkTheme - 是否為深色主題
     * @returns {string} 調整後的顏色
     */
    function getContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return "#000";

        let cleanColor = hexColor.trim();
        
        // 處理RGB格式顏色
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
            // 計算亮度值
            const r = parseInt(cleanColor.slice(1, 3), 16);
            const g = parseInt(cleanColor.slice(3, 5), 16);
            const b = parseInt(cleanColor.slice(5, 7), 16);
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // 根據主題調整顏色
            if (isDarkTheme) {
                if (luminance < 0.3) {
                    return lightenColor(cleanColor, 0.5); // 過暗則提亮
                } else if (luminance < 0.5) {
                    return lightenColor(cleanColor, 0.2);
                }
                return cleanColor;
            } else {
                if (luminance > 0.8) {
                    return darkenColor(cleanColor, 0.5); // 過亮則變暗
                } else if (luminance > 0.6) {
                    return darkenColor(cleanColor, 0.2);
                }
                return cleanColor;
            }
        } catch (e) {
            return cleanColor;
        }
    }

    /**
     * 調亮顏色
     * @param {string} color - 原始顏色
     * @param {number} amount - 調亮程度 (0-1)
     * @returns {string} 調亮後的顏色
     */
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

    /**
     * 調暗顏色
     * @param {string} color - 原始顏色
     * @param {number} amount - 調暗程度 (0-1)
     * @returns {string} 調暗後的顏色
     */
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

    // ==================== UI 對話框 ====================
    /**
     * 顯示自定義提示對話框
     * @param {string} message - 提示消息
     * @param {Array} options - 選項數組
     * @returns {Promise} 用戶選擇的結果
     */
    function showCustomPrompt(message, options = []) {
        return new Promise(function(resolve) {
            // 創建模態對話框
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center;
                z-index: 2000;
            `;

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

            // 綁定事件處理器
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

    /**
     * 顯示日期選擇器對話框，用於緩存管理
     * @returns {Promise} 用戶的操作選擇
     */
    async function showDateSelector() {
        const availableDates = await CacheManager.getAvailableDates();

        if (availableDates.length === 0) {
            // 如果沒有緩存數據，提供保存當前訊息的選項
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

            // 全選/取消全選功能
            modal.querySelector("#selectAll").onclick = () => {
                const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                checkboxes.forEach(cb => cb.checked = !allChecked);
            };

            // 保存當前訊息
            modal.querySelector("#saveCurrent").onclick = () => {
                document.body.removeChild(modal);
                resolve({ action: 'save_current' });
            };

            // 取消操作
            modal.querySelector("#cancelBtn").onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };

            // 匯出選中的日期
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

            // 刪除選中的日期
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

    // ==================== 消息處理 ====================
    /**
     * 處理當前聊天室中的所有消息，轉換為標準格式
     * @returns {Array} 處理後的消息數組
     */
    function processCurrentMessages() {
        const messages = DOMCache.getMessages();
        const processedMessages = [];

        messages.forEach(msg => {
            try {
                // 構建標準消息對象
                let messageData = {
                    time: msg.dataset?.time || new Date().toISOString(), // 時間戳
                    id: msg.dataset?.sender || "", // 發送者ID
                    content: extractFullTextContent(msg), // 消息內容
                    type: "normal", // 消息類型
                    color: "#000" // 顏色
                };

                // 判斷消息類型
                if (msg.classList.contains("ChatMessageWhisper")) {
                    messageData.type = "whisper"; // 悄悄話
                } else if (msg.matches && msg.matches("a.beep-link")) {
                    messageData.type = "beep"; // 私信提示
                }

                // 獲取消息顏色
                messageData.color = getLabelColor(msg, msg.querySelector(".ChatMessageName"));

                // 過濾不需要的消息
                if (!isFilteredMessage(messageData.content, messageData.type === "whisper")) {
                    processedMessages.push(messageData);
                }
            } catch (e) {
                console.error("[CHE] processCurrentMessages: 訊息處理錯誤", e);
            }
        });

        return processedMessages;
    }

    // ==================== HTML 匯出功能 ====================
    /**
     * 匯出聊天記錄為HTML格式（主要匯出函數）
     * @param {boolean} NoLeave - 是否顯示UI提示
     * @param {boolean|null} includePrivate - 是否包含私人消息
     */
    async function exportChatAsHTML(NoLeave = true, includePrivate = null) {
        const processExport = async function(finalIncludePrivate) {
            if (NoLeave) {
                window.ChatRoomSendLocalStyled("[CHE] 正在匯出 HTML，請稍候...", 3000, "#ffa500");
            }
            
            // 獲取聊天日誌容器
            const log = DOMCache.getChatLog();
            if (!log || log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器或無訊息可匯出", 5000, "#ff0000", null, null, "24px");
                return;
            }

            const totalMessages = log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length;
            let messages = [];
            const currentMessages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));

            messages = currentMessages;

            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 沒有訊息可匯出", 5000, "#ff0000", null, null, "24px");
                return;
            }

            /**
             * 將顏色轉換為RGBA格式
             * @param {string} color - 原始顏色
             * @param {number} alpha - 透明度
             * @returns {string} RGBA顏色字符串
             */
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

            // 搜尋控制面板HTML
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
                    <button onclick="clearAllFilters()" style="padding: 6px 12px; border-radius: 6px; border: none; background: #666; color: #fff; cursor: pointer; font-size: 14px; transition: background 0.2s;">清除</button>
                </div>
                <div style="margin-top: 8px; font-size: 13px;">
                    <span id="filterStats" style="color: #aaa;"></span>
                </div>
            </div>`;

            // 生成完整的HTML頁面
            let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            /* 基礎樣式 */
            body {
                font-family: sans-serif;
                background: #111;
                color: #eee;
                transition: all 0.3s ease;
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
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                background: #fff;
                color: #000;
                transition: all 0.3s ease;
            }

            /* 深色模式下的顏色調整 */
            body:not(.light) .chat-content span[style*="color"] {
                filter: brightness(1.3) saturate(0.9);
            }
            body:not(.light) .chat-content span[style*="color:#000"],
            body:not(.light) .chat-content span[style*="color: #000"],
            body:not(.light) .chat-content span[style*="color:black"],
            body:not(.light) .chat-content span[style*="color: black"] {
                color: #e0e0e0 !important;
            }

            /* 淺色模式樣式 */
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
            }
            body.light #contentSearch, body.light #idFilter, body.light #timeRange {
                background: #f5f5f5 !important;
                color: #333 !important;
                border-color: #ccc !important;
            }

            /* 淺色模式下的顏色調整 */
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
        <button id="toggleTheme">淺色模式</button>
        ${searchControls}
        <div id="chatlog">
    `;

            // 處理消息的變量
            const processedBeeps = new Set(); // 已處理的beep消息集合
            let collapseId = 0; // 折疊內容ID計數器
            let openCollapsible = false; // 是否有打開的折疊內容
            let lastSeparatorText = ""; // 最後的分隔符文本
            let processedCount = 0; // 已處理的消息計數
            const isDarkTheme = !document.body.classList.contains('light'); // 是否為深色主題

            // 逐個處理消息
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
                        
                        // 關閉上一個折疊內容
                        if (openCollapsible) html += `</div>`;
                        
                        // 添加新的分隔符和折疊內容
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

                // 處理beep消息
                if (msg.matches && msg.matches("a.beep-link")) {
                    if (!finalIncludePrivate) continue;
                    const beepContent = escapeHtml(extractFullTextContent(msg).trim());
                    if (processedBeeps.has(beepContent)) continue; // 避免重複
                    processedBeeps.add(beepContent);
                    html += `
            <div class="chat-row with-accent" style="background: ${toRGBA('#ff6b6b', 0.12)}; border-left-color: #ff6b6b;">
                <div class="chat-meta"></div>
                <div class="chat-content beep">${beepContent}</div>
            </div>`;
                    processedCount++;
                    continue;
                }

                // 跳過沒有dataset的元素
                if (!msg.dataset) continue;

                // 提取消息基本信息
                const time = msg.dataset.time || "";
                const senderId = msg.dataset.sender || "";
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton ? nameButton.innerText : "";
                let labelColor = getLabelColor(msg, nameButton);

                // 應用顏色對比度調整
                const adjustedColor = getContrastColor(labelColor, isDarkTheme);

                let rawText = "";
                const textNode = msg.querySelector(".chat-room-message-content");

                // 提取消息文本
                if (textNode) {
                    rawText = extractFullTextContent(textNode);
                } else {
                    const clonedMsg = msg.cloneNode(true);
                    clonedMsg.querySelectorAll('.chat-room-metadata, .chat-room-message-popup, .ChatMessageName').forEach(meta => meta.remove());
                    rawText = extractFullTextContent(clonedMsg).trim();
                }

                // 過濾不需要的消息
                if (isFilteredMessage(rawText, msg.classList.contains("ChatMessageWhisper") && !finalIncludePrivate)) continue;
                if (lastSeparatorText && rawText.includes(lastSeparatorText)) continue;

                let content = "";
                let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

                // 根據消息類型生成內容
                if (msg.classList.contains("ChatMessageChat")) {
                    // 普通聊天消息
                    content = `<span style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                } else if (msg.classList.contains("ChatMessageWhisper")) {
                    // 悄悄話消息
                    if (!finalIncludePrivate) continue;
                    const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                    content = `${prefix} <span style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                } else if (
                    msg.classList.contains("ChatMessageAction") ||
                    msg.classList.contains("ChatMessageActivity") ||
                    msg.classList.contains("ChatMessageEmote") ||
                    msg.classList.contains("ChatMessageEnterLeave")
                ) {
                    // 動作/活動/表情/進出消息
                    content = `<span style="color:${adjustedColor}">${escapeHtml(rawText.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, "").trim())}</span>`;
                } else if (msg.classList.contains("ChatMessageLocalMessage") || msg.classList.contains("ChatMessageNonDialogue")) {
                    // 本地消息/非對話消息
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
                    // 其他類型消息
                    content = escapeHtml(rawText.trim());
                }

                // 添加消息行HTML
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

            // 關閉最後的折疊內容
            if (openCollapsible) html += `</div>`;
            
            // 完成HTML並添加JavaScript
            html += `
        </div>
        <script>
            let allChatRows = Array.from(document.querySelectorAll('.chat-row'));

            // 折疊功能
            function toggleCollapse(id) {
                const element = document.getElementById('collapse-' + id);
                if (element) element.classList.toggle('collapsed');
            }

            // 時間解析函數
            function parseTimeString(timeStr) {
                if (timeStr.includes('T')) {
                    return new Date(timeStr);
                }
                const today = new Date();
                const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                today.setHours(hours, minutes, seconds || 0, 0);
                return today;
            }

            // 應用篩選器
            function applyFilters() {
                const contentTerm = document.getElementById('contentSearch').value.toLowerCase();
                const idTerms = document.getElementById('idFilter').value.toLowerCase().split(',').map(t => t.trim()).filter(t => t);
                const timeRange = document.getElementById('timeRange').value;

                let visibleCount = 0;
                const now = new Date();

                allChatRows.forEach(row => {
                    let visible = true;

                    // 內容篩選
                    if (contentTerm) {
                        const content = row.querySelector('.chat-content')?.textContent.toLowerCase() || '';
                        visible = visible && content.includes(contentTerm);
                    }

                    // ID篩選
                    if (idTerms.length > 0) {
                        const id = row.querySelector('.chat-id')?.textContent.toLowerCase() || '';
                        visible = visible && idTerms.some(term => id.includes(term));
                    }

                    // 時間篩選
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

            // 綁定事件監聽器
            ['contentSearch', 'idFilter'].forEach(id => {
                document.getElementById(id).addEventListener('input', applyFilters);
            });
            document.getElementById('timeRange').addEventListener('change', applyFilters);

            // 清除所有篩選器
            function clearAllFilters() {
                document.getElementById('contentSearch').value = '';
                document.getElementById('idFilter').value = '';
                document.getElementById('timeRange').value = '';
                applyFilters();
            }

            // 主題切換
            document.getElementById("toggleTheme").onclick = function() {
                document.body.classList.toggle("light");
                this.textContent = document.body.classList.contains("light") ? "深色模式" : "淺色模式";
            };

            // 初始化統計
            applyFilters();
        </script>
    </body>
    </html>
    `;

            try {
                // 創建並下載HTML文件
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
                window.ChatRoomSendLocalStyled("[CHE] ❌ HTML 匯出失敗，請重試", 5000, "#ff0000", null, null, "24px");
            }
        };

        // 根據參數決定是否顯示確認對話框
        if (NoLeave && includePrivate === null) {
            showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?").then(processExport).catch(function(e) {
                console.error("[CHE] showCustomPrompt 錯誤:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ HTML 匯出取消", 5000, "#ff0000", null, null, "24px");
            });
        } else {
            const includePrivateValue = includePrivate !== null ? includePrivate : false;
            await processExport(includePrivateValue);
        }
    }

    /**
     * HTML匯出入口函數
     * @param {boolean} fromCache - 是否從緩存匯出
     */
    async function exportHTML(fromCache = false) {
        let messages = [];

        if (fromCache) {
            // 開啟緩存管理時立即保存當前訊息
            const currentMessages = processCurrentMessages();
            if (currentMessages.length > 0) {
                await CacheManager.saveToday(currentMessages);
                window.ChatRoomSendLocalStyled("[CHE] 已合併當前訊息到今日緩存", 2000, "#00ff00");
            }

            const result = await showDateSelector();
            if (!result || result.action !== 'export' || result.dates.length === 0) {
                return;
            }

            if (result.action === 'delete') {
                const confirmDelete = await showCustomPrompt(`確定要刪除 ${result.dates.length} 個日期的數據嗎？`);
                if (confirmDelete) {
                    await CacheManager.deleteDates(result.dates);
                    window.ChatRoomSendLocalStyled(`[CHE] 已刪除 ${result.dates.length} 個日期的數據`, 3000, "#00ff00");
                }
                return;
            }

            messages = await CacheManager.getMessagesForDates(result.dates);
            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] 選中日期沒有數據", 3000, "#ffa500");
                return;
            }
        } else {
            messages = processCurrentMessages();
            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] 沒有訊息可匯出", 3000, "#ffa500");
                return;
            }
        }

        const includePrivate = await showCustomPrompt("是否包含悄悄話和私信？");

        // 直接調用原本的HTML匯出函數
        await exportChatAsHTML(true, includePrivate);
    }

    // ==================== Excel 匯出功能 ====================
    /**
     * 匯出聊天記錄為Excel格式
     */
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
            // 準備Excel數據
            const data = [["時間", "ID", "內容"]]; // 表頭

            messages.forEach(msg => {
                if (!includePrivate && msg.type === "whisper") return;
                if (isFilteredMessage(msg.content, msg.type === "whisper")) return;

                // 格式化時間顯示
                const timeDisplay = typeof msg.time === 'string' && msg.time.includes('T')
                    ? new Date(msg.time).toLocaleString()
                    : msg.time;

                data.push([timeDisplay, msg.id, msg.content]);
            });

            // 創建工作表和工作簿
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "ChatLog");

            // 生成並下載Excel文件
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

    // ==================== 聊天室管理 ====================
    /**
     * 清空當前聊天室的消息（不影響緩存）
     */
    async function clearCache() {
        const confirm = await showCustomPrompt("確定要清空當前聊天室的訊息嗎？\n（緩存數據庫不會被清空）");
        if (!confirm) return;

        try {
            const chatLog = DOMCache.getChatLog();
            if (!chatLog) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器", 3000, "#ff0000");
                return;
            }

            // 保留房間分隔符和最後的房間信息
            const nodes = Array.from(chatLog.children);
            let lastRoomNode = null;
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].classList.contains("chat-room-sep") || 
                    nodes[i].classList.contains("chat-room-sep-last") || 
                    nodes[i].classList.contains("chat-room-sep-div")) {
                    lastRoomNode = nodes[i];
                    break;
                }
            }

            // 清空聊天室並恢復房間信息
            chatLog.innerHTML = "";
            if (lastRoomNode) chatLog.appendChild(lastRoomNode);

            currentMessageCount = 0; // 重置計數器
            window.ChatRoomSendLocalStyled("[CHE] 當前聊天室已清空！", 3000, "#00ff00");
        } catch (e) {
            console.error("[CHE] 清空聊天室失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 清空失敗", 3000, "#ff0000");
        }
    }

    // ==================== 消息監控系統 ====================
    /**
     * 初始化消息監控器，監控新消息的添加
     */
    function initMessageObserver() {
        console.log("[CHE] 開始初始化訊息監控");
        const maxWaitTime = 10 * 60 * 1000; // 最大等待時間：10分鐘
        const startTime = Date.now();

        // 等待聊天室載入的循環檢查
        const checkChatRoom = setInterval(() => {
            const chatLog = DOMCache.getChatLog();
            if (chatLog) {
                clearInterval(checkChatRoom);
                console.log("[CHE] 訊息監控已啟動，當前計數:", currentMessageCount);

                // 重置計數器為當前消息數量
                currentMessageCount = DOMCache.getMessageCount();
                console.log("[CHE] 初始訊息數量:", currentMessageCount);

                // 創建MutationObserver監控DOM變化
                const observer = new MutationObserver((mutations) => {
                    let newMessages = 0;
                    mutations.forEach((mutation) => {
                        if (mutation.addedNodes.length) {
                            mutation.addedNodes.forEach((node) => {
                                // 檢查是否為新的聊天消息
                                if (node.matches && (node.matches(".ChatMessage") || node.matches("a.beep-link"))) {
                                    newMessages++;
                                }
                            });
                        }
                    });

                    if (newMessages > 0) {
                        currentMessageCount += newMessages;
                        console.log(`[CHE] 新增 ${newMessages} 條訊息，當前總數: ${currentMessageCount}`);

                        // 檢查是否達到自動保存閾值
                        if (currentMessageCount >= MESSAGE_SAVE_THRESHOLD) {
                            console.log(`[CHE] 達到 ${MESSAGE_SAVE_THRESHOLD} 條訊息，觸發自動保存`);
                            saveCurrentMessages();
                        }
                    }
                });

                // 開始監控聊天日誌容器
                observer.observe(chatLog, {
                    childList: true, // 監控子節點的添加和刪除
                    subtree: true    // 監控所有後代節點
                });

                console.log("[CHE] MutationObserver 已啟動");
            } else if (Date.now() - startTime > maxWaitTime) {
                console.error("[CHE] 聊天室載入超時");
                clearInterval(checkChatRoom);
            }
        }, 500); // 每500ms檢查一次
    }

    /**
     * 保存當前聊天室中的所有消息到緩存
     */
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
                // 保存後重置計數器
                currentMessageCount = 0;
                console.log("[CHE] saveCurrentMessages: 保存完成，計數器已重置");

                // 清理聊天室DOM，保留最新500條消息以節省內存
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

    // ==================== 數據備份系統 ====================
    /**
     * 設置數據備份系統，防止意外關閉導致數據丟失
     */
    function setupDataBackup() {
        // beforeunload 事件（關閉瀏覽器/標籤頁時）
        window.addEventListener('beforeunload', (e) => {
            if (currentMode === "cache") {
                saveToLocalStorage("beforeunload事件");
            }
        });

        // 每隔5分鐘自動備份一次（防止意外關閉）
        setInterval(() => {
            if (currentMode === "cache") {
                saveToLocalStorage("定期備份");
            }
        }, 5 * 60 * 1000); // 5分鐘

        // 頁面隱藏時備份（切換標籤頁等）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && currentMode === "cache") {
                saveToLocalStorage("頁面隱藏");
            }
        });
    }

    /**
     * 將當前消息保存到localStorage作為臨時備份
     * @param {string} reason - 保存原因
     */
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

    /**
     * 頁面載入時檢查並恢復臨時數據
     */
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

            // 只恢復今天或昨天的數據
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

            // 清除臨時數據
            localStorage.removeItem('che_temp_data');
            console.log("[CHE] checkTempData: 已清除臨時數據");

        } catch (e) {
            console.error("[CHE] checkTempData: 整體處理失敗:", e);
            // 清除可能損壞的數據
            try {
                localStorage.removeItem('che_temp_data');
            } catch (cleanupError) {
                console.error("[CHE] checkTempData: 清理失敗:", cleanupError);
            }
        }
    }

    /**
     * 檢查日期是否為昨天
     * @param {string} dateStr - 日期字符串
     * @returns {boolean} 是否為昨天
     */
    function isYesterday(dateStr) {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            return dateStr === DateUtils.getDateKey(yesterday);
        } catch (e) {
            console.error("[CHE] isYesterday 錯誤:", e);
            return false;
        }
    }

    // ==================== 用戶界面 ====================
    /**
     * 添加插件的用戶界面
     */
    function addUI() {
        // 移除可能存在的舊UI
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
        toggleButton.title = "聊天室記錄管理器 v2.0";

        // 主按鈕懸停效果
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

        /**
         * 創建工具欄按鈕的輔助函數
         * @param {string} label - 按鈕標籤
         * @param {Function} handler - 點擊處理函數
         * @param {string} color - 背景顏色
         * @returns {HTMLButtonElement} 創建的按鈕元素
         */
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
                // 檢查聊天室是否已載入
                if (!DOMCache.getChatLog()) {
                    window.ChatRoomSendLocalStyled("❌ 聊天室尚未載入", 3000, "#ff0000");
                    return;
                }
                handler();
            };
            return btn;
        };

        // 創建各功能按鈕
        const btnHTML = createButton("📥 HTML匯出", () => exportHTML(false));
        const btnExcel = createButton("📊 Excel匯出", exportExcel);
        const btnCache = createButton("📂 緩存管理", () => exportHTML(true));
        const btnClear = createButton("🗑️ 清空緩存", clearCache, "#cc0000");
        const btnMode = createButton("⏸️ 停用", () => toggleMode(btnMode));

        // 將按鈕添加到工具欄
        [btnHTML, btnExcel, btnCache, btnClear, btnMode].forEach(btn => toolbar.appendChild(btn));

        // 組裝UI
        container.appendChild(toggleButton);
        container.appendChild(toolbar);
        document.body.appendChild(container);

        // 主按鈕點擊事件：切換工具欄顯示
        toggleButton.onclick = () => {
            toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
        };

        // 初始化模式按鈕狀態
        updateModeButton(btnMode);
        console.log("[CHE] UI已載入，當前模式:", currentMode);
    }

    /**
     * 更新模式按鈕的顯示狀態
     * @param {HTMLButtonElement} btn - 模式切換按鈕
     */
    function updateModeButton(btn) {
        if (currentMode === "cache") {
            btn.textContent = "💾 緩存中";
            btn.style.background = "#ff8800"; // 橙色表示緩存模式
            window.ChatRoomSendLocalStyled("[CHE] 緩存模式：訊息將自動保存7天", 3000, "#ff8800");
        } else {
            btn.textContent = "⏸️ 停用";
            btn.style.background = "#555"; // 灰色表示停用
            window.ChatRoomSendLocalStyled("[CHE] 已停用自動緩存", 3000, "#ffa500");
        }
    }

    /**
     * 切換工作模式（停用/緩存）
     * @param {HTMLButtonElement} btn - 模式切換按鈕
     */
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "cache";
            initMessageObserver(); // 啟動消息監控
        } else {
            currentMode = "stopped";
        }

        // 保存模式到localStorage
        localStorage.setItem("chatlogger_mode", currentMode);
        updateModeButton(btn);
        console.log("[CHE] 模式已切換:", currentMode);
    }

    // ==================== 主初始化函數 ====================
    /**
     * 插件主初始化函數
     */
    async function init() {
        try {
            // 載入外部依賴
            await loadToastSystem();

            // 設置數據備份系統
            setupDataBackup();

            // 等待玩家數據載入
            const waitForPlayer = setInterval(() => {
                if (window.Player?.Name) {
                    clearInterval(waitForPlayer);

                    console.log("[CHE] 玩家數據已載入，開始初始化插件");

                    // 檢查並恢復臨時數據
                    checkTempData().then(() => {
                        console.log("[CHE] 臨時數據檢查完成");
                    }).catch(e => {
                        console.error("[CHE] 臨時數據檢查失敗:", e);
                    });

                    // 清理7天以前的舊數據
                    CacheManager.cleanOldData().then(() => {
                        console.log("[CHE] 舊數據清理完成");
                    }).catch(e => {
                        console.error("[CHE] 舊數據清理失敗:", e);
                    });

                    // 添加用戶界面
                    addUI();

                    // 如果是緩存模式，啟動消息監控
                    if (currentMode === "cache") {
                        console.log("[CHE] 緩存模式，啟動訊息監控");
                        initMessageObserver();
                    }

                    console.log("[CHE] 插件初始化完成，當前模式:", currentMode);
                }
            }, 1000); // 每秒檢查一次玩家數據

            // 註冊到bcModSdk（如果可用）
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

    // ==================== 插件啟動 ====================
    // 執行主初始化函數，啟動整個插件
    init();

})(); // 立即執行函數表達式結束
