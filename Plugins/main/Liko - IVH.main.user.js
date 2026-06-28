// ==UserScript==
// @name         IVH - Immersive Voice Hypnosis
// @name:zh      沉浸式聲音催眠效果
// @namespace    https://likulisu.dev/
// @version      2.0.1
// @description  收到 [Voice] 訊息時觸發深度催眠視覺效果，支援 /ivh 指令
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "2.0.1";
    if (window.Liko.IVH) return;
    window.Liko.IVH = MOD_VER;

    let modApi = null;

    // ════════════════════════════════════════
    //  i18n（多語）：動態載入共用引擎 + IVH 字庫，ui(key,vars) 取字串
    //  引擎未就緒時，ui() 回傳 fallbacks[key]（中文原文），不丟例外
    // ════════════════════════════════════════
    const I18N_NS = 'IVH';
    const LIKO_I18N_ENGINE_URL = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/Translation/Liko-i18n.js';
    const LIKO_IVH_STRINGS_URL = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/Translation/IVH-i18n.js';

    function _i18nLoadScript(url) {
        return fetch(url)
            .then(res => { if (!res.ok) throw new Error(`[IVH] 無法載入 ${url} (${res.status})`); return res.text(); })
            .then(code => { new Function(code)(); });
    }
    async function ensureI18n() {
        try {
            if (!window.Liko?.i18n?.version) await _i18nLoadScript(LIKO_I18N_ENGINE_URL);
            if (!window.Liko?.i18n?._ivhStringsLoaded) {
                await _i18nLoadScript(LIKO_IVH_STRINGS_URL);
                if (window.Liko?.i18n) window.Liko.i18n._ivhStringsLoaded = true;
            }
        } catch (e) { console.warn('🐈‍⬛ [IVH] i18n 載入失敗，改用中文原文:', e.message); }
    }
    // 可選語言（auto = 依遊戲語系）
    const IVH_LANGS = ['auto', 'TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA'];
    const IVH_LANG_NAMES = { auto: 'Auto', TW: '繁中', CN: '简中', EN: 'EN', DE: 'DE', FR: 'FR', RU: 'RU', UA: 'UA' };

    // 目前語言：玩家手動選 > 遊戲語系
    function ivhLang() {
        try {
            const sel = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.lang) || 'auto';
            if (sel && sel !== 'auto') return sel;
            const raw = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : '') || 'EN';
            const c = String(raw).toUpperCase().trim();
            return c === 'ZH' ? 'TW' : (c || 'EN');
        } catch { return 'EN'; }
    }

    // 取翻譯：優先用 _IVH_strings（支援手動語言覆蓋）；
    //   其次用引擎 t()（舊版線上字庫只 register、未 expose _IVH_strings 時仍可譯，但只跟遊戲語系）；
    //   最後才退中文 IVH_FALLBACK。
    function ui(key, vars) {
        const lang = ivhLang();
        let s;
        const store = window.Liko?._IVH_strings;
        const e = store && store[key];
        if (e) {
            s = e[lang] ?? e[lang === 'CN' ? 'TW' : 'XX'] ?? e['EN'];
        }
        if (s == null) {
            const fn = window.Liko?.i18n;
            if (fn?.t && fn.has?.(I18N_NS, key)) return fn.t(I18N_NS, key, vars);
        }
        if (s == null) s = IVH_FALLBACK[key] ?? key;
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
        return s;
    }

    // 引擎未載入時的中文 fallback（與 IVH-i18n.js 的 TW 一致）
    const IVH_FALLBACK = {
        loaded: 'IVH v{v} 已載入 ✅\n/ivh help 說明 | /ivh setting 設定頁',
        help: '🌀 IVH v{v} 指令列表：\n  /ivh setting       — 開啟偏好設定頁\n  /ivh show          — 顯示控制面板\n  /ivh test [文字]   — 立即觸發效果\n  /ivh climax        — 測試高潮特效\n  /ivh depth [1~3]   — 測試催眠深度效果\n  /ivh calibrate     — 頭部座標校正面板\n  /ivh help          — 顯示此說明',
        cmdUnknown: '⚠️ [IVH] 未知指令「{sub}」，輸入 /ivh help 查看說明',
        cantOpenSettings: '⚠️ 無法開啟設定頁（偏好系統未就緒）',
        exportDone: '📤 IVH 設定已匯出 (IVH-settings.json)',
        importDone: '📥 IVH 設定已匯入',
        editedYourText: '📝 {who} 編輯了你的 IVH 催眠文本',
        tab_basic: '基本設定', tab_effects: '效果設定', tab_texts: '文本設定', tab_expr: '表情設定', tab_sounds: '音效設定', tab_about: '關於插件',
        exit: '離開', info: '── 說明 ──', cancel: '取消', confirm: '確定', save: '💾 保存', delete: '🗑 刪除',
        upload: '上傳', clear: '清除', other: '其他', restoreDefault: '還原預設', export: '匯出全部設定', import: '匯入全部設定',
        enabledOn: 'IVH 啟用中', enabledOff: 'IVH 停用中',
        enabledDesc: '開啟後此插件會有更高沉浸性，並包含部分可能令人不適的效果（強閃光、畫面破碎、震動等），請依個人狀況使用。',
        intensity: '催眠強度', depthMax: '催眠深度', depthNone: '無', depthLight: '輕', depthMed: '中', depthHeavy: '重',
        interval: '循環時間', minutes: '分（1~99）', depthEffects: '── 深度效果 ──',
        intensityD: '整體效果強度（0.1~3.0），同時決定背景深度等級（≈1輕/2中/3重，不超過深度上限）。可拖曳滑桿。',
        depthMaxD: '背景催眠的最深程度（與 VOICE 觸發分開）。「無」＝關閉背景循環。',
        intervalD: '每隔幾分鐘自動播放一次背景催眠（1~99）。深度「無」時不循環。',
        depthRowLight: '深度輕', depthRowMed: '深度中', depthRowHeavy: '深度重',
        fx_smoke: '煙霧', fx_smokeD: '不定時淡粉煙霧', fx_pant: '喘氣', fx_pantD: '規律喘氣白霧',
        fx_danmaku: '彈幕', fx_danmakuD: '聊天訊息變催眠彈幕', fx_ghost: '人影', fx_ghostD: '背後低語人影＋耳邊文字',
        fx_figblur: '人物模糊', fx_figblurD: '畫面模糊但人物/人影保持清晰', fx_sfx: '音效', fx_sfxD: '播放深度音效',
        fx_chatblur: '聊天模糊', fx_chatblurD: '右側聊天訊息模糊',
        triggerTargetD: '誰說出觸發詞會讓你進入催眠。「僅白名單」時只有名單內成員有效。',
        allowEdit: '允許文本修改', allowEditD: '誰可在你的角色資料頁增減你的催眠文本。「僅自己」只有你能編輯；「僅白名單」時名單內成員（含你自己）可編輯。',
        editOff: '僅自己', editAny: '所有人', editWhitelist: '僅白名單',
        whitelistD: '會員編號，逗號或空白分隔。觸發對象與文本編輯共用此名單。', whitelistPh: '例：12345, 67890',
        language: '語言', languageD: '介面語言。Auto＝依遊戲登入語系；也可手動選擇。',
        exportD: '把所有設定下載為 JSON 檔。', importD: '從 JSON 檔還原所有設定。',
        triggerTarget: '觸發對象', anyone: '任何人', whitelistOnly: '僅白名單', whitelist: '白名單',
        allowOthersOn: '允許他人增減我的文本：開', allowOthersOff: '允許他人增減我的文本：關',
        climaxMode: '高潮模式', climaxOnOrgasm: '僅高潮時', climaxAlways: '每次觸發',
        climaxModeD: '「僅高潮時」＝BC 真正高潮才放破碎特效；「每次觸發」＝每次催眠都放。',
        climaxEvery: '每次觸發', climaxOrgasm: '僅高潮時',
        effectsHint: '逐項開關 VOICE 觸發時的各種效果，滑鼠移到項目上可看說明。',
        ev_pinkFlash: '粉紅暈染', ev_pinkFlashD: '畫面泛起粉紅光暈，營造迷濛氛圍。',
        ev_hypnoSpiral: '催眠螺旋', ev_hypnoSpiralD: '在頭部上方出現旋轉螺旋。',
        ev_hypnoWaves: '同心電波', ev_hypnoWavesD: '畫面左側出現向外擴張的同心圓波。',
        ev_screenDistort: '畫面扭曲', ev_screenDistortD: '畫面輕微旋轉模糊，像意識被攪動。',
        ev_vignette: '邊緣暗角', ev_vignetteD: '畫面四周變暗，聚焦中央。',
        ev_danmaku: '彈幕文字', ev_danmakuD: '主台詞在頭上、旁白句散落左側（含聊天歷史）。',
        ev_steam: '喘氣白霧', ev_steamD: '嘴邊呼出柔和白霧，向左右下方飄散。',
        ev_expression: '表情切換', ev_expressionD: '催眠時隨機套用表情，結束後還原。',
        ev_climax: '高潮特效', ev_climaxD: '畫面碎裂＋紅白閃光＋震動。',
        ev_sound: '喘息聲音', ev_soundD: '播放喘息音效（需音效設定）。',
        ev_headshot: '中央頭像', ev_headshotD: '每次觸發在畫面中央裁出頭像，螺旋／喘氣以它為基準（忽略分頁）。',
        ev_dualSound: '雙重音效', ev_dualSoundD: '播放說話聲的同時，疊放一個觸發音（鐘擺等，使用「催眠」分類音效）。',
        ev_emote: '狀態訊息', ev_emoteD: '觸發時發送一條動作訊息，讓他人知道你的狀態。',
        sec_hypnoText: '催眠文本', sec_statusMsg: '狀態訊息', sec_triggerWords: '觸發詞',
        textsHint: '每行一句，使用 $me 代表被催眠者名稱。',
        hypnoTextD: '彈幕／人影旁白來源，會和 BCX 的聽我聲音一起使用，僅被催眠者能看見。',
        hypnoTextPh: '例：$me 好乖…放鬆…',
        statusMsgD: '觸發催眠時隨機發送的動作訊息。', statusMsgPh: '例：$me 的思緒變得混亂了',
        triggerWordsD: '白名單成員在聊天說出含這些詞的訊息時會觸發你的催眠（[Voice] 永遠有效）。每行一個。',
        triggerWordsPh: '例：催眠　沉睡',
        soundsHint: '每格可貼網址或「上傳」本機檔。「▶」試聽、「✕」清除、「其他」從右側音效庫選用。空白＝預設。',
        sndCat_hypno: '催眠', sndCat_voice: '催眠2', sndCat_climax: '高潮', sndCat_depth: '深度',
        sndSlotHead: '{name}音效（最多 {max}）', sndDefaultPh: '（預設）{file}',
        sndUnsetPh: '未設定 — 網址／上傳／其他', sndLocalName: '本機音效',
        expr_edit: '🎭 編輯表情', expr_item: '表情{n}', expr_add: '＋ 用右側內容新增',
        expr_hint: '在右側設定好表情後，點某列「保存」或「＋新增」來儲存',
        eyebrows: '眉毛', eyes: '眼睛', mouth: '嘴巴', blush: '臉紅', exprNone: '— 無 —', previewLoading: '預覽載入中…',
        confirmReplace: '會用右側的內容替換「{name}」的資料，確定嗎？', confirmDelete: '確定刪除「{name}」嗎？',
        confirmReset: '會清除所有自訂表情，恢復 4 組內建，確定嗎？',
        snd_lib: '🔊 音效庫', snd_preset: '預設', snd_local: '本機',
        snd_assignTo: '指派給「{label}」：點上面任一音效', snd_pickHint: '點格子的「其他」後可在此指派；直接點則試聽。',
        about_author: '作者：莉柯莉絲(Likolisu)', about_dev: '本插件為個人興趣開發，可能存在些許錯誤，歡迎到 GitHub 回報。',
        about_report: '🐛 GitHub 回報', about_assets: '── 使用素材皆為免費素材 ──',
        defaultTexts: '放鬆…放鬆…\n你的意識正在沉睡\n聽我的聲音\n什麼都不用想\n越來越深沉\n順從是舒服的\n沉淪下去吧\n好乖…好乖…',
        defaultEmotes: '$me 的思緒變得混亂了\n$me 的兩眼變得空洞…\n$me 的意識正在下沉\n$me 微微晃了一下，失神了\n$me 的表情變得恍惚',
    };

    // ════════════════════════════════════════
    //  預設表情清單（4 組內建，玩家可自訂最多 10 組）
    // ════════════════════════════════════════
    const DEFAULT_EXPRESSIONS = [
        { Eyebrows: "Soft",    Eyes: "VeryLewd",      Mouth: "Frown",  Blush: "High"     },
        { Eyebrows: "Lowered", Eyes: "HeartPink",      Mouth: "Moan",   Blush: "High"     },
        { Eyebrows: "Raised",  Eyes: "LewdHeartPink",  Mouth: "Ahegao", Blush: "VeryHigh" },
        { Eyebrows: "Lowered", Eyes: "Heart",          Mouth: "Open",   Blush: "Medium"   },
    ];

    // 內建催眠文本／狀態 emote 改由 i18n 提供（ui('defaultTexts') / ui('defaultEmotes')）

    // ════════════════════════════════════════
    //  設定模型（持久化於 Player.ExtensionSettings.IVH）
    //  CONFIG 為執行期物件，由 loadSettings() 從 ES 還原
    // ════════════════════════════════════════
    function makeDefaultConfig() {
        return {
            // ── 主開關 ──
            enabled:        true,  // IVH 總開關

            // ── VOICE 八大效果開關 ──
            pinkFlash:      true,  // 粉紅暈染
            hypnoSpiral:    true,  // 催眠螺旋
            hypnoWaves:     true,  // 同心圓電波
            screenDistort:  true,  // 畫面扭曲
            vignette:       true,  // 邊緣暗角
            danmaku:        true,  // 彈幕文字
            steamParticles: true,  // 氣喘粒子
            expression:     true,  // 表情切換
            arousal:        true,  // 興奮度+
            climax:         true,  // 高潮特效
            climaxMode:    "orgasm", // orgasm=高潮才觸發 | always=每次催眠都觸發
            sound:          false, // 喘息聲音（預設關閉）

            // ── 強度 ──
            intensity:      1.0,   // 0.1~3.0

            // ── VOICE 進階 ──
            centerHeadshot: false, // 中央頭像模式（每次 VOICE 裁 300×300 置中，忽略分頁）
            emoteEnabled:   true,  // 觸發時發送狀態 emote
            dualSound:      true,  // VOICE 同時播兩個音效

            // ── 觸發 ──
            whitelistMode: "any",  // any | whitelist
            whitelist:      [],    // MemberNumber 陣列
            triggerWords:   [],    // 自訂觸發詞（除了 [Voice]）

            // ── 催眠深度（獨立背景循環；0=無=關閉）──
            depthMax:       0,     // 0=無 1=輕 2=中 3=重（無則不循環）
            depthIntervalMin: 5,   // 循環間隔（分鐘 1~99）
            // 各深度層效果開關
            depthLight: { smoke: true, pant: true, chatDanmaku: true, ghost: true },
            depthMed:   { figureBlur: true, pant: true, sfx: true },
            depthHeavy: { chatlogBlur: true, pant: true },

            // ── 文本 ──
            textSource:     "ES",      // ES | DB
            customTexts:    ui('defaultTexts').split('\n').map(s => s.trim()).filter(Boolean),
            emoteList:      ui('defaultEmotes').split('\n').map(s => s.trim()).filter(Boolean),

            // ── 表情（最多 10 組）──
            expressionSets: DEFAULT_EXPRESSIONS.map(e => ({ ...e })),

            // ── 語言（auto = 依遊戲語系；或手動 TW/CN/EN/DE/FR/RU/UA）──
            lang: 'auto',

            // ── 允許他人編輯文本模式：off / any / whitelist（與觸發對象共用白名單）──
            allowEditMode: 'off',

            // ── 音效（URL 清單；本機上傳另存 IndexedDB，此處放 id 參照）──
            soundSource:    "ES",      // ES | DB
            sounds: {
                hypno:  [],  // 催眠音效 最多 5
                climax: [],  // 高潮音效 最多 5
                depth:  [],  // 深度音效 最多 3
                voice:  [],  // VOICE 音效 最多 3
            },
        };
    }

    // 執行期設定物件（由 loadSettings 填充）
    let CONFIG = makeDefaultConfig();
    // 相容舊程式碼：EXPRESSION_SETS 指向目前設定的表情組
    let EXPRESSION_SETS = CONFIG.expressionSets;

    // ════════════════════════════════════════
    //  儲存層
    //  - Player.ExtensionSettings.IVH  ← 設定本體（LZString 壓縮，跟帳號同步）
    //  - Player.OnlineSharedSettings.IVH ← 對外公告（版本 + 是否允許他人編輯）
    //  - IndexedDB "liko-ivh"          ← 本機上傳音效 bytes / 大量文本（無上限）
    // ════════════════════════════════════════
    const ES_KEY = "IVH";                       // ExtensionSettings / OnlineSharedSettings 儲存鍵
    const PREF_ID = "Liko_IVH_Settings";        // 偏好設定頁註冊 Identifier
    const ES_BUDGET = 5120; // 5KB 警戒線

    // 偏好設定頁 icon（內嵌 SVG，轉成 data URI 供 BC 載入）
    const IVH_ICON = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="90" height="90">' +
        '<style>.s0{opacity:.96;fill:#010101}</style>' +
        '<path id="Path 0" fill-rule="evenodd" class="s0" d="m10 35l15-14 16-6h8l18 7 16 15-30-14-20 1zm0 20l23 11 20 1 30-14-16 15-18 7h-8l-16-6zm28-30h14l13 4 24 17-16 11-20 8h-15l-15-5-18-11-3-5 19-13zm-9 14v10l7 9 16 1 7-6 3-8-4-9 1 11-5 8-16 1-7-10 5-12 10-1 7 8-3 9-9 1-3-8 8-2v5l-4-1v3l4 1 3-8-3-3h-7l-4 9 4 6 9 1 7-7-1-11-8-6h-7zm-20-4h1v1h-1zm-1 1h1v1h-1zm0 17h1v1h-1zm1 1h1v1h-1z"/>' +
        '</svg>'
    );

    // 深合併：以 defaults 為底，用 saved 覆蓋（陣列直接取代）
    function mergeDefaults(defaults, saved) {
        if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : defaults;
        if (defaults && typeof defaults === 'object') {
            const out = {};
            for (const k of Object.keys(defaults)) {
                out[k] = (saved && k in saved) ? mergeDefaults(defaults[k], saved[k]) : defaults[k];
            }
            return out;
        }
        return saved === undefined ? defaults : saved;
    }

    // 估算設定序列化後的位元組數（壓縮後）
    function estimateESBytes() {
        try {
            const raw = JSON.stringify(serializeConfig());
            const comp = LZString.compressToBase64(raw);
            return comp.length;
        } catch { return 0; }
    }

    // 只把需要持久化的欄位序列化（音效本機 bytes 不進 ES）
    function serializeConfig() {
        const c = CONFIG;
        return {
            v: 2,
            enabled: c.enabled,
            pinkFlash: c.pinkFlash, hypnoSpiral: c.hypnoSpiral, hypnoWaves: c.hypnoWaves,
            screenDistort: c.screenDistort, vignette: c.vignette, danmaku: c.danmaku,
            steamParticles: c.steamParticles, expression: c.expression, arousal: c.arousal,
            climax: c.climax, climaxMode: c.climaxMode, sound: c.sound,
            intensity: c.intensity,
            centerHeadshot: c.centerHeadshot, emoteEnabled: c.emoteEnabled, dualSound: c.dualSound,
            whitelistMode: c.whitelistMode, whitelist: c.whitelist, triggerWords: c.triggerWords,
            depthMax: c.depthMax, depthIntervalMin: c.depthIntervalMin,
            depthLight: c.depthLight, depthMed: c.depthMed, depthHeavy: c.depthHeavy,
            allowEditMode: c.allowEditMode, textSource: c.textSource,
            lang: c.lang,
            customTexts: c.textSource === 'ES' ? c.customTexts : [],
            emoteList: c.emoteList,
            expressionSets: c.expressionSets,
            soundSource: c.soundSource,
            // 注意：sounds 不存進 ExtensionSettings（帳號隔離），改存 localStorage 跨帳號共用
        };
    }

    // 音效設定改存 localStorage（同瀏覽器跨帳號共用），不跟著帳號走
    const SND_LS_KEY = 'IVH_sounds';
    function loadSounds() {
        try {
            const raw = localStorage.getItem(SND_LS_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                CONFIG.sounds = mergeDefaults(makeDefaultConfig().sounds, s);
            }
        } catch (e) {}
    }
    function saveSounds() {
        try { localStorage.setItem(SND_LS_KEY, JSON.stringify(CONFIG.sounds)); } catch (e) {}
    }

    // 等待 ExtensionSettings 由伺服器載入（最多 ~15 秒）
    function waitForExtensionSettings(timeout = 15000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (Player && Player.ExtensionSettings !== undefined) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 200);
            };
            check();
        });
    }

    function loadSettings() {
        try {
            const raw = Player?.ExtensionSettings?.[ES_KEY];
            if (raw) {
                const json = LZString.decompressFromBase64(raw);
                const saved = json ? JSON.parse(json) : null;
                if (saved) {
                    CONFIG = mergeDefaults(makeDefaultConfig(), saved);
                    // 舊版 allowOthersEdit(bool) → allowEditMode(3 態) 遷移
                    if (saved.allowEditMode === undefined && saved.allowOthersEdit)
                        CONFIG.allowEditMode = 'any';
                }
            }
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] 設定讀取失敗，使用預設:', e.message);
            CONFIG = makeDefaultConfig();
        }
        loadSounds();   // 音效改從 localStorage（跨帳號共用）
        EXPRESSION_SETS = CONFIG.expressionSets;
    }

    let _saveTimer = null;
    function saveSettings(immediate = false) {
        const doSave = () => {
            try {
                if (!Player) return;
                if (!Player.ExtensionSettings) Player.ExtensionSettings = {}; // 從未有設定的帳號需自建
                const raw = JSON.stringify(serializeConfig());
                Player.ExtensionSettings[ES_KEY] = LZString.compressToBase64(raw);
                if (typeof ServerPlayerExtensionSettingsSync === 'function') {
                    ServerPlayerExtensionSettingsSync(ES_KEY);
                }
                saveSounds();   // 音效另存 localStorage（跨帳號共用）
                EXPRESSION_SETS = CONFIG.expressionSets;
            } catch (e) {
                console.warn('🐈‍⬛ [IVH] 設定儲存失敗:', e.message);
            }
        };
        if (immediate) { if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; } doSave(); return; }
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => { _saveTimer = null; doSave(); }, 600);
    }

    // 對外公告：他人查看 profile 時用來判斷是否裝了 IVH / 是否允許編輯
    function publishSharedSettings() {
        try {
            if (!Player || !Player.OnlineSharedSettings) return;
            const editable = (CONFIG.allowEditMode || 'off') !== 'off';
            Player.OnlineSharedSettings[ES_KEY] = {
                v: MOD_VER,
                edit: editable,
                editMode: CONFIG.allowEditMode || 'off',
                // 允許編輯時公告文本，讓他人在 profile 看到並編輯（白名單模式仍由本端驗證）
                texts: editable ? (CONFIG.customTexts || []) : [],
            };
            if (typeof ServerAccountUpdate?.QueueData === 'function') {
                ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
            }
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] OnlineSharedSettings 公告失敗:', e.message);
        }
    }

    // ── IndexedDB（本機上傳音效 / 大量文本）──
    const IVHDB = {
        db: null,
        open() {
            return new Promise(resolve => {
                try {
                    const req = indexedDB.open('liko-ivh', 1);
                    req.onupgradeneeded = e => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('sounds')) db.createObjectStore('sounds', { keyPath: 'id' });
                        if (!db.objectStoreNames.contains('texts'))  db.createObjectStore('texts',  { keyPath: 'key' });
                    };
                    req.onsuccess = () => { this.db = req.result; resolve(true); };
                    req.onerror   = () => resolve(false);
                } catch { resolve(false); }
            });
        },
        put(store, rec) {
            return new Promise(resolve => {
                try { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).put(rec);
                      tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); }
                catch { resolve(false); }
            });
        },
        get(store, key) {
            return new Promise(resolve => {
                try { const req = this.db.transaction(store, 'readonly').objectStore(store).get(key);
                      req.onsuccess = () => resolve(req.result || null); req.onerror = () => resolve(null); }
                catch { resolve(null); }
            });
        },
        getAll(store) {
            return new Promise(resolve => {
                try { const req = this.db.transaction(store, 'readonly').objectStore(store).getAll();
                      req.onsuccess = () => resolve(req.result || []); req.onerror = () => resolve([]); }
                catch { resolve([]); }
            });
        },
        delete(store, key) {
            return new Promise(resolve => {
                try { const tx = this.db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key);
                      tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); }
                catch { resolve(false); }
            });
        },
    };

    // ════════════════════════════════════════
    //  匯出 / 匯入（全部設定；DB 文本/音效於後續階段一併納入）
    // ════════════════════════════════════════
    function exportSettings() {
        try {
            const data = { plugin: 'Liko-IVH', v: MOD_VER, ivh: serializeConfig() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'IVH-settings.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            printChat(ui('exportDone'), 6000);
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] 匯出失敗:', e.message);
        }
    }

    function importSettings() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'application/json,.json';
        inp.onchange = () => {
            const f = inp.files && inp.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                try {
                    const data  = JSON.parse(String(r.result));
                    const saved = data.ivh || data;
                    CONFIG = mergeDefaults(makeDefaultConfig(), saved);
                    EXPRESSION_SETS = CONFIG.expressionSets;
                    saveSettings(true);
                    publishSharedSettings();
                    applyDepthLoop();
                    printChat(ui('importDone'), 6000);
                } catch (e) {
                    console.warn('🐈‍⬛ [IVH] 匯入失敗:', e.message);
                    printChat('⚠️ IVH 設定匯入失敗：' + e.message, 8000);
                }
            };
            r.readAsText(f);
        };
        inp.click();
    }

    // ════════════════════════════════════════
    //  背景催眠深度循環（與 VOICE 觸發分離）
    //  深度等級 = 由強度推算，受「深度上限」限制
    // ════════════════════════════════════════
    function currentDepthLevel() {
        if (!CONFIG.enabled || CONFIG.depthMax <= 0) return 0;
        let lvl = Math.round(CONFIG.intensity);
        lvl = Math.max(1, Math.min(3, lvl));
        return Math.min(lvl, CONFIG.depthMax);
    }

    let _depthTimer = null;
    function applyDepthLoop() {
        if (_depthTimer) { clearInterval(_depthTimer); _depthTimer = null; }
        if (!CONFIG.enabled || CONFIG.depthMax <= 0) return;
        const ms = Math.max(1, Math.min(99, CONFIG.depthIntervalMin)) * 60000;
        _depthTimer = setInterval(() => {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
            const lvl = currentDepthLevel();
            if (lvl > 0) runDepthEffect(lvl);
        }, ms);
    }

    // 背景深度效果（最小可用版；幽靈低語人影／人物模糊／聊天模糊於專屬階段補完）
    function runDepthEffect(level) {
        try {
            refreshCanvasCache();
            // 表情變化（共用堆疊，避免與 VOICE 同時觸發時互相覆蓋還原值；6 秒後還原）
            if (CONFIG.expression && EXPRESSION_SETS && EXPRESSION_SETS.length) {
                pushExprEffect(EXPRESSION_SETS[Math.floor(Math.random() * EXPRESSION_SETS.length)]);
                setTimeout(popExprEffect, 6000);
            }
            const L = CONFIG.depthLight, M = CONFIG.depthMed, H = CONFIG.depthHeavy;
            let pant = false;
            // 輕：淡粉煙霧 / 聊天彈幕 / 背後低語人影 / 輕喘
            if (L.smoke)       triggerPinkFlash();
            if (L.chatDanmaku) depthChatDanmaku();
            if (L.ghost)       depthGhostWhisperer();
            if (L.pant)        pant = true;
            // 中：左側人物模糊 / 音效 / 中喘
            if (level >= 2) {
                // 延後一點點再擷取，確保表情替換後的 Canvas 已重建
                if (M.figureBlur) setTimeout(depthFigureBlur, 350);
                if (M.sfx && !playSoundCategory('depth', 0.7)) triggerBreathSound(1);
                if (M.pant) pant = true;
            }
            // 重：右側聊天模糊 / 強喘
            if (level >= 3) {
                if (H.chatlogBlur) depthChatlogBlur();
                if (H.pant) pant = true;
            }
            if (pant) triggerSteamParticles(true);  // 深度喘氣不受 VOICE 開關限制
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] 深度效果錯誤:', e.message);
        }
    }

    // ── 深度：聊天訊息隨機句變催眠彈幕 ──
    function _showFloatingLine(text, delay) {
        const overlay = getOverlay();
        const pos = bcToScreen(randInt(40, 460), randInt(120, 820));
        const el = document.createElement('div');
        Object.assign(el.style, {
            position:   'fixed', left: `${pos.x}px`, top: `${pos.y}px`,
            fontSize:   '22px', fontWeight: '600',
            fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
            color:      'rgba(255,210,235,0.85)',
            textShadow: '0 0 10px rgba(255,105,180,0.7)',
            whiteSpace: 'pre-line', opacity: '0', pointerEvents: 'none',
            transform:  'translateY(8px)', transition: 'opacity .5s ease, transform .5s ease',
            zIndex:     '5',   // 在模糊遮罩(1)、煙霧(3) 之上，避免被蓋住
        });
        el.textContent = wrapDanmakuText(text, 12);
        overlay.appendChild(el);
        setTimeout(() => { el.style.opacity = '0.85'; el.style.transform = 'translateY(0)'; }, delay);
        setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-12px)'; }, delay + 3500);
        setTimeout(() => el.remove(), delay + 4200);
    }
    function depthChatDanmaku() {
        // 催眠文本（BCX＋自訂）＋ 聊天歷史 一起當來源
        const pool = getCatalystTexts().concat(getChatHistoryLines()).filter(Boolean);
        if (!pool.length) return;
        pickRandom(pool, 1 + Math.floor(Math.random() * 2)).forEach((t, i) => _showFloatingLine(resolveMe(t), i * 350));
    }

    // ── 深度（輕）：背後低語人影 ──
    //  畫進 canvas（DrawCharacter hook，在玩家繪製前 → 真正在人物後方）。
    //  用 source-atop 壓暗（不透明，只是變暗），頭頂文字用 DOM。
    let _ghost = null;   // { canvas, offX, alpha } 由 DrawCharacter hook 讀取繪製
    function depthGhostWhisperer() {
        if (!playerDrawPos.valid || !_cachedRect) return;
        const src = Player && Player.Canvas;
        if (!src || !src.width) return;
        const all = getCatalystTexts().concat(getChatHistoryLines()).filter(Boolean);
        if (!all.length) return;
        const line = resolveMe(all[Math.floor(Math.random() * all.length)]);

        // 建立壓暗人影圖（source-atop 只染角色，不透明）
        const fc = document.createElement('canvas'); fc.width = src.width; fc.height = src.height;
        const x = fc.getContext('2d');
        try { x.drawImage(src, 0, 0); } catch (e) { return; }
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = 'rgba(8,2,14,0.84)';     // 壓很暗（保留輪廓）
        x.fillRect(0, 0, fc.width, fc.height);
        x.fillStyle = 'rgba(0,0,0,0.6)';        // 臉部更黑
        x.beginPath();
        x.ellipse(fc.width * 0.50, fc.height * 0.43, fc.width * 0.20, fc.height * 0.11, 0, 0, Math.PI * 2);
        x.fill();
        x.globalCompositeOperation = 'source-over';

        // 建立「人影角色」克隆（共用玩家外觀，但用壓暗後的畫布）
        //  → 用 BC 自己的 DrawCharacter 繪製，位置才會跟玩家完全一致
        const ghostChar = Object.assign(Object.create(Object.getPrototypeOf(Player)), Player);
        ghostChar.Canvas = fc;
        ghostChar.CanvasBlink = fc;
        ghostChar.MemberNumber = -99999;   // 非玩家 → hook 不會對它再畫人影
        ghostChar.MustDraw = false;

        // 相對玩家的螢幕像素偏移
        const offXpx = 35, offYpx = -10;
        _ghost = { char: ghostChar, canvas: fc, offXpx, offYpx, alpha: 0 };

        // 淡入 / 維持 / 淡出（DrawCharacter hook 每幀讀 alpha）
        const start = Date.now();
        const fade = () => {
            if (!_ghost) return;
            const t = Date.now() - start;
            if      (t < 1000) _ghost.alpha = (t / 1000) * 0.92;
            else if (t < 3500) _ghost.alpha = 0.92;
            else if (t < 4800) _ghost.alpha = 0.92 * (1 - (t - 3500) / 1300);
            else { _ghost = null; return; }
            requestAnimationFrame(fade);
        };
        requestAnimationFrame(fade);

        // 文字位置：就在人影（陰影）頭部旁，像在耳邊低語
        const headS = getPlayerHeadScreenPos();
        const txt = document.createElement('div');
        Object.assign(txt.style, {
            position: 'fixed', left: `${headS.x + offXpx}px`, top: `${headS.y + offYpx - 18}px`,
            transform: 'translateX(-50%)', fontSize: '20px', fontWeight: '600',
            fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif', textAlign: 'center',
            color: 'rgba(255,220,240,0.92)', textShadow: '0 0 10px rgba(180,80,200,0.85)',
            whiteSpace: 'pre-line', opacity: '0', transition: 'opacity 0.8s ease', pointerEvents: 'none', zIndex: '5',
        });
        txt.textContent = wrapDanmakuText(line, 12);
        getOverlay().appendChild(txt);
        requestAnimationFrame(() => { txt.style.opacity = '1'; });
        setTimeout(() => { txt.style.opacity = '0'; }, 3500);
        setTimeout(() => txt.remove(), 4800);
    }

    // 在玩家繪製前把人影畫到 canvas（→ 在人物後方），用 BC 自己的 DrawCharacter 對齊位置
    let _playerDraw = null;     // 玩家真實繪製座標 { x, y, zoom }（給模糊重畫用）
    let _ghostTemp = null;      // 人影暫存畫布（為了正確套用 alpha 淡入淡出）
    function hookGhostDraw() {
        if (!modApi) return;
        try {
            modApi.hookFunction('DrawCharacter', 2, (args, next) => {
                const C = args[0], X = args[1], Y = args[2], Zoom = args[3];
                const isMe = C && Player && C.MemberNumber === Player.MemberNumber;
                if (isMe && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                    _playerDraw = { x: X, y: Y, zoom: Zoom };
                    if (_ghost && _ghost.alpha > 0 && _ghost.char) {
                        try {
                            const ctx = args[5] || MainCanvas;
                            // 偏移：螢幕像素 → BC 畫布座標（錨定在玩家真實座標上）
                            const offXbc = (_ghost.offXpx || 0) / (_cachedScaleX || 0.25);
                            const offYbc = (_ghost.offYpx || 0) / (_cachedScaleY || 0.25);
                            // DrawCharacter 不吃 globalAlpha → 先畫到暫存畫布，再以 alpha 疊上（才有淡入淡出）
                            //  注意：MainCanvas 是 2D context（不是元素），尺寸要用 .canvas
                            const cvEl = (MainCanvas && MainCanvas.canvas) || document.getElementById('MainCanvas');
                            if (!_ghostTemp) _ghostTemp = document.createElement('canvas');
                            _ghostTemp.width  = (cvEl && cvEl.width)  || 2000;   // 設尺寸同時清空
                            _ghostTemp.height = (cvEl && cvEl.height) || 1000;
                            const tctx = _ghostTemp.getContext('2d');
                            DrawCharacter(_ghost.char, X + offXbc, Y + offYbc, Zoom, undefined, tctx);
                            const prevA = ctx.globalAlpha;
                            ctx.globalAlpha = _ghost.alpha;
                            ctx.drawImage(_ghostTemp, 0, 0);
                            ctx.globalAlpha = prevA;
                        } catch (e) {}
                    }
                }
                return next(args);
            });
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] DrawCharacter hook 失敗:', e.message);
        }
    }

    // ── 深度（中）：畫面模糊，但人物與背後人影清晰疊在最上層 ──
    //  只做左側 1000×1000 模糊遮罩（不蓋到右側聊天室），再把清晰的人影＋人物畫上去
    function depthFigureBlur() {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return;
        const REG = 1000;   // 左側人物區（BC 像素 0~1000）
        let url;
        try {
            const comp = document.createElement('canvas'); comp.width = REG; comp.height = REG;
            const cx = comp.getContext('2d');
            // 1. 模糊左側區
            cx.filter = 'blur(7px)'; cx.drawImage(canvas, 0, 0, REG, REG, 0, 0, REG, REG); cx.filter = 'none';
            // 2. 用 BC 自己的 DrawCharacter 把清晰的玩家（與人影）畫進來 → 位置完全正確
            const pd = _playerDraw;
            if (pd) {
                // 人影 alpha 暫時拉滿，讓它在這張靜態合成圖上清楚可見
                let savedA;
                if (_ghost) { savedA = _ghost.alpha; _ghost.alpha = Math.max(_ghost.alpha || 0, 0.85); }
                DrawCharacter(Player, pd.x, pd.y, pd.zoom, undefined, cx);  // hook 會先畫人影、再畫玩家
                if (_ghost) _ghost.alpha = savedA;
            }
            url = comp.toDataURL();
        } catch (e) { return; }

        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / 2000, scaleY = rect.height / 1000;
        const img = document.createElement('img');
        img.src = url;
        Object.assign(img.style, {
            position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
            width: `${REG * scaleX}px`, height: `${REG * scaleY}px`,   // 只佔左側 1000 區
            opacity: '0', transition: 'opacity 1s ease', pointerEvents: 'none', zIndex: '1',
        });
        getOverlay().appendChild(img);
        requestAnimationFrame(() => { img.style.opacity = '1'; });
        setTimeout(() => { img.style.opacity = '0'; }, 3200);
        setTimeout(() => img.remove(), 4300);
    }

    // ── 深度（重）：右側聊天訊息突然模糊化 ──
    function depthChatlogBlur() {
        const log = document.getElementById('TextAreaChatLog');
        if (!log) return;
        const prevFilter = log.style.filter, prevTrans = log.style.transition;
        // 與人物模糊一致：淡入 1s / 維持 ~3.2s / 淡出 1s
        log.style.transition = 'filter 1s ease';
        log.style.filter = 'blur(4px)';
        setTimeout(() => {
            log.style.filter = prevFilter || '';
            setTimeout(() => { log.style.transition = prevTrans || ''; }, 1100);
        }, 3200);
    }

    // ════════════════════════════════════════
    //  時間設定
    // ════════════════════════════════════════
    const BASE_EFFECT_DURATION  = 5000;
    const BASE_PINK_DURATION    = 3000;
    const BASE_WAVE_DURATION    = 3500;
    const BASE_DANMAKU_DURATION = 5000;
    const SPIRAL_DURATION       = 5500;
    const DISTORT_DURATION      = 1200;
    const VIGNETTE_DURATION     = 4500;
    const STEAM_COUNT           = 14;

    // ════════════════════════════════════════
    //  BC 畫布常數
    // ════════════════════════════════════════
    const BC_CANVAS_W = 2000;
    const BC_CANVAS_H = 1000;
    const DANMAKU_X_MIN = 30;
    const DANMAKU_X_MAX = 750;
    const DANMAKU_Y_MIN = 60;
    const DANMAKU_Y_MAX = 780;

    // ════════════════════════════════════════
    //  玩家座標
    // ════════════════════════════════════════
    const playerDrawPos = { x: 0, y: 0, zoom: 1, valid: false, isKneeling: false, isProne: false };

    // ════════════════════════════════════════
    //  畫布快取
    // ════════════════════════════════════════
    let _cachedRect   = null;
    let _cachedScaleX = 1;
    let _cachedScaleY = 1;

    function refreshCanvasCache() {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) { _cachedRect = null; return; }
        _cachedRect   = canvas.getBoundingClientRect();
        _cachedScaleX = _cachedRect.width  / BC_CANVAS_W;
        _cachedScaleY = _cachedRect.height / BC_CANVAS_H;
    }

    function bcToScreen(bcX, bcY) {
        if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.25 };
        return {
            x: _cachedRect.left + bcX * _cachedScaleX,
            y: _cachedRect.top  + bcY * _cachedScaleY,
        };
    }

    // ════════════════════════════════════════
    //  頭部 / 嘴部位置（直接用 BC 繪製公式，任何身高姿勢都正確）
    //  asset 空間：寬 500、高 1000；頭部約 (250, headAY)、嘴約 (250, mouthAY)
    //  螢幕BC座標 = cellXY + Zoom * (Offset + assetCoord * HeightRatio)
    //    XOffset = 500*(1-HeightRatio)/2
    //    YOffset = 1000*(1-HeightRatio)*HeightRatioProportion - HeightModifier*HeightRatio
    //  HeightModifier/HeightRatioProportion 已涵蓋跪/趴等姿勢（pose OverrideHeight）
    // ════════════════════════════════════════
    const HEAD_OFFSET = {
        headAY:  160,  // 頭部中心 asset Y（螺旋對準處）
        mouthAY: 250,  // 嘴部 asset Y（喘氣氣團處）
        x:       0,    // 水平微調（asset 單位）
        yExtra:  0,    // 螢幕 Y 微調（像素）
    };

    // 把角色 asset 座標 (ax, ay) 轉成 BC 畫布座標
    function bodyAssetToBc(ax, ay) {
        const C     = Player;
        const ratio = (typeof C?.HeightRatio === 'number') ? C.HeightRatio : 1;
        const prop  = (typeof C?.HeightRatioProportion === 'number') ? C.HeightRatioProportion : 1;
        const hMod  = (typeof C?.HeightModifier === 'number') ? C.HeightModifier : 0;
        const xOff  = 500 * (1 - ratio) / 2;
        const yOff  = 1000 * (1 - ratio) * prop - hMod * ratio;
        const z     = playerDrawPos.zoom;
        return {
            x: playerDrawPos.x + z * (xOff + ax * ratio),
            y: playerDrawPos.y + z * (yOff + ay * ratio),
        };
    }

    // 判斷玩家是否在目前顯示的頁面（用 ChatRoomCharacterViewOffset 直接判斷）
    // BC 每列顯示 5 人（上排 5、下排 5，共 10 人），offset 指向第一個顯示的角色 index
    function isPlayerOnCurrentPage() {
        try {
            if (typeof ChatRoomCharacter === 'undefined' || !Array.isArray(ChatRoomCharacter)) return true;
            const myIdx = ChatRoomCharacter.findIndex(c => c?.MemberNumber === Player?.MemberNumber);
            if (myIdx < 0) return true; // 找不到就不擋
            const total = ChatRoomCharacter.length;
            if (total <= 5) return true; // 5人以下不分頁，永遠顯示
            const offset = (typeof ChatRoomCharacterViewOffset !== 'undefined') ? ChatRoomCharacterViewOffset : 0;
            // BC 一個「畫面」顯示最多 10 人（上排 5 + 下排 5）
            return myIdx >= offset && myIdx < offset + 10;
        } catch { return true; }
    }

    function getPlayerHeadScreenPos() {
        // 中央頭像模式：螺旋等效果以畫面左半中心 BC(500,500) 為基準
        if (CONFIG.centerHeadshot) return bcToScreen(500, 360);
        // 玩家不在目前顯示頁 → 回到畫面正中間
        if (!isPlayerOnCurrentPage()) return bcToScreen(500, 500);
        if (!playerDrawPos.valid || !_cachedRect) {
            if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.15 };
            return { x: _cachedRect.left + _cachedRect.width * 0.25, y: _cachedRect.top + _cachedRect.height * 0.12 };
        }
        const bc = bodyAssetToBc(250 + HEAD_OFFSET.x, HEAD_OFFSET.headAY);
        const s  = bcToScreen(bc.x, bc.y);
        s.y += HEAD_OFFSET.yExtra;
        return s;
    }

    // 嘴部螢幕座標（喘氣氣團用）
    function getPlayerMouthScreenPos() {
        if (CONFIG.centerHeadshot) return bcToScreen(500, 430);
        if (!isPlayerOnCurrentPage()) return bcToScreen(500, 560);
        if (!playerDrawPos.valid || !_cachedRect) {
            const h = getPlayerHeadScreenPos();
            return { x: h.x, y: h.y + 40 };
        }
        const bc = bodyAssetToBc(250 + HEAD_OFFSET.x, HEAD_OFFSET.mouthAY);
        const s  = bcToScreen(bc.x, bc.y);
        s.y += HEAD_OFFSET.yExtra;
        return s;
    }

    // ════════════════════════════════════════
    //  取得目前興奮度（0~100）
    // ════════════════════════════════════════
    function getArousalLevel() {
        try {
            return Player?.ArousalSettings?.Progress ?? 0;
        } catch { return 0; }
    }

    // intensity 0.5~2.0，由 CONFIG.intensity × 興奮度加成
    function effectScale() {
        const arousal = getArousalLevel();
        const arousalBonus = 1 + (arousal / 100) * 0.6; // 最高 +60%
        return CONFIG.intensity * arousalBonus;
    }

    // ════════════════════════════════════════
    //  BCX 快取
    // ════════════════════════════════════════
    let _bcxReminderCache = null;

    function getBCXReminderList() {
        if (_bcxReminderCache !== null) return _bcxReminderCache;
        try {
            const bcxRaw = Player?.ExtensionSettings?.BCX;
            if (!bcxRaw) return (_bcxReminderCache = []);
            const parts      = bcxRaw.split(':');
            const compressed = parts[1];
            if (!compressed) return (_bcxReminderCache = []);
            const jsonStr    = LZString.decompressFromBase64(compressed);
            if (!jsonStr) return (_bcxReminderCache = []);
            const bcxData    = JSON.parse(jsonStr);
            const rule       = bcxData?.conditions?.rules?.conditions?.['other_constant_reminder'];
            _bcxReminderCache = rule?.data?.customData?.reminderText ?? [];
            return _bcxReminderCache;
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] BCX 清單讀取失敗:', e.message);
            return (_bcxReminderCache = []);
        }
    }

    function clearBCXCache() { _bcxReminderCache = null; }

    // 取訊息節點的純文字內容（去掉名稱、彈出選單、metadata）
    function extractChatText(node) {
        try {
            const clone = node.cloneNode(true);
            clone.querySelectorAll('.ChatMessageName, .chat-room-message-popup, .chat-room-metadata, .ChatMessageTimestamp')
                 .forEach(el => el.remove());
            return (clone.textContent || '').replace(/\s+/g, ' ').trim();
        } catch { return ''; }
    }

    // 從聊天室 DOM 取最近的「聊天」訊息文字（給彈幕當情境旁白；不含名稱、不含悄悄話/動作）
    function getChatHistoryLines(limit = 50) {
        try {
            const log = document.getElementById('TextAreaChatLog');
            if (!log) return [];
            const nodes = log.querySelectorAll('.ChatMessageChat');
            const out = [];
            for (let i = nodes.length - 1; i >= 0 && out.length < limit; i--) {
                const txt = extractChatText(nodes[i]);
                if (txt && txt.length >= 2 && txt.length <= 60) out.push(txt);
            }
            return out;
        } catch { return []; }
    }

    // 催眠文本來源：BCX 提醒清單 + 內建自訂文本（永遠併用）
    function getCatalystTexts() {
        return [...getBCXReminderList(), ...(CONFIG.customTexts || [])].filter(Boolean);
    }
    // 把文本中的 $me 換成玩家暱稱（不同人共用同一份文本）
    function resolveMe(text) {
        const me = (typeof CharacterNickname === 'function' ? CharacterNickname(Player) : '')
                   || Player?.Nickname || Player?.Name || '';
        return String(text).split('$me').join(me);
    }

    // 隨機取 n 個元素（不重複）
    function pickRandom(arr, n) {
        if (!Array.isArray(arr) || arr.length === 0) return [];
        return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    }

    // ════════════════════════════════════════
    //  效果佇列
    // ════════════════════════════════════════
    const effectQueue   = [];
    let isEffectPlaying = false;

    async function processQueue() {
        if (isEffectPlaying || effectQueue.length === 0) return;
        isEffectPlaying = true;
        const item = effectQueue.shift();
        try {
            await runEffect(item.text, item.isTest ?? false);
        } catch (e) {
            console.error('🐈‍⬛ [IVH] 效果執行錯誤:', e.message);
        } finally {
            isEffectPlaying = false;
            if (effectQueue.length > 0) setTimeout(processQueue, 300);
        }
    }

    let _lastTriggerTime = 0;
    function triggerVoiceEffect(voiceText, isTest = false) {
        // 合併近乎同時的觸發（例如聊天觸發詞 + [Voice] 訊息），避免重複觸發/雙重 emote
        const now = Date.now();
        if (!isTest && now - _lastTriggerTime < 1500) return;
        _lastTriggerTime = now;
        if (effectQueue.length < 3) {
            effectQueue.push({ text: voiceText, isTest });
        }
        processQueue();
    }

    // ════════════════════════════════════════
    //  工具
    // ════════════════════════════════════════
    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randFloat(min, max) { return Math.random() * (max - min) + min; }

    // ── 語言判斷（每次呼叫時才讀，確保 TranslationLanguage 已載入）──
    function isZh() {
        try {
            if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
                const l = TranslationLanguage.toLowerCase();
                return l === 'cn' || l === 'tw';
            }
        } catch {}
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    function T(zh, en) { return isZh() ? zh : en; }

    const TOGGLE_LABELS = {
        pinkFlash:      () => ['🌸', T('粉紅暈染','Pink Flash')],
        hypnoSpiral:    () => ['🌀', T('催眠螺旋','Hypno Spiral')],
        hypnoWaves:     () => ['〰️', T('同心電波','Hypno Waves')],
        screenDistort:  () => ['🔮', T('畫面扭曲','Distortion')],
        vignette:       () => ['🌑', T('邊緣暗角','Vignette')],
        danmaku:        () => ['💬', T('彈幕文字','Danmaku')],
        steamParticles: () => ['💨', T('喘氣白霧','Steam FX')],
        expression:     () => ['😳', T('表情切換','Expression')],
        climax:         () => ['💥', T('高潮特效','Climax FX')],
        sound:          () => ['🔊', T('喘息聲音','Sound')],
        dualSound:      () => ['🔊', T('雙重音效','Dual Sound')],
        centerHeadshot: () => ['🖼', T('中央頭像','Headshot')],
    };

    function getOverlay() {
        let overlay = document.getElementById('ivh-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ivh-overlay';
            Object.assign(overlay.style, {
                position:      'fixed',
                top:           '0',
                left:          '0',
                width:         '100%',
                height:        '100%',
                pointerEvents: 'none',
                zIndex:        '99999',
                overflow:      'hidden',
            });
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    // ════════════════════════════════════════
    //  1. 粉紅暈染（強度動態）
    // ════════════════════════════════════════
    function triggerPinkFlash() {
        if (!CONFIG.pinkFlash) return;
        const scale   = effectScale();
        const dur     = BASE_PINK_DURATION * Math.min(scale, 1.5);
        const alpha1  = Math.min(0.18 * scale, 0.35);
        const alpha2  = Math.min(0.55 * scale, 0.80);
        const overlay = getOverlay();
        const el      = document.createElement('div');
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            background: `radial-gradient(ellipse at center, transparent 20%, rgba(255,105,180,${alpha1}) 60%, rgba(255,60,150,${alpha2}) 100%)`,
            animation:  `ivhPinkPulse ${dur}ms ease-in-out forwards`,
        });
        overlay.appendChild(el);
        setTimeout(() => el.remove(), dur + 200);
    }

    // ════════════════════════════════════════
    //  2. 邊緣暗角（沉浸感）
    // ════════════════════════════════════════
    function triggerVignette() {
        if (!CONFIG.vignette) return;
        const scale  = effectScale();
        const alpha  = Math.min(0.65 * scale, 0.90);
        const overlay = getOverlay();
        const el     = document.createElement('div');
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            background: `radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,${alpha}) 100%)`,
            animation:  `ivhVignette ${VIGNETTE_DURATION}ms ease-in-out forwards`,
        });
        overlay.appendChild(el);
        setTimeout(() => el.remove(), VIGNETTE_DURATION + 200);
    }

    // ════════════════════════════════════════
    //  3. 催眠螺旋（SVG 旋轉）
    // ════════════════════════════════════════
    function triggerHypnoSpiral() {
        if (!CONFIG.hypnoSpiral) return;
        const scale  = effectScale();
        const head   = getPlayerHeadScreenPos();
        const size   = Math.round(180 * Math.min(scale, 1.6));
        const overlay = getOverlay();

        // 螺旋固定在頭部正中央，不做隨機偏移
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position:      'fixed',
            left:          `${Math.round(head.x - size / 2)}px`,
            top:           `${Math.round(head.y - size / 2 - 20)}px`,
            width:         `${size}px`,
            height:        `${size}px`,
            pointerEvents: 'none',
            opacity:       '0',
            transition:    'opacity 0.4s ease',
            zIndex:        '2',   // 螺旋在頭像(1)之上、煙霧(3)之下
        });

        // SVG 螺旋（阿基米德螺旋線，用多圈弧段組成）
        const ns   = 'http://www.w3.org/2000/svg';
        const svg  = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '-100 -100 200 200');
        svg.setAttribute('width',  `${size}`);
        svg.setAttribute('height', `${size}`);
        svg.style.animation = `ivhSpiralSpin 1800ms linear infinite`;  // 轉速固定，不隨強度變快

        const defs  = document.createElementNS(ns, 'defs');
        const grad  = document.createElementNS(ns, 'radialGradient');
        grad.id = 'ivhSpiralGrad';
        const stops = [
            { offset: '0%',   color: 'rgba(255,200,230,0.95)' },
            { offset: '50%',  color: 'rgba(255,120,180,0.75)' },
            { offset: '100%', color: 'rgba(255,60,150,0)' },
        ];
        stops.forEach(s => {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', s.offset);
            stop.setAttribute('stop-color', s.color);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);
        svg.appendChild(defs);

        // 畫螺旋路徑（3 圈）
        const turns  = 3;
        const points = 360;
        let d        = '';
        for (let i = 0; i <= turns * points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const r     = (i / (turns * points)) * 88;
            const x     = r * Math.cos(angle);
            const y     = r * Math.sin(angle);
            d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'url(#ivhSpiralGrad)');
        path.setAttribute('stroke-width', '3.5');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);

        // 中心光點
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', 'rgba(255,230,245,0.9)');
        circle.style.filter = 'blur(1px)';
        svg.appendChild(circle);

        wrap.appendChild(svg);
        overlay.appendChild(wrap);

        requestAnimationFrame(() => { wrap.style.opacity = '1'; });

        // 結束漸出
        setTimeout(() => {
            wrap.style.transition = 'opacity 0.6s ease';
            wrap.style.opacity    = '0';
        }, SPIRAL_DURATION - 600);
        setTimeout(() => wrap.remove(), SPIRAL_DURATION + 100);
    }

    // ════════════════════════════════════════
    //  4. 同心圓電波（左半邊任意位置，每次固定 3 組）
    // ════════════════════════════════════════
    function triggerHypnoWaves(wordCount = 1) {
        if (!CONFIG.hypnoWaves) return;
        const scale   = effectScale();
        const overlay = getOverlay();
        const dur     = BASE_WAVE_DURATION;

        // 固定 3 組電波，分佈在左半邊 BC 座標（X: 0~1000，Y: 全範圍）
        // BC 畫布是 2000 寬，左半邊是 0~1000
        const groupCount = 3;
        const usedPos = [];

        for (let g = 0; g < groupCount; g++) {
            let bcX, bcY, attempts = 0;
            do {
                bcX = randInt(30, 980);   // 左半邊全範圍
                bcY = randInt(80, 900);
                attempts++;
            } while (
                attempts < 30 &&
                usedPos.some(p => Math.abs(p.x - bcX) < 150 && Math.abs(p.y - bcY) < 120)
            );
            usedPos.push({ x: bcX, y: bcY });

            const pos       = bcToScreen(bcX, bcY);
            const ringCount = Math.round(4 * Math.min(scale, 1.5));
            const groupDelay = g * 220; // 各組略微錯開，視覺更層次

            const wrap = document.createElement('div');
            Object.assign(wrap.style, {
                position:      'fixed',
                left:          `${pos.x}px`,
                top:           `${pos.y}px`,
                width:         '0',
                height:        '0',
                pointerEvents: 'none',
            });

            for (let i = 0; i < ringCount; i++) {
                const ring = document.createElement('div');
                const hue  = 320 + Math.random() * 40;
                Object.assign(ring.style, {
                    position:     'absolute',
                    width:        '10px',
                    height:       '10px',
                    borderRadius: '50%',
                    border:       `2px solid hsla(${hue},100%,78%,0.88)`,
                    transform:    'translate(-50%, -50%)',
                    animation:    `ivhWaveExpand ${dur}ms ease-out ${groupDelay + i * 300}ms forwards`,
                    boxShadow:    `0 0 8px hsla(${hue},100%,75%,0.5)`,
                });
                wrap.appendChild(ring);
            }
            overlay.appendChild(wrap);
            setTimeout(() => wrap.remove(), dur + groupDelay + ringCount * 300 + 200);
        }
    }

    // ════════════════════════════════════════
    //  5. 快照扭曲（截取 canvas → img → CSS transform → 刪除）
    // ════════════════════════════════════════
    function triggerScreenDistort() {
        if (!CONFIG.screenDistort) return;
        const scale  = effectScale();
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return;

        // 截圖
        let dataURL;
        try { dataURL = canvas.toDataURL(); } catch(e) { return; } // 跨域保護時跳過

        const rect    = canvas.getBoundingClientRect();
        const overlay = getOverlay();

        const snap = document.createElement('img');
        snap.src = dataURL;
        Object.assign(snap.style, {
            position:        'fixed',
            left:            `${rect.left}px`,
            top:             `${rect.top}px`,
            width:           `${rect.width}px`,
            height:          `${rect.height}px`,
            pointerEvents:   'none',
            zIndex:          '99990',  // canvas 上，但在 overlay 文字效果下
            transformOrigin: '50% 50%',
            willChange:      'transform, filter, opacity',
        });
        document.body.appendChild(snap);

        // 催眠感：輕微旋轉 + 縮小拉近 + 粉色濾鏡，不做 skew
        const blurAmt = (2.5 * Math.min(scale, 1.8)).toFixed(1);
        const rotAmt  = (2.5 * Math.min(scale, 1.6)).toFixed(2);  // 最多約 4deg
        const HOLD    = 600;    // 扭曲維持時間
        const RECOVER = 1800;   // 恢復時間（慢慢清醒感）

        // 第一幀：旋轉縮小 + 模糊 + 粉調
        requestAnimationFrame(() => {
            snap.style.transition = `transform 400ms cubic-bezier(0.2,0,0.8,1),
                                     filter    400ms ease,
                                     opacity   200ms ease`;
            snap.style.transform  = `rotate(${rotAmt}deg) scale(0.97)`;
            snap.style.filter     = `blur(${blurAmt}px) brightness(0.85) saturate(1.5) hue-rotate(-15deg)`;
            snap.style.opacity    = '1';
        });

        // 中段：反向輕轉（回盪感）
        setTimeout(() => {
            snap.style.transition = `transform ${HOLD}ms cubic-bezier(0.4,0,0.6,1),
                                     filter    ${HOLD}ms ease`;
            snap.style.transform  = `rotate(-${(rotAmt * 0.4).toFixed(2)}deg) scale(0.99)`;
            snap.style.filter     = `blur(${(blurAmt * 0.4).toFixed(1)}px) brightness(0.93) saturate(1.2) hue-rotate(-5deg)`;
        }, 420);

        // 恢復：緩緩歸正，opacity 延後淡出（意識慢慢回來）
        setTimeout(() => {
            snap.style.transition = `transform ${RECOVER}ms cubic-bezier(0.25,0.1,0.25,1),
                                     filter    ${RECOVER}ms cubic-bezier(0.25,0.1,0.25,1),
                                     opacity   ${Math.round(RECOVER * 0.55)}ms ease ${Math.round(RECOVER * 0.45)}ms`;
            snap.style.transform  = 'rotate(0deg) scale(1)';
            snap.style.filter     = 'blur(0px) brightness(1) saturate(1) hue-rotate(0deg)';
            snap.style.opacity    = '0';
        }, 420 + HOLD + 80);

        // 清除快照
        setTimeout(() => snap.remove(), 420 + HOLD + RECOVER + 300);
    }

    // ════════════════════════════════════════
    //  Debug 工具：在螢幕指定位置畫紅圈（持續 N ms）
    // ════════════════════════════════════════
    function _debugDot(x, y, ms = 3000) {
        const dot = document.createElement('div');
        Object.assign(dot.style, {
            position:     'fixed',
            left:         `${x - 10}px`,
            top:          `${y - 10}px`,
            width:        '20px',
            height:       '20px',
            borderRadius: '50%',
            background:   'rgba(255,0,0,0.8)',
            border:       '2px solid white',
            zIndex:       '999999',
            pointerEvents:'none',
        });
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), ms);
    }

    // ════════════════════════════════════════
    //  座標校正 UI（/ivh calibrate 開啟）
    //  浮動面板 + 即時紅點，直接拖拉校正
    // ════════════════════════════════════════
    let _calibratePanel = null;

    function openCalibratePanel() {
        if (_calibratePanel) { _calibratePanel.remove(); _calibratePanel = null; }
        refreshCanvasCache();

        const panel = document.createElement('div');
        _calibratePanel = panel;
        Object.assign(panel.style, {
            position:    'fixed',
            top:         '60px',
            right:       '20px',
            width:       '260px',
            background:  '#301B3D',
            border:      '1px solid rgba(255,100,200,0.4)',
            borderRadius:'10px',
            padding:     '12px',
            zIndex:      '999999',
            fontFamily:  'monospace',
            fontSize:    '12px',
            color:       '#ffccee',
            userSelect:  'none',
        });

        const title = document.createElement('div');
        title.textContent = '🌀 IVH 頭部座標校正';
        title.style.cssText = 'font-weight:bold;margin-bottom:10px;color:#ff99dd;font-size:13px';
        panel.appendChild(title);

        // 頭部 asset Y / 嘴部 asset Y / 水平 / 螢幕 Y 微調
        const sliders = [
            { key: 'headAY',  label: '頭部 asset Y', min: 0,    max: 500,  step: 2  },
            { key: 'mouthAY', label: '嘴部 asset Y', min: 0,    max: 600,  step: 2  },
            { key: 'x',       label: '水平 X',        min: -200, max: 200,  step: 5  },
            { key: 'yExtra',  label: 'Y 微調(px)',    min: -200, max: 200,  step: 2  },
        ];

        const dots = [];
        sliders.forEach(({ key, label, min, max, step }) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:8px';

            const labelEl = document.createElement('div');
            labelEl.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:2px';
            const lspan = document.createElement('span'); lspan.textContent = label;
            const vspan = document.createElement('span');
            vspan.textContent = HEAD_OFFSET[key];
            vspan.id = `ivh-cal-val-${key}`;
            labelEl.appendChild(lspan); labelEl.appendChild(vspan);

            const slider = document.createElement('input');
            slider.type  = 'range';
            slider.min   = String(min); slider.max = String(max); slider.step = String(step);
            slider.value = String(HEAD_OFFSET[key]);
            slider.style.cssText = 'width:100%;accent-color:#ff80cc;cursor:pointer';

            slider.addEventListener('input', () => {
                HEAD_OFFSET[key] = parseFloat(slider.value);
                vspan.textContent = slider.value;
                _updateCalibrateDot();
            });

            row.appendChild(labelEl); row.appendChild(slider);
            panel.appendChild(row);
        });

        // 紅點顯示目前頭部位置
        let _dot = null;
        function _updateCalibrateDot() {
            if (_dot) _dot.remove();
            const head = getPlayerHeadScreenPos();
            _dot = document.createElement('div');
            Object.assign(_dot.style, {
                position:     'fixed',
                left:         `${head.x - 12}px`,
                top:          `${head.y - 12}px`,
                width:        '24px',
                height:       '24px',
                borderRadius: '50%',
                background:   'rgba(255,0,80,0.85)',
                border:       '2px solid white',
                zIndex:       '999998',
                pointerEvents:'none',
                boxShadow:    '0 0 10px rgba(255,0,80,0.6)',
            });
            const line = document.createElement('div');
            Object.assign(line.style, {
                position: 'absolute', top: '50%', left: '-30px',
                width: '84px', height: '2px',
                background: 'rgba(255,100,100,0.5)',
                transform: 'translateY(-50%)',
            });
            _dot.appendChild(line);
            document.body.appendChild(_dot);
        }
        _updateCalibrateDot();

        // 複製值按鈕
        const copyRow = document.createElement('div');
        copyRow.style.cssText = 'margin-top:10px;display:flex;gap:6px';
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 複製設定值';
        copyBtn.style.cssText = 'flex:1;background:#3a0a50;border:1px solid #ff80cc;border-radius:5px;color:#ffccee;padding:5px;cursor:pointer;font-size:11px';
        copyBtn.onclick = () => {
            const txt = `headAY:${HEAD_OFFSET.headAY} mouthAY:${HEAD_OFFSET.mouthAY} x:${HEAD_OFFSET.x} yExtra:${HEAD_OFFSET.yExtra}`;
            navigator.clipboard.writeText(txt).catch(() => {});
            printChat('🔧 校正值已複製: ' + txt);
        };
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:#2a0a30;border:1px solid #ff80cc;border-radius:5px;color:#ffccee;padding:5px 8px;cursor:pointer';
        closeBtn.onclick = () => {
            panel.remove(); _calibratePanel = null;
            if (_dot) { _dot.remove(); _dot = null; }
        };
        copyRow.appendChild(copyBtn); copyRow.appendChild(closeBtn);
        panel.appendChild(copyRow);

        document.body.appendChild(panel);
        printChat('🔧 校正面板已開啟，拉動滑條即時看紅點位置，調好後點「複製設定值」給開發者');
    }

    // ════════════════════════════════════════
    //  自動換行：12 全形字元 / 24 半形字元換一行
    // ════════════════════════════════════════
    function wrapDanmakuText(text, fullWidth = 12) {
        // 判斷全形字（CJK、全形標點等）= 2 寬度；半形 = 1 寬度
        const charWidth = (ch) => {
            const code = ch.codePointAt(0);
            // CJK 統一漢字、全形符號、片假名、平假名
            if ((code >= 0x1100 && code <= 0x115F) ||
                (code >= 0x2E80 && code <= 0x9FFF) ||
                (code >= 0xA000 && code <= 0xA4CF) ||
                (code >= 0xAC00 && code <= 0xD7AF) ||
                (code >= 0xF900 && code <= 0xFAFF) ||
                (code >= 0xFE10 && code <= 0xFE1F) ||
                (code >= 0xFE30 && code <= 0xFE4F) ||
                (code >= 0xFF00 && code <= 0xFF60) ||
                (code >= 0xFFE0 && code <= 0xFFE6)) return 2;
            return 1;
        };
        const halfLimit = fullWidth * 2; // 半形字元上限
        const lines = [];
        let cur = '', curW = 0;
        for (const ch of [...text]) {
            const w = charWidth(ch);
            if (curW + w > halfLimit) { lines.push(cur); cur = ch; curW = w; }
            else                      { cur += ch; curW += w; }
        }
        if (cur) lines.push(cur);
        return lines.join('\n');
    }

    // ════════════════════════════════════════
    //  6. 彈幕：主台詞在頭上波浪，其餘散落左側
    //  - 旁白句：4~9 句，依 3 等份分配字體大小
    //    第一份最小，第三份最大（疊加感）
    //  - 主台詞：固定在角色頭部正上方，波浪動畫
    // ════════════════════════════════════════
    function triggerDanmakuMulti(triggerText, _count) {
        if (!CONFIG.danmaku) return;
        const scale   = effectScale();
        const overlay = getOverlay();

        // ── 主台詞：角色頭上，波浪動畫 ──
        const head = getPlayerHeadScreenPos();
        _showMainDanmaku(overlay, triggerText, head, scale);

        // ── 旁白句：聊天室 3 條 + (BCX＋催眠文本) 3 條（保證含自訂文本）──
        const custom   = (CONFIG.customTexts || []).filter(Boolean);
        const bcx      = getBCXReminderList().filter(Boolean);
        const catalyst = [...bcx, ...custom];
        const fromChat = pickRandom(getChatHistoryLines(), 3);
        let fromText   = pickRandom(catalyst, 3);
        if (custom.length && !fromText.some(t => custom.includes(t)))
            fromText[0] = custom[Math.floor(Math.random() * custom.length)];   // 至少 1 句自訂
        fromText = fromText.map(resolveMe);
        const sideTexts = [...fromChat, ...fromText];
        const sideCount = sideTexts.length;
        if (sideCount === 0) return;

        // 依強度決定 3 組字體等級：0.1~1.0→[1,1,1]、1.1~2.0→[2,2,1]、2.1~3.0→[3,3,1]
        const it     = CONFIG.intensity || 1;
        const levels = it <= 1.0 ? [1, 1, 1] : it <= 2.0 ? [2, 2, 1] : [3, 3, 1];
        const ptMap  = [0, 15, 21, 27];   // 等級→pt
        const groupSize = Math.ceil(sideCount / 3);

        // 排除頭部附近的座標（BC 座標）
        const headBcX = playerDrawPos.valid ? playerDrawPos.x + 240 * playerDrawPos.zoom : 240;
        const headBcY = playerDrawPos.valid ? playerDrawPos.y + 120 * playerDrawPos.zoom : 120;
        const HEAD_SAFE_R = 180; // 頭部安全圓半徑（BC 座標單位）

        const usedSlots = [];

        sideTexts.forEach((text, idx) => {
            const group    = Math.min(2, Math.floor(idx / groupSize));   // 0,1,2
            const level    = levels[group];                              // 1~3
            const tier     = level - 1;                                  // 樣式用
            const fontSize = Math.round(ptMap[level] * Math.min(scale, 1.2));

            let bcX, bcY, attempts = 0;
            do {
                bcX = randInt(20, 500);   // 左半側
                bcY = randInt(80, 900);
                attempts++;
            } while (
                attempts < 30 && (
                    usedSlots.some(s => Math.abs(s.x - bcX) < 120 && Math.abs(s.y - bcY) < 70) ||
                    (Math.abs(bcX - headBcX) < HEAD_SAFE_R && Math.abs(bcY - headBcY) < HEAD_SAFE_R)
                )
            );
            usedSlots.push({ x: bcX, y: bcY });

            const pos       = bcToScreen(bcX, bcY);
            const lineDelay = idx * 180;

            const wrap = document.createElement('div');
            Object.assign(wrap.style, {
                position:      'fixed',
                left:          `${pos.x}px`,
                top:           `${pos.y}px`,
                fontSize:      `${fontSize}px`,
                fontWeight:    tier === 2 ? '700' : '500',
                fontFamily:    '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                whiteSpace:    'nowrap',
                letterSpacing: '1.5px',
                color:         `rgba(255,210,235,${0.55 + tier * 0.15})`,
                textShadow:    `0 0 ${6 + tier * 4}px rgba(255,105,180,${0.6 + tier * 0.2})`,
                opacity:       '0',
                pointerEvents: 'none',
                transform:     'translateY(10px)',
            });
            overlay.appendChild(wrap);

            setTimeout(() => {
                wrap.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                wrap.style.opacity    = String(0.55 + tier * 0.15);
                wrap.style.transform  = 'translateY(0)';
            }, lineDelay);

            // 自動換行（12 全形 / 24 半形）
            const wrapped = wrapDanmakuText(text, 12);
            wrap.style.whiteSpace = 'pre-line';
            wrap.textContent = wrapped;

            const totalDur = lineDelay + BASE_DANMAKU_DURATION + sideCount * 80;
            setTimeout(() => {
                wrap.style.transition = 'opacity 1s ease, transform 1s ease';
                wrap.style.opacity    = '0';
                wrap.style.transform  = 'translateY(-14px)';
            }, totalDur - 1000);
            setTimeout(() => wrap.remove(), totalDur + 300);
        });
    }

    // 主台詞波浪效果（在角色頭部正上方）
    function _showMainDanmaku(overlay, text, headPos, scale) {
        const fontSize = Math.round(24 * Math.min(scale, 1.5));  // 主台詞比旁白大 +4pt
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position:      'fixed',
            left:          `${headPos.x}px`,
            top:           `${headPos.y - fontSize * 2.2}px`,  // 頭頂上方
            fontSize:      `${fontSize}px`,
            fontWeight:    '700',
            fontFamily:    '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
            whiteSpace:    'nowrap',
            letterSpacing: '3px',
            color:         'rgba(255,230,245,1)',
            textShadow:    '0 0 10px rgba(255,80,160,1), 0 0 28px rgba(255,80,160,0.7), 0 0 50px rgba(255,60,140,0.4)',
            opacity:       '0',
            pointerEvents: 'none',
            transform:     'translateX(-50%)',  // 水平置中對齊頭部
        });

        // 主觸發詞超過 10 字元自動換行（10 全形 / 20 半形）
        const wrappedText = wrapDanmakuText(text, 10);
        // 逐字建立，每個字有波浪 delay
        const chars = [...wrappedText];
        chars.forEach((ch, i) => {
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.cssText = `
                display:inline-block;
                animation: ivhWaveChar 1.8s ease-in-out ${i * 80}ms infinite;
                opacity:0;
                transition: opacity 0.3s ease ${i * 40}ms;
            `;
            wrap.appendChild(span);
        });

        overlay.appendChild(wrap);

        // 淡入
        requestAnimationFrame(() => requestAnimationFrame(() => {
            wrap.style.opacity = '1';
            wrap.querySelectorAll('span').forEach(s => s.style.opacity = '1');
        }));

        // 淡出（比旁白句晚一點消失，主台詞是重點）
        const dur = BASE_DANMAKU_DURATION + 1200;
        setTimeout(() => {
            wrap.style.transition = 'opacity 1.2s ease';
            wrap.style.opacity    = '0';
        }, dur - 1200);
        setTimeout(() => wrap.remove(), dur + 200);
    }

    // ════════════════════════════════════════
    //  7. 喘氣呼吸（每次呼吸噴一口氣，約 1 秒一次、持續約 10 秒）
    //  位置：角色真實嘴部 +（中央頭像存在時）頭像嘴部
    // ════════════════════════════════════════
    function _breathSizeScale() {
        return Math.max(0.4, Math.min(2.2, (playerDrawPos.zoom || 1) * (_cachedScaleX || 0.3) * 2.4));
    }

    // 取得本次呼吸要噴氣的嘴部位置陣列（含各自的大小係數）
    function getBreathMouths() {
        const out = [];
        if (playerDrawPos.valid && _cachedRect && isPlayerOnCurrentPage()) {
            const bc = bodyAssetToBc(250 + HEAD_OFFSET.x, HEAD_OFFSET.mouthAY);
            const s  = bcToScreen(bc.x, bc.y); s.y += HEAD_OFFSET.yExtra;
            out.push({ x: s.x, y: s.y, ss: _breathSizeScale() });
        }
        // 中央頭像存在時，頭像的嘴也喘氣（頭像較大 → 氣團較大）
        if (CONFIG.centerHeadshot && _centerHeadEl) {
            const c = bcToScreen(500, 430);
            out.push({ x: c.x, y: c.y, ss: 1.8 });
        }
        if (out.length === 0) {
            const m = getPlayerMouthScreenPos();
            out.push({ x: m.x, y: m.y, ss: _breathSizeScale() });
        }
        return out;
    }

    // 噴一口氣（1~2 個小霧團）
    function _emitBreathPuff(overlay, mouth) {
        const n = 1 + (Math.random() < 0.45 ? 1 : 0);
        for (let i = 0; i < n; i++) {
            const ss      = mouth.ss;
            const size    = (10 + Math.random() * 12) * ss;
            const offsetX = (Math.random() - 0.5) * 16 * ss;
            const offsetY = (Math.random() - 0.2) * 6 * ss;
            const dur     = 1400 + Math.random() * 1200;
            const dir     = Math.floor(Math.random() * 3);
            const alpha   = 0.26 + Math.random() * 0.22;   // 比原本濃約 20%
            const p = document.createElement('div');
            Object.assign(p.style, {
                position:     'fixed',
                left:         `${mouth.x + offsetX}px`,
                top:          `${mouth.y + offsetY}px`,
                width:        `${size}px`,
                height:       `${size}px`,
                borderRadius: '50%',
                background:   `radial-gradient(circle at 50% 50%, rgba(255,255,255,${alpha}) 0%, rgba(255,255,255,${alpha * 0.5}) 45%, rgba(255,255,255,0) 72%)`,
                filter:       `blur(${(3 + Math.random() * 2).toFixed(1)}px)`,
                animation:    `ivhBreath${dir} ${dur}ms ease-out forwards`,
                willChange:   'transform, opacity',
                zIndex:       '3',   // 煙霧在最上層
            });
            overlay.appendChild(p);
            setTimeout(() => p.remove(), dur + 200);
        }
    }

    let _breathLoopUntil = 0;
    function triggerSteamParticles(force = false) {
        if (!force && !CONFIG.steamParticles) return;
        const overlay = getOverlay();
        // 延長本次呼吸的結束時間（重複觸發時不疊加多個迴圈，只延長）
        const FRESH = _breathLoopUntil < Date.now();
        _breathLoopUntil = Date.now() + 10000;   // 約 10 秒
        if (!FRESH) return;                      // 已有迴圈在跑 → 只延長時間

        const breathe = () => {
            if (Date.now() > _breathLoopUntil) return;
            getBreathMouths().forEach(m => _emitBreathPuff(overlay, m));
            setTimeout(breathe, 850 + Math.random() * 350);  // 每次呼吸約 1 秒
        };
        breathe();
    }

    // ════════════════════════════════════════
    //  高潮特效
    //  快照破壞：像素碎裂 + 紅白閃 + 震動
    // ════════════════════════════════════════
    function triggerClimaxEffect(scale = 1) {
        if (!CONFIG.climax) return;
        if (CONFIG.sound) playSoundCategory('climax', Math.min(0.5 + scale * 0.2, 1));  // 高潮聲
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return;

        // 快照整個 canvas
        let dataURL;
        try { dataURL = canvas.toDataURL(); } catch(e) { return; }
        const rect = canvas.getBoundingClientRect();

        // ── 全螢幕用 window 尺寸（不限 canvas rect）──
        const SW = window.innerWidth;
        const SH = window.innerHeight;

        const overlay = getOverlay();

        // ── Layer 1: 黑幕底層（碎片飛散後顯示，然後慢慢淡出）──
        const blackBg = document.createElement('div');
        Object.assign(blackBg.style, {
            position:      'fixed',
            inset:         '0',
            background:    'black',
            zIndex:        '99989',   // 在碎片(99991)下面，確保碎片飛散後看到黑
            opacity:       '1',
            pointerEvents: 'none',
            transition:    'none',
        });
        document.body.appendChild(blackBg);

        // ── 紅白閃光（全螢幕）──
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position:      'fixed',
            inset:         '0',
            zIndex:        '99997',
            opacity:       '0',
            pointerEvents: 'none',
            animation:     `ivhClimaxFlash ${Math.round(700 / scale)}ms ease-out forwards`,
        });
        overlay.appendChild(flash);
        setTimeout(() => flash.remove(), 800);

        // ── 不規則多邊形碎片 ──
        // 先把 canvas 畫到一個全螢幕大小的 offscreen canvas
        const master = document.createElement('canvas');
        master.width  = SW;
        master.height = SH;
        const mctx = master.getContext('2d');
        // canvas 可能不是全螢幕，按實際位置繪製
        try {
            mctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height);
        } catch(e) { return; }

        // 產生 Voronoi 風格的隨機種子點
        const FRAG_COUNT = 48 + Math.round(scale * 10); // 48~60 個碎片（更密集）
        const seeds = Array.from({length: FRAG_COUNT}, () => ({
            x: Math.random() * SW,
            y: Math.random() * SH,
        }));

        // 每個種子建立一個不規則多邊形碎片（簡化：找最近的幾個鄰居拉出凸包近似）
        // 實作：用 clip path SVG polygon，讓每個碎片 canvas 用 clip 裁切
        seeds.forEach((seed, si) => {
            // 用隨機偏移建出一個不規則多邊形（6~9 個頂點）
            const sides  = 6 + Math.floor(Math.random() * 4);
            const radius = 60 + Math.random() * 80 * scale;
            const pts    = [];
            for (let k = 0; k < sides; k++) {
                const angle = (k / sides) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
                const r     = radius * (0.55 + Math.random() * 0.7);
                pts.push({ x: seed.x + r * Math.cos(angle), y: seed.y + r * Math.sin(angle) });
            }

            // 建立 canvas，clip 成多邊形，貼上截圖
            const fc  = document.createElement('canvas');
            fc.width  = SW;
            fc.height = SH;
            const fctx = fc.getContext('2d');
            fctx.beginPath();
            fctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach(p => fctx.lineTo(p.x, p.y));
            fctx.closePath();
            fctx.clip();
            fctx.drawImage(master, 0, 0);

            // 輕微邊緣描邊，增加撕裂感
            fctx.strokeStyle = 'rgba(255,120,160,0.6)';
            fctx.lineWidth   = 1.5;
            fctx.beginPath();
            fctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach(p => fctx.lineTo(p.x, p.y));
            fctx.closePath();
            fctx.stroke();

            const dx      = (seed.x - SW / 2) * (0.8 + Math.random() * 1.2) * scale;
            const dy      = (seed.y - SH / 2) * (0.8 + Math.random() * 1.2) * scale;
            const rot     = (Math.random() - 0.5) * 80 * scale;
            const dur     = (800 + Math.random() * 600) * (1 / Math.max(scale, 0.5));
            // 定格停頓：碎片先靜止 550ms（讓玩家看清破碎），再飛散
            // 每個碎片的 delay = 定格時間 + 輕微錯開（各片不完全同時）
            const FREEZE  = 550;
            const scatter = FREEZE + si * 10;

            Object.assign(fc.style, {
                position:        'fixed',
                left:            '0',
                top:             '0',
                width:           `${SW}px`,
                height:          `${SH}px`,
                pointerEvents:   'none',
                zIndex:          '99991',
                transformOrigin: `${seed.x}px ${seed.y}px`,
                // transition 帶入 delay，飛散前靜止
                transition:      `transform ${dur}ms cubic-bezier(0.15,0,0.9,1) ${scatter}ms,
                                  opacity   ${dur * 0.45}ms ease ${scatter + dur * 0.55}ms`,
                willChange:      'transform, opacity',
            });
            document.body.appendChild(fc);

            // 立刻渲染（定格在原位），delay 到時再飛散
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fc.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${0.2 + Math.random() * 0.5})`;
                fc.style.opacity   = '0';
            }));

            setTimeout(() => fc.remove(), scatter + dur + 300);
        });

        // ── 全螢幕震動 ──
        const shakeEl = document.createElement('div');
        Object.assign(shakeEl.style, {
            position:      'fixed',
            inset:         '0',
            pointerEvents: 'none',
            zIndex:        '99999',
            animation:     `ivhClimaxShake ${Math.round(500 / scale)}ms ease-out forwards`,
        });
        overlay.appendChild(shakeEl);
        setTimeout(() => shakeEl.remove(), 600);

        // ── 黑幕淡出（碎片都飛散後，黑幕在 1~1.5 秒內淡出移除）──
        // 等最慢的碎片飛完（FREEZE=550 + scatter最大 si*10 + dur最長約1500）
        const blackFadeDelay = 550 + FRAG_COUNT * 10 + 800;
        const blackFadeDur   = 1200 + Math.random() * 300;
        setTimeout(() => {
            blackBg.style.transition = `opacity ${blackFadeDur}ms ease`;
            blackBg.style.opacity    = '0';
        }, blackFadeDelay);
        setTimeout(() => blackBg.remove(), blackFadeDelay + blackFadeDur + 100);
    }

    // ════════════════════════════════════════
    //  聲音系統
    //  音源系統：預載 GitHub 音源，有快取才播放
    //  載入失敗 → 本地聊天訊息提示（10秒後自動消失）
    //  音源來自 https://www.pincree.jp/
    // ════════════════════════════════════════
    const SND_BASE = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Sound/IVH/';

    // 內建音效庫（唯一一份；「其他」可從這裡挑選，依類別分組）
    const SOUND_PRESETS = [
        { url: SND_BASE + 'groan-KitakamiTsubasa01_pincree_.mp3',        cat: '催眠', name: '呻吟1' },
        { url: SND_BASE + 'groan-KitakamiTsubasa02_pincree_.mp3',        cat: '催眠', name: '呻吟2' },
        { url: SND_BASE + 'groan-KitakamiTsubasa03_pincree_.mp3',        cat: '催眠', name: '呻吟3' },
        { url: SND_BASE + 'groan-KitakamiTsubasa04_pincree_.mp3',        cat: '催眠', name: '呻吟4' },
        { url: SND_BASE + 'cum-KitakamiTsubasa_pincree_.mp3',            cat: '高潮', name: '高潮' },
        { url: SND_BASE + 'short-Heartbeat_vita-chi_.mp3',               cat: '短音', name: '心跳' },
        { url: SND_BASE + 'short-Whip-universfield_pixabay_.mp3',        cat: '短音', name: '鞭打' },
        { url: SND_BASE + 'short-Whip2-universfield_pixabay_.mp3',       cat: '短音', name: '鞭打2' },
        { url: SND_BASE + 'long-Whips-dragon-studio_pixabay_.mp3',       cat: '長音', name: '連續鞭打' },
        { url: SND_BASE + 'short-WindChime-wingsoarstudio_pixabay_.mp3', cat: '短音', name: '風鈴' },
        { url: SND_BASE + 'short-Bell-soundreality_pixabay_.mp3',        cat: '短音', name: '鍾聲' },
        { url: SND_BASE + 'short-BeepTone_vita-chi.mp3',                 cat: '短音', name: 'Beep音' },
        { url: SND_BASE + 'short-Pointer_vita-chi_.mp3',                 cat: '短音', name: '指針' },
        { url: SND_BASE + 'long-Pointers_vita-chi_.mp3',                 cat: '長音', name: '連續指針' },
    ];

    // 各分類的內建預設音效（空格時生效；effect 播放也以此後備）
    const SOUND_DEFAULTS = {
        hypno:  SOUND_PRESETS.filter(p => p.cat === '催眠').map(p => p.url),  // 呻吟 ×4
        voice:  [SND_BASE + 'short-Heartbeat_vita-chi_.mp3'],                 // 催眠2＝心跳
        climax: [SND_BASE + 'cum-KitakamiTsubasa_pincree_.mp3'],              // 高潮
        depth:  [SND_BASE + 'long-Pointers_vita-chi_.mp3'],                   // 深度
    };
    function soundDefault(cat, i = 0) { return (SOUND_DEFAULTS[cat] || [])[i] || ''; }

    const _soundBufferCache = new Map(); // url → AudioBuffer
    let _audioCtx = null;

    function _getAudioCtx() {
        if (!_audioCtx || _audioCtx.state === 'closed') {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return _audioCtx;
    }

    // 預載所有音源（進房間後呼叫一次）
    // 失敗時用 printChat 留訊息（10 秒後自動消失）
    function preloadSounds() {
        const list = SOUND_DEFAULTS.hypno;   // 預載催眠呻吟（喘息後備）
        if (!list.length) return;
        let _failNotified = false;
        list.forEach(url => {
            if (_soundBufferCache.has(url)) return;
            const ctx = _getAudioCtx();
            fetch(url)
                .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.arrayBuffer();
            })
                .then(ab => ctx.decodeAudioData(ab))
                .then(buf => {
                _soundBufferCache.set(url, buf);
            })
                .catch(e => {
                // 每次重新進房間只通知一次，避免四個 URL 連續刷訊息
                if (!_failNotified) {
                    _failNotified = true;
                    // 延遲 3 秒，等玩家看完催眠特效再顯示
                    setTimeout(() => {
                        printChat(
                            T('🔇 IVH 音源載入失敗，聲音效果暫時停用', '🔇 IVH sound load failed, audio disabled'),
                            10000  // 10 秒後消失
                        );
                    }, 3000);
                }
            });
        });
    }

    // ── 通用音效解析 / 播放（支援 URL 與本機 idb:<id>）──
    function resolveSoundBuffer(entry) {
        return new Promise(resolve => {
            if (!entry) return resolve(null);
            if (_soundBufferCache.has(entry)) return resolve(_soundBufferCache.get(entry));
            const ctx = _getAudioCtx();
            const onAB = ab => ctx.decodeAudioData(ab.slice(0))
                .then(buf => { _soundBufferCache.set(entry, buf); resolve(buf); })
                .catch(() => resolve(null));
            if (entry.startsWith('idb:')) {
                IVHDB.get('sounds', entry.slice(4)).then(rec => {
                    if (rec && rec.bytes) onAB(rec.bytes); else resolve(null);
                });
            } else {
                fetch(entry).then(r => r.ok ? r.arrayBuffer() : Promise.reject())
                    .then(onAB).catch(() => resolve(null));
            }
        });
    }
    let _previewSrc = null;   // 目前的試聽音源（換一個會停掉前一個）
    function playSoundEntry(entry, vol = 0.8, stopPrev = false) {
        resolveSoundBuffer(entry).then(buf => {
            if (!buf) return;
            try {
                if (stopPrev && _previewSrc) { try { _previewSrc.stop(); } catch (e) {} _previewSrc = null; }
                const ctx = _getAudioCtx();
                const src = ctx.createBufferSource(); src.buffer = buf;
                const g = ctx.createGain(); g.gain.value = Math.min(Math.max(vol, 0), 1);
                src.connect(g); g.connect(ctx.destination); src.start();
                if (stopPrev) { _previewSrc = src; src.onended = () => { if (_previewSrc === src) _previewSrc = null; }; }
            } catch (e) {}
        });
    }
    // 播放某分類的隨機一個（hypno/climax/depth/voice）；無設定回傳 false
    function playSoundCategory(cat, vol = 0.8, useDefault = true) {
        let list = ((CONFIG.sounds && CONFIG.sounds[cat]) || []).filter(Boolean);
        if (list.length === 0 && useDefault) list = SOUND_DEFAULTS[cat] || [];
        if (list.length === 0) return false;
        playSoundEntry(list[Math.floor(Math.random() * list.length)], vol);
        return true;
    }
    // 本機檔案上傳 → 存 IndexedDB，設定為 idb:<id>
    function uploadSoundFile(cat, idx) {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'audio/*';
        inp.onchange = () => {
            const f = inp.files && inp.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = async () => {
                const id = 'snd_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                const name = f.name.replace(/\.[^.]+$/, '');   // 去副檔名當名稱
                await IVHDB.put('sounds', { id, name, bytes: r.result });
                _sndNameCache[id] = name;
                CONFIG.sounds[cat][idx] = 'idb:' + id;
                saveSettings();
                EXT._localLoaded = false;   // 讓音效庫重新載入顯示
            };
            r.readAsArrayBuffer(f);
        };
        inp.click();
    }
    const _sndNameCache = {}; // id -> filename（顯示用）

    // 刪除一個本機音效（從 DB 移除、清掉所有引用的格子、刷新音效庫）
    function deleteLocalSound(id) {
        const ref = 'idb:' + id;
        try { IVHDB.delete('sounds', id); } catch (e) {}
        for (const cat in CONFIG.sounds) {
            CONFIG.sounds[cat] = (CONFIG.sounds[cat] || []).map(e => (e === ref ? '' : e));
        }
        delete _sndNameCache[id];
        saveSettings();
        EXT._localLoaded = false;
    }

    // 播放催眠喘息聲（催眠分類，含預設後備）
    function triggerBreathSound(scale = 1) {
        if (!CONFIG.sound) return;
        const vol = Math.min(0.5 + scale * 0.15, 0.9);
        playSoundCategory('hypno', vol);
    }

    // ════════════════════════════════════════
    //  8. 表情
    // ════════════════════════════════════════
    //  BC 有兩個眼睛組：Eyes(右眼) / Eyes2(左眼)；WCE 再對應 右眼_Luzi / 左眼_Luzi
    function saveExpression() {
        const groups = ["Eyebrows", "Eyes", "Eyes2", "Mouth", "Blush"];
        const saved  = {};
        for (const g of groups) {
            const item = Player.Appearance.find(a => a.Asset.Group.Name === g);
            saved[g]   = item?.Property?.Expression ?? null;
        }
        return saved;
    }

    // 把一組表情展開成各群組要套用的值（雙眼預設一致；含 Luzi）
    function _expandExpr(exprObj) {
        const eyes  = exprObj.Eyes ?? null;
        const eyes2 = (exprObj.Eyes2 !== undefined) ? exprObj.Eyes2 : eyes;  // 沒指定左眼 → 跟右眼一致
        return {
            Eyebrows:   exprObj.Eyebrows ?? null,
            Eyes:       eyes,
            Eyes2:      eyes2,
            Mouth:      exprObj.Mouth ?? null,
            Blush:      exprObj.Blush ?? null,
            '右眼_Luzi': eyes,
            '左眼_Luzi': eyes2,
        };
    }

    function applyExpression(exprObj) {
        const map = _expandExpr(exprObj);
        // 1. 同步到伺服器（其他人看得到；Luzi 群組可能不被原生函式接受，try 即可）
        for (const [g, val] of Object.entries(map)) {
            try { CharacterSetFacialExpression(Player, g, val); } catch (e) {}
        }
        // 2. 直接設 Property，確保本地 canvas 立即更新（含左眼 Eyes2 / Luzi）
        for (const [g, val] of Object.entries(map)) {
            try {
                const it = Player.Appearance.find(a => a.Asset.Group.Name === g);
                if (it) { if (!it.Property) it.Property = {}; it.Property.Expression = val; }
            } catch (e) {}
        }
        try { CharacterRefresh(Player, false, false); } catch (e) {}
    }

    // 表情效果共用堆疊：避免 VOICE 與深度同時觸發時，互相把對方套的表情當成「原始值」存起來
    //  → 第一個進入時才記錄真實表情；全部結束才還原真實表情
    let _exprRealSnapshot = null;
    let _exprEffectCount  = 0;
    function pushExprEffect(exprObj) {
        try {
            if (_exprEffectCount === 0) _exprRealSnapshot = saveExpression();
            _exprEffectCount++;
            applyExpression(exprObj);
        } catch (e) {}
    }
    function popExprEffect() {
        try {
            _exprEffectCount--;
            if (_exprEffectCount <= 0) {
                _exprEffectCount = 0;
                if (_exprRealSnapshot) { applyExpression(_exprRealSnapshot); _exprRealSnapshot = null; }
            }
        } catch (e) {}
    }

    // 取某表情組的有效值清單（含 null=無表情），用於設定頁循環選擇
    const _exprOptCache = {};
    function getExpressionOptions(group) {
        if (_exprOptCache[group]) return _exprOptCache[group];
        let arr = [];
        try {
            const item = Player?.Appearance?.find(a => a.Asset.Group.Name === group);
            const g = item?.Asset?.Group
                   || (typeof AssetGroupGet === 'function' ? AssetGroupGet(Player?.AssetFamily || 'Female3DCG', group) : null);
            if (g && Array.isArray(g.AllowExpression)) arr = [...g.AllowExpression];
        } catch (e) {}
        if (!arr.includes(null)) arr = [null, ...arr];
        _exprOptCache[group] = arr;
        return arr;
    }
    // 循環切換某表情組的值
    function cycleExpression(setObj, group, dir = 1) {
        const opts = getExpressionOptions(group);
        const cur  = setObj[group] ?? null;
        let idx = opts.indexOf(cur); if (idx < 0) idx = 0;
        idx = (idx + dir + opts.length) % opts.length;
        setObj[group] = opts[idx];
    }
    // 只在本地套用表情（不同步伺服器），給設定頁即時預覽用
    function applyExpressionLocal(obj) {
        const map = _expandExpr(obj);
        for (const [g, val] of Object.entries(map)) {
            const it = Player.Appearance.find(a => a.Asset.Group.Name === g);
            if (it) { if (!it.Property) it.Property = {}; it.Property.Expression = val; }
        }
        try { CharacterRefresh(Player, false, false); } catch (e) {}
    }

    // 截目前 Player 臉部成 Image（給設定頁臉部預覽）
    function captureFaceImage(cb, srcCanvas) {
        try {
            const src = srcCanvas || (Player && Player.Canvas);
            if (!src || !src.width) return;
            const SZ = 320;
            const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
            const c  = cv.getContext('2d');
            const side  = src.width * 0.20;             // 較緊 → 臉更大
            const cropX = src.width  * 0.50 - side / 2;
            const cropY = src.height * 0.43 - side * 0.22;  // 頭往上（臉位於框上方 30%）
            c.drawImage(src, cropX, cropY, side, side, 0, 0, SZ, SZ);
            const img = new Image();
            img.onload = () => cb(img);
            img.src = cv.toDataURL();
        } catch (e) {}
    }

    // ════════════════════════════════════════
    //  9. 興奮度
    // ════════════════════════════════════════
function addArousal() {
    if (!CONFIG.arousal) return 1;
    try {
        if (!Player.ArousalSettings || Player.ArousalSettings.Active === "Inactive") return 1;

        const current = Player.ArousalSettings.Progress ?? 0;

        let add = randInt(1, 5);

        // 越接近滿值增加越慢（更自然）
        if (current > 80) add = randInt(1, 3);
        if (current > 92) add = randInt(1, 2);

        const newVal = Math.min(current + add, 100);

        ActivitySetArousal(Player, newVal);

        return add;
    } catch (e) {
        console.error("[IVH] addArousal 錯誤:", e);
        return 1;
    }
}

    // ════════════════════════════════════════
    //  觸發時發送狀態 emote（讓他人知道你的狀態）
    //  ChatRoomSendEmote 會自動帶上玩家名字，傳後綴即可
    // ════════════════════════════════════════
    function sendStatusEmote() {
        if (!CONFIG.emoteEnabled) return;
        const list = CONFIG.emoteList || [];
        if (list.length === 0) return;
        let msg = list[Math.floor(Math.random() * list.length)];
        // $me 換成玩家暱稱；以 "*" 前綴送出（動作格式）
        const me = (typeof CharacterNickname === 'function' ? CharacterNickname(Player) : '')
                   || Player?.Nickname || Player?.Name || '';
        msg = msg.split('$me').join(me);
        try {
            if (typeof ServerSend === 'function') ServerSend('ChatRoomChat', { Type: 'Emote', Content: "*"+msg });
        } catch (e) { /* 靜默 */ }
    }

    // ════════════════════════════════════════
    //  中央頭像：裁玩家臉部成 300×300，置於畫面左半中心
    //  （螺旋／喘氣等效果會以此為基準，忽略分頁問題）
    // ════════════════════════════════════════
    let _centerHeadEl = null;
    function showCenterHeadshot(durationMs) {
        try {
            if (_centerHeadEl) { _centerHeadEl.remove(); _centerHeadEl = null; }

            const SZ  = 300;
            const cv  = document.createElement('canvas'); cv.width = cv.height = SZ;
            const ctx = cv.getContext('2d');
            const pos     = bcToScreen(500, 360);
            const dispSZ  = Math.max(340, SZ * (_cachedScaleX || 0.35) * 1.7);

            const el = document.createElement('img');
            Object.assign(el.style, {
                position:      'fixed',
                left:          `${pos.x - dispSZ / 2}px`,
                top:           `${pos.y - dispSZ / 2}px`,
                width:         `${dispSZ}px`,
                height:        `${dispSZ}px`,
                borderRadius:  '50%',
                objectFit:     'cover',
                pointerEvents: 'none',
                zIndex:        '1',       // 頭像層：煙霧(3) > 螺旋(2) > 頭像(1) > 其它特效(auto)
                boxShadow:     '0 0 40px rgba(255,80,160,0.5)',
                opacity:       '0',
                transition:    'opacity 1.5s ease',
            });
            getOverlay().appendChild(el);  // 放 overlay
            _centerHeadEl = el;

            // 從玩家自己的角色 Canvas 裁臉（FCM 同款來源，不會截到別人）
            // 正方裁切並以臉部為中心；側臉 0.43h 含瀏海，避免人物偏低
            const capture = () => {
                const src = Player && Player.Canvas;
                if (!src || !src.width) return false;
                const side  = src.width * 0.42;             // 正方邊長（含頭髮）
                const cropX = src.width  * 0.50 - side / 2; // 水平置中於臉
                const cropY = src.height * 0.43 - side / 2; // 垂直置中於臉（略偏上含瀏海）
                ctx.clearRect(0, 0, SZ, SZ);
                ctx.drawImage(src, cropX, cropY, side, side, 0, 0, SZ, SZ);
                try { el.src = cv.toDataURL(); } catch (e) { return false; }
                return true;
            };
            capture();
            requestAnimationFrame(() => { el.style.opacity = '1'; });

            // 每幀重新擷取（前 ~0.6 秒）：表情替換 / Canvas 重建是非同步，
            //   逐幀更新讓正確的臉盡快出現，不會等待
            let frames = 0;
            const recap = () => {
                if (el !== _centerHeadEl) return;
                capture();
                if (++frames < 36) requestAnimationFrame(recap);
            };
            requestAnimationFrame(recap);

            // 淡入 1.5s / 淡出 1.5s；整體時間不變（消失仍提早約 1 秒）
            const dur = Math.max(3800, durationMs || 4000);
            setTimeout(() => { if (el) el.style.opacity = '0'; }, dur - 2300);
            setTimeout(() => {
                if (el === _centerHeadEl) _centerHeadEl = null;
                el.remove();
            }, dur - 800);
        } catch (e) { /* 跨域或無 Canvas 時靜默 */ }
    }

    // ════════════════════════════════════════
    //  主效果流程
    // ════════════════════════════════════════
    async function runEffect(voiceText, isTest = false) {
        if (!CONFIG.enabled) return;
        // 只在 ChatRoom 畫面內作用（避免在其他畫面觸發）
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'ChatRoom') {
            return;
        }
        refreshCanvasCache();

        // ① 先換表情（高潮時用 BC 自帶表情，跳過 IVH 替換）
        const orgasmStageNow = Player?.ArousalSettings?.OrgasmStage ?? 0;
        const willOrgasm = orgasmStageNow === 2;
        const doExpr = CONFIG.expression && !willOrgasm && EXPRESSION_SETS && EXPRESSION_SETS.length;
        if (doExpr) {
            pushExprEffect(EXPRESSION_SETS[Math.floor(Math.random() * EXPRESSION_SETS.length)]);
            // 等表情的 Canvas 重建好，再放其餘特效（截圖才有新表情）
            await wait(280);
        }

        const arousalAdd   = addArousal();
        const scale        = effectScale();
        const danmakuCount = Math.max(1, Math.round(arousalAdd * Math.min(scale, 1.5)));
        const totalDur     = BASE_EFFECT_DURATION * Math.min(scale, 1.4);
        const wordCount    = voiceText.trim().split(/\s+/).length;

        // ② 狀態 emote（僅真實觸發，避免測試時洗版）
        if (!isTest) sendStatusEmote();

        // ③ 視覺效果同時觸發
        if (CONFIG.centerHeadshot) showCenterHeadshot(totalDur + 1500);
        triggerVignette();
        triggerScreenDistort();
        triggerPinkFlash();
        triggerHypnoSpiral();
        triggerHypnoWaves(wordCount);
        triggerDanmakuMulti(voiceText, danmakuCount);
        triggerSteamParticles();
        if (CONFIG.sound) {
            triggerBreathSound(scale);                                   // 催眠喘息聲（催眠分類）
            // 雙重音效：同時再播一個觸發音（催眠2 分類，預設心跳）
            if (CONFIG.dualSound) playSoundCategory('voice', Math.min(0.5 + scale * 0.15, 0.9));
        }

        // ④ 高潮特效
        //   climaxMode='orgasm' → BC OrgasmStage=2（真正高潮）時觸發
        //   climaxMode='always' → 每次催眠都觸發
        //   OrgasmStage=0: 正常, =1: 抵抗中, =2: 真正高潮（不抵抗或抵抗失敗）
        const arousalNow   = getArousalLevel();
        const orgasmStage  = Player?.ArousalSettings?.OrgasmStage ?? 0;
        const bcOrgasming  = orgasmStage === 2;
        const doClimax     = CONFIG.climax && (
            CONFIG.climaxMode === 'always' ||
            bcOrgasming ||
            (isTest && arousalNow >= 95)
        );
        if (doClimax) {
            await wait(600);
            triggerClimaxEffect(scale);
        }

        // ⑤ 等效果播完
        await wait(totalDur);

        // ⑥ 恢復表情（特效結束後 1~2 秒）
        if (doExpr) {
            await wait(1200 + Math.random() * 800);
            popExprEffect();
        }
    }

    // ════════════════════════════════════════
    //  解析聊天文字
    // ════════════════════════════════════════
    function parseVoiceText(rawText) {
        const brackets = rawText.match(/【([^】]+)】/g);
        if (brackets && brackets.length > 0) {
            const last     = brackets[brackets.length - 1].replace(/【|】/g, '');
            const colonIdx = last.indexOf(':');
            if (colonIdx !== -1) return last.slice(colonIdx + 1).trim();
            return last.trim();
        }
        return rawText.trim();
    }

    // ════════════════════════════════════════
    //  /ivh 指令系統
    // ════════════════════════════════════════
    // timeoutMs: 若 > 0，訊息在 N 毫秒後自動淡出移除
    function printChat(text, timeoutMs = 0) {
        try {
            const log = document.getElementById('TextAreaChatLog');
            if (!log) throw new Error('no log');
            const el = document.createElement('div');
            el.className = 'ChatMessage ChatMessageLocalMessage';
            Object.assign(el.style, {
                background:   'rgba(53,0,155,0.18)',
                borderLeft:   '3px solid rgb(162,71,255)',
                padding:      '4px 8px',
                margin:       '2px 0',
                color:        'rgb(162,71,255)',
                fontSize:     '0.92em',
                fontFamily:   'inherit',
                whiteSpace:   'pre-wrap',
                transition:   'opacity 0.5s ease',
            });
            el.innerHTML = '<span style="opacity:0.6;font-size:0.85em">🌀 IVH</span>　' + text.split('\n').join('<br>');
            log.appendChild(el);
            log.scrollTop = log.scrollHeight;
            if (timeoutMs > 0) {
                setTimeout(() => {
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 500);
                }, timeoutMs);
            }
            return;
        } catch(e) {}
        try {
            if (typeof ChatRoomMessage === 'function') {
                ChatRoomMessage({
                    Type:    'LocalMessage',
                    Sender:  Player.MemberNumber,
                    Content: `<font color="#ffb3d9">🌀 [IVH] ${text}</font>`,
                });
                return;
            }
        } catch(e2) {}
    }

    function handleIVHCommand(input) {
        const parts = input.trim().split(/\s+/);
        if (parts[0].toLowerCase() !== '/ivh') return false;

        const sub = (parts[1] ?? '').toLowerCase();

        if (!sub || sub === 'help') {
            printChat(ui('help', { v: MOD_VER }));
            return true;
        }

        if (sub === 'test') {
            const testText = parts.slice(2).join(' ') || '你的意識正在沉睡…放鬆，放鬆…';
            triggerVoiceEffect(testText, true);
            printChat(`🌀 [IVH] 觸發測試效果：「${testText}」`);
            return true;
        }

        if (sub === 'setting' || sub === 'settings') {
            try {
                if (typeof PreferenceSubscreenExtensionsOpen === 'function') {
                    PreferenceSubscreenExtensionsOpen(PREF_ID);
                } else {
                    printChat(ui('cantOpenSettings'));
                }
            } catch (e) {
                printChat('⚠️ ' + T('開啟設定頁失敗','Failed to open settings') + ': ' + e.message);
            }
            return true;
        }

        if (sub === 'climax') {
            triggerClimaxEffect(CONFIG.intensity);
            printChat('💥 [IVH] 高潮特效測試觸發');
            return true;
        }

        if (sub === 'depth') {
            const lv = Math.max(1, Math.min(3, parseInt(parts[2], 10) || currentDepthLevel() || 1));
            refreshCanvasCache();
            runDepthEffect(lv);
            printChat(`🌀 [IVH] 深度效果測試（等級 ${lv}）— 目前為最小版，完整幽靈低語等效果尚未實作`);
            return true;
        }

        if (sub === 'calibrate') {
            openCalibratePanel();
            return true;
        }



        if (sub === 'show') {
            const chatContainer = document.getElementById('TextAreaChatLog') ||
                  document.querySelector('.ChatLog');
            if (!chatContainer) { printChat('⚠️ ' + T('找不到聊天框','Chat box not found')); return true; }
            // 已開啟則關閉並重建（避免殘留舊面板而無法操作）
            if (_panel) removePanel();
            buildPanel(chatContainer);
            return true;
        }



        printChat(ui('cmdUnknown', { sub }));
        return true;
    }

    // ════════════════════════════════════════
    //  Hook 聊天室輸入攔截
    //  策略1: CommandCombine（最佳，與其他插件共存）
    //  策略2: window.ChatRoomSendChat 覆寫（fallback）
    //  策略3: keydown Enter 攔截（最後手段）
    // ════════════════════════════════════════
    function tryRegisterCommand() {
        try {
            if (typeof CommandCombine === 'function') {
                CommandCombine([{
                    Tag: 'ivh',
                    Description: '[IVH] 沉浸式催眠效果指令（/ivh help 查看說明）',
                    Action: (text) => {
                        // CommandCombine 傳入的是去掉 /ivh 後的部分
                        handleIVHCommand('/ivh ' + (text ?? ''));
                    },
                }]);
                return true;
            }
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] CommandCombine 註冊失敗:', e.message);
        }
        return false;
    }

    const _origChatRoomSendChat = window.ChatRoomSendChat;
    function setupSendChatFallback() {
        if (typeof window.ChatRoomSendChat !== 'function') return;
        window.ChatRoomSendChat = function () {
            try {
                const val = ElementValue('InputChat');
                if (typeof val === 'string' && val.trim().startsWith('/ivh')) {
                    handleIVHCommand(val.trim());
                    ElementValue('InputChat', '');
                    return;
                }
            } catch (e) {}
            return _origChatRoomSendChat.apply(this, arguments);
        };
    }

    function setupKeydownFallback() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const input = document.getElementById('InputChat') || document.querySelector('textarea[id*="Chat"]');
            if (!input) return;
            const val = input.value.trim();
            if (!val.startsWith('/ivh')) return;
            handleIVHCommand(val);
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
        }, true);
    }

    // 指令只需要註冊一次
    let _cmdRegistered = false;

    function registerCommandOnce() {
        if (_cmdRegistered) return;
        _cmdRegistered = true;

        if (tryRegisterCommand()) return;

        if (typeof window.ChatRoomSendChat === 'function') {
            setupSendChatFallback();
            return;
        }

        setupKeydownFallback();
    }

    // hookChatInput 只負責掛 keydown 保底（不等 CommandCombine）
    // 真正的 CommandCombine 註冊在進房間後的 setupDOMObserver 一起做
    function hookChatInput() {
        setupKeydownFallback();
    }

    // ════════════════════════════════════════
    //  IVH 控制面板
    // ════════════════════════════════════════
    let _panel = null;

    // PANEL_TOGGLES 在 buildPanel 時動態產生，確保語言正確
    function getPanelToggles() {
        return Object.entries(TOGGLE_LABELS).map(([key, fn]) => {
            const [icon, label] = fn();
            return { key, icon, label };
        });
    }

    function buildPanel(chatContainer) {
        if (_panel) return; // 已存在

        _panel = document.createElement('div');
        _panel.id = 'ivh-panel';
        // 面板作為普通 DOM 節點塞進 TextAreaChatLog
        // 行為跟一般聊天訊息完全相同：
        // - 新訊息進來會往上推（正常）
        // - 往上捲看舊訊息時，面板也跟著捲走（不卡底部）
        Object.assign(_panel.style, {
            background: 'linear-gradient(135deg, rgba(30,10,40,0.97) 0%, rgba(50,15,60,0.97) 100%)',
            borderTop:  '1px solid rgba(255,120,200,0.35)',
            padding:    '8px 10px 6px',
            boxShadow:  '0 -4px 20px rgba(180,60,160,0.25)',
            fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
            fontSize:   '12px',
            userSelect: 'none',
            marginTop:  '4px',
            display:    'block',
        });

        // ── 標題列 ──
        const header = document.createElement('div');
        Object.assign(header.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   '6px',
        });

        const title = document.createElement('span');
        title.innerHTML = '🌀 <b style="color:#ff99dd">IVH</b> <span style="color:#cc88bb;font-size:10px">v' + MOD_VER + '</span>';
        title.style.color = '#ffddee';

        // ⚙ 齒輪 → 開啟偏好設定頁
        const gearBtn = _mkBtn('⚙', '#8E44A1', '#cbb3ff', () => {
            try {
                if (typeof PreferenceSubscreenExtensionsOpen === 'function')
                    PreferenceSubscreenExtensionsOpen(PREF_ID);
            } catch (e) {}
        });
        gearBtn.title = T('開啟設定頁','Open settings');

        // 全開/全關 + X 關閉按鈕
        const allOnBtn  = _mkBtn(T('全開','All On'),  '#872626', '#88ff88', () => {
            getPanelToggles().forEach(t => { CONFIG[t.key] = true; });
            _refreshToggles(); saveSettings();
        });
        const allOffBtn = _mkBtn(T('全關','All Off'), '#872626', '#ff9999', () => {
            getPanelToggles().forEach(t => { CONFIG[t.key] = false; });
            _refreshToggles(); saveSettings();
        });
        const closeXBtn = document.createElement('button');
        closeXBtn.textContent = '✕';
        Object.assign(closeXBtn.style, {
            background:   'rgba(100,20,40,0.8)',
            border:       '1px solid rgba(255,80,100,0.5)',
            borderRadius: '4px',
            color:        '#ff8899',
            cursor:       'pointer',
            fontSize:     '12px',
            padding:      '1px 6px',
            lineHeight:   '16px',
            fontWeight:   'bold',
        });
        closeXBtn.addEventListener('click', () => removePanel());

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;gap:4px;align-items:center';
        btnGroup.append(gearBtn, allOnBtn, allOffBtn, closeXBtn);
        header.append(title, btnGroup);

        // ── 強度控制列 ──
        const intensityRow = document.createElement('div');
        Object.assign(intensityRow.style, {
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            marginBottom: '6px',
        });
        const intensityLabel = document.createElement('span');
        intensityLabel.textContent = T('強度','Intensity');
        intensityLabel.style.cssText = 'color:#cc88bb;min-width:28px';

        const intensitySlider = document.createElement('input');
        intensitySlider.type  = 'range';
        intensitySlider.min   = '0.3';
        intensitySlider.max   = '3.0';
        intensitySlider.step  = '0.1';
        intensitySlider.value = String(CONFIG.intensity);
        Object.assign(intensitySlider.style, {
            flex:         '1',
            accentColor:  '#ff80cc',
            cursor:       'pointer',
            height:       '4px',
        });

        const intensityVal = document.createElement('span');
        intensityVal.textContent = CONFIG.intensity.toFixed(1);
        intensityVal.style.cssText = 'color:#ffccee;min-width:24px;text-align:right';

        intensitySlider.addEventListener('input', () => {
            CONFIG.intensity = parseFloat(intensitySlider.value);
            intensityVal.textContent = CONFIG.intensity.toFixed(1);
            saveSettings();
        });
        intensityRow.append(intensityLabel, intensitySlider, intensityVal);

        // ── 開關格子 ──
        const grid = document.createElement('div');
        grid.id = 'ivh-panel-grid';
        Object.assign(grid.style, {
            display:             'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap:                 '4px',
            marginBottom:        '6px',
        });

        getPanelToggles().forEach(({ key, label, icon }) => {
            const btn = document.createElement('button');
            btn.dataset.ivhKey = key;
            _styleToggleBtn(btn, key, icon, label);
            btn.addEventListener('click', () => {
                CONFIG[key] = !CONFIG[key];
                _styleToggleBtn(btn, key, icon, label);
                saveSettings();
            });
            grid.appendChild(btn);
        });

        // ── 底部操作列 ──
        const actionRow = document.createElement('div');
        Object.assign(actionRow.style, {
            display:    'flex',
            gap:        '5px',
            flexWrap:   'wrap',
            alignItems: 'center',
        });

        // 測試輸入框 + 按鈕
        const testInput = document.createElement('input');
        testInput.type        = 'text';
        testInput.placeholder = T('測試文字…','Test text…');
        Object.assign(testInput.style, {
            flex:        '1',
            minWidth:    '80px',
            background:  'rgba(255,255,255,0.07)',
            border:      '1px solid rgba(255,120,200,0.3)',
            borderRadius:'3px',
            color:       '#ffeeff',
            padding:     '3px 6px',
            fontSize:    '12px',
            outline:     'none',
        });
        // 阻止 Enter 送出聊天
        testInput.addEventListener('keydown', e => e.stopPropagation());

        const testBtn = _mkBtn(T('▶ 測試','▶ Test'), '#5a1f6e', '#ff99dd', () => {
            const txt = testInput.value.trim() || '你的意識正在沉睡…放鬆，放鬆…';
            triggerVoiceEffect(txt, true);
        });

        // 深度測試（依目前深度上限，至少 1 級）
        const depthBtn = _mkBtn(T('🌀 深度','🌀 Depth'), '#3a2a6e', '#bb99ff', () => {
            refreshCanvasCache();
            runDepthEffect(Math.max(1, CONFIG.depthMax || 1));
        });

        actionRow.append(testInput, testBtn, depthBtn);

        // ── 內容區 ──
        const collapsible = document.createElement('div');
        collapsible.append(intensityRow, grid, actionRow);
        _panel.append(header, collapsible);
        chatContainer.appendChild(_panel);
        // 捲到底部讓面板可見
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 重新刷新所有 toggle 按鈕外觀（/ivh on/off 後呼叫）
    function _refreshToggles() {
        if (!_panel) return;
        getPanelToggles().forEach(({ key, icon, label }) => {
            const btn = _panel.querySelector(`[data-ivh-key="${key}"]`);
            if (btn) _styleToggleBtn(btn, key, icon, label);
        });
    }

    function _styleToggleBtn(btn, key, icon, label) {
        const on = CONFIG[key];
        btn.textContent = `${icon} ${label}`;
        Object.assign(btn.style, {
            background:   on ? 'rgba(180,60,160,0.45)' : 'rgba(60,20,60,0.5)',
            border:       `1px solid ${on ? 'rgba(255,120,200,0.6)' : 'rgba(120,60,120,0.3)'}`,
            borderRadius: '4px',
            color:        on ? '#ffccee' : '#886688',
            cursor:       'pointer',
            fontSize:     '11px',
            padding:      '4px 2px',
            textAlign:    'center',
            transition:   'all 0.15s ease',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
        });
    }

    function _mkBtn(label, bgColor, textColor, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        Object.assign(btn.style, {
            background:   bgColor,
            border:       '1px solid rgba(255,255,255,0.15)',
            borderRadius: '3px',
            color:        textColor,
            cursor:       'pointer',
            fontSize:     '11px',
            padding:      '3px 7px',
            whiteSpace:   'nowrap',
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    function removePanel() {
        if (_panel) { _panel.remove(); _panel = null; }
    }
    let _domObserver = null;

    // 白名單判斷：any 模式永遠通過；whitelist 模式需 sender 在名單內
    function isTriggerAllowed(senderNum) {
        if (CONFIG.whitelistMode !== 'whitelist') return true;
        if (senderNum == null) return false; // 無法辨識來源 → 白名單模式下不觸發
        return (CONFIG.whitelist || []).includes(Number(senderNum));
    }

    // 取訊息節點的發送者 MemberNumber
    function getNodeSender(node) {
        try {
            const el = node.matches?.('.ChatMessage') ? node : node.querySelector?.('.ChatMessage');
            const s  = el?.getAttribute('data-sender');
            return s != null ? Number(s) : null;
        } catch { return null; }
    }

    // 處理新進聊天節點：① [Voice] 本地催眠訊息 ② 白名單成員說出觸發詞
    function handleChatNode(node) {
        // 解析出真正的訊息元素（subtree 觀察會同時回報容器與內層 → 去重）
        const msgEl = node.classList?.contains('ChatMessage')
                      ? node
                      : node.querySelector?.('.ChatMessage') || node;
        if (msgEl._ivhHandled) return;        // 同一訊息只處理一次
        msgEl._ivhHandled = true;

        const text = msgEl.textContent || '';

        // ① [Voice] 本地訊息（既有催眠系統整合，無發送者，視為自身效果）
        if (msgEl.classList?.contains('ChatMessageLocalMessage') ||
            msgEl.querySelector?.('.ChatMessageLocalMessage')) {
            const m = text.match(/\[Voice\]\s*(.*)/s);
            if (m) { triggerVoiceEffect(parseVoiceText(m[1])); return; }
        }

        // ② 自訂觸發詞：一般聊天訊息含觸發詞，且發送者通過白名單
        const words = (CONFIG.triggerWords || []).filter(w => w && w.trim());
        if (words.length === 0) return;
        if (!msgEl.classList?.contains('ChatMessageChat')) return;  // 只認一般聊天
        if (!words.some(w => text.includes(w))) return;
        if (!isTriggerAllowed(getNodeSender(msgEl))) return;

        const spoken = extractChatText(msgEl);
        triggerVoiceEffect(spoken || words[0]);
    }

    function setupDOMObserver() {
        const chatContainer =
              document.getElementById('TextAreaChatLog') ||
              document.querySelector('.ChatLog')         ||
              document.querySelector('[id*="ChatLog"]')  ||
              document.querySelector('[class*="ChatLog"]');

        if (!chatContainer) {
            setTimeout(setupDOMObserver, 2000);
            return;
        }

        if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }

        _domObserver = new MutationObserver((mutations) => {
            if (!CONFIG.enabled) return;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    handleChatNode(node);
                }
            }
        });

        _domObserver.observe(chatContainer, { childList: true, subtree: true });

        // 預載音源
        preloadSounds();

        // 進房間後才註冊指令，確保 CommandCombine 已就緒
        registerCommandOnce();
    }

    // ════════════════════════════════════════
    //  Hook ChatRoomCharacterViewDrawOverlay
    //  參考 LT 的 rpIcon 邏輯：
    //  CharX/CharY/Zoom 已是 BC 計算好的最終座標
    //  包含 HeightRatio/XOffset/YOffset/翻頁偏移，完全正確
    // ════════════════════════════════════════
    function hookDrawCharacter() {
        if (!modApi) return;
        try {
            modApi.hookFunction('ChatRoomCharacterViewDrawOverlay', 1, (args, next) => {
                const result = next(args);
                const [character, charX, charY, zoom] = args;
                // 用 MemberNumber 比對，比 IsPlayer() 更可靠
                const isMe = character?.MemberNumber != null &&
                      Player?.MemberNumber != null &&
                      character.MemberNumber === Player.MemberNumber;
                if (isMe) {
                    // 座標每幀更新
                    playerDrawPos.x     = charX;
                    playerDrawPos.y     = charY;
                    playerDrawPos.zoom  = zoom;
                    playerDrawPos.valid = true;
                    // 姿勢也每幀更新（不放在座標變化判斷內，避免姿勢變化被漏掉）
                    playerDrawPos.isKneeling = typeof character.IsKneeling === 'function' && character.IsKneeling();
                    playerDrawPos.isProne    = !!(
                        character.ActivePose?.some(p =>
                                                   ['Hogtied','AllFours','Suspension','SuspensionHogtied'].includes(p)
                                                  ) ||
                        Object.values(character.DrawPoseMapping || character.PoseMapping || {}).some(p =>
                                                                                                     ['Hogtied','AllFours','Suspension','SuspensionHogtied'].includes(p)
                                                                                                    )
                    );
                }
                return result;
            });
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] ⚠️ ChatRoomCharacterViewDrawOverlay hook 失敗:', e.message);
        }
    }

    // ════════════════════════════════════════
    //  Hook OrgasmStage：偵測玩家進入 Stage 2（真正高潮）
    //  不依賴 [Voice] 觸發，任何高潮都可以觸發破片特效
    // ════════════════════════════════════════
    let _lastOrgasmStage = 0;
    let _climaxCooldown  = false;  // 防止同一次高潮重複觸發

    function hookOrgasmStage() {
        if (!modApi) return;

        const orgasmHandler = (args, next) => {
            const result = next(args);
            const [C] = args;
            if (C && typeof C.IsPlayer === 'function' && C.IsPlayer()
                && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                if (CONFIG.climax && !_climaxCooldown) {
                    _climaxCooldown = true;
                    const scale = effectScale();
                    setTimeout(() => {
                        triggerClimaxEffect(scale);
                        triggerPinkFlash();
                    }, 400);
                    setTimeout(() => { _climaxCooldown = false; }, 8000);
                }
            }
            return result;
        };

        // 嘗試多個 BC 版本中可能存在的高潮函數名，靜默嘗試，失敗就用輪詢
        const orgasmFnCandidates = [
            'ActivityOrgasm',
            'ActivityOrgasmStart',
            'ActivityOrgasmPrepare',
        ];
        let orgasmHooked = false;
        for (const fn of orgasmFnCandidates) {
            try {
                modApi.hookFunction(fn, 0, orgasmHandler);
                orgasmHooked = true;
                break;
            } catch { /* 函數不存在，試下一個 */ }
        }
        if (!orgasmHooked) {
            _hookOrgasmPoll();
        }
    }

    // fallback：每 500ms 輪詢 OrgasmStage
    function _hookOrgasmPoll() {
        setInterval(() => {
            if (!CONFIG.climax || _climaxCooldown) return;
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') {
                _lastOrgasmStage = Player?.ArousalSettings?.OrgasmStage ?? 0;
                return;
            }
            const stage = Player?.ArousalSettings?.OrgasmStage ?? 0;
            if (stage >= 2 && _lastOrgasmStage < 2) {
                _climaxCooldown = true;
                const scale = effectScale();
                setTimeout(() => {
                    triggerClimaxEffect(scale);
                    triggerPinkFlash();
                }, 400);
                setTimeout(() => { _climaxCooldown = false; }, 8000);
            }
            _lastOrgasmStage = stage;
        }, 500);
    }

    // ════════════════════════════════════════
    //  設定頁（PreferenceRegisterExtensionSetting）
    //  佈局：左側分頁鈕 / 中間內容區 / 右側 1350 說明框
    // ════════════════════════════════════════
    function waitForPreference() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof PreferenceRegisterExtensionSetting === 'function' &&
                    typeof TranslationLanguage !== 'undefined') resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    // 分頁定義（key 對應繪製函式）
    const IVH_TABS = [
        { key: 'basic',   label: () => ui('tab_basic')   },
        { key: 'effects', label: () => ui('tab_effects') },
        { key: 'texts',   label: () => ui('tab_texts')   },
        { key: 'expr',    label: () => ui('tab_expr')    },
        { key: 'sounds',  label: () => ui('tab_sounds')  },
        { key: 'about',   label: () => ui('tab_about')   },
    ];

    // 內容框（中間區）與卷軸視窗
    const FRAME_X = 475, FRAME_Y = 178, FRAME_W = 850, FRAME_H = 732;
    const CONTENT_X = 500;                 // 內容左緣
    const CONTENT_TOP = 200;               // 內容第一列基準 y
    const FRAME_BOT = FRAME_Y + FRAME_H;   // 視窗底

    const EXT = {
        activeTab: 'basic',
        hoverDesc: '',
        scroll: 0,
        _maxScroll: 0,
        _contentBottom: 0,
        _mid: [],          // 中間區互動控制 [{x,y,w,h,onClick}]
        _drag: null,       // 滑桿拖曳中 {x,w,min,max,step,key,save}
        _inputs: {},       // DOM 輸入框 id -> element
        _inputsUsed: null, // 本幀用到的 input id

        // ── 生命週期 ──
        load() {
            this.scroll = 0;
            this._bindCanvasEvents();
        },
        unload() { this._cleanup(); },
        exit() { this.hoverDesc = ''; this._cleanup(); },
        _cleanup() {
            this._restoreExpr();
            this._unbindCanvasEvents();
            for (const id in this._inputs) { try { this._inputs[id].remove(); } catch {} }
            this._inputs = {};
            this._drag = null;
            if (this._demoEl) { try { this._demoEl.remove(); } catch {} this._demoEl = null; this._demoCur = ''; }
        },

        // ── canvas 事件（拖曳滑桿 / 滾輪卷軸）──
        _bindCanvasEvents() {
            if (this._bound) return;
            const cv = document.getElementById('MainCanvas') || document.querySelector('canvas');
            if (!cv) return;
            this._cv = cv;
            this._onDown  = e => this._handleDown(e);
            this._onMove  = e => this._handleMove(e);
            this._onUp    = e => this._handleUp(e);
            this._onWheel = e => this._handleWheel(e);
            cv.addEventListener('mousedown', this._onDown);
            window.addEventListener('mousemove', this._onMove);
            window.addEventListener('mouseup', this._onUp);
            cv.addEventListener('wheel', this._onWheel, { passive: false });
            this._bound = true;
        },
        _unbindCanvasEvents() {
            if (!this._bound || !this._cv) return;
            this._cv.removeEventListener('mousedown', this._onDown);
            window.removeEventListener('mousemove', this._onMove);
            window.removeEventListener('mouseup', this._onUp);
            this._cv.removeEventListener('wheel', this._onWheel);
            this._bound = false;
        },
        _evCoords(e) {
            const r = this._cv.getBoundingClientRect();
            return {
                x: (e.clientX - r.left) / r.width  * 2000,
                y: (e.clientY - r.top)  / r.height * 1000,
            };
        },
        _handleDown(e) {
            const p = this._evCoords(e);
            // 命中卷軸 → 開始拖曳卷軸
            const sb = this._sb;
            if (sb && p.x >= sb.x - 6 && p.x <= sb.x + sb.w + 6 && p.y >= sb.trackTop && p.y <= sb.trackTop + sb.trackH) {
                const onThumb = p.y >= sb.thumbY && p.y <= sb.thumbY + sb.thumbH;
                this._sbDrag = { grab: onThumb ? (p.y - sb.thumbY) : sb.thumbH / 2 };
                this._applyScrollDrag(p.y);
                return;
            }
            // 命中滑桿 → 開始拖曳並立即跳到該位置
            for (const c of this._mid) {
                if (c.slider && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) {
                    this._drag = c.slider;
                    this._applyDrag(p.x);
                    return;
                }
            }
        },
        _handleMove(e) {
            if (this._sbDrag) { this._applyScrollDrag(this._evCoords(e).y); return; }
            if (!this._drag) return;
            this._applyDrag(this._evCoords(e).x);
        },
        _handleUp() {
            if (this._sbDrag) { this._sbDrag = null; return; }
            if (!this._drag) return;
            const s = this._drag; this._drag = null;
            if (s.save) s.save();
        },
        _applyScrollDrag(py) {
            const sb = this._sb; if (!sb || this._maxScroll <= 0) return;
            const thumbY = py - this._sbDrag.grab;
            const denom = sb.trackH - sb.thumbH;
            const ratio = denom > 0 ? (thumbY - sb.trackTop) / denom : 0;
            this.scroll = Math.max(0, Math.min(this._maxScroll, ratio * this._maxScroll));
        },
        _applyDrag(px) {
            const s = this._drag; if (!s) return;
            let t = (px - s.x) / s.w; t = Math.max(0, Math.min(1, t));
            let v = s.min + t * (s.max - s.min);
            v = Math.round(v / s.step) * s.step;
            v = Math.max(s.min, Math.min(s.max, parseFloat(v.toFixed(2))));
            s.set(v);
        },
        _handleWheel(e) {
            const p = this._evCoords(e);
            // 右側面板卷動（如音效庫）
            if (p.x >= 1350 && p.x <= 1900 && p.y >= 200 && p.y <= 900 && this._rmaxScroll > 0) {
                e.preventDefault();
                this._rscroll = Math.max(0, Math.min(this._rmaxScroll, (this._rscroll || 0) + (e.deltaY > 0 ? 50 : -50)));
                return;
            }
            if (p.x < FRAME_X || p.x > FRAME_X + FRAME_W || p.y < FRAME_Y || p.y > FRAME_BOT) return;
            if (this._maxScroll <= 0) return;
            e.preventDefault();
            this.scroll = Math.max(0, Math.min(this._maxScroll, this.scroll + (e.deltaY > 0 ? 60 : -60)));
        },

        // ── 主繪製 ──
        run() {
            this.hoverDesc = '';
            this._demoKind = '';
            this._rmaxScroll = 0;
            this._mid = [];
            this._inputsUsed = new Set();

            // 標題 + 離開鈕
            DrawText('Immersive Voice Hypnosis  v' + MOD_VER, 950, 110, 'Black', '');
            DrawButton(1815, 75, 90, 90, '', 'White', 'Icons/Exit.png', ui('exit'));

            // 左上「IVH 啟用」主開關
            DrawButton(150, 230, 300, 50,
                       CONFIG.enabled ? ui('enabledOn') : ui('enabledOff'),
                       CONFIG.enabled ? '#8E44A1' : 'White', '', '', false);
            if (MouseIn(150, 230, 300, 50)) this.hoverDesc = ui('enabledDesc');

            // 左側分頁鈕
            IVH_TABS.forEach((tab, i) => {
                const y = 330 + i * 95;
                DrawButton(150, y, 300, 50, tab.label(),
                           this.activeTab === tab.key ? '#8E44A1' : 'White', '', '', false);
            });

            // 右側區（說明框；某些分頁改用它放編輯面板）
            DrawEmptyRect(1350, 200, 550, 700, 'White');
            const rightPanel = this['_right_' + this.activeTab];
            const hasRight = typeof rightPanel === 'function';
            if (!hasRight) DrawText(ui('info'), 1625, 235, 'Black', '');

            // 中間內容框 + 卷軸裁切
            DrawEmptyRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H, '#888');
            MainCanvas.save();
            MainCanvas.beginPath();
            MainCanvas.rect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
            MainCanvas.clip();
            this._contentBottom = CONTENT_TOP;
            const drawer = this['_run_' + this.activeTab];
            if (typeof drawer === 'function') drawer.call(this);
            MainCanvas.restore();

            // 卷軸計算 + 軌道（可拖曳）
            this._maxScroll = Math.max(0, this._contentBottom - FRAME_BOT + 20);
            if (this._maxScroll > 0) {
                const trackTop = FRAME_Y + 4;
                const trackH = FRAME_H - 8;
                const thumbH = Math.max(40, trackH * (FRAME_H / (this._contentBottom - CONTENT_TOP + 40)));
                const thumbY = trackTop + (trackH - thumbH) * (this.scroll / this._maxScroll);
                const sbX = FRAME_X + FRAME_W - 17;
                DrawRect(sbX, trackTop, 14, trackH, '#333');
                DrawRect(sbX, thumbY, 14, thumbH, this._sbDrag ? '#ff80cc' : '#c060c0');
                this._sb = { x: sbX, w: 14, trackTop, trackH, thumbY, thumbH };
            } else { this._sb = null; if (this.scroll !== 0) this.scroll = 0; }

            // 右側：分頁編輯面板 或 說明文字＋動畫
            if (hasRight) {
                rightPanel.call(this);
                this._renderDemo('');   // 隱藏動畫
            } else {
                if (this.hoverDesc)
                    DrawTextWrap(this.hoverDesc, 1370, 260, 510, 260, 'Black', undefined, 6);
                this._renderDemo(this._demoKind);
            }

            // 隱藏本幀未使用 / 卷出視窗的 DOM 輸入框
            for (const id in this._inputs) {
                if (!this._inputsUsed.has(id)) this._inputs[id].style.display = 'none';
            }
        },

        // ── 說明區動畫示範 ──
        _ensureDemoEl() {
            if (!this._demoEl) {
                const el = document.createElement('div');
                Object.assign(el.style, {
                    position: 'fixed', zIndex: '9999', pointerEvents: 'none',
                    overflow: 'hidden', borderRadius: '8px',
                    background: 'rgba(10,0,18,0.6)',
                    display: 'none',
                });
                document.body.appendChild(el);
                this._demoEl = el;
                this._demoCur = '';
            }
            return this._demoEl;
        },
        _renderDemo(kind) {
            const el = this._ensureDemoEl();
            if (!kind) { el.style.display = 'none'; this._demoCur = ''; return; }
            // 定位於說明框下半部（canvas 座標 1370,560 510×320）
            const cv = this._cv || document.getElementById('MainCanvas') || document.querySelector('canvas');
            if (!cv) { el.style.display = 'none'; return; }
            const r = cv.getBoundingClientRect();
            const sx = r.width / 2000, sy = r.height / 1000;
            el.style.display = '';
            el.style.left   = (r.left + 1370 * sx) + 'px';
            el.style.top    = (r.top  + 560  * sy) + 'px';
            el.style.width  = (510 * sx) + 'px';
            el.style.height = (320 * sy) + 'px';
            if (this._demoCur !== kind) { this._demoCur = kind; el.innerHTML = this._demoHTML(kind); }
        },
        _demoHTML(kind) {
            const W = (inner) => `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative">${inner}</div>`;
            switch (kind) {
                case 'hypnoSpiral': {
                    // 真正的阿基米德螺旋線（與實際效果一致）
                    const turns = 3, pts = 120; let d = '';
                    for (let i = 0; i <= turns * pts; i++) {
                        const a = (i / pts) * Math.PI * 2;
                        const r = (i / (turns * pts)) * 88;
                        const x = (r * Math.cos(a)).toFixed(1);
                        const y = (r * Math.sin(a)).toFixed(1);
                        d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
                    }
                    return W(`<svg viewBox="-100 -100 200 200" width="150" height="150" style="animation:ivhSpiralSpin 2.6s linear infinite;filter:drop-shadow(0 0 6px #ff66bb)">
                        <path d="${d}" fill="none" stroke="#ff88cc" stroke-width="3.5" stroke-linecap="round"/>
                        <circle cx="0" cy="0" r="5" fill="#ffe6f5"/>
                    </svg>`);
                }
                case 'hypnoWaves':
                    return W(['0s','0.6s','1.2s'].map(d=>`<div style="position:absolute;width:24px;height:24px;border:3px solid #ff88cc;border-radius:50%;animation:ivhDemoRing 1.8s ease-out ${d} infinite"></div>`).join(''));
                case 'pinkFlash':
                    return W(`<div style="width:200px;height:130px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(255,105,180,0.55) 30%,rgba(255,60,150,0.1) 100%);animation:ivhPinkPulse 2s ease-in-out infinite"></div>`);
                case 'vignette':
                    return W(`<div style="width:230px;height:150px;background:radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,0.85) 100%);animation:ivhVignette 2.6s ease-in-out infinite"></div>`);
                case 'screenDistort':
                    return W(`<div style="font-size:54px;animation:ivhDemoDistort 1.8s ease-in-out infinite">🔮</div>`);
                case 'danmaku':
                    return W('催眠中…'.split('').map((c,i)=>`<span style="display:inline-block;font-size:30px;color:#ffd6eb;text-shadow:0 0 10px #ff50a0;animation:ivhWaveChar 1.6s ease-in-out ${i*90}ms infinite">${c}</span>`).join(''));
                case 'steamParticles':
                    return W(['0s','0.4s','0.8s','0.6s'].map((d,i)=>`<div style="position:absolute;left:50%;top:58%;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,0.55),transparent 70%);filter:blur(4px);animation:ivhBreath${i%3} 1.9s ease-out ${d} infinite"></div>`).join(''));
                case 'climax':
                    return W(`<div style="width:210px;height:140px;border-radius:8px;background:white;animation:ivhClimaxFlash 1.3s ease-out infinite"></div>`);
                case 'centerHeadshot':
                    return W(`<div style="width:120px;height:120px;border-radius:50%;border:3px solid #ff80cc;background:radial-gradient(circle,#3a1040,#1a0028);box-shadow:0 0 30px #ff66bb88;display:flex;align-items:center;justify-content:center;font-size:48px">🙂</div>`);
                case 'ghost':
                    return W(`<div style="position:relative;width:180px;height:180px">
                        <div style="position:absolute;left:18px;top:30px;width:90px;height:140px;border-radius:40px 40px 0 0;background:rgba(8,2,14,0.85);animation:ivhPinkPulse 2.4s ease-in-out infinite"></div>
                        <div style="position:absolute;left:70px;top:0;font-size:16px;color:#ffd6eb;text-shadow:0 0 8px #b050c8;animation:ivhWaveChar 1.8s ease-in-out infinite">好乖…</div>
                    </div>`);
                case 'figureBlur':
                    return W(`<div style="position:relative;width:200px;height:150px;border-radius:8px;background:repeating-linear-gradient(45deg,#5a3a6a,#5a3a6a 10px,#42284f 10px,#42284f 20px);filter:blur(5px);animation:ivhPinkPulse 2.4s ease-in-out infinite"></div>
                        <div style="position:absolute;width:70px;height:110px;border-radius:30px 30px 0 0;background:#caa6e6"></div>`);
                case 'chatlogBlur':
                    return W(`<div style="width:200px;animation:ivhPinkPulse 2.4s ease-in-out infinite">
                        ${[0,1,2,3].map(()=>`<div style="height:12px;margin:8px 0;border-radius:6px;background:#caa6e6;filter:blur(2.5px)"></div>`).join('')}
                    </div>`);
                default: {
                    const map = { expression:'😳', arousal:'💗', sound:'🔊', dualSound:'🔊', emoteEnabled:'📢' };
                    return W(`<div style="font-size:74px;opacity:0.9;animation:ivhPinkPulse 2.2s ease-in-out infinite">${map[kind]||'✨'}</div>`);
                }
            }
        },

        click() {
            if (MouseIn(1815, 75, 90, 90)) { if (typeof PreferenceExit === 'function') PreferenceExit(); return; }
            if (MouseIn(150, 230, 300, 50)) { CONFIG.enabled = !CONFIG.enabled; saveSettings(); return; }
            for (let i = 0; i < IVH_TABS.length; i++) {
                if (MouseIn(150, 330 + i * 95, 300, 50)) {
                    if (this.activeTab !== IVH_TABS[i].key) {
                        if (this.activeTab === 'expr') this._restoreExpr();  // 離開表情分頁還原
                        this.activeTab = IVH_TABS[i].key; this.scroll = 0; this._rscroll = 0;
                    }
                    return;
                }
            }
            // 右側面板控制（不受內容框限制）
            for (const c of this._mid) {
                if (c.right && c.onClick && MouseIn(c.x, c.y, c.w, c.h)) { c.onClick(); return; }
            }
            // 中間區控制（須在內容框內，且非拖曳）
            if (MouseY < FRAME_Y || MouseY > FRAME_BOT) return;
            for (const c of this._mid) {
                if (!c.right && c.onClick && MouseIn(c.x, c.y, c.w, c.h)) { c.onClick(); return; }
            }
        },

        // 右側面板按鈕（絕對座標，不卷動）
        rbtn(x, y, w, h, label, color, desc, onClick) {
            DrawButton(x, y, w, h, label, color || 'White', '', '', false);
            if (desc && MouseIn(x, y, w, h)) this._rdesc = desc;
            this._mid.push({ x, y, w, h, onClick, right: true });
        },

        // 表情編輯預覽：在「克隆角色」上套表情並截臉
        //  → 完全不碰真實 Player，不會觸發 WCE 重新同步（避免連線速率問題）
        //  只在表情改變時重建（非每幀），CharacterLoadCanvas 非同步 → 多截幾次
        _ensureExprPreview(work) {
            if (!work) return;
            const key = JSON.stringify(work);
            if (key === this._exprPrevKey) return;
            this._exprPrevKey = key;
            try {
                const map = _expandExpr(work);
                const clone = Object.assign(Object.create(Object.getPrototypeOf(Player)), Player);
                clone.MemberNumber = -77777;
                clone.Appearance = Player.Appearance.map(a => {
                    const gn = a.Asset.Group.Name;
                    if (map[gn] === undefined) return a;
                    const na = Object.assign({}, a);
                    na.Property = Object.assign({}, a.Property);
                    na.Property.Expression = map[gn];
                    return na;
                });
                clone.Canvas = null; clone.CanvasBlink = null; clone.MustDraw = true;
                CharacterLoadCanvas(clone);
                const cap = () => captureFaceImage(img => { this._exprFaceImg = img; }, clone.Canvas);
                cap(); setTimeout(cap, 160); setTimeout(cap, 420);
            } catch (e) {}
        },
        // 不再改動真實 Player → 無需還原（保留空殼相容舊呼叫）
        _restoreExpr() { this._exprPrevKey = ''; this._exprFaceImg = null; },

        // ── 中間區繪製工具（cy 為內容座標，繪製時自動扣卷軸）──
        _y(cy) { return cy - this.scroll; },
        _track(cyBottom) { if (cyBottom > this._contentBottom) this._contentBottom = cyBottom; },

        // 純標題（不可按，hover 顯示說明）
        title(cy, text, desc) {
            const y = this._y(cy);
            const prev = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
            DrawTextFit(text, CONTENT_X, y, 260, 'Black', '');
            MainCanvas.textAlign = prev;
            this._track(cy + 20);
            if (desc && MouseIn(CONTENT_X, y - 20, 260, 40) && MouseY >= FRAME_Y && MouseY <= FRAME_BOT)
                this.hoverDesc = desc;
        },
        // 分隔標題（置中）
        sep(cy, text) {
            DrawText(text, 900, this._y(cy), 'Black', '');
            this._track(cy + 15);
        },
        // 一般按鈕（demoKind：hover 時在說明區下方顯示對應動畫）
        btn(cx, cy, w, h, label, color, desc, onClick, demoKind) {
            const y = this._y(cy);
            DrawButton(cx, y, w, h, label, color || 'White', '', '', false);
            this._track(cy + h);
            if (MouseIn(cx, y, w, h) && MouseY >= FRAME_Y && MouseY <= FRAME_BOT) {
                if (desc) this.hoverDesc = desc;
                if (demoKind) this._demoKind = demoKind;
            }
            this._mid.push({ x: cx, y, w, h, onClick });
        },
        // 開關按鈕（on=反紫）
        toggle(cx, cy, w, h, label, on, desc, onClick, demoKind) {
            this.btn(cx, cy, w, h, label, on ? '#8E44A1' : 'White', desc, onClick, demoKind);
        },
        // 滑桿（可拖曳；key 用於儲存）
        slider(cx, cy, w, val, min, max, step, desc, setFn, saveFn) {
            const y = this._y(cy);
            const t = (val - min) / (max - min);
            DrawRect(cx, y + 16, w, 6, '#666');
            DrawRect(cx, y + 16, Math.round(w * t), 6, '#c060c0');
            DrawRect(Math.round(cx + w * t) - 6, y + 6, 12, 26, 'White');
            this._track(cy + 40);
            if (desc && MouseIn(cx, y, w, 40) && MouseY >= FRAME_Y && MouseY <= FRAME_BOT) this.hoverDesc = desc;
            this._mid.push({ x: cx, y, w, h: 40,
                slider: { x: cx, w, min, max, step, set: setFn, save: saveFn } });
        },
        // DOM 輸入框（cy 內容座標；卷出視窗自動隱藏）
        input(id, cx, cy, w, h, value, opts) {
            opts = opts || {};
            this._inputsUsed.add(id);
            let el = this._inputs[id];
            if (!el) {
                el = document.createElement(opts.multiline ? 'textarea' : 'input');
                if (!opts.multiline) el.type = opts.type || 'text';
                Object.assign(el.style, {
                    position: 'fixed', zIndex: '10000', boxSizing: 'border-box',
                    background: '#301B3D', color: '#ffeeff',
                    border: '1px solid #b060c0', borderRadius: '4px',
                    padding: '2px 6px', fontFamily: 'monospace', outline: 'none',
                    resize: 'none',
                });
                if (opts.placeholder) el.placeholder = opts.placeholder;
                el.addEventListener('keydown', ev => ev.stopPropagation());
                el.addEventListener('input',  () => { if (opts.onChange) opts.onChange(el.value); });
                el.addEventListener('change', () => { if (opts.onChange) opts.onChange(el.value); });
                el.addEventListener('blur',   () => { if (opts.onChange) opts.onChange(el.value); });
                document.body.appendChild(el);
                this._inputs[id] = el;
            }
            if (document.activeElement !== el) el.value = value;
            const y = this._y(cy);
            this._track(cy + h);
            // 卷出視窗 → 隱藏
            if (y < FRAME_Y || y + h > FRAME_BOT) { el.style.display = 'none'; return; }
            const r = this._cv ? this._cv.getBoundingClientRect()
                               : (document.getElementById('MainCanvas') || document.querySelector('canvas')).getBoundingClientRect();
            const sx = r.width / 2000, sy = r.height / 1000;
            el.style.display = '';
            el.style.left   = (r.left + cx * sx) + 'px';
            el.style.top    = (r.top  + y  * sy) + 'px';
            el.style.width  = (w * sx) + 'px';
            el.style.height = (h * sy) + 'px';
            el.style.fontSize = Math.round(20 * sy) + 'px';
        },

        // 原生下拉選單（點開即有卷軸）；options = [[value,label],...]
        select(id, cx, cy, w, h, value, options, onChange) {
            this._inputsUsed.add(id);
            let el = this._inputs[id];
            if (!el) {
                el = document.createElement('select');
                Object.assign(el.style, {
                    position: 'fixed', zIndex: '10000', boxSizing: 'border-box',
                    background: '#8E44A1', color: '#ffffff',
                    border: '1px solid #b060c0', borderRadius: '4px',
                    padding: '2px 6px', fontFamily: 'sans-serif', outline: 'none', cursor: 'pointer',
                });
                el.addEventListener('keydown', ev => ev.stopPropagation());
                el.addEventListener('change', () => { if (onChange) onChange(el.value); });
                document.body.appendChild(el);
                this._inputs[id] = el;
            }
            const sig = options.map(o => o[0] + ':' + o[1]).join('|');
            if (el._sig !== sig) {
                el._sig = sig; el.innerHTML = '';
                for (const [val, label] of options) {
                    const o = document.createElement('option');
                    o.value = val; o.textContent = label;
                    o.style.background = '#301B3D'; o.style.color = '#ffffff';
                    el.appendChild(o);
                }
            }
            if (document.activeElement !== el) el.value = value;
            const y = this._y(cy);
            this._track(cy + h);
            if (y < FRAME_Y || y + h > FRAME_BOT) { el.style.display = 'none'; return; }
            const r = this._cv ? this._cv.getBoundingClientRect()
                               : (document.getElementById('MainCanvas') || document.querySelector('canvas')).getBoundingClientRect();
            const sx = r.width / 2000, sy = r.height / 1000;
            el.style.display = '';
            el.style.left   = (r.left + cx * sx) + 'px';
            el.style.top    = (r.top  + y  * sy) + 'px';
            el.style.width  = (w * sx) + 'px';
            el.style.height = (h * sy) + 'px';
            el.style.fontSize = Math.round(20 * sy) + 'px';
        },

        // 深度效果層定義
        _depthRows() {
            return [
                { tag: '輕', cfg: 'depthLight', items: [['smoke','煙霧'],['pant','喘氣'],['chatDanmaku','彈幕'],['ghost','人影']] },
                { tag: '中', cfg: 'depthMed',   items: [['figureBlur','人物模糊'],['pant','喘氣'],['sfx','音效']] },
                { tag: '重', cfg: 'depthHeavy', items: [['chatlogBlur','聊天模糊'],['pant','喘氣']] },
            ];
        },

        // ════════ 基本設定 ════════
        _run_basic() {
            const prev = MainCanvas.textAlign;

            // 催眠強度
            this.title(232, ui('intensity'), ui('intensityD'));
            this.slider(700, 215, 380, CONFIG.intensity, 0.1, 3.0, 0.1, ui('intensityD'),
                v => { CONFIG.intensity = v; }, () => saveSettings());
            DrawText(CONFIG.intensity.toFixed(1), 1130, this._y(232), 'Black', '');

            // 催眠深度（取代背景循環開關；無=關閉）
            this.title(312, ui('depthMax'), ui('depthMaxD'));
            [[0, ui('depthNone')], [1, ui('depthLight')], [2, ui('depthMed')], [3, ui('depthHeavy')]].forEach(([v, lb], i) => {
                this.toggle(700 + i * 95, 290, 90, 45, lb, CONFIG.depthMax === i, null,
                    () => { CONFIG.depthMax = i; saveSettings(); applyDepthLoop(); });
            });

            // 循環時間（直接輸入）
            this.title(382, ui('interval'), ui('intervalD'));
            this.input('ivh-interval', 700, 365, 110, 42, String(CONFIG.depthIntervalMin),
                { type: 'number', onChange: val => {
                    let n = parseInt(val, 10); if (isNaN(n)) n = CONFIG.depthIntervalMin;
                    CONFIG.depthIntervalMin = Math.max(1, Math.min(99, n));
                    saveSettings(); applyDepthLoop();
                }});
            {
                const _p = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
                DrawTextFit(ui('minutes'), 830, this._y(382), 150, 'Black', '');
                MainCanvas.textAlign = _p;
            }

            // 深度效果（無分隔線；標籤改 深度輕/中/重）
            const rowTags = ['depthRowLight', 'depthRowMed', 'depthRowHeavy'];
            const fxName = { smoke:'fx_smoke', pant:'fx_pant', chatDanmaku:'fx_danmaku', ghost:'fx_ghost',
                             figureBlur:'fx_figblur', sfx:'fx_sfx', chatlogBlur:'fx_chatblur' };
            const demoMap = { smoke:'pinkFlash', pant:'steamParticles', chatDanmaku:'danmaku',
                              ghost:'ghost', figureBlur:'figureBlur', chatlogBlur:'chatlogBlur', sfx:'sound' };
            this._depthRows().forEach((row, ri) => {
                const cy = 450 + ri * 52;
                const prev2 = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
                DrawTextFit(ui(rowTags[ri]), CONTENT_X, this._y(cy + 20), 100, 'Black', '');
                MainCanvas.textAlign = prev2;
                this._track(cy + 40);
                row.items.forEach(([k], ci) => {
                    this.toggle(615 + ci * 122, cy, 116, 40, ui(fxName[k]), !!CONFIG[row.cfg][k], ui(fxName[k] + 'D'),
                        () => { CONFIG[row.cfg][k] = !CONFIG[row.cfg][k]; saveSettings(); }, demoMap[k]);
                });
            });

            // 觸發對象（任何人對齊上方「喘氣」欄 X=737）
            this.title(627, ui('triggerTarget'), ui('triggerTargetD'));
            this.toggle(737, 607, 130, 44, ui('anyone'),        CONFIG.whitelistMode === 'any', null,
                () => { CONFIG.whitelistMode = 'any'; saveSettings(); });
            this.toggle(875, 607, 130, 44, ui('whitelistOnly'),  CONFIG.whitelistMode === 'whitelist', null,
                () => { CONFIG.whitelistMode = 'whitelist'; saveSettings(); });

            // 文本修改（誰可編輯我的文本；3 態，移到白名單上方，與觸發對象共用白名單）
            this.title(681, ui('allowEdit'), ui('allowEditD'));
            const em = CONFIG.allowEditMode || 'off';
            const setEdit = m => { CONFIG.allowEditMode = m; saveSettings(); publishSharedSettings(); };
            this.toggle(737, 661, 130, 44, ui('editOff'),       em === 'off',       null, () => setEdit('off'));
            this.toggle(875, 661, 130, 44, ui('editAny'),       em === 'any',       null, () => setEdit('any'));
            this.toggle(1013, 661, 150, 44, ui('editWhitelist'), em === 'whitelist', null, () => setEdit('whitelist'));

            // 白名單（觸發對象與編輯共用一份）
            this.title(735, ui('whitelist'), ui('whitelistD'));
            this.input('ivh-whitelist', 700, 721, 480, 42, (CONFIG.whitelist || []).join(', '),
                { placeholder: ui('whitelistPh'), onChange: val => {
                    CONFIG.whitelist = (val.match(/\d+/g) || []).map(Number);
                    saveSettings();
                }});

            // 語言（原生下拉，點開即有卷軸，避免循環點擊）
            this.title(789, ui('language'), ui('languageD'));
            this.select('ivh-lang', 700, 775, 200, 44, CONFIG.lang || 'auto',
                IVH_LANGS.map(l => [l, IVH_LANG_NAMES[l] || l]),
                v => { CONFIG.lang = v; saveSettings(); });

            // 匯出 / 匯入
            this.btn(500, 841, 230, 45, ui('export'), 'White', ui('exportD'), () => exportSettings());
            this.btn(750, 841, 230, 45, ui('import'), 'White', ui('importD'), () => importSettings());
            this._track(895);

            MainCanvas.textAlign = prev;
        },

        // ════════ 效果設定 ════════
        _effectToggles() {
            // [cfg key, emoji, 名稱 i18n key]
            return [
                ['pinkFlash',      '🌸', 'ev_pinkFlash'],
                ['hypnoSpiral',    '🌀', 'ev_hypnoSpiral'],
                ['hypnoWaves',     '〰️', 'ev_hypnoWaves'],
                ['screenDistort',  '🔮', 'ev_screenDistort'],
                ['vignette',       '🌑', 'ev_vignette'],
                ['danmaku',        '💬', 'ev_danmaku'],
                ['steamParticles', '💨', 'ev_steam'],
                ['expression',     '😳', 'ev_expression'],
                ['climax',         '💥', 'ev_climax'],
                ['sound',          '🔊', 'ev_sound'],
                ['centerHeadshot', '🖼', 'ev_headshot'],
                ['dualSound',      '🔊', 'ev_dualSound'],
                ['emoteEnabled',   '📢', 'ev_emote'],
            ];
        },
        _run_effects() {
            this.title(232, ui('tab_effects'), ui('effectsHint'));
            const list = this._effectToggles();
            list.forEach(([key, emoji, nameKey], i) => {
                const col = i % 2, row = (i - col) / 2;
                const cx  = 500 + col * 410;
                const cy  = 285 + row * 54;
                this.toggle(cx, cy, 390, 44, emoji + ' ' + ui(nameKey), !!CONFIG[key], ui(nameKey + 'D'),
                    () => { CONFIG[key] = !CONFIG[key]; saveSettings(); }, key);
            });
            // 高潮觸發模式（特殊：orgasm / always）
            const cyM = 285 + Math.ceil(list.length / 2) * 54 + 12;
            this.title(cyM + 22, ui('climaxMode'), ui('climaxModeD'));
            this.toggle(700, cyM, 200, 44,
                CONFIG.climaxMode === 'always' ? ui('climaxEvery') : ui('climaxOrgasm'),
                CONFIG.climaxMode === 'always', null,
                () => { CONFIG.climaxMode = CONFIG.climaxMode === 'always' ? 'orgasm' : 'always'; saveSettings(); });
        },

        // ════════ 文本設定 ════════
        _run_texts() {
            this.title(228, ui('tab_texts'), ui('textsHint'));

            this.title(286, ui('sec_hypnoText'), ui('hypnoTextD'));
            this.input('ivh-texts', 500, 314, 800, 150, (CONFIG.customTexts || []).join('\n'),
                { multiline: true, placeholder: ui('hypnoTextPh'), onChange: val => {
                    CONFIG.customTexts = val.split('\n').map(s => s.trim()).filter(Boolean);
                    saveSettings();
                }});

            this.title(496, ui('sec_statusMsg'), ui('statusMsgD'));
            this.input('ivh-emotes', 500, 524, 800, 120, (CONFIG.emoteList || []).join('\n'),
                { multiline: true, placeholder: ui('statusMsgPh'), onChange: val => {
                    CONFIG.emoteList = val.split('\n').map(s => s.trim()).filter(Boolean);
                    saveSettings();
                }});

            this.title(676, ui('sec_triggerWords'), ui('triggerWordsD'));
            this.input('ivh-triggers', 500, 704, 800, 110, (CONFIG.triggerWords || []).join('\n'),
                { multiline: true, placeholder: ui('triggerWordsPh'), onChange: val => {
                    CONFIG.triggerWords = val.split('\n').map(s => s.trim()).filter(Boolean);
                    saveSettings();
                }});
            this._track(825);
        },
        // ════════ 表情設定（最多 10 組）════════
        //  右側為一個「工作中表情」編輯區；點名稱→載入右側；點某列「保存」→把右側內容存到那一組
        _exprWorkFrom(s) {
            return s
                ? { Eyebrows: s.Eyebrows ?? null, Eyes: s.Eyes ?? null, Mouth: s.Mouth ?? null, Blush: s.Blush ?? null }
                : (() => { const c = saveExpression(); return { Eyebrows: c.Eyebrows, Eyes: c.Eyes, Mouth: c.Mouth, Blush: c.Blush }; })();
        },
        _run_expr() {
            const sets = CONFIG.expressionSets || [];
            if (!this._exprWork) this._exprWork = this._exprWorkFrom(sets[0]);

            this.title(228, ui('tab_expr'), '');

            sets.forEach((set, i) => {
                const cy = 300 + i * 52;
                const nm = ui('expr_item', { n: i + 1 });
                this.btn(CONTENT_X, cy, 340, 46, nm, 'White', null,
                    () => { this._exprWork = this._exprWorkFrom(set); this._exprPrevKey = ''; });
                this.btn(850, cy, 130, 46, ui('save'), '#21872F', null,
                    () => ivhConfirm(ui('confirmReplace', { name: nm }), () => {
                        const w = this._exprWork;
                        sets[i] = { Eyebrows: w.Eyebrows, Eyes: w.Eyes, Mouth: w.Mouth, Blush: w.Blush };
                        saveSettings(); EXPRESSION_SETS = CONFIG.expressionSets;
                    }));
                this.btn(988, cy, 130, 46, ui('delete'), '#872626', null,
                    () => ivhConfirm(ui('confirmDelete', { name: nm }), () => {
                        this._restoreExpr(); sets.splice(i, 1);
                        saveSettings(); EXPRESSION_SETS = CONFIG.expressionSets;
                    }));
            });

            const cyB = 300 + sets.length * 52 + 12;
            if (sets.length < 10) {
                this.btn(CONTENT_X, cyB, 300, 46, ui('expr_add'), '#8E44A1', null, () => {
                        const w = this._exprWork;
                        sets.push({ Eyebrows: w.Eyebrows, Eyes: w.Eyes, Mouth: w.Mouth, Blush: w.Blush });
                        saveSettings(); EXPRESSION_SETS = CONFIG.expressionSets;
                    });
            }
            this.btn(CONTENT_X + 320, cyB, 180, 46, ui('restoreDefault'), '#8C6046', null,
                () => ivhConfirm(ui('confirmReset'), () => {
                    CONFIG.expressionSets = DEFAULT_EXPRESSIONS.map(e => ({ ...e }));
                    EXPRESSION_SETS = CONFIG.expressionSets; saveSettings();
                }));
            // 說明文字（放最底；表情數 ≥8 時隱藏，避免太擠；過長自動換行）
            if (sets.length < 8) {
                DrawTextWrap(ui('expr_hint'), CONTENT_X, this._y(cyB + 60), 820, 60, 'Black', undefined, 4);
                this._track(cyB + 110);
            } else {
                this._track(cyB + 60);
            }
        },

        // 右側：工作中表情編輯（四部位 ◀值▶、即時臉部預覽）
        _right_expr() {
            const work = this._exprWork || (this._exprWork = this._exprWorkFrom(null));
            DrawText(ui('expr_edit'), 1625, 235, 'Black', '');

            // 四部位 ◀ 值 ▶
            const GROUPS = [['Eyebrows', ui('eyebrows')], ['Eyes', ui('eyes')], ['Mouth', ui('mouth')], ['Blush', ui('blush')]];
            GROUPS.forEach(([g, lb], i) => {
                const y = 290 + i * 62;
                const p2 = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
                DrawTextFit(lb, 1370, y + 28, 110, 'Black', '');
                MainCanvas.textAlign = p2;
                this.rbtn(1490, y, 52, 52, '◀', 'White', null, () => cycleExpression(work, g, -1));
                const v = work[g] == null ? ui('exprNone') : String(work[g]);
                DrawButton(1546, y, 244, 52, v, '#2a1030', '', '', true);
                this.rbtn(1794, y, 52, 52, '▶', 'White', null, () => cycleExpression(work, g, 1));
            });

            // 即時臉部預覽（本地套用後截 Player 臉）
            this._ensureExprPreview(work);
            const bx = 1450, by = 568, bs = 315;
            DrawRect(bx, by, bs, bs, 'rgba(20,5,30,0.6)');
            DrawEmptyRect(bx, by, bs, bs, '#8E44A1');
            if (this._exprFaceImg) {
                try { MainCanvas.drawImage(this._exprFaceImg, bx, by, bs, bs); } catch (e) {}
            } else {
                DrawText(ui('previewLoading'), bx + bs / 2, by + bs / 2, '#555', '');
            }
        },

        // 音效分類（順序：催眠 / 催眠2 / 高潮 / 深度）
        _soundCats() {
            // [cat, 標籤 i18n key, 最大數]
            return [['hypno', 'sndCat_hypno', 5], ['voice', 'sndCat_voice', 3], ['climax', 'sndCat_climax', 5], ['depth', 'sndCat_depth', 3]];
        },
        // ════════ 音效設定 ════════
        _run_sounds() {
            this.title(226, ui('tab_sounds'), ui('soundsHint'));
            const DEFAULTS = SOUND_DEFAULTS;   // 各分類預設音效
            const LX = 580;        // 欄位往右 20px
            let cy = 286;
            this._soundCats().forEach(([cat, lbKey, max], ci) => {
                const lb = ui(lbKey);
                if (ci > 0) cy += 10;   // 各大類標題上多 10px 間距
                this.sep(cy, `── ${ui('sndSlotHead', { name: lb, max })} ──`);
                cy += 26;
                if (!CONFIG.sounds[cat]) CONFIG.sounds[cat] = [];
                for (let i = 0; i < max; i++) {
                    const entry = CONFIG.sounds[cat][i] || '';
                    const def   = (DEFAULTS[cat] || [])[i] || '';
                    const isIdb = entry.startsWith('idb:');
                    const rowY  = cy;
                    const p2 = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
                    DrawTextFit(lb + (i + 1), CONTENT_X, this._y(rowY + 24), 70, 'Black', '');
                    MainCanvas.textAlign = p2;
                    if (isIdb) {
                        const name = _sndNameCache[entry.slice(4)] || ui('sndLocalName');
                        const p3 = MainCanvas.textAlign; MainCanvas.textAlign = 'left';
                        DrawTextFit('🎵 ' + name, LX + 5, this._y(rowY + 24), 410, '#1a7a2a', '');
                        MainCanvas.textAlign = p3;
                    } else {
                        const ph = def ? ui('sndDefaultPh', { file: def.split('/').pop() }) : ui('sndUnsetPh');
                        this.input('ivh-snd-' + cat + i, LX, rowY + 2, 410, 40, entry,
                            { placeholder: ph, onChange: v => { CONFIG.sounds[cat][i] = v.trim(); saveSettings(); } });
                    }
                    this.btn(1000, rowY, 58, 44, ui('upload'), '#8E44A1', null,
                        () => uploadSoundFile(cat, i));
                    this.btn(1062, rowY, 40, 44, '▶', '#2d5a5a', null,
                        () => { const e = entry || def; if (e) playSoundEntry(e, 0.9, true); });
                    this.btn(1106, rowY, 40, 44, '✕', '#872626', null,
                        () => { CONFIG.sounds[cat][i] = ''; saveSettings(); });
                    const picked = this._sndPick && this._sndPick.cat === cat && this._sndPick.i === i;
                    this.btn(1150, rowY, 70, 44, ui('other'), picked ? '#8E44A1' : '#465980', null,
                        () => { this._sndPick = picked ? null : { cat, i, label: lb + (i + 1) }; });
                    cy += 50;
                }
            });
            this._track(cy + 10);
        },

        // 右側：音效庫（預設＋本機）；可指派給「其他」選中的格子，或直接試聽。可卷動。
        _right_sounds() {
            DrawText(ui('snd_lib'), 1625, 230, 'Black', '');
            const pick = this._sndPick;

            // 載入本機上傳清單（一次）
            if (!this._localLoaded) {
                this._localLoaded = true; this._localSnd = [];
                IVHDB.getAll('sounds').then(list => {
                    this._localSnd = list || [];
                    (list || []).forEach(r => { _sndNameCache[r.id] = r.name; });
                });
            }

            // 兩大類：預設 / 本機（key 穩定、label 顯示用）
            const groups = [['preset', ui('snd_preset'), SOUND_PRESETS.map(p => ({ entry: p.url, name: p.name }))]];
            if (this._localSnd && this._localSnd.length)
                groups.push(['local', ui('snd_local'), this._localSnd.map(r => ({ entry: 'idb:' + r.id, name: r.name }))]);

            // 清單視窗（可卷動；比原本短 20px）
            const LX = 1368, LW = 484, LY0 = 256, LBOT = 818, ROW = 38, HEAD = 30;
            let contentH = 0;
            groups.forEach(([, , items]) => { contentH += HEAD + items.length * ROW + 6; });
            this._rmaxScroll = Math.max(0, contentH - (LBOT - LY0));
            this._rscroll = Math.max(0, Math.min(this._rmaxScroll, this._rscroll || 0));

            MainCanvas.save();
            MainCanvas.beginPath(); MainCanvas.rect(1358, LY0 - 2, 540, LBOT - LY0 + 4); MainCanvas.clip();
            let y = LY0 - this._rscroll;
            groups.forEach(([key, label, items]) => {
                const isLocal = key === 'local';
                DrawText('── ' + label + ' ──', 1610, y + 16, '#8E44A1', ''); y += HEAD;
                items.forEach(it => {
                    if (y >= LY0 - ROW && y <= LBOT) {
                        const nameW = isLocal ? LW - 46 : LW;   // 本機保留右側刪除鈕空間
                        this.rbtn(LX, y, nameW, ROW - 6, it.name, '#2a1a40', null, () => {
                            if (pick) { CONFIG.sounds[pick.cat][pick.i] = it.entry; saveSettings(); this._sndPick = null; }
                            else playSoundEntry(it.entry, 0.9, true);
                        });
                        if (isLocal) {
                            this.rbtn(LX + LW - 40, y, 40, ROW - 6, '✕', '#872626', null,
                                () => deleteLocalSound(it.entry.slice(4)));
                        }
                    }
                    y += ROW;
                });
                y += 6;
            });
            MainCanvas.restore();

            // 卷軸
            if (this._rmaxScroll > 0) {
                const trackH = LBOT - LY0;
                const thumbH = Math.max(40, trackH * (trackH / contentH));
                const thumbY = LY0 + (trackH - thumbH) * (this._rscroll / this._rmaxScroll);
                DrawRect(1882, LY0, 12, trackH, '#333');
                DrawRect(1882, thumbY, 12, thumbH, '#c060c0');
            }

            // 說明（往上 10px；hover 到按鈕顯示該說明，否則預設；超框自動換行）
            const descText = this.hoverDesc
                || (pick ? ui('snd_assignTo', { label: pick.label }) : ui('snd_pickHint'));
            DrawTextWrap(descText, 1365, 840, 515, 48, 'Black', undefined, 4);
        },
        _run_about() {
            this.sep(236, 'IVH — Immersive Voice Hypnosis  v' + MOD_VER);
            this.sep(280, ui('about_author'));
            DrawTextWrap(ui('about_dev'), 520, 315, 760, 60, 'Black', undefined, 2);
            this.btn(740, 410, 320, 50, ui('about_report'), '#465980', '',
                () => { try { window.open('https://github.com/awdrrawd/liko-Plugin-Repository/issues', '_blank'); } catch (e) {} });
            this.sep(510, ui('about_assets'));
            this.sep(550, '音源：びたちー素材館');
            this.sep(585, 'Pincree');
            this.sep(620, 'pixabay');
            this._track(670);
        },
    };

    // ════════════════════════════════════════
    //  Profile 按鈕：對方未裝 IVH → 不顯示；裝了但不允許編輯 → 灰色；允許 → 可點開編輯其文本，編輯透過隱藏訊息送到對方，對方驗證 allowOthersEdit 後套用
    // ════════════════════════════════════════
    function _sheetChar() {
        try { return (typeof InformationSheetSelection !== 'undefined') ? InformationSheetSelection : null; }
        catch { return null; }
    }
    function _isOther(C) {
        return C && C.MemberNumber != null && Player && C.MemberNumber !== Player.MemberNumber;
    }

    function hookProfileButton() {
        if (!modApi) return;
        try {
            modApi.hookFunction('InformationSheetRun', 1, (args, next) => {
                const r = next(args);
                const C = _sheetChar();
                const info = C && _isOther(C) && C.OnlineSharedSettings && C.OnlineSharedSettings[ES_KEY];
                if (info) {
                    const editable = !!info.edit;
                    DrawButton(1700, 75, 90, 90, '', editable ? 'White' : '#ccc', IVH_ICON,
                        editable ? '編輯對方的 IVH 催眠文本' : '對方未開放編輯文本', !editable);
                }
                return r;
            });
            modApi.hookFunction('InformationSheetClick', 1, (args, next) => {
                const C = _sheetChar();
                const info = C && _isOther(C) && C.OnlineSharedSettings && C.OnlineSharedSettings[ES_KEY];
                if (info && info.edit && MouseIn(1700, 75, 90, 90)) {
                    openRemoteTextEditor(C);
                    return;
                }
                return next(args);
            });
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] profile 按鈕 hook 失敗:', e.message);
        }
    }

    // 接收他人對「我」的文本編輯（隱藏訊息）
    function hookRemoteEdit() {
        if (!modApi) return;
        try {
            modApi.hookFunction('ChatRoomMessage', 1, (args, next) => {
                const data = args[0];
                if (data && data.Type === 'Hidden' && data.Content === 'IVH_SetTexts') {
                    try {
                        const dict = (data.Dictionary || []).find(d => d && d.Tag === 'IVH_SetTexts');
                        const mode = CONFIG.allowEditMode || 'off';
                        const senderOk = mode === 'any' ||
                                         (mode === 'whitelist' && (CONFIG.whitelist || []).includes(Number(data.Sender)));
                        if (dict && dict.Target === Player.MemberNumber && senderOk && Array.isArray(dict.Texts)) {
                            CONFIG.customTexts = dict.Texts.map(s => String(s).trim()).filter(Boolean).slice(0, 200);
                            saveSettings(true);
                            publishSharedSettings();
                            const who = (typeof CharacterNickname === 'function' && data.Sender)
                                ? (ChatRoomCharacter?.find(c => c.MemberNumber === data.Sender)?.Nickname || data.Sender)
                                : data.Sender;
                            printChat(ui('editedYourText', { who }), 8000);
                        }
                    } catch (e) {}
                    return;  // 不顯示此隱藏訊息
                }
                return next(args);
            });
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] 遠端編輯 hook 失敗:', e.message);
        }
    }

    // 遠端文本編輯面板（DOM）
    let _remoteEditor = null;
    function openRemoteTextEditor(C) {
        if (_remoteEditor) { _remoteEditor.remove(); _remoteEditor = null; }
        const info  = (C.OnlineSharedSettings && C.OnlineSharedSettings[ES_KEY]) || {};
        const texts = Array.isArray(info.texts) ? info.texts : [];
        const name  = (typeof CharacterNickname === 'function' ? CharacterNickname(C) : '') || C.Name || C.MemberNumber;

        const panel = document.createElement('div');
        _remoteEditor = panel;
        Object.assign(panel.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '460px', background: 'linear-gradient(135deg,rgba(30,10,40,0.98),rgba(50,15,60,0.98))',
            border: '1px solid rgba(255,120,200,0.45)', borderRadius: '12px', padding: '16px',
            zIndex: '100000', fontFamily: '"Noto Sans TC","Microsoft JhengHei",sans-serif', color: '#ffddee',
            boxShadow: '0 8px 40px rgba(180,60,160,0.4)',
        });
        const title = document.createElement('div');
        title.innerHTML = `🌀 編輯 <b style="color:#ff99dd">${name}</b> 的催眠文本`;
        title.style.cssText = 'font-size:15px;margin-bottom:6px';
        const hint = document.createElement('div');
        hint.textContent = '每行一句。儲存後會送給對方（對方需仍允許編輯才會生效）。';
        hint.style.cssText = 'font-size:11px;color:#cc99bb;margin-bottom:8px';
        const ta = document.createElement('textarea');
        ta.value = texts.join('\n');
        ta.addEventListener('keydown', e => e.stopPropagation());
        Object.assign(ta.style, {
            width: '100%', height: '220px', boxSizing: 'border-box', resize: 'vertical',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,120,200,0.3)',
            borderRadius: '6px', color: '#ffeeff', padding: '8px', fontFamily: 'monospace', fontSize: '13px', outline: 'none',
        });
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:12px;margin-top:14px;justify-content:flex-end';
        const bigBtn = 'font-size:16px;padding:10px 22px;border-radius:8px;font-weight:600';
        const cancel = _mkBtn('取消', '#4a2030', '#ffaabb', () => { panel.remove(); _remoteEditor = null; });
        cancel.style.cssText += ';' + bigBtn;
        const save   = _mkBtn('💾 儲存並送出', '#872626', '#aaffaa', () => {
            const newTexts = ta.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 200);
            try {
                ServerSend('ChatRoomChat', {
                    Type: 'Hidden', Content: 'IVH_SetTexts',
                    Dictionary: [{ Tag: 'IVH_SetTexts', Target: C.MemberNumber, Texts: newTexts }],
                });
                printChat(`📤 已送出對 ${name} 的文本編輯`, 6000);
            } catch (e) {}
            panel.remove(); _remoteEditor = null;
        });
        save.style.cssText += ';' + bigBtn;
        row.append(cancel, save);
        panel.append(title, hint, ta, row);
        document.body.appendChild(panel);
        ta.focus();
    }

    // 自繪二次確認框（不用瀏覽器 confirm，避免部分平台彈不出來）
    let _confirmBox = null;
    function ivhConfirm(message, onYes) {
        if (_confirmBox) { _confirmBox.remove(); _confirmBox = null; }
        const panel = document.createElement('div');
        _confirmBox = panel;
        Object.assign(panel.style, {
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: '400px', background: 'linear-gradient(135deg,rgba(30,10,40,0.98),rgba(50,15,60,0.98))',
            border: '1px solid rgba(255,120,200,0.45)', borderRadius: '12px', padding: '22px',
            zIndex: '100001', fontFamily: '"Noto Sans TC","Microsoft JhengHei",sans-serif', color: '#ffddee',
            boxShadow: '0 8px 40px rgba(180,60,160,0.4)', textAlign: 'center',
        });
        const msg = document.createElement('div');
        msg.textContent = message;
        msg.style.cssText = 'font-size:15px;margin-bottom:20px;line-height:1.6;white-space:pre-line';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:14px;justify-content:center';
        const big = 'font-size:16px;padding:10px 28px;border-radius:8px;font-weight:600';
        const no  = _mkBtn(ui('cancel'), '#4a2030', '#ffaabb', () => { panel.remove(); _confirmBox = null; });
        no.style.cssText += ';' + big;
        const yes = _mkBtn(ui('confirm'), '#872626', '#aaffaa', () => {
            panel.remove(); _confirmBox = null; try { onYes && onYes(); } catch (e) {}
        });
        yes.style.cssText += ';' + big;
        row.append(no, yes);
        panel.append(msg, row);
        document.body.appendChild(panel);
    }

    function registerPreferenceScreen() {
        waitForPreference().then(() => {
            try {
                PreferenceRegisterExtensionSetting({
                    Identifier: PREF_ID,
                    ButtonText: isZh() ? 'IVH 催眠設定' : 'IVH Settings',
                    Image: IVH_ICON,
                    load:   () => EXT.load(),
                    run:    () => EXT.run(),
                    click:  () => EXT.click(),
                    unload: () => EXT.unload(),
                    exit:   () => EXT.exit(),
                });
            } catch (e) {
                console.warn('🐈‍⬛ [IVH] 設定頁註冊失敗:', e.message);
            }
        });
    }

    // ════════════════════════════════════════
    //  CSS
    // ════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('ivh-styles')) return;
        const style = document.createElement('style');
        style.id = 'ivh-styles';
        style.textContent = `
            @keyframes ivhPinkPulse {
                0%   { opacity: 0; }
                12%  { opacity: 1; }
                65%  { opacity: 0.85; }
                100% { opacity: 0; }
            }
            @keyframes ivhVignette {
                0%   { opacity: 0; }
                15%  { opacity: 1; }
                70%  { opacity: 0.9; }
                100% { opacity: 0; }
            }
            @keyframes ivhSpiralSpin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
            @keyframes ivhWaveExpand {
                0%   { width: 10px; height: 10px; opacity: 1; }
                80%  { opacity: 0.4; }
                100% { width: 220px; height: 220px; opacity: 0; }
            }
            @keyframes ivhSteamRise0 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.85; }
                50%  { transform: translateY(-55px) translateX(8px) scale(1.2); opacity: 0.5; }
                100% { transform: translateY(-110px) translateX(15px) scale(0.4); opacity: 0; }
            }
            @keyframes ivhSteamRise1 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.8; }
                50%  { transform: translateY(-50px) translateX(-10px) scale(1.3); opacity: 0.45; }
                100% { transform: translateY(-105px) translateX(-18px) scale(0.3); opacity: 0; }
            }
            @keyframes ivhSteamRise2 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.9; }
                40%  { transform: translateY(-40px) translateX(4px) scale(1.1); opacity: 0.6; }
                100% { transform: translateY(-115px) translateX(-5px) scale(0.35); opacity: 0; }
            }
            @keyframes ivhClimaxFlash {
                0%   { opacity: 0; }
                8%   { opacity: 0.85; background: white; }
                30%  { opacity: 0.5; background: rgba(255,100,150,0.7); }
                60%  { opacity: 0.2; }
                100% { opacity: 0; }
            }
            @keyframes ivhClimaxShake {
                0%   { transform: translate(0,0) rotate(0deg); }
                15%  { transform: translate(-6px, 4px) rotate(-0.8deg); }
                30%  { transform: translate(5px, -4px) rotate(0.6deg); }
                45%  { transform: translate(-4px, 3px) rotate(-0.5deg); }
                60%  { transform: translate(4px, -2px) rotate(0.4deg); }
                75%  { transform: translate(-2px, 2px) rotate(-0.2deg); }
                100% { transform: translate(0,0) rotate(0deg); }
            }
            @keyframes ivhBreath0 {
                0%   { transform: translate(0,0) scale(0.5); opacity: 0; }
                20%  { opacity: 0.9; }
                100% { transform: translate(-34px, 30px) scale(2.1); opacity: 0; }
            }
            @keyframes ivhBreath1 {
                0%   { transform: translate(0,0) scale(0.5); opacity: 0; }
                20%  { opacity: 0.9; }
                100% { transform: translate(34px, 30px) scale(2.1); opacity: 0; }
            }
            @keyframes ivhBreath2 {
                0%   { transform: translate(0,0) scale(0.55); opacity: 0; }
                25%  { opacity: 0.85; }
                100% { transform: translate(4px, 44px) scale(1.9); opacity: 0; }
            }
            @keyframes ivhDemoRing {
                0%   { width: 24px; height: 24px; opacity: 0.95; }
                100% { width: 200px; height: 200px; opacity: 0; }
            }
            @keyframes ivhDemoDistort {
                0%   { transform: rotate(0deg) scale(1);     filter: blur(0px); }
                50%  { transform: rotate(8deg) scale(0.92);  filter: blur(2px); }
                100% { transform: rotate(0deg) scale(1);     filter: blur(0px); }
            }
            @keyframes ivhWaveChar {
                0%   { transform: translateY(0px); }
                25%  { transform: translateY(-5px); }
                50%  { transform: translateY(0px); }
                75%  { transform: translateY(3px); }
                100% { transform: translateY(0px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════
    //  等待工具
    // ════════════════════════════════════════
    function waitForBcModSdk(timeout = 30000) {
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

    function waitForGame(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (
                    typeof Player !== 'undefined' &&
                    typeof CharacterSetFacialExpression === 'function' &&
                    typeof ChatRoomCharacter !== 'undefined'
                ) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    let _fallbackInterval = null;

    function waitForChatRoom() {
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
            setupDOMObserver();
            return;
        }
        if (modApi) {
            let started = false;
            modApi.hookFunction('ChatRoomRun', 0, (args, next) => {
                const result = next(args);
                if (!started) {
                    started = true;
                    clearBCXCache();
                    setTimeout(setupDOMObserver, 500);
                }
                return result;
            });
            modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
                const result = next(args);
                if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }
                removePanel();
                clearBCXCache();
                started = false; // 允許下次進房間重建
                return result;
            });
        } else {
            _fallbackInterval = setInterval(() => {
                if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                    clearInterval(_fallbackInterval);
                    _fallbackInterval = null;
                    setTimeout(setupDOMObserver, 500);
                }
            }, 1000);
        }
    }

    // ════════════════════════════════════════
    //  初始化
    // ════════════════════════════════════════
    async function initialize() {
        console.log(`🐈‍⬛ [IVH] ⌛ 初始化 v${MOD_VER}...`);
        injectStyles();

        const sdkReady  = await waitForBcModSdk();
        const gameReady = await waitForGame();

        if (!gameReady) {
            console.error('🐈‍⬛ [IVH] ❌ 遊戲載入逾時');
            return;
        }

        // 先載入 i18n（讓預設文本等依語言產生），再等 ExtensionSettings
        await ensureI18n();
        await waitForExtensionSettings();
        // 還原設定 + 開啟本地 DB + 對外公告
        loadSettings();
        await IVHDB.open();
        publishSharedSettings();
        registerPreferenceScreen();
        applyDepthLoop();

        if (sdkReady) {
            try {
                modApi = bcModSdk.registerMod({
                    name:       'liko - IVH',
                    fullName:   "liko's Immersive Voice Hypnosis",
                    version:    MOD_VER,
                    repository: '沉浸式催眠效果 | Immersive Voice Hypnosis',
                });
            } catch (e) {
                console.warn('🐈‍⬛ [IVH] ⚠️ registerMod 失敗，進入相容模式:', e.message);
            }

            if (modApi) {
                try {
                    modApi.onUnload(() => {
                        if (_domObserver)      { _domObserver.disconnect(); _domObserver = null; }
                        if (_fallbackInterval) { clearInterval(_fallbackInterval); _fallbackInterval = null; }
                        if (_depthTimer)       { clearInterval(_depthTimer); _depthTimer = null; }
                        removePanel();
                        const overlay = document.getElementById('ivh-overlay');
                        if (overlay) overlay.remove();
                        const styles = document.getElementById('ivh-styles');
                        if (styles) styles.remove();
                        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
                        if (canvas) { canvas.style.filter = ''; canvas.style.transform = ''; }
                    });
                } catch (e) {
                    // 舊版 bcModSdk 不支援 onUnload，忽略即可
                }
            }
        }

        hookDrawCharacter();
        hookGhostDraw();
        hookOrgasmStage();
        hookProfileButton();
        hookRemoteEdit();
        hookChatInput();       // 只掛 keydown 保底，CommandCombine 在進房間後才註冊
        waitForChatRoom();
        console.log(`🐈‍⬛ [IVH] ✅ 初始化完成 v${MOD_VER}`);

        // 進入房間後顯示載入提示（一次性）
        let _loadedNotified = false;
        const _loadCheck = setInterval(() => {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
            clearInterval(_loadCheck);
            if (_loadedNotified) return;
            _loadedNotified = true;
            setTimeout(() => {
                printChat(ui('loaded', { v: MOD_VER }));
            }, 1000);
        }, 500);
    }

    initialize();

})();
