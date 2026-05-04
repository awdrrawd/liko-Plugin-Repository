// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器-L
// @namespace    https://likulisu.dev/
// @version      1.0.3
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @updateURL    https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Plugin_Collection_Manager.user.js
// @downloadURL  https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-Plugin_Collection_Manager.user.js
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository/issues
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // 全域載入腳本
    const globalScripts = [
        "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js",
        "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js"
    ];

    globalScripts.forEach(url => {
        const script = document.createElement("script");
        script.src = `${url}?timestamp=${Date.now()}`;
        script.type = "text/javascript";
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
    });

    // 等待 bcModSdk 載入
    async function waitForBcModSdk(timeout = 10000) {
        const interval = 200;
        let waited = 0;
        return new Promise((resolve, reject) => {
            const timer = setInterval(() => {
                const sdk = window.bcModSdk || unsafeWindow?.bcModSdk;
                if (sdk?.registerMod) {
                    clearInterval(timer);
                    resolve(sdk);
                } else if (waited >= timeout) {
                    clearInterval(timer);
                    reject(new Error("bcModSdk 載入超時"));
                }
                waited += interval;
            }, interval);
        });
    }

    // 載入主程式
(async () => {
    console.log("🐈‍⬛ [PCM] ⏳ 等待 bcModSdk 載入...");
    try {
        const sdk = await waitForBcModSdk();
        console.log("🐈‍⬛ [PCM] ✅ bcModSdk 已載入");

        // ↓ 把這個函數加在這裡
        const MAIN_CACHE_KEY = "pcm_main_code_cache";
        const MAIN_CACHE_TTL = 24 * 60 * 60 * 1000;
        const url = "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";

        async function fetchMainCode() {
            const cached = JSON.parse(localStorage.getItem(MAIN_CACHE_KEY) || "null");
            const hasValidCache = cached && (Date.now() - cached.time < MAIN_CACHE_TTL);

            if (hasValidCache) {
                setTimeout(() => {
                    fetch(url, { cache: "no-cache" })
                        .then(r => r.text())
                        .then(code => {
                            localStorage.setItem(MAIN_CACHE_KEY, JSON.stringify({ time: Date.now(), code }));
                        })
                        .catch(() => {});
                }, 0);
                return cached.code;
            }

            const code = await fetch(url, { cache: "no-cache" }).then(r => r.text());
            localStorage.setItem(MAIN_CACHE_KEY, JSON.stringify({ time: Date.now(), code }));
            return code;
        }

        // ↓ 原本的 fetch 一行替換成這個
        const code = await fetchMainCode();

        window.bcModSdk = sdk;
        eval(code);
        console.log("🐈‍⬛ [PCM] ✅ 主程式已啟動");
    } catch (e) {
        console.error("🐈‍⬛ [PCM] ❌ 初始化失敗:", e.message);
    }
})();
})();
