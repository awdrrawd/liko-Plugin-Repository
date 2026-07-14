// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.14
// @description    Fix some Leash failures
// @description:zh 修復部分牽引失敗的錯誤
// @author         likolisu
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.14";
    if (window.Liko.HLF) return;
    window.Liko.HLF = MOD_VERSION;

    const modApi = bcModSdk.registerMod({
        name:       'HLF',
        fullName:   'Hotfix - Leash Fix',
        version:    MOD_VERSION,
        repository: 'Fix some Leash failures',
    });

    const Leash = {
        target: null,
        busy: false,
        cooldownTimer: null,

        leadsUs(id) {
            if (!ChatRoomCanBeLeashedBy(id, Player)) {
                return false;
            }
            if (ChatRoomLeashPlayer === id) {
                return true;
            }
            const d = Player.XCharacterDrawOrder;
            if (d?.leash === "follow" && (d.nextCharacter === id || d.prevCharacter === id)) {
                return true;
            }
            if (LSCG) {
                const lscgLeash = LSCG.getModule("LeashingModule");
                if (lscgLeash.Enabled && lscgLeash.LeashedByPairings.map(p => p.PairedMember).indexOf(data.MemberNumber) > -1){
                    return true;
                }
            }
            return false;
        },

        request(leader, room, space) {
            this.target = { leader, room, space };
            if (this.busy) return;
            if (this.cooldownTimer) {
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = setTimeout(() => this.wake(), 5000);
                return;
            }
            this.pump();
        },

        wake() {
            this.cooldownTimer = null;
            if (this.target) this.pump();
        },

        async pump() {
            this.busy = true;
            try {
                while (this.target) {
                    const req = this.target;
                    if (ChatRoomData?.Name === req.room || !this.leadsUs(req.leader)) {
                        this.target = null;
                        continue;
                    }
                    if (!ChatSelectGendersAllowed(req.space, Player.GetGenders())) {
                        this.rejectGender(req.leader);
                        this.target = null;
                        continue;
                    }
                    if (ChatRoomData) {
                        ChatRoomLeave();
                        await CommonSetScreen("Online", "ChatSearch");
                    }
                    if (this.target !== req) continue;
                    const result = await ServerRoomJoin(req.room);
                    if (this.target === req) {
                        if (result?.err && result.error?.name !== "ServerInProgressError")
                            console.warn(`[HLF] 牽引加入失敗: ${result.error?.name}`);
                        this.target = null;
                    }
                }
            } catch (e) {
                console.error("[HLF] 牽引換房出錯:", e);
                this.target = null;
            } finally {
                this.busy = false;
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = setTimeout(() => this.wake(), 5000);
            }
        },
        rejectGender(leader) {
            if (ChatRoomLeashPlayer === leader) {
                ChatRoomLeashPlayer = null;
                CharacterRefreshLeash(Player);
            }
        },
    };

    modApi.hookFunction("ServerAccountBeep", 100, (args, next) => {
        const data = args[0];
        if (data.BeepType !== "Leash" || !data.ChatRoomName) {
            return next(args);
        }

        const leader = data.MemberNumber;
        const room = data.ChatRoomName.trim();
        if (!Number.isInteger(leader) || leader === Player.MemberNumber) {
            return;
        }
        if (Player.OnlineSharedSettings?.AllowPlayerLeashing === false) {
            return;
        }
        if (Leash.leadsUs(leader)) {
            Leash.request(leader, room, data.ChatRoomSpace);
        } else {
            return next(args);
        }
    });

    console.log(`🐈‍⬛ [HLF] v${MOD_VERSION} ready`);
})();

