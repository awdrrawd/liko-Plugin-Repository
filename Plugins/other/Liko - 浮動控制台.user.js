// ==UserScript==
// @name         Liko - 浮動控制台 (修復版)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  提供一個浮動的控制台視窗，可以查看日誌和執行命令
// @author       Likolisu
// @match        *://*/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/tool_wrench.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 防止重複執行
    if (document.getElementById('floating-console')) {
        return;
    }

    // 檢測可能的驗證頁面並跳過
    const sensitivePatterns = [
        /cloudflare/i,
        /recaptcha/i,
        /hcaptcha/i,
        /turnstile/i,
        /challenge/i,
        /verification/i,
        /captcha/i
    ];

    const shouldSkipPage = sensitivePatterns.some(pattern =>
        pattern.test(window.location.href) ||
        pattern.test(document.title) ||
        document.querySelector('[data-cf-beacon]') ||
        document.querySelector('.cf-browser-verification') ||
        document.querySelector('#challenge-stage')
    );

    if (shouldSkipPage) {
        console.log('Liko Console: 跳過驗證頁面');
        return;
    }

    // 等待 DOM 完全加載
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFloatingConsole);
    } else {
        initFloatingConsole();
    }

    function initFloatingConsole() {
        // 記錄視窗尺寸和位置
        let savedState = {
            width: '400px',
            height: '300px',
            x: 20,
            y: 20
        };

        // 創建浮動控制台容器
        const floatingConsole = document.createElement('div');
        floatingConsole.id = 'floating-console';
        floatingConsole.className = 'minimized'; // 預設縮小狀態

        // 使用 transform 定位而不是 bottom/top 混合
        floatingConsole.style.left = '20px';
        floatingConsole.style.top = 'auto';
        floatingConsole.style.bottom = '20px';
        floatingConsole.style.right = 'auto';

        // 創建圖標
        const consoleIcon = document.createElement('div');
        consoleIcon.id = 'console-icon';
        consoleIcon.className = 'console-icon';
        consoleIcon.innerHTML = '🔧';

        // 創建標題列
        const consoleHeader = document.createElement('div');
        consoleHeader.className = 'console-header';

        const consoleTitle = document.createElement('span');
        consoleTitle.className = 'console-title';
        consoleTitle.innerHTML = '🔧 浮動控制台';

        const consoleControls = document.createElement('div');
        consoleControls.className = 'console-controls';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'console-btn';
        copyBtn.id = 'copy-console';
        copyBtn.textContent = '複製';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'console-btn';
        clearBtn.id = 'clear-console';
        clearBtn.textContent = '清空';

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'console-btn';
        minimizeBtn.id = 'minimize-console';
        minimizeBtn.textContent = '−';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'console-btn';
        closeBtn.id = 'close-console';
        closeBtn.title = '關閉控制台 (刷新頁面可重新顯示)';
        closeBtn.textContent = '✕';

        consoleControls.appendChild(copyBtn);
        consoleControls.appendChild(clearBtn);
        consoleControls.appendChild(minimizeBtn);
        consoleControls.appendChild(closeBtn);
        consoleHeader.appendChild(consoleTitle);
        consoleHeader.appendChild(consoleControls);

        // 創建主體
        const consoleBody = document.createElement('div');
        consoleBody.className = 'console-body';

        const consoleOutput = document.createElement('div');
        consoleOutput.className = 'console-output';
        consoleOutput.id = 'console-output';

        const inputContainer = document.createElement('div');
        inputContainer.className = 'console-input-container';

        const consolePrompt = document.createElement('span');
        consolePrompt.className = 'console-prompt';
        consolePrompt.textContent = '>';

        const consoleInput = document.createElement('textarea');
        consoleInput.className = 'console-input';
        consoleInput.id = 'console-input';
        consoleInput.placeholder = '輸入 JavaScript 命令...';
        consoleInput.rows = '3';

        const executeBtnElement = document.createElement('button');
        executeBtnElement.className = 'console-execute';
        executeBtnElement.id = 'execute-btn';
        executeBtnElement.textContent = '執行';

        inputContainer.appendChild(consolePrompt);
        inputContainer.appendChild(consoleInput);
        inputContainer.appendChild(executeBtnElement);
        consoleBody.appendChild(consoleOutput);
        consoleBody.appendChild(inputContainer);

        floatingConsole.appendChild(consoleIcon);
        floatingConsole.appendChild(consoleHeader);
        floatingConsole.appendChild(consoleBody);

        // 安全地添加到 body
        try {
            document.body.appendChild(floatingConsole);
        } catch (e) {
            console.warn('Failed to append floating console to body:', e);
            return;
        }

        // 添加樣式 (降低 z-index，避免干擾驗證)
        const style = document.createElement('style');
        style.textContent = `
            #floating-console {
                position: fixed;
                width: 400px;
                height: 300px;
                background: rgba(30, 30, 30, 0.95);
                border: 1px solid rgba(51, 51, 51, 0.95);
                border-radius: 8px;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 12px;
                z-index: 999999; /* 降低 z-index */
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                resize: both;
                overflow: hidden;
                min-width: 300px;
                min-height: 200px;
                backdrop-filter: blur(10px);
                pointer-events: auto;
            }

            .console-header {
                background: rgba(51, 51, 51, 0.95);
                color: #fff;
                padding: 8px 12px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
                border-bottom: 1px solid rgba(85, 85, 85, 0.5);
            }

            .console-title {
                font-weight: bold;
                font-size: 13px;
            }

            .console-controls {
                display: flex;
                gap: 4px;
            }

            .console-btn {
                background: #555;
                border: none;
                color: #fff;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                transition: background 0.2s;
            }

            .console-btn:hover {
                background: #666;
            }

            .console-body {
                height: calc(100% - 40px);
                display: flex;
                flex-direction: column;
                opacity: 1;
            }

            .console-output {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                background: transparent;
                color: #fff;
                opacity: 1;
                font-size: 12px;
                line-height: 1.4;
            }

            .console-output::-webkit-scrollbar {
                width: 6px;
            }

            .console-output::-webkit-scrollbar-track {
                background: rgba(45, 45, 45, 0.5);
            }

            .console-output::-webkit-scrollbar-thumb {
                background: rgba(85, 85, 85, 0.8);
                border-radius: 3px;
            }

            .console-input-container {
                display: flex;
                align-items: flex-start;
                padding: 8px;
                background: rgba(45, 45, 45, 0.95);
                border-top: 1px solid rgba(85, 85, 85, 0.5);
                gap: 8px;
                opacity: 1;
            }

            .console-prompt {
                color: #4CAF50;
                font-weight: bold;
                line-height: 1.4;
                padding-top: 6px;
            }

            .console-input {
                flex: 1;
                background: rgba(30, 30, 30, 0.95);
                border: 1px solid rgba(85, 85, 85, 0.85);
                color: #fff;
                padding: 6px 10px;
                border-radius: 3px;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                min-height: 60px;
                max-height: 120px;
                resize: vertical;
                overflow: auto;
                opacity: 1;
            }

            .console-input:focus {
                outline: none;
                border-color: #4CAF50;
                box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
            }

            .console-execute {
                background: #4CAF50;
                border: none;
                color: white;
                padding: 8px 12px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
                transition: background 0.2s;
                align-self: flex-start;
            }

            .console-execute:hover {
                background: #45a049;
            }

            .console-log {
                margin: 2px 0;
                padding: 3px 6px;
                border-left: 3px solid transparent;
                border-radius: 2px;
                word-wrap: break-word;
                white-space: pre-wrap;
            }

            .console-log.log {
                color: #fff;
                border-left-color: #2196F3;
                background: rgba(33, 150, 243, 0.1);
            }

            .console-log.warn {
                color: #FFC107;
                border-left-color: #FFC107;
                background: rgba(255, 193, 7, 0.1);
            }

            .console-log.error {
                color: #F44336;
                border-left-color: #F44336;
                background: rgba(244, 67, 54, 0.1);
            }

            .console-log.info {
                color: #00BCD4;
                border-left-color: #00BCD4;
                background: rgba(0, 188, 212, 0.1);
            }

            .console-log.command {
                color: #4CAF50;
                border-left-color: #4CAF50;
                background: rgba(76, 175, 80, 0.1);
                font-weight: 500;
            }

            .console-log.result {
                color: #E1BEE7;
                border-left-color: #9C27B0;
                background: rgba(156, 39, 176, 0.1);
                margin-left: 16px;
            }

            .console-icon {
                display: none;
                position: fixed;
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                border-radius: 50%;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                cursor: grab;
                z-index: 999999;
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                border: 3px solid rgba(255,255,255,0.2);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                pointer-events: auto;
            }

            .console-icon:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 24px rgba(76, 175, 80, 0.4);
                border-color: rgba(255,255,255,0.4);
            }

            .console-icon:active {
                cursor: grabbing;
                transform: scale(1.0);
            }

            #floating-console.minimized .console-header,
            #floating-console.minimized .console-body {
                display: none;
            }

            #floating-console.minimized {
                width: 40px;
                height: 40px;
                background: none;
                border: none;
                box-shadow: none;
                resize: none;
                z-index: 999998;
                pointer-events: none;
                backdrop-filter: none;
            }

            #floating-console.minimized .console-icon {
                display: flex;
            }

            #floating-console:not(.minimized) {
                display: block;
                resize: both;
                z-index: 999999;
                pointer-events: auto;
            }

            @media (max-width: 768px) {
                #floating-console:not(.minimized) {
                    width: calc(100vw - 20px);
                    height: 250px;
                    left: 10px !important;
                    right: 10px !important;
                }

                .console-icon {
                    width: 35px;
                    height: 35px;
                    font-size: 14px;
                }

                .console-input-container {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 6px;
                }

                .console-prompt {
                    padding-top: 0;
                }

                .console-execute {
                    align-self: stretch;
                }
            }
        `;
        document.head.appendChild(style);

        // 控制台輸出元素
        const output = document.getElementById('console-output');
        const input = document.getElementById('console-input');
        const executeBtn = document.getElementById('execute-btn');

        // 命令歷史
        let commandHistory = [];
        let historyIndex = -1;

        // 簡單的自動補全建議
        const commandSuggestions = [
            'console.log', 'console.warn', 'console.error', 'console.info',
            'document.querySelector', 'document.getElementById', 'document.querySelectorAll',
            'window.location', 'localStorage', 'sessionStorage',
            'fetch', 'alert', 'prompt', 'confirm',
            'JSON.stringify', 'JSON.parse', 'Object.keys', 'Object.values'
        ];

        // 添加日誌到控制台
        function addLog(message, type = 'log') {
            const logElement = document.createElement('div');
            logElement.className = `console-log ${type}`;

            let displayMessage = message;
            if (typeof message === 'object' && message !== null) {
                try {
                    // 檢查是否為 DOM 元素
                    if (message instanceof HTMLElement) {
                        displayMessage = `[HTMLElement: ${message.tagName.toLowerCase()}]`;
                    } else if (Array.isArray(message)) {
                        // 明確處理陣列
                        displayMessage = JSON.stringify(message, null, 2);
                    } else {
                        // 處理物件，包含循環引用防護
                        const seen = new WeakSet();
                        displayMessage = JSON.stringify(message, (key, value) => {
                            if (typeof value === 'object' && value !== null) {
                                if (seen.has(value)) {
                                    return '[Circular]';
                                }
                                seen.add(value);
                            }
                            return value;
                        }, 2);
                    }
                } catch (e) {
                    displayMessage = `[Non-serializable Object: ${String(message)}]`;
                }
            } else if (typeof message === 'function') {
                displayMessage = message.toString();
            } else {
                displayMessage = String(message);
            }

            const timestamp = new Date().toLocaleTimeString('zh-TW', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            logElement.textContent = `[${timestamp}] ${displayMessage}`;
            output.appendChild(logElement);
            output.scrollTop = output.scrollHeight;

            if (output.children.length > 1000) {
                output.removeChild(output.firstChild);
            }
        }

        // 保守的 console 攔截 (只在控制台展開時攔截，減少干擾)
        const originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info
        };

        let consoleInterceptEnabled = false;

        function enableConsoleIntercept() {
            if (consoleInterceptEnabled) return;
            consoleInterceptEnabled = true;

            console.log = function(...args) {
                originalConsole.log.apply(console, args);
                if (!floatingConsole.classList.contains('minimized')) {
                    if (args.length === 0) {
                        addLog('', 'log');
                    } else if (args.length === 1) {
                        addLog(args[0], 'log');
                    } else {
                        // 傳遞所有參數
                        addLog(...args, 'log');
                    }
                }
            };

            console.warn = function(...args) {
                originalConsole.warn.apply(console, args);
                if (!floatingConsole.classList.contains('minimized')) {
                    if (args.length === 0) {
                        addLog('', 'warn');
                    } else if (args.length === 1) {
                        addLog(args[0], 'warn');
                    } else {
                        addLog(...args, 'warn');
                    }
                }
            };

            console.error = function(...args) {
                originalConsole.error.apply(console, args);
                if (!floatingConsole.classList.contains('minimized')) {
                    if (args.length === 0) {
                        addLog('', 'error');
                    } else if (args.length === 1) {
                        addLog(args[0], 'error');
                    } else {
                        addLog(...args, 'error');
                    }
                }
            };

            console.info = function(...args) {
                originalConsole.info.apply(console, args);
                if (!floatingConsole.classList.contains('minimized')) {
                    if (args.length === 0) {
                        addLog('', 'info');
                    } else if (args.length === 1) {
                        addLog(args[0], 'info');
                    } else {
                        addLog(...args, 'info');
                    }
                }
            };
        }

        function disableConsoleIntercept() {
            if (!consoleInterceptEnabled) return;
            consoleInterceptEnabled = false;

            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;
        }

        // 捕捉全域錯誤 (只在控制台展開時)
        function errorHandler(e) {
            if (!floatingConsole.classList.contains('minimized')) {
                addLog(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, 'error');
            }
        }

        function rejectionHandler(e) {
            if (!floatingConsole.classList.contains('minimized')) {
                addLog(`Unhandled Promise Rejection: ${e.reason}`, 'error');
            }
        }

        // 執行命令
        function executeCommand(command) {
            if (!command.trim()) return;

            addLog(`> ${command}`, 'command');
            commandHistory.unshift(command);
            if (commandHistory.length > 50) {
                commandHistory.pop();
            }
            historyIndex = -1;

            try {
                // 使用 Function 構造函數而不是 eval，提供更好的作用域控制
                const result = (new Function('return (' + command + ')'))();
                if (result !== undefined) {
                    addLog(result, 'result');
                }
            } catch (error) {
                try {
                    // 如果作為表達式失敗，嘗試作為語句執行
                    (new Function(command))();
                } catch (statementError) {
                    addLog(`錯誤: ${error.message}`, 'error');
                }
            }

            input.value = '';
        }

        // 自動補全函數
        function autoComplete() {
            const currentInput = input.value.trim();
            if (!currentInput) return;

            const matches = commandSuggestions.filter(suggestion =>
                suggestion.toLowerCase().startsWith(currentInput.toLowerCase())
            );

            if (matches.length > 0) {
                const cursorPos = input.selectionStart;
                const beforeCursor = input.value.substring(0, cursorPos);
                const afterCursor = input.value.substring(cursorPos);

                // 找到當前單詞的開始位置
                const wordStart = beforeCursor.lastIndexOf(' ') + 1;
                const currentWord = beforeCursor.substring(wordStart);

                const bestMatch = matches[0];
                if (bestMatch.toLowerCase().startsWith(currentWord.toLowerCase())) {
                    const completion = bestMatch.substring(currentWord.length);
                    input.value = beforeCursor + completion + afterCursor;
                    input.setSelectionRange(cursorPos + completion.length, cursorPos + completion.length);
                }
            }
        }

        // 事件監聽器
        executeBtn.addEventListener('click', () => {
            executeCommand(input.value);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                executeCommand(input.value);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    input.value = commandHistory[historyIndex] || '';
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    input.value = commandHistory[historyIndex] || '';
                } else if (historyIndex === 0) {
                    historyIndex = -1;
                    input.value = '';
                }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                autoComplete();
            }
        });

        // 控制台控制按鈕
        copyBtn.addEventListener('click', () => {
            const logs = output.textContent;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(logs).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✓';
                    copyBtn.style.background = '#45a049';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#555';
                    }, 1000);
                }).catch(() => {
                    addLog('複製失敗：瀏覽器不支援', 'error');
                });
            } else {
                // 備用方案
                const textArea = document.createElement('textarea');
                textArea.value = logs;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    copyBtn.textContent = '✓';
                    copyBtn.style.background = '#45a049';
                    setTimeout(() => {
                        copyBtn.textContent = '複製';
                        copyBtn.style.background = '#555';
                    }, 1000);
                } catch (e) {
                    addLog('複製失敗', 'error');
                }
                document.body.removeChild(textArea);
            }
        });

        clearBtn.addEventListener('click', () => {
            output.innerHTML = '';
            addLog('控制台已清空', 'info');
        });

        minimizeBtn.addEventListener('click', () => {
            // 記錄當前尺寸和位置
            const rect = floatingConsole.getBoundingClientRect();
            savedState.width = floatingConsole.style.width || rect.width + 'px';
            savedState.height = floatingConsole.style.height || rect.height + 'px';
            savedState.x = rect.left;
            savedState.y = window.innerHeight - rect.bottom;

            floatingConsole.classList.add('minimized');
            disableConsoleIntercept();
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
            updateIconPosition();
        });

        // 修復的拖拽系統
        let dragStarted = false;
        let dragStartPos = { x: 0, y: 0 };
        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        // 更新圖標位置
        function updateIconPosition() {
            if (floatingConsole.classList.contains('minimized')) {
                const iconSize = 40;
                const maxX = window.innerWidth - iconSize;
                const maxY = window.innerHeight - iconSize;

                // 使用保存的位置
                let left = Math.max(0, Math.min(savedState.x, maxX));
                let bottom = Math.max(0, Math.min(savedState.y, maxY));

                floatingConsole.style.left = left + 'px';
                floatingConsole.style.bottom = bottom + 'px';
                floatingConsole.style.top = 'auto';
                floatingConsole.style.right = 'auto';
            }
        }

        // 圖標事件處理
        consoleIcon.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragStarted = false;
            dragStartPos.x = e.clientX;
            dragStartPos.y = e.clientY;
            initDrag(e);
        });

        consoleIcon.addEventListener('mouseup', (e) => {
            if (!dragStarted) {
                // 展開控制台
                floatingConsole.classList.remove('minimized');
                floatingConsole.style.display = 'block';
                floatingConsole.style.width = savedState.width;
                floatingConsole.style.height = savedState.height;
                floatingConsole.style.left = savedState.x + 'px';
                floatingConsole.style.bottom = savedState.y + 'px';
                floatingConsole.style.top = 'auto';
                floatingConsole.style.right = 'auto';

                enableConsoleIntercept();
                window.addEventListener('error', errorHandler);
                window.addEventListener('unhandledrejection', rejectionHandler);

                // 聚焦到輸入框
                setTimeout(() => input.focus(), 100);
            }
            dragStarted = false;
        });

        closeBtn.addEventListener('click', () => {
            floatingConsole.style.display = 'none';
            disableConsoleIntercept();
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('unhandledrejection', rejectionHandler);
        });

        function initDrag(e) {
            isDragging = true;
            const rect = floatingConsole.getBoundingClientRect();

            if (floatingConsole.classList.contains('minimized')) {
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
            } else {
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
            }

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', stopDrag);
        }

        consoleHeader.addEventListener('mousedown', initDrag);

        function handleDrag(e) {
            if (!isDragging) return;

            const isMinimized = floatingConsole.classList.contains('minimized');
            const elementWidth = isMinimized ? 40 : parseFloat(savedState.width);
            const elementHeight = isMinimized ? 40 : parseFloat(savedState.height);

            const maxX = window.innerWidth - elementWidth;
            const maxY = window.innerHeight - elementHeight;

            const newLeft = Math.max(0, Math.min(e.clientX - dragOffset.x, maxX));
            const newTop = Math.max(0, Math.min(e.clientY - dragOffset.y, maxY));

            if (Math.abs(e.clientX - dragStartPos.x) > 3 || Math.abs(e.clientY - dragStartPos.y) > 3) {
                dragStarted = true;
            }

            // 統一使用 left/top 定位，避免混合使用
            floatingConsole.style.left = newLeft + 'px';
            floatingConsole.style.top = newTop + 'px';
            floatingConsole.style.bottom = 'auto';
            floatingConsole.style.right = 'auto';

            // 更新保存的位置
            savedState.x = newLeft;
            savedState.y = window.innerHeight - newTop - elementHeight;
        }

        function stopDrag() {
            isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
        }

        // 觸控支援
        let touchDragStarted = false;
        let touchStartPos = { x: 0, y: 0 };
        let touchOffset = { x: 0, y: 0 };

        function initTouchDrag(e) {
            const touch = e.touches[0];
            const rect = floatingConsole.getBoundingClientRect();
            touchOffset.x = touch.clientX - rect.left;
            touchOffset.y = touch.clientY - rect.top;
            touchDragStarted = false;
            touchStartPos.x = touch.clientX;
            touchStartPos.y = touch.clientY;
            document.addEventListener('touchmove', handleTouchDrag, { passive: false });
            document.addEventListener('touchend', stopTouchDrag);
        }

        consoleHeader.addEventListener('touchstart', initTouchDrag);

        consoleIcon.addEventListener('touchstart', (e) => {
            initTouchDrag(e);
        });

        consoleIcon.addEventListener('touchend', (e) => {
            if (!touchDragStarted) {
                floatingConsole.classList.remove('minimized');
                floatingConsole.style.display = 'block';
                floatingConsole.style.width = savedState.width;
                floatingConsole.style.height = savedState.height;
                floatingConsole.style.left = savedState.x + 'px';
                floatingConsole.style.top = (window.innerHeight - savedState.y - parseFloat(savedState.height)) + 'px';
                floatingConsole.style.bottom = 'auto';
                floatingConsole.style.right = 'auto';

                enableConsoleIntercept();
                window.addEventListener('error', errorHandler);
                window.addEventListener('unhandledrejection', rejectionHandler);
            }
            touchDragStarted = false;
        });

        function handleTouchDrag(e) {
            e.preventDefault();
            const touch = e.touches[0];
            const isMinimized = floatingConsole.classList.contains('minimized');
            const elementWidth = isMinimized ? 40 : parseFloat(savedState.width);
            const elementHeight = isMinimized ? 40 : parseFloat(savedState.height);

            const maxX = window.innerWidth - elementWidth;
            const maxY = window.innerHeight - elementHeight;

            const newLeft = Math.max(0, Math.min(touch.clientX - touchOffset.x, maxX));
            const newTop = Math.max(0, Math.min(touch.clientY - touchOffset.y, maxY));

            if (Math.abs(touch.clientX - touchStartPos.x) > 5 || Math.abs(touch.clientY - touchStartPos.y) > 5) {
                touchDragStarted = true;
            }

            floatingConsole.style.left = newLeft + 'px';
            floatingConsole.style.top = newTop + 'px';
            floatingConsole.style.bottom = 'auto';
            floatingConsole.style.right = 'auto';

            // 更新保存的位置
            savedState.x = newLeft;
            savedState.y = window.innerHeight - newTop - elementHeight;
        }

        function stopTouchDrag() {
            document.removeEventListener('touchmove', handleTouchDrag);
            document.removeEventListener('touchend', stopTouchDrag);
        }

        // 監聽視窗大小調整
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === floatingConsole && !floatingConsole.classList.contains('minimized')) {
                    const rect = entry.contentRect;
                    savedState.width = rect.width + 'px';
                    savedState.height = rect.height + 'px';
                    updateIconPosition();
                }
            }
        });

        if (window.ResizeObserver) {
            resizeObserver.observe(floatingConsole);
        }

        // 鍵盤快捷鍵（Ctrl+` 或 Cmd+` 切換顯示/最小化/隱藏）
        document.addEventListener('keydown', (e) => {
            // 避免在輸入框中觸發
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === '`') {
                e.preventDefault();
                if (floatingConsole.style.display === 'none') {
                    floatingConsole.style.display = 'block';
                    floatingConsole.classList.add('minimized');
                    updateIconPosition();
                } else if (floatingConsole.classList.contains('minimized')) {
                    floatingConsole.classList.remove('minimized');
                    floatingConsole.style.display = 'block';
                    floatingConsole.style.width = savedState.width;
                    floatingConsole.style.height = savedState.height;
                    floatingConsole.style.left = savedState.x + 'px';
                    floatingConsole.style.top = (window.innerHeight - savedState.y - parseFloat(savedState.height)) + 'px';
                    floatingConsole.style.bottom = 'auto';
                    floatingConsole.style.right = 'auto';

                    enableConsoleIntercept();
                    window.addEventListener('error', errorHandler);
                    window.addEventListener('unhandledrejection', rejectionHandler);

                    // 聚焦到輸入框
                    setTimeout(() => input.focus(), 100);
                } else {
                    // 記錄當前尺寸和位置
                    const rect = floatingConsole.getBoundingClientRect();
                    savedState.width = floatingConsole.style.width || rect.width + 'px';
                    savedState.height = floatingConsole.style.height || rect.height + 'px';
                    savedState.x = rect.left;
                    savedState.y = window.innerHeight - rect.bottom;

                    floatingConsole.classList.add('minimized');
                    disableConsoleIntercept();
                    window.removeEventListener('error', errorHandler);
                    window.removeEventListener('unhandledrejection', rejectionHandler);
                    updateIconPosition();
                }
            }
            // ESC 鍵最小化控制台
            else if (e.key === 'Escape' && !floatingConsole.classList.contains('minimized') && floatingConsole.style.display !== 'none') {
                const rect = floatingConsole.getBoundingClientRect();
                savedState.width = floatingConsole.style.width || rect.width + 'px';
                savedState.height = floatingConsole.style.height || rect.height + 'px';
                savedState.x = rect.left;
                savedState.y = window.innerHeight - rect.bottom;

                floatingConsole.classList.add('minimized');
                disableConsoleIntercept();
                window.removeEventListener('error', errorHandler);
                window.removeEventListener('unhandledrejection', rejectionHandler);
                updateIconPosition();
            }
        });

        // 窗口大小變化時調整位置
        window.addEventListener('resize', () => {
            updateIconPosition();
        });

        // 歡迎信息
        addLog('🔧 浮動控制台已載入！(修復版)', 'info');
        addLog('• Enter 執行命令，↑/↓ 瀏覽歷史，Tab 自動補全', 'info');
        addLog('• 複製按鈕可複製所有日誌，Ctrl+` 切換顯示', 'info');
        addLog('• ESC 鍵快速最小化，支援拖拽和觸控操作', 'info');
        addLog('• 修復了Y軸鎖定問題，減少對驗證頁面的干擾', 'info');

        // 初始化完成後更新圖標位置
        updateIconPosition();
    }
})();
