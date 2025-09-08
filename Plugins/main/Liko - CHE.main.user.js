// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      1.3
// @description  聊天室紀錄匯出 \ Chat room history export to html/excel
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
    const modversion = "1.3";
    let fragmentCounter = parseInt(localStorage.getItem("fragment_count") || "0");
    let messageCountSinceLastSave = parseInt(localStorage.getItem("message_count_since_last_save") || "0");
    let lastPromptTime = 0;
    const MESSAGE_SAVE_THRESHOLD = 500;
    let currentMode = localStorage.getItem("chatlogger_mode") || "stopped";
    const validModes = ["stopped", "onleave_include_private", "onleave_exclude_private"];

    // 新增：顏色對比度調整函數
    function getContrastColor(hexColor, isDarkTheme) {
        if (!hexColor || typeof hexColor !== 'string') return "#000";

        // 清理顏色字符串
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

            // 計算相對亮度
            const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            // 根據主題和亮度調整
            if (isDarkTheme) {
                // 深色主題：太暗的顏色變亮
                if (luminance < 0.3) {
                    return lightenColor(cleanColor, 0.5);
                } else if (luminance < 0.5) {
                    return lightenColor(cleanColor, 0.2);
                }
                return cleanColor;
            } else {
                // 淺色主題：太亮的顏色變暗
                if (luminance > 0.8) {
                    return darkenColor(cleanColor, 0.5);
                } else if (luminance > 0.6) {
                    return darkenColor(cleanColor, 0.2);
                }
                return cleanColor;
            }
        } catch (e) {
            console.error("[CHE] 顏色處理錯誤:", e);
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

    // 新增：訊息數量驗證
    function validateExportCount(expectedCount, actualCount, exportType) {
        const tolerance = Math.max(10, Math.ceil(expectedCount * 0.05)); // 5% 容錯或最少10條
        if (Math.abs(expectedCount - actualCount) > tolerance) {
            window.ChatRoomSendLocalStyled(
                `[CHE] ⚠️ ${exportType} 匯出數量不符！預期:${expectedCount} 實際:${actualCount}，建議重新匯出`,
                8000, "#ffa500", null, null, "24px"
            );
            return false;
        }
        return true;
    }

    // 載入樣式化訊息系統
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) {
                console.log("[CHE] ChatRoomSendLocalStyled 已存在，版本:", window.ChatRoomSendLocalStyled._version || "未知");
                resolve();
                return;
            }
            const toastUrl = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js`;
            const script = document.createElement('script');
            script.src = toastUrl;
            script.onload = () => {
                console.log("[CHE]✅ BC_toast_system.user.js 載入完成");
                resolve();
            };
            script.onerror = () => {
                console.error("[CHE]❌ BC_toast_system.user.js 載入失敗");
                window.alert("❌ 樣式化訊息系統載入失敗，將使用簡單提示");
                reject(new Error("載入失敗"));
            };
            document.head.appendChild(script);
        });
    }

    // XLSX 載入
    if (!window.XLSX?.version) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = () => console.log("[CHE]✅ xlsx.full.min.js 載入完成");
        script.onerror = (e) => {
            console.error("[CHE]❌ xlsx.full.min.js 載入失敗", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ Excel 匯出失敗：XLSX 庫載入錯誤", 5000, "#ff0000", null, null, "24px");
        };
        document.head.appendChild(script);
    } else {
        console.log("[CHE] xlsx.full.min.js 已存在，跳過載入");
    }

    // 共用訊息過濾函數
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

    // 提取完整文本內容（加強錯誤處理）
    function extractFullTextContent(element) {
        if (!element) return "";

        try {
            const clone = element.cloneNode(true);
            const links = clone.querySelectorAll('a[href]');
            links.forEach(function(link) {
                try {
                    const href = link.getAttribute('href');
                    const text = link.innerText || link.textContent || '';
                    if (text && text !== href && !text.includes('http')) {
                        link.textContent = text + ' (' + href + ')';
                    } else {
                        link.textContent = href;
                    }
                } catch (e) {
                    console.error("[CHE] 處理連結錯誤:", e);
                }
            });

            const imgLinks = clone.querySelectorAll('a.bce-img-link');
            imgLinks.forEach(function(imgLink) {
                try {
                    const href = imgLink.getAttribute('href');
                    const img = imgLink.querySelector('img');
                    if (img && href) {
                        imgLink.textContent = '[图片: ' + href + ']';
                    }
                } catch (e) {
                    console.error("[CHE] 處理圖片連結錯誤:", e);
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

    // 自訂提示視窗
    function showCustomPrompt(message) {
        return new Promise(function(resolve) {
            const modal = document.createElement("div");
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;
                z-index: 1000;
            `;
            modal.innerHTML = `
                <div style="background: #fff; color: #000; padding: 20px; border-radius: 8px; max-width: 400px; text-align: center;">
                    <h3>保存設定</h3>
                    <p>${message}</p>
                    <button id="customPromptYes" style="margin: 10px; padding: 8px 16px; cursor: pointer;">是</button>
                    <button id="customPromptNo" style="margin: 10px; padding: 8px 16px; cursor: pointer;">否</button>
                </div>
            `;
            document.body.appendChild(modal);
            const yesButton = modal.querySelector("#customPromptYes");
            const noButton = modal.querySelector("#customPromptNo");
            if (yesButton && noButton) {
                yesButton.onclick = function() {
                    document.body.removeChild(modal);
                    resolve(true);
                };
                noButton.onclick = function() {
                    document.body.removeChild(modal);
                    resolve(false);
                };
            } else {
                console.error("[CHE] showCustomPrompt: 按鈕未找到");
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    }

    // IndexedDB 初始化
    const dbPromise = new Promise((resolve, reject) => {
        const openDB = indexedDB.open("ChatLogger", 1);
        openDB.onupgradeneeded = () => openDB.result.createObjectStore("fragments");
        openDB.onsuccess = () => resolve(openDB.result);
        openDB.onerror = () => {
            console.error("[CHE] IndexedDB 初始化失敗");
            window.ChatRoomSendLocalStyled("[CHE] ❌ IndexedDB 初始化失敗，自動儲存不可用", 5000, "#ff0000", null, null, "24px");
            reject("IndexedDB 初始化失敗");
        };
    });

    // 保存碎片到 IndexedDB
    async function saveFragment() {
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) {
            console.error("[CHE] saveFragment: 找不到 #TextAreaChatLog");
            return;
        }
        const messages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link")).map(msg => {
            try {
                return {
                    time: msg.dataset?.time || "",
                    id: msg.dataset?.sender || "",
                    content: extractFullTextContent(msg),
                    type: msg.classList.contains("ChatMessageWhisper") ? "whisper" : "normal",
                    color: getLabelColor(msg, msg.querySelector(".ChatMessageName"))
                };
            } catch (e) {
                console.error("[CHE] saveFragment: 訊息處理錯誤", e);
                return null;
            }
        }).filter(msg => msg !== null && !isFilteredMessage(msg.content, msg.type === "whisper"));
        if (messages.length === 0) {
            console.log("[CHE] saveFragment: 無有效訊息，跳過儲存");
            return;
        }
        try {
            const db = await dbPromise;
            const tx = db.transaction(["fragments"], "readwrite");
            const store = tx.objectStore("fragments");
            store.put(messages, `fragment_${fragmentCounter}`);
            fragmentCounter++;
            localStorage.setItem("fragment_count", fragmentCounter);
            messageCountSinceLastSave = 0;
            localStorage.setItem("message_count_since_last_save", "0");
            window.ChatRoomSendLocalStyled(`[CHE] 已儲存碎片 ${fragmentCounter}，包含 ${messages.length} 條訊息`, 3000, "#00ff00");
        } catch (e) {
            console.error("[CHE] 碎片儲存失敗:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 碎片儲存失敗，請手動匯出", 5000, "#ff0000", null, null, "24px");
        }
    }

    // 監控訊息數量並觸發碎片儲存
    function initMessageObserverDynamic() {
        const maxWaitTime = 10*60*1000; // 10分鐘
        const startTime = Date.now();
        const checkChatRoom = setInterval(() => {
            const chatLog = document.querySelector("#TextAreaChatLog");
            if (chatLog) {
                console.log("[CHE] 檢測到 #TextAreaChatLog，啟動訊息監控");
                clearInterval(checkChatRoom);
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
                        messageCountSinceLastSave += newMessages;
                        localStorage.setItem("message_count_since_last_save", messageCountSinceLastSave);
                        if (messageCountSinceLastSave >= MESSAGE_SAVE_THRESHOLD) {
                            console.log(`[CHE] 達到 ${MESSAGE_SAVE_THRESHOLD} 條訊息，觸發儲存`);
                            saveFragment();
                        }
                    }
                });
                observer.observe(chatLog, { childList: true });
            } else if (Date.now() - startTime > maxWaitTime) {
                console.error("[CHE] 等待聊天室載入超時，訊息監控不可用");
                window.ChatRoomSendLocalStyled("[CHE] ❌ 聊天室載入超時，訊息自動儲存不可用", 5000, "#ff0000", null, null, "24px");
                clearInterval(checkChatRoom);
            }
        }, 300); // 每 300ms 檢查
    }

    // 檢查訊息量並提示
    function checkMessageCount() {
        const count = document.querySelectorAll(".ChatMessage, a.beep-link").length;
        const prompted = localStorage.getItem("prompted_counts")?.split(",") || [];
        const now = Date.now();
        if (count >= 1000 && !prompted.includes("1000") && now - lastPromptTime >= 30 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("[CHE] 訊息量達 1000 條，記得手動匯出保存！", 3000, "#ffa500");
            prompted.push("1000");
            lastPromptTime = now;
        } else if (count >= 5000 && !prompted.includes("5000") && now - lastPromptTime >= 30 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("[CHE] 訊息量達 5000 條，記得手動匯出保存！", 3000, "#ffa500");
            prompted.push("5000");
            lastPromptTime = now;
        } else if (count >= 25000 && !prompted.includes("25000") && now - lastPromptTime >= 30 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("[CHE] 訊息量達 25000 條，可能因儲存限制缺失，建議手動匯出！", 3000, "#ff0000", null, null, "24px");
            prompted.push("25000");
            lastPromptTime = now;
        }
        localStorage.setItem("prompted_counts", prompted.join(","));
    }
    setInterval(checkMessageCount, 30 * 60 * 1000); // 每 30 分鐘檢查

    // 匯出 Excel
    async function exportExcel() {
        if (!window.XLSX?.utils) {
            window.ChatRoomSendLocalStyled("[CHE] ❌ Excel 匯出失敗：XLSX 庫未載入", 5000, "#ff0000", null, null, "24px");
            console.error("[CHE] XLSX 庫不可用");
            return;
        }
        const log = document.querySelector("#TextAreaChatLog");
        if (!log || log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length === 0) {
            window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器或無訊息可匯出", 5000, "#ff0000", null, null, "24px");
            return;
        }

        const totalMessages = log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length;

        showCustomPrompt("請問您是否保存包含悄悄話(wisper)與私信(beep)的信息?").then(async function(includePrivate) {
            window.ChatRoomSendLocalStyled("[CHE] 正在匯出 Excel，請稍候...", 3000, "#ffa500");
            const nodes = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
            const data = [["時間", "ID", "信息"]];
            const processedBeeps = new Set();

            for (const [index, node] of nodes.entries()) {
                try {
                    let time = node.dataset?.time || "";
                    let id = node.dataset?.sender || "";
                    let msg = "";
                    let fullText = extractFullTextContent(node);
                    fullText = fullText.replace(/\s*\n\s*/g, '\n').trim();
                    if (node.matches("a.beep-link")) {
                        if (!includePrivate) continue;
                        msg = fullText.trim();
                        if (processedBeeps.has(msg)) continue;
                        processedBeeps.add(msg);
                        data.push([time, id, msg]);
                    } else if (node.classList.contains("chat-room-sep-div")) {
                        const button = node.querySelector(".chat-room-sep-header");
                        if (button) {
                            const roomName = button.dataset.room || "";
                            const iconDiv = button.querySelector(".chat-room-sep-image");
                            const iconText = iconDiv ? iconDiv.querySelector("span")?.innerText || "" : "";
                            msg = `${iconText} - ${roomName}`.trim();
                            data.push([time, id, msg]);
                        }
                    } else if (node.classList.contains("ChatMessage")) {
                        const nameButton = node.querySelector(".ChatMessageName");
                        const contentNode = node.querySelector(".chat-room-message-content");
                        id = nameButton ? nameButton.textContent.trim() : id;
                        msg = contentNode ? extractFullTextContent(contentNode).trim() : fullText;
                        if (msg.startsWith(time)) msg = msg.slice(time.length).trim();
                        if (msg.startsWith(id)) msg = msg.slice(id.length).trim();
                        msg = msg.replace(/^\d{2}:\d{2}:\d{2}\s*/, "").replace(/^\d+\s*/, "").trim();
                        if (isFilteredMessage(msg, node.classList.contains("ChatMessageWhisper") && !includePrivate)) continue;
                        data.push([time, id, msg]);
                    } else {
                        msg = fullText.trim();
                        if (msg.startsWith(time)) msg = msg.slice(time.length).trim();
                        if (msg.startsWith(id)) msg = msg.slice(id.length).trim();
                        msg = msg.replace(/^\d{2}:\d{2}:\d{2}\s*/, "").replace(/^\d+\s*/, "").trim();
                        if (isFilteredMessage(msg, !includePrivate)) continue;
                        data.push([time, id, msg]);
                    }
                } catch (e) {
                    console.error(`[CHE] exportExcel: 節點 ${index} 處理錯誤`, e);
                }
            }

            if (data.length <= 1) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 沒有有效信息，請確認聊天室是否有內容或嘗試包含私信", 5000, "#ff0000", null, null, "24px");
                return;
            }

            // 驗證匯出數量
            const exportedCount = data.length - 1; // 減去標題行
            validateExportCount(totalMessages, exportedCount, "Excel");

            try {
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
                window.ChatRoomSendLocalStyled(`[CHE] Excel 匯出完成，${exportedCount} 條訊息`, 3000, "#00ff00");
            } catch (e) {
                console.error("[CHE] Excel 匯出失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ Excel 匯出失敗，請重試", 5000, "#ff0000", null, null, "24px");
            }
        }).catch(function(e) {
            console.error("[CHE] showCustomPrompt 錯誤:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ Excel 匯出取消", 5000, "#ff0000", null, null, "24px");
        });
    }

    // 匯出 HTML（改進顏色處理）
    async function exportChatAsHTML(NoLeave = true, includePrivate = false) {
        const processExport = async function(finalIncludePrivate) {
            if (NoLeave) {
                window.ChatRoomSendLocalStyled("[CHE] 正在匯出 HTML，請稍候...", 3000, "#ffa500");
            }
            const log = document.querySelector("#TextAreaChatLog");
            if (!log || log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器或無訊息可匯出", 5000, "#ff0000", null, null, "24px");
                return;
            }

            const totalMessages = log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length;
            let messages = [];
            const currentMessages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));

            if (!NoLeave && currentMessages.length > MESSAGE_SAVE_THRESHOLD) {
                try {
                    await saveFragment();
                    const db = await dbPromise;
                    const tx = db.transaction(["fragments"], "readonly");
                    const store = tx.objectStore("fragments");
                    const fragmentCount = parseInt(localStorage.getItem("fragment_count") || "0");
                    for (let i = 0; i < fragmentCount; i++) {
                        const request = store.get(`fragment_${i}`);
                        request.onsuccess = () => messages.push(...(request.result || []));
                    }
                    await new Promise(resolve => tx.oncomplete = resolve);
                    messages.push(...currentMessages);
                    messages.sort((a, b) => {
                        const timeA = a.time || (a.dataset && a.dataset.time) || "0";
                        const timeB = b.time || (b.dataset && b.dataset.time) || "0";
                        return new Date(timeA) - new Date(timeB);
                    });
                } catch (e) {
                    console.error("[CHE] 碎片讀取失敗:", e);
                    window.ChatRoomSendLocalStyled("[CHE] ❌ 碎片讀取失敗，改用當前 DOM 匯出", 5000, "#ff0000", null, null, "24px");
                    messages = currentMessages;
                }
            } else {
                messages = currentMessages;
            }

            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 沒有訊息可匯出", 5000, "#ff0000", null, null, "24px");
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

            // 改進的 HTML 樣式，包含更好的深淺模式支援
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
        #toggleContrast {
            position: fixed;
            top: 10px;
            right: 120px;
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            background: #666;
            color: #fff;
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

        /* 淺色模式 */
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
        body.light #toggleContrast {
            background: #999;
            color: #fff;
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
    <button id="toggleContrast">高對比</button>
    <div id="chatlog">
