// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.6.0
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// @updateURL    https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// ==/UserScript==
(function() {
    "use strict";

    // ============================================================
    // === 基礎設定 ================================================
    // ============================================================

    let modApi;
    const modversion = "1.6.0";

    // === 生命週期管理 ===
    let isInitialized = false;
    const _lifecycle = {
        intervals: [],
        observer: null,
        mousemoveHandler: null,
    };

    // === 角色快取 ===
    let cachedViewingCharacter = null;
    let lastCharacterCheck = 0;
    let lastScreenCheck = null;
    let lastScreenCheckTime = 0;
    const CHARACTER_CACHE_TIME = 200;
    const SCREEN_CACHE_TIME = 200;

    // ============================================================
    // === PCM 徽章系統（BCT 握手模式）============================
    // ============================================================

    const PCM_HIDDEN_MSG = "PCM_BADGE_INIT";

    const PCM_BADGE_CONFIG = {
        offsetX: 240, offsetY: 25, size: 36,
        showBackground: false,
        backgroundColor: "#7F53CD", borderColor: "#FFFFFF", borderWidth: 1
    };

    let pcmBadgeImage = null;
    let pcmImageLoaded = false;
    const hoveredCharacters = new Set();
    const characterDrawPositions = new Map();

    // 清除舊版 OnlineSharedSettings.PCM 殘留，並設定自身 PCM 狀態
    // OnlineSharedSettings 本身保留，未來可擴充其他用途
    function cleanupLegacyOnlineSettings() {
        const doSetup = () => {
            try {
                // 清除舊版殘留
                if (Player?.OnlineSharedSettings?.PCM) {
                    delete Player.OnlineSharedSettings.PCM;
                    console.log("🐈‍⬛ [PCM] 🧹 已清除舊版 OnlineSharedSettings.PCM 殘留");
                }
                // 設定自身 PCM 狀態，讓自己頭上也能顯示徽章
                Player.PCM = { version: modversion };
                // Player 就緒後立即載入帳戶插件設定
                accountPluginSettings = loadAccountSettings();
                console.log("🐈‍⬛ [PCM] ☁️ 帳戶插件設定已載入");
            } catch(e) {}
        };
        // Player 已就緒則立即執行，否則輪詢等待
        if (typeof Player !== 'undefined' && Player?.AccountName) {
            doSetup();
        } else {
            const checkId = setInterval(() => {
                if (typeof Player !== 'undefined' && Player?.AccountName) {
                    clearInterval(checkId);
                    doSetup();
                }
            }, 500);
        }
    }

    // 廣播 PCM 在線訊息（握手）
    function sendPCMInitialization(requestReply = false) {
        try {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
            ServerSend("ChatRoomChat", {
                Type: "Hidden",
                Content: PCM_HIDDEN_MSG,
                Sender: Player.MemberNumber,
                Dictionary: [{
                    pcm: {
                        version: modversion,
                        replyRequested: requestReply
                    }
                }]
            });
        } catch(e) {}
    }

    // 解析收到的 PCM 握手訊息，只寫記憶體，離開房間自動消失
    function parsePCMMessage(data) {
        try {
            if (data.Type !== "Hidden" || data.Content !== PCM_HIDDEN_MSG) return;
            // Character 全域變數在 BC 完全初始化前可能不存在
            if (typeof Character === 'undefined') return;
            const sender = Character.find(c => c.MemberNumber === data.Sender);
            if (!sender || sender.ID === 0) return;

            const pcmData = data.Dictionary?.[0]?.pcm;
            if (!pcmData) return;

            sender.PCM = { version: pcmData.version };

            if (pcmData.replyRequested) sendPCMInitialization(false);
        } catch(e) {}
    }

    // 徽章圖片初始化
    function initializePCMBadgeImage() {
        if (!pcmBadgeImage) {
            pcmBadgeImage = new Image();
            pcmBadgeImage.crossOrigin = "anonymous";
            pcmBadgeImage.onload = function() { pcmImageLoaded = true; };
            pcmBadgeImage.onerror = function() { pcmImageLoaded = false; };
            pcmBadgeImage.src = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_4.png";
        }
    }

    // Hover 追蹤
    function setupHoverTracking() {
        let rafPending = false;
        function onMouseMove() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                hoveredCharacters.clear();
                try {
                    if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "ChatRoom") return;
                    if (typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null) return;
                    if (typeof ChatRoomHideIconState !== 'undefined' && ChatRoomHideIconState !== 0) return;
                    if (typeof MouseHovering !== 'function') return;
                    for (const [memberNumber, pos] of characterDrawPositions) {
                        if (MouseHovering(pos.x, pos.y, 400 * pos.zoom, 100 * pos.zoom)) {
                            hoveredCharacters.add(memberNumber);
                        }
                    }
                } catch(e) {}
            });
        }
        _lifecycle.mousemoveHandler = onMouseMove;
        document.addEventListener("mousemove", onMouseMove);
    }

    // 繪製徽章，查 character.PCM（記憶體）
    function drawPCMBadge(character, x, y, zoom) {
        try {
            if (!hoveredCharacters.has(character.MemberNumber)) return;
            if (!character.PCM) return;
            if (!pcmBadgeImage) { initializePCMBadgeImage(); return; }

            const badgeX = x + (PCM_BADGE_CONFIG.offsetX * zoom);
            const badgeY = y + (PCM_BADGE_CONFIG.offsetY * zoom);
            const badgeSize = PCM_BADGE_CONFIG.size * zoom;

            if (PCM_BADGE_CONFIG.showBackground) {
                MainCanvas.fillStyle = PCM_BADGE_CONFIG.backgroundColor;
                MainCanvas.beginPath();
                MainCanvas.arc(badgeX, badgeY, badgeSize / 2, 0, 2 * Math.PI);
                MainCanvas.fill();
                if (PCM_BADGE_CONFIG.borderWidth > 0) {
                    MainCanvas.strokeStyle = PCM_BADGE_CONFIG.borderColor;
                    MainCanvas.lineWidth = PCM_BADGE_CONFIG.borderWidth * zoom;
                    MainCanvas.stroke();
                }
            }

            if (pcmImageLoaded && pcmBadgeImage.complete) {
                MainCanvas.drawImage(
                    pcmBadgeImage,
                    badgeX - badgeSize / 2,
                    badgeY - badgeSize / 2,
                    badgeSize, badgeSize
                );
            } else {
                MainCanvas.save();
                MainCanvas.fillStyle = "#FFFFFF";
                MainCanvas.font = `bold ${Math.max(10, badgeSize / 3)}px Arial`;
                MainCanvas.textAlign = "center";
                MainCanvas.textBaseline = "middle";
                MainCanvas.fillText("PCM", badgeX, badgeY);
                MainCanvas.restore();
            }
        } catch(e) {}
    }

    // 房間人員同步
    function syncDrawPositionsWithRoom() {
        if (typeof ChatRoomCharacter === 'undefined' || !Array.isArray(ChatRoomCharacter)) return;
        const currentIds = new Set(
            ChatRoomCharacter.map(c => c?.MemberNumber).filter(id => id !== undefined)
        );
        for (const id of characterDrawPositions.keys()) {
            if (!currentIds.has(id)) {
                characterDrawPositions.delete(id);
                hoveredCharacters.delete(id);
            }
        }
    }

    // Hook 角色繪製
    function hookCharacterDrawing() {
        if (!modApi || typeof modApi.hookFunction !== 'function') return;
        const safeHook = (fnName, priority, fn) => {
            try { modApi.hookFunction(fnName, priority, fn); } catch(e) {}
        };

        safeHook('DrawCharacter', 5, (args, next) => {
            const [character, x, y, zoom] = args;
            const result = next(args);
            // 查 character.PCM（記憶體），角色離開房間後自動消失
            if (character?.PCM && character.MemberNumber !== undefined) {
                characterDrawPositions.set(character.MemberNumber, { x, y, zoom });
                drawPCMBadge(character, x, y, zoom);
            }
            return result;
        });

        safeHook('ChatRoomClearAllElements', 5, (args, next) => {
            characterDrawPositions.clear();
            hoveredCharacters.clear();
            return next(args);
        });

        safeHook('ChatRoomSync', 5, (args, next) => {
            const result = next(args);
            syncDrawPositionsWithRoom();
            // 進房間 / 房間更新時廣播，要求對方回應
            sendPCMInitialization(true);
            return result;
        });
    }

    // 統一註冊入口
    function registerPCMBadge() {
        const waitForModApi = () => {
            // 等待 modApi 與 ServerSocket 都就緒
            if (!modApi || typeof modApi.hookFunction !== 'function') {
                setTimeout(waitForModApi, 500);
                return;
            }
            if (typeof ServerSocket === 'undefined' || !ServerSocket) {
                setTimeout(waitForModApi, 500);
                return;
            }

            initializePCMBadgeImage();
            setupHoverTracking();
            cleanupLegacyOnlineSettings();
            hookCharacterDrawing();

            // 監聽其他玩家的握手訊息
            ServerSocket.on("ChatRoomMessage", parsePCMMessage);

            // 若已在房間（重載情境），立刻廣播
            if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                sendPCMInitialization(true);
            }

            if (typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    try {
                        ServerSocket.off("ChatRoomMessage", parsePCMMessage);
                        if (_lifecycle.mousemoveHandler) {
                            document.removeEventListener("mousemove", _lifecycle.mousemoveHandler);
                            _lifecycle.mousemoveHandler = null;
                        }
                        hoveredCharacters.clear();
                        characterDrawPositions.clear();
                    } catch(e) {}
                });
            }
        };
        waitForModApi();
    }

    // ============================================================
    // === JSON 來源 ===============================================
    // ============================================================

    const PLUGINS_JSON_URLS = [
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins.json",
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins.json"
    ];

    // ============================================================
    // === 語言 ====================================================
    // ============================================================

    function detectLanguage() {
        // 1. BC runtime 值（遊戲初始化後）
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        // 2. BC 存在 localStorage 的語言快取（啟動早期）
        try {
            const saved = localStorage.getItem("BondageClubLanguage");
            if (saved) return saved.toLowerCase() === 'tw' || saved.toLowerCase() === 'cn';
        } catch(e) {}

        return false;
    }
    let _isCN = detectLanguage();

    const messages = {
        en: {
            loaded: `Liko's Plugin Collection Manager v${modversion} Loaded! Click the floating button to manage plugins.`,
            shortLoaded: `📋 Liko Plugin Collection Manager Manual\n\n🎮 How to Use:\n• Click the floating button in the top right to open management panel\n• Toggle switches to enable/disable plugins\n\n📝 Available Commands:\n/pcm help - Show this manual\n/pcm list - View descriptions for all available plugins.\n\n💡 Tips:\nPlugins will auto-load after enabling, or take effect on next page refresh.\nRecommend selectively enabling plugins for the best experience.`,
            welcomeTitle: "🐈‍⬛ Plugin Manager",
            helpCommand: "Use floating button or /pcm help for more information",
            pluginLoadComplete: "Plugin loading completed",
            successLoaded: "Successfully loaded",
            plugins: "plugins",
            failed: "failed",
            pluginEnabled: "enabled",
            pluginDisabled: "disabled",
            willTakeEffect: "Plugin loaded or will take effect on next refresh",
            willNotStart: "Will not start on next load",
            visitWebsite: "Visit website",
            changelogTitle: "📋 Update Log",
            changelogClose: "Close",
            newVersionTitle: "✨ PCM Updated",
            newVersionHint: "Click 📋 to view again anytime",
            loadingPlugins: "Loading plugin list...",
            loadPluginsFailed: "Failed to load plugin list, please refresh the page",
            refreshTitle: "Force Refresh",
            refreshing: "Clearing cache and fetching latest...",
            refreshDone: "Cache updated! Refresh page to apply latest plugins"
        },
        zh: {
            loaded: `Liko的插件管理器 v${modversion} 載入完成！點擊浮動按鈕管理插件。`,
            shortLoaded: `📋 Liko 插件管理器 說明書\n\n🎮 使用方法：\n• 點擊右上角的浮動按鈕開啟管理面板\n• 切換開關來啟用/停用插件\n\n📝 可用指令：\n/pcm help - 顯示此說明書\n/pcm list - 查看所有可用插件說明\n\n💡 小提示：\n插件啟用後會自動載入，或在下次刷新頁面時生效。\n建議根據需要選擇性啟用插件以獲得最佳體驗。`,
            welcomeTitle: "🐈‍⬛ 插件管理器",
            helpCommand: "使用浮動按鈕或 /pcm help 查看更多信息",
            pluginLoadComplete: "插件載入完成",
            successLoaded: "已成功載入",
            plugins: "個插件",
            failed: "個失敗",
            pluginEnabled: "已啟用",
            pluginDisabled: "已停用",
            willTakeEffect: "插件已載入或將在下次刷新生效",
            willNotStart: "下次載入時將不會啟動",
            visitWebsite: "訪問網站",
            changelogTitle: "📋 更新日誌",
            changelogClose: "關閉",
            newVersionTitle: "✨ PCM 已更新",
            newVersionHint: "隨時點擊 📋 再次查看",
            loadingPlugins: "正在載入插件清單...",
            loadPluginsFailed: "插件清單載入失敗，請刷新頁面",
            refreshTitle: "即刻更新",
            refreshing: "正在清除快取並抓取最新版本...",
            refreshDone: "快取已更新！重新整理頁面以套用最新插件"
        }
    };

    function getMessage(key) { return messages[_isCN ? 'zh' : 'en'][key]; }
    function getPluginName(plugin) { return _isCN ? plugin.name : plugin.en_name; }
    function getPluginDescription(plugin) { return detectLanguage() ? plugin.description : plugin.en_description; }
    function getPluginAdditionalInfo(plugin) { return detectLanguage() ? plugin.additionalInfo : plugin.en_additionalInfo; }

    // ============================================================
    // === 三段開關輔助 ============================================
    // ============================================================

    function isTriStatePlugin(plugin) { return !!plugin.altUrl; }
    function isPluginEnabled(plugin) {
        if (isTriStatePlugin(plugin)) return plugin.state !== "off";
        return plugin.enabled;
    }
    // 查帳戶設定中的啟用狀態（1/"stable"/"beta" 視為啟用，0/undefined/"off" 視為停用）
    function isPluginEnabledInAccount(plugin) {
        const val = accountPluginSettings[plugin.id];
        return val !== undefined && val !== 0 && val !== "off";
    }
    // 本地或帳戶任一啟用即需要載入，防止雙重載入依靠 loadedPlugins.has()
    function isPluginEnabledForLoading(plugin) {
        return isPluginEnabled(plugin) || isPluginEnabledInAccount(plugin);
    }
    function getActivePluginUrl(plugin) {
        if (plugin.altUrl) {
            // 本地或帳戶任一為 beta 都使用 beta URL
            const localState = plugin.state || "off";
            const accountState = accountPluginSettings[plugin.id] || "off";
            if (localState === "beta" || accountState === "beta") return plugin.altUrl;
        }
        return plugin.url;
    }
    function getTriLabels(plugin) {
        if (plugin.triLabels && plugin.triLabels.length === 3) return plugin.triLabels;
        return ["OFF", "ON", "BETA"];
    }
    function cycleTriState(current) {
        if (current === "off") return "stable";
        if (current === "stable") return "beta";
        return "off";
    }

    // ============================================================
    // === 版本比對 ================================================
    // ============================================================

    function parseGameVersion(versionStr) {
        if (!versionStr) return 0;
        const match = String(versionStr).match(/R?(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
    }
    function getCurrentGameVersion() {
        try { if (typeof GameVersion !== 'undefined') return parseGameVersion(GameVersion); } catch(e) {}
        return 0;
    }
    function isPluginSkippedByVersion(plugin) {
        if (!plugin.autoDisableAfterVersion) return false;
        const currentVer = getCurrentGameVersion();
        if (currentVer === 0) return false;
        return currentVer > parseGameVersion(plugin.autoDisableAfterVersion);
    }

    // ============================================================
    // === 設定保存 ================================================
    // ============================================================

    let saveSettingsTimer;
    function saveSettings(settings) {
        clearTimeout(saveSettingsTimer);
        saveSettingsTimer = setTimeout(() => {
            localStorage.setItem("BC_PluginManager_Settings", JSON.stringify(settings));
        }, 100);
    }
    function loadSettings() {
        return JSON.parse(localStorage.getItem("BC_PluginManager_Settings") || "{}");
    }
    let pluginSettings = loadSettings();

    // 帳戶插件設定（存於 Player.ExtensionSettings，跨裝置同步）
    let accountPluginSettings = {};

    function loadAccountSettings() {
        try {
            if (typeof Player === 'undefined' || !Player?.ExtensionSettings) return {};
            const raw = Player.ExtensionSettings.PCMAccount;
            if (!raw) return {};
            // 相容直接存物件或 JSON 字串兩種情況
            if (typeof raw === 'object') return raw;
            return JSON.parse(raw) || {};
        } catch(e) { return {}; }
    }

    function saveAccountSettings() {
        try {
            if (typeof Player === 'undefined' || !Player?.ExtensionSettings) return;
            // 只儲存已啟用的插件：binary 用 1，tri-state 用 "stable"/"beta"，停用的直接不存
            const compact = {};
            for (const [id, val] of Object.entries(accountPluginSettings)) {
                if (val === 1 || val === true) compact[id] = 1;
                else if (val === "stable" || val === "beta") compact[id] = val;
                // val 為 0、false、"off" 或 undefined 時不寫入
            }
            Player.ExtensionSettings.PCMAccount = JSON.stringify(compact);
            ServerPlayerExtensionSettingsSync("PCMAccount");
        } catch(e) { console.error("🐈‍⬛ [PCM] ❌ 帳戶設定保存失敗:", e); }
    }

    // ============================================================
    // === 插件快取（SWR，TTL 24小時）=============================
    // ============================================================

    const CACHE_PREFIX = "pcm_plugin_cache_";
    const CACHE_META_KEY = "pcm_plugin_cache_meta";
    const JSON_CACHE_KEY = "pcm_json_cache";
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    // priority ≤ 2 的插件啟用 SWR 快取
    function shouldUseCache(plugin) {
        return (plugin.priority || 5) <= 2;
    }

    function getCachedPlugin(pluginId) {
        try {
            const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "{}");
            const entry = meta[pluginId];
            if (!entry) return null;
            if (Date.now() - entry.time > CACHE_TTL) {
                console.log(`🐈‍⬛ [PCM] ⏰ ${pluginId} 快取已過期，將重新抓取`);
                _clearCachedPlugin(pluginId);
                return null;
            }
            return localStorage.getItem(CACHE_PREFIX + pluginId) || null;
        } catch(e) { return null; }
    }

    function setCachedPlugin(pluginId, code) {
        try {
            localStorage.setItem(CACHE_PREFIX + pluginId, code);
            const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "{}");
            meta[pluginId] = { time: Date.now() };
            localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
        } catch(e) { console.warn("🐈‍⬛ [PCM] ⚠️ 插件快取寫入失敗:", e.message); }
    }

    function _clearCachedPlugin(pluginId) {
        try {
            localStorage.removeItem(CACHE_PREFIX + pluginId);
            const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "{}");
            delete meta[pluginId];
            localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
        } catch(e) {}
    }

    function clearAllPluginCache() {
        try {
            const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "{}");
            Object.keys(meta).forEach(id => localStorage.removeItem(CACHE_PREFIX + id));
            localStorage.removeItem(CACHE_META_KEY);
            localStorage.removeItem(JSON_CACHE_KEY);
            console.log("🐈‍⬛ [PCM] 🗑️ 所有快取已清除");
        } catch(e) {}
    }

    // ============================================================
    // === JSON 快取（SWR）========================================
    // ============================================================

    function getCachedJSON() {
        try {
            const cached = JSON.parse(localStorage.getItem(JSON_CACHE_KEY) || "null");
            if (!cached) return null;
            if (Date.now() - cached.time > CACHE_TTL) {
                localStorage.removeItem(JSON_CACHE_KEY);
                return null;
            }
            return cached.data;
        } catch(e) { return null; }
    }

    function setCachedJSON(data) {
        try {
            localStorage.setItem(JSON_CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
        } catch(e) {}
    }

    // ============================================================
    // === 版本更新檢查 ============================================
    // ============================================================

    let remoteChangelogZh = [];
    let remoteChangelogEn = [];
    let remoteVersion = modversion;
    let remoteUpdateId = null;

    function checkVersionUpdate() {
        const savedUpdateId = pluginSettings["_pcm_updateId"];
        if (remoteUpdateId && savedUpdateId !== remoteUpdateId) {
            pluginSettings["_pcm_updateId"] = remoteUpdateId;
            saveSettings(pluginSettings);
            return true;
        }
        return false;
    }

    function showChangelogModal() {
        const existing = document.getElementById("pcm-changelog-modal");
        if (existing) { existing.remove(); return; }

        const overlay = document.createElement("div");
        overlay.id = "pcm-changelog-modal";
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 2147483648;
            background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        `;

        const box = document.createElement("div");
        box.style.cssText = `
            background: rgba(26,32,46,0.98); border: 1px solid rgba(127,83,205,0.4);
            border-radius: 16px; padding: 24px; max-width: 340px; width: 90%;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            font-family: 'Noto Sans TC', sans-serif; color: #fff;
        `;

        // 在顯示時才決定語言，與其他 UI 元素行為一致
        const changelog = detectLanguage()
            ? (remoteChangelogZh.length > 0 ? remoteChangelogZh : remoteChangelogEn)
            : (remoteChangelogEn.length > 0 ? remoteChangelogEn : remoteChangelogZh);
        const items = (changelog.length > 0 ? changelog : ["載入更新日誌中..."]).map(c => `<li style="margin:6px 0; font-size:13px; color:#d4c8f5;">${c}</li>`).join("");

        box.innerHTML = `
            <div style="font-size:16px; font-weight:600; margin-bottom:4px;">${getMessage('changelogTitle')}</div>
            <div style="font-size:12px; color:#a0a9c0; margin-bottom:16px;">v${remoteVersion}</div>
            <ul style="padding-left:18px; margin:0 0 20px 0; list-style:disc;">${items}</ul>
            <button id="pcm-changelog-close" style="
                width:100%; padding:10px; border:none; border-radius:10px;
                background: linear-gradient(135deg, #7F53CD, #A78BFA);
                color:white; font-size:14px; cursor:pointer; font-family:inherit;
            ">${getMessage('changelogClose')}</button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById("pcm-changelog-close").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    }

    // ============================================================
    // === 子插件清單（動態載入）==================================
    // ============================================================

    let subPlugins = [];
    let pluginsLoaded = false;
    const _pluginsJSONPromise = fetchPluginsJSON();
    const _pluginsProcessPromise = loadPluginsJSON();

    // JSON 網路抓取（RAW 優先，CDN 備援）
    // 強制略過瀏覽器 HTTP 快取，確保拿到最新版本
    async function fetchJSONFromNetwork() {
        for (const url of PLUGINS_JSON_URLS) {
            try {
                const res = await fetch(url, { cache: 'no-cache' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();

                let data;
                try {
                    data = JSON.parse(text);
                } catch(e) {
                    console.warn(`🐈‍⬛ [PCM] ⚠️ plugins.json 格式錯誤，不寫入快取:`, e.message);
                    continue;
                }

                if (!data || !Array.isArray(data.plugins) || data.plugins.length === 0) {
                    console.warn(`🐈‍⬛ [PCM] ⚠️ plugins.json 結構異常，不寫入快取`);
                    continue;
                }

                setCachedJSON(data);
                console.log(`🐈‍⬛ [PCM] ✅ plugins.json 從網路載入成功 (${url})`);
                return data;
            } catch(e) {
                console.warn(`🐈‍⬛ [PCM] ⚠️ plugins.json 從 ${url} 載入失敗:`, e.message);
            }
        }

        // 所有 URL 都失敗，保留舊快取
        const oldCache = getCachedJSON();
        if (oldCache) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ 網路版本有問題，保留舊快取`);
            showNotification("⚠️", "PCM", _isCN ? "插件清單更新失敗，使用舊版本" : "Plugin list update failed, using cached version");
            return oldCache;
        }

        return null;
    }

    // SWR：有快取立即回傳，同時背景更新
    async function fetchPluginsJSON() {
        const cached = getCachedJSON();
        if (cached) {
            console.log("🐈‍⬛ [PCM] ⚡ plugins.json 從快取載入");
            setTimeout(() => fetchJSONFromNetwork(), 0);
            return cached;
        }
        return await fetchJSONFromNetwork();
    }

    function applyPluginSettings(plugins) {
        return plugins.map(plugin => {
            const saved = pluginSettings[plugin.id];
            if (isTriStatePlugin(plugin)) {
                plugin.state = (saved !== undefined) ? saved : "off";
            } else {
                plugin.enabled = (saved !== undefined) ? saved : false;
            }
            if (pluginSettings[`${plugin.id}_customIcon`]) {
                plugin.customIcon = pluginSettings[`${plugin.id}_customIcon`];
            }
            return plugin;
        });
    }

    async function loadPluginsJSON() {
        const data = await _pluginsJSONPromise;
        if (!data || !Array.isArray(data.plugins)) {
            console.error("🐈‍⬛ [PCM] ❌ plugins.json 格式錯誤或無法取得");
            showNotification("❌", "PCM", getMessage('loadPluginsFailed'));
            return false;
        }
        remoteVersion = data.version || modversion;
        remoteUpdateId = data.updateId || null;
        remoteChangelogZh = data.changelog || [];
        remoteChangelogEn = data.en_changelog || data.changelog || [];
        subPlugins = applyPluginSettings(data.plugins);
        subPlugins.sort((a, b) => (a.priority || 5) - (b.priority || 5));
        pluginsLoaded = true;
        console.log(`🐈‍⬛ [PCM] 📦 plugins.json 共 ${subPlugins.length} 個插件`);
        return true;
    }

    // ============================================================
    // === 載入子插件 =============================================
    // ============================================================

    let loadedPlugins = new Set();
    let isLoadingPlugins = false;
    let localLoadStarted = false;   // Phase 1：本地插件
    let accountLoadStarted = false; // Phase 2：帳戶插件

    function injectScript(pluginId, code) {
        // 若取得的內容是 HTML（如 404 頁面），拒絕注入避免 SyntaxError
        if (code.trimStart().startsWith('<')) {
            throw new Error(`Invalid content: received HTML instead of JavaScript`);
        }
        const script = document.createElement('script');
        script.setAttribute('data-plugin', pluginId);
        script.textContent = `(function(){try{${code}}catch(e){console.error('🐈‍⬛ [PCM] plugin error (${pluginId}):', e.message);}})();`;
        document.body.appendChild(script);
    }

    // RAW 優先，CDN 備援（串行 fallback）
    async function tryFetch(urls) {
        for (const url of urls) {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.text();
            } catch(e) {
                console.warn(`🐈‍⬛ [PCM] ⚠️ 從 ${url} 取得失敗: ${e.message}`);
            }
        }
        return null;
    }

    function buildFetchUrls(plugin) {
        const rawUrl = getActivePluginUrl(plugin);

        // 將任意 raw.githubusercontent.com URL 轉換為 jsDelivr CDN 備援
        // 格式：https://raw.githubusercontent.com/{user}/{repo}/{branch}/{path}
        //   →  https://cdn.jsdelivr.net/gh/{user}/{repo}@{branch}/{path}
        const cdnUrl = rawUrl.replace(
            /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
            "https://cdn.jsdelivr.net/gh/$1/$2@$3/$4"
        );

        return cdnUrl !== rawUrl ? [rawUrl, cdnUrl] : [rawUrl];
    }

    function loadSubPlugin(plugin) {
        if (!isPluginEnabledForLoading(plugin) || loadedPlugins.has(plugin.id)) return Promise.resolve();
        if (isPluginSkippedByVersion(plugin)) {
            console.log(`🐈‍⬛ [PCM] ⏭️ ${plugin.name} 版本過舊自動跳過`);
            loadedPlugins.add(plugin.id);
            return Promise.resolve();
        }

        // inlineCode 支援
        if (!plugin.url && plugin.inlineCode) {
            return new Promise((resolve) => {
                try {
                    injectScript(plugin.id, plugin.inlineCode);
                    loadedPlugins.add(plugin.id);
                } catch(e) { console.error(`🐈‍⬛ [PCM] ❌ inlineCode 載入失敗: ${plugin.name}`, e); }
                resolve();
            });
        }

        if (!plugin.url) return Promise.resolve();

        const urls = buildFetchUrls(plugin);

        // SWR 快取邏輯（priority ≤ 2）
        if (shouldUseCache(plugin)) {
            const cached = getCachedPlugin(plugin.id);
            if (cached) {
                try {
                    injectScript(plugin.id, cached);
                    loadedPlugins.add(plugin.id);
                    console.log(`🐈‍⬛ [PCM] ⚡ ${plugin.name} 從快取秒載`);
                } catch(e) {
                    console.error(`🐈‍⬛ [PCM] ❌ ${plugin.name} 快取執行失敗，清除並重新抓取`, e);
                    _clearCachedPlugin(plugin.id);
                }

                if (loadedPlugins.has(plugin.id)) {
                    // 背景更新快取
                    tryFetch(urls).then(newCode => {
                        if (newCode && newCode !== cached) {
                            setCachedPlugin(plugin.id, newCode);
                            console.log(`🐈‍⬛ [PCM] 🔄 ${plugin.name} 背景快取已更新（下次生效）`);
                        }
                    }).catch(() => {});
                    return Promise.resolve();
                }
            }
        }

        // 正常抓取
        return tryFetch(urls).then(code => {
            if (!code) {
                showNotification("❌", `${getPluginName(plugin)} 載入失敗`, "請檢查網絡或插件URL");
                throw new Error("🐈‍⬛ [PCM] ❌ all urls failed");
            }
            injectScript(plugin.id, code);
            loadedPlugins.add(plugin.id);
            console.log(`🐈‍⬛ [PCM] ✅ -SubPlugin- ${plugin.name} 載入成功`);
            if (shouldUseCache(plugin)) setCachedPlugin(plugin.id, code);
        }).catch(err => {
            console.error(`🐈‍⬛ [PCM] ❌ ${plugin.name} 無法載入:`, err);
            throw err;
        });
    }

    function isPlayerLoaded() { return typeof Player !== 'undefined'; }

    // ─── 共用批次載入 ────────────────────────────────────────────
    async function runPluginBatch(plugins) {
        // 等待另一批次完成，避免並發衝突
        while (isLoadingPlugins) await new Promise(r => setTimeout(r, 200));
        if (plugins.length === 0) return;
        isLoadingPlugins = true;
        try {
            const batchSize = 3;
            let successCount = 0;
            for (let i = 0; i < plugins.length; i += batchSize) {
                const batch = plugins.slice(i, i + batchSize);
                const results = await Promise.allSettled(
                    batch.map(p => loadSubPlugin(p).catch(e => ({ error: e })))
                );
                results.forEach((result, idx) => {
                    if (result.status === 'fulfilled' && !result.value?.error) successCount++;
                    else console.error(`🐈‍⬛ [PCM] ❌ ${batch[idx].name} 載入失敗`);
                });
                if (i + batchSize < plugins.length) await new Promise(r => setTimeout(r, 800));
            }
            const failedCount = plugins.length - successCount;
            if (failedCount > 0) {
                showNotification("⚠️", getMessage('pluginLoadComplete'),
                    `${getMessage('successLoaded')} ${successCount} ${getMessage('plugins')}，${failedCount} ${getMessage('failed')}`);
            } else if (plugins.length > 0) {
                showNotification("✅", getMessage('pluginLoadComplete'),
                    `${getMessage('successLoaded')} ${successCount} ${getMessage('plugins')}`);
            }
        } catch(e) {
            console.error("🐈‍⬛ [PCM] ❌ 批次載入錯誤:", e);
        } finally { isLoadingPlugins = false; }
    }

    // ─── Phase 1：本地插件，只要 Player 存在就啟動 ───────────────
    async function loadLocalPluginsPhase() {
        if (localLoadStarted) return;
        localLoadStarted = true;

        if (!pluginsLoaded) {
            await _pluginsProcessPromise;
            if (!pluginsLoaded) { localLoadStarted = false; return; }
        }

        const maxWait = 15 * 60 * 1000;
        let waited = 0;
        while (typeof Player === 'undefined' && waited < maxWait) {
            if (waited % 5000 === 0) console.log(`🐈‍⬛ [PCM] ⏳ Phase 1 等待 Player... (${waited / 1000}s)`);
            await new Promise(r => setTimeout(r, 1000));
            waited += 1000;
        }
        if (typeof Player === 'undefined') { localLoadStarted = false; return; }

        const localEnabled = subPlugins.filter(p => isPluginEnabled(p));
        console.log(`🐈‍⬛ [PCM] 📱 Phase 1 本地插件：${localEnabled.length} 個`);
        await runPluginBatch(localEnabled);
    }

    // ─── Phase 2：帳戶插件，等 AccountName 就緒後啟動，跳過已載入 ─
    async function loadAccountPluginsPhase() {
        if (accountLoadStarted) return;
        accountLoadStarted = true;

        if (!pluginsLoaded) {
            await _pluginsProcessPromise;
            if (!pluginsLoaded) { accountLoadStarted = false; return; }
        }

        const maxWait = 15 * 60 * 1000;
        let waited = 0;
        while ((typeof Player === 'undefined' || !Player?.AccountName) && waited < maxWait) {
            if (waited % 5000 === 0) console.log(`🐈‍⬛ [PCM] ⏳ Phase 2 等待登入... (${waited / 1000}s)`);
            await new Promise(r => setTimeout(r, 1000));
            waited += 1000;
        }
        if (!Player?.AccountName) { accountLoadStarted = false; return; }

        // AccountName 就緒，重新載入帳戶設定確保是最新的
        accountPluginSettings = loadAccountSettings();

        // 只取帳戶啟用且尚未被本地階段載入的插件
        const accountOnly = subPlugins.filter(p =>
            isPluginEnabledInAccount(p) && !loadedPlugins.has(p.id)
        );
        console.log(`🐈‍⬛ [PCM] ☁️ Phase 2 帳戶插件：${accountOnly.length} 個（新增）`);
        await runPluginBatch(accountOnly);
    }

    // ============================================================
    // === 強制更新快取 ============================================
    // ============================================================

    let isRefreshing = false;
    async function forceRefreshCache() {
        if (isRefreshing) return;
        isRefreshing = true;
        showNotification("↻", getMessage('refreshTitle'), getMessage('refreshing'));

        clearAllPluginCache();
        await fetchJSONFromNetwork();

        if (subPlugins.length > 0) {
            const cacheableEnabled = subPlugins.filter(p => shouldUseCache(p) && isPluginEnabled(p));
            await Promise.allSettled(cacheableEnabled.map(plugin => {
                const urls = buildFetchUrls(plugin);
                return tryFetch(urls).then(code => {
                    if (code) {
                        setCachedPlugin(plugin.id, code);
                        console.log(`🐈‍⬛ [PCM] 🔄 ${plugin.name} 強制更新快取完成`);
                    }
                }).catch(() => {});
            }));
        }

        isRefreshing = false;
        showNotification("✅", getMessage('refreshTitle'), getMessage('refreshDone'));
    }

    // ============================================================
    // === UI 顯示判斷 ============================================
    // ============================================================

    function getCurrentViewingCharacter() {
        const now = Date.now();
        if (now - lastCharacterCheck < CHARACTER_CACHE_TIME && cachedViewingCharacter !== null) return cachedViewingCharacter;
        try {
            let character = null;
            if (typeof InformationSheetCharacter !== 'undefined' && InformationSheetCharacter) {
                character = InformationSheetCharacter;
            } else if (typeof InformationSheetSelection !== 'undefined' && InformationSheetSelection !== null && typeof InformationSheetSelection === 'object') {
                if (InformationSheetSelection.Name && (InformationSheetSelection.MemberNumber || InformationSheetSelection.ID)) {
                    character = InformationSheetSelection;
                } else if (InformationSheetSelection.ID && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.ID === InformationSheetSelection.ID);
                } else if (InformationSheetSelection.MemberNumber && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection.MemberNumber);
                }
            } else if (typeof InformationSheetSelection !== 'undefined' && typeof InformationSheetSelection === 'number') {
                if (CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection);
                }
            }
            if (!character) character = Player;
            cachedViewingCharacter = character;
            lastCharacterCheck = now;
            return character;
        } catch(e) { return Player; }
    }

    function isProfilePage() {
        const now = Date.now();
        if (now - lastScreenCheckTime < SCREEN_CACHE_TIME && lastScreenCheck !== null) return lastScreenCheck;
        const result = CurrentScreen === "InformationSheet" &&
              window.bcx?.inBcxSubscreen() !== true &&
              window.LITTLISH_CLUB?.inModSubscreen() !== true &&
              window.MPA?.menuLoaded !== true &&
              window.LSCG_REMOTE_WINDOW_OPEN !== true;
        lastScreenCheck = result;
        lastScreenCheckTime = now;
        return result;
    }

    function shouldShowUI() {
        const isLoginPage = window.location.href.includes('/login') || window.location.href.includes('Login.html');
        if (isLoginPage) return true;
        if (typeof Player === 'undefined' || !Player.Name) return true;
        if (typeof CurrentScreen !== 'undefined') {
            if (CurrentScreen === 'InformationSheet') {
                if (isProfilePage()) {
                    const viewingCharacter = getCurrentViewingCharacter();
                    return viewingCharacter && viewingCharacter.MemberNumber === Player.MemberNumber;
                }
                return false;
            }
            const allowedScreens = ['Preference', 'Login', 'Character', 'MainHall', 'Introduction'];
            if (allowedScreens.includes(CurrentScreen)) return true;
        }
        return false;
    }

    // ============================================================
    // === Styles =================================================
    // ============================================================

    function injectStyles() {
        if (document.getElementById("bc-plugin-styles")) return;
        const style = document.createElement("style");
        style.id = "bc-plugin-styles";
        style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&display=swap');

        .bc-plugin-container * {
            font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none; -webkit-user-select: none;
        }

        .bc-plugin-btn-group {
            position: fixed; top: 60px; right: 20px;
            display: flex; flex-direction: column; align-items: center;
            gap: 8px; z-index: 2147483647;
        }

        .bc-plugin-floating-btn {
            width: 60px; height: 60px;
            background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 50%, #C4B5FD 100%);
            border: none; border-radius: 50%; cursor: pointer;
            box-shadow: 0 6px 20px rgba(127, 83, 205, 0.3);
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            font-size: 24px; display: flex; align-items: center; justify-content: center;
            animation: float 3s ease-in-out infinite;
        }
        .bc-plugin-floating-btn:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 8px 25px rgba(127, 83, 205, 0.4);
            background: linear-gradient(135deg, #6B46B2 0%, #9577E3 50%, #B7A3F5 100%);
        }
        .bc-plugin-floating-btn img { width: 48px; height: 48px; border-radius: 50%; transform: scaleX(-1); }

        .bc-plugin-changelog-btn, .bc-plugin-refresh-btn {
            width: 60px; height: 60px;
            background: rgba(26, 32, 46, 0.9);
            border: 1px solid rgba(127, 83, 205, 0.4);
            border-radius: 50%; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            transition: all 0.3s ease;
            font-size: 22px; display: flex; align-items: center; justify-content: center;
        }
        .bc-plugin-changelog-btn:hover, .bc-plugin-refresh-btn:hover {
            background: rgba(127, 83, 205, 0.3);
            border-color: rgba(127, 83, 205, 0.8);
            transform: scale(1.05);
        }
        .bc-plugin-refresh-btn.spinning {
            animation: spin-once 1s linear infinite;
            border-color: rgba(127, 83, 205, 0.8);
            background: rgba(127, 83, 205, 0.2);
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-6px) rotate(5deg); }
        }
        @keyframes spin-once { to { transform: rotate(360deg); } }

        .bc-plugin-panel {
            position: fixed; top: 20px; right: 100px; width: 380px;
            max-height: calc(100vh - 120px); min-height: 300px;
            background: rgba(26, 32, 46, 0.95); backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
            z-index: 2147483646; overflow: hidden; display: flex; flex-direction: column;
            transform: translateX(420px) scale(0.8); opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            visibility: hidden; pointer-events: none;
        }
        .bc-plugin-panel.show { transform: translateX(0) scale(1); opacity: 1; visibility: visible; pointer-events: auto; }

        .bc-plugin-header {
            background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 100%);
            padding: 10px; color: white; text-align: center;
            position: relative; overflow: hidden; flex-shrink: 0;
        }
        .bc-plugin-header::before {
            content: '';
            position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent);
            animation: slideGlow 2.2s ease-in-out infinite;
        }
        @keyframes slideGlow { 0% { left: -60%; } 100% { left: 115%; } }

        .bc-plugin-title { font-size: 16px; font-weight: 600; margin: 0; position: relative; z-index: 1; }

        .bc-plugin-content {
            padding: 20px; flex: 1 1 auto; overflow-y: auto; overflow-x: hidden;
            max-height: 400px; min-height: 300px;
            scrollbar-width: thin; scrollbar-color: rgba(127, 83, 205, 0.8) rgba(255, 255, 255, 0.1);
            -webkit-overflow-scrolling: touch;
        }
        .bc-plugin-content::-webkit-scrollbar { width: 8px; }
        .bc-plugin-content::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; margin: 4px; }
        .bc-plugin-content::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #7F53CD, #A78BFA); border-radius: 4px; min-height: 20px; }
        .bc-plugin-content::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #6B46B2, #9577E3); }

        .bc-plugin-footer {
            background: rgba(255, 255, 255, 0.02); padding: 12px 20px; text-align: center;
            color: #a0a9c0; font-size: 11px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            flex-shrink: 0;
        }
        .bc-plugin-footer-link {
            color: #C4B5FD; text-decoration: none; transition: color 0.2s ease; cursor: pointer;
        }
        .bc-plugin-footer-link:hover { color: #fff; text-decoration: underline; }

        .bc-plugin-item {
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px; margin-bottom: 12px; padding: 16px;
            transition: all 0.3s ease; position: relative; overflow: hidden;
        }
        .bc-plugin-item.enabled {
            background: rgba(127, 83, 205, 0.1); border-color: rgba(127, 83, 205, 0.3);
        }
        .bc-plugin-item.enabled::before {
            content: ''; position: absolute; top: 0; left: 0; width: 0; height: 0;
            border-left: 20px solid #7F53CD; border-bottom: 20px solid transparent; z-index: 1;
        }
        .bc-plugin-item.beta-enabled {
            background: rgba(205, 128, 53, 0.1); border-color: rgba(205, 128, 53, 0.35);
        }
        .bc-plugin-item.beta-enabled::before {
            content: ''; position: absolute; top: 0; left: 0; width: 0; height: 0;
            border-left: 20px solid #CD8035; border-bottom: 20px solid transparent; z-index: 1;
        }
        .bc-plugin-item:hover {
            background: rgba(255, 255, 255, 0.08); border-color: rgba(127, 83, 205, 0.3);
            transform: translateY(-2px); box-shadow: 0 8px 20px rgba(127, 83, 205, 0.15);
        }
        .bc-plugin-item-header { display: flex; align-items: center; position: relative; }

        .bc-plugin-info-btn {
            position: absolute; bottom: 0; right: 0;
            width: 30px; height: 30px;
            cursor: pointer; text-decoration: none; z-index: 2; border-radius: 0 0 12px 0;
        }
        .bc-plugin-info-btn::before {
            content: ''; position: absolute; bottom: 0; right: 0; width: 0; height: 0;
            border-style: solid; border-width: 0 0 30px 30px;
            border-color: transparent transparent rgba(255, 255, 255, 0.08) transparent;
            transition: border-color 0.2s ease;
        }
        .bc-plugin-item.enabled .bc-plugin-info-btn::before { border-color: transparent transparent rgba(127, 83, 205, 0.4) transparent; }
        .bc-plugin-item.beta-enabled .bc-plugin-info-btn::before { border-color: transparent transparent rgba(205, 128, 53, 0.4) transparent; }
        .bc-plugin-info-btn::after {
            content: '🔗'; position: absolute; bottom: 3px; right: 3px;
            font-size: 9px; line-height: 1; opacity: 0.6; transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .bc-plugin-info-btn:hover::before { border-color: transparent transparent rgba(255, 255, 255, 0.2) transparent; }
        .bc-plugin-item.enabled .bc-plugin-info-btn:hover::before { border-color: transparent transparent rgba(127, 83, 205, 0.75) transparent; }
        .bc-plugin-item.beta-enabled .bc-plugin-info-btn:hover::before { border-color: transparent transparent rgba(205, 128, 53, 0.75) transparent; }
        .bc-plugin-info-btn:hover::after { opacity: 1; transform: scale(1.15); }

        .bc-plugin-icon {
            font-size: 24px; margin-right: 12px; display: flex; align-items: center;
            justify-content: center; width: 40px; height: 40px;
            border-radius: 10px; background: rgba(255, 255, 255, 0.1); flex-shrink: 0;
        }
        .bc-plugin-icon img { width: 24px; height: 24px; border-radius: 4px; }
        .bc-plugin-info { flex: 1; color: white; min-width: 0; }
        .bc-plugin-name { font-size: 14px; font-weight: 500; margin: 0; color: #fff; }
        .bc-plugin-desc { font-size: 12px; color: #a0a9c0; margin: 4px 0 0 0; line-height: 1.4; }

        .bc-plugin-toggle {
            position: relative; width: 50px; height: 26px;
            background: rgba(255, 255, 255, 0.2); border-radius: 13px;
            cursor: pointer; transition: all 0.3s ease; border: none; outline: none; flex-shrink: 0;
        }
        .bc-plugin-toggle.active { background: linear-gradient(135deg, #7F53CD, #A78BFA); }
        .bc-plugin-toggle::after {
            content: ''; position: absolute; top: 2px; left: 2px;
            width: 22px; height: 22px; background: white; border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .bc-plugin-toggle.active::after { left: 26px; }

        .bc-plugin-toggle-tri {
            position: relative; width: 88px; height: 26px;
            background: rgba(255, 255, 255, 0.12); border-radius: 13px; cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.15); outline: none;
            display: flex; align-items: center; padding: 0; overflow: hidden; flex-shrink: 0;
            transition: border-color 0.3s ease;
        }
        .bc-plugin-toggle-tri:hover { border-color: rgba(196, 181, 253, 0.4); }
        .bc-plugin-toggle-tri-track {
            position: absolute; top: 2px; width: 28px; height: 22px; border-radius: 11px;
            transition: left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), background 0.3s ease;
            left: 2px; background: rgba(255,255,255,0.35);
        }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-track { left: 30px; background: linear-gradient(135deg, #7F53CD, #A78BFA); }
        .bc-plugin-toggle-tri[data-state="beta"] .bc-plugin-toggle-tri-track { left: 57px; background: linear-gradient(135deg, #CD8035, #FAB87A); }
        .bc-plugin-toggle-tri-labels {
            position: relative; z-index: 1; display: flex;
            width: 100%; justify-content: space-around; align-items: center; height: 100%;
        }
        .bc-plugin-toggle-tri-label {
            font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.45);
            width: 29px; text-align: center; transition: color 0.3s ease;
            user-select: none; pointer-events: none;
        }
        .bc-plugin-toggle-tri[data-state="off"]    .bc-plugin-toggle-tri-label:nth-child(1) { color: rgba(255,255,255,0.85); }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-label:nth-child(2) { color: #fff; }
        .bc-plugin-toggle-tri[data-state="beta"]   .bc-plugin-toggle-tri-label:nth-child(3) { color: #fff; }

        .bc-plugin-loading {
            text-align: center; padding: 40px 20px; color: #a0a9c0; font-size: 14px;
        }
        .bc-plugin-loading::after {
            content: ''; display: block; width: 32px; height: 32px; margin: 16px auto 0;
            border: 3px solid rgba(127,83,205,0.3); border-top-color: #A78BFA;
            border-radius: 50%; animation: spin-once 0.8s linear infinite;
        }

        .bc-plugin-btn-group.hidden { opacity: 0; pointer-events: none; }
        .bc-plugin-panel.hidden { opacity: 0; pointer-events: none; transform: translateX(420px) scale(0.8); }

        .bc-plugin-floating-btn, .bc-plugin-floating-btn *,
        .bc-plugin-changelog-btn, .bc-plugin-changelog-btn *,
        .bc-plugin-refresh-btn, .bc-plugin-refresh-btn *,
        .bc-plugin-panel, .bc-plugin-panel * {
            user-select: none !important; -webkit-user-select: none !important;
            -webkit-user-drag: none !important;
        }

        .bc-liko-toggle-notification {
            position: fixed; box-sizing: border-box;
            background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 100%);
            color: white; padding: 12px 16px; border-radius: 12px;
            box-shadow: 0 8px 20px rgba(127, 83, 205, 0.25);
            z-index: 2147483645;
            font-family: 'Noto Sans TC', sans-serif; font-size: 13px;
            transform: translateY(-6px); opacity: 0;
            transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.3s ease;
            pointer-events: none; user-select: none;
        }
        .bc-liko-toggle-notification.show { transform: translateY(0); opacity: 1; }
        .bc-liko-toggle-notification.hide { transform: translateY(-6px); opacity: 0; }

        .bc-liko-system-notification {
            position: fixed; top: 20px; right: 20px;
            background: rgba(26, 32, 46, 0.95);
            border: 1px solid rgba(127, 83, 205, 0.4);
            color: white; padding: 14px 18px; border-radius: 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
            z-index: 2147483648;
            font-family: 'Noto Sans TC', sans-serif; font-size: 13px;
            max-width: 280px;
            transform: translateX(320px); opacity: 0;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
            user-select: none;
        }
        .bc-liko-system-notification.show { transform: translateX(0); opacity: 1; }
        .bc-liko-system-notification.hide { transform: translateX(320px); opacity: 0; }

        @media (max-width: 480px) {
            .bc-plugin-panel { width: calc(100vw - 40px); right: 20px; max-height: calc(100vh - 100px); }
            .bc-plugin-btn-group { right: 10px; }
            .bc-plugin-floating-btn { width: 52px; height: 52px; }
            .bc-plugin-floating-btn img { width: 42px; height: 42px; }
            .bc-plugin-changelog-btn, .bc-plugin-refresh-btn { width: 52px; height: 52px; font-size: 18px; }
        }
        @media (max-height: 600px) {
            .bc-plugin-panel { max-height: calc(100vh - 80px); top: 10px; }
        }

        /* 分頁列 */
        .bc-plugin-tabs {
            display: flex; flex-shrink: 0;
            background: rgba(0,0,0,0.25);
            border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .bc-plugin-tab {
            flex: 1; padding: 8px 4px;
            background: none; border: none; border-bottom: 2px solid transparent;
            color: rgba(255,255,255,0.45); cursor: pointer;
            font-size: 12px; font-weight: 500; font-family: inherit;
            transition: all 0.2s ease; letter-spacing: 0.3px;
        }
        .bc-plugin-tab:hover:not(.active) {
            color: rgba(255,255,255,0.75);
            background: rgba(255,255,255,0.04);
        }
        .bc-plugin-tab.active {
            color: #fff; border-bottom-color: #A78BFA;
        }
        /* 帳戶未登入時的覆蓋提示 */
        .bc-plugin-account-locked {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; padding: 40px 20px;
            color: #a0a9c0; font-size: 13px; text-align: center; line-height: 1.8;
        }
        .bc-plugin-account-locked .lock-icon { font-size: 36px; margin-bottom: 12px; }
        `;
        document.head.appendChild(style);
    }

    // ============================================================
    // === UI 建立 ================================================
    // ============================================================

    let currentUIState = null;
    // 追蹤 document click listener，避免重建 UI 時累積
    let _docClickHandler = null;

    function buildPluginItem(plugin, source = 'local') {
        const item = document.createElement("div");
        const isTri = isTriStatePlugin(plugin);

        // 根據來源讀取對應的啟用狀態
        let currentState, isEnabled, isBeta;
        if (source === 'account') {
            currentState = isTri ? (accountPluginSettings[plugin.id] || "off") : null;
            isEnabled = isPluginEnabledInAccount(plugin);
        } else {
            currentState = isTri ? (plugin.state || "off") : null;
            isEnabled = isPluginEnabled(plugin);
        }
        isBeta = isTri && currentState === "beta";

        item.className = `bc-plugin-item${isEnabled && !isBeta ? ' enabled' : ''}${isBeta ? ' beta-enabled' : ''}`;

        const iconDisplay = plugin.customIcon
            ? `<img src="${plugin.customIcon}" alt="${getPluginName(plugin)} icon" />`
            : plugin.icon;

        const infoBtnHtml = plugin.website
            ? `<a class="bc-plugin-info-btn" href="${plugin.website}" target="_blank" rel="noopener noreferrer" title="${getMessage('visitWebsite')}" data-plugin-website="${plugin.id}"></a>`
            : '';

        const buildTriToggle = (p, state, src) => {
            const labels = getTriLabels(p);
            return `<button class="bc-plugin-toggle-tri" data-plugin-tri="${p.id}" data-source="${src}" data-state="${state}" aria-label="${getPluginName(p)}">
                <div class="bc-plugin-toggle-tri-track"></div>
                <div class="bc-plugin-toggle-tri-labels">
                    <span class="bc-plugin-toggle-tri-label">${labels[0]}</span>
                    <span class="bc-plugin-toggle-tri-label">${labels[1]}</span>
                    <span class="bc-plugin-toggle-tri-label">${labels[2]}</span>
                </div>
            </button>`;
        };

        const toggleHtml = isTri
            ? buildTriToggle(plugin, currentState, source)
            : `<button class="bc-plugin-toggle ${isEnabled ? 'active' : ''}" data-plugin="${plugin.id}" data-source="${source}" aria-label="${getPluginName(plugin)}"></button>`;

        item.innerHTML = `
            ${infoBtnHtml}
            <div class="bc-plugin-item-header">
                <div class="bc-plugin-icon">${iconDisplay}</div>
                <div class="bc-plugin-info">
                    <h4 class="bc-plugin-name">${getPluginName(plugin)}</h4>
                    <p class="bc-plugin-desc">${getPluginDescription(plugin)}</p>
                </div>
                ${toggleHtml}
            </div>
        `;
        return item;
    }

    // 浮動按鈕可見性控制（供 preference 頁面呼叫）
    function applyFloatingBtnVisibility() {
        const group = document.getElementById("bc-plugin-btn-group");
        if (group) group.style.display = pluginSettings.showFloatingBtn !== false ? "" : "none";
    }

    // 建立帳戶分頁內容（未登入顯示鎖定提示）
    function buildAccountContent(container) {
        container.innerHTML = '';
        const isLoggedIn = typeof Player !== 'undefined' && !!Player?.AccountName;
        if (!isLoggedIn) {
            container.innerHTML = `
                <div class="bc-plugin-account-locked">
                    <div class="lock-icon">🔒</div>
                    ${_isCN ? '請先登入遊戲帳號<br>方可使用帳戶設定' : 'Please log in to your account<br>to use account settings'}
                </div>`;
            return;
        }
        if (!pluginsLoaded) {
            container.innerHTML = `<div class="bc-plugin-loading">${getMessage('loadingPlugins')}</div>`;
            return;
        }
        subPlugins.forEach(plugin => container.appendChild(buildPluginItem(plugin, 'account')));
    }

    // 統一的 toggle 點擊處理器（本地 & 帳戶共用）
    function handlePluginToggle(e) {
        if (e.target.closest(".bc-plugin-info-btn")) { e.stopPropagation(); return; }

        // 二段開關
        const toggle = e.target.closest(".bc-plugin-toggle");
        if (toggle) {
            const pluginId = toggle.getAttribute("data-plugin");
            const source = toggle.getAttribute("data-source") || "local";
            const plugin = subPlugins.find(p => p.id === pluginId);
            if (!plugin) return;

            if (source === 'account') {
                const newEnabled = !isPluginEnabledInAccount(plugin);
                if (newEnabled) {
                    accountPluginSettings[pluginId] = 1;
                } else {
                    delete accountPluginSettings[pluginId];
                }
                saveAccountSettings();
                toggle.classList.toggle("active", newEnabled);
                toggle.closest(".bc-plugin-item").classList.toggle("enabled", newEnabled);
                showToggleNotification(
                    newEnabled ? "🐈‍⬛" : "🐾",
                    `${getPluginName(plugin)} ${newEnabled ? getMessage('pluginEnabled') : getMessage('pluginDisabled')}`,
                    newEnabled ? getMessage('willTakeEffect') : getMessage('willNotStart')
                );
                if (newEnabled && !loadedPlugins.has(plugin.id) && isPlayerLoaded()) loadSubPlugin(plugin);
            } else {
                plugin.enabled = !plugin.enabled;
                pluginSettings[pluginId] = plugin.enabled;
                saveSettings(pluginSettings);
                toggle.classList.toggle("active", plugin.enabled);
                toggle.closest(".bc-plugin-item").classList.toggle("enabled", plugin.enabled);
                showToggleNotification(
                    plugin.enabled ? "🐈‍⬛" : "🐾",
                    `${getPluginName(plugin)} ${plugin.enabled ? getMessage('pluginEnabled') : getMessage('pluginDisabled')}`,
                    plugin.enabled ? getMessage('willTakeEffect') : getMessage('willNotStart')
                );
                if (plugin.enabled && !loadedPlugins.has(plugin.id) && isPlayerLoaded()) loadSubPlugin(plugin);
            }
            return;
        }

        // 三段開關
        const triToggle = e.target.closest(".bc-plugin-toggle-tri");
        if (triToggle) {
            const pluginId = triToggle.getAttribute("data-plugin-tri");
            const source = triToggle.getAttribute("data-source") || "local";
            const plugin = subPlugins.find(p => p.id === pluginId);
            if (!plugin || !isTriStatePlugin(plugin)) return;

            const currentState = source === 'account'
                ? (accountPluginSettings[pluginId] || "off")
                : (plugin.state || "off");
            const nextState = cycleTriState(currentState);

            if (source === 'account') {
                if (nextState === "off") {
                    delete accountPluginSettings[pluginId];
                } else {
                    accountPluginSettings[pluginId] = nextState; // "stable" or "beta"
                }
                saveAccountSettings();
            } else {
                plugin.state = nextState;
                pluginSettings[pluginId] = nextState;
                saveSettings(pluginSettings);
            }

            triToggle.setAttribute("data-state", nextState);
            const item = triToggle.closest(".bc-plugin-item");
            item.classList.remove("enabled", "beta-enabled");
            if (nextState === "stable") item.classList.add("enabled");
            if (nextState === "beta") item.classList.add("beta-enabled");
            const labels = getTriLabels(plugin);
            const notifTitle = nextState === "off"
                ? `${getPluginName(plugin)} ${getMessage('pluginDisabled')}`
                : `${getPluginName(plugin)} ${labels[nextState === "stable" ? 1 : 2]} ${getMessage('pluginEnabled')}`;
            showToggleNotification(
                nextState === "off" ? "🐾" : nextState === "stable" ? "🐈‍⬛" : "🧪",
                notifTitle,
                nextState === "off" ? getMessage('willNotStart') : getMessage('willTakeEffect')
            );
            if (nextState !== "off" && !loadedPlugins.has(plugin.id) && isPlayerLoaded()) loadSubPlugin(plugin);
            return;
        }
    }

    function createManagerUI() {
        const shouldShow = shouldShowUI();
        const existingGroup = document.getElementById("bc-plugin-btn-group");
        const existingPanel = document.getElementById("bc-plugin-panel");

        if (currentUIState === shouldShow) return;
        currentUIState = shouldShow;

        if (!shouldShow) {
            if (existingGroup) existingGroup.classList.add('hidden');
            if (existingPanel) { existingPanel.classList.add('hidden'); existingPanel.classList.remove('show'); }
            return;
        }
        if (existingGroup && existingPanel) {
            existingGroup.classList.remove('hidden');
            existingPanel.classList.remove('hidden');
            return;
        }

        if (existingGroup) existingGroup.remove();
        if (existingPanel) existingPanel.remove();
        injectStyles();

        // 按鈕群組
        const btnGroup = document.createElement("div");
        btnGroup.id = "bc-plugin-btn-group";
        btnGroup.className = "bc-plugin-btn-group";

        const floatingBtn = document.createElement("button");
        floatingBtn.className = "bc-plugin-floating-btn";
        floatingBtn.innerHTML = `<img src="https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png" alt="🐱" />`;
        floatingBtn.title = "插件管理器";

        const refreshBtn = document.createElement("button");
        refreshBtn.className = "bc-plugin-refresh-btn";
        refreshBtn.innerHTML = "↻";
        refreshBtn.title = getMessage('refreshTitle');
        refreshBtn.style.display = "none";

        const changelogBtn = document.createElement("button");
        changelogBtn.className = "bc-plugin-changelog-btn";
        changelogBtn.innerHTML = "📋";
        changelogBtn.title = getMessage('changelogTitle');
        changelogBtn.style.display = "none";

        btnGroup.appendChild(floatingBtn);
        btnGroup.appendChild(refreshBtn);
        btnGroup.appendChild(changelogBtn);
        document.body.appendChild(btnGroup);
        applyFloatingBtnVisibility();

        // Panel
        const panel = document.createElement("div");
        panel.id = "bc-plugin-panel";
        panel.className = "bc-plugin-panel";

        const header = document.createElement("div");
        header.className = "bc-plugin-header";
        header.innerHTML = `<h3 class="bc-plugin-title">${getMessage('welcomeTitle')}</h3>`;

        // 分頁列
        const tabsBar = document.createElement("div");
        tabsBar.className = "bc-plugin-tabs";
        const localTab = document.createElement("button");
        localTab.className = "bc-plugin-tab active";
        localTab.textContent = _isCN ? "📱 本地" : "📱 Local";
        const accountTab = document.createElement("button");
        accountTab.className = "bc-plugin-tab";
        accountTab.textContent = _isCN ? "☁️ 帳戶" : "☁️ Account";
        tabsBar.appendChild(localTab);
        tabsBar.appendChild(accountTab);

        // 本地內容
        const localContent = document.createElement("div");
        localContent.id = "bc-plugin-content-local";
        localContent.className = "bc-plugin-content";
        if (!pluginsLoaded) {
            localContent.innerHTML = `<div class="bc-plugin-loading">${getMessage('loadingPlugins')}</div>`;
        } else {
            subPlugins.forEach(plugin => localContent.appendChild(buildPluginItem(plugin, 'local')));
        }

        // 帳戶內容
        const accountContent = document.createElement("div");
        accountContent.id = "bc-plugin-content-account";
        accountContent.className = "bc-plugin-content";
        accountContent.style.display = "none";
        buildAccountContent(accountContent);

        const footer = document.createElement("div");
        footer.className = "bc-plugin-footer";
        footer.innerHTML = `❖ <a class="bc-plugin-footer-link" href="https://github.com/awdrrawd/liko-Plugin-Repository/" target="_blank" rel="noopener noreferrer">Liko Plugin Manager v${modversion}</a> ❖ by Likolisu`;

        panel.appendChild(header);
        panel.appendChild(tabsBar);
        panel.appendChild(localContent);
        panel.appendChild(accountContent);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        let isOpen = false;

        const setSubBtnsVisible = (visible) => {
            refreshBtn.style.display = visible ? "flex" : "none";
            changelogBtn.style.display = visible ? "flex" : "none";
        };

        // 分頁切換
        localTab.addEventListener("click", () => {
            localTab.classList.add("active");
            accountTab.classList.remove("active");
            localContent.style.display = "";
            accountContent.style.display = "none";
        });
        accountTab.addEventListener("click", () => {
            accountTab.classList.add("active");
            localTab.classList.remove("active");
            localContent.style.display = "none";
            accountContent.style.display = "";
            // 每次切換到帳戶分頁時重建內容，確保登入狀態正確
            buildAccountContent(accountContent);
        });

        floatingBtn.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            isOpen = !isOpen;
            panel.classList.toggle("show", isOpen);
            setSubBtnsVisible(isOpen);
            // JSON 載入完成但 UI 還在 loading 狀態時補刷本地內容
            if (isOpen && pluginsLoaded && localContent.querySelector('.bc-plugin-loading')) {
                localContent.innerHTML = '';
                subPlugins.forEach(plugin => localContent.appendChild(buildPluginItem(plugin, 'local')));
            }
        });

        refreshBtn.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            if (isRefreshing) return;
            refreshBtn.classList.add("spinning");
            forceRefreshCache().finally(() => {
                refreshBtn.classList.remove("spinning");
            });
        });

        changelogBtn.addEventListener("click", (e) => {
            e.preventDefault(); e.stopPropagation();
            showChangelogModal();
        });

        // 本地 & 帳戶分頁的 toggle 點擊都走同一個 handler
        localContent.addEventListener("click", handlePluginToggle);
        accountContent.addEventListener("click", handlePluginToggle);

        // 移除舊的 listener（若 UI 重建），再掛新的
        if (_docClickHandler) document.removeEventListener("click", _docClickHandler);
        _docClickHandler = (e) => {
            if (!panel.contains(e.target) && !btnGroup.contains(e.target) && isOpen) {
                isOpen = false;
                panel.classList.remove("show");
                setSubBtnsVisible(false);
            }
        };
        document.addEventListener("click", _docClickHandler);
    }

    // ============================================================
    // === 通知系統 ===============================================
    // ============================================================

    // 開關插件提示（panel 底部往下展開）
    let toggleNotifTimer = null;
    function showToggleNotification(icon, title, message) {
        let notif = document.getElementById("pcm-toggle-notif");
        if (notif) {
            notif.classList.remove('show');
            clearTimeout(toggleNotifTimer);
        } else {
            notif = document.createElement("div");
            notif.id = "pcm-toggle-notif";
            notif.className = "bc-liko-toggle-notification";
            document.body.appendChild(notif);
        }

        const panel = document.getElementById("bc-plugin-panel");
        if (panel) {
            const rect = panel.getBoundingClientRect();
            notif.style.top = (rect.bottom + 3) + "px";
            notif.style.width = panel.clientWidth + "px";
            notif.style.left = rect.left + "px";
            notif.style.right = "auto";
        }

        notif.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:3px;">
                <span style="font-size:18px; margin-right:8px;">${icon}</span>
                <strong style="font-size:13px;">${title}</strong>
            </div>
            <div style="font-size:11px; opacity:0.88;">${message}</div>
        `;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => { notif.classList.add('show'); });
        });

        toggleNotifTimer = setTimeout(() => {
            notif.classList.remove('show');
            notif.classList.add('hide');
            setTimeout(() => { if (notif.parentNode) notif.remove(); }, 350);
        }, 2500);
    }

    // 系統通知（右上角）
    let systemNotifTimer = null;
    function showNotification(icon, title, message) {
        let notif = document.getElementById("pcm-system-notif");
        if (notif) {
            notif.classList.remove('show');
            notif.classList.add('hide');
            clearTimeout(systemNotifTimer);
            setTimeout(() => createSystemNotif(icon, title, message), 300);
            return;
        }
        createSystemNotif(icon, title, message);
    }

    function createSystemNotif(icon, title, message) {
        let notif = document.getElementById("pcm-system-notif");
        if (notif) notif.remove();
        notif = document.createElement("div");
        notif.id = "pcm-system-notif";
        notif.className = "bc-liko-system-notification";
        notif.innerHTML = `
            <div style="display:flex; align-items:center; margin-bottom:3px;">
                <span style="font-size:18px; margin-right:8px;">${icon}</span>
                <strong style="font-size:13px;">${title}</strong>
            </div>
            <div style="font-size:11px; opacity:0.85;">${message}</div>
        `;
        document.body.appendChild(notif);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { notif.classList.add('show'); });
        });
        systemNotifTimer = setTimeout(() => {
            notif.classList.remove('show');
            notif.classList.add('hide');
            setTimeout(() => { if (notif.parentNode) notif.remove(); }, 400);
        }, 3000);
    }

    // ============================================================
    // === 語言變化偵測 ============================================
    // ============================================================

    let lastDetectedLanguage = null;

    function checkLanguageChange() {
        const currentLang = detectLanguage();
        if (lastDetectedLanguage !== null && lastDetectedLanguage !== currentLang) {
            _isCN = currentLang;
            const existingGroup = document.getElementById("bc-plugin-btn-group");
            const existingPanel = document.getElementById("bc-plugin-panel");
            if (existingGroup) existingGroup.remove();
            if (existingPanel) existingPanel.remove();
            currentUIState = null;
            createManagerUI();
        }
        lastDetectedLanguage = currentLang;
    }

    // ============================================================
    // === MutationObserver =======================================
    // ============================================================

    function monitorPageChanges() {
        let debounceTimer;

        const handleChange = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                checkLanguageChange();
                createManagerUI();
                if (!localLoadStarted) loadLocalPluginsPhase();
                if (!accountLoadStarted) loadAccountPluginsPhase();
            }, 300);
        };

        _lifecycle.observer = new MutationObserver(handleChange);
        _lifecycle.observer.observe(document.body, { childList: true, subtree: false });

        let lastUrl = window.location.href;
        const urlCheckId = setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                handleChange();
            }
        }, 1000);
        _lifecycle.intervals.push(urlCheckId);

        const langCheckId = setInterval(() => { checkLanguageChange(); }, 5000);
        _lifecycle.intervals.push(langCheckId);

        createManagerUI();
    }

    // ============================================================
    // === /pcm 指令 ==============================================
    // ============================================================

    function handle_PCM_Command(text) {
        if (typeof text !== "string") text = String(text || "");
        const args = text.trim().split(/\s+/).filter(x => x !== "");
        const sub = (args[0] || "").toLowerCase();
        const isZh = detectLanguage();
        if (!sub || sub === "help") {
            try { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${isZh ? generateChineseHelp() : generateEnglishHelp()}</font>`, Timeout: 60000 }); } catch(e) {}
        } else if (sub === "list") {
            try { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${isZh ? generateChinesePluginList() : generateEnglishPluginList()}</font>`, Timeout: 60000 }); } catch(e) {}
        } else {
            const errorText = isZh ? "請輸入 /pcm help 查看說明或 /pcm list 查看插件列表" : "Please enter /pcm help for instructions or /pcm list to see plugin list";
            try { ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${errorText}</font>` }); } catch(e) {}
        }
    }

    function generateChineseHelp() {
        return `📋 Liko 插件管理器 說明書\n\n🎮 使用方法：\n• 點擊右上角的浮動按鈕開啟管理面板\n• 切換開關來啟用/停用插件\n• 三段開關：OFF → 第一選項 → 第二選項\n\n📝 可用指令：\n/pcm help - 顯示此說明書\n/pcm list - 查看所有可用插件列表\n\n💡 小提示：\n插件啟用後會自動載入，或在下次刷新頁面時生效。\n❤️ 感謝使用 Liko 插件管理器！`;
    }
    function generateEnglishHelp() {
        return `📋 Liko Plugin Collection Manager Manual\n\n🎮 How to Use:\n• Click the floating button in the top right to open management panel\n• Toggle switches to enable/disable plugins\n• Three-state toggle: OFF → First option → Second option\n\n📝 Available Commands:\n/pcm help - Show this manual\n/pcm list - View all available plugin list\n\n💡 Tips:\nPlugins will auto-load after enabling, or take effect on next page refresh.\n❤️ Thank you for using Liko Plugin Collection Manager!`;
    }
    function generateChinesePluginList() {
        let listText = "🔌 可用插件列表：\n\n";
        subPlugins.forEach((plugin) => {
            const isTri = isTriStatePlugin(plugin);
            const status = isTri ? (plugin.state === "stable" ? "✅" : plugin.state === "beta" ? "🧪" : "⭕") : (plugin.enabled ? "✅" : "⭕");
            listText += `${status}${plugin.icon} ${getPluginName(plugin)}\n📄 ${getPluginDescription(plugin)}\n`;
            const ai = getPluginAdditionalInfo(plugin);
            if (ai?.trim()) listText += ` ✦ ${ai}\n`;
            listText += "\n";
        });
        listText += "💡 在管理面板中切換開關來啟用/停用插件";
        return listText;
    }
    function generateEnglishPluginList() {
        let listText = "🔌 Available Plugin List:\n\n";
        subPlugins.forEach((plugin) => {
            const isTri = isTriStatePlugin(plugin);
            const status = isTri ? (plugin.state === "stable" ? "✅" : plugin.state === "beta" ? "🧪" : "⭕") : (plugin.enabled ? "✅" : "⭕");
            listText += `${status}${plugin.icon} ${getPluginName(plugin)}\n📄 ${getPluginDescription(plugin)}\n`;
            const ai = getPluginAdditionalInfo(plugin);
            if (ai?.trim()) listText += ` ✦ ${ai}\n`;
            listText += "\n";
        });
        listText += "💡 Toggle switches in the management panel to enable/disable plugins";
        return listText;
    }

    function tryRegisterCommand() {
        let attempts = 0;
        const maxAttempts = 20; // 最多重試 20 次（約 60 秒）
        const tryRegister = () => {
            attempts++;
            try {
                if (typeof CommandCombine === "function") {
                    CommandCombine([{ Tag: "pcm", Description: "Liko's Plugin Collection Manager", Action: (text) => handle_PCM_Command(text) }]);
                    console.log("🐈‍⬛ [PCM] ✅ /pcm 指令已註冊");
                    return;
                }
            } catch(e) {}
            if (attempts < maxAttempts) setTimeout(tryRegister, 3000);
        };
        tryRegister();
    }

    // ============================================================
    // === 進房間後發送載入訊息 ====================================
    // ============================================================

    function sendLoadedMessage() {
        const waitForChatRoom = () => new Promise((resolve) => {
            let resolved = false;
            const check = () => {
                if (resolved) return;
                if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                    resolved = true;
                    resolve(true);
                } else {
                    setTimeout(check, 1000);
                }
            };
            check();
            // 60 秒逾時保險，避免無限等待
            setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 60000);
        });
        waitForChatRoom().then((success) => {
            if (success) {
                try {
                    ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${getMessage('shortLoaded')}</font>`, Timeout: 60000 });
                    showNotification("🐈‍⬛", "PCM", getMessage('loaded'));
                } catch(e) {}
            }
        });
    }

    // ============================================================
    // === BC Preference 頁面註冊 ==================================
    // ============================================================

    async function registerPreferencePage() {
        // 等待 BC preference 系統就緒
        let attempts = 0;
        while (typeof PreferenceRegisterExtensionSetting !== 'function' && attempts < 60) {
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }
        if (typeof PreferenceRegisterExtensionSetting !== 'function') return;

        window.PreferenceSubscreenPCMSettingsLoad = function() {};

        window.PreferenceSubscreenPCMSettingsRun = function() {
            DrawCharacter(Player, 50, 50, 0.9);
            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");
            MainCanvas.textAlign = "left";
            DrawText(_isCN ? "- PCM 插件管理器設定 -" : "- PCM Plugin Manager Settings -", 500, 125, "Black", "Gray");

            const localCount = subPlugins.filter(p => isPluginEnabled(p)).length;
            const accountCount = subPlugins.filter(p => isPluginEnabledInAccount(p)).length;
            DrawText(
                _isCN ? `📱 本地已啟用：${localCount} 個插件` : `📱 Local enabled: ${localCount} plugins`,
                500, 280, "Black", "Gray"
            );
            DrawText(
                _isCN ? `☁️ 帳戶已啟用：${accountCount} 個插件` : `☁️ Account enabled: ${accountCount} plugins`,
                500, 355, "Black", "Gray"
            );

            // 浮動按鈕顯示開關
            const showBtn = pluginSettings.showFloatingBtn !== false;
            DrawText(_isCN ? "顯示浮動按鈕" : "Show floating button", 500, 480, "Black", "Gray");
            DrawCheckbox(900, 455, 64, 64, "", showBtn);

            MainCanvas.textAlign = "center";
            DrawText(
                _isCN ? "詳細插件管理請使用頁面右上角的浮動按鈕" : "Use the floating button for full plugin management",
                960, 620, "Gray", "White"
            );
        };

        window.PreferenceSubscreenPCMSettingsClick = function() {
            if (MouseIn(1815, 75, 90, 90)) { PreferenceSubscreenPCMSettingsExit(); return; }
            // 浮動按鈕開關
            if (MouseIn(900, 455, 64, 64)) {
                pluginSettings.showFloatingBtn = pluginSettings.showFloatingBtn === false;
                saveSettings(pluginSettings);
                applyFloatingBtnVisibility();
            }
        };

        window.PreferenceSubscreenPCMSettingsExit = function() {
            PreferenceSubscreenExtensionsClear();
        };

        PreferenceRegisterExtensionSetting({
            Identifier: "PCMSettings",
            ButtonText: _isCN ? "PCM 插件管理器" : "PCM Plugin Manager",
            Image: "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png",
            click: window.PreferenceSubscreenPCMSettingsClick,
            run: window.PreferenceSubscreenPCMSettingsRun,
            exit: window.PreferenceSubscreenPCMSettingsExit,
            load: window.PreferenceSubscreenPCMSettingsLoad,
        });
        console.log("🐈‍⬛ [PCM] ✅ Preference 頁面已註冊");
    }

    // ============================================================
    // === 初始化 =================================================
    // ============================================================

    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's PCM",
                fullName: 'Liko - Plugin Collection Manager',
                version: modversion,
                repository: 'Liko的插件管理器 | Plugin collection manager',
            });
            registerPCMBadge();
        } else {
            console.error("🐈‍⬛ [PCM] ❌ bcModSdk 不可用");
            return;
        }
    } catch(e) { console.error("🐈‍⬛ [PCM] ❌ 初始化失敗:", e.message); return; }

    async function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        lastDetectedLanguage = detectLanguage();

        injectStyles();
        monitorPageChanges();
        tryRegisterCommand();

        // JSON 載入完後補刷 UI 與版本更新彈窗
        _pluginsProcessPromise.then((success) => {
            if (!success) return;
            const localContent = document.getElementById("bc-plugin-content-local");
            if (localContent && localContent.querySelector('.bc-plugin-loading')) {
                localContent.innerHTML = '';
                subPlugins.forEach(plugin => localContent.appendChild(buildPluginItem(plugin, 'local')));
            }
            const isNewVersion = checkVersionUpdate();
            if (isNewVersion) {
                setTimeout(() => {
                    showChangelogModal();
                    showNotification("✨", getMessage('newVersionTitle'), `v${remoteVersion} — ${getMessage('newVersionHint')}`);
                }, 2000);
            }
        });

        // 兩個載入階段各自獨立啟動，互不阻塞
        loadLocalPluginsPhase();
        loadAccountPluginsPhase();
        setTimeout(() => { checkLanguageChange(); }, 10000);
        registerPreferencePage();

        if (modApi && typeof modApi.onUnload === 'function') {
            modApi.onUnload(() => {
                _lifecycle.intervals.forEach(id => clearInterval(id));
                _lifecycle.intervals.length = 0;
                if (_lifecycle.observer) { _lifecycle.observer.disconnect(); _lifecycle.observer = null; }
                if (_lifecycle.mousemoveHandler) {
                    document.removeEventListener("mousemove", _lifecycle.mousemoveHandler);
                    _lifecycle.mousemoveHandler = null;
                }
                isInitialized = false;
            });
        }
    }

    if (document.readyState === 'loading') {
        document。addEventListener('DOMContentLoaded', () => {
            initialize().then(() => sendLoadedMessage()).catch(e => console.error("🐈‍⬛ [PCM] ❌ 初始化錯誤:", e));
        }, { once: true });
    } else {
        initialize().then(() => sendLoadedMessage()).catch(e => console.error("🐈‍⬛ [PCM] ❌ 初始化錯誤:", e));
    }

    console.log("🐈‍⬛ [PCM] ✅ v1.6.0 腳本載入完成");
})();
