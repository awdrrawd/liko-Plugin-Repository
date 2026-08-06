"use strict";
/**
 * ChatScrollFreeze（+ 內建搜尋） —— PCM / LCE 共用系統擴充
 * -----------------------------------------------------------------------
 * 解決多個 mod 同時操作聊天室捲動、互搶畫面的問題：使用者往上捲看歷史時進入
 * 「凍結」——新訊息先進記憶體佇列、不插入 DOM（scrollHeight 不變，別人呼叫
 * ElementScrollToEnd() 也推不走畫面）；同時提供搜尋框，搜尋目前畫面上的訊息。
 *
 * 攔截 ChatRoomAppendChat 優先走 bcModSdk.hookFunction，而非直接覆寫
 * window.ChatRoomAppendChat：LCE 等插件也用 SDK 掛鉤，直接覆寫的話，SDK 只要
 * 重新計算鉤子（有插件新增/移除鉤子時）就會把 window.ChatRoomAppendChat 蓋回
 * 它的 router，靜默蓋掉我們的覆寫，凍結失效。沒有 bcModSdk 的環境才退回直接
 * 覆寫（monkey-patch），功能相同、只是少了跨插件疊合保證。
 *
 * 凍結期間刻意保留原生 DOM 節點，不用 cloneNode 做假疊層：BC 的訊息 div 在
 * ChatRoomMessage() 建立當下就直接 addEventListener 綁事件（非事件委派），
 * clone 不會帶走這些監聽器。沿用真實節點＋佇列緩衝完全沒這問題。
 *
 * 結束預覽（解除凍結）有兩種來源：手動捲到目前畫面的最底部；或自己發話
 * （hook ChatRoomSendChat）——送出當下就視為「已看完歷史」，避免自己的訊息
 * 卡進凍結佇列、本地沒 render 留下殘影。
 * -----------------------------------------------------------------------
 */
