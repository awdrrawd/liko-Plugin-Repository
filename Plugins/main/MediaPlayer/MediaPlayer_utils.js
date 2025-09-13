// utils.js - 工具函數模塊
// 需要放在 CDN 上供主腳本引用

(function() {
    'use strict';
    
    if (!window.BCMedia) {
        window.BCMedia = {};
    }

    // ==================== 工具函數類 ====================
    class Utils {
        constructor() {
            this.debounceTimers = new Map();
            this.throttleTimers = new Map();
        }

        // ==================== 防抖和節流 ====================
        debounce(func, delay = 300, key = null) {
            const timerKey = key || func.name || 'anonymous';
            
            return (...args) => {
                clearTimeout(this.debounceTimers.get(timerKey));
                this.debounceTimers.set(timerKey, setTimeout(() => {
                    func.apply(this, args);
                }, delay));
            };
        }

        throttle(func, limit = 1000, key = null) {
            const timerKey = key || func.name || 'anonymous';
            
            return (...args) => {
                if (!this.throttleTimers.get(timerKey)) {
                    func.apply(this, args);
                    this.throttleTimers.set(timerKey, setTimeout(() => {
                        this.throttleTimers.delete(timerKey);
                    }, limit));
                }
            };
        }

        clearTimers() {
            this.debounceTimers.forEach(timer => clearTimeout(timer));
            this.throttleTimers.forEach(timer => clearTimeout(timer));
            this.debounceTimers.clear();
            this.throttleTimers.clear();
        }

        // ==================== GUID 生成 ====================
        generateGUID() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        generateShortId(length = 8) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }

        // ==================== URL 驗證和處理 ====================
        isValidUrl(url) {
            if (!url || typeof url !== 'string') return false;
            
            try {
                const urlObj = new URL(url.trim());
                return ['http:', 'https:'].includes(urlObj.protocol);
            } catch {
                return false;
            }
        }

        normalizeUrl(url) {
            if (!url) return '';
            
            url = url.trim();
            
            // 添加協議
            if (!/^https?:\/\//i.test(url)) {
                url = 'https://' + url;
            }
            
            return url;
        }

        extractDomain(url) {
            try {
                return new URL(url).hostname;
            } catch {
                return '';
            }
        }

        // ==================== 文本處理和驗證 ====================
        isValidDanmu(text) {
            if (!text || typeof text !== 'string') return false;
            
            const trimmed = text.trim();
            return trimmed.length > 0 && 
                   trimmed.length <= window.BCMedia.Constants.MAX_DANMU_LENGTH &&
                   this.isSafeText(trimmed);
        }

        isSafeText(text) {
            // 基本 XSS 防護
            const dangerousPatterns = [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<iframe[^>]*>/gi,
                /<object[^>]*>/gi,
                /<embed[^>]*>/gi
            ];
            
            return !dangerousPatterns.some(pattern => pattern.test(text));
        }

        sanitizeText(text) {
            if (!text) return '';
            
            return text
                .replace(/[<>'"&]/g, (match) => {
                    const entities = {
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#39;',
                        '&': '&amp;'
                    };
                    return entities[match] || match;
                })
                .trim();
        }

        truncateText(text, maxLength = 50, suffix = '...') {
            if (!text || text.length <= maxLength) return text;
            return text.substring(0, maxLength - suffix.length) + suffix;
        }

        // ==================== 時間處理 ====================
        formatTime(seconds) {
            if (!isFinite(seconds) || seconds < 0) return '00:00';
            
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            
            return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        parseTime(timeString) {
            if (!timeString) return 0;
            
            const parts = timeString.split(':').map(Number);
            let seconds = 0;
            
            if (parts.length === 3) { // HH:MM:SS
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) { // MM:SS
                seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 1) { // SS
                seconds = parts[0];
            }
            
            return Math.max(0, seconds);
        }

        // ==================== 設備檢測 ====================
        isMobile() {
            return window.CommonIsMobile || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        isTouch() {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        }

        getScreenSize() {
            return {
                width: window.screen.width,
                height: window.screen.height,
                availWidth: window.screen.availWidth,
                availHeight: window.screen.availHeight
            };
        }

        // ==================== DOM 操作 ====================
        createElement(tag, attributes = {}, content = '') {
            const element = document.createElement(tag);
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'innerHTML') {
                    element.innerHTML = value;
                } else if (key.startsWith('on') && typeof value === 'function') {
                    element.addEventListener(key.substring(2).toLowerCase(), value);
                } else {
                    element.setAttribute(key, value);
                }
            });
            
            if (content) {
                element.textContent = content;
            }
            
            return element;
        }

        removeElement(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }

        findElement(selector, parent = document) {
            try {
                return parent.querySelector(selector);
            } catch {
                return null;
            }
        }

        findElements(selector, parent = document) {
            try {
                return Array.from(parent.querySelectorAll(selector));
            } catch {
                return [];
            }
        }

        // ==================== 事件處理 ====================
        addEventListener(element, event, handler, options = {}) {
            if (!element || !event || !handler) return;
            
            element.addEventListener(event, handler, options);
            
            return () => {
                element.removeEventListener(event, handler, options);
            };
        }

        // ==================== 數據處理 ====================
        deepClone(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj);
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            if (typeof obj === 'object') {
                const cloned = {};
                Object.keys(obj).forEach(key => {
                    cloned[key] = this.deepClone(obj[key]);
                });
                return cloned;
            }
            return obj;
        }

        merge(target, ...sources) {
            if (!target) return {};
            
            sources.forEach(source => {
                if (source && typeof source === 'object') {
                    Object.keys(source).forEach(key => {
                        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                            target[key] = this.merge(target[key] || {}, source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    });
                }
            });
            
            return target;
        }

        // ==================== 存儲處理 ====================
        setLocalData(key, data, expireTime = null) {
            try {
                const item = {
                    data: data,
                    timestamp: Date.now(),
                    expireTime: expireTime
                };
                localStorage.setItem(key, JSON.stringify(item));
                return true;
            } catch (error) {
                console.warn('存儲數據失敗:', error);
                return false;
            }
        }

        getLocalData(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                if (!item) return defaultValue;
                
                const parsed = JSON.parse(item);
                
                // 檢查過期時間
                if (parsed.expireTime && Date.now() > parsed.expireTime) {
                    localStorage.removeItem(key);
                    return defaultValue;
                }
                
                return parsed.data;
            } catch (error) {
                console.warn('讀取數據失敗:', error);
                return defaultValue;
            }
        }

        removeLocalData(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('刪除數據失敗:', error);
                return false;
            }
        }

        // ==================== 性能監控 ====================
        measurePerformance(name, func) {
            const start = performance.now();
            const result = func();
            const end = performance.now();
            
            console.log(`[性能監控] ${name}: ${(end - start).toFixed(2)}ms`);
            return result;
        }

        // ==================== 錯誤處理 ====================
        safeExecute(func, errorHandler = null) {
            try {
                return func();
            } catch (error) {
                console.error('執行錯誤:', error);
                if (errorHandler) {
                    errorHandler(error);
                }
                return null;
            }
        }

        // ==================== 清理方法 ====================
        destroy() {
            this.clearTimers();
        }
    }

    // 創建全域實例
    window.BCMedia.Utils = new Utils();

    console.log('[BC增強媒體] 工具模塊載入完成');
})();
