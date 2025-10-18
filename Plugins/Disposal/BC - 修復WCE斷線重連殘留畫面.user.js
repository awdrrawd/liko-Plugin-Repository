// ==UserScript==
// @name         BC - 修復WCE斷線重連殘留畫面
// @namespace    https://likulisu.dev/
// @version      1.1
// @description  自動清除掉線重連後殘留的登入畫面 (for WCE reconnect)
// @author       莉柯莉絲(Likolisu)
// @match        https://bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(() => {
    "use strict";

    // 註冊 bcModSdk
    const modApi = bcModSdk.registerMod({
        name: "[WCE]Fix Relog Screen",
        fullName: "Fix Relog Screen After WCE Reconnect",
        version: "1.1",
        repository: "修復WCE斷線重連殘留畫面\nFix Relog Screen After WCE Reconnect",
    });
    // 標記 beforeunload 是否觸發
    let beforeUnloadTriggered = false;

    // Hook WCE 的 beforeunload
    window.addEventListener("beforeunload", (e) => {
        beforeUnloadTriggered = true;
    }, { capture: true });

    // 監聽重連
    const originalInfo = console.info;
    console.info = function (...args) {
        const message = args.join(' ');
        if (/Connected to the Bondage Club Server/i.test(message)) {
            if (beforeUnloadTriggered) {
                const relog = document.getElementById("relog-subscreen");
                if (relog) {
                    console.log("[WCE修復] 重連成功，移除 relog-subscreen");
                    relog.remove();
                }
                beforeUnloadTriggered = false; // 重置標記
            }
        }
        return originalInfo.apply(console, args);
    };

    console.log("[WCE修復] 腳本已啟動，監控 beforeunload 並清除 relog-subscreen");
})();
