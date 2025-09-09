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

(() => {
    "use strict";
    try {
        if (bcModSdk?.registerMod) {
            const modApi = bcModSdk.registerMod({
                name: "Liko's Chat TtoB",
                fullName: 'BC - Chat room text conversion button',
                version: '1.6', // 更新版本號
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
    const ROOM_RE = /#([\s\S]+?)#/gu; // 保持支援空白和任意字符

    // 說明欄
    const desc = document.createElement("div");
    desc.id = "bccCommandDescription";
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

    // /指令按鈕
    function makeCmdSpan(cmdText, cmdObj) {
        const el = document.createElement("span");
        el.className = "bccCommandInChat";
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
            const descText = cmdObj.Description || `Execute ${cmdText}`;
            showDesc(descText + `<br><span style="color:#ff65f2;">Click to paste command in chat input</span>`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    // !!追加按鈕
    function makeAppendSpan(label) {
        const el = document.createElement("span");
        el.className = "bccCommandInChat";
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
            showDesc(`Click to append: ${label}`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    // #房間按鈕
    function makeRoomSpan(roomName) {
        const cleanRoomName = roomName.trim(); // 清理首尾空格
        const el = document.createElement("span");
        el.className = "bccRoomInChat";
        el.textContent = `🚪${roomName}🚪`; // 顯示原始房間名稱，包括空格
        el.style.color = "#65b5ff";
        el.style.cursor = "pointer";

        el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            // 嘗試使用 enterRoom，如果未定義則直接發送 ServerSend
            if (typeof enterRoom === "function") {
                enterRoom(cleanRoomName);
            } else {
                ChatRoomLeave();
                CommonSetScreen("Online", "ChatSearch");
                ServerSend("ChatRoomJoin", { Name: cleanRoomName });
            }
        });

        el.addEventListener("mouseenter", () => {
            showDesc(`點下後加入: ${cleanRoomName} 房間`);
            //showDesc(`Click to join room: ${cleanRoomName}`);
        });
        el.addEventListener("mouseleave", hideDesc);

        return el;
    }

    // 查找指令物件
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

    // 把文字轉成 fragment
    function fragmentFromTextNode(textNode) {
        const text = textNode.textContent;
        if (!text) return null;
        if (!(/[\/!#]/.test(text))) return null;

        // 如果文字節點在 <a> 內（任一祖先是 <a>），跳過
        const parentEl = textNode.parentElement;
        if (parentEl && parentEl.closest && parentEl.closest('a')) return null;

        // 如果文字包含 http:// 或 https://（忽略大小寫），跳過房間名稱解析
        if (/https?:\/\//i.test(text)) return null;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        const RE = /(\/[\p{L}\p{N}_-]+)|!!(\S+)|#([\s\S]+?)#/gu; // 保持房間正則，支援空白和任意字符
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

    // 把這個取代原本的 scanChat
    function scanChat() {
        document.querySelectorAll(".chat-room-message-content").forEach((node) => {
            if (node.dataset.bccProcessed) return;
            node.dataset.bccProcessed = "1";

            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
            const texts = [];
            while (walker.nextNode()) texts.push(walker.currentNode);

            texts.forEach((tn) => {
                if (!tn.parentNode) return;

                // 如果文字節點任一祖先為 <a>，跳過（更健壯）
                const parentEl = tn.parentElement;
                if (parentEl && parentEl.closest && parentEl.closest('a')) return;

                // 如果文字包含 http:// 或 https://（忽略大小寫），跳過
                const t = (tn.textContent || "");
                if (/https?:\/\//i.test(t)) return;

                const frag = fragmentFromTextNode(tn);
                if (frag) tn.parentNode.replaceChild(frag, tn);
            });
        });
    }

    setInterval(scanChat, 500);
})();
