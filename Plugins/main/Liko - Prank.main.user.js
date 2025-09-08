// ==UserScript==
// @name         Liko - Prank
// @name:zh      Liko對朋友的惡作劇
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Bondage Club - Likolisu's prank on her friends
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';
    let modApi;
    const modversion = "1.0";
    (function () {
        try {
            if (typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function") {
                modApi = bcModSdk.registerMod({
                    name: "liko's prank",
                    fullName: "Likolisu's prank on her friends",
                    version: modversion,
                    repository: "莉柯莉絲對朋友的惡作劇 | Liko's prank on her friends"
                });
                console.log("[prank] ✅ liko's prank 腳本啟動完成");
            } else {
                console.warn("[prank] ❌ bcModSdk 不可用，無需註冊即可繼續");
            }
        } catch (error) {
            console.error("[prank] ❌ 初始化 modApi 失敗", error);
        }
    })();

    // 防止重复加载
    if (window.LIKO_PRANK_LOADED) {
        console.log("liko's prank Plugin is already loaded");
        return;
    }
    window.LIKO_PRANK_LOADED = true;

    // 等待游戏加载
    function waitFor(condition, timeout = 30000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - start > timeout) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 工具函数
    function getPlayer(identifier) {
        if (!ChatRoomCharacter) {
            console.warn("ChatRoomCharacter not available");
            return null;
        }
        
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            // 按会员号查找
            return ChatRoomCharacter.find(c => c.MemberNumber === parseInt(identifier)) || null;
        } else if (typeof identifier === "string") {
            // 按名称查找（不区分大小写）
            const lowerIdentifier = identifier.toLowerCase();
            return ChatRoomCharacter.find(c =>
                c.Name?.toLowerCase() === lowerIdentifier ||
                c.Nickname?.toLowerCase() === lowerIdentifier ||
                c.AccountName?.toLowerCase() === lowerIdentifier
            ) || null;
        }
        return null;
    }

    function getNickname(character) {
        if (!character) return "Unknown";
        return character.Nickname || character.Name || character.AccountName || "Unknown";
    }

    function chatSendCustomAction(message) {
        if (typeof ServerSend === "function") {
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [{ 
                    Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', 
                    Text: message 
                }]
            });
        } else {
            console.log("Action message: " + message);
        }
    }

    function chatSendLocal(message, timeout = 10000) {
        if (typeof ChatRoomMessage === "function") {
            ChatRoomMessage({ Content: message, Type: "LocalMessage" }, timeout);
        } else {
            console.log("Local message: " + message);
        }
    }

    function hasBCItemPermission(target) {
        return typeof ServerChatRoomGetAllowItem === "function" 
            ? ServerChatRoomGetAllowItem(Player, target) 
            : true;
    }

    async function requestInput(prompt) {
        return new Promise(resolve => {
            const result = window.prompt(prompt);
            resolve(result === null ? false : result);
        });
    }

    // 随机颜色生成器
    function getRandomColor() {
        const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 需要移除的外观组（用于溶解功能）
    const appearanceGroupNames = [
        "Panties", "Socks", "ClothLower", "Gloves", "HairAccessory1", "Cloth", "Bra", "Hat", "Shoes",
        "ClothAccessory", "Necklace", "Suit", "SuitLower", "Corset", "SocksRight", "SocksLeft",
        "RightAnklet", "LeftAnklet", "Garters", "HairAccessory3", "Bracelet", "Glasses", "Jewelry",
        "Mask", "HairFront", "Mask_笨笨蛋Luzi", "Gloves_笨笨蛋Luzi", "Luzi_HairAccessory3_2",
        "Luzi_HairAccessory3_1", "HairAccessory3_笨笨蛋Luzi", "Hat_笨笨蛋Luzi", "Shoes_笨笨蛋Luzi",
        "Necklace_笨笨蛋Luzi", "ClothAccessory_笨笨笨蛋Luzi2", "SuitLower_笨笨蛋Luzi",
        "Suit_笨笨蛋Luzi", "Panties_笨笨蛋Luzi", "ClothLower_笨笨笨蛋Luzi2", "ClothLower_笨笨蛋Luzi",
        "Cloth_笨笨笨蛋Luzi2", "BodyMarkings2_Luzi", "长袖子_Luzi", "身体痕迹_Luzi", "Liquid2_Luzi",
        "FaceMarkings", "BodyMarkings", "HandAccessoryRight", "HandAccessoryLeft", "AnkletLeft",
        "AnkletRight", "EyeShadow", "ClothOuter", "Cloth_笨笨蛋Luzi", "ClothAccessory_笨笨蛋Luzi",
        "Bra_笨笨蛋Luzi"
    ];

    // 偷取内裤功能
    function stealPanties(args) {
        try {
            const target = getPlayer(args.trim());
            if (!target) {
                return chatSendLocal("用法: /Steal [ID/名稱/暱稱] 或 /偷取 [ID/名稱/暱稱]\n找不到指定玩家，请确认正确。");
            }

            if (!hasBCItemPermission(target)) {
                return chatSendLocal(`无权限互动 ${getNickname(target)}`);
            }

            const panties = InventoryGet(target, "Panties");

            // 从目标身上移除内裤
            InventoryRemove(target, "Panties");
            ChatRoomCharacterUpdate(target);

            // 确定内裤颜色
            let itemColor = "Default";
            if (panties && panties.Color) {
                itemColor = panties.Color;
            } else {
                const hairFront = InventoryGet(target, "HairFront");
                const hairBack = InventoryGet(target, "HairBack");
                if (hairFront && hairFront.Color) {
                    itemColor = hairFront.Color;
                } else if (hairBack && hairBack.Color) {
                    itemColor = hairBack.Color;
                } else {
                    itemColor = getRandomColor();
                }
            }

            // 将制作的内裤添加到玩家手中
            InventoryWear(Player, "Panties", "ItemHandheld", itemColor, 0, target.MemberNumber, {
                Name: `${getNickname(target)}刚脱下的内裤 💕`,
                Description: `${getNickname(target)}刚脱下的内裤，带有一点余温与气味💕`,
                Color: itemColor,
                Property: "Normal",
                Lock: "",
                Private: false,
                ItemProperty: {},
                MemberNumber: target.MemberNumber,
                MemberName: getNickname(target)
            });
            ChatRoomCharacterUpdate(Player);

            // 设置最后一项的描述
            const lastIndex = Player.Appearance.length - 1;
            if (Player.Appearance[lastIndex] && Player.Appearance[lastIndex].Craft) {
                Player.Appearance[lastIndex].Craft.Description = `${getNickname(target)}的内裤`;
            }

            chatSendCustomAction(`${getNickname(Player)}悄悄地偷了${getNickname(target)}的内裤！`);
        } catch (error) {
            console.error("Error in stealPanties:", error);
            chatSendLocal("偷取内裤时发生错误");
        }
    }

    // 溶解药水功能
    function spillObscenePotion(args) {
        try {
            const target = getPlayer(args.trim());
            if (!target) {
                return chatSendLocal("用法: /dissolve [ID/名稱/暱稱] 或 /溶解 [ID/名稱/暱稱]\n找不到指定玩家，请确认正确。");
            }

            if (!hasBCItemPermission(target)) {
                return chatSendLocal(`无权限互动 ${getNickname(target)}`);
            }

            const noClothesFilter = (item) => !appearanceGroupNames.includes(item.Group);
            const appearance = ServerAppearanceBundle(target.Appearance).filter(noClothesFilter);
            
            ServerSend("ChatRoomCharacterUpdate", {
                ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
                ActivePose: target.ActivePose,
                Appearance: appearance
            });
            
            chatSendCustomAction(`${getNickname(Player)}对${getNickname(target)}用了看起来诡异的药水，溶解了${getNickname(target)}的衣服 💕`);
        } catch (error) {
            console.error("Error in spillObscenePotion:", error);
            chatSendLocal("使用溶解药水时发生错误");
        }
    }

    // 传送功能
    async function openPortal(args) {
        try {
            let roomName = args.trim();
            if (!roomName) {
                roomName = await requestInput("输入房间名称");
                if (!roomName || roomName.trim() === "") {
                    return chatSendLocal("需要房间名称");
                }
            }

            // 在离开前发送虫洞消息
            chatSendCustomAction(`${getNickname(Player)}进入通往「${roomName}」的虫洞！`);

            // 延迟一下确保消息发送
            setTimeout(() => {
                if (typeof ChatRoomLeave === "function") ChatRoomLeave();
                if (typeof CommonSetScreen === "function") CommonSetScreen("Online", "ChatSearch");
                if (typeof ServerSend === "function") {
                    console.log(`Attempting to teleport to room: ${roomName}`);
                    ServerSend("ChatRoomJoin", { Name: roomName });
                    
                    // 延迟发送到达消息
                    setTimeout(() => {
                        chatSendCustomAction(`${getNickname(Player)}从虫洞里出来了！`);
                    }, 1000);
                }
            }, 500);
            
        } catch (error) {
            console.error("Error in openPortal:", error);
            chatSendLocal("传送时发生错误");
        }
    }

    // 初始化
    waitFor(() => typeof Player?.MemberNumber === "number")
        .then(() => {
            if (typeof CommandCombine === "function") {
                CommandCombine([
                    {
                        Tag: "steal",
                        Description: "Steal target's panties",
                        Action: (args) => stealPanties(args)
                    },
                    {
                        Tag: "偷取",
                        Description: "偷取目标的内裤",
                        Action: (args) => stealPanties(args)
                    },
                    {
                        Tag: "dissolve",
                        Description: "Dissolve target's clothes",
                        Action: (args) => spillObscenePotion(args)
                    },
                    {
                        Tag: "溶解",
                        Description: "溶解目标的衣服",
                        Action: (args) => spillObscenePotion(args)
                    },
                    {
                        Tag: "teleport",
                        Description: "Teleport to a room",
                        Action: (args) => openPortal(args)
                    },
                    {
                        Tag: "傳送",
                        Description: "传送到指定房间",
                        Action: (args) => openPortal(args)
                    },
                    {
                        Tag: "传送",
                        Description: "传送到指定房间",
                        Action: (args) => openPortal(args)
                    }
                ]);
                
                console.log("liko's prank Plugin Loaded (v1.1)");
                chatSendLocal("liko's prank Plugin Loaded (v1.1): Commands - /Steal, /偷取, /dissolve, /溶解, /Teleport, /傳送, /传送");
            } else {
                console.error("CommandCombine function not available");
                chatSendLocal("警告：命令系统不可用，插件可能无法正常工作");
            }
        });
})();
