// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.4.1
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
    const modversion = "1.4.1";
    let imageHost = "litterbox";

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
            if (window.ChatRoomSendLocalStyled) {
                resolve();
                return;
            }
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

    // ──────────────────────────────────────────
    // 驗證：圖片格式
    // ──────────────────────────────────────────
    function isValidImageFormat(file) {
        const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        if (file.type && validFormats.includes(file.type.toLowerCase())) return true;
        const ext = file.name.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
    }

    // ──────────────────────────────────────────
    // 驗證：檔案大小
    // ──────────────────────────────────────────
    function isValidFileSize(file, host = imageHost) {
        const limits = {
            uguu:       128 * 1024 * 1024,
            imgbb:       32 * 1024 * 1024,
            tmpfiles:   100 * 1024 * 1024,
            cloudflare:  10 * 1024 * 1024,
            litterbox:  100 * 1024 * 1024,
        };
        return file.size <= (limits[host] ?? limits.litterbox);
    }

    function getMaxSizeText(host = imageHost) {
        const texts = { cloudflare: "10MB", uguu: "128MB", imgbb: "32MB", tmpfiles: "100MB", litterbox: "100MB" };
        return texts[host] ?? "100MB";
    }

    // ──────────────────────────────────────────
    // 設定：讀取 / 儲存
    // ──────────────────────────────────────────
    function loadSettings() {
        if (Player?.ExtensionSettings?.LikoImageUploader) {
            try {
                const saved = JSON.parse(Player.ExtensionSettings.LikoImageUploader);
                imageHost = saved.imageHost || "litterbox";
            } catch {
                console.warn("[IMG] ExtensionSettings 解析失敗，使用預設設定");
            }
        }
    }

    function saveSettings() {
        if (!Player?.ExtensionSettings) {
            console.warn("[IMG] 無法訪問 ExtensionSettings，設定未保存");
            ChatRoomSendLocalStyled("⚠️ 無法保存設定，請確保已登錄", 4000, "#FFA500");
            return;
        }
        Player.ExtensionSettings.LikoImageUploader = JSON.stringify({ imageHost });
        if (typeof ServerPlayerExtensionSettingsSync === 'function') {
            ServerPlayerExtensionSettingsSync("LikoImageUploader");
        } else {
            console.warn("[IMG] ServerPlayerExtensionSettingsSync 不可用");
            ChatRoomSendLocalStyled("⚠️ 無法同步設定，模組可能干擾", 4000, "#FFA500");
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
            console.error("[IMG] Litterbox 上傳失敗:", err);
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
            console.error("[IMG] Uguu 上傳失敗:", err);
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
            console.error("[IMG] ImgBB 上傳失敗:", err);
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
            console.error("[IMG] TmpFiles 上傳失敗:", err);
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
            console.error("[IMG] Cloudflare R2 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ R2 上傳失敗: ${err.message}`, 5000, "#ff4444");
            return null;
        }
    }

    // ──────────────────────────────────────────
    // 動態選擇圖床
    // ──────────────────────────────────────────
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
            console.error("[IMG] 發送訊息失敗:", e);
            ChatRoomSendLocalStyled("❌ 發送失敗，請重試", 3000, "#ff4444");
        }
    }

    // ──────────────────────────────────────────
    // 文件選擇輸入框
    // ──────────────────────────────────────────
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

    function triggerFileSelect() {
        if (CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請先加入聊天室", 3000, "#FFA500");
            return;
        }
        createFileInput().click();
    }

    // ──────────────────────────────────────────
    // 拖曳上傳
    // ──────────────────────────────────────────
    document.addEventListener("dragover", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
        }
    });

    document.addEventListener("drop", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

        const file = e.dataTransfer.files[0];
        if (!file || !file.type.startsWith("image/")) {
            ChatRoomSendLocalStyled("❌ 請拖曳圖片文件", 3000, "#ff4444");
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        (async () => {
            const url = await uploadImage(file);
            if (url) sendToChat(url);
        })();
    });

    // ──────────────────────────────────────────
    // 貼上上傳
    // ──────────────────────────────────────────
    document.addEventListener("paste", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        const inputElement = document.getElementById("InputChat");
        if (!inputElement || document.activeElement !== inputElement || !e.clipboardData) return;

        const items = Array.from(e.clipboardData.items || []);
        const hasImage = items.some(item => item.type.startsWith("image/"));
        if (!hasImage) return;

        e.preventDefault();
        e.stopPropagation();

        (async () => {
            const contents = [];

            if (e.clipboardData.files && e.clipboardData.files.length > 0) {
                for (const file of e.clipboardData.files) {
                    if (file.type.startsWith("image/")) {
                        const url = await uploadImage(file);
                        if (url) contents.push(url);
                    }
                }
            }

            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        const url = await uploadImage(file);
                        if (url) contents.push(url);
                    }
                } else if (item.kind === "string") {
                    await new Promise(resolve => {
                        item.getAsString(text => {
                            if (text.trim()) contents.push(text.trim());
                            resolve();
                        });
                    });
                }
            }

            if (contents.length > 0) {
                inputElement.value = contents.join(" ");
            }
        })();
    });

    // ──────────────────────────────────────────
    // /img 指令處理
    // ──────────────────────────────────────────
    function handleImgCommand(text) {
        const args = text.trim().split(/\s+/);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            const hostNames = { litterbox: "Litterbox", uguu: "Uguu", imgbb: "ImgBB", cloudflare: "Cloudflare R2", tmpfiles: "TmpFiles" };
            const hostTimes = { uguu: "3小時", tmpfiles: "60分鐘", litterbox: "12小時", cloudflare: "30分鐘", imgbb: "12小時" };
            ChatRoomSendLocal(
                `🖼️圖片上傳說明 | Image upload illustrate🖼️\n` +
                `        當前設定(Current): 🌐${hostNames[imageHost] || imageHost} 📌${hostTimes[imageHost] || "12小時"}\n\n` +
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
            return true;
        }

        if (sub === "up") {
            triggerFileSelect();
            return true;
        }

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

        ChatRoomSendLocalStyled("❌ 未知子指令，使用 /img help 查詢", 4000, "#ff4444");
        return true;
    }

    // ──────────────────────────────────────────
    // Hook ChatRoomLoad
    // 修正：ChatRoomLoad 不一定是 async，用相容寫法避免 .then() 報錯
    // ──────────────────────────────────────────
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                const result = next(args);
                setTimeout(() => {
                    try {
                        loadSettings();
                        if (!window.LikoImageUploaderWelcomed) {
                            ChatRoomSendLocalStyled(
                                `🖼️ Liko 圖片上傳器 v${modversion} 載入！使用(use) /img help 查看說明`,
                                5000
                            );
                            window.LikoImageUploaderWelcomed = true;
                        }
                    } catch (e) {
                        console.error("[IMG] ChatRoomLoad 延遲處理錯誤:", e);
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
        console.log("[IMG] ✅ 插件已載入完成");
    }

    initialize();
})();
