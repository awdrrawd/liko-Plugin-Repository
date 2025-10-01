// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://likolisu.dev/
// @version      1.3.2
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
    const modversion = "1.3.2";
    let cachedViewingCharacter = null;
    let lastCharacterCheck = 0;
    let lastScreenCheck = null;
    let lastScreenCheckTime = 0;
    const CHARACTER_CACHE_TIME = 50; // 角色快取時間 (ms)
    const SCREEN_CACHE_TIME = 100; // 屏幕檢查快取時間 (ms)

    // --- PCM徽章配置 ---
    const PCM_BADGE_CONFIG = {
        offsetX: 240,        // X軸偏移 (正數向右，負數向左)
        offsetY: 25,         // Y軸偏移 (負數向上，正數向下)
        size: 36,            // 徽章大小
        showBackground: false, // 是否顯示背景
        backgroundColor: "#7F53CD", // 背景顏色
        borderColor: "#FFFFFF",     // 邊框顏色
        borderWidth: 1              // 邊框寬度
    };

    // 緩存PCM圖標，避免重複載入造成閃爍
    let pcmBadgeImage = null;
    let pcmImageLoaded = false;

    // --- 語言檢測和多語言支持 ---
    function detectLanguage() {
        // 檢查瀏覽器語言
        const browserLang = navigator.language || navigator.userLanguage;

        // 檢查 BC 遊戲語言設置（如果存在）
        let gameLang = null;
        if (typeof TranslationLanguage !== 'undefined') {
            gameLang = TranslationLanguage;
        }

        // 優先使用遊戲語言，其次瀏覽器語言
        const lang = gameLang || browserLang || 'en';

        // 判斷是否為中文
        return lang.toLowerCase().startsWith('zh') || lang.toLowerCase().includes('cn') || lang.toLowerCase().includes('tw');
    }

    // 多語言信息配置
    const messages = {
        en: {
            loaded: `Liko's Plugin Collection Manager v${modversion} Loaded! Click the floating button to manage plugins.`,
            shortLoaded: `📋 Liko Plugin Collection Manager Manual

🎮 How to Use:
• Click the floating button in the top right to open management panel
• Toggle switches to enable/disable plugins

📝 Available Commands:
/pcm help - Show this manual
/pcm list - View descriptions for all available plugins.

💡 Tips:
Plugins will auto-load after enabling, or take effect on next page refresh.
Recommend selectively enabling plugins for the best experience.`,
            welcomeTitle: "🐈‍⬛ Plugin Manager",
            helpCommand: "Use floating button or /pcm help for more information",
            pluginLoadComplete: "Plugin loading completed",
            successLoaded: "Successfully loaded",
            plugins: "plugins",
            failed: "failed",
            pluginEnabled: "enabled",
            pluginDisabled: "disabled",
            willTakeEffect: "Plugin loaded or will take effect on next refresh",
            willNotStart: "Will not start on next load"
        },
        zh: {
            loaded: `Liko的插件管理器 v${modversion} 載入完成！點擊浮動按鈕管理插件。`,
            shortLoaded: `📋 Liko 插件管理器 說明書

🎮 使用方法：
• 點擊右上角的浮動按鈕開啟管理面板
• 切換開關來啟用/停用插件

📝 可用指令：
/pcm help - 顯示此說明書
/pcm list - 查看所有可用插件說明

💡 小提示：
插件啟用後會自動載入，或在下次刷新頁面時生效。
建議根據需要選擇性啟用插件以獲得最佳體驗。`,
            welcomeTitle: "🐈‍⬛ 插件管理器",
            helpCommand: "使用浮動按鈕或 /pcm help 查看更多信息",
            pluginLoadComplete: "插件載入完成",
            successLoaded: "已成功載入",
            plugins: "個插件",
            failed: "個失敗",
            pluginEnabled: "已啟用",
            pluginDisabled: "已停用",
            willTakeEffect: "插件已載入或將在下次刷新生效",
            willNotStart: "下次載入時將不會啟動"
        }
    };

    // 獲取當前語言的信息
    function getMessage(key) {
        const isZh = detectLanguage();
        return messages[isZh ? 'zh' : 'en'][key];
    }

    // 獲取插件名稱（根據語言）
    function getPluginName(plugin) {
        const isZh = detectLanguage();
        return isZh ? plugin.name : plugin.en_name;
    }

    // 獲取插件描述（根據語言）
    function getPluginDescription(plugin) {
        const isZh = detectLanguage();
        return isZh ? plugin.description : plugin.en_description;
    }

    // 獲取插件補充信息（根據語言）
    function getPluginAdditionalInfo(plugin) {
        const isZh = detectLanguage();
        return isZh ? plugin.additionalInfo : plugin.en_additionalInfo;
    }

    // --- PCM徽章相關功能 ---
    // 初始化PCM圖標
    function initializePCMBadgeImage() {
        if (!pcmBadgeImage) {
            pcmBadgeImage = new Image();
            pcmBadgeImage.crossOrigin = "anonymous";
            pcmBadgeImage.onload = function() {
                pcmImageLoaded = true;
            };
            pcmBadgeImage.onerror = function() {
                console.warn("[PCM] ⚠️ PCM徽章圖片載入失敗");
                pcmImageLoaded = false;
            };
            pcmBadgeImage.src = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_4.png";
        }
    }
    // 繪製PCM徽章
    function drawPCMBadge(character, x, y, zoom) {
        try {
            // 參考BCTweaks的顯示條件邏輯
            if (!character.OnlineSharedSettings || !character.OnlineSharedSettings.PCM) {
                return;
            }

            // 檢查ChatRoomHideIconState (BC的圖標隱藏狀態)
            if (typeof ChatRoomHideIconState !== 'undefined' && ChatRoomHideIconState !== 0) {
                return;
            }

            // 只在聊天室顯示
            if (CurrentScreen !== "ChatRoom") {
                return;
            }

            // 檢查是否選中了特定角色 - 選中時不顯示徽章
            if (typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null) {
                return;
            }

            // 參考BCTweaks的懸停邏輯 - 使用BC內建的MouseHovering函數
            const shouldShowOnHover = true; // 預設啟用懸停顯示，可以做成配置項
            if (shouldShowOnHover) {
                // 懸停範圍
                const hoverWidth = 400 * zoom;   // 懸停寬度範圍
                const hoverHeight = 100 * zoom;  // 懸停高度範圍

                if (typeof MouseHovering === 'function') {
                    if (!MouseHovering(x, y, hoverWidth, hoverHeight)) {
                        return;
                    }
                } else {
                    // 備用懸停檢測 - 也使用擴大的範圍
                    if (!isCharacterMousedOverExtended(character, x, y, hoverWidth, hoverHeight)) {
                        return;
                    }
                }
            }

            // 確保圖片已初始化
            if (!pcmBadgeImage) {
                initializePCMBadgeImage();
                return;
            }

            // 計算徽章位置
            const badgeX = x + (PCM_BADGE_CONFIG.offsetX * zoom);
            const badgeY = y + (PCM_BADGE_CONFIG.offsetY * zoom);
            const badgeSize = PCM_BADGE_CONFIG.size * zoom;

            // 繪製背景 (如果啟用)
            if (PCM_BADGE_CONFIG.showBackground) {
                MainCanvas.fillStyle = PCM_BADGE_CONFIG.backgroundColor;
                MainCanvas.beginPath();
                MainCanvas.arc(badgeX, badgeY, badgeSize/2, 0, 2 * Math.PI);
                MainCanvas.fill();

                // 繪製邊框
                if (PCM_BADGE_CONFIG.borderWidth > 0) {
                    MainCanvas.strokeStyle = PCM_BADGE_CONFIG.borderColor;
                    MainCanvas.lineWidth = PCM_BADGE_CONFIG.borderWidth * zoom;
                    MainCanvas.stroke();
                }
            }

            // 繪製PCM圖標
            if (pcmImageLoaded && pcmBadgeImage.complete) {
                const imgX = badgeX - badgeSize/2;
                const imgY = badgeY - badgeSize/2;
                MainCanvas.drawImage(pcmBadgeImage, imgX, imgY, badgeSize, badgeSize);
            } else {
                // 備用文字顯示
                MainCanvas.save();
                MainCanvas.fillStyle = "#FFFFFF";
                MainCanvas.font = `bold ${Math.max(10, badgeSize/3)}px Arial`;
                MainCanvas.textAlign = "center";
                MainCanvas.textBaseline = "middle";
                MainCanvas.fillText("PCM", badgeX, badgeY);
                MainCanvas.restore();
            }

        } catch (e) {
            console.error("[PCM] ❌ 繪製PCM徽章失敗:", e.message);
        }
    }

    // 擴展的鼠標懸停檢測（備用）
    function isCharacterMousedOverExtended(character, charX, charY, width, height) {
        try {
            if (typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined') {
                // 檢查鼠標是否在擴大的範圍內
                const halfWidth = width / 2;
                const halfHeight = height / 2;

                if (MouseX >= charX - halfWidth && MouseX <= charX + halfWidth &&
                    MouseY >= charY - halfHeight && MouseY <= charY + halfHeight) {
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.error("[PCM] ❌ 檢查擴展鼠標懸停狀態失敗:", e.message);
            return false;
        }
    }

    // 簡化的聊天室狀態檢查（保留作為備用）
    function shouldShowBadgeInChatRoom() {
        if (CurrentScreen !== "ChatRoom") {
            return false;
        }

        if (typeof ChatRoomHideIconState !== 'undefined' && ChatRoomHideIconState !== 0) {
            return false;
        }

        return true;
    }

    // 檢查角色是否被鼠標懸停
    function isCharacterMousedOver(character) {
        try {
            // 檢查全局的鼠標懸停目標
            if (typeof ChatRoomHoverObject !== 'undefined' && ChatRoomHoverObject) {
                // 如果懸停對象是角色，檢查是否為目標角色
                if (ChatRoomHoverObject.Type === "Character" &&
                    ChatRoomHoverObject.Character &&
                    ChatRoomHoverObject.Character.MemberNumber === character.MemberNumber) {
                    return true;
                }
            }

            // 備用方法：檢查MouseX/MouseY是否在角色範圍內
            if (typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined' &&
                typeof ChatRoomCharacter !== 'undefined' && Array.isArray(ChatRoomCharacter)) {

                const charIndex = ChatRoomCharacter.findIndex(c => c.MemberNumber === character.MemberNumber);
                if (charIndex >= 0) {
                    // 計算角色位置 (參考BC的角色繪製邏輯)
                    const CharX = 250 + (charIndex % 6) * 250;
                    const CharY = (charIndex < 6) ? 250 : 550;
                    const CharWidth = 200;
                    const CharHeight = 400;

                    if (MouseX >= CharX - CharWidth/2 && MouseX <= CharX + CharWidth/2 &&
                        MouseY >= CharY - CharHeight/2 && MouseY <= CharY + CharHeight/2) {
                        return true;
                    }
                }
            }

            return false;
        } catch (e) {
            console.error("[PCM] ❌ 檢查鼠標懸停狀態失敗:", e.message);
            return false;
        }
    }

    // 添加PCM標識到玩家
    function addPCMBadgeToPlayer() {
        try {
            // 等待Player物件完全載入
            const addBadge = () => {
                if (typeof Player !== 'undefined' && Player && typeof Player.OnlineSharedSettings !== 'undefined') {

                    // 檢查是否已經有PCM標識
                    if (!Player.OnlineSharedSettings.PCM) {
                        Player.OnlineSharedSettings.PCM = {
                            name: "Liko's PCM",
                            version: modversion,
                            badge: true,
                            timestamp: Date.now()
                        };

                        //console.log("✅ [PCM] PCM標識已添加到OnlineSharedSettings");

                        // 強制更新角色顯示
                        if (typeof CharacterRefresh === 'function' && CurrentScreen === 'ChatRoom') {
                            CharacterRefresh(Player, false);
                        }
                    }

                } else {
                    setTimeout(addBadge, 1000);
                }
            };

            addBadge();

        } catch (e) {
            console.error("[PCM] ❌ 添加PCM標識失敗:", e.message);
        }
    }

    // 掛鉤角色繪製函數來顯示其他玩家的PCM徽章
    function hookCharacterDrawing() {
        try {
            if (!modApi || typeof modApi.hookFunction !== 'function') {
                console.warn("[PCM] ⚠️ modApi.hookFunction 不可用，無法掛鉤角色繪製");
                return;
            }

            // 掛鉤DrawCharacter函數來繪製PCM徽章
            modApi.hookFunction('DrawCharacter', 5, (args, next) => {
                const [character, x, y, zoom, invert] = args;
                const result = next(args);

                // 檢查角色是否有PCM標識並繪製徽章
                if (character && character.OnlineSharedSettings && character.OnlineSharedSettings.PCM) {
                    drawPCMBadge(character, x, y, zoom);
                }

                return result;
            });

            // 掛鉤ChatRoom事件來檢測新玩家進入
            modApi.hookFunction('ChatRoomSyncCharacter', 5, (args, next) => {
                const result = next(args);
                const [character] = args;

                //if (character && character.OnlineSharedSettings && character.OnlineSharedSettings.PCM) console.log(`[PCM] 🎖️ 檢測到 ${character.Name} 使用PCM插件`);

                return result;
            });

            //console.log("✅ [PCM] 角色繪製掛鉤設置完成");

        } catch (e) {
            console.error("[PCM] ❌ 設置角色繪製掛鉤失敗:", e.message);
        }
    }

    // 註冊PCM徽章
    function registerPCMBadge() {
        try {
            // 等待modApi完全初始化
            const waitForModApi = () => {
                if (modApi && typeof modApi.hookFunction === 'function') {
                    //console.log("[PCM] 🎖️ 開始註冊PCM徽章");

                    // 初始化徽章圖片
                    initializePCMBadgeImage();

                    // 添加PCM標識到玩家
                    addPCMBadgeToPlayer();

                    // 掛鉤角色載入函數來添加徽章
                    hookCharacterDrawing();

                } else {
                    setTimeout(waitForModApi, 500);
                }
            };

            waitForModApi();

        } catch (e) {
            console.error("[PCM] ❌ 註冊PCM徽章失敗:", e.message);
            // 即使徽章註冊失敗，也嘗試備用方法
            setTimeout(() => {
                addPCMBadgeToPlayer();
            }, 2000);
        }
    }

    // 發送載入完成信息的函數
    function sendLoadedMessage() {
        const waitForChatRoom = () => {
            return new Promise((resolve) => {
                const checkChatRoom = () => {
                    if (CurrentScreen === "ChatRoom") {
                        resolve(true);
                    } else {
                        setTimeout(checkChatRoom, 1000);
                    }
                };
                checkChatRoom();

                // 60秒超時
                setTimeout(() => resolve(false), 60000);
            });
        };

        waitForChatRoom().then((success) => {
            if (success) {
                try {
                    // 發送簡短的聊天室提醒信息
                    if (typeof ChatRoomSendLocal === 'function') {
                        ChatRoomSendLocal(getMessage('shortLoaded'), 60000);
                    }

                    // 使用通知顯示詳細信息
                    showNotification("🐈‍⬛", "PCM", getMessage('loaded'));

                    // 可選：也在控制台輸出
                    //console.log(`[PCM] ${getMessage('loaded')}`);
                } catch (e) {
                    console.log(`[PCM] ${getMessage('loaded')}`);
                }
            }
        });
    }

    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's PCM",
                fullName: 'Liko - Plugin Collection Manager',
                version: modversion,
                repository: 'Liko的插件管理器 | Plugin collection manager',
            });

            // 註冊PCM徽章
            registerPCMBadge();

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
            en_name: "Liko's Tool Kit",
            description: "有許多小功能合集的工具包，但也有點不穩定",
            en_description: "A collection of small utility functions, but somewhat unstable",
            additionalInfo: "詳細使用說明請輸入/LT或/LT help查詢",
            en_additionalInfo: "For detailed usage instructions, please enter /LT or /LT help.",
            icon: "🧰",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Tool.main.user.js",
            enabled: pluginSettings["Liko_Tool"] ?? false,
            priority: 3
        },
        {
            id: "Liko_CPB",
            name: "Liko的自定義個人資料頁面背景",
            en_name: "Liko's Custom Profile Background",
            description: "自定義個人資料頁面背景並分享給他人",
            en_description: "Customize profile page background and share it with others.",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🪪",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20CPB.main.user.js",
            enabled: pluginSettings["Liko_CPB"] ?? false,
            priority: 3
        },
        {
            id: "Liko_Image_Uploader",
            name: "Liko的圖片上傳器",
            en_name: "Liko's Image Uploader",
            description: "拖曳上傳圖片並分享到聊天室",
            en_description: "Drag and drop image upload and share to chatroom",
            additionalInfo: "圖片上傳失敗時，可以使用/IMG或/IMG HELP查閱說明",
            en_additionalInfo: "If the image fails to upload, you can use /IMG or /IMG HELP to view the instructions.",
            icon: "🖼️",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Image%20Uploader.main.user.js",
            enabled: pluginSettings["Liko_Image_Uploader"] ?? true,
            priority: 3
        },
        {
            id: "Liko_CHE",
            name: "Liko的聊天室書記官",
            en_name: "Liko's Chat History Exporter",
            description: "聊天室信息轉HTML，並且提供最多7天的信息救援(需要手動啟用緩存功能)",
            en_description: "Convert chat history to HTML and provides message recovery for up to 7 days.(The caching feature requires manual activation.)",
            additionalInfo: "包含完整的聊天記錄、時間戳和角色信息，可以搭配Neocities等網站上傳分享",
            en_additionalInfo: "Includes complete chat logs, timestamps and character info, compatible with sites like Neocities for sharing",
            icon: "📋",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20CHE.main.user.js",
            enabled: pluginSettings["Liko_CHE"] ?? true,
            priority: 3
        },
        {
            id: "Liko_CDB",
            name: "Liko的自訂更衣室背景",
            en_name: "Liko's Custom Dressing Background",
            description: "更衣室背景替換，並提供網格對焦",
            en_description: "Replace wardrobe background with grid focus assistance",
            additionalInfo: "現在多了替換姿勢的功能",
            en_additionalInfo: "Now there is a function to change posture",
            icon: "👗",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20CDB.main.user.js",
            enabled: pluginSettings["Liko_CDB"] ?? true,
            priority: 3
        },
        {
            id: "Liko_Prank",
            name: "Liko對朋友的惡作劇",
            en_name: "Liko's Friend Prank",
            description: "內褲大盜鬧得BC社群人心惶惶！",
            en_description: "The underwear thief causing panic in the BC community!",
            additionalInfo: "注意：這是個惡作劇插件，請謹慎使用！指令 /偷取, /溶解, /传送",
            en_additionalInfo: "Warning: This is a prank plugin, use with caution! Command /Steal, /dissolve, /Teleport",
            icon: "🪄",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Prank.main.user.js",
            enabled: pluginSettings["Liko_Prank"] ?? false,
            priority: 5
        },
        {
            id: "Liko_NOI",
            name: "Liko的邀請通知器",
            en_name: "Liko's Notification of Invites",
            description: "發出好友、白單、黑單的信息!",
            en_description: "Customize the notification message when sending a friend, whitelist, or blacklist request.",
            additionalInfo: "可以使用/NOI或/NOI HELP查閱說明",
            en_additionalInfo: "For detailed usage instructions, please enter /NOI or /NOI help.",
            icon: "📧",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20NOI.main.user.js",
            enabled: pluginSettings["Liko_NOI"] ?? true,
            priority: 5
        },
        {
            id: "Liko_Bondage_renew",
            name: "Liko的捆綁刷新",
            en_name: "Liko's Bondage Refresh",
            description: "針對R120捆綁刷新不夠快的應急措施",
            en_description: "Emergency fix for slow bondage refresh in R120",
            additionalInfo: "修復版本更新後可能不再需要此插件",
            en_additionalInfo: "May no longer be needed after version updates",
            icon: "♻️",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Bondage%20renew.main.user.js",
            enabled: pluginSettings["Liko_Bondage_renew"] ?? false,
            priority: 10
        },
        {
            id: "Liko_Release_Maid",
            name: "Liko的解綁女僕",
            en_name: "Liko's Release Maid",
            description: "自動解綁女僕，不過有點天然，會在意外時觸發!",
            en_description: "Auto-release maid, but a bit naive and may trigger unexpectedly!",
            additionalInfo: "請評估自己需求，避免降低遊戲樂趣",
            en_additionalInfo: "Please consider your own needs to avoid diminishing the enjoyment of the game.",
            icon: "🧹",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Release%20Maid.main.user.js",
            enabled: pluginSettings["Liko_Release_Maid"] ?? false,
            priority: 10
        },
        {
            id: "Liko_Chat_TtoB",
            name: "Liko的對話變按鈕",
            en_name: "Liko's Chat Text to Button",
            description: "聊天室信息轉按鈕，現在還多了傳送門功能!",
            en_description: "Convert chat messages to buttons, now with portal feature!",
            additionalInfo: "使用/指令、!!說話、#房名#都會變成可以點擊的按鈕，#房名#提供傳送功能",
            en_additionalInfo: "Commands starting with /, !! for speech, and #RoomName# will become clickable buttons. The #RoomName# button provides a teleport function.",
            icon: "💬",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Chat%20TtoB.main.user.js",
            enabled: pluginSettings["Liko_Chat_TtoB"] ?? true,
            priority: 5
        },
        {
            id: "Liko_CDT",
            name: "Liko的座標繪製工具",
            en_name: "Liko's Coordinate Drawing Tool",
            description: "BC的介面UI定位工具，有開發需求的可以使用!",
            en_description: "BC interface UI positioning tool for developers!",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🖌️",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20CDT.main.user.js",
            enabled: pluginSettings["Liko_CDT"] ?? false,
            priority: 10
        },
        {
            id: "ECHO_cloth",
            name: "ECHO的服裝拓展",
            en_name: "ECHO's Expansion on cloth options",
            description: "ECHO的服裝拓展",
            en_description: "ECHO's Expansion on cloth options",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🥐",
            url: "https://SugarChain-Studio.github.io/echo-clothing-ext/bc-cloth.js",
            enabled: pluginSettings["ECHO_cloth"] ?? false,
            priority: 1
        },
        {
            id: "ECHO_activity",
            name: "ECHO的動作拓展",
            en_name: "ECHO's Expansion on activity options",
            description: "ECHO的動作拓展",
            en_description: "ECHO's Expansion on activity options",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🥐",
            url: "https://SugarChain-Studio.github.io/echo-activity-ext/bc-activity.js",
            enabled: pluginSettings["ECHO_activity"] ?? false,
            priority: 1
        },
        {
            id: "XSActivity",
            name: "小酥的動作拓展",
            en_name: "Liko's Coordinate Drawing Tool",
            description: "小酥的動作拓展",
            en_description: "XS's Expansion on activity options",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🍪",
            url: "https://iceriny.github.io/XiaoSuActivity/main/XSActivity.js",
            enabled: pluginSettings["XSActivity"] ?? false,
            priority: 2
        },
        {
            id: "Liko_ACV",
            name: "Liko的自動創建影片",
            en_name: "Liko's Automatically create video.",
            description: "Liko的自動創建影片",
            en_description: "Liko's Automatically create video.",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "🎬",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20ACV.main.user.js",
            enabled: pluginSettings["Liko_ACV"] ?? true,
            priority: 5
        },
        {
            id: "Liko - Region switch",
            name: "快速切換混合&女性區",
            en_name: "Region switch",
            description: "快速切換混合&女性區",
            en_description: "Region switch",
            additionalInfo: "",
            en_additionalInfo: "",
            icon: "⚧️",
            url: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Region%20switch.main.user.js",
            enabled: pluginSettings["Liko - Region switch"] ?? true,
            priority: 10
        }
    ];

    // 根據優先度排序插件
    subPlugins.sort((a, b) => (a.priority || 5) - (b.priority || 5));

    // --- 載入插件（簡化版，移除時間戳） ---
    let loadedPlugins = new Set();
    let isLoadingPlugins = false;
    let hasStartedPluginLoading = false;

    function loadSubPlugin(plugin) {
        if (!plugin.enabled || loadedPlugins.has(plugin.id)) {
            //console.log(`⚪ [PCM - SubPlugin] ${plugin.name} 已關閉或已載入`);
            return Promise.resolve();
        }

        // 直接使用 URL，不添加時間戳
        return fetch(plugin.url)
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
                console.log(`✅ [PCM - SubPlugin] ${plugin.name} 載入成功`);
            } catch (e) {
                console.error(`❌ [PCM - SubPlugin] 載入失敗: ${plugin.name}`, e);
                showNotification("❌", `${plugin.name} 載入失敗`, "請檢查網絡或插件URL");
                throw e;
            }
        })
            .catch(err => {
            console.error(`❌ [PCM - SubPlugin] 無法獲取 ${plugin.name} 的腳本`, err);
            showNotification("❌", `${plugin.name} 載入失敗`, "請檢查網絡或插件URL");
            throw err;
        });
    }

    // 等待Player載入後再開始背景載入插件
    async function waitForPlayerAndLoadPlugins() {
        if (hasStartedPluginLoading) return;

        //console.log("🔍 [PCM] 檢查 Player 是否已載入...");

        const maxWaitTime = 15*60*1000;
        const checkInterval = 1000;
        const logInterval = 5000;
        let waitTime = 0;
        let lastLogTime = 0;

        while (!isPlayerLoaded() && waitTime < maxWaitTime) {
            if (waitTime === 0 || waitTime - lastLogTime >= logInterval) {
                console.log(`⏳ [PCM] 等待 Player 載入... (${waitTime/1000}s)`);
                lastLogTime = waitTime;
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
        }

        if (isPlayerLoaded()) {
            //console.log("✅ [PCM] Player 已載入，開始載入插件");
            console.log(`[PCM] 🔢 插件載入順序:`, subPlugins.map(p => `${p.priority}:${getPluginName(p)}`));
            hasStartedPluginLoading = true;
            await loadSubPluginsInBackground();
        } else {
            console.warn("⚠️ [PCM] 等待 Player 載入超時，仍將嘗試載入插件");
            hasStartedPluginLoading = true;
            await loadSubPluginsInBackground();
        }
    }

    // 背景自動載入所有啟用的插件
    async function loadSubPluginsInBackground() {
        if (isLoadingPlugins) return;
        isLoadingPlugins = true;

        //console.log("🔄 [PCM] 開始背景載入啟用的插件...");

        try {
            const enabledPlugins = subPlugins.filter(plugin => plugin.enabled);
            const batchSize = 3;
            let loadedCount = 0;
            let successCount = 0;

            if (enabledPlugins.length === 0) {
                //console.log("ℹ️ [PCM] 沒有啟用的插件需要載入");
                return;
            }

            for (let i = 0; i < enabledPlugins.length; i += batchSize) {
                const batch = enabledPlugins.slice(i, i + batchSize);

                console.log(`📦 [PCM] 正在載入批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(enabledPlugins.length/batchSize)}: ${batch.map(p => p.name).join(', ')}`);

                const promises = batch.map(plugin =>
                                           loadSubPlugin(plugin).catch(error => {
                    console.warn(`⚠️ [PCM] 插件 ${plugin.name} 載入失敗:`, error.message);
                    return { plugin, error };
                })
                                          );

                try {
                    const results = await Promise.allSettled(promises);

                    results.forEach((result, index) => {
                        const plugin = batch[index];
                        if (result.status === 'fulfilled' && !result.value?.error) {
                            successCount++;
                            //console.log(`✅ [PCM] ${plugin.name} 載入成功`);
                        } else {
                            console.error(`❌ [PCM] ${plugin.name} 載入失敗:`, result.reason || result.value?.error);
                        }
                    });

                    loadedCount += batch.length;
                    console.log(`📈 [PCM] 進度: ${loadedCount}/${enabledPlugins.length} (成功: ${successCount})`);
                } catch (error) {
                    console.warn(`⚠️ [PCM] 批次載入時發生錯誤:`, error);
                }

                if (i + batchSize < enabledPlugins.length) {
                    console.log(`⏳ [PCM] 等待 800ms 後載入下一批次...`);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }

            const failedCount = enabledPlugins.length - successCount;
            if (failedCount > 0) {
                console.warn(`⚠️ [PCM] 背景載入完成！成功: ${successCount}, 失敗: ${failedCount}`);
                showNotification("⚠️", getMessage('pluginLoadComplete'), `${getMessage('successLoaded')} ${successCount} ${getMessage('plugins')}，${failedCount} ${getMessage('failed')}`);
            } else {
                console.log("✅ [PCM] 背景插件載入完成！所有插件都載入成功");
                if (enabledPlugins.length > 0) {
                    showNotification("✅", getMessage('pluginLoadComplete'), `${getMessage('successLoaded')} ${successCount} ${getMessage('plugins')}`);
                }
            }
        } catch (error) {
            console.error("❌ [PCM] 背景載入插件時發生嚴重錯誤:", error);
            showNotification("❌", "載入錯誤", "背景載入插件時發生嚴重錯誤");
        } finally {
            isLoadingPlugins = false;
        }
    }

    // 獲取當前查看的角色
    function getCurrentViewingCharacter() {
        const now = Date.now();

        // 快取檢查，減少重複計算
        if (now - lastCharacterCheck < CHARACTER_CACHE_TIME && cachedViewingCharacter !== null) {
            return cachedViewingCharacter;
        }

        try {
            let character = null;

            // 方法1: 使用 InformationSheetCharacter (最直接的方法)
            if (typeof InformationSheetCharacter !== 'undefined' && InformationSheetCharacter) {
                character = InformationSheetCharacter;
            }
            // 方法2: 檢查 InformationSheetSelection 是否就是角色對象
            else if (typeof InformationSheetSelection !== 'undefined' && InformationSheetSelection !== null && typeof InformationSheetSelection === 'object') {
                // 如果 InformationSheetSelection 本身就是一個角色對象
                if (InformationSheetSelection.Name && (InformationSheetSelection.MemberNumber || InformationSheetSelection.ID)) {
                    character = InformationSheetSelection;
                }
                // 如果有 ID 屬性，嘗試在 ChatRoomCharacter 中查找
                else if (InformationSheetSelection.ID && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.ID === InformationSheetSelection.ID);
                }
                // 如果有 MemberNumber 屬性，嘗試在 ChatRoomCharacter 中查找
                else if (InformationSheetSelection.MemberNumber && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection.MemberNumber);
                }
            }
            // 方法3: 如果 InformationSheetSelection 是數字，當作 MemberNumber 處理
            else if (typeof InformationSheetSelection !== 'undefined' && typeof InformationSheetSelection === 'number') {
                if (CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection);
                }
            }

            // 默認返回 Player
            if (!character) {
                character = Player;
            }

            // 更新快取
            cachedViewingCharacter = character;
            lastCharacterCheck = now;

            return character;
        } catch (e) {
            console.error("[PCM] 獲取當前查看角色失敗:", e.message);
            return Player;
        }
    }

    // 檢查是否為個人資料頁面
    function isProfilePage() {
        const now = Date.now();

        // 快取屏幕檢查結果
        if (now - lastScreenCheckTime < SCREEN_CACHE_TIME && lastScreenCheck !== null) {
            return lastScreenCheck;
        }

        const result = CurrentScreen === "InformationSheet" &&
              window.bcx?.inBcxSubscreen() !== true &&
              window.LITTLISH_CLUB?.inModSubscreen() !== true &&
              window.MPA?.menuLoaded !== true &&
              window.LSCG_REMOTE_WINDOW_OPEN !== true;

        lastScreenCheck = result;
        lastScreenCheckTime = now;
        return result;
    }

    // --- UI显示检查函数 ---
    function shouldShowUI() {
        // 首先檢查基本條件
        const isLoginPage = window.location.href.includes('/login') ||
              window.location.href.includes('/Login') ||
              window.location.href.includes('Login.html');

        // 在登入頁面總是顯示
        if (isLoginPage) {
            return true;
        }

        // 如果 Player 未載入，顯示UI（登入前狀態）
        if (typeof Player === 'undefined' || !Player.Name) {
            return true;
        }

        // 檢查當前屏幕
        if (typeof CurrentScreen !== 'undefined') {
            // 在個人資料頁面時，只有查看自己的才顯示
            if (CurrentScreen === 'InformationSheet') {
                if (isProfilePage()) {
                    const viewingCharacter = getCurrentViewingCharacter();
                    // 只有在查看自己的 profile 時才顯示按鈕
                    return viewingCharacter && viewingCharacter.MemberNumber === Player.MemberNumber;
                }
                return false;
            }

            // 其他允許的頁面
            const allowedScreens = [
                'Preference',      // 設定頁面
                'Login',           // 登入頁面
                'Character',       // 角色創建頁面
                'MainHall',        // 主大廳（首頁）
                'Introduction'     // 介紹頁面（首頁的另一種）
            ];

            const isAllowedScreen = allowedScreens.includes(CurrentScreen);

            if (isAllowedScreen) {
                return true;
            }
        }

        return false;
    }

    function isPlayerLoaded() {return typeof Player !== 'undefined'}

    function loadCustomIcons() {
        // 簡化的圖標載入 - 僅從設定中載入自訂圖標URL（如果有）
        subPlugins.forEach(plugin => {
            if (pluginSettings[`${plugin.id}_customIcon`]) {
                plugin.customIcon = pluginSettings[`${plugin.id}_customIcon`];
            }
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
            flex: 1 1 auto;
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 400px;
            min-height: 300px;
            scrollbar-width: thin;
            scrollbar-color: rgba(127, 83, 205, 0.8) rgba(255, 255, 255, 0.1);
            -webkit-overflow-scrolling: touch;
        }

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

        .bc-plugin-footer {
            background: rgba(255, 255, 255, 0.02);
            padding: 12px 20px;
            text-align: center;
            color: #a0a9c0;
            font-size: 11px;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
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
        }

        .bc-plugin-icon img {
            width: 24px;
            height: 24px;
            border-radius: 4px;
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

        @media (max-width: 480px) {
            .bc-plugin-panel {
                width: calc(100vw - 40px);
                right: 20px;
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

    let currentUIState = null;

    function createManagerUI() {
        const shouldShow = shouldShowUI();
        const existingBtn = document.getElementById("bc-plugin-floating-btn");
        const existingPanel = document.getElementById("bc-plugin-panel");

        if (currentUIState === shouldShow) {
            return;
        }

        currentUIState = shouldShow;

        if (!shouldShow) {
            if (existingBtn) existingBtn.classList.add('hidden');
            if (existingPanel) {
                existingPanel.classList.add('hidden');
                existingPanel.classList.remove('show');
            }
            return;
        }

        if (shouldShow && existingBtn && existingPanel) {
            existingBtn.classList.remove('hidden');
            existingPanel.classList.remove('hidden');
            return;
        }

        if (shouldShow && (!existingBtn || !existingPanel)) {
            if (existingBtn) existingBtn.remove();
            if (existingPanel) existingPanel.remove();

            injectStyles();

            const floatingBtn = document.createElement("button");
            floatingBtn.id = "bc-plugin-floating-btn";
            floatingBtn.className = "bc-plugin-floating-btn";
            floatingBtn.innerHTML = `<img src="https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png" alt="🐱" />`;
            floatingBtn.title = "插件管理器";
            document.body.appendChild(floatingBtn);

            const panel = document.createElement("div");
            panel.id = "bc-plugin-panel";
            panel.className = "bc-plugin-panel";

            const header = document.createElement("div");
            header.className = "bc-plugin-header";
            header.innerHTML = `<h3 class="bc-plugin-title">${getMessage('welcomeTitle')}</h3>`;

            const content = document.createElement("div");
            content.className = "bc-plugin-content";

            subPlugins.forEach(plugin => {
                const item = document.createElement("div");
                item.className = `bc-plugin-item ${plugin.enabled ? 'enabled' : ''}`;

                const iconDisplay = plugin.customIcon ?
                      `<img src="${plugin.customIcon}" alt="${getPluginName(plugin)} icon" />` :
                plugin.icon;

                item.innerHTML = `
                <div class="bc-plugin-item-header">
                    <div class="bc-plugin-icon">
                        ${iconDisplay}
                    </div>
                    <div class="bc-plugin-info">
                        <h4 class="bc-plugin-name">${getPluginName(plugin)}</h4>
                        <p class="bc-plugin-desc">${getPluginDescription(plugin)}</p>
                    </div>
                    <button class="bc-plugin-toggle ${plugin.enabled ? 'active' : ''}"
                            data-plugin="${plugin.id}"
                            aria-label="${getPluginName(plugin)} 啟用開關">
                    </button>
                </div>
            `;

                content.appendChild(item);
            });

            const footer = document.createElement("div");
            footer.className = "bc-plugin-footer";
            footer.innerHTML = `❖ Liko Plugin Manager v${modversion} ❖ by Likolisu`;

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
            });

            content.addEventListener("click", (e) => {
                const iconElement = e.target.closest(".bc-plugin-icon");
                if (iconElement) {
                    e.stopPropagation();
                    const selector = iconElement.querySelector(".bc-plugin-icon-selector");
                    document.querySelectorAll(".bc-plugin-icon-selector.show").forEach(s => {
                        if (s !== selector) s.classList.remove("show");
                    });
                    selector.classList.toggle("show");
                }

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
                            `${plugin.name} ${plugin.enabled ? getMessage('pluginEnabled') : getMessage('pluginDisabled')}`,
                            plugin.enabled ? getMessage('willTakeEffect') : getMessage('willNotStart')
                        );

                        if (plugin.enabled && !loadedPlugins.has(plugin.id) && isPlayerLoaded()) {
                            loadSubPlugin(plugin);
                        }
                    }
                }
            });

            document.addEventListener("click", (e) => {
                if (!panel.contains(e.target) && !floatingBtn.contains(e.target) && isOpen) {
                    isOpen = false;
                    panel.classList.remove("show");
                }
            });
        }
    }

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

    // 添加語言變化監聽
    let lastDetectedLanguage = null;

    function checkLanguageChange() {
        const currentLang = detectLanguage();
        if (lastDetectedLanguage !== null && lastDetectedLanguage !== currentLang) {
            console.log("[PCM] 檢測到語言變化，重新創建UI");
            // 強制重新創建UI
            const existingBtn = document.getElementById("bc-plugin-floating-btn");
            const existingPanel = document.getElementById("bc-plugin-panel");
            if (existingBtn) existingBtn.remove();
            if (existingPanel) existingPanel.remove();
            currentUIState = null; // 重置UI狀態
            createManagerUI();
        }
        lastDetectedLanguage = currentLang;
    }

    function monitorPageChanges() {
        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                checkLanguageChange(); // 檢查語言變化
                createManagerUI();

                if (isPlayerLoaded() && !hasStartedPluginLoading) {
                    console.log("🎯 [PCM] Player已載入，觸發插件載入");
                    waitForPlayerAndLoadPlugins();
                }
            }, 300);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        let lastUrl = window.location.href;
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    checkLanguageChange(); // 檢查語言變化
                    createManagerUI();

                    if (isPlayerLoaded() && !hasStartedPluginLoading) {
                        //console.log("🎯 [PCM] URL變化後Player已載入，觸發插件載入");
                        waitForPlayerAndLoadPlugins();
                    }
                }, 1000);
            }
        }, 1000);

        // 定期檢查語言變化（例如用戶在遊戲中切換語言）
        setInterval(() => {
            checkLanguageChange();
        }, 2000);

        createManagerUI();
    }

    function handle_PCM_Command(text) {
        if (typeof text !== "string") text = String(text || "");
        const args = text.trim().split(/\s+/).filter(x => x !== "");
        const sub = (args[0] || "").toLowerCase();
        const isZh = detectLanguage();

        if (!sub || sub === "help") {
            const helpText = isZh ? generateChineseHelp() : generateEnglishHelp();

            if (typeof ChatRoomSendLocal === 'function') {
                ChatRoomSendLocal(helpText, 60000);
            } else {
                //console.log(`[PCM] ${helpText}`);
            }
            return;
        } else if (sub === "list") {
            const listText = isZh ? generateChinesePluginList() : generateEnglishPluginList();

            if (typeof ChatRoomSendLocal === 'function') {
                ChatRoomSendLocal(listText, 60000);
            } else {
                //console.log(`[PCM] ${listText}`);
            }
            return;
        } else {
            const errorText = isZh ?
                  "請輸入 /pcm help 查看說明或 /pcm list 查看插件列表" :
            "Please enter /pcm help for instructions or /pcm list to see plugin list";

            if (typeof ChatRoomSendLocal === 'function') {
                ChatRoomSendLocal(errorText);
            } else {
                //console.log(`[PCM] ${errorText}`);
            }
            return;
        }
    }

    function generateChineseHelp() {
        return `📋 Liko 插件管理器 說明書

🎮 使用方法：
• 點擊右上角的浮動按鈕開啟管理面板
• 切換開關來啟用/停用插件
• 點擊插件圖標可更換顯示圖標

📝 可用指令：
/pcm help - 顯示此說明書
/pcm list - 查看所有可用插件列表

💡 小提示：
插件啟用後會自動載入，或在下次刷新頁面時生效。
建議根據需要選擇性啟用插件以獲得最佳體驗。

❤️ 感謝使用 Liko 插件管理器！`;
    }

    function generateEnglishHelp() {
        return `📋 Liko Plugin Collection Manager Manual

🎮 How to Use:
• Click the floating button in the top right to open management panel
• Toggle switches to enable/disable plugins
• Click plugin icons to change display icons

📝 Available Commands:
/pcm help - Show this manual
/pcm list - View all available plugin list

💡 Tips:
Plugins will auto-load after enabling, or take effect on next page refresh.
Recommend selectively enabling plugins for the best experience.

❤️ Thank you for using Liko Plugin Collection Manager!`;
    }

    function generateChinesePluginList() {
        let listText = "🔌 可用插件列表：\n\n";

        subPlugins.forEach((plugin, index) => {
            const status = plugin.enabled ? "✅" : "⭕";
            const pluginName = getPluginName(plugin);
            const pluginDesc = getPluginDescription(plugin);
            const additionalInfo = getPluginAdditionalInfo(plugin);

            listText += `${status}${plugin.icon} ${pluginName}\n`;
            listText += `📄 ${pluginDesc}\n`;

            // 只有當補充信息存在且不為空時才顯示
            if (additionalInfo && additionalInfo.trim() !== "") {
                listText += ` ✦ ${additionalInfo}\n`;
            }

            listText += "\n";
        });

        listText += "💡 在管理面板中切換開關來啟用/停用插件";
        return listText;
    }

    function generateEnglishPluginList() {
        let listText = "🔌 Available Plugin List:\n\n";

        subPlugins.forEach((plugin, index) => {
            const status = plugin.enabled ? "✅" : "⭕";
            const pluginName = getPluginName(plugin);
            const pluginDesc = getPluginDescription(plugin);
            const additionalInfo = getPluginAdditionalInfo(plugin);

            listText += `${status}${plugin.icon} ${pluginName}\n`;
            listText += `📄 ${pluginDesc}\n`;

            // 只有當補充信息存在且不為空時才顯示
            if (additionalInfo && additionalInfo.trim() !== "") {
                listText += ` ✦ ${additionalInfo}\n`;
            }

            listText += "\n";
        });

        listText += "💡 Toggle switches in the management panel to enable/disable plugins";
        return listText;
    }
    function tryRegisterCommand() {
        try {
            if (typeof CommandCombine === "function") {
                CommandCombine([{
                    Tag: "pcm",
                    Description: "Liko's Plugin Collection Manager Illustrate",
                    Action: function(text) {
                        handle_PCM_Command(text);
                    }
                }]);
                return true;
            }
        } catch (e) {
            console.warn("CommandCombine 註冊 /pcm 失敗：", e.message);
        }
        return false;
    }
    function ChatRoomSendLocal(msg, sec = 0) {
        try {
            if (CurrentScreen !== "ChatRoom") return;
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#885CB0">[PCM] ${msg}</font>`,
                Timeout: sec
            });
        } catch (e) {
            try {
                ServerSend("ChatRoomChat", { Content: `[PCM] ${msg}`, Type: "LocalMessage", Time: sec });
            } catch (e2) {
                console.error("無法發送本地訊息:", e2);
            }
        }
    }

    // 檢查並確保PCM標識存在
    function ensurePCMBadgeExists() {
        try {
            if (typeof Player !== 'undefined' && Player && Player.OnlineSharedSettings) {
                if (!Player.OnlineSharedSettings.PCM) {
                    Player.OnlineSharedSettings.PCM = {
                        name: "Liko's PCM",
                        version: modversion,
                        badge: true,
                        timestamp: Date.now()
                    };
                    //console.log("[PCM] 🔄 重新添加PCM標識到OnlineSharedSettings");
                }
            }
        } catch (e) {
            console.error("[PCM] ❌ 檢查PCM標識時出錯:", e.message);
        }
    }

    async function initialize() {
        console.log("[PCM] 開始初始化...");

        // 初始化語言檢測
        lastDetectedLanguage = detectLanguage();

        // 載入自定義圖標設定
        loadCustomIcons();

        // 設置頁面監控
        monitorPageChanges();

        // 註冊命令
        tryRegisterCommand();

        // 在進入聊天室時檢查PCM標識
        const originalChatRoomJoin = setInterval(() => {
            if (typeof Player !== 'undefined' && Player && CurrentScreen === 'ChatRoom') {
                ensurePCMBadgeExists();
                clearInterval(originalChatRoomJoin);
            }
        }, 1000);

        // 延遲啟動插件載入檢查
        setTimeout(() => {
            //console.log("🔍 [PCM] 5秒後開始檢查Player狀態");
            waitForPlayerAndLoadPlugins();
        }, 5000);

        // 延遲檢查語言設置，確保遊戲語言已載入
        setTimeout(() => {
            //console.log("[PCM] 檢查遊戲語言設置並更新UI");
            checkLanguageChange();
        }, 10000);

        //console.log("[PCM] 初始化完成！插件將在Player載入後自動載入");
        //console.log("[PCM] 可使用 /pcm 或 /pcm help 指令");
    }

    // 啟動初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await initialize();
                sendLoadedMessage();
            } catch (e) {
                console.error("[PCM] 初始化過程中發生錯誤:", e);
            }
        });
    } else {
        initialize().then(() => {
            sendLoadedMessage();
        }).catch((e) => {
            console.error("[PCM] 初始化過程中發生錯誤:", e);
        });
    }
    console.log("[PCM] 腳本載入完成");
})();
