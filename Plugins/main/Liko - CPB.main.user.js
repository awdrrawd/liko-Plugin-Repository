// ==UserScript==
// @name         Liko - CPB
// @name:zh      Liko的自定義個人資料頁面背景
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.2.4
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
    const MOD_VER = "1.2.4";
    window.Liko.CPB = MOD_VER;

    const EN = {
    "自訂個人資料背景": "Custom profile background",
    "背景圖片網址 (HTTPS)": "Background image URL (HTTPS)",
    "建議尺寸: 2000x1000 像素 (2:1比例)": "Recommended: 2000 × 1000 pixels (2:1)",
    "檔案大小限制: 10MB": "Maximum file size: 10 MB",
    "點擊預覽按鈕載入圖片": "Select Preview to load your image",
    "啟用背景": "Enable background",
    "顯示他人自訂背景": "Show others’ backgrounds",
    "預覽": "Preview",
    "保存設置": "Save settings",
    "取消": "Cancel",
    "關閉": "Close",
    "恢復預設": "Restore defaults",
    "清除設置": "Clear settings",
    "清除": "Clear",
    "保存": "Save",
    "清除自己的背景分享設定，恢復 CPB 預設背景；保留顯示他人背景的偏好。": "Clear your shared background settings and restore the CPB default. Keep your preference for other players’ backgrounds.",
    "載入中...": "Loading…",
    "預覽失敗": "Preview failed",
    "啟用背景時請輸入圖片網址": "Enter an image URL to enable the background.",
    "帳號同步尚未就緒，請稍後再試": "Account sync is not ready. Please try again shortly.",
    "必須使用 HTTPS 協議": "Use an HTTPS URL.",
    "不支援的圖片格式，請使用 jpg、png、gif 或 webp": "Use a jpg, png, gif or webp image.",
    "無效的網址格式": "Invalid URL.",
    "CPB 已卸載": "CPB has been unloaded.",
    "圖片檔案過大，請使用小於 10MB 的圖片": "The image exceeds 10 MB.",
    "圖片載入已取消": "Image loading was cancelled.",
    "圖片載入逾時或已取消": "Image loading timed out or was cancelled.",
    "圖片格式不支援或載入失敗": "Unsupported image or image failed to load.",
    "自訂背景設置": "Custom background settings",
    "無法載入圖片": "Unable to load image"
};

    function t(text) {
        const language = typeof TranslationLanguage === "string" ? TranslationLanguage.toUpperCase() : "EN";
        return language === "CN" || language === "TW" || language.startsWith("ZH") ? text : (EN[text] || text);
    }

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
    const BUTTON_X = 1715;
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
            throw new Error(t("帳號同步尚未就緒，請稍後再試"));
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

    function resetSettings() {
        if (disposed || !Player.OnlineSharedSettings || typeof ServerAccountUpdate === "undefined" ||
            typeof ServerAccountUpdate.QueueData !== "function") throw new Error(t("帳號同步尚未就緒，請稍後再試"));
        const previous = Player.OnlineSharedSettings.CustomProfileBG;
        delete Player.OnlineSharedSettings.CustomProfileBG;
        try {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        } catch (error) {
            if (previous !== undefined) Player.OnlineSharedSettings.CustomProfileBG = previous;
            throw error;
        }
        closeUI();
        const request = ++uiRequest;
        cleanupBlobUrl(customBG?.src);
        customBG = null;
        // Restoring the local default must never re-create the deleted shared setting.
        return loadImage(DEFAULT_BG_URL).then(image => {
            if (disposed || request !== uiRequest) { cleanupBlobUrl(image.src); return; }
            customBG = image;
        }).catch(error => console.warn("[CPB] Default background unavailable:", error.message));
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
                return { valid: false, error: t("必須使用 HTTPS 協議") };
            }

            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const hasValidExtension = validExtensions.some(ext =>
                parsedUrl.pathname.toLowerCase().endsWith(ext)
            );

            if (!hasValidExtension) {
                return { valid: false, error: t("不支援的圖片格式，請使用 jpg、png、gif 或 webp") };
            }

            return { valid: true };
        } catch (e) {
            return { valid: false, error: t("無效的網址格式") };
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
        if (disposed) throw new Error(t("CPB 已卸載"));
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
            if (!response.ok) throw new Error(`${t("無法載入圖片")}: ${response.status}`);
            const blob = await response.blob();
            if (blob.size > 10 * 1024 * 1024) throw new Error(t("圖片檔案過大，請使用小於 10MB 的圖片"));
            if (disposed || controller.signal.aborted) throw new Error(t("圖片載入已取消"));
            blobUrl = URL.createObjectURL(blob);
            pendingBlobUrls.add(blobUrl);
            const img = new Image();
            await new Promise((resolve, reject) => {
                const finish = (error) => {
                    img.onload = img.onerror = null;
                    controller.signal.removeEventListener("abort", abort);
                    error ? reject(error) : resolve();
                };
                const abort = () => finish(new Error(t("圖片載入逾時或已取消")));
                controller.signal.addEventListener("abort", abort, { once: true });
                img.onload = () => finish();
                img.onerror = () => finish(new Error(t("圖片格式不支援或載入失敗")));
                img.src = blobUrl;
            });
            if (disposed) throw new Error(t("CPB 已卸載"));
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
            .cpbg-modal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center;
                justify-content:center; padding:20px; box-sizing:border-box; background:rgba(24,32,40,.48); }
            .cpbg-dialog { position:relative; box-sizing:border-box; width:550px; max-width:100%;
                max-height:calc(100dvh - 40px); overflow:auto; padding:28px; border:1px solid #444444;
                border-radius:14px; background:#202020; color:#eeeeee; box-shadow:0 16px 48px #00000066;
                font-family:system-ui,sans-serif; color-scheme:dark; user-select:none; -webkit-user-select:none; }
            .cpbg-title { margin:0 30px 24px 0; color:#eeeeee; font-size:22px; font-weight:650; }
            .cpbg-section { margin-bottom:18px; }
            .cpbg-label { display:block; margin-bottom:8px; font-size:14px; line-height:1.5; color:#d4d4d4; }
            .cpbg-input { user-select:text; -webkit-user-select:text; min-width:0; width:100%; box-sizing:border-box; padding:11px 12px; border:1px solid #505050;
                border-radius:7px; background:#2c2c2c; color:#eeeeee; font-size:14px; }
            .cpbg-input:focus, .cpbg-button:focus-visible, .cpbg-close:focus-visible, .cpbg-checkbox:focus-visible {
                outline:2px solid #91afc0; outline-offset:3px; }
            .cpbg-checkbox-container { display:flex; align-items:center; gap:10px; margin:12px 0; }
            .cpbg-checkbox-container .cpbg-label { margin:0; }
            .cpbg-checkbox { width:18px; height:18px; flex-shrink:0; accent-color:#526c7c; }
            .cpbg-preview { width:100%; box-sizing:border-box; aspect-ratio:2/1; border:1px solid #444444;
                border-radius:8px; background:#292929 center/cover no-repeat; display:flex; align-items:center;
                justify-content:center; padding:12px; color:#bcbcbc; font-size:14px; text-align:center; }
            .cpbg-preview.loading { opacity:.65; }
            .cpbg-url-row { display:flex; align-items:center; gap:10px; }
            .cpbg-url-row .cpbg-input { flex:1; }
            .cpbg-url-row .cpbg-button { flex-shrink:0; }
            .cpbg-toggles { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .cpbg-buttons { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; margin-top:22px; }
            .cpbg-buttons .cpbg-button { padding:10px 4px; overflow-wrap:anywhere; }
            .cpbg-button { padding:10px 16px; border:1px solid #505050; border-radius:7px; font-size:14px;
                font-weight:600; cursor:pointer; background:#2c2c2c; color:#e0e0e0; transition:background .15s; }
            .cpbg-button:hover { background:#404040; }
            .cpbg-button.primary { background:#526c7c; color:#fff; border-color:#526c7c; }
            .cpbg-button.primary:hover { background:#637f90; }
            .cpbg-button:disabled { opacity:.5; cursor:wait; }
            .cpbg-error { color:#f0a0a0; font-size:13px; margin-top:8px; }
            .cpbg-close { position:absolute; top:16px; right:16px; width:30px; height:30px; background:transparent;
                color:#bcbcbc; border:0; border-radius:6px; font-size:24px; cursor:pointer; }
            .cpbg-close:hover { background:#383838; }
            @media(max-width:480px) { .cpbg-dialog { padding:20px; } .cpbg-title { font-size:19px; } }
        `;
        document.head.appendChild(style);
    }

    function createUI() {
        const settings = getSettings();

        const modal = document.createElement('div');
        modal.className = 'cpbg-modal';
        modal.innerHTML = `
            <div class="cpbg-dialog" role="dialog" aria-modal="true" aria-labelledby="cpbg-title">
                <button class="cpbg-close" type="button" aria-label="${t("關閉")}">×</button>
                <div class="cpbg-title" id="cpbg-title">${t("自訂個人資料背景")}</div>

                <div class="cpbg-section">
                    <label class="cpbg-label" for="cpbg-url-input">${t("背景圖片網址 (HTTPS)")}</label>
                    <div class="cpbg-url-row">
                    <input type="text" class="cpbg-input" id="cpbg-url-input"
                           placeholder="https://example.com/image.jpg"
                           title="${t("建議尺寸: 2000x1000 像素 (2:1比例)")} · ${t("檔案大小限制: 10MB")}">
                    <button class="cpbg-button secondary" id="cpbg-preview-btn">${t("預覽")}</button>
                    </div>
                    <div class="cpbg-error" id="cpbg-url-error"></div>
                </div>

                <div class="cpbg-section">
                    <div class="cpbg-preview" id="cpbg-preview">
                        ${t("點擊預覽按鈕載入圖片")}
                    </div>
                </div>

                <div class="cpbg-section cpbg-toggles">
                    <div class="cpbg-checkbox-container">
                        <input type="checkbox" class="cpbg-checkbox" id="cpbg-enabled"
                               ${settings.enabled ? 'checked' : ''}>
                        <label class="cpbg-label" for="cpbg-enabled">${t("啟用背景")}</label>
                    </div>

                    <div class="cpbg-checkbox-container">
                        <input type="checkbox" class="cpbg-checkbox" id="cpbg-show-remote"
                               ${settings.showRemoteBackground ? 'checked' : ''}>
                        <label class="cpbg-label" for="cpbg-show-remote">${t("顯示他人自訂背景")}</label>
                    </div>
                </div>

                <div class="cpbg-buttons">
                    <button class="cpbg-button secondary" id="cpbg-reset-btn"
                        title="${t("清除自己的背景分享設定，恢復 CPB 預設背景；保留顯示他人背景的偏好。")}">${t("清除")}</button>
                    <span aria-hidden="true"></span>
                    <span aria-hidden="true"></span>
                    <button class="cpbg-button primary" id="cpbg-save-btn">${t("保存")}</button>
                    <button class="cpbg-button secondary" id="cpbg-cancel-btn">${t("取消")}</button>
                </div>
            </div>
        `;

        modal.querySelector('#cpbg-url-input').value = settings.imageUrl || '';
        bindUIEvents(modal);

        uiElements.modal = modal;
        document.body.appendChild(modal);
    }

    function bindUIEvents(modal) {
        const closeBtn = modal.querySelector('.cpbg-close');
        const cancelBtn = modal.querySelector('#cpbg-cancel-btn');
        const saveBtn = modal.querySelector('#cpbg-save-btn');
        const previewBtn = modal.querySelector('#cpbg-preview-btn');
        const resetBtn = modal.querySelector('#cpbg-reset-btn');

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
            preview.textContent = t("載入中...");
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
                cleanupBlobUrl(previewImage?.src);
                previewImage = null;
                preview.style.backgroundImage = '';
                preview.textContent = t("預覽失敗");
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
                if (enabled && !url) throw new Error(t("啟用背景時請輸入圖片網址"));
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

        resetBtn.addEventListener('click', () => {
            try { void resetSettings(); }
            catch (error) { showError(modal.querySelector('#cpbg-url-error'), error.message); }
        });
        closeBtn.addEventListener('click', handleClose);
        cancelBtn.addEventListener('click', handleClose);
        saveBtn.addEventListener('click', handleSave);
        previewBtn.addEventListener('click', handlePreview);
        modal.addEventListener('click', handleModalClick);

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
            DrawButton(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE, "", "White", "", t("自訂背景設置"));

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
