/**
 * BC Enhanced Media - Validation Module
 * URL驗證和安全檢查模組
 */

window.BCEnhancedMedia = window.BCEnhancedMedia || {};
window.BCEnhancedMedia.Validation = (function() {
    'use strict';

    // 設定選項
    const settings = {
        enableValidation: true,
        strictMode: false,
        allowedDomains: [], // 空陣列表示允許所有域名
        blockedDomains: ['malicious.com'], // 黑名單域名
        maxUrlLength: 2048,
        allowHTTP: true, // 是否允許非HTTPS
    };

    // 支援的協議
    const ALLOWED_PROTOCOLS = ['http:', 'https:'];

    // 惡意模式檢測
    const MALICIOUS_PATTERNS = [
        /javascript:/i,
        /data:.*script/i,
        /vbscript:/i,
        /about:/i,
        /file:/i,
        /<script/i,
        /eval\(/i,
        /setTimeout\(/i,
        /setInterval\(/i
    ];

    // B站相關域名
    const BILIBILI_DOMAINS = [
        'bilibili.com',
        'bilivideo.com',
        'hdslb.com',
        'biliapi.net'
    ];

    // 直播平台域名
    const STREAMING_DOMAINS = [
        'youtube.com',
        'youtu.be',
        'twitch.tv',
        'huya.com',
        'douyu.com',
        ...BILIBILI_DOMAINS
    ];

    // 獲取設定
    function getSettings() {
        return { ...settings };
    }

    // 更新設定
    function updateSettings(newSettings) {
        Object.assign(settings, newSettings);
    }

    // 基礎URL格式檢查
    function isValidURL(urlString) {
        try {
            const url = new URL(urlString);
            return ALLOWED_PROTOCOLS.includes(url.protocol);
        } catch (e) {
            return false;
        }
    }

    // 檢查URL長度
    function checkUrlLength(url) {
        return url.length <= settings.maxUrlLength;
    }

    // 檢查惡意模式
    function checkMaliciousPatterns(url) {
        return !MALICIOUS_PATTERNS.some(pattern => pattern.test(url));
    }

    // 檢查域名白名單/黑名單
    function checkDomainPolicy(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();

            // 檢查黑名單
            if (settings.blockedDomains.some(domain => hostname.includes(domain.toLowerCase()))) {
                return { valid: false, reason: '域名在黑名單中' };
            }

            // 如果有白名單，檢查是否在白名單中
            if (settings.allowedDomains.length > 0) {
                const inWhitelist = settings.allowedDomains.some(domain => 
                    hostname.includes(domain.toLowerCase())
                );
                if (!inWhitelist) {
                    return { valid: false, reason: '域名不在白名單中' };
                }
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, reason: '無法解析域名' };
        }
    }

    // 檢查協議安全性
    function checkProtocolSecurity(url) {
        try {
            const urlObj = new URL(url);
            if (!settings.allowHTTP && urlObj.protocol === 'http:') {
                return { valid: false, reason: '不允許HTTP協議，請使用HTTPS' };
            }
            return { valid: true };
        } catch (e) {
            return { valid: false, reason: '協議檢查失敗' };
        }
    }

    // 檢查文件類型
    function checkFileType(url) {
        const helpers = window.BCEnhancedMedia.Helpers;
        if (!helpers) return { valid: true }; // 如果helpers未載入，跳過檢查

        const extension = helpers.getFileExtension(url);
        const formats = helpers.getSupportedFormats();
        
        if (!extension) {
            // 可能是直播流或API，檢查域名
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                if (STREAMING_DOMAINS.some(domain => hostname.includes(domain))) {
                    return { valid: true, type: 'streaming' };
                }
                return { valid: true, type: 'unknown' }; // 允許未知類型
            } catch (e) {
                return { valid: false, reason: '無法確定文件類型' };
            }
        }

        // 檢查是否為支援格式
        const allFormats = [...formats.video, ...formats.audio, ...formats.playlist, ...formats.streaming];
        if (allFormats.includes(extension)) {
            let type = 'unknown';
            if (formats.video.includes(extension)) type = 'video';
            else if (formats.audio.includes(extension)) type = 'audio';
            else if (formats.playlist.includes(extension)) type = 'playlist';
            else if (formats.streaming.includes(extension)) type = 'streaming';
            
            return { valid: true, type };
        }

        return { valid: false, reason: `不支援的文件格式: .${extension}` };
    }

    // B站URL處理
    function processBilibiliURL(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            if (!BILIBILI_DOMAINS.some(domain => hostname.includes(domain))) {
                return { processed: false };
            }

            // 提取B站視頻ID
            let bvid = null;
            let aid = null;

            // 匹配BV號
            const bvidMatch = url.match(/BV([a-zA-Z0-9]+)/);
            if (bvidMatch) {
                bvid = 'BV' + bvidMatch[1];
            }

            // 匹配AV號
            const aidMatch = url.match(/av(\d+)/i);
            if (aidMatch) {
                aid = aidMatch[1];
            }

            if (bvid || aid) {
                return {
                    processed: true,
                    type: 'bilibili',
                    bvid,
                    aid,
                    originalUrl: url,
                    note: 'B站視頻需要特殊處理，可能需要額外步驟才能播放'
                };
            }

            return { processed: true, type: 'bilibili_other' };
        } catch (e) {
            return { processed: false };
        }
    }

    // YouTube URL處理
    function processYouTubeURL(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            
            if (!hostname.includes('youtube.com') && !hostname.includes('youtu.be')) {
                return { processed: false };
            }

            // 提取視頻ID
            let videoId = null;
            
            if (hostname.includes('youtu.be')) {
                videoId = urlObj.pathname.slice(1);
            } else if (hostname.includes('youtube.com')) {
                videoId = urlObj.searchParams.get('v');
            }

            if (videoId) {
                return {
                    processed: true,
                    type: 'youtube',
                    videoId,
                    originalUrl: url,
                    note: 'YouTube視頻可能需要嵌入播放器'
                };
            }

            return { processed: true, type: 'youtube_other' };
        } catch (e) {
            return { processed: false };
        }
    }

    // 主要驗證函數
    function validateURL(url, options = {}) {
        // 如果驗證被禁用，直接通過
        if (!settings.enableValidation && !options.forceValidation) {
            return {
                valid: true,
                url: url,
                type: 'unknown',
                skipReason: 'validation_disabled'
            };
        }

        const result = {
            valid: false,
            url: url,
            type: 'unknown',
            warnings: [],
            errors: [],
            processed: null
        };

        // 基礎格式檢查
        if (!isValidURL(url)) {
            result.errors.push('URL格式無效');
            return result;
        }

        // 長度檢查
        if (!checkUrlLength(url)) {
            result.errors.push(`URL過長，最大允許${settings.maxUrlLength}字符`);
            return result;
        }

        // 惡意模式檢查
        if (!checkMaliciousPatterns(url)) {
            result.errors.push('URL包含潛在惡意內容');
            return result;
        }

        // 域名政策檢查
        const domainCheck = checkDomainPolicy(url);
        if (!domainCheck.valid) {
            result.errors.push(domainCheck.reason);
            return result;
        }

        // 協議安全性檢查
        const protocolCheck = checkProtocolSecurity(url);
        if (!protocolCheck.valid) {
            if (settings.strictMode) {
                result.errors.push(protocolCheck.reason);
                return result;
            } else {
                result.warnings.push(protocolCheck.reason);
            }
        }

        // 文件類型檢查
        const typeCheck = checkFileType(url);
        if (!typeCheck.valid) {
            result.errors.push(typeCheck.reason);
            return result;
        }

        result.type = typeCheck.type;

        // 特殊平台處理
        const bilibiliResult = processBilibiliURL(url);
        if (bilibiliResult.processed) {
            result.processed = bilibiliResult;
            if (bilibiliResult.note) {
                result.warnings.push(bilibiliResult.note);
            }
        }

        const youtubeResult = processYouTubeURL(url);
        if (youtubeResult.processed) {
            result.processed = youtubeResult;
            if (youtubeResult.note) {
                result.warnings.push(youtubeResult.note);
            }
        }

        result.valid = true;
        return result;
    }

    // 批量驗證URL
    function validateURLs(urls) {
        return urls.map(url => validateURL(url));
    }

    // 檢查URL是否為直播流
    function isStreamingURL(url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.toLowerCase();
            return STREAMING_DOMAINS.some(domain => hostname.includes(domain)) ||
                   url.includes('.m3u8') ||
                   url.includes('manifest') ||
                   url.includes('playlist');
        } catch (e) {
            return false;
        }
    }

    // 生成安全的播放URL（如果需要代理或轉換）
    function generateSafePlayURL(originalUrl, validationResult) {
        // 基礎情況：直接返回原URL
        let playUrl = originalUrl;

        // 如果是B站視頻，可能需要特殊處理
        if (validationResult.processed && validationResult.processed.type === 'bilibili') {
            // 這裡可以實現B站視頻的URL轉換邏輯
            // 暫時返回原URL
        }

        // 如果是YouTube視頻，可能需要嵌入處理
        if (validationResult.processed && validationResult.processed.type === 'youtube') {
            // 可以轉換為embed URL
            const videoId = validationResult.processed.videoId;
            if (videoId) {
                // 注意：這需要iframe嵌入，不是直接視頻URL
                // playUrl = `https://www.youtube.com/embed/${videoId}`;
            }
        }

        return playUrl;
    }

    // 公開API
    return {
        getSettings,
        updateSettings,
        validateURL,
        validateURLs,
        isValidURL,
        isStreamingURL,
        generateSafePlayURL,
        processBilibiliURL,
        processYouTubeURL,
        
        // 常數
        BILIBILI_DOMAINS,
        STREAMING_DOMAINS,
        ALLOWED_PROTOCOLS
    };

})();
