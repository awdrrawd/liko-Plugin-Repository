// PerformanceOptimizer.js - 性能优化与缓存系统
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.requestQueue = new Map();
        this.resourcePreloader = new ResourcePreloader();
        this.memoryMonitor = new MemoryMonitor();
        this.networkOptimizer = new NetworkOptimizer();
        
        this.config = {
            cacheMaxSize: 100, // 最大缓存项目数
            cacheExpiry: 30 * 60 * 1000, // 30分钟过期
            preloadThreshold: 3, // 预加载阈值
            memoryThreshold: 0.8, // 内存使用阈值
            batchSize: 5, // 批处理大小
            requestDelay: 100 // 请求延迟（ms）
        };
        
        this.init();
    }

    init() {
        this.startMemoryMonitoring();
        this.setupPerformanceObserver();
        this.optimizeEventListeners();
    }

    // 智能缓存系统
    async getCachedData(key, fetcher, options = {}) {
        const cacheKey = this.generateCacheKey(key, options);
        const cached = this.cache.get(cacheKey);
        
        // 检查缓存有效性
        if (cached && !this.isCacheExpired(cached)) {
            return cached.data;
        }
        
        // 防止重复请求
        if (this.requestQueue.has(cacheKey)) {
            return this.requestQueue.get(cacheKey);
        }
        
        // 创建新请求
        const request = this.createOptimizedRequest(fetcher, options);
        this.requestQueue.set(cacheKey, request);
        
        try {
            const data = await request;
            this.setCacheData(cacheKey, data);
            return data;
        } finally {
            this.requestQueue.delete(cacheKey);
        }
    }

    // 生成缓存键
    generateCacheKey(key, options) {
        const optionsStr = JSON.stringify(options);
        return `${key}_${this.hashCode(optionsStr)}`;
    }

    // 哈希函数
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转为32位整数
        }
        return hash.toString(36);
    }

    // 设置缓存数据
    setCacheData(key, data) {
        // 检查缓存大小限制
        if (this.cache.size >= this.config.cacheMaxSize) {
            this.evictOldestCache();
        }
        
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            accessCount: 0,
            lastAccess: Date.now()
        });
    }

    // 检查缓存是否过期
    isCacheExpired(cached) {
        return Date.now() - cached.timestamp > this.config.cacheExpiry;
    }

    // 清理最旧的缓存
    evictOldestCache() {
        let oldestKey = null;
        let oldestTime = Date.now();
        
        for (const [key, value] of this.cache.entries()) {
            if (value.lastAccess < oldestTime) {
                oldestTime = value.lastAccess;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    // 创建优化的请求
    async createOptimizedRequest(fetcher, options) {
        // 添加请求延迟以避免并发过多
        if (this.requestQueue.size > this.config.batchSize) {
            await this.delay(this.config.requestDelay);
        }
        
        // 网络优化
        const optimizedOptions = this.networkOptimizer.optimizeRequest(options);
        
        // 执行请求
        const startTime = performance.now();
        const result = await fetcher(optimizedOptions);
        const endTime = performance.now();
        
        // 记录性能指标
        this.recordRequestMetrics(endTime - startTime);
        
        return result;
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 记录请求指标
    recordRequestMetrics(duration) {
        if (typeof performance !== 'undefined' && performance.mark) {
            performance.mark(`request-duration-${Date.now()}`);
        }
    }

    // 内存监控
    startMemoryMonitoring() {
        if (typeof performance !== 'undefined' && performance.memory) {
            setInterval(() => {
                const memoryUsage = performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
                
                if (memoryUsage > this.config.memoryThreshold) {
                    this.triggerMemoryCleanup();
                }
            }, 30000); // 每30秒检查一次
        }
    }

    // 内存清理
    triggerMemoryCleanup() {
        // 清理过期缓存
        this.cleanExpiredCache();
        
        // 清理未使用的资源
        this.resourcePreloader.cleanup();
        
        // 触发垃圾回收（如果可用）
        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
        
        console.log('内存清理完成');
    }

    // 清理过期缓存
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (this.isCacheExpired(value)) {
                this.cache.delete(key);
            }
        }
    }

    // 设置性能观察器
    setupPerformanceObserver() {
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    this.analyzePerformanceEntries(entries);
                });
                
                observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
            } catch (error) {
                console.warn('性能观察器初始化失败:', error);
            }
        }
    }

    // 分析性能条目
    analyzePerformanceEntries(entries) {
        entries.forEach(entry => {
            if (entry.entryType === 'resource' && entry.duration > 1000) {
                console.warn(`慢资源加载: ${entry.name} (${entry.duration}ms)`);
            }
        });
    }

    // 优化事件监听器
    optimizeEventListeners() {
        this.throttledResize = MediaUtils.throttle(() => {
            this.handleResize();
        }, 250);
        
        this.debouncedScroll = MediaUtils.debounce(() => {
            this.handleScroll();
        }, 100);
        
        window.addEventListener('resize', this.throttledResize);
        window.addEventListener('scroll', this.debouncedScroll);
    }

    handleResize() {
        // 响应式布局调整
        this.resourcePreloader.adjustPreloadingStrategy();
    }

    handleScroll() {
        // 懒加载优化
        this.resourcePreloader.checkLazyLoad();
    }

    // 获取性能统计
    getPerformanceStats() {
        return {
            cacheSize: this.cache.size,
            cacheHitRate: this.calculateCacheHitRate(),
            memoryUsage: this.getMemoryUsage(),
            activeRequests: this.requestQueue.size
        };
    }

    calculateCacheHitRate() {
        let totalAccess = 0;
        let hits = 0;
        
        for (const cached of this.cache.values()) {
            totalAccess += cached.accessCount;
            if (cached.accessCount > 0) hits++;
        }
        
        return totalAccess > 0 ? (hits / totalAccess * 100).toFixed(2) : 0;
    }

    getMemoryUsage() {
        if (typeof performance !== 'undefined' && performance.memory) {
            return {
                used: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                total: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                limit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
            };
        }
        return null;
    }
}

