// ==UserScript==
// @name         Liko - Release Maid
// @name:zh      Liko的解綁女僕
// @namespace    https://likulisu.dev/
// @version      1.1
// @description  自動回應「救我 / 救救 / help」來解除拘束，支援指定救人
// @author       莉柯莉絲(Likolisu)
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

(function() {
    'use strict';

    let modApi = null;

    // 等待 bcModSdk 載入的函數
    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[Release Bot] bcModSdk 載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 初始化 modApi
    async function initializeModApi() {
        const success = await waitForBcModSdk();
        if (!success) {
            console.error("[Release Bot] ❌ bcModSdk 無法載入，插件將以兼容模式運行");
            return null;
        }

        try {
            modApi = bcModSdk.registerMod({
                name: 'Liko Release Maid',
                fullName: 'Bondage Club - Liko Auto Release Maid',
                version: '1.1',
                repository: '莉柯莉絲的自動解鎖女僕',
            });
            console.log("✅ Liko Release Bot 註冊成功");
            return modApi;
        } catch (e) {
            console.error("[Release Bot] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }

    // 本地變數（避免全局汙染）
    let autoEnabled = false;   // 預設關閉
    let hookBound = false;
    let socketListener = null; // 儲存監聽器引用以便清理

    // === 按鈕座標 ===
    const btnX = 0;
    const btnY = 35;
    const size = 45;

    // === 關鍵字 ===
    const triggerWords = ["救我", "救救", "幫我", "帮我", "help"];   // 完全解放
    const unlockWords  = ["開鎖", "开锁", "解鎖", "解锁", "unlock"]; // 只解鎖

    // === 本地訊息發送函數 ===
    function sendLocalMessage(message) {
        try {
            if (CurrentScreen !== "ChatRoom") {
                console.warn("[Release Bot] 不在聊天室，訊息可能不顯示");
                return;
            }
            ChatRoomMessage({
                Content: `<font color="#00FF00">[Release Bot] ${message}</font>`,
                Type: "LocalMessage",
                Sender: Player.MemberNumber
            });
        } catch (e) {
            console.error("[Release Bot] 發送本地訊息錯誤:", e.message);
        }
    }

    // === 正規化訊息 (處理口吃 / 符號) ===
    function normalizeMessage(msg) {
        return msg
            .toLowerCase()
            .replace(/[-~.…。！!,?？]/g, "") // 去掉符號
            .replace(/(.)\1{3,}/g, "$1$1")  // 三次以上重複壓縮成兩次 (救救救救 -> 救救)
            .trim();
    }

    // === 檢查權限函數 ===
    function hasPermission(target) {
        try {
            if (typeof ServerChatRoomGetAllowItem === "function") {
                return ServerChatRoomGetAllowItem(Player, target);
            }
            return true; // 如果函數不存在，假設有權限
        } catch (e) {
            console.warn("[Release Bot] 權限檢查失敗:", e.message);
            return true;
        }
    }

    // === 解鎖函數 (不移除物品，只解鎖，保留 Owner/Lover 鎖) ===
    function UnlockAllLocks(C) {
        if (!C || !C.Appearance) {
            console.warn("[Release Bot] 無效的角色對象");
            return;
        }

        if (!hasPermission(C)) {
            console.warn("[Release Bot] 無權限操作角色:", C.Name);
            return;
        }

        const skipLocks = [
            "OwnerPadlock",
            "OwnerTimerPadlock",
            "LoversPadlock",
            "LoversTimerPadlock",
        ];

        let unlockedCount = 0;
        try {
            for (let a of C.Appearance) {
                if (a.Property && a.Property.LockedBy) {
                    if (skipLocks.includes(a.Property.LockedBy)) continue;
                    InventoryUnlock(C, a);
                    unlockedCount++;
                }
            }

            if (unlockedCount > 0) {
                ChatRoomCharacterUpdate(C);
            }
        } catch (e) {
            console.error("[Release Bot] 解鎖失敗:", e.message);
        }

        return unlockedCount;
    }

    // === 救援函數 ===
    function rescue(target, mode = "release") {
        if (!target) {
            console.warn("[Release Bot] 救援目標無效");
            return;
        }

        if (!hasPermission(target)) {
            console.warn("[Release Bot] 無權限救援:", target.Name);
            return;
        }

        try {
            let success = false;
            if (mode === "unlock") {
                const count = UnlockAllLocks(target);
                success = count > 0;
            } else {
                CharacterReleaseTotal(target);
                ChatRoomCharacterUpdate(target);
                success = true;
            }

            if (success) {
                const botName = Player.Nickname || Player.Name;
                const displayName = target.Nickname || target.Name;
                const systemMessage =
                    mode === "unlock"
                        ? `${botName}解開了${displayName}的鎖`
                        : `${botName}解開了${displayName}的拘束`;

                ServerSend("ChatRoomChat", {
                    Type: "Action",
                    Content: "CUSTOM_SYSTEM_ACTION",
                    Dictionary: [
                        { Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: systemMessage }
                    ]
                });

                console.log(`[Release Bot] 救援成功: ${displayName} (${mode})`);
            }
        } catch (e) {
            console.error("[Release Bot] 救援操作失敗:", e.message);
        }
    }

    // === 訊息處理函數 ===
    function handleMessage(data) {
        if (!autoEnabled) return;
        if ((data.Type !== "Chat" && data.Type !== "Emote") || typeof data.Content !== "string") return;

        const rawMsg = data.Content.trim();
        const msg = normalizeMessage(rawMsg);
        const senderID = data.Sender;

        try {
            // --- 自救 (完全解放) ---
            if (triggerWords.some(w => msg.includes(w))) {
                const target = ChatRoomCharacter.find(c => c.MemberNumber === senderID);
                if (target) rescue(target, "release");
                return;
            }

            // --- 自救 (只解鎖) ---
            if (unlockWords.some(w => msg.includes(w))) {
                const target = ChatRoomCharacter.find(c => c.MemberNumber === senderID);
                if (target) rescue(target, "unlock");
                return;
            }

            // --- 指定救援 (完全解放) ---
            if (msg.startsWith("救") || msg.startsWith("help")) {
                const keyword = msg.replace(/^救|^help/i, "").trim();
                if (!keyword) return;

                let target = null;
                if (/^\d+$/.test(keyword)) {
                    const id = parseInt(keyword);
                    target = ChatRoomCharacter.find(c => c.MemberNumber === id);
                }
                if (!target) {
                    target = ChatRoomCharacter.find(c =>
                        c.Nickname?.toLowerCase() === keyword.toLowerCase() ||
                        c.Name?.toLowerCase() === keyword.toLowerCase()
                    );
                }

                if (target) rescue(target, "release");
            }

            // --- 指定解鎖 ---
            if (msg.startsWith("解鎖") || msg.startsWith("解锁") || msg.startsWith("unlock")) {
                const keyword = msg.replace(/^解鎖|^解锁|^unlock/i, "").trim();
                if (!keyword) return;

                let target = null;
                if (/^\d+$/.test(keyword)) {
                    const id = parseInt(keyword);
                    target = ChatRoomCharacter.find(c => c.MemberNumber === id);
                }
                if (!target) {
                    target = ChatRoomCharacter.find(c =>
                        c.Nickname?.toLowerCase() === keyword.toLowerCase() ||
                        c.Name?.toLowerCase() === keyword.toLowerCase()
                    );
                }

                if (target) rescue(target, "unlock");
            }
        } catch (e) {
            console.error("[Release Bot] 訊息處理錯誤:", e.message);
        }
    }

    // === 安全的 hook 函數包裝器 ===
    function safeHookFunction(functionName, priority, callback) {
        if (modApi && typeof modApi.hookFunction === 'function') {
            try {
                return modApi.hookFunction(functionName, priority, callback);
            } catch (e) {
                console.error(`[Release Bot] Hook ${functionName} 失敗:`, e.message);
                return false;
            }
        } else {
            console.warn(`[Release Bot] 無法 hook ${functionName}，modApi 不可用`);
            return false;
        }
    }

    // === 設置 Hook 函數 ===
    function setupHooks() {
        // === 綁定監聽 ===
        safeHookFunction("ChatRoomLoad", 0, (args, next) => {
            next(args);
            if (!hookBound) {
                hookBound = true;

                try {
                    if (ServerSocket && typeof ServerSocket.on === 'function') {
                        // 移除舊的監聽器
                        if (socketListener) {
                            ServerSocket.off("ChatRoomMessage", socketListener);
                        }

                        // 添加新的監聽器
                        socketListener = handleMessage;
                        ServerSocket.on("ChatRoomMessage", socketListener);
                        console.log("[Release Bot] 訊息監聽器已綁定");
                    } else {
                        console.error("[Release Bot] ServerSocket 不可用");
                    }
                } catch (e) {
                    console.error("[Release Bot] 綁定訊息監聽器失敗:", e.message);
                }
            }
        });

        // === 繪製按鈕 ===
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            try {
                DrawButton(
                    btnX, btnY, size, size,
                    autoEnabled ? "🤖" : "⚙️",
                    autoEnabled ? "Orange" : "Gray", "", "自動解鎖開關"
                );
            } catch (e) {
                console.error("[Release Bot] 繪製按鈕失敗:", e.message);
            }
            next(args);
        });

        // === 點擊按鈕 ===
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            try {
                if (MouseIn(btnX, btnY, size, size)) {
                    autoEnabled = !autoEnabled;
                    sendLocalMessage(autoEnabled ? "🔓 自動救援啟用" : "🔒 自動救援停用");
                    return;
                }
            } catch (e) {
                console.error("[Release Bot] 按鈕點擊處理失敗:", e.message);
            }
            next(args);
        });
    }

    // === 等待遊戲載入 ===
    function waitForGame(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof Player !== 'undefined' &&
                    typeof ChatRoomCharacter !== 'undefined' &&
                    typeof DrawButton === 'function') {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[Release Bot] 遊戲載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // === 主初始化函數 ===
    async function initialize() {
        console.log("[Release Bot] 開始初始化...");

        try {
            // 初始化 modApi
            modApi = await initializeModApi();

            // 等待遊戲載入
            const gameLoaded = await waitForGame();
            if (!gameLoaded) {
                console.error("[Release Bot] 遊戲載入失敗");
                return;
            }

            // 設置 Hook
            setupHooks();

            // 設置卸載處理
            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("[Release Bot] 插件卸載中...");
                    if (socketListener && ServerSocket) {
                        try {
                            ServerSocket.off("ChatRoomMessage", socketListener);
                            console.log("[Release Bot] 訊息監聽器已移除");
                        } catch (e) {
                            console.error("[Release Bot] 移除監聽器失敗:", e.message);
                        }
                    }
                });
            }

            console.log("[Release Bot] 初始化完成 v1.1");

            // 如果在聊天室中，顯示載入訊息
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                sendLocalMessage("自動救援機器人已載入！");
            }

        } catch (e) {
            console.error("[Release Bot] 初始化失敗:", e.message);
        }
    }

    // === 啟動初始化 ===
    initialize();

})();
