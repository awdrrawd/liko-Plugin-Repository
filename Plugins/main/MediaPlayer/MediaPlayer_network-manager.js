// network-manager.js - 網絡通信管理模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== 網絡管理器類 ====================
    class NetworkManager {
        constructor() {
            this.mediaPlayer = null;
            this.syncManager = null;
            
            // 消息隊列和限流
            this.messageQueue = [];
            this.isProcessingQueue = false;
            this.messageRateLimit = 500; // 消息發送間隔(毫秒)
            this.lastMessageTime = 0;
            
            // 連接狀態
            this.connectionState = {
                connected: false,
                reconnecting: false,
                lastHeartbeat: 0,
                failedAttempts: 0
            };
            
            // 統計信息
            this.stats = {
                messagesSent: 0,
                messagesReceived: 0,
                bytesTransferred: 0,
                errors: 0,
                lastActivity: 0
            };
            
            // 消息處理器映射
            this.messageHandlers = new Map();
            this.initMessageHandlers();
            
            this.init();
        }

        // ==================== 初始化 ====================
        init() {
            this.bindEvents();
            this.startHeartbeat();
        }

        bindEvents() {
            // 監聽網絡狀態變化
            window.addEventListener('online', () => {
                this.handleNetworkOnline();
            });

            window.addEventListener('offline', () => {
                this.handleNetworkOffline();
            });

            // 監聽頁面可見性變化
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.checkConnection();
                }
            });
        }

        initMessageHandlers() {
            // 註冊不同類型的消息處理器
            this.messageHandlers.set('SyncPlay', (data, sender) => {
                this.handleSyncPlay(data, sender);
            });

            this.messageHandlers.set('SyncList', (data, sender) => {
                this.handleSyncList(data, sender);
            });

            this.messageHandlers.set('SyncRequest', (data, sender) => {
                this.handleSyncRequest(data, sender);
            });

            this.messageHandlers.set('Danmu', (data, sender) => {
                this.handleDanmu(data, sender);
            });

            this.messageHandlers.set('Heartbeat', (data, sender) => {
                this.handleHeartbeat(data, sender);
            });

            this.messageHandlers.set('StateUpdate', (data, sender) => {
                this.handleStateUpdate(data, sender);
            });
        }

        // ==================== 模塊設置 ====================
        setMediaPlayer(mediaPlayer) {
            this.mediaPlayer = mediaPlayer;
        }

        setSyncManager(syncManager) {
            this.syncManager = syncManager;
        }

        // ==================== 消息發送 ====================
        async sendMessage(type, content, data = {}, target = null) {
            try {
                const message = this.createMessage(type, content, data, target);
                
                if (!this.validateMessage(message)) {
                    throw new Error('消息格式無效');
                }

                // 添加到隊列
                this.messageQueue.push(message);
                
                // 處理隊列
                await this.processMessageQueue();
                
                return true;
                
            } catch (error) {
                console.error('[網絡管理器] 發送消息失敗:', error);
                this.stats.errors++;
                return false;
            }
        }

        createMessage(type, content, data = {}, target = null) {
            const message = {
                Type: type,
                Content: content,
                Data: data,
                Target: target,
                Timestamp: Date.now(),
                Sender: this.getPlayerInfo(),
                MessageId: window.BCMedia.Utils.generateShortId()
            };

            return message;
        }

        validateMessage(message) {
            if (!message || typeof message !== 'object') return false;
            if (!message.Type || !message.Content) return false;
            if (message.Target && typeof message.Target !== 'number') return false;
            
            // 檢查消息大小
            const messageSize = JSON.stringify(message).length;
            if (messageSize > 65536) { // 64KB限制
                console.warn('[網絡管理器] 消息過大:', messageSize, 'bytes');
                return false;
            }

            return true;
        }

        async processMessageQueue() {
            if (this.isProcessingQueue || this.messageQueue.length === 0) {
                return;
            }

            this.isProcessingQueue = true;

            try {
                while (this.messageQueue.length > 0) {
                    const message = this.messageQueue.shift();
                    
                    // 檢查速率限制
                    const now = Date.now();
                    const timeSinceLastMessage = now - this.lastMessageTime;
                    
                    if (timeSinceLastMessage < this.messageRateLimit) {
                        const delay = this.messageRateLimit - timeSinceLastMessage;
                        await this.sleep(delay);
                    }

                    await this.sendNetworkMessage(message);
                    this.lastMessageTime = Date.now();
                    
                    // 更新統計
                    this.stats.messagesSent++;
                    this.stats.bytesTransferred += JSON.stringify(message).length;
                    this.stats.lastActivity = Date.now();
                }
            } catch (error) {
                console.error('[網絡管理器] 處理消息隊列失敗:', error);
                this.stats.errors++;
            } finally {
                this.isProcessingQueue = false;
            }
        }

        async sendNetworkMessage(message) {
            return new Promise((resolve, reject) => {
                try {
                    const chatData = {
                        Content: "EEVideo",
                        Type: "Hidden",
                        Dictionary: [message.Data || message]
                    };

                    if (message.Target) {
                        chatData.Target = message.Target;
                    }

                    // 使用遊戲的網絡API
                    if (window.ServerSend) {
                        window.ServerSend("ChatRoomChat", chatData);
                        resolve();
                    } else {
                        reject(new Error('ServerSend不可用'));
                    }

                } catch (error) {
                    reject(error);
                }
            });
        }

        // ==================== 專用發送方法 ====================
        sendSyncPlay(target = null) {
            if (!this.mediaPlayer) return;

            const data = {
                Type: window.BCMedia.Constants.SYNC_TYPES.PLAY,
                Paused: !this.mediaPlayer.state.playing,
                PlayTime: this.mediaPlayer.state.currentTime,
                PlayingId: this.mediaPlayer.playingId,
                syncPlayTime: Date.now(),
                Duration: this.mediaPlayer.state.duration,
                Volume: this.mediaPlayer.state.volume
            };

            return this.sendMessage('SyncPlay', 'EEVideo', data, target);
        }

        sendSyncList(target = null) {
            if (!this.mediaPlayer) return;

            const data = {
                Type: window.BCMedia.Constants.SYNC_TYPES.LIST,
                List: this.mediaPlayer.videoList,
                syncListTime: Date.now(),
                TotalCount: this.mediaPlayer.videoList.length
            };

            return this.sendMessage('SyncList', 'EEVideo', data, target);
        }

        sendSyncRequest(target = null) {
            const data = {
                Type: window.BCMedia.Constants.SYNC_TYPES.REQUEST,
                RequesterId: this.getPlayerInfo().id,
                RequestTime: Date.now()
            };

            return this.sendMessage('SyncRequest', 'EEVideo', data, target);
        }

        sendDanmu(text, options = {}) {
            if (!window.BCMedia.Utils.isValidDanmu(text)) {
                console.warn('[網絡管理器] 彈幕內容無效:', text);
                return false;
            }

            const data = {
                Type: window.BCMedia.Constants.SYNC_TYPES.DANMU,
                Text: window.BCMedia.Utils.sanitizeText(text),
                Color: options.color || '#ffffff',
                Size: options.size || 'normal',
                Position: options.position || 'scroll',
                Time: this.mediaPlayer?.state.currentTime || 0,
                SendTime: Date.now()
            };

            return this.sendMessage('Danmu', `SourceCharacter發彈幕：${text}`, data);
        }

        sendStateUpdate() {
            if (!this.mediaPlayer) return;

            const data = {
                Type: 'StateUpdate',
                PlayerState: {
                    isActive: this.mediaPlayer.isActive,
                    currentMode: this.mediaPlayer.currentMode,
                    playingId: this.mediaPlayer.playingId,
                    playingName: this.mediaPlayer.getChatRoomPlayingName(),
                    currentTime: this.mediaPlayer.state.currentTime,
                    duration: this.mediaPlayer.state.duration,
                    playing: this.mediaPlayer.state.playing
                },
                Timestamp: Date.now()
            };

            return this.sendMessage('StateUpdate', 'EEVideo', data);
        }

        sendHeartbeat() {
            const data = {
                Type: 'Heartbeat',
                Timestamp: Date.now(),
                PlayerInfo: this.getPlayerInfo(),
                ConnectionState: this.connectionState
            };

            return this.sendMessage('Heartbeat', 'EEVideo', data);
        }

        // ==================== 消息接收處理 ====================
        handleMessage(messageData) {
            try {
                if (!messageData || !messageData.Dictionary) return;

                this.stats.messagesReceived++;
                this.stats.lastActivity = Date.now();

                // 處理字典中的每個數據項
                messageData.Dictionary.forEach(data => {
                    this.processMessageData(data, messageData);
                });

                // 更新連接狀態
                this.connectionState.connected = true;
                this.connectionState.lastHeartbeat = Date.now();
                this.connectionState.failedAttempts = 0;

            } catch (error) {
                console.error('[網絡管理器] 處理消息失敗:', error);
                this.stats.errors++;
            }
        }

        processMessageData(data, originalMessage) {
            if (!data || !data.Type) return;

            const handler = this.messageHandlers.get(data.Type);
            if (handler) {
                handler(data, originalMessage.Sender || originalMessage);
            } else {
                console.warn('[網絡管理器] 未知消息類型:', data.Type);
            }
        }

        // ==================== 消息處理器 ====================
        handleSyncPlay(data, sender) {
            console.log('[網絡管理器] 接收同步播放:', data);
            
            if (this.syncManager) {
                this.syncManager.handleSyncPlay(data);
            }
        }

        handleSyncList(data, sender) {
            console.log('[網絡管理器] 接收同步列表:', data);
            
            if (this.syncManager) {
                this.syncManager.handleSyncList(data);
            }
        }

        handleSyncRequest(data, sender) {
            console.log('[網絡管理器] 接收同步請求:', data);
            
            if (this.syncManager) {
                this.syncManager.handleSyncRequest(sender);
            }
        }

        handleDanmu(data, sender) {
            console.log('[網絡管理器] 接收彈幕:', data);
            
            // 這裡可以添加彈幕顯示邏輯
            if (this.mediaPlayer && this.mediaPlayer.uiManager) {
                this.mediaPlayer.uiManager.showNotification(
                    `彈幕: ${data.Text}`, 
                    'info', 
                    3000
                );
            }
        }

        handleHeartbeat(data, sender) {
            // 更新發送者的活躍狀態
            this.updatePlayerActivity(sender, data);
        }

        handleStateUpdate(data, sender) {
            console.log('[網絡管理器] 接收狀態更新:', data);
            
            // 更新其他播放器的狀態
            if (this.mediaPlayer) {
                this.updateWatcherState(sender, data.PlayerState);
            }
        }

        // ==================== 連接管理 ====================
        startHeartbeat() {
            // 每30秒發送一次心跳
            setInterval(() => {
                if (this.mediaPlayer?.isActive) {
                    this.sendHeartbeat();
                }
            }, 30000);
        }

        checkConnection() {
            const now = Date.now();
            const timeSinceLastActivity = now - this.stats.lastActivity;
            
            // 如果超過2分鐘沒有活動，認為連接可能有問題
            if (timeSinceLastActivity > 120000 && this.connectionState.connected) {
                console.warn('[網絡管理器] 檢測到連接可能異常');
                this.connectionState.connected = false;
                this.attemptReconnection();
            }
        }

        attemptReconnection() {
            if (this.connectionState.reconnecting) return;
            
            this.connectionState.reconnecting = true;
            this.connectionState.failedAttempts++;
            
            console.log('[網絡管理器] 嘗試重新連接...', this.connectionState.failedAttempts);
            
            // 發送心跳測試連接
            this.sendHeartbeat().then(() => {
                this.connectionState.reconnecting = false;
                console.log('[網絡管理器] 重新連接成功');
            }).catch(error => {
                console.error('[網絡管理器] 重新連接失敗:', error);
                this.connectionState.reconnecting = false;
                
                // 如果失敗次數過多，增加重試間隔
                const retryDelay = Math.min(30000, 5000 * this.connectionState.failedAttempts);
                setTimeout(() => {
                    this.attemptReconnection();
                }, retryDelay);
            });
        }

        handleNetworkOnline() {
            console.log('[網絡管理器] 網絡已連接');
            this.connectionState.connected = true;
            this.connectionState.failedAttempts = 0;
            
            // 重新同步
            if (this.syncManager) {
                this.syncManager.requestFullSync();
            }
        }

        handleNetworkOffline() {
            console.log('[網絡管理器] 網絡已斷開');
            this.connectionState.connected = false;
        }

        // ==================== 輔助方法 ====================
        getPlayerInfo() {
            return {
                id: window.Player?.MemberNumber || 0,
                name: window.Player?.Name || 'Unknown',
                room: window.ChatRoomData?.Name || 'Unknown',
                timestamp: Date.now()
            };
        }

        updatePlayerActivity(sender, data) {
            // 更新播放者活躍狀態
            // 這裡可以維護一個活躍用戶列表
        }

        updateWatcherState(sender, playerState) {
            if (!this.mediaPlayer) return;

            // 找到或創建觀看者記錄
            let watcher = this.mediaPlayer.watchers.find(w => w.id === sender.id);
            if (!watcher) {
                watcher = {
                    id: sender.id,
                    name: sender.name,
                    PlayingName: '',
                    lastUpdate: 0
                };
                this.mediaPlayer.watchers.push(watcher);
            }

            // 更新觀看者狀態
            watcher.PlayingName = playerState.playingName || '';
            watcher.isActive = playerState.isActive || false;
            watcher.currentMode = playerState.currentMode || 'normal';
            watcher.lastUpdate = Date.now();

            // 清理過期的觀看者
            this.cleanupWatchers();
        }

        cleanupWatchers() {
            if (!this.mediaPlayer) return;

            const now = Date.now();
            this.mediaPlayer.watchers = this.mediaPlayer.watchers.filter(watcher => {
                return now - watcher.lastUpdate < 120000; // 保留2分鐘內活躍的
            });
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // ==================== 統計和監控 ====================
        getNetworkStats() {
            const now = Date.now();
            return {
                ...this.stats,
                connectionState: { ...this.connectionState },
                timeSinceLastActivity: now - this.stats.lastActivity,
                messageQueueLength: this.messageQueue.length,
                isProcessingQueue: this.isProcessingQueue,
                averageMessageSize: this.stats.messagesSent > 0 
                    ? (this.stats.bytesTransferred / this.stats.messagesSent).toFixed(1) + ' bytes'
                    : '0 bytes',
                errorRate: this.stats.messagesSent > 0 
                    ? ((this.stats.errors / (this.stats.messagesSent + this.stats.errors)) * 100).toFixed(1) + '%'
                    : '0%'
            };
        }

        // ==================== 錯誤處理 ====================
        handleNetworkError(error, context = '') {
            console.error(`[網絡管理器] ${context}錯誤:`, error);
            this.stats.errors++;
            
            // 根據錯誤類型採取不同的處理策略
            if (error.name === 'NetworkError' || error.message.includes('fetch')) {
                this.connectionState.connected = false;
                this.attemptReconnection();
            } else if (error.name === 'SecurityError') {
                console.warn('[網絡管理器] 安全錯誤，可能需要用戶許可');
            } else if (error.name === 'QuotaExceededError') {
                console.warn('[網絡管理器] 存儲配額超出，清理緩存');
                this.clearMessageQueue();
            }
        }

        // ==================== 消息隊列管理 ====================
        clearMessageQueue() {
            this.messageQueue = [];
            console.log('[網絡管理器] 消息隊列已清空');
        }

        getMessageQueueInfo() {
            const totalSize = this.messageQueue.reduce((size, message) => {
                return size + JSON.stringify(message).length;
            }, 0);

            return {
                length: this.messageQueue.length,
                totalSize: totalSize,
                isProcessing: this.isProcessingQueue,
                oldestMessage: this.messageQueue.length > 0 ? this.messageQueue[0].Timestamp : null
            };
        }

        // ==================== 配置管理 ====================
        setMessageRateLimit(limit) {
            if (limit >= 100 && limit <= 5000) {
                this.messageRateLimit = limit;
                console.log('[網絡管理器] 消息速率限制設置為:', limit + 'ms');
            }
        }

        // ==================== 調試方法 ====================
        debugNetwork() {
            const stats = this.getNetworkStats();
            const queueInfo = this.getMessageQueueInfo();
            
            console.table({
                '連接狀態': stats.connectionState.connected ? '已連接' : '未連接',
                '發送消息': stats.messagesSent,
                '接收消息': stats.messagesReceived,
                '傳輸字節': (stats.bytesTransferred / 1024).toFixed(1) + ' KB',
                '錯誤次數': stats.errors,
                '錯誤率': stats.errorRate,
                '隊列長度': queueInfo.length,
                '隊列大小': (queueInfo.totalSize / 1024).toFixed(1) + ' KB',
                '平均消息大小': stats.averageMessageSize,
                '最後活動': stats.lastActivity ? new Date(stats.lastActivity).toLocaleTimeString() : '無',
                '活動間隔': (stats.timeSinceLastActivity / 1000).toFixed(1) + 's'
            });

            if (this.mediaPlayer?.watchers.length > 0) {
                console.log('[活躍觀看者]', this.mediaPlayer.watchers);
            }
        }

        // ==================== 性能優化 ====================
        optimizeMessageQueue() {
            if (this.messageQueue.length === 0) return;

            // 移除過期的消息
            const now = Date.now();
            const maxAge = 30000; // 30秒
            
            this.messageQueue = this.messageQueue.filter(message => {
                return now - message.Timestamp < maxAge;
            });

            // 合並相似的消息
            this.mergeSimilarMessages();
        }

        mergeSimilarMessages() {
            // 合並相同類型的同步消息，只保留最新的
            const messageTypes = ['SyncPlay', 'SyncList', 'StateUpdate'];
            
            messageTypes.forEach(type => {
                const messagesOfType = this.messageQueue.filter(m => m.Data?.Type === type);
                if (messagesOfType.length > 1) {
                    // 保留最新的消息
                    const latest = messagesOfType[messagesOfType.length - 1];
                    this.messageQueue = this.messageQueue.filter(m => 
                        m.Data?.Type !== type || m === latest
                    );
                }
            });
        }

        // ==================== 安全檢查 ====================
        validateIncomingMessage(messageData) {
            if (!messageData || typeof messageData !== 'object') return false;
            
            // 檢查消息來源
            if (!messageData.Sender && !messageData.MemberNumber) return false;
            
            // 檢查消息內容
            if (!messageData.Content || !messageData.Dictionary) return false;
            
            // 檢查字典數組
            if (!Array.isArray(messageData.Dictionary)) return false;
            
            // 檢查每個字典項
            for (const item of messageData.Dictionary) {
                if (!item || typeof item !== 'object') return false;
                if (!item.Type) return false;
            }
            
            return true;
        }

        sanitizeMessageData(data) {
            // 清理和驗證消息數據
            const sanitized = {};
            
            // 只複製允許的字段
            const allowedFields = [
                'Type', 'Paused', 'PlayTime', 'PlayingId', 'syncPlayTime', 
                'List', 'syncListTime', 'Text', 'Color', 'Size', 'Position',
                'RequesterId', 'RequestTime', 'PlayerState', 'Timestamp'
            ];
            
            allowedFields.forEach(field => {
                if (field in data) {
                    sanitized[field] = data[field];
                }
            });
            
            return sanitized;
        }

        // ==================== 重新連接策略 ====================
        getReconnectionDelay() {
            const baseDelay = 1000; // 1秒
            const maxDelay = 30000; // 30秒
            const attempts = this.connectionState.failedAttempts;
            
            // 指數退避算法
            const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempts));
            
            // 添加隨機抖動防止雷群效應
            const jitter = delay * 0.1 * Math.random();
            
            return delay + jitter;
        }

        // ==================== 清理方法 ====================
        reset() {
            this.clearMessageQueue();
            
            this.connectionState = {
                connected: false,
                reconnecting: false,
                lastHeartbeat: 0,
                failedAttempts: 0
            };

            this.stats = {
                messagesSent: 0,
                messagesReceived: 0,
                bytesTransferred: 0,
                errors: 0,
                lastActivity: 0
            };

            console.log('[網絡管理器] 已重置');
        }

        destroy() {
            this.reset();
            
            // 清理事件監聽器
            // 注意：由於事件監聽器是匿名函數，這裡無法直接移除
            // 在實際使用中應該保存事件監聽器的引用以便清理
            
            console.log('[網絡管理器] 清理完成');
        }
    }

    // 註冊到全域命名空間
    window.BCMedia.NetworkManager = NetworkManager;

    console.log('[BC增強媒體] 網絡管理器模塊載入完成');
})();
