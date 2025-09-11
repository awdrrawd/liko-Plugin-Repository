// ==UserScript==
// @name         Liko - Chat TtoB
// @name:zh      Liko的對話變按鈕
// @namespace    https://likolisu.dev/
// @version      1.1.1
// @description  display command buttons in chatroom, copying command to input and showing description
// @author       likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    let modApi;
    const modversion = "1.1.1";
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's Chat TtoB",
                fullName: 'BC - Chat room text conversion button',
                version: modversion,
                repository: '聊天室[指令]、[!!內文]與[#房間#]轉按鈕（支援空白房間名稱，包含 https 時跳過房間解析）\nChat Room [Commands], [!!Content], and [#RoomName#] conversion button (supports spaces in room names, skips room parsing when https is present)',
            });
            console.log("✅ CDT 腳本啟動完成");
        } else {
            console.error("[WCE修復] ❌ bcModSdk 或 registerMod 不可用");
        }
    } catch (e) {
        console.error("[WCE修復] ❌ 初始化失敗:", e.message);
    }

    const desc = document.createElement("div");
    desc.id = "likoCommandDescription";
    Object.assign(desc.style, {
        position: "fixed",
        left: "0px",
        top: "0px",
        color: "white",
        background: "rgb(96, 10, 182)",
        fontSize: "22px",
        fontFamily: "Comfortaa",
        padding: "8px",
        textAlign: "center",
        width: "100%",
        display: "none",
        zIndex: 1000,
    });
    document.body.appendChild(desc);

    function showDesc(text) {
        desc.innerHTML = text;
        desc.style.display = "block";
    }
    function hideDesc() {
        desc.style.display = "none";
    }

    function makeCmdSpan(cmdText, cmdObj) {
        const el = document.createElement("span");
        el.className = "likoCommandInChat";
        el.textContent = cmdText;
        el.style.color = "#ff65f2";
        el.style.cursor = "pointer";

        el.addEventListener("click", () => {
            const input = document.querySelector("#InputChat");
            if (input) {
                input.value = cmdText + " ";
                input.focus();
            }
        });

        el.addEventListener("mouseenter", () => {
            const descText = cmdObj.Description || `執行 ${cmdText}`;
            showDesc(descText + `<br><span style="color:#ff65f2;">點擊後聊天窗貼上命令</span><br><span style="color:#ff65f2;">Click to paste command in chat input</span>`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    function makeAppendSpan(label) {
        const el = document.createElement("span");
        el.className = "likoCommandInChat";
        el.textContent = label;
        el.style.color = "#65ff8a";
        el.style.cursor = "pointer";

        el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            const input = document.querySelector("#InputChat");
            if (input) {
                input.value += label;
                input.focus();
            }
        });

        el.addEventListener("mouseenter", () => {
            showDesc(`點擊後添加文字: ${label}<br>Click to append: ${label}`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    function makeRoomSpan(roomName) {
        const cleanRoomName = roomName.trim();
        const el = document.createElement("span");
        el.className = "likoRoomInChat";
        el.textContent = `🚪${roomName}🚪`;
        el.style.color = "#65b5ff";
        el.style.cursor = "pointer";

        el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (typeof enterRoom === "function") {
                enterRoom(cleanRoomName);
            } else {
                ChatRoomLeave();
                CommonSetScreen("Online", "ChatSearch");
                ServerSend("ChatRoomJoin", { Name: cleanRoomName });
            }
        });

        el.addEventListener("mouseenter", () => {
            showDesc(`點擊後加入房間: ${cleanRoomName} <br>Click to join room: ${cleanRoomName}`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    function normalizeCmd(str) {
        return str.normalize("NFKC").trim().toLowerCase();
    }

    function findCommandObjectByTag(cmdKey) {
        if (!Array.isArray(window.Commands)) return null;
        return Commands.find(
            (c) =>
                normalizeCmd(c.Tag) === normalizeCmd(cmdKey) || c.Tag === cmdKey
        );
    }

    // 採用1.4版本的字符串處理方式，但保持1.1的按鈕創建方法
    function processTextContent(element) {
        if (element.dataset.likoProcessed === "1") return;

        // 檢查是否在連結內
        if (element.closest('a')) return;

        let originalHTML = element.innerHTML;
        let processedHTML = originalHTML;
        let hasChanges = false;

        // 跳過包含 https 的內容
        if (/https?:\/\//i.test(originalHTML)) return;

        // 處理房間名稱 #room name# (使用1.4版本的正則)
        processedHTML = processedHTML.replace(/#([^#\n\r]{1,50})#/g, (match, roomName) => {
            if (roomName && roomName.trim().length > 0) {
                hasChanges = true;
                const cleanName = roomName.trim();
                return `<span class="likoRoomInChat" style="color:#65b5ff;cursor:pointer;" data-room-name="${cleanName}">🚪${roomName}🚪</span>`;
            }
            return match;
        });

        // 處理 !! 內容
        processedHTML = processedHTML.replace(/!!(\S+)/g, (match, content) => {
            hasChanges = true;
            return `<span class="likoCommandInChat" style="color:#65ff8a;cursor:pointer;" data-append-text="${content}">${content}</span>`;
        });

        // 處理命令 /command
        processedHTML = processedHTML.replace(/(^|\s)(\/[\p{L}\p{N}_-]+)/gu, (match, prefix, cmdText) => {
            const cmdKey = cmdText.slice(1);
            const cmdObj = findCommandObjectByTag(cmdKey);
            if (cmdObj) {
                hasChanges = true;
                const descText = (cmdObj.Description || '').replace(/"/g, '&quot;');
                return `${prefix}<span class="likoCommandInChat" style="color:#ff65f2;cursor:pointer;" data-cmd-text="${cmdText}" data-cmd-desc="${descText}">${cmdText}</span>`;
            }
            return match;
        });

        if (hasChanges) {
            element.innerHTML = processedHTML;

            // 為新創建的元素添加事件監聽器
            element.querySelectorAll('.likoRoomInChat[data-room-name]').forEach(el => {
                if (el.dataset.likoEventAdded) return;
                el.dataset.likoEventAdded = "1";

                const roomName = el.dataset.roomName;
                const roomSpan = makeRoomSpan(roomName);

                // 復制事件監聽器
                el.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    if (typeof enterRoom === "function") {
                        enterRoom(roomName);
                    } else {
                        ChatRoomLeave();
                        CommonSetScreen("Online", "ChatSearch");
                        ServerSend("ChatRoomJoin", { Name: roomName });
                    }
                });

                el.addEventListener("mouseenter", () => {
                    showDesc(`點擊後加入房間: ${roomName} <br>Click to join room: ${roomName}`);
                });
                el.addEventListener("mouseleave", hideDesc);
            });

            element.querySelectorAll('.likoCommandInChat[data-cmd-text]').forEach(el => {
                if (el.dataset.likoEventAdded) return;
                el.dataset.likoEventAdded = "1";

                const cmdText = el.dataset.cmdText;
                const cmdDesc = el.dataset.cmdDesc;

                el.addEventListener("click", () => {
                    const input = document.querySelector("#InputChat");
                    if (input) {
                        input.value = cmdText + " ";
                        input.focus();
                    }
                });

                el.addEventListener("mouseenter", () => {
                    const descText = cmdDesc || `執行 ${cmdText}`;
                    showDesc(descText + `<br><span style="color:#ff65f2;">點擊後聊天窗貼上命令</span><br><span style="color:#ff65f2;">Click to paste command in chat input</span>`);
                });
                el.addEventListener("mouseleave", hideDesc);
            });

            element.querySelectorAll('.likoCommandInChat[data-append-text]').forEach(el => {
                if (el.dataset.likoEventAdded) return;
                el.dataset.likoEventAdded = "1";

                const appendText = el.dataset.appendText;

                el.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    const input = document.querySelector("#InputChat");
                    if (input) {
                        input.value += appendText;
                        input.focus();
                    }
                });

                el.addEventListener("mouseenter", () => {
                    showDesc(`點擊後添加文字: ${appendText}<br>Click to append: ${appendText}`);
                });
                el.addEventListener("mouseleave", hideDesc);
            });
        }

        element.dataset.likoProcessed = "1";
    }

    function scanChat() {
        // 直接處理所有聊天內容元素
        document.querySelectorAll(".chat-room-message-content").forEach(processTextContent);
    }

    // Hook ChatRoomLoad 顯示歡迎訊息
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                next(args);
                setTimeout(() => {
                    if (!window.LikoChatTtoBWelcomed) {
                        ChatRoomSendLocal(
                            `<p style='background-color:#4C2772;color:#EEEEEE;display:block;padding:5px;'>
                            <b>💭Liko - Chat TtoB v1.1 💭</b>
                            <br>- /指令：轉為粉色按鈕，點擊貼到輸入框
                            <br>- !!內容：轉為綠色按鈕，點擊附加到輸入框
                            <br>- #房間名稱#：轉為藍色按鈕，點擊加入房間
                            </p>`.replaceAll("\n", ""),30000
                        );
                        window.LikoChatTtoBWelcomed = true;
                    }
                }, 1000);
            });
        }
    }

    hookChatRoomLoad();

    setInterval(scanChat, 500);
})();
