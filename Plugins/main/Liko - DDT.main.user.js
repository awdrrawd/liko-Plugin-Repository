// ==UserScript==
// @name           Liko - DrawDetectionTool 
// @name:zh        繪圖檢測工具
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.1.0
// @description    Detects canvas and DOM element properties, and allows color highlighting and positional offset.
// @description:zh 偵測 canvas & DOM 物件的屬性，並支持染色與位移
// @author         likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant          none
// @require        https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==
/*
 * Liko - DrawDetectionTool 
 *
 * 用法：F2 = 偵測游標下的物件（推薦，不會碰到滑鼠）。F3 = 凍結這一幀去看繪製清單。
 *       也可以按氣球後點擊目標。ESC 關閉。
 *
 * 三層偵測，由粗到細：
 *   1. 繪製呼叫 —— hook Drawing.js 的繪製函式，每幀記下所有呼叫的矩形與參數，
 *      點擊時反向掃這份清單就得到那個位置的繪製堆疊。DOM 則走 elementFromPoint。
 *   2. 角色部位 —— 用 DialogGetCharacterZone() 算出 AssetGroup 的螢幕矩形。
 *   3. 角色圖層 —— 攔 CommonDrawAppearanceBuild 的繪製回呼，記下每一層畫在角色離屏
 *      畫布上的位置，再用 DrawCharacter 內部那次 DrawImageEx 的真實參數把螢幕座標
 *      反推回畫布座標，最後逐層測 alpha，得到「游標下真正那一層」。
 *
 * 編輯（全部即時生效，改了立刻在畫面上看到）：
 *   1. 繪製呼叫 → X / Y / 寬 / 高 / 顏色。存的是跟原始參數的「差值」，每幀在繪製前套用，
 *      所以是蓋在畫面上、不改資料。角色（DrawCharacter）也能直接拖位置。
 *   2. 單一圖層 → item.Color[layer.ColorIndex]，最精細。
 *   3. 整件裝備 → item.Color 全層。2、3 是改資料，會真的生效。
 *   4. DOM → 直接寫 element.style，位置與顏色都能改。
 */
