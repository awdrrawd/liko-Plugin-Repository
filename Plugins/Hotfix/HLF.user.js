// ==UserScript==
// @name           Hotfix - Leash Fix
// @name:zh        牽引補丁
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.4
// @description    Fix some Leash failures, plus reconnect hotfix for tie-tie(贴贴) pairing
// @description:zh 修復部分牽引失敗的錯誤，並在斷線重連時修復貼貼／拉到身邊等配對
// @author         likolisu
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VERSION = "0.4";
    if (window.Liko.HLF) return;
    window.Liko.HLF = MOD_VERSION;

    const DEBUG = false; // 排查異常時開啟
    const dbg = (...args) => { if (DEBUG) console.log("[HLF][DEBUG]", ...args); };

    const modApi = bcModSdk.registerMod({
        name:       'HLF',
        fullName:   'Hotfix - Leash Fix',
        version:    MOD_VERSION,
        repository: 'Fix some Leash failures',
    });

    // ============================================================
    // Part 1 — 牽引補丁（Leash Fix）
    // ============================================================

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

        // 判斷是不是「真正的牽引」。三套牽引系統各自用不同方式記錄狀態，
        // 沒有單一判斷能同時涵蓋，因此用「聯集」判斷，兩個條件任一成立即可：
        //   1) ChatRoomLeashPlayer === sender —— sender 正牽著我：
        //      - BC 原版：ChatRoomDoHoldLeash 會設定此值。
        //      - ECHO：拉到身邊／騎上去／鑽進懷裡／手推車／馬車… 等動作透過
        //        ChatRoomOrderTools 的 "follow" 模式，把 sender 寫進被牽者的
        //        ChatRoomLeashPlayer；但因為穿的是 ItemMisc／ItemTorso 等非頸具，
        //        ChatRoomCanBeLeashedBy 往往為假，只能靠這個值認出。
        //   2) ChatRoomCanBeLeashedBy(sender, Player) —— sender 有權牽我：
        //      - BC 原版：被牽者身上有帶 Leash effect 的頸具且鎖權限允許。
        //      - LSCG：所有抓取動作（牽手、抓手臂、咬住…）都存在自己的 Pairings，
        //        並 hook 了此函式回報「sender 是否正牽著我」；LSCG 不設 ChatRoomLeashPlayer，
        //        只能靠這個函式認出。
        // 兩者皆不成立，才代表這是其他插件借用 Leash Beep 做別的事，交還原版處理，
        // 避免誤攔截、錯誤前往。
        const senderIsMyLeasher = LeashGlobalState.leashPlayer === senderNumber;
        const canBeLeashedBySender = ChatRoomCanBeLeashedBy(senderNumber, Player);
        if (!senderIsMyLeasher && !canBeLeashedBySender) {
            dbg("⛔ sender 既非 ChatRoomLeashPlayer，ChatRoomCanBeLeashedBy 也為假（非真正牽引），交給原版處理", {
                senderNumber,
                leashPlayer: LeashGlobalState.leashPlayer,
            });
            return next(args);
        }

        if (Player.OnlineSharedSettings?.AllowPlayerLeashing === false) {
            return next(args);
        }

        // 統一把 sender 補進 ChatRoomLeashPlayer，讓 BC 原版的牽引相關邏輯／UI
        //（例如地圖上的牽引線）也認得這次牽引。ECHO 通常已經設好、這裡是冪等；
        // LSCG 不會設此值，這一步正好替它補上。
        if (LeashGlobalState.leashPlayer !== senderNumber) {
            LeashGlobalState.leashPlayer = senderNumber;
        }

        if (ChatRoomData?.Name === chatRoomName) {
            // 已在目標房間，不需加入；務必清空 ChatRoomLeashPlayer
            // 避免殘留狀態污染之後的判斷
            dbg("ℹ️ 已在目標房間內，重設 ChatRoomLeashPlayer");
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

    // ============================================================
    // Part 2 — 貼貼熱修復（XCharacterDrawOrder 配對：登入復原 + 連動移除）
    //
    // (1) 登入熱修復（只做一次）
    //     - 情況 A：伺服器斷線但沒刷新 → 貼貼不會掉、狀態還在，不需復原
    //       （狀態暫時空、但道具還穿著時判定暫時斷線、不處理）。
    //     - 情況 B：刷新／重開 → 貼貼掉了、狀態歸零，但 localStorage 還在
    //       → 上線後無條件復原一次（不驗證對方），之後本次連線不再復原。
    // (2) 連動移除：只在「我自己這件貼貼被真正移除」時（本地事件，可靠）連動移除對方，
    //     cascade 對象取我 XCharacterDrawOrder 指向的人（拉到身邊兩端道具不同，移除對方
    //     時取「對方自己那件」，不要求同名）。對方那件若是真的被移除，會由「對方自己的
    //     HLF」在他那邊偵測並反向連動——本腳本不去觀察對方狀態，避免把「對方只是斷線
    //     重連、貼貼暫時看起來消失」誤判成移除而錯誤解除自己的貼貼。
    // ============================================================

    // localStorage 快取「依帳號分開」：key 帶入 Player.MemberNumber，
    // 避免同一瀏覽器多帳號時，復原到別的帳號的貼貼。
    const LS_KEY_PREFIX = "XPairReconnectFix_v4_";

    let seenLive = false;          // 本次載入是否看過 live 配對（false=剛刷新→空狀態走復原）
    let lastRecordStr = null;
    let lastRecord = null;

    function resetPairingTracking() {
        seenLive = false;
        lastRecordStr = null;
        lastRecord = null;
    }

    function isPairedState(state) {
        return !!(
            state &&
            typeof state === "object" &&
            (typeof state.nextCharacter === "number" || typeof state.prevCharacter === "number")
        );
    }

    function characterWearsAsset(C, asset) {
        if (!C?.Appearance || !asset?.group || !asset?.asset) return false;
        return C.Appearance.some((i) => i.Asset?.Group?.Name === asset.group && i.Asset?.Name === asset.asset);
    }

    function findChar(id) {
        return typeof ChatRoomCharacter !== "undefined" && Array.isArray(ChatRoomCharacter)
            ? ChatRoomCharacter.find((c) => c.MemberNumber === id)
            : null;
    }

    function pointsTo(drawOrder, memberNumber) {
        return (
            isPairedState(drawOrder) &&
            (drawOrder.nextCharacter === memberNumber || drawOrder.prevCharacter === memberNumber)
        );
    }

    function buildRecord(state) {
        const isNext = typeof state.nextCharacter === "number";
        return {
            role: isNext ? "next" : "prev",
            target: isNext ? state.nextCharacter : state.prevCharacter,
            associatedAsset: state.associatedAsset ?? null,
            leash: state.leash ?? undefined,
            drawState: state.drawState ?? undefined,
        };
    }

    // ---- localStorage 存取（key 依帳號分開）----
    function lsKey() {
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl?.MemberNumber) return null;
        return `${LS_KEY_PREFIX}${pl.MemberNumber}`;
    }
    function lsRead() {
        try {
            const key = lsKey();
            if (!key) return null;
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { dbg("localStorage 讀取失敗:", e); return null; }
    }
    function lsWrite(record) {
        try {
            const key = lsKey();
            if (!key) return;
            localStorage.setItem(key, JSON.stringify(record));
            dbg("已寫入本機配對紀錄:", record);
        } catch (e) { dbg("localStorage 寫入失敗:", e); }
    }
    function lsClear() {
        try {
            const key = lsKey();
            if (!key) return;
            localStorage.removeItem(key);
            dbg("已清除本機配對紀錄");
        } catch (e) { dbg("localStorage 清除失敗:", e); }
    }

    // ---- 核心輪詢：備份、偵測「我自己這件被移除」並連動移除對方 ----
    function pollAndPersist() {
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl) return;
        const state = pl.XCharacterDrawOrder;
        const paired = isPairedState(state);

        // A. 有配對 → 持續備份
        if (paired) {
            const record = buildRecord(state);
            const recStr = JSON.stringify(record);
            if (recStr !== lastRecordStr) {
                lastRecordStr = recStr;
                lastRecord = record;
                lsWrite(record);
            }
            seenLive = true;
        }

        // B. 本次曾看過 live 且有紀錄 → 只在「我自己這件被真正移除」時連動移除對方
        if (seenLive && lastRecord) {
            const myAsset = lastRecord.associatedAsset;
            const myAssetWorn = myAsset ? characterWearsAsset(pl, myAsset) : false;

            // 我這件不見了（我自己移、或被別人移）→ 連動移除對方 P
            if (myAsset && !myAssetWorn) {
                const removed = lastRecord;
                resetPairingTracking();
                lsClear();
                dbg("我的貼貼被移除 → 連動移除對方", removed);
                cascadeRemovePartnerAsset(removed.target);
                return;
            }
            // 沒 associatedAsset 可判斷、配對狀態也空了 → 視為解除，清掉（極少見）
            if (!myAsset && !paired) {
                const removed = lastRecord;
                resetPairingTracking();
                lsClear();
                cascadeRemovePartnerAsset(removed.target);
                return;
            }

            // 其餘情況一律不處理，特別是：
            //  - 我的道具還穿著、但配對狀態暫時空 = 情況 A（自己暫時斷線）；
            //  - 對方那側因斷線／重連暫時看起來消失。
            // 對方那件若真的被移除，對方自己的 HLF 會在他那邊偵測並反向連動，
            // 本腳本不觀察對方狀態，避免把「對方只是斷線重連」誤判成移除。
            return;
        }

        // C. 沒 live 紀錄（剛刷新／重開）→ 嘗試復原
        attemptRestoreFromRecord();
    }

    // ---- 復原：只在「剛載入且目前沒配對」時做一次，無條件復原 ----
    function attemptRestoreFromRecord() {
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl?.Appearance) return;

        if (isPairedState(pl.XCharacterDrawOrder)) { seenLive = true; return; } // 情況 A：狀態還在
        if (seenLive) return; // 本次已復原／確認過，不再重複

        const record = lsRead();
        if (!record || typeof record.target !== "number") return;

        restorePairing(record); // 無條件復原：不驗證對方
        seenLive = true;
        lastRecord = record;
        lastRecordStr = JSON.stringify(record);
    }

    function restorePairing(record) {
        const pl = Player;
        const base = { associatedAsset: record.associatedAsset, leash: record.leash, drawState: record.drawState };
        pl.XCharacterDrawOrder =
            record.role === "next" ? { nextCharacter: record.target, ...base } : { prevCharacter: record.target, ...base };

        const asset = record.associatedAsset;
        if (asset?.group && asset?.asset && !characterWearsAsset(pl, asset)) {
            try { InventoryWear(pl, asset.asset, asset.group); }
            catch (e) { console.error("🐈‍⬛ [HLF] 貼貼重新穿上失敗:", e); }
        }
        // 裝上後更新一次即可
        if (typeof ChatRoomCharacterUpdate === "function") ChatRoomCharacterUpdate(pl);
        console.log("🐈‍⬛ [HLF] ✅ 已復原貼貼配對:", pl.XCharacterDrawOrder);
    }

    // ---- 我這件被移除時，連動移除「對方自己那件」道具（拉到身邊兩端道具可能不同，不要求同名）----
    function cascadeRemovePartnerAsset(partnerId) {
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl || typeof partnerId !== "number") return;
        const partner = findChar(partnerId);
        if (!partner) return;
        const pdo = partner.XCharacterDrawOrder;
        if (!pointsTo(pdo, pl.MemberNumber)) return; // 對方沒指向我，不動
        const asset = pdo.associatedAsset;
        if (!asset?.group) return;
        try {
            InventoryRemove(partner, asset.group);
            if (typeof ChatRoomCharacterItemUpdate === "function") ChatRoomCharacterItemUpdate(partner, asset.group);
            partner.XCharacterDrawOrder = {}; // 清掉本機殘留指向，避免畫面殘影
            console.log(`🐈‍⬛ [HLF] ✅ 已連動移除對方 (${partnerId}) 的 ${asset.group}/${asset.asset}`);
        } catch (e) { console.error("🐈‍⬛ [HLF] 連動移除對方失敗（可能沒有權限）:", e); }
    }

    // ---- 貼貼相關掛勾與啟動 ----
    if (typeof ChatRoomSync === "function") {
        modApi.hookFunction("ChatRoomSync", 8, (args, next) => {
            const result = next(args);
            attemptRestoreFromRecord();
            return result;
        });
    }
    if (typeof ChatRoomSyncMemberJoin === "function") {
        modApi.hookFunction("ChatRoomSyncMemberJoin", 8, (args, next) => {
            const result = next(args);
            attemptRestoreFromRecord();
            return result;
        });
    }
    setInterval(pollAndPersist, 1500);
    // 進場保險：腳本注入時已在房間內（沒走完整登入→ChatRoomSync 流程）補一次復原檢查
    (function bootstrapIfAlreadyInRoom(retriesLeft = 20) {
        if (typeof ChatRoomData !== "undefined" && ChatRoomData) { attemptRestoreFromRecord(); return; }
        if (retriesLeft <= 0) return;
        setTimeout(() => bootstrapIfAlreadyInRoom(retriesLeft - 1), 500);
    })();

    // 除錯工具
    window.Liko.HLFPair = {
        dumpRecord: () => { const r = lsRead(); console.log("[HLF][XPair] 目前本機紀錄:", r); return r; },
        forceRestore: attemptRestoreFromRecord,
        forceClear: () => { resetPairingTracking(); lsClear(); console.log("[HLF][XPair] 已手動清除紀錄與追蹤狀態"); },
        currentKey: () => { const k = lsKey(); console.log("[HLF][XPair] 目前 localStorage key:", k); return k; },
    };

    console.log(`🐈‍⬛ [HLF] v${MOD_VERSION} ready (Leash Fix + 貼貼熱修復)`);
})();
