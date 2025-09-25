// SyncManager.js - 多人同步播放管理器
class SyncManager {
    constructor(playerInstance) {
        this.player = playerInstance;
        this.syncData = {
            playTime: 0,
            listTime: 0,
            stateTime: 0,
            currentPlayingId: null
        };
        this.watchers = [];
        this.isHost = false;
        this.syncThreshold = 2; // 同步阈值（秒）
        this.networkDelay = 0;
        this.eventEmitter = MediaUtils.createEventEmitter();
        
        this.init();
    }

    init() {
        // 绑定播放器事件
        this.bindPlayerEvents();
        
        // 启动心跳检测
        this.startHeartbeat();
        
        // 网络延迟检测
        this.detectNetworkDelay();
    }

    bindPlayerEvents() {
        if (this.player.videoPlayer?.artPlayer) {
            const artPlayer = this.player.videoPlayer.artPlayer;
            
            // 播放状态变化
            artPlayer.on('video:play', () => {
                if (this.isHost) {
                    this.broadcastPlayState();
                }
            });
            
            artPlayer.on('video:pause', () => {
                if (this.isHost) {
                    this.broadcastPlayState();
                }
            });
            
            // 进度变化
            artPlayer.on('video:seeked', () => {
                if (this.isHost) {
                    this.broadcastPlayState();
                }
            });
            
            // 播放列表变化
            artPlayer.on('video:loadstart', () => {
                if (this.isHost) {
                    this.broadcastPlayState();
                }
            });
        }
    }

    // 处理接收到的消息
    handleMessage(data) {
        if (!data || data.Sender === this.getCurrentUserId()) return;
        
        if (data.Content === "EEVideo" && data.Dictionary) {
            data.Dictionary.forEach(dict => {
                switch (dict.Type) {
                    case "SyncPlay":
                        this.handleSyncPlay(data.Sender, dict);
                        break;
                    case "SyncList":
                        this.handleSyncList(data.Sender, dict);
                        break;
                    case "RequestSync":
                        this.handleSyncRequest(data.Sender);
                        break;
                    case "State":
                        this.handleStateUpdate(data.Sender, dict);
                        break;
                    case "Heartbeat":
                        this.handleHeartbeat(data.Sender, dict);
                        break;
                }
            });
        }
    }

    // 处理播放同步
    handleSyncPlay(senderId, data) {
        if (this.isHost || !this.player.videoPlayer?.artPlayer) return;
        
        // 检查时间戳，防止过期消息
        if (data.syncPlayTime <= this.syncData.playTime) return;
        
        this.syncData.playTime = data.syncPlayTime;
        this.syncData.currentPlayingId = data.playingId;
        
        const artPlayer = this.player.videoPlayer.artPlayer;
        const targetTime = this.calculateTargetTime(data);
        
        // 切换视频源
        if (data.playingId !== this.getCurrentPlayingId()) {
            this.switchToMedia(data.playingId);
        }
        
        // 同步播放状态
        this.syncPlaybackState(data.paused, targetTime);
        
        this.eventEmitter.emit('syncReceived', { senderId, data });
    }

    // 处理播放列表同步
    handleSyncList(senderId, data) {
        if (this.isHost) return;
        
        if (data.syncListTime <= this.syncData.listTime) return;
        
        this.syncData.listTime = data.syncListTime;
        this.player.videoPlayer.playlist = [...data.playlist];
        
        this.eventEmitter.emit('playlistSynced', { senderId, playlist: data.playlist });
        
        // 更新UI
        if (this.player.uiManager) {
            this.player.uiManager.renderPlaylist();
        }
    }

    // 处理同步请求
    handleSyncRequest(senderId) {
        if (!this.isHost || !this.player.videoPlayer?.isActive) return;
        
        // 发送当前播放列表
        this.sendSyncList(senderId);
        
        // 发送当前播放状态
        this.sendSyncPlay(senderId);
        
        this.eventEmitter.emit('syncRequested', { senderId });
    }

    // 处理状态更新
    handleStateUpdate(senderId, data) {
        // 更新观看者列表
        this.updateWatcher(senderId, data);
        
        // 如果是主控离开，重新选举
        if (!data.active && this.getWatcher(senderId)?.isHost) {
            this.electNewHost();
        }
        
        this.eventEmitter.emit('stateUpdated', { senderId, data });
    }

    // 处理心跳
    handleHeartbeat(senderId, data) {
        const watcher = this.getWatcher(senderId);
        if (watcher) {
            watcher.lastHeartbeat = Date.now();
            watcher.networkDelay = data.timestamp ? Date.now() - data.timestamp : 0;
        }
    }

    // 广播播放状态
    broadcastPlayState() {
        if (!this.player.videoPlayer?.artPlayer || !this.isHost) return;
        
        const artPlayer = this.player.videoPlayer.artPlayer;
        const currentTime = Date.now();
        
        const syncData = {
            Type: "SyncPlay",
            playingId: this.getCurrentPlayingId(),
            currentTime: artPlayer.currentTime,
            paused: artPlayer.paused,
            syncPlayTime: currentTime,
            duration: artPlayer.duration
        };
        
        this.sendToAll(syncData);
        this.syncData.playTime = currentTime;
    }

