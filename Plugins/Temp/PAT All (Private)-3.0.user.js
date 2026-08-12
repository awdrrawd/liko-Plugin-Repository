// ==UserScript==
// @name         PAT All (Private)
// @namespace    https://chat.openai.com/
// @version      3.0
// @description  PatAll with stable settings interface, command system, and enhanced action selection
// @author       Likolisu & 約爾
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    'use strict';

    // modApi 初始化
    let modApi;
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: 'PatAll',
                fullName: 'Pat All(Private)',
                version: '3.0',
                repository: '對房內的朋友互動',
            });
            console.log("🐈‍⬛ [PatAll] ✅ 腳本啟動完成");
        } else {
            console.error("🐈‍⬛ [PatAll] ❌ bcModSdk 或 registerMod 不可用");
            return;
        }
    } catch (e) {
        console.error("🐈‍⬛ [PatAll] ❌ 初始化失敗:", e.message);
        return;
    }

    /* ------------------------------ 直接撈遊戲的部位/動作與翻譯 ------------------------------ */
    const FAMILY = "Female3DCG";

    // 人物骨架點擊圖：部位的可點區塊（角色 0..500 × 0..1000 座標）優先取遊戲 .Zone，取不到用內建 fallback
    const PART_ZONE_FALLBACK = {
        ItemHead:[[175,0,150,65]], ItemNose:[[175,65,150,65]], ItemEars:[[100,0,75,130]], ItemHood:[[325,0,75,130]],
        ItemMouth:[[100,130,100,70]], ItemNeck:[[200,200,100,70]], ItemNipples:[[100,270,100,70]], ItemBreast:[[300,270,100,70]],
        ItemTorso:[[100,340,150,80]], ItemArms:[[45,340,55,240],[400,340,55,240]],
        ItemHands:[[45,585,55,110],[400,585,55,110]], ItemPelvis:[[100,420,300,80]],
        ItemVulva:[[100,500,100,80]], ItemVulvaPiercings:[[200,500,100,80]], ItemButt:[[300,500,100,80]],
        ItemLegs:[[100,580,300,170]], ItemFeet:[[100,750,300,120]], ItemBoots:[[100,870,300,130]],
    };
    // 骨架上要放的部位（涵蓋常用動作部位）
    const BODY_PARTS = Object.keys(PART_ZONE_FALLBACK);

    // 角色座標 → 畫布左側面板座標（等比縮放）
    const BODY = { ox: 140, oy: 150, scale: 0.72 }; // x:140..500  y:150..870
    const bx = (v) => BODY.ox + v * BODY.scale;
    const by = (v) => BODY.oy + v * BODY.scale;
    const bs = (v) => v * BODY.scale;

    // 某部位的點擊區塊（[[x,y,w,h],...]），先撈遊戲、再退回內建
    function partZones(group) {
        try {
            const g = (typeof AssetGroupGet === "function") && AssetGroupGet(FAMILY, group);
            if (g && Array.isArray(g.Zone) && g.Zone.length) return g.Zone;
        } catch {}
        return PART_ZONE_FALLBACK[group] || null;
    }

    // 安全取字典字串（找不到回空字串，而非 "MISSING TEXT ..."）
    function dictText(key) {
        if (typeof ActivityDictionaryText !== "function") return "";
        const t = ActivityDictionaryText(key);
        return (t && !t.startsWith("MISSING TEXT IN")) ? t : "";
    }

    // 部位顯示名（跟隨玩家語言）
    function partLabel(group) {
        return (typeof AssetGroupGet === "function" && AssetGroupGet(FAMILY, group)?.Description) || group;
    }

    // 某部位對他人可用的動作：value=原名, label=遊戲翻譯
    function getGameActions(group) {
        if (!group || typeof AssetActivitiesForGroup !== "function") return [];
        const acts = AssetActivitiesForGroup(FAMILY, group, "other") || [];
        return acts.map(a => ({
            value: a.Name,
            label: dictText("Label-ChatOther-" + group + "-" + a.Name) || a.Name
        }));
    }

    // 動作原名 → 遊戲翻譯（列表顯示用）
    function actionLabel(group, name) {
        if (!name) return "";
        return dictText("Label-ChatOther-" + group + "-" + name) || name;
    }


    // Page2 版面（骨架在左、動作表右移；畫布 2000x1000）
    const PAGE2 = {
        rowStartY: 300, rowH: 76,
        checkX: 610, checkW: 55,
        partX: 685, partW: 120,
        actionX: 820, actionW: 235,
        labelX: 1075, labelW: 205,
        tipX: 1300, tipW: 250,
        editBtnX: 1600, editBtnW: 90, editBtnH: 40,
        boxH: 45,
    };
    const page2RowTop = (i) => PAGE2.rowStartY + i * PAGE2.rowH;

    // 全域狀態（並同步到 window，避免 Tampermonkey 沙盒取不到）
    let currentPage = 1;
    let patAllSettings = {
        mode: 'normal',
        whitelist: [],
        blacklist: [],
        delay: 500,
        actions: [
            { enabled: true,  part: 'ItemHead',  action: 'Pet',      label: '摸頭',  tooltip: '對所有人摸頭' },
            { enabled: true,  part: 'ItemMouth', action: 'EatItem',  label: '餵食',  tooltip: '餵所有人手中的物品' },
            { enabled: true,  part: 'ItemHands', action: 'LSCG_Eat', label: '吃東西', tooltip: '吃所有人手中的東西' },
            { enabled: false, part: 'ItemHands', action: 'LSCG_Chew',label: '咬一口', tooltip: '咬一口所有人手中的東西' },
            { enabled: false, part: 'ItemHead',  action: 'Kiss',     label: '親吻',  tooltip: '親吻所有人' }
        ]
    };
    function syncGlobals() {
        window.patAllSettings = patAllSettings;
    }
    syncGlobals();

    /* ------------------------------ 內嵌編輯狀態與輸入框輔助 ------------------------------ */
    let inlineEdit = {
        page1Editing: null,        // 'whitelist' | 'blacklist' | 'delay' | null
        page2EditingIndex: null,   // 0..N-1 | null
        page2Backup: null,         // 進入編輯前該列的備份（供「取消」還原）
    };

    // 移除所有可能的輸入框和下拉選單
    function removeAllInputs() {
        try { ElementRemove("whitelist"); } catch {}
        try { ElementRemove("blacklist"); } catch {}
        try { ElementRemove("delay"); } catch {}
        (patAllSettings.actions || []).forEach((_, i) => {
            try { ElementRemove(`action_label_${i}`); } catch {}
            try { ElementRemove(`action_tooltip_${i}`); } catch {}
            try { ElementRemove(`action_part_${i}`); } catch {}
            try { ElementRemove(`action_action_${i}`); } catch {}
        });
    }

    // Page1：根據狀態渲染/移除輸入框
    function renderPage1Inputs(S, G) {
        try { ElementRemove("whitelist"); } catch {}
        try { ElementRemove("blacklist"); } catch {}
        try { ElementRemove("delay"); } catch {}
        if (!G) return;

        const rowH = G.ROW_H || 70;
        const baseInfoY = G.baseInfoY || (220 + 5 * 70 + 30);
        const valueY = (rowTop) => rowTop + Math.floor((rowH - 40) / 2);
        const whiteTop = baseInfoY;
        const blackTop = baseInfoY + rowH;
        const delayTop = baseInfoY + 2 * rowH;

        if (inlineEdit.page1Editing === 'whitelist') {
            ElementCreateInput("whitelist", "text", (S.whitelist || []).join(", "), "以逗號分隔");
            ElementPosition("whitelist", 1120, 644, G.valW || 600, 45);
        } else if (inlineEdit.page1Editing === 'blacklist') {
            ElementCreateInput("blacklist", "text", (S.blacklist || []).join(", "), "以逗號分隔");
            ElementPosition("blacklist", 1120, 714, G.valW || 600, 45);
        } else if (inlineEdit.page1Editing === 'delay') {
            ElementCreateInput("delay", "number", String(S.delay || 0), "0 以上整數");
            ElementPosition("delay", 930, 784, 220, 45);
            const el = document.getElementById("delay");
            if (el) { el.min = "0"; el.step = "1"; el.inputMode = "numeric"; }
        }
    }
    // 動作 label → value 對照
    let actionLabelToValue = {};

    // Page2：只渲染「動作下拉 + 名稱 + 說明」三個輸入框；部位改由左側骨架點選
    function renderPage2Inputs(S) {
        const idx = inlineEdit.page2EditingIndex;
        if (idx == null) return;

        const P = PAGE2;
        const cy = page2RowTop(idx) + Math.floor(P.rowH / 2); // ElementPosition 以中心定位
        const a = S.actions[idx];

        updateActionDropdown(idx, a.part);

        ElementCreateInput(`action_label_${idx}`, "text", a.label || "", "自訂顯示名稱");
        ElementPosition(`action_label_${idx}`, P.labelX + P.labelW / 2, cy, P.labelW, P.boxH);

        ElementCreateInput(`action_tooltip_${idx}`, "text", a.tooltip || "", "提示文字/說明");
        ElementPosition(`action_tooltip_${idx}`, P.tipX + P.tipW / 2, cy, P.tipW, P.boxH);
    }

    // 收起目前編輯列：把輸入框的值寫回設定並移除元素
    function commitPage2Edit() {
        const i = inlineEdit.page2EditingIndex;
        if (i == null) return;
        const a = patAllSettings.actions[i];
        const labelId = `action_label_${i}`, tipId = `action_tooltip_${i}`, actionId = `action_action_${i}`;
        if (document.getElementById(labelId)) { const v = ElementValue(labelId); if (typeof v === "string") a.label = v; }
        if (document.getElementById(tipId))   { const v = ElementValue(tipId);   if (typeof v === "string") a.tooltip = v; }
        // a.action 已於下拉 onChange 即時寫入
        try { ElementRemove(labelId); } catch {}
        try { ElementRemove(tipId); } catch {}
        try { ElementRemove(actionId); } catch {}
        inlineEdit.page2EditingIndex = null;
    }

    function updateActionDropdown(idx, selectedPart) {
        try { ElementRemove(`action_action_${idx}`); } catch {}

        const P = PAGE2;
        const cx = P.actionX + P.actionW / 2;
        const cy = page2RowTop(idx) + Math.floor(P.rowH / 2);

        if (!selectedPart) {
            ElementCreateDropdown(`action_action_${idx}`, ["← 於左側骨架選部位"], () => {});
            ElementPosition(`action_action_${idx}`, cx, cy, P.actionW, P.boxH);
            return;
        }

        // 直接撈遊戲動作與翻譯
        const gameActions = getGameActions(selectedPart);
        actionLabelToValue = {};
        const actionOptions = gameActions.map(o => { actionLabelToValue[o.label] = o.value; return o.label; });
        if (actionOptions.length === 0) actionOptions.push("無可用動作");

        ElementCreateDropdown(`action_action_${idx}`, actionOptions, () => {
            const selectedLabel = ElementValue(`action_action_${idx}`);
            patAllSettings.actions[idx].action = actionLabelToValue[selectedLabel] || "";
        });
        ElementPosition(`action_action_${idx}`, cx, cy, P.actionW, P.boxH);

        // 預設值：存 value，顯示 label
        const a = patAllSettings.actions[idx];
        if (a && a.action && actionLabelToValue[actionLabel(selectedPart, a.action)] === a.action) {
            ElementValue(`action_action_${idx}`, actionLabel(selectedPart, a.action));
        } else if (gameActions.length > 0) {
            a.action = gameActions[0].value;
            ElementValue(`action_action_${idx}`, gameActions[0].label);
        }
    }

    /* ------------------------------ 設定存取 ------------------------------ */
    function initializeSettings() {
        // 移除這行，不能直接賦值整個 ExtensionSettings
        // if (!Player?.ExtensionSettings) Player.ExtensionSettings = {};
        if (!Player?.ExtensionSettings) return;
        if (!Player.ExtensionSettings.PatAll) {
            Player.ExtensionSettings.PatAll = { ...patAllSettings };
            if (typeof ServerPlayerExtensionSettingsSync === 'function')
                ServerPlayerExtensionSettingsSync("PatAll");
        } else {
            patAllSettings = { ...Player.ExtensionSettings.PatAll };
            if (!patAllSettings.actions.some(a => a.enabled)) patAllSettings.actions[0].enabled = true;
        }
        syncGlobals();
    }

    function saveSettings() {
        if (!Player?.ExtensionSettings) return;
        Player.ExtensionSettings.PatAll = { ...patAllSettings };
        if (typeof ServerPlayerExtensionSettingsSync === 'function')
            ServerPlayerExtensionSettingsSync("PatAll");
        syncGlobals();
    }

    /* ------------------------------ 群體動作核心 ------------------------------ */
    function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

    function makeActivityPacket(target, group, name) {
        // group=部位原名, name=動作原名（皆已是遊戲 value），直接組封包
        const needsItem = /Item|LSCG_Eat|LSCG_Chew/i.test(name);
        const packet = {
            Content: `ChatOther-${group}-${name}`,
            Type: "Activity",
            Dictionary: [
                { "SourceCharacter": Player.MemberNumber },
                { "TargetCharacter": target },
                { "Tag": "FocusAssetGroup", "FocusGroupName": group }
            ]
        };

        if (needsItem && name.includes("Item")) {
            const handItem = InventoryGet(Player, "ItemHandheld");
            if (handItem?.Asset) {
                const activityAsset = { "Tag": "ActivityAsset", AssetName: handItem.Asset.Name, GroupName: "ItemHandheld" };
                if (handItem.CraftName || handItem.Craft?.Name) activityAsset.CraftName = handItem.CraftName || handItem.Craft?.Name;
                packet.Dictionary.push(activityAsset);
            } else return null;
        }

        if (needsItem && (name.includes("LSCG_Eat") || name.includes("LSCG_Chew"))) {
            const targetChar = ChatRoomCharacter.find(c => c.MemberNumber === target);
            if (!targetChar) return null;
            const targetHandItem = InventoryGet(targetChar, "ItemHandheld");
            if (targetHandItem?.Asset) {
                const activityAsset = { "Tag": "ActivityAsset", AssetName: targetHandItem.Asset.Name, GroupName: "ItemHandheld" };
                if (targetHandItem.CraftName || targetHandItem.Craft?.Name) activityAsset.CraftName = targetHandItem.CraftName || targetHandItem.Craft?.Name;
                packet.Dictionary.push(activityAsset);
            } else return null;
        }

        packet.Dictionary.push({ "ActivityName": name });
        return packet;
    }

    async function doActivity(group, name, mode = patAllSettings.mode, delayMs = patAllSettings.delay) {
        if (!Array.isArray(ChatRoomCharacter)) {
            ChatRoomSendLocal("⚠ 錯誤：您不在聊天室內", 3000);
            return;
        }
        let count = 0;
        for (const character of ChatRoomCharacter) {
            if (character.MemberNumber === Player.MemberNumber) continue;

            // 模式檢查
            if (mode === 'normal' && !ServerChatRoomGetAllowItem(Player, character)) continue;
            if (mode === 'onlywhite' && !patAllSettings.whitelist.includes(character.MemberNumber)) continue;
            if ((mode === 'skipblack' || mode === 'private') && patAllSettings.blacklist.includes(character.MemberNumber)) continue;
            if (mode === 'private' && !ServerChatRoomGetAllowItem(Player, character)) continue;

            const packet = makeActivityPacket(character.MemberNumber, group, name);
            if (!packet) continue;

            // --- 新增檢查：避免發送「無可用動作」 ---
            if (packet.Content.endsWith("-無可用動作")) {
                ChatRoomSendLocal("⚠ 請先選擇動作", 3000);
                break;
            }

            ServerSend("ChatRoomChat", packet);
            count++;
            await delay(delayMs);
        }
        ChatRoomSendLocal(`🎉 完成！共對 ${count} 個人執行了動作`, 3000);
    }


    /* ------------------------------ 命令處理 ------------------------------ */
    function handlePatCommand(text) {
        initializeSettings();
        const args = text.trim().split(/\s+/);
        const subCommand = args[0]?.toLowerCase() || "";
        const commandText = args.slice(1).join(" ");

        const commands = {
            do1: () => {
                const action = patAllSettings.actions[0];
                if (action.enabled) doActivity(action.part, action.action);
                else ChatRoomSendLocal(`動作 1 未啟用，當前設定：${JSON.stringify(action)}`, 3000);
            },
            do2: () => {
                const action = patAllSettings.actions[1];
                if (action.enabled) doActivity(action.part, action.action);
                else ChatRoomSendLocal(`動作 2 未啟用，當前設定：${JSON.stringify(action)}`, 3000);
            },
            do3: () => {
                const action = patAllSettings.actions[2];
                if (action.enabled) doActivity(action.part, action.action);
                else ChatRoomSendLocal(`動作 3 未啟用，當前設定：${JSON.stringify(action)}`, 3000);
            },
            do4: () => {
                const action = patAllSettings.actions[3];
                if (action.enabled) doActivity(action.part, action.action);
                else ChatRoomSendLocal(`動作 4 未啟用，當前設定：${JSON.stringify(action)}`, 3000);
            },
            do5: () => {
                const action = patAllSettings.actions[4];
                if (action.enabled) doActivity(action.part, action.action);
                else ChatRoomSendLocal(`動作 5 未啟用，當前設定：${JSON.stringify(action)}`, 3000);
            },
            delay: () => {
                const delay = parseInt(commandText);
                if (isNaN(delay) || delay < 0) {
                    ChatRoomSendLocal("延遲必須為 0 或正整數", 3000);
                    return;
                }
                patAllSettings.delay = delay;
                saveSettings();
                ChatRoomSendLocal(`延遲設定為 ${delay} 毫秒`, 3000);
            },
            mode: () => {
                const modes = ['normal', 'onlywhite', 'skipblack', 'private', 'all'];
                if (!modes.includes(commandText.toLowerCase())) {
                    ChatRoomSendLocal(`無效模式，請使用：${modes.join(', ')}`, 3000);
                    return;
                }
                patAllSettings.mode = commandText.toLowerCase();
                saveSettings();
                ChatRoomSendLocal(`模式設定為 ${commandText}`, 3000);
            },
            list: () => {
                ChatRoomSendLocal(
                    `白名單：${patAllSettings.whitelist.join(',') || '無'}\n黑名單：${patAllSettings.blacklist.join(',') || '無'}`,
                    3000
                );
            },
            addwhite: () => {
                const member = parseInt(commandText);
                if (isNaN(member)) {
                    ChatRoomSendLocal("請輸入有效的會員編號", 3000);
                    return;
                }
                if (patAllSettings.whitelist.includes(member)) {
                    ChatRoomSendLocal(`${member} 已在白名單中`, 3000);
                    return;
                }
                patAllSettings.whitelist.push(member);
                saveSettings();
                ChatRoomSendLocal(`已添加 ${member} 到白名單`, 3000);
            },
            addblack: () => {
                const member = parseInt(commandText);
                if (isNaN(member)) {
                    ChatRoomSendLocal("請輸入有效的會員編號", 3000);
                    return;
                }
                if (patAllSettings.blacklist.includes(member)) {
                    ChatRoomSendLocal(`${member} 已在黑名單中`, 3000);
                    return;
                }
                patAllSettings.blacklist.push(member);
                saveSettings();
                ChatRoomSendLocal(`已添加 ${member} 到黑名單`, 3000);
            },
            rewhite: () => {
                const member = parseInt(commandText);
                if (isNaN(member)) {
                    ChatRoomSendLocal("請輸入有效的會員編號", 3000);
                    return;
                }
                if (!patAllSettings.whitelist.includes(member)) {
                    ChatRoomSendLocal(`${member} 不在白名單中`, 3000);
                    return;
                }
                patAllSettings.whitelist = patAllSettings.whitelist.filter(m => m !== member);
                saveSettings();
                ChatRoomSendLocal(`已移除 ${member} 從白名單`, 3000);
            },
            reblack: () => {
                const member = parseInt(commandText);
                if (isNaN(member)) {
                    ChatRoomSendLocal("請輸入有效的會員編號", 3000);
                    return;
                }
                if (!patAllSettings.blacklist.includes(member)) {
                    ChatRoomSendLocal(`${member} 不在黑名單中`, 3000);
                    return;
                }
                patAllSettings.blacklist = patAllSettings.blacklist.filter(m => m !== member);
                saveSettings();
                ChatRoomSendLocal(`已移除 ${member} 從黑名單`, 3000);
            },
            help: () => {
                ChatRoomSendLocal(
                    `PAT ALL 使用說明\n` +
                    `/patall do<1-5> - 執行動作 1 至 5\n` +
                    `/patall delay <毫秒> - 設定延遲（0 或正整數）\n` +
                    `/patall mode <normal/onlywhite/skipblack/private/all> - 設定模式\n` +
                    `/patall list - 顯示白/黑名單\n` +
                    `/patall addwhite <會員編號> - 添加白名單\n` +
                    `/patall addblack <會員編號> - 添加黑名單\n` +
                    `/patall rewhite <會員編號> - 移除白名單\n` +
                    `/patall reblack <會員編號> - 移除黑名單`,
                    20000
                );
            }
        };

        if (commands[subCommand]) {
            try {
                commands[subCommand]();
            } catch (e) {
                console.error(`🐈‍⬛ [PatAll] 命令 ${subCommand} 執行錯誤:`, e.message, e.stack);
                ChatRoomSendLocal(`執行 /patall ${subCommand} 失敗：${e.message}`, 3000);
            }
        } else {
            commands.help();
        }
    }

    /* ------------------------------ 畫面：共用工具 ------------------------------ */
    function withLeftAlign(fn) {
        const prev = MainCanvas.textAlign;
        MainCanvas.textAlign = "left";
        try { fn(); } finally { MainCanvas.textAlign = prev; }
    }

    function drawBackButton() {
        DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", "返回");
    }

    function handleBackClick() {
        if (MouseIn(1815, 75, 90, 90)) {
            if (typeof PreferenceExit === "function") { PreferenceExit(); return true; }
            if (typeof CommonSetScreen === "function") { CommonSetScreen("Online", "ChatRoom"); return true; }
            return true;
        }
        return false;
    }


    /* ------------------------------ 畫面：Page1 / Page2 ------------------------------ */
    function drawPage1(S) {
        const cfg = {
            left: 320, top: 220,
            checkW: 60, checkH: 60,
            gapX: 16, rowH: 70, fontSize: 24,
            btnX: 1580, btnW: 120, btnH: 44,
            labelX: 420, labelW: 380,
            valX: 820,  valW: 600,
            listBottomGap: 30,
            baselineOffset: 2, textMaxRight: 1200
        };
        const modes = [
            { key: "all",       text: "所有人" },
            { key: "onlywhite", text: "只白名單" },
            { key: "skipblack", text: "跳過黑名單" },
            { key: "normal",    text: "跳過沒有觸碰權限" },
            { key: "private",   text: "跳過沒有觸碰權限與黑名單" }
        ];
        const checkX = cfg.left;
        const textX  = cfg.left + cfg.checkW + cfg.gapX;
        const textW  = cfg.textMaxRight - textX;
        let yTop = cfg.top;

        withLeftAlign(() => {
            // 模式清單
            for (let i = 0; i < modes.length; i++) {
                const m = modes[i];
                const rowTop = yTop + i * cfg.rowH;
                const checkY = rowTop + Math.floor((cfg.rowH - cfg.checkH) / 2);
                DrawCheckbox(checkX, checkY, cfg.checkW, cfg.checkH, "", S.mode === m.key);
                const mid = rowTop + Math.floor(cfg.rowH / 2);
                const textY = mid + Math.floor(cfg.fontSize / 2) - cfg.baselineOffset;
                DrawTextFit(m.text, textX, textY, textW, "Black", "");
            }

            // 下半部三列
            yTop += modes.length * cfg.rowH + cfg.listBottomGap;

            const row = (labelText, valueText, btnText, tip) => {
                const centerY = yTop + Math.floor(cfg.rowH / 2);
                const labelBase = centerY + Math.floor(26 / 2) - cfg.baselineOffset;
                const valueBase = centerY + Math.floor(22 / 2) - cfg.baselineOffset;
                const btnY = yTop + Math.floor((cfg.rowH - cfg.btnH) / 2);

                DrawTextFit(labelText, cfg.labelX, labelBase, cfg.labelW, "Black", "");
                DrawTextFit(valueText, cfg.valX,   valueBase, cfg.valW,   "Black", "");

                const prev = MainCanvas.textAlign;
                MainCanvas.textAlign = "center";
                DrawButton(cfg.btnX, btnY, cfg.btnW, cfg.btnH, btnText, "White", "", tip);
                MainCanvas.textAlign = prev;

                yTop += cfg.rowH;
            };

            row("白名單", (S.whitelist?.join(", ") || "無"), "編輯", "編輯白名單");
            row("黑名單", (S.blacklist?.join(", ") || "無"), "編輯", "編輯黑名單");
            row("設定延遲（毫秒）", String(S.delay || 0), "修改", "修改延遲");
        });

        // 回傳供 click 使用的幾何
        return {
            CHECK_X: checkX,
            CHECK_W: 60, CHECK_H: 60,
            yStart: 220 + Math.floor((70 - 60) / 2),
            ROW_H: 70, modesCount: modes.length,
            BTN_X: 1580, BUTTON_W: 120, BUTTON_H: 44,
            baseInfoY: 220 + modes.length * 70 + 30,
            valX: cfg.valX,
            valW: cfg.valW
        };
    }

    // 左側人物骨架（部位點擊圖）：畫出每個部位的可點區塊
    function drawBodyMap(editIdx, editingPart) {
        const active = editIdx != null;
        for (const group of BODY_PARTS) {
            const zs = partZones(group);
            if (!zs) continue;
            const selected = active && group === editingPart;
            const color = selected ? "#8CE0A0" : (active ? "White" : "#EDEDED");
            for (const z of zs) DrawButton(bx(z[0]), by(z[1]), bs(z[2]), bs(z[3]), "", color, "", partLabel(group), !active);
            // 部位名畫在最大的區塊上
            const z0 = zs.reduce((m, z) => (z[2] * z[3] > m[2] * m[3] ? z : m), zs[0]);
            withLeftAlign(() => DrawTextFit(partLabel(group), bx(z0[0]) + 3, by(z0[1]) + bs(z0[3]) / 2 + 6, bs(z0[2]) - 6, active ? "Black" : "Gray", ""));
        }
    }

    function drawPage2(S) {
        const P = PAGE2;
        const editIdx = inlineEdit.page2EditingIndex;
        const editingPart = (editIdx != null) ? (S.actions[editIdx]?.part || "") : "";

        withLeftAlign(() => DrawTextFit(
            editIdx != null ? "點左側部位設定此列（綠＝已選）" : "先按右側『編輯』，再點左側部位",
            BODY.ox, 128, bs(500), editIdx != null ? "Black" : "Gray", ""));

        /* ---------- 左側骨架部位圖 ---------- */
        drawBodyMap(editIdx, editingPart);

        /* ---------- 右側動作表 ---------- */
        withLeftAlign(() => {
            const headerBase = 260 - 8;
            DrawTextFit("顯示", P.checkX, headerBase, P.checkW, "Black", "");
            DrawTextFit("部位", P.partX,   headerBase, P.partW,   "Black", "");
            DrawTextFit("動作", P.actionX, headerBase, P.actionW, "Black", "");
            DrawTextFit("名稱", P.labelX,  headerBase, P.labelW,  "Black", "");
            DrawTextFit("說明", P.tipX,    headerBase, P.tipW,    "Black", "");
        });

        const cellBase = (rowTop, size) => rowTop + Math.floor(P.rowH / 2) + Math.floor(size / 2) - 2;
        const actions = (S.actions || []);
        for (let i = 0; i < actions.length; i++) {
            const a = actions[i];
            const rowTop = page2RowTop(i);
            const checkY = rowTop + Math.floor((P.rowH - P.checkW) / 2);
            DrawCheckbox(P.checkX, checkY, P.checkW, P.checkW, "", !!a.enabled);

            withLeftAlign(() => {
                DrawTextFit(partLabel(a.part),              P.partX,   cellBase(rowTop, 18), P.partW,   "Black", "");
                DrawTextFit(actionLabel(a.part, a.action),  P.actionX, cellBase(rowTop, 18), P.actionW, "Black", "");
                DrawTextFit(a.label || "",                  P.labelX,  cellBase(rowTop, 18), P.labelW,  "Black", "");
                DrawTextFit(a.tooltip || "",                P.tipX,    cellBase(rowTop, 16), P.tipW,    "Black", "");
            });

            const btnY = rowTop + Math.floor((P.rowH - P.editBtnH) / 2);
            const prev = MainCanvas.textAlign;
            MainCanvas.textAlign = "center";
            DrawButton(P.editBtnX, btnY, P.editBtnW, P.editBtnH, editIdx === i ? "完成" : "編輯", "White", "", "編輯此動作");
            MainCanvas.textAlign = prev;
        }
    }

    /* ------------------------------ settingsScreen（舊入口保留） ------------------------------ */
    window.settingsScreen = {
        load: function () {
            initializeSettings();
            syncGlobals();
            currentPage = 1;
        },
        run: function () {
            const S = patAllSettings;
            MainCanvas.textAlign = "center";
            DrawText("PAT ALL 設定", 1000, 130, "Black", "Arial", 36);

            drawBackButton();
            if (currentPage === 1) this._page1Geom = drawPage1(S);
            else drawPage2(S);

            // 單一翻頁鈕：第一頁→第二頁；第二頁→第一頁
            DrawButton(1705, 75, 90, 90, "", "White", "Icons/Next.png", currentPage === 1 ? "下一頁" : "回第一頁");

            DrawButton(1580, 860, 120, 60, "保存", "White", "", "保存設定");
            // 編輯狀態才顯示「取消」
            if (inlineEdit.page1Editing || inlineEdit.page2EditingIndex != null)
                DrawButton(1730, 860, 120, 60, "取消", "White", "", "取消本次編輯");
        },

        click: function () {
            // 右上返回
            if (handleBackClick()) {
                inlineEdit.page1Editing = null;
                inlineEdit.page2EditingIndex = null;
                inlineEdit.page2Backup = null;
                removeAllInputs();
                return;
            }

            const S = patAllSettings;

            // 保存
            if (MouseIn(1580, 860, 120, 60)) {
                // 讀取 Page1 的輸入
                if (currentPage === 1) {
                    try {
                        const wlEl = document.getElementById("whitelist");
                        const blEl = document.getElementById("blacklist");
                        const dEl  = document.getElementById("delay");
                        if (wlEl) {
                            const v = ElementValue("whitelist") || "";
                            S.whitelist = v.split(",").map(s => s.trim()).filter(Boolean);
                        }
                        if (blEl) {
                            const v = ElementValue("blacklist") || "";
                            S.blacklist = v.split(",").map(s => s.trim()).filter(Boolean);
                        }
                        if (dEl) {
                            const n = parseInt(ElementValue("delay") || "0", 10);
                            if (!isNaN(n) && n >= 0) S.delay = n; else ChatRoomSendLocal("延遲必須是 0 或正整數", 3000);
                        }
                    } catch (e) { console.warn("🐈‍⬛ [PatAll] 讀取 Page1 輸入失敗：", e); }
                }

                // 讀取 Page2 的輸入
                if (currentPage === 2 && inlineEdit.page2EditingIndex != null) {
                    const i = inlineEdit.page2EditingIndex;
                    const labelEl  = document.getElementById(`action_label_${i}`);
                    const tipEl    = document.getElementById(`action_tooltip_${i}`);
                    // const partEl = document.getElementById(`action_part_${i}`);
                    // const actionEl = document.getElementById(`action_action_${i}`);

                    if (labelEl) {
                        S.actions[i].label = ElementValue(`action_label_${i}`) || S.actions[i].label;
                    }
                    if (tipEl) {
                        S.actions[i].tooltip = ElementValue(`action_tooltip_${i}`) || S.actions[i].tooltip;
                    }
                }

                saveSettings();
                if (typeof SetSettingsEdited === "function") SetSettingsEdited(true);
                ChatRoomSendLocal("[PatAll] 設定已保存!");

                // 清空編輯狀態與輸入框
                inlineEdit.page1Editing = null;
                inlineEdit.page2EditingIndex = null;
                inlineEdit.page2Backup = null;
                removeAllInputs();

                return;
            }

            // 取消（僅編輯狀態）：捨棄本次編輯、還原該列
            if ((inlineEdit.page1Editing || inlineEdit.page2EditingIndex != null) && MouseIn(1730, 860, 120, 60)) {
                if (inlineEdit.page2EditingIndex != null) {
                    const i = inlineEdit.page2EditingIndex;
                    if (inlineEdit.page2Backup) S.actions[i] = inlineEdit.page2Backup;
                    inlineEdit.page2EditingIndex = null;
                    inlineEdit.page2Backup = null;
                }
                inlineEdit.page1Editing = null;
                removeAllInputs();
                return;
            }

            // 翻頁（單一按鈕，第一頁↔第二頁）
            if (MouseIn(1705, 75, 90, 90)) {
                inlineEdit.page1Editing = null;
                commitPage2Edit();              // 保留已輸入的名稱/說明
                inlineEdit.page2Backup = null;
                removeAllInputs();
                currentPage = currentPage === 1 ? 2 : 1;
                return;
            }

            // Page1 點擊
            if (currentPage === 1) {
                const G = this._page1Geom || {};
                const modeKeys = ["all","onlywhite","skipblack","normal","private"];

                for (let i = 0; i < modeKeys.length; i++) {
                    const yBox = (G.yStart || (220 + Math.floor((70 - 60) / 2))) + i * (G.ROW_H || 70);
                    if (MouseIn(G.CHECK_X || 320, yBox, G.CHECK_W || 60, G.CHECK_H || 60)) {
                        S.mode = modeKeys[i];
                        ChatRoomSendLocal(`目前權限 ${modeKeys[i]}`, 3000);
                    }
                }

                const baseInfoY = G.baseInfoY || (220 + 5 * 70 + 30);
                const btnX = G.BTN_X || 1580;
                const bw = G.BUTTON_W || 120;
                const bh = G.BUTTON_H || 44;
                const rowH = G.ROW_H || 70;
                const centerBtnY = (top) => top + Math.floor((rowH - bh) / 2);

                const whiteBtnY = centerBtnY(baseInfoY);
                const blackBtnY = centerBtnY(baseInfoY + rowH);
                const delayBtnY = centerBtnY(baseInfoY + 2 * rowH);

                // 白名單
                if (MouseIn(btnX, whiteBtnY, bw, bh)) {
                    if (inlineEdit.page1Editing === "whitelist") {
                        const v = ElementValue("whitelist") || "";
                        S.whitelist = v.split(",").map(s => s.trim()).filter(Boolean);
                        inlineEdit.page1Editing = null;
                        ElementRemove("whitelist");
                    } else {
                        inlineEdit.page1Editing = "whitelist";
                        renderPage1Inputs(S, G);
                    }
                    return;
                }

                // 黑名單
                if (MouseIn(btnX, blackBtnY, bw, bh)) {
                    if (inlineEdit.page1Editing === "blacklist") {
                        const v = ElementValue("blacklist") || "";
                        S.blacklist = v.split(",").map(s => s.trim()).filter(Boolean);
                        inlineEdit.page1Editing = null;
                        ElementRemove("blacklist");
                    } else {
                        inlineEdit.page1Editing = "blacklist";
                        renderPage1Inputs(S, G);
                    }
                    return;
                }

                // 延遲
                if (MouseIn(btnX, delayBtnY, bw, bh)) {
                    if (inlineEdit.page1Editing === "delay") {
                        const v = parseInt(ElementValue("delay"), 10);
                        if (!isNaN(v) && v >= 0) S.delay = v;
                        inlineEdit.page1Editing = null;
                        ElementRemove("delay");
                    } else {
                        inlineEdit.page1Editing = "delay";
                        renderPage1Inputs(S, G);
                    }
                    return;
                }
                return;
            }

            // Page2 點擊
            if (currentPage === 2) {
                const actions = (S.actions || []);
                const P = PAGE2;

                // 左側骨架選部位（僅在編輯某列時有效）
                if (inlineEdit.page2EditingIndex != null) {
                    const ei = inlineEdit.page2EditingIndex;
                    for (const group of BODY_PARTS) {
                        const zs = partZones(group);
                        if (!zs) continue;
                        if (zs.some(z => MouseIn(bx(z[0]), by(z[1]), bs(z[2]), bs(z[3])))) {
                            actions[ei].part = group;
                            actions[ei].action = "";           // 換部位後重選動作
                            updateActionDropdown(ei, group);
                            if (typeof SetSettingsEdited === "function") SetSettingsEdited(true);
                            return;
                        }
                    }
                }

                // 啟用/停用勾選
                for (let i = 0; i < actions.length; i++) {
                    const checkY = page2RowTop(i) + Math.floor((P.rowH - P.checkW) / 2);
                    if (MouseIn(P.checkX, checkY, P.checkW, P.checkW)) {
                        actions[i].enabled = !actions[i].enabled;
                        if (typeof SetSettingsEdited === "function") SetSettingsEdited(true);
                        return;
                    }
                }

                // 「編輯/完成」：第一次進入編輯；第二次保存＋清除
                for (let i = 0; i < actions.length; i++) {
                    const btnY = page2RowTop(i) + Math.floor((P.rowH - P.editBtnH) / 2);
                    if (MouseIn(P.editBtnX, btnY, P.editBtnW, P.editBtnH)) {
                        if (inlineEdit.page2EditingIndex === i) {
                            commitPage2Edit();
                            inlineEdit.page2Backup = null;
                        } else {
                            commitPage2Edit();          // 先收起前一列（保留其輸入）
                            inlineEdit.page2Backup = { ...actions[i] };  // 供「取消」還原
                            inlineEdit.page2EditingIndex = i;
                            renderPage2Inputs(S);
                        }
                        if (typeof SetSettingsEdited === "function") SetSettingsEdited(true);
                        return;
                    }
                }
            }
        },
        unload: function(){},
        exit: function(){}
    };

    /* ------------------------------ ChatRoom 左下角快捷 UI ------------------------------ */
    let expanded = false;
    const startX = 0;
    const startY = 600;
    const size = 45;
    const modes = [
        { Touchmode: 'normal', modename: '正常' },
        { Touchmode: 'onlywhite', modename: '只有白名單' },
        { Touchmode: 'skipblack', modename: '跳過黑名單' },
        { Touchmode: 'private', modename: '跳過黑名單與無權限' },
        { Touchmode: 'all', modename: '所有人' }
    ];

    modApi.hookFunction("DrawProcess", 15, (args, next) => {
        const result = next(args);
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
            initializeSettings();
            MainCanvas.globalAlpha = 0.75;
            DrawButton(startX, startY, size, size, "PAT\nALL", "White", "", "展開/收起");
            MainCanvas.globalAlpha = 1.0;
            if (expanded) {
                const enabledActions = patAllSettings.actions.filter(a => a.enabled);
                enabledActions.forEach((action, i) => {
                    MainCanvas.globalAlpha = 0.75;
                    DrawButton(startX, startY + (i + 1) * size, size, size, action.label, "White", "", action.tooltip);
                    MainCanvas.globalAlpha = 1.0;
                });
                const currentMode = patAllSettings.mode;
                const tagetMode = modes.find(m => m.Touchmode === patAllSettings.mode);
                const nowMode = tagetMode ? tagetMode.modename : patAllSettings.mode;
                DrawButton(startX, startY + (enabledActions.length + 1) * size, size, size, currentMode, "White", "", "模式 "+nowMode);
            }
        }
        return result;
    });

    modApi.hookFunction("ChatRoomClick", 15, (args, next) => {
        if (MouseIn(startX, startY, size, size)) { expanded = !expanded; return; }
        if (expanded) {
            const enabledActions = patAllSettings.actions.filter(a => a.enabled);
            for (let i = 0; i < enabledActions.length; i++) {
                if (MouseIn(startX, startY + (i + 1) * size, size, size)) {
                    doActivity(enabledActions[i].part, enabledActions[i].action);
                    return;
                }
            }
            if (MouseIn(startX, startY + (enabledActions.length + 1) * size, size, size)) {
                // 找到當前模式的索引
                const currentIndex = modes.findIndex(m => m.Touchmode === patAllSettings.mode);
                // 計算下一個模式的索引（循環）
                const nextIndex = (currentIndex + 1) % modes.length;
                // 設置新模式
                patAllSettings.mode = modes[nextIndex].Touchmode;
                saveSettings();

                // 顯示新模式名稱
                ChatRoomSendLocal(`目前權限 ${modes[nextIndex].modename}`, 3000);
                return;
            }
        }
        next(args);
    });

    /* ------------------------------ 延後初始化 & 設定入口 & 命令註冊 ------------------------------ */
    function waitForGameLoad() {
        return new Promise((resolve) => {
            const check = () => {
                if (typeof Player?.MemberNumber === "number" && typeof ServerSend === "function" && typeof ChatRoomSendLocal === "function") {
                    resolve();
                } else setTimeout(check, 1000);
            };
            check();
        });
    }

    waitForGameLoad().then(() => {
        try {
            // 註冊設定頁面
            if (typeof PreferenceRegisterExtensionSetting === "function") {
                PreferenceRegisterExtensionSetting({
                    Identifier: "PatAll",
                    ButtonText: "PAT ALL 設定",
                    Image: "Icons/Gender.png",
                    load: () => window.settingsScreen.load(),
                    click: () => window.settingsScreen.click(),
                    run: () => window.settingsScreen.run(),
                    unload: () => window.settingsScreen.unload(),
                    exit: () => window.settingsScreen.exit()
                });
                console.log("🐈‍⬛ [PatAll] 擴展組件註冊成功");
            }
            // 註冊命令
            if (typeof CommandCombine === "function") {
                CommandCombine([{
                    Tag: "patall",
                    Description: "執行 PAT ALL 命令（例如 /patall do1, /patall mode normal）",
                    Action: handlePatCommand
                }]);
            }
            ChatRoomSendLocal("PAT ALL v3.0 已載入！使用 /patall help 查看說明", 3000);
        } catch (e) {
            console.error("🐈‍⬛ [PatAll] 初始化失敗:", e);
            ChatRoomSendLocal("PAT ALL 載入失敗，請檢查控制台", 3000);
        }
    });

})();