// ==UserScript==
// @name         Liko - CPB
// @name:zh      Liko的自定義個人資料頁面背景
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  自定義個人資料頁面背景 | Custom Profile Background
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let modApi = null;
    const modversion = "1.0";
    let customBG = null;
    let buttonImage = null;
    let isInitialized = false;
    let remoteBackgrounds = new Map(); // 存儲其他玩家的背景
    let cacheAccessOrder = []; // LRU 快取順序追蹤
    let isUIOpen = false;
    let uiElements = {};
    let lastButtonState = false; // 追蹤按鈕顯示狀態
    let interfaceCheckInterval = null;
    let currentViewingCharacter = null; // 當前正在查看的角色

    // 效能優化快取
    let cachedViewingCharacter = null;
    let lastCharacterCheck = 0;
    let lastScreenCheck = null;
    let lastScreenCheckTime = 0;
    let pendingBlobUrls = new Set(); // 追蹤待清理的 Blob URLs

    // 配置
    const DEFAULT_BG_URL = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg";
    const BUTTON_X = 1695;
    const BUTTON_Y = 190;
    const BUTTON_SIZE = 90;
    const BUTTON_IMAGE_URL = "https://www.bondageprojects.elementfx.com/R120/BondageClub/Icons/Extensions.png";
    const MAX_CACHE_SIZE = 15; // 限制遠程背景快取大小
    const CHARACTER_CACHE_TIME = 50; // 角色快取時間 (ms)
    const SCREEN_CACHE_TIME = 100; // 屏幕檢查快取時間 (ms)

    // 資源清理函數
    function cleanupBlobUrl(url) {
        if (url && url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(url);
                pendingBlobUrls.delete(url);
            } catch (e) {
                console.warn("[CPB] 清理 Blob URL 失敗:", e.message);
            }
        }
    }

    // LRU 快取清理
    function cleanupImageCache() {
        while (remoteBackgrounds.size > MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
            const oldestKey = cacheAccessOrder.shift();
            const oldImage = remoteBackgrounds.get(oldestKey);

            // 清理 Blob URL
            if (oldImage && oldImage.src) {
                cleanupBlobUrl(oldImage.src);
            }

            remoteBackgrounds.delete(oldestKey);
        }
    }

    // 更新快取訪問順序
    function updateCacheAccess(key) {
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) {
            cacheAccessOrder.splice(index, 1);
        }
        cacheAccessOrder.push(key);
    }

    // 開始界面檢測（增強錯誤處理）
    function startInterfaceMonitoring() {
        if (interfaceCheckInterval) {
            clearInterval(interfaceCheckInterval);
        }

        interfaceCheckInterval = setInterval(() => {
            try {
                const currentButtonState = shouldShowButton();
                if (currentButtonState !== lastButtonState) {
                    lastButtonState = currentButtonState;

                    // 如果按鈕應該隱藏且UI是開啟的，關閉UI
                    if (!currentButtonState && isUIOpen) {
                        closeUI();
                    }
                }
            } catch (e) {
                console.error("[CPB] 界面監控錯誤:", e.message);
                // 出錯時停止監控避免持續錯誤
                stopInterfaceMonitoring();
            }
        }, 3000);
    }

    // 停止界面檢測
    function stopInterfaceMonitoring() {
        if (interfaceCheckInterval) {
            clearInterval(interfaceCheckInterval);
            interfaceCheckInterval = null;
        }
    }

    // 獲取當前查看的角色（優化效能）
    function getCurrentViewingCharacter() {
        const now = Date.now();

        // 快取檢查，減少重複計算
        if (now - lastCharacterCheck < CHARACTER_CACHE_TIME && cachedViewingCharacter !== null) {
            return cachedViewingCharacter;
        }

        try {
            let character = null;

            // 方法1: 使用 InformationSheetCharacter (最直接的方法)
            if (typeof InformationSheetCharacter !== 'undefined' && InformationSheetCharacter) {
                character = InformationSheetCharacter;
            }
            // 方法2: 檢查 InformationSheetSelection 是否就是角色對象
            else if (typeof InformationSheetSelection !== 'undefined' && InformationSheetSelection !== null && typeof InformationSheetSelection === 'object') {
                // 如果 InformationSheetSelection 本身就是一個角色對象
                if (InformationSheetSelection.Name && (InformationSheetSelection.MemberNumber || InformationSheetSelection.ID)) {
                    character = InformationSheetSelection;
                }
                // 如果有 ID 屬性，嘗試在 ChatRoomCharacter 中查找
                else if (InformationSheetSelection.ID && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.ID === InformationSheetSelection.ID);
                }
                // 如果有 MemberNumber 屬性，嘗試在 ChatRoomCharacter 中查找
                else if (InformationSheetSelection.MemberNumber && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection.MemberNumber);
                }
            }
            // 方法3: 如果 InformationSheetSelection 是數字，當作 MemberNumber 處理
            else if (typeof InformationSheetSelection !== 'undefined' && typeof InformationSheetSelection === 'number') {
                if (CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
                    character = ChatRoomCharacter.find(c => c.MemberNumber === InformationSheetSelection);
                }
            }

            // 默認返回 Player
            if (!character) {
                character = Player;
            }

            // 更新快取
            cachedViewingCharacter = character;
            lastCharacterCheck = now;

            return character;
        } catch (e) {
            console.error("[CPB] 獲取當前查看角色失敗:", e.message);
            return Player;
        }
    }

    // 獲取設置 - 修改為支持遠程背景
    function getSettings() {
        try {
            // 共享設置 - 其他玩家可見
            if (!Player?.OnlineSharedSettings?.CustomProfileBG) {
                Player.OnlineSharedSettings.CustomProfileBG = {
                    enabled: true,
                    imageUrl: DEFAULT_BG_URL,
                    lastUpdated: Date.now()
                };
            }

            // 私有設置 - 僅自己可見
            if (!Player?.OnlineSettings?.CustomProfileBG) {
                Player.OnlineSettings.CustomProfileBG = {
                    showRemoteBackground: true
                };
            }

            return {
                ...Player.OnlineSharedSettings.CustomProfileBG,
                showRemoteBackground: Player.OnlineSettings.CustomProfileBG.showRemoteBackground
            };
        } catch (e) {
            console.error("[CPB] 獲取設置失敗:", e.message);
            return {
                enabled: true,
                imageUrl: DEFAULT_BG_URL,
                showRemoteBackground: true,
                lastUpdated: Date.now()
            };
        }
    }

    // 保存設置 - 修改為分別保存共享和私有設置
    function saveSettings(settings) {
        try {
            if (!Player?.OnlineSharedSettings || !Player?.OnlineSettings) return;

            // 分離共享和私有設置
            const { showRemoteBackground, ...sharedSettings } = settings;

            // 保存共享設置
            Player.OnlineSharedSettings.CustomProfileBG = {
                ...sharedSettings,
                lastUpdated: Date.now()
            };

            // 保存私有設置
            Player.OnlineSettings.CustomProfileBG = {
                showRemoteBackground: showRemoteBackground !== false
            };

            // 強制上傳共享設置
            if (typeof ServerAccountUpdate?.QueueData === 'function') {
                ServerAccountUpdate.QueueData({
                    OnlineSharedSettings: Player.OnlineSharedSettings
                });
            }

            // 觸發設置同步
            if (typeof ServerPlayerExtensionSettingsSync === 'function') {
                ServerPlayerExtensionSettingsSync("CustomProfileBG");
            }

            console.log("[CPB] 設置已保存:", settings);
        } catch (e) {
            console.error("[CPB] 保存設置失敗:", e.message);
        }
    }

    // 獲取其他玩家的自定義背景
    function getPlayerCustomBackground(character) {
        if (!character || !character.OnlineSharedSettings) {
            return null;
        }

        const bgSettings = character.OnlineSharedSettings.CustomProfileBG;
        if (!bgSettings || !bgSettings.enabled || !bgSettings.imageUrl) {
            return null;
        }

        return bgSettings.imageUrl;
    }

    // 異步載入遠程背景（增強記憶體管理）
    async function loadRemoteBackground(imageUrl) {
        if (remoteBackgrounds.has(imageUrl)) {
            updateCacheAccess(imageUrl);
            return;
        }

        try {
            const img = await loadImage(imageUrl, true); // 遠程背景需要持久化

            // 清理舊快取
            cleanupImageCache();

            // 添加到快取
            remoteBackgrounds.set(imageUrl, img);
            updateCacheAccess(imageUrl);

            // 載入完成後立即觸發重新繪製
            if (CurrentScreen === "InformationSheet") {
                setTimeout(() => {
                    if (typeof InformationSheetRun === 'function') {
                        InformationSheetRun();
                    }
                }, 50);
            }
        } catch (error) {
            console.error("[CPB] 遠程背景載入失敗:", imageUrl, error.message);
        }
    }

    // URL 安全檢查
    function isValidImageUrl(url) {
        try {
            const parsedUrl = new URL(url);

            // 檢查協議
            if (parsedUrl.protocol !== 'https:') {
                return { valid: false, error: "必須使用 HTTPS 協議" };
            }

            // 檢查圖片格式
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const hasValidExtension = validExtensions.some(ext =>
                parsedUrl.pathname.toLowerCase().includes(ext)
            );

            if (!hasValidExtension) {
                return { valid: false, error: "不支援的圖片格式，請使用 jpg、png、gif 或 webp" };
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, error: "無效的網址格式" };
        }
    }

    // 檢查是否為個人資料頁面（快取優化）
    function isProfilePage() {
        const now = Date.now();

        // 快取屏幕檢查結果
        if (now - lastScreenCheckTime < SCREEN_CACHE_TIME && lastScreenCheck !== null) {
            return lastScreenCheck;
        }

        const result = CurrentScreen === "InformationSheet" &&
            window.bcx?.inBcxSubscreen() !== true &&
            window.LITTLISH_CLUB?.inModSubscreen() !== true &&
            window.MPA?.menuLoaded !== true &&
            window.LSCG_REMOTE_WINDOW_OPEN !== true;

        lastScreenCheck = result;
        lastScreenCheckTime = now;
        return result;
    }

    // 檢查是否應該顯示按鈕 - 只在查看自己的 profile 時顯示
    function shouldShowButton() {
        if (!isProfilePage()) return false;

        // 獲取當前查看的角色
        const viewingCharacter = getCurrentViewingCharacter();

        // 只有在查看自己的 profile 時才顯示按鈕
        return viewingCharacter && viewingCharacter.MemberNumber === Player.MemberNumber;
    }

    // 檢查是否應該替換背景
    function shouldReplaceBackground() {
        return isProfilePage();
    }

    // 載入圖片（修正記憶體洩漏）
    async function loadImage(url, isPersistent = false) {
        try {
            const validation = isValidImageUrl(url);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`無法載入圖片: ${response.status}`);

            const blob = await response.blob();

            // 檢查檔案大小 (最大 10MB)
            if (blob.size > 10 * 1024 * 1024) {
                throw new Error("圖片檔案過大，請使用小於 10MB 的圖片");
            }

            return new Promise((resolve, reject) => {
                const img = new Image();
                const blobUrl = URL.createObjectURL(blob);

                // 追蹤這個 Blob URL
                pendingBlobUrls.add(blobUrl);

                img.onload = () => {
                    // 如果不是持久化圖片（如按鈕圖標），載入後立即清理 Blob URL
                    if (!isPersistent) {
                        cleanupBlobUrl(blobUrl);
                    }
                    resolve(img);
                };

                img.onerror = () => {
                    // 錯誤時總是清理 Blob URL
                    cleanupBlobUrl(blobUrl);
                    console.error("[CPB] 圖片載入失敗:", url);
                    reject(new Error("圖片載入失敗"));
                };

                img.src = blobUrl;
            });
        } catch (error) {
            console.error("[CPB] 載入圖片時發生錯誤:", error.message);
            throw error;
        }
    }

    // 創建 UI 樣式
    function createUIStyles() {
        // 避免重複創建樣式
        if (document.querySelector('#cpbg-styles')) return;

        const style = document.createElement('style');
        style.id = 'cpbg-styles';
        style.textContent = `
            .cpbg-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: cpbg-fadeIn 0.3s ease-out;
            }

            .cpbg-dialog {
                background: linear-gradient(135deg, #6027DD 0%, #4A1B6B 100%);
                border: 2px solid #7C3AED;
                border-radius: 15px;
                box-shadow: 0 0 30px rgba(96, 39, 221, 0.5);
                padding: 25px;
                width: 500px;
                max-width: 90vw;
                animation: cpbg-slideIn 0.3s ease-out;
                position: relative;
                backdrop-filter: blur(10px);
            }

            .cpbg-title {
                color: #F3F0FF;
                font-size: 24px;
                font-weight: bold;
                text-align: center;
                margin-bottom: 20px;
                text-shadow: 0 0 10px rgba(96, 39, 221, 0.8);
            }

            .cpbg-section {
                margin-bottom: 20px;
            }

            .cpbg-label {
                color: #E5DEFF;
                font-size: 16px;
                margin-bottom: 8px;
                display: block;
                font-weight: 500;
            }

            .cpbg-input {
                width: 100%;
                padding: 12px;
                border: 2px solid #4C1D95;
                border-radius: 8px;
                background: rgba(96, 39, 221, 0.1);
                color: #F3F0FF;
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.3s ease;
            }

            .cpbg-input:focus {
                outline: none;
                border-color: #7C3AED;
                box-shadow: 0 0 15px rgba(96, 39, 221, 0.3);
                background: rgba(255, 255, 255, 0.9);
                color: #333;
            }

            .cpbg-checkbox-container {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 10px 0;
            }

            .cpbg-checkbox {
                width: 20px;
                height: 20px;
                accent-color: #6027DD;
            }

            .cpbg-preview {
                width: 100%;
                border: 2px solid #4C1D95;
                border-radius: 8px;
                background-size: cover;
                background-position: center;
                background-repeat: no-repeat;
                background-color: rgba(96, 39, 221, 0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #C4B5FD;
                font-size: 14px;
                text-align: center;
                transition: all 0.3s ease;
                aspect-ratio: 2 / 1;
            }

            .cpbg-preview.loading {
                background: linear-gradient(45deg, rgba(96, 39, 221, 0.1) 25%, transparent 25%, transparent 75%, rgba(96, 39, 221, 0.1) 75%);
                background-size: 20px 20px;
                animation: cpbg-loading 1s linear infinite;
            }

            .cpbg-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 25px;
            }

            .cpbg-button {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .cpbg-button.primary {
                background: linear-gradient(135deg, #6027DD 0%, #4C1D95 100%);
                color: white;
                box-shadow: 0 4px 15px rgba(96, 39, 221, 0.3);
            }

            .cpbg-button.primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(96, 39, 221, 0.4);
            }

            .cpbg-button.secondary {
                background: rgba(96, 39, 221, 0.2);
                color: #E5DEFF;
                border: 2px solid #4C1D95;
            }

            .cpbg-button.secondary:hover {
                background: rgba(96, 39, 221, 0.3);
                border-color: #7C3AED;
            }

            .cpbg-error {
                color: #FCA5A5;
                font-size: 14px;
                margin-top: 5px;
                text-align: center;
            }

            .cpbg-info {
                color: #A5F3FC;
                font-size: 12px;
                margin-top: 5px;
                text-align: center;
            }

            .cpbg-close {
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                color: #E5DEFF;
                font-size: 24px;
                cursor: pointer;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.3s ease;
            }

            .cpbg-close:hover {
                background: rgba(239, 68, 68, 0.2);
                color: #FCA5A5;
            }

            @keyframes cpbg-fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes cpbg-slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes cpbg-loading {
                0% { background-position: 0 0; }
                100% { background-position: 20px 20px; }
            }
        `;
        document.head.appendChild(style);
    }

    // 創建 UI - 修改為包含遠程背景設置（增強清理）
    function createUI() {
        const settings = getSettings();

        const modal = document.createElement('div');
        modal.className = 'cpbg-modal';
        modal.innerHTML = `
            <div class="cpbg-dialog">
                <div class="cpbg-title">🎨 自訂個人資料背景</div>

                <div class="cpbg-section">
                    <label class="cpbg-label">背景圖片網址 (HTTPS)</label>
                    <input type="text" class="cpbg-input" id="cpbg-url-input"
                           placeholder="https://example.com/image.jpg"
                           value="${settings.imageUrl || ''}">
                    <div class="cpbg-info">建議尺寸: 2000x1000 像素 (2:1比例)</div>
                    <div class="cpbg-info">檔案大小限制: 10MB</div>
                    <div class="cpbg-error" id="cpbg-url-error"></div>
                </div>

                <div class="cpbg-section">
                    <div class="cpbg-preview" id="cpbg-preview">
                        點擊預覽按鈕載入圖片
                    </div>
                </div>

                <div class="cpbg-section">
                    <div class="cpbg-checkbox-container">
                        <input type="checkbox" class="cpbg-checkbox" id="cpbg-enabled"
                               ${settings.enabled ? 'checked' : ''}>
                        <label class="cpbg-label" for="cpbg-enabled">啟用自訂背景</label>
                    </div>

                    <div class="cpbg-checkbox-container">
                        <input type="checkbox" class="cpbg-checkbox" id="cpbg-show-remote"
                               ${settings.showRemoteBackground ? 'checked' : ''}>
                        <label class="cpbg-label" for="cpbg-show-remote">顯示其他玩家的自訂背景</label>
                    </div>
                </div>

                <div class="cpbg-buttons">
                    <button class="cpbg-button secondary" id="cpbg-preview-btn">預覽</button>
                    <button class="cpbg-button secondary" id="cpbg-save-btn">保存設置</button>
                    <button class="cpbg-button secondary" id="cpbg-cancel-btn">取消</button>
                </div>
            </div>
        `;

        // 事件處理器函數（避免記憶體洩漏）
        const handleCancel = () => closeUI();
        const handleModalClick = (e) => {
            if (e.target === modal) closeUI();
        };

        // 預覽功能
        const handlePreview = async () => {
            const urlInput = modal.querySelector('#cpbg-url-input');
            const preview = modal.querySelector('#cpbg-preview');
            const errorDiv = modal.querySelector('#cpbg-url-error');

            const url = urlInput.value.trim();
            if (!url) {
                showError(errorDiv, "請輸入圖片網址");
                return;
            }

            const validation = isValidImageUrl(url);
            if (!validation.valid) {
                showError(errorDiv, validation.error);
                return;
            }

            preview.className = 'cpbg-preview loading';
            preview.textContent = '載入中...';
            errorDiv.textContent = '';

            try {
                const img = await loadImage(url, false); // 預覽圖片不需要持久化
                preview.style.backgroundImage = `url(${img.src})`;
                preview.textContent = '';
                preview.className = 'cpbg-preview';
            } catch (error) {
                showError(errorDiv, error.message);
                preview.className = 'cpbg-preview';
                preview.textContent = '預覽失敗';
                preview.style.backgroundImage = '';
            }
        };

        // 保存設置
        const handleSave = async () => {
            const urlInput = modal.querySelector('#cpbg-url-input');
            const errorDiv = modal.querySelector('#cpbg-url-error');

            const url = urlInput.value.trim();
            const enabled = modal.querySelector('#cpbg-enabled').checked;
            const showRemote = modal.querySelector('#cpbg-show-remote').checked;

            if (enabled && url) {
                const validation = isValidImageUrl(url);
                if (!validation.valid) {
                    showError(errorDiv, validation.error);
                    return;
                }

                try {
                    // 嘗試載入圖片驗證
                    customBG = await loadImage(url, true); // 用於實際使用的背景需要持久化
                } catch (error) {
                    showError(errorDiv, error.message);
                    return;
                }
            }

            const newSettings = {
                enabled,
                imageUrl: url,
                showRemoteBackground: showRemote
            };

            saveSettings(newSettings);
            closeUI();
        };

        // 添加事件監聽器
        const cancelBtn = modal.querySelector('#cpbg-cancel-btn');
        const saveBtn = modal.querySelector('#cpbg-save-btn');
        const previewBtn = modal.querySelector('#cpbg-preview-btn');

        cancelBtn.addEventListener('click', handleCancel);
        saveBtn.addEventListener('click', handleSave);
        previewBtn.addEventListener('click', handlePreview);
        modal.addEventListener('click', handleModalClick);

        // 儲存事件處理器引用以便清理
        uiElements.modal = modal;
        uiElements.eventHandlers = {
            handleCancel,
            handleModalClick,
            handlePreview,
            handleSave
        };

        document.body.appendChild(modal);
    }

    // 顯示錯誤
    function showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
        }
    }

    // 打開 UI
    function openUI() {
        if (isUIOpen) return;

        if (!uiElements.modal) {
            createUIStyles();
            createUI();
        }

        isUIOpen = true;
        uiElements.modal.style.display = 'flex';
    }

    // 關閉 UI（增強清理）
    function closeUI() {
        if (!isUIOpen) return;

        isUIOpen = false;
        if (uiElements.modal) {
            // 移除事件監聽器
            if (uiElements.eventHandlers) {
                const modal = uiElements.modal;
                const cancelBtn = modal.querySelector('#cpbg-cancel-btn');
                const saveBtn = modal.querySelector('#cpbg-save-btn');
                const previewBtn = modal.querySelector('#cpbg-preview-btn');

                if (cancelBtn) cancelBtn.removeEventListener('click', uiElements.eventHandlers.handleCancel);
                if (saveBtn) saveBtn.removeEventListener('click', uiElements.eventHandlers.handleSave);
                if (previewBtn) previewBtn.removeEventListener('click', uiElements.eventHandlers.handlePreview);
                modal.removeEventListener('click', uiElements.eventHandlers.handleModalClick);
            }

            uiElements.modal.style.display = 'none';
        }
    }

    // Hook drawImage 替換背景（優化效能）
    function setupDrawImageHook() {
        const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

        CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
            try {
                // 快速檢查是否需要處理
                if (img && img.src && img.src.includes("Backgrounds/Sheet.jpg")) {
                    const shouldReplace = shouldReplaceBackground();

                    if (shouldReplace) {
                        const settings = getSettings();
                        const viewingCharacter = getCurrentViewingCharacter();

                        // 確定要使用的背景
                        let targetBG = null;

                        // 如果查看其他玩家且啟用了遠程背景顯示
                        if (viewingCharacter &&
                            viewingCharacter.MemberNumber !== Player.MemberNumber &&
                            settings.showRemoteBackground) {

                            const remoteImageUrl = getPlayerCustomBackground(viewingCharacter);

                            if (remoteImageUrl) {
                                if (remoteBackgrounds.has(remoteImageUrl)) {
                                    targetBG = remoteBackgrounds.get(remoteImageUrl);
                                    updateCacheAccess(remoteImageUrl);
                                } else {
                                    // 異步載入遠程背景
                                    loadRemoteBackground(remoteImageUrl).then(() => {
                                        if (CurrentScreen === "InformationSheet") {
                                            setTimeout(() => {
                                                if (typeof InformationSheetRun === 'function') {
                                                    InformationSheetRun();
                                                }
                                            }, 100);
                                        }
                                    });

                                    // 載入期間使用自己的背景作為後備
                                    if (settings.enabled && customBG) {
                                        targetBG = customBG;
                                    }
                                }
                            }
                        }

                        // 如果沒有遠程背景，使用自己的背景
                        if (!targetBG && settings.enabled && customBG) {
                            targetBG = customBG;
                        }

                        // 應用背景
                        if (targetBG) {
                            const canvas = this.canvas;
                            if (canvas) {
                                originalDrawImage.call(this, targetBG, 0, 0, targetBG.width, targetBG.height, 0, 0, canvas.width, canvas.height);
                                return;
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("[CPB] drawImage 處理失敗:", e.message);
            }
            return originalDrawImage.call(this, img, ...args);
        };
    }

    // 繪製按鈕
    function drawButton() {
        const shouldShow = shouldShowButton();

        if (!shouldShow || !buttonImage) return;

        try {
            DrawButton(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE, "", "White", "", "自訂背景設置");

            // 確保 buttonImage.src 存在且有效
            if (buttonImage.src && buttonImage.complete) {
                DrawImage(buttonImage.src, BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE);
            } else {
                console.warn("[CPB] 按鈕圖片未載入完成或無效");
            }
        } catch (e) {
            console.error("[CPB] 按鈕繪製失敗:", e.message);
        }
    }

    // 處理按鈕點擊
    function handleClick() {
        if (!shouldShowButton()) return false;
        if (MouseIn(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE)) {
            openUI();
            return true;
        }
        return false;
    }

    // 等待 bcModSdk 載入
    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[CPB] bcModSdk 載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 初始化 modApi
    async function initializeModApi() {
        const success = await waitForBcModSdk();
        if (!success) return null;

        try {
            modApi = bcModSdk.registerMod({
                name: "liko's CPB",
                fullName: "liko's Custom Profile Background",
                version: modversion,
                repository: '自訂個人資料頁面背景 | Custom Profile Background'
            });
            console.log("[CPB] ✅ 模組註冊成功");
            return modApi;
        } catch (e) {
            console.error("[CPB] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }

    // 等待遊戲載入
    function waitForGame(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof CurrentScreen !== 'undefined' &&
                    typeof DrawImage === 'function' &&
                    typeof DrawButton === 'function' &&
                    typeof MouseIn === 'function' &&
                    typeof Player !== 'undefined' &&
                    Player?.OnlineSettings &&
                    Player?.OnlineSharedSettings) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("[CPB] 遊戲載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 設置 ModSDK Hooks（增強錯誤處理）
    function setupHooks() {
        if (!modApi || typeof modApi.hookFunction !== 'function') {
            console.error("[CPB] modApi 未正確初始化，無法設置 hooks");
            return;
        }

        modApi.hookFunction("InformationSheetRun", 10, (args, next) => {
            try {
                const result = next(args);

                // 更新當前查看的角色
                currentViewingCharacter = getCurrentViewingCharacter();
                drawButton();

                // 確保監控正在運行
                if (!interfaceCheckInterval) {
                    startInterfaceMonitoring();
                }

                return result;
            } catch (e) {
                console.error("[CPB] InformationSheetRun 處理失敗:", e.message);
                return next(args);
            }
        });

        // 添加對 InformationSheetLoad 的 hook 來確保獲取最新角色資料
        modApi.hookFunction("InformationSheetLoad", 5, (args, next) => {
            try {
                const result = next(args);

                // 在載入後重新獲取當前查看的角色
                setTimeout(() => {
                    currentViewingCharacter = getCurrentViewingCharacter();
                    // 清理快取以確保獲取最新狀態
                    cachedViewingCharacter = null;
                    lastCharacterCheck = 0;
                }, 100);

                return result;
            } catch (e) {
                console.error("[CPB] InformationSheetLoad 處理失敗:", e.message);
                return next(args);
            }
        });

        modApi.hookFunction("InformationSheetClick", 10, (args, next) => {
            try {
                if (handleClick()) {
                    return;
                }
                return next(args);
            } catch (e) {
                console.error("[CPB] InformationSheetClick 處理失敗:", e.message);
                return next(args);
            }
        });

        // Hook Exit function to stop monitoring when leaving
        modApi.hookFunction("InformationSheetExit", 5, (args, next) => {
            try {
                stopInterfaceMonitoring();
                currentViewingCharacter = null;
                // 清理快取
                cachedViewingCharacter = null;
                lastCharacterCheck = 0;
                lastScreenCheck = null;
                lastScreenCheckTime = 0;

                if (isUIOpen) {
                    closeUI();
                }
                return next(args);
            } catch (e) {
                console.error("[CPB] InformationSheetExit 處理失敗:", e.message);
                return next(args);
            }
        });

        console.log("[CPB] ModSDK hooks 設置完成");
    }

    // 完整資源清理函數
    function cleanup() {
        console.log("[CPB] 開始資源清理...");

        try {
            // 停止定時器
            stopInterfaceMonitoring();

            // 清理 UI
            closeUI();

            // 清理所有 UI 元素
            if (uiElements.modal) {
                uiElements.modal.remove();
                uiElements.modal = null;
            }
            uiElements.eventHandlers = null;

            // 清理樣式
            const styleElement = document.querySelector('#cpbg-styles');
            if (styleElement) {
                styleElement.remove();
            }

            // 清理圖片快取和 Blob URLs
            for (const [key, img] of remoteBackgrounds) {
                if (img && img.src) {
                    cleanupBlobUrl(img.src);
                }
            }
            remoteBackgrounds.clear();
            cacheAccessOrder = [];

            // 清理待處理的 Blob URLs
            for (const blobUrl of pendingBlobUrls) {
                cleanupBlobUrl(blobUrl);
            }
            pendingBlobUrls.clear();

            // 清理主要圖片資源
            if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
                cleanupBlobUrl(customBG.src);
            }
            if (buttonImage && buttonImage.src && buttonImage.src.startsWith('blob:')) {
                cleanupBlobUrl(buttonImage.src);
            }

            customBG = null;
            buttonImage = null;

            // 清理快取變量
            currentViewingCharacter = null;
            cachedViewingCharacter = null;
            lastCharacterCheck = 0;
            lastScreenCheck = null;
            lastScreenCheckTime = 0;

            // 重置狀態
            isInitialized = false;
            isUIOpen = false;
            lastButtonState = false;

            console.log("[CPB] ✅ 資源清理完成");
        } catch (e) {
            console.error("[CPB] 清理過程中出錯:", e.message);
        }
    }

    // 主初始化函數
    async function initialize() {
        if (isInitialized) return;

        console.log("[CPB] 開始初始化...");

        try {
            // 初始化 modApi
            modApi = await initializeModApi();
            if (!modApi) {
                console.error("[CPB] modApi 初始化失敗，無法繼續");
                return;
            }

            // 等待遊戲載入
            const gameLoaded = await waitForGame();
            if (!gameLoaded) {
                console.error("[CPB] 遊戲載入失敗，無法繼續");
                return;
            }

            // 載入設置中的背景圖片
            const settings = getSettings();

            if (settings.enabled && settings.imageUrl) {
                try {
                    customBG = await loadImage(settings.imageUrl, true); // 使用持久化模式
                } catch (error) {
                    console.warn("[CPB] 載入保存的背景失敗:", error.message);
                    // 如果載入失敗，嘗試載入默認背景
                    try {
                        customBG = await loadImage(DEFAULT_BG_URL, true); // 使用持久化模式
                        // 更新設置為默認URL
                        const newSettings = { ...settings, imageUrl: DEFAULT_BG_URL };
                        saveSettings(newSettings);
                    } catch (defaultError) {
                        console.error("[CPB] 默認背景載入也失敗:", defaultError.message);
                    }
                }
            } else if (!settings.imageUrl) {
                // 如果沒有設置圖片URL，載入默認背景
                try {
                    customBG = await loadImage(DEFAULT_BG_URL, true); // 使用持久化模式
                    // 更新設置為默認URL
                    const newSettings = { ...settings, imageUrl: DEFAULT_BG_URL };
                    saveSettings(newSettings);
                } catch (error) {
                    console.error("[CPB] 載入默認背景失敗:", error.message);
                }
            }

            // 載入按鈕圖標（持久化圖片）
            try {
                buttonImage = await loadImage(BUTTON_IMAGE_URL, true); // 使用持久化模式
            } catch (error) {
                console.warn("[CPB] 載入按鈕圖標失敗，嘗試直接使用原始 URL:", error.message);
                // 備用方案：直接使用原始 URL
                try {
                    buttonImage = new Image();
                    buttonImage.src = BUTTON_IMAGE_URL;
                    await new Promise((resolve, reject) => {
                        buttonImage.onload = resolve;
                        buttonImage.onerror = reject;
                    });
                } catch (backupError) {
                    console.error("[CPB] 按鈕圖標備用載入也失敗:", backupError.message);
                    buttonImage = null;
                }
            }

            // 設置 hooks
            setupDrawImageHook();
            setupHooks();

            // 設置卸載處理
            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("[CPB] 模組卸載中...");
                    cleanup();
                });
            }

            // 設置頁面卸載處理
            window.addEventListener('beforeunload', cleanup);

            // 啟動界面監控
            startInterfaceMonitoring();

            isInitialized = true;
            console.log("[CPB] ✅ 初始化完成");
        } catch (e) {
            console.error("[CPB] 初始化失敗:", e.message);
            // 初始化失敗時也要清理
            cleanup();
        }
    }

    // 啟動腳本
    initialize();
})();
