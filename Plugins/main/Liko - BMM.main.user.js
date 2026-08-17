// ==UserScript==
// @name         liko - BMM
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.0
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
    if (window.Liko.BMM) return;
    const MOD_VER = "1.1.0";
    window.Liko.BMM = MOD_VER;

    const HDR_H = 36, FTR_H = 32;
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
                console.warn("[BMM] 管理員瞬移失敗，改用本地移動", e);
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
        const md = getMapData();
        const chars = getChars();

        if (!md?.Tiles) {
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,60,60,0.5)";
            ctx.font = "13px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("目前不在地圖房間內", W/2, H/2);
            ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
            _charCache = [];
            return;
        }

        if (typeof DrawGetImage !== "function") {  // eslint-disable-line
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,200,60,0.8)";
            ctx.font = "12px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("找不到遊戲繪圖函式 DrawGetImage，無法使用「完整」模式", W/2, H/2);
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
        const md = getMapData();
        const pp = getPlayerPos();

        if (!md?.Tiles || !pp) {
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = "rgba(255,60,60,0.5)";
            ctx.font = "13px monospace";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("目前不在地圖房間內", W/2, H/2);
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
            const cells = VIEW_RANGE*2+1;
            const ts = Math.floor(Math.min(W, H) / cells);
            const ox = Math.floor((W - ts*cells)/2), oy = Math.floor((H - ts*cells)/2);
            _mapTransform = { mode: "local", ts, ox, oy, originX: pp.x - VIEW_RANGE, originY: pp.y - VIEW_RANGE };
            ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, W, H);

            for (let dy = -VIEW_RANGE; dy <= VIEW_RANGE; dy++)
                for (let dx = -VIEW_RANGE; dx <= VIEW_RANGE; dx++) {
                    const mx = pp.x+dx, my = pp.y+dy;
                    const sx = ox+(dx+VIEW_RANGE)*ts, sy = oy+(dy+VIEW_RANGE)*ts;
                    if (mx<0||mx>=MAP_W||my<0||my>=MAP_H) {
                        ctx.fillStyle="#0d0d1a"; ctx.fillRect(sx,sy,ts,ts); continue;
                    }
                    const idx = my*MAP_W+mx;
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
                                // 一律用方形／星形等非圓形樣式繪製，避免和圓形的玩家標記混淆
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
                const ddx = c.x-pp.x, ddy = c.y-pp.y;
                if (Math.abs(ddx)>VIEW_RANGE||Math.abs(ddy)>VIEW_RANGE) continue;
                const sx = ox+(ddx+VIEW_RANGE)*ts+ts/2, sy = oy+(ddy+VIEW_RANGE)*ts+ts/2;
                const r = Math.max(4, Math.floor(ts*.3));
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2);
                ctx.fillStyle=c.color; ctx.fill();
                ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.stroke();
                _charCache.push({ ...c, sx, sy, r });
            }

            // 玩家（中心，紅色）
            const cx = ox+VIEW_RANGE*ts+ts/2, cy = oy+VIEW_RANGE*ts+ts/2;
            const pr = Math.max(5, Math.floor(ts*.35));
            ctx.beginPath(); ctx.arc(cx, cy, pr+3, 0, Math.PI*2);
            ctx.fillStyle="rgba(255,60,60,0.2)"; ctx.fill();
            ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2);
            ctx.fillStyle="#ff3c3c"; ctx.fill();
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
          padding: 0 10px;
          height: 36px;
          min-height: 36px;
          cursor: move;
          background: rgba(var(--mm-rgb),0.08);
          border-bottom: 1px solid rgba(var(--mm-rgb),0.2);
          border-radius: 8px 8px 0 0;
        }
        .mm-title {
          color: rgb(var(--mm-rgb));
          font-size: 11px;
          font-weight: bold;
          letter-spacing: 1px;
          cursor: pointer;
        }
        #bc-minimap-canvas {
          display: block;
          flex-shrink: 0;
        }
        #bc-minimap-ftr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          height: 32px;
          min-height: 32px;
          border-top: 1px solid rgba(var(--mm-rgb),0.15);
          font-size: 13px;
          color: rgb(var(--mm-rgb));
          background: rgba(0,0,0,0.3);
          border-radius: 0 0 8px 8px;
          margin-top: auto;
        }
        #bc-minimap-ftr span { flex: 1; }
        #bc-minimap-ftr span:first-child { text-align: left; }
        #bc-minimap-ftr span:nth-child(2) { text-align: center; }
        #bc-minimap-ftr span:last-child  { text-align: right; }
        #bc-minimap-ftr .mm-hover-char { color: #ff8888; }
        #bc-minimap-ftr .mm-hover-tile { color: rgb(var(--mm-rgb)); }
        #bc-minimap-ftr .mm-hover-tile.mm-footer-btn {
          cursor: pointer;
          text-decoration: underline;
        }
        .mm-btn {
          background: transparent;
          border: 1px solid rgba(var(--mm-rgb),0.3);
          border-radius: 3px;
          color: #668866;
          font-size: 9px;
          padding: 2px 6px;
          cursor: pointer;
          font-family: monospace;
        }
        .mm-btn.active {
          background: rgba(var(--mm-rgb),0.2);
          border-color: rgba(var(--mm-rgb),0.6);
          color: rgb(var(--mm-rgb));
        }
        .mm-key {
          display: block;
          color: #555555;
          opacity: 0.55;
          transition: color .2s, opacity .2s, filter .2s;
        }
        #bc-minimap-ftr span.mm-clickable {
          cursor: pointer;
          text-decoration: underline dotted;
        }
        #bc-minimap-people {
          position: absolute;
          top: 0;
          left: calc(100% + 8px);
          width: 220px;
          max-height: 100%;
          overflow-y: auto;
          background: rgba(10,10,25,0.97);
          border: 1.5px solid rgba(var(--mm-rgb),0.45);
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(var(--mm-rgb),0.12);
          font-family: monospace;
          font-size: 12px;
          color: #cccccc;
        }
        #bc-minimap-people.hidden { display: none !important; }
        #bc-minimap-people-hdr {
          padding: 8px 10px;
          color: rgb(var(--mm-rgb));
          font-weight: bold;
          border-bottom: 1px solid rgba(var(--mm-rgb),0.25);
        }
        .mm-people-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .mm-people-row:hover { background: rgba(var(--mm-rgb),0.15); }
        .mm-people-row.self { color: #ff8888; }
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
        title.textContent = `🗺️ ${ChatRoomData?.Name ?? "MiniMap"}`;
        title.title = "雙擊切換配色主題";
        title.addEventListener("dblclick", () => {
            panelEl.classList.toggle("mm-theme-purple");
            // 重新套用目前 footer 顯示內容的按鈕狀態（顏色/可否點擊會隨主題改變）
            setFooterText(fHover.textContent, _footerMode);
        });

        // 鑰匙狀態指示（銅／銀／金），預設灰色，拿到後點亮對應顏色
        // 使用 SVG + currentColor 而非 emoji，確保三種顏色能被精準染色（emoji 本身顏色由系統字型決定，無法可靠改色）
        const KEY_SVG = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2.3"/><rect x="12.2" y="11" width="2.2" height="9" fill="currentColor"/><rect x="12.2" y="14.5" width="5" height="2" fill="currentColor"/><rect x="12.2" y="17.5" width="4" height="2" fill="currentColor"/></svg>';
        const keysWrap = document.createElement("div");
        keysWrap.id = "bc-minimap-keys";
        keysWrap.style.cssText = "display:flex;gap:4px;margin-left:8px;";
        const keyBronze = document.createElement("span");
        const keySilver = document.createElement("span");
        const keyGold   = document.createElement("span");
        keyBronze.className = keySilver.className = keyGold.className = "mm-key";
        keyBronze.innerHTML = keySilver.innerHTML = keyGold.innerHTML = KEY_SVG;
        keyBronze.title = "銅鑰匙"; keySilver.title = "銀鑰匙"; keyGold.title = "金鑰匙";
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
        btns.style.cssText = "display:flex;gap:4px;";
        const bLocal = document.createElement("button");
        bLocal.className = "mm-btn active"; bLocal.textContent = "局部";
        const bFull  = document.createElement("button");
        bFull.className  = "mm-btn"; bFull.textContent = "全圖";
        const bComplete = document.createElement("button");
        bComplete.className = "mm-btn"; bComplete.textContent = "完整";
        const bClose = document.createElement("button");
        bClose.className = "mm-btn"; bClose.textContent = "✕";

        function sizeForMode(m) {
            if (m === "full") return FULL_SIZE;
            if (m === "complete") return COMPLETE_SIZE;
            return LOCAL_SIZE;
        }

        function setMode(m) {
            mapMode = m;
            bLocal.className    = "mm-btn" + (m==="local"    ? " active" : "");
            bFull.className     = "mm-btn" + (m==="full"     ? " active" : "");
            bComplete.className = "mm-btn" + (m==="complete" ? " active" : "");
            const size = sizeForMode(m);
            cvEl.width  = size;
            cvEl.height = size;
            cvEl.style.width  = size + "px";
            cvEl.style.height = size + "px";
            panelEl.style.setProperty("width",    size + "px",                    "important");
            panelEl.style.setProperty("height",   (HDR_H + size + FTR_H) + "px", "important");
            panelEl.style.setProperty("overflow", "visible",                      "important"); // ← 新增
            panelEl.style.setProperty("max-height", "none",                       "important"); // ← 新增
        }
        bLocal.onclick    = () => setMode("local");
        bFull.onclick     = () => setMode("full");
        bComplete.onclick = () => setMode("complete");
        bClose.onclick    = () => panelEl.classList.add("hidden");

        btns.append(bLocal, bFull, bComplete, bClose);
        hdr.append(title, keysWrap, btns);

        // Canvas
        cvEl = document.createElement("canvas");
        cvEl.id = "bc-minimap-canvas";
        cvEl.width = cvEl.height = LOCAL_SIZE;
        cvEl.style.width  = LOCAL_SIZE + "px";
        cvEl.style.height = LOCAL_SIZE + "px";

        // Footer
        const ftr = document.createElement("div");
        ftr.id = "bc-minimap-ftr";
        fPos   = document.createElement("span");
        fHover = document.createElement("span");
        fCnt   = document.createElement("span");
        fCnt.classList.add("mm-clickable");
        fCnt.title = "點擊查看房間內所有人";
        ftr.append(fPos, fHover, fCnt);

        panelEl.append(hdr, cvEl, ftr);
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
            header.textContent = `👤 房間內 ${chars.length} 人`;
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
            peoplePanelEl.classList.toggle("hidden");
            if (!peoplePanelEl.classList.contains("hidden")) updatePeoplePanel();
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
            panelEl.style.left=(e.clientX-ox)+"px";
            panelEl.style.top=(e.clientY-oy)+"px";
        });
        document.addEventListener("mouseup", ()=>{ drag=false; });

        // 繪製 context（提前宣告，讓下方的 hover / click 事件可以立即觸發重繪，不必等 500ms 定時器）
        const ctx = cvEl.getContext("2d");
        function redrawNow() {
            if (panelEl.classList.contains("hidden")) return;
            drawMap(ctx, cvEl.width, cvEl.height);
        }

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
            fPos.textContent = pp ? `📍 (${pp.x},${pp.y})` : "";
            fCnt.textContent = `👤 ${String(getChars().length).padStart(2, "\u2007")}人`;
            refreshKeyIndicators();
            updatePeoplePanel();
        }, 500);
    }

    function togglePanel() {
        if (!panelEl) createPanel();
        panelEl.classList.toggle("hidden");

        // 顯示後強制套用正確尺寸
        if (!panelEl.classList.contains("hidden")) {
            const size = mapMode === "full" ? FULL_SIZE : mapMode === "complete" ? COMPLETE_SIZE : LOCAL_SIZE;
            panelEl.style.setProperty("width",    size + "px",                    "important");
            panelEl.style.setProperty("height",   (HDR_H + size + FTR_H) + "px", "important");
            panelEl.style.setProperty("overflow", "visible",                      "important");
            panelEl.style.setProperty("max-height", "none",                       "important");
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

        const modApi=bcModSdk.registerMod({
            repository: "https://github.com/awdrrawd/liko-Plugin-Repository",  // eslint-disable-line
            name:"Liko - BMM", fullName:"Liko's BC MiniMap", version:MOD_VER,
        });

        await waitForLogin(modApi);
        await waitFor(()=>typeof ChatRoomMapViewTileList!=="undefined");  // eslint-disable-line

        createPanel();
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