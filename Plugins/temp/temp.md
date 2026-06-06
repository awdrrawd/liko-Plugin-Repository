// ==UserScript==
// @name         Liko - Chat Music Controller
// @name:zh      Liko的聊天室音樂控制器
// @namespace    https://likolisu.dev/
// @version      1.0.1
// @description  Chat Music Controller with lyrics support (Bug Fixes)
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const MOD_VERSION = "1.0.1";
    const debugMode = false;

    function log(...args) {
        if (debugMode || window.CMC_DEBUG) console.log('[CMC]', ...args);
    }
    function error(...args) {
        console.error('[CMC]', ...args);
    }

    // 常量定义
    const CONSTANTS = {
        SYNC_TIME_THRESHOLD: 2,
        PROGRESS_UPDATE_INTERVAL: 100,
        CONTROLLER_CHECK_INTERVAL: 5000,
        LOADING_TIMEOUT: 5000,
        DEFAULT_VOLUME: 0.25
    };
    let bcMusicOriginalVolume = 1;

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
        primary: '#9370db',
        light: '#ba55d3',
        dark: '#1C0230',
        accent: '#A355BB',
        highlight: '#ee82ee',
        dim: '#6a5acd'
    };

    let modApi = null;
    let cmcDB = null;
    let musicPlayer = {
        playlist: [],
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
        myControllerRank: -1,
        activeController: null,
        progressInterval: null,
        preloadPlayer: null,
        controllerCheckInterval: null,
        currentLyrics: [],
        currentLyricIndex: -1,
        bcMusicURL: "",
        bcMusicMuted: false
    };

    // ============ URL验证 ============
    function isValidURL(url) {
        try {
            const urlObj = new URL(encodeURI(url));
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch (e) {
            error('URL验证失败:', e);
            return false;
        }
    }

    function sanitizeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
        // 只要是管理员就应该能加入控制者列表
        if (!ChatRoomPlayerIsAdmin()) {
            musicPlayer.myControllerRank = -1;
            musicPlayer.activeController = null;
            return;
        }

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
    }

    function removeFromControllers() {
        const controllers = getControllerList();
        const myNumber = Player.MemberNumber;
        const idx = controllers.indexOf(myNumber);

        if (idx >= 0) {
            controllers.splice(idx, 1);
            Player.OnlineSharedSettings.CMCControllers = controllers;
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
            log('已从控制者列表移除');
        }

        musicPlayer.myControllerRank = -1;
        musicPlayer.activeController = controllers[0] || null;
    }

    function canControlMusic() {
        return ChatRoomPlayerIsAdmin();
    }

    function isFirstController() {
        return musicPlayer.myControllerRank === 0;
    }

    // ============ BC音乐静音 ============
    function muteBCMusic() {
        AudioBackgroundMusic.volume = 0;
        AudioBackgroundMusicStop();
        musicPlayer.bcMusicMuted = true;
        log('BC音樂已靜音');

    }

    function unmuteBCMusic() {musicPlayer.bcMusicMuted = false;}

    // ============ IndexedDB ============
    async function initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CMC_Database', 1);

            request.onerror = () => {
                error('IndexedDB 打开失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                cmcDB = request.result;
                log('IndexedDB 初始化成功');
                resolve(cmcDB);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                    log('创建 settings 对象存储');
                }
            };
        });
    }

    async function loadSettingsFromDB() {
        if (!cmcDB) {
            error('IndexedDB 未初始化');
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = cmcDB.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('cmc_data');

            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    musicPlayer.playlist = data.playlist || [];
                    musicPlayer.volume = data.volume || CONSTANTS.DEFAULT_VOLUME;
                    musicPlayer.currentIndex = data.currentIndex || -1;
                    musicPlayer.isLooping = data.isLooping || false;

                    log('从 IndexedDB 加载设置成功:', {
                        歌曲数: musicPlayer.playlist.length,
                        音量: Math.round(musicPlayer.volume * 100) + '%',
                        循环: musicPlayer.isLooping
                    });
                } else {
                    log('IndexedDB 无保存数据，使用默认设置');
                }
                resolve(data);
            };

            request.onerror = () => {
                error('从 IndexedDB 加载失败:', request.error);
                reject(request.error);
            };
        });
    }

    async function saveSettingsToDB() {
        if (!cmcDB) {
            error('IndexedDB 未初始化');
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = cmcDB.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');

            const data = {
                id: 'cmc_data',
                playlist: musicPlayer.playlist,
                volume: musicPlayer.volume,
                currentIndex: musicPlayer.currentIndex,
                isLooping: musicPlayer.isLooping,
                timestamp: Date.now()
            };

            const request = store.put(data);

            request.onsuccess = () => {
                log('设置已保存到 IndexedDB');
                resolve();
            };

            request.onerror = () => {
                error('保存到 IndexedDB 失败:', request.error);
                reject(request.error);
            };
        });
    }

    async function saveSettings() {
        await saveSettingsToDB();
    }

    async function loadSettings() {
        await loadSettingsFromDB();
    }

    // ============ 同步消息 ============
    function requestMusicSync() {
        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{
                Action: "RequestSync",
                From: Player.MemberNumber
            }]
        });
    }

    function sendMusicState(target = null, includeTime = false) {
        if (!isFirstController()) return;

        const data = {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{
                Action: "SyncState",
                Playlist: musicPlayer.playlist,
                CurrentIndex: musicPlayer.currentIndex,
                IsPlaying: musicPlayer.isPlaying,
                IsLooping: musicPlayer.isLooping,
                Volume: musicPlayer.volume,
                From: Player.MemberNumber
            }]
        };

        if (includeTime && musicPlayer.audioPlayer) {
            data.Dictionary[0].CurrentTime = musicPlayer.audioPlayer.currentTime;
        }

        if (target) data.Target = target;

        ServerSend("ChatRoomChat", data);
        log('已发送同步消息', includeTime ? '(含时间)' : '');
    }

    function broadcastPlaylistChange() {
        if (!canControlMusic()) return;

        ServerSend("ChatRoomChat", {
            Type: "Hidden",
            Content: "CMCSync",
            Dictionary: [{
                Action: "PlaylistUpdate",
                Playlist: musicPlayer.playlist,
                From: Player.MemberNumber
            }]
        });
        log('已广播播放列表变更');
    }

    function handleMusicSync(data) {
        if (!data.Dictionary || !data.Dictionary[0]) return;

        const msg = data.Dictionary[0];

        if (msg.Action === "PlaylistUpdate") {
            if (isFirstController() || msg.From === musicPlayer.activeController) {
                musicPlayer.playlist = msg.Playlist || [];
                updatePanelUI();
                saveSettings();
                log('接收到播放列表更新');
            }
            return;
        }

        if (msg.Action === "RequestSync" && isFirstController()) {
            sendMusicState(msg.From, true);
        }

        if (msg.Action === "SyncState") {
            if (msg.From !== musicPlayer.activeController) return;
            if (isFirstController()) return;

            musicPlayer.playlist = msg.Playlist || [];
            musicPlayer.volume = msg.Volume || CONSTANTS.DEFAULT_VOLUME;
            musicPlayer.isLooping = msg.IsLooping || false;

            if (msg.CurrentIndex >= 0 && msg.CurrentIndex < musicPlayer.playlist.length) {
                if (msg.CurrentIndex !== musicPlayer.currentIndex) {
                    playTrack(msg.CurrentIndex, false);
                }

                if (musicPlayer.audioPlayer && msg.CurrentTime !== undefined) {
                    const timeDiff = Math.abs(musicPlayer.audioPlayer.currentTime - msg.CurrentTime);
                    if (timeDiff > CONSTANTS.SYNC_TIME_THRESHOLD) {
                        musicPlayer.audioPlayer.currentTime = msg.CurrentTime;
                        log('时间同步:', msg.CurrentTime);
                    }
                }

                if (!msg.IsPlaying && musicPlayer.isPlaying) {
                    musicPlayer.audioPlayer.pause();
                    musicPlayer.isPlaying = false;
                } else if (msg.IsPlaying && !musicPlayer.isPlaying) {
                    musicPlayer.audioPlayer.play();
                    musicPlayer.isPlaying = true;
                }
            }

            updatePanelUI();
            saveSettings();
        }
    }

    // ============ 更新房间音乐URL ============
    function updateRoomMusicURL(url) {
        if (!isFirstController()) return;
        if (!ChatRoomPlayerIsAdmin()) return;

        try {
            // 确保 Custom 对象存在
            ChatRoomData.Custom = ChatRoomData.Custom || {};
            ChatRoomData.Custom.MusicURL = url;

            ServerSend("ChatRoomAdmin", {
                MemberNumber: Player.ID,
                Room: ChatRoomGetSettings(ChatRoomData),
                Action: "Update"
            });

            log('已更新房间音乐URL:', url);

        } catch (e) {
            error('更新房间音乐URL失败:', e);
        }
    }

    // ============ Audio清理 ============
    function cleanupAudioPlayer() {
        if (musicPlayer.audioPlayer) {
            try {
                const p = musicPlayer.audioPlayer.pause();
                if (p && p.catch) p.catch(() => {});
                musicPlayer.audioPlayer.src = '';
                musicPlayer.audioPlayer.onended = null;
                musicPlayer.audioPlayer.onerror = null;
                musicPlayer.audioPlayer.oncanplay = null;
                musicPlayer.audioPlayer.onloadedmetadata = null;
                musicPlayer.audioPlayer.onplay = null;
                musicPlayer.audioPlayer.onpause = null;
                musicPlayer.audioPlayer = null;
                log('Audio资源已清理');
            } catch (e) {
                error('清理Audio时出错:', e);
                musicPlayer.audioPlayer = null;
            }
        }
    }

    // ============ 音频加载 ============
    function loadAudioTrack(url, onSuccess, onError) {
        if (musicPlayer.isLoading) {
            log('正在加载中，忽略请求');
            return;
        }

        if (!isValidURL(url)) {
            error('无效的URL:', url);
            if (onError) onError(new Error('无效的URL'));
            return;
        }

        musicPlayer.isLoading = true;

        if (musicPlayer.loadingTimeout) {
            clearTimeout(musicPlayer.loadingTimeout);
            musicPlayer.loadingTimeout = null;
        }

        cleanupAudioPlayer();

        setTimeout(() => {
            if (musicPlayer.audioPlayer) {
                error('警告：清理后仍有 audioPlayer，强制清理');
                cleanupAudioPlayer();
            }

            try {
                musicPlayer.audioPlayer = new Audio();
                musicPlayer.audioPlayer.src = url;
                musicPlayer.audioPlayer.volume = musicPlayer.volume;

                // 強制解鎖，防止 isLoading 永遠卡住
                const forceUnlockTimeout = setTimeout(() => {
                    if (musicPlayer.isLoading) {
                        error('強制解除 isLoading 鎖');
                        musicPlayer.isLoading = false;
                        musicPlayer.isPlaying = false;
                        updatePanelUI();
                    }
                }, CONSTANTS.LOADING_TIMEOUT + 2000);

                // 在 oncanplay 裡清掉它
                musicPlayer.audioPlayer.oncanplay = () => {
                    clearTimeout(forceUnlockTimeout);
                    if (musicPlayer.loadingTimeout) {
                        clearTimeout(musicPlayer.loadingTimeout);
                        musicPlayer.loadingTimeout = null;
                    }
                    log('音频可以播放');
                };

                log('开始播放:', url);
                muteBCMusic();
                musicPlayer.audioPlayer.play()
                    .then(() => {
                    musicPlayer.isPlaying = true;
                    musicPlayer.isLoading = false;
                    log('播放成功');
                    if (onSuccess) onSuccess();
                })
                    .catch(err => {
                    error('播放失败:', err.name, err.message);
                    musicPlayer.isLoading = false;
                    musicPlayer.isPlaying = false;
                    if (onError) onError(err);
                });
            } catch (e) {
                error('加载异常:', e);
                musicPlayer.isLoading = false;
                if (onError) onError(e);
            }
        }, 50);
    }

    // ============ 播放BC音乐 ============
    function playBCMusicDirectly(url) {
        log('直接播放BC音乐:', url);
        loadAudioTrack(url, () => {
            musicPlayer.audioPlayer.loop = true;
            log('BC音乐播放成功（循环模式）');
        }, (err) => {
            sendLocalMsg(`BC音乐加载失败: ${err.message}`);
        });
    }
    function preloadNextTrack() {
        const nextIndex = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
        if (nextIndex === musicPlayer.currentIndex) return;
        if (musicPlayer.playlist.length < 2) return;

        const nextTrack = musicPlayer.playlist[nextIndex];
        if (!isValidURL(nextTrack.url)) return;

        // 清掉舊的預載
        if (musicPlayer.preloadPlayer) {
            musicPlayer.preloadPlayer.src = '';
            musicPlayer.preloadPlayer = null;
        }

        musicPlayer.preloadPlayer = new Audio();
        musicPlayer.preloadPlayer.src = nextTrack.url;
        musicPlayer.preloadPlayer.volume = 0;
        musicPlayer.preloadPlayer.preload = 'auto';
        log('預載下一首:', nextTrack.name);
    }
    // ============ 播放控制 ============
    function playTrack(trackIndex, sendNotification = true) {
        if (trackIndex < 0 || trackIndex >= musicPlayer.playlist.length) return;
        if (musicPlayer.isLoading) return;

        if (!canControlMusic() && sendNotification) {
            sendLocalMsg("只有房管可以切换歌曲");
            return;
        }

        const track = musicPlayer.playlist[trackIndex];
        musicPlayer.currentIndex = trackIndex;

        loadAudioTrack(track.url, () => {
            muteBCMusic();
            musicPlayer.audioPlayer.loop = musicPlayer.isLooping;

            musicPlayer.audioPlayer.onended = () => {
                if (!musicPlayer.isLooping) {
                    const nextIndex = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
                    setTimeout(() => playTrack(nextIndex, true), 300);
                }
            };

            updatePanelUI();
            saveSettings();

            if (sendNotification && isFirstController()) {
                sendTrackNotification(track.name, "正在播放");
            }

            startProgressUpdate();
            loadLyrics(track.name);
            preloadNextTrack();

            const needUpdate = musicPlayer.bcMusicURL !== track.url;
            musicPlayer.bcMusicURL = track.url;

            if (needUpdate) {
                updateRoomMusicURL(track.url);
            }
        }, (err) => {
            sendLocalMsg(`播放失败: ${track.name}`);
        });
    }

    function pauseMusic() {
        if (musicPlayer.audioPlayer && !musicPlayer.audioPlayer.paused) {
            musicPlayer.audioPlayer.pause();
            musicPlayer.isPlaying = false;
            updatePanelUI();
            stopProgressUpdate();

            if (isFirstController()) {
                sendMusicState();
            }
        }
    }

    function resumeMusic() {
        if (musicPlayer.audioPlayer && musicPlayer.audioPlayer.paused) {
            musicPlayer.audioPlayer.play()
                .then(() => {
                musicPlayer.isPlaying = true;
                updatePanelUI();
                muteBCMusic();
                startProgressUpdate();

                if (isFirstController()) {
                    sendMusicState();
                }
            })
                .catch(err => {
                error('恢复播放失败:', err);
                musicPlayer.isPlaying = false;
            });
        }
    }

    function stopMusic() {
        cleanupAudioPlayer();
        musicPlayer.isPlaying = false;
        stopProgressUpdate();
        updatePanelUI();

        if (canControlMusic() && ChatRoomCustomized) {
            ChatRoomCustomized = false;
            log('CMC停止，ChatRoomCustomized = false');
        }
    }

    function toggleLoop() {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以控制循环");
            return;
        }

        musicPlayer.isLooping = !musicPlayer.isLooping;

        if (musicPlayer.audioPlayer) {
            musicPlayer.audioPlayer.loop = musicPlayer.isLooping;
        }

        updatePanelUI();
        saveSettings();

        if (isFirstController()) {
            sendMusicState();
        }

        sendLocalMsg(musicPlayer.isLooping ? "已启用循环播放" : "已关闭循环播放");
    }

    function playNext() {
        muteBCMusic();
        if (musicPlayer.playlist.length === 0 || musicPlayer.isLoading) return;

        if (canControlMusic() && !ChatRoomCustomized) {
            ChatRoomCustomized = true;
            ChatRoomCustomizationClear();
            muteBCMusic();
            log('切换歌曲，ChatRoomCustomized = true');
        }

        const nextIndex = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
        playTrack(nextIndex, true);
    }

    function playPrevious() {
        muteBCMusic();
        if (musicPlayer.playlist.length === 0 || musicPlayer.isLoading) return;

        if (canControlMusic() && !ChatRoomCustomized) {
            ChatRoomCustomized = true;
            ChatRoomCustomizationClear();
            muteBCMusic();
            log('切换歌曲，ChatRoomCustomized = true');
        }

        let prevIndex = musicPlayer.currentIndex - 1;
        if (prevIndex < 0) prevIndex = musicPlayer.playlist.length - 1;
        playTrack(prevIndex, true);
    }

    function setVolume(vol) {
        musicPlayer.volume = Math.max(0, Math.min(1, vol));
        if (musicPlayer.audioPlayer) {
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
                log('CMC播放，ChatRoomCustomized = true');
            }

            if (musicPlayer.audioPlayer && musicPlayer.audioPlayer.src) {
                resumeMusic();
            } else if (musicPlayer.playlist.length > 0) {
                playTrack(musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0);
            } else {
                sendLocalMsg("播放列表为空");
            }
        }
    }

    // ============ 进度条 ============
    function startProgressUpdate() {
        stopProgressUpdate();
        musicPlayer.progressInterval = setInterval(updateProgress, CONSTANTS.PROGRESS_UPDATE_INTERVAL);
    }

    function stopProgressUpdate() {
        if (musicPlayer.progressInterval) {
            clearInterval(musicPlayer.progressInterval);
            musicPlayer.progressInterval = null;
        }
    }

    function updateProgress() {
        if (!musicPlayer.audioPlayer || !musicPlayer.floatingPanel) return;

        const progressBar = musicPlayer.floatingPanel.querySelector('#progress-bar');
        const timeDisplay = musicPlayer.floatingPanel.querySelector('#time-display');

        if (progressBar && timeDisplay) {
            const current = musicPlayer.audioPlayer.currentTime;
            const duration = musicPlayer.audioPlayer.duration;

            if (!isNaN(duration) && duration > 0) {
                const percent = (current / duration) * 100;
                progressBar.style.width = percent + '%';

                const formatTime = (sec) => {
                    const m = Math.floor(sec / 60);
                    const s = Math.floor(sec % 60);
                    return `${m}:${s.toString().padStart(2, '0')}`;
                };

                timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
            }
        }

        updateLyricHighlight();
    }

    function seekTo(percent) {
        if (musicPlayer.audioPlayer && musicPlayer.audioPlayer.duration) {
            musicPlayer.audioPlayer.currentTime = (percent / 100) * musicPlayer.audioPlayer.duration;
        }
    }

    // ============ 检查BC音乐 ============
    function checkAndPlayBCMusic() {
        // 确保 Custom 对象存在
        if (ChatRoomData && !ChatRoomData.Custom) {
            ChatRoomData.Custom = {};
        }

        const bcMusicActive = ChatRoomCustomized && ChatRoomData?.Custom?.MusicURL;
        const newURL = ChatRoomData?.Custom?.MusicURL || "";

        log('BC音乐检查:', {
            ChatRoomCustomized,
            MusicURL: newURL,
            bcMusicActive,
            currentURL: musicPlayer.bcMusicURL,
            hasPlaylist: musicPlayer.playlist.length > 0,
            isPlaying: musicPlayer.isPlaying
        });

        if (bcMusicActive && newURL) {
            muteBCMusic();

            if (musicPlayer.bcMusicURL !== newURL) {
                musicPlayer.bcMusicURL = newURL;

                if (canControlMusic() && musicPlayer.playlist.length > 0) {
                    const indexToPlay = musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0;
                    playTrack(indexToPlay, true);
                } else if (!musicPlayer.isPlaying) {
                    playBCMusicDirectly(newURL);
                }
            }
        } else if (!ChatRoomCustomized) {
            if (musicPlayer.isPlaying) {
                stopMusic();
                log('ChatRoomCustomized = false，停止音乐');
            }
            musicPlayer.bcMusicURL = "";
            unmuteBCMusic();
        }
    }

    // ============ 歌词 ============
    async function loadLyrics(songName) {
        try {
            const API_BASE = "https://netease-cloud-music-api-ochre.vercel.app";

            const searchRes = await fetch(`${API_BASE}/search?keywords=${encodeURIComponent(songName)}`);
            const searchData = await searchRes.json();

            if (!searchData.result || !searchData.result.songs.length) {
                log('未找到歌曲:', songName);
                return;
            }

            const songId = searchData.result.songs[0].id;

            const lyricRes = await fetch(`${API_BASE}/lyric?id=${songId}`);
            const lyricData = await lyricRes.json();

            if (!lyricData.lrc || !lyricData.lrc.lyric) {
                log('无歌词');
                return;
            }

            musicPlayer.currentLyrics = parseLRC(lyricData.lrc.lyric);
            renderLyrics();

            log('歌词加载成功');
        } catch (e) {
            error('歌词加载失败:', e);
        }
    }

    function parseLRC(lrc) {
        const lines = lrc.split("\n");
        let result = [];
        for (let line of lines) {
            const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
            if (match) {
                const min = parseInt(match[1]);
                const sec = parseFloat(match[2]);
                const time = min * 60 + sec;
                const text = match[3].trim();
                if (text) result.push({ time, text });
            }
        }
        return result;
    }

    function renderLyrics() {
        if (!musicPlayer.lyricsPanel) return;

        const container = musicPlayer.lyricsPanel.querySelector('#lyrics-content');
        if (!container) return;

        if (musicPlayer.currentLyrics.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 40px; opacity: 0.5; color: ' + COLORS.dim + ';">[ NO LYRICS ]</div>';
            return;
        }

        if (musicPlayer.lyricsPanel.classList.contains('lyrics-full')) {
            container.style.height = 'calc(100% - 50px)';
            container.style.overflowY = 'auto';
            container.style.padding = '15px';
            container.style.background = 'rgba(26, 13, 46, 1)';

            container.innerHTML = musicPlayer.currentLyrics.map((line, lineIdx) => {
                const safeText = sanitizeHTML(line.text);
                return `<div class="lyric-line" id="lyric-line-${lineIdx}" style="
                    padding: 4px 8px;
                    color: ${COLORS.dim};
                    transition: all 0.3s;
                    font-size: 14px;
                ">${safeText}</div>`;
            }).join('');
        } else {
            container.style.height = 'auto';
            container.style.overflowY = 'visible';
            container.style.padding = '10px';
            container.style.background = 'transparent';

            container.innerHTML = `
                <div id="lyric-prev" style="padding: 4px 8px; color: rgba(186, 85, 211, 0.5); font-size: 13px; text-align: center; min-height: 24px;"></div>
                <div id="lyric-current" style="padding: 8px; color: ${COLORS.highlight}; font-size: 16px; font-weight: bold; text-align: center; text-shadow: 0 0 15px ${COLORS.light}; min-height: 32px;"></div>
                <div id="lyric-next" style="padding: 4px 8px; color: rgba(186, 85, 211, 0.5); font-size: 13px; text-align: center; min-height: 24px;"></div>
            `;
        }
    }

    function updateLyricHighlight() {
        if (!musicPlayer.audioPlayer || !musicPlayer.lyricsPanel || musicPlayer.currentLyrics.length === 0) return;

        const currentTime = musicPlayer.audioPlayer.currentTime;
        let idx = musicPlayer.currentLyrics.findIndex((line, lineIdx) =>
                                                      lineIdx < musicPlayer.currentLyrics.length - 1
                                                      ? currentTime >= line.time && currentTime < musicPlayer.currentLyrics[lineIdx + 1].time
                                                      : currentTime >= line.time
                                                     );

        if (idx !== -1 && idx !== musicPlayer.currentLyricIndex) {
            musicPlayer.currentLyricIndex = idx;

            if (musicPlayer.lyricsPanel.classList.contains('lyrics-full')) {
                const lines = musicPlayer.lyricsPanel.querySelectorAll('.lyric-line');
                lines.forEach((l, lineIdx) => {
                    if (lineIdx === idx) {
                        l.style.color = COLORS.highlight;
                        l.style.fontWeight = 'bold';
                        l.style.transform = 'scale(1.05)';
                        l.style.textShadow = `0 0 10px ${COLORS.light}`;
                        l.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        l.style.color = COLORS.dim;
                        l.style.fontWeight = 'normal';
                        l.style.transform = 'scale(1)';
                        l.style.textShadow = 'none';
                    }
                });
            } else {
                const prevLine = musicPlayer.lyricsPanel.querySelector('#lyric-prev');
                const currentLine = musicPlayer.lyricsPanel.querySelector('#lyric-current');
                const nextLine = musicPlayer.lyricsPanel.querySelector('#lyric-next');

                if (prevLine && currentLine && nextLine) {
                    prevLine.textContent = idx > 0 ? musicPlayer.currentLyrics[idx - 1].text : '';
                    currentLine.textContent = musicPlayer.currentLyrics[idx].text;
                    nextLine.textContent = idx < musicPlayer.currentLyrics.length - 1 ? musicPlayer.currentLyrics[idx + 1].text : '';
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
                musicPlayer.lyricsPanel.style.bottom = '80px';
                musicPlayer.lyricsPanel.style.left = '30%';
                musicPlayer.lyricsPanel.style.top = 'auto';
                musicPlayer.lyricsPanel.style.transform = 'translateX(-50%)';
                musicPlayer.lyricsPanel.classList.remove('lyrics-full');
                musicPlayer.lyricsPanel.classList.add('lyrics-compact');
                musicPlayer.lyricsPanel.style.display = 'block';
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
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 30%;
            transform: translateX(-50%);
            width: 600px;
            background: transparent;
            border: none;
            border-radius: 10px;
            z-index: 9999;
            font-family: 'Courier New', monospace;
            color: ${COLORS.primary};
            overflow: visible;
        `;

        panel.innerHTML = `
            <style>
                #cmc-lyrics-panel .lyrics-control {
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                #cmc-lyrics-panel:hover .lyrics-control {
                    opacity: 1;
                }
                #cmc-lyrics-panel.lyrics-full {
                    width: 400px;
                    height: 400px;
                    bottom: auto;
                    top: 100px;
                    left: 30%;
                    transform: none;
                    border: 2px solid ${COLORS.primary};
                    box-shadow: 0 0 30px rgba(147, 112, 219, 0.6);
                    background: linear-gradient(135deg, #1a0d2e 0%, #2d1a4a 100%);
                }
                #cmc-lyrics-panel.lyrics-full .lyrics-control {
                    opacity: 1;
                }
            </style>

            <div class="lyrics-control" style="position: absolute; top: -50px; left: 0; right: 0; padding: 12px; background: linear-gradient(135deg, ${COLORS.dark} 0%, #2d1a4a 100%); border: 1px solid ${COLORS.primary}; border-radius: 8px; cursor: move;" id="lyrics-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 14px; text-shadow: 0 0 10px ${COLORS.light}; color: ${COLORS.light};">♪ LYRICS</span>
                    <div>
                        <button id="lyrics-reset" style="padding: 4px 8px; margin-right: 5px; border-radius: 3px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); border: 1px solid ${COLORS.primary}; color: ${COLORS.primary}; cursor: pointer; font-size: 12px;">⌖</button>
                        <button id="lyrics-toggle" style="padding: 4px 8px; margin-right: 5px; border-radius: 3px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); border: 1px solid ${COLORS.primary}; color: ${COLORS.primary}; cursor: pointer; font-size: 12px;">⇅</button>
                        <button id="lyrics-close" style="padding: 4px 8px; border-radius: 3px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); border: 1px solid ${COLORS.primary}; color: ${COLORS.primary}; cursor: pointer;">×</button>
                    </div>
                </div>
            </div>

            <div id="lyrics-content" style="padding: 0;"></div>
        `;

        document.body.appendChild(panel);
        musicPlayer.lyricsPanel = panel;

        makeDraggable(panel, panel.querySelector('#lyrics-header'));

        panel.querySelector('#lyrics-close').onclick = () => {
            panel.style.display = 'none';
        };

        panel.querySelector('#lyrics-reset').onclick = () => {
            panel.style.bottom = '80px';
            panel.style.left = '30%';
            panel.style.top = 'auto';
            panel.style.transform = 'translateX(-50%)';
        };

        panel.querySelector('#lyrics-toggle').onclick = () => {
            if (panel.classList.contains('lyrics-compact')) {
                panel.classList.remove('lyrics-compact');
                panel.classList.add('lyrics-full');
                panel.querySelector('#lyrics-header').style.position = 'relative';
                panel.querySelector('#lyrics-header').style.top = '0';
            } else {
                panel.classList.remove('lyrics-full');
                panel.classList.add('lyrics-compact');
                panel.querySelector('#lyrics-header').style.position = 'absolute';
                panel.querySelector('#lyrics-header').style.top = '-50px';
                panel.style.bottom = '80px';
                panel.style.left = '30%';
                panel.style.top = 'auto';
                panel.style.transform = 'translateX(-50%)';
            }
            renderLyrics();
        };

        renderLyrics();
    }

    // ============ 通知 ============
    function sendTrackNotification(trackName, action = "正在播放") {
        if (!isFirstController()) return;

        ServerSend("ChatRoomChat", {
            Type: "Action",
            Content: "CMC_PLAY",
            Dictionary: [{
                Tag: 'MISSING TEXT IN "Interface.csv": CMC_PLAY',
                Text: `${action}: ${trackName}`
            }]
        });
    }

    function sendLocalMsg(msg, timeout = 5000) {
        try {
            if (typeof ChatRoomSendLocal === 'function') {
                ChatRoomSendLocal(`<font color="${COLORS.accent}">[CMC] ${msg}</font>`, timeout);
            }
        } catch (e) {
            console.log('[CMC]', msg);
        }
    }

    // ============ UI ============
    function createFloatingPanel() {
        if (musicPlayer.floatingPanel) return;

        const panel = document.createElement('div');
        panel.id = 'cmc-music-panel';
        panel.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 350px;
            background: linear-gradient(135deg, #1a0d2e 0%, #2d1a4a 100%);
            border: 2px solid ${COLORS.primary};
            border-radius: 10px;
            box-shadow: 0 0 30px rgba(147, 112, 219, 0.5), inset 0 0 20px rgba(147, 112, 219, 0.1);
            z-index: 10000;
            font-family: 'Courier New', monospace;
            color: ${COLORS.primary};
            overflow: hidden;
        `;

        panel.innerHTML = `
            <style>
                #cmc-music-panel button {
                    background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%);
                    border: 1px solid ${COLORS.primary};
                    color: ${COLORS.light};
                    cursor: pointer;
                    transition: all 0.3s;
                    font-family: 'Courier New', monospace;
                }
                #cmc-music-panel button:hover {
                    background: linear-gradient(135deg, #4a2d6a 0%, #6a3d8a 100%);
                    box-shadow: 0 0 15px ${COLORS.accent};
                    transform: translateY(-2px);
                }
                #cmc-music-panel button:active {
                    transform: translateY(0);
                }
                #cmc-music-panel input[type="range"] {
                    -webkit-appearance: none;
                    background: #2d1a4a;
                    border: 1px solid ${COLORS.dim};
                    height: 6px;
                    border-radius: 3px;
                }
                #cmc-music-panel input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    background: ${COLORS.accent};
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 0 10px ${COLORS.light};
                }
                .cyber-text {
                    text-shadow: 0 0 10px ${COLORS.light}, 0 0 20px ${COLORS.accent};
                }
            </style>

            <div style="padding: 12px; cursor: move; background: linear-gradient(90deg, rgba(28, 2, 48, 0.3) 0%, rgba(147, 112, 219, 0.2) 100%); border-bottom: 1px solid ${COLORS.primary};" id="music-panel-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span id="panel-title" class="cyber-text" style="font-weight: bold; font-size: 14px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${COLORS.light};">♛ CMC</span>
                    <div>
                        <button id="music-minimize" style="padding: 4px 8px; border-radius: 3px; margin-right: 5px; font-size: 16px;">−</button>
                        <button id="music-close" style="padding: 4px 8px; border-radius: 3px; font-size: 16px;">×</button>
                    </div>
                </div>
            </div>

            <div id="music-panel-content" style="padding: 12px;">
                <div style="background: linear-gradient(135deg, rgba(28, 2, 48, 0.2) 0%, rgba(106, 90, 205, 0.2) 100%); border: 1px solid ${COLORS.dim}; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                    <div id="current-track" class="cyber-text" style="font-size: 13px; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${COLORS.light};">[ NO SIGNAL ]</div>

                    <div style="position: relative; height: 6px; background: ${COLORS.dark}; border: 1px solid ${COLORS.dim}; border-radius: 3px; margin-bottom: 8px; cursor: pointer;" id="progress-container">
                        <div id="progress-bar" style="position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: linear-gradient(90deg, ${COLORS.accent} 0%, ${COLORS.highlight} 100%); border-radius: 3px; box-shadow: 0 0 10px ${COLORS.light}; transition: width 0.1s;"></div>
                    </div>

                    <div id="time-display" style="font-size: 11px; text-align: center; margin-bottom: 10px; opacity: 0.8; color: ${COLORS.dim};">0:00 / 0:00</div>

                    <div style="display: flex; gap: 6px; justify-content: center; margin-bottom: 10px;">
                        <button id="music-prev" style="padding: 8px 12px; border-radius: 4px; font-size: 14px;">⏮</button>
                        <button id="music-play" style="padding: 8px 16px; border-radius: 4px; font-size: 14px;">▶</button>
                        <button id="music-loop" style="padding: 8px 12px; border-radius: 4px; font-size: 14px;">⟳</button>
                        <button id="music-next" style="padding: 8px 12px; border-radius: 4px; font-size: 14px;">⏭</button>
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px;">🕪</span>
                        <input type="range" id="volume-slider" min="0" max="100" value="25" style="flex: 1;">
                        <span id="volume-display" style="font-size: 12px; min-width: 40px; color: ${COLORS.light};">25%</span>
                    </div>
                </div>

                <div style="max-height: 200px; overflow-y: auto; background: rgba(28, 2, 48, 0.1); border: 1px solid ${COLORS.dim}; border-radius: 6px; padding: 6px; margin-bottom: 8px;" id="playlist-container">
                    <div style="font-size: 11px; opacity: 0.5; text-align: center; padding: 15px;">[ EMPTY PLAYLIST ]</div>
                </div>

                <div style="display: flex; gap: 6px; margin-bottom: 6px;">
                    <button id="music-lyrics" style="flex: 1; padding: 6px; border-radius: 4px; font-size: 11px;">📝 LYRICS</button>
                </div>

                <div style="display: flex; gap: 6px;">
                    <button id="music-add" style="flex: 1; padding: 6px; border-radius: 4px; font-size: 11px;">+ ADD</button>
                    <button id="music-import" style="flex: 1; padding: 6px; border-radius: 4px; font-size: 11px;">📥 IMPORT</button>
                    <button id="music-clear" style="flex: 1; padding: 6px; border-radius: 4px; font-size: 11px;">🗑 CLEAR</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        musicPlayer.floatingPanel = panel;

        makeDraggable(panel, panel.querySelector('#music-panel-header'));

        panel.querySelector('#music-close').onclick = () => hidePanel();
        panel.querySelector('#music-minimize').onclick = () => toggleMinimize();
        panel.querySelector('#music-play').onclick = () => togglePlay();
        panel.querySelector('#music-prev').onclick = () => playPrevious();
        panel.querySelector('#music-next').onclick = () => playNext();
        panel.querySelector('#music-loop').onclick = () => toggleLoop();
        panel.querySelector('#music-lyrics').onclick = () => toggleLyrics();
        panel.querySelector('#volume-slider').oninput = (e) => setVolume(parseInt(e.target.value) / 100);
        panel.querySelector('#music-add').onclick = () => showAddTrackDialog();
        panel.querySelector('#music-import').onclick = () => showImportDialog();
        panel.querySelector('#music-clear').onclick = () => clearPlaylist();

        panel.querySelector('#progress-container').onclick = (e) => {
            const rect = e.target.getBoundingClientRect();
            const percent = ((e.clientX - rect.left) / rect.width) * 100;
            seekTo(percent);
        };

        updatePanelUI();
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;

            const maxTop = window.innerHeight - 100;
            const maxLeft = window.innerWidth - 100;

            newTop = Math.max(0, Math.min(newTop, maxTop));
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));

            element.style.top = newTop + "px";
            element.style.left = newLeft + "px";
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
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
            musicPlayer.isPanelVisible = false;
        }
    }

    function showPanel() {
        if (!musicPlayer.floatingPanel) {
            createFloatingPanel();
        }
        musicPlayer.floatingPanel.style.display = 'block';
        musicPlayer.isPanelVisible = true;
    }

    function getRankIcon() {
        if (musicPlayer.myControllerRank === 0) {
            return '♛';
        } else if (ChatRoomPlayerIsAdmin()) {
            return '★';
        } else {
            return '♫';
        }
    }

    function updatePanelUI() {
        if (!musicPlayer.floatingPanel) return;

        const currentTrack = musicPlayer.playlist[musicPlayer.currentIndex];
        const trackDisplay = musicPlayer.floatingPanel.querySelector('#current-track');
        const playBtn = musicPlayer.floatingPanel.querySelector('#music-play');
        const loopBtn = musicPlayer.floatingPanel.querySelector('#music-loop');
        const volumeSlider = musicPlayer.floatingPanel.querySelector('#volume-slider');
        const volumeDisplay = musicPlayer.floatingPanel.querySelector('#volume-display');
        const headerTitle = musicPlayer.floatingPanel.querySelector('#panel-title');

        const content = musicPlayer.floatingPanel.querySelector('#music-panel-content');
        const rankIcon = getRankIcon();

        if (headerTitle) {
            if (content.style.display === 'none' && currentTrack) {
                headerTitle.textContent = `${rankIcon} ${currentTrack.name}`;
                headerTitle.style.fontSize = '12px';
            } else {
                headerTitle.textContent = `${rankIcon} CMC`;
                headerTitle.style.fontSize = '14px';
            }
        }

        if (currentTrack) {
            trackDisplay.textContent = `♪ ${currentTrack.name}`;
        } else {
            trackDisplay.textContent = '[ NO SIGNAL ]';
        }

        playBtn.textContent = musicPlayer.isPlaying ? '⏸' : '▶';

        if (loopBtn) {
            loopBtn.style.background = musicPlayer.isLooping ?
                `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.highlight} 100%)` :
            `linear-gradient(135deg, ${COLORS.dark} 0%, #4a2d6a 100%)`;
        }

        volumeSlider.value = musicPlayer.volume * 100;
        volumeDisplay.textContent = Math.round(musicPlayer.volume * 100) + '%';

        renderPlaylist();
    }

    function renderPlaylist() {
        const container = musicPlayer.floatingPanel.querySelector('#playlist-container');

        if (musicPlayer.playlist.length === 0) {
            container.innerHTML = '<div style="font-size: 11px; opacity: 0.5; text-align: center; padding: 15px;">[ EMPTY PLAYLIST ]</div>';
            return;
        }

        container.innerHTML = musicPlayer.playlist.map((track, trackIdx) => {
            const safeName = sanitizeHTML(track.name);
            const isCurrentTrack = trackIdx === musicPlayer.currentIndex;

            return `<div data-track-index="${trackIdx}" style="
                padding: 6px;
                margin-bottom: 3px;
                background: ${isCurrentTrack ? `linear-gradient(90deg, rgba(163, 85, 187, 0.3) 0%, rgba(147, 112, 219, 0.2) 100%)` : 'rgba(28, 2, 48, 0.1)'};
                border: 1px solid ${isCurrentTrack ? COLORS.accent : 'transparent'};
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                font-size: 12px;
            ">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${isCurrentTrack ? COLORS.highlight : COLORS.light};">
                    ${isCurrentTrack ? '▶ ' : ''}${safeName}
                </span>
                <button data-remove-index="${trackIdx}" style="
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                ">×</button>
            </div>`;
        }).join('');

        container.querySelectorAll('[data-track-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.hasAttribute('data-remove-index')) {
                    muteBCMusic();
                    playTrack(parseInt(el.getAttribute('data-track-index')), true);
                }
            });
        });

        container.querySelectorAll('[data-remove-index]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeTrack(parseInt(btn.getAttribute('data-remove-index')));
            });
        });
    }

    function removeTrack(trackIdx) {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以修改播放列表");
            return;
        }

        musicPlayer.playlist.splice(trackIdx, 1);
        if (musicPlayer.currentIndex === trackIdx) {
            stopMusic();
            musicPlayer.currentIndex = -1;
        } else if (musicPlayer.currentIndex > trackIdx) {
            musicPlayer.currentIndex--;
        }
        updatePanelUI();
        saveSettings();
        broadcastPlaylistChange();
    }

    function clearPlaylist() {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以清空播放列表");
            return;
        }

        if (!confirm('确定清空播放列表？')) return;

        musicPlayer.playlist = [];
        musicPlayer.currentIndex = -1;
        stopMusic();
        updatePanelUI();
        saveSettings();
        broadcastPlaylistChange();
    }

    function showAddTrackDialog() {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以添加歌曲");
            return;
        }

        const dialog = createDialog(`
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; color: ${COLORS.primary};">歌曲名称:</label>
                <input type="text" id="track-name" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid ${COLORS.primary}; background: #2d1a4a; color: ${COLORS.primary};">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: ${COLORS.primary};">音频URL:</label>
                <input type="text" id="track-url" style="width: 100%; padding: 8px; border-radius: 5px; border: 1px solid ${COLORS.primary}; background: #2d1a4a; color: ${COLORS.primary};">
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="dialog-confirm" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); color: ${COLORS.primary}; border: 1px solid ${COLORS.primary}; border-radius: 5px; cursor: pointer;">确定</button>
                <button id="dialog-cancel" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); color: ${COLORS.primary}; border: 1px solid ${COLORS.primary}; border-radius: 5px; cursor: pointer;">取消</button>
            </div>
        `);

        dialog.querySelector('#dialog-confirm').onclick = () => {
            const name = dialog.querySelector('#track-name').value.trim();
            const url = dialog.querySelector('#track-url').value.trim();

            if (!name || !url) {
                alert('请填写完整信息');
                return;
            }

            if (!isValidURL(url)) {
                alert('无效的URL');
                return;
            }

            musicPlayer.playlist.push({ name, url });
            updatePanelUI();
            saveSettings();
            closeDialog(dialog);
            sendLocalMsg(`已添加: ${name}`);
            broadcastPlaylistChange();
        };

        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }

    function showImportDialog() {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以导入播放列表");
            return;
        }

        const currentList = musicPlayer.playlist.map(t => `${t.name}\n${t.url}`).join('\n');

        const dialog = createDialog(`
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; color: ${COLORS.primary};">导入播放列表 (格式: 名称换行URL):</label>
                <textarea id="import-text" style="width: 100%; height: 200px; padding: 8px; border-radius: 5px; border: 1px solid ${COLORS.primary}; background: #2d1a4a; color: ${COLORS.primary}; font-family: monospace;">${currentList}</textarea>
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="dialog-confirm" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); color: ${COLORS.primary}; border: 1px solid ${COLORS.primary}; border-radius: 5px; cursor: pointer;">导入</button>
                <button id="dialog-cancel" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #2d1a4a 0%, #4a2d6a 100%); color: ${COLORS.primary}; border: 1px solid ${COLORS.primary}; border-radius: 5px; cursor: pointer;">取消</button>
            </div>
        `);

        dialog.querySelector('#dialog-confirm').onclick = () => {
            const text = dialog.querySelector('#import-text').value.trim();
            const lines = text.split('\n').filter(l => l.trim());

            if (lines.length % 2 !== 0) {
                alert('格式错误：每首歌需要两行（名称+URL）');
                return;
            }

            const newPlaylist = [];
            for (let i = 0; i < lines.length; i += 2) {
                const name = lines[i].trim();
                const url = lines[i + 1].trim();

                if (!isValidURL(url)) {
                    alert(`无效的URL: ${url}`);
                    return;
                }

                newPlaylist.push({ name, url });
            }

            musicPlayer.playlist = newPlaylist;
            musicPlayer.currentIndex = -1;
            updatePanelUI();
            saveSettings();
            closeDialog(dialog);
            sendLocalMsg(`已导入 ${newPlaylist.length} 首`);
            broadcastPlaylistChange();
        };

        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }

    function createDialog(html) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: linear-gradient(135deg, #1a0d2e 0%, #2d1a4a 100%);
            padding: 20px;
            border-radius: 10px;
            border: 2px solid ${COLORS.primary};
            box-shadow: 0 0 30px rgba(147, 112, 219, 0.5);
            min-width: 400px;
            max-width: 600px;
        `;
        dialog.innerHTML = html;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        return dialog;
    }

    function closeDialog(dialog) {
        dialog.parentElement.remove();
    }

    // ============ 清理 ============
    function cleanup() {
        log('开始清理资源...');

        stopMusic();

        if (musicPlayer.controllerCheckInterval) {
            clearInterval(musicPlayer.controllerCheckInterval);
            musicPlayer.controllerCheckInterval = null;
        }

        hidePanel();
        if (musicPlayer.lyricsPanel) {
            musicPlayer.lyricsPanel.style.display = 'none';
        }

        removeFromControllers();

        musicPlayer.bcMusicURL = "";
        unmuteBCMusic();

        if (cmcDB) {
            saveSettingsToDB().catch(e => error('保存设置失败:', e));
        }

        log('资源清理完成');
    }

    // ============ Hook ============
    function hookChatRoom() {
        if (!modApi?.hookFunction) return;

        modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
            return next(args).then(() => {
                setTimeout(async () => {
                    // 确保 Custom 对象存在
                    if (ChatRoomData && !ChatRoomData.Custom) {
                        ChatRoomData.Custom = {};
                        log('初始化 ChatRoomData.Custom');
                    }

                    updateControllerRank();
                    muteBCMusic();
                    checkAndPlayBCMusic();

                    if (!window.CMCWelcomed) {
                        sendLocalMsg("CHAT MUSIC CONTROLLER v" + MOD_VERSION + " | /cmc show");
                        window.CMCWelcomed = true;
                    }
                }, 1000);
            })
        });

        modApi.hookFunction("ChatRoomLeave", 0, (args, next) => {
            cleanup();
            next(args);
        });

        modApi.hookFunction("ChatRoomMessage", 0, (args, next) => {
            const data = args[0];
            if (data?.Content === "CMCSync") {
                handleMusicSync(data);
            }
            next(args);
        });

        modApi.hookFunction("ChatRoomMenuClick", 0, (args, next) => {
            next(args);
            setTimeout(() => {
                muteBCMusic();
                checkAndPlayBCMusic();
            }, 100);
        });

        modApi.hookFunction("ChatRoomSyncRoomProperties", 0, (args, next) => {
            next(args);
            setTimeout(() => checkAndPlayBCMusic(), 100);
        });

        modApi.hookFunction("ChatRoomCustomizationClear", 0, (args, next) => {
            next(args);
            muteBCMusic();
        });
    }

    // ============ 命令 ============
    function handleCMCCommand(text) {
        const args = text.trim().split(/\s+/).filter(x => x);
        const cmd = (args[0] || "").toLowerCase();

        if (!cmd || cmd === "help") {
            const status = musicPlayer.isPlaying ? "播放中" : "停止";
            const customized = ChatRoomCustomized ? "启用" : "禁用";
            const controller = isFirstController() ? "主控制者" : canControlMusic() ? "管理员" : "普通用户";

            sendLocalMsg(
                `CMC v${MOD_VERSION}\n` +
                `状态: ${status} | 自定义: ${customized} | 身份: ${controller}\n` +
                `播放列表: ${musicPlayer.playlist.length}首 (IndexedDB)\n\n` +
                "命令列表:\n" +
                "/cmc show - 显示面板\n" +
                "/cmc play - 播放/暂停\n" +
                "/cmc next/prev - 上/下一首\n" +
                "/cmc loop - 切换循环\n" +
                "/cmc lyrics - 显示歌词\n" +
                "/cmc vol <0-100> - 设置音量\n" +
                "/cmc add <名称> <URL> - 添加歌曲\n" +
                "/cmc sync - 请求同步\n" +
                "/cmc storage - 查看存储信息\n" +
                "/cmc export - 导出播放列表\n" +
                "/cmc cleardb - 清空本地数据\n" +
                "/cmc debug - 切换调试模式"
                , 25000);
            return;
        }

        switch(cmd) {
            case "show":
                showPanel();
                break;
            case "play":
                togglePlay();
                break;
            case "pause":
                pauseMusic();
                break;
            case "stop":
                stopMusic();
                sendLocalMsg("已停止播放");
                break;
            case "next":
                playNext();
                break;
            case "prev":
                playPrevious();
                break;
            case "loop":
                toggleLoop();
                break;
            case "lyrics":
                toggleLyrics();
                break;
            case "vol": {
                const vol = parseInt(args[1]);
                if (!isNaN(vol) && vol >= 0 && vol <= 100) {
                    setVolume(vol / 100);
                    sendLocalMsg(`音量: ${vol}%`);
                } else {
                    sendLocalMsg("音量范围: 0-100");
                }
                break;
            }
            case "add": {
                if (args.length >= 3) {
                    const name = args[1];
                    const url = args.slice(2).join(' ');
                    if (isValidURL(url)) {
                        musicPlayer.playlist.push({ name, url });
                        updatePanelUI();
                        saveSettings();
                        sendLocalMsg(`已添加: ${name}`);
                        broadcastPlaylistChange();
                    } else {
                        sendLocalMsg("无效的URL");
                    }
                } else {
                    sendLocalMsg("用法: /cmc add <名称> <URL>");
                }
                break;
            }
            case "sync":
                updateControllerRank();
                requestMusicSync();
                sendLocalMsg("同步请求已发送");
                break;
            case "storage":
            case "info": {
                // 确保 Custom 对象存在
                if (ChatRoomData && !ChatRoomData.Custom) {
                    ChatRoomData.Custom = {};
                }

                const storageInfo =
                      `=== CMC 存储信息 ===\n` +
                      `播放列表: IndexedDB (本地)\n` +
                      `控制者列表: OnlineSharedSettings\n` +
                      `同步方式: Hidden Message\n\n` +
                      `播放列表: ${musicPlayer.playlist.length} 首歌曲\n` +
                      `音量: ${Math.round(musicPlayer.volume * 100)}%\n` +
                      `循环: ${musicPlayer.isLooping ? '开启' : '关闭'}\n` +
                      `当前索引: ${musicPlayer.currentIndex}\n\n` +
                      `控制者列表: ${getControllerList().join(', ') || '空'}\n` +
                      `我的排名: ${musicPlayer.myControllerRank >= 0 ? musicPlayer.myControllerRank : '未加入'}\n` +
                      `第一控制者: ${musicPlayer.activeController || '无'}\n\n` +
                      `当前房间音乐URL: ${ChatRoomData?.Custom?.MusicURL || '未设置'}\n` +
                      `CMC音乐URL: ${musicPlayer.bcMusicURL || '未设置'}`;
                sendLocalMsg(storageInfo, 15000);
                break;
            }
            case "cleardb":
            case "resetdb": {
                if (!confirm('确定要清空本地数据库吗？这将删除所有播放列表！')) break;

                if (cmcDB) {
                    const transaction = cmcDB.transaction(['settings'], 'readwrite');
                    const store = transaction.objectStore('settings');
                    store.delete('cmc_data');

                    musicPlayer.playlist = [];
                    musicPlayer.currentIndex = -1;
                    updatePanelUI();

                    sendLocalMsg('本地数据库已清空');
                } else {
                    sendLocalMsg('IndexedDB 未初始化');
                }
                break;
            }
            case "export": {
                const exportData = {
                    version: MOD_VERSION,
                    playlist: musicPlayer.playlist,
                    volume: musicPlayer.volume,
                    isLooping: musicPlayer.isLooping,
                    timestamp: Date.now()
                };

                const jsonStr = JSON.stringify(exportData, null, 2);

                navigator.clipboard.writeText(jsonStr).then(() => {
                    sendLocalMsg('播放列表已复制到剪贴板');
                }).catch(() => {
                    console.log('CMC Export:', jsonStr);
                    sendLocalMsg('导出数据已显示在控制台');
                });
                break;
            }
            case "debug":
                window.CMC_DEBUG = !window.CMC_DEBUG;
                sendLocalMsg(`调试模式: ${window.CMC_DEBUG ? "开启" : "关闭"}`);
                break;
            default:
                sendLocalMsg("未知指令，使用 /cmc help 查看帮助");
        }
    }

    // ============ 初始化 ============
    async function initialize() {
        await waitFor(() => typeof Player?.MemberNumber === 'number', 30000);

        try {
            await initIndexedDB();
        } catch (e) {
            error('IndexedDB 初始化失败:', e);
            sendLocalMsg('CMC 存储初始化失败，功能可能受限');
        }

        await loadSettings();

        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: "cmc",
                Description: "Chat Music Controller",
                Action: handleCMCCommand
            }]);
        }

        hookChatRoom();

        musicPlayer.controllerCheckInterval = setInterval(() => {
            if (CurrentScreen === "ChatRoom") {
                updateControllerRank();
                checkAndPlayBCMusic();
            }
        }, CONSTANTS.CONTROLLER_CHECK_INTERVAL);

        log('初始化完成');
    }

    // ============ 启动 ============
    (async () => {
        await waitFor(() => typeof bcModSdk !== 'undefined', 30000);

        try {
            modApi = bcModSdk.registerMod({
                name: "CMC",
                fullName: "Chat Music Controller",
                version: MOD_VERSION,
                repository: '聊天室音樂控制器 | Chat Music Controller'
            });
            log('ModSDK注册成功');
        } catch (e) {
            error('ModSDK注册失败:', e);
        }

        await initialize();
    })();

    window.addEventListener('beforeunload', cleanup);

})();
