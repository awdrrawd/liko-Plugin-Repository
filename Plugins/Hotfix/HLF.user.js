// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.17
// @description    Fix some Leash failures
// @description:zh 修復部分牽引失敗的錯誤，新增雙向牽引防抖機制
// @author         likolisu
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require        https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HLF.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HLF.user.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.17";

    // ============================================
    // Liko.HLF 命名空間 / 開關設定
    // ============================================
    window.Liko.HLF = window.Liko.HLF ?? {};
    if (window.Liko.HLF.LOADED) return;
    window.Liko.HLF.LOADED = MOD_VERSION;

    // debug_Beep: 監聽 Leash Beep 收發 log (預設關閉)
    // Console 開啟: Liko.HLF.debug_Beep = true
    window.Liko.HLF.debug_Beep = window.Liko.HLF.debug_Beep ?? false;

    // debug_ban: 測試用，拒絕所有牽引請求 (預設關閉)
    // Console 開啟: Liko.HLF.debug_ban = true
    window.Liko.HLF.debug_ban = window.Liko.HLF.debug_ban ?? false;

    // 防抖持續時間 (ms)：同一對象牽引到同一房間成功後，這段時間內的重複請求會被忽略
    const LEASH_DEBOUNCE_MS = 10000;

    function spaceLabel(space) {
        if (space === "") return "女性";
        if (space === "X") return "混合";
        return "Unknown";
    }

    function debugLogLeashBeep(direction, data) {
        if (!window.Liko.HLF.debug_Beep) return;
        if (!data || data.BeepType !== "Leash") return;

        const isIncoming = direction === "in";
        const other = ChatRoomCharacter?.find(c => c.MemberNumber === data.MemberNumber);

        console.log(
            `%c${isIncoming ? "📥 [接受Beep]" : "📤 [發送Beep]"} Leash`,
            `color: ${isIncoming ? "#ff00ff" : "#ff8800"}; font-weight: bold;`
        );
        if (isIncoming) {
            console.log(`  來自: ${other ? other.Name : data.MemberName} (${data.MemberNumber})`);
        } else {
            console.log(`  來自: ${Player.Nickname || Player.Name} (${Player.MemberNumber})`);
            console.log(`  對象: ${other ? other.Name : "Unknown"} (${data.MemberNumber})`);
        }
        console.log(`  房間: ${data.ChatRoomName || "Unknown"} - ${spaceLabel(data.ChatRoomSpace)}`);
        console.log(`  時間: ${new Date().toLocaleTimeString()}`);
        console.log(`  原始資料:`, JSON.stringify(data, null, 2));
        console.log("---");
    }

    // ============================================
    // 問題插件跳過清單 (Skip List)
    // 只要 Beep 的 Message 內含有以下任一 key，
    // 就視為問題插件發出的牽引訊息，直接不處理牽引 (無條件拒絕被牽引)
    // 未來要增減，直接修改這個陣列即可
    // ============================================
    const LEASH_SKIP_MESSAGE_KEYS = [];

    function isSkippedLeashMessage(data) {
        if (!data?.Message) return false;
        return LEASH_SKIP_MESSAGE_KEYS.some(key =>
            Object.prototype.hasOwnProperty.call(data.Message, key)
        );
    }

    const modApi = bcModSdk.registerMod({
        name:       'HLF',
        fullName:   'Hotfix - Leash Fix',
        version:    MOD_VERSION,
        repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
    });

    const Leash = {
        target: null,
        busy: false,
        cooldownTimer: null,

        // ============================================
        // LSCG的牽手防抖機制
        // ============================================
        debounce: new Map(),

        isDebounced(partnerId, room) {
            const rec = this.debounce.get(partnerId);
            if (!rec) return false;
            if (Date.now() - rec.time > LEASH_DEBOUNCE_MS) {
                this.debounce.delete(partnerId);
                return false;
            }
            return rec.room === room;
        },

        setDebounce(partnerId, room) {
            this.debounce.set(partnerId, { room, time: Date.now() });
        },

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
                if (lscgLeash.Enabled && lscgLeash.LeashedByPairings.map(p => p.PairedMember).indexOf(id) > -1){
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
                        if (result?.err) {
                            if (result.error?.name !== "ServerInProgressError") {
                                console.warn(`[HLF] 牽引加入失敗: ${result.error?.name}`);
                            }
                        } else {
                            // 加入成功：記錄本地防抖，並回送確認 Beep 讓對方也記錄防抖
                            this.setDebounce(req.leader, req.room);
                            try {
                                ServerSend("AccountBeep", {
                                    MemberNumber: req.leader,
                                    BeepType: "HLF_LeashAck",
                                    ChatRoomName: req.room,
                                });
                                if (window.Liko.HLF.debug_Beep) {
                                    console.log(
                                        `%c✅ [牽引成功] 已回送確認 Beep`,
                                        "color: #00ffaa; font-weight: bold;"
                                    );
                                    console.log(`  對象: ${req.leader}，房間: ${req.room}`);
                                }
                            } catch (e) {
                                console.error("[HLF] 傳送牽引確認 Beep 失敗:", e);
                            }
                        }
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
                window.ChatRoomLeashPlayer = null;
                CharacterRefreshLeash(Player);
            }
        },
    };

    modApi.hookFunction("ServerAccountBeep", 100, (args, next) => {
        const data = args[0];

        debugLogLeashBeep("in", data);

        // ============================================
        // 牽引成功確認 Beep：對方跟到房間後回送的通知
        // 收到後記錄防抖，並直接吞掉，不繼續往下傳遞 (不彈通知)
        // ============================================
        if (data.BeepType === "HLF_LeashAck") {
            if (Number.isInteger(data.MemberNumber) && data.ChatRoomName) {
                Leash.setDebounce(data.MemberNumber, data.ChatRoomName.trim());
                if (window.Liko.HLF.debug_Beep) {
                    console.log(
                        `%c🤝 [牽引確認] 收到對方回報，記錄防抖`,
                        "color: #00ffaa; font-weight: bold;"
                    );
                    console.log(`  對象: ${data.MemberNumber}，房間: ${data.ChatRoomName}`);
                }
            }
            return;
        }

        if (data.BeepType !== "Leash" || !data.ChatRoomName) {
            return next(args);
        }

        // 測試用：拒絕所有牽引請求
        if (window.Liko.HLF.debug_ban) {
            if (window.Liko.HLF.debug_Beep) {
                console.log(
                    `%c🚫🚫 [禁牽模式] 已開啟，忽略此牽引請求`,
                    "color: #ff0000; font-weight: bold;"
                );
                console.log(`  來自: ${data.MemberName} (${data.MemberNumber})`);
            }
            return next(args);
        }

        if (isSkippedLeashMessage(data)) {
            if (window.Liko.HLF.debug_Beep) {
                console.log(
                    `%c🚫 [跳過牽引] 偵測到問題插件訊息 (${LEASH_SKIP_MESSAGE_KEYS.join(", ")})，不予自動牽引處理`,
                    "color: #ff4444; font-weight: bold;"
                );
                console.log(`  來自: ${data.MemberName} (${data.MemberNumber})`);
            }
            return next(args);
        }

        const leader = data.MemberNumber;
        const room = data.ChatRoomName.trim();
        if (!Number.isInteger(leader) || leader === Player.MemberNumber) {
            return;
        }

        // ============================================
        // 雙向牽引防抖：10 秒內已成功牽引至同一房間的同一對象，直接擋掉
        // 避免雙向牽手造成的乒乓循環 (A拉B -> B又把A拉回去)
        // ============================================
        if (Leash.isDebounced(leader, room)) {
            if (window.Liko.HLF.debug_Beep) {
                console.log(
                    `%c⏳ [防抖阻擋] 10 秒內已牽引至同一房間，忽略此請求`,
                    "color: #888800; font-weight: bold;"
                );
                console.log(`  對象: ${leader}，房間: ${room}`);
            }
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

    // 監聽發送出去的 Leash Beep（僅供 debug_Beep 顯示用，不影響原本行為）
    modApi.hookFunction("ServerSend", 100, (args, next) => {
        if (args[0] === "AccountBeep") {
            debugLogLeashBeep("out", args[1]);
        }
        return next(args);
    });

    console.log(`🐈‍⬛ [HLF] ✅ v${MOD_VERSION} loaded\nDEBUG: "window.Liko.HLF.debug_Beep","window.Liko.HLF.debug_ban"`);
})();
