// ==UserScript==
// @name         Liko - FCM
// @name:zh      Liko的好友與房間管理
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  Friends and ChatRoom Manager | 好友與房間管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/Jomshir98/bondage-club-mod-sdk@0.3.3/dist/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20FCM.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[CDT] loadtime:', Date.now());
})();
