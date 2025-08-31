
// ==UserScript==
// @name         Liko - 浮動控制台
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  提供一個浮動的控制台視窗，可以查看日志和執行命令
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

    // 記錄視窗尺寸
    let savedDimensions = { width: '400px', height: '300px' };

    // 創建浮動控制台容器
    const floatingConsole = document.createElement('div');
    floatingConsole.id = 'floating-console';
    floatingConsole.className = 'minimized'; // 預設縮小狀態
    floatingConsole.style.bottom = '20px'; // Changed from top to bottom
    floatingConsole.style.left = '20px';

    // 創建圖標
    const consoleIcon = document.createElement('div');
    consoleIcon.id = 'console-icon';
    consoleIcon.className = 'console-icon';
    consoleIcon.textContent = '🔧';

    // 創建標題列
    const consoleHeader = document.createElement('div');
    consoleHeader.className = 'console-header';

    const consoleTitle = document.createElement('span');
    consoleTitle.className = 'console-title';
    consoleTitle.textContent = '🔧 浮動控制台';

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
    document.body.appendChild(floatingConsole);

    // 添加樣式
    const style = document.createElement('style');
    style.textContent = `
        #floating-console {
            position: fixed;
            width: 400px;
            height: 300px;
            background: rgba(30, 30, 30, 0.85);
            border: 1px solid rgba(51, 51, 51, 0.85);
            border-radius: 8px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            resize: both;
            overflow: hidden;
            min-width: 300px;
            min-height: 200px;
        }

        .console-header {
            background: rgba(51, 51, 51, 0.85);
            color: #fff;
            padding: 8px 12px;
            cursor: move;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        }

        .console-title {
            font-weight: bold;
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
        }

        .console-input-container {
            display: flex;
            align-items: center;
            padding: 8px;
            background: rgba(45, 45, 45, 0.85);
            border-top: 1px solid rgba(51, 51, 51, 0.85);
            gap: 8px;
            opacity: 1;
        }

        .console-prompt {
            color: #4CAF50;
            margin-right: 8px;
            font-weight: bold;
        }

        .console-input {
            flex: 1;
            background: rgba(30, 30, 30, 0.85);
            border: 1px solid rgba(85, 85, 85, 0.85);
            color: #fff;
            padding: 6px 10px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
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
        }

        .console-execute {
            margin-left: 8px;
            background: #4CAF50;
            border: none;
            color: white;
            padding: 4px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
        }

        .console-execute:hover {
            background: #45a049;
        }

        .console-log {
            margin: 2px 0;
            padding: 2px 4px;
            border-left: 3px solid transparent;
        }

        .console-log.log {
            color: #fff;
            border-left-color: #2196F3;
        }

        .console-log.warn {
            color: #FFC107;
            border-left-color: #FFC107;
        }

        .console-log.error {
            color: #F44336;
            border-left-color: #F44336;
        }

        .console-log.info {
            color: #00BCD4;
            border-left-color: #00BCD4;
        }

        .console-log.command {
            color: #4CAF50;
            border-left-color: #4CAF50;
        }

        .console-log.result {
            color: #E1BEE7;
            border-left-color: #9C27B0;
            margin-left: 16px;
        }

        .console-icon {
            display: none;
            position: fixed;
            width: 30px;
            height: 30px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            border-radius: 50%;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            cursor: grab;
            z-index: 2147483647;
            box-shadow: 0 3px 12px rgba(0,0,0,0.4);
            border: 3px solid rgba(255,255,255,0.3);
            transition: all 0.3s ease;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            pointer-events: auto;
        }

        .console-icon:hover {
            transform: scale(1.15);
            box-shadow: 0 5px 20px rgba(76, 175, 80, 0.5);
            border-color: rgba(255,255,255,0.5);
        }

        .console-icon:active {
            cursor: grabbing;
            transform: scale(1.05);
        }

        #floating-console.minimized .console-header,
        #floating-console.minimized .console-body {
            display: none;
        }

        #floating-console.minimized {
            width: 30px;
            height: 30px;
            background: none;
            border: none;
            box-shadow: none;
            resize: none;
            z-index: 1;
            pointer-events: none;
        }

        #floating-console.minimized .console-icon {
            display: flex;
        }

        #floating-console:not(.minimized) {
            display: block;
            resize: both;
            z-index: 10000;
            pointer-events: auto;
        }

        @media (max-width: 768px) {
            #floating-console:not(.minimized) {
                width: calc(100vw - 20px);
                height: 250px;
            }

            .console-icon {
                width: 30px;
                height: 30px;
                font-size: 14px;
            }

            .console-input-container {
                flex-direction: row;
                align-items: center;
            }

            .console-prompt {
                margin-top: 0;
                margin-bottom: 0;
            }

            .console-execute {
                margin-top: 0;
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
        'document.querySelector', 'document.getElementById',
        'window.location', 'localStorage', 'sessionStorage',
        'fetch', 'alert', 'prompt'
    ];

    // 添加日志到控制台
    function addLog(message, type = 'log') {
        const logElement = document.createElement('div');
        logElement.className = `console-log ${type}`;

        if (typeof message === 'object') {
            try {
                // Improved object/array display
                message = JSON.stringify(message, null, 2)
                    .replace(/\n/g, '\n    ') // Indent multi-line output
                    .replace(/\\"/g, '"');     // Remove escaped quotes
            } catch (e) {
                message = String(message);
            }
        }

        logElement.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        output.appendChild(logElement);
        output.scrollTop = output.scrollHeight;
    }

    // 攔截原生控制台方法
    const originalConsole = {
        log: console.log,
        warn: console.warn,
        error: console.error,
        info: console.info
    };

    console.log = function(...args) {
        originalConsole.log.apply(console, args);
        addLog(args.join(' '), 'log');
    };

    console.warn = function(...args) {
        originalConsole.warn.apply(console, args);
        addLog(args.join(' '), 'warn');
    };

    console.error = function(...args) {
        originalConsole.error.apply(console, args);
        addLog(args.join(' '), 'error');
    };

    console.info = function(...args) {
        originalConsole.info.apply(console, args);
        addLog(args.join(' '), 'info');
    };

    window.addEventListener('error', function(e) {
        addLog(`${e.message} at ${e.filename}:${e.lineno}:${e.colno}`, 'error');
    });

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
            const result = eval(command);
            if (result !== undefined) {
                addLog(result, 'result');
            }
        } catch (error) {
            addLog(`錯誤: ${error.message}`, 'error');
        }

        input.value = '';
    }

    // 自動補全函數
    function autoComplete() {
        const currentInput = input.value.trim();
        if (!currentInput) return;

        const matches = commandSuggestions.filter(suggestion =>
            suggestion.startsWith(currentInput)
        );

        if (matches.length > 0) {
            input.value = matches[0];
            input.setSelectionRange(currentInput.length, matches[0].length);
        }
    }

    // 事件監聽器
    executeBtn.addEventListener('click', () => {
        executeCommand(input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
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
    });

    clearBtn.addEventListener('click', () => {
        output.innerHTML = '';
    });

    minimizeBtn.addEventListener('click', () => {
        // 記錄當前尺寸
        savedDimensions.width = floatingConsole.style.width || '400px';
        savedDimensions.height = floatingConsole.style.height || '300px';
        floatingConsole.classList.add('minimized');
        updateIconPosition();
    });

    // 拖拽相關變數
    let dragStarted = false;
    let dragStartPos = { x: 0, y: 0 };
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // 更新圖標位置以匹配視窗
    function updateIconPosition() {
        if (floatingConsole.classList.contains('minimized')) {
            const rect = floatingConsole.getBoundingClientRect();
            const maxX = window.innerWidth - 30; // icon width
            const maxY = window.innerHeight - 30; // icon height

            let left = parseFloat(floatingConsole.style.left) || rect.left;
            let bottom = parseFloat(floatingConsole.style.bottom) || (window.innerHeight - rect.bottom);

            // 限制在視窗內
            left = Math.max(0, Math.min(left, maxX));
            bottom = Math.max(0, Math.min(bottom, maxY));

            floatingConsole.style.left = left + 'px';
            floatingConsole.style.bottom = bottom + 'px';
            consoleIcon.style.left = left + 'px';
            consoleIcon.style.bottom = bottom + 'px';
            consoleIcon.style.right = 'auto';
            consoleIcon.style.top = 'auto';
        } else {
            consoleIcon.style.left = floatingConsole.style.left;
            consoleIcon.style.bottom = floatingConsole.style.bottom;
            consoleIcon.style.right = 'auto';
            consoleIcon.style.top = 'auto';
        }
    }

    consoleIcon.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragStarted = false;
        dragStartPos.x = e.clientX;
        dragStartPos.y = e.clientY;
        initDrag(e);
    });

    consoleIcon.addEventListener('mouseup', (e) => {
        if (!dragStarted) {
            floatingConsole.classList.remove('minimized');
            floatingConsole.style.display = 'block';
            // 恢復保存的尺寸
            floatingConsole.style.width = savedDimensions.width;
            floatingConsole.style.height = savedDimensions.height;
        }
        dragStarted = false;
    });

    closeBtn.addEventListener('click', () => {
        floatingConsole.style.display = 'none';
    });

    function initDrag(e) {
        isDragging = true;
        const rect = floatingConsole.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - (window.innerHeight - rect.bottom);
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
    }

    consoleHeader.addEventListener('mousedown', initDrag);

    function handleDrag(e) {
        if (!isDragging) return;
        const newLeft = e.clientX - dragOffset.x;
        const newBottom = window.innerHeight - e.clientY - dragOffset.y;

        if (Math.abs(e.clientX - dragStartPos.x) > 3 || Math.abs(e.clientY - dragStartPos.y) > 3) {
            dragStarted = true;
        }

        if (floatingConsole.classList.contains('minimized')) {
            const maxX = window.innerWidth - 30;
            const maxY = window.innerHeight - 30;
            floatingConsole.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            floatingConsole.style.bottom = Math.max(0, Math.min(newBottom, maxY)) + 'px';
        } else {
            floatingConsole.style.left = newLeft + 'px';
            floatingConsole.style.bottom = newBottom + 'px';
        }
        floatingConsole.style.right = 'auto';
        floatingConsole.style.top = 'auto';
        updateIconPosition();
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
    }

    let touchDragStarted = false;
    let touchStartPos = { x: 0, y: 0 };
    let touchOffset = { x: 0, y: 0 };

    function initTouchDrag(e) {
        const touch = e.touches[0];
        const rect = floatingConsole.getBoundingClientRect();
        touchOffset.x = touch.clientX - rect.left;
        touchOffset.y = touch.clientY - (window.innerHeight - rect.bottom);
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
            // 恢復保存的尺寸
            floatingConsole.style.width = savedDimensions.width;
            floatingConsole.style.height = savedDimensions.height;
        }
        touchDragStarted = false;
    });

    function handleTouchDrag(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const newLeft = touch.clientX - touchOffset.x;
        const newBottom = window.innerHeight - touch.clientY - touchOffset.y;

        if (Math.abs(touch.clientX - touchStartPos.x) > 5 || Math.abs(touch.clientY - touchStartPos.y) > 5) {
            touchDragStarted = true;
        }

        if (floatingConsole.classList.contains('minimized')) {
            const maxX = window.innerWidth - 30;
            const maxY = window.innerHeight - 30;
            floatingConsole.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
            floatingConsole.style.bottom = Math.max(0, Math.min(newBottom, maxY)) + 'px';
        } else {
            floatingConsole.style.left = newLeft + 'px';
            floatingConsole.style.bottom = newBottom + 'px';
        }
        floatingConsole.style.right = 'auto';
        floatingConsole.style.top = 'auto';
        updateIconPosition();
    }

    function stopTouchDrag() {
        document.removeEventListener('touchmove', handleTouchDrag);
        document.removeEventListener('touchend', stopTouchDrag);
    }

    // 修正縮放坐標並記錄尺寸
    floatingConsole.addEventListener('resize', () => {
        if (!floatingConsole.classList.contains('minimized')) {
            const rect = floatingConsole.getBoundingClientRect();
            floatingConsole.style.left = rect.left + 'px';
            floatingConsole.style.bottom = (window.innerHeight - rect.bottom) + 'px';
            floatingConsole.style.right = 'auto';
            floatingConsole.style.top = 'auto';
            // 記錄縮放後的尺寸
            savedDimensions.width = floatingConsole.style.width || rect.width + 'px';
            savedDimensions.height = floatingConsole.style.height || rect.height + 'px';
            updateIconPosition();
        }
    });

    // 鍵盤快捷鍵（Ctrl+` 或 Cmd+` 切換顯示/最小化/隱藏）
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === '`') {
            e.preventDefault();
            if (floatingConsole.style.display === 'none') {
                floatingConsole.style.display = 'block';
                floatingConsole.classList.add('minimized');
                updateIconPosition();
            } else if (floatingConsole.classList.contains('minimized')) {
                floatingConsole.classList.remove('minimized');
                floatingConsole.style.display = 'block';
                floatingConsole.style.width = savedDimensions.width;
                floatingConsole.style.height = savedDimensions.height;
            } else {
                // 記錄當前尺寸
                savedDimensions.width = floatingConsole.style.width || '400px';
                savedDimensions.height = floatingConsole.style.height || '300px';
                floatingConsole.classList.add('minimized');
                updateIconPosition();
            }
        }
    });

    // 歡迎信息
    addLog('🔧 浮動控制台已載入！預設為縮小狀態', 'info');
    addLog('• Enter 執行命令，↑/↓ 瀏覽歷史，Tab 自動補全', 'info');
    addLog('• 複製按鈕可複製所有日志，Ctrl+` 切換顯示', 'info');
})();
