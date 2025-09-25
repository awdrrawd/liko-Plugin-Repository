// build-system.js - 构建打包工具
class BuildSystem {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.buildConfig = {
            minify: true,
            sourcemap: false,
            target: 'ES2018',
            format: 'iife', // 'iife' | 'umd' | 'esm'
            banner: this.generateBanner(),
            footer: ''
        };
    }

    // 注册模块
    registerModule(name, content, dependencies = []) {
        this.modules.set(name, {
            name,
            content,
            dependencies,
            processed: false
        });
        
        dependencies.forEach(dep => {
            if (!this.dependencies.has(dep)) {
                this.dependencies.set(dep, new Set());
            }
            this.dependencies.get(dep).add(name);
        });
    }

    // 生成文件头部注释
    generateBanner() {
        const date = new Date().toISOString().split('T')[0];
        return `
/*!
 * Enhanced Media Player Pro v2.0.0
 * 增强媒体播放器专业版 - 完整优化版本
 * 
 * 构建日期: ${date}
 * 作者: Enhanced Team
 * 许可: MIT License
 * 
 * 功能特性:
 * - 智能媒体检测 (支持多种格式和平台)
 * - 多人同步播放
 * - 现代化UI设计
 * - 性能优化与缓存
 * - 错误处理与恢复
 * - 用户偏好设置
 * 
 * 支持平台: YouTube, Bilibili, Twitch, Vimeo, Niconico
 * 支持格式: mp4, webm, ogg, avi, mov, mkv, m3u8, mp3, aac, flac, wav
 */`.trim();
    }

    // 构建单文件版本
    buildSingleFile() {
        console.log('🔨 开始构建单文件版本...');
        
        const sortedModules = this.topologicalSort();
        let output = this.buildConfig.banner + '\n\n';
        
        // IIFE包装器开始
        output += '(function() {\n\'use strict\';\n\n';
        
        // 添加各模块代码
        sortedModules.forEach(moduleName => {
            const module = this.modules.get(moduleName);
            if (module) {
                output += `// ========== ${moduleName.toUpperCase()} ==========\n`;
                output += this.processModuleContent(module.content);
                output += '\n\n';
            }
        });
        
        // IIFE包装器结束
        output += '})();\n';
        
        if (this.buildConfig.minify) {
            output = this.minify(output);
        }
        
        console.log('✅ 单文件构建完成');
        return output;
    }

    // 构建模块化版本
    buildModular() {
        console.log('🔨 开始构建模块化版本...');
        
        const builds = new Map();
        
        this.modules.forEach((module, name) => {
            let content = this.buildConfig.banner + '\n\n';
            content += this.processModuleContent(module.content);
            
            if (this.buildConfig.minify) {
                content = this.minify(content);
            }
            
            builds.set(name + '.js', content);
        });
        
        console.log('✅ 模块化构建完成');
        return builds;
    }

    // 拓扑排序 (依赖关系排序)
    topologicalSort() {
        const visited = new Set();
        const visiting = new Set();
        const result = [];
        
        const visit = (moduleName) => {
            if (visiting.has(moduleName)) {
                throw new Error(`循环依赖检测: ${moduleName}`);
            }
            if (visited.has(moduleName)) return;
            
            visiting.add(moduleName);
            
            const module = this.modules.get(moduleName);
            if (module) {
                module.dependencies.forEach(dep => visit(dep));
            }
            
            visiting.delete(moduleName);
            visited.add(moduleName);
            result.push(moduleName);
        };
        
        this.modules.forEach((_, name) => visit(name));
        return result;
    }

    // 处理模块内容
    processModuleContent(content) {
        // 移除多余的注释
        content = content.replace(/\/\*\*[\s\S]*?\*\//g, '');
        
        // 移除调试代码
        content = content.replace(/console\.debug\(.*?\);?/g, '');
        
        // 移除空行
        content = content.replace(/\n\s*\n/g, '\n');
        
        return content.trim();
    }

    // 简单的代码压缩
    minify(code) {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '') // 移除块注释
            .replace(/\/\/.*$/gm, '')         // 移除行注释
            .replace(/\s+/g, ' ')             // 压缩空白字符
            .replace(/;\s*}/g, '}')           // 移除分号前的空格
            .replace(/{\s*/g, '{')            // 移除大括号后的空格
            .replace(/\s*}/g, '}')            // 移除大括号前的空格
            .trim();
    }

    // 生成安装脚本
    generateInstaller() {
        return `
// Enhanced Media Player Pro - 自动安装脚本
(function() {
    'use strict';
    
    // 检查环境
    if (typeof window === 'undefined') {
        console.error('Enhanced Media Player Pro 需要浏览器环境');
        return;
    }
    
    // 防止重复安装
    if (window.EnhancedMediaPlayerPro) {
        console.log('Enhanced Media Player Pro 已经安装');
        return;
    }
    
    // 加载主文件
    const script = document.createElement('script');
    script.src = 'https://your-cdn.com/enhanced-media-player.min.js';
    script.onload = function() {
        console.log('✅ Enhanced Media Player Pro 安装完成');
    };
    script.onerror = function() {
        console.error('❌ Enhanced Media Player Pro 安装失败');
    };
    
    document.head.appendChild(script);
})();`.trim();
    }

    // 生成UserScript头部
    generateUserScriptHeader() {
        return `
// ==UserScript==
// @name         Enhanced Media Player Pro
// @name:zh-CN   增强媒体播放器专业版
// @namespace    https://enhanced-media.dev/
// @version      2.0.0
// @description  Professional enhanced media player with auto-detection, sync playback, modern UI
// @description:zh-CN  专业增强媒体播放器，支持智能检测、同步播放、现代UI
// @author       Enhanced Team
// @match        https://*.bondageprojects.elementfx.com/*
// @match        https://*.bondage-europe.com/*
// @match        https://*.bondage-asia.com/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js
// @require      https://cdn.jsdelivr.net/npm/artplayer-plugin-danmaku/dist/artplayer-plugin-danmaku.js
// @license      MIT
// @homepage     https://github.com/your-repo/enhanced-media-player
// @supportURL   https://github.com/your-repo/enhanced-media-player/issues
// @updateURL    https://your-cdn.com/enhanced-media-player.user.js
// @downloadURL  https://your-cdn.com/enhanced-media-player.user.js
// @icon         https://your-cdn.com/icon-64x64.png
// @icon64       https://your-cdn.com/icon-64x64.png
// ==/UserScript==`.trim();
    }
}

