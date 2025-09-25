// MediaUtils.js - 媒体处理工具模块
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
        twitch: {
            regex: /twitch\.tv\/(?:(?:videos\/([0-9]+))|([a-zA-Z0-9_]+))(?:[\/?].*)?/,
            extractId: (url) => {
                const videoMatch = url.match(/twitch\.tv\/videos\/([0-9]+)/);
                const channelMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)(?:[\/?].*)?$/);
                return {
                    id: videoMatch ? videoMatch[1] : channelMatch[1],
                    type: videoMatch ? 'video' : 'channel'
                };
            },
            getEmbedUrl: (data) => {
                const domain = window.location.hostname;
                return data.type === 'video'
                    ? `https://player.twitch.tv/?video=${data.id}&parent=${domain}&autoplay=false`
                    : `https://player.twitch.tv/?channel=${data.id}&parent=${domain}&autoplay=false`;
            },
            name: 'Twitch',
            icon: '🟣',
            color: '#9146ff'
        },
        vimeo: {
            regex: /vimeo\.com\/([0-9]+)/,
            extractId: (url) => {
                const match = url.match(/vimeo\.com\/([0-9]+)/);
                return match ? match[1] : null;
            },
            getEmbedUrl: (id) => `https://player.vimeo.com/video/${id}`,
            name: 'Vimeo',
            icon: '🔵',
            color: '#1ab7ea'
        },
        niconico: {
            regex: /nicovideo\.jp\/watch\/(sm[0-9]+|so[0-9]+|nm[0-9]+)/,
            extractId: (url) => {
                const match = url.match(/nicovideo\.jp\/watch\/(sm[0-9]+|so[0-9]+|nm[0-9]+)/);
                return match ? match[1] : null;
            },
            getEmbedUrl: (id) => `https://embed.nicovideo.jp/watch/${id}`,
            name: 'Niconico',
            icon: '📹',
            color: '#ff6b35'
        }
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

    // 生成播放列表项
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

    // 生成唯一ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 解析播放列表文本
    static parsePlaylistText(text) {
        const lines = text.trim().split('\n').filter(line => line.trim());
        const items = [];
        
        for (let i = 0; i < lines.length; i += 2) {
            if (i + 1 < lines.length) {
                const name = lines[i].trim();
                const url = lines[i + 1].trim();
                
                const item = this.createPlaylistItem(url, name);
                if (item) {
                    items.push(item);
                }
            }
        }
        
        return items;
    }

    // 导出播放列表文本
    static exportPlaylistText(items) {
        return items.map(item => `${item.name}\n${item.originalUrl}`).join('\n');
    }

    // 获取缩略图
    static async getThumbnail(item) {
        if (item.type === 'platform' && item.platform === 'youtube') {
            return this.PLATFORM_CONFIGS.youtube.getThumbnail(item.platform === 'youtube' ? item.id : null);
        }
        
        // 对于直链视频，尝试生成缩略图（如果浏览器支持）
        if (item.type === 'direct' && item.mediaType === 'video') {
            return this.generateVideoThumbnail(item.url);
        }
        
        return null;
    }

    // 生成视频缩略图
    static generateVideoThumbnail(videoUrl) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.currentTime = 1; // 获取第1秒的帧
            
            video.addEventListener('loadeddata', () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                
                ctx.drawImage(video, 0, 0);
                
                const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
                resolve(thumbnail);
            });
            
            video.addEventListener('error', () => resolve(null));
            video.src = videoUrl;
        });
    }

    // 格式化时长
    static formatDuration(seconds) {
        if (isNaN(seconds)) return '--:--';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // 格式化文件大小
    static formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '--';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    }

    // 检测是否为移动端
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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

    // 深度克隆对象
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    // 安全的JSON解析
    static safeJSONParse(str, defaultValue = null) {
        try {
            return JSON.parse(str);
        } catch (error) {
            console.warn('JSON解析失败:', error);
            return defaultValue;
        }
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
}

// 导出给全局使用
if (typeof window !== 'undefined') {
    window.MediaUtils = MediaUtils;
}
