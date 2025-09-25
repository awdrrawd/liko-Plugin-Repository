// ========== modules/MediaUtils.js ==========
(function() {
    'use strict';

    // 避免重复定义
    if (window.MediaUtils) return;

    // MediaUtils 类定义 (之前创建的完整代码)
    class MediaUtils {
        static SUPPORTED_FORMATS = {
            video: {
                'mp4': { type: 'video/mp4', icon: '🎬' },
                'webm': { type: 'video/webm', icon: '🎬' },
                'ogg': { type: 'video/ogg', icon: '🎬' },
                'avi': { type: 'video/x-msvideo', icon: '🎬' },
                'mov': { type: 'video/quicktime', icon: '🎬' },
                'mkv': { type: 'video/x-matroska', icon: '🎬' },
                'm3u8': { type: 'application/vnd.apple.mpegurl', icon: '📺' }
            },
            audio: {
                'mp3': { type: 'audio/mpeg', icon: '🎵' },
                'aac': { type: 'audio/aac', icon: '🎵' },
                'ogg': { type: 'audio/ogg', icon: '🎵' },
                'flac': { type: 'audio/flac', icon: '🎵' },
                'wav': { type: 'audio/wav', icon: '🎵' },
                'm4a': { type: 'audio/m4a', icon: '🎵' }
            },
            playlist: {
                'm3u': { type: 'application/x-mpegURL', icon: '📝' },
                'm3u8': { type: 'application/vnd.apple.mpegurl', icon: '📝' }
            }
        };

        static PLATFORM_CONFIGS = {
            youtube: {
                regex: /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[&?].*)?/,
                extractId: (url) => {
                    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                    return match ? match[1] : null;
                },
                getEmbedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0&modestbranding=1`,
                getThumbnail: (id) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
                name: 'YouTube',
                icon: '▶️',
                color: '#ff0000'
            },
            bilibili: {
                regex: /bilibili\.com\/video\/(BV[a-zA-Z0-9]{10})(?:[\/\?&].*)?/,
                extractId: (url) => {
                    const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]{10})/);
                    return match ? match[1] : null;
                },
                getEmbedUrl: (id) => `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
                name: 'Bilibili',
                icon: '📺',
                color: '#00a1d6'
            },
            // ... 其他平台配置
        };

        // 检测URL类型
        static detectUrlType(url) {
            try {
                const parsedUrl = new URL(url);
                
                // 检测平台链接
                for (const [platform, config] of Object.entries(this.PLATFORM_CONFIGS)) {
                    if (config.regex.test(url)) {
                        const idData = config.extractId(url);
                        return {
                            type: 'platform',
                            platform: platform,
                            id: idData,
                            config: config,
                            originalUrl: url
                        };
                    }
                }
                
                // 检测直链媒体文件
                const extension = this.getFileExtension(parsedUrl.pathname);
                const mediaType = this.getMediaTypeByExtension(extension);
                
                if (mediaType) {
                    return {
                        type: 'direct',
                        mediaType: mediaType.category,
                        extension: extension,
                        mimeType: mediaType.info.type,
                        icon: mediaType.info.icon,
                        originalUrl: url
                    };
                }
                
                return null;
            } catch (error) {
                console.error('URL解析失败:', error);
                return null;
            }
        }

        // 获取文件扩展名
        static getFileExtension(pathname) {
            return pathname.split('.').pop().toLowerCase().split('?')[0];
        }

        // 根据扩展名获取媒体类型
        static getMediaTypeByExtension(extension) {
            for (const [category, formats] of Object.entries(this.SUPPORTED_FORMATS)) {
                if (formats[extension]) {
                    return {
                        category: category,
                        info: formats[extension]
                    };
                }
            }
            return null;
        }

        // 创建播放列表项
        static createPlaylistItem(url, customName = null) {
            const urlInfo = this.detectUrlType(url);
            if (!urlInfo) return null;

            const item = {
                id: this.generateId(),
                url: url,
                originalUrl: url,
                addedAt: new Date().toISOString()
            };

            if (urlInfo.type === 'platform') {
                item.type = 'platform';
                item.platform = urlInfo.platform;
                item.name = customName || `${urlInfo.config.name} - ${urlInfo.id}`;
                item.icon = urlInfo.config.icon;
                item.embedUrl = urlInfo.config.getEmbedUrl(urlInfo.id);
            } else if (urlInfo.type === 'direct') {
                item.type = 'direct';
                item.mediaType = urlInfo.mediaType;
                item.name = customName || this.extractFileName(url);
                item.icon = urlInfo.icon;
                item.mimeType = urlInfo.mimeType;
            }

            return item;
        }

        // 生成唯一ID
        static generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        }

        // 从URL提取文件名
        static extractFileName(url) {
            try {
                const pathname = new URL(url).pathname;
                const fileName = pathname.split('/').pop();
                return decodeURIComponent(fileName) || 'Unknown';
            } catch (error) {
                return 'Unknown';
            }
        }

        // 简化URL显示
        static simplifyUrl(url, maxLength = 50) {
            try {
                const parsedUrl = new URL(url);
                let simplified = parsedUrl.hostname + parsedUrl.pathname;
                
                // 移除www前缀
                simplified = simplified.replace(/^www\./, '');
                
                // 特定平台的简化
                if (simplified.includes('youtube.com')) {
                    const videoId = this.PLATFORM_CONFIGS.youtube.extractId(url);
                    return videoId ? `youtube.com/watch?v=${videoId}` : simplified;
                }
                
                if (simplified.includes('bilibili.com')) {
                    const videoId = this.PLATFORM_CONFIGS.bilibili.extractId(url);
                    return videoId ? `bilibili.com/video/${videoId}` : simplified;
                }
                
                // 截断长URL
                if (simplified.length > maxLength) {
                    return simplified.substring(0, maxLength - 3) + '...';
                }
                
                return simplified;
            } catch (error) {
                return url.substring(0, maxLength);
            }
        }

        // 验证媒体URL
        static async validateMediaUrl(url) {
            try {
                const response = await fetch(url, { method: 'HEAD' });
                return {
                    valid: response.ok,
                    contentType: response.headers.get('content-type'),
                    contentLength: response.headers.get('content-length'),
                    status: response.status
                };
            } catch (error) {
                return {
                    valid: false,
                    error: error.message
                };
            }
        }

        // 复制到剪贴板
        static async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            }
        }

        // 防抖函数
        static debounce(func, wait) {
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

        // 节流函数
        static throttle(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // 创建事件发射器
        static createEventEmitter() {
            const events = {};
            
            return {
                on(event, callback) {
                    if (!events[event]) events[event] = [];
                    events[event].push(callback);
                },
                
                off(event, callback) {
                    if (!events[event]) return;
                    events[event] = events[event].filter(cb => cb !== callback);
                },
                
                emit(event, data) {
                    if (!events[event]) return;
                    events[event].forEach(callback => callback(data));
                }
            };
        }

        // 检测是否为移动端
        static isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
    }

    // 导出到全局
    window.MediaUtils = MediaUtils;
    console.log('[EMP] MediaUtils module loaded');

})();