// 实施清单类
class ImplementationChecklist {
    constructor() {
        this.tasks = [
            {
                category: '准备工作',
                items: [
                    { task: '备份现有插件代码', status: 'pending', priority: 'high' },
                    { task: '测试环境准备', status: 'pending', priority: 'high' },
                    { task: '用户数据导出', status: 'pending', priority: 'medium' },
                    { task: '兼容性检查', status: 'pending', priority: 'high' }
                ]
            },
            {
                category: '核心模块部署',
                items: [
                    { task: '部署 MediaUtils 模块', status: 'pending', priority: 'high' },
                    { task: '部署 UIComponents 模块', status: 'pending', priority: 'high' },
                    { task: '部署 PerformanceOptimizer 模块', status: 'pending', priority: 'medium' },
                    { task: '部署 ErrorHandler 模块', status: 'pending', priority: 'high' },
                    { task: '部署 SyncManager 模块', status: 'pending', priority: 'medium' },
                    { task: '部署 UserPreferences 模块', status: 'pending', priority: 'low' }
                ]
            },
            {
                category: '集成测试',
                items: [
                    { task: 'URL检测功能测试', status: 'pending', priority: 'high' },
                    { task: '播放器开启/关闭测试', status: 'pending', priority: 'high' },
                    { task: '同步播放测试', status: 'pending', priority: 'medium' },
                    { task: 'UI响应性测试', status: 'pending', priority: 'medium' },
                    { task: '性能基准测试', status: 'pending', priority: 'low' },
                    { task: '错误处理测试', status: 'pending', priority: 'medium' }
                ]
            },
            {
                category: '用户体验',
                items: [
                    { task: '用户数据迁移', status: 'pending', priority: 'high' },
                    { task: '设置面板测试', status: 'pending', priority: 'medium' },
                    { task: '快捷键配置', status: 'pending', priority: 'low' },
                    { task: '多语言支持检查', status: 'pending', priority: 'low' },
                    { task: '移动端适配测试', status: 'pending', priority: 'medium' }
                ]
            },
            {
                category: '生产部署',
                items: [
                    { task: '生产环境配置', status: 'pending', priority: 'high' },
                    { task: 'CDN资源配置', status: 'pending', priority: 'medium' },
                    { task: '监控和日志配置', status: 'pending', priority: 'medium' },
                    { task: '回滚计划准备', status: 'pending', priority: 'high' },
                    { task: '用户通知准备', status: 'pending', priority: 'medium' }
                ]
            }
        ];
        
        this.completedTasks = 0;
        this.totalTasks = this.getTotalTasks();
    }

