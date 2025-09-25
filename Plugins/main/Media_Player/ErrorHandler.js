// ErrorHandler.js - 错误处理与恢复系统
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.errorCounts = new Map();
        this.recoveryStrategies = new Map();
        this.criticalErrors = new Set([
            'SecurityError',
            'QuotaExceededError',
            'NetworkError'
        ]);
        
        this.init();
    }

    init() {
        this.setupGlobalHandlers();
        this.registerRecoveryStrategies();
    }

    // 设置全局错误处理
    setupGlobalHandlers() {
        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'unhandledrejection', {
                promise: event.promise,
                stack: event.reason?.stack
            });
        });

        // 捕获全局JavaScript错误
        window.addEventListener('error', (event) => {
            this.handleError(new Error(event.message), 'globalerror', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleResourceError(event);
            }
        }, true);
    }

    // 处理错误
    handleError(error, type = 'unknown', context = {}) {
        const errorInfo = this.createErrorInfo(error, type, context);
        
        // 记录错误
        this.logError(errorInfo);
        
        // 增加错误计数
        this.incrementErrorCount(errorInfo.type);
        
        // 尝试恢复
        const recovered = this.attemptRecovery(errorInfo);
        
        // 通知用户（如果是关键错误且未恢复）
        if (this.isCriticalError(error) && !recovered) {
            this.notifyUser(errorInfo);
        }
        
        // 发送错误报告（在生产环境中）
        if (this.shouldReport(errorInfo)) {
            this.reportError(errorInfo);
        }
        
        return errorInfo;
    }

    // 创建错误信息对象
    createErrorInfo(error, type, context) {
        return {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message || String(error),
            type: type,
            name: error.name || 'UnknownError',
            stack: error.stack,
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            recovered: false
        };
    }

    // 生成错误ID
    generateErrorId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // 记录错误
    logError(errorInfo) {
        this.errorLog.unshift(errorInfo);
        
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }
        
        console.error(`[ErrorHandler] ${errorInfo.type}:`, errorInfo);
    }

    // 增加错误计数
    incrementErrorCount(errorType) {
        const count = this.errorCounts.get(errorType) || 0;
        this.errorCounts.set(errorType, count + 1);
        
        // 如果错误频率过高，采取限制措施
        if (count > 10) {
            this.handleHighFrequencyError(errorType);
        }
    }

    // 处理高频错误
    handleHighFrequencyError(errorType) {
        console.warn(`高频错误检测: ${errorType} (${this.errorCounts.get(errorType)} 次)`);
        
        // 可能的限制措施
        switch (errorType) {
            case 'NetworkError':
                this.enableOfflineMode();
                break;
            case 'MediaError':
                this.disableAutoplay();
                break;
            default:
                this.enableSafeMode();
        }
    }

    // 注册恢复策略
    registerRecoveryStrategies() {
        this.recoveryStrategies.set('NetworkError', this.recoverFromNetworkError.bind(this));
        this.recoveryStrategies.set('MediaError', this.recoverFromMediaError.bind(this));
        this.recoveryStrategies.set('StorageError', this.recoverFromStorageError.bind(this));
        this.recoveryStrategies.set('SecurityError', this.recoverFromSecurityError.bind(this));
        this.recoveryStrategies.set('QuotaExceededError', this.recoverFromQuotaError.bind(this));
    }

    // 尝试恢复
    attemptRecovery(errorInfo) {
        const strategy = this.recoveryStrategies.get(errorInfo.name) || 
                        this.recoveryStrategies.get(errorInfo.type);
        
        if (strategy) {
            try {
                const recovered = strategy(errorInfo);
                errorInfo.recovered = recovered;
                return recovered;
            } catch (recoveryError) {
                console.error('恢复策略失败:', recoveryError);
                return false;
            }
        }
        
        return false;
    }

    // 网络错误恢复
    async recoverFromNetworkError(errorInfo) {
        // 检查网络连接
        if (!navigator.onLine) {
            this.showOfflineMessage();
            return false;
        }
        
        // 尝试重新连接
        try {
            await fetch(window.location.origin, { method: 'HEAD' });
            this.hideOfflineMessage();
            return true;
        } catch (error) {
            return false;
        }
    }

    // 媒体错误恢复
    recoverFromMediaError(errorInfo) {
        // 尝试降低质量或切换格式
        if (errorInfo.context?.mediaElement) {
            const media = errorInfo.context.mediaElement;
            
            // 重新加载媒体
            setTimeout(() => {
                media.load();
            }, 1000);
            
            return true;
        }
        
        return false;
    }

    // 存储错误恢复
    recoverFromStorageError(errorInfo) {
        try {
            // 清理一些缓存空间
            if (typeof localStorage !== 'undefined') {
                const keys = Object.keys(localStorage);
                const tempKeys = keys.filter(key => key.startsWith('temp_'));
                tempKeys.forEach(key => localStorage.removeItem(key));
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // 安全错误恢复
    recoverFromSecurityError(errorInfo) {
        // 通常安全错误无法自动恢复，只能通知用户
        UIComponents.showNotification(
            '遇到安全限制，某些功能可能不可用',
            'warning',
            5000
        );
        
        return false;
    }

    // 配额错误恢复
    recoverFromQuotaError(errorInfo) {
        try {
            // 清理缓存
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
            
            // 清理本地存储
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // 处理资源加载错误
    handleResourceError(event) {
        const target = event.target;
        const errorInfo = {
            type: 'ResourceError',
            resource: target.src || target.href,
            tagName: target.tagName,
            message: '资源加载失败'
        };
        
        this.handleError(new Error(errorInfo.message), 'ResourceError', errorInfo);
        
        // 尝试使用备用资源
        this.tryFallbackResource(target);
    }

    // 尝试备用资源
    tryFallbackResource(element) {
        const fallbacks = {
            'IMG': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+4oCL</text></svg>',
            'VIDEO': null,
            'AUDIO': null
        };
        
        const fallback = fallbacks[element.tagName];
        if (fallback) {
            element.src = fallback;
        } else {
            element.style.display = 'none';
        }
    }

    // 判断是否为关键错误
    isCriticalError(error) {
        return this.criticalErrors.has(error.name) || 
               error.message.includes('critical') ||
               error.message.includes('fatal');
    }

    // 通知用户
    notifyUser(errorInfo) {
        const message = this.createUserFriendlyMessage(errorInfo);
        UIComponents.showNotification(message, 'danger', 0);
    }

    // 创建用户友好的错误消息
    createUserFriendlyMessage(errorInfo) {
        const messages = {
            'NetworkError': '网络连接出现问题，请检查网络设置',
            'MediaError': '媒体播放出现问题，正在尝试修复',
            'SecurityError': '浏览器安全策略阻止了某些功能',
            'QuotaExceededError': '存储空间不足，已清理缓存'
        };
        
        return messages[errorInfo.name] || '发生了意外错误，已记录并尝试修复';
    }

    // 判断是否需要报告
    shouldReport(errorInfo) {
        // 在开发环境中不报告
        if (window.location.hostname === 'localhost') {
            return false;
        }
        
        // 过滤掉太常见的错误
        const ignoredErrors = [
            'Script error',
            'Non-Error promise rejection captured'
        ];
        
        return !ignoredErrors.some(ignored => 
            errorInfo.message.includes(ignored)
        );
    }

    // 报告错误
    async reportError(errorInfo) {
        try {
            // 这里可以发送到错误追踪服务
            const report = {
                ...errorInfo,
                // 移除敏感信息
                stack: errorInfo.stack?.split('\n').slice(0, 5).join('\n')
            };
            
            console.log('错误报告:', report);
            
            // 实际实现中可能发送到服务器
            // await fetch('/api/errors', {
            //     method: 'POST',
            //     body: JSON.stringify(report)
            // });
        } catch (error) {
            console.warn('错误报告发送失败:', error);
        }
    }

    // 启用离线模式
    enableOfflineMode() {
        document.body.classList.add('offline-mode');
        UIComponents.showNotification('已切换到离线模式', 'info');
    }

    // 禁用自动播放
    disableAutoplay() {
        document.body.dataset.autoplayDisabled = 'true';
        UIComponents.showNotification('已禁用自动播放以减少错误', 'warning');
    }

    // 启用安全模式
    enableSafeMode() {
        document.body.classList.add('safe-mode');
        UIComponents.showNotification('已启用安全模式', 'warning');
    }

    // 显示离线消息
    showOfflineMessage() {
        if (!document.querySelector('.offline-indicator')) {
            const indicator = document.createElement('div');
            indicator.className = 'offline-indicator';
            indicator.textContent = '网络连接中断';
            indicator.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #f39c12;
                color: white;
                padding: 8px;
                text-align: center;
                z-index: 10000;
            `;
            document.body.appendChild(indicator);
        }
    }

    // 隐藏离线消息
    hideOfflineMessage() {
        const indicator = document.querySelector('.offline-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // 获取错误统计
    getErrorStats() {
        const recent24h = this.errorLog.filter(error => 
            Date.now() - new Date(error.timestamp).getTime() < 24 * 60 * 60 * 1000
        );
        
        return {
            total: this.errorLog.length,
            recent24h: recent24h.length,
            byType: Object.fromEntries(this.errorCounts),
            recoveryRate: this.calculateRecoveryRate()
        };
    }

    // 计算恢复率
    calculateRecoveryRate() {
        if (this.errorLog.length === 0) return 0;
        
        const recovered = this.errorLog.filter(error => error.recovered).length;
        return (recovered / this.errorLog.length * 100).toFixed(2);
    }

    // 清理错误日志
    clearErrorLog() {
        this.errorLog = [];
        this.errorCounts.clear();
    }
}

// 测试工具
class TestUtils {
    constructor() {
        this.tests = [];
        this.results = [];
        this.mockData = new Map();
        this.isRunning = false;
    }

    // 添加测试用例
    addTest(name, testFn, options = {}) {
        this.tests.push({
            name: name,
            fn: testFn,
            timeout: options.timeout || 5000,
            async: options.async || false,
            skip: options.skip || false
        });
    }

    // 运行所有测试
    async runAllTests() {
        if (this.isRunning) {
            console.warn('测试正在运行中...');
            return;
        }

        this.isRunning = true;
        this.results = [];
        
        console.group('🧪 开始运行测试');
        
        for (const test of this.tests) {
            if (test.skip) {
                this.results.push({
                    name: test.name,
                    status: 'skipped',
                    duration: 0,
                    message: '已跳过'
                });
                continue;
            }
            
            await this.runSingleTest(test);
        }
        
        this.printResults();
        console.groupEnd();
        
        this.isRunning = false;
        return this.results;
    }

    // 运行单个测试
    async runSingleTest(test) {
        const startTime = performance.now();
        
        try {
            let result;
            
            if (test.async) {
                result = await Promise.race([
                    test.fn(),
                    this.timeout(test.timeout)
                ]);
            } else {
                result = test.fn();
            }
            
            const duration = performance.now() - startTime;
            
            this.results.push({
                name: test.name,
                status: 'passed',
                duration: Math.round(duration),
                result: result
            });
            
            console.log(`✅ ${test.name} (${Math.round(duration)}ms)`);
            
        } catch (error) {
            const duration = performance.now() - startTime;
            
            this.results.push({
                name: test.name,
                status: 'failed',
                duration: Math.round(duration),
                error: error.message,
                stack: error.stack
            });
            
            console.error(`❌ ${test.name} (${Math.round(duration)}ms):`, error);
        }
    }

    // 超时Promise
    timeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('测试超时')), ms);
        });
    }

    // 打印测试结果
    printResults() {
        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const skipped = this.results.filter(r => r.status === 'skipped').length;
        const total = this.results.length;
        
        console.log('\n📊 测试结果汇总:');
        console.log(`总计: ${total}`);
        console.log(`✅ 通过: ${passed}`);
        console.log(`❌ 失败: ${failed}`);
        console.log(`⏭️ 跳过: ${skipped}`);
        console.log(`📈 通过率: ${total > 0 ? (passed / (total - skipped) * 100).toFixed(2) : 0}%`);
    }

    // 断言函数
    assert(condition, message = '断言失败') {
        if (!condition) {
            throw new Error(message);
        }
    }

    assertEquals(actual, expected, message = '值不相等') {
        if (actual !== expected) {
            throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
        }
    }

    assertThrows(fn, expectedError, message = '未抛出预期错误') {
        try {
            fn();
            throw new Error(message);
        } catch (error) {
            if (expectedError && !(error instanceof expectedError)) {
                throw new Error(`${message}: 期望 ${expectedError.name}, 实际 ${error.constructor.name}`);
            }
        }
    }

    // 模拟数据
    mockFunction(originalFn, mockFn) {
        const mockKey = Symbol('mock');
        this.mockData.set(mockKey, originalFn);
        return mockFn;
    }

    // 恢复模拟
    restoreMocks() {
        this.mockData.clear();
    }

    // 创建测试套件
    createTestSuite(suiteName) {
        return {
            name: suiteName,
            tests: [],
            beforeEach: null,
            afterEach: null,
            
            test: (name, fn, options) => {
                this.addTest(`${suiteName}: ${name}`, fn, options);
            }
        };
    }
}

// 媒体播放器专用测试
class MediaPlayerTests extends TestUtils {
    constructor(playerInstance) {
        super();
        this.player = playerInstance;
        this.setupMediaPlayerTests();
    }

    setupMediaPlayerTests() {
        // URL检测测试
        this.addTest('URL检测 - YouTube', () => {
            const result = MediaUtils.detectUrlType('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
            this.assert(result !== null, 'YouTube URL应该被检测到');
            this.assertEquals(result.type, 'platform');
            this.assertEquals(result.platform, 'youtube');
        });

        this.addTest('URL检测 - Bilibili', () => {
            const result = MediaUtils.detectUrlType('https://www.bilibili.com/video/BV1GJ411x7h7');
            this.assert(result !== null, 'Bilibili URL应该被检测到');
            this.assertEquals(result.type, 'platform');
            this.assertEquals(result.platform, 'bilibili');
        });

        this.addTest('URL检测 - 直链MP4', () => {
            const result = MediaUtils.detectUrlType('https://example.com/video.mp4');
            this.assert(result !== null, 'MP4直链应该被检测到');
            this.assertEquals(result.type, 'direct');
            this.assertEquals(result.mediaType, 'video');
        });

        // 播放列表测试
        this.addTest('播放列表创建', () => {
            const item = MediaUtils.createPlaylistItem('https://www.youtube.com/watch?v=test', 'Test Video');
            this.assert(item !== null, '播放列表项应该被创建');
            this.assertEquals(item.name, 'Test Video');
        });

        // UI组件测试
        this.addTest('UI主题切换', () => {
            const originalTheme = UIComponents.currentTheme;
            UIComponents.switchTheme('light');
            this.assertEquals(UIComponents.currentTheme, 'light');
            UIComponents.switchTheme(originalTheme);
        });

        // 异步测试：缓存功能
        this.addTest('缓存功能', async () => {
            const optimizer = new PerformanceOptimizer();
            const testData = { test: 'data' };
            
            const fetcher = async () => testData;
            const result1 = await optimizer.getCachedData('test-key', fetcher);
            const result2 = await optimizer.getCachedData('test-key', fetcher);
            
            this.assertEquals(result1, testData);
            this.assertEquals(result2, testData);
        }, { async: true });

        // 错误处理测试
        this.addTest('错误处理', () => {
            const errorHandler = new ErrorHandler();
            const testError = new Error('Test error');
            
            const errorInfo = errorHandler.handleError(testError, 'test');
            this.assert(errorInfo.id !== undefined, '错误应该有ID');
            this.assertEquals(errorInfo.message, 'Test error');
        });
    }

    // 运行性能测试
    async runPerformanceTests() {
        console.group('🚀 性能测试');
        
        // 测试URL检测性能
        const urls = [
            'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.bilibili.com/video/BV1GJ411x7h7',
            'https://example.com/video.mp4'
        ];
        
        const startTime = performance.now();
        
        for (let i = 0; i < 1000; i++) {
            for (const url of urls) {
                MediaUtils.detectUrlType(url);
            }
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 3000;
        
        console.log(`URL检测平均耗时: ${avgTime.toFixed(3)}ms`);
        
        console.groupEnd();
    }

    // 压力测试
    async runStressTests() {
        console.group('💪 压力测试');
        
        // 测试大量播放列表项目
        const startTime = performance.now();
        const items = [];
        
        for (let i = 0; i < 1000; i++) {
            const item = MediaUtils.createPlaylistItem(`https://example.com/video${i}.mp4`, `Video ${i}`);
            if (item) items.push(item);
        }
        
        const endTime = performance.now();
        console.log(`创建1000个播放列表项目耗时: ${endTime - startTime}ms`);
        console.log(`成功创建: ${items.length} 个项目`);
        
        console.groupEnd();
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.TestUtils = TestUtils;
    window.MediaPlayerTests = MediaPlayerTests;
    
    // 全局错误处理器实例
    window.globalErrorHandler = new ErrorHandler();
}
