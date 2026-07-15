// ==UserScript==
// @name           Liko - Plugin Collection Manager-Loader
// @name:zh        Liko的插件管理器-L
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.2.1
// @description    Liko's Plugin Collection Manager
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @updateURL      https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js
// @downloadURL    https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository/issues
// @run-at         document-end
// ==/UserScript==

(function () {
    "use strict";

    const MAIN_REL = "Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";

    // 優先序：
    // 1. GitHub Pages — 即時（push 後幾乎立刻生效）且不會 429，帶時間戳確保拿最新版
    // 2. raw.githubusercontent — 即時，但限流嚴格，只在 Pages 掛掉時當備援，不加時間戳降低疊加量
    // 3. jsDelivr — 可能有快取延遲（有時隔天才更新），但幾乎不會掛，留著當最後保底
    function buildMainUrls() {
        const ts = Date.now();
        return [
            `https://awdrrawd.github.io/liko-Plugin-Repository/${MAIN_REL}?timestamp=${ts}`,
            `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/${MAIN_REL}`,
            `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${MAIN_REL}`,
        ];
    }

    const MAIN_CACHE_KEY = "pcm_main_cache";

    function getCachedMain() {
        try {
            const c = JSON.parse(localStorage.getItem(MAIN_CACHE_KEY) || "null");
            return c?.code ?? null;
        } catch (e) { return null; }
    }

    function setCachedMain(code) {
        try { localStorage.setItem(MAIN_CACHE_KEY, JSON.stringify({ time: Date.now(), code })); } catch (e) {}
    }

    // 依序抓取，第一個成功就回傳，不並行、不對 raw/jsDelivr 加時間戳
    async function fetchMainSequential() {
        let lastErr;
        for (const url of buildMainUrls()) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const code = await res.text();
                if (!code || code.trimStart().startsWith('<')) throw new Error("Invalid response");
                return code;
            } catch (e) { lastErr = e; console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`); }
        }
        throw lastErr ?? new Error("all main URLs failed");
    }

    (async () => {
        const oldCache = getCachedMain();

        let freshCode = null;
        try {
            freshCode = await fetchMainSequential();
        } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ 下載失敗，改用舊版快取：${e.message}`);
        }

        if (freshCode) {
            try {
                eval(freshCode);
                setCachedMain(freshCode);
                console.log("🐈‍⬛ [PCM] ✅ Main script started (latest)");
                return;
            } catch (evalErr) {
                console.error(`🐈‍⬛ [PCM] ❌ 新版執行失敗，改用舊版快取：${evalErr.message}`);
            }
        }

        if (oldCache) {
            try {
                eval(oldCache);
                console.log("🐈‍⬛ [PCM] ✅ Main script started (cached fallback)");
            } catch (e) {
                console.error("🐈‍⬛ [PCM] ❌ 舊版快取也執行失敗", e.message);
            }
        } else {
            console.error("🐈‍⬛ [PCM] ❌ 無可用版本（下載失敗且無快取）");
        }
    })();
})();
