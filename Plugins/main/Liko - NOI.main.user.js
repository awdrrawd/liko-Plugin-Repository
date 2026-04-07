// ==UserScript==
// @name         Liko - NOI
// @name:zh      Liko的邀請通知器
// @namespace    https://likulisu.dev/
// @version      1.2
// @description  Notify on Invite - Optimized with hooks
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==
(function() {
    'use strict';

    // ------------ 日誌控制 ------------
    const debugMode = false;
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

    // ------------ mod 註冊 ------------
    let modApi = null;
    const modversion = "1.2";

    // ------------ 狀態管理 ------------
    let isInitialized = false;

    // 保留原來的追蹤方式作為備份
    let lastWhiteList = [];
    let lastBlackList = [];
    let lastFriendList = [];

    // ------------ 設定 / 儲存 ------------
    function ensureStorage() {
        if (!Player || !Player.ExtensionSettings) return;
        if (!Player.ExtensionSettings.NotifyOnInvite) {
            Player.ExtensionSettings.NotifyOnInvite = { whiteMsg: "", blackMsg: "", friendMsg: "" };
            try {
                ServerAccountUpdate.QueueData({ ExtensionSettings: Player.ExtensionSettings });
                log("初始化 Player.ExtensionSettings.NotifyOnInvite 並同步至伺服器");
            } catch (e) {
                error("無法同步 ExtensionSettings:", e.message);
            }
        }
    }

    function getWhiteMsg() {
        ensureStorage();
        return (Player.ExtensionSettings?.NotifyOnInvite?.whiteMsg) || "";
    }
    function getBlackMsg() {
        ensureStorage();
        return (Player.ExtensionSettings?.NotifyOnInvite?.blackMsg) || "";
    }
    function getFriendMsg() {
        ensureStorage();
        return (Player.ExtensionSettings?.NotifyOnInvite?.friendMsg) || "";
    }
    function setWhiteMsg(s) {
        ensureStorage();
        if (Player.ExtensionSettings?.NotifyOnInvite) {
            Player.ExtensionSettings.NotifyOnInvite.whiteMsg = s;
            try {
                ServerAccountUpdate.QueueData({ ExtensionSettings: Player.ExtensionSettings });
            } catch (e) {
                error("無法同步白名單訊息:", e.message);
            }
        }
    }
    function setBlackMsg(s) {
        ensureStorage();
        if (Player.ExtensionSettings?.NotifyOnInvite) {
            Player.ExtensionSettings.NotifyOnInvite.blackMsg = s;
            try {
                ServerAccountUpdate.QueueData({ ExtensionSettings: Player.ExtensionSettings });
            } catch (e) {
                error("無法同步黑名單訊息:", e.message);
            }
        }
    }
    function setFriendMsg(s) {
        ensureStorage();
        if (Player.ExtensionSettings?.NotifyOnInvite) {
            Player.ExtensionSettings.NotifyOnInvite.friendMsg = s;
            try {
                ServerAccountUpdate.QueueData({ ExtensionSettings: Player.ExtensionSettings });
            } catch (e) {
                error("無法同步好友訊息:", e.message);
            }
        }
    }

    // ------------ 檢查是否在房間 ------------
    function isPlayerInChatRoom(memberNumber) {
        if (!ChatRoomCharacter || !Array.isArray(ChatRoomCharacter)) {
            return false;
        }
        return ChatRoomCharacter.some(c => c.MemberNumber === memberNumber);
    }

    // ------------ 通知邏輯 ------------
    function sendListMessage(msg, addedMemberNumber, listType) {
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
        } catch (e) {
            error("發送名單訊息失敗:", e.message);
        }
    }

    // ------------ 變動檢測與通知 (fallback) ------------
    function arraysEqual(a, b) {
        if (a === b) return true;
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        const aa = [...a].sort();
        const bb = [...b].sort();
        for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
        return true;
    }

    function checkListChangeAndNotify() {
        if (!Player || !isInitialized) return;

        const curWhite = Player.WhiteList || [];
        const curBlack = Player.BlackList || [];
        const curFriends = Player.FriendList || [];

        // 檢查白名單變化
        if (!arraysEqual(curWhite, lastWhiteList)) {
            const added = curWhite.filter(id => !lastWhiteList.includes(id));
            if (added.length > 0) {
                const m = getWhiteMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => sendListMessage(m, id, "white"));
                }
            }
            lastWhiteList = [...curWhite];
        }

        // 檢查黑名單變化
        if (!arraysEqual(curBlack, lastBlackList)) {
            const added = curBlack.filter(id => !lastBlackList.includes(id));
            if (added.length > 0) {
                const m = getBlackMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => sendListMessage(m, id, "black"));
                }
            }
            lastBlackList = [...curBlack];
        }

        // 檢查好友名單變化
        if (!arraysEqual(curFriends, lastFriendList)) {
            const added = curFriends.filter(id => !lastFriendList.includes(id));
            if (added.length > 0) {
                const m = getFriendMsg();
                if (m && m.trim() !== "") {
                    added.forEach(id => sendListMessage(m, id, "friend"));
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
        ChatRoomSendLocal(message, 30000);
    }

    // ------------ 指令系統 /noi ------------
    function handle_NOI_Command(text) {
        if (typeof text !== "string") text = String(text || "");
        const args = text.trim().split(/\s+/).filter(x => x !== "");
        const sub = (args[0] || "").toLowerCase();

        if (!sub || sub === "help") {
            ChatRoomSendLocal(
                "Liko的邀请通知器 v1.1 | Notify on Invite：\n" +
                "/noi help - 显示说明 | Show this help\n" +
                "/noi whitemsg <文字> - 设置白名单新增时的消息\n" +
                "/noi blackmsg <文字> - 设置黑名单新增时的消息\n" +
                "/noi friendmsg <文字> - 设置好友新增时的消息\n" +
                "       Set message for friend\\white\\blacklist additions\n" +
                "       ✦设置消息时支持 $me ⮕自己名称、$tag ⮕目标名称\n" +
                "       ✦support $me ⮕your name and $tag ⮕target name\n" +
                "       ✦範例：/noi whitemsg $me发送白名单给$tag了!\n" +
                "       ✦Example: /noi whitemsg $me added $tag to whitelist!\n" +
                "       ✦注意：只有当目标玩家在房间内时才会发送消息\n" +
                "       ✦Note: Messages only sent if target player is in room\n" +
                "/noi clearwhitemsg - 清除白名单消息\n" +
                "/noi clearblackmsg - 清除黑名单消息\n" +
                "/noi clearfriendmsg - 清除好友消息\n" +
                "      Clear friend\\white\\blacklist message\n" +
                "/noi showsetmsg - 显示白名单、黑名单、好友的设置消息\n" +
                "      Show current white, black, and friend list messages\n" +
                "/noi debug - 显示当前名单人数 (调试用)\n" +
                "      Show current number of people (for debugging)",
                60000
            );
            return;
        }

        if (sub === "whitemsg" || sub === "whitemessage") {
            const m = args.slice(1).join(" ");
            setWhiteMsg(m);
            ChatRoomSendLocal(`✅ 白名单消息已设置为：${m || "目前无设置消息"}`, 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "blackmsg" || sub === "blackmessage") {
            const m = args.slice(1).join(" ");
            setBlackMsg(m);
            ChatRoomSendLocal(`✅ 黑名单消息已设置为：${m || "目前无设置消息"}`, 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "friendmsg" || sub === "friendmessage") {
            const m = args.slice(1).join(" ");
            setFriendMsg(m);
            ChatRoomSendLocal(`✅ 好友消息已设置为：${m || "目前无设置消息"}`, 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "clearwhitemsg" || sub === "clearwhitemessage") {
            setWhiteMsg("");
            ChatRoomSendLocal("✅ 白名单消息已清除", 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "clearblackmsg" || sub === "clearblackmessage") {
            setBlackMsg("");
            ChatRoomSendLocal("✅ 黑名单消息已清除", 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "clearfriendmsg" || sub === "clearfriendmessage") {
            setFriendMsg("");
            ChatRoomSendLocal("✅ 好友消息已清除", 10000);
            showCurrentSettings();
            return;
        }
        if (sub === "showsetmsg" || sub === "showsettings") {
            showCurrentSettings();
            return;
        }
        if (sub === "debug") {
            const whiteSize = Player?.WhiteList?.length || 0;
            const blackSize = Player?.BlackList?.length || 0;
            const friendSize = Player?.FriendList?.length || 0;
            const roomCount = ChatRoomCharacter?.length || 0;
            ChatRoomSendLocal(
                `调试信息：\n` +
                `白名单大小: ${whiteSize}\n` +
                `黑名单大小: ${blackSize}\n` +
                `好友大小: ${friendSize}\n` +
                `房间玩家数: ${roomCount}\n` +
                `初始化状态: ${isInitialized}`,
                15000
            );
            return;
        }
        ChatRoomSendLocal("[NOI] 未知 /noi 指令，输入 /noi help 查看用法", 10000);
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
                return true;
            }
        } catch (e) {
            warn("CommandCombine 註冊 /noi 失敗：", e.message);
        }
        return false;
    }

    // ------------ Hook ChatRoomLoad ------------
    // 修正：ChatRoomLoad 不一定是 async，用相容寫法避免 .then() 報錯
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                const result = next(args);
                const show = () => {
                    if (!window.LikoNOIWelcomed) {
                        window.ChatRoomSendLocalStyled(
                            " 📧 Liko的邀请通知器 v" + modversion + " 已載入！使用 /noi help 查看说明",
                            5000,
                            "#885CB0"
                        );
                        window.LikoNOIWelcomed = true;
                    }
                };
                if (result && typeof result.then === 'function') {
                    result.then(() => setTimeout(show, 1000));
                } else {
                    setTimeout(show, 1000);
                }
                return result;
            });
        }
    }

    // ------------ Hook ServerAccountUpdate.QueueData ------------
    function hookServerAccountUpdate() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ServerAccountUpdate.QueueData", 0, (args, next) => {
                const data = args[0];
                if (data && typeof data === 'object') {
                    // 檢查白名單
                    if ('WhiteList' in data) {
                        const added = data.WhiteList.filter(id => !lastWhiteList.includes(id));
                        if (added.length > 0) {
                            const m = getWhiteMsg();
                            if (m && m.trim() !== "") {
                                added.forEach(id => sendListMessage(m, id, "white"));
                            }
                        }
                        lastWhiteList = [...data.WhiteList];
                    }

                    // 檢查黑名單
                    if ('BlackList' in data) {
                        const added = data.BlackList.filter(id => !lastBlackList.includes(id));
                        if (added.length > 0) {
                            const m = getBlackMsg();
                            if (m && m.trim() !== "") {
                                added.forEach(id => sendListMessage(m, id, "black"));
                            }
                        }
                        lastBlackList = [...data.BlackList];
                    }

                    // 檢查好友名單
                    if ('FriendList' in data) {
                        const added = data.FriendList.filter(id => !lastFriendList.includes(id));
                        if (added.length > 0) {
                            const m = getFriendMsg();
                            if (m && m.trim() !== "") {
                                added.forEach(id => sendListMessage(m, id, "friend"));
                            }
                        }
                        lastFriendList = [...data.FriendList];
                    }
                }
                next(args);
            });
        }
    }

    // ------------ 初始化與主邏輯 ------------
    async function initialize() {
        const ready = await waitFor(() =>
            typeof Player?.MemberNumber === "number" &&
            typeof Player?.ExtensionSettings !== "undefined"
        , 30000);

        if (!ready) {
            warn("遊戲載入逾時，但仍嘗試初始化部分功能");
        }

        ensureStorage();

        // 複製當前名單狀態
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
        hookServerAccountUpdate();

        // 如果沒有 modApi，fallback 到定時檢查
        if (!modApi) {
            setInterval(() => {
                try {
                    checkListChangeAndNotify();
                } catch (e) {
                    error("interval 錯誤:", e);
                }
            }, 1000);
        }

        // 標記初始化完成
        isInitialized = true;
    }

    // ------------ 小工具（顯示本地訊息） ------------
    function ChatRoomSendLocal(msg, sec = 0) {
        try {
            if (CurrentScreen !== "ChatRoom") return;
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#885CB0">[NOI] ${msg}</font>`,
                Timeout: sec
            });
        } catch (e) {
            try {
                ServerSend("ChatRoomChat", { Content: `[NOI] ${msg}`, Type: "LocalMessage", Time: sec });
            } catch (e2) {
                error("無法發送本地訊息:", e2);
            }
        }
    }

    function ChatRoomSendLocalStyled(msg, sec = 0, color = "#885CB0") {
        try {
            if (CurrentScreen !== "ChatRoom") return;
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="${color}">${msg}</font>`,
                Timeout: sec
            });
        } catch (e) {
            error("無法發送樣式化本地訊息:", e);
        }
    }

    // ------------ 主初始化流程 ------------
    (async () => {
        const ok = await waitForBcModSdk();
        if (!ok) {
            warn("bcModSdk 未載入，將繼續以 fallback 模式執行");
        } else {
            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko's NOI",
                    fullName: "Liko's Notify on Invite (Optimized)",
                    version: modversion,
                    repository: "Liko的邀請通知器 | Liko's notify on invite."
                });
                log("modApi 註冊成功");
            } catch (e) {
                warn("modApi.registerMod 失敗，採用 fallback：", e.message);
            }
        }
        await initialize();
    })();

    // export for debug
    // 修正：isInitialized 用 getter，確保每次讀取都是最新值
    window.NotifyOnInvite = {
        getWhiteMsg,
        getBlackMsg,
        getFriendMsg,
        setWhiteMsg,
        setBlackMsg,
        setFriendMsg,
        showCurrentSettings,
        get isInitialized() { return isInitialized; },
        isPlayerInChatRoom,
        checkListChangeAndNotify
    };
})();
