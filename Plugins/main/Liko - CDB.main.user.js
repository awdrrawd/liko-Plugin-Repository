// ==UserScript==
// @name         Liko - CDB
// @name:zh      Liko的自訂更衣室背景
// @namespace    https://likolisu.dev/
// @version      1.1
// @description  自訂更衣室背景 | Custom Dressing Background
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ================================
    // 常量配置
    // ================================
    const CONFIG = {
        VERSION: "1.1",
        DEFAULT_BG_URL: "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg",
        BUTTON_X: 600,
        BUTTON_Y: 25,
        BUTTON_SIZE: 90,
        TIMEOUTS: {
            BC_MOD_SDK: 30000,
            GAME_LOAD: 30000
        },
        Z_INDEX: {
            UI: 10000,
            TRIGGER_BUTTON: 9999
        },
        PRESET_COLORS: [
            '#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#ADFF2F', '#00FF00',
            '#00FFFF', '#0087FF', '#0000FF', '#8A2BE2', '#FF00FF', '#FF1493',
            '#000000', '#404040', '#808080', '#C0C0C0', '#FFFFFF', '#8B4513',
            '#F5DEB3', '#DDA0DD', '#FFB6C1', '#FFC0CB'
        ],
        GRID_SPACING: {
            'grid10': 10,
            'grid25': 25,
            'grid50': 50
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
        uiVisible: false
    };

    // 性能監控
    const performance = {
        drawImageCalls: 0,
        drawImageErrors: 0,
        lastDrawTime: 0
    };

    // 資源管理
    const resources = {
        blobUrls: new Set(),
        eventListeners: new Map(),
        styleSheets: new Set()
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
                    setTimeout(check, 100);
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
                    typeof DrawButton === 'function') {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    safeError("遊戲載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
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
                        safeLog("[CDB] 背景載入完成: " + img.width + "x" + img.height);
                        resolve(img);
                    };

                    img.onerror = function() {
                        URL.revokeObjectURL(blobUrl);
                        resources.blobUrls.delete(blobUrl);
                        reject(new Error("[CDB] 圖片載入失敗"));
                    };

                    img.src = blobUrl;
                });
            })
            .catch(function(e) {
                safeError("[CDB] 背景載入失敗:", e);
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
            'width: 480px;',
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
            '<div style="background: linear-gradient(135deg, #5323a1 0%, #7b2cbf 50%, #9d4edd 100%); color: white; padding: 16px 24px; border-radius: 14px 14px 0 0; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);">',
            '<span>🎨 背景調色器 Pro</span>',
            '<button id="bc-close-btn" style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 18px; line-height: 1; transition: all 0.2s ease;">×</button>',
            '</div>',

            '<div style="padding: 24px; background: rgba(0,0,0,0.05); border-radius: 0 0 14px 14px;">',

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
            '<div style="margin-bottom: 12px;">',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 4px;">色相 (H): <span id="bc-h-value">0</span>°</label>',
            '<input type="range" id="bc-h-slider" min="0" max="360" value="0" style="width: 100%; height: 8px; border-radius: 4px; background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%); outline: none; -webkit-appearance: none;">',
            '</div>',
            '<div style="margin-bottom: 12px;">',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 4px;">飽和度 (S): <span id="bc-s-value">0</span>%</label>',
            '<input type="range" id="bc-s-slider" min="0" max="100" value="0" style="width: 100%; height: 8px; border-radius: 4px; background: linear-gradient(to right, #808080, #ff0000); outline: none; -webkit-appearance: none;">',
            '</div>',
            '<div style="margin-bottom: 12px;">',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 4px;">明度 (V): <span id="bc-v-value">0</span>%</label>',
            '<input type="range" id="bc-v-slider" min="0" max="100" value="0" style="width: 100%; height: 8px; border-radius: 4px; background: linear-gradient(to right, #000000, #ffffff); outline: none; -webkit-appearance: none;">',
            '</div>',
            '</div>',

            // 預設顏色
            '<div style="margin-top: 16px;">',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 8px;">快速選擇</label>',
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
            '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">',
            '<input type="color" id="bc-grid-color" value="' + state.gridColor + '" style="width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer;">',
            '<label style="color: #ccc; font-size: 12px;">格線顏色</label>',
            '</div>',
            '<div>',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 4px;">透明度: <span id="bc-opacity-value">50</span>%</label>',
            '<input type="range" id="bc-opacity-slider" min="0" max="100" value="50" style="width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, transparent, white); outline: none; -webkit-appearance: none;">',
            '</div>',
            '</div>',

            // 自訂背景URL
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">自訂背景圖片</h3>',
            '<input type="text" id="bc-custom-url" value="' + state.customBgUrl + '" placeholder="輸入圖片網址..." style="width: 100%; background: #444; border: 1px solid #666; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 12px; box-sizing: border-box;">',
            '<button id="bc-load-custom" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px; transition: background 0.2s;">載入背景</button>',
            '</div>',

            // 操作按鈕
            '<div style="display: flex; gap: 12px; justify-content: flex-end;">',
            '<button id="bc-reset-btn" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">重置</button>',
            '<button id="bc-apply-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">套用</button>',
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
            '#bc-colorpicker-ui button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn) { background: linear-gradient(135deg, rgba(83, 35, 161, 0.8), rgba(157, 78, 221, 0.8)); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px); transition: all 0.3s ease; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }',
            '#bc-colorpicker-ui button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn):hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(83, 35, 161, 0.4); }'
        ].join('');

        document.head.appendChild(style);
        addManagedStyleSheet(style);
    }

    function createPresetColors() {
        const container = document.getElementById('bc-preset-colors');
        if (!container) return;

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
            });
        }

        // 格線按鈕
        const gridBtns = document.querySelectorAll('.bc-grid-btn');
        for (let i = 0; i < gridBtns.length; i++) {
            const btn = gridBtns[i];
            addManagedEventListener(btn, 'click', function() {
                state.gridMode = btn.getAttribute('data-grid');
                updateUIState();
            });
        }

        // 顏色選擇器
        const bgColorInput = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');

        if (bgColorInput) {
            addManagedEventListener(bgColorInput, 'input', function(e) {
                setBgColor(e.target.value);
            });
        }

        if (bgColorText) {
            addManagedEventListener(bgColorText, 'input', function(e) {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setBgColor(e.target.value);
                }
            });
        }

        // HSV滑塊
        setupHSVSliders();

        // 格線設定
        const gridColorInput = document.getElementById('bc-grid-color');
        const opacitySlider = document.getElementById('bc-opacity-slider');

        if (gridColorInput) {
            addManagedEventListener(gridColorInput, 'input', function(e) {
                state.gridColor = e.target.value;
            });
        }

        if (opacitySlider) {
            addManagedEventListener(opacitySlider, 'input', function(e) {
                state.gridOpacity = e.target.value / 100;
                const opacityValue = document.getElementById('bc-opacity-value');
                if (opacityValue) {
                    opacityValue.textContent = e.target.value;
                }
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
                    });
                }
            });
        }

        // 操作按鈕
        const resetBtn = document.getElementById('bc-reset-btn');
        const applyBtn = document.getElementById('bc-apply-btn');

        if (resetBtn) {
            addManagedEventListener(resetBtn, 'click', resetSettings);
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
            });
        }

        if (sSlider && sValue) {
            addManagedEventListener(sSlider, 'input', function(e) {
                sValue.textContent = e.target.value;
                updateSaturationSliderBackground();
                updateColorFromHSV();
            });
        }

        if (vSlider && vValue) {
            addManagedEventListener(vSlider, 'input', function(e) {
                vValue.textContent = e.target.value;
                updateValueSliderBackground();
                updateColorFromHSV();
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
    }

    function resetSettings() {
        state.currentMode = 'disabled';
        state.bgColor = '#87CEEB';
        state.gridMode = 'disabled';
        state.gridColor = '#FFFFFF';
        state.gridOpacity = 0.5;
        state.customBgUrl = CONFIG.DEFAULT_BG_URL;

        setBgColor(state.bgColor);

        const elements = {
            gridColor: document.getElementById('bc-grid-color'),
            opacitySlider: document.getElementById('bc-opacity-slider'),
            opacityValue: document.getElementById('bc-opacity-value'),
            customUrl: document.getElementById('bc-custom-url')
        };

        if (elements.gridColor) elements.gridColor.value = state.gridColor;
        if (elements.opacitySlider) elements.opacitySlider.value = 50;
        if (elements.opacityValue) elements.opacityValue.textContent = '50';
        if (elements.customUrl) elements.customUrl.value = state.customBgUrl;

        updateUIState();
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
            const iconUrl = "https://www.bondageprojects.elementfx.com/R120/BondageClub/Icons/Extensions.png";
            const text = "";
            const color = state.currentMode === 'disabled' ? "White" : "#5323a1";

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
                showUI();
                return true;
            }
            return false;
        }, function() { return false; });
    }

    // ================================
    // Hook 設置
    // ================================
    function setupDrawImageHook() {
        if (originalDrawImage) return;

        originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(img) {
            const args = Array.prototype.slice.call(arguments, 1);

            // 性能監控
            performance.drawImageCalls++;
            if (Date.now() - performance.lastDrawTime > 5000) {
                if (performance.drawImageCalls > 1000) {
                    safeLog("警告: drawImage 調用頻率過高: " + performance.drawImageCalls);
                }
                performance.drawImageCalls = 0;
                performance.lastDrawTime = Date.now();
            }

            // 類型檢查
            if (!img || typeof img.src !== 'string') {
                return originalDrawImage.apply(this, [img].concat(args));
            }

            try {
                // 嚴格的條件檢查
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

        safeLog("drawImage hook 設置完成");
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
                    }
                });

                return result;
            });

            // AppearanceClick hook
            modApi.hookFunction("AppearanceClick", 4, function(args, next) {
                const handled = safeCallWithFallback(function() {
                    return isMainAppearanceMode() && handleMainButtonClick();
                }, function() { return false; });

                if (handled) return;
                return next(args);
            });

            safeLog("BC hooks 設置完成");
        } catch (e) {
            safeError("設置BC hooks失敗:", e);
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
                safeLog("✅ 插件註冊成功");
                return modApi;
            } catch (e) {
                safeError("❌ 初始化 modApi 失敗:", e);
                return null;
            }
        });
    }

    function cleanup() {
        try {
            // 恢復原始的 drawImage 方法
            if (originalDrawImage) {
                CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
                originalDrawImage = null;
            }

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
            const ui = document.getElementById('bc-colorpicker-ui');
            if (ui) {
                ui.remove();
                colorPickerUI = null;
            }

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
            state.currentMode = 'disabled';
            isInitialized = false;

            // 清理全局對象
            if (window.BCColorPicker) {
                delete window.BCColorPicker;
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
        safeLog("開始初始化 v" + CONFIG.VERSION + "...");

        waitForGame().then(function(gameLoaded) {
            if (!gameLoaded) {
                safeError("遊戲載入失敗，使用簡化模式");
            }

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
            window.BCColorPicker = {
                show: showUI,
                hide: hideUI,
                toggle: toggleUI,
                cleanup: cleanup,
                test: function() {
                    safeLog("=== BC調色器 v" + CONFIG.VERSION + " ===");
                    safeLog("當前畫面: " + (typeof CurrentScreen !== 'undefined' ? CurrentScreen : '未知'));
                    safeLog("在更衣室主畫面: " + isMainAppearanceMode());
                    safeLog("性能統計: 繪圖調用 " + performance.drawImageCalls + ", 錯誤 " + performance.drawImageErrors);
                }
            };

            safeLog("✅ 初始化完成 v" + CONFIG.VERSION);
            safeLog("點擊右上角按鈕開啟調色器");
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
