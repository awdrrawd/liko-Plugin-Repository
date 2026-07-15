// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.2.0
// @description    Supports vertical layout for ChatSearch and ChatRoom
// @description:zh 支援房間搜尋與聊天室的直版佈局
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @author         Likolisu
// @grant          none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MPL.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[BMM] loadtime:', Date.now());
})();
