// ==UserScript==
// @name         Liko - Prank
// @name:zh      Liko对朋友的恶作剧
// @namespace    https://likolisu.dev/
// @version      1.6.8
// @description  Likolisu's prank on her friends
// @description:zh Liko对朋友的恶作剧
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Prank.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Prank.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.6.8";
    if (window.Liko.Prank) return;
    window.Liko.Prank = MOD_VER;

    let modApi;

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

    // ===== 多语言支持 (i18n) =====
    // 引擎在 Plugins/expand/BC_i18n.js，翻译字库在 Plugins/Translation/Prank-i18n.js
    // production 走 CDN；本地测试由 window.LikoDevBase 覆写成 http://localhost/…/Plugins/
    const _I18N_BASE = (typeof window !== 'undefined' && window.LikoDevBase) || 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/';
    const LIKO_I18N_ENGINE_URL   = _I18N_BASE + 'expand/BC_i18n.js';
    const LIKO_PRANK_STRINGS_URL = _I18N_BASE + 'Translation/Prank-i18n.js';
    const I18N_NS = 'Prank';

    function loadScript(url) {
        return fetch(url)
            .then(res => { if (!res.ok) throw new Error(`[prank] 无法载入 ${url} (${res.status})`); return res.text(); })
            .then(code => { new Function(code)(); });
    }

    // 确保共用引擎与本插件字库都已载入（各只载入一次）
    // 用能力侦测（ensure）判断 v2 引擎 —— 旧版 v1 只有 version，会被误判为已载入而挡掉 v2。
    // 字库改用引擎的 ensure() 载入（依 URL 去重，不需自订旗标）。
    async function ensureI18n() {
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') await loadScript(LIKO_I18N_ENGINE_URL);
        if (typeof window.Liko?.__Sys_i18n__?.ensure === 'function') await window.Liko.__Sys_i18n__.ensure(I18N_NS, LIKO_PRANK_STRINGS_URL);
    }

    // 取翻译字串；引擎尚未就绪时回传 key 本身，不丢例外。vars 以 {name}/{v} 占位代入。
    function getMessage(key, vars) {
        const fn = window.Liko?.__Sys_i18n__?.t;
        return fn ? fn(I18N_NS, key, vars) : key;
    }

    // 语言侦测（保留给指令区使用；Command 不更动）
    function detectLanguage() {
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        return (navigator.language || 'en').toLowerCase().startsWith('zh');
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

    // ===== 動作旁白在地化（隱藏標籤，收訊端依「自己的語言」重寫） =====
    // 技術與 BC-AFC / window.Liko.__Sys_L10N__ 同源：Action 的 Dictionary 除了帶「底本」的
    // CUSTOM_SYSTEM_ACTION 條目外，再夾帶一個自訂條目 { Tag, data }。BC 伺服器只保留「非保留欄位」
    // 的自訂條目（Tag + 任意欄位），所以 data 能原封不動送達每個人（實測 2026-06-29）。
    //   • 底本（Text）用「發送者自己的語言」——沒裝 Prank 的人就看到發送者的語言（對同語系但
    //     不想裝插件的人友善）。
    //   • 有裝 Prank 的人 → 下方 hook 偵測到標籤，用「自己選的語言」把整句重新組出來覆寫顯示
    //     （含自己發的訊息）。
    // data 裝的是「食譜」：一個由「字面字串」與「字庫片段參照」組成的陣列，收訊端據此在自己語言下
    // 重組。這樣直接沿用既有的片語字庫，不必另建一份整句翻譯表。
    const PRANK_L10N_TAG   = 'Liko_Prank_L10N';
    const PRANK_CUSTOM_TAG = 'CUSTOM_SYSTEM_ACTION';

    // 取某語言下的字串（第四參數 forceLang：指定要抓的語言，不傳則用引擎的 detectLang）
    function getMessageLang(key, vars, lang) {
        const fn = window.Liko?.__Sys_i18n__?.t;
        return fn ? fn(I18N_NS, key, vars, lang) : key;
    }
    // 收訊端當下語言
    function localRenderLang() {
        return window.Liko?.__Sys_i18n__?.detectLang?.() || 'EN';
    }
    // 依「食譜」在指定語言組出整句。
    //   part 為字串           → 原樣輸出（暱稱、標點、道具名等）
    //   part 為 [key]/[key,vars] → 查字庫（在 lang 語言下）
    function renderRecipe(recipe, lang) {
        return recipe.map(p =>
            Array.isArray(p) ? getMessageLang(p[0], p[1], lang) : String(p ?? '')
        ).join('');
    }
    // 送出一條在地化動作旁白。parts：字面字串，或 [key] / [key, vars] 字庫片段。
    // 引擎不在時仍會送出（Text 為英文底本），不丟例外。
    function sendAction(...parts) {
        if (typeof ServerSend !== 'function') return;
        // 底本用「發送者自己的語言」：沒裝插件的人會看到發送者的語言（對同語系不想裝插件的人友善）；
        // 有裝插件的收訊端則由下方 hook 依「自己的語言」重寫。
        const base = renderRecipe(parts, localRenderLang());
        ServerSend('ChatRoomChat', {
            Type: 'Action',
            Content: PRANK_CUSTOM_TAG,
            Dictionary: [
                { Tag: `MISSING TEXT IN "Interface.csv": ${PRANK_CUSTOM_TAG}`, Text: base },
                { Tag: PRANK_L10N_TAG, data: JSON.stringify(parts) },
            ],
        });
    }
    // 收訊端：hook ChatRoomMessage（資料層），偵測 Prank 標籤 → 用自己的語言重寫 Text。
    // DOM 的 MutationObserver 看不到 Dictionary，一定要走 hookFunction 的資料層。
    let _prankL10nInstalled = false;
    function installPrankL10n() {
        if (_prankL10nInstalled || !modApi?.hookFunction) return;
        _prankL10nInstalled = true;
        modApi.hookFunction('ChatRoomMessage', 5, (a, next) => {
            try {
                const data = a[0];
                const dict = data && Array.isArray(data.Dictionary) ? data.Dictionary : null;
                const tag  = dict && dict.find(x => x && x.Tag === PRANK_L10N_TAG && typeof x.data === 'string');
                if (tag) {
                    const recipe = JSON.parse(tag.data);
                    if (Array.isArray(recipe)) {
                        const local  = renderRecipe(recipe, localRenderLang());
                        const custom = dict.find(x => x && typeof x.Tag === 'string' && x.Tag.includes(PRANK_CUSTOM_TAG));
                        if (custom) custom.Text = local; else data.Content = local;
                    }
                }
            } catch (e) { /* 壞掉就顯示英文底本，不影響其他訊息 */ }
            return next(a);
        });
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

    // 溶解時要「保留」的部位/物件群組（不在清單內者一律溶解）。
    const dissolveKeepGroups = [
        "ArmsLeft", "ArmsRight", "HandsLeft", "HandsRight", "Mouth", "Pronouns", "Head", "Blush",
        "Fluids", "Emoticon", "Eyes", "Eyes2", "右眼_Luzi", "Eyebrows", "BodyStyle", "HairFront",
        "Nipples", "Pussy", "BodyLower", "BodyUpper", "Height", "HairBack", "左眼_Luzi",
        "新后发_Luzi_stack", "外观工具", "新前发_Luzi", "Wings", "TailStraps", "HairAccessory2",
        "额外头发_Luzi", "新后发_Luzi", "新前发_Luzi_stack", "额外身高_Luzi", "动物身体_Luzi",
        "Wings_笨笨蛋Luzi", "Luzi_TailStraps_0"
    ];

    // 弱溶解：在上述保留群組之外，額外保留內衣褲。
    const dissolveKeepGroupsWeak = [
        ...dissolveKeepGroups,
        "Bra", "Panties", "Bra_笨笨蛋Luzi", "Panties_笨笨蛋Luzi"
    ];

    // 依保留清單溶解目標衣物：保留清單內的群組留下，其餘移除。
    function dissolveAppearance(target, mode) {
        const keepFilter = (item) => {
            // bundle 後 Group 是字串，Asset 是 undefined
            const group = item.Group ?? item.Asset?.Group?.Name;

            // bundle 後唯一可靠的判斷：Group 名稱以 "Item" 開頭 → 道具/拘束群組 → 保留
            const isItemGroup = typeof group === "string" && group.startsWith("Item");

            if (mode === "weak") {
                if (dissolveKeepGroupsWeak.includes(group)) return true;
                if (isItemGroup) return true;   // ← 保留拘束
                return false;
            } else if (mode === "normal") {
                if (dissolveKeepGroups.includes(group)) return true;
                if (isItemGroup) return true;   // ← 保留拘束
                return false;
            } else { // strong：只溶衣服，拘束依然保留
                if (dissolveKeepGroups.includes(group)) return true;
                return false;
            }
        };

        const appearance = ServerAppearanceBundle(target.Appearance).filter(keepFilter);
        ServerSend("ChatRoomCharacterUpdate", {
            ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
            ActivePose: target.ActivePose,
            Appearance: appearance
        });
    }

    function getItemColor(target, primaryColor) {
        if (primaryColor) {
            if (Array.isArray(primaryColor)) {
                const joined = primaryColor.filter(c => c && c !== "Default").join(",");
                if (joined) return joined;
            } else if (primaryColor !== "Default") {
                return primaryColor;
            }
        }
        for (const group of ["HairFront", "HairBack"]) {
            const color = InventoryGet(target, group)?.Color;
            if (color) {
                if (Array.isArray(color)) {
                    const joined = color.filter(c => c && c !== "Default").join(",");
                    if (joined) return joined;
                } else if (color !== "Default") {
                    return color;
                }
            }
        }
        return getRandomColor();
    }
    const AHOGE_GROUPS = [
        "HairAccessory3",
        "HairAccessory1",
        "HairAccessory3_笨笨蛋Luzi",
        "Luzi_HairAccessory3_1",
        "Luzi_HairAccessory3_2",
        "额外头发_Luzi"
    ];

    function getAhogeItems(target) {
        return target.Appearance.filter(item => {
            const groupName = item.Asset?.Group?.Name;
            const assetName = item.Asset?.Name;
            return AHOGE_GROUPS.includes(groupName) && assetName === "呆毛";
        });
    }

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

            let itemColor = getItemColor(target, panties?.Color);

            InventoryRemove(Player, "ItemHandheld");

            const itemName = getMessage('itemPantiesName', { name: targetNick });
            const itemDesc = getMessage('itemPantiesDesc', { name: targetNick });

            try {
                InventoryWear(Player, "Panties", "ItemHandheld", itemColor, 0, target.MemberNumber, {
                    Name: itemName,
                    Description: itemDesc,
                    Color: itemColor,
                    Private: true,
                    Item: "Panties",
                    Lock: "",
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
                sendAction(playerNick, " ", ['removedOwnUnderwear']);
            } else {
                sendAction(playerNick, " ", ['stealUnderwear'], " ", targetNick, ['stealUnderwearSuffix']);
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

            dissolveAppearance(target, "normal");

            sendAction(getNickname(Player), " ", ['dissolveClothesNormalMsg', { name: getNickname(target) }]);
            if (Math.random() < 0.1) {
                dissolveAppearance(Player, "weak");
                sendAction(getNickname(Player), " ", ['dissolveSprayedSelf', { name: getNickname(Player) }]);
            }
        } catch (error) {
            console.error("Error in spillObscenePotion:", error);
        }
    }

    async function openPortal(args) {
        try {
            let roomName = args.trim();
            if (!roomName) {
                const promptText = getMessage('enterRoomPrompt');
                roomName = window.prompt(promptText);
                if (!roomName) return;
            }

            sendAction(getNickname(Player), " ", ['enterPortal'], "「", roomName, "」");

            setTimeout(() => {
                if (typeof ChatRoomLeave === "function") ChatRoomLeave();
                if (typeof CommonSetScreen === "function") CommonSetScreen("Online", "ChatSearch");
                if (typeof ServerSend === "function") {
                    ServerSend("ChatRoomJoin", { Name: roomName });
                    setTimeout(() => {
                        sendAction(getNickname(Player), " ", ['exitPortal']);
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

    // ===== 活動標籤字典（R130：改用 TextCache，不再是 ActivityDictionary 陣列） =====
    // R130 起 ActivityDictionaryText() 不再讀全域 ActivityDictionary 陣列，而是從
    //   TextGetInScope(ScreenFileGetPath("ActivityDictionary.csv","Character","Preference"), key)
    // 也就是一個 TextCache 實例的 .cache 物件。所以把標籤 push 進舊陣列完全沒作用，按鈕上就會
    // 顯示 MISSING TEXT IN "ActivityDictionary": Label-ChatSelf-…。修法：把我們的標籤直接注入
    // 那個 TextCache，並掛 onRebuild 監聽器，語言切換／快取重建後自動重新注入。
    const _actDict = new Map();                                    // csvKey → 顯示文字
    const _grpMirror = { ItemVulva: "ItemPenis", ItemVulvaPiercings: "ItemGlans" }; // 有陰莖角色的群組鏡射
    function _dictSet(key, text) {
        if (text == null) return;
        _actDict.set(key, text);
        if (typeof ActivityDictionary !== "undefined") ActivityDictionary.push([key, text]); // 舊版 BC 相容
        // BC 對有陰莖的角色會把 ItemVulva/ItemVulvaPiercings 鏡射成 ItemPenis/ItemGlans 來找標籤，
        // 補上鏡射鍵，否則這些角色身上的偷內褲類活動標籤會 MISSING。
        for (const [from, to] of Object.entries(_grpMirror)) {
            const seg = "-" + from + "-";
            if (key.includes(seg)) {
                const mk = key.replace(seg, "-" + to + "-");
                _actDict.set(mk, text);
                if (typeof ActivityDictionary !== "undefined") ActivityDictionary.push([mk, text]);
            }
        }
    }

    // 把 _actDict 注入 R130 的 ActivityDictionary TextCache（含語言切換後自動重注入）
    function installActivityDict() {
        if (typeof TextPrefetchFile !== "function" || typeof ScreenFileGetPath !== "function") return; // 舊版 BC 無此機制
        let cache;
        try {
            cache = TextPrefetchFile(ScreenFileGetPath("ActivityDictionary.csv", "Character", "Preference"));
        } catch (e) { return; }
        if (!cache) return;
        const inject = () => { if (cache.cache) for (const [k, v] of _actDict) cache.cache[k] = v; };
        // onRebuild(fn, immediate=true)：立刻注入一次；之後每次快取重建（含語言切換）完成後再自動注入
        if (typeof cache.onRebuild === "function") cache.onRebuild(inject, true);
        else inject();
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

        _dictSet("Label-ChatOther-" + tgt.Name + "-" + activity.Name, tgt.TargetLabel);
        _dictSet("ChatOther-" + tgt.Name + "-" + activity.Name, tgt.TargetAction);

        if (tgt.SelfAllowed) {
            _dictSet("Label-ChatSelf-" + tgt.Name + "-" + activity.Name, tgt.TargetSelfLabel ?? tgt.TargetLabel);
            _dictSet("ChatSelf-" + tgt.Name + "-" + activity.Name, tgt.TargetSelfAction ?? tgt.TargetAction);
        }
    }

    function AddActivity(bundle) {
        if (!bundle.Targets || bundle.Targets.length <= 0) return;

        let activity = bundle.Activity;
        activity.Target = activity.Target ?? [];
        activity.Prerequisite = activity.Prerequisite ?? [];
        activity.Name = "Liko_" + activity.Name;

        RegisterCustomFuncs(bundle, bundle.Activity);
        _dictSet("Activity" + activity.Name, bundle.Targets[0].TargetLabel ?? activity.Name.substring(5));

        bundle.Targets.forEach((tgt) => {
            AddTargetToActivity(activity, tgt);
        });

        ActivityFemale3DCG.push(activity);
        // R130 修正：BC 把 ActivityFemale3DCGOrdering 從 var 改成 let 宣告。
        //   var 會掛到 window（用户脚本看得到）；let/const 的顶层声明只进「全局词法环境」，
        //   不挂 window，也不在用户脚本(Tampermonkey @grant none)的作用域里 ——
        //   直接裸写 ActivityFemale3DCGOrdering.push(...) 会抛 ReferenceError，
        //   连锁令整个 registerActivities() 被 phase2 的 try/catch 吞掉、所有按钮消失。
        //   该数组只用于活动排序（indexOf 找不到就排到最前），并非必要；
        //   用 typeof 侦测（对未声明标识符不会抛错）：拿得到就补进排序，拿不到就跳过。
        if (typeof ActivityFemale3DCGOrdering !== "undefined") {
            ActivityFemale3DCGOrdering.push(activity.Name);
        }
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

        let itemColor = getItemColor(target, item.Color);

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

        const itemName = getMessage(itemType === "panties" ? 'itemPantiesName' : 'itemSocksName', { name: targetNick });
        const itemDesc = getMessage(itemType === "panties" ? 'itemPantiesDesc' : 'itemSocksDesc', { name: targetNick });

        InventoryWear(Player, handheldItemName, "ItemHandheld", itemColor, 0, target.MemberNumber, {
            Name: itemName,
            Description: itemDesc,
            Color: itemColor,
            Private: true,
            Item: handheldItemName,
            Lock: "",
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
            chatSendLocal(getMessage('noPermission'));
            return false;
        }

        const ahoges = getAhogeItems(target);
        if (ahoges.length === 0) return false;

        // 對自己操作時不受 AllowFullWardrobeAccess 限制
        const isSelf = target.MemberNumber === Player.MemberNumber;
        const allowFullWardrobe = isSelf || target.OnlineSharedSettings?.AllowFullWardrobeAccess !== false;

        // 找第一根可拔的呆毛；他人且 AllowFullWardrobeAccess=false 時跳過 额外头发_Luzi
        const pluckable = ahoges.find(item => {
            if (!allowFullWardrobe && item.Asset?.Group?.Name === "额外头发_Luzi") return false;
            return true;
        });

        if (!pluckable) {
            // 所有呆毛都在受保護的群組（额外头发_Luzi），嘗試操作但伺服器會拒絕
            const groupName = ahoges[0].Asset.Group.Name;
            try {
                InventoryRemove(target, groupName);
                ChatRoomCharacterUpdate(target);
            } catch (e) {}
            return "rebirth";
        }

        const groupName = pluckable.Asset.Group.Name;
        try {
            InventoryRemove(target, groupName);
            ChatRoomCharacterUpdate(target);
            // 50% 機率：拔掉後又長出一根
            if (Math.random() < 0.5) return "regrow";
            return true;
        } catch (e) {
            console.log("🐈‍⬛ [prank] ❌ Error removing ahoge:", groupName, e);
            return false;
        }
    }

    function stealTail(target) {
        if (!hasBCItemPermission(target)) {
            return chatSendLocal(getMessage('noPermission'));
        }

        const targetNick = getNickname(target);

        const tailGroup = InventoryGet(target, "Luzi_TailStraps_0") ? "Luzi_TailStraps_0"
        : InventoryGet(target, "TailStraps")        ? "TailStraps"
        : null;
        if (!tailGroup) return false;

        const tailItem = InventoryGet(target, tailGroup);

        let itemColor = getItemColor(target, tailItem.Color);

        try {
            InventoryRemove(target, tailGroup);
            ChatRoomCharacterUpdate(target);
        } catch (e) {
            console.error("🐈‍⬛ [prank] ❌ Error removing tail:", e);
            return false;
        }

        InventoryRemove(Player, "ItemHandheld");

        const itemName = getMessage('itemTailName', { name: targetNick });
        const itemDesc = getMessage('itemTailDesc', { name: targetNick });

        try {
            InventoryWear(Player, "大号拉珠", "ItemHandheld", "Default" , 0, target.MemberNumber, {
                Name: itemName,
                Description: itemDesc,
                Color: itemColor,
                Private: true,
                Item: "大号拉珠",
                Lock: "",
                MemberNumber: target.MemberNumber,
                MemberName: targetNick
            });
        } catch (e) {
            console.error("🐈‍⬛ [prank] ❌ InventoryWear error:", e);
            chatSendLocal(getMessage('stealFailed'));
            return false;
        }

        ChatRoomCharacterUpdate(Player);

        const finalHandItem = InventoryGet(Player, "ItemHandheld");
        if (!finalHandItem) {
            console.error("🐈‍⬛ [prank] ❌ Item failed to persist in hand!");
            return false;
        }

        return true;
    }

    function insertAhoge(target) {
        if (!hasBCItemPermission(target)) {
            chatSendLocal(getMessage('noPermission'));
            return false;
        }

        // 找出目前已有呆毛的群組（僅用於排除，不代表全部佔用情況）
        const ahogeGroups = new Set(
            getAhogeItems(target).map(item => item.Asset?.Group?.Name)
        );

        // 對自己操作不受限；他人且 AllowFullWardrobeAccess=false 時，额外头发_Luzi 受保護不視為可用格
        const isSelfInsert = target.MemberNumber === Player.MemberNumber;
        const allowFullWardrobe = isSelfInsert || target.OnlineSharedSettings?.AllowFullWardrobeAccess !== false;
        const availableGroups = allowFullWardrobe ? AHOGE_GROUPS : AHOGE_GROUPS.filter(g => g !== "额外头发_Luzi");

        // 依優先順序找「真正空」的欄位：該群組完全沒有穿任何物品才算空，
        // 避免覆蓋掉已存在的其他物品（例如原本戴著的髮飾）
        const targetGroup = availableGroups.find(g => {
            if (ahogeGroups.has(g)) return false; // 已經是呆毛，跳過
            return !InventoryGet(target, g);      // 只有完全沒有物品的欄位才算空格
        });
        if (!targetGroup) return false; // 所有可用格已滿或被其他物品佔用

        // 找呆毛 asset（從 AssetFemale3DCG 找，避免寫死路徑）
        const ahogeAsset = AssetGet("Female3DCG", targetGroup, "呆毛");
        if (!ahogeAsset) {
            console.warn("🐈‍⬛ [prank] 找不到呆毛 asset in group:", targetGroup);
            return false;
        }

        // 隨機 typed 0~10
        const randomTyped = Math.floor(Math.random() * 11);

        try {
            InventoryWear(target, "呆毛", targetGroup, "Default", 0, null, null);

            // 設定 TypeRecord（InventoryWear 後再找到剛放上去的物件來改 Property）
            const worn = InventoryGet(target, targetGroup);
            if (worn) {
                if (!worn.Property) worn.Property = {};
                worn.Property.TypeRecord = { typed: randomTyped };
                worn.Property.Type = String(randomTyped === 1 ? "1a" :
                                            randomTyped === 0 ? "1" : String(randomTyped)); // 對應 Option Name
            }

            ChatRoomCharacterUpdate(target);
            return true;
        } catch (e) {
            console.error("🐈‍⬛ [prank] ❌ insertAhoge error:", e);
            return false;
        }
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
            return getAhogeItems(target2).length > 0;
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasEmptyAhogeSlot", function(target1, target2, group) {
            const ahogeGroups = new Set(getAhogeItems(target2).map(item => item.Asset?.Group?.Name));
            const isSelfSlot = target2.MemberNumber === Player.MemberNumber;
            const allowFullWardrobe = isSelfSlot || target2.OnlineSharedSettings?.AllowFullWardrobeAccess !== false;
            const available = allowFullWardrobe ? AHOGE_GROUPS : AHOGE_GROUPS.filter(g => g !== "额外头发_Luzi");
            return available.some(g => !ahogeGroups.has(g) && !InventoryGet(target2, g));
        });
        actData.CustomPrerequisiteFuncs.set("LikoPlayerMouthFree", function(target1, target2, group) {
            return !InventoryGroupIsBlocked(target1, "ItemMouth") && SpeechGetGagLevel(target1, "ItemMouth") === 0;
        });
        actData.CustomPrerequisiteFuncs.set("LikoHasTail", function(target1, target2, group) {
            return !!(InventoryGet(target2, "Luzi_TailStraps_0") || InventoryGet(target2, "TailStraps"));
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
                                sendAction(getNickname(Player), " ", ['cutOwnClothes'], " ", item);
                            } else {
                                sendAction(getNickname(Player), " ", ['cutClothes'], " ", getNickname(target), ['cutClothesTarget'], " ", item);
                            }
                        } else {
                            sendAction(getNickname(target), " ", ['nothingToRemove']);
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
                                sendAction(getNickname(Player), " ", ['removeOwnClothes'], " ", item);
                            } else {
                                sendAction(getNickname(Player), " ", ['removeClothes'], " ", getNickname(target), ['cutClothesTarget'], " ", item);
                            }
                        } else {
                            sendAction(getNickname(target), " ", ['nothingToRemove']);
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
                    dissolveAppearance(target, "normal");
                    const isSelf = target.MemberNumber === Player.MemberNumber;
                    if (isSelf) {
                        sendAction(getNickname(Player), " ", ['dissolveOwnClothes']);
                    } else {
                        sendAction(getNickname(Player), " ", ['dissolveClothesNormalMsg', { name: getNickname(target) }]);
                        if (Math.random() < 0.3) {
                            dissolveAppearance(Player, "weak");
                            sendAction(getNickname(Player), " ", ['dissolveSprayedSelf', { name: getNickname(Player) }]);
                        }
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHandheld/Preview/PotionBottle.png")
        });

        AddActivity({
            Activity: { Name: "DissolveClothesWeak", MaxProgress: 60, MaxProgressSelf: 60, Prerequisite: [] },
            Targets: [{
                TargetLabel: getMessage('actDissolveClothesWeak'), Name: "ItemHead", SelfAllowed: true,
                TargetAction: getMessage('actDissolveClothesDesc'), TargetSelfAction: getMessage('actDissolveClothesSelf')
            }],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    dissolveAppearance(target, "weak");
                    const isSelf = target.MemberNumber === Player.MemberNumber;
                    if (isSelf) {
                        sendAction(getNickname(Player), " ", ['dissolveOwnClothes']);
                    } else {
                        sendAction(getNickname(Player), " ", ['dissolveClothesWeakMsg', { name: getNickname(target) }]);
                        if (Math.random() < 0.1) {
                            dissolveAppearance(Player, "weak");
                            sendAction(getNickname(Player), " ", ['dissolveSprayedSelf', { name: getNickname(Player) }]);
                        }
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/ItemHandheld/Preview/PotionBottle.png")
        });

        AddActivity({
            Activity: { Name: "DissolveClothesStrong", MaxProgress: 80, MaxProgressSelf: 80, Prerequisite: [] },
            Targets: [{
                TargetLabel: getMessage('actDissolveClothesStrong'), Name: "ItemHead", SelfAllowed: true,
                TargetAction: getMessage('actDissolveClothesDesc'), TargetSelfAction: getMessage('actDissolveClothesSelf')
            }],
            CustomPrereqs: [
                { Name: "LikoCanInteract", Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    dissolveAppearance(target, "strong");
                    const isSelf = target.MemberNumber === Player.MemberNumber;
                    if (isSelf) {
                        sendAction(getNickname(Player), " ", ['dissolveOwnClothes']);
                    } else {
                        sendAction(getNickname(Player), " ", ['dissolveClothesStrongMsg', { name: getNickname(target) }]);
                        if (Math.random() < 0.1) {
                            dissolveAppearance(Player, "weak");
                            sendAction(getNickname(Player), " ", ['dissolveSprayedSelf', { name: getNickname(Player) }]);
                        }
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
                        sendAction(getNickname(target), " ", ['noUnderwear']);
                        return;
                    }
                    if (stealItem(target, "panties")) {
                        sendAction(getNickname(Player), " ", ['stoleUnderwear'], " ", getNickname(target), ['stealUnderwearSuffix']);
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
                            sendAction(getNickname(Player), " ", ['holdOwnUnderwear']);
                        } else {
                            sendAction(getNickname(Player), " ", ['removedAndHoldUnderwear'], " ", getNickname(target), ['holdUnderwear']);
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
                        sendAction(getNickname(Player), " ", ['stoleSocks'], " ", getNickname(target), ['socksSuffix']);
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
                        sendAction(getNickname(target), " ", ['noSocks']);
                        return;
                    }
                    if (stealItem(target, "socks")) {
                        const isSelf = target.MemberNumber === Player.MemberNumber;
                        if (isSelf) {
                            sendAction(getNickname(Player), " ", ['holdOwnSocks']);
                        } else {
                            sendAction(getNickname(Player), " ", ['removedAndHoldSocks'], " ", getNickname(target), ['holdSocks']);
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
                    const ahoges = getAhogeItems(target);
                    if (ahoges.length === 0) {
                        sendAction(getNickname(target), " ", ['hasAhoge']);
                        return;
                    }
                    const result = pluckingHair(target);
                    const isSelf = target.MemberNumber === Player.MemberNumber;
                    if (result === "rebirth") {
                        sendAction(getNickname(Player), " ", ['ahogeRebirth', { name: getNickname(target) }]);
                    } else if (result === "regrow") {
                        // 先送拔毛訊息
                        if (isSelf) {
                            sendAction(getNickname(Player), " ", ['pluckingOwnHair']);
                        } else {
                            sendAction(getNickname(Player), " ", ['pluckingHair'], " ", getNickname(target), ['pluckingHairSuffix']);
                        }
                        // 插回一根，再送冒出訊息
                        insertAhoge(target);
                        sendAction(['ahogeRegrow', { name: getNickname(target) }]);
                    } else if (result) {
                        if (isSelf) {
                            sendAction(getNickname(Player), " ", ['pluckingOwnHair']);
                        } else {
                            sendAction(getNickname(Player), " ", ['pluckingHair'], " ", getNickname(target), ['pluckingHairSuffix']);
                        }
                    } else {
                        chatSendLocal(getMessage('removeFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/Activity/MasturbateFist.png")
        });

        AddActivity({
            Activity: { Name: "InsertAhoge", MaxProgress: 40, MaxProgressSelf: 40, Prerequisite: [] },
            Targets: [
                {
                    TargetLabel: getMessage('actInsertAhoge'),
                    Name: "ItemHead",
                    SelfAllowed: true,
                    TargetAction: getMessage('actInsertAhogeDesc'),
                    TargetSelfAction: getMessage('actInsertAhogeSelf')
                }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract",         Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasEmptyAhogeSlot",   Func: actData.CustomPrerequisiteFuncs.get("LikoHasEmptyAhogeSlot") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const occupied = new Set(
                        getAhogeItems(target).map(item => item.Asset?.Group?.Name)
                    );
                    const hasSlot = AHOGE_GROUPS.some(g => !occupied.has(g));
                    if (!hasSlot) {
                        sendAction(getNickname(target), " ", ['ahogeSlotFull']);
                        return;
                    }
                    if (insertAhoge(target)) {
                        const isSelf = target.MemberNumber === Player.MemberNumber;
                        if (isSelf) {
                            sendAction(getNickname(Player), " ", ['insertOwnAhoge']);
                        } else {
                            sendAction(
                                getNickname(Player), " ", ['insertAhoge'],
                                " ", getNickname(target), ['insertAhogeSuffix', { name: getNickname(target) }]
                            );
                        }
                    } else {
                        chatSendLocal(getMessage('insertFailed'), 5000);
                    }
                }
            },
            CustomImage: "https://cdn.jsdelivr.net/gh/SugarChain-Studio/echo-clothing-ext@feae46427eb16ab1dc1e29ec1d323a167309e75f/resources/Assets/Female3DCG/%E9%A2%9D%E5%A4%96%E5%A4%B4%E5%8F%91_Luzi/Preview/%E5%91%86%E6%AF%9B.png"
        });

        AddActivity({
            Activity: { Name: "BiteEar", MaxProgress: 30, MaxProgressSelf: 30, Prerequisite: [] },
            Targets: [
                {
                    TargetLabel: getMessage('actBiteEar'),
                    Name: "ItemEars",
                    SelfAllowed: false,
                    TargetAction: getMessage('actBiteEarDesc')
                }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract",         Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission", Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoPlayerMouthFree",     Func: actData.CustomPrerequisiteFuncs.get("LikoPlayerMouthFree") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const targetNick = getNickname(target);
                    const playerNick = getNickname(Player);
                    const itemName = getMessage('itemCookieName', { name: targetNick });
                    const itemDesc = getMessage('itemCookieDesc', { name: targetNick });

                    InventoryRemove(Player, "ItemMouth");
                    try {
                        InventoryWear(Player, "曲奇", "ItemMouth", "Default", 0, target.MemberNumber, {
                            Name: itemName,
                            Description: itemDesc,
                            Private: true,
                            MemberNumber: target.MemberNumber,
                            MemberName: targetNick
                        });
                    } catch (e) {
                        console.error("🐈‍⬛ [prank] ❌ BiteEar InventoryWear error:", e);
                    }
                    ChatRoomCharacterUpdate(Player);

                    sendAction(playerNick, " ", ['biteEar'], " ", targetNick, ['biteEarSuffix']);
                }
            },
            CustomImage: "https://cdn.jsdelivr.net/gh/SugarChain-Studio/echo-clothing-ext@b827fd6921595dca58098ec34b52db47b4ab4f26/resources/Assets/Female3DCG/ItemMouth/Preview/%E6%9B%B2%E5%A5%87.png"
        });

        AddActivity({
            Activity: { Name: "PluckingTail", MaxProgress: 50, MaxProgressSelf: 50, Prerequisite: [] },
            Targets: [
                { TargetLabel: getMessage('actPluckingTail'), Name: "ItemButt", SelfAllowed: false,
                 TargetAction: getMessage('actPluckingTailDesc') }
            ],
            CustomPrereqs: [
                { Name: "LikoCanInteract",        Func: actData.CustomPrerequisiteFuncs.get("LikoCanInteract") },
                { Name: "LikoHasBCItemPermission",Func: actData.CustomPrerequisiteFuncs.get("LikoHasBCItemPermission") },
                { Name: "LikoHasTail",            Func: actData.CustomPrerequisiteFuncs.get("LikoHasTail") }
            ],
            CustomAction: {
                Func: (target, args, next) => {
                    const hasTail = !!(InventoryGet(target, "Luzi_TailStraps_0") || InventoryGet(target, "TailStraps"));
                    if (!hasTail) {
                        sendAction(getNickname(target), " ", ['noTail']);
                        return;
                    }
                    if (stealTail(target)) {
                        sendAction(
                            getNickname(Player), " ", ['pluckingTail'],
                            " ", getNickname(target), ['pluckingTailSuffix']
                        );
                    } else {
                        chatSendLocal(getMessage('stealFailed'), 5000);
                    }
                }
            },
            CustomImage: ImagePathHelper.getAssetURL("Female3DCG/Activity/MasturbateFist.png")
        });

        // R130：把上面所有活動的標籤注入 ActivityDictionary 的 TextCache，否則按鈕顯示 MISSING TEXT
        installActivityDict();
    }

    // ===== 活动按钮标记 (🪄) =====
    // .liko-prank-badge的z-index:0即可，甚至不設定
    function injectPrankBadgeStyle() {
        if (document.getElementById("liko-prank-badge-style")) return;
        const style = document.createElement("style");
        style.id = "liko-prank-badge-style";
        style.textContent = `
            .liko-prank-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                width: 1.4em;
                height: 1.4em;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                line-height: 1;
                pointer-events: auto;
                filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
            }
            .liko-prank-badge::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 110%;
                right: 0;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(0, 0, 0, 0.85);
                color: #fff;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.1s;
            }
            .liko-prank-badge:hover::after { opacity: 1; }
        `;
        document.head.appendChild(style);
    }

    function createPrankBadge() {
        const badge = document.createElement("div");
        badge.className = "liko-prank-badge";
        // 标记文字在按钮建立当下才取，确保此时 I18N 已就绪
        badge.setAttribute("data-tooltip", getMessage("badgeTooltip"));
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "🪄";
        return badge;
    }

    // ===== Hook系统 =====
    function setupHooks() {
        if (!modApi || !modApi.hookFunction) return;

        injectPrankBadgeStyle();
        installPrankL10n();   // 動作旁白在地化的收訊端 hook（裝一次即可）

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
            const isLiko = !!activity?.Activity?.Name?.startsWith("Liko_");
            if (isLiko) {
                args[4] = args[4] || {};
                const customImage = actData.CustomImages.get(activity.Activity.Name);
                if (customImage) {
                    args[4].image = customImage;
                }
            }

            const button = next(args);

            // 在自订活动按钮上加一个 🪄 小标记（仿 Echo）
            if (isLiko && button && typeof button.querySelector === "function"
                && !button.querySelector(".liko-prank-badge")) {
                if (!button.style.position) button.style.position = "relative";
                button.appendChild(createPrankBadge());
            }
            return button;
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

    async function phase2() {
        try {
            await waitFor(() =>
                          typeof CommandCombine === "function" &&
                          typeof ActivityFemale3DCG !== "undefined" &&
                          typeof ActivityDictionary !== "undefined",
                          30000  // 已知登入完成，30 秒綽綽有餘
                         );

            // 先确保 i18n 就绪，再注册活动（活动标签在注册当下就写入 ActivityDictionary，
            // 故必须先载入字库；载入失败则以 key 原文 fallback，不阻断注册）
            await ensureI18n().catch(e => console.warn("🐈‍⬛ [prank] ⚠️ i18n 载入失败，改以 key 显示:", e));

            const isZh = detectLanguage();
            CommandCombine([
                { Tag: "steal",    Description: isZh ? "偷取内裤" : "Steal panties",   Action: (args) => stealPanties(args) },
                { Tag: "偷取",     Description: "偷取内裤",                             Action: (args) => stealPanties(args) },
                { Tag: "dissolve", Description: isZh ? "溶解衣服" : "Dissolve clothes", Action: (args) => spillObscenePotion(args) },
                { Tag: "溶解",     Description: "溶解衣服",                             Action: (args) => spillObscenePotion(args) },
                { Tag: "teleport", Description: isZh ? "传送" : "Teleport",            Action: (args) => openPortal(args) },
                { Tag: "傳送",     Description: "傳送",                                 Action: (args) => openPortal(args) },
                { Tag: "传送",     Description: "传送",                                 Action: (args) => openPortal(args) }
            ]);

            registerActivities();
            chatSendLocal(getMessage('loaded', { v: MOD_VER }));

        } catch (error) {
            console.error("🐈‍⬛ [prank] ❌ Phase 2 (registration) failed:", error);
        }
    }

    (async () => {
        // ── Phase 1：SDK 就緒後立即執行，不依賴登入狀態 ──
        const sdkOk = await waitForBcModSdk();
        if (sdkOk) {
            try {
                modApi = bcModSdk.registerMod({
                    name: "liko - prank",
                    fullName: "Likolisu's prank on her friends",
                    version: MOD_VER,
                    repository: "Liko's prank"
                });
                console.log(`🐈‍⬛ [Prank] ✅ v${MOD_VER} loaded`);
            } catch (error) {
                console.error("🐈‍⬛ [prank] ❌ Failed to register mod", error);
            }
        }
        setupHooks();  // hooks 掛在遊戲函式上，不需要玩家登入
        window.Liko._debug = { getAhogeItems };
        // ── Phase 2 觸發：hook LoginResponse，登入完成時才註冊活動與指令 ──
        if (modApi?.hookFunction) {
            let phase2Done = false;
            modApi.hookFunction("LoginResponse", 1, (args, next) => {
                const result = next(args);
                if (!phase2Done) {
                    phase2Done = true;
                    phase2();
                }
                return result;
            });
        }
    })();
})();