`;

            const processedBeeps = new Set();
            let collapseId = 0;
            let openCollapsible = false;
            let lastSeparatorText = "";
            let processedCount = 0;
            const isDarkTheme = !document.body.classList.contains('light');

            for (const msg of messages) {
                if (!NoLeave && msg.type) {
                    if (!finalIncludePrivate && msg.type === "whisper") continue;
                    if (isFilteredMessage(msg.content, msg.type === "whisper")) continue;

                    // 應用顏色對比度調整
                    const adjustedColor = getContrastColor(msg.color, isDarkTheme);
                    let content = "";
                    let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

                    if (msg.type === "whisper") {
                        const prefix = msg.content.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                        content = `${prefix} <span style="color:${adjustedColor}">${escapeHtml(msg.id)}</span>: ${escapeHtml(msg.content)}`;
                    } else if (msg.type === "beep") {
                        content = `<div class="beep">${escapeHtml(msg.content)}</div>`;
                    } else {
                        content = `<span style="color:${adjustedColor}">${escapeHtml(msg.id)}</span>: ${escapeHtml(msg.content)}`;
                    }
                    html += `
        <div ${rowStyleInline}>
            <div class="chat-meta">
                <span class="chat-time">${escapeHtml(msg.time)}</span>
                <span class="chat-id">${escapeHtml(msg.id)}</span>
            </div>
            <div class="chat-content">${content}</div>
        </div>`;
                    processedCount++;
                    continue;
                }

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
                    if (!finalIncludePrivate) continue;
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

                // 應用顏色對比度調整
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

                if (isFilteredMessage(rawText, msg.classList.contains("ChatMessageWhisper") && !finalIncludePrivate)) continue;
                if (lastSeparatorText && rawText.includes(lastSeparatorText)) continue;

                let content = "";
                let rowStyleInline = `class="chat-row with-accent" style="background:${toRGBA(adjustedColor, 0.12)}; border-left-color:${adjustedColor};"`;

                if (msg.classList.contains("ChatMessageChat")) {
                    content = `<span style="color:${adjustedColor}">${escapeHtml(senderName)}</span>: ${escapeHtml(rawText.trim())}`;
                } else if (msg.classList.contains("ChatMessageWhisper")) {
                    if (!finalIncludePrivate) continue;
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
        function toggleCollapse(id) {
            const element = document.getElementById('collapse-' + id);
            if (element) element.classList.toggle('collapsed');
        }

        document.getElementById("toggleTheme").onclick = function() {
            document.body.classList.toggle("light");
            this.textContent = document.body.classList.contains("light") ? "深色模式" : "淺色模式";
        };
    </script>
</body>
</html>
`;

            // 驗證匯出數量
            validateExportCount(totalMessages, processedCount, "HTML");

            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const blob = new Blob([html], { type: "text/html" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `chatlog_${timestamp}.html`;
                a.click();
                URL.revokeObjectURL(a.href);

                if (!NoLeave && currentMessages.length > MESSAGE_SAVE_THRESHOLD) {
                    try {
                        const db = await dbPromise;
                        const tx = db.transaction(["fragments"], "readwrite");
                        const store = tx.objectStore("fragments");
                        const fragmentCount = parseInt(localStorage.getItem("fragment_count") || "0");
                        for (let i = 0; i < fragmentCount; i++) {
                            store.delete(`fragment_${i}`);
                        }
                        localStorage.setItem("fragment_count", "0");
                        localStorage.setItem("message_count_since_last_save", "0");
                        messageCountSinceLastSave = 0;
                        await new Promise(resolve => tx.oncomplete = resolve);
                        window.ChatRoomSendLocalStyled("[CHE] 碎片已自動清理", 3000, "#00ff00");
                    } catch (e) {
                        console.error("[CHE] 碎片清理失敗:", e);
                        window.ChatRoomSendLocalStyled("[CHE] ❌ 碎片清理失敗，請手動清除瀏覽器資料", 5000, "#ff0000", null, null, "24px");
                    }
                }

                window.ChatRoomSendLocalStyled(`[CHE] HTML 匯出完成，${processedCount} 條訊息`, 3000, "#00ff00");
            } catch (e) {
                console.error("[CHE] HTML 匯出失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ HTML 匯出失敗，請重試", 5000, "#ff0000", null, null, "24px");
            }
        };

        if (NoLeave) {
            showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?").then(processExport).catch(function(e) {
                console.error("[CHE] showCustomPrompt 錯誤:", e);
                window.ChatRoomSendLocalStyled("[CHE] ❌ HTML 匯出取消", 5000, "#ff0000", null, null, "24px");
            });
        } else {
            const messages = document.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length;
            const estimatedTime = Math.ceil(messages / 2000);
            window.ChatRoomSendLocalStyled(`[CHE] 正在匯出 ${messages} 條訊息，建議等待 ${estimatedTime} 秒後按確定！`, estimatedTime * 1000, "#ff0000", null, null, "24px");
            await processExport(finalIncludePrivate);
            return `[CHE] 正在匯出 ${messages} 條訊息，建議等待 ${estimatedTime} 秒後按確定！`;
        }
    }

    // 清空
    async function clearHistory() {
        showCustomPrompt("是否清除聊天室訊息和 IndexedDB 碎片？（將保留當前房間資訊）").then(async function(confirmClear) {
            if (!confirmClear) return;

            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                window.ChatRoomSendLocalStyled("[CHE] ❌ 找不到聊天室容器", 5000, "#ff0000", null, null, "24px");
                return;
            }

            const nodes = Array.from(log.children);
            let lastRoomNode = null;
            for (let i = nodes.length - 1; i >= 0; i--) {
                if (nodes[i].classList.contains("chat-room-sep") || nodes[i].classList.contains("chat-room-sep-last")) {
                    lastRoomNode = nodes[i];
                    break;
                }
            }

            log.innerHTML = "";
            if (lastRoomNode) log.appendChild(lastRoomNode);

            try {
                const db = await dbPromise;
                const tx = db.transaction(["fragments"], "readwrite");
                const store = tx.objectStore("fragments");
                store.clear();
                localStorage.setItem("fragment_count", "0");
                localStorage.setItem("message_count_since_last_save", "0");
                fragmentCounter = 0;
                messageCountSinceLastSave = 0;
                await new Promise(resolve => tx.oncomplete = resolve);
                window.ChatRoomSendLocalStyled("[CHE] 聊天室訊息和碎片已清空！", 3000, "#00ff00");
            } catch (e) {
                console.error("[CHE] 碎片清理失敗:", e);
                window.ChatRoomSendLocalStyled("[CHE] 聊天室訊息已清空，但碎片清理失敗", 5000, "#ff0000", null, null, "24px");
            }
        }).catch(function(e) {
            console.error("[CHE] showCustomPrompt 錯誤:", e);
            window.ChatRoomSendLocalStyled("[CHE] ❌ 清空取消", 5000, "#ff0000", null, null, "24px");
        });
    }

    function addUI() {
        const existingContainer = document.querySelector("#chatlogger-container");
        if (existingContainer) {
            const toolbar = existingContainer.querySelector("#chatlogger-toolbar");
            if (toolbar) toolbar.style.display = "none"; // 確保預設收納
            return;
        }

        const container = document.createElement("div");
        container.id = "chatlogger-container";
        container.style.position = "fixed";
        container.style.bottom = "20px";
        container.style.left = "20px";
        container.style.zIndex = "1000";

        const toggleButton = document.createElement("button");
        toggleButton.innerText = "💾";
        toggleButton.style.width = "40px";
        toggleButton.style.height = "40px";
        toggleButton.style.cursor = "pointer";
        toggleButton.style.borderRadius = "50%";
        toggleButton.style.background = "#333";
        toggleButton.style.color = "#fff";
        toggleButton.style.border = "none";
        toggleButton.style.opacity = "0.7";
        toggleButton.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
        toggleButton.style.transition = "opacity 0.2s, transform 0.2s, background 0.2s";
        toggleButton.style.userSelect = "none";
        toggleButton.style.webkitUserSelect = "none";
        toggleButton.title = "聊天室紀錄保存器";
        toggleButton.onmouseover = function() {
            toggleButton.style.opacity = "1";
            toggleButton.style.background = "#AC66E4";
            toggleButton.style.transform = "scale(1.1)";
        };
        toggleButton.onmouseout = function() {
            toggleButton.style.opacity = "0.7";
            toggleButton.style.background = "#333";
            toggleButton.style.transform = "scale(1)";
        };

        const toolbar = document.createElement("div");
        toolbar.id = "chatlogger-toolbar";
        toolbar.style.display = "none";
        toolbar.style.position = "absolute";
        toolbar.style.bottom = "50px";
        toolbar.style.left = "50px";
        toolbar.style.background = "#333";
        toolbar.style.padding = "8px";
        toolbar.style.borderRadius = "6px";
        toolbar.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
        toolbar.style.display = "flex";
        toolbar.style.flexDirection = "column";
        toolbar.style.gap = "6px";

        const smallBtn = function(label, handler) {
            const b = document.createElement("button");
            b.innerText = label;
            b.style.padding = "4px 8px";
            b.style.fontSize = "12px";
            b.style.minWidth = "100px";
            b.style.textAlign = "left";
            b.style.background = "#555";
            b.style.color = "#fff";
            b.style.border = "none";
            b.style.borderRadius = "4px";
            b.style.cursor = "pointer";
            b.style.userSelect = "none";
            b.style.webkitUserSelect = "none";
            b.onmouseover = function() { b.style.background = "#E37736"; };
            b.onmouseout = function() { b.style.background = "#555"; };
            b.onclick = function() {
                if (!document.querySelector("#TextAreaChatLog")) {
                    window.ChatRoomSendLocalStyled("❌ 聊天室尚未載入，請進入聊天室後再試", 5000, "#ff0000", null, null, "24px");
                    return;
                }
                handler();
            };
            return b;
        };

        const btnHTML = smallBtn("📥 HTML", exportChatAsHTML);
        const btnExport = smallBtn("📥 EXCEL", exportExcel);
        const btnClear = smallBtn("🗑️ 清空", clearHistory);
        const btnMode = smallBtn("⏸️ 停用", function() { toggleMode(btnMode); });

        toolbar.appendChild(btnHTML);
        toolbar.appendChild(btnExport);
        toolbar.appendChild(btnClear);
        //toolbar.appendChild(btnMode); 因無用先停用

        container.appendChild(toggleButton);
        container.appendChild(toolbar);

        toggleButton.onclick = function() {
            toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
        };

        document.body.appendChild(container);
        console.log("[CHE] 浮動工具列已加入");
        toggleButton.click();//初始收納狀態

        currentMode = validModes.includes(currentMode) ? currentMode : "stopped";
        if (currentMode === "onleave_include_private") {
            btnMode.innerText = "⚡ 退出✅私信";
            window.ChatRoomSendLocalStyled("[CHE] 退出時保存（含私信）。", 5000, "#ff69b4");
            window.onbeforeunload = function() { return exportChatAsHTML(false, true); };
        } else if (currentMode === "onleave_exclude_private") {
            btnMode.innerText = "⚡ 退出🚫私信";
            window.ChatRoomSendLocalStyled("[CHE] 退出時不保存私信。", 5000, "#ff69b4");
            window.onbeforeunload = function() { return exportChatAsHTML(false, false); };
        } else {
            currentMode = "stopped";
            btnMode.innerText = "⏸️ 停用";
            window.ChatRoomSendLocalStyled("[CHE] 退出時不保存任何內容。請記得手動匯出！", 5000, "#ff69b4");
            window.onbeforeunload = null;
        }
        console.log(`[CHE] 初始化模式為 ${currentMode}`);
    }

    // 模式切換
    function toggleMode(btn) {
        if (!validModes.includes(currentMode)) currentMode = "stopped";

        if (currentMode === "stopped") {
            currentMode = "onleave_include_private";
            btn.innerText = "⚡ 退出✅私信";
            window.ChatRoomSendLocalStyled("[CHE] 退出時自動匯出 HTML（包含悄悄話和私信）。", 5000, "#ff69b4");
            window.onbeforeunload = function() {
                return exportChatAsHTML(false, true);
            };
        } else if (currentMode === "onleave_include_private") {
            currentMode = "onleave_exclude_private";
            btn.innerText = "⚡ 退出🚫私信";
            window.ChatRoomSendLocalStyled("[CHE] 退出時自動匯出 HTML（不包含悄悄話和私信）。", 5000, "#ff69b4");
            window.onbeforeunload = function() {
                return exportChatAsHTML(false, false);
            };
        } else {
            currentMode = "stopped";
            btn.innerText = "⏸️ 停用";
            window.ChatRoomSendLocalStyled("[CHE] 停用，退出時不保存任何內容。請記得手動匯出！", 5000, "#ff69b4");
            window.onbeforeunload = null;
        }
        localStorage.setItem("chatlogger_mode", currentMode);
        console.log(`[CHE] 切換模式為 ${currentMode}`);
    }

    async function waitForSdkAndInit() {
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 1000;

        async function tryInitialize() {
            try {
                await loadToastSystem();
                if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                    modApi = bcModSdk.registerMod({
                        name: "Liko's CHE",
                        fullName: "Chat room history export to html/excel",
                        version: modversion,
                        repository: "聊天室紀錄匯出 \n Chat room history export to html/excel",
                    });
                    console.log("[CHE] ChatLogger 已註冊到 /versions");
                    return true;
                } else {
                    throw new Error("bcModSdk 未載入");
                }
            } catch (e) {
                console.error("[CHE] 初始化錯誤:", e);
                if (retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[CHE] 第 ${retryCount} 次重試初始化，等待 ${retryInterval}ms`);
                    window.ChatRoomSendLocalStyled(`[CHE] ❌ 插件初始化失敗，第 ${retryCount}/${maxRetries} 次重試...`, 3000, "#ffa500");
                    await new Promise(resolve => setTimeout(resolve, retryInterval));
                    return false;
                } else {
                    console.error("[CHE] 初始化失敗，達到最大重試次數");
                    window.ChatRoomSendLocalStyled("[CHE] ❌ 插件初始化失敗，請檢查網絡或重新整理頁面", 5000, "#ff0000", null, null, "24px");
                    return true; // 停止後續檢查
                }
            }
        }

        // 嘗試初始化
        while (!(await tryInitialize()) && retryCount < maxRetries) {}

        // 若初始化成功，開始檢查玩家資料
        const maxWaitTime = 600000; // 10 分鐘超時
        const startTime = Date.now();
        const checkLogin = setInterval(() => {
            if (window.Player?.Name && window.Player?.MemberNumber) {
                console.log("[CHE] 檢測到 window.Player.Name 和 MemberNumber，顯示 UI");
                clearInterval(checkLogin);
                addUI();
                if (currentMode !== "stopped") {
                    // 延遲 1 秒啟動訊息監控，等待聊天室 DOM 載入
                    setTimeout(() => {
                        initMessageObserverDynamic();
                    }, 1000);
                }
            } else if (Date.now() - startTime > maxWaitTime) {
                console.error("[CHE] 等待玩家初始化超時（10 分鐘）");
                window.ChatRoomSendLocalStyled("[CHE] ❌ 玩家初始化超時，UI 和訊息監控不可用", 5000, "#ff0000", null, null, "24px");
                clearInterval(checkLogin);
            }
        }, 1000); // 每 1000ms 檢查
    }

    waitForSdkAndInit();
})();
