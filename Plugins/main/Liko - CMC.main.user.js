// ==UserScript==
// @name         Liko - Chat Music Controller
// @name:zh      Liko的聊天室音樂控制器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.2.0
// @description  Chat Music Controller with playlist sharing and lyrics support
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.2.0";
    if (window.Liko.CMC) return;
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
        isPanelVisible: false,

        audioPlayer: null,
        isLoading: false,
        loadingTimeout: null,
        progressInterval: null,
        preloadPlayer: null,

        myControllerRank: -1,
        activeController: null,
        controllerCheckInterval: null,

        currentLyrics: [],
        currentLyricIndex: -1,

        bcMusicURL: "",
        bcMusicMuted: false,

        ytPlayer: null,
        ytReady: false,
        isYouTube: false,

        isBilibili: false,

        currentRoomName: "",
        playlistRequested: false,
    };

    // Compatibility alias: musicPlayer.playlist → currentPlaylist
    Object.defineProperty(musicPlayer, 'playlist', {
        get() { return this.currentPlaylist; },
        set(v) { this.currentPlaylist = v; }
    });

    // ============ URL 驗證 ============
    function isValidURL(url) {
        try {
            const u = new URL(encodeURI(url));
            return u.protocol === 'http:' || u.protocol === 'https:';
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

    // ============ 控制者管理 ============
    function ensureSharedSettings() {
        if (!Player?.OnlineSharedSettings) return;
        if (!Player.OnlineSharedSettings.CMCControllers) {
            Player.OnlineSharedSettings.CMCControllers = [];
        }
    }
    function getControllerList() {
        ensureSharedSettings();
        return Player.OnlineSharedSettings?.CMCControllers || [];
    }
    function updateControllerRank() {
        // Only register when panel is visible (CMC active), admin, AND ChatRoomCustomized is active
        if (!musicPlayer.isPanelVisible || !ChatRoomPlayerIsAdmin() || !ChatRoomCustomized) {
            removeFromControllers();
            return;
        }
        const wasFirstController = isFirstController();
        const controllers = getControllerList();
        const myNumber = Player.MemberNumber;
        if (!controllers.includes(myNumber)) {
            controllers.push(myNumber);
            controllers.sort((a, b) => a - b);
            Player.OnlineSharedSettings.CMCControllers = controllers;
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
        musicPlayer.myControllerRank = controllers.indexOf(myNumber);
        musicPlayer.activeController = controllers[0] || null;
        log('控制者列表:', controllers, '我的排名:', musicPlayer.myControllerRank);

        // Notify when first becoming rank-0
        if (isFirstController() && !wasFirstController) {
            sendLocalMsg('你是最高順位控制者 (#0)，歌曲播完後將自動播放下一首', 8000);
        }
    }
    function removeFromControllers() {
        if (!Player?.OnlineSharedSettings?.CMCControllers) {
            musicPlayer.myControllerRank = -1;
            return;
        }
        const controllers = getControllerList();
        const myNumber = Player.MemberNumber;
        const idx = controllers.indexOf(myNumber);
        if (idx >= 0) {
            // Broadcast before removing so others know our rank
            ServerSend("ChatRoomChat", {
                Type: "Hidden",
                Content: "CMCSync",
                Dictionary: [{ Action: "ControllerLeft", LeftRank: idx, LeftMember: myNumber, From: myNumber }]
            });
            controllers.splice(idx, 1);
            Player.OnlineSharedSettings.CMCControllers = controllers;
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
        musicPlayer.myControllerRank = -1;
        musicPlayer.activeController = controllers[0] || null;
    }
    function canControlMusic() { return ChatRoomPlayerIsAdmin(); }
    function isFirstController() { return musicPlayer.myControllerRank === 0; }

    // Rank-0 swaps their position with targetMemberNumber in the controller list
    function swapRankWith(targetMemberNumber) {
        if (!isFirstController()) { sendLocalMsg("只有順位0才能讓出順位"); return; }
        const controllers = getControllerList();
        const myIdx = controllers.indexOf(Player.MemberNumber);
        const targetIdx = controllers.indexOf(targetMemberNumber);
        if (targetIdx < 0) { sendLocalMsg(`成員 ${targetMemberNumber} 不在控制者列表中`); return; }

        // Swap positions
        [controllers[myIdx], controllers[targetIdx]] = [controllers[targetIdx], controllers[myIdx]];
        Player.OnlineSharedSettings.CMCControllers = controllers;
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });

        // Broadcast new order to all CMC users
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "ControllerUpdate", Controllers: controllers, From: Player.MemberNumber }]
        });

        // Update own rank
        musicPlayer.myControllerRank = controllers.indexOf(Player.MemberNumber);
        musicPlayer.activeController = controllers[0] || null;
        sendLocalMsg(`已與 ${targetMemberNumber} 互換順位，我的新順位: ${musicPlayer.myControllerRank}`);
        updatePanelUI();
        log('順位互換後列表:', controllers);
    }

    // ============ BC 音樂靜音 ============
    // Only mutes BC audio system when ChatRoomCustomized is true
    function muteBCMusic() {
        if (!ChatRoomCustomized) return;
        try { AudioBackgroundMusic.volume = 0; } catch(e) {}
        setTimeout(() => { try { AudioBackgroundMusicStop(); } catch(e) {} }, 100);
        musicPlayer.bcMusicMuted = true;
        log('BC音樂已靜音');
    }
    function muteBCIfNeeded(url) {
        if (ChatRoomCustomized && isBCCompatibleURL(url)) muteBCMusic();
    }
    function unmuteBCMusic() { musicPlayer.bcMusicMuted = false; }

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
        if (!canControlMusic()) { sendLocalMsg("只有房管可以修改當前歌單"); return; }
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
        const isAdmin = canControlMusic();
        if (!isAdmin) {
            // Guests can only add to personal
            addToPersonal(track);
            return;
        }
        const dialog = createDialog(`
            <div style="margin-bottom:15px;color:${COLORS.light};font-size:14px;">添加「${sanitizeHTML(track.name || 'Unknown')}」到：</div>
            <div style="display:flex;gap:10px;">
                <button id="add-personal" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.primary};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.primary};cursor:pointer;">個人歌單</button>
                <button id="add-current" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.accent};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.accent};cursor:pointer;">當前歌單</button>
                <button id="add-cancel" style="flex:1;padding:10px;border-radius:5px;border:1px solid ${COLORS.dim};background:linear-gradient(135deg,#2d1a4a,#4a2d6a);color:${COLORS.dim};cursor:pointer;">取消</button>
            </div>
        `);
        dialog.querySelector('#add-personal').onclick = () => { addToPersonal(track); closeDialog(dialog); };
        dialog.querySelector('#add-current').onclick = () => { addToCurrent(track); closeDialog(dialog); };
        dialog.querySelector('#add-cancel').onclick = () => closeDialog(dialog);
    }

    // ============ 同步消息 ============
    function requestMusicSync() {
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "RequestSync", From: Player.MemberNumber }]
        });
    }
    function sendMusicState(target = null, includeTime = false) {
        if (!isFirstController()) return;
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
        if (!canControlMusic()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "PlaylistUpdate", Playlist: musicPlayer.currentPlaylist, From: Player.MemberNumber }]
        });
        log('已廣播完整播放列表');
    }
    // Incremental: broadcast one added track
    function broadcastTrackAdd(track) {
        if (!canControlMusic()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "TrackAdd", Track: track, From: Player.MemberNumber }]
        });
        log('已廣播新增曲目:', track.name);
    }
    // Incremental: broadcast one removed track (by URL)
    function broadcastTrackRemove(trackUrl) {
        if (!canControlMusic()) return;
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{ Action: "TrackRemove", TrackUrl: trackUrl, From: Player.MemberNumber }]
        });
        log('已廣播移除曲目:', trackUrl);
    }
    // Broadcast clear all
    function broadcastPlaylistClear() {
        if (!canControlMusic()) return;
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
            // Full sync — accept from active controller (or self if first)
            if (!isFirstController() && msg.From === musicPlayer.activeController) {
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

        if (msg.Action === "RequestSync" && isFirstController()) {
            sendMusicState(msg.From, true);
        }

        if (msg.Action === "ControllerUpdate") {
            // Rank-0 broadcasted a new controller order (e.g. after a swap)
            const newList = msg.Controllers || [];
            if (Player?.OnlineSharedSettings) {
                Player.OnlineSharedSettings.CMCControllers = newList;
                ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
            }
            musicPlayer.myControllerRank = newList.indexOf(Player.MemberNumber);
            musicPlayer.activeController = newList[0] || null;
            log('控制者順位已更新:', newList, '我的排名:', musicPlayer.myControllerRank);
            updatePanelUI();
            return;
        }

        if (msg.Action === "ControllerLeft") {
            // Someone left the controller list — adjust our own rank if needed
            const leftRank = msg.LeftRank;
            const leftMember = msg.LeftMember;
            // Remove the left member from our local copy
            const controllers = getControllerList();
            const idx = controllers.indexOf(leftMember);
            if (idx >= 0) {
                controllers.splice(idx, 1);
                Player.OnlineSharedSettings.CMCControllers = controllers;
                ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
            }
            // Those with rank higher than the left slot move up by 1
            if (musicPlayer.myControllerRank > leftRank) {
                musicPlayer.myControllerRank--;
            }
            musicPlayer.activeController = controllers[0] || null;
            log('控制者離開 rank:', leftRank, '我的新排名:', musicPlayer.myControllerRank);
            updatePanelUI();
            return;
        }

        if (msg.Action === "SyncState") {
            if (msg.From !== musicPlayer.activeController) return;
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
        if (!isValidURL(url)) { if (onError) onError(new Error('無效URL')); return; }

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
        if (!isValidURL(next.url) || isYouTubeURL(next.url) || isBilibiliURL(next.url)) return;
        if (musicPlayer.preloadPlayer) { musicPlayer.preloadPlayer.src = ''; musicPlayer.preloadPlayer = null; }
        musicPlayer.preloadPlayer = new Audio();
        musicPlayer.preloadPlayer.src = next.url;
        musicPlayer.preloadPlayer.volume = 0;
        musicPlayer.preloadPlayer.preload = 'auto';
        log('預載下一首:', next.name);
    }

    // ============ 播放控制 ============
    function playTrack(trackIndex, sendNotification = true) {
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
            if (sendNotification && isFirstController()) sendTrackNotification(track.name, "正在播放");
            startProgressUpdate();
            if (!musicPlayer.isYouTube && !musicPlayer.isBilibili) { loadLyrics(track.name); preloadNextTrack(); }

            const needUpdate = musicPlayer.bcMusicURL !== track.url;
            musicPlayer.bcMusicURL = track.url;
            if (needUpdate && isFirstController()) updateRoomMusicURL(track.url);
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

        if (musicPlayer.isBilibili) {
            const cur = musicPlayer.biliCurrentTime || 0;
            const dur = musicPlayer.biliDuration || 0;
            if (dur > 0) {
                progressBar.style.width = ((cur / dur) * 100) + '%';
                const fmt = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
                timeDisplay.textContent = `${fmt(cur)} / ${fmt(dur)}`;
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
            const fmt = s => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
            timeDisplay.textContent = `${fmt(current)} / ${fmt(duration)}`;
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

    // ============ 檢查BC音樂 ============
    function checkAndPlayBCMusic() {
        // CMC is inactive when panel is closed
        if (!musicPlayer.isPanelVisible) return;

        if (ChatRoomData && !ChatRoomData.Custom) ChatRoomData.Custom = {};
        const newURL = ChatRoomData?.Custom?.MusicURL || "";

        updateControllerRank();

        log('BC音樂檢查:', { ChatRoomCustomized, MusicURL: newURL, isPlaying: musicPlayer.isPlaying });

        if (newURL) {
            muteBCIfNeeded(newURL);
            if (musicPlayer.bcMusicURL !== newURL) {
                musicPlayer.bcMusicURL = newURL;

                if (canControlMusic() && musicPlayer.currentPlaylist.length > 0) {
                    const idx = musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0;
                    playTrack(idx, false);
                } else if (!musicPlayer.isPlaying) {
                    const matchIdx = musicPlayer.currentPlaylist.findIndex(t => t.url === newURL);
                    if (matchIdx >= 0) {
                        playTrack(matchIdx, false);
                    } else {
                        // No matching playlist entry — play as unknown track
                        playUnknownTrack(newURL);
                        // Offer to fetch playlist from controller
                        setTimeout(askForPlaylist, 2000);
                    }
                }
            }
        }
    }

    function askForPlaylist() {
        if (musicPlayer.playlistRequested) return;
        const controllers = getControllerList();
        if (controllers.length === 0) return;
        if (musicPlayer.currentPlaylist.length > 0) return;

        musicPlayer.playlistRequested = true;
        const confirmed = confirm('[CMC] 此房間有主控制者，是否要獲取房間歌單？');
        if (confirmed) {
            requestMusicSync();
            sendLocalMsg('已向主控制者請求歌單');
        }
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
    function shareCurrentTrack() {
        const track = musicPlayer.currentPlaylist[musicPlayer.currentIndex];
        const url = track?.url || musicPlayer.bcMusicURL || "";
        if (!url) { sendLocalMsg("沒有正在播放的歌曲"); return; }
        const name = track?.name || 'Unknown';
        ServerSend("ChatRoomChat", {
            Type: "Chat",
            Content: `${CMC_SHARE_PREFIX}${name}\n${url}`,
            Dictionary: []
        });
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
    function sendTrackNotification(trackName, action = "正在播放") {
        if (!isFirstController()) return;
        ServerSend("ChatRoomChat", {
            Type: "Action",
            Content: "CMC_PLAY",
            Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CMC_PLAY', Text: `${action}: ${trackName}` }]
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
        panel.style.cssText = `position:fixed;top:100px;right:20px;width:350px;background:linear-gradient(135deg,#1a0d2e,#2d1a4a);border:2px solid ${COLORS.primary};border-radius:10px;box-shadow:0 0 30px rgba(147,112,219,0.5),inset 0 0 20px rgba(147,112,219,0.1);z-index:10000;font-family:'Courier New',monospace;color:${COLORS.primary};overflow:hidden;`;
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
                        <button id="music-share" style="padding:8px 12px;border-radius:4px;font-size:12px;" title="分享當前歌曲到聊天室">📢</button>
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

        panel.querySelector('#music-minimize').onclick = () => toggleMinimize();
        panel.querySelector('#music-close').onclick = () => hidePanel();
        panel.querySelector('#music-play').onclick = () => togglePlay();
        panel.querySelector('#music-prev').onclick = () => playPrevious();
        panel.querySelector('#music-next').onclick = () => playNext();
        panel.querySelector('#music-loop').onclick = () => toggleLoop();
        panel.querySelector('#music-lyrics').onclick = () => toggleLyrics();
        panel.querySelector('#music-share').onclick = () => shareCurrentTrack();
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

    function hidePanel() {
        if (musicPlayer.floatingPanel) {
            musicPlayer.floatingPanel.style.display = 'none';
        }
        musicPlayer.isPanelVisible = false;
        // CMC closed: stop music and remove from controller list
        stopMusic();
        removeFromControllers();
        log('CMC 已關閉，音樂停止，順位移除');
    }
    function showPanel() {
        if (!musicPlayer.floatingPanel) createFloatingPanel();
        musicPlayer.floatingPanel.style.display = 'block';
        musicPlayer.isPanelVisible = true;
        // CMC opened: register controller rank and check room music
        updateControllerRank();
        checkAndPlayBCMusic();
        // Offer to get playlist if controllers exist and no current playlist
        setTimeout(() => askForPlaylist(), 500);
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

        if (loopBtn) {
            loopBtn.style.background = musicPlayer.isLooping
                ? `linear-gradient(135deg,${COLORS.accent},${COLORS.highlight})`
                : `linear-gradient(135deg,${COLORS.dark},#4a2d6a)`;
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
        const isAdmin = canControlMusic();
        container.innerHTML = list.map((track, idx) => {
            const safeName = sanitizeHTML(track.name || 'Unknown');
            const isCurrent = idx === musicPlayer.currentIndex;
            return `<div data-track-idx="${idx}" style="padding:6px;margin-bottom:3px;background:${isCurrent ? `linear-gradient(90deg,rgba(163,85,187,0.3),rgba(147,112,219,0.2))` : 'rgba(28,2,48,0.1)'};border:1px solid ${isCurrent ? COLORS.accent : 'transparent'};border-radius:4px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:12px;">
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${isCurrent ? COLORS.highlight : COLORS.light};">${isCurrent ? '▶ ' : ''}${safeName}</span>
                <div style="display:flex;gap:3px;flex-shrink:0;">
                    <button data-add-idx="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;" title="添加到歌單">+</button>
                    ${isAdmin ? `<button data-remove-idx="${idx}" style="padding:2px 5px;border-radius:3px;font-size:11px;">×</button>` : ''}
                </div>
            </div>`;
        }).join('');
        container.querySelectorAll('[data-track-idx]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.hasAttribute('data-remove-idx') || e.target.hasAttribute('data-add-idx')) return;
                if (canControlMusic()) playTrack(parseInt(el.getAttribute('data-track-idx')), true);
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
        if (!canControlMusic()) { sendLocalMsg("只有房管可以修改播放列表"); return; }
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
        if (!canControlMusic()) { sendLocalMsg("只有房管可以清空播放列表"); return; }
        if (!confirm('確定清空當前播放列表？')) return;
        musicPlayer.currentPlaylist = [];
        musicPlayer.currentIndex = -1;
        stopMusic();
        updatePanelUI();
        broadcastPlaylistClear();
    }
    function clearPersonalPlaylist() {
        if (!confirm('確定清空個人歌單？')) return;
        musicPlayer.personalPlaylist = [];
        savePersonalPlaylist();
        renderPlaylistTab();
    }
    function showAddTrackDialog() {
        if (!canControlMusic()) { sendLocalMsg("只有房管可以添加歌曲"); return; }
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
            if (!name || !url) { alert('請填寫完整信息'); return; }
            if (!isValidURL(url)) { alert('無效的URL'); return; }
            onConfirm(name, url);
            closeDialog(dialog);
        };
        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }
    function showImportDialog() {
        if (!canControlMusic()) { sendLocalMsg("只有房管可以導入播放列表"); return; }
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
            if (lines.length % 2 !== 0) { alert('格式錯誤：每首歌需要兩行（名稱+URL）'); return; }
            const newList = [];
            for (let i = 0; i < lines.length; i += 2) {
                const name = lines[i].trim(), url = lines[i + 1].trim();
                if (!isValidURL(url)) { alert(`無效的URL: ${url}`); return; }
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
                    updateControllerRank();
                    muteBCMusic();
                    checkAndPlayBCMusic();

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
            setTimeout(() => { muteBCMusic(); checkAndPlayBCMusic(); }, 100);
            return result;
        });

        modApi.hookFunction("ChatRoomSyncRoomProperties", 0, (args, next) => {
            muteBCMusic();
            next(args);
            muteBCMusic();
            if (!isFirstController()) setTimeout(() => checkAndPlayBCMusic(), 100);
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
                if (!canControlMusic()) { sendLocalMsg("只有房管可以添加歌曲"); break; }
                if (args.length >= 3) {
                    const name = args[1], url = args.slice(2).join(' ');
                    if (isValidURL(url)) {
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
                updateControllerRank();
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
                if (list.length === 0) { sendLocalMsg("控制者列表為空"); break; }
                const lines = list.map((n, i) => `  #${i}: ${n}${n === Player.MemberNumber ? ' (我)' : ''}`).join('\n');
                sendLocalMsg(`控制者列表:\n${lines}`, 10000);
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
                updateControllerRank();
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
                repository: '聊天室音樂控制器 | Chat Music Controller'
            });
            log('ModSDK 注冊成功');
        } catch(e) {
            error('ModSDK 注冊失敗:', e);
        }

        await initialize();
    })();

    window.addEventListener('beforeunload', cleanup);
})();
