// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Bondage Club - 上傳圖片到 litterbox 並分享網址
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Image_Uploader.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Image_Uploader.user.js
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Image%20Uploader.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[IMG] loadtime:', Date.now());
})();
