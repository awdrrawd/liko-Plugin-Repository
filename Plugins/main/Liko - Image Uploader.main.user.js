// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.1
// @description  Bondage Club - 上傳圖片到圖床並分享網址
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js
// @run-at       document-end
// ==/UserScript==

(function () {
    let modApi = null;
    const modversion = "1.1";
    let deleteTime = "12h"; // 預設保存時間為12小時
    let imageHost = "litterbox"; // 預設圖床為 Litterbox（主力）

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
            const version = (window.GM_info?.script?.version) || "Injected";
            const toastUrl = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_toast_system.user.js`;
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

    // 檢查文件大小 (限制為10MB)
    function isValidFileSize(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        return file.size <= maxSize;
    }

    // 將時間字串轉換為秒數 (用於 ImgBB)
    function timeToSeconds(timeStr) {
        switch(timeStr) {
            case "12h": return 12 * 60 * 60; // 43200 秒
            case "24h": return 24 * 60 * 60; // 86400 秒
            case "72h": return 72 * 60 * 60; // 259200 秒
            default: return 12 * 60 * 60; // 預設12小時
        }
    }

    // 從 OnlineSettings 載入設定
    function loadSettings() {
        if (Player && Player.OnlineSettings && Player.OnlineSettings.LikoImageUploader) {
            const settings = Player.OnlineSettings.LikoImageUploader;
            imageHost = settings.imageHost || "litterbox";
            deleteTime = settings.deleteTime || "12h";
            console.log("[IMG] 從 OnlineSettings 載入設定:", { imageHost, deleteTime });
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
        Player.OnlineSettings.LikoImageUploader = {
            imageHost: imageHost,
            deleteTime: deleteTime
        };
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSettings: Player.OnlineSettings });
            console.log("[IMG] 設定已保存到 OnlineSettings:", Player.OnlineSettings.LikoImageUploader);
        } else {
            console.warn("[IMG] ServerAccountUpdate.QueueData 不可用，設定未同步");
            ChatRoomSendLocalStyled("⚠️ 無法同步設定，模組可能干擾", 4000, "#FFA500");
        }
    }

    // 上傳到 Litterbox（主力圖床）
    async function uploadToLitterbox(file, time = deleteTime) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 4000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file)) {
            ChatRoomSendLocalStyled("❌ 圖片過大 (最大10MB)", 4000, "#ff4444");
            return null;
        }

        const form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("time", time);
        form.append("fileToUpload", file);

        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Litterbox...", 2000, "#FFA500");
            const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
                method: "POST",
                body: form
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const text = (await res.text()).trim();
            console.log("[IMG] Litterbox response:", text);
            if (!text.startsWith("http")) {
                throw new Error(`Litterbox API 返回錯誤: ${text}`);
            }
            return text;
        } catch (err) {
            console.error("[IMG] Litterbox 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ 圖片上傳失敗: ${err.message} (請檢查 VPN 或網路連線)`, 4000, "#ff4444");
            return null;
        }
    }

    // 上傳到 Uguu（使用 Cloudflare Workers 代理）
    async function uploadToUguu(file) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 4000, "#ff4444");
            return null;
        }
        if (!isValidFileSize(file)) {
            ChatRoomSendLocalStyled("❌ 圖片過大 (最大10MB)", 4000, "#ff4444");
            return null;
        }

        const form = new FormData();
        form.append("files[]", file);

        // 請確保已替換為你的實際 Cloudflare Workers URL
        const proxyUrl = "https://bc-img-upload-uguu.awdrrawd1.workers.dev/";

        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 Uguu...", 2000, "#FFA500");
            const res = await fetch(proxyUrl, {
                method: "POST",
                body: form
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            const json = await res.json();
            console.log("[IMG] Uguu response:", json);
            if (!json.success || !json.files?.[0]?.url) {
                throw new Error(`Uguu API 返回錯誤: ${json.description || '未知錯誤'}`);
            }
            return json.files[0].url;
        } catch (err) {
            console.error("[IMG] Uguu 上傳失敗:", err);
            ChatRoomSendLocalStyled(`❌ 圖片上傳失敗: ${err.message} (請檢查代理 URL 或 VPN)`, 4000, "#ff4444");
            return null;
        }
    }

    // 上傳到 ImgBB（使用 Cloudflare Workers 代理）
    async function uploadToImgBB(file, time = deleteTime) {
        if (!ChatRoomData || CurrentScreen !== "ChatRoom") {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return null;
        }
        if (!isValidImageFormat(file)) {
            ChatRoomSendLocalStyled("❌ 請使用正確的圖片格式 (JPG/PNG/GIF/BMP/WEBP)", 4000, "#ff4444");
            return null;
        }

        // ImgBB 支援 32MB
        const maxSize = 32 * 1024 * 1024; // 32MB
        if (file.size > maxSize) {
            ChatRoomSendLocalStyled("❌ 圖片過大 (ImgBB 最大32MB)", 4000, "#ff4444");
            return null;
        }

        const form = new FormData();
        form.append("file", file);
        // 加入過期時間參數 (轉換為秒數)
        form.append("expiration", timeToSeconds(time).toString());

        // 使用新的 ImgBB Cloudflare Workers URL
        const proxyUrl = "https://bc-img-upload-imgbb.awdrrawd1.workers.dev/";

        try {
            ChatRoomSendLocalStyled("📤 正在上傳圖片到 ImgBB...", 2000, "#FFA500");

            const res = await fetch(proxyUrl, {
                method: "POST",
                body: form
            });

            console.log(`[IMG] ImgBB Worker 回應狀態: ${res.status}`);
            console.log(`[IMG] ImgBB Worker Content-Type: ${res.headers.get('content-type')}`);

            // 先獲取回應文本，檢查是否為 JSON
            const responseText = await res.text();
            console.log(`[IMG] ImgBB Worker 原始回應: ${responseText.substring(0, 200)}...`);

            // 檢查是否為 HTML（表示 Worker 有問題）
            if (responseText.trim().toLowerCase().startsWith('<html')) {
                throw new Error("Worker 返回 HTML 頁面，可能是部署問題或域名配置錯誤");
            }

            // 嘗試解析 JSON
            let json;
            try {
                json = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error(`Worker 返回非 JSON 格式: ${responseText.substring(0, 100)}`);
            }

            console.log("[IMG] ImgBB 解析後回應:", json);

            // 檢查 HTTP 狀態
            if (!res.ok) {
                const errorMsg = json.error || `HTTP ${res.status}: ${res.statusText}`;
                throw new Error(errorMsg + (res.status === 429 ? ' (速率限制)' : ''));
            }

            // 檢查業務邏輯是否成功
            if (!json.success || !json.link) {
                const errorMsg = json.error || '未知錯誤';
                throw new Error(`ImgBB API 失敗: ${errorMsg}`);
            }

            return json.link;

        } catch (err) {
            console.error("[IMG] ImgBB 上傳失敗:", err);

            // 提供更詳細的錯誤信息
            let errorMessage = err.message;
            if (errorMessage.includes('HTML')) {
                errorMessage += " - 請檢查 Worker 部署狀態";
            } else if (errorMessage.includes('速率限制') || errorMessage.includes('429')) {
                errorMessage += " - 請稍後重試或切換其他圖床";
            } else if (errorMessage.includes('網路')) {
                errorMessage += " - 請檢查網路連線";
            }

            ChatRoomSendLocalStyled(`❌ ImgBB 上傳失敗: ${errorMessage}`, 5000, "#ff4444");
            return null;
        }
    }

    // 動態選擇圖床進行上傳
    async function uploadImage(file, time = deleteTime) {
        if (imageHost === "uguu") {
            return await uploadToUguu(file);
        } else if (imageHost === "imgbb") {
            return await uploadToImgBB(file, time);
        } else {
            return await uploadToLitterbox(file, time);
        }
    }

    // 發送網址到聊天室
    function sendToChat(url) {
        if (CurrentScreen !== "ChatRoom" || !ChatRoomData) {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return;
        }

        const timeText = imageHost === "uguu" ? "30天" :
        deleteTime === "12h" ? "12小時" :
        deleteTime === "24h" ? "24小時" :
        deleteTime === "72h" ? "72小時" : deleteTime;

        const hostText = imageHost === "litterbox" ? "Litterbox" :
        imageHost === "uguu" ? "Uguu" :
        imageHost === "imgbb" ? "ImgBB" : imageHost;

        const message = `${url} \n**🌐存放於 ${hostText} | 📌保存時間 ${timeText}**`;

        try {
            ServerSend("ChatRoomChat", {
                Content: message,
                Type: "Chat"
            });
            ChatRoomSendLocalStyled("✅ 圖片連結已發送", 3000, "#50C878");
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
                const url = await uploadImage(file, deleteTime);
                if (url) {
                    sendToChat(url);
                }
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

        const input = createFileInput();
        input.click();
    }

    // PC 拖曳圖片上傳
    document.addEventListener("drop", async (e) => {
        if (CurrentScreen !== "ChatRoom") return;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                const url = await uploadImage(file, deleteTime);
                if (url) sendToChat(url);
            } else {
                ChatRoomSendLocalStyled("❌ 請拖曳圖片文件", 3000, "#ff4444");
            }
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
            // 獲取當前設定的文字描述
            const currentHost = imageHost === "litterbox" ? "Litterbox" :
            imageHost === "uguu" ? "Uguu" :
            imageHost === "imgbb" ? "ImgBB" : imageHost;

            const currentTimeText = imageHost === "uguu" ? "30天 (固定)" :
            deleteTime === "12h" ? "12小時" :
            deleteTime === "24h" ? "24小時" :
            deleteTime === "72h" ? "72小時" : deleteTime;

            ChatRoomSendLocal(
                `🖼️圖片上傳說明 | Image upload illustrate🖼️\n` +
                `        當前設定(Current): 🌐${currentHost} 📌${currentTimeText}\n\n` +
                `/img up - 上傳圖片 | UPload image\n` +
                `/img time [12h|24h|72h] - 存放時間 | Set expiration time\n` +
                `/img web [litterbox|uguu|imgbb] - 選擇圖床 | Set img host\n\n` +
                `支援 | Support:\n` +
                `• 可以拖曳圖片上傳 | You can direct drag & drop\n` +
                `• 格式(Format): JPG/PNG/GIF/BMP/WEBP\n` +
                //`• 大小(Size): Litterbox/Uguu 10MB, ImgBB 32MB\n` +
                `• 時間(Time): Litterbox/ImgBB (12.24.72HR), Uguu 30day\n` +
                `✦建議使用(suggestion) litterbox > uguu > imgbb\n` +
                `✦imgbb使用私人API請珍惜使用，如果過期將不會再更新\n` +
                `  └Use private API. If they expire, they will not be updated.`
                ,30000
            );
            return;
        }

        if (sub === "up") {
            triggerFileSelect();
        } else if (sub === "time" && args[1]) {
            const validTimes = ["12h", "24h", "72h"];
            if (validTimes.includes(args[1])) {
                deleteTime = args[1];
                saveSettings();
                const timeText = args[1] === "12h" ? "12小時" :
                args[1] === "24h" ? "24小時" :
                args[1] === "72h" ? "72小時" : args[1];

                if (imageHost === "uguu") {
                    ChatRoomSendLocalStyled(`⚠️ 已設定保存時間為 ${timeText}，但 Uguu 固定為30天`, 4000, "#FFA500");
                } else {
                    ChatRoomSendLocalStyled(`✅ 已設定保存時間為 ${timeText}`, 3000, "#50C878");
                }
            } else {
                ChatRoomSendLocalStyled("❌ 時間參數必須是 12h/24h/72h", 4000, "#ff4444");
            }
        } else if (sub === "web" && args[1]) {
            const validHosts = ["litterbox", "uguu", "imgbb"];
            if (validHosts.includes(args[1])) {
                imageHost = args[1];
                saveSettings();
                const hostText = args[1] === "litterbox" ? "Litterbox" :
                args[1] === "uguu" ? "Uguu" :
                args[1] === "imgbb" ? "ImgBB" : args[1];

                const timeNote = args[1] === "uguu" ? " (固定30天)" : "";
                ChatRoomSendLocalStyled(`✅ 已設定圖床為 ${hostText}${timeNote}`, 3000, "#50C878");
            } else {
                ChatRoomSendLocalStyled("❌ 圖床參數必須是 litterbox/uguu/imgbb", 4000, "#ff4444");
            }
        } else {
            ChatRoomSendLocalStyled("❌ 未知子指令，使用 /img help 查詢", 4000, "#ff4444");
        }
    }

    // Hook ChatRoomLoad 來處理聊天室進入
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                next(args);
                setTimeout(() => {
                    loadSettings(); // 進入聊天室時載入設定
                    if (!window.LikoImageUploaderWelcomed) {
                        const currentHost = imageHost === "litterbox" ? "Litterbox" :
                        imageHost === "uguu" ? "Uguu" :
                        imageHost === "imgbb" ? "ImgBB" : imageHost;

                        const currentTime = imageHost === "uguu" ? "30天" :
                        deleteTime === "12h" ? "12小時" :
                        deleteTime === "24h" ? "24小時" :
                        deleteTime === "72h" ? "72小時" : deleteTime;

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
                repository: '圖片拖曳上傳並分享 | Image to litterbox/uguu/imgbb and share'
            });
        } catch (e) {
            console.error("[IMG] 初始化 modApi 失敗:", e.message);
        }

        // 載入初始設定
        loadSettings();

        // 註冊指令
        CommandCombine([{
            Tag: "img",
            Description: "圖片上傳 (/img help 查看說明)",
            Action: handleImgCommand
        }]);

        // 設置 Hook
        hookChatRoomLoad();

        console.log("[IMG]✅插件已載入完成");
    }

    initialize();
})();
