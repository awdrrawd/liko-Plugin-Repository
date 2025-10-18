// ==UserScript==
// @name         Liko - Bondage renew
// @name:zh      Liko的綑綁刷新
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Bondage Club - Likolisu's Bondage renew
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    try {
        if (typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function") {
            const modApi = bcModSdk.registerMod({
                name: "liko's Bondage renew",
                fullName: "Bondage Club - Likolisu's Bondage renew",
                version: "1.0",
                repository: "BC綑綁刷新 | Bondage renew"
            });

            modApi.hookFunction("ChatRoomMessage", 1, (args, next) => {
                const data = args[0];
                try {
                    if (data?.Type === "Action") {
                        const dict = data.Dictionary || [];
                        const targetID =
                            dict.find(d => d.Tag === "DestinationCharacter" || d.Tag === "TargetCharacter")?.MemberNumber ||
                            dict.find(d => d.TargetCharacter)?.TargetCharacter;
                        const targetChar = ChatRoomCharacter.find(c => c.MemberNumber === targetID);

                        if (targetChar && (data.Sender === Player.MemberNumber || targetID === Player.MemberNumber)) {
                            window.ChatRoomCharacterUpdate(targetChar);
                        }
                    }
                } catch (err) {
                    console.error("[Bondage renew 錯誤]", err);
                }
                return next(args);
            });
        }
    } catch (e) {
        console.error("無法註冊至 bcModSdk:", e.message);
    }
})();
