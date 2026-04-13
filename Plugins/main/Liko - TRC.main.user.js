// ==UserScript==
// @name         Liko - TRC
// @name:zh      Liko的玩具遙控器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  玩具遙控 | Toy remote control
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/Jomshir98/bondage-club-mod-sdk@0.3.3/dist/bcmodsdk.js
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20TRC.main.user.js
// @updateURL    https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20TRC.main.user.js
// ==/UserScript==

(function () {
    'use strict';

    const MOD_Version = "1.0";
    const modApi = bcModSdk.registerMod({
        name: 'BCRemote',
        fullName: 'Liko - Toy remote control',
        version: MOD_Version,
        repository: '玩具遙控器 | ',
    });

    // ─────────────────────────────────────────
    // 常數
    // ─────────────────────────────────────────
    const BTN_X    = 0;
    const BTN_Y    = 500;
    const BTN_SIZE = 45;

    // UI 顯示用標籤（slider 0-4）— render 時再透過 T() 取得翻譯
    const INTENSITY_LABELS = ['Off', 'Low', 'Medium', 'High', 'Maximum'];

    // BC 內部 Intensity 對照
    const SLIDER_TO_BC_INT  = [-1, 0, 1, 2, 3];
    const BC_INT_TO_SLIDER  = { '-1': 0, 0: 1, 1: 2, 2: 3, 3: 4 };

    // BC 原始 Mode 陣列（TypeRecord.vibrating index 以此為準）
    // 從 native log 確認：Deny=8, Edge=9
    const VIBRATE_MODES   = ['Off', 'Low', 'Medium', 'High', 'Maximum', 'Random', 'Tease', 'Escalate', 'Deny', 'Edge'];
    const BASIC_MODES     = ['Off', 'Low', 'Medium', 'High', 'Maximum'];
    const ADVANCED_MODES  = ['Random', 'Tease', 'Escalate', 'Edge', 'EdgeDeny'];
    // 從 native log 確認：
    //   Edge（寸止）  = Mode:'Edge' + Intensity:0 + 有 Vibrating + TypeRecord.vibrating=9
    //   EdgeDeny（拒絕）= Mode:'Deny' + Intensity:0 + 無 Vibrating + TypeRecord.vibrating=8
    const MODE_TO_SLIDER  = { Off: 0, Low: 1, Medium: 2, High: 3, Maximum: 4 };
    // displayMode → 實際 BC Mode 名稱
    const MODE_ALIAS      = { 'EdgeDeny': 'Deny' };
    // 強制帶入 Vibrating 的 displayMode
    const MODE_FORCE_VIBE    = new Set(['Edge']);
    // 強制移除 Vibrating 的 displayMode（即使 isOff=false）
    const MODE_FORCE_NO_VIBE = new Set(['EdgeDeny']);
    // 廣播 Content key

    const MODE_ACTION_CONTENT = {
        Random:   'VibeModeActionRandom',
        Tease:    'VibeModeActionEscalate',
        Escalate: 'VibeModeActionTease',
        Edge:     'VibeModeActionEdge',
        EdgeDeny: 'VibeModeActionDeny',
    };
    const VIBRATE_EFFECTS = ['UseRemote', 'Vibrating', 'Egged', 'ReceiveShock'];
    const EFFECT_BUTTONS  = [
        { key: 'Edged',       label: 'Edged'       },
        { key: 'RuinOrgasms', label: 'Deny orgasm' },
        { key: 'DenialMode',  label: 'Denial mode' },
        { key: 'CanEdge',     label: 'Can edge'    },
    ];

    // ─────────────────────────────────────────
    // 雙語翻譯系統（參考 Liko CFT 的語言判斷）
    // ─────────────────────────────────────────
    function isZhLang() {
        try {
            if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
                const l = TranslationLanguage.toLowerCase();
                return l === 'cn' || l === 'tw';
            }
        } catch {}
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    const STRINGS = {
        zh: {
            // Page 1
            remote: 'REMOTE', membersInRoom: (n) => `${n} 位成員`,
            selectTarget: '選擇目標', refresh: '↺',
            items: (n) => `${n} 個道具`, zeroItems: '0 道具',
            noItems: '（無可控制道具）',
            // Page 2
            controllable: (n) => `${n} 可控制`,
            // Page 3
            intensity: '強度', mode: '模式', advanced: '進階', effects: '效果', shock: '電擊',
            triggerShock: '⚡ 觸發電擊',
            orgasm: '高潮控制', shield: '擋板控制',
            off: '關閉', low: '低', medium: '中', high: '高', maximum: '最強',
            random: '隨機', tease: '玩弄', escalate: '渐强', edge: '寸止', edgeDeny: '拒絕',
            normal: '正常', deny: '拒絕', edgeMode: '寸止',
            frontOpen: '全開', front: '前板', back: '後板', frontBack: '全關',
            advNA: '此道具不支援進階模式',
            // Permission
            noPermission: '無權限',
            tapOpen: '點擊開啟',
            scanning: 'SCANNING...',
        },
        en: {
            remote: 'REMOTE', membersInRoom: (n) => `${n} member${n !== 1 ? 's' : ''}`,
            selectTarget: 'Select target', refresh: '↺',
            items: (n) => `${n} item${n !== 1 ? 's' : ''}`, zeroItems: '0 items',
            noItems: '(No controllable items)',
            controllable: (n) => `${n} controllable`,
            intensity: 'INTENSITY', mode: 'MODE', advanced: 'ADVANCED', effects: 'EFFECTS', shock: 'SHOCK',
            triggerShock: '⚡ Trigger Shock',
            orgasm: 'ORGASM', shield: 'SHIELD',
            off: 'Off', low: 'Low', medium: 'Medium', high: 'High', maximum: 'Maximum',
            random: 'Random', tease: 'Tease', escalate: 'Escalate', edge: 'Edge', edgeDeny: 'Deny',
            normal: 'Normal', deny: 'Deny', edgeMode: 'Edge',
            frontOpen: 'Open', front: 'Front', back: 'Rear', frontBack: 'Lock',
            advNA: 'N/A for this item type',
            noPermission: 'No permission',
            tapOpen: 'TAP TO OPEN',
            scanning: 'SCANNING...',
        },
    };
    function T(key, ...args) {
        const lang = isZhLang() ? STRINGS.zh : STRINGS.en;
        const val  = lang[key] ?? STRINGS.en[key] ?? key;
        return typeof val === 'function' ? val(...args) : val;
    }

    // ─────────────────────────────────────────
    // 掃描邏輯
    // ─────────────────────────────────────────
    function isVibratingItem(item) {
        const ae = item?.Asset?.AllowEffect ?? [];
        const prop = item?.Property ?? {};


        const hasVibEffect = ae.includes('Vibrating') || ae.includes('Egged');


        const hasShockEffect = ae.includes('ReceiveShock');


        const hasRemote = ae.includes('UseRemote')
        && ('Mode' in prop || 'Intensity' in prop || 'TypeRecord' in prop);


        const hasShockControl = 'Luzi_ManualShock' in prop
        || (typeof prop.TriggerValues === 'string' && prop.TriggerValues.includes('Shock'));

        return hasVibEffect || hasShockEffect || hasRemote || hasShockControl;
    }

    function canControlItem(C, item) {
        try { return !InventoryBlockedOrLimited(C, item); } catch { return false; }
    }


    function canInteractWithChar(C) {
        try { return typeof ServerChatRoomGetAllowItem === 'function'
            ? ServerChatRoomGetAllowItem(Player, C)
        : true; // 找不到函式時預設允許
            } catch { return true; }
    }

    function scanRoom() {
        if (typeof ChatRoomCharacter === 'undefined') return [];
        return ChatRoomCharacter
            .filter(C => C.MemberNumber !== Player.MemberNumber)
            .map(C => ({
            char: C,
            canInteract: canInteractWithChar(C),
            items: C.Appearance
            .filter(item => isVibratingItem(item))
            .map(item => {
                const bcInt = item.Property?.Intensity ?? -1;
                return {
                    item,
                    canControl:       canControlItem(C, item),
                    displayName:      item.Craft?.Name || item.Asset.Description || item.Asset.Name,
                    assetName:        item.Asset.Name,
                    group:            item.Asset.Group.Name,
                    currentMode:      item.Property?.Mode ?? 'Off',
                    // 把 BC 的 -1~3 轉成 slider 的 0~4
                    currentSlider:    BC_INT_TO_SLIDER[bcInt] ?? 0,
                    allowEffect:      item.Asset.AllowEffect ?? [],
                    hasCraft:         !!item.Craft?.Name,

                    hasVibrate:       (item.Asset.AllowEffect ?? []).some(e => e === 'Vibrating' || e === 'Egged'),
                    isSimpleVibrator: 'vibrating' in (item.Property?.TypeRecord ?? {}),

                    hasOrgasmCtrl:    'o' in (item.Property?.TypeRecord ?? {}),

                    hasShock:         'Luzi_ManualShock' in (item.Property ?? {})
                    || ('typed' in (item.Property?.TypeRecord ?? {}) && 'TriggerCount' in (item.Property ?? {}))
                    || (typeof item.Property?.TriggerValues === 'string' && item.Property.TriggerValues.includes('Shock') && 'TriggerCount' in (item.Property ?? {})),

                    hasChastityShield:'c' in (item.Property?.TypeRecord ?? {}),

                    currentCVal:      item.Property?.TypeRecord?.c ?? 0,

                    cachedFrontHideItem: ('c' in (item.Property?.TypeRecord ?? {}) && (item.Property?.TypeRecord?.c ?? 0) & 1)
                    ? [...(item.Property?.HideItem ?? [])]
                    : [],
                };
            })

            .filter(idata => idata.hasVibrate || idata.hasShock || idata.hasOrgasmCtrl || idata.hasChastityShield),
        }))
            .filter(e => e.items.length > 0);
    }

    function charDisplayName(C) {
        return CharacterNickname(C) || C.Name;
    }


    const _assetUrlCache = new Map();


    function getAssetPreviewUrl(assetName, groupName, gameVer) {
        const cacheKey = groupName + '/' + assetName;
        if (_assetUrlCache.has(cacheKey)) return _assetUrlCache.get(cacheKey);
        try {
            const badWords = ['HiddenItem', 'Icons/', 'data:'];
            const encoded  = encodeURIComponent(assetName);
            for (const img of [
                document.querySelector(`img[src*="${encoded}.png"]`),
                document.querySelector(`img[src*="${assetName}.png"]`),
            ]) {
                if (img?.src && !badWords.some(w => img.src.includes(w))) {
                    _assetUrlCache.set(cacheKey, img.src);
                    return img.src;
                }
            }
        } catch {}
        return `https://www.bondageprojects.elementfx.com/${gameVer}/BondageClub/Assets/Female3DCG/${groupName}/Preview/${assetName}.png`;
    }

    // 主動掃描所有道具圖片並快取（包括 BC 標準路徑 + Echo CDN 路徑）
    // 使用 BC dialog 按鈕結構：button[name][data-group] > img.button-image
    function preCacheEchoImages() {
        try {
            // 方法1：掃描 BC 道具按鈕（最精確）
            document.querySelectorAll('button[name][data-group] img.button-image').forEach(img => {
                if (!img?.src || img.src.includes('HiddenItem') || img.src.startsWith('data:')) return;
                const btn = img.closest('button[name][data-group]');
                if (!btn) return;
                const name  = btn.getAttribute('name');
                const group = btn.getAttribute('data-group');
                if (name && group) {
                    const key = group + '/' + name;
                    if (!_assetUrlCache.has(key)) _assetUrlCache.set(key, img.src);
                }
            });
            // 方法2：掃描任意含 Assets/Female3DCG 路徑的 img
            document.querySelectorAll('img[src]').forEach(img => {
                if (!img?.src || img.src.includes('HiddenItem') || img.src.startsWith('data:')) return;
                const m = img.src.match(/Assets\/Female3DCG\/([^/]+)\/Preview\/([^/?#]+)\.png/);
                if (m) {
                    const key = m[1] + '/' + decodeURIComponent(m[2]);
                    if (!_assetUrlCache.has(key)) _assetUrlCache.set(key, img.src);
                }
            });
        } catch {}
    }


    function makePortraitDataUrl(C, size = 44) {
        try {
            const src = C?.Canvas;
            if (!src || src.width === 0 || src.height === 0) return null;
            const off = document.createElement('canvas');
            off.width = size; off.height = size;
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#1a0824';
            ctx.fillRect(0, 0, size, size);

            const sx = src.width  * 0.39;
            const sy = src.height * 0.40;
            const sw = src.width  * 0.22;
            const sh = src.height * 0.11;
            ctx.drawImage(src, sx, sy, sw, sh, 0, 0, size, size);
            // 隱私黑條
            ctx.fillStyle = 'rgba(0,0,0,0.88)';
            ctx.fillRect(
                Math.round(size * 0.25),   // barX
                Math.round(size * 0.50),   // barY ← 調整移上下
                Math.round(size * 0.50),   // barW
                Math.round(size * 0.15),   // barH ← 調整粗細
            );
            return off.toDataURL('image/jpeg', 0.85);
        } catch (e) { return null; }
    }


    function makeAvatarEl(C) {
        const div = document.createElement('div');
        div.className = 'bcr-avatar';
        const name = charDisplayName(C);
        const url  = makePortraitDataUrl(C, 44);
        if (url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = name.slice(0, 2).toUpperCase();
            div.appendChild(img);
        } else {
            div.textContent = name.slice(0, 2).toUpperCase();
        }
        return div;
    }

    // ─────────────────────────────────────────
    // 設定振動狀態
    function setVibratorState(C, itemData, displayMode, sliderValue) {
        try {
            const groupName = itemData.group;
            const liveItem  = InventoryGet(C, groupName);
            if (!liveItem) { console.warn('[BCRemote] InventoryGet null:', groupName); return; }
            if (liveItem.Asset.Name !== itemData.assetName) { console.warn('[BCRemote] Name mismatch'); return; }

            // displayMode → 實際 BC Mode 名稱
            const mode         = MODE_ALIAS[displayMode] || displayMode;
            const forceVibe    = MODE_FORCE_VIBE.has(displayMode);    // 強制加 Vibrating
            const forceNoVibe  = MODE_FORCE_NO_VIBE.has(displayMode); // 強制移除 Vibrating

            // slider 0-4 → BC 內部 Intensity -1~3
            let bcIntensity = SLIDER_TO_BC_INT[sliderValue] ?? -1;
            // Edge（寸止）和 EdgeDeny（拒絕）都固定 Intensity=0（從 native log 確認）
            if (forceVibe || forceNoVibe) bcIntensity = 0;
            const isOff = !forceVibe && !forceNoVibe && (mode === 'Off' || bcIntensity < 0);

            // Effect：只在 Asset.AllowEffect 包含 'Vibrating' 時才管理振動
            const allowEff = Array.isArray(liveItem.Asset.AllowEffect) ? liveItem.Asset.AllowEffect : [];
            const assetAllowsVibrating = allowEff.includes('Vibrating');
            const baseEffect = Array.isArray(liveItem.Property?.Effect)
            ? [...liveItem.Property.Effect] : [];
            let newEffect;
            if (assetAllowsVibrating) {
                if (isOff || forceNoVibe) {
                    newEffect = baseEffect.filter(e => e !== 'Vibrating');
                } else {
                    newEffect = baseEffect.includes('Vibrating') ? baseEffect : [...baseEffect, 'Vibrating'];
                }
            } else {
                newEffect = baseEffect;
            }

            // 'Edged' effect：Edge mode 時加入，離開 Edge mode 時移除
            // 這是 BC 原生遙控器在切換 Edge 模式時帶入的效果
            if (allowEff.includes('Edged')) {
                if (mode === 'Edge') {
                    if (!newEffect.includes('Edged')) newEffect = [...newEffect, 'Edged'];
                } else {
                    newEffect = newEffect.filter(e => e !== 'Edged');
                }
            }

            // TypeRecord 更新邏輯：依道具類型分別處理
            const existingTR = liveItem.Property?.TypeRecord ?? {};
            let newTypeRecord;

            if ('vibrating' in existingTR) {
                // 標準震動道具（VibratingEgg 等）：vibrating key = Mode index
                const modeIdx = VIBRATE_MODES.indexOf(mode);
                newTypeRecord = Object.assign({}, existingTR, {
                    vibrating: modeIdx >= 0 ? modeIdx : 0,
                });
            } else if ('i' in existingTR) {
                // 充氣振動內褲等複雜道具：i key = 強度 index（直接對應 BC Intensity+1，0=Off）
                // f key = 充氣程度，不動它
                const iVal = bcIntensity < 0 ? 0 : bcIntensity + 1; // -1→0, 0→1, 1→2, 2→3, 3→4
                newTypeRecord = Object.assign({}, existingTR, { i: iVal });
            } else {
                newTypeRecord = existingTR; // 保留原始結構（其他未知道具）
            }

            const newProperty = Object.assign({}, liveItem.Property ?? {}, {
                Mode:       mode,
                Intensity:  bcIntensity,
                Effect:     newEffect,
                TypeRecord: newTypeRecord,
            });

            // 送封包
            const pktDifficulty = (liveItem.Difficulty ?? 0) - (liveItem.Asset.Difficulty ?? 0);
            const pktColor      = (liveItem.Color != null) ? liveItem.Color : 'Default';
            const pkt = {
                Target:     C.MemberNumber,
                Group:      groupName,
                Name:       liveItem.Asset.Name,
                Color:      pktColor,
                Difficulty: pktDifficulty,
                Property:   newProperty,
            };
            if (liveItem.Craft != null) pkt.Craft = liveItem.Craft;
            ServerSend('ChatRoomCharacterItemUpdate', pkt);



            // 廣播
            const bcMode = MODE_ALIAS[displayMode] || displayMode;
            let actionContent;
            if (MODE_ACTION_CONTENT[displayMode]) {
                // 直接用 displayMode 查表（Edge, EdgeDeny, Random, Tease, Escalate）
                actionContent = MODE_ACTION_CONTENT[displayMode];
            } else {
                const prevBcInt = SLIDER_TO_BC_INT[itemData.currentSlider] ?? -1;
                const direction = bcIntensity >= prevBcInt ? 'Increase' : 'Decrease';
                actionContent   = `VibeModeAction${direction}To${bcIntensity}`;
            }
            ServerSend('ChatRoomChat', {
                Content: actionContent,
                Type:    'Action',
                Dictionary: [
                    { SourceCharacter: Player.MemberNumber },
                    { Tag: 'DestinationCharacter', MemberNumber: C.MemberNumber, Text: charDisplayName(C) },
                    { Tag: 'AssetName', AssetName: liveItem.Asset.Name, GroupName: groupName },
                ],
            });

            // 本地狀態同步
            liveItem.Property      = newProperty;
            itemData.item.Property = newProperty;
            itemData.currentMode   = displayMode; // 保留顯示名
            itemData.currentSlider = sliderValue;

            CharacterRefresh(C, false);

        } catch (e) {
            console.error('[BCRemote] setVibratorState error:', e);
        }
    }

    // 觸發電擊（根據道具類型選擇方式）

    function triggerShock(C, itemData) {
        try {
            const groupName = itemData.group;
            const liveItem  = InventoryGet(C, groupName);
            if (!liveItem || liveItem.Asset.Name !== itemData.assetName) return;

            let newProperty;
            const prop = liveItem.Property ?? {};

            if ('Luzi_ManualShock' in prop) {
                // ① Luzi 電擊設備：設置時間戳觸發
                newProperty = Object.assign({}, prop, { Luzi_ManualShock: Date.now() });

            } else if ('typed' in (prop.TypeRecord ?? {}) && 'TriggerCount' in prop) {
                // ② ShockCollar（TypeRecord.typed）：遞增 TriggerCount
                newProperty = Object.assign({}, prop, {
                    TriggerCount: (prop.TriggerCount ?? 0) + 1,
                });

            } else if (typeof prop.TriggerValues === 'string' && prop.TriggerValues.includes('Shock') && 'TriggerCount' in prop) {
                // ③ ModularChastityBelt 等有 TriggerValues 含 Shock 的道具：遞增 TriggerCount
                newProperty = Object.assign({}, prop, {
                    TriggerCount: (prop.TriggerCount ?? 0) + 1,
                });

            } else return;

            liveItem.Property      = newProperty;
            itemData.item.Property = newProperty;

            // 送封包
            const pktDifficulty = (liveItem.Difficulty ?? 0) - (liveItem.Asset.Difficulty ?? 0);
            const pkt = {
                Target: C.MemberNumber, Group: groupName,
                Name: liveItem.Asset.Name,
                Color: (liveItem.Color != null) ? liveItem.Color : 'Default',
                Difficulty: pktDifficulty, Property: newProperty,
            };
            if (liveItem.Craft != null) pkt.Craft = liveItem.Craft;
            ServerSend('ChatRoomCharacterItemUpdate', pkt);


            if (typeof PropertyShockPublishAction === 'function') {
                try {
                    PropertyShockPublishAction(C, liveItem, false);
                } catch (shockErr) {
                    console.warn('[BCRemote] ⚡ PropertyShockPublishAction failed, fallback:', shockErr.message);
                    // Fallback：手動送廣播
                    const shockLevel = prop.ShockLevel ?? 1;
                    ServerSend('ChatRoomChat', {
                        Content: 'ChatOther-ItemNeck-ShockItem',
                        Type: 'Activity',
                        Dictionary: [
                            { SourceCharacter: Player.MemberNumber },
                            { Tag: 'TargetCharacter', MemberNumber: C.MemberNumber },
                            { Tag: 'AssetName', AssetName: liveItem.Asset.Name, GroupName: groupName },
                            { ShockIntensity: shockLevel },
                            { ActivityName: 'ShockItem' },
                        ],
                    });
                }
            } else {
                console.warn('[BCRemote] ⚡ PropertyShockPublishAction not found');
            }
        } catch (e) { console.error('[BCRemote] triggerShock error:', e); }
    }

    // ─────────────────────────────────────────
    // UI 狀態
    // ─────────────────────────────────────────
    let phoneOpen = false, miniVisible = false;
    let state = { page: 1, targetChar: null, targetEntry: null, targetItem: null };

    // ─────────────────────────────────────────
    // 樣式
    // ─────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('bcr-styles')) return;
        const s = document.createElement('style');
        s.id = 'bcr-styles';
        s.textContent = `
        #bcr-phone,#bcr-phone *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        #bcr-phone{position:fixed;bottom:80px;right:24px;width:258px;height:530px;background:#120818;border-radius:42px;border:2px solid #3a1a48;overflow:hidden;z-index:99990;display:flex;flex-direction:column;cursor:default}
        #bcr-phone *{user-select:none!important;-webkit-user-select:none!important}
        #bcr-phone.hidden{display:none}
        #bcr-phone-side{position:absolute;right:-2px;top:90px;width:3px;height:36px;background:#3a1a48;border-radius:0 2px 2px 0}
        #bcr-notch{width:66px;height:18px;background:#120818;border-radius:0 0 13px 13px;position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:20;border:2px solid #3a1a48;border-top:none}
        #bcr-mini{position:fixed;bottom:80px;right:24px;width:258px;height:44px;background:#120818;border-radius:22px;border:2px solid #3a1a48;display:none;align-items:center;justify-content:center;gap:10px;cursor:pointer;z-index:99990;transition:border-color .15s;user-select:none!important}
        #bcr-mini.visible{display:flex}
        #bcr-mini:hover{border-color:#f090c8}
        #bcr-mini .mini-icon{font-size:14px}
        #bcr-mini .mini-pill{width:34px;height:5px;background:#5a2a6a;border-radius:3px;transition:background .15s}
        #bcr-mini:hover .mini-pill{background:#f090c8}
        #bcr-mini .mini-label{font-size:9px;color:#7a4a8a;letter-spacing:1px}
        #bcr-loading{position:absolute;inset:0;background:#120818;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:50;transition:opacity .3s}
        #bcr-loading.hidden{opacity:0;pointer-events:none}
        .bcr-egg-wrap{position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center}
        .bcr-egg-body{width:32px;height:40px;background:#f090c8;border-radius:50% 50% 50% 50%/40% 40% 60% 60%;animation:bcrEggShake .35s ease-in-out infinite alternate;position:relative}
        .bcr-egg-shine{position:absolute;top:7px;left:10px;width:8px;height:12px;background:rgba(255,255,255,.38);border-radius:50%;transform:rotate(-20deg)}
        .bcr-egg-ring{position:absolute;width:52px;height:52px;border-radius:50%;border:2px solid transparent;border-top-color:#f090c8;border-right-color:#f090c8;animation:bcrSpin .8s linear infinite}
        @keyframes bcrEggShake{0%{transform:rotate(-13deg) scale(1)}100%{transform:rotate(13deg) scale(1.07)}}
        @keyframes bcrSpin{to{transform:rotate(360deg)}}
        .bcr-loading-txt{font-size:11px;color:#c080b0;letter-spacing:1.5px;animation:bcrPulse 1s ease-in-out infinite alternate}
        @keyframes bcrPulse{0%{opacity:.45}100%{opacity:1}}
        #bcr-screen{position:absolute;inset:0;display:flex;flex-direction:column}
        .bcr-page{position:absolute;inset:0;display:flex;flex-direction:column;transition:transform .25s ease,opacity .2s ease}
        .bcr-page.out-left{transform:translateX(-100%);opacity:0;pointer-events:none}
        .bcr-page.out-right{transform:translateX(100%);opacity:0;pointer-events:none}
        .bcr-sbar{height:26px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;margin-top:6px}
        .bcr-sbar-time{font-size:11px;color:#9a6a9a;font-weight:500}
        .bcr-sbar-sig{font-size:9px;color:#7a4a7a}
        .bcr-brand-row{display:flex;align-items:center;padding:5px 12px 4px;flex-shrink:0;gap:4px}
        .bcr-brand-gap{flex:1;min-width:26px}
        .bcr-brand{font-size:13px;color:#f0a0d8;letter-spacing:3px;font-weight:600;flex:0}
        .bcr-refresh-btn{flex:1;min-width:26px;display:flex;justify-content:flex-end;align-items:center}
        .bcr-refresh-btn>span{width:22px;height:22px;border-radius:50%;background:#2a1030;border:1px solid #6a2a70;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;color:#e080d0;transition:all .15s;line-height:1;flex-shrink:0}
        .bcr-refresh-btn>span:hover{background:#3a1a40;border-color:#c860a8;color:#f0c0e0;transform:rotate(30deg)}
        .bcr-sub{font-size:10px;color:#8a5a8a;padding:0 14px 5px;flex-shrink:0;text-align:center}
        .bcr-divider{height:1px;background:#200a2a;flex-shrink:0}
        .bcr-sec-lbl{font-size:10px;color:#9a6a9a;letter-spacing:1.5px;padding:6px 16px 3px;flex-shrink:0}
        .bcr-list{flex:1;overflow-y:auto;padding:3px 9px 5px;overscroll-behavior:contain;cursor:default}
        .bcr-list::-webkit-scrollbar{width:0;height:0}
        .bcr-list{scrollbar-width:none}
        .bcr-char-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:12px;cursor:pointer;border:1px solid transparent;margin-bottom:3px;transition:all .15s;touch-action:pan-y}
        .bcr-char-row:hover{background:#1a0a20;border-color:#4a1a50}
        .bcr-char-row.no-items{opacity:.35;cursor:default;pointer-events:none}
        .bcr-avatar{width:44px;height:44px;border-radius:10px;background:#1e0a24;border:1px solid #3a1a48;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#f0a0d8;flex-shrink:0;overflow:hidden}
        .bcr-avatar img{width:44px;height:44px;object-fit:cover;display:block;border-radius:9px}
        .bcr-char-meta{flex:1;min-width:0}
        .bcr-char-name{font-size:13px;color:#fad0f0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .bcr-char-id{font-size:10px;color:#6a3a6a;margin-top:1px}
        .bcr-cbadge{font-size:10px;padding:2px 7px;border-radius:9px;flex-shrink:0;font-weight:500}
        .bcr-cbadge-on{background:#200a28;color:#e090c8;border:1px solid #4a1a50}
        .bcr-cbadge-off{background:#140814;color:#3a1a3a;border:1px solid #1e0a22}
        .bcr-cbadge-warn{background:#200808;color:#e06040;border:1px solid #6a2a10;font-size:12px}
        .bcr-char-row.no-perm{opacity:.55;cursor:default}
        .bcr-no-perm-icon{font-size:10px;margin-left:3px;vertical-align:middle}
        .bcr-back{display:flex;align-items:center;gap:6px;padding:5px 13px;cursor:pointer;flex-shrink:0}
        .bcr-back-arrow{font-size:18px;color:#f0a0d8;line-height:1}
        .bcr-back-txt{font-size:11px;color:#9a6a9a}
        .bcr-tgt-head{padding:3px 16px 6px;flex-shrink:0;text-align:center}
        .bcr-tgt-portrait{width:68px;height:68px;border-radius:14px;background:#180820;border:1px solid #3a1a48;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:12px;font-weight:600;color:#f0a0d8}
        .bcr-tgt-portrait img{width:68px;height:68px;object-fit:cover;border-radius:13px;display:block}
        .bcr-p3-thumb{width:64px;height:64px;border-radius:12px;background:#180820;border:1px solid #2a1030;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:0 auto 6px}
        .bcr-p3-thumb img{width:64px;height:64px;object-fit:cover;border-radius:11px;display:block}
        .bcr-tgt-name{font-size:14px;color:#fad0f0;font-weight:600}
        .bcr-tgt-sub{font-size:10px;color:#7a4a7a;margin-top:2px}
        .bcr-item-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;cursor:pointer;border:1px solid #1e0a22;margin-bottom:3px;background:#0e0616;transition:all .15s;touch-action:pan-y}
        .bcr-item-row:hover:not(.locked){border-color:#4a1a50;background:#180a20}
        .bcr-item-row.locked{opacity:.25;cursor:not-allowed}
        .bcr-thumb{width:36px;height:36px;border-radius:8px;background:#180820;border:1px solid #2a1030;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center}
        .bcr-thumb img{width:36px;height:36px;object-fit:cover;border-radius:7px;display:block}
        .bcr-thumb-mod{width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;color:#c080c0;background:#200a28;border-radius:7px}
        .bcr-itmeta{flex:1;min-width:0}
        .bcr-it-disp{font-size:12px;color:#fad0f0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .bcr-it-sub{font-size:10px;color:#6a3a6a;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .bcr-it-badge{font-size:10px;padding:2px 6px;border-radius:7px;flex-shrink:0;font-weight:500}
        .bcr-it-off{background:#140814;color:#3a1a3a;border:1px solid #1e0a22}
        .bcr-it-on{background:#200a28;color:#f0a0d8;border:1px solid #4a1a50}
        .bcr-ctrl-scroll{flex:1;overflow-y:auto;padding:7px 14px 5px;overscroll-behavior:contain}
        .bcr-ctrl-scroll::-webkit-scrollbar{width:0;height:0}
        .bcr-ctrl-scroll{scrollbar-width:none}
        .bcr-ctrl-block{margin-bottom:13px}
        .bcr-ctrl-lbl{font-size:9px;color:#9a5a8a;letter-spacing:1.8px;font-weight:600;margin-bottom:6px;text-transform:uppercase}
        .bcr-int-row{display:flex;align-items:center;gap:4px;margin-bottom:7px}
        .bcr-shock-btn{padding:7px 16px;border-radius:8px;border:1px solid #6a3a10;background:#2a1008;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;font-weight:600;color:#f0a060;transition:all .15s;gap:6px;letter-spacing:.5px}
        .bcr-shock-btn:hover{background:#4a2010;border-color:#e06020;color:#ffc080}
        .bcr-shock-btn.disabled{opacity:.3;cursor:not-allowed;pointer-events:none}
        .bcr-mpill.na{opacity:.3;cursor:not-allowed;pointer-events:none;border-style:dashed}
        .bcr-adv-note{font-size:9px;color:#6a3a6a;font-style:italic;padding:4px 0 2px}
        .bcr-int-num{font-size:28px;font-weight:500;color:#f090c8;line-height:1}
        .bcr-int-max{font-size:12px;color:#7a4a7a}
        .bcr-int-word{font-size:11px;color:#b080b0;margin-left:3px}
        input.bcr-slider{width:100%;height:3px;accent-color:#f090c8;cursor:pointer;display:block}
        .bcr-mode-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}
        .bcr-mode-adv{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-top:3px}
        .bcr-sub-lbl{font-size:9px;color:#9a5a8a;letter-spacing:1.8px;font-weight:600;margin:5px 0 3px;text-transform:uppercase}
        .bcr-mpill{padding:5px 2px;border-radius:8px;border:1px solid #4a1a50;background:#1a0a22;color:#a070a0;font-size:10px;text-align:center;cursor:pointer;transition:all .15s;font-weight:500}
        .bcr-mpill:hover{border-color:#c860a8;color:#f0c0e8;background:#280a30}
        .bcr-mpill.active{background:#3a0a40;border-color:#f080c0;color:#ffd0f0}
        .bcr-eff-grid{display:flex;flex-direction:column;gap:3px}
        .bcr-ebtn{padding:5px 3px;border-radius:8px;font-size:10px;text-align:center;cursor:pointer;transition:all .15s;font-weight:500;border:1px solid #4a1a50}
        .bcr-eff-row{display:grid;gap:3px}
        .bcr-eff-row-2{grid-template-columns:repeat(2,1fr)}
        .bcr-eff-row-3{grid-template-columns:repeat(3,1fr)}
        .bcr-eff-row-4{grid-template-columns:repeat(4,1fr)}
        .bcr-eavail{color:#e8a0d8;background:#1a0a22}
        .bcr-eavail:hover{background:#280a30;border-color:#c860a8;color:#ffc0e8}
        .bcr-eavail.on{background:#3a0a40;border-color:#f080c0;color:#ffd0f0}
        .bcr-elocked{color:#3a1a40;background:#0e0618;cursor:not-allowed;border-color:#2a0a30}
        .bcr-home-bar{height:41px;background:#0e0616;border-top:1px solid #1e0a22;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}
        .bcr-home-pill{width:34px;height:5px;background:#2a1030;border-radius:3px;transition:background .15s}
        .bcr-home-bar:hover .bcr-home-pill{background:#e888c8}
        `;
        document.head.appendChild(s);
    }

    // ─────────────────────────────────────────
    // 智慧 Loading
    // ─────────────────────────────────────────
    function withLoading(work) {
        const lp = document.getElementById('bcr-loading');
        let shown = false;
        const t = setTimeout(() => { if (lp) { shown = true; lp.classList.remove('hidden'); } }, 80);
        work();
        clearTimeout(t);
        if (shown && lp) setTimeout(() => lp.classList.add('hidden'), 400);
        else if (lp) lp.classList.add('hidden');
    }

    // ─────────────────────────────────────────
    // 頁面切換
    // ─────────────────────────────────────────
    function showPage(n) {
        for (let i = 1; i <= 3; i++) {
            const p = document.getElementById('bcr-pg' + i);
            if (!p) continue;
            if (i === n)    { p.classList.remove('out-left','out-right'); }
            else if (i < n) { p.classList.add('out-left');  p.classList.remove('out-right'); }
            else            { p.classList.add('out-right'); p.classList.remove('out-left'); }
        }
        state.page = n;
    }

    // ─────────────────────────────────────────
    // 渲染
    // ─────────────────────────────────────────
    function renderPage1() {
        const list = document.getElementById('bcr-p1-list');
        const sub  = document.getElementById('bcr-p1-sub');
        if (!list) return;
        const entries = scanRoom();
        sub.textContent = T('membersInRoom', typeof ChatRoomCharacter !== 'undefined' ? ChatRoomCharacter.filter(c=>c.MemberNumber!==Player.MemberNumber).length : 0);
        list.innerHTML = '';
        entries.forEach(({ char: C, items, canInteract }) => {
            const name = charDisplayName(C);
            const row  = document.createElement('div');
            // 無互動權限 → 顯示但帶鎖定樣式（不是 no-items，是 no-perm）
            row.className = 'bcr-char-row' + (canInteract ? '' : ' no-perm');
            const metaDiv = document.createElement('div');
            metaDiv.className = 'bcr-char-meta';
            const permIcon = canInteract ? '' : ' <span class="bcr-no-perm-icon" title="' + T('noPermission') + '">🚫</span>';
            metaDiv.innerHTML = `<div class="bcr-char-name">${name}${permIcon}</div><div class="bcr-char-id">#${C.MemberNumber}</div>`;
            const badge = document.createElement('div');
            badge.className = 'bcr-cbadge ' + (canInteract ? 'bcr-cbadge-on' : 'bcr-cbadge-warn');
            badge.textContent = canInteract ? T('items', items.length) : '🔒';
            row.appendChild(makeAvatarEl(C)); row.appendChild(metaDiv); row.appendChild(badge);
            if (canInteract) {
                row.addEventListener('click', () => {
                    state.targetChar = C;
                    state.targetEntry = { char: C, items, canInteract };
                    renderPage2(); showPage(2);
                });
            }
            list.appendChild(row);
        });
        if (typeof ChatRoomCharacter !== 'undefined') {
            ChatRoomCharacter
                .filter(C => C.MemberNumber !== Player.MemberNumber && !entries.find(e => e.char === C))
                .forEach(C => {
                const name = charDisplayName(C);
                const row  = document.createElement('div');
                row.className = 'bcr-char-row no-items';
                const av = makeAvatarEl(C); av.style.opacity = '0.3';
                const metaDiv = document.createElement('div');
                metaDiv.className = 'bcr-char-meta';
                metaDiv.innerHTML = `<div class="bcr-char-name" style="color:#3a1a40">${name}</div><div class="bcr-char-id">#${C.MemberNumber}</div>`;
                const badge = document.createElement('div');
                badge.className = 'bcr-cbadge bcr-cbadge-off';
                badge.textContent = T('zeroItems');
                row.appendChild(av); row.appendChild(metaDiv); row.appendChild(badge);
                list.appendChild(row);
            });
        }
    }

    function renderPage2() {
        const entry = state.targetEntry, C = state.targetChar;
        if (!entry || !C) return;
        // 在角色名稱上方加入大頭照
        const p2head = document.getElementById('bcr-p2-name');
        p2head.textContent = charDisplayName(C);
        const p2portrait = document.getElementById('bcr-p2-portrait');
        if (p2portrait) {
            p2portrait.innerHTML = '';
            const url = makePortraitDataUrl(C, 68);
            if (url) {
                const img = document.createElement('img');
                img.src = url; img.alt = ''; p2portrait.appendChild(img);
            } else {
                p2portrait.textContent = charDisplayName(C).slice(0,2).toUpperCase();
            }
        }
        const cc = entry.items.filter(i => i.canControl).length;
        document.getElementById('bcr-p2-sub').textContent = `#${C.MemberNumber} · ${T('controllable', cc)}`;
        const list = document.getElementById('bcr-p2-list');
        list.innerHTML = '';
        entry.items.forEach(idata => {
            const row = document.createElement('div');
            row.className = 'bcr-item-row' + (idata.canControl ? '' : ' locked');
            const gameVer   = (typeof GameVersion !== 'undefined' ? GameVersion : 'R126');
            const thumbUrl  = `https://www.bondageprojects.elementfx.com/${gameVer}/BondageClub/Assets/Female3DCG/${idata.group}/Preview/${idata.assetName}.png`;
            const modeLabel = idata.currentMode || 'Off';
            const modeClass = (modeLabel === 'Off' || idata.currentSlider === 0) ? 'bcr-it-off' : 'bcr-it-on';
            const dispName  = idata.hasCraft ? idata.displayName + ' ✦' : idata.displayName;
            const fallbackUrl = `https://www.bondageprojects.elementfx.com/${gameVer}/BondageClub/Icons/Remote.png`;
            const resolvedUrl = getAssetPreviewUrl(idata.assetName, idata.group, gameVer);
            row.innerHTML = `
                <div class="bcr-thumb"><img src="${resolvedUrl}" onerror="this.src='${fallbackUrl}'"></div>
                <div class="bcr-itmeta">
                    <div class="bcr-it-disp">${dispName}</div>
                    <div class="bcr-it-sub">${idata.assetName} · ${idata.group}</div>
                </div>
                <div class="bcr-it-badge ${modeClass}">${modeLabel}</div>`;
            if (idata.canControl) {
                row.addEventListener('click', () => { state.targetItem = idata; renderPage3(); showPage(3); });
            }
            list.appendChild(row);
        });
    }

    function renderPage3() {
        const idata = state.targetItem, C = state.targetChar;
        if (!idata || !C) return;
        document.getElementById('bcr-p3-back-name').textContent = charDisplayName(C);
        const dispName = idata.hasCraft ? idata.displayName + ' ✦' : idata.displayName;
        document.getElementById('bcr-p3-name').textContent = dispName;
        document.getElementById('bcr-p3-sub').textContent  = idata.assetName + ' · ' + idata.group;

        // 道具圖片
        const gameVer = typeof GameVersion !== 'undefined' ? GameVersion : 'R126';
        const imgEl   = document.getElementById('bcr-p3-img');
        const fallbackIconUrl = `https://www.bondageprojects.elementfx.com/${gameVer}/BondageClub/Icons/Remote.png`;
        if (imgEl) {
            imgEl.style.display = '';
            imgEl.src = getAssetPreviewUrl(idata.assetName, idata.group, gameVer);
            imgEl.onerror = () => { imgEl.src = fallbackIconUrl; imgEl.onerror = null; };
        }

        // 無震動功能的道具（純電擊類）隱藏強度/模式區塊
        const intensityBlock = document.getElementById('bcr-intensity-block');
        const modeBlock      = document.getElementById('bcr-mode-block');
        if (intensityBlock) intensityBlock.style.display = idata.hasVibrate ? '' : 'none';
        if (modeBlock)      modeBlock.style.display      = idata.hasVibrate ? '' : 'none';

        updateSliderUI(idata.currentSlider ?? 0);

        document.getElementById('bcr-slider').oninput = function () {
            const sv = +this.value;
            updateSliderUI(sv);
            const modeForSlider = INTENSITY_LABELS[sv] || idata.currentMode || 'Off';
            setActiveModeBtn(modeForSlider);
            setVibratorState(C, idata, modeForSlider, sv);
        };

        // ⚡ 電擊區塊（獨立於強度區塊，對純電擊道具也可見）
        const shockBlock = document.getElementById('bcr-shock-block');
        const shockBtn   = document.getElementById('bcr-shock-btn');
        if (shockBlock) shockBlock.style.display = idata.hasShock ? '' : 'none';
        if (shockBtn) {
            shockBtn.onclick = null;
            shockBtn.classList.remove('disabled');
            shockBtn.onclick = () => triggerShock(C, idata);
        }

        // ── 基礎 Mode 按鈕（Off / Low / Medium / High / Maximum）──
        const basicGrid = document.getElementById('bcr-mode-basic');
        basicGrid.innerHTML = '';
        const _modeLabel = { Off: T('off'), Low: T('low'), Medium: T('medium'), High: T('high'), Maximum: T('maximum') };
        BASIC_MODES.forEach(mode => {
            const btn = document.createElement('div');
            btn.className   = 'bcr-mpill' + (mode === (idata.currentMode || 'Off') ? ' active' : '');
            btn.textContent = _modeLabel[mode] || mode;
            btn.addEventListener('click', () => {
                const sv = MODE_TO_SLIDER[mode];
                updateSliderUI(sv);
                setActiveModeBtn(mode);
                setVibratorState(C, idata, mode, sv);
            });
            basicGrid.appendChild(btn);
        });

        // ── 進階 Mode 按鈕（Random / Tease / Escalate / 寸止 / 拒絕）──
        // 複雜道具（無 TypeRecord.vibrating）不支援進階 Mode → 隱藏整個 Advanced 區塊
        const advGrid = document.getElementById('bcr-mode-adv');
        advGrid.innerHTML = '';
        const advBlock = document.getElementById('bcr-adv-block');
        if (!idata.isSimpleVibrator) {
            if (advBlock) advBlock.style.display = 'none';
        } else {
            if (advBlock) advBlock.style.display = '';
            ADVANCED_MODES.forEach(displayMode => {
                const curEffect = Array.isArray(idata.item.Property?.Effect) ? idata.item.Property.Effect : [];
                let isActive;
                if (displayMode === 'Edge') {
                    isActive = idata.currentMode === 'Edge' && curEffect.includes('Vibrating');
                } else if (displayMode === 'EdgeDeny') {
                    isActive = idata.currentMode === 'Deny';
                } else {
                    isActive = displayMode === (idata.currentMode || 'Off');
                }
                const labelMap = { Edge: T('edge'), EdgeDeny: T('edgeDeny'), Random: T('random'), Tease: T('tease'), Escalate: T('escalate') };
                const label = labelMap[displayMode] || displayMode;
                const titleMap = { Edge: '寸止：Edge + 震動', EdgeDeny: '拒絕：Deny 無震動' };
                const btn = document.createElement('div');
                btn.className   = 'bcr-mpill' + (isActive ? ' active' : '');
                btn.textContent = label;
                btn.title       = titleMap[displayMode] || '';
                btn.addEventListener('click', () => {
                    setActiveModeBtn(label);
                    let sv;
                    if (displayMode === 'Edge')          sv = 1;
                    else if (displayMode === 'EdgeDeny')  sv = 1;
                    else                                  sv = Math.max(1, idata.currentSlider ?? 1);
                    setVibratorState(C, idata, displayMode, sv);
                });
                advGrid.appendChild(btn);
            });
        } 

        // ── Effects 區塊 ──
        const effGrid = document.getElementById('bcr-eff-grid');
        effGrid.innerHTML = '';
        const effBlock = document.getElementById('bcr-eff-block');

        const hasAnyEffect = idata.hasOrgasmCtrl || idata.hasChastityShield;
        if (idata.isSimpleVibrator) {
            // 簡單振動器不需要 Effects 面板
            if (effBlock) effBlock.style.display = 'none';
        } else if (hasAnyEffect) {
            if (effBlock) effBlock.style.display = '';

            // ── 高潮控制（o key）：正常/寸止/拒絕 ──
            if (idata.hasOrgasmCtrl) {
                const orgLbl = document.createElement('div');
                orgLbl.className = 'bcr-ctrl-lbl'; orgLbl.textContent = T('orgasm');
                effGrid.appendChild(orgLbl);
                const curO = idata.item.Property?.TypeRecord?.o ?? 0;
                const orgRow = document.createElement('div');
                orgRow.className = 'bcr-eff-row bcr-eff-row-3';
                [{ label: T('normal'), o: 0 }, { label: T('edgeMode'), o: 1 }, { label: T('deny'), o: 2 }].forEach(({ label, o }) => {
                    const btn = document.createElement('div');
                    btn.className   = 'bcr-ebtn bcr-eavail' + (curO === o ? ' on' : '');
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        triggerOrgasmCtrl(C, idata, o);
                        effGrid.querySelectorAll('[data-orgasm]').forEach(b => b.classList.remove('on'));
                        btn.classList.add('on');
                    });
                    btn.dataset.orgasm = '1';
                    orgRow.appendChild(btn);
                });
                effGrid.appendChild(orgRow);
            }

            // ── 擋板控制（c key bitmask）：全開/前板/後板/全關 ──
            if (idata.hasChastityShield) {
                const shdLbl = document.createElement('div');
                shdLbl.className = 'bcr-ctrl-lbl';
                shdLbl.style.marginTop = idata.hasOrgasmCtrl ? '8px' : '0';
                shdLbl.textContent = T('shield');
                effGrid.appendChild(shdLbl);
                const curC = idata.currentCVal ?? (idata.item.Property?.TypeRecord?.c ?? 0);
                const shdRow = document.createElement('div');
                shdRow.className = 'bcr-eff-row bcr-eff-row-4';
                [{ label: T('frontOpen'), c: 0 }, { label: T('front'), c: 1 }, { label: T('back'), c: 2 }, { label: T('frontBack'), c: 3 }].forEach(({ label, c }) => {
                    const btn = document.createElement('div');
                    btn.className   = 'bcr-ebtn bcr-eavail' + (curC === c ? ' on' : '');
                    btn.textContent = label;
                    btn.addEventListener('click', () => {
                        triggerChastityShield(C, idata, c);
                        effGrid.querySelectorAll('[data-shield]').forEach(b => b.classList.remove('on'));
                        btn.classList.add('on');
                    });
                    btn.dataset.shield = '1';
                    shdRow.appendChild(btn);
                });
                effGrid.appendChild(shdRow);
            }
        } else {
            if (effBlock) effBlock.style.display = 'none';
        }
    }

    function updateSliderUI(sliderValue) {
        const sl = document.getElementById('bcr-slider');
        const nm = document.getElementById('bcr-int-num');
        const wd = document.getElementById('bcr-int-word');
        if (sl) sl.value = sliderValue;
        if (nm) nm.textContent  = sliderValue;
        if (wd) wd.textContent = INTENSITY_LABELS[sliderValue] || '';
    }

    // 控制貞操帶類型道具的寸止/拒絕/正常（TypeRecord.o + Effect）
    function triggerOrgasmCtrl(C, itemData, oVal) {
        try {
            const groupName = itemData.group;
            const liveItem  = InventoryGet(C, groupName);
            if (!liveItem || liveItem.Asset.Name !== itemData.assetName) return;

            // 更新 TypeRecord.o
            const newTR = Object.assign({}, liveItem.Property?.TypeRecord ?? {}, { o: oVal });

            // 更新 Effect：
            //   o=0 → 移除 DenialMode, RuinOrgasms
            //   o=1 → 加入 DenialMode，移除 RuinOrgasms
            //   o=2 → 加入 DenialMode + RuinOrgasms
            let eff = [...(liveItem.Property?.Effect ?? [])].filter(e => e !== 'DenialMode' && e !== 'RuinOrgasms');
            if (oVal >= 1) eff = eff.includes('DenialMode') ? eff : [...eff, 'DenialMode'];
            if (oVal >= 2) eff = eff.includes('RuinOrgasms') ? eff : [...eff, 'RuinOrgasms'];

            const newProperty = Object.assign({}, liveItem.Property ?? {}, {
                TypeRecord: newTR,
                Effect:     eff,
            });

            liveItem.Property      = newProperty;
            itemData.item.Property = newProperty;

            const pktDifficulty = (liveItem.Difficulty ?? 0) - (liveItem.Asset.Difficulty ?? 0);
            const pkt = {
                Target: C.MemberNumber, Group: groupName,
                Name: liveItem.Asset.Name,
                Color: (liveItem.Color != null) ? liveItem.Color : 'Default',
                Difficulty: pktDifficulty, Property: newProperty,
            };
            if (liveItem.Craft != null) pkt.Craft = liveItem.Craft;
            ServerSend('ChatRoomCharacterItemUpdate', pkt);

            const actionKey = oVal === 2 ? 'VibeModeActionDeny'
            : oVal === 1 ? 'VibeModeActionEdge'
            :              'VibeModeActionIncreaseTo' + (SLIDER_TO_BC_INT[itemData.currentSlider] ?? 0);
            ServerSend('ChatRoomChat', {
                Content: actionKey, Type: 'Action',
                Dictionary: [
                    { SourceCharacter: Player.MemberNumber },
                    { Tag: 'DestinationCharacter', MemberNumber: C.MemberNumber, Text: charDisplayName(C) },
                    { Tag: 'AssetName', AssetName: liveItem.Asset.Name, GroupName: groupName },
                ],
            });
            CharacterRefresh(C, false);
        } catch (e) { console.error('[BCRemote] triggerOrgasmCtrl error:', e); }
    }

    // 控制貞操帶前後擋板（TypeRecord.c bitmask）
    function triggerChastityShield(C, itemData, cVal) {
        try {
            const groupName = itemData.group;
            const liveItem  = InventoryGet(C, groupName);
            if (!liveItem || liveItem.Asset.Name !== itemData.assetName) return;

            const currentC   = liveItem.Property?.TypeRecord?.c ?? 0;
            const frontActive = (cVal & 1) === 1;
            const backActive  = (cVal & 2) === 2;

            // 前板的 HideItem：若前板目前啟用就從 liveItem 取，否則用快取
            const frontWasActive = (currentC & 1) === 1;
            let frontHideItem = frontWasActive
            ? [...(liveItem.Property?.HideItem ?? [])]
            : (itemData.cachedFrontHideItem?.length ? itemData.cachedFrontHideItem : []);

            // 若現在要啟用前板且有新的 HideItem，更新快取
            if (frontActive && frontHideItem.length) {
                itemData.cachedFrontHideItem = frontHideItem;
            }

            // 計算新的 Block / Hide / HideItem
            const frontBlock = ['ItemVulva', 'ItemVulvaPiercings'];
            const backBlock  = ['ItemButt'];
            const newBlock   = [
                ...(frontActive ? frontBlock : []),
                ...(backActive  ? backBlock  : []),
            ];
            const newHide     = frontActive ? ['Pussy'] : [];
            const newHideItem = frontActive ? frontHideItem : [];

            // 更新 Effect（Chaste / ButtChaste）
            let newEffect = [...(liveItem.Property?.Effect ?? [])]
            .filter(e => e !== 'Chaste' && e !== 'ButtChaste');
            if (frontActive) newEffect = newEffect.includes('Chaste')     ? newEffect : [...newEffect, 'Chaste'];
            if (backActive)  newEffect = newEffect.includes('ButtChaste') ? newEffect : [...newEffect, 'ButtChaste'];

            const newTR = Object.assign({}, liveItem.Property?.TypeRecord ?? {}, { c: cVal });
            const newProperty = Object.assign({}, liveItem.Property ?? {}, {
                TypeRecord: newTR, Block: newBlock,
                Hide: newHide, HideItem: newHideItem, Effect: newEffect,
            });

            liveItem.Property      = newProperty;
            itemData.item.Property = newProperty;
            itemData.currentCVal   = cVal;

            const pkt = {
                Target: C.MemberNumber, Group: groupName,
                Name: liveItem.Asset.Name,
                Color: (liveItem.Color != null) ? liveItem.Color : 'Default',
                Difficulty: (liveItem.Difficulty ?? 0) - (liveItem.Asset.Difficulty ?? 0),
                Property: newProperty,
            };
            if (liveItem.Craft != null) pkt.Craft = liveItem.Craft;
            ServerSend('ChatRoomCharacterItemUpdate', pkt);

            // 廣播（用 VibeModeActionIncreaseTo 作為替代，之後確認正確 key 再改）
            const shieldLabelMap = { 0: '全開', 1: '前板', 2: '後板', 3: '全關' };
            CharacterRefresh(C, false);
        } catch (e) { console.error('[BCRemote] triggerChastityShield error:', e); }
    }

    function setActiveModeBtn(label) {
        document.querySelectorAll('.bcr-mpill').forEach(p => p.classList.toggle('active', p.textContent === label));
    }

    // ─────────────────────────────────────────
    // 手機開關
    // ─────────────────────────────────────────
    function openPhone() {
        const ph = document.getElementById('bcr-phone'), mb = document.getElementById('bcr-mini');
        if (!ph) return;
        if (mb) mb.classList.remove('visible');
        ph.classList.remove('hidden');
        phoneOpen = true; miniVisible = false;
        preCacheEchoImages();
        withLoading(() => { renderPage1(); showPage(1); });
    }
    function collapsePhone() {
        const ph = document.getElementById('bcr-phone'), mb = document.getElementById('bcr-mini');
        if (!ph || !mb) return;
        ph.classList.add('hidden'); mb.classList.add('visible');
        phoneOpen = false; miniVisible = true;
    }
    function closePhone() {
        const ph = document.getElementById('bcr-phone'), mb = document.getElementById('bcr-mini');
        if (ph) ph.classList.add('hidden');
        if (mb) mb.classList.remove('visible');
        phoneOpen = false; miniVisible = false;
    }
    //🎮 BC 按鈕：展開中 or mini 中 → 完全關閉；完全關閉 → 展開
    function togglePhone() {
        if (phoneOpen || miniVisible) closePhone();
        else openPhone();
    }

    // ─────────────────────────────────────────
    // 建立 DOM
    // ─────────────────────────────────────────
    function buildPanel() {
        if (document.getElementById('bcr-phone')) return;
        injectStyles();

        const phone = document.createElement('div');
        phone.id = 'bcr-phone';
        phone.classList.add('hidden');
        phone.innerHTML = `
            <div id="bcr-phone-side"></div><div id="bcr-notch"></div>
            <div id="bcr-screen">
                <div id="bcr-loading" class="hidden">
                    <div class="bcr-egg-wrap"><div class="bcr-egg-body"><div class="bcr-egg-shine"></div></div><div class="bcr-egg-ring"></div></div>
                    <div class="bcr-loading-txt" id="bcr-loading-txt">SCANNING...</div>
                </div>
                <div class="bcr-page" id="bcr-pg1">
                    <div class="bcr-sbar" id="bcr-drag-handle" style="cursor:grab">
                        <span class="bcr-sbar-time" id="bcr-clock">00:00</span>
                        <span class="bcr-sbar-sig">▌▌▌</span>
                    </div>
                    <div class="bcr-brand-row">
                        <div class="bcr-brand-gap"></div>
                        <div class="bcr-brand">REMOTE</div>
                        <div class="bcr-refresh-btn"><span id="bcr-refresh-p1" title="Refresh">↻</span></div>
                    </div>
                    <div class="bcr-sub" id="bcr-p1-sub">scanning...</div>
                    <div class="bcr-divider"></div>
                    <div class="bcr-sec-lbl" id="bcr-select-lbl">Select target</div>
                    <div class="bcr-list" id="bcr-p1-list"></div>
                    <div class="bcr-home-bar" id="bcr-home1"><div class="bcr-home-pill"></div></div>
                </div>
                <div class="bcr-page out-right" id="bcr-pg2">
                    <div class="bcr-sbar" style="cursor:grab" id="bcr-drag-handle2">
                        <span class="bcr-sbar-time" id="bcr-clock2">00:00</span>
                        <span class="bcr-sbar-sig">▌▌▌</span>
                    </div>
                    <div class="bcr-back" id="bcr-back1"><div class="bcr-back-arrow">‹</div><div class="bcr-back-txt">Room</div></div>
                    <div class="bcr-tgt-head">
                        <div class="bcr-tgt-portrait" id="bcr-p2-portrait"></div>
                        <div class="bcr-tgt-name" id="bcr-p2-name"></div>
                        <div class="bcr-tgt-sub" id="bcr-p2-sub"></div>
                    </div>
                    <div class="bcr-divider"></div>
                    <div class="bcr-sec-lbl">Equipped items</div>
                    <div class="bcr-list" id="bcr-p2-list"></div>
                    <div class="bcr-home-bar" id="bcr-home2"><div class="bcr-home-pill"></div></div>
                </div>
                <div class="bcr-page out-right" id="bcr-pg3">
                    <div class="bcr-sbar" style="cursor:grab" id="bcr-drag-handle3">
                        <span class="bcr-sbar-time" id="bcr-clock3">00:00</span>
                        <span class="bcr-sbar-sig">▌▌▌</span>
                    </div>
                    <div class="bcr-back" id="bcr-back2"><div class="bcr-back-arrow">‹</div><div class="bcr-back-txt" id="bcr-p3-back-name"></div></div>
                    <div class="bcr-tgt-head">
                        <div class="bcr-p3-thumb"><img id="bcr-p3-img" src="" onerror="this.style.display='none'"></div>
                        <div class="bcr-tgt-name" id="bcr-p3-name"></div>
                        <div class="bcr-tgt-sub" id="bcr-p3-sub"></div>
                    </div>
                    <div class="bcr-divider"></div>
                    <div class="bcr-ctrl-scroll">
                        <div class="bcr-ctrl-block" id="bcr-intensity-block">
                            <div class="bcr-ctrl-lbl" id="bcr-lbl-intensity">INTENSITY</div>
                            <div class="bcr-int-row">
                                <span class="bcr-int-num" id="bcr-int-num">0</span>
                                <span class="bcr-int-max">/ 4</span>
                                <span class="bcr-int-word" id="bcr-int-word">Off</span>
                            </div>
                            <input type="range" min="0" max="4" value="0" step="1" class="bcr-slider" id="bcr-slider">
                        </div>
                        <div class="bcr-ctrl-block" id="bcr-mode-block">
                            <div class="bcr-ctrl-lbl">MODE</div>
                            <div class="bcr-mode-grid" id="bcr-mode-basic"></div>
                        </div>
                        <div class="bcr-ctrl-block" id="bcr-adv-block">
                            <div class="bcr-sub-lbl" id="bcr-lbl-advanced">ADVANCED</div>
                            <div class="bcr-mode-adv" id="bcr-mode-adv"></div>
                        </div>
                        <div class="bcr-ctrl-block" id="bcr-shock-block" style="display:none">
                            <div class="bcr-ctrl-lbl" id="bcr-lbl-shock">SHOCK</div>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <div id="bcr-shock-btn" class="bcr-shock-btn" title="電擊 ⚡"></div>
                            </div>
                        </div>
                        <div class="bcr-ctrl-block" id="bcr-eff-block"><div class="bcr-eff-grid" id="bcr-eff-grid"></div></div>
                    </div>
                    <div class="bcr-home-bar" id="bcr-home3"><div class="bcr-home-pill"></div></div>
                </div>
            </div>`;
        document.body.appendChild(phone);

        const mini = document.createElement('div');
        mini.id = 'bcr-mini';
        mini.innerHTML = `<span class="mini-icon">🎮</span><div class="mini-pill"></div><span class="mini-label">${T('tapOpen')}</span>`;
        document.body.appendChild(mini);

        let drag = { on: false, sx: 0, sy: 0, px: 0, py: 0 };
        function startDrag(e) {
            if (e.target.closest('.bcr-refresh-btn')) return;
            drag.on = true; drag.sx = e.clientX; drag.sy = e.clientY;
            // 從 phone 或 mini 任一可見者取得當前位置
            const src = phone.classList.contains('hidden') ? mini : phone;
            const r   = src.getBoundingClientRect();
            drag.px = r.left; drag.py = r.top;
            // 若 mini 是起點，phone 的 top = mini.top - (530-44)
            if (src === mini) drag.py = r.top - (530 - 44);
            phone.style.bottom = 'auto'; phone.style.right = 'auto';
            phone.style.left = drag.px + 'px'; phone.style.top = drag.py + 'px';
            mini.style.bottom = 'auto'; mini.style.right = 'auto';
            mini.style.left = drag.px + 'px'; mini.style.top = (drag.py + 530 - 44) + 'px';
            e.preventDefault();
        }
        // phone 頁面拖曳
        ['bcr-drag-handle','bcr-drag-handle2','bcr-drag-handle3'].forEach(id => {
            document.getElementById(id)?.addEventListener('mousedown', startDrag);
        });
        // mini bar 也可拖曳
        mini.addEventListener('mousedown', e => {
            // 避免攔截點擊展開事件（只有 mousedown 拖曳，click 才算展開）
            startDrag(e);
        });
        document.addEventListener('mousemove', e => {
            if (!drag.on) return;
            const nx = drag.px + e.clientX - drag.sx, ny = drag.py + e.clientY - drag.sy;
            phone.style.left = nx + 'px'; phone.style.top = ny + 'px';
            mini.style.left  = nx + 'px'; mini.style.top  = (ny + 530 - 44) + 'px';
        });
        document.addEventListener('mouseup', () => { drag.on = false; });

        // mini bar 點擊展開（只有未移動才算 click）
        let miniDragMoved = false;
        mini.addEventListener('mousedown', () => { miniDragMoved = false; });
        document.addEventListener('mousemove', () => { if (drag.on) miniDragMoved = true; });
        mini.addEventListener('click', () => { if (!miniDragMoved) openPhone(); });

        // ── 清單拖曳捲動（長按拖動）──
        ['bcr-p1-list','bcr-p2-list'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            let lsDrag = false, lsY = 0, lsScrollY = 0, lsMoved = false;
            el.addEventListener('mousedown', e => {
                lsDrag = true; lsY = e.clientY; lsScrollY = el.scrollTop; lsMoved = false;
                el.style.userSelect = 'none';
            });
            document.addEventListener('mousemove', e => {
                if (!lsDrag) return;
                const dy = e.clientY - lsY;
                if (Math.abs(dy) > 4) { lsMoved = true; el.scrollTop = lsScrollY - dy; }
            });
            document.addEventListener('mouseup', () => {
                lsDrag = false; el.style.userSelect = '';
            });
            // 防止拖動時觸發點擊事件
            el.addEventListener('click', e => { if (lsMoved) { e.stopPropagation(); lsMoved = false; } }, true);
        });

        document.getElementById('bcr-refresh-p1').addEventListener('click', () => withLoading(() => { renderPage1(); showPage(1); }));
        // 返回 Page 1：重新掃描房間
        document.getElementById('bcr-back1').addEventListener('click', () => { renderPage1(); showPage(1); });
        // 返回 Page 2：重新掃描目標角色的道具
        document.getElementById('bcr-back2').addEventListener('click', () => {
            if (state.targetChar) {
                const fresh = scanRoom().find(e => e.char === state.targetChar);
                if (fresh) state.targetEntry = fresh;
                renderPage2();
            }
            showPage(2);
        });
        ['bcr-home1','bcr-home2','bcr-home3'].forEach(id => document.getElementById(id).addEventListener('click', collapsePhone));

        function updateClock() {
            const t = new Date().toTimeString().slice(0,5);
            ['bcr-clock','bcr-clock2','bcr-clock3'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = t; });
        }
        updateClock(); setInterval(updateClock, 30000);
    }

    // ─────────────────────────────────────────
    // BC 按鈕
    // ─────────────────────────────────────────
    // 趁 BC 道具清單建立時掃描並快取 Echo 圖片
    // DialogInventoryBuild 在每次 dialog 開啟時被調用，此時 Echo 圖片已加載到 DOM
    try {
        modApi.hookFunction('DialogInventoryBuild', 0, (args, next) => {
            const result = next(args);
            setTimeout(preCacheEchoImages, 150);
            return result;
        });
    } catch {}
    try {
        modApi.hookFunction('DialogMenuButtonBuild', 0, (args, next) => {
            const result = next(args);
            setTimeout(preCacheEchoImages, 150);
            return result;
        });
    } catch {}

    modApi.hookFunction('ChatRoomMenuDraw', 10, (args, next) => {
        next(args);
        DrawButton(BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE, '🎮', (phoneOpen || miniVisible) ? 'Pink' : 'Gray', '', 'Remote Control');
    });
    modApi.hookFunction('ChatRoomClick', 10, (args, next) => {
        if (MouseIn(BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE)) {
            if (!document.getElementById('bcr-phone')) buildPanel();
            togglePhone(); return;
        }
        next(args);
    });
    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => { closePhone(); return next(args); });

    // ── 攔截 BC 原生封包（F12 Console 查看）──
    // 在 ServerSend 層攔截，捕捉所有路徑（包括 ExtendedItem / ChatRoomPublishCustomAction）
    modApi.hookFunction('ServerSend', 0, (args, next) => {
        const msgType = args[0];
        const data    = args[1];
        // 只記錄非我方送出的、跟振動相關的封包
        if (msgType === 'ChatRoomCharacterItemUpdate' && data?.Target !== Player.MemberNumber) {
        }
        if (msgType === 'ChatRoomChat' && data?.Type === 'Action'
            && typeof data?.Content === 'string' && data.Content.startsWith('VibeModeAction')) {
        }
        return next(args);
    });

    // 把靜態 DOM 文字換成雙語版
    function applyI18n() {
        const map = {
            'bcr-loading-txt':   T('scanning') || 'SCANNING...',
            'bcr-select-lbl':    T('selectTarget'),
            'bcr-mini-lbl':      T('tapOpen') || 'TAP TO OPEN',
            'bcr-lbl-intensity': T('intensity'),
            'bcr-lbl-advanced':  T('advanced'),
            'bcr-lbl-shock':     T('shock'),
        };
        Object.entries(map).forEach(([id, text]) => {
            const el = document.getElementById(id);
            if (el && text) el.textContent = text;
        });
        // shock button text
        const shockBtn = document.getElementById('bcr-shock-btn');
        if (shockBtn) shockBtn.textContent = T('triggerShock');
    }

    function waitForBC() {
        if (typeof ChatRoomCharacter === 'undefined' || typeof Player === 'undefined') return setTimeout(waitForBC, 500);
        buildPanel();
        applyI18n();
        console.log("🐈‍⬛ [TRC] ✅ 初始化完成 v" + MOD_Version);
    }
    waitForBC();

})();
