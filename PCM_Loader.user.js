// ==UserScript==
// @name           Liko - Plugin Collection Manager-Loader
// @name:zh        Liko的插件管理器-L
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.2
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

    // 依序抓主體：先 jsDelivr，失敗才退 raw。切勿並行同打兩邊 —— raw.githubusercontent 有速率限制，
    // 在 Electron-BC（單一 IP、啟動時大量子插件同時抓）容易觸發 429，連帶讓翻譯字庫抓取失敗。
    // 下載優先，快取只當救援：先嘗試抓最新版並直接執行；只有「抓不到」或「抓到的檔案執行出錯」
    // 才退回使用舊快取。快取本身不設有效期(TTL)——它不是用來判斷「新不新鮮」，純粹是下載失敗
    // 時的最後一道防線，所以只有在新版成功執行後才會覆蓋掉它，絕不會因為舊檔還沒過期就搶著先用。
    const MAIN_REL       = "Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";
    const MAIN_URLS      = [
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/" + MAIN_REL,
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/" + MAIN_REL,
    ];
    const MAIN_CACHE_KEY = "pcm_main_cache";

    function getCachedMain() {
        try {
            const c = JSON.parse(localStorage.getItem(MAIN_CACHE_KEY) || "null");
            return c?.code ?? null;
        } catch(e) { return null; }
    }

    function setCachedMain(code) {
        try { localStorage.setItem(MAIN_CACHE_KEY, JSON.stringify({ time: Date.now(), code })); } catch(e) {}
    }

    // 依序抓取（jsDelivr 優先，失敗才退 raw）並驗證內容（避免把 404 的 HTML 當 JS）
    async function fetchMainRaced() {
        let lastErr;
        for (const url of MAIN_URLS) {
            try {
                const res = await fetch(url, { cache: "no-cache" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const code = await res.text();
                if (!code || code.trimStart().startsWith('<')) throw new Error("Invalid response");
                return code;
            } catch(e) { lastErr = e; console.warn(`🐈‍⬛ [PCM Loader] ⚠️ ${url}: ${e.message}`); }
        }
        throw lastErr ?? new Error("all main URLs failed");
    }

    (async () => {
        const oldCache = getCachedMain(); // 先留著當救援，下載/執行成功前絕不覆蓋掉它

        let freshCode = null;
        try {
            freshCode = await fetchMainRaced();
        } catch(e) {
            console.warn(`🐈‍⬛ [PCM Loader] ⚠️ 下載失敗，改用舊版快取：${e.message}`);
        }

        if (freshCode) {
            try {
                // eslint-disable-next-line no-eval
                eval(freshCode);
                setCachedMain(freshCode); // 執行成功才覆蓋快取，避免存進一份會炸掉的版本
                console.log("🐈‍⬛ [PCM Loader] ✅ Main script started (latest)");
                return;
            } catch(evalErr) {
                console.error(`🐈‍⬛ [PCM Loader] ❌ 新版執行失敗，改用舊版快取：${evalErr.message}`);
            }
        }

        if (oldCache) {
            try {
                // eslint-disable-next-line no-eval
                eval(oldCache);
                console.log("🐈‍⬛ [PCM Loader] ✅ Main script started (cached fallback)");
            } catch(e) {
                console.error("🐈‍⬛ [PCM Loader] ❌ 舊版快取也執行失敗", e.message);
            }
        } else {
            console.error("🐈‍⬛ [PCM Loader] ❌ 無可用版本（下載失敗且無快取）");
        }
    })();
})();