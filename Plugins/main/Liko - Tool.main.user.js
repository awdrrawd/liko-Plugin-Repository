// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      1.13
// @description  Bondage Club - Likolisu's tool with BCC-inspired features
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function() {
    let modApi = null;
    const modversion = "1.13";
    // 等待 bcModSdk 載入的函數
    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[LT] bcModSdk 載入超時");
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
            console.error("[LT] ❌ bcModSdk 無法載入，插件將以兼容模式運行");
            return null;
        }

        try {
            modApi = bcModSdk.registerMod({
                name: "Liko's tool",
                fullName: 'Likolisu\'s tool with BCC-inspired features',
                version: modversion,
                repository: '莉柯莉絲的工具包'
            });
            console.log("[LT] ✅ Liko-tool 腳本啟動完成");
            return modApi;
        } catch (e) {
            console.error("[LT] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }
    // 載入樣式化訊息系統
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) {
                resolve();
                return;
            }
            const version = GM_info.script.version;
            const toastUrl = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js`;
            const script = document.createElement('script');
            script.src = toastUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    // RP 模式按鈕座標
    const rpBtnX = 955;
    const rpBtnY = 855;
    const rpBtnSize = 45;

    // 初始化儲存
    function initializeStorage() {
        console.log("[LT] 初始化儲存...");
        if (!Player.LikoTool) {
            Player.LikoTool = {
                rpmode: false,
                bypassActivities: false // bypassactivities 狀態
            };
            console.log("[LT] 儲存已初始化:", Player.LikoTool);
        } else {
            console.log("[LT] 儲存已存在:", Player.LikoTool);
        }
    }

    // 工具函數
    function ChatRoomSendLocal(message , sec = 0) {
        console.log(`[LT] 嘗試發送本地訊息: ${message}`);
        if (CurrentScreen !== "ChatRoom") {
            console.warn("[LT] 不在聊天室，訊息可能不顯示");
            return;
        }
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#FF69B4">[LT] ${message}</font>`,
                Timeout: sec
            });
            console.log("[LT] 訊息通過 ChatRoomMessage 發送成功");
        } catch (e) {
            console.error("[LT] 發送本地訊息錯誤:", e.message);
            try {
                ServerSend("ChatRoomChat", { Content: `[LT] ${message}`, Type: "LocalMessage" ,Time:sec});
                console.log("[LT] 嘗試通過 ServerSend 發送訊息");
            } catch (e2) {
                console.error("[LT] ServerSend 失敗:", e2.message);
                console.log("[LT] 最終錯誤訊息: 本地訊息發送失敗，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！");
            }
        }
    }

    function getPlayer(identifier) {
        if (!identifier || identifier.trim() === "") return Player;
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            return ChatRoomCharacter?.find(c => c.MemberNumber === parseInt(identifier)) || Player;
        } else if (typeof identifier === "string") {
            return ChatRoomCharacter?.find(c =>
                                           c.Name.toLowerCase() === identifier.toLowerCase() ||
                                           c.Nickname?.toLowerCase() === identifier.toLowerCase() ||
                                           c.AccountName.toLowerCase() === identifier.toLowerCase()
                                          ) || Player;
        }
        return Player;
    }

    function getNickname(character) {
        return character?.Nickname || character?.Name || character?.AccountName || "未知";
    }

    function chatSendCustomAction(message) {
        if (CurrentScreen !== "ChatRoom") {
            console.log("[LT] 不在聊天室，跳過自訂動作");
            return;
        }
        try {
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: message }]
            });
            console.log("[LT] 自訂動作發送:", message);
        } catch (e) {
            console.error("[LT] 自訂動作發送錯誤:", e.message);
            ChatRoomSendLocal("自訂動作發送失敗，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！");
        }
    }

    function hasBCItemPermission(target) {
        if (Player.LikoTool.bypassActivities) {
            console.log("[LT] bypassActivities 啟用，繞過權限檢查");
            return true;
        }
        const allow = typeof ServerChatRoomGetAllowItem === "function" ? ServerChatRoomGetAllowItem(Player, target) : true;
        console.log("[LT] hasBCItemPermission:", { target: getNickname(target), allow });
        return allow;
    }

    async function requestInput(prompt) {
        return new Promise(resolve => {
            const result = window.prompt(prompt);
            resolve(result === null ? false : result);
        });
    }

    async function requestButtons(prompt, width, height, buttons, multiSelect = false) {
        return new Promise(resolve => {
            const container = document.createElement("div");
            container.style = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #1a1a1a; color: #ffffff; padding: 20px; z-index: 1000;
                width: ${width}px; height: ${height}px; overflow: auto;
                border: 2px solid #444; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.5);
                display: flex; flex-direction: column;
            `;
            const promptDiv = document.createElement("div");
            promptDiv.innerText = prompt;
            promptDiv.style = "margin-bottom: 15px; font-size: 18px; text-align: center;";
            container.appendChild(promptDiv);

            const closeButton = document.createElement("button");
            closeButton.innerText = "X";
            closeButton.style = `
                position: absolute; top: 10px; right: 10px; width: 30px; height: 30px;
                background: #ff4444; color: #ffffff; border: none; border-radius: 5px;
                font-size: 16px; cursor: pointer;
            `;
            closeButton.onclick = () => {
                document.body.removeChild(container);
                resolve(multiSelect ? [] : null);
            };
            container.appendChild(closeButton);

            const buttonContainer = document.createElement("div");
            buttonContainer.style = "flex-grow: 1; overflow-y: auto; margin-bottom: 10px;";
            let selected = [];
            buttons.forEach(btn => {
                const button = document.createElement("button");
                button.innerText = btn.text;
                button.style = `
                    margin: 5px; padding: 10px 20px; font-size: ${btn.fontSize || '16px'};
                    background: #333; color: #ffffff; border: 1px solid #555;
                    border-radius: 5px; cursor: pointer; width: 90%; text-align: left;
                `;
                button.onmouseover = () => button.style.background = selected.includes(btn.text) ? "#00ff00" : "#FFA500";
                button.onmouseout = () => button.style.background = selected.includes(btn.text) ? "#00ff00" : "#333";
                button.onclick = () => {
                    if (multiSelect) {
                        if (selected.includes(btn.text)) {
                            selected = selected.filter(s => s !== btn.text);
                            button.style.background = "#333";
                        } else {
                            selected.push(btn.text);
                            button.style.background = "#00ff00";
                        }
                    } else {
                        document.body.removeChild(container);
                        resolve(btn.text);
                    }
                };
                if (btn.preview) {
                    const canvas = document.createElement("canvas");
                    canvas.width = 100;
                    canvas.height = 200;
                    canvas.style = "margin: 5px; vertical-align: middle;";
                    try {
                        DrawCharacter(btn.preview, 0, 0, 0.2, false, canvas.getContext("2d"));
                    } catch (e) {
                        console.error("[LT] 預覽渲染錯誤:", e.message);
                    }
                    button.prepend(canvas);
                }
                buttonContainer.appendChild(button);
            });
            container.appendChild(buttonContainer);

            if (multiSelect) {
                const confirmButton = document.createElement("button");
                confirmButton.innerText = "確認";
                confirmButton.style = `
                    padding: 10px 20px; font-size: 16px;
                    background: #50C878; color: #ffffff; border: none;
                    border-radius: 5px; cursor: pointer; width: 90%; align-self: center;
                `;
                confirmButton.onclick = () => {
                    document.body.removeChild(container);
                    resolve(selected);
                };
                container.appendChild(confirmButton);
            }

            document.body.appendChild(container);

            const handleKeydown = (e) => {
                if (e.key === "Escape") {
                    document.body.removeChild(container);
                    resolve(multiSelect ? [] : null);
                    document.removeEventListener("keydown", handleKeydown);
                }
            };
            document.addEventListener("keydown", handleKeydown);
        });
    }

    // 安全的 hook 函數包裝器
    function safeHookFunction(functionName, priority, callback) {
        if (modApi && typeof modApi.hookFunction === 'function') {
            try {
                return modApi.hookFunction(functionName, priority, callback);
            } catch (e) {
                console.error(`[LT] Hook ${functionName} 失敗:`, e.message);
            }
        } else {
            console.warn(`[LT] 無法 hook ${functionName}，modApi 不可用`);
        }
    }

    // 備用的函數覆蓋方案
    function fallbackHookFunction(functionName, callback) {
        if (typeof window[functionName] === 'function') {
            const originalFunction = window[functionName];
            window[functionName] = function(...args) {
                return callback(args, () => originalFunction.apply(this, args));
            };
        }
    }

    // 鉤子設置函數
    function setupHooks() {
        // 鉤子：ServerSend（RP模式）
        safeHookFunction("ServerSend", 20, (args, next) => {
            if (!Player.LikoTool?.rpmode || CurrentScreen !== "ChatRoom") {
                return next(args);
            }
            const [messageType, data] = args;
            if (messageType === "ChatRoomChat" && data.Type === "Action") {
                console.log("[LT] RP模式：抑制動作訊息");
                return;
            }
            return next(args);
        });

        // 鉤子：ChatRoomCharacterViewDrawOverlay（顯示RP標誌）
        safeHookFunction("ChatRoomCharacterViewDrawOverlay", 10, (args, next) => {
            next(args);
            const [C, CharX, CharY, Zoom] = args;
            let likoData;
            if (C.IsPlayer()) {
                likoData = Player.LikoTool;
            } else if (C.LikoTool) {
                likoData = C.LikoTool;
            } else {
                return;
            }
            if (likoData?.rpmode) {
                let y = 40;
                if (C.IsKneeling()) y = 300;
                DrawImageResize(
                    "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/likorp.png",
                    CharX + 340 * Zoom,
                    CharY + y * Zoom,
                    45 * Zoom,
                    50 * Zoom
                );
            }
        });

        // 鉤子：ChatRoomMenuDraw（繪製RP模式按鈕）
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            if (!Player.LikoTool) initializeStorage();
            DrawButton(
                rpBtnX, rpBtnY, rpBtnSize, rpBtnSize,
                "🔰",
                Player.LikoTool.rpmode ? "Orange" : "Gray",
                "",
                "RP模式切換"
            );
            next(args);
        });

        // 鉤子：ChatRoomClick（處理RP模式按鈕點擊）
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            if (!Player.LikoTool) initializeStorage();
            if (MouseIn(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize)) {
                Player.LikoTool.rpmode = !Player.LikoTool.rpmode;
                ChatRoomSendLocalStyled(Player.LikoTool.rpmode ? "🔰 RP模式启用" : "🔰 RP模式停用", 3000);
                // 新增：发送RP状态
                if (CurrentScreen === "ChatRoom") {
                    try {
                        ServerSend("ChatRoomChat", {
                            Type: "Hidden",
                            Content: `LIKO_RP_${Player.LikoTool.rpmode}`
                        });
                        console.log(`[LT] 广播 RP 状态: ${Player.LikoTool.rpmode}`);
                    } catch (e) {
                        console.error("[LT] 发送RP状态失败:", e.message);
                    }
                }
                return;
            }
            next(args);
        });
        // 新增：监听聊天消息来同步RP状态
        safeHookFunction("ChatRoomMessage", 5, (args, next) => {
            const [data] = args;
            // 检查是否为 Liko Tool RP 状态消息
            if (data.Type === "Hidden" &&
                data.Content &&
                data.Content.startsWith("LIKO_RP_")) {
                const character = ChatRoomCharacter.find(c => c.MemberNumber === data.Sender);
                if (character && character.MemberNumber !== Player.MemberNumber) {
                    // 初始化 LikoTool 对象（如果不存在）
                    if (!character.LikoTool) {
                        character.LikoTool = {};
                    }
                    // 更新RP状态
                    character.LikoTool.rpmode = data.Content === "LIKO_RP_true";
                    console.log(`[LT] 更新 ${character.Name} 的 RP 状态为: ${character.LikoTool.rpmode}`);
                }
                return;// 阻止显示这个隐藏消息
            }
            return next(args);
        });
    }
    // 进入房间时广播自己的RP状态
    function broadcastRpStatus() {
        if (CurrentScreen === "ChatRoom" && Player.LikoTool?.rpmode) {
            try {
                ServerSend("ChatRoomChat", {
                    Type: "Hidden",
                    Content: `LIKO_RP_${Player.LikoTool.rpmode}`
                });
                console.log("[LT] 进入房间时广播 RP 状态");
            } catch (e) {
                console.error("[LT] 广播RP状态失败:", e.message);
            }
        }
    }
    // 命令實現
    function freetotal(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。請檢查 BCX 或 ULTRAbc 權限設置！`);
            return;
        }
        try {
            CharacterReleaseTotal(target);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 完全解除了 ${getNickname(target)} 的所有束縛！`);
        } catch (e) {
            console.error("[LT] freetotal 錯誤:", e.message);
            ChatRoomSendLocal(`無法解除束縛，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    async function free(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。請檢查 BCX 或 ULTRAbc 權限設置！`);
            return;
        }
        const restraints = [];
        for (let group of AssetGroup) {
            if (group.Name.startsWith("Item")) {
                const item = InventoryGet(target, group.Name);
                if (item) {
                    const lock = item.Property?.LockedBy ? `🔒${item.Property.LockedBy}` : "";
                    const password = item.Property?.Password || item.Property?.CombinationNumber || "";
                    const itemName = item.Craft?.Name || item.Asset?.Description || item.Asset?.Name || '未知物品';
                    const displayText = `${lock ? lock + " " : ""}${itemName} (${group.Description}${password ? `, 密碼: ${password}` : ""})`;
                    restraints.push({
                        text: displayText,
                        fontSize: "16px",
                        group: group.Name,
                        //preview: target // 為按鈕添加角色預覽
                    });
                }
            }
        }
        if (!restraints.length) {
            ChatRoomSendLocal(`${getNickname(target)} 沒有束縛物品！`);
            return;
        }
        const selected = await requestButtons(`選擇要移除的 ${getNickname(target)} 的束縛`, 400, 500, restraints, true);
        if (!selected.length) return;
        try {
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (group) InventoryRemove(target, group);
            });
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 解除了 ${getNickname(target)} 的 ${selected.join("、")}`);
        } catch (e) {
            console.error("[LT] free 錯誤:", e.message);
            ChatRoomSendLocal(`無法移除束縛，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    async function bcxImport(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。請檢查 BCX 或 ULTRAbc 權限設置！`);
            return;
        }
        let bcxCode;
        try {
            bcxCode = await navigator.clipboard.readText();
        } catch (e) {
            console.error("[LT] bcxImport 錯誤:", e.message);
            ChatRoomSendLocal(`無法讀取剪貼簿，請確認權限！`);
            return;
        }
        try {
            const appearance = JSON.parse(LZString.decompressFromBase64(bcxCode));
            if (!Array.isArray(appearance)) {
                throw new Error("無效的外觀數據：必須為陣列");
            }
            ServerAppearanceLoadFromBundle(target, target.AssetFamily, appearance, Player.MemberNumber);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 為 ${getNickname(target)} 導入了 BCX 外觀！`);
        } catch (e) {
            console.error("[LT] bcxImport 錯誤:", e.message);
            ChatRoomSendLocal(`無效的 BCX 代碼，請檢查剪貼簿內容！`);
        }
    }

    function rpmode(args) {
        if (!Player.LikoTool) initializeStorage();
        Player.LikoTool.rpmode = !Player.LikoTool.rpmode;
        ChatRoomSendLocal(`RP模式已 ${Player.LikoTool.rpmode ? "开启" : "关闭"}！`);

        // 新增：发送RP状态给房间内其他人
        if (CurrentScreen === "ChatRoom") {
            try {
                ServerSend("ChatRoomChat", {
                    Type: "Hidden",
                    Content: `LIKO_RP_${Player.LikoTool.rpmode}`
                });
                console.log(`[LT] 广播 RP 状态: ${Player.LikoTool.rpmode}`);
            } catch (e) {
                console.error("[LT] 发送RP状态失败:", e.message);
            }
        }
    }

    function fullUnlock(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。請檢查 BCX 或 ULTRAbc 權限設置！`);
            return;
        }
        try {
            const skipLocks = ["OwnerPadlock", "OwnerTimerPadlock", "LoversPadlock", "LoversTimerPadlock"];
            let unlockedCount = 0;
            for (let a of target.Appearance) {
                if (a.Property && a.Property.LockedBy && !skipLocks.includes(a.Property.LockedBy)) {
                    InventoryUnlock(target, a);
                    unlockedCount++;
                }
            }
            if (unlockedCount === 0) {
                ChatRoomSendLocal(`${getNickname(target)} 沒有可移除的鎖！`);
                return;
            }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 移除了 ${getNickname(target)} 的所有鎖！`);
        } catch (e) {
            console.error("[LT] fullUnlock 錯誤:", e.message);
            ChatRoomSendLocal(`無法移除鎖，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    async function getEverything(args) {
        if (!Player.LikoTool) initializeStorage();
        const options = [
            { text: "獲得所有道具", fontSize: "16px" },
            { text: "設置金錢為 999,999", fontSize: "16px" },
            { text: "所有技能升至 10 級", fontSize: "16px" }
        ];
        const selected = await requestButtons("選擇增強功能", 300, 400, options, true);
        if (!selected.length) return;

        try {
            if (selected.includes("獲得所有道具")) {
                const ids = [];
                AssetFemale3DCG.forEach(group => {
                    group.Asset.forEach(item => {
                        if (item.Name && !Player.Inventory.some(inv => inv.Name === item.Name && inv.Group === group.Group) && item.InventoryID) {
                            InventoryAdd(Player, item.Name, group.Group, false);
                            ids.push(item.InventoryID);
                        }
                    });
                });
                ServerPlayerInventorySync();
                ChatRoomSendLocal(`已添加 ${ids.length} 個新物品到您的背包！`);
            }
            if (selected.includes("設置金錢為 999,999")) {
                Player.Money = 999999;
                ServerPlayerSync();
                ChatRoomSendLocal(`金錢已設置為 999,999！`);
            }
            if (selected.includes("所有技能升至 10 級")) {
                const skills = [
                    "LockPicking", "Evasion", "Willpower", "Bondage",
                    "SelfBondage", "Dressage", "Infiltration"
                ];
                skills.forEach(skill => SkillChange(Player, skill, 10, 0, true));
                ChatRoomSendLocal(`所有技能已升至 10 級！`);
            }
        } catch (e) {
            console.error("[LT] getEverything 錯誤:", e.message);
            ChatRoomSendLocal(`無法執行增強功能，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    function wardrobe(args) {
        if (!Player.LikoTool) initializeStorage();
        try {
            ChatRoomAppearanceLoadCharacter(Player);
            ChatRoomSendLocal(`已開啟衣櫃！`);
        } catch (e) {
            console.error("[LT] wardrobe 錯誤:", e.message);
            ChatRoomSendLocal(`無法開啟衣櫃，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    function fullLock(args) {
        if (!Player.LikoTool) initializeStorage();
        const params = args.trim().split(/\s+/);
        const targetIdentifier = params[0] || "";
        const lockName = params[1] || "";
        const target = getPlayer(targetIdentifier);

        if (target === Player && !targetIdentifier) {
            ChatRoomSendLocal(`請指定目標（例如 /lt fulllock [目標] [鎖名稱]）！`);
            return;
        }
        if (!ChatRoomCharacter?.find(c => c.MemberNumber === target.MemberNumber)) {
            ChatRoomSendLocal(`目標 ${getNickname(target)} 不在房間內！`);
            return;
        }
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。請檢查 BCX 或 ULTRAbc 權限設置！`);
            return;
        }

        const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
        if (!itemMiscGroup) {
            ChatRoomSendLocal(`無法獲取 ItemMisc 群組，請檢查遊戲版本！`);
            return;
        }
        const validLocks = itemMiscGroup.Asset.filter(asset => asset.IsLock).map(asset => ({
            Name: asset.Name,
            Description: asset.Description || asset.Name
        }));
        const lock = validLocks.find(l => l.Name.toLowerCase() === lockName.toLowerCase() || l.Description.toLowerCase() === lockName.toLowerCase());
        if (!lock) {
            const lockList = validLocks.map(l => l.Description).join("、");
            ChatRoomSendLocal(`無效的鎖名稱：${lockName}。\n可用鎖：${lockList}`);
            return;
        }

        try {
            let lockedCount = 0;
            for (let a of target.Appearance) {
                if (a.Asset?.IsRestraint && !a.Property?.LockedBy) {
                    InventoryLock(target, a, { Asset: AssetGet(Player.AssetFamily, "ItemMisc", lock.Name) }, Player.MemberNumber);
                    lockedCount++;
                }
            }
            if (lockedCount === 0) {
                ChatRoomSendLocal(`${getNickname(target)} 沒有可鎖定的束縛！`);
                return;
            }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 為 ${getNickname(target)} 的 ${lockedCount} 個束縛添加了 ${lock.Description} 鎖！`);
        } catch (e) {
            console.error("[LT] fullLock 錯誤:", e.message);
            ChatRoomSendLocal(`無法添加鎖，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }
    }

    // 命令處理
    function handleLtCommand(text) {
        if (!Player.LikoTool) initializeStorage();
        console.log("[LT] 執行命令: /lt " + text);
        const args = text.trim().split(/\s+/);
        const subCommand = args[0]?.toLowerCase() || "";
        const commandText = args.slice(1).join(" ");

        if (!subCommand || subCommand === "help") {
            ChatRoomSendLocal(
                `莉柯莉絲工具使用說明書\n\n` +
                `歡迎使用莉柯莉絲工具！這是一個多功能的 Bondage Club 輔助工具，提供多項實用功能。\n\n` +
                `可用指令列表：\n` +
                `/lt help - 顯示此說明書\n` +
                `/lt free [目標] - 移除自己或目標的指定束縛\n` +
                `/lt freetotal [目標] - 移除自己或目標的所有束縛\n` +
                `/lt bcximport [目標] - 從剪貼簿導入 BCX 外觀到自己或目標\n` +
                `/lt fullunlock [目標] - 移除自己或目標的所有鎖\n` +
                `/lt fulllock [目標] [鎖名稱] - 為目標的所有束縛添加指定鎖\n`+
                `/lt rpmode - 切換RP模式（隱藏聊天室綑綁類訊息）\n` +
                `/lt geteverything - 開啟增強功能管理（道具、金錢、技能）\n` +
                `/lt wardrobe - 開啟衣櫃\n\n` +
                `提示：可點擊聊天室右下角的 🔰 按鈕快速切換 RP 模式！\n` +
                `感謝使用莉柯莉絲工具！ ❤️`
            );
            return;
        }

        const commands = {
            freetotal,
            free,
            bcximport: bcxImport,
            rpmode,
            fullunlock: fullUnlock,
            geteverything: getEverything,
            wardrobe,
            fulllock: fullLock
        };

        if (commands[subCommand]) {
            try {
                commands[subCommand](commandText);
            } catch (e) {
                console.error(`[LT] 命令 ${subCommand} 執行錯誤:`, e.message, e.stack);
                ChatRoomSendLocal(`執行 /lt ${subCommand} 失敗：${e.message}。請檢查控制台！`);
            }
        } else {
            ChatRoomSendLocal(`未知指令：/lt ${subCommand}，請使用 /lt help 查詢說明`);
        }
    }

    // 初始化並註冊命令
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

    // 主初始化函數
    async function initialize() {
        console.log("[LT] 開始初始化插件...");

        // 初始化 modApi
        modApi = await initializeModApi();
        await loadToastSystem();
        // 等待遊戲載入
        const gameLoaded = await waitFor(() =>
                                         typeof Player?.MemberNumber === "number" &&
                                         typeof CommandCombine === "function"
                                        );

        if (!gameLoaded) {
            console.error("[LT] 遊戲載入超時");
            return;
        }

        console.log("[LT] 遊戲已載入，註冊功能...");
        console.log("[LT] 玩家狀態:", { MemberNumber: Player.MemberNumber, OnlineSettings: !!Player.OnlineSettings });

        initializeStorage();
        setupHooks();

        // 註冊命令
        try {
            CommandCombine([{
                Tag: "lt",
                Description: "執行莉柯莉絲工具命令（例如 /lt help, /lt free）",
                Action: handleLtCommand
            }]);
            console.log("[LT] /lt 命令已通過 CommandCombine 註冊");

            // 等待進入聊天室後顯示載入訊息
            waitFor(() => CurrentScreen === "ChatRoom", 60000).then((success) => {
                if (success) {
                    ChatRoomSendLocal(`莉柯莉絲工具 v${modversion} 載入！使用 /lt help 查看說明`,30000);
                    setTimeout(broadcastRpStatus, 1000);// 广播当前RP状态
                }
            });
        } catch (e) {
            console.error("[LT] 註冊 /lt 命令錯誤:", e.message);
            ChatRoomSendLocal(`指令註冊失敗，可能有插件衝突（例如 BCX、ULTRAbc）。請檢查控制台！`);
        }

        console.log(`[LT] 插件已載入 (v${modversion})`);
    }

    // 卸載清理
    function setupUnloadHandler() {
        if (modApi && typeof modApi.onUnload === 'function') {
            modApi.onUnload(() => {
                console.log("[LT] 插件卸載...");
                if (Player.LikoTool?.bypassActivities) {
                    Player.IsAdmin = Player.LikoTool.originalIsAdmin || false;
                    console.log("[LT] 卸載時恢復 Player.IsAdmin 為", Player.IsAdmin);
                }
            });
        }
    }

    // 啟動初始化
    initialize().then(() => {
        setupUnloadHandler();
        console.log("[LT] 莉柯莉絲工具初始化完成");
    }).catch((error) => {
        console.error("[LT] 初始化失敗:", error);
    });

})();
