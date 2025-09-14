// media-player.js - 媒體播放器核心模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== 媒體播放器核心類 ====================
    class MediaPlayer {
        constructor(options = {}) {
            this.isActive = false;
            this.currentMode = window.BCMedia.Constants.MODES.NORMAL;
            this.playingId = '';
            this.videoList = [];
            this.watchers = [];
            this.player = null;
            this.updateTimer = null;
            
            // 模塊引用
            this.uiManager = options.uiManager || null;
            this.syncManager = options.syncManager || null;
            this.networkManager = options.networkManager || null;
            
            // 播放器狀態
            this.state = {
                volume: window.BCMedia.Constants.DEFAULT_SETTINGS.volume,
                muted: false,
                currentTime: 0,
                duration: 0,
                buffered: 0,
                playing: false,
                loading: false,
                error: null
            };
            
            // 本地狀態
            this.localState = {
                playingName: "",
                playingRoom: ""
            };
            
            // 播放器回調
            this.callbacks = this.initCallbacks();
            
            this.init();
        }

        // ==================== 初始化方法 ====================
        init() {
            this.initUpdateTimer();
            this.loadSettings();
            this.bindEvents();
        }

        initCallbacks() {
            const utils = window.BCMedia.Utils;
            
            return {
                onPlay: utils.debounce(() => {
                    this.state.playing = true;
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                }, window.BCMedia.Constants.DEBOUNCE_DELAY),

                onPause: utils.debounce(() => {
                    this.state.playing = false;
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                }, window.BCMedia.Constants.DEBOUNCE_DELAY),

                onSeeked: utils.debounce(() => {
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                }, 500),

                onTimeUpdate: utils.throttle(() => {
                    this.updateState();
                }, 1000),

                onLoadedMetadata: () => {
                    this.state.duration = this.player?.duration || 0;
                    this.state.loading = false;
                    this.trySetPlayState();
                },

                onLoadStart: () => {
                    this.state.loading = true;
                    this.state.error = null;
                },

                onCanPlay: () => {
                    this.state.loading = false;
                    this.trySetPlayState();
                },

                onEnded: () => {
                    this.state.playing = false;
                    this.playNext();
                },

                onError: (error) => {
                    this.state.error = error;
                    this.state.loading = false;
                    this.handleError(error);
                },

                onVolumeChange: () => {
                    if (this.player) {
                        this.state.volume = this.player.volume;
                        this.state.muted = this.player.muted;
                        this.saveSettings();
                    }
                },

                onDanmuEmit: (danmu) => {
                    if (window.BCMedia.Utils.isValidDanmu(danmu.text)) {
                        danmu.border = false;
                        this.sendMessage("Danmu", `SourceCharacter發彈幕：${danmu.text}`, danmu);
                    }
                }
            };
        }

        initUpdateTimer() {
            if (!this.updateTimer) {
                this.updateTimer = setInterval(() => {
                    this.updateCheck();
                }, window.BCMedia.Constants.UPDATE_INTERVAL);
            }
        }

        bindEvents() {
            // 鍵盤快捷鍵
            document.addEventListener('keydown', (e) => {
                if (!this.isActive) return;
                this.handleKeydown(e);
            });

            // 窗口大小改變
            window.addEventListener('resize', window.BCMedia.Utils.debounce(() => {
                this.handleResize();
            }, 250));

            // 頁面卸載清理
            window.addEventListener('beforeunload', () => {
                this.destroy();
            });
        }

        // ==================== 模塊設置 ====================
        setUIManager(uiManager) {
            this.uiManager = uiManager;
        }

        setSyncManager(syncManager) {
            this.syncManager = syncManager;
        }

        setNetworkManager(networkManager) {
            this.networkManager = networkManager;
        }

        // ==================== 播放控制 ====================
        async enter() {
            if (this.isActive) {
                console.log('[媒體播放器] 已處於活躍狀態，忽略進入');
                return;
            }
            
            console.log('[媒體播放器] 開始進入');
            try {
                this.isActive = true;
                
                // 初始化播放器
                await this.initPlayer();
                
                // 創建 UI
                if (this.uiManager) {
                    console.log('[媒體播放器] 調用 UI 創建');
                    await this.uiManager.create();
                } else {
                    throw new Error('UIManager 未初始化');
                }
                
                // 請求同步
                this.requestSync();
                
                console.log('[媒體播放器] 進入成功');
            } catch (error) {
                console.error('[媒體播放器] 進入失敗:', error.message, error.stack);
                this.exit();
                throw error; // 拋出以便上層捕獲
            }
        }
        
        exit() {
            if (!this.isActive) {
                console.log('[媒體播放器] 已關閉，忽略退出');
                return;
            }
            
            console.log('[媒體播放器] 開始退出');
            this.isActive = false;
            
            // 停止播放
            this.stop();
            
            // 銷毀 UI
            if (this.uiManager) {
                this.uiManager.destroy();
            }
            
            // 清理播放器
            this.destroyPlayer();
            
            console.log('[媒體播放器] 退出成功');
        }
        async initPlayer() {
            // 這裡可以根據需要使用不同的播放器實現
            // 例如 HTML5 video/audio, HLS.js, DPlayer 等
            
            const container = document.createElement('div');
            container.className = 'media-player-video-container';
            
            // 創建基本的 HTML5 播放器
            this.player = document.createElement('video');
            this.player.controls = true;
            this.player.preload = 'metadata';
            this.player.style.width = '100%';
            this.player.style.height = '100%';
            this.player.style.backgroundColor = '#000';
            
            // 綁定事件
            this.bindPlayerEvents();
            
            container.appendChild(this.player);
            this.playerContainer = container;
        }

        bindPlayerEvents() {
            if (!this.player) return;
            
            this.player.addEventListener('play', this.callbacks.onPlay);
            this.player.addEventListener('pause', this.callbacks.onPause);
            this.player.addEventListener('seeked', this.callbacks.onSeeked);
            this.player.addEventListener('timeupdate', this.callbacks.onTimeUpdate);
            this.player.addEventListener('loadedmetadata', this.callbacks.onLoadedMetadata);
            this.player.addEventListener('loadstart', this.callbacks.onLoadStart);
            this.player.addEventListener('canplay', this.callbacks.onCanPlay);
            this.player.addEventListener('ended', this.callbacks.onEnded);
            this.player.addEventListener('error', this.callbacks.onError);
            this.player.addEventListener('volumechange', this.callbacks.onVolumeChange);
        }

        destroyPlayer() {
            if (this.player) {
                // 移除所有事件監聽器
                ['play', 'pause', 'seeked', 'timeupdate', 'loadedmetadata', 'loadstart', 'canplay', 'ended', 'error', 'volumechange'].forEach(event => {
                    this.player.removeEventListener(event, this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)]);
                });
        
                this.player.pause();
                this.player.src = '';
                this.player.load();
                this.player = null;
            }
            
            if (this.playerContainer) {
                window.BCMedia.Utils.removeElement(this.playerContainer);
                this.playerContainer = null;
            }
        }

        // ==================== 播放列表管理 ====================
        async playId(id) {
            const item = this.getPlayItem(id);
            if (!item) {
                this.showError('找不到指定的媒體項目');
                return;
            }

            if (!window.BCMedia.Utils.isValidUrl(item.url)) {
                this.showError('無效的媒體URL');
                return;
            }

            if (!window.BCMedia.Constants.isSupportedFormat(item.url)) {
                this.showError('不支援的媒體格式');
                return;
            }

            if (this.playingId === id) return;

            try {
                this.state.loading = true;
                this.clearError();
                
                // 設置播放器源
                if (this.player) {
                    this.player.src = item.url;
                    this.player.load();
                }
                
                this.playingId = id;
                this.localState.playingName = item.name;
                
                // 更新 UI
                if (this.uiManager) {
                    this.uiManager.setTitle(item.name);
                    this.uiManager.updatePlaylist();
                }
                
                // 發送狀態更新
                this.sendState();
                
            } catch (error) {
                this.handleError('播放失敗: ' + error.message);
            }
            if (item.duration === 0 && this.player) {
                this.player.addEventListener('loadedmetadata', () => {
                    item.duration = this.player.duration;
                    if (this.uiManager) {
                        this.uiManager.updatePlaylist();
                    }
                }, { once: true });
            }
        }

        play() {
            if (this.player && this.player.paused) {
                return this.player.play();
            }
        }

        pause() {
            if (this.player && !this.player.paused) {
                this.player.pause();
            }
        }

        stop() {
            if (this.player) {
                this.player.pause();
                this.player.currentTime = 0;
            }
            this.state.playing = false;
        }

        seek(time) {
            if (this.player && isFinite(time) && time >= 0) {
                this.player.currentTime = Math.min(time, this.player.duration || 0);
            }
        }

        setVolume(volume) {
            if (this.player && volume >= 0 && volume <= 1) {
                this.player.volume = volume;
                this.state.volume = volume;
            }
        }

        toggleMute() {
            if (this.player) {
                this.player.muted = !this.player.muted;
                this.state.muted = this.player.muted;
            }
        }

        playNext() {
            const currentIndex = this.videoList.findIndex(item => item.id === this.playingId);
            if (currentIndex >= 0 && currentIndex < this.videoList.length - 1) {
                const nextIndex = currentIndex + 1;
                this.playId(this.videoList[nextIndex].id);
            }
        }

        playPrev() {
            const currentIndex = this.videoList.findIndex(item => item.id === this.playingId);
            if (currentIndex > 0) {
                const prevIndex = currentIndex - 1;
                this.playId(this.videoList[prevIndex].id);
            }
        }

        // ==================== 模式切換 ====================
        switchMode(mode) {
            if (this.currentMode === mode) return;
            
            const oldMode = this.currentMode;
            this.currentMode = mode;
            
            if (this.uiManager) {
                this.uiManager.switchMode(mode);
            }
            
            console.log(`[媒體播放器] 模式切換: ${oldMode} -> ${mode}`);
        }

        // ==================== 權限管理 ====================
        hasModifyPermission() {
            return window.ChatRoomPlayerIsAdmin && window.ChatRoomPlayerIsAdmin();
        }

        shouldShowButton() {
            return this.hasModifyPermission() || 
                   this.isActive || 
                   this.isChatRoomPlayingVideo();
        }

        // ==================== 同步相關 ====================
        updateSyncTime() {
            if (this.syncManager) {
                this.syncManager.updateSyncTime();
            }
        }

        requestSync() {
            if (this.networkManager) {
                this.networkManager.sendSyncRequest();
            }
        }

        sendSyncPlay() {
            if (this.networkManager) {
                this.networkManager.sendSyncPlay();
            }
        }

        sendState() {
            if (this.networkManager) {
                this.networkManager.sendState();
            }
        }

        trySetPlayState() {
            if (this.syncManager) {
                this.syncManager.trySetPlayState();
            }
        }

        // ==================== 狀態管理 ====================
        updateState() {
            if (!this.player) return;
            
            this.state.currentTime = this.player.currentTime || 0;
            this.state.duration = this.player.duration || 0;
            this.state.playing = !this.player.paused;
            this.state.volume = this.player.volume || 0;
            this.state.muted = this.player.muted || false;
            
            // 計算緩衝進度
            if (this.player.buffered.length > 0) {
                const bufferedEnd = this.player.buffered.end(this.player.buffered.length - 1);
                this.state.buffered = bufferedEnd / this.state.duration;
            }
        }

        updateCheck() {
            this.updateState();
            
            // 更新 UI
            if (this.uiManager) {
                this.uiManager.updateProgress(this.state);
            }
            
            // 同步檢查
            if (this.syncManager) {
                this.syncManager.checkSync();
            }
        }

        // ==================== 事件處理 ====================
        handleKeydown(e) {
            if (!this.isActive || e.ctrlKey || e.altKey || e.metaKey) return;
            
            const hotkeys = window.BCMedia.Constants.HOTKEYS;
            
            switch (e.code) {
                case hotkeys.TOGGLE_PLAY:
                    e.preventDefault();
                    this.state.playing ? this.pause() : this.play();
                    break;
                    
                case hotkeys.VOLUME_UP:
                    e.preventDefault();
                    this.setVolume(Math.min(1, this.state.volume + 0.1));
                    break;
                    
                case hotkeys.VOLUME_DOWN:
                    e.preventDefault();
                    this.setVolume(Math.max(0, this.state.volume - 0.1));
                    break;
                    
                case hotkeys.SEEK_FORWARD:
                    e.preventDefault();
                    this.seek(this.state.currentTime + 10);
                    break;
                    
                case hotkeys.SEEK_BACKWARD:
                    e.preventDefault();
                    this.seek(this.state.currentTime - 10);
                    break;
                    
                case hotkeys.TOGGLE_MUTE:
                    e.preventDefault();
                    this.toggleMute();
                    break;
                    
                case hotkeys.TOGGLE_MINI:
                    e.preventDefault();
                    this.switchMode(
                        this.currentMode === window.BCMedia.Constants.MODES.MINI 
                            ? window.BCMedia.Constants.MODES.NORMAL 
                            : window.BCMedia.Constants.MODES.MINI
                    );
                    break;
                    
                case hotkeys.NEXT_TRACK:
                    e.preventDefault();
                    this.playNext();
                    break;
                    
                case hotkeys.PREV_TRACK:
                    e.preventDefault();
                    this.playPrev();
                    break;
            }
        }

        handleResize() {
            if (this.uiManager) {
                this.uiManager.handleResize();
            }
        }

        handleError(error) {
            let errorMessage = '';
            if (error instanceof Event) {
                errorMessage = '事件錯誤: ' + (error.type || '未知類型') + ' - ' + (error.message || '無訊息');
                console.error('[媒體播放器] 事件錯誤細節:', error); // 記錄完整事件
            } else {
                errorMessage = error.message || error.toString();
            }
            console.error('[媒體播放器] 錯誤:', errorMessage);
            this.state.error = errorMessage;
            this.state.loading = false;
            
            if (this.uiManager) {
                this.uiManager.showError(errorMessage);
            }
        }

        // ==================== 輔助方法 ====================
        getPlayItem(id) {
            return this.videoList.find(item => item.id === id);
        }

        getPlayingItem() {
            return this.videoList.find(item => item.id === this.playingId);
        }

        getChatRoomPlayingName() {
            const playingItem = this.getPlayingItem();
            return playingItem ? playingItem.name : this.localState.playingName;
        }

        isChatRoomPlayingVideo() {
            const selfPlaying = this.isActive && this.getPlayingItem()?.name;
            const otherPlaying = this.watchers.length > 0 && 
                               this.watchers.some(w => w.PlayingName);
            return selfPlaying || otherPlaying;
        }

        clearError() {
            this.state.error = null;
        }

        showError(message) {
            if (this.uiManager) {
                this.uiManager.showError(message);
            } else {
                console.error('[媒體播放器]', message);
            }
        }

        // ==================== 設置管理 ====================
        loadSettings() {
            const settings = window.BCMedia.Utils.getLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.SETTINGS,
                window.BCMedia.Constants.DEFAULT_SETTINGS
            );
            
            this.state.volume = settings.volume;
            
            if (this.player) {
                this.player.volume = settings.volume;
            }
        }

        saveSettings() {
            const settings = {
                volume: this.state.volume,
                mode: this.currentMode
            };
            
            window.BCMedia.Utils.setLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.SETTINGS,
                settings
            );
        }

        // ==================== 清理方法 ====================
        destroy() {
            // 清理定時器
            if (this.updateTimer) {
                clearInterval(this.updateTimer);
                this.updateTimer = null;
            }
            
            // 銷毀播放器
            this.destroyPlayer();
            
            // 重置狀態
            this.isActive = false;
            this.playingId = '';
            this.videoList = [];
            this.watchers = [];
            
            console.log('[媒體播放器] 清理完成');
        }
    }

    // 註冊到全域命名空間
    window.BCMedia.MediaPlayer = MediaPlayer;

    console.log('[BC增強媒體] 媒體播放器模塊載入完成');
})();
