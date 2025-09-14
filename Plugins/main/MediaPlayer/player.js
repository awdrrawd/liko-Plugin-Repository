/**
 * BC Enhanced Media - Player Module
 * 播放器核心和UI管理模組
 */

window.BCEnhancedMedia = window.BCEnhancedMedia || {};
window.BCEnhancedMedia.Player = (function() {
    'use strict';

    const helpers = window.BCEnhancedMedia.Helpers;
    const validation = window.BCEnhancedMedia.Validation;

    // 播放器狀態
    const playerState = {
        enabled: false,
        mode: 'full', // 'full' | 'mini' | 'ball'
        miniExpanded: false,
        currentPlayingId: '',
        playList: [],
        artPlayer: null,
        floatingDiv: null,
        miniDiv: null,
        callbacks: {},
        settings: {
            autoplay: true,
            volume: 0.5,
            muted: false,
            danmuEnabled: true,
            position: { x: 0, y: 0 },
            miniPosition: { x: window.innerWidth - 100, y: 50 }
        },
        // 同步相關
        syncData: {
            syncListTime: 0,
            syncPlayTime: 0,
            playTimeBySync: 0,
            pausedBySync: false,
            needSetSync: false
        },
        // 標記避免回調循環
        preventCallback: false,
        preventSeekCallback: false
    };

    // 必要的外部庫URL
    const REQUIRED_SCRIPTS = [
        'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js',
        'https://cdn.jsdelivr.net/npm/artplayer-plugin-danmuku/dist/artplayer-plugin-danmuku.js',
        'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.14.0/Sortable.min.js'
    ];

    // 初始化播放器
    async function initialize() {
        try {
            // 載入必要腳本
            await Promise.all(REQUIRED_SCRIPTS.map(url => helpers.loadScript(url)));
            
            // 設置回調函數
            setupCallbacks();
            
            console.log('[BC Enhanced Media] Player module initialized');
            return true;
        } catch (error) {
            console.error('[BC Enhanced Media] Failed to initialize player:', error);
            return false;
        }
    }

    // 設置回調函數
    function setupCallbacks() {
        playerState.callbacks = {
            onPlay: function() {
                if (playerState.preventCallback) return;
                updateSyncTime();
                if (window.BCEnhancedMedia.Sync) {
                    window.BCEnhancedMedia.Sync.sendSyncPlay();
                }
            },
            
            onPause: function() {
                if (playerState.preventCallback) return;
                updateSyncTime();
                if (window.BCEnhancedMedia.Sync) {
                    window.BCEnhancedMedia.Sync.sendSyncPlay();
                }
            },
            
            onSeeked: function() {
                if (playerState.preventSeekCallback) {
                    playerState.preventSeekCallback = false;
                    return;
                }
                updateSyncTime();
                if (window.BCEnhancedMedia.Sync) {
                    window.BCEnhancedMedia.Sync.sendSyncPlay();
                }
            },
            
            onReady: function() {
                trySetSyncPlay();
            },
            
            onEnded: function() {
                playNextInList();
            },
            
            onDanmuEmit: function(danmu) {
                if (playerState.preventCallback) return;
                danmu.border = false;
                if (window.BCEnhancedMedia.Sync) {
                    window.BCEnhancedMedia.Sync.sendDanmu(danmu);
                }
            }
        };
    }

    // 創建完整模式播放器
    function createFullPlayer() {
        if (playerState.floatingDiv) {
            destroyFullPlayer();
        }

        const floatingDiv = document.createElement('div');
        floatingDiv.id = 'bc-media-player';
        floatingDiv.className = 'bc-media-floating-player';
        
        // 設置基本樣式
        Object.assign(floatingDiv.style, {
            position: 'fixed',
            border: '1px solid #ccc',
            overflow: 'hidden',
            backgroundColor: '#000',
            resize: 'both',
            padding: '0',
            zIndex: '1000',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        });

        // 響應式尺寸
        if (helpers.isMobile()) {
            Object.assign(floatingDiv.style, {
                width: '90vw',
                height: '60vh',
                left: '5vw',
                top: '10vh'
            });
        } else {
            Object.assign(floatingDiv.style, {
                width: '60vw',
                height: '70vh',
                left: '20vw',
                top: '10vh'
            });
        }

        helpers.preventTextSelection(floatingDiv);

        // 創建標題欄
        const titleBar = createTitleBar();
        floatingDiv.appendChild(titleBar);

        // 創建主內容區域（現在不初始化 ArtPlayer）
        const contentArea = createContentArea();
        floatingDiv.appendChild(contentArea);
    
        // 添加到 DOM
        document.body.appendChild(floatingDiv);
        playerState.floatingDiv = floatingDiv;
    
        // DOM 添加後初始化 ArtPlayer
        createArtPlayer('bc-media-video-container');

        // 設置拖拽功能
        setupDragFunctionality(floatingDiv, titleBar);

        return floatingDiv;
    }

    // 創建標題欄
    function createTitleBar() {
        const titleBar = document.createElement('div');
        titleBar.className = 'bc-media-title-bar';
        
        Object.assign(titleBar.style, {
            position: 'relative',
            backgroundColor: '#1a1a1a',
            padding: '8px 12px',
            cursor: 'move',
            color: '#fff',
            borderBottom: '1px solid #333',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none'
        });

        // 同步按鈕
        const syncBtn = createButton('🔄', '手動同步', () => {
            if (window.BCEnhancedMedia.Sync) {
                window.BCEnhancedMedia.Sync.requestSync(true);
            }
            updateTitle('手動同步中...');
        });
        titleBar.appendChild(syncBtn);

        // 標題文字
        const titleText = document.createElement('span');
        titleText.className = 'bc-media-title-text';
        titleText.textContent = '暫無播放中';
        titleText.style.marginLeft = '12px';
        titleText.style.flex = '1';
        titleText.style.color = '#fff';
        titleBar.appendChild(titleText);

        // 右側按鈕組
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '4px';

        // 播放列表切換按鈕
        const togglePlaylistBtn = createButton('☰', '切換播放列表', () => {
            togglePlaylist();
        });
        btnGroup.appendChild(togglePlaylistBtn);

        // 迷你模式按鈕
        const miniBtn = createButton('◐', '迷你模式', () => {
            switchToMiniMode();
        });
        btnGroup.appendChild(miniBtn);

        // 關閉按鈕
        const closeBtn = createButton('✕', '關閉', () => {
            exitPlayer();
        });
        btnGroup.appendChild(closeBtn);

        titleBar.appendChild(btnGroup);
        return titleBar;
    }

    // 創建按鈕輔助函數
    function createButton(text, title, onClick) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.title = title;
        btn.onclick = onClick;
        
        Object.assign(btn.style, {
            padding: '6px 10px',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.1)',
            color: '#fff',
            cursor: 'pointer',
            borderRadius: '4px',
            fontSize: '14px',
            transition: 'background-color 0.2s'
        });

        btn.onmouseenter = () => {
            btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
        };
        btn.onmouseleave = () => {
            btn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        };

        helpers.preventTextSelection(btn);
        return btn;
    }

    // 創建主內容區域
    function createContentArea() {
        const contentArea = document.createElement('div');
        contentArea.className = 'bc-media-content';
        contentArea.style.display = 'flex';
        contentArea.style.height = 'calc(100% - 40px)';

        // 視頻播放區域
        const videoArea = document.createElement('div');
        videoArea.className = 'bc-media-video-area';
        videoArea.style.flex = '1';
        videoArea.style.position = 'relative';

        const videoContainer = document.createElement('div');
        videoContainer.id = 'bc-media-video-container';
        videoContainer.style.width = '100%';
        videoContainer.style.height = '100%';
        
        videoArea.appendChild(videoContainer);
        contentArea.appendChild(videoArea);

        // 播放列表區域
        const playlistArea = createPlaylistArea();
        contentArea.appendChild(playlistArea);

        // 創建ArtPlayer實例
        //createArtPlayer('bc-media-video-container');

        return contentArea;
    }

    // 創建ArtPlayer實例
    function createArtPlayer(containerId) {
        if (!window.Artplayer) {
            console.error('ArtPlayer not loaded');
            return;
        }

        const art = new Artplayer({
            container: `#${containerId}`,
            poster: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDgwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMTExIi8+Cjx0ZXh0IHg9IjQwMCIgeT0iMjI1IiBmaWxsPSIjNTU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LXNpemU9IjI0Ij5CQyDlop7lhLrlqZLkvZM8L3RleHQ+Cjwvc3ZnPgo=',
            autoplay: playerState.settings.autoplay,
            pip: true,
            muted: playerState.settings.muted,
            volume: playerState.settings.volume,
            fullscreen: true,
            fullscreenWeb: true,
            playsInline: true,
            plugins: []
        });

        // 添加彈幕插件（如果可用）
        if (window.artplayerPluginDanmuku && playerState.settings.danmuEnabled) {
            art.plugins.add(artplayerPluginDanmuku({
                opacity: 0.6,
                speed: 8,
                minWidth: 0,
                maxWidth: 500,
                lockTime: 1,
                color: helpers.getPlayerDefaultColor(Player),
                beforeEmit: (danmu) => !!danmu.text.trim() && art.playing
            }));
        }

        // 綁定事件
        art.on('video:pause', playerState.callbacks.onPause);
        art.on('video:play', playerState.callbacks.onPlay);
        art.on('video:seeked', playerState.callbacks.onSeeked);
        art.on('video:ended', playerState.callbacks.onEnded);
        art.on('ready', playerState.callbacks.onReady);

        if (art.plugins.artplayerPluginDanmuku) {
            art.on('artplayerPluginDanmuku:emit', playerState.callbacks.onDanmuEmit);
        }

        // 禁用一些移動端的默認行為
        if (window.Artplayer.MOBILE_CLICK_PLAY !== undefined) {
            Artplayer.MOBILE_CLICK_PLAY = false;
        }
        if (window.Artplayer.MOBILE_DBCLICK_PLAY !== undefined) {
            Artplayer.MOBILE_DBCLICK_PLAY = false;
        }

        playerState.artPlayer = art;
        helpers.preventTextSelection(art.template.$container);

        return art;
    }

    // 創建迷你模式播放器
    function createMiniPlayer() {
        if (playerState.miniDiv) {
            destroyMiniPlayer();
        }

        // 創建迷你球形按鈕
        const miniDiv = document.createElement('div');
        miniDiv.id = 'bc-media-mini-player';
        miniDiv.className = 'bc-media-mini-player';

        Object.assign(miniDiv.style, {
            position: 'fixed',
            width: '60px',
            height: '60px',
            backgroundColor: '#1a1a1a',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: '1001',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            border: '2px solid #333'
        });

        // 設置位置
        miniDiv.style.left = playerState.settings.miniPosition.x + 'px';
        miniDiv.style.top = playerState.settings.miniPosition.y + 'px';

        // 播放/暫停圖標
        const playIcon = document.createElement('div');
        playIcon.innerHTML = isPlaying() ? '⏸️' : '▶️';
        playIcon.style.fontSize = '20px';
        playIcon.style.color = '#fff';
        miniDiv.appendChild(playIcon);

        // 點擊切換播放/暫停
        miniDiv.onclick = (e) => {
            e.stopPropagation();
            if (playerState.miniExpanded) {
                collapseMiniPlayer();
            } else {
                expandMiniPlayer();
            }
        };

        helpers.preventTextSelection(miniDiv);
        document.body.appendChild(miniDiv);
        playerState.miniDiv = miniDiv;

        // 設置拖拽功能
        setupDragFunctionality(miniDiv, miniDiv);

        return miniDiv;
    }

    // 展開迷你播放器
    function expandMiniPlayer() {
        if (!playerState.miniDiv || playerState.miniExpanded) return;

        const miniDiv = playerState.miniDiv;
        playerState.miniExpanded = true;

        // 改變尺寸和形狀
        Object.assign(miniDiv.style, {
            width: '320px',
            height: '80px',
            borderRadius: '40px',
            padding: '0 20px'
        });

        // 清空內容重新創建
        miniDiv.innerHTML = '';

        // 創建內容容器
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.alignItems = 'center';
        content.style.width = '100%';
        content.style.gap = '8px';

        // 播放/暫停按鈕
        const playBtn = document.createElement('button');
        playBtn.innerHTML = isPlaying() ? '⏸️' : '▶️';
        playBtn.onclick = (e) => {
            e.stopPropagation();
            togglePlay();
        };
        styleMiniButtom(playBtn);
        content.appendChild(playBtn);

        // 標題（縮短版）
        const title = document.createElement('div');
        title.textContent = getCurrentTitle().substring(0, 15) + '...';
        title.style.flex = '1';
        title.style.color = '#fff';
        title.style.fontSize = '12px';
        title.style.overflow = 'hidden';
        content.appendChild(title);

        // 添加URL按鈕
        const addBtn = document.createElement('button');
        addBtn.innerHTML = '➕';
        addBtn.title = '添加媒體';
        addBtn.onclick = (e) => {
            e.stopPropagation();
            if (window.BCEnhancedMedia.Components) {
                window.BCEnhancedMedia.Components.showAddMediaDialog();
            }
        };
        styleMiniButtom(addBtn);
        content.appendChild(addBtn);

        // 完整模式按鈕
        const fullBtn = document.createElement('button');
        fullBtn.innerHTML = '🔲';
        fullBtn.title = '完整模式';
        fullBtn.onclick = (e) => {
            e.stopPropagation();
            switchToFullMode();
        };
        styleMiniButtom(fullBtn);
        content.appendChild(fullBtn);

        // 收起按鈕
        const collapseBtn = document.createElement('button');
        collapseBtn.innerHTML = '◀';
        collapseBtn.title = '收起';
        collapseBtn.onclick = (e) => {
            e.stopPropagation();
            collapseMiniPlayer();
        };
        styleMiniButtom(collapseBtn);
        content.appendChild(collapseBtn);

        miniDiv.appendChild(content);
    }

    // 收起迷你播放器
    function collapseMiniPlayer() {
        if (!playerState.miniDiv || !playerState.miniExpanded) return;

        const miniDiv = playerState.miniDiv;
        playerState.miniExpanded = false;

        // 恢復球形
        Object.assign(miniDiv.style, {
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            padding: '0'
        });

        // 恢復播放圖標
        miniDiv.innerHTML = '';
        const playIcon = document.createElement('div');
        playIcon.innerHTML = isPlaying() ? '⏸️' : '▶️';
        playIcon.style.fontSize = '20px';
        playIcon.style.color = '#fff';
        miniDiv.appendChild(playIcon);
    }

    // 迷你按鈕樣式
    function styleMiniButtom(btn) {
        Object.assign(btn.style, {
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '12px',
            borderRadius: '4px'
        });
        
        btn.onmouseenter = () => btn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        btn.onmouseleave = () => btn.style.backgroundColor = 'transparent';
        
        helpers.preventTextSelection(btn);
    }

    // 獲取當前標題
    function getCurrentTitle() {
        const currentItem = getCurrentPlayItem();
        return currentItem ? currentItem.name : '暫無播放中';
    }

    // 獲取當前播放項目
    function getCurrentPlayItem() {
        return playerState.playList.find(item => item.id === playerState.currentPlayingId);
    }

    // 其他輔助函數
    function isPlaying() {
        return playerState.artPlayer && playerState.artPlayer.playing;
    }

    function togglePlay() {
        if (!playerState.artPlayer) return;
        if (isPlaying()) {
            pauseVideo();
        } else {
            playVideo();
        }
    }

    function playVideo() {
        if (!playerState.artPlayer) return;
        playerState.preventCallback = true;
        const playPromise = playerState.artPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                playerState.preventCallback = false;
            }).catch(error => {
                console.error('播放失敗:', error);
                playerState.preventCallback = false;
            });
        } else {
            playerState.preventCallback = false;
        }
    }

    function pauseVideo() {
        if (!playerState.artPlayer) return;
        playerState.preventCallback = true;
        playerState.artPlayer.pause();
        playerState.preventCallback = false;
    }

    // 更新標題
    function updateTitle(title) {
        const titleElement = document.querySelector('.bc-media-title-text');
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    // 更新同步時間
    function updateSyncTime() {
        if (hasModifyPermission()) {
            playerState.syncData.syncListTime = Date.now();
            playerState.syncData.syncPlayTime = Date.now();
            playerState.syncData.playTimeBySync = getCurrentTime();
        }
    }

    // 獲取當前播放時間
    function getCurrentTime() {
        return playerState.artPlayer ? playerState.artPlayer.currentTime : 0;
    }

    // 檢查是否有修改權限
    function hasModifyPermission() {
        return ChatRoomPlayerIsAdmin && ChatRoomPlayerIsAdmin();
    }

    // 嘗試設置同步播放
    function trySetSyncPlay() {
        if (!playerState.syncData.needSetSync) return;

        const art = playerState.artPlayer;
        if (!art) return;

        // 設置播放/暫停狀態
        if (art.paused && !playerState.syncData.pausedBySync) {
            playVideo();
        } else if (!art.paused && playerState.syncData.pausedBySync) {
            pauseVideo();
        }

        // 計算目標時間
        let targetTime = playerState.syncData.playTimeBySync;
        if (!playerState.syncData.pausedBySync) {
            const timeDiff = (Date.now() - playerState.syncData.syncPlayTime) / 1000;
            targetTime += timeDiff;
        }

        // 如果時間差異超過5秒，重新同步
        if (Math.abs(art.currentTime - targetTime) > 5 && 
            targetTime < art.duration) {
            playerState.preventSeekCallback = true;
            art.currentTime = targetTime;
        }

        playerState.syncData.needSetSync = false;
    }

    // 播放下一首
    function playNextInList() {
        if (playerState.playList.length === 0) return;
        
        const currentIndex = playerState.playList.findIndex(
            item => item.id === playerState.currentPlayingId
        );
        
        if (currentIndex >= 0) {
            const nextIndex = (currentIndex + 1) % playerState.playList.length;
            playById(playerState.playList[nextIndex].id);
            updateSyncTime();
            playerState.syncData.playTimeBySync = 0;
        }
    }

    // 根據ID播放
    function playById(id) {
        const item = playerState.playList.find(item => item.id === id);
        if (!item || !playerState.artPlayer) return;

        // 驗證URL
        const validationResult = validation.validateURL(item.url);
        if (!validationResult.valid) {
            helpers.showLocalChatMsg(`播放失敗: ${validationResult.errors.join(', ')}`);
            return;
        }

        const playUrl = validation.generateSafePlayURL(item.url, validationResult);
        
        playerState.artPlayer.url = playUrl;
        playerState.currentPlayingId = id;
        updateTitle(item.name);

        // 清理彈幕
        if (playerState.artPlayer.plugins.artplayerPluginDanmuku) {
            playerState.artPlayer.plugins.artplayerPluginDanmuku.load();
        }

        // 重新渲染播放列表
        if (window.BCEnhancedMedia.Components) {
            window.BCEnhancedMedia.Components.renderPlaylist();
        }
    }

    // 模式切換
    function switchToMiniMode() {
        playerState.mode = 'mini';
        destroyFullPlayer();
        createMiniPlayer();
    }

    function switchToFullMode() {
        playerState.mode = 'full';
        destroyMiniPlayer();
        createFullPlayer();
    }

    // 切換播放列表顯示
    function togglePlaylist() {
        const playlist = document.querySelector('.bc-media-playlist-area');
        if (playlist) {
            const isHidden = playlist.style.display === 'none';
            playlist.style.display = isHidden ? 'block' : 'none';
            
            const videoArea = document.querySelector('.bc-media-video-area');
            if (videoArea) {
                videoArea.style.width = isHidden ? 'calc(100% - 300px)' : '100%';
            }
        }
    }

    // 銷毀播放器
    function destroyFullPlayer() {
        if (playerState.floatingDiv) {
            document.body.removeChild(playerState.floatingDiv);
            playerState.floatingDiv = null;
        }
        if (playerState.artPlayer) {
            playerState.artPlayer.destroy();
            playerState.artPlayer = null;
        }
    }

    function destroyMiniPlayer() {
        if (playerState.miniDiv) {
            document.body.removeChild(playerState.miniDiv);
            playerState.miniDiv = null;
        }
        playerState.miniExpanded = false;
    }

    // 完全退出播放器
    function exitPlayer() {
        playerState.enabled = false;
        destroyFullPlayer();
        destroyMiniPlayer();
        
        // 通知同步模組
        if (window.BCEnhancedMedia.Sync) {
            window.BCEnhancedMedia.Sync.sendState();
        }
    }

    // 設置拖拽功能
    function setupDragFunctionality(element, handle) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener('mousedown', (e) => {
            if (e.target !== handle && !handle.contains(e.target)) return;
            isDragging = true;
            offsetX = e.clientX - element.offsetLeft;
            offsetY = e.clientY - element.offsetTop;
            handle.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            element.style.left = e.clientX - offsetX + 'px';
            element.style.top = e.clientY - offsetY + 'px';
            
            // 保存迷你模式位置
            if (element === playerState.miniDiv) {
                playerState.settings.miniPosition = {
                    x: e.clientX - offsetX,
                    y: e.clientY - offsetY
                };
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            handle.style.cursor = 'move';
        });
    }

    // 創建播放列表區域 (簡化版，詳細實現在components.js中)
    function createPlaylistArea() {
        const playlistArea = document.createElement('div');
        playlistArea.className = 'bc-media-playlist-area';
        playlistArea.style.width = '300px';
        playlistArea.style.backgroundColor = '#0b131a';
        playlistArea.style.borderLeft = '1px solid #333';
        return playlistArea;
    }

    // 公開API
    return {
        initialize,
        
        // 播放器控制
        createFullPlayer,
        createMiniPlayer,
        exitPlayer,
        switchToMiniMode,
        switchToFullMode,
        
        // 播放控制
        playById,
        playVideo,
        pauseVideo,
        togglePlay,
        getCurrentTime,
        getCurrentPlayItem,
        isPlaying,
        
        // 狀態管理
        getState: () => ({ ...playerState }),
        updateTitle,
        updateSyncTime,
        trySetSyncPlay,
        
        // 同步相關
        setSyncData: (data) => {
            Object.assign(playerState.syncData, data);
        }
    };

})();
