// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      2.2.0
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// ==/UserScript==
(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "2.2.0";
    if (window.Liko.PCM) return;
    window.Liko.PCM = MOD_VER;

    let modApi;
    let isInitialized = false;
    // unloaded 讓所有遞迴輪詢鏈在 mod 卸載後停止，避免背景無限重排 timer。
    const _lifecycle = { intervals: [], mousemoveHandler: null, unloaded: false };

    // 簡易 HTML escape：插件名稱/描述/連結進 innerHTML 前一律過濾，防注入。
    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // === i18n ===================================================
    
    const PCM_UI_SETTINGS_KEY = 'pcm_ui_settings';
    const DEFAULT_UI_SETTINGS = { language: 'AUTO', showLoadNotifications: true, showFusamTab: false, showCustomTab: false };
    function loadUiSettings() {
        try { return { ...DEFAULT_UI_SETTINGS, ...(JSON.parse(localStorage.getItem(PCM_UI_SETTINGS_KEY) || '{}') || {}) }; }
        catch(e) { return { ...DEFAULT_UI_SETTINGS }; }
    }
    let pcmUiSettings = loadUiSettings();
    function saveUiSettings() { try { localStorage.setItem(PCM_UI_SETTINGS_KEY, JSON.stringify(pcmUiSettings)); } catch(e) {} }
    const pcmLang = () => pcmUiSettings.language === 'AUTO' ? undefined : pcmUiSettings.language;
    const t = (key, vars) => window.Liko.__Sys_i18n__?.t('PCM', key, vars, pcmLang()) ?? key;

    function registerI18n() {
        // EN strings are the authoritative fallback — other languages live in PCM-i18n.js
        const _enStrings = {
            'loaded':           { EN: 'Liko\'s Plugin Collection Manager v{ver} loaded! Click the floating button to manage plugins.' },
            'shortLoaded':      { EN: '📋 Liko Plugin Collection Manager Manual\n\n🎮 How to Use:\n• Click the floating button to open panel\n• Toggle switches to enable/disable plugins\n• Three-state toggle: OFF → ON → BETA\n\n📝 Commands:\n/pcm help — show this\n/pcm list — list all plugins\n\n💡 Plugins load on enable, or take effect on next refresh.' },
            'welcomeTitle':     { EN: '🐈‍⬛ Plugin Manager' },
            'tabLocal':         { EN: '📱 Local' },
            'tabAccount':       { EN: '☁️ Account' },
            'tabCustom':        { EN: '🔧 Custom' },
            'tabFusam':         { EN: '◆ FUSAM' },
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
            'pcmLoadedCount':     { EN: 'PCM - {count} loaded successfully' },
            'fusamLoadedCount':   { EN: 'FUSAM - {count} loaded successfully' },
            'pcmFailedCount':     { EN: 'PCM - {count} failed to load' },
            'fusamFailedCount':   { EN: 'FUSAM - {count} failed to load' },
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
            'customEmptyHint':    { EN: 'No custom plugins yet.\nTap ＋ in the lower-right corner to add one.' },
            'prefButton':         { EN: 'PCM Plugin Manager' },
            'settingsTitle':      { EN: 'PCM Settings' },
            'settingsLanguage':   { EN: 'Language' },
            'settingsAuto':       { EN: 'AUTO' },
            'settingsLoadNotif':  { EN: 'Show plugin loading notifications' },
            'settingsFusam':      { EN: 'Load FUSAM plugin list' },
            'settingsCustom':     { EN: 'Show custom plugins tab' },
            'settingsClose':      { EN: 'Done' },
            'fusamTitle':         { EN: 'Fantastic Ultimate Solution to Addon Management' },
            'fusamDesc':          { EN: 'An independent community addon manager. PCM reads its official GitLab Pages manifest directly.' },
            'fusamOpen':          { EN: 'Open official FUSAM installation page' },
            'fusamLicense':       { EN: 'FUSAM is an independent GPLv3 project. Addons installed there are managed by FUSAM.' },
        };

        // i18n 引擎可能晚就位（EBC 下要等別的插件順便載入），輪詢等待最多 10 秒再放棄。
        (function registerWhenReady(tries) {
            if (window.Liko.__Sys_i18n__?.register) {
                window.Liko.__Sys_i18n__.register('PCM', _enStrings);
                return;
            }
            if (_lifecycle.unloaded) return;
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
                refreshAccountSettingsFromPlayer();
                const cfg = loadAccountConfig();
                accountFloatingBtnVisible = cfg.showFloatingBtn !== false;
                applyFloatingBtnVisibility();
            } catch(e) {}
        };
        if (typeof Player !== 'undefined' && Player?.AccountName) doSetup();
        else {
            const id = setInterval(() => { if (typeof Player !== 'undefined' && Player?.AccountName) { clearInterval(id); doSetup(); } }, 500);
            _lifecycle.intervals.push(id);
        }
    }

    function sendPCMInitialization(requestReply = false, target = null) {
        try {
            // 用伺服器房間狀態判斷，而非 CurrentScreen —— 避免進房轉場瞬間送出被吞掉
            if (typeof ServerPlayerIsInChatRoom !== 'function' || !ServerPlayerIsInChatRoom()) return;
            const msg = { Type: "Hidden", Content: PCM_HIDDEN_MSG, Sender: Player.MemberNumber, Dictionary: [{ pcm: { version: MOD_VER, replyRequested: requestReply } }] };
            if (target) msg.Target = target; // 定向可減少全房廣播量
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
            // 隱藏訊息可能比 sender 角色建立更早到達 —— 延後到下一個微任務重試一次
            if (!sender) { if (deferred !== true) queueMicrotask(() => parsePCMMessage(data, true)); return; }
            if (sender.ID === 0) return;
            sender.PCM = { version: pcmData.version };
            if (pcmData.replyRequested) sendPCMInitialization(false, data.Sender);
        } catch(e) {}
    }

    // 把 ChatRoomMessage 監聽重綁到目前的 ServerSocket（off 再 on，避免重複綁）
    function bindPCMSocketListener() {
        try {
            if (typeof ServerSocket === 'undefined' || !ServerSocket) return;
            ServerSocket.off("ChatRoomMessage", parsePCMMessage);
            ServerSocket.on("ChatRoomMessage", parsePCMMessage);
        } catch(e) {}
    }

    function initializePCMBadgeImage() {
        if (!pcmBadgeImage) {
            // 靜態圖檔：CDN 優先、Pages 次之、raw 保底。
            const _badgePages = "https://awdrrawd.github.io/liko-Plugin-Repository/Images/PCM_Badge.png";
            const _badgeCdn = "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_Badge.png";
            const _badgeRaw = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Images/PCM_Badge.png";
            const _badgeUrls = [_badgeCdn, _badgePages, _badgeRaw];
            let _badgeIndex = 0;
            pcmBadgeImage = new Image();
            pcmBadgeImage.crossOrigin = "anonymous";
            pcmBadgeImage.onload = () => { pcmImageLoaded = true; };
            pcmBadgeImage.onerror = () => {
                _badgeIndex++;
                if (_badgeIndex < _badgeUrls.length) pcmBadgeImage.src = _badgeUrls[_badgeIndex];
                else pcmImageLoaded = false;
            };
            pcmBadgeImage.src = _badgeUrls[_badgeIndex];
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
        // 別人晚於自己進房時 BC 觸發的是 ChatRoomSyncMemberJoin，對新人定向握手並要求回覆
        sh('ChatRoomSyncMemberJoin', 5, (args, next) => {
            const r = next(args);
            try { const d = args[0]; if (d && d.SourceMemberNumber != null && d.SourceMemberNumber !== Player.MemberNumber) sendPCMInitialization(true, d.SourceMemberNumber); } catch(e) {}
            return r;
        });
        // 重連 / 重複登入會重跑 ServerInit 並換掉 ServerSocket，必須重綁監聽否則收不到訊息
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
            if (_lifecycle.unloaded) return;
            if (!modApi?.hookFunction || typeof ServerSocket === 'undefined' || !ServerSocket) { setTimeout(wait, 500); return; }
            initializePCMBadgeImage(); setupHoverTracking(); cleanupLegacyOnlineSettings(); hookCharacterDrawing();
            bindPCMSocketListener();
            // 載入時若已在房內（不會再觸發 ChatRoomSync/MemberJoin），廣播一發要求在場所有人回應
            sendPCMInitialization(true);
            if (typeof modApi.onUnload === 'function') modApi.onUnload(() => {
                _lifecycle.unloaded = true;
                try { ServerSocket.off("ChatRoomMessage", parsePCMMessage); } catch(e) {}
                if (_lifecycle.mousemoveHandler) { document.removeEventListener("mousemove", _lifecycle.mousemoveHandler); _lifecycle.mousemoveHandler = null; }
                hoveredCharacters.clear(); characterDrawPositions.clear();
            });
        };
        wait();
    }

    // === JSON 來源 ===============================================
    // GitHub Pages 優先、raw 備援、jsDelivr 最後保底 —— Plugins.json 承載版本號/更新日誌等
    const DEV_PLUGINS_JSON_URL = window.LikoDevBase ? new URL('../Plugins.json', window.LikoDevBase).href : null;
    const PLUGINS_JSON_URLS = [
        DEV_PLUGINS_JSON_URL,
        `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins.json?timestamp=${Date.now()}`,
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins.json",
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins.json",
    ].filter(Boolean);
    const NETWORK_TIMEOUT_MS = 12000;
    async function fetchTextWithTimeout(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            const text = await res.text();
            return { res, text };
        } catch(e) {
            if (e?.name === 'AbortError') throw new Error(`Timeout after ${timeoutMs}ms`);
            throw e;
        } finally {
            clearTimeout(timer);
        }
    }

    // === 設定存取 ================================================
    let saveTimer;
    function saveSettings(s) { clearTimeout(saveTimer); saveTimer = setTimeout(() => localStorage.setItem("BC_PluginManager_Settings", JSON.stringify(s)), 100); }
    function loadSettings() {
        try {
            const parsed = JSON.parse(localStorage.getItem("BC_PluginManager_Settings") || "{}");
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch(e) {
            console.warn("🐈‍⬛ [PCM] ⚠️ 本機設定已損壞，改用預設設定：", e?.message || e);
            return {};
        }
    }
    let pluginSettings = loadSettings();
    let accountPluginSettings = {};
    let accountSettingsLoaded = false;
    let accountSettingsLoadPromise = null;

    function loadAccountSettings() {
        try { const raw = Player?.ExtensionSettings?.PCMAccount; if (!raw) return {}; return typeof raw === 'object' ? raw : JSON.parse(raw) || {}; } catch(e) { return {}; }
    }
    function refreshAccountSettingsFromPlayer() {
        if (typeof Player === 'undefined' || !Player?.AccountName) return false;
        accountPluginSettings = loadAccountSettings();
        accountSettingsLoaded = true;
        return true;
    }
    async function ensureAccountSettingsLoaded() {
        if (accountSettingsLoaded) return true;
        if (accountSettingsLoadPromise) return accountSettingsLoadPromise;

        accountSettingsLoadPromise = (async () => {
            let waited = 0;
            while ((typeof Player === 'undefined' || !Player?.AccountName) && waited < 15 * 60000) {
                if (_lifecycle.unloaded) return false;
                await new Promise(r => setTimeout(r, 1000));
                waited += 1000;
            }
            if (_lifecycle.unloaded) return false;
            return refreshAccountSettingsFromPlayer();
        })();

        try {
            return await accountSettingsLoadPromise;
        } finally {
            accountSettingsLoadPromise = null;
        }
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

    // 舊版每個插件各開一筆 localStorage（pcm_p_<id>），插件一多就是一堆零散 key。
    // 改成單一 key 存一個 { id: code } 物件，一次讀寫即可。
    const PLUGIN_CACHE_KEY    = 'pcm_plugin_cache';
    const PLUGIN_CACHE_PREFIX = 'pcm_p_'; // 僅供 migrateOldPluginCache() 掃描舊 key 用

    function isJsDelivrUrl(url) { return typeof url === 'string' && url.includes('cdn.jsdelivr.net'); }
    // 自家 Pages 鏡像也視為「CDN 來源」，primary 落在 jsDelivr/Pages 時才啟用本地快取當救援
    //（raw 本身即時，無快取延遲要救）。
    function isOwnPagesUrl(url) { return typeof url === 'string' && url.includes('awdrrawd.github.io/liko-Plugin-Repository'); }
    const OWN_REPO_RAW_PREFIX   = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/";
    const OWN_REPO_PAGES_PREFIX = "https://awdrrawd.github.io/liko-Plugin-Repository/";

    // 快取只當「網路全掛時的救援」，只需要「有沒有救援可用」，不需要寫入時間
    // （原本存的 time 從沒被讀過，純粹佔位，直接拿掉）。
    let _pluginCacheStore = null;
    function loadPluginCacheStore() {
        if (_pluginCacheStore) return _pluginCacheStore;
        try { _pluginCacheStore = JSON.parse(localStorage.getItem(PLUGIN_CACHE_KEY) || '{}') || {}; }
        catch(e) { _pluginCacheStore = {}; }
        migrateOldPluginCache(_pluginCacheStore);
        return _pluginCacheStore;
    }
    function savePluginCacheStore() {
        try {
            let serialized = JSON.stringify(_pluginCacheStore);
            if (serialized.length > 3500000) {
                const removable = Object.entries(_pluginCacheStore)
                    .filter(([, value]) => value && typeof value === 'object')
                    .sort((a, b) => (a[1].lastSuccessAt || a[1].cachedAt || 0) - (b[1].lastSuccessAt || b[1].cachedAt || 0));
                while (serialized.length > 3500000 && removable.length) {
                    delete _pluginCacheStore[removable.shift()[0]];
                    serialized = JSON.stringify(_pluginCacheStore);
                }
            }
            localStorage.setItem(PLUGIN_CACHE_KEY, serialized);
        } catch(e) { console.warn('🐈‍⬛ [PCM] ⚠️ 插件快取寫入失敗：', e?.message || e); }
    }
    // 一次性把舊版分散的 pcm_p_<id> key 併進新的單一物件，併完就刪舊 key，之後不會再跑。
    function migrateOldPluginCache(store) {
        try {
            const oldKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(PLUGIN_CACHE_PREFIX)) oldKeys.push(k);
            }
            if (!oldKeys.length) return;
            for (const k of oldKeys) {
                try {
                    const id = k.slice(PLUGIN_CACHE_PREFIX.length);
                    const raw = JSON.parse(localStorage.getItem(k) || 'null');
                    const code = typeof raw === 'string' ? raw : raw?.code;
                    if (code && !store[id]) store[id] = code;
                } catch(e) {}
                localStorage.removeItem(k);
            }
            localStorage.setItem(PLUGIN_CACHE_KEY, JSON.stringify(store));
        } catch(e) {}
    }
    function getCachedPluginCode(cacheKey, legacyId) {
        const store = loadPluginCacheStore();
        const entry = store[cacheKey] ?? store[legacyId];
        return typeof entry === 'string' ? entry : (entry?.code || null);
    }
    function hashPluginCode(code) {
        let hash = 2166136261;
        for (let i = 0; i < code.length; i++) hash = Math.imul(hash ^ code.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(36);
    }
    function setCachedPluginCode(cacheKey, legacyId, code, url, distribution) {
        const store = loadPluginCacheStore();
        store[cacheKey] = { code, url, distribution, hash: hashPluginCode(code), cachedAt: Date.now(), lastSuccessAt: Date.now() };
        if (legacyId !== cacheKey && Object.prototype.hasOwnProperty.call(store, legacyId)) delete store[legacyId];
        savePluginCacheStore();
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

    const SAFE_PLUGIN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
    function normalizePluginData(data) {
        if (!data || typeof data !== 'object' || !Array.isArray(data.plugins) || !data.plugins.length) return null;
        const seen = new Set();
        const plugins = [];
        for (const raw of data.plugins) {
            if (!raw || typeof raw !== 'object') { console.warn('🐈‍⬛ [PCM] ⚠️ 略過無效插件資料'); continue; }
            const id = typeof raw.id === 'string' ? raw.id.trim() : '';
            const name = typeof raw.name === 'string' ? raw.name.trim() : '';
            const type = raw.type == null || raw.type === '' ? 'eval' : raw.type;
            const urls = [raw.url, raw.mirrorUrl, raw.altUrl, raw.altMirrorUrl].filter(Boolean);
            const validUrls = urls.every(url => typeof url === 'string' && /^https:\/\//i.test(url));
            if (!SAFE_PLUGIN_ID_RE.test(id) || !name || seen.has(id) || !['eval', 'scr', 'mod'].includes(type)
                || (!raw.url && !raw.inlineCode) || !validUrls) {
                console.warn(`🐈‍⬛ [PCM] ⚠️ 略過不合法插件：${id || '(missing id)'}`);
                continue;
            }
            seen.add(id);
            plugins.push({ ...raw, id, name, type, priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 5 });
        }
        return plugins.length ? { ...data, plugins } : null;
    }

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
                const { res, text } = await fetchTextWithTimeout(url, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                let data; try { data = JSON.parse(text); } catch(e) { continue; }
                data = normalizePluginData(data);
                if (!data) continue;
                setCachedJSON(data);
                console.log(`🐈‍⬛ [PCM] ✅ Plugins.json fetched (${url})`);
                return data;
            } catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return null;
    }

    async function initPlugins() {
        const data = await fetchJSONFromNetwork();
        if (data) {
            processPluginData(data);
            _resolvePluginsReady(true);
            refreshPluginListUI();
            if (checkVersionUpdate()) {
                setTimeout(() => { showChangelogModal(); showNotification("✨", t('newVersionTitle'), `v${remoteVersion} — ${t('newVersionHint')}`); }, 2000);
            }
            return;
        }

        const cached = getCachedJSON();
        const normalizedCache = normalizePluginData(cached);
        if (normalizedCache) {
            processPluginData(normalizedCache);
            _resolvePluginsReady(true);
            refreshPluginListUI();
        } else {
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

        // 清除所有本機快取：Loader 快取的 Main 腳本、Plugins.json 清單快取、插件程式碼快取（單一 key）
        try {
            localStorage.removeItem('pcm_main_cache');
            localStorage.removeItem(JSON_CACHE_KEY);
            localStorage.removeItem(PLUGIN_CACHE_KEY);
            _pluginCacheStore = {};
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
        if (remoteUpdateId && saved !== remoteUpdateId) {
            pluginSettings['_pcm_updateId'] = remoteUpdateId;
            saveSettings(pluginSettings);
            // saved === undefined 是全新安裝（非從舊版更新），不該跳 changelog 通知。
            return saved !== undefined;
        }
        return false;
    }

    // === 三段開關輔助 ============================================

    function isTriStatePlugin(p) { return !!p.altUrl; }
    function isPluginEnabled(p) { return isTriStatePlugin(p) ? p.state !== "off" : p.enabled; }
    function isPluginEnabledInAccount(p) { const v = accountPluginSettings[p.id]; return v !== undefined && v !== 0 && v !== "off"; }
    function getPluginState(p, source) { return (source === 'account' ? accountPluginSettings[p.id] : p.state) || "off"; }
    function isPluginEnabledForSource(p, source) { return source === 'account' ? isPluginEnabledInAccount(p) : isPluginEnabled(p); }
    function getPluginLoadSource(p) { return isPluginEnabled(p) ? 'local' : 'account'; }
    function getActivePluginUrl(p, source = 'local') {
        if (p.altUrl && getPluginState(p, source) === "beta") return p.altUrl;
        return p.url;
    }
    function getTriLabels(p) { return p.triLabels?.length === 3 ? p.triLabels : ["OFF", "ON", "BETA"]; }
    function cycleTriState(s) { return s === "off" ? "stable" : s === "stable" ? "beta" : "off"; }

    // === 語言輔助 ================================================

    function getLang() { return pcmLang() || window.Liko.__Sys_i18n__?.detectLang() || 'EN'; }
    function isCJK() { const l = getLang(); return l === 'TW' || l === 'CN'; }
    function getPluginName(p) { return isCJK() ? p.name : (p.en_name || p.name); }
    function getPluginDescription(p) { return isCJK() ? p.description : (p.en_description || p.description); }
    function getPluginAdditionalInfo(p) { return isCJK() ? p.additionalInfo : (p.en_additionalInfo || p.additionalInfo); }

    // === 插件加載 ================================================
    
    let loadedPlugins = new Set(), failedPlugins = new Set();
    const pluginLoadPromises = new Map();
    const pluginRuntime = new Map();
    const pcmLogs = [];
    const PCM_LOG_LIMIT = 300;
    let isLoadingPlugins = false, localLoadStarted = false, accountLoadStarted = false, customLoadStarted = false;
    let localPhasePromise = null;
    const LAST_PLUGIN_ERROR_KEY = 'pcm_last_plugin_error';
    let previousPluginError = null;
    try { previousPluginError = JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || 'null'); } catch(e) {}
    // 上次錯誤只消費一次；本次若再出錯，rememberPluginError() 會重新寫入供下次刷新提醒。
    try { localStorage.removeItem(LAST_PLUGIN_ERROR_KEY); } catch(e) {}

    function hasExternalFusam() {
        return !!window.FUSAM?.present && !window.Liko?.__PCMFusamCompat__?.isOwned?.();
    }

    function fusamDistributions(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return value.enabledDistributions && typeof value.enabledDistributions === 'object'
            ? value.enabledDistributions : value;
    }

    /** 讀取真正 FUSAM 的瀏覽器層與帳號層設定；只有本次確實啟用 FUSAM 才生效。 */
    function externalFusamEnabledIds() {
        const ids = new Set();
        if (!hasExternalFusam()) return ids;
        try {
            const browser = fusamDistributions(JSON.parse(localStorage.getItem('fusam.settings') || '{}'));
            for (const [id, distribution] of Object.entries(browser)) if (distribution) ids.add(id);
        } catch(e) { console.warn('🐈‍⬛ [PCM] ⚠️ 無法讀取 FUSAM 瀏覽器設定:', e?.message || e); }
        try {
            const packed = Player?.ExtensionSettings?.FUSAMSettings || Player?.OnlineSettings?.FUSAMSettings;
            if (packed && typeof globalThis.LZString?.decompressFromBase64 === 'function') {
                const account = fusamDistributions(JSON.parse(globalThis.LZString.decompressFromBase64(packed) || '{}'));
                for (const [id, distribution] of Object.entries(account)) if (distribution) ids.add(id);
            }
        } catch(e) { console.warn('🐈‍⬛ [PCM] ⚠️ 無法讀取 FUSAM 帳號設定:', e?.message || e); }
        return ids;
    }

    function isOwnedByExternalFusam(plugin) {
        const id = String(plugin?.fusamId || plugin?.id || '').replace(/^fusam:/, '');
        return !!id && externalFusamEnabledIds().has(id);
    }

    function pcmLog(level, message, data = null) {
        const entry = { time: Date.now(), level, message, ...(data ? { data } : {}) };
        pcmLogs.push(entry);
        if (pcmLogs.length > PCM_LOG_LIMIT) pcmLogs.splice(0, pcmLogs.length - PCM_LOG_LIMIT);
        return entry;
    }

    function rememberPluginError(id, err, phase = 'runtime') {
        if (!id) return;
        const plugin = subPlugins.find(p => p.id === id) || customPlugins.find(p => p.id === id);
        const record = {
            pluginId: id,
            pluginName: plugin ? getPluginName(plugin) : id,
            phase,
            message: String(err?.message || err || 'Unknown error').slice(0, 500),
            time: Date.now(),
        };
        try { localStorage.setItem(LAST_PLUGIN_ERROR_KEY, JSON.stringify(record)); } catch(e) {}
    }
    function setPluginRuntime(id, patch) {
        const previous = pluginRuntime.get(id) || { status: 'idle' };
        const next = { ...previous, ...patch };
        if (patch.status === 'loading' && !next.startedAt) next.startedAt = Date.now();
        if ((patch.status === 'loaded' || patch.status === 'cached' || patch.status === 'failed' || patch.status === 'delegated') && !next.settledAt) {
            next.settledAt = Date.now();
            if (next.startedAt) next.durationMs = next.settledAt - next.startedAt;
        }
        pluginRuntime.set(id, next);
        const fusamCompat = window.Liko?.__PCMFusamCompat__;
        if (fusamCompat?.isOwned?.()) {
            const status = next.status === 'loading' ? 'loading'
                : (next.status === 'loaded' || next.status === 'cached') ? 'loaded'
                    : next.status === 'failed' ? 'error' : 'missing';
            fusamCompat.setAddonState(id, {
                distribution: next.source === 'fusam' ? (next.distribution || 'stable')
                    : next.source === 'account' ? 'account'
                        : next.source === 'custom' ? 'custom' : 'stable',
                status,
            });
        }
        if (patch.status && patch.status !== previous.status) pcmLog(
            patch.status === 'failed' ? 'ERROR' : 'INFO',
            `Plugin ${id}: ${previous.status} -> ${patch.status}`,
            { source: next.source, loadType: next.loadType, durationMs: next.durationMs, error: next.error }
        );
        document.querySelectorAll('.bc-plugin-item[data-plugin-id]').forEach(item => {
            if (item.getAttribute('data-plugin-id') !== id) return;
            item.classList.toggle('failed', next.status === 'failed');
            item.classList.toggle('runtime-warning', !!next.postLoadError);
            const label = item.querySelector('.bc-plugin-runtime-status');
            if (label) {
                const labels = isCJK()
                    ? { loading: '載入中…', loaded: '已載入', cached: '已從快取救援', failed: '載入失敗', delegated: '由 FUSAM 載入' }
                    : { loading: 'Loading…', loaded: 'Loaded', cached: 'Recovered from cache', failed: 'Load failed', delegated: 'Handled by FUSAM' };
                label.textContent = next.reloadRequired
                    ? (isCJK() ? '已停用，重新整理後生效' : 'Disabled · reload required')
                    : (labels[next.status] || '');
                label.setAttribute('data-status', next.reloadRequired ? 'reload' : next.status);
            }
        });
    }
    function installPCMReadOnlyApi() {
        window.Liko.PCMApi = Object.freeze({
            apiVersion: 1,
            version: MOD_VER,
            ...(window.Liko?.__PCMFusamCompat__?.isOwned?.()
                ? { modals: window.Liko.__PCMFusamCompat__.api.modals }
                : {}),
            list: () => subPlugins.map(plugin => ({
                id: plugin.id,
                name: getPluginName(plugin),
                enabled: isPluginEnabled(plugin),
                runtime: { ...(pluginRuntime.get(plugin.id) || { status: 'idle' }) },
            })),
            getRuntimeState: id => ({ ...(pluginRuntime.get(String(id)) || { status: 'idle' }) }),
            getLastPluginError: () => {
                try { return JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || 'null'); } catch(e) { return null; }
            },
            getLogs: () => pcmLogs.map(entry => ({ ...entry, ...(entry.data ? { data: { ...entry.data } } : {}) })),
            exportDiagnostic: () => JSON.stringify({
                pcmVersion: MOD_VER,
                generatedAt: new Date().toISOString(),
                language: getLang(),
                plugins: [...pluginRuntime].map(([id, state]) => ({ id, ...state })),
                lastPluginError: (() => { try { return JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || 'null'); } catch(e) { return null; } })(),
                logs: pcmLogs,
                fusamCompat: window.Liko?.__PCMFusamCompat__?.isOwned?.() ? {
                    installed: true,
                    registeredDebugMethods: [...window.Liko.__PCMFusamCompat__.getDebugMethods().keys()],
                } : { installed: false, reason: window.FUSAM?.present ? 'external-fusam' : 'unavailable' },
            }, null, 2),
        });
    }

    // === 插件執行期錯誤歸因（best-effort）====
    // 各載入方式成功後把「可辨識字串」（sourceURL / 實際 URL）登記進來；日後任何時點的 window
    // error / unhandledrejection 只要訊息或堆疊含有這字串，就回推是哪個插件，用於診斷晚發的錯誤
    //（injectScript 的 window 'error' 監聽器只抓得到注入當下的同步錯誤）。
    const _pluginSourceRegistry = new Map(); // key: 可辨識字串 -> plugin id
    function registerPluginSource(id, ...keys) {
        keys.filter(Boolean).forEach(k => _pluginSourceRegistry.set(k, id));
    }
    function _findPluginIdBySource(str) {
        if (!str) return null;
        for (const [key, id] of _pluginSourceRegistry) { if (str.includes(key)) return id; }
        return null;
    }
    function _handlePluginRuntimeError(id, err) {
        // 只記錄、不強制標記失敗 —— 初次載入已成功，晚發錯誤不代表整支不能用，重試與否交給使用者。
        const plugin = subPlugins.find(p => p.id === id) || customPlugins.find(p => p.id === id);
        console.error(`🐈‍⬛ [PCM] ⚠️ 插件執行期錯誤 [${plugin ? getPluginName(plugin) : id}]:`, err?.message || err);
        rememberPluginError(id, err, 'runtime');
        setPluginRuntime(id, { postLoadError: String(err?.message || err || 'Unknown error').slice(0, 500) });
    }
    const _onPluginWindowError = (ev) => {
        try { const id = _findPluginIdBySource(ev.filename || ev.error?.stack || ''); if (id) _handlePluginRuntimeError(id, ev.error || ev.message); } catch(e) {}
    };
    const _onPluginUnhandledRejection = (ev) => {
        try { const id = _findPluginIdBySource(ev.reason?.stack || String(ev.reason || '')); if (id) _handlePluginRuntimeError(id, ev.reason); } catch(e) {}
    };
    window.addEventListener('error', _onPluginWindowError);
    window.addEventListener('unhandledrejection', _onPluginUnhandledRejection);

    function injectScript(id, code) {
        if (code.trimStart().startsWith('<')) throw new Error('Received HTML instead of JS');
        let caught = null;
        const onWindowError = (ev) => { if (caught === null) caught = ev.error || new Error(ev.message || 'plugin execution error'); };
        window.addEventListener('error', onWindowError);
        try {
            const s = document.createElement('script');
            s.setAttribute('data-plugin', id);
            s.textContent = `${code}\n//# sourceURL=pcm-plugin-${id}.js`;
            document.body.appendChild(s);
        } finally {
            window.removeEventListener('error', onWindowError);
        }
        if (caught) {
            console.error(`🐈‍⬛ [PCM] plugin error (${id}):`, caught.message);
            throw caught;
        }
        registerPluginSource(id, `pcm-plugin-${id}.js`);
    }

    async function tryFetch(urls) {
        for (const url of urls) {
            try {
                const { res, text } = await fetchTextWithTimeout(url, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (!text || text.trimStart().startsWith('<')) throw new Error('Invalid content');
                return text;
            } catch(e) { console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        return null;
    }

    function uniqueUrls(urls) {
        return [...new Set(urls.filter(Boolean))];
    }

    function buildFetchUrls(url) {
        if (!url) return [];
        // 自家 repo 的檔案：Pages 永遠優先。Pages 走 Fastly，push 後幾秒即新、且不像 raw 會 429；
        // jsDelivr(@main) 有數小時邊緣快取延遲，各 POP 傳播不一致，搶第一會抓到舊版 → 版本飄移。
        // 所以 jsDelivr/raw 只當 Pages 掛掉時的備援，絕不排在 Pages 前面。帶時間戳避免瀏覽器快取。
        if (url.startsWith(OWN_REPO_RAW_PREFIX)) {
            const rel = url.slice(OWN_REPO_RAW_PREFIX.length);
            const pages = `${OWN_REPO_PAGES_PREFIX}${rel}${rel.includes('?') ? '&' : '?'}timestamp=${Date.now()}`;
            const cdn   = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${rel}`;
            return [pages, cdn, url];
        }
        if (url.startsWith(OWN_REPO_PAGES_PREFIX)) {
            const relWithQuery = url.slice(OWN_REPO_PAGES_PREFIX.length);
            const [rel] = relWithQuery.split('?');
            const pages = `${OWN_REPO_PAGES_PREFIX}${rel}${rel.includes('?') ? '&' : '?'}timestamp=${Date.now()}`;
            const cdn   = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${rel}`;
            const raw   = `${OWN_REPO_RAW_PREFIX}${rel}`;
            return [pages, cdn, raw];
        }
        // 外部作者 repo：無法推導 Pages 鏡像，維持 jsDelivr 優先、raw 備援（避免 EBC 429，見 _DEP_BASES）。
        const cdn = url.replace(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/, "https://cdn.jsdelivr.net/gh/$1/$2@$3/$4");
        return cdn !== url ? [cdn, url] : [url];
    }

    // Plugins.json 可額外填 mirrorUrl 提供一組獨立備援來源（給無法自動推導 jsDelivr 鏡像的
    // Pages 網址用），接在候選清單後面再試。沒填則行為不變，向後相容。
    function buildAllFetchUrls(primaryUrl, mirrorUrl) {
        const urls = buildFetchUrls(primaryUrl);
        if (mirrorUrl) urls.push(...buildFetchUrls(mirrorUrl));
        return uniqueUrls(urls);
    }

    // === 載入方式（type）==========================================
    // 透過 plugin.type 選擇，沒填視為 "eval"（預設，向後相容）：
    //   eval — fetch 原始碼文字，用 <script> 塞文字執行（絕大多數子插件用這個）
    //   scr  — <script src="url"> 讓瀏覽器直接載入，適合 fetch() 被 CORS 擋掉的來源
    //   mod  — dynamic import(url)，給 Vite/Rollup 打包、含 import.meta 或需模組作用域的插件（如 AEE）
    function getLoadType(plugin) {
        const ty = plugin?.type;
        return (ty === 'mod' || ty === 'scr') ? ty : 'eval';
    }

    // 不加破快取 query string：對 jsDelivr 而言每次不同 URL = 每次快取未命中，反而是 429 來源。
    // 跟 eval/scr 一樣信任瀏覽器與 CDN 快取；要強制更新請重新整理頁面。
    async function tryImportModule(urls, id) {
        for (const url of urls) {
            try {
                await import(url);
                registerPluginSource(id, url);
                return true;
            }
            catch(e) {
                console.warn(`🐈‍⬛ [PCM] ⚠️ ${url} (direct import): ${e.message}`);
                // 後備：部分來源對 .js 回傳錯誤 Content-Type，dynamic import() 的 MIME 檢查比
                // <script src> 嚴格會拒載。自己 fetch 文字、用正確 MIME 包成 Blob URL 再 import。
                let blobUrl;
                try {
                    const { res, text } = await fetchTextWithTimeout(url, { cache: 'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    let code = text;
                    if (!code || code.trimStart().startsWith('<')) throw new Error('Invalid content');
                    const sourceTag = `liko-plugin://${id}`;
                    code += `\n//# sourceURL=${sourceTag}`; // blob 沒有真實檔名，自行加註供錯誤歸因比對
                    blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
                    await import(blobUrl);
                    registerPluginSource(id, url, sourceTag);
                    return true;
                } catch(e2) {
                    console.warn(`🐈‍⬛ [PCM] ⚠️ ${url} (blob import): ${e2.message}`);
                } finally {
                    if (blobUrl) URL.revokeObjectURL(blobUrl);
                }
            }
        }
        return false;
    }

    function loadViaScriptTag(url, id) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            let settled = false;
            const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value); };
            s.src = url;
            s.setAttribute('data-plugin', id);
            s.onload  = () => { registerPluginSource(id, url); finish(resolve); };
            s.onerror = () => finish(reject, new Error('script load error'));
            const timer = setTimeout(() => { s.remove(); finish(reject, new Error(`Timeout after ${NETWORK_TIMEOUT_MS}ms`)); }, NETWORK_TIMEOUT_MS);
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

    function loadSubPlugin(plugin, source = 'local') {
        if (loadedPlugins.has(plugin.id)) return Promise.resolve();
        const existing = pluginLoadPromises.get(plugin.id);
        if (existing) return existing;

        const trackedPromise = loadSubPluginOnce(plugin, source).finally(() => {
            if (pluginLoadPromises.get(plugin.id) === trackedPromise) pluginLoadPromises.delete(plugin.id);
        });
        pluginLoadPromises.set(plugin.id, trackedPromise);
        return trackedPromise;
    }

    async function loadSubPluginOnce(plugin, source = 'local') {
        const isCustom = source === 'custom';
        if (loadedPlugins.has(plugin.id)) return;
        if (!isCustom) {
            if (source === 'account' && !accountSettingsLoaded && !(await ensureAccountSettingsLoaded())) return;
            if (!isPluginEnabledForSource(plugin, source)) return;
        }

        // 只處理 PCM 的 FUSAM 頁：真正 FUSAM 已啟用同 ID 插件時由它負責。
        // PCM 本地／帳號／自訂來源維持原本載入時序，不受這個相容判定影響。
        if (source === 'fusam' && isOwnedByExternalFusam(plugin)) {
            console.info(`🐈‍⬛ [PCM] ↪ ${getPluginName(plugin)} 已由 FUSAM 啟用，PCM 略過載入`);
            setPluginRuntime(plugin.id, { status: 'delegated', source: 'fusam-external', error: null });
            return;
        }

        if (!plugin.url && plugin.inlineCode) {
            setPluginRuntime(plugin.id, { status: 'loading', source, loadType: 'eval', error: null, startedAt: Date.now(), settledAt: null });
            try {
                injectScript(plugin.id, plugin.inlineCode);
                loadedPlugins.add(plugin.id);
                setPluginRuntime(plugin.id, { status: 'loaded' });
            } catch(e) {
                failedPlugins.add(plugin.id);
                setPluginRuntime(plugin.id, { status: 'failed', error: String(e?.message || e) });
                rememberPluginError(plugin.id, e, 'load');
                throw e;
            }
            return;
        }
        if (!plugin.url) return;

        setPluginRuntime(plugin.id, { status: 'loading', source, distribution: source === 'fusam' ? plugin.distribution : undefined, error: null, postLoadError: null, startedAt: Date.now(), settledAt: null, durationMs: null });

        const rawUrl   = isCustom ? plugin.url : getActivePluginUrl(plugin, source);
        const loadType = getLoadType(plugin);
        const isAltUrl = !isCustom && plugin.altUrl && rawUrl === plugin.altUrl;
        const distribution = isAltUrl ? 'beta' : (isCustom ? 'custom' : 'stable');
        const cacheKey = `${plugin.id}|${distribution}|${rawUrl}`;
        const cachedCode = getCachedPluginCode(cacheKey, plugin.id);
        const mirrorUrl = isAltUrl ? (plugin.altMirrorUrl || plugin.mirrorUrl) : plugin.mirrorUrl;

        // mod / scr 不進 fetch+eval / localStorage 快取，交給瀏覽器 HTTP cache（模組無法安全地
        // 存純文字重放，scr 本來就讓瀏覽器直接載）。
        if (loadType === 'mod' || loadType === 'scr') {
            const urls = buildAllFetchUrls(rawUrl, mirrorUrl);
            const ok = loadType === 'mod'
                ? await tryImportModule(urls, plugin.id)
                : await tryLoadScriptTag(urls, plugin.id);
            if (!ok) {
                failedPlugins.add(plugin.id);
                setPluginRuntime(plugin.id, { status: 'failed', error: `All ${loadType} URLs failed` });
                rememberPluginError(plugin.id, `All ${loadType} URLs failed`, 'load');
                showPluginRetryBtn(plugin.id);
            showLoadNotification("❌", t('pluginLoadFailed', { name: getPluginName(plugin) }), t('pluginLoadRetry'));
                throw new Error(`All ${loadType} URLs failed`);
            }
            loadedPlugins.add(plugin.id); failedPlugins.delete(plugin.id);
            setPluginRuntime(plugin.id, { status: 'loaded', loadType, loadedUrl: rawUrl });
            hidePluginRetryBtn(plugin.id);
            return;
        }

        const urls    = buildAllFetchUrls(rawUrl, mirrorUrl);
        const primary = urls[0];
        const useCache = isJsDelivrUrl(primary) || isOwnPagesUrl(primary);
        const oldCache = useCache ? cachedCode : null; // 先留著當救援，成功前絕不覆蓋

        const code = await tryFetch(urls);
        if (code) {
            try {
                injectScript(plugin.id, code);
                loadedPlugins.add(plugin.id); failedPlugins.delete(plugin.id);
                setPluginRuntime(plugin.id, { status: 'loaded', loadType, loadedUrl: primary });
                hidePluginRetryBtn(plugin.id);
                if (useCache) setCachedPluginCode(cacheKey, plugin.id, code, rawUrl, distribution); // 注入成功才覆蓋快取
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
                setPluginRuntime(plugin.id, { status: 'cached', loadType, loadedUrl: primary });
                hidePluginRetryBtn(plugin.id);
                console.log(`🐈‍⬛ [PCM] ⚡ ${plugin.name} from cache (fallback)`);
                return;
            } catch(e) { /* 舊版也壞了，繼續往下走失敗流程 */ }
        }

        failedPlugins.add(plugin.id);
        setPluginRuntime(plugin.id, { status: 'failed', error: 'All URLs failed' });
        rememberPluginError(plugin.id, 'All URLs failed', 'load');
        showPluginRetryBtn(plugin.id);
            showLoadNotification("❌", t('pluginLoadFailed', { name: getPluginName(plugin) }), t('pluginLoadRetry'));
        throw new Error('All URLs failed');
    }

    function showPluginRetryBtn(pluginId, targetItem = null) {
        const item = targetItem || document.querySelector(`.bc-plugin-item[data-plugin-id="${CSS.escape(pluginId)}"]`);
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

    async function runPluginBatch(plugins, source = 'local') {
        while (isLoadingPlugins) await new Promise(r => setTimeout(r, 200));
        if (!plugins.length) return;
        isLoadingPlugins = true;
        try {
            const batchSize = 3; let ok = 0, fail = 0;
            for (let i = 0; i < plugins.length; i += batchSize) {
                const batch = plugins.slice(i, i + batchSize);
                const results = await Promise.allSettled(batch.map(p => loadSubPlugin(p, source)));
                results.forEach((r, idx) => { if (r.status === 'fulfilled') ok++; else { fail++; console.error(`🐈‍⬛ [PCM] ❌ ${batch[idx].name}`); } });
                if (i + batchSize < plugins.length) await new Promise(r => setTimeout(r, 800));
            }
        if (plugins.length > 0) {
            if (ok > 0) showLoadNotification("✅", t(source === 'fusam' ? 'fusamLoadedCount' : 'pcmLoadedCount', { count: ok }), '');
            if (fail > 0) showLoadNotification("❌", t(source === 'fusam' ? 'fusamFailedCount' : 'pcmFailedCount', { count: fail }), '');
        }
        } finally { isLoadingPlugins = false; }
    }

    function loadLocalPluginsPhase() {
        if (localLoadStarted) return localPhasePromise;
        localLoadStarted = true;

        localPhasePromise = (async () => {
            await pluginsReady;
            if (!pluginsLoaded || _lifecycle.unloaded) { localLoadStarted = false; localPhasePromise = null; return; }
            await runPluginBatch(subPlugins.filter(p => isPluginEnabled(p)), 'local');
        })();
        return localPhasePromise;
    }

    async function loadAccountPluginsPhase() {
        if (accountLoadStarted) return;
        accountLoadStarted = true;

        await pluginsReady;
        if (!pluginsLoaded) { accountLoadStarted = false; return; }

        const settingsReady = await ensureAccountSettingsLoaded();
        if (!settingsReady || _lifecycle.unloaded) { accountLoadStarted = false; return; }

        if (localPhasePromise) await localPhasePromise;
        if (_lifecycle.unloaded) { accountLoadStarted = false; return; }

        const pending = subPlugins.filter(p => isPluginEnabledInAccount(p) && !loadedPlugins.has(p.id) && !pluginLoadPromises.has(p.id));
        await runPluginBatch(pending, 'account');
    }

    async function loadCustomPluginsPhase() {
        if (customLoadStarted) return; customLoadStarted = true;
        while (isLoadingPlugins) await new Promise(r => setTimeout(r, 500));
        const enabled = customPlugins.filter(p => p.enabled);
        if (enabled.length) await runPluginBatch(enabled, 'custom');
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
        ['local', 'account', 'fusam', 'custom'].forEach(src => {
            const container = document.getElementById(`bc-plugin-content-${src}`);
            if (!container) return;
            container.querySelectorAll('.bc-plugin-item[data-plugin-id]').forEach(item => {
                const id = item.getAttribute('data-plugin-id');
                const plugin = src === 'custom' ? customPlugins.find(p => p.id === id) : src === 'fusam' ? fusamPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
                if (!plugin) return;

                let pass = true;
                if (filterMode === 'enabled')  pass = src === 'account' ? isPluginEnabledInAccount(plugin) : ((src === 'custom' || src === 'fusam') ? plugin.enabled : isPluginEnabled(plugin));
                if (filterMode === 'disabled') pass = !(src === 'account' ? isPluginEnabledInAccount(plugin) : ((src === 'custom' || src === 'fusam') ? plugin.enabled : isPluginEnabled(plugin)));

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
        box.style.cssText = "background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif;color:#fff;";
        const log = isCJK() ? (remoteChangelogTW.length ? remoteChangelogTW : remoteChangelogEN) : (remoteChangelogEN.length ? remoteChangelogEN : remoteChangelogTW);
        const items = (log.length ? log : ["..."]).map(c => `<li style="margin:6px 0;font-size:13px;color:#d4c8f5;">${escapeHtml(c)}</li>`).join('');
        box.innerHTML = `<div style="font-size:16px;font-weight:600;margin-bottom:4px;">${escapeHtml(t('changelogTitle'))}</div><div style="font-size:12px;color:#a0a9c0;margin-bottom:16px;">v${escapeHtml(remoteVersion)}</div><ul style="padding-left:18px;margin:0 0 20px;list-style:disc;">${items}</ul><button id="pcm-cl-close" style="width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:14px;cursor:pointer;font-family:inherit;">${escapeHtml(t('changelogClose'))}</button>`;
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
        .bc-plugin-container *,.bc-plugin-panel *,.bc-plugin-btn-group * { font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; user-select:none; -webkit-user-select:none; }

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
        .bc-plugin-item.runtime-warning { border-color:rgba(245,158,11,.5); }
        .bc-plugin-item:hover { background:rgba(255,255,255,0.08); border-color:rgba(127,83,205,0.3); transform:translateY(-2px); box-shadow:0 8px 20px rgba(127,83,205,0.15); }
        .bc-plugin-item-header { display:flex; align-items:center; position:relative; }
        .bc-plugin-icon { font-size:22px; margin-right:10px; display:flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:10px; background:rgba(255,255,255,0.1); flex-shrink:0; overflow:hidden; }
        .bc-plugin-icon img { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; }
        .bc-plugin-info { flex:1; color:#fff; min-width:0; }
        .bc-plugin-name { font-size:13px; font-weight:500; margin:0; color:#fff; }
        .bc-plugin-desc { font-size:11px; color:#a0a9c0; margin:3px 0 0; line-height:1.4; }
        .bc-plugin-runtime-status { display:block; min-height:13px; margin-top:3px; color:#a0a9c0; font-size:9px; }
        .bc-plugin-runtime-status[data-status="loaded"] { color:#82d6a1; }
        .bc-plugin-runtime-status[data-status="cached"] { color:#f3c67a; }
        .bc-plugin-runtime-status[data-status="failed"] { color:#ff9292; }
        .bc-plugin-runtime-status[data-status="reload"] { color:#f3c67a; }

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
        .bc-plugin-fusam-channel { min-width:58px; height:26px; margin-left:8px; padding:0 9px; border:1px solid rgba(255,255,255,.18); border-radius:13px; color:#d7d0e7; background:rgba(255,255,255,.1); font-size:9px; font-weight:700; cursor:pointer; flex-shrink:0; }
        .bc-plugin-fusam-channel[data-state="stable"] { color:#fff; border-color:#a78bfa; background:linear-gradient(135deg,#7F53CD,#9a6cff); }
        .bc-plugin-fusam-channel[data-state="beta"] { color:#fff; border-color:#f0aa64; background:linear-gradient(135deg,#a96627,#d98b3f); }
        .bc-plugin-fusam-channel[data-state="dev"] { color:#fff; border-color:#ee78a8; background:linear-gradient(135deg,#9d3766,#ce5489); }

        .bc-plugin-retry-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:38px; height:38px; background:rgba(32,18,45,0.92); border:1px solid rgba(255,80,80,0.65); border-radius:50%; cursor:pointer; font-size:19px; color:#ff9b9b; display:flex; align-items:center; justify-content:center; transition:background .2s,color .2s,box-shadow .2s,transform .2s; z-index:4; padding:0; box-shadow:0 4px 14px rgba(0,0,0,.38); }
        .bc-plugin-retry-btn:hover { background:rgba(112,35,55,0.96); color:#fff; box-shadow:0 5px 18px rgba(255,80,80,.28); transform:translate(-50%,-50%) rotate(180deg); }

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

        .bc-liko-toggle-notification { position:fixed; box-sizing:border-box; background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 100%); color:#fff; padding:10px 14px; border-radius:10px; box-shadow:0 8px 20px rgba(127,83,205,0.25); z-index:2147483645; font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif; font-size:13px; transform:translateY(-6px); opacity:0; transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .3s ease; pointer-events:none; user-select:none; }
        .bc-liko-toggle-notification.show { transform:translateY(0); opacity:1; }
        .bc-liko-toggle-notification.hide { transform:translateY(-6px); opacity:0; }

        .bc-liko-notification-stack { position:fixed; right:20px; top:max(16px,15vh); bottom:auto; z-index:2147483648; width:min(312px,calc(100vw - 40px)); max-height:70vh; display:flex; flex-direction:column; align-items:stretch; gap:10px; pointer-events:none; }
        .bc-liko-system-notification { position:relative; box-sizing:border-box; width:100%; flex-shrink:0; background:rgba(26,32,46,0.95); border:1px solid rgba(127,83,205,0.4); color:#fff; padding:12px 16px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.3); font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif; font-size:13px; transform:translateX(340px); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s ease; user-select:none; cursor:pointer; pointer-events:auto; }
        .bc-liko-system-notification.show { transform:translateX(0); opacity:1; }
        .bc-liko-system-notification.hide { transform:translateX(320px); opacity:0; }

        @media (max-width:480px) { .bc-plugin-btn-group{right:10px;top:40px;} }
        @media (max-height:600px) { .bc-plugin-content{max-height:160px;} }

        /* PCM mobile settings UI */
        .bc-plugin-panel { width:min(390px,calc(100vw - 16px)); max-width:none; max-height:calc(100dvh - 16px); min-height:0; background:rgba(21,19,35,.96); border-color:rgba(204,190,255,.16); border-radius:28px; box-shadow:0 26px 80px rgba(0,0,0,.55); backdrop-filter:blur(22px); }
        .bc-plugin-header { padding:16px 16px 10px; text-align:left; background:linear-gradient(155deg,rgba(117,68,223,.42),rgba(25,22,42,.28)); border-bottom:1px solid rgba(204,190,255,.12); overflow:visible; }
        .bc-plugin-header::before { display:none; }
        .bc-plugin-top-row { display:flex; align-items:center; gap:10px; min-height:44px; }
        .bc-plugin-brand { width:44px; height:44px; object-fit:cover; flex:0 0 44px; border-radius:14px; box-shadow:0 8px 22px rgba(113,71,220,.32); pointer-events:none; }
        .bc-plugin-title-wrap { min-width:0; flex:1; }
        .bc-plugin-title { margin:0; font-size:17px; line-height:1.2; font-weight:700; }
        .bc-plugin-summary { display:block; margin-top:4px; color:#b9b0cb; font-size:10px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bc-plugin-header-actions { display:flex; align-items:center; gap:7px; }
        .bc-plugin-header .bc-plugin-changelog-btn,.bc-plugin-header #bc-plugin-refresh-btn,.bc-plugin-header .bc-plugin-settings-btn { width:36px; height:36px; flex:0 0 36px; border:1px solid rgba(204,190,255,.14); border-radius:12px; background:rgba(255,255,255,.055); box-shadow:none; color:#fff; font-size:16px; }
        .bc-plugin-header .bc-plugin-changelog-btn:hover,.bc-plugin-header #bc-plugin-refresh-btn:hover,.bc-plugin-header .bc-plugin-settings-btn:hover { transform:none; background:rgba(154,108,255,.15); border-color:rgba(175,145,255,.5); }
        .bc-plugin-header .bc-plugin-settings-btn.active { background:rgba(154,108,255,.3); border-color:#b99cff; }
        .bc-plugin-tabs { position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-top:13px; padding:4px; border:0; border-radius:14px; background:rgba(8,7,15,.38); overflow:hidden; }
        .bc-plugin-tabs::before { content:''; position:absolute; z-index:0; top:4px; bottom:4px; left:4px; width:var(--pcm-tab-width,calc((100% - 16px) / 3)); transform:var(--pcm-tab-offset,translateX(0)); border:1px solid rgba(190,165,255,.34); border-radius:10px; background:linear-gradient(135deg,rgba(154,108,255,.42),rgba(92,65,155,.55)); box-shadow:0 4px 16px rgba(90,48,180,.28),inset 0 1px rgba(255,255,255,.08); transition:transform .28s cubic-bezier(.22,.8,.32,1),width .2s ease; }
        .bc-plugin-tab { position:relative; z-index:1; padding:8px 5px; border:0; border-radius:10px; color:#aaa3be; font-size:11px; font-weight:700; }
        .bc-plugin-tab:hover:not(.active) { background:rgba(255,255,255,.035); }
        .bc-plugin-tab.active { color:#fff; border:0; background:transparent; box-shadow:none; text-shadow:0 0 9px rgba(218,203,255,.72); }
        .bc-plugin-search-row { gap:7px; padding:11px 14px 9px; background:transparent; border:0; }
        .bc-plugin-search { height:38px; padding:0 12px; border-color:rgba(204,190,255,.12); border-radius:12px; background:rgba(255,255,255,.045); font-size:12px; user-select:text!important; -webkit-user-select:text!important; }
        .bc-plugin-filter-btn,.bc-plugin-gear-btn { width:38px; height:38px; border-color:rgba(204,190,255,.12); border-radius:12px; background:rgba(255,255,255,.045); }
        .bc-plugin-content { max-height:none; min-height:0; padding:4px 14px max(18px,env(safe-area-inset-bottom)); touch-action:none; cursor:grab; overscroll-behavior:contain; scroll-padding-bottom:max(18px,env(safe-area-inset-bottom)); -webkit-overflow-scrolling:touch; }
        .bc-plugin-content.dragging { cursor:grabbing; }
        #bc-plugin-content-settings { touch-action:pan-y; cursor:default; overscroll-behavior:contain; }
        .bc-plugin-item { min-height:0; margin-bottom:9px; padding:10px 11px; border-color:rgba(204,190,255,.12); border-radius:18px; background:linear-gradient(145deg,rgba(46,41,70,.82),rgba(31,28,48,.92)); }
        .bc-plugin-item.enabled { background:linear-gradient(145deg,rgba(58,45,91,.9),rgba(36,30,57,.94)); border-color:rgba(154,108,255,.3); }
        .bc-plugin-item.enabled::before,.bc-plugin-item.beta-enabled::before { display:none; }
        .bc-plugin-item:hover { transform:translateY(-1px); border-color:rgba(176,143,255,.36); box-shadow:none; }
        .bc-plugin-icon { width:50px; height:50px; flex:0 0 50px; margin-right:11px; border-radius:15px; background:rgba(154,108,255,.15); font-size:20px; }
        .bc-plugin-name { font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bc-plugin-desc { font-size:10.5px; color:#aaa3be; white-space:normal; overflow-wrap:anywhere; }
        .bc-plugin-runtime-status { position:relative; padding-left:11px; margin-top:5px; font-size:9px; }
        .bc-plugin-runtime-status::before { content:''; position:absolute; left:0; top:50%; width:6px; height:6px; border-radius:50%; background:currentColor; transform:translateY(-50%); box-shadow:0 0 7px currentColor; }
        .bc-plugin-toggle { width:44px; height:26px; border-radius:16px; }
        .bc-plugin-toggle::after { top:3px; left:3px; width:20px; height:20px; }
        .bc-plugin-toggle.active::after { left:21px; }
        .bc-plugin-footer { padding:8px 16px; border-color:rgba(204,190,255,.1); background:rgba(255,255,255,.015); font-size:9px; }
        .bc-plugin-delete-btn { inset:auto; top:50%; right:62px; width:36px; height:36px; transform:translateY(-50%); border:1px solid rgba(255,100,120,.35); border-radius:12px; background:rgba(255,80,100,.12); color:#ff8394; font-size:17px; }
        .bc-plugin-delete-btn:hover { transform:translateY(-50%); background:rgba(180,30,50,.55); border-color:rgba(255,130,145,.8); }
        .bc-plugin-custom-fab { position:absolute; z-index:6; right:18px; bottom:36px; width:50px; height:50px; display:flex; align-items:center; justify-content:center; border:0; border-radius:17px; cursor:pointer; color:#fff; background:linear-gradient(145deg,#aa7cff,#7041db); box-shadow:0 12px 28px rgba(112,65,219,.45); font-size:27px; line-height:1; }
        .bc-plugin-custom-fab:hover { filter:brightness(1.08); }
        #bc-plugin-content-custom { padding-bottom:max(76px,env(safe-area-inset-bottom)); }
        .bc-plugin-empty { min-height:240px; display:flex; align-items:center; justify-content:center; }
        .bc-plugin-source-note { flex:1; min-width:0; color:#aaa3be; font-size:10px; line-height:1.35; }
        .bc-plugin-source-note a { color:#cdb9ff; }
        .bc-plugin-search-row.fusam { flex-wrap:wrap; }
        .bc-plugin-search-row.fusam .bc-plugin-source-note { order:-1; flex:0 0 100%; }
        .bc-plugin-fusam { min-height:260px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:24px; text-align:center; color:#aaa3be; }
        .bc-plugin-fusam h4 { margin:0; color:#fff; font-size:15px; }
        .bc-plugin-fusam p { margin:0; max-width:310px; font-size:11px; line-height:1.6; }
        .bc-plugin-fusam-link { padding:10px 15px; border:1px solid rgba(190,165,255,.32); border-radius:12px; color:#fff; background:linear-gradient(135deg,rgba(154,108,255,.38),rgba(92,65,155,.5)); text-decoration:none; }
        .bc-plugin-settings-overlay { position:fixed; inset:0; z-index:2147483648; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.58); backdrop-filter:blur(4px); }
        .bc-plugin-settings-card { width:min(340px,94vw); max-height:calc(100dvh - 24px); overflow-y:auto; padding:18px; border:1px solid rgba(190,165,255,.3); border-radius:20px; color:#fff; background:#1c192b; box-shadow:0 22px 60px rgba(0,0,0,.48); }
        .bc-plugin-settings-card h3 { margin:0 0 15px; font-size:16px; }
        .bc-plugin-setting-row { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:44px; border-bottom:1px solid rgba(204,190,255,.1); color:#d8d2e5; font-size:12px; }
        .bc-plugin-setting-row select { max-width:150px; padding:7px 9px; border:1px solid rgba(204,190,255,.18); border-radius:9px; color:#fff; background:#292541; }
        .bc-plugin-setting-toggle { position:relative; width:44px; height:26px; flex:0 0 44px; }
        .bc-plugin-setting-toggle input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
        .bc-plugin-setting-toggle-track { position:absolute; inset:0; border:1px solid rgba(204,190,255,.18); border-radius:16px; background:rgba(255,255,255,.09); cursor:pointer; transition:background .2s,border-color .2s; }
        .bc-plugin-setting-toggle-track::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#aaa3be; box-shadow:0 2px 6px rgba(0,0,0,.35); transition:left .22s cubic-bezier(.22,.8,.32,1),background .2s; }
        .bc-plugin-setting-toggle input:checked + .bc-plugin-setting-toggle-track { border-color:#a987fa; background:linear-gradient(135deg,#9a6cff,#7147dc); }
        .bc-plugin-setting-toggle input:checked + .bc-plugin-setting-toggle-track::after { left:21px; background:#fff; }
        .bc-plugin-settings-done { width:100%; margin-top:16px; padding:10px; border:0; border-radius:11px; color:#fff; background:linear-gradient(135deg,#9a6cff,#7147dc); }
        .bc-plugin-settings-card .bc-plugin-fusam { min-height:0; padding:14px 0 0; gap:8px; }
        .bc-plugin-settings-inline { padding:12px 4px 72px; color:#fff; }
        .bc-plugin-settings-inline h3 { margin:0 0 12px; font-size:16px; }
        .bc-plugin-settings-inline .bc-plugin-fusam { min-height:0; padding:16px 0 4px; gap:9px; }
        .bc-plugin-language-select { position:relative; min-width:154px; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-trigger { width:100%; padding:8px 10px; border:1px solid rgba(204,190,255,.2); border-radius:10px; color:#fff; background:#292541; text-align:left; cursor:pointer; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-menu { position:absolute; z-index:12; top:calc(100% + 5px); right:0; width:100%; max-height:190px; overflow-y:auto; padding:5px; border:1px solid rgba(190,165,255,.3); border-radius:11px; background:#211e34; box-shadow:0 12px 30px rgba(0,0,0,.4); scrollbar-width:thin; scrollbar-color:#9a6cff rgba(0,0,0,.35); touch-action:pan-y; overscroll-behavior:contain; cursor:default; }
        .bc-plugin-language-menu::-webkit-scrollbar { width:10px; }
        .bc-plugin-language-menu::-webkit-scrollbar-track { background:rgba(0,0,0,.35); border-radius:7px; }
        .bc-plugin-language-menu::-webkit-scrollbar-thumb { background:#8258dc; border-radius:7px; }
        .bc-plugin-language-menu::-webkit-scrollbar-thumb:hover { background:#9a6cff; }
        .bc-plugin-language-menu.dragging,.bc-plugin-language-menu.dragging * { cursor:grabbing!important; user-select:none!important; }
        .bc-plugin-language-option { display:block; width:100%; padding:8px 9px; border:0; border-radius:8px; color:#d8d2e5; background:transparent; text-align:left; cursor:pointer; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-option:hover,.bc-plugin-language-option.active { color:#fff; background:rgba(154,108,255,.28); }
        .bc-liko-toggle-notification { padding:9px 11px; border:1px solid rgba(194,170,255,.22); border-radius:14px; background:rgba(27,23,43,.97); box-shadow:0 12px 34px rgba(0,0,0,.35); }
        @media (max-width:480px) {
            .bc-plugin-panel { width:calc(100vw - 12px); min-height:0; border-radius:22px; }
            .bc-plugin-header { padding:13px 12px 8px; }
            .bc-plugin-brand { width:40px; height:40px; flex-basis:40px; border-radius:13px; }
            .bc-plugin-header .bc-plugin-changelog-btn,.bc-plugin-header #bc-plugin-refresh-btn,.bc-plugin-header .bc-plugin-settings-btn { width:32px; height:32px; flex-basis:32px; }
            .bc-plugin-search-row { padding-inline:11px; }
            .bc-plugin-content { padding-inline:11px; }
        }
        @media (max-height:600px) {
            .bc-plugin-panel { min-height:0; border-radius:18px; }
            .bc-plugin-header { padding-top:10px; }
            .bc-plugin-tabs { margin-top:8px; }
            .bc-plugin-search-row { padding-top:7px; padding-bottom:7px; }
            .bc-plugin-content { max-height:none; }
            .bc-plugin-item { min-height:0; padding:8px 9px; }
            .bc-plugin-icon { width:44px; height:44px; flex-basis:44px; }
        }
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
        isBeta = source === 'fusam'
            ? plugin.distribution === 'beta' || plugin.distribution === 'dev'
            : isTri && currentState === "beta";

        const runtime = pluginRuntime.get(plugin.id) || { status: 'idle' };
        item.className = `bc-plugin-item${isEnabled && !isBeta ? ' enabled' : ''}${isBeta ? ' beta-enabled' : ''}${failedPlugins.has(plugin.id) ? ' failed' : ''}${runtime.postLoadError ? ' runtime-warning' : ''}`;
        item.setAttribute('data-plugin-id', plugin.id);

        // XSS 防護：icon/website 只接受 https（拒 javascript: 等 scheme），進 innerHTML 前一律 escapeHtml。
        const isHttpsUrl = (u) => typeof u === 'string' && /^https:\/\//i.test(u);
        const iconUrl = isHttpsUrl(plugin.customIcon) ? plugin.customIcon : (isHttpsUrl(plugin.icon) ? plugin.icon : null);
        const fallbackIcon = plugin.iemoji || (!isHttpsUrl(plugin.icon) ? plugin.icon : null) || '🔌';
        const iconHtml = iconUrl
            ? `<img class="bc-plugin-icon-image" src="${escapeHtml(iconUrl)}" alt="" /><span class="bc-plugin-icon-fallback" hidden>${escapeHtml(fallbackIcon)}</span>`
            : `<span class="bc-plugin-icon-fallback">${escapeHtml(fallbackIcon)}</span>`;

        const infoBtnHtml = isHttpsUrl(plugin.website)
            ? `<a class="bc-plugin-info-btn" href="${escapeHtml(plugin.website)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t('visitWebsite'))}"></a>`
            : '';

        const fusamLabels = isCJK()
            ? { off: '關閉', stable: '穩定', beta: '測試', dev: '開發' }
            : { off: 'OFF', stable: 'STABLE', beta: 'BETA', dev: 'DEV' };
        const toggleHtml = source === 'fusam'
            ? `<button class="bc-plugin-fusam-channel" data-plugin-fusam-channel="${escapeHtml(plugin.id)}" data-state="${escapeHtml(plugin.distribution || 'off')}">${escapeHtml(fusamLabels[plugin.distribution || 'off'] || plugin.distribution)}</button>`
            : isTri
            ? (() => { const labels = getTriLabels(plugin); return `<button class="bc-plugin-toggle-tri" data-plugin-tri="${plugin.id}" data-source="${source}" data-state="${currentState}"><div class="bc-plugin-toggle-tri-track"></div><div class="bc-plugin-toggle-tri-labels"><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[0])}</span><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[1])}</span><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[2])}</span></div></button>`; })()
            : `<button class="bc-plugin-toggle${isEnabled ? ' active' : ''}" data-plugin="${plugin.id}" data-source="${source}"></button>`;

        const runtimeLabels = isCJK()
            ? { loading: '載入中…', loaded: '已載入', cached: '已從快取救援', failed: '載入失敗', delegated: '由 FUSAM 載入' }
            : { loading: 'Loading…', loaded: 'Loaded', cached: 'Recovered from cache', failed: 'Load failed', delegated: 'Handled by FUSAM' };
        const runtimeStatus = runtime.reloadRequired ? 'reload' : runtime.status;
        const runtimeText = runtime.reloadRequired
            ? (isCJK() ? '已停用，重新整理後生效' : 'Disabled · reload required')
            : (runtimeLabels[runtime.status] || '');
        item.innerHTML = `${infoBtnHtml}<div class="bc-plugin-item-header"><div class="bc-plugin-icon">${iconHtml}</div><div class="bc-plugin-info"><h4 class="bc-plugin-name">${escapeHtml(getPluginName(plugin))}</h4><p class="bc-plugin-desc">${escapeHtml(getPluginDescription(plugin))}</p><small class="bc-plugin-runtime-status" data-status="${escapeHtml(runtimeStatus)}">${escapeHtml(runtimeText)}</small></div>${toggleHtml}</div>`;
        const iconImage = item.querySelector('.bc-plugin-icon-image');
        if (iconImage) iconImage.addEventListener('error', () => {
            console.warn(`🐈‍⬛ [PCM] ⚠️ 插件圖片載入失敗，改用 Emoji：${plugin.id} (${iconUrl})`);
            iconImage.hidden = true;
            const fallback = item.querySelector('.bc-plugin-icon-fallback');
            if (fallback) fallback.hidden = false;
        }, { once: true });

        if (failedPlugins.has(plugin.id)) showPluginRetryBtn(plugin.id, item); // re-attach if rebuilding

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
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'bc-plugin-custom-fab';
        item.innerHTML = '＋';
        item.title = t('customAddTitle');
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

    const FUSAM_URL = 'https://sidiousious.gitlab.io/bc-addon-loader/';
    const FUSAM_MANIFEST_URLS = [
        'https://sidiousious.gitlab.io/bc-addon-loader/manifest.json',
    ];
    const FUSAM_CACHE_KEY = 'pcm_fusam_manifest_cache';
    const FUSAM_SETTINGS_KEY = 'pcm_fusam_plugin_settings';
    let fusamPluginSettings = (() => {
        try { return JSON.parse(localStorage.getItem(FUSAM_SETTINGS_KEY) || '{}') || {}; }
        catch(e) { return {}; }
    })();
    let fusamPlugins = [], fusamManifestPromise = null;
    function saveFusamPluginSettings() {
        try { localStorage.setItem(FUSAM_SETTINGS_KEY, JSON.stringify(fusamPluginSettings)); } catch(e) {}
    }
    function normalizeFusamPlugin(addon) {
        const versions = Array.isArray(addon?.versions) ? addon.versions : [];
        const saved = fusamPluginSettings[String(addon?.id || '')];
        const requestedDistribution = saved === true ? 'stable' : typeof saved === 'string' ? saved : 'off';
        const availableVersions = versions.filter(v => v?.source && ['stable', 'beta', 'dev'].includes(v?.distribution));
        const selected = availableVersions.find(v => v.distribution === requestedDistribution)
            || (saved === true ? availableVersions[0] : null);
        const manifestType = String(addon?.type || '').toLowerCase();
        return {
            ...addon,
            id: `fusam:${String(addon?.id || '')}`,
            fusamId: String(addon?.id || ''),
            url: selected?.source || '',
            fusamVersions: availableVersions.map(v => ({ distribution: v.distribution, source: v.source })),
            distribution: selected?.distribution || 'off',
            type: manifestType === 'module' ? 'mod' : manifestType === 'script' ? 'scr' : 'eval',
            enabled: !!selected,
        };
    }
    function normalizeFusamPlugins(addons) {
        return addons
            .filter(addon => String(addon?.id || '') !== 'WCE')
            .map(normalizeFusamPlugin)
            .sort((a, b) => fusamText(a.name).localeCompare(fusamText(b.name), undefined, { sensitivity: 'base', numeric: true }));
    }
    function fusamText(value) {
        if (typeof value === 'string') return value;
        if (!value || typeof value !== 'object') return '';
        const lang = getLang().toLowerCase();
        return value[lang] || value[lang === 'tw' ? 'cn' : lang] || value.en || Object.values(value).find(v => typeof v === 'string') || '';
    }
    function getCachedFusamManifest() {
        try { const data = JSON.parse(localStorage.getItem(FUSAM_CACHE_KEY) || 'null'); return Array.isArray(data?.addons) ? data : null; }
        catch(e) { return null; }
    }
    async function loadFusamManifest(force = false) {
        if (fusamPlugins.length && !force) return fusamPlugins;
        if (fusamManifestPromise && !force) return fusamManifestPromise;
        fusamManifestPromise = (async () => {
            let networkError;
            try {
                let data = null;
                for (const url of FUSAM_MANIFEST_URLS) {
                    try {
                        const { res, text } = await fetchTextWithTimeout(url, { cache: 'no-store' });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        const candidate = JSON.parse(text);
                        if (!Array.isArray(candidate.addons)) throw new Error('Invalid FUSAM manifest');
                        data = candidate; break;
                    } catch(e) { networkError = e; console.warn(`🐈‍⬛ [PCM] ⚠️ FUSAM manifest ${url}: ${e.message}`); }
                }
                if (!data) throw networkError || new Error('FUSAM manifest failed');
                localStorage.setItem(FUSAM_CACHE_KEY, JSON.stringify(data));
                fusamPlugins = normalizeFusamPlugins(data.addons);
            } catch(e) {
                const cached = getCachedFusamManifest();
                if (!cached) throw e;
                fusamPlugins = normalizeFusamPlugins(cached.addons);
                console.warn(`🐈‍⬛ [PCM] ⚠️ FUSAM manifest network failed; using cache: ${e.message}`);
            }
            return fusamPlugins;
        })();
        try { return await fusamManifestPromise; }
        finally { fusamManifestPromise = null; }
    }
    function buildFusamItem(plugin) {
        const item = buildPluginItem({ ...plugin, name: fusamText(plugin.name) || plugin.fusamId, description: fusamText(plugin.description), website: plugin.website || plugin.repository || FUSAM_URL, icon: plugin.icon || '◆' }, 'fusam');
        item.classList.add('bc-plugin-fusam-item');
        item.dataset.fusamId = plugin.fusamId;
        return item;
    }
    async function buildFusamContent(container, force = false) {
        container.innerHTML = `<div class="bc-plugin-loading">${escapeHtml(t('loadingPlugins'))}</div>`;
        try {
            const addons = await loadFusamManifest(force);
            if (!container.isConnected && !document.body.contains(container)) return;
            container.innerHTML = '';
            addons.forEach(plugin => container.appendChild(buildFusamItem(plugin)));
            applyFilter();
        } catch(e) {
            container.innerHTML = `<div class="bc-plugin-fusam"><h4>${escapeHtml(t('loadPluginsFailed'))}</h4><p>${escapeHtml(e.message)}</p><button class="bc-plugin-fusam-link" type="button">↻ ${escapeHtml(t('refreshTitle'))}</button><a class="bc-plugin-fusam-link" href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('fusamOpen'))}</a></div>`;
            container.querySelector('button')?.addEventListener('click', () => buildFusamContent(container, true));
        }
    }
    async function loadEnabledFusamPluginsPhase() {
        if (!Object.values(fusamPluginSettings).some(Boolean)) return;
        try {
            const addons = await loadFusamManifest();
            await runPluginBatch(addons.filter(plugin => plugin.enabled && plugin.url), 'fusam');
        } catch(e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ Enabled FUSAM plugins could not be loaded: ${e.message}`);
        }
    }

    const PCM_LANGS = [
        ['AUTO','🌐','AUTO'], ['TW','🇹🇼','繁體中文'], ['CN','🇨🇳','简体中文'], ['EN','🇬🇧','English'],
        ['DE','🇩🇪','Deutsch'], ['FR','🇫🇷','Français'], ['RU','🇷🇺','Русский'], ['UA','🇺🇦','Українська'],
    ];
    function buildPcmSettingsContent(container, onDone) {
        container.innerHTML = '';
        const card = document.createElement('div');
        card.className = 'bc-plugin-settings-inline';
        card.innerHTML = `<h3>${escapeHtml(t('settingsTitle'))}</h3>
            <div class="bc-plugin-setting-row"><span>${escapeHtml(t('settingsLanguage'))}</span><div class="bc-plugin-language-select"><button type="button" class="bc-plugin-language-trigger"></button><div class="bc-plugin-language-menu" hidden></div></div></div>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t('settingsLoadNotif'))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showLoadNotifications"${pcmUiSettings.showLoadNotifications ? ' checked' : ''}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t('settingsFusam'))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showFusamTab"${pcmUiSettings.showFusamTab ? ' checked' : ''}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t('settingsCustom'))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showCustomTab"${pcmUiSettings.showCustomTab ? ' checked' : ''}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <div class="bc-plugin-fusam"><p>${escapeHtml(t('fusamLicense'))}</p><a class="bc-plugin-fusam-link" href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('fusamOpen'))}</a></div>
            <button class="bc-plugin-settings-done">${escapeHtml(t('settingsClose'))}</button>`;
        container.appendChild(card);
        let changed = false;
        const trigger = card.querySelector('.bc-plugin-language-trigger');
        const menu = card.querySelector('.bc-plugin-language-menu');
        const paintLanguage = () => {
            const entry = PCM_LANGS.find(([code]) => code === pcmUiSettings.language) || PCM_LANGS[0];
            trigger.textContent = `${entry[1]} ${entry[2]}`;
        };
        PCM_LANGS.forEach(([code, flag, name]) => {
            const option = document.createElement('button');
            option.type = 'button'; option.className = 'bc-plugin-language-option';
            option.textContent = `${flag} ${name}`;
            option.classList.toggle('active', code === pcmUiSettings.language);
            option.addEventListener('click', e => {
                e.stopPropagation(); pcmUiSettings.language = code; saveUiSettings(); changed = true;
                menu.hidden = true; paintLanguage();
                menu.querySelectorAll('.bc-plugin-language-option').forEach(btn => btn.classList.toggle('active', btn === option));
            });
            menu.appendChild(option);
        });
        enableAeeStyleDragScroll(menu);
        paintLanguage();
        trigger.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; });
        card.querySelectorAll('input[data-setting]').forEach(input => input.addEventListener('change', () => {
            pcmUiSettings[input.dataset.setting] = input.checked; saveUiSettings(); changed = true;
            if (input.dataset.setting === 'showFusamTab' || input.dataset.setting === 'showCustomTab') onDone(true);
        }));
        card.querySelector('.bc-plugin-settings-done').addEventListener('click', e => { e.stopPropagation(); onDone(changed); });
    }

    // === Add Plugin Panel =======================================

    function showAddPluginPanel() {
        if (document.getElementById('pcm-add-panel')) return;
        const overlay = document.createElement('div');
        overlay.id = 'pcm-add-panel';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;';

        const box = document.createElement('div');
        box.style.cssText = 'background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:20px;width:320px;max-width:90vw;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:\'PingFang TC\',\'Microsoft JhengHei\',\'Noto Sans TC\',\'Heiti TC\',sans-serif;color:#fff;';

        const fieldStyle = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:12px;font-family:inherit;outline:none;margin-bottom:10px;';

        box.innerHTML = `
            <div style="font-size:15px;font-weight:600;margin-bottom:14px;">${escapeHtml(t('customAddTitle'))}</div>
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t('customFieldName'))}</label>
            <input id="pcm-add-name" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t('customFieldUrl'))}</label>
            <input id="pcm-add-url"  type="text" style="${fieldStyle}" autocomplete="off" placeholder="https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t('customFieldIcon'))}</label>
            <input id="pcm-add-icon" type="text" style="${fieldStyle}" autocomplete="off" placeholder="🔌 / https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t('customFieldDesc'))}</label>
            <input id="pcm-add-desc" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t('customFieldType'))}</label>
            <div id="pcm-add-type" class="pcm-module-select" style="position:relative;margin-bottom:14px;">
                <button id="pcm-add-type-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" style="${fieldStyle.replace('margin-bottom:10px','margin-bottom:0')}text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <span id="pcm-add-type-label">${escapeHtml(t('customTypeEval'))}</span><span aria-hidden="true" style="font-size:10px;">▼</span>
                </button>
                <div id="pcm-add-type-menu" role="listbox" tabindex="-1" hidden style="position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:2;padding:4px;background:rgba(22,27,40,.99);border:1px solid rgba(167,139,250,.45);border-radius:9px;box-shadow:0 12px 28px rgba(0,0,0,.5);">
                    <button type="button" role="option" aria-selected="true" data-value="eval" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:rgba(127,83,205,.35);color:#fff;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t('customTypeEval'))}</button>
                    <button type="button" role="option" aria-selected="false" data-value="scr" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:transparent;color:#d8dcec;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t('customTypeScr'))}</button>
                    <button type="button" role="option" aria-selected="false" data-value="mod" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:transparent;color:#d8dcec;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t('customTypeMod'))}</button>
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button id="pcm-add-cancel" style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${escapeHtml(t('customBtnCancel'))}</button>
                <button id="pcm-add-confirm" style="flex:1;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${escapeHtml(t('customBtnAdd'))}</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const nameInput    = overlay.querySelector('#pcm-add-name');
        const urlInput     = overlay.querySelector('#pcm-add-url');
        const iconInput    = overlay.querySelector('#pcm-add-icon');
        const descInput    = overlay.querySelector('#pcm-add-desc');
        const typeSelect   = overlay.querySelector('#pcm-add-type');
        const typeTrigger  = overlay.querySelector('#pcm-add-type-trigger');
        const typeLabel    = overlay.querySelector('#pcm-add-type-label');
        const typeMenu     = overlay.querySelector('#pcm-add-type-menu');
        const cancelBtn    = overlay.querySelector('#pcm-add-cancel');
        const confirmBtn   = overlay.querySelector('#pcm-add-confirm');
        if (!nameInput || !urlInput || !iconInput || !descInput || !typeSelect || !typeTrigger || !typeLabel || !typeMenu || !cancelBtn || !confirmBtn) {
            console.error('🐈‍⬛ [PCM] Custom plugin panel failed to render');
            overlay.remove();
            return;
        }
        nameInput.focus();

        let selectedType = 'eval';
        const typeOptions = [...typeMenu.querySelectorAll('[role="option"]')];
        const setTypeMenuOpen = open => {
            typeMenu.hidden = !open;
            typeTrigger.setAttribute('aria-expanded', String(open));
            if (open) typeOptions.find(o => o.dataset.value === selectedType)?.focus();
        };
        const selectType = option => {
            selectedType = option.dataset.value;
            typeLabel.textContent = option.textContent;
            typeOptions.forEach(o => {
                const active = o === option;
                o.setAttribute('aria-selected', String(active));
                o.style.background = active ? 'rgba(127,83,205,.35)' : 'transparent';
            });
            setTypeMenuOpen(false);
            typeTrigger.focus();
        };
        typeTrigger.addEventListener('click', e => { e.stopPropagation(); setTypeMenuOpen(typeMenu.hidden); });
        typeOptions.forEach(option => option.addEventListener('click', e => { e.stopPropagation(); selectType(option); }));
        typeSelect.addEventListener('keydown', e => {
            if (e.key === 'Escape') { setTypeMenuOpen(false); typeTrigger.focus(); return; }
            if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
            e.preventDefault();
            if (typeMenu.hidden) { setTypeMenuOpen(true); return; }
            const current = Math.max(0, typeOptions.indexOf(document.activeElement));
            if (e.key === 'Enter' || e.key === ' ') selectType(typeOptions[current]);
            else typeOptions[(current + (e.key === 'ArrowDown' ? 1 : -1) + typeOptions.length) % typeOptions.length].focus();
        });

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

            const type = selectedType; // 'eval' | 'scr' | 'mod'
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
        box.style.cssText = 'background:rgba(26,32,46,0.98);border:1px solid rgba(255,80,80,0.3);border-radius:14px;padding:20px;width:280px;max-width:90vw;font-family:\'PingFang TC\',\'Microsoft JhengHei\',\'Noto Sans TC\',\'Heiti TC\',sans-serif;color:#fff;text-align:center;';
        box.innerHTML = `
            <div style="font-size:14px;margin-bottom:16px;line-height:1.5;">${escapeHtml(t('customDeleteConfirm', { name: plugin.name }))}</div>
            <div style="display:flex;gap:8px;">
                <button id="pcm-del-no"  style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${escapeHtml(t('customBtnCancel'))}</button>
                <button id="pcm-del-yes" style="flex:1;padding:9px;border:none;border-radius:8px;background:rgba(200,50,50,0.7);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${escapeHtml(t('customDeleteYes'))}</button>
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

        // FUSAM manifest 可同時提供 stable / beta / dev；依實際存在的通道循環選擇。
        const fusamChannel = e.target.closest('.bc-plugin-fusam-channel');
        if (fusamChannel) {
            const id = fusamChannel.getAttribute('data-plugin-fusam-channel');
            const plugin = fusamPlugins.find(p => p.id === id);
            if (!plugin) return;
            const states = ['off', ...plugin.fusamVersions.map(v => v.distribution)];
            const currentIndex = Math.max(0, states.indexOf(plugin.distribution || 'off'));
            const next = states[(currentIndex + 1) % states.length];
            const version = plugin.fusamVersions.find(v => v.distribution === next);
            plugin.distribution = next;
            plugin.enabled = next !== 'off';
            plugin.url = version?.source || '';
            if (plugin.enabled) fusamPluginSettings[plugin.fusamId] = next;
            else delete fusamPluginSettings[plugin.fusamId];
            saveFusamPluginSettings();

            const labels = isCJK()
                ? { off: '關閉', stable: '穩定', beta: '測試', dev: '開發' }
                : { off: 'OFF', stable: 'STABLE', beta: 'BETA', dev: 'DEV' };
            fusamChannel.setAttribute('data-state', next);
            fusamChannel.textContent = labels[next] || next.toUpperCase();
            const item = fusamChannel.closest('.bc-plugin-item');
            item.classList.toggle('enabled', next === 'stable');
            item.classList.toggle('beta-enabled', next === 'beta' || next === 'dev');
            showToggleNotification(next === 'off' ? '🐾' : next === 'stable' ? '🐈‍⬛' : '🧪',
                next === 'off' ? `${getPluginName(plugin)} ${t('pluginDisabled')}` : `${getPluginName(plugin)} ${labels[next] || next} ${t('pluginEnabled')}`,
                next === 'off' ? t('willNotStart') : t('willTakeEffect'));
            setPluginRuntime(id, { reloadRequired: loadedPlugins.has(id), distribution: next });
            if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, 'fusam').catch(() => {});
            return;
        }

        // Retry button
        const retryBtn = e.target.closest('.bc-plugin-retry-btn');
        if (retryBtn) {
            const id = retryBtn.getAttribute('data-retry-id');
            const isCustom = !!customPlugins.find(p => p.id === id);
            const isFusam = !!fusamPlugins.find(p => p.id === id);
            const plugin = isCustom ? customPlugins.find(p => p.id === id) : isFusam ? fusamPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
            if (!plugin) return;
            failedPlugins.delete(id);
            hidePluginRetryBtn(id);
            loadSubPlugin(plugin, isCustom ? 'custom' : isFusam ? 'fusam' : getPluginLoadSource(plugin)).catch(() => {});
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
            const plugin = src === 'custom' ? customPlugins.find(p => p.id === id) : src === 'fusam' ? fusamPlugins.find(p => p.id === id) : subPlugins.find(p => p.id === id);
            if (!plugin) return;

            if (src === 'account') {
                const newVal = !isPluginEnabledInAccount(plugin);
                if (newVal) accountPluginSettings[id] = 1; else delete accountPluginSettings[id];
                saveAccountSettings();
                toggle.classList.toggle('active', newVal);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', newVal);
                showToggleNotification(newVal ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${newVal ? t('pluginEnabled') : t('pluginDisabled')}`, newVal ? t('willTakeEffect') : t('willNotStart'));
                setPluginRuntime(id, { reloadRequired: !newVal && loadedPlugins.has(id) });
                if (newVal && !loadedPlugins.has(id) && typeof Player !== 'undefined') loadSubPlugin(plugin, 'account').catch(() => {});
            } else if (src === 'custom') {
                plugin.enabled = !plugin.enabled; saveCustomPlugins();
                toggle.classList.toggle('active', plugin.enabled);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', plugin.enabled);
                showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${plugin.name} ${plugin.enabled ? t('pluginEnabled') : t('pluginDisabled')}`, plugin.enabled ? t('willTakeEffect') : t('willNotStart'));
                setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
                if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, 'custom').catch(() => {});
            } else if (src === 'fusam') {
                plugin.enabled = !plugin.enabled;
                fusamPluginSettings[plugin.fusamId] = plugin.enabled;
                saveFusamPluginSettings();
                toggle.classList.toggle('active', plugin.enabled);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', plugin.enabled);
                showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${plugin.enabled ? t('pluginEnabled') : t('pluginDisabled')}`, plugin.enabled ? t('willTakeEffect') : t('willNotStart'));
                setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
                if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, 'fusam').catch(() => {});
            } else {
                plugin.enabled = !plugin.enabled;
                pluginSettings[id] = plugin.enabled; saveSettings(pluginSettings);
                toggle.classList.toggle('active', plugin.enabled);
                toggle.closest('.bc-plugin-item').classList.toggle('enabled', plugin.enabled);
                showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${plugin.enabled ? t('pluginEnabled') : t('pluginDisabled')}`, plugin.enabled ? t('willTakeEffect') : t('willNotStart'));
                setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
                if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, 'local').catch(() => {});
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
            setPluginRuntime(id, { reloadRequired: next === 'off' && loadedPlugins.has(id) });
            if (next !== 'off' && !loadedPlugins.has(id)) loadSubPlugin(plugin, src === 'account' ? 'account' : 'local').catch(() => {});
        }
    }

    // === Draggable ==============================================

    function enableAeeStyleDragScroll(area) {
        let drag = null, suppressClick = false;
        const onPointerDown = event => {
            if (!event.isPrimary || event.button !== 0 || area.scrollHeight <= area.clientHeight + 1) return;
            drag = { pointerId:event.pointerId, startX:event.clientX, startY:event.clientY, startScrollTop:area.scrollTop, dragging:false };
        };
        const onPointerMove = event => {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
            if (!drag.dragging) {
                if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx)) return;
                drag.dragging = true; area.classList.add('dragging');
                try { area.setPointerCapture(event.pointerId); } catch(e) {}
            }
            event.preventDefault();
            area.scrollTop = drag.startScrollTop - dy;
        };
        const finish = event => {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const wasDragging = drag.dragging;
            drag = null; area.classList.remove('dragging');
            if (!wasDragging) return;
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
        };
        area.addEventListener('pointerdown', onPointerDown, true);
        area.addEventListener('pointermove', onPointerMove, { capture:true, passive:false });
        area.addEventListener('pointerup', finish, true);
        area.addEventListener('pointercancel', finish, true);
        area.addEventListener('click', event => {
            if (!suppressClick) return;
            event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
        }, true);
    }

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

    function enableMomentumScroll(container) {
        let pointerId = null, lastY = 0, lastTime = 0, velocity = 0;
        let dragged = false, inertiaFrame = 0, suppressClick = false;

        const stopInertia = () => { if (inertiaFrame) cancelAnimationFrame(inertiaFrame); inertiaFrame = 0; };
        const runInertia = () => {
            if (Math.abs(velocity) < 0.015) { inertiaFrame = 0; return; }
            const before = container.scrollTop;
            container.scrollTop += velocity * 16;
            velocity *= 0.94;
            if (container.scrollTop === before) { inertiaFrame = 0; return; }
            inertiaFrame = requestAnimationFrame(runInertia);
        };

        container.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('input,select,textarea,.bc-plugin-language-select')) return;
            stopInertia(); pointerId = e.pointerId; lastY = e.clientY; lastTime = performance.now();
            velocity = 0; dragged = false; suppressClick = false;
        });
        container.addEventListener('pointermove', e => {
            if (pointerId !== e.pointerId) return;
            const now = performance.now(), deltaY = e.clientY - lastY, elapsed = Math.max(1, now - lastTime);
            const threshold = e.pointerType === 'touch' ? 8 : 4;
            if (!dragged && Math.abs(deltaY) > threshold) {
                dragged = true; container.classList.add('dragging');
                container.setPointerCapture?.(pointerId);
            }
            if (dragged) {
                e.preventDefault();
                container.scrollTop -= deltaY;
                const instantVelocity = (-deltaY / elapsed) * 1.35;
                velocity = velocity * 0.65 + instantVelocity * 0.35;
                lastY = e.clientY; lastTime = now;
            }
        });
        const finish = e => {
            if (pointerId !== e.pointerId) return;
            if (container.hasPointerCapture?.(pointerId)) container.releasePointerCapture(pointerId);
            pointerId = null;
            container.classList.remove('dragging'); suppressClick = dragged;
            if (dragged && Math.abs(velocity) >= 0.015) inertiaFrame = requestAnimationFrame(runInertia);
            setTimeout(() => { suppressClick = false; dragged = false; });
        };
        container.addEventListener('pointerup', finish);
        container.addEventListener('pointercancel', finish);
        container.addEventListener('click', e => {
            if (!suppressClick) return;
            e.preventDefault(); e.stopImmediatePropagation();
        }, true);
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
        floatBtn.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png" alt="🐱" />`;
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
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'bc-plugin-settings-btn';
        settingsBtn.innerHTML = '⚙';
        settingsBtn.title = t('settingsTitle');

        btnGroup.append(floatBtn);
        document.body.appendChild(btnGroup);
        makeDraggable(btnGroup);
        applyFloatingBtnVisibility();
        window.Liko?.__PCMFusamCompat__?.applyButtonOptions?.();

        // ── Panel ──
        const panel = document.createElement('div');
        panel.id = 'bc-plugin-panel';
        panel.className = 'bc-plugin-panel';

        // Header
        const header = document.createElement('div');
        header.className = 'bc-plugin-header';
        header.innerHTML = `<div class="bc-plugin-top-row"><img class="bc-plugin-brand" src="https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png" alt=""><div class="bc-plugin-title-wrap"><h3 class="bc-plugin-title">${t('welcomeTitle')}</h3><small class="bc-plugin-summary"></small></div><div class="bc-plugin-header-actions"></div></div>`;
        header.querySelector('.bc-plugin-header-actions').append(changelogBtn, refreshBtn, settingsBtn);
        refreshBtn.style.display = 'flex';
        changelogBtn.style.display = 'flex';

        // Tabs
        const tabsBar = document.createElement('div');
        tabsBar.className = 'bc-plugin-tabs';
        tabsBar.dataset.active = 'local';
        const tabs = {
            local:   document.createElement('button'),
            account: document.createElement('button'),
            fusam:   document.createElement('button'),
            custom:  document.createElement('button'),
        };
        tabs.local.className   = 'bc-plugin-tab active';
        tabs.account.className = 'bc-plugin-tab';
        tabs.fusam.className   = 'bc-plugin-tab';
        tabs.custom.className  = 'bc-plugin-tab';
        tabs.local.textContent   = t('tabLocal');
        tabs.account.textContent = t('tabAccount');
        tabs.fusam.textContent   = t('tabFusam');
        tabs.custom.textContent  = t('tabCustom');
        tabs.fusam.style.display  = pcmUiSettings.showFusamTab ? '' : 'none';
        tabs.custom.style.display = pcmUiSettings.showCustomTab ? '' : 'none';
        tabsBar.append(tabs.local, tabs.account, tabs.fusam, tabs.custom);
        header.appendChild(tabsBar);

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
        const sourceNote = document.createElement('div');
        sourceNote.className = 'bc-plugin-source-note';
        sourceNote.style.display = 'none';
        sourceNote.innerHTML = `${escapeHtml(t('fusamDesc'))} <a href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('fusamOpen'))}</a>`;
        searchRow.append(searchInput, sourceNote, filterBtn, gearBtn);

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
        const contentFusam = document.createElement('div');
        contentFusam.id = 'bc-plugin-content-fusam';
        contentFusam.className = 'bc-plugin-content';
        contentFusam.style.display = 'none';
        if (pcmUiSettings.showFusamTab) buildFusamContent(contentFusam);
        const contentSettings = document.createElement('div');
        contentSettings.id = 'bc-plugin-content-settings';
        contentSettings.className = 'bc-plugin-content';
        contentSettings.style.display = 'none';
        [contentLocal, contentAccount, contentFusam, contentCustom].forEach(enableMomentumScroll);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'bc-plugin-footer';
        footer.innerHTML = `❖ <a class="bc-plugin-footer-link" href="https://awdrrawd.github.io/liko-Plugin-Repository/" target="_blank" rel="noopener noreferrer">Liko Plugin Manager v${MOD_VER}</a> ❖`;
        const customAddFab = buildAddItem();
        customAddFab.style.display = 'none';

        panel.append(header, searchRow, contentLocal, contentAccount, contentFusam, contentCustom, contentSettings, footer, customAddFab);
        document.body.appendChild(panel);

        let isOpen = false;
        const contents = { local: contentLocal, account: contentAccount, fusam: contentFusam, custom: contentCustom };
        const visibleTabKeys = ['local', 'account', ...(pcmUiSettings.showFusamTab ? ['fusam'] : []), ...(pcmUiSettings.showCustomTab ? ['custom'] : [])];
        tabsBar.style.gridTemplateColumns = `repeat(${visibleTabKeys.length},1fr)`;
        tabsBar.style.setProperty('--pcm-tab-width', `calc((100% - ${8 + (visibleTabKeys.length - 1) * 4}px) / ${visibleTabKeys.length})`);

        const updateHeaderSummary = () => {
            if (activeTab === 'fusam') { header.querySelector('.bc-plugin-summary').textContent = `${fusamPlugins.length} ${t('plugins')} · ${fusamPlugins.filter(plugin => plugin.enabled).length} ${t('pluginEnabled')}`; return; }
            if (activeTab === 'local' && (!pluginsLoaded || contents.local.querySelector('.bc-plugin-loading'))) {
                header.querySelector('.bc-plugin-summary').textContent = t('loadingPlugins');
                return;
            }
            const items = [...contents[activeTab].querySelectorAll('.bc-plugin-item:not(.bc-plugin-add-item)')];
            const enabled = items.filter(item => item.classList.contains('enabled') || item.classList.contains('beta-enabled')).length;
            header.querySelector('.bc-plugin-summary').textContent = `${items.length} ${t('plugins')} · ${enabled} ${t('pluginEnabled')}`;
        };
        const summaryObserver = new MutationObserver(updateHeaderSummary);
        Object.values(contents).forEach(content => summaryObserver.observe(content, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class'],
        }));

        const switchTab = (tab) => {
            activeTab = tab;
            tabsBar.dataset.active = tab;
            const tabIndex = Math.max(0, visibleTabKeys.indexOf(tab));
            tabsBar.style.setProperty('--pcm-tab-offset', `translateX(calc(${tabIndex * 100}% + ${tabIndex * 4}px))`);
            Object.keys(tabs).forEach(k => {
                tabs[k].classList.toggle('active', k === tab);
                contents[k].style.display = k === tab ? '' : 'none';
            });
            gearBtn.style.display = tab === 'custom' ? '' : 'none';
            customAddFab.style.display = tab === 'custom' ? 'flex' : 'none';
            const isFusam = tab === 'fusam';
            searchRow.classList.toggle('fusam', isFusam);
            searchInput.style.display = filterBtn.style.display = '';
            sourceNote.style.display = isFusam ? '' : 'none';
            if (tab === 'account') buildAccountContent(contentAccount);
            if (tab === 'custom')  buildCustomContent(contentCustom);
            applyFilter();
            updateHeaderSummary();
        };

        let settingsOpen = false, settingsReturnTab = 'local';
        const closeSettings = changed => {
            settingsOpen = false; settingsBtn.classList.remove('active');
            if (changed) {
                document.getElementById('bc-plugin-btn-group')?.remove();
                document.getElementById('bc-plugin-panel')?.remove();
                currentUIState = null; createManagerUI();
                return;
            }
            contentSettings.style.display = 'none';
            tabsBar.style.display = '';
            searchRow.style.display = '';
            switchTab(settingsReturnTab);
        };
        const openSettings = () => {
            if (settingsOpen) { closeSettings(false); return; }
            settingsOpen = true; settingsReturnTab = activeTab;
            settingsBtn.classList.add('active');
            tabsBar.style.display = 'none'; searchRow.style.display = 'none';
            Object.values(contents).forEach(content => { content.style.display = 'none'; });
            customAddFab.style.display = 'none'; contentSettings.style.display = '';
            header.querySelector('.bc-plugin-summary').textContent = t('settingsTitle');
            buildPcmSettingsContent(contentSettings, closeSettings);
        };

        tabs.local.addEventListener('click',   () => switchTab('local'));
        tabs.account.addEventListener('click', () => switchTab('account'));
        tabs.fusam.addEventListener('click',   () => switchTab('fusam'));
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

        let closeRebuildTimer = null, closeTransitionHandler = null;
        const cancelClosedRebuild = () => {
            if (closeRebuildTimer) clearTimeout(closeRebuildTimer);
            closeRebuildTimer = null;
            if (closeTransitionHandler) panel.removeEventListener('transitionend', closeTransitionHandler);
            closeTransitionHandler = null;
        };
        const finalizeClosedRebuild = () => {
            if (isOpen || !panel.isConnected) return;
            cancelClosedRebuild();
            const groupRect = btnGroup.getBoundingClientRect();
            activeTab = 'local';
            searchQuery = ''; filterMode = 'all'; isCustomEditMode = false;
            if (_docClickHandler) {
                document.removeEventListener('click', _docClickHandler);
                _docClickHandler = null;
            }
            summaryObserver.disconnect();
            document.getElementById('pcm-add-panel')?.remove();
            document.getElementById('pcm-delete-panel')?.remove();
            panel.remove(); btnGroup.remove();
            currentUIState = null;
            createManagerUI();
            const rebuiltGroup = document.getElementById('bc-plugin-btn-group');
            if (rebuiltGroup) {
                rebuiltGroup.style.left = Math.max(0, Math.min(window.innerWidth - rebuiltGroup.offsetWidth, groupRect.left)) + 'px';
                rebuiltGroup.style.top = Math.max(0, Math.min(window.innerHeight - rebuiltGroup.offsetHeight, groupRect.top)) + 'px';
                rebuiltGroup.style.right = 'auto';
            }
        };
        const closeAndRebuildManager = () => {
            if (!isOpen) return;
            isOpen = false;
            panel.classList.remove('show');
            document.getElementById('pcm-add-panel')?.remove();
            document.getElementById('pcm-delete-panel')?.remove();
            cancelClosedRebuild();
            closeTransitionHandler = event => {
                if (event.target !== panel || (event.propertyName !== 'transform' && event.propertyName !== 'opacity')) return;
                finalizeClosedRebuild();
            };
            panel.addEventListener('transitionend', closeTransitionHandler);
            closeRebuildTimer = setTimeout(finalizeClosedRebuild, 460);
        };

        floatBtn.addEventListener('click', e => {
            if (e.target !== floatBtn && e.target !== floatBtn.querySelector('img')) return;
            e.preventDefault(); e.stopPropagation();
            if (isOpen) {
                closeAndRebuildManager();
                return;
            } else {
                cancelClosedRebuild();
                isOpen = true;
                panel.classList.add('show');
                // Calculate panel position — always clamped within viewport
                const gr     = btnGroup.getBoundingClientRect();
                const vw     = window.innerWidth;
                const vh     = window.innerHeight;
                const pWidth = Math.min(390, vw - 12);
                panel.style.width = pWidth + 'px';

                let left = gr.left - pWidth - 12;
                if (left < 10) left = Math.max(10, (vw - pWidth) / 2);  // center if no room on left
                left = Math.max(10, Math.min(vw - pWidth - 10, left));

                const compactViewport = vw <= 480 || vh <= 600;
                const top = compactViewport ? 6 : Math.max(10, Math.min(gr.top, vh - 200));
                panel.style.left     = left + 'px';
                panel.style.right    = 'auto';
                panel.style.top      = top + 'px';
                panel.style.maxHeight = (vh - top - (compactViewport ? 6 : 20)) + 'px';

                if (pluginsLoaded && contentLocal.querySelector('.bc-plugin-loading')) {
                    contentLocal.innerHTML = ''; subPlugins.forEach(p => contentLocal.appendChild(buildPluginItem(p, 'local')));
                    applyFilter();
                    updateHeaderSummary();
                }
            }
        });

        refreshBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); refreshPluginList(); });
        changelogBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showChangelogModal(); });
        settingsBtn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openSettings(); });

        [contentLocal, contentAccount, contentFusam, contentCustom].forEach(c => c.addEventListener('click', e => { handlePluginToggle(e); setTimeout(updateHeaderSummary); }));
        updateHeaderSummary();

        if (_docClickHandler) document.removeEventListener('click', _docClickHandler);
        _docClickHandler = e => {
            if (!panel.contains(e.target) && !btnGroup.contains(e.target) && isOpen) {
                closeAndRebuildManager();
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
        if (panel) { const r = panel.getBoundingClientRect(); const width = Math.min(250, Math.max(180, panel.clientWidth - 110)); notif.style.top = (r.top + 14) + "px"; notif.style.width = width + "px"; notif.style.left = (r.left + Math.max(58, (panel.clientWidth - width) / 2)) + "px"; notif.style.right = "auto"; }
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">${escapeHtml(icon)}</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div><div style="font-size:11px;opacity:.88;">${escapeHtml(message)}</div>`;
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add('show')));
        toggleNotifTimer = setTimeout(() => { notif.classList.remove('show'); notif.classList.add('hide'); setTimeout(() => notif?.parentNode?.removeChild(notif), 350); }, 1800);
    }

    function getNotificationStack() {
        let stack = document.getElementById('pcm-notification-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'pcm-notification-stack';
            stack.className = 'bc-liko-notification-stack';
            document.body.appendChild(stack);
        }
        return stack;
    }
    function dismissStackNotification(notif) {
        if (!notif || notif.dataset.dismissing === 'true') return;
        notif.dataset.dismissing = 'true';
        notif.classList.remove('show');
        notif.classList.add('hide');
        setTimeout(() => {
            const stack = notif.parentElement;
            notif.remove();
            if (stack?.id === 'pcm-notification-stack' && !stack.children.length) stack.remove();
        }, 400);
    }
    function showPreviousPluginErrorNotice() {
        if (!previousPluginError?.pluginId || document.getElementById('pcm-previous-error-notif')) return;
        const pluginName = previousPluginError.pluginName || previousPluginError.pluginId;
        const notif = document.createElement('div');
        notif.id = 'pcm-previous-error-notif';
        notif.className = 'bc-liko-system-notification';
        const title = isCJK() ? '上次插件錯誤' : 'Previous plugin error';
        const message = isCJK()
            ? `上次 ${pluginName} 插件發生錯誤；若仍持續發生，建議暫時停用。`
            : `${pluginName} reported an error last time. If it continues, consider disabling it.`;
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">⚠️</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div><div style="font-size:11px;opacity:.85;">${escapeHtml(message)}</div>`;
        const dismiss = () => dismissStackNotification(notif);
        notif.addEventListener('click', dismiss, { once: true });
        getNotificationStack().appendChild(notif);
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add('show')));
        setTimeout(dismiss, 8000);
        previousPluginError = null;
    }
    function showNotification(icon, title, message, durationMs = 3500) { _createSystemNotif(icon, title, message, durationMs); }
    function showLoadNotification(icon, title, message, durationMs = 3500) { if (pcmUiSettings.showLoadNotifications) _createSystemNotif(icon, title, message, durationMs); }
    function _createSystemNotif(icon, title, message, durationMs = 3500) {
        const notif = document.createElement("div");
        notif.className = "bc-liko-system-notification";
        notif.innerHTML = `<div style="display:flex;align-items:center;${message ? 'margin-bottom:2px;' : ''}"><span style="font-size:16px;margin-right:7px;">${escapeHtml(icon)}</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div>${message ? `<div style="font-size:11px;opacity:.85;">${escapeHtml(message)}</div>` : ''}`;
        getNotificationStack().appendChild(notif);
        notif.addEventListener('click', () => dismissStackNotification(notif), { once: true });
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add('show')));
        setTimeout(() => dismissStackNotification(notif), durationMs);
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
                const info = getPluginAdditionalInfo(p);
                list += `${on} ${p.icon || ''} ${getPluginName(p)}\n  ${getPluginDescription(p)}${info ? `\n  💡 ${info}` : ''}\n\n`;
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
            try { if (pcmUiSettings.showLoadNotifications) { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${t('shortLoaded')}</font>`, Timeout: 60000 }); showLoadNotification("🐈‍⬛", "PCM", t('loaded', { ver: MOD_VER })); } } catch(e) {}
        });
    }

    // === Preference Page ========================================

    async function registerPreferencePage() {
        let n = 0;
        while (typeof PreferenceRegisterExtensionSetting !== 'function' && n < 60) { if (_lifecycle.unloaded) return; await new Promise(r => setTimeout(r, 1000)); n++; }
        if (typeof PreferenceRegisterExtensionSetting !== 'function' || _lifecycle.unloaded) return;

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
            Image: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png",
            click: window.PreferenceSubscreenPCMSettingsClick,
            run:   window.PreferenceSubscreenPCMSettingsRun,
            exit:  window.PreferenceSubscreenPCMSettingsExit,
            load:  window.PreferenceSubscreenPCMSettingsLoad,
        });
    }

    // === 初始化 =================================================

    // 系統依賴依序抓（Pages 優先、jsDelivr 次之、raw 保底），絕不並行同打兩邊。
    // Pages 走 Fastly：push 後幾秒即新、且不像 raw 會 429；jsDelivr(@main) 邊緣快取數小時、
    // 各 POP 不一致，搶第一會抓到舊版（BC_ChatRoomButtons 等已更新卻在 EBC 抓到舊的即此故）。
    // raw 有嚴格速率限制、EBC 單一 IP 啟動突發易觸發 429，只當最後保底。
    // 本地測試時 window.LikoDevBase 只有單一 localhost。
    const _DEP_BASES = (typeof window !== 'undefined' && window.LikoDevBase)
        ? [window.LikoDevBase]
        : [
            "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/",
            "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/",
            "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/",
        ];

    function _injectCode(code) {
        const s = document.createElement('script');
        s.textContent = code;              // 內聯 script → 同步執行
        document.head.appendChild(s);
    }

    // 依序抓取並驗證內容（避免把 404 的 HTML 當 JS 注入）。不加破快取 query，重用 HTTP 快取遠離 429。
    async function _fetchDep(rel) {
        let lastErr;
        for (const base of _DEP_BASES) {
            try {
                const { res, text } = await fetchTextWithTimeout(base + rel, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                if (!text || text.trimStart().startsWith('<')) throw new Error('bad content');
                return text;
            } catch(e) { lastErr = e; console.warn(`🐈‍⬛ [PCM] ⚠️ ${base}${rel}: ${e.message}`); }
        }
        throw lastErr ?? new Error('all bases failed');
    }

    async function _loadDep(rel) { _injectCode(await _fetchDep(rel)); }
    // BC_ChatRoomButtons.js 開發先告一段落
    /*async function _loadCrbFromRaw() {
        const url = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/BC_ChatRoomButtons.js';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!text || text.trimStart().startsWith('<')) throw new Error('bad content');
        _injectCode(text);
    }*/

    async function _ensureDeps() {
        // bcmodsdk must exist before registerMod — must be first
        if (typeof bcModSdk === 'undefined') {
            await _loadDep("expand/bcmodsdk.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ bcmodsdk:", e.message));
        }
        // i18n 引擎：能力偵測（ensure 為 v2 專有），沒有才載入
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') {
            await _loadDep("expand/BC_i18n.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ BC_i18n.js:", e.message));
        }
        // PCM 字庫：一律載入。不用 has('PCM','tabLocal') 判斷，否則會被本體內建的 EN fallback
        // 誤判成「已載入」而跳過、只剩英文。（PCM-i18n.js 內部自帶輪詢等引擎就位後 register）
        await _loadDep("Translation/PCM-i18n.js").catch(e => console.warn("🐈‍⬛ [PCM] ⚠️ PCM-i18n.js:", e.message));

        // 其餘系統擴充 —— 已就位就跳過
        const rest = [
            { rel: "expand/BC_toast_system.user.js",   ready: () => !!window.Liko?.__Sys_Toast__ },
            { rel: "expand/BC_ThemeColorCheck.js",      ready: () => !!window.Liko?.__Sys_ColorAPI__ },
            { rel: "expand/BC_ChatRoomButtons.js",      ready: () => !!window.Liko?.__Sys_ChatRoomButtons__ },
        ];
        /*if (!window.Liko?.__Sys_ChatRoomButtons__) {
            await _loadCrbFromRaw().catch(e => console.warn('🐈‍⬛ [PCM] ⚠️ RAW BC_ChatRoomButtons.js:', e.message));
        }*/
        for (const { rel, ready } of rest) {
            if (ready()) continue;
            await _loadDep(rel).catch(e => console.warn(`🐈‍⬛ [PCM] ⚠️ ${rel}:`, e.message));
        }
    }

    // === 提早啟動（early-boot）==================================
    // 少數插件的 UI 必須在「登入前」就位（LCE 的美化登入介面 + 帳號記憶），
    // 不能等 Plugins.json 抓完才拿到網址。這裡只烤「id + 網址」，metadata（名稱/
    // 圖示/描述/i18n）仍以 Plugins.json 為唯一真相源 —— 所以 LCE 不需要 pcmskip，
    // 清單照常只出現一筆。啟用與否讀本地 pluginSettings（登入前就在 localStorage）。
    // loadedPlugins 以 id 去重：之後 Plugins.json 到了、正常 phase 再跑也不會重載。
    const EARLY_BOOT = [
        { id: "Liko-LCE",
          url: "https://awdrrawd.github.io/BC-LCE/assets/main.js",
          mirrorUrl: "https://awdrrawd.github.io/BC-LCE/loader.user.js",
          type: "mod" },
    ];

    // 與 applyPluginSettings 的預設對齊：undefined＝未設定＝停用；off/false/0 皆停用，
    // 其餘（true / "on" / "beta"）視為啟用。early-boot 只看本地啟用（登入前沒有帳號設定）。
    function earlyBootEnabled(e) {
        const saved = pluginSettings[e.id];
        return saved !== undefined && saved !== false && saved !== "off" && saved !== 0;
    }

    function earlyBootPlugins() {
        for (const e of EARLY_BOOT) {
            if (!earlyBootEnabled(e)) continue;
            // enabled:true 讓 loadSubPluginOnce 內部的來源啟用檢查通過（LCE 非三段式，走 p.enabled）。
            loadSubPlugin({ ...e, enabled: true }, 'local').catch(() => {});
        }
    }

    // _ensureDeps runs async before everything else
    (async () => {
        // early-boot 插件（LCE）先於 PCM 系統依賴啟動：LCE 只需要 @require 同步載入的 bcModSdk，
        // 不依賴 i18n / toast / 顏色 API / 聊天按鈕。所以 import() 立刻發起（自己就會下載 main.js），
        // 與 _ensureDeps 的網路抓取完全平行 —— LCE 的登入介面不必再等 PCM 那串依賴串行抓完。
        // 這是消除「原生登入畫面先閃、LCE 才蓋上」延遲的第一步（LCE 端仍需自己盡早注入 overlay）。
        earlyBootPlugins();

        await _ensureDeps();

        try {
            if (!bcModSdk?.registerMod) { console.error("🐈‍⬛ [PCM] ❌ bcModSdk not available"); return; }
            modApi = bcModSdk.registerMod({ name: "Liko - PCM", fullName: "Liko's Plugin Collection Manager", version: MOD_VER, repository: "https://github.com/awdrrawd/liko-Plugin-Repository" });
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

        // 短暫等待 TranslationLanguage 就位（done/unloaded 判斷避免遞迴 setTimeout 鏈背景重排）
        await new Promise(r => {
            let done = false;
            const finish = () => { if (!done) { done = true; r(); } };
            const check = () => {
                if (done || _lifecycle.unloaded) return finish();
                if (typeof TranslationLanguage !== 'undefined') return finish();
                setTimeout(check, 100);
            };
            check();
            setTimeout(finish, 3000);
        });

        lastDetectedLanguage = getLang();
        customPlugins = loadCustomPlugins();
        installPCMReadOnlyApi();

        injectStyles();
        setTimeout(showPreviousPluginErrorNotice, 1200);
        monitorPageChanges();
        tryRegisterCommand();

        initPlugins();
        loadLocalPluginsPhase();
        loadAccountPluginsPhase();
        setTimeout(() => loadCustomPluginsPhase(), 5000);
        setTimeout(() => loadEnabledFusamPluginsPhase(), 5500);
        registerPreferencePage();

        if (typeof modApi.onUnload === 'function') modApi.onUnload(() => {
            _lifecycle.unloaded = true; // 讓各輪詢鏈停止重排
            _lifecycle.intervals.forEach(id => clearInterval(id));
            _lifecycle.intervals.length = 0;
            if (_lifecycle.mousemoveHandler) { document.removeEventListener("mousemove", _lifecycle.mousemoveHandler); _lifecycle.mousemoveHandler = null; }
            window.removeEventListener('error', _onPluginWindowError);
            window.removeEventListener('unhandledrejection', _onPluginUnhandledRejection);
            document.getElementById('pcm-notification-stack')?.remove();
            isInitialized = false;
        });
    }
})();
