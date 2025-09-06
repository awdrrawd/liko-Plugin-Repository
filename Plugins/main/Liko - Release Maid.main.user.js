// ==UserScript==
// @name         Liko - Release Maid
// @name:zh      Liko的解綁女僕
// @namespace    https://likolisu.dev/
// @version      1.2
// @description  自動回應「救我 / 救救 / help」來解除拘束，支援指定救人，新增多種便利功能
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';

    let modApi = null;
    let autoEnabled = false;   // 預設關閉
    let socketListener = null; // 儲存監聽器引用
    let isInitialized = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    // === 按鈕座標 ===
    const btnX = 0;
    const btnY = 35;
    const size = 45;

    // === 關鍵字 ===
    const triggerWords = ["救救", "幫我", "幫幫", "帮我", "帮帮", "help", "heam", "heaf", "heap", "嗷呜", "哈咕", "恩我", "恩呜", "救嗷"];
    const unlockWords  = ["開鎖", "开锁", "解鎖", "解锁", "unlock"];
    const lockWords = ["上鎖", "上锁", "lock"];
    const queryWords = ["查詢", "查询", "query", "info"];
    const helpWords = ["說明", "说明", "插件教程", "插件建议", "插件建議", "插件說明", "插件说明", "其他插件", "幫助"];

    // === 等待 bcModSdk 載入 ===
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

    // === 初始化 modApi ===
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
                version: '1.2',
                repository: '莉柯莉絲的自動解鎖女僕',
            });
            console.log("✅ Liko Release Bot 註冊成功");
            return modApi;
        } catch (e) {
            console.error("[Release Bot] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }

    // === 安全的本地訊息發送 ===
    function sendLocalMessage(message) {
        try {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "ChatRoom") {
                console.log("[Release Bot]", message);
                return;
            }

            if (typeof ChatRoomMessage === 'function') {
                ChatRoomMessage({
                    Content: `<font color="#00FF00">[Release Bot] ${message}</font>`,
                    Type: "LocalMessage",
                    Sender: Player?.MemberNumber || 0
                });
            }
        } catch (e) {
            console.error("[Release Bot] 發送本地訊息錯誤:", e.message);
        }
    }

    // === 安全的系統動作訊息 ===
    function sendSystemAction(message) {
        try {
            if (typeof ServerSend !== 'function') {
                console.warn("[Release Bot] ServerSend 不可用");
                return;
            }

            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [
                    { Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: message }
                ]
            });
        } catch (e) {
            console.error("[Release Bot] 發送系統動作失敗:", e.message);
        }
    }

    // === 正規化訊息 ===
    function normalizeMessage(msg) {
        if (typeof msg !== 'string') return '';
        return msg
            .toLowerCase()
            .replace(/[-~.…。！!,?？]/g, "")
            .replace(/(.)\1{3,}/g, "$1$1")
            .trim();
    }

    // === 檢查權限 ===
    function hasPermission(target) {
        try {
            if (!target || typeof target !== 'object') return false;
            if (typeof ServerChatRoomGetAllowItem === "function") {
                return ServerChatRoomGetAllowItem(Player, target);
            }
            return true;
        } catch (e) {
            console.warn("[Release Bot] 權限檢查失敗:", e.message);
            return true;
        }
    }

    // === 解鎖函數 ===
    function UnlockAllLocks(C) {
        if (!C || !Array.isArray(C.Appearance)) {
            console.warn("[Release Bot] 無效的角色對象");
            return 0;
        }

        if (!hasPermission(C)) {
            console.warn("[Release Bot] 無權限操作角色:", C.Name);
            return 0;
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
                if (a.Property && a.Property.LockedBy && !skipLocks.includes(a.Property.LockedBy)) {
                    if (typeof InventoryUnlock === 'function') {
                        InventoryUnlock(C, a);
                        unlockedCount++;
                    }
                }
            }

            if (unlockedCount > 0 && typeof ChatRoomCharacterUpdate === 'function') {
                ChatRoomCharacterUpdate(C);
            }
        } catch (e) {
            console.error("[Release Bot] 解鎖失敗:", e.message);
        }

        return unlockedCount;
    }

    // === 上鎖函數 ===
    function lockAll(target) {
        if (!target || !Array.isArray(target.Appearance)) {
            console.warn("[Release Bot] 上鎖目標無效");
            return 0;
        }

        if (!hasPermission(target)) {
            console.warn("[Release Bot] 無權限上鎖:", target.Name);
            return 0;
        }

        try {
            let lockedCount = 0;
            for (let a of target.Appearance) {
                if (a.Asset && a.Asset.AllowLock && (!a.Property || !a.Property.LockedBy)) {
                    if (typeof InventoryLock === 'function') {
                        InventoryLock(target, a, "ExclusivePadlock", Player?.MemberNumber);
                        lockedCount++;
                    }
                }
            }

            if (lockedCount > 0 && typeof ChatRoomCharacterUpdate === 'function') {
                ChatRoomCharacterUpdate(target);
                const botName = Player?.Nickname || Player?.Name || "Bot";
                const targetName = target.Nickname || target.Name || "Unknown";
                sendSystemAction(`${botName}為${targetName}全身上鎖`);
            }

            return lockedCount;
        } catch (e) {
            console.error("[Release Bot] 上鎖失敗:", e.message);
            return 0;
        }
    }

    // === 查詢關係函數 ===
    function queryRelationship(target) {
        if (!target) {
            console.warn("[Release Bot] 查詢目標無效");
            return;
        }

        try {
            let output = `${target.Name}(${target.MemberNumber})的關係為\n`;

            // 主人
            if (target.Ownership) {
                const owners = Array.isArray(target.Ownership) ? target.Ownership : [target.Ownership];
                owners.forEach(owner => {
                    try {
                        const startDate = new Date(owner.Start);
                        const now = new Date();
                        const days = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
                        output += `主人 ${owner.Name}(${owner.MemberNumber}) 總共${days}天 起始時間 ${startDate.toLocaleString()}\n`;
                    } catch (e) {
                        output += `主人 ${owner.Name}(${owner.MemberNumber}) (日期解析錯誤)\n`;
                    }
                });
            } else {
                output += `沒有主人\n`;
            }

            // 戀人
            if (Array.isArray(target.Lovership) && target.Lovership.length > 0) {
                target.Lovership.forEach(love => {
                    try {
                        const startDate = new Date(love.Start);
                        const now = new Date();
                        const days = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
                        output += `戀人 ${love.Name}(${love.MemberNumber}) 總共${days}天 起始時間 ${startDate.toLocaleString()}\n`;
                    } catch (e) {
                        output += `戀人 ${love.Name}(${love.MemberNumber}) (日期解析錯誤)\n`;
                    }
                });
            } else {
                output += `沒有戀人\n`;
            }

            sendSystemAction(output);
        } catch (e) {
            console.error("[Release Bot] 查詢關係失敗:", e.message);
        }
    }

    // === 顯示說明信息 ===
    function showHelp(keyword = "") {
        // 根據關鍵字決定顯示哪種說明
        let helpType = "说明"; // 默認類型

        const keywordLower = keyword.toLowerCase();
        if (keywordLower === "插件教程" || keywordLower === "教程" || keywordLower === "安装" || keywordLower === "安裝") {
            helpType = "插件教程";
        } else if (keywordLower === "插件建议" || keywordLower === "插件建議" || keywordLower === "建议" || keywordLower === "建議" || keywordLower === "推荐") {
            helpType = "插件建议";
        } else if (keywordLower === "其他插件" || keywordLower === "其他" || keywordLower === "更多") {
            helpType = "其他插件";
        } else if (keywordLower === "說明" || keywordLower === "说明" || keywordLower === "help" || keywordLower === "幫助") {
            helpType = "说明";
        }

        const helpTexts = {
            "说明": "🧹 莉柯女仆教程 | Liko release maid illustrate\n" +
            "1. 说'救我'、'救救'进行完全解放 | say 'help' Release All\n" +
            "2. 说'解锁'只解开锁具 | say 'unlock' Unlock All\n" +
            "3. 说'上锁'全身使用专属锁 | say 'lock' Use \n    'ExclusivePadlock' on your entire body\n" +
            "4. 说'查询'查询主人&恋人时间 | say 'query'Check owner & \n    lover time\n" +
            "5. '救'、'查询'+玩家 可指定目标 | 'help'、'query'+Player \n    Specifiable objects\n" +
            "6. 其他说明请转至'插件教程'、'插件建议'、'其他插件'",

            "插件教程": " 📖插件安装教程：\n" +
            "⭐以下以PC教程：\n" +
            "1. 安装 油猴(tampermonkey)或 暴力猴(Violentmonkey)\n" +
            "2-1. 油猴网址(https://www.tampermonkey.net/index.php?browser=chrome&locale=zh)\n" +
            "⚠️油猴需开启'开发者模式[](https://www.tampermonkey.net/faq.php#Q209)⚠️\n" +
            "2-2. 暴力猴网址(https://violentmonkey.github.io/)\n" +
            "3. 安装FUSAM插件(https://wce.netlify.app/wce-fusam-loader.user.js)\n" +
            "4. 刷新游戏后上方会出现[插件管理器]或[addon manager]进去设定插件集\n" +
            "手机的安装请找支援插件的浏览器，安卓考虑VIA，苹果建议Userscripts\n" +
            "详细的查件资讯请输入[插件建议]",

            "插件建议": "📚 插件建议：\n" +
            "• 建议启用：[WCE]、[BCX]、[LSCG]、[Eli 的束缚俱乐部助手 (EBCH)]\n" +
            "• 考虑启用：[MBCHC]、[NotifyPlus]、[Responsive(Legacy)]、[MBS]、[BCT]、[ULTRA]\n" +
            "• 建议独立安装：[服装拓展]、[动作拓展]、[动作拓展以及其他易用性功能]\n" +
            "⚠️不建议安装：[Maple 的 BC 癖好分享(个人资料拓展)]、[XTOY]、[ABCL]\n" +
            "⭐动作扩展(https://sugarchain-studio.github.io/echo-activity-ext/bc-activity.user.js)\n" +
            "⭐服装扩展(https://sugarchain-studio.github.io/echo-clothing-ext/bc-cloth.user.js)\n" +
            "⭐小酥的动作拓展(https://iceriny.github.io/XiaoSuActivity/main/userLoad.user.js)\n" +
            "⭐由于读取问题，拓展系列的插件建议独立安装，或是登入游戏时稍等一下\n" +
            "⭐不建议安装的项目是因为体验较差、还有冲突问题，除非你有需求",

            "其他插件": "🧰 莉柯莉絲(192263)寫的其他插件：\n" +
            "CHE可以把信息转HTML、Image Uploader可以用拖曳图片到聊天室分享图片\n" +
            "• CHE(https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-CHE.user.js)\n" +
            "• Image Uploader(https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Image_Uploader.user.js)\n" +
            "未来可能会更新更多插件请询问作者"
        };

        const helpText = helpTexts[helpType];
        if (helpText) {
            sendSystemAction(helpText);
        } else {
            console.warn("[Release Bot] 未知的說明類型:", helpType);
        }
    }

    // === 救援函數 ===
    function rescue(target, mode = "release") {
        if (!target || typeof target !== 'object') {
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
                if (typeof CharacterReleaseTotal === 'function') {
                    CharacterReleaseTotal(target);
                    success = true;
                    if (typeof ChatRoomCharacterUpdate === 'function') {
                        ChatRoomCharacterUpdate(target);
                    }
                }
            }

            if (success) {
                const botName = Player?.Nickname || Player?.Name || "Bot";
                const displayName = target.Nickname || target.Name || "Unknown";
                const systemMessage = mode === "unlock"
                    ? `${botName}解開了${displayName}的鎖`
                    : `${botName}解開了${displayName}的拘束`;

                sendSystemAction(systemMessage);
                console.log(`[Release Bot] 救援成功: ${displayName} (${mode})`);
            }
        } catch (e) {
            console.error("[Release Bot] 救援操作失敗:", e.message);
        }
    }

    // === 尋找目標角色 ===
    function findTarget(keyword) {
        if (!keyword || !Array.isArray(ChatRoomCharacter)) return null;

        try {
            // 按ID搜尋
            if (/^\d+$/.test(keyword)) {
                const id = parseInt(keyword);
                return ChatRoomCharacter.find(c => c?.MemberNumber === id);
            }
            // 按名稱搜尋
            const lowerKeyword = keyword.toLowerCase();
            return ChatRoomCharacter.find(c =>
                c?.Nickname?.toLowerCase() === lowerKeyword ||
                c?.Name?.toLowerCase() === lowerKeyword
            );
        } catch (e) {
            console.error("[Release Bot] 尋找目標失敗:", e.message);
            return null;
        }
    }

    // === 訊息處理函數（核心邏輯） ===
    function handleMessage(data) {
        // 檢查基本條件
        if (!autoEnabled || !data || typeof data !== 'object') {
            return;
        }

        if ((data.Type !== "Chat" && data.Type !== "Emote") || typeof data.Content !== "string") {
            return;
        }

        const rawMsg = data.Content.trim();
        if (!rawMsg) return;

        const msg = normalizeMessage(rawMsg);
        if (!msg) return;

        const senderID = data.Sender;
        let sender = null;

        try {
            if (Array.isArray(ChatRoomCharacter)) {
                sender = ChatRoomCharacter.find(c => c?.MemberNumber === senderID);
            }
        } catch (e) {
            console.error("[Release Bot] 尋找發送者失敗:", e.message);
            return;
        }

        // 處理不同類型的指令
        try {
            // 2. 說明功能 - 只在訊息開頭匹配 helpWords 時觸發
            for (let helpWord of helpWords) {
                const helpWordLower = helpWord.toLowerCase();
                if (msg.startsWith(helpWordLower)) {
                    showHelp(helpWord);
                    return; // 處理完說明後直接返回
                }
            }

            // 以下為原有的救援、上鎖、解鎖、查詢邏輯，保持不變
            // 3. 指定救援功能（整合自救邏輯）
            let isRescueHandled = false;
            if (msg.startsWith("救")) {
                const keyword = msg.substring(1).trim();
                let target = null;
                if (keyword === "" || keyword === "我" || keyword === "救") {
                    target = sender;
                } else {
                    target = findTarget(keyword);
                }
                if (target) {
                    rescue(target, "release");
                    isRescueHandled = true;
                } else if (keyword) {
                    sendSystemAction(`找不到玩家: ${keyword}`);
                }
            } else if (msg.startsWith("help")) {
                const keyword = msg.substring(4).trim();
                let target = null;
                if (keyword === "" || keyword === "me") {
                    target = sender;
                } else {
                    target = findTarget(keyword);
                }
                if (target) {
                    rescue(target, "release");
                    isRescueHandled = true;
                } else if (keyword) {
                    sendSystemAction(`找不到玩家: ${keyword}`);
                }
            }

            // 自救其他 triggerWords（如果指定救援沒處理）
            if (!isRescueHandled && triggerWords.some(w => msg.includes(w))) {
                if (sender) {
                    rescue(sender, "release");
                }
                return;
            }

            // 4. 解鎖功能 - 解鎖/解锁/unlock [對象]
            for (let unlockWord of unlockWords) {
                if (msg.startsWith(unlockWord.toLowerCase())) {
                    const keyword = msg.substring(unlockWord.length).trim();
                    const target = keyword ? findTarget(keyword) : sender;
                    if (target) {
                        rescue(target, "unlock");
                    } else if (keyword) {
                        sendSystemAction(`找不到玩家: ${keyword}`);
                    }
                    return;
                }
            }

            // 5. 上鎖功能 - 上鎖/上锁/lock [對象]
            for (let lockWord of lockWords) {
                if (msg.startsWith(lockWord.toLowerCase())) {
                    const keyword = msg.substring(lockWord.length).trim();
                    const target = keyword ? findTarget(keyword) : sender;
                    if (target) {
                        lockAll(target);
                    } else if (keyword) {
                        sendSystemAction(`找不到玩家: ${keyword}`);
                    }
                    return;
                }
            }

            // 6. 查詢功能 - 查詢/查询/query [對象]
            for (let queryWord of queryWords) {
                if (msg.startsWith(queryWord.toLowerCase())) {
                    const keyword = msg.substring(queryWord.length).trim();
                    const target = keyword ? findTarget(keyword) : sender;
                    if (target) {
                        queryRelationship(target);
                    } else if (keyword) {
                        sendSystemAction(`找不到玩家: ${keyword}`);
                    }
                    return;
                }
            }

        } catch (e) {
            console.error("[Release Bot] 訊息處理錯誤:", e.message);
        }
    }
    // === 重新綁定監聽器 ===
    function rebindListener() {
        try {
            if (!ServerSocket || typeof ServerSocket.on !== 'function') {
                console.warn("[Release Bot] ServerSocket 不可用，無法重新綁定");
                return false;
            }

            // 移除舊監聽器
            if (socketListener) {
                ServerSocket.off("ChatRoomMessage", socketListener);
                console.log("[Release Bot] 舊監聽器已移除");
            }

            // 綁定新監聽器
            socketListener = (data) => {
                try {
                    handleMessage(data);
                } catch (e) {
                    console.error("[Release Bot] 處理訊息時發生錯誤:", e.message);
                    // 嘗試重新綁定監聽器
                    if (retryCount < MAX_RETRIES) {
                        retryCount++;
                        console.log(`[Release Bot] 嘗試重新綁定監聽器 (${retryCount}/${MAX_RETRIES})`);
                        setTimeout(rebindListener, 1000);
                    }
                }
            };

            ServerSocket.on("ChatRoomMessage", socketListener);
            console.log("[Release Bot] 訊息監聽器已重新綁定");
            retryCount = 0; // 重置重試計數
            return true;
        } catch (e) {
            console.error("[Release Bot] 重新綁定監聽器失敗:", e.message);
            return false;
        }
    }

    // === 安全的 Hook 函數 ===
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

    // === 設置 Hook ===
    function setupHooks() {
        // ChatRoom 載入時重新綁定監聽器
        safeHookFunction("ChatRoomLoad", 0, (args, next) => {
            try {
                next(args);

                // 延遲綁定以確保 ServerSocket 已準備好
                setTimeout(() => {
                    rebindListener();
                }, 1000);

            } catch (e) {
                console.error("[Release Bot] ChatRoomLoad hook 錯誤:", e.message);
            }
        });

        // 繪製按鈕
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            try {
                if (typeof DrawButton === 'function') {
                    DrawButton(
                        btnX, btnY, size, size,
                        autoEnabled ? "🤖" : "⚙️",
                        autoEnabled ? "Orange" : "Gray",
                        "", "自動解鎖開關"
                    );
                }
            } catch (e) {
                console.error("[Release Bot] 繪製按鈕失敗:", e.message);
            }
            next(args);
        });

        // 處理按鈕點擊
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            try {
                if (typeof MouseIn === 'function' && MouseIn(btnX, btnY, size, size)) {
                    autoEnabled = !autoEnabled;
                    sendLocalMessage(autoEnabled ? "🔓 自動救援啟用" : "🔒 自動救援停用");

                    // 如果啟用自動功能，檢查監聽器狀態
                    if (autoEnabled && !socketListener) {
                        rebindListener();
                    }
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
                try {
                    if (typeof Player !== 'undefined' &&
                        typeof ChatRoomCharacter !== 'undefined' &&
                        typeof DrawButton === 'function' &&
                        typeof MouseIn === 'function') {
                        resolve(true);
                    } else if (Date.now() - start > timeout) {
                        console.error("[Release Bot] 遊戲載入超時");
                        resolve(false);
                    } else {
                        setTimeout(check, 100);
                    }
                } catch (e) {
                    console.error("[Release Bot] 等待遊戲載入時出錯:", e.message);
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // === 健康檢查 ===
    function healthCheck() {
        if (!autoEnabled) return;

        try {
            // 檢查監聽器是否還有效
            if (!socketListener && autoEnabled) {
                console.warn("[Release Bot] 監聽器遺失，嘗試重新綁定");
                rebindListener();
            }

            // 檢查關鍵函數是否可用
            const criticalFunctions = [
                'ChatRoomCharacter', 'Player', 'ServerSocket',
                'CharacterReleaseTotal', 'InventoryUnlock'
            ];

            for (let funcName of criticalFunctions) {
                if (typeof window[funcName] === 'undefined') {
                    console.warn(`[Release Bot] ${funcName} 不可用`);
                }
            }
        } catch (e) {
            console.error("[Release Bot] 健康檢查失敗:", e.message);
        }
    }

    // === 主初始化函數 ===
    async function initialize() {
        if (isInitialized) {
            console.warn("[Release Bot] 已經初始化過了");
            return;
        }

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

            // 設置定期健康檢查
            setInterval(healthCheck, 30000); // 每30秒檢查一次

            // 設置卸載處理
            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("[Release Bot] 插件卸載中...");
                    if (socketListener && ServerSocket) {
                        try {
                            ServerSocket.off("ChatRoomMessage", socketListener);
                            socketListener = null;
                            console.log("[Release Bot] 訊息監聽器已移除");
                        } catch (e) {
                            console.error("[Release Bot] 移除監聽器失敗:", e.message);
                        }
                    }
                    isInitialized = false;
                });
            }

            isInitialized = true;
            console.log("[Release Bot] 初始化完成 v1.2");

            // 顯示載入訊息
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                sendLocalMessage("自動救援機器人已載入！輸入'插件說明'查看功能");
            }

        } catch (e) {
            console.error("[Release Bot] 初始化失敗:", e.message);
            isInitialized = false;
        }
    }

    // === 啟動初始化 ===
    initialize();

})();