    getTotalTasks() {
        return this.tasks.reduce((total, category) => total + category.items.length, 0);
    }

    // 标记任务完成
    markComplete(categoryIndex, itemIndex) {
        const item = this.tasks[categoryIndex]?.items[itemIndex];
        if (item && item.status === 'pending') {
            item.status = 'completed';
            this.completedTasks++;
        }
    }

    // 标记任务失败
    markFailed(categoryIndex, itemIndex, reason = '') {
        const item = this.tasks[categoryIndex]?.items[itemIndex];
        if (item) {
            item.status = 'failed';
            item.reason = reason;
        }
    }

    // 获取进度
    getProgress() {
        return {
            completed: this.completedTasks,
            total: this.totalTasks,
            percentage: Math.round((this.completedTasks / this.totalTasks) * 100)
        };
    }

    // 获取下一个待办任务
    getNextTask() {
        for (const category of this.tasks) {
            for (const item of category.items) {
                if (item.status === 'pending') {
                    return {
                        category: category.category,
                        task: item.task,
                        priority: item.priority
                    };
                }
            }
        }
        return null;
    }

    // 生成检查报告
    generateReport() {
        const progress = this.getProgress();
        let report = `
# Enhanced Media Player Pro 实施报告

## 总体进度: ${progress.percentage}% (${progress.completed}/${progress.total})

`;

        this.tasks.forEach((category, categoryIndex) => {
            report += `## ${category.category}\n\n`;
            
            category.items.forEach((item, itemIndex) => {
                const status = item.status === 'completed' ? '✅' : 
                              item.status === 'failed' ? '❌' : '⏳';
                const priority = item.priority === 'high' ? '🔴' : 
                               item.priority === 'medium' ? '🟡' : '🟢';
                
                report += `${status} ${priority} ${item.task}`;
                if (item.reason) {
                    report += ` (失败原因: ${item.reason})`;
                }
                report += '\n';
            });
            
            report += '\n';
        });

        // 添加建议
        const failedTasks = this.getFailedTasks();
        if (failedTasks.length > 0) {
            report += `## ⚠️ 需要注意的问题\n\n`;
            failedTasks.forEach(task => {
                report += `- **${task.task}**: ${task.reason || '未知错误'}\n`;
            });
            report += '\n';
        }

        const nextTask = this.getNextTask();
        if (nextTask) {
            report += `## 📋 下一步行动\n\n`;
            report += `**${nextTask.category}**: ${nextTask.task} (优先级: ${nextTask.priority})\n\n`;
        }

        return report;
    }

    // 获取失败的任务
    getFailedTasks() {
        const failed = [];
        this.tasks.forEach(category => {
            category.items.forEach(item => {
                if (item.status === 'failed') {
                    failed.push({
                        category: category.category,
                        task: item.task,
                        reason: item.reason
                    });
                }
            });
        });
        return failed;
    }

    // 创建交互式检查界面
    createChecklistUI() {
        const container = document.createElement('div');
        container.className = 'emp-checklist-container';
        container.innerHTML = this.getChecklistHTML();
        
        this.bindChecklistEvents(container);
        return container;
    }

