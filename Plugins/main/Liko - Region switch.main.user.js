// ==UserScript==
// @name         Liko - Region switch
// @name:zh      快速切換混合&女性區
// @namespace    https://likolisu.dev/
// @version      1.2
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
    const modversion = "1.2";
    let inMixedZone = true;
    let switchButton = null;

    const ICONS = {
        mixed: 'Icons/Gender.png',
        female: 'Screens/Online/ChatSelect/Female.png'
    };

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

    function detectCurrentZone() {
        try {
            if (typeof Player !== 'undefined' && Player.ChatSearchSettings) {
                const space = Player.ChatSearchSettings.Space;
                if (space === "X") return true;
                if (space === "") return false;
            }
        } catch (e) {
            console.warn("[Region switch] 無法判定區域:", e);
        }
        return true;
    }

    function loadSavedState() {
        const storedZone = localStorage.getItem("ChatSearchSwitch_Zone");
        if (storedZone !== null) {
            inMixedZone = storedZone === "Mixed";
        } else {
            inMixedZone = detectCurrentZone();
        }
    }

    function performSearch() {
        try {
            // 只更新 Player.ChatSearchSettings.Space 和 ChatSearchSpace
            if (inMixedZone) {
                Player.ChatSearchSettings.Space = "X";
                ChatSearchSpace = "X";
            } else {
                Player.ChatSearchSettings.Space = "";
                ChatSearchSpace = "";
            }

            // 重新搜索
            ChatSearchQuery(ChatSearchQueryString);
        } catch (error) {
            console.error("[Region switch] 搜索執行錯誤:", error);
        }
    }

    function switchZone() {
        inMixedZone = !inMixedZone;
        localStorage.setItem("ChatSearchSwitch_Zone", inMixedZone ? "Mixed" : "FemaleOnly");
        updateButtonAppearance();
        performSearch();
    }

    function updateButtonAppearance() {
        if (!switchButton) return;

        const icon = inMixedZone ? ICONS.female : ICONS.mixed;
        const tooltip = `切換到 ${inMixedZone ? "女性區" : "混合區"}`;

        const img = switchButton.querySelector('img');
        if (img) img.src = icon;

        const tooltipEl = switchButton.querySelector('.button-tooltip');
        if (tooltipEl) tooltipEl.textContent = tooltip;
    }

    function createSwitchButton() {
        if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "ChatSearch") return;

        const navSection = document.getElementById('chat-search-room-navigation-section');
        if (!navSection) return;

        const oldButton = document.getElementById('liko-region-switch-button');
        if (oldButton) oldButton.remove();

        if (typeof ElementButton === 'undefined' || !ElementButton.Create) return;

        const icon = inMixedZone ? ICONS.female : ICONS.mixed;
        const tooltip = `切換到 ${inMixedZone ? "女性區" : "混合區"}`;

        switchButton = ElementButton.Create(
            "liko-region-switch-button",
            switchZone,
            {
                tooltip: tooltip,
                tooltipPosition: "bottom",
                image: icon,
            },
            {
                button: { classList: ["chat-search-room-button"] },
            }
        );

        const firstButton = navSection.querySelector('button');
        if (firstButton) {
            navSection.insertBefore(switchButton, firstButton);
        } else {
            navSection.appendChild(switchButton);
        }
    }

    async function init() {
        if (!(await waitForBcModSdk())) return;

        try {
            modApi = bcModSdk.registerMod({
                name: "liko's Region switch",
                fullName: "Region switch",
                version: modversion,
                repository: "快速切換混合&女性區 | Region switch"
            });

            loadSavedState();

            modApi.hookFunction("ChatSearchLoad", 1, (args, next) => {
                const result = next(args);
                try {
                    inMixedZone = detectCurrentZone();
                    Player.ChatSearchSettings.Space = inMixedZone ? "X" : "";
                    ChatSearchSpace = Player.ChatSearchSettings.Space;

                    setTimeout(createSwitchButton, 50);
                } catch (error) {
                    console.error("[Region switch] ChatSearchLoad Hook 錯誤:", error);
                }
                return result;
            });

            modApi.hookFunction("ChatSearchRun", 1, (args, next) => {
                const result = next(args);

                if (!document.getElementById('liko-region-switch-button')) {
                    createSwitchButton();
                }

                return result;
            });

        } catch (error) {
            console.error("[Region switch] 初始化失敗:", error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
