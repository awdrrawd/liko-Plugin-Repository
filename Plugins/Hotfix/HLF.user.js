// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.3
// @description    Fix some Leash failures
// @description:zh 修復部分牽引失敗的錯誤
// @author         likolisu
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==
/*
v0.3
HLF 透過攔截 Leash Beep，自行完成牽引驗證與房間加入流程，
避免使用 BC 原版容易失敗的牽引加入邏輯。

當目標玩家不符合房間性別限制時，
HLF 會阻止加入並向牽引者發送失敗通知。

本版針對「部分擴充插件的牽引會重複／雙向送出 Leash Beep」
導致誤判為異常牽引的問題做了修正，並加上 [HLF][DEBUG] 診斷 log。
*/

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.3";
    if (window.Liko.HLF) return;
    window.Liko.HLF = MOD_VERSION;

    const DEBUG = false; // 排查異常牽引時開啟
    const dbg = (...args) => { if (DEBUG) console.log("[HLF][DEBUG]", ...args); };

    // ChatRoomLeashPlayer / ChatRoomJoinLeash 是遊戲本體的全域變數，
    // 這裡集中管理讀寫，順便統一記錄每次變更方便除錯。
    const LeashGlobalState = {
        get leashPlayer() {
            return typeof ChatRoomLeashPlayer !== "undefined" ? ChatRoomLeashPlayer : null;
        },
        set leashPlayer(value) {
            const before = this.leashPlayer;
            if (before === value) return;
            dbg("🔧 ChatRoomLeashPlayer 變更", { before, after: value });
            ChatRoomLeashPlayer = value; // eslint-disable-line no-implicit-globals
        },
        get joinLeash() {
            return typeof ChatRoomJoinLeash !== "undefined" ? ChatRoomJoinLeash : undefined;
        },
        set joinLeash(value) {
            if (typeof ChatRoomJoinLeash === "undefined") return;
            const before = ChatRoomJoinLeash;
            if (before === value) return;
            dbg("🔧 ChatRoomJoinLeash 變更", { before, after: value });
            ChatRoomJoinLeash = value; // eslint-disable-line no-implicit-globals
        },
    };

    let lastGenderFail = 0;

    // 同一人 + 同一房間的 Leash Beep 在此時間窗內只處理一次
    const LEASH_DEDUPE_WINDOW_MS = 3000;
    let lastLeashSignature = null;
    let lastLeashTime = 0;

    // 加入流程進行中時鎖住，避免併發觸發
    let leashJoinInProgress = false;

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

        dbg("收到 Leash Beep", {
            senderNumber,
            自己的MemberNumber: Player.MemberNumber,
            chatRoomName,
            ChatRoomSpace: data.ChatRoomSpace,
            目前ChatRoomLeashPlayer: LeashGlobalState.leashPlayer,
            目前ChatRoomData名稱: ChatRoomData?.Name,
        });

        if (!chatRoomName) return next(args);

        // 插件會對移動者自己也送一份 Leash Beep（sender 等於自己），
        // 這種不是真的被牽引，忽略避免污染 ChatRoomLeashPlayer
        if (senderNumber === Player.MemberNumber) {
            dbg("⛔ Beep 與自己有關，忽略");
            return next(args);
        }

        // 去重：插件可能對同一次牽引重複送出 Beep
        const signature = `${senderNumber}::${chatRoomName}`;
        const now = Date.now();
        if (signature === lastLeashSignature && (now - lastLeashTime) < LEASH_DEDUPE_WINDOW_MS) {
            dbg("⛔ 判定為重複 Leash Beep，忽略", { signature });
            return;
        }
        lastLeashSignature = signature;
        lastLeashTime = now;

        if (leashJoinInProgress) {
            dbg("⛔ 上一次加入流程尚未結束，忽略本次 Beep", { signature });
            return;
        }

        if (LeashGlobalState.leashPlayer == null && senderNumber != null) {
            LeashGlobalState.leashPlayer = senderNumber;
        }

        if (LeashGlobalState.leashPlayer !== senderNumber) {
            dbg("⛔ ChatRoomLeashPlayer 與 sender 不符，交給原版處理");
            return next(args);
        }
        if (Player.OnlineSharedSettings?.AllowPlayerLeashing === false) {
            return next(args);
        }
        if (ChatRoomData?.Name === chatRoomName) {
            // 已在目標房間，不需加入；務必清空 ChatRoomLeashPlayer
            // 避免殘留狀態污染之後的判斷
            dbg("ℹ️ 已在目標房間內，重設 ChatRoomLeashPlayer");
            LeashGlobalState.leashPlayer = null;
            return next(args);
        }
        if (!ChatRoomCanBeLeashedBy(senderNumber, Player)) {
            dbg("⛔ 無牽引權限，重置 ChatRoomLeashPlayer");
            LeashGlobalState.leashPlayer = null;
            return next(args);
        }

        const allowed = ChatSelectGendersAllowed(data.ChatRoomSpace, Player.GetGenders());
        dbg("性別檢查結果", { ChatRoomSpace: data.ChatRoomSpace, allowed });

        if (!allowed) {
            ServerSend("AccountBeep", {
                MemberNumber: senderNumber,
                BeepType: "HLF",
                Message: {HLF: {Type: "GenderFail"}}
            });
            console.log(`🐈‍⬛ [HLF] 性別不符 (${data.ChatRoomSpace})，取消牽引`);
            LeashGlobalState.leashPlayer = null;
            LeashGlobalState.joinLeash = "";
            CommonSetScreen("Online", "ChatSearch");
            return;
        }

        leashJoinInProgress = true;
        dbg("✅ 通過所有檢查，開始加入房間", { chatRoomName });

        (async () => {
            try {
                // 二次確認：避免同步判斷與非同步執行間的時間差誤判
                if (ChatRoomData?.Name === chatRoomName) {
                    dbg("ℹ️ 二次確認時已在目標房間，取消加入");
                    LeashGlobalState.leashPlayer = null;
                    return;
                }

                if (ChatRoomData) {
                    ChatRoomLeave();
                    await CommonSetScreen('Online', 'ChatSearch');
                }
                const result = await ServerRoomJoin(chatRoomName);
                if (result?.err) {
                    if (result.error?.name !== "ServerInProgressError") {
                        console.log(`🐈‍⬛ [HLF] 加入失敗: ${result.error?.name}`);
                    }
                    return;
                }
                dbg("✅ 加入房間成功", { chatRoomName });
                LeashGlobalState.leashPlayer = null;
                LeashGlobalState.joinLeash = "";
            } catch (e) {
                console.error("🐈‍⬛ [HLF] 加入出錯:", e);
            } finally {
                leashJoinInProgress = false;
            }
        })();

        return;
    });

    console.log(`🐈‍⬛ [HLF] v${MOD_VERSION} ready`);
})();
