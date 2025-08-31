// ==UserScript==
// @name         Liko - Bondage renew
// @name:zh      Liko的綑綁刷新
// @namespace    https://likulisu.dev/
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
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    // 註冊 bcModSdk
    try {
        if (typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function") {
            const modApi = bcModSdk.registerMod({
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

    // 指定情況更新角色外觀
    window.ChatRoomMessage = function (data) {
        try {
            //if (data?.Type === "Action" && data.Content === "ActionUse") {
            if (data?.Type === "Action") {
                const dict = data.Dictionary || [];
                const targetID = dict.find(d => d.Tag === "DestinationCharacter" || d.Tag === "TargetCharacter")?.MemberNumber || dict.find(d => d.TargetCharacter)?.TargetCharacter;
                const targetChar = ChatRoomCharacter.find(c => c.MemberNumber === targetID);

                if (targetChar && (data.Sender === Player.MemberNumber || targetID === Player.MemberNumber)) {
                    window.ChatRoomCharacterUpdate(targetChar);
                }
            }
        } catch (err) {
            console.error("[ActionFilter 錯誤]", err);
        }
        return originalChatRoomMessage.call(this, data);
    };
})();
