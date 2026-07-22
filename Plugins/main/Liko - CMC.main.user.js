// ==UserScript==
// @name         Liko - Chat Music Controller
// @name:zh      Liko的聊天室音樂控制器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.3.1
// @description  Chat Music Controller with playlist sharing and lyrics support
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CMC.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CMC.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    if (window.Liko.CMC) return;
    const MOD_VER = "1.3.1";
    window.Liko.CMC = MOD_VER;

    const debugMode = false;
    function log(...args) { if (debugMode || window.CMC_DEBUG) console.log('[CMC]', ...args); }
    function error(...args) { console.error('[CMC]', ...args); }

    const CONSTANTS = {
        SYNC_TIME_THRESHOLD: 2,
        PROGRESS_UPDATE_INTERVAL: 100,
        CONTROLLER_CHECK_INTERVAL: 5000,
        LOADING_TIMEOUT: 5000,
        DEFAULT_VOLUME: 0.25,
        MAX_HISTORY_ROOMS: 10
    };

    function waitFor(condition, timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (condition()) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    const COLORS = {
        primary: '#9370db', light: '#ba55d3', dark: '#1C0230',
        accent: '#A355BB', highlight: '#ee82ee', dim: '#6a5acd'
    };

    let modApi = null;
    let cmcDB = null;

    // currentPlaylist = 當前 (in-memory, cleared on exit)
    // personalPlaylist = 個人 (persisted)
    // historyPlaylists = 歷史 (persisted, by room name)
    let musicPlayer = {
        currentPlaylist: [],
        personalPlaylist: [],
        historyPlaylists: {},
        historyRoomList: [],
        activeTab: 'current',
        historyViewRoom: null,

        currentIndex: -1,
        volume: CONSTANTS.DEFAULT_VOLUME,
        isPlaying: false,
        isLooping: false,

        floatingPanel: null,
        lyricsPanel: null,
        userListPanel: null,
        isPanelVisible: false,

        audioPlayer: null,
        isLoading: false,
        loadingTimeout: null,
        progressInterval: null,
        preloadPlayer: null,

        // rank: 0=not active, 1=controller, 2+=participant
        myControllerRank: 0,
        controllerCheckInterval: null,
        userListInterval: null,
        permissions: new Map(), // memberNumber → {canPlay, canEdit}

        currentLyrics: [],
        currentLyricIndex: -1,

        bcMusicURL: "",
        bcMusicMuted: false,
        bcOriginalMusicVolume: null, // 保存玩家原本的 MusicVolume，靜音期間強制為 0，cleanup 時還原

        ytPlayer: null,
        ytReady: false,
        isYouTube: false,

        isBilibili: false,
        biliDuration: 0,
        biliCurrentTime: 0,
        lastDisplayedSecond: -1,

        currentRoomName: "",
        playlistRequested: false,
        hiddenForNav: false,
    };

    // Compatibility alias: musicPlayer.playlist → currentPlaylist
    Object.defineProperty(musicPlayer, 'playlist', {
        get() { return this.currentPlaylist; },
        set(v) { this.currentPlaylist = v; }
    });

    // ============ URL 驗證 ============
    // Allowed media hostnames — direct audio/video CDNs and known platforms only
    const SAFE_HOSTS = [
        'youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be',
        'youtube-nocookie.com', 'www.youtube-nocookie.com',
        'bilibili.com', 'www.bilibili.com', 'player.bilibili.com', 'b23.tv',
        // Common audio CDNs / storage
        'cdn.discordapp.com', 'media.discordapp.net',
        'files.catbox.moe',
        'archive.org', 'ia800*.us.archive.org',
        'soundcloud.com', 'w.soundcloud.com',
        'dl.dropboxusercontent.com',
        'storage.googleapis.com',
        'onedrive.live.com',
        'github.com', 'raw.githubusercontent.com',
    ];
    function isSafeHost(url) {
        try {
            const host = new URL(url).hostname.toLowerCase();
            return SAFE_HOSTS.some(pattern => {
                if (pattern.includes('*')) {
                    const re = new RegExp('^' + pattern.replace(/\*/g, '[^.]+') + '$');
                    return re.test(host);
                }
                return host === pattern || host.endsWith('.' + pattern);
            });
        } catch(e) { return false; }
    }
    function isValidURL(url) {
        try {
            const u = new URL(encodeURI(url));
            if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
            return true;
        } catch(e) { return false; }
    }
    function isSafeMediaURL(url) {
        if (!isValidURL(url)) return false;
        if (isSafeHost(url)) return true;
        // Allow direct audio file extensions from any https host as fallback
        try {
            const path = new URL(url).pathname.toLowerCase().split('?')[0];
            return /\.(mp3|ogg|wav|flac|m4a|opus|webm|mp4)$/.test(path);
        } catch(e) { return false; }
    }
    function isBCCompatibleURL(url) {
        try {
            const lower = url.toLowerCase().split('?')[0];
            return lower.endsWith('.mp3') || lower.endsWith('.ogg') || lower.endsWith('.mp4');
        } catch(e) { return false; }
    }
    function isYouTubeURL(url) {
        try {
            const h = new URL(url).hostname.toLowerCase();
            return h.includes('youtube.com') || h === 'youtu.be' || h === 'www.youtu.be';
        } catch(e) { return false; }
    }
    function isBilibiliURL(url) {
        try {
            const h = new URL(url).hostname.toLowerCase();
            return h.includes('bilibili.com') || h.includes('b23.tv');
        } catch(e) { return false; }
    }
    function isAudioURL(url) {
        return isBCCompatibleURL(url) || isYouTubeURL(url) || isBilibiliURL(url);
    }
    function getYouTubeID(url) {
        try {
            const p = new URL(url);
            const h = p.hostname.toLowerCase();
            if (h === 'youtu.be' || h === 'www.youtu.be') return p.pathname.slice(1).split('?')[0];
            if (p.pathname === '/watch') return p.searchParams.get('v');
            if (p.pathname.startsWith('/shorts/')) return p.pathname.split('/')[2];
            if (p.pathname.startsWith('/embed/')) return p.pathname.split('/')[2];
            return null;
        } catch(e) { return null; }
    }
    // Returns {bvid, epid, ssid} — at least one will be non-null for valid Bilibili URLs
    function getBilibiliInfo(url) {
        try {
            const p = new URL(url);
            const path = p.pathname;
            const bvMatch = path.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
            if (bvMatch) return { bvid: bvMatch[1], epid: null, ssid: null };
            const epMatch = path.match(/\/bangumi\/play\/ep(\d+)/i);
            if (epMatch) return { bvid: null, epid: epMatch[1], ssid: null };
            const ssMatch = path.match(/\/bangumi\/play\/ss(\d+)/i);
            if (ssMatch) return { bvid: null, epid: null, ssid: ssMatch[1] };
            return null;
        } catch(e) { return null; }
    }
    function getBilibiliEmbedURL(info) {
        if (info.bvid)  return `https://player.bilibili.com/player.html?bvid=${info.bvid}&autoplay=1&isOutside=true`;
        if (info.epid)  return `https://player.bilibili.com/player.html?ep_id=${info.epid}&autoplay=1&isOutside=true`;
        if (info.ssid)  return `https://player.bilibili.com/player.html?season_id=${info.ssid}&autoplay=1&isOutside=true`;
        return null;
    }
    function sanitizeHTML(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ============ 控制者管理 (sequential rank, option B) ============
    // cmc.rank: 0=not active, 1=main controller, 2+=participant
    // cmc.list: current playlist count (for others to see)
    // Ranks are never maintained on join/leave — only rank-1 leaving triggers a promotion.
    // GrabControl (admin-only): forcibly take rank 1, old rank-1 is evicted.

    function getMyCmc() {
        return Player?.OnlineSharedSettings?.cmc || { rank: 0, list: 0, canPlay: 0, canEdit: 0 };
    }
    function setMyCmc(rank, list) {
        if (!Player?.OnlineSharedSettings) return;
        const cur = getMyCmc();
        const admin = ChatRoomPlayerIsAdmin() ? 1 : 0;
        Player.OnlineSharedSettings.cmc = {
            rank, list,
            canPlay: admin || cur.canPlay || 0,
            canEdit: admin || cur.canEdit || 0
        };
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
    }
    function setMyCmcPerms(canPlay, canEdit) {
        if (!Player?.OnlineSharedSettings) return;
        const cur = getMyCmc();
        Player.OnlineSharedSettings.cmc = { ...cur, canPlay: canPlay ? 1 : 0, canEdit: canEdit ? 1 : 0 };
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
    }
    function clearMyCmc() {
        if (!Player?.OnlineSharedSettings) return;
        Player.OnlineSharedSettings.cmc = { rank: 0, list: 0, canPlay: 0, canEdit: 0 };
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
    }

    // Returns all CMC users in room sorted by rank ascending (rank > 0 only)
    // Always includes self if registered (server echo may be delayed)
    function getControllerList() {
        const chars = ChatRoomData?.Character || [];
        const list = chars
            .filter(c => (c?.OnlineSharedSettings?.cmc?.rank ?? 0) > 0)
            .map(c => ({
                memberNumber: c.MemberNumber,
                rank: c.OnlineSharedSettings.cmc.rank,
                list: c.OnlineSharedSettings.cmc.list || 0,
                name: c.Name || String(c.MemberNumber)
            }));
        // Add self if not yet reflected in ChatRoomData (server echo delay)
        const myRank = getMyCmc().rank;
        if (myRank > 0 && !list.some(c => c.memberNumber === Player.MemberNumber)) {
            list.push({ memberNumber: Player.MemberNumber, rank: myRank, list: musicPlayer.currentPlaylist.length, name: Player.Name || String(Player.MemberNumber) });
        }
        return list.sort((a, b) => a.rank - b.rank);
    }

    function getMaxRank() {
        const list = getControllerList();
        return list.length > 0 ? list[list.length - 1].rank : 0;
    }

    // Called after any rank change to sync local state
    function recalcMyRank() {
        musicPlayer.myControllerRank = getMyCmc().rank;
    }

    // Register as CMC user. Anyone can open CMC and be listed.
    // Admins get rank 1 if no rank-1 exists yet; others get max+1.
    function registerController() {
        if (!musicPlayer.isPanelVisible) return;
        const current = getMyCmc().rank;
        if (current > 0) {
            // Already registered — update list count only
            setMyCmc(current, musicPlayer.currentPlaylist.length);
            recalcMyRank();
            return;
        }
        const existingList = getControllerList();
        const hasRank1 = existingList.some(c => c.rank === 1);
        // Anyone can become rank-1 if no controller exists yet
        const nextRank = hasRank1 ? getMaxRank() + 1 : 1;
        setMyCmc(nextRank, musicPlayer.currentPlaylist.length);
        musicPlayer.myControllerRank = nextRank;
        recalcMyRank();
        log('已登記 CMC rank:', musicPlayer.myControllerRank);
        if (musicPlayer.myControllerRank === 1) {
            sendLocalMsg('你是主控 (#1)，歌曲播完後將自動播放下一首', 8000);
        }
    }

    // Remove from controller list. If we were rank-1, promote next.
    function removeFromControllers() {
        const myRank = getMyCmc().rank;
        if (myRank === 0) return;

        if (myRank === 1) {
            // Find the member with the next smallest rank to promote
            const others = getControllerList().filter(c => c.memberNumber !== Player.MemberNumber);
            if (others.length > 0) {
                const next = others[0]; // smallest rank after us
                ServerSend("ChatRoomChat", {
                    Type: "Hidden", Content: "CMCSync",
                    Dictionary: [{ Action: "PromoteController", TargetMember: next.memberNumber, From: Player.MemberNumber }]
                });
            }
        }

        clearMyCmc();
        musicPlayer.myControllerRank = 0;
        log('已移除控制者');
    }

    // Admin grabs rank-1, evicting the current rank-1
    function grabControl() {
        if (!ChatRoomPlayerIsAdmin()) { sendLocalMsg("只有房管才能搶奪主控"); return; }
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "GrabControl", NewController: Player.MemberNumber, From: Player.MemberNumber }]
        });
        setMyCmc(1, musicPlayer.currentPlaylist.length);
        musicPlayer.myControllerRank = 1;
        sendLocalMsg('已取得主控 (#1)');
        updatePanelUI();
    }

    // Permission helpers — stored in cmc.canPlay/canEdit on each character's OnlineSharedSettings
    function getPermission(memberNumber) {
        if (ChatRoomCharacterIsAdmin(memberNumber)) return { canPlay: true, canEdit: true };
        // For self: read from Player directly (avoids stale ChatRoomData before server echo)
        if (memberNumber === Player.MemberNumber) {
            const cmc = Player?.OnlineSharedSettings?.cmc;
            if (cmc) return { canPlay: cmc.canPlay === 1, canEdit: cmc.canEdit === 1 };
        }
        // Local cache — updated immediately by setPermission() so admin UI refreshes without waiting for server echo
        const cached = musicPlayer.permissions.get(memberNumber);
        if (cached !== undefined) return cached;
        // Fallback: read from CharacterData (updated after server echo)
        const char = ChatRoomData?.Character?.find(c => c.MemberNumber === memberNumber);
        const cmc = char?.OnlineSharedSettings?.cmc;
        if (cmc) return { canPlay: cmc.canPlay === 1, canEdit: cmc.canEdit === 1 };
        return { canPlay: false, canEdit: false };
    }
    function setPermission(memberNumber, canPlay, canEdit) {
        // Update local cache immediately so admin UI reflects change without waiting for server echo
        musicPlayer.permissions.set(memberNumber, { canPlay: !!canPlay, canEdit: !!canEdit });
        // Send directly to the target only (no broadcast needed — others read cmc from CharacterData)
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "PermUpdate", TargetMember: memberNumber, CanPlay: canPlay ? 1 : 0, CanEdit: canEdit ? 1 : 0, From: Player.MemberNumber }],
            Target: memberNumber
        });
        updateUserListPanel(); // immediate visual refresh for admin
    }

    // canControlMusic: admin OR has canPlay permission
    function canControlMusic() {
        return ChatRoomPlayerIsAdmin() || (getPermission(Player.MemberNumber).canPlay);
    }
    // canEditPlaylist: admin OR has canEdit permission
    function canEditPlaylist() {
        return ChatRoomPlayerIsAdmin() || (getPermission(Player.MemberNumber).canEdit);
    }
    function isFirstController() { return musicPlayer.myControllerRank === 1; }

    // Swap rank with target (rank-1 only): yield control
    function swapRankWith(targetMemberNumber) {
        if (!isFirstController()) { sendLocalMsg("只有主控 (#1) 才能讓出控制"); return; }
        const list = getControllerList();
        const target = list.find(c => c.memberNumber === targetMemberNumber);
        if (!target) { sendLocalMsg(`成員 ${targetMemberNumber} 不在控制者列表中`); return; }
        const myOldRank = getMyCmc().rank;
        const targetOldRank = target.rank;
        setMyCmc(targetOldRank, musicPlayer.currentPlaylist.length);
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "SwapRank", TargetMember: targetMemberNumber, NewRank: myOldRank, From: Player.MemberNumber }]
        });
        musicPlayer.myControllerRank = targetOldRank;
        sendLocalMsg(`已與 ${targetMemberNumber} 互換順位，我的新順位: ${musicPlayer.myControllerRank}`);
        updatePanelUI();
    }

    // ============ BC 音樂靜音 ============
    // BC 的 AudioBackgroundMusicPlay() 在每次換歌時，會把 AudioBackgroundMusic.volume
    // 重設為 Player.AudioSettings.MusicVolume。直接把 .volume 設 0 每次都會被覆蓋回去，
    // 所以改成把「設定值本身」設為 0 —— 換歌重設後仍是 0，且 BC 會自己 pause 背景音樂
    // (見 AudioBackgroundMusicPlay / AudioBackgroundMusicSetVolume)，不需要再手動 stop。
    // 原始音量會被保存，並在 cleanup() (離開房間) 時還原，避免污染玩家帳號設定。
    function muteBCMusic() {
        if (!ChatRoomCustomized) return;
        try {
            if (musicPlayer.bcOriginalMusicVolume === null && Player?.AudioSettings) {
                musicPlayer.bcOriginalMusicVolume = Player.AudioSettings.MusicVolume ?? 0;
            }
            if (Player?.AudioSettings) Player.AudioSettings.MusicVolume = 0;
            // 立即靜音當前已在播放的實例 (只改設定要到下次換歌才生效，故同步把元素音量設 0)
            AudioBackgroundMusic.volume = 0;
        } catch(e) {}
        musicPlayer.bcMusicMuted = true;
        log('BC音樂已靜音 (MusicVolume=0)');
    }
    function muteBCIfNeeded(url) {
        if (ChatRoomCustomized && isBCCompatibleURL(url)) muteBCMusic();
    }
    // 還原玩家原本的 BC 音樂音量 (離開房間 / 清理時呼叫)
    function unmuteBCMusic() {
        if (musicPlayer.bcOriginalMusicVolume !== null) {
            try {
                if (Player?.AudioSettings) Player.AudioSettings.MusicVolume = musicPlayer.bcOriginalMusicVolume;
            } catch(e) {}
            musicPlayer.bcOriginalMusicVolume = null;
        }
        musicPlayer.bcMusicMuted = false;
    }

    // ============ 房間名 ============
    function getCurrentRoomName() {
        return ChatRoomData?.Name || ChatRoomData?.Description || "Unknown Room";
    }

    // ============ IndexedDB (v2) ============
    async function initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CMC_Database', 2);
            request.onerror = () => { error('IndexedDB 打開失敗:', request.error); reject(request.error); };
            request.onsuccess = () => { cmcDB = request.result; log('IndexedDB 初始化成功'); resolve(cmcDB); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
                // Keys: 'cmc_settings', 'personal_playlist', 'history_playlists'
                // Legacy 'cmc_data' is ignored (no migration needed, playlist is now in-memory only)
            };
        });
    }
    async function dbGet(key) {
        return new Promise((resolve, reject) => {
            const tx = cmcDB.transaction(['settings'], 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    async function dbPut(data) {
        return new Promise((resolve, reject) => {
            const tx = cmcDB.transaction(['settings'], 'readwrite');
            const req = tx.objectStore('settings').put(data);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
    async function loadSettingsFromDB() {
        if (!cmcDB) return;
        const settings = await dbGet('cmc_settings').catch(() => null);
        if (settings) {
            musicPlayer.volume = settings.volume ?? CONSTANTS.DEFAULT_VOLUME;
            musicPlayer.isLooping = settings.isLooping ?? false;
        }
        const personal = await dbGet('personal_playlist').catch(() => null);
        if (personal) musicPlayer.personalPlaylist = personal.tracks || [];
        const history = await dbGet('history_playlists').catch(() => null);
        if (history) {
            musicPlayer.historyPlaylists = history.rooms || {};
            musicPlayer.historyRoomList = history.roomList || [];
        }
        log('設定已從 IndexedDB 載入');
    }
    async function saveSettings() {
        if (!cmcDB) return;
        await dbPut({ id: 'cmc_settings', volume: musicPlayer.volume, isLooping: musicPlayer.isLooping }).catch(e => error('saveSettings失敗:', e));
    }
    async function savePersonalPlaylist() {
        if (!cmcDB) return;
        await dbPut({ id: 'personal_playlist', tracks: musicPlayer.personalPlaylist }).catch(e => error('savePersonal失敗:', e));
    }
    async function saveHistoryPlaylists() {
        if (!cmcDB) return;
        await dbPut({ id: 'history_playlists', roomList: musicPlayer.historyRoomList, rooms: musicPlayer.historyPlaylists }).catch(e => error('saveHistory失敗:', e));
    }

    // ============ 歷史歌單管理 ============
    function saveCurrentToHistory() {
        if (musicPlayer.currentPlaylist.length === 0) return;
        const roomName = getCurrentRoomName();
        // Find a unique key for this room
        let key = roomName;
        let suffix = 0;
        while (musicPlayer.historyPlaylists[key] !== undefined && suffix < 20) {
            suffix++;
            key = `${roomName}-${suffix}`;
        }
        musicPlayer.historyPlaylists[key] = [...musicPlayer.currentPlaylist];
        musicPlayer.historyRoomList.unshift(key);
        // Trim to max
        while (musicPlayer.historyRoomList.length > CONSTANTS.MAX_HISTORY_ROOMS) {
            const removed = musicPlayer.historyRoomList.pop();
            delete musicPlayer.historyPlaylists[removed];
        }
        saveHistoryPlaylists();
        log('歌單已保存到歷史:', key);
    }
    function deleteHistoryRoom(roomKey) {
        delete musicPlayer.historyPlaylists[roomKey];
        const idx = musicPlayer.historyRoomList.indexOf(roomKey);
        if (idx >= 0) musicPlayer.historyRoomList.splice(idx, 1);
        if (musicPlayer.historyViewRoom === roomKey) musicPlayer.historyViewRoom = null;
        saveHistoryPlaylists();
        renderPlaylistTab();
    }

    // ============ 歌單操作 ============
    function addToPersonal(track) {
        if (musicPlayer.personalPlaylist.some(t => t.url === track.url)) {
            sendLocalMsg(`已在個人歌單中: ${track.name || 'Unknown'}`);
            return;
        }
        musicPlayer.personalPlaylist.push({ name: track.name || 'Unknown', url: track.url });
        savePersonalPlaylist();
        sendLocalMsg(`已加入個人歌單: ${track.name || 'Unknown'}`);
        if (musicPlayer.activeTab === 'personal') renderPlaylistTab();
    }
    function addToCurrent(track) {
        if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); return; }
        if (musicPlayer.currentPlaylist.some(t => t.url === track.url)) {
            sendLocalMsg(`已在當前歌單中: ${track.name || 'Unknown'}`);
            return;
        }
        const t = { name: track.name || 'Unknown', url: track.url };
        musicPlayer.currentPlaylist.push(t);
        updatePanelUI();
        broadcastTrackAdd(t);
        sendLocalMsg(`已加入當前歌單: ${t.name}`);
    }
    function showAddToDialog(track) {
        const isAdmin = canEditPlaylist();
        if (!isAdmin) {
            // Guests can only add to personal
            addToPersonal(track);
            return;
        }
        const dialog = createDialog(`
            <div style="margin-bottom:15px;color:${COLORS.light};font-size:14px;">添加「${sanitizeHTML(track.name || 'Unknown')}」到：</div>
            <div style="display:flex;gap:10px;">
                <button id="add-current" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.accent};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.accent};cursor:pointer;">當前歌單</button>
                <button id="add-personal" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.primary};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.primary};cursor:pointer;">個人歌單</button>
                <button id="add-cancel" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.dim};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.dim};cursor:pointer;">取消</button>
            </div>
        `);
        dialog.querySelector('#add-current').onclick = () => { addToCurrent(track); closeDialog(dialog); };
        dialog.querySelector('#add-personal').onclick = () => { addToPersonal(track); closeDialog(dialog); };
        dialog.querySelector('#add-cancel').onclick = () => closeDialog(dialog);
    }

    // ============ 同步消息 ============
    function requestMusicSync() {
        // Request from rank-0 (broadcast, rank-0 responds)
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "RequestSync", From: Player.MemberNumber }]
        });
    }
    function requestMusicSyncFrom(targetMember) {
        // Request from a specific member (they respond if they have the list)
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "RequestSync", From: Player.MemberNumber, Target: targetMember }]
        });
    }
    function sendMusicState(target = null, includeTime = false, force = false) {
        if (!isFirstController() && !force) return;
        const data = {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{
                Action: "SyncState",
                Playlist: musicPlayer.currentPlaylist,
                CurrentIndex: musicPlayer.currentIndex,
                IsPlaying: musicPlayer.isPlaying,
                IsLooping: musicPlayer.isLooping,
                Volume: musicPlayer.volume,
                From: Player.MemberNumber
            }]
        };
        if (includeTime && musicPlayer.audioPlayer) data.Dictionary[0].CurrentTime = musicPlayer.audioPlayer.currentTime;
        if (target) data.Target = target;
        ServerSend("ChatRoomChat", data);
        log('已發送同步消息', includeTime ? '(含時間)' : '');
    }
    // Full playlist sync — only for import/sync-response (not for single add/remove)
    function broadcastPlaylistFull() {
        if (!canEditPlaylist()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "PlaylistUpdate", Playlist: musicPlayer.currentPlaylist, From: Player.MemberNumber }]
        });
        log('已廣播完整播放列表');
    }
    // Incremental: broadcast one added track
    function broadcastTrackAdd(track) {
        if (!canEditPlaylist()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "TrackAdd", Track: track, From: Player.MemberNumber }]
        });
        log('已廣播新增曲目:', track.name);
    }
    // Incremental: broadcast one removed track (by URL)
    function broadcastTrackRemove(trackUrl) {
        if (!canEditPlaylist()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "TrackRemove", TrackUrl: trackUrl, From: Player.MemberNumber }]
        });
        log('已廣播移除曲目:', trackUrl);
    }
    // Broadcast clear all
    function broadcastPlaylistClear() {
        if (!canEditPlaylist()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "PlaylistClear", From: Player.MemberNumber }]
        });
        log('已廣播清空播放列表');
    }
    function handleMusicSync(data) {
        if (!data.Dictionary?.[0]) return;
        const msg = data.Dictionary[0];

        if (msg.Action === "PlaylistUpdate") {
            // Full sync — accept from rank-1 controller
            const fromRank = ChatRoomData?.Character?.find(c => c.MemberNumber === msg.From)?.OnlineSharedSettings?.cmc?.rank ?? 0;
            if (!isFirstController() && fromRank === 1) {
                musicPlayer.currentPlaylist = msg.Playlist || [];
                updatePanelUI();
            }
            return;
        }

        if (msg.Action === "TrackAdd") {
            if (!isFirstController() && msg.Track) {
                const track = msg.Track;
                if (!musicPlayer.currentPlaylist.some(t => t.url === track.url)) {
                    musicPlayer.currentPlaylist.push(track);
                    updatePanelUI();
                    log('接收到新增曲目:', track.name);
                }
            }
            return;
        }

        if (msg.Action === "TrackRemove") {
            if (!isFirstController() && msg.TrackUrl) {
                const idx = musicPlayer.currentPlaylist.findIndex(t => t.url === msg.TrackUrl);
                if (idx >= 0) {
                    if (musicPlayer.currentIndex === idx) {
                        stopMusic();
                        musicPlayer.currentIndex = -1;
                    } else if (musicPlayer.currentIndex > idx) {
                        musicPlayer.currentIndex--;
                    }
                    musicPlayer.currentPlaylist.splice(idx, 1);
                    updatePanelUI();
                    log('接收到移除曲目:', msg.TrackUrl);
                }
            }
            return;
        }

        if (msg.Action === "PlaylistClear") {
            if (!isFirstController()) {
                musicPlayer.currentPlaylist = [];
                musicPlayer.currentIndex = -1;
                stopMusic();
                updatePanelUI();
                log('接收到清空播放列表');
            }
            return;
        }

        if (msg.Action === "RequestSync") {
            const askedMe = msg.Target === Player.MemberNumber;
            if (isFirstController()) {
                sendMusicState(msg.From, true);
            } else if (askedMe && getMyCmc().rank > 0 && musicPlayer.currentPlaylist.length > 0) {
                // Specifically asked, respond even if not rank-1 (target has the playlist)
                sendMusicState(msg.From, true, true);
            }
            return;
        }

        if (msg.Action === "PromoteController") {
            // Rank-1 left and nominated us as the new controller
            if (msg.TargetMember === Player.MemberNumber && getMyCmc().rank > 0) {
                setMyCmc(1, musicPlayer.currentPlaylist.length);
                musicPlayer.myControllerRank = 1;
                sendLocalMsg('前主控離開，你成為新主控 (#1)，歌曲播完後將自動播放下一首', 8000);
                updatePanelUI();
            }
            return;
        }

        if (msg.Action === "GrabControl") {
            // Admin grabbed rank-1 — if we were rank-1, demote to 0
            if (getMyCmc().rank === 1 && msg.NewController !== Player.MemberNumber) {
                clearMyCmc();
                musicPlayer.myControllerRank = 0;
                sendLocalMsg(`${msg.NewController} 已取得主控`);
                updatePanelUI();
            }
            return;
        }

        if (msg.Action === "SwapRank") {
            // Someone swapped rank with us
            if (msg.TargetMember === Player.MemberNumber) {
                setMyCmc(msg.NewRank, musicPlayer.currentPlaylist.length);
                musicPlayer.myControllerRank = msg.NewRank;
                sendLocalMsg(`已接受順位交換，我的新順位: ${musicPlayer.myControllerRank}`);
                updatePanelUI();
            }
            return;
        }

        if (msg.Action === "PermUpdate") {
            // Only the target receives this (sent with Target field)
            if (msg.TargetMember === Player.MemberNumber) {
                setMyCmcPerms(msg.CanPlay, msg.CanEdit); // write into own cmc so others read it from CharacterData
                sendLocalMsg(`你的 CMC 權限已更新 — 點播:${msg.CanPlay?'✓':'✗'} 編輯:${msg.CanEdit?'✓':'✗'}`);
                updatePanelUI(); // refresh own UI so new permissions take effect immediately
            }
            return;
        }

        if (msg.Action === "PlayRequest") {
            // Someone with canPlay permission asked us (rank-1) to play a track
            if (isFirstController()) {
                const idx = msg.TrackIndex;
                if (idx >= 0 && idx < musicPlayer.currentPlaylist.length) {
                    playTrack(idx, true, msg.From);
                    // Broadcast so non-rank-1 UIs update to the new track
                    setTimeout(() => sendMusicState(null, false), 600);
                }
            }
            return;
        }

        if (msg.Action === "SyncState") {
            const senderRank = ChatRoomData?.Character?.find(c => c.MemberNumber === msg.From)?.OnlineSharedSettings?.cmc?.rank ?? 0;
            if (senderRank !== 1) return;
            if (isFirstController()) return;

            musicPlayer.currentPlaylist = msg.Playlist || [];
            musicPlayer.volume = msg.Volume ?? CONSTANTS.DEFAULT_VOLUME;
            musicPlayer.isLooping = msg.IsLooping ?? false;

            if (msg.CurrentIndex >= 0 && msg.CurrentIndex < musicPlayer.currentPlaylist.length) {
                if (msg.CurrentIndex !== musicPlayer.currentIndex) playTrack(msg.CurrentIndex, false);
                if (musicPlayer.audioPlayer && msg.CurrentTime !== undefined) {
                    const diff = Math.abs(musicPlayer.audioPlayer.currentTime - msg.CurrentTime);
                    if (diff > CONSTANTS.SYNC_TIME_THRESHOLD) musicPlayer.audioPlayer.currentTime = msg.CurrentTime;
                }
                if (!msg.IsPlaying && musicPlayer.isPlaying) {
                    musicPlayer.audioPlayer?.pause();
                    musicPlayer.isPlaying = false;
                } else if (msg.IsPlaying && !musicPlayer.isPlaying) {
                    musicPlayer.audioPlayer?.play();
                    musicPlayer.isPlaying = true;
                }
            }
            updatePanelUI();
            saveSettings();
        }
    }

    // ============ 更新房間音樂 URL ============
    function updateRoomMusicURL(url) {
        if (!isFirstController() || !ChatRoomPlayerIsAdmin()) return;
        try {
            muteBCMusic();
            ChatRoomData.Custom = ChatRoomData.Custom || {};
            ChatRoomData.Custom.MusicURL = url;
            ServerSend("ChatRoomAdmin", {
                MemberNumber: Player.ID,
                Room: ChatRoomGetSettings(ChatRoomData),
                Action: "Update"
            });
            log('已更新房間音樂URL:', url);
        } catch(e) { error('更新房間音樂URL失敗:', e); }
    }

    // ============ Audio 清理 ============
    function cleanupAudioPlayer() {
        if (!musicPlayer.audioPlayer) return;
        try {
            musicPlayer.audioPlayer.onended = null;
            musicPlayer.audioPlayer.onerror = null;
            musicPlayer.audioPlayer.oncanplay = null;
            musicPlayer.audioPlayer.onloadedmetadata = null;
            musicPlayer.audioPlayer.onplay = null;
            musicPlayer.audioPlayer.onpause = null;
            const p = musicPlayer.audioPlayer.pause();
            if (p?.catch) p.catch(() => {});
            musicPlayer.audioPlayer.src = '';
            musicPlayer.audioPlayer = null;
        } catch(e) { musicPlayer.audioPlayer = null; }
    }
    function cleanupYouTubePlayer() {
        if (musicPlayer.ytPlayer) {
            try { musicPlayer.ytPlayer.stopVideo(); musicPlayer.ytPlayer.destroy(); } catch(e) {}
            musicPlayer.ytPlayer = null;
        }
        musicPlayer.ytReady = false;
        musicPlayer.isYouTube = false;
        document.getElementById('cmc-yt-player')?.remove();
    }
    function cleanupBilibiliPlayer() {
        musicPlayer.isBilibili = false;
        musicPlayer.biliDuration = 0;
        musicPlayer.biliCurrentTime = 0;
        document.getElementById('cmc-bili-player')?.remove();
    }
    function biliSend(data) {
        const iframe = document.getElementById('cmc-bili-player');
        if (!iframe?.contentWindow) return;
        // Bilibili unofficial postMessage API (may vary by player version)
        iframe.contentWindow.postMessage(data, '*');
    }

    // ============ 音頻加載 ============
    function loadAudioTrack(url, onSuccess, onError) {
        if (musicPlayer.isLoading) { log('正在加載中，忽略請求'); return; }
        if (!isSafeMediaURL(url)) { if (onError) onError(new Error('無效或不允許的URL')); return; }

        musicPlayer.isLoading = true;
        muteBCIfNeeded(url);

        if (musicPlayer.loadingTimeout) { clearTimeout(musicPlayer.loadingTimeout); musicPlayer.loadingTimeout = null; }
        cleanupBilibiliPlayer();
        cleanupYouTubePlayer();
        cleanupAudioPlayer();

        setTimeout(() => {
            try {
                musicPlayer.audioPlayer = new Audio();
                musicPlayer.audioPlayer.src = url;
                musicPlayer.audioPlayer.volume = musicPlayer.volume;

                const forceUnlock = setTimeout(() => {
                    if (musicPlayer.isLoading) {
                        error('強制解除 isLoading 鎖');
                        musicPlayer.isLoading = false;
                        musicPlayer.isPlaying = false;
                        updatePanelUI();
                    }
                }, CONSTANTS.LOADING_TIMEOUT + 2000);

                musicPlayer.audioPlayer.oncanplay = () => {
                    clearTimeout(forceUnlock);
                    if (musicPlayer.loadingTimeout) { clearTimeout(musicPlayer.loadingTimeout); musicPlayer.loadingTimeout = null; }
                };

                musicPlayer.audioPlayer.play()
                    .then(() => {
                        // Re-apply volume after play starts (guards against any external mute interfering)
                        if (musicPlayer.audioPlayer) musicPlayer.audioPlayer.volume = musicPlayer.volume;
                        musicPlayer.isPlaying = true;
                        musicPlayer.isLoading = false;
                        log('播放成功');
                        if (onSuccess) onSuccess();
                    })
                    .catch(err => {
                        error('播放失敗:', err.name, err.message);
                        musicPlayer.isLoading = false;
                        musicPlayer.isPlaying = false;
                        if (onError) onError(err);
                    });
            } catch(e) {
                error('加載異常:', e);
                musicPlayer.isLoading = false;
                if (onError) onError(e);
            }
        }, 50);
    }
    function loadYouTubeTrack(url, onSuccess, onError) {
        const id = getYouTubeID(url);
        if (!id) { if (onError) onError(new Error('無法解析YouTube ID')); return; }

        musicPlayer.isLoading = true;
        musicPlayer.isYouTube = true;
        cleanupBilibiliPlayer();
        cleanupAudioPlayer();
        cleanupYouTubePlayer();
        musicPlayer.isYouTube = true;

        const iframe = document.createElement('iframe');
        iframe.id = 'cmc-yt-player';
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1`;
        iframe.allow = 'autoplay';
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;';
        document.body.appendChild(iframe);

        const forceUnlock = setTimeout(() => {
            if (musicPlayer.isLoading) {
                error('YouTube強制解除isLoading鎖');
                musicPlayer.isLoading = false;
                musicPlayer.isPlaying = false;
                updatePanelUI();
            }
        }, CONSTANTS.LOADING_TIMEOUT + 2000);

        musicPlayer.ytPlayer = new YT.Player('cmc-yt-player', {
            events: {
                onReady: (e) => {
                    clearTimeout(forceUnlock);
                    e.target.setVolume(musicPlayer.volume * 100);
                    musicPlayer.ytReady = true;
                    musicPlayer.isLoading = false;
                    musicPlayer.isPlaying = true;
                    muteBCIfNeeded(url);
                    startProgressUpdate();
                    updatePanelUI();
                    if (onSuccess) onSuccess();
                },
                onStateChange: (e) => {
                    if (e.data === 0) { // ended
                        if (musicPlayer.isLooping) {
                            try { musicPlayer.ytPlayer.seekTo(0, true); musicPlayer.ytPlayer.playVideo(); } catch(e2) {}
                        } else if (isFirstController()) {
                            const next = (musicPlayer.currentIndex + 1) % Math.max(musicPlayer.currentPlaylist.length, 1);
                            setTimeout(() => {
                                if (musicPlayer.currentPlaylist.length > 0) playTrack(next, true);
                            }, 300);
                        } else {
                            // Non-rank-0: replay current and wait for rank-0
                            try { musicPlayer.ytPlayer.seekTo(0, true); musicPlayer.ytPlayer.playVideo(); } catch(e2) {}
                        }
                    }
                },
                onError: (e) => {
                    clearTimeout(forceUnlock);
                    error('YouTube播放錯誤:', e.data);
                    musicPlayer.isLoading = false;
                    musicPlayer.isPlaying = false;
                    if (onError) onError(new Error('YouTube播放錯誤: ' + e.data));
                }
            }
        });
    }
    function loadBilibiliTrack(url, onSuccess, onError) {
        const info = getBilibiliInfo(url);
        if (!info) { if (onError) onError(new Error('無法解析Bilibili連結')); return; }
        const embedURL = getBilibiliEmbedURL(info);
        if (!embedURL) { if (onError) onError(new Error('無法生成Bilibili嵌入URL')); return; }

        musicPlayer.isLoading = true;
        cleanupBilibiliPlayer();
        cleanupAudioPlayer();
        cleanupYouTubePlayer();
        musicPlayer.isBilibili = true;
        musicPlayer.biliDuration = 0;
        musicPlayer.biliCurrentTime = 0;

        const iframe = document.createElement('iframe');
        iframe.id = 'cmc-bili-player';
        iframe.src = embedURL;
        iframe.allow = 'autoplay';
        iframe.sandbox = 'allow-scripts allow-same-origin allow-popups allow-forms';
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;';
        document.body.appendChild(iframe);

        // Listen for unofficial postMessage events from Bilibili player
        const biliMsgHandler = (e) => {
            if (!musicPlayer.isBilibili) { window.removeEventListener('message', biliMsgHandler); return; }
            try {
                const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                if (!d) return;
                // Time update: {type:'heartbeat', data:{time, duration}} or {type:'timeupdate', ...}
                const t = d.type || d.event || d.msg_type || '';
                if (t === 'heartbeat' || t === 'timeupdate') {
                    const payload = d.data || d.payload || d;
                    if (payload.duration) musicPlayer.biliDuration = payload.duration;
                    if (payload.time !== undefined) musicPlayer.biliCurrentTime = payload.time;
                    else if (payload.currentTime !== undefined) musicPlayer.biliCurrentTime = payload.currentTime;
                }
                if (t === 'ended' || t === 'end' || t === 'finish') {
                    if (!musicPlayer.isLooping) {
                        if (isFirstController()) {
                            const next = (musicPlayer.currentIndex + 1) % Math.max(musicPlayer.currentPlaylist.length, 1);
                            setTimeout(() => { if (musicPlayer.currentPlaylist.length > 0) playTrack(next, true); }, 300);
                        } else {
                            biliSend({ type: 'seek', payload: { time: 0 } });
                            biliSend({ type: 'play' });
                        }
                    }
                }
            } catch(ex) {}
        };
        window.addEventListener('message', biliMsgHandler);

        const forceUnlock = setTimeout(() => {
            if (musicPlayer.isLoading) {
                error('Bilibili強制解除isLoading鎖');
                musicPlayer.isLoading = false;
                musicPlayer.isPlaying = false;
                updatePanelUI();
            }
        }, CONSTANTS.LOADING_TIMEOUT + 2000);

        setTimeout(() => {
            clearTimeout(forceUnlock);
            if (!musicPlayer.isBilibili) return;
            musicPlayer.isLoading = false;
            musicPlayer.isPlaying = true;
            muteBCIfNeeded(url);
            startProgressUpdate();
            updatePanelUI();
            log('Bilibili播放器已載入:', embedURL);
            if (onSuccess) onSuccess();
        }, 2000);
    }

    function preloadNextTrack() {
        if (musicPlayer.currentPlaylist.length < 2) return;
        const nextIdx = (musicPlayer.currentIndex + 1) % musicPlayer.currentPlaylist.length;
        if (nextIdx === musicPlayer.currentIndex) return;
        const next = musicPlayer.currentPlaylist[nextIdx];
        if (!isSafeMediaURL(next.url) || isYouTubeURL(next.url) || isBilibiliURL(next.url)) return;
        if (musicPlayer.preloadPlayer) { musicPlayer.preloadPlayer.src = ''; musicPlayer.preloadPlayer = null; }
        musicPlayer.preloadPlayer = new Audio();
        musicPlayer.preloadPlayer.src = next.url;
        musicPlayer.preloadPlayer.volume = 0;
        musicPlayer.preloadPlayer.preload = 'auto';
        log('預載下一首:', next.name);
    }

    // ============ 播放控制 ============
    function playTrack(trackIndex, sendNotification = true, requesterNumber = null) {
        if (trackIndex < 0 || trackIndex >= musicPlayer.currentPlaylist.length) return;
        if (musicPlayer.isLoading) return;
        if (musicPlayer.isPlaying && musicPlayer.currentIndex === trackIndex) return;

        muteBCMusic();
        const track = musicPlayer.currentPlaylist[trackIndex];
        musicPlayer.currentIndex = trackIndex;

        const loader = isYouTubeURL(track.url) ? loadYouTubeTrack
                     : isBilibiliURL(track.url) ? loadBilibiliTrack
                     : loadAudioTrack;
        loader(track.url, () => {
            muteBCIfNeeded(track.url);
            if (!musicPlayer.isYouTube && !musicPlayer.isBilibili) {
                if (!musicPlayer.audioPlayer) return;
                musicPlayer.audioPlayer.loop = musicPlayer.isLooping;
                musicPlayer.audioPlayer.onended = () => {
                    if (musicPlayer.isLooping) return; // handled by audio.loop = true
                    if (isFirstController()) {
                        // Rank-0: advance to next track and broadcast
                        const next = (musicPlayer.currentIndex + 1) % musicPlayer.currentPlaylist.length;
                        setTimeout(() => playTrack(next, true), 300);
                    } else {
                        // Non-rank-0: replay current song and wait for rank-0 to decide
                        if (musicPlayer.audioPlayer) {
                            musicPlayer.audioPlayer.currentTime = 0;
                            musicPlayer.audioPlayer.play().catch(() => {});
                        }
                    }
                };
            }
            updatePanelUI();
            saveSettings();
            startProgressUpdate();
            if (!musicPlayer.isYouTube && !musicPlayer.isBilibili) { loadLyrics(track.name); preloadNextTrack(); }

            // Update room URL first, then announce — so clients see the URL change before the notification
            const needUpdate = musicPlayer.bcMusicURL !== track.url;
            musicPlayer.bcMusicURL = track.url;
            if (needUpdate && isFirstController()) updateRoomMusicURL(track.url);
            if (sendNotification && isFirstController()) sendTrackNotification(track.name, requesterNumber);
        }, () => {
            sendLocalMsg(`播放失敗: ${track.name}`);
        });
    }

    // Play a URL not in the current playlist (show as Unknown)
    function playUnknownTrack(url) {
        if (musicPlayer.isLoading) return;
        const loader = isYouTubeURL(url) ? loadYouTubeTrack
                     : isBilibiliURL(url) ? loadBilibiliTrack
                     : loadAudioTrack;
        loader(url, () => {
            musicPlayer.currentIndex = -1;
            updatePanelUI();
            startProgressUpdate();
            log('播放未知曲目:', url);
        }, (err) => {
            sendLocalMsg(`播放失敗: ${err.message}`);
        });
    }

    function pauseMusic() {
        if (musicPlayer.isYouTube && musicPlayer.ytPlayer && musicPlayer.ytReady) {
            try { musicPlayer.ytPlayer.pauseVideo(); } catch(e) {}
        } else if (musicPlayer.isBilibili) {
            biliSend({ type: 'pause' });
            biliSend({ msg_type: 'pause' }); // alternate format
        } else if (musicPlayer.audioPlayer && !musicPlayer.audioPlayer.paused) {
            musicPlayer.audioPlayer.pause();
        }
        musicPlayer.isPlaying = false;
        updatePanelUI();
        stopProgressUpdate();
        if (isFirstController()) sendMusicState();
    }
    function resumeMusic() {
        if (musicPlayer.isYouTube && musicPlayer.ytPlayer && musicPlayer.ytReady) {
            try {
                musicPlayer.ytPlayer.playVideo();
                musicPlayer.isPlaying = true;
                updatePanelUI();
                muteBCMusic();
                startProgressUpdate();
                if (isFirstController()) sendMusicState();
            } catch(e) {}
        } else if (musicPlayer.isBilibili) {
            biliSend({ type: 'play' });
            biliSend({ msg_type: 'play' }); // alternate format
            musicPlayer.isPlaying = true;
            updatePanelUI();
            muteBCMusic();
            startProgressUpdate();
            if (isFirstController()) sendMusicState();
        } else if (musicPlayer.audioPlayer && musicPlayer.audioPlayer.paused) {
            musicPlayer.audioPlayer.play()
                .then(() => {
                    musicPlayer.isPlaying = true;
                    updatePanelUI();
                    muteBCMusic();
                    startProgressUpdate();
                    if (isFirstController()) sendMusicState();
                })
                .catch(err => { error('恢復播放失敗:', err); musicPlayer.isPlaying = false; });
        }
    }
    function stopMusic() {
        cleanupAudioPlayer();
        cleanupYouTubePlayer();
        cleanupBilibiliPlayer();
        musicPlayer.isPlaying = false;
        stopProgressUpdate();
        updatePanelUI();
    }
    function toggleLoop() {
        if (!canControlMusic()) { sendLocalMsg("只有房管可以控制循環"); return; }
        musicPlayer.isLooping = !musicPlayer.isLooping;
        if (musicPlayer.audioPlayer) musicPlayer.audioPlayer.loop = musicPlayer.isLooping;
        updatePanelUI();
        saveSettings();
        if (isFirstController()) sendMusicState();
        sendLocalMsg(musicPlayer.isLooping ? "已啟用循環播放" : "已關閉循環播放");
    }
    function playNext() {
        if (musicPlayer.currentPlaylist.length === 0 || musicPlayer.isLoading) return;
        muteBCMusic();
        if (canControlMusic() && !ChatRoomCustomized) {
            ChatRoomCustomized = true;
            ChatRoomCustomizationClear();
            const url = musicPlayer.currentPlaylist[musicPlayer.currentIndex]?.url || '';
            muteBCIfNeeded(url);
        }
        playTrack((musicPlayer.currentIndex + 1) % musicPlayer.currentPlaylist.length, true);
    }
    function playPrevious() {
        if (musicPlayer.currentPlaylist.length === 0 || musicPlayer.isLoading) return;
        muteBCMusic();
        if (canControlMusic() && !ChatRoomCustomized) {
            ChatRoomCustomized = true;
            ChatRoomCustomizationClear();
        }
        let prev = musicPlayer.currentIndex - 1;
        if (prev < 0) prev = musicPlayer.currentPlaylist.length - 1;
        playTrack(prev, true);
    }
    function setVolume(vol) {
        musicPlayer.volume = Math.max(0, Math.min(1, vol));
        if (musicPlayer.isYouTube && musicPlayer.ytPlayer && musicPlayer.ytReady) {
            try { musicPlayer.ytPlayer.setVolume(musicPlayer.volume * 100); } catch(e) {}
        } else if (musicPlayer.isBilibili) {
            biliSend({ type: 'volume', payload: { volume: Math.round(musicPlayer.volume * 100) } });
        } else if (musicPlayer.audioPlayer) {
            musicPlayer.audioPlayer.volume = musicPlayer.volume;
        }
        updatePanelUI();
        saveSettings();
    }
    function togglePlay() {
        if (musicPlayer.isLoading) return;
        if (musicPlayer.isPlaying) {
            pauseMusic();
        } else {
            if (canControlMusic() && !ChatRoomCustomized) {
                ChatRoomCustomized = true;
                ChatRoomCustomizationClear();
                muteBCMusic();
            }
            const hasAudio = musicPlayer.audioPlayer?.src || (musicPlayer.isYouTube && musicPlayer.ytPlayer) || musicPlayer.isBilibili;
            if (hasAudio) {
                resumeMusic();
            } else if (musicPlayer.currentPlaylist.length > 0) {
                playTrack(musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0);
            } else {
                sendLocalMsg("播放列表為空");
            }
        }
    }

    // ============ 進度條 ============
    function startProgressUpdate() {
        stopProgressUpdate();
        musicPlayer.progressInterval = setInterval(updateProgress, CONSTANTS.PROGRESS_UPDATE_INTERVAL);
    }
    function stopProgressUpdate() {
        if (musicPlayer.progressInterval) { clearInterval(musicPlayer.progressInterval); musicPlayer.progressInterval = null; }
    }
    function updateProgress() {
        if (!musicPlayer.floatingPanel) return;
        const progressBar = musicPlayer.floatingPanel.querySelector('#progress-bar');
        const timeDisplay = musicPlayer.floatingPanel.querySelector('#time-display');
        if (!progressBar || !timeDisplay) return;

        const fmt = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

        if (musicPlayer.isBilibili) {
            const cur = musicPlayer.biliCurrentTime || 0;
            const dur = musicPlayer.biliDuration || 0;
            if (dur > 0) {
                progressBar.style.width = ((cur / dur) * 100) + '%';
                const sec = Math.floor(cur);
                if (sec !== musicPlayer.lastDisplayedSecond) {
                    musicPlayer.lastDisplayedSecond = sec;
                    timeDisplay.textContent = `${fmt(cur)} / ${fmt(dur)}`;
                }
            } else {
                progressBar.style.width = '100%';
                timeDisplay.textContent = '♪ Bilibili';
            }
            return;
        }

        let current = 0, duration = 0;
        if (musicPlayer.isYouTube && musicPlayer.ytPlayer && musicPlayer.ytReady) {
            try { current = musicPlayer.ytPlayer.getCurrentTime() || 0; duration = musicPlayer.ytPlayer.getDuration() || 0; } catch(e) {}
        } else if (musicPlayer.audioPlayer) {
            current = musicPlayer.audioPlayer.currentTime;
            duration = musicPlayer.audioPlayer.duration;
        }
        if (!isNaN(duration) && duration > 0) {
            progressBar.style.width = ((current / duration) * 100) + '%';
            const sec = Math.floor(current);
            if (sec !== musicPlayer.lastDisplayedSecond) {
                musicPlayer.lastDisplayedSecond = sec;
                timeDisplay.textContent = `${fmt(current)} / ${fmt(duration)}`;
            }
        }
        updateLyricHighlight();
    }
    function seekTo(percent) {
        if (musicPlayer.isBilibili) {
            const targetTime = (percent / 100) * (musicPlayer.biliDuration || 0);
            if (targetTime > 0) {
                biliSend({ type: 'seek', payload: { time: targetTime } });
                biliSend({ msg_type: 'seek', data: { time: targetTime } }); // alternate format
                musicPlayer.biliCurrentTime = targetTime;
            }
            return;
        }
        if (musicPlayer.isYouTube && musicPlayer.ytPlayer && musicPlayer.ytReady) {
            try { const d = musicPlayer.ytPlayer.getDuration(); if (d) musicPlayer.ytPlayer.seekTo((percent / 100) * d, true); } catch(e) {}
        } else if (musicPlayer.audioPlayer?.duration) {
            musicPlayer.audioPlayer.currentTime = (percent / 100) * musicPlayer.audioPlayer.duration;
        }
    }

    // ============ 進房 / 房間更新邏輯 ============
    function checkAndPlayBCMusic() {
        if (!musicPlayer.isPanelVisible) return;

        // 1. Recalc rank from current room character data
        recalcMyRank();

        // 2. Update our own list count visible to others
        const myRank = getMyCmc()?.rank || 0;
        if (myRank) setMyCmc(myRank, musicPlayer.currentPlaylist.length);

        // 3. Check Custom.MusicURL and play if changed
        const newURL = ChatRoomData?.Custom?.MusicURL || "";
        if (newURL && newURL !== musicPlayer.bcMusicURL) {
            musicPlayer.bcMusicURL = newURL;
            muteBCIfNeeded(newURL);
            if (!musicPlayer.isPlaying) {
                playOrMatchURL(newURL);
            }
        }

        updatePanelUI();
    }

    // Play a URL: if it's in the current playlist show its name, else play as unknown (no selection)
    function playOrMatchURL(url) {
        if (!isSafeMediaURL(url)) { log('不允許的房間音樂URL，跳過:', url); return; }
        const matchIdx = musicPlayer.currentPlaylist.findIndex(t => t.url === url);
        if (matchIdx >= 0) {
            playTrack(matchIdx, false);
        } else {
            playUnknownTrack(url);
        }
    }

    // Called on room entry — only plays room music, does NOT ask for playlist
    function onRoomEnter() {
        if (!musicPlayer.isPanelVisible) return;
        musicPlayer.playlistRequested = false;

        registerController();

        // Don't restart if already playing — guards against ChatRoomLoad re-firing on sub-screen return
        if (!musicPlayer.isPlaying) {
            const url = ChatRoomData?.Custom?.MusicURL || "";
            if (url) {
                musicPlayer.bcMusicURL = url;
                muteBCIfNeeded(url);
                playOrMatchURL(url);
            }
        }

        recalcMyRank();
        updatePanelUI();
    }

    function askForPlaylist() {
        if (musicPlayer.playlistRequested) return;
        if (musicPlayer.currentPlaylist.length > 0) return;
        const controllers = getControllerList().filter(c => c.memberNumber !== Player.MemberNumber);
        if (controllers.length === 0) return;

        const best = controllers.reduce((a, b) => b.list > a.list ? b : a, controllers[0]);
        musicPlayer.playlistRequested = true;

        if (best.list === 0) return; // no songs to request

        // Auto-request without confirmation dialog
        requestMusicSyncFrom(best.memberNumber);
        sendLocalMsg(`正在從 ${best.name || best.memberNumber} 同步歌單...`);
    }

    // ============ 歌詞 ============
    async function loadLyrics(songName) {
        try {
            const API_BASE = "https://netease-cloud-music-api-ochre.vercel.app";
            const res = await fetch(`${API_BASE}/search?keywords=${encodeURIComponent(songName)}`);
            const data = await res.json();
            if (!data.result?.songs?.length) { log('未找到歌詞:', songName); return; }
            const songId = data.result.songs[0].id;
            const lyricRes = await fetch(`${API_BASE}/lyric?id=${songId}`);
            const lyricData = await lyricRes.json();
            if (!lyricData.lrc?.lyric) return;
            musicPlayer.currentLyrics = parseLRC(lyricData.lrc.lyric);
            renderLyrics();
        } catch(e) { error('歌詞加載失敗:', e); }
    }
    function parseLRC(lrc) {
        return lrc.split("\n").reduce((acc, line) => {
            const m = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
            if (m) {
                const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
                const text = m[3].trim();
                if (text) acc.push({ time, text });
            }
            return acc;
        }, []);
    }
    function renderLyrics() {
        if (!musicPlayer.lyricsPanel) return;
        const container = musicPlayer.lyricsPanel.querySelector('#lyrics-content');
        if (!container) return;
        if (musicPlayer.currentLyrics.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:40px;opacity:0.5;color:${COLORS.dim};">[ NO LYRICS ]</div>`;
            return;
        }
        if (musicPlayer.lyricsPanel.classList.contains('lyrics-full')) {
            container.style.cssText = 'height:calc(100% - 50px);overflow-y:auto;padding:15px;background:rgba(26,13,46,1);';
            container.innerHTML = musicPlayer.currentLyrics.map((line, i) =>
                `<div class="lyric-line" id="lyric-line-${i}" style="padding:4px 8px;color:${COLORS.dim};transition:all 0.3s;font-size:14px;">${sanitizeHTML(line.text)}</div>`
            ).join('');
        } else {
            container.style.cssText = 'height:auto;overflow-y:visible;padding:10px;background:transparent;';
            container.innerHTML = `
                <div id="lyric-prev" style="padding:4px 8px;color:rgba(186,85,211,0.5);font-size:13px;text-align:center;min-height:24px;"></div>
                <div id="lyric-current" style="padding:8px;color:${COLORS.highlight};font-size:16px;font-weight:bold;text-align:center;text-shadow:0 0 15px ${COLORS.light};min-height:32px;"></div>
                <div id="lyric-next" style="padding:4px 8px;color:rgba(186,85,211,0.5);font-size:13px;text-align:center;min-height:24px;"></div>
            `;
        }
    }
    function updateLyricHighlight() {
        if (!musicPlayer.audioPlayer || !musicPlayer.lyricsPanel || musicPlayer.currentLyrics.length === 0) return;
        const currentTime = musicPlayer.audioPlayer.currentTime;
        const idx = musicPlayer.currentLyrics.findIndex((line, i) =>
            i < musicPlayer.currentLyrics.length - 1
                ? currentTime >= line.time && currentTime < musicPlayer.currentLyrics[i + 1].time
                : currentTime >= line.time
        );
        if (idx !== -1 && idx !== musicPlayer.currentLyricIndex) {
            musicPlayer.currentLyricIndex = idx;
            if (musicPlayer.lyricsPanel.classList.contains('lyrics-full')) {
                musicPlayer.lyricsPanel.querySelectorAll('.lyric-line').forEach((l, i) => {
                    if (i === idx) {
                        l.style.cssText += `color:${COLORS.highlight};font-weight:bold;transform:scale(1.05);text-shadow:0 0 10px ${COLORS.light};`;
                        l.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        l.style.cssText += `color:${COLORS.dim};font-weight:normal;transform:scale(1);text-shadow:none;`;
                    }
                });
            } else {
                const prev = musicPlayer.lyricsPanel.querySelector('#lyric-prev');
                const curr = musicPlayer.lyricsPanel.querySelector('#lyric-current');
                const next = musicPlayer.lyricsPanel.querySelector('#lyric-next');
                if (prev && curr && next) {
                    prev.textContent = idx > 0 ? musicPlayer.currentLyrics[idx - 1].text : '';
                    curr.textContent = musicPlayer.currentLyrics[idx].text;
                    next.textContent = idx < musicPlayer.currentLyrics.length - 1 ? musicPlayer.currentLyrics[idx + 1].text : '';
                }
            }
        }
    }
    function toggleLyrics() {
        if (!musicPlayer.lyricsPanel) {
            createLyricsPanel();
            musicPlayer.lyricsPanel.style.display = 'block';
        } else {
            if (musicPlayer.lyricsPanel.style.display === 'none') {
                musicPlayer.lyricsPanel.style.cssText += 'bottom:80px;left:30%;top:auto;transform:translateX(-50%);display:block;';
                musicPlayer.lyricsPanel.classList.remove('lyrics-full');
                musicPlayer.lyricsPanel.classList.add('lyrics-compact');
                renderLyrics();
            } else {
                musicPlayer.lyricsPanel.style.display = 'none';
            }
        }
    }
    function createLyricsPanel() {
        if (musicPlayer.lyricsPanel) return;
        const panel = document.createElement('div');
        panel.id = 'cmc-lyrics-panel';
        panel.className = 'lyrics-compact';
        panel.style.cssText = `position:fixed;bottom:80px;left:30%;transform:translateX(-50%);width:600px;background:transparent;border:none;border-radius:10px;z-index:9999;font-family:'Courier New',monospace;color:${COLORS.primary};overflow:visible;`;
        panel.innerHTML = `
            <style>
                #cmc-lyrics-panel .lyrics-control { opacity:0; transition:opacity 0.3s; }
                #cmc-lyrics-panel:hover .lyrics-control { opacity:1; }
                #cmc-lyrics-panel.lyrics-full { width:400px;height:400px;bottom:auto;top:100px;left:30%;transform:none;border:2px solid ${COLORS.primary};box-shadow:0 0 30px rgba(147,112,219,0.6);background:linear-gradient(135deg,#1a0d2e,#2d1a4a); }
                #cmc-lyrics-panel.lyrics-full .lyrics-control { opacity:1; }
            </style>
            <div class="lyrics-control" style="position:absolute;top:-50px;left:0;right:0;padding:12px;background:linear-gradient(135deg,${COLORS.dark},#2d1a4a);border:1px solid ${COLORS.primary};border-radius:8px;cursor:move;" id="lyrics-header">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:bold;font-size:14px;text-shadow:0 0 10px ${COLORS.light};color:${COLORS.light};">♪ LYRICS</span>
                    <div>
                        <button id="lyrics-reset" style="padding:4px 8px;margin-right:5px;border-radius:3px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);border:1px solid ${COLORS.primary};color:${COLORS.primary};cursor:pointer;font-size:12px;">⌖</button>
                        <button id="lyrics-toggle" style="padding:4px 8px;margin-right:5px;border-radius:3px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);border:1px solid ${COLORS.primary};color:${COLORS.primary};cursor:pointer;font-size:12px;">⇅</button>
                        <button id="lyrics-close" style="padding:4px 8px;border-radius:3px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);border:1px solid ${COLORS.primary};color:${COLORS.primary};cursor:pointer;">×</button>
                    </div>
                </div>
            </div>
            <div id="lyrics-content" style="padding:0;"></div>
        `;
        document.body.appendChild(panel);
        musicPlayer.lyricsPanel = panel;
        makeDraggable(panel, panel.querySelector('#lyrics-header'));
        panel.querySelector('#lyrics-close').onclick = () => { panel.style.display = 'none'; };
        panel.querySelector('#lyrics-reset').onclick = () => {
            panel.style.bottom = '80px'; panel.style.left = '30%'; panel.style.top = 'auto'; panel.style.transform = 'translateX(-50%)';
        };
        panel.querySelector('#lyrics-toggle').onclick = () => {
            if (panel.classList.contains('lyrics-compact')) {
                panel.classList.replace('lyrics-compact', 'lyrics-full');
                panel.querySelector('#lyrics-header').style.cssText += 'position:relative;top:0;';
            } else {
                panel.classList.replace('lyrics-full', 'lyrics-compact');
                panel.querySelector('#lyrics-header').style.cssText += 'position:absolute;top:-50px;';
                panel.style.bottom = '80px'; panel.style.left = '30%'; panel.style.top = 'auto'; panel.style.transform = 'translateX(-50%)';
            }
            renderLyrics();
        };
        renderLyrics();
    }

    // ============ 分享歌曲 ============
    // CMC share message format: line starts with "♪" followed by name and URL on next line
    const CMC_SHARE_PREFIX = '♪ [CMC] ';
    function shareTrack(track) {
        if (!track?.url) { sendLocalMsg("無效的歌曲"); return; }
        ServerSend("ChatRoomChat", {
            Type: "Chat",
            Content: `${CMC_SHARE_PREFIX}${track.name || 'Unknown'}\n${track.url}`,
            Dictionary: []
        });
    }
    function shareCurrentTrack() {
        const track = musicPlayer.currentPlaylist[musicPlayer.currentIndex];
        if (track) { shareTrack(track); return; }
        const url = musicPlayer.bcMusicURL || "";
        if (!url) { sendLocalMsg("沒有正在播放的歌曲"); return; }
        shareTrack({ name: 'Unknown', url });
    }

    // Scan chat messages for CMC share format and add + button (ACV-style)
    function processCMCShareMessages(element) {
        const links = element.querySelectorAll('a[href]:not([data-cmc-processed])');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || !isAudioURL(href)) return;

            // Check if the containing text has CMC share prefix
            const msgEl = link.closest('.ChatMessageText') || link.parentElement;
            if (!msgEl?.textContent?.includes('[CMC]')) return;

            link.dataset.cmcProcessed = '1';

            // Extract song name from sibling text (before the URL)
            let songName = link.textContent.trim();
            const fullText = msgEl.textContent || '';
            const prefixMatch = fullText.match(/♪ \[CMC\] (.+?)(?:\n|https?)/);
            if (prefixMatch) songName = prefixMatch[1].trim();

            const btn = document.createElement('span');
            btn.className = 'cmcShareButton';
            btn.textContent = '+';
            btn.title = `添加「${songName}」到歌單`;
            btn.style.cssText = `cursor:pointer;font-size:1em;padding:2px 7px;border-radius:4px;background:rgba(147,112,219,0.2);border:1px solid rgba(147,112,219,0.5);color:#ba55d3;transition:all 0.15s;display:inline-block;vertical-align:middle;margin-left:5px;`;
            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(147,112,219,0.4)'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(147,112,219,0.2)'; });
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                showAddToDialog({ name: songName, url: href });
            });
            link.after(btn);
        });
    }
    function scanChatForCMCShares() {
        document.querySelectorAll('.ChatMessageText,[role="log"]>div').forEach(el => processCMCShareMessages(el));
    }

    // ============ 通知 ============
    // Broadcast "♪ 暱稱 播放 曲名" via Action (visible to everyone; only rank-1 sends)
    function sendTrackNotification(trackName, requesterNumber = null) {
        if (!isFirstController()) return;
        const whoNum = requesterNumber ?? Player.MemberNumber;
        // Try to get display name from room character list, fallback to member number
        const whoChar = ChatRoomData?.Character?.find(c => c.MemberNumber === whoNum);
        const whoName = whoChar?.Name || String(whoNum);
        const systemMessage = `♪ ${whoName} 播放 ${trackName}`;
        ServerSend("ChatRoomChat", {
            Type: "Action",
            Content: "CMCTrackPlay",
            Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CMCTrackPlay', Text: systemMessage }]
        });
    }
    // Non-rank-1 with canPlay sends a play request; rank-1 admin receives and executes
    function requestPlayTrack(trackIndex) {
        ServerSend("ChatRoomChat", {
            Type: "Hidden", Content: "CMCSync",
            Dictionary: [{ Action: "PlayRequest", TrackIndex: trackIndex, From: Player.MemberNumber }]
        });
    }
    function sendLocalMsg(msg, timeout = 5000) {
        try {
            if (typeof ChatRoomSendLocal === 'function') {
                ChatRoomSendLocal(`<font color="${COLORS.accent}">[CMC] ${msg}</font>`, timeout);
            }
        } catch(e) { console.log('[CMC]', msg); }
    }

    // ============ UI ============
    function createFloatingPanel() {
        if (musicPlayer.floatingPanel) return;
        const panel = document.createElement('div');
        panel.id = 'cmc-music-panel';
        panel.style.cssText = `position:fixed;top:100px;right:20px;width:350px;background:linear-gradient(135deg,#1a0d2e,#2d1a4a);border:2px solid ${COLORS.primary};border-radius:10px;box-shadow:0 0 30px rgba(147,112,219,0.5),inset 0 0 20px rgba(147,112,219,0.1);z-index:10000;font-family:'Courier New',monospace;color:${COLORS.primary};overflow:hidden;user-select:none;-webkit-user-select:none;`;
        panel.innerHTML = `
            <style>
                #cmc-music-panel button { background:linear-gradient(135deg,#2d1a4a,#4a2d6a); border:1px solid ${COLORS.primary}; color:${COLORS.light}; cursor:pointer; transition:all 0.3s; font-family:'Courier New',monospace; }
                #cmc-music-panel button:hover { background:linear-gradient(135deg,#4a2d6a,#6a3d8a); box-shadow:0 0 15px ${COLORS.accent}; transform:translateY(-2px); }
                #cmc-music-panel button:active { transform:translateY(0); }
                #cmc-music-panel input[type="range"] { -webkit-appearance:none; background:#2d1a4a; border:1px solid ${COLORS.dim}; height:6px; border-radius:3px; }
                #cmc-music-panel input[type="range"]::-webkit-slider-thumb { -webkit-appearance:none; width:16px; height:16px; background:${COLORS.accent}; border-radius:50%; cursor:pointer; box-shadow:0 0 10px ${COLORS.light}; }
                .cyber-text { text-shadow:0 0 10px ${COLORS.light},0 0 20px ${COLORS.accent}; }
                .cmc-tab { padding:5px 8px; border-radius:4px 4px 0 0; font-size:11px; border-bottom:none !important; flex:1; }
                .cmc-tab.cmc-tab-active { background:linear-gradient(135deg,${COLORS.accent},${COLORS.primary}) !important; color:#fff !important; border-color:${COLORS.accent} !important; }
            </style>

            <div style="padding:12px;cursor:move;background:linear-gradient(90deg,rgba(28,2,48,0.3),rgba(147,112,219,0.2));border-bottom:1px solid ${COLORS.primary};" id="music-panel-header">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span id="panel-title" class="cyber-text" style="font-weight:bold;font-size:14px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.light};">♛ CMC</span>
                    <button id="music-users" style="padding:4px 8px;border-radius:3px;font-size:14px;margin-right:4px;" title="CMC 使用者管理">👥</button>
                    <button id="music-minimize" style="padding:4px 8px;border-radius:3px;font-size:16px;margin-right:4px;">−</button>
                    <button id="music-close" style="padding:4px 8px;border-radius:3px;font-size:16px;">×</button>
                </div>
            </div>

            <div id="music-panel-content" style="padding:12px;">
                <div style="background:linear-gradient(135deg,rgba(28,2,48,0.2),rgba(106,90,205,0.2));border:1px solid ${COLORS.dim};border-radius:6px;padding:10px;margin-bottom:10px;">
                    <div id="current-track" class="cyber-text" style="font-size:13px;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${COLORS.light};">[ NO SIGNAL ]</div>
                    <div style="position:relative;height:6px;background:${COLORS.dark};border:1px solid ${COLORS.dim};border-radius:3px;margin-bottom:8px;cursor:pointer;" id="progress-container">
                        <div id="progress-bar" style="position:absolute;left:0;top:0;height:100%;width:0%;background:linear-gradient(90deg,${COLORS.accent},${COLORS.highlight});border-radius:3px;box-shadow:0 0 10px ${COLORS.light};transition:width 0.1s;"></div>
                    </div>
                    <div id="time-display" style="font-size:11px;text-align:center;margin-bottom:10px;opacity:0.8;color:${COLORS.dim};">0:00 / 0:00</div>
                    <div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px;">
                        <button id="music-prev" style="padding:8px 12px;border-radius:4px;font-size:14px;">⏮</button>
                        <button id="music-play" style="padding:8px 16px;border-radius:4px;font-size:14px;">▶</button>
                        <button id="music-loop" style="padding:8px 12px;border-radius:4px;font-size:14px;">⟳</button>
                        <button id="music-next" style="padding:8px 12px;border-radius:4px;font-size:14px;">⏭</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:14px;">🕪</span>
                        <input type="range" id="volume-slider" min="0" max="100" value="25" style="flex:1;">
                        <span id="volume-display" style="font-size:12px;min-width:40px;color:${COLORS.light};">25%</span>
                    </div>
                </div>

                <div style="display:flex;gap:3px;margin-bottom:0;" id="playlist-tabs">
                    <button data-tab="current" class="cmc-tab cmc-tab-active">當前</button>
                    <button data-tab="personal" class="cmc-tab">個人</button>
                    <button data-tab="history" class="cmc-tab">歷史</button>
                </div>

                <div style="max-height:200px;overflow-y:auto;background:rgba(28,2,48,0.1);border:1px solid ${COLORS.dim};border-top:none;border-radius:0 0 6px 6px;padding:6px;margin-bottom:8px;" id="playlist-container">
                    <div style="font-size:11px;opacity:0.5;text-align:center;padding:15px;">[ EMPTY PLAYLIST ]</div>
                </div>

                <div style="display:flex;gap:6px;margin-bottom:6px;">
                    <button id="music-lyrics" style="flex:1;padding:6px;border-radius:4px;font-size:11px;">📝 LYRICS</button>
                </div>
                <div style="display:flex;gap:6px;" id="music-controls-row">
                    <button id="music-add" style="flex:1;padding:6px;border-radius:4px;font-size:11px;">+ ADD</button>
                    <button id="music-import" style="flex:1;padding:6px;border-radius:4px;font-size:11px;">📥 IMPORT</button>
                    <button id="music-clear" style="flex:1;padding:6px;border-radius:4px;font-size:11px;">🗑 CLEAR</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        musicPlayer.floatingPanel = panel;
        makeDraggable(panel, panel.querySelector('#music-panel-header'));

        panel.querySelector('#music-users').onclick = () => toggleUserListPanel();
        panel.querySelector('#music-minimize').onclick = () => toggleMinimize();
        panel.querySelector('#music-close').onclick = () => hidePanel();
        panel.querySelector('#music-play').onclick = () => togglePlay();
        panel.querySelector('#music-prev').onclick = () => playPrevious();
        panel.querySelector('#music-next').onclick = () => playNext();
        panel.querySelector('#music-loop').onclick = () => toggleLoop();
        panel.querySelector('#music-lyrics').onclick = () => toggleLyrics();
        panel.querySelector('#volume-slider').oninput = (e) => setVolume(parseInt(e.target.value) / 100);
        panel.querySelector('#progress-container').onclick = (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo(((e.clientX - rect.left) / rect.width) * 100);
        };

        // Tab switching
        panel.querySelectorAll('.cmc-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                panel.querySelectorAll('.cmc-tab').forEach(b => b.classList.remove('cmc-tab-active'));
                btn.classList.add('cmc-tab-active');
                musicPlayer.activeTab = btn.dataset.tab;
                musicPlayer.historyViewRoom = null;
                renderPlaylistTab();
                updateBottomControls();
            });
        });

        updateBottomControls();
        updatePanelUI();
    }

    function updateBottomControls() {
        if (!musicPlayer.floatingPanel) return;
        const tab = musicPlayer.activeTab;
        const isAdmin = canControlMusic();
        const addBtn = musicPlayer.floatingPanel.querySelector('#music-add');
        const importBtn = musicPlayer.floatingPanel.querySelector('#music-import');
        const clearBtn = musicPlayer.floatingPanel.querySelector('#music-clear');

        if (tab === 'current') {
            addBtn.style.display = isAdmin ? 'block' : 'none';
            importBtn.style.display = isAdmin ? 'block' : 'none';
            clearBtn.style.display = isAdmin ? 'block' : 'none';
            if (addBtn) addBtn.onclick = () => showAddTrackDialog();
            if (clearBtn) clearBtn.onclick = () => clearPlaylist();
            if (importBtn) importBtn.onclick = () => showImportDialog();
        } else if (tab === 'personal') {
            addBtn.style.display = 'block';
            importBtn.style.display = 'none';
            clearBtn.style.display = 'block';
            addBtn.textContent = '+ ADD';
            if (addBtn) addBtn.onclick = () => showAddTrackDialogPersonal();
            if (clearBtn) clearBtn.onclick = () => clearPersonalPlaylist();
        } else {
            addBtn.style.display = 'none';
            importBtn.style.display = 'none';
            clearBtn.style.display = 'none';
        }
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = (e) => {
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
            document.onmousemove = (ev) => {
                ev.preventDefault();
                pos1 = pos3 - ev.clientX; pos2 = pos4 - ev.clientY;
                pos3 = ev.clientX; pos4 = ev.clientY;
                const newTop = Math.max(0, Math.min(element.offsetTop - pos2, window.innerHeight - 100));
                const newLeft = Math.max(0, Math.min(element.offsetLeft - pos1, window.innerWidth - 100));
                element.style.top = newTop + 'px';
                element.style.left = newLeft + 'px';
                element.style.right = 'auto';
                element.style.bottom = 'auto';
            };
        };
    }

    function toggleMinimize() {
        const content = musicPlayer.floatingPanel.querySelector('#music-panel-content');
        const btn = musicPlayer.floatingPanel.querySelector('#music-minimize');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            btn.textContent = '−';
        } else {
            content.style.display = 'none';
            btn.textContent = '+';
        }
        updatePanelUI();
    }

    // ============ CMC 使用者清單面板 ============
    function toggleUserListPanel() {
        if (musicPlayer.userListPanel && musicPlayer.userListPanel.style.display !== 'none') {
            // Closing: stop auto-refresh
            musicPlayer.userListPanel.style.display = 'none';
            if (musicPlayer.userListInterval) { clearInterval(musicPlayer.userListInterval); musicPlayer.userListInterval = null; }
        } else {
            // Opening: rebuild and start auto-refresh every 30s
            updateUserListPanel();
            if (musicPlayer.userListPanel) musicPlayer.userListPanel.style.display = 'block';
            if (!musicPlayer.userListInterval) {
                musicPlayer.userListInterval = setInterval(() => {
                    if (musicPlayer.userListPanel && musicPlayer.userListPanel.style.display !== 'none') {
                        updateUserListPanel();
                    } else {
                        clearInterval(musicPlayer.userListInterval);
                        musicPlayer.userListInterval = null;
                    }
                }, 30000);
            }
        }
    }

    function updateUserListPanel() {
        const mainPanel = musicPlayer.floatingPanel;
        if (!mainPanel) return;

        // Create (or re-use) the panel
        if (!musicPlayer.userListPanel) {
            const ul = document.createElement('div');
            ul.id = 'cmc-user-list';
            ul.style.cssText = `position:fixed;top:100px;right:380px;width:260px;background:linear-gradient(135deg,#1a0d2e,#2d1a4a);border:2px solid ${COLORS.primary};border-radius:10px;box-shadow:0 0 20px rgba(147,112,219,0.4);z-index:10001;font-family:'Courier New',monospace;color:${COLORS.primary};user-select:none;-webkit-user-select:none;display:none;`;
            document.body.appendChild(ul);
            musicPlayer.userListPanel = ul;
        }

        const isAdmin = ChatRoomPlayerIsAdmin();
        const cmcUsers = getControllerList();

        const toggleStyle = (on) => `display:inline-block;width:36px;height:20px;border-radius:10px;position:relative;cursor:pointer;background:${on?'rgba(163,85,187,0.7)':'rgba(50,50,80,0.5)'};border:1px solid ${on?COLORS.accent:COLORS.dim};transition:background 0.2s;vertical-align:middle;`;
        const toggleKnob = (on) => `<span style="position:absolute;top:2px;${on?'right:2px':'left:2px'};width:14px;height:14px;border-radius:50%;background:${on?COLORS.accent:'#888'};transition:all 0.2s;"></span>`;

        const rows = cmcUsers.map(u => {
            const perm = getPermission(u.memberNumber);
            const isSelf = u.memberNumber === Player.MemberNumber;
            const uIsAdmin = ChatRoomCharacterIsAdmin(u.memberNumber) ?? false;
            const rankLabel = u.rank === 1 ? '♛' : `#${u.rank}`;
            const nameColor = isSelf ? COLORS.accent : uIsAdmin ? COLORS.highlight : COLORS.light;
            const adminBadge = uIsAdmin ? `<span style="font-size:9px;color:${COLORS.highlight};margin-left:2px;">[管]</span>` : '';

            if (isAdmin && !uIsAdmin && !isSelf) {
                // Editable toggles for non-admin non-self users
                const playToggle = `<label title="點播權限" style="${toggleStyle(perm.canPlay)}" data-toggle-member="${u.memberNumber}" data-toggle-type="play">${toggleKnob(perm.canPlay)}</label>`;
                const editToggle = `<label title="編輯歌單權限" style="${toggleStyle(perm.canEdit)}" data-toggle-member="${u.memberNumber}" data-toggle-type="edit">${toggleKnob(perm.canEdit)}</label>`;
                return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(147,112,219,0.15);">
                    <span style="color:${COLORS.highlight};min-width:22px;font-size:11px;">${rankLabel}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${nameColor};font-size:11px;">${sanitizeHTML(u.name)}${adminBadge}</span>
                    ${playToggle}${editToggle}
                </div>`;
            } else {
                // Read-only display
                const playIcon = perm.canPlay || uIsAdmin ? `<span style="font-size:12px;" title="有點播權">✓</span>` : `<span style="font-size:12px;opacity:0.3;" title="無點播權">✗</span>`;
                const editIcon = perm.canEdit || uIsAdmin ? `<span style="font-size:12px;" title="有編輯權">✓</span>` : `<span style="font-size:12px;opacity:0.3;" title="無編輯權">✗</span>`;
                return `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid rgba(147,112,219,0.15);">
                    <span style="color:${COLORS.highlight};min-width:22px;font-size:11px;">${rankLabel}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${nameColor};font-size:11px;">${sanitizeHTML(u.name)}${adminBadge}</span>
                    <span style="width:36px;text-align:center;color:${COLORS.dim};">${playIcon}</span>
                    <span style="width:36px;text-align:center;color:${COLORS.dim};">${editIcon}</span>
                </div>`;
            }
        }).join('');

        const grabBtn = isAdmin && !isFirstController()
            ? `<button id="cmc-grab-control" style="width:100%;margin-top:6px;padding:6px;border-radius:5px;border:1px solid ${COLORS.accent};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.accent};cursor:pointer;font-size:11px;">⚡ 取得主控</button>`
            : '';

        musicPlayer.userListPanel.innerHTML = `
            <div id="cmc-ul-header" style="display:flex;align-items:center;padding:6px 8px;border-bottom:1px solid ${COLORS.primary};cursor:move;">
                <span style="flex:1;font-size:12px;color:${COLORS.light};font-weight:bold;">👥 CMC 使用者</span>
                <button id="cmc-ul-close" style="padding:2px 7px;border-radius:3px;font-size:12px;background:rgba(163,85,187,0.15);border:1px solid ${COLORS.dim};color:${COLORS.dim};cursor:pointer;line-height:1;">×</button>
            </div>
            <div style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid rgba(147,112,219,0.3);font-size:10px;color:${COLORS.dim};">
                <span style="min-width:22px;">順位</span>
                <span style="flex:1;">玩家</span>
                <span style="width:36px;text-align:center;">點播</span>
                <span style="width:36px;text-align:center;">編輯</span>
            </div>
            <div style="padding:4px 4px 6px;">${rows || `<div style="opacity:0.5;font-size:11px;text-align:center;padding:8px;">無其他 CMC 使用者</div>`}${grabBtn ? `<div style="padding:4px;">${grabBtn}</div>` : ''}</div>
        `;
        makeDraggable(musicPlayer.userListPanel, musicPlayer.userListPanel.querySelector('#cmc-ul-header'));
        musicPlayer.userListPanel.querySelector('#cmc-ul-close').onclick = () => toggleUserListPanel();

        // Bind toggle switches
        musicPlayer.userListPanel.querySelectorAll('[data-toggle-member]').forEach(label => {
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                const member = parseInt(label.getAttribute('data-toggle-member'));
                const type = label.getAttribute('data-toggle-type');
                const perm = getPermission(member);
                const newCanPlay = type === 'play' ? !perm.canPlay : perm.canPlay;
                const newCanEdit = type === 'edit' ? !perm.canEdit : perm.canEdit;
                setPermission(member, newCanPlay, newCanEdit);
                updateUserListPanel();
            });
        });

        const grabBtnEl = musicPlayer.userListPanel.querySelector('#cmc-grab-control');
        if (grabBtnEl) grabBtnEl.onclick = () => grabControl();
    }

    function hidePanel() {
        if (musicPlayer.floatingPanel) musicPlayer.floatingPanel.style.display = 'none';
        if (musicPlayer.userListPanel) musicPlayer.userListPanel.style.display = 'none';
        if (musicPlayer.userListInterval) { clearInterval(musicPlayer.userListInterval); musicPlayer.userListInterval = null; }
        musicPlayer.isPanelVisible = false;
        stopMusic();
        saveCurrentToHistory(); // save playlist before clearing
        musicPlayer.currentPlaylist = [];
        musicPlayer.currentIndex = -1;
        removeFromControllers(); // promotes next if we were rank-1
        log('CMC 已關閉，音樂停止，歌單存入歷史，順位移除');
    }
    function showPanel() {
        if (!musicPlayer.floatingPanel) createFloatingPanel();
        musicPlayer.floatingPanel.style.display = 'block';
        musicPlayer.isPanelVisible = true;
        onRoomEnter();
        // If not rank-1, broadcast RequestSync so rank-1 responds with full SyncState (playlist included)
        setTimeout(() => {
            if (musicPlayer.myControllerRank !== 1 && musicPlayer.currentPlaylist.length === 0) {
                requestMusicSync();
                sendLocalMsg('正在同步歌單...', 3000);
            }
        }, 1000);
    }

    function getRankIcon() {
        if (musicPlayer.myControllerRank === 0) return '♛';
        if (ChatRoomPlayerIsAdmin()) return '★';
        return '♫';
    }

    function updatePanelUI() {
        if (!musicPlayer.floatingPanel) return;
        const currentTrack = musicPlayer.currentPlaylist[musicPlayer.currentIndex];
        const trackDisplay = musicPlayer.floatingPanel.querySelector('#current-track');
        const playBtn = musicPlayer.floatingPanel.querySelector('#music-play');
        const loopBtn = musicPlayer.floatingPanel.querySelector('#music-loop');
        const volumeSlider = musicPlayer.floatingPanel.querySelector('#volume-slider');
        const volumeDisplay = musicPlayer.floatingPanel.querySelector('#volume-display');
        const headerTitle = musicPlayer.floatingPanel.querySelector('#panel-title');
        const content = musicPlayer.floatingPanel.querySelector('#music-panel-content');
        const rankIcon = getRankIcon();

        if (headerTitle) {
            if (content.style.display === 'none' && (currentTrack || musicPlayer.isPlaying)) {
                headerTitle.textContent = `${rankIcon} ${currentTrack?.name || 'Unknown'}`;
                headerTitle.style.fontSize = '12px';
            } else {
                headerTitle.textContent = `${rankIcon} CMC`;
                headerTitle.style.fontSize = '14px';
            }
        }

        if (trackDisplay) {
            if (currentTrack) {
                trackDisplay.textContent = `♪ ${currentTrack.name}`;
            } else if (musicPlayer.isPlaying) {
                trackDisplay.textContent = '♪ Unknown';
            } else {
                trackDisplay.textContent = '[ NO SIGNAL ]';
            }
        }

        if (playBtn) playBtn.textContent = musicPlayer.isPlaying ? '⏸' : '▶';

        // Bilibili: disable pause and loop only; volume stays functional (controls CMC audio level)
        const biliActive = musicPlayer.isBilibili;
        if (playBtn) { playBtn.disabled = biliActive; playBtn.style.opacity = biliActive ? '0.35' : '1'; }
        if (loopBtn) { loopBtn.disabled = biliActive; loopBtn.style.opacity = biliActive ? '0.35' : '1'; }
        // Volume slider always enabled — it controls CMC audio, not BC audio
        const volSliderEl = musicPlayer.floatingPanel.querySelector('#volume-slider');
        if (volSliderEl) { volSliderEl.disabled = false; volSliderEl.style.opacity = '1'; }

        if (loopBtn) {
            // When looping: bright accent background so the ⟳ icon stays visible
            loopBtn.style.background = musicPlayer.isLooping
                ? `linear-gradient(135deg,${COLORS.accent},${COLORS.highlight})`
                : `linear-gradient(135deg,${COLORS.dark},#4a2d6a)`;
            loopBtn.style.color = musicPlayer.isLooping ? '#fff' : COLORS.primary;
            loopBtn.style.border = musicPlayer.isLooping
                ? `1px solid ${COLORS.highlight}`
                : `1px solid ${COLORS.dim}`;
        }

        if (volumeSlider) volumeSlider.value = musicPlayer.volume * 100;
        if (volumeDisplay) volumeDisplay.textContent = Math.round(musicPlayer.volume * 100) + '%';

        renderPlaylistTab();
        updateBottomControls();
    }

    function renderPlaylistTab() {
        if (!musicPlayer.floatingPanel) return;
        const container = musicPlayer.floatingPanel.querySelector('#playlist-container');
        if (!container) return;
        switch(musicPlayer.activeTab) {
            case 'current': renderCurrentPlaylist(container); break;
            case 'personal': renderPersonalPlaylist(container); break;
            case 'history': renderHistoryTab(container); break;
        }
    }

    function renderCurrentPlaylist(container) {
        const list = musicPlayer.currentPlaylist;
        if (list.length === 0) {
            container.innerHTML = '<div style="font-size:11px;opacity:0.5;text-align:center;padding:15px;">[ EMPTY PLAYLIST ]</div>';
            return;
        }
        const canPlay = isFirstController() || canControlMusic();
        const canEdit = canEditPlaylist();
        container.innerHTML = list.map((track, idx) => {
            const safeName = sanitizeHTML(track.name || 'Unknown');
            const isCurrent = idx === musicPlayer.currentIndex;
            // Gray out name + no pointer if no play permission; keep save/share buttons
            const nameColor = isCurrent ? COLORS.highlight : (canPlay ? COLORS.light : COLORS.dim);
            const rowOpacity = canPlay ? '1' : '0.6';
            return `<div data-track-idx="${idx}" style="padding:6px;margin-bottom:3px;background:${isCurrent ? `linear-gradient(90deg,rgba(163,85,187,0.3),rgba(147,112,219,0.2))` : 'rgba(28,2,48,0.1)'};border:1px solid ${isCurrent ? COLORS.accent : 'transparent'};border-radius:4px;display:flex;justify-content:space-between;align-items:center;cursor:${canPlay?'pointer':'default'};font-size:12px;opacity:${rowOpacity};">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${nameColor};">${isCurrent ? '▶ ' : ''}${safeName}</span>
                <div style="display:flex;gap:3px;flex-shrink:0;opacity:1;">
                    <button data-share-idx="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;" title="分享到聊天室">📢</button>
                    <button data-add-idx="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;" title="添加到個人歌單">+</button>
                    ${canEdit ? `<button data-remove-idx="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;">×</button>` : ''}
                </div>
            </div>`;
        }).join('');
        container.querySelectorAll('[data-track-idx]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.hasAttribute('data-remove-idx') || e.target.hasAttribute('data-add-idx') || e.target.hasAttribute('data-share-idx')) return;
                if (!canPlay) return;
                const idx = parseInt(el.getAttribute('data-track-idx'));
                if (isFirstController()) {
                    playTrack(idx, true);
                } else {
                    requestPlayTrack(idx);
                }
            });
        });
        container.querySelectorAll('[data-share-idx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const track = musicPlayer.currentPlaylist[parseInt(btn.getAttribute('data-share-idx'))];
                if (track) shareTrack(track);
            });
        });
        container.querySelectorAll('[data-add-idx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAddToDialog(musicPlayer.currentPlaylist[parseInt(btn.getAttribute('data-add-idx'))]);
            });
        });
        container.querySelectorAll('[data-remove-idx]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTrack(parseInt(btn.getAttribute('data-remove-idx')));
            });
        });
    }

    function renderPersonalPlaylist(container) {
        const list = musicPlayer.personalPlaylist;
        if (list.length === 0) {
            container.innerHTML = '<div style="font-size:11px;opacity:0.5;text-align:center;padding:15px;">[ 個人歌單為空 ]</div>';
            return;
        }
        const isAdmin = canControlMusic();
        container.innerHTML = list.map((track, idx) => {
            const safeName = sanitizeHTML(track.name || 'Unknown');
            return `<div style="padding:6px;margin-bottom:3px;background:rgba(28,2,48,0.1);border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px;">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.light};">${safeName}</span>
                <div style="display:flex;gap:3px;flex-shrink:0;">
                    ${isAdmin ? `<button data-p-to-current="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;" title="加入當前歌單">→</button>` : ''}
                    <button data-p-remove="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;">×</button>
                </div>
            </div>`;
        }).join('');
        container.querySelectorAll('[data-p-to-current]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                addToCurrent(musicPlayer.personalPlaylist[parseInt(btn.getAttribute('data-p-to-current'))]);
            });
        });
        container.querySelectorAll('[data-p-remove]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                musicPlayer.personalPlaylist.splice(parseInt(btn.getAttribute('data-p-remove')), 1);
                savePersonalPlaylist();
                renderPlaylistTab();
            });
        });
    }

    function renderHistoryTab(container) {
        if (musicPlayer.historyViewRoom) {
            const tracks = musicPlayer.historyPlaylists[musicPlayer.historyViewRoom] || [];
            const roomLabel = sanitizeHTML(musicPlayer.historyViewRoom);
            container.innerHTML = `
                <div style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <button id="hist-back" style="padding:3px 8px;border-radius:3px;font-size:11px;">← 返回</button>
                    <span style="font-size:11px;color:${COLORS.dim};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${roomLabel}</span>
                </div>
                ${tracks.length === 0 ? `<div style="font-size:11px;opacity:0.5;text-align:center;padding:10px;">[ 空歌單 ]</div>` :
                tracks.map((track, idx) => {
                    const safeName = sanitizeHTML(track.name || 'Unknown');
                    return `<div style="padding:6px;margin-bottom:3px;background:rgba(28,2,48,0.1);border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px;">
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.light};">${safeName}</span>
                        <button data-h-add="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;" title="添加到歌單">+</button>
                    </div>`;
                }).join('')}
            `;
            container.querySelector('#hist-back')?.addEventListener('click', () => {
                musicPlayer.historyViewRoom = null;
                renderPlaylistTab();
            });
            container.querySelectorAll('[data-h-add]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showAddToDialog(tracks[parseInt(btn.getAttribute('data-h-add'))]);
                });
            });
        } else {
            if (musicPlayer.historyRoomList.length === 0) {
                container.innerHTML = '<div style="font-size:11px;opacity:0.5;text-align:center;padding:15px;">[ 無歷史歌單 ]</div>';
                return;
            }
            container.innerHTML = musicPlayer.historyRoomList.map(roomKey => {
                const count = (musicPlayer.historyPlaylists[roomKey] || []).length;
                const safeKey = sanitizeHTML(roomKey);
                return `<div data-h-room="${safeKey}" style="padding:6px;margin-bottom:3px;background:rgba(28,2,48,0.1);border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-size:12px;cursor:pointer;">
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${COLORS.light};">${safeKey} <span style="opacity:0.5;">(${count}首)</span></span>
                    <button data-h-del="${safeKey}" style="padding:2px 5px;border-radius:3px;font-size:11px;">×</button>
                </div>`;
            }).join('');
            container.querySelectorAll('[data-h-room]').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.hasAttribute('data-h-del')) return;
                    musicPlayer.historyViewRoom = el.getAttribute('data-h-room');
                    renderPlaylistTab();
                });
            });
            container.querySelectorAll('[data-h-del]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteHistoryRoom(btn.getAttribute('data-h-del'));
                });
            });
        }
    }

    // ============ 播放列表操作 ============
    function removeTrack(idx) {
        if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); return; }
        const removedUrl = musicPlayer.currentPlaylist[idx]?.url;
        musicPlayer.currentPlaylist.splice(idx, 1);
        if (musicPlayer.currentIndex === idx) {
            stopMusic();
            musicPlayer.currentIndex = -1;
        } else if (musicPlayer.currentIndex > idx) {
            musicPlayer.currentIndex--;
        }
        updatePanelUI();
        saveSettings();
        if (removedUrl) broadcastTrackRemove(removedUrl);
    }
    function clearPlaylist() {
        if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); return; }
        showConfirmDialog('確定清空當前播放列表？', () => {
            musicPlayer.currentPlaylist = [];
            musicPlayer.currentIndex = -1;
            stopMusic();
            updatePanelUI();
            broadcastPlaylistClear();
        });
    }
    function clearPersonalPlaylist() {
        showConfirmDialog('確定清空個人歌單？', () => {
            musicPlayer.personalPlaylist = [];
            savePersonalPlaylist();
            renderPlaylistTab();
        });
    }
    function showAddTrackDialog() {
        if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); return; }
        showTrackInputDialog('添加到當前歌單', (name, url) => {
            const track = { name, url };
            musicPlayer.currentPlaylist.push(track);
            updatePanelUI();
            broadcastTrackAdd(track);
            sendLocalMsg(`已添加: ${name}`);
        });
    }
    function showAddTrackDialogPersonal() {
        showTrackInputDialog('添加到個人歌單', (name, url) => {
            addToPersonal({ name, url });
        });
    }
    function showTrackInputDialog(title, onConfirm) {
        const dialog = createDialog(`
            <div style="margin-bottom:10px;color:${COLORS.light};font-size:13px;">${sanitizeHTML(title)}</div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:5px;color:${COLORS.primary};">歌曲名稱:</label>
                <input type="text" id="track-name" placeholder="輸入歌曲名稱" style="width:100%;padding:8px;border-radius:5px;border:1px solid ${COLORS.primary};background:#2d1a4a;color:${COLORS.primary};box-sizing:border-box;">
            </div>
            <div style="margin-bottom:15px;">
                <label style="display:block;margin-bottom:5px;color:${COLORS.primary};">音頻 URL:</label>
                <input type="text" id="track-url" placeholder="https://..." style="width:100%;padding:8px;border-radius:5px;border:1px solid ${COLORS.primary};background:#2d1a4a;color:${COLORS.primary};box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button id="dialog-confirm" style="flex:1;padding:10px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.primary};border:1px solid ${COLORS.primary};border-radius:5px;cursor:pointer;">確定</button>
                <button id="dialog-cancel" style="flex:1;padding:10px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.dim};border:1px solid ${COLORS.dim};border-radius:5px;cursor:pointer;">取消</button>
            </div>
        `);
        dialog.querySelector('#dialog-confirm').onclick = () => {
            const name = dialog.querySelector('#track-name').value.trim();
            const url = dialog.querySelector('#track-url').value.trim();
            if (!name || !url) { showAlertDialog('請填寫完整信息'); return; }
            if (!isSafeMediaURL(url)) { showAlertDialog('無效或不允許的網址（請使用 YouTube、Bilibili 或直接音頻連結）'); return; }
            onConfirm(name, url);
            closeDialog(dialog);
        };
        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }
    function showImportDialog() {
        if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); return; }
        const currentList = musicPlayer.currentPlaylist.map(t => `${t.name}\n${t.url}`).join('\n');
        const dialog = createDialog(`
            <div style="margin-bottom:10px;color:${COLORS.primary};">導入播放列表 (格式: 名稱換行URL):</div>
            <textarea id="import-text" style="width:100%;height:200px;padding:8px;border-radius:5px;border:1px solid ${COLORS.primary};background:#2d1a4a;color:${COLORS.primary};font-family:monospace;box-sizing:border-box;">${sanitizeHTML(currentList)}</textarea>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button id="dialog-confirm" style="flex:1;padding:10px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.primary};border:1px solid ${COLORS.primary};border-radius:5px;cursor:pointer;">導入</button>
                <button id="dialog-cancel" style="flex:1;padding:10px;background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.dim};border:1px solid ${COLORS.dim};border-radius:5px;cursor:pointer;">取消</button>
            </div>
        `);
        dialog.querySelector('#dialog-confirm').onclick = () => {
            const lines = dialog.querySelector('#import-text').value.trim().split('\n').filter(l => l.trim());
            if (lines.length % 2 !== 0) { showAlertDialog('格式錯誤：每首歌需要兩行（名稱+URL）'); return; }
            const newList = [];
            for (let i = 0; i < lines.length; i += 2) {
                const name = lines[i].trim(), url = lines[i + 1].trim();
                if (!isSafeMediaURL(url)) { showAlertDialog(`不允許的網址: ${url}`); return; }
                newList.push({ name, url });
            }
            musicPlayer.currentPlaylist = newList;
            musicPlayer.currentIndex = -1;
            updatePanelUI();
            closeDialog(dialog);
            sendLocalMsg(`已導入 ${newList.length} 首`);
            broadcastPlaylistFull();
        };
        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }
    function showConfirmDialog(message, onConfirm, onCancel) {
        const dialog = createDialog(`
            <div style="color:${COLORS.light};font-size:14px;margin-bottom:16px;line-height:1.5;">${sanitizeHTML(message)}</div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="cmc-confirm-ok" style="padding:8px 20px;border-radius:5px;border:1px solid ${COLORS.accent};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.accent};cursor:pointer;">確認</button>
                <button id="cmc-confirm-cancel" style="padding:8px 20px;border-radius:5px;border:1px solid ${COLORS.dim};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.dim};cursor:pointer;">取消</button>
            </div>
        `);
        dialog.querySelector('#cmc-confirm-ok').onclick = () => { closeDialog(dialog); if (onConfirm) onConfirm(); };
        dialog.querySelector('#cmc-confirm-cancel').onclick = () => { closeDialog(dialog); if (onCancel) onCancel(); };
    }
    function showAlertDialog(message) {
        const dialog = createDialog(`
            <div style="color:${COLORS.light};font-size:14px;margin-bottom:16px;line-height:1.5;">${sanitizeHTML(message)}</div>
            <div style="display:flex;justify-content:flex-end;">
                <button id="cmc-alert-ok" style="padding:8px 20px;border-radius:5px;border:1px solid ${COLORS.primary};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.primary};cursor:pointer;">確認</button>
            </div>
        `);
        dialog.querySelector('#cmc-alert-ok').onclick = () => closeDialog(dialog);
    }
    function createDialog(html) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10001;display:flex;align-items:center;justify-content:center;';
        const dialog = document.createElement('div');
        dialog.style.cssText = `background:linear-gradient(135deg,#1a0d2e,#2d1a4a);padding:20px;border-radius:10px;border:2px solid ${COLORS.primary};box-shadow:0 0 30px rgba(147,112,219,0.5);min-width:400px;max-width:600px;`;
        dialog.innerHTML = html;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        return dialog;
    }
    function closeDialog(dialog) {
        dialog.parentElement?.remove();
    }

    // ============ 清理 ============
    function cleanup() {
        log('開始清理資源...');

        // Save current playlist to history before clearing
        saveCurrentToHistory();

        // Clear current (room) playlist
        musicPlayer.currentPlaylist = [];
        musicPlayer.currentIndex = -1;
        musicPlayer.playlistRequested = false;

        stopMusic();

        if (musicPlayer.controllerCheckInterval) {
            clearInterval(musicPlayer.controllerCheckInterval);
            musicPlayer.controllerCheckInterval = null;
        }

        hidePanel();
        if (musicPlayer.lyricsPanel) musicPlayer.lyricsPanel.style.display = 'none';

        removeFromControllers();
        musicPlayer.bcMusicURL = "";
        unmuteBCMusic(); // 還原玩家原本的 BC 音樂音量，避免帳號設定被永久改成 0

        saveSettings();
        log('資源清理完成');
    }

    // ============ Hook ============
    function hookChatRoom() {
        if (!modApi?.hookFunction) return;

        modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
            muteBCMusic();
            return next(args).then(() => {
                setTimeout(async () => {
                    if (ChatRoomData && !ChatRoomData.Custom) ChatRoomData.Custom = {};
                    musicPlayer.currentRoomName = getCurrentRoomName();
                    muteBCMusic();
                    onRoomEnter();

                    if (!window.CMCWelcomed) {
                        sendLocalMsg(`CHAT MUSIC CONTROLLER v${MOD_VER} | /cmc show`);
                        window.CMCWelcomed = true;
                    }
                }, 1000);
            });
        });

        modApi.hookFunction("ChatRoomLeave", 0, (args, next) => {
            cleanup();
            next(args);
        });

        modApi.hookFunction("ChatRoomMessage", 0, (args, next) => {
            const data = args[0];
            if (data?.Content === "CMCSync") {
                handleMusicSync(data);
                return next(args);
            }
            next(args);
            setTimeout(() => scanChatForCMCShares(), 150);
        });

        // Hook ServerSend to also scan own messages
        modApi.hookFunction("ServerSend", 0, (args, next) => {
            next(args);
            const [type, data] = args;
            if (type === "ChatRoomChat" && data?.Type === "Chat") {
                setTimeout(() => scanChatForCMCShares(), 200);
            }
        });

        modApi.hookFunction("ChatRoomMenuClick", 0, (args, next) => {
            muteBCMusic();
            const result = next(args);
            if (result?.catch) result.catch(() => {});
            setTimeout(() => muteBCMusic(), 100);
            return result;
        });

        // Helper: hide CMC panel for navigation (doesn't change isPanelVisible)
        function hideForNav() {
            if (!musicPlayer.isPanelVisible || musicPlayer.hiddenForNav) return;
            if (musicPlayer.floatingPanel) musicPlayer.floatingPanel.style.display = 'none';
            if (musicPlayer.userListPanel) musicPlayer.userListPanel.style.display = 'none';
            musicPlayer.hiddenForNav = true;
        }

        // Poll CurrentScreen every 250ms — hide CMC on sub-screens, show on return to ChatRoom
        // (Avoids depending on BC's internal function names which vary by version)
        const NAV_SCREENS = new Set(["Appearance", "InformationSheet", "ChatAdmin"]);
        let _lastScreen = "";
        setInterval(() => {
            const screen = typeof CurrentScreen !== "undefined" ? CurrentScreen : "";
            if (screen === _lastScreen) return;
            _lastScreen = screen;
            if (NAV_SCREENS.has(screen)) {
                hideForNav();
            } else if (screen === "ChatRoom" && musicPlayer.hiddenForNav &&
                       musicPlayer.isPanelVisible && musicPlayer.floatingPanel) {
                musicPlayer.floatingPanel.style.display = 'block';
                musicPlayer.hiddenForNav = false;
            }
        }, 250);

        modApi.hookFunction("ChatRoomSyncRoomProperties", 0, (args, next) => {
            muteBCMusic();
            next(args);
            muteBCMusic();
            if (!musicPlayer.isPanelVisible) return;
            setTimeout(() => {
                const newURL = ChatRoomData?.Custom?.MusicURL || "";
                if (newURL && newURL !== musicPlayer.bcMusicURL) {
                    // Room music URL changed (someone outside CMC updated it, or rank-0 changed song)
                    musicPlayer.bcMusicURL = newURL;
                    muteBCIfNeeded(newURL);
                    playOrMatchURL(newURL);
                }
                recalcMyRank();
                updatePanelUI();
            }, 100);
        });

        modApi.hookFunction("ChatRoomCustomizationClear", 0, (args, next) => {
            muteBCMusic();
            const result = next(args);
            if (result?.catch) result.catch(() => {});
            muteBCMusic();
            return result;
        });
    }

    // ============ 命令 ============
    function handleCMCCommand(text) {
        const args = text.trim().split(/\s+/).filter(x => x);
        const cmd = (args[0] || "").toLowerCase();

        if (!cmd || cmd === "help") {
            const status = musicPlayer.isPlaying ? "播放中" : "停止";
            const controller = isFirstController() ? "主控制者" : canControlMusic() ? "管理員" : "訪客";
            sendLocalMsg(
                `CMC v${MOD_VER}\n` +
                `狀態: ${status} | 身份: ${controller}\n` +
                `當前: ${musicPlayer.currentPlaylist.length}首 | 個人: ${musicPlayer.personalPlaylist.length}首\n\n` +
                "命令:\n" +
                "/cmc show - 顯示面板\n" +
                "/cmc play - 播放/暫停\n" +
                "/cmc next/prev - 上/下一首\n" +
                "/cmc loop - 切換循環\n" +
                "/cmc lyrics - 顯示歌詞\n" +
                "/cmc share - 分享當前歌曲\n" +
                "/cmc vol <0-100> - 設置音量\n" +
                "/cmc add <名稱> <URL> - 添加到當前\n" +
                "/cmc sync - 請求同步\n" +
                "/cmc controllers - 查看控制者列表\n" +
                "/cmc swap <MemberNumber> - 讓出順位0給指定成員\n" +
                "/cmc debug - 切換調試\n" +
                "/cmc export - 導出播放列表"
                , 25000);
            return;
        }

        switch(cmd) {
            case "show": showPanel(); break;
            case "play": togglePlay(); break;
            case "pause": pauseMusic(); break;
            case "stop": stopMusic(); sendLocalMsg("已停止播放"); break;
            case "next": playNext(); break;
            case "prev": playPrevious(); break;
            case "loop": toggleLoop(); break;
            case "lyrics": toggleLyrics(); break;
            case "share": shareCurrentTrack(); break;
            case "vol": {
                const vol = parseInt(args[1]);
                if (!isNaN(vol) && vol >= 0 && vol <= 100) { setVolume(vol / 100); sendLocalMsg(`音量: ${vol}%`); }
                else sendLocalMsg("音量範圍: 0-100");
                break;
            }
            case "add": {
                if (!canEditPlaylist()) { sendLocalMsg("你沒有歌單編輯權限"); break; }
                if (args.length >= 3) {
                    const name = args[1], url = args.slice(2).join(' ');
                    if (isSafeMediaURL(url)) {
                        const track = { name, url };
                        musicPlayer.currentPlaylist.push(track);
                        updatePanelUI();
                        sendLocalMsg(`已添加: ${name}`);
                        broadcastTrackAdd(track);
                    } else sendLocalMsg("無效的URL");
                } else sendLocalMsg("用法: /cmc add <名稱> <URL>");
                break;
            }
            case "sync":
                registerController();
                requestMusicSync();
                sendLocalMsg("同步請求已發送");
                break;
            case "export": {
                const data = { version: MOD_VER, personal: musicPlayer.personalPlaylist, current: musicPlayer.currentPlaylist, timestamp: Date.now() };
                navigator.clipboard.writeText(JSON.stringify(data, null, 2))
                    .then(() => sendLocalMsg('已複製到剪貼板'))
                    .catch(() => { console.log('CMC Export:', data); sendLocalMsg('導出數據已顯示在控制台'); });
                break;
            }
            case "swap": {
                const target = parseInt(args[1]);
                if (!isNaN(target)) swapRankWith(target);
                else sendLocalMsg("用法: /cmc swap <MemberNumber>");
                break;
            }
            case "controllers": {
                const list = getControllerList();
                if (list.length === 0) { sendLocalMsg("目前無 CMC 使用者"); break; }
                const lines = list.map(c => {
                    const tag = c.rank === 1 ? '♛主控' : `#${c.rank}`;
                    const me = c.memberNumber === Player.MemberNumber ? ' (我)' : '';
                    return `  ${tag} ${c.name}(${c.memberNumber})${me} [${c.list}首]`;
                }).join('\n');
                sendLocalMsg(`CMC 使用者:\n${lines}`, 10000);
                break;
            }
            case "debug":
                window.CMC_DEBUG = !window.CMC_DEBUG;
                sendLocalMsg(`調試模式: ${window.CMC_DEBUG ? "開啟" : "關閉"}`);
                break;
            default:
                sendLocalMsg("未知指令，使用 /cmc help 查看幫助");
        }
    }

    // ============ 初始化 ============
    async function initialize() {
        // Load YouTube IFrame API
        if (!window.YT) {
            await new Promise(resolve => {
                const tag = document.createElement('script');
                tag.src = 'https://www.youtube.com/iframe_api';
                tag.onload = resolve;
                document.head.appendChild(tag);
            });
            await waitFor(() => window.YT && window.YT.Player, 10000);
        }

        await waitFor(() => typeof Player?.MemberNumber === 'number', 30000);

        try {
            await initIndexedDB();
        } catch(e) {
            error('IndexedDB 初始化失敗:', e);
            sendLocalMsg('CMC 存儲初始化失敗，部分功能受限');
        }

        await loadSettingsFromDB();

        if (typeof CommandCombine === 'function') {
            CommandCombine([{ Tag: "cmc", Description: "Chat Music Controller", Action: handleCMCCommand }]);
        }

        hookChatRoom();

        musicPlayer.controllerCheckInterval = setInterval(() => {
            if (CurrentScreen === "ChatRoom") {
                checkAndPlayBCMusic();
            }
        }, CONSTANTS.CONTROLLER_CHECK_INTERVAL);

        window._CMC = musicPlayer;
        log('初始化完成');
    }

    // ============ 啟動 ============
    (async () => {
        await waitFor(() => typeof bcModSdk !== 'undefined', 30000);

        try {
            modApi = bcModSdk.registerMod({
                name: "liko - CMC",
                fullName: "Chat Music Controller",
                version: MOD_VER,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
            });
            log('ModSDK 注冊成功');
        } catch(e) {
            error('ModSDK 注冊失敗:', e);
        }

        await initialize();
    })();

    window.addEventListener('beforeunload', cleanup);
})();
