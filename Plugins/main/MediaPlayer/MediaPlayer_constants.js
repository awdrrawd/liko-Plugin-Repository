// constants.js - 常量配置模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    // 創建全域命名空間
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== 常量定義 ====================
    window.BCMedia.Constants = {
        // 基本信息
        MOD_NAME: "增強媒體",
        MOD_FULL_NAME: "增強媒體播放器",
        MOD_VERSION: "0.3.0",
        
        // 性能配置
        UPDATE_INTERVAL: 2000,        // 更新檢查間隔(毫秒)
        SYNC_THRESHOLD: 3.0,          // 同步閾值(秒)
        NETWORK_TIMEOUT: 5000,        // 網絡超時
        MAX_DANMU_LENGTH: 100,        // 彈幕最大長度
        DEBOUNCE_DELAY: 300,          // 防抖延遲
        THROTTLE_LIMIT: 1000,         // 節流限制
        
        // 支援的媒體格式
        SUPPORTED_FORMATS: {
            VIDEO: [
                '.mp4', '.mov', '.avi', '.wmv', '.mkv', 
                '.m3u8', '.webm', '.ogg', '.flv', '.3gp',
                '.ts', '.m4v', '.asf', '.rm', '.rmvb'
            ],
            AUDIO: [
                '.mp3', '.flac', '.aac', '.wav', '.ogg', 
                '.m4a', '.wma', '.ape', '.opus', '.amr',
                '.ac3', '.dts', '.aiff', '.au', '.ra'
            ]
        },

        // UI 尺寸配置
        UI: {
            BUTTON_SIZE: 40,
            
            // 桌面端尺寸
            DESKTOP: {
                NORMAL_WIDTH: '60%',
                NORMAL_HEIGHT: '60%',
                MINI_WIDTH: '320px',
                MINI_HEIGHT: '180px',
                COMPACT_WIDTH: '400px',
                COMPACT_HEIGHT: '300px'
            },
            
            // 移動端尺寸
            MOBILE: {
                NORMAL_WIDTH: '90%',
                NORMAL_HEIGHT: '70%',
                MINI_WIDTH: '280px',
                MINI_HEIGHT: '120px',
                COMPACT_WIDTH: '320px',
                COMPACT_HEIGHT: '240px'
            },
            
            // 最小尺寸限制
            MIN_WIDTH: 280,
            MIN_HEIGHT: 200,
            
            // 側邊欄配置
            SIDEBAR_WIDTH: 300,
            SIDEBAR_MIN_WIDTH: 200,
            
            // 動畫時間
            ANIMATION_DURATION: 300,
            
            // Z-Index 層級
            Z_INDEX: {
                PLAYER: 1000,
                NOTIFICATION: 10001,
                MODAL: 10002
            }
        },

        // 播放器模式
        MODES: {
            NORMAL: 'normal',
            MINI: 'mini',
            COMPACT: 'compact',
            FULLSCREEN: 'fullscreen'
        },

        // 同步類型
        SYNC_TYPES: {
            PLAY: 'SyncPlay',
            LIST: 'SyncList',
            REQUEST: 'SyncRequest',
            DANMU: 'Danmu'
        },

        // 消息類型
        MESSAGE_TYPES: {
            HIDDEN: 'Hidden',
            EMOTE: 'Emote',
            CHAT: 'Chat'
        },

        // 錯誤類型
        ERROR_TYPES: {
            NETWORK: 'network',
            FORMAT: 'format',
            PERMISSION: 'permission',
            SYNC: 'sync',
            UI: 'ui'
        },

        // 通知類型
        NOTIFICATION_TYPES: {
            SUCCESS: 'success',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        },

        // 播放器狀態
        PLAYER_STATES: {
            STOPPED: 'stopped',
            PLAYING: 'playing',
            PAUSED: 'paused',
            LOADING: 'loading',
            ERROR: 'error'
        },

        // CSS 類名
        CSS_CLASSES: {
            CONTAINER: 'bc-media-player-container',
            TITLEBAR: 'bc-media-player-titlebar',
            CONTENT: 'bc-media-player-content',
            SIDEBAR: 'bc-media-player-sidebar',
            VIDEO_AREA: 'bc-media-player-video-area',
            BUTTON: 'bc-media-player-btn',
            NOTIFICATION: 'bc-media-notification',
            MINI_MODE: 'mini-mode',
            COMPACT_MODE: 'compact-mode',
            FULLSCREEN_MODE: 'fullscreen-mode'
        },

        // 鍵盤快捷鍵
        HOTKEYS: {
            TOGGLE_PLAY: 'Space',
            VOLUME_UP: 'ArrowUp',
            VOLUME_DOWN: 'ArrowDown',
            SEEK_FORWARD: 'ArrowRight',
            SEEK_BACKWARD: 'ArrowLeft',
            TOGGLE_MUTE: 'KeyM',
            TOGGLE_FULLSCREEN: 'KeyF',
            TOGGLE_MINI: 'KeyC',
            NEXT_TRACK: 'KeyN',
            PREV_TRACK: 'KeyP'
        },

        // 本地存儲鍵
        STORAGE_KEYS: {
            SETTINGS: 'bc_media_settings',
            PLAYLIST: 'bc_media_playlist',
            POSITION: 'bc_media_position',
            VOLUME: 'bc_media_volume'
        },

        // 默認設置
        DEFAULT_SETTINGS: {
            volume: 0.8,
            autoplay: false,
            loop: false,
            showDanmu: true,
            syncEnabled: true,
            hotkeysEnabled: true,
            theme: 'dark',
            quality: 'auto'
        },

        // API 端點
        API: {
            TIMEOUT: 10000,
            RETRY_COUNT: 3,
            RETRY_DELAY: 1000
        },

        // 性能監控
        PERFORMANCE: {
            FPS_TARGET: 60,
            MEMORY_LIMIT: 100 * 1024 * 1024, // 100MB
            CPU_THRESHOLD: 80
        }
    };

    // 輔助函數
    window.BCMedia.Constants.isVideoFormat = function(url) {
        const ext = this.getFileExtension(url);
        return this.SUPPORTED_FORMATS.VIDEO.includes(ext);
    };

    window.BCMedia.Constants.isAudioFormat = function(url) {
        const ext = this.getFileExtension(url);
        return this.SUPPORTED_FORMATS.AUDIO.includes(ext);
    };

    window.BCMedia.Constants.isSupportedFormat = function(url) {
        return this.isVideoFormat(url) || this.isAudioFormat(url);
    };

    window.BCMedia.Constants.getFileExtension = function(url) {
        const match = url.toLowerCase().match(/\.([^.?]+)(?:\?|$)/);
        return match ? '.' + match[1] : '';
    };

    window.BCMedia.Constants.getModeConfig = function(mode, isMobile = false) {
        const deviceType = isMobile ? 'MOBILE' : 'DESKTOP';
        const config = this.UI[deviceType];
        
        switch (mode) {
            case this.MODES.MINI:
                return {
                    width: config.MINI_WIDTH,
                    height: config.MINI_HEIGHT
                };
            case this.MODES.COMPACT:
                return {
                    width: config.COMPACT_WIDTH,
                    height: config.COMPACT_HEIGHT
                };
            case this.MODES.NORMAL:
            default:
                return {
                    width: config.NORMAL_WIDTH,
                    height: config.NORMAL_HEIGHT
                };
        }
    };

    console.log('[BC增強媒體] 常量模塊載入完成');
})();
