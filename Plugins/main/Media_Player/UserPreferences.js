// UserPreferences.js - 用户偏好设置与配置系统
class UserPreferencesManager {
    constructor() {
        this.storageKey = 'emp_user_preferences';
        this.defaultPreferences = {
            // 播放器设置
            player: {
                autoplay: false,
                volume: 0.8,
                muted: true,
                quality: 'auto',
                speed: 1.0,
                loop: false,
                pip: true,
                fullscreen: true
            },
            
            // UI设置
            ui: {
                theme: 'dark', // 'dark' | 'light' | 'auto'
                language: 'auto', // 'zh' | 'en' | 'ja' | 'auto'
                showThumbnails: true,
                compactMode: false,
                animations: true,
                tooltips: true,
                sidebarPosition: 'right' // 'left' | 'right'
            },
            
            // 同步设置
            sync: {
                enabled: true,
                autoSync: true,
                syncThreshold: 2.0,
                showSyncNotifications: true,
                allowRemoteControl: false,
                sharePlaylist: true
            },
            
            // 弹幕设置
            danmaku: {
                enabled: true,
                opacity: 0.8,
                speed: 8,
                fontSize: 'medium', // 'small' | 'medium' | 'large'
                area: 1.0, // 弹幕区域比例
                unlimited: false,
                merge: true,
                bold: false,
                color: '#ffffff'
            },
            
            // 自动检测设置
            autoDetection: {
                enabled: true,
                platforms: {
                    youtube: true,
                    bilibili: true,
                    twitch: true,
                    vimeo: true,
                    niconico: true
                },
                formats: {
                    video: true,
                    audio: true,
                    playlist: true
                },
                showButtons: true,
                autoPreload: false
            },
            
            // 性能设置
            performance: {
                cacheEnabled: true,
                cacheSize: 50,
                preloadCount: 3,
                qualityAdjustment: 'auto', // 'auto' | 'manual'
                memoryMonitoring: true,
                backgroundOptimization: true
            },
            
            // 隐私设置
            privacy: {
                saveHistory: true,
                savePlaylist: true,
                analyticsEnabled: false,
                errorReporting: true,
                shareUsageData: false
            },
            
            // 键盘快捷键
            shortcuts: {
                togglePlayer: 'Ctrl+Shift+M',
                playPause: 'Space',
                volumeUp: 'ArrowUp',
                volumeDown: 'ArrowDown',
                seekForward: 'ArrowRight',
                seekBackward: 'ArrowLeft',
                fullscreen: 'F',
                mute: 'M',
                nextItem: 'N',
                prevItem: 'P'
            }
        };
        
        this.currentPreferences = null;
        this.changeListeners = [];
        
        this.init();
    }

    init() {
        this.loadPreferences();
        this.setupAutoSave();
        this.applyPreferences();
    }

