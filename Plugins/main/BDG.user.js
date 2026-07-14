// ==UserScript==
// @name         BC Draw Game (你畫我猜繪圖插件)
// @namespace    https://example.com
// @version      0.2.0
// @description  在 BC 聊天室畫布上疊加繪圖層，透過 Hidden 訊息即時同步筆劃給房間內其他人
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.BDG) return;
    const MOD_VER = "0.2.0";
    window.Liko.BDG = MOD_VER;

	// ============================================================
	// 常數設定
	// ============================================================
	const LOGICAL_W = 2000; // BC 遊戲畫面的邏輯座標寬（不是螢幕像素）
	const LOGICAL_H = 1000;
	const BATCH_INTERVAL = 400; // 每隔多久打包送出一次新增的點（ms）
	const CONTENT_TAG = "DrawGameMsg";
	const MOD_NAME = "DrawGame";
	const SCREEN_POLL_INTERVAL = 300; // 輪詢 CurrentScreen 的間隔（ms）
	const BRUSH_PREVIEW_HOLD_MS = 700; // 筆觸尺寸預覽點顯示多久後消失

	// ============================================================
	// 全域狀態
	// ============================================================
	const State = {
		inChatRoom: false, // 目前是否在 ChatRoom 畫面（只有這時才顯示/互動）
		drawEnabled: false, // 是否處於「畫圖模式」（true 時攔截點擊給畫布）
		ignoreSenders: new Set(), // 接收端的選擇權：不想看到這些人的畫面更新（畫圖本身一律分享，只有「要不要收」是接收方能決定的）
		pluginUsers: new Set(), // 已知目前房間內有裝這個插件的人（MemberNumber），用來做「限制顯示」清單
		color: "#e24b4a",
		width: 6,
		tool: "pen", // 'pen' | 'eraser'
		myStrokeId: 0,
		currentStroke: null, // { id, color, width, tool, points: [...] }
		pendingPoints: [], // 尚未送出的新點（本地畫完就丟進來，等批次 flush）
		remoteStrokes: new Map(), // strokeKey(senderId+strokeId) -> 該筆畫最後一個點座標，用來銜接批次
		toolbarOpen: false, // 工具列面板是否展開
		restrictOpen: false, // 限制顯示面板是否展開
		brushPreviewTimer: null,
	};

	// ============================================================
	// Overlay 畫布：疊在 BC 主畫布正上方
	// previewCanvas：疊在 overlay 之上，只用來顯示筆觸尺寸預覽點，不接收互動
	// ============================================================
	let overlay, octx;
	let previewCanvas, pctx;

	function makeLayerCanvas(zIndex) {
		const c = document.createElement("canvas");
		c.width = LOGICAL_W;
		c.height = LOGICAL_H;

		// 直接套用跟 MainCanvas 完全一樣的排版規則（position:absolute + inset:0 + margin:auto + width:100% + aspect-ratio），
		// 讓瀏覽器排版引擎把兩者鎖在同一個框裡自動同步，不需要任何 JS 去讀/算/輪詢座標。
		c.style.position = "absolute";
		c.style.inset = "0";
		c.style.margin = "auto";
		c.style.width = "100%";
		c.style.aspectRatio = `${LOGICAL_W} / ${LOGICAL_H}`;

		c.style.pointerEvents = "none";
		c.style.zIndex = String(zIndex);
		c.style.touchAction = "none";
		c.style.userSelect = "none";
		c.style.webkitUserSelect = "none";
		c.style.outline = "none";
		c.style.display = "none"; // 預設隱藏，進入 ChatRoom 後才顯示（需求 4）

		return c;
	}

	function createOverlay() {
		const main = getMainCanvas();
		if (!main || !main.parentElement) throw new Error("[DrawGame] 找不到 #MainCanvas 或其父節點，無法插入 overlay");

		overlay = makeLayerCanvas(50); // 蓋過角色與背景，但不蓋 BCX 等常見插件子畫面（慣例 5~10 之外另計）
		main.insertAdjacentElement("afterend", overlay);
		octx = overlay.getContext("2d");

		previewCanvas = makeLayerCanvas(51); // 永遠疊在 overlay 之上，純顯示用
		overlay.insertAdjacentElement("afterend", previewCanvas);
		pctx = previewCanvas.getContext("2d");
	}

	function getMainCanvas() {
		// BC 的主畫布，實際 id 依版本可能不同，請視你載入的 BC 版本核對
		return document.getElementById("MainCanvas") || document.querySelector("canvas#MainCanvas");
	}

	// 把滑鼠/觸控的螢幕座標，轉成 0~2000 / 0~1000 的邏輯座標
	// 這一步是關鍵：不論畫面被拉伸到多大，雙方傳輸的永遠是同一套邏輯座標系
	function toLogicalCoord(clientX, clientY) {
		const rect = overlay.getBoundingClientRect();
		const x = Math.round(((clientX - rect.left) / rect.width) * LOGICAL_W);
		const y = Math.round(((clientY - rect.top) / rect.height) * LOGICAL_H);
		return [x, y];
	}

	// ============================================================
	// 畫圖模式切換：只控制「能不能畫、事件會不會被攔截」。
	// 不做「要不要傳送」的開關——畫了就一定分享，
	// 要不要接收是接收端的權利（見下方 ignoreSenders / 限制顯示面板）。
	// 額外用 State.inChatRoom 雙重把關：離開聊天室後即使 drawEnabled 沒被清掉，
	// overlay 也不會再攔截任何點擊（需求 4）。
	// ============================================================
	function setDrawMode(enabled) {
		State.drawEnabled = enabled;
		updateOverlayInteractivity();
		overlay.style.cursor = enabled ? "crosshair" : "default";
		overlay.style.boxShadow = enabled ? "inset 0 0 0 2px #e24b4a" : "none"; // 明顯的邊框，一眼判斷目前是否在畫圖狀態
		document.body.style.userSelect = enabled ? "none" : ""; // 畫圖時鎖住全頁選取，避免拖曳途中不小心選到文字
		if (!enabled && State.currentStroke) endLocalStroke(); // 切出去前把沒收尾的筆畫收掉
		const cb = toolbarPanel && toolbarPanel.querySelector("#dg-draw");
		if (cb && cb.checked !== enabled) cb.checked = enabled;
	}

	function updateOverlayInteractivity() {
		if (!overlay) return;
		overlay.style.pointerEvents = State.drawEnabled && State.inChatRoom ? "auto" : "none";
	}

	function toggleIgnoreSender(memberNumber) {
		if (State.ignoreSenders.has(memberNumber)) State.ignoreSenders.delete(memberNumber);
		else State.ignoreSenders.add(memberNumber);
	}

	// ============================================================
	// 本地繪製（自己畫的當下就即時看到，不受批次延遲影響）
	// ============================================================
	function drawSegment(ctx, p1, p2, color, width, tool) {
		ctx.save();
		ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(p1[0], p1[1]);
		ctx.lineTo(p2[0], p2[1]);
		ctx.stroke();
		ctx.restore();
	}

	function startLocalStroke(x, y) {
		State.myStrokeId++;
		State.currentStroke = {
			id: State.myStrokeId,
			color: State.color,
			width: State.width,
			tool: State.tool,
			points: [[x, y]],
		};
		State.pendingPoints = [[x, y]];
	}

	function extendLocalStroke(x, y) {
		const s = State.currentStroke;
		if (!s) return;
		const last = s.points[s.points.length - 1];
		if (Math.hypot(x - last[0], y - last[1]) < 2) return; // 太密集的點省略，減少資料量
		drawSegment(octx, last, [x, y], s.color, s.width, s.tool);
		s.points.push([x, y]);
		State.pendingPoints.push([x, y]);
	}

	function endLocalStroke() {
		if (!State.currentStroke) return;
		// 補一個 end 標記進批次佇列，讓對方知道這筆畫結束了（避免下一筆被誤接上去）
		State.pendingPoints.push({ end: true, id: State.currentStroke.id });
		State.currentStroke = null;
	}

	function clearOverlay(broadcast) {
		octx.clearRect(0, 0, overlay.width, overlay.height);
		if (broadcast) sendHidden({ action: "clear" });
	}

	// ============================================================
	// 筆觸尺寸預覽：在畫面正中間畫一個點，顯示目前的筆刷粗細（需求 2）
	// ============================================================
	function showBrushSizePreview() {
		if (!pctx) return;
		pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

		const cx = LOGICAL_W / 2;
		const cy = LOGICAL_H / 2;
		const r = Math.max(State.width / 2, 1);

		pctx.save();
		pctx.beginPath();
		pctx.arc(cx, cy, r, 0, Math.PI * 2);
		if (State.tool === "eraser") {
			pctx.strokeStyle = "#333333";
			pctx.setLineDash([8, 6]);
			pctx.lineWidth = 3;
			pctx.stroke();
		} else {
			pctx.fillStyle = State.color;
			pctx.globalAlpha = 0.85;
			pctx.fill();
			pctx.globalAlpha = 1;
			pctx.lineWidth = 3;
			pctx.strokeStyle = "#000000";
			pctx.stroke();
		}
		pctx.restore();

		pctx.save();
		pctx.font = "34px sans-serif";
		pctx.textAlign = "center";
		pctx.textBaseline = "top";
		const label = `${State.width}px`;
		const labelY = cy + r + 16;
		pctx.lineWidth = 4;
		pctx.strokeStyle = "rgba(255,255,255,0.9)";
		pctx.strokeText(label, cx, labelY);
		pctx.fillStyle = "#222222";
		pctx.fillText(label, cx, labelY);
		pctx.restore();

		clearTimeout(State.brushPreviewTimer);
		State.brushPreviewTimer = setTimeout(() => {
			if (pctx) pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		}, BRUSH_PREVIEW_HOLD_MS);
	}

	// ============================================================
	// 送出：每 BATCH_INTERVAL 打包一次新增的點
	// ============================================================
	function sendHidden(payload) {
		if (typeof ServerSend !== "function") return;
		ServerSend("ChatRoomChat", {
			Type: "Hidden",
			Content: CONTENT_TAG,
			Dictionary: [{ Tag: CONTENT_TAG, payload }],
		});
	}

	setInterval(() => {
		if (!State.inChatRoom) return;
		if (State.pendingPoints.length === 0) return;
		const batch = State.pendingPoints;
		State.pendingPoints = [];
		sendHidden({
			action: "batch",
			strokeId: State.currentStroke ? State.currentStroke.id : State.myStrokeId,
			color: State.color,
			width: State.width,
			tool: State.tool,
			points: batch,
		});
	}, BATCH_INTERVAL);

	// ============================================================
	// 接收：解析對方送來的批次，用插值動畫補畫，避免瞬間跳格
	// ============================================================
	function remoteKey(senderId, strokeId) {
		return senderId + ":" + strokeId;
	}

	function handleIncoming(data) {
		if (data.Type !== "Hidden" || data.Content !== CONTENT_TAG) return false;
		const entry = data.Dictionary?.find((d) => d.Tag === CONTENT_TAG);
		if (!entry) return false;
		const senderId = data.Sender;

		// 只要收到這個 tag 的訊息，就代表對方有裝這個插件——記錄下來供「限制顯示」清單使用（需求 3）
		if (senderId !== undefined && senderId !== null) State.pluginUsers.add(senderId);

		if (State.ignoreSenders.has(senderId)) return true; // 已封鎖此人的畫面更新

		const payload = entry.payload;
		if (payload.action === "clear") {
			octx.clearRect(0, 0, overlay.width, overlay.height);
			return true;
		}
		if (payload.action === "batch") {
			replayBatch(senderId, payload);
			return true;
		}
		if (payload.action === "presence") {
			// 有人剛進聊天室廣播 hello，回一個 ack 讓對方也知道我有裝插件（互相探索）
			if (payload.state === "hello") sendHidden({ action: "presence", state: "ack" });
			refreshRestrictPanelIfOpen();
			return true;
		}
		return true;
	}

	function replayBatch(senderId, payload) {
		const key = remoteKey(senderId, payload.strokeId);
		const segments = []; // 要畫的線段清單
		let prev = State.remoteStrokes.get(key) || null;

		for (const p of payload.points) {
			if (p.end) {
				State.remoteStrokes.delete(remoteKey(senderId, p.id));
				prev = null;
				continue;
			}
			if (prev) segments.push([prev, p]);
			prev = p;
		}
		if (prev) State.remoteStrokes.set(key, prev);
		if (segments.length === 0) return;

		// 用 requestAnimationFrame 把這批線段的繪製時間攤開成接近批次間隔的長度，
		// 而不是一次全部畫完，這樣視覺上還是「正在被畫出來」而不是瞬間貼上一段線
		const durationMs = BATCH_INTERVAL * 0.85;
		const perSegment = durationMs / segments.length;
		let i = 0;
		function step() {
			if (i >= segments.length) return;
			const [a, b] = segments[i];
			drawSegment(octx, a, b, payload.color, payload.width, payload.tool);
			i++;
			setTimeout(() => requestAnimationFrame(step), perSegment);
		}
		requestAnimationFrame(step);
	}

	// ============================================================
	// 房間內成員名稱查詢（給「限制顯示」清單用）
	// ============================================================
	function getRoomCharacters() {
		try {
			const arr = window.ChatRoomCharacter;
			if (!Array.isArray(arr)) return [];
			return arr
				.filter((c) => c && typeof c.MemberNumber === "number")
				.map((c) => ({
					memberNumber: c.MemberNumber,
					name: c.Nickname || c.Name || `#${c.MemberNumber}`,
				}));
		} catch (e) {
			return [];
		}
	}

	// ============================================================
	// UI：氣球（可拖曳，點擊展開/收納工具面板）+ 工具面板 + 限制顯示面板
	// ============================================================
	let balloon, toolbarPanel, restrictPanel;

	function createBalloon() {
		balloon = document.createElement("div");
		balloon.id = "dg-balloon";
		balloon.textContent = "🎈";
		balloon.title = "拖曳移動；點一下展開/收起繪圖工具";
		Object.assign(balloon.style, {
			position: "fixed",
			right: "16px",
			bottom: "16px",
			width: "48px",
			height: "48px",
			borderRadius: "50%",
			background: "rgba(255,255,255,0.95)",
			border: "1px solid #ccc",
			boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
			display: "none", // 只有在 ChatRoom 才顯示（需求 4）
			alignItems: "center",
			justifyContent: "center",
			fontSize: "22px",
			cursor: "grab",
			userSelect: "none",
			zIndex: "9999",
			touchAction: "none",
		});
		document.body.appendChild(balloon);

		let dragging = false;
		let moved = false;
		let startX = 0;
		let startY = 0;
		let origLeft = 0;
		let origTop = 0;

		balloon.addEventListener("pointerdown", (e) => {
			dragging = true;
			moved = false;
			startX = e.clientX;
			startY = e.clientY;
			const rect = balloon.getBoundingClientRect();
			origLeft = rect.left;
			origTop = rect.top;
			balloon.style.cursor = "grabbing";
			balloon.setPointerCapture(e.pointerId);
			e.preventDefault();
			e.stopPropagation();
		});

		balloon.addEventListener("pointermove", (e) => {
			if (!dragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (Math.hypot(dx, dy) > 4) moved = true;
			if (!moved) return;
			let newLeft = origLeft + dx;
			let newTop = origTop + dy;
			newLeft = Math.min(Math.max(0, newLeft), window.innerWidth - balloon.offsetWidth);
			newTop = Math.min(Math.max(0, newTop), window.innerHeight - balloon.offsetHeight);
			balloon.style.left = `${newLeft}px`;
			balloon.style.top = `${newTop}px`;
			balloon.style.right = "auto";
			balloon.style.bottom = "auto";
			positionPanelNearBalloon(toolbarPanel);
			positionPanelNearBalloon(restrictPanel);
		});

		balloon.addEventListener("pointerup", (e) => {
			if (!dragging) return;
			dragging = false;
			balloon.style.cursor = "grab";
			if (balloon.hasPointerCapture?.(e.pointerId)) balloon.releasePointerCapture(e.pointerId);
			if (!moved) {
				State.toolbarOpen = !State.toolbarOpen;
				applyPanelVisibility();
			}
		});

		balloon.addEventListener("pointercancel", () => {
			dragging = false;
			balloon.style.cursor = "grab";
		});
	}

	function positionPanelNearBalloon(panelEl) {
		if (!panelEl || !balloon) return;
		const r = balloon.getBoundingClientRect();
		let left = r.left - panelEl.offsetWidth - 10;
		let top = r.top + r.height - panelEl.offsetHeight;
		if (left < 4) left = r.right + 10;
		if (left + panelEl.offsetWidth > window.innerWidth) left = window.innerWidth - panelEl.offsetWidth - 8;
		if (left < 4) left = 4;
		if (top + panelEl.offsetHeight > window.innerHeight) top = window.innerHeight - panelEl.offsetHeight - 8;
		if (top < 4) top = 4;
		panelEl.style.left = `${left}px`;
		panelEl.style.top = `${top}px`;
		panelEl.style.right = "auto";
		panelEl.style.bottom = "auto";
	}

	function createToolbar() {
		toolbarPanel = document.createElement("div");
		toolbarPanel.id = "dg-toolbar";
		Object.assign(toolbarPanel.style, {
			position: "fixed",
			zIndex: "9999",
			background: "rgba(255,255,255,0.97)",
			border: "1px solid #ccc",
			borderRadius: "8px",
			padding: "8px",
			display: "none", // 由 applyPanelVisibility 統一控制
			flexDirection: "column",
			gap: "6px",
			fontSize: "12px",
			fontFamily: "sans-serif",
			userSelect: "none",
			minWidth: "170px",
		});

		toolbarPanel.innerHTML = `
			<label><input type="checkbox" id="dg-draw"> 啟用畫圖模式</label>
			<label>顏色 <input type="color" id="dg-color" value="${State.color}"></label>
			<label>筆觸 <input type="range" id="dg-width" min="1" max="30" value="${State.width}"></label>
			<label><input type="checkbox" id="dg-eraser"> 橡皮擦</label>
			<button id="dg-clear" type="button">清除畫布</button>
			<button id="dg-restrict-toggle" type="button">限制顯示…</button>
		`;
		document.body.appendChild(toolbarPanel);

		toolbarPanel.querySelector("#dg-draw").addEventListener("change", (e) => setDrawMode(e.target.checked));
		toolbarPanel.querySelector("#dg-color").addEventListener("input", (e) => {
			State.color = e.target.value;
		});
		toolbarPanel.querySelector("#dg-width").addEventListener("input", (e) => {
			State.width = Number(e.target.value);
			showBrushSizePreview();
		});
		toolbarPanel.querySelector("#dg-eraser").addEventListener("change", (e) => {
			State.tool = e.target.checked ? "eraser" : "pen";
			showBrushSizePreview();
		});
		toolbarPanel.querySelector("#dg-clear").addEventListener("click", () => clearOverlay(true));
		toolbarPanel.querySelector("#dg-restrict-toggle").addEventListener("click", () => {
			State.restrictOpen = !State.restrictOpen;
			applyPanelVisibility();
		});
	}

	function createRestrictPanel() {
		restrictPanel = document.createElement("div");
		restrictPanel.id = "dg-restrict";
		Object.assign(restrictPanel.style, {
			position: "fixed",
			zIndex: "9999",
			background: "rgba(255,255,255,0.97)",
			border: "1px solid #ccc",
			borderRadius: "8px",
			padding: "8px",
			display: "none",
			flexDirection: "column",
			gap: "6px",
			fontSize: "12px",
			fontFamily: "sans-serif",
			userSelect: "none",
			minWidth: "200px",
			maxHeight: "260px",
			overflowY: "auto",
		});

		const header = document.createElement("div");
		Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold" });
		header.innerHTML = `<span>限制顯示（房間內有裝插件的人）</span>`;
		const closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.textContent = "×";
		closeBtn.style.marginLeft = "8px";
		closeBtn.addEventListener("click", () => {
			State.restrictOpen = false;
			applyPanelVisibility();
		});
		header.appendChild(closeBtn);
		restrictPanel.appendChild(header);

		const list = document.createElement("div");
		list.id = "dg-restrict-list";
		list.style.display = "flex";
		list.style.flexDirection = "column";
		list.style.gap = "4px";
		restrictPanel.appendChild(list);

		document.body.appendChild(restrictPanel);
	}

	function renderRestrictPanel() {
		if (!restrictPanel) return;
		const list = restrictPanel.querySelector("#dg-restrict-list");
		list.innerHTML = "";

		const myNumber = window.Player && window.Player.MemberNumber;
		const chars = getRoomCharacters();
		const nameByNumber = new Map(chars.map((c) => [c.memberNumber, c.name]));

		const members = [...State.pluginUsers].filter((n) => n !== myNumber);

		if (members.length === 0) {
			const empty = document.createElement("div");
			empty.style.color = "#888";
			empty.textContent = "目前沒有偵測到其他人有裝這個插件";
			list.appendChild(empty);
			return;
		}

		for (const memberNumber of members) {
			const row = document.createElement("div");
			Object.assign(row.style, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" });

			const nameSpan = document.createElement("span");
			nameSpan.textContent = nameByNumber.get(memberNumber) || `#${memberNumber}`;
			nameSpan.style.overflow = "hidden";
			nameSpan.style.textOverflow = "ellipsis";
			nameSpan.style.whiteSpace = "nowrap";
			row.appendChild(nameSpan);

			const btn = document.createElement("button");
			btn.type = "button";
			const blocked = State.ignoreSenders.has(memberNumber);
			btn.textContent = blocked ? "取消封鎖" : "封鎖";
			btn.addEventListener("click", () => {
				toggleIgnoreSender(memberNumber);
				renderRestrictPanel();
			});
			row.appendChild(btn);

			list.appendChild(row);
		}
	}

	function refreshRestrictPanelIfOpen() {
		if (State.restrictOpen) renderRestrictPanel();
	}

	function applyPanelVisibility() {
		if (!State.inChatRoom) {
			if (toolbarPanel) toolbarPanel.style.display = "none";
			if (restrictPanel) restrictPanel.style.display = "none";
			return;
		}
		if (toolbarPanel) {
			toolbarPanel.style.display = State.toolbarOpen ? "flex" : "none";
			if (State.toolbarOpen) positionPanelNearBalloon(toolbarPanel);
		}
		if (restrictPanel) {
			if (State.restrictOpen) {
				renderRestrictPanel();
				restrictPanel.style.display = "flex";
				positionPanelNearBalloon(restrictPanel);
			} else {
				restrictPanel.style.display = "none";
			}
		}
	}

	// ============================================================
	// 綁定 pointer 事件到 overlay
	//
	// 重點：pointer-events 只決定「瀏覽器認定誰是點擊目標」，
	// 如果 BC 自己在 document/window 層級也掛了監聽器（多數用全域座標做
	// 自己的 hit-test，不依賴 DOM target），事件冒泡上去 BC 一樣收得到。
	// 所以畫圖模式下，這裡的每個事件都要主動 stopPropagation + preventDefault，
	// 確保事件在 overlay 這層就被吃掉，不會繼續往上傳給 BC 的原生點擊處理。
	// ============================================================
	function bindPointerEvents() {
		let drawing = false;

		function block(e) {
			e.preventDefault();
			e.stopPropagation();
			if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
		}

		overlay.addEventListener("pointerdown", (e) => {
			if (!State.drawEnabled || !State.inChatRoom) return;
			block(e);
			drawing = true;
			overlay.setPointerCapture(e.pointerId); // 之後的 move/up 一律鎖定在 overlay 上，滑鼠移出範圍也不會漏給下層
			const [x, y] = toLogicalCoord(e.clientX, e.clientY);
			startLocalStroke(x, y);
		});
		overlay.addEventListener("pointermove", (e) => {
			if (!State.drawEnabled || !State.inChatRoom) return;
			block(e);
			if (!drawing) return;
			const [x, y] = toLogicalCoord(e.clientX, e.clientY);
			extendLocalStroke(x, y);
		});
		overlay.addEventListener("pointerup", (e) => {
			if (!State.drawEnabled || !State.inChatRoom) return;
			block(e);
			if (drawing) endLocalStroke();
			drawing = false;
			if (overlay.hasPointerCapture?.(e.pointerId)) overlay.releasePointerCapture(e.pointerId);
		});
		// 保底：萬一 pointerup 因為某些瀏覽器/裝置差異沒觸發到，避免筆劃卡在「畫到一半」的狀態
		overlay.addEventListener("pointercancel", (e) => {
			if (!State.drawEnabled || !State.inChatRoom) return;
			block(e);
			if (drawing) endLocalStroke();
			drawing = false;
		});
		// 畫圖模式下順手擋掉 contextmenu（長按/右鍵選單）跟 dragstart（拖曳選取），
		// 這兩個常是造成「明明在畫圖卻跳出選單/選取狀態」的來源
		overlay.addEventListener("contextmenu", (e) => {
			if (State.drawEnabled && State.inChatRoom) block(e);
		});
		overlay.addEventListener("dragstart", (e) => {
			if (State.drawEnabled && State.inChatRoom) block(e);
		});
	}

	// ============================================================
	// CurrentScreen 輪詢：只在 ChatRoom 時顯示繪製效果與按鈕（需求 4），
	// 離開聊天室時清除畫布與暫存狀態（需求 5）
	// ============================================================
	function pollScreen() {
		const nowIn = window.CurrentScreen === "ChatRoom";
		if (nowIn && !State.inChatRoom) {
			onEnterChatRoom();
		} else if (!nowIn && State.inChatRoom) {
			onLeaveChatRoom();
		}
	}

	function onEnterChatRoom() {
		State.inChatRoom = true;
		if (balloon) balloon.style.display = "flex";
		if (overlay) overlay.style.display = "block";
		if (previewCanvas) previewCanvas.style.display = "block";
		updateOverlayInteractivity();
		applyPanelVisibility();
		sendHidden({ action: "presence", state: "hello" }); // 讓房間內其他有裝插件的人知道我在，互相探索名單（需求 3）
	}

	function onLeaveChatRoom() {
		State.inChatRoom = false;
		setDrawMode(false);
		clearOverlay(false); // 只清本地畫面，不用廣播（需求 5）
		if (pctx) pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
		clearTimeout(State.brushPreviewTimer);
		State.remoteStrokes.clear();
		State.pendingPoints = [];
		State.currentStroke = null;
		State.pluginUsers.clear();
		State.toolbarOpen = false;
		State.restrictOpen = false;

		updateOverlayInteractivity();
		if (balloon) balloon.style.display = "none";
		if (overlay) overlay.style.display = "none";
		if (previewCanvas) previewCanvas.style.display = "none";
		applyPanelVisibility();
	}

	// ============================================================
	// 初始化流程
	// ============================================================
	async function waitFor(check, timeout = 30000, interval = 100) {
		const start = Date.now();
		while (!check()) {
			if (Date.now() - start > timeout) throw new Error("waitFor timeout");
			await new Promise((r) => setTimeout(r, interval));
		}
		return true;
	}

	async function initialize() {
		await waitFor(() => !!window.bcModSdk);
		const modApi = window.bcModSdk.registerMod({
			name: MOD_NAME,
			fullName: "BC Draw Game",
			version: MOD_VER,
			repository: "",
		});

		await waitFor(() => !!window.Player?.AccountName);

		createOverlay();
		createBalloon();
		createToolbar();
		createRestrictPanel();
		bindPointerEvents();

		// 接收其他人傳來的畫面更新
		modApi.hookFunction("ChatRoomMessage", 1, (args, next) => {
			const data = args[0];
			if (data && data.Content === CONTENT_TAG) {
				handleIncoming(data);
				return; // 這是純內部資料訊息，不用再往下傳給原生聊天邏輯
			}
			return next(args);
		});

		setInterval(pollScreen, SCREEN_POLL_INTERVAL);
		pollScreen(); // 立即檢查一次目前畫面，不用等第一次輪詢間隔

		console.log("[DrawGame] loaded");
	}

	initialize().catch((e) => console.error("[DrawGame] init error", e));
})();
