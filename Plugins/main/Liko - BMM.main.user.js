// ==UserScript==
// @name         liko - BMM
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0.3
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
    const MOD_VER = "1.0.3";
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
    function drawStyled(ctx, x, y, w, h, vis) {
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
            raw: c, // 保留原始 Character 物件，"完整"模式判斷 AssetName/OccupiedStyle 時會用到
        }));
    }
    function getCharAtPos(chars, x, y) {
        for (const c of chars) if (c.x === x && c.y === y) return c.raw;
        return null;
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
                        drawStyled(ctx, ox+x*ts+pad, oy+y*ts+pad, ts-pad*2, ts-pad*2, vis);
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

        } else {
            const cells = VIEW_RANGE*2+1;
            const ts = Math.floor(Math.min(W, H) / cells);
            const ox = Math.floor((W - ts*cells)/2), oy = Math.floor((H - ts*cells)/2);
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
                                drawStyled(ctx, sx+pad, sy+pad, ts-pad*2, ts-pad*2, vis);
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
          position: fixed;
          top: 60px;
          left: 80px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          background: rgba(10,10,25,0.95);
          border: 1.5px solid rgba(0,255,136,0.45);
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(0,255,136,0.12);
          font-family: monospace;
          user-select: none;
          overflow: visible !important;
        }
        #bc-minimap-root.hidden { display: none !important; }
        #bc-minimap-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          height: 36px;
          min-height: 36px;
          cursor: move;
          background: rgba(0,255,136,0.08);
          border-bottom: 1px solid rgba(0,255,136,0.2);
          border-radius: 8px 8px 0 0;
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
          border-top: 1px solid rgba(0,255,136,0.15);
          font-size: 13px;
          color: #448866;
          background: rgba(0,0,0,0.3);
          border-radius: 0 0 8px 8px;
          margin-top: auto;
        }
        #bc-minimap-ftr span { flex: 1; }
        #bc-minimap-ftr span:first-child { text-align: left; }
        #bc-minimap-ftr span:nth-child(2) { text-align: center; }
        #bc-minimap-ftr span:last-child  { text-align: right; }
        .mm-btn {
          background: transparent;
          border: 1px solid rgba(0,255,136,0.3);
          border-radius: 3px;
          color: #668866;
          font-size: 9px;
          padding: 2px 6px;
          cursor: pointer;
          font-family: monospace;
        }
        .mm-btn.active {
          background: rgba(0,255,136,0.2);
          border-color: rgba(0,255,136,0.6);
          color: #00ff88;
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
        title.textContent = `🗺️ ${ChatRoomData?.Name ?? "MiniMap"}`;
        title.style.cssText = "color:#00ff88;font-size:11px;font-weight:bold;letter-spacing:1px;";

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
        hdr.append(title, btns);

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
        fHover.style.color = "#ff8888";
        ftr.append(fPos, fHover, fCnt);

        panelEl.append(hdr, cvEl, ftr);
        document.body.appendChild(panelEl);

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

        // Hover
        cvEl.addEventListener("mousemove", e => {
            const rect=cvEl.getBoundingClientRect();
            const mx=(e.clientX-rect.left)*(cvEl.width/rect.width);
            const my=(e.clientY-rect.top)*(cvEl.height/rect.height);
            fHover.textContent = _charCache.find(c=>Math.hypot(mx-c.sx,my-c.sy)<=c.r+4)?.name||"";
        });
        cvEl.addEventListener("mouseleave",()=>{ fHover.textContent=""; });

        // 繪製
        const ctx=cvEl.getContext("2d");
        setInterval(()=>{
            if (panelEl.classList.contains("hidden")) return;
            drawMap(ctx, cvEl.width, cvEl.height);
            const pp = getPlayerPos();
            fPos.textContent = pp ? `📍 (${pp.x},${pp.y})` : "";
            fCnt.textContent = `👤 ${_charCache.length + (getPlayerPos() ? 1 : 0)}人`; // charCache 不含玩家自己（local模式）
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