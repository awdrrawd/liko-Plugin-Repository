// ==UserScript==
// @name         Liko - Image Uploader
// @name:zh      Liko的圖片上傳器
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Bondage Club - 上傳圖片到 litterbox 並分享網址
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    let modApi = null;
    let deleteTime = "12h"; // 預設保存時間改為12小時

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

    // 樣式化訊息顯示函數
    function ChatRoomSendLocalStyled(message, duration = 3000, color = "#ff69b4") {
        const msgEl = document.createElement("div");
        msgEl.textContent = message;
        msgEl.style.position = "fixed";
        msgEl.style.bottom = "20px";
        msgEl.style.left = "50%";
        msgEl.style.transform = "translateX(-50%)";
        msgEl.style.background = "rgba(0,0,0,0.7)";
        msgEl.style.color = color;
        msgEl.style.padding = "8px 15px";
        msgEl.style.borderRadius = "10px";
        msgEl.style.fontSize = "20px";
        msgEl.style.fontWeight = "bold";
        msgEl.style.opacity = "0";
        msgEl.style.transition = "opacity 0.5s, transform 0.5s";
        msgEl.style.zIndex = 9999;

        document.body.appendChild(msgEl);

        requestAnimationFrame(() => {
            msgEl.style.opacity = "1";
            msgEl.style.transform = "translateX(-50%) translateY(-50px)";
        });

        setTimeout(() => {
            msgEl.style.opacity = "0";
            msgEl.style.transform = "translateX(-50%) translateY(-20px)";
            setTimeout(() => msgEl.remove(), 500);
        }, duration);
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
        // fallback: 用檔名副檔名判斷
        const ext = file.name.split('.').pop().toLowerCase();
        return ['jpg','jpeg','png','gif','bmp','webp'].includes(ext);
    }

    // 檢查文件大小 (限制為10MB)
    function isValidFileSize(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        return file.size <= maxSize;
    }

    // 上傳到 Litterbox
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
        ChatRoomSendLocalStyled("📤 正在上傳圖片...", 2000, "#FFA500");

        const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
            method: "POST",
            body: form
        });

        const text = (await res.text()).trim();
        console.log("[IMG] Litterbox response:", text);

        if (!text.startsWith("http")) {
            throw new Error(`Litterbox API 返回錯誤: ${text}`);
        }

        return text;
    } catch (err) {
        console.error("[IMG] 上傳失敗:", err);
        ChatRoomSendLocalStyled("❌ 圖片上傳失敗，請檢查網路或參數！", 4000, "#ff4444");
        return null;
    }
}

    // 發送網址到聊天室
    function sendToChat(url) {
        if (CurrentScreen !== "ChatRoom" || !ChatRoomData) {
            ChatRoomSendLocalStyled("🚫 請加入聊天室後重新上傳圖片", 4000, "#ff4444");
            return;
        }

        // 獲取時間顯示文字
        const timeText = deleteTime === "12h" ? "12小時" :
                         deleteTime === "24h" ? "24小時" :
                         deleteTime === "72h" ? "72小時" : deleteTime;

        const message = `${url} \n**存放時間${timeText}** `;

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
                const url = await uploadToLitterbox(file, deleteTime);
                if (url) {
                    sendToChat(url);
                }
                // 清空input以便下次選擇同一個文件
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
    
        // 只有真的有檔案才阻止預設行為
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                const url = await uploadToLitterbox(file, deleteTime);
                if (url) sendToChat(url);
            } else {
                ChatRoomSendLocalStyled("❌ 請拖曳圖片文件", 3000, "#ff4444");
            }
        }
    });
    
    document.addEventListener("dragover", (e) => {
        if (CurrentScreen !== "ChatRoom") return;
    
        // 只有拖曳檔案才阻止
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
            ChatRoomSendLocal(
                `圖片上傳插件使用說明:\n` +
                `/img up - 選擇並上傳圖片\n` +
                `/img set [12h|24h|72h] - 設定圖片保存時間 (預設 12h)\n` +
                `PC: 可直接拖曳圖片上傳\n` +
                `支援格式: JPG/PNG/GIF/BMP/WEBP (最大10MB)`
            );
            return;
        }

        if (sub === "up") {
            triggerFileSelect();
        } else if (sub === "set" && args[1]) {
            const validTimes = ["12h", "24h", "72h"];
            if (validTimes.includes(args[1])) {
                deleteTime = args[1];
                const timeText = args[1] === "12h" ? "12小時" :
                                 args[1] === "24h" ? "24小時" :
                                 args[1] === "72h" ? "72小時" : args[1];
                ChatRoomSendLocalStyled(`✅ 已設定保存時間為 ${timeText}`, 3000, "#50C878");
            } else {
                ChatRoomSendLocalStyled("❌ 時間必須是 12h / 24h / 72h", 4000, "#ff4444");
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
                    // 首次進入聊天室顯示歡迎訊息
                    if (!window.LikoImageUploaderWelcomed) {
                        ChatRoomSendLocalStyled(
                            "🖼️ Liko 圖片上傳器 v1.0 已載入！使用 /img help 查看說明",
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

        try {
            modApi = bcModSdk.registerMod({
                name: 'Image Uploader',
                fullName: 'BC - Image Uploader',
                version: '1.0',
                repository: '圖片上傳 // Image to litterbox and share'
            });
        } catch (e) {
            console.error("[IMG] 初始化 modApi 失敗:", e.message);
        }

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
