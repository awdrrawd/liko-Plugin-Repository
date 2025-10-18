// ==UserScript==
// @name         Liko - CDB
// @name:zh      Liko的自訂更衣室背景
// @namespace    https://likolisu.dev/
// @version      1.4.1
// @description  自訂更衣室背景 | Custom Dressing Background
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ================================
    // 常量配置
    // ================================
    // 图标路径辅助工具
    const IconPathHelper = {
        _cachedBasePath: null,
        _cachedIconsPath: null,

        getBasePath: function() {
            if (this._cachedBasePath) return this._cachedBasePath;

            let href = window.location.href;

            // 确保结尾有斜线
            if (!href.endsWith('/')) {
                href = href.substring(0, href.lastIndexOf('/') + 1);
            }

            this._cachedBasePath = href;
            safeLog("基础路径: " + href);
            return href;
        },

        getIconsPath: function() {
            if (this._cachedIconsPath) return this._cachedIconsPath;

            this._cachedIconsPath = this.getBasePath() + 'Icons/';
            safeLog("图标路径: " + this._cachedIconsPath);
            return this._cachedIconsPath;
        },

        clearCache: function() {
            this._cachedBasePath = null;
            this._cachedIconsPath = null;
        }
    };

    const CONFIG = {
        VERSION: "1.4.1",
        DEFAULT_BG_URL: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg",
        BUTTON_X: 600,
        BUTTON_Y: 25,
        BUTTON_SIZE: 90,
        POSE_BUTTON_X: 30,
        POSE_BUTTON_Y: 25,
        POSE_BUTTON_SIZE: 90,
        TIMEOUTS: {
            BC_MOD_SDK: 30000,
            GAME_LOAD: 30000
        },
        Z_INDEX: {
            UI: 10000,
            TRIGGER_BUTTON: 9999
        },
        PRESET_COLORS: [
            '#000000', '#404040', '#C0C0C0', '#FFFFFF', '#8B4513', '#FF0000',
            '#FF4500', '#FFA500', '#FFFF00', '#ADFF2F', '#00FF00', '#DDA0DD',
            '#00FFFF', '#0087FF', '#0000FF', '#8A2BE2', '#FF00FF', '#F5DEB3'
        ],
        GRID_SPACING: {
            'grid10': 10,
            'grid25': 25,
            'grid50': 50
        },
        // BC正確的姿勢列表
        POSES: [
            { name: "BaseUpper", display: "放鬆手臂" },
            { name: "Yoked", display: "高舉雙手" },
            { name: "OverTheHead", display: "雙手過頭" },
            { name: "BackBoxTie", display: "反綁雙手" },
            { name: "BackElbowTouch", display: "肘部相觸" },
            { name: "BackCuffs", display: "右手反抓左手" },
            { name: "BaseLower", display: "站立" },
            { name: "LegsClosed", display: "併腿站立" },
            { name: "Kneel", display: "跪下" },
            { name: "KneelingSpread", display: "跪姿分腿" },
            { name: "AllFours", display: "趴跪" }
        ],

        getIconsPath: function() {
            return IconPathHelper.getIconsPath();
        },

        // 获取姿势图标 URL
        getPoseIconURL: function(poseName) {
            return this.getIconsPath() + 'Poses/' + poseName + '.png';
        },

        // 获取普通图标 URL
        getIconURL: function(iconName) {
            return this.getIconsPath() + iconName + '.png';
        }
    };
    // ================================
    // 全局變量
    // ================================
    let modApi = null;
    let customBG = null;
    let originalDrawImage = null;
    let colorPickerUI = null;
    let isInitialized = false;

    // 狀態管理
    const state = {
        currentMode: 'disabled',
        bgColor: '#87CEEB',
        customBgUrl: CONFIG.DEFAULT_BG_URL,
        gridMode: 'disabled',
        gridColor: '#FFFFFF',
        gridOpacity: 0.5,
        uiVisible: false,
        // 姿勢相關狀態
        currentPoseIndex: 0,
        lastPoseChangeTime: 0
    };

    // 姿勢相關狀態
    const poseState = {
        expanded: false,  // 是否展開姿勢按鈕
        enabled: true     // 是否啟用姿勢功能
    };
    // 放大預覽相關狀態
    const zoomPreviewState = {
        active: false,
        zoom: 1.5,
        offsetX: 0,
        offsetY: 0,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0,
        windowX: 0,  // 百分比定位不需要具体像素值
        windowY: 0,
        isDraggingWindow: false
    };
    // 性能監控
    const performance = {
        drawImageCalls: 0,
        drawImageErrors: 0,
        lastDrawTime: 0,
        lastResetTime: Date.now(),
        isInDressingRoom: false,
        drawCallQueue: [],
        isDrawing: false
    };

    // 資源管理
    const resources = {
        blobUrls: new Set(),
        eventListeners: new Map(),
        styleSheets: new Set(),
        intervalIds: new Set(),
        timeoutIds: new Set()
    };

    // ================================
    // 工具函數
    // ================================
    function safeLog(message) {
        try {
            console.log('[CDB] ' + message);
        } catch (e) {
            // 靜默失敗
        }
    }

    function safeError(message, error) {
        try {
            console.error('[CDB] ' + message, error);
        } catch (e) {
            // 靜默失敗
        }
    }

    function safeCallWithFallback(fn, fallback, context) {
        try {
            return fn.call(context);
        } catch (e) {
            safeError("函數調用失敗，使用備用方案:", e);
            if (fallback) {
                try {
                    return fallback.call(context);
                } catch (fallbackError) {
                    safeError("備用方案也失敗:", fallbackError);
                }
            }
        }
    }

    function addManagedEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        const key = element.id || element.className || 'anonymous';
        if (!resources.eventListeners.has(key)) {
            resources.eventListeners.set(key, []);
        }
        resources.eventListeners.get(key).push({ element, event, handler, options });
    }

    function createManagedBlobUrl(blob) {
        const url = URL.createObjectURL(blob);
        resources.blobUrls.add(url);
        return url;
    }

    function addManagedStyleSheet(styleElement) {
        resources.styleSheets.add(styleElement);
    }

    function addManagedInterval(callback, delay) {
        const id = setInterval(callback, delay);
        resources.intervalIds.add(id);
        return id;
    }

    function addManagedTimeout(callback, delay) {
        const id = setTimeout(callback, delay);
        resources.timeoutIds.add(id);
        return id;
    }

    // ================================
    // OnlineSettings 集成
    // ================================
    function loadFromOnlineSettings() {
        try {
            if (typeof Player !== 'undefined' && Player.OnlineSettings && Player.OnlineSettings.CDBEnhanced) {
                const saved = Player.OnlineSettings.CDBEnhanced;
                state.currentMode = saved.currentMode || state.currentMode;
                state.bgColor = saved.bgColor || state.bgColor;
                state.customBgUrl = saved.customBgUrl || state.customBgUrl;
                state.gridMode = saved.gridMode || state.gridMode;
                state.gridColor = saved.gridColor || state.gridColor;
                state.gridOpacity = saved.gridOpacity !== undefined ? saved.gridOpacity : state.gridOpacity;
                // 姿勢設定
                poseState.enabled = saved.poseChangerEnabled !== undefined ? saved.poseChangerEnabled : poseState.enabled;
                state.currentPoseIndex = saved.currentPoseIndex || 0;

                safeLog("已從OnlineSettings載入設定");
                return true;
            }
        } catch (e) {
            safeError("載入OnlineSettings失敗:", e);
        }
        return false;
    }

    function saveToOnlineSettings() {
        try {
            if (typeof Player !== 'undefined' && Player.OnlineSettings) {
                Player.OnlineSettings.CDBEnhanced = {
                    currentMode: state.currentMode,
                    bgColor: state.bgColor,
                    customBgUrl: state.customBgUrl,
                    gridMode: state.gridMode,
                    gridColor: state.gridColor,
                    gridOpacity: state.gridOpacity,
                    poseChangerEnabled: poseState.enabled,
                    currentPoseIndex: state.currentPoseIndex,
                    version: CONFIG.VERSION
                };

                // 觸發保存
                if (typeof ServerAccountUpdate !== 'undefined' && ServerAccountUpdate.QueueData) {
                    ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
                    //safeLog("設定已保存至OnlineSettings");
                } else {
                    safeLog("設定已更新到OnlineSettings，但無法觸發同步");
                }
            }
        } catch (e) {
            safeError("保存到OnlineSettings失敗:", e);
        }
    }

    // ================================
    // 姿勢更換功能
    // ================================

    function changePose(poseIndex = null) {
        const now = Date.now();

        try {
            // 檢查遊戲狀態
            if (typeof CharacterSetActivePose === 'undefined') {
                safeError("CharacterSetActivePose函數不存在");
                return false;
            }

            // 確定操作目標 - 使用 CharacterAppearanceSelection
            let target = Player; // 默認為自己

            try {
                // 檢查 CharacterAppearanceSelection (更衣室專用)
                if (typeof CharacterAppearanceSelection !== 'undefined' && CharacterAppearanceSelection) {
                    if (CharacterAppearanceSelection.Name && typeof CharacterAppearanceSelection.MemberNumber !== 'undefined') {
                        target = CharacterAppearanceSelection;
                    } else if (typeof ChatRoomCharacter !== 'undefined' && Array.isArray(ChatRoomCharacter)) {
                        const found = ChatRoomCharacter.find(function(char) {
                            return char && (char.MemberNumber === CharacterAppearanceSelection || char === CharacterAppearanceSelection);
                        });
                        if (found) target = found;
                    }
                }
            } catch (e) {
                safeError("獲取目標角色失敗:", e);
            }

            // 設定姿勢索引
            if (poseIndex !== null) {
                if (poseIndex >= 0 && poseIndex < CONFIG.POSES.length) {
                    state.currentPoseIndex = poseIndex;
                } else {
                    safeError("無效的姿勢索引: " + poseIndex);
                    return false;
                }
            } else {
                state.currentPoseIndex = (state.currentPoseIndex + 1) % CONFIG.POSES.length;
            }

            // 確保索引有效
            if (state.currentPoseIndex >= CONFIG.POSES.length || state.currentPoseIndex < 0) {
                state.currentPoseIndex = 0;
            }

            const pose = CONFIG.POSES[state.currentPoseIndex];
            if (!pose || !pose.name) {
                safeError("無法獲取姿勢數據，索引: " + state.currentPoseIndex);
                state.currentPoseIndex = 0;
                return false;
            }

            const poseName = pose.name;

            // 使用正確的BC API
            CharacterSetActivePose(target, poseName);

            // 強制刷新外觀
            if (typeof CharacterRefresh !== 'undefined') {
                CharacterRefresh(target);
            }

            // 如果在聊天室，更新角色狀態
            if (typeof ChatRoomCharacterUpdate !== 'undefined' && typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                ChatRoomCharacterUpdate(target);
            }

            state.lastPoseChangeTime = now;
            saveToOnlineSettings();

            return true;
        } catch (e) {
            safeError("姿勢更換失敗:", e);
            // 重置索引到安全值
            state.currentPoseIndex = 0;
            return false;
        }
    }

    function getCurrentPose() {
        // 確保索引有效
        if (state.currentPoseIndex >= CONFIG.POSES.length || state.currentPoseIndex < 0) {
            state.currentPoseIndex = 0;
        }
        const pose = CONFIG.POSES[state.currentPoseIndex];
        return pose ? pose : { name: "BaseUpper", display: "放鬆手臂" };
    }

    function getCurrentPoseName() {
        return getCurrentPose().display;
    }

    // ================================
    // 等待函數
    // ================================
    function waitForBcModSdk(timeout = CONFIG.TIMEOUTS.BC_MOD_SDK) {
        const start = Date.now();
        return new Promise(function(resolve) {
            function check() {
                if (typeof bcModSdk !== 'undefined' && bcModSdk && bcModSdk.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    safeError("bcModSdk 載入超時");
                    resolve(false);
                } else {
                    addManagedTimeout(check, 100);
                }
            }
            check();
        });
    }

    function waitForGame(timeout = CONFIG.TIMEOUTS.GAME_LOAD) {
        const start = Date.now();
        return new Promise(function(resolve) {
            function check() {
                if (typeof CurrentScreen !== 'undefined' &&
                    typeof DrawButton === 'function' &&
                    typeof Player !== 'undefined') {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    safeError("遊戲載入超時");
                    resolve(false);
                } else {
                    addManagedTimeout(check, 100);
                }
            }
            check();
        });
    }

    // ================================
    // 顏色轉換函數
    // ================================
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function hexToHsv(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;

        let h = 0;
        if (diff !== 0) {
            if (max === r) h = 60 * (((g - b) / diff) % 6);
            else if (max === g) h = 60 * ((b - r) / diff + 2);
            else h = 60 * ((r - g) / diff + 4);
        }
        if (h < 0) h += 360;

        const s = max === 0 ? 0 : diff / max;
        const v = max;

        return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
    }

    function hsvToHex(h, s, v) {
        s /= 100;
        v /= 100;

        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;

        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        return "#" + [r, g, b].map(function(x) {
            return x.toString(16).padStart(2, '0');
        }).join('');
    }

    // ================================
    // 檢測函數
    // ================================
    function isMainAppearanceMode() {
        try {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "Appearance") {
                return false;
            }
            if (typeof CharacterAppearanceMode !== 'undefined' &&
                CharacterAppearanceMode && CharacterAppearanceMode !== "") {
                return false;
            }
            if (typeof CurrentModule !== 'undefined' && CurrentModule === "Wardrobe") {
                return false;
            }

            const dialogSelectors = ['.dialog', '[class*="Dialog"]', '[id*="Dialog"]', '[class*="Wardrobe"]', '[id*="Wardrobe"]'];
            let hasBlockingDialog = false;
            dialogSelectors.forEach(function(selector) {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(function(el) {
                        if (el.offsetParent !== null &&
                            el.style.display !== 'none' &&
                            !el.className.includes('background') &&
                            !el.className.includes('static')) {
                            hasBlockingDialog = true;
                        }
                    });
                } catch (e) {
                    // 忽略選擇器錯誤
                }
            });
            return !hasBlockingDialog;
        } catch (e) {
            return false;
        }
    }

    function isInAppearanceScreen() {
        try {
            return typeof CurrentScreen !== 'undefined' && CurrentScreen === "Appearance";
        } catch (e) {
            return false;
        }
    }

    // 檢查是否在更衣室環境
    function updateDressingRoomStatus() {
        const wasInDressingRoom = performance.isInDressingRoom;
        performance.isInDressingRoom = isInAppearanceScreen();

        if (performance.isInDressingRoom !== wasInDressingRoom) {
            if (performance.isInDressingRoom) {
                //safeLog("進入更衣室模式");
            } else {
                //safeLog("離開更衣室模式");
                // 離開更衣室時自動收起姿勢面板
                poseState.expanded = false;
                // 重置性能計數器
                performance.drawImageCalls = 0;
                performance.lastResetTime = Date.now();
            }
        }

        return performance.isInDressingRoom;
    }

    function detectConflicts() {
        try {
            // 檢查是否有其他修改 drawImage 的腳本
            const originalToString = CanvasRenderingContext2D.prototype.drawImage.toString();
            if (!originalToString.includes('function drawImage()')) {
                safeLog("警告: 檢測到其他腳本可能已修改 drawImage 方法");
            }

            // 檢查是否有CSS衝突
            const gameCanvas = document.querySelector('canvas');
            if (gameCanvas) {
                const style = window.getComputedStyle(gameCanvas);
                if (style.userSelect === 'none') {
                    safeLog("警告: 檢測到可能的CSS衝突");
                }
            }
        } catch (e) {
            safeLog("衝突檢測失敗: " + e.message);
        }
    }

    // ================================
    // 資源管理函數
    // ================================
    function loadCustomBackground(url) {
        url = url || state.customBgUrl;

        // 清理之前的背景資源
        if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
            URL.revokeObjectURL(customBG.src);
            resources.blobUrls.delete(customBG.src);
        }

        return fetch(url)
            .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.blob();
        })
            .then(function(blob) {
            return new Promise(function(resolve, reject) {
                const img = new Image();
                const blobUrl = createManagedBlobUrl(blob);

                img.onload = function() {
                    customBG = img;
                    //safeLog("背景載入完成: " + img.width + "x" + img.height);
                    resolve(img);
                };

                img.onerror = function() {
                    URL.revokeObjectURL(blobUrl);
                    resources.blobUrls.delete(blobUrl);
                    reject(new Error("圖片載入失敗"));
                };

                img.src = blobUrl;
            });
        })
            .catch(function(e) {
            safeError("背景載入失敗:", e);
            return null;
        });
    }

    // ================================
    // UI創建和管理
    // ================================
    function createColorPickerUI() {
        if (colorPickerUI) return colorPickerUI;

        const uiHTML = [
            '<div id="bc-colorpicker-ui" style="',
            'position: fixed;',
            'top: 50%;',
            'left: 50%;',
            'transform: translate(-50%, -50%);',
            'width: 390px;',
            'background: rgba(30, 30, 30, 0.95);',
            'border: 2px solid rgba(83, 35, 161, 0.6);',
            'border-radius: 16px;',
            'box-shadow: 0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);',
            'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;',
            'z-index: ' + CONFIG.Z_INDEX.UI + ';',
            'display: none;',
            'backdrop-filter: blur(20px);',
            '-webkit-backdrop-filter: blur(20px);',
            'user-select: none;',
            '-webkit-user-select: none;',
            '-moz-user-select: none;',
            '-ms-user-select: none;',
            'pointer-events: auto;',
            'isolation: isolate;',
            '">',

            // 標題欄
            '<div style="background: linear-gradient(135deg, #5323a1 0%, #7b2cbf 50%, #9d4edd 100%); color: white; padding: 8px 10px; border-radius: 14px 14px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);">',
            '<span>🎨 背景調色器</span>',
            '<button id="bc-close-btn" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 18px; line-height: 1; transition: all 0.2s ease;">×</button>',
            '</div>',

            '<div style="padding: 16px; background: rgba(0,0,0,0.05); border-radius: 0 0 14px 14px;">',

            // 模式選擇
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">背景模式</h3>',
            '<div style="display: flex; gap: 8px; flex-wrap: wrap;">',
            '<button class="bc-mode-btn" data-mode="disabled">停用</button>',
            '<button class="bc-mode-btn" data-mode="solid">素色背景</button>',
            '<button class="bc-mode-btn" data-mode="custom">自訂背景</button>',
            '</div>',
            '</div>',

            // 顏色選擇器
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">背景顏色</h3>',
            '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">',
            '<input type="color" id="bc-bg-color" value="' + state.bgColor + '" style="width: 50px; height: 35px; border: none; border-radius: 6px; cursor: pointer;">',
            '<input type="text" id="bc-bg-color-text" value="' + state.bgColor + '" style="background: #444; border: 1px solid #666; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; width: 80px;">',
            '</div>',

            // HSV滑塊
            '<div style="margin-top: 16px;">',
            '<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">',
            '<label style="color: #ccc; font-size: 12px; white-space: nowrap; width: 65px; text-align: right;">色相 (H): <span id="bc-h-value">0</span>°</label>',
            '<input type="range" id="bc-h-slider" min="0" max="360" value="0" style="flex: 1; height: 8px; border-radius: 4px; background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%); outline: none; -webkit-appearance: none;">',
            '</div>',
            '<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">',
            '<label style="color: #ccc; font-size: 12px; white-space: nowrap; width: 65px; text-align: right;">飽和 (S): <span id="bc-s-value">0</span>%</label>',
            '<input type="range" id="bc-s-slider" min="0" max="100" value="0" style="flex: 1; height: 8px; border-radius: 4px; background: linear-gradient(to right, #808080, #ff0000); outline: none; -webkit-appearance: none;">',
            '</div>',
            '<div style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">',
            '<label style="color: #ccc; font-size: 12px; white-space: nowrap; width: 65px; text-align: right;">明度 (V): <span id="bc-v-value">0</span>%</label>',
            '<input type="range" id="bc-v-slider" min="0" max="100" value="0" style="flex: 1; height: 8px; border-radius: 4px; background: linear-gradient(to right, #000000, #ffffff); outline: none; -webkit-appearance: none;">',
            '</div>',
            '</div>',

            // 預設顏色
            '<div style="margin-top: 14px;">',
            '<div id="bc-preset-colors" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>',
            '</div>',
            '</div>',

            // 格線設定
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">格線設定</h3>',
            '<div style="display: flex; gap: 8px; margin-bottom: 12px;">',
            '<button class="bc-grid-btn" data-grid="disabled">停用</button>',
            '<button class="bc-grid-btn" data-grid="grid10">10px</button>',
            '<button class="bc-grid-btn" data-grid="grid25">25px</button>',
            '<button class="bc-grid-btn" data-grid="grid50">50px</button>',
            '</div>',
            '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">',
            '<input type="color" id="bc-grid-color" value="' + state.gridColor + '" style="width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer;">',
            '<input type="text" id="bc-grid-color-text" value="' + state.gridColor + '" style="background: #444; border: 1px solid #666; color: #fff; padding: 6px 8px; border-radius: 4px; font-family: monospace; font-size: 11px; width: 65px;">',
            '</div>',
            '<div style="display: flex; align-items: center; gap: 12px;">',
            '<label style="color: #ccc; font-size: 12px; white-space: nowrap; width: 65px;">透明度: <span id="bc-opacity-value">50</span>%</label>',
            '<input type="range" id="bc-opacity-slider" min="0" max="100" value="50" style="flex: 1; height: 6px; border-radius: 3px; background: linear-gradient(to right, transparent, white); outline: none; -webkit-appearance: none;">',
            '</div>',
            '</div>',

            // 自訂背景URL
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">自訂背景圖片</h3>',
            '<div style="display: flex; gap: 8px; align-items: center;">',
            '<input type="text" id="bc-custom-url" value="' + state.customBgUrl + '" placeholder="輸入圖片網址..." style="flex: 1; background: #444; border: 1px solid #666; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 12px; box-sizing: border-box;">',
            '<button id="bc-load-custom" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s; white-space: nowrap;">載入背景</button>',
            '</div>',
            '</div>',

            // 操作按鈕
            '<div style="display: flex; gap: 12px; justify-content: flex-end;">',
            '<button id="bc-reset-btn" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">重置</button>',
            '<button id="bc-save-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">保存設定</button>',
            '<button id="bc-apply-btn" style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">套用</button>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');

        document.body.insertAdjacentHTML('beforeend', uiHTML);
        colorPickerUI = document.getElementById('bc-colorpicker-ui');

        createStyleSheet();
        setupUIEvents();
        createPresetColors();
        updateUIState();

        return colorPickerUI;
    }

    function createStyleSheet() {
        const style = document.createElement('style');
        style.setAttribute('data-bc-colorpicker', 'true');
        style.textContent = [
            '#bc-colorpicker-ui * { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }',
            '.bc-mode-btn, .bc-grid-btn { padding: 10px 18px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); color: #fff; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.3s ease; backdrop-filter: blur(10px); text-shadow: 0 1px 2px rgba(0,0,0,0.5); }',
            '.bc-mode-btn.active, .bc-grid-btn.active { background: rgba(83, 35, 161, 0.8); border-color: rgba(157, 78, 221, 0.6); box-shadow: 0 0 20px rgba(83, 35, 161, 0.4); transform: translateY(-1px); }',
            '.bc-mode-btn:hover, .bc-grid-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.4); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }',
            '#bc-close-btn:hover { background: rgba(255,255,255,0.25); transform: scale(1.1); }',
            '#bc-colorpicker-ui input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; outline: none; }',
            '#bc-colorpicker-ui input[type="range"]::-webkit-slider-track { height: 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.3); }',
            '#bc-colorpicker-ui input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: linear-gradient(135deg, #5323a1, #9d4edd); border: 2px solid rgba(255,255,255,0.8); cursor: pointer; box-shadow: 0 3px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(83,35,161,0.2); transition: all 0.2s ease; }',
            '#bc-colorpicker-ui input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(83,35,161,0.4); }',
            '.bc-preset-color { width: 32px; height: 32px; border-radius: 6px; cursor: pointer; border: 2px solid rgba(255,255,255,0.2); transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }',
            '.bc-preset-color:hover { border-color: rgba(255,255,255,0.8); transform: scale(1.15); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }',
            '#bc-colorpicker-ui input[type="text"], #bc-colorpicker-ui input[type="color"] { border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); }',
            '#bc-colorpicker-ui input[type="text"]:focus { border-color: rgba(83, 35, 161, 0.6); box-shadow: 0 0 0 2px rgba(83, 35, 161, 0.2); }',
            '#bc-colorpicker-ui h3, #bc-colorpicker-ui label { text-shadow: 0 1px 3px rgba(0,0,0,0.5); }',
            '#bc-colorpicker-ui button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn):not(#bc-pose-prev):not(#bc-pose-next) { background: linear-gradient(135deg, rgba(83, 35, 161, 0.8), rgba(157, 78, 221, 0.8)); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); transition: all 0.3s ease; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }',
            '#bc-colorpicker-ui button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn):not(#bc-pose-prev):not(#bc-pose-next):hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(83, 35, 161, 0.4); }',
            '#bc-pose-prev:hover, #bc-pose-next:hover { background: #777; transform: translateY(-1px); }'
        ].join('');

        document.head.appendChild(style);
        addManagedStyleSheet(style);
    }

    function createPresetColors() {
        const container = document.getElementById('bc-preset-colors');
        if (!container) {
            safeLog("预设颜色容器不存在");
            return;
        }

        // 清空容器（防止重复创建）
        container.innerHTML = '';

        CONFIG.PRESET_COLORS.forEach(function(color) {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'bc-preset-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.title = color;

            addManagedEventListener(colorDiv, 'click', function() {
                setBgColor(color);
            });

            container.appendChild(colorDiv);
        });
    }

    function showUI() {
        if (!colorPickerUI) createColorPickerUI();
        colorPickerUI.style.display = 'block';
        state.uiVisible = true;
    }

    function hideUI() {
        if (colorPickerUI) colorPickerUI.style.display = 'none';
        state.uiVisible = false;
    }

    function toggleUI() {
        if (state.uiVisible) {
            hideUI();
        } else {
            showUI();
        }
    }

    // ================================
    // 格線顏色事件處理 - 修復色碼聯動
    // ================================
    function setupGridColorEvents() {
        const gridColorInput = document.getElementById('bc-grid-color');
        const gridColorText = document.getElementById('bc-grid-color-text');

        if (gridColorInput) {
            addManagedEventListener(gridColorInput, 'input', function(e) {
                state.gridColor = e.target.value;
                // 同步到文字輸入框
                if (gridColorText) {
                    gridColorText.value = e.target.value;
                }
                saveToOnlineSettings();
            });
        }

        if (gridColorText) {
            addManagedEventListener(gridColorText, 'input', function(e) {
                // 驗證是否為有效的十六進制顏色碼
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    state.gridColor = e.target.value;
                    // 同步到顏色選擇器
                    if (gridColorInput) {
                        gridColorInput.value = e.target.value;
                    }
                    saveToOnlineSettings();
                }
            });

            // 當失去焦點時，如果格式不正確，恢復為當前值
            addManagedEventListener(gridColorText, 'blur', function(e) {
                if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    e.target.value = state.gridColor;
                }
            });
        }
    }

    // ================================
    // 事件處理
    // ================================
    function setupUIEvents() {
        // 關閉按鈕
        const closeBtn = document.getElementById('bc-close-btn');
        if (closeBtn) {
            addManagedEventListener(closeBtn, 'click', hideUI);
        }

        // 模式按鈕
        const modeBtns = document.querySelectorAll('.bc-mode-btn');
        for (let i = 0; i < modeBtns.length; i++) {
            const btn = modeBtns[i];
            addManagedEventListener(btn, 'click', function() {
                const mode = btn.getAttribute('data-mode');
                setMode(mode);
                updateUIState();
                saveToOnlineSettings();
            });
        }

        // 格線按鈕
        const gridBtns = document.querySelectorAll('.bc-grid-btn');
        for (let i = 0; i < gridBtns.length; i++) {
            const btn = gridBtns[i];
            addManagedEventListener(btn, 'click', function() {
                state.gridMode = btn.getAttribute('data-grid');
                updateUIState();
                saveToOnlineSettings();
            });
        }

        // 背景顏色選擇器
        const bgColorInput = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');

        if (bgColorInput) {
            addManagedEventListener(bgColorInput, 'input', function(e) {
                setBgColor(e.target.value);
                saveToOnlineSettings();
            });
        }

        if (bgColorText) {
            addManagedEventListener(bgColorText, 'input', function(e) {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setBgColor(e.target.value);
                    saveToOnlineSettings();
                }
            });
        }

        // HSV滑塊
        setupHSVSliders();

        // *** 重要：添加格線顏色事件處理 ***
        setupGridColorEvents();

        // 透明度滑塊
        const opacitySlider = document.getElementById('bc-opacity-slider');
        if (opacitySlider) {
            addManagedEventListener(opacitySlider, 'input', function(e) {
                state.gridOpacity = e.target.value / 100;
                const opacityValue = document.getElementById('bc-opacity-value');
                if (opacityValue) {
                    opacityValue.textContent = e.target.value;
                }
                saveToOnlineSettings();
            });
        }

        // 自訂背景
        const loadCustomBtn = document.getElementById('bc-load-custom');
        if (loadCustomBtn) {
            addManagedEventListener(loadCustomBtn, 'click', function() {
                const urlInput = document.getElementById('bc-custom-url');
                if (urlInput && urlInput.value) {
                    state.customBgUrl = urlInput.value;
                    loadCustomBackground(urlInput.value).then(function() {
                        setMode('custom');
                        updateUIState();
                        saveToOnlineSettings();
                    });
                }
            });
        }

        // 操作按鈕
        const resetBtn = document.getElementById('bc-reset-btn');
        const saveBtn = document.getElementById('bc-save-btn');
        const applyBtn = document.getElementById('bc-apply-btn');

        if (resetBtn) {
            addManagedEventListener(resetBtn, 'click', resetSettings);
        }

        if (saveBtn) {
            addManagedEventListener(saveBtn, 'click', function() {
                saveToOnlineSettings();
                // 顯示保存成功提示
                const originalText = saveBtn.textContent;
                saveBtn.textContent = '已保存!';
                saveBtn.style.background = '#4CAF50';
                addManagedTimeout(function() {
                    saveBtn.textContent = originalText;
                    saveBtn.style.background = '';
                }, 1500);
            });
        }

        if (applyBtn) {
            addManagedEventListener(applyBtn, 'click', hideUI);
        }
    }

    function setupHSVSliders() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');

        const hValue = document.getElementById('bc-h-value');
        const sValue = document.getElementById('bc-s-value');
        const vValue = document.getElementById('bc-v-value');

        if (hSlider && hValue) {
            addManagedEventListener(hSlider, 'input', function(e) {
                hValue.textContent = e.target.value;
                updateColorFromHSV();
                saveToOnlineSettings();
            });
        }

        if (sSlider && sValue) {
            addManagedEventListener(sSlider, 'input', function(e) {
                sValue.textContent = e.target.value;
                updateSaturationSliderBackground();
                updateColorFromHSV();
                saveToOnlineSettings();
            });
        }

        if (vSlider && vValue) {
            addManagedEventListener(vSlider, 'input', function(e) {
                vValue.textContent = e.target.value;
                updateValueSliderBackground();
                updateColorFromHSV();
                saveToOnlineSettings();
            });
        }
    }

    // ================================
    // 狀態管理函數
    // ================================
    function setBgColor(color) {
        state.bgColor = color;
        const hsv = hexToHsv(color);

        const elements = {
            bgColor: document.getElementById('bc-bg-color'),
            bgColorText: document.getElementById('bc-bg-color-text'),
            hSlider: document.getElementById('bc-h-slider'),
            sSlider: document.getElementById('bc-s-slider'),
            vSlider: document.getElementById('bc-v-slider'),
            hValue: document.getElementById('bc-h-value'),
            sValue: document.getElementById('bc-s-value'),
            vValue: document.getElementById('bc-v-value')
        };

        if (elements.bgColor) elements.bgColor.value = color;
        if (elements.bgColorText) elements.bgColorText.value = color;
        if (elements.hSlider) elements.hSlider.value = hsv.h;
        if (elements.sSlider) elements.sSlider.value = hsv.s;
        if (elements.vSlider) elements.vSlider.value = hsv.v;
        if (elements.hValue) elements.hValue.textContent = hsv.h;
        if (elements.sValue) elements.sValue.textContent = hsv.s;
        if (elements.vValue) elements.vValue.textContent = hsv.v;

        updateSaturationSliderBackground();
        updateValueSliderBackground();

        if (state.currentMode !== 'solid') setMode('solid');
    }

    function updateColorFromHSV() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');

        if (!hSlider || !sSlider || !vSlider) return;

        const h = parseInt(hSlider.value);
        const s = parseInt(sSlider.value);
        const v = parseInt(vSlider.value);

        const hex = hsvToHex(h, s, v);
        state.bgColor = hex;

        const bgColor = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');

        if (bgColor) bgColor.value = hex;
        if (bgColorText) bgColorText.value = hex;

        if (state.currentMode !== 'solid') setMode('solid');
    }

    function updateSaturationSliderBackground() {
        const hSlider = document.getElementById('bc-h-slider');
        const vSlider = document.getElementById('bc-v-slider');
        const sSlider = document.getElementById('bc-s-slider');

        if (!hSlider || !vSlider || !sSlider) return;

        const h = hSlider.value;
        const v = vSlider.value;
        const colorLeft = hsvToHex(h, 0, v);
        const colorRight = hsvToHex(h, 100, v);

        sSlider.style.background = 'linear-gradient(to right, ' + colorLeft + ', ' + colorRight + ')';
        sSlider.style.border = '1px solid rgba(255,255,255,0.3)';
        sSlider.style.borderRadius = '4px';
    }

    function updateValueSliderBackground() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');

        if (!hSlider || !sSlider || !vSlider) return;

        const h = hSlider.value;
        const s = sSlider.value;
        const colorLeft = hsvToHex(h, s, 0);
        const colorRight = hsvToHex(h, s, 100);

        vSlider.style.background = 'linear-gradient(to right, ' + colorLeft + ', ' + colorRight + ')';
        vSlider.style.border = '1px solid rgba(255,255,255,0.3)';
        vSlider.style.borderRadius = '4px';
    }

    function setMode(mode) {
        state.currentMode = mode;
        if (mode === 'custom' && !customBG) {
            loadCustomBackground();
        }
    }

    function updateUIState() {
        // 更新模式按鈕
        const modeBtns = document.querySelectorAll('.bc-mode-btn');
        for (let i = 0; i < modeBtns.length; i++) {
            const btn = modeBtns[i];
            const isActive = btn.getAttribute('data-mode') === state.currentMode;
            btn.classList.toggle('active', isActive);
        }

        // 更新格線按鈕
        const gridBtns = document.querySelectorAll('.bc-grid-btn');
        for (let i = 0; i < gridBtns.length; i++) {
            const btn = gridBtns[i];
            const isActive = btn.getAttribute('data-grid') === state.gridMode;
            btn.classList.toggle('active', isActive);
        }

        // 更新UI中的值
        const elements = {
            gridColor: document.getElementById('bc-grid-color'),
            gridColorText: document.getElementById('bc-grid-color-text'),
            opacitySlider: document.getElementById('bc-opacity-slider'),
            opacityValue: document.getElementById('bc-opacity-value'),
            customUrl: document.getElementById('bc-custom-url')
        };

        if (elements.gridColor) elements.gridColor.value = state.gridColor;
        if (elements.gridColorText) elements.gridColorText.value = state.gridColor;
        if (elements.opacitySlider) elements.opacitySlider.value = Math.round(state.gridOpacity * 100);
        if (elements.opacityValue) elements.opacityValue.textContent = Math.round(state.gridOpacity * 100);
        if (elements.customUrl) elements.customUrl.value = state.customBgUrl;
    }

    function resetSettings() {
        state.currentMode = 'disabled';
        state.bgColor = '#87CEEB';
        state.gridMode = 'disabled';
        state.gridColor = '#FFFFFF';
        state.gridOpacity = 0.5;
        state.customBgUrl = CONFIG.DEFAULT_BG_URL;
        poseState.enabled = true;
        state.currentPoseIndex = 0;

        setBgColor(state.bgColor);
        updateUIState();
        saveToOnlineSettings();
    }

    // ================================
    // 姿勢按鈕繪製
    // ================================
    function drawPoseButtons() {
        return safeCallWithFallback(function() {
            if (!poseState.enabled) return;

            // 主按鈕 - 只顯示文字，不偵測當前姿勢
            const mainButtonText = "POSE";
            const color = poseState.expanded ? "#5323a1" : "White";

            if (typeof DrawButton === 'function') {
                // 主按鈕 - 只顯示文字
                DrawButton(
                    CONFIG.POSE_BUTTON_X,
                    CONFIG.POSE_BUTTON_Y,
                    CONFIG.POSE_BUTTON_SIZE,
                    CONFIG.POSE_BUTTON_SIZE,
                    mainButtonText,
                    color,
                    "", // 不顯示圖標
                    "點擊展開/收起姿勢選單"
                );

                // 如果展開，顯示所有姿勢按鈕（6+5佈局）
                if (poseState.expanded) {
                    CONFIG.POSES.forEach(function(pose, index) {
                        const buttonColor = "White";
                        const iconUrl = CONFIG.getPoseIconURL(pose.name);

                        // 計算位置 - 6+5佈局
                        let buttonX, buttonY;
                        if (index < 6) {
                            // 第一行 (索引 0-5) - 6個按鈕
                            buttonX = CONFIG.POSE_BUTTON_X + index * (CONFIG.POSE_BUTTON_SIZE + 10);
                            buttonY = CONFIG.POSE_BUTTON_Y + CONFIG.POSE_BUTTON_SIZE + 5;
                        } else {
                            // 第二行 (索引 6-10) - 5個按鈕，向右偏移100
                            buttonX = CONFIG.POSE_BUTTON_X + 100 + (index - 6) * (CONFIG.POSE_BUTTON_SIZE + 10);
                            buttonY = CONFIG.POSE_BUTTON_Y + 2 * (CONFIG.POSE_BUTTON_SIZE + 5);
                        }

                        DrawButton(
                            buttonX,
                            buttonY,
                            CONFIG.POSE_BUTTON_SIZE,
                            CONFIG.POSE_BUTTON_SIZE,
                            "", // 不顯示文字，只顯示圖標
                            buttonColor,
                            iconUrl,
                            `切換到: ${pose.display}`
                        );
                    });
                }
            }
        }, null);
    }

    // ================================
    // 姿勢按鈕點擊處理
    // ================================
    function handlePoseButtonsClick() {
        return safeCallWithFallback(function() {
            if (!poseState.enabled) return false;
            if (typeof MouseIn !== 'function') return false;

            // 主按鈕點擊
            if (MouseIn(CONFIG.POSE_BUTTON_X, CONFIG.POSE_BUTTON_Y, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE)) {
                poseState.expanded = !poseState.expanded;
                //safeLog(poseState.expanded ? "姿勢面板已展開" : "姿勢面板已收起");
                return true;
            }

            // 如果展開，檢查姿勢按鈕點擊（6+5佈局）
            if (poseState.expanded) {
                for (let index = 0; index < CONFIG.POSES.length; index++) {
                    let buttonX, buttonY;

                    // 計算按鈕位置 - 匹配6+5繪製邏輯
                    if (index < 6) {
                        // 第一行 (索引 0-5) - 6個按鈕
                        buttonX = CONFIG.POSE_BUTTON_X + index * (CONFIG.POSE_BUTTON_SIZE + 10);
                        buttonY = CONFIG.POSE_BUTTON_Y + CONFIG.POSE_BUTTON_SIZE + 5;
                    } else {
                        // 第二行 (索引 6-10) - 5個按鈕，向右偏移100
                        buttonX = CONFIG.POSE_BUTTON_X + 100 + (index - 6) * (CONFIG.POSE_BUTTON_SIZE + 10);
                        buttonY = CONFIG.POSE_BUTTON_Y + 2 * (CONFIG.POSE_BUTTON_SIZE + 5);
                    }

                    if (MouseIn(buttonX, buttonY, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE)) {
                        if (changePose(index)) {
                            // 成功後收起面板，不顯示通知
                            poseState.expanded = false;
                        }
                        return true;
                    }
                }
            }

            return false;
        }, function() { return false; });
    }

    // ================================
    // 繪圖相關函數
    // ================================
    function drawGrid(ctx, canvas) {
        if (state.gridMode === 'disabled' || state.currentMode === 'disabled') return;

        const spacing = CONFIG.GRID_SPACING[state.gridMode];
        if (!spacing) return;

        try {
            ctx.save();
            const rgb = hexToRgb(state.gridColor);
            if (!rgb) return;

            const color = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + state.gridOpacity + ')';
            const thickColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + Math.min(1, state.gridOpacity + 0.3) + ')';

            // 細格線
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);

            for (let x = 0; x < canvas.width; x += spacing) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }

            for (let y = 0; y < canvas.height; y += spacing) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }

            // 粗格線（每50px）
            if (spacing < 50) {
                ctx.strokeStyle = thickColor;
                ctx.lineWidth = 2;

                for (let x = 0; x < canvas.width; x += 50) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                    ctx.stroke();
                }

                for (let y = 0; y < canvas.height; y += 50) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                    ctx.stroke();
                }
            }

            ctx.restore();
        } catch (e) {
            safeError("繪製格線失敗:", e);
        }
    }

    function drawMainButton() {
        return safeCallWithFallback(function() {
            const iconUrl = CONFIG.getIconURL('Extensions');
            const text = "";
            // 如果 UI 开启，显示紫色；否则根据模式显示
            const color = state.uiVisible ? "#5323a1" : (state.currentMode === 'disabled' ? "White" : "#5323a1");

            if (typeof DrawButton === 'function') {
                DrawButton(CONFIG.BUTTON_X, CONFIG.BUTTON_Y, CONFIG.BUTTON_SIZE, CONFIG.BUTTON_SIZE,
                           text, color, iconUrl, "點擊開啟專業調色器");
            }
        }, null);
    }

    function handleMainButtonClick() {
        return safeCallWithFallback(function() {
            if (typeof MouseIn === 'function' &&
                MouseIn(CONFIG.BUTTON_X, CONFIG.BUTTON_Y, CONFIG.BUTTON_SIZE, CONFIG.BUTTON_SIZE)) {
                if (state.uiVisible) {
                    hideUI();
                } else {
                    showUI();
                }
                return true;
            }
            return false;
        }, function() { return false; });
    }
    // 放大預覽按鈕繪製
    function drawZoomPreviewButton() {
        return safeCallWithFallback(function() {
            const iconUrl = CONFIG.getIconURL('Search');
            const color = zoomPreviewState.active ? "#5323a1" : "White";

            if (typeof DrawButton === 'function') {
                DrawButton(145, 25, 90, 90, "", color, iconUrl, "點擊開啟/關閉放大預覽");
            }
        }, null);
    }

    // 放大預覽點擊處理
    function handleZoomPreviewButtonClick() {
        return safeCallWithFallback(function() {
            if (typeof MouseIn === 'function' && MouseIn(145, 25, 90, 90)) {
                if (zoomPreviewState.active) {
                    closeZoomPreview();
                } else {
                    toggleZoomPreview();
                }
                return true;
            }
            return false;
        }, function() { return false; });
    }

    // 創建放大預覽UI
    function createZoomPreviewUI() {
        const uiHTML = [
            '<div id="bc-zoom-preview" style="position: fixed !important; top: 10% !important; left: 1% !important; right: auto !important; width: 40%; height: 89.5%; background: rgba(30, 30, 30, 0.95); border: 2px solid rgba(83, 35, 161, 0.6); border-radius: 16px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); z-index: ' + CONFIG.Z_INDEX.UI + '; display: none; backdrop-filter: blur(20px);">',

            '<div id="bc-zoom-header" style="background: linear-gradient(135deg, #5323a1 0%, #7b2cbf 50%, #9d4edd 100%); color: white; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 16px; border-radius: 14px 14px 0 0; cursor: move; user-select: none;">',
            '<span>🔍 放大预览</span>',
            '<div style="display: flex; gap: 8px;">',
            '<button id="bc-zoom-reset" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; line-height: 1;">⟲</button>',
            '<button id="bc-zoom-close" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 18px; line-height: 1;">×</button>',
            '</div>',
            '</div>',

            '<div id="bc-zoom-container" style="width: 100%; height: calc(100% - 90px); overflow: auto; position: relative; cursor: grab; background: #1a1a1a;">',
            '<canvas id="bc-zoom-canvas" style="display: block;"></canvas>',
            '</div>',

            '<div style="padding: 8px 16px; background: rgba(0,0,0,0.3); display: flex; align-items: center; gap: 12px; border-radius: 0 0 14px 14px;">',
            '<label style="color: #ccc; font-size: 12px;">缩放: <span id="bc-zoom-value">150</span>%</label>',
            '<input type="range" id="bc-zoom-slider" min="100" max="300" value="150" step="10" style="flex: 1; height: 6px; border-radius: 3px; outline: none; -webkit-appearance: none;">',
            '</div>',

            // 自定义调整大小手柄
            '<div id="bc-zoom-resizer" style="position: absolute; bottom: 0; right: 0; width: 20px; height: 20px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 0%, transparent 50%, rgba(83, 35, 161, 0.6) 50%, rgba(83, 35, 161, 0.6) 100%); border-radius: 0 0 14px 0;"></div>',

            '</div>'
        ].join('');

        document.body.insertAdjacentHTML('beforeend', uiHTML);

        const previewUI = document.getElementById('bc-zoom-preview');
        const header = document.getElementById('bc-zoom-header');
        const slider = document.getElementById('bc-zoom-slider');
        const resetBtn = document.getElementById('bc-zoom-reset');
        const closeBtn = document.getElementById('bc-zoom-close');
        const container = document.getElementById('bc-zoom-container');
        const zoomValue = document.getElementById('bc-zoom-value');
        const resizer = document.getElementById('bc-zoom-resizer');

        // 缩放滑块
        addManagedEventListener(slider, 'input', function(e) {
            zoomPreviewState.zoom = parseInt(e.target.value) / 100;
            zoomValue.textContent = e.target.value;
            updateZoomPreview();
        });

        // 重置按钮
        addManagedEventListener(resetBtn, 'click', function() {
            zoomPreviewState.zoom = 1.5;
            slider.value = 150;
            zoomValue.textContent = '150';
            container.scrollTop = 0;
            container.scrollLeft = 0;
            updateZoomPreview();
        });

        // 关闭按钮
        addManagedEventListener(closeBtn, 'click', function() {
            toggleZoomPreview();
            closeZoomPreview();
        });

        // 窗口拖曳（标题栏）
        addManagedEventListener(header, 'mousedown', function(e) {
            zoomPreviewState.isDraggingWindow = true;
            zoomPreviewState.lastMouseX = e.clientX;
            zoomPreviewState.lastMouseY = e.clientY;
            e.preventDefault();
        });

        // 窗口调整大小（右下角手柄）
        let isResizing = false;
        let resizeStartX, resizeStartY, resizeStartWidth, resizeStartHeight;

        addManagedEventListener(resizer, 'mousedown', function(e) {
            isResizing = true;
            resizeStartX = e.clientX;
            resizeStartY = e.clientY;
            resizeStartWidth = previewUI.offsetWidth;
            resizeStartHeight = previewUI.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        });

        addManagedEventListener(document, 'mousemove', function(e) {
            if (isResizing) {
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;
                const newWidth = Math.max(400, resizeStartWidth + deltaX);
                const newHeight = Math.max(500, resizeStartHeight + deltaY);
                previewUI.style.width = newWidth + 'px';
                previewUI.style.height = newHeight + 'px';
            } else if (zoomPreviewState.isDraggingWindow) {
                const deltaX = e.clientX - zoomPreviewState.lastMouseX;
                const deltaY = e.clientY - zoomPreviewState.lastMouseY;
                zoomPreviewState.windowX += deltaX;
                zoomPreviewState.windowY += deltaY;
                previewUI.style.left = zoomPreviewState.windowX + 'px';
                previewUI.style.top = zoomPreviewState.windowY + 'px';
                zoomPreviewState.lastMouseX = e.clientX;
                zoomPreviewState.lastMouseY = e.clientY;
            } else if (zoomPreviewState.isDragging) {
                container.scrollLeft -= e.clientX - zoomPreviewState.lastMouseX;
                container.scrollTop -= e.clientY - zoomPreviewState.lastMouseY;
                zoomPreviewState.lastMouseX = e.clientX;
                zoomPreviewState.lastMouseY = e.clientY;
            }
        });

        addManagedEventListener(document, 'mouseup', function() {
            isResizing = false;
            zoomPreviewState.isDraggingWindow = false;
            if (zoomPreviewState.isDragging) {
                zoomPreviewState.isDragging = false;
                container.style.cursor = 'grab';
            }
        });

        // 画布拖曳（滚动内容）
        addManagedEventListener(container, 'mousedown', function(e) {
            if (e.button === 0) {
                zoomPreviewState.isDragging = true;
                zoomPreviewState.lastMouseX = e.clientX;
                zoomPreviewState.lastMouseY = e.clientY;
                container.style.cursor = 'grabbing';
            }
        });

        return previewUI;
    }

    function updateZoomPreview() {
        const C = CharacterAppearanceSelection;
        if (!C || !C.Canvas) return;

        const canvas = document.getElementById('bc-zoom-canvas');
        const container = document.getElementById('bc-zoom-container');
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        const zoom = zoomPreviewState.zoom;

        const sourceWidth = C.Canvas.width;
        const sourceHeight = C.Canvas.height;

        // 顶部预留 250px 给帽子等装饰
        const topPadding = 250;

        canvas.width = sourceWidth * zoom;
        canvas.height = (sourceHeight + topPadding) * zoom;
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        // 1. 背景
        if (state.currentMode === 'solid') {
            ctx.fillStyle = state.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (state.currentMode === 'custom' && customBG && customBG.complete) {
            ctx.drawImage(customBG, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 2. 角色（从 topPadding 位置开始绘制）
        const yOffset = topPadding * zoom;
        ctx.save();
        ctx.drawImage(C.Canvas, 0, 0, sourceWidth, sourceHeight, 0, yOffset, sourceWidth * zoom, sourceHeight * zoom);
        ctx.restore();

        // 3. 格线
        if (state.gridMode !== 'disabled') {
            const spacing = CONFIG.GRID_SPACING[state.gridMode] * zoom;
            const rgb = hexToRgb(state.gridColor);
            if (rgb) {
                ctx.save();
                ctx.strokeStyle = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + state.gridOpacity + ')';
                ctx.lineWidth = 1;
                ctx.beginPath();
                for (let x = 0; x <= canvas.width; x += spacing) {
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, canvas.height);
                }
                for (let y = 0; y <= canvas.height; y += spacing) {
                    ctx.moveTo(0, y);
                    ctx.lineTo(canvas.width, y);
                }
                ctx.stroke();
                ctx.restore();
            }
        }

        // 4. 设置滚动位置：垂直25%，水平50%
        setTimeout(function() {
            const maxScrollTop = container.scrollHeight - container.clientHeight;
            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            container.scrollTop = maxScrollTop * 0.25; // 垂直25%
            container.scrollLeft = maxScrollLeft * 0.5; // 水平50%
        }, 10);
    }
    function toggleZoomPreview() {
        zoomPreviewState.active = !zoomPreviewState.active;

        let previewUI = document.getElementById('bc-zoom-preview');

        if (zoomPreviewState.active) {
            if (!previewUI) {
                previewUI = createZoomPreviewUI();
            }

            // 初始化窗口位置（转换百分比为像素）
            const rect = previewUI.getBoundingClientRect();
            zoomPreviewState.windowX = rect.left;
            zoomPreviewState.windowY = rect.top;

            previewUI.style.display = 'block';
            updateZoomPreview();
        }
    }
    function closeZoomPreview() {
        zoomPreviewState.active = false;
        const previewUI = document.getElementById('bc-zoom-preview');
        if (previewUI) previewUI.style.display = 'none';
    }
    // ================================
    // Hook 設置
    // ================================
    function setupDrawImageHook() {
        if (originalDrawImage) return;

        originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

        // 創建性能監控定時器
        addManagedInterval(function() {
            // 每5秒重置計數器
            if (Date.now() - performance.lastResetTime > 5000) {
                // 提高警告閾值到20000，或者註釋掉以下行來完全禁用警告
                // if (performance.drawImageCalls > 20000 && performance.isInDressingRoom) {
                //     safeLog("警告: 在更衣室模式下 drawImage 調用頻率過高: " + performance.drawImageCalls + " (5秒內)");
                // }
                performance.drawImageCalls = 0;
                performance.lastResetTime = Date.now();
            }

            // 更新更衣室狀態
            updateDressingRoomStatus();
        }, 5000);

        CanvasRenderingContext2D.prototype.drawImage = function(img) {
            const args = Array.prototype.slice.call(arguments, 1);

            // 只在更衣室場景時進行性能監控
            if (performance.isInDressingRoom) {
                performance.drawImageCalls++;
            }

            // 類型檢查
            if (!img || typeof img.src !== 'string') {
                return originalDrawImage.apply(this, [img].concat(args));
            }

            try {
                // 嚴格的條件檢查 - 只在更衣室且啟用時攔截
                if (img.src.includes("Backgrounds/Dressing.jpg") &&
                    isInAppearanceScreen() &&
                    state.currentMode !== 'disabled') {

                    const canvas = this.canvas;
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        this.save();

                        if (state.currentMode === 'solid') {
                            this.fillStyle = state.bgColor;
                            this.fillRect(0, 0, canvas.width, canvas.height);
                        } else if (state.currentMode === 'custom' && customBG && customBG.complete) {
                            originalDrawImage.call(this, customBG,
                                                   0, 0, customBG.width, customBG.height,
                                                   0, 0, canvas.width, canvas.height
                                                  );
                        } else {
                            originalDrawImage.apply(this, [img].concat(args));
                        }

                        // 繪製格線
                        if (state.currentMode !== 'disabled') {
                            drawGrid(this, canvas);
                        }

                        this.restore();
                        return;
                    }
                }
            } catch(e) {
                performance.drawImageErrors++;
                safeError("drawImage hook 錯誤:", e);
                try { this.restore(); } catch(restoreError) {}
            }

            return originalDrawImage.apply(this, [img].concat(args));
        };
    }

    function setupBCHooks() {
        if (!modApi) return;

        try {
            // AppearanceRun hook
            modApi.hookFunction("AppearanceRun", 4, function(args, next) {
                const result = next(args);

                safeCallWithFallback(function() {
                    if (isMainAppearanceMode()) {
                        drawMainButton();
                        drawZoomPreviewButton();
                        drawPoseButtons();
                    }
                });

                return result;
            });

            // CharacterLoadCanvas hook - 自动更新放大预览
            modApi.hookFunction("CharacterLoadCanvas", 4, function(args, next) {
                const result = next(args);

                if (args[0] === CharacterAppearanceSelection && zoomPreviewState.active) {
                    setTimeout(function() {
                        updateZoomPreview();
                    }, 50);
                }

                return result;
            });

            // AppearanceClick hook
            modApi.hookFunction("AppearanceClick", 4, function(args, next) {
                const mainButtonHandled = safeCallWithFallback(function() {
                    return isMainAppearanceMode() && handleMainButtonClick();
                }, function() { return false; });

                const zoomButtonHandled = safeCallWithFallback(function() {
                    return isMainAppearanceMode() && handleZoomPreviewButtonClick();
                }, function() { return false; });

                const poseButtonHandled = safeCallWithFallback(function() {
                    return isMainAppearanceMode() && handlePoseButtonsClick();
                }, function() { return false; });

                if (mainButtonHandled || zoomButtonHandled || poseButtonHandled) return;
                return next(args);
            });

            // AppearanceExit hook - 检查是否真的退出
            modApi.hookFunction("AppearanceExit", 4, function(args, next) {
                const result = next(args);

                // 延迟检查是否真的离开更衣室
                setTimeout(function() {
                    if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "Appearance") {
                        closeZoomPreview();
                        poseState.expanded = false;
                        hideUI();
                    }
                }, 100);

                return result;
            });

            // CharacterAppearanceExit hook - 真正退出更衣室
            modApi.hookFunction("CharacterAppearanceExit", 4, function(args, next) {
                // 这个函数只在真的退出时调用，直接关闭
                closeZoomPreview();
                poseState.expanded = false;
                hideUI();
                return next(args);
            });

            // CharacterAppearanceWardrobeLoad hook - 进入衣柜时关闭所有UI
            modApi.hookFunction("CharacterAppearanceWardrobeLoad", 4, function(args, next) {
                closeZoomPreview();
                poseState.expanded = false;
                hideUI();
                return next(args);
            });
        } catch (e) {
            safeError("设置BC hooks失败:", e);
        }
    }

    // ================================
    // 初始化和清理
    // ================================
    function initializeModApi() {
        return waitForBcModSdk().then(function(success) {
            if (!success) return null;

            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CDB",
                    fullName: "Liko's Custom Dressing Background",
                    version: CONFIG.VERSION,
                    repository: '自訂更衣室背景 | Custom Dressing Background'
                });
                //safeLog("✅ 插件註冊成功");
                return modApi;
            } catch (e) {
                safeError("❌ 初始化 modApi 失敗:", e);
                return null;
            }
        });
    }

    function cleanup() {

        try {
            closeZoomPreview();
            poseState.expanded = false;
            hideUI();
            // 恢復原始的 drawImage 方法
            if (originalDrawImage) {
                CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
                originalDrawImage = null;
            }

            // 清理定時器
            resources.intervalIds.forEach(function(id) {
                clearInterval(id);
            });
            resources.intervalIds.clear();

            resources.timeoutIds.forEach(function(id) {
                clearTimeout(id);
            });
            resources.timeoutIds.clear();

            // 清理 blob URLs
            resources.blobUrls.forEach(function(url) {
                URL.revokeObjectURL(url);
            });
            resources.blobUrls.clear();

            // 清理自定義背景
            if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
                URL.revokeObjectURL(customBG.src);
                customBG = null;
            }

            // 清理事件監聽器
            resources.eventListeners.forEach(function(listeners, key) {
                listeners.forEach(function(listener) {
                    try {
                        listener.element.removeEventListener(listener.event, listener.handler, listener.options);
                    } catch (e) {
                        safeError("清理事件監聽器失敗:", e);
                    }
                });
            });
            resources.eventListeners.clear();

            // 移除UI元素
            const uiElements = ['bc-colorpicker-ui', 'bc-zoom-preview'];
            uiElements.forEach(function(id) {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
            colorPickerUI = null;

            // 移除樣式表
            resources.styleSheets.forEach(function(styleElement) {
                try {
                    styleElement.remove();
                } catch (e) {
                    safeError("移除樣式表失敗:", e);
                }
            });
            resources.styleSheets.clear();

            // 重置狀態
            state.uiVisible = false;
            poseState.expanded = false;
            isInitialized = false;

            // 清理全局對象
            if (window.CDBEnhanced) {
                delete window.CDBEnhanced;
            }

            safeLog("插件已完全清理");
        } catch (e) {
            safeError("清理失敗:", e);
        }
    }

    function initialize() {
        if (isInitialized) {
            safeLog("插件已初始化，跳過重複初始化");
            return;
        }

        isInitialized = true;
        safeLog("初始化 v" + CONFIG.VERSION + "...");

        waitForGame().then(function(gameLoaded) {
            if (!gameLoaded) {
                safeError("遊戲載入失敗，使用簡化模式");
            }

            // 載入保存的設定
            loadFromOnlineSettings();

            detectConflicts();
            return initializeModApi();
        }).then(function(api) {
            modApi = api;
            if (modApi) {
                setupDrawImageHook();
                setupBCHooks();
                return loadCustomBackground();
            } else {
                safeLog("ModAPI初始化失敗，但UI仍可使用");
                return Promise.resolve();
            }
        }).then(function() {
            if (modApi && modApi.onUnload) {
                modApi.onUnload(cleanup);
            }

            // 添加全域測試函數
            window.CDBEnhanced = {
                show: showUI,
                hide: hideUI,
                toggle: toggleUI,
                cleanup: cleanup,
                changePose: changePose,
                saveSettings: saveToOnlineSettings,
                loadSettings: loadFromOnlineSettings,
                getCurrentPose: getCurrentPoseName,
                test: function() {
                    safeLog("=== CDB v" + CONFIG.VERSION + " ===");
                    safeLog("當前畫面: " + (typeof CurrentScreen !== 'undefined' ? CurrentScreen : '未知'));
                    safeLog("在更衣室主畫面: " + isMainAppearanceMode());
                    safeLog("性能統計: 繪圖調用 " + performance.drawImageCalls + ", 錯誤 " + performance.drawImageErrors);
                    safeLog("當前姿勢: " + getCurrentPoseName() + " (索引: " + state.currentPoseIndex + ")");
                    safeLog("姿勢更換器啟用: " + poseState.enabled);
                    safeLog("姿勢面板展開狀態: " + poseState.expanded);
                }
            };

            safeLog("✅ 初始化完成 v" + CONFIG.VERSION);
            //safeLog("新功能: 展開式姿勢按鈕 (X=" + CONFIG.POSE_BUTTON_X + "), OnlineSettings集成");
        }).catch(function(e) {
            safeError("初始化失敗:", e);
            isInitialized = false; // 允許重試
        });
    }

    // ================================
    // 啟動
    // ================================
    initialize();
})();
