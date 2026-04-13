// ==UserScript==
// @name         Liko - TRC
// @name:zh      Liko的玩具遙控器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  玩具遙控 | Toy remote control
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/Jomshir98/bondage-club-mod-sdk@0.3.3/dist/bcmodsdk.js
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20TRC.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[TRC] loadtime:', Date.now());
})();
