// ==UserScript==
// @name         Liko - Region switch
// @name:zh      快速切換混合&女性區
// @namespace    https://likolisu.dev/
// @version      1.1
// @description  快速切換混合/女性區 | Region switch
// @author       Likolisu & yu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let modApi = null;
    const modversion = "1.1";
    const BTN_X = 1555;
    const BTN_Y = 25;
    const BTN_SIZE = 90;
    let inMixedZone = true; // true: 混合區, false: 女性區

    const ICONS = {
        mixed: 'Icons/Gender.png',
        female: 'Screens/Online/ChatSelect/Female.png'
    };

    // 等待 bcModSdk 載入
    async function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[Region switch] bcModSdk 載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }
// 檢測目前區域
function detectCurrentZone() {
    try {
        if (typeof Player !== 'undefined' && Player.ChatSearchSettings) {
            const space = Player.ChatSearchSettings.Space;
            if (space === "X") return true;   // 混合區
            if (space === "") return false;   // 女性區
        }
        if (typeof ChatSearchFemaleOnly !== 'undefined') {
            return !ChatSearchFemaleOnly ? true : false;
        }
    } catch (e) {
        console.warn("[Region switch] 無法判定區域:", e);
    }
    // 預設混合區
    return true;
}

// 載入保存的狀態
function loadSavedState() {
    const storedZone = localStorage.getItem("ChatSearchSwitch_Zone");
    if (storedZone !== null) {
        inMixedZone = storedZone === "Mixed";
    } else {
        // 若沒有保存過，就依目前實際區域設定
        inMixedZone = detectCurrentZone();
    }
}

    // 執行搜索
    function performSearch() {
        try {
            if (typeof Player !== 'undefined' && Player.ChatSearchSettings &&
                typeof ChatSelectStartSearch === 'function' && typeof ChatRoomSpaceType !== 'undefined') {

                if (inMixedZone) {
                    Player.ChatSearchSettings.Space = "X";
                    ChatSelectStartSearch(ChatRoomSpaceType.MIXED);
                } else {
                    Player.ChatSearchSettings.Space = "";
                    ChatSelectStartSearch(ChatRoomSpaceType.FEMALE_ONLY);
                }
            } else {
                // 備用方案
                if (typeof ChatSearchFemaleOnly !== 'undefined') {
                    ChatSearchFemaleOnly = !inMixedZone;
                }
            }
        } catch (error) {
            console.error("[Region switch] 搜索執行錯誤:", error);
        }
    }

    // 切換區域
    function switchZone() {
        inMixedZone = !inMixedZone;
        const target = inMixedZone ? "混合區" : "女性區";

        localStorage.setItem("ChatSearchSwitch_Zone", inMixedZone ? "Mixed" : "FemaleOnly");// 保存狀態
        performSearch();// 執行搜索
    }

    // 載入保存的狀態
    function loadSavedState() {
        const storedZone = localStorage.getItem("ChatSearchSwitch_Zone");
        if (storedZone !== null) {
            inMixedZone = storedZone === "Mixed";
        }
    }

    // 主要初始化函數
    async function init() {
        if (!(await waitForBcModSdk())) {
            return;
        }

        try {
            modApi = bcModSdk.registerMod({
                name: "liko's Region switch",
                fullName: "Region switch",
                version: modversion,
                repository: "快速切換混合&女性區 | Region switch"
            });

            // 載入儲存狀態
            loadSavedState();

            // Hook ChatSearchLoad: 同步狀態
            modApi.hookFunction("ChatSearchLoad", 1, (args, next) => {
    const result = next(args);
    try {
        // 強制同步實際狀態
        inMixedZone = detectCurrentZone();
        Player.ChatSearchSettings.Space = inMixedZone ? "X" : "";
        if (typeof ChatSearchFemaleOnly !== 'undefined') {
            ChatSearchFemaleOnly = !inMixedZone;
        }
    } catch (error) {
        console.error("[Region switch] ChatSearchLoad Hook 錯誤:", error);
    }
    return result;
});

            // Hook ChatSearchRun: 繪製切換按鈕
            modApi.hookFunction("ChatSearchRun", 1, (args, next) => {
                const result = next(args);

                try {
                    if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatSearch" && typeof DrawButton === 'function') {
                        // 按鈕顯示下一個狀態的圖示
                        const icon = inMixedZone ? ICONS.female : ICONS.mixed;
                        const tooltip = `點擊切換到 ${inMixedZone ? "女性區" : "混合區"}`;

                        DrawButton(BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE, "", "White", icon, tooltip);
                    }
                } catch (error) {
                    console.error("[Region switch] ChatSearchRun Hook 錯誤:", error);
                }

                return result;
            });

            // Hook ChatSearchClick: 處理按鈕點擊
            modApi.hookFunction("ChatSearchClick", 4, (args, next) => {
                try {
                    if (typeof CurrentScreen !== 'undefined' && CurrentScreen === "ChatSearch" &&
                        typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined') {

                        // 檢查是否點擊按鈕
                        if (MouseX >= BTN_X && MouseX < BTN_X + BTN_SIZE &&
                            MouseY >= BTN_Y && MouseY < BTN_Y + BTN_SIZE) {

                            switchZone();
                            return; // 阻止事件繼續傳播
                        }
                    }
                } catch (error) {
                    console.error("[Region switch] ChatSearchClick Hook 錯誤:", error);
                }

                return next(args);
            });

        } catch (error) {
            console.error("[Region switch] 初始化失敗:", error);
        }
    }

    // 啟動插件
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
