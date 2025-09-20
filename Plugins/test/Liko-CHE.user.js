// ==UserScript==
// @name         Liko - CHE
// @name:zh      Liko的聊天室書記官
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  聊天室紀錄匯出 \\ Chat room history export to html/excel
// @author       莉柯莉絲(likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function loadCHE() {
  fetch("https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/test/Liko%20-%20CHE.main.user.js")
    .then(res => {
      if (!res.ok) throw new Error("HTTP error " + res.status);
      return res.text();
    })
    .then(js => {
      const s = document.createElement("script");
      s.textContent = js;
      document.body.appendChild(s);
      console.log("[CHE] 載入成功 via fetch");
    })
    .catch(err => {
      console.error("[CHE] 載入 CHE 腳本失敗:", err);
    });
})();