    // 加载用户偏好
    loadPreferences() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.currentPreferences = this.mergeWithDefaults(parsed);
            } else {
                this.currentPreferences = { ...this.defaultPreferences };
            }
        } catch (error) {
            console.warn('加载用户偏好失败，使用默认设置:', error);
            this.currentPreferences = { ...this.defaultPreferences };
        }
    }

    // 合并默认设置
    mergeWithDefaults(userPrefs) {
        const merged = JSON.parse(JSON.stringify(this.defaultPreferences));
        
        Object.keys(userPrefs).forEach(category => {
            if (merged[category]) {
                Object.assign(merged[category], userPrefs[category]);
            }
        });
        
        return merged;
    }

    // 保存用户偏好
    savePreferences() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentPreferences));
        } catch (error) {
            console.error('保存用户偏好失败:', error);
        }
    }

    // 设置自动保存
    setupAutoSave() {
        // 每10秒自动保存一次
        setInterval(() => {
            this.savePreferences();
        }, 10000);
        
        // 页面卸载时保存
        window.addEventListener('beforeunload', () => {
            this.savePreferences();
        });
    }

    // 应用偏好设置
    applyPreferences() {
        const prefs = this.currentPreferences;
        
        // 应用主题
        if (prefs.ui.theme === 'auto') {
            const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            UIComponents.switchTheme(darkMode ? 'dark' : 'light');
        } else {
            UIComponents.switchTheme(prefs.ui.theme);
        }
        
        // 应用语言
        this.applyLanguage(prefs.ui.language);
        
        // 应用动画设置
        document.body.classList.toggle('no-animations', !prefs.ui.animations);
        
        // 应用紧凑模式
        document.body.classList.toggle('compact-mode', prefs.ui.compactMode);
        
        // 通知监听器
        this.notifyListeners('all', prefs);
    }

    // 应用语言设置
    applyLanguage(language) {
        if (language === 'auto') {
            language = navigator.language.startsWith('zh') ? 'zh' : 'en';
        }
        
        document.documentElement.lang = language;
        this.currentLanguage = language;
    }

    // 获取偏好设置
    get(category, key = null) {
        if (key) {
            return this.currentPreferences[category]?.[key];
        }
        return this.currentPreferences[category];
    }

    // 设置偏好
    set(category, key, value = null) {
        if (value === null && typeof key === 'object') {
            // 批量设置
            Object.assign(this.currentPreferences[category], key);
            this.notifyListeners(category, this.currentPreferences[category]);
        } else {
            // 单个设置
            if (!this.currentPreferences[category]) {
                this.currentPreferences[category] = {};
            }
            this.currentPreferences[category][key] = value;
            this.notifyListeners(`${category}.${key}`, value);
        }
        
        this.applySpecificPreference(category, key, value);
    }

    // 应用特定偏好设置
    applySpecificPreference(category, key, value) {
        switch (category) {
            case 'ui':
                if (key === 'theme') {
                    UIComponents.switchTheme(value);
                } else if (key === 'animations') {
                    document.body.classList.toggle('no-animations', !value);
                }
                break;
                
            case 'player':
                this.applyPlayerPreference(key, value);
                break;
                
            case 'danmaku':
                this.applyDanmakuPreference(key, value);
                break;
        }
    }

    // 应用播放器偏好
    applyPlayerPreference(key, value) {
        const playerInstance = window.EnhancedMediaPlayerPro?.modules?.get('videoPlayer');
        if (!playerInstance?.artPlayer) return;
        
        const player = playerInstance.artPlayer;
        
        switch (key) {
            case 'volume':
                player.volume = value;
                break;
            case 'muted':
                player.muted = value;
                break;
            case 'speed':
                player.playbackRate = value;
                break;
        }
    }

    // 应用弹幕偏好
    applyDanmakuPreference(key, value) {
        const playerInstance = window.EnhancedMediaPlayerPro?.modules?.get('videoPlayer');
        const danmaku = playerInstance?.artPlayer?.plugins?.artplayerPluginDanmaku;
        if (!danmaku) return;
        
        switch (key) {
            case 'opacity':
                danmaku.config.opacity = value;
                break;
            case 'speed':
                danmaku.config.speed = value;
                break;
        }
    }

    // 重置到默认设置
    reset(category = null) {
        if (category) {
            this.currentPreferences[category] = { ...this.defaultPreferences[category] };
            this.notifyListeners(category, this.currentPreferences[category]);
        } else {
            this.currentPreferences = { ...this.defaultPreferences };
            this.applyPreferences();
        }
        
        this.savePreferences();
    }

    // 导出设置
    export() {
        return JSON.stringify(this.currentPreferences, null, 2);
    }

    // 导入设置
    import(settingsJson) {
        try {
            const imported = JSON.parse(settingsJson);
            this.currentPreferences = this.mergeWithDefaults(imported);
            this.applyPreferences();
            this.savePreferences();
            return true;
        } catch (error) {
            console.error('导入设置失败:', error);
            return false;
        }
    }

    // 添加变更监听器
    onChange(listener) {
        this.changeListeners.push(listener);
    }

    // 移除变更监听器
    offChange(listener) {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    // 通知监听器
    notifyListeners(path, value) {
        this.changeListeners.forEach(listener => {
            try {
                listener(path, value);
            } catch (error) {
                console.error('偏好变更监听器错误:', error);
            }
        });
    }

    // 创建设置面板
    createSettingsPanel() {
        const panel = document.createElement('div');
        panel.className = 'emp-settings-panel';
        panel.innerHTML = this.getSettingsPanelHTML();
        
        this.bindSettingsPanelEvents(panel);
        return panel;
    }

    // 设置面板HTML
    getSettingsPanelHTML() {
        return `
            <div class="emp-settings-header">
                <h3>设置</h3>
                <button class="emp-settings-close">✕</button>
            </div>
            <div class="emp-settings-tabs">
                <button class="emp-tab-btn active" data-tab="player">播放器</button>
                <button class="emp-tab-btn" data-tab="ui">界面</button>
                <button class="emp-tab-btn" data-tab="sync">同步</button>
                <button class="emp-tab-btn" data-tab="danmaku">弹幕</button>
                <button class="emp-tab-btn" data-tab="performance">性能</button>
                <button class="emp-tab-btn" data-tab="privacy">隐私</button>
            </div>
            <div class="emp-settings-content">
                ${this.getPlayerSettingsHTML()}
                ${this.getUISettingsHTML()}
                ${this.getSyncSettingsHTML()}
                ${this.getDanmakuSettingsHTML()}
                ${this.getPerformanceSettingsHTML()}
                ${this.getPrivacySettingsHTML()}
            </div>
            <div class="emp-settings-footer">
                <button class="emp-btn emp-export-btn">导出设置</button>
                <button class="emp-btn emp-import-btn">导入设置</button>
                <button class="emp-btn emp-reset-btn">重置为默认</button>
            </div>
        `;
    }

    // 播放器设置HTML
    getPlayerSettingsHTML() {
        const prefs = this.currentPreferences.player;
        return `
            <div class="emp-tab-pane active" data-tab="player">
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.autoplay ? 'checked' : ''} data-pref="player.autoplay">
                        自动播放
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>音量: <span class="value">${Math.round(prefs.volume * 100)}%</span></label>
                    <input type="range" min="0" max="1" step="0.1" value="${prefs.volume}" data-pref="player.volume">
                </div>
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.muted ? 'checked' : ''} data-pref="player.muted">
                        默认静音
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>播放速度:</label>
                    <select data-pref="player.speed">
                        <option value="0.5" ${prefs.speed === 0.5 ? 'selected' : ''}>0.5x</option>
                        <option value="0.75" ${prefs.speed === 0.75 ? 'selected' : ''}>0.75x</option>
                        <option value="1" ${prefs.speed === 1 ? 'selected' : ''}>1x</option>
                        <option value="1.25" ${prefs.speed === 1.25 ? 'selected' : ''}>1.25x</option>
                        <option value="1.5" ${prefs.speed === 1.5 ? 'selected' : ''}>1.5x</option>
                        <option value="2" ${prefs.speed === 2 ? 'selected' : ''}>2x</option>
                    </select>
                </div>
            </div>
        `;
    }

    // UI设置HTML
    getUISettingsHTML() {
        const prefs = this.currentPreferences.ui;
        return `
            <div class="emp-tab-pane" data-tab="ui">
                <div class="emp-setting-group">
                    <label>主题:</label>
                    <select data-pref="ui.theme">
                        <option value="auto" ${prefs.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
                        <option value="dark" ${prefs.theme === 'dark' ? 'selected' : ''}>深色</option>
                        <option value="light" ${prefs.theme === 'light' ? 'selected' : ''}>浅色</option>
                    </select>
                </div>
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.animations ? 'checked' : ''} data-pref="ui.animations">
                        启用动画效果
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.compactMode ? 'checked' : ''} data-pref="ui.compactMode">
                        紧凑模式
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>侧栏位置:</label>
                    <select data-pref="ui.sidebarPosition">
                        <option value="right" ${prefs.sidebarPosition === 'right' ? 'selected' : ''}>右侧</option>
                        <option value="left" ${prefs.sidebarPosition === 'left' ? 'selected' : ''}>左侧</option>
                    </select>
                </div>
            </div>
        `;
    }

    // 其他设置HTML方法...
    getSyncSettingsHTML() {
        const prefs = this.currentPreferences.sync;
        return `
            <div class="emp-tab-pane" data-tab="sync">
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.enabled ? 'checked' : ''} data-pref="sync.enabled">
                        启用同步播放
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>同步阈值: <span class="value">${prefs.syncThreshold}秒</span></label>
                    <input type="range" min="0.5" max="5" step="0.5" value="${prefs.syncThreshold}" data-pref="sync.syncThreshold">
                </div>
            </div>
        `;
    }

    getDanmakuSettingsHTML() {
        const prefs = this.currentPreferences.danmaku;
        return `
            <div class="emp-tab-pane" data-tab="danmaku">
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.enabled ? 'checked' : ''} data-pref="danmaku.enabled">
                        启用弹幕
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>透明度: <span class="value">${Math.round(prefs.opacity * 100)}%</span></label>
                    <input type="range" min="0.1" max="1" step="0.1" value="${prefs.opacity}" data-pref="danmaku.opacity">
                </div>
            </div>
        `;
    }

    getPerformanceSettingsHTML() {
        const prefs = this.currentPreferences.performance;
        return `
            <div class="emp-tab-pane" data-tab="performance">
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.cacheEnabled ? 'checked' : ''} data-pref="performance.cacheEnabled">
                        启用缓存
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>缓存大小: <span class="value">${prefs.cacheSize}</span></label>
                    <input type="range" min="10" max="200" step="10" value="${prefs.cacheSize}" data-pref="performance.cacheSize">
                </div>
            </div>
        `;
    }

    getPrivacySettingsHTML() {
        const prefs = this.currentPreferences.privacy;
        return `
            <div class="emp-tab-pane" data-tab="privacy">
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.saveHistory ? 'checked' : ''} data-pref="privacy.saveHistory">
                        保存播放历史
                    </label>
                </div>
                <div class="emp-setting-group">
                    <label>
                        <input type="checkbox" ${prefs.errorReporting ? 'checked' : ''} data-pref="privacy.errorReporting">
                        错误报告
                    </label>
                </div>
            </div>
        `;
    }

    // 绑定设置面板事件
    bindSettingsPanelEvents(panel) {
        // 标签页切换
        panel.querySelectorAll('.emp-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                
                // 更新按钮状态
                panel.querySelectorAll('.emp-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 更新面板显示
                panel.querySelectorAll('.emp-tab-pane').forEach(pane => {
                    pane.classList.toggle('active', pane.dataset.tab === tab);
                });
            });
        });

        // 设置值变更
        panel.querySelectorAll('[data-pref]').forEach(input => {
            const prefPath = input.dataset.pref.split('.');
            const [category, key] = prefPath;

            input.addEventListener('change', () => {
                let value = input.type === 'checkbox' ? input.checked : 
                           input.type === 'range' ? parseFloat(input.value) :
                           input.value;

                this.set(category, key, value);
                
                // 更新显示值
                const valueSpan = input.parentElement.querySelector('.value');
                if (valueSpan) {
                    if (input.type === 'range' && input.max === '1') {
                        valueSpan.textContent = Math.round(value * 100) + '%';
                    } else {
                        valueSpan.textContent = value;
                    }
                }
            });
        });

        // 导出设置
        panel.querySelector('.emp-export-btn').addEventListener('click', () => {
            const settings = this.export();
            MediaUtils.copyToClipboard(settings);
            UIComponents.showNotification('设置已复制到剪贴板', 'success');
        });

        // 导入设置
        panel.querySelector('.emp-import-btn').addEventListener('click', () => {
            const textarea = document.createElement('textarea');
            textarea.placeholder = '粘贴设置JSON...';
            textarea.style.width = '100%';
            textarea.style.height = '200px';
            
            const modal = UIComponents.createModal('导入设置', textarea.outerHTML + `
                <div style="margin-top: 10px; text-align: right;">
                    <button class="emp-btn emp-import-confirm">确认导入</button>
                </div>
            `);

            modal.querySelector('.emp-import-confirm').addEventListener('click', () => {
                const json = modal.querySelector('textarea').value;
                if (this.import(json)) {
                    UIComponents.showNotification('设置导入成功', 'success');
                    modal.querySelector('.emp-modal-close').click();
                } else {
                    UIComponents.showNotification('设置导入失败', 'danger');
                }
            });
        });

        // 重置设置
        panel.querySelector('.emp-reset-btn').addEventListener('click', () => {
            if (confirm('确定要重置所有设置为默认值吗？')) {
                this.reset();
                UIComponents.showNotification('设置已重置', 'success');
                // 重新加载面板
                panel.innerHTML = this.getSettingsPanelHTML();
                this.bindSettingsPanelEvents(panel);
            }
        });

        // 关闭面板
        panel.querySelector('.emp-settings-close').addEventListener('click', () => {
            panel.remove();
        });
    }
}

