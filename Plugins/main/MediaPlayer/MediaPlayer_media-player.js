// media-player.js - 媒體播放器核心模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // 修復版 MediaPlayer
    class EnhancedMediaPlayer {
        constructor(options = {}) {
            this.isActive = false;
            this.currentMode = 'normal';
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
                volume: 0.8,
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

        init() {
            this.initUpdateTimer();
            this.loadSettings();
            this.bindEvents();
        }

        initCallbacks() {
            return {
                onPlay: () => {
                    this.state.playing = true;
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                },

                onPause: () => {
                    this.state.playing = false;
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                },

                onSeeked: () => {
                    this.updateSyncTime();
                    this.sendSyncPlay();
                    if (!this.hasModifyPermission()) {
                        this.requestSync();
                    }
                },

                onTimeUpdate: () => {
                    this.updateState();
                },

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
                }
            };
        }

        initUpdateTimer() {
            if (!this.updateTimer) {
                this.updateTimer = setInterval(() => {
                    this.updateCheck();
                }, 2000);
            }
        }

        bindEvents() {
            // 鍵盤快捷鍵
            document.addEventListener('keydown', (e) => {
                if (!this.isActive) return;
                this.handleKeydown(e);
            });

            // 窗口大小改變
            window.addEventListener('resize', this.debounce(() => {
                this.handleResize();
            }, 250));
        }

        // 修復：改進的enter方法
        async enter() {
            if (this.isActive) return;
            
            try {
                this.isActive = true;
                
                // 創建 UI
                if (this.uiManager) {
                    await this.uiManager.create();
                }
                
                // 初始化播放器（延遲執行確保UI已創建）
                setTimeout(() => {
                    this.initPlayer();
                }, 100);
                
                // 請求同步
                this.requestSync();
                
                console.log('[媒體播放器] 進入成功');
            } catch (error) {
                console.error('[媒體播放器] 進入失敗:', error);
                this.exit();
            }
        }

        exit() {
            if (!this.isActive) return;
            
            this.isActive = false;
            
            // 停止播放
            this.stop();
            
            // 銷毀 UI
            if (this.uiManager) {
                this.uiManager.destroy();
            }
            
            // 清理播放器
            this.destroyPlayer();
            this.resetState();
            
            console.log('[媒體播放器] 退出成功');
        }
        resetState() {
            this.playingId = '';
            this.localState.playingName = '';
            this.localState.playingRoom = '';
            this.state.error = null;
            this.state.loading = false;
            this.state.playing = false;
        }

        // 修復：改進的initPlayer方法
        async initPlayer() {
            try {
                // 基本HTML5播放器
                this.player = document.createElement('video');
                this.player.controls = true;
                this.player.preload = 'metadata';
                this.player.style.cssText = `
                    width: 100%;
                    height: 100%;
                    background: #000;
                    object-fit: contain;
                `;
                
                // 綁定事件
                this.bindPlayerEvents();
                
                // 設置初始音量
                this.player.volume = this.state.volume;
                
                // 插入到視頻容器
                if (this.uiManager && this.uiManager.videoContainer) {
                    this.uiManager.videoContainer.innerHTML = '';
                    this.uiManager.videoContainer.appendChild(this.player);
                }
                
                console.log('[媒體播放器] 播放器初始化完成');
            } catch (error) {
                console.error('[媒體播放器] 播放器初始化失敗:', error);
                this.handleError('播放器初始化失敗');
            }
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
                this.player.pause();
                this.player.src = '';
                this.player.load();
                
                // 移除事件監聽器
                this.player.removeEventListener('play', this.callbacks.onPlay);
                this.player.removeEventListener('pause', this.callbacks.onPause);
                this.player.removeEventListener('seeked', this.callbacks.onSeeked);
                this.player.removeEventListener('timeupdate', this.callbacks.onTimeUpdate);
                this.player.removeEventListener('loadedmetadata', this.callbacks.onLoadedMetadata);
                this.player.removeEventListener('loadstart', this.callbacks.onLoadStart);
                this.player.removeEventListener('canplay', this.callbacks.onCanPlay);
                this.player.removeEventListener('ended', this.callbacks.onEnded);
                this.player.removeEventListener('error', this.callbacks.onError);
                this.player.removeEventListener('volumechange', this.callbacks.onVolumeChange);
                
                if (this.player.parentNode) {
                    this.player.parentNode.removeChild(this.player);
                }
                
                this.player = null;
            }
        }

        // 播放控制方法
        async playId(id) {
            const item = this.getPlayItem(id);
            if (!item) {
                this.showError('找不到指定的媒體項目');
                return;
            }

            if (!this.isValidUrl(item.url)) {
                this.showError('無效的媒體URL');
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
                
                console.log('[媒體播放器] 開始播放:', item.name);
                
            } catch (error) {
                this.handleError('播放失敗: ' + error.message);
            }
        }

        play() {
            if (this.player && this.player.paused) {
                return this.player.play().catch(error => {
                    this.handleError('播放失敗: ' + error.message);
                });
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
                this.saveSettings();
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

        switchMode(mode) {
            if (this.currentMode === mode) return;
            
            const oldMode = this.currentMode;
            this.currentMode = mode;
            
            if (this.uiManager) {
                this.uiManager.switchMode(mode);
            }
            
            console.log(`[媒體播放器] 模式切換: ${oldMode} -> ${mode}`);
        }

        // 權限管理
        hasModifyPermission() {
            return window.ChatRoomPlayerIsAdmin && window.ChatRoomPlayerIsAdmin();
        }

        // 同步相關
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

        // 狀態管理
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

        // 事件處理
        handleKeydown(e) {
            if (!this.isActive || e.ctrlKey || e.altKey || e.metaKey) return;
            
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.state.playing ? this.pause() : this.play();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    this.setVolume(Math.min(1, this.state.volume + 0.1));
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    this.setVolume(Math.max(0, this.state.volume - 0.1));
                    break;
                    
                case 'ArrowRight':
                    e.preventDefault();
                    this.seek(this.state.currentTime + 10);
                    break;
                    
                case 'ArrowLeft':
                    e.preventDefault();
                    this.seek(this.state.currentTime - 10);
                    break;
                    
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
                    
                case 'KeyC':
                    e.preventDefault();
                    this.switchMode(this.currentMode === 'mini' ? 'normal' : 'mini');
                    break;
                    
                case 'KeyN':
                    e.preventDefault();
                    this.playNext();
                    break;
                    
                case 'KeyP':
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
            console.error('[媒體播放器] 錯誤:', error);
            this.state.error = error;
            this.state.loading = false;
            
            if (this.uiManager) {
                this.uiManager.showError(error);
            }
        }

        // 輔助方法
        getPlayItem(id) {
            return this.videoList.find(item => item.id === id);
        }

        getPlayingItem() {
            return this.videoList.find(item => item.id === this.playingId);
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

        isValidUrl(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }

        // 設置管理
        loadSettings() {
            try {
                const settings = localStorage.getItem('bc_media_settings');
                if (settings) {
                    const parsed = JSON.parse(settings);
                    this.state.volume = parsed.volume || 0.8;
                }
            } catch (e) {
                console.warn('無法載入設置:', e);
            }
        }

        saveSettings() {
            try {
                const settings = {
                    volume: this.state.volume,
                    mode: this.currentMode
                };
                localStorage.setItem('bc_media_settings', JSON.stringify(settings));
            } catch (e) {
                console.warn('無法保存設置:', e);
            }
        }

        // 輔助工具
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }

        // 模塊設置
        setUIManager(uiManager) {
            this.uiManager = uiManager;
        }

        setSyncManager(syncManager) {
            this.syncManager = syncManager;
        }

        setNetworkManager(networkManager) {
            this.networkManager = networkManager;
        }

        // 清理方法
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

    // 替換原有的 MediaPlayer
    window.BCMedia.MediaPlayer = EnhancedMediaPlayer;

    console.log('[BC增強媒體] 增強媒體播放器載入完成');
})();
