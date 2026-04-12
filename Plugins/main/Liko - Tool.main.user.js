// ==UserScript==
// @name         Liko - Tool
// @name:zh      Liko的工具包
// @namespace    https://likolisu.dev/
// @version      1.4.0
// @description  Bondage Club - Likolisu's tool (R121 Compatible)
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
    const modversion = "1.4.0";

    const rpBtnX    = 955;
    const rpBtnY    = 855;
    const rpBtnSize = 45;
    const rpIconUrl = "https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/likorp.png";

    // ──────────────────────────────────────────
    // 雙語言系統
    // ──────────────────────────────────────────
    function isZh() {
        if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
            const l = TranslationLanguage.toLowerCase();
            return l === 'cn' || l === 'tw';
        }
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    const LANG = {
        zh: {
            // 通用
            close:        "關閉",
            confirm:      "確認",
            cancel:       "取消",
            noPermission: "無權限互動",
            notInRoom:    "不在房間內",
            unknown:      "未知",
            notInChat:    "不在聊天室",

            // Undo 面板
            undoTitle:       "外觀回滾",
            undoNoRecord:    "沒有外觀變更紀錄",
            undoChangedAt:   "變更時間",
            undoChangedBy:   "操作者",
            undoPrev:        "◀ 上一筆",
            undoNext:        "下一筆 ▶",
            undoApply:       "套用此狀態",
            undoCount:       "共",
            undoCountUnit:   "筆紀錄",
            undoApplyDone:   "外觀已回滾",
            undoApplySize:   "變更大小",

            // 指令訊息
            freeNoItem:      "沒有束縛物品",
            freeDone:        "解除束縛",
            freetotalDone:   "完全解除了所有束縛",
            unlockNone:      "沒有可移除的鎖",
            unlockDone:      "移除了所有鎖",
            lockNone:        "沒有可鎖定的束縛",
            lockDone:        "個束縛添加了",
            lockInvalid:     "無效的鎖名稱",
            lockAvailable:   "可用鎖",
            lockSpecify:     "請指定目標（例如 /lt fulllock [目標] [鎖名稱]）",
            wardrobeDone:    "已開啟衣櫃",
            clipboardFail:   "無法讀取剪貼簿",
            bcxInvalid:      "無效的 BCX 代碼",
            bcxDone:         "導入了 BCX 外觀",
            rpOn:            "RP模式已开啟",
            rpOff:           "RP模式已关閉",
            heightOn:        "身高劫持功能已啟用",
            heightOff:       "身高劫持功能已停用",
            sendFail:        "自訂動作發送失敗，可能有插件衝突",
            cmdFail:         "執行失敗",
            unknownCmd:      "未知指令",

            // getEverything
            geTitle:      "選擇增強功能",
            geItems:      "獲得所有道具",
            geMoney:      "設置金錢為 999,999",
            geSkills:     "所有技能升至 10 級",
            geItemsDone:  "個新物品已添加",
            geMoneyDone:  "金錢已設置為 999,999",
            geSkillsDone: "所有技能已升至 10 級",

            // free 選單
            freeTitle:    "選擇要移除的束縛",
            password:     "密碼",

            // help
            helpText: `莉柯莉絲工具 使用說明\n\n` +
            `/lt help              - 顯示此說明\n` +
            `/lt free [目標]       - 選擇移除束縛\n` +
            `/lt freetotal [目標]  - 移除所有束縛\n` +
            `/lt bcximport [目標]  - 導入 BCX 外觀\n` +
            `/lt fullunlock [目標] - 移除所有鎖\n` +
            `/lt fulllock [目標] [鎖名稱] - 添加鎖\n` +
            `/lt undo [目標]       - 外觀回滾\n` +
            `/lt rpmode            - 切換 RP 模式\n` +
            `/lt height            - 切換身高固定\n` +
            `/lt geteverything     - 增強功能\n` +
            `/lt wardrobe          - 開啟衣櫃\n` +
            `提示：點擊右上角 🔰 快速切換 RP 模式`,

            // 載入訊息
            loaded: "莉柯莉絲工具 v{v} 載入！使用 /lt help 查看說明",
        },
        en: {
            close:        "Close",
            confirm:      "Confirm",
            cancel:       "Cancel",
            noPermission: "No permission to interact with",
            notInRoom:    "is not in the room",
            unknown:      "Unknown",
            notInChat:    "Not in chat room",

            undoTitle:       "Appearance Rollback",
            undoNoRecord:    "No appearance change records",
            undoChangedAt:   "Changed at",
            undoChangedBy:   "Changed by",
            undoPrev:        "◀ Previous",
            undoNext:        "Next ▶",
            undoApply:       "Apply this state",
            undoCount:       "",
            undoCountUnit:   "records",
            undoApplyDone:   "Appearance rolled back",
            undoApplySize:   "Change size",

            freeNoItem:      "has no restrained items",
            freeDone:        "removed restraints",
            freetotalDone:   "fully released all restraints of",
            unlockNone:      "has no removable locks",
            unlockDone:      "removed all locks from",
            lockNone:        "has no lockable restraints",
            lockDone:        "restraints locked with",
            lockInvalid:     "Invalid lock name",
            lockAvailable:   "Available locks",
            lockSpecify:     "Please specify a target (e.g. /lt fulllock [target] [lock name])",
            wardrobeDone:    "Wardrobe opened",
            clipboardFail:   "Cannot read clipboard",
            bcxInvalid:      "Invalid BCX code",
            bcxDone:         "imported BCX appearance for",
            rpOn:            "RP Mode enabled",
            rpOff:           "RP Mode disabled",
            heightOn:        "Height hijack enabled",
            heightOff:       "Height hijack disabled",
            sendFail:        "Custom action failed, possible plugin conflict",
            cmdFail:         "Command failed",
            unknownCmd:      "Unknown command",

            geTitle:      "Select enhancement",
            geItems:      "Get all items",
            geMoney:      "Set money to 999,999",
            geSkills:     "Max all skills to level 10",
            geItemsDone:  "new items added",
            geMoneyDone:  "Money set to 999,999",
            geSkillsDone: "All skills maxed to level 10",

            freeTitle:    "Select restraints to remove",
            password:     "Password",

            helpText: `Liko Tool Help\n\n` +
            `/lt help              - Show this help\n` +
            `/lt free [target]     - Select restraints to remove\n` +
            `/lt freetotal [target]- Remove all restraints\n` +
            `/lt bcximport [target]- Import BCX appearance\n` +
            `/lt fullunlock [target]-Remove all locks\n` +
            `/lt fulllock [target] [lock] - Add lock\n` +
            `/lt undo [target]     - Rollback appearance\n` +
            `/lt rpmode            - Toggle RP mode\n` +
            `/lt height            - Toggle height hijack\n` +
            `/lt geteverything     - Enhancement menu\n` +
            `/lt wardrobe          - Open wardrobe\n` +
            `Tip: Click 🔰 in the top-right to toggle RP mode`,

            loaded: "Liko Tool v{v} loaded! Use /lt help for help",
        }
    };

    function t(key, vars = {}) {
        const lang = isZh() ? LANG.zh : LANG.en;
        let str = lang[key] || key;
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace(`{${k}}`, v);
        }
        return str;
    }

    // ──────────────────────────────────────────
    // 等待系列（無超時）
    // ──────────────────────────────────────────
    function waitForBcModSdk() {
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    function waitFor(condition) {
        return new Promise(resolve => {
            const check = () => {
                if (condition()) resolve();
                else setTimeout(check, 500);
            };
            check();
        });
    }

    // ──────────────────────────────────────────
    // 初始化 modApi
    // ──────────────────────────────────────────
    async function initializeModApi() {
        await waitForBcModSdk();
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko's tool",
                fullName: "Liko's tool",
                version: modversion,
                repository: '莉柯莉絲的工具包'
            });
            console.log("🐈‍⬛ [LT] ✅ modApi 初始化完成");
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 初始化 modApi 失敗:", e.message);
        }
    }

    // ──────────────────────────────────────────
    // 載入 Toast 系統
    // ──────────────────────────────────────────
    function loadToastSystem() {
        return new Promise((resolve, reject) => {
            if (window.ChatRoomSendLocalStyled) { resolve(); return; }
            const script = document.createElement('script');
            script.src = `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js`;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Toast 載入失敗"));
            document.head.appendChild(script);
        });
    }

    // ──────────────────────────────────────────
    // 初始化儲存
    // ──────────────────────────────────────────
    function initializeStorage() {
        if (!Player.LikoTool) {
            Player.LikoTool = { bypassActivities: false };
        }
        if (!Player.OnlineSharedSettings) {
            Player.OnlineSharedSettings = {};
        }
        if (!Player.OnlineSharedSettings.LikoTOOL) {
            Player.OnlineSharedSettings.LikoTOOL = { RPmode: 0, height: 0 };
        }
        if (typeof Player.OnlineSharedSettings.LikoTOOL.RPmode === 'undefined') {
            Player.OnlineSharedSettings.LikoTOOL.RPmode = 0;
        }
        if (typeof Player.OnlineSharedSettings.LikoTOOL.height === 'undefined') {
            Player.OnlineSharedSettings.LikoTOOL.height = 0;
        }
    }

    // ──────────────────────────────────────────
    // RP 模式
    // ──────────────────────────────────────────
    function getRpMode(character) {
        if (!character) return false;
        if (character.IsPlayer && character.IsPlayer()) {
            return Player.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
        }
        return character.OnlineSharedSettings?.LikoTOOL?.RPmode === 1;
    }

    function setRpMode(enabled) {
        if (!Player.OnlineSharedSettings) Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
        Player.OnlineSharedSettings.LikoTOOL.RPmode = enabled ? 1 : 0;
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
    }

    // ──────────────────────────────────────────
    // 身高劫持
    // ──────────────────────────────────────────
    const heightRestoreCounter = {}; // { memberNumber: { timestamps: [] } }

    function hijackCharacterHeight(C) {
        if (!C || C._heightHijacked) return;
        C._realHeightRatio    = C.HeightRatio;
        C._realHeightModifier = C.HeightModifier;
        if (C.HeightRatio < 0.81 || C.HeightRatio > 1) {
            C.HeightRatio = 1.0;
        }
        C.HeightModifier  = 0;
        C._heightHijacked = true;
    }

    function restoreCharacterHeight(C) {
        if (!C?._heightHijacked) return;
        C.HeightRatio    = C._realHeightRatio;
        C.HeightModifier = C._realHeightModifier;
        delete C._realHeightRatio;
        delete C._realHeightModifier;
        delete C._heightHijacked;
        // 清除計數器
        const id = C.MemberNumber;
        if (heightRestoreCounter[id]) {
            delete heightRestoreCounter[id];
        }
    }

    // ──────────────────────────────────────────
    // Canvas：繪製 RP 圖標
    // ──────────────────────────────────────────
    function drawRpIcon(C, CharX, CharY, Zoom) {
        if (!getRpMode(C)) return;
        const offsetY = (C.IsKneeling && C.IsKneeling()) ? 300 : 40;
        DrawImageResize(rpIconUrl, CharX + 340 * Zoom, CharY + offsetY * Zoom, 45 * Zoom, 50 * Zoom);
    }

    // ──────────────────────────────────────────
    // 工具函數
    // ──────────────────────────────────────────
    function ChatRoomSendLocal(message, sec = 0) {
        if (CurrentScreen !== "ChatRoom") { console.warn("🐈‍⬛ [LT] ❗", t('notInChat')); return; }
        try {
            ChatRoomMessage({
                Type: "LocalMessage",
                Sender: Player.MemberNumber,
                Content: `<font color="#FF69B4">[LT] ${message}</font>`,
                Timeout: sec
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 發送本地訊息錯誤:", e.message);
        }
    }

    function getPlayer(identifier) {
        if (!identifier || identifier.trim() === "") return Player;
        if (typeof identifier === "number" || /^\d+$/.test(identifier)) {
            return ChatRoomCharacter?.find(c => c.MemberNumber === parseInt(identifier)) || Player;
        }
        return ChatRoomCharacter?.find(c =>
                                       c.Name.toLowerCase()         === identifier.toLowerCase() ||
                                       c.Nickname?.toLowerCase()    === identifier.toLowerCase() ||
                                       c.AccountName.toLowerCase()  === identifier.toLowerCase()
                                      ) || Player;
    }

    function getNickname(character) {
        return character?.Nickname || character?.Name || character?.AccountName || t('unknown');
    }

    function chatSendCustomAction(message) {
        if (CurrentScreen !== "ChatRoom") return;
        try {
            ServerSend("ChatRoomChat", {
                Type: "Action",
                Content: "CUSTOM_SYSTEM_ACTION",
                Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: message }]
            });
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 自訂動作發送錯誤:", e.message);
            ChatRoomSendLocal(t('sendFail'));
        }
    }

    function hasBCItemPermission(target) {
        if (Player.LikoTool?.bypassActivities) return true;
        return typeof ServerChatRoomGetAllowItem === "function"
            ? ServerChatRoomGetAllowItem(Player, target)
        : true;
    }

    // ──────────────────────────────────────────
    // UI 樣式注入（CFT 風格）
    // ──────────────────────────────────────────
    function injectLtStyles() {
        if (document.getElementById("lt-styles")) return;
        const s = document.createElement("style");
        s.id = "lt-styles";
        s.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600&display=swap');

        .lt-panel, .lt-panel * {
            box-sizing: border-box;
            font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            user-select: none; -webkit-user-select: none;
        }

        /* ── 面板 ── */
        .lt-panel {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            min-width: 340px; max-width: 600px; max-height: 90vh;
            background: rgba(16,20,32,0.97);
            backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 20px; z-index: 99999;
            display: flex; flex-direction: column;
            box-shadow: 0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(180,100,220,0.08);
            color: #d8e6f8; font-size: 13px; overflow: hidden;
        }

        /* ── Header ── */
        .lt-header {
            background: linear-gradient(135deg, #4a1280 0%, #9b3dd4 100%);
            padding: 13px 15px; display: flex; align-items: center;
            justify-content: space-between; cursor: grab; flex-shrink: 0;
            position: relative; overflow: hidden;
        }
        .lt-header:active { cursor: grabbing; }
        .lt-header::before {
            content:''; position:absolute; top:0; left:-100%; width:40%; height:100%;
            background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
            animation: lt-shimmer 5s ease-in-out infinite; pointer-events:none;
        }
        @keyframes lt-shimmer { 0%{transform:translateX(0)} 100%{transform:translateX(600%)} }
        .lt-title { font-size:14px; font-weight:600; color:#fff; position:relative; z-index:1; letter-spacing:0.02em; }
        .lt-hclose {
            background:rgba(255,255,255,0.14); border:none; border-radius:7px; color:#fff;
            width:27px; height:27px; cursor:pointer; font-size:14px;
            display:flex; align-items:center; justify-content:center;
            transition:background 0.18s; position:relative; z-index:1; flex-shrink:0;
        }
        .lt-hclose:hover { background:rgba(255,255,255,0.26); }

        /* ── Content ── */
        .lt-content {
            padding: 14px 15px 4px; overflow-y:auto; overflow-x:hidden; flex:1;
            scrollbar-width:thin; scrollbar-color:rgba(155,61,212,0.6) rgba(255,255,255,0.04);
        }
        .lt-content::-webkit-scrollbar { width:5px; }
        .lt-content::-webkit-scrollbar-thumb { background:linear-gradient(135deg,#4a1280,#9b3dd4); border-radius:3px; }

        .lt-section { margin-bottom:12px; }
        .lt-hr { height:1px; background:rgba(255,255,255,0.06); margin:4px 0 12px; }

        /* ── 通用按鈕列表 ── */
        .lt-btn-list { display:flex; flex-direction:column; gap:6px; }
        .lt-list-btn {
            width:100%; padding:10px 14px; text-align:left;
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
            border-radius:10px; color:#c0ccee; font-size:13px; cursor:pointer;
            display:flex; align-items:center; justify-content:space-between;
            transition:all 0.18s; font-family:inherit;
        }
        .lt-list-btn:hover { background:rgba(155,61,212,0.12); border-color:rgba(155,61,212,0.35); color:#d8b8ff; }
        .lt-list-btn.selected { background:rgba(155,61,212,0.2); border-color:rgba(155,61,212,0.6); color:#e0c8ff; }
        .lt-list-btn .lt-check { font-size:16px; color:rgba(155,61,212,0.4); transition:color 0.18s; }
        .lt-list-btn.selected .lt-check { color:#b070ff; }

        /* ── Undo 面板特有 ── */
        .lt-undo-layout { display:flex; gap:14px; }
        .lt-undo-canvas-wrap {
            flex-shrink:0; width:160px; background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow:hidden;
            display:flex; align-items:center; justify-content:center;
        }
        .lt-undo-canvas-wrap canvas { display:block; width:200px; height:400px; }
        .lt-undo-info { flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; overflow:hidden; }
        .lt-undo-info { flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; justify-content:space-between; }
        .lt-undo-meta {
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07);
            border-radius:10px; padding:10px 12px;
        }
        .lt-undo-meta-row { font-size:11px; color:#7a9cc0; margin-bottom:4px; }
        .lt-undo-meta-row:last-child { margin-bottom:0; }
        .lt-undo-meta-row span { color:#b0ccf0; font-weight:500; }
        .lt-undo-counter {
            text-align:center; font-size:12px; color:#9b3dd4; font-weight:600;
        }
        .lt-undo-nav { display:flex; gap:6px; }
        .lt-nav-btn {
            flex:1; padding:8px 4px;
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09);
            border-radius:9px; color:#7a7aaa; font-size:11px; cursor:pointer;
            transition:all 0.18s; font-family:inherit;
        }
        .lt-nav-btn:hover:not(:disabled) { background:rgba(155,61,212,0.12); border-color:rgba(155,61,212,0.35); color:#c090ff; }
        .lt-nav-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .lt-undo-apply {
            width:100%; padding:10px;
            background:linear-gradient(135deg,#4a1280,#9b3dd4); border:none;
            border-radius:10px; color:#fff; font-size:13px; font-weight:600;
            cursor:pointer; transition:all 0.2s; font-family:inherit; margin-top:auto;
        }
        .lt-undo-apply:hover { background:linear-gradient(135deg,#5e20a0,#b050e8); transform:translateY(-1px); box-shadow:0 4px 16px rgba(155,61,212,0.4); }

        /* ── Footer ── */
        .lt-footer {
            display:flex; gap:8px; padding:11px 15px;
            background:rgba(0,0,0,0.18); flex-shrink:0;
            border-top:1px solid rgba(255,255,255,0.05);
        }
        .lt-btn { flex:1; padding:9px; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; font-family:inherit; }
        .lt-btn-primary { background:linear-gradient(135deg,#4a1280,#9b3dd4); color:#fff; }
        .lt-btn-primary:hover { background:linear-gradient(135deg,#5e20a0,#b050e8); box-shadow:0 4px 16px rgba(155,61,212,0.35); transform:translateY(-1px); }
        .lt-btn-secondary { background:rgba(255,255,255,0.06); color:#607898; border:1px solid rgba(255,255,255,0.08); }
        .lt-btn-secondary:hover { background:rgba(255,255,255,0.1); color:#90a8c0; }

        /* 無障礙 */
        .lt-empty { text-align:center; color:#5a7a9a; font-size:13px; padding:20px 0; }
        `;
        document.head.appendChild(s);
    }

    // ──────────────────────────────────────────
    // 通用面板建構器（拖曳 + 關閉）
    // ──────────────────────────────────────────
    function createPanel(titleText, contentEl, footerEl) {
        injectLtStyles();
        const panel = document.createElement("div");
        panel.className = "lt-panel";

        // Header
        const header = document.createElement("div");
        header.className = "lt-header";
        const title = document.createElement("span");
        title.className = "lt-title";
        title.textContent = titleText;
        const hClose = document.createElement("button");
        hClose.className = "lt-hclose";
        hClose.textContent = "✕";
        hClose.onclick = () => panel.remove();
        header.appendChild(title);
        header.appendChild(hClose);
        panel.appendChild(header);

        // 拖曳
        let drag = { on: false, sx: 0, sy: 0, px: 0, py: 0 };
        header.addEventListener("mousedown", e => {
            if (e.target === hClose) return;
            drag.on = true; drag.sx = e.clientX; drag.sy = e.clientY;
            const r = panel.getBoundingClientRect();
            drag.px = r.left; drag.py = r.top;
            panel.style.transform = "none";
            panel.style.left = drag.px + "px";
            panel.style.top  = drag.py + "px";
            e.preventDefault();
        });
        const onMove = e => {
            if (!drag.on) return;
            panel.style.left = (drag.px + e.clientX - drag.sx) + "px";
            panel.style.top  = (drag.py + e.clientY - drag.sy) + "px";
        };
        const onUp = () => { drag.on = false; };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        panel.addEventListener("remove", () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        });

        // Content
        const content = document.createElement("div");
        content.className = "lt-content";
        content.appendChild(contentEl);
        panel.appendChild(content);

        // Footer
        if (footerEl) {
            const footer = document.createElement("div");
            footer.className = "lt-footer";
            footer.appendChild(footerEl);
            panel.appendChild(footer);
        }

        // 點擊外部關閉
        const clickOut = e => {
            if (!panel.contains(e.target)) {
                panel.remove();
                document.removeEventListener("mousedown", clickOut);
            }
        };
        setTimeout(() => document.addEventListener("mousedown", clickOut), 0);

        document.body.appendChild(panel);
        return panel;
    }

    // ──────────────────────────────────────────
    // 通用按鈕選單（取代舊 requestButtons）
    // ──────────────────────────────────────────
    function requestButtons(promptText, buttons, multiSelect = false) {
        return new Promise(resolve => {
            const listEl = document.createElement("div");
            listEl.className = "lt-btn-list";

            if (!buttons.length) {
                const empty = document.createElement("div");
                empty.className = "lt-empty";
                empty.textContent = promptText;
                listEl.appendChild(empty);
            }

            let selected = new Set();
            const btnEls = [];

            buttons.forEach(btn => {
                const el = document.createElement("button");
                el.className = "lt-list-btn";
                const textSpan = document.createElement("span");
                textSpan.textContent = btn.text;
                const check = document.createElement("span");
                check.className = "lt-check";
                check.textContent = "●";
                el.appendChild(textSpan);
                el.appendChild(check);

                if (multiSelect) {
                    el.onclick = () => {
                        if (selected.has(btn.text)) { selected.delete(btn.text); el.classList.remove("selected"); }
                        else { selected.add(btn.text); el.classList.add("selected"); }
                    };
                } else {
                    el.onclick = () => { panel.remove(); resolve(btn.text); };
                }
                listEl.appendChild(el);
                btnEls.push(el);
            });

            // Footer
            let footerEl = null;
            if (multiSelect) {
                footerEl = document.createElement("div");
                footerEl.style.cssText = "display:flex;gap:8px;width:100%;";
                const cancelBtn = document.createElement("button");
                cancelBtn.className = "lt-btn lt-btn-secondary";
                cancelBtn.textContent = t('cancel');
                cancelBtn.onclick = () => { panel.remove(); resolve([]); };
                const confirmBtn = document.createElement("button");
                confirmBtn.className = "lt-btn lt-btn-primary";
                confirmBtn.textContent = t('confirm');
                confirmBtn.onclick = () => { panel.remove(); resolve([...selected]); };
                footerEl.appendChild(cancelBtn);
                footerEl.appendChild(confirmBtn);
            }

            const panel = createPanel(promptText, listEl, footerEl);

            // ESC 關閉
            const onKey = e => {
                if (e.key === "Escape") {
                    panel.remove();
                    resolve(multiSelect ? [] : null);
                    document.removeEventListener("keydown", onKey);
                }
            };
            document.addEventListener("keydown", onKey);
            panel.addEventListener("remove", () => document.removeEventListener("keydown", onKey));
        });
    }

    // ──────────────────────────────────────────
    // 安全 hook 包裝
    // ──────────────────────────────────────────
    function safeHookFunction(functionName, priority, callback) {
        if (modApi && typeof modApi.hookFunction === 'function') {
            try { modApi.hookFunction(functionName, priority, callback); }
            catch (e) { console.error(`🐈‍⬛ [LT] ❌ Hook ${functionName} 失敗:`, e.message); }
        } else {
            console.warn(`🐈‍⬛ [LT] ❌ 無法 hook ${functionName}，modApi 不可用`);
        }
    }

    // ──────────────────────────────────────────
    // Undo 系統
    // ──────────────────────────────────────────
    const UNDO_MAX_PER_CHARACTER = 20;
    const undoHistory = {}; // { memberNumber: [ { timestamp, changedBy, bundle }, ... ] }

    function saveUndoSnapshot(target, changedByNumber) {
        const id = target?.MemberNumber;
        if (!id) return;

        const bundle = ServerAppearanceBundle(target.Appearance);
        if (!bundle?.length) return;

        // 跟上一筆相同就跳過
        if (undoHistory[id]?.length > 0) {
            const last = undoHistory[id].slice(-1)[0];
            if (JSON.stringify(last.bundle) === JSON.stringify(bundle)) return;
        }

        if (!undoHistory[id]) undoHistory[id] = [];
        undoHistory[id].push({
            timestamp: Date.now(),
            changedBy: changedByNumber ?? null,
            bundle
        });

        // 超過上限刪最舊
        if (undoHistory[id].length > UNDO_MAX_PER_CHARACTER) {
            undoHistory[id].shift();
        }
    }

    // 進房時掃描所有角色
    function scanAllCharacters() {
        if (!Array.isArray(ChatRoomCharacter)) return;
        ChatRoomCharacter.forEach(c => {
            if (c?.MemberNumber) saveUndoSnapshot(c, null);
        });
    }

    // ──────────────────────────────────────────
    // Undo 外觀預覽面板
    // ──────────────────────────────────────────
    async function openUndoPanel(target) {
        const id = target?.MemberNumber;
        const history = undoHistory[id];

        if (!history?.length) {
            ChatRoomSendLocal(`${getNickname(target)}：${t('undoNoRecord')}`);
            return;
        }

        injectLtStyles();

        let canvasCharacter = null;
        try {
            canvasCharacter = CharacterCreate(target.AssetFamily, CharacterType.NPC, "LT_UndoPreview");
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ 建立預覽角色失敗:", e.message);
        }

        let currentIndex = history.length - 1;

        // ── 頂部導航列 ──
        const topNavEl = document.createElement("div");
        topNavEl.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:10px;";

        const prevBtn = document.createElement("button");
        prevBtn.className = "lt-nav-btn";
        prevBtn.textContent = t('undoPrev');
        prevBtn.style.flex = "1";

        const counterEl = document.createElement("div");
        counterEl.style.cssText = "flex:1;text-align:center;font-size:12px;color:#9b3dd4;font-weight:600;white-space:nowrap;";

        const nextBtn = document.createElement("button");
        nextBtn.className = "lt-nav-btn";
        nextBtn.textContent = t('undoNext');
        nextBtn.style.flex = "1";

        // 時間資訊列
        const metaEl = document.createElement("div");
        metaEl.className = "lt-undo-meta";
        metaEl.style.marginBottom = "8px";

        const timeRow = document.createElement("div");
        timeRow.className = "lt-undo-meta-row";
        const byRow = document.createElement("div");
        byRow.className = "lt-undo-meta-row";
        metaEl.appendChild(timeRow);
        metaEl.appendChild(byRow);

        topNavEl.appendChild(prevBtn);
        topNavEl.appendChild(counterEl);
        topNavEl.appendChild(nextBtn);

        // ── Canvas 人物預覽（置中大圖） ──
        const canvasWrap = document.createElement("div");
        canvasWrap.style.cssText = `
            width:100%; display:flex; justify-content:center; align-items:center;
            background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08);
            border-radius:12px; overflow:hidden; margin-bottom:10px;
            height:360px; position:relative;
        `;

        const canvas = document.createElement("canvas");
        canvas.width  = 500;
        canvas.height = 1000;
        canvas.style.cssText = "width:220px;height:440px;display:block;";
        canvasWrap.appendChild(canvas);

        // ── 底部按鈕 ──
        const footerBtns = document.createElement("div");
        footerBtns.style.cssText = "width:100%;display:flex;gap:8px;";

        const applyBtn = document.createElement("button");
        applyBtn.className = "lt-btn lt-btn-primary";
        applyBtn.textContent = t('undoApply');
        applyBtn.style.flex = "1";

        const closeBtn = document.createElement("button");
        closeBtn.className = "lt-btn lt-btn-secondary";
        closeBtn.textContent = t('close');
        closeBtn.style.flex = "1";

        footerBtns.appendChild(applyBtn);
        footerBtns.appendChild(closeBtn);

        // ── 組合 content ──
        const contentEl = document.createElement("div");
        contentEl.appendChild(topNavEl);
        contentEl.appendChild(metaEl);
        contentEl.appendChild(canvasWrap);

        const panel = createPanel(
            `${t('undoTitle')} — ${getNickname(target)}`,
            contentEl,
            footerBtns
        );
        panel.style.width = "320px";

        // 關閉按鈕
        closeBtn.onclick = () => panel.remove();

        function renderPreview() {
            if (!canvasCharacter) return;
            try {
                const entry = history[currentIndex];
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvasCharacter.Appearance = entry.bundle.map(b =>
                                                              ServerBundledItemToAppearanceItem(target.AssetFamily, b)
                                                             );
                CharacterRefresh(canvasCharacter);
                DrawCharacter(canvasCharacter, 40, 100, 0.85, false, ctx);
            } catch (e) {
                console.error("🐈‍⬛ [LT] ❌ 預覽渲染失敗:", e.message);
            }
        }

        const renderInterval = setInterval(renderPreview, 200);

        function updateMeta() {
            const entry = history[currentIndex];
            const timeStr = new Date(entry.timestamp).toLocaleString();
            const byChar = entry.changedBy
            ? ChatRoomCharacter?.find(c => c.MemberNumber === entry.changedBy)
            : null;
            const byName = byChar
            ? getNickname(byChar)
            : entry.changedBy ? `#${entry.changedBy}` : "—";

            timeRow.innerHTML = `${t('undoChangedAt')}：<span>${timeStr}</span>`;
            byRow.innerHTML   = `${t('undoChangedBy')}：<span>${byName}</span>`;
            counterEl.textContent = `${currentIndex + 1} / ${history.length} ${t('undoCountUnit')}`;
            prevBtn.disabled = currentIndex <= 0;
            nextBtn.disabled = currentIndex >= history.length - 1;
        }

        prevBtn.onclick = () => {
            if (currentIndex > 0) { currentIndex--; updateMeta(); renderPreview(); }
        };
        nextBtn.onclick = () => {
            if (currentIndex < history.length - 1) { currentIndex++; updateMeta(); renderPreview(); }
        };

        applyBtn.onclick = () => {
            if (!hasBCItemPermission(target)) {
                ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`);
                return;
            }
            const entry = history[currentIndex];
            const oldBundle = ServerAppearanceBundle(target.Appearance);
            ServerSend("ChatRoomCharacterUpdate", {
                ID: target.ID === 0 ? target.OnlineID : target.AccountName.replace("Online-", ""),
                ActivePose: target.ActivePose,
                Appearance: entry.bundle
            });
            const sizeDiff = Math.abs(
                JSON.stringify(oldBundle).length - JSON.stringify(entry.bundle).length
            );
            const sizeKb = (sizeDiff / 1024).toFixed(1);
            ChatRoomSendLocal(`${getNickname(target)} ${t('undoApplyDone')}（${t('undoApplySize')}: ${sizeKb}kB）`);
            chatSendCustomAction(`${getNickname(Player)} 將 ${getNickname(target)} 的外觀回滾到 ${new Date(entry.timestamp).toLocaleTimeString()} 的狀態！`);
            undoHistory[id].splice(currentIndex + 1);
            panel.remove();
        };

        // 清理
        const obs = new MutationObserver(() => {
            if (!document.body.contains(panel)) {
                clearInterval(renderInterval);
                try { if (canvasCharacter) CharacterDelete(canvasCharacter.ID); } catch (e) {}
                obs.disconnect();
            }
        });
        obs.observe(document.body, { childList: true });

        updateMeta();
        renderPreview();
    }

    // ──────────────────────────────────────────
    // Hooks
    // ──────────────────────────────────────────
    function setupHooks() {

        // RP 模式：攔截 Action 訊息
        safeHookFunction("ServerSend", 20, (args, next) => {
            if (!getRpMode(Player) || CurrentScreen !== "ChatRoom") return next(args);
            const [messageType, data] = args;
            if (messageType === "ChatRoomChat" && data.Type === "Action") return;
            return next(args);
        });

        // 繪製 RP 圖標
        safeHookFunction("ChatRoomCharacterViewDrawOverlay", 10, (args, next) => {
            const result = next(args);
            const [C, CharX, CharY, Zoom] = args;
            if (C?.MemberNumber && CurrentScreen === "ChatRoom") {
                if (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null) {
                    drawRpIcon(C, CharX, CharY, Zoom);
                }
            }
            return result;
        });

        // 繪製 RP 按鈕
        safeHookFunction("ChatRoomMenuDraw", 4, (args, next) => {
            const result = next(args);
            if (!Player.LikoTool) initializeStorage();
            DrawButton(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize, "🔰",
                       getRpMode(Player) ? "Orange" : "Gray", "", "RP模式切換");
            return result;
        });

        // 點擊 RP 按鈕
        safeHookFunction("ChatRoomClick", 4, (args, next) => {
            if (!Player.LikoTool) initializeStorage();
            if (MouseIn(rpBtnX, rpBtnY, rpBtnSize, rpBtnSize)) {
                const newRpMode = !getRpMode(Player);
                setRpMode(newRpMode);
                if (typeof ChatRoomSendLocalStyled === 'function') {
                    ChatRoomSendLocalStyled(newRpMode ? `🔰 ${t('rpOn')}` : `🔰 ${t('rpOff')}`, 3000);
                } else {
                    ChatRoomSendLocal(newRpMode ? t('rpOn') : t('rpOff'));
                }
            }
            return next(args);
        });

        // 身高劫持：選取角色時
        safeHookFunction("CharacterSetCurrent", 10, (args, next) => {
            const [C] = args;
            const result = next(args);
            if (Player.OnlineSharedSettings?.LikoTOOL?.height === 1 && C?.MemberNumber) {
                hijackCharacterHeight(C);
            }
            return result;
        });

        // 身高劫持：角色刷新時重新劫持
        const heightRestoreCounter = {}; // { memberNumber: { timestamps: [] } }

        safeHookFunction("CharacterRefresh", 10, (args, next) => {
            const [C] = args;
            const result = next(args);

            if (
                Player.OnlineSharedSettings?.LikoTOOL?.height !== 1 ||
                !C?.MemberNumber ||
                CurrentCharacter?.MemberNumber !== C.MemberNumber
            ) return result;

            const id = C.MemberNumber;

            if (C._heightHijacked) {
                if (C.HeightRatio === C._realHeightRatio && C.HeightModifier === C._realHeightModifier) {
                    if (!heightRestoreCounter[id]) {
                        heightRestoreCounter[id] = { timestamps: [] };
                    }

                    const now = Date.now();
                    const windowMs = 200; // 只看最近 500ms

                    // 清掉過期的紀錄
                    heightRestoreCounter[id].timestamps = heightRestoreCounter[id].timestamps
                        .filter(t => now - t < windowMs);

                    // 加入這次
                    heightRestoreCounter[id].timestamps.push(now);

                    // 500ms 內超過 5 次才判定為抖動
                    if (heightRestoreCounter[id].timestamps.length >= 3) {
                        console.log(`🐈‍⬛ [LT] ⚠️ 身高劫持：${getNickname(C)} 短時間復原過多，暫停補正`);
                        return result;
                    }
                }

                delete C._heightHijacked;
                hijackCharacterHeight(C);

            } else {
                hijackCharacterHeight(C);
            }

            return result;
        });

        // 身高劫持：離開對話框時還原
        safeHookFunction("DialogLeave", 10, (args, next) => {
            restoreCharacterHeight(CurrentCharacter);
            return next(args);
        });

        // ── Undo：進房時掃描所有人 ──
        safeHookFunction("ChatRoomSync", -10, (args, next) => {
            const result = next(args);
            // 等一個 tick 讓 ChatRoomCharacter 填入資料後再掃描
            setTimeout(scanAllCharacters, 0);
            return result;
        });

        // ── Undo：新人加入時記錄 ──
        safeHookFunction("ChatRoomSyncMemberJoin", -10, (args, next) => {
            const result = next(args);
            const [data] = args;
            const newChar = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Character?.MemberNumber);
            if (newChar) saveUndoSnapshot(newChar, null);
            return result;
        });

        // ── Undo：本地物品更新 ──
        safeHookFunction("ChatRoomCharacterItemUpdate", -10, (args, next) => {
            const result = next(args);
            const [target] = args;
            saveUndoSnapshot(target, Player.MemberNumber);
            return result;
        });

        // ── Undo：收到伺服器單一物品同步 ──
        safeHookFunction("ChatRoomSyncItem", -10, (args, next) => {
            const result = next(args);
            const [data] = args;
            const target = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Item?.Target);
            if (target) saveUndoSnapshot(target, data?.Source);
            return result;
        });

        // ── Undo：收到伺服器整體角色同步 ──
        safeHookFunction("ChatRoomSyncSingle", -10, (args, next) => {
            const result = next(args);
            const [data] = args;
            const target = ChatRoomCharacter?.find(c => c.MemberNumber === data?.Character?.MemberNumber);
            if (target) saveUndoSnapshot(target, data?.SourceMemberNumber);
            return result;
        });
    }

    // ──────────────────────────────────────────
    // 指令：freetotal
    // ──────────────────────────────────────────
    function freetotal(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`); return true; }
        try {
            CharacterReleaseTotal(target);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} ${t('freetotalDone')} ${getNickname(target)}！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ freetotal 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：free
    // ──────────────────────────────────────────
    async function free(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`); return true; }

        const restraints = [];
        for (const group of AssetGroup) {
            if (group.Name.startsWith("Item")) {
                const item = InventoryGet(target, group.Name);
                if (item) {
                    const lock     = item.Property?.LockedBy ? `🔒${item.Property.LockedBy}` : "";
                    const password = item.Property?.Password || item.Property?.CombinationNumber || "";
                    const itemName = item.Craft?.Name || item.Asset?.Description || item.Asset?.Name || t('unknown');
                    restraints.push({
                        text: `${lock ? lock + " " : ""}${itemName} (${group.Description}${password ? `, ${t('password')}: ${password}` : ""})`,
                        group: group.Name
                    });
                }
            }
        }
        if (!restraints.length) { ChatRoomSendLocal(`${getNickname(target)} ${t('freeNoItem')}！`); return true; }

        const selected = await requestButtons(`${t('freeTitle')} — ${getNickname(target)}`, restraints, true);
        if (!selected.length) return true;

        try {
            selected.forEach(itemText => {
                const group = restraints.find(r => r.text === itemText)?.group;
                if (group) InventoryRemove(target, group);
            });
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} ${t('freeDone')} ${getNickname(target)} 的 ${selected.join("、")}`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ free 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：bcximport
    // ──────────────────────────────────────────
    async function bcxImport(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`); return true; }

        let bcxCode;
        try { bcxCode = await navigator.clipboard.readText(); }
        catch (e) { ChatRoomSendLocal(t('clipboardFail')); return true; }

        try {
            const appearance = JSON.parse(LZString.decompressFromBase64(bcxCode));
            if (!Array.isArray(appearance)) throw new Error("invalid");
            ServerAppearanceLoadFromBundle(target, target.AssetFamily, appearance, Player.MemberNumber);
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} ${t('bcxDone')} ${getNickname(target)}！`);
        } catch (e) {
            ChatRoomSendLocal(t('bcxInvalid'));
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：rpmode
    // ──────────────────────────────────────────
    function rpmode() {
        if (!Player.LikoTool) initializeStorage();
        const newRpMode = !getRpMode(Player);
        setRpMode(newRpMode);
        ChatRoomSendLocal(newRpMode ? t('rpOn') : t('rpOff'));
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：fullunlock
    // ──────────────────────────────────────────
    function fullUnlock(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`); return true; }

        try {
            const skipLocks = ["OwnerPadlock", "OwnerTimerPadlock", "LoversPadlock", "LoversTimerPadlock"];
            let count = 0;
            for (const a of target.Appearance) {
                if (a.Property?.LockedBy && !skipLocks.includes(a.Property.LockedBy)) {
                    InventoryUnlock(target, a);
                    count++;
                }
            }
            if (!count) { ChatRoomSendLocal(`${getNickname(target)} ${t('unlockNone')}！`); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} ${t('unlockDone')} ${getNickname(target)}！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ fullUnlock 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：geteverything
    // ──────────────────────────────────────────
    async function getEverything() {
        if (!Player.LikoTool) initializeStorage();
        const options = [
            { text: t('geItems') },
            { text: t('geMoney') },
            { text: t('geSkills') }
        ];
        const selected = await requestButtons(t('geTitle'), options, true);
        if (!selected.length) return true;

        try {
            if (selected.includes(t('geItems'))) {
                const ids = [];
                AssetFemale3DCG.forEach(group => {
                    group.Asset.forEach(item => {
                        if (item.Name && !Player.Inventory.some(inv => inv.Name === item.Name && inv.Group === group.Group) && item.InventoryID) {
                            InventoryAdd(Player, item.Name, group.Group, false);
                            ids.push(item.InventoryID);
                        }
                    });
                });
                ServerPlayerInventorySync();
                ChatRoomSendLocal(`${ids.length} ${t('geItemsDone')}！`);
            }
            if (selected.includes(t('geMoney'))) {
                Player.Money = 999999;
                ServerPlayerSync();
                ChatRoomSendLocal(`${t('geMoneyDone')}！`);
            }
            if (selected.includes(t('geSkills'))) {
                ["LockPicking", "Evasion", "Willpower", "Bondage", "SelfBondage", "Dressage", "Infiltration"]
                    .forEach(skill => SkillChange(Player, skill, 10, 0, true));
                ChatRoomSendLocal(`${t('geSkillsDone')}！`);
            }
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ getEverything 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：wardrobe
    // ──────────────────────────────────────────
    function wardrobe() {
        if (!Player.LikoTool) initializeStorage();
        try {
            ChatRoomAppearanceLoadCharacter(Player);
            ChatRoomSendLocal(t('wardrobeDone'));
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ wardrobe 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：fulllock
    // ──────────────────────────────────────────
    function fullLock(args) {
        if (!Player.LikoTool) initializeStorage();
        const params           = args.trim().split(/\s+/);
        const targetIdentifier = params[0] || "";
        const lockName         = params[1] || "";
        const target           = getPlayer(targetIdentifier);

        if (target === Player && !targetIdentifier) { ChatRoomSendLocal(t('lockSpecify')); return true; }
        if (!ChatRoomCharacter?.find(c => c.MemberNumber === target.MemberNumber)) {
            ChatRoomSendLocal(`${getNickname(target)} ${t('notInRoom')}！`); return true;
        }
        if (!hasBCItemPermission(target)) { ChatRoomSendLocal(`${t('noPermission')} ${getNickname(target)}。`); return true; }

        const itemMiscGroup = AssetGroupGet(Player.AssetFamily, "ItemMisc");
        if (!itemMiscGroup) return true;

        const validLocks = itemMiscGroup.Asset
        .filter(a => a.IsLock)
        .map(a => ({ Name: a.Name, Description: a.Description || a.Name }));
        const lock = validLocks.find(l =>
                                     l.Name.toLowerCase() === lockName.toLowerCase() ||
                                     l.Description.toLowerCase() === lockName.toLowerCase()
                                    );
        if (!lock) {
            ChatRoomSendLocal(`${t('lockInvalid')}：${lockName}。${t('lockAvailable')}：${validLocks.map(l => l.Description).join("、")}`);
            return true;
        }

        try {
            let count = 0;
            for (const item of target.Appearance) {
                const groupName = item.Asset?.Group?.Name || "";
                if (groupName.startsWith("Item") && item.Asset?.AllowLock !== false && !item.Property?.LockedBy) {
                    InventoryLock(target, item, { Asset: AssetGet(Player.AssetFamily, "ItemMisc", lock.Name) }, Player.MemberNumber);
                    count++;
                }
            }
            if (!count) { ChatRoomSendLocal(`${getNickname(target)} ${t('lockNone')}！`); return true; }
            ChatRoomCharacterUpdate(target);
            chatSendCustomAction(`${getNickname(Player)} 為 ${getNickname(target)} 的 ${count} ${t('lockDone')} ${lock.Description}！`);
        } catch (e) {
            console.error("🐈‍⬛ [LT] ❌ fullLock 錯誤:", e.message);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：height
    // ──────────────────────────────────────────
    function heightCommand() {
        if (!Player.OnlineSharedSettings)           Player.OnlineSharedSettings = {};
        if (!Player.OnlineSharedSettings.LikoTOOL) Player.OnlineSharedSettings.LikoTOOL = {};
        const enabled = Player.OnlineSharedSettings.LikoTOOL.height !== 1;
        Player.OnlineSharedSettings.LikoTOOL.height = enabled ? 1 : 0;
        if (typeof ServerAccountUpdate?.QueueData === 'function') {
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
        }
        ChatRoomSendLocal(enabled ? t('heightOn') : t('heightOff'));
        if (!enabled) restoreCharacterHeight(CurrentCharacter);
        return true;
    }

    // ──────────────────────────────────────────
    // 指令：undo
    // ──────────────────────────────────────────
    async function undoCommand(args) {
        if (!Player.LikoTool) initializeStorage();
        const target = getPlayer(args.trim());
        await openUndoPanel(target);
        return true;
    }

    // ──────────────────────────────────────────
    // 指令入口
    // ──────────────────────────────────────────
    function handleLtCommand(text) {
        if (!Player.LikoTool) initializeStorage();
        const args        = text.trim().split(/\s+/);
        const subCommand  = args[0]?.toLowerCase() || "";
        const commandText = args.slice(1).join(" ");

        if (!subCommand || subCommand === "help") {
            ChatRoomSendLocal(t('helpText'));
            return true;
        }

        const commands = {
            freetotal,
            free,
            bcximport:     bcxImport,
            rpmode,
            fullunlock:    fullUnlock,
            geteverything: getEverything,
            wardrobe,
            fulllock:      fullLock,
            height:        heightCommand,
            undo:          undoCommand,
        };

        if (commands[subCommand]) {
            try { commands[subCommand](commandText); }
            catch (e) {
                console.error(`🐈‍⬛ [LT] ❌ 命令 ${subCommand} 執行錯誤:`, e.message);
                ChatRoomSendLocal(`${t('cmdFail')}：/lt ${subCommand}`);
            }
        } else {
            ChatRoomSendLocal(`${t('unknownCmd')}：/lt ${subCommand}`);
        }
        return true;
    }

    // ──────────────────────────────────────────
    // 主初始化
    // ──────────────────────────────────────────
    async function initialize() {
        console.log("🐈‍⬛ [LT] ⌛ 開始初始化插件...");

        await initializeModApi();

        try { await loadToastSystem(); }
        catch (e) { console.warn("🐈‍⬛ [LT] ❌ Toast system 載入失敗，備用模式運行:", e.message); }

        console.log("🐈‍⬛ [LT] ⌛ 等待玩家登入...");
        await waitFor(() => {
            try { return typeof Player?.MemberNumber === "number"; }
            catch { return false; }
        });

        initializeStorage();
        setupHooks();

        const registerCommand = () => {
            CommandCombine([{
                Tag: "lt",
                Description: "Execute Liko Tool command",
                Action: handleLtCommand
            }]);
            console.log("🐈‍⬛ [LT] ✅ /lt 指令註冊成功");
        };

        if (typeof CommandCombine === "function") {
            try { registerCommand(); }
            catch (e) { console.error("🐈‍⬛ [LT] ❌ 註冊命令錯誤:", e.message); }
        } else {
            waitFor(() => typeof CommandCombine === "function").then(() => {
                try { registerCommand(); }
                catch (e) { console.error("🐈‍⬛ [LT] ❌ 延遲註冊命令錯誤:", e.message); }
            });
        }

        waitFor(() => CurrentScreen === "ChatRoom").then(() => {
            ChatRoomSendLocal(t('loaded', { v: modversion }), 30000);
        });

        console.log(`🐈‍⬛ [LT] ✅ 插件已載入 (v${modversion})`);
    }

    // ──────────────────────────────────────────
    // 卸載清理
    // ──────────────────────────────────────────
    function setupUnloadHandler() {
        if (modApi && typeof modApi.onUnload === 'function') {
            modApi.onUnload(() => {
                console.log("🐈‍⬛ [LT] 🗑️ 插件卸載...");
            });
        }
    }

    initialize().then(() => {
        setupUnloadHandler();
    }).catch(error => {
        console.error("🐈‍⬛ [LT] ❌ 初始化失敗:", error);
    });

})();
