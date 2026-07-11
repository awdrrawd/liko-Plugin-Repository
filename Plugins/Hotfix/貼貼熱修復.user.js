// ==UserScript==
// @name         BC 貼貼熱修復
// @namespace    https://example.local/
// @version      1.0.0
// @description  斷線重連時自動修復貼貼，移除貼貼時順便移除別人的
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @run-at       document-end
// ==/UserScript==
//已合併到HLF
/*  斷線重連時，用 localStorage 記住自己的牽引配對意圖，依對方即時的
    XCharacterDrawOrder 資料確認關係仍然有效後才復原；連續幾次確認不了
    (對方不在場或沒指向自己)就放棄並清除，不無限期等待；並在移除貼貼時
    連動移除對方對應的道具。*/
(function () {
    window.XPairReconnectFix = window.XPairReconnectFix ?? {};
    const MOD_VER = "1.0.0";
    if (window.XPairReconnectFix.loaded === MOD_VER) return;
    window.XPairReconnectFix.loaded = MOD_VER;

    window.XPairReconnectFix.debug = window.XPairReconnectFix.debug ?? false;
    function dlog(...a) {
        if (window.XPairReconnectFix.debug) console.log("[XPairReconnectFix]", ...a);
    }

    const LS_KEY_PREFIX = "XPairReconnectFix_v4_";
    const RESYNC_MISS_THRESHOLD = 3; // 連續判定失敗約 3*1.5s ≈ 4.5 秒才真的清除

    function isPairedState(state) {
        return !!(
            state &&
            typeof state === "object" &&
            (typeof state.nextCharacter === "number" || typeof state.prevCharacter === "number")
        );
    }

    function isAssociatedAssetStillWorn(asset) {
        if (!asset || !asset.group || !asset.asset) return false;
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl?.Appearance) return false;
        return pl.Appearance.some((i) => i.Asset?.Group?.Name === asset.group && i.Asset?.Name === asset.asset);
    }

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
        } catch (e) {
            dlog("localStorage 讀取失敗:", e);
            return null;
        }
    }

    function lsWrite(record) {
        try {
            const key = lsKey();
            if (!key) return;
            localStorage.setItem(key, JSON.stringify(record));
            dlog("已寫入本機配對紀錄:", record);
        } catch (e) {
            dlog("localStorage 寫入失敗:", e);
        }
    }

    function lsClear() {
        try {
            const key = lsKey();
            if (!key) return;
            localStorage.removeItem(key);
            dlog("已清除本機配對紀錄");
        } catch (e) {
            dlog("localStorage 清除失敗:", e);
        }
    }

    // lastKnownRecordStr 是否為 null，用來分辨「本次連線是否已確認過配對存在」：
    // - null：可能是斷線重連、資料還沒同步回來 → 允許 resync 復原
    // - 非 null：本次連線已確認配對是活的，現在的消失是即時真實事件 → 走移除流程，絕不 resync
    let lastKnownRecordStr = null;
    let lastKnownRecordObj = null;
    let resyncMissCount = 0;

    function pollAndPersist() {
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl) return;
        const state = pl.XCharacterDrawOrder;

        if (isPairedState(state)) {
            const isNext = typeof state.nextCharacter === "number";
            const record = {
                role: isNext ? "next" : "prev",
                target: isNext ? state.nextCharacter : state.prevCharacter,
                associatedAsset: state.associatedAsset ?? null,
                leash: state.leash ?? undefined,
                drawState: state.drawState ?? undefined,
            };
            const recStr = JSON.stringify(record);
            if (recStr !== lastKnownRecordStr) {
                lastKnownRecordStr = recStr;
                lastKnownRecordObj = record;
                lsWrite(record);
            }
            resyncMissCount = 0;
        } else if (lastKnownRecordStr !== null) {
            const oldRecord = lastKnownRecordObj;

            if (oldRecord && isAssociatedAssetStillWorn(oldRecord.associatedAsset)) {
                dlog("XCharacterDrawOrder 暫時消失，但道具仍穿著，判定為暫時斷線，暫不清除", oldRecord);
                return;
            }

            lastKnownRecordStr = null;
            lastKnownRecordObj = null;
            lsClear();
            dlog("配對真的解除:", state);
            attemptRemovePartnerAsset(oldRecord);
        } else {
            attemptResyncFromRecord({ allowClear: true });
        }
    }

    function attemptResyncFromRecord(opts) {
        const allowClear = opts?.allowClear ?? true;
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl) return;

        if (isPairedState(pl.XCharacterDrawOrder)) {
            resyncMissCount = 0;
            return;
        }

        const record = lsRead();
        if (!record || typeof record.target !== "number") {
            resyncMissCount = 0;
            return;
        }

        const partner =
            typeof ChatRoomCharacter !== "undefined"
                ? ChatRoomCharacter.find((c) => c.MemberNumber === record.target)
                : null;

        const partnerDrawOrder = partner?.XCharacterDrawOrder;
        const partnerPointsToMe =
            !!partner &&
            isPairedState(partnerDrawOrder) &&
            (partnerDrawOrder.nextCharacter === pl.MemberNumber || partnerDrawOrder.prevCharacter === pl.MemberNumber);

        dlog("對方是否在場:", !!partner, "對方即時狀態:", partnerDrawOrder, "指向自己:", partnerPointsToMe, "allowClear:", allowClear);

        if (partnerPointsToMe) {
            resyncMissCount = 0;
            restorePairing(record, record.target);
            return;
        }

        if (!allowClear) return;

        // 對方不在場、或在場但沒指向自己，都算一次失敗，一起計數：
        // 對方沒必要無限期等（沒裝熱修的話對方也救不回來，有裝的話對方自己會處理），
        // 雙方都斷線時兩邊資料本來就都是空的，等再久也不會有結果。
        resyncMissCount++;
        if (resyncMissCount < RESYNC_MISS_THRESHOLD) {
            dlog(`未對上，累積第 ${resyncMissCount}/${RESYNC_MISS_THRESHOLD} 次`);
            return;
        }

        dlog("連續多次未能確認配對，放棄並清除本機紀錄");
        resyncMissCount = 0;
        lastKnownRecordStr = null;
        lastKnownRecordObj = null;
        lsClear();
    }

    function restorePairing(record, partnerId) {
        const pl = Player;
        const stateToApply =
            record.role === "next"
                ? { nextCharacter: partnerId, associatedAsset: record.associatedAsset, leash: record.leash, drawState: record.drawState }
                : { prevCharacter: partnerId, associatedAsset: record.associatedAsset, leash: record.leash, drawState: record.drawState };

        pl.XCharacterDrawOrder = stateToApply;
        lastKnownRecordStr = JSON.stringify(record);
        lastKnownRecordObj = record;
        console.log("[XPairReconnectFix] ✅ 已復原配對:", stateToApply);

        restoreAssociatedAssetIfMissing(stateToApply);
    }

    function restoreAssociatedAssetIfMissing(state) {
        const asset = state?.associatedAsset;
        if (!asset || !asset.group || !asset.asset) return;

        const pl = Player;
        if (!pl?.Appearance) return;

        const alreadyWorn = pl.Appearance.some(
            (i) => i.Asset?.Group?.Name === asset.group && i.Asset?.Name === asset.asset
        );
        if (alreadyWorn) return;

        try {
            InventoryWear(pl, asset.asset, asset.group);
            if (typeof ChatRoomCharacterItemUpdate === "function") {
                ChatRoomCharacterItemUpdate(pl, asset.group);
            }
            console.log(`[XPairReconnectFix] ✅ 已重新穿上 ${asset.group} / ${asset.asset}`);
        } catch (e) {
            console.error(`[XPairReconnectFix] ❌ 重新穿上失敗:`, e);
        }
    }

    // 雙方各自穿同一道具互相固定時，自己這邊解除後，若對方即時狀態仍指向自己、
    // 且掛著同一件道具，就連對方那份也一併移除。會經過遊戲本身的權限判斷。
    function attemptRemovePartnerAsset(oldRecord) {
        if (!oldRecord || typeof oldRecord.target !== "number" || !oldRecord.associatedAsset) return;
        const pl = typeof Player !== "undefined" ? Player : null;
        if (!pl) return;

        const partner =
            typeof ChatRoomCharacter !== "undefined"
                ? ChatRoomCharacter.find((c) => c.MemberNumber === oldRecord.target)
                : null;
        if (!partner) return;

        const partnerDrawOrder = partner.XCharacterDrawOrder;
        const partnerPointsToMe =
            isPairedState(partnerDrawOrder) &&
            (partnerDrawOrder.nextCharacter === pl.MemberNumber || partnerDrawOrder.prevCharacter === pl.MemberNumber);
        if (!partnerPointsToMe) return;

        const partnerAsset = partnerDrawOrder.associatedAsset;
        if (
            !partnerAsset ||
            partnerAsset.group !== oldRecord.associatedAsset.group ||
            partnerAsset.asset !== oldRecord.associatedAsset.asset
        ) return;

        try {
            InventoryRemove(partner, partnerAsset.group);
            if (typeof ChatRoomCharacterItemUpdate === "function") {
                ChatRoomCharacterItemUpdate(partner, partnerAsset.group);
            }
            console.log(`[XPairReconnectFix] ✅ 已連動移除對方 (${partner.MemberNumber}) 的 ${partnerAsset.group}/${partnerAsset.asset}`);
        } catch (e) {
            console.error(`[XPairReconnectFix] ❌ 連動移除對方失敗（可能沒有權限）:`, e);
        }
    }

    // 除錯工具：window.XPairReconnectFix.forceResync() / dumpRecord() / forceClear() / currentKey()
    window.XPairReconnectFix.forceResync = attemptResyncFromRecord;
    window.XPairReconnectFix.dumpRecord = () => {
        const r = lsRead();
        console.log("[XPairReconnectFix] 目前本機紀錄:", r);
        return r;
    };
    window.XPairReconnectFix.forceClear = () => {
        lastKnownRecordStr = null;
        lastKnownRecordObj = null;
        lsClear();
        console.log("[XPairReconnectFix] 已手動清除本機紀錄");
    };
    window.XPairReconnectFix.currentKey = () => {
        const key = lsKey();
        console.log("[XPairReconnectFix] 目前使用的 localStorage key:", key);
        return key;
    };

    const modApi = bcModSdk.registerMod({
        name: "xpair-reconnect-fix",
        fullName: "XCharacterDrawOrder Pairing Reconnect Fix",
        version: MOD_VER,
        repository: "local",
    });

    if (typeof ChatRoomSync === "function") {
        modApi.hookFunction("ChatRoomSync", 8, (args, next) => {
            const result = next(args);
            attemptResyncFromRecord({ allowClear: false });
            return result;
        });
    } else {
        console.warn("[XPairReconnectFix] ⚠️ 找不到 ChatRoomSync 函式");
    }

    if (typeof ChatRoomSyncMemberJoin === "function") {
        modApi.hookFunction("ChatRoomSyncMemberJoin", 8, (args, next) => {
            const result = next(args);
            attemptResyncFromRecord({ allowClear: false });
            return result;
        });
    } else {
        console.warn("[XPairReconnectFix] ⚠️ 找不到 ChatRoomSyncMemberJoin 函式");
    }

    setInterval(pollAndPersist, 1500);

    // 進場保險：若腳本注入時已經在房間內（沒有走完整的登入→ChatRoomSync流程），補一次檢查
    (function bootstrapIfAlreadyInRoom(retriesLeft = 20) {
        if (typeof ChatRoomData !== "undefined" && ChatRoomData) {
            attemptResyncFromRecord({ allowClear: false });
            return;
        }
        if (retriesLeft <= 0) return;
        setTimeout(() => bootstrapIfAlreadyInRoom(retriesLeft - 1), 500);
    })();

    console.log(`[XPairReconnectFix] ✅ v${MOD_VER} ready`);
})();
