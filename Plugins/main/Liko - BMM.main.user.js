// ==UserScript==
// @name         liko - BMM
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  BC 地圖房迷你地圖
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.0";
    if (window.Liko.BMM) return;
    window.Liko.BMM = MOD_VER;

    const HDR_H = 36, FTR_H = 32;
    const MAP_W = 40, MAP_H = 40, OBJ_START = 100, VIEW_RANGE = 10;
    const LOCAL_SIZE = 300;
    const FULL_SIZE  = 500;

    const TILE_COLORS = {
        Floor:"#c8b89a", FloorExterior:"#7a9e6e",
        Wall:"#3a3a4a", Water:"#4488bb", default:"#555566",
    };
    const OBJ_COLORS = {
        FloorDecoration:"#e8d4a0", FloorDecorationThemed:"#d4b0c0",
        FloorDecorationParty:"#f0c040", FloorDecorationCamping:"#88cc66",
        FloorDecorationExpanding:"#cc9966", FloorDecorationAnimal:"#ffcc88",
        FloorItem:"#cc6666", FloorObstacle:"#888899",
        WallDecoration:"#bb9966", WallPath:"#88aadd",
        Banners:"#dd6666", default:"#999999",
    };

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
    function getChars() {
        return (ChatRoomCharacter || [])  // eslint-disable-line
            .filter(c => c?.MapData?.Pos != null)
            .map(c => ({
            x: c.MapData.Pos.X, y: c.MapData.Pos.Y,
            name: (typeof CharacterNickname === "function" ? CharacterNickname(c) : null) || c.Name || "?",  // eslint-disable-line
            isPlayer: typeof c.IsPlayer === "function" ? c.IsPlayer() : false,
            color: c.LabelColor || "#ff8844",
        }));
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
                        ctx.fillStyle = OBJ_COLORS[obj.Type]||OBJ_COLORS.default;
                        ctx.fillRect(ox+x*ts+pad, oy+y*ts+pad, ts-pad*2, ts-pad*2);
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
                                const col = OBJ_COLORS[obj.Type]||OBJ_COLORS.default;
                                const pad = Math.max(1, Math.floor(ts*.14));
                                if (obj.Type === "WallPath") {
                                    ctx.fillStyle=col; ctx.fillRect(sx+pad,sy+pad,ts-pad*2,ts-pad*2);
                                    ctx.strokeStyle="#4466aa"; ctx.lineWidth=1.5;
                                    ctx.strokeRect(sx+pad+.75,sy+pad+.75,ts-pad*2-1.5,ts-pad*2-1.5);
                                } else if (obj.Type === "FloorObstacle") {
                                    ctx.beginPath(); ctx.arc(sx+ts/2,sy+ts/2,ts/2-pad,0,Math.PI*2);
                                    ctx.fillStyle=col; ctx.fill();
                                } else {
                                    ctx.fillStyle=col; ctx.fillRect(sx+pad,sy+pad,ts-pad*2,ts-pad*2);
                                }
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
        const bClose = document.createElement("button");
        bClose.className = "mm-btn"; bClose.textContent = "✕";

        function setMode(m) {
            mapMode = m;
            bLocal.className = "mm-btn" + (m==="local"?" active":"");
            bFull.className  = "mm-btn" + (m==="full" ?" active":"");
            const size = m === "full" ? FULL_SIZE : LOCAL_SIZE;
            cvEl.width  = size;
            cvEl.height = size;
            cvEl.style.width  = size + "px";
            cvEl.style.height = size + "px";
            panelEl.style.setProperty("width",    size + "px",                    "important");
            panelEl.style.setProperty("height",   (HDR_H + size + FTR_H) + "px", "important");
            panelEl.style.setProperty("overflow", "visible",                      "important"); // ← 新增
            panelEl.style.setProperty("max-height", "none",                       "important"); // ← 新增
        }
        bLocal.onclick = () => setMode("local");
        bFull.onclick  = () => setMode("full");
        bClose.onclick = () => panelEl.classList.add("hidden");

        btns.append(bLocal, bFull, bClose);
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
            const size = mapMode === "full" ? FULL_SIZE : LOCAL_SIZE;
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

    (async()=>{
        await waitFor(()=>typeof bcModSdk!=="undefined");  // eslint-disable-line

        const modApi=bcModSdk.registerMod({  // eslint-disable-line
            name:"Liko - BMM", fullName:"Liko's BC MiniMap", version:MOD_VER,
        });

        await waitFor(()=>typeof Player!=="undefined"&&typeof ChatRoomMapViewTileList!=="undefined");  // eslint-disable-line

        createPanel();
        console.log(`🐈‍⬛ [BMM] v${MOD_VER} ready`);

        modApi.hookFunction("GameRun", 0, (args, next)=>{
            const r=next(args);
            if (CurrentScreen!=="ChatRoom") return r;  // eslint-disable-line
            if (!inMapMode()) return r;
            const isOpen = panelEl && !panelEl.classList.contains("hidden");
            MainCanvas.globalAlpha = 0.65;
            DrawButton(955, 0, 45, 45, isOpen ? "▼" : "🗺️", isOpen ? "#223322" : "#1a1a2e", "", "MiniMap");
            MainCanvas.globalAlpha = 1.0;
            return r;
        });

        modApi.hookFunction("ChatRoomClick", 0, (args, next)=>{
            if (CurrentScreen!=="ChatRoom") return next(args);  // eslint-disable-line
            if (!inMapMode()) return next(args);
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
