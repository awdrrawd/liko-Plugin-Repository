// ==UserScript==
// @name         Liko - PAT All
// @name:zh      Liko的對大家互動
// @namespace    https://likulisu.dev/
// @version      2.0
// @description  A BCAR-style compact button to perform activity on everyone in room, with all configs centralized
// @author       Likolisu & 約爾
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
                    console.error("[PAT All] bcModSdk 載入超時");
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
            console.error("[PAT All] ❌ bcModSdk 無法載入，插件將以兼容模式運行");
            return null;
        }

        try {
            modApi = bcModSdk.registerMod({
                name: 'Pat-all',
                fullName: 'Bondage Club - Pat All',
                version: '2.0',
                repository: '對房內的朋友互動',
            });
            console.log("✅ PAT All 註冊成功");
            return modApi;
        } catch (e) {
            console.error("[PAT All] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }

    // 本地變數（避免全局汙染）
    let checkEnabled = true;
    let expanded = false; // 展開 / 收納狀態
    const delayTime = 500;

    // 按鈕位置 & 尺寸
    const startX = 0;
    const startY = 600;
    const size = 45;

    const actions = [
        { label: "PAT", group: "ItemHead", name: "Pet" },
        { label: "SPANK", group: "ItemButt", name: "Spank" },
        { label: "INJECT", group: "ItemNeck", name: "Inject" },
    ];

    // === 工具函數 ===
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function sendLocalMessage(message) {
        try {
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== "ChatRoom") {
                console.warn("[PAT All] 不在聊天室，訊息可能不顯示");
                return;
            }
            if (typeof ChatRoomMessage === 'function') {
                ChatRoomMessage({
                    Content: `<font color="#FFB6C1">[PAT All] ${message}</font>`,
                    Type: "LocalMessage",
                    Sender: Player.MemberNumber
                });
            }
        } catch (e) {
            console.error("[PAT All] 發送本地訊息錯誤:", e.message);
        }
    }

    function makeActivityPacket(target, group, name) {
        try {
            return {
                Content: `ChatOther-${group}-${name}`,
                Type: "Activity",
                Dictionary: [
                    { "SourceCharacter": Player.MemberNumber },
                    { "TargetCharacter": target },
                    { "Tag": "FocusAssetGroup", "FocusGroupName": group },
                    { "ActivityName": name },
                ]
            };
        } catch (e) {
            console.error("[PAT All] 創建活動包錯誤:", e.message);
            return null;
        }
    }

    function canInteractWith(character) {
        try {
            // 基本檢查
            if (!character || character.MemberNumber === Player.MemberNumber) {
                return false;
            }

            // 權限檢查
            if (checkEnabled && character.AllowItem === false) {
                return false;
            }

            // 額外的權限檢查（如果有其他權限系統）
            if (typeof ServerChatRoomGetAllowItem === "function") {
                return ServerChatRoomGetAllowItem(Player, character);
            }

            return true;
        } catch (e) {
            console.error("[PAT All] 權限檢查錯誤:", e.message);
            return false;
        }
    }

    function sendActivityToAll(group, name) {
        try {
            if (!Array.isArray(ChatRoomCharacter)) {
                console.warn("[PAT All] ChatRoomCharacter 不是陣列");
                return;
            }

            const validTargets = ChatRoomCharacter.filter(canInteractWith);
            if (validTargets.length === 0) {
                sendLocalMessage("沒有可互動的目標");
                return;
            }

            (async () => {
                let successCount = 0;
                for (const C of validTargets) {
                    try {
                        const packet = makeActivityPacket(C.MemberNumber, group, name);
                        if (packet && typeof ServerSend === 'function') {
                            ServerSend("ChatRoomChat", packet);
                            successCount++;
                        }
                        await delay(delayTime);
                    } catch (e) {
                        console.error(`[PAT All] 對 ${C.Name} 執行活動失敗:`, e.message);
                    }
                }
                sendLocalMessage(`對 ${successCount} 個目標執行了 ${name}`);
            })();

        } catch (e) {
            console.error("[PAT All] sendActivityToAll 錯誤:", e.message);
            sendLocalMessage("執行活動時發生錯誤");
        }
    }

    // === 安全的 hook 函數包裝器 ===
    function safeHookFunction(functionName, priority, callback) {
        if (modApi && typeof modApi.hookFunction === 'function') {
            try {
                return modApi.hookFunction(functionName, priority, callback);
            } catch (e) {
                console.error(`[PAT All] Hook ${functionName} 失敗:`, e.message);
                return false;
            }
        } else {
            console.warn(`[PAT All] 無法 hook ${functionName}，modApi 不可用`);
            return false;
        }
    }

    // === 設置 Hook 函數 ===
    function setupHooks() {
        // Hook 繪製函數
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            try {
                // 主按鈕（改成 PET ALL）
                if (typeof DrawButton === 'function') {
                    DrawButton(startX, startY, size, size, "PET\nALL", "White", "", "展開/收起");

                    if (expanded) {
                        // 功能按鈕
                        actions.forEach((a, i) => {
                            DrawButton(
                                startX,
                                startY + (i + 1) * size,
                                size, size,
                                a.label,
                                "White", "",
                                `對所有人執行 ${a.name}`
                            );
                        });

                        // 開關檢查按鈕
                        DrawButton(
                            startX,
                            startY + (actions.length + 1) * size,
                            size, size,
                            checkEnabled ? "✔" : "✘",
                            checkEnabled ? "Green" : "Red", "",
                            "切換檢查模式"
                        );
                    }
                }
            } catch (e) {
                console.error("[PAT All] 繪製按鈕失敗:", e.message);
            }
            next(args);
        });

        // Hook 點擊函數
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            try {
                if (typeof MouseIn !== 'function') {
                    next(args);
                    return;
                }

                // 主按鈕
                if (MouseIn(startX, startY, size, size)) {
                    expanded = !expanded;
                    sendLocalMessage(expanded ? "面板已展開" : "面板已收起");
                    return; // 阻止穿透
                }

                if (expanded) {
                    // 功能按鈕
                    for (let i = 0; i < actions.length; i++) {
                        if (MouseIn(startX, startY + (i + 1) * size, size, size)) {
                            const action = actions[i];
                            sendActivityToAll(action.group, action.name);
                            return; // 阻止穿透
                        }
                    }

                    // 檢查模式切換按鈕
                    if (MouseIn(startX, startY + (actions.length + 1) * size, size, size)) {
                        checkEnabled = !checkEnabled;
                        sendLocalMessage(checkEnabled ? "權限檢查已啟用" : "權限檢查已停用");
                        return; // 阻止穿透
                    }
                }
            } catch (e) {
                console.error("[PAT All] 按鈕點擊處理失敗:", e.message);
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
                    typeof DrawButton === 'function' &&
                    typeof MouseIn === 'function' &&
                    typeof ServerSend === 'function') {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[PAT All] 遊戲載入超時");
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
        console.log("[PAT All] 開始初始化...");

        try {
            // 初始化 modApi
            modApi = await initializeModApi();

            // 等待遊戲載入
            const gameLoaded = await waitForGame();
            if (!gameLoaded) {
                console.error("[PAT All] 遊戲載入失敗");
                return;
            }

            // 設置 Hook
            setupHooks();

            // 設置卸載處理
            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("[PAT All] 插件卸載中...");
                    expanded = false;
                    checkEnabled = true;
                });
            }

            console.log("[PAT All] 初始化完成 v2.0");

            // 如果在聊天室中，顯示載入訊息
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                sendLocalMessage("PAT All 插件已載入！點擊左側按鈕開始使用");
            }

        } catch (e) {
            console.error("[PAT All] 初始化失敗:", e.message);
        }
    }

    // === 啟動初始化 ===
    initialize();

})();
