// ==UserScript==
// @name         Liko - Kaomoji
// @name:zh      Liko的文字表情
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0.0
// @description  Bondage Club - 文字表情快捷面板：点击颜文字自动插入聊天输入框，支持收藏/常用/自定义分组/拖动排序
// @author       Likolisu & TAO
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Kaomoji.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Liko-Kaomoji.user.js
// ==/UserScript==

(function () {
    "use strict";
    const script = document.createElement("script");
    script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Kaomoji.main.user.js?timestamp=${Date.now()}`;
    script.type = "module";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
    console.log('[BMM] loadtime:', Date.now());
})();
