/**
 * BC Enhanced Media - Sync Module
 * 同步功能和彈幕系統模組
 */

window.BCEnhancedMedia = window.BCEnhancedMedia || {};
window.BCEnhancedMedia.Sync = (function() {
    'use strict';

    const helpers = window.BCEnhancedMedia.Helpers;
    const player = window.BCEnhancedMedia.Player;

    // 同步狀態
    const syncState = {
        watchers: [], // 當前房間觀看者列表
        localMsgPlayingName: '',
        localMsgPlayingRoom: '',
        messageTypes: {
            SYNC_PLAY: 'SyncPlay',
            SYNC_LIST: 'SyncList',
            REQUEST_SYNC: 'RequstSync',
            STATE: 'State',
            DANMU: 'Danmu'
        }
    };

    // 初始化同步模組
    function initialize() {
        console.log('[BC Enhanced Media] Sync module initialized');
        return true;
    }

    // 發送同步播放狀態
    function sendSyncPlay(target = null) {
        const playerState = player.getState();
        const art = playerState.artPlayer;
        
        if (!art || !playerState.enabled) return;

        const syncData = {
            Type: syncState.messageTypes.SYNC_PLAY,
            Paused: art.paused,
            PlayTime: playerState.syncData.playTimeBySync,
            PlayingId: playerState.currentPlayingId,
            syncPlayTime: playerState.syncData.syncPlayTime
        };

        sendMessage([syncData], target);
        sendState(); // 同時發送狀態更新
    }

    // 處理同步播放消息
    function onSyncPlay(msg) {
        const playerState = player.getState();
        
        if (!playerState.enabled || !playerState.artPlayer) return;

        // 檢查時間戳，只接受更新的同步數據
        if (msg.syncPlayTime > playerState.syncData.syncPlayTime) {
            playerState.syncData.syncPlayTime = msg.syncPlayTime;
        } else {
            return; // 忽略舊的同步數據
        }

        // 更新同步數據
        playerState.syncData.playTimeBySync = msg.PlayTime;
        playerState.syncData.pausedBySync = msg.Paused;
        playerState.syncData.needSetSync = true;

        // 更新播放項目
        if (playerState.currentPlayingId !== msg.PlayingId) {
            player.playById(msg.PlayingId);
        }

        // 更新標題
        const currentItem = player.getCurrentPlayItem();
        if (currentItem) {
            player.updateTitle(currentItem.name);
        }

        // 嘗試執行同步
        player.trySetSyncPlay();
    }

    // 發送播放列表同步
    function sendSyncList(target = null) {
        const playerState = player.getState();
        
        const syncData = {
            Type: syncState.messageTypes.SYNC_LIST,
            List: playerState.playList,
            syncListTime: playerState.syncData.syncListTime
        };

        sendMessage([syncData], target);
    }

    // 處理播放列表同步消息
    function onSyncList(msg) {
        const playerState = player.getState();
        
        if (!playerState.enabled) return;

        // 檢查時間戳，只接受更新的列表數據
        if (msg.syncListTime > playerState.syncData.syncListTime) {
            playerState.syncData.syncListTime = msg.syncListTime;
        } else {
            return; // 忽略舊的列表數據
        }

        // 更新播放列表
        playerState.playList = msg.List || [];
        
        // 重新渲染播放列表
        if (window.BCEnhancedMedia.Components) {
            window.BCEnhancedMedia.Components.renderPlaylist();
        }
    }

    // 請求同步
    function requestSync(force = true) {
        // 強制同步會重置時間戳，確保接收到同步數據
        if (force) {
            const playerState = player.getState();
            playerState.syncData.syncListTime = 0;
            playerState.syncData.syncPlayTime = 0;
        }

        const syncData = {
            Type: syncState.messageTypes.REQUEST_SYNC
        };

        sendMessage([syncData]);
    }

    // 處理同步請求
    function onRequestSync(sender) {
        const playerState = player.getState();
        
        if (!playerState.enabled || !playerState.artPlayer) return;

        // 向請求者發送播放列表和播放狀態
        sendSyncList(sender);
        sendSyncPlay(sender);
    }

    // 發送狀態更新
    function sendState() {
        const playerState = player.getState();
        const currentItem = player.getCurrentPlayItem();
        
        const syncData = {
            Type: syncState.messageTypes.STATE,
            StateTime: Date.now(),
            Active: playerState.enabled,
            PlayingName: playerState.enabled ? (currentItem?.name || '') : ''
        };

        sendMessage([syncData]);
    }

    // 處理狀態更新消息
    function onReceiveState(sender, msg) {
        // 從觀看者列表中移除此用戶
        syncState.watchers = syncState.watchers.filter(
            watcher => watcher.MemberNumber !== sender
        );

        // 如果是活躍狀態，添加到觀看者列表
        if (msg.Active === true) {
            syncState.watchers.push({
                MemberNumber: sender,
                StateTime: msg.StateTime,
                PlayingName: msg.PlayingName || ''
            });

            // 房間播放提示
            if (msg.PlayingName && 
                msg.PlayingName !== '' &&
                syncState.localMsgPlayingName !== msg.PlayingName &&
                syncState.localMsgPlayingRoom !== (ChatRoomData?.Name || '')) {
                
                syncState.localMsgPlayingName = msg.PlayingName;
                syncState.localMsgPlayingRoom = ChatRoomData?.Name || '';

                const playerState = player.getState();
                if (!playerState.enabled) {
                    helpers.showLocalChatMsg('房間正在播放：' + msg.PlayingName);
                }
            }
        }
    }

    // 發送彈幕
    function sendDanmu(danmuData) {
        const playerState = player.getState();
        if (!playerState.enabled) return;

        // 構建彈幕消息
        const playerName = helpers.getPlayerName(Player);
        const message = `${playerName}發彈幕：${danmuData.text}`;
        
        sendCustomMessage(syncState.messageTypes.DANMU, message, danmuData);
    }

    // 處理彈幕消息
    function onReceiveDanmu(sender, msg) {
        const playerState = player.getState();
        
        if (!playerState.enabled || !playerState.artPlayer) return;

        const danmuData = msg.Data;
        if (!danmuData) return;

        // 如果正在播放，調整彈幕時間為當前時間（防止延遲過高）
        if (playerState.artPlayer.playing) {
            danmuData.time = player.getCurrentTime();
        }

        // 如果不是自己發的彈幕，顯示它
        if (sender !== Player.MemberNumber) {
            const danmuPlugin = playerState.artPlayer.plugins.artplayerPluginDanmuku;
            if (danmuPlugin) {
                danmuPlugin.emit(danmuData);
            }
        }
    }

    // 處理聊天室彈幕
    function handleChatDanmu(data, senderCharacter) {
        const playerState = player.getState();
        
        if (!playerState.enabled || !playerState.settings.danmuEnabled) return;
        
        if (data.Type === "Chat") {
            const playerName = helpers.getPlayerName(senderCharacter);
            const text = `${playerName}: ${data.Content}`;
            const color = helpers.getPlayerDefaultColor(senderCharacter);
            const isSelf = senderCharacter.MemberNumber === Player.MemberNumber;
            
            sendDanmuToPlayer(text, color, isSelf);
        }
    }

    // 向播放器發送彈幕（本地）
    function sendDanmuToPlayer(text, color = '#ffffff', border = false) {
        const playerState = player.getState();
        
        if (!playerState.enabled || !playerState.artPlayer) return;
        
        const danmuPlugin = playerState.artPlayer.plugins.artplayerPluginDanmuku;
        if (danmuPlugin && playerState.artPlayer.playing) {
            danmuPlugin.emit({
                text: text,
                color: color,
                border: border,
                time: player.getCurrentTime()
            });
        }
    }

    // 清理彈幕緩存
    function clearDanmuCache() {
        const playerState = player.getState();
        
        if (playerState.artPlayer?.plugins?.artplayerPluginDanmuku) {
            playerState.artPlayer.plugins.artplayerPluginDanmuku.load();
        }
    }

    // 更新同步時間戳
    function updateSyncTime() {
        const playerState = player.getState();
        
        if (hasModifyPermission()) {
            playerState.syncData.syncListTime = Date.now();
            playerState.syncData.syncPlayTime = Date.now();
            playerState.syncData.playTimeBySync = player.getCurrentTime();
        }
    }

    // 發送消息到聊天室
    function sendMessage(dictionary, target = null) {
        if (!dictionary || dictionary.length === 0) return;

        const messageData = {
            Content: "EEVideo",
            Type: "Hidden",
            Dictionary: dictionary
        };

        if (target && target !== Player.MemberNumber) {
            messageData.Target = target;
        }

        ServerSend("ChatRoomChat", messageData);
    }

    // 發送自定義消息（帶聊天顯示）
    function sendCustomMessage(type, displayMessage, data) {
        const dictionary = [
            {
                "Tag": "MISSING PLAYER DIALOG: EE_PLAYER_CUSTOM_DIALOG",
                "Text": displayMessage
            },
            {
                "Type": type,
                "Data": data
            }
        ];

        ServerSend("ChatRoomChat", {
            Content: "EE_PLAYER_CUSTOM_DIALOG",
            Type: "Action",
            Sender: Player.MemberNumber,
            Dictionary: dictionary
        });
    }

    // 處理接收到的媒體消息
    function handleMediaMessage(data) {
        if (!data || !data.Dictionary) return;
        
        data.Dictionary.forEach(item => {
            switch (item.Type) {
                case syncState.messageTypes.SYNC_PLAY:
                    onSyncPlay(item);
                    break;
                case syncState.messageTypes.SYNC_LIST:
                    onSyncList(item);
                    break;
                case syncState.messageTypes.REQUEST_SYNC:
                    onRequestSync(data.Sender);
                    break;
                case syncState.messageTypes.STATE:
                    onReceiveState(data.Sender, item);
                    break;
                case syncState.messageTypes.DANMU:
                    onReceiveDanmu(data.Sender, item);
                    break;
            }
        });
    }

    // 更新觀看者列表（移除不在房間的用戶）
    function updateWatchers() {
        if (CurrentScreen === "ChatRoom") {
            // 只保留在房間內的觀看者
            syncState.watchers = syncState.watchers.filter(
                watcher => ChatRoomCharacter.findIndex(
                    c => c.MemberNumber === watcher.MemberNumber
                ) >= 0
            );
        } else {
            // 不在聊天室時清空觀看者列表
            syncState.watchers = [];
        }
    }

    // 處理玩家進入房間
    function handlePlayerEnter(data) {
        const playerState = player.getState();
        
        if (playerState.enabled && 
            data.Type === "Action" &&
            data.Content === "ServerEnter" &&
            data.Sender !== Player.MemberNumber) {
            // 新玩家進入時發送狀態
            sendState();
        }

        // 自己進入新房間時重置本地消息狀態
        if (data.Type === "Action" &&
            data.Content === "ServerEnter" &&
            data.Sender === Player.MemberNumber) {
            syncState.localMsgPlayingName = "";
            syncState.localMsgPlayingRoom = "";
        }
    }

    // 檢查是否有人正在播放
    function isAnyoneWatching() {
        const playerState = player.getState();
        const selfPlaying = playerState.enabled && 
                           player.getCurrentPlayItem()?.name;
        const othersPlaying = syncState.watchers.length > 0 && 
                             syncState.watchers.some(w => w.PlayingName);
        
        return selfPlaying || othersPlaying;
    }

    // 獲取正在播放的內容名稱
    function getCurrentPlayingName() {
        const playerState = player.getState();
        
        if (playerState.enabled) {
            const currentItem = player.getCurrentPlayItem();
            if (currentItem?.name) return currentItem.name;
        }
        
        // 查找其他觀看者正在播放的內容
        const playingWatcher = syncState.watchers.find(w => w.PlayingName);
        return playingWatcher?.PlayingName || '';
    }

    // 檢查修改權限
    function hasModifyPermission() {
        return ChatRoomPlayerIsAdmin && ChatRoomPlayerIsAdmin();
    }

    // 獲取觀看者狀態（用於顯示圖標）
    function getWatcherStatus(memberNumber) {
        if (!memberNumber) return null;
        
        const playerState = player.getState();
        const selfWatching = playerState.enabled && memberNumber === Player.MemberNumber;
        const inWatchers = syncState.watchers.findIndex(
            w => w.MemberNumber === memberNumber
        ) >= 0;
        
        return selfWatching || inWatchers;
    }

    // 公開API
    return {
        initialize,
        
        // 同步功能
        sendSyncPlay,
        sendSyncList,
        requestSync,
        sendState,
        updateSyncTime,
        
        // 彈幕功能
        sendDanmu,
        sendDanmuToPlayer,
        clearDanmuCache,
        handleChatDanmu,
        
        // 消息處理
        handleMediaMessage,
        handlePlayerEnter,
        
        // 狀態查詢
        updateWatchers,
        isAnyoneWatching,
        getCurrentPlayingName,
        getWatcherStatus,
        getWatchers: () => [...syncState.watchers],
        
        // 常數
        messageTypes: syncState.messageTypes
    };

})();