// 资源预加载器
class ResourcePreloader {
    constructor() {
        this.preloadQueue = [];
        this.preloadedResources = new Map();
        this.loadingResources = new Set();
        this.observer = null;
        
        this.setupIntersectionObserver();
    }

    // 设置交叉观察器
    setupIntersectionObserver() {
        if (typeof IntersectionObserver !== 'undefined') {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.preloadResource(entry.target.dataset.preloadUrl);
                    }
                });
            }, { threshold: 0.1 });
        }
    }

    // 添加预加载资源
    addToPreloadQueue(url, priority = 'normal', type = 'media') {
        if (this.preloadedResources.has(url) || this.loadingResources.has(url)) {
            return;
        }
        
        this.preloadQueue.push({
            url: url,
            priority: priority,
            type: type,
            addedAt: Date.now()
        });
        
        this.processPreloadQueue();
    }

    // 处理预加载队列
    processPreloadQueue() {
        // 按优先级排序
        this.preloadQueue.sort((a, b) => {
            const priorities = { high: 3, normal: 2, low: 1 };
            return priorities[b.priority] - priorities[a.priority];
        });
        
        // 限制并发预加载数量
        const maxConcurrent = 3;
        let concurrent = 0;
        
        for (let i = 0; i < this.preloadQueue.length && concurrent < maxConcurrent; i++) {
            const item = this.preloadQueue[i];
            if (!this.loadingResources.has(item.url)) {
                this.preloadResource(item.url, item.type);
                concurrent++;
            }
        }
    }

    // 预加载资源
    async preloadResource(url, type = 'media') {
        if (this.preloadedResources.has(url) || this.loadingResources.has(url)) {
            return;
        }
        
        this.loadingResources.add(url);
        
        try {
            let resource;
            
            switch (type) {
                case 'video':
                    resource = await this.preloadVideo(url);
                    break;
                case 'audio':
                    resource = await this.preloadAudio(url);
                    break;
                case 'image':
                    resource = await this.preloadImage(url);
                    break;
                default:
                    resource = await this.preloadGeneric(url);
            }
            
            this.preloadedResources.set(url, {
                resource: resource,
                preloadedAt: Date.now(),
                type: type
            });
            
            // 从队列中移除
            this.preloadQueue = this.preloadQueue.filter(item => item.url !== url);
            
        } catch (error) {
            console.warn(`预加载失败: ${url}`, error);
        } finally {
            this.loadingResources.delete(url);
        }
    }

    // 预加载视频
    preloadVideo(url) {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.crossOrigin = 'anonymous';
            
            video.addEventListener('loadedmetadata', () => resolve(video), { once: true });
            video.addEventListener('error', reject, { once: true });
            
            video.src = url;
        });
    }

    // 预加载音频
    preloadAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.crossOrigin = 'anonymous';
            
            audio.addEventListener('loadedmetadata', () => resolve(audio), { once: true });
            audio.addEventListener('error', reject, { once: true });
            
            audio.src = url;
        });
    }

    // 预加载图片
    preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => resolve(img);
            img.onerror = reject;
            
            img.src = url;
        });
    }

    // 预加载通用资源
    preloadGeneric(url) {
        return fetch(url, { 
            method: 'HEAD',
            mode: 'cors',
            cache: 'force-cache'
        });
    }

    // 检查懒加载
    checkLazyLoad() {
        const lazyElements = document.querySelectorAll('[data-preload-url]');
        lazyElements.forEach(element => {
            if (this.observer && !element.dataset.observed) {
                this.observer.observe(element);
                element.dataset.observed = 'true';
            }
        });
    }

    // 获取预加载的资源
    getPreloadedResource(url) {
        const cached = this.preloadedResources.get(url);
        if (cached) {
            return cached.resource;
        }
        return null;
    }

    // 调整预加载策略
    adjustPreloadingStrategy() {
        const connectionInfo = this.getConnectionInfo();
        
        if (connectionInfo.effectiveType === 'slow-2g' || connectionInfo.effectiveType === '2g') {
            // 慢网络：减少预加载
            this.preloadQueue = this.preloadQueue.filter(item => item.priority === 'high');
        } else if (connectionInfo.effectiveType === '4g') {
            // 快网络：增加预加载
            this.processPreloadQueue();
        }
    }

    // 获取网络连接信息
    getConnectionInfo() {
        if (typeof navigator !== 'undefined' && navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            };
        }
        return { effectiveType: '4g', downlink: 10, rtt: 100 };
    }

    // 清理资源
    cleanup() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5分钟
        
        for (const [url, cached] of this.preloadedResources.entries()) {
            if (now - cached.preloadedAt > maxAge) {
                // 清理DOM资源
                if (cached.resource && cached.resource.remove) {
                    cached.resource.remove();
                }
                this.preloadedResources.delete(url);
            }
        }
    }
}

