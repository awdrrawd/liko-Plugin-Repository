// sync-manager.js - 同步管理模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== 同步管理器類 ====================
    class SyncManager {
        constructor() {
            this.mediaPlayer = null;
            this.networkManager = null;
            
            // 同步數據
            this.syncData = {
                listTime: 0,
                playTime: 0,
                playTimeBySync: 0,
                pausedBySync: false,
                needSetSync: false,
                playingId: '',
                lastSyncTime: 0
            };
            
            // 同步控制
            this.syncEnabled = true;
            this.syncThreshold = window.BCMedia.Constants.SYNC_THRESHOLD;
            this.maxSyncDelay = 5000; // 最大同步延遲 (毫秒)
            
            // 性能監控
            this.syncStats = {
                successCount: 0,
                failCount: 0,
                avgDelay: 0,
                lastSyncDelay: 0
            };
            
            this.init();
        }

        // ==================== 初始化 ====================
        init() {
            this.loadSyncSettings();
            this.bindEvents();
        }

        bindEvents() {
            // 頁面可見性變化時重新同步
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.syncEnabled) {
                    setTimeout(() => {
                        this.requestFullSync();
                    }, 1000);
                }
            });
        }

        loadSyncSettings() {
            const settings = window.BCMedia.Utils.getLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.SETTINGS,
                window.BCMedia.Constants.DEFAULT_SETTINGS
            );
            
            this.syncEnabled = settings.syncEnabled !== false;
        }

        // ==================== 模塊設置 ====================
        setMediaPlayer(mediaPlayer) {
            this.mediaPlayer = mediaPlayer;
        }

        setNetworkManager(networkManager) {
            this.networkManager = networkManager;
        }

        // ==================== 同步時間更新 ====================
        updateSyncTime() {
            if (!this.mediaPlayer || !this.mediaPlayer.hasModifyPermission()) {
                return;
            }

            const now = Date.now();
            this.syncData.listTime = now;
            this.syncData.playTime = now;
            this.syncData.playTimeBySync = this.getCurrentTime();
            this.syncData.pausedBySync = this.getCurrentPaused();
            this.syncData.playingId = this.mediaPlayer.playingId;
            this.syncData.lastSyncTime = now;

            console.log('[同步管理器] 更新同步時間:', {
                playTime: this.syncData.playTimeBySync,
                paused: this.syncData.pausedBySync,
                playingId: this.syncData.playingId
            });
        }

        // ==================== 同步狀態設置 ====================
        trySetPlayState() {
            if (!this.syncEnabled || !this.syncData.needSetSync || !this.mediaPlayer) {
                return;
            }

            try {
                const startTime = Date.now();
                
                // 播放/暫停同步
                const currentPaused = this.getCurrentPaused();
                if (currentPaused !== this.syncData.pausedBySync) {
                    if (!this.syncData.pausedBySync && currentPaused) {
                        // 需要播放
                        this.mediaPlayer.play()?.catch(error => {
                            console.warn('[同步管理器] 播放失敗:', error);
                        });
                    } else if (this.syncData.pausedBySync && !currentPaused) {
                        // 需要暫停
                        this.mediaPlayer.pause();
                    }
                }

                // 時間同步
                this.syncCurrentTime();

                // 播放項目同步
                if (this.syncData.playingId && 
                    this.syncData.playingId !== this.mediaPlayer.playingId) {
                    this.mediaPlayer.playId(this.syncData.playingId);
                }

                this.syncData.needSetSync = false;
                
                // 記錄同步性能
                const delay = Date.now() - startTime;
                this.updateSyncStats(true, delay);
                
                console.log('[同步管理器] 同步完成, 耗時:', delay + 'ms');
                
            } catch (error) {
                console.error('[同步管理器] 同步失敗:', error);
                this.updateSyncStats(false, 0);
                this.syncData.needSetSync = false;
            }
        }

        syncCurrentTime() {
            if (!this.mediaPlayer || !this.mediaPlayer.player) return;

            let targetTime = this.syncData.playTimeBySync;
            
            // 如果正在播放，計算應該到達的時間
            if (!this.syncData.pausedBySync) {
                const elapsed = (Date.now() - this.syncData.playTime) / 1000.0;
                targetTime = this.syncData.playTimeBySync + elapsed;
            }

            const currentTime = this.getCurrentTime();
            const timeDiff = Math.abs(currentTime - targetTime);
            
            // 只有時間差異超過閾值且目標時間有效時才進行同步
            if (timeDiff > this.syncThreshold && 
                targetTime >= 0 && 
                targetTime <= (this.mediaPlayer.state.duration || Infinity)) {
                
                console.log('[同步管理器] 時間同步:', {
                    current: currentTime.toFixed(2),
                    target: targetTime.toFixed(2),
                    diff: timeDiff.toFixed(2)
                });
                
                this.mediaPlayer.seek(targetTime);
            }
        }

        // ==================== 同步檢查 ====================
        checkSync() {
            if (!this.syncEnabled || !this.mediaPlayer || this.mediaPlayer.hasModifyPermission()) {
                return;
            }

            // 定期檢查是否需要重新同步
            const now = Date.now();
            if (now - this.syncData.lastSyncTime > 30000) { // 30秒無同步時請求同步
                this.requestFullSync();
            }

            // 檢查時間漂移
            if (this.syncData.playTime && !this.syncData.pausedBySync) {
                const expectedTime = this.syncData.playTimeBySync + (now - this.syncData.playTime) / 1000.0;
                const actualTime = this.getCurrentTime();
                const drift = Math.abs(expectedTime - actualTime);
                
                if (drift > this.syncThreshold * 2) {
                    console.warn('[同步管理器] 檢測到時間漂移:', drift.toFixed(2) + 's');
                    this.syncData.needSetSync = true;
                    this.trySetPlayState();
                }
            }
        }

        // ==================== 同步請求處理 ====================
        handleSyncPlay(data) {
            if (!this.syncEnabled || !data) return;

            try {
                // 驗證數據完整性
                if (!this.validateSyncData(data)) {
                    console.warn('[同步管理器] 同步數據無效:', data);
                    return;
                }

                // 更新同步數據
                this.syncData.pausedBySync = Boolean(data.Paused);
                this.syncData.playTimeBySync = Number(data.PlayTime) || 0;
                this.syncData.playTime = Number(data.syncPlayTime) || Date.now();
                this.syncData.playingId = data.PlayingId || '';
                this.syncData.needSetSync = true;
                this.syncData.lastSyncTime = Date.now();

                console.log('[同步管理器] 接收同步播放:', {
                    paused: this.syncData.pausedBySync,
                    playTime: this.syncData.playTimeBySync,
                    playingId: this.syncData.playingId
                });

                // 應用同步
                setTimeout(() => {
                    this.trySetPlayState();
                }, 100); // 小延遲確保數據已設置

            } catch (error) {
                console.error('[同步管理器] 處理同步播放失敗:', error);
            }
        }

        handleSyncList(data) {
            if (!this.syncEnabled || !data || !this.mediaPlayer) return;

            try {
                // 驗證列表數據
                if (!Array.isArray(data.List)) {
                    console.warn('[同步管理器] 同步列表數據無效');
                    return;
                }

                // 更新播放列表
                this.mediaPlayer.videoList = data.List.filter(item => 
                    item && typeof item === 'object' && item.id && item.url
                );

                this.syncData.listTime = Number(data.syncListTime) || Date.now();

                console.log('[同步管理器] 接收同步列表:', this.mediaPlayer.videoList.length + '項');

                // 更新UI
                if (this.mediaPlayer.uiManager) {
                    this.mediaPlayer.uiManager.updatePlaylist();
                }

            } catch (error) {
                console.error('[同步管理器] 處理同步列表失敗:', error);
            }
        }

        handleSyncRequest(fromPlayer) {
            if (!this.mediaPlayer || !this.mediaPlayer.hasModifyPermission()) return;

            console.log('[同步管理器] 收到同步請求來自:', fromPlayer);

            // 發送完整同步數據
            if (this.networkManager) {
                this.networkManager.sendSyncPlay(fromPlayer);
                this.networkManager.sendSyncList(fromPlayer);
            }
        }

        // ==================== 同步請求發送 ====================
        requestSync() {
            if (this.networkManager) {
                this.networkManager.sendSyncRequest();
            }
        }

        requestFullSync() {
            console.log('[同步管理器] 請求完整同步');
            this.requestSync();
        }

        // ==================== 數據驗證 ====================
        validateSyncData(data) {
            if (!data || typeof data !== 'object') return false;

            // 檢查必需字段
            const requiredFields = ['Paused', 'PlayTime', 'syncPlayTime'];
            for (const field of requiredFields) {
                if (!(field in data)) {
                    return false;
                }
            }

            // 檢查數據類型和範圍
            if (typeof data.Paused !== 'boolean' && 
                typeof data.Paused !== 'number' && 
                typeof data.Paused !== 'string') {
                return false;
            }

            if (isNaN(Number(data.PlayTime)) || Number(data.PlayTime) < 0) {
                return false;
            }

            if (isNaN(Number(data.syncPlayTime))) {
                return false;
            }

            // 檢查時間戳是否合理（不能太舊或太新）
            const now = Date.now();
            const syncTime = Number(data.syncPlayTime);
            const timeDiff = Math.abs(now - syncTime);
            
            if (timeDiff > this.maxSyncDelay) {
                console.warn('[同步管理器] 同步時間戳過時:', timeDiff + 'ms');
                return false;
            }

            return true;
        }

        // ==================== 性能統計 ====================
        updateSyncStats(success, delay) {
            if (success) {
                this.syncStats.successCount++;
                this.syncStats.lastSyncDelay = delay;
                
                // 計算平均延遲
                const total = this.syncStats.avgDelay * (this.syncStats.successCount - 1) + delay;
                this.syncStats.avgDelay = total / this.syncStats.successCount;
            } else {
                this.syncStats.failCount++;
            }
        }

        getSyncStats() {
            const total = this.syncStats.successCount + this.syncStats.failCount;
            return {
                ...this.syncStats,
                successRate: total > 0 ? (this.syncStats.successCount / total * 100).toFixed(1) + '%' : '0%',
                totalAttempts: total
            };
        }

        // ==================== 同步控制 ====================
        enableSync() {
            this.syncEnabled = true;
            this.saveSyncSettings();
            console.log('[同步管理器] 同步已啟用');
        }

        disableSync() {
            this.syncEnabled = false;
            this.saveSyncSettings();
            console.log('[同步管理器] 同步已禁用');
        }

        setSyncThreshold(threshold) {
            if (threshold > 0 && threshold <= 10) {
                this.syncThreshold = threshold;
                console.log('[同步管理器] 同步閾值設置為:', threshold + 's');
            }
        }

        // ==================== 設置保存 ====================
        saveSyncSettings() {
            const settings = window.BCMedia.Utils.getLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.SETTINGS,
                {}
            );
            
            settings.syncEnabled = this.syncEnabled;
            settings.syncThreshold = this.syncThreshold;
            
            window.BCMedia.Utils.setLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.SETTINGS,
                settings
            );
        }

        // ==================== 輔助方法 ====================
        getCurrentTime() {
            return this.mediaPlayer?.state.currentTime || 0;
        }

        getCurrentPaused() {
            return !this.mediaPlayer?.state.playing;
        }

        isActive() {
            return this.mediaPlayer?.isActive || false;
        }

        // ==================== 同步狀態信息 ====================
        getSyncStatus() {
            const status = {
                enabled: this.syncEnabled,
                connected: Boolean(this.networkManager),
                hasPermission: this.mediaPlayer?.hasModifyPermission() || false,
                lastSync: this.syncData.lastSyncTime,
                timeSinceSync: this.syncData.lastSyncTime ? Date.now() - this.syncData.lastSyncTime : 0,
                needsSync: this.syncData.needSetSync,
                threshold: this.syncThreshold,
                stats: this.getSyncStats()
            };

            return status;
        }

        // ==================== 調試方法 ====================
        debugSync() {
            const status = this.getSyncStatus();
            console.table({
                '同步狀態': status.enabled ? '啟用' : '禁用',
                '網絡連接': status.connected ? '已連接' : '未連接',
                '管理權限': status.hasPermission ? '有' : '無',
                '上次同步': status.lastSync ? new Date(status.lastSync).toLocaleTimeString() : '未同步',
                '同步間隔': status.timeSinceSync + 'ms',
                '需要同步': status.needsSync ? '是' : '否',
                '同步閾值': status.threshold + 's',
                '成功率': status.stats.successRate,
                '平均延遲': status.stats.avgDelay.toFixed(1) + 'ms'
            });

            console.log('[同步數據]', this.syncData);
        }

        // ==================== 錯誤處理 ====================
        handleSyncError(error, context = '') {
            console.error(`[同步管理器] ${context}錯誤:`, error);
            this.updateSyncStats(false, 0);
            
            // 重置同步狀態
            this.syncData.needSetSync = false;
            
            // 如果是關鍵錯誤，可以禁用同步一段時間
            if (error.name === 'SecurityError' || error.name === 'NetworkError') {
                console.warn('[同步管理器] 檢測到關鍵錯誤，暫時禁用同步');
                setTimeout(() => {
                    this.requestFullSync();
                }, 5000);
            }
        }

        // ==================== 清理方法 ====================
        reset() {
            this.syncData = {
                listTime: 0,
                playTime: 0,
                playTimeBySync: 0,
                pausedBySync: false,
                needSetSync: false,
                playingId: '',
                lastSyncTime: 0
            };

            this.syncStats = {
                successCount: 0,
                failCount: 0,
                avgDelay: 0,
                lastSyncDelay: 0
            };

            console.log('[同步管理器] 已重置');
        }

        destroy() {
            this.reset();
            console.log('[同步管理器] 清理完成');
        }
    }

    // 註冊到全域命名空間
    window.BCMedia.SyncManager = SyncManager;

    console.log('[BC增強媒體] 同步管理器模塊載入完成');
})();
