// ==UserScript==
// @name         Liko的綑綁刷新
// @version      1.0
// @description  Bondage Club - Likolisu's Bondage renew
// @author       Likolisu
// @match        https://bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// ==/UserScript==

(function () {
    // 註冊 bcModSdk
    try {
        if (typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function") {
            bcModSdk.registerMod({
                name: 'liko\'s Bondage renew',
                fullName: 'Bondage Club - Likolisu\'s Bondage renew',
                version: '1.0',
                repository: 'BC綑綁刷新 \\ Bondage renew'
            });
        }
    } catch (e) {
        console.error("無法註冊至 bcModSdk:", e.message);
    }

    // 儲存原始 ChatRoomMessage
    const originalChatRoomMessage = window.ChatRoomMessage;

    // 覆寫 ChatRoomMessage
    window.ChatRoomMessage = function (data) {
        try {
            if (data?.Type === "Action" && data.Content === "ActionUse") {
                const dict = data.Dictionary || [];
                const targetID = dict.find(d => d.Tag === "DestinationCharacter" || d.Tag === "TargetCharacter")?.MemberNumber || dict.find(d => d.TargetCharacter)?.TargetCharacter;
                const targetChar = ChatRoomCharacter.find(c => c.MemberNumber === targetID);

                if (targetChar) {
                    window.ChatRoomCharacterUpdate(targetChar);
                }
            }
        } catch (err) {
            console.error("[ActionFilter 錯誤]", err);
        }
        return originalChatRoomMessage.call(this, data);
    };
})();