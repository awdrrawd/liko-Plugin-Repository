"use strict";
/**
 * ChatScrollFreeze（+ 內建搜尋）  —— PCM / LCE 共用系統擴充
 * -----------------------------------------------------------------------
 * 解決多個 mod / plugin 同時操作聊天室捲動導致「A 要捲、B 不捲」互搶的問題，
 * 並在「凍結預覽」期間提供一個搜尋框，可在目前畫面已載入的歷史紀錄中搜尋文字。
 *
 * ── 與其他插件的共存（尤其 LCE） ──────────────────────────────────────
 *   本檔攔截 ChatRoomAppendChat 的方式「優先走 bcModSdk.hookFunction」而不是直接
 *   覆寫 window.ChatRoomAppendChat。原因：
 *     - LCE 等插件也用 bcModSdk 掛聊天室相關鉤子（ChatRoomRun / ChatRoomSendChat…），
 *       而且 LCE 的 chat-augments 會在收訊息後呼叫 ElementScrollToEnd() 把畫面拉到底
 *       —— 正是本檔要擋下的「別人把畫面捲走」情境。
 *     - 若直接覆寫 window.ChatRoomAppendChat，一旦有任何插件透過 SDK 新增/移除鉤子，
 *       SDK 會 d()（重算）並把 window.ChatRoomAppendChat 重設回它的 router，靜默蓋掉
 *       我們的覆寫，凍結就失效了。走 SDK 才能與所有 SDK 插件依 priority 乾淨疊合，
 *       且完全不受載入順序影響（PCM 很快、LCE 較慢也沒差）。
 *   沒有 bcModSdk 的環境（極少數）自動退回直接覆寫，功能不變、只是少了共存保證。
 *
 * ── 核心做法（刻意不用 cloneNode 做假 DOM 疊層） ──────────────────────
 *   1. 監聽 #TextAreaChatLog 的 scroll 事件，計算「距離底部的比例」。
 *   2. 一旦往上捲超過 FREEZE_THRESHOLD（預設 5%），進入「凍結」狀態：
 *      - 攔截 ChatRoomAppendChat，凍結期間新訊息不會被插入真正的 DOM，
 *        而是先放進記憶體佇列（messageQueue）。
 *      - 畫面上看到的仍是「原生、仍在 DOM 裡」的舊訊息節點，所有原本綁定在
 *        訊息 div 上的事件（點擊回覆、focus 高亮、popup menu…）完全不受影響。
 *      - 沒有新內容被插入 → scrollHeight 不變 → 別的 mod 呼叫 ElementScrollToEnd()
 *        也不會把畫面推走。
 *      - 同時顯示搜尋框，可搜尋「目前已在畫面上」的歷史內容（索引全程穩定）。
 *   3. 使用者手動捲到「目前畫面的最底部」時，視為結束預覽：
 *      - 關閉搜尋框、清除高亮。
 *      - 把佇列裡的訊息依序、原樣重新 append（frozen 已為 false，走原本流程，
 *        因此 isPlayerMessage / 分隔線收合等既有邏輯完全沿用不必重寫）。
 *      - 最後捲到真正的最底部。
 *
 * 為什麼不做「複製一份 DOM 疊上去當假 chat-room-div」：
 *   BC 的訊息 div 在 ChatRoomMessage() 建立當下就直接 addEventListener 綁 click/blur，
 *   不是靠事件委派。cloneNode(true) 不會複製這些監聽器，快照會失去互動能力。
 *   凍結＋緩衝法直接沿用真實節點，完全沒這問題，搜尋高亮也可直接動真實文字節點。
 * -----------------------------------------------------------------------
 */
