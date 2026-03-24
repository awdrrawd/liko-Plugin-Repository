// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.3.2
// @description  Bondage Club - 上傳圖片到圖床並分享網址
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
    const modversion = "1.3.2";
    let imageHost = "litterbox";

    // 等待 bcModSdk
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

    // 載入樣式化訊息系統
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) {
                resolve();
                return;
            }
            const toastUrl = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            const script = document.createElement('script');
            script.src = toastUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("載入失敗"));
            document.head.appendChild(script);
        });
    }

    // 發送本地訊息函數
    function ChatRoomSendLocal(message, sec = 0) {
        if (CurrentScreen !== "ChatRoom") {
            console.warn("[IMG] 不在聊天室，訊息可能不顯示");
            return;
        }
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#FF69B4">[IMG] ${message}</font>`,
                Timeout: sec
            });
        } catch (e) {
            console.error("[IMG] 發送本地訊息錯誤:", e.message);
        }
    }

    // 檢查圖片格式
    function isValidImageFormat(file) {
        const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        if (file.type && validFormats.includes(file.type.toLowerCase())) {
            return true;
        }
        const ext = file.name.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
    }

    // 檢查文件大小（根據圖床動態調整）
    function isValidFileSize(file, host = imageHost) {
        let maxSize;
        switch (host) {
            case "uguu":      maxSize = 128 * 1024 * 1024; break;
            case "imgbb":     maxSize = 32  * 1024 * 1024; break;
            case "tmpfiles":  maxSize = 100 * 1024 * 1024; break;
            case "cloudflare":maxSize = 10  * 1024 * 1024; break;
            case "litterbox":
            default:          maxSize = 100 * 1024 * 1024; break;
        }
        return file.size <= maxSize;
    }

    // 獲取文件大小限制文字
    function getMaxSizeText(host = imageHost) {
        switch (host) {
            case "cloudflare": return "10MB";
            case "uguu":       return "128MB";
            case "imgbb":      return "32MB";
            case "tmpfiles":   return "100MB";
            case "litterbox":
            default:           return "100MB";
        }
    }

    // 從 OnlineSettings 載入設定
    function loadSettings() {
        if (Player && Player.OnlineSettings && Player.OnlineSettings.LikoImageUploader) {
            const settings = Player.OnlineSettings.LikoImageUploader;
            imageHost = settings.imageHost || "litterbox";
        } else {
            console.warn("[IMG] OnlineSettings 不可用，使用預設設定");
        }
    }

    // 保存設定到 OnlineSettings
    function saveSettings() {
        if (!Player || !Player.OnlineSettings) {
            console.warn("[IMG] 無法訪問 OnlineSettings，設定未保存");
            ChatRoomSendLocalStyled("⚠️ 無法保存設定，請確保已登錄", 4000, "#FFA500");
            return;
        }
        Player.OnlineSettings.LikoImageUploader = { imageHost };
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
        } else {
            console.warn("[IMG] ServerAccountUpdate.QueueData 不可用，設定未同步");
            ChatRoomSendLocalStyled("⚠️ 無法同步設定，模組可能干擾", 4000, "#FFA500");
        }
    }

    // 上傳到 Litterbox
    async function uploadToLitterbox(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file, "litterbox")) {
            ChatRoomSendLocalStyled(`❌ 圖片過大 (最大${getMaxSizeText("litterbox")})`, 5000, "#ff4444");
            return null;
        }
        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("time", "12h");
        form.append("fileToUpload", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Litterbox...", 2000, "#FFA500");
            const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
                method: "POST", body: form
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const text = (await res.text()).trim();
            if (!text.startsWith("http")) throw new Error(`Litterbox API 返回錯誤: ${text}`);
            return text;
        } catch (err) {
            console.error("[IMG] Litterbox 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ 圖片上傳失敗: ${err.message} (請檢查網路連線或更換圖床)`, 5000, "#ff4444");
            return null;
        }
    }

    // 上傳到 Uguu
    async function uploadToUguu(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file, "uguu")) {
            ChatRoomSendLocalStyled(`❌ 圖片過大 (最大${getMaxSizeText("uguu")})`, 5000, "#ff4444");
            return null;
        }
        const form = new FormData();
        form.append("files[]", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Uguu...", 2000, "#FFA500");
            const res = await fetch("https://bc-img-upload-uguu.awdrrawd1.workers.dev/", {
                method: "POST", body: form
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.success || !json.files?.[0]?.url)
                throw new Error(`Uguu API 返回錯誤: ${json.description || '未知錯誤'}`);
            return json.files[0].url;
        } catch (err) {
            console.error("[IMG] Uguu 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ 圖片上傳失敗: ${err.message} (請檢查網路連線或更換圖床)`, 5000, "#ff4444");
            return null;
        }
    }

    // 上傳到 ImgBB
    async function uploadToImgBB(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file, "imgbb")) {
            ChatRoomSendLocalStyled(`❌ 圖片過大 (最大${getMaxSizeText("imgbb")})`, 5000, "#ff4444");
            return null;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("expiration", "43200");
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 ImgBB...", 2000, "#FFA500");
            const res = await fetch("https://bc-img-upload-imgbb.awdrrawd1.workers.dev/", {
                method: "POST", body: form
            });
            const responseText = await res.text();
            if (responseText.trim().toLowerCase().startsWith('<html'))
                throw new Error("Worker 返回 HTML 頁面，可能是部署問題");
            let json;
            try {
                json = JSON.parse(responseText);
            } catch {
                throw new Error(`Worker 返回非 JSON 格式: ${responseText.substring(0, 100)}`);
            }
            if (!res.ok) {
                const errorMsg = json.error || `HTTP ${res.status}: ${res.statusText}`;
                throw new Error(errorMsg + (res.status === 429 ? ' (速率限制)' : ''));
            }
            if (!json.success || !json.link)
                throw new Error(`ImgBB API 失敗: ${json.error || '未知錯誤'}`);
            return json.link;
        } catch (err) {
            console.error("[IMG] ImgBB 上傳失敗:", err);
            let errorMessage = err.message;
            if (errorMessage.includes('HTML')) errorMessage += " - 請檢查 Worker 部署狀態";
            else if (errorMessage.includes('速率限制') || errorMessage.includes('429')) errorMessage += " - 請稍後重試";
            ChatRoomSendLocalStyled(`❌ ImgBB 上傳失敗: ${errorMessage} (或更換圖床)`, 5000, "#ff4444");
            return null;
        }
    }

    // 上傳到 tmpfiles.org
    async function uploadToTmpFiles(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file, "tmpfiles")) {
            ChatRoomSendLocalStyled(`❌ 圖片過大 (最大${getMaxSizeText("tmpfiles")})`, 5000, "#ff4444");
            return null;
        }
        const form = new FormData();
        form.append("file", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 TmpFiles...", 2000, "#FFA500");
            const res = await fetch("https://tmpfiles.org/api/v1/upload", {
                method: "POST", body: form
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.data?.url) throw new Error(`TmpFiles API 返回錯誤: 未獲取到 URL`);
            return json.data.url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        } catch (err) {
            console.error("[IMG] TmpFiles 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ TmpFiles 上傳失敗: ${err.message} (或更換圖床)`, 5000, "#ff4444");
            return null;
        }
    }

    // 上傳到 Cloudflare R2
    async function uploadToCloudflareR2(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 5000, "#ff4444");
            return null;
        }
        if (file.size > 10 * 1024 * 1024) {
            ChatRoomSendLocalStyled("❌ 圖片超過 10MB (Cloudflare R2 限制)", 5000, "#ff4444");
            return null;
        }
        const form = new FormData();
        form.append("file", file);
        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Cloudflare R2...", 2000, "#FFA500");
            const res = await fetch("https://liko-image-upload-cloudflare.awdrrawd1.workers.dev", {
                method: "POST", body: form
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            const json = await res.json();
            if (!json.success || !json.url)
                throw new Error(`R2 上傳失敗: ${json.error || '未知錯誤'}`);
            return json.url;
        } catch (err) {
            console.error("[IMG] Cloudflare R2 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ R2 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    // 動態選擇圖床進行上傳
    async function uploadImage(file) {
        switch (imageHost) {
            case "cloudflare": return await uploadToCloudflareR2(file);
            case "uguu":       return await uploadToUguu(file);
            case "imgbb":      return await uploadToImgBB(file);
            case "tmpfiles":   return await uploadToTmpFiles(file);
            case "litterbox":
            default:           return await uploadToLitterbox(file);
        }
    }

    // 發送網址到聊天室
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
            console.error("[IMG] 發送訊息失敗:", e);
            ChatRoomSendLocalStyled("❌ 發送失敗，請重試", 3000, "#ff4444");
        }
    }

    // 創建文件輸入框
    function createFileInput() {
        if (document.getElementById("LikoImageUploaderInput")) {
            return document.getElementById("LikoImageUploaderInput");
        }
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

    // 觸發文件選擇
    function triggerFileSelect() {
        if (CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請先加入聊天室", 3000, "#FFA500");
            return;
        }
        createFileInput().click();
    }

    // PC 拖曳圖片上傳
    document.addEventListener("drop", async (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                const url = await uploadImage(file);
                if (url) sendToChat(url);
            } else {
                ChatRoomSendLocalStyled("❌ 請拖曳圖片文件", 3000, "#ff4444");
            }
        }
    });

    // 輸入框貼上上傳
    // 修復：
    // 1. 先掃描有無圖片，確認後才 preventDefault，避免 async 裡太晚呼叫
    // 2. getAsString 只對 kind==="string" 的 item 呼叫，避免永遠不 resolve 的 Promise 卡住事件系統
    // 3. 移除 console.info(item) debug 殘留
    document.addEventListener("paste", async (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        const inputElement = document.getElementById("InputChat");
        if (!inputElement || document.activeElement !== inputElement || !e.clipboardData) return;

        // 先檢查有沒有圖片，有才攔截事件
        const items = Array.from(e.clipboardData.items || []);
        const hasImage = items.some(item => item.type.startsWith("image/"));
        if (!hasImage) return; // 沒有圖片就完全不干涉，讓 BC 正常處理

        e.preventDefault(); // 確認有圖片後才攔截，且在 async 之前同步呼叫

        const contents = [];

        // 處理 files（部分瀏覽器會在這裡）
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            for (const file of e.clipboardData.files) {
                if (file.type.startsWith("image/")) {
                    const url = await uploadImage(file);
                    if (url) contents.push(url);
                }
            }
        }

        // 處理 items
        for (const item of items) {
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    const url = await uploadImage(file);
                    if (url) contents.push(url);
                }
            } else if (item.kind === "string") {
                // 修復：只對 kind==="string" 呼叫 getAsString，避免永遠 pending 的 Promise
                await new Promise(resolve => {
                    item.getAsString(text => {
                        if (text.trim()) contents.push(text.trim());
                        resolve();
                    });
                });
            }
            // kind==="file" 但非圖片（例如其他二進位）：直接跳過
        }

        if (contents.length > 0) {
            inputElement.value = contents.join(" ");
        }
    });

    document.addEventListener("dragover", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        }
    });

    // /img 指令處理
    function handleImgCommand(text) {
        const args = text.trim().split(/\s+/);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            const hostNames = { litterbox: "Litterbox", uguu: "Uguu", imgbb: "ImgBB", cloudflare: "Cloudflare R2", tmpfiles: "TmpFiles" };
            const hostTimes = { uguu: "3小時", tmpfiles: "60分鐘", litterbox: "12小時", cloudflare: "30分鐘", imgbb: "12小時" };
            const currentHost = hostNames[imageHost] || imageHost;
            const currentTime = hostTimes[imageHost] || "12小時";
            ChatRoomSendLocal(
                `🖼️圖片上傳說明 | Image upload illustrate🖼️\n` +
                `        當前設定(Current): 🌐${currentHost} 📌${currentTime}\n\n` +
                `/img up - 上傳圖片 | UPload image\n` +
                `/img web [litterbox|uguu|imgbb|tmpfiles|cloudflare]\n` +
                `               └選擇圖床 | Set img host\n\n` +
                `支援 | Support:\n` +
                `• 可以拖曳圖片上傳 | You can direct drag & drop\n` +
                `• 格式(Format): JPG/PNG/GIF/BMP/WEBP\n` +
                `• 大小(Size): Litterbox(100MB) | Uguu(128MB) | ImgBB(32MB) | TmpFiles(100MB) | Cloudflare(10MB)\n` +
                `• 時間(Time): Litterbox(12HR) | Uguu(3HR) | ImgBB(12HR) | TmpFiles(1HR) | Cloudflare(30Min)\n` +
                `✦建議使用(suggestion) litterbox > tmpfiles > uguu > imgbb\n` +
                `✦ImgBB使用私人API請珍惜使用，如果過期將不會再更新\n` +
                `  └Use private API. If expired, will not be updated.`
                , 30000
            );
            return;
        }

        if (sub === "up") {
            triggerFileSelect();
        } else if (sub === "web" && args[1]) {
            const validHosts = ["litterbox", "uguu", "imgbb", "tmpfiles", "cloudflare"];
            if (validHosts.includes(args[1])) {
                imageHost = args[1];
                saveSettings();
                const hostNames = { litterbox: "Litterbox", uguu: "Uguu", imgbb: "ImgBB", cloudflare: "Cloudflare R2", tmpfiles: "TmpFiles" };
                const hostTimes = { litterbox: " (保存12小時)", uguu: " (保存3小時)", imgbb: " (保存12小時)", cloudflare: " (保存30分鐘)", tmpfiles: " (保存60分鐘)" };
                ChatRoomSendLocalStyled(`✅ 已設定圖床為 ${hostNames[args[1]]}${hostTimes[args[1]] || ""}`, 3000, "#50C878");
            } else {
                ChatRoomSendLocalStyled("❌ 圖床參數必須是 litterbox/uguu/imgbb/tmpfiles/cloudflare", 5000, "#ff4444");
            }
        } else {
            ChatRoomSendLocalStyled("❌ 未知子指令，使用 /img help 查詢", 4000, "#ff4444");
        }
    }

    // Hook ChatRoomLoad
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                next(args);
                setTimeout(() => {
                    loadSettings();
                    if (!window.LikoImageUploaderWelcomed) {
                        ChatRoomSendLocalStyled(
                            `🖼️ Liko 圖片上傳器 v${modversion} 載入！使用(use) /img help 查看說明`,
                            5000
                        );
                        window.LikoImageUploaderWelcomed = true;
                    }
                }, 1000);
            });
        }
    }

    // 初始化
    async function initialize() {
        console.log("[IMG] 插件啟動中...");
        const ok = await waitForBcModSdk();
        if (!ok) {
            console.error("[IMG] bcModSdk 載入失敗");
            return;
        }
        await loadToastSystem();
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko's Image Uploader",
                fullName: 'BC - Image Uploader',
                version: modversion,
                repository: '圖片拖曳上傳並分享 | Image to litterbox/uguu/imgbb/tmpfiles and share'
            });
        } catch (e) {
            console.error("[IMG] 初始化 modApi 失敗:", e.message);
        }
        loadSettings();
        CommandCombine([{
            Tag: "img",
            Description: "圖片上傳 (/img help 查看說明)",
            Action: handleImgCommand
        }]);
        hookChatRoomLoad();
        console.log("[IMG]✅插件已載入完成");
    }

    initialize();
})();
