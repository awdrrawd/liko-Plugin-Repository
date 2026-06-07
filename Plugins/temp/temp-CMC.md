// ==UserScript==
// @name         Liko - FCM
// @name:zh      Liko的好友與房間管理
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.4.2-2
// @description  Friends & Room Manager | 好友與房間管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = '1.4.2';
    if (window.Liko.FCM) return;
    window.Liko.FCM = MOD_VER;

    let _renderToken = 0;
    const modApi = bcModSdk.registerMod({
        name: 'Liko - FCM', fullName: 'Liko - Friends and ChatRoom Manager', version: MOD_VER,
    });
    const BTN_X = 955, BTN_Y = 455, BTN_W = 45, BTN_H = 45;

    // ── FCM icon (SVG → preloaded Image for DrawImageResize) ──────
    const FCM_ICON_SVG = `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="90" height="90">
		<style> .s0 { fill: #ffffff } .s1 { fill: #010101 } .s2 { fill: #ffe5d9 } </style>
		<g id="图层 2 copy">
			<path id="Path 0" fill-rule="evenodd" class="s0" d="m-10.61-1.21h116.67v92.42h-116.67zm10.61 91.21h90v-90h-90z"/>
			<path id="Path 1" class="s1" d="m3.11 19.4c-0.55 0.33-1.19 1.01-1.44 1.51-0.38 0.76-0.46 2.86-0.46 13.03 0 9.64 0.09 12.29 0.42 12.95 0.22 0.46 0.8 1.18 1.29 1.59 0.48 0.42 2.98 1.63 5.57 2.69 2.58 1.06 5.35 2.43 6.16 3.03 1.28 0.96 1.45 1.2 1.27 1.86-0.12 0.42-0.29 1.3-0.38 1.97-0.09 0.67-0.01 1.69 0.17 2.27 0.19 0.59 0.76 1.47 1.28 1.97 0.53 0.5 1.65 1.14 2.51 1.42 1.35 0.44 1.6 0.65 1.82 1.52 0.14 0.55 0.49 1.34 0.79 1.76 0.29 0.42 1.06 1.01 1.71 1.33 0.65 0.31 1.73 0.65 2.39 0.76 0.88 0.15 1.24 0.36 1.32 0.8 0.06 0.33 0.47 1.06 0.91 1.64 0.44 0.57 1.35 1.28 2.01 1.58 0.67 0.3 1.66 0.55 2.2 0.55 0.79 0.01 1.05 0.17 1.31 0.84 0.18 0.46 0.62 1.16 0.98 1.55 0.37 0.4 1.21 0.98 1.88 1.29 0.66 0.3 1.59 0.56 2.04 0.56 0.46 0.01 1.35-0.2 1.97-0.46 0.63-0.26 1.52-0.84 1.97-1.29l0.84-0.82c1.29 1.07 2.21 1.65 2.88 1.97 0.66 0.33 1.62 0.6 2.12 0.6 0.5 0 1.45-0.27 2.12-0.59 0.66-0.32 1.5-0.83 1.86-1.13 0.36-0.3 0.86-1.02 1.11-1.6 0.46-1.05 0.48-1.06 2.08-0.95 1.21 0.08 1.94-0.05 2.9-0.53 0.71-0.36 1.59-1.09 1.95-1.63 0.37-0.54 0.75-1.33 0.86-1.74 0.14-0.57 0.41-0.78 1.08-0.84 0.48-0.04 1.33-0.15 1.87-0.23 0.54-0.08 1.48-0.59 2.09-1.13 0.61-0.54 1.3-1.43 1.52-1.97 0.22-0.54 0.4-1.29 0.4-1.67 0-0.53 0.28-0.77 1.29-1.09 0.71-0.22 1.63-0.64 2.05-0.93 0.41-0.29 1.08-1.2 1.48-2.02 0.61-1.23 0.7-1.75 0.53-3l-0.2-1.52c3.41-1.6 5.56-2.61 6.98-3.26 1.41-0.66 3.32-1.53 4.24-1.94 0.92-0.41 1.98-1.04 2.38-1.41 0.39-0.36 0.9-1.03 1.13-1.49 0.35-0.68 0.43-3.15 0.43-13.03 0-11.66-0.03-12.24-0.61-13.19-0.33-0.54-0.91-1.14-1.29-1.33-0.58-0.29-1.17-0.13-4.01 1.11-1.83 0.8-4.49 1.99-5.91 2.65-1.42 0.66-3.8 1.73-5.3 2.37-2.22 0.95-3.1 1.18-4.7 1.19-1.51 0.01-3.17-0.35-7.12-1.52-2.83-0.84-5.9-1.61-6.82-1.71-0.92-0.1-2.42-0.02-3.33 0.17-0.92 0.2-2.28 0.64-3.03 0.99-1.19 0.55-1.54 0.59-2.65 0.29-0.71-0.19-2.21-0.34-3.34-0.34-1.12 0-4.02 0.36-6.44 0.79-3.36 0.6-5.06 0.75-7.27 0.65-2.77-0.12-3.1-0.21-8.64-2.49-3.16-1.3-7.22-2.96-9.01-3.69-1.79-0.73-3.7-1.32-4.24-1.32-0.55 0-1.43 0.27-1.97 0.61z"/>
			<path id="Path 2" fill-rule="evenodd" class="s2" d="m5.21 21.82c0.3 0 2.22 0.67 4.26 1.49 2.04 0.83 5.76 2.34 8.26 3.36 2.5 1.02 5.43 2.05 6.51 2.29 1.09 0.23 2.65 0.43 3.49 0.43 0.83 0 3.97-0.41 6.97-0.92 3-0.51 5.72-0.88 6.05-0.83 0.48 0.07 0.28 0.3-0.9 1.06-0.84 0.53-1.94 1.41-2.47 1.96-0.52 0.56-2.12 3.19-3.55 5.86-1.81 3.37-2.6 5.17-2.61 5.9-0.01 0.59 0.19 1.37 0.44 1.75 0.26 0.37 1.21 0.95 2.13 1.28 0.91 0.34 2.04 0.61 2.5 0.61 0.46 0.01 1.58-0.22 2.5-0.49 0.91-0.27 2.24-0.88 2.95-1.36 0.71-0.48 1.87-1.64 2.58-2.56 0.92-1.21 1.58-1.77 2.35-1.98 0.58-0.15 1.53-0.37 2.12-0.48 1.03-0.19 1.35 0.04 11.06 7.96 5.5 4.48 10.23 8.42 10.52 8.76 0.28 0.33 0.52 1.12 0.53 1.74 0.01 0.9-0.17 1.27-0.82 1.75-0.46 0.34-1.14 0.62-1.52 0.61-0.37-0.01-0.92-0.13-1.21-0.28-0.29-0.15-2.78-2.13-5.53-4.4-2.84-2.34-5.27-4.12-5.62-4.12-0.34 0-0.79 0.17-0.99 0.38-0.21 0.21-0.37 0.69-0.37 1.06 0.01 0.48 0.75 1.3 2.51 2.77 1.37 1.15 3.76 3.13 5.3 4.4 2.69 2.2 2.8 2.35 2.8 3.51q0 1.22-0.6 1.82c-0.33 0.33-0.98 0.69-1.44 0.78q-0.83 0.17-1.59-0.36c-0.42-0.3-2.63-2.08-4.93-3.96-2.63-2.17-4.42-3.43-4.86-3.43-0.38 0-0.86 0.17-1.07 0.38-0.2 0.21-0.38 0.67-0.4 1.04-0.02 0.48 0.85 1.37 3.42 3.45 1.89 1.54 3.75 3.12 4.13 3.51 0.39 0.41 0.68 1.09 0.68 1.62 0 0.53-0.29 1.22-0.68 1.64-0.38 0.41-0.96 0.82-1.29 0.91-0.34 0.1-1.05-0.06-1.58-0.35-0.54-0.29-2.35-1.66-4.02-3.03-1.67-1.38-3.28-2.5-3.58-2.5-0.3 0-0.72 0.17-0.92 0.38-0.2 0.21-0.36 0.72-0.36 1.13 0 0.57 0.6 1.26 2.43 2.81 2.18 1.83 2.42 2.15 2.42 3.1q0.01 1.07-0.74 1.82c-0.44 0.44-1.1 0.76-1.59 0.77-0.47 0-1.42-0.4-2.14-0.91-1.27-0.91-1.28-0.93-1.09-2.36 0.12-0.9 0.04-1.89-0.22-2.65-0.22-0.67-0.75-1.6-1.17-2.07-0.43-0.46-1.18-0.98-1.68-1.13-0.89-0.28-0.91-0.34-0.91-2.2 0-1.67-0.12-2.07-0.91-3.09-0.5-0.65-1.46-1.42-2.12-1.71-0.67-0.3-1.59-0.55-2.05-0.55-0.69-0.01-0.89-0.2-1.2-1.14-0.2-0.63-0.81-1.58-1.36-2.13-0.55-0.54-1.58-1.13-2.29-1.32-1.05-0.27-1.59-0.23-2.95 0.19-0.92 0.29-1.7 0.41-1.73 0.26-0.04-0.14-0.32-0.6-0.64-1.02-0.31-0.42-1.06-1-1.67-1.29-0.61-0.29-1.66-0.53-2.33-0.53-0.66 0-1.51 0.16-1.89 0.34-0.37 0.19-1.05 0.7-2.33 1.93l-1.22-1.13c-0.67-0.63-1.6-1.33-2.06-1.56-0.45-0.24-2.87-1.26-5.37-2.29-2.6-1.06-4.78-2.15-5.09-2.53-0.5-0.61-0.55-1.6-0.59-12.05-0.04-9.42 0.02-11.44 0.37-11.74 0.24-0.2 0.67-0.36 0.97-0.36zm80.4 1.03c0.19 0.05 0.33 4.18 0.38 11.42 0.07 8.81 0 11.46-0.3 11.87-0.21 0.3-2.77 1.64-5.69 2.98-2.92 1.34-5.98 2.76-8.33 3.85l-3.94-3.19c-2.17-1.75-3.98-3.3-4.02-3.45-0.04-0.15 0.41-0.27 1-0.27 0.75 0 1.3-0.23 1.82-0.76 0.67-0.68 0.7-0.82 0.32-1.44-0.38-0.61-0.62-0.67-2.5-0.58-1.14 0.05-2.69-0.05-3.44-0.23-0.75-0.18-2.18-0.89-3.18-1.58-1-0.69-2.98-2.22-4.4-3.39-2.52-2.09-2.6-2.13-3.94-1.95-0.75 0.09-2.35 0.46-3.56 0.81-2.03 0.59-2.28 0.76-3.35 2.23-0.64 0.87-1.56 1.93-2.05 2.36-0.49 0.42-1.43 0.95-2.1 1.17-0.72 0.25-1.76 0.34-2.57 0.23-0.75-0.1-1.43-0.27-1.52-0.37-0.08-0.1 0.79-1.98 1.94-4.18 1.15-2.19 2.45-4.52 2.88-5.17 0.62-0.93 1.71-1.7 5.03-3.56 2.33-1.31 4.72-2.52 5.3-2.68 0.59-0.17 1.75-0.3 2.58-0.3 0.94-0.01 3.73 0.63 7.35 1.66 3.77 1.08 6.39 1.67 7.42 1.67 0.88-0.01 2.28-0.19 3.11-0.42 0.83-0.23 3.08-1.12 5-1.98 1.92-0.86 4.3-1.93 5.29-2.39 0.99-0.45 2.56-1.18 3.49-1.62 0.92-0.45 1.81-0.78 1.98-0.74zm-44.85 1.79c1.16 0.01 1.57 0.06 0.91 0.13-0.67 0.06-1.62 0.06-2.12-0.01-0.5-0.06 0.04-0.12 1.21-0.12zm-18.32 29.61c0.58 0 1.29 0.24 1.59 0.53 0.31 0.31 0.54 0.96 0.53 1.58 0 0.74-0.32 1.5-1.07 2.5-0.58 0.8-1.34 1.58-1.67 1.75-0.34 0.16-0.91 0.3-1.29 0.31-0.37 0-0.99-0.27-1.36-0.61-0.51-0.46-0.67-0.9-0.62-1.76 0.05-0.89 0.38-1.52 1.46-2.73 1.18-1.33 1.56-1.58 2.43-1.57zm8.24 2.15c0.29-0.02 0.87 0.3 1.29 0.72 0.47 0.47 0.76 1.1 0.76 1.67 0 0.64-0.46 1.47-1.53 2.8-0.84 1.04-2.1 2.48-2.8 3.2-0.91 0.92-1.52 1.29-2.11 1.28-0.47 0-1.16-0.34-1.59-0.77-0.42-0.41-0.76-1.06-0.76-1.44 0-0.37 0.24-1.03 0.53-1.45 0.29-0.43 1.45-1.88 2.58-3.24 1.12-1.35 2.28-2.52 2.57-2.6 0.29-0.07 0.77-0.15 1.06-0.17zm5.85 4.82c0.51 0 1.19 0.3 1.58 0.68 0.45 0.43 0.69 1.03 0.69 1.66-0.01 0.78-0.49 1.55-2.36 3.75-1.29 1.53-2.59 2.89-2.88 3.03-0.29 0.15-0.77 0.27-1.06 0.28-0.29 0-0.91-0.27-1.36-0.61-0.64-0.47-0.84-0.87-0.84-1.68 0-0.78 0.31-1.44 1.17-2.5 0.64-0.79 1.84-2.15 2.67-3.03 1.16-1.22 1.71-1.59 2.39-1.58zm4.08 6.97c0.25-0.02 0.83 0.25 1.28 0.59 0.67 0.49 0.84 0.86 0.84 1.83 0 1.03-0.22 1.43-1.44 2.72q-1.44 1.5-2.2 1.52c-0.42 0.01-1.13-0.26-1.59-0.6-0.63-0.47-0.83-0.87-0.83-1.67 0-0.79 0.29-1.41 1.13-2.4 0.63-0.73 1.41-1.47 1.75-1.64 0.33-0.18 0.81-0.33 1.06-0.35z"/>
		</g></svg>`;
    let _fcmIconImg = null;
    (() => {
        const blob = new Blob([FCM_ICON_SVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { _fcmIconImg = img; };
        img.src = url;
    })();

    // ═══════════════════════════════════════════════════════════
    //  WPS SHARE  (LIKOSHARE protocol — compatible with Liko-WPS)
    // ═══════════════════════════════════════════════════════════
    const WPS_PREFIX    = '[LIKOSHARE]';
    const WPS_OPEN_MARK = 'LIKOSHARE_OPEN';
    const WPS_CHUNK     = 800;
    const _wpsIncoming  = new Map();
    const _wpsCache     = new Map();
    if (!window.__LIKOSHARE_CACHE__) window.__LIKOSHARE_CACHE__ = _wpsCache;

    // ═══════════════════════════════════════════════════════════
    //  LANGUAGE
    // ═══════════════════════════════════════════════════════════
    function isZh() {
        if (cfg.lang === 'zh') return true;
        if (cfg.lang === 'en') return false;
        try {
            const l = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : '').toLowerCase();
            if (!l) return false;
            return l === 'cn' || l === 'tw' || l === 'zh' || l.startsWith('zh-') || l.startsWith('cn-');
        } catch { return false; }
    }
    const L = {
        zh: {
            panelTitle: '🎛 FCM ─ 好友與房間管理', tabFriends: '個人關係', tabRoom: '房間管理', tabSettings: '設定',
            tabPeople: '人員查詢',  tabHelp: '🔖 說明',
            minimize: '—', close: '×', miniLabel: '好友與房間管理',
            search: '搜尋名稱或ID...', roomSearch: '搜尋 / 輸入ID添加...',
            sortBy: '排序', sortRel: '關係', sortId: 'ID', sortName: '名稱', sortAdded: '添加時間', sortSeen: '最後見面',
            showOnly: '顯示', togNick: '暱稱', togName: '名稱',
            fOnline: '在線', fOffline: '不在線', fOwner: '主人', fLover: '戀人', fSub: '奴隸', fFriend: '好友',
            colName: '名稱', colId: 'ID', colRel: '關係', colZone: '分區', colRoom: '房間',
            colPerm: '權限', colOps: '動作', colMgmt: '房管', colMgmtNoPerm: '房管（無權）',
            colSeen: '最後見面',
            relOwner: '主人', relLover: '戀人', relSub: '奴隸', relFriend: '好友', relContact: '單向好友',
            zoneF: '♀', zoneM: '♂', zoneX: '♀♂', zoneUnk: '—',
            online: '在線', offline: '不在線',
            btnView: '查看', btnBeep: '私訊', btnWhisper: '悄悄話', btnAddFriend: '+好友', btnRmFriend: '-好友',
            btnAddAdmin: '+管理', btnRmAdmin: '-管理', btnAddWhite: '+白單', btnRmWhite: '-白單',
            btnAddBan: '+黑單', btnRmBan: '解禁', btnKick: '逐出',
            btnAdd: '添加', btnAddTitle: '添加ID到名單',
            roomTabs: { members: '房內人員', admin: '管理者', white: '白名單', ban: '黑名單' },
            notInRoom: '目前不在任何房間中', noAdminWarn: '⚠ 無管理員權限，房管欄僅供查看',
            setAvatars: '顯示頭像', setAvatarsNote: '在列表中顯示角色頭像（見過後才有，或由角色資料重建）',
            setProfiles: '啟用自動儲存個人資料', setProfilesNote: '與 WCE bce-past-profiles 相容，同房間時自動儲存',
            dbOk: '已連線', dbNo: '未連線',
            langLabel: '語言',
            whisperIndicatorLabel: '私聊/BEEP 輸入框提示色',
            ghostHideLabel: '幽靈名單隱身', ghostHideNote: '幽靈名單中的角色在聊天室不顯示身體（只對自己有效）',
            whisperIndicatorNote: '輸入 /w /whisper /beep 或進入悄悄話模式時，聊天框會顯示紫色邊框提示',
            langNote: 'Auto: 依 BC TranslationLanguage（CN/TW→中文，其餘→English）',
            langDetected: tl => `目前偵測: ${tl || '未設定'}`,
            btnReloadAvatars: '頭像快取管理', reloadAvatarsNote: '清除快取或載入好友頭像',
            btnLoadFriendAvatars: '載入好友頭像', loadFriendAvatarsNote: '掃描所有好友，讓 BC 緩存外觀後統一截圖（約需數十秒）',
            btnClearAvatarCache: '清除頭像快取', clearAvatarCacheNote: '清除所有已儲存的頭像快照，下次遇到時重新截取',
            loadingFriendAvatars: n => `載入好友頭像中... 剩餘 ${n} 人`,
            loadFriendAvatarsDone: '好友頭像載入完成',
            noProfile: '尚無個人資料\n（需先與此人在同一房間）',
            confirmDel: n => `確定刪除好友「${n}」？`,
            confirmKick: n => `確定逐出「${n}」？`,
            confirmRoom: n => `🚪 前往房間「${n}」？`,
            confirmAddBan: n => `確定將「${n}」加入黑名單？\n對方將無法與你互動。`,
            confirmAddGhost: n => `確定將「${n}」加入幽靈名單？\n你將不會再收到任何該玩家的信息。`,
            tabRoomSearch: '查詢房間', roomSearch2: '搜尋房間...', roomSearchBtn: '搜尋',
            roomSearching: '搜尋中...', roomSearchEmpty: '沒有找到房間',
            roomFavLabel: '★ 最愛', roomJoin: '加入', roomMixed: '混合', roomFemale: '女性', roomMale: '男性',
            totalRooms: n => `共 ${n} 間`, roomPrivateLabel: '私人',
            permAdmin: '管理', permPass: 'PASS', permBan: 'BAN', permVisit: '訪客',
            youLabel: '（你）', copyId: '點擊複製ID', copyDone: '已複製！',
            total: n => `共 ${n} 人`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: '輸入訊息（可留空）\nCtrl+Enter 發送',
            beepSend: '發送 BEEP', beepCancel: '取消',
            beepSummon: '召喚',
            beepSummonTitle: '請確定您有召喚對方的權限，否則對方只會收到 summon',
            beepSummonNoRoom: '需在房間內才能召喚',
            noData: '（空白）', noFriends: '沒有符合條件的好友',
            fWhitelist: '白名單', fBlacklist: '黑名單', fGhost: '幽靈',
            relWhitelist: '白名單', relBlacklist: '黑名單', relGhost: '幽靈',
            roomPrivate: '私人', roomPublic: '',
            saveModeLabel: '儲存模式',
            saveModeOff: '不儲存', saveModeName: '僅名稱', saveModeAvatar: '名稱與頭像', saveModeFull: '完整資料（WCE 相容）',
            saveModeDesc_off: '不儲存任何資料。如果你有安裝 WCE 並啟用其 Profiles 功能，建議選此選項避免重複儲存（WCE 已幫你存好了）。',
            saveModeDesc_name: '只儲存成員編號、BC 名稱、暱稱。幾乎不佔空間，可用來顯示離線好友名稱。',
            saveModeDesc_avatar: '額外儲存頭像快照（在遇見時自動擷取，儲存於獨立的 FCM-Snapshot 資料庫）。',
            saveModeDesc_full: '完整儲存：名稱、暱稱、外觀/BIO/稱號等。與 WCE bce-past-profiles 資料庫完全相容，互相共用。頭像另存於 FCM-Snapshot。',
            wceDetected: '✅ 偵測到 WCE Profiles 功能，已自動設為完整資料模式（與 WCE 共用同一個 DB，避免衝突）',
            wceNotDetected: '未偵測到 WCE。建議若只需顯示名稱則選「僅名稱」，需要頭像則選「名稱與頭像」。',
            reloadStatus: n => n > 0 ? `頭像載入中... 剩餘 ${n} 人，請稍等` : '頭像載入完成',
            exportProfiles: '匯出 Profiles', exportNote: '匯出為 JSON（與 WCE 格式相容）',
            importProfiles: '匯入 Profiles', importNote: '從 JSON 匯入（相同 ID 以較新的 seen 時間為準）',
            exportDone: n => `✓ 已匯出 ${n} 筆 profiles`,
            importDone: (p, n) => `✓ 已匯入 profiles: ${p} 筆${n ? `，notes: ${n} 筆` : ''}`,
            profilesTitle: '已儲存的 Profiles', profilesHint: '點擊開啟角色資訊',
            profilesEmpty: '沒有符合條件的 profiles', profilesTotal: (n, t) => `顯示 ${n} / 共 ${t} 筆`,
            searchProfiles: '搜尋名稱或ID...',
            peopleSearchPlaceholder: '輸入名稱或 ID，按 Enter 搜尋...',
            peopleSearchHint: '顯示最近見過的 100 人 · 輸入後按 Enter 或點「搜尋」',
            peopleNoResults: '沒有找到符合的人員',
            peopleUnknownId: n => `請問您是否在搜尋 #${n}？你並無該人員資料`,
            peopleSimilarIds: '包含此數字的相似 ID：',
            peopleUnknownName: '名稱未知',
            peopleOneSidedWarn: () => `⚠ 提醒：此操作為單方面添加。如果有需要，請您主動通知對方。`,
            peopleTotal: (n, t) => t !== undefined ? `顯示 ${n} / 共 ${t} 筆` : `共 ${n} 筆`,
            colShare: '分享',
            btnShare: '分享',
            shareLocalMsg: (name, id) => `📜 已分享 ${name} (${id}) 的 Profile`,
            shareRecvMsg: (from, display, date) => `📜 ${from} 分享了 ${display} 保存於: ${date}`,
            shareOpen: '▶ 開啟',
            whisperAvatarLabel: '私聊時顯示對象頭像',
            whisperAvatarNote: '進入悄悄話/BEEP 模式時，在輸入框旁顯示對象的頭像',
            oocProtectLabel: 'OOC 保護（悄悄話時停用 Ctrl+Enter）',
            oocProtectNote: '悄悄話/BEEP 模式下，封鎖 Ctrl+Enter 以防止 OOC 內容作為普通對話發出',
            btnVisibilityLabel: '按鈕顯示設定',
            btnVisibilityNote: '控制 FCM 按鈕在各頁面的顯示狀態（至少須保留一個）',
            btnShowChatRoom: '聊天室按鈕',
            btnShowMainHall: '大廳按鈕',
            btnShowProfile: '個人檔案按鈕',
        },
        en: {
            panelTitle: '🎛 FCM ─ Friends and ChatRoom Manager', tabFriends: 'Relations', tabRoom: 'Room Mgmt', tabSettings: 'Settings',
            tabPeople: 'People', tabHelp: '🔖 Help',
            minimize: '—', close: '×', miniLabel: 'Friends and ChatRoom Manager',
            search: 'Search name or ID...', roomSearch: 'Search / Enter ID to add...',
            sortBy: 'Sort', sortRel: 'Relation', sortId: 'ID', sortName: 'Name', sortAdded: 'Added', sortSeen: 'Last Seen',
            showOnly: 'Show', togNick: 'Nick', togName: 'Name',
            fOnline: 'Online', fOffline: 'Offline', fOwner: 'Owner', fLover: 'Lover', fSub: 'Sub', fFriend: 'Friend',
            colName: 'Name', colId: 'ID', colRel: 'Rel.', colZone: 'Zone', colRoom: 'Room',
            colPerm: 'Perm.', colOps: 'Actions', colMgmt: 'Room Admin', colMgmtNoPerm: 'Room Admin (no perm)',
            colSeen: 'Last Seen',
            relOwner: 'Owner', relLover: 'Lover', relSub: 'Sub', relFriend: 'Friend', relContact: 'One-way',
            zoneF: '♀', zoneM: '♂', zoneX: '♀♂', zoneUnk: '—',
            online: 'Online', offline: 'Offline',
            btnView: 'View', btnBeep: 'BEEP', btnWhisper: 'Msg', btnAddFriend: '+Frnd', btnRmFriend: '-Frnd',
            btnAddAdmin: '+Admin', btnRmAdmin: '-Admin', btnAddWhite: '+White', btnRmWhite: '-White',
            btnAddBan: '+Ban', btnRmBan: 'Unban', btnKick: 'Kick',
            btnAdd: 'Add', btnAddTitle: 'Add ID to list',
            roomTabs: { members: 'Members', admin: 'Admins', white: 'Whitelist', ban: 'Blacklist' },
            notInRoom: 'Not currently in a room', noAdminWarn: '⚠ No admin rights — Room Admin column is view-only',
            setAvatars: 'Show Avatars', setAvatarsNote: 'Show portraits (saved on encounter, stored in FCM-Snapshot DB)',
            setProfiles: 'Enable Profile Auto-Save', setProfilesNote: 'WCE bce-past-profiles compatible',
            dbOk: 'Connected', dbNo: 'Not connected',
            langLabel: 'Language',
            whisperIndicatorLabel: 'Whisper/BEEP Input Glow Color',
            ghostHideLabel: 'Ghost List Hide', ghostHideNote: 'Characters on your ghost list are hidden in chatroom (only affects your view)',
            whisperIndicatorNote: 'Shows a purple glow on the chat input when /w /whisper /beep is typed or whisper mode is active',
            langNote: 'Auto: follows BC TranslationLanguage (CN/TW→Chinese, others→English)',
            langDetected: tl => `Detected: ${tl || 'not set'}`,
            btnReloadAvatars: 'Avatar Cache', reloadAvatarsNote: 'Clear cache or load friend avatars',
            btnLoadFriendAvatars: 'Load Friend Avatars', loadFriendAvatarsNote: 'Scan all friends, wait for BC to cache appearances, then snapshot (may take tens of seconds)',
            btnClearAvatarCache: 'Clear Avatar Cache', clearAvatarCacheNote: 'Delete all saved avatar snapshots — new ones will be captured on next encounter',
            loadingFriendAvatars: n => `Loading friend avatars... ${n} remaining`,
            loadFriendAvatarsDone: 'Friend avatar loading complete',
            noProfile: 'No profile data\n(Must have been in same room)',
            confirmDel: n => `Unfriend "${n}"?`,
            confirmKick: n => `Kick "${n}"?`,
            confirmRoom: n => `🚪 Go to room "${n}"?`,
            confirmAddBan: n => `Blacklist "${n}"?\nThey will no longer be able to interact with you.`,
            confirmAddGhost: n => `Add "${n}" to ghost list?\nYou will no longer receive any messages from that person.`,
            tabRoomSearch: 'Search Rooms', roomSearch2: 'Search rooms...', roomSearchBtn: 'Search',
            roomSearching: 'Searching...', roomSearchEmpty: 'No rooms found',
            roomFavLabel: '★ Favs', roomJoin: 'Join', roomMixed: 'Mixed', roomFemale: 'Female', roomMale: 'Male',
            totalRooms: n => `Rooms: ${n}`, roomPrivateLabel: 'Private',
            permAdmin: 'Admin', permPass: 'PASS', permBan: 'BAN', permVisit: 'Visit',
            youLabel: '(You)', copyId: 'Click to copy ID', copyDone: 'Copied!',
            total: n => `Total: ${n}`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: 'Type message (can be empty)\nCtrl+Enter to send',
            beepSend: 'Send BEEP', beepCancel: 'Cancel',
            beepSummon: 'Summon',
            beepSummonTitle: 'You must have the authority to summon the other player.\nOtherwise, they will only receive "summon".',
            beepSummonNoRoom: 'Must be in a room to summon',
            noData: '(Empty)', noFriends: 'No matching entries',
            fWhitelist: 'Whitelist', fBlacklist: 'Blacklist', fGhost: 'Ghost',
            relWhitelist: 'WL', relBlacklist: 'BL', relGhost: 'Ghost',
            roomPrivate: 'Private', roomPublic: '',
            saveModeLabel: 'Save Mode',
            saveModeOff: 'Off', saveModeName: 'Name only', saveModeAvatar: 'Name + Avatar', saveModeFull: 'Full profile (WCE)',
            saveModeDesc_off: "Don't save any data. If you have WCE with Profiles enabled, choose this to avoid duplicates (WCE already saves for you).",
            saveModeDesc_name: 'Save member number, BC name, and nickname only. Minimal space, used for displaying offline friend names.',
            saveModeDesc_avatar: 'Also save avatar snapshot (auto-captured when encountered, stored in separate FCM-Snapshot DB).',
            saveModeDesc_full: 'Full save: name, nickname, appearance/BIO/title etc. Fully compatible with WCE bce-past-profiles DB. Avatars stored separately in FCM-Snapshot.',
            wceDetected: '✅ WCE Profiles detected — auto-set to Full mode (shared DB, no conflicts)',
            wceNotDetected: 'WCE not detected. Use Name-only for minimal storage, or Name+Avatar if you want portraits.',
            reloadStatus: n => n > 0 ? `Loading avatars... ${n} remaining, please wait` : 'Avatar loading complete',
            exportProfiles: 'Export Profiles', exportNote: 'Export as JSON (WCE-compatible format)',
            importProfiles: 'Import Profiles', importNote: 'Import from JSON (newer seen timestamp wins on conflict)',
            exportDone: n => `✓ Exported ${n} profiles`,
            importDone: (p, n) => `✓ Imported profiles: ${p}${n ? `, notes: ${n}` : ''}`,
            profilesTitle: 'Saved Profiles', profilesHint: 'Click to open character info',
            profilesEmpty: 'No matching profiles', profilesTotal: (n, t) => `Showing ${n} of ${t}`,
            searchProfiles: 'Search name or ID...',
            peopleSearchPlaceholder: 'Name or ID — press Enter to search...',
            peopleSearchHint: 'Showing last 100 encountered · type then press Enter or click Search',
            peopleNoResults: 'No matching people found',
            peopleUnknownId: n => `Did you mean #${n}? No record found for this ID.`,
            peopleSimilarIds: 'Similar IDs containing this number:',
            peopleUnknownName: 'Name unknown',
            peopleOneSidedWarn: () => `⚠ Note: This action is a one-way addition. If necessary, please notify the other party yourself.`,
            peopleTotal: (n, t) => t !== undefined ? `Showing ${n} of ${t}` : `Total: ${n}`,
            colShare: 'Share',
            btnShare: 'Share',
            shareLocalMsg: (name, id) => `📜 Shared profile: ${name} (${id})`,
            shareRecvMsg: (from, display, date) => `📜 ${from} shared a profile: ${display} saved: ${date}`,
            shareOpen: '▶ Open',
            whisperAvatarLabel: 'Show target avatar during whisper',
            whisperAvatarNote: 'Displays the target\'s avatar near the chat input when in whisper/BEEP mode',
            oocProtectLabel: 'OOC Protection (block Ctrl+Enter during whisper)',
            oocProtectNote: 'In whisper/BEEP mode, blocks Ctrl+Enter to prevent OOC content from being sent as normal chat',
            btnVisibilityLabel: 'Button Visibility',
            btnVisibilityNote: 'Control which screens show the FCM button (at least one must remain enabled)',
            btnShowChatRoom: 'ChatRoom button',
            btnShowMainHall: 'Main Hall button',
            btnShowProfile: 'Profile button',
        },
    };
    function T(k, ...a) { const d = isZh() ? L.zh : L.en; const v = d[k] ?? L.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; }

    // ═══════════════════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════════════════
    let cfg = {
        avatars: false, lang: 'auto', saveMode: 'off',
        whisperIndicator: false, whisperColor: '#b070e8',
        ghostHide: false,
        whisperAvatar: false,
        oocProtect: false,
        btnShowChatRoom: true,
        btnShowMainHall: true,
        btnShowProfile: true,
    };
    function loadCfg() { try { const s = localStorage.getItem('LikoFCM'); if (s) Object.assign(cfg, JSON.parse(s)); } catch {} }
    function saveCfg() { try { localStorage.setItem('LikoFCM', JSON.stringify(cfg)); } catch {} }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE DB  (WCE bce-past-profiles compatible)
    // ═══════════════════════════════════════════════════════════
    const PDB = {
        db: null,
        async init() {
            return new Promise(res => {
                try {
                    const req = indexedDB.open('bce-past-profiles');
                    req.onsuccess = () => { this.db = req.result; res(this.db.objectStoreNames.contains('profiles')); };
                    req.onerror = () => res(false);
                    req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'memberNumber' }); };
                } catch { res(false); }
            });
        },
        _face(C, sz = 44) {
            try {
                const src = C && C.Canvas; if (!src || !src.width) return '';
                const cv = document.createElement('canvas'); cv.width = cv.height = sz;
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#1a0028'; ctx.fillRect(0, 0, sz, sz);
                ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, sz, sz);
                return cv.toDataURL('image/jpeg', 0.85);
            } catch { return ''; }
        },
        save(C, raw) {
            if (cfg.saveMode === 'off' || !this.db || !C || !C.MemberNumber) return;
            try {
                const nick = (typeof CharacterNickname === 'function' ? CharacterNickname(C) : '') || C.Nickname || C.Name || '';
                const now = Date.now();
                const prof = { memberNumber: C.MemberNumber, name: C.Name || '', lastNick: nick, seen: now };
                if (cfg.saveMode === 'full') {
                    const src = raw || { MemberNumber: C.MemberNumber, Name: C.Name || '', Nickname: C.Nickname || '',
                                        LabelColor: C.LabelColor || '#fff', Description: C.Description || '',
                                        Title: C.Title || '', Appearance: C.Appearance || [],
                                        Lovership: C.Lovership || [], Reputation: C.Reputation || [] };
                    const b = { ...src };
                    ['ActivePose','Inventory','BlockItems','LimitedItems','FavoriteItems',
                     'ArousalSettings','OnlineSharedSettings','WhiteList','BlackList','Crafting',
                     'ItemPermission','InventoryData'].forEach(k => delete b[k]);
                    prof.characterBundle = JSON.stringify(b);
                }
                _pc[C.MemberNumber] = prof;
                this.db.transaction('profiles', 'readwrite').objectStore('profiles').put(prof);
                if (cfg.saveMode === 'avatar' || cfg.saveMode === 'full') {
                    const url = this._face(C);
                    if (url) Snapshot.save(C.MemberNumber, url);
                }
            } catch {}
        },
        get(mn) {
            mn = parseInt(mn); if (_pc[mn] !== undefined) return Promise.resolve(_pc[mn]); if (!this.db) { _pc[mn] = null; return Promise.resolve(null); }
            return new Promise(res => { try { const req = this.db.transaction('profiles', 'readonly').objectStore('profiles').get(mn); req.onsuccess = () => { _pc[mn] = req.result || null; res(_pc[mn]); }; req.onerror = () => { _pc[mn] = null; res(null); }; } catch { _pc[mn] = null; res(null); } });
        },
        async batchGet(mns) { for (const mn of mns) if (_pc[parseInt(mn)] === undefined) await this.get(mn); },
    };
    const _pc = {};

    // ═══════════════════════════════════════════════════════════
    //  WPS SHARE FUNCTIONS
    // ═══════════════════════════════════════════════════════════
    async function wpsShareProfile(memberNumber) {
        if (!PDB.db) return;
        const mn = parseInt(memberNumber);
        const prof = await PDB.get(mn);
        if (!prof) return;
        const payload = {
            sharedAt: Date.now(),
            from: { memberNumber: Player?.MemberNumber, name: Player?.Nickname || Player?.Name || String(Player?.MemberNumber) },
            profile: { memberNumber: prof.memberNumber, name: prof.name, lastNick: prof.lastNick, seen: prof.seen, characterBundle: prof.characterBundle }
        };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const total = Math.ceil(encoded.length / WPS_CHUNK);
        for (let i = 0; i < total; i++) {
            ServerSend('ChatRoomChat', { Type: 'Hidden', Content: `${WPS_PREFIX} ${shareId} ${i+1}/${total} ${encoded.slice(i*WPS_CHUNK, (i+1)*WPS_CHUNK)}` });
        }
        const displayName = prof.lastNick || prof.name || mn;
        if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('shareLocalMsg', displayName, mn), 0);
    }

    function wpsHandleMessage(data) {
        if (!data?.Content?.startsWith(WPS_PREFIX)) return false;
        if (window.LikoWPSInstance && window.__LIKOSHARE_CACHE__ !== _wpsCache) return false;
        try {
            const parts = data.Content.split(' ');
            const shareId = parts[1];
            const [idx, total] = parts[2].split('/').map(Number);
            const chunk = parts.slice(3).join(' ');
            if (!_wpsIncoming.has(shareId)) _wpsIncoming.set(shareId, { total, chunks: [] });
            const entry = _wpsIncoming.get(shareId);
            entry.chunks[idx - 1] = chunk;
            if (entry.chunks.filter(Boolean).length === entry.total) {
                _wpsIncoming.delete(shareId);
                const payload = JSON.parse(decodeURIComponent(escape(atob(entry.chunks.join('')))));
                const key = `${payload.sharedAt}:${payload.profile.memberNumber}`;
                _wpsCache.set(key, payload);
                if (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__ !== _wpsCache) window.__LIKOSHARE_CACHE__.set(key, payload);
                const p = payload.profile;
                const from = payload.from || {};
                const fromName = from.name || from.memberNumber || '?';
                const isSelf = from.memberNumber === Player?.MemberNumber;
                const displayName = p.lastNick || p.name || p.memberNumber;
                const openToken = `[${WPS_OPEN_MARK} ${payload.sharedAt} ${p.memberNumber}]`;
                const seenDate = new Date(p.seen);
                const seenText = `${seenDate.getFullYear()}/${seenDate.getMonth()+1}/${seenDate.getDate()}`;
                if (!isSelf && typeof ChatRoomSendLocal === 'function') {
                    ChatRoomSendLocal(T('shareRecvMsg', fromName, `${openToken} ${displayName} (${p.memberNumber})`, seenText), 0);
                }
                if (PDB.db) {
                    const tx = PDB.db.transaction('profiles', 'readwrite');
                    const store = tx.objectStore('profiles');
                    const req = store.get(p.memberNumber);
                    req.onsuccess = () => { const local = req.result; if (!local || p.seen > local.seen) store.put(p); };
                }
                setTimeout(() => document.querySelectorAll('.ChatMessageLocalMessage').forEach(wpsProcessOpenTokens), 200);
            }
        } catch(e) { console.warn('🐈‍⬛ [FCM] WPS parse error', e); }
        return true;
    }

    function wpsProcessOpenTokens(element) {
        if (element.dataset.fcmShareProcessed === '1') return;
        const html = element.innerHTML;
        if (!html || !html.includes(WPS_OPEN_MARK)) return;
        const replaced = html.replace(
            /\[LIKOSHARE_OPEN\s+(\d+)\s+(\d+)\]/g,
            (m, sharedAt, memberNumber) => {
                const key = `${sharedAt}:${memberNumber}`;
                const payload = _wpsCache.get(key) || (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__.get(key));
                if (!payload) return m;
                return `<span class="fcmShareOpen" data-key="${key}" style="color:#885CB0;cursor:pointer;user-select:none;">${T('shareOpen')}</span>`;
            }
        );
        if (replaced !== html) {
            element.innerHTML = replaced;
            element.dataset.fcmShareProcessed = '1';
            element.querySelectorAll('.fcmShareOpen').forEach(el => {
                if (el.dataset.bound) return;
                el.dataset.bound = '1';
                el.onselectstart = () => false;
                el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
                el.addEventListener('click', e => {
                    e.preventDefault(); e.stopPropagation();
                    const payload = _wpsCache.get(el.dataset.key) || (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__.get(el.dataset.key));
                    if (!payload) return;
                    const p = payload.profile;
                    try { const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber); InformationSheetLoadCharacter(C); } catch {}
                    if (PDB.db) { const tx = PDB.db.transaction('profiles', 'readwrite'); const store = tx.objectStore('profiles'); const req = store.get(p.memberNumber); req.onsuccess = () => { const local = req.result; if (!local || p.seen > local.seen) store.put(p); }; }
                });
            });
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  FCM-SNAPSHOT DB
    // ═══════════════════════════════════════════════════════════
    const Snapshot = {
        db: null,
        _cache: {},
        async init() {
            return new Promise(res => {
                try {
                    const req = indexedDB.open('fcm-snapshot', 1);
                    req.onupgradeneeded = e => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('avatars')) {
                            db.createObjectStore('avatars', { keyPath: 'memberNumber' });
                        }
                    };
                    req.onsuccess = () => { this.db = req.result; res(true); };
                    req.onerror = () => res(false);
                } catch { res(false); }
            });
        },
        save(mn, dataUrl) {
            mn = parseInt(mn);
            if (!this.db || !dataUrl) return;
            const rec = { memberNumber: mn, avatarDataUrl: dataUrl, savedAt: Date.now() };
            this._cache[mn] = dataUrl;
            try { this.db.transaction('avatars', 'readwrite').objectStore('avatars').put(rec); } catch {}
        },
        get(mn) {
            mn = parseInt(mn);
            if (this._cache[mn] !== undefined) return Promise.resolve(this._cache[mn]);
            if (!this.db) { this._cache[mn] = null; return Promise.resolve(null); }
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readonly').objectStore('avatars').get(mn);
                    req.onsuccess = () => { const r = req.result; this._cache[mn] = r ? r.avatarDataUrl : null; res(this._cache[mn]); };
                    req.onerror = () => { this._cache[mn] = null; res(null); };
                } catch { this._cache[mn] = null; res(null); }
            });
        },
        async batchGet(mns) {
            for (const mn of mns) {
                const k = parseInt(mn);
                if (this._cache[k] === undefined) await this.get(k);
            }
        },
        async clear() {
            Object.keys(this._cache).forEach(k => delete this._cache[k]);
            if (!this.db) return;
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readwrite').objectStore('avatars').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => res();
                } catch { res(); }
            });
        },
    };

    // ═══════════════════════════════════════════════════════════
    //  AVATAR REBUILD QUEUE
    // ═══════════════════════════════════════════════════════════
    const _avQueue = []; let _avBusy = false;
    let _avStatusEl = null;

    async function detectWCESave() {
        try { if (typeof fbcSettings !== 'undefined' && fbcSettings.pastProfiles === true) return true; } catch {}
        try { if (PDB.db && PDB.db.objectStoreNames.contains('notes')) return true; } catch {}
        try { if (window.BCE_VERSION || window.FBC_VERSION) return true; } catch {}
        return false;
    }

    function queueAvatarLoad(mn, profile, onDone) {
        mn = parseInt(mn);
        const cached = Snapshot._cache[mn];
        if (cached) { onDone(cached); return; }
        if (_avQueue.some(q => q.mn === mn)) return;
        _avQueue.push({ mn, profile, onDone });
        if (!_avBusy) _processAvQueue();
    }

    async function _processAvQueue() {
        if (_avBusy || _avQueue.length === 0) return;
        _avBusy = true;
        function updateStatus() { const n = _avQueue.length + 1; if (_avStatusEl) _avStatusEl.textContent = T('reloadStatus', n); }
        while (_avQueue.length > 0) {
            const { mn, profile, onDone } = _avQueue.shift();
            updateStatus();
            const alreadyCached = await Snapshot.get(mn);
            if (alreadyCached && alreadyCached.length > 800) { onDone(alreadyCached); continue; }
            const url = await loadAvatarFromBundle(mn, profile);
            if (url) onDone(url);
            await new Promise(r => setTimeout(r, 80));
        }
        _avBusy = false;
        if (_avStatusEl) { _avStatusEl.textContent = T('reloadStatus', 0); setTimeout(() => { if (_avStatusEl) _avStatusEl.textContent = ''; }, 3000); }
    }

    async function loadAvatarFromBundle(mn, profile) {
        mn = parseInt(mn);
        if (!profile?.characterBundle) return null;
        if (inRoomFn(mn)) return null;
        try {
            const data = JSON.parse(profile.characterBundle);
            if (typeof CharacterLoadOnline !== 'function') return null;
            const C = CharacterLoadOnline(data, mn);
            if (!C) return null;
            if (typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined);
            let prev = '', stable = 0, url = '';
            for (let i = 0; i < 40; i++) {
                await new Promise(r => requestAnimationFrame(r));
                const cur = PDB._face(C, 44);
                if (cur && cur.length > 800) {
                    if (cur === prev) {
                        stable++;
                        if (stable >= 3) { url = cur; break; }
                    } else {
                        stable = 0; prev = cur;
                    }
                }
            }
            try {
                if (Array.isArray(Character)) {
                    const live = new Set((ChatRoomCharacter || []).map(c => c.MemberNumber));
                    const idx = Character.findIndex(c => c.MemberNumber === mn && !live.has(mn));
                    if (idx >= 0) Character.splice(idx, 1);
                }
            } catch {}
            if (url && url.length > 800) Snapshot.save(mn, url);
            return url || null;
        } catch { return null; }
    }

    // ═══════════════════════════════════════════════════════════
    //  AUTO-SNAPSHOT
    // ═══════════════════════════════════════════════════════════
    function _captureSnapshotDelayed(C) {
        if (!C || !C.MemberNumber || C.MemberNumber === parseInt(Player?.MemberNumber)) return;
        if (Snapshot._cache[C.MemberNumber]) return;
        const mn = C.MemberNumber;
        let stable = 0, prev = '';
        const check = () => {
            if (Snapshot._cache[mn]) return;
            const url = PDB._face(C, 44);
            if (url && url.length > 800) {
                if (url === prev) {
                    stable++;
                    if (stable >= 3) { Snapshot.save(mn, url); return; }
                } else { stable = 0; prev = url; }
            }
            setTimeout(check, 600);
        };
        setTimeout(check, 1500);
    }

    let onlineFriends = [];
    modApi.hookFunction('ServerAccountQueryResult', 0, (args, next) => {
        const data = args[0];
        if (data?.Query === 'OnlineFriends' && Array.isArray(data.Result)) {
            onlineFriends = data.Result;
        }
        const r = next(args);
        if (data?.Query === 'OnlineFriends' && panelOpen && !panelMini && (uiTab === 'friends' || uiTab === 'room')) {
            renderCurrent();
        }
        return r;
    });
    modApi.hookFunction('ChatRoomSync', 0, (args, next) => {
        const r = next(args);
        const raws = (args[0] && args[0].Character) || [];
        setTimeout(() => raws.forEach(raw => {
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber);
            if (C) {
                if (cfg.saveMode !== 'off') PDB.save(C, raw);
                _captureSnapshotDelayed(C);
            }
        }), 800);
        return r;
    });
    modApi.hookFunction('ChatRoomSyncMemberJoin', 0, (args, next) => {
        const r = next(args);
        if (args[0] && args[0].Character) {
            const raw = args[0].Character;
            setTimeout(() => {
                const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber);
                if (C) {
                    if (cfg.saveMode !== 'off') PDB.save(C, raw);
                    _captureSnapshotDelayed(C);
                }
            }, 800);
        }
        return r;
    });
    modApi.hookFunction('ChatRoomSyncRoomProperties', 0, (args, next) => {
        let r; try { r = next(args); } catch(e) { console.warn('🐈‍⬛ [FCM] SyncRoomProperties:', e); }
        try { if (panelOpen && !panelMini && uiTab === 'room') renderCurrent(); } catch {}
        return r;
    });
    modApi.hookFunction('ChatRoomSyncMemberLeave', 0, (args, next) => {
        const r = next(args);
        if (panelOpen && !panelMini && uiTab === 'room') renderCurrent();
        return r;
    });

    // ═══════════════════════════════════════════════════════════
    //  DATA HELPERS
    // ═══════════════════════════════════════════════════════════
    function parseAFC() { try { let afc = Player && Player.ExtensionSettings && Player.ExtensionSettings.AFC; if (!afc) return []; if (typeof afc === 'string') afc = JSON.parse(afc); return (afc.l || []).map(e => ({ MemberNumber: parseInt(e[0]), Name: e[1] || '', addedAt: e[3] || 0 })); } catch { return []; } }
    function getSubSet() {
        const s = new Set();
        try { const list = Player && Player.SubmissivesList; if (list) { const arr = Array.isArray(list) ? list : (list instanceof Set ? Array.from(list) : []); arr.forEach(x => { const mn = parseInt(typeof x === 'object' ? (x.MemberNumber || x) : x); if (mn) s.add(mn); }); } } catch {}
        try { (ChatRoomCharacter || []).forEach(C => { if (C.Ownership && parseInt(C.Ownership.MemberNumber) === parseInt(Player.MemberNumber)) s.add(parseInt(C.MemberNumber)); }); } catch {}
        return s;
    }
    function getRel(mn) {
        mn = parseInt(mn); if (!Player || mn === parseInt(Player.MemberNumber)) return 'none';
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) return 'owner';
        if (Player.Lovership && Player.Lovership.some(l => parseInt(l.MemberNumber) === mn)) return 'lover';
        if (parseAFC().some(l => parseInt(l.MemberNumber) === mn)) return 'lover';
        if (getSubSet().has(mn)) return 'sub';
        if (Player.FriendNames && Player.FriendNames.has(mn)) return 'friend';
        const _of = onlineFriends.find(f => f.MemberNumber === mn);
        if (_of && _of.Type === 'Friend') return 'friend';
        if (Player.FriendList && Player.FriendList.includes(mn)) return 'contact';
        if (Player.WhiteList && Player.WhiteList.includes(mn)) return 'whitelist';
        if (Player.BlackList && Player.BlackList.includes(mn)) return 'blacklist';
        return 'none';
    }
    function getAllRels(mn) {
        mn = parseInt(mn); if (!Player || mn === parseInt(Player.MemberNumber)) return ['none'];
        const roles = [];
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) roles.push('owner');
        if ((Player.Lovership && Player.Lovership.some(l => parseInt(l.MemberNumber) === mn)) || parseAFC().some(l => parseInt(l.MemberNumber) === mn)) roles.push('lover');
        if (getSubSet().has(mn)) roles.push('sub');
        if (!roles.length && Player.FriendNames && Player.FriendNames.has(mn)) roles.push('friend');
        const _of2 = onlineFriends.find(f => f.MemberNumber === mn);
        if (!roles.length && _of2 && _of2.Type === 'Friend') roles.push('friend');
        if (!roles.length && Player.FriendList && Player.FriendList.includes(mn)) roles.push('contact');
        if (Player.WhiteList && Player.WhiteList.includes(mn)) roles.push('whitelist');
        if (Player.BlackList && Player.BlackList.includes(mn)) roles.push('blacklist');
        try { if (Player.GhostList && Player.GhostList.includes(mn)) roles.push('ghost'); } catch {}
        return roles.length ? roles : ['none'];
    }
    const REL_ORDER = { owner: 0, lover: 1, sub: 2, friend: 3, contact: 4, whitelist: 5, blacklist: 6, none: 7 };

    let showNickname = true;
    function getDisplayName(mn) {
        mn = parseInt(mn);
        // 1. 在線角色（房間內）
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C) {
            if (showNickname && typeof CharacterNickname === 'function') {
                const n = CharacterNickname(C); if (n) return n;
            }
            return C.Name || `#${mn}`;
        }
        // 2. 線上好友
        const online = onlineFriends.find(f => f.MemberNumber === mn);
        if (online) {
            // 優先檢查快取暱稱
            if (showNickname) {
                const cached = _pc[mn];
                if (cached && cached.lastNick) return cached.lastNick;
            }
            if (online.MemberName) return online.MemberName;
        }
        // 3. ★ 對所有離線玩家，先查 _pc 快取的暱稱
        if (showNickname) {
            const cached = _pc[mn];
            if (cached && cached.lastNick) return cached.lastNick;
        }
        // 4. fallback：各種關係資料中的名稱
        if (Player.FriendNames && Player.FriendNames.get(mn)) return Player.FriendNames.get(mn);
        const lover = Player.Lovership && Player.Lovership.find(l => parseInt(l.MemberNumber) === mn);
        if (lover && lover.Name) return lover.Name;
        const afc = parseAFC().find(l => l.MemberNumber === mn);
        if (afc && afc.Name) return afc.Name;
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn)
            return Player.Ownership.Name || `#${mn}`;
        // 5. 最後用快取的 BC 名稱
        const cached = _pc[mn];
        if (cached) return cached.name || `#${mn}`;
        return `#${mn}`;
    }

    function buildFriendList() {
        const seen = new Set(), rows = [], selfMn = parseInt(Player.MemberNumber);
        function add(mn, addedAt) { mn = parseInt(mn); if (!mn || mn === selfMn || seen.has(mn)) return; seen.add(mn); rows.push({ mn, addedAt: addedAt || 0 }); }
        if (Player.Ownership && Player.Ownership.MemberNumber) add(Player.Ownership.MemberNumber, Player.Ownership.Start || 0);
        (Player.Lovership || []).forEach(l => add(l.MemberNumber, l.Start || 0));
        parseAFC().forEach(l => add(l.MemberNumber, l.addedAt));
        try { const list = Player.SubmissivesList; if (list) { const arr = Array.isArray(list) ? list : (list instanceof Set ? Array.from(list) : []); arr.forEach(x => { const mn = typeof x === 'object' ? (x.MemberNumber || 0) : x; add(parseInt(mn), typeof x === 'object' ? (x.Start || 0) : 0); }); } } catch {}
        (ChatRoomCharacter || []).forEach(C => { if (C.Ownership && parseInt(C.Ownership.MemberNumber) === selfMn) add(C.MemberNumber, 0); });
        if (Player.FriendNames) for (const [mn] of Player.FriendNames) add(mn, 0);
        (Player.FriendList || []).forEach(mn => add(mn, 0));
        (Player.WhiteList || []).forEach(mn => add(mn, 0));
        (Player.BlackList || []).forEach(mn => add(mn, 0));
        try { (Player.GhostList || []).forEach(mn => add(mn, 0)); } catch {}
        return rows.filter(r => r.mn !== selfMn).map(r => ({ mn: r.mn, addedAt: r.addedAt, name: getDisplayName(r.mn), rel: getRel(r.mn) }));
    }
    function getZone(mn) {
        mn = parseInt(mn);
        const inRoomC = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (inRoomC) { const sp = inRoomC.Pronouns || inRoomC.Gender || ''; if (sp === 'M') return T('zoneM'); return T('zoneF'); }
        const f = onlineFriends.find(f => f.MemberNumber === mn);
        if (!f) return null;
        const sp = f.ChatRoomSpace !== undefined ? f.ChatRoomSpace : '';
        if (sp === 'M') return T('zoneM'); if (sp === 'X' || sp === 'B') return T('zoneX'); return T('zoneF');
    }
    function getRoomInfo(mn) {
        mn = parseInt(mn);
        const inRoomC = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (inRoomC && ChatRoomData) return { name: ChatRoomData.Name, isPrivate: !!(ChatRoomData.Private), isCurrent: true };
        const f = onlineFriends.find(f => f.MemberNumber === mn);
        if (!f) return null;
        if (f.ChatRoomName) return { name: f.ChatRoomName, isPrivate: !!(f.Private), isCurrent: false };
        if (f.Private) return { name: null, isPrivate: true, isCurrent: false };
        return null;
    }
    function getRoomName(mn) { const r = getRoomInfo(mn); return r ? r.name : null; }
    function getRoomPerms(mn) {
        if (!ChatRoomData) return ['visit']; mn = parseInt(mn);
        const p = []; if (ChatRoomData.Admin && ChatRoomData.Admin.includes(mn)) p.push('admin'); if (ChatRoomData.Whitelist && ChatRoomData.Whitelist.includes(mn)) p.push('pass'); if (ChatRoomData.Ban && ChatRoomData.Ban.includes(mn)) p.push('ban'); if (!p.length) p.push('visit'); return p;
    }
    function amAdmin() { return !!(ChatRoomData && ChatRoomData.Admin && ChatRoomData.Admin.includes(Player.MemberNumber)); }
    function inRoomFn(mn) { return !!(ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === parseInt(mn))); }
    function isFriendOf(mn) { return !!(Player.FriendList && Player.FriendList.includes(parseInt(mn))); }
    function canBeep(mn) {
        mn = parseInt(mn);
        if (inRoomFn(mn)) return true;
        const rel = getRel(mn);
        if (rel === 'owner' || rel === 'lover' || rel === 'sub') return true;
        const _of = onlineFriends.find(f => f.MemberNumber === mn);
        return !!(_of && _of.Type === 'Friend');
    }

    // ─── Detect current whisper target MN ────────────────────────
    function _getWhisperTargetMN() {
        try {
            // BC global: set when player clicks on someone in chat
            if (typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0) return ChatRoomTargetMemberNumber;
            // Check input value for /w /whisper /beep commands
            const el = document.getElementById('InputChat');
            if (el) {
                const v = el.value;
                // Numeric ID: /w 12345 or /beep 12345
                const mNum = v.match(/^\/(w|whisper|beep)\s+(\d+)/i);
                if (mNum) return parseInt(mNum[2]);
                // Name match: /w somename — search in room then online friends
                const mName = v.match(/^\/(w|whisper)\s+(.+)/i);
                if (mName) {
                    const query = mName[2].trim().toLowerCase();
                    if (!query) return null;
                    // Search in current room
                    if (ChatRoomCharacter) {
                        const found = ChatRoomCharacter.find(c => {
                            const nick = (typeof CharacterNickname === 'function' ? CharacterNickname(c) : '') || '';
                            return c.Name.toLowerCase().startsWith(query) || nick.toLowerCase().startsWith(query);
                        });
                        if (found) return found.MemberNumber;
                    }
                    // Search in online friends
                    const ff = onlineFriends.find(f => (f.MemberName||'').toLowerCase().startsWith(query));
                    if (ff) return ff.MemberNumber;
                    // Search in profile cache (names)
                    for (const [mn, p] of Object.entries(_pc)) {
                        if (!p) continue;
                        if ((p.name||'').toLowerCase().startsWith(query) || (p.lastNick||'').toLowerCase().startsWith(query)) return parseInt(mn);
                    }
                }
            }
        } catch {}
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    //  ROOM ACTIONS
    // ═══════════════════════════════════════════════════════════
    function roomOp(mn, action) {
        if (!amAdmin()) return;
        mn = parseInt(mn);
        switch (action) {
            case 'makeAdmin': {
                if (!Array.isArray(ChatRoomData.Admin)) ChatRoomData.Admin = [];
                if (!ChatRoomData.Admin.some(a => parseInt(a) === mn)) ChatRoomData.Admin.push(mn);
                if (inRoomFn(mn)) { ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Promote' }); }
                else { ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' }); }
                break;
            }
            case 'rmAdmin': {
                if (!Array.isArray(ChatRoomData.Admin)) ChatRoomData.Admin = [];
                const _ai = ChatRoomData.Admin.findIndex(a => parseInt(a) === mn);
                if (_ai >= 0) ChatRoomData.Admin.splice(_ai, 1);
                if (inRoomFn(mn)) { ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Demote' }); }
                else { ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' }); }
                break;
            }
            case 'addWhite': ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Whitelist' }); break;
            case 'rmWhite':  ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Unwhitelist' }); break;
            case 'ban':      ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Ban' }); break;
            case 'unban':    ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Unban' }); break;
            case 'kick':     ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Kick' }); break;
        }
        renderCurrent();
        setTimeout(renderCurrent, 1200);
    }

    // ═══════════════════════════════════════════════════════════
    //  INTERACTION HELPERS
    // ═══════════════════════════════════════════════════════════
    async function doView(mn) {
        mn = parseInt(mn);
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C && typeof InformationSheetLoadCharacter === 'function') { InformationSheetLoadCharacter(C); return; }
        const p = await PDB.get(mn); if (!p || !p.characterBundle) { alert(T('noProfile')); return; }
        try { const data = JSON.parse(p.characterBundle); if (typeof CharacterLoadOnline === 'function') { const loaded = CharacterLoadOnline(data, mn); if (typeof InformationSheetLoadCharacter === 'function') InformationSheetLoadCharacter(loaded); } } catch { alert(T('noProfile')); }
    }

    function doBeep(mn) {
        mn = parseInt(mn); const name = getDisplayName(mn);
        const ex = document.getElementById('fcm-beep-overlay'); if (ex) { ex.remove(); return; }
        const overlay = document.createElement('div'); overlay.id = 'fcm-beep-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;';
        overlay.addEventListener('click', () => overlay.remove());
        const pop = document.createElement('div');
        pop.style.cssText = 'background:#241840;border:2px solid #8060c8;border-radius:16px;padding:26px;width:min(520px,92vw);box-shadow:0 10px 50px rgba(0,0,0,.85);display:flex;flex-direction:column;gap:16px;';
        pop.addEventListener('click', e => e.stopPropagation());
        const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#d0a8f0;font-size:16px;font-weight:700;text-align:center;'; titleEl.textContent = T('beepTitle', name);
        const ta = document.createElement('textarea'); ta.rows = 10; ta.placeholder = T('beepPlaceholder');
        ta.style.cssText = 'background:#1a1030;border:1.5px solid #6050a0;border-radius:10px;padding:12px;color:#f0e0ff;font-size:13px;outline:none;width:100%;box-sizing:border-box;resize:vertical;min-height:140px;max-height:360px;overflow-y:auto;font-family:inherit;line-height:1.5;';
        ta.style.setProperty('user-select', 'text', 'important');
        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('beepCancel'); cancelBtn.style.cssText = 'flex:1;padding:14px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:14px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => overlay.remove());
        const sendBtn = document.createElement('button'); sendBtn.textContent = T('beepSend'); sendBtn.style.cssText = 'flex:2;padding:14px;background:#1a3860;border:1.5px solid #4090d8;border-radius:10px;color:#90d0ff;font-size:15px;cursor:pointer;font-weight:700;';
        sendBtn.addEventListener('click', () => { const msg = ta.value.trim(); ServerSend('AccountBeep', { MemberNumber: mn, BeepType: '', Message: msg || undefined }); if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: msg }); overlay.remove(); });
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendBtn.click(); } if (e.key === 'Escape') overlay.remove(); e.stopPropagation(); });
        const summonBtn = document.createElement('button');
        summonBtn.textContent = T('beepSummon');
        summonBtn.style.cssText = 'flex:1;padding:14px;background:#182a10;border:1.5px solid #40a030;border-radius:10px;color:#80e860;font-size:14px;cursor:pointer;font-weight:700;';
        summonBtn.addEventListener('click', () => {
            const msg = (isZh()
                         ? `請確定您有召喚對方的權限，否則對方只會收到文字 "summon"。\n\n確定要召喚「${name}」嗎？`
                         : `Make sure you have permission to summon them, otherwise they will only receive the text "summon".\n\nSummon "${name}"?`);
            showConfirm(msg, () => {
                try {
                    ServerSend('AccountBeep', {
                        MemberNumber: mn, BeepType: '',
                        Message: 'summon',
                        ChatRoomName: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : undefined,
                        ChatRoomSpace: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Space : undefined,
                    });
                } catch(e) { console.warn('🐈‍⬛ [FCM] summon error:', e); }
                if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: '[summon]' });
                overlay.remove();
            }, isZh() ? '召喚' : 'Summon');
        });
        if (typeof ChatRoomData === 'undefined' || !ChatRoomData) {
            summonBtn.disabled = true; summonBtn.style.opacity = '0.35'; summonBtn.style.cursor = 'not-allowed';
            summonBtn.title = T('beepSummonNoRoom');
        }
        btnRow.appendChild(cancelBtn); btnRow.appendChild(summonBtn); btnRow.appendChild(sendBtn);
        pop.appendChild(titleEl); pop.appendChild(ta); pop.appendChild(btnRow);
        overlay.appendChild(pop); document.body.appendChild(overlay); ta.focus();
    }

    function doWhisper(mn) { const el = document.getElementById('InputChat'); if (el) { el.value = `/w ${mn} `; el.focus(); } minimizePanel(); }
    function doAddFriend(mn) { mn = parseInt(mn); if (!isFriendOf(mn) && typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, true, mn.toString()); setTimeout(renderCurrent, 400); } }

    // ── Bug fix: doToggleList no longer calls showConfirm internally ──
    // All confirmation is handled exclusively at the call site.
    function doToggleList(mn, listType, add) {
        mn = parseInt(mn);
        let list;
        if (listType === 'white') list = Player.WhiteList;
        else if (listType === 'black') list = Player.BlackList;
        else if (listType === 'ghost') { try { list = Player.GhostList; } catch { list = null; } }
        if (!Array.isArray(list)) return;
        try {
            if (typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(list, add, String(mn)); }
            else {
                const idx2 = list.indexOf(mn);
                if (add && idx2 < 0) list.push(mn);
                else if (!add && idx2 >= 0) list.splice(idx2, 1);
                const d = {}; d[listType === 'white' ? 'WhiteList' : listType === 'black' ? 'BlackList' : 'GhostList'] = list;
                if (typeof ServerAccountUpdate !== 'undefined') ServerAccountUpdate.QueueData(d);
            }
        } catch(e) { console.warn('🐈‍⬛ [FCM] doToggleList:', e); }
        setTimeout(renderCurrent, 400);
    }
    function doRemoveFriend(mn) { mn = parseInt(mn); if (typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, false, mn.toString()); setTimeout(renderCurrent, 400); } }

    function navigateToRoom(roomName) {
        showConfirm(T('confirmRoom', roomName), () => {
            // Blur all FCM search inputs to prevent their keydown handlers from
            // leaking Enter/Shift+Enter events into the new room context (Nami bug fix)
            document.querySelectorAll('.fcm-search, .fcm-room-search').forEach(el => el.blur());
            closePanel();
            try {
                if (typeof ChatRoomLeave === 'function') ChatRoomLeave();
                if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSearch');
                try { ChatSearchLastQueryJoinTime = typeof CommonTime === 'function' ? CommonTime() : Date.now(); } catch {}
                try { ChatSearchLastQueryJoin = roomName; } catch {}
                ServerSend('ChatRoomJoin', { Name: roomName });
            } catch (e) { console.warn('🐈‍⬛ [FCM] navigateToRoom:', e); }
        }, isZh() ? '🚪 前往' : '🚪 Go');
    }

    // ── Bug fix: showConfirm — stopPropagation on Enter to prevent
    // BC's room-join handler from firing after the confirm dialog closes.
    // Also guards against double-fire via _confirmed flag.
    function showConfirm(msg, onOk, okLabel) {
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#241840;border:2px solid #7060c0;border-radius:14px;padding:28px 24px;width:min(380px,88vw);box-shadow:0 8px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:20px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());
        const msgEl = document.createElement('div'); msgEl.style.cssText = 'color:#e8d0ff;font-size:14px;text-align:center;line-height:1.7;white-space:pre-wrap;'; msgEl.textContent = msg;
        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = isZh() ? '取消' : 'Cancel';
        cancelBtn.style.cssText = 'flex:1;padding:12px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => { cleanup(); overlay.remove(); });
        const okBtn = document.createElement('button'); okBtn.textContent = okLabel || (isZh() ? '確認' : 'Confirm');
        okBtn.style.cssText = 'flex:2;padding:12px;background:#1a3060;border:1.5px solid #4080d8;border-radius:10px;color:#90c8ff;font-size:13px;cursor:pointer;font-weight:700;';

        // Bug fix: one-shot guard prevents double-fire on rapid double-click
        let _confirmed = false;
        okBtn.addEventListener('click', () => {
            if (_confirmed) return; _confirmed = true;
            cleanup(); overlay.remove(); if (onOk) onOk();
        });

        const keyFn = e => {
            // Bug fix: stopPropagation so Enter/Escape don't reach BC's global handlers
            e.stopPropagation();
            if (e.key === 'Escape') { cleanup(); overlay.remove(); }
            if (e.key === 'Enter') {
                if (_confirmed) return; _confirmed = true;
                cleanup(); overlay.remove(); if (onOk) onOk();
            }
        };
        function cleanup() { document.removeEventListener('keydown', keyFn, true); }
        // Use capture phase so we intercept before BC's handlers
        document.addEventListener('keydown', keyFn, true);
        overlay.addEventListener('click', () => { cleanup(); overlay.remove(); });
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
        box.appendChild(msgEl); box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay); setTimeout(() => okBtn.focus(), 50);
    }

    function makeIdCell(mn) {
        const td = document.createElement('td'); td.className = 'fcm-id fcm-id-copy'; td.textContent = String(mn); td.title = T('copyId');
        td.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(String(mn)); td.textContent = T('copyDone'); td.style.color = '#50d880'; setTimeout(() => { td.textContent = String(mn); td.style.color = ''; }, 1200); } catch {}
        });
        return td;
    }

    // ═══════════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('fcm-css')) return;
        const s = document.createElement('style'); s.id = 'fcm-css';
        s.textContent = `
#fcm-panel,#fcm-panel *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
#fcm-panel *{user-select:none;} #fcm-panel input,#fcm-panel textarea{user-select:text!important;}
#fcm-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1040px,96vw);height:min(640px,92vh);
  background:#1e1635;border:2px solid #5a48a8;border-radius:14px;box-shadow:0 12px 60px rgba(0,0,0,.75);z-index:99990;display:flex;flex-direction:column;overflow:hidden;}
#fcm-panel.hidden{display:none!important;}
#fcm-mini{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:220px;height:40px;background:#1e1635;border:2px solid #5a48a8;border-radius:20px;display:none;align-items:center;justify-content:center;gap:10px;cursor:pointer;z-index:99990;color:#c4a0e0;font-size:12px;transition:all .15s;}
#fcm-mini.visible{display:flex;} #fcm-mini:hover{border-color:#b090f0;background:#261a48;}
.fcm-mini-pill{width:32px;height:4px;background:#5a48a8;border-radius:2px;}
.fcm-mini-lbl{font-size:9px;color:#8068a8;letter-spacing:1.2px;}
#fcm-hdr{background:linear-gradient(135deg,#2a2050,#1e1635);padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #4a3890;cursor:move;flex-shrink:0;min-height:46px;}
#fcm-title{color:#e8c8ff;font-size:13px;letter-spacing:2px;font-weight:700;flex:1;}
.fcm-hbtn{width:28px;height:28px;border-radius:50%;background:#261a40;border:1px solid #5a48a8;color:#c4a0e0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;transition:all .15s;flex-shrink:0;}
.fcm-hbtn:hover{background:#3a2860;color:#f0d8ff;border-color:#9070d8;}
#fcm-tabs{display:flex;background:#1a1230;border-bottom:1px solid #4a3890;flex-shrink:0;}
.fcm-tab{padding:10px 22px;color:#7060a0;cursor:pointer;font-size:11px;letter-spacing:1.2px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-tab:hover{color:#c4a0e0;background:#211540;} .fcm-tab.active{color:#e0b8ff;border-bottom-color:#a078e8;background:#1e1438;}
#fcm-content{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;}
.fcm-toolbar{padding:8px 14px;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;border-bottom:1px solid #362858;flex-shrink:0;background:#211540;overflow-x:auto;}
.fcm-search-wrap{position:relative;display:inline-flex;align-items:center;width:min(200px,35vw);flex-shrink:0;}
.fcm-search{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:6px 26px 6px 10px;color:#f0e4ff;font-size:12px;width:100%;outline:none;transition:border-color .15s;}
.fcm-search:focus{border-color:#9078d0;} .fcm-search::placeholder{color:#5a4878;}
.fcm-clear-btn{position:absolute;right:6px;background:none;border:none;color:#6050a0;cursor:pointer;font-size:15px;padding:0 2px;line-height:1;transition:color .15s;}
.fcm-clear-btn:hover{color:#f0d8ff;}
.fcm-sel{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:5px 6px;color:#c4a0e0;font-size:11px;outline:none;cursor:pointer;max-width:110px;flex-shrink:0;}
.fcm-sel option{background:#1a1030;}
.fcm-lbl-sm{font-size:10px;color:#6050a0;letter-spacing:1px;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-spacer{flex:1;}
.fcm-ftog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:transparent;color:#6058a0;font-size:10px;cursor:pointer;transition:all .15s;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-ftog:hover{color:#c4a0e0;border-color:#8068c0;} .fcm-ftog.on{background:#301c58;border-color:#b088e8;color:#e0c0ff;}
.fcm-nick-tog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:#301c58;color:#e0c0ff;font-size:10px;cursor:pointer;font-weight:700;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.fcm-nick-tog:hover{border-color:#b088e8;}
.fcm-subtabs{display:flex;background:#1a1230;border-bottom:1px solid #362858;flex-shrink:0;padding:0 10px;}
.fcm-stab{padding:7px 18px;color:#5a4880;cursor:pointer;font-size:10px;letter-spacing:1px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-stab:hover{color:#c4a0e0;} .fcm-stab.active{color:#d0a8f8;border-bottom-color:#a078e8;}
.fcm-scroll-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.fcm-scroll{flex:1;overflow-y:auto;overflow-x:auto;min-height:0;}
.fcm-scroll::-webkit-scrollbar{width:5px;height:5px;}
.fcm-scroll::-webkit-scrollbar-track{background:#1a1030;}
.fcm-scroll::-webkit-scrollbar-thumb{background:#4838a0;border-radius:3px;}
.fcm-count{font-size:11px;color:#9080b8;padding:6px 14px;background:#1a1230;border-top:1px solid #2a2048;letter-spacing:1px;flex-shrink:0;text-align:center;}
.fcm-tbl{width:100%;border-collapse:collapse;font-size:12px;}
.fcm-tbl th{background:#261a4a;color:#c4a0e0;font-size:10px;letter-spacing:1.2px;padding:9px 10px;text-align:center;border-bottom:2px solid #4a3890;font-weight:700;white-space:nowrap;position:sticky;top:0;z-index:2;}
.fcm-tbl th.fcm-th-left{text-align:left;}
.fcm-tbl th.fcm-th-mgmt{color:#f0a060;} .fcm-tbl th.fcm-th-mgmt-off{color:#6050a0;}
.fcm-tbl td{padding:6px 10px;border-bottom:1px solid #2a2048;vertical-align:middle;white-space:nowrap;}
.fcm-row:hover td{background:#2e2258;}
.fcm-td-mgmt.no-perm{opacity:0.4;pointer-events:none;}
.fcm-av{width:36px;height:36px;border-radius:8px;background:#201838;border:1px solid #4a3890;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:11px;color:#a080c8;flex-shrink:0;font-weight:700;}
.fcm-av img{width:36px;height:36px;object-fit:cover;display:block;border-radius:7px;}
.fcm-name{color:#f0e4ff;font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;}
.fcm-id{color:#7060a0;font-size:11px;}
.fcm-id-copy{cursor:pointer;transition:color .15s;} .fcm-id-copy:hover{color:#c090ff;}
.fcm-sta{font-size:10px;margin-top:2px;}
.fcm-online{color:#50c870;} .fcm-offline{color:#7060a0;} .fcm-you{font-size:10px;color:#a080e8;margin-top:2px;}
.fcm-zone{font-size:16px;color:#d0a8f0;text-align:center;}
.fcm-room{font-size:12px;color:#9878b8;}
.fcm-room-link{font-size:13px;color:#7090f8;cursor:pointer;font-weight:600;display:inline-block;max-width:140px;overflow:hidden;text-overflow:ellipsis;border-bottom:1px dotted #7090f8;transition:color .15s;}
.fcm-room-link:hover{color:#b0c8ff;border-bottom-color:#b0c8ff;}
.fcm-rel{font-size:10px;font-weight:800;padding:2px 10px;border-radius:10px;display:inline-block;white-space:nowrap;}
.fcm-rel-owner  {background:#2a0808;color:#ff8888;border:1px solid #801818;}
.fcm-rel-lover  {background:#28082a;color:#ff9ae0;border:1px solid #801868;}
.fcm-rel-sub    {background:#082018;color:#60e0b0;border:1px solid #106040;}
.fcm-rel-friend {background:#08102a;color:#88c8ff;border:1px solid #184880;}
.fcm-rel-contact  {background:#1c1830;color:#a890c8;border:1px solid #483868;}
.fcm-rel-whitelist{background:#0d2a1a;color:#60d090;border:1px solid #208050;font-size:9px;padding:1px 5px;}
.fcm-rel-blacklist{background:#2a0d0d;color:#d07070;border:1px solid #802020;font-size:9px;padding:1px 5px;}
.fcm-rel-ghost    {background:#1a1a1a;color:#909090;border:1px solid #505050;font-size:9px;padding:1px 5px;}
.fcm-perms{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;}
.fcm-perm{font-size:10px;padding:2px 8px;border-radius:6px;font-weight:800;white-space:nowrap;}
.fcm-perm-admin{background:#280808;color:#ff7060;border:1px solid #801010;}
.fcm-perm-pass {background:#082018;color:#50d880;border:1px solid #105030;}
.fcm-perm-ban  {background:#1c1c1c;color:#888888;border:1px solid #444444;}
.fcm-perm-visit{background:#1c1830;color:#9878b8;border:1px solid #483868;}
.fcm-btns{display:flex;gap:3px;flex-wrap:nowrap;align-items:center;}
.fcm-btn{padding:3px 7px;border-radius:6px;border:1px solid #4838a0;background:#1e1635;color:#b098d0;font-size:10px;cursor:pointer;transition:all .15s;white-space:nowrap;font-weight:600;}
.fcm-btn:hover{background:#2a1e50;border-color:#9070c8;color:#e8d0ff;}
.fcm-btn:disabled{opacity:.35;cursor:not-allowed;pointer-events:none;}
.fcm-btn-red   {border-color:#801010;color:#f08080;}.fcm-btn-red:hover{background:#2a0808;border-color:#d04040;color:#ffb0b0;}
.fcm-btn-purple{border-color:#7030b8;color:#c080f0;}.fcm-btn-purple:hover{background:#2a1040;border-color:#c080f0;}
.fcm-btn-blue  {border-color:#184888;color:#80c8ff;}.fcm-btn-blue:hover{background:#0a1e38;border-color:#4098d8;color:#c0e8ff;}
.fcm-btn-green {border-color:#104830;color:#60d890;}.fcm-btn-green:hover{background:#081e10;border-color:#30b858;color:#a0ffc0;}
.fcm-btn-orange{border-color:#604010;color:#f0a050;}.fcm-btn-orange:hover{background:#281808;border-color:#c06820;color:#ffc880;}
.fcm-empty{padding:50px;text-align:center;color:#4a3870;font-size:12px;letter-spacing:1px;}
.fcm-warn{padding:8px 16px;font-size:11px;color:#f0a060;background:#20100a;border-bottom:1px solid #601c08;flex-shrink:0;}
.fcm-onesided-warn{padding:8px 14px;font-size:11px;color:#e8a040;background:#1e1205;border:1px solid #604010;border-radius:6px;margin:8px 14px;line-height:1.5;}
.fcm-settings-wrap{padding:16px 24px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;}
.fcm-set-row{display:flex;align-items:flex-start;gap:14px;padding:3px 0;}
.fcm-tog{width:42px;height:22px;border-radius:11px;border:1px solid #4838a0;background:#1a1030;cursor:pointer;position:relative;transition:all .2s;flex-shrink:0;margin-top:2px;margin-right:4px;}
.fcm-tog.on{background:#3a1858;border-color:#b080e8;}
.fcm-tog-dot{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#4838a8;transition:all .2s;}
.fcm-tog.on .fcm-tog-dot{left:23px;background:#d090f8;}
.fcm-set-label{color:#e8d4ff;font-size:15px;font-weight:600;}
.fcm-set-note{color:#a090c8;font-size:12px;margin-top:5px;line-height:1.6;}
.fcm-set-desc{color:#a090c8;font-size:12px;margin-top:6px;padding:8px 12px;background:#1a1030;border-radius:6px;border-left:2px solid #5048a0;line-height:1.6;}
.fcm-settings-wrap .fcm-sel{max-width:none;width:auto;font-size:12px;padding:6px 10px;flex-shrink:0;}
.fcm-tab-disabled{opacity:0.4;cursor:not-allowed !important;}
.fcm-tab-disabled:hover{color:#7060a0 !important;background:transparent !important;}
.fcm-dbstat{font-size:12px;color:#8070a8;padding:10px 14px;background:#1a1030;border-radius:8px;border:1px solid #3a2870;margin-top:4px;}
.fcm-divider{height:1px;background:#2a2048;margin:4px 0;}
.fcm-wce-tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;white-space:nowrap;}
.fcm-wce-tag-yes{background:rgba(16,80,40,.5);border:1px solid #30a060;color:#70e0a0;}
.fcm-reload-status{font-size:11px;color:#80c090;min-height:0;transition:opacity .3s;}
.fcm-people-hint{padding:10px 16px;font-size:11px;color:#6050a0;background:#1a1230;border-bottom:1px solid #2a2048;letter-spacing:.5px;}
.fcm-unknown-id-box{margin:16px;padding:14px 16px;background:#1a1030;border:1px solid #5a48a8;border-radius:10px;display:flex;flex-direction:column;gap:10px;}
.fcm-unknown-id-title{color:#d0a8f0;font-size:13px;font-weight:700;}
.fcm-seen-date{font-size:10px;color:#6050a0;margin-top:2px;}
/* Whisper avatar: drawn on BC canvas, no DOM overlay needed */
/* OOC flash */
@keyframes fcm-ooc-flash{0%{box-shadow:0 0 0 3px #ff4040cc,0 0 16px #ff404088;border-color:#ff4040;}50%{box-shadow:0 0 0 6px #ff404066,0 0 24px #ff404044;border-color:#ff8080;}100%{box-shadow:0 0 0 3px #ff4040cc,0 0 16px #ff404088;border-color:#ff4040;}}
.fcm-ooc-blocked{animation:fcm-ooc-flash .3s ease-in-out 3;}
/* Btn visibility checkboxes */
.fcm-chk-row{display:flex;align-items:center;gap:8px;padding:4px 0;}
.fcm-chk-row input[type=checkbox]{width:16px;height:16px;accent-color:#a078e8;cursor:pointer;flex-shrink:0;}
.fcm-chk-row label{color:#c4a0e0;font-size:13px;cursor:pointer;}
.fcm-chk-row label.fcm-chk-disabled{color:#ff8080;}
        `;
        document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════
    //  UI STATE
    // ═══════════════════════════════════════════════════════════
    let _roomResults = [];
    let _roomZoneFilter = 'X';
    let _roomSearchQ2 = '';
    let _favRooms = new Set(JSON.parse(localStorage.getItem('fcmFavRooms') || '[]'));
    let _roomSortMode = 'fav';
    const _roomCache = new Map();

    function saveFavRooms() { try { localStorage.setItem('fcmFavRooms', JSON.stringify([..._favRooms])); } catch {} }

    function _cacheRooms(rooms) {
        const now = Date.now();
        for (const r of rooms) {
            if (!r.Name) continue;
            const mc = r.MemberCount ?? r.NbMember ?? null;
            const ml = r.MemberLimit ?? r.Limit ?? null;
            const existing = _roomCache.get(r.Name);
            if (!existing || mc !== null || ml !== null) {
                _roomCache.set(r.Name, { MemberCount: mc, MemberLimit: ml, Space: r.Space ?? r.ChatRoomSpace ?? '', ts: now });
            }
        }
    }

    async function doRoomSearch(query, zone) {
        try {
            const res = await ServerRoomSearch(query || '', { Language: '', Space: zone, Game: '', FullRooms: false });
            if (!res || res.err || !res.value) return [];
            _cacheRooms(res.value);
            return res.value;
        } catch(e) { console.warn('🐈‍⬛ [FCM] doRoomSearch:', e); return []; }
    }

    const _pendingRoomQueries = new Set();
    async function queryRoomInfo(roomName, space, onUpdate) {
        if (_pendingRoomQueries.has(roomName)) return;
        _pendingRoomQueries.add(roomName);
        try {
            const zones = space !== undefined ? [space, 'X', '', 'M'] : ['X', '', 'M'];
            for (const z of [...new Set(zones)]) {
                try {
                    const res = await ServerRoomSearch(roomName, { Language: '', Space: z, Game: '', FullRooms: false });
                    if (!res || res.err || !res.value) continue;
                    const found = res.value.find(r => r.Name === roomName);
                    if (found) { _cacheRooms([found]); if (onUpdate) onUpdate(_roomCache.get(roomName)); break; }
                } catch {}
            }
        } finally { _pendingRoomQueries.delete(roomName); }
    }

    function getCachedRoomInfo(roomName) {
        const cached = _roomCache.get(roomName); if (cached) return cached;
        const fromResults = _roomResults.find(r => r.Name === roomName);
        if (fromResults) { const mc = fromResults.MemberCount ?? fromResults.NbMember ?? null; const ml = fromResults.MemberLimit ?? fromResults.Limit ?? null; return mc !== null || ml !== null ? { MemberCount: mc, MemberLimit: ml } : null; }
        return null;
    }

    let panelEl = null, miniEl = null, panelOpen = false, panelMini = false;
    let uiTab = 'friends', roomSubTab = 'members';
    let searchQ = '', roomSearchQ = '', sortMode = 'rel', roomSortMode = 'name';
    let _peopleQ = '';
    let searchDebounce = null, roomSearchDebounce = null;
    const filters = { online: true, offline: false, owner: false, lover: false, sub: false, friend: false, whitelist: false, blacklist: false };

    // ═══════════════════════════════════════════════════════════
    //  ELEMENT HELPERS
    // ═══════════════════════════════════════════════════════════
    function makeAvEl(mn, snapshotUrl) {
        mn = parseInt(mn);
        const el = document.createElement('div'); el.className = 'fcm-av'; el.dataset.mn = mn;
        el.style.cursor = 'pointer';
        el.title = isZh() ? '點擊重新抓取頭像' : 'Click to reload avatar';
        el.addEventListener('click', e => { e.stopPropagation(); _forceLoadAvatar(mn, el); });

        if (cfg.avatars) {
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
            if (C && C.Canvas && C.Canvas.width > 0) {
                try {
                    const cv = document.createElement('canvas'); cv.width = cv.height = 36;
                    const ctx = cv.getContext('2d'), src = C.Canvas;
                    ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, 36, 36);
                    const img = document.createElement('img'); img.src = cv.toDataURL('image/jpeg', 0.85); el.appendChild(img); return el;
                } catch {}
            }
            const snap = snapshotUrl || Snapshot._cache[mn];
            if (snap && snap.length > 800) {
                const img = document.createElement('img'); img.src = snap; el.appendChild(img); return el;
            }
            (async () => {
                if (!el.isConnected) return;
                const saved = await Snapshot.get(mn);
                if (saved && saved.length > 800) {
                    const t = el.isConnected ? el : panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                    if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = saved; t.appendChild(img); }
                    return;
                }
                if (_pc[mn] === undefined) await PDB.get(mn);
                const profile = _pc[mn];
                _avQueue.push({ mn, profile, onDone: url => {
                    const t = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                    if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = url; t.appendChild(img); }
                }});
                if (!_avBusy) _processAvQueue();
            })();
        }
        el.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
        return el;
    }

    async function _forceLoadAvatar(mn, el) {
        mn = parseInt(mn);
        el.textContent = '…';
        const qi = _avQueue.findIndex(q => q.mn === mn); if (qi >= 0) _avQueue.splice(qi, 1);
        if (_pc[mn] === undefined) await PDB.get(mn);
        const profile = _pc[mn];
        if (!profile) { el.textContent = '?'; return; }
        if (!profile.characterBundle) { el.textContent = '?'; return; }
        delete Snapshot._cache[mn];
        if (Snapshot.db) { try { Snapshot.db.transaction('avatars','readwrite').objectStore('avatars').delete(mn); } catch {} }
        const url = await loadAvatarFromBundle(mn, profile);
        const target = el.isConnected ? el : panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
        if (url && target) {
            target.innerHTML = ''; const img = document.createElement('img'); img.src = url; target.appendChild(img);
        } else {
            if (target) target.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
        }
    }

    const REL_LABEL = () => ({ owner: T('relOwner'), lover: T('relLover'), sub: T('relSub'), friend: T('relFriend'), contact: T('relContact'), whitelist: T('relWhitelist'), blacklist: T('relBlacklist'), ghost: T('relGhost'), none: '—' });
    function makeRelEl(rel) {
        const roles = Array.isArray(rel) ? rel : [rel];
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
        const labels = REL_LABEL();
        for (const r of roles) {
            if (r === 'none') { if (roles.length === 1) { const s = document.createElement('span'); s.textContent = '—'; wrap.appendChild(s); } continue; }
            const s = document.createElement('span'); s.className = `fcm-rel fcm-rel-${r in REL_ORDER ? r : 'contact'}`;
            s.textContent = labels[r] || r; wrap.appendChild(s);
        }
        return wrap;
    }
    function makePermEl(perm) { const el = document.createElement('span'); el.className = `fcm-perm fcm-perm-${perm}`; el.textContent = { admin: T('permAdmin'), pass: T('permPass'), ban: T('permBan'), visit: T('permVisit') }[perm] || perm; return el; }
    function mkBtn(label, cls, cb, title) { const b = document.createElement('button'); b.className = 'fcm-btn' + (cls ? ' ' + cls : ''); b.textContent = label; if (title) b.title = title; b.addEventListener('click', e => { e.stopPropagation(); cb(e); }); return b; }
    function mkToggle(on, onChange) { const w = document.createElement('div'); w.className = 'fcm-tog' + (on ? ' on' : ''); const d = document.createElement('div'); d.className = 'fcm-tog-dot'; w.appendChild(d); w.addEventListener('click', () => { const v = !w.classList.contains('on'); w.classList.toggle('on', v); onChange(v); }); return w; }

    // ── Bug fix: all search inputs stop keydown propagation to prevent
    // BC's global Enter handler from triggering room joins / profile opens.
    function makeSearchWrap(initialValue, placeholder, onInput, extraClass, onClear) {
        const wrap = document.createElement('div'); wrap.className = 'fcm-search-wrap';
        const inp = document.createElement('input'); inp.className = 'fcm-search' + (extraClass ? ' ' + extraClass : ''); inp.placeholder = placeholder; inp.value = initialValue;
        const clrBtn = document.createElement('button'); clrBtn.className = 'fcm-clear-btn'; clrBtn.textContent = '×'; clrBtn.title = 'Clear';
        clrBtn.addEventListener('click', e => {
            e.stopPropagation(); inp.value = ''; inp.focus();
            onInput('');
            if (onClear) onClear();
        });
        inp.addEventListener('input', () => { onInput(inp.value); }); // 只更新 searchQ 狀態
        // Bug fix: stop all keydown propagation from search inputs
        inp.addEventListener('keydown', e => { e.stopPropagation(); });
        wrap.appendChild(inp); wrap.appendChild(clrBtn);
        return { wrap, inp };
    }

    function buildMgmtBtns(mn, context) {
        if (!ChatRoomData) return null;
        const wrap = document.createElement('div'); wrap.className = 'fcm-btns';
        const isAdm = !!(ChatRoomData.Admin && ChatRoomData.Admin.some(a => parseInt(a) === mn));
        const isWht = !!(ChatRoomData.Whitelist && ChatRoomData.Whitelist.some(a => parseInt(a) === mn));
        const isBan = !!(ChatRoomData.Ban && ChatRoomData.Ban.some(a => parseInt(a) === mn));
        wrap.appendChild(mkBtn(isAdm ? T('btnRmAdmin') : T('btnAddAdmin'), isAdm ? 'fcm-btn-red' : 'fcm-btn-orange', () => roomOp(mn, isAdm ? 'rmAdmin' : 'makeAdmin')));
        wrap.appendChild(mkBtn(isWht ? T('btnRmWhite') : T('btnAddWhite'), isWht ? 'fcm-btn-red' : 'fcm-btn-green', () => roomOp(mn, isWht ? 'rmWhite' : 'addWhite')));
        if (isBan) wrap.appendChild(mkBtn(T('btnRmBan'), 'fcm-btn-green', () => roomOp(mn, 'unban')));
        else wrap.appendChild(mkBtn(T('btnAddBan'), 'fcm-btn-red', () => roomOp(mn, 'ban')));
        if (context === 'members' && inRoomFn(mn)) wrap.appendChild(mkBtn(T('btnKick'), 'fcm-btn-red', () => showConfirm(T('confirmKick', getDisplayName(mn)), () => roomOp(mn, 'kick'), isZh() ? '逐出' : 'Kick')));
        return wrap;
    }

    // ─── Shared: build action buttons for a person ─────────────────
    // Bug fix: showConfirm is the ONLY place confirmations appear.
    // doToggleList and doRemoveFriend no longer call showConfirm themselves.
    function buildPersonOps(mn, { isInRoom = false, isMe = false, oneSided = false } = {}) {
        mn = parseInt(mn);
        const ops = document.createElement('div'); ops.className = 'fcm-btns';
        const profile = _pc[mn] || null;
        const isFriend = isFriendOf(mn);
        const hasProfile = !!(profile && profile.characterBundle);
        const vb = mkBtn(T('btnView'), '', () => doView(mn));
        if (!isInRoom && !hasProfile) vb.disabled = true;
        ops.appendChild(vb);

        if (!isMe) {
            if (isInRoom) ops.appendChild(mkBtn(T('btnWhisper'), '', () => doWhisper(mn)));
            if (canBeep(mn)) ops.appendChild(mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(mn)));

            const _sep = document.createElement('span'); _sep.style.cssText = 'width:6px;display:inline-block;'; ops.appendChild(_sep);

            const _dname = getDisplayName(mn);
            const _isWhl = (Player.WhiteList || []).includes(mn);
            const _isBl  = (Player.BlackList || []).includes(mn);
            const _isGh  = (() => { try { return (Player.GhostList || []).includes(mn); } catch { return false; } })();
            const osSuffix = oneSided ? '\n\n' + T('peopleOneSidedWarn') : '';

            if (!isFriend) ops.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green',
                                                 () => showConfirm((isZh() ? `添加「${_dname}」為好友？` : `Add "${_dname}" as friend?`) + osSuffix, () => doAddFriend(mn))));
            else ops.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red',
                                       () => showConfirm(T('confirmDel', _dname), () => doRemoveFriend(mn), isZh() ? '移除' : 'Remove')));

            ops.appendChild(mkBtn(_isWhl ? T('btnRmWhite') : T('btnAddWhite'), _isWhl ? 'fcm-btn-red' : 'fcm-btn-green',
                                  () => showConfirm(_isWhl
                                                    ? (isZh() ? `移除「${_dname}」白名單？` : `Remove "${_dname}" from whitelist?`)
                                                    : (isZh() ? `將「${_dname}」加入白名單？` : `Add "${_dname}" to whitelist?`) + osSuffix,
                                                    () => doToggleList(mn, 'white', !_isWhl))));

            ops.appendChild(mkBtn(_isBl ? T('btnRmBan') : T('btnAddBan'), 'fcm-btn-red',
                                  () => showConfirm(_isBl
                                                    ? (isZh() ? `移除「${_dname}」黑名單？` : `Remove "${_dname}" from blacklist?`)
                                                    : T('confirmAddBan', _dname) + osSuffix,
                                                    () => doToggleList(mn, 'black', !_isBl),
                                                    _isBl ? undefined : (isZh() ? '加入' : 'Add'))));

            ops.appendChild(mkBtn(_isGh ? (isZh() ? '-幽靈' : '-Ghost') : (isZh() ? '+幽靈' : '+Ghost'), _isGh ? 'fcm-btn-red' : 'fcm-btn-purple',
                                  () => showConfirm(_isGh
                                                    ? (isZh() ? `移除「${_dname}」幽靈？` : `Remove "${_dname}" from ghost?`)
                                                    : T('confirmAddGhost', _dname) + osSuffix,
                                                    () => doToggleList(mn, 'ghost', !_isGh))));
        }
        return ops;
    }

    // ═══════════════════════════════════════════════════════════
    //  PANEL BUILD
    // ═══════════════════════════════════════════════════════════
    function buildPanel() {
        if (document.getElementById('fcm-panel')) { panelEl = document.getElementById('fcm-panel'); return; }
        injectStyles();
        const panel = document.createElement('div'); panel.id = 'fcm-panel'; panel.classList.add('hidden');
        const hdr = document.createElement('div'); hdr.id = 'fcm-hdr';
        const title = document.createElement('div'); title.id = 'fcm-title'; title.textContent = T('panelTitle');
        const minBtn = document.createElement('div'); minBtn.className = 'fcm-hbtn'; minBtn.textContent = T('minimize'); minBtn.addEventListener('click', minimizePanel);
        const closeBtn = document.createElement('div'); closeBtn.className = 'fcm-hbtn'; closeBtn.textContent = T('close'); closeBtn.addEventListener('click', closePanel);
        hdr.appendChild(title); hdr.appendChild(minBtn); hdr.appendChild(closeBtn);
        const tabBar = document.createElement('div'); tabBar.id = 'fcm-tabs';
        [['friends', T('tabFriends')], ['room', T('tabRoom')], ['roomSearch', T('tabRoomSearch')], ['people', T('tabPeople')], ['settings', T('tabSettings')], ['help', T('tabHelp')]].forEach(([key, label]) => {
            const t = document.createElement('div'); t.className = 'fcm-tab' + (key === uiTab ? ' active' : ''); t.dataset.tab = key; t.textContent = label;
            t.addEventListener('click', () => {
                uiTab = key;
                if (key !== 'people') { _peopleQ = ''; _peoplePage = 0; }
                tabBar.querySelectorAll('.fcm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === key));
                renderCurrent();
            }); tabBar.appendChild(t);
        });
        const content = document.createElement('div'); content.id = 'fcm-content';
        panel.appendChild(hdr); panel.appendChild(tabBar); panel.appendChild(content);
        document.body.appendChild(panel); panelEl = panel;
        let drag = { on: false, ox: 0, oy: 0 };
        hdr.addEventListener('mousedown', e => { if (e.target === minBtn || e.target === closeBtn) return; drag.on = true; const r = panel.getBoundingClientRect(); drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top; panel.style.transform = 'none'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (!drag.on) return; panel.style.left = (e.clientX - drag.ox) + 'px'; panel.style.top = (e.clientY - drag.oy) + 'px'; });
        document.addEventListener('mouseup', () => { drag.on = false; });
        const mini = document.createElement('div'); mini.id = 'fcm-mini';
        mini.innerHTML = `<span style="font-size:16px">🎛</span><div class="fcm-mini-pill"></div><span class="fcm-mini-lbl">${T('miniLabel')}</span>`;
        mini.addEventListener('click', restorePanel); document.body.appendChild(mini); miniEl = mini;
        let md = { on: false, ox: 0, oy: 0, moved: false };
        mini.addEventListener('mousedown', e => { md.on = true; md.moved = false; const r = mini.getBoundingClientRect(); md.ox = e.clientX - r.left; md.oy = e.clientY - r.top; mini.style.bottom = 'auto'; mini.style.transform = 'none'; mini.style.left = r.left + 'px'; mini.style.top = r.top + 'px'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (!md.on) return; md.moved = true; mini.style.left = (e.clientX - md.ox) + 'px'; mini.style.top = (e.clientY - md.oy) + 'px'; });
        document.addEventListener('mouseup', () => { if (md.on && !md.moved) restorePanel(); md.on = false; });
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════
    function renderCurrent() {
        if (!panelEl || !panelOpen || panelMini) return;
        const content = panelEl.querySelector('#fcm-content'); if (!content) return;
        const inARoom = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData);
        panelEl.querySelectorAll('.fcm-tab[data-tab="room"]').forEach(rt => {
            rt.classList.toggle('fcm-tab-disabled', !inARoom);
            rt.title = inARoom ? '' : T('notInRoom');
        });
        const scrollEl = content.querySelector('.fcm-scroll');
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
        const _myToken = ++_renderToken;
        let p;
        if (uiTab === 'friends') p = renderFriends(content, _myToken);
        else if (uiTab === 'people') p = renderPeople(content, _myToken);
        else if (uiTab === 'room') p = renderRoom(content);
        else if (uiTab === 'roomSearch') p = Promise.resolve(renderRoomSearch(content));
        else if (uiTab === 'help') p = Promise.resolve(renderHelp(content));
        else p = Promise.resolve(renderSettings(content));
        (p || Promise.resolve()).then(() => {
            if (_myToken !== _renderToken) return;
            if (savedScroll > 0) { const ns = content.querySelector('.fcm-scroll'); if (ns) ns.scrollTop = savedScroll; }
        }).catch(e => console.warn('🐈‍⬛ [FCM] render:', e));
    }

    function applyFilters(f) {
        const online = isOnline(f.mn);
        const anyOnline = filters.online || filters.offline;
        if (anyOnline) { if (filters.online && !filters.offline && !online) return false; if (filters.offline && !filters.online && online) return false; }
        const anyRel = filters.owner || filters.lover || filters.sub || filters.friend || filters.whitelist || filters.blacklist;
        if (anyRel) {
            const roles = getAllRels(f.mn);
            const match = (filters.owner && roles.includes('owner')) || (filters.lover && roles.includes('lover')) || (filters.sub && roles.includes('sub'))
            || (filters.friend && (roles.includes('friend') || roles.includes('contact')))
            || (filters.whitelist && roles.includes('whitelist')) || (filters.blacklist && roles.includes('blacklist'));
            if (!match) return false;
        }
        return true;
    }
    function isOnline(mn) { mn = parseInt(mn); return !!(ChatRoomCharacter && ChatRoomCharacter.some(c => c.MemberNumber === mn)) || !!(onlineFriends.find(f => f.MemberNumber === mn)); }

    function makeSortSel(currentMode, options, onChange) {
        const lbl = document.createElement('span'); lbl.className = 'fcm-lbl-sm'; lbl.textContent = T('sortBy') + ':';
        const sel = document.createElement('select'); sel.className = 'fcm-sel';
        options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === currentMode) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => onChange(sel.value));
        return { lbl, sel };
    }

    function makeCountBar(n, total) {
        const d = document.createElement('div'); d.className = 'fcm-count';
        d.textContent = total !== undefined ? T('peopleTotal', n, total) : T('total', n);
        return d;
    }

    async function _autoQueueVisible(mns) {
        const selfMn = parseInt(Player?.MemberNumber);
        await PDB.batchGet(mns);
        let queued = 0;
        for (const mn of mns) {
            if (mn === selfMn) continue;
            const snap = Snapshot._cache[mn];
            if (snap && snap.length > 800) continue;
            if (inRoomFn(mn)) continue;
            const profile = _pc[mn];
            if (!profile || !profile.characterBundle) continue;
            if (_avQueue.some(q => q.mn === mn)) continue;
            _avQueue.push({ mn, profile, onDone: url => {
                if (!url) return;
                const el = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
            }});
            queued++;
        }
        if (queued > 0) { if (!_avBusy) _processAvQueue(); }
    }

    async function refreshSnapshotsForList(mns) {
        const selfMn = parseInt(Player?.MemberNumber);
        const toProcess = mns.filter(mn => mn !== selfMn);
        await PDB.batchGet(toProcess);
        let liveCount = 0, queueCount = 0, noBundle = 0;
        for (const mn of toProcess) {
            delete Snapshot._cache[mn];
            if (Snapshot.db) { try { Snapshot.db.transaction('avatars','readwrite').objectStore('avatars').delete(mn); } catch {} }
            const qi = _avQueue.findIndex(q => q.mn === mn);
            if (qi >= 0) _avQueue.splice(qi, 1);
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
            if (C) { _captureSnapshotDelayed(C); liveCount++; continue; }
            const profile = _pc[mn];
            if (!profile || !profile.characterBundle) { noBundle++; continue; }
            _avQueue.push({ mn, profile, onDone: url => {
                if (!url) return;
                const el = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
            }});
            queueCount++;
        }
        if (!_avBusy && _avQueue.length > 0) _processAvQueue();
    }

    // ═══════════════════════════════════════════════════════════
    //  WHISPER AVATAR  (v1.3.5 — drawn on BC canvas)
    //  Position: left of InputChat, in BC coordinate space 2000×1000
    //  Avatar box size: 80×80 BC units, anchored at (1000-80, 1000-80) = (920, 920)
    //  We compute the exact BC canvas pixel by reading the canvas element transform.
    // ═══════════════════════════════════════════════════════════
    let _wavLastMN = null;        // last rendered MN
    let _wavImageCache = null;    // offscreen Image/canvas to blit
    let _wavImageMN   = null;

    function _removeWhisperAvatar() {
        _wavLastMN = null;
        _wavImageCache = null;
        _wavImageMN   = null;
    }

    // Build an offscreen 80×80 px image from live canvas / snapshot / initials
    async function _buildWavImage(mn) {
        mn = parseInt(mn);
        const SZ = 80;

        // 1. Live canvas face crop
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C && C.Canvas && C.Canvas.width > 0) {
            try {
                const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
                const ctx = cv.getContext('2d'), src = C.Canvas;
                ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, SZ, SZ);
                return cv;
            } catch {}
        }

        // 2. Snapshot DB
        const snap = Snapshot._cache[mn] || await Snapshot.get(mn);
        if (snap && snap.length > 800) {
            return new Promise(res => {
                const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = snap;
            });
        }

        // 3. Initials fallback — draw onto offscreen canvas
        const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#201838'; ctx.fillRect(0, 0, SZ, SZ);
        ctx.strokeStyle = '#7060a0'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, SZ-2, SZ-2);
        const name = getDisplayName(mn);
        ctx.fillStyle = '#a080c8'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name.trim().slice(0, 2).toUpperCase() || '?', SZ/2, SZ/2);
        return cv;
    }

    // Draw whisper avatar onto BC's main canvas.
    // BC canvas is 2000×1000 in logical units; the <canvas> element is scaled by CSS.
    // We place the box just to the left of the InputChat area, bottom of screen.
    // Logical position: x = 1000 - BOX_W - margin, y = 1000 - BOX_H - margin
    function _drawWavOnCanvas() {
        if (!cfg.whisperAvatar || !_wavImageCache) return;
        try {
            // Get BC's main canvas element
            const cvEl = document.getElementById('MainCanvas') || document.querySelector('canvas');
            if (!cvEl) return;
            const ctx = cvEl.getContext('2d');
            if (!ctx) return;

            // BC logical → pixel scale
            const scaleX = cvEl.width  / 2000;
            const scaleY = cvEl.height / 1000;

            const BOX  = 80;  // logical units
            const MRGN = 10;
            // Place bottom-left of viewport (to the left of InputChat which is roughly x=1000..2000 bottom area)
            const lx = 1000 - BOX - MRGN;
            const ly = 1000 - BOX - MRGN;
            const px = lx * scaleX;
            const py = ly * scaleY;
            const pw = BOX * scaleX;
            const ph = BOX * scaleY;

            ctx.save();

            // Background
            ctx.fillStyle = 'rgba(20,10,40,0.88)';
            const r = 8 * Math.min(scaleX, scaleY);
            _roundRect(ctx, px - 4*scaleX, py - 20*scaleY, pw + 8*scaleX, ph + 24*scaleY, r);
            ctx.fill();

            // Border
            ctx.strokeStyle = '#7060c0';
            ctx.lineWidth = 1.5;
            _roundRect(ctx, px - 4*scaleX, py - 20*scaleY, pw + 8*scaleX, ph + 24*scaleY, r);
            ctx.stroke();

            // Avatar image
            ctx.drawImage(_wavImageCache, px, py, pw, ph);

            // Name label
            const name = getDisplayName(_wavLastMN);
            const fontSize = Math.max(10, Math.round(11 * Math.min(scaleX, scaleY) * 2));
            ctx.fillStyle = '#d0a8f0';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelX = px + pw / 2;
            const labelY = py - 11 * scaleY;
            ctx.fillText(name.length > 10 ? name.slice(0, 9) + '…' : name, labelX, labelY);

            ctx.restore();
        } catch (e) { /* silent */ }
    }

    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function _updateWhisperAvatar() {
        if (!cfg.whisperAvatar) { _removeWhisperAvatar(); return; }
        const mn = _getWhisperTargetMN();
        if (!mn) { _removeWhisperAvatar(); return; }
        if (_wavLastMN === mn) return; // same target, image still valid
        _wavLastMN = mn;
        _wavImageCache = null;
        _wavImageMN = mn;
        _buildWavImage(mn).then(img => {
            if (_wavImageMN === mn) _wavImageCache = img; // only store if still same target
        });
    }

    // ═══════════════════════════════════════════════════════════
    //  OOC PROTECTION
    // ═══════════════════════════════════════════════════════════
    function _isWhisperMode() {
        try {
            if (typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0) return true;
            const el = document.getElementById('InputChat');
            if (el && /^\/(w|whisper|beep)\s/i.test(el.value)) return true;
        } catch {}
        return false;
    }

    function _flashOocBlocked() {
        const el = document.getElementById('InputChat');
        if (!el) return;
        el.classList.remove('fcm-ooc-blocked');
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add('fcm-ooc-blocked');
        setTimeout(() => el.classList.remove('fcm-ooc-blocked'), 1000);
    }

    const _oocKeyHandler = (e) => {
        if (!cfg.oocProtect) return;
        if (e.key === 'Enter' && e.ctrlKey) {
            if (_isWhisperMode()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                _flashOocBlocked();
            }
        }
    };

    function _installOocProtect() {
        document.removeEventListener('keydown', _oocKeyHandler, true);
        document.addEventListener('keydown', _oocKeyHandler, true);
    }
    function _uninstallOocProtect() {
        document.removeEventListener('keydown', _oocKeyHandler, true);
    }

    // ═══════════════════════════════════════════════════════════
    //  FRIENDS TAB
    // ═══════════════════════════════════════════════════════════
    async function renderFriends(container, _myToken) {
        container.innerHTML = '';
        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

        const { wrap: sw, inp: searchInp } = makeSearchWrap(searchQ, T('search'), val => {
            searchQ = val;
        }, 'fcm-search', () => renderCurrent());

        searchInp.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') renderCurrent();
        });
        toolbar.appendChild(sw);
        const fl = document.createElement('span'); fl.className = 'fcm-lbl-sm'; fl.textContent = T('showOnly') + ':';
        toolbar.appendChild(fl);
        [['online', T('fOnline')], ['offline', T('fOffline')], ['owner', T('fOwner')], ['lover', T('fLover')], ['sub', T('fSub')], ['friend', T('fFriend')], ['whitelist', T('fWhitelist')], ['blacklist', T('fBlacklist')]].forEach(([key, label]) => {
            const b = document.createElement('button'); b.className = 'fcm-ftog' + (filters[key] ? ' on' : ''); b.textContent = label;
            b.addEventListener('click', () => { filters[key] = !filters[key]; b.classList.toggle('on', filters[key]); renderCurrent(); });
            toolbar.appendChild(b);
        });

        toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const nickBtn = document.createElement('button'); nickBtn.className = 'fcm-nick-tog'; nickBtn.textContent = showNickname ? T('togNick') : T('togName');
        nickBtn.title = isZh() ? (showNickname ? '切換為BC名稱' : '切換為暱稱') : (showNickname ? 'Switch to BC name' : 'Switch to nickname');
        nickBtn.addEventListener('click', () => { showNickname = !showNickname; renderCurrent(); });
        toolbar.appendChild(nickBtn);
        const { lbl: sl, sel: sortSel } = makeSortSel(sortMode, [['rel', T('sortRel')], ['id', T('sortId')], ['name', T('sortName')], ['added', T('sortAdded')]], v => { sortMode = v; renderCurrent(); });
        toolbar.appendChild(sl); toolbar.appendChild(sortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => renderCurrent());
        rBtn.title = isZh() ? '重新整理' : 'Refresh'; rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtn);
        const avBtn = mkBtn('📸', 'fcm-btn', () => { const curMns = friends.map(f => f.mn); refreshSnapshotsForList(curMns); });
        avBtn.title = isZh() ? '快照目前名單（強制重建頭像）' : 'Snapshot current list (force rebuild)';
        avBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(avBtn);
        container.appendChild(toolbar);

        let friends = buildFriendList();
        if (searchQ.trim()) { const q = searchQ.trim().toLowerCase();
                             friends = friends.filter(f => {
                                 const nick = _pc[f.mn]?.lastNick || '';
                                 return f.name.toLowerCase().includes(q)
                                 || nick.toLowerCase().includes(q)
                                 || String(f.mn).includes(q);
                             });
                            }
        friends = friends.filter(applyFilters);
        switch (sortMode) {
            case 'id':    friends.sort((a, b) => a.mn - b.mn); break;
            case 'name':  friends.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'added': friends.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
            default:      friends.sort((a, b) => { const d = REL_ORDER[a.rel] - REL_ORDER[b.rel]; return d || a.name.localeCompare(b.name); });
        }
        await PDB.batchGet(friends.map(f => f.mn));
        if (_myToken !== _renderToken) return;
        friends.forEach(f => { f.name = getDisplayName(f.mn); });

        const inARoom = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData), isAdmin = inARoom && amAdmin();

        const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
        const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';

        if (!friends.length) {
            const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('noFriends');
            scroll.appendChild(em); wrapper.appendChild(scroll); wrapper.appendChild(makeCountBar(0)); container.appendChild(wrapper); return;
        }

        const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
        const thRow = document.createElement('tr');
        [['', 'width:42px'], [T('colName'), 'min-width:120px', 'fcm-th-left'], [T('colId'), ''], [T('colRel'), ''], [T('colZone'), ''], [T('colRoom'), 'min-width:100px'], [T('colOps'), 'min-width:150px']].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        if (inARoom) { const th = document.createElement('th'); th.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); th.className = (isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'); th.style.cssText = 'min-width:140px;max-width:155px;width:150px;'; thRow.appendChild(th); }
        const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');

        for (const f of friends) {
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const online = isOnline(f.mn), zone = getZone(f.mn), isInRoom = inRoomFn(f.mn);
            const snapshotUrl = Snapshot._cache[f.mn] || null;

            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(f.mn, snapshotUrl)); tr.appendChild(avTd);
            const nameTd = document.createElement('td');
            const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = f.name; nd.title = f.name;
            const sd = document.createElement('div'); sd.className = 'fcm-sta ' + (online ? 'fcm-online' : 'fcm-offline'); sd.textContent = online ? T('online') : T('offline');
            nameTd.appendChild(nd); nameTd.appendChild(sd); tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(f.mn));
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.style.minWidth = '60px'; relTd.appendChild(makeRelEl(getAllRels(f.mn))); tr.appendChild(relTd);
            const zt = document.createElement('td'); zt.style.textAlign = 'center';
            const zs = document.createElement('span'); zs.className = 'fcm-zone';
            const riZone = getRoomInfo(f.mn);
            const hideZone = !online || (online && riZone === null) || (riZone && !riZone.name && riZone.isPrivate);
            zs.textContent = hideZone ? '—' : (zone || T('zoneUnk')); zt.appendChild(zs); tr.appendChild(zt);
            const ri = getRoomInfo(f.mn);
            const rt = document.createElement('td');
            function _buildRoomLink(ri2, mc, ml) {
                const rcStr = mc !== null ? `${ri2.name}(${mc}/${ml ?? '?'})` : ri2.name;
                const roomFull = mc !== null && ml !== null && mc >= ml;
                const rl = document.createElement('span'); rl.className = 'fcm-room-link';
                rl.textContent = rcStr;
                rl.title = (ri2.isPrivate ? (isZh() ? '[私人] ' : '[Private] ') : '') + rcStr + (roomFull ? ('\n' + (isZh() ? '⚠ 房間已滿' : '⚠ Full')) : ('\n' + (isZh() ? '前往此房間？' : 'Go to room?')));
                if (!roomFull) rl.addEventListener('click', () => navigateToRoom(ri2.name)); else rl.style.color = '#808080';
                if (ri2.isPrivate) { const b2 = document.createElement('span'); b2.style.cssText = 'font-size:10px;color:#c090f0;margin-left:2px;'; b2.textContent = isZh() ? '(私人)' : '(Priv)'; rl.appendChild(b2); }
                return rl;
            }
            if (ri && ri.name) {
                let mc = null, ml = null;
                if (ri.isCurrent && typeof ChatRoomCharacter !== 'undefined') { mc = ChatRoomCharacter.length; ml = ChatRoomData?.MemberLimit ?? null; }
                else { const cd = getCachedRoomInfo(ri.name); if (cd) { mc = cd.MemberCount; ml = cd.MemberLimit; } }
                rt.appendChild(_buildRoomLink(ri, mc, ml));
                if (!ri.isCurrent && mc === null) {
                    const friendSpace = onlineFriends.find(ff => ff.MemberNumber === f.mn)?.ChatRoomSpace;
                    queryRoomInfo(ri.name, friendSpace, data => { if (data && rt.isConnected) { rt.innerHTML = ''; rt.appendChild(_buildRoomLink(ri, data.MemberCount, data.MemberLimit)); } });
                }
            } else if (ri && !ri.name && ri.isPrivate) {
                const sp = document.createElement('span'); sp.style.cssText = 'font-size:11px;color:#c090f0;font-weight:600;';
                sp.textContent = isZh() ? '(私密)' : '(Private)'; rt.appendChild(sp);
            } else { rt.innerHTML = '<span class="fcm-room">—</span>'; }
            tr.appendChild(rt);

            const opsTd = document.createElement('td');
            opsTd.appendChild(buildPersonOps(f.mn, { isInRoom, oneSided: false }));
            tr.appendChild(opsTd);

            if (inARoom) {
                const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin ? '' : ' no-perm');
                const mb = buildMgmtBtns(f.mn, 'friends'); if (mb) mgmtTd.appendChild(mb); tr.appendChild(mgmtTd);
            }
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        wrapper.appendChild(scroll);
        wrapper.appendChild(makeCountBar(friends.length));
        container.appendChild(wrapper);

        if (cfg.avatars) _autoQueueVisible(friends.map(f => f.mn));
    }

    // ═══════════════════════════════════════════════════════════
    //  PEOPLE TAB
    // ═══════════════════════════════════════════════════════════
    const PEOPLE_PAGE_SIZE = 100;
    let _peoplePage = 0;

    async function renderPeople(container, _myToken) {
        container.innerHTML = '';
        if (!PDB.db) {
            const em = document.createElement('div'); em.className = 'fcm-empty';
            em.textContent = isZh() ? '資料庫未連線，請確認儲存模式已設定' : 'DB not connected — set a save mode in Settings';
            container.appendChild(em); return;
        }

        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';
        const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:180px;max-width:320px;';
        const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.style.width = '100%';
        inp.placeholder = T('peopleSearchPlaceholder'); inp.value = _peopleQ;
        const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
        clrX.addEventListener('click', () => { inp.value = ''; _peopleQ = ''; _peoplePage = 0; runSearch(''); });
        sw.appendChild(inp); sw.appendChild(clrX); toolbar.appendChild(sw);

        const srchBtn = mkBtn(isZh() ? '搜尋' : 'Search', 'fcm-btn', () => { _peoplePage = 0; runSearch(inp.value); });
        srchBtn.style.cssText = 'padding:5px 12px;font-size:12px;flex-shrink:0;';
        toolbar.appendChild(srchBtn);
        toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const rBtn = mkBtn('↻', 'fcm-btn', () => { _peoplePage = 0; runSearch(inp.value); });
        rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtn);
        container.appendChild(toolbar);

        const hint = document.createElement('div'); hint.className = 'fcm-people-hint'; hint.textContent = T('peopleSearchHint');
        container.appendChild(hint);

        const allProfiles = await new Promise(res => {
            if (!PDB.db) return res([]);
            const req = PDB.db.transaction('profiles', 'readonly').objectStore('profiles').getAll();
            req.onsuccess = () => res(req.result || []);
            req.onerror = () => res([]);
        });
        if (_myToken !== _renderToken) return;
        allProfiles.sort((a, b) => (b.seen || b.savedAt || 0) - (a.seen || a.savedAt || 0));

        const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
        const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';
        const countBar = document.createElement('div'); countBar.className = 'fcm-count';
        const pageBar = document.createElement('div');
        pageBar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 12px;background:#1a1230;border-top:1px solid #2a2048;flex-shrink:0;';
        wrapper.appendChild(scroll); wrapper.appendChild(countBar); wrapper.appendChild(pageBar);
        container.appendChild(wrapper);

        async function runSearch(q) {
            _peopleQ = q; q = q.trim();
            scroll.innerHTML = ''; pageBar.innerHTML = '';
            const isNumId = /^\d+$/.test(q) && parseInt(q) > 0;
            const qLow = q.toLowerCase();
            let filtered = q
            ? allProfiles.filter(p => (p.name || '').toLowerCase().includes(qLow) || (p.lastNick || '').toLowerCase().includes(qLow) || String(p.memberNumber).includes(q))
            : allProfiles;
            if (isNumId) {
                const mn = parseInt(q);
                const exactMatch = allProfiles.find(p => p.memberNumber === mn);
                if (!exactMatch) {
                    const box = document.createElement('div'); box.className = 'fcm-unknown-id-box';
                    const boxTitle = document.createElement('div'); boxTitle.className = 'fcm-unknown-id-title';
                    boxTitle.textContent = T('peopleUnknownId', mn);
                    box.appendChild(boxTitle);
                    const allBtns = buildPersonOps(mn, { isInRoom: inRoomFn(mn), oneSided: true });
                    // 如果在房間裡，把房管按鈕直接加到同一個 fcm-btns div
                    if (typeof ChatRoomData !== 'undefined' && ChatRoomData) {
                        const sep = document.createElement('span');
                        sep.style.cssText = 'display:inline-block;width:1px;height:14px;background:#3a2870;margin:0 6px;vertical-align:middle;';
                        allBtns.appendChild(sep);
                        const boxMgmtWrap = document.createElement('div');
                        boxMgmtWrap.className = 'fcm-td-mgmt' + (amAdmin() ? '' : ' no-perm');
                        boxMgmtWrap.style.display = 'contents'; // 讓子元素直接流入父 flex
                        const boxMb = buildMgmtBtns(mn, 'people');
                        if (boxMb) {
                            // 把 boxMb 裡的按鈕一個個搬進 allBtns
                            Array.from(boxMb.children).forEach(btn => {
                                if (!amAdmin()) btn.disabled = true;
                                allBtns.appendChild(btn);
                            });
                        }
                    }
                    box.appendChild(allBtns);
                    scroll.appendChild(box);
                    if (filtered.length > 0) {
                        const simLbl = document.createElement('div');
                        simLbl.style.cssText = 'padding:8px 16px 4px;font-size:11px;color:#7060a0;letter-spacing:.5px;';
                        simLbl.textContent = T('peopleSimilarIds'); scroll.appendChild(simLbl);
                    }
                }
            }
            const totalFiltered = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalFiltered / PEOPLE_PAGE_SIZE));
            if (_peoplePage >= totalPages) _peoplePage = totalPages - 1;
            const pageStart = _peoplePage * PEOPLE_PAGE_SIZE;
            const show = filtered.slice(pageStart, pageStart + PEOPLE_PAGE_SIZE);
            countBar.textContent = q
                ? T('peopleTotal', totalFiltered, allProfiles.length)
            : T('peopleTotal', Math.min(allProfiles.length, PEOPLE_PAGE_SIZE * (_peoplePage + 1)), allProfiles.length);
            if (!show.length && !(isNumId && !allProfiles.find(p => p.memberNumber === parseInt(q)))) {
                if (!scroll.querySelector('.fcm-unknown-id-box')) {
                    const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('peopleNoResults');
                    scroll.appendChild(em);
                }
                return;
            }
            await PDB.batchGet(show.map(p => p.memberNumber));
            const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
            const thead = document.createElement('thead');
            const thRow = document.createElement('tr');
            [
                ['', 'width:42px'], [T('colName'), 'min-width:130px', 'fcm-th-left'], [T('colId'), ''],
                [T('colRel'), ''], [T('colOps'), 'min-width:200px'],
                ...((!!(typeof ChatRoomData !== 'undefined' && ChatRoomData)) ? [[T('colMgmt'), 'min-width:130px']] : []),
                [T('colSeen'), 'min-width:80px'], [T('colShare'), 'min-width:60px'],
            ].forEach(([text, style, cls]) => {
                const th = document.createElement('th'); th.textContent = text;
                if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
            });
            thead.appendChild(thRow); tbl.appendChild(thead);
            const tbody = document.createElement('tbody');
            for (const p of show) {
                const mn = p.memberNumber;
                const tr = document.createElement('tr'); tr.className = 'fcm-row';
                const snapshotUrl = Snapshot._cache[mn] || null;
                const bcName   = p.name    || `#${mn}`;
                const nickName = p.lastNick || null;
                const isInRoom = inRoomFn(mn);
                const oneSided = getAllRels(mn).every(r => r === 'none') && !isInRoom && !onlineFriends.some(f => f.MemberNumber === mn);
                const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(mn, snapshotUrl)); tr.appendChild(avTd);
                const nameTd = document.createElement('td');
                const nd = document.createElement('div'); nd.className = 'fcm-name';
                nd.textContent = nickName || bcName; nd.title = nickName || bcName; nameTd.appendChild(nd);
                if (nickName && nickName !== bcName) {
                    const sub = document.createElement('div'); sub.className = 'fcm-id'; sub.textContent = bcName; nameTd.appendChild(sub);
                }
                tr.appendChild(nameTd);
                tr.appendChild(makeIdCell(mn));
                const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(getAllRels(mn))); tr.appendChild(relTd);
                const opsTd = document.createElement('td');
                const freshProf = _pc[mn] || null;
                const hasBundle = !!(freshProf && freshProf.characterBundle);
                const opsWrap = document.createElement('div'); opsWrap.className = 'fcm-btns';
                const vb = mkBtn(T('btnView'), '', () => doView(mn));
                if (!isInRoom && !hasBundle) vb.disabled = true;
                opsWrap.appendChild(vb);
                if (canBeep(mn)) opsWrap.appendChild(mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(mn)));
                const _psep = document.createElement('span'); _psep.style.cssText = 'width:6px;display:inline-block;'; opsWrap.appendChild(_psep);
                const _dname2 = nickName || bcName;
                const osSuffix = oneSided ? '\n\n' + T('peopleOneSidedWarn') : '';
                const _isWhl2 = (Player.WhiteList || []).includes(mn);
                const _isBl2  = (Player.BlackList || []).includes(mn);
                const _isGh2  = (() => { try { return (Player.GhostList || []).includes(mn); } catch { return false; } })();
                if (!isFriendOf(mn)) opsWrap.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green',
                                                               () => showConfirm((isZh() ? `添加「${_dname2}」為好友？` : `Add "${_dname2}" as friend?`) + osSuffix, () => doAddFriend(mn))));
                else opsWrap.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red',
                                               () => showConfirm(T('confirmDel', _dname2), () => doRemoveFriend(mn), isZh() ? '移除' : 'Remove')));
                opsWrap.appendChild(mkBtn(_isWhl2 ? T('btnRmWhite') : T('btnAddWhite'), _isWhl2 ? 'fcm-btn-red' : 'fcm-btn-green',
                                          () => showConfirm(_isWhl2
                                                            ? (isZh() ? `移除「${_dname2}」白名單？` : `Remove "${_dname2}" from whitelist?`)
                                                            : (isZh() ? `將「${_dname2}」加入白名單？` : `Add "${_dname2}" to whitelist?`) + osSuffix,
                                                            () => doToggleList(mn, 'white', !_isWhl2))));
                opsWrap.appendChild(mkBtn(_isBl2 ? T('btnRmBan') : T('btnAddBan'), 'fcm-btn-red',
                                          () => showConfirm(_isBl2
                                                            ? (isZh() ? `移除「${_dname2}」黑名單？` : `Remove "${_dname2}" from blacklist?`)
                                                            : T('confirmAddBan', _dname2) + osSuffix,
                                                            () => doToggleList(mn, 'black', !_isBl2),
                                                            _isBl2 ? undefined : (isZh() ? '加入' : 'Add'))));
                opsWrap.appendChild(mkBtn(_isGh2 ? (isZh() ? '-幽靈' : '-Ghost') : (isZh() ? '+幽靈' : '+Ghost'), _isGh2 ? 'fcm-btn-red' : 'fcm-btn-purple',
                                          () => showConfirm(_isGh2
                                                            ? (isZh() ? `移除「${_dname2}」幽靈？` : `Remove "${_dname2}" from ghost?`)
                                                            : T('confirmAddGhost', _dname2) + osSuffix,
                                                            () => doToggleList(mn, 'ghost', !_isGh2))));
                opsTd.appendChild(opsWrap); tr.appendChild(opsTd);
                // ── Room admin column ─────────────────────────────────────────
                const _inARoom_p = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData);
                if (_inARoom_p) {
                    const _isAdmin_p = amAdmin();
                    const mgmtTd_p = document.createElement('td');
                    mgmtTd_p.className = 'fcm-td-mgmt' + (_isAdmin_p ? '' : ' no-perm');
                    mgmtTd_p.style.maxWidth = '145px';
                    const mb_p = buildMgmtBtns(mn, 'people');
                    if (mb_p) mgmtTd_p.appendChild(mb_p);
                    tr.appendChild(mgmtTd_p);
                }
                const shareTd = document.createElement('td'); shareTd.style.textAlign = 'center';
                if (hasBundle) {
                    const shareBtn = mkBtn(T('btnShare'), 'fcm-btn-purple', () => wpsShareProfile(mn));
                    if (!inRoomFn(parseInt(Player?.MemberNumber)) && !(typeof ChatRoomData !== 'undefined' && ChatRoomData)) {
                        shareBtn.disabled = true;
                        shareBtn.title = isZh() ? '需在聊天室中才能分享' : 'Must be in a chat room to share';
                    }
                    shareTd.appendChild(shareBtn);
                } else {
                    shareTd.innerHTML = '<span style="color:#4a3870;font-size:11px;">—</span>';
                }
                const seenTime = p.seen;
                const seenTd = document.createElement('td'); seenTd.className = 'fcm-id'; seenTd.style.textAlign = 'center';
                seenTd.textContent = seenTime ? new Date(seenTime).toLocaleDateString() : '—'; tr.appendChild(seenTd);
                tr.appendChild(shareTd);
                tbody.appendChild(tr);
            }
            tbl.appendChild(tbody); scroll.appendChild(tbl);
            if (totalPages > 1) {
                const prevBtn = mkBtn('◀', 'fcm-btn', () => { _peoplePage--; runSearch(inp.value); });
                prevBtn.disabled = _peoplePage === 0;
                const nextBtn = mkBtn('▶', 'fcm-btn', () => { _peoplePage++; runSearch(inp.value); });
                nextBtn.disabled = _peoplePage >= totalPages - 1;
                const pageInfo = document.createElement('span');
                pageInfo.style.cssText = 'font-size:11px;color:#9080b8;';
                pageInfo.textContent = isZh() ? `第 ${_peoplePage+1} / ${totalPages} 頁` : `Page ${_peoplePage+1} / ${totalPages}`;
                pageBar.appendChild(prevBtn); pageBar.appendChild(pageInfo); pageBar.appendChild(nextBtn);
                if (totalPages <= 7) {
                    pageBar.innerHTML = ''; pageBar.appendChild(prevBtn);
                    for (let i = 0; i < totalPages; i++) {
                        const pb = mkBtn(String(i+1), i === _peoplePage ? 'fcm-btn fcm-btn-purple' : 'fcm-btn', () => { _peoplePage = parseInt(pb.textContent)-1; runSearch(inp.value); });
                        pageBar.appendChild(pb);
                    }
                    pageBar.appendChild(nextBtn);
                }
            }
        }

        // Bug fix: stopPropagation on people search keydown
        inp.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') { _peoplePage = 0; runSearch(inp.value); }
        });

        await runSearch(_peopleQ);
        inp.focus();
    }

    // ═══════════════════════════════════════════════════════════
    //  ROOM TAB
    // ═══════════════════════════════════════════════════════════
    async function renderRoom(container) {
        container.innerHTML = '';
        if (typeof ChatRoomData === 'undefined' || !ChatRoomData) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('notInRoom'); container.appendChild(em); return; }
        const isAdmin = amAdmin();
        if (!isAdmin) { const w = document.createElement('div'); w.className = 'fcm-warn'; w.textContent = T('noAdminWarn'); container.appendChild(w); }

        const stabs = document.createElement('div'); stabs.className = 'fcm-subtabs';
        ['members', 'admin', 'white', 'ban'].forEach(key => {
            const t = document.createElement('div'); t.className = 'fcm-stab' + (roomSubTab === key ? ' active' : ''); t.textContent = T('roomTabs')[key];
            t.addEventListener('click', () => { roomSubTab = key; renderRoom(container); }); stabs.appendChild(t);
        });
        container.appendChild(stabs);

        const canAddHere = isAdmin && roomSubTab !== 'members';
        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

        function isNumericQ(v) { const mn = parseInt(v); return mn > 0 && String(mn) === v.trim() && v.trim().length > 0; }

        let addBtn;
        const { wrap: sw, inp: rsEl } = makeSearchWrap(roomSearchQ, T('roomSearch'), val => {
            roomSearchQ = val;
            if (addBtn) addBtn.disabled = !(canAddHere && isNumericQ(val));
            clearTimeout(roomSearchDebounce);
            roomSearchDebounce = setTimeout(async () => {
                const pos = roomSearchQ.length;
                await renderRoom(container);
                const ns = container.querySelector('.fcm-room-search');
                const na = container.querySelector('.fcm-add-btn');
                if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch {} }
                if (na) na.disabled = !(canAddHere && isNumericQ(roomSearchQ));
            }, 400);
        }, 'fcm-room-search');
        toolbar.appendChild(sw);

        if (canAddHere) {
            addBtn = mkBtn(T('btnAdd'), 'fcm-btn-green fcm-add-btn', () => {
                const mn = parseInt(roomSearchQ); if (!mn || mn < 100) return;
                if (roomSubTab === 'admin') roomOp(mn, 'makeAdmin');
                else if (roomSubTab === 'white') roomOp(mn, 'addWhite');
                else if (roomSubTab === 'ban') roomOp(mn, 'ban');
                clearTimeout(roomSearchDebounce); rsEl.value = ''; roomSearchQ = ''; addBtn.disabled = true;
            });
            addBtn.title = T('btnAddTitle');
            addBtn.disabled = !isNumericQ(roomSearchQ);
            // Bug fix: stopPropagation on room admin search keydown
            rsEl.addEventListener('keydown', e => {
                e.stopPropagation();
                if (e.key === 'Enter' && !addBtn.disabled) { e.preventDefault(); addBtn.click(); }
            });
            toolbar.appendChild(addBtn);
        }

        toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const rNickBtn = document.createElement('button'); rNickBtn.className = 'fcm-nick-tog'; rNickBtn.textContent = showNickname ? T('togNick') : T('togName');
        rNickBtn.addEventListener('click', () => { showNickname = !showNickname; renderRoom(container); });
        toolbar.appendChild(rNickBtn);
        const { lbl: rsl, sel: rsortSel } = makeSortSel(roomSortMode, [['name', T('sortName')], ['id', T('sortId')], ['rel', T('sortRel')], ['perm', T('permAdmin')]], v => { roomSortMode = v; renderRoom(container); });
        toolbar.appendChild(rsl); toolbar.appendChild(rsortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => renderRoom(container));
        rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtn);
        const avBtnR = mkBtn('📸', 'fcm-btn', () => { refreshSnapshotsForList(mns); });
        avBtnR.title = isZh() ? '快照目前名單（強制重建頭像）' : 'Snapshot current list (force rebuild)';
        avBtnR.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(avBtnR);
        container.appendChild(toolbar);

        let mns = [];
        if (roomSubTab === 'members') mns = (ChatRoomData.Character || []).map(c => c.MemberNumber);
        else if (roomSubTab === 'admin') mns = [...(ChatRoomData.Admin || [])];
        else if (roomSubTab === 'white') mns = [...(ChatRoomData.Whitelist || [])];
        else if (roomSubTab === 'ban')   mns = [...(ChatRoomData.Ban || [])];

        if (roomSearchQ.trim()) { const q = roomSearchQ.trim().toLowerCase(); mns = mns.filter(mn => getDisplayName(mn).toLowerCase().includes(q) || String(mn).includes(q)); }

        switch (roomSortMode) {
            case 'id':   mns.sort((a, b) => a - b); break;
            case 'rel':  mns.sort((a, b) => REL_ORDER[getRel(a)] - REL_ORDER[getRel(b)]); break;
            case 'perm': mns.sort((a, b) => { const pa = getRoomPerms(a), pb = getRoomPerms(b); const ord = ['admin','pass','ban','visit']; return (ord.indexOf(pa[0]) || 0) - (ord.indexOf(pb[0]) || 0); }); break;
            default:     mns.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))); break;
        }

        const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
        const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';

        if (!mns.length) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('noData'); scroll.appendChild(em); wrapper.appendChild(scroll); wrapper.appendChild(makeCountBar(0)); container.appendChild(wrapper); return; }

        await PDB.batchGet(mns);

        const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
        const thRow = document.createElement('tr');
        [['', 'width:42px'], [T('colName'), 'min-width:120px', 'fcm-th-left'], [T('colId'), ''], [T('colRel'), ''], [T('colPerm'), 'min-width:80px'], [T('colOps'), 'min-width:150px']].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        const thMgmt = document.createElement('th'); thMgmt.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); thMgmt.className = isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'; thMgmt.style.cssText = 'min-width:140px;max-width:155px;width:150px;'; thRow.appendChild(thMgmt);
        const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');

        for (const mn of mns) {
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const name = getDisplayName(mn), rel = getRel(mn), perms = getRoomPerms(mn);
            const snapshotUrl = Snapshot._cache[mn] || null;
            const isInRoom = inRoomFn(mn), isMe = mn === Player.MemberNumber;

            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(mn, snapshotUrl)); tr.appendChild(avTd);
            const nameTd = document.createElement('td');
            const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = name; nd.title = name; nameTd.appendChild(nd);
            if (isMe) { const yl = document.createElement('div'); yl.className = 'fcm-you'; yl.textContent = T('youLabel'); nameTd.appendChild(yl); }
            tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(mn));
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(rel)); tr.appendChild(relTd);
            const permTd = document.createElement('td'); const pd = document.createElement('div'); pd.className = 'fcm-perms'; perms.forEach(p => pd.appendChild(makePermEl(p))); permTd.appendChild(pd); tr.appendChild(permTd);

            const opsTd = document.createElement('td');
            opsTd.appendChild(buildPersonOps(mn, { isInRoom, isMe }));
            tr.appendChild(opsTd);

            const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin && !isMe ? '' : ' no-perm');
            if (!isMe) { const mb = buildMgmtBtns(mn, roomSubTab); if (mb) mgmtTd.appendChild(mb); }
            tr.appendChild(mgmtTd);
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        wrapper.appendChild(scroll);
        wrapper.appendChild(makeCountBar(mns.length));
        container.appendChild(wrapper);

        if (cfg.avatars) _autoQueueVisible(mns);
    }

    // ─── Export / Import ───────────────────────────────────────────────
    async function exportProfiles() {
        try {
            const allProfiles = await new Promise((res, rej) => {
                const req = PDB.db.transaction('profiles','readonly').objectStore('profiles').getAll();
                req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
            });
            let notes = [];
            try { if (PDB.db.objectStoreNames.contains('notes')) { notes = await new Promise((res,rej) => { const req = PDB.db.transaction('notes','readonly').objectStore('notes').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); } } catch {}
            const data = { exportedAt: new Date().toISOString(), dbVersion: PDB.db.version, profiles: allProfiles, notes };
            const today = new Date(); const ymd = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bce-past-profiles-${ymd}.json`; a.click(); URL.revokeObjectURL(a.href);
            return allProfiles.length;
        } catch(e) { console.error('🐈‍⬛ [FCM] export error:', e); return 0; }
    }

    async function importProfiles(file) {
        try {
            const data = JSON.parse(await file.text());
            let pc = 0, nc = 0;
            if (Array.isArray(data.profiles) && PDB.db) {
                const tx = PDB.db.transaction('profiles','readwrite'); const store = tx.objectStore('profiles');
                for (const p of data.profiles) {
                    delete p.avatarDataUrl;
                    const existing = await new Promise(res => { const r = store.get(p.memberNumber); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
                    const existSeen = existing?.seen || existing?.savedAt || 0;
                    const newSeen = p.seen || p.savedAt || 0;
                    if (!existing || newSeen >= existSeen) { store.put(p); _pc[p.memberNumber] = p; pc++; }
                }
            }
            if (Array.isArray(data.notes) && PDB.db && PDB.db.objectStoreNames.contains('notes')) {
                const tx2 = PDB.db.transaction('notes','readwrite'); const store2 = tx2.objectStore('notes');
                for (const n of data.notes) { store2.put(n); nc++; }
            }
            return { pc, nc };
        } catch(e) { console.error('🐈‍⬛ [FCM] import error:', e); return { pc:0, nc:0 }; }
    }

    // ─── Room Search ───────────────────────────────────────────────────
    async function renderRoomSearch(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

        const tb = document.createElement('div'); tb.className = 'fcm-toolbar';
        // (left refresh button removed in v1.3.5 — right side already has one)

        const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:120px;max-width:200px;';
        const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.placeholder = T('roomSearch2'); inp.value = _roomSearchQ2; inp.style.width = '100%';
        const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
        clrX.addEventListener('click', () => { inp.value = ''; _roomSearchQ2 = ''; });
        sw.appendChild(inp); sw.appendChild(clrX); tb.appendChild(sw);

        const srchBtn = mkBtn(T('roomSearchBtn'), 'fcm-btn', () => runSearch());
        srchBtn.style.cssText = 'padding:5px 10px;border-radius:8px;border:1.5px solid #4038a0;background:#1e1635;color:#b098d0;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;';
        tb.appendChild(srchBtn);

        const zoneColors = {
            'X': { bg: '#1e1635', active: '#2e2650', label: isZh() ? '混合' : 'Mixed' },
            '':  { bg: '#2a1020', active: '#7a2040', label: isZh() ? '女性' : 'Female' },
            'M': { bg: '#101828', active: '#1a4070', label: isZh() ? '男性' : 'Male' }
        };
        const zoneGroup = document.createElement('div'); zoneGroup.style.cssText = 'display:flex;gap:3px;';
        Object.entries(zoneColors).forEach(([z, info]) => {
            const b = document.createElement('button'); b.setAttribute('data-space', z); b.textContent = info.label;
            const isActive = _roomZoneFilter === z;
            b.style.cssText = `padding:5px 10px;border-radius:8px;border:1.5px solid ${isActive ? '#d0b8ff' : '#4038a0'};background:${isActive ? info.active : info.bg};color:${isActive ? '#fff' : '#9070b0'};font-size:12px;font-weight:${isActive ? '700' : '400'};cursor:pointer;white-space:nowrap;`;
            b.addEventListener('click', () => {
                _roomZoneFilter = z;
                zoneGroup.querySelectorAll('[data-space]').forEach(x => {
                    const xz = x.getAttribute('data-space'), xi = zoneColors[xz], xa = xz === z;
                    x.style.background = xa ? xi.active : xi.bg; x.style.borderColor = xa ? '#d0b8ff' : '#4038a0';
                    x.style.color = xa ? '#fff' : '#9070b0'; x.style.fontWeight = xa ? '700' : '400';
                });
                runSearch();
            });
            zoneGroup.appendChild(b);
        });
        tb.appendChild(zoneGroup);
        tb.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const sLbl = document.createElement('span'); sLbl.className = 'fcm-lbl-sm'; sLbl.textContent = T('sortBy') + ':'; tb.appendChild(sLbl);
        const sortSel = document.createElement('select'); sortSel.className = 'fcm-sel';
        [['fav', isZh() ? '最愛優先' : 'Fav First'], ['friend', isZh() ? '好友優先' : 'Friends First'], ['name', isZh() ? '名稱優先' : 'Name']].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === _roomSortMode) o.selected = true; sortSel.appendChild(o);
        });
        sortSel.addEventListener('change', () => { _roomSortMode = sortSel.value; renderResults(); });
        tb.appendChild(sortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => runSearch());
        rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        tb.appendChild(rBtn);
        wrap.appendChild(tb);

        const scroll = document.createElement('div'); scroll.style.cssText = 'flex:1;overflow-y:auto;';
        const countEl = document.createElement('div'); countEl.className = 'fcm-count'; countEl.style.textAlign = 'center';
        wrap.appendChild(scroll); wrap.appendChild(countEl);
        container.appendChild(wrap);

        // Bug fix: stopPropagation on room search input
        inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') runSearch(); });

        async function runSearch() {
            _roomSearchQ2 = inp.value;
            srchBtn.textContent = T('roomSearching'); srchBtn.disabled = true;
            _roomResults = await doRoomSearch(_roomSearchQ2, _roomZoneFilter);
            srchBtn.textContent = T('roomSearchBtn'); srchBtn.disabled = false;
            renderResults();
        }

        function renderResults() {
            scroll.innerHTML = '';
            const currentRoomName = (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : null;
            let list = [..._roomResults].sort((a, b) => {
                const aF = _favRooms.has(a.Name) ? 1 : 0, bF = _favRooms.has(b.Name) ? 1 : 0;
                const aFr = onlineFriends.filter(f => f.ChatRoomName === a.Name).length;
                const bFr = onlineFriends.filter(f => f.ChatRoomName === b.Name).length;
                if (_roomSortMode === 'fav') return bF - aF || bFr - aFr || (a.Name||'').localeCompare(b.Name||'');
                if (_roomSortMode === 'friend') return bFr - aFr || bF - aF || (a.Name||'').localeCompare(b.Name||'');
                return (a.Name||'').localeCompare(b.Name||'');
            });
            if (!list.length) {
                const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('roomSearchEmpty');
                scroll.appendChild(em); countEl.textContent = T('totalRooms', 0); return;
            }
            countEl.textContent = T('totalRooms', list.length);
            list.forEach(room => {
                const isFav = _favRooms.has(room.Name);
                const isCurrent = !!(currentRoomName && room.Name === currentRoomName);
                const friendsHere = onlineFriends.filter(f => f.ChatRoomName === room.Name);
                const mc = room.MemberCount ?? room.NbMember ?? null;
                const ml = room.MemberLimit ?? room.Limit ?? null;
                const cStr = mc !== null ? `(${mc}${ml !== null ? '/'+ml : ''})` : '';
                const card = document.createElement('div');
                // Priority: current room (pink) > fav (gold) > friends (green) > default
                let cardBorder;
                if (isCurrent) {
                    cardBorder = 'border:2px solid #e060a0;border-radius:8px;margin:3px 4px;background:rgba(220,80,140,.08);';
                } else if (isFav) {
                    cardBorder = 'border:1.5px solid #c8a020;border-radius:8px;margin:3px 4px;background:rgba(200,160,32,.06);';
                } else if (friendsHere.length > 0) {
                    cardBorder = 'border:1.5px solid #409060;border-radius:8px;margin:3px 4px;background:rgba(40,128,64,.06);';
                } else {
                    cardBorder = 'border-bottom:1px solid #2a2048;';
                }
                card.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;transition:background .1s;${cardBorder}`;
                card.addEventListener('mouseenter', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = '#261a4a'; });
                card.addEventListener('mouseleave', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = ''; });
                const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
                const line1 = document.createElement('div'); line1.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';
                const favBtn = document.createElement('button');
                favBtn.style.cssText = 'font-size:15px;padding:0 3px;border:none;background:transparent;cursor:pointer;color:' + (isFav ? '#f0d060' : '#5040a0') + ';flex-shrink:0;';
                favBtn.textContent = isFav ? '★' : '☆';
                favBtn.addEventListener('click', e => { e.stopPropagation(); if (_favRooms.has(room.Name)) _favRooms.delete(room.Name); else _favRooms.add(room.Name); saveFavRooms(); renderResults(); });
                line1.appendChild(favBtn);
                const nm = document.createElement('span'); nm.style.cssText = 'color:#e8c8ff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;'; nm.textContent = room.Name || '?'; nm.title = room.Name; line1.appendChild(nm);
                if (room.Private) { const priv = document.createElement('span'); priv.style.cssText = 'font-size:11px;background:#2a1048;border:1px solid #8060b0;color:#c090f0;border-radius:6px;padding:2px 7px;flex-shrink:0;'; priv.textContent = T('roomPrivateLabel'); line1.appendChild(priv); }
                if (room.Creator) { const cr = document.createElement('span'); cr.style.cssText = 'font-size:14px;color:#e8c8ff;font-weight:700;flex-shrink:0;'; cr.textContent = '- ' + room.Creator; line1.appendChild(cr); }                if (cStr) { const cnt = document.createElement('span'); cnt.style.cssText = 'color:#9878b8;font-size:12px;flex-shrink:0;'; cnt.textContent = cStr; line1.appendChild(cnt); }
                if (isCurrent) { const hereBadge = document.createElement('span'); hereBadge.style.cssText = 'font-size:11px;background:#3a0828;border:1px solid #e060a0;color:#ff90c0;border-radius:6px;padding:2px 7px;flex-shrink:0;font-weight:700;'; hereBadge.textContent = isZh() ? '🏠 你' : '🏠 You'; line1.appendChild(hereBadge); }
                if (friendsHere.length > 0) { const fb = document.createElement('span'); fb.style.cssText = 'font-size:11px;background:#102038;border:1px solid #4080d8;color:#80c8ff;border-radius:6px;padding:2px 7px;flex-shrink:0;'; fb.textContent = `👥${friendsHere.length}: ${friendsHere.map(f => f.MemberName||'#'+f.MemberNumber).join(', ')}`; line1.appendChild(fb); }
                info.appendChild(line1);
                if (room.Description) { const desc = document.createElement('div'); desc.style.cssText = 'color:#7060a0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;'; desc.textContent = room.Description; info.appendChild(desc); }
                card.appendChild(info);
                // Join/Re-enter button
                const joinLabel = isCurrent ? (isZh() ? '重新進入' : 'Re-enter') : T('roomJoin');
                const joinCls   = isCurrent ? 'fcm-btn-orange' : 'fcm-btn-blue';
                const joinBtn = mkBtn(joinLabel, joinCls, () => {
                    if (isCurrent) {
                        const msg = isZh()
                        ? `你已經在「${room.Name}」中了。\n確定要重新進入嗎？`
                        : `You are already in "${room.Name}".\nRe-enter the room?`;
                        showConfirm(msg, () => navigateToRoom(room.Name), isZh() ? '重新進入' : 'Re-enter');
                    } else {
                        navigateToRoom(room.Name);
                    }
                });
                joinBtn.style.cssText += ';padding:7px 16px;font-size:13px;font-weight:700;flex-shrink:0;';
                card.appendChild(joinBtn);
                scroll.appendChild(card);
            });
        }

        if (_roomResults.length === 0) runSearch(); else renderResults();
    }
    function renderHelp(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:0;height:100%;';
        const zh = isZh();
        const sections = zh ? [
            { icon: '🎛', title: 'FCM 是什麼？',
             body: 'FCM（Friends & Chatroom Manager）是一個好友與聊天室管理工具，讓你在同一面板中查看好友狀態、管理房間成員、搜尋房間，以及查詢曾遇過的角色。' },
            { icon: '⚙', title: '部分功能需在「設定」頁面手動啟用',
             items: [
                 '【顯示頭像】— 預設關閉。啟用後在各列表顯示角色頭像（需曾同房或擁有完整資料）。',
                 '【私聊時顯示對象頭像】— 進入悄悄話 / BEEP 模式時，在畫面左下角顯示對象頭像。僅在聊天室主畫面顯示，查看角色資料、衣櫃等覆蓋畫面時自動隱藏。',
                 '【儲存模式】— 預設「不儲存」。建議至少選「僅名稱」，否則離線好友將無法顯示名稱，人員查詢頁也沒有資料。',
                 '【私聊 / BEEP 輸入框提示色】— 輸入 /w 或進入悄悄話模式時，輸入框顯示顏色邊框。',
                 '【OOC 保護】— 悄悄話模式下封鎖 Ctrl+Enter，防止 OOC 內容被誤發為普通對話。',
                 '【幽靈名單隱身】— 幽靈名單中的角色在聊天室不顯示身體（只對自己有效）。',
             ]},
            { icon: '👥', title: '好友關係顯示「單向好友」是正常的',
             body: '對方剛添加你時，BC 伺服器尚未將更新資料推送到你的客戶端，所以顯示為「單向好友」。重新登入或等待伺服器同步後即可顯示正確關係。' },
            { icon: '🏠', title: '房間管理',
             items: [
                 '「房間管理」頁需要你目前在某個聊天室中才能使用。',
                 '管理員功能（踢人、封禁、白名單等）需要你擁有該房間的管理員權限。',
                 '房間搜尋頁可以搜尋公開房間，並以星號標記最愛房間。',
             ]},
            { icon: '📍', title: '召喚功能（BEEP 視窗中的「召喚」按鈕）',
             body: '按下「召喚」會傳送附帶當前房間資訊的 BEEP。對方必須在 BC 中設定有接受召喚的規則才能自動傳送；否則對方只會收到文字訊息「summon」。需在房間中才能使用。' },
            { icon: '📜', title: '人員查詢與 Profile 分享',
             items: [
                 '「人員查詢」頁顯示你曾在同一房間遇過的角色（需啟用儲存模式）。',
                 '擁有完整資料（完整模式）的角色可點「分享」，將 Profile 傳送給當前聊天室的其他人。',
                 '與 WCE（bce-past-profiles）完全相容。若已安裝 WCE 建議儲存模式設為「不儲存」以避免重複儲存。',
             ]},
            { icon: '🖼', title: '頭像說明',
             items: [
                 '頭像從角色的 BC 畫布截取臉部，需有完整外觀資料才能生成。',
                 '若頭像顯示文字縮寫，可點擊頭像格子強制重新截取。',
                 '設定頁的「頭像快取管理」可清除所有頭像或批次載入好友頭像。',
             ]},
            { icon: '🔑', title: 'FCM 按鈕位置',
             items: [
                 '聊天室右側工具列 — 貓頭圖示按鈕',
                 '大廳畫面右上角 — 貓頭圖示按鈕',
                 '自己的個人檔案頁 — 右側按鈕',
                 '可在設定頁的「按鈕顯示設定」中分別開關各位置的按鈕（至少須保留一個）。',
             ]},
        ] : [
            { icon: '🎛', title: 'What is FCM?',
             body: "FCM (Friends & Chatroom Manager) is a companion tool for Bondage Club. View friend status, manage room members, search rooms, and look up characters you've encountered — all in one panel." },
            { icon: '⚙', title: 'Some features must be enabled in Settings first',
             items: [
                 '[Show Avatars] — Off by default. Shows portraits in lists (requires having been in the same room or having full profile data).',
                 '[Save Mode] — Defaults to "Off". Set to at least "Name only" so offline friend names display and the People tab has data.',
                 "[Show target avatar during whisper] — Displays the target's avatar bottom-left when in whisper/BEEP mode. Only on chatroom main screen; hidden during profile/wardrobe views.",
                 '[Whisper/BEEP Input Glow] — Shows a colored glow on chat input when /w is typed or whisper mode is active.',
                 '[OOC Protection] — Blocks Ctrl+Enter in whisper mode to prevent OOC content from being sent as normal chat.',
                 '[Ghost List Hide] — Characters on your ghost list are hidden in the chatroom (only affects your view).',
             ]},
            { icon: '👥', title: '"One-way" relationship is normal',
             body: "If someone shows as One-way friend, it means they recently added you but BC's server hasn't synced yet. Re-logging or waiting will fix it." },
            { icon: '🏠', title: 'Room Management',
             items: [
                 'The Room Management tab only works while you are in a chatroom.',
                 'Admin actions (kick, ban, whitelist, etc.) require admin rights in the room.',
                 'Room Search lets you search public rooms and star favorites.',
             ]},
            { icon: '📍', title: 'Summon (button in the BEEP dialog)',
             body: 'Clicking "Summon" sends a BEEP with your current room info. The target must have a summon rule in BC to be teleported automatically — otherwise they only receive "summon". Must be in a room.' },
            { icon: '📜', title: 'People tab & Profile sharing',
             items: [
                 "The People tab shows characters you've encountered (requires Save Mode).",
                 'Characters with full profile data can be shared to the chatroom via the Share button.',
                 "Fully compatible with WCE's bce-past-profiles DB. Use Save Mode \"Off\" if WCE is installed.",
             ]},
            { icon: '🖼', title: 'Avatars',
             items: [
                 "Avatars are cropped from the character's BC canvas — full appearance data required.",
                 'Click the avatar cell to force a reload.',
                 'Use "Avatar Cache" in Settings to clear or batch-load avatars.',
             ]},
            { icon: '🔑', title: 'FCM button locations',
             items: [
                 'ChatRoom toolbar — cat icon on the right',
                 'Main Hall — cat icon top-right',
                 'Your own profile page — right side button',
                 'Toggle each in Settings → Button Visibility.',
             ]},
        ];
        sections.forEach(sec => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#1a1230;border:1px solid #2e2458;border-radius:10px;padding:12px 16px;margin-bottom:8px;transition:border-color .15s;';
            card.addEventListener('mouseenter', () => { card.style.borderColor = '#5a48a8'; });
            card.addEventListener('mouseleave', () => { card.style.borderColor = '#2e2458'; });
            const titleRow = document.createElement('div');
            titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
            const iconEl = document.createElement('span'); iconEl.style.cssText = 'font-size:15px;flex-shrink:0;'; iconEl.textContent = sec.icon;
            const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#e0c8ff;font-size:13px;font-weight:700;'; titleEl.textContent = sec.title;
            titleRow.appendChild(iconEl); titleRow.appendChild(titleEl); card.appendChild(titleRow);
            if (sec.body) { const p = document.createElement('div'); p.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.7;'; p.textContent = sec.body; card.appendChild(p); }
            if (sec.items) {
                const ul = document.createElement('div'); ul.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
                sec.items.forEach(item => {
                    const li = document.createElement('div'); li.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.6;display:flex;gap:6px;';
                    const dot = document.createElement('span'); dot.style.cssText = 'color:#5a48a0;flex-shrink:0;'; dot.textContent = '•';
                    const txt = document.createElement('span'); txt.textContent = item;
                    li.appendChild(dot); li.appendChild(txt); ul.appendChild(li);
                });
                card.appendChild(ul);
            }
            wrap.appendChild(card);
        });
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top:4px;padding:10px 0;text-align:center;color:#4a3870;font-size:11px;letter-spacing:1px;';
        footer.textContent = `FCM v${MOD_VER}  ·  Liko - Friends & Chatroom Manager`;
        wrap.appendChild(footer);
        container.appendChild(wrap);
    }
    // ─── Settings ───────────────────────────────────────────────────────
    function renderSettings(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.className = 'fcm-settings-wrap';
        function settingRow(label, note, on, onChange) {
            const row = document.createElement('div'); row.className = 'fcm-set-row';
            const tog = mkToggle(on, onChange), info = document.createElement('div');
            const lbl = document.createElement('div'); lbl.className = 'fcm-set-label'; lbl.textContent = label;
            const nt = document.createElement('div'); nt.className = 'fcm-set-note'; nt.textContent = note;
            info.appendChild(lbl); info.appendChild(nt); row.appendChild(tog); row.appendChild(info);
            return row;
        }
        function sectionHeader(title) {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:15px;font-weight:800;letter-spacing:1px;color:#c4a0e0;padding:14px 0 4px 0;border-bottom:2px solid #3a2870;margin-bottom:2px;';
            h.textContent = title; wrap.appendChild(h);
        }
        function divider() { const d = document.createElement('div'); d.className = 'fcm-divider'; wrap.appendChild(d); }

        // ══════════════════════════════════════════
        //  GROUP A: UI 管理
        // ══════════════════════════════════════════
        sectionHeader(isZh() ? '⚙ UI 管理' : '⚙ UI Management');

        // ── Language ──────────────────────────────
        const langRow = document.createElement('div'); langRow.className = 'fcm-set-row'; langRow.style.alignItems = 'center';
        const langInfo = document.createElement('div'); langInfo.style.flex = '1';
        const langLbl = document.createElement('div'); langLbl.className = 'fcm-set-label'; langLbl.textContent = T('langLabel');
        const langNote2 = document.createElement('div'); langNote2.className = 'fcm-set-note';
        try { const tl = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : ''); langNote2.textContent = T('langNote') + '  ' + T('langDetected', tl); } catch { langNote2.textContent = T('langNote'); }
        langInfo.appendChild(langLbl); langInfo.appendChild(langNote2);
        const langSel = document.createElement('select'); langSel.className = 'fcm-sel'; langSel.style.flexShrink = '0';
        [['auto', 'Auto'], ['zh', '中文'], ['en', 'English']].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (cfg.lang || 'auto')) o.selected = true; langSel.appendChild(o);
        });
        langSel.addEventListener('change', () => {
            cfg.lang = langSel.value; saveCfg();
            if (panelEl) { panelEl.remove(); panelEl = null; }
            if (miniEl) { miniEl.remove(); miniEl = null; }
            panelOpen = false; panelMini = false;
            buildPanel(); uiTab = 'settings'; openPanel();
        });
        langRow.appendChild(langInfo); langRow.appendChild(langSel);
        wrap.appendChild(langRow);
        divider();

        // ── Avatars ───────────────────────────────
        const avRow = settingRow(T('setAvatars'), T('setAvatarsNote'), cfg.avatars, v => { cfg.avatars = v; saveCfg(); });
        const cacheBtn = document.createElement('button'); cacheBtn.className = 'fcm-btn fcm-btn-blue';
        cacheBtn.textContent = T('btnReloadAvatars'); cacheBtn.style.cssText = 'font-size:11px;padding:6px 12px;flex-shrink:0;margin-left:auto;';
        cacheBtn.title = T('reloadAvatarsNote');
        avRow.appendChild(cacheBtn);
        wrap.appendChild(avRow);

        const avPanel = document.createElement('div');
        avPanel.style.cssText = 'display:none;margin:0 0 4px 0;padding:10px 14px;background:#1a1030;border-radius:8px;border:1px solid #3a2870;flex-direction:column;gap:8px;';
        const avStatus = document.createElement('div'); avStatus.className = 'fcm-reload-status'; avStatus.style.textAlign = 'center';
        _avStatusEl = avStatus;

        const clearRow = document.createElement('div'); clearRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const clearInfo = document.createElement('div'); clearInfo.style.flex = '1';
        const clearLbl = document.createElement('div'); clearLbl.style.cssText = 'color:#e8d4ff;font-size:13px;font-weight:600;'; clearLbl.textContent = T('btnClearAvatarCache');
        const clearNote = document.createElement('div'); clearNote.className = 'fcm-set-note'; clearNote.textContent = T('clearAvatarCacheNote');
        clearInfo.appendChild(clearLbl); clearInfo.appendChild(clearNote);
        const clearExecBtn = document.createElement('button'); clearExecBtn.className = 'fcm-btn fcm-btn-red';
        clearExecBtn.textContent = isZh() ? '清除' : 'Clear'; clearExecBtn.style.cssText = 'flex-shrink:0;padding:5px 12px;';
        clearExecBtn.addEventListener('click', async () => {
            clearExecBtn.disabled = true; clearExecBtn.textContent = isZh() ? '清除中...' : 'Clearing...';
            await Snapshot.clear(); renderCurrent();
            avStatus.textContent = isZh() ? '✓ 頭像快取已清除' : '✓ Cache cleared';
            clearExecBtn.disabled = false; clearExecBtn.textContent = isZh() ? '清除' : 'Clear';
            setTimeout(() => { avStatus.textContent = ''; }, 3000);
        });
        clearRow.appendChild(clearInfo); clearRow.appendChild(clearExecBtn);
        const avOptDiv = document.createElement('div'); avOptDiv.style.cssText = 'height:1px;background:#2a2048;';
        const loadRow = document.createElement('div'); loadRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const loadInfo = document.createElement('div'); loadInfo.style.flex = '1';
        const loadLbl = document.createElement('div'); loadLbl.style.cssText = 'color:#e8d4ff;font-size:13px;font-weight:600;'; loadLbl.textContent = T('btnLoadFriendAvatars');
        const loadNote = document.createElement('div'); loadNote.className = 'fcm-set-note'; loadNote.textContent = T('loadFriendAvatarsNote');
        loadInfo.appendChild(loadLbl); loadInfo.appendChild(loadNote);
        const loadExecBtn = document.createElement('button'); loadExecBtn.className = 'fcm-btn fcm-btn-blue';
        loadExecBtn.textContent = '📸'; loadExecBtn.style.cssText = 'flex-shrink:0;font-size:14px;padding:5px 10px;';
        loadExecBtn.addEventListener('click', async () => {
            if (loadExecBtn.disabled) return;
            loadExecBtn.disabled = true;
            const friendMns = buildFriendList().map(f => f.mn).filter(mn => { const snap = Snapshot._cache[mn]; return !snap || snap.length <= 800; });
            const total = friendMns.length;
            if (total === 0) { avStatus.textContent = isZh() ? '沒有需要載入的好友' : 'No friends need loading'; loadExecBtn.disabled = false; setTimeout(() => { avStatus.textContent = ''; }, 3000); return; }
            const waitMs = Math.min(30000, Math.max(5000, total * 150));
            await PDB.batchGet(friendMns);
            for (const mn of friendMns) {
                const p = _pc[mn]; if (!p || !p.characterBundle) continue;
                try { const data = JSON.parse(p.characterBundle); if (typeof CharacterLoadOnline === 'function') { const C = CharacterLoadOnline(data, mn); if (C && typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined); } } catch {}
                await new Promise(r => setTimeout(r, 20));
            }
            let remaining = waitMs;
            const tick = setInterval(() => { remaining -= 1000; avStatus.textContent = remaining > 0 ? (isZh() ? `等待 BC 緩存外觀... 剩餘 ${(remaining/1000).toFixed(0)} 秒` : `Waiting for BC... ${(remaining/1000).toFixed(0)}s left`) : (isZh() ? '開始截圖...' : 'Snapshotting...'); }, 1000);
            avStatus.textContent = isZh() ? `等待 BC 緩存外觀... ${(waitMs/1000).toFixed(0)} 秒` : `Waiting for BC... ${(waitMs/1000).toFixed(0)}s`;
            await new Promise(r => setTimeout(r, waitMs));
            clearInterval(tick);
            await refreshSnapshotsForList(friendMns);
            avStatus.textContent = T('loadFriendAvatarsDone');
            loadExecBtn.disabled = false;
            setTimeout(() => { avStatus.textContent = ''; }, 4000);
        });
        loadRow.appendChild(loadInfo); loadRow.appendChild(loadExecBtn);
        avPanel.appendChild(clearRow); avPanel.appendChild(avOptDiv); avPanel.appendChild(loadRow); avPanel.appendChild(avStatus);
        let avPanelOpen = false;
        cacheBtn.addEventListener('click', () => { avPanelOpen = !avPanelOpen; avPanel.style.display = avPanelOpen ? 'flex' : 'none'; cacheBtn.style.borderColor = avPanelOpen ? '#b090f0' : ''; });
        wrap.appendChild(avPanel);
        divider();

        // ── Button Visibility — three checkboxes inline ───────────────
        const btnVisRow = document.createElement('div'); btnVisRow.className = 'fcm-set-row'; btnVisRow.style.alignItems = 'center';
        const btnVisInfo = document.createElement('div'); btnVisInfo.style.flex = '1';
        const btnVisLbl = document.createElement('div'); btnVisLbl.className = 'fcm-set-label'; btnVisLbl.textContent = T('btnVisibilityLabel');
        const btnVisNote = document.createElement('div'); btnVisNote.className = 'fcm-set-note'; btnVisNote.textContent = T('btnVisibilityNote');
        btnVisInfo.appendChild(btnVisLbl); btnVisInfo.appendChild(btnVisNote);
        btnVisRow.appendChild(btnVisInfo);
        // Three checkboxes side by side
        const chkWrap = document.createElement('div'); chkWrap.style.cssText = 'display:flex;flex-direction:row;gap:12px;flex-shrink:0;align-items:center;';
        function makeBtnVisChk(cfgKey, labelText) {
            const cell = document.createElement('label'); cell.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;';
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = cfg[cfgKey]; chk.style.cssText = 'width:14px;height:14px;accent-color:#a078e8;cursor:pointer;';
            const lbl = document.createElement('span'); lbl.style.cssText = 'color:#c4a0e0;font-size:12px;';  lbl.textContent = labelText;
            chk.addEventListener('change', () => {
                const keys = ['btnShowChatRoom', 'btnShowMainHall', 'btnShowProfile'];
                if (!chk.checked && !keys.filter(k => k !== cfgKey).some(k => cfg[k])) {
                    chk.checked = true;
                    lbl.style.color = '#ff8080'; setTimeout(() => { lbl.style.color = '#c4a0e0'; }, 1200);
                    return;
                }
                cfg[cfgKey] = chk.checked; saveCfg();
            });
            cell.appendChild(chk); cell.appendChild(lbl);
            return cell;
        }
        chkWrap.appendChild(makeBtnVisChk('btnShowChatRoom', T('btnShowChatRoom')));
        chkWrap.appendChild(makeBtnVisChk('btnShowMainHall', T('btnShowMainHall')));
        chkWrap.appendChild(makeBtnVisChk('btnShowProfile',  T('btnShowProfile')));
        btnVisRow.appendChild(chkWrap);
        wrap.appendChild(btnVisRow);
        divider();

        // ── Save Mode ─────────────────────────────
        const smRow = document.createElement('div'); smRow.className = 'fcm-set-row'; smRow.style.alignItems = 'center';
        const smInfo = document.createElement('div'); smInfo.style.flex = '1'; smInfo.style.display = 'flex'; smInfo.style.alignItems = 'center'; smInfo.style.flexWrap = 'wrap'; smInfo.style.gap = '6px';
        const smLbl = document.createElement('div'); smLbl.className = 'fcm-set-label'; smLbl.textContent = T('saveModeLabel'); smInfo.appendChild(smLbl);
        const wceTag = document.createElement('span'); wceTag.style.display = 'none';
        detectWCESave().then(wceOn => { if (wceOn) { wceTag.className = 'fcm-wce-tag fcm-wce-tag-yes'; wceTag.textContent = isZh() ? '偵測到 WCE Profiles' : 'WCE detected'; wceTag.style.display = 'inline-block'; } });
        smInfo.appendChild(wceTag);
        const smSel = document.createElement('select'); smSel.className = 'fcm-sel'; smSel.style.flexShrink = '0';
        [['off', T('saveModeOff')], ['name', T('saveModeName')], ['avatar', T('saveModeAvatar')], ['full', T('saveModeFull')]].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (cfg.saveMode||'off')) o.selected = true; smSel.appendChild(o);
        });
        const smDesc = document.createElement('div'); smDesc.className = 'fcm-set-desc';
        const updateSmDesc = () => { smDesc.textContent = T('saveModeDesc_' + (smSel.value || 'off')); };
        updateSmDesc();
        smSel.addEventListener('change', () => { cfg.saveMode = smSel.value; saveCfg(); updateSmDesc(); });
        smRow.appendChild(smInfo); smRow.appendChild(smSel);
        wrap.appendChild(smRow); wrap.appendChild(smDesc);

        // Export / Import — placed directly under Save Mode
        const exportRow = document.createElement('div'); exportRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;';
        function mkActionBtn(label, note, cls, cb) {
            const b = document.createElement('button'); b.className = 'fcm-btn ' + cls; b.textContent = label; b.title = note;
            b.style.cssText = 'flex:1;padding:8px;font-size:11px;'; b.addEventListener('click', cb); return b;
        }
        exportRow.appendChild(mkActionBtn(T('exportProfiles'), T('exportNote'), 'fcm-btn-blue', async () => {
            if (!PDB.db) return;
            const n = await exportProfiles();
            if (n > 0 && typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('exportDone', n), 5000);
        }));
        exportRow.appendChild(mkActionBtn(T('importProfiles'), T('importNote'), 'fcm-btn-green', () => {
            if (!PDB.db) return;
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
            inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const r = await importProfiles(f); if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('importDone', r.pc, r.nc), 5000); renderCurrent(); };
            inp.click();
        }));
        wrap.appendChild(exportRow);

        // ══════════════════════════════════════════
        //  GROUP B: 聊天室管理
        // ══════════════════════════════════════════
        sectionHeader(isZh() ? '⚙ 聊天室管理' : '⚙ Chat Room');

        // ── Whisper Indicator (color) ─────────────
        const wiWrap = document.createElement('div');
        const wiToggleRow = document.createElement('div'); wiToggleRow.style.cssText = 'display:flex;align-items:center;gap:14px;';
        const wiTog = mkToggle(cfg.whisperIndicator, v => { cfg.whisperIndicator = v; saveCfg(); if (v) startWhisperIndicator(); else stopWhisperIndicator(); });
        wiTog.style.flexShrink = '0';
        const wiInfo = document.createElement('div'); wiInfo.style.flex = '1';
        const wiLbl = document.createElement('div'); wiLbl.className = 'fcm-set-label'; wiLbl.textContent = T('whisperIndicatorLabel');
        const wiNote = document.createElement('div'); wiNote.className = 'fcm-set-note'; wiNote.textContent = T('whisperIndicatorNote');
        wiInfo.appendChild(wiLbl); wiInfo.appendChild(wiNote);
        const wiColorLabelBtn = document.createElement('span');
        wiColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;';
        wiColorLabelBtn.textContent = isZh() ? '修改顏色' : 'Color';
        const wiColorBtn = document.createElement('button');
        wiColorBtn.style.cssText = `width:28px;height:28px;border-radius:50%;background:${cfg.whisperColor||'#b070e8'};border:2px solid #6040a0;cursor:pointer;flex-shrink:0;transition:border-color .15s;`;
        let wiColorOpen = false;
        const wiColorPanel = document.createElement('div'); wiColorPanel.style.cssText = 'display:none;padding:10px 0 4px 56px;';
        const swatchRow = document.createElement('div'); swatchRow.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;';
        const presets = ['#b070e8','#e870c0','#70aaff','#70e8b0','#f0c040','#e87070','#ff9040','#ffffff'];
        const updateColorBtn = (color) => { wiColorBtn.style.background = color; wiColorBtn.style.boxShadow = `0 0 0 3px ${color}55`; };
        const allSwatches = [];
        const customInp = document.createElement('input'); customInp.type = 'color'; customInp.value = cfg.whisperColor || '#b070e8';
        customInp.style.cssText = 'width:30px;height:24px;border-radius:6px;border:1px solid #5048a0;background:#1a1030;cursor:pointer;padding:1px;';
        presets.forEach(color => {
            const sw = document.createElement('button');
            sw.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid ${cfg.whisperColor===color?'#fff':'transparent'};cursor:pointer;flex-shrink:0;transition:border .15s;`;
            sw.addEventListener('click', () => { cfg.whisperColor = color; saveCfg(); updateColorBtn(color); allSwatches.forEach(s => s.style.borderColor = 'transparent'); sw.style.borderColor = '#fff'; customInp.value = color; });
            allSwatches.push(sw); swatchRow.appendChild(sw);
        });
        customInp.addEventListener('input', () => { cfg.whisperColor = customInp.value; saveCfg(); updateColorBtn(customInp.value); allSwatches.forEach(s => s.style.borderColor = 'transparent'); });
        swatchRow.appendChild(customInp); wiColorPanel.appendChild(swatchRow);
        wiColorLabelBtn.addEventListener('click', () => wiColorBtn.click());
        wiColorBtn.addEventListener('click', () => { wiColorOpen = !wiColorOpen; wiColorPanel.style.display = wiColorOpen ? 'block' : 'none'; wiColorBtn.style.borderColor = wiColorOpen ? '#d0a0ff' : '#6040a0'; });
        wiToggleRow.appendChild(wiTog); wiToggleRow.appendChild(wiInfo); wiToggleRow.appendChild(wiColorLabelBtn); wiToggleRow.appendChild(wiColorBtn);
        wiWrap.appendChild(wiToggleRow); wiWrap.appendChild(wiColorPanel);
        wrap.appendChild(wiWrap);
        updateColorBtn(cfg.whisperColor || '#b070e8');
        divider();

        // ── Whisper Avatar ────────────────────────
        wrap.appendChild(settingRow(T('whisperAvatarLabel'), T('whisperAvatarNote'), cfg.whisperAvatar, v => {
            cfg.whisperAvatar = v; saveCfg();
            if (!v) _removeWhisperAvatar();
        }));
        divider();

        // ── OOC Protection ────────────────────────
        wrap.appendChild(settingRow(T('oocProtectLabel'), T('oocProtectNote'), cfg.oocProtect, v => {
            cfg.oocProtect = v; saveCfg();
            if (v) _installOocProtect(); else _uninstallOocProtect();
        }));
        divider();

        // ── Ghost Hide ────────────────────────────
        wrap.appendChild(settingRow(T('ghostHideLabel'), T('ghostHideNote'), cfg.ghostHide, v => { cfg.ghostHide = v; saveCfg(); applyGhostHide(v); }));


        container.appendChild(wrap);
    }

    // ═══════════════════════════════════════════════════════════
    //  PANEL STATE
    // ═══════════════════════════════════════════════════════════
    function openPanel() {
        if (!panelEl) buildPanel();
        panelEl.classList.remove('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = true; panelMini = false;
        ServerSend('AccountQuery', { Query: 'OnlineFriends' });
        renderCurrent();
    }

    function minimizePanel() { if (!panelEl) return; panelEl.classList.add('hidden'); if (miniEl) miniEl.classList.add('visible'); panelMini = true; _removeWhisperAvatar(); }
    function restorePanel() { if (!panelEl) buildPanel(); panelEl.classList.remove('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelMini = false; renderCurrent(); }
    function closePanel() {
        if (panelEl) panelEl.classList.add('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = false; panelMini = false;
        _peopleQ = ''; _peoplePage = 0;
        _removeWhisperAvatar();
        document.getElementById('fcm-beep-overlay')?.remove();
        document.getElementById('fcm-confirm-overlay')?.remove();
    }
    function togglePanel() { if (panelOpen || panelMini) closePanel(); else openPanel(); }

    // ═══════════════════════════════════════════════════════════
    //  BC HOOKS
    // ═══════════════════════════════════════════════════════════
    let _whisperDrawCount = 0;

    modApi.hookFunction('DrawProcess', 10, (args, next) => {
        next(args);
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
            if (cfg.btnShowChatRoom) {
                const btnColor = (panelOpen || panelMini) ? 'Pink' : 'Gray';
                MainCanvas.globalAlpha = 0.75;
                DrawButton(BTN_X, BTN_Y, BTN_W, BTN_H, '', btnColor, '', 'Friends & Room Manager');
                if (_fcmIconImg && typeof DrawImageResize === 'function') { const pad = 4; DrawImageResize(_fcmIconImg, BTN_X + pad, BTN_Y + pad, BTN_W - pad * 2, BTN_H - pad * 2); }
                MainCanvas.globalAlpha = 1.0;
            }
        }
        if (++_whisperDrawCount % 15 === 0) {
            _applyWhisperStyle();
            _updateWhisperAvatar();
        }
        // Draw whisper avatar on canvas every frame (after next() so it renders on top)
        const _inChatMain = (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom')
        && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null);
        if (_inChatMain) _drawWavOnCanvas();
    });

    modApi.hookFunction('ChatRoomClick', 10, (args, next) => {
        if (cfg.btnShowChatRoom && MouseIn(BTN_X, BTN_Y, BTN_W, BTN_H)) { buildPanel(); togglePanel(); return; }
        next(args);
    });
    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => { closePanel(); return next(args); });

    // ── Main Hall button ──────────────────────────────────────────
    const HALL_BTN_X = 1525, HALL_BTN_Y = 25, HALL_BTN_W = 90, HALL_BTN_H = 90;
    modApi.hookFunction('MainHallRun', 10, (args, next) => {
        next(args);
        if (!cfg.btnShowMainHall) return;
        if (typeof DrawButton === 'function') {
            const btnColor = (panelOpen || panelMini) ? 'Pink' : 'White';
            DrawButton(HALL_BTN_X, HALL_BTN_Y, HALL_BTN_W, HALL_BTN_H, '', btnColor, '', 'FCM');
            if (_fcmIconImg && typeof DrawImageResize === 'function') {
                const pad = 8;
                DrawImageResize(_fcmIconImg, HALL_BTN_X + pad, HALL_BTN_Y + pad, HALL_BTN_W - pad * 2, HALL_BTN_H - pad * 2);
            }
        }
    });
    modApi.hookFunction('MainHallClick', 10, (args, next) => {
        if (cfg.btnShowMainHall && typeof MouseIn === 'function' && MouseIn(HALL_BTN_X, HALL_BTN_Y, HALL_BTN_W, HALL_BTN_H)) {
            buildPanel(); togglePanel(); return;
        }
        return next(args);
    });

    // WPS hidden share messages
    modApi.hookFunction('ChatRoomMessage', 0, (args, next) => {
        const data = args[0];
        if (data?.Type === 'Hidden' && data?.Content?.startsWith(WPS_PREFIX)) {
            if (!window.LikoWPSInstance) { wpsHandleMessage(data); return; }
        }
        return next(args);
    });

    setInterval(() => document.querySelectorAll('.ChatMessageLocalMessage').forEach(wpsProcessOpenTokens), 500);

    // ═══════════════════════════════════════════════════════════
    //  GHOST HIDE
    // ═══════════════════════════════════════════════════════════
    function applyGhostHide(v) { /* toggled via cfg, DrawCharacter hook reads cfg at draw time */ }

    modApi.hookFunction('DrawCharacter', 5, (args, next) => {
        try {
            const C = args[0];
            if (cfg.ghostHide && C && typeof Player !== 'undefined' && Player && C.MemberNumber !== Player.MemberNumber) {
                const gl = Player.GhostList;
                if (Array.isArray(gl) && gl.includes(C.MemberNumber)) return;
            }
        } catch {}
        return next(args);
    });

    // ═══════════════════════════════════════════════════════════
    //  WHISPER INDICATOR
    // ═══════════════════════════════════════════════════════════
    function _applyWhisperStyle() {
        try {
            const el = document.getElementById('InputChat'); if (!el) return;
            const val = el.value || '';
            const isCmd = /^\/(w|whisper|beep)\s/i.test(val);
            const isTgt = typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0;
            const wc = cfg.whisperColor || '#b070e8';
            if (cfg.whisperIndicator && (isCmd || isTgt)) {
                el.style.setProperty('box-shadow', `0 0 0 3px ${wc}cc, 0 0 14px ${wc}88`, 'important');
                el.style.setProperty('border', `2px solid ${wc}`, 'important');
                el.style.setProperty('outline', `1px solid ${wc}66`, 'important');
            } else {
                el.style.removeProperty('box-shadow'); el.style.removeProperty('border'); el.style.removeProperty('outline');
            }
        } catch {}
    }
    function startWhisperIndicator() { _applyWhisperStyle(); }
    function stopWhisperIndicator() { try { const el = document.getElementById('InputChat'); if (el) { el.style.removeProperty('box-shadow'); el.style.removeProperty('border'); el.style.removeProperty('outline'); } } catch {} }

    // ═══════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════
    function init() {
        loadCfg();
        if (typeof ChatRoomCharacter === 'undefined' || typeof Player === 'undefined') return setTimeout(init, 500);

        // Apply persisted feature states at startup
        if (cfg.oocProtect) _installOocProtect();

        Promise.all([PDB.init(), Snapshot.init()]).then(async ([pdbOk]) => {
            if (!pdbOk) console.warn('🐈‍⬛ [FCM] Profile DB: no profiles store');
            const stored = JSON.parse(localStorage.getItem('LikoFCM') || '{}');
            if (stored.saveMode === undefined) {
                await detectWCESave();
            }
        });
        buildPanel();
        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: 'profiles',
                Description: isZh() ? '<篩選> - 開啟人員查詢（依名稱或 ID 篩選）' : '<filter> - Open People search (filter by name or ID)',
                Action: arg => { _peopleQ = arg ? arg.trim() : ''; uiTab = 'people'; openPanel(); },
            }]);
        }
        modApi.hookFunction('InformationSheetRun', 7, (args, next) => {
            const r = next(args);
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                  (InformationSheetSelection === Player.MemberNumber || InformationSheetSelection?.MemberNumber === Player.MemberNumber);
            if (viewingSelf && cfg.btnShowProfile && typeof DrawButton === 'function') {
                const btnColor = (panelOpen && !panelMini) ? '#3a1858' : 'White';
                DrawButton(1705, 420, 90, 90, '', btnColor, '', 'FCM');
                if (_fcmIconImg && typeof DrawImageResize === 'function') {
                    DrawImageResize(_fcmIconImg, 1713, 428, 74, 74);
                }
            }
            return r;
        });
        modApi.hookFunction('InformationSheetClick', 7, (args, next) => {
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                  (InformationSheetSelection === Player.MemberNumber || InformationSheetSelection?.MemberNumber === Player.MemberNumber);
            if (viewingSelf && cfg.btnShowProfile && typeof MouseIn === 'function' && MouseIn(1705, 420, 90, 90)) { openPanel(); return; }
            return next(args);
        });
        console.log(`🐈‍⬛ [FCM] ✅ v${MOD_VER} loaded`);
    }
    init();
})();
