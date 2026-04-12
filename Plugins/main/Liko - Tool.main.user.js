// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      1.3.4
// @description  Bondage Club - Likolisu's tool (R121 Compatible)
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    let modApi = null;
    const modversion = "1.3.4";

    const rpBtnX    = 955;
    const rpBtnY    = 855;
    const rpBtnSize = 45;
    const rpIconUrl = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/likorp.png";

    // ──────────────────────────────────────────
    // 等待 bcModSdk
    // ──────────────────────────────────────────
    function waitForBcModSdk() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    // ──────────────────────────────────────────
    // 等待任意條件（無超時，永遠等到成功）
    // ──────────────────────────────────────────
    function waitFor(condition) {
        return new Promise(resolve => {
            const check = () => {
                if (condition()) resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    // ──────────────────────────────────────────
    // 初始化 modApi
    // ──────────────────────────────────────────
    async function initializeModApi() {
        await waitForBcModSdk();
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko's tool",
                fullName: "Liko's tool",
                version: modversion,
                repository: '莉柯莉絲的工具包'
            });
            console.log("🐈‍⬛ [LT] ✅ modApi 初始化完成");
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 初始化 modApi 失敗:", e.message);
        }
    }

    // ──────────────────────────────────────────
    // 載入 Toast 系統
    // ──────────────────────────────────────────
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Toast 載入失敗"));
            document.head.appendChild(script);
        });
    }

    // ──────────────────────────────────────────
    // 初始化儲存
    // ──────────────────────────────────────────
    function initializeStorage() {
        if (!Player.LikoTool) {
            Player.LikoTool = { bypassActivities: false };
        }
        if (!Player.OnlineSharedSettings) {
            Player.OnlineSharedSettings = {};
        }
        if (!Player.OnlineSharedSettings.LikoTOOL) {
            Player.OnlineSharedSettings.LikoTOOL = { RPmode: 0, height: 0 };
        }
        if (typeof Player.OnlineSharedSettings.LikoTOOL.RPmode === 'undefined') {
            Player.OnlineSharedSettings.LikoTOOL.RPmode = 0;
        }
        if (typeof Player.OnlineSharedSettings.LikoTOOL.height === 'undefined') {
            Player.OnlineSharedSettings.LikoTOOL.height = 0;
        }
    }

    // ──────────────────────────────────────────
    // RP 模式
    // ──────────────────────────────────────────
    function getRpMode(character) {
        if (!character) return false;
        if (character.IsPlayer && character.IsPlayer()) {
            return Player.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
        }
        return character.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
    }

    function setRpMode(enabled) {
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
        Player.OnlineSharedSettings.LikoTOOL.RPmode = enabled ? 1 : 0;
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
    }

    // ──────────────────────────────────────────
    // 身高劫持：直接覆寫值，確保物品跟隨
    // ──────────────────────────────────────────
    function hijackCharacterHeight(C) {
        if (!C || C._heightHijacked) return;
        C._realHeightRatio    = C.HeightRatio;
        C._realHeightModifier = C.HeightModifier;
        // 直接賦值讓所有渲染系統讀到同一個數值，物品才不會錯位
        if (C.HeightRatio < 0.81 || C.HeightRatio > 1) {
            C.HeightRatio = 1.0;
        }
        C.HeightModifier  = 0;
        C._heightHijacked = true;
    }

    function restoreCharacterHeight(C) {
        if (!C?._heightHijacked) return;
        C.HeightRatio    = C._realHeightRatio;
        C.HeightModifier = C._realHeightModifier;
        delete C._realHeightRatio;
        delete C._realHeightModifier;
        delete C._heightHijacked;
    }

    // ──────────────────────────────────────────
    // Canvas：繪製 RP 圖標
    // ──────────────────────────────────────────
    function drawRpIcon(C, CharX, CharY, Zoom) {
        if (!getRpMode(C)) return;
        const offsetY = (C.IsKneeling && C.IsKneeling()) ? 300 : 40;
        DrawImageResize(rpIconUrl, CharX + 340 * Zoom, CharY + offsetY * Zoom, 45 * Zoom, 50 * Zoom);
    }

    // ──────────────────────────────────────────
    // 工具函數
    // ──────────────────────────────────────────
    function ChatRoomSendLocal(message, sec = 0) {
        if (CurrentScreen !== "ChatRoom") { console.warn("🐈‍⬛ [LT] ❗ 不在聊天室"); return; }
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#FF69B4">[LT] ${message}</font>`,
                Timeout: sec
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 發送本地訊息錯誤:", e.message);
        }
    }

    function getPlayer(identifier) {
        if (!identifier || identifier.trim() === "") return Player;
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            return ChatRoomCharacter?.find(c => c.MemberNumber === parseInt(identifier)) || Player;
        }
        return ChatRoomCharacter?.find(c =>
                                       c.Name.toLowerCase()         === identifier.toLowerCase() ||
                                       c.Nickname?.toLowerCase()    === identifier.toLowerCase() ||
                                       c.AccountName.toLowerCase()  === identifier.toLowerCase()
                                      ) || Player;
    }

    function getNickname(character) {
        return character?.Nickname || character?.Name || character?.AccountName || "未知";
    }

    function chatSendCustomAction(message) {
        if (CurrentScreen !== "ChatRoom") return;
        try {
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: message }]
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 自訂動作發送錯誤:", e.message);
            ChatRoomSendLocal("自訂動作發送失敗，可能有插件衝突。");
        }
    }

    function hasBCItemPermission(target) {
        if (Player.LikoTool?.bypassActivities) return true;
        return typeof ServerChatRoomGetAllowItem === "function"
            ? ServerChatRoomGetAllowItem(Player, target)
        : true;
    }

    async function requestButtons(prompt, width, height, buttons, multiSelect = false) {
        return new Promise(resolve => {
            const container = document.createElement("div");
            container.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #1a1a1a; color: #ffffff; padding: 20px; z-index: 1000;
                width: ${width}px; height: ${height}px; overflow: auto;
                border: 2px solid #444; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.5);
                display: flex; flex-direction: column;
            `;

            const promptDiv = document.createElement("div");
            promptDiv.innerText = prompt;
            promptDiv.style.cssText = "margin-bottom: 15px; font-size: 18px; text-align: center;";
            container.appendChild(promptDiv);

            const closeButton = document.createElement("button");
            closeButton.innerText = "X";
            closeButton.style.cssText = `
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
            buttonContainer.style.cssText = "flex-grow: 1; overflow-y: auto; margin-bottom: 10px;";
            let selected = [];

            buttons.forEach(btn => {
                const button = document.createElement("button");
                button.innerText = btn.text;
                button.style.cssText = `
                    margin: 5px; padding: 10px 20px; font-size: ${btn.fontSize || '16px'};
                    background: #333; color: #ffffff; border: 1px solid #555;
                    border-radius: 5px; cursor: pointer; width: 90%; text-align: left;
                `;
                button.onmouseover = () => button.style.background = selected.includes(btn.text) ? "#00ff00" : "#FFA500";
                button.onmouseout  = () => button.style.background = selected.includes(btn.text) ? "#00ff00" : "#333";
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
                    const previewCanvas = document.createElement("canvas");
                    previewCanvas.width  = 100;
                    previewCanvas.height = 200;
                    previewCanvas.style.cssText = "margin: 5px; vertical-align: middle;";
                    try {
                        const ctx = previewCanvas.getContext("2d");
                        if (ctx) DrawCharacter(btn.preview, 0, 0, 0.2, false, ctx);
                    } catch (e) {
                        console.error("🐈‍⬛ [LT] ❌ 預覽渲染錯誤:", e.message);
                    }
                    button.prepend(previewCanvas);
                }
                buttonContainer.appendChild(button);
            });
            container.appendChild(buttonContainer);

            if (multiSelect) {
                const confirmButton = document.createElement("button");
                confirmButton.innerText = "確認";
                confirmButton.style.cssText = `
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

    // ──────────────────────────────────────────
    // 安全 hook 包裝
    // ──────────────────────────────────────────
    function safeHookFunction(functionName, priority, callback) {
        if (modApi && typeof modApi.hookFunction === 'function') {
            try {
                modApi.hookFunction(functionName, priority, callback);
            } catch (e) {
                console.error(`🐈‍⬛ [LT] ❌ Hook ${functionName} 失敗:`, e.message);
            }
        } else {
            console.warn(`🐈‍⬛ [LT] ❌ 無法 hook ${functionName}，modApi 不可用`);
        }
    }

    // ──────────────────────────────────────────
    // Hooks
    // ──────────────────────────────────────────
    function setupHooks() {

        safeHookFunction("ServerSend", 20, (args, next) => {
            if (!getRpMode(Player) || CurrentScreen !== "ChatRoom") {
                return next(args);
            }
            const [messageType, data] = args;
            if (messageType === "ChatRoomChat" && data.Type === "Action") {
                return;
            }
            return next(args);
        });

        safeHookFunction("ChatRoomCharacterViewDrawOverlay", 10, (args, next) => {
            const result = next(args);
            const [C, CharX, CharY, Zoom] = args;
            if (C?.MemberNumber && CurrentScreen === "ChatRoom") {
                if (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null) {
                    drawRpIcon(C, CharX, CharY, Zoom);
                }
            }
            return result;
        });

        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            const result = next(args);
            if (!Player.LikoTool) initializeStorage();
            DrawButton(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize, "🔰",
                       getRpMode(Player) ? "Orange" : "Gray", "", "RP模式切換");
            return result;
        });

        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            if (!Player.LikoTool) initializeStorage();
            if (MouseIn(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize)) {
                const newRpMode = !getRpMode(Player);
                setRpMode(newRpMode);
                if (typeof ChatRoomSendLocalStyled === 'function') {
                    ChatRoomSendLocalStyled(newRpMode ? "🔰 RP模式启用" : "🔰 RP模式停用", 3000);
                } else {
                    ChatRoomSendLocal(newRpMode ? "RP模式已启用" : "RP模式已停用");
                }
            }
            return next(args);
        });

        // 身高劫持：改為直接覆寫，確保物品渲染跟隨
        safeHookFunction("CharacterSetCurrent", 10, (args, next) => {
            const [C] = args;
            const result = next(args);
            if (Player.OnlineSharedSettings?.LikoTOOL?.height === 1 && C?.MemberNumber) {
                hijackCharacterHeight(C);
            }
            return result;
        });
        // 在 setupHooks() 裡加入這個
        safeHookFunction("CharacterRefresh", 10, (args, next) => {
            const [C] = args;
            const result = next(args);

            // 如果身高劫持功能開啟，且刷新的角色就是當前選取的角色，重新劫持
            if (
                Player.OnlineSharedSettings?.LikoTOOL?.height === 1 &&
                C?.MemberNumber &&
                CurrentCharacter?.MemberNumber === C.MemberNumber
            ) {
                // 清除舊標記，讓 hijack 可以重新執行
                delete C._heightHijacked;
                hijackCharacterHeight(C);
            }

            return result;
        });
        safeHookFunction("DialogLeave", 10, (args, next) => {
            restoreCharacterHeight(CurrentCharacter);
            return next(args);
        });
    }

    // ──────────────────────────────────────────
    // 指令實作（與原版相同，略）
    // ──────────────────────────────────────────
    function freetotal(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。`); return true; }
        try {
            CharacterReleaseTotal(target);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 完全解除了 ${getNickname(target)} 的所有束縛！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ freetotal 錯誤:", e.message);
            ChatRoomSendLocal("無法解除束縛。");
        }
        return true;
    }

    async function free(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。`); return true; }
        const restraints = [];
        for (const group of AssetGroup) {
            if (group.Name.startsWith("Item")) {
                const item = InventoryGet(target, group.Name);
                if (item) {
                    const lock     = item.Property?.LockedBy ? `🔒${item.Property.LockedBy}` : "";
                    const password = item.Property?.Password || item.Property?.CombinationNumber || "";
                    const itemName = item.Craft?.Name || item.Asset?.Description || item.Asset?.Name || '未知物品';
                    restraints.push({
                        text: `${lock ? lock + " " : ""}${itemName} (${group.Description}${password ? `, 密碼: ${password}` : ""})`,
                        fontSize: "16px",
                        group: group.Name
                    });
                }
            }
        }
        if (!restraints.length) { ChatRoomSendLocal(`${getNickname(target)} 沒有束縛物品！`); return true; }
        const selected = await requestButtons(`選擇要移除的 ${getNickname(target)} 的束縛`, 400, 500, restraints, true);
        if (!selected.length) return true;
        try {
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (group) InventoryRemove(target, group);
            });
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 解除了 ${getNickname(target)} 的 ${selected.join("、")}`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ free 錯誤:", e.message);
            ChatRoomSendLocal("無法移除束縛。");
        }
        return true;
    }

    async function bcxImport(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。`); return true; }
        let bcxCode;
        try {
            bcxCode = await navigator.clipboard.readText();
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ bcxImport 剪貼簿讀取錯誤:", e.message);
            ChatRoomSendLocal("無法讀取剪貼簿。");
            return true;
        }
        try {
            const appearance = JSON.parse(LZString.decompressFromBase64(bcxCode));
            if (!Array.isArray(appearance)) throw new Error("無效的外觀數據");
            ServerAppearanceLoadFromBundle(target, target.AssetFamily, appearance, Player.MemberNumber);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 為 ${getNickname(target)} 導入了 BCX 外觀！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ bcxImport 解析錯誤:", e.message);
            ChatRoomSendLocal("無效的 BCX 代碼。");
        }
        return true;
    }

    function rpmode() {
        if (!Player.LikoTool) initializeStorage();
        const newRpMode = !getRpMode(Player);
        setRpMode(newRpMode);
        ChatRoomSendLocal(`RP模式已 ${newRpMode ? "开启" : "关闭"}！`);
        return true;
    }

    function fullUnlock(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。`); return true; }
        try {
            const skipLocks = ["OwnerPadlock", "OwnerTimerPadlock", "LoversPadlock", "LoversTimerPadlock"];
            let unlockedCount = 0;
            for (const a of target.Appearance) {
                if (a.Property?.LockedBy && !skipLocks.includes(a.Property.LockedBy)) {
                    InventoryUnlock(target, a);
                    unlockedCount++;
                }
            }
            if (unlockedCount === 0) { ChatRoomSendLocal(`${getNickname(target)} 沒有可移除的鎖！`); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 移除了 ${getNickname(target)} 的所有鎖！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ fullUnlock 錯誤:", e.message);
            ChatRoomSendLocal("無法移除鎖。");
        }
        return true;
    }

    async function getEverything() {
        if (!Player.LikoTool) initializeStorage();
        const options = [
            { text: "獲得所有道具",        fontSize: "16px" },
            { text: "設置金錢為 999,999",  fontSize: "16px" },
            { text: "所有技能升至 10 級",  fontSize: "16px" }
        ];
        const selected = await requestButtons("選擇增強功能", 300, 400, options, true);
        if (!selected.length) return true;
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
                ChatRoomSendLocal(`已添加 ${ids.length} 個新物品！`);
            }
            if (selected.includes("設置金錢為 999,999")) {
                Player.Money = 999999;
                ServerPlayerSync();
                ChatRoomSendLocal("金錢已設置為 999,999！");
            }
            if (selected.includes("所有技能升至 10 級")) {
                ["LockPicking", "Evasion", "Willpower", "Bondage", "SelfBondage", "Dressage", "Infiltration"]
                    .forEach(skill => SkillChange(Player, skill, 10, 0, true));
                ChatRoomSendLocal("所有技能已升至 10 級！");
            }
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ getEverything 錯誤:", e.message);
            ChatRoomSendLocal("無法執行增強功能。");
        }
        return true;
    }

    function wardrobe() {
        if (!Player.LikoTool) initializeStorage();
        try {
            ChatRoomAppearanceLoadCharacter(Player);
            ChatRoomSendLocal("已開啟衣櫃！");
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ wardrobe 錯誤:", e.message);
            ChatRoomSendLocal("無法開啟衣櫃。");
        }
        return true;
    }

    function fullLock(args) {
        if (!Player.LikoTool) initializeStorage();
        const params           = args.trim().split(/\s+/);
        const targetIdentifier = params[0] || "";
        const lockName         = params[1] || "";
        const target           = getPlayer(targetIdentifier);

        if (target === Player && !targetIdentifier) {
            ChatRoomSendLocal("請指定目標（例如 /lt fulllock [目標] [鎖名稱]）！");
            return true;
        }
        if (!ChatRoomCharacter?.find(c => c.MemberNumber === target.MemberNumber)) {
            ChatRoomSendLocal(`目標 ${getNickname(target)} 不在房間內！`);
            return true;
        }
        if (!hasBCItemPermission(target)) {
            ChatRoomSendLocal(`無權限互動 ${getNickname(target)}。`);
            return true;
        }

        const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
        if (!itemMiscGroup) { ChatRoomSendLocal("無法獲取 ItemMisc 群組。"); return true; }
        const validLocks = itemMiscGroup.Asset
        .filter(asset => asset.IsLock)
        .map(asset => ({ Name: asset.Name, Description: asset.Description || asset.Name }));
        const lock = validLocks.find(l =>
                                     l.Name.toLowerCase()        === lockName.toLowerCase() ||
                                     l.Description.toLowerCase() === lockName.toLowerCase()
                                    );
        if (!lock) {
            ChatRoomSendLocal(`無效的鎖名稱：${lockName}。\n可用鎖：${validLocks.map(l => l.Description).join("、")}`);
            return true;
        }

        try {
            let lockedCount = 0;
            for (const item of target.Appearance) {
                const groupName = item.Asset?.Group?.Name || "";
                if (groupName.startsWith("Item") && item.Asset?.AllowLock !== false && !item.Property?.LockedBy) {
                    InventoryLock(target, item, { Asset: AssetGet(Player.AssetFamily, "ItemMisc", lock.Name) }, Player.MemberNumber);
                    lockedCount++;
                }
            }
            if (lockedCount === 0) { ChatRoomSendLocal(`${getNickname(target)} 沒有可鎖定的束縛！`); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 為 ${getNickname(target)} 的 ${lockedCount} 個束縛添加了 ${lock.Description} 鎖！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ fullLock 錯誤:", e.message);
            ChatRoomSendLocal("無法添加鎖。");
        }
        return true;
    }

    function heightCommand() {
        if (!Player.OnlineSharedSettings)           Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};

        const enabled = Player.OnlineSharedSettings.LikoTOOL.height !== 1;
        Player.OnlineSharedSettings.LikoTOOL.height = enabled ? 1 : 0;

        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }

        ChatRoomSendLocal(`身高劫持功能已 ${enabled ? "啟用" : "停用"}！`);
        if (!enabled) restoreCharacterHeight(CurrentCharacter);
        return true;
    }

    // ──────────────────────────────────────────
    // 指令入口
    // ──────────────────────────────────────────
    function handleLtCommand(text) {
        if (!Player.LikoTool) initializeStorage();
        const args        = text.trim().split(/\s+/);
        const subCommand  = args[0]?.toLowerCase() || "";
        const commandText = args.slice(1).join(" ");

        if (!subCommand || subCommand === "help") {
            ChatRoomSendLocal(
                `莉柯莉絲工具使用說明書(Manual)\n\n` +
                `可用指令列表(Commands)：\n` +
                `/lt help - 顯示說明書(Show Manual)\n` +
                `/lt free [目標] - 移除束縛(Unbundle)\n` +
                `/lt freetotal [目標] - 移除所有束縛(all Unbundle)\n` +
                `/lt bcximport [目標] - 導入 BCX 外觀(Import BCX appearance)\n` +
                `/lt fulllock  [目標] [鎖名稱] - 添加鎖([Target] [Lock Type]Add lock)\n` +
                `/lt fullunlock [目標] - 移除所有鎖(Unlock all)\n` +
                `/lt rpmode - RP模式(Switch to RP mode)\n` +
                `/lt height - 選擇角色時身高固定(Fixed height when selecting a character)\n` +
                `/lt geteverything - 增強功能(Enhanced functionality)\n` +
                `/lt wardrobe - 開啟衣櫃(Open wardrobe)\n\n` +
                `提示：🔰 按鈕能快速切換 RP 模式！(🔰quickly switch RP mode!)`
            );
            return true;
        }

        const commands = {
            freetotal,
            free,
            bcximport:     bcxImport,
            rpmode,
            fullunlock:    fullUnlock,
            geteverything: getEverything,
            wardrobe,
            fulllock:      fullLock,
            height:        heightCommand
        };

        if (commands[subCommand]) {
            try {
                commands[subCommand](commandText);
            } catch (e) {
                console.error(`🐈‍⬛ [LT] ❌ 命令 ${subCommand} 執行錯誤:`, e.message);
                ChatRoomSendLocal(`執行 /lt ${subCommand} 失敗。`);
            }
        } else {
            ChatRoomSendLocal(`未知指令：/lt ${subCommand}`);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 主初始化
    // ──────────────────────────────────────────
    async function initialize() {
        console.log("🐈‍⬛ [LT] ⌛ 開始初始化插件...");

        await initializeModApi();

        try {
            await loadToastSystem();
        } catch (e) {
            console.warn("🐈‍⬛ [LT] ❌ Toast system 載入失敗，備用模式運行:", e.message);
        }

        // 等待玩家登入，無超時
        console.log("🐈‍⬛ [LT] ⌛ 等待玩家登入...");
        await waitFor(() => {
            try { return typeof Player?.MemberNumber === "number"; }
            catch { return false; }
        });

        initializeStorage();
        setupHooks();

        const registerCommand = () => {
            CommandCombine([{
                Tag: "lt",
                Description: "執行莉柯莉絲工具命令",
                Action: handleLtCommand
            }]);
            console.log("🐈‍⬛ [LT] ✅ /lt 指令註冊成功");
        };

        if (typeof CommandCombine === "function") {
            try { registerCommand(); }
            catch (e) { console.error("🐈‍⬛ [LT] ❌ 註冊命令錯誤:", e.message); }
        } else {
            waitFor(() => typeof CommandCombine === "function").then(() => {
                try { registerCommand(); }
                catch (e) { console.error("🐈‍⬛ [LT] ❌ 延遲註冊命令錯誤:", e.message); }
            });
        }

        waitFor(() => CurrentScreen === "ChatRoom").then(() => {
            ChatRoomSendLocal(`莉柯莉絲工具 v${modversion} 載入！使用 /lt help 查看說明`, 30000);
        });

        console.log(`🐈‍⬛ [LT] ✅ 插件已載入 (v${modversion})`);
    }

    // ──────────────────────────────────────────
    // 卸載清理
    // ──────────────────────────────────────────
    function setupUnloadHandler() {
        if (modApi && typeof modApi.onUnload === 'function') {
            modApi.onUnload(() => {
                console.log("🐈‍⬛ [LT] 🗑️ 插件卸載...");
            });
        }
    }

    initialize().then(() => {
        setupUnloadHandler();
    }).catch(error => {
        console.error("🐈‍⬛ [LT] ❌ 初始化失敗:", error);
    });

})();
