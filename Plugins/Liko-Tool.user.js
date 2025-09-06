// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Bondage Club - Likolisu's tool with BCC-inspired features
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20Tool.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[Tool] loadtime:', Date.now());
})();