    getChecklistHTML() {
        const progress = this.getProgress();
        
        let html = `
            <div class="emp-checklist-header">
                <h2>Enhanced Media Player Pro - 实施清单</h2>
                <div class="emp-progress">
                    <div class="emp-progress-bar" style="width: ${progress.percentage}%"></div>
                    <span class="emp-progress-text">${progress.completed}/${progress.total} (${progress.percentage}%)</span>
                </div>
            </div>
            <div class="emp-checklist-content">
        `;
        
        this.tasks.forEach((category, categoryIndex) => {
            html += `
                <div class="emp-checklist-category">
                    <h3>${category.category}</h3>
                    <ul class="emp-checklist-items">
            `;
            
            category.items.forEach((item, itemIndex) => {
                const statusClass = `emp-task-${item.status}`;
                const priorityClass = `emp-priority-${item.priority}`;
                
                html += `
                    <li class="emp-checklist-item ${statusClass} ${priorityClass}" 
                        data-category="${categoryIndex}" 
                        data-item="${itemIndex}">
                        <label>
                            <input type="checkbox" ${item.status === 'completed' ? 'checked' : ''}>
                            <span class="emp-task-text">${item.task}</span>
                            <span class="emp-priority-badge">${item.priority}</span>
                        </label>
                        ${item.reason ? `<div class="emp-task-reason">${item.reason}</div>` : ''}
                    </li>
                `;
            });
            
            html += `
                    </ul>
                </div>
            `;
        });
        
        html += `
            </div>
            <div class="emp-checklist-footer">
                <button class="emp-btn emp-export-report">导出报告</button>
                <button class="emp-btn emp-reset-checklist">重置清单</button>
            </div>
        `;
        
        return html;
    }

    bindChecklistEvents(container) {
        // 任务勾选
        container.querySelectorAll('.emp-checklist-item input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const item = e.target.closest('.emp-checklist-item');
                const categoryIndex = parseInt(item.dataset.category);
                const itemIndex = parseInt(item.dataset.item);
                
                if (e.target.checked) {
                    this.markComplete(categoryIndex, itemIndex);
                    item.classList.add('emp-task-completed');
                } else {
                    // 取消完成状态
                    const task = this.tasks[categoryIndex].items[itemIndex];
                    if (task.status === 'completed') {
                        task.status = 'pending';
                        this.completedTasks--;
                        item.classList.remove('emp-task-completed');
                    }
                }
                
                // 更新进度条
                this.updateProgressBar(container);
            });
        });
        
        // 导出报告
        container.querySelector('.emp-export-report').addEventListener('click', () => {
            const report = this.generateReport();
            MediaUtils.copyToClipboard(report);
            UIComponents.showNotification('报告已复制到剪贴板', 'success');
        });
        
        // 重置清单
        container.querySelector('.emp-reset-checklist').addEventListener('click', () => {
            if (confirm('确定要重置整个清单吗？')) {
                this.resetAll();
                container.innerHTML = this.getChecklistHTML();
                this.bindChecklistEvents(container);
            }
        });
    }

    updateProgressBar(container) {
        const progress = this.getProgress();
        const progressBar = container.querySelector('.emp-progress-bar');
        const progressText = container.querySelector('.emp-progress-text');
        
        progressBar.style.width = progress.percentage + '%';
        progressText.textContent = `${progress.completed}/${progress.total} (${progress.percentage}%)`;
    }

    resetAll() {
        this.tasks.forEach(category => {
            category.items.forEach(item => {
                item.status = 'pending';
                delete item.reason;
            });
        });
        this.completedTasks = 0;
    }
}

// 部署助手
class DeploymentHelper {
    constructor() {
        this.buildSystem = new BuildSystem();
        this.checklist = new ImplementationChecklist();
        this.setupModules();
    }