    // 广播播放列表
    broadcastPlaylist() {
        if (!this.isHost) return;
        
        const syncData = {
            Type: "SyncList",
            playlist: this.player.videoPlayer.playlist,
            syncListTime: Date.now()
        };
        
        this.sendToAll(syncData);
        this.syncData.listTime = syncData.syncListTime;
    }

    // 请求同步
    requestSync() {
        const syncData = {
            Type: "RequestSync",
            timestamp: Date.now()
        };
        
        this.sendToAll(syncData);
        this.eventEmitter.emit('syncRequested');
    }

    // 发送状态更新
    sendStateUpdate() {
        const syncData = {
            Type: "State",
            active: this.player.videoPlayer?.isActive || false,
            isHost: this.isHost,
            currentPlaying: this.getCurrentPlayingName(),
            timestamp: Date.now()
        };
        
        this.sendToAll(syncData);
    }

    // 发送心跳
    sendHeartbeat() {
        if (!this.player.videoPlayer?.isActive) return;
        
        const syncData = {
            Type: "Heartbeat",
            timestamp: Date.now(),
            isHost: this.isHost
        };
        
        this.sendToAll(syncData);
    }

    // 计算目标播放时间
    calculateTargetTime(syncData) {
        if (syncData.paused) {
            return syncData.currentTime;
        }
        
        const networkDelay = this.networkDelay / 1000;
        const timeDiff = (Date.now() - syncData.syncPlayTime) / 1000;
        
        return syncData.currentTime + timeDiff + networkDelay;
    }

    // 同步播放状态
    syncPlaybackState(shouldBePaused, targetTime) {
        if (!this.player.videoPlayer?.artPlayer) return;
        
        const artPlayer = this.player.videoPlayer.artPlayer;
        const currentTime = artPlayer.currentTime;
        const timeDifference = Math.abs(currentTime - targetTime);
        
        // 时间差超过阈值才进行同步
        if (timeDifference > this.syncThreshold) {
            artPlayer.currentTime = targetTime;
            
            UIComponents.showNotification(
                `时间同步: ${timeDifference.toFixed(1)}秒`, 
                'info', 
                1000
            );
        }
        
        // 同步播放/暂停状态
        if (shouldBePaused && !artPlayer.paused) {
            artPlayer.pause();
        } else if (!shouldBePaused && artPlayer.paused) {
            artPlayer.play();
        }
    }

    // 切换媒体
    switchToMedia(playingId) {
        const item = this.player.videoPlayer.playlist.find(item => item.id === playingId);
        if (item && this.player.videoPlayer?.artPlayer) {
            this.player.videoPlayer.artPlayer.url = item.url;
            this.syncData.currentPlayingId = playingId;
            
            // 更新UI标题
            if (this.player.uiManager) {
                this.player.uiManager.updateTitle(item.name);
            }
        }
    }

    // 更新观看者信息
    updateWatcher(userId, data) {
        let watcher = this.getWatcher(userId);
        
        if (!watcher) {
            watcher = {
                userId: userId,
                joinTime: Date.now(),
                lastHeartbeat: Date.now(),
                networkDelay: 0
            };
            this.watchers.push(watcher);
        }
        
        Object.assign(watcher, {
            active: data.active,
            isHost: data.isHost,
            currentPlaying: data.currentPlaying,
            lastUpdate: Date.now()
        });
        
        // 清理非活跃观看者
        this.cleanupInactiveWatchers();
    }

    // 清理非活跃观看者
    cleanupInactiveWatchers() {
        const now = Date.now();
        const timeout = 30000; // 30秒超时
        
        this.watchers = this.watchers.filter(watcher => {
            return (now - watcher.lastHeartbeat) < timeout;
        });
    }

    // 获取观看者
    getWatcher(userId) {
        return this.watchers.find(watcher => watcher.userId === userId);
    }

    // 选举新主控
    electNewHost() {
        // 按加入时间选择最早的活跃观看者作为新主控
        const activeWatchers = this.watchers.filter(w => w.active);
        
        if (activeWatchers.length === 0) return;
        
        const newHost = activeWatchers.reduce((oldest, current) => {
            return current.joinTime < oldest.joinTime ? current : oldest;
        });
        
        if (newHost.userId === this.getCurrentUserId()) {
            this.becomeHost();
        }
    }

    // 成为主控
    becomeHost() {
        this.isHost = true;
        this.eventEmitter.emit('becameHost');
        
        UIComponents.showNotification('你已成为房间主控', 'success');
        
        // 立即同步状态
        this.sendStateUpdate();
    }

    // 放弃主控
    resignHost() {
        this.isHost = false;
        this.eventEmitter.emit('resignedHost');
        
        this.sendStateUpdate();
        this.electNewHost();
    }

