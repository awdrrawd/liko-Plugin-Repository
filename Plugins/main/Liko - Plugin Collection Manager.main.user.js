// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      2.1.0
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// @updateURL    https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// ==/UserScript==
(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "2.1.0"; // 2.1.0: 子插件新增 type 欄位（eval／scr／mod）決定載入方式，預設 eval 不影響舊資料；
                              // mod 用 dynamic import 直接載入像 AEE 這類 Vite/Rollup ESM bundle，不再需要中介 loader.user.js。
    if (window.Liko.PCM) return;
    window.Liko.PCM = MOD_VER;

    // ===== TEMP DIAG（EBC i18n 偵錯，確認後移除）=========================
    // 監視 window.Liko.__Sys_i18n__ 被指派幾次、被哪個版本換掉、換掉時舊引擎是否已有 PCM 字串。
    // 若看到 SET #2 且 prevHasPCM=true → 證實：PCM 註冊進舊引擎後，被另一支（如 AFC/EBC 的
    // Translation/Liko-i18n.js）不同版本的引擎覆寫掉，新引擎是空的 → t('PCM',...) 讀不到。
    (function _pcmI18nDiag(){
        try {
            const L = window.Liko;
            let _e = L.__Sys_i18n__;
            let _seq = _e ? 1 : 0;
            const log = (...a) => console.log('🐈‍⬛ [PCM][diag]', ...a);
            if (_e) log(`__Sys_i18n__ 已存在 ver=${_e?.version} hasPCM=${_e?.has?.('PCM','tabLocal')}`);
            try {
                Object.defineProperty(L, '__Sys_i18n__', {
                    configurable: true,
                    get() { return _e; },
                    set(v) {
                        _seq++;
                        log(`__Sys_i18n__ SET #${_seq} newVer=${v?.version} prevVer=${_e?.version} prevHasPCM=${_e?.has?.('PCM','tabLocal')}`);
                        _e = v;
                    },
                });
            } catch(err) { log('defineProperty 失敗:', err.message); }
            let ticks = 0;
            const id = setInterval(() => {
                ticks++;
                const e = L.__Sys_i18n__;
                log(`t+${ticks}s lang=${e?.detectLang?.()} hasPCM/tabLocal=${e?.has?.('PCM','tabLocal')} ver=${e?.version} sets=${_seq}`);
                if (ticks >= 12) clearInterval(id);
            }, 1000);
        } catch(e) {}
    })();
    // ===== /TEMP DIAG ===================================================

    let modApi;
    let isInitialized = false;
    const _lifecycle = { intervals: [], mousemoveHandler: null };

    // === i18n ===================================================
    
    const t = (key, vars) => window.Liko.__Sys_i18n__?.t('PCM', key, vars) ?? key;

    function registerI18n() {
        // EN strings are the authoritative fallback — other languages live in PCM-i18n.js
        const _enStrings = {
            'loaded':           { EN: 'Liko\'s Plugin Collection Manager v{ver} loaded! Click the floating button to manage plugins.' },
            'shortLoaded':      { EN: '📋 Liko Plugin Collection Manager Manual\n\n🎮 How to Use:\n• Click the floating button to open panel\n• Toggle switches to enable/disable plugins\n• Three-state toggle: OFF → ON → BETA\n\n📝 Commands:\n/pcm help — show this\n/pcm list — list all plugins\n\n💡 Plugins load on enable, or take effect on next refresh.' },
            'welcomeTitle':     { EN: '🐈‍⬛ Plugin Manager' },
            'tabLocal':         { EN: '📱 Local' },
            'tabAccount':       { EN: '☁️ Account' },
            'tabCustom':        { EN: '🔧 Custom' },
            'searchPlaceholder':{ EN: 'Search plugins...' },
            'filterAll':        { EN: 'Showing: All' },
            'filterEnabled':    { EN: 'Showing: Enabled' },
            'filterDisabled':   { EN: 'Showing: Disabled' },
            'pluginEnabled':    { EN: 'enabled' },
            'pluginDisabled':   { EN: 'disabled' },
            'willTakeEffect':   { EN: 'Plugin loaded or will take effect on next refresh' },
            'willNotStart':       { EN: 'Will not start on next load' },
            'visitWebsite':       { EN: 'Visit website' },
            'changelogTitle':     { EN: '📋 Update Log' },
            'changelogClose':     { EN: 'Close' },
            'newVersionTitle':    { EN: '✨ PCM Updated' },
            'newVersionHint':     { EN: 'Click 📋 to view again anytime' },
            'loadingPlugins':     { EN: 'Loading plugin list...' },
            'loadPluginsFailed':  { EN: 'Failed to load plugin list, please refresh' },
            'refreshTitle':       { EN: 'Clear Cache & Refresh' },
            'refreshing':         { EN: 'Clearing cache and re-downloading...' },
            'refreshDone':        { EN: 'All cache cleared, plugin list updated! Please refresh the game to fully apply the latest main script and plugins.' },
            'refreshFailed':      { EN: 'Update failed, using cached list' },
            'pluginLoadComplete': { EN: 'Plugin loading complete' },
            'successLoaded':      { EN: 'Loaded' },
            'plugins':            { EN: 'plugins' },
            'failed':             { EN: 'failed' },
            'pluginLoadFailed':   { EN: '{name} failed to load' },
            'pluginLoadRetry':    { EN: 'Click ↺ on the plugin to retry' },
            'accountNotLoggedIn': { EN: '🔒\nPlease log in to use account settings' },
            'customAddTitle':     { EN: 'Add Custom Plugin' },
            'customFieldName':    { EN: 'Plugin name *' },
            'customFieldUrl':     { EN: 'URL (.js) *' },
            'customFieldIcon':    { EN: 'Icon — emoji or image URL (optional)' },
            'customFieldDesc':    { EN: 'Description (optional)' },
            'customFieldType':    { EN: 'Load method (advanced, leave default if unsure)' },
            'customTypeEval':     { EN: 'Eval — fetch code as text & run it (default)' },
            'customTypeScr':      { EN: 'Script tag — <script src>, use if the host blocks fetch() with CORS' },
            'customTypeMod':      { EN: 'Module — dynamic import(), for Vite/Rollup ESM bundles' },
            'customBtnAdd':       { EN: 'Add' },
            'customBtnCancel':    { EN: 'Cancel' },
            'customDeleteConfirm':{ EN: 'Remove "{name}"?' },
            'customDeleteYes':    { EN: 'Remove' },
            'customAdded':        { EN: '{name} added' },
            'customDeleted':      { EN: '{name} removed' },
            'customUrlInvalid':   { EN: 'URL must end in .js' },
            'customNameRequired': { EN: 'Please enter a name' },
            'customEmptyHint':    { EN: 'No custom plugins yet.\nClick ⚙ above to add one.' },
            'prefButton':         { EN: 'PCM Plugin Manager' },
        };

        // 引擎（window.Liko.__Sys_i18n__）有時會晚一點才就位（例如 Electron-BC 環境下，
        // _ensureDeps() 自己去抓 expand/BC_i18n.js 可能失敗/輸掉競速，引擎要等別的插件
        // 順便載入才出現）。原本用 `?.register(...)` 只嘗試一次，當下引擎不存在就會
        // 靜靜地失敗，導致連 EN fallback 都永遠沒註冊成功。改成輪詢等待，最多等 10 秒。
        (function registerWhenReady(tries) {
            if (window.Liko.__Sys_i18n__?.register) {
                window.Liko.__Sys_i18n__.register('PCM', _enStrings);
                console.log(`🐈‍⬛ [PCM][diag] registerI18n → register EN 完成，engine ver=${window.Liko.__Sys_i18n__?.version} hasPCM/tabLocal=${window.Liko.__Sys_i18n__?.has?.('PCM','tabLocal')}`); // TEMP DIAG
                return;
            }
            if ((tries ?? 0) > 100) {
                console.warn('🐈‍⬛ [PCM] ⚠️ __Sys_i18n__ never became available, EN fallback not registered');
                return;
            }
            setTimeout(() => registerWhenReady((tries ?? 0) + 1), 100);
        })();
    }

    // === PCM 徽章系統 ====================================

    const PCM_HIDDEN_MSG = "PCM_BADGE_INIT";
    const PCM_BADGE_CONFIG = { offsetX: 240, offsetY: 25, size: 36, showBackground: false, backgroundColor: "#7F53CD", borderColor: "#FFFFFF", borderWidth: 1 };
    let pcmBadgeImage = null, pcmImageLoaded = false;
    const hoveredCharacters = new Set(), characterDrawPositions = new Map();
    let cachedViewingCharacter = null, lastCharacterCheck = 0;
    let lastScreenCheck = null, lastScreenCheckTime = 0;
    const CHARACTER_CACHE_TIME = 500;

    function cleanupLegacyOnlineSettings() {
        const doSetup = () => {
            try {
                if (Player?.OnlineSharedSettings?.PCM) delete Player.OnlineSharedSettings.PCM;
                Player.PCM = { version: MOD_VER };
                accountPluginSettings = loadAccountSettings();
                const cfg = loadAccountConfig();
                accountFloatingBtnVisible = cfg.showFloatingBtn !== false;
                applyFloatingBtnVisibility();
            } catch(e) {}
        };
        if (typeof Player !== 'undefined' && Player?.AccountName) doSetup();
        else {
            const id = setInterval(() => { if (typeof Player !== 'undefined' && Player?.AccountName) { clearInterval(id); doSetup(); } }, 500);
        }
    }

    function sendPCMInitialization(requestReply = false, target = null) {
        try {
            // 用伺服器房間狀態判斷，而非 CurrentScreen —— 避免進房轉場瞬間送出被吞掉
            if (typeof ServerPlayerIsInChatRoom !== 'function' || !ServerPlayerIsInChatRoom()) return;
            const msg = { Type: "Hidden", Content: PCM_HIDDEN_MSG, Sender: Player.MemberNumber, Dictionary: [{ pcm: { version: MOD_VER, replyRequested: requestReply } }] };
            if (target) msg.Target = target; // 定向（只送給特定成員），減少全房廣播量
            ServerSend("ChatRoomChat", msg);
        } catch(e) {}
    }

    function parsePCMMessage(data, deferred = false) {
        try {
            if (data.Type !== "Hidden" || data.Content !== PCM_HIDDEN_MSG) return;
            // 搜尋整個 Dictionary，而非寫死 [0]（其它 mod 可能在前面插入條目）
            const pcmData = Array.isArray(data.Dictionary) ? data.Dictionary.find(d => d?.pcm)?.pcm : data.Dictionary?.pcm;
            if (!pcmData) return;
            const sender = Character?.find(c => c.MemberNumber === data.Sender);
            // 隱藏訊息可能比遊戲建立 sender 角色更早到達 —— 延後到下一個微任務重試一次
            if (!sender) { if (deferred !== true) queueMicrotask(() => parsePCMMessage(data, true)); return; }
            if (sender.ID === 0) return;
            sender.PCM = { version: pcmData.version };
            if (pcmData.replyRequested) sendPCMInitialization(false, data.Sender); // 定向回覆給發問者
        } catch(e) {}
    }

    // 把 ChatRoomMessage 監聽重新綁到目前的 ServerSocket（off 再 on，避免同一 socket 重複綁）
    function bindPCMSocketListener() {
        try {
            if (typeof ServerSocket === 'undefined' || !ServerSocket) return;
            ServerSocket.off("ChatRoomMessage", parsePCMMessage);
            ServerSocket.on("ChatRoomMessage", parsePCMMessage);
        } catch(e) {}
    }

    function initializePCMBadgeImage() {
        if (!pcmBadgeImage) {
            // jsDelivr 優先、raw 後備 —— raw.githubusercontent 在 EBC 會 429，圖片同樣會破圖。
            const _badgeCdn = "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_Badge.png";
            const _badgeRaw = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Images/PCM_Badge.png";
            pcmBadgeImage = new Image();
            pcmBadgeImage.crossOrigin = "anonymous";
            pcmBadgeImage.onload = () => { pcmImageLoaded = true; };
            pcmBadgeImage.onerror = () => { if (pcmBadgeImage.src !== _badgeRaw) pcmBadgeImage.src = _badgeRaw; else pcmImageLoaded = false; };
            pcmBadgeImage.src = _badgeCdn;
        }
    }

    function setupHoverTracking() {
        let rafPending = false;
        const onMouseMove = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                hoveredCharacters.clear();
                try {
                    if (CurrentScreen !== "ChatRoom" || typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null) return;
                    if (typeof ChatRoomHideIconState !== 'undefined' && ChatRoomHideIconState !== 0) return;
                    if (typeof MouseHovering !== 'function') return;
                    for (const [mn, pos] of characterDrawPositions) {
                        if (MouseHovering(pos.x, pos.y, 400 * pos.zoom, 100 * pos.zoom)) hoveredCharacters.add(mn);
                    }
                } catch(e) {}
            });
        };
        _lifecycle.mousemoveHandler = onMouseMove;
        document.addEventListener("mousemove", onMouseMove);
    }

    function drawPCMBadge(character, x, y, zoom) {
        try {
            if (!hoveredCharacters.has(character.MemberNumber) || !character.PCM) return;
            if (!pcmBadgeImage) { initializePCMBadgeImage(); return; }
            const bx = x + PCM_BADGE_CONFIG.offsetX * zoom, by = y + PCM_BADGE_CONFIG.offsetY * zoom, bs = PCM_BADGE_CONFIG.size * zoom;
            if (PCM_BADGE_CONFIG.showBackground) {
                MainCanvas.fillStyle = PCM_BADGE_CONFIG.backgroundColor;
                MainCanvas.beginPath(); MainCanvas.arc(bx, by, bs / 2, 0, 2 * Math.PI); MainCanvas.fill();
                if (PCM_BADGE_CONFIG.borderWidth > 0) { MainCanvas.strokeStyle = PCM_BADGE_CONFIG.borderColor; MainCanvas.lineWidth = PCM_BADGE_CONFIG.borderWidth * zoom; MainCanvas.stroke(); }
            }
            if (pcmImageLoaded && pcmBadgeImage.complete) { MainCanvas.drawImage(pcmBadgeImage, bx - bs / 2, by - bs / 2, bs, bs); }
            else { MainCanvas.save(); MainCanvas.fillStyle = "#FFFFFF"; MainCanvas.font = `bold ${Math.max(10, bs / 3)}px Arial`; MainCanvas.textAlign = "center"; MainCanvas.textBaseline = "middle"; MainCanvas.fillText("PCM", bx, by); MainCanvas.restore(); }
        } catch(e) {}
    }

    function syncDrawPositionsWithRoom() {
        if (!Array.isArray(ChatRoomCharacter)) return;
        const ids = new Set(ChatRoomCharacter.map(c => c?.MemberNumber).filter(id => id !== undefined));
        for (const id of characterDrawPositions.keys()) { if (!ids.has(id)) { characterDrawPositions.delete(id); hoveredCharacters.delete(id); } }
    }

    function hookCharacterDrawing() {
        if (!modApi || typeof modApi.hookFunction !== 'function') return;
        const sh = (fn, pri, cb) => { try { modApi.hookFunction(fn, pri, cb); } catch(e) {} };
        sh('DrawCharacter', 5, (args, next) => {
            const [c, x, y, zoom] = args, result = next(args);
            if (c?.PCM && c.MemberNumber !== undefined) { characterDrawPositions.set(c.MemberNumber, { x, y, zoom }); drawPCMBadge(c, x, y, zoom); }
            return result;
        });
        sh('ChatRoomClearAllElements', 5, (args, next) => { characterDrawPositions.clear(); hoveredCharacters.clear(); return next(args); });
        sh('ChatRoomSync', 5, (args, next) => { const r = next(args); syncDrawPositionsWithRoom(); sendPCMInitialization(true); return r; });
        // 有人晚於自己進房時，BC 對既有成員觸發的是 ChatRoomSyncMemberJoin（不是 ChatRoomSync）——對新人定向握手並要求回覆
        sh('ChatRoomSyncMemberJoin', 5, (args, next) => {
            const r = next(args);
            try { const d = args[0]; if (d && d.SourceMemberNumber != null && d.SourceMemberNumber !== Player.MemberNumber) sendPCMInitialization(true, d.SourceMemberNumber); } catch(e) {}
            return r;
        });
        // 遊戲重連 / 重複登入會重跑 ServerInit 並換掉 ServerSocket，必須把監聽重新綁到新 socket，否則從此收不到任何人的訊息
        sh('ServerInit', 1, (args, next) => { const r = next(args); bindPCMSocketListener(); return r; });
        sh('CommonSetScreen', 1, (args, next) => {
            const r = next(args);
            try { lastScreenCheck = null; lastScreenCheckTime = 0; cachedViewingCharacter = null; lastCharacterCheck = 0; currentUIState = null; checkLanguageChange(); createManagerUI(); if (!localLoadStarted) loadLocalPluginsPhase(); if (!accountLoadStarted) loadAccountPluginsPhase(); } catch(e) {}
            return r;
        });
        let _lastBcxState = false;
        sh('GameRun', 1, (args, next) => {
            const r = next(args);
            try {
                const cur = (window.bcx?.inBcxSubscreen?.() ?? false) || (window.LITTLISH_CLUB?.inModSubscreen?.() ?? false);
                if (cur !== _lastBcxState) { _lastBcxState = cur; lastScreenCheck = null; lastScreenCheckTime = 0; currentUIState = null; createManagerUI(); }
            } catch(e) {}
            return r;
        });
    }

    function registerPCMBadge() {
        const wait = () => {
            if (!modApi?.hookFunction || typeof ServerSocket === 'undefined' || !ServerSocket) { setTimeout(wait, 500); return; }
            initializePCMBadgeImage(); setupHoverTracking(); cleanupLegacyOnlineSettings(); hookCharacterDrawing();
            bindPCMSocketListener();
            // 載入時若已在房內（不會再有 ChatRoomSync/MemberJoin 觸發），廣播一發並要求回覆讓在場所有人回應自己
            sendPCMInitialization(true);
            if (typeof modApi.onUnload === 'function') modApi.onUnload(() => {
                try { ServerSocket.off("ChatRoomMessage", parsePCMMessage); } catch(e) {}
                if (_lifecycle.mousemoveHandler) { document.removeEventListener("mousemove", _lifecycle.mousemoveHandler); _lifecycle.mousemoveHandler = null; }
                hoveredCharacters.clear(); characterDrawPositions.clear();
            });
        };
        wait();
    }

    // === JSON 來源 ===============================================
    // raw 優先、jsDelivr 後備 —— Plugins.json 承載版本號/更新日誌等資訊，需要即時性；
    // jsDelivr 有 CDN 快取（更新後可能要一段時間才會反映最新內容），raw.githubusercontent
    // 才是即時的。這裡跟其他「插件本體/依賴」用 jsDelivr 優先剛好相反：本體檔案大、多支
    // 同時打 raw 容易 429，但 Plugins.json 只有這一支請求，即時性優先於避免 429。
    const PLUGINS_JSON_URLS = [
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins.json",
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins.json",
    ];

    // === 設定存取 ================================================

    let saveTimer;
    function saveSettings(s) { clearTimeout(saveTimer); saveTimer = setTimeout(() => localStorage.setItem("BC_PluginManager_Settings", JSON.stringify(s)), 100); }
    function loadSettings() { return JSON.parse(localStorage.getItem("BC_PluginManager_Settings") || "{}"); }
    let pluginSettings = loadSettings();
    let accountPluginSettings = {};

    function loadAccountSettings() {
        try { const raw = Player?.ExtensionSettings?.PCMAccount; if (!raw) return {}; return typeof raw === 'object' ? raw : JSON.parse(raw) || {}; } catch(e) { return {}; }
    }
    function saveAccountSettings() {
        try {
            if (!Player?.ExtensionSettings) return;
            const c = {};
            for (const [id, v] of Object.entries(accountPluginSettings)) { if (v === 1 || v === true) c[id] = 1; else if (v === "stable" || v === "beta") c[id] = v; }
            Player.ExtensionSettings.PCMAccount = JSON.stringify(c);
            ServerPlayerExtensionSettingsSync("PCMAccount");
        } catch(e) {}
    }
    let accountFloatingBtnVisible = true;
    function loadAccountConfig() { try { const raw = Player?.ExtensionSettings?.PCMConfig; if (!raw) return {}; return typeof raw === 'object' ? raw : JSON.parse(raw) || {}; } catch(e) { return {}; } }
    function saveAccountConfig(cfg) { try { if (!Player?.ExtensionSettings) return; Player.ExtensionSettings.PCMConfig = JSON.stringify(cfg); ServerPlayerExtensionSettingsSync("PCMConfig"); } catch(e) {} }

    // ============================================================
    // === 插件腳本快取（僅 JsDelivr）============================
    // ============================================================

    const PLUGIN_CACHE_PREFIX = 'pcm_p_';

    function isJsDelivrUrl(url) { return typeof url === 'string' && url.includes('cdn.jsdelivr.net'); }

    function getCachedPluginCode(id) {
        try {
            const c = JSON.parse(localStorage.getItem(PLUGIN_CACHE_PREFIX + id) || 'null');
            return c?.code ?? null;
        } catch(e) { return null; }
    }
    function setCachedPluginCode(id, code) {
        try { localStorage.setItem(PLUGIN_CACHE_PREFIX + id, JSON.stringify({ time: Date.now(), code })); } catch(e) {}
    }


    // === JSON 快取（SWR）=======================================

    const JSON_CACHE_KEY = 'pcm_json_cache';
    const JSON_CACHE_TTL = 24 * 60 * 60 * 1000;

    function getCachedJSON() {
        try { const c = JSON.parse(localStorage.getItem(JSON_CACHE_KEY) || 'null'); if (!c || Date.now() - c.time > JSON_CACHE_TTL) { if (c) localStorage.removeItem(JSON_CACHE_KEY); return null; } return c.data; } catch(e) { return null; }
    }
    function setCachedJSON(data) { try { localStorage.setItem(JSON_CACHE_KEY, JSON.stringify({ time: Date.now(), data })); } catch(e) {} }

    // === 插件資料管理（SWR 初始化）==============================
    
    let subPlugins = [];
    let pluginsLoaded = false;
    let remoteVersion = MOD_VER, remoteUpdateId = null;
    let remoteChangelogTW = [], remoteChangelogEN = [];

    let _resolvePluginsReady;
    const pluginsReady = new Promise(r => { _resolvePluginsReady = r; });

    function validateJSON(data) { return data && Array.isArray(data.plugins) && data.plugins.length > 0; }

    function applyPluginSettings(plugins) {
        return plugins.map(plugin => {
            const saved = pluginSettings[plugin.id];
            if (isTriStatePlugin(plugin)) plugin.state = saved !== undefined ? saved : "off";
            else plugin.enabled = saved !== undefined ? saved : false;
            if (pluginSettings[`${plugin.id}_customIcon`]) plugin.customIcon = pluginSettings[`${plugin.id}_customIcon`];
            return plugin;
        });
    }

    function processPluginData(data) {
        remoteVersion    = data.version  || MOD_VER;
        remoteUpdateId   = data.updateId || null;
        remoteChangelogTW = data.changelog    || [];
        remoteChangelogEN = data.en_changelog || data.changelog || [];
        subPlugins = applyPluginSettings(data.plugins);
        subPlugins.sort((a, b) => (a.priority || 5) - (b.priority || 5));
        pluginsLoaded = true;
        console.log(`🐈‍⬛ [PCM] 📦 ${subPlugins.length} plugins loaded`);
    }

    async function fetchJSONFromNetwork() {
        for (const url of PLUGINS_JSON_URLS) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                let data; try { data = JSON.parse(await res.text()); } catch(e) { continue; }
                if (!validateJSON(data)) continue;
                setCachedJSON(data);
                console.log(`🐈‍⬛ [PCM] ✅ Plugins.json fetched (${url})`);
                return data;
            } catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return null;
    }

    async function initPlugins() {
        const cached = getCachedJSON();
        if (cached && validateJSON(cached)) {
            processPluginData(cached);
            _resolvePluginsReady(true);
        }

        const data = await fetchJSONFromNetwork();
        if (data) {
            const wasLoaded = pluginsLoaded;
            processPluginData(data);
            if (!wasLoaded) _resolvePluginsReady(true);
            refreshPluginListUI();
            if (checkVersionUpdate()) {
                setTimeout(() => { showChangelogModal(); showNotification("✨", t('newVersionTitle'), `v${remoteVersion} — ${t('newVersionHint')}`); }, 2000);
            }
        } else if (!pluginsLoaded) {
            showNotification("❌", "PCM", t('loadPluginsFailed'));
            _resolvePluginsReady(false);
        }
    }

    // === 強制刷新（清除所有快取並重新下載）=========================

    let isRefreshing = false;
    async function refreshPluginList() {
        if (isRefreshing) return;
        isRefreshing = true;
        const btn = document.getElementById('bc-plugin-refresh-btn');
        btn?.classList.add('spinning');
        showNotification("↻", t('refreshTitle'), t('refreshing'));

        // 清除所有本機快取：Loader 快取的 Main 腳本、Plugins.json 清單快取、各插件程式碼快取
        try {
            localStorage.removeItem('pcm_main_cache');
            localStorage.removeItem(JSON_CACHE_KEY);
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(PLUGIN_CACHE_PREFIX)) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch(e) {}

        const data = await fetchJSONFromNetwork();
        if (data) { processPluginData(data); refreshPluginListUI(); showNotification("✅", t('refreshTitle'), t('refreshDone')); }
        else showNotification("⚠️", t('refreshTitle'), t('refreshFailed'));
        btn?.classList.remove('spinning');
        isRefreshing = false;
    }

    function refreshPluginListUI() {
        const lc = document.getElementById('bc-plugin-content-local');
        if (lc) { lc.innerHTML = ''; subPlugins.forEach(p => lc.appendChild(buildPluginItem(p, 'local'))); }
        const ac = document.getElementById('bc-plugin-content-account');
        if (ac) buildAccountContent(ac);
        applyFilter();
    }

    // === 自訂插件 ===============================================

    const CUSTOM_PLUGINS_KEY = 'pcm_custom_plugins';
    let customPlugins = [];

    function loadCustomPlugins() { try { return JSON.parse(localStorage.getItem(CUSTOM_PLUGINS_KEY) || '[]'); } catch(e) { return []; } }
    function saveCustomPlugins() { try { localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(customPlugins)); } catch(e) {} }

    // === 版本比對 ================================================

    function checkVersionUpdate() {
        const saved = pluginSettings['_pcm_updateId'];
        if (remoteUpdateId && saved !== remoteUpdateId) { pluginSettings['_pcm_updateId'] = remoteUpdateId; saveSettings(pluginSettings); return true; }
        return false;
    }

    function parseGameVersion(v) { const m = String(v || '').match(/R?(\d+)/i); return m ? parseInt(m[1], 10) : 0; }
    function getCurrentGameVersion() { try { return typeof GameVersion !== 'undefined' ? parseGameVersion(GameVersion) : 0; } catch(e) { return 0; } }
    function isPluginSkippedByVersion(plugin) { if (!plugin.autoDisableAfterVersion) return false; const v = getCurrentGameVersion(); return v > 0 && v > parseGameVersion(plugin.autoDisableAfterVersion); }

    // === 三段開關輔助 ============================================

    function isTriStatePlugin(p) { return !!p.altUrl; }
    function isPluginEnabled(p) { return isTriStatePlugin(p) ? p.state !== "off" : p.enabled; }
    function isPluginEnabledInAccount(p) { const v = accountPluginSettings[p.id]; return v !== undefined && v !== 0 && v !== "off"; }
    function isPluginEnabledForLoading(p) { return isPluginEnabled(p) || isPluginEnabledInAccount(p); }
    function getActivePluginUrl(p) {
        if (p.altUrl) { const ls = p.state || "off"; const as = accountPluginSettings[p.id] || "off"; if (ls === "beta" || as === "beta") return p.altUrl; }
        return p.url;
    }
    function getTriLabels(p) { return p.triLabels?.length === 3 ? p.triLabels : ["OFF", "ON", "BETA"]; }
    function cycleTriState(s) { return s === "off" ? "stable" : s === "stable" ? "beta" : "off"; }

    // === 語言輔助 ================================================

    function getLang() { return window.Liko.__Sys_i18n__?.detectLang() ?? 'EN'; }
    function isCJK() { const l = getLang(); return l === 'TW' || l === 'CN'; }
    function getPluginName(p) { return isCJK() ? p.name : (p.en_name || p.name); }
    function getPluginDescription(p) { return isCJK() ? p.description : (p.en_description || p.description); }
    function getPluginAdditionalInfo(p) { return isCJK() ? p.additionalInfo : (p.en_additionalInfo || p.additionalInfo); }

    // === 插件加載 ================================================
    
    let loadedPlugins = new Set(), failedPlugins = new Set();
    let isLoadingPlugins = false, localLoadStarted = false, accountLoadStarted = false, customLoadStarted = false;

    function injectScript(id, code) {
        if (code.trimStart().startsWith('<')) throw new Error('Received HTML instead of JS');
        const s = document.createElement('script');
        s.setAttribute('data-plugin', id);
        s.textContent = `(function(){try{${code}}catch(e){console.error('🐈‍⬛ [PCM] plugin error (${id}):', e.message);}})();`;
        document.body.appendChild(s);
    }

    async function tryFetch(urls) {
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (!text || text.trimStart().startsWith('<')) throw new Error('Invalid content');
                return text;
            } catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return null;
    }

    function buildFetchUrls(url) {
        if (!url) return [];
        // jsDelivr 優先、raw 當後備 —— 每個子插件都先打 raw 會在 EBC 觸發 429（見 _DEP_BASES 註解）。
        const cdn = url.replace(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/, "https://cdn.jsdelivr.net/gh/$1/$2@$3/$4");
        return cdn !== url ? [cdn, url] : [url];
    }

    // === 載入方式（type）==========================================
    // 三種載入方式並列，透過 plugin.type 選擇；沒填視為 "eval"（現行預設，向後相容所有舊資料）：
    //   eval — fetch 拿到原始碼文字，用 <script> 塞文字執行（本質等同 eval，現行絕大多數子插件用這個）
    //   scr  — 用 <script src="url"> 直接讓瀏覽器載入 URL，不自己 fetch。適合 fetch() 會被 CORS
    //          擋掉、但瀏覽器原生 <script src> 仍可正常載入執行的來源
    //   mod  — dynamic import(url)。給 Vite/Rollup 打包、含 import.meta 或需要模組作用域的插件用
    //          （像 AEE），這類 bundle 塞進純文字 <script> 執行會噴 "Unexpected token 'export'" 或
    //          "import.meta outside a module"。過去得靠額外一支 loader.user.js 用 import() 中介，
    //          現在 PCM 原生支援，直接對 bundle URL 做 dynamic import 即可，不再需要中介腳本。
    function getLoadType(plugin) {
        const ty = plugin?.type;
        return (ty === 'mod' || ty === 'scr') ? ty : 'eval';
    }

    function withCacheBuster(url) {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}_pcmv=${Date.now()}`;
    }

    async function tryImportModule(urls) {
        for (const url of urls) {
            try { await import(withCacheBuster(url)); return true; }
            catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return false;
    }

    function loadViaScriptTag(url, id) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.setAttribute('data-plugin', id);
            s.onload  = () => resolve();
            s.onerror = () => reject(new Error('script load error'));
            document.body.appendChild(s);
        });
    }

    async function tryLoadScriptTag(urls, id) {
        for (const url of urls) {
            try { await loadViaScriptTag(url, id); return true; }
            catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return false;
    }

    async function loadSubPlugin(plugin, isCustom = false) {
        if (loadedPlugins.has(plugin.id)) return;
        if (!isCustom && !isPluginEnabledForLoading(plugin)) return;
        if (!isCustom && isPluginSkippedByVersion(plugin)) { loadedPlugins.add(plugin.id); return; }

        if (!plugin.url && plugin.inlineCode) {
            try { injectScript(plugin.id, plugin.inlineCode); loadedPlugins.add(plugin.id); } catch(e) {}
            return;
        }
        if (!plugin.url) return;

        const rawUrl   = isCustom ? plugin.url : getActivePluginUrl(plugin);
        const loadType = getLoadType(plugin);

        // mod / scr 都不進 fetch+eval / localStorage 快取邏輯 —— mod 因為模組沒法安全地存純文字
        // 再用 <script> 重放；scr 因為本來就是要讓瀏覽器直接載，不自己 fetch 文字。快取交給瀏覽器
        // 自己的 HTTP cache 處理即可。
        if (loadType === 'mod' || loadType === 'scr') {
            const ok = loadType === 'mod'
                ? await tryImportModule(buildFetchUrls(rawUrl))
                : await tryLoadScriptTag(buildFetchUrls(rawUrl), plugin.id);
            if (!ok) {
                failedPlugins.add(plugin.id);
                showPluginRetryBtn(plugin.id);
                showNotification("❌", t('pluginLoadFailed', { name: getPluginName(plugin) }), t('pluginLoadRetry'));
                throw new Error(`All ${loadType} URLs failed`);
            }
            loadedPlugins.add(plugin.id); failedPlugins.delete(plugin.id);
            hidePluginRetryBtn(plugin.id);
            console.log(`🐈‍⬛ [PCM] ✅ ${plugin.name} loaded (${loadType})`);
            return;
        }

        const urls    = buildFetchUrls(rawUrl);
        const primary = urls[0];
        const useCache = isJsDelivrUrl(primary);
        const oldCache = useCache ? getCachedPluginCode(plugin.id) : null; // 先留著當救援，成功前絕不覆蓋

        const code = await tryFetch(urls);
        if (code) {
            try {
                injectScript(plugin.id, code);
                loadedPlugins.add(plugin.id); failedPlugins.delete(plugin.id);
                hidePluginRetryBtn(plugin.id);
                console.log(`🐈‍⬛ [PCM] ✅ ${plugin.name} loaded`);
                if (useCache) setCachedPluginCode(plugin.id, code); // 注入成功才覆蓋快取
                return;
            } catch(e) {
                console.warn(`🐈‍⬛ [PCM] ⚠️ ${plugin.name} 新版執行失敗，改用舊版快取：${e.message}`);
            }
        }

        // 下載失敗，或下載到的新版執行出錯 → 退回舊版快取救援
        if (oldCache) {
            try {
                injectScript(plugin.id, oldCache);
                loadedPlugins.add(plugin.id); failedPlugins.delete(plugin.id);
                hidePluginRetryBtn(plugin.id);
                console.log(`🐈‍⬛ [PCM] ⚡ ${plugin.name} from cache (fallback)`);
                return;
            } catch(e) { /* 舊版也壞了，繼續往下走失敗流程 */ }
        }

        failedPlugins.add(plugin.id);
        showPluginRetryBtn(plugin.id);
        showNotification("❌", t('pluginLoadFailed', { name: getPluginName(plugin) }), t('pluginLoadRetry'));
        throw new Error('All URLs failed');
    }

    function showPluginRetryBtn(pluginId) {
        const item = document.querySelector(`.bc-plugin-item[data-plugin-id="${CSS.escape(pluginId)}"]`);
        if (!item || item.querySelector('.bc-plugin-retry-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'bc-plugin-retry-btn';
        btn.textContent = '↺';
        btn.title = t('pluginLoadRetry');
        btn.setAttribute('data-retry-id', pluginId);
        item.appendChild(btn); item.classList.add('failed');
    }

    function hidePluginRetryBtn(pluginId) {
        document.querySelector(`[data-retry-id="${CSS.escape(pluginId)}"]`)?.remove();
        document.querySelector(`.bc-plugin-item[data-plugin-id="${CSS.escape(pluginId)}"]`)?.classList.remove('failed');
    }

    async function runPluginBatch(plugins, isCustom = false) {
        while (isLoadingPlugins) await new Promise(r => setTimeout(r, 200));
        if (!plugins.length) return;
        isLoadingPlugins = true;
        try {
            const batchSize = 3; let ok = 0, fail = 0;
            for (let i = 0; i < plugins.length; i += batchSize) {
                const batch = plugins.slice(i, i + batchSize);
                const results = await Promise.allSettled(batch.map(p => loadSubPlugin(p, isCustom)));
                results.forEach((r, idx) => { if (r.status === 'fulfilled') ok++; else { fail++; console.error(`🐈‍⬛ [PCM] ❌ ${batch[idx].name}`); } });
                if (i + batchSize < plugins.length) await new Promise(r => setTimeout(r, 800));
            }
            if (plugins.length > 0) showNotification(fail > 0 ? "⚠️" : "✅", t('pluginLoadComplete'), `${t('successLoaded')} ${ok} ${t('plugins')}${fail > 0 ? `, ${fail} ${t('failed')}` : ''}`);
        } finally { isLoadingPlugins = false; }
    }

    async function loadLocalPluginsPhase() {
        if (localLoadStarted) return; localLoadStarted = true;
        await pluginsReady; if (!pluginsLoaded) { localLoadStarted = false; return; }
        let w = 0; while (typeof Player === 'undefined' && w < 15 * 60000) { await new Promise(r => setTimeout(r, 1000)); w += 1000; }
        if (typeof Player === 'undefined') { localLoadStarted = false; return; }
        await runPluginBatch(subPlugins.filter(p => isPluginEnabled(p)));
    }

    async function loadAccountPluginsPhase() {
        if (accountLoadStarted) return; accountLoadStarted = true;
        await pluginsReady; if (!pluginsLoaded) { accountLoadStarted = false; return; }
        let w = 0; while (!Player?.AccountName && w < 15 * 60000) { await new Promise(r => setTimeout(r, 1000)); w += 1000; }
        if (!Player?.AccountName) { accountLoadStarted = false; return; }
        accountPluginSettings = loadAccountSettings();
        await runPluginBatch(subPlugins.filter(p => isPluginEnabledInAccount(p) && !loadedPlugins.has(p.id)));
    }

    async function loadCustomPluginsPhase() {
        if (customLoadStarted) return; customLoadStarted = true;
        while (isLoadingPlugins) await new Promise(r => setTimeout(r, 500));
        const enabled = customPlugins.filter(p => p.enabled);
        if (enabled.length) await runPluginBatch(enabled, true);
    }

    // === UI 狀態 ================================================

    let currentUIState = null;
    let searchQuery    = '';
    let filterMode     = 'all';    // 'all' | 'enabled' | 'disabled'
    let isCustomEditMode = false;
    let activeTab      = 'local';
    let _docClickHandler = null;
    let lastDetectedLanguage = null;

    // === 篩選 ===================================================

    function applyFilter() {
        const q = searchQuery.toLowerCase().trim();
        ['local', 'account', 'custom'].forEach(src => {
            const container = document.getElementById(`bc-plugin-content-${src}`);
            if (!container) return;
            container.querySelectorAll('.bc-plugin-item[data-plugin-id]').forEach(item => {
                const id = item.getAttribute('data-plugin-id');
                const plugin = src === 'custom' ? customPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
                if (!plugin) return;

                let pass = true;
                if (filterMode === 'enabled')  pass = src === 'account' ? isPluginEnabledInAccount(plugin) : (src === 'custom' ? plugin.enabled : isPluginEnabled(plugin));
                if (filterMode === 'disabled') pass = !(src === 'account' ? isPluginEnabledInAccount(plugin) : (src === 'custom' ? plugin.enabled : isPluginEnabled(plugin)));

                if (pass && q) {
                    pass = [plugin.id, plugin.name, plugin.en_name, plugin.description, plugin.en_description]
                        .some(s => s && String(s).toLowerCase().includes(q));
                }
                item.style.display = pass ? '' : 'none';
            });
        });
    }

    // === UI 顯示判斷 ============================================

    function getCurrentViewingCharacter() {
        const now = Date.now();
        if (now - lastCharacterCheck < CHARACTER_CACHE_TIME && cachedViewingCharacter !== null) return cachedViewingCharacter;
        try {
            let c = null;
            if (typeof InformationSheetCharacter !== 'undefined' && InformationSheetCharacter) c = InformationSheetCharacter;
            else if (typeof InformationSheetSelection !== 'undefined' && InformationSheetSelection !== null && typeof InformationSheetSelection === 'object') {
                if (InformationSheetSelection.MemberNumber && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) c = ChatRoomCharacter.find(x => x.MemberNumber === InformationSheetSelection.MemberNumber);
                else if (InformationSheetSelection.Name) c = InformationSheetSelection;
            } else if (typeof InformationSheetSelection === 'number' && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                c = ChatRoomCharacter.find(x => x.MemberNumber === InformationSheetSelection);
            }
            if (!c) c = Player;
            cachedViewingCharacter = c; lastCharacterCheck = now; return c;
        } catch(e) { return Player; }
    }

    function shouldShowUI() {
        const isLogin = window.location.href.includes('/login') || window.location.href.includes('Login.html');
        if (isLogin) return true;
        if (typeof Player === 'undefined' || !Player.Name) return true;
        if (typeof CurrentScreen !== 'undefined') {
            if (CurrentScreen === 'InformationSheet') {
                if (window.bcx?.inBcxSubscreen?.() || window.LITTLISH_CLUB?.inModSubscreen?.() || window.MPA?.menuLoaded || window.LSCG_REMOTE_WINDOW_OPEN) return false;
                const vc = getCurrentViewingCharacter();
                return vc && vc.MemberNumber === Player.MemberNumber;
            }
            if (CurrentScreen === 'Preference') { return !(window.bcx?.inBcxSubscreen?.() || window.MPA?.menuLoaded || window.LITTLISH_CLUB?.inModSubscreen?.()); }
            if (['Login', 'Character', 'MainHall', 'Introduction'].includes(CurrentScreen)) return true;
        }
        return false;
    }

    // === Changelog Modal ========================================

    function showChangelogModal() {
        const existing = document.getElementById("pcm-changelog-modal");
        if (existing) { existing.remove(); return; }
        const overlay = document.createElement("div");
        overlay.id = "pcm-changelog-modal";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:'Noto Sans TC',sans-serif;color:#fff;";
        const log = isCJK() ? (remoteChangelogTW.length ? remoteChangelogTW : remoteChangelogEN) : (remoteChangelogEN.length ? remoteChangelogEN : remoteChangelogTW);
        const items = (log.length ? log : ["..."]).map(c => `<li style="margin:6px 0;font-size:13px;color:#d4c8f5;">${c}</li>`).join('');
        box.innerHTML = `<div style="font-size:16px;font-weight:600;margin-bottom:4px;">${t('changelogTitle')}</div><div style="font-size:12px;color:#a0a9c0;margin-bottom:16px;">v${remoteVersion}</div><ul style="padding-left:18px;margin:0 0 20px;list-style:disc;">${items}</ul><button id="pcm-cl-close" style="width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:14px;cursor:pointer;font-family:inherit;">${t('changelogClose')}</button>`;
        overlay.appendChild(box); document.body.appendChild(overlay);
        document.getElementById("pcm-cl-close").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    }

    // === Styles =================================================

    function injectStyles() {
        if (document.getElementById("bc-plugin-styles")) return;
        const style = document.createElement("style");
        style.id = "bc-plugin-styles";
        style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&display=swap');
        .bc-plugin-container *,.bc-plugin-panel *,.bc-plugin-btn-group * { font-family:'Noto Sans TC',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; user-select:none; -webkit-user-select:none; }

        .bc-plugin-btn-group { position:fixed; top:60px; right:20px; display:flex; flex-direction:column; align-items:center; gap:8px; z-index:2147483647; touch-action:none; }

        .bc-plugin-floating-btn { width:60px; height:60px; background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 50%,#C4B5FD 100%); border:none; border-radius:50%; cursor:grab; box-shadow:0 6px 20px rgba(127,83,205,0.3); transition:box-shadow .3s,background .3s; font-size:24px; display:flex; align-items:center; justify-content:center; animation:pcm-float 3s ease-in-out infinite; }
        .bc-plugin-floating-btn:active { cursor:grabbing; }
        .bc-plugin-floating-btn:hover { box-shadow:0 8px 25px rgba(127,83,205,0.4); background:linear-gradient(135deg,#6B46B2 0%,#9577E3 50%,#B7A3F5 100%); }
        .bc-plugin-floating-btn img { width:48px; height:48px; border-radius:50%; transform:scaleX(-1); pointer-events:none; }

        .bc-plugin-changelog-btn, #bc-plugin-refresh-btn { width:60px; height:60px; background:rgba(26,32,46,0.9); border:1px solid rgba(127,83,205,0.4); border-radius:50%; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.2); transition:all .3s ease; font-size:22px; display:flex; align-items:center; justify-content:center; }
        .bc-plugin-changelog-btn:hover, #bc-plugin-refresh-btn:hover { background:rgba(127,83,205,0.3); border-color:rgba(127,83,205,0.8); transform:scale(1.05); }
        #bc-plugin-refresh-btn.spinning { animation:pcm-spin .8s linear infinite; border-color:rgba(127,83,205,0.8); background:rgba(127,83,205,0.2); }

        @keyframes pcm-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pcm-spin  { to{transform:rotate(360deg)} }

        .bc-plugin-panel { position:fixed; top:20px; right:auto; left:auto; width:380px; max-width:calc(100vw - 20px); max-height:calc(100vh - 120px); min-height:300px; background:rgba(26,32,46,0.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:20px; z-index:2147483646; overflow:hidden; display:flex; flex-direction:column; transform:translateX(420px) scale(0.8); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s cubic-bezier(.34,1.56,.64,1),visibility 0s linear .4s; box-shadow:0 20px 40px rgba(0,0,0,0.3); visibility:hidden; pointer-events:none; }
        .bc-plugin-panel.show { transform:translateX(0) scale(1); opacity:1; visibility:visible; pointer-events:auto; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s cubic-bezier(.34,1.56,.64,1); }
        .bc-plugin-panel.hidden, .bc-plugin-btn-group.hidden { display:none !important; }

        .bc-plugin-header { background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 100%); padding:10px; color:#fff; text-align:center; position:relative; overflow:hidden; flex-shrink:0; }
        .bc-plugin-header::before { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%; background:linear-gradient(to right,transparent,rgba(255,255,255,.22),transparent); animation:pcm-glow 2.2s ease-in-out infinite; }
        @keyframes pcm-glow { 0%{left:-60%} 100%{left:115%} }
        .bc-plugin-title { font-size:16px; font-weight:600; margin:0; position:relative; z-index:1; }

        .bc-plugin-tabs { display:flex; flex-shrink:0; background:rgba(0,0,0,0.25); border-bottom:1px solid rgba(255,255,255,0.07); }
        .bc-plugin-tab { flex:1; padding:8px 4px; background:none; border:none; border-bottom:2px solid transparent; color:rgba(255,255,255,.45); cursor:pointer; font-size:12px; font-weight:500; font-family:inherit; transition:all .2s ease; letter-spacing:.3px; }
        .bc-plugin-tab:hover:not(.active) { color:rgba(255,255,255,.75); background:rgba(255,255,255,.04); }
        .bc-plugin-tab.active { color:#fff; border-bottom-color:#A78BFA; }

        .bc-plugin-search-row { display:flex; align-items:center; gap:6px; padding:8px 12px; background:rgba(0,0,0,0.15); border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
        .bc-plugin-search { flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:5px 10px; color:#fff; font-size:12px; font-family:inherit; outline:none; transition:border-color .2s; }
        .bc-plugin-search:focus { border-color:rgba(167,139,250,0.6); }
        .bc-plugin-search::placeholder { color:rgba(255,255,255,0.35); }
        .bc-plugin-filter-btn, .bc-plugin-gear-btn { width:28px; height:28px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:8px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; color:#fff; }
        .bc-plugin-filter-btn:hover, .bc-plugin-gear-btn:hover { background:rgba(127,83,205,0.3); border-color:rgba(167,139,250,0.5); }
        .bc-plugin-gear-btn.active { background:rgba(127,83,205,0.4); border-color:#A78BFA; }

        .bc-plugin-content { padding:12px; flex:1 1 auto; overflow-y:auto; overflow-x:hidden; max-height:400px; min-height:200px; scrollbar-width:thin; scrollbar-color:rgba(127,83,205,0.8) rgba(255,255,255,0.1); -webkit-overflow-scrolling:touch; }
        .bc-plugin-content::-webkit-scrollbar { width:6px; }
        .bc-plugin-content::-webkit-scrollbar-track { background:rgba(255,255,255,0.05); border-radius:3px; }
        .bc-plugin-content::-webkit-scrollbar-thumb { background:linear-gradient(135deg,#7F53CD,#A78BFA); border-radius:3px; }

        .bc-plugin-footer { background:rgba(255,255,255,0.02); padding:10px 20px; text-align:center; color:#a0a9c0; font-size:11px; border-top:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
        .bc-plugin-footer-link { color:#C4B5FD; text-decoration:none; transition:color .2s; cursor:pointer; }
        .bc-plugin-footer-link:hover { color:#fff; text-decoration:underline; }

        .bc-plugin-item { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:10px; padding:14px; transition:all .3s ease; position:relative; overflow:hidden; }
        .bc-plugin-item.enabled { background:rgba(127,83,205,0.1); border-color:rgba(127,83,205,0.3); }
        .bc-plugin-item.enabled::before { content:''; position:absolute; top:0; left:0; width:0; height:0; border-left:20px solid #7F53CD; border-bottom:20px solid transparent; z-index:1; }
        .bc-plugin-item.beta-enabled { background:rgba(205,128,53,0.1); border-color:rgba(205,128,53,0.35); }
        .bc-plugin-item.beta-enabled::before { content:''; position:absolute; top:0; left:0; width:0; height:0; border-left:20px solid #CD8035; border-bottom:20px solid transparent; z-index:1; }
        .bc-plugin-item.failed { border-color:rgba(255,80,80,0.4); background:rgba(255,50,50,0.06); }
        .bc-plugin-item:hover { background:rgba(255,255,255,0.08); border-color:rgba(127,83,205,0.3); transform:translateY(-2px); box-shadow:0 8px 20px rgba(127,83,205,0.15); }
        .bc-plugin-item-header { display:flex; align-items:center; position:relative; }
        .bc-plugin-icon { font-size:22px; margin-right:10px; display:flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,0.1); flex-shrink:0; }
        .bc-plugin-icon img { width:22px; height:22px; border-radius:4px; }
        .bc-plugin-info { flex:1; color:#fff; min-width:0; }
        .bc-plugin-name { font-size:13px; font-weight:500; margin:0; color:#fff; }
        .bc-plugin-desc { font-size:11px; color:#a0a9c0; margin:3px 0 0; line-height:1.4; }

        .bc-plugin-info-btn { position:absolute; bottom:0; right:0; width:28px; height:28px; cursor:pointer; text-decoration:none; z-index:2; border-radius:0 0 12px 0; }
        .bc-plugin-info-btn::before { content:''; position:absolute; bottom:0; right:0; width:0; height:0; border-style:solid; border-width:0 0 28px 28px; border-color:transparent transparent rgba(255,255,255,0.08) transparent; transition:border-color .2s; }
        .bc-plugin-item.enabled .bc-plugin-info-btn::before { border-color:transparent transparent rgba(127,83,205,0.4) transparent; }
        .bc-plugin-info-btn::after { content:'🔗'; position:absolute; bottom:3px; right:3px; font-size:8px; opacity:.6; transition:opacity .2s; }
        .bc-plugin-info-btn:hover::after { opacity:1; }

        .bc-plugin-toggle { position:relative; width:48px; height:24px; background:rgba(255,255,255,0.2); border-radius:12px; cursor:pointer; transition:all .3s ease; border:none; outline:none; flex-shrink:0; margin-left:8px; }
        .bc-plugin-toggle.active { background:linear-gradient(135deg,#7F53CD,#A78BFA); }
        .bc-plugin-toggle::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px; background:#fff; border-radius:50%; transition:all .3s cubic-bezier(.25,.46,.45,.94); box-shadow:0 2px 6px rgba(0,0,0,0.2); }
        .bc-plugin-toggle.active::after { left:26px; }

        .bc-plugin-toggle-tri { position:relative; width:84px; height:24px; background:rgba(255,255,255,0.12); border-radius:12px; cursor:pointer; border:1px solid rgba(255,255,255,0.15); outline:none; display:flex; align-items:center; padding:0; overflow:hidden; flex-shrink:0; transition:border-color .3s; margin-left:8px; }
        .bc-plugin-toggle-tri:hover { border-color:rgba(196,181,253,0.4); }
        .bc-plugin-toggle-tri-track { position:absolute; top:2px; width:27px; height:20px; border-radius:10px; transition:left .3s cubic-bezier(.25,.46,.45,.94),background .3s; left:2px; background:rgba(255,255,255,.35); }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-track { left:29px; background:linear-gradient(135deg,#7F53CD,#A78BFA); }
        .bc-plugin-toggle-tri[data-state="beta"]   .bc-plugin-toggle-tri-track { left:55px; background:linear-gradient(135deg,#CD8035,#FAB87A); }
        .bc-plugin-toggle-tri-labels { position:relative; z-index:1; display:flex; width:100%; justify-content:space-around; align-items:center; height:100%; }
        .bc-plugin-toggle-tri-label { font-size:8px; font-weight:600; color:rgba(255,255,255,.45); width:28px; text-align:center; transition:color .3s; user-select:none; pointer-events:none; }
        .bc-plugin-toggle-tri[data-state="off"]    .bc-plugin-toggle-tri-label:nth-child(1) { color:rgba(255,255,255,.85); }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-label:nth-child(2) { color:#fff; }
        .bc-plugin-toggle-tri[data-state="beta"]   .bc-plugin-toggle-tri-label:nth-child(3) { color:#fff; }

        .bc-plugin-retry-btn { position:absolute; top:8px; right:8px; width:26px; height:26px; background:rgba(255,80,80,0.2); border:1px solid rgba(255,80,80,0.4); border-radius:50%; cursor:pointer; font-size:14px; color:#ff8080; display:flex; align-items:center; justify-content:center; transition:all .2s; z-index:3; padding:0; }
        .bc-plugin-retry-btn:hover { background:rgba(255,80,80,0.4); color:#fff; transform:rotate(180deg); }

        .bc-plugin-delete-btn { position:absolute; inset:0; width:100%; height:100%; background:rgba(20,10,10,0.55); border:none; border-radius:12px; cursor:pointer; font-size:22px; color:#ff8080; display:flex; align-items:center; justify-content:center; transition:background .2s; z-index:4; padding:0; }
        .bc-plugin-delete-btn:hover { background:rgba(180,30,30,0.65); }

        .bc-plugin-add-item { display:flex; align-items:center; justify-content:center; min-height:60px; cursor:pointer; background:rgba(127,83,205,0.05); border:1px dashed rgba(127,83,205,0.3); }
        .bc-plugin-add-item:hover { background:rgba(127,83,205,0.12); border-color:rgba(167,139,250,0.5); }
        .bc-plugin-add-icon { font-size:28px; opacity:.6; transition:opacity .2s; }
        .bc-plugin-add-item:hover .bc-plugin-add-icon { opacity:1; }

        .bc-plugin-loading { text-align:center; padding:40px 20px; color:#a0a9c0; font-size:14px; }
        .bc-plugin-loading::after { content:''; display:block; width:28px; height:28px; margin:14px auto 0; border:3px solid rgba(127,83,205,0.3); border-top-color:#A78BFA; border-radius:50%; animation:pcm-spin .8s linear infinite; }
        .bc-plugin-empty { text-align:center; padding:32px 20px; color:#a0a9c0; font-size:13px; line-height:1.8; white-space:pre-wrap; }

        .bc-plugin-account-locked { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:#a0a9c0; font-size:13px; text-align:center; line-height:1.8; white-space:pre-wrap; }

        .bc-liko-toggle-notification { position:fixed; box-sizing:border-box; background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 100%); color:#fff; padding:10px 14px; border-radius:10px; box-shadow:0 8px 20px rgba(127,83,205,0.25); z-index:2147483645; font-family:'Noto Sans TC',sans-serif; font-size:13px; transform:translateY(-6px); opacity:0; transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .3s ease; pointer-events:none; user-select:none; }
        .bc-liko-toggle-notification.show { transform:translateY(0); opacity:1; }
        .bc-liko-toggle-notification.hide { transform:translateY(-6px); opacity:0; }

        .bc-liko-system-notification { position:fixed; top:20px; right:20px; background:rgba(26,32,46,0.95); border:1px solid rgba(127,83,205,0.4); color:#fff; padding:12px 16px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.3); z-index:2147483648; font-family:'Noto Sans TC',sans-serif; font-size:13px; max-width:280px; transform:translateX(320px); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s ease; user-select:none; cursor:pointer; pointer-events:auto; }
        .bc-liko-system-notification.show { transform:translateX(0); opacity:1; }
        .bc-liko-system-notification.hide { transform:translateX(320px); opacity:0; }

        @media (max-width:480px) { .bc-plugin-btn-group{right:10px;top:40px;} }
        @media (max-height:600px) { .bc-plugin-content{max-height:160px;} }
        `;
        document.head.appendChild(style);
    }

    // === Plugin Item ============================================

    function buildPluginItem(plugin, source = 'local') {
        const item = document.createElement("div");
        const isTri = isTriStatePlugin(plugin);
        let currentState, isEnabled, isBeta;

        if (source === 'account') { currentState = isTri ? (accountPluginSettings[plugin.id] || "off") : null; isEnabled = isPluginEnabledInAccount(plugin); }
        else { currentState = isTri ? (plugin.state || "off") : null; isEnabled = source === 'custom' ? plugin.enabled : isPluginEnabled(plugin); }
        isBeta = isTri && currentState === "beta";

        item.className = `bc-plugin-item${isEnabled && !isBeta ? ' enabled' : ''}${isBeta ? ' beta-enabled' : ''}${failedPlugins.has(plugin.id) ? ' failed' : ''}`;
        item.setAttribute('data-plugin-id', plugin.id);

        const iconHtml = plugin.customIcon
            ? `<img src="${plugin.customIcon}" alt="" />`
            : (plugin.icon?.startsWith('http') ? `<img src="${plugin.icon}" alt="" />` : (plugin.icon || '🔌'));

        const infoBtnHtml = plugin.website
            ? `<a class="bc-plugin-info-btn" href="${plugin.website}" target="_blank" rel="noopener noreferrer" title="${t('visitWebsite')}"></a>`
            : '';

        const toggleHtml = isTri
            ? (() => { const labels = getTriLabels(plugin); return `<button class="bc-plugin-toggle-tri" data-plugin-tri="${plugin.id}" data-source="${source}" data-state="${currentState}"><div class="bc-plugin-toggle-tri-track"></div><div class="bc-plugin-toggle-tri-labels"><span class="bc-plugin-toggle-tri-label">${labels[0]}</span><span class="bc-plugin-toggle-tri-label">${labels[1]}</span><span class="bc-plugin-toggle-tri-label">${labels[2]}</span></div></button>`; })()
            : `<button class="bc-plugin-toggle${isEnabled ? ' active' : ''}" data-plugin="${plugin.id}" data-source="${source}"></button>`;

        item.innerHTML = `${infoBtnHtml}<div class="bc-plugin-item-header"><div class="bc-plugin-icon">${iconHtml}</div><div class="bc-plugin-info"><h4 class="bc-plugin-name">${getPluginName(plugin)}</h4><p class="bc-plugin-desc">${getPluginDescription(plugin)}</p></div>${toggleHtml}</div>`;

        if (failedPlugins.has(plugin.id)) showPluginRetryBtn(plugin.id); // re-attach if rebuilding

        return item;
    }

    function buildAccountContent(container) {
        container.innerHTML = '';
        if (!Player?.AccountName) { container.innerHTML = `<div class="bc-plugin-account-locked">${t('accountNotLoggedIn')}</div>`; return; }
        if (!pluginsLoaded) { container.innerHTML = `<div class="bc-plugin-loading">${t('loadingPlugins')}</div>`; return; }
        subPlugins.forEach(p => container.appendChild(buildPluginItem(p, 'account')));
    }

    function buildCustomContent(container) {
        container.innerHTML = '';
        if (isCustomEditMode) container.appendChild(buildAddItem());
        if (!customPlugins.length) {
            const hint = document.createElement('div');
            hint.className = 'bc-plugin-empty';
            hint.textContent = t('customEmptyHint');
            container.appendChild(hint);
            return;
        }
        customPlugins.forEach(p => container.appendChild(buildCustomPluginItem(p)));
    }

    function buildAddItem() {
        const item = document.createElement('div');
        item.className = 'bc-plugin-item bc-plugin-add-item';
        item.innerHTML = '<div class="bc-plugin-add-icon">➕</div>';
        item.addEventListener('click', showAddPluginPanel);
        return item;
    }

    function buildCustomPluginItem(plugin) {
        const item = buildPluginItem(plugin, 'custom');
        if (isCustomEditMode) {
            const btn = document.createElement('button');
            btn.className = 'bc-plugin-delete-btn';
            btn.innerHTML = '❌';
            btn.title = t('customDeleteConfirm', { name: getPluginName(plugin) });
            btn.setAttribute('data-delete-id', plugin.id);
            item.appendChild(btn);
        }
        return item;
    }

    // === Add Plugin Panel =======================================

    function showAddPluginPanel() {
        if (document.getElementById('pcm-add-panel')) return;
        const overlay = document.createElement('div');
        overlay.id = 'pcm-add-panel';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:20px;width:320px;max-width:90vw;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:\'Noto Sans TC\',sans-serif;color:#fff;';

        const fieldStyle = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:12px;font-family:inherit;outline:none;margin-bottom:10px;';

        box.innerHTML = `
            <div style="font-size:15px;font-weight:600;margin-bottom:14px;">${t('customAddTitle')}</div>
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${t('customFieldName')}</label>
            <input id="pcm-add-name" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${t('customFieldUrl')}</label>
            <input id="pcm-add-url"  type="text" style="${fieldStyle}" autocomplete="off" placeholder="https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${t('customFieldIcon')}</label>
            <input id="pcm-add-icon" type="text" style="${fieldStyle}" autocomplete="off" placeholder="🔌 / https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${t('customFieldDesc')}</label>
            <input id="pcm-add-desc" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${t('customFieldType')}</label>
            <select id="pcm-add-type" style="${fieldStyle.replace('margin-bottom:10px','margin-bottom:14px')}">
                <option value="eval">${t('customTypeEval')}</option>
                <option value="scr">${t('customTypeScr')}</option>
                <option value="mod">${t('customTypeMod')}</option>
            </select>
            <div style="display:flex;gap:8px;">
                <button id="pcm-add-cancel" style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${t('customBtnCancel')}</button>
                <button id="pcm-add-confirm" style="flex:1;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${t('customBtnAdd')}</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const nameInput    = overlay.querySelector('#pcm-add-name');
        const urlInput     = overlay.querySelector('#pcm-add-url');
        const iconInput    = overlay.querySelector('#pcm-add-icon');
        const descInput    = overlay.querySelector('#pcm-add-desc');
        const typeSelect   = overlay.querySelector('#pcm-add-type');
        const cancelBtn    = overlay.querySelector('#pcm-add-cancel');
        const confirmBtn   = overlay.querySelector('#pcm-add-confirm');
        nameInput.focus();

        const close = () => overlay.remove();
        cancelBtn.addEventListener('click', e => { e.stopPropagation(); close(); });
        // stopPropagation prevents _docClickHandler from closing the main panel
        overlay.addEventListener('click', e => { e.stopPropagation(); if (e.target === overlay) close(); });

        confirmBtn.addEventListener('click', e => {
            e.stopPropagation();
            const name = nameInput.value.trim();
            const url  = urlInput.value.trim();
            const icon = iconInput.value.trim();
            const desc = descInput.value.trim();

            if (!name) { showNotification("⚠️", "PCM", t('customNameRequired')); return; }
            if (!url.endsWith('.js')) { showNotification("⚠️", "PCM", t('customUrlInvalid')); return; }

            const type = typeSelect.value; // 'eval' | 'scr' | 'mod'
            const plugin = { id: 'custom_' + Date.now(), name, en_name: name, url, icon: icon || '🔌', description: desc, en_description: desc, enabled: false, type };
            customPlugins.push(plugin);
            saveCustomPlugins();

            const container = document.getElementById('bc-plugin-content-custom');
            if (container) buildCustomContent(container);
            applyFilter();
            close();
            showNotification("✅", "PCM", t('customAdded', { name }));
        });
    }

    function showDeleteConfirm(pluginId) {
        const plugin = customPlugins.find(p => p.id === pluginId);
        if (!plugin) return;
        if (document.getElementById('pcm-delete-panel')) return;

        const overlay = document.createElement('div');
        overlay.id = 'pcm-delete-panel';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:rgba(26,32,46,0.98);border:1px solid rgba(255,80,80,0.3);border-radius:14px;padding:20px;width:280px;max-width:90vw;font-family:\'Noto Sans TC\',sans-serif;color:#fff;text-align:center;';
        box.innerHTML = `
            <div style="font-size:14px;margin-bottom:16px;line-height:1.5;">${t('customDeleteConfirm', { name: plugin.name })}</div>
            <div style="display:flex;gap:8px;">
                <button id="pcm-del-no"  style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${t('customBtnCancel')}</button>
                <button id="pcm-del-yes" style="flex:1;padding:9px;border:none;border-radius:8px;background:rgba(200,50,50,0.7);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${t('customDeleteYes')}</button>
            </div>
        `;
        overlay.appendChild(box); document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#pcm-del-no').addEventListener('click', e => { e.stopPropagation(); close(); });
        overlay.addEventListener('click', e => { e.stopPropagation(); if (e.target === overlay) close(); });
        overlay.querySelector('#pcm-del-yes').addEventListener('click', e => {
            e.stopPropagation();
            const name = plugin.name;
            customPlugins = customPlugins.filter(p => p.id !== pluginId);
            saveCustomPlugins();
            loadedPlugins.delete(pluginId);
            const container = document.getElementById('bc-plugin-content-custom');
            if (container) buildCustomContent(container);
            applyFilter();
            close();
            showNotification("🗑️", "PCM", t('customDeleted', { name }));
        });
    }

    // === Toggle Handler =========================================

    function handlePluginToggle(e) {
        if (e.target.closest('.bc-plugin-info-btn')) { e.stopPropagation(); return; }

        // Retry button
        const retryBtn = e.target.closest('.bc-plugin-retry-btn');
        if (retryBtn) {
            const id = retryBtn.getAttribute('data-retry-id');
            const isCustom = !!customPlugins.find(p => p.id === id);
            const plugin = isCustom ? customPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
            if (!plugin) return;
            failedPlugins.delete(id);
            hidePluginRetryBtn(id);
            loadSubPlugin(plugin, isCustom).catch(() => {});
            return;
        }

        // Delete button
        const delBtn = e.target.closest('.bc-plugin-delete-btn');
        if (delBtn) { showDeleteConfirm(delBtn.getAttribute('data-delete-id')); return; }

        // Normal toggle
        const toggle = e.target.closest('.bc-plugin-toggle');
        if (toggle) {
            const id = toggle.getAttribute('data-plugin');
            const src = toggle.getAttribute('data-source') || 'local';
            const plugin = src === 'custom' ? customPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
            if (!plugin) return;

            if (src === 'account') {
                const newVal = !isPluginEnabledInAccount(plugin);
                if (newVal) accountPluginSettings[id] = 1; else delete accountPluginSettings[id];
                saveAccountSettings();
                toggle.classList.toggle('active', newVal);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', newVal);
                showToggleNotification(newVal ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${newVal ? t('pluginEnabled') : t('pluginDisabled')}`, newVal ? t('willTakeEffect') : t('willNotStart'));
                if (newVal && !loadedPlugins.has(id) && typeof Player !== 'undefined') loadSubPlugin(plugin);
            } else if (src === 'custom') {
                plugin.enabled = !plugin.enabled; saveCustomPlugins();
                toggle.classList.toggle('active', plugin.enabled);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', plugin.enabled);
                showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${plugin.name} ${plugin.enabled ? t('pluginEnabled') : t('pluginDisabled')}`, plugin.enabled ? t('willTakeEffect') : t('willNotStart'));
                if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, true).catch(() => {});
            } else {
                plugin.enabled = !plugin.enabled;
                pluginSettings[id] = plugin.enabled; saveSettings(pluginSettings);
                toggle.classList.toggle('active', plugin.enabled);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', plugin.enabled);
                showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${plugin.enabled ? t('pluginEnabled') : t('pluginDisabled')}`, plugin.enabled ? t('willTakeEffect') : t('willNotStart'));
                if (plugin.enabled && !loadedPlugins.has(id) && typeof Player !== 'undefined') loadSubPlugin(plugin);
            }
            return;
        }

        // Tri-state toggle
        const tri = e.target.closest('.bc-plugin-toggle-tri');
        if (tri) {
            const id = tri.getAttribute('data-plugin-tri');
            const src = tri.getAttribute('data-source') || 'local';
            const plugin = subPlugins.find(p => p.id === id);
            if (!plugin || !isTriStatePlugin(plugin)) return;

            const cur  = src === 'account' ? (accountPluginSettings[id] || "off") : (plugin.state || "off");
            const next = cycleTriState(cur);

            if (src === 'account') { if (next === "off") delete accountPluginSettings[id]; else accountPluginSettings[id] = next; saveAccountSettings(); }
            else { plugin.state = next; pluginSettings[id] = next; saveSettings(pluginSettings); }

            tri.setAttribute('data-state', next);
            const item = tri.closest('.bc-plugin-item');
            item.classList.remove('enabled', 'beta-enabled');
            if (next === 'stable') item.classList.add('enabled');
            if (next === 'beta')   item.classList.add('beta-enabled');

            const labels = getTriLabels(plugin);
            showToggleNotification(next === 'off' ? "🐾" : next === 'stable' ? "🐈‍⬛" : "🧪",
                next === 'off' ? `${getPluginName(plugin)} ${t('pluginDisabled')}` : `${getPluginName(plugin)} ${labels[next === 'stable' ? 1 : 2]} ${t('pluginEnabled')}`,
                next === 'off' ? t('willNotStart') : t('willTakeEffect'));
            if (next !== 'off' && !loadedPlugins.has(id) && typeof Player !== 'undefined') loadSubPlugin(plugin);
        }
    }

    // === Draggable ==============================================

    function makeDraggable(el) {
        let startX, startY, startL, startT, dragging = false;

        el.addEventListener('mousedown', e => {
            if (e.button !== 0 || e.target.closest('button, a')) return;
            const rect = el.getBoundingClientRect();
            startX = e.clientX; startY = e.clientY;
            startL = rect.left;  startT = rect.top;
            dragging = false;
            e.preventDefault();

            const onMove = mv => {
                const dx = mv.clientX - startX, dy = mv.clientY - startY;
                if (!dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
                dragging = true;
                el.style.right = 'auto';
                el.style.animation = 'none';
                el.style.left = Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  startL + dx)) + 'px';
                el.style.top  = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startT + dy)) + 'px';
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup',   onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });
    }

    // === Create Manager UI =====================================

    function applyFloatingBtnVisibility() {
        const g = document.getElementById("bc-plugin-btn-group");
        if (!g) return;
        g.style.display = (!shouldShowUI() || !accountFloatingBtnVisible) ? 'none' : '';
    }

    function createManagerUI() {
        const show = shouldShowUI();
        const eg   = document.getElementById("bc-plugin-btn-group");
        const ep   = document.getElementById("bc-plugin-panel");
        if (currentUIState === show) return;
        currentUIState = show;

        if (!show) {
            cachedViewingCharacter = null; lastCharacterCheck = 0;
            if (eg) eg.style.display = 'none';
            if (ep) { ep.style.display = 'none'; ep.classList.remove('show'); }
            return;
        }
        if (eg && ep) { eg.style.display = ''; ep.style.display = ''; applyFloatingBtnVisibility(); return; }
        if (eg) eg.remove(); if (ep) ep.remove();

        injectStyles();

        // ── Button Group ──
        const btnGroup = document.createElement('div');
        btnGroup.id = 'bc-plugin-btn-group';
        btnGroup.className = 'bc-plugin-btn-group';

        const floatBtn = document.createElement('button');
        floatBtn.className = 'bc-plugin-floating-btn';
        floatBtn.innerHTML = `<img src="https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png" alt="🐱" />`;
        floatBtn.title = t('welcomeTitle');

        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'bc-plugin-refresh-btn';
        refreshBtn.className = 'bc-plugin-refresh-btn'; // kept for CSS fallback
        refreshBtn.innerHTML = '↻';
        refreshBtn.title = t('refreshTitle');
        refreshBtn.style.display = 'none';

        const changelogBtn = document.createElement('button');
        changelogBtn.className = 'bc-plugin-changelog-btn';
        changelogBtn.innerHTML = '📋';
        changelogBtn.title = t('changelogTitle');
        changelogBtn.style.display = 'none';

        btnGroup.append(floatBtn, refreshBtn, changelogBtn);
        document.body.appendChild(btnGroup);
        makeDraggable(btnGroup);
        applyFloatingBtnVisibility();

        // ── Panel ──
        const panel = document.createElement('div');
        panel.id = 'bc-plugin-panel';
        panel.className = 'bc-plugin-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'bc-plugin-header';
        header.innerHTML = `<h3 class="bc-plugin-title">${t('welcomeTitle')}</h3>`;

        // Tabs
        const tabsBar = document.createElement('div');
        tabsBar.className = 'bc-plugin-tabs';
        const tabs = {
            local:   document.createElement('button'),
            account: document.createElement('button'),
            custom:  document.createElement('button'),
        };
        tabs.local.className   = 'bc-plugin-tab active';
        tabs.account.className = 'bc-plugin-tab';
        tabs.custom.className  = 'bc-plugin-tab';
        tabs.local.textContent   = t('tabLocal');
        tabs.account.textContent = t('tabAccount');
        tabs.custom.textContent  = t('tabCustom');
        tabsBar.append(tabs.local, tabs.account, tabs.custom);

        // Search row
        const searchRow = document.createElement('div');
        searchRow.className = 'bc-plugin-search-row';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'bc-plugin-search';
        searchInput.placeholder = t('searchPlaceholder');
        const filterBtn = document.createElement('button');
        filterBtn.className = 'bc-plugin-filter-btn';
        filterBtn.title = t('filterAll');
        filterBtn.textContent = '☰';
        const gearBtn = document.createElement('button');
        gearBtn.className = 'bc-plugin-gear-btn';
        gearBtn.textContent = '⚙';
        gearBtn.style.display = 'none';
        searchRow.append(searchInput, filterBtn, gearBtn);

        // Contents
        const contentLocal = document.createElement('div');
        contentLocal.id = 'bc-plugin-content-local';
        contentLocal.className = 'bc-plugin-content';
        if (!pluginsLoaded) contentLocal.innerHTML = `<div class="bc-plugin-loading">${t('loadingPlugins')}</div>`;
        else subPlugins.forEach(p => contentLocal.appendChild(buildPluginItem(p, 'local')));

        const contentAccount = document.createElement('div');
        contentAccount.id = 'bc-plugin-content-account';
        contentAccount.className = 'bc-plugin-content';
        contentAccount.style.display = 'none';
        buildAccountContent(contentAccount);

        const contentCustom = document.createElement('div');
        contentCustom.id = 'bc-plugin-content-custom';
        contentCustom.className = 'bc-plugin-content';
        contentCustom.style.display = 'none';
        buildCustomContent(contentCustom);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'bc-plugin-footer';
        footer.innerHTML = `❖ <a class="bc-plugin-footer-link" href="https://awdrrawd.github.io/liko-Plugin-Repository/" target="_blank" rel="noopener noreferrer">Liko Plugin Manager v${MOD_VER}</a> ❖`;

        panel.append(header, tabsBar, searchRow, contentLocal, contentAccount, contentCustom, footer);
        document.body.appendChild(panel);

        let isOpen = false;
        const contents = { local: contentLocal, account: contentAccount, custom: contentCustom };

        const switchTab = (tab) => {
            activeTab = tab;
            Object.keys(tabs).forEach(k => {
                tabs[k].classList.toggle('active', k === tab);
                contents[k].style.display = k === tab ? '' : 'none';
            });
            gearBtn.style.display = tab === 'custom' ? '' : 'none';
            if (tab === 'account') buildAccountContent(contentAccount);
            if (tab === 'custom')  buildCustomContent(contentCustom);
            applyFilter();
        };

        tabs.local.addEventListener('click',   () => switchTab('local'));
        tabs.account.addEventListener('click', () => switchTab('account'));
        tabs.custom.addEventListener('click',  () => switchTab('custom'));

        const filterModes = ['all', 'enabled', 'disabled'];
        filterBtn.addEventListener('click', e => {
            e.stopPropagation();
            filterMode = filterModes[(filterModes.indexOf(filterMode) + 1) % 3];
            applyFilter();
            showToggleNotification('☰', 'PCM', t('filter' + filterMode.charAt(0).toUpperCase() + filterMode.slice(1)));
        });

        gearBtn.addEventListener('click', e => {
            e.stopPropagation();
            isCustomEditMode = !isCustomEditMode;
            gearBtn.classList.toggle('active', isCustomEditMode);
            buildCustomContent(contentCustom);
            applyFilter();
        });

        searchInput.addEventListener('input', () => { searchQuery = searchInput.value; applyFilter(); });

        const resetPanelState = () => {
            searchQuery = ''; filterMode = 'all'; isCustomEditMode = false;
            searchInput.value = ''; gearBtn.classList.remove('active');
            applyFilter();
        };

        floatBtn.addEventListener('click', e => {
            if (e.target !== floatBtn && e.target !== floatBtn.querySelector('img')) return;
            e.preventDefault(); e.stopPropagation();
            isOpen = !isOpen;
            panel.classList.toggle('show', isOpen);
            refreshBtn.style.display   = isOpen ? 'flex' : 'none';
            changelogBtn.style.display = isOpen ? 'flex' : 'none';

            if (isOpen) {
                // Calculate panel position — always clamped within viewport
                const gr     = btnGroup.getBoundingClientRect();
                const vw     = window.innerWidth;
                const vh     = window.innerHeight;
                const pWidth = Math.min(380, vw - 20);
                panel.style.width = pWidth + 'px';

                let left = gr.left - pWidth - 12;
                if (left < 10) left = Math.max(10, (vw - pWidth) / 2);  // center if no room on left
                left = Math.max(10, Math.min(vw - pWidth - 10, left));

                const top = Math.max(10, Math.min(gr.top, vh - 200));
                panel.style.left     = left + 'px';
                panel.style.right    = 'auto';
                panel.style.top      = top + 'px';
                panel.style.maxHeight = (vh - top - 20) + 'px';

                if (pluginsLoaded && contentLocal.querySelector('.bc-plugin-loading')) {
                    contentLocal.innerHTML = ''; subPlugins.forEach(p => contentLocal.appendChild(buildPluginItem(p, 'local')));
                    applyFilter();
                }
            } else {
                resetPanelState();
            }
        });

        refreshBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); refreshPluginList(); });
        changelogBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });

        [contentLocal, contentAccount, contentCustom].forEach(c => c.addEventListener('click', handlePluginToggle));

        if (_docClickHandler) document.removeEventListener('click', _docClickHandler);
        _docClickHandler = e => {
            if (!panel.contains(e.target) && !btnGroup.contains(e.target) && isOpen) {
                isOpen = false; panel.classList.remove('show');
                refreshBtn.style.display = changelogBtn.style.display = 'none';
                resetPanelState();
            }
        };
        document.addEventListener('click', _docClickHandler);
    }

    // === Notifications ==========================================

    let toggleNotifTimer = null;
    function showToggleNotification(icon, title, message) {
        let notif = document.getElementById("pcm-toggle-notif");
        if (notif) { notif.classList.remove('show'); clearTimeout(toggleNotifTimer); }
        else { notif = document.createElement("div"); notif.id = "pcm-toggle-notif"; notif.className = "bc-liko-toggle-notification"; document.body.appendChild(notif); }
        const panel = document.getElementById("bc-plugin-panel");
        if (panel) { const r = panel.getBoundingClientRect(); notif.style.top = (r.bottom + 3) + "px"; notif.style.width = panel.clientWidth + "px"; notif.style.left = r.left + "px"; notif.style.right = "auto"; }
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">${icon}</span><strong style="font-size:12px;">${title}</strong></div><div style="font-size:11px;opacity:.88;">${message}</div>`;
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add('show')));
        toggleNotifTimer = setTimeout(() => { notif.classList.remove('show'); notif.classList.add('hide'); setTimeout(() => notif?.parentNode?.removeChild(notif), 350); }, 2500);
    }

    let systemNotifTimer = null;
    function showNotification(icon, title, message) {
        let notif = document.getElementById("pcm-system-notif");
        if (notif) { notif.classList.remove('show'); notif.classList.add('hide'); clearTimeout(systemNotifTimer); setTimeout(() => _createSystemNotif(icon, title, message), 300); return; }
        _createSystemNotif(icon, title, message);
    }
    function _createSystemNotif(icon, title, message) {
        document.getElementById("pcm-system-notif")?.remove();
        const notif = document.createElement("div");
        notif.id = "pcm-system-notif";
        notif.className = "bc-liko-system-notification";
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">${icon}</span><strong style="font-size:12px;">${title}</strong></div><div style="font-size:11px;opacity:.85;">${message}</div>`;
        document.body.appendChild(notif);
        notif.addEventListener('click', () => { notif.classList.remove('show'); notif.classList.add('hide'); clearTimeout(systemNotifTimer); setTimeout(() => notif?.parentNode?.removeChild(notif), 400); });
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add('show')));
        systemNotifTimer = setTimeout(() => { notif.classList.remove('show'); notif.classList.add('hide'); setTimeout(() => notif?.parentNode?.removeChild(notif), 400); }, 3500);
    }

    // === Language Change ========================================

    function checkLanguageChange() {
        const cur = getLang();
        if (lastDetectedLanguage !== null && lastDetectedLanguage !== cur) {
            const eg = document.getElementById("bc-plugin-btn-group");
            const ep = document.getElementById("bc-plugin-panel");
            if (eg) eg.remove(); if (ep) ep.remove();
            currentUIState = null; createManagerUI();
        }
        lastDetectedLanguage = cur;
    }

    function monitorPageChanges() {
        const id = setInterval(() => checkLanguageChange(), 5000);
        _lifecycle.intervals.push(id);
        createManagerUI();
    }

    // === /pcm 指令 ==============================================

    function handle_PCM_Command(text) {
        const sub = String(text || "").trim().split(/\s+/)[0]?.toLowerCase() || "help";
        const zhMode = isCJK();
        const send = (msg) => { try { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${msg}</font>`, Timeout: 60000 }); } catch(e) {} };
        if (sub === "help" || !sub) {
            send(t('shortLoaded'));
        } else if (sub === "list") {
            let list = "🔌 " + (zhMode ? "可用插件：" : "Available plugins:") + "\n\n";
            subPlugins.forEach(p => {
                const on = isTriStatePlugin(p) ? (p.state !== "off" ? "✅" : "⭕") : (p.enabled ? "✅" : "⭕");
                list += `${on} ${p.icon || ''} ${getPluginName(p)}\n  ${getPluginDescription(p)}\n\n`;
            });
            send(list);
        } else {
            send(zhMode ? "請輸入 /pcm help" : "Type /pcm help");
        }
    }

    function tryRegisterCommand() {
        let n = 0;
        const try_ = () => {
            n++;
            try { if (typeof CommandCombine === "function") { CommandCombine([{ Tag: "pcm", Description: "Liko Plugin Collection Manager", Action: handle_PCM_Command }]); return; } } catch(e) {}
            if (n < 20) setTimeout(try_, 3000);
        };
        try_();
    }

    // === Loaded Message =========================================

    function sendLoadedMessage() {
        const wait = () => new Promise(r => {
            let done = false;
            const check = () => { if (done) return; if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") { done = true; r(true); } else setTimeout(check, 1000); };
            check(); setTimeout(() => { if (!done) { done = true; r(false); } }, 60000);
        });
        wait().then(ok => {
            if (!ok) return;
            try { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${t('shortLoaded')}</font>`, Timeout: 60000 }); showNotification("🐈‍⬛", "PCM", t('loaded', { ver: MOD_VER })); } catch(e) {}
        });
    }

    // === Preference Page ========================================

    async function registerPreferencePage() {
        let n = 0;
        while (typeof PreferenceRegisterExtensionSetting !== 'function' && n < 60) { await new Promise(r => setTimeout(r, 1000)); n++; }
        if (typeof PreferenceRegisterExtensionSetting !== 'function') return;

        window.PreferenceSubscreenPCMSettingsLoad = () => {};
        window.PreferenceSubscreenPCMSettingsRun = () => {
            DrawCharacter(Player, 50, 50, 0.9);
            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");
            MainCanvas.textAlign = "left";
            DrawText(isCJK() ? "- PCM 插件管理器設定 -" : "- PCM Plugin Manager Settings -", 500, 125, "Black", "Gray");
            DrawText(isCJK() ? `📱 本地已啟用：${subPlugins.filter(p => isPluginEnabled(p)).length} 個` : `📱 Local enabled: ${subPlugins.filter(p => isPluginEnabled(p)).length}`, 500, 280, "Black", "Gray");
            DrawText(isCJK() ? `☁️ 帳戶已啟用：${subPlugins.filter(p => isPluginEnabledInAccount(p)).length} 個` : `☁️ Account enabled: ${subPlugins.filter(p => isPluginEnabledInAccount(p)).length}`, 500, 355, "Black", "Gray");
            DrawCheckbox(500, 455, 64, 64, "", !accountFloatingBtnVisible);
            DrawText(isCJK() ? "隱藏浮動按鈕" : "Hide floating button", 580, 480, "Black", "Gray");
            MainCanvas.textAlign = "center";
        };
        window.PreferenceSubscreenPCMSettingsClick = () => {
            if (MouseIn(1815, 75, 90, 90)) { PreferenceSubscreenPCMSettingsExit(); return; }
            if (MouseIn(500, 455, 64, 64)) { accountFloatingBtnVisible = !accountFloatingBtnVisible; const cfg = loadAccountConfig(); cfg.showFloatingBtn = accountFloatingBtnVisible; saveAccountConfig(cfg); applyFloatingBtnVisibility(); }
        };
        window.PreferenceSubscreenPCMSettingsExit = () => PreferenceSubscreenExtensionsClear();

        PreferenceRegisterExtensionSetting({
            Identifier: "PCMSettings",
            ButtonText:  t('prefButton'),
            Image: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png",
            click: window.PreferenceSubscreenPCMSettingsClick,
            run:   window.PreferenceSubscreenPCMSettingsRun,
            exit:  window.PreferenceSubscreenPCMSettingsExit,
            load:  window.PreferenceSubscreenPCMSettingsLoad,
        });
    }

    // === 初始化 =================================================

    // 系統依賴「依序」抓：先 jsDelivr，失敗才退 raw.githubusercontent。
    // 絕不並行同打兩邊 —— raw.githubusercontent 有嚴格速率限制，Electron-BC 單一 IP + Loader 啟動時
    // 的突發請求（本體、各依賴、每個子插件、Plugins.json）很容易觸發 429 (Too Many Requests)，
    // 造成 PCM-i18n.js 等檔案抓取失敗、翻譯註冊不上（介面退回英文甚至顯示 key）。
    // jsDelivr 在 EBC 正常且無此限制，一律優先。本地測試時 window.LikoDevBase 只有單一 localhost。
    const _DEP_BASES = (typeof window !== 'undefined' && window.LikoDevBase)
        ? [window.LikoDevBase]
        : [
            "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/",
            "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/",
        ];

    function _injectCode(code) {
        const s = document.createElement('script');
        s.textContent = code;              // 內聯 script → 同步執行（與下方 injectScript 同機制）
        document.head.appendChild(s);
    }

    // 依序抓取（jsDelivr 優先），並驗證內容（避免把 404 的 HTML 當 JS 注入）。
    // 不加 ?t= 破快取 —— 讓 Electron 的 HTTP 快取能重用同一 URL，降低請求量、遠離 429。
    async function _fetchDep(rel) {
        let lastErr;
        for (const base of _DEP_BASES) {
            try {
                const res = await fetch(base + rel);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                if (!text || text.trimStart().startsWith('<')) throw new Error('bad content');
                return text;
            } catch(e) { lastErr = e; console.warn(`🐈‍⬛ [PCM] ⚠️ ${base}${rel}: ${e.message}`); }
        }
        throw lastErr ?? new Error('all bases failed');
    }

    async function _loadDep(rel) { _injectCode(await _fetchDep(rel)); }

    async function _ensureDeps() {
        // bcmodsdk must exist before registerMod — must be first
        if (typeof bcModSdk === 'undefined') {
            await _loadDep("expand/bcmodsdk.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ bcmodsdk:", e.message));
        }
        // i18n 引擎：能力偵測（ensure 為 v2 專有），沒有才載入
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') {
            await _loadDep("expand/BC_i18n.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ BC_i18n.js:", e.message));
        }
        // PCM 字庫：一律載入。不用 has('PCM','tabLocal') 判斷是否已載入 —— 該鍵在本體內建的 EN
        // fallback 也存在，會被誤判成「已載入」而整包跳過、只剩英文。jsDelivr 優先後不再 429，這支能
        // 穩定抓到並註冊 TW/CN…（PCM-i18n.js 內部自帶輪詢等引擎就位後再 register）。
        await _loadDep("Translation/PCM-i18n.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ PCM-i18n.js:", e.message));

        // 其餘系統擴充 —— 已就位就跳過（統一系統擴充掛在 window.Liko.__Sys_* 底下）
        const rest = [
            { rel: "expand/BC_toast_system.user.js", ready: () => !!window.Liko?.__Sys_Toast__ },
            { rel: "expand/BC_ThemeColorCheck.js",   ready: () => !!window.Liko?.__Sys_ColorAPI__ },
        ];
        for (const { rel, ready } of rest) {
            if (ready()) continue;
            await _loadDep(rel).catch(e => console.warn(`🐈‍⬛ [PCM] ⚠️ ${rel}:`, e.message));
        }
    }

    // _ensureDeps runs async before everything else
    (async () => {
        await _ensureDeps();

        try {
            if (!bcModSdk?.registerMod) { console.error("🐈‍⬛ [PCM] ❌ bcModSdk not available"); return; }
            modApi = bcModSdk.registerMod({ name: "Liko's PCM", fullName: 'Liko - Plugin Collection Manager', version: MOD_VER, repository: 'https://github.com/awdrrawd/liko-Plugin-Repository' });
            registerPCMBadge();
        } catch(e) { console.error("🐈‍⬛ [PCM] ❌ Init failed:", e.message); return; }

        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initialize().then(() => sendLoadedMessage()), { once: true });
        else initialize().then(() => sendLoadedMessage());

        console.log(`🐈‍⬛ [PCM] ✅ v${MOD_VER} loaded`);
    })();

    async function initialize() {
        if (isInitialized) return;
        isInitialized = true;

        registerI18n();

        // Wait briefly for TranslationLanguage
        await new Promise(r => { const check = () => { if (typeof TranslationLanguage !== 'undefined') r(); else setTimeout(check, 100); }; check(); setTimeout(r, 3000); });

        lastDetectedLanguage = getLang();
        customPlugins = loadCustomPlugins();

        injectStyles();
        monitorPageChanges();
        tryRegisterCommand();

        initPlugins();
        loadLocalPluginsPhase();
        loadAccountPluginsPhase();
        setTimeout(() => loadCustomPluginsPhase(), 5000);
        registerPreferencePage();

        if (typeof modApi.onUnload === 'function') modApi.onUnload(() => {
            _lifecycle.intervals.forEach(id => clearInterval(id));
            _lifecycle.intervals.length = 0;
            if (_lifecycle.mousemoveHandler) { document.removeEventListener("mousemove", _lifecycle.mousemoveHandler); _lifecycle.mousemoveHandler = null; }
            isInitialized = false;
        });
    }
})();