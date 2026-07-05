// ==UserScript==
// @name         Liko - CRA
// @name:zh      聊天室輔助工具
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  替他人改姿勢、輸入歷史、BIO時區頭頂時間、@動作自帶名字、指令/房間轉按鈕 | Chat room assistant
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CRA.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[MAT] loadtime:', Date.now());
})();
