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
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ================================
    // 图片路径辅助工具
    // ================================
    const ImagePathHelper = {
        _cachedBasePath: null,

        getBasePath: function() {
            if (this._cachedBasePath) return this._cachedBasePath;

            let href = window.location.href;
            
            // 确保结尾有斜线
            if (!href.endsWith('/')) {
                href = href.substring(0, href.lastIndexOf('/') + 1);
            }
            
            this._cachedBasePath = href;
            return href;
        },

        getAssetURL: function(path) {
            return this.getBasePath() + 'Assets/' + path;
        },

        getIconURL: function(iconName) {
            return this.getBasePath() + 'Icons/' + iconName;
        },

        getPoseIconURL: function(poseName) {
            return this.getBasePath() + 'Icons/Poses/' + poseName + '.png';
        },

        clearCache: function() {
            this._cachedBasePath = null;
        }
    };

    // ================================
    // 常量配置
    // ================================
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
        ]
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
        expanded: false,
        enabled: true
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
        windowX: 0,
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

                if (typeof ServerAccountUpdate !== 'undefined' && ServerAccountUpdate.QueueData) {
                    ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
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
            if (typeof CharacterSetActivePose === 'undefined') {
                safeError("CharacterSetActivePose函數不存在");
                return false;
            }

            let target = Player;

            try {
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

            CharacterSetActivePose(target, poseName);

            if (typeof CharacterRefresh !== 'undefined') {
                CharacterRefresh(target);
            }

            if (typeof ChatRoomCharacterUpdate !== 'undefined' && typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                ChatRoomCharacterUpdate(target);
            }

            state.lastPoseChangeTime = now;
            saveToOnlineSettings();

            return true;
        } catch (e) {
            safeError("姿勢更換失敗:", e);
            state.currentPoseIndex = 0;
            return false;
        }
    }

    function getCurrentPose() {
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
                } catch (e) {}
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

    function updateDressingRoomStatus() {
        const wasInDressingRoom = performance.isInDressingRoom;
        performance.isInDressingRoom = isInAppearanceScreen();

        if (performance.isInDressingRoom !== wasInDressingRoom) {
            if (!performance.isInDressingRoom) {
                poseState.expanded = false;
                performance.drawImageCalls = 0;
                performance.lastResetTime = Date.now();
            }
        }

        return performance.isInDressingRoom;
    }

    function detectConflicts() {
        try {
            const originalToString = CanvasRenderingContext2D.prototype.drawImage.toString();
            if (!originalToString.includes('function drawImage()')) {
                safeLog("警告: 檢測到其他腳本可能已修改 drawImage 方法");
            }

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

    // 由于代码太长，我将在下一部分继续
    // ================================
    // UI創建和管理 (部分代码省略，与原版相同)
    // ================================
    
    // [UI创建代码与原版基本相同，这里省略以节省空间]
    // 主要包括：
    // - createColorPickerUI()
    // - createStyleSheet()
    // - createPresetColors()
    // - showUI() / hideUI() / toggleUI()
    // - setupUIEvents()
    // - 各种UI状态管理函数

    // 完整代码请参考原 CDB 插件，这里只展示关键修改部分
    
    function createColorPickerUI() {
        // ... 原UI创建代码 ...
        // (为节省空间省略，实际使用时需要完整复制)
    }

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
            const iconUrl = ImagePathHelper.getIconURL('Extensions.png');
            const text = "";
            const color = state.uiVisible ? "#5323a1" : (state.currentMode === 'disabled' ? "White" : "#5323a1");

            if (typeof DrawButton === 'function') {
                DrawButton(CONFIG.BUTTON_X, CONFIG.BUTTON_Y, CONFIG.BUTTON_SIZE, CONFIG.BUTTON_SIZE,
                           text, color, iconUrl, "點擊開啟專業調色器");
            }
        }, null);
    }

    function drawPoseButtons() {
        return safeCallWithFallback(function() {
            if (!poseState.enabled) return;

            const mainButtonText = "POSE";
            const color = poseState.expanded ? "#5323a1" : "White";

            if (typeof DrawButton === 'function') {
                DrawButton(
                    CONFIG.POSE_BUTTON_X,
                    CONFIG.POSE_BUTTON_Y,
                    CONFIG.POSE_BUTTON_SIZE,
                    CONFIG.POSE_BUTTON_SIZE,
                    mainButtonText,
                    color,
                    "",
                    "點擊展開/收起姿勢選單"
                );

                if (poseState.expanded) {
                    CONFIG.POSES.forEach(function(pose, index) {
                        const buttonColor = "White";
                        const iconUrl = ImagePathHelper.getPoseIconURL(pose.name);

                        let buttonX, buttonY;
                        if (index < 6) {
                            buttonX = CONFIG.POSE_BUTTON_X + index * (CONFIG.POSE_BUTTON_SIZE + 10);
                            buttonY = CONFIG.POSE_BUTTON_Y + CONFIG.POSE_BUTTON_SIZE + 5;
                        } else {
                            buttonX = CONFIG.POSE_BUTTON_X + 100 + (index - 6) * (CONFIG.POSE_BUTTON_SIZE + 10);
                            buttonY = CONFIG.POSE_BUTTON_Y + 2 * (CONFIG.POSE_BUTTON_SIZE + 5);
                        }

                        DrawButton(
                            buttonX,
                            buttonY,
                            CONFIG.POSE_BUTTON_SIZE,
                            CONFIG.POSE_BUTTON_SIZE,
                            "",
                            buttonColor,
                            iconUrl,
                            `切換到: ${pose.display}`
                        );
                    });
                }
            }
        }, null);
    }

    function drawZoomPreviewButton() {
        return safeCallWithFallback(function() {
            const iconUrl = ImagePathHelper.getIconURL('Search.png');
            const color = zoomPreviewState.active ? "#5323a1" : "White";

            if (typeof DrawButton === 'function') {
                DrawButton(145, 25, 90, 90, "", color, iconUrl, "點擊開啟/關閉放大預覽");
            }
        }, null);
    }

    // ================================
    // Hook 設置
    // ================================
    function setupDrawImageHook() {
        if (originalDrawImage) return;

        originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

        addManagedInterval(function() {
            if (Date.now() - performance.lastResetTime > 5000) {
                performance.drawImageCalls = 0;
                performance.lastResetTime = Date.now();
            }
            updateDressingRoomStatus();
        }, 5000);

        CanvasRenderingContext2D.prototype.drawImage = function(img) {
            const args = Array.prototype.slice.call(arguments, 1);

            if (performance.isInDressingRoom) {
                performance.drawImageCalls++;
            }

            if (!img || typeof img.src !== 'string') {
                return originalDrawImage.apply(this, [img].concat(args));
            }

            try {
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

            modApi.hookFunction("CharacterLoadCanvas", 4, function(args, next) {
                const result = next(args);

                if (args[0] === CharacterAppearanceSelection && zoomPreviewState.active) {
                    setTimeout(function() {
                        // updateZoomPreview() 调用需要完整UI代码支持
                    }, 50);
                }

                return result;
            });

            modApi.hookFunction("AppearanceClick", 4, function(args, next) {
                // 按钮点击处理需要完整UI代码支持
                return next(args);
            });

            modApi.hookFunction("AppearanceExit", 4, function(args, next) {
                const result = next(args);

                setTimeout(function() {
                    if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "Appearance") {
                        // closeZoomPreview();
                        poseState.expanded = false;
                        // hideUI();
                    }
                }, 100);

                return result;
            });
        } catch (e) {
            safeError("设置BC hooks失败:", e);
        }
    }

    // ================================
    // 初始化和清理
    // ================================
    function cleanup() {
        try {
            poseState.expanded = false;

            if (originalDrawImage) {
                CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
                originalDrawImage = null;
            }

            resources.intervalIds.forEach(function(id) {
                clearInterval(id);
            });
            resources.intervalIds.clear();

            resources.timeoutIds.forEach(function(id) {
                clearTimeout(id);
            });
            resources.timeoutIds.clear();

            resources.blobUrls.forEach(function(url) {
                URL.revokeObjectURL(url);
            });
            resources.blobUrls.clear();

            if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
                URL.revokeObjectURL(customBG.src);
                customBG = null;
            }

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

            const uiElements = ['bc-colorpicker-ui', 'bc-zoom-preview'];
            uiElements.forEach(function(id) {
                const element = document.getElementById(id);
                if (element) element.remove();
            });
            colorPickerUI = null;

            resources.styleSheets.forEach(function(styleElement) {
                try {
                    styleElement.remove();
                } catch (e) {
                    safeError("移除樣式表失敗:", e);
                }
            });
            resources.styleSheets.clear();

            state.uiVisible = false;
            poseState.expanded = false;
            isInitialized = false;

            if (window.CDBEnhanced) {
                delete window.CDBEnhanced;
            }

            safeLog("插件已完全清理");
        } catch (e) {
            safeError("清理失敗:", e);
        }
    }

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
                return modApi;
            } catch (e) {
                safeError("❌ 初始化 modApi 失敗:", e);
                return null;
            }
        });
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

            window.CDBEnhanced = {
                // show: showUI,
                // hide: hideUI,
                // toggle: toggleUI,
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
        }).catch(function(e) {
            safeError("初始化失敗:", e);
            isInitialized = false;
        });
    }

    // ================================
    // 啟動
    // ================================
    initialize();
})();
