// ==UserScript==
// @name         Abundantia Florum ─Chromatica─
// @name:zh      繁戀如花 ─繽紛─
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.6.1-2
// @description  拓展戀人系統 | Extended Lover System for BondageClub
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

/*
 * lockEnabled 說明：
 *   SharedSettings 中每個戀人記錄的 lockEnabled 欄位是一個「持久化偏好旗標」，
 *   設計用途是記錄「此戀人是否預設擁有解鎖許可」。
 *   目前實際的解鎖許可由執行期 Set ELLockAccessOn 控制（登入後透過 SYNC 握手重建）。
 *   未來可利用此欄位實現「免握手自動授權」，即登入後若 lockEnabled=true 直接入 Set。
 */

(function () {
    window.Liko        = window.Liko ?? {};
    const MOD_NAME     = "AbundantiaFlorumChromatica";
    const MOD_VERSION  = "0.6.1";
    const EL_BEEP_TYPE = "AFC::Beep";
    window.Liko.AFC    = window.Liko.AFC ?? {};
    if (window.Liko.AFC.version) {
        console.warn('🐈‍⬛ [AFC] ⚠️ 已偵測到重複加載，跳過初始化');
        return;
    }
    window.Liko.AFC.version = MOD_VERSION;
    window.Liko.AFC.api     = window.Liko.AFC.api ?? {};

    const BEEP = {
        PROPOSE:          "ELPropose",
        PROPOSE_ACK:      "ELProposeAck",
        ACCEPT:           "ELAccept",
        ACCEPT_ACK:       "ELAcceptAck",
        RESTORE_PROPOSE:  "ELRestorePropose",   // 資料恢復申請
        RESTORE_ACCEPT:   "ELRestoreAccept",    // 資料恢復確認
        PROPOSE_ENGAGE:   "ELProposeEngage",
        ACCEPT_ENGAGE:    "ELAcceptEngage",
        PROPOSE_MARRY:    "ELProposeMarry",
        ACCEPT_MARRY:     "ELAcceptMarry",
        SYNC_REQUEST:     "ELSyncRequest",
        SYNC_GRANT:       "ELSyncGrant",
        LOCK_ACCESS_OFF:  "ELLockAccessOff",
        BREAKUP:          "ELBreakup",
        ROOM_NAME:        "ELRoomName",
    };

    const STAGE = { DATING: 0, ENGAGED: 1, MARRIED: 2 };

    // 英文標籤（STAGE_LABEL 用於向後相容驗證）
    const STAGE_LABEL = { 0: "dating", 1: "engaged", 2: "married" };

    const STAGE_COLOR = {
        [STAGE.DATING]:  "#FFB6C1",
        [STAGE.ENGAGED]: "#FFD700",
        [STAGE.MARRIED]: "#FF69B4",
    };

    const PROPOSE_COOLDOWN_MS = 60  * 1000;
    const PROPOSE_EXPIRE_MS   = 3   * 60 * 1000;
    const STAGE_PROMOTE_DAYS  = 7;

    // ============================================================
    // 多國語系 (i18n)
    // ============================================================

    // 每次呼叫時才偵測語系，避免模組載入時 TranslationLanguage 尚未設定
    function detectLang() {
        if (typeof TranslationLanguage !== 'undefined') {
            const l = TranslationLanguage.toLowerCase();
            if (l === 'tw') return 'TW';
            if (l === 'cn') return 'CN';
            return 'EN';
        }
        // 回退：瀏覽器語系
        const nav = (navigator.language || '').toLowerCase();
        if (nav.startsWith('zh-tw') || nav.startsWith('zh-hant')) return 'TW';
        if (nav.startsWith('zh')) return 'CN';
        return 'EN';
    }

    const _S = {
        EN: {
            // ── Notifications ─────────────────────────────────────
            notFriend:      (n) => `Please add ${n} as a friend first, then re-submit.`,
            notInstalled:   (n) => `${n} doesn't have the plugin installed.`,
            alreadyEL:      (n) => `${n} is already your extended lover.`,
            alreadyBC:      (n) => `${n} is already your native BC lover.`,
            cooldown:       (s) => `Please wait ${s}s before proposing again.`,
            proposeSent:    (n) => `Proposal sent to ${n}, valid for 3 min...`,
            proposeExpired: (n) => `Proposal to ${n} has expired.`,
            proposeAck:     (n) => `${n} received your proposal.`,
            proposeOK:      (n) => `${n} accepted your extended lover proposal!`,
            breakupSelf:    (n) => `You ended the extended lover relationship with ${n}.`,
            breakupOther:   (n) => `${n} ended the extended lover relationship with you.`,
            restoreSent:    (n) => `Relationship restore request sent to ${n}...`,
            restoreTitle:   (n, id) => `♥ ${n} (${id}) wants to restore your extended lover relationship!`,
            restoreOK:      (n) => `Extended lover relationship with ${n} restored!`,
            dRestore:       () => `(Request to restore extended lover relationship.)`,
            dRestoreR:      () => `(Restore request sent, awaiting response.)`,
            stageSent:    (n,s) => `[${s}] proposal sent to ${n}, valid for 3 min...`,
            stageExpired: (n,s) => `[${s}] proposal to ${n} has expired.`,
            stageOK:      (n,s) => `${n} accepted your [${s}] proposal!`,
            stageOKSelf:  (n,s) => `You accepted ${n}'s [${s}] proposal!`,
            // ── Stage labels ───────────────────────────────────────
            stageDating:    () => `dating`,
            stageEngaged:   () => `engaged`,
            stageMarried:   () => `married`,
            // ── Proposal UI ────────────────────────────────────────
            propTitle:  (n,id) => `♥ ${n} (${id}) has proposed an extended lover relationship!`,
            stageTitle: (n,id,s) => `💍 ${n} (${id}) has proposed: [${s}]!`,
            bcTitle:    (n,id) => `💌 ${n} (${id}) sent a BC native lover request!`,
            bcNote:     () => `Go to Relationship Management to accept, or let it expire.`,
            timerText:  (m,s) => `Auto-cancels in ${m}:${s}`,
            okBtn:      () => `Accept`,
            cancelBtn:  () => `Decline`,
            // ── Profile panel ──────────────────────────────────────
            panelTitle: () => `─── Extended Lovers ───`,
            panelEmpty: () => `No extended lovers yet`,
            btnOpen:    (n) => `More loves (${n})`,
            btnClose:   () => `▲ Close`,
            dispTitle:  () => `──Display──`,
            mgmtTitle:  () => `──Lovers──`,
            sysTitle:   () => `──System──`,
            enableEL:   () => `Extended Lover System`,
            enableELSub:() => `Extended Lovers`,
            elLock:     () => `Extended Lover Lock`,
            elLockSub:  () => `(Under development)`,
            ownerLock:  () => `Owner can use EL Lock`,
            ownerLockSub: () => `When enabled, your owner may also apply the Extended Lover Lock`,
            onlineOn:   () => `Online indicator  ON`,
            onlineOff:  () => `Online indicator  OFF`,
            onlineSub:  () => `Show online status dots on your own Profile`,
            dateMode:   () => `Date mode`,
            durMode:    () => `Duration mode`,
            dateSub:    () => `Start date + days together`,
            durSub:     () => `X years X months X days`,
            vibeMsgLabel:   () => `Vibe message`,
            vibeMsgBcast:   () => `Broadcast`,
            vibeSoundLabel: () => `Sound effect`,
            vibeMsgSubOn:   () => `Others can see the vibe message every 60s`,
            vibeMsgSubOff:  () => `Only you see the vibe message every 60s`,
            sevenDay:   () => `You may unilaterally end the relationship after 7 days of no contact`,
            lastSeen:   (d) => `last: ${d}d`,
            lastNever:  () => `last: never`,
            noLovers:   () => `No lovers`,
            breakupBtn: () => `Breakup`,
            modalTitle: (n) => `End relationship with ${n}?`,
            modalSub1:  () => `It is recommended to talk it over first.`,
            modalSub2:  () => `(This cannot be undone)`,
            confirmBtn: () => `Confirm`,
            // ── Dialog ────────────────────────────────────────────
            dPropose:   () => `(Send an extended lover proposal.)`,
            dProposeR:  () => `(Proposal sent, awaiting response.)`,
            dEngage:    () => `(Propose engagement.)`,
            dEngageR:   () => `(Engagement proposal sent.)`,
            dMarry:     () => `(Propose marriage.)`,
            dMarryR:    () => `(Marriage proposal sent.)`,
            dBreakup:   () => `(End extended lover relationship.)`,
            dBreakupR:  () => `(Relationship ended.)`,
            // ── Broadcast ──────────────────────────────────────────
            eventDate:  (n1,id1,n2,id2,e) => `${n1} (#${id1}) and ${n2} (#${id2}) ${e}.`,
            evDateTxt:  () => `became extended lovers`,
            evEngTxt:   (s) => `upgraded to extended [${s}]`,
            // ── Toast ─────────────────────────────────────────────
            toastLoaded:  () => `🐈‍⬛ Abundantia Florum ─Chromatica─ v${MOD_VERSION} loaded!`,
            toastFail:    () => `🐈‍⬛ [AFC] Load failed. Please refresh the page.`,
            restoreTitle:     () => `Lover Data Restore`,
            restoreOnline:    () => `Online Data`,
            restoreBackup:    () => `Backup Data`,
            restoreBtn:       () => `Restore`,
            restoreAllBtn:    () => `Use All This Data`,
            restoreEmpty:     () => `(No data)`,
            restoreConfirm1:  (n) => `Restore ${n}'s data?`,
            restoreConfirmBtn:() => `Confirm Restore`,
            restoreConfirmAll:(s) => `Use all data from ${s}?`,
            restoreOKMsg:     (n) => `Restored ${n} lover(s)`,
        },
        TW: {
            notFriend:      (n) => `請先添加 ${n} 為好友後重新提交申請。`,
            notInstalled:   (n) => `${n} 尚未安裝插件，無法申請。`,
            alreadyEL:      (n) => `${n} 已是你的拓展戀人。`,
            alreadyBC:      (n) => `${n} 已是你的原生戀人，不需要 EL 申請。`,
            cooldown:       (s) => `請等待 ${s} 秒後再申請。`,
            proposeSent:    (n) => `已向 ${n} 發送拓展戀人申請，3 分鐘內有效...`,
            proposeExpired: (n) => `向 ${n} 的申請已過期。`,
            proposeAck:     (n) => `${n} 已收到你的申請。`,
            proposeOK:      (n) => `${n} 接受了你的拓展戀人申請！`,
            breakupSelf:    (n) => `你解除了與 ${n} 的拓展戀人關係。`,
            breakupOther:   (n) => `${n} 解除了與你的拓展戀人關係。`,
            restoreSent:    (n) => `已向 ${n} 發送關係恢復申請...`,
            restoreTitle:   (n, id) => `♥ ${n} (${id}) 希望恢復與你的拓展戀人關係！`,
            restoreOK:      (n) => `已與 ${n} 恢復拓展戀人關係！`,
            dRestore:       () => `(申請恢復拓展戀人關係。)`,
            dRestoreR:      () => `(恢復申請已發送，請等待對方回應。)`,
            stageSent:    (n,s) => `已向 ${n} 發送 [${s}] 申請，3 分鐘內有效...`,
            stageExpired: (n,s) => `向 ${n} 的 [${s}] 申請已過期。`,
            stageOK:      (n,s) => `${n} 接受了你的 [${s}] 申請！`,
            stageOKSelf:  (n,s) => `你接受了 ${n} 的 [${s}] 申請！`,
            // ── Stage labels ───────────────────────────────────────
            stageDating:    () => `交往`,
            stageEngaged:   () => `訂婚`,
            stageMarried:   () => `結婚`,
            propTitle:  (n,id) => `♥ ${n} (${id}) 向你提出了拓展戀人申請！`,
            stageTitle: (n,id,s) => `💍 ${n} (${id}) 向你提出了拓展戀人【${s}】申請！`,
            bcTitle:    (n,id) => `💌 ${n} (${id}) 向你提出了 BC 原生戀人申請！`,
            bcNote:     () => `請前往【關係管理】確認申請，或等待申請自動過期。`,
            timerText:  (m,s) => `剩餘 ${m}:${s} 後自動取消`,
            okBtn:      () => `同意`,
            cancelBtn:  () => `取消`,
            panelTitle: () => `─── 拓展戀人 ───`,
            panelEmpty: () => `尚無拓展戀人`,
            btnOpen:    (n) => `更多戀人 (${n})`,
            btnClose:   () => `▲ 收起`,
            sysTitle:   () => `──系統設定──`,
            dispTitle:  () => `──顯示設定──`,
            mgmtTitle:  () => `──戀人管理──`,
            enableEL:   () => `拓展戀人系統`,
            enableELSub:() => `拓展戀人`,
            elLock:     () => `拓展戀人鎖`,
            elLockSub:  () => `（開發中，尚未完成）`,
            ownerLock:  () => `主人使用拓展鎖`,
            ownerLockSub: () => `啟用後，你的主人也可以使用拓展戀人鎖`,
            onlineOn:   () => `線上狀態燈號 開啟`,
            onlineOff:  () => `線上狀態燈號 關閉`,
            onlineSub:  () => `在自己的 Profile 顯示戀人是否在線（綠點）`,
            dateMode:   () => `日期模式`,
            durMode:    () => `時長模式`,
            dateSub:    () => `起始日期＋已交往天數`,
            durSub:     () => `交往 X年X個月X天`,
            vibeMsgLabel:   () => `震動信息`,
            vibeMsgBcast:   () => `廣播`,
            vibeSoundLabel: () => `震動音效`,
            vibeMsgSubOn:   () => `別人看的到，每60秒發送一次震動信息`,
            vibeMsgSubOff:  () => `僅自己看的到，每60秒發送一次震動信息`,
            sevenDay:   () => `超過7天沒見面時，可以單方面解除關係`,
            lastSeen:   (d) => `最後：${d}天前`,
            lastNever:  () => `最後：從未記錄`,
            noLovers:   () => `暫無戀人資料`,
            breakupBtn: () => `解除關係`,
            modalTitle: (n) => `解除與 ${n} 的拓展戀人關係？`,
            modalSub1:  () => `建議與對方再談談看`,
            modalSub2:  () => `（此操作不可逆）`,
            confirmBtn: () => `確認解除`,
            dPropose:   () => `(提出拓展戀人申請。)`,
            dProposeR:  () => `(申請已發送，請等待對方回應。)`,
            dEngage:    () => `(向此人求訂婚。)`,
            dEngageR:   () => `(訂婚申請已發送，請等待對方回應。)`,
            dMarry:     () => `(向此人求婚。)`,
            dMarryR:    () => `(求婚申請已發送，請等待對方回應。)`,
            dBreakup:   () => `(解除拓展戀人關係。)`,
            dBreakupR:  () => `(已解除拓展戀人關係。)`,
            eventDate:  (n1,id1,n2,id2,e) => `${n1} (#${id1}) 與 ${n2} (#${id2}) ${e}。`,
            evDateTxt:  () => `結為拓展戀人`,
            evEngTxt:   (s) => `升格為拓展 [${s}]`,
            // ── Toast ─────────────────────────────────────────────
            toastLoaded:  () => `🐈‍⬛ Abundantia Florum ─Chromatica─ v${MOD_VERSION} 載入完成！`,
            toastFail:    () => `🐈‍⬛ [AFC] 載入失敗，請重新整理頁面。`,
            restoreTitle:     () => `戀人資料復原`,
            restoreOnline:    () => `線上資料`,
            restoreBackup:    () => `備份資料`,
            restoreBtn:       () => `復原`,
            restoreAllBtn:    () => `全部使用此資料`,
            restoreEmpty:     () => `（無資料）`,
            restoreConfirm1:  (n) => `確認復原 ${n} 的資料？`,
            restoreConfirmBtn:() => `確認復原`,
            restoreConfirmAll:(s) => `確認使用 ${s} 的全部資料？`,
            restoreOKMsg:     (n) => `已復原 ${n} 筆戀人資料`,
        },
    };
    // Simplified Chinese inherits Traditional Chinese
    _S.CN = Object.assign({}, _S.TW);

    /** 取得翻譯字串（每次呼叫動態偵測語系） */
    function t(key, ...args) {
        const lang = detectLang();
        const dict = _S[lang] ?? _S.EN;
        const fn   = dict[key] ?? _S.EN[key];
        if (!fn) { console.warn("🐈‍⬛ [AFC] missing i18n key:", key); return key; }
        return typeof fn === 'function' ? fn(...args) : fn;
    }

    /** 取得戀人階段的本地化標籤（接受數字 0/1/2 或舊版字串） */
    function stageLabel(stage) {
        // 舊版字串 → 數字
        if (typeof stage === 'string') {
            stage = stage === 'married' ? 2 : stage === 'engaged' ? 1 : 0;
        }
        const map = { 0: 'stageDating', 1: 'stageEngaged', 2: 'stageMarried' };
        return t(map[stage] ?? 'stageDating');
    }

    // Profile 按鈕（依 profile.txt "More loves" 按鈕座標）
    const PROFILE_BTN_X = 1020;
    const PROFILE_BTN_Y = 100;
    const PROFILE_BTN_W = 165;
    const PROFILE_BTN_H = 50;

    // ============================================================
    // 執行期狀態
    // ============================================================
    let modApi        = null;
    let isInitialized = false;

    const ELLockAccessOn   = new Set();
    const pendingOutgoing  = {};   // EL 戀人申請（發起方）
    const pendingIncoming  = {};   // EL 戀人申請（接收方 UI）
    const pendingStageProp = {};   // 升格申請（發起方）
    const pendingStageInc  = {};   // 升格申請（接收方 UI）
    const loversPrivateRoom = {};
    let   currentPrivateRoomName = "";
    let   profilePanelOpen       = false;

    // Beep 去重 Set（防止 AccountBeep + ChatRoom relay 重複觸發）
    const _recentBeepKeys = new Set();

    let profilePageFresh = false;  // 每次進入 Profile 頁面時強制刷新一次線上狀態
    let onlineFriendsCache = new Set();
    let lastOnlineFetch    = 0;

    // ============================================================
    // ServerSocket 監聽
    // ============================================================
    const socketListeners = [];

    function registerSocketListener(event, listener) {
        if (!socketListeners.some(l => l[1] === listener)) {
            socketListeners.push([event, listener]);
            ServerSocket.on(event, listener);
        }
    }

    function unregisterAllSocketListeners() {
        for (const [event, listener] of socketListeners) ServerSocket.off(event, listener);
        socketListeners.length = 0;
    }

    // ============================================================
    // 設定讀寫
    // ============================================================

    function getSharedSettings() {
        if (!Player?.OnlineSharedSettings) return null;
        if (!Player.OnlineSharedSettings.AFC)
            Player.OnlineSharedSettings.AFC = {
                version: MOD_VERSION,
                lovers: [],
                lockPerms:    { enableELLock: false, enableOwnerLock: false },
                vibeMsgMode:  'broadcast',
                enableVibeSound: true,
            };
        if (!Player.OnlineSharedSettings.AFC.lockPerms)
            Player.OnlineSharedSettings.AFC.lockPerms = { enableELLock: false, enableOwnerLock: false };
        if (Player.OnlineSharedSettings.AFC.vibeMsgMode === undefined) {
            const old = Player.OnlineSharedSettings.AFC.enableVibeMsg;
            Player.OnlineSharedSettings.AFC.vibeMsgMode = (old === false) ? 'off' : 'broadcast';
            delete Player.OnlineSharedSettings.AFC.enableVibeMsg;
        }
        if (Player.OnlineSharedSettings.AFC.enableVibeSound === undefined)
            Player.OnlineSharedSettings.AFC.enableVibeSound = true;

        // 清除 OnlineSharedSettings 的舊版 EL 殘留
        if (Player.OnlineSharedSettings.EL !== undefined) {
            delete Player.OnlineSharedSettings.EL;
        }

        // 資料遷移：字串 stage → 數字，補 lastSeen 欄位
        const lovers = Player.OnlineSharedSettings.AFC.lovers ?? [];
        let migrated = false;
        for (const l of lovers) {
            if (typeof l.stage === 'string') {
                l.stage = l.stage === 'married' ? 2 : l.stage === 'engaged' ? 1 : 0;
                migrated = true;
            }
            if (l.lastSeen === undefined) { l.lastSeen = null; migrated = true; }
        }
        if (migrated) setTimeout(() => saveSharedSettings(), 500);

        return Player.OnlineSharedSettings.AFC;
    }

    // lastProposalSent：只需 runtime 保存，不需寫入 ExtensionSettings
    // 頁面重整後冷卻自然重置，這是正確行為
    const _lastProposalSent = {};

    // ── 舊版 AFC_loversBackup 遺留清除（一次性）──────────────────────
    function _cleanLegacyBackup() {
        try {
            if (Player?.ExtensionSettings?.AFC_loversBackup !== undefined) {
                delete Player.ExtensionSettings.AFC_loversBackup;
            }
        } catch {}
    }

    /*
     * AFC 私人設定緊湊格式（v2）
     * cfg 陣列位置：
     *   [0] displayMode     0=duration, 1=date
     *   [1] showOnlineStatus
     *   [2] enableEL
     *   [3] enableELLock
     *   [4] enableOwnerLock
     *   [5] allowTimerExtension
     *   [6] allowSelfUnlock
     *
     * lp  = lastProposalSent { [memberNumber]: timestamp }
     * l   = lovers 備份（緊湊陣列，與 OnlineSharedSettings 同步）
     *        每筆：[memberNumber, name, stage(0/1/2), startDate, stageDate, lastSeen]
     */
    function defaultPrivate() {
        return { v: MOD_VERSION, cfg: [0, 1, 1, 0, 0, 1, 0], l: [] };
    }

    function _unpackPrivate(p) {
        const c = p.cfg ?? [0, 1, 1, 0, 0, 1, 0];
        return {
            version:         p.v   ?? MOD_VERSION,
            displayMode:     c[0]  ? 'date' : 'duration',
            showOnlineStatus:!!c[1],
            enableEL:        c[2]  !== 0 && c[2] !== false,
            enableELLock:    !!c[3],
            enableOwnerLock: !!c[4],
            lockSettings:    { allowTimerExtension: c[5] !== 0 && c[5] !== false, allowSelfUnlock: !!c[6] },
            lastSeen:        {},   // 已移至 lover.lastSeen
            lastProposalSent:{},  // runtime only
        };
    }

    function _packPrivate(s, lovers) {
        return {
            v:   MOD_VERSION,
            cfg: [
                s.displayMode === 'date' ? 1 : 0,
                s.showOnlineStatus ? 1 : 0,
                s.enableEL        ? 1 : 0,
                s.enableELLock    ? 1 : 0,
                s.enableOwnerLock ? 1 : 0,
                s.lockSettings?.allowTimerExtension ? 1 : 0,
                s.lockSettings?.allowSelfUnlock     ? 1 : 0,
            ],
            // lp removed - runtime only
            l:  (lovers ?? []).map(l => [
                l.memberNumber, l.name,
                typeof l.stage === 'string' ? (l.stage === 'married' ? 2 : l.stage === 'engaged' ? 1 : 0) : (l.stage ?? 0),
                l.startDate ?? Date.now(), l.stageDate ?? l.startDate ?? Date.now(),
                l.lastSeen ?? null,
            ]),
        };
    }

    /** 從私人設定備份讀取 lovers（展開緊湊格式） */
    function _readBackupLovers() {
        try {
            const raw = Player?.ExtensionSettings?.AFC;
            if (!raw) return [];
            const p = JSON.parse(raw.startsWith('{') || raw.startsWith('[') ? raw : LZString.decompressFromBase64(raw));
            return (p.l ?? []).map(e => Array.isArray(e) ? {
                memberNumber: e[0], name: e[1], stage: e[2] ?? 0,
                startDate: e[3], stageDate: e[4], lastSeen: e[5] ?? null, lockEnabled: false,
            } : e);
        } catch { return []; }
    }

    function getPrivateSettings() {
        if (!Player?.ExtensionSettings) return null;
        const raw = Player.ExtensionSettings.AFC;
        if (!raw) {
            const def = defaultPrivate();
            Player.ExtensionSettings.AFC = JSON.stringify(def);
            if (typeof ServerPlayerExtensionSettingsSync === 'function')
                ServerPlayerExtensionSettingsSync("AFC");
            return _unpackPrivate(def);
        }
        try {
            const isLegacy = !raw.startsWith('{') && !raw.startsWith('[');
            const parsed = isLegacy
            ? JSON.parse(LZString.decompressFromBase64(raw))
            : JSON.parse(raw);

            // 舊版 JSON 格式（有 "version" 長 key）→ 自動升級
            if (isLegacy || parsed.version !== undefined) {
                const upgraded = {
                    v:   MOD_VERSION,
                    cfg: [
                        parsed.displayMode === 'date' ? 1 : 0,
                        (parsed.showOnlineStatus ?? true)  ? 1 : 0,
                        (parsed.enableEL         ?? true)  ? 1 : 0,
                        (parsed.enableELLock      ?? false) ? 1 : 0,
                        (parsed.enableOwnerLock   ?? false) ? 1 : 0,
                        (parsed.lockSettings?.allowTimerExtension ?? true)  ? 1 : 0,
                        (parsed.lockSettings?.allowSelfUnlock     ?? false) ? 1 : 0,
                    ],
                    // lp removed
                };
                // 遷移：把舊版 ls 的時間戳移進 lover.lastSeen
                const oldLs = parsed.lastSeen ?? {};
                if (Object.keys(oldLs).length) {
                    const s = getSharedSettings();
                    if (s) {
                        for (const l of s.lovers) {
                            const ts = oldLs[l.memberNumber] ?? oldLs[String(l.memberNumber)];
                            if (ts && !l.lastSeen) l.lastSeen = ts;
                        }
                        setTimeout(() => saveSharedSettings(), 600);
                    }
                }
                Player.ExtensionSettings.AFC = JSON.stringify(upgraded);
                if (typeof ServerPlayerExtensionSettingsSync === 'function')
                    ServerPlayerExtensionSettingsSync("AFC");
                console.log("🐈‍⬛ [AFC] ✅ 私人設定已升級（ls → lover.lastSeen）");
                return _unpackPrivate(upgraded);
            }

            // 新版格式但仍有舊 ls → 清除並遷移
            if (parsed.ls && Object.keys(parsed.ls).length) {
                const s = getSharedSettings();
                if (s) {
                    for (const l of s.lovers) {
                        const ts = parsed.ls[l.memberNumber] ?? parsed.ls[String(l.memberNumber)];
                        if (ts && !l.lastSeen) l.lastSeen = ts;
                    }
                    setTimeout(() => saveSharedSettings(), 600);
                }
                delete parsed.ls;
                Player.ExtensionSettings.AFC = JSON.stringify(parsed);
                if (typeof ServerPlayerExtensionSettingsSync === 'function')
                    ServerPlayerExtensionSettingsSync("AFC");
                console.log("🐈‍⬛ [AFC] ✅ 已清除 ls 殘留並遷移至 lover.lastSeen");
            }

            return _unpackPrivate(parsed);
        } catch (e) {
            console.error("🐈‍⬛ [AFC] ❌ 解析私人設定失敗:", e.message);
            return _unpackPrivate(defaultPrivate());
        }
    }

    function savePrivateSettings(settings) {
        try {
            const lovers = getSharedSettings()?.lovers ?? [];
            Player.ExtensionSettings.AFC = JSON.stringify(_packPrivate(settings, lovers));
            if (typeof ServerPlayerExtensionSettingsSync === 'function')
                ServerPlayerExtensionSettingsSync("AFC");
        } catch (e) { console.error("🐈‍⬛ [AFC] ❌ 儲存私人設定失敗:", e.message); }
    }

    /** 同步備份 lovers 到 ExtensionSettings（不改其他設定值） */
    function _syncLoversBackup() {
        try {
            const priv = getPrivateSettings();
            if (priv) savePrivateSettings(priv);
        } catch {}
    }

    // 上一次已知的戀人數量（防止異常覆蓋）
    let _lastKnownLoverCount = -1;

    function saveSharedSettings() {
        try {
            const afc = Player.OnlineSharedSettings?.AFC;
            if (!afc) return;
            const currentCount = afc.lovers?.length ?? 0;
            // 偵測「有戀人 → 突然變 0」的異常，跳過儲存
            if (_lastKnownLoverCount > 0 && currentCount === 0) {
                console.warn(`🐈‍⬛ [AFC] ⚠️ 偵測到戀人資料異常清空（${_lastKnownLoverCount} → 0），跳過儲存`);
                return;
            }
            _lastKnownLoverCount = currentCount;
            ServerAccountUpdate?.QueueData?.({ OnlineSharedSettings: Player.OnlineSharedSettings });
        } catch (e) { console.error("🐈‍⬛ [AFC] ❌ 儲存共享設定失敗:", e.message); }
        // 同時廣播給房間內玩家
        broadcastAFCData();
    }

    // P2P 廣播：將 AFC 共享資料透過 Hidden 訊息傳給房間內所有玩家
    function broadcastAFCData() {
        try {
            if (typeof ServerSend !== 'function') return;
            const s = Player.OnlineSharedSettings?.AFC;
            if (!s) return;
            ServerSend('ChatRoomChat', {
                Type: 'Hidden',
                Content: 'AFC::Sync',
                Dictionary: [{ Tag: 'AFCData', Data: {
                    lovers:   s.lovers   ?? [],
                    lockPerms: s.lockPerms ?? { enableELLock: false, enableOwnerLock: false },
                }}],
            });
        } catch {}
    }

    // 處理收到的 AFC 廣播（讓其他玩家的客戶端能即時看到你的戀人列表）
    function handleAFCSyncData(data) {
        if (data?.Content !== 'AFC::Sync') return false;
        try {
            const e = data.Dictionary?.find(d => d.Tag === 'AFCData');
            if (!e) return true;
            // 自己的廣播不處理（防止 self-overwrite 覆蓋 Player.OnlineSharedSettings）
            if (data.Sender === Player.MemberNumber) return true;
            const sender = ChatRoomCharacter?.find(c => c.MemberNumber === data.Sender);
            if (!sender) return true;
            if (!sender.OnlineSharedSettings) sender.OnlineSharedSettings = {};
            if (!sender.OnlineSharedSettings.AFC) sender.OnlineSharedSettings.AFC = {};
            if (e.Data.lovers    !== undefined) sender.OnlineSharedSettings.AFC.lovers    = e.Data.lovers;
            if (e.Data.lockPerms !== undefined) sender.OnlineSharedSettings.AFC.lockPerms = e.Data.lockPerms;
        } catch {}
        return true;
    }

    // 將鎖的權限從私人設定同步到共享設定（讓對方插件讀取）
    // 當 enableEL = false 時，共享的鎖權限一律為 false
    function syncLockPermsToShared(priv) {
        const s = getSharedSettings();
        if (!s) return;
        const elActive = priv.enableEL ?? true;
        s.lockPerms = {
            enableELLock:    elActive && (priv.enableELLock    ?? false),
            enableOwnerLock: elActive && (priv.enableOwnerLock ?? false),
        };
        saveSharedSettings();
    }

    // ============================================================
    // 工具
    // ============================================================

    function sendBeep(target, msgType, extra = {}) {
        try {
            ServerSend("ChatRoomChat", {
                Type:    "Hidden",
                Content: "AFC::Beep",
                Dictionary: [{ Tag: "AFC::Beep", MsgType: msgType, TargetMember: target, ...extra }],
            });
        } catch {}
    }

    function chatLocalNotice(text) { ChatRoomSendLocal(`[AFC] ${text}`); }
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // timeout=0 表示無限等待，不超時
    function waitFor(condition, timeout = 0) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (condition()) { resolve(true); return; }
                if (timeout > 0 && Date.now() - start > timeout) { resolve(false); return; }
                setTimeout(check, 200);
            };
            check();
        });
    }

    function daysSince(ts) {
        return Math.floor((Date.now() - (ts ?? Date.now())) / 86400000);
    }

    // ============================================================
    // Toast 系統（仿 CHE：先看 require 有沒有帶進來，沒有就動態載入）
    // ============================================================

    const TOAST_URL = "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js";

    function loadToastSystem() {
        return new Promise((resolve) => {
            if (typeof window.ChatRoomSendLocalStyled === 'function') { resolve(); return; }
            const script = document.createElement('script');
            script.src = TOAST_URL;
            script.onload  = () => resolve();
            script.onerror = () => {
                console.warn("🐈‍⬛ [AFC] ⚠️ Toast 系統載入失敗，將使用 console 替代");
                // 備用：讓 chatLocalNotice 擔任 toast
                window.ChatRoomSendLocalStyled = (msg) => console.log("[EL toast]", msg);
                resolve();
            };
            document.head.appendChild(script);
        });
    }

    function toast(msg, ms = 4000, color = "#7C3AED") {
        if (typeof window.ChatRoomSendLocalStyled === 'function') {
            window.ChatRoomSendLocalStyled(msg, ms, color);
        } else {
            console.log("[EL toast]", msg);
        }
    }

    // 格式化持續時間：「交往 1年2個月15天」
    function formatDuration(ms) {
        const totalDays = Math.floor(ms / 86400000);
        const years     = Math.floor(totalDays / 365);
        const months    = Math.floor((totalDays % 365) / 30);
        const remDays   = totalDays - years * 365 - months * 30;
        let s = "交往";
        if (years  > 0) s += `${years}年`;
        if (months > 0) s += `${months}個月`;
        if (years === 0 && months === 0) s += `${totalDays}天`;
        else if (remDays > 0) s += `${remDays}天`;
        return s;
    }

    // 格式化起始日：「2025/03/23 (共395天)」
    function formatStartDate(ts) {
        const d = new Date(ts);
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yy}/${mm}/${dd} (共${daysSince(ts)}天)`;
    }

    // ============================================================
    // 戀人資料
    // ============================================================

    function addLover(memberNumber, name, stage = STAGE.DATING) {
        const s = getSharedSettings();
        if (!s || s.lovers.some(l => l.memberNumber === memberNumber)) return;
        s.lovers.push({
            memberNumber, name, stage,
            startDate:   Date.now(),
            stageDate:   Date.now(),
            lockEnabled: false,
        });
        saveSharedSettings();
        _syncLoversBackup();
        broadcastAFCData();
        console.log("🐈‍⬛ [AFC] ✅ 新增戀人:", name, memberNumber);
    }

    function removeLover(memberNumber) {
        const s = getSharedSettings();
        if (!s) return;
        s.lovers = s.lovers.filter(l => l.memberNumber !== memberNumber);
        ELLockAccessOn.delete(memberNumber);
        delete loversPrivateRoom[memberNumber];
        _lastKnownLoverCount = s.lovers.length;
        saveSharedSettings();
        _syncLoversBackup();
        broadcastAFCData();
    }

    // 升格戀人關係階段
    function promoteStage(memberNumber, newStage) {
        const s = getSharedSettings();
        const lover = s?.lovers.find(l => l.memberNumber === memberNumber);
        if (!lover) return;
        lover.stage     = newStage;
        lover.stageDate = Date.now();
        saveSharedSettings();
        _syncLoversBackup();
    }

    function getLoverEntry(memberNumber) {
        return getSharedSettings()?.lovers.find(l => l.memberNumber === memberNumber);
    }

    function isELLover(memberNumber) {
        return getSharedSettings()?.lovers.some(l => l.memberNumber === memberNumber) ?? false;
    }

    function targetHasEL(C) { return !!(C?.OnlineSharedSettings?.AFC); }

    function isNativeLover(memberNumber) {
        return Player.Lovership?.some(l => l.MemberNumber === memberNumber) ?? false;
    }

    // ============================================================
    // 線上狀態
    // ============================================================

    async function refreshOnlineFriends() {
        if (Date.now() - lastOnlineFetch < 30000) return;  // 節流 30 秒
        lastOnlineFetch = Date.now();
        return new Promise(resolve => {
            let resolved = false;
            const timer = setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 5000);
            const handler = (data) => {
                if (data?.Query !== "OnlineFriends") return;
                ServerSocket.off("AccountQueryResult", handler);
                clearTimeout(timer);
                onlineFriendsCache = new Set(data.Result?.map(f => f.MemberNumber) ?? []);
                lastOnlineFetch    = Date.now();
                if (!resolved) { resolved = true; resolve(); }
            };
            ServerSocket.on("AccountQueryResult", handler);
            ServerSend("AccountQuery", { Query: "OnlineFriends" });
        });
    }

    // 判斷某個 MemberNumber 是否在線
    // 僅用兩個可靠來源：同房間角色 + OnlineFriends 查詢快取
    // ELLockAccessOn 是鎖定授權，不代表對方目前在線，不納入判斷
    function isOnline(memberNumber) {
        if (ChatRoomCharacter?.some(c => c.MemberNumber === memberNumber)) return true;
        return onlineFriendsCache.has(memberNumber);
    }

    // ============================================================
    // 最後見面紀錄
    // ============================================================

    function updateLastSeen(memberNumber) {
        const s = getSharedSettings();
        const lover = s?.lovers.find(l => l.memberNumber === memberNumber);
        if (lover) {
            lover.lastSeen = Date.now();
            saveSharedSettings();
        }
    }

    // ============================================================
    // 自動解除（超過 N 天未見面）
    // ============================================================

    function checkAutoBreakup() {
        const priv = getPrivateSettings();
        if (!priv?.autoBreakupDays || priv.autoBreakupDays <= 0) return;
        const s = getSharedSettings();
        if (!s) return;
        const threshold = priv.autoBreakupDays;
        for (const lover of [...s.lovers]) {
            const lastSeen = lover.lastSeen ?? lover.startDate;
            if (daysSince(lastSeen) >= threshold) {
                chatLocalNotice(`與 ${lover.name} 已超過 ${threshold} 天未見面，自動解除拓展戀人關係。`);
                initiateBreakup(lover.memberNumber, lover.name);
            }
        }
    }

    // ============================================================
    // Window Prerequisite 函式
    // ============================================================

    window.ChatRoomELCanPropose = function () {
        const C = CurrentCharacter;
        if (!C?.MemberNumber || C.MemberNumber === Player.MemberNumber) return false;
        if (isELLover(C.MemberNumber)) return false;
        if (isNativeLover(C.MemberNumber)) return false;
        if (!targetHasEL(C)) return false;
        return true;
    };

    window.ChatRoomELCanBreakup = function () {
        return !!(CurrentCharacter?.MemberNumber && isELLover(CurrentCharacter.MemberNumber));
    };

    // 訂婚條件：交往滿 STAGE_PROMOTE_DAYS 天
    window.ChatRoomELCanProposeEngage = function () {
        if (!CurrentCharacter) return false;
        const l = getLoverEntry(CurrentCharacter.MemberNumber);
        if (!l || l.stage !== STAGE.DATING) return false;
        return daysSince(l.startDate) >= STAGE_PROMOTE_DAYS;
    };

    // 結婚條件：訂婚滿 STAGE_PROMOTE_DAYS 天
    window.ChatRoomELCanProposeMarry = function () {
        if (!CurrentCharacter) return false;
        const l = getLoverEntry(CurrentCharacter.MemberNumber);
        if (!l || l.stage !== STAGE.ENGAGED) return false;
        return daysSince(l.stageDate ?? l.startDate) >= STAGE_PROMOTE_DAYS;
    };

    // 恢復條件：對方有我（寬鬆條件，點擊時才做完整驗證）
    // 只要我還不是對方的拓展戀人就顯示（讓點擊時決定）
    window.ChatRoomELCanRestore = function () {
        const C = CurrentCharacter;
        if (!C?.MemberNumber || C.MemberNumber === Player.MemberNumber) return false;
        if (isNativeLover(C.MemberNumber)) return false;
        if (!targetHasEL(C)) return false;
        const iHaveC = isELLover(C.MemberNumber);
        const cHasMe = C.OnlineSharedSettings?.AFC?.lovers
        ?.some(l => Number(l.memberNumber) === Number(Player.MemberNumber)) ?? false;
        // 情況A：對方有我但我沒有對方 | 情況B：我有對方但對方沒有我
        return (iHaveC && !cHasMe) || (!iHaveC && cHasMe);
    };

    window.ChatRoomELRestore = function () {
        if (!CurrentCharacter) return;
        proposeRestore(CurrentCharacter);
    };

    const pendingRestoreOut = {};
    const pendingRestoreInc = {};

    function proposeRestore(C) {
        const target = C.MemberNumber;
        const iHaveC = isELLover(target);
        const cHasMe = C.OnlineSharedSettings?.AFC?.lovers
        ?.some(l => Number(l.memberNumber) === Number(Player.MemberNumber)) ?? false;

        let stage, startDate, stageDate;
        if (iHaveC && !cHasMe) {
            // 情況B：我有對方的記錄，傳給對方
            const myEntry = getLoverEntry(target);
            if (!myEntry) return;
            stage = myEntry.stage; startDate = myEntry.startDate; stageDate = myEntry.stageDate;
        } else if (!iHaveC && cHasMe) {
            // 情況A：對方有我的記錄，讀取後傳
            const theirEntry = C.OnlineSharedSettings?.AFC?.lovers
            ?.find(l => Number(l.memberNumber) === Number(Player.MemberNumber));
            if (!theirEntry) return;
            stage = theirEntry.stage; startDate = theirEntry.startDate; stageDate = theirEntry.stageDate;
        } else { return; }

        sendBeep(target, BEEP.RESTORE_PROPOSE, {
            SenderName: Player.Name,
            Stage:      stage     ?? STAGE.DATING,
            StartDate:  startDate ?? Date.now(),
            StageDate:  stageDate ?? Date.now(),
        });
        if (pendingRestoreOut[target]) clearTimeout(pendingRestoreOut[target].timer);
        pendingRestoreOut[target] = {
            timer: setTimeout(() => { delete pendingRestoreOut[target]; }, PROPOSE_EXPIRE_MS),
        };
        chatLocalNotice(t('restoreSent', C.Name));
    }

    function handleIncomingRestore(senderNum, senderName, stage, startDate, stageDate) {
        if (pendingRestoreInc[senderNum]) return;
        const uiId = `el-restore-${senderNum}`;
        const el = createProposalUI({
            uiId,
            title:     t('restoreTitle', senderName, senderNum),
            subText:   t('timerText', 3, '00'),
            onAccept:  () => acceptRestore(senderNum, senderName, stage, startDate, stageDate),
            onDecline: () => cleanupRestoreUI(senderNum),
        });
        if (!el) return;

        const iv = startCountdown(uiId, `${uiId}-sub`,
                                  () => cleanupRestoreUI(senderNum), null);
        pendingRestoreInc[senderNum] = { timer: iv, uiId };
    }

    function acceptRestore(senderNum, senderName, stage, startDate, stageDate) {
        cleanupRestoreUI(senderNum);
        const s = getSharedSettings();
        if (!s) return;

        const alreadyHave = s.lovers.some(l => Number(l.memberNumber) === Number(senderNum));

        if (!alreadyHave) {
            // Case B：我（丟失方）收到保有方的申請，直接 addLover
            s.lovers.push({ memberNumber: senderNum, name: senderName,
                           stage, startDate, stageDate, lockEnabled: false });
            saveSharedSettings();
            broadcastAFCData();
        }
        // 無論哪個 Case，都把資料帶回給對方
        // Case A：我（保有方）已有對方，找出我記錄的對方資料，回傳讓對方 addLover
        // Case B：我剛 addLover 完畢，回傳確認
        const myEntryForSender = s.lovers.find(l => Number(l.memberNumber) === Number(senderNum));
        ELLockAccessOn.add(senderNum);
        updateLastSeen(senderNum);
        sendBeep(senderNum, BEEP.RESTORE_ACCEPT, {
            ReceiverName:      Player.Name,
            Stage:             myEntryForSender?.stage     ?? stage,
            StartDate:         myEntryForSender?.startDate ?? startDate,
            StageDate:         myEntryForSender?.stageDate ?? stageDate,
        });
        chatLocalNotice(t('restoreOK', senderName));
    }

    function handleRestoreAccepted(fromNum, receiverName, stage, startDate, stageDate) {
        if (pendingRestoreOut[fromNum]) {
            clearTimeout(pendingRestoreOut[fromNum].timer);
            delete pendingRestoreOut[fromNum];
        }
        // Case A：我是丟失方，對方回傳資料，現在 addLover
        if (!isELLover(fromNum)) {
            const s = getSharedSettings();
            if (s && !s.lovers.some(l => Number(l.memberNumber) === Number(fromNum))) {
                s.lovers.push({ memberNumber: fromNum, name: receiverName,
                               stage: stage ?? STAGE.DATING,
                               startDate: startDate ?? Date.now(),
                               stageDate: stageDate ?? Date.now(),
                               lockEnabled: false });
                saveSharedSettings();
                broadcastAFCData();
            }
        }
        ELLockAccessOn.add(fromNum);
        updateLastSeen(fromNum);
        chatLocalNotice(t('restoreOK', receiverName));
    }
    function cleanupRestoreUI(num) {
        const p = pendingRestoreInc[num];
        if (!p) return;
        clearInterval(p.timer);
        document.getElementById(p.uiId)?.remove();
        delete pendingRestoreInc[num];
    }

    window.ChatRoomELPropose       = function () { if (CurrentCharacter) proposeToCharacter(CurrentCharacter); };
    window.ChatRoomELBreakup       = function () { if (CurrentCharacter) initiateBreakup(CurrentCharacter.MemberNumber, CurrentCharacter.Name); };
    window.ChatRoomELProposeEngage = function () { if (CurrentCharacter) proposeStageUpgrade(CurrentCharacter, STAGE.ENGAGED); };
    window.ChatRoomELProposeMarry  = function () { if (CurrentCharacter) proposeStageUpgrade(CurrentCharacter, STAGE.MARRIED); };

    // ============================================================
    // Dialog 注入
    // ============================================================

    const EL_MARKER = "__EL__";

    function makeDialog(option, result, fn, marker) {
        return {
            Stage:       "RelationshipSubmenu",
            NextStage:   "0",
            Function:    fn,
            Option:      option,
            Result:      result,
            [EL_MARKER]: marker,
        };
    }

    function injectELDialogs(C) {
        if (!C) return;
        const dialog = C.Dialog;
        if (!Array.isArray(dialog) || dialog.length === 0) return;

        for (let i = dialog.length - 1; i >= 0; i--)
            if (dialog[i]?.[EL_MARKER]) dialog.splice(i, 1);

        const backIndex = dialog.findIndex(d =>
                                           d?.Stage === "RelationshipSubmenu" && d?.NextStage === "10"
                                          );
        if (backIndex === -1) return;

        const toInsert = [];
        if (window.ChatRoomELCanPropose?.())
            toInsert.push(makeDialog(t('dPropose'), t('dProposeR'), "ChatRoomELPropose()", "propose"));
        if (window.ChatRoomELCanRestore?.())
            toInsert.push(makeDialog(t('dRestore'), t('dRestoreR'), "ChatRoomELRestore()", "restore"));
        if (window.ChatRoomELCanProposeEngage?.())
            toInsert.push(makeDialog(t('dEngage'), t('dEngageR'), "ChatRoomELProposeEngage()", "engage"));
        if (window.ChatRoomELCanProposeMarry?.())
            toInsert.push(makeDialog(t('dMarry'), t('dMarryR'), "ChatRoomELProposeMarry()", "marry"));
        if (window.ChatRoomELCanBreakup?.())
            toInsert.push(makeDialog(t('dBreakup'), t('dBreakupR'), "ChatRoomELBreakup()", "breakup"));

        if (toInsert.length === 0) return;
        dialog.splice(backIndex, 0, ...toInsert);
    }

    // ============================================================
    // 提案 UI 建立輔助
    // ============================================================

    function createProposalUI({ uiId, title, subText, onAccept, onDecline }) {
        if (document.getElementById(uiId)) return null;

        // 優先附加到聊天框（標準 BC），EBC 沙盒環境可能找不到，退回 document.body
        let container = document.getElementById("TextAreaChatLog");
        const isFloating = !container;
        if (isFloating) container = document.body;
        if (!container) return null;

        const el = document.createElement("div");
        el.id = uiId;
        if (isFloating) {
            // EBC / 沙盒環境：用懸浮樣式確保可見
            el.style.cssText = [
                "position:fixed",
                "bottom:120px",
                "left:50%",
                "transform:translateX(-50%)",
                "z-index:99999",
                "max-width:600px",
                "width:90vw",
                "background:rgba(60,10,30,0.97)",
                "border:2px solid #E8618C",
                "border-radius:10px",
                "padding:14px 18px",
                "font-size:1em",
                "line-height:1.6",
                "color:#eee",
                "box-shadow:0 4px 24px rgba(0,0,0,0.7)",
            ].join(";");
        } else {
            el.style.cssText = [
                "background:rgba(60,10,30,0.93)",
                "border:2px solid #E8618C",
                "border-radius:8px",
                "padding:10px 14px 10px",
                "margin:6px 4px",
                "font-size:1em",
                "line-height:1.5",
                "color:#eee",
            ].join(";");
        }
        el.innerHTML = `
            <div style="font-weight:bold;font-size:1.05em;margin-bottom:7px;">${title}</div>
            <div style="display:flex;align-items:center;gap:10px;">
                <button id="${uiId}-ok" style="padding:4px 18px;background:#C2185B;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:0.95em;white-space:nowrap;">${t('okBtn')}</button>
                <button id="${uiId}-no" style="padding:4px 14px;background:transparent;color:#bbb;border:1px solid #555;border-radius:5px;cursor:pointer;font-size:0.95em;white-space:nowrap;">${t('cancelBtn')}</button>
                <span id="${uiId}-sub" style="font-size:0.88em;opacity:0.6;">${subText}</span>
            </div>`;

        container.appendChild(el);
        if (!isFloating) container.scrollTop = container.scrollHeight;
        document.getElementById(`${uiId}-ok`)?.addEventListener('click', onAccept);
        document.getElementById(`${uiId}-no`)?.addEventListener('click', onDecline);
        return el;
    }

    // expireMsg: 過期時顯示的系統提示
    function startCountdown(uiId, subId, onExpire, expireMsg) {
        const start = Date.now();
        const iv = setInterval(() => {
            const left = PROPOSE_EXPIRE_MS - (Date.now() - start);
            if (left <= 0) {
                clearInterval(iv);
                onExpire();
                if (expireMsg) chatLocalNotice(expireMsg);
                return;
            }
            const m = Math.floor(left / 60000);
            const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
            const tEl = document.getElementById(subId);
            if (tEl) tEl.textContent = t('timerText', m, s);
        }, 1000);
        return iv;
    }

    // ============================================================
    // ① 申請流程 — 發起方
    // ============================================================

    function proposeToCharacter(C) {
        const target = C.MemberNumber;
        if (!Player.FriendList?.includes(target)) {
            chatLocalNotice(t('notFriend', C.Name)); return;
        }
        if (!targetHasEL(C))      { chatLocalNotice(t('notInstalled', C.Name)); return; }
        if (isELLover(target))    { chatLocalNotice(t('alreadyEL', C.Name)); return; }
        if (isNativeLover(target)){ chatLocalNotice(t('alreadyBC', C.Name)); return; }

        const priv = getPrivateSettings();
        const last = _lastProposalSent[target] ?? 0;
        if (Date.now() - last < PROPOSE_COOLDOWN_MS) {
            const sec = Math.ceil((PROPOSE_COOLDOWN_MS - (Date.now() - last)) / 1000);
            chatLocalNotice(t('cooldown', sec)); return;
        }

        sendBeep(target, BEEP.PROPOSE, { SenderName: Player.Name });

        if (priv) {
            _lastProposalSent[target] = Date.now();
            savePrivateSettings(priv);
        }

        if (pendingOutgoing[target]) clearTimeout(pendingOutgoing[target].timer);
        pendingOutgoing[target] = {
            timer: setTimeout(() => {
                delete pendingOutgoing[target];
                // 若對方已接受（已成為戀人），不顯示逾時訊息
                if (!isELLover(target)) chatLocalNotice(t('proposeExpired', C.Name));
            }, PROPOSE_EXPIRE_MS),
        };
        chatLocalNotice(t('proposeSent', C.Name));
    }

    // ② 申請流程 — 接收方 UI
    function handleIncomingProposal(senderNum, senderName) {
        if (pendingIncoming[senderNum]) return;

        // 若已是戀人（雙向確認）則不需要再提案
        const senderChar = ChatRoomCharacter?.find(c => c.MemberNumber === senderNum);
        const senderHasMe = senderChar?.OnlineSharedSettings?.AFC?.lovers
        ?.some(l => Number(l.memberNumber) === Number(Player.MemberNumber)) ?? false;
        if (isELLover(senderNum) || isNativeLover(senderNum)) return;  // 已是戀人
        // （senderHasMe 只是資料丟失時的容錯，仍允許顯示申請 UI）

        sendBeep(senderNum, BEEP.PROPOSE_ACK);

        const uiId = `el-proposal-${senderNum}`;

        const el = createProposalUI({
            uiId,
            title:     t('propTitle', senderName, senderNum),
            subText:   t('timerText', 3, '00'),
            onAccept:  () => acceptProposal(senderNum, senderName),
            onDecline: () => cleanupIncomingUI(senderNum),
        });
        if (!el) return;

        const iv = startCountdown(uiId, `${uiId}-sub`, () => cleanupIncomingUI(senderNum),
                                  t('proposeExpired', senderName));
        pendingIncoming[senderNum] = { timer: iv, uiId };
    }

    function cleanupIncomingUI(num) {
        const p = pendingIncoming[num];
        if (!p) return;
        clearInterval(p.timer);
        document.getElementById(p.uiId)?.remove();
        delete pendingIncoming[num];
    }

    function acceptProposal(senderNum, senderName) {
        cleanupIncomingUI(senderNum);
        addLover(senderNum, senderName, STAGE.DATING);
        ELLockAccessOn.add(senderNum);
        updateLastSeen(senderNum);
        broadcastAction(senderNum, senderName, t('evDateTxt'));
        sendBeep(senderNum, BEEP.ACCEPT, { ReceiverName: Player.Name });
    }

    function handleAccepted(fromNum, receiverName) {
        if (pendingOutgoing[fromNum]) {
            clearTimeout(pendingOutgoing[fromNum].timer);
            delete pendingOutgoing[fromNum];
        }
        if (!isELLover(fromNum)) {
            addLover(fromNum, receiverName, STAGE.DATING);
            ELLockAccessOn.add(fromNum);
            updateLastSeen(fromNum);
            chatLocalNotice(t('proposeOK', receiverName));
        }
        // 回應 ACCEPT_ACK
        sendBeep(fromNum, BEEP.ACCEPT_ACK, { AckNumber: Player.MemberNumber });
    }

    // ============================================================
    // ③ 升格流程（交往→訂婚→結婚）
    // ============================================================

    const STAGE_BEEP_PROPOSE = {
        [STAGE.ENGAGED]: BEEP.PROPOSE_ENGAGE,
        [STAGE.MARRIED]: BEEP.PROPOSE_MARRY,
    };
    const STAGE_BEEP_ACCEPT = {
        [STAGE.ENGAGED]: BEEP.ACCEPT_ENGAGE,
        [STAGE.MARRIED]: BEEP.ACCEPT_MARRY,
    };

    function proposeStageUpgrade(C, newStage) {
        const key = `${C.MemberNumber}_${newStage}`;
        const label = stageLabel(newStage);
        if (pendingStageProp[key]) { chatLocalNotice(t('stageSent', C.Name, label)); return; }

        sendBeep(C.MemberNumber, STAGE_BEEP_PROPOSE[newStage], { SenderName: Player.Name });

        pendingStageProp[key] = {
            timer: setTimeout(() => {
                delete pendingStageProp[key];
                // 若對方已接受（stage 已升格），不顯示逾時訊息
                const current = getLoverEntry(C.MemberNumber);
                if (current?.stage !== newStage) chatLocalNotice(t('stageExpired', C.Name, label));
            }, PROPOSE_EXPIRE_MS),
        };
        chatLocalNotice(t('stageSent', C.Name, label));
    }

    function handleIncomingStageProposal(senderNum, senderName, newStage) {
        if (!newStage || !STAGE_LABEL[newStage]) return;

        // 雙向驗證：自己有對方 OR 對方有自己（容許單方面資料丟失）
        const senderChar = ChatRoomCharacter?.find(c => c.MemberNumber === senderNum);
        const senderHasMe = senderChar?.OnlineSharedSettings?.AFC?.lovers
        ?.some(l => Number(l.memberNumber) === Number(Player.MemberNumber)) ?? false;
        if (!isELLover(senderNum) && !senderHasMe) return;

        const key   = `${senderNum}_${newStage}`;
        const uiId  = `el-stage-${senderNum}-${newStage}`;
        const label = stageLabel(newStage);
        if (pendingStageInc[key]) return;

        const el = createProposalUI({
            uiId,
            title:     t('stageTitle', senderName, senderNum, label),
            subText:   t('timerText', 3, '00'),
            onAccept:  () => acceptStageProposal(senderNum, senderName, newStage, key, uiId),
            onDecline: () => cleanupStageUI(key, uiId),
        });
        if (!el) return;

        const iv = startCountdown(uiId, `${uiId}-sub`, () => cleanupStageUI(key, uiId),
                                  t('stageExpired', senderName, label));
        pendingStageInc[key] = { timer: iv, uiId };
    }

    function acceptStageProposal(senderNum, senderName, newStage, key, uiId) {
        cleanupStageUI(key, uiId);
        promoteStage(senderNum, newStage);
        sendBeep(senderNum, STAGE_BEEP_ACCEPT[newStage], { ReceiverName: Player.Name });
        // B（接受方）看到：你接受了 A 的 [訂婚] 申請
        chatLocalNotice(t('stageOKSelf', senderName, stageLabel(newStage)));
        broadcastAction(senderNum, senderName, t('evEngTxt', stageLabel(newStage)));
    }

    function handleAcceptedStage(fromNum, receiverName, newStage) {
        const key = `${fromNum}_${newStage}`;
        if (pendingStageProp[key]) {
            clearTimeout(pendingStageProp[key].timer);
            delete pendingStageProp[key];
        }
        promoteStage(fromNum, newStage);
        // A（發起方）看到：B 接受了你的 [訂婚] 申請
        chatLocalNotice(t('stageOK', receiverName, stageLabel(newStage)));
    }

    function cleanupStageUI(key, uiId) {
        const p = pendingStageInc[key];
        if (p) { clearInterval(p.timer); delete pendingStageInc[key]; }
        document.getElementById(uiId)?.remove();
    }

    // ============================================================
    // ④ BC 原生戀人申請攔截（顯示友善通知）
    //   BC 透過 AccountBeep BeepType:"Lovers" 通知接收方
    //   實際同意仍需至關係管理，此處僅提供美化通知
    // ============================================================

    function handleBCLoverProposal(data) {
        const senderNum  = data.MemberNumber;
        const senderName = data.MemberName ?? `#${senderNum}`;
        const uiId = `el-bc-lover-${senderNum}`;
        if (document.getElementById(uiId)) return;

        const chatLog = document.getElementById("TextAreaChatLog");
        if (!chatLog) return;

        const el = document.createElement("div");
        el.id = uiId;
        el.style.cssText = [
            "background:rgba(80,20,120,0.18)",
            "border:1px solid #9C4AED",
            "border-radius:10px",
            "padding:14px 18px",
            "margin:10px 4px",
            "font-size:15px",
            "line-height:1.75",
            "color:#eee",
        ].join(";");
        el.innerHTML = `
            <div style="font-weight:bold;font-size:16px;margin-bottom:4px;">
                ${t('bcTitle', senderName, senderNum)}
            </div>
            <div style="font-size:13px;opacity:0.7;">
                ${t('bcNote')}
            </div>`;
        chatLog.appendChild(el);
        chatLog.scrollTop = chatLog.scrollHeight;
        // 30 秒後自動移除通知
        setTimeout(() => el?.remove(), 30000);
    }

    // ============================================================
    // Action 廣播 / 解除
    // ============================================================

    function broadcastAction(otherNum, otherName, eventText) {
        const text = `${Player.Name} (#${Player.MemberNumber}) 與 ${otherName} (#${otherNum}) ${eventText}。`;
        ServerSend("ChatRoomChat", {
            Type:    "Action",
            Content: "ELEvent",
            Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": ELEvent', Text: text }],
        });
    }

    function initiateBreakup(num, name) {
        if (!isELLover(num)) return;
        sendBeep(num, BEEP.LOCK_ACCESS_OFF);
        sendBeep(num, BEEP.BREAKUP);
        removeLover(num);
        ELLockAccessOn.delete(num);
        chatLocalNotice(t('breakupSelf', name ?? `#${num}`));
    }

    // ============================================================
    // 房間名稱共享
    // ============================================================

    function sendRoomNameTo(num) {
        if (CurrentScreen !== "ChatRoom" || !ChatRoomData?.Private) return;
        sendBeep(num, BEEP.ROOM_NAME, {}, false);
    }

    function broadcastRoomNameToLovers() {
        for (const num of ELLockAccessOn) sendRoomNameTo(num);
    }

    // ============================================================
    // Beep 解析
    // ============================================================

    function parseBeep(data) {
        if (!data) return;

        // BC 原生戀人申請攔截
        if (data.BeepType === "Lovers") {
            handleBCLoverProposal(data);
            return;
        }

        if (data.BeepType !== EL_BEEP_TYPE) return;

        const from     = data.MemberNumber;
        const fromName = data.MemberName ?? `#${from}`;

        switch (data.Message) {
            case BEEP.PROPOSE:
                handleIncomingProposal(from, data.SenderName ?? fromName); break;
            case BEEP.PROPOSE_ACK:
                chatLocalNotice(t('proposeAck', fromName)); break;
            case BEEP.ACCEPT:
                handleAccepted(from, data.ReceiverName ?? fromName); break;
            case BEEP.ACCEPT_ACK:
                break;
            case BEEP.RESTORE_PROPOSE:
                handleIncomingRestore(from, data.SenderName ?? fromName,
                                      data.Stage, data.StartDate, data.StageDate); break;
            case BEEP.RESTORE_ACCEPT:
                handleRestoreAccepted(from, data.ReceiverName ?? fromName,
                                      data.Stage, data.StartDate, data.StageDate); break;

            case BEEP.PROPOSE_ENGAGE:
                handleIncomingStageProposal(from, data.SenderName ?? fromName, STAGE.ENGAGED); break;
            case BEEP.PROPOSE_MARRY:
                handleIncomingStageProposal(from, data.SenderName ?? fromName, STAGE.MARRIED); break;
            case BEEP.ACCEPT_ENGAGE:
                handleAcceptedStage(from, data.ReceiverName ?? fromName, STAGE.ENGAGED); break;
            case BEEP.ACCEPT_MARRY:
                handleAcceptedStage(from, data.ReceiverName ?? fromName, STAGE.MARRIED); break;

            case BEEP.SYNC_REQUEST:
                if (isELLover(from)) {
                    ELLockAccessOn.add(from);
                    updateLastSeen(from);
                    sendBeep(from, BEEP.SYNC_GRANT, { GranterName: Player.Name });
                    sendRoomNameTo(from);
                }
                break;
            case BEEP.SYNC_GRANT:
                if (isELLover(from)) {
                    ELLockAccessOn.add(from);
                    updateLastSeen(from);
                    sendRoomNameTo(from);
                }
                break;
            case BEEP.LOCK_ACCESS_OFF:
                ELLockAccessOn.delete(from); break;
            case BEEP.BREAKUP:
                if (isELLover(from)) {
                    removeLover(from);
                    chatLocalNotice(t('breakupOther', fromName));
                }
                break;
            case BEEP.ROOM_NAME:
                loversPrivateRoom[from] = {
                    ChatRoomName:  data.ChatRoomName  ?? null,
                    ChatRoomSpace: data.ChatRoomSpace  ?? "X",
                };
                break;
            default:
                console.warn("🐈‍⬛ [AFC] ⚠️ 未知 Beep:", data.Message);
        }
    }

    // ============================================================
    // Profile 頁面
    // ============================================================

    function getCurrentViewingCharacter() {
        try {
            if (typeof InformationSheetCharacter !== 'undefined' && InformationSheetCharacter)
                return InformationSheetCharacter;
            if (typeof InformationSheetSelection !== 'undefined' && InformationSheetSelection) {
                if (typeof InformationSheetSelection === 'number')
                    return ChatRoomCharacter?.find(c => c.MemberNumber === InformationSheetSelection) ?? Player;
                return InformationSheetSelection;
            }
        } catch (e) {}
        return Player;
    }

    function getViewingCharacterELLovers() {
        return getCurrentViewingCharacter()?.OnlineSharedSettings?.AFC?.lovers ?? [];
    }

    function drawProfileButton() {
        if (CurrentScreen !== "InformationSheet") return;
        const lovers = getViewingCharacterELLovers();
        const label  = profilePanelOpen ? t('btnClose') : t('btnOpen', lovers.length);
        DrawButton(PROFILE_BTN_X, PROFILE_BTN_Y, PROFILE_BTN_W, PROFILE_BTN_H,
                   label, "White", "", "Extended Lover List");
    }

    // 畫線上狀態燈號
    function drawOnlineDot(cx, cy, online, priv) {
        if (!priv?.showOnlineStatus) return;
        MainCanvas.save();
        MainCanvas.beginPath();
        MainCanvas.arc(cx, cy, 7, 0, Math.PI * 2);
        MainCanvas.fillStyle = online ? "#4CAF50" : "#555555";
        MainCanvas.fill();
        if (online) {
            // 綠色光暈
            MainCanvas.shadowColor = "#4CAF50";
            MainCanvas.shadowBlur  = 6;
            MainCanvas.fill();
        }
        MainCanvas.restore();
    }

    // 格式化戀人名稱行（無 #、無 stage）
    function formatLoverNameLine(l) {
        return `♥ ${l.name} (${l.memberNumber})`;
    }

    // 格式化時間行（stage 在此顯示，使用本地化標籤）
    // startDate = 整段關係起始（不變）
    // stageDate = 當前階段起始（升格時更新）
    function formatLoverDateLine(l, priv) {
        const tag = `[${stageLabel(l.stage)}]`;
        const stageStart = l.stageDate ?? l.startDate;
        if (priv?.displayMode === "date") {
            // 日期模式：顯示整段關係起始日
            return `${tag} ${formatStartDate(l.startDate)}`;
        }
        // 時長模式：顯示當前階段天數
        return `${tag} ${daysSince(stageStart)}天`;
    }

    function drawProfilePanel() {
        if (!profilePanelOpen || CurrentScreen !== "InformationSheet") return;
        const lovers    = getViewingCharacterELLovers();
        const priv      = getPrivateSettings();
        const isOwnProfile = getCurrentViewingCharacter()?.MemberNumber === Player.MemberNumber;

        // ── 面板座標（依最新 profile.txt）──────────────────────────
        // Box: x=540, y=150, w=1250 → 裁切為 1170 避免 nav 按鈕 (x=1715)
        const PX = 540, PY = 150, PW = 1170, PH = 640;

        // 面板背景（clip 確保不被 BC dots 穿透）
        MainCanvas.save();
        MainCanvas.beginPath();
        if (MainCanvas.roundRect) MainCanvas.roundRect(PX, PY, PW, PH, 10);
        else MainCanvas.rect(PX, PY, PW, PH);
        MainCanvas.clip();
        MainCanvas.fillStyle = "rgba(12,4,28,0.93)";
        MainCanvas.fillRect(PX, PY, PW, PH);
        MainCanvas.restore();

        // 邊框（桃紅色）
        MainCanvas.save();
        MainCanvas.strokeStyle = "#E8618C";
        MainCanvas.lineWidth   = 2;
        MainCanvas.beginPath();
        if (MainCanvas.roundRect) MainCanvas.roundRect(PX, PY, PW, PH, 10);
        else MainCanvas.rect(PX, PY, PW, PH);
        MainCanvas.stroke();
        MainCanvas.restore();

        // 標題
        DrawText(t('panelTitle'), 1160, 180, "White", "");

        if (lovers.length === 0) {
            DrawText(t('panelEmpty'), 1160, 400, "#888", "");
            return;
        }

        // ── 行座標（依最新 profile.txt icons + text boxes）────────
        // 每個 entry: name line, dot, date line
        const NAME_Y = [235, 350, 465, 580, 695];   // centerY of name text
        const DATE_Y = [285, 400, 515, 630, 745];   // centerY of date text
        const DOT_Y  = [260, 375, 490, 605, 720];   // centerY of dot icon
        const DOT_R  = 6;
        const showDot = isOwnProfile && (priv?.showOnlineStatus !== false);

        function drawEntry(l, col, row) {
            const textX = col === 0 ? 590 : 1210;
            const maxW  = col === 0 ? 540 : 490;   // 右欄限制到 1700
            const dotX  = col === 0 ? 565 : 1185;
            const nY    = NAME_Y[row];
            const dY    = DATE_Y[row];
            const oY    = DOT_Y[row];
            const color = STAGE_COLOR[l.stage] ?? "#FFB6C1";

            // 燈號
            if (showDot) {
                const online = isOnline(l.memberNumber);
                MainCanvas.save();
                MainCanvas.beginPath();
                MainCanvas.arc(dotX, oY, DOT_R, 0, Math.PI * 2);
                MainCanvas.fillStyle = online ? "#4CAF50" : "#444";
                if (online) { MainCanvas.shadowColor = "#4CAF50"; MainCanvas.shadowBlur = 8; }
                MainCanvas.fill();
                MainCanvas.restore();
            }

            const prevAlign = MainCanvas.textAlign;
            MainCanvas.textAlign = "left";
            DrawTextFit(formatLoverNameLine(l), textX, nY, maxW, color);
            DrawTextFit(formatLoverDateLine(l, priv), textX, dY, maxW, "rgba(190,190,190,0.75)");
            MainCanvas.textAlign = prevAlign;
        }

        lovers.forEach((l, i) => {
            const col = i < 5 ? 0 : 1;
            const row = i % 5;
            if (row < NAME_Y.length) drawEntry(l, col, row);
        });
    }

    function handleProfileClick() {
        if (CurrentScreen !== "InformationSheet") return;
        if (MouseIn(PROFILE_BTN_X, PROFILE_BTN_Y, PROFILE_BTN_W, PROFILE_BTN_H))
            profilePanelOpen = !profilePanelOpen;
    }

    // ============================================================
    // EL 擴展設定頁面（仿 EchoCache 風格）
    // ============================================================

    const ELSettingsUI = (() => {
        // ── 座標（依 setting.txt 設計稿）──────────────────────────
        // BC canvas: 2000 × 1000

        // 右欄戀人列表
        const R_ROW_X   = 1000;   // 文字起始 X
        const R_ROW_W   = 750;    // 文字寬度
        const R_START_Y = 240;    // 第一行 Y
        const R_ROW_H   = 70;     // 行高（310-240=70）
        const R_MAX     = 7;      // 最多顯示行數（超過需卷軸）
        const R_BTN_X   = 1780;   // 解除按鈕 X
        const R_BTN_W   = 110;    // 解除按鈕寬
        const R_BTN_H   = 40;     // 解除按鈕高
        const SCROLL_W  = 40;     // 卷軸按鈕寬
        const SCROLL_H  = 35;     // 卷軸按鈕高

        // 左欄
        const CB_X = 270, CB_SZ = 60;
        const LBL_X = 350;

        let _breakupModal  = null;
        let _scrollOffset  = 0;
        let _showRestoreUI = false;

        function load() { _breakupModal = null; _scrollOffset = 0; _showRestoreUI = false; }

        // ── run()：每幀繪製 ────────────────────────────────────────
        function run() {
            const priv   = getPrivateSettings();
            const lovers = getSharedSettings()?.lovers ?? [];
            if (!priv) return;

            // 返回按鈕（setting.txt: x=1815 y=75 w=90 h=90）
            DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", "返回");
            // 復原按鈕（與 Exit 按鈕相同樣式，無底色）
            DrawButton(1710, 75, 90, 90, "", "", "https://www.bondageprojects.elementfx.com/R128/BondageClub/Icons/Reset.png", t('restoreTitle'));

            // 標題（centerX=1000, y=90-150）
            DrawText("Abundantia Florum ─Chromatica─", 1000, 120, "Black", "Gray");
            DrawText(`v${MOD_VERSION}`, 1338, 137, "Gray", "");

            // ── 左欄 ──────────────────────────────────────────────

            DrawText(t('sysTitle'), 560, 200, "Black", "Gray");

            // enableEL（y=240）
            DrawCheckbox(CB_X, 240, CB_SZ, CB_SZ, "", priv.enableEL ?? true);
            _lbl(t('enableEL'), LBL_X, 270, 400, "Black", 30);

            // enableELLock（y=315）
            const elLockOn = priv.enableELLock ?? false;
            DrawCheckbox(CB_X, 315, CB_SZ, CB_SZ, "", elLockOn);
            _lbl(t('elLock'), LBL_X, 345, 400, "Black", 30);

            // enableOwnerLock（y=390）— 只有 enableELLock 開啟時才能操作
            const ownerLockEnabled = elLockOn;
            DrawCheckbox(CB_X, 390, CB_SZ, CB_SZ, "", priv.enableOwnerLock ?? false);
            _lbl(t('ownerLock'), LBL_X, 420, 400, ownerLockEnabled ? "Black" : "#999", 30);
            if (!ownerLockEnabled) {
                // 灰色遮罩：只蓋 checkbox，文字保持可見但顏色已灰化
                MainCanvas.save();
                MainCanvas.fillStyle = "rgba(0,0,0,0.45)";
                MainCanvas.fillRect(CB_X, 390, CB_SZ, CB_SZ);
                MainCanvas.restore();
            }

            DrawText(t('dispTitle'), 560, 495, "Black", "Gray");

            // showOnlineStatus（y=535）
            DrawCheckbox(CB_X, 535, CB_SZ, CB_SZ, "", priv.showOnlineStatus ?? true);
            _lbl(priv.showOnlineStatus ? t('onlineOn') : t('onlineOff'), LBL_X, 565, 400, "Black", 16);
            _lbl(t('onlineSub'), LBL_X, 615, 600, "#666", 20);

            // displayMode（y=650）
            const isDate = priv.displayMode === "date";
            DrawCheckbox(CB_X, 650, CB_SZ, CB_SZ, "", isDate);
            _lbl(isDate ? t('dateMode') : t('durMode'), LBL_X, 680, 400, "Black", 30);
            _lbl(isDate ? t('dateSub') : t('durSub'), LBL_X, 730, 600, "#666", 20);

            // vibeMsgMode — 兩個 checkbox：震動信息 + 廣播
            // vibeMsgMode: 'off'=兩個都關, 'broadcast'=兩個都開, 'local'=震動開廣播關
            const vibeMsgMode  = Player.OnlineSharedSettings?.AFC?.vibeMsgMode ?? 'broadcast';
            const vibeOn       = vibeMsgMode !== 'off';
            const broadcastOn  = vibeMsgMode === 'broadcast';

            // 震動信息 checkbox（y=765）
            DrawCheckbox(CB_X, 765, CB_SZ, CB_SZ, "", vibeOn);
            _lbl(t('vibeMsgLabel'), LBL_X, 795, 250, "Black", 28);

            // 廣播 checkbox（inline，x=580）— 只有震動信息開啟時才可點
            const BCAST_CB_X = 570;
            DrawCheckbox(BCAST_CB_X, 765, CB_SZ, CB_SZ, "", broadcastOn);
            _lbl(t('vibeMsgBcast'), BCAST_CB_X + CB_SZ + 10, 795, 150, vibeOn ? "Black" : "#999", 28);
            if (!vibeOn) {
                MainCanvas.save();
                MainCanvas.fillStyle = "rgba(0,0,0,0.45)";
                MainCanvas.fillRect(BCAST_CB_X, 765, CB_SZ, CB_SZ);
                MainCanvas.restore();
            }

            // 震動音效 checkbox（inline，x=800）— 獨立開關，僅本人聽到
            const SOUND_CB_X = 800;
            const soundOn = Player.OnlineSharedSettings?.AFC?.enableVibeSound ?? true;
            DrawCheckbox(SOUND_CB_X, 765, CB_SZ, CB_SZ, "", soundOn);
            _lbl(t('vibeSoundLabel'), SOUND_CB_X + CB_SZ + 10, 795, 180, "Black", 28);

            // 說明文字
            const vibeSub = vibeOn ? (broadcastOn ? t('vibeMsgSubOn') : t('vibeMsgSubOff')) : t('vibeMsgSubOff');
            _lbl(vibeSub, LBL_X, 848, 700, "#666", 18);

            // ── 右欄 ──────────────────────────────────────────────

            DrawText(t('mgmtTitle'), 1450, 200, "Black", "Gray");

            const total      = lovers.length;
            const needScroll = total > R_MAX;
            // 有卷軸時整體下移10px留邊框
            const shiftY     = needScroll ? 10 : 0;
            // lastSeen now in lover.lastSeen

            if (total === 0) {
                const p = MainCanvas.textAlign; MainCanvas.textAlign = "center";
                DrawText(t('noLovers'), 1450, R_START_Y + shiftY + 40, "#888", "Black");
                MainCanvas.textAlign = p;
            } else {
                if (needScroll) {
                    // 上卷按鈕（緊貼第一行上方）
                    const upY = R_START_Y + shiftY - SCROLL_H - 2;
                    DrawButton(R_BTN_X, upY, SCROLL_W, SCROLL_H,
                               "▲", _scrollOffset > 0 ? "White" : "#333", "");
                    // 下卷按鈕（緊貼最後行下方）
                    const downY = R_START_Y + shiftY + R_MAX * R_ROW_H + 2;
                    DrawButton(R_BTN_X, downY, SCROLL_W, SCROLL_H,
                               "▼", _scrollOffset + R_MAX < total ? "White" : "#333", "");
                }

                const visEnd = Math.min(total, _scrollOffset + R_MAX);
                for (let i = _scrollOffset; i < visEnd; i++) {
                    const l    = lovers[i];
                    const rowY = R_START_Y + shiftY + (i - _scrollOffset) * R_ROW_H;
                    const ts   = l.lastSeen;
                    const days = ts ? daysSince(ts) : 0;
                    const warn = ts && days >= 7;
                    const dayStr = ts ? `${days} days` : "never";

                    _lbl(
                        `${stageLabel(l.stage)}  ${l.name} (${l.memberNumber})  ${ts ? t('lastSeen', days) : t('lastNever')}`,
                        R_ROW_X, rowY + R_BTN_H / 2,
                        R_ROW_W, warn ? "#CC0000" : "Black", 24
                    );

                    const canBreakup = warn;
                    const btnColor   = canBreakup ? "#8B1A2E" : "#444444";
                    DrawButton(R_BTN_X, rowY,
                               R_BTN_W, R_BTN_H, t('breakupBtn'), btnColor, "",
                               canBreakup ? t('breakupBtn') : t('sevenDay'));
                }
            }

            // 底部說明（中文一行）
            const noteY = R_START_Y + shiftY + R_MAX * R_ROW_H + (needScroll ? SCROLL_H + 10 : 0) + 30;
            if (noteY < 960) {
                const p = MainCanvas.textAlign; MainCanvas.textAlign = "center";
                DrawTextFit(t('sevenDay'), 1450, noteY, 700, "#555");
                MainCanvas.textAlign = p;
            }

            // ── 解除確認彈窗 ──────────────────────────────────────
            if (_breakupModal) _drawBreakupModal(_breakupModal);
            if (_showRestoreUI) _drawRestoreUI();
        }

        // ── 解除確認彈窗（畫布 Modal）────────────────────────────
        function _drawBreakupModal({ name }) {
            // 半透明遮罩
            MainCanvas.save();
            MainCanvas.fillStyle = "rgba(0,0,0,0.72)";
            MainCanvas.fillRect(0, 0, 2000, 1000);

            // 對話框本體（置中）
            const bw = 860, bh = 300;
            const bx = (2000 - bw) / 2, by = (1000 - bh) / 2;
            MainCanvas.fillStyle   = "rgba(30,8,20,0.98)";
            MainCanvas.strokeStyle = "#E8618C";
            MainCanvas.lineWidth   = 3;
            MainCanvas.beginPath();
            if (MainCanvas.roundRect) MainCanvas.roundRect(bx, by, bw, bh, 14);
            else MainCanvas.rect(bx, by, bw, bh);
            MainCanvas.fill();
            MainCanvas.stroke();
            MainCanvas.restore();

            // 文字
            DrawText(t('modalTitle', name), 1000, by + 80, "White", "Black");
            DrawText(t('modalSub1'), 1000, by + 140, "#ddd", "Black");
            DrawText(t('modalSub2'), 1000, by + 190, "#FF9999", "Black");

            DrawButton(bx + 120, by + bh - 80, 260, 55, t('confirmBtn'), "#9a1a1a", "");
            DrawButton(bx + bw - 380, by + bh - 80, 260, 55, t('cancelBtn'), "White", "");
        }

        let _restoreScrollL = 0;
        let _restoreScrollR = 0;
        let _restoreConfirm = null;

        const RUI = {
            bx: 150, by: 70, bw: 1700, bh: 900,
            rowH: 66, visRows: 8,
            colLX: 170, colRX: 1050, colW: 780,
            hdrY: 145, listY: 185,
            allBtnY: 70 + 900 - 75,
            allBtnW: 400, allBtnH: 52,
            sbW: 48, sbH: 38,
            rBtnW: 130, rBtnH: 42,
            // ✕ 在框框內右上角
            closeX: 150 + 1700 - 70, closeY: 70 + 10, closeS: 58,
        };

        function _drawRestoreUI() {
            const onL = getSharedSettings()?.lovers ?? [];
            const onR = _readBackupLovers();

            MainCanvas.save();
            MainCanvas.fillStyle = "rgba(0,0,0,0.82)";
            MainCanvas.fillRect(0, 0, 2000, 1000);
            MainCanvas.fillStyle = "rgba(16,4,28,0.98)";
            MainCanvas.strokeStyle = "#E8618C";
            MainCanvas.lineWidth = 3;
            MainCanvas.beginPath();
            if (MainCanvas.roundRect) MainCanvas.roundRect(RUI.bx, RUI.by, RUI.bw, RUI.bh, 14);
            else MainCanvas.rect(RUI.bx, RUI.by, RUI.bw, RUI.bh);
            MainCanvas.fill(); MainCanvas.stroke();
            MainCanvas.restore();

            DrawText(t('restoreTitle'), RUI.bx + RUI.bw/2, RUI.by + 48, "White", "transparent");
            DrawButton(RUI.closeX, RUI.closeY, RUI.closeS, RUI.closeS, "✕", "White", "");

            // 分隔線
            MainCanvas.save();
            MainCanvas.strokeStyle = "#333";
            MainCanvas.lineWidth = 1;
            MainCanvas.beginPath();
            MainCanvas.moveTo(RUI.bx + RUI.bw/2, RUI.by + 90);
            MainCanvas.lineTo(RUI.bx + RUI.bw/2, RUI.by + RUI.bh - 95);
            MainCanvas.stroke();
            MainCanvas.restore();

            // 欄標題置中
            DrawText(t('restoreOnline'), RUI.colLX + RUI.colW/2, RUI.hdrY, "#E8618C", "transparent");
            DrawText(t('restoreBackup'), RUI.colRX + RUI.colW/2, RUI.hdrY, "#7CB9E8", "transparent");

            _drawRestoreColumn(onL, RUI.colLX, _restoreScrollL, "#FFAAC0");
            _drawRestoreColumn(onR, RUI.colRX, _restoreScrollR, "#90CAF9");

            // 全部使用此資料按鈕（在框內底部）
            const allLX = RUI.colLX + RUI.colW/2 - RUI.allBtnW/2;
            const allRX = RUI.colRX + RUI.colW/2 - RUI.allBtnW/2;
            DrawButton(allLX, RUI.allBtnY, RUI.allBtnW, RUI.allBtnH, t('restoreAllBtn'), "#1A3A6A", "");
            DrawButton(allRX, RUI.allBtnY, RUI.allBtnW, RUI.allBtnH, t('restoreAllBtn'), "#1A3A6A", "");

            if (_restoreConfirm) _drawRestoreConfirm();
        }

        function _drawRestoreColumn(lovers, colX, scroll, nameColor) {
            if (!lovers.length) {
                _lbl(t('restoreEmpty'), colX, RUI.listY + 28, RUI.colW, "#666");
                return;
            }
            const total = lovers.length;
            const needScroll = total > RUI.visRows;
            if (needScroll) {
                DrawButton(colX + RUI.colW - RUI.sbW - 2, RUI.listY - RUI.sbH - 2, RUI.sbW, RUI.sbH, "▲", scroll > 0 ? "White" : "#333", "");
                DrawButton(colX + RUI.colW - RUI.sbW - 2, RUI.listY + RUI.visRows * RUI.rowH + 2, RUI.sbW, RUI.sbH, "▼", scroll + RUI.visRows < total ? "White" : "#333", "");
            }
            const end = Math.min(total, scroll + RUI.visRows);
            for (let i = scroll; i < end; i++) {
                const l = lovers[i];
                const ry = RUI.listY + (i - scroll) * RUI.rowH;
                const sLabel = stageLabel(l.stage);
                const days = daysSince(l.stageDate ?? l.startDate);
                // 名字 + 階段 + 天數 全在同一行，靠左
                const rowText = `♥ ${l.name}  (#${l.memberNumber})  [${sLabel}]  ${days}${detectLang()==='EN'?'d':'天'}`;
                _lbl(rowText, colX, ry + RUI.rowH/2, RUI.colW - RUI.rBtnW - 14, nameColor, 22);
                DrawButton(colX + RUI.colW - RUI.rBtnW - 6, ry + (RUI.rowH - RUI.rBtnH)/2, RUI.rBtnW, RUI.rBtnH, t('restoreBtn'), "#8B1A2E", "");
            }
        }

        function _drawRestoreConfirm() {
            const cw = 700, ch = 200, cx = (2000-cw)/2, cy = (1000-ch)/2;
            MainCanvas.save();
            MainCanvas.fillStyle = "rgba(0,0,0,0.6)";
            MainCanvas.fillRect(0, 0, 2000, 1000);
            MainCanvas.fillStyle = "rgba(20,6,35,0.99)";
            MainCanvas.strokeStyle = "#E8618C";
            MainCanvas.lineWidth = 3;
            MainCanvas.beginPath();
            if (MainCanvas.roundRect) MainCanvas.roundRect(cx, cy, cw, ch, 12);
            else MainCanvas.rect(cx, cy, cw, ch);
            MainCanvas.fill(); MainCanvas.stroke();
            MainCanvas.restore();
            const msg = _restoreConfirm.idx === -1
            ? t('restoreConfirmAll', t(_restoreConfirm.source==='online'?'restoreOnline':'restoreBackup'))
            : t('restoreConfirm1', _restoreConfirm.name);
            DrawTextFit(msg, 1000, cy + 74, cw - 40, "White", "transparent");
            // 使用正確的 i18n key（確認復原，非確認解除）
            DrawButton(cx + 50,      cy + ch - 64, 240, 50, t('restoreConfirmBtn'), "#9a1a1a", "");
            DrawButton(cx + cw - 290, cy + ch - 64, 240, 50, t('cancelBtn'),        "White",   "");
        }

        function _clickRestoreUI() {
            if (_restoreConfirm) {
                const cw = 700, ch = 200, cx = (2000-cw)/2, cy = (1000-ch)/2;
                if (MouseIn(cx + 50, cy + ch - 64, 240, 50)) { _doRestore(_restoreConfirm); _restoreConfirm = null; }
                else if (MouseIn(cx + cw - 290, cy + ch - 64, 240, 50)) { _restoreConfirm = null; }
                return;
            }
            if (MouseIn(RUI.closeX, RUI.closeY, RUI.closeS, RUI.closeS)) {
                _showRestoreUI = false; _restoreScrollL = 0; _restoreScrollR = 0; return;
            }
            const onL = getSharedSettings()?.lovers ?? [];
            const onR = _readBackupLovers();
            const allLX = RUI.colLX + RUI.colW/2 - RUI.allBtnW/2;
            const allRX = RUI.colRX + RUI.colW/2 - RUI.allBtnW/2;
            if (MouseIn(allLX, RUI.allBtnY, RUI.allBtnW, RUI.allBtnH)) { _restoreConfirm = { source:'online', idx:-1, name:'' }; return; }
            if (MouseIn(allRX, RUI.allBtnY, RUI.allBtnW, RUI.allBtnH)) { _restoreConfirm = { source:'backup', idx:-1, name:'' }; return; }
            _clickRestoreColumn(onL, RUI.colLX, 'online', _restoreScrollL,
                                ()=>{ _restoreScrollL=Math.max(0,_restoreScrollL-1); },
                                ()=>{ if(_restoreScrollL+RUI.visRows<onL.length)_restoreScrollL++; });
            _clickRestoreColumn(onR, RUI.colRX, 'backup', _restoreScrollR,
                                ()=>{ _restoreScrollR=Math.max(0,_restoreScrollR-1); },
                                ()=>{ if(_restoreScrollR+RUI.visRows<onR.length)_restoreScrollR++; });
        }

        function _clickRestoreColumn(lovers, colX, source, scroll, onUp, onDown) {
            const total = lovers.length;
            if (total > RUI.visRows) {
                if (MouseIn(colX+RUI.colW-RUI.sbW-2, RUI.listY-RUI.sbH-2, RUI.sbW, RUI.sbH)) { onUp(); return; }
                if (MouseIn(colX+RUI.colW-RUI.sbW-2, RUI.listY+RUI.visRows*RUI.rowH+2, RUI.sbW, RUI.sbH)) { onDown(); return; }
            }
            const end = Math.min(total, scroll + RUI.visRows);
            for (let i = scroll; i < end; i++) {
                const l = lovers[i];
                const ry = RUI.listY + (i - scroll) * RUI.rowH;
                if (MouseIn(colX+RUI.colW-RUI.rBtnW-6, ry+(RUI.rowH-RUI.rBtnH)/2, RUI.rBtnW, RUI.rBtnH)) {
                    _restoreConfirm = { source, idx: i, name: l.name }; return;
                }
            }
        }

        function _doRestore({ source, idx }) {
            const onL = getSharedSettings()?.lovers ?? [];
            const onR = _readBackupLovers();
            const srcLovers = source === 'online' ? onL : onR;
            const s = getSharedSettings();
            if (!s) return;

            if (idx === -1) {
                // 全部使用
                s.lovers = [...srcLovers];
                saveSharedSettings();
                _syncLoversBackup();
                chatLocalNotice(t('restoreOKMsg', srcLovers.length));
            } else {
                // 單筆復原
                const entry = srcLovers[idx];
                if (!entry) return;
                const existing = s.lovers.findIndex(l => l.memberNumber === entry.memberNumber);
                if (existing >= 0) s.lovers[existing] = { ...entry };
                else s.lovers.push({ ...entry });
                saveSharedSettings();
                _syncLoversBackup();
                chatLocalNotice(t('restoreOKMsg', 1));
            }
        }

        // ── click()：滑鼠點擊 ─────────────────────────────────────
        function click() {
            // 復原 UI 優先處理
            if (_showRestoreUI) { _clickRestoreUI(); return; }

            // 彈窗優先處理
            if (_breakupModal) {
                const bw = 860, bh = 300;
                const bx = (2000 - bw) / 2, by = (1000 - bh) / 2;
                if (MouseIn(bx + 120, by + bh - 80, 260, 55)) {
                    const { memberNumber, name } = _breakupModal;
                    _breakupModal = null;
                    initiateBreakup(memberNumber, name);
                    return;
                }
                if (MouseIn(bx + bw - 380, by + bh - 80, 260, 55)) {
                    _breakupModal = null;
                    return;
                }
                return;  // 彈窗開著時攔截所有其他點擊
            }

            if (MouseIn(1815, 75, 90, 90)) {
                if (typeof PreferenceExit === "function") PreferenceExit();
                return;
            }
            if (MouseIn(1710, 75, 90, 90)) { _showRestoreUI = true; return; }

            const priv   = getPrivateSettings();
            const lovers = getSharedSettings()?.lovers ?? [];
            if (!priv) return;

            // 左欄 checkbox
            if (MouseIn(CB_X, 240, CB_SZ, CB_SZ)) {
                priv.enableEL = !(priv.enableEL ?? true);
                savePrivateSettings(priv);
                syncLockPermsToShared(priv);
                return;
            }
            // enableELLock — 現在可以勾選
            if (MouseIn(CB_X, 315, CB_SZ, CB_SZ)) {
                priv.enableELLock = !(priv.enableELLock ?? false);
                // 關閉 ELLock 時一併關閉 ownerLock
                if (!priv.enableELLock) priv.enableOwnerLock = false;
                savePrivateSettings(priv);
                syncLockPermsToShared(priv);
                return;
            }
            // enableOwnerLock — 只有 enableELLock 開啟時才響應
            if (MouseIn(CB_X, 390, CB_SZ, CB_SZ) && (priv.enableELLock ?? false)) {
                priv.enableOwnerLock = !(priv.enableOwnerLock ?? false);
                savePrivateSettings(priv);
                syncLockPermsToShared(priv);
                return;
            }
            if (MouseIn(CB_X, 535, CB_SZ, CB_SZ)) {
                priv.showOnlineStatus = !(priv.showOnlineStatus ?? true);
                savePrivateSettings(priv); return;
            }
            if (MouseIn(CB_X, 650, CB_SZ, CB_SZ)) {
                priv.displayMode = priv.displayMode === "date" ? "duration" : "date";
                savePrivateSettings(priv); return;
            }
            // 震動信息 checkbox（y=765）
            if (MouseIn(CB_X, 765, CB_SZ, CB_SZ)) {
                const s = getSharedSettings();
                if (s) {
                    const vibeOn = s.vibeMsgMode !== 'off';
                    // 關→開（預設廣播），開→關
                    s.vibeMsgMode = vibeOn ? 'off' : 'broadcast';
                    saveSharedSettings();
                }
                return;
            }
            // 廣播 checkbox（x=570, y=765）— 只有 vibeOn 才響應
            if (MouseIn(570, 765, CB_SZ, CB_SZ)) {
                const s = getSharedSettings();
                if (s && s.vibeMsgMode !== 'off') {
                    s.vibeMsgMode = s.vibeMsgMode === 'broadcast' ? 'local' : 'broadcast';
                    saveSharedSettings();
                }
                return;
            }
            // 震動音效 checkbox（x=800, y=765）
            if (MouseIn(800, 765, CB_SZ, CB_SZ)) {
                const s = getSharedSettings();
                if (s) { s.enableVibeSound = !(s.enableVibeSound ?? true); saveSharedSettings(); }
                return;
            }

            // 右欄卷軸
            const total      = lovers.length;
            const needScroll = total > R_MAX;
            const shiftY     = needScroll ? 10 : 0;

            if (needScroll) {
                const upY   = R_START_Y + shiftY - SCROLL_H - 2;
                const downY = R_START_Y + shiftY + R_MAX * R_ROW_H + 2;
                if (MouseIn(R_BTN_X, upY, SCROLL_W, SCROLL_H) && _scrollOffset > 0) {
                    _scrollOffset--; return;
                }
                if (MouseIn(R_BTN_X, downY, SCROLL_W, SCROLL_H) && _scrollOffset + R_MAX < total) {
                    _scrollOffset++; return;
                }
            }

            // 解除按鈕 → 開啟彈窗（只有超過7天才響應）
            const visEnd = Math.min(total, _scrollOffset + R_MAX);
            // lastSeen now in lover.lastSeen
            for (let i = _scrollOffset; i < visEnd; i++) {
                const l    = lovers[i];
                const rowY = R_START_Y + shiftY + (i - _scrollOffset) * R_ROW_H;
                if (MouseIn(R_BTN_X, rowY, R_BTN_W, R_BTN_H)) {
                    const ts  = l.lastSeen;          // ← 改這裡
                    const ok  = ts && daysSince(ts) >= 7;
                    if (ok) _breakupModal = { memberNumber: l.memberNumber, name: l.name };
                    return;
                }
            }
        }

        // 繪製輔助：左對齊文字
        function _lbl(text, x, y, maxW, color, size) {
            const p = MainCanvas.textAlign;
            MainCanvas.textAlign = "left";
            if (size) {
                const prevFont = MainCanvas.font;
                MainCanvas.font = MainCanvas.font.replace(/\d+px/, `${Math.round(size * 1.2)}px`);
                DrawTextFit(text, x, y, maxW, color);
                MainCanvas.font = prevFont;
            } else {
                DrawTextFit(text, x, y, maxW, color);
            }
            MainCanvas.textAlign = p;
        }

        function unload() { _breakupModal = null; }

        return { load, run, click, unload, exit: () => { _breakupModal = null; _scrollOffset = 0; } };
    })();

    function registerSettingsUI() {
        if (typeof PreferenceRegisterExtensionSetting !== "function") return;
        // ButtonText 在登入後呼叫，此時 TranslationLanguage 已設定，t() 能正確翻譯
        const btnText = detectLang() === 'EN' ? "EL Settings" : "拓展戀人設定";
        PreferenceRegisterExtensionSetting({
            Identifier: "AFC",
            ButtonText:  btnText,
            Image:       "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/Abundantia_Florum_Chromatica.png",
            load:   () => ELSettingsUI.load(),
            run:    () => ELSettingsUI.run(),
            click:  () => ELSettingsUI.click(),
            unload: () => ELSettingsUI.unload(),
            exit:   () => ELSettingsUI.exit(),
        });
        console.log(`🐈‍⬛ [AFC] ✅ 擴展設定頁面已注冊 (${btnText})`);
    }

    // ============================================================
    // 上線同步
    // ============================================================

    async function syncWithOnlineLovers() {
        const shared = getSharedSettings();
        if (!shared?.lovers.length) return;

        let onlineFriends = null;
        const handler = (data) => {
            if (data?.Query === "OnlineFriends")
                onlineFriends = new Set(data.Result?.map(f => f.MemberNumber) ?? []);
        };
        ServerSocket.on("AccountQueryResult", handler);
        ServerSend("AccountQuery", { Query: "OnlineFriends" });
        await waitFor(() => onlineFriends !== null, 5000);
        ServerSocket.off("AccountQueryResult", handler);
        if (!onlineFriends) return;

        onlineFriendsCache = onlineFriends;
        lastOnlineFetch    = Date.now();

        let i = 1;
        for (const lover of shared.lovers) {
            if (onlineFriends.has(lover.memberNumber)) {
                await sleep(200 * i++);
                sendBeep(lover.memberNumber, BEEP.SYNC_REQUEST, { SenderName: Player.Name });
            }
        }
    }

    // ============================================================
    // Command 系統
    // ============================================================

    async function setupCommands() {
        await waitFor(() => !!window.Commands);
        CommandCombine([
            {
                Tag: "afc-debug-hidden",
                Description: "診斷：下一條 Hidden 訊息的欄位結構",
                Action: () => {
                    const handler = (data) => {
                        if (data?.Type !== 'Hidden') return;
                        chatLocalNotice(`Hidden 欄位: ${Object.keys(data).join(', ')}`);
                        chatLocalNotice(`Sender=${data.Sender}, SenderMemberNumber=${data.SenderMemberNumber}, Content=${data.Content}`);
                        ServerSocket.off('ChatRoomMessage', handler);
                    };
                    ServerSocket.on('ChatRoomMessage', handler);
                    chatLocalNotice('等待下一條 Hidden 訊息...');
                }
            },
            {
                Tag: "afc-propose",
                Description: "[MemberNumber] 向指定玩家提出拓展戀人申請",
                Action: (text) => {
                    const num = parseInt(text.trim().split(/\s+/)[0]);
                    if (isNaN(num)) { chatLocalNotice("用法：/afc-propose [MemberNumber]"); return; }
                    const C = ChatRoomCharacter?.find(c => c.MemberNumber === num);
                    if (!C) { chatLocalNotice("找不到該玩家，確認對方在同一房間"); return; }
                    proposeToCharacter(C);
                }
            },
            {
                Tag: "afc-status",
                Description: "顯示目前 AFC 插件狀態與戀人列表",
                Action: () => {
                    const lovers = getSharedSettings()?.lovers ?? [];
                    chatLocalNotice(`已初始化=${isInitialized} | 戀人=${lovers.length} | 線上=${ELLockAccessOn.size}`);
                    for (const l of lovers)
                        chatLocalNotice(`  ♥ ${l.name} (#${l.memberNumber}) | ${l.stage} | ${formatDuration(Date.now() - l.startDate)}`);
                }
            },
            {
                Tag: "afc-breakup",
                Description: "[MemberNumber] 解除指定拓展戀人關係",
                Action: (text) => {
                    const num = parseInt(text.trim().split(/\s+/)[0]);
                    if (isNaN(num) || !isELLover(num)) { chatLocalNotice("對方不是你的拓展戀人"); return; }
                    const entry = getSharedSettings()?.lovers.find(l => l.memberNumber === num);
                    initiateBreakup(num, entry?.name);
                }
            },
            {
                Tag: "afc-lastseen",
                Description: "顯示所有戀人的最後見面時間",
                Action: () => {
                    const priv   = getPrivateSettings();
                    const lovers = getSharedSettings()?.lovers ?? [];
                    if (lovers.length === 0) { chatLocalNotice("暫無戀人資料"); return; }
                    for (const l of lovers) {
                        const ts  = priv?.lastSeen?.[l.memberNumber];
                        const str = ts ? `${daysSince(ts)} 天前` : "從未記錄";
                        chatLocalNotice(`${l.name}: 最後見面 ${str}`);
                    }
                }
            },
        ]);
    }

    // ============================================================
    // BC 原生關係燈號
    // 位置依 bc.txt 設計稿（有昵稱+稱號時）：
    //   主人 dot: (515, 685)
    //   原生戀人 dots: (1165, 230/380/530/680/830) 對應 Lovership[0..4]
    //
    // 主人 dot 的 Y 根據 InformationSheet.js 原始碼精確計算：
    //   spacing = 55（BC 的 const spacing = 55）
    //   nickname 判斷：C.Name !== CharacterNickname(C)
    //   title 判斷：TitleGet(C) !== "None"
    // ============================================================

    /**
     * 根據 BC InformationSheet.js 原始碼計算主人燈號的正確 Y 座標
     * BASE_Y = 685（bc.txt，有昵稱+稱號時）
     * 每缺一項向上移 55px（InformationSheet.js spacing = 55）
     */
    function calcOwnerDotY(C) {
        // BASE_Y = 685（bc.txt）+ 25 = 710
        const BASE_Y  = 710;
        const SPACING = 55;
        try {
            // 與 BC 原始碼相同的判斷方式
            const hasNick  = typeof CharacterNickname === 'function'
            ? C.Name !== CharacterNickname(C)
            : !!(C.Nickname && C.Nickname !== C.Name);
            const hasTitle = typeof TitleGet === 'function'
            ? TitleGet(C) !== "None"
            : !!(C.Title);
            let y = BASE_Y;
            if (!hasNick)  y -= SPACING;
            if (!hasTitle) y -= SPACING;
            return y;
        } catch {
            return BASE_Y;
        }
    }

    // 備用：DrawTextFit hook 攔截到主人文字時更新 Y（用於驗證/未來維護）
    let _ownerTextY   = null;
    let _inInfoSheet  = false;

    function drawBCRelationDots(C) {
        const priv = getPrivateSettings();
        if (!priv?.showOnlineStatus) return;

        function dot(cx, cy, memberNumber) {
            if (!memberNumber) return;
            const online = isOnline(memberNumber);
            MainCanvas.save();
            MainCanvas.beginPath();
            MainCanvas.arc(cx, cy, 6, 0, Math.PI * 2);
            MainCanvas.fillStyle = online ? "#4CAF50" : "#444";
            if (online) { MainCanvas.shadowColor = "#4CAF50"; MainCanvas.shadowBlur = 8; }
            MainCanvas.fill();
            MainCanvas.restore();
        }

        if (C.Ownership?.MemberNumber) {
            const ownerY = (_ownerTextY != null ? _ownerTextY : calcOwnerDotY(C)) + 25;
            dot(515, ownerY, C.Ownership.MemberNumber);
        }

        // BC 原生戀人（最多5個）
        const loverY = [230, 380, 530, 680, 830];
        (C.Lovership ?? []).forEach((l, i) => {
            if (i < loverY.length) dot(1165, loverY[i], l.MemberNumber);
        });
    }

    // ============================================================
    // Hooks 設定
    // ============================================================

    function setupHooks() {
        // ── Beep 接收（ChatRoom Hidden，所有操作都在同房間進行）───────

        // ── 好友清單：AFC 戀人顯示為戀人關係（優先 BCT Best Friend）──────
        modApi.hookFunction('FriendListLoadFriendList', 3, async (args, next) => {
            await next(args);   // 等 BC + BCT（priority 2）都執行完

            const lovers = getSharedSettings()?.lovers ?? [];
            if (!lovers.length) return;

            // 取得好友列表容器（相容 R128）
            const containerId = (typeof FriendListIDs !== 'undefined' && FriendListIDs.friendList)
            ?? 'FriendListContent';
            const container = document.getElementById(containerId);
            if (!container) return;

            const rows = container.getElementsByClassName('friend-list-row');
            for (let i = 0; i < rows.length; i++) {
                const memberEl = rows[i].querySelector('.MemberNumber');
                const relEl    = rows[i].querySelector('.RelationType');
                if (!memberEl || !relEl) continue;

                const num   = parseInt(memberEl.innerText.trim());
                const lover = lovers.find(l => Number(l.memberNumber) === num);
                if (!lover) continue;

                const label = `♥ ${stageLabel(lover.stage)}`;

                // 覆蓋文字節點（如 BCT 改過也會被我們蓋掉）
                const textNode = Array.from(relEl.childNodes)
                .find(n => n.nodeType === Node.TEXT_NODE);
                if (textNode) textNode.textContent = label;
                else relEl.prepend(document.createTextNode(label));

                // 套用階段顏色
                relEl.style.color = STAGE_COLOR[lover.stage] ?? '#FFB6C1';
            }
        });
        const injectNow = () => {
            try { if (CurrentCharacter) injectELDialogs(CurrentCharacter); } catch (e) {}
        };
        modApi.hookFunction("ChatRoomCharacterViewDraw", 1, (args, next) => { const r = next(args); injectNow(); return r; });
        modApi.hookFunction("ChatRoomMenuDraw", 1, (args, next) => { const r = next(args); injectNow(); return r; });
        setInterval(injectNow, 1000);

        // ── Profile 頁面 ────────────────────────────────────────────
        // DrawTextFit hook：攔截 BC 的主人文字，取得精確 Y 座標作為備用
        modApi.hookFunction("DrawTextFit", 0, (args, next) => {
            if (_inInfoSheet) {
                const text = String(args[0] ?? "");
                const y    = args[2];
                if (typeof y === 'number' && y > 400) {
                    const C = getCurrentViewingCharacter();
                    const ownerNum = C?.Ownership?.MemberNumber;
                    if (ownerNum && text.includes(String(ownerNum))) {
                        _ownerTextY = y;
                    }
                }
            }
            return next(args);
        });

        modApi.hookFunction("InformationSheetRun", 10, (args, next) => {
            try {
                _ownerTextY  = null;
                _inInfoSheet = true;
                const r = next(args);
                _inInfoSheet = false;

                // BCX 子畫面開啟時不繪製我們的元素
                if (typeof window.bcx?.inBcxSubscreen === 'function' && window.bcx.inBcxSubscreen()) {
                    profilePanelOpen = false;
                    return r;
                }
                if (CurrentScreen !== "InformationSheet") return r;
                if (typeof InformationSheetSecondScreen !== 'undefined' && InformationSheetSecondScreen) {
                    profilePanelOpen = false;
                    return r;
                }

                if (!profilePageFresh) {
                    profilePageFresh = true;
                    lastOnlineFetch  = 0;
                    refreshOnlineFriends().catch(() => {});
                }

                const C = getCurrentViewingCharacter();
                if (C?.MemberNumber === Player.MemberNumber) drawBCRelationDots(C);
                drawProfileButton();
                drawProfilePanel();
                return r;
            } catch (e) {
                _inInfoSheet = false;
                console.error("🐈‍⬛ [AFC] ❌ InformationSheetRun:", e.message);
                return next(args);
            }
        });
        modApi.hookFunction("InformationSheetClick", 5, (args, next) => {
            try {
                // 任何非我們按鈕的點擊都關閉面板（包含點 BCX 按鈕）
                if (!MouseIn(PROFILE_BTN_X, PROFILE_BTN_Y, PROFILE_BTN_W, PROFILE_BTN_H)) {
                    profilePanelOpen = false;
                }
                handleProfileClick();
            } catch (e) {}
            return next(args);
        });
        modApi.hookFunction("InformationSheetExit", 5, (args, next) => {
            profilePanelOpen = false;
            profilePageFresh = false;
            return next(args);
        });

        // ── 解鎖權限 ────────────────────────────────────────────────
        modApi.hookFunction("DialogCanUnlock", 5, (args, next) => {
            try {
                const C = args[0], item = args[1];
                if (!C || !item?.Property) return next(args);
                const lb = item.Property.LockedBy;
                if (lb === "ELLoveLock" || lb === "ELTimerLock")
                    return C.ID !== 0 && ELLockAccessOn.has(C.MemberNumber);
            } catch (e) { console.error("🐈‍⬛ [AFC] ❌ DialogCanUnlock:", e.message); }
            return next(args);
        });

        // ── 房間同步 ────────────────────────────────────────────────
        registerSocketListener("ChatRoomSync", () => {
            setTimeout(() => {
                syncWithOnlineLovers();
                if (ChatRoomData?.Private) {
                    currentPrivateRoomName = ChatRoomData.Name;
                    broadcastRoomNameToLovers();
                }
                // 廣播 AFC 資料給房間內玩家（EBC 等環境下伺服器同步可能失效）
                broadcastAFCData();
            }, 600);
        });

        registerSocketListener("ChatRoomMessage", (data) => {
            if (handleAFCSyncData(data)) return;

            // 同房間 AFC Beep（Hidden 主要通道，跨伺服器可靠）
            if (data?.Type === "Hidden" && data?.Content === "AFC::Beep") {
                const e = data.Dictionary?.find(d => d.Tag === "AFC::Beep");
                if (e && Number(e.TargetMember) === Number(Player.MemberNumber)) {
                    try {
                        parseBeep({
                            MemberNumber: data.Sender,
                            MemberName:   data.SenderName ?? `#${data.Sender}`,
                            BeepType:     EL_BEEP_TYPE,
                            Message:      e.MsgType,
                            ...e,
                        });
                    } catch (err) { console.error("🐈‍⬛ [AFC] ❌ Hidden beep 失敗:", err.message); }
                }
                return;
            }

            if (data?.Type === "RoomUpdate" && ChatRoomData?.Private) {
                if (ChatRoomData.Name !== currentPrivateRoomName) {
                    currentPrivateRoomName = ChatRoomData.Name;
                    broadcastRoomNameToLovers();
                }
            }
        });

        // ── 好友列表：填入私人房間名 ────────────────────────────────
        modApi.hookFunction("FriendListLoadFriendList", 5, (args, next) => {
            try {
                for (const friend of args[0] ?? []) {
                    if (friend.Private && friend.ChatRoomName === null && loversPrivateRoom[friend.MemberNumber]) {
                        friend.ChatRoomName  = loversPrivateRoom[friend.MemberNumber].ChatRoomName;
                        friend.ChatRoomSpace = loversPrivateRoom[friend.MemberNumber].ChatRoomSpace;
                    }
                }
            } catch (e) {}
            return next(args);
        });

        // ── 離線撤銷授權 ────────────────────────────────────────────
        modApi.hookFunction("ServerDisconnect", 5, (args, next) => {
            try { for (const num of ELLockAccessOn) sendBeep(num, BEEP.LOCK_ACCESS_OFF); } catch (e) {}
            return next(args);
        });

        console.log("🐈‍⬛ [AFC] ✅ Hooks 設置完成");
    }

    // ============================================================
    // 動態載入 HeartLock（與 EL 共用 ModSDK，視為一體插件）
    // ============================================================

    const HEARTLOCK_URL = "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_Custom_Heart_Lock.user.js";

    function _loadHeartLock() {
        // 若已載入（使用者自行安裝了獨立版，守衛旗標已設），跳過
        if (window._AFC_HeartLockLoaded) {
            console.log("🐈‍⬛ [EL] HeartLock 已存在，跳過動態載入");
            return;
        }
        if (document.querySelector(`script[data-el-heartlock]`)) return;

        const s = document.createElement('script');
        s.src = HEARTLOCK_URL;
        s.dataset.elHeartlock = '1';
        s.onload  = () => console.log("🐈‍⬛ [AFC] ✅ Heart Lock 載入完成");
        s.onerror = () => console.warn("🐈‍⬛ [AFC] ⚠️ Heart Lock 載入失敗，請確認網路連線");
        document.head.appendChild(s);
    }

    // ============================================================
    // 初始化 — 分兩階段：載入期 / 登入後
    // ============================================================

    async function initialize() {
        console.log(`🐈‍⬛ [AFC] ⌛ 啟動中... v${MOD_VERSION}`);

        // ── 階段一：載入期（不需要 BC 遊戲狀態）──────────────────
        // 1. 載入 Toast 系統
        await loadToastSystem();

        // 2. 等待 bcModSdk（無超時）
        await waitFor(() =>
                      typeof bcModSdk !== 'undefined' && !!bcModSdk?.registerMod ||
                      typeof window.bcModSdk !== 'undefined' && !!window.bcModSdk?.registerMod
                     );
        const sdk = window.bcModSdk ?? bcModSdk;
        modApi = sdk.registerMod({
            name:       MOD_NAME,
            fullName:   "Abundantia Florum ─Chromatica─",
            version:    MOD_VERSION,
            repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
        });

        // 階段一結束後立即掛載 modApi，供 HeartLock 等外部插件共用
        // HeartLock 不需要自行呼叫 registerMod，直接使用此 modApi 即可
        window.ELAbundantiaAPI = window.ELAbundantiaAPI ?? {};
        window.ELAbundantiaAPI.modApi = modApi;

        // 動態載入 Heart Lock（與 EL 共用 ModSDK，作為一體插件）
        _loadHeartLock();

        // 3. 等待 ServerSocket 就緒（無超時）
        await waitFor(() =>
                      typeof ServerSocket !== 'undefined' &&
                      ServerSocket !== null &&
                      typeof ServerSocket.on === 'function'
                     );

        // ── 階段二：登入後（需要 Player + 設定資料）───────────────
        // completeInit 在 LoginResponse 後觸發，此時：
        //   - TranslationLanguage 已設定 → t() / detectLang() 正確
        //   - Player.OnlineSharedSettings / ExtensionSettings 可用
        //   - PreferenceRegisterExtensionSetting 可呼叫
        let initTried = false;

        function completeInit() {
            if (isInitialized) return;
            if (!Player?.MemberNumber) return;
            if (!Player?.OnlineSharedSettings) return;
            if (!Player?.ExtensionSettings) return;

            try {
                getSharedSettings();  // 初始化 AFC（含備份恢復）
                const priv = getPrivateSettings();

                // 清除舊版遺留的 EL key
                if (Player.ExtensionSettings?.EL) {
                    delete Player.ExtensionSettings.EL;
                    console.log("🐈‍⬛ [AFC] 🗑️ 已清除舊版 EL 遺留資料");
                }
                // 清除舊版 AFC_loversBackup（不再需要）
                _cleanLegacyBackup();
                // 確保鎖的權限已同步到 OnlineSharedSettings
                if (priv) syncLockPermsToShared(priv);
                // 初始化後設定已知戀人數量基準，並強制存備份
                const shared = Player.OnlineSharedSettings?.AFC;
                _lastKnownLoverCount = shared?.lovers?.length ?? 0;
                setupHooks();
                setupCommands();

                // 登入後才能正確取得 TranslationLanguage，ButtonText 翻譯才準確
                registerSettingsUI();

                syncWithOnlineLovers();
                checkAutoBreakup();

                if (typeof modApi.onUnload === 'function') modApi.onUnload(() => cleanup());

                isInitialized = true;
                console.log(`🐈‍⬛ [AFC] ✅ 初始化完成 v${MOD_VERSION} (${detectLang()})`);

                // 對外 API（使用 Object.assign 保留 phase 1 掛載的 modApi，不覆蓋整個物件）
                window.ELAbundantiaAPI = Object.assign(window.ELAbundantiaAPI ?? {}, {
                    isELLover:    (num) => isELLover(num),
                    canOwnerLock: ()    => getPrivateSettings()?.enableOwnerLock ?? false,
                });

                window.Liko.AFC.api = {
                    /** 對方是否為 AFC 拓展戀人 */
                    isLover:          (num) => isELLover(num),
                    /** 對方的戀人階段（0/1/2，若非戀人則 null）*/
                    getLoverStage:    (num) => getLoverEntry(num)?.stage ?? null,
                    /** 穿戴者是否允許我使用心鎖 */
                    canUseHeartLock:  (ch)  => {
                        const lovers = ch?.OnlineSharedSettings?.AFC?.lovers ?? [];
                        const perms  = ch?.OnlineSharedSettings?.AFC?.lockPerms;
                        if (!perms?.enableELLock) return false;
                        return lovers.some(l => Number(l.memberNumber) === Number(Player.MemberNumber))
                        || (Player.Lovership?.some(l => Number(l.MemberNumber) === Number(ch?.MemberNumber)) ?? false);
                    },
                    /** 取得戀人清單（唯讀複本）*/
                    getLovers:        () => [...(getSharedSettings()?.lovers ?? [])],
                };
                // modApi 唯讀參考（供外部插件用 window.Liko.AFC.modApi 查詢，勿用於 hook 註冊）
                window.Liko.AFC.modApi = modApi;

                // Toast 通知成功
                toast(t('toastLoaded'), 5000, "#C2185B");

            } catch (e) {
                console.error("🐈‍⬛ [AFC] ❌ 初始化失敗:", e);
                toast(t('toastFail'), 8000, "#e53935");
            }
        }

        ServerSocket.on("LoginResponse", () => {
            initTried = true;
            setTimeout(completeInit, 500);
        });

        // 等待 MemberNumber 存在後再嘗試（相容重載與正常登入）
        waitFor(() => typeof Player?.MemberNumber === "number").then(() => {
            completeInit();
        });
    }

    function cleanup() {
        unregisterAllSocketListeners();
        for (const k of Object.keys(pendingOutgoing)) clearTimeout(pendingOutgoing[k].timer);
        for (const k of Object.keys(pendingIncoming)) {
            clearInterval(pendingIncoming[k].timer);
            document.getElementById(pendingIncoming[k].uiId)?.remove();
        }
        ELLockAccessOn.clear();
        profilePanelOpen = false;
        isInitialized    = false;
        console.log("🐈‍⬛ [AFC] 🗑️ 已清理資源");
    }

    initialize();
})();
