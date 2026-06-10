/* eslint-disable no-implicit-globals */

// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.2
// @description    Fix some Leash failures
// @description:zh 修復部分牽引失敗的錯誤
// @author         likolisu
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require        https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==
/*
v0.2
HLF 透過攔截 Leash Beep，自行完成牽引驗證與房間加入流程，
避免使用 BC 原版容易失敗的牽引加入邏輯。

當目標玩家不符合房間性別限制時，
HLF 會阻止加入並向牽引者發送失敗通知。
*/

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.2";
    if (window.Liko.HLF) return;
    window.Liko.HLF = MOD_VERSION;
    let lastGenderFail = 0;

    const modApi = bcModSdk.registerMod({
        name:       'HLF',
        fullName:   'Hotfix - Leash Fix',
        version:    MOD_VERSION,
        repository: 'Fix some Leash failures',
    });
    modApi.hookFunction("ServerAccountBeep", 1, (args, next) => {
        const data = args[0];
        if (data?.Message?.HLF?.Type === "GenderFail") {
            const now = Date.now();
            if (now - lastGenderFail < 1000) return;
            lastGenderFail = now;
            ChatRoomSendLocal(
                ["CN", "TW"].includes(TranslationLanguage)
                ? "⚠️ 牽引失敗：對方無法進入此房間性別區域"
                : "⚠️ Leash failed: Target cannot enter this room's gender-restricted area"
            );
            return;
        }
        return next(args);
    });
    // 攔截 Leash Beep：自行驗證性別與權限後直接加入房間
    modApi.hookFunction('ServerAccountBeep', 5, (args, next) => {

        const data = args[0];
        if (!data || typeof data !== 'object' || data.BeepType !== 'Leash')
            return next(args);
        const senderNumber = data.MemberNumber;
        const chatRoomName = data.ChatRoomName;
        // 沒有房間名，交給原版
        if (!chatRoomName)
            return next(args);
        // 補設 LeashPlayer
        if (ChatRoomLeashPlayer == null && senderNumber != null)
            ChatRoomLeashPlayer = senderNumber;
        // 基本檢查
        if (ChatRoomLeashPlayer !== senderNumber)
            return next(args);
        if (Player.OnlineSharedSettings?.AllowPlayerLeashing === false)
            return next(args);
        if (ChatRoomData?.Name === chatRoomName)
            return next(args);
        if (!ChatRoomCanBeLeashedBy(senderNumber, Player)) {
            ChatRoomLeashPlayer = null;
            return next(args);
        }
        // ===== 性別檢查 =====
        const allowed = ChatSelectGendersAllowed(
            data.ChatRoomSpace,
            Player.GetGenders()
        );

        if (!allowed) {
            ServerSend("AccountBeep", {
                MemberNumber: senderNumber,
                BeepType: "HLF",
                Message: {HLF: {Type: "GenderFail"}}
            });
            console.log(`🐈‍⬛ [HLF] 性別不符 (${data.ChatRoomSpace})，取消牽引`);

            ChatRoomLeashPlayer = null;
            if (typeof ChatRoomJoinLeash !== "undefined")ChatRoomJoinLeash = "";
            CommonSetScreen("Online", "ChatSearch");
            return;
        }
        // ===== 直接加入 =====
        (async () => {
            try {
                if (ChatRoomData) {
                    ChatRoomLeave();
                    await CommonSetScreen(
                        'Online',
                        'ChatSearch'
                    );
                }
                const result =
                      await ServerRoomJoin(chatRoomName);
                if (result?.err) {
                    // 這個通常是重複 Join，不是真失敗
                    if (result.error?.name !== "ServerInProgressError") console.log(`🐈‍⬛ [HLF] 加入失敗: ${result.error?.name}`);
                    return;
                }
                // 成功後清理牽引狀態
                ChatRoomLeashPlayer = null;
                if (typeof ChatRoomJoinLeash !== "undefined") ChatRoomJoinLeash = "";
            } catch (e) {
                console.error("🐈‍⬛ [HLF] 加入出錯:", e);
            }
        })();
        // 阻止 BC 原版 Leash 流程
        return;
    });
    console.log(`🐈‍⬛ [HLF] v${MOD_VERSION} ready`);
})();
