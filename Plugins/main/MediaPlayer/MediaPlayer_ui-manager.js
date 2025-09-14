// ui-manager.js - UI管理模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // 修復版 UIManager，添加影片管理功能
    class EnhancedUIManager {
        constructor() {
            // 原有屬性
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
            
            this.isMobile = window.BCMedia.Utils ? window.BCMedia.Utils.isMobile() : false;
            
            // 新增：影片管理相關
            this.addVideoDialog = null;
            this.videoUrlInput = null;
            this.videoNameInput = null;
        }

        // 修復：確保重新創建時正確清理和重新初始化
        async create() {
            // 先清理可能存在的舊元素
            this.cleanup();
            
            this.createStyles();
            this.createContainer();
            this.createTitleBar();
            this.createContent();
            this.setupDragAndResize();
            this.bindEvents();
            
            document.body.appendChild(this.container);
            
            // 恢復位置
            this.restorePosition();
            
            // 確保視頻容器正確設置
            this.ensureVideoContainer();
            
            console.log('[UI管理器] 界面創建完成');
        }

        // 新增：確保視頻容器正確設置
        ensureVideoContainer() {
            if (this.mediaPlayer && this.mediaPlayer.playerContainer) {
                const targetContainer = this.videoContainer || 
                    this.container.querySelector('.media-player-video-container');
                
                if (targetContainer && this.mediaPlayer.playerContainer) {
                    // 清空現有內容
                    targetContainer.innerHTML = '';
                    // 添加播放器容器
                    targetContainer.appendChild(this.mediaPlayer.player || this.mediaPlayer.playerContainer);
                }
            }
        }

        // 修復：改進的清理方法
        cleanup() {
            // 清理通知
            this.notifications.forEach(notification => {
                this.removeNotification(notification);
            });
            this.notifications.clear();

            // 清理容器
            if (this.container && this.container.parentNode) {
                this.container.parentNode.removeChild(this.container);
            }

            // 清理對話框
            if (this.addVideoDialog && this.addVideoDialog.parentNode) {
                this.addVideoDialog.parentNode.removeChild(this.addVideoDialog);
            }

            // 重置引用
            this.container = null;
            this.titleElement = null;
            this.progressBar = null;
            this.volumeSlider = null;
            this.playButton = null;
            this.sidebar = null;
            this.videoContainer = null;
            this.addVideoDialog = null;
        }

        // 增強：修改createSidebar方法，添加影片管理功能
        createSidebar(parent) {
            this.sidebar = document.createElement('div');
            this.sidebar.className = window.BCMedia.Constants.CSS_CLASSES.SIDEBAR;

            // 側邊欄標題區域
            const headerContainer = document.createElement('div');
            headerContainer.style.display = 'flex';
            headerContainer.style.alignItems = 'center';
            headerContainer.style.justifyContent = 'space-between';
            headerContainer.style.padding = '12px 16px';
            headerContainer.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            headerContainer.style.background = 'rgba(255,255,255,0.05)';

            const header = document.createElement('div');
            header.style.color = 'white';
            header.style.fontWeight = '600';
            header.style.fontSize = '14px';
            header.textContent = '播放列表';

            // 添加影片按鈕
            const addVideoBtn = this.createButton('➕', '添加影片', () => {
                this.showAddVideoDialog();
            });
            addVideoBtn.style.padding = '4px 8px';
            addVideoBtn.style.fontSize = '12px';
            addVideoBtn.style.margin = '0';

            headerContainer.appendChild(header);
            headerContainer.appendChild(addVideoBtn);

            // 播放列表
            this.playlist = document.createElement('div');
            this.playlist.className = 'media-player-playlist';

            // 空狀態提示
            this.createEmptyStateMessage();

            this.sidebar.appendChild(headerContainer);
            this.sidebar.appendChild(this.playlist);

            parent.appendChild(this.sidebar);
        }

        // 新增：創建空狀態提示
        createEmptyStateMessage() {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'media-player-empty-state';
            emptyMessage.innerHTML = `
                <div style="
                    padding: 40px 20px;
                    text-align: center;
                    color: rgba(255,255,255,0.6);
                    font-size: 14px;
                ">
                    <div style="font-size: 48px; margin-bottom: 16px;">🎬</div>
                    <div style="margin-bottom: 8px;">暫無播放內容</div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.4);">
                        點擊上方的 ➕ 按鈕添加影片
                    </div>
                </div>
            `;
            this.playlist.appendChild(emptyMessage);
        }

        // 新增：顯示添加影片對話框
        showAddVideoDialog() {
            if (this.addVideoDialog) {
                this.addVideoDialog.style.display = 'block';
                return;
            }

            this.createAddVideoDialog();
        }

        // 新增：創建添加影片對話框
        createAddVideoDialog() {
            // 創建遮罩層
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: ${window.BCMedia.Constants.UI.Z_INDEX.MODAL};
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(5px);
            `;

            // 創建對話框
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%);
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8);
                padding: 24px;
                min-width: 400px;
                max-width: 500px;
                width: 90%;
                border: 1px solid rgba(255,255,255,0.1);
            `;

            // 標題
            const title = document.createElement('h3');
            title.style.cssText = `
                margin: 0 0 20px 0;
                color: white;
                font-size: 18px;
                font-weight: 600;
            `;
            title.textContent = '添加新影片';

            // URL輸入
            const urlContainer = document.createElement('div');
            urlContainer.style.marginBottom = '16px';

            const urlLabel = document.createElement('label');
            urlLabel.style.cssText = `
                display: block;
                color: rgba(255,255,255,0.9);
                font-size: 14px;
                margin-bottom: 8px;
                font-weight: 500;
            `;
            urlLabel.textContent = '影片URL：';

            this.videoUrlInput = document.createElement('input');
            this.videoUrlInput.type = 'url';
            this.videoUrlInput.placeholder = '請輸入影片URL（支持 mp4, m3u8, 等格式）';
            this.videoUrlInput.style.cssText = `
                width: 100%;
                padding: 12px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            `;
            this.videoUrlInput.style.setProperty('&:focus', `
                outline: none;
                border-color: #00d4aa;
                box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.2);
            `);

            urlContainer.appendChild(urlLabel);
            urlContainer.appendChild(this.videoUrlInput);

            // 名稱輸入
            const nameContainer = document.createElement('div');
            nameContainer.style.marginBottom = '24px';

            const nameLabel = document.createElement('label');
            nameLabel.style.cssText = `
                display: block;
                color: rgba(255,255,255,0.9);
                font-size: 14px;
                margin-bottom: 8px;
                font-weight: 500;
            `;
            nameLabel.textContent = '影片名稱：';

            this.videoNameInput = document.createElement('input');
            this.videoNameInput.type = 'text';
            this.videoNameInput.placeholder = '請輸入影片名稱（可選，將自動從URL提取）';
            this.videoNameInput.style.cssText = `
                width: 100%;
                padding: 12px;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 6px;
                background: rgba(255,255,255,0.1);
                color: white;
                font-size: 14px;
                box-sizing: border-box;
            `;

            nameContainer.appendChild(nameLabel);
            nameContainer.appendChild(this.videoNameInput);

            // 按鈕區域
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            `;

            // 取消按鈕
            const cancelBtn = this.createButton('取消', '取消添加', () => {
                this.hideAddVideoDialog();
            });
            cancelBtn.style.cssText = `
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 10px 20px;
                cursor: pointer;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            `;

            // 確認按鈕
            const confirmBtn = this.createButton('添加', '確認添加影片', () => {
                this.handleAddVideo();
            });
            confirmBtn.style.cssText = `
                background: linear-gradient(135deg, #00d4aa, #00a8cc);
                border: none;
                color: white;
                padding: 10px 20px;
                cursor: pointer;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            `;

            buttonContainer.appendChild(cancelBtn);
            buttonContainer.appendChild(confirmBtn);

            // 組裝對話框
            dialog.appendChild(title);
            dialog.appendChild(urlContainer);
            dialog.appendChild(nameContainer);
            dialog.appendChild(buttonContainer);

            overlay.appendChild(dialog);

            // 點擊遮罩關閉
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideAddVideoDialog();
                }
            });

            // ESC鍵關閉
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideAddVideoDialog();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);

            document.body.appendChild(overlay);
            this.addVideoDialog = overlay;

            // 聚焦到URL輸入框
            setTimeout(() => {
                this.videoUrlInput.focus();
            }, 100);
        }

        // 新增：處理添加影片
        handleAddVideo() {
            const url = this.videoUrlInput.value.trim();
            const name = this.videoNameInput.value.trim();

            if (!url) {
                this.showError('請輸入影片URL');
                return;
            }

            // 驗證URL格式
            if (!this.isValidUrl(url)) {
                this.showError('請輸入有效的URL');
                return;
            }

            // 檢查是否支援的格式
            if (window.BCMedia.Constants && !window.BCMedia.Constants.isSupportedFormat(url)) {
                this.showWarning('此格式可能不被支援，但仍會嘗試添加');
            }

            // 生成影片名稱（如果未提供）
            const videoName = name || this.extractVideoName(url);
            const videoId = this.generateVideoId();

            // 創建影片項目
            const videoItem = {
                id: videoId,
                url: url,
                name: videoName,
                duration: 0,
                addedAt: Date.now()
            };

            // 添加到播放列表
            if (this.mediaPlayer) {
                if (!this.mediaPlayer.videoList) {
                    this.mediaPlayer.videoList = [];
                }
                this.mediaPlayer.videoList.push(videoItem);
                
                // 更新播放列表顯示
                this.updatePlaylist();
                
                // 如果是第一個影片，自動播放
                if (this.mediaPlayer.videoList.length === 1) {
                    this.mediaPlayer.playId(videoId);
                }
                
                this.showSuccess(`已添加影片：${videoName}`);
            }

            this.hideAddVideoDialog();
        }

        // 新增：隱藏添加影片對話框
        hideAddVideoDialog() {
            if (this.addVideoDialog) {
                this.addVideoDialog.style.display = 'none';
                this.videoUrlInput.value = '';
                this.videoNameInput.value = '';
            }
        }

        // 新增：驗證URL
        isValidUrl(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }

        // 新增：從URL提取影片名稱
        extractVideoName(url) {
            try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const filename = pathname.split('/').pop();
                
                if (filename && filename.includes('.')) {
                    return filename.split('.')[0];
                }
                
                return `影片_${Date.now()}`;
            } catch {
                return `影片_${Date.now()}`;
            }
        }

        // 新增：生成影片ID
        generateVideoId() {
            return 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }

        // 修復：改進的updatePlaylist方法
        updatePlaylist() {
            if (!this.playlist) return;

            this.playlist.innerHTML = '';

            // 如果沒有影片，顯示空狀態
            if (!this.mediaPlayer || !this.mediaPlayer.videoList || this.mediaPlayer.videoList.length === 0) {
                this.createEmptyStateMessage();
                return;
            }

            // 渲染播放列表
            this.mediaPlayer.videoList.forEach(item => {
                const element = this.createPlaylistItem(item);
                this.playlist.appendChild(element);
            });
        }

        // 修復：改進的createPlaylistItem方法
        createPlaylistItem(item) {
            const element = document.createElement('div');
            element.className = 'media-player-playlist-item';
            
            if (this.mediaPlayer && item.id === this.mediaPlayer.playingId) {
                element.classList.add('active');
            }

            // 圖標
            const icon = document.createElement('div');
            icon.className = 'item-icon';
            
            // 根據格式顯示不同圖標
            if (window.BCMedia.Constants) {
                if (window.BCMedia.Constants.isVideoFormat(item.url)) {
                    icon.textContent = '🎥';
                } else if (window.BCMedia.Constants.isAudioFormat(item.url)) {
                    icon.textContent = '🎵';
                } else {
                    icon.textContent = '📄';
                }
            } else {
                icon.textContent = '🎬';
            }

            // 信息容器
            const info = document.createElement('div');
            info.className = 'item-info';

            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.name;
            title.title = item.name; // 顯示完整標題

            const urlDisplay = document.createElement('div');
            urlDisplay.style.cssText = `
                font-size: 11px;
                color: rgba(255,255,255,0.5);
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            `;
            urlDisplay.textContent = item.url;
            urlDisplay.title = item.url;

            const duration = document.createElement('div');
            duration.className = 'item-duration';
            duration.textContent = item.duration ? 
                this.formatTime(item.duration) : '未知時長';

            info.appendChild(title);
            info.appendChild(urlDisplay);
            info.appendChild(duration);

            // 操作按鈕容器
            const actions = document.createElement('div');
            actions.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
            `;

            // 刪除按鈕
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = '刪除';
            deleteBtn.style.cssText = `
                background: rgba(255,0,0,0.2);
                border: 1px solid rgba(255,0,0,0.3);
                color: #ff6b6b;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
            `;
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDeleteVideo(item.id);
            });

            actions.appendChild(deleteBtn);

            element.appendChild(icon);
            element.appendChild(info);
            element.appendChild(actions);

            // 點擊播放
            element.addEventListener('click', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.playId(item.id);
                }
            });

            return element;
        }

        // 新增：處理刪除影片
        handleDeleteVideo(videoId) {
            if (!this.mediaPlayer || !this.mediaPlayer.videoList) return;

            const index = this.mediaPlayer.videoList.findIndex(item => item.id === videoId);
            if (index === -1) return;

            const videoName = this.mediaPlayer.videoList[index].name;

            // 如果正在播放被刪除的影片，停止播放
            if (this.mediaPlayer.playingId === videoId) {
                this.mediaPlayer.stop();
                this.mediaPlayer.playingId = '';
                if (this.titleElement) {
                    this.titleElement.textContent = '暫無播放中';
                }
            }

            // 從列表中移除
            this.mediaPlayer.videoList.splice(index, 1);

            // 更新播放列表顯示
            this.updatePlaylist();

            this.showSuccess(`已刪除影片：${videoName}`);
        }

        // 新增：格式化時間的方法（如果Utils不可用）
        formatTime(seconds) {
            if (!seconds || !isFinite(seconds)) return '00:00';
            
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            } else {
                return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }

        // 修復：確保destroy方法正確清理所有資源
        destroy() {
            this.cleanup();
            
            // 移除樣式
            if (this.styles && this.styles.parentNode) {
                this.styles.parentNode.removeChild(this.styles);
                this.styles = null;
            }

            console.log('[UI管理器] 清理完成');
        }

        createProgressBar() {
            const container = document.createElement('div');
            container.className = 'media-player-progress-container';
            container.style.cssText = `
                flex: 1;
                height: 4px;
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
                cursor: pointer;
                position: relative;
            `;

            this.progressBar = document.createElement('div');
            this.progressBar.className = 'media-player-progress-bar';
            this.progressBar.style.cssText = `
                height: 100%;
                background: linear-gradient(90deg, #00d4aa, #00a8cc);
                border-radius: 2px;
                width: 0%;
                transition: width 0.1s ease;
                position: relative;
            `;

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
            container.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
            `;

            // 靜音按鈕
            const muteBtn = this.createButton('🔊', '靜音/取消靜音', () => {
                if (this.mediaPlayer) {
                    this.mediaPlayer.toggleMute();
                }
            });

            // 音量滑塊
            const volumeContainer = document.createElement('div');
            volumeContainer.className = 'media-player-volume-slider';
            volumeContainer.style.cssText = `
                width: 80px;
                height: 4px;
                background: rgba(255,255,255,0.2);
                border-radius: 2px;
                cursor: pointer;
                position: relative;
            `;

            this.volumeBar = document.createElement('div');
            this.volumeBar.className = 'media-player-volume-bar';
            this.volumeBar.style.cssText = `
                height: 100%;
                background: linear-gradient(90deg, #00d4aa, #00a8cc);
                border-radius: 2px;
                width: 80%;
                transition: width 0.1s ease;
            `;

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

        setupDragAndResize() {
            const titleBar = this.container.querySelector('.bc-media-player-titlebar');
            
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

        bindEvents() {
            // 控制欄顯示/隱藏
            const videoArea = this.container.querySelector('.bc-media-player-video-area');
            const controls = this.container.querySelector('.media-player-controls');
            
            if (videoArea && controls) {
                videoArea.addEventListener('mouseenter', () => {
                    controls.style.opacity = '1';
                });
                
                videoArea.addEventListener('mouseleave', () => {
                    controls.style.opacity = '0';
                });
            }

            // 窗口大小改變
            window.addEventListener('resize', this.debounce(() => {
                this.handleResize();
            }, 250));
        }

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
                const current = this.formatTime(state.currentTime);
                const duration = this.formatTime(state.duration);
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

        toggleMiniMode() {
            const currentMode = this.mediaPlayer ? 
                this.mediaPlayer.currentMode : 'normal';
            const newMode = currentMode === 'mini' ? 'normal' : 'mini';
            
            if (this.mediaPlayer) {
                this.mediaPlayer.switchMode(newMode);
            }
        }

        switchMode(mode) {
            // 移除所有模式類
            this.container.classList.remove('mini-mode', 'compact-mode', 'fullscreen-mode');
            
            switch (mode) {
                case 'mini':
                    this.container.classList.add('mini-mode');
                    this.container.style.width = this.isMobile ? '280px' : '320px';
                    this.container.style.height = this.isMobile ? '120px' : '180px';
                    this.container.style.resize = 'none';
                    break;
                    
                case 'compact':
                    this.container.classList.add('compact-mode');
                    this.container.style.width = this.isMobile ? '320px' : '400px';
                    this.container.style.height = this.isMobile ? '240px' : '300px';
                    this.container.style.resize = 'both';
                    break;
                    
                case 'normal':
                default:
                    this.container.style.width = this.isMobile ? '90%' : '60%';
                    this.container.style.height = this.isMobile ? '70%' : '60%';
                    this.container.style.resize = 'both';
                    break;
            }
            
            this.savePosition();
        }

        toggleSidebar() {
            if (this.sidebar) {
                this.sidebar.classList.toggle('hidden');
            }
        }

        savePosition() {
            if (!this.container) return;

            const position = {
                left: this.container.style.left,
                top: this.container.style.top,
                width: this.container.style.width,
                height: this.container.style.height
            };

            try {
                localStorage.setItem('bc_media_position', JSON.stringify(position));
            } catch (e) {
                console.warn('無法保存播放器位置:', e);
            }
        }

        restorePosition() {
            try {
                const position = localStorage.getItem('bc_media_position');
                if (position && this.container) {
                    const pos = JSON.parse(position);
                    if (pos.left) this.container.style.left = pos.left;
                    if (pos.top) this.container.style.top = pos.top;
                    if (pos.width) this.container.style.width = pos.width;
                    if (pos.height) this.container.style.height = pos.height;
                }
            } catch (e) {
                console.warn('無法恢復播放器位置:', e);
            }
        }

        showNotification(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.className = `bc-media-notification ${type}`;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 8px;
                color: white;
                z-index: 10001;
                animation: slideInRight 0.3s ease;
                backdrop-filter: blur(15px);
                font-weight: 500;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                max-width: 300px;
            `;

            // 設置背景顏色
            switch (type) {
                case 'error':
                    notification.style.background = 'linear-gradient(135deg, rgba(231, 76, 60, 0.9), rgba(192, 57, 43, 0.9))';
                    notification.style.borderLeft = '4px solid #e74c3c';
                    break;
                case 'success':
                    notification.style.background = 'linear-gradient(135deg, rgba(39, 174, 96, 0.9), rgba(46, 204, 113, 0.9))';
                    notification.style.borderLeft = '4px solid #27ae60';
                    break;
                case 'warning':
                    notification.style.background = 'linear-gradient(135deg, rgba(243, 156, 18, 0.9), rgba(230, 126, 34, 0.9))';
                    notification.style.borderLeft = '4px solid #f39c12';
                    break;
                default:
                    notification.style.background = 'linear-gradient(135deg, rgba(52, 152, 219, 0.9), rgba(41, 128, 185, 0.9))';
                    notification.style.borderLeft = '4px solid #3498db';
                    break;
            }

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

        getVideoContainer() {
            return this.videoContainer;
        }

        // 輔助方法
        createButton(text, title, onclick) {
            const btn = document.createElement('button');
            btn.className = 'bc-media-player-btn';
            btn.innerHTML = text;
            btn.title = title;
            btn.style.cssText = `
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
            `;
            
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'rgba(255,255,255,0.25)';
                btn.style.borderColor = 'rgba(255,255,255,0.3)';
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'rgba(255,255,255,0.15)';
                btn.style.borderColor = 'rgba(255,255,255,0.2)';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '';
            });
            
            btn.addEventListener('click', onclick);
            return btn;
        }
    }

    // 替換原有的 UIManager
    window.BCMedia.UIManager = EnhancedUIManager;

    console.log('[BC增強媒體] 增強UI管理器載入完成');
})();