(function () {
	window.Liko = window.Liko ?? {};
	// 防重複載入：系統擴充統一掛 window.Liko.__Sys_* ，先搶先贏。
	if (window.Liko.__Sys_ChatScrollFreeze__) return;

	const MOD_VER = "1.2";
	const FREEZE_THRESHOLD = 0.05; // 往上捲超過畫面高度的 5% 就凍結

	/** 觸控裝置自動 focus 搜尋框會彈軟鍵盤，體驗差，故略過自動聚焦。 */
	const IS_TOUCH =
		typeof window !== "undefined" &&
		(("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0);
	const CHATLOG_ID = "TextAreaChatLog";
	const BADGE_ID = "chat-scroll-freeze-badge";
	const SEARCH_BAR_ID = "chat-scroll-freeze-search";
	const HIGHLIGHT_CLASS = "chat-scroll-freeze-highlight";
	const HIGHLIGHT_CURRENT_CLASS = "chat-scroll-freeze-highlight-current";

	// === i18n：走共用引擎 window.Liko.__Sys_i18n__，未就位時退回本地 EN 底本 ===
	const I18N_NS = "CSF";
	const STRINGS = {
		badge: {
			EN: "↓ {count} new message(s) — tap or scroll to bottom",
			TW: "↓ {count} 則新訊息，點擊或捲到底查看",
			CN: "↓ {count} 条新消息，点击或滚到底查看",
			DE: "↓ {count} neue Nachricht(en) – tippen oder nach unten scrollen",
			FR: "↓ {count} nouveau(x) message(s) — cliquez ou défilez en bas",
			RU: "↓ {count} новых сообщений — нажмите или прокрутите вниз",
			UA: "↓ {count} нових повідомлень — натисніть або прокрутіть донизу",
		},
		searchPlaceholder: {
			EN: "Search messages on screen…",
			TW: "搜尋目前畫面上的訊息…",
			CN: "搜索当前画面上的消息…",
			DE: "Nachrichten auf dem Bildschirm suchen…",
			FR: "Rechercher les messages à l'écran…",
			RU: "Поиск сообщений на экране…",
			UA: "Пошук повідомлень на екрані…",
		},
		prevTitle: {
			EN: "Previous (Shift+Enter)",
			TW: "上一個 (Shift+Enter)",
			CN: "上一个 (Shift+Enter)",
			DE: "Zurück (Umschalt+Enter)",
			FR: "Précédent (Maj+Entrée)",
			RU: "Назад (Shift+Enter)",
			UA: "Назад (Shift+Enter)",
		},
		nextTitle: {
			EN: "Next (Enter)",
			TW: "下一個 (Enter)",
			CN: "下一个 (Enter)",
			DE: "Weiter (Enter)",
			FR: "Suivant (Entrée)",
			RU: "Далее (Enter)",
			UA: "Далі (Enter)",
		},
		clearTitle: {
			EN: "Clear search text",
			TW: "清除搜尋文字",
			CN: "清除搜索文字",
			DE: "Suchtext löschen",
			FR: "Effacer le texte de recherche",
			RU: "Очистить текст поиска",
			UA: "Очистити текст пошуку",
		},
		closeTitle: {
			EN: "Back to latest & unfreeze",
			TW: "回到最新並解除凍結",
			CN: "回到最新并解除冻结",
			DE: "Zurück zum Neuesten & entsperren",
			FR: "Retour au plus récent et défiger",
			RU: "К последним и разморозить",
			UA: "До останніх і розморозити",
		},
	};

	let _i18nRegistered = false;
	function ensureI18nRegistered() {
		if (_i18nRegistered) return;
		const eng = window.Liko?.__Sys_i18n__;
		if (eng && typeof eng.register === "function") {
			eng.register(I18N_NS, STRINGS);
			_i18nRegistered = true;
		}
	}
	/** 本地佔位符代入（引擎未就位時的保底，僅支援具名 {name}）。 */
	function fillVars(str, vars) {
		if (!vars) return str;
		return String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
	}
	/** 取字：引擎在就用引擎（含語言 fallback 鏈），否則退回本地 EN 底本。 */
	function t(key, vars) {
		ensureI18nRegistered();
		const eng = window.Liko?.__Sys_i18n__;
		if (eng && typeof eng.t === "function" && eng.has?.(I18N_NS, key)) {
			return eng.t(I18N_NS, key, vars);
		}
		return fillVars(STRINGS[key]?.EN ?? key, vars);
	}

	/** 是否處於「預覽舊訊息」的凍結狀態 */
	let frozen = false;
	/** 凍結期間被攔截、尚未真正插入 DOM 的訊息節點 */
	let messageQueue = [];
	/** 目前 hook 住的 chat log 節點，用來偵測節點被整個換掉的情況 */
	let boundChatLog = null;

	/** 目前搜尋到的 <mark> 節點，依文件順序排列 */
	let searchMatches = [];
	let searchCurrentIndex = -1;
	let searchDebounceHandle = null;

	/** 程式化捲動（跳到搜尋結果）期間，暫停「捲到底＝解除凍結」的判斷 */
	let suppressExitUntil = 0;

	/**
	 * 手機軟鍵盤彈出/收合、視窗縮放/旋轉會讓 chatLog 可視高度突變，隨後噴出一串
	 * 非使用者主動的 scroll 事件；此期間（毫秒）暫停「進入凍結」判斷，避免誤觸凍結
	 * → 搜尋框搶焦點彈鍵盤 → 收鍵盤又解凍的反覆抖動。
	 */
	let suppressFreezeUntil = 0;
	/** 上一次 onScroll 時的 chatLog 可視高度，用來偵測上述的高度突變 */
	let lastClientHeight = 0;

	// === append 攔截狀態 =================================================
	let sdkApi = null;
	let removeHook = null;
	let removeSendHook = null;
	let monkeyOriginal = null;
	let monkeySendOriginal = null;
	let intercepted = false;

	function getChatLog() {
		return /** @type {HTMLElement | null} */ (document.getElementById(CHATLOG_ID));
	}

	/**
	 * 需要時才補一個 `position: relative` 定位錨點，且僅在 computed position
	 * 確實是 static 時才補。el.style.position 只讀得到行內樣式，讀不到樣式表給的
	 * position（chat-room-div 可能就是靠樣式表的 absolute + top/left/right/bottom
	 * 撐滿版面）；用 `||=` 判斷幾乎必為 falsy，會強制寫入行內 relative 蓋掉原本的
	 * absolute/fixed，使版面跑掉。改用 getComputedStyle 才不會誤蓋。
	 */
	function ensureRelativeAnchor(el) {
		if (!el) return;
		if (getComputedStyle(el).position === "static") {
			el.style.position = "relative";
		}
	}

	/** 距離底部還有多少像素（正值代表還沒到底）。與 isAtBottom / 比例計算共用。 */
	function scrollGapPx(el) {
		return el.scrollHeight - el.scrollTop - el.clientHeight;
	}

	/** 距離底部的比例：0 = 在最底部，越大代表越往上捲。 */
	function distanceFromBottomRatio(el) {
		if (!el || el.scrollHeight <= el.clientHeight) return 0;
		return scrollGapPx(el) / el.scrollHeight;
	}

	function isAtBottom(el) {
		if (typeof ElementIsScrolledToEnd === "function") {
			return ElementIsScrolledToEnd(el);
		}
		return scrollGapPx(el) <= 1;
	}

	/** 凍結期間攔截：放進佇列、更新提示條，不插入 DOM。 */
	function captureWhileFrozen(div) {
		messageQueue.push(div);
		showBadge(messageQueue.length);
	}

	/**
	 * 攔截 ChatRoomAppendChat：優先用 bcModSdk（與其他 SDK 插件相容、不受載入
	 * 順序影響），沒有 SDK 才退回直接覆寫。函式尚未定義時回傳 false，交給外層
	 * 輪詢稍後再試。
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
				// priority 0：讓其他插件先跑完訊息處理，我們只在最外層決定插不插。
				removeHook = sdkApi.hookFunction("ChatRoomAppendChat", 0, (args, next) => {
					if (frozen) { captureWhileFrozen(args[0]); return; }
					return next(args);
				});
				// 自己發話＝已看完歷史 → 送出當下解除凍結，避免自己的訊息卡進佇列。
				if (typeof window.ChatRoomSendChat === "function") {
					removeSendHook = sdkApi.hookFunction("ChatRoomSendChat", 0, (args, next) => {
						exitFreezeToLatest();
						return next(args);
					});
				}
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
		if (typeof window.ChatRoomSendChat === "function") {
			monkeySendOriginal = window.ChatRoomSendChat;
			window.ChatRoomSendChat = function () {
				exitFreezeToLatest();
				return monkeySendOriginal.apply(this, arguments);
			};
		}
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
			#${SEARCH_BAR_ID} .cs-input-wrap {
				position: relative;
				flex: 1;
				display: flex;
				align-items: center;
			}
			#${SEARCH_BAR_ID} input[type="text"] {
				flex: 1;
				width: 100%;
				padding: 3px 26px 3px 6px; /* 右側留白給行內的清除 X */
				border-radius: 4px;
				border: 1px solid rgba(255,255,255,0.3);
				background: rgba(255,255,255,0.9);
				color: #000;
			}
			/* 行內清除鍵：貼在輸入框最右側的紅色 X，只清空搜尋文字 */
			#${SEARCH_BAR_ID} .cs-clear {
				position: absolute;
				right: 4px;
				top: 50%;
				transform: translateY(-50%);
				padding: 0 4px;
				background: transparent;
				color: #ff5a5a;
				font-size: 15px;
				line-height: 1;
			}
			#${SEARCH_BAR_ID} .cs-clear:hover {
				background: transparent;
				color: #ff2020;
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
			ensureRelativeAnchor(chatLog.parentElement);
			chatLog.parentElement.appendChild(badge);
		}
		badge.textContent = t("badge", { count });
	}

	function hideBadge() {
		document.getElementById(BADGE_ID)?.remove();
	}

	// ---------------------------------------------------------------------
	// 搜尋功能：只在凍結（預覽）期間顯示，操作對象是目前畫面上真實存在的訊息
	// DOM，不影響其事件綁定。
	// ---------------------------------------------------------------------

	function clearHighlights() {
		const chatLog = getChatLog();
		if (!chatLog) return;
		const marks = chatLog.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
		marks.forEach((mark) => {
			const parent = mark.parentNode;
			if (!parent) return;
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

		// 程式觸發的捲動，不代表使用者要離開預覽，暫時抑制解除凍結判斷
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

	/** 讓搜尋框貼在 chatLog 正上方（用其相對 offsetParent 的偏移量），不管上方
	 *  選單/struggle bar 目前高度多少都不會被蓋住。 */
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
			<div class="cs-input-wrap">
				<input type="text" placeholder="${t("searchPlaceholder")}" autocomplete="off" />
				<button type="button" class="cs-clear" data-action="clear" title="${t("clearTitle")}">✕</button>
			</div>
			<span class="cs-count">0 / 0</span>
			<button type="button" data-action="prev" title="${t("prevTitle")}">↑</button>
			<button type="button" data-action="next" title="${t("nextTitle")}">↓</button>
			<button type="button" data-action="close" title="${t("closeTitle")}">✕</button>
		`;

		ensureRelativeAnchor(chatLog.parentElement);
		chatLog.parentElement.appendChild(bar);
		repositionSearchBar();

		// 幫聊天室本體讓出空間，避免搜尋框蓋住捲到頂端時的第一則訊息
		chatLog.style.scrollPaddingTop = `${bar.offsetHeight}px`;

		// 上方選單高度可能隨視窗變化，開著搜尋框時持續重新定位
		window.addEventListener("resize", repositionSearchBar);

		const input = bar.querySelector("input");
		bar.querySelector('[data-action="next"]').addEventListener("click", () => gotoMatch(searchCurrentIndex + 1));
		bar.querySelector('[data-action="prev"]').addEventListener("click", () => gotoMatch(searchCurrentIndex - 1));
		// 行內紅 X：只清空輸入的搜尋文字，不關搜尋框、不解除凍結
		bar.querySelector('[data-action="clear"]').addEventListener("click", () => {
			input.value = "";
			performSearch("");
			input.focus();
		});
		// 右端 X（close）：回到最新並解除凍結，與「僅清文字」的行內 X 區隔
		bar.querySelector('[data-action="close"]').addEventListener("click", () => exitFreezeToLatest());

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
				closeSearchBar(); // Esc 整個關閉搜尋框，跟 X（僅清文字）區隔
			}
		});

		// 手機自動 focus 會彈軟鍵盤、體驗差；桌面才自動聚焦。
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

	/** 結束預覽：把佇列中的訊息依序真正插入（frozen 已為 false，走正常流程），並捲到底 */
	function flushQueue() {
		const chatLog = getChatLog();
		const queued = messageQueue;
		messageQueue = [];
		hideBadge();
		closeSearchBar();

		if (!chatLog) return;

		for (const div of queued) {
			if (typeof window.ChatRoomAppendChat === "function") window.ChatRoomAppendChat(div);
		}
		chatLog.scrollTop = chatLog.scrollHeight;
	}

	/**
	 * 主動結束預覽（解凍＋flush＋捲到底）。三種來源共用：使用者自己發話
	 * （ChatRoomSendChat hook）、按右端 close X、對外 API unfreeze()。
	 */
	function exitFreezeToLatest() {
		if (!frozen) return;
		frozen = false;
		flushQueue();
	}

	function onScroll() {
		const chatLog = getChatLog();
		if (!chatLog) return;

		// 偵測可視高度突變（軟鍵盤/縮放/旋轉），這類變化不代表使用者主動往上捲。
		const h = chatLog.clientHeight;
		const heightChanged = h !== lastClientHeight;
		lastClientHeight = h;

		if (!frozen) {
			// 高度剛變過、或仍在 viewport 抑制視窗內 → 不進凍結，維持貼底即可。
			// 設定相同 scrollTop 不會再觸發 scroll，不會迴圈。
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

	/** visualViewport resize 是偵測手機軟鍵盤彈出/收合最可靠的時機點（桌面則對應
	 *  視窗縮放）。觸發後開一段抑制視窗讓 onScroll 暫停判斷凍結；若目前非凍結
	 *  （代表原本在底部附近），版面穩定後重新貼底，避免最新訊息被鍵盤推出畫面。 */
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

	// 先試著攔一次（BC 核心已就位的話馬上成功），失敗則交給下方輪詢稍後再試。
	ensureIntercepted();

	// 聊天室 DOM 可能進房間後才建立，輪詢等待；同時因應離開/重進房造成節點被換掉、
	// 以及攔截尚未裝好的情況。
	const poll = setInterval(() => {
		if (!intercepted) ensureIntercepted();
		if (!_i18nRegistered) ensureI18nRegistered(); // 引擎可能比本檔晚就位
		if (getChatLog()) ensureBound();
	}, 1000);

	function teardown() {
		clearInterval(poll);
		try {
			if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewportResize);
			else window.removeEventListener("resize", onViewportResize);
		} catch (e) {}
		try { removeHook?.(); } catch (e) {}
		try { removeSendHook?.(); } catch (e) {}
		// fallback 模式：還原直接覆寫（僅在確定當前掛的就是我們的包裝時）
		if (monkeyOriginal && window.ChatRoomAppendChat !== monkeyOriginal) {
			try { window.ChatRoomAppendChat = monkeyOriginal; } catch (e) {}
		}
		if (monkeySendOriginal && window.ChatRoomSendChat !== monkeySendOriginal) {
			try { window.ChatRoomSendChat = monkeySendOriginal; } catch (e) {}
		}
	}
	window.addEventListener("beforeunload", teardown);

	// === 對外 API ==========================================================
	window.Liko.__Sys_ChatScrollFreeze__ = {
		v: MOD_VER,
		isFrozen: () => frozen,
		/** 立刻解除凍結、把佇列插入並捲到底（等同使用者手動捲到底） */
		unfreeze: () => exitFreezeToLatest(),
		/** 凍結中時打開搜尋框（沒凍結則忽略） */
		openSearch: () => { if (frozen) showSearchBar(); },
		/** 目前攔截路線：'sdk' | 'monkey' | 'pending' */
		mode: () => (sdkApi ? "sdk" : monkeyOriginal ? "monkey" : "pending"),
		teardown,
	};
})();