// ==UserScript==
// @name         Hotfix - Hidden Arousal
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.4
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
(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.HHA) return;

    const MOD_VERSION = '0.4';
    const REGISTRY_KEY = '__hotfix_HiddenArousal';
    window.Liko.HHA = MOD_VERSION;

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

    function shouldHide() {
        try {
            const s = CurrentScreen;
            if (s === 'Appearance' || s === 'InformationSheet') return true;
            return s === 'ChatRoom'
                && typeof CurrentCharacter !== 'undefined'
                && CurrentCharacter !== null;
        } catch (_) { return false; }
    }

    function getRegistry() {
        const current = window.Liko[REGISTRY_KEY];
        if (current?.version === 1 && current.providers) return current;
        return window.Liko[REGISTRY_KEY] = { version: 1, installed: false, providers: {} };
    }

    Promise.all([
        waitFor(() => typeof CurrentScreen !== 'undefined'
            && typeof DrawArousalMeter === 'function'
            && typeof Player !== 'undefined'),
        waitFor(() => typeof bcModSdk !== 'undefined'
            && typeof bcModSdk.registerMod === 'function'),
    ]).then(function (results) {
        if (!results[0] || !results[1]) {
            console.error('🐈‍⬛ [HHA] Game or ModSDK unavailable');
            return;
        }

        let modApi;
        try {
            modApi = bcModSdk.registerMod({
                name: 'HHA',
                fullName: 'Hotfix - Hidden Arousal',
                version: MOD_VERSION,
                repository: 'https://github.com/awdrrawd/liko-Plugin-Repository',
            });
        } catch (e) {
            console.error('🐈‍⬛ [HHA] ModSDK registration failed:', e);
            return;
        }

        const registry = getRegistry();
        registry.providers.HHA = shouldHide;
        if (!registry.installed) {
            modApi.hookFunction('DrawArousalMeter', 10, function (args, next) {
                for (const provider of Object.values(registry.providers)) {
                    try { if (provider()) return; } catch (_) { /* ignore an unloading provider */ }
                }
                return next(args);
            });
            registry.installed = true;
        }

        console.log(`🐈‍⬛ [HHA] v${MOD_VERSION} loaded`);
    });
})();
