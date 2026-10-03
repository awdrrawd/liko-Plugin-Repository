// ==UserScript==
// @name         Liko - CPB
// @name:zh      Liko的自定義個人資料頁面背景
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.2.3
// @description  自定義個人資料頁面背景 | Custom Profile Background
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CPB.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CPB.main.user.js
// ==/UserScript==

(function() {
    window.Liko = window.Liko ?? {};
    if (window.Liko.CPB) return;
    const MOD_VER = "1.2.3";
    window.Liko.CPB = MOD_VER;

    let modApi = null;
    let disposed = false;
    let uiRequest = 0;
    let previewImage = null;
    const imageControllers = new Set();
    let customBG = null;
    let buttonImage = null;
    let isInitialized = false;
    let remoteBackgrounds = new Map();
    const pendingRemoteBackgrounds = new Set();
    const remoteBackgroundRetryAfter = new Map();
    let cacheAccessOrder = [];
    let isUIOpen = false;
    let uiElements = {};
    let lastButtonState = false;
    let interfaceCheckInterval = null;
    let currentViewingCharacter = null;

    let pendingBlobUrls = new Set();

    // ===== 圖片路徑輔助工具 =====
    const ImagePathHelper = {
        _cachedBasePath: null,

        getBasePath: function() {
            if (this._cachedBasePath) return this._cachedBasePath;

            let href = window.location.href;

            // 確保結尾有斜線
            if (!href.endsWith('/')) {
                href = href.substring(0, href.lastIndexOf('/') + 1);
            }

            this._cachedBasePath = href;
            return href;
        },

        getAssetURL: function(path) {
            return this.getBasePath() + 'Assets/' + path;
        },

        getIconURL: function(iconName) {
            return this.getBasePath() + 'Icons/' + iconName;
        },

        clearCache: function() {
            this._cachedBasePath = null;
        }
    };

    // 配置
    const DEFAULT_BG_URL = "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/Leonardo_Anime_XL_anime_style_outdoor_magical_wedding_backgrou_2.jpg";
    const BUTTON_X = 1695;
    const BUTTON_Y = 190;
    const BUTTON_SIZE = 90;
    const MAX_CACHE_SIZE = 15;

    function getButtonImageURL() {
        return ImagePathHelper.getIconURL('Extensions.png');
    }

    function cleanupBlobUrl(url) {
        if (url && url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(url);
                pendingBlobUrls.delete(url);
            } catch (e) {
                console.warn("🐈‍⬛ [CPB] ❌ 清理 Blob URL 失敗:", e.message);
            }
        }
    }

    function cleanupImageCache() {
        while (remoteBackgrounds.size > MAX_CACHE_SIZE && cacheAccessOrder.length > 0) {
            const oldestKey = cacheAccessOrder.shift();
            const oldImage = remoteBackgrounds.get(oldestKey);

            if (oldImage && oldImage.src) {
                cleanupBlobUrl(oldImage.src);
            }

            remoteBackgrounds.delete(oldestKey);
        }
    }

    function updateCacheAccess(key) {
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) {
            cacheAccessOrder.splice(index, 1);
        }
        cacheAccessOrder.push(key);
    }

    function startInterfaceMonitoring() {
        if (interfaceCheckInterval) {
            clearInterval(interfaceCheckInterval);
        }

        interfaceCheckInterval = setInterval(() => {
            try {
                const currentButtonState = shouldShowButton();
                if (currentButtonState !== lastButtonState) {
                    lastButtonState = currentButtonState;

                    if (!currentButtonState && isUIOpen) {
                        closeUI();
                    }
                }
            } catch (e) {
                console.error("🐈‍⬛ [CPB] ❌ 界面監控錯誤:", e.message);
                stopInterfaceMonitoring();
            }
        }, 3000);
    }

    function stopInterfaceMonitoring() {
        if (interfaceCheckInterval) {
            clearInterval(interfaceCheckInterval);
            interfaceCheckInterval = null;
        }
    }

    function getCurrentViewingCharacter() {
        return typeof InformationSheetSelection === "object" ? InformationSheetSelection : null;
    }

    // Reading defaults never changes or uploads account data.
    function getSettings() {
        const shared = Player.OnlineSharedSettings?.CustomProfileBG;
        const privateSettings = Player.ExtensionSettings?.CustomProfileBG;
        return {
            enabled: shared?.enabled !== false,
            imageUrl: typeof shared?.imageUrl === "string" ? shared.imageUrl : DEFAULT_BG_URL,
            showRemoteBackground: privateSettings?.showRemoteBackground !== false,
            lastUpdated: Number.isFinite(shared?.lastUpdated) ? shared.lastUpdated : 0
        };
    }

    function saveSettings(settings) {
        if (disposed || !Player.OnlineSharedSettings || !Player.ExtensionSettings ||
            typeof ServerAccountUpdate === "undefined" || typeof ServerAccountUpdate.QueueData !== "function" ||
            typeof ServerPlayerExtensionSettingsSync !== "function") {
            throw new Error("帳號同步尚未就緒，請稍後再試");
        }
        Player.OnlineSharedSettings.CustomProfileBG = {
            enabled: settings.enabled === true,
            imageUrl: settings.imageUrl,
            lastUpdated: Date.now()
        };
        Player.ExtensionSettings.CustomProfileBG = {
            ...Player.ExtensionSettings.CustomProfileBG,
            showRemoteBackground: settings.showRemoteBackground !== false
        };
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        ServerPlayerExtensionSettingsSync("CustomProfileBG");
    }

    function getPlayerCustomBackground(character) {
        if (!character || !character.OnlineSharedSettings) {
            return null;
        }

        const bgSettings = character.OnlineSharedSettings.CustomProfileBG;
        if (!bgSettings || !bgSettings.enabled || typeof bgSettings.imageUrl !== "string" || !bgSettings.imageUrl) {
            return null;
        }

        return bgSettings.imageUrl;
    }

    async function loadRemoteBackground(imageUrl) {
        if (disposed) return;
        if (remoteBackgrounds.has(imageUrl)) {
            updateCacheAccess(imageUrl);
            return;
        }

        if (pendingRemoteBackgrounds.has(imageUrl) ||
            Date.now() < (remoteBackgroundRetryAfter.get(imageUrl) || 0)) return;
        pendingRemoteBackgrounds.add(imageUrl);

        try {
            const img = await loadImage(imageUrl);

            if (disposed) { cleanupBlobUrl(img.src); return; }
            remoteBackgrounds.set(imageUrl, img);
            remoteBackgroundRetryAfter.delete(imageUrl);
            updateCacheAccess(imageUrl);

            cleanupImageCache();
            // BC draws continuously; the next frame uses the loaded image.

        } catch (error) {
            if (disposed) return;
            if (remoteBackgroundRetryAfter.size >= MAX_CACHE_SIZE) {
                remoteBackgroundRetryAfter.delete(remoteBackgroundRetryAfter.keys().next().value);
            }
            remoteBackgroundRetryAfter.set(imageUrl, Date.now() + 30000);
            console.error("🐈‍⬛ [CPB] ❌ 遠程背景載入失敗:", imageUrl, error.message);
        } finally {
            pendingRemoteBackgrounds.delete(imageUrl);
        }
    }

    function isValidImageUrl(url) {
        try {
            const parsedUrl = new URL(url);

            if (parsedUrl.protocol !== 'https:') {
                return { valid: false, error: "必須使用 HTTPS 協議" };
            }

            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const hasValidExtension = validExtensions.some(ext =>
                parsedUrl.pathname.toLowerCase().endsWith(ext)
            );

            if (!hasValidExtension) {
                return { valid: false, error: "不支援的圖片格式，請使用 jpg、png、gif 或 webp" };
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, error: "無效的網址格式" };
        }
    }

    function isProfilePage() {
        return !disposed && CurrentScreen === "InformationSheet" &&
            window.bcx?.inBcxSubscreen() !== true &&
            window.LITTLISH_CLUB?.inModSubscreen() !== true &&
            window.MPA?.menuLoaded !== true &&
            window.LSCG_REMOTE_WINDOW_OPEN !== true;
    }

    function shouldShowButton() {
        if (!isProfilePage()) return false;

        const viewingCharacter = getCurrentViewingCharacter();

        return viewingCharacter && viewingCharacter.MemberNumber === Player.MemberNumber;
    }

    function shouldReplaceBackground() {
        return isProfilePage();
    }

    async function loadImage(url) {
        if (disposed) throw new Error("CPB 已卸載");
        const parsed = new URL(url, window.location.href);
        if (parsed.origin !== window.location.origin) {
            const validation = isValidImageUrl(url);
            if (!validation.valid) throw new Error(validation.error);
        }
        const controller = new AbortController();
        imageControllers.add(controller);
        const timeout = setTimeout(() => controller.abort(), 15000);
        let blobUrl;
        try {
            const response = await fetch(parsed.href, { signal: controller.signal });
            if (!response.ok) throw new Error(`無法載入圖片: ${response.status}`);
            const blob = await response.blob();
            if (blob.size > 10 * 1024 * 1024) throw new Error("圖片檔案過大，請使用小於 10MB 的圖片");
            if (disposed || controller.signal.aborted) throw new Error("圖片載入已取消");
            blobUrl = URL.createObjectURL(blob);
            pendingBlobUrls.add(blobUrl);
            const img = new Image();
            await new Promise((resolve, reject) => {
                const finish = (error) => {
                    img.onload = img.onerror = null;
                    controller.signal.removeEventListener("abort", abort);
                    error ? reject(error) : resolve();
                };
                const abort = () => finish(new Error("圖片載入逾時或已取消"));
                controller.signal.addEventListener("abort", abort, { once: true });
                img.onload = () => finish();
                img.onerror = () => finish(new Error("圖片格式不支援或載入失敗"));
                img.src = blobUrl;
            });
            if (disposed) throw new Error("CPB 已卸載");
            return img;
        } catch (error) {
            cleanupBlobUrl(blobUrl);
            throw error;
        } finally {
            clearTimeout(timeout);
            imageControllers.delete(controller);
        }
    }

    function createUIStyles() {
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
                position: relative;
                overflow: hidden;
            }

            .cpbg-button::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                transition: width 0.3s, height 0.3s, top 0.3s, left 0.3s;
                transform: translate(-50%, -50%);
            }

            .cpbg-button.clicked::before {
                width: 300px;
                height: 300px;
                top: 50%;
                left: 50%;
                background: rgba(255, 255, 255, 0.1);
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

            .cpbg-button.primary:active {
                transform: translateY(0);
                box-shadow: 0 2px 10px rgba(96, 39, 221, 0.3);
            }

            .cpbg-button.secondary {
                background: rgba(96, 39, 221, 0.2);
                color: #E5DEFF;
                border: 2px solid #4C1D95;
            }

            .cpbg-button.secondary:hover {
                background: rgba(96, 39, 221, 0.3);
                border-color: #7C3AED;
                transform: translateY(-2px);
            }

            .cpbg-button.secondary:active {
                transform: translateY(0);
                background: rgba(96, 39, 221, 0.4);
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
                transform: scale(1.1);
            }

            .cpbg-close:active {
                transform: scale(0.95);
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

    function addButtonClickEffect(button) {
        button.addEventListener('click', function() {
            this.classList.add('clicked');
            setTimeout(() => {
                this.classList.remove('clicked');
            }, 300);
        });
    }

    function createUI() {
        const settings = getSettings();

        const modal = document.createElement('div');
        modal.className = 'cpbg-modal';
        modal.innerHTML = `
            <div class="cpbg-dialog">
                <button class="cpbg-close" type="button">×</button>
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
                    <button class="cpbg-button primary" id="cpbg-save-btn">保存設置</button>
                    <button class="cpbg-button secondary" id="cpbg-cancel-btn">取消</button>
                </div>
            </div>
        `;

        bindUIEvents(modal);

        uiElements.modal = modal;
        document.body.appendChild(modal);
    }

    function bindUIEvents(modal) {
        const closeBtn = modal.querySelector('.cpbg-close');
        const cancelBtn = modal.querySelector('#cpbg-cancel-btn');
        const saveBtn = modal.querySelector('#cpbg-save-btn');
        const previewBtn = modal.querySelector('#cpbg-preview-btn');

        const handleClose = () => closeUI();
        const handleModalClick = (e) => {
            if (e.target === modal) closeUI();
        };

        const handlePreview = async () => {
            const request = ++uiRequest;
            const url = modal.querySelector('#cpbg-url-input').value.trim();
            const preview = modal.querySelector('#cpbg-preview');
            const errorDiv = modal.querySelector('#cpbg-url-error');
            const validation = isValidImageUrl(url);
            if (!validation.valid) { showError(errorDiv, validation.error); return; }
            preview.className = 'cpbg-preview loading';
            preview.textContent = '載入中...';
            errorDiv.textContent = '';
            try {
                const image = await loadImage(url);
                if (request !== uiRequest || disposed || !isUIOpen) {
                    cleanupBlobUrl(image.src);
                    return;
                }
                cleanupBlobUrl(previewImage?.src);
                previewImage = image;
                preview.style.backgroundImage = `url("${image.src}")`;
                preview.textContent = '';
                preview.className = 'cpbg-preview';
            } catch (error) {
                if (request !== uiRequest || disposed || !isUIOpen) return;
                showError(errorDiv, error.message);
                preview.className = 'cpbg-preview';
                preview.textContent = '預覽失敗';
            }
        };

        const handleSave = async () => {
            const request = ++uiRequest;
            const errorDiv = modal.querySelector('#cpbg-url-error');
            const url = modal.querySelector('#cpbg-url-input').value.trim();
            const enabled = modal.querySelector('#cpbg-enabled').checked;
            const showRemoteBackground = modal.querySelector('#cpbg-show-remote').checked;
            let image = null;
            saveBtn.disabled = previewBtn.disabled = true;
            errorDiv.textContent = '';
            try {
                if (enabled && !url) throw new Error("啟用背景時請輸入圖片網址");
                if (url) {
                    const validation = isValidImageUrl(url);
                    if (!validation.valid) throw new Error(validation.error);
                }
                if (enabled) image = await loadImage(url);
                if (request !== uiRequest || disposed || !isUIOpen) {
                    cleanupBlobUrl(image?.src);
                    return;
                }
                saveSettings({ enabled, imageUrl: url, showRemoteBackground });
                cleanupBlobUrl(customBG?.src);
                customBG = image;
                closeUI();
            } catch (error) {
                cleanupBlobUrl(image?.src);
                if (request === uiRequest && !disposed && isUIOpen) showError(errorDiv, error.message);
            } finally {
                saveBtn.disabled = previewBtn.disabled = false;
            }
        };

        closeBtn.addEventListener('click', handleClose);
        cancelBtn.addEventListener('click', handleClose);
        saveBtn.addEventListener('click', handleSave);
        previewBtn.addEventListener('click', handlePreview);
        modal.addEventListener('click', handleModalClick);

        [closeBtn, cancelBtn, saveBtn, previewBtn].forEach(btn => {
            if (btn) addButtonClickEffect(btn);
        });

        uiElements.eventHandlers = {
            handleClose,
            handleModalClick,
            handlePreview,
            handleSave
        };
    }

    function showError(errorDiv, message) {
        if (errorDiv) {
            errorDiv.textContent = message;
        }
    }

    function openUI() {
        if (isUIOpen) return;

        if (uiElements.modal) {
            uiElements.modal.remove();
            uiElements.modal = null;
        }

        createUIStyles();
        createUI();

        isUIOpen = true;
        uiElements.modal.style.display = 'flex';
    }

    function closeUI() {
        if (!isUIOpen) return;

        isUIOpen = false;
        uiRequest++;
        cleanupBlobUrl(previewImage?.src);
        previewImage = null;
        if (uiElements.modal) {
            uiElements.modal.style.display = 'none';
        }
    }

    function getTargetBackground() {
        const settings = getSettings();
        const character = getCurrentViewingCharacter();
        if (character && character.MemberNumber !== Player.MemberNumber && settings.showRemoteBackground) {
            const url = getPlayerCustomBackground(character);
            if (url) {
                if (remoteBackgrounds.has(url)) {
                    updateCacheAccess(url);
                    return remoteBackgrounds.get(url);
                }
                void loadRemoteBackground(url);
            }
        }
        return settings.enabled ? customBG : null;
    }

    function drawButton() {
        const shouldShow = shouldShowButton();

        if (!shouldShow || !buttonImage) return;

        try {
            DrawButton(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE, "", "White", "", "自訂背景設置");

            if (buttonImage.src && buttonImage.complete) {
                DrawImage(buttonImage.src, BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE);
            } else {
                console.warn("🐈‍⬛ [CPB] ❌ 按鈕圖片未載入完成或無效");
            }
        } catch (e) {
            console.error("🐈‍⬛ [CPB] ❌ 按鈕繪製失敗:", e.message);
        }
    }

    function handleClick() {
        if (!shouldShowButton()) return false;
        if (MouseIn(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE)) {
            openUI();
            return true;
        }
        return false;
    }

    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) {
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    console.error("🐈‍⬛ [CPB] ❌ bcModSdk 載入超時");
                    resolve(false);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async function initializeModApi() {
        const success = await waitForBcModSdk();
        if (!success) return null;

        try {
            modApi = bcModSdk.registerMod({
                name: "liko - CPB",
                fullName: "liko's Custom Profile Background",
                version: MOD_VER,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
            });
            console.log("🐈‍⬛ [CPB] ✅ 模組註冊成功");
            return modApi;
        } catch (e) {
            console.error("🐈‍⬛ [CPB] ❌ 初始化 modApi 失敗:", e.message);
            return null;
        }
    }

    function waitForGame(timeout = 30000) {
    const start = Date.now();
    return new Promise(resolve => {
        const check = () => {
            if (typeof CurrentScreen !== 'undefined' &&
                typeof DrawRoomBackground === 'function' &&
                typeof DrawProcess === 'function' &&
                typeof DrawButton === 'function' &&
                typeof MouseIn === 'function' &&
                typeof Player !== 'undefined' &&
                Player?.ExtensionSettings &&
                Player?.OnlineSharedSettings) {
                resolve(true);
            } else if (Date.now() - start > timeout) {
                console.error("🐈‍⬛ [CPB] ❌ 遊戲載入超時");
                resolve(false);
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

    function setupHooks() {
        if (!modApi || typeof modApi.hookFunction !== 'function') {
            console.error("🐈‍⬛ [CPB] ❌ modApi 未正確初始化，無法設置 hooks");
            return;
        }

        let cpbControllingBackground = false;
        // Scope overlay suppression to this frame instead of a wall-clock timeout.
        modApi.hookFunction("DrawProcess", 100, (args, next) => {
            cpbControllingBackground = false;
            try { return next(args); }
            finally { cpbControllingBackground = false; }
        });
        modApi.hookFunction("DrawRoomBackground", 100, (args, next) => {
            const [, bounds] = args;
            // Only the full-screen profile background; UBC may supply any image URL.
            if (shouldReplaceBackground() && bounds && bounds.x === 0 && bounds.y === 0 &&
                bounds.w === MainCanvasWidth && bounds.h === MainCanvasHeight) {
                const image = getTargetBackground();
                if (image) {
                    MainCanvas.save();
                    try {
                        MainCanvas.globalCompositeOperation = "source-over";
                        MainCanvas.filter = "none";
                        MainCanvas.globalAlpha = 1;
                        MainCanvas.drawImage(image, bounds.x, bounds.y, bounds.w, bounds.h);
                        cpbControllingBackground = true;
                    } finally { MainCanvas.restore(); }
                    return;
                }
            }
            return next(args);
        });
        modApi.hookFunction("DrawRect", 200, (args, next) => {
            const [left, top, width, height, color] = args;
            if (cpbControllingBackground && isProfilePage() && left === 0 && top === 0 &&
                width >= MainCanvasWidth && height >= MainCanvasHeight &&
                typeof color === "string" && color.includes("main")) return;
            return next(args);
        });

        modApi.hookFunction("InformationSheetRun", 10, (args, next) => {
            const result = next(args);
            try {
                currentViewingCharacter = getCurrentViewingCharacter();
                drawButton();

                if (!interfaceCheckInterval) {
                    startInterfaceMonitoring();
                }

                return result;
            } catch (e) {
                console.error("🐈‍⬛ [CPB] ❌ InformationSheetRun 處理失敗:", e.message);
                return result;
            }
        });

        modApi.hookFunction("InformationSheetLoad", 5, async (args, next) => {
            // R132 會等待子頁文字載入；只在原生 Load 完成後讀取畫面。
            const result = await next(args);
            if (CurrentScreen !== "InformationSheet") return result;
            try {
                currentViewingCharacter = getCurrentViewingCharacter();
            } catch (e) {
                console.error("🐈‍⬛ [CPB] ❌ InformationSheetLoad 處理失敗:", e.message);
            }
            return result;
        });

        modApi.hookFunction("InformationSheetClick", 10, (args, next) => {
            try {
                if (handleClick()) {
                    return;
                }
                return next(args);
            } catch (e) {
                console.error("🐈‍⬛ [CPB] ❌ InformationSheetClick 處理失敗:", e.message);
                return next(args);
            }
        });

        modApi.hookFunction("InformationSheetExit", 5, (args, next) => {
            try {
                stopInterfaceMonitoring();
                currentViewingCharacter = null;
                cpbControllingBackground = false;

                if (isUIOpen) {
                    closeUI();
                }
                return next(args);
            } catch (e) {
                console.error("🐈‍⬛ [CPB] ❌ InformationSheetExit 處理失敗:", e.message);
                return next(args);
            }
        });
    }
    function waitForLogin() {
        if (typeof ServerIsLoggedInAsync === "function") return ServerIsLoggedInAsync();
        if (window.Player?.MemberNumber !== undefined) return Promise.resolve();
        return new Promise(resolve => {
            const remove = modApi.hookFunction("LoginResponse", 0, (args, next) => {
                const result = next(args);
                queueMicrotask(() => {
                    if (window.Player?.MemberNumber === undefined) return;
                    remove(); resolve();
                });
                return result;
            });
        });
    }

    function cleanup() {
        console.log("🐈‍⬛ [CPB] ⌛ 開始資源清理...");

        disposed = true;
        uiRequest++;
        for (const controller of imageControllers) controller.abort();
        imageControllers.clear();
        pendingRemoteBackgrounds.clear();
        remoteBackgroundRetryAfter.clear();
        try {
            stopInterfaceMonitoring();

            closeUI();

            if (uiElements.modal) {
                uiElements.modal.remove();
                uiElements.modal = null;
            }
            uiElements.eventHandlers = null;

            const styleElement = document.querySelector('#cpbg-styles');
            if (styleElement) {
                styleElement.remove();
            }

            for (const [key, img] of remoteBackgrounds) {
                if (img && img.src) {
                    cleanupBlobUrl(img.src);
                }
            }
            remoteBackgrounds.clear();
            cacheAccessOrder = [];

            for (const blobUrl of pendingBlobUrls) {
                cleanupBlobUrl(blobUrl);
            }
            pendingBlobUrls.clear();

            if (customBG && customBG.src && customBG.src.startsWith('blob:')) {
                cleanupBlobUrl(customBG.src);
            }
            if (buttonImage && buttonImage.src && buttonImage.src.startsWith('blob:')) {
                cleanupBlobUrl(buttonImage.src);
            }

            customBG = null;
            buttonImage = null;

            currentViewingCharacter = null;

            isInitialized = false;
            isUIOpen = false;
            lastButtonState = false;

            console.log("🐈‍⬛ [CPB] 🗑️ 資源清理完成");
        } catch (e) {
            console.error("🐈‍⬛ [CPB] ❌ 清理過程中出錯:", e.message);
        }
    }

    async function initialize() {
        if (isInitialized || disposed) return;

        console.log("🐈‍⬛ [CPB] ⌛ 開始初始化...");

        try {
            modApi = await initializeModApi();
            if (!modApi) {
                console.error("🐈‍⬛ [CPB] ❌ modApi 初始化失敗，無法繼續");
                return;
            }
            if (modApi && typeof modApi.onUnload === 'function') {
                modApi.onUnload(() => {
                    console.log("🐈‍⬛ [CPB] ⌛ 模組卸載中...");
                    cleanup();
                });
            }

            window.addEventListener('beforeunload', cleanup);

            await waitForLogin();
            if (disposed) return;

            const gameLoaded = await waitForGame();
            if (!gameLoaded) {
                console.error("🐈‍⬛ [CPB] ❌ 遊戲載入失敗，無法繼續");
                return;
            }

            const settings = getSettings();

            if (settings.enabled && settings.imageUrl) {
                try {
                    customBG = await loadImage(settings.imageUrl);
                } catch (error) {
                    console.warn("🐈‍⬛ [CPB] ❌ 載入保存的背景失敗:", error.message);
                    try {
                        customBG = await loadImage(DEFAULT_BG_URL);
                        // Temporary fallback only; preserve the saved URL.
                    } catch (defaultError) {
                        console.error("🐈‍⬛ [CPB] ❌ 默認背景載入也失敗:", defaultError.message);
                    }
                }
            } else if (!settings.imageUrl) {
                try {
                    customBG = await loadImage(DEFAULT_BG_URL);
                    // Empty settings stay empty until the user explicitly saves.
                } catch (error) {
                    console.error("🐈‍⬛ [CPB] ❌ 載入默認背景失敗:", error.message);
                }
            }

            try {
                const buttonImageURL = getButtonImageURL();
                if (buttonImageURL) {
                    buttonImage = await loadImage(buttonImageURL);
                    console.log("🐈‍⬛ [CPB] ✅ 按鈕圖標載入成功");
                } else {
                    throw new Error("無法獲取按鈕圖標路徑");
                }
            } catch (error) {
                console.warn("🐈‍⬛ [CPB] ❌ 載入按鈕圖標失敗:", error.message);
                buttonImage = null;
            }

            if (disposed) return;
            setupHooks();

            startInterfaceMonitoring();

            isInitialized = true;
            console.log(`🐈‍⬛ [CPB] ✅ v${MOD_VER} loaded`);
        } catch (e) {
            console.error("🐈‍⬛ [CPB] ❌初始化失敗:", e.message);
            cleanup();
        }
    }

    initialize();
})();
