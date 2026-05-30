// ==UserScript==
// @name         Liko - FCM
// @name:zh      Liko的好友與房間管理
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.2
// @description  Friends & Room Manager | 好友與房間管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const MOD_VER = '1.1.2';
    const modApi = bcModSdk.registerMod({
        name: 'LikoFCM', fullName: 'Liko - Friends Room Manager', version: MOD_VER,
    });
    const BTN_X = 955, BTN_Y = 455, BTN_W = 45, BTN_H = 45;

    // ═══════════════════════════════════════════════════════════
    //  LANGUAGE  (#11 bilingual, following CFT pattern)
    // ═══════════════════════════════════════════════════════════
    // Language: cfg.lang overrides; otherwise TranslationLanguage
    // Covers BC language codes: CN, TW, ZH, zh-TW, zh-CN etc.
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
            minimize: '—', close: '×', miniLabel: '好友與房間管理',
            search: '搜尋名稱或ID...', roomSearch: '搜尋 / 輸入ID添加...',
            sortBy: '排序', sortRel: '關係', sortId: 'ID', sortName: '名稱', sortAdded: '添加時間',
            showOnly: '顯示', togNick: '暱稱', togName: '名稱',
            fOnline: '在線', fOffline: '不在線', fOwner: '主人', fLover: '戀人', fSub: '奴隸', fFriend: '好友',
            colName: '名稱', colId: 'ID', colRel: '關係', colZone: '分區', colRoom: '房間',
            colPerm: '權限', colOps: '動作', colMgmt: '房管', colMgmtNoPerm: '房管（無權）',
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
            ghostHideLabel: '幽靈名單隱身', ghostHideNote: '幽靈名單中的角色在聊天室不顯示身體（只對自己有效）', whisperIndicatorNote: '輸入 /w /whisper /beep 或進入悄悄話模式時，聊天框會顯示紫色邊框提示', langNote: 'Auto: 依 BC TranslationLanguage（CN/TW→中文，其餘→English）',
            langDetected: tl => `目前偵測: ${tl || '未設定'}`,
            btnReloadAvatars: '重新載入頭像', reloadAvatarsNote: '清除頭像快取，重新從角色資料建立',
            reloadAvatarsDone: '已清除頭像快取，重新加載中...',
            noProfile: '尚無個人資料\n（需先與此人在同一房間）',
            confirmDel: n => `確定刪除好友「${n}」？`,
            confirmKick: n => `確定逐出「${n}」？`,
            confirmRoom: n => `🚪 前往房間「${n}」？`,
            tabRoomSearch: '查詢房間', roomSearch2: '搜尋房間...', roomSearchBtn: '搜尋',
            roomSearching: '搜尋中...', roomSearchEmpty: '沒有找到房間',
            roomFavLabel: '★ 最愛', roomJoin: '加入', roomMixed: '混合', roomFemale: '女性', roomMale: '男性',
            totalRooms: n => `共 ${n} 間`, roomPrivateLabel: '私人',
            btnAddWhite: '+白單', btnRmWhite: '-白單', btnAddBan: '+黑單', btnRmBan: '解禁',
            permAdmin: '管理', permPass: 'PASS', permBan: 'BAN', permVisit: '訪客',
            youLabel: '（你）', copyId: '點擊複製ID', copyDone: '已複製！',
            total: n => `共 ${n} 人`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: '輸入訊息（可留空）\nCtrl+Enter 發送',
            beepSend: '發送 BEEP', beepCancel: '取消',
            noData: '（空白）', noFriends: '沒有符合條件的好友',
            fWhitelist: '白名單', fBlacklist: '黑名單', fGhost: '幽靈',
            relWhitelist: '白名單', relBlacklist: '黑名單', relGhost: '幽靈',
            roomPrivate: '私人', roomPublic: '',
            saveModeLabel: '儲存模式',
            saveModeOff: '不儲存', saveModeName: '僅名稱', saveModeAvatar: '名稱與頭像', saveModeFull: '完整資料（WCE 相容）',
            saveModeDesc_off: '不儲存任何資料。如果你有安裝 WCE 並啟用其 Profiles 功能，建議選此選項避免重複儲存（WCE 已幫你存好了）。',
            saveModeDesc_name: '只儲存成員編號、BC 名稱、暱稱。幾乎不佔空間，可用來顯示離線好友名稱。',
            saveModeDesc_avatar: '額外儲存頭像圖片（在遇見時自動擷取）。',
            saveModeDesc_full: '完整儲存：名稱、暱稱、頭像、外觀/BIO/稱號等。與 WCE bce-past-profiles 資料庫完全相容，互相共用。',
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
        },
        en: {
            panelTitle: '🎛 FCM ─ Friends and ChatRoom Manager', tabFriends: 'Relations', tabRoom: 'Room Mgmt', tabSettings: 'Settings',
            minimize: '—', close: '×', miniLabel: 'Friends and ChatRoom Manager',
            search: 'Search name or ID...', roomSearch: 'Search / Enter ID to add...',
            sortBy: 'Sort', sortRel: 'Relation', sortId: 'ID', sortName: 'Name', sortAdded: 'Added',
            showOnly: 'Show', togNick: 'Nick', togName: 'Name',
            fOnline: 'Online', fOffline: 'Offline', fOwner: 'Owner', fLover: 'Lover', fSub: 'Sub', fFriend: 'Friend',
            colName: 'Name', colId: 'ID', colRel: 'Rel.', colZone: 'Zone', colRoom: 'Room',
            colPerm: 'Perm.', colOps: 'Actions', colMgmt: 'Room Admin', colMgmtNoPerm: 'Room Admin (no perm)',
            relOwner: 'Owner', relLover: 'Lover', relSub: 'Sub', relFriend: 'Friend', relContact: 'One-way',
            zoneF: '♀', zoneM: '♂', zoneX: '♀♂', zoneUnk: '—',
            online: 'Online', offline: 'Offline',
            btnView: 'View', btnBeep: 'BEEP', btnWhisper: 'Msg', btnAddFriend: '+Frnd', btnRmFriend: '-Frnd',
            btnAddAdmin: '+Admin', btnRmAdmin: '-Admin', btnAddWhite: '+White', btnRmWhite: '-White',
            btnAddBan: '+Ban', btnRmBan: 'Unban', btnKick: 'Kick',
            btnAdd: 'Add', btnAddTitle: 'Add ID to list',
            roomTabs: { members: 'Members', admin: 'Admins', white: 'Whitelist', ban: 'Blacklist' },
            notInRoom: 'Not currently in a room', noAdminWarn: '⚠ No admin rights — Room Admin column is view-only',
            setAvatars: 'Show Avatars', setAvatarsNote: 'Show portraits (saved on encounter or rebuilt from profile data)',
            setProfiles: 'Enable Profile Auto-Save', setProfilesNote: 'WCE bce-past-profiles compatible',
            dbOk: 'Connected', dbNo: 'Not connected',
            langLabel: 'Language',
            whisperIndicatorLabel: 'Whisper/BEEP Input Glow Color',
            ghostHideLabel: 'Ghost List Hide', ghostHideNote: 'Characters on your ghost list are hidden in chatroom (only affects your view)', whisperIndicatorNote: 'Shows a purple glow on the chat input when /w /whisper /beep is typed or whisper mode is active', langNote: 'Auto: follows BC TranslationLanguage (CN/TW→Chinese, others→English)',
            langDetected: tl => `Detected: ${tl || 'not set'}`,
            btnReloadAvatars: 'Reload Avatars', reloadAvatarsNote: 'Clear avatar cache and rebuild from profile data',
            reloadAvatarsDone: 'Avatar cache cleared, reloading...',
            noProfile: 'No profile data\n(Must have been in same room)',
            confirmDel: n => `Unfriend "${n}"?`,
            confirmKick: n => `Kick "${n}"?`,
            confirmRoom: n => `🚪 Go to room "${n}"?`,
            tabRoomSearch: 'Search Rooms', roomSearch2: 'Search rooms...', roomSearchBtn: 'Search',
            roomSearching: 'Searching...', roomSearchEmpty: 'No rooms found',
            roomFavLabel: '★ Favs', roomJoin: 'Join', roomMixed: 'Mixed', roomFemale: 'Female', roomMale: 'Male',
            totalRooms: n => `Rooms: ${n}`, roomPrivateLabel: 'Private',
            btnAddWhite: '+White', btnRmWhite: '-White', btnAddBan: '+Ban', btnRmBan: 'Unban',
            permAdmin: 'Admin', permPass: 'PASS', permBan: 'BAN', permVisit: 'Visit',
            youLabel: '(You)', copyId: 'Click to copy ID', copyDone: 'Copied!',
            total: n => `Total: ${n}`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: 'Type message (can be empty)\nCtrl+Enter to send',
            beepSend: 'Send BEEP', beepCancel: 'Cancel',
            noData: '(Empty)', noFriends: 'No matching entries',
            fWhitelist: 'Whitelist', fBlacklist: 'Blacklist', fGhost: 'Ghost',
            relWhitelist: 'WL', relBlacklist: 'BL', relGhost: 'Ghost',
            roomPrivate: 'Private', roomPublic: '',
            saveModeLabel: 'Save Mode',
            saveModeOff: 'Off', saveModeName: 'Name only', saveModeAvatar: 'Name + Avatar', saveModeFull: 'Full profile (WCE)',
            saveModeDesc_off: "Don't save any data. If you have WCE with Profiles enabled, choose this to avoid duplicates (WCE already saves for you).",
            saveModeDesc_name: 'Save member number, BC name, and nickname only. Minimal space, used for displaying offline friend names.',
            saveModeDesc_avatar: 'Also save avatar image (auto-captured when encountered).',
            saveModeDesc_full: 'Full save: name, nickname, avatar, appearance/BIO/title etc. Fully compatible with WCE bce-past-profiles DB.',
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
        },
    };
    function T(k, ...a) { const d = isZh() ? L.zh : L.en; const v = d[k] ?? L.en[k] ?? k; return typeof v === 'function' ? v(...a) : v; }

    // ═══════════════════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════════════════
    let cfg = { avatars: false, lang: 'auto', saveMode: 'off', whisperIndicator: false, whisperColor: '#b070e8', ghostHide: false }; // saveMode: 'off'|'name'|'avatar'|'full'
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
                const prof = { memberNumber: C.MemberNumber, name: C.Name || '', lastNick: nick, seen: now, savedAt: now };
                // avatar: save for 'avatar' and 'full' modes
                if (cfg.saveMode === 'avatar' || cfg.saveMode === 'full') {
                    prof.avatarDataUrl = this._face(C);
                }
                // bundle: only for 'full' mode (strip large fields like WCE does)
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
    //  #2 AVATAR FROM characterBundle — serial queue (1 at a time) + requestAnimationFrame
    // ═══════════════════════════════════════════════════════════
    const _avQueue = []; let _avBusy = false;
    let _avStatusEl = null; // updated by renderSettings

    // Detect if WCE's profile saving is active
    async function detectWCESave() {
        try { if (typeof fbcSettings !== 'undefined' && fbcSettings.pastProfiles === true) return true; } catch {}
        try { if (PDB.db && PDB.db.objectStoreNames.contains('notes')) return true; } catch {}
        try { if (window.BCE_VERSION || window.FBC_VERSION) return true; } catch {}
        return false;
    }

    function queueAvatarLoad(mn, profile, onDone) {
        mn = parseInt(mn);
        if (profile.avatarDataUrl) { onDone(profile.avatarDataUrl); return; }
        if (_avQueue.some(q => q.mn === mn)) return;
        _avQueue.push({ mn, profile, onDone });
        if (!_avBusy) _processAvQueue();
    }

    async function _processAvQueue() {
        if (_avBusy || _avQueue.length === 0) return;
        _avBusy = true;
        function updateStatus() {
            const n = _avQueue.length + 1; // +1 for current
            if (_avStatusEl) _avStatusEl.textContent = T('reloadStatus', n);
        }
        while (_avQueue.length > 0) {
            const { mn, profile, onDone } = _avQueue.shift();
            updateStatus();
            if (profile.avatarDataUrl) { onDone(profile.avatarDataUrl); continue; }
            if (profile._avatarLoading) continue;
            const url = await loadAvatarFromBundle(mn, profile);
            if (url) onDone(url);
            await new Promise(r => setTimeout(r, 80));
        }
        _avBusy = false;
        if (_avStatusEl) { _avStatusEl.textContent = T('reloadStatus', 0); setTimeout(() => { if (_avStatusEl) _avStatusEl.textContent = ''; }, 3000); }
    }

    async function loadAvatarFromBundle(mn, profile) {
        mn = parseInt(mn);
        if (!profile?.characterBundle || profile._avatarLoading || profile.avatarDataUrl) return null;
        if (inRoom(mn)) return null;
        profile._avatarLoading = true;
        try {
            const data = JSON.parse(profile.characterBundle);
            if (typeof CharacterLoadOnline !== 'function') return null;
            const C = CharacterLoadOnline(data, mn);
            if (!C) return null;
            if (typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined);
            // Use requestAnimationFrame so BC's draw loop runs each iteration
            let url = '';
            for (let i = 0; i < 20 && !url; i++) {
                await new Promise(r => requestAnimationFrame(r));
                url = PDB._face(C, 44);
            }
            // Clean up temp character
            try {
                if (Array.isArray(Character)) {
                    const live = new Set((ChatRoomCharacter || []).map(c => c.MemberNumber));
                    const idx = Character.findIndex(c => c.MemberNumber === mn && !live.has(mn));
                    if (idx >= 0) Character.splice(idx, 1);
                }
            } catch {}
            if (url) {
                profile.avatarDataUrl = url;
                _pc[mn] = profile;
                if (PDB.db) { try { PDB.db.transaction('profiles', 'readwrite').objectStore('profiles').put(profile); } catch {} }
            }
            return url || null;
        } catch { return null; }
        finally { profile._avatarLoading = false; }
    }

    // ═══════════════════════════════════════════════════════════
    //  ONLINE FRIENDS + AUTO-SAVE HOOKS
    // ═══════════════════════════════════════════════════════════
    let onlineFriends = [];
    modApi.hookFunction('FriendListLoadFriendList', 0, (args, next) => {
        const r = next(args);
        if (Array.isArray(args[0])) { onlineFriends = args[0]; if (panelOpen && !panelMini && uiTab === 'friends') renderCurrent(); }
        return r;
    });
    modApi.hookFunction('ChatRoomSync', 0, (args, next) => {
        const r = next(args);
        if (cfg.profiles) { const raws = (args[0] && args[0].Character) || []; setTimeout(() => raws.forEach(raw => { const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber); if (C) PDB.save(C, raw); }), 800); }
        return r;
    });
    modApi.hookFunction('ChatRoomSyncMemberJoin', 0, (args, next) => {
        const r = next(args);
        if (cfg.profiles && args[0] && args[0].Character) { const raw = args[0].Character; setTimeout(() => { const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber); if (C) PDB.save(C, raw); }, 900); }
        return r;
    });
    // #6 Refresh room tab on member join/leave/perm change
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
        if (Player.FriendNames && Player.FriendNames.get(mn)) return 'friend';
        if (Player.FriendList && Player.FriendList.includes(mn)) return 'contact';
        if (Player.WhiteList && Player.WhiteList.includes(mn)) return 'whitelist';
        if (Player.BlackList && Player.BlackList.includes(mn)) return 'blacklist';
        return 'none';
    }
    // Returns ALL roles (multi-role support: lover+sub, owner+whitelist etc.)
    function getAllRels(mn) {
        mn = parseInt(mn); if (!Player || mn === parseInt(Player.MemberNumber)) return ['none'];
        const roles = [];
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) roles.push('owner');
        if ((Player.Lovership && Player.Lovership.some(l => parseInt(l.MemberNumber) === mn)) || parseAFC().some(l => parseInt(l.MemberNumber) === mn)) roles.push('lover');
        if (getSubSet().has(mn)) roles.push('sub');
        if (!roles.length && Player.FriendNames && Player.FriendNames.get(mn)) roles.push('friend');
        if (!roles.length && Player.FriendList && Player.FriendList.includes(mn)) roles.push('contact');
        if (Player.WhiteList && Player.WhiteList.includes(mn)) roles.push('whitelist');
        if (Player.BlackList && Player.BlackList.includes(mn)) roles.push('blacklist');
        try { if (Player.GhostList && Player.GhostList.includes(mn)) roles.push('ghost'); } catch {}
        return roles.length ? roles : ['none'];
    }
    const REL_ORDER = { owner: 0, lover: 1, sub: 2, friend: 3, contact: 4, whitelist: 5, blacklist: 6, none: 7 };

    // #3 Show Nickname or Name based on toggle
    let showNickname = true;
    function getDisplayName(mn) {
        mn = parseInt(mn);
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C) {
            if (showNickname && typeof CharacterNickname === 'function') { const n = CharacterNickname(C); if (n) return n; }
            return C.Name || `#${mn}`;
        }
        const online = onlineFriends.find(f => f.MemberNumber === mn);
        if (online && online.MemberName) {
            // When nickname mode: check profile cache for nickname
            if (showNickname) {
                const cached2 = _pc[mn];
                if (cached2 && cached2.lastNick) return cached2.lastNick;
            }
            return online.MemberName;
        }
        if (Player.FriendNames && Player.FriendNames.get(mn)) return Player.FriendNames.get(mn);
        const lover = Player.Lovership && Player.Lovership.find(l => parseInt(l.MemberNumber) === mn); if (lover && lover.Name) return lover.Name;
        const afc = parseAFC().find(l => l.MemberNumber === mn); if (afc && afc.Name) return afc.Name;
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) return Player.Ownership.Name || `#${mn}`;
        const cached = _pc[mn];
        if (cached) {
            if (showNickname && cached.lastNick) return cached.lastNick;
            return cached.name || `#${mn}`;
        }
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
        // Also include personal whitelist / blacklist members
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
        if (!f) return null; // offline → caller shows '-'
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
        if (f.Private) return { name: null, isPrivate: true, isCurrent: false }; // private room, name hidden
        return null; // lobby / not in a room
    }
    function getRoomName(mn) { const r = getRoomInfo(mn); return r ? r.name : null; }
    function getRoomPerms(mn) {
        if (!ChatRoomData) return ['visit']; mn = parseInt(mn);
        const p = []; if (ChatRoomData.Admin && ChatRoomData.Admin.includes(mn)) p.push('admin'); if (ChatRoomData.Whitelist && ChatRoomData.Whitelist.includes(mn)) p.push('pass'); if (ChatRoomData.Ban && ChatRoomData.Ban.includes(mn)) p.push('ban'); if (!p.length) p.push('visit'); return p;
    }
    function amAdmin() { return !!(ChatRoomData && ChatRoomData.Admin && ChatRoomData.Admin.includes(Player.MemberNumber)); }
    function inRoom(mn) { return !!(ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === parseInt(mn))); }
    function isFriendOf(mn) { return !!(Player.FriendList && Player.FriendList.includes(parseInt(mn))); }
    function canBeep(mn) { if (inRoom(mn)) return true; return onlineFriends.some(f => f.MemberNumber === parseInt(mn)); }

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
                if (inRoom(mn)) {
                    ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Promote' });
                } else {
                    ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' });
                }
                break;
            }
            case 'rmAdmin': {
                if (!Array.isArray(ChatRoomData.Admin)) ChatRoomData.Admin = [];
                const _ai = ChatRoomData.Admin.findIndex(a => parseInt(a) === mn);
                if (_ai >= 0) ChatRoomData.Admin.splice(_ai, 1);
                if (inRoom(mn)) {
                    ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Demote' });
                } else {
                    ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' });
                }
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
        btnRow.appendChild(cancelBtn); btnRow.appendChild(sendBtn);
        pop.appendChild(titleEl); pop.appendChild(ta); pop.appendChild(btnRow);
        overlay.appendChild(pop); document.body.appendChild(overlay); ta.focus();
    }

    function doWhisper(mn) { const el = document.getElementById('InputChat'); if (el) { el.value = `/w ${mn} `; el.focus(); } minimizePanel(); }
    function doAddFriend(mn) { mn = parseInt(mn); if (!isFriendOf(mn) && typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, true, mn.toString()); setTimeout(renderCurrent, 400); } }
    function doToggleList(mn, listType, add) {
        mn = parseInt(mn);
        let list;
        if (listType === 'white') list = Player.WhiteList;
        else if (listType === 'black') list = Player.BlackList;
        else if (listType === 'ghost') { try { list = Player.GhostList; } catch { list = null; } }
        if (!Array.isArray(list)) return;
        try {
            if (typeof ChatRoomListManipulation === 'function') {
                ChatRoomListManipulation(list, add, String(mn));
            } else {
                const idx2 = list.indexOf(mn);
                if (add && idx2 < 0) list.push(mn);
                else if (!add && idx2 >= 0) list.splice(idx2, 1);
                const d = {}; d[listType === 'white' ? 'WhiteList' : listType === 'black' ? 'BlackList' : 'GhostList'] = list;
                if (typeof ServerAccountUpdate !== 'undefined') ServerAccountUpdate.QueueData(d);
            }
        } catch(e) { console.warn('🐈‍⬛ [FCM] doToggleList:', e); }
        setTimeout(renderCurrent, 400);
    }
    function doRemoveFriend(mn) { mn = parseInt(mn); showConfirm(T('confirmDel', getDisplayName(mn)), () => { if (typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, false, mn.toString()); setTimeout(renderCurrent, 400); } }, isZh() ? '刪除' : 'Unfriend'); }
    function navigateToRoom(roomName) {
        showConfirm(T('confirmRoom', roomName), () => {
            closePanel();
            try { if (typeof ChatRoomLeave === 'function') ChatRoomLeave(); if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSearch'); try { ChatSearchLastQueryJoinTime = typeof CommonTime === 'function' ? CommonTime() : Date.now(); } catch {} try { ChatSearchLastQueryJoin = roomName; } catch {} ServerSend('ChatRoomJoin', { Name: roomName }); } catch (e) { console.warn('🐈‍⬛ [FCM] navigateToRoom:', e); }
        }, isZh() ? '🚪 前往' : '🚪 Go');
    }

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
        cancelBtn.style.cssText = 'flex:1;padding:12px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => overlay.remove());
        const okBtn = document.createElement('button'); okBtn.textContent = okLabel || (isZh() ? '確認' : 'Confirm');
        okBtn.style.cssText = 'flex:2;padding:12px;background:#1a3060;border:1.5px solid #4080d8;border-radius:10px;color:#90c8ff;font-size:13px;cursor:pointer;font-weight:700;';
        okBtn.addEventListener('click', () => { overlay.remove(); if (onOk) onOk(); });
        const keyFn = e => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keyFn); } if (e.key === 'Enter') okBtn.click(); };
        document.addEventListener('keydown', keyFn);
        overlay.addEventListener('click', () => { overlay.remove(); document.removeEventListener('keydown', keyFn); });
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
        box.appendChild(msgEl); box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay); setTimeout(() => okBtn.focus(), 50);
    }

    // Click-to-copy ID cell
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
.fcm-tab{padding:10px 28px;color:#7060a0;cursor:pointer;font-size:11px;letter-spacing:1.2px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-tab:hover{color:#c4a0e0;background:#211540;} .fcm-tab.active{color:#e0b8ff;border-bottom-color:#a078e8;background:#1e1438;}
#fcm-content{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;}
/* Toolbar */
.fcm-toolbar{padding:8px 14px;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;border-bottom:1px solid #362858;flex-shrink:0;background:#211540;overflow-x:auto;}
/* Search wrap with × */
.fcm-search-wrap{position:relative;display:inline-flex;align-items:center;width:min(200px,35vw);flex-shrink:0;}
.fcm-search{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:6px 26px 6px 10px;color:#f0e4ff;font-size:12px;width:100%;outline:none;transition:border-color .15s;}
.fcm-search:focus{border-color:#9078d0;} .fcm-search::placeholder{color:#5a4878;}
.fcm-clear-btn{position:absolute;right:6px;background:none;border:none;color:#6050a0;cursor:pointer;font-size:15px;padding:0 2px;line-height:1;transition:color .15s;}
.fcm-clear-btn:hover{color:#f0d8ff;}
.fcm-sel{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:5px 6px;color:#c4a0e0;font-size:11px;outline:none;cursor:pointer;max-width:110px;flex-shrink:0;}
.fcm-sel option{background:#1a1030;}
.fcm-lbl-sm{font-size:10px;color:#6050a0;letter-spacing:1px;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-spacer{flex:1;}  /* pushes sort to right */
.fcm-ftog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:transparent;color:#6058a0;font-size:10px;cursor:pointer;transition:all .15s;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-ftog:hover{color:#c4a0e0;border-color:#8068c0;} .fcm-ftog.on{background:#301c58;border-color:#b088e8;color:#e0c0ff;}
/* nick/name toggle */
.fcm-nick-tog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:#301c58;color:#e0c0ff;font-size:10px;cursor:pointer;font-weight:700;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.fcm-nick-tog:hover{border-color:#b088e8;}
/* Sub-tabs */
.fcm-subtabs{display:flex;background:#1a1230;border-bottom:1px solid #362858;flex-shrink:0;padding:0 10px;}
.fcm-stab{padding:7px 18px;color:#5a4880;cursor:pointer;font-size:10px;letter-spacing:1px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-stab:hover{color:#c4a0e0;} .fcm-stab.active{color:#d0a8f8;border-bottom-color:#a078e8;}
/* Scroll + count */
.fcm-scroll-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.fcm-scroll{flex:1;overflow-y:auto;overflow-x:auto;min-height:0;}
.fcm-scroll::-webkit-scrollbar{width:5px;height:5px;}
.fcm-scroll::-webkit-scrollbar-track{background:#1a1030;}
.fcm-scroll::-webkit-scrollbar-thumb{background:#4838a0;border-radius:3px;}
/* #1 Count bar */
.fcm-count{font-size:11px;color:#9080b8;padding:6px 14px;background:#1a1230;border-top:1px solid #2a2048;letter-spacing:1px;flex-shrink:0;text-align:center;}
/* Table */
.fcm-tbl{width:100%;border-collapse:collapse;font-size:12px;}
/* #9 thead center */
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
.fcm-btn-red   {border-color:#801010;color:#f08080;}.fcm-btn-red:hover{background:#2a0808;border-color:#d04040;color:#ffb0b0;}.fcm-btn-purple{border-color:#7030b8;color:#c080f0;}.fcm-btn-purple:hover{background:#2a1040;border-color:#c080f0;}
.fcm-btn-blue  {border-color:#184888;color:#80c8ff;}.fcm-btn-blue:hover{background:#0a1e38;border-color:#4098d8;color:#c0e8ff;}
.fcm-btn-green {border-color:#104830;color:#60d890;}.fcm-btn-green:hover{background:#081e10;border-color:#30b858;color:#a0ffc0;}
.fcm-btn-orange{border-color:#604010;color:#f0a050;}.fcm-btn-orange:hover{background:#281808;border-color:#c06820;color:#ffc880;}
.fcm-empty{padding:50px;text-align:center;color:#4a3870;font-size:12px;letter-spacing:1px;}
.fcm-warn{padding:8px 16px;font-size:11px;color:#f0a060;background:#20100a;border-bottom:1px solid #601c08;flex-shrink:0;}
.fcm-settings-wrap{padding:24px;display:flex;flex-direction:column;gap:20px;overflow-y:auto;}
.fcm-set-row{display:flex;align-items:flex-start;gap:14px;padding:6px 0;}
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
.fcm-divider{height:1px;background:#2a2048;margin:6px 0;}
.fcm-wce-tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;white-space:nowrap;}
.fcm-wce-tag-yes{background:rgba(16,80,40,.5);border:1px solid #30a060;color:#70e0a0;}
.fcm-reload-status{font-size:11px;color:#80c090;min-height:0;transition:opacity .3s;}
        `;
        document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════════
    //  UI STATE
    // ═══════════════════════════════════════════════════════════
    // ─── Room state ─────────────────────────────────────────────────────
    let _roomResults = [];          // current search results (room search tab)
    let _roomZoneFilter = 'X';
    let _roomSearchQ2 = '';
    let _favRooms = new Set(JSON.parse(localStorage.getItem('fcmFavRooms') || '[]'));
    let _roomSortMode = 'fav';
    // Persistent room info cache (Name → {MemberCount, MemberLimit, Space, ts})
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
            _cacheRooms(res.value); // update persistent cache
            return res.value;
        } catch(e) { console.warn('🐈‍⬛ [FCM] doRoomSearch:', e); return []; }
    }

    // Query a specific room by name (tries all zones) - updates cache and DOM cell
    const _pendingRoomQueries = new Set();
    async function queryRoomInfo(roomName, space, onUpdate) {
        if (_pendingRoomQueries.has(roomName)) return;
        _pendingRoomQueries.add(roomName);
        try {
            // Try friend's known space first, then others if not found
            const zones = space !== undefined ? [space, 'X', '', 'M'] : ['X', '', 'M'];
            for (const z of [...new Set(zones)]) {
                try {
                    const res = await ServerRoomSearch(roomName, { Language: '', Space: z, Game: '', FullRooms: false });
                    if (!res || res.err || !res.value) continue;
                    const found = res.value.find(r => r.Name === roomName);
                    if (found) {
                        _cacheRooms([found]);
                        if (onUpdate) onUpdate(_roomCache.get(roomName));
                        break;
                    }
                } catch {}
            }
        } finally { _pendingRoomQueries.delete(roomName); }
    }

    function getCachedRoomInfo(roomName) {
        // First check _roomCache, then fall back to _roomResults
        const cached = _roomCache.get(roomName);
        if (cached) return cached;
        const fromResults = _roomResults.find(r => r.Name === roomName);
        if (fromResults) {
            const mc = fromResults.MemberCount ?? fromResults.NbMember ?? null;
            const ml = fromResults.MemberLimit ?? fromResults.Limit ?? null;
            return mc !== null || ml !== null ? { MemberCount: mc, MemberLimit: ml } : null;
        }
        return null;
    }

    let panelEl = null, miniEl = null, panelOpen = false, panelMini = false;
    let uiTab = 'friends', roomSubTab = 'members';
    let searchQ = '', roomSearchQ = '', sortMode = 'rel', roomSortMode = 'name'; // #5
    let searchDebounce = null, roomSearchDebounce = null;
    const filters = { online: true, offline: false, owner: false, lover: false, sub: false, friend: false, whitelist: false, blacklist: false };

    // ═══════════════════════════════════════════════════════════
    //  ELEMENT HELPERS
    // ═══════════════════════════════════════════════════════════
    function makeAvEl(mn, profile) {
        const el = document.createElement('div'); el.className = 'fcm-av';
        if (cfg.avatars) {
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === parseInt(mn));
            if (C && C.Canvas && C.Canvas.width > 0) {
                try { const cv = document.createElement('canvas'); cv.width = cv.height = 36; const ctx = cv.getContext('2d'), src = C.Canvas; ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, 36, 36); const img = document.createElement('img'); img.src = cv.toDataURL('image/jpeg', 0.85); el.appendChild(img); return el; } catch {}
            }
            if (profile && profile.avatarDataUrl) {
                const img = document.createElement('img'); img.src = profile.avatarDataUrl; el.appendChild(img); return el;
            }
            // #2 Try async bundle load
            if (profile && profile.characterBundle && !profile.avatarDataUrl) {
                queueAvatarLoad(mn, profile, url => {
                    if (url && el.isConnected) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
                });
            }
        }
        el.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
        return el;
    }

    const REL_LABEL = () => ({ owner: T('relOwner'), lover: T('relLover'), sub: T('relSub'), friend: T('relFriend'), contact: T('relContact'), whitelist: T('relWhitelist'), blacklist: T('relBlacklist'), ghost: T('relGhost'), none: '—' });
    function makeRelEl(rel) {
        // Accept either a string or array of roles
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

    function makeSearchWrap(initialValue, placeholder, onInput, extraClass) {
        const wrap = document.createElement('div'); wrap.className = 'fcm-search-wrap';
        const inp = document.createElement('input'); inp.className = 'fcm-search' + (extraClass ? ' ' + extraClass : ''); inp.placeholder = placeholder; inp.value = initialValue;
        const clrBtn = document.createElement('button'); clrBtn.className = 'fcm-clear-btn'; clrBtn.textContent = '×'; clrBtn.title = 'Clear';
        clrBtn.addEventListener('click', e => { e.stopPropagation(); inp.value = ''; inp.focus(); onInput(''); });
        inp.addEventListener('input', () => onInput(inp.value));
        wrap.appendChild(inp); wrap.appendChild(clrBtn);
        return { wrap, inp };
    }

    // #7 Build FULL room management buttons for all contexts
    function buildMgmtBtns(mn, context) {
        if (!ChatRoomData) return null;
        const wrap = document.createElement('div'); wrap.className = 'fcm-btns';
        const isAdm = !!(ChatRoomData.Admin && ChatRoomData.Admin.some(a => parseInt(a) === mn));
        const isWht = !!(ChatRoomData.Whitelist && ChatRoomData.Whitelist.some(a => parseInt(a) === mn));
        const isBan = !!(ChatRoomData.Ban && ChatRoomData.Ban.some(a => parseInt(a) === mn));

        // Admin toggle
        wrap.appendChild(mkBtn(isAdm ? T('btnRmAdmin') : T('btnAddAdmin'), isAdm ? 'fcm-btn-red' : 'fcm-btn-orange', () => roomOp(mn, isAdm ? 'rmAdmin' : 'makeAdmin')));
        // Whitelist toggle
        wrap.appendChild(mkBtn(isWht ? T('btnRmWhite') : T('btnAddWhite'), isWht ? 'fcm-btn-red' : 'fcm-btn-green', () => roomOp(mn, isWht ? 'rmWhite' : 'addWhite')));
        // Ban / Unban toggle
        if (isBan) wrap.appendChild(mkBtn(T('btnRmBan'), 'fcm-btn-green', () => roomOp(mn, 'unban')));
        else wrap.appendChild(mkBtn(T('btnAddBan'), 'fcm-btn-red', () => roomOp(mn, 'ban')));
        // Kick (only for in-room)
        if (context === 'members' && inRoom(mn)) wrap.appendChild(mkBtn(T('btnKick'), 'fcm-btn-red', () => showConfirm(T('confirmKick', getDisplayName(mn)), () => roomOp(mn, 'kick'), isZh() ? '逐出' : 'Kick')));

        return wrap;
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
        [['friends', T('tabFriends')], ['room', T('tabRoom')], ['roomSearch', T('tabRoomSearch')], ['settings', T('tabSettings')]].forEach(([key, label]) => {
            const t = document.createElement('div'); t.className = 'fcm-tab' + (key === uiTab ? ' active' : ''); t.dataset.tab = key; t.textContent = label;
            t.addEventListener('click', () => {
                if (key === 'room' && !(typeof ChatRoomData !== 'undefined' && ChatRoomData)) {
                    // Not in a room - don't switch but show room tab content (it shows its own message)
                }
                uiTab = key;
                tabBar.querySelectorAll('.fcm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === key));
                renderCurrent();
            }); tabBar.appendChild(t);
        });
        const content = document.createElement('div'); content.id = 'fcm-content';
        panel.appendChild(hdr); panel.appendChild(tabBar); panel.appendChild(content);
        document.body.appendChild(panel); panelEl = panel;
        // Drag
        let drag = { on: false, ox: 0, oy: 0 };
        hdr.addEventListener('mousedown', e => { if (e.target === minBtn || e.target === closeBtn) return; drag.on = true; const r = panel.getBoundingClientRect(); drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top; panel.style.transform = 'none'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (!drag.on) return; panel.style.left = (e.clientX - drag.ox) + 'px'; panel.style.top = (e.clientY - drag.oy) + 'px'; });
        document.addEventListener('mouseup', () => { drag.on = false; });
        // Mini pill
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
        // Update room tab disabled state dynamically
        const inRoom = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData);
        panelEl.querySelectorAll('.fcm-tab[data-tab="room"]').forEach(rt => {
            rt.classList.toggle('fcm-tab-disabled', !inRoom);
            rt.title = inRoom ? '' : T('notInRoom');
        });
        const scrollEl = content.querySelector('.fcm-scroll');
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
        const p = uiTab === 'friends' ? renderFriends(content) : uiTab === 'room' ? renderRoom(content) : uiTab === 'roomSearch' ? Promise.resolve(renderRoomSearch(content)) : Promise.resolve(renderSettings(content));
        (p || Promise.resolve()).then(() => {
            if (savedScroll > 0) { const ns = content.querySelector('.fcm-scroll'); if (ns) ns.scrollTop = savedScroll; }
        }).catch(e => console.warn('🐈‍⬛ [FCM] render:', e));
    }

    function applyFilters(f) {
        const rel = f.rel, online = isOnline(f.mn);
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

    // ─── Helper: make sort+label for toolbar right side ───
    function makeSortSel(currentMode, options, onChange) {
        const lbl = document.createElement('span'); lbl.className = 'fcm-lbl-sm'; lbl.textContent = T('sortBy') + ':';
        const sel = document.createElement('select'); sel.className = 'fcm-sel';
        options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === currentMode) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => onChange(sel.value));
        return { lbl, sel };
    }

    // ─── Helper: count bar ───
    function makeCountBar(n) {
        const d = document.createElement('div'); d.className = 'fcm-count'; d.textContent = T('total', n); return d;
    }

    // ═══════════════════════════════════════════════════════════
    //  FRIENDS TAB
    // ═══════════════════════════════════════════════════════════
    async function renderFriends(container) {
        container.innerHTML = '';
        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

        // Search + clear
        const { wrap: sw, inp: searchEl } = makeSearchWrap(searchQ, T('search'), val => {
            searchQ = val; clearTimeout(searchDebounce);
            searchDebounce = setTimeout(async () => { const pos = searchQ.length; await renderFriends(container); const ns = container.querySelector('.fcm-toolbar .fcm-search'); if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch {} } }, 400);
        });
        toolbar.appendChild(sw);

        // #4 Filters (labeled '顯示') + filter toggles
        const fl = document.createElement('span'); fl.className = 'fcm-lbl-sm'; fl.textContent = T('showOnly') + ':';
        toolbar.appendChild(fl);
        [['online', T('fOnline')], ['offline', T('fOffline')], ['owner', T('fOwner')], ['lover', T('fLover')], ['sub', T('fSub')], ['friend', T('fFriend')], ['whitelist', T('fWhitelist')], ['blacklist', T('fBlacklist')]].forEach(([key, label]) => {
            const b = document.createElement('button'); b.className = 'fcm-ftog' + (filters[key] ? ' on' : ''); b.textContent = label;
            b.addEventListener('click', () => { filters[key] = !filters[key]; b.classList.toggle('on', filters[key]); renderFriends(container); });
            toolbar.appendChild(b);
        });

        // #4 Sort + #3 Nick toggle on far right (Nick left of Sort)
        toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const nickBtn = document.createElement('button'); nickBtn.className = 'fcm-nick-tog'; nickBtn.textContent = showNickname ? T('togNick') : T('togName');
        nickBtn.title = isZh() ? (showNickname ? '切換為BC名稱' : '切換為暱稱') : (showNickname ? 'Switch to BC name' : 'Switch to nickname');
        nickBtn.addEventListener('click', () => { showNickname = !showNickname; renderFriends(container); });
        toolbar.appendChild(nickBtn);
        const { lbl: sl, sel: sortSel } = makeSortSel(sortMode, [['rel', T('sortRel')], ['id', T('sortId')], ['name', T('sortName')], ['added', T('sortAdded')]], v => { sortMode = v; renderFriends(container); });
        toolbar.appendChild(sl); toolbar.appendChild(sortSel);
        const rBtnF2 = mkBtn('↻', 'fcm-btn', () => renderFriends(container));
        rBtnF2.title = isZh() ? '重新整理' : 'Refresh'; rBtnF2.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtnF2);
        container.appendChild(toolbar);

        // Data
        let friends = buildFriendList();
        if (searchQ.trim()) { const q = searchQ.trim().toLowerCase(); friends = friends.filter(f => f.name.toLowerCase().includes(q) || String(f.mn).includes(q)); }
        friends = friends.filter(applyFilters);
        switch (sortMode) {
            case 'id':    friends.sort((a, b) => a.mn - b.mn); break;
            case 'name':  friends.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'added': friends.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
            default:      friends.sort((a, b) => { const d = REL_ORDER[a.rel] - REL_ORDER[b.rel]; return d || a.name.localeCompare(b.name); });
        }
        await PDB.batchGet(friends.map(f => f.mn));
        // Refresh names now profiles are loaded (profile.name=BC name, profile.lastNick=nickname)
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
        // #9 th center (fcm-th-left for name col)
        [['', 'width:42px'], [T('colName'), 'min-width:120px', 'fcm-th-left'], [T('colId'), ''], [T('colRel'), ''], [T('colZone'), ''], [T('colRoom'), 'min-width:100px'], [T('colOps'), 'min-width:150px']].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        if (inARoom) { const th = document.createElement('th'); th.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); th.className = (isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'); th.style.cssText = 'min-width:140px;max-width:155px;width:150px;'; thRow.appendChild(th); }
        const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');

        for (const f of friends) {
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const online = isOnline(f.mn), zone = getZone(f.mn), room = getRoomName(f.mn);
            const profile = _pc[f.mn] || null, isInRoom = inRoom(f.mn), isFriend = isFriendOf(f.mn);

            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(f.mn, profile)); tr.appendChild(avTd);
            const nameTd = document.createElement('td');
            const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = f.name; nd.title = f.name;
            const sd = document.createElement('div'); sd.className = 'fcm-sta ' + (online ? 'fcm-online' : 'fcm-offline'); sd.textContent = online ? T('online') : T('offline');
            nameTd.appendChild(nd); nameTd.appendChild(sd); tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(f.mn));
            // Multi-role relationship
            const allRoles = getAllRels(f.mn);
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.style.minWidth = '60px'; relTd.appendChild(makeRelEl(allRoles)); tr.appendChild(relTd);
            // Zone: '-' if offline
            const zt = document.createElement('td'); zt.style.textAlign = 'center';
            const zs = document.createElement('span'); zs.className = 'fcm-zone';
            const riZone = getRoomInfo(f.mn);
            const hideZone = !online || (online && riZone === null) || (riZone && !riZone.name && riZone.isPrivate);
            zs.textContent = hideZone ? '—' : (zone || T('zoneUnk')); zt.appendChild(zs); tr.appendChild(zt);
            // Room: show from cache immediately; trigger async query if uncached
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
                if (ri.isCurrent && typeof ChatRoomCharacter !== 'undefined') {
                    mc = ChatRoomCharacter.length; ml = ChatRoomData?.MemberLimit ?? null;
                } else {
                    const cd = getCachedRoomInfo(ri.name);
                    if (cd) { mc = cd.MemberCount; ml = cd.MemberLimit; }
                }
                rt.appendChild(_buildRoomLink(ri, mc, ml));
                // Fire async cache refresh if not in current room and count unknown
                if (!ri.isCurrent && mc === null) {
                    const friendSpace = onlineFriends.find(ff => ff.MemberNumber === f.mn)?.ChatRoomSpace;
                    queryRoomInfo(ri.name, friendSpace, data => {
                        if (data && rt.isConnected) {
                            rt.innerHTML = '';
                            rt.appendChild(_buildRoomLink(ri, data.MemberCount, data.MemberLimit));
                        }
                    });
                }
            } else if (ri && !ri.name && ri.isPrivate) {
                const sp = document.createElement('span'); sp.style.cssText = 'font-size:11px;color:#c090f0;font-weight:600;';
                sp.textContent = isZh() ? '(私密)' : '(Private)'; rt.appendChild(sp);
            } else { rt.innerHTML = '<span class="fcm-room">—</span>'; }
            tr.appendChild(rt);

            // 其他
            const opsTd = document.createElement('td'); const ops = document.createElement('div'); ops.className = 'fcm-btns';
            const hasProfile = !!(profile && profile.characterBundle);
            const vb = mkBtn(T('btnView'), '', () => doView(f.mn)); if (!isInRoom && !hasProfile) vb.disabled = true; ops.appendChild(vb);
            if (canBeep(f.mn)) ops.appendChild(mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(f.mn)));
            const _sep = document.createElement('span'); _sep.style.cssText = 'width:6px;display:inline-block;'; ops.appendChild(_sep);
            if (!isFriend) ops.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green', () => showConfirm(isZh()?`添加「${getDisplayName(f.mn)}」為好友？`:`Add "${getDisplayName(f.mn)}" as friend?`, () => doAddFriend(f.mn))));
            else ops.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red', () => showConfirm(T('confirmDel', getDisplayName(f.mn)), () => doRemoveFriend(f.mn), isZh()?'移除':'Remove')));
            const _dname = getDisplayName(f.mn);
            const _isWhl = (Player.WhiteList||[]).includes(f.mn), _isBl = (Player.BlackList||[]).includes(f.mn);
            const _isGh = (() => { try { return (Player.GhostList||[]).includes(f.mn); } catch { return false; } })();
            ops.appendChild(mkBtn(_isWhl ? T('btnRmWhite') : T('btnAddWhite'), _isWhl ? 'fcm-btn-red' : 'fcm-btn-green', () => showConfirm(_isWhl?(isZh()?`移除「${_dname}」白名單？`:`Remove "${_dname}" from whitelist?`):(isZh()?`將「${_dname}」加入白名單？`:`Add "${_dname}" to whitelist?`), () => doToggleList(f.mn,'white',!_isWhl))));
            ops.appendChild(mkBtn(_isBl ? T('btnRmBan') : T('btnAddBan'), 'fcm-btn-red', () => showConfirm(_isBl?(isZh()?`移除「${_dname}」黑名單？`:`Remove "${_dname}" from blacklist?`):(isZh()?`⚠ 加入黑名單「${_dname}」？`:`⚠ Blacklist "${_dname}"?`), () => doToggleList(f.mn,'black',!_isBl), _isBl?undefined:(isZh()?'加入':'Add'))));
            ops.appendChild(mkBtn(_isGh?(isZh()?'-幽靈':'-Ghost'):(isZh()?'+幽靈':'+Ghost'), _isGh?'fcm-btn-red':'fcm-btn-purple', () => showConfirm(_isGh?(isZh()?`移除「${_dname}」幽靈？`:`Remove "${_dname}" from ghost?`):(isZh()?`將「${_dname}」加入幽靈？`:`Add "${_dname}" to ghost?`), () => doToggleList(f.mn,'ghost',!_isGh))));
            opsTd.appendChild(ops); tr.appendChild(opsTd);

            // 房管
            if (inARoom) {
                const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin ? '' : ' no-perm');
                const mb = buildMgmtBtns(f.mn, 'friends'); if (mb) mgmtTd.appendChild(mb); tr.appendChild(mgmtTd);
            }
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        wrapper.appendChild(scroll);
        // #1 count bar
        wrapper.appendChild(makeCountBar(friends.length));
        container.appendChild(wrapper);
    }

    // ═══════════════════════════════════════════════════════════
    //  ROOM TAB
    // ═══════════════════════════════════════════════════════════
    async function renderRoom(container) {
        container.innerHTML = '';
        if (typeof ChatRoomData === 'undefined' || !ChatRoomData) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('notInRoom'); container.appendChild(em); return; }
        const isAdmin = amAdmin();
        if (!isAdmin) { const w = document.createElement('div'); w.className = 'fcm-warn'; w.textContent = T('noAdminWarn'); container.appendChild(w); }

        // Sub-tabs
        const stabs = document.createElement('div'); stabs.className = 'fcm-subtabs';
        ['members', 'admin', 'white', 'ban'].forEach(key => {
            const t = document.createElement('div'); t.className = 'fcm-stab' + (roomSubTab === key ? ' active' : ''); t.textContent = T('roomTabs')[key];
            t.addEventListener('click', () => { roomSubTab = key; renderRoom(container); }); stabs.appendChild(t);
        });
        container.appendChild(stabs);

        const canAddHere = isAdmin && roomSubTab !== 'members';

        // Toolbar: search + add (left), sort (right)
        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

        function isNumericQ(v) { const mn = parseInt(v); return mn > 0 && String(mn) === v.trim() && v.trim().length > 0; }

        let addBtn; // ref needed in debounce
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
                const mn = parseInt(roomSearchQ);
                if (!mn || mn < 100) return;
                if (roomSubTab === 'admin') roomOp(mn, 'makeAdmin');
                else if (roomSubTab === 'white') roomOp(mn, 'addWhite');
                else if (roomSubTab === 'ban') roomOp(mn, 'ban');
                clearTimeout(roomSearchDebounce);
                rsEl.value = ''; roomSearchQ = '';
                addBtn.disabled = true;
            });
            addBtn.title = T('btnAddTitle');
            addBtn.disabled = !isNumericQ(roomSearchQ);
            rsEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !addBtn.disabled) { e.preventDefault(); addBtn.click(); } e.stopPropagation(); });
            toolbar.appendChild(addBtn);
        }

        // Nick toggle + Sort on right
        toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const rNickBtn = document.createElement('button'); rNickBtn.className = 'fcm-nick-tog'; rNickBtn.textContent = showNickname ? T('togNick') : T('togName');
        rNickBtn.title = isZh() ? (showNickname ? '切換為BC名稱' : '切換為暱稱') : (showNickname ? 'Switch to BC name' : 'Switch to nickname');
        rNickBtn.addEventListener('click', () => { showNickname = !showNickname; renderRoom(container); });
        toolbar.appendChild(rNickBtn);
        const { lbl: rsl, sel: rsortSel } = makeSortSel(roomSortMode, [['name', T('sortName')], ['id', T('sortId')], ['rel', T('sortRel')], ['perm', T('permAdmin')]], v => { roomSortMode = v; renderRoom(container); });
        toolbar.appendChild(rsl); toolbar.appendChild(rsortSel);
        const rBtnR = mkBtn('↻', 'fcm-btn', () => renderRoom(container));
        rBtnR.title = isZh() ? '重新整理' : 'Refresh'; rBtnR.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtnR);
        container.appendChild(toolbar);

        // Member list
        let mns = [];
        if (roomSubTab === 'members') mns = (ChatRoomData.Character || []).map(c => c.MemberNumber);
        else if (roomSubTab === 'admin') mns = [...(ChatRoomData.Admin || [])];
        else if (roomSubTab === 'white') mns = [...(ChatRoomData.Whitelist || [])];
        else if (roomSubTab === 'ban')   mns = [...(ChatRoomData.Ban || [])];

        if (roomSearchQ.trim()) { const q = roomSearchQ.trim().toLowerCase(); mns = mns.filter(mn => getDisplayName(mn).toLowerCase().includes(q) || String(mn).includes(q)); }

        // #5 Apply room sort
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
            const profile = _pc[mn] || null, isInRoom = inRoom(mn), isFriend = isFriendOf(mn), isMe = mn === Player.MemberNumber;

            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(mn, profile)); tr.appendChild(avTd);
            const nameTd = document.createElement('td'); const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = name; nd.title = name; nameTd.appendChild(nd);
            if (isMe) { const yl = document.createElement('div'); yl.className = 'fcm-you'; yl.textContent = T('youLabel'); nameTd.appendChild(yl); }
            tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(mn));
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(rel)); tr.appendChild(relTd);
            const permTd = document.createElement('td'); const pd = document.createElement('div'); pd.className = 'fcm-perms'; perms.forEach(p => pd.appendChild(makePermEl(p))); permTd.appendChild(pd); tr.appendChild(permTd);

            // 動作
            const opsTd = document.createElement('td'); const ops = document.createElement('div'); ops.className = 'fcm-btns';
            const hasProfile = !!(profile && profile.characterBundle);
            const vb = mkBtn(T('btnView'), '', () => doView(mn)); if (!isInRoom && !hasProfile) vb.disabled = true; ops.appendChild(vb);
            if (!isMe) {
                if (isInRoom) ops.appendChild(mkBtn(T('btnWhisper'), '', () => doWhisper(mn)));
                if (canBeep(mn)) ops.appendChild(mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(mn)));
                // Space before friend/list buttons
                const _rsep = document.createElement('span'); _rsep.style.cssText = 'width:6px;display:inline-block;'; ops.appendChild(_rsep);
                if (!isFriend) ops.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green', () => showConfirm(isZh()?`添加「${getDisplayName(mn)}」為好友？`:`Add "${getDisplayName(mn)}" as friend?`, () => doAddFriend(mn))));
                else ops.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red', () => showConfirm(T('confirmDel', getDisplayName(mn)), () => doRemoveFriend(mn), isZh()?'移除':'Remove')));
                const _rm = getDisplayName(mn);
                const _rWhl = (Player.WhiteList||[]).includes(mn), _rBl = (Player.BlackList||[]).includes(mn);
                const _rGh = (() => { try { return (Player.GhostList||[]).includes(mn); } catch { return false; } })();
                ops.appendChild(mkBtn(_rWhl?T('btnRmWhite'):T('btnAddWhite'), _rWhl?'fcm-btn-red':'fcm-btn-green', () => showConfirm(_rWhl?(isZh()?`移除「${_rm}」白名單？`:`Remove "${_rm}" from whitelist?`):(isZh()?`將「${_rm}」加入白名單？`:`Add "${_rm}" to whitelist?`), () => doToggleList(mn,'white',!_rWhl))));
                ops.appendChild(mkBtn(_rBl?T('btnRmBan'):T('btnAddBan'), 'fcm-btn-red', () => showConfirm(_rBl?(isZh()?`移除「${_rm}」黑名單？`:`Remove "${_rm}" from blacklist?`):(isZh()?`⚠ 加入黑名單「${_rm}」？`:`⚠ Blacklist "${_rm}"?`), () => doToggleList(mn,'black',!_rBl), _rBl?undefined:(isZh()?'加入':'Add'))));
                ops.appendChild(mkBtn(_rGh?(isZh()?'-幽靈':'-Ghost'):(isZh()?'+幽靈':'+Ghost'), _rGh?'fcm-btn-red':'fcm-btn-purple', () => showConfirm(_rGh?(isZh()?`移除「${_rm}」幽靈？`:`Remove "${_rm}" from ghost?`):(isZh()?`將「${_rm}」加入幽靈？`:`Add "${_rm}" to ghost?`), () => doToggleList(mn,'ghost',!_rGh))));
            }
            opsTd.appendChild(ops); tr.appendChild(opsTd);

            // #7 全功能房管欄 (all sub-tabs get full buttons)
            const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin && !isMe ? '' : ' no-perm');
            if (!isMe) { const mb = buildMgmtBtns(mn, roomSubTab); if (mb) mgmtTd.appendChild(mb); }
            tr.appendChild(mgmtTd);
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        wrapper.appendChild(scroll);
        // #1 count bar
        wrapper.appendChild(makeCountBar(mns.length));
        container.appendChild(wrapper);
    }

    // ─── Settings ───
    // ═══════════════════════════════════════════════════════════
    //  PROFILES DB UTILITIES
    // ═══════════════════════════════════════════════════════════
    async function exportProfiles() {
        try {
            const allProfiles = await new Promise((res, rej) => {
                const req = PDB.db.transaction('profiles','readonly').objectStore('profiles').getAll();
                req.onsuccess = () => res(req.result);
                req.onerror = () => rej(req.error);
            });
            // Try to get notes too (if store exists)
            let notes = [];
            try {
                if (PDB.db.objectStoreNames.contains('notes')) {
                    notes = await new Promise((res,rej) => {
                        const req = PDB.db.transaction('notes','readonly').objectStore('notes').getAll();
                        req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
                    });
                }
            } catch {}
            const data = { exportedAt: new Date().toISOString(), dbVersion: PDB.db.version, profiles: allProfiles, notes };
            const today = new Date(); const ymd = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `bce-past-profiles-${ymd}.json`; a.click(); URL.revokeObjectURL(a.href);
            return allProfiles.length;
        } catch(e) { console.error('🐈‍⬛ [FCM] export error:', e); return 0; }
    }

    async function importProfiles(file) {
        try {
            const data = JSON.parse(await file.text());
            let pc = 0, nc = 0;
            if (Array.isArray(data.profiles) && PDB.db) {
                const tx = PDB.db.transaction('profiles','readwrite');
                const store = tx.objectStore('profiles');
                for (const p of data.profiles) {
                    // Merge: keep the one with newer 'seen' time
                    const existing = await new Promise(res => { const r = store.get(p.memberNumber); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
                    const existSeen = existing?.seen || existing?.savedAt || 0;
                    const newSeen = p.seen || p.savedAt || 0;
                    if (!existing || newSeen >= existSeen) { store.put(p); _pc[p.memberNumber] = p; pc++; }
                }
            }
            if (Array.isArray(data.notes) && PDB.db && PDB.db.objectStoreNames.contains('notes')) {
                const tx2 = PDB.db.transaction('notes','readwrite');
                const store2 = tx2.objectStore('notes');
                for (const n of data.notes) { store2.put(n); nc++; }
            }
            return { pc, nc };
        } catch(e) { console.error('🐈‍⬛ [FCM] import error:', e); return { pc:0, nc:0 }; }
    }

    // Profiles search panel
    function showProfilesPanel(filter) {
        const ex = document.getElementById('fcm-profiles-overlay'); if (ex) { ex.remove(); return; }
        if (!PDB.db) return;

        const overlay = document.createElement('div'); overlay.id = 'fcm-profiles-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100002;display:flex;align-items:center;justify-content:center;';
        overlay.addEventListener('click', () => overlay.remove());

        const box = document.createElement('div');
        box.style.cssText = 'background:#1e1635;border:2px solid #5a48a8;border-radius:14px;padding:20px;width:min(700px,94vw);max-height:80vh;box-shadow:0 12px 60px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:12px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());

        const hdr = document.createElement('div'); hdr.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#e8c8ff;font-size:14px;font-weight:700;letter-spacing:1px;flex:1;'; titleEl.textContent = T('profilesTitle');
        const closeBtn = document.createElement('button'); closeBtn.className = 'fcm-btn'; closeBtn.textContent = '×'; closeBtn.style.cssText = 'width:28px;height:28px;border-radius:50%;font-size:16px;';
        closeBtn.addEventListener('click', () => overlay.remove());
        hdr.appendChild(titleEl); hdr.appendChild(closeBtn);

        const searchWrap = document.createElement('div'); searchWrap.className = 'fcm-search-wrap'; searchWrap.style.width = '100%';
        const searchEl = document.createElement('input'); searchEl.className = 'fcm-search'; searchEl.style.width = '100%';
        searchEl.placeholder = T('searchProfiles'); searchEl.value = filter || '';
        const clrBtn = document.createElement('button'); clrBtn.className = 'fcm-clear-btn'; clrBtn.textContent = '×';
        clrBtn.addEventListener('click', () => { searchEl.value = ''; doSearch(''); });
        searchWrap.appendChild(searchEl); searchWrap.appendChild(clrBtn);

        const scrollArea = document.createElement('div'); scrollArea.className = 'fcm-scroll'; scrollArea.style.cssText = 'max-height:52vh;border:1px solid #2a2048;border-radius:8px;';
        const countEl = document.createElement('div'); countEl.className = 'fcm-count';

        const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
        tbl.innerHTML = '<thead><tr><th style="width:42px"></th><th style="text-align:left;min-width:140px">' + T('colName') + '</th><th>' + T('colId') + '</th><th>' + T('colRel') + '</th><th>' + (isZh() ? '最後見面' : 'Last Seen') + '</th><th style="min-width:80px"></th></tr></thead>';
        const tbody = document.createElement('tbody'); tbl.appendChild(tbody);
        scrollArea.appendChild(tbl);

        box.appendChild(hdr); box.appendChild(searchWrap); box.appendChild(scrollArea); box.appendChild(countEl);
        overlay.appendChild(box); document.body.appendChild(overlay);

        let allProfiles = [];
        const req = PDB.db.transaction('profiles','readonly').objectStore('profiles').getAll();
        req.onsuccess = () => {
            allProfiles = req.result || [];
            allProfiles.sort((a,b) => (b.seen||b.savedAt||0) - (a.seen||a.savedAt||0));
            doSearch(searchEl.value);
        };

        function doSearch(q) {
            q = q.trim().toLowerCase();
            const filtered = q ? allProfiles.filter(p => (p.name||'').toLowerCase().includes(q) || (p.lastNick||'').toLowerCase().includes(q) || String(p.memberNumber).includes(q)) : allProfiles;
            tbody.innerHTML = '';
            const show = filtered.slice(0, 100);
            countEl.textContent = T('profilesTotal', show.length, filtered.length);
            for (const p of show) {
                const tr = document.createElement('tr'); tr.className = 'fcm-row';
                // Avatar
                const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(p.memberNumber, p)); tr.appendChild(avTd);
                // Name
                const nameTd = document.createElement('td'); nameTd.style.maxWidth = '140px';
                const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = (showNickname && p.lastNick) || p.name || '#' + p.memberNumber; nd.title = nd.textContent;
                const sd = document.createElement('div'); sd.className = 'fcm-id'; sd.textContent = (p.lastNick && !showNickname) ? p.name || '' : (p.lastNick ? p.name : '');
                nameTd.appendChild(nd); if (sd.textContent) nameTd.appendChild(sd); tr.appendChild(nameTd);
                // ID
                tr.appendChild(makeIdCell(p.memberNumber));
                // Rel
                const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(getRel(p.memberNumber))); tr.appendChild(relTd);
                // Last seen
                const seenTd = document.createElement('td'); seenTd.className = 'fcm-id'; seenTd.style.textAlign = 'center';
                const seenTime = p.seen || p.savedAt; seenTd.textContent = seenTime ? new Date(seenTime).toLocaleDateString() : '—'; tr.appendChild(seenTd);
                // Open button
                const opsTd = document.createElement('td');
                if (p.characterBundle) {
                    const openBtn = mkBtn(T('btnView'), '', () => { overlay.remove(); doView(p.memberNumber); });
                    opsTd.appendChild(openBtn);
                }
                tr.appendChild(opsTd);
                tbody.appendChild(tr);
            }
        }

        let debounce;
        searchEl.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => doSearch(searchEl.value), 300); });
        searchEl.focus();
    }

    // Clear avatar cache and trigger reload
    function reloadAvatarCache() {
        Object.values(_pc).forEach(p => { if (p) { p.avatarDataUrl = null; p._avatarLoading = false; } });
        // Clear from DB
        if (PDB.db) {
            try {
                const tx = PDB.db.transaction('profiles', 'readwrite');
                const store = tx.objectStore('profiles');
                const req = store.openCursor();
                req.onsuccess = e => {
                    const cursor = e.target.result;
                    if (cursor) { const v = cursor.value; v.avatarDataUrl = null; cursor.update(v); cursor.continue(); }
                };
            } catch {}
        }
        renderCurrent();
    }

    // ─── Room Search ───────────────────────────────────────────────────
    async function renderRoomSearch(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

        // Toolbar: [↻] [search] [搜尋] [混合] [女性] [男性]   [sort]
        const tb = document.createElement('div'); tb.className = 'fcm-toolbar';

        // Refresh (before search)
        const earlyRef = mkBtn('↻', 'fcm-btn', () => runSearch());
        earlyRef.style.cssText = 'padding:5px 8px;border-radius:8px;font-size:14px;flex-shrink:0;';
        earlyRef.title = isZh() ? '刷新' : 'Refresh'; tb.appendChild(earlyRef);

        // Search input
        const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:120px;max-width:200px;';
        const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.placeholder = T('roomSearch2'); inp.value = _roomSearchQ2;
        inp.style.width = '100%';
        const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
        clrX.addEventListener('click', () => { inp.value = ''; _roomSearchQ2 = ''; });
        sw.appendChild(inp); sw.appendChild(clrX); tb.appendChild(sw);

        // Search button
        const srchBtn = mkBtn(T('roomSearchBtn'), 'fcm-btn', () => runSearch());
        srchBtn.style.cssText = 'padding:5px 10px;border-radius:8px;border:1.5px solid #4038a0;background:#1e1635;color:#b098d0;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;';
        tb.appendChild(srchBtn);

        // Zone buttons
        const zoneColors = {
            'X': { bg: '#1e1635', active: '#2e2650', label: isZh() ? '混合' : 'Mixed' },
            '':  { bg: '#2a1020', active: '#7a2040', label: isZh() ? '女性' : 'Female' },
            'M': { bg: '#101828', active: '#1a4070', label: isZh() ? '男性' : 'Male' }
        };
        const zoneGroup = document.createElement('div'); zoneGroup.style.cssText = 'display:flex;gap:3px;';
        Object.entries(zoneColors).forEach(([z, info]) => {
            const b = document.createElement('button'); b.setAttribute('data-space', z);
            b.textContent = info.label;
            const isActive = _roomZoneFilter === z;
            b.style.cssText = `padding:5px 10px;border-radius:8px;border:1.5px solid ${isActive ? '#d0b8ff' : '#4038a0'};background:${isActive ? info.active : info.bg};color:${isActive ? '#fff' : '#9070b0'};font-size:12px;font-weight:${isActive ? '700' : '400'};cursor:pointer;white-space:nowrap;`;
            b.addEventListener('click', () => {
                _roomZoneFilter = z;
                zoneGroup.querySelectorAll('[data-space]').forEach(x => {
                    const xz = x.getAttribute('data-space'), xi = zoneColors[xz], xa = xz === z;
                    x.style.background = xa ? xi.active : xi.bg;
                    x.style.borderColor = xa ? '#d0b8ff' : '#4038a0';
                    x.style.color = xa ? '#fff' : '#9070b0';
                    x.style.fontWeight = xa ? '700' : '400';
                });
                runSearch();
            });
            zoneGroup.appendChild(b);
        });
        tb.appendChild(zoneGroup);

        // Spacer + sort
        tb.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
        const sLbl = document.createElement('span'); sLbl.className = 'fcm-lbl-sm'; sLbl.textContent = T('sortBy') + ':'; tb.appendChild(sLbl);
        const sortSel = document.createElement('select'); sortSel.className = 'fcm-sel';
        [['fav', isZh() ? '最愛優先' : 'Fav First'], ['friend', isZh() ? '好友優先' : 'Friends First'], ['name', isZh() ? '名稱優先' : 'Name']].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === _roomSortMode) o.selected = true; sortSel.appendChild(o);
        });
        sortSel.addEventListener('change', () => { _roomSortMode = sortSel.value; renderResults(); });
        tb.appendChild(sortSel);
        const rBtnRS2 = mkBtn('↻', 'fcm-btn', () => runSearch());
        rBtnRS2.title = isZh() ? '重新整理' : 'Refresh'; rBtnRS2.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        tb.appendChild(rBtnRS2);
        wrap.appendChild(tb);

        const scroll = document.createElement('div'); scroll.style.cssText = 'flex:1;overflow-y:auto;';
        const countEl = document.createElement('div'); countEl.className = 'fcm-count'; countEl.style.textAlign = 'center';
        wrap.appendChild(scroll); wrap.appendChild(countEl);
        container.appendChild(wrap);

        inp.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); e.stopPropagation(); });

        async function runSearch() {
            _roomSearchQ2 = inp.value;
            srchBtn.textContent = T('roomSearching'); srchBtn.disabled = true; earlyRef.disabled = true;
            _roomResults = await doRoomSearch(_roomSearchQ2, _roomZoneFilter);
            srchBtn.textContent = T('roomSearchBtn'); srchBtn.disabled = false; earlyRef.disabled = false;
            renderResults();
        }

        function renderResults() {
            scroll.innerHTML = '';
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
                const friendsHere = onlineFriends.filter(f => f.ChatRoomName === room.Name);
                const mc = room.MemberCount ?? room.NbMember ?? null;
                const ml = room.MemberLimit ?? room.Limit ?? null;
                const cStr = mc !== null ? `(${mc}${ml !== null ? '/'+ml : ''})` : '';
                const card = document.createElement('div');
                card.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;transition:background .1s;' +
                    (isFav ? 'border:1.5px solid #c8a020;border-radius:8px;margin:3px 4px;background:rgba(200,160,32,.06);' :
                     friendsHere.length > 0 ? 'border:1.5px solid #409060;border-radius:8px;margin:3px 4px;background:rgba(40,128,64,.06);' :
                     'border-bottom:1px solid #2a2048;');
                card.addEventListener('mouseenter', () => { if (!isFav && !friendsHere.length) card.style.background = '#261a4a'; });
                card.addEventListener('mouseleave', () => { if (!isFav && !friendsHere.length) card.style.background = ''; });

                const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
                const line1 = document.createElement('div'); line1.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';
                // ★ fav btn before name
                const favBtn = document.createElement('button');
                favBtn.style.cssText = 'font-size:15px;padding:0 3px;border:none;background:transparent;cursor:pointer;color:' + (isFav ? '#f0d060' : '#5040a0') + ';flex-shrink:0;';
                favBtn.textContent = isFav ? '★' : '☆';
                favBtn.addEventListener('click', e => { e.stopPropagation(); if (_favRooms.has(room.Name)) _favRooms.delete(room.Name); else _favRooms.add(room.Name); saveFavRooms(); renderResults(); });
                line1.appendChild(favBtn);
                const nm = document.createElement('span'); nm.style.cssText = 'color:#e8c8ff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;'; nm.textContent = room.Name || '?'; nm.title = room.Name; line1.appendChild(nm);
                if (cStr) { const cnt = document.createElement('span'); cnt.style.cssText = 'color:#9878b8;font-size:12px;flex-shrink:0;'; cnt.textContent = cStr; line1.appendChild(cnt); }
                if (friendsHere.length > 0) { const fb = document.createElement('span'); fb.style.cssText = 'font-size:11px;background:#102038;border:1px solid #4080d8;color:#80c8ff;border-radius:6px;padding:2px 7px;flex-shrink:0;'; fb.textContent = `👥${friendsHere.length}: ${friendsHere.map(f => f.MemberName||'#'+f.MemberNumber).join(', ')}`; line1.appendChild(fb); }
                if (room.Private) { const priv = document.createElement('span'); priv.style.cssText = 'font-size:11px;background:#2a1048;border:1px solid #8060b0;color:#c090f0;border-radius:6px;padding:2px 7px;flex-shrink:0;'; priv.textContent = T('roomPrivateLabel'); line1.appendChild(priv); }
                info.appendChild(line1);
                if (room.Description) { const desc = document.createElement('div'); desc.style.cssText = 'color:#7060a0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;'; desc.textContent = room.Description; info.appendChild(desc); }
                card.appendChild(info);
                // Join button
                const joinBtn = mkBtn(T('roomJoin'), 'fcm-btn-blue', () => navigateToRoom(room.Name));
                joinBtn.style.cssText += ';padding:7px 16px;font-size:13px;font-weight:700;flex-shrink:0;';
                card.appendChild(joinBtn);
                scroll.appendChild(card);
            });
        }

        if (_roomResults.length === 0) runSearch(); else renderResults();
    }

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
        function divider() { const d = document.createElement('div'); d.className = 'fcm-divider'; wrap.appendChild(d); }

        // ── 1. Language ──────────────────────────────────────────────
        const langRow = document.createElement('div'); langRow.className = 'fcm-set-row'; langRow.style.alignItems = 'center';
        const langInfo = document.createElement('div'); langInfo.style.flex = '1';
        const langLbl = document.createElement('div'); langLbl.className = 'fcm-set-label'; langLbl.textContent = T('langLabel');
        const langNote2 = document.createElement('div'); langNote2.className = 'fcm-set-note';
        try { const tl = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : ''); langNote2.textContent = T('langNote') + '  ' + T('langDetected', tl); } catch { langNote2.textContent = T('langNote'); }
        langInfo.appendChild(langLbl); langInfo.appendChild(langNote2);
        const langSel = document.createElement('select'); langSel.className = 'fcm-sel'; langSel.style.flexShrink = '0';
        [['auto', 'Auto'], ['zh', '中文'], ['en', 'English']].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l;
            if (v === (cfg.lang || 'auto')) o.selected = true;
            langSel.appendChild(o);
        });
        langSel.addEventListener('change', () => {
            cfg.lang = langSel.value; saveCfg();
            if (panelEl) { panelEl.remove(); panelEl = null; }
            if (miniEl) { miniEl.remove(); miniEl = null; }
            panelOpen = false; panelMini = false;
            buildPanel();
                uiTab = 'settings'; openPanel();
        });
        langRow.appendChild(langInfo); langRow.appendChild(langSel);
        wrap.appendChild(langRow);
        divider();

        // ── 2. Avatars ───────────────────────────────────────────────
        const avRow = settingRow(T('setAvatars'), T('setAvatarsNote'), cfg.avatars, v => { cfg.avatars = v; saveCfg(); });
        const reloadBtn = document.createElement('button'); reloadBtn.className = 'fcm-btn fcm-btn-green';
        reloadBtn.textContent = T('btnReloadAvatars'); reloadBtn.style.cssText = 'font-size:11px;padding:6px 12px;flex-shrink:0;margin-left:auto;';
        reloadBtn.title = T('reloadAvatarsNote');
        const statusEl = document.createElement('div'); statusEl.className = 'fcm-reload-status';
        _avStatusEl = statusEl;
        reloadBtn.addEventListener('click', () => {
            reloadBtn.disabled = true; reloadBtn.textContent = isZh() ? '清除中...' : 'Clearing...';
            reloadAvatarCache();
            setTimeout(() => { reloadBtn.disabled = false; reloadBtn.textContent = T('btnReloadAvatars'); }, 2000);
        });
        avRow.appendChild(reloadBtn);
        wrap.appendChild(avRow);
        wrap.appendChild(statusEl);
        divider();

        // ── 3. Whisper indicator + collapsible color picker ──────────
        const wiWrap = document.createElement('div');
        // Toggle row: left=toggle+info, right=color button
        const wiToggleRow = document.createElement('div'); wiToggleRow.style.cssText = 'display:flex;align-items:center;gap:14px;';
        const wiTog = mkToggle(cfg.whisperIndicator, v => { cfg.whisperIndicator = v; saveCfg(); if (v) startWhisperIndicator(); else stopWhisperIndicator(); });
        wiTog.style.flexShrink = '0';
        const wiInfo = document.createElement('div'); wiInfo.style.flex = '1';
        const wiLbl = document.createElement('div'); wiLbl.className = 'fcm-set-label'; wiLbl.textContent = T('whisperIndicatorLabel');
        const wiNote = document.createElement('div'); wiNote.className = 'fcm-set-note'; wiNote.textContent = T('whisperIndicatorNote');
        wiInfo.appendChild(wiLbl); wiInfo.appendChild(wiNote);
        // Color button (right side) with label
        const wiColorLabelBtn = document.createElement('span');
        wiColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;';
        wiColorLabelBtn.textContent = isZh() ? '修改顏色' : 'Color';
        const wiColorBtn = document.createElement('button');
        wiColorBtn.style.cssText = `width:28px;height:28px;border-radius:50%;background:${cfg.whisperColor||'#b070e8'};border:2px solid #6040a0;cursor:pointer;flex-shrink:0;transition:border-color .15s;`;
        wiColorBtn.title = isZh() ? '選擇顏色' : 'Pick color';
        let wiColorOpen = false;
        const wiColorPanel = document.createElement('div');
        wiColorPanel.style.cssText = 'display:none;padding:10px 0 4px 56px;';
        // Preset swatches row
        const swatchRow = document.createElement('div'); swatchRow.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;';
        const presets = ['#b070e8','#e870c0','#70aaff','#70e8b0','#f0c040','#e87070','#ff9040','#ffffff'];
        const updateColorBtn = (color) => {
            wiColorBtn.style.background = color;
            wiColorBtn.style.boxShadow = `0 0 0 3px ${color}55`;
        };
        const allSwatches = [];
        presets.forEach(color => {
            const sw = document.createElement('button');
            sw.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid ${cfg.whisperColor===color?'#fff':'transparent'};cursor:pointer;flex-shrink:0;transition:border .15s;`;
            sw.addEventListener('click', () => {
                cfg.whisperColor = color; saveCfg(); updateColorBtn(color);
                allSwatches.forEach(s => s.style.borderColor = 'transparent');
                sw.style.borderColor = '#fff';
                customInp.value = color;
            });
            allSwatches.push(sw); swatchRow.appendChild(sw);
        });
        // Custom color input
        const customInp = document.createElement('input'); customInp.type = 'color'; customInp.value = cfg.whisperColor || '#b070e8';
        customInp.style.cssText = 'width:30px;height:24px;border-radius:6px;border:1px solid #5048a0;background:#1a1030;cursor:pointer;padding:1px;';
        customInp.title = isZh() ? '自訂顏色' : 'Custom color';
        customInp.addEventListener('input', () => {
            cfg.whisperColor = customInp.value; saveCfg(); updateColorBtn(customInp.value);
            allSwatches.forEach(s => s.style.borderColor = 'transparent');
        });
        swatchRow.appendChild(customInp);
        wiColorPanel.appendChild(swatchRow);
        wiColorLabelBtn.addEventListener('click', () => { wiColorBtn.click(); });
        wiColorBtn.addEventListener('click', () => {
            wiColorOpen = !wiColorOpen;
            wiColorPanel.style.display = wiColorOpen ? 'block' : 'none';
            wiColorBtn.style.borderColor = wiColorOpen ? '#d0a0ff' : '#6040a0';
        });
        wiToggleRow.appendChild(wiTog); wiToggleRow.appendChild(wiInfo); wiToggleRow.appendChild(wiColorLabelBtn); wiToggleRow.appendChild(wiColorBtn);
        wiWrap.appendChild(wiToggleRow); wiWrap.appendChild(wiColorPanel);
        wrap.appendChild(wiWrap);
        updateColorBtn(cfg.whisperColor || '#b070e8');
        divider();

        // ── 3b. Ghost Hide ───────────────────────────────────────────
        wrap.appendChild(settingRow(T('ghostHideLabel'), T('ghostHideNote'), cfg.ghostHide, v => {
            cfg.ghostHide = v; saveCfg(); applyGhostHide(v);
        }));
        divider();

        // ── 4. Save mode ─────────────────────────────────────────────
        const smRow = document.createElement('div'); smRow.className = 'fcm-set-row'; smRow.style.alignItems = 'center';
        const smInfo = document.createElement('div'); smInfo.style.flex = '1'; smInfo.style.display = 'flex'; smInfo.style.alignItems = 'center'; smInfo.style.flexWrap = 'wrap'; smInfo.style.gap = '6px';
        const smLbl = document.createElement('div'); smLbl.className = 'fcm-set-label'; smLbl.textContent = T('saveModeLabel');
        smInfo.appendChild(smLbl);
        const wceTag = document.createElement('span'); wceTag.style.display = 'none';
        detectWCESave().then(wceOn => {
            if (wceOn) { wceTag.className = 'fcm-wce-tag fcm-wce-tag-yes'; wceTag.textContent = isZh() ? '偵測到 WCE Profiles，啟用完整資料模式' : 'WCE Profiles detected'; wceTag.style.display = 'inline-block'; }
        });
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
        divider();

        // ── 5. Export / Import / Browse ──────────────────────────────
        const exportRow = document.createElement('div'); exportRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
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
            inp.onchange = async () => {
                const f = inp.files[0]; if (!f) return;
                const r = await importProfiles(f);
                if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('importDone', r.pc, r.nc), 5000);
                renderCurrent();
            };
            inp.click();
        }));
        exportRow.appendChild(mkActionBtn(T('profilesTitle'), T('profilesHint'), '', () => showProfilesPanel('')));
        wrap.appendChild(exportRow);

        container.appendChild(wrap);
    }

    // ═══════════════════════════════════════════════════════════
    //  PANEL STATE
    // ═══════════════════════════════════════════════════════════
    function openPanel() { if (!panelEl) buildPanel(); panelEl.classList.remove('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelOpen = true; panelMini = false; ServerSend('AccountQuery', { Query: 'OnlineFriends' }); renderCurrent(); }
    function minimizePanel() { if (!panelEl) return; panelEl.classList.add('hidden'); if (miniEl) miniEl.classList.add('visible'); panelMini = true; }
    function restorePanel() { if (!panelEl) buildPanel(); panelEl.classList.remove('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelMini = false; renderCurrent(); }
    function closePanel() { if (panelEl) panelEl.classList.add('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelOpen = false; panelMini = false; document.getElementById('fcm-beep-overlay')?.remove(); document.getElementById('fcm-confirm-overlay')?.remove(); }
    function togglePanel() { if (panelOpen || panelMini) closePanel(); else openPanel(); }

    // ═══════════════════════════════════════════════════════════
    //  BC HOOKS
    // ═══════════════════════════════════════════════════════════
    modApi.hookFunction('DrawProcess', 10, (args, next) => {
        next(args);
        // FCM button
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
            DrawButton(BTN_X, BTN_Y, BTN_W, BTN_H, '🎛', (panelOpen || panelMini) ? 'Pink' : 'Gray', '', 'Friends & Room Manager');
        }
        // Whisper indicator: check every 15 frames (~250ms)
        if (++_whisperDrawCount % 15 === 0) _applyWhisperStyle();
    });
    modApi.hookFunction('ChatRoomClick', 10, (args, next) => { if (MouseIn(BTN_X, BTN_Y, BTN_W, BTN_H)) { buildPanel(); togglePanel(); return; } next(args); });
    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => { closePanel(); return next(args); });

    // ═══════════════════════════════════════════════════════════
    //  INIT
    // ═══════════════════════════════════════════════════════════
    // Ghost hide via DrawCharacter hook (SDK 1.2.0 supports this, BCX-safe)
    modApi.hookFunction('DrawCharacter', 5, (args, next) => {
        try {
            const C = args[0];
            if (cfg.ghostHide && C && typeof Player !== 'undefined' && Player
                && C.MemberNumber !== Player.MemberNumber) {
                const gl = Player.GhostList;
                if (Array.isArray(gl) && gl.includes(C.MemberNumber)) return; // skip draw
            }
        } catch {}
        return next(args);
    });
    function applyGhostHide(enable) {
        console.log('🐈‍⬛ [FCM] Ghost hide ' + (enable ? 'enabled' : 'disabled'));
    }

    // ─── Whisper Indicator (via DrawProcess hook, runs every ~15 frames) ──
    let _whisperDrawCount = 0;
    function _applyWhisperStyle() {
        try {
            const el = document.getElementById('InputChat');
            if (!el) return;
            const val = el.value || '';
            const isCmd = /^\/(w|whisper|beep)\s/i.test(val);
            const isTgt = typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0;
            const wc = cfg.whisperColor || '#b070e8';
            if (cfg.whisperIndicator && (isCmd || isTgt)) {
                el.style.setProperty('box-shadow', `0 0 0 3px ${wc}cc, 0 0 14px ${wc}88`, 'important');
                el.style.setProperty('border', `2px solid ${wc}`, 'important');
                el.style.setProperty('outline', `1px solid ${wc}66`, 'important');
            } else {
                el.style.removeProperty('box-shadow');
                el.style.removeProperty('border');
                el.style.removeProperty('outline');
            }
        } catch {}
    }
    // startWhisperIndicator / stopWhisperIndicator kept for toggle UI compatibility
    function startWhisperIndicator() { _applyWhisperStyle(); }
    function stopWhisperIndicator() {
        try {
            const el = document.getElementById('InputChat');
            if (el) { el.style.removeProperty('box-shadow'); el.style.removeProperty('border'); el.style.removeProperty('outline'); }
        } catch {}
    }

    function init() {
        loadCfg(); // Load config first so hooks (ghost hide, etc.) use correct settings
        if (typeof ChatRoomCharacter === 'undefined' || typeof Player === 'undefined') return setTimeout(init, 500);
        PDB.init().then(async ok => {
            if (!ok) console.warn('🐈‍⬛ [FCM] Profile DB: no profiles store');
            // Auto-detect WCE on first run (if saveMode was never explicitly set)
            const stored = JSON.parse(localStorage.getItem('LikoFCM') || '{}');
            if (stored.saveMode === undefined) {
                const wceOn = await detectWCESave();
                if (wceOn) { cfg.saveMode = 'full'; saveCfg(); console.log('🐈‍⬛ [FCM] WCE detected → saveMode auto-set to full'); }
            }
        });
        buildPanel();
        // /profiles command
        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: 'profiles',
                Description: isZh() ? '<篩選> - 列出已儲存的 profiles（依名稱或 ID 篩選）' : '<filter> - List saved profiles (filter by name or ID)',
                Action: arg => showProfilesPanel(arg ? arg.trim() : ''),
            }]);
        }
        // Hook InformationSheet — priority 7 so we draw AFTER WCE (priority 6) and other mods
        modApi.hookFunction('InformationSheetRun', 7, (args, next) => {
            const r = next(args);
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                (InformationSheetSelection === Player.MemberNumber ||
                 InformationSheetSelection?.MemberNumber === Player.MemberNumber);
            if (viewingSelf && typeof DrawButton === 'function') {
                DrawButton(1705, 420, 90, 90, '', (panelOpen && !panelMini) ? '#3a1858' : 'White', 'Icons/FriendList.png', 'FCM');
            }
            return r;
        });
        modApi.hookFunction('InformationSheetClick', 7, (args, next) => {
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                (InformationSheetSelection === Player.MemberNumber ||
                 InformationSheetSelection?.MemberNumber === Player.MemberNumber);
            if (viewingSelf && typeof MouseIn === 'function' && MouseIn(1705, 420, 90, 90)) { openPanel(); return; }
            return next(args);
        });
        console.log(`🐈‍⬛ [FCM] ✅ v${MOD_VER} loaded`);
    }
    init();

})();
