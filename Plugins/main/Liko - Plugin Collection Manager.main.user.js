// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://likulisu.dev/
// @version      1.1.2
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    "use strict";

    // --- modApi 初始化 ---
    let modApi;
    const modversion = "1.1.2";
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's PCM",
                fullName: 'Liko - Plugin Collection Manager',
                version: modversion,
                repository: 'Liko的插件管理器 | Plugin collection manager',
            });
            console.log("✅ Liko's PCM 腳本啟動完成");
            setTimeout(() => {
                if (typeof inplugJS === 'function') {
                    inplugJS();
                } else {
                    console.warn("[PCM] ⚠️ inplugJS 函數未定義");
                }
            }, 2000);
        } else {
            console.error("[PCM] ❌ bcModSdk 或 registerMod 不可用");
            return;
        }
    } catch (e) {
        console.error("[PCM] ❌ 初始化失敗:", e.message);
        return;
    }

    // --- 設定保存（使用防抖） ---
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

    // --- 子插件清單 ---
    const subPlugins = [
        {
            id: "Liko_Tool",
            name: "Liko的工具包",
            description: "有許多小功能合集的工具包，但也有點不穩定",
            icon: "🧰",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Tool.main.user.js",
            enabled: pluginSettings["Liko_Tool"] ?? false,
            customIcon: ""
        },
        {
            id: "Liko_Image_Uploader",
            name: "Liko的圖片上傳器",
            description: "拖曳上傳圖片並分享到聊天室",
            icon: "🖼️",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Image%20Uploader.main.user.js",
            enabled: pluginSettings["Liko_Image_Uploader"] ?? true,
            customIcon: ""
        },
        {
            id: "Liko_CHE",
            name: "Liko的聊天室書記官",
            description: "聊天室信息轉HTML，可以搭配neocities等網站上傳分享",
            icon: "📋",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20CHE.main.user.js",
            enabled: pluginSettings["Liko_CHE"] ?? true,
            customIcon: ""
        },
        {
            id: "Liko_Prank",
            name: "Liko對朋友的惡作劇",
            description: "內褲大盜鬧的BC社群人心惶惶!",
            icon: "🪄",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Prank.main.user.js",
            enabled: pluginSettings["Liko_Prank"] ?? false,
            customIcon: ""
        },
        {
            id: "Liko - NOI",
            name: "Liko的邀請通知器",
            description: "發出好友、白單、黑單的信息!",
            icon: "📧",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20NOI.main.user.js",
            enabled: pluginSettings["Liko - NOI"] ?? true,
            customIcon: ""
        },
        {
            id: "Liko_Bondage_renew",
            name: "Liko的綑綁刷新",
            description: "針對R119綑綁刷新不夠快的應急措施",
            icon: "♻️",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Bondage%20renew.main.user.js",
            enabled: pluginSettings["Liko_Bondage_renew"] ?? false,
            customIcon: ""
        },
        {
            id: "Liko_Release_Maid",
            name: "Liko的解綁女僕",
            description: "自動解榜女僕，不過有點天然，會在意外時觸發!",
            icon: "🧹",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Release%20Maid.main.user.js",
            enabled: pluginSettings["Liko_Release_Maid"] ?? false,
            customIcon: ""
        },
        {
            id: "Liko_Chat_TtoB",
            name: "Liko的對話變按鈕",
            description: "聊天室信息轉按紐，好像不是很有用!",
            icon: "💬",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Chat%20TtoB.main.user.js",
            enabled: pluginSettings["Liko_Chat_TtoB"] ?? true,
            customIcon: ""
        },
        {
            id: "Liko_CDT",
            name: "Liko的座標繪製工具",
            description: "BC的介面UI定位工具，有開發需求的能可以使用!",
            icon: "🖌️",
            url: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20CDT.main.user.js",
            enabled: pluginSettings["Liko_CDT"] ?? false,
            customIcon: ""
        }
    ];

    // --- 修改后的UI显示检查函数 ---
    function shouldShowUI() {
        console.log("[PCM Debug] 当前页面检查:");
        console.log("  - URL:", window.location.href);
        console.log("  - Player:", typeof Player, Player?.Name);
        console.log("  - CurrentScreen:", typeof CurrentScreen !== 'undefined' ? CurrentScreen : 'undefined');

        // 检查是否在登入页面（URL包含login）
        const isLoginPage = window.location.href.includes('/login') ||
                           window.location.href.includes('/Login') ||
                           window.location.href.includes('Login.html');

        if (isLoginPage) {
            console.log("  → 在登入页面，显示UI");
            return true;
        }

        // 检查是否Player尚未加载完成（登入过程中）
        if (typeof Player === 'undefined' || !Player.Name) {
            console.log("  → Player未加载完成，显示UI");
            return true;
        }

        // 检查是否在特定的游戏画面（设定界面等）
        if (typeof CurrentScreen !== 'undefined') {
            const allowedScreens = [
                'Preference',      // 设定界面
                'InformationSheet', // 信息界面
                'Login',           // 登入界面
                'Character'        // 角色界面
            ];

            const isAllowedScreen = allowedScreens.includes(CurrentScreen);
            console.log(`  → CurrentScreen: ${CurrentScreen}, 允许显示: ${isAllowedScreen}`);

            if (isAllowedScreen) {
                return true;
            }
        }

        console.log("  → 不符合显示条件，隐藏UI");
        return false;
    }

    // --- 檢查 Player 是否已載入 ---
    function isPlayerLoaded() {
        return typeof Player !== 'undefined' && Player && Player.Name;
    }

    // --- 載入設定中的自定義圖標 ---
    function loadCustomIcons() {
        subPlugins.forEach(plugin => {
            if (pluginSettings[`${plugin.id}_customIcon`]) {
                plugin.customIcon = pluginSettings[`${plugin.id}_customIcon`];
                plugin.icon = "";
            } else if (pluginSettings[`${plugin.id}_icon`]) {
                plugin.icon = pluginSettings[`${plugin.id}_icon`];
                plugin.customIcon = "";
            }
        });
    }

    // --- 載入插件（按需載入，確保最新版本） ---
    let loadedPlugins = new Set();
    let isLoadingPlugins = false; // 防止重複載入
    let hasStartedPluginLoading = false; // 追踪是否已開始載入插件

    function loadSubPlugin(plugin) {
        if (!plugin.enabled || loadedPlugins.has(plugin.id)) {
            console.log(`⚪ [SubPlugin] ${plugin.name} 已關閉或已載入`);
            return Promise.resolve();
        }

        const urlWithTimestamp = `${plugin.url}?t=${Date.now()}`; // 使用時間戳避免緩存
        return fetch(urlWithTimestamp, { cache: 'no-store' }) // 強制不使用緩存
            .then(res => {
            if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
            return res.text();
        })
            .then(code => {
            try {
                const script = document.createElement('script');
                script.setAttribute('data-plugin', plugin.id);
                script.textContent = code;
                document.body.appendChild(script);
                loadedPlugins.add(plugin.id);
                console.log(`✅ [SubPlugin] ${plugin.name} 載入成功 (URL: ${urlWithTimestamp})`);
            } catch (e) {
                console.error(`❌ [SubPlugin] 載入失敗: ${plugin.name}`, e);
                showNotification("❌", `${plugin.name} 載入失敗`, "請檢查網絡或插件URL");
                throw e;
            }
        })
            .catch(err => {
            console.error(`❌ [SubPlugin] 無法獲取 ${plugin.name} 的腳本: ${urlWithTimestamp}`, err);
            showNotification("❌", `${plugin.name} 載入失敗`, "請檢查網絡或插件URL");
            throw err;
        });
    }

    // 等待Player載入後再開始背景載入插件
    async function waitForPlayerAndLoadPlugins() {
        if (hasStartedPluginLoading) return; // 避免重複執行

        console.log("🔍 [PCM] 檢查 Player 是否已載入...");

        // 等待 Player 載入
        const maxWaitTime = 60000; // 最多等待60秒
        const checkInterval = 1000; // 每秒檢查一次
        let waitTime = 0;

        while (!isPlayerLoaded() && waitTime < maxWaitTime) {
            console.log(`⏳ [PCM] 等待 Player 載入... (${waitTime/1000}s)`);
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
        }

        if (isPlayerLoaded()) {
            console.log("✅ [PCM] Player 已載入，開始載入插件");
            hasStartedPluginLoading = true;
            await loadSubPluginsInBackground();
        } else {
            console.warn("⚠️ [PCM] 等待 Player 載入超時，仍將嘗試載入插件");
            hasStartedPluginLoading = true;
            await loadSubPluginsInBackground();
        }
    }

    // 背景自動載入所有啟用的插件（分批載入以避免阻塞）
    async function loadSubPluginsInBackground() {
        if (isLoadingPlugins) return;
        isLoadingPlugins = true;

        console.log("🔄 [PCM] 開始背景載入啟用的插件...");

        try {
            // 分批載入插件，每批2個，間隔800ms（增加間隔時間）
            const enabledPlugins = subPlugins.filter(plugin => plugin.enabled);
            const batchSize = 2;
            let loadedCount = 0;
            let successCount = 0;

            if (enabledPlugins.length === 0) {
                console.log("ℹ️ [PCM] 沒有啟用的插件需要載入");
                return;
            }

            for (let i = 0; i < enabledPlugins.length; i += batchSize) {
                const batch = enabledPlugins.slice(i, i + batchSize);

                console.log(`📦 [PCM] 正在載入批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(enabledPlugins.length/batchSize)}: ${batch.map(p => p.name).join(', ')}`);

                // 並行載入這一批插件
                const promises = batch.map(plugin =>
                                           loadSubPlugin(plugin).catch(error => {
                    console.warn(`⚠️ [PCM] 插件 ${plugin.name} 載入失敗:`, error.message);
                    return { plugin, error }; // 返回錯誤信息而不是拋出
                })
                                          );

                try {
                    const results = await Promise.allSettled(promises);

                    results.forEach((result, index) => {
                        const plugin = batch[index];
                        if (result.status === 'fulfilled' && !result.value?.error) {
                            successCount++;
                            console.log(`✅ [PCM] ${plugin.name} 載入成功`);
                        } else {
                            console.error(`❌ [PCM] ${plugin.name} 載入失敗:`, result.reason || result.value?.error);
                        }
                    });

                    loadedCount += batch.length;
                    console.log(`📈 [PCM] 進度: ${loadedCount}/${enabledPlugins.length} (成功: ${successCount})`);
                } catch (error) {
                    console.warn(`⚠️ [PCM] 批次載入時發生錯誤:`, error);
                }

                // 如果還有更多批次要載入，等待一段時間
                if (i + batchSize < enabledPlugins.length) {
                    console.log(`⏳ [PCM] 等待 800ms 後載入下一批次...`);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }

            const failedCount = enabledPlugins.length - successCount;
            if (failedCount > 0) {
                console.warn(`⚠️ [PCM] 背景載入完成！成功: ${successCount}, 失敗: ${failedCount}`);
                showNotification("⚠️", "插件載入完成", `成功載入 ${successCount} 個插件，${failedCount} 個失敗`);
            } else {
                console.log("✅ [PCM] 背景插件載入完成！所有插件都載入成功");
                if (enabledPlugins.length > 0) {
                    showNotification("✅", "插件載入完成", `已成功載入 ${successCount} 個插件`);
                }
            }
        } catch (error) {
            console.error("❌ [PCM] 背景載入插件時發生嚴重錯誤:", error);
            showNotification("❌", "載入錯誤", "背景載入插件時發生嚴重錯誤");
        } finally {
            isLoadingPlugins = false;
        }
    }

    // 立即載入插件（用於用戶手動切換時）
    function loadSubPlugins() {
        requestAnimationFrame(() => {
            subPlugins.forEach(plugin => {
                if (plugin.enabled && !loadedPlugins.has(plugin.id)) {
                    loadSubPlugin(plugin);
                }
            });
        });
    }

function injectStyles() {
    if (document.getElementById("bc-plugin-styles")) return;

    const style = document.createElement("style");
    style.id = "bc-plugin-styles";
    style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&display=swap');

        .bc-plugin-container * {
            font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }

        .bc-plugin-floating-btn {
            position: fixed;
            top: 60px;
            right: 20px;
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 50%, #C4B5FD 100%);
            border: none;
            border-radius: 50%;
            cursor: pointer;
            z-index: 2147483647;
            box-shadow: 0 6px 20px rgba(127, 83, 205, 0.3);
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: float 3s ease-in-out infinite;
        }

        .bc-plugin-floating-btn:hover {
            transform: translateY(-3px) scale(1.05);
            box-shadow: 0 8px 25px rgba(127, 83, 205, 0.4);
            background: linear-gradient(135deg, #6B46B2 0%, #9577E3 50%, #B7A3F5 100%);
        }

        .bc-plugin-floating-btn img {
            width: 51px;
            height: 51px;
            border-radius: 50%;
            transform: scaleX(-1);
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-6px) rotate(5deg); }
        }

        .bc-plugin-panel {
            position: fixed;
            top: 20px;
            right: 100px;
            width: 380px;
            max-height: calc(100vh - 120px);
            min-height: 300px;
            background: rgba(26, 32, 46, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            z-index: 2147483646;
            overflow: hidden;
            transform: translateX(420px) scale(0.8);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            /* 移除衝突的 bottom 屬性 */
        }

        .bc-plugin-panel.show {
            transform: translateX(0) scale(1);
            opacity: 1;
        }

        .bc-plugin-header {
            background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 100%);
            padding: 10px;
            color: white;
            text-align: center;
            position: relative;
            overflow: hidden;
            /* 確保 header 不會被壓縮 */
            flex-shrink: 0;
        }

        .bc-plugin-header::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 50%;
            height: 100%;
            background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: slideGlow 2s ease-in-out infinite;
        }

        @keyframes slideGlow {
            0% { transform: translateX(0); }
            100% { transform: translateX(200%); }
        }

        .bc-plugin-title {
            font-size: 16px;
            font-weight: 600;
            margin: 0;
            position: relative;
            z-index: 1;
        }

        .bc-plugin-content {
            padding: 20px;
            /* 修復：確保內容區域會占滿剩餘空間並觸發滾動 */
            flex: 1 1 auto;
            overflow-y: auto;
            overflow-x: hidden;
            /* 設定固定高度確保滾動觸發 */
            max-height: 400px;
            min-height: 300px;
        }

        /* 修復：確保所有設備都能顯示捲軸 */
        .bc-plugin-content {
            /* 強制顯示捲軸 */
            scrollbar-width: thin;
            scrollbar-color: rgba(127, 83, 205, 0.8) rgba(255, 255, 255, 0.1);
            -webkit-overflow-scrolling: touch;
        }

        /* Webkit 瀏覽器的捲軸樣式 */
        .bc-plugin-content::-webkit-scrollbar {
            width: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }

        .bc-plugin-content::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            margin: 4px;
        }

        .bc-plugin-content::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #7F53CD, #A78BFA);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            min-height: 20px;
        }

        .bc-plugin-content::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #6B46B2, #9577E3);
        }

        /* 為觸控設備添加視覺捲軸指示器 */
        .bc-plugin-content::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            background: linear-gradient(to bottom,
                rgba(127, 83, 205, 0.3) 0%,
                rgba(127, 83, 205, 0.1) 50%,
                rgba(127, 83, 205, 0.3) 100%);
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }

        .bc-plugin-content:hover::after,
        .bc-plugin-content:focus::after {
            opacity: 1;
        }

        .bc-plugin-footer {
            background: rgba(255, 255, 255, 0.02);
            padding: 12px 20px;
            text-align: center;
            color: #a0a9c0;
            font-size: 11px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            /* 移除 sticky 定位，使用 flex 布局 */
            flex-shrink: 0;
            backdrop-filter: blur(10px);
        }

        .bc-plugin-item {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            margin-bottom: 12px;
            padding: 16px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .bc-plugin-item.enabled {
            background: rgba(127, 83, 205, 0.1);
            border-color: rgba(127, 83, 205, 0.3);
        }

        .bc-plugin-item.enabled::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 0;
            height: 0;
            border-left: 20px solid #7F53CD;
            border-bottom: 20px solid transparent;
            z-index: 1;
        }

        .bc-plugin-item:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(127, 83, 205, 0.3);
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(127, 83, 205, 0.15);
        }

        .bc-plugin-item-header {
            display: flex;
            align-items: center;
        }

        .bc-plugin-icon {
            font-size: 24px;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.1);
            cursor: pointer;
            position: relative;
            overflow: visible;
        }

        .bc-plugin-icon img {
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }

        .bc-plugin-icon-selector {
            position: absolute;
            top: 100%;
            left: 0;
            background: rgba(26, 32, 46, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px;
            display: none;
            flex-wrap: wrap;
            gap: 4px;
            width: 200px;
            max-height: 120px;
            overflow-y: auto;
            z-index: 10;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .bc-plugin-icon-selector.show {
            display: flex;
        }

        .bc-plugin-icon-option {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s ease;
            font-size: 16px;
        }

        .bc-plugin-icon-option img {
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }

        .bc-plugin-icon-option:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .bc-plugin-info {
            flex: 1;
            color: white;
        }

        .bc-plugin-name {
            font-size: 16px;
            font-weight: 500;
            margin: 0;
            color: #fff;
        }

        .bc-plugin-desc {
            font-size: 12px;
            color: #a0a9c0;
            margin: 4px 0 0 0;
            line-height: 1.4;
        }

        .bc-plugin-toggle {
            position: relative;
            width: 50px;
            height: 26px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 13px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: none;
            outline: none;
        }

        .bc-plugin-toggle.active {
            background: linear-gradient(135deg, #7F53CD, #A78BFA);
        }

        .bc-plugin-toggle::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .bc-plugin-toggle.active::after {
            left: 26px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        /* 隐藏UI的样式 */
        .bc-plugin-floating-btn.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translateX(100px) scale(0.8);
        }

        .bc-plugin-panel.hidden {
            opacity: 0;
            pointer-events: none;
            transform: translateX(420px) scale(0.8);
        }

        /* 響應式設計 - 保留但修復 */
        @media (max-width: 480px) {
            .bc-plugin-panel {
                width: calc(100vw - 40px);
                right: 20px;
                /* 移除 left: 20px 以避免衝突 */
                max-height: calc(100vh - 100px);
            }

            .bc-plugin-floating-btn {
                right: 10px;
                width: 56px;
                height: 56px;
            }

            .bc-plugin-floating-btn img {
                width: 44px;
                height: 44px;
            }
        }

        @media (max-height: 600px) {
            .bc-plugin-panel {
                max-height: calc(100vh - 80px);
                top: 10px;
            }
        }
    `;
    document.head.appendChild(style);
}

    // --- 建立UI（优化版，添加显示/隐藏逻辑） ---
    let cachedPanel = null; // 緩存面板 DOM
    let currentUIState = null; // 追踪当前UI状态

function createManagerUI() {
    //console.log("🔧 [PCM Debug] 開始建立UI");

    const shouldShow = shouldShowUI();
    const existingBtn = document.getElementById("bc-plugin-floating-btn");
    const existingPanel = document.getElementById("bc-plugin-panel");

    // 如果UI状态没有变化，则不需要处理
    if (currentUIState === shouldShow) {
        //console.log(`🔧 [PCM Debug] UI状态未变化 (${shouldShow ? '显示' : '隐藏'})，跳过处理`);
        return;
    }

    currentUIState = shouldShow;
    //console.log(`🔧 [PCM Debug] UI状态变化为: ${shouldShow ? '显示' : '隐藏'}`);

    // 如果需要隐藏UI
    if (!shouldShow) {
        if (existingBtn) {
            existingBtn.classList.add('hidden');
            //console.log("🔧 [PCM Debug] 隐藏浮动按钮");
        }
        if (existingPanel) {
            existingPanel.classList.add('hidden');
            existingPanel.classList.remove('show');
            //console.log("🔧 [PCM Debug] 隐藏面板");
        }
        return;
    }

    // 如果需要显示UI但UI已存在，则显示它们
    if (shouldShow && existingBtn && existingPanel) {
        existingBtn.classList.remove('hidden');
        existingPanel.classList.remove('hidden');
        //console.log("🔧 [PCM Debug] 显示现有UI");
        return;
    }

    // 如果需要显示UI但UI不存在，则创建它们
    if (shouldShow && (!existingBtn || !existingPanel)) {
        // 清理可能存在的不完整UI
        if (existingBtn) existingBtn.remove();
        if (existingPanel) existingPanel.remove();

        //console.log("🔧 [PCM Debug] 创建新的UI");
        injectStyles();

        // 建立浮動按鈕
        const floatingBtn = document.createElement("button");
        floatingBtn.id = "bc-plugin-floating-btn";
        floatingBtn.className = "bc-plugin-floating-btn";
        floatingBtn.innerHTML = `<img src="https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png" alt="🐱" />`;
        floatingBtn.title = "插件管理器";
        document.body.appendChild(floatingBtn);

        // 建立面板 - 確保使用 flexbox 結構
        const panel = document.createElement("div");
        panel.id = "bc-plugin-panel";
        panel.className = "bc-plugin-panel";

        // 建立 header
        const header = document.createElement("div");
        header.className = "bc-plugin-header";
        header.innerHTML = `<h3 class="bc-plugin-title">🐈‍⬛ 插件管理器</h3>`;

        // 建立 content - 這裡會包含所有插件項目
        const content = document.createElement("div");
        content.className = "bc-plugin-content";

        // 為每個插件建立項目
        subPlugins.forEach(plugin => {
            const item = document.createElement("div");
            item.className = `bc-plugin-item ${plugin.enabled ? 'enabled' : ''}`;

            const iconDisplay = plugin.customIcon ?
                  `<img src="${plugin.customIcon}" alt="${plugin.name} icon" />` :
                  plugin.icon;

            item.innerHTML = `
                <div class="bc-plugin-item-header">
                    <div class="bc-plugin-icon" data-plugin="${plugin.id}" tabindex="0">
                        ${iconDisplay}
                        <div class="bc-plugin-icon-selector">
                            <div class="bc-plugin-icon-option" data-icon="🧰">🧰</div>
                            <div class="bc-plugin-icon-option" data-icon="🖼️">🖼️</div>
                            <div class="bc-plugin-icon-option" data-icon="📋">📋</div>
                            <div class="bc-plugin-icon-option" data-icon="🪄">🪄</div>
                            <div class="bc-plugin-icon-option" data-icon="📧">📧</div>
                            <div class="bc-plugin-icon-option" data-icon="♻️">♻️</div>
                            <div class="bc-plugin-icon-option" data-icon="🧹">🧹</div>
                            <div class="bc-plugin-icon-option" data-icon="💬">💬</div>
                            <div class="bc-plugin-icon-option" data-icon="🖌️">🖌️</div>
                            <div class="bc-plugin-icon-option" data-icon="⭐">⭐</div>
                            <div class="bc-plugin-icon-option" data-icon="🔧">🔧</div>
                            <div class="bc-plugin-icon-option" data-icon="⚙️">⚙️</div>
                            <div class="bc-plugin-icon-option" data-icon="url">🖼️</div>
                        </div>
                    </div>
                    <div class="bc-plugin-info">
                        <h4 class="bc-plugin-name">${plugin.name}</h4>
                        <p class="bc-plugin-desc">${plugin.description}</p>
                    </div>
                    <button class="bc-plugin-toggle ${plugin.enabled ? 'active' : ''}"
                            data-plugin="${plugin.id}"
                            aria-label="${plugin.name} 啟用開關">
                    </button>
                </div>
            `;

            content.appendChild(item);
        });

        // 建立 footer
        const footer = document.createElement("div");
        footer.className = "bc-plugin-footer";
        footer.innerHTML = `❖ Liko Plugin Manager v1.1.2 ❖ by Likolisu`;

        // 組裝面板
        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);
        document.body.appendChild(panel);

        let isOpen = false;

        floatingBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            isOpen = !isOpen;
            panel.classList.toggle("show", isOpen);

            // 開啟面板時檢查滾動狀況
            if (isOpen) {
                setTimeout(() => {
                    const needsScroll = content.scrollHeight > content.clientHeight;
                }, 1000);
            }
        });

        // 事件委派處理
        content.addEventListener("click", (e) => {
            // icon 點擊處理
            const iconElement = e.target.closest(".bc-plugin-icon");
            if (iconElement) {
                e.stopPropagation();
                const selector = iconElement.querySelector(".bc-plugin-icon-selector");
                document.querySelectorAll(".bc-plugin-icon-selector.show").forEach(s => {
                    if (s !== selector) s.classList.remove("show");
                });
                selector.classList.toggle("show");
            }

            // icon 選項處理
            const iconOption = e.target.closest(".bc-plugin-icon-option");
            if (iconOption) {
                e.stopPropagation();
                const pluginId = iconOption.closest(".bc-plugin-item").querySelector("[data-plugin]").getAttribute("data-plugin");
                const plugin = subPlugins.find(p => p.id === pluginId);
                const iconValue = iconOption.getAttribute("data-icon");

                if (iconValue === "url") {
                    const customUrl = prompt("請輸入圖片網址：", "");
                    if (customUrl && customUrl.trim() && customUrl.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif)$/i)) {
                        plugin.customIcon = customUrl.trim();
                        plugin.icon = "";
                        pluginSettings[`${pluginId}_customIcon`] = customUrl.trim();
                        saveSettings(pluginSettings);

                        const iconContainer = iconOption.closest(".bc-plugin-icon");
                        const selectorHTML = iconContainer.querySelector(".bc-plugin-icon-selector").outerHTML;
                        iconContainer.innerHTML = `<img src="${customUrl.trim()}" alt="${plugin.name} icon" />${selectorHTML}`;
                    }
                } else {
                    plugin.icon = iconValue;
                    plugin.customIcon = "";
                    pluginSettings[`${pluginId}_icon`] = iconValue;
                    delete pluginSettings[`${pluginId}_customIcon`];
                    saveSettings(pluginSettings);

                    const iconContainer = iconOption.closest(".bc-plugin-icon");
                    const selectorHTML = iconContainer.querySelector(".bc-plugin-icon-selector").outerHTML;
                    iconContainer.innerHTML = iconValue + selectorHTML;
                }

                iconOption.closest(".bc-plugin-icon-selector").classList.remove("show");
            }

            // toggle 開關處理
            const toggle = e.target.closest(".bc-plugin-toggle");
            if (toggle) {
                const pluginId = toggle.getAttribute("data-plugin");
                const plugin = subPlugins.find(p => p.id === pluginId);

                if (plugin) {
                    plugin.enabled = !plugin.enabled;
                    pluginSettings[pluginId] = plugin.enabled;
                    saveSettings(pluginSettings);

                    toggle.classList.toggle("active", plugin.enabled);
                    const item = toggle.closest(".bc-plugin-item");
                    item.classList.toggle("enabled", plugin.enabled);

                    showNotification(
                        plugin.enabled ? "🐈‍⬛" : "🐾",
                        `${plugin.name} 已${plugin.enabled ? "啟用" : "停用"}`,
                        plugin.enabled ? "插件已載入或將在下次刷新生效" : "下次載入時將不會啟動"
                    );

                    // 如果啟用插件且Player已載入，則立即載入插件
                    if (plugin.enabled && !loadedPlugins.has(plugin.id) && isPlayerLoaded()) {
                        loadSubPlugin(plugin);
                    }
                }
            }
        });

        // 點擊外部關閉面板
        document.addEventListener("click", (e) => {
            if (!panel.contains(e.target) && !floatingBtn.contains(e.target) && isOpen) {
                isOpen = false;
                panel.classList.remove("show");
            }
        });

        // 點擊外部隱藏 icon selector
        document.addEventListener("click", () => {
            document.querySelectorAll(".bc-plugin-icon-selector.show").forEach(s => s.classList.remove("show"));
        });
    }
}

    // --- 通知系統 ---
    function showNotification(icon, title, message) {
        requestAnimationFrame(() => {
            const existing = document.querySelector(".bc-liko-notification");
            if (existing) existing.remove();

            const notification = document.createElement("div");
            notification.className = "bc-liko-notification";
            notification.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: linear-gradient(135deg, #7F53CD 0%, #A78BFA 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 15px;
                box-shadow: 0 8px 25px rgba(127, 83, 205, 0.3);
                z-index: 2147483648;
                font-family: 'Noto Sans TC', sans-serif;
                font-size: 14px;
                max-width: 300px;
                transform: translateX(350px);
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            `;

            notification.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 20px; margin-right: 8px;">${icon}</span>
                    <strong>${title}</strong>
                </div>
                <div style="font-size: 12px; opacity: 0.9;">${message}</div>
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.style.transform = "translateX(0)";
            }, 100);

            setTimeout(() => {
                notification.style.transform = "translateX(350px)";
                setTimeout(() => notification.remove(), 400);
            }, 3000);
        });
    }

    // --- 监听页面变化（使用防抖，增加UI状态检查） ---
    function monitorPageChanges() {
        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                createManagerUI();

                // 如果Player已載入且尚未開始載入插件，則開始載入
                if (isPlayerLoaded() && !hasStartedPluginLoading) {
                    console.log("🎯 [PCM] Player已載入，觸發插件載入");
                    waitForPlayerAndLoadPlugins();
                }
            }, 300); // 增加防抖延迟以避免过于频繁的检查
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // 也监听URL变化
        let lastUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                //console.log("[PCM Debug] URL变化，检查UI状态:", lastUrl);
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    createManagerUI();

                    // 檢查是否需要觸發插件載入
                    if (isPlayerLoaded() && !hasStartedPluginLoading) {
                        console.log("🎯 [PCM] URL變化後Player已載入，觸發插件載入");
                        waitForPlayerAndLoadPlugins();
                    }
                }, 1000);
            }
        }, 1000);

        createManagerUI();
    }

    // --- 初始化 ---
    function initialize() {
        loadCustomIcons();
        monitorPageChanges();

        // 延遲檢查Player並開始載入插件
        setTimeout(() => {
            console.log("🔍 [PCM] 5秒後開始檢查Player狀態");
            waitForPlayerAndLoadPlugins();
        }, 5000); // 5秒後開始檢查Player狀態

        console.log("[PCM] ✅ 初始化完成！插件將在Player載入後自動載入");
    }

    // 頁面完全載入後再初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    console.log("[PCM] ✅ 腳本載入完成！");
})();
