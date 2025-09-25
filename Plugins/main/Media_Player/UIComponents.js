// UIComponents.js - UI组件与样式系统
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

    // 获取全局CSS
    static getGlobalCSS() {
        return `
            /* Enhanced Media Player 全局样式 */
            .emp-player-window {
                --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                --border-radius: 12px;
                --border-radius-sm: 6px;
                --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.3);
                --shadow-md: 0 8px 25px rgba(0, 0, 0, 0.15);
                --shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.1);
                --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                --backdrop-blur: blur(20px);
                
                position: fixed;
                font-family: var(--font-family);
                font-size: 14px;
                line-height: 1.5;
                z-index: 10000;
                backdrop-filter: var(--backdrop-blur);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-lg);
                transition: var(--transition);
            }

            .emp-glassmorphism {
                backdrop-filter: var(--backdrop-blur);
                -webkit-backdrop-filter: var(--backdrop-blur);
            }

            .emp-button {
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                border: none;
                border-radius: var(--border-radius-sm);
                color: var(--text);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-family: inherit;
                font-size: 14px;
                font-weight: 500;
                gap: 8px;
                padding: 10px 16px;
                transition: var(--transition);
                user-select: none;
                white-space: nowrap;
                min-height: 36px;
            }

            .emp-button:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-md);
            }

            .emp-button:active {
                transform: translateY(0);
            }

            .emp-button--small {
                padding: 6px 12px;
                font-size: 12px;
                min-height: 28px;
            }

            .emp-button--large {
                padding: 14px 24px;
                font-size: 16px;
                min-height: 44px;
            }

            .emp-button--success {
                background: linear-gradient(135deg, var(--success), #00a085);
            }

            .emp-button--danger {
                background: linear-gradient(135deg, var(--danger), #d63384);
            }

            .emp-button--warning {
                background: linear-gradient(135deg, var(--warning), #e67e22);
            }

            .emp-button--ghost {
                background: var(--glass);
                border: 1px solid var(--border);
            }

            .emp-input {
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--border-radius-sm);
                color: var(--text);
                font-family: inherit;
                font-size: 14px;
                padding: 10px 12px;
                transition: var(--transition);
                width: 100%;
            }

            .emp-input:focus {
                border-color: var(--primary);
                box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.1);
                outline: none;
            }

            .emp-input::placeholder {
                color: var(--text-muted);
            }

            .emp-modal {
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
                transition: var(--transition);
            }

            .emp-modal.show {
                opacity: 1;
                visibility: visible;
            }

            .emp-modal-content {
                background: var(--background);
                border-radius: var(--border-radius);
                box-shadow: var(--shadow-lg);
                max-width: 90vw;
                max-height: 90vh;
                overflow: auto;
                transform: scale(0.9);
                transition: var(--transition);
            }

            .emp-modal.show .emp-modal-content {
                transform: scale(1);
            }

            .emp-card {
                background: var(--surface);
                border-radius: var(--border-radius-sm);
                border: 1px solid var(--border);
                box-shadow: var(--shadow-sm);
                overflow: hidden;
                transition: var(--transition);
            }

            .emp-card:hover {
                box-shadow: var(--shadow-md);
                transform: translateY(-2px);
            }

            .emp-scrollbar {
                scrollbar-width: thin;
                scrollbar-color: var(--border) transparent;
            }

            .emp-scrollbar::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            .emp-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }

            .emp-scrollbar::-webkit-scrollbar-thumb {
                background: var(--border);
                border-radius: 4px;
            }

            .emp-scrollbar::-webkit-scrollbar-thumb:hover {
                background: var(--text-muted);
            }

            .emp-tooltip {
                position: relative;
            }

            .emp-tooltip::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: var(--transition);
                pointer-events: none;
                z-index: 1000;
                margin-bottom: 5px;
            }

            .emp-tooltip:hover::after {
                opacity: 1;
                visibility: visible;
            }

            .emp-grid {
                display: grid;
                gap: 16px;
            }

            .emp-grid--2 { grid-template-columns: repeat(2, 1fr); }
            .emp-grid--3 { grid-template-columns: repeat(3, 1fr); }
            .emp-grid--4 { grid-template-columns: repeat(4, 1fr); }

            @media (max-width: 768px) {
                .emp-grid--2,
                .emp-grid--3,
                .emp-grid--4 {
                    grid-template-columns: 1fr;
                }
                
                .emp-player-window {
                    width: 95vw !important;
                    height: 85vh !important;
                    top: 7.5vh !important;
                    left: 2.5vw !important;
                    transform: none !important;
                }
            }

            /* 动画效果 */
            @keyframes emp-fade-in {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }

            @keyframes emp-slide-in-right {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }

            @keyframes emp-bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-10px); }
                60% { transform: translateY(-5px); }
            }

            .emp-animate-fade-in { animation: emp-fade-in 0.5s ease-out; }
            .emp-animate-slide-in-right { animation: emp-slide-in-right 0.3s ease-out; }
            .emp-animate-bounce { animation: emp-bounce 1s; }

            /* 播放按钮样式 */
            .emp-play-button {
                background: linear-gradient(135deg, var(--primary), var(--secondary));
                border: none;
                border-radius: 50%;
                color: white;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                width: 40px;
                height: 40px;
                margin-left: 10px;
                transition: var(--transition);
                vertical-align: middle;
                position: relative;
                overflow: hidden;
            }

            .emp-play-button::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: var(--transition);
            }

            .emp-play-button:hover {
                transform: scale(1.1);
                box-shadow: 0 8px 25px rgba(108, 92, 231, 0.4);
            }

            .emp-play-button:hover::before {
                left: 100%;
            }

            /* 加载指示器 */
            .emp-loading {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid var(--border);
                border-radius: 50%;
                border-top-color: var(--primary);
                animation: emp-spin 1s ease-in-out infinite;
            }

            @keyframes emp-spin {
                to { transform: rotate(360deg); }
            }

            /* 响应式设计改进 */
            @media (max-width: 480px) {
                .emp-button {
                    padding: 8px 12px;
                    font-size: 13px;
                }
                
                .emp-play-button {
                    width: 35px;
                    height: 35px;
                    font-size: 18px;
                }
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

    // 创建播放器窗口
    static createPlayerWindow() {
        const window = document.createElement('div');
        window.className = 'emp-player-window emp-glassmorphism';
        
        // 默认位置和大小
        const isMobile = MediaUtils.isMobile();
        if (isMobile) {
            Object.assign(window.style, {
                width: '95vw',
                height: '85vh',
                top: '7.5vh',
                left: '2.5vw'
            });
        } else {
            Object.assign(window.style, {
                width: '80vw',
                maxWidth: '1200px',
                height: '70vh',
                top: '15vh',
                left: '50%',
                transform: 'translateX(-50%)'
            });
        }

        window.innerHTML = this.getPlayerWindowHTML();
        return window;
    }

    // 播放器窗口HTML
    static getPlayerWindowHTML() {
        return `
            <div class="emp-header">
                <div class="emp-header-left">
                    <button class="emp-button emp-button--small emp-sync-btn emp-tooltip" data-tooltip="同步播放">
                        <span class="emp-loading" style="display: none;"></span>
                        🔄
                    </button>
                    <button class="emp-button emp-button--small emp-theme-btn emp-tooltip" data-tooltip="切换主题">
                        🌓
                    </button>
                </div>
                <div class="emp-title">增强媒体播放器</div>
                <div class="emp-header-right">
                    <button class="emp-button emp-button--small emp-minimize-btn emp-tooltip" data-tooltip="最小化">─</button>
                    <button class="emp-button emp-button--small emp-button--danger emp-close-btn emp-tooltip" data-tooltip="关闭">✕</button>
                </div>
            </div>
            <div class="emp-content">
                <div class="emp-video-container">
                    <div id="emp-artplayer-container"></div>
                    <div class="emp-video-controls">
                        <button class="emp-button emp-button--ghost emp-fullscreen-btn">全屏</button>
                        <button class="emp-button emp-button--ghost emp-pip-btn">画中画</button>
                        <button class="emp-button emp-button--ghost emp-screenshot-btn">截图</button>
                    </div>
                </div>
                <div class="emp-sidebar emp-scrollbar">
                    <div class="emp-sidebar-header">
                        <div class="emp-sidebar-tabs">
                            <button class="emp-tab-btn active" data-tab="playlist">播放列表</button>
                            <button class="emp-tab-btn" data-tab="history">历史记录</button>
                        </div>
                    </div>
                    <div class="emp-tab-content">
                        <div class="emp-tab-pane active" id="emp-tab-playlist">
                            <div class="emp-playlist-controls">
                                <button class="emp-button emp-button--small emp-add-media-btn">➕ 添加</button>
                                <button class="emp-button emp-button--small emp-import-btn">📂 导入</button>
                                <button class="emp-button emp-button--small emp-clear-btn">🗑️ 清空</button>
                            </div>
                            <div class="emp-playlist-items"></div>
                        </div>
                        <div class="emp-tab-pane" id="emp-tab-history">
                            <div class="emp-history-items"></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="emp-status-bar">
                <div class="emp-status-left">
                    <span class="emp-connection-status">已连接</span>
                    <span class="emp-viewers-count">观看者: 1</span>
                </div>
                <div class="emp-status-right">
                    <span class="emp-current-time">00:00</span>
                    <span class="emp-duration">00:00</span>
                </div>
            </div>
        `;
    }

    // 创建模态对话框
    static createModal(title, content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'emp-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'emp-modal-content';
        modalContent.style.cssText = `
            width: ${options.width || '500px'};
            max-width: 90vw;
            padding: 0;
            overflow: hidden;
        `;

        modalContent.innerHTML = `
            <div class="emp-modal-header" style="
                padding: 20px;
                border-bottom: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--surface);
            ">
                <h3 style="margin: 0; color: var(--text);">${title}</h3>
                <button class="emp-modal-close emp-button emp-button--ghost emp-button--small">✕</button>
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
            modal.classList.add('show');
        });

        return modal;
    }

    // 创建添加媒体对话框
    static createAddMediaDialog(onConfirm, onCancel) {
        const content = `
            <form class="emp-add-media-form">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: var(--text);">媒体名称:</label>
                    <input type="text" name="name" class="emp-input" placeholder="输入媒体名称">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px; color: var(--text);">媒体地址:</label>
                    <input type="url" name="url" class="emp-input" placeholder="支持直链、YouTube、Bilibili等">
                    <div style="margin-top: 5px; font-size: 12px; color: var(--text-muted);">
                        支持格式: ${Object.keys(MediaUtils.SUPPORTED_FORMATS.video).join(', ')}<br>
                        支持平台: ${Object.keys(MediaUtils.PLATFORM_CONFIGS).map(p => MediaUtils.PLATFORM_CONFIGS[p].name).join(', ')}
                    </div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button type="button" class="emp-button emp-button--ghost emp-cancel-btn">取消</button>
                    <button type="submit" class="emp-button emp-confirm-btn">添加</button>
                </div>
            </form>
        `;

        const modal = this.createModal('添加媒体', content);
        const form = modal.querySelector('.emp-add-media-form');
        const nameInput = form.querySelector('input[name="name"]');
        const urlInput = form.querySelector('input[name="url"]');

        // 自动填充名称
        urlInput.addEventListener('input', () => {
            if (!nameInput.value && urlInput.value) {
                const urlInfo = MediaUtils.detectUrlType(urlInput.value);
                if (urlInfo) {
                    if (urlInfo.type === 'platform') {
                        nameInput.value = `${urlInfo.config.name} 视频`;
                    } else {
                        nameInput.value = MediaUtils.extractFileName(urlInput.value);
                    }
                }
            }
        });

        // 表单提交
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            
            if (!name || !url) {
                this.showNotification('请填写完整信息', 'warning');
                return;
            }

            const urlInfo = MediaUtils.detectUrlType(url);
            if (!urlInfo) {
                this.showNotification('不支持的媒体格式或平台', 'danger');
                return;
            }

            onConfirm && onConfirm(name, url);
            modal.querySelector('.emp-modal-close').click();
        });

        // 取消按钮
        modal.querySelector('.emp-cancel-btn').addEventListener('click', () => {
            onCancel && onCancel();
            modal.querySelector('.emp-modal-close').click();
        });

        return modal;
    }

    // 创建播放列表项目
    static createPlaylistItem(item, index, isActive = false) {
        const div = document.createElement('div');
        div.className = `emp-playlist-item emp-card ${isActive ? 'active' : ''}`;
        div.dataset.index = index;
        div.dataset.id = item.id;
        
        div.style.cssText = `
            margin-bottom: 8px;
            padding: 12px;
            cursor: pointer;
            transition: var(--transition);
            border-left: 3px solid ${isActive ? 'var(--primary)' : 'transparent'};
        `;

        const iconColor = item.type === 'platform' 
            ? MediaUtils.PLATFORM_CONFIGS[item.platform]?.color || 'var(--primary)'
            : 'var(--secondary)';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="font-size: 18px; color: ${iconColor};">${item.icon || '🎬'}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; color: var(--text); margin-bottom: 2px; truncate;">${item.name}</div>
                    <div style="font-size: 11px; color: var(--text-muted); truncate;">${MediaUtils.simplifyUrl(item.originalUrl)}</div>
                </div>
                <div class="emp-playlist-item-controls" style="display: flex; gap: 5px;">
                    <button class="emp-button emp-button--ghost emp-button--small emp-item-play-btn emp-tooltip" data-tooltip="播放">▶️</button>
                    <button class="emp-button emp-button--ghost emp-button--small emp-item-remove-btn emp-tooltip" data-tooltip="移除">🗑️</button>
                </div>
            </div>
        `;

        // 添加CSS类来处理文本截断
        const style = document.createElement('style');
        style.textContent = `
            .truncate {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `;
        if (!document.getElementById('truncate-style')) {
            style.id = 'truncate-style';
            document.head.appendChild(style);
        }

        return div;
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
            box-shadow: var(--shadow-lg);
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

    // 创建上下文菜单
    static createContextMenu(items, x, y) {
        const menu = document.createElement('div');
        menu.className = 'emp-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            padding: 8px 0;
            min-width: 150px;
            z-index: 11000;
            opacity: 0;
            transform: scale(0.9);
            transition: var(--transition);
        `;

        items.forEach(item => {
            if (item === 'separator') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: var(--border);
                    margin: 4px 0;
                `;
                menu.appendChild(separator);
                return;
            }

            const menuItem = document.createElement('div');
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: var(--text);
                font-size: 13px;
                transition: var(--transition);
                display: flex;
                align-items: center;
                gap: 8px;
            `;

            menuItem.innerHTML = `
                ${item.icon ? `<span>${item.icon}</span>` : ''}
                <span>${item.text}</span>
            `;

            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.background = 'var(--glass)';
            });

            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.background = 'transparent';
            });

            menuItem.addEventListener('click', () => {
                item.action && item.action();
                menu.remove();
            });

            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // 显示动画
        requestAnimationFrame(() => {
            menu.style.opacity = '1';
            menu.style.transform = 'scale(1)';
        });

        // 点击外部关闭
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);

        return menu;
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

// 自动初始化
if (typeof window !== 'undefined') {
    window.UIComponents = UIComponents;
    // 延迟初始化以确保DOM准备就绪
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => UIComponents.init());
    } else {
        UIComponents.init();
    }
}
