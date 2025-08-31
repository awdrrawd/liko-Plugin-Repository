// ==UserScript==
// @name         Liko - Chat TtoB
// @name:zh      Liko的對話變按鈕
// @namespace    https://likulisu.dev/
// @version      1.0
// @description  display command buttons in chatroom, copying command to input and showing description
// @author       likolisu
// @match        https://bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(() => {
    "use strict";
    try {
        if (bcModSdk?.registerMod) {
            const modApi = bcModSdk.registerMod({
                name: 'Liko - Chat TtoB',
                fullName: 'BC - Chat room text conversion button',
                version: '1.0',
                repository: '聊天室[指令]與[!!內文]轉按鈕\n  Chat Room [Commands] and [!!Content] conversion button',
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
                input.value = cmdText + " "; // 👈 會覆蓋並帶空白
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
                input.value += label; // 👈 直接追加到現有文字後
                input.focus();
            }
        });

        el.addEventListener("mouseenter", () => {
            showDesc(`Click to append: ${label}`);
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
        if (!(/[\/!]/.test(text))) return null;

        // 如果文字節點在 <a> 內（任一祖先是 <a>），跳過
        const parentEl = textNode.parentElement;
        if (parentEl && parentEl.closest && parentEl.closest('a')) return null;

        // 如果文字本身（trim 後）以 http:// 或 https:// 開頭（允許前面有空白或一個左括號），也跳過
        if (/^\s*\(?\s*https?:\/\//i.test(text)) return null;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;

        const RE = /(\/[\p{L}\p{N}_-]+)|!!(\S+)/gu;
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

                // 如果文字本身以 http(s) 開頭，也跳過
                const t = (tn.textContent || "");
                if (/^\s*\(?\s*https?:\/\//i.test(t)) return;

                const frag = fragmentFromTextNode(tn);
                if (frag) tn.parentNode.replaceChild(frag, tn);
            });
        });
    }

    setInterval(scanChat, 500);
})();
