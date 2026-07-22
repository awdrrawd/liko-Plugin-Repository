// ==UserScript==
// @name         Hotfix - Hidden Arousal
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.3
// @description  Hides arousal meter AND any mod-added HUD attached to DrawArousalMeter (e.g. MPA) in Appearance, InformationSheet, ChatRoom+CurrentCharacter
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HHA.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HHA.user.js
// ==/UserScript==
//修復訪問衣櫃時，興奮條異常殘留 + 隱藏其他模組掛在 DrawArousalMeter 上的附加 HUD（例如 MPA 的寵物狀態球）
(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.HHA) return;
    const MOD_VERSION = "0.3";
    window.Liko.HHA = MOD_VERSION;
    const MOD_NAME    = "HHA";
    const MOD_FULL    = "Hotfix - Hidden Arousal";

    function waitFor(predicate, timeout) {
        timeout = timeout || 20000;
        const start = Date.now();
        return new Promise(function (resolve) {
            (function check() {
                if (predicate()) return resolve(true);
                if (Date.now() - start > timeout) return resolve(false);
                setTimeout(check, 100);
            })();
        });
    }
    function waitForGame() {
        return waitFor(function () {
            return typeof CurrentScreen !== 'undefined' &&
                   typeof DrawArousalMeter === 'function' &&
                   typeof Player !== 'undefined';
        });
    }
    function waitForSdk() {
        return waitFor(function () {
            return typeof bcModSdk !== 'undefined' &&
                   typeof bcModSdk.registerMod === 'function';
        });
    }
    function shouldHide() {
        try {
            const s = CurrentScreen;
            if (s === 'Appearance')       return true;
            if (s === 'InformationSheet') return true;
            if (s === 'ChatRoom' &&
                typeof CurrentCharacter !== 'undefined' &&
                CurrentCharacter !== null) return true;
        } catch (_) {}
        return false;
    }

    Promise.all([waitForGame(), waitForSdk()]).then(function (results) {
        if (!results[0]) {
            console.error('🐈‍⬛ [HHA] ❌ 遊戲載入逾時');
            return;
        }
        let modApi = null;
        try {
            modApi = bcModSdk.registerMod({
                name: MOD_NAME,
                fullName: MOD_FULL,
                version: MOD_VERSION,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
            });
        } catch (e) {
            console.error('🐈‍⬛ [HHA] ❌ SDK 註冊失敗:', e);
            return;
        }

        // priority 設得高，確保比 MPA（priority:1）等任何掛在 DrawArousalMeter
        // 上的模組都更「外層」，一旦判定要隱藏，直接不呼叫 next()，
        // 讓整條 hook 鏈（含 MPA 自己的邏輯）完全不執行，
        // 三個畫面（Appearance / InformationSheet / ChatRoom+對話框）統一生效。
        modApi.hookFunction('DrawArousalMeter', 10, function (args, next) {
            if (shouldHide()) return; // 不呼叫 next，內建興奮條 + MPA 附加 HUD 全部跳過
            return next(args);
        });

        console.log(`🐈‍⬛ [HHA] ✅ v${MOD_VERSION} loaded`);
    });
})();