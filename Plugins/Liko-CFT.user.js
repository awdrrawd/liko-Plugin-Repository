// ==UserScript==
// @name         Liko - Chat Filter Tool
// @name:zh      Liko的聊天室信息過濾器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  聊天室信息過濾
// @author       Liko
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CFT.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[CFT] loadtime:', Date.now());
})();