(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.BDT) return;

	const MOD_NAME = "BDT";
	const MOD_VERSION = "0.1.0";
    window.Liko.BDT = MOD_VERSION;
	const UI_Z = 2147483000;

	// ---------------------------------------------------------------- 狀態

	/** 目前這一幀正在累積的繪製清單 */
	let curLog = [];
	/** 上一幀「完整」的繪製清單，點擊時拿這份做命中測試 */
	let lastLog = [];
	/** 繪製呼叫的巢狀深度（DrawButton 內部會再呼叫 DrawTextFit / DrawImage） */
	let depth = 0;
	/** 只有開啟偵測器時才記錄，避免平常白白吃效能 */
	let recording = false;
	/** 偵測模式：等待使用者點選目標 */
	let picking = false;
	/** 目前選中的目標快照 */
	let selection = null;
	/** 滑鼠停留處的即時高亮（虛擬座標） */
	let hoverRect = null;
	/**
	 * 繪製呼叫的覆寫表：signature -> { color, dx, dy, dw, dh }
	 * 存的是「差值」而不是絕對值，這樣 signature（用原始參數算的）才不會被自己的修改改掉。
	 */
	const uiOverrides = new Map();
	/** 角色裝備的原始顏色備份，供還原用：item -> 原本的 Color */
	const colorBackups = new Map();
	/** 吞掉點擊手勢殘留事件（mouseup / click）用的時間戳 */
	let swallowUntil = 0;
	/** 每個角色的「圖層繪製紀錄」（角色離屏畫布座標系）：Character -> [{layer, src, x, y}] */
	const charLayerDraws = new WeakMap();
	/** CommonDrawAppearanceBuild 迴圈中，正要被畫的那一層 */
	let pendingLayer = null;
	/** 正在被 DrawCharacter 繪製的紀錄，用來攔它內部那次「角色畫布 → 主畫布」的 DrawImageEx */
	let charBlitTarget = null;
	/** 滑鼠最後位置（F2 用，永遠追蹤） */
	let lastMouse = { x: 0, y: 0 };
	/** 讀圖片單點 alpha 用的暫存畫布 */
	let scratch = null;

	// --- 幀除錯 ---
	/** 本幀已經執行過幾個「頂層」繪製呼叫。只算頂層是有原因的，見 hookRecord。 */
	let topIndex = 0;
	/** 目前所在的頂層呼叫序號（巢狀的子呼叫會沿用父層的） */
	let curTop = -1;
	/** 繪製上限：-1 = 全部畫；>=0 = 只畫前 N 個頂層呼叫（RenderDoc 式的逐呼叫回放） */
	let scrubLimit = -1;
	/** 凍結：不再用新的幀覆蓋 lastLog，讓面板資料穩定下來 */
	let frozen = false;
	/** 目前面板頁籤 */
	let tab = "select";
	/** 事件瀏覽器的搜尋字串 */
	let frameFilter = "";
	/** 上一幀的頂層呼叫總數（滑桿的上限） */
	let frameTopCount = 0;

	/**
	 * 跳過某個繪製呼叫時要回傳什麼。
	 * 不能一律回 undefined —— DrawImageEx 這類會回傳 boolean，呼叫端有可能拿去判斷
	 * （false 代表「圖還沒載入」），亂回會讓 BC 自己的邏輯走岔。回 true = 「畫好了，別管」。
	 */
	const SAFE_RETURN = {
		DrawImageEx: true, DrawImage: true, DrawImageResize: true,
		DrawImageCanvas: true, DrawImageZoomCanvas: true,
	};

	let modApi = null;
	let root = null; // UI 容器（shadow host）
	let panel = null;
	let balloon = null;
	let domHighlight = null;

	// ---------------------------------------------------------------- 小工具

	function waitFor(check, interval = 200) {
		return new Promise((resolve) => {
			const t = setInterval(() => {
				let ok = false;
				try { ok = !!check(); } catch { ok = false; }
				if (ok) { clearInterval(t); resolve(); }
			}, interval);
		});
	}

	/** 螢幕座標 → BC 的 2000x1000 虛擬座標 */
	function toVirtual(clientX, clientY) {
		const cv = MainCanvas.canvas;
		const r = cv.getBoundingClientRect();
		return {
			x: (clientX - r.left) * 2000 / r.width,
			y: (clientY - r.top) * 1000 / r.height,
		};
	}

	/**
	 * DOM 的 client rect → BC 的 2000×1000 虛擬座標。
	 * BC 的 DOM 元件其實也是照著畫布座標去擺的，換算回來才有辦法跨解析度對照。
	 */
	function clientRectToVirtual(r) {
		const a = toVirtual(r.left, r.top);
		const b = toVirtual(r.right, r.bottom);
		return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
	}

	function pointIn(x, y, rect) {
		return rect && x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3];
	}

	/** 讀出 canvas 上該點「實際渲染出來」的顏色 */
	function pixelAt(x, y) {
		try {
			const d = MainCanvas.getImageData(Math.round(x), Math.round(y), 1, 1).data;
			return {
				hex: "#" + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, "0")).join(""),
				alpha: (d[3] / 255).toFixed(2),
			};
		} catch (e) {
			// 自訂房間背景若來自跨網域來源，canvas 會被 taint，getImageData 會丟例外
			return { hex: null, alpha: null, error: String(e.message || e) };
		}
	}

	function normalizeColor(c) {
		if (typeof c !== "string" || !c) return null;
		if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
		// 具名色（"White" / "Cyan" ...）轉成 hex，好餵給 <input type=color>
		try {
			const probe = document.createElement("canvas").getContext("2d");
			probe.fillStyle = "#000000";
			probe.fillStyle = c;
			const v = probe.fillStyle;
			return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
		} catch { return null; }
	}

	/**
	 * 每個繪製函式的「可編輯參數」在 args 裡的位置。
	 * null = 這個函式沒有這個概念（例如 DrawText 沒有寬高、DrawImage 沒有顏色參數）。
	 */
	const UI_SPEC = {
		DrawButton:          { x: 0, y: 1, w: 2, h: 3, color: 5 },
		DrawBackNextButton:  { x: 0, y: 1, w: 2, h: 3, color: 5 },
		DrawCheckbox:        { x: 0, y: 1, w: 2, h: 3, color: null },
		DrawRect:            { x: 0, y: 1, w: 2, h: 3, color: 4 },
		DrawEmptyRect:       { x: 0, y: 1, w: 2, h: 3, color: 4 },
		DrawProgressBar:     { x: 0, y: 1, w: 2, h: 3, color: 5 },
		DrawCircle:          { x: 0, y: 1, w: 2, h: null, color: 5 },
		DrawText:            { x: 1, y: 2, w: null, h: null, color: 3 },
		DrawTextFit:         { x: 1, y: 2, w: 3, h: null, color: 4 },
		DrawTextWrap:        { x: 1, y: 2, w: 3, h: 4, color: 5 },
		DrawImage:           { x: 1, y: 2, w: null, h: null, color: null },
		DrawImageResize:     { x: 1, y: 2, w: 3, h: 4, color: null },
		DrawImageEx:         { x: 2, y: 3, w: null, h: null, color: null },
		DrawImageZoomCanvas: { x: 6, y: 7, w: 8, h: 9, color: null },
		DrawCharacter:       { x: 1, y: 2, w: null, h: null, color: null },
	};

	/**
	 * 用「函式名 + 原始參數值」當作這次繪製呼叫的身分。
	 * 一定要用原始值算，否則套用位移之後下一幀就對不上自己了。
	 */
	function uiKey(fn, a) {
		const s = UI_SPEC[fn];
		if (!s) return null;
		const part = (i) => (i == null || !isFinite(a[i]) ? "-" : Math.round(a[i]));
		return `${fn}|${part(s.x)},${part(s.y)},${part(s.w)},${part(s.h)}`;
	}

	/** 把覆寫套進這次呼叫的參數上（在 next() 之前呼叫） */
	function applyOverride(fn, a) {
		const s = UI_SPEC[fn];
		if (!s) return;
		const o = uiOverrides.get(uiKey(fn, a)); // 先用原始值取 key，再改參數
		if (!o) return;
		if (o.color != null && s.color != null) a[s.color] = o.color;
		if (o.dx && s.x != null) a[s.x] += o.dx;
		if (o.dy && s.y != null) a[s.y] += o.dy;
		if (o.dw && s.w != null) a[s.w] += o.dw;
		if (o.dh && s.h != null) a[s.h] += o.dh;
	}

	/** 取得（或建立）某個繪製呼叫的覆寫項目 */
	function overrideFor(key, create) {
		let o = uiOverrides.get(key);
		if (!o && create) { o = {}; uiOverrides.set(key, o); }
		return o;
	}

	function esc(s) {
		return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
	}

	function shortStr(s, n = 40) {
		s = String(s ?? "");
		return s.length > n ? s.slice(0, n) + "…" : s;
	}

	// ---------------------------------------------------------------- 繪製記錄

	/**
	 * 掛一個「記錄用」的 hook。
	 * priority 0 = 最內層，代表其他插件改過的參數我們都看得到最終值。
	 * @param {string} name 函式名稱
	 * @param {(args:any[]) => object|null} extract 從參數算出矩形與描述
	 */
	function hookRecord(name, extract) {
		if (typeof window[name] !== "function") return;
		modApi.hookFunction(name, 0, (args, next) => {
			// 只有「頂層」呼叫才拿新的序號。
			// 為什麼不連巢狀的一起編號：DrawButton 內部會再呼叫 DrawTextFit / DrawImage，
			// 一旦回放切在 DrawButton 上、它的子呼叫就不會執行，後面呼叫的序號就會整個往前位移，
			// 拉滑桿時序號會跳來跳去。只算頂層則不管切在哪，序號都是穩定的。
			const isTop = depth === 0;
			const prevTop = curTop;
			if (isTop) curTop = topIndex++;
			const myTop = curTop;

			// key 一定要在改參數之前算
			let key = null;
			try { key = uiKey(name, args); } catch { key = null; }
			// 原始值先留一份，面板要顯示「原本是多少」
			let orig = null;
			if (recording && key) {
				const s = UI_SPEC[name];
				orig = {
					x: s.x == null ? null : args[s.x], y: s.y == null ? null : args[s.y],
					w: s.w == null ? null : args[s.w], h: s.h == null ? null : args[s.h],
					color: s.color == null ? null : args[s.color],
				};
			}
			try { applyOverride(name, args); } catch { /* 覆寫失敗不能影響遊戲繪製 */ }

			let rec = null;
			if (recording && depth < 6) {
				try {
					rec = extract(args);
					if (rec && rec.rect && isFinite(rec.rect[0])) {
						rec.fn = name;
						rec.depth = depth;
						rec.order = curLog.length;
						rec.top = myTop;
						rec.key = key;
						rec.orig = orig;
						rec.spec = UI_SPEC[name] || null;
						rec.state = captureState();
						curLog.push(rec);
					} else {
						rec = null;
					}
				} catch { rec = null; }
			}

			// 逐呼叫回放：切在第 N 個頂層呼叫，後面的都不執行（子呼叫跟著父層一起沒了）
			if (isTop && scrubLimit >= 0 && myTop >= scrubLimit) {
				if (rec) rec.skipped = true;
				curTop = prevTop;
				return SAFE_RETURN[name];
			}

			// 角色的實際貼圖參數藏在 DrawCharacter 內部那次 DrawImageEx，掛個標記讓它自己填回來
			const prevBlit = charBlitTarget;
			if (rec && rec.isCharacter) charBlitTarget = rec;
			depth++;
			const t0 = rec ? performance.now() : 0;
			try {
				return next(args);
			} finally {
				if (rec) rec.ms = performance.now() - t0; // 含子呼叫的總時間
				depth--;
				curTop = prevTop;
				if (rec && rec.isCharacter) charBlitTarget = prevBlit;
			}
		});
	}

	/** 擷取這次繪製當下的 canvas 2D 狀態（相當於 RenderDoc 的 pipeline state，只是 2D 版的） */
	function captureState() {
		try {
			const t = MainCanvas.getTransform();
			return {
				alpha: MainCanvas.globalAlpha,
				composite: MainCanvas.globalCompositeOperation,
				font: MainCanvas.font,
				align: MainCanvas.textAlign,
				filter: MainCanvas.filter,
				transform: [t.a, t.b, t.c, t.d, t.e, t.f],
			};
		} catch { return null; }
	}

	/** 只記錄畫在主畫布上的東西；畫到離屏 canvas 的略過 */
	function isMain(canvas) {
		return canvas == null || canvas === MainCanvas;
	}

	function textRect(text, X, Y, width) {
		let w = width;
		if (w == null) {
			try { w = MainCanvas.measureText(String(text)).width; } catch { w = 100; }
		}
		const align = MainCanvas.textAlign;
		const left = align === "left" || align === "start" ? X : align === "right" || align === "end" ? X - w : X - w / 2;
		return [left, Y - 20, w, 40];
	}

	function resolveImg(source) {
		try {
			return typeof source === "string" ? DrawGetImage(source) : source;
		} catch { return null; }
	}

	function imgSize(source) {
		const img = resolveImg(source);
		return img ? [img.width || 0, img.height || 0] : [0, 0];
	}

	/**
	 * 算出 DrawImageEx 實際落在畫布上的矩形。
	 * DrawImageEx 是用 transform(Zoom*±1, 0, 0, Zoom*±1, X+(Mirror?W:0), Y+(Invert?H:0)) 再 drawImage(0,0,W,H)，
	 * 所以翻轉時原點會位移，尺寸也還要再乘一次 Zoom。
	 */
	function imageExRect(source, X, Y, opt) {
		const zoom = typeof opt.Zoom === "number" ? opt.Zoom : 1;
		let w = opt.Width, h = opt.Height;
		if (w == null || h == null) {
			const [iw, ih] = imgSize(source);
			if (w == null) w = opt.SourcePos ? opt.SourcePos[2] : iw;
			if (h == null) h = opt.SourcePos ? opt.SourcePos[3] : ih;
		}
		if (!isFinite(w) || !isFinite(h)) return null;
		const eW = w * zoom, eH = h * zoom;
		const left = opt.Mirror ? X + w - eW : X;
		const top = opt.Invert ? Y + h - eH : Y;
		return [left, top, eW, eH];
	}

	/** 讀出圖片某一點的 alpha（0-255）；跨域無法讀時回 -1 */
	function imgAlphaAt(img, x, y) {
		try {
			if (!scratch) {
				const cv = document.createElement("canvas");
				cv.width = 1; cv.height = 1;
				scratch = cv.getContext("2d", { willReadFrequently: true });
			}
			scratch.clearRect(0, 0, 1, 1);
			scratch.drawImage(img, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
			return scratch.getImageData(0, 0, 1, 1).data[3];
		} catch { return -1; }
	}

	function installDrawHooks() {
		// 覆寫（顏色 / 位移 / 尺寸）由 hookRecord 依 UI_SPEC 自動處理，這裡只負責描述「畫了什麼」

		// --- 按鈕類 ---
		hookRecord("DrawButton",
			(a) => ({ rect: [a[0], a[1], a[2], a[3]], label: a[4], color: a[5], tip: a[7], disabled: a[8] }));

		hookRecord("DrawBackNextButton",
			(a) => ({ rect: [a[0], a[1], a[2], a[3]], label: a[4], color: a[5] }));

		hookRecord("DrawCheckbox",
			(a) => ({ rect: [a[0], a[1], a[2], a[3]], label: a[4], checked: a[5] }));

		// --- 幾何類 ---
		hookRecord("DrawRect", (a) => ({ rect: [a[0], a[1], a[2], a[3]], color: a[4] }));
		hookRecord("DrawEmptyRect", (a) => ({ rect: [a[0], a[1], a[2], a[3]], color: a[4] }));
		hookRecord("DrawProgressBar", (a) => ({ rect: [a[0], a[1], a[2], a[3]], value: a[4], color: a[5] }));

		hookRecord("DrawCircle", (a) => {
			if (!isMain(a[6])) return null;
			return { rect: [a[0] - a[2], a[1] - a[2], a[2] * 2, a[2] * 2], color: a[5] || a[4], radius: a[2] };
		});

		// --- 文字類 ---
		hookRecord("DrawText", (a) => ({ rect: textRect(a[0], a[1], a[2]), label: a[0], color: a[3] }));
		hookRecord("DrawTextFit", (a) => ({ rect: textRect(a[0], a[1], a[2], a[3]), label: a[0], color: a[4] }));
		hookRecord("DrawTextWrap", (a) => ({ rect: [a[1], a[2], a[3], a[4]], label: a[0], color: a[5] }));

		// --- 圖片類 ---
		hookRecord("DrawImage", (a) => {
			const [w, h] = imgSize(a[0]);
			return { rect: [a[1], a[2], w, h], src: a[0], srcRef: a[0] };
		});

		hookRecord("DrawImageResize",
			(a) => ({ rect: [a[1], a[2], a[3], a[4]], src: a[0], srcRef: a[0] }));

		hookRecord("DrawImageEx", (a) => {
			if (!isMain(a[1])) return null;
			const opt = a[4] || {};
			const rect = imageExRect(a[0], a[2], a[3], opt);
			if (!rect) return null;

			// 這次是不是 DrawCharacter 在把角色畫布貼上來？是的話把轉換參數記回角色紀錄，
			// 之後才有辦法把螢幕座標換算回角色畫布座標、做逐圖層的像素命中。
			// 不能只比對 C.Canvas：玩家目盲或有 tint 時，DrawCharacter 會改貼 TempCanvas。
			// 所以改成「DrawCharacter 裡第一次以畫布為來源的 DrawImageEx」，那一定是角色本體。
			if (charBlitTarget && !charBlitTarget.blit && a[0] instanceof HTMLCanvasElement) {
				charBlitTarget.blit = { X: a[2], Y: a[3], opt };
				charBlitTarget.rect = rect; // 實際貼上去的矩形，比用 500×HeightRatio 推算更準
				charBlitTarget.isCharBlit = true;
			}
			return {
				rect,
				src: typeof a[0] === "string" ? a[0] : "(canvas)", srcRef: a[0],
				color: opt.HexColor, alpha: opt.Alpha,
			};
		});

		hookRecord("DrawImageZoomCanvas", (a) => {
			if (!isMain(a[1])) return null;
			return { rect: [a[6], a[7], a[8], a[9]], src: typeof a[0] === "string" ? a[0] : "(canvas)", srcRef: a[0] };
		});

		// --- 角色 ---
		hookRecord("DrawCharacter", (a) => {
			const C = a[0];
			if (!C || !isMain(a[5])) return null;
			const heightRatio = (a[4] == null || a[4] === true) ? (C.HeightRatio ?? 1) : 1;
			return {
				rect: [a[1], a[2], 500 * heightRatio * a[3], 1000 * a[3]],
				isCharacter: true,
				C, X: a[1], Y: a[2], Zoom: a[3], heightRatio,
				label: C.Name || C.AccountName || "(角色)",
			};
		});

		installLayerHooks();

		// --- 每幀換頁：把這一幀累積的清單收起來，並畫上高亮 ---
		// priority 8 = 較外層，所以 next() 之後的程式碼會在所有繪製結束後才跑，高亮才蓋得到最上面
		modApi.hookFunction("DrawProcess", 8, (args, next) => {
			topIndex = 0;
			curTop = -1;
			if (recording) curLog = [];
			const ret = next(args);
			if (recording) {
				// 凍結時不覆蓋 lastLog，讓面板上的清單與序號穩定下來，才有辦法慢慢看。
				// frameTopCount 也要一起凍，否則滑桿上限會跟著活的畫面跳，跟凍住的清單對不起來。
				if (!frozen) {
					lastLog = curLog;
					frameTopCount = topIndex;
				}
				curLog = [];
			}
			try { drawOverlay(); } catch { /* 高亮畫失敗不能拖垮遊戲 */ }
			return ret;
		});
	}

	/**
	 * 角色的圖層堆疊是在 CharacterLoadCanvas 時合成到離屏畫布上的，主畫布只看得到合成後的結果。
	 * 所以要在合成當下攔下來：CommonDrawAppearanceBuild 會逐層呼叫傳進去的 drawImage 回呼，
	 * 而每層畫之前一定先經過 CommonDrawComputeDrawingCoordinates（參數裡就有 layer 物件），
	 * 兩個一配對就知道「哪一層畫在哪裡」。2D 與 WebGL 兩條路徑都會經過這裡。
	 */
	function installLayerHooks() {
		if (typeof window.CommonDrawComputeDrawingCoordinates === "function") {
			modApi.hookFunction("CommonDrawComputeDrawingCoordinates", 0, (args, next) => {
				pendingLayer = args[2];
				return next(args);
			});
		}

		if (typeof window.CommonDrawAppearanceBuild !== "function") {
			console.warn(`[${MOD_NAME}] 找不到 CommonDrawAppearanceBuild，圖層偵測會停用`);
			return;
		}
		modApi.hookFunction("CommonDrawAppearanceBuild", 0, (args, next) => {
			const C = args[0];
			const cb = args[1];
			const list = [];

			// 只包非 Blink 的版本，Blink 是畫到另一張畫布的重複資料
			const wrapImage = (name) => {
				const orig = cb[name];
				if (typeof orig !== "function") return;
				cb[name] = (src, x, y, opts) => {
					try {
						list.push({
							layer: pendingLayer, srcRef: src,
							src: typeof src === "string" ? src : "(canvas)",
							x, y, color: opts?.HexColor, alpha: opts?.Alpha, via: name,
						});
					} catch { /* 記錄失敗不能擋住角色合成 */ }
					return orig(src, x, y, opts);
				};
			};
			wrapImage("drawImage");
			wrapImage("drawImageColorize");

			const origCanvas = cb.drawCanvas;
			if (typeof origCanvas === "function") {
				cb.drawCanvas = (Img, x, y, alphaMasks, maskLayers) => {
					try {
						list.push({ layer: pendingLayer, srcRef: Img, src: "(canvas)", x, y, via: "drawCanvas" });
					} catch { /* 同上 */ }
					return origCanvas(Img, x, y, alphaMasks, maskLayers);
				};
			}

			const r = next(args);
			charLayerDraws.set(C, list);
			pendingLayer = null;
			return r;
		});
	}

	/** 在畫布上畫出選取框與滑鼠停留框 */
	function drawOverlay() {
		if (!recording) return;
		const ctx = MainCanvas;
		ctx.save();
		if (hoverRect) {
			ctx.strokeStyle = "#00b7ff";
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.strokeRect(hoverRect[0], hoverRect[1], hoverRect[2], hoverRect[3]);
		}
		if (selection && selection.rect) {
			const r = selection.rect;
			ctx.strokeStyle = "#ff3b6b";
			ctx.lineWidth = 3;
			ctx.setLineDash([]);
			ctx.strokeRect(r[0], r[1], r[2], r[3]);
			// 四角標記
			ctx.fillStyle = "#ff3b6b";
			for (const [cx, cy] of [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]]]) {
				ctx.fillRect(cx - 3, cy - 3, 6, 6);
			}
		}
		ctx.restore();
	}

	// ---------------------------------------------------------------- 命中測試

	/** 回傳點擊處所有命中的繪製紀錄，最上層在前 */
	function hitTest(x, y) {
		const hits = [];
		for (let i = lastLog.length - 1; i >= 0; i--) {
			const rec = lastLog[i];
			if (pointIn(x, y, rec.rect)) hits.push(rec);
		}
		return hits;
	}

	/**
	 * 螢幕虛擬座標 → 角色離屏畫布座標。
	 * 用的是 DrawCharacter 內部那次 DrawImageEx 的真實參數（blit），所以不必自己重算
	 * XOffset / YOffset / YStart 那一整套，BC 怎麼貼我們就怎麼反推。
	 */
	function screenToCharCanvas(rec, px, py) {
		const b = rec.blit;
		if (!b) return null;
		const o = b.opt || {};
		const sp = o.SourcePos;
		const W = o.Width, H = o.Height;
		if (!sp || W == null || H == null || !W || !H) return null;
		const zoom = typeof o.Zoom === "number" ? o.Zoom : 1;
		const scaleH = zoom * (o.Mirror ? -1 : 1);
		const scaleV = zoom * (o.Invert ? -1 : 1);
		const tX = b.X + (o.Mirror ? W : 0);
		const tY = b.Y + (o.Invert ? H : 0);
		const u = (px - tX) / scaleH;
		const v = (py - tY) / scaleV;
		return { cx: sp[0] + u * sp[2] / W, cy: sp[1] + v * sp[3] / H };
	}

	/** 取得角色的圖層繪製紀錄；沒有的話（插件載入前就合成好了）重合成一次來補 */
	function getLayerDraws(C) {
		let draws = charLayerDraws.get(C);
		if (!draws) {
			try { CharacterLoadCanvas(C); } catch { /* 重合成失敗就當作沒有圖層資料 */ }
			draws = charLayerDraws.get(C);
		}
		return draws || null;
	}

	/** 逐圖層的像素級命中：回傳點到的圖層，最上層在前 */
	function hitLayers(rec, px, py) {
		const pt = screenToCharCanvas(rec, px, py);
		if (!pt) return [];
		const draws = getLayerDraws(rec.C);
		if (!draws) return [];

		const out = [];
		for (let i = draws.length - 1; i >= 0; i--) {
			const d = draws[i];
			const img = resolveImg(d.srcRef);
			if (!img || !img.width) continue;
			const lx = pt.cx - d.x, ly = pt.cy - d.y;
			if (lx < 0 || ly < 0 || lx >= img.width || ly >= img.height) continue;
			const a = imgAlphaAt(img, lx, ly);
			// alpha 0 = 這層在這一點是透明的，等於沒點到它
			if (a === 0) continue;
			out.push({ draw: d, layer: d.layer, alpha: a, at: [Math.floor(lx), Math.floor(ly)] });
		}
		return out;
	}

	/** 角色身上：點到哪些部位（AssetGroup zone） */
	function hitGroups(rec, x, y) {
		const out = [];
		if (typeof DialogGetCharacterZone !== "function" || !Array.isArray(window.AssetGroup)) return out;
		for (const G of AssetGroup) {
			if (!Array.isArray(G.Zone)) continue; // 只有 Item 類群組有 Zone
			for (const Z of G.Zone) {
				const CZ = DialogGetCharacterZone(rec.C, Z, rec.X, rec.Y, rec.Zoom, rec.heightRatio);
				if (pointIn(x, y, CZ)) { out.push({ group: G, zone: CZ }); break; }
			}
		}
		return out;
	}

	// ---------------------------------------------------------------- 染色

	function colorLayers(item) {
		return item?.Asset?.ColorableLayerCount ?? 0;
	}

	function currentColorOf(item) {
		const c = item?.Color;
		if (Array.isArray(c)) return normalizeColor(c[0]) || "#ffffff";
		return normalizeColor(c) || "#ffffff";
	}

	function applyItemColor(C, item, hex) {
		if (!colorBackups.has(item)) {
			colorBackups.set(item, Array.isArray(item.Color) ? item.Color.slice() : item.Color);
		}
		const n = colorLayers(item);
		item.Color = n > 1 ? new Array(n).fill(hex) : hex;
		CharacterLoadCanvas(C);
	}

	/**
	 * 色盤拖動會狂噴 input 事件，而 CharacterLoadCanvas 是整個角色重合成，很重。
	 * 用 rAF 合併成每幀最多一次。
	 */
	let recolorPending = null;
	function queueRecolor(C, fn) {
		const first = !recolorPending;
		recolorPending = fn;
		if (!first) return;
		requestAnimationFrame(() => {
			const job = recolorPending;
			recolorPending = null;
			try { job(); } catch (e) { console.error(`🐈‍⬛ [${MOD_NAME}] 染色失敗`, e); }
		});
	}

	/** 只染某一層：layer.ColorIndex 就是它在 item.Color 陣列裡的位置 */
	function applyLayerColor(C, item, layer, hex) {
		if (!colorBackups.has(item)) {
			colorBackups.set(item, Array.isArray(item.Color) ? item.Color.slice() : item.Color);
		}
		const n = Math.max(colorLayers(item), (layer.ColorIndex ?? 0) + 1);
		if (!Array.isArray(item.Color)) {
			// 原本是單一字串（或 undefined）時，先攤成每層一格的陣列才有辦法單獨改一層
			const base = normalizeColor(item.Color) || item.Color || "Default";
			item.Color = new Array(n).fill(base);
		}
		while (item.Color.length < n) item.Color.push("Default");
		item.Color[layer.ColorIndex ?? 0] = hex;
		CharacterLoadCanvas(C);
	}

	function resetItemColor(C, item) {
		if (!colorBackups.has(item)) return;
		item.Color = colorBackups.get(item);
		colorBackups.delete(item);
		CharacterLoadCanvas(C);
	}

	/** 把改動推到伺服器（只對自己有意義，別人的角色改了也只是本地預覽） */
	function pushToServer(C) {
		if (!C.IsPlayer || !C.IsPlayer()) return false;
		CharacterRefresh(C, true, false);
		return true;
	}

	// ---------------------------------------------------------------- UI

	const CSS = `
	:host { all: initial; --fs: 15px; }
	* { box-sizing: border-box; font-family: system-ui, "Segoe UI", "Microsoft JhengHei", sans-serif; }
	.balloon {
		position: fixed; z-index: ${UI_Z}; width: 44px; height: 44px; border-radius: 50%;
		background: linear-gradient(145deg, #7b5cff, #4a2fd6); color: #fff; border: 2px solid #fff;
		box-shadow: 0 4px 14px rgba(0,0,0,.4); cursor: grab; display: flex; align-items: center;
		justify-content: center; font-size: 20px; user-select: none; touch-action: none;
	}
	.balloon.on { background: linear-gradient(145deg, #ff5c8a, #d62f5a); }
	.balloon:active { cursor: grabbing; }
	.panel {
		position: fixed; z-index: ${UI_Z}; width: 400px; max-height: 80vh; overflow: auto;
		background: rgba(24,24,32,.97); color: #e8e8f0; border: 1px solid #4a4a66; border-radius: 10px;
		box-shadow: 0 8px 30px rgba(0,0,0,.5); font-size: var(--fs); line-height: 1.45; display: none;
	}
	.panel.show { display: block; }
	.hd { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: #2b2b3d;
		border-bottom: 1px solid #4a4a66; border-radius: 9px 9px 0 0; cursor: move; user-select: none; }
	.hd b { flex: 1; font-size: calc(var(--fs) + 1px); }
	.hd button { background: none; border: none; color: #aaa; cursor: pointer;
		font-size: calc(var(--fs) + 2px); padding: 0 5px; line-height: 1; }
	.hd button:hover { color: #fff; }
	.tabs { display: flex; gap: 2px; padding: 0 8px; background: #242434; border-bottom: 1px solid #4a4a66; }
	.tabs button { background: none; border: none; border-bottom: 2px solid transparent; color: #8a8aa0;
		cursor: pointer; padding: 7px 14px; font-size: calc(var(--fs) - 1px); }
	.tabs button:hover { color: #e8e8f0; }
	.tabs button.on { color: #fff; border-bottom-color: #7b5cff; }
	.bd { padding: 10px 12px 12px; }
	.texbox { background: repeating-conic-gradient(#3a3a52 0% 25%, #2b2b3d 0% 50%) 0 0 / 14px 14px;
		border: 1px solid #4a4a66; border-radius: 5px; padding: 4px; margin-top: 4px; overflow: auto;
		max-height: 220px; text-align: center; }
	.texbox img { max-width: 100%; image-rendering: pixelated; vertical-align: middle; }
	input[type=range] { accent-color: #7b5cff; cursor: pointer; }
	.row { display: flex; gap: 8px; padding: 3px 0; align-items: center; }
	.row .k { width: 88px; color: #9a9ab0; flex-shrink: 0; }
	.row .v { flex: 1; word-break: break-all; font-family: ui-monospace, Consolas, monospace; }
	.tag { display: inline-block; padding: 1px 8px; border-radius: 999px;
		font-size: calc(var(--fs) - 3px); font-weight: 700; }
	.tag.canvas { background: #2f6bd6; }
	.tag.dom { background: #2f9e6b; }
	.sw { width: 17px; height: 17px; border-radius: 3px; border: 1px solid #666; flex-shrink: 0; }
	h4 { margin: 14px 0 5px; font-size: calc(var(--fs) - 2px); color: #9a9ab0; letter-spacing: .5px;
		border-bottom: 1px solid #3a3a52; padding-bottom: 4px; font-weight: 700; }
	.stack { max-height: 170px; overflow: auto; }
	.si { padding: 4px 6px; border-radius: 4px; cursor: pointer; display: flex; gap: 6px; align-items: baseline; }
	.si:hover { background: #3a3a52; }
	.si.sel { background: #4a3a80; }
	.si .fn { color: #8fd0ff; font-family: ui-monospace, Consolas, monospace; }
	.si .dt { color: #888; font-size: calc(var(--fs) - 2.5px); }
	.si .pr { color: #ffb75c; font-family: ui-monospace, Consolas, monospace;
		font-size: calc(var(--fs) - 2.5px); }
	select, input[type=color], input[type=number], input[type=text], button.act {
		background: #2b2b3d; color: #e8e8f0; border: 1px solid #4a4a66; border-radius: 5px;
		padding: 5px 7px; font-size: calc(var(--fs) - 1px); cursor: pointer;
	}
	select { flex: 1; min-width: 0; }
	input[type=color] { width: 46px; height: 30px; padding: 1px; }
	input[type=number], input[type=text] {
		width: 92px; cursor: text; font-family: ui-monospace, Consolas, monospace;
	}
	input[type=text] { flex: 1; min-width: 0; }
	input:focus { outline: none; border-color: #6a4ff6; }
	button.act:hover { background: #3a3a52; }
	button.act.pri { background: #4a2fd6; border-color: #6a4ff6; }
	button.act.pri:hover { background: #5a3ff0; }
	.note { color: #8a8aa0; font-size: calc(var(--fs) - 2.5px); line-height: 1.55; margin-top: 6px; }
	.warn { color: #ffb75c; }
	kbd { background: #3a3a52; border: 1px solid #5a5a7a; border-radius: 3px; padding: 0 4px;
		font-family: ui-monospace, Consolas, monospace; font-size: calc(var(--fs) - 3px); }
	.hl { position: fixed; z-index: ${UI_Z - 1}; border: 2px dashed #2f9e6b; pointer-events: none; display: none; }
	.empty { color: #777; padding: 14px 4px; text-align: center; }
	`;

	let curFontSize = 15;
	function setFontSize(px) {
		curFontSize = Math.max(11, Math.min(22, px));
		root.style.setProperty("--fs", curFontSize + "px");
try { localStorage.setItem("DDTFontSize", String(curFontSize)); } catch { /* 無痛失敗 */ }
	}

	function buildUI() {
		root = document.createElement("div");
		root.id = "DDT-root";
		const shadow = root.attachShadow({ mode: "open" });
		const style = document.createElement("style");
		style.textContent = CSS;
		shadow.appendChild(style);

		balloon = document.createElement("div");
		balloon.className = "balloon";
		balloon.title = "DrawDetectionTool  — 點一下進入偵測模式，可拖曳搬家";
		balloon.textContent = "🎈";
		balloon.style.left = "12px";
		balloon.style.top = "120px";
		shadow.appendChild(balloon);

		panel = document.createElement("div");
		panel.className = "panel";
		panel.style.left = "70px";
		panel.style.top = "120px";
		panel.innerHTML = `
			<div class="hd">
				<b>Draw Detection Tool </b>
				<button data-fsdn title="縮小文字">A−</button>
				<button data-fsup title="放大文字">A+</button>
				<button data-x title="關閉">✕</button>
			</div>
			<div class="tabs">
				<button data-tab="select" class="on">選取</button>
				<button data-tab="frame">幀</button>
			</div>
			<div class="bd"><div class="empty">按 🎈 或 <kbd>F2</kbd> 偵測游標下的物件</div></div>`;
		shadow.appendChild(panel);

		domHighlight = document.createElement("div");
		domHighlight.className = "hl";
		shadow.appendChild(domHighlight);

		document.body.appendChild(root);

		// 字級：存起來，下次載入沿用
		const savedFs = parseFloat(localStorage.getItem("DDTFontSize"));
		setFontSize(isFinite(savedFs) ? savedFs : 15);
		panel.querySelector("[data-fsup]").addEventListener("click", () => setFontSize(curFontSize + 1));
		panel.querySelector("[data-fsdn]").addEventListener("click", () => setFontSize(curFontSize - 1));

		panel.querySelector("[data-x]").addEventListener("click", closePanel);
		panel.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
			tab = b.dataset.tab;
			panel.querySelectorAll("[data-tab]").forEach((o) => o.classList.toggle("on", o.dataset.tab === tab));
			renderPanel();
		}));

		makeDraggable(balloon, balloon, () => togglePicking());
		makeDraggable(panel, panel.querySelector(".hd"));
	}

	/** 讓元素可拖曳；沒有位移的話當成點擊 */
	function makeDraggable(el, handle, onClick) {
		let sx = 0, sy = 0, ox = 0, oy = 0, moved = false, dragging = false;
		handle.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			// 標題列上的按鈕不能觸發拖曳：setPointerCapture 會把後續事件全部導到 handle，
			// 按鈕的 click 就永遠不會發生（關閉鈕失效的原因）
			if (e.target && e.target.closest && e.target.closest("button")) return;
			dragging = true; moved = false;
			sx = e.clientX; sy = e.clientY;
			ox = parseFloat(el.style.left) || 0;
			oy = parseFloat(el.style.top) || 0;
			handle.setPointerCapture(e.pointerId);
			e.stopPropagation();
		});
		handle.addEventListener("pointermove", (e) => {
			if (!dragging) return;
			const dx = e.clientX - sx, dy = e.clientY - sy;
			if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
			if (!moved) return;
			el.style.left = Math.max(0, Math.min(window.innerWidth - 40, ox + dx)) + "px";
			el.style.top = Math.max(0, Math.min(window.innerHeight - 30, oy + dy)) + "px";
		});
		handle.addEventListener("pointerup", (e) => {
			if (!dragging) return;
			dragging = false;
			handle.releasePointerCapture(e.pointerId);
			if (!moved && onClick) onClick();
		});
	}

	// ---------------------------------------------------------------- 取樣流程

	function togglePicking() {
		if (picking) stopPicking(); else startPicking();
	}

	function startPicking() {
		picking = true;
		recording = true;
		balloon.classList.add("on");
		balloon.textContent = "🎯";
		document.body.style.cursor = "crosshair";
	}

	function stopPicking() {
		picking = false;
		hoverRect = null;
		// 選中的是 DOM 時要留著框，否則選取狀態就看不見了
		if (!(selection && selection.kind === "dom")) domHighlight.style.display = "none";
		balloon.classList.remove("on");
		balloon.textContent = "🎈";
		document.body.style.cursor = "";
		// 面板關掉才真的停止記錄，否則選取框需要每幀重畫
		if (!panel.classList.contains("show")) recording = false;
	}

	function isOurUI(e) {
		const path = e.composedPath ? e.composedPath() : [];
		return path.includes(root);
	}

	function onMove(e) {
		if (!picking || isOurUI(e)) return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (el === MainCanvas?.canvas) {
			domHighlight.style.display = "none";
			const p = toVirtual(e.clientX, e.clientY);
			const hits = hitTest(p.x, p.y);
			hoverRect = hits.length ? hits[0].rect : null;
		} else if (el) {
			hoverRect = null;
			const r = el.getBoundingClientRect();
			Object.assign(domHighlight.style, {
				display: "block", left: r.left + "px", top: r.top + "px",
				width: r.width + "px", height: r.height + "px",
				borderStyle: "dashed", borderColor: "#2f9e6b",
			});
		}
	}

	function onPick(e) {
		if (!picking || isOurUI(e)) return;
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		swallowUntil = Date.now() + 500; // 吞掉同一次手勢的 mouseup / click

		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (el === MainCanvas?.canvas) inspectCanvas(e.clientX, e.clientY);
		else inspectDom(el, e.clientX, e.clientY);
		stopPicking(); // 要在 selection 決定之後才收，stopPicking 會依選取類型決定是否保留 DOM 外框
	}

	function onSwallow(e) {
		if (Date.now() > swallowUntil || isOurUI(e)) return;
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
	}

	function nextFrames(n) {
		return new Promise((resolve) => {
			const step = () => (--n <= 0 ? resolve() : requestAnimationFrame(step));
			requestAnimationFrame(step);
		});
	}

	/**
	 * F2：直接偵測游標當下所在的物件，完全不碰滑鼠。
	 * 有些東西（tooltip、選單）一被點就收起來，用點的根本抓不到，所以這條路才是主要用法。
	 */
	async function inspectAtPointer() {
		const { x, y } = lastMouse;
		if (!recording) {
			// 剛開錄時 lastLog 還是空的，要等一整幀 DrawProcess 跑完才有東西可以命中
			recording = true;
			await nextFrames(2);
		}
		if (picking) stopPicking();
		const el = document.elementFromPoint(x, y);
		if (el === root) return; // 游標在自己的 UI 上，不要偵測自己
		if (el === MainCanvas?.canvas) inspectCanvas(x, y);
		else inspectDom(el, x, y);
	}

	function installInput() {
		// 永遠追蹤游標位置，F2 才知道要看哪裡
		window.addEventListener("pointermove", (e) => {
			lastMouse = { x: e.clientX, y: e.clientY };
		}, true);

		// capture 階段搶在 BC 之前處理
		window.addEventListener("pointerdown", onPick, true);
		window.addEventListener("pointermove", onMove, true);
		for (const t of ["mousedown", "mouseup", "click", "touchstart", "touchend"]) {
			window.addEventListener(t, onSwallow, true);
		}
		window.addEventListener("keydown", (e) => {
			if (e.key === "F2") {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				inspectAtPointer();
				return;
			}
			// F3：凍結／解凍這一幀的繪製清單，並跳到「幀」頁
			if (e.key === "F3") {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				recording = true;
				frozen = !frozen;
				tab = "frame";
				panel.querySelectorAll("[data-tab]").forEach((o) => o.classList.toggle("on", o.dataset.tab === "frame"));
				renderPanel();
				return;
			}
			// ESC：直接收掉，等同按 ✕。只清選取的話會留一個空面板跟殘框，沒有意義
			if (e.key === "Escape" && (picking || panel.classList.contains("show"))) {
				e.stopPropagation();
				closePanel();
			}
		}, true);
	}

	// ---------------------------------------------------------------- 面板內容

	/**
	 * 清掉目前選取。每次新的偵測都要先做，否則 DOM 的紅框（獨立的 DOM 元素）
	 * 會留在畫面上跟新的 canvas 選取框疊在一起，連按 F2 就會看到一堆紅框。
	 */
	function clearSelection() {
		selection = null;
		hoverRect = null;
		if (domHighlight) domHighlight.style.display = "none";
	}

	/** 收工：關面板、清選取、停止記錄。✕ 和 ESC 共用（覆寫不動，關面板不等於還原） */
	function closePanel() {
		panel.classList.remove("show");
		clearSelection();
		stopPicking();
		// 回放與凍結是「檢視狀態」，一定要還原：不然面板關掉後畫面會永遠停在畫一半的樣子，
		// 而且沒有任何介面可以救回來。覆寫（位移/變色）則是刻意保留的編輯，不在此列。
		scrubLimit = -1;
		frozen = false;
		recording = false; // 面板關了就別再每幀累積繪製清單
	}

	function inspectCanvas(clientX, clientY) {
		clearSelection();
		const p = toVirtual(clientX, clientY);
		const hits = hitTest(p.x, p.y);
		selection = {
			kind: "canvas",
			point: p,
			client: { x: clientX, y: clientY },
			hits,
			index: 0,
			rect: hits.length ? hits[0].rect : null,
			pixel: pixelAt(p.x, p.y),
		};
		renderPanel();
	}

	function inspectDom(el, clientX, clientY) {
		clearSelection();
		selection = { kind: "dom", el, client: { x: clientX, y: clientY }, rect: null };
		if (el) {
			const r = el.getBoundingClientRect();
			Object.assign(domHighlight.style, {
				display: "block", left: r.left + "px", top: r.top + "px",
				width: r.width + "px", height: r.height + "px",
				borderStyle: "solid", borderColor: "#ff3b6b",
			});
		}
		renderPanel();
	}

	function row(k, v) {
		return `<div class="row"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`;
	}

	function swatch(hex, extra = "") {
		if (!hex) return `<span class="v" style="color:#777">—</span>`;
		return `<span class="sw" style="background:${esc(hex)}"></span><span class="v">${esc(hex)}${extra}</span>`;
	}

	function renderPanel() {
		panel.classList.add("show");
		recording = true;
		const bd = panel.querySelector(".bd");
		if (tab === "frame") {
			bd.innerHTML = renderFrameTab();
			wireFrameTab();
			return;
		}
		if (!selection) {
			bd.innerHTML = `<div class="empty">按 🎈 或 <kbd>F2</kbd> 偵測游標下的物件</div>`;
			return;
		}
		bd.innerHTML = selection.kind === "canvas" ? renderCanvasInfo() : renderDomInfo();
		wirePanel();
	}

	// ---------------------------------------------------------------- 幀（事件瀏覽器 + 回放）

	function renderFrameTab() {
		const log = lastLog;
		const total = frameTopCount;

		let h = `<div class="row">
			<button class="act ${frozen ? "pri" : ""}" data-freeze>${frozen ? "◼ 已凍結" : "❚❚ 凍結這一幀"}</button>
			<span class="dt" style="color:#777">${frozen ? "清單已停住" : "清單每幀更新"} · <kbd>F3</kbd></span>
		</div>`;

		h += `<h4>逐呼叫回放</h4>`;
		h += `<div class="row">
			<input type="range" data-scrub min="0" max="${Math.max(total, 1)}"
				value="${scrubLimit < 0 ? total : scrubLimit}" style="flex:1">
			<span class="v" style="flex:0 0 auto;color:#ffb75c">${scrubLimit < 0 ? total : scrubLimit}/${total}</span>
		</div>`;
		h += `<div class="row"><button class="act" data-scrubreset ${scrubLimit < 0 ? "disabled" : ""}>畫回全部</button></div>`;
		h += `<div class="note">拉滑桿 = 只畫前 N 個頂層繪製呼叫，畫面會停在「畫到一半」的狀態，
			可以看出每個東西是誰畫的、蓋在誰上面。
			<span class="warn">這是把「當下這一幀」切斷重畫，不是重播擷取到的舊幀</span> ——
			靜態畫面兩者等價，會動的畫面（動畫、hover）就不是。</div>`;

		if (!log.length) {
			return h + `<div class="empty">還沒有繪製資料，等一幀。</div>`;
		}

		// 事件瀏覽器
		const f = frameFilter.toLowerCase();
		const shown = log.filter((r) => !f || r.fn.toLowerCase().includes(f) ||
			String(r.label ?? "").toLowerCase().includes(f) || String(r.src ?? "").toLowerCase().includes(f));

		h += `<h4>繪製呼叫（${shown.length}${f ? ` / ${log.length}` : ""}，頂層 ${total}）</h4>`;
		h += `<div class="row"><input type="text" data-filter value="${esc(frameFilter)}" placeholder="過濾：函式名 / 文字 / 圖檔"></div>`;
		h += `<div class="stack" style="max-height:300px">`;
		for (const r of shown) {
			const cut = scrubLimit >= 0 && r.top >= scrubLimit;
			const desc = r.isCharacter ? (r.C?.Name ?? "角色")
				: r.label ? shortStr(String(r.label), 16)
				: r.src ? shortStr(String(r.src).split("/").pop(), 16) : "";
			h += `<div class="si" data-ev="${r.order}" style="${cut ? "opacity:.35" : ""};padding-left:${6 + r.depth * 12}px">
				<span class="pr">${r.top}</span>
				<span class="fn">${esc(r.fn)}</span>
				<span class="dt">${esc(desc)}</span>
				<span class="dt" style="margin-left:auto">${r.ms != null ? r.ms.toFixed(2) + "ms" : ""}</span>
			</div>`;
		}
		h += `</div>`;
		h += `<div class="note">左邊數字是頂層呼叫序號（滑桿就是切在這個數字上）。有縮排的是子呼叫，
			屬於它上面那個頂層呼叫，跟著父層一起被切掉。灰掉的 = 目前被回放切掉、沒有畫出來。
			時間含子呼叫。點任一筆可跳到「選取」頁看它的細節。</div>`;
		return h;
	}

	function wireFrameTab() {
		const q = (s) => panel.querySelector(s);

		q("[data-freeze]").addEventListener("click", () => {
			frozen = !frozen;
			renderPanel();
		});

		const scrub = q("[data-scrub]");
		scrub?.addEventListener("input", () => {
			const v = parseInt(scrub.value, 10);
			scrubLimit = v >= frameTopCount ? -1 : v; // 拉到底 = 不限制
			renderPanel();
		});
		q("[data-scrubreset]")?.addEventListener("click", () => {
			scrubLimit = -1;
			renderPanel();
		});

		const filter = q("[data-filter]");
		filter?.addEventListener("input", () => {
			frameFilter = filter.value;
			const pos = filter.selectionStart;
			renderPanel();
			const nf = panel.querySelector("[data-filter]");
			if (nf) { nf.focus(); nf.setSelectionRange(pos, pos); }
		});

		panel.querySelectorAll("[data-ev]").forEach((n) => n.addEventListener("click", () => {
			const rec = lastLog.find((r) => r.order === parseInt(n.dataset.ev, 10));
			if (!rec) return;
			// 從事件瀏覽器選一筆：組一個跟點擊選取一樣的 selection
			selection = {
				kind: "canvas",
				point: { x: rec.rect[0] + rec.rect[2] / 2, y: rec.rect[1] + rec.rect[3] / 2 },
				hits: [rec], index: 0, rect: rec.rect,
				pixel: pixelAt(rec.rect[0] + rec.rect[2] / 2, rec.rect[1] + rec.rect[3] / 2),
			};
			tab = "select";
			panel.querySelectorAll("[data-tab]").forEach((o) => o.classList.toggle("on", o.dataset.tab === "select"));
			renderPanel();
		}));
	}

	function renderCanvasInfo() {
		const s = selection;
		const rec = s.hits[s.index];
		let h = `<div class="row"><span class="k">類型</span><span class="v"><span class="tag canvas">CANVAS</span></span></div>`;
		h += row("點擊座標", `x: ${s.point.x.toFixed(1)}, y: ${s.point.y.toFixed(1)} <span style="color:#777">(2000×1000)</span>`);
		h += `<div class="row"><span class="k">實際像素</span>${swatch(s.pixel.hex, s.pixel.alpha != null ? ` <span style="color:#777">a=${s.pixel.alpha}</span>` : "")}</div>`;
		if (s.pixel.error) h += `<div class="note warn">取色失敗（畫布被跨域圖片污染）：${esc(shortStr(s.pixel.error, 60))}</div>`;

		if (!rec) {
			h += `<div class="note">這個位置沒有任何被記錄到的繪製呼叫。可能是直接畫在背景上，或是由未被 hook 的函式繪製的。</div>`;
			return h;
		}

		h += `<h4>選中的繪製呼叫</h4>`;
		h += row("函式", `<span style="color:#8fd0ff">${esc(rec.fn)}()</span>`);
		h += row("矩形", `L ${rec.rect[0].toFixed(0)}, T ${rec.rect[1].toFixed(0)}`);
		h += row("尺寸", `${rec.rect[2].toFixed(0)} × ${rec.rect[3].toFixed(0)}`);
		if (rec.label != null && rec.label !== "") h += row("文字", esc(shortStr(rec.label, 50)));
		if (rec.src) h += row("圖片", esc(shortStr(rec.src, 50)));
		if (rec.tip) h += row("提示", esc(shortStr(rec.tip, 40)));
		if (rec.color) h += `<div class="row"><span class="k">宣告顏色</span>${swatch(normalizeColor(rec.color) || rec.color)}</div>`;
		if (rec.ms != null) h += row("耗時", `${rec.ms.toFixed(3)} ms <span style="color:#777">(含子呼叫)</span>`);
		if (rec.top != null) h += row("呼叫序號", `${rec.top} <span style="color:#777">(頂層)</span>`);

		h += renderTexture(rec);
		h += renderState(rec);

		// 屬性表對所有繪製呼叫都適用（角色也在 UI_SPEC 裡，所以角色也能直接拖位置）
		h += renderUiTools(rec);
		if (rec.isCharacter) h += renderCharacterTools(rec);
		h += renderStack();
		return h;
	}

	/** 圖層的顯示名稱 */
	function layerLabel(layer) {
		if (!layer) return "(未知圖層)";
		const g = layer.Asset?.Group?.Name ?? "?";
		const a = layer.Asset?.Name ?? "?";
		return layer.Name ? `${g}/${a}/${layer.Name}` : `${g}/${a}`;
	}

	function renderLayerSection(rec) {
		const C = rec.C;
		const hits = hitLayers(rec, selection.point.x, selection.point.y);
		const all = Array.isArray(C.AppearanceLayers) ? C.AppearanceLayers : [];

		let h = `<h4>圖層（像素級命中）</h4>`;
		if (!rec.blit) {
			return h + `<div class="note warn">抓不到角色的貼圖參數，無法換算座標。這通常表示這個畫面用了非標準的角色繪製路徑。</div>`;
		}
		if (!getLayerDraws(C)) {
			return h + `<div class="note warn">這個角色沒有圖層繪製紀錄。</div>`;
		}
		if (!hits.length) {
			h += `<div class="note">游標下沒有任何不透明的圖層（點到的是全透明區域或角色以外的地方）。</div>`;
		}

		// 下拉選單：命中的排前面，其餘依繪製順序由上而下
		const hitLayerSet = new Set(hits.map((x) => x.layer).filter(Boolean));
		const ordered = all.slice().reverse(); // AppearanceLayers 由底到頂，反過來變成由頂到底
		selection.layerList = ordered;

		if (hits.length) {
			const top = hits[0];
			h += row("最上層", `<span style="color:#8fd0ff">${esc(layerLabel(top.layer))}</span>`);
			h += row("Priority", `<span style="color:#ffb75c">${esc(top.layer?.Priority ?? "—")}</span> <span style="color:#777">(圖層排序用的 int)</span>`);
			h += row("該點 alpha", top.alpha < 0 ? "讀不到（跨域）" : `${top.alpha} / 255`);
			h += row("圖層座標", `${top.at[0]}, ${top.at[1]} <span style="color:#777">(角色畫布)</span>`);
		}

		if (!ordered.length) return h;

		let preferred = hits.length ? ordered.indexOf(hits[0].layer) : 0;
		if (preferred < 0) preferred = 0;

		h += `<h4>單獨染這一層 <span style="color:#777;font-weight:400">（item.Color[ColorIndex]）</span></h4>`;
		h += `<div class="row"><select data-layer>`;
		ordered.forEach((L, i) => {
			const mark = hitLayerSet.has(L) ? "◆ " : "";
			const colorable = L.AllowColorize !== false;
			h += `<option value="${i}" ${i === preferred ? "selected" : ""} ${colorable ? "" : "disabled"}>`;
			h += `${esc(mark + "P" + (L.Priority ?? "?") + " · " + layerLabel(L))}${colorable ? "" : "（不可染色）"}</option>`;
		});
		h += `</select></div>`;
		h += `<div class="row">
			<span class="k">顏色</span>
			<input type="color" data-layercolor value="${layerColorOf(C, ordered[preferred])}">
			<span class="dt" style="color:#777">ColorIndex: ${esc(ordered[preferred]?.ColorIndex ?? 0)}</span>
		</div>`;
		h += `<div class="note">◆ = 游標下實際命中（已排除透明像素）。P 數字就是 layer.Priority，BC 靠它決定誰蓋誰；
			道具的 <code>Property.OverridePriority</code> 會覆蓋它。單層染色會把 item.Color 攤成陣列再改指定那一格。</div>`;

		h += `<h4>完整圖層堆疊（${ordered.length}）</h4><div class="stack">`;
		ordered.forEach((L) => {
			h += `<div class="si">
				<span class="pr">P${esc(L.Priority ?? "?")}</span>
				<span class="fn">${esc(shortStr(layerLabel(L), 30))}</span>
				<span class="dt" style="margin-left:auto">${hitLayerSet.has(L) ? "◆" : ""}</span>
			</div>`;
		});
		h += `</div><div class="note">由上而下 = 由最上層到最底層，直接讀 C.AppearanceLayers（BC 已排序好的結果）。</div>`;
		return h;
	}

	function layerColorOf(C, layer) {
		if (!layer) return "#ffffff";
		const item = C.Appearance?.find((i) => i.Asset === layer.Asset);
		if (!item) return "#ffffff";
		const c = Array.isArray(item.Color) ? item.Color[layer.ColorIndex ?? 0] : item.Color;
		return normalizeColor(c) || "#ffffff";
	}

	function renderCharacterTools(rec) {
		const C = rec.C;
		const groups = hitGroups(rec, selection.point.x, selection.point.y);
		const app = Array.isArray(C.Appearance) ? C.Appearance : [];

		let h = `<h4>角色</h4>`;
		h += row("名稱", esc(C.Name || C.AccountName || "?"));
		h += row("會員編號", esc(C.MemberNumber ?? "—"));
		h += row("身高比例", (rec.heightRatio ?? 1).toFixed(3));
		if (groups.length) {
			h += row("命中部位", groups.map((g) => `<span style="color:#8fd0ff">${esc(g.group.Name)}</span>`).join(", "));
		}

		h += renderLayerSection(rec);

		// 預設選中「命中部位裡有穿東西」的那一件
		const hitNames = groups.map((g) => g.group.Name);
		let preferred = app.findIndex((it) => hitNames.includes(it.Asset?.Group?.Name));
		if (preferred < 0) preferred = 0;

		h += `<h4>整件染色 <span style="color:#777;font-weight:400">（item.Color，所有層一起）</span></h4>`;
		if (!app.length) return h + `<div class="note">這個角色身上沒有可讀取的 Appearance。</div>`;

		h += `<div class="row"><select data-item>`;
		app.forEach((it, i) => {
			const g = it.Asset?.Group;
			const colorable = g?.AllowColorize !== false && colorLayers(it) > 0;
			const mark = hitNames.includes(g?.Name) ? "◆ " : "";
			h += `<option value="${i}" ${i === preferred ? "selected" : ""} ${colorable ? "" : "disabled"}>${esc(mark + (g?.Name ?? "?") + " / " + (it.Asset?.Name ?? "?"))}${colorable ? "" : "（不可染色）"}</option>`;
		});
		h += `</select></div>`;
		h += `<div class="row">
			<span class="k">顏色</span>
			<input type="color" data-itemcolor value="${currentColorOf(app[preferred])}">
			<button class="act" data-reset>還原這件</button>
		</div>`;
		h += `<div class="row"><label style="display:flex;gap:5px;align-items:center;cursor:pointer">
			<input type="checkbox" data-push ${C.IsPlayer && C.IsPlayer() ? "" : "disabled"}> 同步到伺服器（只對自己有效）</label></div>`;
		h += `<div class="note">◆ 標記 = 你點到的部位。拖色盤就會即時看到變化。未勾同步時只改本地畫面，
			重新整理或角色重載就會回復。多層可染色的道具（ColorableLayerCount &gt; 1）會把所有層設成同一色。</div>`;
		return h;
	}

	/** 紋理預覽：直接把這次繪製用到的那張圖秀出來 */
	function renderTexture(rec) {
		const img = resolveImg(rec.srcRef ?? rec.src);
		if (!img || !img.width) return "";
		let url = null;
		if (typeof rec.src === "string" && rec.src !== "(canvas)") {
			url = rec.src;
		} else if (img instanceof HTMLCanvasElement) {
			// 離屏畫布（例如角色合成好的那張）沒有 URL，轉成 data URI 才秀得出來
			try { url = img.toDataURL(); } catch { return ""; } // 跨域汙染就放棄
		}
		if (!url) return "";
		return `<h4>紋理</h4>
			<div class="row"><span class="k">尺寸</span><span class="v">${img.width} × ${img.height}</span></div>
			<div class="texbox"><img src="${esc(url)}" alt=""></div>`;
	}

	/** 繪製狀態：相當於 RenderDoc 的 pipeline state，只是 canvas 2D 版 */
	function renderState(rec) {
		const s = rec.state;
		if (!s) return "";
		const t = s.transform;
		const identity = t && t[0] === 1 && t[1] === 0 && t[2] === 0 && t[3] === 1 && t[4] === 0 && t[5] === 0;
		let h = `<h4>繪製狀態</h4>`;
		h += row("globalAlpha", s.alpha);
		h += row("合成模式", esc(s.composite));
		if (s.filter && s.filter !== "none") h += row("filter", esc(s.filter));
		if (s.font) h += row("字型", esc(shortStr(s.font, 28)) + ` <span style="color:#777">/ ${esc(s.align)}</span>`);
		h += row("transform", identity ? `<span style="color:#777">單位矩陣</span>` : t.map((n) => Math.round(n * 100) / 100).join(", "));
		return h;
	}

	/** 一列可即時編輯的數值（顯示絕對值，內部存差值） */
	function numRow(label, prop, orig, delta) {
		if (orig == null) return "";
		const val = orig + (delta || 0);
		const dirty = delta ? ` style="border-color:#ffb75c"` : "";
		return `<div class="row">
			<span class="k">${esc(label)}</span>
			<input type="number" data-num="${prop}" value="${Math.round(val * 100) / 100}" step="1"${dirty}>
			<span class="dt" style="color:#777">原始 ${Math.round(orig)}</span>
		</div>`;
	}

	function renderUiTools(rec) {
		if (!rec.key || !rec.spec || !rec.orig) {
			return `<div class="note">這個繪製呼叫沒有登記可編輯的參數，只能看不能改。</div>`;
		}
		const o = uiOverrides.get(rec.key) || {};
		const s = rec.spec;
		selection.editKey = rec.key;

		let h = `<h4>屬性 <span style="color:#777;font-weight:400">（改了立刻生效）</span></h4>`;
		h += numRow("X", "dx", rec.orig.x, o.dx);
		h += numRow("Y", "dy", rec.orig.y, o.dy);
		h += numRow(s.w != null && rec.fn === "DrawCircle" ? "半徑" : "寬", "dw", rec.orig.w, o.dw);
		h += numRow("高", "dh", rec.orig.h, o.dh);

		if (s.color != null) {
			const base = normalizeColor(o.color || rec.orig.color) || "#ffffff";
			h += `<div class="row">
				<span class="k">顏色</span>
				<input type="color" data-uicolor value="${base}">
				<span class="dt" style="color:#777">原始 ${esc(shortStr(rec.orig.color ?? "—", 12))}</span>
			</div>`;
		}

		const dirty = uiOverrides.has(rec.key);
		h += `<div class="row" style="margin-top:6px">
			<button class="act" data-uiclear ${dirty ? "" : "disabled"}>還原這個</button>
			${uiOverrides.size ? `<button class="act" data-uiclearall>還原全部 (${uiOverrides.size})</button>` : ""}
		</div>`;
		h += `<div class="note">改的是繪製前的參數，不是資料 —— 畫面每幀重畫，所以拖動數字就能即時看到位移/變色的效果。
			比對依據是「函式名 + 原始座標」，換畫面或元件本來就會動的話就會失效（還原鈕仍可清掉）。
			${rec.fn === "DrawButton" ? '<span class="warn">注意：滑鼠移上按鈕時 BC 會強制畫成 Cyan，改的顏色要移開滑鼠才看得到。</span>' : ""}</div>`;
		return h;
	}

	function renderStack() {
		const s = selection;
		let h = `<h4>這個位置的繪製堆疊（${s.hits.length}）</h4><div class="stack">`;
		s.hits.forEach((rec, i) => {
			const desc = rec.isCharacter ? (rec.C?.Name ?? "角色")
				: rec.label ? shortStr(rec.label, 18)
				: rec.src ? shortStr(String(rec.src).split("/").pop(), 18)
				: "";
			h += `<div class="si ${i === s.index ? "sel" : ""}" data-hit="${i}">
				<span class="pr">#${rec.order}</span>
				<span class="fn">${esc(rec.fn)}</span>
				<span class="dt">${esc(desc)}</span>
				<span class="dt" style="margin-left:auto">${rec.rect[2].toFixed(0)}×${rec.rect[3].toFixed(0)}</span>
			</div>`;
		});
		h += `</div><div class="note">由上而下 = 由最上層到最底層。點任一筆可切換選取。
			<b>#數字是這一幀的繪製呼叫序號</b> —— 介面元件沒有 priority 之類的 int，
			純粹「誰後畫誰在上面」，所以序號就是它的 z 序。只有角色圖層才有真正的 Priority。</div>`;
		return h;
	}

	function renderDomInfo() {
		const el = selection.el;
		if (!el) return `<div class="empty">抓不到元素</div>`;
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle(el);
		selection.domRect = r;

		let h = `<div class="row"><span class="k">類型</span><span class="v"><span class="tag dom">DOM</span></span></div>`;
		h += row("標籤", `&lt;${esc(el.tagName.toLowerCase())}&gt;`);
		if (el.id) h += row("id", esc(el.id));
		if (el.className && typeof el.className === "string") h += row("class", esc(shortStr(el.className, 40)));
		// BC 的 DOM 元件其實也是照畫布座標擺的，換算成 2000×1000 才能跨解析度對照
		const v = clientRectToVirtual(r);
		h += row("畫布座標", `x: ${v.x.toFixed(1)}, y: ${v.y.toFixed(1)} <span style="color:#777">(2000×1000)</span>`);
		h += row("畫布尺寸", `${v.w.toFixed(1)} × ${v.h.toFixed(1)}`);
		h += row("螢幕座標", `L ${r.left.toFixed(1)}, T ${r.top.toFixed(1)} <span style="color:#777">(實際 px)</span>`);
		h += row("螢幕尺寸", `${r.width.toFixed(1)} × ${r.height.toFixed(1)}`);
		h += row("position", esc(cs.position) + " / z-index: " + esc(cs.zIndex));

		h += `<h4>屬性 <span style="color:#777;font-weight:400">（改了立刻生效）</span></h4>`;
		for (const [prop, label] of [["left", "left"], ["top", "top"], ["width", "width"], ["height", "height"]]) {
			h += `<div class="row">
				<span class="k">${label}</span>
				<input type="text" data-css="${prop}" value="${esc(el.style[prop] || cs[prop])}" placeholder="${esc(cs[prop])}">
			</div>`;
		}
		for (const [prop, label] of [["color", "文字"], ["backgroundColor", "背景"], ["borderColor", "邊框"]]) {
			const cur = cs[prop === "borderColor" ? "borderTopColor" : prop];
			h += `<div class="row">
				<span class="k">${label}</span>
				<input type="color" data-domcolor="${prop}" value="${normalizeColor(cur) || "#ffffff"}">
				<span class="dt" style="color:#777">${esc(shortStr(cur, 20))}</span>
			</div>`;
		}
		h += `<div class="row" style="margin-top:6px"><button class="act" data-domreset>還原這個元素</button></div>`;
		h += `<div class="note">直接寫進 element.style（行內樣式），改了馬上看得到。
			BC 重建該元素或視窗縮放重新排版後就會被蓋掉。位置欄要帶單位，例如 <code>120px</code>。</div>`;
		return h;
	}

	function wirePanel() {
		const q = (sel) => panel.querySelector(sel);
		const qa = (sel) => panel.querySelectorAll(sel);

		// 切換堆疊選取
		qa("[data-hit]").forEach((n) => n.addEventListener("click", () => {
			selection.index = parseInt(n.dataset.hit, 10);
			selection.rect = selection.hits[selection.index].rect;
			renderPanel();
		}));

		// --- 逐圖層染色（即時） ---
		const layerSel = q("[data-layer]");
		if (layerSel && selection.layerList) {
			const C = selection.hits[selection.index].C;
			const pickLayer = () => selection.layerList[parseInt(layerSel.value, 10)];
			layerSel.addEventListener("change", () => {
				q("[data-layercolor]").value = layerColorOf(C, pickLayer());
			});
			q("[data-layercolor]")?.addEventListener("input", (e) => {
				const L = pickLayer();
				const item = L && C.Appearance?.find((i) => i.Asset === L.Asset);
				if (!item) return;
				queueRecolor(C, () => applyLayerColor(C, item, L, e.target.value));
			});
		}

		// --- 整件染色（即時） ---
		const itemSel = q("[data-item]");
		if (itemSel) {
			const C = selection.hits[selection.index].C;
			const pick = () => C.Appearance[parseInt(itemSel.value, 10)];
			itemSel.addEventListener("change", () => {
				q("[data-itemcolor]").value = currentColorOf(pick());
			});
			q("[data-itemcolor]")?.addEventListener("input", (e) => {
				const item = pick();
				if (!item) return;
				queueRecolor(C, () => applyItemColor(C, item, e.target.value));
			});
			q("[data-reset]")?.addEventListener("click", () => {
				const item = pick();
				if (!item) return;
				resetItemColor(C, item);
				if (q("[data-push]")?.checked) pushToServer(C);
				renderPanel();
			});
			q("[data-push]")?.addEventListener("change", (e) => {
				if (e.target.checked) pushToServer(C);
			});
		}

		// --- 繪製呼叫的即時編輯 ---
		const key = selection.editKey;
		if (key) {
			const rec = selection.hits[selection.index];
			// 數值欄：顯示的是絕對值，存回去的是跟原始值的差
			qa("[data-num]").forEach((n) => n.addEventListener("input", () => {
				const prop = n.dataset.num;
				const base = { dx: rec.orig.x, dy: rec.orig.y, dw: rec.orig.w, dh: rec.orig.h }[prop];
				const val = parseFloat(n.value);
				if (!isFinite(val) || base == null) return;
				const o = overrideFor(key, true);
				o[prop] = val - base;
				n.style.borderColor = o[prop] ? "#ffb75c" : "";
			}));
			q("[data-uicolor]")?.addEventListener("input", (e) => {
				overrideFor(key, true).color = e.target.value;
			});
			q("[data-uiclear]")?.addEventListener("click", () => {
				uiOverrides.delete(key);
				renderPanel();
			});
			q("[data-uiclearall]")?.addEventListener("click", () => {
				uiOverrides.clear();
				renderPanel();
			});
		}

		// --- DOM 的即時編輯 ---
		const el = selection.kind === "dom" ? selection.el : null;
		if (el) {
			const backup = () => {
				if (selection.domBackup == null) selection.domBackup = el.getAttribute("style") || "";
			};
			qa("[data-css]").forEach((n) => n.addEventListener("input", () => {
				backup();
				el.style[n.dataset.css] = n.value;
			}));
			qa("[data-domcolor]").forEach((n) => n.addEventListener("input", () => {
				backup();
				el.style[n.dataset.domcolor] = n.value;
			}));
			q("[data-domreset]")?.addEventListener("click", () => {
				if (selection.domBackup != null) {
					el.setAttribute("style", selection.domBackup);
					selection.domBackup = null;
				}
				renderPanel();
			});
		}
	}

	// ---------------------------------------------------------------- 啟動

	async function initialize() {
		// Phase 1：SDK 就緒就先註冊，不等登入
		await waitFor(() => !!window.bcModSdk);
		modApi = window.bcModSdk.registerMod({
			name: MOD_NAME,
			fullName: "Draw Detection Tool",
			version: MOD_VERSION,
			repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
		});
		installDrawHooks();

		// Phase 2：等玩家真的登入、資源就緒才掛 UI
		// 注意：MainCanvas 在 Drawing.js 是用 let 宣告的，不會掛到 window 上，只能用裸識別字讀
		await waitFor(() => !!window.Player?.AccountName && typeof MainCanvas !== "undefined" && !!MainCanvas);
		buildUI();
		installInput();
		console.log(`🐈‍⬛ [${MOD_NAME}] ✅ v${MOD_VERSION} loaded`);
	}

	initialize().catch((e) => console.error(`🐈‍⬛ [${MOD_NAME}] init error`, e));
})();
