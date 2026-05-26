// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.6.0
// @description  Bondage Club - 上傳圖片到圖床並分享網址 + 懸停/點擊圖片放大預覽
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    let modApi = null;
    const modversion = "1.6.0";
    let imageHost       = "litterbox";
    let zoomEnabled     = false;   // 懸停放大（桌面）
    let clickZoomEnabled = false;  // 點擊放大（手機友善）

    // ──────────────────────────────────────────
    // 等待 bcModSdk
    // ──────────────────────────────────────────
    async function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    // ──────────────────────────────────────────
    // 載入樣式化訊息系統
    // ──────────────────────────────────────────
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    // ──────────────────────────────────────────
    // 發送本地訊息
    // ──────────────────────────────────────────
    function ChatRoomSendLocal(message, sec = 0) {
        if (CurrentScreen !== "ChatRoom") return;
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#FF69B4">[IMG] ${message}</font>`,
                Timeout: sec
            });
        } catch (e) {
            console.error("🐈‍⬛ [IMG] ❌ 發送本地訊息錯誤:", e.message);
        }
    }

    // ──────────────────────────────────────────
    // 驗證：圖片格式 / 大小
    // ──────────────────────────────────────────
    function isValidImageFormat(file) {
        const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        if (file.type && validFormats.includes(file.type.toLowerCase())) return true;
        const ext = file.name.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
    }

    function isValidFileSize(file, host = imageHost) {
        const limits = { uguu: 128, imgbb: 32, tmpfiles: 100, cloudflare: 10, litterbox: 100 };
        return file.size <= (limits[host] ?? 100) * 1024 * 1024;
    }

    function getMaxSizeText(host = imageHost) {
        return { cloudflare: "10MB", uguu: "128MB", imgbb: "32MB", tmpfiles: "100MB", litterbox: "100MB" }[host] ?? "100MB";
    }

    // ──────────────────────────────────────────
    // 設定：讀取 / 儲存
    // ──────────────────────────────────────────
    function loadSettings() {
        if (Player?.ExtensionSettings?.LikoImageUploader) {
            try {
                const saved = JSON.parse(Player.ExtensionSettings.LikoImageUploader);
                imageHost        = saved.imageHost        || "litterbox";
                zoomEnabled      = saved.zoomEnabled      !== undefined ? saved.zoomEnabled      : false;
                clickZoomEnabled = saved.clickZoomEnabled !== undefined ? saved.clickZoomEnabled : false;
            } catch {
                console.warn("🐈‍⬛ [IMG] ❗ ExtensionSettings 解析失敗，使用預設設定");
            }
        }
    }

    function saveSettings() {
        if (!Player?.ExtensionSettings) {
            ChatRoomSendLocalStyled("⚠️ 無法保存設定，請確保已登錄", 4000, "#FFA500");
            return;
        }
        Player.ExtensionSettings.LikoImageUploader = JSON.stringify({ imageHost, zoomEnabled, clickZoomEnabled });
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync("LikoImageUploader");
        }
    }

    // ──────────────────────────────────────────
    // 上傳前共用檢查
    // ──────────────────────────────────────────
    function preUploadCheck(file, host) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return false;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return false;
        }
        if (!isValidFileSize(file, host)) {
            ChatRoomSendLocalStyled(`❌ 圖片過大 (最大 ${getMaxSizeText(host)})`, 5000, "#ff4444");
            return false;
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 各圖床上傳函數
    // ──────────────────────────────────────────
    async function uploadToLitterbox(file) {
        if (!preUploadCheck(file, "litterbox")) return null;
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("time", "12h");
        form.append("fileToUpload", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Litterbox...", 2000, "#FFA500");
            const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", { method: "POST", body: form });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const text = (await res.text()).trim();
            if (!text.startsWith("http")) throw new Error(`Litterbox API 返回錯誤: ${text}`);
            return text;
        } catch (err) {
            ChatRoomSendLocalStyled(`❌ 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    async function uploadToUguu(file) {
        if (!preUploadCheck(file, "uguu")) return null;
        const form = new FormData();
        form.append("files[]", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Uguu...", 2000, "#FFA500");
            const res = await fetch("https://bc-img-upload-uguu.awdrrawd1.workers.dev/", { method: "POST", body: form });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.success || !json.files?.[0]?.url) throw new Error(`Uguu API 返回錯誤: ${json.description || '未知錯誤'}`);
            return json.files[0].url;
        } catch (err) {
            ChatRoomSendLocalStyled(`❌ 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    async function uploadToImgBB(file) {
        if (!preUploadCheck(file, "imgbb")) return null;
        const form = new FormData();
        form.append("file", file);
        form.append("expiration", "43200");
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 ImgBB...", 2000, "#FFA500");
            const res = await fetch("https://bc-img-upload-imgbb.awdrrawd1.workers.dev/", { method: "POST", body: form });
            const responseText = await res.text();
            if (responseText.trim().toLowerCase().startsWith('<html'))
                throw new Error("Worker 返回 HTML 頁面，可能是部署問題");
            let json;
            try { json = JSON.parse(responseText); }
            catch { throw new Error(`Worker 返回非 JSON 格式: ${responseText.substring(0, 100)}`); }
            if (!res.ok) throw new Error((json.error || `HTTP ${res.status}`) + (res.status === 429 ? ' (速率限制)' : ''));
            if (!json.success || !json.link) throw new Error(`ImgBB API 失敗: ${json.error || '未知錯誤'}`);
            return json.link;
        } catch (err) {
            ChatRoomSendLocalStyled(`❌ ImgBB 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    async function uploadToTmpFiles(file) {
        if (!preUploadCheck(file, "tmpfiles")) return null;
        const form = new FormData();
        form.append("file", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 TmpFiles...", 2000, "#FFA500");
            const res = await fetch("https://tmpfiles.org/api/v1/upload", { method: "POST", body: form });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.data?.url) throw new Error("TmpFiles API 返回錯誤: 未獲取到 URL");
            return json.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        } catch (err) {
            ChatRoomSendLocalStyled(`❌ TmpFiles 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    async function uploadToCloudflareR2(file) {
        if (!preUploadCheck(file, "cloudflare")) return null;
        const form = new FormData();
        form.append("file", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Cloudflare R2...", 2000, "#FFA500");
            const res = await fetch("https://liko-image-upload-cloudflare.awdrrawd1.workers.dev", { method: "POST", body: form });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.success || !json.url) throw new Error(`R2 上傳失敗: ${json.error || '未知錯誤'}`);
            return json.url;
        } catch (err) {
            ChatRoomSendLocalStyled(`❌ R2 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    async function uploadImage(file) {
        switch (imageHost) {
            case "cloudflare": return await uploadToCloudflareR2(file);
            case "uguu":       return await uploadToUguu(file);
            case "imgbb":      return await uploadToImgBB(file);
            case "tmpfiles":   return await uploadToTmpFiles(file);
            default:           return await uploadToLitterbox(file);
        }
    }

    // ──────────────────────────────────────────
    // 發送網址到聊天室
    // ──────────────────────────────────────────
    function sendToChat(url) {
        if (CurrentScreen !== "ChatRoom" || !ChatRoomData) {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return;
        }
        const timeText = { uguu: "3小時", tmpfiles: "60分鐘", cloudflare: "30分鐘", litterbox: "12小時", imgbb: "12小時" }[imageHost] || "12小時";
        const hostText = { litterbox: "Litterbox", cloudflare: "Cloudflare R2", uguu: "Uguu", imgbb: "ImgBB", tmpfiles: "TmpFiles" }[imageHost] || imageHost;
        try {
            ServerSend("ChatRoomChat", { Content: `(${url})`, Type: "Chat" });
            ChatRoomSendLocalStyled(`✅ 圖片連結已發送\n存放於 ${hostText} | 保存時間 ${timeText}`, 5000, "#50C878");
        } catch (e) {
            ChatRoomSendLocalStyled("❌ 發送失敗，請重試", 3000, "#ff4444");
        }
    }

    // ──────────────────────────────────────────
    // 文件選擇輸入框
    // ──────────────────────────────────────────
    function createFileInput() {
        if (document.getElementById("LikoImageUploaderInput")) return document.getElementById("LikoImageUploaderInput");
        const input = document.createElement("input");
        input.type = "file";
        input.id = "LikoImageUploaderInput";
        input.accept = "image/*";
        input.style.display = "none";
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (file) {
                const url = await uploadImage(file);
                if (url) sendToChat(url);
                input.value = '';
            }
        };
        document.body.appendChild(input);
        return input;
    }

    function triggerFileSelect() {
        if (CurrentScreen !== "ChatRoom") { ChatRoomSendLocalStyled("🚫 請先加入聊天室", 3000, "#FFA500"); return; }
        createFileInput().click();
    }

    // ──────────────────────────────────────────
    // 拖曳上傳
    // ──────────────────────────────────────────
    document.addEventListener("dragover", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; }
    });
    document.addEventListener("drop", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (!e.dataTransfer.files?.length) return;

        // 先 preventDefault，避免瀏覽器開啟檔案
        e.preventDefault();
        e.stopPropagation();

        const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (imageFiles.length === 0) {
            ChatRoomSendLocalStyled("❌ 請拖曳圖片文件", 3000, "#ff4444");
            return;
        }

        const inputElement = document.getElementById("InputChat");
        if (!inputElement) return;

        (async () => {
            const urls = [];
            for (const file of imageFiles) {
                const url = await uploadImage(file);
                if (url) urls.push(url);
            }
            if (urls.length > 0) {
                // 放進輸入框，讓玩家確認後再手動發送，避免誤拖造成重複發送
                inputElement.value = urls.join(" ");
                inputElement.dispatchEvent(new Event("input", { bubbles: true }));
                inputElement.focus();
            }
        })();
    });

    // ──────────────────────────────────────────
    // 貼上上傳
    // ──────────────────────────────────────────
    document.addEventListener("paste", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        const inputElement = document.getElementById("InputChat");
        if (!inputElement || !e.clipboardData) return;

        // activeElement 只做寬鬆判斷：焦點在其他 input/textarea 時才跳過
        // 不強制要求 activeElement === inputElement，避免聊天室點其他地方後貼上失效
        const focused = document.activeElement;
        if (focused && (focused.tagName === "INPUT" || focused.tagName === "TEXTAREA") && focused !== inputElement) return;

        const items = Array.from(e.clipboardData.items || []);
        const imageItems = items.filter(i => i.type.startsWith("image/"));
        if (imageItems.length === 0) return;

        e.preventDefault();
        e.stopPropagation();

        // 關鍵：必須在同步環境下呼叫 getAsFile()
        // 進入 async 後遇到第一個 await，瀏覽器可能讓 ClipboardItem 失效
        const imageFiles = imageItems.map(i => i.getAsFile()).filter(Boolean);
        if (imageFiles.length === 0) return;

        (async () => {
            const urls = [];
            for (const file of imageFiles) {
                const url = await uploadImage(file);
                if (url) urls.push(url);
            }
            if (urls.length > 0) {
                inputElement.value = urls.join(" ");
                // 觸發 input 事件，確保 BC 偵測到輸入框內容變化
                inputElement.dispatchEvent(new Event("input", { bubbles: true }));
                inputElement.focus();
            }
        })();
    });

    // ══════════════════════════════════════════
    // ★ 功能一：懸停放大（左側固定浮層，桌面用）
    // ══════════════════════════════════════════

    function ensureHoverOverlay() {
        let el = document.getElementById("LikoZoomOverlay");
        if (el) return el;
        el = document.createElement("div");
        el.id = "LikoZoomOverlay";
        el.style.cssText = `
            position: fixed; left: 10px; top: 50%; transform: translateY(-50%);
            z-index: 2147483646; pointer-events: none;
            display: none; opacity: 0;
            background: rgba(8,8,8,0.82);
            border: 2px solid rgba(255,105,180,0.8); border-radius: 12px; padding: 5px;
            max-width: min(1500px, 72vw); max-height: 92vh; overflow: hidden;
            box-shadow: 4px 0 40px rgba(0,0,0,0.75);
            transition: opacity 0.18s ease;
        `;
        const img = document.createElement("img");
        img.id = "LikoZoomOverlayImg";
        img.style.cssText = "display:block; max-width:100%; max-height:90vh; border-radius:8px; object-fit:contain;";
        img.onerror = () => { el.style.display = "none"; };
        el.appendChild(img);
        document.body.appendChild(el);
        return el;
    }

    function showHoverOverlay(src) {
        const el  = ensureHoverOverlay();
        const img = document.getElementById("LikoZoomOverlayImg");
        if (img.getAttribute("src") !== src) img.src = src;
        el.style.display = "block";
        requestAnimationFrame(() => { el.style.opacity = "1"; });
    }

    function hideHoverOverlay() {
        const el = document.getElementById("LikoZoomOverlay");
        if (!el) return;
        el.style.opacity = "0";
        setTimeout(() => { if (el.style.opacity === "0") el.style.display = "none"; }, 180);
    }

    // ══════════════════════════════════════════
    // ★ 功能二：點擊 🔍 全螢幕放大（手機友善）
    // ══════════════════════════════════════════

    function ensureClickModal() {
        let modal = document.getElementById("LikoClickModal");
        if (modal) return modal;

        // 全螢幕遮罩
        modal = document.createElement("div");
        modal.id = "LikoClickModal";
        modal.style.cssText = `
            position: fixed; inset: 0;
            z-index: 2147483647;
            display: none; opacity: 0;
            background: rgba(0,0,0,0.88);
            cursor: zoom-out;
            transition: opacity 0.2s ease;
            align-items: center; justify-content: center;
        `;

        const img = document.createElement("img");
        img.id = "LikoClickModalImg";
        img.style.cssText = `
            max-width: 92vw; max-height: 92vh;
            object-fit: contain;
            border-radius: 10px;
            border: 2px solid rgba(255,105,180,0.7);
            box-shadow: 0 0 60px rgba(0,0,0,0.9);
            pointer-events: none;
            user-select: none;
        `;
        img.onerror = () => { hideClickModal(); };

        // 右上角關閉提示
        const hint = document.createElement("div");
        hint.style.cssText = `
            position: fixed; top: 14px; right: 18px;
            color: rgba(255,255,255,0.5); font-size: 13px;
            pointer-events: none; user-select: none;
            font-family: sans-serif;
        `;
        hint.textContent = "✕  點任意處關閉";

        modal.appendChild(img);
        modal.appendChild(hint);
        document.body.appendChild(modal);

        // 點任意處關閉（包含點圖片）
        modal.addEventListener("click", () => hideClickModal());

        return modal;
    }

    function showClickModal(src) {
        const modal = ensureClickModal();
        const img   = document.getElementById("LikoClickModalImg");
        if (img.getAttribute("src") !== src) img.src = src;
        modal.style.display = "flex";
        requestAnimationFrame(() => { modal.style.opacity = "1"; });
    }

    function hideClickModal() {
        const modal = document.getElementById("LikoClickModal");
        if (!modal) return;
        modal.style.opacity = "0";
        setTimeout(() => { if (modal.style.opacity === "0") modal.style.display = "none"; }, 200);
    }

    // ESC 鍵也能關閉
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideClickModal();
    });

    // ══════════════════════════════════════════
    // ★ 核心：對 <img> 掛載事件 + 插入 🔍 按鈕
    // ══════════════════════════════════════════

    function updateImgCursors() {
        document.querySelectorAll("img[data-liko-zoom]").forEach(img => {
            img.style.cursor = zoomEnabled ? "zoom-in" : "";
        });
    }

    function attachZoomToImg(imgEl) {
        if (imgEl.dataset.likoZoom) return;
        imgEl.dataset.likoZoom = "1";

        const src = imgEl.src;

        // ── 懸停放大事件（hover zoom）──
        imgEl.style.cursor = zoomEnabled ? "zoom-in" : "";
        imgEl.addEventListener("mouseenter", () => {
            if (!zoomEnabled) return;
            showHoverOverlay(src);
        });
        imgEl.addEventListener("mouseleave", () => {
            if (!zoomEnabled) return;
            hideHoverOverlay();
        });

        // ── 插入 🔍 按鈕（click zoom）──
        // 找到包住 img 的 <a> 標籤（BC 結構：<a class="bce-img-link"><img></a>）
        const aTag = imgEl.closest("a") || imgEl.parentElement;
        if (!aTag) return;

        const btn = document.createElement("span");
        btn.className = "liko-click-zoom-btn";
        btn.dataset.likoClickBtn = "1";
        btn.title = "點擊放大圖片";
        btn.textContent = "🔍";
        btn.style.cssText = `
            display: ${clickZoomEnabled ? "inline" : "none"};
            cursor: pointer;
            font-size: 1em;
            margin-left: 4px;
            vertical-align: middle;
            user-select: none;
            opacity: 0.75;
            transition: opacity 0.15s;
        `;
        btn.addEventListener("mouseenter", () => { btn.style.opacity = "1"; });
        btn.addEventListener("mouseleave", () => { btn.style.opacity = "0.75"; });
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!clickZoomEnabled) return;
            showClickModal(src);
        });

        // 插在 <a> 後面，作為兄弟節點
        aTag.insertAdjacentElement("afterend", btn);
    }

    // 開關 🔍 按鈕的顯示
    function updateAllClickBtns() {
        document.querySelectorAll(".liko-click-zoom-btn").forEach(btn => {
            btn.style.display = clickZoomEnabled ? "inline" : "none";
        });
    }

    // ──────────────────────────────────────────
    // MutationObserver：監聽聊天紀錄
    // ──────────────────────────────────────────
    let chatObserver = null;

    function processImgsInNode(node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.tagName === "IMG") {
            attachZoomToImg(node);
        } else {
            node.querySelectorAll("img").forEach(attachZoomToImg);
        }
    }

    function setupChatObserver() {
        if (chatObserver) { chatObserver.disconnect(); chatObserver = null; }

        function tryAttach() {
            const chatLog = document.getElementById("TextAreaChatLog");
            if (!chatLog) { setTimeout(tryAttach, 800); return; }

            // 掃描已有訊息
            processImgsInNode(chatLog);

            chatObserver = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const added of m.addedNodes) processImgsInNode(added);
                }
            });
            chatObserver.observe(chatLog, { childList: true, subtree: true });
            console.log("🐈‍⬛ [IMG] 🔍 Observer 已啟動");
        }
        tryAttach();
    }

    // ──────────────────────────────────────────
    // /img 指令處理
    // ──────────────────────────────────────────
    function handleImgCommand(text) {
        const args = text.trim().split(/\s+/);
        const sub  = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            const hostNames = { litterbox: "Litterbox", uguu: "Uguu", imgbb: "ImgBB", cloudflare: "Cloudflare R2", tmpfiles: "TmpFiles" };
            const hostTimes = { uguu: "3小時", tmpfiles: "60分鐘", litterbox: "12小時", cloudflare: "30分鐘", imgbb: "12小時" };
            ChatRoomSendLocal(
                `🖼️圖片上傳說明 | Image upload illustrate🖼️\n` +
                `        當前設定(Current): 🌐${hostNames[imageHost] || imageHost} 📌${hostTimes[imageHost] || "12小時"}\n` +
                `        懸停放大(Hover): ${zoomEnabled ? "✅" : "❌"}  |  點擊放大(Click): ${clickZoomEnabled ? "✅" : "❌"}\n\n` +
                `/img up - 上傳圖片 | UPload image\n` +
                `/img web [litterbox|uguu|imgbb|tmpfiles|cloudflare]\n` +
                `               └選擇圖床 | Set img host\n` +
                `/img zoom  - 開關懸停放大 (桌面) | Toggle hover zoom\n` +
                `/img click - 開關點擊放大🔍 (手機友善) | Toggle click zoom\n\n` +
                `支援 | Support:\n` +
                `• 可以拖曳圖片上傳 | You can direct drag & drop\n` +
                `• 格式(Format): JPG/PNG/GIF/BMP/WEBP\n` +
                `• 大小(Size): Litterbox(100MB) | Uguu(128MB) | ImgBB(32MB) | TmpFiles(100MB) | Cloudflare(10MB)\n` +
                `• 時間(Time): Litterbox(12HR) | Uguu(3HR) | ImgBB(12HR) | TmpFiles(1HR) | Cloudflare(30Min)\n` +
                `✦建議使用(suggestion) litterbox > tmpfiles > uguu > imgbb\n` +
                `✦ImgBB使用私人API請珍惜使用，如果過期將不會再更新\n` +
                `  └Use private API. If expired, will not be updated.`
                ,30000
            );
            return true;
        }

        if (sub === "up") { triggerFileSelect(); return true; }

        if (sub === "web") {
            const validHosts = ["litterbox", "uguu", "imgbb", "tmpfiles", "cloudflare"];
            if (args[1] && validHosts.includes(args[1])) {
                const hostNames = { litterbox: "Litterbox", uguu: "Uguu", imgbb: "ImgBB", cloudflare: "Cloudflare R2", tmpfiles: "TmpFiles" };
                const hostTimes = { litterbox: " (保存12小時)", uguu: " (保存3小時)", imgbb: " (保存12小時)", cloudflare: " (保存30分鐘)", tmpfiles: " (保存60分鐘)" };
                imageHost = args[1];
                saveSettings();
                ChatRoomSendLocalStyled(`✅ 已設定圖床為 ${hostNames[args[1]]}${hostTimes[args[1]] || ""}`, 3000, "#50C878");
            } else {
                ChatRoomSendLocalStyled("❌ 圖床參數必須是 litterbox/uguu/imgbb/tmpfiles/cloudflare", 5000, "#ff4444");
            }
            return true;
        }

        // ★ /img zoom：懸停放大開關
        if (sub === "zoom") {
            zoomEnabled = !zoomEnabled;
            saveSettings();
            if (zoomEnabled) {
                const chatLog = document.getElementById("TextAreaChatLog");
                if (chatLog) processImgsInNode(chatLog);
                updateImgCursors();
                ChatRoomSendLocalStyled("🔍 懸停放大已開啟 | Hover zoom ON", 3000, "#50C878");
            } else {
                hideHoverOverlay();
                updateImgCursors();
                ChatRoomSendLocalStyled("🚫 懸停放大已關閉 | Hover zoom OFF", 3000, "#FFA500");
            }
            return true;
        }

        // ★ /img click：點擊 🔍 放大開關（手機友善）
        if (sub === "click") {
            clickZoomEnabled = !clickZoomEnabled;
            saveSettings();
            if (clickZoomEnabled) {
                // 確保所有圖片都已掛載按鈕
                const chatLog = document.getElementById("TextAreaChatLog");
                if (chatLog) processImgsInNode(chatLog);
                updateAllClickBtns();
                ChatRoomSendLocalStyled("🔍 點擊放大已開啟 | Click zoom ON\n圖片後方出現 🔍，點擊可放大", 3500, "#50C878");
            } else {
                hideClickModal();
                updateAllClickBtns();
                ChatRoomSendLocalStyled("🚫 點擊放大已關閉 | Click zoom OFF", 3000, "#FFA500");
            }
            return true;
        }

        ChatRoomSendLocalStyled("❌ 未知子指令，使用 /img help 查詢", 4000, "#ff4444");
        return true;
    }

    // ──────────────────────────────────────────
    // Hook ChatRoomLoad
    // ──────────────────────────────────────────
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                const result = next(args);
                setTimeout(() => {
                    try {
                        loadSettings();
                        setupChatObserver();
                        if (!window.LikoImageUploaderWelcomed) {
                            ChatRoomSendLocalStyled(
                                `🖼️ Liko 圖片上傳器 v${modversion} 載入！使用(use) /img help 查看說明`,
                                5000
                            );
                            window.LikoImageUploaderWelcomed = true;
                        }
                    } catch (e) {
                        console.error("🐈‍⬛ [IMG] ❌ ChatRoomLoad 延遲處理錯誤:", e);
                    }
                }, 1000);
                return result;
            });
        }
    }

    // ──────────────────────────────────────────
    // 初始化
    // ──────────────────────────────────────────
    async function initialize() {
        console.log("🐈‍⬛ [IMG] ⌛ 插件啟動中...");
        const ok = await waitForBcModSdk();
        if (!ok) { console.error("🐈‍⬛ [IMG] ❌ bcModSdk 載入失敗"); return; }
        await loadToastSystem();
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko's Image Uploader",
                fullName: 'BC - Image Uploader',
                version: modversion,
                repository: '圖片拖曳上傳並分享 | Image to litterbox/uguu/imgbb/tmpfiles and share'
            });
        } catch (e) {
            console.error("🐈‍⬛ [IMG] ❌ 初始化 modApi 失敗:", e.message);
        }
        loadSettings();
        CommandCombine([{
            Tag: "img",
            Description: "圖片上傳 (/img help 查看說明)",
            Action: handleImgCommand
        }]);
        hookChatRoomLoad();
        console.log("🐈‍⬛ [IMG] ✅ 插件已載入完成");
    }

    initialize();
})();
