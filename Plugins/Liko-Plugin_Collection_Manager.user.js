// ==UserScript==
// @name           Liko - Plugin Collection Manager-Loader
// @name:zh        Liko的插件管理器-L
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.1
// @description    Liko's Plugin Collection Manager
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @updateURL      https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Plugin_Collection_Manager.user.js
// @downloadURL    https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Plugin_Collection_Manager.user.js
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository/issues
// @run-at         document-end
// ==/UserScript==

(function () {
    "use strict";

    const CDN            = "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/";
    const MAIN_URL       = CDN + "main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";
    const MAIN_CACHE_KEY = "pcm_main_cache";
    const MAIN_CACHE_TTL = 24 * 60 * 60 * 1000;

    function getCachedMain() {
        try {
            const c = JSON.parse(localStorage.getItem(MAIN_CACHE_KEY) || "null");
            if (c && Date.now() - c.time < MAIN_CACHE_TTL) return c.code;
        } catch(e) {}
        return null;
    }

    function setCachedMain(code) {
        try { localStorage.setItem(MAIN_CACHE_KEY, JSON.stringify({ time: Date.now(), code })); } catch(e) {}
    }

    async function fetchMain() {
        const cached = getCachedMain();
        if (cached) {
            // SWR: background update
            fetch(MAIN_URL, { cache: "no-cache" })
                .then(r => r.text())
                .then(code => { if (code && !code.trimStart().startsWith('<')) setCachedMain(code); })
                .catch(() => {});
            return cached;
        }
        const res = await fetch(MAIN_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const code = await res.text();
        if (!code || code.trimStart().startsWith('<')) throw new Error("Invalid response");
        setCachedMain(code);
        return code;
    }

    (async () => {
        try {
            const code = await fetchMain();
            // eslint-disable-next-line no-eval
            eval(code);
            console.log("🐈‍⬛ [PCM Loader] ✅ Main script started");
        } catch(e) {
            console.error("🐈‍⬛ [PCM Loader] ❌", e.message);
        }
    })();
})();
