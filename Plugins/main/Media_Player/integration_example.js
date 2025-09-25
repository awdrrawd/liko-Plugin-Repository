// 完整集成示例 - integration_example.js

// 1. 基本的多文件引入方式
function loadEnhancedMediaPlayer() {
    const scriptsToLoad = [
        'MediaUtils.js',
        'UIComponents.js', 
        'enhanced_media_player.js'
    ];

    let loadedCount = 0;
    
    scriptsToLoad.forEach(src => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
            loadedCount++;
            if (loadedCount === scriptsToLoad.length) {
                initializePlayer();
            }
        };
        document.head.appendChild(script);
    });
}

// 2. 或者使用 UserScript 的 @require 方式
// ==UserScript==
// @require MediaUtils.js
// @require UIComponents.js
// @require enhanced_media_player.js
// ==

// 3. 实际使用示例
function initializePlayer() {
    // 检查是否已加载
    if (window.EnhancedMediaPlayerPro) {
        console.log('Enhanced Media Player Pro 已启动');
        return;
    }

    // 自定义配置
    const customConfig = {
        // 添加自定义平台支持
        PLATFORMS: {
            ...CONFIG.PLATFORMS,
            // 添加更多平台
            dailymotion: {
                regex: /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
                extractId: (url) => {
                    const match = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
                    return match ? match[1] : null;
                },
                getEmbedUrl: (id) => `https://www.dailymotion.com/embed/video/${id}`,
                name: 'Dailymotion',
                icon: '🎬',
                color: '#ff7900'
            }
        },
        
        // 自定义主题
        THEME: {
            primary: '#667eea',
            secondary: '#764ba2',
            // ... 其他颜色配置
        }
    };

    // 启动播放器
    window.enhancedPlayer = new EnhancedMediaPlayerPro(customConfig);
}

// 4. API使用示例
class PlaylistManager {
    constructor(playerInstance) {
        this.player = playerInstance;
    }

    // 批量添加媒体
    async addMediaBatch(urls) {
        const items = [];
        for (const url of urls) {
            const item = MediaUtils.createPlaylistItem(url);
            if (item) {
                // 验证URL
                const validation = await MediaUtils.validateMediaUrl(url);
                if (validation.valid) {
                    items.push(item);
                }
            }
        }
        
        this.player.videoPlayer.playlist.push(...items);
        this.updateUI();
        return items;
    }

    // 导入播放列表
    importFromText(playlistText) {
        const items = MediaUtils.parsePlaylistText(playlistText);
        this.player.videoPlayer.playlist.push(...items);
        this.updateUI();
        return items.length;
    }

    // 智能排序
    smartSort() {
        const playlist = this.player.videoPlayer.playlist;
        
        // 按平台和类型分组排序
        playlist.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'platform' ? -1 : 1;
            }
            if (a.platform !== b.platform) {
                return (a.platform || '').localeCompare(b.platform || '');
            }
            return a.name.localeCompare(b.name);
        });

        this.updateUI();
    }

    updateUI() {
        if (this.player.videoPlayer.isActive) {
            this.player.uiManager.renderPlaylist();
        }
    }
}

// 5. 聊天集成示例
class ChatMediaEnhancer {
    constructor(playerInstance) {
        this.player = playerInstance;
        this.processedMessages = new Set();
    }

    // 扫描聊天消息
    scanChatMessages() {
        const messages = document.querySelectorAll('.chat-message, [role="log"] > div');
        
        messages.forEach(message => {
            const messageId = this.getMessageId(message);
            if (this.processedMessages.has(messageId)) return;
            
            this.processMessage(message);
            this.processedMessages.add(messageId);
        });
    }

    processMessage(messageElement) {
        const text = messageElement.textContent;
        const urls = this.extractUrls(text);
        
        urls.forEach(url => {
            const mediaInfo = MediaUtils.detectUrlType(url);
            if (mediaInfo) {
                this.addMediaButton(messageElement, url, mediaInfo);
            }
        });
    }

    extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    addMediaButton(messageElement, url, mediaInfo) {
        const button = UIComponents.createPlayButton({
            icon: mediaInfo.type === 'platform' ? mediaInfo.config.icon : '🎬',
            tooltip: `播放 ${mediaInfo.type === 'platform' ? mediaInfo.config.name : '媒体'}`,
            onClick: () => this.handlePlayRequest(url, mediaInfo)
        });
        
        messageElement.appendChild(button);
    }

    handlePlayRequest(url, mediaInfo) {
        // 如果播放器未打开，先打开
        if (!this.player.videoPlayer.isActive) {
            this.player.videoPlayer.openPlayer();
        }
        
        // 添加到播放列表并播放
        const item = MediaUtils.createPlaylistItem(url);
        if (item) {
            this.player.videoPlayer.addAndPlay(item);
        }
    }

    getMessageId(element) {
        // 生成消息唯一标识
        return element.textContent.substring(0, 50) + element.offsetTop;
    }
}

// 6. 快捷操作示例
class QuickActions {
    static createPlaylistFromUrls(urls, name = '快速播放列表') {
        const items = urls.map(url => MediaUtils.createPlaylistItem(url))
                         .filter(item => item !== null);
        
        return {
            name: name,
            items: items,
            createdAt: new Date().toISOString(),
            export: () => MediaUtils.exportPlaylistText(items)
        };
    }

    static async validatePlaylist(playlist) {
        const results = await Promise.all(
            playlist.items.map(async item => {
                const validation = await MediaUtils.validateMediaUrl(item.url);
                return { item, validation };
            })
        );

        return {
            valid: results.filter(r => r.validation.valid),
            invalid: results.filter(r => !r.validation.valid),
            total: results.length
        };
    }

    static generateShareCode(playlist) {
        const data = {
            name: playlist.name,
            items: playlist.items.map(item => ({
                name: item.name,
                url: item.originalUrl
            }))
        };
        
        // 简单的base64编码，实际应用中可能需要更安全的方式
        return btoa(JSON.stringify(data));
    }

    static parseShareCode(code) {
        try {
            const data = JSON.parse(atob(code));
            return data;
        } catch (error) {
            console.error('分享代码解析失败:', error);
            return null;
        }
    }
}

// 7. 实际启动代码
(function() {
    'use strict';
    
    // 等待页面加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePlayer);
    } else {
        initializePlayer();
    }

    // 添加全局快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl + Shift + M 打开媒体播放器
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            if (window.EnhancedMediaPlayerPro) {
                window.EnhancedMediaPlayerPro.toggle();
            }
        }
    });

    // 导出到全局供其他脚本使用
    window.EMP = {
        PlaylistManager,
        ChatMediaEnhancer,
        QuickActions,
        MediaUtils,
        UIComponents
    };
})();
