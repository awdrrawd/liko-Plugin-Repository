// ui-manager.js - UI管理模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== UI管理器類 ====================
    class UIManager {
        constructor() {
            this.mediaPlayer = null;
            this.container = null;
            this.titleElement = null;
            this.progressBar = null;
            this.volumeSlider = null;
            this.playButton = null;
            this.sidebar = null;
            this.videoContainer = null;
            
            this.isDragging = false;
            this.isResizing = false;
            this.dragOffset = { x: 0, y: 0 };
            this.previousPosition = null;
            
            this.styles = null;
            this.notifications = new Set();
            
            this.isMobile = window.BCMedia.Utils.isMobile();
        }

        // ==================== 模塊設置 ====================
        setMediaPlayer(mediaPlayer) {
            this.mediaPlayer = mediaPlayer;
        }

        // ==================== 主要創建方法 ====================
        async create() {
            console.log('[UI管理器] 開始創建界面');
            if (!document.body) {
                console.error('[UI管理器] document.body 未準備好');
                throw new Error('DOM 未準備好');
            }
        
            this.createStyles();
            this.createContainer();
            this.createTitleBar();
            this.createContent();
            this.createAddLinkUI(); // 確保新增連結 UI
            this.setupDragAndResize();
            this.bindEvents();
            
            // 確保容器附加到 DOM
            try {
                document.body.appendChild(this.container);
                console.log('[UI管理器] 容器已附加到 DOM:', this.container);
            } catch (error) {
                console.error('[UI管理器] 附加容器失敗:', error);
                throw error;
            }
            
            // 恢復位置
            this.restorePosition();
            
            // 檢查容器是否可見
            const computedStyle = window.getComputedStyle(this.container);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
                console.warn('[UI管理器] 容器不可見，檢查 CSS');
                this.container.style.display = 'block';
                this.container.style.visibility = 'visible';
            }
            
            console.log('[UI管理器] 界面創建完成');
        }

        // ==================== 樣式創建 ====================
        createStyles() {
            if (this.styles) return;
            
            this.styles = document.createElement('style');
            this.styles.textContent = `
                .${window.BCMedia.Constants.CSS_CLASSES.CONTAINER} {
                    position: fixed;
                    border: 1px solid #333;
                    border-radius: 12px;
                    overflow: hidden;
                    background: linear-gradient(145deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.7), 0 5px 15px rgba(0,0,0,0.4);
                    z-index: ${window.BCMedia.Constants.UI.Z_INDEX.PLAYER};
                    resize: both;
                    min-width: ${window.BCMedia.Constants.UI.MIN_WIDTH}px;
                    min-height: ${window.BCMedia.Constants.UI.MIN_HEIGHT}px;
                    backdrop-filter: blur(15px);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.CONTAINER}:hover {
                    box-shadow: 0 20px 45px rgba(0,0,0,0.8), 0 8px 20px rgba(0,0,0,0.5);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.CONTAINER}.${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} {
                    resize: none;
                    border-radius: 8px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.TITLEBAR} {
                    background: linear-gradient(135deg, #2a2a2a 0%, #3a3a3a 50%, #2a2a2a 100%);
                    padding: 12px 16px;
                    cursor: move;
                    color: #ffffff;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    position: relative;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    user-select: none;
                }

                .media-player-title-text {
                    flex: 1;
                    margin: 0 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    font-size: 14px;
                    color: #e0e0e0;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.BUTTON} {
                    background: rgba(255,255,255,0.15);
                    border: 1px solid rgba(255,255,255,0.2);
                    color: white;
                    padding: 6px 12px;
                    margin: 0 3px;
                    cursor: pointer;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    backdrop-filter: blur(10px);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.BUTTON}:hover {
                    background: rgba(255,255,255,0.25);
                    border-color: rgba(255,255,255,0.3);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.BUTTON}:active {
                    transform: translateY(0);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.CONTENT} {
                    display: flex;
                    height: calc(100% - 60px);
                    position: relative;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.VIDEO_AREA} {
                    flex: 1;
                    position: relative;
                    background: #000;
                    display: flex;
                    flex-direction: column;
                }

                .media-player-video-container {
                    flex: 1;
                    position: relative;
                    background: #000;
                }

                .media-player-video-container video,
                .media-player-video-container audio {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }

                .media-player-controls {
                    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%);
                    padding: 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                    backdrop-filter: blur(10px);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.VIDEO_AREA}:hover .media-player-controls {
                    opacity: 1;
                }

                .media-player-progress-container {
                    flex: 1;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                    cursor: pointer;
                    position: relative;
                }

                .media-player-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #00d4aa, #00a8cc);
                    border-radius: 2px;
                    transition: width 0.1s ease;
                    position: relative;
                }

                .media-player-progress-bar::after {
                    content: '';
                    position: absolute;
                    right: -6px;
                    top: -4px;
                    width: 12px;
                    height: 12px;
                    background: #ffffff;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .media-player-progress-container:hover .media-player-progress-bar::after {
                    opacity: 1;
                }

                .media-player-volume-container {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .media-player-volume-slider {
                    width: 80px;
                    height: 4px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 2px;
                    cursor: pointer;
                    position: relative;
                }

                .media-player-volume-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #00d4aa, #00a8cc);
                    border-radius: 2px;
                    transition: width 0.1s ease;
                }

                .media-player-time-display {
                    color: white;
                    font-size: 12px;
                    font-weight: 500;
                    min-width: 80px;
                    text-align: center;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR} {
                    width: ${window.BCMedia.Constants.UI.SIDEBAR_WIDTH}px;
                    background: linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%);
                    overflow-y: auto;
                    border-left: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    transition: width 0.3s ease;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR}.hidden {
                    width: 0;
                    overflow: hidden;
                }

                .media-player-sidebar-header {
                    padding: 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    font-weight: 600;
                    font-size: 14px;
                    background: rgba(255,255,255,0.05);
                }

                .media-player-playlist {
                    flex: 1;
                    overflow-y: auto;
                }

                .media-player-playlist-item {
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #cccccc;
                }

                .media-player-playlist-item:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }

                .media-player-playlist-item.active {
                    background: linear-gradient(135deg, rgba(0, 212, 170, 0.2), rgba(0, 168, 204, 0.2));
                    color: white;
                    font-weight: 600;
                    border-left: 3px solid #00d4aa;
                }

                .media-player-playlist-item .item-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    background: rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }

                .media-player-playlist-item .item-info {
                    flex: 1;
                    min-width: 0;
                }

                .media-player-playlist-item .item-title {
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .media-player-playlist-item .item-duration {
                    font-size: 11px;
                    color: rgba(255,255,255,0.6);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION} {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 16px 24px;
                    border-radius: 8px;
                    color: white;
                    z-index: ${window.BCMedia.Constants.UI.Z_INDEX.NOTIFICATION};
                    animation: slideInRight 0.3s ease;
                    backdrop-filter: blur(15px);
                    font-weight: 500;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                    max-width: 300px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION}.error {
                    background: linear-gradient(135deg, rgba(231, 76, 60, 0.9), rgba(192, 57, 43, 0.9));
                    border-left: 4px solid #e74c3c;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION}.success {
                    background: linear-gradient(135deg, rgba(39, 174, 96, 0.9), rgba(46, 204, 113, 0.9));
                    border-left: 4px solid #27ae60;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION}.info {
                    background: linear-gradient(135deg, rgba(52, 152, 219, 0.9), rgba(41, 128, 185, 0.9));
                    border-left: 4px solid #3498db;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION}.warning {
                    background: linear-gradient(135deg, rgba(243, 156, 18, 0.9), rgba(230, 126, 34, 0.9));
                    border-left: 4px solid #f39c12;
                }

                @keyframes slideInRight {
                    from { 
                        transform: translateX(100%); 
                        opacity: 0;
                    }
                    to { 
                        transform: translateX(0); 
                        opacity: 1;
                    }
                }

                @keyframes slideOutRight {
                    from { 
                        transform: translateX(0); 
                        opacity: 1;
                    }
                    to { 
                        transform: translateX(100%); 
                        opacity: 0;
                    }
                }

                /* 迷你模式樣式 */
                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR} {
                    display: none;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .${window.BCMedia.Constants.CSS_CLASSES.CONTENT} {
                    height: calc(100% - 45px);
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .${window.BCMedia.Constants.CSS_CLASSES.TITLEBAR} {
                    padding: 8px 12px;
                    font-size: 12px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .${window.BCMedia.Constants.CSS_CLASSES.BUTTON} {
                    padding: 4px 8px;
                    font-size: 11px;
                    margin: 0 2px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .media-player-title-text {
                    font-size: 12px;
                    margin: 0 8px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .media-player-controls {
                    padding: 8px;
                    gap: 8px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.MINI_MODE} .media-player-time-display {
                    font-size: 10px;
                    min-width: 60px;
                }

                /* 緊湊模式樣式 */
                .${window.BCMedia.Constants.CSS_CLASSES.COMPACT_MODE} .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR} {
                    width: ${window.BCMedia.Constants.UI.SIDEBAR_MIN_WIDTH}px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.COMPACT_MODE} .media-player-playlist-item {
                    padding: 8px 12px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.COMPACT_MODE} .media-player-playlist-item .item-icon {
                    width: 24px;
                    height: 24px;
                    font-size: 12px;
                }

                /* 響應式設計 */
                @media (max-width: 768px) {
                    .${window.BCMedia.Constants.CSS_CLASSES.CONTAINER} {
                        border-radius: 8px;
                    }
                    
                    .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR} {
                        width: 250px;
                    }
                    
                    .media-player-controls {
                        padding: 12px;
                        gap: 8px;
                    }
                    
                    .media-player-volume-slider {
                        width: 60px;
                    }
                }

                /* 滾動條樣式 */
                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR}::-webkit-scrollbar,
                .media-player-playlist::-webkit-scrollbar {
                    width: 8px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR}::-webkit-scrollbar-track,
                .media-player-playlist::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR}::-webkit-scrollbar-thumb,
                .media-player-playlist::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.3);
                    border-radius: 4px;
                }

                .${window.BCMedia.Constants.CSS_CLASSES.SIDEBAR}::-webkit-scrollbar-thumb:hover,
                .media-player-playlist::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.5);
                }
            `;
            
            document.head.appendChild(this.styles);
        }

        // ==================== 容器創建 ====================
        createContainer() {
            this.container = document.createElement('div');
            this.container.className = window.BCMedia.Constants.CSS_CLASSES.CONTAINER;
            
            // 設置初始大小和位置
            const config = window.BCMedia.Constants.getModeConfig(
                window.BCMedia.Constants.MODES.NORMAL, 
                this.isMobile
            );
            
            this.container.style.width = config.width;
            this.container.style.height = config.height;
            this.container.style.left = this.isMobile ? '5%' : '20%';
            this.container.style.top = this.isMobile ? '5%' : '10%';
        }

        // ==================== 標題欄創建 ====================
        createTitleBar() {
            const titleBar = document.createElement('div');
            titleBar.className = window.BCMedia.Constants.CSS_CLASSES.TITLEBAR;

            // 同步按鈕
            const syncBtn = this.createButton('🔄', '手動同步', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.requestSync();
                    this.setTitle("手動同步中...");
                }
            });

            // 迷你模式按鈕
            const miniBtn = this.createButton('📱', '迷你模式', () => {
                this.toggleMiniMode();
            });

            // 標題文字
            this.titleElement = document.createElement('span');
            this.titleElement.className = 'media-player-title-text';
            this.titleElement.textContent = '暫無播放中';

            // 側邊欄切換按鈕
            const sidebarBtn = this.createButton('>|', '切換側邊欄', () => {
                this.toggleSidebar();
            });

            // 關閉按鈕
            const closeBtn = this.createButton('✖', '關閉', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.exit();
                }
            });

            titleBar.appendChild(syncBtn);
            titleBar.appendChild(miniBtn);
            titleBar.appendChild(this.titleElement);
            titleBar.appendChild(sidebarBtn);
            titleBar.appendChild(closeBtn);

            this.container.appendChild(titleBar);
        }

        // ==================== 內容區域創建 ====================
        createContent() {
            const content = document.createElement('div');
            content.className = window.BCMedia.Constants.CSS_CLASSES.CONTENT;

            // 創建視頻區域
            this.createVideoArea(content);
            
            // 創建側邊欄
            this.createSidebar(content);

            this.container.appendChild(content);
        }

        createAddLinkUI() {
            console.log('[UI管理器] 創建新增連結 UI');
            const addContainer = document.createElement('div');
            addContainer.className = 'media-player-add-link';
            addContainer.style.padding = '10px';
            addContainer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
            addContainer.style.background = 'rgba(0,0,0,0.8)';
            addContainer.style.zIndex = window.BCMedia.Constants.UI.Z_INDEX.PLAYER + 1;
        
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '輸入影片連結 (MP4, MP3 等)';
            input.style.width = '70%';
            input.style.padding = '8px';
            input.style.borderRadius = '4px';
            input.style.border = '1px solid #ccc';
            addContainer.appendChild(input);
        
            const button = document.createElement('button');
            button.textContent = '新增並播放';
            button.className = window.BCMedia.Constants.CSS_CLASSES.BUTTON;
            button.style.marginLeft = '10px';
            button.onclick = () => {
                console.log('[UI管理器] 新增連結按鈕點擊');
                const url = window.BCMedia.Utils.normalizeUrl(input.value);
                if (!window.BCMedia.Utils.isValidUrl(url)) {
                    this.showError('無效的連結');
                    return;
                }
                if (!window.BCMedia.Constants.isSupportedFormat(url)) {
                    this.showError('不支援的格式');
                    return;
                }
        
                const id = window.BCMedia.Utils.generateShortId();
                const name = url.split('/').pop() || '未知影片';
                this.mediaPlayer.videoList.push({ id, url, name, duration: 0 });
        
                this.updatePlaylist();
                if (this.mediaPlayer.networkManager) {
                    this.mediaPlayer.networkManager.sendSyncList();
                }
        
                this.mediaPlayer.playId(id);
                input.value = '';
            };
            addContainer.appendChild(button);
        
            if (this.sidebar) {
                this.sidebar.appendChild(addContainer);
            } else if (this.content) {
                this.content.appendChild(addContainer);
            } else {
                console.warn('[UI管理器] 無法附加新增連結 UI，缺少 sidebar 或 content');
            }
        }
        
        createVideoArea(parent) {
            const videoArea = document.createElement('div');
            videoArea.className = window.BCMedia.Constants.CSS_CLASSES.VIDEO_AREA;

            // 視頻容器
            this.videoContainer = document.createElement('div');
            this.videoContainer.className = 'media-player-video-container';
            
            // 控制欄
            const controls = this.createControls();
            
            videoArea.appendChild(this.videoContainer);
            videoArea.appendChild(controls);
            
            parent.appendChild(videoArea);
        }

        createControls() {
            const controls = document.createElement('div');
            controls.className = 'media-player-controls';

            // 播放按鈕
            this.playButton = this.createButton('▶', '播放/暫停', () => {
                if (this.mediaPlayer) {
                    if (this.mediaPlayer.state.playing) {
                        this.mediaPlayer.pause();
                    } else {
                        this.mediaPlayer.play();
                    }
                }
            });

            // 上一首按鈕
            const prevBtn = this.createButton('⏮', '上一首', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.playPrev();
                }
            });

            // 下一首按鈕
            const nextBtn = this.createButton('⏭', '下一首', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.playNext();
                }
            });

            // 進度條
            const progressContainer = this.createProgressBar();

            // 時間顯示
            this.timeDisplay = document.createElement('div');
            this.timeDisplay.className = 'media-player-time-display';
            this.timeDisplay.textContent = '00:00 / 00:00';

            // 音量控制
            const volumeContainer = this.createVolumeControl();

            controls.appendChild(prevBtn);
            controls.appendChild(this.playButton);
            controls.appendChild(nextBtn);
            controls.appendChild(progressContainer);
            controls.appendChild(this.timeDisplay);
            controls.appendChild(volumeContainer);

            return controls;
        }

        createProgressBar() {
            const container = document.createElement('div');
            container.className = 'media-player-progress-container';

            this.progressBar = document.createElement('div');
            this.progressBar.className = 'media-player-progress-bar';
            this.progressBar.style.width = '0%';

            container.appendChild(this.progressBar);

            // 點擊跳轉
            container.addEventListener('click', (e) => {
                if (!this.mediaPlayer || !this.mediaPlayer.state.duration) return;
                
                const rect = container.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const time = percent * this.mediaPlayer.state.duration;
                
                this.mediaPlayer.seek(time);
            });

            return container;
        }

        createVolumeControl() {
            const container = document.createElement('div');
            container.className = 'media-player-volume-container';

            // 靜音按鈕
            const muteBtn = this.createButton('🔊', '靜音/取消靜音', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.toggleMute();
                }
            });

            // 音量滑塊
            const volumeContainer = document.createElement('div');
            volumeContainer.className = 'media-player-volume-slider';

            this.volumeBar = document.createElement('div');
            this.volumeBar.className = 'media-player-volume-bar';
            this.volumeBar.style.width = '80%';

            volumeContainer.appendChild(this.volumeBar);

            // 音量控制
            volumeContainer.addEventListener('click', (e) => {
                if (!this.mediaPlayer) return;
                
                const rect = volumeContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                const volume = Math.max(0, Math.min(1, percent));
                
                this.mediaPlayer.setVolume(volume);
            });

            container.appendChild(muteBtn);
            container.appendChild(volumeContainer);

            return container;
        }

        createSidebar(parent) {
            this.sidebar = document.createElement('div');
            this.sidebar.className = window.BCMedia.Constants.CSS_CLASSES.SIDEBAR;

            // 側邊欄標題
            const header = document.createElement('div');
            header.className = 'media-player-sidebar-header';
            header.textContent = '播放列表';

            // 播放列表
            this.playlist = document.createElement('div');
            this.playlist.className = 'media-player-playlist';

            this.sidebar.appendChild(header);
            this.sidebar.appendChild(this.playlist);

            parent.appendChild(this.sidebar);
        }

        // ==================== 輔助創建方法 ====================
        createButton(text, title, onclick) {
            const btn = document.createElement('button');
            btn.className = window.BCMedia.Constants.CSS_CLASSES.BUTTON;
            btn.innerHTML = text;
            btn.title = title;
            btn.addEventListener('click', onclick);
            return btn;
        }

        // ==================== 拖拽和縮放 ====================
        setupDragAndResize() {
            const titleBar = this.container.querySelector('.' + window.BCMedia.Constants.CSS_CLASSES.TITLEBAR);
            
            // 拖拽功能
            titleBar.addEventListener('mousedown', (e) => {
                this.startDragging(e);
            });

            titleBar.addEventListener('touchstart', (e) => {
                this.startDragging(e.touches[0]);
            });

            // 全域移動和釋放事件
            document.addEventListener('mousemove', (e) => {
                this.handleDragging(e);
            });

            document.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1) {
                    this.handleDragging(e.touches[0]);
                }
            });

            document.addEventListener('mouseup', () => {
                this.stopDragging();
            });

            document.addEventListener('touchend', () => {
                this.stopDragging();
            });
        }

        startDragging(e) {
            this.isDragging = true;
            const rect = this.container.getBoundingClientRect();
            this.dragOffset.x = e.clientX - rect.left;
            this.dragOffset.y = e.clientY - rect.top;
            
            document.body.style.userSelect = 'none';
            this.container.style.transition = 'none';
        }

        handleDragging(e) {
            if (!this.isDragging) return;
            
            const newLeft = Math.max(0, e.clientX - this.dragOffset.x);
            const newTop = Math.max(0, e.clientY - this.dragOffset.y);
            
            const maxLeft = window.innerWidth - this.container.offsetWidth;
            const maxTop = window.innerHeight - this.container.offsetHeight;
            
            this.container.style.left = Math.min(newLeft, maxLeft) + 'px';
            this.container.style.top = Math.min(newTop, maxTop) + 'px';
        }

        stopDragging() {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            document.body.style.userSelect = '';
            this.container.style.transition = '';
            
            this.savePosition();
        }

        // ==================== 模式切換 ====================
        switchMode(mode) {
            // 移除所有模式類
            this.container.classList.remove(
                window.BCMedia.Constants.CSS_CLASSES.MINI_MODE,
                window.BCMedia.Constants.CSS_CLASSES.COMPACT_MODE,
                window.BCMedia.Constants.CSS_CLASSES.FULLSCREEN_MODE
            );

            const config = window.BCMedia.Constants.getModeConfig(mode, this.isMobile);
            
            switch (mode) {
                case window.BCMedia.Constants.MODES.MINI:
                    this.container.classList.add(window.BCMedia.Constants.CSS_CLASSES.MINI_MODE);
                    this.container.style.width = config.width;
                    this.container.style.height = config.height;
                    this.container.style.resize = 'none';
                    break;
                    
                case window.BCMedia.Constants.MODES.COMPACT:
                    this.container.classList.add(window.BCMedia.Constants.CSS_CLASSES.COMPACT_MODE);
                    this.container.style.width = config.width;
                    this.container.style.height = config.height;
                    this.container.style.resize = 'both';
                    break;
                    
                case window.BCMedia.Constants.MODES.NORMAL:
                default:
                    this.container.style.width = config.width;
                    this.container.style.height = config.height;
                    this.container.style.resize = 'both';
                    break;
            }
            
            this.savePosition();
        }

        toggleMiniMode() {
            const currentMode = this.mediaPlayer ? this.mediaPlayer.currentMode : window.BCMedia.Constants.MODES.NORMAL;
            const newMode = currentMode === window.BCMedia.Constants.MODES.MINI 
                ? window.BCMedia.Constants.MODES.NORMAL 
                : window.BCMedia.Constants.MODES.MINI;
            
            if (this.mediaPlayer) {
                this.mediaPlayer.switchMode(newMode);
            }
        }

        toggleSidebar() {
            if (this.sidebar) {
                this.sidebar.classList.toggle('hidden');
            }
        }

        // ==================== 更新方法 ====================
        setTitle(title) {
            if (this.titleElement) {
                this.titleElement.textContent = title || '暫無播放中';
            }
        }

        updateProgress(state) {
            // 更新進度條
            if (this.progressBar && state.duration > 0) {
                const percent = (state.currentTime / state.duration) * 100;
                this.progressBar.style.width = percent + '%';
            }

            // 更新時間顯示
            if (this.timeDisplay) {
                const current = window.BCMedia.Utils.formatTime(state.currentTime);
                const duration = window.BCMedia.Utils.formatTime(state.duration);
                this.timeDisplay.textContent = `${current} / ${duration}`;
            }

            // 更新音量條
            if (this.volumeBar) {
                this.volumeBar.style.width = (state.volume * 100) + '%';
            }

            // 更新播放按鈕
            if (this.playButton) {
                this.playButton.innerHTML = state.playing ? '⏸' : '▶';
                this.playButton.title = state.playing ? '暫停' : '播放';
            }
        }

        updatePlaylist() {
            if (!this.playlist || !this.mediaPlayer) return;

            this.playlist.innerHTML = '';

            this.mediaPlayer.videoList.forEach(item => {
                const element = this.createPlaylistItem(item);
                this.playlist.appendChild(element);
            });
        }

        createPlaylistItem(item) {
            const element = document.createElement('div');
            element.className = 'media-player-playlist-item';
            
            if (item.id === this.mediaPlayer.playingId) {
                element.classList.add('active');
            }

            // 圖標
            const icon = document.createElement('div');
            icon.className = 'item-icon';
            
            // 根據格式顯示不同圖標
            if (window.BCMedia.Constants.isVideoFormat(item.url)) {
                icon.textContent = '🎥';
            } else if (window.BCMedia.Constants.isAudioFormat(item.url)) {
                icon.textContent = '🎵';
            } else {
                icon.textContent = '📄';
            }

            // 信息
            const info = document.createElement('div');
            info.className = 'item-info';

            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.name;

            const duration = document.createElement('div');
            duration.className = 'item-duration';
            duration.textContent = item.duration ? window.BCMedia.Utils.formatTime(item.duration) : '未知時長';

            info.appendChild(title);
            info.appendChild(duration);

            element.appendChild(icon);
            element.appendChild(info);

            // 點擊播放
            element.addEventListener('click', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.playId(item.id);
                }
            });

            return element;
        }

        // ==================== 通知系統 ====================
        showNotification(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.className = `${window.BCMedia.Constants.CSS_CLASSES.NOTIFICATION} ${type}`;
            notification.textContent = message;

            document.body.appendChild(notification);
            this.notifications.add(notification);

            // 自動移除
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);

            return notification;
        }

        removeNotification(notification) {
            if (notification && notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                    this.notifications.delete(notification);
                }, 300);
            }
        }

        showError(message) {
            this.showNotification(message, 'error', 5000);
        }

        showSuccess(message) {
            this.showNotification(message, 'success');
        }

        showWarning(message) {
            this.showNotification(message, 'warning', 4000);
        }

        // ==================== 事件處理 ====================
        bindEvents() {
            // 保存移除函數
            this.resizeListener = window.BCMedia.Utils.debounce(() => {
                this.handleResize();
            }, 250);
            window.addEventListener('resize', this.resizeListener);
        }
        
        handleResize() {
            if (!this.container) return;

            // 確保播放器在可視區域內
            const rect = this.container.getBoundingClientRect();
            const maxLeft = window.innerWidth - rect.width;
            const maxTop = window.innerHeight - rect.height;

            if (rect.left > maxLeft) {
                this.container.style.left = Math.max(0, maxLeft) + 'px';
            }

            if (rect.top > maxTop) {
                this.container.style.top = Math.max(0, maxTop) + 'px';
            }
        }

        // ==================== 位置保存和恢復 ====================
        savePosition() {
            if (!this.container) return;

            const position = {
                left: this.container.style.left,
                top: this.container.style.top,
                width: this.container.style.width,
                height: this.container.style.height
            };

            window.BCMedia.Utils.setLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.POSITION,
                position
            );
        }

        restorePosition() {
            const position = window.BCMedia.Utils.getLocalData(
                window.BCMedia.Constants.STORAGE_KEYS.POSITION
            );

            if (position && this.container) {
                if (position.left) this.container.style.left = position.left;
                if (position.top) this.container.style.top = position.top;
                if (position.width) this.container.style.width = position.width;
                if (position.height) this.container.style.height = position.height;
            }
        }

        // ==================== 播放器容器獲取 ====================
        getVideoContainer() {
            return this.videoContainer;
        }

        // ==================== 清理方法 ====================
        destroy() {
            // 清理通知
            this.notifications.forEach(notification => {
                this.removeNotification(notification);
            });
            this.notifications.clear();
        
            // 移除容器
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }
        
            // 移除樣式
            if (this.styles && this.styles.parentNode) {
                this.styles.parentNode.removeChild(this.styles);
            }
        
            // 移除事件監聽器
            if (this.resizeListener) {
                window.removeEventListener('resize', this.resizeListener);
                this.resizeListener = null;
            }
        
            // 重置引用
            this.container = null;
            this.titleElement = null;
            this.progressBar = null;
            this.volumeSlider = null;
            this.playButton = null;
            this.sidebar = null;
            this.videoContainer = null;
        
            console.log('[UI管理器] 清理完成');
        }

    // 註冊到全域命名空間
    window.BCMedia.UIManager = UIManager;

    console.log('[BC增強媒體] UI管理器模塊載入完成');
})();
