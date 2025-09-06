// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      1.2
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

    // ⚡ 插件初始化
    let modApi;
    const modversion = "1.2";
    async function initPlugin() {
        try {
            await loadToastSystem(); // 載入 BC_toast_system.user.js
            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE",
                    fullName: "Chat room history export to html/excel",
                    version: modversion,
                    repository: "聊天室紀錄匯出 \n Chat room history export to html/excel",
                });

                console.log("✅ ChatLogger 已註冊到 /versions");
                setTimeout(function() {
                    addUI();
                    initMessageObserver();
                }, 2000);
            } else {
                console.error("❌ ChatLogger 無法找到 bcModSdk");
                window.ChatRoomSendLocalStyled("❌ 插件初始化失敗：無法找到 bcModSdk", 5000, "#ff0000", null, null, "24px");
            }
        } catch (e) {
            console.error("❌ ChatLogger 初始化錯誤:", e);
            window.ChatRoomSendLocalStyled("❌ 插件初始化失敗，請檢查網絡或腳本", 5000, "#ff0000", null, null, "24px");
        }
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
            window.ChatRoomSendLocalStyled("❌ Excel 匯出失敗：XLSX 庫載入錯誤", 5000, "#ff0000", null, null, "24px");
        };
        document.head.appendChild(script);
    } else {
        console.log("[CHE] xlsx.full.min.js 已存在，跳過載入");
    }

    let fragmentCounter = 0;
    let lastPromptTime = 0;
    let messageCountSinceLastSave = parseInt(localStorage.getItem("message_count_since_last_save") || "0");
    const MESSAGE_SAVE_THRESHOLD = 300; // 每 300 條訊息儲存一次碎片
    let currentMode = "stopped"; // stopped, onleave_include_private, onleave_exclude_private

    // 🔧 HTML 轉義函數
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // 🔧 提取完整文本內容
    function extractFullTextContent(element) {
        if (!element) return "";
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
        const imgLinks = clone.querySelectorAll('a.bce-img-link');
        imgLinks.forEach(function(imgLink) {
            const href = imgLink.getAttribute('href');
            const img = imgLink.querySelector('img');
            if (img && href) {
                imgLink.textContent = '[图片: ' + href + ']';
            }
        });
        let text = clone.textContent || clone.innerText || "";
        text = text.replace(/\s*\n\s*/g, '\n').trim();
        return text;
    }

    // 🔧 獲取標籤顏色
    function getLabelColor(msg, nameButton) {
        if (!msg) return "#000";
        let c =
            msg.style?.getPropertyValue("--label-color") ||
            getComputedStyle(msg).getPropertyValue("--label-color") ||
            (nameButton && (nameButton.style?.getPropertyValue("--label-color") || getComputedStyle(nameButton).getPropertyValue("--label-color"))) ||
            "";
        c = (c || "").trim();
        if (c) return c;
        const colorSpan = msg.querySelector('[style*="color"]');
        if (colorSpan && colorSpan.style && colorSpan.style.color) return colorSpan.style.color;
        const fontEl = msg.querySelector("font[color]");
        if (fontEl && fontEl.color) return fontEl.color;
        return "#000";
    }

    // 💾 自訂提示視窗
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

    // 📡 IndexedDB 初始化
    const dbPromise = new Promise((resolve, reject) => {
        const openDB = indexedDB.open("ChatLogger", 1);
        openDB.onupgradeneeded = () => openDB.result.createObjectStore("fragments");
        openDB.onsuccess = () => resolve(openDB.result);
        openDB.onerror = () => {
            console.error("[CHE] IndexedDB 初始化失敗");
            window.ChatRoomSendLocalStyled("❌ IndexedDB 初始化失敗，自動匯出可能受限", 5000, "#ff0000", null, null, "24px");
            reject("IndexedDB 初始化失敗");
        };
    });

    // 📡 保存碎片到 IndexedDB
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
        }).filter(msg => msg !== null);
        if (messages.length === 0) {
            console.log("[CHE] saveFragment: 無新訊息，跳過儲存");
            return;
        }
        try {
            const db = await dbPromise;
            const tx = db.transaction(["fragments"], "readwrite");
            const store = tx.objectStore("fragments");
            store.put(messages, `fragment_${fragmentCounter}`);
            fragmentCounter++;
            messageCountSinceLastSave = 0;
            localStorage.setItem("fragment_count", fragmentCounter);
            localStorage.setItem("message_count_since_last_save", "0");
            window.ChatRoomSendLocalStyled(`已儲存碎片 ${fragmentCounter}，包含 ${messages.length} 條訊息`, 3000, "#00ff00");
            console.log(`[CHE] saveFragment: 已儲存碎片 ${fragmentCounter}，包含 ${messages.length} 條訊息`);
        } catch (e) {
            console.error("[CHE] 碎片儲存失敗:", e);
            window.ChatRoomSendLocalStyled("❌ 碎片儲存失敗，請手動匯出", 5000, "#ff0000", null, null, "24px");
        }
    }

    // 📡 監控訊息數量並觸發碎片儲存
    function initMessageObserver() {
        const log = document.querySelector("#TextAreaChatLog");
        if (!log) {
            console.error("[CHE] initMessageObserver: 找不到 #TextAreaChatLog，延遲重試");
            setTimeout(initMessageObserver, 1000);
            return;
        }

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
                console.log(`[CHE] initMessageObserver: 新增 ${newMessages} 條訊息，累計 ${messageCountSinceLastSave}/${MESSAGE_SAVE_THRESHOLD}`);
                if (messageCountSinceLastSave >= MESSAGE_SAVE_THRESHOLD) {
                    console.log(`[CHE] initMessageObserver: 達到 ${MESSAGE_SAVE_THRESHOLD} 條訊息，觸發儲存`);
                    saveFragment();
                }
            }
        });

        observer.observe(log, { childList: true });
        console.log("[CHE] initMessageObserver: 已啟動 MutationObserver 監控 #TextAreaChatLog");
    }

    // 📡 檢查訊息量並提示
    function checkMessageCount() {
        const count = document.querySelectorAll(".ChatMessage, a.beep-link").length;
        const prompted = localStorage.getItem("prompted_counts")?.split(",") || [];
        const now = Date.now();
        if (count >= 1000 && !prompted.includes("1000") && now - lastPromptTime >= 10 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("訊息量達 1000 條，建議手動匯出保存！", 5000, "#ffa500");
            prompted.push("1000");
            lastPromptTime = now;
        } else if (count >= 5000 && !prompted.includes("5000") && now - lastPromptTime >= 10 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("訊息量達 5000 條，建議手動匯出保存！", 5000, "#ffa500");
            prompted.push("5000");
            lastPromptTime = now;
        } else if (count >= 25000 && !prompted.includes("25000") && now - lastPromptTime >= 10 * 60 * 1000) {
            window.ChatRoomSendLocalStyled("訊息量達 25000 條，可能因儲存限制缺失，強烈建議立即手動匯出！", 5000, "#ff0000", null, null, "24px");
            prompted.push("25000");
            lastPromptTime = now;
        }
        localStorage.setItem("prompted_counts", prompted.join(","));
    }
    setInterval(checkMessageCount, 10 * 60 * 1000);

    // 💾 匯出 Excel
    function exportExcel() {
        if (!window.XLSX?.utils) {
            window.ChatRoomSendLocalStyled("❌ Excel 匯出失敗：XLSX 庫未載入", 5000, "#ff0000", null, null, "24px");
            console.error("[CHE] XLSX 庫不可用");
            return;
        }
        showCustomPrompt("請問您是否保存包含\n悄悄話(wisper)與私信(beep)的信息?").then(function(includePrivate) {
            window.ChatRoomSendLocalStyled("正在匯出 Excel，請稍候...", 3000, "#ffa500");
            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                window.ChatRoomSendLocalStyled("❌ 找不到聊天室容器，請確認已進入聊天室", 5000, "#ff0000", null, null, "24px");
                console.error("[CHE] exportExcel: 找不到 #TextAreaChatLog");
                return;
            }

            const nodes = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .ChatMessageLocalMessage, .ChatMessageNonDialogue, .ChatMessageAction, .ChatMessageActivity, .ChatMessageEmote, .ChatMessageEnterLeave, .chat-room-sep-div"));
            console.log(`[CHE] exportExcel: 找到 ${nodes.length} 個節點`);
            const data = [["時間", "ID", "信息"]];
            const processedBeeps = new Set();

            nodes.forEach(function(node, index) {
                try {
                    let time = node.dataset?.time || "";
                    let id = node.dataset?.sender || "";
                    let msg = "";
                    let fullText = extractFullTextContent(node);
                    console.log(`[CHE] exportExcel: 節點 ${index}, 原始內容: ${fullText}, time: ${time}, id: ${id}`);

                    fullText = fullText.replace(/\s*\n\s*/g, '\n').trim();
                    const parts = fullText.split("\n").map(x => x.trim()).filter(Boolean);
                    console.log(`[CHE] exportExcel: 節點 ${index}, 分割後 parts:`, parts);

                    if (node.matches && node.matches("a.beep-link")) {
                        if (!includePrivate) return;
                        msg = fullText.trim();
                        if (processedBeeps.has(msg)) return;
                        processedBeeps.add(msg);
                        console.log(`[CHE] exportExcel: 添加 BEEP 信息: ${msg}`);
                        data.push([time, id, msg]);
                    } else if (node.classList.contains("chat-room-sep-div")) {
                        const button = node.querySelector(".chat-room-sep-header");
                        if (button) {
                            const roomName = button.dataset.room || "";
                            const iconDiv = button.querySelector(".chat-room-sep-image");
                            const iconText = iconDiv ? iconDiv.querySelector("span")?.innerText || "" : "";
                            msg = `${iconText} - ${roomName}`.trim();
                            console.log(`[CHE] exportExcel: 添加房間分隔信息: ${time}, ${id}, ${msg}`);
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
                        if (msg.includes("BCX commands tutorial") || msg.includes("BCX also provides") || msg.includes("(输入 /help 查看命令列表)")) return;
                        if (!includePrivate && (msg.includes("悄悄話") || msg.includes("好友私聊") || msg.includes("BEEP"))) return;
                        console.log(`[CHE] exportExcel: 添加標準信息: ${time}, ${id}, ${msg}`);
                        data.push([time, id, msg]);
                    } else {
                        msg = fullText.trim();
                        if (msg.startsWith(time)) msg = msg.slice(time.length).trim();
                        if (msg.startsWith(id)) msg = msg.slice(id.length).trim();
                        msg = msg.replace(/^\d{2}:\d{2}:\d{2}\s*/, "").replace(/^\d+\s*/, "").trim();
                        if (msg.includes("BCX commands tutorial") || msg.includes("BCX also provides") || msg.includes("(输入 /help 查看命令列表)")) return;
                        if (!includePrivate && (msg.includes("悄悄話") || msg.includes("好友私聊") || msg.includes("BEEP"))) return;
                        console.log(`[CHE] exportExcel: 添加其他信息: ${time}, ${id}, ${msg}`);
                        data.push([time, id, msg]);
                    }
                } catch (e) {
                    console.error(`[CHE] exportExcel: 節點 ${index} 處理錯誤`, e);
                }
            });

            console.log(`[CHE] exportExcel: 最終 data 長度: ${data.length}, 內容:`, data);
            if (data.length <= 1) {
                window.ChatRoomSendLocalStyled("❌ 沒有有效信息，請確認聊天室是否有內容或嘗試包含私信", 5000, "#ff0000", null, null, "24px");
                console.error("[CHE] exportExcel: 無有效信息");
                return;
            }

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
                console.log(`✅ [ChatLogger] 匯出 ${data.length - 1} 條信息 (Excel)`);
                window.ChatRoomSendLocalStyled("Excel 匯出完成！", 3000, "#00ff00");
            } catch (e) {
                console.error("[CHE] Excel 匯出失敗:", e);
                window.ChatRoomSendLocalStyled("❌ Excel 匯出失敗，請重試", 5000, "#ff0000", null, null, "24px");
            }
        }).catch(function(e) {
            console.error("[CHE] showCustomPrompt 錯誤:", e);
            window.ChatRoomSendLocalStyled("❌ Excel 匯出取消", 5000, "#ff0000", null, null, "24px");
        });
    }

    // 💾 匯出 HTML
    async function exportChatAsHTML(NoLeave, includePrivate) {
        if (NoLeave === undefined) NoLeave = true;
        if (includePrivate === undefined) includePrivate = false;

        const processExport = async function(finalIncludePrivate) {
            if (NoLeave) {
                window.ChatRoomSendLocalStyled("正在匯出 HTML，請稍候...", 3000, "#ffa500");
            }
            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                window.ChatRoomSendLocalStyled("❌ 找不到聊天室容器", 5000, "#ff0000", null, null, "24px");
                console.error("[CHE] exportChatAsHTML: 找不到 #TextAreaChatLog");
                return;
            }

            let messages = [];
            const currentMessages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
            console.log(`[CHE] exportChatAsHTML: 當前 DOM 訊息數: ${currentMessages.length}`);

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
                    console.log(`[CHE] exportChatAsHTML: 使用 IndexedDB 碎片，總訊息數: ${messages.length}`);
                } catch (e) {
                    console.error("[CHE] 碎片讀取失敗:", e);
                    window.ChatRoomSendLocalStyled("❌ 碎片讀取失敗，改用當前 DOM 匯出", 5000, "#ff0000", null, null, "24px");
                    messages = currentMessages;
                }
            } else {
                messages = currentMessages;
                console.log(`[CHE] exportChatAsHTML: 直接從 DOM 匯出，訊息數: ${messages.length}`);
            }

            if (messages.length === 0) {
                window.ChatRoomSendLocalStyled("❌ 沒有訊息可匯出", 5000, "#ff0000", null, null, "24px");
                console.error("[CHE] exportChatAsHTML: 無有效訊息");
                return;
            }

            function toRGBA(color, alpha) {
                if (alpha === undefined) alpha = 0.12;
                if (!color) return `rgba(0,0,0,${alpha})`;
                color = color.trim();
                let m = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
                if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
                if (color[0] === "#") {
                    let h = color.slice(1);
                    if (h.length === 3) h = h.split("").map(function(c) { return c + c; }).join("");
                    if (h.length >= 6) {
                        const r = parseInt(h.slice(0, 2), 16);
                        const g = parseInt(h.slice(2, 4), 16);
                        const b = parseInt(h.slice(4, 6), 16);
                        if ([r, g, b].every(function(v) { return !isNaN(v); })) return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                    }
                }
                return `rgba(0,0,0,${alpha})`;
            }

            function isPrivateMessage(text) {
                return text.includes("悄悄話") || text.includes("好友私聊") || text.includes("BEEP");
            }

            let html = `
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: sans-serif; background: #111; color: #eee; }
        .chat-row { display: flex; align-items: flex-start; margin: 2px 0; padding: 2px 6px; border-radius: 6px; }
        .chat-meta { display: flex; flex-direction: column; align-items: flex-end; width: 70px; font-size: 0.8em; margin-right: 8px; }
        .chat-time { color: #aaa; }
        .chat-id { font-weight: bold; }
        .chat-content { flex: 1; white-space: pre-wrap; }
        .system { font-style: italic; }
        .beep { color: #d00; font-weight: bold; }
        .with-accent { border-left: 4px solid transparent; }
        .separator-row {
            background: ${toRGBA('#8100E7', 0.2)};
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
        }
        body.light { background: #fff; color: #000; }
        body.light .chat-time { color: gray; }
        body.light #toggleTheme { background: #000; color: #fff; }
    </style>
</head>
<body>
    <button id="toggleTheme">淺色模式</button>
    <div id="chatlog">
`;

            const processedBeeps = new Set();
            let collapseId = 0;
            let openCollapsible = false;
            let lastSeparatorText = "";

            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];

                if (!NoLeave && msg.type) {
                    if (!finalIncludePrivate && msg.type === "whisper") continue;
                    if (processedBeeps.has(msg.content)) continue;
                    if (msg.content.includes("BCX commands tutorial") || msg.content.includes("BCX also provides") || msg.content.includes("(输入 /help 查看命令列表)")) continue;

                    let content = "";
                    let rowStyleInline = "";
                    const accent = (c) => `background:${toRGBA(c, 0.12)}; border-left-color:${c};`;

                    if (msg.type === "whisper") {
                        const prefix = msg.content.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                        content = `${prefix} <span style="color:${msg.color}">${escapeHtml(msg.id)}</span>: ${escapeHtml(msg.content)}`;
                        rowStyleInline = `class="chat-row with-accent" style="${accent(msg.color)}"`;
                    } else if (msg.type === "beep") {
                        content = `<div class="beep">${escapeHtml(msg.content)}</div>`;
                        rowStyleInline = `class="chat-row with-accent" style="${accent('#d00')}"`;
                    } else {
                        content = `<span style="color:${msg.color}">${escapeHtml(msg.id)}</span>: ${escapeHtml(msg.content)}`;
                        rowStyleInline = `class="chat-row with-accent" style="${accent(msg.color)}"`;
                    }

                    html += `
        <div ${rowStyleInline}>
            <div class="chat-meta">
                <span class="chat-time">${escapeHtml(msg.time)}</span>
                <span class="chat-id">${escapeHtml(msg.id)}</span>
            </div>
            <div class="chat-content">${content}</div>
        </div>`;
                    continue;
                }

                if (msg.classList.contains("chat-room-sep-div")) {
                    const button = msg.querySelector(".chat-room-sep-header");
                    if (button) {
                        const roomName = button.dataset.room || "";
                        const iconDiv = button.querySelector(".chat-room-sep-image");
                        const iconText = iconDiv ? iconDiv.querySelector("span")?.innerText || "" : "";
                        const collapseBtn = msg.querySelector(".chat-room-sep-collapse");
                        const isExpanded = collapseBtn && collapseBtn.getAttribute("aria-expanded") === "true";
                        const separatorText = `${isExpanded ? "▼" : ">"} ${iconText} - ${roomName}`.trim();

                        if (openCollapsible) {
                            html += `</div>`;
                            openCollapsible = false;
                        }

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
                        continue;
                    }
                }

                if (msg.matches && msg.matches("a.beep-link")) {
                    if (!finalIncludePrivate) continue;
                    const beepContent = escapeHtml(extractFullTextContent(msg).trim());
                    if (processedBeeps.has(beepContent)) continue;
                    processedBeeps.add(beepContent);

                    html += `
        <div class="chat-row with-accent" style="background: ${toRGBA('#d00', 0.12)}; border-left-color: #d00;">
            <div class="chat-meta"></div>
            <div class="chat-content beep">${beepContent}</div>
        </div>`;
                    continue;
                }

                if (!msg.dataset) continue;

                const time = msg.dataset.time || "";
                const senderId = msg.dataset.sender || "";
                const nameButton = msg.querySelector(".ChatMessageName");
                const senderName = nameButton ? nameButton.innerText : "";
                let labelColor = getLabelColor(msg, nameButton);

                let rawText = "";
                const textNode = msg.querySelector(".chat-room-message-content");

                if (textNode) {
                    rawText = extractFullTextContent(textNode);
                } else {
                    const clonedMsg = msg.cloneNode(true);
                    const metadataElements = clonedMsg.querySelectorAll('.chat-room-metadata');
                    metadataElements.forEach(function(meta) { meta.remove(); });
                    const popup = clonedMsg.querySelector('.chat-room-message-popup');
                    if (popup) popup.remove();
                    const nameBtn = clonedMsg.querySelector('.ChatMessageName');
                    if (nameBtn) nameBtn.remove();
                    rawText = extractFullTextContent(clonedMsg).trim();
                }

                if (rawText && (
                    rawText.includes("BCX commands tutorial") ||
                    rawText.includes("BCX also provides") ||
                    rawText.includes("(输入 /help 查看命令列表)")
                )) {
                    continue;
                }

                const stripUi = function(s) { return s.replace(/\bReply\b/g, "").trim(); };
                const stripHdr = function(s) { return s.replace(/^\d{2}:\d{2}:\d{2}\s*\n\d+\s*\n/, ""); };

                if (lastSeparatorText && rawText.includes(lastSeparatorText)) {
                    continue;
                }

                if (!finalIncludePrivate && isPrivateMessage(rawText)) {
                    continue;
                }

                if (processedBeeps.has(rawText.trim())) {
                    continue;
                }

                let content = "";
                let rowStyleInline = "";
                const accent = function(c) { return `background:${toRGBA(c, 0.12)}; border-left-color:${c};`; };

                if (msg.classList.contains("ChatMessageChat")) {
                    const textContent = escapeHtml(rawText.trim());
                    content = `<span style="color:${labelColor}">${escapeHtml(senderName)}</span>: ${textContent}`;
                    rowStyleInline = `class="chat-row with-accent" style="${accent(labelColor)}"`;
                } else if (msg.classList.contains("ChatMessageWhisper")) {
                    if (!finalIncludePrivate) continue;
                    const textContent = escapeHtml(rawText.trim());
                    const prefix = rawText.includes("悄悄话来自") ? "悄悄话来自" : "悄悄话";
                    content = `${prefix} <span style="color:${labelColor}">${escapeHtml(senderName)}</span>: ${textContent}`;
                    rowStyleInline = `class="chat-row with-accent" style="${accent(labelColor)}"`;
                } else if (
                    msg.classList.contains("ChatMessageAction") ||
                    msg.classList.contains("ChatMessageActivity") ||
                    msg.classList.contains("ChatMessageEmote") ||
                    msg.classList.contains("ChatMessageEnterLeave")
                ) {
                    let cleanContent = escapeHtml(stripUi(stripHdr(rawText)));
                    content = `<span style="color:${labelColor}">${cleanContent}</span>`;
                    rowStyleInline = `class="chat-row with-accent" style="${accent(labelColor)}"`;
                } else if (msg.classList.contains("ChatMessageLocalMessage")) {
                    let sysHtml = "";
                    const styledP = msg.querySelector("p[style]");
                    if (styledP) {
                        sysHtml = `<div style="${styledP.getAttribute("style")}">${escapeHtml(extractFullTextContent(styledP))}</div>`;
                    } else {
                        const fontEl = msg.querySelector("font");
                        if (fontEl && fontEl.color) {
                            sysHtml = `<span style="color:${fontEl.color}">${escapeHtml(extractFullTextContent(fontEl))}</span>`;
                        } else {
                            sysHtml = escapeHtml(stripUi(stripHdr(rawText)));
                        }
                    }
                    content = sysHtml;
                    rowStyleInline = `class="chat-row with-accent" style="${accent('#3aa76d')}"`;
                } else if (msg.classList.contains("ChatMessageNonDialogue")) {
                    const cleanContent = escapeHtml(stripUi(stripHdr(rawText)));
                    content = cleanContent;
                    rowStyleInline = `class="chat-row with-accent" style="${accent('#3aa76d')}"`;
                } else {
                    content = escapeHtml(stripUi(rawText));
                }

                if (!rowStyleInline) rowStyleInline = `class="chat-row"`;

                html += `
        <div ${rowStyleInline}>
            <div class="chat-meta">
                <span class="chat-time">${escapeHtml(time)}</span>
                <span class="chat-id">${escapeHtml(senderId)}</span>
            </div>
            <div class="chat-content">${content}</div>
        </div>`;
            }

            if (openCollapsible) {
                html += `</div>`;
            }

            html += `
    </div>
    <script>
        function toggleCollapse(id) {
            const element = document.getElementById('collapse-' + id);
            if (element) {
                element.classList.toggle('collapsed');
            }
        }

        const btn = document.getElementById("toggleTheme");
        btn.onclick = function() {
            document.body.classList.toggle("light");
            btn.textContent = document.body.classList.contains("light")
                ? "深色模式"
                : "淺色模式";
        };
    </script>
</body>
</html>
`;

            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const filename = `chatlog_${timestamp}.html`;
                const blob = new Blob([html], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);

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
                        window.ChatRoomSendLocalStyled("碎片已自動清理", 3000, "#00ff00");
                    } catch (e) {
                        console.error("[CHE] 碎片清理失敗:", e);
                        window.ChatRoomSendLocalStyled("❌ 碎片清理失敗，請手動清除瀏覽器資料", 5000, "#ff0000", null, null, "24px");
                    }
                }

                console.log(`✅ [ChatLogger] 匯出 HTML 完成: ${filename}, 訊息數: ${messages.length}`);
                window.ChatRoomSendLocalStyled("HTML 匯出完成！", 3000, "#00ff00");
                localStorage.removeItem("prompted_counts");
            } catch (e) {
                console.error("[CHE] HTML 匯出失敗:", e);
                window.ChatRoomSendLocalStyled("❌ HTML 匯出失敗，請重試", 5000, "#ff0000", null, null, "24px");
            }
        };

        if (NoLeave) {
            showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?").then(processExport).catch(function(e) {
                console.error("[CHE] showCustomPrompt 錯誤:", e);
                window.ChatRoomSendLocalStyled("❌ HTML 匯出取消", 5000, "#ff0000", null, null, "24px");
            });
        } else {
            const messages = document.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div").length;
            const estimatedTime = Math.ceil(messages / 2000);
            window.ChatRoomSendLocalStyled(`正在匯出 ${messages} 條訊息，建議等待 ${estimatedTime} 秒後按確定！`, estimatedTime * 1000, "#ff0000", null, null, "24px");
            await processExport(finalIncludePrivate);
            return `正在匯出 ${messages} 條訊息，建議等待 ${estimatedTime} 秒後按確定！`;
        }
    }

    // 🗑️ 清空
    function clearHistory() {
        showCustomPrompt("是否清除聊天室訊息？（將保留當前房間資訊）").then(function(confirmClear) {
            if (!confirmClear) return;

            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                window.ChatRoomSendLocalStyled("❌ 找不到聊天室容器", 5000, "#ff0000", null, null, "24px");
                console.error("[CHE] clearHistory: 找不到 #TextAreaChatLog");
                return;
            }

            const nodes = Array.from(log.children);
            let lastRoomNode = null;

            for (let i = nodes.length - 1; i >= 0; i--) {
                const node = nodes[i];
                if (node.classList.contains("chat-room-sep") || node.classList.contains("chat-room-sep-last")) {
                    lastRoomNode = node;
                    break;
                }
            }

            log.innerHTML = "";
            if (lastRoomNode) {
                log.appendChild(lastRoomNode);
            }

            console.log("🗑️ [ChatLogger] 已清空聊天室 DOM，保留房間資訊");
            window.ChatRoomSendLocalStyled("聊天室訊息已清空！", 3000, "#00ff00");
            localStorage.setItem("message_count_since_last_save", "0");
            messageCountSinceLastSave = 0;
        }).catch(function(e) {
            console.error("[CHE] showCustomPrompt 錯誤:", e);
            window.ChatRoomSendLocalStyled("❌ 清空取消", 5000, "#ff0000", null, null, "24px");
        });
    }

    // 🔄 模式切換
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "onleave_include_private";
            btn.innerText = "⚡ 退出✅私信";
            window.ChatRoomSendLocalStyled("模式：退出時保存（含私信）。請設定下載資料夾為 BC_TEMP！", 5000, "#ff69b4");
            window.onbeforeunload = function(event) {
                return exportChatAsHTML(false, true);
            };
        } else if (currentMode === "onleave_include_private") {
            currentMode = "onleave_exclude_private";
            btn.innerText = "⚡ 退出🚫私信";
            window.ChatRoomSendLocalStyled("模式：退出時不保存私信。請設定下載資料夾為 BC_TEMP！", 5000, "#ff69b4");
            window.onbeforeunload = function(event) {
                return exportChatAsHTML(false, false);
            };
        } else {
            currentMode = "stopped";
            btn.innerText = "⏸️ 停用";
            window.ChatRoomSendLocalStyled("模式：退出時不保存任何內容。請考慮手動匯出！", 5000, "#ff69b4");
            window.onbeforeunload = null;
        }
        localStorage.setItem("chatlogger_mode", currentMode);
        console.log(`🔄 [ChatLogger] 切換為 ${btn.innerText}`);
    }

    // 🖱️ UI
    function addUI() {
        const tryInsert = function() {
            const inputBar = document.querySelector("#InputChat");
            if (!inputBar) {
                setTimeout(tryInsert, 1000);
                return;
            }
            if (document.querySelector("#chatlogger-container")) return;

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
            toolbar.id = "chatlogger-container";
            toolbar.style.display = "none";
            toolbar.style.position = "absolute";
            toolbar.style.bottom = "50px";
            toolbar.style.left = "50px";
            toolbar.style.background = "#333";
            toolbar.style.padding = "8px";
            toolbar.style.borderRadius = "6px";
            toolbar.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
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
                b.onmouseover = function() { b.style.background = "#E37736"; };
                b.onmouseout = function() { b.style.background = "#555"; };
                b.onclick = handler;
                return b;
            };

            const btnHTML = smallBtn("📥 HTML", exportChatAsHTML);
            const btnExport = smallBtn("📥 EXCEL", exportExcel);
            const btnClear = smallBtn("🗑️ 清空", clearHistory);
            const btnMode = smallBtn("⏸️ 停用", function() { toggleMode(btnMode); });

            toolbar.appendChild(btnHTML);
            toolbar.appendChild(btnExport);
            toolbar.appendChild(btnClear);
            toolbar.appendChild(btnMode);

            container.appendChild(toggleButton);
            container.appendChild(toolbar);

            toggleButton.onclick = function() {
                toolbar.style.display = toolbar.style.display === "none" ? "flex" : "none";
            };

            document.body.appendChild(container);
            console.log("✅ [ChatLogger] 浮動工具列已加入");

            const savedMode = localStorage.getItem("chatlogger_mode") || "stopped";
            currentMode = savedMode;
            if (savedMode === "onleave_include_private") {
                btnMode.innerText = "⚡ 退出✅私信";
                window.ChatRoomSendLocalStyled("模式：退出時保存（含私信）。請設定下載資料夾為 BC_TEMP！", 5000, "#ff69b4");
                window.onbeforeunload = function(event) {
                    return exportChatAsHTML(false, true);
                };
            } else if (savedMode === "onleave_exclude_private") {
                btnMode.innerText = "⚡ 退出🚫私信";
                window.ChatRoomSendLocalStyled("模式：退出時不保存私信。請設定下載資料夾為 BC_TEMP！", 5000, "#ff69b4");
                window.onbeforeunload = function(event) {
                    return exportChatAsHTML(false, false);
                };
            } else {
                currentMode = "stopped";
                btnMode.innerText = "⏸️ 停用";
                window.ChatRoomSendLocalStyled("模式：退出時不保存任何內容。請考慮手動匯出！", 5000, "#ff69b4");
                window.onbeforeunload = null;
            }
            console.log(`🔄 [ChatLogger] 初始化模式為 ${btnMode.innerText}`);
        };
        tryInsert();
    }

    function waitForSdkAndInit() {
        if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
            initPlugin();
        } else {
            console.log("⏳ 等待 bcModSdk 載入中...");
            setTimeout(waitForSdkAndInit, 500);
        }
    }
    waitForSdkAndInit();
})();