    // 设置模块
    setupModules() {
        // 注册所有模块到构建系统
        // (这里需要实际的模块内容，示例中用占位符)
        
        this.buildSystem.registerModule('MediaUtils', '/* MediaUtils 模块内容 */');
        this.buildSystem.registerModule('UIComponents', '/* UIComponents 模块内容 */');
        this.buildSystem.registerModule('PerformanceOptimizer', '/* PerformanceOptimizer 模块内容 */');
        this.buildSystem.registerModule('ErrorHandler', '/* ErrorHandler 模块内容 */');
        this.buildSystem.registerModule('SyncManager', '/* SyncManager 模块内容 */', ['ErrorHandler']);
        this.buildSystem.registerModule('UserPreferences', '/* UserPreferences 模块内容 */');
        this.buildSystem.registerModule('MainApp', '/* 主应用模块内容 */', [
            'MediaUtils', 'UIComponents', 'PerformanceOptimizer', 
            'ErrorHandler', 'SyncManager', 'UserPreferences'
        ]);
    }

    // 生成完整部署包
    generateDeploymentPackage() {
        console.log('📦 生成部署包...');
        
        const package = {
            // 单文件版本
            'enhanced-media-player.js': this.buildSystem.buildSingleFile(),
            
            // 压缩版本
            'enhanced-media-player.min.js': this.buildSystem.buildSingleFile(),
            
            // UserScript版本
            'enhanced-media-player.user.js': 
                this.buildSystem.generateUserScriptHeader() + '\n\n' + 
                this.buildSystem.buildSingleFile(),
            
            // 安装脚本
            'installer.js': this.buildSystem.generateInstaller(),
            
            // 文档文件
            'README.md': '# Enhanced Media Player Pro\n\n完整的安装和使用文档...',
            'CHANGELOG.md': '# 更新日志\n\n## v2.0.0\n- 完全重构...',
            'LICENSE': 'MIT License\n\n版权声明...',
            
            // 配置文件
            'config.json': JSON.stringify({
                version: '2.0.0',
                environment: 'production',
                features: {
                    autoDetection: true,
                    syncPlayback: true,
                    danmaku: true
                }
            }, null, 2)
        };
        
        // 模块化版本
        const modularBuilds = this.buildSystem.buildModular();
        modularBuilds.forEach((content, filename) => {
            package[`modules/${filename}`] = content;
        });
        
        console.log('✅ 部署包生成完成');
        return package;
    }

    // 创建部署向导
    createDeploymentWizard() {
        const wizard = document.createElement('div');
        wizard.className = 'emp-deployment-wizard';
        wizard.innerHTML = `
            <div class="emp-wizard-header">
                <h2>Enhanced Media Player Pro - 部署向导</h2>
            </div>
            <div class="emp-wizard-content">
                <div class="emp-wizard-step active" data-step="1">
                    <h3>步骤 1: 选择部署方式</h3>
                    <div class="emp-deployment-options">
                        <label>
                            <input type="radio" name="deployment" value="userscript">
                            <div class="emp-option">
                                <strong>UserScript 方式</strong>
                                <p>通过 Tampermonkey/Greasemonkey 安装</p>
                            </div>
                        </label>
                        <label>
                            <input type="radio" name="deployment" value="single">
                            <div class="emp-option">
                                <strong>单文件方式</strong>
                                <p>将所有功能合并为一个JS文件</p>
                            </div>
                        </label>
                        <label>
                            <input type="radio" name="deployment" value="modular">
                            <div class="emp-option">
                                <strong>模块化方式</strong>
                                <p>分模块加载，便于维护</p>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="emp-wizard-step" data-step="2">
                    <h3>步骤 2: 配置选项</h3>
                    <div class="emp-config-options">
                        <label>
                            <input type="checkbox" name="features" value="autoDetection" checked>
                            启用自动检测
                        </label>
                        <label>
                            <input type="checkbox" name="features" value="syncPlayback" checked>
                            启用同步播放
                        </label>
                        <label>
                            <input type="checkbox" name="features" value="danmaku" checked>
                            启用弹幕功能
                        </label>
                        <label>
                            <input type="checkbox" name="features" value="performance" checked>
                            启用性能优化
                        </label>
                    </div>
                </div>
                
                <div class="emp-wizard-step" data-step="3">
                    <h3>步骤 3: 生成部署文件</h3>
                    <div class="emp-generation-area">
                        <button class="emp-btn emp-generate-files">生成文件</button>
                        <div class="emp-generated-files"></div>
                    </div>
                </div>
                
                <div class="emp-wizard-step" data-step="4">
                    <h3>步骤 4: 实施清单</h3>
                    <div class="emp-checklist-area">
                        ${this.checklist.createChecklistUI().outerHTML}
                    </div>
                </div>
            </div>
            
            <div class="emp-wizard-footer">
                <button class="emp-btn emp-prev-btn" disabled>上一步</button>
                <button class="emp-btn emp-next-btn">下一步</button>
            </div>
        `;
        
        this.bindWizardEvents(wizard);
        return wizard;
    }

