/**
 * BC Enhanced Media - Components Module
 * UI組件模組（播放列表、控制面板、對話框等）
 */

window.BCEnhancedMedia = window.BCEnhancedMedia || {};
window.BCEnhancedMedia.Components = (function() {
    'use strict';

    const helpers = window.BCEnhancedMedia.Helpers;
    const validation = window.BCEnhancedMedia.Validation;
    const player = window.BCEnhancedMedia.Player;

    // 組件狀態
    const componentState = {
        playlistVisible: true,
        sortableInstance: null,
        activeDialogs: new Set()
    };

    // 初始化組件
    function initialize() {
        console.log('[BC Enhanced Media] Components module initialized');
        return true;
    }

    // 渲染播放列表
    function renderPlaylist() {
        const playlistArea = document.querySelector('.bc-media-playlist-area');
        if (!playlistArea) return;

        // 清空現有內容
        playlistArea.innerHTML = '';

        // 創建頂部控制欄
        const topBar = createPlaylistTopBar();
        playlistArea.appendChild(topBar);

        // 創建播放列表容器
        const listContainer = document.createElement('div');
        listContainer.className = 'bc-media-playlist-list';
        listContainer.style.height = 'calc(100% - 40px)';
        listContainer.style.overflowY = 'auto';
        listContainer.style.padding = '8px';

        const playerState = player.getState();
        
        // 渲染播放列表項目
        playerState.playList.forEach((item, index) => {
            const listItem = createPlaylistItem(item, index);
            listContainer.appendChild(listItem);
        });

        playlistArea.appendChild(listContainer);

        // 如果有修改權限，設置拖拽排序
        if (hasModifyPermission() && window.Sortable) {
            componentState.sortableInstance = new Sortable(listContainer, {
                animation: 200,
                draggable: '.bc-media-playlist-item',
                onUpdate: handlePlaylistReorder
            });
        }
    }

    // 創建播放列表頂部控制欄
    function createPlaylistTopBar() {
        const topBar = document.createElement('div');
        topBar.className = 'bc-media-playlist-top-bar';
        
        Object.assign(topBar.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '40px',
            padding: '0 12px',
            backgroundColor: '#172633',
            borderBottom: '1px solid #333',
            color: '#fff'
        });

        // 標題
        const title = document.createElement('span');
        title.textContent = hasModifyPermission() ? '播放列表' : '播放列表 (僅觀看)';
        title.style.fontSize = '14px';
        title.style.color = hasModifyPermission() ? '#fff' : '#888';
        topBar.appendChild(title);

        // 按鈕組
        if (hasModifyPermission()) {
            const btnGroup = document.createElement('div');
            btnGroup.style.display = 'flex';
            btnGroup.style.gap = '4px';

            // 添加媒體按鈕
            const addBtn = createTopBarButton('➕', '添加媒體', showAddMediaDialog);
            btnGroup.appendChild(addBtn);

            // 導入/導出按鈕
            const importBtn = createTopBarButton('📋', '批量導入', showImportDialog);
            btnGroup.appendChild(importBtn);

            topBar.appendChild(btnGroup);
        }

        return topBar;
    }

    // 創建頂部欄按鈕
    function createTopBarButton(text, title, onClick) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.title = title;
        btn.onclick = onClick;
        
        Object.assign(btn.style, {
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            transition: 'background-color 0.2s'
        });

        btn.onmouseenter = () => btn.style.backgroundColor = 'rgba(255,255,255,0.2)';
        btn.onmouseleave = () => btn.style.backgroundColor = 'rgba(255,255,255,0.1)';

        helpers.preventTextSelection(btn);
        return btn;
    }

    // 創建播放列表項目
    function createPlaylistItem(item, index) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bc-media-playlist-item';
        itemDiv.dataset.itemId = item.id;
        
        const playerState = player.getState();
        const isCurrentPlaying = playerState.currentPlayingId === item.id;
        
        Object.assign(itemDiv.style, {
            display: 'flex',
            alignItems: 'center',
            padding: '8px',
            marginBottom: '4px',
            backgroundColor: isCurrentPlaying ? 'rgba(68, 221, 68, 0.2)' : 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: isCurrentPlaying ? '1px solid #44dd44' : '1px solid transparent'
        });

        // 播放按鈕/狀態指示器
        const playIcon = document.createElement('div');
        playIcon.innerHTML = isCurrentPlaying ? 
            (player.isPlaying() ? '⏸️' : '▶️') : '▶️';
        playIcon.style.width = '24px';
        playIcon.style.textAlign = 'center';
        playIcon.style.cursor = 'pointer';
        itemDiv.appendChild(playIcon);

        // 媒體信息
        const infoDiv = document.createElement('div');
        infoDiv.style.flex = '1';
        infoDiv.style.marginLeft = '12px';
        infoDiv.style.overflow = 'hidden';

        // 標題
        const titleDiv = document.createElement('div');
        titleDiv.textContent = item.name || '未命名媒體';
        titleDiv.style.color = '#fff';
        titleDiv.style.fontSize = '13px';
        titleDiv.style.fontWeight = isCurrentPlaying ? 'bold' : 'normal';
        titleDiv.style.marginBottom = '2px';
        titleDiv.style.overflow = 'hidden';
        titleDiv.style.textOverflow = 'ellipsis';
        titleDiv.style.whiteSpace = 'nowrap';
        infoDiv.appendChild(titleDiv);

        // URL預覽（縮短版）
        const urlDiv = document.createElement('div');
        const displayUrl = item.url.length > 30 ? 
            item.url.substring(0, 30) + '...' : item.url;
        urlDiv.textContent = displayUrl;
        urlDiv.style.color = '#888';
        urlDiv.style.fontSize = '11px';
        urlDiv.style.overflow = 'hidden';
        urlDiv.style.textOverflow = 'ellipsis';
        urlDiv.style.whiteSpace = 'nowrap';
        infoDiv.appendChild(urlDiv);

        itemDiv.appendChild(infoDiv);

        // 操作按鈕組
        if (hasModifyPermission()) {
            const actionsDiv = document.createElement('div');
            actionsDiv.style.display = 'flex';
            actionsDiv.style.gap = '4px';

            // 刪除按鈕
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = '刪除';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                removePlaylistItem(item.id, index);
            };
            styleActionButton(deleteBtn);
            actionsDiv.appendChild(deleteBtn);

            itemDiv.appendChild(actionsDiv);
        }

        // 點擊播放
        itemDiv.onclick = () => {
            player.playById(item.id);
        };

        // 懸停效果
        itemDiv.onmouseenter = () => {
            if (!isCurrentPlaying) {
                itemDiv.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }
        };
        itemDiv.onmouseleave = () => {
            if (!isCurrentPlaying) {
                itemDiv.style.backgroundColor = 'rgba(255,255,255,0.05)';
            }
        };

        helpers.preventTextSelection(itemDiv);
        return itemDiv;
    }

    // 樣式化操作按鈕
    function styleActionButton(btn) {
        Object.assign(btn.style, {
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            fontSize: '10px'
        });
        
        btn.onmouseenter = () => btn.style.backgroundColor = 'rgba(255,0,0,0.3)';
        btn.onmouseleave = () => btn.style.backgroundColor = 'rgba(255,255,255,0.1)';
        
        helpers.preventTextSelection(btn);
    }

    // 顯示添加媒體對話框
    function showAddMediaDialog(defaultName = '', defaultUrl = '') {
        if (componentState.activeDialogs.has('add-media')) return;
        
        const dialog = createDialog('add-media', '添加媒體', '400px');
        
        // 名稱輸入
        const nameLabel = document.createElement('label');
        nameLabel.textContent = '名稱:';
        nameLabel.style.display = 'block';
        nameLabel.style.marginBottom = '4px';
        nameLabel.style.color = '#333';
        nameLabel.style.fontSize = '14px';
        dialog.content.appendChild(nameLabel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = defaultName;
        nameInput.placeholder = '輸入媒體名稱';
        styleInput(nameInput);
        dialog.content.appendChild(nameInput);

        // URL輸入
        const urlLabel = document.createElement('label');
        urlLabel.textContent = 'URL:';
        urlLabel.style.display = 'block';
        urlLabel.style.marginTop = '12px';
        urlLabel.style.marginBottom = '4px';
        urlLabel.style.color = '#333';
        urlLabel.style.fontSize = '14px';
        dialog.content.appendChild(urlLabel);

        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.value = defaultUrl;
        urlInput.placeholder = '輸入媒體URL';
        styleInput(urlInput);
        dialog.content.appendChild(urlInput);

        // 格式提示
        const formatInfo = document.createElement('div');
        formatInfo.innerHTML = `
            <p style="margin: 8px 0; font-size: 12px; color: #666;">
                支援格式: MP4, MP3, M3U8, WebM, OGG, FLAC, AAC 等<br>
                <a href="https://xinlian132243.github.io/BCMod/VideoPlayerUrlGuide.html" target="_blank">獲取URL指引</a>
            </p>
        `;
        dialog.content.appendChild(formatInfo);

        // 驗證信息區域
        const validationDiv = document.createElement('div');
        validationDiv.className = 'validation-info';
        validationDiv.style.marginTop = '8px';
        validationDiv.style.minHeight = '20px';
        dialog.content.appendChild(validationDiv);

        // 實時驗證
        urlInput.oninput = () => {
            const url = urlInput.value.trim();
            if (url) {
                const result = validation.validateURL(url);
                updateValidationDisplay(validationDiv, result);
            } else {
                validationDiv.innerHTML = '';
            }
        };

        // 按鈕
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.justifyContent = 'flex-end';
        btnGroup.style.gap = '8px';
        btnGroup.style.marginTop = '16px';

        const cancelBtn = createDialogButton('取消', () => closeDialog(dialog));
        const confirmBtn = createDialogButton('確定', () => {
            const name = nameInput.value.trim();
            const url = urlInput.value.trim();
            
            if (!name) {
                alert('請輸入媒體名稱');
                return;
            }
            
            if (!url) {
                alert('請輸入媒體URL');
                return;
            }

            const validationResult = validation.validateURL(url);
            if (!validationResult.valid) {
                alert('URL驗證失敗: ' + validationResult.errors.join(', '));
                return;
            }

            addPlaylistItem(name, url);
            closeDialog(dialog);
        }, true);

        btnGroup.appendChild(cancelBtn);
        btnGroup.appendChild(confirmBtn);
        dialog.content.appendChild(btnGroup);

        // 自動聚焦到名稱輸入框
        setTimeout(() => nameInput.focus(), 100);
    }

    // 顯示批量導入對話框
    function showImportDialog() {
        if (componentState.activeDialogs.has('import')) return;
        
        const dialog = createDialog('import', '批量導入', '600px');
        
        // 說明文字
        const instruction = document.createElement('p');
        instruction.textContent = '請在下方輸入播放列表信息，格式為：從第一個視頻名稱開始，名稱和視頻地址輪流占行。';
        instruction.style.marginBottom = '12px';
        instruction.style.color = '#333';
        instruction.style.fontSize = '14px';
        dialog.content.appendChild(instruction);

        // 文本域
        const textArea = document.createElement('textarea');
        textArea.placeholder = `範例：
第一個視頻
https://example.com/video1.mp4
第二個視頻
https://example.com/video2.mp3`;
        
        // 預填現有播放列表
        const playerState = player.getState();
        if (playerState.playList.length > 0) {
            textArea.value = playerState.playList
                .map(item => `${item.name}\n${item.url}`)
                .join('\n');
        }
        
        Object.assign(textArea.style, {
            width: '100%',
            height: '300px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            resize: 'vertical',
            boxSizing: 'border-box'
        });
        
        dialog.content.appendChild(textArea);

        // 按鈕組
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.justifyContent = 'space-between';
        btnGroup.style.marginTop = '12px';

        const leftButtons = document.createElement('div');
        leftButtons.style.display = 'flex';
        leftButtons.style.gap = '8px';

        const copyBtn = createDialogButton('複製', () => {
            textArea.select();
            document.execCommand('copy');
        });
        leftButtons.appendChild(copyBtn);

        const rightButtons = document.createElement('div');
        rightButtons.style.display = 'flex';
        rightButtons.style.gap = '8px';

        const cancelBtn = createDialogButton('取消', () => closeDialog(dialog));
        const confirmBtn = createDialogButton('確定', () => {
            const lines = textArea.value.trim().split('\n');
            if (lines.length % 2 !== 0) {
                alert('輸入格式錯誤，行數必須為偶數（名稱和URL成對出現）');
                return;
            }

            const newPlaylist = [];
            for (let i = 0; i < lines.length; i += 2) {
                const name = lines[i].trim();
                const url = lines[i + 1].trim();
                
                if (!name || !url) {
                    alert(`第 ${i/2 + 1} 個項目的名稱或URL為空`);
                    return;
                }

                // 驗證URL
                const validationResult = validation.validateURL(url);
                if (!validationResult.valid) {
                    const proceed = confirm(`第 ${i/2 + 1} 個項目URL驗證失敗: ${validationResult.errors.join(', ')}\n\n是否繼續導入？`);
                    if (!proceed) return;
                }

                newPlaylist.push({
                    id: helpers.generateGUID(),
                    name: name,
                    url: url
                });
            }

            setPlaylist(newPlaylist);
            closeDialog(dialog);
        }, true);

        rightButtons.appendChild(cancelBtn);
        rightButtons.appendChild(confirmBtn);

        btnGroup.appendChild(leftButtons);
        btnGroup.appendChild(rightButtons);
        dialog.content.appendChild(btnGroup);
    }

    // 創建對話框
    function createDialog(id, title, width = '400px') {
        const overlay = document.createElement('div');
        overlay.className = 'bc-media-dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.className = 'bc-media-dialog';
        dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            width: ${width};
            max-width: 90vw;
            max-height: 80vh;
            overflow: hidden;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            padding: 16px 20px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8f9fa;
        `;

        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.margin = '0';
        titleElement.style.color = '#333';
        header.appendChild(titleElement);

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            padding: 4px;
            border-radius: 4px;
        `;
        closeButton.onclick = () => closeDialog({ overlay, id });
        header.appendChild(closeButton);

        const content = document.createElement('div');
        content.className = 'bc-media-dialog-content';
        content.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            max-height: calc(80vh - 80px);
        `;

        dialog.appendChild(header);
        dialog.appendChild(content);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        componentState.activeDialogs.add(id);
        helpers.preventTextSelection(dialog);

        // 點擊外部關閉
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closeDialog({ overlay, id });
            }
        };

        return { overlay, dialog, content, id };
    }

    // 關閉對話框
    function closeDialog(dialog) {
        if (dialog.overlay && dialog.overlay.parentNode) {
            document.body.removeChild(dialog.overlay);
        }
        componentState.activeDialogs.delete(dialog.id);
    }

    // 創建對話框按鈕
    function createDialogButton(text, onClick, isPrimary = false) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.onclick = onClick;
        
        const baseStyle = `
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;
        
        if (isPrimary) {
            btn.style.cssText = baseStyle + `
                background: #007bff;
                border: 1px solid #007bff;
                color: white;
            `;
            btn.onmouseenter = () => btn.style.backgroundColor = '#0056b3';
            btn.onmouseleave = () => btn.style.backgroundColor = '#007bff';
        } else {
            btn.style.cssText = baseStyle + `
                background: white;
                border: 1px solid #ddd;
                color: #333;
            `;
            btn.onmouseenter = () => btn.style.backgroundColor = '#f8f9fa';
            btn.onmouseleave = () => btn.style.backgroundColor = 'white';
        }

        helpers.preventTextSelection(btn);
        return btn;
    }

    // 樣式化輸入框
    function styleInput(input) {
        Object.assign(input.style, {
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box',
            marginBottom: '8px'
        });

        input.onfocus = () => input.style.borderColor = '#007bff';
        input.onblur = () => input.style.borderColor = '#ddd';
    }

    // 更新驗證顯示
    function updateValidationDisplay(container, result) {
        let html = '';
        
        if (result.valid) {
            html = `<div style="color: #28a745; font-size: 12px;">✓ URL驗證通過</div>`;
            if (result.type) {
                html += `<div style="color: #6c757d; font-size: 11px;">類型: ${result.type}</div>`;
            }
        } else {
            html = `<div style="color: #dc3545; font-size: 12px;">✗ ${result.errors.join(', ')}</div>`;
        }

        if (result.warnings && result.warnings.length > 0) {
            html += `<div style="color: #ffc107; font-size: 11px;">⚠ ${result.warnings.join(', ')}</div>`;
        }

        container.innerHTML = html;
    }

    // 播放列表操作
    function addPlaylistItem(name, url) {
        const playerState = player.getState();
        const newItem = {
            id: helpers.generateGUID(),
            name: name,
            url: url
        };

        playerState.playList.push(newItem);
        
        // 通知同步模組
        if (window.BCEnhancedMedia.Sync) {
            window.BCEnhancedMedia.Sync.updateSyncTime();
            window.BCEnhancedMedia.Sync.sendSyncList();
        }
        
        renderPlaylist();
    }

    function removePlaylistItem(id, index) {
        if (!confirm('確定要刪除此項目嗎？')) return;
        
        const playerState = player.getState();
        playerState.playList.splice(index, 1);
        
        // 如果刪除的是正在播放的項目
        if (playerState.currentPlayingId === id) {
            player.updateTitle('暫無播放中');
            // 可以選擇播放下一首或停止
        }
        
        // 通知同步模組
        if (window.BCEnhancedMedia.Sync) {
            window.BCEnhancedMedia.Sync.updateSyncTime();
            window.BCEnhancedMedia.Sync.sendSyncList();
        }
        
        renderPlaylist();
    }

    function setPlaylist(newPlaylist) {
        const playerState = player.getState();
        playerState.playList = newPlaylist;
        
        // 如果列表不為空且沒有正在播放的項目，播放第一個
        if (newPlaylist.length > 0 && !playerState.currentPlayingId) {
            player.playById(newPlaylist[0].id);
        }
        
        // 通知同步模組
        if (window.BCEnhancedMedia.Sync) {
            window.BCEnhancedMedia.Sync.updateSyncTime();
            window.BCEnhancedMedia.Sync.sendSyncList();
            window.BCEnhancedMedia.Sync.sendSyncPlay();
        }
        
        renderPlaylist();
    }

    // 處理播放列表重新排序
    function handlePlaylistReorder(evt) {
        const playerState = player.getState();
        const movedItem = playerState.playList.splice(evt.oldIndex, 1)[0];
        playerState.playList.splice(evt.newIndex, 0, movedItem);
        
        // 通知同步模組
        if (window.BCEnhancedMedia.Sync) {
            window.BCEnhancedMedia.Sync.updateSyncTime();
            window.BCEnhancedMedia.Sync.sendSyncList();
        }
        
        renderPlaylist();
    }

    // 檢查修改權限
    function hasModifyPermission() {
        return ChatRoomPlayerIsAdmin && ChatRoomPlayerIsAdmin();
    }

    // 公開API
    return {
        initialize,
        renderPlaylist,
        showAddMediaDialog,
        showImportDialog,
        addPlaylistItem,
        removePlaylistItem,
        setPlaylist,
        
        // 工具函數
        createDialog,
        closeDialog
    };
