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

        // ==================== 初始化方法
