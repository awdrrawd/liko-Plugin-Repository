// ==UserScript==
// @name         Liko's CDT
// @name:zh      Liko的座標繪製工具
// @namespace    https://likolisu.dev/
// @version      1.3
// @description  在BC所有畫面上顯示 UI 座標與滑鼠位置，方便 UI 對齊調整
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(() => {
    let modApi;
    const modversion = "1.3";
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: 'CDT Universal',
                fullName: 'Bondage Club - Universal Coordinate adjustment tool',
                version: modversion,
                repository: '座標繪製工具 全界面版 // Universal Coordinate adjustment tool',
            });
            console.log("[CDT]✅ Universal 腳本啟動完成");
        } else {
            console.error("[CDT] ❌ bcModSdk 或 registerMod 不可用");
        }
    } catch (e) {
        console.error("[CDT] ❌ 初始化失敗:", e.message);
    }

    if (window.BCUIDebugger) return;

    window.BCUIDebugger = {
        enabled: false,
        elements: [],
        gridSize: 50,
        majorGridSize: 200,
        drag: { active: false, startX: 0, startY: 0, endX: 0, endY: 0, target: null, offsetX: 0, offsetY: 0 },
        floatingButton: null,
        isHooked: false,

        toggle() {
            this.enabled = !this.enabled;
            console.log(`🔧 BCUIDebugger: ${this.enabled ? "啟用" : "停用"}`);
            this.updateButtonState();

            if (!this.enabled && this.elements.length > 0) {
                this.askForExport();
            }
        },

        updateButtonState() {
            if (this.floatingButton) {
                this.floatingButton.style.backgroundColor = this.enabled ? '#4CAF50' : '#C196F4';
                this.floatingButton.style.boxShadow = this.enabled ?
                    '0 4px 8px rgba(76,175,80,0.3)' : '0 4px 8px rgba(244,67,54,0.3)';
            }
        },

        askForExport() {
            if (confirm('要匯出所有標記的座標嗎？\n點擊「確定」匯出為 TXT 檔案\n點擊「取消」僅輸出到 Console')) {
                this.exportToFile();
            } else {
                this.exportToConsole();
            }
            this.clear();
        },

        exportToConsole() {
            console.log('📋 BCUIDebugger 匯出結果:');
            this.elements.forEach((el, index) => {
                console.log(`${index + 1}. 標記: ${el.label} | 座標(${el.x},${el.y}) - 長寬(${el.w},${el.h})`);
            });
        },

        exportToFile() {
            let content = 'BCUIDebugger 匯出結果\n';
            content += '='.repeat(30) + '\n\n';
            this.elements.forEach((el, index) => {
                content += `${index + 1}. 標記: ${el.label}\n`;
                content += `   座標: (${el.x}, ${el.y})\n`;
                content += `   長寬: ${el.w} × ${el.h}\n\n`;
            });
            content += `總共 ${this.elements.length} 個標記\n`;
            content += `匯出時間: ${new Date().toLocaleString()}\n`;

            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `BCUIDebugger_export_${new Date().getTime()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('📁 已匯出 TXT 檔案');
        },

        createFloatingButton() {
            const button = document.createElement('button');
            button.innerHTML = '🖌️';
            button.style.cssText = `
                position: fixed;
                top: 90px;
                right: 20px;
                width: 50px;
                height: 50px;
                border: none;
                border-radius: 50%;
                background-color: #C196F4;
                color: white;
                font-size: 20px;
                cursor: pointer;
                z-index: 10000;
                box-shadow: 0 4px 8px rgba(244,67,54,0.3);
                transition: all 0.3s ease;
                user-select: none;
            `;

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.1)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
            });

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggle();
            });

            document.body.appendChild(button);
            this.floatingButton = button;
        },

        addElement(label, x, y, w, h) {
            this.elements.push({ label, x, y, w, h });
            console.log(`📍 標記 ${label}: 座標(${x},${y}) - 長寬(${w},${h})`);
        },

        clear() {
            this.elements = [];
            console.log("🧹 已清除所有標記");
        },

        drawGrid() {
            if (!this.enabled || typeof DrawRect === "undefined") return;
            for (let x = 0; x <= 2000; x += this.gridSize) {
                const isMajor = x % this.majorGridSize === 0;
                DrawRect(x, 0, 1, 1000, isMajor ? "#666" : "#333", 1);
                if (isMajor && typeof DrawText === "function") {
                    DrawText(x.toString(), x + 2, 15, "#666", "Arial", 12);
                }
            }
            for (let y = 0; y <= 1000; y += this.gridSize) {
                const isMajor = y % this.majorGridSize === 0;
                DrawRect(0, y, 2000, 1, isMajor ? "#666" : "#333", 1);
                if (isMajor && typeof DrawText === "function") {
                    DrawText(y.toString(), 2, y + 12, "#666", "Arial", 12);
                }
            }
        },

        drawMouse() {
            if (!this.enabled || typeof MouseX === "undefined" || typeof DrawText === "undefined") return;
            DrawText(`滑鼠: (${MouseX},${MouseY})`, 10, 30, "Yellow", "Arial", 18);
            if (typeof DrawRect === "function") {
                DrawRect(MouseX - 10, MouseY, 20, 1, "Yellow", 1);
                DrawRect(MouseX, MouseY - 10, 1, 20, "Yellow", 1);
            }
        },

        drawElements() {
            if (!this.enabled || typeof DrawRect === "undefined") return;
            this.elements.forEach(e => {
                DrawRect(e.x, e.y, e.w, e.h, "rgba(255,0,0,0.3)");
                if (typeof DrawTextFit === "function") {
                    DrawTextFit(e.label, e.x + e.w/2, e.y + e.h/2, e.w, "Black");
                }
            });
        },

        drawDragBox() {
            if (!this.enabled || !this.drag.active || this.drag.target || typeof DrawRect === "undefined") return;
            const { startX, startY, endX, endY } = this.drag;
            const x = Math.min(startX, endX);
            const y = Math.min(startY, endY);
            const w = Math.abs(endX - startX);
            const h = Math.abs(endY - startY);
            DrawRect(x, y, w, h, "rgba(0,255,0,0.3)");
            if (typeof DrawTextFit === "function") {
                DrawTextFit(`(${x},${y}) ${w}×${h}`, x + w/2, y + h/2, w, "Black");
            }
        },

        draw() {
            if (!this.enabled) return;
            this.drawGrid();
            this.drawMouse();
            this.drawElements();
            this.drawDragBox();
        },

        // 使用 ModSDK 來 hook 函數
        hookWithModSDK() {
            if (!modApi || this.isHooked) return;

            try {
                // Hook 主要的繪圖函數
                const functionsToHook = [
                    'MainRun',
                    'ChatRoomRun',
                    'CharacterAppearanceRun',
                    'InformationSheetRun',
                    'PreferenceRun',
                    'LoginRun',
                    'GameRun'
                ];

                let hookCount = 0;
                functionsToHook.forEach(funcName => {
                    if (typeof window[funcName] === 'function') {
                        try {
                            modApi.hookFunction(funcName, 4, (args, next) => {
                                const result = next(args);
                                try {
                                    BCUIDebugger.draw();
                                } catch (e) {
                                    // 靜默處理繪圖錯誤
                                }
                                return result;
                            });
                            hookCount++;
                        } catch (e) {
                            console.warn(`[CDT] 無法 hook ${funcName}:`, e.message);
                        }
                    }
                });

                console.log(`[CDT]✅ 使用 ModSDK 成功 hook ${hookCount} 個函數`);
                this.isHooked = true;
            } catch (e) {
                console.warn("[CDT] ModSDK hook 失敗，嘗試使用備用方案:", e.message);
                this.fallbackHook();
            }
        },

        // 備用的 hook 方案 - 使用間隔執行
        fallbackHook() {
            console.log("🔄 CDT: 使用備用方案 - 定時繪圖");

            // 使用 requestAnimationFrame 來定期檢查和繪圖
            const drawLoop = () => {
                if (this.enabled) {
                    try {
                        this.draw();
                    } catch (e) {
                        // 靜默處理錯誤
                    }
                }
                requestAnimationFrame(drawLoop);
            };

            // 等待 BC 載入後開始
            const startDrawLoop = () => {
                if (typeof DrawRect !== "undefined") {
                    console.log("✅ CDT: 備用方案啟動成功");
                    drawLoop();
                } else {
                    setTimeout(startDrawLoop, 1000);
                }
            };

            startDrawLoop();
        },

        // 等待並初始化 hook
        initializeHooks() {
            const init = () => {
                if (typeof DrawRect !== "undefined") {
                    if (modApi) {
                        this.hookWithModSDK();
                    } else {
                        this.fallbackHook();
                    }
                } else {
                    setTimeout(init, 1000);
                }
            };

            setTimeout(init, 2000); // 給 BC 一些時間載入
        }
    };

    // ===== 監聽滑鼠事件 =====
    window.addEventListener("mousedown", e => {
        if (!BCUIDebugger.enabled) return;
        if (typeof MouseX === "undefined") return;

        // 檢查是否點擊已標記元素 → 拖動模式
        const clicked = BCUIDebugger.elements.find(el =>
            MouseX >= el.x && MouseX <= el.x + el.w &&
            MouseY >= el.y && MouseY <= el.y + el.h
        );
        if (clicked) {
            BCUIDebugger.drag.active = true;
            BCUIDebugger.drag.target = clicked;
            BCUIDebugger.drag.offsetX = MouseX - clicked.x;
            BCUIDebugger.drag.offsetY = MouseY - clicked.y;
        } else {
            // 拖拉新框
            BCUIDebugger.drag.active = true;
            BCUIDebugger.drag.startX = MouseX;
            BCUIDebugger.drag.startY = MouseY;
            BCUIDebugger.drag.endX = MouseX;
            BCUIDebugger.drag.endY = MouseY;
            BCUIDebugger.drag.target = null;
        }
    });

    window.addEventListener("mousemove", e => {
        if (!BCUIDebugger.enabled || !BCUIDebugger.drag.active) return;
        if (typeof MouseX === "undefined") return;

        if (BCUIDebugger.drag.target) {
            // 拖動已標記元素
            BCUIDebugger.drag.target.x = MouseX - BCUIDebugger.drag.offsetX;
            BCUIDebugger.drag.target.y = MouseY - BCUIDebugger.drag.offsetY;
        } else {
            // 拖拉新框
            BCUIDebugger.drag.endX = MouseX;
            BCUIDebugger.drag.endY = MouseY;
        }
    });

    window.addEventListener("mouseup", e => {
        if (!BCUIDebugger.enabled || !BCUIDebugger.drag.active) return;
        if (typeof MouseX === "undefined") return;

        BCUIDebugger.drag.active = false;

        if (!BCUIDebugger.drag.target) {
            // 拖拉新框完成
            const x = Math.min(BCUIDebugger.drag.startX, BCUIDebugger.drag.endX);
            const y = Math.min(BCUIDebugger.drag.startY, BCUIDebugger.drag.endY);
            const w = Math.abs(BCUIDebugger.drag.endX - BCUIDebugger.drag.startX);
            const h = Math.abs(BCUIDebugger.drag.endY - BCUIDebugger.drag.startY);

            if (w > 5 && h > 5) {
                const label = prompt(`抓取到框框 座標(${x},${y}) - 長寬(${w}×${h})\n要加入 BCUIDebugger 嗎？輸入標籤文字，取消則不加入`);
                if (label) BCUIDebugger.addElement(label, x, y, w, h);
            }
        } else {
            // 拖動已標記元素結束
            const el = BCUIDebugger.drag.target;
            console.log(`📌 標記 "${el.label}" 移動到新座標: 座標(${el.x},${el.y}) - 長寬(${el.w},${el.h})`);
            BCUIDebugger.drag.target = null;
        }
    });

    // 創建浮動按鈕
    BCUIDebugger.createFloatingButton();

    // 初始化 hook 系統
    BCUIDebugger.initializeHooks();

    console.log("[CDT]✅ Universal v1.4 - BCUIDebugger 已載入");
    console.log("使用說明:");
    console.log("• 點擊右上角 🖌️ 按鈕開關調試模式");
    console.log("• BCUIDebugger.toggle() - 開關調試模式");
    console.log("• BCUIDebugger.addElement('按鈕1', 100, 200, 120, 40) - 手動標記元素");
    console.log("• BCUIDebugger.clear() - 清除所有標記");
})();
