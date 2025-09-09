// ==UserScript==
// @name         Liko - NOI
// @name:zh      Liko的邀请通知器
// @namespace    https://likulisu.dev/
// @version      1.0
// @description  Notify on Invite
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ------------ 日誌控制 ------------
    const debugMode = false; // 設為 true 啟用詳細日誌
    function log(...args) {
        if (debugMode) console.log('[NOI]', ...args);
    }
    function warn(...args) {
        console.warn('[NOI]', ...args);
    }
    function error(...args) {
        console.error('[NOI]', ...args);
    }

    // ------------ 初始與等待工具 ------------
    function waitFor(condition, timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (condition()) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    // ------------ 載入樣式化訊息系統 ------------
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
            script.onerror = () => reject(new Error("載入 BC_toast_system 失敗"));
            document.head.appendChild(script);
        });
    }

    // ------------ mod 註冊 ------------
    let modApi = null;
    const modversion = "1.0";
    (async () => {
        const ok = await waitForBcModSdk();
        if (!ok) {
            warn("bcModSdk 未載入，將繼續以 fallback 模式執行");
        } else {
            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko's NOI",
                    fullName: "Liko's Notify on Invite",
                    version: modversion,
                    repository: "Liko的邀请通知器 | Liko's notify on invite."
                });
                log("modApi 註冊成功");
            } catch (e) {
                warn("modApi.registerMod 失敗，採用 fallback：", e.message);
            }
        }
        await loadToastSystem();
        await initialize();
    })();

    // ------------ 設定 / 儲存 ------------
    function ensureStorage() {
        if (!Player || !Player.OnlineSettings) return;
        if (!Player.OnlineSettings.NotifyOnInvite) {
            Player.OnlineSettings.NotifyOnInvite = {
                whiteMsg: "",
                blackMsg: "",
                friendMsg: ""
            };
            try {
                ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
                log("初始化 Player.OnlineSettings.NotifyOnInvite 並同步至伺服器");
            } catch (e) {
                error("無法同步 OnlineSettings:", e.message);
            }
        }
    }

    function getWhiteMsg() {
        ensureStorage();
        return (Player.OnlineSettings?.NotifyOnInvite?.whiteMsg) || "";
    }
    function getBlackMsg() understatement
        ensureStorage();
        return (Player.OnlineSettings?.NotifyOnInvite?.blackMsg) || "";
    }
    function getFriendMsg() {
        ensureStorage();
        return (Player.OnlineSettings?.NotifyOnInvite?.friendMsg) || "";
    }
    function setWhiteMsg(s) {
        ensureStorage();
        if (Player.OnlineSettings?.NotifyOnInvite) {
            Player.OnlineSettings.NotifyOnInvite.whiteMsg = s;
            try {
                ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
                log("白名單訊息已更新並同步至伺服器");
            } catch (e) {
                error("無法同步白名單訊息:", e.message);
            }
        }
    }
    function setBlackMsg(s) {
        ensureStorage();
        if (Player.OnlineSettings?.NotifyOnInvite) {
            Player.OnlineSettings.NotifyOnInvite.blackMsg = s;
            try {
                ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
                log("黑名單訊息已更新並同步至伺服器");
            } catch (e) {
                error("無法同步黑名單訊息:", e.message);
            }
        }
    }
    function setFriendMsg(s) {
        ensureStorage();
        if (Player.OnlineSettings?.NotifyOnInvite) {
            Player.OnlineSettings.NotifyOnInvite.friendMsg = s;
            try {
                ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
                log("好友訊息已更新並同步至伺服器");
            } catch (e) {
                error("無法同步好友訊息:", e.message);
            }
        }
    }

    // ------------ 變動檢測與通知 ------------
    function arraysEqual(a, b) {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        const aa = [...a].sort();
        const bb = [...b].sort();
        for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
        return true;
    }

    function sendListMessage(msg, addedMemberNumber) {
        if (!msg || String(msg).trim() === "") return;

        const myName = (Player?.Nickname && Player.Nickname.trim()) ? Player.Nickname : (Player?.Name || "Unknown");
        let targetName = "Unknown";
        try {
            const targetCharacter = ChatRoomCharacter?.find(c => c.MemberNumber === addedMemberNumber);
            if (targetCharacter) {
                targetName = (targetCharacter.Nickname && targetCharacter.Nickname.trim()) ? targetCharacter.Nickname : (targetCharacter.Name || "Unknown");
            } else {
                warn("無法找到 MemberNumber", addedMemberNumber, "的玩家資料");
            }
        } catch (e) {
            error("獲取目標玩家名稱失敗，MemberNumber:", addedMemberNumber);
        }

        const finalMsg = msg.replace(/\$me/g, myName).replace(/\$tag/g, targetName);

        try {
            ServerSend("ChatRoomChat", {
                Type: "Emote",
                Content: `*${finalMsg}`
            });
            log("已發送名單變動訊息:", finalMsg);
        } catch (e) {
            error("發送名單訊息失敗:", e.message);
        }
    }

    function checkListChangeAndNotify() {
        if (!Player) return;
        const curWhite = Player.WhiteList || [];
        const curBlack = Player.BlackList || [];
        const curFriends = Player.FriendList || [];

        if (!arraysEqual(curWhite, lastWhiteList)) {
            const added = curWhite.filter(id => !lastWhiteList.includes(id));
            if (added.length > 0) {
                const m = getWhiteMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => {
                        sendListMessage(m, id);
                        ChatRoomSendLocalStyled(`白名单通知设置：${m || "目前无设置消息"}`, 10000, "#50C878");
                    });
                }
            }
            lastWhiteList = [...curWhite];
        }

        if (!arraysEqual(curBlack, lastBlackList)) {
            const added = curBlack.filter(id => !lastBlackList.includes(id));
            if (added.length > 0) {
                const m = getBlackMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => {
                        sendListMessage(m, id);
                        ChatRoomSendLocalStyled(`黑名单通知设置：${m || "目前无设置消息"}`, 10000, "#50C878");
                    });
                }
            }
            lastBlackList = [...curBlack];
        }

        if (!arraysEqual(curFriends, lastFriendList)) {
            const added = curFriends.filter(id => !lastFriendList.includes(id));
            if (added.length > 0) {
                const m = getFriendMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => {
                        sendListMessage(m, id);
                        ChatRoomSendLocalStyled(`好友通知设置：${m || "目前无设置消息"}`, 10000, "#50C878");
                    });
                }
            }
            lastFriendList = [...curFriends];
        }
    }

    // ------------ 顯示設定訊息的輔助函數 ------------
    function showCurrentSettings() {
        const whiteMsg = getWhiteMsg() || "目前无设置消息";
        const blackMsg = getBlackMsg() || "目前无设置消息";
        const friendMsg = getFriendMsg() || "目前无设置消息";
        const message =
            "当前通知设置：\n" +
            `白名单消息：${whiteMsg}\n` +
            `黑名单消息：${blackMsg}\n` +
            `好友消息：${friendMsg}`;
        ChatRoomSendLocalStyled(message, 30000, "#50C878");
    }

    // ------------ 指令系統 /noi ------------
    function handle_NOI_Command(text) {
        if (typeof text !== "string") text = String(text || "");
        const args = text.trim().split(/\s+/).filter(x => x !== "");
        const sub = (args[0] || "").toLowerCase();

        if (!sub || sub === "help") {
            ChatRoomSendLocalStyled(
                // 簡體中文
                "Liko的邀请通知器：\n" +
                "/noi help - 显示说明\n" +
                "/noi whitemsg <文字> - 设置白名单新增时的消息\n" +
                "/noi blackmsg <文字> - 设置黑名单新增时的消息\n" +
                "/noi friendmsg <文字> - 设置好友新增时的消息\n" +
                "       设置消息时支持 $me 为自己名称、$tag 为目标名称\n" +
                "       示例：/noi whitemsg $me发送白名单给$tag了!\n" +
                "/noi clearwhitemsg - 清除白名单消息\n" +
                "/noi clearblackmsg - 清除黑名单消息\n" +
                "/noi clearfriendmsg - 清除好友消息\n" +
                "/noi showsetmsg - 显示白名单、黑名单、好友的设置消息\n\n" +
                // 英文
                "Liko's Notify on Invite:\n" +
                "/noi help - Show this help\n" +
                "/noi whitemsg <text> - Set message for whitelist additions\n" +
                "/noi blackmsg <text> - Set message for blacklist additions\n" +
                "/noi friendmsg <text> - Set message for friend list additions\n" +
                "       Messages support $me for your name and $tag for target name\n" +
                "       Example: /noi whitemsg $me added $tag to whitelist!\n" +
                "/noi clearwhitemsg - Clear whitelist message\n" +
                "/noi clearblackmsg - Clear blacklist message\n" +
                "/noi clearfriendmsg - Clear friend list message\n" +
                "/noi showsetmsg - 显示白名单、黑名单、好友的设置消息\n" +
                "      Show current white, black, and friend list messages",
                60000
                60000,
                "#50C878"
            );
            return;
        }

        if (sub === "whitemsg" || sub === "whitemessage") {
            const m = args.slice(1).join(" ");
            setWhiteMsg(m);
            ChatRoomSendLocalStyled(`✅ 白名单消息已设置为：${m || "目前无设置消息"}`, 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "blackmsg" || sub === "blackmessage") {
            const m = args.slice(1).join(" ");
            setBlackMsg(m);
            ChatRoomSendLocalStyled(`✅ 黑名单消息已设置为：${m || "目前无设置消息"}`, 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "friendmsg" || sub === "friendmessage") {
            const m = args.slice(1).join(" ");
            setFriendMsg(m);
            ChatRoomSendLocalStyled(`✅ 好友消息已设置为：${m || "目前无设置消息"}`, 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "clearwhitemsg" || sub === "clearwhitemessage") {
            setWhiteMsg("");
            ChatRoomSendLocalStyled("✅ 白名单消息已清除", 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "clearblackmsg" || sub === "clearblackmessage") {
            setBlackMsg("");
            ChatRoomSendLocalStyled("✅ 黑名单消息已清除", 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "clearfriendmsg" || sub === "clearfriendmessage") {
            setFriendMsg("");
            ChatRoomSendLocalStyled("✅ 好友消息已清除", 10000, "#50C878");
            showCurrentSettings();
            return;
        }
        if (sub === "showsetmsg" || sub === "showsettings") {
            showCurrentSettings();
            return;
        }
        ChatRoomSendLocalStyled("[NOI] 未知 /noi 指令，输入 /noi help 查看用法", 10000, "#ff4444");
    }

    // fallback：攔截輸入框送出（若 CommandCombine 無法註冊）
    const original_ChatRoomSendChat = window.ChatRoomSendChat;
    function setupChatInterceptFallback() {
        if (typeof window.ChatRoomSendChat !== "function") return;
        window.ChatRoomSendChat = function() {
            try {
                const val = ElementValue("InputChat");
                if (typeof val === "string" && val.startsWith("/noi")) {
                    const payload = val.replace(/^\/noi\s*/i, "");
                    handle_NOI_Command(payload);
                    ElementValue("InputChat", "");
                    return;
                }
            } catch (e) {
                error("chat intercept 錯誤:", e);
            }
            return original_ChatRoomSendChat.apply(this, arguments);
        };
        log("已安裝聊天攔截 fallback（/noi）");
    }

    // 嘗試用 CommandCombine 註冊（較佳）
    function tryRegisterCommand() {
        try {
            if (typeof CommandCombine === "function") {
                CommandCombine([{
                    Tag: "noi",
                    Description: "List Checker 指令（/noi）",
                    Action: function(text) {
                        handle_NOI_Command(text);
                    }
                }]);
                log("/noi 已透過 CommandCombine 註冊");
                return true;
            }
        } catch (e) {
            warn("CommandCombine 註冊 /noi 失敗：", e.message);
        }
        return false;
    }

    // ------------ Hook ChatRoomLoad ------------
    function hookChatRoomLoad() {
        if (modApi && mod Nap.hookFunction) {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                next(args);
                setTimeout(() => {
                    if (!window.LikoNOIWelcomed) {
                        ChatRoomSendLocalStyled(
                            "📧 Liko的邀请通知器 v1.0 已載入！使用 /noi help 查看说明",
                            5000,
                            "#50C878"
                        );
                        window.LikoNOIWelcomed = true;
                    }
                }, 1000);
            });
        }
    }

    // ------------ 初始化與主迴圈 ------------
    let lastWhiteList = [];
    let lastBlackList = [];
    let lastFriendList = [];

    async function initialize() {
        const ready = await waitFor(() =>
            typeof Player?.MemberNumber === "number" &&
            typeof Player?.OnlineSettings !== "undefined"
        , 30000);

        if (!ready) {
            warn("遊戲載入逾時，但仍嘗試初始化部分功能");
        }

        ensureStorage();
        lastWhiteList = [...(Player?.WhiteList || [])];
        lastBlackList = [...(Player?.BlackList || [])];
        lastFriendList = [...(Player?.FriendList || [])];

        const cmdReady = await waitFor(() => typeof CommandCombine === "function", 10000);
        if (cmdReady) {
            tryRegisterCommand();
        } else {
            setupChatInterceptFallback();
        }

        hookChatRoomLoad();

        setInterval(() => {
            try {
                checkListChangeAndNotify();
            } catch (e) {
                error("interval 錯誤:", e);
            }
        }, 800);

        log("初始化完成");
    }

    // ------------ 小工具（顯示本地訊息） ------------
    function ChatRoomSendLocal(msg, sec = 0) {
        try {
            if (CurrentScreen !== "ChatRoom") return;
            // 改用 ChatRoomSendLocalStyled，避免直接調用 ChatRoomMessage
            ChatRoomSendLocalStyled(`[NOI] ${msg}`, sec, "#885CB0");
        } catch (e) {
            error("無法發送本地訊息:", e);
        }
    }

    // export for debug
    window.NotifyOnInvite = {
        getWhiteMsg,
        getBlackMsg,
        getFriendMsg,
        setWhiteMsg,
        setBlackMsg,
        setFriendMsg,
        showCurrentSettings
    };
})();
