// ==UserScript==
// @name         Liko - Custom Profile Background
// @name:zh      Liko的自定義個人資料頁面背景
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  自定義個人資料頁面背景
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-CPB.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-CPB.user.js
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CPB.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[CPB] loadtime:', Date.now());
})();
