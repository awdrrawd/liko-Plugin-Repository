// ==UserScript==
// @name         Liko - Chat Music Controller
// @name:zh      Liko的聊天室音樂控制器
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Chat Music Controller with lyrics support
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const MOD_VERSION = "1.0";
    const debugMode = false;

    function log(...args) {
        if (debugMode) console.log('[CMC]', ...args);
    }
    function error(...args) {
        console.error('[CMC]', ...args);
    }

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

    // ============ 颜色配置 ============
    const COLORS = {
        primary: '#9370db',
        light: '#ba55d3',
        dark: '#1C0230',
        accent: '#A355BB',
        highlight: '#ee82ee',
        dim: '#6a5acd'
    };

    // ============ 全局状态 ============
    let modApi = null;
    let musicPlayer = {
        playlist: [],
        currentIndex: -1,
        volume: 0.25,
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
        currentLyrics: [],
        currentLyricIndex: -1,
        bcMusicURL: ""
    };

    // ============ OnlineSharedSettings 控制者管理 ============
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
        if (!ChatRoomPlayerIsAdmin() || !ChatRoomData?.Custom || ChatRoomData.Custom.MusicURL === "") {
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
        const index = controllers.indexOf(myNumber);

        if (index >= 0) {
            controllers.splice(index, 1);
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
        if (ChatAdminRoomCustomizationMusic != null) {
            ChatAdminRoomCustomizationMusic.volume = 0;
        }
    }

    setInterval(() => {
        if (musicPlayer.isPlaying) muteBCMusic();
    }, 1000);

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
        log('已发送同步消息');
    }

    function handleMusicSync(data) {
        if (!data.Dictionary || !data.Dictionary[0]) return;

        const msg = data.Dictionary[0];

        if (msg.Action === "RequestSync" && isFirstController()) {
            sendMusicState(msg.From, true);
        }

        if (msg.Action === "SyncState" && !isFirstController()) {
            musicPlayer.playlist = msg.Playlist || [];
            musicPlayer.volume = msg.Volume || 0.25;
            musicPlayer.isLooping = msg.IsLooping || false;

            if (msg.CurrentIndex >= 0 && msg.CurrentIndex < musicPlayer.playlist.length) {
                if (msg.CurrentIndex !== musicPlayer.currentIndex) {
                    playTrack(msg.CurrentIndex, false);
                }

                if (musicPlayer.audioPlayer && msg.CurrentTime !== undefined) {
                    const timeDiff = Math.abs(musicPlayer.audioPlayer.currentTime - msg.CurrentTime);
                    if (timeDiff > 2) {
                        musicPlayer.audioPlayer.currentTime = msg.CurrentTime;
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

    // ============ 检查并播放BC音乐 ============
    function checkAndPlayBCMusic() {
        const bcMusicActive = ChatRoomCustomized && ChatRoomData?.Custom?.MusicURL;
        const newURL = ChatRoomData?.Custom?.MusicURL || "";

        log('BC音乐检查:', {
            ChatRoomCustomized,
            MusicURL: newURL,
            bcMusicActive,
            currentURL: musicPlayer.bcMusicURL,
            hasPlaylist: musicPlayer.playlist.length > 0
        });

        if (bcMusicActive && newURL) {
            muteBCMusic();

            if (musicPlayer.bcMusicURL !== newURL) {
                musicPlayer.bcMusicURL = newURL;

                if (canControlMusic() && musicPlayer.playlist.length > 0) {
                    const indexToPlay = musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0;
                    playTrack(indexToPlay, true);
                } else {
                    playBCMusicDirectly(newURL);
                }
            }
        } else {
            if (musicPlayer.isPlaying) {
                stopMusic();
            }
            musicPlayer.bcMusicURL = "";
        }
    }

    // ============ 直接播放BC音乐URL ============
    function playBCMusicDirectly(url) {
        if (musicPlayer.isLoading) return;

        musicPlayer.isLoading = true;

        if (musicPlayer.loadingTimeout) {
            clearTimeout(musicPlayer.loadingTimeout);
        }

        try {
            if (musicPlayer.audioPlayer) {
                musicPlayer.audioPlayer.pause();
                musicPlayer.audioPlayer.src = '';
                musicPlayer.audioPlayer.onended = null;
                musicPlayer.audioPlayer = null;
            }

            musicPlayer.audioPlayer = new Audio();
            musicPlayer.audioPlayer.src = url;
            musicPlayer.audioPlayer.volume = musicPlayer.volume;
            musicPlayer.audioPlayer.loop = true;

            musicPlayer.audioPlayer.onerror = (e) => {
                error('BC音乐加载错误:', e);
                musicPlayer.loadingTimeout = setTimeout(() => {
                    sendLocalMsg(`BC音乐加载失败`);
                    musicPlayer.isLoading = false;
                    musicPlayer.isPlaying = false;
                }, 5000);
            };

            musicPlayer.audioPlayer.oncanplay = () => {
                if (musicPlayer.loadingTimeout) {
                    clearTimeout(musicPlayer.loadingTimeout);
                }
            };

            musicPlayer.audioPlayer.play()
                .then(() => {
                    musicPlayer.isPlaying = true;
                    musicPlayer.isLoading = false;
                    muteBCMusic();
                    log('BC音乐播放成功');
                })
                .catch(err => {
                    error('BC音乐播放失败:', err);
                    musicPlayer.loadingTimeout = setTimeout(() => {
                        musicPlayer.isLoading = false;
                    }, 3000);
                });

        } catch (e) {
            error('BC音乐播放异常:', e);
            musicPlayer.isLoading = false;
        }
    }

    // ============ 播放函数 ============
    function playTrack(index, sendNotification = true) {
        if (index < 0 || index >= musicPlayer.playlist.length) return;
        if (musicPlayer.isLoading) return;

        if (!canControlMusic() && sendNotification) {
            sendLocalMsg("只有房管可以切换歌曲");
            return;
        }

        const track = musicPlayer.playlist[index];
        const previousURL = musicPlayer.audioPlayer?.src || '';
        const isSameTrack = previousURL.includes(track.url) || track.url.includes(previousURL.split('/').pop());

        musicPlayer.isLoading = true;
        musicPlayer.currentIndex = index;

        if (musicPlayer.loadingTimeout) {
            clearTimeout(musicPlayer.loadingTimeout);
        }

        try {
            if (musicPlayer.audioPlayer) {
                musicPlayer.audioPlayer.pause();
                musicPlayer.audioPlayer.src = '';
                musicPlayer.audioPlayer.onended = null;
                musicPlayer.audioPlayer = null;
            }

            musicPlayer.audioPlayer = new Audio();
            musicPlayer.audioPlayer.src = track.url;
            musicPlayer.audioPlayer.volume = musicPlayer.volume;
            musicPlayer.audioPlayer.loop = musicPlayer.isLooping;

            musicPlayer.audioPlayer.onended = () => {
                if (!musicPlayer.isLooping) {
                    const nextIndex = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
                    setTimeout(() => playTrack(nextIndex, true), 300);
                }
            };

            musicPlayer.audioPlayer.onerror = (e) => {
                error('音频加载错误:', e);
                musicPlayer.loadingTimeout = setTimeout(() => {
                    sendLocalMsg(`加载失败: ${track.name}`);
                    musicPlayer.isLoading = false;
                    musicPlayer.isPlaying = false;
                    updatePanelUI();
                }, 5000);
            };

            musicPlayer.audioPlayer.oncanplay = () => {
                if (musicPlayer.loadingTimeout) {
                    clearTimeout(musicPlayer.loadingTimeout);
                }
            };

            musicPlayer.audioPlayer.play()
                .then(() => {
                    musicPlayer.isPlaying = true;
                    musicPlayer.isLoading = false;
                    updatePanelUI();
                    saveSettings();

                    if (sendNotification && isFirstController()) {
                        sendTrackNotification(track.name, "正在播放");
                    }

                    muteBCMusic();
                    startProgressUpdate();
                    loadLyrics(track.name);
                })
                .catch(err => {
                    error('播放失败:', err);
                    musicPlayer.loadingTimeout = setTimeout(() => {
                        sendLocalMsg(`播放失败: ${err.message}`);
                        musicPlayer.isLoading = false;
                    }, 3000);
                });

            if (isFirstController() && !isSameTrack && ChatRoomCustomized) {
                musicPlayer.bcMusicURL = track.url;
                if (!ChatRoomData.Custom) ChatRoomData.Custom = {};
                ChatRoomData.Custom.MusicURL = track.url;

                ServerSend("ChatRoomAdmin", {
                    MemberNumber: Player.ID,
                    Room: ChatRoomGetSettings(ChatRoomData),
                    Action: "Update"
                });

                log('已更新房间音乐URL');
            }

        } catch (e) {
            error('播放异常:', e);
            musicPlayer.isLoading = false;
        }
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
                });
        }
    }

    function stopMusic() {
        if (musicPlayer.audioPlayer) {
            musicPlayer.audioPlayer.pause();
            musicPlayer.audioPlayer.src = '';
            musicPlayer.audioPlayer = null;
        }
        musicPlayer.isPlaying = false;
        stopProgressUpdate();
        updatePanelUI();
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
        if (musicPlayer.playlist.length === 0 || musicPlayer.isLoading) return;
        const nextIndex = (musicPlayer.currentIndex + 1) % musicPlayer.playlist.length;
        playTrack(nextIndex, true);
    }

    function playPrevious() {
        if (musicPlayer.playlist.length === 0 || musicPlayer.isLoading) return;
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

        // 房管播放时启用自定义
        if (!musicPlayer.isPlaying && canControlMusic() && !ChatRoomCustomized) {
            ChatRoomCustomized = true;
            ChatRoomCustomizationClear();
        }

        if (musicPlayer.isPlaying) {
            pauseMusic();
        } else {
            if (musicPlayer.audioPlayer && musicPlayer.audioPlayer.src) {
                resumeMusic();
            } else if (musicPlayer.playlist.length > 0) {
                playTrack(musicPlayer.currentIndex >= 0 ? musicPlayer.currentIndex : 0);
            }
        }
    }

    // ============ 进度条 ============
    function startProgressUpdate() {
        stopProgressUpdate();
        musicPlayer.progressInterval = setInterval(updateProgress, 100);
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

    // ============ 歌词功能 ============
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

            container.innerHTML = musicPlayer.currentLyrics.map((line, i) => `
                <div class="lyric-line" id="lyric-line-${i}" style="
                    padding: 4px 8px;
                    color: ${COLORS.dim};
                    transition: all 0.3s;
                    font-size: 14px;
                ">${line.text}</div>
            `).join('');
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
        let idx = musicPlayer.currentLyrics.findIndex((line, i) =>
            i < musicPlayer.currentLyrics.length - 1
                ? currentTime >= line.time && currentTime < musicPlayer.currentLyrics[i + 1].time
                : currentTime >= line.time
        );

        if (idx !== -1 && idx !== musicPlayer.currentLyricIndex) {
            musicPlayer.currentLyricIndex = idx;

            if (musicPlayer.lyricsPanel.classList.contains('lyrics-full')) {
                const lines = musicPlayer.lyricsPanel.querySelectorAll('.lyric-line');
                lines.forEach((l, i) => {
                    if (i === idx) {
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

    // ============ 紫色UI ============
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
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
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

        container.innerHTML = musicPlayer.playlist.map((track, index) => `
            <div data-track-index="${index}" style="
                padding: 6px;
                margin-bottom: 3px;
                background: ${index === musicPlayer.currentIndex ? `linear-gradient(90deg, rgba(163, 85, 187, 0.3) 0%, rgba(147, 112, 219, 0.2) 100%)` : 'rgba(28, 2, 48, 0.1)'};
                border: 1px solid ${index === musicPlayer.currentIndex ? COLORS.accent : 'transparent'};
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                font-size: 12px;
            ">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${index === musicPlayer.currentIndex ? COLORS.highlight : COLORS.light};">
                    ${index === musicPlayer.currentIndex ? '▶ ' : ''}${track.name}
                </span>
                <button data-remove-index="${index}" style="
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                ">×</button>
            </div>
        `).join('');

        container.querySelectorAll('[data-track-index]').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.hasAttribute('data-remove-index')) {
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

    function removeTrack(index) {
        if (!canControlMusic()) {
            sendLocalMsg("只有房管可以修改播放列表");
            return;
        }

        musicPlayer.playlist.splice(index, 1);
        if (musicPlayer.currentIndex === index) {
            stopMusic();
            musicPlayer.currentIndex = -1;
        } else if (musicPlayer.currentIndex > index) {
            musicPlayer.currentIndex--;
        }
        updatePanelUI();
        saveSettings();

        if (isFirstController()) {
            sendMusicState();
        }
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

        if (isFirstController()) {
            sendMusicState();
        }
    }

    function showAddTrackDialog() {
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

            if (name && url) {
                musicPlayer.playlist.push({ name, url });
                updatePanelUI();
                saveSettings();
                closeDialog(dialog);
                sendLocalMsg(`已添加: ${name}`);
            } else {
                alert('请填写完整信息');
            }
        };

        dialog.querySelector('#dialog-cancel').onclick = () => closeDialog(dialog);
    }

    function showImportDialog() {
        const currentList = musicPlayer.playlist.map(t => `${t.name}\n${t.url}`).join('\n');

        const dialog = createDialog(`
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; color: ${COLORS.primary};">导入播放列表:</label>
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
                alert('格式错误');
                return;
            }

            const newPlaylist = [];
            for (let i = 0; i < lines.length; i += 2) {
                newPlaylist.push({ name: lines[i].trim(), url: lines[i + 1].trim() });
            }

            musicPlayer.playlist = newPlaylist;
            musicPlayer.currentIndex = -1;
            updatePanelUI();
            saveSettings();
            closeDialog(dialog);
            sendLocalMsg(`已导入 ${newPlaylist.length} 首`);
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

    // ============ Hook ============
    function hookChatRoom() {
        if (!modApi?.hookFunction) return;

        modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
            next(args);
            setTimeout(() => {
                updateControllerRank();
                checkAndPlayBCMusic();

                if (!window.CMCWelcomed) {
                    sendLocalMsg("CHAT MUSIC CONTROLLER LOADED | /cmc show");
                    window.CMCWelcomed = true;
                }
            }, 1000);
        });

        modApi.hookFunction("ChatRoomLeave", 0, (args, next) => {
            next(args);
            stopMusic();
            hidePanel();
            if (musicPlayer.lyricsPanel) {
                musicPlayer.lyricsPanel.style.display = 'none';
            }
            removeFromControllers();
            musicPlayer.bcMusicURL = "";
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
            setTimeout(() => checkAndPlayBCMusic(), 100);
        });

        modApi.hookFunction("ChatRoomSyncRoomProperties", 0, (args, next) => {
            next(args);
            setTimeout(() => checkAndPlayBCMusic(), 100);
        });
    }

    // ============ 指令 ============
    function handleCMCCommand(text) {
        const args = text.trim().split(/\s+/).filter(x => x);
        const cmd = (args[0] || "").toLowerCase();

        if (!cmd || cmd === "help") {
            sendLocalMsg(
                "CMC v" + MOD_VERSION + "\n" +
                "/cmc show - 显示面板\n" +
                "/cmc play - 播放/暂停\n" +
                "/cmc next/prev - 上/下一首\n" +
                "/cmc loop - 切换循环\n" +
                "/cmc lyrics - 显示歌词\n" +
                "/cmc vol <0-100> - 音量\n" +
                "/cmc add <名称> <URL> - 添加\n" +
                "/cmc sync - 请求同步"
            , 20000);
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
                }
                break;
            }
            case "add": {
                if (args.length >= 3) {
                    const name = args[1];
                    const url = args.slice(2).join(' ');
                    musicPlayer.playlist.push({ name, url });
                    updatePanelUI();
                    saveSettings();
                    sendLocalMsg(`已添加: ${name}`);
                }
                break;
            }
            case "sync":
                updateControllerRank();
                requestMusicSync();
                sendLocalMsg("同步请求已发送");
                break;
            default:
                sendLocalMsg("未知指令");
        }
    }

    // ============ 存储 ============
    function ensureStorage() {
        if (!Player?.OnlineSettings) return;
        if (!Player.OnlineSettings.CMC) {
            Player.OnlineSettings.CMC = {
                playlist: [],
                volume: 0.25,
                currentIndex: -1,
                isLooping: false
            };
        }
    }

    function saveSettings() {
        ensureStorage();
        if (Player.OnlineSettings?.CMC) {
            Player.OnlineSettings.CMC = {
                playlist: musicPlayer.playlist,
                volume: musicPlayer.volume,
                currentIndex: musicPlayer.currentIndex,
                isLooping: musicPlayer.isLooping
            };
            ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
        }
    }

    function loadSettings() {
        ensureStorage();
        const saved = Player.OnlineSettings?.CMC;
        if (saved) {
            musicPlayer.playlist = saved.playlist || [];
            musicPlayer.volume = saved.volume || 0.25;
            musicPlayer.currentIndex = saved.currentIndex || -1;
            musicPlayer.isLooping = saved.isLooping || false;
        }
    }

    // ============ 初始化 ============
    async function initialize() {
        await waitFor(() => typeof Player?.MemberNumber === 'number', 30000);

        loadSettings();

        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: "cmc",
                Description: "Chat Music Controller",
                Action: handleCMCCommand
            }]);
        }

        hookChatRoom();

        setInterval(() => {
            if (CurrentScreen === "ChatRoom") {
                updateControllerRank();
                checkAndPlayBCMusic();
            }
        }, 5000);

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

    window.addEventListener('beforeunload', () => {
        stopMusic();
        removeFromControllers();
    });

})();
