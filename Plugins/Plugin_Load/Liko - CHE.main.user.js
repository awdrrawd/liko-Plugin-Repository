// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      1.1
// @description  聊天室紀錄匯出 \\ Chat room history export to html/excel
// @author       莉柯莉絲(likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @run-at       document-end
// ==/UserScript==
import(`https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@latest/Plugins/expand/BC_Interactive_Index.js`);
(function() {
    "use strict";

    // ⚡ 插件初始化
    let modApi;
    function initPlugin() {
        try {
            if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CHE",
                    fullName: "Chat room history export to html/excel",
                    version: "1.1",
                    repository: "聊天室紀錄匯出 \n Chat room history export to html/excel",
                });

                console.log("✅ ChatLogger 已註冊到 /versions");
                setTimeout(function() {
                    addUI();
                }, 2000);
            } else {
                console.error("❌ ChatLogger 無法找到 bcModSdk");
            }
        } catch (e) {
            console.error("❌ ChatLogger 初始化錯誤:", e);
        }
    }

    const idColorMap = new Map();
    let colorIndex = 0;
    let currentMode = "stopped"; // stopped, onleave_include_private, onleave_exclude_private

    function getColor(id) {
        if (!id) return "";
        if (!idColorMap.has(id)) {
            idColorMap.set(id, colors[colorIndex % colors.length]);
            colorIndex++;
        }
        return idColorMap.get(id);
    }

    // 🔧 HTML转义函数
    function escapeHtml(text) {
        if (typeof text !== 'string') return text;
        return text
            .replace(/&/g, '&amp;')   // 必须首先转义 & 符号
            .replace(/</g, '&lt;')    // 转义 < 符号
            .replace(/>/g, '&gt;')    // 转义 > 符号
            .replace(/"/g, '&quot;')  // 转义 " 符号
            .replace(/'/g, '&#39;');  // 转义 ' 符号
    }

    // 🔧 新增函数：提取完整文本内容（包含链接）
    function extractFullTextContent(element) {
        if (!element) return "";

        // 克隆元素避免修改原始DOM
        const clone = element.cloneNode(true);

        // 处理所有链接元素
        const links = clone.querySelectorAll('a[href]');
        links.forEach(function(link) {
            const href = link.getAttribute('href');
            const text = link.innerText || link.textContent || '';

            // 如果链接文本和URL不同，显示为 "文本 (URL)" 的形式
            if (text && text !== href && !text.includes('http')) {
                link.textContent = text + ' (' + href + ')';
            } else {
                // 如果没有文本或文本就是URL，直接显示URL
                link.textContent = href;
            }
        });

        // 处理图片链接
        const imgLinks = clone.querySelectorAll('a.bce-img-link');
        imgLinks.forEach(function(imgLink) {
            const href = imgLink.getAttribute('href');
            const img = imgLink.querySelector('img');
            if (img && href) {
                imgLink.textContent = '[图片: ' + href + ']';
            }
        });

        return clone.textContent || clone.innerText || "";
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

            yesButton.onclick = function() {
                document.body.removeChild(modal);
                resolve(true);
            };
            noButton.onclick = function() {
                document.body.removeChild(modal);
                resolve(false);
            };
        });
    }

    // 💾 匯出 Excel
    function exportExcel() {
        showCustomPrompt("請問您是否保存包含\n悄悄話(wisper)與私信(beep)的信息?").then(function(includePrivate) {
            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                alert("❌ 找不到聊天室容器 (#TextAreaChatLog)");
                return;
            }

            const nodes = Array.from(log.children);
            const data = [["時間", "ID", "訊息"]];
            const processedBeeps = new Set();

            nodes.forEach(function(node) {
                // 使用新的函数提取完整内容
                const fullText = extractFullTextContent(node);
                const parts = fullText.split("\n").map(function(x) { return x.trim(); }).filter(Boolean);

                if (node.matches && node.matches("a.beep-link")) {
                    if (!includePrivate) return;
                    const beepContent = fullText.trim();
                    if (processedBeeps.has(beepContent)) return;
                    processedBeeps.add(beepContent);
                    data.push(["", "", beepContent]);
                } else if (parts.length >= 3) {
                    const time = parts[0];
                    const id = parts[1];
                    const msg = parts.slice(2).join(" ");
                    if (msg.includes("BCX commands tutorial") || msg.includes("BCX also provides") || msg.includes("(输入 /help 查看命令列表)")) return;
                    if (!includePrivate && (msg.includes("悄悄話") || msg.includes("好友私聊") || msg.includes("BEEP"))) return;
                    data.push([time, id, msg]);
                } else if (parts.length === 2) {
                    if (!includePrivate && (parts[1].includes("悄悄話") || parts[1].includes("好友私聊") || parts[1].includes("BEEP"))) return;
                    data.push([parts[0], "", parts[1]]);
                }
            });

            if (data.length <= 1) {
                alert("❌ 沒有抓到任何訊息");
                return;
            }

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

            console.log(`✅ [ChatLogger] 匯出 ${data.length - 1} 條訊息 (Excel)`);
        });
    }

    // 💾 匯出 HTML
    function exportChatAsHTML(NoLeave, includePrivate) {
        if (NoLeave === undefined) NoLeave = true;
        if (includePrivate === undefined) includePrivate = false;

        const processExport = function(finalIncludePrivate) {
            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                alert("❌ 找不到聊天室容器 (#TextAreaChatLog)");
                return;
            }

            const messages = Array.from(log.querySelectorAll(".ChatMessage, a.beep-link, .chat-room-sep-div"));
            if (messages.length === 0) {
                alert("❌ 沒有訊息可匯出");
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

            function getLabelColor(msg, nameButton) {
                let c =
                    msg.style.getPropertyValue("--label-color") ||
                    getComputedStyle(msg).getPropertyValue("--label-color") ||
                    (nameButton && (nameButton.style.getPropertyValue("--label-color") || getComputedStyle(nameButton).getPropertyValue("--label-color"))) ||
                    "";
                c = (c || "").trim();
                if (c) return c;
                const colorSpan = msg.querySelector('[style*="color"]');
                if (colorSpan && colorSpan.style && colorSpan.style.color) return colorSpan.style.color;
                const fontEl = msg.querySelector("font[color]");
                if (fontEl && fontEl.color) return fontEl.color;
                return "#000";
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

                // 根据消息类型获取文本内容
                let rawText = "";
                const textNode = msg.querySelector(".chat-room-message-content");

                if (textNode) {
                    // 对于有 chat-room-message-content 的消息类型（如 ChatMessageChat）
                    rawText = extractFullTextContent(textNode);
                } else {
                    // 对于没有 chat-room-message-content 的消息类型（如 ChatMessageAction）
                    // 需要排除时间和ID部分，只保留实际消息内容
                    const clonedMsg = msg.cloneNode(true);
                    // 移除所有 chat-room-metadata 部分（包含时间和ID）
                    const metadataElements = clonedMsg.querySelectorAll('.chat-room-metadata');
                    metadataElements.forEach(function(meta) { meta.remove(); });
                    // 移除弹出菜单部分
                    const popup = clonedMsg.querySelector('.chat-room-message-popup');
                    if (popup) popup.remove();
                    // 移除用户名按钮
                    const nameBtn = clonedMsg.querySelector('.ChatMessageName');
                    if (nameBtn) nameBtn.remove();

                    rawText = extractFullTextContent(clonedMsg).trim();
                }

                // 检查是否为需要过滤的系统消息
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
                    // ChatMessageChat 类型：使用 chat-room-message-content 内容
                    const textContent = escapeHtml(rawText.trim());
                    content = `<span style="color:${labelColor}">${escapeHtml(senderName)}</span>: ${textContent}`;
                    rowStyleInline = `class="chat-row with-accent" style="border-left-color:${labelColor};"`;
                } else if (msg.classList.contains("ChatMessageWhisper")) {
                    if (!finalIncludePrivate) continue;
                    // ChatMessageWhisper 类型：使用 chat-room-message-content 内容
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
                    // 这些类型没有 chat-room-message-content，内容在外层
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

            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `chatlog_${timestamp}.html`;
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);

            console.log(`✅ [ChatLogger] 匯出 HTML 完成: ${filename}`);
        };

        if (NoLeave) {
            showCustomPrompt("請問您是否保存包含悄悄話(whisper)與私信(beep)的信息?").then(processExport);
        } else {
            processExport(includePrivate);
        }
    }

    // 🗑️ 清空
    function clearHistory() {
        showCustomPrompt("是否清除聊天室訊息？（將保留當前房間資訊）").then(function(confirmClear) {
            if (!confirmClear) return;

            const log = document.querySelector("#TextAreaChatLog");
            if (!log) {
                alert("❌ 找不到聊天室容器 (#TextAreaChatLog)");
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
        });
    }

    // 🔄 模式切換
    function toggleMode(btn) {
        if (currentMode === "stopped") {
            currentMode = "onleave_include_private";
            btn.innerText = "⚡ 退出✅私信";
            ChatRoomSendLocal("[CHE] 當前模式為✅退出時保存私信內容，建議將瀏覽器下載目錄設為 BC_TEMP", 5000);
            window.onbeforeunload = function() {
                exportChatAsHTML(false, true);
            };
        } else if (currentMode === "onleave_include_private") {
            currentMode = "onleave_exclude_private";
            btn.innerText = "⚡ 退出🚫私信";
            ChatRoomSendLocal("[CHE] 當前模式為🚫退出時不保存私信內容，建議將瀏覽器下載目錄設為 BC_TEMP", 5000);
            window.onbeforeunload = function() {
                exportChatAsHTML(false, false);
            };
        } else {
            currentMode = "stopped";
            btn.innerText = "⏸️ 停用";
            ChatRoomSendLocal("[CHE] 當前模式為⏸️退出時不保存任何內容", 5000);
            window.onbeforeunload = null;
        }
        localStorage.setItem("chatlogger_mode", currentMode); // 儲存當前模式
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
            toggleButton.style.background = "#333"; // 平時底色
            toggleButton.style.color = "#fff";
            toggleButton.style.border = "none";
            toggleButton.style.opacity = "0.7";
            toggleButton.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
            toggleButton.style.transition = "opacity 0.2s, transform 0.2s, background 0.2s";
            toggleButton.title = "聊天室紀錄保存器";
            toggleButton.onmouseover = function() {
                toggleButton.style.opacity = "1"; // 懸停透明度 100%
                toggleButton.style.background = "#AC66E4"; // 懸停底色紫色
                toggleButton.style.transform = "scale(1.1)";
            };
            toggleButton.onmouseout = function() {
                toggleButton.style.opacity = "0.7";
                toggleButton.style.background = "#333"; // 恢復平時底色
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
                b.onmouseover = function() { b.style.background = "#E37736"; }; // 工具列按鈕懸停橙色
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

            // 初始化模式（根據 localStorage）
            const savedMode = localStorage.getItem("chatlogger_mode") || "stopped";
            currentMode = savedMode;
            if (savedMode === "onleave_include_private") {
                btnMode.innerText = "⚡ 退出✅私信";
                ChatRoomSendLocal("[CHE] 當前模式為✅退出時保存私信內容，建議將瀏覽器下載目錄設為 BC_TEMP", 5000);
                window.onbeforeunload = function() {
                    exportChatAsHTML(false, true);
                };
            } else if (savedMode === "onleave_exclude_private") {
                btnMode.innerText = "⚡ 退出🚫私信";
                ChatRoomSendLocal("[CHE] 當前模式為🚫退出時不保存私信內容，建議將瀏覽器下載目錄設為 BC_TEMP", 5000);
                window.onbeforeunload = function() {
                    exportChatAsHTML(false, false);
                };
            } else {
                currentMode = "stopped";
                btnMode.innerText = "⏸️ 停用";
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
