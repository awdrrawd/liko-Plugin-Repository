// ==UserScript==
// @name         Liko - AEE
// @name:cn      Liko的外觀編輯拓展
// @name:zh      Liko的外觀編輯拓展
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  Likolisu's Appearance editing extension.
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20AEE.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[AEE] loadtime:', Date.now());
})();
