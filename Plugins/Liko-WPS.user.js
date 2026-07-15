// ==UserScript==
// @name         Liko - WPS
// @name:zh      WCE的Profile分享
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  WCE的Profile分享 | WCE Profile Share
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20WPS.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[WPS] loadtime:', Date.now());
})();