    // 启动心跳检测
    startHeartbeat() {
        // 每10秒发送心跳
        setInterval(() => {
            this.sendHeartbeat();
            this.cleanupInactiveWatchers();
        }, 10000);
    }

    // 检测网络延迟
    async detectNetworkDelay() {
        try {
            const start = Date.now();
            await fetch(window.location.origin, { method: 'HEAD' });
            this.networkDelay = Date.now() - start;
        } catch (error) {
            this.networkDelay = 100; // 默认延迟
        }
    }

    // 发送消息到所有人
    sendToAll(data) {
        if (typeof ServerSend === 'function') {
            ServerSend("ChatRoomChat", {
                Content: "EEVideo",
                Type: "Hidden",
                Dictionary: [data]
            });
        }
    }

    // 发送消息到特定用户
    sendToUser(userId, data) {
        if (typeof ServerSend === 'function') {
            ServerSend("ChatRoomChat", {
                Content: "EEVideo",
                Type: "Hidden",
                Target: userId,
                Dictionary: [data]
            });
        }
    }

    // 发送同步播放到特定用户
    sendSyncPlay(userId = null) {
        if (!this.player.videoPlayer?.artPlayer) return;
        
        const artPlayer = this.player.videoPlayer.artPlayer;
        const syncData = {
            Type: "SyncPlay",
            playingId: this.getCurrentPlayingId(),
            currentTime: artPlayer.currentTime,
            paused: artPlayer.paused,
            syncPlayTime: Date.now(),
            duration: artPlayer.duration
        };
        
        if (userId) {
            this.sendToUser(userId, syncData);
        } else {
            this.sendToAll(syncData);
        }
    }

    // 发送同步播放列表到特定用户
    sendSyncList(userId = null) {
        const syncData = {
            Type: "SyncList",
            playlist: this.player.videoPlayer.playlist,
            syncListTime: Date.now()
        };
        
        if (userId) {
            this.sendToUser(userId, syncData);
        } else {
            this.sendToAll(syncData);
        }
    }

    // 获取当前用户ID
    getCurrentUserId() {
        return typeof Player !== 'undefined' ? Player.MemberNumber : null;
    }

    // 获取当前播放ID
    getCurrentPlayingId() {
        return this.syncData.currentPlayingId;
    }

    // 获取当前播放名称
    getCurrentPlayingName() {
        const currentItem = this.player.videoPlayer.playlist.find(
            item => item.id === this.getCurrentPlayingId()
        );
        return currentItem ? currentItem.name : '';
    }

    // 同步统计信息
    getSyncStats() {
        return {
            isHost: this.isHost,
            watchersCount: this.watchers.length,
            activeWatchers: this.watchers.filter(w => w.active).length,
            networkDelay: this.networkDelay,
            lastSyncTime: this.syncData.playTime,
            playlistItems: this.player.videoPlayer.playlist.length
        };
    }

    // 销毁同步管理器
    destroy() {
        this.watchers = [];
        this.isHost = false;
        this.eventEmitter.emit('destroyed');
    }
}

// 同步状态显示组件
class SyncStatusWidget {
    constructor(syncManager) {
        this.syncManager = syncManager;
        this.element = null;
        this.updateInterval = null;
        
        this.init();
    }

    init() {
        this.createElement();
        this.bindEvents();
        this.startUpdating();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'emp-sync-status';
        this.element.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            min-width: 200px;
            z-index: 10001;
            transition: var(--transition);
            transform: translateX(100%);
        `;

        this.updateContent();
        document.body.appendChild(this.element);
    }

    bindEvents() {
        this.syncManager.eventEmitter.on('syncReceived', () => this.show());
        this.syncManager.eventEmitter.on('becameHost', () => this.show());
        this.syncManager.eventEmitter.on('stateUpdated', () => this.updateContent());
        
        // 点击隐藏
        this.element.addEventListener('click', () => this.hide());
    }

    updateContent() {
        const stats = this.syncManager.getSyncStats();
        
        this.element.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="color: var(--primary); margin-right: 8px;">${stats.isHost ? '👑' : '👥'}</span>
                <strong style="color: var(--text);">${stats.isHost ? '主控模式' : '同步模式'}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
                <div>观看者: ${stats.activeWatchers}/${stats.watchersCount}</div>
                <div>网络延迟: ${stats.networkDelay}ms</div>
                <div>播放列表: ${stats.playlistItems} 项</div>
            </div>
        `;
    }

    show(duration = 3000) {
        this.element.style.transform = 'translateX(0)';
        
        if (duration > 0) {
            setTimeout(() => this.hide(), duration);
        }
    }

    hide() {
        this.element.style.transform = 'translateX(100%)';
    }

    startUpdating() {
        this.updateInterval = setInterval(() => {
            this.updateContent();
        }, 5000);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.element) {
            this.element.remove();
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.SyncManager = SyncManager;
    window.SyncStatusWidget = SyncStatusWidget;
}
