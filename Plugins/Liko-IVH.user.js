// ==UserScript==
// @name         IVH - Immersive Voice Hypnosis
// @name:zh      沉浸式聲音催眠效果
// @namespace    https://likulisu.dev/
// @version      1.0
// @description  收到 [Voice] 訊息時觸發深度催眠視覺效果
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    "use strict";
    const url = `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/main/Liko%20-%20IVH.main.user.js?timestamp=${Date.now()}`;
    fetch(url)
        .then(r => r.text())
        .then(code => {
            const fn = new Function(code);
            fn();
        })
        .catch(e => console.error('[IVH] 載入失敗:', e));
})();
