// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://likulisu.dev/
// @version      1.02
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
        console.log("[PCM] ⏳ 等待 bcModSdk 載入...");
        try {
            const sdk = await waitForBcModSdk();
            console.log("[PCM] ✅ bcModSdk 已載入");

            // 抓主程式碼
            const url = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";
            const code = await fetch(url).then(r => r.text());

            // 提供給主程式使用
            window.bcModSdk = sdk;

            eval(code);
            console.log("[PCM] ✅ 主程式已啟動");
        } catch (e) {
            console.error("[PCM] ❌ 初始化失敗:", e.message);
        }
    })();

    console.log('[PCM] ✅ 啟用完成');
})();