// 网络优化器
class NetworkOptimizer {
    constructor() {
        this.connectionSpeed = this.detectConnectionSpeed();
        this.requestStats = {
            successful: 0,
            failed: 0,
            averageTime: 0
        };
    }

    // 优化请求
    optimizeRequest(options = {}) {
        const optimized = { ...options };
        
        // 根据网络速度调整超时
        if (this.connectionSpeed === 'slow') {
            optimized.timeout = optimized.timeout * 2 || 30000;
        }
        
        // 添加重试机制
        optimized.retries = optimized.retries || 3;
        optimized.retryDelay = optimized.retryDelay || 1000;
        
        // 设置缓存策略
        if (!optimized.cache) {
            optimized.cache = 'default';
        }
        
        return optimized;
    }

    // 检测连接速度
    detectConnectionSpeed() {
        if (typeof navigator !== 'undefined' && navigator.connection) {
            const connection = navigator.connection;
            
            if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
                return 'slow';
            } else if (connection.effectiveType === '3g') {
                return 'medium';
            } else {
                return 'fast';
            }
        }
        
        return 'medium'; // 默认假设中等速度
    }

    // 带重试的请求
    async requestWithRetry(url, options = {}) {
        const maxRetries = options.retries || 3;
        const retryDelay = options.retryDelay || 1000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const startTime = Date.now();
                const response = await fetch(url, options);
                const endTime = Date.now();
                
                this.recordRequestSuccess(endTime - startTime);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                console.warn(`请求失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
                
                if (attempt === maxRetries) {
                    this.recordRequestFailure();
                    throw error;
                }
                
                // 指数退避
                const delay = retryDelay * Math.pow(2, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // 记录成功请求
    recordRequestSuccess(duration) {
        this.requestStats.successful++;
        this.updateAverageTime(duration);
    }

    // 记录失败请求
    recordRequestFailure() {
        this.requestStats.failed++;
    }

    // 更新平均时间
    updateAverageTime(duration) {
        const totalRequests = this.requestStats.successful + this.requestStats.failed;
        this.requestStats.averageTime = 
            (this.requestStats.averageTime * (totalRequests - 1) + duration) / totalRequests;
    }

    // 获取网络统计
    getNetworkStats() {
        const total = this.requestStats.successful + this.requestStats.failed;
        return {
            ...this.requestStats,
            successRate: total > 0 ? (this.requestStats.successful / total * 100).toFixed(2) : 0,
            connectionSpeed: this.connectionSpeed
        };
    }
}

// 内存监控器
class MemoryMonitor {
    constructor() {
        this.samples = [];
        this.maxSamples = 100;
        this.alertThreshold = 0.9;
        this.callbacks = [];
    }

    // 采样内存使用
    sample() {
        if (typeof performance !== 'undefined' && performance.memory) {
            const sample = {
                timestamp: Date.now(),
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
            
            this.samples.push(sample);
            
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
            }
            
            // 检查是否需要警告
            const usage = sample.used / sample.total;
            if (usage > this.alertThreshold) {
                this.triggerAlert(usage);
            }
            
            return sample;
        }
        return null;
    }

    // 触发警告
    triggerAlert(usage) {
        this.callbacks.forEach(callback => {
            try {
                callback(usage);
            } catch (error) {
                console.error('内存监控回调错误:', error);
            }
        });
    }

    // 添加警告回调
    onMemoryAlert(callback) {
        this.callbacks.push(callback);
    }

    // 获取内存趋势
    getMemoryTrend() {
        if (this.samples.length < 2) return null;
        
        const recent = this.samples.slice(-10);
        const trend = recent.reduce((sum, sample, index) => {
            if (index === 0) return 0;
            return sum + (sample.used - recent[index - 1].used);
        }, 0);
        
        return trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable';
    }

    // 获取内存统计
    getMemoryStats() {
        if (this.samples.length === 0) return null;
        
        const latest = this.samples[this.samples.length - 1];
        const peak = Math.max(...this.samples.map(s => s.used));
        
        return {
            current: (latest.used / 1024 / 1024).toFixed(2) + 'MB',
            peak: (peak / 1024 / 1024).toFixed(2) + 'MB',
            usage: ((latest.used / latest.total) * 100).toFixed(2) + '%',
            trend: this.getMemoryTrend(),
            samples: this.samples.length
        };
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.PerformanceOptimizer = PerformanceOptimizer;
    window.ResourcePreloader = ResourcePreloader;
    window.NetworkOptimizer = NetworkOptimizer;
    window.MemoryMonitor = MemoryMonitor;
}
