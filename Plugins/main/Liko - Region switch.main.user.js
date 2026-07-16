// ==UserScript==
// @name         Liko - Region switch
// @name:zh      快速切換混合&女性區
// @namespace    https://likolisu.dev/
// @version      1.3.1
// @description  快速切換混合/女性區 | Region switch
// @author       Likolisu & yu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Region%20switch.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Region%20switch.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.3.1";
    if (window.Liko.RegionSwitch) return;
    window.Liko.RegionSwitch = MOD_VER;

    let modApi = null;
    let inMixedZone = true;
    let switchButton = null;

    const ES_KEY = "RegionSwitch";              // Player.ExtensionSettings 的 key
    const LS_KEY = "ChatSearchSwitch_Zone";     // 舊版 localStorage key（僅供一次性搬移）

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
                    console.error("🐈‍⬛ [Region switch] ❌ bcModSdk 載入超時");
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
            console.warn("🐈‍⬛ [Region switch] ❌ 無法判定區域:", e);
        }
        return true;
    }

    // 等待 ExtensionSettings 由伺服器載入（最多 ~15 秒）
    function waitForExtensionSettings(timeout = 15000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof Player !== 'undefined' && Player && Player.ExtensionSettings !== undefined) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 200);
            };
            check();
        });
    }

    function saveZone() {
        try {
            if (typeof Player === 'undefined' || !Player) return;
            if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
            Player.ExtensionSettings[ES_KEY] = inMixedZone ? "Mixed" : "FemaleOnly";
            if (typeof ServerPlayerExtensionSettingsSync === 'function') {
                ServerPlayerExtensionSettingsSync(ES_KEY);
            }
        } catch (e) {
            console.warn("🐈‍⬛ [Region switch] ❌ 設定儲存失敗:", e.message);
        }
    }

    async function loadSavedState() {
        if (!(await waitForExtensionSettings())) {
            inMixedZone = detectCurrentZone();
            return;
        }

        const storedZone = Player?.ExtensionSettings?.[ES_KEY] ?? migrateFromLocalStorage();
        if (storedZone === "Mixed" || storedZone === "FemaleOnly") {
            inMixedZone = storedZone === "Mixed";
        } else {
            inMixedZone = detectCurrentZone();
        }
    }

    /** 一次性搬移：舊的 localStorage 設定讀進來寫入 DB，成功後刪除原本的 key */
    function migrateFromLocalStorage() {
        let legacy = null;
        try { legacy = localStorage.getItem(LS_KEY); } catch (e) { return null; }
        if (legacy !== "Mixed" && legacy !== "FemaleOnly") return null;

        inMixedZone = legacy === "Mixed";
        saveZone();
        if (Player?.ExtensionSettings?.[ES_KEY] === legacy) {
            try { localStorage.removeItem(LS_KEY); } catch (e) {}
            console.log("🐈‍⬛ [Region switch] ✅ 設定已從 localStorage 搬移至 DB");
        }
        return legacy;
    }

    function performSearch() {
        try {
            // 僅在聊天搜尋畫面且 InputSearch 元素存在時才搜尋。
            // ChatSearchQuery 是非同步的，其伺服器回應會存取 InputSearch DOM
            // (ChatSearchResultResponse / ChatSearchApplyFilterTerms)，
            // 若此時元素已被移除，回傳的每個房間都會噴一次
            // ElementValue/ElementContent "missing element: InputSearch" 錯誤。
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== "ChatSearch") return;
            if (!document.getElementById("InputSearch")) return;

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
            console.error("🐈‍⬛ [Region switch] ❌ 搜索執行錯誤:", error);
        }
    }

    function switchZone() {
        inMixedZone = !inMixedZone;
        saveZone();
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
                name: "liko - Region switch",
                fullName: "Region switch",
                version: MOD_VER,
                repository: "快速切換混合&女性區 | Region switch"
            });

            loadSavedState();   // 非同步等待 ExtensionSettings，不擋住 hook 註冊

            modApi.hookFunction("ChatSearchLoad", 1, (args, next) => {
                const result = next(args);
                try {
                    inMixedZone = detectCurrentZone();
                    Player.ChatSearchSettings.Space = inMixedZone ? "X" : "";
                    ChatSearchSpace = Player.ChatSearchSettings.Space;

                    setTimeout(createSwitchButton, 50);
                } catch (error) {
                    console.error("🐈‍⬛ [Region switch] ❌ ChatSearchLoad Hook 錯誤:", error);
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
            console.error("🐈‍⬛ [Region switch] ❌ 初始化失敗:", error);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
