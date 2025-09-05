// ==UserScript==
// @name         Liko - PAT All
// @name:zh      Liko的對大家互動
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  A BCAR-style compact button to perform activity on everyone in room, with all configs centralized
// @author       Likolisu & 約爾
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/main/Liko%20-%20PAT%20All.main.user.js )
?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[Chat TtoB] loadtime:', Date.now());
})();
