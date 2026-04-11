// ==UserScript==
// @name         Liko - CDB
// @name:zh      Liko的自訂更衣室背景
// @namespace    https://likolisu.dev/
// @version      1.5.0
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
    // 語言工具
    // ================================
    const Lang = {
        _lang: null,

        get: function() {
            if (this._lang) return this._lang;

            const isZh = (l) => {
                if (!l) return false;
                l = l.toLowerCase();
                return l === 'tw' || l === 'cn' || l.startsWith('zh');
            };

            // 1️⃣ 遊戲語言（優先）
            try {
                if (typeof TranslationLanguage !== 'undefined') {
                    const l = TranslationLanguage.toLowerCase();

                    if (isZh(l)) return this._lang = 'zh';
                    if (l === 'en') return this._lang = 'en';

                    // 有值但不是 zh → 當英文
                    if (l) return this._lang = 'en';
                }
            } catch (e) {}

            // 2️⃣ 瀏覽器語言（fallback）
            try {
                const nav = (navigator.language || navigator.userLanguage || '').toLowerCase();

                if (isZh(nav)) return this._lang = 'zh';
            } catch (e) {}

            // 3️⃣ 預設
            return this._lang = 'en';
        },

        reset: function() { this._lang = null; },

        t: function(key) {
            const l = this.get();
            const dict = STRINGS[l] || STRINGS['en'];
            return dict[key] || STRINGS['en'][key] || key;
        }
    };

    const STRINGS = {
        zh: {
            title: '🎨 背景調色器',
            bgMode: '背景模式',
            disabled: '停用',
            solidBg: '素色背景',
            customBg: '自訂背景',
            bgColor: '背景顏色',
            gridSettings: '格線設定',
            gridLayer: '格線圖層',
            gridAbove: '人物上',
            gridBelow: '人物下',
            customBgImg: '自訂背景圖片',
            loadBg: '載入背景',
            bgUrlPlaceholder: '輸入圖片網址...',
            hue: '色相 (H)',
            sat: '飽和 (S)',
            val: '明度 (V)',
            opacity: '透明度',
            reset: '重置',
            save: '保存設定',
            saved: '已保存!',
            apply: '套用',
            pose: 'POSE',
            poseTooltip: '點擊展開/收起姿勢選單',
            mainBtnTooltip: '點擊開啟專業調色器',
            zoomTooltip: '點擊開啟/關閉放大預覽',
            zoomTitle: '🔍 放大預覽',
            zoom: '縮放',
            refresh: '重整',
            poses: [
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
        },
        en: {
            title: '🎨 Background Color Picker',
            bgMode: 'Background Mode',
            disabled: 'Disabled',
            solidBg: 'Solid Color',
            customBg: 'Custom Image',
            bgColor: 'Background Color',
            gridSettings: 'Grid Settings',
            gridLayer: 'Grid Layer',
            gridAbove: 'Above Character',
            gridBelow: 'Below Character',
            customBgImg: 'Custom Background Image',
            loadBg: 'Load Image',
            bgUrlPlaceholder: 'Enter image URL...',
            hue: 'Hue (H)',
            sat: 'Saturation (S)',
            val: 'Value (V)',
            opacity: 'Opacity',
            reset: 'Reset',
            save: 'Save Settings',
            saved: 'Saved!',
            apply: 'Apply',
            pose: 'POSE',
            poseTooltip: 'Click to expand/collapse pose menu',
            mainBtnTooltip: 'Click to open background color picker',
            zoomTooltip: 'Click to toggle zoom preview',
            zoomTitle: '🔍 Zoom Preview',
            zoom: 'Zoom',
            refresh: 'Refresh',
            poses: [
                { name: "BaseUpper", display: "Arms Relaxed" },
                { name: "Yoked", display: "Hands Raised" },
                { name: "OverTheHead", display: "Hands Over Head" },
                { name: "BackBoxTie", display: "Box Tie" },
                { name: "BackElbowTouch", display: "Elbow Touch" },
                { name: "BackCuffs", display: "Back Cuffs" },
                { name: "BaseLower", display: "Standing" },
                { name: "LegsClosed", display: "Legs Closed" },
                { name: "Kneel", display: "Kneeling" },
                { name: "KneelingSpread", display: "Kneeling Spread" },
                { name: "AllFours", display: "All Fours" }
            ]
        }
    };

    // ================================
    // 常量配置
    // ================================
    const IconPathHelper = {
        _cachedBasePath: null,
        _cachedIconsPath: null,

        getBasePath: function() {
            if (this._cachedBasePath) return this._cachedBasePath;
            let href = window.location.href;
            if (!href.endsWith('/')) {
                href = href.substring(0, href.lastIndexOf('/') + 1);
            }
            this._cachedBasePath = href;
            return href;
        },

        getIconsPath: function() {
            if (this._cachedIconsPath) return this._cachedIconsPath;
            this._cachedIconsPath = this.getBasePath() + 'Icons/';
            return this._cachedIconsPath;
        },

        clearCache: function() {
            this._cachedBasePath = null;
            this._cachedIconsPath = null;
        }
    };

    const CONFIG = {
        VERSION: "1.5.0",
        DEFAULT_BG_URL: "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg",

        BUTTON_X: 600,
        BUTTON_Y: 25,
        BUTTON_SIZE: 90,
        POSE_BUTTON_X: 30,
        POSE_BUTTON_Y: 25,
        POSE_BUTTON_SIZE: 90,
        ZOOM_BUTTON_X: 145,
        ZOOM_BUTTON_Y: 25,
        ZOOM_BUTTON_SIZE: 90,

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

        get POSES() { return Lang.t('poses'); },

        getIconsPath: function() { return IconPathHelper.getIconsPath(); },
        getPoseIconURL: function(poseName) { return this.getIconsPath() + 'Poses/' + poseName + '.png'; },
        getIconURL: function(iconName) { return this.getIconsPath() + iconName + '.png'; }
    };

    // ================================
    // 全局變量
    // ================================
    let modApi = null;
    let customBG = null;
    let originalDrawImage = null;
    let colorPickerUI = null;
    let isInitialized = false;

    const state = {
        currentMode: 'disabled',
        bgColor: '#87CEEB',
        customBgUrl: CONFIG.DEFAULT_BG_URL,
        gridMode: 'disabled',
        gridLayer: 'below',
        gridColor: '#FFFFFF',
        gridOpacity: 0.5,
        uiVisible: false,
        currentPoseIndex: 0,
        lastPoseChangeTime: 0
    };

    const poseState = {
        expanded: false,
        enabled: true
    };

    const zoomPreviewState = {
        active: false,
        zoom: 1.5,
        windowX: null,
        windowY: null,
        isDragging: false,
        lastMouseX: 0,
        lastMouseY: 0,
        isDraggingWindow: false,
        savedScrollTop: null,
        savedScrollLeft: null
    };

    const performance = {
        drawImageCalls: 0,
        drawImageErrors: 0,
        lastDrawTime: 0,
        lastResetTime: Date.now(),
        isInDressingRoom: false
    };

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
        try { console.log('[CDB] ' + message); } catch (e) {}
    }

    function safeError(message, error) {
        try { console.error('❌ [CDB] ' + message, error); } catch (e) {}
    }

    function safeCall(fn, fallbackValue) {
        try { return fn(); } catch (e) {
            safeError("safeCall failed:", e);
            return (fallbackValue !== undefined) ? fallbackValue : undefined;
        }
    }

    function addManagedEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        const key = (element.id || element.className || 'anonymous') + '_' + event;
        if (!resources.eventListeners.has(key)) resources.eventListeners.set(key, []);
        resources.eventListeners.get(key).push({ element, event, handler, options });
    }

    function createManagedBlobUrl(blob) {
        const url = URL.createObjectURL(blob);
        resources.blobUrls.add(url);
        return url;
    }

    function addManagedStyleSheet(styleElement) { resources.styleSheets.add(styleElement); }

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
    // ExtensionSettings 集成
    // ================================
    function loadFromOnlineSettings() {
        try {
            if (typeof Player !== 'undefined' && Player.ExtensionSettings && Player.ExtensionSettings.CDBEnhanced) {
                const saved = Player.ExtensionSettings.CDBEnhanced;
                state.currentMode = saved.currentMode || state.currentMode;
                state.bgColor = saved.bgColor || state.bgColor;
                state.customBgUrl = saved.customBgUrl || state.customBgUrl;
                state.gridMode = saved.gridMode || state.gridMode;
                state.gridLayer = saved.gridLayer || state.gridLayer;
                state.gridColor = saved.gridColor || state.gridColor;
                state.gridOpacity = saved.gridOpacity !== undefined ? saved.gridOpacity : state.gridOpacity;
                poseState.enabled = saved.poseChangerEnabled !== undefined ? saved.poseChangerEnabled : poseState.enabled;
                state.currentPoseIndex = saved.currentPoseIndex || 0;
                safeLog("已從ExtensionSettings載入設定");
                Lang.reset();
                return true;
            }
        } catch (e) { safeError("載入ExtensionSettings失敗:", e); }
        return false;
    }

    function saveToOnlineSettings() {
        try {
            if (typeof Player !== 'undefined' && Player.ExtensionSettings) {
                Player.ExtensionSettings.CDBEnhanced = {
                    currentMode: state.currentMode,
                    bgColor: state.bgColor,
                    customBgUrl: state.customBgUrl,
                    gridMode: state.gridMode,
                    gridLayer: state.gridLayer,
                    gridColor: state.gridColor,
                    gridOpacity: state.gridOpacity,
                    poseChangerEnabled: poseState.enabled,
                    currentPoseIndex: state.currentPoseIndex,
                    version: CONFIG.VERSION
                };
                if (typeof ServerPlayerExtensionSettingsSync === 'function') {
                    ServerPlayerExtensionSettingsSync("CDBEnhanced");
                }
            }
        } catch (e) { safeError("保存到ExtensionSettings失敗:", e); }
    }

    // ================================
    // 姿勢更換功能
    // ================================
    function changePose(poseIndex) {
        const now = Date.now();
        try {
            if (typeof CharacterSetActivePose === 'undefined') { safeError("CharacterSetActivePose不存在"); return false; }

            let target = Player;
            try {
                if (typeof CharacterAppearanceSelection !== 'undefined' && CharacterAppearanceSelection) {
                    if (CharacterAppearanceSelection.Name && typeof CharacterAppearanceSelection.MemberNumber !== 'undefined') {
                        target = CharacterAppearanceSelection;
                    } else if (typeof ChatRoomCharacter !== 'undefined' && Array.isArray(ChatRoomCharacter)) {
                        const found = ChatRoomCharacter.find(function(c) {
                            return c && (c.MemberNumber === CharacterAppearanceSelection || c === CharacterAppearanceSelection);
                        });
                        if (found) target = found;
                    }
                }
            } catch (e) { safeError("獲取目標角色失敗:", e); }

            const poses = CONFIG.POSES;
            if (poseIndex !== null && poseIndex !== undefined) {
                if (poseIndex >= 0 && poseIndex < poses.length) {
                    state.currentPoseIndex = poseIndex;
                } else { safeError("無效的姿勢索引: " + poseIndex); return false; }
            } else {
                state.currentPoseIndex = (state.currentPoseIndex + 1) % poses.length;
            }

            if (state.currentPoseIndex >= poses.length || state.currentPoseIndex < 0) state.currentPoseIndex = 0;

            const pose = poses[state.currentPoseIndex];
            if (!pose || !pose.name) { state.currentPoseIndex = 0; return false; }

            CharacterSetActivePose(target, pose.name);
            if (typeof CharacterRefresh !== 'undefined') CharacterRefresh(target);
            if (typeof ChatRoomCharacterUpdate !== 'undefined' && typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatRoom") {
                ChatRoomCharacterUpdate(target);
            }
            state.lastPoseChangeTime = now;
            saveToOnlineSettings();
            return true;
        } catch (e) { safeError("姿勢更換失敗:", e); state.currentPoseIndex = 0; return false; }
    }

    // ================================
    // 等待函數
    // ================================
    function waitForBcModSdk(timeout) {
        timeout = timeout || CONFIG.TIMEOUTS.BC_MOD_SDK;
        const start = Date.now();
        return new Promise(function(resolve) {
            function check() {
                if (typeof bcModSdk !== 'undefined' && bcModSdk && bcModSdk.registerMod) { resolve(true); }
                else if (Date.now() - start > timeout) { safeError("bcModSdk 載入超時"); resolve(false); }
                else { addManagedTimeout(check, 100); }
            }
            check();
        });
    }

    function waitForGame(timeout) {
        timeout = timeout || CONFIG.TIMEOUTS.GAME_LOAD;
        const start = Date.now();
        return new Promise(function(resolve) {
            function check() {
                if (typeof CurrentScreen !== 'undefined' && typeof DrawButton === 'function' && typeof Player !== 'undefined') { resolve(true); }
                else if (Date.now() - start > timeout) { safeError("遊戲載入超時"); resolve(false); }
                else { addManagedTimeout(check, 100); }
            }
            check();
        });
    }

    // ================================
    // 顏色轉換函數
    // ================================
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
    }

    function hexToHsv(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min;
        let h = 0;
        if (diff !== 0) {
            if (max === r) h = 60 * (((g - b) / diff) % 6);
            else if (max === g) h = 60 * ((b - r) / diff + 2);
            else h = 60 * ((r - g) / diff + 4);
        }
        if (h < 0) h += 360;
        return { h: Math.round(h), s: Math.round((max === 0 ? 0 : diff / max) * 100), v: Math.round(max * 100) };
    }

    function hsvToHex(h, s, v) {
        s /= 100; v /= 100;
        const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
        let r, g, b;
        if (h < 60) { r = c; g = x; b = 0; }
        else if (h < 120) { r = x; g = c; b = 0; }
        else if (h < 180) { r = 0; g = c; b = x; }
        else if (h < 240) { r = 0; g = x; b = c; }
        else if (h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }
        r = Math.round((r + m) * 255); g = Math.round((g + m) * 255); b = Math.round((b + m) * 255);
        return "#" + [r, g, b].map(function(x) { return x.toString(16).padStart(2, '0'); }).join('');
    }

    // ================================
    // 檢測函數
    // ================================
    function isMainAppearanceMode() {
        try {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "Appearance") return false;
            if (typeof CharacterAppearanceMode !== 'undefined' && CharacterAppearanceMode && CharacterAppearanceMode !== "") return false;
            if (typeof CurrentModule !== 'undefined' && CurrentModule === "Wardrobe") return false;
            return true;
        } catch (e) { return false; }
    }

    function isInAppearanceScreen() {
        try { return typeof CurrentScreen !== 'undefined' && CurrentScreen === "Appearance"; } catch (e) { return false; }
    }

    function updateDressingRoomStatus() {
        const wasIn = performance.isInDressingRoom;
        performance.isInDressingRoom = isInAppearanceScreen();
        if (!performance.isInDressingRoom && wasIn) {
            poseState.expanded = false;
            performance.drawImageCalls = 0;
            performance.lastResetTime = Date.now();
        }
        return performance.isInDressingRoom;
    }

    // ================================
    // 資源管理：載入自訂背景
    // ================================
    function loadCustomBackground(url) {
        url = url || state.customBgUrl;
        if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
            URL.revokeObjectURL(customBG.src);
            resources.blobUrls.delete(customBG.src);
        }
        return fetch(url)
            .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
            .then(function(blob) {
            return new Promise(function(resolve, reject) {
                const img = new Image();
                const blobUrl = createManagedBlobUrl(blob);
                img.onload = function() { customBG = img; resolve(img); };
                img.onerror = function() { URL.revokeObjectURL(blobUrl); resources.blobUrls.delete(blobUrl); reject(new Error("圖片載入失敗")); };
                img.src = blobUrl;
            });
        })
            .catch(function(e) { safeError("背景載入失敗:", e); return null; });
    }

    // ================================
    // UI 創建和管理
    // ================================
    function createColorPickerUI() {
        if (colorPickerUI) return colorPickerUI;

        const T = function(key) { return Lang.t(key); };

        const uiHTML = [
            '<div id="bc-colorpicker-ui" style="',
            'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:390px;',
            'background:rgba(30,30,30,0.95);border:2px solid rgba(83,35,161,0.6);',
            'border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.1);',
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
            'z-index:' + CONFIG.Z_INDEX.UI + ';display:none;',
            'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
            'user-select:none;-webkit-user-select:none;pointer-events:auto;isolation:isolate;">',

            '<div style="background:linear-gradient(135deg,#5323a1 0%,#7b2cbf 50%,#9d4edd 100%);color:white;',
            'padding:8px 10px;border-radius:14px 14px 0 0;display:flex;justify-content:space-between;',
            'align-items:center;font-weight:700;font-size:18px;text-shadow:0 2px 4px rgba(0,0,0,0.3);',
            'cursor:move;">',
            '<span>' + T('title') + '</span>',
            '<button id="bc-close-btn" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);',
            'color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;">×</button>',
            '</div>',

            '<div style="padding:16px;background:rgba(0,0,0,0.05);border-radius:0 0 14px 14px;max-height:80vh;overflow-y:auto;">',

            // 背景模式
            '<div style="margin-bottom:20px;">',
            '<h3 style="color:#fff;margin:0 0 12px 0;font-size:14px;font-weight:600;">' + T('bgMode') + '</h3>',
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">',
            '<button class="bc-mode-btn" data-mode="disabled">' + T('disabled') + '</button>',
            '<button class="bc-mode-btn" data-mode="solid">' + T('solidBg') + '</button>',
            '<button class="bc-mode-btn" data-mode="custom">' + T('customBg') + '</button>',
            '</div></div>',

            // 背景顏色
            '<div style="margin-bottom:20px;">',
            '<h3 style="color:#fff;margin:0 0 12px 0;font-size:14px;font-weight:600;">' + T('bgColor') + '</h3>',
            '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">',
            '<input type="color" id="bc-bg-color" value="' + state.bgColor + '" style="width:50px;height:35px;border:none;border-radius:6px;cursor:pointer;">',
            '<input type="text" id="bc-bg-color-text" value="' + state.bgColor + '" style="background:#444;border:1px solid #666;color:#fff;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:12px;width:80px;">',
            '</div>',
            '<div style="margin-top:16px;">',
            '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px;">',
            '<label style="color:#ccc;font-size:12px;white-space:nowrap;width:70px;text-align:right;">' + T('hue') + ': <span id="bc-h-value">0</span>°</label>',
            '<input type="range" id="bc-h-slider" min="0" max="360" value="0" style="flex:1;height:8px;border-radius:4px;background:linear-gradient(to right,#ff0000 0%,#ffff00 17%,#00ff00 33%,#00ffff 50%,#0000ff 67%,#ff00ff 83%,#ff0000 100%);outline:none;-webkit-appearance:none;">',
            '</div>',
            '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px;">',
            '<label style="color:#ccc;font-size:12px;white-space:nowrap;width:70px;text-align:right;">' + T('sat') + ': <span id="bc-s-value">0</span>%</label>',
            '<input type="range" id="bc-s-slider" min="0" max="100" value="0" style="flex:1;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;">',
            '</div>',
            '<div style="margin-bottom:12px;display:flex;align-items:center;gap:12px;">',
            '<label style="color:#ccc;font-size:12px;white-space:nowrap;width:70px;text-align:right;">' + T('val') + ': <span id="bc-v-value">0</span>%</label>',
            '<input type="range" id="bc-v-slider" min="0" max="100" value="0" style="flex:1;height:8px;border-radius:4px;outline:none;-webkit-appearance:none;">',
            '</div></div>',
            '<div style="margin-top:14px;"><div id="bc-preset-colors" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div>',
            '</div>',

            // 格線設定
            '<div style="margin-bottom:20px;">',
            '<h3 style="color:#fff;margin:0 0 12px 0;font-size:14px;font-weight:600;">' + T('gridSettings') + '</h3>',
            '<div style="display:flex;gap:8px;margin-bottom:12px;">',
            '<button class="bc-grid-btn" data-grid="disabled">' + T('disabled') + '</button>',
            '<button class="bc-grid-btn" data-grid="grid10">10px</button>',
            '<button class="bc-grid-btn" data-grid="grid25">25px</button>',
            '<button class="bc-grid-btn" data-grid="grid50">50px</button>',
            '</div>',
            '<div style="margin-bottom:12px;">',
            '<label style="color:#ccc;font-size:12px;display:block;margin-bottom:6px;">' + T('gridLayer') + '</label>',
            '<div style="display:flex;gap:8px;">',
            '<button class="bc-layer-btn" data-layer="below">' + T('gridBelow') + '</button>',
            '<button class="bc-layer-btn" data-layer="above">' + T('gridAbove') + '</button>',
            '</div></div>',
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">',
            '<input type="color" id="bc-grid-color" value="' + state.gridColor + '" style="width:40px;height:30px;border:none;border-radius:4px;cursor:pointer;">',
            '<input type="text" id="bc-grid-color-text" value="' + state.gridColor + '" style="background:#444;border:1px solid #666;color:#fff;padding:6px 8px;border-radius:4px;font-family:monospace;font-size:11px;width:65px;">',
            '</div>',
            '<div style="display:flex;align-items:center;gap:12px;">',
            '<label style="color:#ccc;font-size:12px;white-space:nowrap;width:70px;">' + T('opacity') + ': <span id="bc-opacity-value">50</span>%</label>',
            '<input type="range" id="bc-opacity-slider" min="0" max="100" value="50" style="flex:1;height:6px;border-radius:3px;background:linear-gradient(to right,transparent,white);outline:none;-webkit-appearance:none;">',
            '</div></div>',

            // 自訂背景圖片
            '<div style="margin-bottom:20px;">',
            '<h3 style="color:#fff;margin:0 0 12px 0;font-size:14px;font-weight:600;">' + T('customBgImg') + '</h3>',
            '<div style="display:flex;gap:8px;align-items:center;">',
            '<input type="text" id="bc-custom-url" value="' + state.customBgUrl + '" placeholder="' + T('bgUrlPlaceholder') + '" ',
            'style="flex:1;background:#444;border:1px solid #666;color:#fff;padding:8px 12px;border-radius:6px;font-size:12px;box-sizing:border-box;">',
            '<button id="bc-load-custom" style="background:#2196F3;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap;">' + T('loadBg') + '</button>',
            '</div></div>',

            // 底部按鈕
            '<div style="display:flex;gap:12px;justify-content:flex-end;">',
            '<button id="bc-reset-btn" style="background:#f44336;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:12px;">' + T('reset') + '</button>',
            '<button id="bc-save-btn" style="background:#4CAF50;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:12px;">' + T('save') + '</button>',
            '<button id="bc-apply-btn" style="background:#2196F3;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:12px;">' + T('apply') + '</button>',
            '</div>',
            '</div></div>'
        ].join('');

        document.body.insertAdjacentHTML('beforeend', uiHTML);
        colorPickerUI = document.getElementById('bc-colorpicker-ui');

        createStyleSheet();
        setupUIEvents();
        createPresetColors();
        updateUIState();
        makeDraggable(colorPickerUI, colorPickerUI.querySelector('div'));

        return colorPickerUI;
    }

    function makeDraggable(panel, handle) {
        let isDragging = false, startX, startY, origLeft, origTop;
        handle.addEventListener('mousedown', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            origLeft = rect.left;
            origTop = rect.top;
            startX = e.clientX;
            startY = e.clientY;
            panel.style.transform = 'none';
            panel.style.left = origLeft + 'px';
            panel.style.top = origTop + 'px';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            panel.style.left = (origLeft + e.clientX - startX) + 'px';
            panel.style.top  = (origTop  + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', function() { isDragging = false; });
    }

    function createStyleSheet() {
        const style = document.createElement('style');
        style.setAttribute('data-bc-colorpicker', 'true');
        style.textContent = [
            '#bc-colorpicker-ui * { user-select:none;-webkit-user-select:none; }',
            '.bc-mode-btn,.bc-grid-btn,.bc-layer-btn { padding:10px 18px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;transition:all .3s; }',
            '.bc-mode-btn.active,.bc-grid-btn.active,.bc-layer-btn.active { background:rgba(83,35,161,0.8);border-color:rgba(157,78,221,0.6);box-shadow:0 0 20px rgba(83,35,161,0.4);transform:translateY(-1px); }',
            '.bc-mode-btn:hover,.bc-grid-btn:hover,.bc-layer-btn:hover { background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.4);transform:translateY(-1px); }',
            '#bc-close-btn:hover { background:rgba(255,255,255,0.25);transform:scale(1.1); }',
            '#bc-colorpicker-ui input[type="range"]::-webkit-slider-track { height:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.3); }',
            '#bc-colorpicker-ui input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#5323a1,#9d4edd);border:2px solid rgba(255,255,255,0.8);cursor:pointer;box-shadow:0 3px 8px rgba(0,0,0,0.3); }',
            '.bc-preset-color { width:32px;height:32px;border-radius:6px;cursor:pointer;border:2px solid rgba(255,255,255,0.2);transition:all .3s; }',
            '.bc-preset-color:hover { border-color:rgba(255,255,255,0.8);transform:scale(1.15); }'
        ].join('');
        document.head.appendChild(style);
        addManagedStyleSheet(style);
    }

    function createPresetColors() {
        const container = document.getElementById('bc-preset-colors');
        if (!container) return;
        container.innerHTML = '';
        CONFIG.PRESET_COLORS.forEach(function(color) {
            const d = document.createElement('div');
            d.className = 'bc-preset-color';
            d.style.backgroundColor = color;
            d.title = color;
            addManagedEventListener(d, 'click', function() { setBgColor(color); });
            container.appendChild(d);
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

    function toggleUI() { if (state.uiVisible) hideUI(); else showUI(); }

    function setupUIEvents() {
        const closeBtn = document.getElementById('bc-close-btn');
        if (closeBtn) addManagedEventListener(closeBtn, 'click', hideUI);

        document.querySelectorAll('.bc-mode-btn').forEach(function(btn) {
            addManagedEventListener(btn, 'click', function() {
                setMode(btn.getAttribute('data-mode'));
                updateUIState();
                saveToOnlineSettings();
                // FIX 3：模式改變時立即更新放大鏡
                if (zoomPreviewState.active) updateZoomPreview(true);
            });
        });

        document.querySelectorAll('.bc-grid-btn').forEach(function(btn) {
            addManagedEventListener(btn, 'click', function() {
                state.gridMode = btn.getAttribute('data-grid');
                updateUIState();
                saveToOnlineSettings();
                // FIX 3：格線改變時立即更新放大鏡
                if (zoomPreviewState.active) updateZoomPreview(true);
            });
        });

        document.querySelectorAll('.bc-layer-btn').forEach(function(btn) {
            addManagedEventListener(btn, 'click', function() {
                state.gridLayer = btn.getAttribute('data-layer');
                updateUIState();
                saveToOnlineSettings();
                // FIX 3：圖層改變時立即更新放大鏡
                if (zoomPreviewState.active) updateZoomPreview(true);
            });
        });

        const bgColorInput = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');
        if (bgColorInput) addManagedEventListener(bgColorInput, 'input', function(e) {
            setBgColor(e.target.value);
            saveToOnlineSettings();
            // FIX 3：顏色拖動時即時更新放大鏡
            if (zoomPreviewState.active) updateZoomPreview(true);
        });
        if (bgColorText) {
            addManagedEventListener(bgColorText, 'input', function(e) {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setBgColor(e.target.value);
                    saveToOnlineSettings();
                    if (zoomPreviewState.active) updateZoomPreview(true);
                }
            });
            addManagedEventListener(bgColorText, 'blur', function(e) {
                if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) e.target.value = state.bgColor;
            });
        }

        setupHSVSliders();

        const gridColorInput = document.getElementById('bc-grid-color');
        const gridColorText = document.getElementById('bc-grid-color-text');
        if (gridColorInput) addManagedEventListener(gridColorInput, 'input', function(e) {
            state.gridColor = e.target.value;
            if (gridColorText) gridColorText.value = e.target.value;
            saveToOnlineSettings();
            if (zoomPreviewState.active) updateZoomPreview(true);
        });
        if (gridColorText) {
            addManagedEventListener(gridColorText, 'input', function(e) {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    state.gridColor = e.target.value;
                    if (gridColorInput) gridColorInput.value = e.target.value;
                    saveToOnlineSettings();
                    if (zoomPreviewState.active) updateZoomPreview(true);
                }
            });
            addManagedEventListener(gridColorText, 'blur', function(e) {
                if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) e.target.value = state.gridColor;
            });
        }

        const opacitySlider = document.getElementById('bc-opacity-slider');
        if (opacitySlider) addManagedEventListener(opacitySlider, 'input', function(e) {
            state.gridOpacity = e.target.value / 100;
            const opacityValue = document.getElementById('bc-opacity-value');
            if (opacityValue) opacityValue.textContent = e.target.value;
            saveToOnlineSettings();
            if (zoomPreviewState.active) updateZoomPreview(true);
        });

        const loadCustomBtn = document.getElementById('bc-load-custom');
        if (loadCustomBtn) addManagedEventListener(loadCustomBtn, 'click', function() {
            const urlInput = document.getElementById('bc-custom-url');
            if (urlInput && urlInput.value) {
                state.customBgUrl = urlInput.value;
                loadCustomBackground(urlInput.value).then(function() {
                    setMode('custom');
                    updateUIState();
                    saveToOnlineSettings();
                    // FIX 3：載入新圖片後立即更新放大鏡
                    if (zoomPreviewState.active) updateZoomPreview(false);
                });
            }
        });

        const resetBtn = document.getElementById('bc-reset-btn');
        const saveBtn = document.getElementById('bc-save-btn');
        const applyBtn = document.getElementById('bc-apply-btn');
        if (resetBtn) addManagedEventListener(resetBtn, 'click', resetSettings);
        if (saveBtn) addManagedEventListener(saveBtn, 'click', function() {
            saveToOnlineSettings();
            const orig = saveBtn.textContent;
            saveBtn.textContent = Lang.t('saved');
            addManagedTimeout(function() { saveBtn.textContent = orig; }, 1500);
        });
        if (applyBtn) addManagedEventListener(applyBtn, 'click', hideUI);
    }

    function setupHSVSliders() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');
        const hValue = document.getElementById('bc-h-value');
        const sValue = document.getElementById('bc-s-value');
        const vValue = document.getElementById('bc-v-value');
        if (hSlider && hValue) addManagedEventListener(hSlider, 'input', function(e) {
            hValue.textContent = e.target.value;
            updateColorFromHSV();
            saveToOnlineSettings();
            if (zoomPreviewState.active) updateZoomPreview(true);
        });
        if (sSlider && sValue) addManagedEventListener(sSlider, 'input', function(e) {
            sValue.textContent = e.target.value;
            updateSaturationSliderBg();
            updateColorFromHSV();
            saveToOnlineSettings();
            if (zoomPreviewState.active) updateZoomPreview(true);
        });
        if (vSlider && vValue) addManagedEventListener(vSlider, 'input', function(e) {
            vValue.textContent = e.target.value;
            updateValueSliderBg();
            updateColorFromHSV();
            saveToOnlineSettings();
            if (zoomPreviewState.active) updateZoomPreview(true);
        });
    }

    // ================================
    // 狀態管理
    // ================================
    function setBgColor(color) {
        state.bgColor = color;
        const hsv = hexToHsv(color);
        const ids = { bgColor:'bc-bg-color', bgColorText:'bc-bg-color-text', hSlider:'bc-h-slider', sSlider:'bc-s-slider', vSlider:'bc-v-slider', hValue:'bc-h-value', sValue:'bc-s-value', vValue:'bc-v-value' };
        Object.keys(ids).forEach(function(k) {
            const el = document.getElementById(ids[k]);
            if (!el) return;
            if (k === 'bgColor' || k === 'bgColorText') el.value = color;
            else if (k === 'hSlider' || k === 'hValue') el[el.tagName === 'INPUT' ? 'value' : 'textContent'] = hsv.h;
            else if (k === 'sSlider' || k === 'sValue') el[el.tagName === 'INPUT' ? 'value' : 'textContent'] = hsv.s;
            else if (k === 'vSlider' || k === 'vValue') el[el.tagName === 'INPUT' ? 'value' : 'textContent'] = hsv.v;
        });
        updateSaturationSliderBg();
        updateValueSliderBg();
        if (state.currentMode !== 'solid') setMode('solid');
    }

    function updateColorFromHSV() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');
        if (!hSlider || !sSlider || !vSlider) return;
        const hex = hsvToHex(parseInt(hSlider.value), parseInt(sSlider.value), parseInt(vSlider.value));
        state.bgColor = hex;
        const bgColor = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');
        if (bgColor) bgColor.value = hex;
        if (bgColorText) bgColorText.value = hex;
        if (state.currentMode !== 'solid') setMode('solid');
    }

    function updateSaturationSliderBg() {
        const h = document.getElementById('bc-h-slider');
        const v = document.getElementById('bc-v-slider');
        const s = document.getElementById('bc-s-slider');
        if (!h || !v || !s) return;
        s.style.background = 'linear-gradient(to right,' + hsvToHex(h.value, 0, v.value) + ',' + hsvToHex(h.value, 100, v.value) + ')';
        s.style.border = '1px solid rgba(255,255,255,0.3)';
        s.style.borderRadius = '4px';
    }

    function updateValueSliderBg() {
        const h = document.getElementById('bc-h-slider');
        const s = document.getElementById('bc-s-slider');
        const v = document.getElementById('bc-v-slider');
        if (!h || !s || !v) return;
        v.style.background = 'linear-gradient(to right,' + hsvToHex(h.value, s.value, 0) + ',' + hsvToHex(h.value, s.value, 100) + ')';
        v.style.border = '1px solid rgba(255,255,255,0.3)';
        v.style.borderRadius = '4px';
    }

    function setMode(mode) {
        state.currentMode = mode;
        if (mode === 'custom' && !customBG) loadCustomBackground();
    }

    function updateUIState() {
        document.querySelectorAll('.bc-mode-btn').forEach(function(btn) { btn.classList.toggle('active', btn.getAttribute('data-mode') === state.currentMode); });
        document.querySelectorAll('.bc-grid-btn').forEach(function(btn) { btn.classList.toggle('active', btn.getAttribute('data-grid') === state.gridMode); });
        document.querySelectorAll('.bc-layer-btn').forEach(function(btn) { btn.classList.toggle('active', btn.getAttribute('data-layer') === state.gridLayer); });

        const gc = document.getElementById('bc-grid-color');
        const gt = document.getElementById('bc-grid-color-text');
        const os = document.getElementById('bc-opacity-slider');
        const ov = document.getElementById('bc-opacity-value');
        const cu = document.getElementById('bc-custom-url');
        if (gc) gc.value = state.gridColor;
        if (gt) gt.value = state.gridColor;
        if (os) os.value = Math.round(state.gridOpacity * 100);
        if (ov) ov.textContent = Math.round(state.gridOpacity * 100);
        if (cu) cu.value = state.customBgUrl;
    }

    function resetSettings() {
        state.currentMode = 'disabled';
        state.bgColor = '#87CEEB';
        state.gridMode = 'disabled';
        state.gridLayer = 'below';
        state.gridColor = '#FFFFFF';
        state.gridOpacity = 0.5;
        state.customBgUrl = CONFIG.DEFAULT_BG_URL;
        poseState.enabled = true;
        state.currentPoseIndex = 0;
        setBgColor(state.bgColor);
        updateUIState();
        saveToOnlineSettings();
        if (zoomPreviewState.active) updateZoomPreview(true);
    }

    // ================================
    // 姿勢按鈕繪製
    // ================================
    function drawPoseButtons() {
        if (!poseState.enabled) return;
        if (typeof DrawButton !== 'function') return;
        const color = poseState.expanded ? "#5323a1" : "White";
        DrawButton(CONFIG.POSE_BUTTON_X, CONFIG.POSE_BUTTON_Y, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE, Lang.t('pose'), color, "", Lang.t('poseTooltip'));

        if (poseState.expanded) {
            const poses = CONFIG.POSES;
            poses.forEach(function(pose, index) {
                let bx, by;
                if (index < 6) {
                    bx = CONFIG.POSE_BUTTON_X + index * (CONFIG.POSE_BUTTON_SIZE + 10);
                    by = CONFIG.POSE_BUTTON_Y + CONFIG.POSE_BUTTON_SIZE + 5;
                } else {
                    bx = CONFIG.POSE_BUTTON_X + 100 + (index - 6) * (CONFIG.POSE_BUTTON_SIZE + 10);
                    by = CONFIG.POSE_BUTTON_Y + 2 * (CONFIG.POSE_BUTTON_SIZE + 5);
                }
                DrawButton(bx, by, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE, "", "White", CONFIG.getPoseIconURL(pose.name), pose.display);
            });
        }
    }

    function handlePoseButtonsClick() {
        if (!poseState.enabled || typeof MouseIn !== 'function') return false;
        if (MouseIn(CONFIG.POSE_BUTTON_X, CONFIG.POSE_BUTTON_Y, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE)) {
            poseState.expanded = !poseState.expanded;
            return true;
        }
        if (poseState.expanded) {
            const poses = CONFIG.POSES;
            for (let i = 0; i < poses.length; i++) {
                let bx, by;
                if (i < 6) {
                    bx = CONFIG.POSE_BUTTON_X + i * (CONFIG.POSE_BUTTON_SIZE + 10);
                    by = CONFIG.POSE_BUTTON_Y + CONFIG.POSE_BUTTON_SIZE + 5;
                } else {
                    bx = CONFIG.POSE_BUTTON_X + 100 + (i - 6) * (CONFIG.POSE_BUTTON_SIZE + 10);
                    by = CONFIG.POSE_BUTTON_Y + 2 * (CONFIG.POSE_BUTTON_SIZE + 5);
                }
                if (MouseIn(bx, by, CONFIG.POSE_BUTTON_SIZE, CONFIG.POSE_BUTTON_SIZE)) {
                    if (changePose(i)) poseState.expanded = false;
                    return true;
                }
            }
        }
        return false;
    }

    // ================================
    // 格線繪製
    // ================================
    function drawGrid(ctx, canvas, forceLayer) {
        const targetLayer = forceLayer || state.gridLayer;
        if (state.gridMode === 'disabled' || state.currentMode === 'disabled') return;
        const spacing = CONFIG.GRID_SPACING[state.gridMode];
        if (!spacing) return;
        try {
            ctx.save();
            const rgb = hexToRgb(state.gridColor);
            if (!rgb) { ctx.restore(); return; }
            const color = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + state.gridOpacity + ')';
            const thickColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + Math.min(1, state.gridOpacity + 0.3) + ')';

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.setLineDash([]);

            for (let x = 0; x < canvas.width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
            for (let y = 0; y < canvas.height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

            if (spacing < 50) {
                ctx.strokeStyle = thickColor;
                ctx.lineWidth = 2;
                for (let x = 0; x < canvas.width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
                for (let y = 0; y < canvas.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
            }
            ctx.restore();
        } catch (e) { safeError("繪製格線失敗:", e); try { ctx.restore(); } catch(_) {} }
    }

    // ================================
    // 按鈕繪製
    // ================================
    function drawMainButton() {
        if (typeof DrawButton !== 'function') return;
        const color = state.uiVisible ? "#5323a1" : (state.currentMode === 'disabled' ? "White" : "#5323a1");
        DrawButton(CONFIG.BUTTON_X, CONFIG.BUTTON_Y, CONFIG.BUTTON_SIZE, CONFIG.BUTTON_SIZE, "", color, CONFIG.getIconURL('Extensions'), Lang.t('mainBtnTooltip'));
    }

    function handleMainButtonClick() {
        if (typeof MouseIn !== 'function') return false;
        if (MouseIn(CONFIG.BUTTON_X, CONFIG.BUTTON_Y, CONFIG.BUTTON_SIZE, CONFIG.BUTTON_SIZE)) {
            toggleUI();
            return true;
        }
        return false;
    }

    function drawZoomPreviewButton() {
        if (typeof DrawButton !== 'function') return;
        const color = zoomPreviewState.active ? "#5323a1" : "White";
        DrawButton(CONFIG.ZOOM_BUTTON_X, CONFIG.ZOOM_BUTTON_Y, CONFIG.ZOOM_BUTTON_SIZE, CONFIG.ZOOM_BUTTON_SIZE, "", color, CONFIG.getIconURL('Search'), Lang.t('zoomTooltip'));
    }

    function handleZoomPreviewButtonClick() {
        if (typeof MouseIn !== 'function') return false;
        if (MouseIn(CONFIG.ZOOM_BUTTON_X, CONFIG.ZOOM_BUTTON_Y, CONFIG.ZOOM_BUTTON_SIZE, CONFIG.ZOOM_BUTTON_SIZE)) {
            if (zoomPreviewState.active) closeZoomPreview();
            else openZoomPreview();
            return true;
        }
        return false;
    }

    // ================================
    // 放大鏡 UI
    // ================================
    function createZoomPreviewUI() {
        const T = function(key) { return Lang.t(key); };
        const uiHTML = [
            '<div id="bc-zoom-preview" style="position:fixed !important;top:10% !important;left:1% !important;right:auto !important;',
            'width:40%;height:89.5%;background:rgba(30,30,30,0.95);border:2px solid rgba(83,35,161,0.6);',
            'border-radius:16px;box-shadow:0 15px 35px rgba(0,0,0,0.3);z-index:' + CONFIG.Z_INDEX.UI + ';',
            'display:none;backdrop-filter:blur(20px);">',
            '<div id="bc-zoom-header" style="background:linear-gradient(135deg,#5323a1 0%,#7b2cbf 50%,#9d4edd 100%);',
            'color:white;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;',
            'font-weight:700;font-size:16px;border-radius:14px 14px 0 0;cursor:move;user-select:none;">',
            '<span>' + T('zoomTitle') + '</span>',
            '<div style="display:flex;gap:8px;">',
            '<button id="bc-zoom-reset" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);',
            'color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;">⟲</button>',
            '<button id="bc-zoom-close" style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);',
            'color:white;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1;">×</button>',
            '</div></div>',
            '<div id="bc-zoom-container" style="width:100%;height:calc(100% - 90px);overflow:auto;position:relative;cursor:grab;background:#1a1a1a;">',
            '<canvas id="bc-zoom-canvas" style="display:block;"></canvas>',
            '</div>',
            '<div style="padding:8px 16px;background:rgba(0,0,0,0.3);display:flex;align-items:center;gap:12px;border-radius:0 0 14px 14px;">',
            '<label style="color:#ccc;font-size:12px;">' + T('zoom') + ': <span id="bc-zoom-value">150</span>%</label>',
            '<input type="range" id="bc-zoom-slider" min="100" max="300" value="150" step="10" style="flex:1;height:6px;border-radius:3px;outline:none;-webkit-appearance:none;">',
            '</div>',
            '<div id="bc-zoom-resizer" style="position:absolute;bottom:0;right:0;width:20px;height:20px;cursor:nwse-resize;',
            'background:linear-gradient(135deg,transparent 0%,transparent 50%,rgba(83,35,161,0.6) 50%,rgba(83,35,161,0.6) 100%);border-radius:0 0 14px 0;"></div>',
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

        // ── FIX 2：以角色視覺中心為錨點縮放
        // 角色在 canvas 中通常頭頂在畫布上方約 15% 處，臉部約在上方 25% 附近
        // 我們以「容器可視區域中心對應到角色身體偏上位置」為縮放中心
        // 具體做法：縮放前記錄容器中心點對應到 canvas 上的座標比例，縮放後還原
        function zoomAroundCharacterCenter(newZoom) {
            const c = document.getElementById('bc-zoom-container');
            const cvs = document.getElementById('bc-zoom-canvas');
            if (!c || !cvs) return;

            const oldZoom = zoomPreviewState.zoom;

            // 角色臉部在 canvas 上的比例位置（垂直方向）
            // topPadding = 250px（原始），sourceHeight 約 1000px
            // 臉部大約在 topPadding + sourceHeight * 0.12 附近
            // 即整體 canvas 高度 (topPadding + sourceHeight) 中的 (250 + 120) / (250 + 1000) ≈ 0.296
            const CHAR_FACE_RATIO_Y = 0.19;   // 臉部在放大 canvas 中的垂直比例
            const CHAR_FACE_RATIO_X = 0.50;   // 臉部水平居中

            // 臉部在舊 canvas 中的絕對像素位置
            const oldFaceX = cvs.width * CHAR_FACE_RATIO_X;
            const oldFaceY = cvs.height * CHAR_FACE_RATIO_Y;

            // 臉部在容器視窗中的相對位置
            const faceInViewX = oldFaceX - c.scrollLeft;
            const faceInViewY = oldFaceY - c.scrollTop;

            // 更新縮放
            zoomPreviewState.zoom = newZoom;
            updateZoomPreview(false);  // 重繪（不還原舊捲動）

            // 重繪後還原以臉為錨點的捲動位置
            addManagedTimeout(function() {
                const c2 = document.getElementById('bc-zoom-container');
                const cvs2 = document.getElementById('bc-zoom-canvas');
                if (!c2 || !cvs2) return;

                // 臉部在新 canvas 中的像素位置
                const newFaceX = cvs2.width * CHAR_FACE_RATIO_X;
                const newFaceY = cvs2.height * CHAR_FACE_RATIO_Y;

                // 捲動使臉部仍在視窗中的相同位置
                c2.scrollLeft = newFaceX - faceInViewX;
                c2.scrollTop  = newFaceY - faceInViewY;

                zoomPreviewState.savedScrollTop  = c2.scrollTop;
                zoomPreviewState.savedScrollLeft = c2.scrollLeft;
            }, 15);
        }

        // 滾輪縮放（FIX 2：以角色為中心）
        addManagedEventListener(container, 'wheel', function(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -10 : 10;
            const newVal = Math.max(100, Math.min(300, parseInt(slider.value) + delta));
            slider.value = newVal;
            zoomValue.textContent = newVal;
            zoomAroundCharacterCenter(newVal / 100);
        }, { passive: false });

        addManagedEventListener(slider, 'input', function(e) {
            zoomValue.textContent = e.target.value;
            zoomAroundCharacterCenter(parseInt(e.target.value) / 100);
        });

        addManagedEventListener(resetBtn, 'click', function() {
            zoomPreviewState.zoom = 1.5;
            slider.value = 150;
            zoomValue.textContent = '150';
            zoomPreviewState.savedScrollTop = null;
            zoomPreviewState.savedScrollLeft = null;
            updateZoomPreview(false);
        });

        addManagedEventListener(closeBtn, 'click', closeZoomPreview);

        makeDraggable(previewUI, header);

        // 拖曳內容捲動
        addManagedEventListener(container, 'mousedown', function(e) {
            if (e.button === 0) {
                zoomPreviewState.isDragging = true;
                zoomPreviewState.lastMouseX = e.clientX;
                zoomPreviewState.lastMouseY = e.clientY;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });
        addManagedEventListener(document, 'mousemove', function(e) {
            if (zoomPreviewState.isDragging) {
                container.scrollLeft -= e.clientX - zoomPreviewState.lastMouseX;
                container.scrollTop  -= e.clientY - zoomPreviewState.lastMouseY;
                zoomPreviewState.lastMouseX = e.clientX;
                zoomPreviewState.lastMouseY = e.clientY;
                zoomPreviewState.savedScrollTop = container.scrollTop;
                zoomPreviewState.savedScrollLeft = container.scrollLeft;
            }
        });
        addManagedEventListener(document, 'mouseup', function() {
            if (zoomPreviewState.isDragging) {
                zoomPreviewState.isDragging = false;
                const c = document.getElementById('bc-zoom-container');
                if (c) {
                    c.style.cursor = 'grab';
                    zoomPreviewState.savedScrollTop = c.scrollTop;
                    zoomPreviewState.savedScrollLeft = c.scrollLeft;
                }
            }
        });

        // 調整大小
        let isResizing = false, resizeStartX, resizeStartY, resizeStartW, resizeStartH;
        addManagedEventListener(resizer, 'mousedown', function(e) {
            isResizing = true;
            resizeStartX = e.clientX; resizeStartY = e.clientY;
            resizeStartW = previewUI.offsetWidth; resizeStartH = previewUI.offsetHeight;
            e.preventDefault(); e.stopPropagation();
        });
        addManagedEventListener(document, 'mousemove', function(e) {
            if (isResizing) {
                previewUI.style.width  = Math.max(400, resizeStartW + e.clientX - resizeStartX) + 'px';
                previewUI.style.height = Math.max(500, resizeStartH + e.clientY - resizeStartY) + 'px';
            }
        });
        addManagedEventListener(document, 'mouseup', function() { isResizing = false; });

        return previewUI;
    }

    function updateZoomPreview(preserveScroll) {
        try {
            if (!zoomPreviewState.active) return;
            if (typeof CharacterAppearanceSelection === 'undefined') return;
            const C = CharacterAppearanceSelection;
            if (!C || !C.Canvas) return;

            const canvas = document.getElementById('bc-zoom-canvas');
            const container = document.getElementById('bc-zoom-container');
            if (!canvas || !container) return;

            if (preserveScroll) {
                zoomPreviewState.savedScrollTop  = container.scrollTop;
                zoomPreviewState.savedScrollLeft = container.scrollLeft;
            }

            const ctx = canvas.getContext('2d');
            const zoom = zoomPreviewState.zoom;
            const sourceWidth = C.Canvas.width;
            const sourceHeight = C.Canvas.height;
            const topPadding = 250;

            canvas.width  = sourceWidth  * zoom;
            canvas.height = (sourceHeight + topPadding) * zoom;
            canvas.style.width  = canvas.width  + 'px';
            canvas.style.height = canvas.height + 'px';

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 背景
            if (state.currentMode === 'solid') {
                ctx.fillStyle = state.bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } else if (state.currentMode === 'custom' && customBG && customBG.complete) {
                originalDrawImage.call(ctx, customBG, 0, 0, customBG.width, customBG.height, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // 格線（人物下）
            if (state.gridLayer === 'below') {
                drawGrid(ctx, canvas, 'below');
            }

            // 人物
            ctx.save();
            ctx.drawImage(C.Canvas, 0, 0, sourceWidth, sourceHeight, 0, topPadding * zoom, sourceWidth * zoom, sourceHeight * zoom);
            ctx.restore();

            // 格線（人物上）
            if (state.gridLayer === 'above') {
                drawGrid(ctx, canvas, 'above');
            }

            // 還原捲動位置
            addManagedTimeout(function() {
                const c = document.getElementById('bc-zoom-container');
                if (!c) return;
                if (preserveScroll && zoomPreviewState.savedScrollTop !== null) {
                    c.scrollTop  = zoomPreviewState.savedScrollTop;
                    c.scrollLeft = zoomPreviewState.savedScrollLeft;
                } else if (!preserveScroll && zoomPreviewState.savedScrollTop === null) {
                    // 首次開啟：預設置中偏上（臉部可見）
                    const totalH = c.scrollHeight;
                    const totalW = c.scrollWidth;
                    // topPadding * zoom 是「空白區」，再加上角色頭部約 12% 的源高
                    // 目標：讓臉部出現在容器垂直中央偏上
                    const facePixelY = (topPadding + sourceHeight * 0.12) * zoomPreviewState.zoom;
                    c.scrollTop  = Math.max(0, facePixelY - c.clientHeight * 0.35);
                    c.scrollLeft = Math.max(0, (totalW - c.clientWidth) / 2);
                    zoomPreviewState.savedScrollTop  = c.scrollTop;
                    zoomPreviewState.savedScrollLeft = c.scrollLeft;
                }
            }, 10);
        } catch (e) { safeError("updateZoomPreview 失敗:", e); }
    }

    function openZoomPreview() {
        zoomPreviewState.active = true;
        let previewUI = document.getElementById('bc-zoom-preview');
        if (!previewUI) {
            previewUI = createZoomPreviewUI();
        }
        previewUI.style.display = 'block';
        // 重新開啟時清除捲動記憶，讓畫面回到臉部位置
        zoomPreviewState.savedScrollTop  = null;
        zoomPreviewState.savedScrollLeft = null;
        updateZoomPreview(false);
    }

    function closeZoomPreview() {
        zoomPreviewState.active = false;
        const previewUI = document.getElementById('bc-zoom-preview');
        if (previewUI) previewUI.style.display = 'none';
    }

    // ================================
    // drawImage Hook
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
            if (performance.isInDressingRoom) performance.drawImageCalls++;

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
                            originalDrawImage.call(this, customBG, 0, 0, customBG.width, customBG.height, 0, 0, canvas.width, canvas.height);
                        } else {
                            originalDrawImage.apply(this, [img].concat(args));
                        }

                        if (state.gridLayer === 'below') {
                            drawGrid(this, canvas);
                        }

                        this.restore();
                        return;
                    }
                }
            } catch(e) {
                performance.drawImageErrors++;
                safeError("drawImage hook 錯誤:", e);
                try { this.restore(); } catch(_) {}
            }

            return originalDrawImage.apply(this, [img].concat(args));
        };
    }

    // ================================
    // BC Hooks
    // ================================
    function setupBCHooks() {
        if (!modApi) return;
        try {
            modApi.hookFunction("AppearanceRun", 4, function(args, next) {
                const result = next(args);
                safeCall(function() {
                    if (isMainAppearanceMode()) {
                        if (state.gridLayer === 'above' && state.gridMode !== 'disabled' && state.currentMode !== 'disabled') {
                            try {
                                const mainCanvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
                                if (mainCanvas) {
                                    const ctx = mainCanvas.getContext('2d');
                                    drawGrid(ctx, mainCanvas, 'above');
                                }
                            } catch(e) { safeError("above 格線繪製失敗:", e); }
                        }
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
                    addManagedTimeout(function() { updateZoomPreview(true); }, 50);
                }
                return result;
            });

            modApi.hookFunction("AppearanceClick", 4, function(args, next) {
                const handled = safeCall(function() {
                    if (!isMainAppearanceMode()) return false;
                    return handleMainButtonClick() || handleZoomPreviewButtonClick() || handlePoseButtonsClick();
                }, false);
                if (handled) return;
                return next(args);
            });

            function onExitAppearance() {
                closeZoomPreview();
                poseState.expanded = false;
                hideUI();
            }

            modApi.hookFunction("AppearanceExit", 4, function(args, next) {
                const result = next(args);
                addManagedTimeout(function() {
                    if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "Appearance") {
                        onExitAppearance();
                    }
                }, 100);
                return result;
            });

            modApi.hookFunction("CharacterAppearanceExit", 4, function(args, next) {
                onExitAppearance();
                return next(args);
            });

            modApi.hookFunction("CharacterAppearanceWardrobeLoad", 4, function(args, next) {
                onExitAppearance();
                return next(args);
            });

            modApi.hookFunction("CommonSetScreen", 4, function(args, next) {
                const result = next(args);
                safeCall(function() {
                    if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== "Appearance") {
                        onExitAppearance();
                    }
                });
                return result;
            });

        } catch (e) { safeError("設置BC hooks失敗:", e); }
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
                return modApi;
            } catch (e) { safeError("初始化 modApi 失敗:", e); return null; }
        });
    }

    function cleanup() {
        try {
            closeZoomPreview();
            poseState.expanded = false;
            hideUI();

            if (originalDrawImage) {
                CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
                originalDrawImage = null;
            }

            resources.intervalIds.forEach(function(id) { clearInterval(id); });
            resources.intervalIds.clear();
            resources.timeoutIds.forEach(function(id) { clearTimeout(id); });
            resources.timeoutIds.clear();
            resources.blobUrls.forEach(function(url) { URL.revokeObjectURL(url); });
            resources.blobUrls.clear();

            if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
                URL.revokeObjectURL(customBG.src);
                customBG = null;
            }

            resources.eventListeners.forEach(function(listeners) {
                listeners.forEach(function(listener) {
                    try { listener.element.removeEventListener(listener.event, listener.handler, listener.options); } catch(_) {}
                });
            });
            resources.eventListeners.clear();

            ['bc-colorpicker-ui', 'bc-zoom-preview'].forEach(function(id) {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
            colorPickerUI = null;

            resources.styleSheets.forEach(function(s) { try { s.remove(); } catch(_) {} });
            resources.styleSheets.clear();

            state.uiVisible = false;
            poseState.expanded = false;
            isInitialized = false;

            if (window.CDBEnhanced) delete window.CDBEnhanced;
            safeLog("插件已完全清理");
        } catch (e) { safeError("清理失敗:", e); }
    }

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        safeLog("初始化 v" + CONFIG.VERSION + "...");

        waitForGame().then(function(gameLoaded) {
            if (!gameLoaded) safeError("遊戲載入失敗，使用簡化模式");
            Lang.reset();
            loadFromOnlineSettings();
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
            if (modApi && modApi.onUnload) modApi.onUnload(cleanup);

            window.CDBEnhanced = {
                show: showUI,
                hide: hideUI,
                toggle: toggleUI,
                cleanup: cleanup,
                changePose: changePose,
                saveSettings: saveToOnlineSettings,
                loadSettings: loadFromOnlineSettings,
                openZoom: openZoomPreview,
                closeZoom: closeZoomPreview,
                refreshZoom: function() { updateZoomPreview(true); },
                test: function() {
                    safeLog("=== CDB v" + CONFIG.VERSION + " ===");
                    safeLog("語言: " + Lang.get());
                    safeLog("當前畫面: " + (typeof CurrentScreen !== 'undefined' ? CurrentScreen : '未知'));
                    safeLog("在更衣室主畫面: " + isMainAppearanceMode());
                    safeLog("格線模式: " + state.gridMode + " / 格線圖層: " + state.gridLayer);
                    safeLog("放大鏡: " + (zoomPreviewState.active ? '開啟' : '關閉'));
                }
            };

            safeLog("✅ [CDB] 初始化完成 v" + CONFIG.VERSION);
        }).catch(function(e) {
            safeError("❌ [CDB] 初始化失敗:", e);
            isInitialized = false;
        });
    }

    initialize();
})();
