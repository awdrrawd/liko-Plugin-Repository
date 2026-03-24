// ==UserScript==
// @name         Liko - Release Maid
// @name:zh      Liko的解綁女僕
// @namespace    https://likolisu.dev/
// @version      1.3
// @description  自動回應「救我 / 救救 / help」來解除拘束，支援指定救人，新增保存與復原功能
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';

    let modApi = null;
    const modversion = "1.3";
    let autoEnabled = false;
    let socketListener = null;
    let isInitialized = false;
    let SaveRecord = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let savedAppearances = new Map();
    let lastMessageTime = 0; // 新增：记录最后消息时间
    let listenerHealthCheck = null; // 新增：监听器健康检查定时器

    // === 按鈕座標 ===
    const btnX = 0;
    const btnY = 35;
    const size = 45;

    // === 關鍵字 ===
    const triggerWords = ["救救", "幫我", "幫幫", "帮我", "帮帮", "help", "heam", "heaf", "heap", "哈咕", "恩我", "恩呜", "救嗷", "救唔"];
    const unlockWords  = ["開鎖", "开锁", "解鎖", "解锁", "unlock"];
    const lockWords = ["上鎖", "上锁", "lock"];
    const queryWords = ["查詢", "查询", "query", "info"];
    const helpWords = ["說明", "说明", "插件教程", "插件建议", "插件建議", "插件說明", "插件说明", "其他插件", "幫助"];
    const saveWords = ["保存save"];
    const undoWords = ["復原复原undo"];

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
                version: modversion,
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

    // === 保存外觀 ===
    function saveAppearance(target) {
        if (!target || !target.MemberNumber) {
            sendLocalMessage("⚠ 無效的保存目標");
            return false;
        }
        try {
            savedAppearances.set(target.MemberNumber, JSON.stringify(ServerAppearanceBundle(target.Appearance)));
            if (SaveRecord){
                SaveRecord = false;
            } else {
                sendSystemAction(`📌 已保存 ${target.Nickname || target.Name} 的當前狀態，可用「復原 ${target.Nickname || target.Name}」復原`);
            }
            return true;
        } catch (e) {
            console.error("[Release Bot] 保存外觀失敗:", e.message);
            sendLocalMessage("⚠ 保存外觀失敗");
            return false;
        }
    }

    // === 復原外觀 ===
    function undoAppearance(target) {
        if (!target || !target.MemberNumber) {
            sendLocalMessage("⚠ 無效的復原目標");
            return;
        }
        const savedState = savedAppearances.get(target.MemberNumber);
        if (!savedState) {
            sendSystemAction(`⚠ 沒有 ${target.Nickname || target.Name} 的保存狀態，請先使用「保存 ${target.Nickname || target.Name}」`);
            return;
        }
        try {
            const bundle = JSON.parse(savedState);
            ServerAppearanceLoadFromBundle(target, target.AssetFamily, bundle, target.MemberNumber);
            ChatRoomCharacterUpdate(target);
            sendSystemAction(`♻ 已復原 ${target.Nickname || target.Name} 的狀態`);
        } catch (e) {
            console.error("[Release Bot] 復原外觀失敗:", e.message);
            sendSystemAction("⚠ 復原外觀失敗");
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
        const c = target;

        if (!c) {
            ChatRoomSendLocal("❌ 找不到目標角色。");
        } else {
            let output = `💠 ${c.Name} (${c.MemberNumber}) 的關係狀況：\n`;

            //  🎂 加入遊戲開始時間
            if (c.Creation) {
                const creationTime = new Date(c.Creation);
                output += `🎂 誕生日：${creationTime.toLocaleString()}\n`;
            }

            // 主人
            if (c.Ownership) {
                const owners = Array.isArray(c.Ownership) ? c.Ownership : [c.Ownership];
                owners.forEach(owner => {
                    const startTime = new Date(owner.Start); // UNIX 毫秒
                    const now = new Date();
                    const days = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));

                    // 主人階段：0=試用、1=認主
                    const stageLabel = owner.Stage === 0 ? "試用期" :
                    owner.Stage === 1 ? "認主" : "未知";

                    output += `👑 主人：${owner.Name} (${owner.MemberNumber})\n`;
                    output += `　${stageLabel}：${days} 天\n`;
                    output += `　開始時間：${startTime.toLocaleString()}\n`;
                });
            } else {
                output += `🚫 沒有主人\n`;
            }

            // 戀人
            if (c.Lovership && c.Lovership.length > 0) {
                c.Lovership.forEach(love => {
                    const startTime = new Date(love.Start);
                    const now = new Date();
                    const days = Math.floor((now - startTime) / (1000 * 60 * 60 * 24));

                    // 戀人階段：0=約會、1=訂婚、2=結婚
                    const stageLabel = love.Stage === 0 ? "約會" :
                    love.Stage === 1 ? "訂婚" :
                    love.Stage === 2 ? "結婚" : "未知";

                    output += `💞 戀人：${love.Name} (${love.MemberNumber})\n`;
                    output += `　${stageLabel}：${days} 天\n`;
                    output += `　開始時間：${startTime.toLocaleString()}\n`;
                });
            } else {
                output += `🚫 沒有戀人\n`;
            }

            // 難度紀錄
            if (c.Difficulty) {
                const diff = c.Difficulty;
                const lastChange = new Date(diff.LastChange);
                const now = new Date();
                const days = Math.floor((now - lastChange) / (1000 * 60 * 60 * 24));

                // 難度階段對應
                const diffLabel = diff.Level === 0 ? "角色扮演" :
                diff.Level === 1 ? "普通" :
                diff.Level === 2 ? "硬核" :
                diff.Level === 3 ? "極限" : "未知";

                output += `⚙️ 當前難度：${diffLabel}\n`;
                output += `　最後變更：${lastChange.toLocaleString()}\n`;
                output += `　維持天數：${days} 天\n`;
            }

            // 顯示在聊天
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_RELATION_INFO",
                Dictionary: [
                    {
                        Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_RELATION_INFO',
                        Text: output
                    }
                ]
            });
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
            "• 说'救我'、'救救'进行完全解放 | say 'help' Release All\n" +
            "• 说'解锁'只解开锁具 | say 'unlock' Unlock All\n" +
            "• 说'上锁'全身使用专属锁 | say 'lock' Use \n   'ExclusivePadlock' on your entire body\n" +
            "• 说'查询'查询主人&恋人时间 | say 'query' Check owner & \n   lover time\n" +
            "• 说'保存'保存当前状态 | say 'save' Save current state\n" +
            "• 说'复原'恢复保存状态 | say 'undo' Restore to saved state\n" +
            "• '救'、'查询'、'保存'、'复原'+玩家 可指定目标 |\n   'help'、'query'、'save'、'undo'+Player Specifiable objects\n" +
            "• 其他说明请转至'插件教程'、'插件建议'、'其他插件'",

            "插件教程": " 📖插件安装教程：\n" +
            "⭐以下以PC教程：\n" +
            "1. 安装油猴(tampermonkey)或暴力猴(Violentmonkey)\n" +
            "2-1. 油猴(https://www.tampermonkey.net/index.php?browser=chrome&locale=zh)\n" +
            "⚠️油猴需开启'开发者模式'(https://www.tampermonkey.net/faq.php#Q209)⚠️\n" +
            "2-2. 暴力猴(https://violentmonkey.github.io/)\n" +
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
            "未來可能會更新更多插件請詢問作者"
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
                // 在執行完全解放前保存外觀
                saveAppearance(target);
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
                : `${botName}解開了${displayName}的拘束，可用「復原 ${displayName}」復原`;

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
            // 1. 說明功能
            for (let helpWord of helpWords) {
                const helpWordLower = helpWord.toLowerCase();
                if (msg.startsWith(helpWordLower)) {
                    showHelp(helpWord);
                    return;
                }
            }

            // 2. 指定救援功能（整合自救邏輯）
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
                    SaveRecord = true;
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
                    SaveRecord = true;
                    rescue(target, "release");
                    isRescueHandled = true;
                } else if (keyword) {
                    sendSystemAction(`找不到玩家: ${keyword}`);
                }
            }

            // 自救其他 triggerWords（如果指定救援沒處理）
            if (!isRescueHandled && triggerWords.some(w => msg.includes(w))) {
                if (sender) {
                    SaveRecord = true;
                    rescue(sender, "release");
                }
                return;
            }

            // 3. 解鎖功能 - 解鎖/解锁/unlock [對象]
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

            // 4. 上鎖功能 - 上鎖/上锁/lock [對象]
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

            // 5. 查詢功能 - 查詢/查询/query [對象]
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

            // 6. 保存功能 - 保存/save [對象]
            for (let saveWord of saveWords) {
                if (msg.startsWith(saveWord.toLowerCase())) {
                    const keyword = msg.substring(saveWord.length).trim();
                    const target = keyword ? findTarget(keyword) : sender;
                    if (target) {
                        saveAppearance(target);
                    } else if (keyword) {
                        sendSystemAction(`找不到玩家: ${keyword}`);
                    }
                    return;
                }
            }

            // 7. 復原功能 - 復原/undo/還原 [對象]
            for (let undoWord of undoWords) {
                if (msg.startsWith(undoWord.toLowerCase())) {
                    const keyword = msg.substring(undoWord.length).trim();
                    const target = keyword ? findTarget(keyword) : sender;
                    if (target) {
                        undoAppearance(target);
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

    // === 改进的重新绑定监听器函数 ===
    function rebindListener() {
        try {
            if (!ServerSocket || typeof ServerSocket.on !== 'function') {
                console.warn("[Release Bot] ServerSocket 不可用，无法重新绑定");
                return false;
            }

            // 移除旧监听器（只在确实存在时才移除）
            if (socketListener) {
                try {
                    ServerSocket.off("ChatRoomMessage", socketListener);
                    console.log("[Release Bot] 旧监听器已移除");
                } catch (e) {
                    console.warn("[Release Bot] 移除旧监听器时出现警告:", e.message);
                }
            }

            // 绑定新监听器
            socketListener = (data) => {
                try {
                    lastMessageTime = Date.now(); // 更新最后消息时间
                    handleMessage(data);
                } catch (e) {
                    console.error("[Release Bot] 处理消息时发生错误:", e.message);
                    // 移除自动重试逻辑，避免频繁重绑定
                }
            };

            ServerSocket.on("ChatRoomMessage", socketListener);
            console.log("[Release Bot] 消息监听器已重新绑定");
            retryCount = 0;
            // 启动监听器健康检查
            startListenerHealthCheck();
            return true;
        } catch (e) {
            console.error("[Release Bot] 重新绑定监听器失败:", e.message);
            return false;
        }
    }

    // === 新增：监听器健康检查 ===
    function startListenerHealthCheck() {
        // 清除现有的健康检查
        if (listenerHealthCheck) {
            clearInterval(listenerHealthCheck);
        }

        // 启动新的健康检查（每30分钟检查一次）
        listenerHealthCheck = setInterval(() => {
            if (!autoEnabled || !socketListener) return;

            const now = Date.now();
            const timeSinceLastMessage = now - lastMessageTime;

            // 如果超过10分钟没有收到任何消息，且在聊天室中，可能监听器失效
            if (timeSinceLastMessage > 600000 && // 10分钟
                typeof CurrentScreen !== 'undefined' &&
                CurrentScreen === "ChatRoom" &&
                Array.isArray(ChatRoomCharacter) &&
                ChatRoomCharacter.length > 1) { // 确保聊天室有其他人

                console.warn("[Release Bot] 检测到可能的监听器失效，尝试重新绑定");
                rebindListener();
            }
        }, 30*60*1000); // 每30分钟检查一次
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

    function setupHooks() {
        safeHookFunction("ChatRoomLoad", 0, (args, next) => {
            let result;
            try {
                result = next(args);
                setTimeout(() => {
                    if (!socketListener || retryCount === 0) {
                        console.log("[Release Bot] ChatRoomLoad 触发，设置监听器");
                        rebindListener();
                    }
                }, 1000);

            } catch (e) {
                console.error("[Release Bot] ChatRoomLoad hook 错误:", e.message);
            }
            return result;
        });
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            let result;
            try {
                if (typeof DrawButton === 'function') {
                    DrawButton(
                        btnX, btnY, size, size,
                        autoEnabled ? "🤖" : "⚙️",
                        autoEnabled ? "Orange" : "Gray",
                        "", "自动解锁开关"
                    );
                }
                result = next(args);
            } catch (e) {
                console.error("[Release Bot] 绘制按钮失败:", e.message);
            }
            return result;
        });

        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            let result;
            try {
                if (typeof MouseIn === 'function' && MouseIn(btnX, btnY, size, size)) {
                    autoEnabled = !autoEnabled;

                    sendLocalMessage(autoEnabled ? "🔓 自动救援启用" : "🔒 自动救援停用");

                    if (autoEnabled && !socketListener) {
                        rebindListener();
                    } else if (!autoEnabled && listenerHealthCheck) {
                        clearInterval(listenerHealthCheck);
                        listenerHealthCheck = null;
                    }
                }
                result = next(args);
            } catch (e) {
                console.error("[Release Bot] 按钮点击处理失败:", e.message);
            }
            return result;
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

    // === 改进的健康检查函数 ===
    function healthCheck() {
        if (!autoEnabled) return;

        try {
            // 检查关键函数是否可用
            const criticalFunctions = [
                'ChatRoomCharacter', 'Player', 'ServerSocket',
                'CharacterReleaseTotal', 'InventoryUnlock', 'ServerAppearanceBundle'
            ];

            let missingFunctions = [];
            for (let funcName of criticalFunctions) {
                if (typeof window[funcName] === 'undefined') {
                    missingFunctions.push(funcName);
                }
            }

            if (missingFunctions.length > 0) {
                console.warn(`[Release Bot] 以下函数不可用: ${missingFunctions.join(', ')}`);
            }

            // 检查监听器是否正常（但不频繁重绑定）
            if (autoEnabled && !socketListener && ServerSocket) {
                console.warn("[Release Bot] 监听器丢失，尝试重新绑定");
                rebindListener();
            }
        } catch (e) {
            console.error("[Release Bot] 健康检查失败:", e.message);
        }
    }

    // === 主初始化函數 ===
    async function initialize() {
        if (isInitialized) {
            console.warn("[Release Bot] 已经初始化过了");
            return;
        }

        console.log("[Release Bot] 开始初始化...");

        try {
            modApi = await initializeModApi();
            const gameLoaded = await waitForGame();
            if (!gameLoaded) {
                console.error("[Release Bot] 游戏加载失败");
                return;
            }

            setupHooks();

            // 减少健康检查频率（为30分钟）
            setInterval(healthCheck, 30*60*1000);

            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("[Release Bot] 插件卸载中...");

                    // 清理监听器
                    if (socketListener && ServerSocket) {
                        try {
                            ServerSocket.off("ChatRoomMessage", socketListener);
                            socketListener = null;
                            console.log("[Release Bot] 消息监听器已移除");
                        } catch (e) {
                            console.error("[Release Bot] 移除监听器失败:", e.message);
                        }
                    }

                    // 清理健康检查定时器
                    if (listenerHealthCheck) {
                        clearInterval(listenerHealthCheck);
                        listenerHealthCheck = null;
                    }

                    savedAppearances.clear();
                    isInitialized = false;
                });
            }

            isInitialized = true;
            console.log(`[Release Bot] 初始化完成 v${modversion}`);

            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                sendLocalMessage("自动救援机器人已加载！输入'插件说明'查看功能");
            }

        } catch (e) {
            console.error("[Release Bot] 初始化失败:", e.message);
            isInitialized = false;
        }
    }
    // === 啟動初始化 ===
    initialize();
})();