// 设置面板样式
const settingsPanelCSS = `
.emp-settings-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-width: 90vw;
    max-height: 80vh;
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 11000;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.emp-settings-header {
    padding: 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--surface);
}

.emp-settings-header h3 {
    margin: 0;
    color: var(--text);
}

.emp-settings-close {
    background: none;
    border: none;
    color: var(--text);
    font-size: 18px;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    transition: var(--transition);
}

.emp-settings-close:hover {
    background: var(--glass);
}

.emp-settings-tabs {
    display: flex;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
}

.emp-settings-tabs .emp-tab-btn {
    padding: 12px 20px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: var(--transition);
    white-space: nowrap;
    font-size: 14px;
}

.emp-settings-tabs .emp-tab-btn.active,
.emp-settings-tabs .emp-tab-btn:hover {
    color: var(--primary);
    background: var(--glass);
}

.emp-settings-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
}

.emp-tab-pane {
    display: none;
}

.emp-tab-pane.active {
    display: block;
}

.emp-setting-group {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--border);
}

.emp-setting-group:last-child {
    border-bottom: none;
}

.emp-setting-group label {
    display: block;
    color: var(--text);
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
}

.emp-setting-group input[type="range"] {
    width: 100%;
    margin-top: 5px;
}

.emp-setting-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-size: 14px;
}

.emp-setting-group input[type="checkbox"] {
    margin-right: 8px;
}

.emp-setting-group .value {
    color: var(--primary);
    font-weight: 500;
    margin-left: 5px;
}

.emp-settings-footer {
    padding: 20px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    background: var(--surface);
}

@media (max-width: 768px) {
    .emp-settings-panel {
        width: 95vw;
        height: 90vh;
    }
    
    .emp-settings-tabs {
        flex-wrap: nowrap;
        overflow-x: scroll;
    }
    
    .emp-settings-footer {
        flex-direction: column;
    }
}
`;

// 注入样式
function injectSettingsCSS() {
    if (!document.getElementById('emp-settings-css')) {
        const style = document.createElement('style');
        style.id = 'emp-settings-css';
        style.textContent = settingsPanelCSS;
        document.head.appendChild(style);
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.UserPreferencesManager = UserPreferencesManager;
    
    // 自动注入样式
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectSettingsCSS);
    } else {
        injectSettingsCSS();
    }
}
