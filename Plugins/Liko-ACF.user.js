// ==UserScript==
// @name         BC Abundantia Florum ─Chromatica─
// @name:zh      BC 繁戀如花 ─繽紛─
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.5.0
// @description  拓展戀人系統 | Extended Lover System for BondageClub
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20Abundantia%20Florum%20Chromatica.main.user.js?timestamp=${Date.now()}`;
    document.head.appendChild(script);
    console.log('[ACF] loadtime:', Date.now());
})();
