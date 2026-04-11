// ==UserScript==
// @name         Liko - Prank
// @name:zh      Liko对朋友的恶作剧
// @namespace    https://likolisu.dev/
// @version      1.5.3
// @description  Likolisu's prank on her friends
// @description:zh Liko对朋友的恶作剧
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    if (window.LIKO_PRANK_LOADED) {
        console.log("liko's prank Plugin is already loaded");
        return;
    }
    window.LIKO_PRANK_LOADED = true;

    let modApi;
    const modversion = "1.5.3";

    // ===== 图片路径辅助工具 =====
    const ImagePathHelper = {
        _cachedBasePath: null,

        getBasePath: function() {
            if (this._cachedBasePath) return this._cachedBasePath;
            let href = window.location.href;
            if (!href.endsWith('/')) {
                href = href.substring(0, href.lastIndexOf('/') + 1);
            }
            this._cachedBasePath = href;
            return href;
        },

        getAssetURL: function(path) {
            return this.getBasePath() + 'Assets/' + path;
        },

        clearCache: function() {
            this._cachedBasePath = null;
        }
    };

    // ===== 多语言支持 =====
    function detectLanguage() {
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        return (navigator.language || 'en').toLowerCase().startsWith('zh');
    }

    const messages = {
        en: {
            loaded: `Liko's Prank Plugin v${modversion} Loaded!`,
            notFound: "Target not found",
            noPermission: "No permission",
            noUnderwear: "has no underwear",
            noSocks: "has no socks",
            stealFailed: "Failed to steal",
            removeFailed: "Failed to remove",
            nothingToRemove: "has no removable clothing in this area",
            stealUnderwear: "discreetly steals",
            stealUnderwearSuffix: "'s underwear 💕",
            removedOwnUnderwear: "takes off their own underwear",
            dissolveClothes: "splashes an obscene concoction on",
            dissolveClothesTarget: "'s clothes",
            dissolveOwnClothes: "splashes an obscene concotion on their own clothes",
            enterPortal: "opens a wormhole towards",
            exitPortal: "emerges from a wormhole",
            cutClothes: "cuts off",
            cutClothesTarget: "'s",
            cutOwnClothes: "cuts off their own",
            removeClothes: "removes",
            removeOwnClothes: "removes their own",
            stoleUnderwear: "snatches",
            removedAndHoldUnderwear: "slips off",
            holdUnderwear: "'s underwear and embraces their warmth",
            holdOwnUnderwear: "slips down their own underwear and holds them",
            stoleSocks: "snatches",
            socksSuffix: "'s socks",
            removedAndHoldSocks: "pulls off",
            holdSocks: "'s socks and clutches them",
            holdOwnSocks: "pulls off their socks and holds them",
            pluckingOwnHair: "pluckes out their own ahoge",
            pluckingHair: "pluckes out",
            pluckingHairSuffix: "'s ahoge",
            actCutClothes: "Cut Clothes",
            actRemoveClothes: "Remove Clothes",
            actDissolveClothes: "Dissolve Clothes",
            actStealPanties: "Steal Panties",
            actRemoveHoldPanties: "Take Panties",
            actStealSocks: "Steal Socks",
            actRemoveHoldSocks: "Take Socks",
            actPluckingHair: "Pluck Ahoge",
            actCutClothesDesc: "SourceCharacter cuts off TargetCharacter's clothes using scissors",
            actCutClothesSelf: "SourceCharacter cuts off their own clothes using scissors",
            actRemoveClothesDesc: "SourceCharacter removes TargetCharacter's clothes",
            actRemoveClothesSelf: "SourceCharacter removes their own clothes",
            actDissolveClothesDesc: "SourceCharacter splashes an obscene concotion on TargetCharacter",
            actDissolveClothesSelf: "SourceCharacter splashes an obscene concotion on themselves",
            actStealPantiesDesc: "SourceCharacter snatches TargetCharacter's panties",
            actRemoveHoldPantiesDesc: "SourceCharacter slips off TargetCharacter's panties and holds them",
            actRemoveHoldPantiesSelf: "SourceCharacter slips off their own panties holds them",
            actStealSocksDesc: "SourceCharacter snatches TargetCharacter's socks",
            actRemoveHoldSocksDesc: "SourceCharacter pulls off TargetCharacter's socks and holds them",
            actRemoveHoldSocksSelf: "SourceCharacter pulls off their own socks and holds them"
        },
        zh: {
            loaded: `Liko的恶作剧插件 v${modversion} 载入完成！`,
            notFound: "找不到目标",
            noPermission: "无权限",
            noUnderwear: "没有穿内裤",
            noSocks: "没有穿袜子",
            stealFailed: "偷取失败",
            removeFailed: "脱下失败",
            nothingToRemove: "在这个部位没有可移除的衣物",
            stealUnderwear: "悄悄偷走了",
            stealUnderwearSuffix: "的内裤 💕",
            removedOwnUnderwear: "脱下了自己的内裤",
            dissolveClothes: "用淫秽的药水溶解了",
            dissolveClothesTarget: "的衣服",
            dissolveOwnClothes: "用淫秽的药水溶解了自己的衣服",
            enterPortal: "进入通往",
            exitPortal: "从虫洞出来了",
            cutClothes: "用剪刀剪掉了",
            cutClothesTarget: "的",
            cutOwnClothes: "用剪刀剪掉了自己的",
            removeClothes: "脱掉了",
            removeOwnClothes: "脱掉了自己的",
            stoleUnderwear: "偷了",
            removedAndHoldUnderwear: "脱下了",
            holdUnderwear: "的内裤并握在手中",
            holdOwnUnderwear: "脱下了自己的内裤并握在手中",
            stoleSocks: "偷了",
            socksSuffix: "的袜子",
            removedAndHoldSocks: "脱下了",
            holdSocks: "的袜子并握在手中",
            holdOwnSocks: "脱下了自己的袜子并握在手中",
            pluckingOwnHair: "拔下了自己的呆毛",
            pluckingHair: "拔下了",
            pluckingHairSuffix: "的呆毛",
            actCutClothes: "剪掉衣物",
            actRemoveClothes: "脱掉衣物",
            actDissolveClothes: "溶解衣物",
            actStealPanties: "偷内裤",
            actRemoveHoldPanties: "脱下并握着内裤",
            actStealSocks: "偷袜子",
            actRemoveHoldSocks: "脱下并握着袜子",
            actPluckingHair: "拔呆毛",
            actCutClothesDesc: "SourceCharacter 用剪刀剪掉了 TargetCharacter 的衣物",
            actCutClothesSelf: "SourceCharacter 用剪刀剪掉了自己的衣物",
            actRemoveClothesDesc: "SourceCharacter 脱掉了 TargetCharacter 的衣物",
            actRemoveClothesSelf: "SourceCharacter 脱掉了自己的衣物",
            actDissolveClothesDesc: "SourceCharacter 对 TargetCharacter 使用了淫秽的药水",
            actDissolveClothesSelf: "SourceCharacter 对自己使用了淫秽的药水",
            actStealPantiesDesc: "SourceCharacter 偷了 TargetCharacter 的内裤",
            actRemoveHoldPantiesDesc: "SourceCharacter 脱下了 TargetCharacter 的内裤并握在手中",
            actRemoveHoldPantiesSelf: "SourceCharacter 脱下了自己的内裤并握在手中",
            actStealSocksDesc: "SourceCharacter 偷了 TargetCharacter 的袜子",
            actRemoveHoldSocksDesc: "SourceCharacter 脱下了 TargetCharacter 的袜子并握在手中",
            actRemoveHoldSocksSelf: "SourceCharacter 脱下了自己的袜子并握在手中"
        }
    };

    function getMessage(key) {
        const isZh = detectLanguage();
        return messages[isZh ? 'zh' : 'en'][key];
    }

    // ===== 等待工具 =====
    // 修正：timeout 從 30 秒提高到 120 秒，避免登入較慢時超時
    function waitFor(condition, timeout = 120000) {
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - start > timeout) {
                    reject(new Error('Timeout'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 修正：等待 bcModSdk 後再 registerMod，避免同步執行時 SDK 尚未載入
    async function waitForBcModSdk(timeout = 30000) {
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

    // ===== 工具函数 =====
    function getPlayer(identifier) {
        if (!ChatRoomCharacter) return null;
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            return ChatRoomCharacter.find(c => c.MemberNumber === parseInt(identifier)) || null;
        } else if (typeof identifier === "string") {
            const lower = identifier.toLowerCase();
            return ChatRoomCharacter.find(c =>
                                          c.Name?.toLowerCase() === lower ||
                                          c.Nickname?.toLowerCase() === lower ||
                                          c.AccountName?.toLowerCase() === lower
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
        }
    }

    function chatSendLocal(message, timeout = 10000) {
        if (typeof ChatRoomMessage === "function") {
            ChatRoomMessage({ Content: message, Type: "LocalMessage" }, timeout);
        } else {
            console.log("Local: " + message);
        }
    }

    function hasBCItemPermission(target) {
        return typeof ServerChatRoomGetAllowItem === "function"
            ? ServerChatRoomGetAllowItem(Player, target)
        : true;
    }

    function getRandomColor() {
        const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
        return colors[Math.floor(Math.random() * colors.length)];
    }

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
        "Bra_笨笨蛋Luzi", "Decals"
    ];

    // ===== 命令功能 =====
    function stealPanties(args) {
        try {
            let target;
            const targetArg = (args || "").trim();

            if (!targetArg) {
                target = Player;
            } else {
                target = getPlayer(targetArg);
                if (!target) {
                    return chatSendLocal(getMessage('notFound'));
                }
            }

            if (!hasBCItemPermission(target)) {
                return chatSendLocal(getMessage('noPermission'));
            }

            const targetNick = getNickname(target);
            const playerNick = getNickname(Player);
            const panties = InventoryGet(target, "Panties");

            try {
                InventoryRemove(target, "Panties");
                ChatRoomCharacterUpdate(target);
            } catch (e) {
                console.log("🐈‍⬛ [prank] ❌ Error removing panties:", e);
            }

            let itemColor = "Default";
            if (panties && panties.Color !== "Default") {
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

            InventoryRemove(Player, "ItemHandheld");

            const isZh = detectLanguage();
            const itemName = isZh ?
                  `${targetNick}刚脱下的内裤 💕` :
            `${targetNick}'s freshly removed panties 💕`;
            const itemDesc = isZh ?
                  `${targetNick}刚脱下的内裤，带有一点余温与气味💕` :
            `${targetNick}'s freshly removed panties, with a hint of warmth and scent 💕`;

            try {
                InventoryWear(Player, "Panties", "ItemHandheld", itemColor, 0, target.MemberNumber, {
                    Name: itemName,
                    Description: itemDesc,
                    Color: itemColor,
                    Private: true,
                    ItemProperty: {},
                    MemberNumber: target.MemberNumber,
                    MemberName: targetNick
                });
            } catch (e) {
                console.log("🐈‍⬛ [prank] ❌ InventoryWear error:", e);
                chatSendLocal(getMessage('stealFailed'));
                return;
            }

            ChatRoomCharacterUpdate(Player);

            if (target.MemberNumber === Player.MemberNumber) {
                chatSendCustomAction(playerNick + " " + getMessage('removedOwnUnderwear'));
            } else {
                chatSendCustomAction(playerNick + " " + getMessage('stealUnderwear') + " " + targetNick + getMessage('stealUnderwearSuffix'));
            }
        } catch (error) {
            console.error("Error in stealPanties:", error);
        }
    }

    function spillObscenePotion(args) {
        try {
            const target = getPlayer(args.trim());
            if (!target) {
                return chatSendLocal(getMessage('notFound'));
            }

            if (!hasBCItemPermission(target)) {
                return chatSendLocal(getMessage('noPermission'));
            }

            const noClothesFilter = (item) => !appearanceGroupNames.includes(item.Group);
            const appearance = ServerAppearanceBundle(target.Appearance).filter(noClothesFilter);

            ServerSend("ChatRoomCharacterUpdate", {
                ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
                ActivePose: target.ActivePose,
                Appearance: appearance
            });

            chatSendCustomAction(getNickname(Player) + " " + getMessage('dissolveClothes') + " " + getNickname(target) + getMessage('dissolveClothesTarget'));
        } catch (error) {
            console.error("Error in spillObscenePotion:", error);
        }
    }

    async function openPortal(args) {
        try {
            let roomName = args.trim();
            if (!roomName) {
                const promptText = detectLanguage() ? "输入房间名称" : "Enter room name";
                roomName = window.prompt(promptText);
                if (!roomName) return;
            }

            chatSendCustomAction(getNickname(Player) + " " + getMessage('enterPortal') + "「" + roomName + "」");

            setTimeout(() => {
                if (typeof ChatRoomLeave === "function") ChatRoomLeave();
                if (typeof CommonSetScreen === "function") CommonSetScreen("Online", "ChatSearch");
                if (typeof ServerSend === "function") {
                    ServerSend("ChatRoomJoin", { Name: roomName });
                    setTimeout(() => {
                        chatSendCustomAction(getNickname(Player) + " " + getMessage('exitPortal'));
                    }, 1000);
                }
            }, 500);
        } catch (error) {
            console.error("Error in openPortal:", error);
        }
    }

    // ===== 活动系统 =====
    let actData = {
        CustomPrerequisiteFuncs: new Map(),
        CustomActionCallbacks: new Map(),
        CustomImages: new Map(),
    };

    function AddCustomPrereq(prereq) {
        if (!actData.CustomPrerequisiteFuncs.get(prereq.Name))
            actData.CustomPrerequisiteFuncs.set(prereq.Name, prereq.Func);
    }

    function RegisterCustomFuncs(bundle, activity) {
        bundle.CustomPrereqs?.forEach((prereq) => {
            if (activity.Prerequisite.indexOf(prereq.Name) === -1)
                activity.Prerequisite.push(prereq.Name);
            AddCustomPrereq(prereq);
        });

        if (bundle.CustomAction && !actData.CustomActionCallbacks.get(activity.Name))
            actData.CustomActionCallbacks.set(activity.Name, bundle.CustomAction.Func);

        if (bundle.CustomImage && !actData.CustomImages.get(activity.Name))
            actData.CustomImages.set(activity.Name, bundle.CustomImage);
    }

    function AddTargetToActivity(activity, tgt) {
        tgt.TargetLabel = tgt.TargetLabel ?? activity.Name.substring(5);

        if (tgt.SelfAllowed) {
            if (!activity.TargetSelf) activity.TargetSelf = [];
            if (typeof activity.TargetSelf !== "boolean" && activity.TargetSelf.indexOf(tgt.Name) === -1) {
                activity.TargetSelf.push(tgt.Name);
            }
        }

        if (!tgt.SelfOnly) {
            if (!activity.Target) activity.Target = [];
            if (activity.Target.indexOf(tgt.Name) === -1) {
                activity.Target.push(tgt.Name);
            }
        }

        ActivityDictionary?.push(["Label-ChatOther-" + tgt.Name + "-" + activity.Name, tgt.TargetLabel]);
        ActivityDictionary?.push(["ChatOther-" + tgt.Name + "-" + activity.Name, tgt.TargetAction]);

        if (tgt.SelfAllowed) {
            ActivityDictionary?.push(["Label-ChatSelf-" + tgt.Name + "-" + activity.Name, tgt.TargetSelfLabel ?? tgt.TargetLabel]);
            ActivityDictionary?.push(["ChatSelf-" + tgt.Name + "-" + activity.Name, tgt.TargetSelfAction ?? tgt.TargetAction]);
        }
    }

    function AddActivity(bundle) {
        if (!bundle.Targets || bundle.Targets.length <= 0) return;

        let activity = bundle.Activity;
        activity.Target = activity.Target ?? [];
        activity.Prerequisite = activity.Prerequisite ?? [];
        activity.Name = "Liko_" + activity.Name;

        RegisterCustomFuncs(bundle, bundle.Activity);
        ActivityDictionary?.push(["Activity" + activity.Name, bundle.Targets[0].TargetLabel ?? activity.Name.substring(5)]);

        bundle.Targets.forEach((tgt) => {
            AddTargetToActivity(activity, tgt);
        });

        ActivityFemale3DCG.push(activity);
        ActivityFemale3DCGOrdering.push(activity.Name);
    }

    function hasRemovableClothing(target, group) {
        const clothingMap = {
            "ItemNeck": ["Suit", "Cloth", "Bra"],
            "ItemNipples": ["Suit", "Cloth", "Bra"],
            "ItemBreast": ["Suit", "Cloth", "Bra"],
            "ItemTorso": ["Suit", "Cloth", "Bra"],
            "ItemNeckAccessories": ["Suit", "Cloth", "Bra"],
            "ItemNeckRestraints": ["Suit", "Cloth", "Bra"],
            "ItemNipplesPiercings": ["Suit", "Cloth", "Bra"],
            "ItemTorso2": ["Suit", "Cloth", "Bra"],
            "ItemHands": ["Gloves"],
            "ItemHandheld": ["Gloves"],
            "ItemPelvis": ["ClothLower", "SuitLower", "Panties"],
            "ItemButt": ["ClothLower", "SuitLower", "Panties"],
            "ItemVulvaPiercings": ["ClothLower", "SuitLower", "Panties"],
            "ItemVulva": ["ClothLower", "SuitLower", "Panties"],
            "ItemBoots": ["Shoes", "Socks", "SocksRight", "SocksLeft"],
            "ItemLegs": ["Socks", "SocksRight", "SocksLeft"],
            "ItemFeet": ["Socks", "SocksRight", "SocksLeft"],
            "ItemMouth": ["Mask"],
            "ItemMouth2": ["Mask"],
            "ItemMouth3": ["Mask"]
        };

        if (group === "ItemLegs" || group === "ItemFeet") {
            const hasShoes = InventoryGet(target, "Shoes");
            if (hasShoes) return false;
        }

        const priority = clothingMap[group];
        if (!priority) return false;

        return priority.some(clothGroup => InventoryGet(target, clothGroup));
    }

    function removeClothing(target, group) {
        const clothingMap = {
            "ItemNeck": ["Suit", "Cloth", "Bra"],
            "ItemNipples": ["Suit", "Cloth", "Bra"],
            "ItemBreast": ["Suit", "Cloth", "Bra"],
            "ItemTorso": ["Suit", "Cloth", "Bra"],
            "ItemNeckAccessories": ["Suit", "Cloth", "Bra"],
            "ItemNeckRestraints": ["Suit", "Cloth", "Bra"],
            "ItemNipplesPiercings": ["Suit", "Cloth", "Bra"],
            "ItemTorso2": ["Suit", "Cloth", "Bra"],
            "ItemHands": ["Gloves"],
            "ItemHandheld": ["Gloves"],
            "ItemPelvis": ["ClothLower", "SuitLower", "Panties"],
            "ItemButt": ["ClothLower", "SuitLower", "Panties"],
            "ItemVulvaPiercings": ["ClothLower", "SuitLower", "Panties"],
            "ItemVulva": ["ClothLower", "SuitLower", "Panties"],
            "ItemBoots": ["Shoes", "Socks", "SocksRight", "SocksLeft"],
            "ItemLegs": ["Socks", "SocksRight", "SocksLeft"],
            "ItemFeet": ["Socks", "SocksRight", "SocksLeft"],
            "ItemMouth": ["Mask"],
            "ItemMouth2": ["Mask"],
            "ItemMouth3": ["Mask"]
        };

        if (group === "ItemLegs" || group === "ItemFeet") {
            const hasShoes = InventoryGet(target, "Shoes");
            if (hasShoes) return null;
        }

        const priority = clothingMap[group];
        if (!priority) return null;

        for (let clothGroup of priority) {
            const item = InventoryGet(target, clothGroup);
            if (item) {
                const itemName = (item.Asset && item.Asset.Description) || clothGroup;
                InventoryRemove(target, clothGroup);
                ChatRoomCharacterUpdate(target);
                return itemName;
            }
        }

        return null;
    }

    function stealItem(target, itemType) {
        let item, originalItemGroup, targetNick;
        targetNick = getNickname(target);

        if (itemType === "panties") {
            item = InventoryGet(target, "Panties");
            if (!item) return false;
            originalItemGroup = "Panties";
        } else if (itemType === "socks") {
            item = InventoryGet(target, "Socks") || InventoryGet(target, "SocksRight") || InventoryGet(target, "SocksLeft");
            if (!item) return false;
            if (InventoryGet(target, "Socks")) {
                originalItemGroup = "Socks";
            } else if (InventoryGet(target, "SocksRight")) {
                originalItemGroup = "SocksRight";
            } else {
                originalItemGroup = "SocksLeft";
            }
        }

        let itemColor = "Default";
        if (item.Color !== "Default") {
            itemColor = item.Color;
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

        if (itemType === "panties") {
            InventoryRemove(target, "Panties");
        } else if (itemType === "socks") {
            InventoryRemove(target, "Socks");
            InventoryRemove(target, "SocksRight");
            InventoryRemove(target, "SocksLeft");
        }
        ChatRoomCharacterUpdate(target);
        InventoryRemove(Player, "ItemHandheld");

        const handheldItemName = itemType === "panties" ? "Panties" : "LongSock";
        const isZh = detectLanguage();

        const itemName = isZh ?
              (itemType === "panties" ? `${targetNick}刚脱下的内裤 💕` : `${targetNick}刚脱下的袜子 💕`) :
        (itemType === "panties" ? `${targetNick}'s freshly removed panties 💕` : `${targetNick}'s freshly removed socks 💕`);

        const itemDesc = isZh ?
              (itemType === "panties" ? `${targetNick}刚脱下的内裤，带有一点余温与气味💕` : `${targetNick}刚脱下的袜子，带有一点余温与气味💕`) :
        (itemType === "panties" ? `${targetNick}'s freshly removed panties, with a hint of warmth and scent 💕` : `${targetNick}'s freshly removed socks, with a hint of warmth and scent 💕`);

        InventoryWear(Player, handheldItemName, "ItemHandheld", itemColor, 0, target.MemberNumber, {
            Name: itemName,
            Description: itemDesc,
            Color: itemColor,
            Private: true,
            ItemProperty: {},
            MemberNumber: target.MemberNumber,
            MemberName: targetNick
        });

        ChatRoomCharacterUpdate(Player);

        const finalHandItem = InventoryGet(Player, "ItemHandheld");
        if (!finalHandItem) {
            console.error("🐈‍⬛ [prank] ❌ Item failed to persist in hand!");
            return false;
        }

        return true;
    }

    function pluckingHair(target) {
        if (!hasBCItemPermission(target)) {
            return chatSendLocal(getMessage('noPermission'));
        }

        try {
            InventoryRemove(target, "额外头发_Luzi");
            ChatRoomCharacterUpdate(target);
        } catch (e) {
            console.log("🐈‍⬛ [prank] ❌ Error removing 额外头发_Luzi:", e);
        }

        return true;
    }

    // ===== 注册活动 =====
    function registerActivities() {
        ImagePathHelper.clearCache();

        actData.CustomPrerequisiteFuncs.set("LikoCanInteract", function(target1, target2, group) {
            return target1.CanInteract();
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasBCItemPermission", function(target1, target2, group) {
            return hasBCItemPermission(target2);
        });
        actData.CustomPrerequisiteFuncs.set("LikoHoldingScissors", function(target1, target2, group) {
            const handItem = InventoryGet(target1, "ItemHandheld");
            return handItem && handItem.Asset && handItem.Asset.Name === "Scissors";
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasClothing", function(target1, target2, group) {
            return true;
        });
        actData.CustomPrerequisiteFuncs.set("LikoTargetHasClothing", function(target1, target2, group) {
            return hasRemovableClothing(target2, group?.Name);
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasPanties", function(target1, target2, group) {
            return !!InventoryGet(target2, "Panties");
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasSocks", function(target1, target2, group) {
            return !!(InventoryGet(target2, "Socks") || InventoryGet(target2, "SocksRight") || InventoryGet(target2, "SocksLeft"));
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasAhoge", function(target1, target2, group) {
            return !!(InventoryGet(target2, "额外头发_Luzi"));
        });

        const clothingTargets = [
            "ItemNeck", "ItemNipples", "ItemBreast", "ItemTorso",
            "ItemNeckAccessories", "ItemNeckRestraints", "ItemNipplesPiercings", "ItemTorso2",
            "ItemHands", "ItemHandheld", "ItemPelvis", "ItemButt", "ItemVulvaPiercings", "ItemVulva",
            "ItemBoots", "ItemLegs", "ItemFeet", "ItemMouth", "ItemMouth2", "ItemMouth3"
        ];

        AddActivity({
            Activity: { Name: "CutClothes", MaxProgress: 50, MaxProgressSelf: 50, Prerequisite: [] },
            Targets: clothingTargets.map(t => ({
                TargetLabel: getMessage('actCutClothes'), Name: t, SelfAllowed: true,
                TargetAction: getMessage('actCutClothesDesc'), TargetSelfAction: getMessage('actCutClothesSelf')
            })),
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHoldingScissors", Func: actData.CustomPrerequisiteFuncs.get("LikoHoldingScissors") },
                { Name: "LikoTargetHasClothing", Func: actData.CustomPrerequisiteFuncs.get("LikoTargetHasClothing") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const focusGroup = target.FocusGroup?.Name;
                    if (focusGroup) {
                        const item = removeClothing(target, focusGroup);
                        if (item) {
                            const isSelf = target.MemberNumber === Player.MemberNumber;
                            if (isSelf) {
                                chatSendCustomAction(getNickname(Player) + " " + getMessage('cutOwnClothes') + " " + item);
                            } else {
                                chatSendCustomAction(getNickname(Player) + " " + getMessage('cutClothes') + " " + getNickname(target) + getMessage('cutClothesTarget') + " " + item);
                            }
                        } else {
                            chatSendCustomAction(getNickname(target) + " " + getMessage('nothingToRemove'));
                        }
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHandheld/Preview/Scissors.png")
        });

        AddActivity({
            Activity: { Name: "RemoveClothes", MaxProgress: 40, MaxProgressSelf: 40, Prerequisite: [] },
            Targets: clothingTargets.map(t => ({
                TargetLabel: getMessage('actRemoveClothes'), Name: t, SelfAllowed: true,
                TargetAction: getMessage('actRemoveClothesDesc'), TargetSelfAction: getMessage('actRemoveClothesSelf')
            })),
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoTargetHasClothing", Func: actData.CustomPrerequisiteFuncs.get("LikoTargetHasClothing") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const focusGroup = target.FocusGroup?.Name;
                    if (focusGroup) {
                        const item = removeClothing(target, focusGroup);
                        if (item) {
                            const isSelf = target.MemberNumber === Player.MemberNumber;
                            if (isSelf) {
                                chatSendCustomAction(getNickname(Player) + " " + getMessage('removeOwnClothes') + " " + item);
                            } else {
                                chatSendCustomAction(getNickname(Player) + " " + getMessage('removeClothes') + " " + getNickname(target) + getMessage('cutClothesTarget') + " " + item);
                            }
                        } else {
                            chatSendCustomAction(getNickname(target) + " " + getMessage('nothingToRemove'));
                        }
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/Activity/Caress.png")
        });

        AddActivity({
            Activity: { Name: "DissolveClothes", MaxProgress: 60, MaxProgressSelf: 60, Prerequisite: [] },
            Targets: [{
                TargetLabel: getMessage('actDissolveClothes'), Name: "ItemHead", SelfAllowed: true,
                TargetAction: getMessage('actDissolveClothesDesc'), TargetSelfAction: getMessage('actDissolveClothesSelf')
            }],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const noClothesFilter = (item) => !appearanceGroupNames.includes(item.Group);
                    const appearance = ServerAppearanceBundle(target.Appearance).filter(noClothesFilter);
                    ServerSend("ChatRoomCharacterUpdate", {
                        ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
                        ActivePose: target.ActivePose,
                        Appearance: appearance
                    });
                    const isSelf = target.MemberNumber === Player.MemberNumber;
                    if (isSelf) {
                        chatSendCustomAction(getNickname(Player) + " " + getMessage('dissolveOwnClothes'));
                    } else {
                        chatSendCustomAction(getNickname(Player) + " " + getMessage('dissolveClothes') + " " + getNickname(target) + getMessage('dissolveClothesTarget'));
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHandheld/Preview/PotionBottle.png")
        });

        AddActivity({
            Activity: { Name: "StealPanties", MaxProgress: 50, MaxProgressSelf: 50, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actStealPanties'), Name: "ItemButt", SelfAllowed: false, TargetAction: getMessage('actStealPantiesDesc') },
                { TargetLabel: getMessage('actStealPanties'), Name: "ItemVulvaPiercings", SelfAllowed: false, TargetAction: getMessage('actStealPantiesDesc') },
                { TargetLabel: getMessage('actStealPanties'), Name: "ItemVulva", SelfAllowed: false, TargetAction: getMessage('actStealPantiesDesc') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasPanties", Func: actData.CustomPrerequisiteFuncs.get("LikoHasPanties") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    if (!InventoryGet(target, "Panties")) {
                        chatSendCustomAction(getNickname(target) + " " + getMessage('noUnderwear'));
                        return;
                    }
                    if (stealItem(target, "panties")) {
                        chatSendCustomAction(getNickname(Player) + " " + getMessage('stoleUnderwear') + " " + getNickname(target) + getMessage('stealUnderwearSuffix'));
                    } else {
                        chatSendLocal(getMessage('stealFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/Panties/Preview/Panties1.png")
        });

        AddActivity({
            Activity: { Name: "RemoveAndHoldPanties", MaxProgress: 40, MaxProgressSelf: 40, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actRemoveHoldPanties'), Name: "ItemButt", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldPantiesDesc'), TargetSelfAction: getMessage('actRemoveHoldPantiesSelf') },
                { TargetLabel: getMessage('actRemoveHoldPanties'), Name: "ItemVulvaPiercings", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldPantiesDesc'), TargetSelfAction: getMessage('actRemoveHoldPantiesSelf') },
                { TargetLabel: getMessage('actRemoveHoldPanties'), Name: "ItemVulva", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldPantiesDesc'), TargetSelfAction: getMessage('actRemoveHoldPantiesSelf') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasPanties", Func: actData.CustomPrerequisiteFuncs.get("LikoHasPanties") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    if (!InventoryGet(target, "Panties")) {
                        chatSendLocal(getNickname(target) + " " + getMessage('noUnderwear'), 5000);
                        return;
                    }
                    if (stealItem(target, "panties")) {
                        const isSelf = target.MemberNumber === Player.MemberNumber;
                        if (isSelf) {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('holdOwnUnderwear'));
                        } else {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('removedAndHoldUnderwear') + " " + getNickname(target) + getMessage('holdUnderwear'));
                        }
                    } else {
                        chatSendLocal(getMessage('removeFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/Panties/Preview/Panties1.png")
        });

        AddActivity({
            Activity: { Name: "StealSocks", MaxProgress: 50, MaxProgressSelf: 50, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actStealSocks'), Name: "ItemFeet", SelfAllowed: false, TargetAction: getMessage('actStealSocksDesc') },
                { TargetLabel: getMessage('actStealSocks'), Name: "ItemLegs", SelfAllowed: false, TargetAction: getMessage('actStealSocksDesc') },
                { TargetLabel: getMessage('actStealSocks'), Name: "ItemBoots", SelfAllowed: false, TargetAction: getMessage('actStealSocksDesc') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasSocks", Func: actData.CustomPrerequisiteFuncs.get("LikoHasSocks") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const hasSocks = InventoryGet(target, "Socks") || InventoryGet(target, "SocksRight") || InventoryGet(target, "SocksLeft");
                    if (!hasSocks) {
                        chatSendLocal(getNickname(target) + " " + getMessage('noSocks'), 5000);
                        return;
                    }
                    if (stealItem(target, "socks")) {
                        chatSendCustomAction(getNickname(Player) + " " + getMessage('stoleSocks') + " " + getNickname(target) + getMessage('socksSuffix'));
                    } else {
                        chatSendLocal(getMessage('stealFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHood/Preview/Pantyhose.png")
        });

        AddActivity({
            Activity: { Name: "RemoveAndHoldSocks", MaxProgress: 40, MaxProgressSelf: 40, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actRemoveHoldSocks'), Name: "ItemFeet", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldSocksDesc'), TargetSelfAction: getMessage('actRemoveHoldSocksSelf') },
                { TargetLabel: getMessage('actRemoveHoldSocks'), Name: "ItemLegs", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldSocksDesc'), TargetSelfAction: getMessage('actRemoveHoldSocksSelf') },
                { TargetLabel: getMessage('actRemoveHoldSocks'), Name: "ItemBoots", SelfAllowed: true, TargetAction: getMessage('actRemoveHoldSocksDesc'), TargetSelfAction: getMessage('actRemoveHoldSocksSelf') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasSocks", Func: actData.CustomPrerequisiteFuncs.get("LikoHasSocks") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const hasSocks = InventoryGet(target, "Socks") || InventoryGet(target, "SocksRight") || InventoryGet(target, "SocksLeft");
                    if (!hasSocks) {
                        chatSendCustomAction(getNickname(target) + " " + getMessage('noSocks'));
                        return;
                    }
                    if (stealItem(target, "socks")) {
                        const isSelf = target.MemberNumber === Player.MemberNumber;
                        if (isSelf) {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('holdOwnSocks'));
                        } else {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('removedAndHoldSocks') + " " + getNickname(target) + getMessage('holdSocks'));
                        }
                    } else {
                        chatSendLocal(getMessage('removeFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHood/Preview/Pantyhose.png")
        });

        AddActivity({
            Activity: { Name: "PluckingHair_Razor", MaxProgress: 40, MaxProgressSelf: 40, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actPluckingHair'), Name: "ItemHead", SelfAllowed: true,
                 TargetAction: getMessage('actPluckingHair'), TargetSelfAction: getMessage('actPluckingHair') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasAhoge", Func: actData.CustomPrerequisiteFuncs.get("LikoHasAhoge") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const hasAhoge = !!(InventoryGet(target, "额外头发_Luzi"));
                    if (!hasAhoge) {
                        chatSendCustomAction(getNickname(target) + " " + getMessage('hasAhoge'));
                        return;
                    }
                    if (pluckingHair(target)) {
                        const isSelf = target.MemberNumber === Player.MemberNumber;
                        if (isSelf) {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('pluckingOwnHair'));
                        } else {
                            chatSendCustomAction(getNickname(Player) + " " + getMessage('pluckingHair') + " " + getNickname(target) + getMessage('pluckingHairSuffix'));
                        }
                    } else {
                        chatSendLocal(getMessage('removeFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHood/Preview/Pantyhose.png")
        });
    }

    // ===== Hook系统 =====
    function setupHooks() {
        if (!modApi || !modApi.hookFunction) return;

        modApi.hookFunction("ActivityCheckPrerequisite", 4, (args, next) => {
            const prereqName = args[0];
            if (actData.CustomPrerequisiteFuncs.has(prereqName)) {
                const func = actData.CustomPrerequisiteFuncs.get(prereqName);
                try {
                    return func(args[1], args[2], args[3]);
                } catch (error) {
                    console.error("🐈‍⬛ [prank] ❌ Prerequisite error:", error);
                }
            }
            return next(args);
        });

        modApi.hookFunction("ServerSend", 4, (args, next) => {
            const message = args[0];
            const params = args[1];

            if (message === "ChatRoomChat" && params.Type === "Activity") {
                const activityName = params.Dictionary?.find(d => d.ActivityName)?.ActivityName;

                if (activityName && activityName.startsWith("Liko_")) {
                    const targetMemberNumber = params.Dictionary?.find(d => d.TargetCharacter)?.TargetCharacter;
                    const target = ChatRoomCharacter.find(c => c.MemberNumber === targetMemberNumber);

                    if (target && actData.CustomActionCallbacks.has(activityName)) {
                        const callback = actData.CustomActionCallbacks.get(activityName);
                        callback(target, args, next);
                        return;
                    }
                }
            }

            return next(args);
        });

        modApi.hookFunction("ElementButton.CreateForActivity", 4, (args, next) => {
            const activity = args[1];
            if (activity?.Activity?.Name?.startsWith("Liko_")) {
                args[4] = args[4] || {};
                const customImage = actData.CustomImages.get(activity.Activity.Name);
                if (customImage) {
                    args[4].image = customImage;
                }
            }
            return next(args);
        });

        if (typeof GameVersion !== 'undefined' && GameVersion !== "R121") {
            modApi.hookFunction("PreferenceGetActivityFactor", 4, (args, next) => {
                if (typeof args[1] === "string" && args[1].indexOf("Liko_") === 0) {
                    return 2;
                }
                return next(args);
            });
        }
    }

    // ===== 初始化 =====
    // 修正：先等 bcModSdk 載入再 registerMod，避免同步執行時 SDK 尚未就緒
    // 修正：waitFor timeout 提高到 120 秒，避免登入較慢時超時
    (async () => {
        const sdkOk = await waitForBcModSdk();
        if (sdkOk) {
            try {
                modApi = bcModSdk.registerMod({
                    name: "liko's prank",
                    fullName: "Likolisu's prank on her friends",
                    version: modversion,
                    repository: "Liko's prank"
                });
                console.log("🐈‍⬛ [prank] ✅ Mod registered with bcModSdk");
            } catch (error) {
                console.error("🐈‍⬛ [prank] ❌ Failed to initialize modApi", error);
            }
        } else {
            console.warn("🐈‍⬛ [prank] ❌ bcModSdk not available, continuing without modApi");
        }

        try {
            // 等待玩家登入完成（MemberNumber > 0 確認已成功登入）
            await waitFor(() =>
                          typeof Player !== "undefined" &&
                          typeof Player.MemberNumber === "number" &&
                          Player.MemberNumber > 0
                         );

            // 注册命令
            if (typeof CommandCombine === "function") {
                const isZh = detectLanguage();
                CommandCombine([
                    { Tag: "steal", Description: isZh ? "偷取内裤" : "Steal panties", Action: (args) => stealPanties(args) },
                    { Tag: "偷取", Description: "偷取内裤", Action: (args) => stealPanties(args) },
                    { Tag: "dissolve", Description: isZh ? "溶解衣服" : "Dissolve clothes", Action: (args) => spillObscenePotion(args) },
                    { Tag: "溶解", Description: "溶解衣服", Action: (args) => spillObscenePotion(args) },
                    { Tag: "teleport", Description: isZh ? "传送" : "Teleport", Action: (args) => openPortal(args) },
                    { Tag: "傳送", Description: "传送", Action: (args) => openPortal(args) },
                    { Tag: "传送", Description: "传送", Action: (args) => openPortal(args) }
                ]);
            }

            // 等待活动系统
            await waitFor(() =>
                          typeof ActivityFemale3DCG !== "undefined" &&
                          typeof ActivityDictionary !== "undefined"
                         );

            registerActivities();
            setupHooks();
            chatSendLocal(getMessage('loaded'));

        } catch (error) {
            console.error("🐈‍⬛ [prank] ❌ Initialization failed:", error);
        }
    })();
})();