// ========== modules/UIComponents.js ==========
(function() {
    'use strict';

    if (window.UIComponents) return;

    class UIComponents {
        static THEMES = {
            dark: {
                primary: '#6c5ce7',
                secondary: '#a29bfe',
                success: '#00b894',
                danger: '#e84393',
                warning: '#fdcb6e',
                background: 'rgba(20, 25, 35, 0.95)',
                surface: 'rgba(30, 35, 45, 0.9)',
                glass: 'rgba(255, 255, 255, 0.1)',
                text: '#ffffff',
                textMuted: 'rgba(255, 255, 255, 0.7)',
                border: 'rgba(255, 255, 255, 0.2)'
            },
            light: {
                primary: '#5f3dc4',
                secondary: '#7c4dff',
                success: '#12b886',
                danger: '#fa5252',
                warning: '#fd7e14',
                background: 'rgba(255, 255, 255, 0.95)',
                surface: 'rgba(248, 249, 250, 0.9)',
                glass: 'rgba(0, 0, 0, 0.05)',
                text: '#212529',
                textMuted: 'rgba(33, 37, 41, 0.7)',
                border: 'rgba(0, 0, 0, 0.1)'
            }
        };

        static currentTheme = 'dark';

        // 获取当前主题
        static getTheme() {
            return this.THEMES[this.currentTheme];
        }

        // 切换主题
        static switchTheme(themeName) {
            if (this.THEMES[themeName]) {
                this.currentTheme = themeName;
                this.updateGlobalStyles();
            }
        }

        // 注入全局样式
        static injectGlobalStyles() {
            if (document.getElementById('emp-global-styles')) return;

            const style = document.createElement('style');
            style.id = 'emp-global-styles';
            style.textContent = this.getGlobalCSS();
            document.head.appendChild(style);

            this.updateGlobalStyles();
        }

        // 获取全局CSS (简化版，完整版见之前的代码)
        static getGlobalCSS() {
            return `
                .emp-player-window {
                    position: fixed;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    z-index: 10000;
                    backdrop-filter: blur(20px);
                    border-radius: 15px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .emp-button {
                    background: linear-gradient(135deg, var(--primary), var(--secondary));
                    border: none;
                    border-radius: 6px;
                    color: var(--text);
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-family: inherit;
                    padding: 10px 16px;
                    transition: all 0.3s ease;
                    user-select: none;
                }
                
                .emp-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                }
            `;
        }

        // 更新全局样式变量
        static updateGlobalStyles() {
            const theme = this.getTheme();
            const root = document.documentElement;

            Object.entries(theme).forEach(([key, value]) => {
                root.style.setProperty(`--${key}`, value);
            });
        }

        // 显示通知
        static showNotification(message, type = 'info', duration = 3000) {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 12000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                max-width: 350px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            `;

            const colors = {
                info: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                success: 'linear-gradient(135deg, #00b894, #00a085)',
                warning: 'linear-gradient(135deg, #fdcb6e, #e17055)',
                danger: 'linear-gradient(135deg, #e84393, #fd79a8)'
            };

            notification.style.background = colors[type] || colors.info;
            notification.textContent = message;

            document.body.appendChild(notification);

            // 显示动画
            requestAnimationFrame(() => {
                notification.style.transform = 'translateX(0)';
            });

            // 自动隐藏
            setTimeout(() => {
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 300);
            }, duration);

            return notification;
        }

        // 创建模态对话框
        static createModal(title, content, options = {}) {
            const modal = document.createElement('div');
            modal.className = 'emp-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 11000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.className = 'emp-modal-content';
            modalContent.style.cssText = `
                background: var(--background);
                border-radius: 12px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                max-width: 90vw;
                max-height: 90vh;
                overflow: auto;
                transform: scale(0.9);
                transition: all 0.3s ease;
                width: ${options.width || '500px'};
            `;

            modalContent.innerHTML = `
                <div class="emp-modal-header" style="
                    padding: 20px;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0; color: var(--text);">${title}</h3>
                    <button class="emp-modal-close emp-button" style="padding: 5px 10px;">✕</button>
                </div>
                <div class="emp-modal-body" style="padding: 20px;">
                    ${content}
                </div>
            `;

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // 绑定关闭事件
            const closeBtn = modal.querySelector('.emp-modal-close');
            const closeModal = () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            };

            closeBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // 显示模态框
            requestAnimationFrame(() => {
                modal.style.opacity = '1';
                modal.style.visibility = 'visible';
                modalContent.style.transform = 'scale(1)';
            });

            return modal;
        }

        // 初始化组件系统
        static init() {
            this.injectGlobalStyles();
            
            // 监听主题偏好变化
            if (window.matchMedia) {
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQuery.addListener((e) => {
                    this.switchTheme(e.matches ? 'dark' : 'light');
                });
            }
        }
    }

    window.UIComponents = UIComponents;
    console.log('[EMP] UIComponents module loaded');

})();

// ========== main/EnhancedMediaPlayerPro.js ==========
(function() {
    'use strict';

    if (window.EnhancedMediaPlayerPro) return;

    class EnhancedMediaPlayerPro {
        constructor() {
            this.version = '2.0.0';
            this.modules = new Map();
            this.eventBus = this.createEventBus();
            this.isInitialized = false;
            
            this.config = {
                features: {
                    autoDetection: true,
                    syncPlayback: true,
                    danmaku: true,
                    performance: true
                }
            };

            this.init();
        }

        async init() {
            try {
                // 等待依赖模块
                await this.waitForDependencies();
                
                // 初始化UI
                UIComponents.init();
                
                // 初始化bcModSdk集成
                this.initializeModSdk();
                
                // 设置事件处理
                this.setupEventHandlers();
                
                this.isInitialized = true;
                this.eventBus.emit('app:initialized');
                
                console.log('[EMP] Enhanced Media Player Pro v' + this.version + ' initialized');
                this.showWelcomeMessage();
                
            } catch (error) {
                console.error('[EMP] Initialization failed:', error);
                this.handleInitializationError(error);
            }
        }

        // 等待依赖模块
        async waitForDependencies() {
            const required = ['MediaUtils', 'UIComponents'];
            const maxWait = 10000; // 10秒超时
            const startTime = Date.now();
            
            while (Date.now() - startTime < maxWait) {
                const missing = required.filter(dep => !window[dep]);
                if (missing.length === 0) {
                    return true;
                }
                
                console.log('[EMP] Waiting for dependencies:', missing);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            throw new Error('Required dependencies not available: ' + required.filter(dep => !window[dep]));
        }

        // 初始化bcModSdk集成
        initializeModSdk() {
            if (typeof bcModSdk !== 'undefined' && bcModSdk.registerMod) {
                this.mod = bcModSdk.registerMod({
                    name: "Enhanced Media Player Pro",
                    fullName: "Enhanced Media Player Pro v" + this.version,
                    version: this.version,
                    repository: "Enhanced Media Player with Auto-Detection & Sync"
                });

                this.setupModHooks();
                console.log('[EMP] bcModSdk integration enabled');
            } else {
                console.log('[EMP] Running without bcModSdk integration');
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
        }

        // 设置事件处理
        setupEventHandlers() {
            // 全局键盘快捷键
            document.addEventListener('keydown', (e) => {
                this.handleGlobalKeyDown(e);
            });
        }

        // 处理全局键盘事件
        handleGlobalKeyDown(event) {
            // Ctrl + Shift + M: 切换媒体播放器
            if (event.ctrlKey && event.shiftKey && event.key === 'M') {
                event.preventDefault();
                this.togglePlayer();
            }
        }

        // 绘制房间按钮
        drawRoomButton() {
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
            const x = 965, y = 825, w = 40, h = 40;
            
            if (typeof MouseIn === 'function' && MouseIn(x, y, w, h)) {
                this.togglePlayer();
                return true;
            }
            
            return false;
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
            // 创建简单的播放器窗口
            if (this.playerWindow) return;
            
            this.playerWindow = document.createElement('div');
            this.playerWindow.className = 'emp-player-window';
            this.playerWindow.style.cssText = `
                position: fixed;
                top: 10%;
                left: 50%;
                transform: translateX(-50%);
                width: 80vw;
                max-width: 1000px;
                height: 60vh;
                background: var(--background);
                border: 1px solid var(--border);
                border-radius: 15px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                z-index: 10000;
                display: flex;
                flex-direction: column;
            `;

            this.playerWindow.innerHTML = `
                <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--surface);">
                    <h3 style="margin: 0; color: var(--text);">Enhanced Media Player Pro</h3>
                    <button class="emp-close-btn emp-button" style="padding: 5px 10px;">✕</button>
                </div>
                <div style="flex: 1; padding: 20px; color: var(--text);">
                    <p>播放器界面开发中...</p>
                    <p>功能预览：</p>
                    <ul>
                        <li>✅ 智能媒体链接检测</li>
                        <li>✅ 多平台支持 (YouTube, Bilibili, Twitch 等)</li>
                        <li>🔄 多人同步播放</li>
                        <li>💬 实时弹幕系统</li>
                        <li>⚙️ 用户偏好设置</li>
                    </ul>
                </div>
            `;

            document.body.appendChild(this.playerWindow);

            // 绑定关闭事件
            this.playerWindow.querySelector('.emp-close-btn').addEventListener('click', () => {
                this.closePlayer();
            });

            this.eventBus.emit('player:opened');
            UIComponents.showNotification('播放器已打开', 'success');
        }

        // 关闭播放器
        closePlayer() {
            if (this.playerWindow) {
                this.playerWindow.remove();
                this.playerWindow = null;
                this.eventBus.emit('player:closed');
                UIComponents.showNotification('播放器已关闭', 'info');
            }
        }

        // 处理聊天消息
        handleChatMessage(data) {
            // 这里可以处理同步消息等
            console.log('[EMP] Chat message:', data);
        }

        // 房间加载完成
        onRoomLoad() {
            if (!window.empWelcomed) {
                setTimeout(() => this.showWelcomeMessage(), 2000);
                window.empWelcomed = true;
            }
        }

        // 显示欢迎消息
        showWelcomeMessage() {
            if (typeof ChatRoomSendLocal !== 'function') return;

            const supportedFormats = Object.keys(MediaUtils.SUPPORTED_FORMATS.video).slice(0, 6).join(', ');
            const supportedPlatforms = Object.keys(MediaUtils.PLATFORM_CONFIGS).slice(0, 5).join(', ');
            
            const message = `
                <div style='background: linear-gradient(135deg, #6c5ce7, #a29bfe); 
                     color: white; padding: 15px; border-radius: 10px; margin: 10px 0; 
                     box-shadow: 0 4px 15px rgba(0,0,0,0.3);'>
                    <h3>🎬 Enhanced Media Player Pro v${this.version}</h3>
                    <p><strong>✨ 核心特性:</strong></p>
                    <ul style='margin: 5px 0; padding-left: 20px; font-size: 14px;'>
                        <li>🎯 智能媒体链接检测</li>
                        <li>🌐 多平台支持: ${supportedPlatforms}</li>
                        <li>📁 多格式支持: ${supportedFormats} 等</li>
                        <li>🎮 多人同步播放 (开发中)</li>
                        <li>💬 实时弹幕系统 (开发中)</li>
                        <li>🎨 现代化UI设计</li>
                    </ul>
                    <p style='font-size: 13px; opacity: 0.9; margin-top: 10px;'>
                        <strong>快捷键:</strong> Ctrl+Shift+M 切换播放器 | 
                        点击右上角 🎬 按钮开始使用
                    </p>
                </div>
            `;

            ChatRoomSendLocal(message, 15000);
        }

        // 处理初始化错误
        handleInitializationError(error) {
            console.error('[EMP] Initialization error:', error);
            
            setTimeout(() => {
                if (typeof ChatRoomSendLocal === 'function') {
                    ChatRoomSendLocal(
                        '<p style="background-color:#e74c3c;color:white;padding:10px;border-radius:5px;">' +
                        '⚠️ Enhanced Media Player Pro 启动失败: ' + error.message +
                        '</p>',
                        10000
                    );
                }
            }, 2000);
        }

        // 检查播放器是否激活
        isPlayerActive() {
            return this.playerWindow !== null;
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
                features: this.config.features
            };
        }
    }

    // 创建全局实例
    window.EnhancedMediaPlayerPro = new EnhancedMediaPlayerPro();
    console.log('[EMP] Main application loaded');

})();
