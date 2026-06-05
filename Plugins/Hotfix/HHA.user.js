// ==UserScript==
// @name         Hotfix - Hidden Arousal
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository/
// @version      0.1
// @description  Hidden Arousal in Appearance, InformationSheet, ChatRoom+CurrentCharacter
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    // Hotfix for R128

    if (window.LikoHAIWInstance) {
        console.warn('🐈‍⬛ [HHA] already loaded, skipping duplicate');
        return;
    }
    window.LikoHAIWInstance = true;

    const MOD_NAME    = "Hotfix - Hidden Arousal";
    const MOD_VERSION = "0.1";

    // ── 等待 bcModSdk ──
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

    // ── 等待遊戲本體 ──
    function waitForGame() {
        return waitFor(function () {
            return typeof CurrentScreen !== 'undefined' &&
                typeof PreferenceArousalAtLeast === 'function' &&
                typeof Player !== 'undefined';
        });
    }

    // ── 等待 bcModSdk ──
    function waitForSdk() {
        return waitFor(function () {
            return typeof bcModSdk !== 'undefined' && typeof bcModSdk.registerMod === 'function';
        });
    }

    function setup(modApi) {
        const original = PreferenceArousalAtLeast;

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

        PreferenceArousalAtLeast = function (C, level) {
            if (shouldHide()) return false;
            return original(C, level);
        };

        function restore() {
            PreferenceArousalAtLeast = original;
        }
        if (modApi && modApi.onUnload) {
            modApi.onUnload(restore);
        }
        window.LikoHAIWRestore = restore;
    }

    Promise.all([waitForGame(), waitForSdk()]).then(function (results) {
        const gameOk = results[0];
        if (!gameOk) {
            console.error('🐈‍⬛ [HHA] ❌ 遊戲載入逾時，無法初始化');
            return;
        }

        let modApi = null;

        if (typeof bcModSdk !== 'undefined' && bcModSdk.registerMod) {
            try {
                modApi = bcModSdk.registerMod({
                    name: "HHA",
                    fullName: MOD_NAME,
                    version: MOD_VERSION,
                    repository: 'Hidden Arousal in Appearance, InformationSheet, ChatRoom+CurrentCharacter'
                });
                console.log('🐈‍⬛ [HHA] ✅ 已透過 bcModSdk 註冊');
            } catch (e) {
                console.warn('🐈‍⬛ [HHA] ⚠️ bcModSdk 註冊失敗，改用 standalone 模式:', e);
            }
        } else {
            console.log('🐈‍⬛ [HHA] ℹ️ bcModSdk 未找到，使用 standalone 模式');
        }

        setup(modApi);
    });

})();
