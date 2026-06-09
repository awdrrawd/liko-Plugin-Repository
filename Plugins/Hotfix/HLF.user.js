// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.1
// @description    Fix some Leash failures
// @description:zh 修復部分牽引失敗的錯誤
// @author         likolisu
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require        https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.1";
    if (window.Liko.HLF) return;
    window.Liko.HLF = MOD_VERSION;

    const modApi = bcModSdk.registerMod({
        name:       'HLF',
        fullName:   'Hotfix - Leash Fix',
        version:    MOD_VERSION,
        repository: 'Fix some Leash failures',
    });

    const RETRY_DELAY = 3000;
    let lastJoinedRoom = null;
    let retryTimer = null;
    let hasRetried = false;

    function clearCache() {
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        lastJoinedRoom = null;
        hasRetried = false;
    }

    // 進入房間後，若有牽引狀態，3 秒後確認是否還在，若被踢出就重試一次
    modApi.hookFunction('ChatRoomSync', 0, (args, next) => {
        const ret = next(args);
        if (!ChatRoomData || ChatRoomLeashPlayer == null) return ret;

        const roomName = ChatRoomData.Name;
        lastJoinedRoom = roomName;
        hasRetried = false;
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }

        retryTimer = setTimeout(async () => {
            retryTimer = null;
            if (ChatRoomData?.Name === roomName) {
                clearCache();
                return;
            }
            if (!ChatRoomData && ChatRoomLeashPlayer != null && !hasRetried) {
                hasRetried = true;
                try {
                    const result = await ServerRoomJoin(roomName);
                    if (result.err) console.log(`🐈‍⬛ [HLF] 重試失敗: ${result.error?.name}`);
                    else console.log(`🐈‍⬛ [HLF] 重試成功: ${roomName}`);
                } catch(e) {
                    console.error(`🐈‍⬛ [HLF] 重試出錯:`, e);
                }
            }
            clearCache();
        }, RETRY_DELAY);

        return ret;
    });

    // 攔截 Leash Beep：補設 ChatRoomLeashPlayer，並跳過性別判定直接加入
    modApi.hookFunction('ServerAccountBeep', 5, (args, next) => {
        const data = args[0];
        if (!data || typeof data !== 'object' || data.BeepType !== 'Leash') return next(args);

        const senderNumber = data.MemberNumber;
        const chatRoomName = data.ChatRoomName;

        // 補設 ChatRoomLeashPlayer（LSCG 等自訂牽引不會設定這個）
        if (ChatRoomLeashPlayer == null && senderNumber != null) {
            // eslint-disable-next-line no-undef
            ChatRoomLeashPlayer = senderNumber;
        }

        // 沒有房間名，讓原版處理
        if (!chatRoomName) return next(args);

        // 跳過性別判定，直接加入
        if (ChatRoomLeashPlayer !== senderNumber) return next(args);
        if (Player.OnlineSharedSettings?.AllowPlayerLeashing === false) return next(args);
        if (ChatRoomData?.Name === chatRoomName) return next(args);
        if (!ChatRoomCanBeLeashedBy(senderNumber, Player)) {
            // eslint-disable-next-line no-undef
            ChatRoomLeashPlayer = null;
            return next(args);
        }

        ;(async () => {
            try {
                if (ChatRoomData) {
                    ChatRoomLeave();
                    await CommonSetScreen('Online', 'ChatSearch');
                }
                const result = await ServerRoomJoin(chatRoomName);
                if (result.err) {
                    console.log(`🐈‍⬛ [HLF] 加入失敗: ${result.error?.name}`);
                    clearCache();
                }
            } catch(e) {
                console.error(`🐈‍⬛ [HLF] 加入出錯:`, e);
                clearCache();
            }
        })();

        return;
    });

    console.log(`🐈‍⬛ [HLF] v${MOD_VERSION} ready`);
})();
