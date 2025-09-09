// ==UserScript==
// @name         Liko - Chat TtoB
// @name:zh      Liko的對話變按鈕
// @namespace    https://likolisu.dev/
// @version      1.1
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
    const modversion = "1.1";
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

    const CMD_RE = /\/[\p{L}\p{N}_-]+/gu;
    const COPY_RE = /!!(\S+)/gu;
    const ROOM_RE = /#([\s\S]+?)#/gu;

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

    function fragmentFromTextNode(textNode) {
        const text = textNode.textContent;
        if (!text) return null;
        if (!(/[\/!#]/.test(text))) return null;

        const parentEl = textNode.parentElement;
        if (parentEl && parentEl.closest && parentEl.closest('a')) return null;

        if (/https?:\/\//i.test(text)) return null;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        const RE = /(\/[\p{L}\p{N}_-]+)|!!(\S+)|#([\s\S]+?)#/gu;
        let m;
        while ((m = RE.exec(text)) !== null) {
            const i = m.index;
            if (i > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, i)));

            if (m[1]) {
                const cmdText = m[1];
                const cmdKey = cmdText.slice(1);
                const cmdObj = findCommandObjectByTag(cmdKey);
                if (cmdObj) frag.appendChild(makeCmdSpan(cmdText, cmdObj));
                else frag.appendChild(document.createTextNode(cmdText));
            } else if (m[2]) {
                frag.appendChild(makeAppendSpan(m[2]));
            } else if (m[3]) {
                frag.appendChild(makeRoomSpan(m[3]));
            }

            lastIndex = RE.lastIndex;
        }
        if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

        return frag;
    }

    function scanChat() {
        document.querySelectorAll(".chat-room-message-content").forEach((node) => {
            if (node.dataset.likoProcessed) return;
            node.dataset.likoProcessed = "1";

            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
            const texts = [];
            while (walker.nextNode()) texts.push(walker.currentNode);

            texts.forEach((tn) => {
                if (!tn.parentNode) return;

                const parentEl = tn.parentElement;
                if (parentEl && parentEl.closest && parentEl.closest('a')) return;

                const t = (tn.textContent || "");
                if (/https?:\/\//i.test(t)) return;

                const frag = fragmentFromTextNode(tn);
                if (frag) tn.parentNode.replaceChild(frag, tn);
            });
        });
    }

    // 新增：Hook ChatRoomLoad 顯示歡迎訊息
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

    // 初始化時呼叫 hookChatRoomLoad
    hookChatRoomLoad();

    setInterval(scanChat, 500);
})();
