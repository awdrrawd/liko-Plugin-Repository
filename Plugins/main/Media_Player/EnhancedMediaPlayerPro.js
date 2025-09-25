// EnhancedMediaPlayerPro.js - 主应用程序
(function() {
    'use strict';

    // 防止重复加载
    if (window.EnhancedMediaPlayerPro) {
        console.log('[EMP] Main application already loaded');
        return;
    }

    // 主应用程序类
    class EnhancedMediaPlayerPro {
        constructor() {
            this.version = '2.0.0';
            this.modules = new Map();
            this.eventBus = this.createEventBus();
            this.isInitialized = false;
            this.playerWindow = null;
            this.autoDetector = null;
            this.syncManager = null;
            
            // 配置选项
            this.config = {
                features: {
                    autoDetection: true,
                    syncPlayback: true,
                    danmaku: true,
                    performance: true,
                    userPreferences: true
                },
                ui: {
                    theme: 'dark',
                    showNotifications: true,
                    animations: true
                },
                debug: false
            };

            this.init();
        }

        async init() {
            try {
                console.log('[EMP] Initializing Enhanced Media Player Pro v' + this.version);
                
                // 等待依赖模块加载
                await this.waitForDependencies();
                
                // 初始化核心模块
                this.initializeCoreModules();
                
                // 初始化UI系统
                this.initializeUI();
                
                // 初始化bcModSdk集成
                this.initializeModSdk();
                
                // 设置事件处理
                this.setupEventHandlers();
                
                // 启动功能模块
                this.startFeatures();
                
                this.isInitialized = true;
                this.eventBus.emit('app:initialized');
                
                console.log('[EMP] Enhanced Media Player Pro initialized successfully');
                
                // 延迟显示欢迎消息
                setTimeout(() => this.showWelcomeMessage(), 2000);
                
            } catch (error) {
                console.error('[EMP] Initialization failed:', error);
                this.handleInitializationError(error);
            }
        }

        // 等待依赖模块
        async waitForDependencies() {
            const requiredModules = ['MediaUtils', 'UIComponents'];
            const optionalModules = ['ErrorHandler', 'PerformanceOptimizer', 'SyncManager', 'UserPreferencesManager'];
            const maxWait = 15000; // 15秒超时
            const startTime = Date.now();
            
            console.log('[EMP] Waiting for dependencies...');
            
            while (Date.now() - startTime < maxWait) {
                const missingRequired = requiredModules.filter(dep => !window[dep]);
                
                if (missingRequired.length === 0) {
                    console.log('[EMP] All required dependencies loaded');
                    
                    // 检查可选模块
                    const availableOptional = optionalModules.filter(dep => window[dep]);
                    if (availableOptional.length > 0) {
                        console.log('[EMP] Optional modules available:', availableOptional);
                    }
                    
                    return true;
                }
                
                if (Date.now() - startTime > 5000) { // 5秒后开始提示
                    console.log('[EMP] Still waiting for:', missingRequired);
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            const stillMissing = requiredModules.filter(dep => !window[dep]);
            throw new Error('Required dependencies not available: ' + stillMissing.join(', '));
        }

        // 初始化核心模块
        initializeCoreModules() {
            // 错误处理器
            if (window.ErrorHandler) {
                this.modules.set('errorHandler', new ErrorHandler());
                console.log('[EMP] Error handler initialized');
            }

            // 性能优化器
            if (window.PerformanceOptimizer) {
                this.modules.set('performanceOptimizer', new PerformanceOptimizer());
                console.log('[EMP] Performance optimizer initialized');
            }

            // 用户偏好管理器
            if (window.UserPreferencesManager) {
                this.modules.set('userPreferences', new UserPreferencesManager());
                console.log('[EMP] User preferences manager initialized');
            }
        }

        // 初始化UI系统
        initializeUI() {
            if (window.UIComponents) {
                UIComponents.init();
                
                // 应用用户偏好的主题
                const preferences = this.modules.get('userPreferences');
                if (preferences) {
                    const theme = preferences.get('ui', 'theme');
                    if (theme && theme !== 'auto') {
                        UIComponents.switchTheme(theme);
                    }
                }
                
                console.log('[EMP] UI system initialized');
            }
        }

        // 初始化bcModSdk集成
        initializeModSdk() {
            if (typeof bcModSdk !== 'undefined' && bcModSdk.registerMod) {
                this.mod = bcModSdk.registerMod({
                    name: "Enhanced Media Player Pro",
                    fullName: "Enhanced Media Player Pro v" + this.version,
                    version: this.version,
                    repository: "Enhanced Media Player with Smart Detection & Sync Playback"
                });

                this.setupModHooks();
                console.log('[EMP] bcModSdk integration enabled');
            } else {
                console.log('[EMP] Running in standalone mode (bcModSdk not available)');
                this.setupStandaloneMode();
            }
        }

        // 设置Mod钩子
        setupModHooks() {
            // 房间菜单绘制
            this.mod.hookFunction("ChatRoomMenuDraw", 0, (args, next) => {
                next(args);
                this.drawRoomButton();
            });

            // 房间点击处理
            this.mod.hookFunction("ChatRoomClick", 0, (args, next) => {
                if (this.handleRoomButtonClick()) return;
                next(args);
            });

            // 消息处理
            this.mod.hookFunction("ChatRoomMessage", 0, (args, next) => {
                next(args);
                this.handleChatMessage(args[0]);
            });

            // 房间加载
            this.mod.hookFunction("ChatRoomLoad", 0, (args, next) => {
                next(args);
                setTimeout(() => this.onRoomLoad(), 1000);
            });

            // 键盘处理 - 防止播放器打开时聊天输入框自动获取焦点
            this.mod.hookFunction("ChatRoomKeyDown", 99, (args, next) => {
                if (this.handleKeyDown(args[0])) return false;
                return next(args);
            });
        }

        // 设置独立模式（没有bcModSdk的情况）
        setupStandaloneMode() {
            // 在页面上添加一个手动触发按钮
            this.createStandaloneUI();
        }

        // 创建独立模式UI
        createStandaloneUI() {
            const button = document.createElement('button');
            button.textContent = '🎬 EMP';
            button.title = 'Enhanced Media Player Pro';
            button.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                color: white;
                border: none;
                border-radius: 25px;
                padding: 10px 15px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            `;

            button.addEventListener('click', () => this.togglePlayer());
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.1)';
                button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            });

            document.body.appendChild(button);
            this.standaloneButton = button;
        }

        // 设置事件处理
        setupEventHandlers() {
            // 全局键盘快捷键
            document.addEventListener('keydown', (e) => {
                this.handleGlobalKeyDown(e);
            });

            // 网络状态变化
            window.addEventListener('online', () => {
                this.handleNetworkChange(true);
            });

            window.addEventListener('offline', () => {
                this.handleNetworkChange(false);
            });

            // 页面可见性变化
            document.addEventListener('visibilitychange', () => {
                this.handleVisibilityChange();
            });
        }

        // 启动功能模块
        startFeatures() {
            // 自动检测功能
            if (this.config.features.autoDetection && this.isInSupportedEnvironment()) {
                this.startAutoDetection();
            }

            // 同步管理功能
            if (this.config.features.syncPlayback && window.SyncManager) {
                this.syncManager = new SyncManager(this);
                this.modules.set('syncManager', this.syncManager);
                console.log('[EMP] Sync manager started');
            }
        }

        // 启动自动检测
        startAutoDetection() {
            if (window.AutoDetector) {
                this.autoDetector = new AutoDetector(this);
                this.autoDetector.enable();
                this.modules.set('autoDetector', this.autoDetector);
                console.log('[EMP] Auto detection started');
            } else {
                // 简化版自动检测
                this.startSimpleAutoDetection();
            }
        }

        // 简化版自动检测
        startSimpleAutoDetection() {
            const scanInterval = setInterval(() => {
                if (!this.config.features.autoDetection) {
                    clearInterval(scanInterval);
                    return;
                }
                
                this.scanForMediaLinks();
            }, 2000);

            this.autoDetectionInterval = scanInterval;
            console.log('[EMP] Simple auto detection started');
        }

        // 扫描媒体链接
        scanForMediaLinks() {
            const messages = document.querySelectorAll('[role="log"] > div, .chat-message');
            
            messages.forEach(message => {
                if (message.dataset.empProcessed) return;
                
                const text = message.textContent || '';
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const urls = text.match(urlRegex) || [];
                
                urls.forEach(url => {
                    const mediaInfo = MediaUtils.detectUrlType(url);
                    if (mediaInfo) {
                        this.addMediaButton(message, url, mediaInfo);
                    }
                });
                
                message.dataset.empProcessed = 'true';
            });
        }

        // 添加媒体按钮
        addMediaButton(messageElement, url, mediaInfo) {
            const button = document.createElement('button');
            button.className = 'emp-media-button';
            button.innerHTML = mediaInfo.type === 'platform' ? mediaInfo.config.icon : '🎬';
            button.title = `播放 ${mediaInfo.type === 'platform' ? mediaInfo.config.name : '媒体'}`;
            button.style.cssText = `
                background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                margin-left: 8px;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.3s ease;
                vertical-align: middle;
            `;

            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleMediaButtonClick(url, mediaInfo);
            });

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'scale(1.2)';
                button.style.boxShadow = '0 4px 12px rgba(108, 92, 231, 0.4)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'scale(1)';
                button.style.boxShadow = 'none';
            });

            messageElement.appendChild(button);
        }

        // 处理媒体按钮点击
        handleMediaButtonClick(url, mediaInfo) {
            if (!this.isPlayerActive()) {
                this.openPlayer();
            }

            // 简化版：显示媒体信息
            this.showMediaInfo(url, mediaInfo);
            
            if (UIComponents && UIComponents.showNotification) {
                UIComponents.showNotification(`正在处理 ${mediaInfo.config?.name || '媒体'} 链接`, 'info');
            }
        }

        // 显示媒体信息
        showMediaInfo(url, mediaInfo) {
            if (!this.playerWindow) return;

            const infoArea = this.playerWindow.querySelector('.emp-media-info');
            if (infoArea) {
                infoArea.innerHTML = `
                    <div style="padding: 15px; border: 1px solid var(--border); border-radius: 8px; margin: 10px 0; background: var(--surface);">
                        <h4 style="margin: 0 0 10px 0; color: var(--text);">检测到媒体链接</h4>
                        <p><strong>类型:</strong> ${mediaInfo.type === 'platform' ? mediaInfo.config.name : mediaInfo.mediaType}</p>
                        <p><strong>链接:</strong> <a href="${url}" target="_blank" style="color: var(--primary);">${MediaUtils.simplifyUrl(url)}</a></p>
                        <div style="margin-top: 10px;">
                            <button class="emp-button emp-play-media" data-url="${url}">播放媒体</button>
                            <button class="emp-button" onclick="navigator.clipboard.writeText('${url}')">复制链接</button>
                        </div>
                    </div>
                `;

                // 绑定播放按钮事件
                const playBtn = infoArea.querySelector('.emp-play-media');
                if (playBtn) {
                    playBtn.addEventListener('click', () => {
                        this.playMedia(url, mediaInfo);
                    });
                }
            }
        }

        // 播放媒体
        playMedia(url, mediaInfo) {
            if (UIComponents && UIComponents.showNotification) {
                UIComponents.showNotification('播放功能开发中...', 'warning');
            }
            console.log('[EMP] Play media:', url, mediaInfo);
        }

        // 绘制房间按钮
        drawRoomButton() {
            if (!this.shouldShowButton()) return;

            const x = 965, y = 825, w = 40, h = 40;
            let color = '#444444';
            let tooltip = '增强媒体播放器';

            if (this.isPlayerActive()) {
                color = '#44DD44';
                tooltip = '媒体播放器已激活 (点击关闭)';
            }

            if (typeof DrawButton === 'function') {
                DrawButton(x, y, w, h, "🎬", "#FFFFFF", "", tooltip);
            }
        }

        // 处理房间按钮点击
        handleRoomButtonClick() {
            if (!this.shouldShowButton()) return false;

            const x = 965, y = 825, w = 40, h = 40;
            
            if (typeof MouseIn === 'function' && MouseIn(x, y, w, h)) {
                this.togglePlayer();
                return true;
            }
            
            return false;
        }

        // 判断是否应该显示按钮
        shouldShowButton() {
            return this.hasPermission() || this.isPlayerActive();
        }

        // 检查权限
        hasPermission() {
            return typeof ChatRoomPlayerIsAdmin === 'function' && ChatRoomPlayerIsAdmin();
        }

        // 处理键盘事件
        handleKeyDown(event) {
            // 如果有播放器窗口且焦点不在聊天输入框，则阻止默认行为
            const hasPlayerWindow = this.playerWindow !== null;
            const isChatFocused = document.activeElement?.id === 'InputChat';
            
            return hasPlayerWindow && !isChatFocused && 
                   (document.activeElement?.tagName === 'INPUT' || 
                    document.activeElement?.tagName === 'TEXTAREA');
        }

        // 处理全局键盘事件
        handleGlobalKeyDown(event) {
            // Ctrl + Shift + M: 切换媒体播放器
            if (event.ctrlKey && event.shiftKey && event.key === 'M') {
                event.preventDefault();
                this.togglePlayer();
            }

            // Ctrl + Shift + S: 显示设置面板
            if (event.ctrlKey && event.shiftKey && event.key === 'S') {
                event.preventDefault();
                this.showSettings();
            }
        }

        // 切换播放器
        togglePlayer() {
            if (this.isPlayerActive()) {
                this.closePlayer();
            } else {
                this.openPlayer();
            }
        }

        // 打开播放器
        openPlayer() {
            if (this.playerWindow) return;
            
            this.createPlayerWindow();
            this.eventBus.emit('player:opened');
            
            if (UIComponents && UIComponents.showNotification) {
                UIComponents.showNotification('播放器已打开', 'success');
            }

            console.log('[EMP] Player opened');
        }

        // 创建播放器窗口
        createPlayerWindow() {
            this.playerWindow = document.createElement('div');
            this.playerWindow.className = 'emp-player-window';
            
            // 根据设备类型设置样式
            const isMobile = MediaUtils.isMobile();
            const windowStyle = isMobile ? {
                width: '95vw',
                height: '80vh',
                top: '10vh',
                left: '2.5vw'
            } : {
                width: '80vw',
                maxWidth: '1200px',
                height: '70vh',
                top: '15vh',
                left: '50%',
                transform: 'translateX(-50%)'
            };

            Object.assign(this.playerWindow.style, {
                position: 'fixed',
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: '15px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                zIndex: '10000',
                display: 'flex',
                flexDirection: 'column',
                backdropFilter: 'blur(20px)',
                ...windowStyle
            });

            this.playerWindow.innerHTML = this.getPlayerWindowHTML();
            document.body.appendChild(this.playerWindow);

            // 绑定事件
            this.bindPlayerWindowEvents();
            
            // 使窗口可拖拽
            this.makeWindowDraggable();
        }

        // 获取播放器窗口HTML
        getPlayerWindowHTML() {
            return `
                <div class="emp-header" style="
                    padding: 15px 20px;
                    background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                    color: white;
                    border-radius: 15px 15px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                ">
                    <div>
                        <h3 style="margin: 0; font-size: 18px;">Enhanced Media Player Pro</h3>
                        <div style="font-size: 12px; opacity: 0.9;">v${this.version} - 智能媒体播放器</div>
                    </div>
                    <div>
                        <button class="emp-settings-btn" title="设置" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            border-radius: 6px;
                            padding: 8px 12px;
                            margin-right: 10px;
                            cursor: pointer;
                        ">⚙️</button>
                        <button class="emp-close-btn" title="关闭" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            border-radius: 6px;
                            padding: 8px 12px;
                            cursor: pointer;
                        ">✕</button>
                    </div>
                </div>
                <div class="emp-content" style="
                    flex: 1;
                    padding: 20px;
                    color: var(--text);
                    overflow-y: auto;
                ">
                    <div class="emp-status" style="
                        background: var(--surface);
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        border-left: 4px solid var(--primary);
                    ">
                        <h4 style="margin: 0 0 10px 0;">系统状态</h4>
                        <div>✅ 核心模块已加载</div>
                        <div>✅ 媒体检测已启用</div>
                        <div>✅ UI系统运行正常</div>
                        ${this.syncManager ? '<div>✅ 同步功能可用</div>' : '<div>⏸️ 同步功能未启用</div>'}
                    </div>
                    
                    <div class="emp-features" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 15px;
                        margin-bottom: 20px;
                    ">
                        <div style="background: var(--surface); padding: 15px; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0;">🎯 智能检测</h4>
                            <p style="margin: 0; font-size: 14px; color: var(--text-muted);">
                                自动识别聊天中的媒体链接并添加播放按钮
                            </p>
                        </div>
                        <div style="background: var(--surface); padding: 15px; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0;">🌐 多平台</h4>
                            <p style="margin: 0; font-size: 14px; color: var(--text-muted);">
                                支持 YouTube, Bilibili, Twitch, Vimeo 等平台
                            </p>
                        </div>
                        <div style="background: var(--surface); padding: 15px; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0;">📁 多格式</h4>
                            <p style="margin: 0; font-size: 14px; color: var(--text-muted);">
                                支持 mp4, webm, ogg, m3u8, mp3, flac 等格式
                            </p>
                        </div>
                    </div>
                    
                    <div class="emp-media-info">
                        <div style="
                            text-align: center;
                            padding: 40px;
                            color: var(--text-muted);
                            background: var(--surface);
                            border-radius: 8px;
                        ">
                            <div style="font-size: 48px; margin-bottom: 15px;">🎬</div>
                            <h3 style="margin: 0 0 10px 0;">准备就绪</h3>
                            <p style="margin: 0;">点击聊天中的媒体按钮开始使用</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // 绑定播放器窗口事件
        bindPlayerWindowEvents() {
            // 关闭按钮
            const closeBtn = this.playerWindow.querySelector('.emp-close-btn');
            closeBtn.addEventListener('click', () => this.closePlayer());

            // 设置按钮
            const settingsBtn = this.playerWindow.querySelector('.emp-settings-btn');
            settingsBtn.addEventListener('click', () => this.showSettings());

            // 按钮悬停效果
            [closeBtn, settingsBtn].forEach(btn => {
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'rgba(255,255,255,0.3)';
                    btn.style.transform = 'scale(1.1)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'rgba(255,255,255,0.2)';
                    btn.style.transform = 'scale(1)';
                });
            });
        }

        // 使窗口可拖拽
        makeWindowDraggable() {
            const header = this.playerWindow.querySelector('.emp-header');
            let isDragging = false;
            let currentX, currentY, initialX, initialY;

            const dragStart = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                
                isDragging = true;
                initialX = e.clientX - this.playerWindow.offsetLeft;
                initialY = e.clientY - this.playerWindow.offsetTop;
                header.style.cursor = 'grabbing';
            };

            const dragEnd = () => {
                isDragging = false;
                header.style.cursor = 'move';
            };

            const drag = (e) => {
                if (!isDragging) return;
                
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                
                // 限制窗口不会拖出屏幕
                const maxX = window.innerWidth - this.playerWindow.offsetWidth;
                const maxY = window.innerHeight - this.playerWindow.offsetHeight;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));
                
                this.playerWindow.style.left = currentX + 'px';
                this.playerWindow.style.top = currentY + 'px';
                this.playerWindow.style.transform = 'none';
            };

            header.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        // 关闭播放器
        closePlayer() {
            if (this.playerWindow) {
                this.playerWindow.remove();
                this.playerWindow = null;
                this.eventBus.emit('player:closed');
                
                if (UIComponents && UIComponents.showNotification) {
                    UIComponents.showNotification('播放器已关闭', 'info');
                }

                console.log('[EMP] Player closed');
            }
        }

        // 显示设置
        showSettings() {
            const userPreferences = this.modules.get('userPreferences');
            if (userPreferences && userPreferences.createSettingsPanel) {
                const settingsPanel = userPreferences.createSettingsPanel();
                document.body.appendChild(settingsPanel);
            } else {
                if (UIComponents && UIComponents.showNotification) {
                    UIComponents.showNotification('设置功能暂未可用', 'warning');
                }
            }
        }

        // 处理聊天消息
        handleChatMessage(data) {
            // 同步管理器处理
            if (this.syncManager) {
                this.syncManager.handleMessage(data);
            }

            // 触发自动检测扫描
            if (this.config.features.autoDetection) {
                setTimeout(() => this.scanForMediaLinks(), 100);
            }
        }

        // 处理网络变化
        handleNetworkChange(isOnline) {
            this.eventBus.emit('network:change', { isOnline });
            
            if (UIComponents && UIComponents.showNotification) {
                if (isOnline) {
                    UIComponents.showNotification('网络连接已恢复', 'success');
                } else {
                    UIComponents.showNotification('网络连接中断', 'warning');
                }
            }
        }

        // 处理可见性变化
        handleVisibilityChange() {
            const isVisible = !document.hidden;
            this.eventBus.emit('visibility:change', { isVisible });
            
            // 页面不可见时暂停某些功能
            if (!isVisible && this.config.features.performance) {
                this.pauseBackgroundTasks();
            } else if (isVisible) {
                this.resumeBackgroundTasks();
            }
        }

        // 房间加载完成
        onRoomLoad() {
            if (!window.empWelcomed) {
                setTimeout(() => this.showWelcomeMessage(), 3000);
                window.empWelcomed = true;
            }
        }

        // 显示欢迎消息
        showWelcomeMessage() {
            if (typeof ChatRoomSendLocal !== 'function') return;

            const supportedFormats = Object.keys(MediaUtils.SUPPORTED_FORMATS.video).slice(0, 6).join(', ');
            const supportedPlatforms = Object.keys(MediaUtils.PLATFORM_CONFIGS).map(key => 
                MediaUtils.PLATFORM_CONFIGS[key].name
            ).slice(0, 5).join(', ');
            
            const message = `
                <div style='background: linear-gradient(135deg, #6c5ce7, #a29bfe); 
                     color: white; padding: 20px; border-radius: 12px; margin: 15px 0; 
                     box-shadow: 0 8px 32px rgba(108, 92, 231, 0.3); 
                     border: 1px solid rgba(255, 255, 255, 0.2);'>
                    <h3 style="margin: 0 0 15px 0; font-size: 20px;">🎬 Enhanced Media Player Pro v${this.version}</h3>
                    <div style="background: rgba(255, 255, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 16px;">✨ 核心特性</h4>
                        <ul style='margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;'>
                            <li>🎯 智能媒体链接检测</li>
                            <li>🌐 多平台支持: ${supportedPlatforms}</li>
                            <li>📁 多格式支持: ${supportedFormats}</li>
                            <li>🎮 多人同步播放 ${this.syncManager ? '✅' : '(开发中)'}</li>
                            <li>💬 实时弹幕系统 (开发中)</li>
                            <li>🎨 现代化UI设计</li>
                        </ul>
                    </div>
                    <div style='font-size: 13px; opacity: 0.9; text-align: center;'>
                        <strong>快捷键:</strong> Ctrl+Shift+M 开关播放器 | Ctrl+Shift+S 设置 
                        <br><strong>使用方法:</strong> 发送媒体链接后点击 🎬 按钮
                    </div>
                </div>
            `;

            ChatRoomSendLocal(message, 20000);
        }

        // 处理初始化错误
        handleInitializationError(error) {
            const errorHandler = this.modules.get('errorHandler');
            if (errorHandler) {
                errorHandler.handleError(error, 'initialization');
            }
            
            setTimeout(() => {
                if (typeof ChatRoomSendLocal === 'function') {
                    ChatRoomSendLocal(
                        '<div style="background-color:#e74c3c;color:white;padding:15px;border-radius:8px;margin:10px 0;">' +
                        '⚠️ Enhanced Media Player Pro 启动失败<br>' +
                        '<strong>错误:</strong> ' + error.message + '<br>' +
                        '<small>请检查控制台日志或联系开发者</small>' +
                        '</div>',
                        12000
                    );
                }
            }, 2000);
        }

        // 检查是否在支持的环境中
        isInSupportedEnvironment() {
            const hostname = window.location.hostname;
            return /bondage.*\.com/.test(hostname) || hostname === 'localhost';
        }

        // 检查播放器是否激活
        isPlayerActive() {
            return this.playerWindow !== null;
        }

        // 暂停后台任务
        pauseBackgroundTasks() {
            if (this.autoDetectionInterval) {
                clearInterval(this.autoDetectionInterval);
            }
        }

        // 恢复后台任务
        resumeBackgroundTasks() {
            if (this.config.features.autoDetection && !this.autoDetectionInterval) {
                this.startSimpleAutoDetection();
            }
        }

        // 创建事件总线
        createEventBus() {
            const events = new Map();
            
            return {
                on(event, callback) {
                    if (!events.has(event)) events.set(event, []);
                    events.get(event).push(callback);
                },
                
                off(event, callback) {
                    if (!events.has(event)) return;
                    const callbacks = events.get(event);
                    const index = callbacks.indexOf(callback);
                    if (index > -1) callbacks.splice(index, 1);
                },
                
                emit(event, data) {
                    if (!events.has(event)) return;
                    events.get(event).forEach(callback => {
                        try {
                            callback(data);
                        } catch (error) {
                            console.error(`[EMP] Event handler error (${event}):`, error);
                        }
                    });
                }
            };
        }

        // 获取应用状态
        getStatus() {
            return {
                version: this.version,
                initialized: this.isInitialized,
                playerActive: this.isPlayerActive(),
                features: this.config.features,
                modules: Array.from(this.modules.keys()),
                hasAutoDetection: !!this.autoDetector,
                hasSyncManager: !!this.syncManager
            };
        }

        // 销毁应用
        destroy() {
            // 清理定时器
            if (this.autoDetectionInterval) {
                clearInterval(this.autoDetectionInterval);
            }

            // 关闭播放器
            this.closePlayer();

            // 移除独立按钮
            if (this.standaloneButton) {
                this.standaloneButton.remove();
            }

            // 清理模块
            this.modules.forEach(module => {
                if (module.destroy) {
                    module.destroy();
                }
            });

            this.modules.clear();
            this.isInitialized = false;
            this.eventBus.emit('app:destroyed');
            
            console.log('[EMP] Application destroyed');
        }
    }

    // 创建全局实例
    window.EnhancedMediaPlayerPro = new EnhancedMediaPlayerPro();
    console.log('[EMP] Enhanced Media Player Pro main application loaded');

})();
