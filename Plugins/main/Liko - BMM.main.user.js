// ==UserScript==
// @name         liko - BMM
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version 2.0.0
// @description  BC 地圖房迷你地圖
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20BMM.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20BMM.main.user.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    // 热重载/重复注入时清理上一实例的全局监听，避免重复 message/focus 监听导致重复确认框
    window.__bmmUnload = function () {
        try {
            if (window.__bmmOnMsg) window.removeEventListener("message", window.__bmmOnMsg);
            if (window.__bmmFocusHandler) window.removeEventListener("focus", window.__bmmFocusHandler);
            if (window.__bmmVisHandler) document.removeEventListener("visibilitychange", window.__bmmVisHandler);
        } catch (e) {}
        window.__bmmOnMsg = null; window.__bmmFocusHandler = null; window.__bmmVisHandler = null;
        window.__bmmClipLinked = false;
        if (window.Liko) window.Liko.BMM = null;
    };
    if (window.Liko.BMM) return;
    const MOD_VER = "2.0.0";
    window.Liko.BMM = MOD_VER;

    // ── i18n 多語言系統 ─────────────────────────────────────────────────────
    const BMM_I18N = {
        CN: {
            hdr_dblclick: "双击切换配色主题",
            key_bronze: "铜钥匙", key_silver: "银钥匙", key_gold: "金钥匙",
            btn_local: "局部", btn_full: "全图", btn_complete: "完整",
            tb_edit: "编辑", tb_save: "保存", tb_load: "载入", tb_export: "导出", tb_import: "导入",
            alert_no_map: "当前不在地图房间，无法获取地图",
            map_copied: "地图已复制到剪贴板，回游戏聊天框粘贴 /mappaste <串> 即可铺设",
            clip_import_title: "导入地图",
            clip_import_body: "即将用检测到的地图覆盖当前房间地图，并对所有房间成员生效。此操作不可撤销。",
            clip_import_from_editor: "来源：地图编辑器",
            clip_import_from_clipboard: "来源：系统剪贴板",
            clip_import_confirm: "确认导入",
            clip_import_cancel: "取消",
            clip_import_done: "地图已导入并广播到房间",
            clip_import_fail: "导入失败：{reason}",
            clip_import_empty: "未检测到有效的地图数据",
            alert_no_save: "当前不在地图房间，无法保存",
            save_prompt: "保存地图名称：",
            save_fail: "保存失败：",
            ov_title: "已保存的地图",
            ov_empty: "暂无保存的地图（进入地图房间后点「保存」即可）",
            ov_editor: "编辑器", ov_load: "载入", ov_delete: "删除",
            ov_del_confirm: "删除「{name}」？",
            ov_load_confirm: "确定将「{name}」载入当前房间？这将覆盖现有地图并对所有成员生效，不可撤销。",
            export_none: "没有已保存的地图",
            people_hdr: "房间内 {n} 人",
            ftr_click_tip: "点击查看房间内所有人",
            not_in_room: "当前不在地图房间内",
            no_drawimage: "找不到游戏绘图函数 DrawGetImage，无法使用「完整」模式",
            offline_name: "MiniMap",
        },
        TW: {
            hdr_dblclick: "雙擊切換配色主題",
            key_bronze: "銅鑰匙", key_silver: "銀鑰匙", key_gold: "金鑰匙",
            btn_local: "局部", btn_full: "全圖", btn_complete: "完整",
            tb_edit: "編輯", tb_save: "儲存", tb_load: "載入", tb_export: "匯出", tb_import: "匯入",
            alert_no_map: "目前不在地圖房間，無法取得地圖",
            map_copied: "地圖已複製到剪貼簿，回遊戲聊天框貼上 /mappaste <串> 即可鋪設",
            clip_import_title: "匯入地圖",
            clip_import_body: "即將用偵測到的地圖覆蓋目前房間地圖，並對所有房間成員生效。此操作不可撤銷。",
            clip_import_from_editor: "來源：地圖編輯器",
            clip_import_from_clipboard: "來源：系統剪貼簿",
            clip_import_confirm: "確認匯入",
            clip_import_cancel: "取消",
            clip_import_done: "地圖已匯入並廣播到房間",
            clip_import_fail: "匯入失敗：{reason}",
            clip_import_empty: "未偵測到有效的地圖資料",
            alert_no_save: "目前不在地圖房間，無法儲存",
            save_prompt: "儲存地圖名稱：",
            save_fail: "儲存失敗：",
            ov_title: "已儲存的地圖",
            ov_empty: "暫無儲存的地圖（進入地圖房間後點「儲存」即可）",
            ov_editor: "編輯器", ov_load: "載入", ov_delete: "刪除",
            ov_del_confirm: "刪除「{name}」？",
            ov_load_confirm: "確定將「{name}」載入當前房間？這將覆蓋現有地圖並對所有成員生效，不可撤銷。",
            export_none: "沒有已儲存的地圖",
            people_hdr: "房間內 {n} 人",
            ftr_click_tip: "點擊查看房間內所有人",
            not_in_room: "目前不在地圖房間內",
            no_drawimage: "找不到遊戲繪圖函式 DrawGetImage，無法使用「完整」模式",
            offline_name: "MiniMap",
        },
        EN: {
            hdr_dblclick: "Double-click to switch color theme",
            key_bronze: "Bronze Key", key_silver: "Silver Key", key_gold: "Gold Key",
            btn_local: "Local", btn_full: "Full", btn_complete: "Complete",
            tb_edit: "Edit", tb_save: "Save", tb_load: "Load", tb_export: "Export", tb_import: "Import",
            alert_no_map: "Not in a map room, cannot get map data",
            map_copied: "Map copied to clipboard. Paste /mappaste <string> into the game chat to lay it down",
            clip_import_title: "Import Map",
            clip_import_body: "This will overwrite the current room map with the detected map, affecting all room members. This cannot be undone.",
            clip_import_from_editor: "Source: Map Editor",
            clip_import_from_clipboard: "Source: System Clipboard",
            clip_import_confirm: "Confirm Import",
            clip_import_cancel: "Cancel",
            clip_import_done: "Map imported and broadcast to the room",
            clip_import_fail: "Import failed: {reason}",
            clip_import_empty: "No valid map data detected",
            alert_no_save: "Not in a map room, cannot save",
            save_prompt: "Save map name:",
            save_fail: "Save failed: ",
            ov_title: "Saved Maps",
            ov_empty: "No saved maps yet (enter a map room and click \"Save\")",
            ov_editor: "Editor", ov_load: "Load", ov_delete: "Delete",
            ov_del_confirm: 'Delete "{name}"?',
            ov_load_confirm: 'Load "{name}" into current room? This will overwrite the existing map for all members and cannot be undone.',
            export_none: "No saved maps to export",
            people_hdr: "{n} people in room",
            ftr_click_tip: "Click to see everyone in room",
            not_in_room: "Not currently in a map room",
            no_drawimage: "DrawGetImage not found, \"Complete\" mode unavailable",
            offline_name: "MiniMap",
        },
    };
    // 偵測 BC 語言設定；回退鏈：CN→TW→EN
    function _bmmLang() {
        try {
            const lang = typeof TranslationLanguage !== "undefined" ? TranslationLanguage : "";
            if (/^zh(-cn)?$/i.test(lang) || lang === "CN") return "CN";
            if (/^zh(-tw)?$/i.test(lang) || lang === "TW" || lang === "ZH") return "TW";
            if (/^en/i.test(lang) || lang === "EN") return "EN";
        } catch(e) {}
        // 回退：若 TranslationLanguage 不可用，嘗試從玩家偏好推斷
        try {
            if (typeof Preferences !== "undefined" && Preferences.Language) {
                const pl = Preferences.Language;
                if (pl === "CN" || pl === "zh-CN") return "CN";
                if (pl === "TW" || pl === "zh-TW") return "ZH"; // BC 用 ZH 代表繁中
                if (pl === "EN" || pl === "en") return "EN";
            }
        } catch(e) {}
        return "TW"; // 預設繁中（與原版一致）
    }
    let _bmmCurrentLang = _bmmLang();
    const _bmmDict = BMM_I18N[_bmmCurrentLang] || BMM_I18N.TW;
    function t(key, vars) {
        let s = _bmmDict[key] || BMM_I18N.TW[key] || BMM_I18N.EN[key] || key;
        if (vars) for (const [k,v] of Object.entries(vars)) s = s.replace(new RegExp('\\{'+k+'\\}','g'), v);
        return s;
    }

    const HDR_H = 36, FTR_H = 58, TOOLBAR_H = 30;
    const MAP_W = 40, MAP_H = 40, OBJ_START = 100, VIEW_RANGE = 10;
    const LOCAL_SIZE = 300;
    const FULL_SIZE  = 500;
    const COMPLETE_SIZE = 640; // "完整"模式：直接繪製遊戲貼圖，畫布給大一點比較看得清楚

    // ── 配色表（由 BMM 染色設定器匯出）───────────────────────────────────────
    const TILE_COLORS = {
        Floor: "#999999",
        FloorExterior: "#cee8bf",
        Wall: "#523319",
        Water: "#3c7cdd",
        default: "#707070",
    };

    const OBJECT_STYLES = {
        FloorDecoration:          { mode:"fill",       fill:"#ffcfa8", border:"#a08a5f" },
        FloorDecorationThemed:    { mode:"fill",       fill:"#becbfe", border:"#a08a5f" },
        FloorDecorationParty:     { mode:"fill",       fill:"#f8945d", border:"#a08a5f" },
        FloorDecorationCamping:   { mode:"fill",       fill:"#db9757", border:"#a08a5f" },
        FloorDecorationExpanding: { mode:"fill",       fill:"#ffb3e3", border:"#ad528c" },
        FloorDecorationAnimal:    { mode:"fillBorder", fill:"#ffce5c", border:"#a08a5f" },
        FloorItem:                { mode:"fill",       fill:"#c8b074", border:"#a08a5f" },
        FloorObstacle:            { mode:"fill",       fill:"#4f4f4f", border:"#000000" },
        FloorNumber:              { mode:"fillBorder", fill:"#e8e8e8", border:"#000000" },
        FloorLetter:              { mode:"fillBorder", fill:"#e8e8e8", border:"#000000" },
        FloorIcon:                { mode:"star",       fill:"#e6e6e6", border:"#000000" },
        WallDecoration:           { mode:"outline",    fill:"#6b4a2f", border:"#000000" },
        Banners:                  { mode:"outline",    fill:"#6b4a2f", border:"#000000" },
        WallPath:                 { mode:"fillBorder", fill:"#86daf9", border:"#000000" },
    };

    // Style 優先於 Type：入口／出口／鑰匙都是 FloorDecoration 底下的特殊款式，改用星星圖示
    const STYLE_OVERRIDES = [
        { match:"EntryFlag", matchType:"exact",  mode:"star", fill:"#00d115", border:"#000000" }, // 入口
        { match:"ExitFlag",  matchType:"exact",  mode:"star", fill:"#ff352e", border:"#000000" }, // 出口
        { match:"Key",       matchType:"prefix", mode:"star", fill:"#f6fa00", border:"#000000" }, // 鑰匙 Key*
    ];

    function starPath(ctx, cx, cy, outerR, innerRatio, points, rotation) {
        ctx.beginPath();
        for (let i = 0; i < points*2; i++) {
            const r = (i % 2 === 0) ? outerR : outerR*innerRatio;
            const a = rotation + i*Math.PI/points;
            const px = cx + Math.cos(a)*r, py = cy + Math.sin(a)*r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    // 依 vis（getObjectVisual 回傳的樣式設定）把物件畫在 (x,y,w,h) 這個方格內
    // obj 為選填：當物件類型是 WallPath（門）時，會依款式疊加方向箭頭／上鎖圖示
    function drawStyled(ctx, x, y, w, h, vis, obj) {
        if (!vis) return;
        if (vis.mode === "outline") {
            ctx.strokeStyle = vis.border || "#ffffff"; ctx.lineWidth = 1.5;
            ctx.strokeRect(x+0.75, y+0.75, w-1.5, h-1.5);
            return;
        }
        if (vis.mode === "star") {
            const cx = x+w/2, cy = y+h/2, r = Math.min(w,h)/2*0.92;
            starPath(ctx, cx, cy, r, 0.45, 5, -Math.PI/2);
            ctx.fillStyle = vis.fill || "#ffd700";
            ctx.fill();
            if (vis.border) {
                ctx.strokeStyle = vis.border; ctx.lineWidth = Math.max(1, r*0.12);
                ctx.stroke();
            }
            return;
        }
        ctx.fillStyle = vis.fill || "#999999";
        ctx.fillRect(x, y, w, h);
        if (vis.mode === "fillBorder" && vis.border) {
            ctx.strokeStyle = vis.border; ctx.lineWidth = 1;
            ctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
        }
        if (obj && obj.Type === "WallPath") drawDoorGlyph(ctx, obj.Style || "", x, y, w, h);
    }

    // 門：維持原本水藍色底色，依款式名稱疊加方向箭頭（Up/Down 結尾）或上鎖圖示（含 Locked 的款式）
    function drawDoorGlyph(ctx, style, x, y, w, h) {
        const cx = x + w/2, cy = y + h/2;
        const isUp = /Up$/.test(style);
        const isDown = /Down$/.test(style);
        const isLocked = style.indexOf("Locked") >= 0;

        if (isUp || isDown) {
            const size = Math.min(w, h) * 0.34;
            ctx.beginPath();
            if (isUp) {
                ctx.moveTo(cx, cy - size);
                ctx.lineTo(cx - size*0.85, cy + size*0.6);
                ctx.lineTo(cx + size*0.85, cy + size*0.6);
            } else {
                ctx.moveTo(cx, cy + size);
                ctx.lineTo(cx - size*0.85, cy - size*0.6);
                ctx.lineTo(cx + size*0.85, cy - size*0.6);
            }
            ctx.closePath();
            ctx.fillStyle = "#00334d";
            ctx.fill();
            ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (isLocked) {
            const r = Math.min(w, h) * 0.22;
            // 鎖環
            ctx.beginPath();
            ctx.arc(cx, cy - r*0.15, r*0.75, Math.PI, 0);
            ctx.strokeStyle = "#222222";
            ctx.lineWidth = Math.max(1, r*0.35);
            ctx.stroke();
            // 鎖身
            ctx.fillStyle = "#222222";
            ctx.fillRect(cx - r, cy - r*0.15, r*2, r*1.35);
        }
    }

    // 在地圖上把 _hoverHighlightId 對應的角色（來自"人員清單"面板懸停）畫上綠色外框與綠色倒三角
    function drawHoverHighlight(ctx) {
        if (_hoverHighlightId == null) return;
        const c = _charCache.find(x => x.id === _hoverHighlightId);
        if (!c) return;
        ctx.beginPath(); ctx.arc(c.sx, c.sy, c.r+4, 0, Math.PI*2);
        ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2.5; ctx.stroke();
        const fs = Math.max(10, c.r*2);
        ctx.font = `bold ${fs}px monospace`;
        ctx.fillStyle = "#00ff88";
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("▼", c.sx, c.sy - c.r - 5);
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }

    // 畫出目前選取的格子（黃色虛線框），直到滑鼠移到玩家身上或重新點擊才會清除
    function drawSelectedTileMarker(ctx, W, H) {
        if (!_selectedTile || !_mapTransform) return;
        const { ts, ox, oy, originX, originY } = _mapTransform;
        const sx = ox + (_selectedTile.x - originX) * ts;
        const sy = oy + (_selectedTile.y - originY) * ts;
        if (sx < -ts || sx > W || sy < -ts || sy > H) return;
        ctx.save();
        ctx.strokeStyle = "#ffdd33"; ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(sx+1, sy+1, ts-2, ts-2);
        ctx.restore();
    }

    function getObjectVisual(obj) {
        const style = obj.Style || "";
        for (const o of STYLE_OVERRIDES) {
            const hit = o.matchType === "prefix" ? style.indexOf(o.match) === 0 : style === o.match;
            if (hit) return o;
        }
        return OBJECT_STYLES[obj.Type] || { mode:"fill", fill:"#999999" };
    }

    let panelEl = null, cvEl = null;
    let fPos, fCnt, fHover;
    let mapMode = "local";
    let _charCache = [];
    let _hoverHighlightId = null; // 目前被"人員清單"面板滑鼠懸停的角色 id，用來在地圖上畫綠色外框
    let _selectedTile = null;     // 最後一次點擊地圖選取的格子 { x, y, t(時間戳) }
    let _mapTransform = null;     // 最近一次繪製使用的座標轉換，供點擊反推格子座標使用
    let peoplePanelEl = null;     // 人員清單側邊面板
    let _footerMode = "empty";    // footer(fHover) 目前顯示內容種類："character" | "selection" | "empty"

    // ── BC 全域直接存取 ───────────────────────────────────────────────────────
    function getMapData()  { return ChatRoomData?.MapData ?? null; }   // eslint-disable-line
    function getPlayerPos() {
        const p = Player?.MapData?.Pos;  // eslint-disable-line
        return p ? { x: p.X, y: p.Y } : null;
    }
    function inMapMode() { return !!(Player?.MapData?.Pos); }  // eslint-disable-line
    function canShowMapButton() {
        return typeof CurrentScreen !== "undefined" && CurrentScreen === "ChatRoom" &&
            inMapMode() &&
            (typeof CurrentCharacter === "undefined" || CurrentCharacter === null);
    }
    function getChars() {
        return (ChatRoomCharacter || [])  // eslint-disable-line
            .filter(c => c?.MapData?.Pos != null)
            .map(c => ({
            x: c.MapData.Pos.X, y: c.MapData.Pos.Y,
            name: (typeof CharacterNickname === "function" ? CharacterNickname(c) : null) || c.Name || "?",  // eslint-disable-line
            isPlayer: typeof c.IsPlayer === "function" ? c.IsPlayer() : false,
            color: c.LabelColor || "#ff8844",
            memberNumber: c.MemberNumber ?? null,
            id: c.MemberNumber != null ? ("m" + c.MemberNumber) : ("n" + (c.Name || Math.random())),
            raw: c, // 保留原始 Character 物件，"完整"模式判斷 AssetName/OccupiedStyle 及開啟對話時會用到
        }));
    }
    function getCharAtPos(chars, x, y) {
        for (const c of chars) if (c.x === x && c.y === y) return c.raw;
        return null;
    }

    // 把玩家移動到指定的地圖格子座標。
    // 若玩家是房間管理員，優先呼叫遊戲內建的瞬移（會同步發封隱藏訊息給所有人，行為與遊戲一致）；
    // 否則直接更新本地座標並主動同步給伺服器，跟遊戲內碰撞修正時的做法相同。
    function teleportPlayerTo(x, y) {
        if (!Player?.MapData?.Pos) return;  // eslint-disable-line
        if (typeof ChatRoomPlayerIsAdmin === "function" && typeof ChatRoomMapViewTeleport === "function" && ChatRoomPlayerIsAdmin()) {  // eslint-disable-line
            try {
                ChatRoomMapViewTeleport(Player, { X: x, Y: y });  // eslint-disable-line
                return;
            } catch (e) {
                console.warn("[BMM] Admin teleport failed, using local move", e);
            }
        }
        Player.MapData.Pos.X = x;  // eslint-disable-line
        Player.MapData.Pos.Y = y;  // eslint-disable-line
        if (typeof ChatRoomMapViewUpdatePlayerFlag === "function") {  // eslint-disable-line
            try { ChatRoomMapViewUpdatePlayerFlag(-999999); } catch (e) { /* 忽略，退回下方直接同步 */ }  // eslint-disable-line
        } else if (typeof ServerSend === "function") {  // eslint-disable-line
            try { ServerSend("ChatRoomCharacterMapDataUpdate", Player.MapData); } catch (e) { /* 忽略 */ }  // eslint-disable-line
        }
        if (typeof ChatRoomMapViewCalculatePerceptionMasks === "function") {  // eslint-disable-line
            try { ChatRoomMapViewCalculatePerceptionMasks(); } catch (e) { /* 忽略 */ }  // eslint-disable-line
        }
    }

    // 依遊戲的規則決定該格物件實際要畫的貼圖檔名（BuildImageName／OccupiedStyle／IsVisible／穿戴中隱藏）
    // 回傳 null 代表這格不畫任何物件貼圖
    function resolveObjectImageName(obj, x, y, chars) {
        if (!obj || obj.Style === "Blank") return null;
        if (typeof obj.IsVisible === "function") {
            try { if (!obj.IsVisible()) return null; } catch { /* 忽略例外，照樣嘗試繪製 */ }
        }
        let imageName = obj.Style;
        if (obj.AssetName != null || obj.OccupiedStyle != null) {
            const char = getCharAtPos(chars, x, y);
            if (char != null && obj.AssetName != null && obj.AssetGroup != null &&
                typeof InventoryIsWorn === "function" && InventoryIsWorn(char, obj.AssetGroup, obj.AssetName)) {  // eslint-disable-line
                return null; // 該角色已穿戴對應道具，畫面上由角色本身呈現，不重複畫底圖
            }
            if (char != null && obj.OccupiedStyle != null) imageName = obj.OccupiedStyle;
        } else if (typeof obj.BuildImageName === "function") {
            try { imageName = obj.BuildImageName(x, y); } catch { imageName = obj.Style; }
        }
        return imageName;
    }
    let _tlCache = null, _olCache = null, _lastMapData = null;

    function getTL() {
        if (_tlCache && _lastMapData === ChatRoomData?.MapData) return _tlCache;
        _tlCache = {};
        for (const t of (ChatRoomMapViewTileList || [])) _tlCache[t.ID] = t;
        return _tlCache;
    }
    function getOL() {
        if (_olCache && _lastMapData === ChatRoomData?.MapData) return _olCache;
        _olCache = {};
        for (const o of (ChatRoomMapViewObjectList || [])) _olCache[o.ID] = o;
        _lastMapData = ChatRoomData?.MapData;
        return _olCache;
    }

    // 從遊戲引擎抓取已快取的圖片物件（沿用 ChatRoomMapViewDrawGrid 用的同一支函式）
    function getGameImage(path) {
        return (typeof DrawGetImage === "function") ? DrawGetImage(path) : null;  // eslint-disable-line
    }

    // ── "完整"模式：直接抓取遊戲貼圖繪製整張 40×40 地圖縮圖 ──────────────────────
    function drawFullMapReal(ctx, W, H) {
        const md = getRenderMap();
        const chars = getChars();

        if (!md?.Tiles) {
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,60,60,0.5)";
            ctx.font = "13px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(t("not_in_room"), W/2, H/2);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            _charCache = [];
            return;
        }

        if (typeof DrawGetImage !== "function") {  // eslint-disable-line
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,200,60,0.8)";
            ctx.font = "12px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(t("no_drawimage"), W/2, H/2);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            _charCache = [];
            return;
        }

        const tl = getTL(), ol = getOL();
        const ts = Math.min(Math.floor(W/MAP_W), Math.floor(H/MAP_H));
        const ox = Math.floor((W - ts*MAP_W)/2), oy = Math.floor((H - ts*MAP_H)/2);
        _mapTransform = { mode: "complete", ts, ox, oy, originX: 0, originY: 0 };
        ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);

        // 底層 Tile 貼圖
        for (let y = 0; y < MAP_H; y++)
            for (let x = 0; x < MAP_W; x++) {
                const tile = tl[md.Tiles.charCodeAt(y*MAP_W+x)];
                if (!tile) continue;
                const img = getGameImage("Screens/Online/ChatRoom/MapTile/" + tile.Type + "/" + tile.Style + ".png");
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.drawImage(img, ox+x*ts, oy+y*ts, ts, ts);
                } else {
                    // 圖片尚未載入完成時先用灰塊佔位，下次重繪（每 500ms）會補上
                    ctx.fillStyle = "#333"; ctx.fillRect(ox+x*ts, oy+y*ts, ts, ts);
                }
            }

        // 物件貼圖（含 Top/Left/Width/Height 偏移，讓超出格子的家具、樹木等維持原比例）
        if (md.Objects)
            for (let y = 0; y < MAP_H; y++)
                for (let x = 0; x < MAP_W; x++) {
                    const id = md.Objects.charCodeAt(y*MAP_W+x);
                    if (id <= OBJ_START) continue;
                    const obj = ol[id];
                    const imageName = resolveObjectImageName(obj, x, y, chars);
                    if (!imageName) continue;
                    const img = getGameImage("Screens/Online/ChatRoom/MapObject/" + obj.Type + "/" + imageName + ".png");
                    if (!img || !img.complete || img.naturalWidth === 0) continue;
                    const ow = ts * (obj.Width  == null ? 1 : obj.Width);
                    const oh = ts * (obj.Height == null ? 1 : obj.Height);
                    const dx = ox + x*ts + (obj.Left == null ? 0 : ts*obj.Left);
                    const dy = oy + y*ts + (obj.Top  == null ? 0 : ts*obj.Top);
                    ctx.drawImage(img, dx, dy, ow, oh);
                }

        // 人物：維持簡易圓點呈現（不畫角色貼圖）
        _charCache = [];
        for (const c of chars) {
            const sx = ox+c.x*ts+ts/2, sy = oy+c.y*ts+ts/2;
            const r = Math.max(3, Math.floor(ts*.4));
            ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
            ctx.fillStyle = c.isPlayer ? "#ff3c3c" : c.color;
            ctx.fill(); ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.stroke();
            _charCache.push({ ...c, sx, sy, r });
            if (c.isPlayer) {
                const fs = Math.max(10, ts*1.5);
                ctx.font = `bold ${fs}px monospace`;
                ctx.fillStyle = "#ff3c3c";
                ctx.textAlign = "center"; ctx.textBaseline = "bottom";
                ctx.fillText("▼", sx, sy - r - 1);
                ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            }
        }
        drawHoverHighlight(ctx);
        drawSelectedTileMarker(ctx, W, H);
    }

    // ── 繪圖 ──────────────────────────────────────────────────────────────────
    function drawMap(ctx, W, H) {
        const md = getRenderMap();
        const pp = getPlayerPos();

        if (!md?.Tiles || !pp) {
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,60,60,0.5)";
            ctx.font = "13px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(t("not_in_room"), W/2, H/2);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            _charCache = [];
            return;
        }

        if (mapMode === "complete") {
            drawFullMapReal(ctx, W, H);
            return;
        }

        const tl = getTL(), ol = getOL();
        const chars = getChars();

        if (mapMode === "full") {
            const ts = Math.min(Math.floor(W/MAP_W), Math.floor(H/MAP_H));
            const ox = Math.floor((W - ts*MAP_W)/2), oy = Math.floor((H - ts*MAP_H)/2);
            _mapTransform = { mode: "full", ts, ox, oy, originX: 0, originY: 0 };
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);

            for (let y = 0; y < MAP_H; y++)
                for (let x = 0; x < MAP_W; x++) {
                    const tile = tl[md.Tiles.charCodeAt(y*MAP_W+x)];
                    ctx.fillStyle = tile ? (TILE_COLORS[tile.Type]||TILE_COLORS.default) : "#1a1a2e";
                    ctx.fillRect(ox+x*ts, oy+y*ts, ts, ts);
                }

            if (md.Objects && ts >= 2)
                for (let y = 0; y < MAP_H; y++)
                    for (let x = 0; x < MAP_W; x++) {
                        const id = md.Objects.charCodeAt(y*MAP_W+x);
                        if (id <= OBJ_START) continue;
                        const obj = ol[id]; if (!obj||obj.Style==="Blank") continue;
                        const pad = Math.max(0, Math.floor(ts*.15));
                        const vis = getObjectVisual(obj);
                        drawStyled(ctx, ox+x*ts+pad, oy+y*ts+pad, ts-pad*2, ts-pad*2, vis, obj);
                    }

            _charCache = [];
            for (const c of chars) {
                const sx = ox+c.x*ts+ts/2, sy = oy+c.y*ts+ts/2;
                const r = Math.max(3, Math.floor(ts*.4));
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
                ctx.fillStyle = c.isPlayer ? "#ff3c3c" : c.color;
                ctx.fill(); ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.stroke();
                _charCache.push({ ...c, sx, sy, r });
                if (c.isPlayer) {
                    const fs = Math.max(10, ts*1.5);
                    ctx.font = `bold ${fs}px monospace`;
                    ctx.fillStyle = "#ff3c3c";
                    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
                    ctx.fillText("▼", sx, sy - r - 1);
                    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
                }
            }
            drawHoverHighlight(ctx);
            drawSelectedTileMarker(ctx, W, H);

        } else {
            // ── 局部模式：边缘自适应视口 ──
            // 玩家在地图边缘时，收缩可视范围到有效地图区内并重新居中，避免大片黑色空白
            const idealX0 = pp.x - VIEW_RANGE, idealX1 = pp.x + VIEW_RANGE + 1;
            const idealY0 = pp.y - VIEW_RANGE, idealY1 = pp.y + VIEW_RANGE + 1;
            // 钳位到有效地图范围
            const vx0 = Math.max(0, idealX0), vx1 = Math.min(MAP_W, idealX1);
            const vy0 = Math.max(0, idealY0), vy1 = Math.min(MAP_H, idealY1);
            const vw = vx1 - vx0, vh = vy1 - vy0;   // 实际可见格数（≤21）
            const ts = Math.floor(Math.min(W / vw, H / vh));
            // 居中偏移：把实际可见区域画在画布中央
            const gridW = ts * vw, gridH = ts * vh;
            const ox = Math.floor((W - gridW) / 2), oy = Math.floor((H - gridH) / 2);
            _mapTransform = { mode: "local", ts, ox, oy, originX: vx0, originY: vy0 };
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);

            for (let my = vy0; my < vy1; my++)
                for (let mx = vx0; mx < vx1; mx++) {
                    const sx = ox + (mx - vx0) * ts, sy = oy + (my - vy0) * ts;
                    const idx = my * MAP_W + mx;
                    const tile = tl[md.Tiles.charCodeAt(idx)];
                    ctx.fillStyle = tile ? (TILE_COLORS[tile.Type]||TILE_COLORS.default) : "#1a1a2e";
                    ctx.fillRect(sx, sy, ts, ts);
                    ctx.strokeStyle="rgba(0,0,0,0.15)"; ctx.lineWidth=0.5;
                    ctx.strokeRect(sx+.5, sy+.5, ts-1, ts-1);

                    if (md.Objects) {
                        const id = md.Objects.charCodeAt(idx);
                        if (id > OBJ_START) {
                            const obj = ol[id];
                            if (obj && obj.Style !== "Blank") {
                                const vis = getObjectVisual(obj);
                                const pad = Math.max(1, Math.floor(ts*.14));
                                drawStyled(ctx, sx+pad, sy+pad, ts-pad*2, ts-pad*2, vis, obj);
                            }
                        }
                    }
                }

            _charCache = [];
            for (const c of chars) {
                if (c.isPlayer) continue;
                if (c.x < vx0 || c.x >= vx1 || c.y < vy0 || c.y >= vy1) continue;
                const sx = ox+(c.x-vx0)*ts+ts/2, sy = oy+(c.y-vy0)*ts+ts/2;
                const r = Math.max(4, Math.floor(ts*.3));
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
                ctx.fillStyle=c.color; ctx.fill();
                ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.stroke();
                _charCache.push({ ...c, sx, sy, r });
            }

            // 玩家位置（在可见区域内则画中心标记）
            if (pp.x >= vx0 && pp.x < vx1 && pp.y >= vy0 && pp.y < vy1) {
                const cx = ox+(pp.x-vx0)*ts+ts/2, cy = oy+(pp.y-vy0)*ts+ts/2;
                const pr = Math.max(5, Math.floor(ts*.35));
                ctx.beginPath(); ctx.arc(cx, cy, pr+3, 0, Math.PI*2);
                ctx.fillStyle="rgba(255,60,60,0.2)"; ctx.fill();
                ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2);
                ctx.fillStyle="#ff3c3c"; ctx.fill();
            }
            ctx.strokeStyle="#660000"; ctx.lineWidth=1.5; ctx.stroke();
            // 讓局部模式的玩家自己也能被"人員清單"面板懸停高亮
            const selfChar = chars.find(c => c.isPlayer);
            if (selfChar) _charCache.push({ ...selfChar, sx: cx, sy: cy, r: pr });

            drawHoverHighlight(ctx);
            drawSelectedTileMarker(ctx, W, H);
        }
    }

    // ── DOM Panel ─────────────────────────────────────────────────────────────
    function createPanel() {
        if (panelEl) return;

        // 注入 style
        
        if (!document.getElementById("bc-minimap-style")) {
            const s = document.createElement("style");
            s.id = "bc-minimap-style";
            s.textContent = `
        #bc-minimap-root {
          --mm-rgb: 0,255,136; /* 預設綠色主題，雙擊標題可切換成紫色 192,98,254 */
          position: fixed;
          top: 60px;
          left: 80px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          background: rgba(10,10,25,0.95);
          border: 1.5px solid rgba(var(--mm-rgb),0.45);
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(var(--mm-rgb),0.12);
          font-family: monospace;
          user-select: none;
          overflow: visible !important;
          transition: border-color .25s, box-shadow .25s;
        }
        #bc-minimap-root.mm-theme-purple { --mm-rgb: 192,98,254; }
        #bc-minimap-root.hidden { display: none !important; }
        #bc-minimap-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 8px 0 10px;
          height: 36px;
          min-height: 36px;
          max-height: 36px;
          cursor: move;
          background: rgba(var(--mm-rgb),0.08);
          border-bottom: 1px solid rgba(var(--mm-rgb),0.2);
          border-radius: 8px 8px 0 0;
          gap: 6px;
          overflow: hidden;
        }
        .mm-title {
          color: rgb(var(--mm-rgb));
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 0.5px;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex-shrink: 1;
          min-width: 0;
          max-width: 120px;
        }
        #bc-minimap-canvas {
          display: block;
          flex-shrink: 0;
        }
        #bc-minimap-ftr {
          display: flex;
          flex-direction: column;
          padding: 0;
          min-height: 58px;
          border-top: 1px solid rgba(var(--mm-rgb),0.15);
          font-size: 12px;
          color: rgb(var(--mm-rgb));
          background: rgba(0,0,0,0.3);
          border-radius: 0 0 8px 8px;
          margin-top: auto;
          overflow: hidden;
        }
        /* 底部坐标/人数行 */
        #bc-minimap-ftr > .mm-ftr-info {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3px 10px;
          height: 26px;
          min-height: 26px;
          gap: 6px;
          flex-shrink: 0;
        }
        #bc-minimap-ftr .mm-ftr-info span { flex: 1; }
        #bc-minimap-ftr .mm-ftr-info span:first-child { text-align: left; }
        #bc-minimap-ftr .mm-ftr-info span:nth-child(2) { text-align: center; }
        #bc-minimap-ftr .mm-ftr-info span:last-child  { text-align: right; }
        #bc-minimap-ftr .mm-hover-char { color: #ff8888; }
        #bc-minimap-ftr .mm-hover-tile { color: rgb(var(--mm-rgb)); }
        #bc-minimap-ftr .mm-hover-tile.mm-footer-btn {
          cursor: pointer;
          text-decoration: underline;
        }
        .mm-btn {
          background: transparent;
          border: 1px solid rgba(var(--mm-rgb),0.3);
          border-radius: 4px;
          color: #668866;
          font-size: 10px;
          padding: 3px 7px;
          cursor: pointer;
          font-family: monospace;
          white-space: nowrap;
          line-height: 1.2;
          text-align: center;
          min-width: 28px;
          flex-shrink: 0;
          transition: background .15s, border-color .15s, color .15s, box-shadow .15s;
        }
        .mm-btn:hover {
          background: rgba(var(--mm-rgb),0.1);
          border-color: rgba(var(--mm-rgb),0.5);
          color: #99bb99;
        }
        .mm-btn.active {
          background: rgba(var(--mm-rgb),0.2);
          border-color: rgba(var(--mm-rgb),0.6);
          color: rgb(var(--mm-rgb));
        }
        #bc-minimap-toolbar {
          display: flex;
          gap: 5px;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          height: 32px;
          min-height: 32px;
          border-bottom: 1px solid rgba(var(--mm-rgb),0.15);
          background: rgba(var(--mm-rgb),0.06);
          flex-shrink: 0;
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        #bc-minimap-toolbar .mm-btn { font-size: 10px; padding: 3px 8px; }
        #bc-minimap-load-ov {
          position: fixed !important; top: 50% !important; left: 50% !important;
          transform: translate(-50%,-50%) !important;
          z-index: 2147483647 !important; width: 440px; max-height: 70vh; overflow-y: auto;
          background: rgba(248,242,228,0.98) !important;
          border: 3px double #8b6914 !important;
          border-radius: 8px !important;
          box-shadow: 6px 12px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(139,105,20,0.08) !important;
          color: #2d1f14 !important; font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          padding: 16px 18px !important;
          border-radius: 10px;
          animation: bmmFadeIn 0.25s ease-out !important;
        }
        #bc-minimap-load-ov h3 {
          margin: 0 0 10px 0; font-size: 14px; font-weight: 700;
          color: #2d1f14; text-align: center; border-bottom: 1px solid #c0a860; padding-bottom: 8px;
        }
        #bc-minimap-load-ov .close {
          position: absolute; top: 8px; right: 10px; cursor: pointer;
          color: #a0522d; font-size: 18px; line-height: 1; padding: 4px;
        }
        #bc-minimap-load-ov .close:hover { color: #000; }
        #bc-minimap-load-ov .list { display: flex; flex-direction: column; gap: 6px; }
        #bc-minimap-load-ov .row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 8px 10px; background: rgba(255,255,255,0.5);
          border: 1px solid #c0a860; border-radius: 4px;
          transition: all 0.2s ease !important;
        }
        #bc-minimap-load-ov .row:hover {
          background: rgba(255,255,255,0.85) !important;
          border-color: #8b6914 !important;
          transform: translateX(2px);
          box-shadow: 0 2px 6px rgba(139,105,20,0.12) !important;
        }
        #bc-minimap-load-ov .meta {
          font-size: 11px; color: #5c3a1e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px;
        }
        #bc-minimap-load-ov .acts { display: flex; gap: 4px; flex-shrink: 0; }
        #bc-minimap-load-ov .acts .mm-btn {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important; border-bottom-width: 2px;
          color: #2d1f14 !important; font-size: 10px !important; font-weight: 700 !important;
          padding: 3px 8px !important; cursor: pointer; border-radius: 3px;
        }
        #bc-minimap-load-ov .acts .mm-btn:hover {
          background: linear-gradient(180deg, #fff8e8, #f0e0c8) !important;
          transform: translateY(-1px);
        }
        #bc-minimap-load-ov .empty {
          text-align: center; padding: 20px; color: #8b7355; font-style: italic; font-size: 12px;
        }
        /* ── 导入弹窗（纸质地图风格）── */
        #bc-minimap-import-ov {
          position: fixed !important; top: 50% !important; left: 50% !important;
          transform: translate(-50%,-50%) !important;
          z-index: 2147483647 !important; width: 420px; max-width: 92vw; box-sizing: border-box !important;
          background: rgba(248,242,228,0.98) !important;
          border: 3px double #8b6914 !important;
          border-radius: 8px !important;
          box-shadow: 6px 12px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(139,105,20,0.08) !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          color: #2d1f14 !important; padding: 18px !important;
          animation: bmmFadeIn 0.25s ease-out !important;
        }
        #bc-minimap-import-ov h3 { margin: 0 0 10px !important; color: #2d1f14 !important; font-size: 15px !important; font-weight: 700; border-bottom: 1px solid #c0a860; padding-bottom: 8px; }
        #bc-minimap-import-ov .warn { font-size: 12px !important; line-height: 1.6; color: #8b0000 !important; background: rgba(255,220,200,0.5) !important; border: 1px solid #c0a060 !important; border-radius: 6px !important; padding: 10px !important; margin-bottom: 10px !important; }
        #bc-minimap-import-ov .src { font-size: 11px !important; color: #5c3a1e !important; margin-bottom: 14px !important; }
        #bc-minimap-import-ov .acts { display: flex !important; gap: 10px !important; justify-content: flex-end !important; }
        #bc-minimap-import-ov .mm-btn {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important; border-bottom-width: 2px !important;
          color: #2d1f14 !important; font-size: 12px !important; font-weight: 700 !important;
          padding: 6px 14px !important; border-radius: 3px !important;
          transition: all 0.2s ease !important;
        }
        #bc-minimap-import-ov .mm-btn.ok { background: linear-gradient(180deg, #d4956a, #b87a50) !important; color: #fff !important; border-color: #8b6914 !important; text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important; }
        #bc-minimap-import-ov .mm-btn.ok:hover { background: linear-gradient(180deg, #e0a878, #c99060) !important; transform: translateY(-1px) !important; }
        #bc-minimap-import-ov .close { position: absolute !important; top: 8px !important; right: 10px !important; cursor: pointer !important; color: #a0522d !important; font-size: 18px !important; line-height: 1 !important; padding: 4px !important; transition: color 0.2s !important; }
        #bc-minimap-import-ov .close:hover { color: #000 !important; }
        #bmmx-toast { position: fixed !important; left: 50% !important; bottom: 80px !important; transform: translateX(-50%) !important; z-index: 2147483647 !important; background: rgba(248,242,228,0.96) !important; border: 2px solid #8b6914 !important; color: #2d1f14 !important; font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important; font-size: 12px !important; padding: 8px 16px !important; border-radius: 6px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.25) !important; opacity: 0; transition: opacity .25s ease !important; pointer-events: none !important; max-width: 90vw !important; }
        #bmmx-toast.show { opacity: 1; }
        .mm-key {
          display: block;
          color: #555555;
          opacity: 0.55;
          transition: color .2s, opacity .2s, filter .2s;
        }
        #bc-minimap-ftr span.mm-clickable {
          cursor: pointer;
        }
        #bc-minimap-people {
          position: absolute;
          top: 0;
          left: calc(100% + 8px);
          width: 220px;
          max-height: 100%;
          overflow-y: auto !important;
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
          background: rgba(248,242,228,0.98) !important;
          border: 3px double #8b6914 !important;
          border-radius: 6px !important;
          box-shadow: 4px 8px 20px rgba(0,0,0,0.3), inset 0 0 15px rgba(139,105,20,0.06) !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          font-size: 12px !important;
          color: #2d1f14 !important;
        }
        #bc-minimap-people.hidden { display: none !important; }
        #bc-minimap-people::-webkit-scrollbar { display: none !important; }
        #bc-minimap-people-hdr {
          padding: 8px 12px !important;
          color: #2d1f14 !important;
          font-weight: 700 !important;
          border-bottom: 2px solid #c0a860 !important;
          font-size: 13px !important;
        }
        .mm-people-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px !important;
          cursor: pointer;
          border-bottom: 1px solid rgba(192,168,96,0.35) !important;
          transition: all 0.15s ease !important;
        }
        .mm-people-row:hover { background: rgba(255,255,255,0.55) !important; transform: translateX(2px); }
        .mm-people-row.self { color: #a03030 !important; font-weight: 700 !important; }
      

        /* v1.5.1: New modeBar element for seg control */
        .mm-mode-bar {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 3px 8px;
          border-bottom: 1px solid #8b6914;
          background: rgba(200,180,150,0.15);
          flex-shrink: 0;
        }

        /* ── 保存名称对话框（纸质地图风格）── */
        #bc-minimap-save-dialog {
          position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
          z-index: 2147483647 !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          background: rgba(0,0,0,0.45) !important;
          animation: bmmFadeInSimple 0.2s ease-out !important;
        }
        #bc-minimap-save-dialog .sd-inner {
          background: rgba(248,242,228,0.98) !important;
          border: 3px double #8b6914 !important;
          border-radius: 8px !important;
          box-shadow: 6px 12px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(139,105,20,0.08) !important;
          color: #2d1f14 !important; font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          padding: 18px 22px !important; width: 360px; max-width: 90vw;
          animation: bmmFadeScale 0.25s ease-out !important;
        }
        #bc-minimap-save-dialog h3 {
          margin: 0 0 12px 0; font-size: 15px; font-weight: 700;
          color: #2d1f14; text-align: center; border-bottom: 1px solid #c0a860; padding-bottom: 8px;
        }
        #bc-minimap-save-dialog label {
          display: block; font-size: 11px; color: #5c3a1e; margin-bottom: 6px;
        }
        #bc-minimap-save-dialog #bmm-save-input {
          width: 100% !important; box-sizing: border-box !important;
          padding: 8px 10px !important; font-size: 13px !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          border: 1px solid #a08050 !important; border-radius: 4px !important;
          background: #fffef5 !important; color: #2d1f14 !important;
          outline: none !important;
        }
        #bc-minimap-save-dialog #bmm-save-input:focus {
          border-color: #8b6914 !important; box-shadow: 0 0 0 2px rgba(139,105,20,0.2) !important;
        }
        #bc-minimap-save-dialog .sd-acts {
          display: flex !important; justify-content: flex-end !important; gap: 8px !important; margin-top: 16px !important;
        }
        #bc-minimap-save-dialog .sd-acts .mm-btn {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important; border-bottom-width: 2px !important;
          color: #2d1f14 !important; font-size: 11px !important; font-weight: 700 !important;
          padding: 6px 18px !important; cursor: pointer !important; border-radius: 3px !important;
          font-family: inherit !important;
        }
        #bc-minimap-save-dialog .sd-acts .mm-btn:hover {
          background: linear-gradient(180deg, #fff8e8, #f0e0c8) !important;
          transform: translateY(-1px);
        }
        #bc-minimap-save-dialog .sd-acts .sd-ok {
          background: linear-gradient(180deg, #c8895a, #a0522d) !important;
          color: #fff !important; border-color: #704820 !important;
        }
        #bc-minimap-save-dialog .sd-acts .sd-ok:hover {
          background: linear-gradient(180deg, #d89565, #b05e35) !important;
        }

        /* ── 全局弹入动画 ── */
        @keyframes bmmFadeIn {
          from { opacity: 0; transform: translate(-50%,-50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes bmmFadeInSimple {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bmmFadeScale {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes bmmPanelIn {
          from { opacity: 0; transform: translateY(-5px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bmmPanelOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-5px) scale(0.98); }
        }
        @keyframes bmmCanvasSwap {
          from { opacity: 0.45; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }

        /* ══════════════════════════════════════════════════════════════
           PAPER-MAP THEME — main panel overrides (v1.5.1)
           These win over the original dark/green base via !important.
           ═════════════════════════════════════════════════════════════ */
        #bc-minimap-root {
          --mm-rgb: 160,100,50 !important;
          box-sizing: border-box !important;
          background: rgba(248,242,228,0.97) !important;
          border: 3px double #8b6914 !important;
          border-radius: 4px !important;
          box-shadow: 4px 8px 0 rgba(0,0,0,0.35), inset 0 0 30px rgba(139,105,20,0.08) !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          color: #2d1f14 !important;
          transform-origin: top center;
          /* 模式切换时面板尺寸平滑过渡（与画布同步，共享同一时长/缓动） */
          transition: border-color .25s, box-shadow .25s, width 0.22s ease, height 0.22s ease !important;
        }
        #bc-minimap-root:not(.hidden) {
          animation: bmmPanelIn 0.14s ease-out !important;
        }
        #bc-minimap-root.mm-closing {
          animation: bmmPanelOut 0.12s ease-in forwards !important;
          pointer-events: none !important;
        }
        #bc-minimap-hdr {
          background: linear-gradient(180deg, rgba(180,150,100,0.18), rgba(180,150,100,0.08)) !important;
          border-bottom: 2px solid #8b6914 !important;
          border-radius: 0 !important;
        }
        .mm-title {
          color: #2d1f14 !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          font-size: 12px !important;
        }
        #bc-minimap-toolbar {
          background: linear-gradient(180deg, rgba(220,200,170,0.15), rgba(220,200,170,0.05)) !important;
          border-bottom: 1px solid rgba(139,105,20,0.25) !important;
        }
        #bc-minimap-ftr {
          background: linear-gradient(180deg, rgba(220,200,170,0.12), rgba(220,200,170,0.04)) !important;
          border-top: 2px solid #8b6914 !important;
          color: #5c3a1e !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
        }
        .mm-btn {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important;
          border-bottom-width: 2px !important;
          border-radius: 3px !important;
          color: #2d1f14 !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 4px 12px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6) !important;
          transition: all 0.2s ease !important;
        }
        .mm-btn:hover {
          background: linear-gradient(180deg, #fff8e8, #f0e0c8) !important;
          border-color: #704820 !important;
          color: #000 !important;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7) !important;
        }
        .mm-btn:active {
          transform: translateY(1px) !important;
          border-bottom-width: 1px !important;
          box-shadow: 0 1px 1px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3) !important;
        }
        .mm-close {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important;
          border-radius: 3px !important;
          color: #2d1f14 !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          font-size: 13px !important;
          font-weight: bold !important;
          padding: 4px 8px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.6) !important;
          transition: all 0.2s ease !important;
        }
        .mm-close:hover {
          background: linear-gradient(180deg, #fff8e8, #f0e0c8) !important;
          border-color: #704820 !important;
          transform: translateY(-1px);
        }
        .mm-mode-bar {
          background: linear-gradient(180deg, rgba(220,200,170,0.15), rgba(220,200,170,0.05)) !important;
          border-bottom: 1px solid rgba(139,105,20,0.25) !important;
        }
        /* ── 模式切换按钮（纸质浮雕 + 动效）── */
        .mm-seg-btn {
          background: linear-gradient(180deg, #f5eddE, #e8dcc8) !important;
          border: 1px solid #a08050 !important;
          border-bottom-width: 2px !important;
          border-radius: 3px !important;
          color: #2d1f14 !important;
          font-family: Georgia, "Times New Roman", "PingFang SC", SimSun, serif !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          padding: 3px 10px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6) !important;
        }
        .mm-seg-btn:hover {
          background: linear-gradient(180deg, #fff8e8, #f0e0c8) !important;
          border-color: #704820 !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 3px 8px rgba(139,105,20,0.2), inset 0 1px 0 rgba(255,255,255,0.7) !important;
        }
        .mm-seg-btn:active {
          transform: translateY(1px) !important;
          border-bottom-width: 1px !important;
          box-shadow: 0 1px 1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.3) !important;
        }
        .mm-seg-btn.active {
          background: linear-gradient(180deg, #c0a060, #a08040) !important;
          color: #fff !important;
          border-color: #8b6914 !important;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
          box-shadow: 0 1px 3px rgba(139,105,20,0.4), inset 0 1px 0 rgba(255,255,255,0.2) !important;
        }
        #bc-minimap-canvas {
          background: transparent !important;
          border: none !important;
          display: block !important;
          flex-shrink: 0 !important;
          /* 与面板尺寸过渡共享 0.22s ease，确保画布尺寸与面板同步缩放 */
          transition: width 0.22s ease, height 0.22s ease !important;
          transform-origin: center center;
        }
        /* 模式切换时画布淡入缩放（配合尺寸过渡，营造平滑换图感） */
        #bc-minimap-canvas.mm-swap {
          animation: bmmCanvasSwap 0.22s ease-out !important;
        }
`;
            document.head.appendChild(s);
        }
        // 外框
        panelEl = document.createElement("div");
        panelEl.id = "bc-minimap-root";
        panelEl.classList.add("hidden");

        // Header
        const hdr = document.createElement("div");
        hdr.id = "bc-minimap-hdr";
        const title = document.createElement("span");
        title.className = "mm-title";
        title.textContent = `🗺️ ${ChatRoomData?.Name ?? t("offline_name")}`;
        title.title = t("hdr_dblclick");
        title.addEventListener("dblclick", () => {
            panelEl.classList.toggle("mm-theme-purple");
            // 重新套用目前 footer 顯示內容的按鈕狀態（顏色/可否點擊會隨主題改變）
            setFooterText(fHover.textContent, _footerMode);
        });

        // 鑰匙狀態指示（銅／銀／金），預設灰色，拿到後點亮對應顏色
        // 使用 SVG + currentColor 而非 emoji，確保三種顏色能被精準染色（emoji 本身顏色由系統字型決定，無法可靠改色）
        const KEY_SVG = '<svg viewBox="0 0 1024 1024" width="14" height="14"><path d="M570.880885 777.528481h262.287488v217.897575H570.880885zM843.446353 195.219619c-4.88799-91.281822-79.531845-166.673674-170.943666-166.673675-89.933824 0-160.493687 100.273804-160.493687 100.273804s-66.55587-100.273804-160.529686-100.273804c-91.405821 0-166.047676 75.391853-170.935667 166.673675-2.751995 51.565899 13.873973 90.813823 37.293928 126.359753 46.801909 71.015861 251.425509 241.981527 294.471424 241.981527 43.933914 0 246.735518-170.343667 293.849426-241.981527 23.469954-35.70993 40.049922-74.791854 37.287928-126.359753z" fill="currentColor"/><path d="M512.308999 563.560899c-10.979979 0-32.485937-11.141978-59.191884-28.891943v460.7811h117.75577V535.334954c-26.263949 17.369966-47.475907 28.225945-58.563886 28.225945z" fill="currentColor" opacity=".55"/></svg>';
        const keysWrap = document.createElement("div");
        keysWrap.id = "bc-minimap-keys";
        keysWrap.style.cssText = "display:flex;gap:4px;margin-left:8px;";
        const keyBronze = document.createElement("span");
        const keySilver = document.createElement("span");
        const keyGold   = document.createElement("span");
        keyBronze.className = keySilver.className = keyGold.className = "mm-key";
        keyBronze.innerHTML = keySilver.innerHTML = keyGold.innerHTML = KEY_SVG;
        keyBronze.title = t("key_bronze"); keySilver.title = t("key_silver"); keyGold.title = t("key_gold");
        keysWrap.append(keyBronze, keySilver, keyGold);

        function refreshKeyIndicators() {
            const ps = Player?.MapData?.PrivateState;  // eslint-disable-line
            const apply = (el, active, color) => {
                el.style.color = active ? color : "#555555";
                el.style.opacity = active ? "1" : "0.55";
                el.style.filter = active ? `drop-shadow(0 0 3px ${color})` : "none";
            };
            apply(keyBronze, !!ps?.HasKeyBronze, "#cd7f32");
            apply(keySilver, !!ps?.HasKeySilver, "#c0c0c0");
            apply(keyGold,   !!ps?.HasKeyGold,   "#ffd700");
        }

        const btns = document.createElement("div");
        btns.style.cssText = "display:flex;gap:4px;align-items:center;flex-shrink:0;";
        const bLocal = document.createElement("button");
        bLocal.className = "mm-seg-btn active"; bLocal.textContent = t("btn_local");
        const bFull  = document.createElement("button");
        bFull.className  = "mm-seg-btn"; bFull.textContent = t("btn_full");
        const bComplete = document.createElement("button");
        bComplete.className = "mm-seg-btn"; bComplete.textContent = t("btn_complete");
        const bClose = document.createElement("button");
        bClose.className = "mm-btn mm-close"; bClose.innerHTML = "✕";


        function sizeForMode(m) {
            if (m === "full") return FULL_SIZE;
            if (m === "complete") return COMPLETE_SIZE;
            return LOCAL_SIZE;
        }

        function setMode(m) {
            mapMode = m;
            bLocal.className    = "mm-seg-btn" + (m==="local"    ? " active" : "");
            bFull.className     = "mm-seg-btn" + (m==="full"     ? " active" : "");
            bComplete.className = "mm-seg-btn" + (m==="complete" ? " active" : "");
            const size = sizeForMode(m);
            // 缓冲区已在初始化时固定为 COMPLETE_SIZE(640)，此处只改 CSS 显示尺寸，
            // 避免每次切换模式重新分配后端存储导致掉帧。drawMap 以缓冲区(640)为逻辑尺寸绘制，
            // 由 CSS 等比缩放到 size，三个模式的内容与布局保持不变。
            cvEl.style.width  = size + "px";
            cvEl.style.height = size + "px";
            // 面板用 box-sizing:border-box，外尺寸 = 内容尺寸 + 边框(6px)
            const BW = 6; // 3px double border × 2 sides
            panelEl.style.setProperty("width",    (size + BW) + "px");
            panelEl.style.setProperty("height",   (HDR_H + size + TOOLBAR_H + FTR_H + BW) + "px");
            panelEl.style.setProperty("overflow", "visible");
            panelEl.style.setProperty("max-height", "none");
            redrawNow();
            // 触发画布换图动效（移除→强制重排→添加，确保每次切换都重播）
            cvEl.classList.remove("mm-swap");
            void cvEl.offsetWidth;
            cvEl.classList.add("mm-swap");
        }
        bLocal.onclick    = () => setMode("local");
        bFull.onclick     = () => setMode("full");
        bComplete.onclick = () => setMode("complete");
        bClose.onclick    = () => panelEl.classList.add("hidden");

        const seg = document.createElement("div");
        seg.className = "mm-seg";
        seg.append(bLocal, bFull, bComplete);
        // seg moved to modeBar
        hdr.append(title, keysWrap, bClose);



        // Canvas
        cvEl = document.createElement("canvas");
        cvEl.id = "bc-minimap-canvas";
        // 缓冲区一次性设为最大尺寸(COMPLETE_SIZE=640)固定不变，
        // 切换模式只改 CSS 显示尺寸，避免每次切换重新分配后端存储导致的掉帧。
        cvEl.width = cvEl.height = COMPLETE_SIZE;
        cvEl.style.width  = LOCAL_SIZE + "px";
        cvEl.style.height = LOCAL_SIZE + "px";

        // ── 擴充工具列（編輯 / 儲存 / 載入 / 匯出 / 匯入）──
        const toolbarEl = document.createElement("div");
        toolbarEl.id = "bc-minimap-toolbar";
        const mkBtn = (label, fn) => {
            const b = document.createElement("button");
            b.className = "mm-btn"; b.type = "button"; b.textContent = label;
            b.onclick = fn; return b;
        };
        const bEdit = mkBtn(t("tb_edit"), () => { const md = getMapData(); if (!md) { alert(t("alert_no_map")); return; } openEditorWith(md); });
        const bSave = mkBtn(t("tb_save"), () => saveCurrentMap());
        const bLoad = mkBtn(t("tb_load"), () => showLoadOverlay());
        const bExp  = mkBtn(t("tb_export"), () => exportAllMaps());
        const bImp  = mkBtn(t("tb_import"), () => importMaps());
        toolbarEl.append(bEdit, bSave, bLoad, bExp, bImp);
        bmmxSaveBtn = bSave; bmmxExpBtn = bExp; bmmxImpBtn = bImp;

        // Footer（两行布局：上行工具栏，下行坐标+人数）
        const ftr = document.createElement("div");
        ftr.id = "bc-minimap-ftr";
        // 坐标/人数信息行
        const ftrInfo = document.createElement("div");
        ftrInfo.className = "mm-ftr-info";
        fPos   = document.createElement("span");
        fHover = document.createElement("span");
        fCnt   = document.createElement("span");
        fCnt.classList.add("mm-clickable");
        fCnt.title = t("ftr_click_tip");
        ftrInfo.append(fPos, fHover, fCnt);
        ftr.append(toolbarEl, ftrInfo);

        // -- Mode bar (seg control between header and canvas) --
        const modeBar = document.createElement("div");
        modeBar.className = "mm-mode-bar";
        modeBar.append(seg);

        // Canvas is a direct flex child (explicit px size set by setMode/togglePanel).
        // clip-path clips canvas to panel content area (panel stays overflow:visible for people side-panel).
        panelEl.append(hdr, modeBar, cvEl, ftr);

        document.body.appendChild(panelEl);

        // 人員清單側邊面板（附加在主面板內，隨主面板一起拖曳、隨主面板顯示/隱藏而顯示/隱藏）
        peoplePanelEl = document.createElement("div");
        peoplePanelEl.id = "bc-minimap-people";
        peoplePanelEl.classList.add("hidden");
        panelEl.append(peoplePanelEl);

        function updatePeoplePanel() {
            if (!peoplePanelEl || peoplePanelEl.classList.contains("hidden")) return;
            const chars = getChars();
            peoplePanelEl.innerHTML = "";
            const header = document.createElement("div");
            header.id = "bc-minimap-people-hdr";
            const pplIcon = '<svg viewBox="0 0 1024 1024" width="14" height="14" style="vertical-align:-2px;margin-right:4px"><circle cx="280" cy="320" r="90" fill="#8B6914"/><path d="M280 420c-100 0-180 80-180 180v60h360v-60c0-100-80-180-180-180z" fill="#A08050"/><circle cx="512" cy="260" r="110" fill="#B7351B"/><path d="M512 380c-120 0-220 95-220 215v65h440v-65c0-120-100-215-220-215z" fill="#D1782F"/><circle cx="744" cy="340" r="85" fill="#5C3A1E"/><path d="M744 435c-95 0-170 75-170 170v55h340v-55c0-95-75-170-170-170z" fill="#7D5A30"/></svg>';
            header.innerHTML = pplIcon + t("people_hdr", { n: chars.length });
            peoplePanelEl.append(header);
            for (const c of chars) {
                const row = document.createElement("div");
                row.className = "mm-people-row" + (c.isPlayer ? " self" : "");
                row.textContent = `${c.name}${c.memberNumber != null ? " (" + c.memberNumber + ")" : ""}`;
                row.addEventListener("mouseenter", () => {
                    _hoverHighlightId = c.id;
                    setFooterText(`${c.name}${c.memberNumber != null ? " (" + c.memberNumber + ")" : ""} (${c.x},${c.y})`, "character");
                    redrawNow();
                });
                row.addEventListener("mouseleave", () => {
                    if (_hoverHighlightId === c.id) _hoverHighlightId = null;
                    setFooterText(_selectedTile ? `✜ (${_selectedTile.x},${_selectedTile.y})` : "", _selectedTile ? "selection" : "empty");
                    redrawNow();
                });
                row.addEventListener("click", () => {
                    if (typeof ChatRoomFocusCharacter === "function" && c.raw) {  // eslint-disable-line
                        try { ChatRoomFocusCharacter(c.raw); } catch (e) { console.warn("[BMM] 無法開啟對話狀態", e); }
                    }
                });
                peoplePanelEl.append(row);
            }
        }

        fCnt.addEventListener("click", () => {
            const willShow = peoplePanelEl.classList.contains("hidden");
            peoplePanelEl.classList.toggle("hidden");
            if (willShow) {
              const pr = panelEl.getBoundingClientRect();
              if (pr.right + 228 > window.innerWidth) {
                peoplePanelEl.style.left = "auto";
                peoplePanelEl.style.right = "calc(100% + 8px)";
              } else {
                peoplePanelEl.style.right = "auto";
                peoplePanelEl.style.left = "calc(100% + 8px)";
              }
              updatePeoplePanel();
            }
        });

        // 拖曳
        let drag=false, ox=0, oy=0;
        hdr.addEventListener("mousedown", e => {
            drag=true;
            const r=panelEl.getBoundingClientRect();
            ox=e.clientX-r.left; oy=e.clientY-r.top;
            e.stopPropagation(); e.preventDefault();
        });
        document.addEventListener("mousemove", e => {
            if (!drag) return;
            const w = panelEl.offsetWidth, h = panelEl.offsetHeight;
            let nx = e.clientX-ox, ny = e.clientY-oy;
            nx = Math.max(4, Math.min(window.innerWidth - w - 4, nx));
            ny = Math.max(4, Math.min(window.innerHeight - h - 4, ny));
            panelEl.style.left = nx + "px";
            panelEl.style.top  = ny + "px";
        });
        document.addEventListener("mouseup", ()=>{ drag=false; });

        // 繪製 context（提前宣告，讓下方的 hover / click 事件可以立即觸發重繪，不必等 500ms 定時器）
        const ctx = cvEl.getContext("2d");
        function redrawNow() {
            if (panelEl.classList.contains("hidden")) return;
            drawMap(ctx, cvEl.width, cvEl.height);
            if (_linkedEdit) { // 联动中徽标
                const W = cvEl.width;
                ctx.save();
                ctx.font = "bold 10px monospace";
                ctx.textAlign = "right"; ctx.textBaseline = "top";
                const txt = "● " + t("tb_edit");
                const w = ctx.measureText(txt).width + 10;
                ctx.fillStyle = "rgba(20,180,120,0.85)";
                ctx.fillRect(W - w - 4, 4, w, 16);
                ctx.fillStyle = "#fff";
                ctx.fillText(txt, W - 8, 6);
                ctx.restore();
            }
        }
        _bmmRedraw = redrawNow;   // 暴露给外部（stopLink / bmmxDoImport）

        // 統一設定 footer(fHover) 的文字與樣式：
        // mode = "character" 顯示紅色（懸停角色）；"selection" 顯示主題色（選取格子，紫色主題下且有選取時會變成可點擊按鈕）；"empty" 清空
        function setFooterText(text, mode) {
            fHover.textContent = text;
            _footerMode = mode;
            fHover.classList.toggle("mm-hover-char", mode === "character");
            fHover.classList.toggle("mm-hover-tile", mode === "selection");
            const clickable = mode === "selection" && !!_selectedTile && panelEl.classList.contains("mm-theme-purple");
            fHover.classList.toggle("mm-footer-btn", clickable);
        }

        // 紫色主題下，點擊 footer 的「✜ (x,y)」文字會把玩家移動到該座標
        fHover.addEventListener("click", () => {
            if (!fHover.classList.contains("mm-footer-btn") || !_selectedTile) return;
            teleportPlayerTo(_selectedTile.x, _selectedTile.y);
            redrawNow();
        });

        // Hover：停在玩家身上時顯示「名稱(ID) (x,y)」，同時立即清除已選取的格子座標（彼此不衝突）
        let _lastHoverId = null;
        cvEl.addEventListener("mousemove", e => {
            const rect=cvEl.getBoundingClientRect();
            const mx=(e.clientX-rect.left)*(cvEl.width/rect.width);
            const my=(e.clientY-rect.top)*(cvEl.height/rect.height);
            const found = _charCache.find(c=>Math.hypot(mx-c.sx,my-c.sy)<=c.r+4);
            if (found) {
                setFooterText(`${found.name}${found.memberNumber != null ? " (" + found.memberNumber + ")" : ""} (${found.x},${found.y})`, "character");
                if (_selectedTile) { _selectedTile = null; redrawNow(); }
                else if (_lastHoverId !== found.id) redrawNow();
                _lastHoverId = found.id;
            } else {
                setFooterText(_selectedTile ? `✜ (${_selectedTile.x},${_selectedTile.y})` : "", _selectedTile ? "selection" : "empty");
                _lastHoverId = null;
            }
        });
        cvEl.addEventListener("mouseleave", () => {
            setFooterText(_selectedTile ? `✜ (${_selectedTile.x},${_selectedTile.y})` : "", _selectedTile ? "selection" : "empty");
            _lastHoverId = null;
        });

        // 點擊地圖：固定 40×40 版面，直接用目前的座標轉換公式反推格子座標（純算術，不查詢房間資料，瞬間完成）
        // 座標顯示在名稱欄位（fHover），並立即重繪，不必等待定時器
        cvEl.addEventListener("click", e => {
            if (!_mapTransform) return;
            const rect = cvEl.getBoundingClientRect();
            const mx = (e.clientX-rect.left)*(cvEl.width/rect.width);
            const my = (e.clientY-rect.top)*(cvEl.height/rect.height);
            const { ts, ox: tox, oy: toy, originX, originY } = _mapTransform;
            const tileX = originX + Math.floor((mx-tox)/ts);
            const tileY = originY + Math.floor((my-toy)/ts);
            if (tileX < 0 || tileX >= MAP_W || tileY < 0 || tileY >= MAP_H) return;
            _selectedTile = { x: tileX, y: tileY };
            setFooterText(`✜ (${tileX},${tileY})`, "selection");
            redrawNow();
        });

        // 定期重繪（人物移動、鑰匙狀態、人員清單等持續性更新）
        setInterval(()=>{
            if (panelEl.classList.contains("hidden")) return;
            drawMap(ctx, cvEl.width, cvEl.height);
            const pp = getPlayerPos();
            fPos.innerHTML = pp ? '<svg viewBox="0 0 1024 1024" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><path d="M523.7 379.1c-116.6 0-211.1 94.5-211.1 211.1s94.5 211.1 211.1 211.1 211.1-94.5 211.1-211.1-94.5-211.1-211.1-211.1zm0 336.7c-69.4 0-125.6-56.2-125.6-125.6s56.2-125.6 125.6-125.6 125.6 56.2 125.6 125.6-56.2 125.6-125.6 125.6z" fill="#B7351B"/><path d="M860.4 423.5c0 185.9-345.9 536.7-345.9 536.7S187 609.4 187 423.5 337.8 86.8 523.7 86.8s336.7 150.7 336.7 336.7z" fill="#B7351B"/></svg> (' + pp.x + ',' + pp.y + ')' : "";
            fCnt.innerHTML = '<svg viewBox="0 0 1024 1024" width="12" height="12" style="vertical-align:-1px;margin-right:2px"><path d="M409.6 248.32c-129.2 0-234 104.8-234 234s104.8 234 234 234 234-104.8 234-234-104.8-234-234-234zm0 373.2c-76.8 0-139.2-62.4-139.2-139.2s62.4-139.2 139.2-139.2 139.2 62.4 139.2 139.2-62.4 139.2-139.2 139.2z" fill="#FFA161"/><path d="M409.6 541.7c-225.8 0-409.6 183.8-409.6 409.6 0 17.4 0 58.4 58.4 58.4h702.5c58.4 0 58.4-41 58.4-58.4 0-225.8-183.8-409.6-409.6-409.6z" fill="#FFA161"/></svg>' + String(getChars().length).padStart(2, "\u2007") + '人';
            refreshKeyIndicators();
            updatePeoplePanel();
        }, 500);
    }

    // ── 擴充功能：地圖儲存 / 載入 / 匯出 / 匯入 + 跳轉線上編輯器 ─────────────────────────
    let bmmxSaveBtn = null, bmmxExpBtn = null, bmmxImpBtn = null;
    // ── 编辑器实时联动状态 ──
    let _editorWin = null;        // 编辑器窗口引用（window.open 返回）
    let _linkedEdit = false;      // 是否处于联动态
    let _livePreview = null;      // 编辑器实时回传的地图（覆盖渲染源）
    let _editorPoll = null;       // 编辑器存活检测定时器
    let _bmmRedraw = null;        // createPanel 内 redrawNow 的外部引用（解决闭包作用域）
    const BMMX_EDITOR_URL = "https://heitaoplay.github.io/bc-room-map-editor/";
    const BMMX_LZ_URL = "https://cdn.jsdelivr.net/gh/heitaoplay/bc-room-map-editor@main/src/LZString.js";
    const BMMX_DB = "bmmx_maps", BMMX_STORE = "maps";

    // 把 mappaste 串解回 {Type,Tiles,Objects,Fog}（编辑器 MapLib.decode 产出的同格式）
    function bmmxDecode(str) {
        if (!window.LZString) return null;
        try { return JSON.parse(window.LZString.decompressFromBase64(str)); } catch (e) { return null; }
    }
    // 联动态下绘制用的地图源：优先用编辑器实时预览
    function getRenderMap() { return (_linkedEdit && _livePreview) ? _livePreview : getMapData(); }
    function stopLink() {
        _linkedEdit = false; _livePreview = null; _editorWin = null;
        if (_editorPoll) { clearInterval(_editorPoll); _editorPoll = null; }
        try { if (_bmmRedraw) _bmmRedraw(); } catch (e) {}
    }

    // ── 剪贴板自动检测 + 地图导入（确认回执，防误覆盖）──
    let _pendingImport = null;       // 编辑器「应用到游戏」回传、待确认导入的地图串
    let _lastPromptedTiles = null;   // 已弹确认框的地图 Tiles 签名，避免重复打扰
    let _clipChecking = false;       // 防 focus/visibility 并发重入
    let _importOv = null;            // 当前导入确认框

    // 校验字符串是否为有效地图（mappaste 压缩串或原始 JSON），返回解析对象或 null
    function bmmxIsValidMap(str) {
        if (!str || typeof str !== "string" || str.length < 20) return null;
        const s = str.trim();
        const dec = bmmxDecode(s);
        if (dec && dec.Tiles && typeof dec.Tiles === "string" && dec.Tiles.length >= 100) return dec;
        try { const o = JSON.parse(s); if (o && o.Tiles && typeof o.Tiles === "string" && o.Tiles.length >= 100) return o; } catch (e) {}
        return null;
    }
    // 与当前房间地图是否不同（相同则已应用/无需导入）
    function bmmxMapDiffers(map) {
        const cur = getMapData();
        return !(cur && cur.Tiles && cur.Tiles === map.Tiles);
    }
    function _bmmxToast(msg) {
        let el = document.getElementById("bmmx-toast");
        if (!el) { el = document.createElement("div"); el.id = "bmmx-toast"; document.body.appendChild(el); }
        el.textContent = msg; el.classList.add("show");
        clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2600);
    }
    // 返回 BMM（焦点/可见）时自动检测：优先编辑器回传串，其次系统剪贴板
    async function bmmxCheckImportOnReturn() {
        if (_clipChecking) return;
        _clipChecking = true;
        try {
            if (typeof ChatRoomData === "undefined" || !ChatRoomData) return;
            await bmmxEnsureLZ();
            // 1) 编辑器回传（可靠，无需剪贴板权限）
            if (_pendingImport) {
                const str = _pendingImport; _pendingImport = null;
                const map = bmmxIsValidMap(str);
                if (map && bmmxMapDiffers(map) && map.Tiles !== _lastPromptedTiles) { bmmxPromptImport(str, "editor"); return; }
            }
            // 2) 系统剪贴板检测（用户从聊天/别处复制了地图串）
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const txt = (await navigator.clipboard.readText()).trim();
                    const map = bmmxIsValidMap(txt);
                    if (map && bmmxMapDiffers(map) && map.Tiles !== _lastPromptedTiles) { bmmxPromptImport(txt, "clipboard"); return; }
                }
            } catch (e) { /* 剪贴板读权限被拒，静默忽略 */ }
        } finally { _clipChecking = false; }
    }
    // 弹出确认框：明确告知将覆盖现有地图，确认后才执行
    function bmmxPromptImport(str, source) {
        const map = bmmxIsValidMap(str);
        if (!map) { alert(t("clip_import_fail", { reason: t("clip_import_empty") })); return; }
        _lastPromptedTiles = map.Tiles;
        if (_importOv) _importOv.remove();
        const ov = document.createElement("div"); ov.id = "bc-minimap-import-ov";
        const srcLabel = source === "editor" ? t("clip_import_from_editor") : t("clip_import_from_clipboard");
        ov.innerHTML =
            '<span class="close">✕</span>' +
            '<h3>' + t("clip_import_title") + '</h3>' +
            '<div class="warn">⚠️ ' + t("clip_import_body") + '</div>' +
            '<div class="src">🔗 ' + srcLabel + '</div>' +
            '<div class="acts">' +
                '<button class="mm-btn ok" type="button" id="bmmx-imp-ok">' + t("clip_import_confirm") + '</button>' +
                '<button class="mm-btn no" type="button" id="bmmx-imp-no">' + t("clip_import_cancel") + '</button>' +
            '</div>';
        document.body.appendChild(ov);
        const close = () => { if (_importOv) { _importOv.remove(); _importOv = null; } };
        ov.querySelector(".close").onclick = close;
        ov.querySelector("#bmmx-imp-no").onclick = close;
        ov.querySelector("#bmmx-imp-ok").onclick = () => { close(); bmmxDoImport(str, map); };
        _importOv = ov;
    }
    // 确认后：写入房间地图并广播（等价于手动 /mappaste <串>）
    function bmmxDoImport(str, map) {
        try {
            const payload = { Type: map.Type, Tiles: map.Tiles, Objects: map.Objects, Fog: map.Fog };
            if (typeof ChatRoomData !== "undefined" && ChatRoomData) ChatRoomData.MapData = payload; // 本地即时反馈（与 BC 原生 MapPaste 一致）
            if (typeof ServerSend === "function") ServerSend("ChatRoomMapData", payload);
            if (_bmmRedraw) _bmmRedraw();
            _bmmxToast(t("clip_import_done"));
        } catch (e) { alert(t("clip_import_fail", { reason: (e && e.message) || String(e) })); }
    }

    function bmmxOpenDB() {
        return new Promise((res, rej) => {
            const r = indexedDB.open(BMMX_DB, 1);
            r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(BMMX_STORE)) r.result.createObjectStore(BMMX_STORE, { keyPath: "id" }); };
            r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
        });
    }
    function bmmxStore(db, mode) { return db.transaction(BMMX_STORE, mode).objectStore(BMMX_STORE); }
    function bmmxPut(rec) { return bmmxOpenDB().then(db => new Promise((res, rej) => { const r = bmmxStore(db, "readwrite").put(rec); r.onsuccess = () => res(); r.onerror = () => rej(r.error); })); }
    function bmmxAll() { return bmmxOpenDB().then(db => new Promise((res, rej) => { const r = bmmxStore(db, "readonly").getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); })); }
    function bmmxDel(id) { return bmmxOpenDB().then(db => new Promise((res, rej) => { const r = bmmxStore(db, "readwrite").delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); })); }

    function bmmxEnsureLZ() {
        if (window.LZString) return Promise.resolve(true);
        return new Promise(res => {
            const s = document.createElement("script"); s.src = BMMX_LZ_URL;
            s.onload = () => res(!!window.LZString); s.onerror = () => res(false);
            document.head.appendChild(s);
        });
    }
    function bmmxMapToStr(md) {
        const payload = { Type: md.Type, Tiles: md.Tiles, Objects: md.Objects, Fog: md.Fog };
        return window.LZString ? window.LZString.compressToBase64(JSON.stringify(payload)) : JSON.stringify(payload);
    }
    async function openEditorWith(md) {
        await bmmxEnsureLZ();
        const str = bmmxMapToStr(md);
        // 已联动中再次点击 → 把游戏当前地图重新推给编辑器
        if (_editorWin && !_editorWin.closed) {
            _editorWin.postMessage({ source: "bmm", type: "load", map: str }, "*");
            _editorWin.focus();
            return;
        }
        const w = window.open(BMMX_EDITOR_URL + "?from=bmm", "_blank");
        if (!w) { // 弹窗被拦截，降级为复制串
            try { if (navigator.clipboard) await navigator.clipboard.writeText(str).catch(() => {}); } catch (e) {}
            alert(t("map_copied"));
            return;
        }
        _editorWin = w;
        const onMsg = (e) => {
            window.__bmmOnMsg = onMsg;
            const d = e.data || {};
            if (d.source !== "bmm-editor") return;
            if (_editorWin && e.source !== _editorWin) return; // 仅接受来自该编辑器标签页的消息
            if (d.type === "ready") {
                _editorWin.postMessage({ source: "bmm", type: "load", map: str }, "*");
            } else if (d.type === "live") {
                const dec = bmmxDecode(d.map);
                if (dec && dec.Tiles) { _linkedEdit = true; _livePreview = dec; try { if (_bmmRedraw) _bmmRedraw(); } catch (e2) {} }
            } else if (d.type === "export") {
                _pendingImport = d.map || null;
                try { if (navigator.clipboard) navigator.clipboard.writeText(d.map).catch(() => {}); } catch (e3) {}
                // 不在此弹窗；玩家返回 BMM（焦点）时自动检测并弹确认框
                setTimeout(() => bmmxCheckImportOnReturn().catch(() => {}), 200);
            } else if (d.type === "pong") {
                // 编辑器存活确认
            }
        };
        window.addEventListener("message", onMsg);
        // 编辑器存活检测：关闭后自动回退游戏地图
        _editorPoll = setInterval(() => {
            if (_editorWin && _editorWin.closed) {
                window.removeEventListener("message", onMsg);
                stopLink();
            }
        }, 1000);
        // 兜底：2s 后若编辑器仍未发 ready（可能已加载完），直接推一次地图
        setTimeout(() => {
            if (_editorWin && !_editorWin.closed) _editorWin.postMessage({ source: "bmm", type: "load", map: str }, "*");
        }, 2000);
    }
    // 自定义纸质地图风格保存名称输入模态框（替代浏览器原生 prompt）
    function showSaveNameDialog(defaultName) {
      return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.id = 'bc-minimap-save-dialog';
        ov.innerHTML = '<div class="sd-inner">' +
          '<h3>' + t("tb_save") + '</h3>' +
          '<label>' + t("save_prompt") + '</label>' +
          '<input type="text" id="bmm-save-input" value="' + defaultName.replace(/"/g,'&quot;') + '" />' +
          '<div class="sd-acts"><button type="button" class="mm-btn sd-cancel">取消</button><button type="button" class="mm-btn sd-ok">确定</button></div>' +
          '</div>';
        document.body.appendChild(ov);
        const inp = ov.querySelector('#bmm-save-input');
        setTimeout(() => inp.focus(), 50);
        inp.select();
        ov.querySelector('.sd-cancel').onclick = () => { ov.remove(); resolve(''); };
        ov.querySelector('.sd-ok').onclick = () => { const v = inp.value.trim(); ov.remove(); resolve(v); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ov.querySelector('.sd-ok').click(); } if (e.key === 'Escape') { ov.querySelector('.sd-cancel').click(); } });
        ov.addEventListener('click', (e) => { if (e.target === ov) { ov.remove(); resolve(''); } });
      });
    }

    async function saveCurrentMap() {
        const md = getMapData();
        if (!md || !md.Tiles) { alert(t("alert_no_save")); return; }
        const room = (ChatRoomData && ChatRoomData.Name) || "map";
        const def = room + " " + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const name = await showSaveNameDialog(def);
        if (!name) return;
        const rec = { id: "m_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), name, savedAt: Date.now(), Type: md.Type, Tiles: md.Tiles, Objects: md.Objects, Fog: md.Fog };
        try { await bmmxPut(rec); flashBtn(bmmxSaveBtn); } catch (e) { alert(t("save_fail") + e); }
    }
    let _bmmxLoadOv = null;
    function showLoadOverlay() {
        if (_bmmxLoadOv) { _bmmxLoadOv.remove(); _bmmxLoadOv = null; }
        const ov = document.createElement("div"); ov.id = "bc-minimap-load-ov";
        ov.innerHTML = '<span class="close">✕</span><h3>' + t("ov_title") + '</h3><div class="list"></div>';
        document.body.appendChild(ov);
        ov.querySelector(".close").onclick = () => { ov.remove(); _bmmxLoadOv = null; };
        _bmmxLoadOv = ov;
        refreshLoadOverlay(ov);
    }
    async function refreshLoadOverlay(ov) {
        ov = ov || _bmmxLoadOv; if (!ov) return;
        const list = ov.querySelector(".list");
        let maps = []; try { maps = await bmmxAll(); } catch (e) { maps = []; }
        if (!maps.length) { list.innerHTML = '<div class="empty">' + t("ov_empty") + '</div>'; return; }
        list.innerHTML = "";
        maps.sort((a, b) => b.savedAt - a.savedAt).forEach(m => {
            const row = document.createElement("div"); row.className = "row";
            const meta = document.createElement("div"); meta.className = "meta"; meta.textContent = m.name + "  ·  " + new Date(m.savedAt).toLocaleString();
            const acts = document.createElement("div"); acts.className = "acts";
            const bOpen = document.createElement("button"); bOpen.className = "mm-btn"; bOpen.type = "button"; bOpen.textContent = t("ov_editor"); bOpen.onclick = () => { openEditorWith(m); if (_bmmxLoadOv) { _bmmxLoadOv.remove(); _bmmxLoadOv = null; } };
            const bLoad = document.createElement("button"); bLoad.className = "mm-btn"; bLoad.type = "button"; bLoad.textContent = t("ov_load"); bLoad.onclick = () => {
                if (!confirm(t("ov_load_confirm", { name: m.name }))) return;
                bmmxDoImport(bmmxMapToStr(m), m);
            };
            const bDel = document.createElement("button"); bDel.className = "mm-btn"; bDel.type = "button"; bDel.textContent = t("ov_delete"); bDel.onclick = async () => { if (confirm(t("ov_del_confirm", { name: m.name }))) { await bmmxDel(m.id); refreshLoadOverlay(ov); } };
            acts.append(bOpen, bLoad, bDel); row.append(meta, acts); list.appendChild(row);
        });
    }
    async function exportAllMaps() {
        let maps = []; try { maps = await bmmxAll(); } catch (e) { maps = []; }
        if (!maps.length) { alert(t("export_none")); return; }
        const blob = new Blob([JSON.stringify(maps, null, 0)], { type: "application/json" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "bmm-maps-" + new Date().toISOString().slice(0, 10) + ".json"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        flashBtn(bmmxExpBtn);
    }
    function importMaps() {
        const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = ".json,.bcroom,.txt";
        inp.onchange = async () => {
            const files = Array.prototype.slice.call(inp.files); let n = 0;
            for (const f of files) {
                try {
                    const text = (await f.text()).trim(); if (!text) continue;
                    let data; try { data = JSON.parse(text); } catch (e) { continue; }
                    const arr = Array.isArray(data) ? data : (data && data.Tiles ? [data] : []);
                    for (const m of arr) {
                        if (m && m.Tiles) {
                            const rec = { id: m.id || ("imp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)), name: m.name || f.name, savedAt: m.savedAt || Date.now(), Type: m.Type, Tiles: m.Tiles, Objects: m.Objects, Fog: m.Fog };
                            await bmmxPut(rec); n++;
                        }
                    }
                } catch (e) { console.warn("[BMMX] import fail", f.name, e); }
            }
            flashBtn(bmmxImpBtn);
            if (_bmmxLoadOv) refreshLoadOverlay(_bmmxLoadOv);
        };
        inp.click();
    }
    function flashBtn(b) {
        if (!b) return; const old = b.textContent; b.classList.add("active");
        setTimeout(() => { b.textContent = old; b.classList.remove("active"); }, 900);
    }

    function togglePanel() {
        if (!panelEl) createPanel();
        const isHidden = panelEl.classList.contains("hidden");
        if (isHidden) {
            // Opening: remove hidden + closing, trigger bmmPanelIn
            panelEl.classList.remove("hidden", "mm-closing");
            const size = mapMode === "full" ? FULL_SIZE : mapMode === "complete" ? COMPLETE_SIZE : LOCAL_SIZE;
            const BW = 6;
            panelEl.style.setProperty("width", (size + BW) + "px");
            panelEl.style.setProperty("height", (HDR_H + size + TOOLBAR_H + FTR_H + BW) + "px");
            panelEl.style.setProperty("overflow", "visible");
            panelEl.style.setProperty("max-height", "none");
            // 立即重绘，避免打开面板时画布空白等 500ms 定时器
            if (_bmmRedraw) _bmmRedraw();
        } else {
            // Closing: play bmmPanelOut animation then hide
            panelEl.classList.add("mm-closing");
            panelEl.addEventListener("animationend", function handler() {
                panelEl.removeEventListener("animationend", handler);
                panelEl.classList.add("hidden");
                panelEl.classList.remove("mm-closing");
            }, { once: true });
        }
    }

    // ── 啟動 ─────────────────────────────────────────────────────────────────
    function waitFor(fn, timeout=30000) {
        return new Promise(res=>{
            const t=Date.now();
            const id=setInterval(()=>{
                if(fn()){clearInterval(id);res(true);}
                else if(Date.now()-t>timeout){clearInterval(id);res(false);}
            },200);
        });
    }
    function waitForLogin(modApi) {
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

    (async()=>{
        await waitFor(()=>typeof bcModSdk!=="undefined");  // eslint-disable-line

        let modApi;
        try {
            modApi=bcModSdk.registerMod({
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository",  // eslint-disable-line
                name:"Liko - BMM", fullName:"Liko's BC MiniMap", version:MOD_VER,
            }, { allowReplace: true });
        } catch(e) {
            // Mod already registered from previous injection — continue with shim so panel/hooks still set up
            console.warn("[BMM] registerMod already loaded, re-initializing panel:", e.message);
            modApi = { hookFunction: () => ((args,next)=>next(args)), unload: ()=>{} };
        }

        await waitForLogin(modApi);
        await waitFor(()=>typeof ChatRoomMapViewTileList!=="undefined");  // eslint-disable-line

        // 剪贴板自动检测 + 地图导入：返回 BMM 焦点时自动检测（编辑器回传 / 系统剪贴板）
        if (!window.__bmmClipLinked) {
            window.__bmmClipLinked = true;
            window.__bmmFocusHandler = () => { bmmxCheckImportOnReturn().catch(() => {}); };
            window.__bmmVisHandler = () => { if (!document.hidden) bmmxCheckImportOnReturn().catch(() => {}); };
            window.addEventListener("focus", window.__bmmFocusHandler);
            document.addEventListener("visibilitychange", window.__bmmVisHandler);
        }

        // Remove stale panel before recreating (handles re-injection)
        const oldPanel = document.getElementById("bc-minimap-root");
        if (oldPanel) oldPanel.remove();

        createPanel();
        // Apply initial panel sizing (toolbar is inside footer, no separate positioning needed)
        const _p = document.getElementById("bc-minimap-root");
        const _cv = document.getElementById("bc-minimap-canvas");
        if (_cv && _p) {
            const size = mapMode === "full" ? FULL_SIZE : mapMode === "complete" ? COMPLETE_SIZE : LOCAL_SIZE;
            const BW = 6;
            // 缓冲区已在 createPanel 中固定为 COMPLETE_SIZE(640)，此处只改 CSS 显示尺寸，
            // 不重设 _cv.width/_cv.height，避免覆盖掉固定缓冲区导致切换时重新分配后端存储掉帧。
            _cv.style.width = size + "px";
            _cv.style.height = size + "px";
            _p.style.setProperty("width", (size + BW) + "px", "important");
            _p.style.setProperty("height", (HDR_H + size + TOOLBAR_H + FTR_H + BW) + "px", "important");
            _p.style.setProperty("overflow", "visible", "important");
            _p.style.setProperty("max-height", "none", "important");
        }
        // 首次加载立即重绘（缓冲区在 createPanel 已按 COMPLETE_SIZE 清空并绘制）
        if (_bmmRedraw) _bmmRedraw();
        console.log(`🐈‍⬛ [BMM] ✅ v${MOD_VER} loaded`);

        // 按鈕顯示狀態需要連續幾幀都判定一致才會真正切換，避免遊戲內部狀態
        // 短暫變動（例如 CurrentCharacter 瞬間變化）造成按鈕忽隱忽現的高速閃爍。
        // 注意：BC 每一幀都會把整個畫布清空重畫，所以「判定通過後」仍必須每幀畫一次
        // 按鈕，否則按鈕反而會因為沒被畫出而消失、造成更嚴重的閃爍。
        const BTN_STABLE_FRAMES = 3;
        let _btnShowStreak = 0, _btnHideStreak = 0, _btnShouldShow = false;

        modApi.hookFunction("GameRun", 0, (args, next)=>{
            const r=next(args);

            const raw = canShowMapButton();
            if (raw) { _btnShowStreak++; _btnHideStreak = 0; }
            else     { _btnHideStreak++; _btnShowStreak = 0; }
            if (_btnShowStreak >= BTN_STABLE_FRAMES) _btnShouldShow = true;
            if (_btnHideStreak >= BTN_STABLE_FRAMES) _btnShouldShow = false;

            if (!_btnShouldShow) {
                if (panelEl && typeof CurrentCharacter !== "undefined" && CurrentCharacter !== null) {
                    panelEl.classList.add("hidden");
                }
                return r;
            }
            const isOpen = panelEl && !panelEl.classList.contains("hidden");
            const oldAlpha = MainCanvas.globalAlpha;
            try {
                MainCanvas.globalAlpha = 0.65;
                DrawButton(955, 0, 45, 45, isOpen ? "▼" : "🗺️", isOpen ? "#223322" : "#1a1a2e", "", "MiniMap");
            } finally {
                MainCanvas.globalAlpha = oldAlpha;
            }
            return r;
        });

        modApi.hookFunction("ChatRoomClick", 0, (args, next)=>{
            if (!canShowMapButton()) return next(args);
            if (MouseIn(955, 0, 45, 45)){ togglePanel(); return; }  // eslint-disable-line
            return next(args);
        });

        modApi.hookFunction("ChatRoomLeave", 0, (args, next)=>{
            if (panelEl) panelEl.classList.add("hidden");
            _tlCache = null; _olCache = null; _lastMapData = null; _charCache = [];
            return next(args);
        });
    })();
})();