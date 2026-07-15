// ==UserScript==
// @name         Hotfix - Hidden Arousal
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository/
// @version      0.2
// @description  Hidden Arousal in Appearance, InformationSheet, ChatRoom+CurrentCharacter
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HHA.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HHA.user.js
// ==/UserScript==
//修復訪問衣櫃時，興奮條異常殘留
(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.2";
    if (window.Liko.HHA) return;
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
                   typeof PreferenceArousalAtLeast === 'function' &&
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
                repository: 'Hidden Arousal in Appearance, InformationSheet, ChatRoom+CurrentCharacter'
            });
        } catch (e) {
            console.error('🐈‍⬛ [HHA] ❌ SDK 註冊失敗:', e);
            return;
        }
        
        modApi.hookFunction('PreferenceArousalAtLeast', 1, function (args, next) {
            if (shouldHide()) return false;
            return next(args);
        });
        console.log(`🐈‍⬛ [HHA] v${MOD_VERSION} loaded`);
    });

})();
