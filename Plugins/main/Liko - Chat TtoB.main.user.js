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
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // 檢查是否已經載入過，避免重複載入
    if (window.LikoChatTtoBInstance) {
        console.warn("⚠️ Liko Chat TtoB 已經載入，跳過重複載入");
        return;
    }

    let modApi;
    const modversion = "1.1.1";
    let isEnabled = true;
    let scanInterval;
    let descElement;
    let hookCleanup;

    // 儲存所有需要清理的資源
    const resources = {
        intervals: [],
        elements: [],
        eventListeners: [],
        hooks: []
    };

    // 建立插件實例
    const pluginInstance = {
        isEnabled: () => isEnabled,
        enable: enablePlugin,
        disable: disablePlugin,
        toggle: togglePlugin,
        destroy: destroyPlugin
    };

    // 註冊到全域，讓外部載入器可以訪問
    window.LikoChatTtoBInstance = pluginInstance;

    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's Chat TtoB",
                fullName: 'BC - Chat room text conversion button',
                version: modversion,
                repository: '聊天室[指令]、[!!內文]與[#房間#]轉按鈕\nChat Room [Commands], [!!Content], and [#RoomName#] conversion button.',
            });
            console.log("✅ CDT 腳本啟動完成");
        } else {
            console.error("[WCE修復] ❌ bcModSdk 或 registerMod 不可用");
        }
    } catch (e) {
        console.error("[WCE修復] ❌ 初始化失敗:", e.message);
    }

    // 創建描述框
    function createDescElement() {
        descElement = document.createElement("div");
        descElement.id = "likoCommandDescription";
        Object.assign(descElement.style, {
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
        document.body.appendChild(descElement);
        resources.elements.push(descElement);
    }

    function showDesc(text) {
        if (!isEnabled || !descElement) return;
        descElement.innerHTML = text;
        descElement.style.display = "block";
    }

    function hideDesc() {
        if (descElement) {
            descElement.style.display = "none";
        }
    }

    function makeCmdSpan(cmdText, cmdObj) {
        const el = document.createElement("span");
        el.className = "likoCommandInChat";
        el.textContent = cmdText;
        el.style.color = "#ff65f2";
        el.style.cursor = "pointer";

        const clickHandler = () => {
            if (!isEnabled) return;
            const input = document.querySelector("#InputChat");
            if (input) {
                input.value = cmdText + " ";
                input.focus();
            }
        };

        const mouseenterHandler = () => {
            if (!isEnabled) return;
            const descText = cmdObj.Description || `執行 ${cmdText}`;
            showDesc(descText + `<br><span style="color:#ff65f2;">點擊後聊天窗貼上命令</span><br><span style="color:#ff65f2;">Click to paste command in chat input</span>`);
        };

        el.addEventListener("click", clickHandler);
        el.addEventListener("mouseenter", mouseenterHandler);
        el.addEventListener("mouseleave", hideDesc);

        // 儲存事件監聽器供清理使用
        resources.eventListeners.push({
            element: el,
            events: [
                { type: "click", handler: clickHandler },
                { type: "mouseenter", handler: mouseenterHandler },
                { type: "mouseleave", handler: hideDesc }
            ]
        });

        return el;
    }

    function makeAppendSpan(label) {
        const el = document.createElement("span");
        el.className = "likoCommandInChat";
        el.textContent = label;
        el.style.color = "#65ff8a";
        el.style.cursor = "pointer";

        const clickHandler = (ev) => {
            if (!isEnabled) return;
            ev.stopPropagation();
            const input = document.querySelector("#InputChat");
            if (input) {
                input.value += label;
                input.focus();
            }
        };

        const mouseenterHandler = () => {
            if (!isEnabled) return;
            showDesc(`點擊後添加文字: ${label}<br>Click to append: ${label}`);
        };

        el.addEventListener("click", clickHandler);
        el.addEventListener("mouseenter", mouseenterHandler);
        el.addEventListener("mouseleave", hideDesc);

        resources.eventListeners.push({
            element: el,
            events: [
                { type: "click", handler: clickHandler },
                { type: "mouseenter", handler: mouseenterHandler },
                { type: "mouseleave", handler: hideDesc }
            ]
        });

        return el;
    }

    function makeRoomSpan(roomName) {
        const cleanRoomName = roomName.trim();
        const el = document.createElement("span");
        el.className = "likoRoomInChat";
        el.textContent = `🚪${roomName}🚪`;
        el.style.color = "#65b5ff";
        el.style.cursor = "pointer";

        const clickHandler = (ev) => {
            if (!isEnabled) return;
            ev.stopPropagation();
            if (typeof enterRoom === "function") {
                enterRoom(cleanRoomName);
            } else {
                ChatRoomLeave();
                CommonSetScreen("Online", "ChatSearch");
                ServerSend("ChatRoomJoin", { Name: cleanRoomName });
            }
        };

        const mouseenterHandler = () => {
            if (!isEnabled) return;
            showDesc(`點擊後加入房間: ${cleanRoomName} <br>Click to join room: ${cleanRoomName}`);
        };

        el.addEventListener("click", clickHandler);
        el.addEventListener("mouseenter", mouseenterHandler);
        el.addEventListener("mouseleave", hideDesc);

        resources.eventListeners.push({
            element: el,
            events: [
                { type: "click", handler: clickHandler },
                { type: "mouseenter", handler: mouseenterHandler },
                { type: "mouseleave", handler: hideDesc }
            ]
        });

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

    function processTextContent(element) {
        if (!isEnabled) return;
        if (element.dataset.likoProcessed === "1") return;

        if (element.closest('a')) return;

        let originalHTML = element.innerHTML;
        let processedHTML = originalHTML;
        let hasChanges = false;

        if (/https?:\/\//i.test(originalHTML)) return;

        // 處理房間名稱
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

        // 處理命令
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
            addEventListenersToProcessedElements(element);
        }

        element.dataset.likoProcessed = "1";
    }

    function addEventListenersToProcessedElements(element) {
        // 房間按鈕
        element.querySelectorAll('.likoRoomInChat[data-room-name]').forEach(el => {
            if (el.dataset.likoEventAdded) return;
            el.dataset.likoEventAdded = "1";

            const roomName = el.dataset.roomName;

            const clickHandler = (ev) => {
                if (!isEnabled) return;
                ev.stopPropagation();
                if (typeof enterRoom === "function") {
                    enterRoom(roomName);
                } else {
                    ChatRoomLeave();
                    CommonSetScreen("Online", "ChatSearch");
                    ServerSend("ChatRoomJoin", { Name: roomName });
                }
            };

            const mouseenterHandler = () => {
                if (!isEnabled) return;
                showDesc(`點擊後加入房間: ${roomName} <br>Click to join room: ${roomName}`);
            };

            el.addEventListener("click", clickHandler);
            el.addEventListener("mouseenter", mouseenterHandler);
            el.addEventListener("mouseleave", hideDesc);

            resources.eventListeners.push({
                element: el,
                events: [
                    { type: "click", handler: clickHandler },
                    { type: "mouseenter", handler: mouseenterHandler },
                    { type: "mouseleave", handler: hideDesc }
                ]
            });
        });

        // 命令按鈕
        element.querySelectorAll('.likoCommandInChat[data-cmd-text]').forEach(el => {
            if (el.dataset.likoEventAdded) return;
            el.dataset.likoEventAdded = "1";

            const cmdText = el.dataset.cmdText;
            const cmdDesc = el.dataset.cmdDesc;

            const clickHandler = () => {
                if (!isEnabled) return;
                const input = document.querySelector("#InputChat");
                if (input) {
                    input.value = cmdText + " ";
                    input.focus();
                }
            };

            const mouseenterHandler = () => {
                if (!isEnabled) return;
                const descText = cmdDesc || `執行 ${cmdText}`;
                showDesc(descText + `<br><span style="color:#ff65f2;">點擊後聊天窗貼上命令</span><br><span style="color:#ff65f2;">Click to paste command in chat input</span>`);
            };

            el.addEventListener("click", clickHandler);
            el.addEventListener("mouseenter", mouseenterHandler);
            el.addEventListener("mouseleave", hideDesc);

            resources.eventListeners.push({
                element: el,
                events: [
                    { type: "click", handler: clickHandler },
                    { type: "mouseenter", handler: mouseenterHandler },
                    { type: "mouseleave", handler: hideDesc }
                ]
            });
        });

        // 附加文字按鈕
        element.querySelectorAll('.likoCommandInChat[data-append-text]').forEach(el => {
            if (el.dataset.likoEventAdded) return;
            el.dataset.likoEventAdded = "1";

            const appendText = el.dataset.appendText;

            const clickHandler = (ev) => {
                if (!isEnabled) return;
                ev.stopPropagation();
                const input = document.querySelector("#InputChat");
                if (input) {
                    input.value += appendText;
                    input.focus();
                }
            };

            const mouseenterHandler = () => {
                if (!isEnabled) return;
                showDesc(`點擊後添加文字: ${appendText}<br>Click to append: ${appendText}`);
            };

            el.addEventListener("click", clickHandler);
            el.addEventListener("mouseenter", mouseenterHandler);
            el.addEventListener("mouseleave", hideDesc);

            resources.eventListeners.push({
                element: el,
                events: [
                    { type: "click", handler: clickHandler },
                    { type: "mouseenter", handler: mouseenterHandler },
                    { type: "mouseleave", handler: hideDesc }
                ]
            });
        });
    }

    function scanChat() {
        if (!isEnabled) return;
        document.querySelectorAll(".chat-room-message-content").forEach(processTextContent);
    }

    function enablePlugin() {
        isEnabled = true;
        console.log("✅ Liko Chat TtoB 已啟用");
        if (!scanInterval) {
            scanInterval = setInterval(scanChat, 500);
            resources.intervals.push(scanInterval);
        }
        document.querySelectorAll(".chat-room-message-content").forEach(el => {
            el.dataset.likoProcessed = "";
        });
        scanChat();
    }

    function disablePlugin() {
        isEnabled = false;
        console.log("❌ Liko Chat TtoB 已停用");
        hideDesc();
        if (scanInterval) {
            clearInterval(scanInterval);
            const index = resources.intervals.indexOf(scanInterval);
            if (index > -1) resources.intervals.splice(index, 1);
            scanInterval = null;
        }
        restoreOriginalText();
    }

    function togglePlugin() {
        if (isEnabled) {
            disablePlugin();
        } else {
            enablePlugin();
        }
        return isEnabled;
    }

    // 完全銷毀插件 - 供外部載入器使用
    function destroyPlugin() {
        console.log("🔥 正在銷毀 Liko Chat TtoB...");

        // 停用功能
        disablePlugin();

        // 清理所有定時器
        resources.intervals.forEach(interval => {
            clearInterval(interval);
        });

        // 清理所有事件監聽器
        resources.eventListeners.forEach(({ element, events }) => {
            if (element && element.parentNode) {
                events.forEach(({ type, handler }) => {
                    element.removeEventListener(type, handler);
                });
            }
        });

        // 清理所有DOM元素
        resources.elements.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });

        // 清理Hook
        if (hookCleanup) {
            hookCleanup();
        }

        // 恢復所有處理過的文字
        restoreOriginalText();

        // 清理全域變數
        delete window.LikoChatTtoBInstance;
        delete window.LikoChatTtoBWelcomed;

        console.log("✅ Liko Chat TtoB 已完全銷毀");
    }

    function restoreOriginalText() {
        document.querySelectorAll(".chat-room-message-content").forEach(element => {
            if (element.dataset.likoProcessed === "1") {
                const likoElements = element.querySelectorAll('.likoCommandInChat, .likoRoomInChat');
                likoElements.forEach(el => {
                    const textContent = el.textContent;
                    if (el.classList.contains('likoRoomInChat')) {
                        const roomName = el.dataset.roomName || textContent.replace(/🚪/g, '');
                        el.outerHTML = `#${roomName}#`;
                    } else if (el.dataset.appendText) {
                        el.outerHTML = `!!${el.dataset.appendText}`;
                    } else {
                        el.outerHTML = textContent;
                    }
                });
                element.dataset.likoProcessed = "";
            }
        });
    }

    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                return next(args).then(() => {
                    setTimeout(() => {
                        if (!window.LikoChatTtoBWelcomed && isEnabled) {
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
            });

            // 提供清理函數
            hookCleanup = () => {
                // bcModSdk 通常不提供直接的 unhook 方法，但我們可以標記
                console.log("🧹 清理 ChatRoomLoad Hook");
            };
        }
    }

    // 初始化
    createDescElement();
    hookChatRoomLoad();
    enablePlugin();

    console.log("🎛️ Liko Chat TtoB 載入完成");
    console.log("  - 外部載入器可使用 window.LikoChatTtoBInstance.destroy() 完全銷毀");

    // 監聽頁面卸載事件，自動清理
    window.addEventListener('beforeunload', destroyPlugin);
})();