(function () {
	window.Liko = window.Liko ?? {};
	// 防重複載入旗標：檔尾把 API 掛到 window.Liko.__Sys_ChatScrollFreeze__
	//（系統擴充統一以 __Sys_ 開頭；先搶先贏，後到的直接 return 用現成的）。
	if (window.Liko.__Sys_ChatScrollFreeze__) return;

	const MOD_VER = "1.1";
	const FREEZE_THRESHOLD = 0.10; // 往上捲超過畫面高度的 10% 就凍結

	/** 觸控裝置（手機/平板）：自動 focus 搜尋框會把軟鍵盤彈過來，體驗差，故略過。 */
	const IS_TOUCH =
		typeof window !== "undefined" &&
		(("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0);
	const CHATLOG_ID = "TextAreaChatLog";
	const BADGE_ID = "chat-scroll-freeze-badge";
	const SEARCH_BAR_ID = "chat-scroll-freeze-search";
	const HIGHLIGHT_CLASS = "chat-scroll-freeze-highlight";
	const HIGHLIGHT_CURRENT_CLASS = "chat-scroll-freeze-highlight-current";

	/** @type {boolean} 目前是否處於「預覽舊訊息」的凍結狀態 */
	let frozen = false;

	/** @type {HTMLElement[]} 凍結期間被攔截、尚未真正插入 DOM 的訊息節點 */
	let messageQueue = [];

	/** @type {HTMLElement | null} 目前 hook 住的 chat log 節點（用來偵測節點被整個換掉的情況） */
	let boundChatLog = null;

	/** @type {HTMLElement[]} 目前搜尋到的 <mark> 節點，依文件順序排列 */
	let searchMatches = [];
	let searchCurrentIndex = -1;

	/** 進行中的搜尋輸入 debounce timer */
	let searchDebounceHandle = null;

	/** 程式化捲動（例如跳到某個搜尋結果）期間，暫停「捲到底=解除凍結」的判斷 */
	let suppressExitUntil = 0;

	/**
	 * 手機軟鍵盤彈出/收合、視窗縮放/旋轉會改變 chatLog 的可視高度，隨後噴出一連串
	 * 「非使用者主動」的 scroll 事件。這段時間（毫秒）內暫停「進入凍結」判斷，
	 * 避免軟鍵盤把畫面高度縮小 → scrollTop 相對看起來離底部很遠 → 誤判成往上捲、
	 * 誤觸凍結 → 搜尋框搶焦點把鍵盤彈過去 → 收鍵盤高度復原 → 解除凍結 的反覆抖動。
	 */
	let suppressFreezeUntil = 0;

	/** 上一次 onScroll 時的 chatLog 可視高度，用來偵測高度突變（軟鍵盤/縮放/旋轉）。 */
	let lastClientHeight = 0;

	// === append 攔截狀態 =================================================
	/** @type {object | null} bcModSdk 註冊回來的 api（走 SDK 路線時） */
	let sdkApi = null;
	/** @type {(() => void) | null} SDK hook 的解除函式 */
	let removeHook = null;
	/** @type {null | ((div: HTMLElement) => void)} fallback 直接覆寫時保存的原函式 */
	let monkeyOriginal = null;
	/** 攔截是否已裝好（SDK 或 fallback 其一） */
	let intercepted = false;

	function getChatLog() {
		return /** @type {HTMLElement | null} */ (document.getElementById(CHATLOG_ID));
	}

	/**
	 * 計算目前捲動位置「距離底部」的比例。0 = 在最底部，越大代表越往上捲。
	 * 與 Element.js 的 ElementGetScrollPercentage 是同一套公式的反向版本。
	 */
	function distanceFromBottomRatio(el) {
		if (!el || el.scrollHeight <= el.clientHeight) return 0;
		return 1 - (el.scrollTop + el.clientHeight) / el.scrollHeight;
	}

	function isAtBottom(el) {
		if (typeof ElementIsScrolledToEnd === "function") {
			return ElementIsScrolledToEnd(el);
		}
		return el.scrollHeight - el.scrollTop - el.clientHeight <= 1;
	}

	/** 凍結期間攔截：放進佇列、更新提示條，不插入 DOM。 */
	function captureWhileFrozen(div) {
		messageQueue.push(div);
		showBadge(messageQueue.length);
	}

	/**
	 * 裝好對 ChatRoomAppendChat 的攔截。
	 * 優先走 bcModSdk（與 LCE 等 SDK 插件乾淨共存、不受載入順序影響），
	 * 沒有 bcModSdk 才退回直接覆寫。ChatRoomAppendChat 尚未定義時回傳 false，
	 * 由外層輪詢稍後再試（PCM 載得很快、BC 核心可能還沒就位）。
	 */
	function ensureIntercepted() {
		if (intercepted) return true;
		if (typeof window.ChatRoomAppendChat !== "function") return false;

		// 路線 A：bcModSdk.hookFunction（推薦）
		if (typeof bcModSdk !== "undefined" && bcModSdk && typeof bcModSdk.registerMod === "function") {
			try {
				sdkApi = bcModSdk.registerMod({
					name: "Liko - ChatScrollFreeze",
					fullName: "Liko's Chat Scroll Freeze",
					version: MOD_VER,
					repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
				});
				// priority 0：讓別的插件（例如染色/嵌入）對訊息的處理都先跑完，我們只在最外層決定「插不插」。
				removeHook = sdkApi.hookFunction("ChatRoomAppendChat", 0, (args, next) => {
					if (frozen) { captureWhileFrozen(args[0]); return; }
					return next(args);
				});
				intercepted = true;
				console.log(`🐈‍⬛ [ChatScrollFreeze] ✅ v${MOD_VER} loaded (bcModSdk)`);
				return true;
			} catch (e) {
				console.warn("🐈‍⬛ [ChatScrollFreeze] ⚠️ bcModSdk 註冊失敗，改用直接覆寫:", e.message);
				sdkApi = null;
			}
		}

		// 路線 B：直接覆寫（fallback）
		monkeyOriginal = window.ChatRoomAppendChat;
		window.ChatRoomAppendChat = function (div) {
			if (frozen) { captureWhileFrozen(div); return; }
			return monkeyOriginal.call(this, div);
		};
		intercepted = true;
		console.log(`🐈‍⬛ [ChatScrollFreeze] ✅ v${MOD_VER} loaded (monkey-patch fallback)`);
		return true;
	}

	function injectStyleOnce() {
		if (document.getElementById("chat-scroll-freeze-style")) return;
		const style = document.createElement("style");
		style.id = "chat-scroll-freeze-style";
		style.textContent = `
			#${SEARCH_BAR_ID} {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				z-index: 60;
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 6px 8px;
				background: rgba(20, 20, 20, 0.92);
				border-bottom: 1px solid rgba(255,255,255,0.15);
				font-size: 14px;
			}
			#${SEARCH_BAR_ID} input[type="text"] {
				flex: 1;
				padding: 3px 6px;
				border-radius: 4px;
				border: 1px solid rgba(255,255,255,0.3);
				background: rgba(255,255,255,0.9);
				color: #000;
			}
			#${SEARCH_BAR_ID} .cs-count {
				color: #fff;
				min-width: 3.5em;
				text-align: center;
				font-variant-numeric: tabular-nums;
			}
			#${SEARCH_BAR_ID} button {
				cursor: pointer;
				border: none;
				border-radius: 4px;
				padding: 3px 8px;
				background: rgba(255,255,255,0.15);
				color: #fff;
			}
			#${SEARCH_BAR_ID} button:hover {
				background: rgba(255,255,255,0.3);
			}
			.${HIGHLIGHT_CLASS} {
				background: #ffe066;
				color: #000;
				border-radius: 2px;
			}
			.${HIGHLIGHT_CURRENT_CLASS} {
				background: #ff9f1c;
			}
		`;
		document.head.appendChild(style);
	}

	/** 顯示/更新「有 N 則新訊息，捲到底查看」的小提示條 */
	function showBadge(count) {
		const chatLog = getChatLog();
		if (!chatLog || !chatLog.parentElement) return;

		let badge = document.getElementById(BADGE_ID);
		if (!badge) {
			badge = document.createElement("div");
			badge.id = BADGE_ID;
			badge.style.cssText = [
				"position:absolute",
				"left:50%",
				"transform:translateX(-50%)",
				"bottom:8px",
				"z-index:50",
				"padding:4px 12px",
				"border-radius:999px",
				"background:rgba(0,0,0,0.75)",
				"color:#fff",
				"font-size:14px",
				"cursor:pointer",
				"user-select:none",
			].join(";");
			badge.addEventListener("click", () => {
				const el = getChatLog();
				if (el) el.scrollTop = el.scrollHeight;
			});
			chatLog.parentElement.style.position ||= "relative";
			chatLog.parentElement.appendChild(badge);
		}
		badge.textContent = `↓ ${count} 則新訊息，點擊或捲到底查看`;
	}

	function hideBadge() {
		document.getElementById(BADGE_ID)?.remove();
	}

	// ---------------------------------------------------------------------
	// 搜尋功能：只在凍結（預覽）期間顯示，操作對象是目前已在畫面上、
	// 真實存在的訊息 DOM，不影響其事件綁定。
	// ---------------------------------------------------------------------

	function clearHighlights() {
		const chatLog = getChatLog();
		if (!chatLog) return;
		const marks = chatLog.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
		marks.forEach((mark) => {
			const parent = mark.parentNode;
			if (!parent) return;
			// 把 <mark>文字</mark> 還原成純文字節點，恢復原本的 DOM 結構
			while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
			parent.removeChild(mark);
			parent.normalize();
		});
		searchMatches = [];
		searchCurrentIndex = -1;
	}

	function escapeRegExp(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	/** 在 chatLog 內用 TreeWalker 找出所有符合的文字節點並包上 <mark> */
	function highlightQuery(query) {
		const chatLog = getChatLog();
		if (!chatLog || !query) return [];

		const regex = new RegExp(escapeRegExp(query), "gi");
		const walker = document.createTreeWalker(chatLog, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				if (!node.nodeValue || !regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
				regex.lastIndex = 0;
				// 略過 <script>/<style> 等不該處理的節點（保險用，聊天室內基本不會有）
				const tag = node.parentElement?.tagName;
				if (tag === "SCRIPT" || tag === "STYLE") return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});

		/** @type {Text[]} */
		const targetNodes = [];
		let n;
		while ((n = walker.nextNode())) targetNodes.push(/** @type {Text} */ (n));

		const marks = [];
		for (const textNode of targetNodes) {
			const text = textNode.nodeValue;
			regex.lastIndex = 0;
			const frag = document.createDocumentFragment();
			let lastIndex = 0;
			let match;
			while ((match = regex.exec(text))) {
				if (match.index > lastIndex) {
					frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
				}
				const mark = document.createElement("mark");
				mark.className = HIGHLIGHT_CLASS;
				mark.textContent = match[0];
				frag.appendChild(mark);
				marks.push(mark);
				lastIndex = match.index + match[0].length;
				if (match[0].length === 0) regex.lastIndex++; // 避免空字串死迴圈
			}
			if (lastIndex < text.length) {
				frag.appendChild(document.createTextNode(text.slice(lastIndex)));
			}
			textNode.parentNode.replaceChild(frag, textNode);
		}
		return marks;
	}

	function updateSearchCountLabel() {
		const label = document.querySelector(`#${SEARCH_BAR_ID} .cs-count`);
		if (!label) return;
		if (searchMatches.length === 0) {
			label.textContent = "0 / 0";
		} else {
			label.textContent = `${searchCurrentIndex + 1} / ${searchMatches.length}`;
		}
	}

	function gotoMatch(index) {
		if (searchMatches.length === 0) return;
		const wrapped = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length;

		searchMatches[searchCurrentIndex]?.classList.remove(HIGHLIGHT_CURRENT_CLASS);
		searchCurrentIndex = wrapped;
		const target = searchMatches[searchCurrentIndex];
		target.classList.add(HIGHLIGHT_CURRENT_CLASS);

		// 這是程式觸發的捲動，不代表使用者要離開預覽狀態，暫時抑制解除凍結判斷
		suppressExitUntil = Date.now() + 700;
		target.scrollIntoView({ block: "center", behavior: "smooth" });

		updateSearchCountLabel();
	}

	function performSearch(query) {
		clearHighlights();
		if (!query) {
			updateSearchCountLabel();
			return;
		}
		searchMatches = highlightQuery(query);
		if (searchMatches.length > 0) {
			gotoMatch(0);
		} else {
			updateSearchCountLabel();
		}
	}

	/**
	 * 讓搜尋框緊貼在 TextAreaChatLog 的正上方（而不是 chat-room-div 的最頂端），
	 * 這樣不管 chat-room-top-menu／struggle bar 目前顯示多高，都不會被蓋住，
	 * 因為我們是拿 chatLog 相對於其 offsetParent（chat-room-div）的實際偏移量。
	 */
	function repositionSearchBar() {
		const bar = document.getElementById(SEARCH_BAR_ID);
		const chatLog = getChatLog();
		if (!bar || !chatLog) return;
		bar.style.top = `${chatLog.offsetTop}px`;
	}

	function showSearchBar() {
		const chatLog = getChatLog();
		if (!chatLog || !chatLog.parentElement) return;
		if (document.getElementById(SEARCH_BAR_ID)) return; // 已存在

		injectStyleOnce();

		const bar = document.createElement("div");
		bar.id = SEARCH_BAR_ID;
		bar.innerHTML = `
			<input type="text" placeholder="搜尋目前畫面上的訊息…" autocomplete="off" />
			<span class="cs-count">0 / 0</span>
			<button type="button" data-action="prev" title="上一個 (Shift+Enter)">↑</button>
			<button type="button" data-action="next" title="下一個 (Enter)">↓</button>
			<button type="button" data-action="clear" title="清除搜尋文字">✕</button>
		`;

		chatLog.parentElement.style.position ||= "relative";
		chatLog.parentElement.appendChild(bar);
		repositionSearchBar();

		// 幫聊天室本體讓出空間，避免搜尋框蓋住捲到頂端時的第一則訊息
		chatLog.style.scrollPaddingTop = `${bar.offsetHeight}px`;

		// chat-room-top-menu／struggle bar 的高度可能因視窗大小或內容而變動，
		// 開著搜尋框時持續跟著重新定位
		window.addEventListener("resize", repositionSearchBar);

		const input = bar.querySelector("input");
		bar.querySelector('[data-action="next"]').addEventListener("click", () => gotoMatch(searchCurrentIndex + 1));
		bar.querySelector('[data-action="prev"]').addEventListener("click", () => gotoMatch(searchCurrentIndex - 1));
		// X 只負責清空目前輸入的搜尋文字，不會把整個搜尋框關掉
		bar.querySelector('[data-action="clear"]').addEventListener("click", () => {
			input.value = "";
			performSearch("");
			input.focus();
		});

		input.addEventListener("input", () => {
			clearTimeout(searchDebounceHandle);
			const value = input.value.trim();
			searchDebounceHandle = setTimeout(() => performSearch(value), 150);
		});
		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				gotoMatch(searchCurrentIndex + (ev.shiftKey ? -1 : 1));
			} else if (ev.key === "Escape") {
				ev.preventDefault();
				// Esc 保留「整個關閉搜尋框」的行為，跟 X（僅清除文字）做出區隔
				closeSearchBar();
			}
		});

		// 觸控裝置上自動 focus 會把軟鍵盤彈到搜尋框——使用者往上看歷史往往只是想閱讀，
		// 並非要搜尋，硬搶焦點體驗很差（也是造成手機端輸入/取消抖動的元兇之一）。
		// 桌面才自動聚焦，手機留給使用者主動點搜尋框。
		if (!IS_TOUCH) input.focus();
	}

	function closeSearchBar() {
		clearHighlights();
		window.removeEventListener("resize", repositionSearchBar);
		document.getElementById(SEARCH_BAR_ID)?.remove();
		const chatLog = getChatLog();
		if (chatLog) chatLog.style.scrollPaddingTop = "";
	}

	// ---------------------------------------------------------------------
	// 凍結／解除凍結主流程
	// ---------------------------------------------------------------------

	/** 結束預覽：把佇列中的訊息依序真正插入，並捲到底 */
	function flushQueue() {
		const chatLog = getChatLog();
		const queued = messageQueue;
		messageQueue = [];
		hideBadge();
		closeSearchBar();

		if (!chatLog) return;

		// 此時 frozen 已為 false，重新 append 會走正常流程（不再被攔截），
		// isPlayerMessage / 分隔線收合等既有邏輯完全沿用。
		for (const div of queued) {
			if (typeof window.ChatRoomAppendChat === "function") window.ChatRoomAppendChat(div);
		}
		chatLog.scrollTop = chatLog.scrollHeight;
	}

	function onScroll() {
		const chatLog = getChatLog();
		if (!chatLog) return;

		// 偵測可視高度突變（手機軟鍵盤彈出/收合、視窗縮放、旋轉）。這類變化會讓
		// scrollTop 相對 scrollHeight 看起來「離底部很遠」，但並非使用者主動往上捲。
		const h = chatLog.clientHeight;
		const heightChanged = h !== lastClientHeight;
		lastClientHeight = h;

		if (!frozen) {
			// 高度剛變過、或正處在 viewport 變動的抑制視窗內 → 不進入凍結。
			// 「未凍結」本身就代表原本在底部附近，維持貼底即可，避免軟鍵盤把最新訊息
			// 推出畫面後被誤判成往上捲。設定相同 scrollTop 不會再觸發 scroll，不會有迴圈。
			if (heightChanged || Date.now() < suppressFreezeUntil) {
				chatLog.scrollTop = chatLog.scrollHeight;
				return;
			}
			if (distanceFromBottomRatio(chatLog) > FREEZE_THRESHOLD) {
				frozen = true;
				showSearchBar();
			}
		} else {
			if (Date.now() < suppressExitUntil) return; // 忽略搜尋跳轉造成的捲動
			if (isAtBottom(chatLog)) {
				frozen = false;
				flushQueue();
			}
		}
	}

	/** 綁定 scroll 監聽；若聊天室節點被整個重建過，重新綁一次 */
	function ensureBound() {
		const chatLog = getChatLog();
		if (!chatLog) return;

		if (chatLog !== boundChatLog) {
			if (boundChatLog) boundChatLog.removeEventListener("scroll", onScroll);
			chatLog.addEventListener("scroll", onScroll, { passive: true });
			boundChatLog = chatLog;
		}

		ensureIntercepted();
	}

	/**
	 * 手機軟鍵盤彈出/收合最可靠的偵測點是 visualViewport 的 resize（桌面則對應視窗縮放）。
	 * 觸發後開一個短暫抑制視窗，期間 onScroll 不會進入凍結；同時若目前非凍結（＝原本在
	 * 底部附近），等版面穩定後重新貼底，把最新訊息留在畫面上。這是根治手機端反覆
	 * 「輸入→誤凍結→彈搜尋框→解凍」抖動的關鍵。
	 */
	function onViewportResize() {
		suppressFreezeUntil = Date.now() + 600;
		if (frozen) return; // 使用者正在看歷史，別動它的捲動位置
		requestAnimationFrame(() => {
			const el = getChatLog();
			if (el && !frozen) el.scrollTop = el.scrollHeight;
		});
	}
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", onViewportResize);
	} else {
		window.addEventListener("resize", onViewportResize);
	}

	// ChatRoomAppendChat 是全域函式，登入前就先試著攔一次（BC 核心已就位的話馬上成功；
	// PCM 載得很快、核心還沒就位時這裡回 false，交給下方輪詢稍後再試）。
	ensureIntercepted();

	// 聊天室 DOM 可能是進房間後才建立，所以先輪詢等待，之後再靠一個輕量的定時檢查
	// 因應「離開/重新進房」導致節點被整個換掉、以及攔截尚未裝好的情況。
	const poll = setInterval(() => {
		if (!intercepted) ensureIntercepted();
		if (getChatLog()) ensureBound();
	}, 1000);

	function teardown() {
		clearInterval(poll);
		try {
			if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportResize);
			else window.removeEventListener("resize", onViewportResize);
		} catch (e) {}
		try { removeHook?.(); } catch (e) {}
		// fallback 模式：把直接覆寫還原回去（僅在確定當前掛的就是我們的包裝時）
		if (monkeyOriginal && window.ChatRoomAppendChat !== monkeyOriginal) {
			try { window.ChatRoomAppendChat = monkeyOriginal; } catch (e) {}
		}
	}
	window.addEventListener("beforeunload", teardown);

	// === 對外 API（掛在 window.Liko.__Sys_ChatScrollFreeze__） ===========
	window.Liko.__Sys_ChatScrollFreeze__ = {
		v: MOD_VER,
		/** 目前是否處於凍結預覽 */
		isFrozen: () => frozen,
		/** 立刻解除凍結、把佇列插入並捲到底（等同使用者手動捲到底） */
		unfreeze: () => { if (frozen) { frozen = false; flushQueue(); } },
		/** 凍結中時打開搜尋框（沒凍結則忽略） */
		openSearch: () => { if (frozen) showSearchBar(); },
		/** 目前攔截路線：'sdk' | 'monkey' | 'pending' */
		mode: () => (sdkApi ? "sdk" : monkeyOriginal ? "monkey" : "pending"),
		teardown,
	};
})();