    bindWizardEvents(wizard) {
        const steps = wizard.querySelectorAll('.emp-wizard-step');
        const prevBtn = wizard.querySelector('.emp-prev-btn');
        const nextBtn = wizard.querySelector('.emp-next-btn');
        let currentStep = 1;
        
        const updateStep = () => {
            steps.forEach((step, index) => {
                step.classList.toggle('active', index + 1 === currentStep);
            });
            
            prevBtn.disabled = currentStep === 1;
            nextBtn.textContent = currentStep === steps.length ? '完成' : '下一步';
        };
        
        prevBtn.addEventListener('click', () => {
            if (currentStep > 1) {
                currentStep--;
                updateStep();
            }
        });
        
        nextBtn.addEventListener('click', () => {
            if (currentStep < steps.length) {
                currentStep++;
                updateStep();
            } else {
                wizard.remove();
                UIComponents.showNotification('部署向导完成！', 'success');
            }
        });
        
        // 文件生成
        wizard.querySelector('.emp-generate-files').addEventListener('click', () => {
            const deploymentType = wizard.querySelector('input[name="deployment"]:checked')?.value;
            const features = Array.from(wizard.querySelectorAll('input[name="features"]:checked'))
                .map(input => input.value);
            
            const files = this.generateDeploymentPackage();
            const filesArea = wizard.querySelector('.emp-generated-files');
            
            filesArea.innerHTML = '<h4>生成的文件:</h4>';
            Object.keys(files).forEach(filename => {
                const fileElement = document.createElement('div');
                fileElement.className = 'emp-generated-file';
                fileElement.innerHTML = `
                    <span class="emp-filename">${filename}</span>
                    <button class="emp-btn emp-btn-small emp-download-file" data-filename="${filename}">下载</button>
                `;
                filesArea.appendChild(fileElement);
            });
            
            // 绑定下载事件
            filesArea.querySelectorAll('.emp-download-file').forEach(btn => {
                btn.addEventListener('click', () => {
                    const filename = btn.dataset.filename;
                    const content = files[filename];
                    this.downloadFile(filename, content);
                });
            });
        });
    }

    // 下载文件
    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // 一键部署
    quickDeploy() {
        console.log('🚀 开始一键部署...');
        
        try {
            // 1. 生成文件
            const files = this.generateDeploymentPackage();
            
            // 2. 自动安装 (开发环境)
            if (location.hostname === 'localhost') {
                eval(files['enhanced-media-player.js']);
                console.log('✅ 开发环境自动安装完成');
            }
            
            // 3. 生成报告
            const report = this.checklist.generateReport();
            console.log(report);
            
            return {
                success: true,
                files: Object.keys(files),
                message: '一键部署完成'
            };
            
        } catch (error) {
            console.error('❌ 部署失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出
if (typeof window !== 'undefined') {
    window.BuildSystem = BuildSystem;
    window.ImplementationChecklist = ImplementationChecklist;
    window.DeploymentHelper = DeploymentHelper;
    
    // 创建全局部署助手实例
    window.EMP_DEPLOY = new DeploymentHelper();
    
    console.log('🛠️ Enhanced Media Player Pro 构建工具已加载');
    console.log('使用 window.EMP_DEPLOY.quickDeploy() 进行一键部署');
    console.log('使用 window.EMP_DEPLOY.createDeploymentWizard() 打开部署向导');
}
