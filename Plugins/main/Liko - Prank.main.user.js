// ==UserScript==
// @name         Liko - Prank
// @name:zh      Liko对朋友的恶作剧
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.6.11
// @description  Likolisu's prank on her friends
// @description:zh Liko对朋友的恶作剧
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Prank.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Prank.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.6.11";
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

        // 活動圖示位於 Icons/Activity/（與遊戲本身 ElementButton.CreateForActivity 的預設路徑一致）
        getActivityIconURL: function(name) {
            return './Icons/Activity/' + name + '.png';
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

    // 備援 CDN：raw.githubusercontent.com 在部分地區連不上，備援走 jsDelivr
    const _I18N_FALLBACK_BASE = 'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/';
    const _I18N_BASES = [...new Set([_I18N_BASE, _I18N_FALLBACK_BASE])];
    const _sleep = ms => new Promise(r => setTimeout(r, ms));

    // 帶 timeout 的載入（連線卡住時不會永遠等下去）
    function loadScript(url, timeout = 8000) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        return fetch(url, { signal: ctrl.signal })
            .then(res => { if (!res.ok) throw new Error(`[prank] 无法载入 ${url} (${res.status})`); return res.text(); })
            .then(code => { new Function(code)(); })
            .finally(() => clearTimeout(timer));
    }

    // 字庫是否「真的」可用。引擎的 ensure() 失敗時只回傳 false、不會 reject，
    // 且「已請求過／載入中」也回傳 false，所以不能用它的回傳值判斷，必須探測字庫本身。
    function i18nReady() {
        const e = window.Liko?.__Sys_i18n__;
        try { return typeof e?.t === 'function' && e.getNamespaceLanguages(I18N_NS).length > 0; }
        catch { return false; }
    }
    async function _waitI18nReady(ms) {
        const end = Date.now() + ms;
        while (Date.now() < end) { if (i18nReady()) return true; await _sleep(200); }
        return i18nReady();
    }

    // 字庫狀態：ready 可用 / loading 載入中 / failed 試過仍失敗 / idle 尚未嘗試
    let _i18nPromise = null;
    let _i18nFailed = false;
    let _sendWaitSpent = false;   // 同一輪載入中，送訊息只等一次；等過了就不再讓後面的訊息各等一次
    function i18nState() {
        if (i18nReady()) return 'ready';
        if (_i18nPromise) return 'loading';
        return _i18nFailed ? 'failed' : 'idle';
    }

    // 確保共用引擎與本插件字庫都已載入：兩個來源各試兩輪；回傳 true/false。
    function ensureI18n() {
        if (i18nReady()) return Promise.resolve(true);
        return _i18nPromise ??= (async () => {
            _sendWaitSpent = false;
            try {
                for (let round = 0; round < 2; round++) {
                    for (const base of _I18N_BASES) {
                        try {
                            if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function' || !window.Liko?.__Sys_Flags__)
                                await loadScript(base + 'expand/BC_i18n.js');
                            const eng = window.Liko?.__Sys_i18n__;
                            if (typeof eng?.ensure === 'function')
                                await eng.ensure(I18N_NS, base + 'Translation/Prank-i18n.js');
                        } catch (e) {
                            console.warn('🐈‍⬛ [prank] ⚠️ i18n 載入失敗，換來源重試:', base, e?.message ?? e);
                        }
                        if (await _waitI18nReady(1500)) { _i18nFailed = false; return true; }
                    }
                    if (round === 0) await _sleep(2000);
                }
                _i18nFailed = true;
                return false;
            } finally {
                _i18nPromise = null;
            }
        })();
    }

    // 載入最終失敗時只提醒一次（本地提示，不影響其他人）
    let _i18nNoticed = false;
    function notifyI18nFailed() {
        if (_i18nNoticed) return;
        _i18nNoticed = true;
        console.warn('🐈‍⬛ [prank] ⚠️ 語言包載入失敗');
        chatSendLocal('🐈‍⬛ Prank：語言包載入失敗，動作訊息可能顯示不完整，重新整理頁面可再試一次。 / Language pack failed to load; action messages may look incomplete. Reload to retry.');
    }

    // 第一次進入聊天室：確認字庫就位。這時字庫通常早已載好；若沒有就補一次載入並把結果定案，
    // 讓之後送出動作時不必每次都為此等待。
    let _roomChecked = false;
    async function onFirstRoomEnter() {
        if (_roomChecked) return;
        _roomChecked = true;
        if (!i18nReady()) {
            const ok = await ensureI18n();
            if (ok) refreshActivityLabels(); else notifyI18nFailed();
        }
        announceLoaded();
    }

    // 取翻譯字串：字庫沒有該 key（或引擎未就緒）時回傳 null，不會把 key 當翻譯、也不會洗 console.warn
    function _tryT(key, vars, lang) {
        const e = window.Liko?.__Sys_i18n__;
        if (typeof e?.t !== 'function' || !e.has(I18N_NS, key)) return null;
        try {
            const r = lang ? e.t(I18N_NS, key, vars, lang) : e.t(I18N_NS, key, vars);
            return (typeof r === 'string' && r !== '' && r !== key) ? r : null;
        } catch { return null; }
    }
    // 取翻譯字串；字庫未就緒時回傳 key 本身，不丟例外。vars 以 {name}/{v} 占位代入。
    function getMessage(key, vars) {
        return _tryT(key, vars) ?? _tryT(key, vars, 'EN') ?? key;
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

    // 取某語言下的字串（lang：指定要抓的語言，不傳則用引擎的 detectLang）
    function getMessageLang(key, vars, lang) {
        return _tryT(key, vars, lang) ?? _tryT(key, vars) ?? _tryT(key, vars, 'EN') ?? key;
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
    // 食譜中是否有字庫片段「在本機翻不出來」（字庫未就緒或缺 key）
    function recipeHasMiss(recipe, lang) {
        return recipe.some(p => Array.isArray(p) && _tryT(p[0], p[1], lang) == null);
    }
    // 送出一條在地化動作旁白。parts：字面字串，或 [key] / [key, vars] 字庫片段。
    // 串行佇列：保證多條訊息的送出順序，也讓「等字庫」不會造成亂序。回傳的 Promise 永不 reject。
    let _sendChain = Promise.resolve();
    function sendAction(...parts) {
        _sendChain = _sendChain
            .then(() => _sendActionNow(parts))
            .catch(e => console.error('🐈‍⬛ [prank] ❌ sendAction:', e));
        return _sendChain;
    }
    async function _sendActionNow(parts) {
        if (typeof ServerSend !== 'function') return;
        // 只有「字庫還在載入中」才短暫等待（最多 2 秒），避免把 key 當底本送給沒裝插件的人。
        // 已就緒 → 直接送；已確定失敗（進房時已檢查並提醒過）→ 直接送，聊天不會被拖慢。
        // 同一輪載入只等一次，之後的訊息直接送。
        if (i18nState() === 'loading' && !_sendWaitSpent && recipeHasMiss(parts, localRenderLang())) {
            await Promise.race([ensureI18n(), _sleep(2000)]);
            if (i18nState() !== 'ready') _sendWaitSpent = true;
        }
        // 語言必須「等完之後」才取：引擎未載入時 detectLang 不可用，會誤判成 EN
        const lang = localRenderLang();
        // 底本用「發送者自己的語言」：沒裝插件的人會看到發送者的語言；
        // 有裝插件的收訊端則由下方 hook 依「自己的語言」重寫。
        const base = renderRecipe(parts, lang);
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
                    const lang = localRenderLang();
                    // 本機字庫翻不出來時，保留發送者送來的底本，不要用 key 覆蓋它
                    if (Array.isArray(recipe) && !recipeHasMiss(recipe, lang)) {
                        const local  = renderRecipe(recipe, lang);
                        const custom = dict.find(x => x && typeof x.Tag === 'string' && x.Tag.includes(PRANK_CUSTOM_TAG));
                        if (custom) {
                            custom.Text = local;
                        } else {
                            // 底本條目遺失：重建佔位條目，Content 必須維持為 Tag，不能放整句（會被當成 key 查表）
                            data.Content = PRANK_CUSTOM_TAG;
                            dict.push({ Tag: `MISSING TEXT IN "Interface.csv": ${PRANK_CUSTOM_TAG}`, Text: local });
                        }
                    }
                }
            } catch (e) { /* 壞掉就顯示英文底本，不影響其他訊息 */ }
            return next(a);
        });
    }

    // 本地提示（只有自己看得到）。必須走 ChatRoomSendLocal：它會補上 Sender，
    // 直接呼叫 ChatRoomMessage 缺 Sender 時會被 BC 靜默丟棄。不在聊天室內時不會顯示。
    function chatSendLocal(message, timeout = 10000) {
        ChatRoomSendLocal(message, timeout);
    }

    function hasBCItemPermission(target) {
        return ServerChatRoomGetAllowItem(Player, target);
    }

    function getRandomColor() {
        const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // 溶解分三階段（由輕到重）：
    //   weak   弱：只溶外衣（保留內衣褲與拘束）
    //   normal 普通：外衣 + 內衣褲（保留拘束）
    //   strong 強：外衣 + 內衣褲 + 拘束（全部溶解，只留身體部位）
    // 下表是「所有階段都保留」的部位/物件群組（不在清單內者一律溶解）。
    const dissolveKeepGroups = [
        "ArmsLeft", "ArmsRight", "HandsLeft", "HandsRight", "Mouth", "Pronouns", "Head", "Blush",
        "Fluids", "Emoticon", "Eyes", "Eyes2", "右眼_Luzi", "Eyebrows", "BodyStyle", "HairFront",
        "Nipples", "Pussy", "BodyLower", "BodyUpper", "Height", "HairBack", "左眼_Luzi",
        "新后发_Luzi_stack", "外观工具", "新前发_Luzi", "Wings", "TailStraps", "HairAccessory2",
        "额外头发_Luzi", "新后发_Luzi", "新前发_Luzi_stack", "额外身高_Luzi", "动物身体_Luzi",
        "Wings_笨笨蛋Luzi", "Luzi_TailStraps_0"
    ];

    // 弱溶解：在上述保留群組之外，額外保留內衣褲（只溶外衣）。
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
            } else { // strong：外衣 + 內衣褲 + 拘束全部溶解（Item* 群組不保留）
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

    // 是否還有可插呆毛的空格（活動前置條件與實際動作共用同一套判斷）
    function hasEmptyAhogeSlot(target) {
        const occupied = new Set(getAhogeItems(target).map(item => item.Asset?.Group?.Name));
        const isSelf = target.MemberNumber === Player.MemberNumber;
        const allowFull = isSelf || target.OnlineSharedSettings?.AllowFullWardrobeAccess !== false;
        const available = allowFull ? AHOGE_GROUPS : AHOGE_GROUPS.filter(g => g !== "额外头发_Luzi");
        return available.some(g => !occupied.has(g) && !InventoryGet(target, g));
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
            if (!InventoryGet(target, "Panties")) {
                sendAction(targetNick, " ", ['noUnderwear']);
                return;
            }
            if (!stealItem(target, "panties")) {
                chatSendLocal(getMessage('stealFailed'));
                return;
            }

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

            await sendAction(getNickname(Player), " ", ['enterPortal'], "「", roomName, "」");   // 等送出後再離開房間

            setTimeout(() => {
                if (typeof ChatRoomLeave === "function") ChatRoomLeave();
                if (typeof CommonSetScreen === "function") CommonSetScreen("Online", "ChatSearch");
                if (typeof ServerSend === "function") {
                    ServerSend("ChatRoomJoin", { Name: roomName });
                    // 確認真的進到目標房間才送「抵達」訊息（最多等 10 秒）；加入失敗就不送
                    const nick = getNickname(Player);
                    const want = String(roomName).toLowerCase();
                    let tries = 0;
                    const timer = setInterval(() => {
                        if (typeof ChatRoomData !== "undefined" && ChatRoomData?.Name?.toLowerCase() === want) {
                            clearInterval(timer);
                            sendAction(nick, " ", ['exitPortal']);
                        } else if (++tries >= 20) {
                            clearInterval(timer);
                        }
                    }, 500);
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
        // BC 對有陰莖的角色會把 ItemVulva/ItemVulvaPiercings 鏡射成 ItemPenis/ItemGlans 來找標籤，
        // 補上鏡射鍵，否則這些角色身上的偷內褲類活動標籤會 MISSING。
        for (const [from, to] of Object.entries(_grpMirror)) {
            const seg = "-" + from + "-";
            if (key.includes(seg)) {
                const mk = key.replace(seg, "-" + to + "-");
                _actDict.set(mk, text);
            }
        }
    }

    // 把 _actDict 注入 R130 的 ActivityDictionary TextCache（含語言切換後自動重注入）
    let _actDictInject = null;
    let _activitiesRegistered = false;
    let _loadedAnnounced = false;
    function announceLoaded() {
        if (_loadedAnnounced || !i18nReady() || !ServerPlayerIsInChatRoom()) return;   // 不在房間內不會顯示，不能算已提示
        _loadedAnnounced = true;
        chatSendLocal(getMessage('loaded', { v: MOD_VER }));
    }
    // 活動標籤在註冊當下若字庫未就緒，值會是 key 原文；字庫晚到時把它們換成翻譯並重新注入
    function refreshActivityLabels() {
        const e = window.Liko?.__Sys_i18n__;
        if (typeof e?.has !== 'function') return;
        let changed = false;
        for (const [k, v] of _actDict) {
            if (typeof v === 'string' && e.has(I18N_NS, v)) {
                const t = _tryT(v);
                if (t) { _actDict.set(k, t); changed = true; }
            }
        }
        if (changed) _actDictInject?.();
        if (_activitiesRegistered) announceLoaded();
    }
    function installActivityDict() {
        const cache = TextPrefetchFile(ScreenFileGetPath("ActivityDictionary.csv", "Character", "Preference"));
        const inject = () => { if (cache.cache) for (const [k, v] of _actDict) cache.cache[k] = v; };
        _actDictInject = inject;
        // 立刻注入一次；之後每次快取重建（含語言切換）完成後再自動注入
        cache.onRebuild(inject, true);
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

    const CLOTHING_MAP = {
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

    function hasRemovableClothing(target, group) {
        const clothingMap = CLOTHING_MAP;

        if (group === "ItemLegs" || group === "ItemFeet") {
            const hasShoes = InventoryGet(target, "Shoes");
            if (hasShoes) return false;
        }

        const priority = clothingMap[group];
        if (!priority) return false;

        return priority.some(clothGroup => InventoryGet(target, clothGroup));
    }

    function removeClothing(target, group) {
        const clothingMap = CLOTHING_MAP;

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

        const handheldItemName = itemType === "panties" ? "Panties" : "LongSock";

        // 先確認手持素材存在：InventoryWear 找不到素材時只回傳 null、不會丟例外，
        // 若等到穿戴失敗才發現，受害者的物品已經被移除了。
        if (!AssetGet("Female3DCG", "ItemHandheld", handheldItemName)) {
            console.error("🐈‍⬛ [prank] ❌ Handheld asset missing:", handheldItemName);
            return false;
        }

        const itemName = getMessage(itemType === "panties" ? 'itemPantiesName' : 'itemSocksName', { name: targetNick });
        const itemDesc = getMessage(itemType === "panties" ? 'itemPantiesDesc' : 'itemSocksDesc', { name: targetNick });

        // 先穿到自己手上並確認成功，才移除受害者的衣物
        InventoryRemove(Player, "ItemHandheld");
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

        if (InventoryGet(Player, "ItemHandheld")?.Asset?.Name !== handheldItemName) {
            console.error("🐈‍⬛ [prank] ❌ Item failed to persist in hand!");
            return false;
        }

        if (itemType === "panties") {
            InventoryRemove(target, "Panties");
        } else if (itemType === "socks") {
            InventoryRemove(target, "Socks");
            InventoryRemove(target, "SocksRight");
            InventoryRemove(target, "SocksLeft");
        }
        ChatRoomCharacterUpdate(target);
        ChatRoomCharacterUpdate(Player);
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

        // 「大号拉珠」來自擴充素材包：沒有該素材時直接中止，不要先把受害者的尾巴拿掉
        if (!AssetGet("Female3DCG", "ItemHandheld", "大号拉珠")) {
            chatSendLocal(getMessage('stealFailed'));
            return false;
        }

        const itemName = getMessage('itemTailName', { name: targetNick });
        const itemDesc = getMessage('itemTailDesc', { name: targetNick });

        // 先穿到自己手上並確認成功，才移除受害者的尾巴
        InventoryRemove(Player, "ItemHandheld");
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

        if (InventoryGet(Player, "ItemHandheld")?.Asset?.Name !== "大号拉珠") {
            console.error("🐈‍⬛ [prank] ❌ Item failed to persist in hand!");
            chatSendLocal(getMessage('stealFailed'));
            return false;
        }

        try {
            InventoryRemove(target, tailGroup);
            ChatRoomCharacterUpdate(target);
        } catch (e) {
            console.error("🐈‍⬛ [prank] ❌ Error removing tail:", e);
            return false;
        }
        ChatRoomCharacterUpdate(Player);
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
            return hasEmptyAhogeSlot(target2);
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
            CustomImage: ImagePathHelper.getActivityIconURL("Caress")
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
            CustomImage: ImagePathHelper.getActivityIconURL("MasturbateFist")
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
                    if (!hasEmptyAhogeSlot(target)) {
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

                    // 沒有「曲奇」素材（未裝擴充包）時不動自己嘴上的物品，只送動作訊息
                    if (AssetGet("Female3DCG", "ItemMouth", "曲奇")) {
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
                    }

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
            CustomImage: ImagePathHelper.getActivityIconURL("MasturbateFist")
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
                        try {
                            callback(target, args, next);
                        } catch (e) {
                            console.error("🐈‍⬛ [prank] ❌ activity callback error:", activityName, e);
                        }
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

        modApi.hookFunction("PreferenceGetActivityFactor", 4, (args, next) => {
            if (typeof args[1] === "string" && args[1].indexOf("Liko_") === 0) {
                return 2;
            }
            return next(args);
        });

        // 第一次進入聊天室時確認字庫就位；之後送訊息就不必再為此等待
        modApi.hookFunction("ChatRoomLoad", 4, (args, next) => {
            const result = next(args);
            Promise.resolve(result).then(onFirstRoomEnter).catch(e => console.error("🐈‍⬛ [prank] ❌ room-enter check:", e));
            return result;
        });
    }

    async function phase2() {
        try {
            await waitFor(() =>
                          typeof CommandCombine === "function" &&
                          typeof ActivityFemale3DCG !== "undefined",
                          30000  // 已知登入完成，30 秒綽綽有餘
                         );

            // 登入階段先確保 i18n 就緒（最多等 5 秒）。仍未就緒就先以 key 註冊、不阻斷；
            // 字庫之後載入成功時，refreshActivityLabels() 會把標籤換成翻譯。
            // 最終失敗與否會在第一次進入聊天室時定案並提醒（onFirstRoomEnter）。
            const i18nP = ensureI18n();
            i18nP.then(ok => { if (ok) refreshActivityLabels(); });
            await Promise.race([i18nP, _sleep(5000)]);

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
            _activitiesRegistered = true;
            announceLoaded();   // 字庫未就緒時不顯示 key，等 refreshActivityLabels() 補發

        } catch (error) {
            console.error("🐈‍⬛ [prank] ❌ Phase 2 (registration) failed:", error);
        }
    }

    function waitForLogin() {
        if (typeof Player !== "undefined" && Player?.MemberNumber !== undefined) return Promise.resolve();
        // SDK 沒載入成功時 modApi 是 undefined，改用輪詢，避免對 undefined 呼叫 hookFunction
        if (!modApi?.hookFunction) return waitFor(() => typeof Player !== "undefined" && Player?.MemberNumber !== undefined, 600000);
        return new Promise(resolve => {
            const removeHook = modApi.hookFunction("LoginResponse", 0, (args, next) => {
                const result = next(args);
                queueMicrotask(() => {
                    if (typeof Player === "undefined" || Player?.MemberNumber === undefined) return;
                    removeHook();
                    resolve();
                });
                return result;
            });
        });
    }

    (async () => {
        // ── Phase 1：SDK 就緒後立即執行，不依賴登入狀態 ──
        const sdkOk = await waitForBcModSdk();
        if (sdkOk) {
            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko - Prank",
                    fullName: "Liko's Prank on her friends",
                    version: MOD_VER,
                    repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
                });
                console.log(`🐈‍⬛ [Prank] ✅ v${MOD_VER} loaded`);
            } catch (error) {
                console.error("🐈‍⬛ [prank] ❌ Failed to register mod", error);
            }
        }
        setupHooks();  // hooks 掛在遊戲函式上，不需要玩家登入
        window.Liko._debug = { getAhogeItems };

        await waitForLogin();
        await phase2();
    })();
})();