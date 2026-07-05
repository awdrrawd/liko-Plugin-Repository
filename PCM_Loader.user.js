// ==UserScript==
// @name           Liko - Plugin Collection Manager-Loader
// @name:zh        Liko的插件管理器-L
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.1
// @description    Liko's Plugin Collection Manager
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @updateURL      https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/PCM_Loader.user.js
// @downloadURL    https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/PCM_Loader.user.js
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository/issues
// @run-at         document-end
// ==/UserScript==

(function () {
    "use strict";

    // 雙通道競速：jsDelivr + raw 同時抓主體，誰先回有效 JS 就用誰（其一被封鎖/慢也不卡）
    const MAIN_REL       = "Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";
    const MAIN_URLS      = [
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/" + MAIN_REL,
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/" + MAIN_REL,
    ];
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

    // 競速抓取並驗證內容（避免把 404 的 HTML 當 JS）
    function fetchMainRaced() {
        return Promise.any(MAIN_URLS.map(async url => {
            const res = await fetch(url, { cache: "no-cache" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const code = await res.text();
            if (!code || code.trimStart().startsWith('<')) throw new Error("Invalid response");
            return code;
        }));
    }

    async function fetchMain() {
        const cached = getCachedMain();
        if (cached) {
            // SWR: background update（競速）
            fetchMainRaced().then(code => setCachedMain(code)).catch(() => {});
            return cached;
        }
        const code = await fetchMainRaced();
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
