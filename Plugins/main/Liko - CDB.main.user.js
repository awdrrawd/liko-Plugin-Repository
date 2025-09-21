// ==UserScript==
// @name         Liko - CDB
// @name:zh      Liko的自訂更衣室背景
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  自訂更衣室背景 | Custom Dressing Background
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let modApi = null;
    let customBG = null;
    let isInitialized = false;
    let originalDrawImage = null;

    // 配置
    const DEFAULT_BG_URL = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg";
    const BUTTON_X = 600;
    const BUTTON_Y = 25;
    const BUTTON_SIZE = 90;
    const MOD_VERSION = "1.0";

    // 狀態管理
    let currentMode = 'disabled';
    let bgColor = '#87CEEB';
    let customBgUrl = DEFAULT_BG_URL;
    let gridMode = 'disabled';
    let gridColor = '#FFFFFF';
    let gridOpacity = 0.5;

    // UI狀態
    let uiVisible = false;
    let colorPickerUI = null;

    // 工具函數
    function safeLog(message) {
        try {
            console.log('[CDB] ' + message);
        } catch (e) {}
    }

    function safeError(message, error) {
        try {
            console.error('[CDB] ' + message, error);
        } catch (e) {}
    }

    // 等待函數（不使用async）
    function waitForBcModSdk(timeout) {
        timeout = timeout || 30000;
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

    function waitForGame(timeout) {
        timeout = timeout || 30000;
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

    // 初始化ModAPI
    function initializeModApi() {
        return waitForBcModSdk().then(function(success) {
            if (!success) return null;

            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko's CDB",
                    fullName: "Liko's Custom Dressing Background",
                    version: MOD_VERSION,
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

    // 載入自訂背景
    function loadCustomBackground(url) {
        url = url || customBgUrl;
        return fetch(url)
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.blob();
            })
            .then(function(blob) {
                return new Promise(function(resolve, reject) {
                    const img = new Image();
                    img.onload = function() {
                        customBG = img;
                        safeLog("[CDB] 背景載入完成: " + img.width + "x" + img.height);
                        resolve(img);
                    };
                    img.onerror = function() {
                        reject(new Error("[CDB] 圖片載入失敗"));
                    };
                    img.src = URL.createObjectURL(blob);
                });
            })
            .catch(function(e) {
                safeError("[CDB] 背景載入失敗:", e);
                return null;
            });
    }

    // 判斷是否在更衣室主畫面
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

    // 判斷是否在更衣室
    function isInAppearanceScreen() {
        try {
            return typeof CurrentScreen !== 'undefined' && CurrentScreen === "Appearance";
        } catch (e) {
            return false;
        }
    }

    // 顏色轉換函數
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

    // 創建調色器UI
    function createColorPickerUI() {
        if (colorPickerUI) return colorPickerUI;

        const uiHTML = [
            '<div id="bc-colorpicker-ui" style="',
            'position: fixed;',
            'top: 50%;',
            'left: 50%;',
            'transform: translate(-50%, -50%);',
            'width: 480px;',
            'background: rgba(30, 30, 30, 0.05);',
            'border: 2px solid rgba(83, 35, 161, 0.6);',
            'border-radius: 16px;',
            'box-shadow: 0 15px 35px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);',
            'font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;',
            'z-index: 10000;',
            'display: none;',
            'backdrop-filter: blur(20px);',
            '-webkit-backdrop-filter: blur(20px);',
            'user-select: none;',
            '-webkit-user-select: none;',
            '-moz-user-select: none;',
            '-ms-user-select: none;',
            '">',

            '<!-- 標題欄 -->',
            '<div style="',
            'background: linear-gradient(135deg, #5323a1 0%, #7b2cbf 50%, #9d4edd 100%);',
            'color: white;',
            'padding: 16px 24px;',
            'border-radius: 14px 14px 0 0;',
            'display: flex;',
            'justify-content: space-between;',
            'align-items: center;',
            'font-weight: 700;',
            'font-size: 18px;',
            'text-shadow: 0 2px 4px rgba(0,0,0,0.3);',
            'box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);',
            '">',
            '<span>🎨 背景調色器 Pro</span>',
            '<button id="bc-close-btn" style="',
            'background: rgba(255,255,255,0.15);',
            'border: 1px solid rgba(255,255,255,0.3);',
            'color: white;',
            'width: 28px;',
            'height: 28px;',
            'border-radius: 50%;',
            'cursor: pointer;',
            'font-size: 18px;',
            'line-height: 1;',
            'transition: all 0.2s ease;',
            '">×</button>',
            '</div>',

            '<div style="padding: 24px; background: rgba(0,0,0,0.05); border-radius: 0 0 14px 14px;">',

            '<!-- 模式選擇 -->',
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">背景模式</h3>',
            '<div style="display: flex; gap: 8px; flex-wrap: wrap;">',
            '<button class="bc-mode-btn" data-mode="disabled">停用</button>',
            '<button class="bc-mode-btn" data-mode="solid">素色背景</button>',
            '<button class="bc-mode-btn" data-mode="custom">自訂背景</button>',
            '</div>',
            '</div>',

            '<!-- 顏色選擇器 -->',
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">背景顏色</h3>',
            '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">',
            '<input type="color" id="bc-bg-color" value="' + bgColor + '" style="width: 50px; height: 35px; border: none; border-radius: 6px; cursor: pointer;">',
            '<input type="text" id="bc-bg-color-text" value="' + bgColor + '" style="background: #444; border: 1px solid #666; color: #fff; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; width: 80px;">',
            '</div>',

            '<!-- HSV滑塊 -->',
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

            '<!-- 預設顏色 -->',
            '<div style="margin-top: 16px;">',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 8px;">快速選擇</label>',
            '<div id="bc-preset-colors" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>',
            '</div>',
            '</div>',

            '<!-- 格線設定 -->',
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">格線設定</h3>',
            '<div style="display: flex; gap: 8px; margin-bottom: 12px;">',
            '<button class="bc-grid-btn" data-grid="disabled">停用</button>',
            '<button class="bc-grid-btn" data-grid="grid10">10px</button>',
            '<button class="bc-grid-btn" data-grid="grid25">25px</button>',
            '<button class="bc-grid-btn" data-grid="grid50">50px</button>',
            '</div>',

            '<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">',
            '<input type="color" id="bc-grid-color" value="' + gridColor + '" style="width: 40px; height: 30px; border: none; border-radius: 4px; cursor: pointer;">',
            '<label style="color: #ccc; font-size: 12px;">格線顏色</label>',
            '</div>',

            '<div>',
            '<label style="color: #ccc; font-size: 12px; display: block; margin-bottom: 4px;">透明度: <span id="bc-opacity-value">50</span>%</label>',
            '<input type="range" id="bc-opacity-slider" min="0" max="100" value="50" style="width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, transparent, white); outline: none; -webkit-appearance: none;">',
            '</div>',
            '</div>',

            '<!-- 自訂背景URL -->',
            '<div style="margin-bottom: 20px;">',
            '<h3 style="color: #fff; margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">自訂背景圖片</h3>',
            '<input type="text" id="bc-custom-url" value="' + customBgUrl + '" placeholder="輸入圖片網址..." style="width: 100%; background: #444; border: 1px solid #666; color: #fff; padding: 8px 12px; border-radius: 6px; font-size: 12px; box-sizing: border-box;">',
            '<button id="bc-load-custom" style="background: #2196F3; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-top: 8px; transition: background 0.2s;">載入背景</button>',
            '</div>',

            '<!-- 操作按鈕 -->',
            '<div style="display: flex; gap: 12px; justify-content: flex-end;">',
            '<button id="bc-reset-btn" style="background: #f44336; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">重置</button>',
            '<button id="bc-apply-btn" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: background 0.2s;">套用</button>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');

        document.body.insertAdjacentHTML('beforeend', uiHTML);
        colorPickerUI = document.getElementById('bc-colorpicker-ui');

        // 添加CSS樣式
        const style = document.createElement('style');
        style.textContent = [
            '* { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }',
            '.bc-mode-btn, .bc-grid-btn {',
            'padding: 10px 18px;',
            'border: 1px solid rgba(255,255,255,0.2);',
            'background: rgba(255,255,255,0.05);',
            'color: #fff;',
            'border-radius: 8px;',
            'cursor: pointer;',
            'font-size: 13px;',
            'font-weight: 500;',
            'transition: all 0.3s ease;',
            'backdrop-filter: blur(10px);',
            'text-shadow: 0 1px 2px rgba(0,0,0,0.5);',
            '}',
            '.bc-mode-btn.active, .bc-grid-btn.active {',
            'background: rgba(83, 35, 161, 0.8) !important;',
            'border-color: rgba(157, 78, 221, 0.6) !important;',
            'box-shadow: 0 0 20px rgba(83, 35, 161, 0.4);',
            'transform: translateY(-1px);',
            '}',
            '.bc-mode-btn:hover, .bc-grid-btn:hover {',
            'background: rgba(255,255,255,0.1) !important;',
            'border-color: rgba(255,255,255,0.4) !important;',
            'transform: translateY(-1px);',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.2);',
            '}',
            '#bc-close-btn:hover {',
            'background: rgba(255,255,255,0.25) !important;',
            'transform: scale(1.1);',
            '}',
            'input[type="range"] {',
            '-webkit-appearance: none;',
            'appearance: none;',
            'background: transparent;',
            'outline: none;',
            '}',
            'input[type="range"]::-webkit-slider-track {',
            'height: 8px;',
            'border-radius: 4px;',
            'border: 1px solid rgba(255,255,255,0.3);',
            '}',
            'input[type="range"]::-webkit-slider-thumb {',
            '-webkit-appearance: none;',
            'width: 20px;',
            'height: 20px;',
            'border-radius: 50%;',
            'background: linear-gradient(135deg, #5323a1, #9d4edd);',
            'border: 2px solid rgba(255,255,255,0.8);',
            'cursor: pointer;',
            'box-shadow: 0 3px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(83,35,161,0.2);',
            'transition: all 0.2s ease;',
            '}',
            'input[type="range"]::-webkit-slider-thumb:hover {',
            'transform: scale(1.15);',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 0 2px rgba(83,35,161,0.4);',
            '}',
            '.bc-preset-color {',
            'width: 32px;',
            'height: 32px;',
            'border-radius: 6px;',
            'cursor: pointer;',
            'border: 2px solid rgba(255,255,255,0.2);',
            'transition: all 0.3s ease;',
            'box-shadow: 0 2px 8px rgba(0,0,0,0.2);',
            '}',
            '.bc-preset-color:hover {',
            'border-color: rgba(255,255,255,0.8);',
            'transform: scale(1.15);',
            'box-shadow: 0 4px 16px rgba(0,0,0,0.3);',
            '}',
            'input[type="text"], input[type="color"] {',
            'border: 1px solid rgba(255,255,255,0.2) !important;',
            'background: rgba(255,255,255,0.05) !important;',
            'backdrop-filter: blur(10px);',
            '}',
            'input[type="text"]:focus {',
            'border-color: rgba(83, 35, 161, 0.6) !important;',
            'box-shadow: 0 0 0 2px rgba(83, 35, 161, 0.2);',
            '}',
            'h3, label {',
            'text-shadow: 0 1px 3px rgba(0,0,0,0.5);',
            '}',
            'button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn) {',
            'background: linear-gradient(135deg, rgba(83, 35, 161, 0.8), rgba(157, 78, 221, 0.8)) !important;',
            'border: 1px solid rgba(255,255,255,0.2) !important;',
            'backdrop-filter: blur(10px);',
            'transition: all 0.3s ease;',
            'text-shadow: 0 1px 2px rgba(0,0,0,0.5);',
            '}',
            'button:not(.bc-mode-btn):not(.bc-grid-btn):not(#bc-close-btn):hover {',
            'transform: translateY(-2px);',
            'box-shadow: 0 6px 20px rgba(83, 35, 161, 0.4);',
            '}'
        ].join('');
        document.head.appendChild(style);

        setupUIEvents();
        createPresetColors();
        updateUIState();

        return colorPickerUI;
    }

    // 創建預設顏色
    function createPresetColors() {
        const presetColors = [
            '#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#ADFF2F', '#00FF00',
            '#00FFFF', '#0087FF', '#0000FF', '#8A2BE2', '#FF00FF', '#FF1493',
            '#000000', '#404040', '#808080', '#C0C0C0', '#FFFFFF', '#8B4513',
            '#F5DEB3', '#DDA0DD', '#FFB6C1', '#FFC0CB'
        ];

        const container = document.getElementById('bc-preset-colors');
        presetColors.forEach(function(color) {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'bc-preset-color';
            colorDiv.style.backgroundColor = color;
            colorDiv.title = color;
            colorDiv.addEventListener('click', function() {
                setBgColor(color);
            });
            container.appendChild(colorDiv);
        });
    }

    // 設置UI事件
    function setupUIEvents() {
        // 關閉按鈕
        document.getElementById('bc-close-btn').addEventListener('click', hideUI);

        // 模式按鈕
        const modeBtns = document.querySelectorAll('.bc-mode-btn');
        for (let i = 0; i < modeBtns.length; i++) {
            const btn = modeBtns[i];
            btn.addEventListener('click', function() {
                const mode = btn.getAttribute('data-mode');
                setMode(mode);
                updateUIState();
            });
        }

        // 格線按鈕
        const gridBtns = document.querySelectorAll('.bc-grid-btn');
        for (let i = 0; i < gridBtns.length; i++) {
            const btn = gridBtns[i];
            btn.addEventListener('click', function() {
                gridMode = btn.getAttribute('data-grid');
                updateUIState();
            });
        }

        // 顏色選擇器
        const bgColorInput = document.getElementById('bc-bg-color');
        const bgColorText = document.getElementById('bc-bg-color-text');

        bgColorInput.addEventListener('input', function(e) {
            setBgColor(e.target.value);
        });

        bgColorText.addEventListener('input', function(e) {
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                setBgColor(e.target.value);
            }
        });

        // HSV滑塊
        setupHSVSliders();

        // 格線設定
        document.getElementById('bc-grid-color').addEventListener('input', function(e) {
            gridColor = e.target.value;
        });

        document.getElementById('bc-opacity-slider').addEventListener('input', function(e) {
            gridOpacity = e.target.value / 100;
            document.getElementById('bc-opacity-value').textContent = e.target.value;
        });

        // 自訂背景
        document.getElementById('bc-load-custom').addEventListener('click', function() {
            const url = document.getElementById('bc-custom-url').value;
            if (url) {
                customBgUrl = url;
                loadCustomBackground(url).then(function() {
                    setMode('custom');
                    updateUIState();
                });
            }
        });

        // 操作按鈕
        document.getElementById('bc-reset-btn').addEventListener('click', resetSettings);
        document.getElementById('bc-apply-btn').addEventListener('click', hideUI);
    }

    // 設置HSV滑塊
    function setupHSVSliders() {
        const hSlider = document.getElementById('bc-h-slider');
        const sSlider = document.getElementById('bc-s-slider');
        const vSlider = document.getElementById('bc-v-slider');

        const hValue = document.getElementById('bc-h-value');
        const sValue = document.getElementById('bc-s-value');
        const vValue = document.getElementById('bc-v-value');

        hSlider.addEventListener('input', function(e) {
            hValue.textContent = e.target.value;
            updateColorFromHSV();
        });

        sSlider.addEventListener('input', function(e) {
            sValue.textContent = e.target.value;
            updateSaturationSliderBackground();
            updateColorFromHSV();
        });

        vSlider.addEventListener('input', function(e) {
            vValue.textContent = e.target.value;
            updateValueSliderBackground();
            updateColorFromHSV();
        });
    }

    // 設置背景顏色
    function setBgColor(color) {
        bgColor = color;
        const hsv = hexToHsv(color);

        document.getElementById('bc-bg-color').value = color;
        document.getElementById('bc-bg-color-text').value = color;
        document.getElementById('bc-h-slider').value = hsv.h;
        document.getElementById('bc-s-slider').value = hsv.s;
        document.getElementById('bc-v-slider').value = hsv.v;
        document.getElementById('bc-h-value').textContent = hsv.h;
        document.getElementById('bc-s-value').textContent = hsv.s;
        document.getElementById('bc-v-value').textContent = hsv.v;

        updateSaturationSliderBackground();
        updateValueSliderBackground();

        if (currentMode !== 'solid') setMode('solid');
    }

    // 從HSV更新顏色
    function updateColorFromHSV() {
        const h = parseInt(document.getElementById('bc-h-slider').value);
        const s = parseInt(document.getElementById('bc-s-slider').value);
        const v = parseInt(document.getElementById('bc-v-slider').value);

        const hex = hsvToHex(h, s, v);
        bgColor = hex;

        document.getElementById('bc-bg-color').value = hex;
        document.getElementById('bc-bg-color-text').value = hex;

        if (currentMode !== 'solid') setMode('solid');
    }

    // 更新滑塊背景
    function updateSaturationSliderBackground() {
        const h = document.getElementById('bc-h-slider').value;
        const v = document.getElementById('bc-v-slider').value;
        const colorLeft = hsvToHex(h, 0, v);
        const colorRight = hsvToHex(h, 100, v);
        const slider = document.getElementById('bc-s-slider');
        slider.style.background = 'linear-gradient(to right, ' + colorLeft + ', ' + colorRight + ')';
        slider.style.border = '1px solid rgba(255,255,255,0.3)';
        slider.style.borderRadius = '4px';
    }

    function updateValueSliderBackground() {
        const h = document.getElementById('bc-h-slider').value;
        const s = document.getElementById('bc-s-slider').value;
        const colorLeft = hsvToHex(h, s, 0);
        const colorRight = hsvToHex(h, s, 100);
        const slider = document.getElementById('bc-v-slider');
        slider.style.background = 'linear-gradient(to right, ' + colorLeft + ', ' + colorRight + ')';
        slider.style.border = '1px solid rgba(255,255,255,0.3)';
        slider.style.borderRadius = '4px';
    }

    // 設置模式
    function setMode(mode) {
        currentMode = mode;
        if (mode === 'custom' && !customBG) {
            loadCustomBackground();
        }
    }

    // 更新UI狀態
    function updateUIState() {
        // 更新模式按鈕
        const modeBtns = document.querySelectorAll('.bc-mode-btn');
        for (let i = 0; i < modeBtns.length; i++) {
            const btn = modeBtns[i];
            const isActive = btn.getAttribute('data-mode') === currentMode;
            if (isActive) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        // 更新格線按鈕
        const gridBtns = document.querySelectorAll('.bc-grid-btn');
        for (let i = 0; i < gridBtns.length; i++) {
            const btn = gridBtns[i];
            const isActive = btn.getAttribute('data-grid') === gridMode;
            if (isActive) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    }

    // 重置設定
    function resetSettings() {
        currentMode = 'disabled';
        bgColor = '#87CEEB';
        gridMode = 'disabled';
        gridColor = '#FFFFFF';
        gridOpacity = 0.5;
        customBgUrl = DEFAULT_BG_URL;

        setBgColor(bgColor);
        document.getElementById('bc-grid-color').value = gridColor;
        document.getElementById('bc-opacity-slider').value = 50;
        document.getElementById('bc-opacity-value').textContent = '50';
        document.getElementById('bc-custom-url').value = customBgUrl;

        updateUIState();
    }

    // 顯示/隱藏UI
    function showUI() {
        if (!colorPickerUI) createColorPickerUI();
        colorPickerUI.style.display = 'block';
        uiVisible = true;
    }

    function hideUI() {
        if (colorPickerUI) colorPickerUI.style.display = 'none';
        uiVisible = false;
    }

    function toggleUI() {
        if (uiVisible) {
            hideUI();
        } else {
            showUI();
        }
    }

    // 繪製BC內建主按鈕
    function drawMainButton() {
        try {
            const iconUrl = "https://www.bondageprojects.elementfx.com/R120/BondageClub/Icons/Extensions.png";
            const text = "";
            const color = currentMode === 'disabled' ? "White" : "#5323a1";

            if (typeof DrawButton === 'function') {
                DrawButton(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE,
                    text, color, iconUrl, "點擊開啟專業調色器");
            }
        } catch (e) {
            safeError("繪製主按鈕失敗:", e);
        }
    }

    // 處理BC內建按鈕點擊
    function handleMainButtonClick() {
        try {
            if (typeof MouseIn === 'function' && MouseIn(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE)) {
                showUI();
                return true;
            }
            return false;
        } catch (e) {
            safeError("處理按鈕點擊失敗:", e);
            return false;
        }
    }

    // 創建觸發按鈕
    function createTriggerButton() {
        const button = document.createElement('button');
        button.innerHTML = '🎨 BG';
        button.title = 'BC背景調色器';
        button.id = 'bc-trigger-button';
        button.style.cssText = [
            'position: fixed',
            'top: 50px',
            'left: 20px',
            'width: 80px',
            'height: 40px',
            'border: 2px solid #4CAF50',
            'border-radius: 8px',
            'background: linear-gradient(135deg, #4CAF50, #45a049)',
            'color: white',
            'font-size: 14px',
            'font-weight: bold',
            'cursor: pointer',
            'z-index: 999999',
            'box-shadow: 0 4px 12px rgba(0,0,0,0.5)',
            'transition: all 0.3s ease'
        ].join(';');

        button.addEventListener('mouseenter', function() {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.6)';
        });

        button.addEventListener('mouseleave', function() {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        });

        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleUI();
        });

        document.body.appendChild(button);
        safeLog("觸發按鈕已創建，位置：左上角");
    }

    // 設置BC hooks
    function setupBCHooks() {
        if (!modApi) return;

        try {
            // AppearanceRun hook - 只繪製BC內建按鈕
            modApi.hookFunction("AppearanceRun", 4, function(args, next) {
                const result = next(args);

                try {
                    if (isMainAppearanceMode()) {
                        drawMainButton();
                    }
                } catch (e) {
                    // 靜默處理繪製錯誤
                }

                return result;
            });

            // AppearanceClick hook - 處理BC內建按鈕點擊
            modApi.hookFunction("AppearanceClick", 4, function(args, next) {
                try {
                    if (isMainAppearanceMode() && handleMainButtonClick()) {
                        return;
                    }
                } catch (e) {
                    // 靜默處理點擊錯誤
                }

                return next(args);
            });

            safeLog("BC hooks 設置完成");
        } catch (e) {
            safeError("設置BC hooks失敗:", e);
        }
    }

    // 更新按鈕可見性
    function updateTriggerButtonVisibility() {
        const button = document.getElementById('bc-trigger-button');
        if (button) {
            if (isInAppearanceScreen()) {
                button.style.display = 'block';
            } else {
                button.style.display = 'none';
                hideUI();
            }
        }
    }

    // 繪製格線
    function drawGrid(ctx, canvas) {
        if (gridMode === 'disabled' || currentMode === 'disabled') return;

        const spacing = {
            'grid10': 10,
            'grid25': 25,
            'grid50': 50
        }[gridMode];

        if (!spacing) return;

        try {
            ctx.save();
            const rgb = hexToRgb(gridColor);
            if (!rgb) return;

            const color = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + gridOpacity + ')';
            const thickColor = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + Math.min(1, gridOpacity + 0.3) + ')';

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

    // 設置背景替換hook
    function setupDrawImageHook() {
        if (originalDrawImage) return;

        originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
        CanvasRenderingContext2D.prototype.drawImage = function(img) {
            const args = Array.prototype.slice.call(arguments, 1);
            try {
                if (img && img.src && img.src.includes("Backgrounds/Dressing.jpg")) {
                    const canvas = this.canvas;
                    if (canvas) {
                        if (currentMode === 'solid') {
                            this.save();
                            this.fillStyle = bgColor;
                            this.fillRect(0, 0, canvas.width, canvas.height);
                            this.restore();
                        } else if (currentMode === 'custom' && customBG) {
                            originalDrawImage.call(this, customBG,
                                0, 0, customBG.width, customBG.height,
                                0, 0, canvas.width, canvas.height
                            );
                        } else {
                            originalDrawImage.apply(this, [img].concat(args));
                        }

                        drawGrid(this, canvas);
                        return;
                    }
                }
            } catch(e) {
                safeError("drawImage hook 錯誤:", e);
            }
            return originalDrawImage.apply(this, [img].concat(args));
        };
        safeLog("drawImage hook 設置完成");
    }

    // 主初始化函數
    function initialize() {
        if (isInitialized) return;

        safeLog("開始初始化 v" + MOD_VERSION + "...");

        waitForGame().then(function(gameLoaded) {
            if (!gameLoaded) {
                safeError("遊戲載入失敗，使用簡化模式");
            }

            // 初始化BC集成（不再創建浮動按鈕）
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
                modApi.onUnload(function() {
                    if (originalDrawImage) {
                        CanvasRenderingContext2D.prototype.drawImage = originalDrawImage;
                    }
                    if (colorPickerUI) colorPickerUI.remove();
                });
            }

            // 添加全域測試函數
            window.BCColorPicker = {
                show: showUI,
                hide: hideUI,
                toggle: toggleUI,
                test: function() {
                    safeLog("=== BC調色器 v" + MOD_VERSION + " ===");
                    safeLog("當前畫面: " + (typeof CurrentScreen !== 'undefined' ? CurrentScreen : '未知'));
                    safeLog("在更衣室主畫面: " + isMainAppearanceMode());
                }
            };

            isInitialized = true;
            safeLog("✅ 初始化完成 v" + MOD_VERSION);
            safeLog("點擊右上角按鈕開啟調色器");
        }).catch(function(e) {
            safeError("初始化失敗:", e);
        });
    }

    initialize();
})();
