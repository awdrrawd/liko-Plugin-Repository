// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://likulisu.dev/
// @version      1.01
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // 全域載入腳本
    const globalScripts = [
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js",
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js"
    ];

    globalScripts.forEach(url => {
        const script = document.createElement("script");
        script.src = `${url}?timestamp=${Date.now()}`;
        script.type = "text/javascript"; // 非 module，全域作用域
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
    });

    // 沙箱作用域的主腳本 先停用
    /*const mainScript = document.createElement("script");
    mainScript.src = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js?timestamp=${Date.now()}`;
    mainScript.type = "module"; // 保持 Tampermonkey 沙箱 / module 執行
    mainScript.crossOrigin = "anonymous";
    document.head.appendChild(mainScript);*/
    (async () => {
        const url = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js";
        const code = await fetch(url).then(r => r.text());
        eval(code); // 在 Tampermonkey 沙箱執行
    })();

    console.log('[PCM] ✅啟用完成');
})();
