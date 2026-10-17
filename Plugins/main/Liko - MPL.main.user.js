// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.5.6
// @description    Supports vertical layout for ChatSearch and ChatRoom
// @description:zh 支援房間搜尋與聊天室的直版佈局
// @author         Likolisu
// @include        /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant          none
// @require        https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MPL.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20MPL.main.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════════════════
    // 防止重複載入
    // ════════════════════════════════════════════════════════════════════════════
    window.Liko     = window.Liko     ?? {};
    window.Liko.MPL = window.Liko.MPL ?? {};
    if (window.Liko.MPL.version) return;

    const MOD_VER = '0.5.6';
    window.Liko.MPL.version = MOD_VER;

    const modApi = bcModSdk.registerMod({
        name:       'Liko - MPL',
        fullName:   'Mobile Portrait Layout',
        version:    MOD_VER,
        repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 常數
    // ════════════════════════════════════════════════════════════════════════════
    const CARD_MIN_H = 82;    // ChatSearch 房間卡片最小高度（px）
    const CARD_GAP   = 5;     // 卡片間距（px）
    const BASE_URL   = window.location.href.includes('/')
        ? window.location.href.slice(0, window.location.href.lastIndexOf('/') + 1)
        : window.location.href + '/';
    const LOG        = '🐈‍⬛ [MPL]';

    // ChatRoom 直版比例（與 LCE 一致）：人物區佔 50%、頂部選單佔 4%，其餘給聊天紀錄與輸入列
    const CR_CANVAS_RATIO = 0.50;
    const CR_MENU_RATIO   = 0.04;

    /**
     * 統一管理會與「主 canvas」共享同一個 stacking context 的 z-index。
     * canvas 故意設為 0：實測 .dialog-root 的 z-index 會被 BC 重建時沖掉，
     * 所以讓 canvas 待在最底，靠「DOM 後面的畫在上面」讓彈出視窗穩定蓋住它。
     *   LOGIN   登入頁覆蓋層（須低於 FUSAM）
     *   FUSAM   FUSAM / PCM 外掛管理器，需蓋過所有 MPL 層
     */
    const Z = {
        CANVAS:      0,
        DR_MIRROR:   1,
        CHAT_DIV:    2,
        DR_OVERLAY:  2,
        TOP_MENU:    3,
        DIALOG_ROOT: 4,
        LOGIN:       100,
        FUSAM:       1000,
    };

    // ════════════════════════════════════════════════════════════════════════════
    // 與 LCE 共存
    // LCE 已內建同一套直式版面（移植自 MPL）。兩者同時啟用時只能有一邊接管，
    // 否則會互相搶 canvas 樣式與 DOM。規則：LCE 該項設定開啟 → MPL 讓位。
    // ════════════════════════════════════════════════════════════════════════════
    function lceOwns(featureKey) {
        try { return !!window.Liko?.LCE?.getFeature?.(featureKey); }
        catch { return false; }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // i18n
    // ════════════════════════════════════════════════════════════════════════════
    function MPLT(key, vars) {
        const fn = window.Liko?.MPL?.i18n?.t;
        return fn ? fn(key, vars) : key;
    }

    function i18nText(el, key, vars) {
        el.textContent = MPLT(key, vars);
        el.dataset.i18nKey = key;
        if (vars) el.dataset.i18nVars = JSON.stringify(vars);
    }

    function i18nAttr(el, attr, key) {
        el.setAttribute(attr, MPLT(key));
        el.dataset.i18nAttr    = attr;
        el.dataset.i18nAttrKey = key;
    }

    function refreshAllI18n() {
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key  = el.dataset.i18nKey;
            const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : undefined;
            el.textContent = MPLT(key, vars);
        });
        document.querySelectorAll('[data-i18n-attr-key]').forEach(el => {
            el.setAttribute(el.dataset.i18nAttr, MPLT(el.dataset.i18nAttrKey));
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 工具函式
    // ════════════════════════════════════════════════════════════════════════════

    function isPortrait() { return window.innerWidth < window.innerHeight; }

    function getCanvas() {
        return document.getElementById('MainCanvas') || document.querySelector('canvas');
    }

    /**
     * 取得排除軟體鍵盤後的視窗高度。
     * 手機鍵盤彈出時 innerHeight 不會變，但 visualViewport.height 會縮小。
     */
    function getLockedVH() {
        const h = window.visualViewport?.height;
        return Number.isFinite(h) && h > 0 ? h : window.innerHeight;
    }

    function injectStyle(id, css) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = css;
    }

    function removeStyle(id) { document.getElementById(id)?.remove(); }

    /**
     * 資源範圍：只管理本範圍裡註冊的監聽、計時器與 rAF，dispose 時一次清掉。
     * 讓每個直版模組都能隨時 remove 還原而不殘留。
     */
    function createScope() {
        const cleanups = new Set();
        let disposed = false;
        const add = fn => { if (typeof fn !== 'function') return; if (disposed) fn(); else cleanups.add(fn); };
        return {
            listen(target, type, listener, options) {
                if (!target || disposed) return;
                target.addEventListener(type, listener, options);
                add(() => target.removeEventListener(type, listener, options));
            },
            timeout(cb, delay) {
                if (disposed) return;
                const cleanup = () => clearTimeout(id);
                const id = setTimeout(() => { cleanups.delete(cleanup); if (!disposed) cb(); }, delay);
                add(cleanup);
            },
            frame(cb) {
                if (disposed) return;
                const cleanup = () => cancelAnimationFrame(id);
                const id = requestAnimationFrame(() => { cleanups.delete(cleanup); if (!disposed) cb(); });
                add(cleanup);
            },
            dispose() {
                if (disposed) return;
                disposed = true;
                for (const fn of [...cleanups].reverse()) { try { fn(); } catch (e) { console.warn(LOG, 'cleanup:', e); } }
                cleanups.clear();
            },
        };
    }

    /** 註冊 BC 函式鉤子；BC 改版導致函式不存在時只警告，不中止其他功能。 */
    function hook(name, priority, fn) {
        try { return modApi.hookFunction(name, priority, fn); }
        catch (e) { console.warn(LOG, 'hook 未掛上:', name, e?.message ?? e); return () => {}; }
    }

    /** 只等待這個元素的 transform 過場結束；CSS 沒發出事件時用 timeout 保底。 */
    function finishTransform(element, complete, timeout = 500) {
        let pending = true;
        const cancel = () => {
            if (!pending) return;
            pending = false;
            clearTimeout(timer);
            element.removeEventListener('transitionend', onEnd);
            element.removeEventListener('transitioncancel', onEnd);
        };
        const finish = () => { if (!pending) return; cancel(); complete(); };
        const onEnd = ev => { if (ev.target === element && ev.propertyName === 'transform') finish(); };
        const timer = setTimeout(finish, timeout);
        element.addEventListener('transitionend', onEnd);
        element.addEventListener('transitioncancel', onEnd);
        return cancel;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // i18n 動態載入
    // ════════════════════════════════════════════════════════════════════════════
    const _I18N_BASE = (typeof window !== 'undefined' && window.LikoDevBase) || 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/';
    const LIKO_I18N_ENGINE_URL = _I18N_BASE + 'expand/BC_i18n.js';
    const LIKO_MPL_STRINGS_URL = _I18N_BASE + 'Translation/MPL-i18n.js';

    function loadScript(url) {
        return fetch(url)
            .then(res => {
                if (!res.ok) throw new Error(`[MPL] 無法載入 ${url} (${res.status})`);
                return res.text();
            })
            .then(code => { new Function(code)(); });
    }

    async function ensureI18n() {
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function' || !window.Liko?.__Sys_Flags__) await loadScript(LIKO_I18N_ENGINE_URL);
        if (typeof window.Liko?.__Sys_i18n__?.ensure === 'function') await window.Liko.__Sys_i18n__.ensure('MPL', LIKO_MPL_STRINGS_URL);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Canvas 強制樣式
    //
    // BC 的畫面是 2000×1000 的 canvas，橫向時左半是角色、右半是選單／對話。
    // 直向時把 canvas 撐成兩倍寬並固定在上半螢幕，只露出左半；
    // 下半螢幕再用 HTML 或 mirror canvas 補上右半內容。
    // ════════════════════════════════════════════════════════════════════════════

    let _lastForcedCanvas = null;

    /**
     * @param {number}  cvH               - 上半區可用高度（px）
     * @param {boolean} preserveLeftSquare - true：以 contain 方式保留 1000×1000 的正方形人物區，
     *                                       不拉長、不壓扁、不裁人物（聊天室與 Dialog 使用）
     */
    function forceCanvasStyle(cvH, preserveLeftSquare = false) {
        const cv = getCanvas();
        if (!cv) return;
        const vw = window.innerWidth;

        if (_lastForcedCanvas
            && _lastForcedCanvas.cv === cv
            && _lastForcedCanvas.vw === vw
            && _lastForcedCanvas.cvH === cvH
            && _lastForcedCanvas.preserveLeftSquare === preserveLeftSquare) return;

        const scale  = preserveLeftSquare ? Math.min(vw, cvH) / 1000 : null;
        const width  = preserveLeftSquare ? 2000 * scale : vw * 2;
        const height = preserveLeftSquare ? 1000 * scale : cvH;
        const left   = preserveLeftSquare ? (vw - 1000 * scale) / 2 : 0;
        const top    = preserveLeftSquare ? (cvH - 1000 * scale) / 2 : 0;

        _lastForcedCanvas = { cv, vw, cvH, preserveLeftSquare };
        cv.style.setProperty('position',  'fixed',        'important');
        cv.style.setProperty('top',       top + 'px',     'important');
        cv.style.setProperty('left',      left + 'px',    'important');
        cv.style.setProperty('transform', 'none',         'important');
        cv.style.setProperty('width',     width + 'px',   'important');
        cv.style.setProperty('height',    height + 'px',  'important');
        cv.style.setProperty('clip-path', preserveLeftSquare ? 'inset(0 50% 0 0)' : 'none', 'important');
        cv.style.setProperty('z-index',   String(Z.CANVAS), 'important');
        cv.style.setProperty('margin',    '0',            'important');
    }

    function clearCanvasStyle() {
        const cv = getCanvas();
        _lastForcedCanvas = null;
        if (!cv) return;
        ['position', 'top', 'left', 'transform', 'width', 'height', 'clip-path', 'z-index', 'margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 玩家關係工具（主人 / 戀人 / 好友）
    // ════════════════════════════════════════════════════════════════════════════

    function collectMemberNumbers(value, seen = new Set()) {
        const out = new Set();
        const walk = (v) => {
            if (v == null) return;
            if (typeof v === 'number' && Number.isFinite(v)) { out.add(Number(v)); return; }
            if (typeof v === 'string' && /^\d+$/.test(v))    { out.add(Number(v)); return; }
            if (typeof v !== 'object') return;
            if (seen.has(v)) return;
            seen.add(v);
            if (v instanceof Map) { for (const [k, val] of v.entries()) { walk(k); walk(val); } return; }
            if (v instanceof Set) { v.forEach(walk); return; }
            if (Array.isArray(v)) { v.forEach(walk); return; }
            for (const [k, val] of Object.entries(v)) {
                if (/membernumber|membernumbers|owner|owners|lover|lovers|submissive|dominant/i.test(k))
                    walk(val);
            }
        };
        walk(value);
        return out;
    }

    function getOwnerSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        [Player.Owner, Player.Ownership, Player.Ownership?.Owner,
         Player.Ownership?.Owners, Player.Ownership?.MemberNumber,
         Player.Ownership?.MemberNumbers]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    function getLoverSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        [Player.Lover, Player.Lovers, Player.Lovership,
         Player.Lovership?.MemberNumber, Player.Lovership?.MemberNumbers]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    function getFriendSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        const fn = Player.FriendNames;
        if (fn instanceof Map) {
            for (const key of fn.keys()) {
                const n = Number(key);
                if (Number.isFinite(n)) set.add(n);
            }
        } else {
            collectMemberNumbers(fn).forEach(n => set.add(n));
        }
        [Player.FriendList, Player.OnlineSharedSettings?.FriendList]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    function getRelation(memberNumber) {
        const mn = Number(memberNumber);
        if (!Number.isFinite(mn)) return null;
        if (getOwnerSet().has(mn)) return 'owner';
        if (getLoverSet().has(mn)) return 'lover';
        if (getFriendSet().has(mn)) return 'friend';
        return null;
    }

    function getRoomRelations(room) {
        const friends = Array.isArray(room?.Friends) ? room.Friends : [];
        const RANK    = { owner: 3, lover: 2, friend: 1 };
        return friends
            .map(f => {
                const memberNumber = Number(typeof f === 'object' ? f.MemberNumber : f);
                const memberName   = typeof f === 'object' ? (f.MemberName || String(memberNumber)) : String(memberNumber);
                const relation     = getRelation(memberNumber) || 'friend';
                return { memberNumber, memberName, relation };
            })
            .sort((a, b) => (RANK[b.relation] ?? 0) - (RANK[a.relation] ?? 0));
    }

    function getTopRelation(room) {
        const people = getRoomRelations(room);
        return people.length ? people[0].relation : null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSearch 區域（Space）與加入房間工具
    // ════════════════════════════════════════════════════════════════════════════

    const validSpace = s => s === 'X' || s === '';

    function playerHasMaleGender() {
        try {
            const genders = typeof Player !== 'undefined' && typeof Player?.GetGenders === 'function' ? Player.GetGenders() : [];
            return Array.isArray(genders) && genders.includes('M');
        } catch { return false; }
    }

    /** 依序嘗試 BC 函式 → 全域變數 → 玩家設定，每一層都驗證值合法 */
    function getCurrentSpace() {
        if (typeof ChatSearchGetSpace === 'function') {
            const s = ChatSearchGetSpace();
            if (validSpace(s)) return s;
        }
        if (typeof ChatSearchSpace !== 'undefined' && validSpace(ChatSearchSpace)) return ChatSearchSpace;
        const saved = typeof Player !== 'undefined' ? Player?.ChatSearchSettings?.Space : undefined;
        return validSpace(saved) ? saved : 'X';
    }

    function getSpaceButtonIcon() {
        if (playerHasMaleGender() || getCurrentSpace() === 'X') return BASE_URL + 'Icons/Gender.png';
        return BASE_URL + 'Screens/Online/ChatSelect/Female.png';
    }

    function getSpaceButtonLabel() {
        if (playerHasMaleGender()) return MPLT('chatsearch.space_male');
        return getCurrentSpace() === 'X' ? MPLT('chatsearch.space_to_f') : MPLT('chatsearch.space_to_x');
    }

    function getToggleTargetSpace() {
        if (playerHasMaleGender()) return 'X';
        return getCurrentSpace() === 'X' ? '' : 'X';
    }

    /** 同步 BC 的兩份區域狀態（男性角色強制混區），不觸發搜尋 */
    function setSearchSpace(space) {
        if (!validSpace(space)) return false;
        const allowed = playerHasMaleGender() ? 'X' : space;
        if (typeof Player !== 'undefined' && Player?.ChatSearchSettings) Player.ChatSearchSettings.Space = allowed;
        if (typeof ChatSearchSpace !== 'undefined') ChatSearchSpace = allowed;
        return true;
    }

    /**
     * 套用搜尋區域並重新查詢。
     * BC 的查詢回應需要 InputSearch；已離開搜尋頁時的延遲點擊不能再送查詢。
     */
    async function applySpace(space, queryText = '') {
        if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatSearch'
            || !document.getElementById('InputSearch') || typeof ChatSearchQuery !== 'function') return false;
        try {
            if (!setSearchSpace(space)) return false;
            await ChatSearchQuery(queryText);
            return true;
        } catch (e) {
            console.error(LOG, '切換區域失敗', e);
            return false;
        }
    }

    /** 點擊當下才取得 BC 原生加入按鈕：搜尋刷新後舊 DOM 可能已被替換 */
    function joinSearchRoom(room) {
        const btn = room?.Order != null ? document.getElementById(`chat-search-room-join-button-${room.Order}`) : null;
        if (btn) btn.click();
        else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatRoom 直版模式（crXxx）
    //
    // 新版 BC 的 #chat-room-div 是 flex 容器（頂部選單、聊天紀錄、輸入列都是它的子元素），
    // 已不再有 ChatRoomDivRect / ChatRoomTopMenuPosition 可供改座標。
    // 因此只需要：1) 把 #chat-room-div 固定在下半螢幕；2) 用 CSS 變數控制位置與高度。
    //
    // 手機鍵盤：使用 BC 原生 InputChat。鍵盤打開時只把聊天面板收縮到 visual viewport，
    // 人物區沿用鍵盤打開前的高度，因此 canvas 不會被 resize 壓扁；
    // 也不需要第二個輸入框，避免 focus/blur 互相觸發造成面板閃爍。
    // ════════════════════════════════════════════════════════════════════════════

    let crActive      = false;
    let crLockedVH    = 0;      // 進入／鍵盤打開前的視窗高度
    let crLockedWidth = 0;      // 寬度改變（轉向）時不視為鍵盤
    let crScope       = null;
    let crInputFocused = false;
    let crBlurTimer   = null;

    function crCalc() {
        const vh    = crLockedVH || window.innerHeight;
        const cvH   = Math.round(vh * CR_CANVAS_RATIO);
        const menuH = Math.round(vh * CR_MENU_RATIO);
        return { vh, cvH, menuH };
    }

    /** 鍵盤是否正在佔用版面（輸入框有焦點，或可視高度明顯縮小） */
    function isKeyboardLayoutLocked() {
        return crActive && window.innerWidth === crLockedWidth && (crInputFocused ||
            (crLockedVH > 0 && getLockedVH() < crLockedVH - 80));
    }

    function crSetLayoutVars(L = crCalc()) {
        const root = document.documentElement;
        const vv = window.visualViewport;
        const visualHeight    = Number.isFinite(vv?.height) ? vv.height : L.vh;
        const visualOffsetTop = Number.isFinite(vv?.offsetTop) ? vv.offsetTop : 0;
        const visualBottom    = visualOffsetTop + visualHeight;
        const bottom = isKeyboardLayoutLocked() ? Math.min(L.vh, visualBottom) : L.vh;
        // 鍵盤很高時允許聊天面板蓋住人物區，確保原生輸入列可見，但不縮放 canvas
        const top = Math.min(L.cvH, Math.max(visualOffsetTop, bottom - L.menuH - 64));
        for (const [key, value] of Object.entries({ 'top': top, 'height': Math.max(0, bottom - top), 'menu-h': L.menuH })) {
            const name = '--liko-cr-' + key;
            const next = value + 'px';
            if (root.style.getPropertyValue(name) !== next) root.style.setProperty(name, next);
        }
    }

    function crUpdateViewport() { if (crActive) crSetLayoutVars(); }

    function crHookChatInput() {
        const isChatInput = el => el?.id === 'InputChat';
        crScope.listen(document, 'focusin', e => {
            if (!crActive || !isPortrait() || !isChatInput(e.target)) return;
            if (crBlurTimer) clearTimeout(crBlurTimer);
            crBlurTimer = null;
            crInputFocused = true;
            crScope?.frame(crUpdateViewport);
        }, true);
        crScope.listen(document, 'focusout', e => {
            if (!isChatInput(e.target)) return;
            if (crBlurTimer) clearTimeout(crBlurTimer);
            // 送出後 BC 可能重建並立刻 focus 新輸入框；延遲可避免中間一幀跳回底部
            crBlurTimer = setTimeout(() => {
                crBlurTimer = null;
                crInputFocused = false;
                crUpdateViewport();
            }, 250);
        }, true);
    }

    /** 每幀維護（DrawProcess / ChatRoomResize 呼叫） */
    function crMaintain() {
        if (!crActive) return;
        if (!isKeyboardLayoutLocked()) {
            crLockedVH    = getLockedVH();
            crLockedWidth = window.innerWidth;
        }
        const L = crCalc();
        crSetLayoutVars(L);
        forceCanvasStyle(L.cvH, true);
    }

    function crApply() {
        if (crActive) return;
        crActive      = true;
        crScope       = createScope();
        crLockedVH    = getLockedVH();
        crLockedWidth = window.innerWidth;

        injectStyle('liko-ml-cr', `
            html, body { overflow-x: hidden !important }
            #chat-room-div {
                position:fixed !important; left:0 !important; top:var(--liko-cr-top) !important;
                width:100vw !important; height:var(--liko-cr-height) !important;
                display:flex !important; flex-direction:column !important;
                min-height:0 !important; box-sizing:border-box !important;
                z-index:${Z.CHAT_DIV} !important;
            }
            #chat-room-top-menu {
                flex:0 0 var(--liko-cr-menu-h) !important;
                height:var(--liko-cr-menu-h) !important; min-height:0 !important;
                box-sizing:border-box !important;
                z-index:${Z.TOP_MENU} !important;
            }
            #TextAreaChatLog {
                flex:1 1 0 !important; height:auto !important; min-height:0 !important;
                overflow-y:auto !important;
            }
            #chat-room-bot, #chat-room-reply-indicator { flex:0 0 auto !important }
            #InputChat { font-size:16px !important }   /* ≥16px：避免 iOS 聚焦時自動放大 */
        `);

        crHookChatInput();
        crMaintain();
    }

    function crRemove() {
        if (!crActive) return;
        crActive       = false;
        crLockedVH     = 0;
        crLockedWidth  = 0;
        crInputFocused = false;
        if (crBlurTimer) clearTimeout(crBlurTimer);
        crBlurTimer = null;
        crScope?.dispose();
        crScope = null;
        clearCanvasStyle();
        removeStyle('liko-ml-cr');
        for (const prop of ['--liko-cr-top', '--liko-cr-height', '--liko-cr-menu-h'])
            document.documentElement.style.removeProperty(prop);

        if (typeof ChatRoomResize === 'function') { try { ChatRoomResize(false); } catch { /* ignore */ } }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Dialog 直版模式（drXxx）
    //
    //   上半螢幕：canvas 左半（人物區，BC 虛擬 x:0~1000）
    //   下半螢幕：mirror canvas 複製主 canvas 右半（Dialog 區，BC 虛擬 x:1000~2000）
    //
    // 點擊下半時把螢幕座標換算成 BC 虛擬座標，設定 MouseX/MouseY 後 dispatch 事件，
    // 讓 BC 自己處理點擊邏輯。右半以正方形 contain 置中，不拉伸。
    // ════════════════════════════════════════════════════════════════════════════

    let drActive    = false;
    let drMirrorRAF = null;
    let drCapture   = null;

    /** 下半螢幕中 Dialog 區（正方形、置中）的 CSS 像素矩形；scale = 1000 邏輯單位對應的像素 */
    function getDialogRect() {
        const half = Math.round(window.innerHeight / 2);
        const size = Math.min(window.innerWidth, half);
        return { left: (window.innerWidth - size) / 2, top: half + (half - size) / 2,
                 width: size, height: size, scale: size / 1000 };
    }

    function drInjectClick(screenX, screenY, pointerType = 'touch') {
        const cv = getCanvas();
        if (!cv) return;
        const rect = cv.getBoundingClientRect();
        const dest = getDialogRect();
        // 點在正方形以外的留白區：不處理
        if (screenX < dest.left || screenX > dest.left + dest.width ||
            screenY < dest.top  || screenY > dest.top + dest.height) return;
        const x = (screenX - dest.left) / dest.scale;
        const y = (screenY - dest.top)  / dest.scale;

        if (typeof MouseX !== 'undefined') window.MouseX = 1000 + x;
        if (typeof MouseY !== 'undefined') window.MouseY = y;

        const eventOpts = {
            bubbles: true, cancelable: true,
            clientX: rect.left + (1000 + x) * rect.width / 2000,
            clientY: rect.top  + y * rect.height / 1000,
            pointerType, isPrimary: true,
        };

        if (typeof PointerEvent === 'function') {
            // 合成事件的 pointerId 沒有對應真實 pointer，setPointerCapture 會丟 NotFoundError
            const origSet     = cv.setPointerCapture.bind(cv);
            const origRelease = cv.releasePointerCapture.bind(cv);
            cv.setPointerCapture     = () => {};
            cv.releasePointerCapture = () => {};
            try {
                cv.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
                cv.dispatchEvent(new PointerEvent('pointerup',   eventOpts));
            } finally {
                cv.setPointerCapture     = origSet;
                cv.releasePointerCapture = origRelease;
            }
        }
        cv.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        cv.dispatchEvent(new MouseEvent('mouseup',   eventOpts));
        cv.dispatchEvent(new MouseEvent('click',     eventOpts));

        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (typeof MouseX !== 'undefined') window.MouseX = -1;
            if (typeof MouseY !== 'undefined') window.MouseY = -1;
        }));
    }

    const DIALOG_SEL = '.dialog-root, #color-picker, #layering';

    // 記住每個元素「上次我們設的位置」。BC 沒重新定位它就別再動，否則位移會疊加漂移
    const drMovedElements = new WeakMap();

    // AEE 色盤面板映射（見 LCE docs/vertical-api.md）：
    // 搬完原生 Dialog DOM 後，把標題列對應的水平範圍交給 AEE，讓它把面板貼進同一區塊。
    let mappedPickerApi = null;
    function drMapColorPicker() {
        const api = window.Liko?.AEE?.ColorPickerLayout;
        if (mappedPickerApi && mappedPickerApi !== api) mappedPickerApi.setMapping(null);
        mappedPickerApi = api?.version === 1 ? api : null;
        if (!mappedPickerApi) return;
        const header = document.getElementById('color-picker-header');
        const menu   = document.getElementById('color-picker-menu');
        if (!drActive || !header || !menu) { mappedPickerApi.setMapping(null); return; }
        const area = getDialogRect();
        const h = header.getBoundingClientRect();
        const m = menu.getBoundingClientRect();
        const heading = document.getElementById('color-picker-hgroup')
            || document.getElementById('color-picker-h1')?.closest('hgroup');
        const left  = Math.max(0, h.width > 0 ? h.left : area.left);
        const right = Math.min(window.innerWidth, h.width > 0 ? h.right : area.left + area.width);
        const headingTop = Math.max(area.top, m.bottom) + 4;
        mappedPickerApi.setMapping({
            left, width: right - left, headingTop,
            top: headingTop + (heading?.getBoundingClientRect().height || 30) + 4,
            bottom: window.innerHeight,
        });
    }

    /** 每幀把 dialog 頂層容器搬到下半螢幕（只動頂層，子元素相對定位不變） */
    function drMoveDomElements() {
        if (!drActive) return;
        const vw  = window.innerWidth;
        const cvH = Math.round(window.innerHeight * 0.5);
        const dest = getDialogRect();

        document.querySelectorAll(DIALOG_SEL).forEach(el => {
            if (el.parentElement?.closest(DIALOG_SEL)) return;   // 巢狀元素跟著頂層走，不重複搬
            const r    = el.getBoundingClientRect();
            const prev = drMovedElements.get(el);
            if (prev && Math.abs(r.left - prev.lastSetLeft) < 1 && Math.abs(r.top - prev.lastSetTop) < 1) return;
            if (r.left < vw * 0.5) return;   // 只處理 BC 定位在螢幕右側（被擠出去）的元素

            const newLeft = r.left - dest.width;
            const newTop  = r.top + cvH;
            el.style.setProperty('left',    newLeft + 'px', 'important');
            el.style.setProperty('top',     newTop  + 'px', 'important');
            el.style.setProperty('z-index', String(Z.DIALOG_ROOT), 'important');
            if (el.classList.contains('dialog-root')) el.style.setProperty('width', dest.width + 'px', 'important');
            drMovedElements.set(el, { lastSetLeft: newLeft, lastSetTop: newTop });
        });
        drMapColorPicker();
    }

    /** 建立 mirror canvas，每 2 幀把主 canvas 右半複製到下半螢幕（30fps 足夠） */
    function drStartMirror() {
        const cvH = Math.round(window.innerHeight * 0.5);
        const vw  = window.innerWidth;

        document.getElementById('liko-dr-mirror')?.remove();
        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }

        const mirror = document.createElement('canvas'); mirror.id = 'liko-dr-mirror';
        mirror.width  = vw;
        mirror.height = cvH;
        mirror.style.cssText = `
            position:fixed !important; top:${cvH}px !important; left:0 !important;
            width:${vw}px !important; height:${cvH}px !important;
            z-index:${Z.DR_MIRROR} !important; pointer-events:none !important;
        `;
        document.body.appendChild(mirror);

        const ctx = mirror.getContext('2d');
        const src = getCanvas();
        let frame = 0;

        const loop = () => {
            drMirrorRAF = requestAnimationFrame(loop);
            if (!drActive || !src) return;
            if (++frame % 2 === 0) {
                ctx.clearRect(0, 0, vw, cvH);
                const d = getDialogRect();
                try { ctx.drawImage(src, 1000, 0, 1000, 1000, d.left, d.top - cvH, d.width, d.height); } catch { /* ignore */ }
            }
            drMoveDomElements();
        };
        loop();
    }

    function drApply() {
        if (drActive) return;
        drActive = true;

        const cvH = Math.round(window.innerHeight * 0.5);
        forceCanvasStyle(cvH, true);

        injectStyle('liko-ml-dr', `
            html, body { overflow-x:hidden !important }
            #liko-dr-overlay {
                position:fixed; top:${cvH}px; left:0;
                width:100vw; height:calc(100vh - ${cvH}px);
                z-index:${Z.DR_OVERLAY} !important;
                cursor:pointer; -webkit-tap-highlight-color:transparent; background:transparent;
            }
            .dialog-root { pointer-events:auto !important; overflow-y:auto !important }
        `);

        drStartMirror();

        document.getElementById('liko-dr-overlay')?.remove();
        const overlay = document.createElement('div'); overlay.id = 'liko-dr-overlay';

        const onPointer = e => {
            if (!drActive) return;
            e.preventDefault();
            e.stopPropagation();
            const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
            const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
            if (x != null && y != null) drInjectClick(x, y, e.type === 'touchstart' ? 'touch' : 'mouse');
        };
        overlay.addEventListener('mousedown',  onPointer, { passive: false });
        overlay.addEventListener('touchstart', onPointer, { passive: false });
        document.body.appendChild(overlay);

        drCapture = { overlay, onPointer };
        drMoveDomElements();
    }

    function drRemove() {
        if (!drActive) return;
        drActive = false;
        mappedPickerApi?.setMapping(null);
        mappedPickerApi = null;

        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }
        document.getElementById('liko-dr-mirror')?.remove();

        document.querySelectorAll(DIALOG_SEL).forEach(el => {
            for (const p of ['left', 'top', 'z-index', 'width']) el.style.removeProperty(p);
            drMovedElements.delete(el);
        });

        clearCanvasStyle();
        removeStyle('liko-ml-dr');

        if (drCapture) {
            drCapture.overlay.removeEventListener('mousedown',  drCapture.onPointer);
            drCapture.overlay.removeEventListener('touchstart', drCapture.onPointer);
            drCapture.overlay.remove();
            drCapture = null;
        }
    }

    function drMaintain() {
        if (!drActive) return;
        forceCanvasStyle(Math.round(window.innerHeight * 0.5), true);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSelect 直版模式（csXxx）
    // ════════════════════════════════════════════════════════════════════════════

    let csActive = false;

    function csApply() {
        if (csActive) return;
        csActive = true;
        injectStyle('liko-ml-cs', `
            html, body { overflow-x:hidden !important }
            #liko-cs-bg { position:fixed; inset:0; z-index:100; overflow:hidden; background:#111 }
            #liko-cs-bg-img {
                position:absolute; top:0; left:-50vw; width:200vw; height:100%;
                object-fit:cover; object-position:top left; pointer-events:none;
            }
            #liko-cs-overlay {
                position:absolute; inset:0; z-index:101;
                display:flex; flex-direction:column; align-items:center; justify-content:space-evenly;
                padding:28px 24px; box-sizing:border-box; background:rgba(0,0,0,0.40);
            }
            #liko-cs-exit {
                position:absolute; top:10px; right:10px; z-index:102;
                width:42px; height:42px; border-radius:8px;
                border:1px solid rgba(255,255,255,0.28); background:rgba(0,0,0,0.60);
                cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0;
            }
            #liko-cs-exit img { width:26px; height:26px; object-fit:contain }
            #liko-cs-exit:active { background:rgba(120,20,20,0.80) }
            .liko-cs-row { width:100%; max-width:480px; display:flex; flex-direction:column; align-items:stretch; gap:9px }
            .liko-cs-btn {
                width:100%; min-height:64px; border-radius:14px;
                border:1px solid rgba(255,255,255,0.28); background:rgba(15,15,35,0.80);
                color:#fff; font-size:18px; font-weight:700; cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:14px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                user-select:none; padding:0 20px; backdrop-filter:blur(4px);
            }
            .liko-cs-btn:active { background:rgba(80,50,200,0.65) }
            .liko-cs-btn.disabled { opacity:0.35; pointer-events:none }
            .liko-cs-btn img { width:34px; height:34px; flex-shrink:0 }
            .liko-cs-desc {
                font-size:13px; line-height:1.5; color:rgba(230,220,255,0.78); text-align:center;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                user-select:none; padding:0 8px;
            }
        `);
        buildCsBg();
    }

    function buildCsBg() {
        if (!csActive) return;
        document.getElementById('liko-cs-bg')?.remove();
        const T = typeof TextGet === 'function' ? (k => TextGet(k) || k) : k => k;

        const bg    = document.createElement('div'); bg.id = 'liko-cs-bg';
        const bgImg = document.createElement('img'); bgImg.id = 'liko-cs-bg-img'; bgImg.alt = '';
        bgImg.src = BASE_URL + 'Backgrounds/BrickWall.jpg';
        bg.appendChild(bgImg);

        const ol      = document.createElement('div'); ol.id = 'liko-cs-overlay';
        const exitBtn = document.createElement('button'); exitBtn.id = 'liko-cs-exit';
        i18nAttr(exitBtn, 'aria-label', 'chatselect.exit_aria');
        const exitImg = document.createElement('img');
        exitImg.src = BASE_URL + 'Icons/Exit.png';
        exitImg.onerror = () => { exitImg.style.display = 'none'; exitBtn.textContent = '✕'; };
        exitBtn.appendChild(exitImg);
        exitBtn.addEventListener('click', () => {
            if (typeof ChatSelectExit === 'function') ChatSelectExit();
            else if (typeof CommonSetScreen === 'function') CommonSetScreen('Room', 'MainHall');
        });
        ol.appendChild(exitBtn);

        // ok 的 fallback 一律 true：BC 更新讓變數消失時寧可讓使用者點下去，
        // 由 ChatSelectStartSearch 自行決定能否進入，也不要無故鎖住選項。
        const options = [
            { icon: BASE_URL + 'Screens/Online/ChatSelect/Female.png', label: T('FemaleOnlyChat'), desc: T('FemaleOnlyChatDescription1'), space: '',
              ok: typeof ChatSelectAllowedInFemaleOnly !== 'undefined' ? ChatSelectAllowedInFemaleOnly : true },
            { icon: BASE_URL + 'Icons/Gender.png', label: T('MixedChat'), desc: T('MixedChatDescription1'), space: 'X', ok: true },
            { icon: BASE_URL + 'Screens/Online/ChatSelect/Male.png', label: T('MaleOnlyChat'), desc: T('MaleOnlyChatDescription1'), space: 'M',
              ok: typeof ChatSelectAllowedInMaleOnly !== 'undefined' ? ChatSelectAllowedInMaleOnly : true },
        ];

        for (const opt of options) {
            const row = document.createElement('div'); row.className = 'liko-cs-row';
            const btn = document.createElement('button');
            btn.className = 'liko-cs-btn' + (opt.ok ? '' : ' disabled');
            const img = document.createElement('img'); img.src = opt.icon;
            img.onerror = () => { img.style.display = 'none'; };
            btn.appendChild(img);
            btn.appendChild(document.createTextNode(opt.label));
            btn.addEventListener('click', () => {
                if (!opt.ok) return;
                if (typeof ChatSelectStartSearch === 'function') ChatSelectStartSearch(opt.space);
            });
            const desc = document.createElement('div'); desc.className = 'liko-cs-desc';
            desc.textContent = opt.desc;
            row.appendChild(btn); row.appendChild(desc);
            ol.appendChild(row);
        }

        bg.appendChild(ol);
        document.body.appendChild(bg);
    }

    function csRemove() {
        if (!csActive) return;
        csActive = false;
        removeStyle('liko-ml-cs');
        document.getElementById('liko-cs-bg')?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSearch 直版模式（cshXxx）
    // ════════════════════════════════════════════════════════════════════════════

    const HEADER_H = 52, FOOTER_H = 48;

    let cshActive     = false;
    let cshSyncTimer  = null;
    let cshNeedSync   = false;
    let cshPage       = 1;
    let cshRoomsCache = [];
    let cshAnimating  = false;
    let cancelPageTransition = null;
    let cshDrag       = null;

    const CSH_BC_IDS = [
        'chat-search-room-header',
        'chat-search-body',
        'chat-search-room-grid',
        'chat-search-search-menu',
        'chat-search-filter-help-screen',
    ];

    function getCshRoomsSource() {
        if (typeof ChatSearchGetRooms === 'function') {
            const rooms = ChatSearchGetRooms();
            return Array.isArray(rooms) ? rooms.slice() : [];
        }
        if (typeof ChatSearchResult !== 'undefined' && Array.isArray(ChatSearchResult))
            return ChatSearchResult.slice();
        return [];
    }

    function calcCshPerPage() {
        const listH = window.innerHeight - HEADER_H - FOOTER_H - 24;
        return Math.max(1, Math.floor(listH / (CARD_MIN_H + CARD_GAP))) * 2;
    }

    function buildRoomTags(room) {
        const bcText = k => typeof TextGet === 'function' ? (TextGet(k) || k) : k;
        const tags = [];
        if (room.Space !== undefined && typeof ChatSearchGetSpaceName === 'function')
            tags.push(ChatSearchGetSpaceName(room.Space));
        if (room.Language && typeof ChatSearchGetLanguageName === 'function')
            tags.push(ChatSearchGetLanguageName(room.Language));
        if (room.Game) tags.push(bcText(room.Game));
        if (room.MapType && room.MapType !== 'Never' && typeof ChatSearchGetRoomTypeName === 'function')
            tags.push(ChatSearchGetRoomTypeName(room.MapType));
        if (Array.isArray(room.BlockCategory))
            for (const b of room.BlockCategory) tags.push(MPLT('chatsearch.block_prefix') + bcText(b));
        if (Array.isArray(room.Access))
            for (const a of room.Access) {
                if (a === 'All') continue;
                tags.push(MPLT('chatsearch.access_prefix') + bcText(a + 'Access'));
            }
        return tags;
    }

    function refreshCshSpaceButton() {
        const btn = document.getElementById('liko-csh-space-btn');
        if (!btn) return;
        const img = btn.querySelector('img');
        if (img) img.src = getSpaceButtonIcon();
        btn.setAttribute('aria-label', getSpaceButtonLabel());
        btn.style.opacity  = playerHasMaleGender() ? '0.85' : '1';
        btn.dataset.locked = playerHasMaleGender() ? 'true' : 'false';
    }

    /**
     * 用 id 關鍵字在 BC 原生 ChatSearch DOM 中找按鈕。
     * 這是「能動但脆弱」的做法：BC 改命名就回 null，呼叫端一定要有 fallback。
     */
    function findChatSearchButton(...keywords) {
        const candidates = document.querySelectorAll('#chat-search-room-header button, [id^="chat-search"] button');
        for (const btn of candidates) {
            const id = (btn.id || '').toLowerCase();
            if (keywords.some(k => id.includes(k))) return btn;
        }
        return null;
    }

    /** 收到伺服器新房間列表 → debounce 100ms 再重刷（BC 會連續呼叫多次 Run） */
    function cshSyncIfNeeded() {
        if (!cshActive || !cshNeedSync || cshSyncTimer) return;
        cshNeedSync  = false;
        cshSyncTimer = setTimeout(() => {
            cshSyncTimer = null;
            if (cshActive) renderCshList(true);
        }, 100);
    }

    function cshStyles() {
        return `
            #liko-csh-shell input { user-select:text; -webkit-user-select:text; }
            html, body { overflow-x:hidden !important }
            #liko-csh-shell {
                user-select:none; -webkit-user-select:none;
                position:fixed; inset:0; z-index:50;
                display:flex; flex-direction:column;
                background:#0a0a14; overflow:hidden;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            }
            #liko-csh-header {
                flex-shrink:0; height:${HEADER_H}px;
                display:flex; align-items:center; gap:5px;
                padding:0 8px; box-sizing:border-box;
                background:#12121e; border-bottom:1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-search-wrap { flex:1; min-width:0; height:36px; display:flex; align-items:center; position:relative }
            #liko-csh-search-wrap input {
                flex:1; height:100%; box-sizing:border-box;
                background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.18);
                border-radius:9px; color:#fff; font-size:16px;
                padding:0 30px 0 10px; outline:none;
            }
            #liko-csh-search-wrap input::placeholder { color:rgba(255,255,255,0.38) }
            #liko-csh-clear {
                position:absolute; right:6px; top:50%; transform:translateY(-50%);
                background:none; border:none; color:rgba(255,255,255,0.45);
                font-size:15px; cursor:pointer; padding:0; line-height:1; display:none;
            }
            #liko-csh-clear.visible { display:block }
            .liko-csh-hbtn {
                flex-shrink:0; width:44px; height:44px; border-radius:10px;
                border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.07);
                display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;
            }
            .liko-csh-hbtn img { width:26px; height:26px; object-fit:contain }
            .liko-csh-hbtn:active { background:rgba(255,255,255,0.18) }
            .liko-csh-hbtn.create { border-color:rgba(120,80,220,0.60); background:rgba(100,60,200,0.25) }

            /* 列表：三頁式軌道（prev/curr/next），靠 translateX 翻頁 */
            #liko-csh-list { flex:1; overflow:hidden; position:relative; touch-action:none }
            #liko-csh-track { position:absolute; inset:0; will-change:transform }
            #liko-csh-track.animating { transition:transform 220ms ease }
            .liko-csh-page {
                position:absolute; top:0; width:100%; height:100%;
                display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
                gap:${CARD_GAP}px; padding:6px; box-sizing:border-box; align-content:start;
            }
            .liko-csh-page.prev { left:-100% }
            .liko-csh-page.curr { left:0 }
            .liko-csh-page.next { left:100% }

            .liko-csh-card {
                background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10);
                border-radius:10px; padding:7px 8px; cursor:pointer;
                display:flex; flex-direction:column; gap:3px;
                min-height:${CARD_MIN_H}px; box-sizing:border-box; position:relative;
                min-width:0; overflow:hidden;
            }
            .liko-csh-card:active { background:rgba(255,255,255,0.14) }
            .liko-csh-card.full {
                border-color:rgba(255,70,70,0.88); border-width:2px;
                background:rgba(80,20,20,0.20); box-shadow:inset 0 0 0 1px rgba(255,70,70,0.18);
            }
            .liko-csh-card.has-friend { border-color:rgba(82,214,109,0.38); box-shadow:0 0 0 1px rgba(82,214,109,0.08) inset }
            .liko-csh-card.has-friend:not(.full) {
                background:linear-gradient(180deg,rgba(82,214,109,0.06),rgba(82,214,109,0.02)), rgba(255,255,255,0.03);
            }
            .liko-csh-card-top { display:flex; align-items:flex-start; gap:3px; padding-right:22px }
            .liko-csh-card-lock { font-size:11px; flex-shrink:0; line-height:1.4 }
            .liko-csh-card-name { font-size:12px; font-weight:600; color:#f0e8ff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1 }
            .liko-csh-card-info {
                position:absolute; top:5px; right:5px; width:18px; height:18px; border-radius:4px;
                border:1px solid rgba(255,255,255,0.20); background:rgba(255,255,255,0.08);
                color:rgba(255,255,255,0.55); font-size:10px;
                display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;
            }
            .liko-csh-card-info:active { background:rgba(255,255,255,0.22) }
            .liko-csh-card-owner { font-size:10px; color:rgba(180,170,210,0.60); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
            .liko-csh-card-desc {
                font-size:10px; color:rgba(185,175,210,0.72); overflow:hidden; display:-webkit-box;
                -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:1.35; flex:1;
            }
            .liko-csh-card-foot {
                display:flex; justify-content:flex-start; align-items:center;
                font-size:10px; color:rgba(160,200,255,0.72); padding-top:2px; margin-top:auto; gap:5px;
            }
            .liko-csh-card-count { white-space:nowrap }
            .liko-csh-card-count.full { color:rgba(255,90,90,0.98); font-weight:800 }
            .liko-csh-card-rel { display:inline-flex; align-items:center; gap:4px; white-space:nowrap; font-size:10px; font-weight:700 }
            .liko-csh-card-rel .dot { width:7px; height:7px; border-radius:999px; display:inline-block }
            .liko-csh-card-rel.friend { color:rgba(90,230,120,0.95) }
            .liko-csh-card-rel.friend .dot { background:#52d66d }
            .liko-csh-card-rel.lover { color:rgba(255,120,210,0.95) }
            .liko-csh-card-rel.lover .dot { background:#ff66c4 }
            .liko-csh-card-rel.owner { color:rgba(255,175,90,0.98) }
            .liko-csh-card-rel.owner .dot { background:#ff9b3d }
            .liko-csh-empty { grid-column:1 / -1; text-align:center; color:rgba(255,255,255,0.28); font-size:13px; padding:50px 0 }

            #liko-csh-footer {
                flex-shrink:0; height:${FOOTER_H}px;
                display:flex; align-items:center; padding:0 8px; gap:6px; box-sizing:border-box;
                background:#12121e; border-top:1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-foot-left  { flex:1 }
            #liko-csh-foot-pages { display:flex; align-items:center; gap:6px; flex:2; justify-content:center }
            #liko-csh-foot-right { flex:1; display:flex; justify-content:flex-end }
            .liko-csh-page-btn {
                height:34px; padding:0 14px; border-radius:8px;
                border:1px solid rgba(255,255,255,0.18); background:rgba(255,255,255,0.07);
                color:#fff; font-size:12px; cursor:pointer; white-space:nowrap;
            }
            .liko-csh-page-btn:active   { background:rgba(255,255,255,0.18) }
            .liko-csh-page-btn.disabled { opacity:0.30; pointer-events:none }
            #liko-csh-pageinfo { font-size:11px; color:rgba(255,255,255,0.45); white-space:nowrap }
            #liko-csh-exit-btn {
                height:34px; padding:0 14px; border-radius:8px;
                border:1px solid rgba(255,100,100,0.30); background:rgba(80,20,20,0.40);
                color:rgba(255,160,160,0.85); font-size:12px; cursor:pointer;
            }
            #liko-csh-exit-btn:active { background:rgba(120,30,30,0.60) }

            /* 房間詳情 bottom sheet */
            #liko-csh-info-backdrop {
                position:fixed; inset:0; z-index:80; background:rgba(0,0,0,0.52);
                display:flex; align-items:flex-end; justify-content:center;
            }
            #liko-csh-info-sheet {
                width:100%; max-width:768px; max-height:82vh; overflow:auto;
                background:#151522; border-top-left-radius:18px; border-top-right-radius:18px;
                border:1px solid rgba(255,255,255,0.10); box-shadow:0 -10px 30px rgba(0,0,0,0.35);
                padding:14px 14px 16px; box-sizing:border-box;
            }
            #liko-csh-info-handle { width:42px; height:4px; border-radius:999px; background:rgba(255,255,255,0.20); margin:0 auto 12px }
            #liko-csh-info-head  { display:flex; align-items:flex-start; gap:8px }
            #liko-csh-info-main  { flex:1; min-width:0 }
            #liko-csh-info-title { font-size:16px; font-weight:700; color:#f3ecff; line-height:1.3; word-break:break-word }
            #liko-csh-info-owner { margin-top:3px; font-size:12px; color:rgba(200,190,220,0.72) }
            #liko-csh-info-close {
                flex-shrink:0; width:34px; height:34px; border-radius:9px;
                border:1px solid rgba(255,255,255,0.14); background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;
            }
            #liko-csh-info-desc { margin-top:12px; font-size:13px; line-height:1.55; color:rgba(230,225,240,0.88); white-space:pre-wrap; word-break:break-word }
            #liko-csh-info-tags { margin-top:12px; display:flex; flex-wrap:wrap; gap:6px }
            .liko-csh-tag {
                padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.07);
                border:1px solid rgba(255,255,255,0.10); color:#e9defa; font-size:11px; line-height:1.2;
            }
            #liko-csh-info-people { margin-top:12px; display:flex; flex-direction:column; gap:6px }
            .liko-csh-info-person {
                display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px;
                background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
                font-size:12px; color:#efe7ff;
            }
            .liko-csh-rel-dot { width:8px; height:8px; border-radius:999px; flex-shrink:0 }
            .liko-csh-rel-dot.friend { background:#52d66d }
            .liko-csh-rel-dot.lover  { background:#ff66c4 }
            .liko-csh-rel-dot.owner  { background:#ff9b3d }
            .liko-csh-rel-label { font-size:11px; color:rgba(255,255,255,0.55); margin-left:auto }
            #liko-csh-info-footer { margin-top:14px; display:flex; align-items:center; gap:8px }
            #liko-csh-info-members { flex:1; font-size:12px; color:rgba(160,200,255,0.82) }
            #liko-csh-info-join {
                height:38px; padding:0 16px; border-radius:10px;
                border:1px solid rgba(120,80,220,0.55); background:rgba(100,60,200,0.28);
                color:#fff; font-size:13px; font-weight:700; cursor:pointer;
            }
            #liko-csh-info-join.disabled { opacity:0.4; pointer-events:none }
        `;
    }

    function cshApply() {
        if (cshActive) return;
        cshActive    = true;
        cshNeedSync  = false;
        cshPage      = 1;
        cshAnimating = false;
        cshDrag      = null;

        forceCanvasStyle(0);   // ChatSearch 不需要顯示角色，canvas 收成 0 高
        injectStyle('liko-ml-csh-hide', CSH_BC_IDS.map(id => `#${id} { display:none !important }`).join('\n'));
        injectStyle('liko-ml-csh', cshStyles());
        buildCshShell();
    }

    function makeHBtn(imgSrc, ariaLabel, onClick, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = 'liko-csh-hbtn' + (extraClass ? ' ' + extraClass : '');
        btn.setAttribute('aria-label', ariaLabel);
        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.style.cssText = 'width:26px;height:26px;object-fit:contain;pointer-events:none;';
            img.onerror = () => { img.style.display = 'none'; btn.textContent = ariaLabel.slice(0, 2); };
            btn.appendChild(img);
        }
        if (onClick) btn.addEventListener('click', onClick);
        return btn;
    }

    // ── 翻頁 ──────────────────────────────────────────────────────────────────

    function cancelPageTurn() {
        cancelPageTransition?.();
        cancelPageTransition = null;
        cshAnimating = false;
    }

    /** 啟動翻頁過場；以 finishTransform 保底，避免 transitionend 沒觸發時永遠卡在 animating */
    function commitPageTurn(track, targetPage, transform) {
        cancelPageTurn();
        cshAnimating = true;
        cancelPageTransition = finishTransform(track, () => {
            cancelPageTransition = null;
            cshAnimating = false;
            if (!cshActive || document.getElementById('liko-csh-shell')?._track !== track) return;
            cshPage = targetPage;
            renderCshList(false);
        });
        track.classList.add('animating');
        track.style.transform = transform;
    }

    function cshAnimatePageTurn(dir) {
        const track = document.getElementById('liko-csh-shell')?._track;
        if (!track || cshAnimating) return;
        const perPage    = Math.max(1, calcCshPerPage());
        const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
        const targetPage = cshPage + dir;
        if (targetPage < 1 || targetPage > totalPages) return;
        commitPageTurn(track, targetPage, `translateX(${dir > 0 ? '-100%' : '100%'})`);
    }

    // ── 房間卡片 ──────────────────────────────────────────────────────────────

    function buildRoomCard(room) {
        const name        = room.Name        || MPLT('room.unnamed');
        const creator     = room.Creator     || '';
        const desc        = room.Description || '';
        const memberCount = room.MemberCount ?? null;
        const limit       = room.MemberLimit ?? null;
        const locked      = !room.CanJoin;
        const isFull      = memberCount !== null && limit !== null && memberCount >= limit;
        const hasFriend   = Array.isArray(room.Friends) && room.Friends.length > 0;

        const card = document.createElement('div');
        card.className = 'liko-csh-card' + (isFull ? ' full' : '') + (hasFriend ? ' has-friend' : '');

        const top = document.createElement('div'); top.className = 'liko-csh-card-top';
        if (locked) {
            const lockEl = document.createElement('span');
            lockEl.className = 'liko-csh-card-lock';
            lockEl.textContent = '🔒';
            top.appendChild(lockEl);
        }
        const nameEl = document.createElement('div'); nameEl.className = 'liko-csh-card-name';
        nameEl.textContent = name;
        top.appendChild(nameEl);
        card.appendChild(top);

        const infoBtn = document.createElement('button'); infoBtn.className = 'liko-csh-card-info';
        infoBtn.textContent = 'ⓘ';
        i18nAttr(infoBtn, 'aria-label', 'room.info_aria');
        infoBtn.addEventListener('click', e => { e.stopPropagation(); cshShowRoomInfo(room); });
        card.appendChild(infoBtn);

        if (creator) {
            const ownerEl = document.createElement('div'); ownerEl.className = 'liko-csh-card-owner';
            ownerEl.textContent = MPLT('room.by_prefix') + creator;
            card.appendChild(ownerEl);
        }
        if (desc) {
            const descEl = document.createElement('div'); descEl.className = 'liko-csh-card-desc';
            descEl.textContent = desc;
            card.appendChild(descEl);
        }

        const foot = document.createElement('div'); foot.className = 'liko-csh-card-foot';
        const cnt  = document.createElement('span');
        cnt.className = 'liko-csh-card-count' + (isFull ? ' full' : '');
        cnt.textContent = memberCount !== null ? `👥 ${memberCount}${limit !== null ? '/' + limit : ''}` : '';
        foot.appendChild(cnt);

        for (const relType of new Set(getRoomRelations(room).map(p => p.relation))) {
            const rel  = document.createElement('span'); rel.className = `liko-csh-card-rel ${relType}`;
            const dot  = document.createElement('span'); dot.className = 'dot';
            const text = document.createElement('span');
            i18nText(text, `rel.${relType}`);
            rel.appendChild(dot);
            rel.appendChild(text);
            foot.appendChild(rel);
        }
        card.appendChild(foot);

        card.addEventListener('click', () => joinSearchRoom(room));
        return card;
    }

    // ── 殼層 ──────────────────────────────────────────────────────────────────

    function buildCshShell() {
        cancelPageTurn();
        document.getElementById('liko-csh-shell')?.remove();
        const shell = document.createElement('div'); shell.id = 'liko-csh-shell';

        // Header
        const header = document.createElement('div'); header.id = 'liko-csh-header';
        const wrap = document.createElement('div');   wrap.id = 'liko-csh-search-wrap';
        const inp  = document.createElement('input'); inp.type = 'text';
        i18nAttr(inp, 'placeholder', 'chatsearch.search_ph');
        inp.value = typeof ChatSearchQueryString !== 'undefined' ? ChatSearchQueryString : '';

        const clearBtn = document.createElement('button'); clearBtn.id = 'liko-csh-clear';
        clearBtn.textContent = '✕';
        i18nAttr(clearBtn, 'aria-label', 'chatsearch.clear_aria');
        if (inp.value) clearBtn.classList.add('visible');
        clearBtn.addEventListener('click', () => {
            inp.value = '';
            clearBtn.classList.remove('visible');
            if (typeof ChatSearchQuery === 'function') ChatSearchQuery('');
        });
        inp.addEventListener('input', () => {
            clearBtn.classList.toggle('visible', inp.value.length > 0);
            clearTimeout(inp._deb);
            inp._deb = setTimeout(() => { if (typeof ChatSearchQuery === 'function') ChatSearchQuery(inp.value); }, 400);
        });
        wrap.appendChild(inp);
        wrap.appendChild(clearBtn);
        header.appendChild(wrap);

        header.appendChild(makeHBtn(BASE_URL + 'Icons/Search.png', MPLT('chatsearch.filter_aria'), () => {
            const bcFilterBtn = findChatSearchButton('filter');
            if (bcFilterBtn) { bcFilterBtn.style.removeProperty('display'); bcFilterBtn.click(); }
            else console.warn(LOG, '找不到原生篩選按鈕，BC 介面可能已更新');
        }));

        const spaceBtn = makeHBtn(getSpaceButtonIcon(), getSpaceButtonLabel(), () => {
            if (playerHasMaleGender()) { refreshCshSpaceButton(); return; }
            applySpace(getToggleTargetSpace(), inp.value ?? '').then(refreshCshSpaceButton);
            refreshCshSpaceButton();
        });
        spaceBtn.id = 'liko-csh-space-btn';
        header.appendChild(spaceBtn);

        header.appendChild(makeHBtn(BASE_URL + 'Icons/Plus.png', MPLT('chatsearch.create_aria'), () => {
            // BC 已沒有 ChatSearchCreateRoom 全域函式，只能透過原生按鈕觸發
            const bcCreate = findChatSearchButton('create');
            if (bcCreate) { bcCreate.style.removeProperty('display'); bcCreate.click(); return; }
            console.warn(LOG, '找不到原生建立房間按鈕，BC 介面可能已更新');
        }, 'create'));
        shell.appendChild(header);

        // 列表
        const list  = document.createElement('div'); list.id = 'liko-csh-list';
        const track = document.createElement('div'); track.id = 'liko-csh-track';
        list.appendChild(track);
        shell._list  = list;
        shell._track = track;
        shell.appendChild(list);

        // Footer
        const footer    = document.createElement('div'); footer.id = 'liko-csh-footer';
        const footLeft  = document.createElement('div'); footLeft.id  = 'liko-csh-foot-left';
        const footPages = document.createElement('div'); footPages.id = 'liko-csh-foot-pages';
        const footRight = document.createElement('div'); footRight.id = 'liko-csh-foot-right';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'liko-csh-page-btn disabled';
        prevBtn.textContent = '‹';
        i18nAttr(prevBtn, 'aria-label', 'chatsearch.prev_aria');
        prevBtn.addEventListener('click', () => cshAnimatePageTurn(-1));

        const pageInfo = document.createElement('span'); pageInfo.id = 'liko-csh-pageinfo';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'liko-csh-page-btn disabled';
        nextBtn.textContent = '›';
        i18nAttr(nextBtn, 'aria-label', 'chatsearch.next_aria');
        nextBtn.addEventListener('click', () => cshAnimatePageTurn(1));

        footPages.appendChild(prevBtn);
        footPages.appendChild(pageInfo);
        footPages.appendChild(nextBtn);

        const exitBtn = document.createElement('button'); exitBtn.id = 'liko-csh-exit-btn';
        i18nText(exitBtn, 'chatsearch.exit_btn');
        exitBtn.addEventListener('click', () => {
            const bcExit = findChatSearchButton('exit');
            if (bcExit) { bcExit.click(); return; }
            if (typeof ChatSearchExit === 'function') ChatSearchExit();
            else if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSelect');
            else console.warn(LOG, '找不到原生離開按鈕，BC 介面可能已更新');
        });
        footRight.appendChild(exitBtn);

        footer.appendChild(footLeft);
        footer.appendChild(footPages);
        footer.appendChild(footRight);
        shell.appendChild(footer);

        shell._prev     = prevBtn;
        shell._next     = nextBtn;
        shell._pageInfo = pageInfo;

        document.body.appendChild(shell);

        // 男性角色只能進混區
        if (playerHasMaleGender() && getCurrentSpace() !== 'X') applySpace('X', inp.value ?? '');

        refreshCshSpaceButton();
        renderCshList();
        cshBindSwipe(list);
    }

    function getCshPageRooms(page) {
        const perPage    = Math.max(1, calcCshPerPage());
        const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
        if (page < 1 || page > totalPages) return [];
        const start = (page - 1) * perPage;
        return cshRoomsCache.slice(start, start + perPage);
    }

    function fillCshPage(panel, rooms) {
        panel.innerHTML = '';
        for (const room of rooms) panel.appendChild(buildRoomCard(room));
    }

    function cshResetTrackPosition(track, value = 'translateX(0)') {
        if (!track) return;
        track.classList.remove('animating');
        track.style.setProperty('transition', 'none', 'important');
        track.style.transform = value;
        void track.offsetHeight;   // 強制 reflow，確保 transition:none 生效後再解除
        track.style.removeProperty('transition');
    }

    /** 渲染（或重新渲染）當前頁的房間卡片列表 */
    function renderCshList(resetPage = false) {
        cancelPageTurn();
        const shell = document.getElementById('liko-csh-shell');
        const track = shell?._track;
        if (!shell || !track) return;

        cshRoomsCache = getCshRoomsSource();
        const perPage    = Math.max(1, calcCshPerPage());
        const totalRooms = cshRoomsCache.length;
        const totalPages = Math.max(1, Math.ceil(totalRooms / perPage));

        if (resetPage) cshPage = 1;
        cshPage = Math.min(Math.max(1, cshPage), totalPages);

        track.innerHTML = '';
        const prev = document.createElement('div'); prev.className = 'liko-csh-page prev';
        const curr = document.createElement('div'); curr.className = 'liko-csh-page curr';
        const next = document.createElement('div'); next.className = 'liko-csh-page next';

        fillCshPage(prev, getCshPageRooms(cshPage - 1));
        fillCshPage(curr, getCshPageRooms(cshPage));
        fillCshPage(next, getCshPageRooms(cshPage + 1));

        if (!curr.childElementCount) {
            const emp = document.createElement('div'); emp.className = 'liko-csh-empty';
            i18nText(emp, 'chatsearch.no_rooms');
            curr.appendChild(emp);
        }

        track.append(prev, curr, next);
        cshResetTrackPosition(track);

        shell._prev.className = 'liko-csh-page-btn' + (cshPage > 1 ? '' : ' disabled');
        shell._next.className = 'liko-csh-page-btn' + (cshPage < totalPages ? '' : ' disabled');
        shell._pageInfo.textContent = totalRooms > 0
            ? MPLT('chatsearch.page_info', { page: cshPage, total: totalPages, count: totalRooms })
            : '0/0';

        refreshCshSpaceButton();
    }

    /** 左右滑動翻頁；到頭到尾加阻尼（dx*0.22）。拖曳後的 click 會被吃掉，避免誤加入房間 */
    function cshBindSwipe(list) {
        if (!list || list._likoSwipeBound) return;
        list._likoSwipeBound = true;
        let suppressClick = false;

        list.addEventListener('click', e => {
            if (!suppressClick && !cshAnimating) return;
            e.preventDefault();
            e.stopImmediatePropagation();
        }, true);

        list.addEventListener('pointerdown', e => {
            if (cshAnimating) return;
            suppressClick = false;
            cshDrag = { startX: e.clientX, dx: 0, dragging: true };
        });

        list.addEventListener('pointermove', e => {
            if (!cshDrag?.dragging) return;
            const track = document.getElementById('liko-csh-shell')?._track;
            if (!track) return;

            let dx = e.clientX - cshDrag.startX;
            if (Math.abs(dx) > 10) suppressClick = true;
            const perPage    = Math.max(1, calcCshPerPage());
            const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
            if ((dx > 0 && cshPage <= 1) || (dx < 0 && cshPage >= totalPages)) dx *= 0.22;

            cshDrag.dx = dx;
            track.classList.remove('animating');
            track.style.transform = `translateX(${dx}px)`;
        }, { passive: true });

        const endDrag = e => {
            if (!cshDrag?.dragging) return;
            const track = document.getElementById('liko-csh-shell')?._track;
            if (!track) return;

            const dx = cshDrag.dx;
            cshDrag = null;
            if (e.type === 'pointercancel') {
                suppressClick = true;
                track.style.transform = 'translateX(0)';
                return;
            }

            const perPage    = Math.max(1, calcCshPerPage());
            const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
            const threshold  = Math.min(120, window.innerWidth * 0.20);

            if (dx >  threshold && cshPage > 1)          { commitPageTurn(track, cshPage - 1, 'translateX(100%)');  return; }
            if (dx < -threshold && cshPage < totalPages) { commitPageTurn(track, cshPage + 1, 'translateX(-100%)'); return; }

            track.classList.add('animating');
            track.style.transform = 'translateX(0)';
        };
        list.addEventListener('pointerup',     endDrag);
        list.addEventListener('pointercancel', endDrag);
    }

    // ── 房間詳情 bottom sheet ─────────────────────────────────────────────────

    function cshCloseRoomInfo() { document.getElementById('liko-csh-info-backdrop')?.remove(); }

    function cshShowRoomInfo(room) {
        cshCloseRoomInfo();

        const backdrop = document.createElement('div'); backdrop.id = 'liko-csh-info-backdrop';
        backdrop.addEventListener('click', cshCloseRoomInfo);
        // 擋掉 pointer 事件，否則會被下層的翻頁滑動接走
        for (const t of ['pointerdown', 'pointermove', 'pointerup']) backdrop.addEventListener(t, e => e.stopPropagation());

        const sheet = document.createElement('div'); sheet.id = 'liko-csh-info-sheet';
        sheet.addEventListener('click', e => e.stopPropagation());

        const handle = document.createElement('div'); handle.id = 'liko-csh-info-handle';
        sheet.appendChild(handle);

        const head  = document.createElement('div'); head.id = 'liko-csh-info-head';
        const main  = document.createElement('div'); main.id = 'liko-csh-info-main';
        const title = document.createElement('div'); title.id = 'liko-csh-info-title';
        title.textContent = room.Name || MPLT('room.unnamed');
        const ownerEl = document.createElement('div'); ownerEl.id = 'liko-csh-info-owner';
        ownerEl.textContent = room.Creator ? MPLT('room.by_prefix') + room.Creator : '';
        main.appendChild(title);
        main.appendChild(ownerEl);

        const closeBtn = document.createElement('button'); closeBtn.id = 'liko-csh-info-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', cshCloseRoomInfo);
        head.appendChild(main);
        head.appendChild(closeBtn);
        sheet.appendChild(head);

        const descEl = document.createElement('div'); descEl.id = 'liko-csh-info-desc';
        descEl.textContent = room.Description || MPLT('room_info.no_desc');
        sheet.appendChild(descEl);

        const tagsWrap = document.createElement('div'); tagsWrap.id = 'liko-csh-info-tags';
        for (const tagText of buildRoomTags(room)) {
            const tag = document.createElement('div'); tag.className = 'liko-csh-tag';
            tag.textContent = tagText;
            tagsWrap.appendChild(tag);
        }
        sheet.appendChild(tagsWrap);

        const people = getRoomRelations(room);
        if (people.length) {
            const peopleWrap = document.createElement('div'); peopleWrap.id = 'liko-csh-info-people';
            for (const p of people) {
                const row   = document.createElement('div'); row.className = 'liko-csh-info-person';
                const dot   = document.createElement('span'); dot.className = `liko-csh-rel-dot ${p.relation}`;
                const name  = document.createElement('span'); name.textContent = p.memberName;
                const label = document.createElement('span'); label.className = 'liko-csh-rel-label';
                i18nText(label, `rel.${p.relation}`);
                row.appendChild(dot);
                row.appendChild(name);
                row.appendChild(label);
                peopleWrap.appendChild(row);
            }
            sheet.appendChild(peopleWrap);
        }

        const footer  = document.createElement('div'); footer.id = 'liko-csh-info-footer';
        const members = document.createElement('div'); members.id = 'liko-csh-info-members';
        members.textContent = `${room.MemberCount ?? 0} / ${room.MemberLimit ?? '?'}`;

        const canJoin  = !!(room.CanJoin && (room.MemberCount ?? 0) < (room.MemberLimit ?? 999));
        const joinBtn2 = document.createElement('button'); joinBtn2.id = 'liko-csh-info-join';
        i18nText(joinBtn2, canJoin ? 'room_info.can_join' : 'room_info.cannot_join');
        if (!canJoin) joinBtn2.classList.add('disabled');
        joinBtn2.addEventListener('click', () => {
            if (!canJoin) return;
            cshCloseRoomInfo();
            joinSearchRoom(room);
        });

        footer.appendChild(members);
        footer.appendChild(joinBtn2);
        sheet.appendChild(footer);

        backdrop.appendChild(sheet);
        document.body.appendChild(backdrop);
    }

    function cshRemove() {
        cancelPageTurn();
        if (!cshActive) return;
        cshActive    = false;
        cshAnimating = false;
        cshDrag      = null;

        if (cshSyncTimer) clearTimeout(cshSyncTimer);
        cshSyncTimer = null;
        cshNeedSync  = false;
        cshCloseRoomInfo();
        clearCanvasStyle();
        removeStyle('liko-ml-csh-hide');
        removeStyle('liko-ml-csh');
        document.getElementById('liko-csh-shell')?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測（每幀由 DrawProcess hook 呼叫）
    // 依螢幕方向、BC 場景與 LCE 是否接管，決定啟用/關閉哪個直版模式
    // ════════════════════════════════════════════════════════════════════════════

    // 聊天室：直向，或鍵盤正佔用版面（鍵盤彈出的瞬間 innerWidth<innerHeight 仍可能暫時不成立）
    const wantCr  = () => (isPortrait() || isKeyboardLayoutLocked()) && !lceOwns('verticalChatRoom');
    const wantCsh = () => isPortrait() && !lceOwns('verticalChatSearch');
    const wantLogin = () => isPortrait() && !lceOwns('verticalLogin');

    function checkScene() {
        const scr       = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
        const hasDialog = typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;

        // 登入頁
        if (scr === 'Login' && wantLogin()) mplApply();
        else if (mplActive)                 mplRemove();

        const cr  = wantCr();
        const csh = wantCsh();

        // 聊天室與 Dialog 互斥
        if (cr && scr === 'ChatRoom' && hasDialog) {
            if (crActive) crRemove();
            if (!drActive) drApply();
        } else if (cr && scr === 'ChatRoom' && !hasDialog) {
            if (drActive) drRemove();
            if (!crActive) crApply();
        } else {
            if (crActive) crRemove();
            if (drActive) drRemove();
        }

        // ChatSearch 與 ChatSelect 互斥
        if (csh && scr === 'ChatSearch') {
            if (csActive) csRemove();
            if (!cshActive) cshApply();
        } else if (csh && scr === 'ChatSelect') {
            if (cshActive) cshRemove();
            if (!csActive) csApply();
        } else {
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
        }
    }

    /** 對外：目前直版狀態（與 LCE 的 Vertical.getState() 欄位一致，見 LCE docs/vertical-api.md） */
    const Vertical = Object.freeze({
        getState: () => ({
            version: 1,
            active: crActive || drActive || csActive || cshActive,
            mode: drActive ? 'dialog' : crActive ? 'chatroom' : cshActive ? 'search' : csActive ? 'select' : null,
            dialogRect: drActive ? getDialogRect() : null,
            keyboardLocked: isKeyboardLayoutLocked(),
        }),
    });

    // ════════════════════════════════════════════════════════════════════════════
    // BC 函數鉤子（Hooks）
    // ════════════════════════════════════════════════════════════════════════════

    hook('LoginResponse', 0, (args, next) => {
        const result = next(args);
        // 登入成功（回傳物件而非錯誤字串）才擷取快照；等角色外觀載完，拍到空白會自動重試
        if (args[0] && typeof args[0] === 'object') setTimeout(scheduleProfileCapture, 5000);
        return result;
    });

    hook('LoginLoad', 0, (args, next) => {
        const r = next(args);
        // LoginLoad 後 CurrentScreen 已是 Login，立刻檢查以免原生登入畫面閃現
        try { checkScene(); } catch (e) { console.warn(LOG, 'LoginLoad checkScene:', e); }
        return r;
    });

    hook('LoginUnload', 0, (args, next) => {
        mplRemove();
        return next(args);
    });

    hook('DialogLoad', 0, (args, next) => {
        const r = next(args);
        if (wantCr() && !drActive) drApply();
        return r;
    });

    hook('DialogLeave', 0, (args, next) => {
        const r = next(args);
        if (drActive) drRemove();
        return r;
    });

    // 新版 BC 已移除 ChatRoomTopMenuPosition；重套版面由 ChatRoomResize 與 resize 監聽承擔。
    // 鍵盤佔用版面時不讓 BC 重算整個 canvas，只更新聊天面板的 CSS 變數。
    hook('ChatRoomResize', 0, (args, next) => {
        if (isKeyboardLayoutLocked()) { crUpdateViewport(); return; }
        const r = next(args);
        crMaintain();
        return r;
    });

    hook('ChatRoomLeave', 0, (args, next) => {
        crRemove();
        return next(args);
    });

    hook('ChatSearchResultResponse', 0, (args, next) => {
        const r = next(args);
        if (cshActive) cshNeedSync = true;
        return r;
    });

    hook('ChatSearchRun', 0, (args, next) => {
        const r = next(args);
        cshSyncIfNeeded();
        return r;
    });

    // ChatSelectLoad / ChatSearchLoad 在 BC 裡是 async：要 await 完才能安全操作它建好的畫面
    hook('ChatSelectLoad', 0, async (args, next) => {
        const r = await next(args);
        if (CurrentScreen !== 'ChatSelect') return r;
        if (csActive) requestAnimationFrame(() => { if (csActive && CurrentScreen === 'ChatSelect') buildCsBg(); });
        return r;
    });

    hook('ChatSearchLoad', 0, async (args, next) => {
        const r = await next(args);
        if (CurrentScreen !== 'ChatSearch') return r;
        // 房間資料還會由 ChatSearchResultResponse 補上，這裡的延遲刷新只是保險
        if (cshActive) setTimeout(() => { if (cshActive && CurrentScreen === 'ChatSearch') renderCshList(); }, 600);
        return r;
    });

    hook('DrawProcess', 5, (args, next) => {
        const r = next(args);
        try {
            checkScene();
            if (crActive) crMaintain();
            if (drActive) drMaintain();
        } catch (e) { console.warn(LOG, 'DrawProcess:', e); }
        return r;
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 視窗尺寸事件
    // ════════════════════════════════════════════════════════════════════════════

    function handleResize() {
        if (crActive)  { if (!wantCr()) crRemove(); else crMaintain(); }
        if (drActive)  { drRemove(); if (wantCr()) drApply(); }
        if (csActive)  { csRemove(); if (wantCsh()) csApply(); }
        if (cshActive) { if (!wantCsh()) cshRemove(); else renderCshList(false); }
    }

    // 在一般 resize 監聽之前以 capture 攔截：鍵盤動畫期間每個中間尺寸都不該觸發 BC 整個 canvas 重算
    window.addEventListener('resize', e => {
        if (!isKeyboardLayoutLocked()) return;
        e.stopImmediatePropagation();
        crUpdateViewport();
    }, true);

    // 鍵盤改變 visual viewport 時只搬動聊天面板，不重算人物區基準高度
    window.visualViewport?.addEventListener('resize', crUpdateViewport);
    window.visualViewport?.addEventListener('scroll', crUpdateViewport);

    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
        if (isKeyboardLayoutLocked()) return;
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(handleResize, 120);
    });
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));

    // ════════════════════════════════════════════════════════════════════════════
    // MPL Login 登入頁直版模式
    // 儲存層與 LCE 共用（localStorage mpl_accounts、IndexedDB mpl-profiles v2），兩邊帳號互通。
    // 不可升級 DB 版本、不可改 mainKey 格式，否則會讓另一個插件讀不到資料。
    // ════════════════════════════════════════════════════════════════════════════

    const MPL_KEY       = 'mpl_accounts';
    const IDB_NAME      = 'mpl-profiles';
    const IDB_STORE     = 'profiles';
    const IDB_KEY_STORE = 'cryptokeys';
    const ACCOUNTS_UPDATED_EVENT = 'lce:accounts-updated';   // 與 LCE 同名，雙方互相刷新

    function getBgUrl() {
        const bg = typeof LoginBackground !== 'undefined' ? LoginBackground : 'Dressing';
        return BASE_URL + 'Backgrounds/' + bg + '.jpg';
    }

    // ── AES-GCM 加密工具 ───────────────────────────────────────────────────────

    const bufToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const b64ToBuf = b64 => {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
    };

    let _cryptoKeyPromise = null;

    /**
     * 取得（必要時建立）AES-GCM 金鑰。
     * 在 readwrite transaction 內重新檢查，同時開兩個分頁時會採用同一把金鑰，
     * 不會各自生成後互相蓋掉而讓已保存的密碼失效。寫入失敗會回報，不再用一把存不下來的金鑰繼續加密。
     */
    function getCryptoKey() {
        if (_cryptoKeyPromise) return _cryptoKeyPromise;
        const importKey = jwk => crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
        _cryptoKeyPromise = (async () => {
            const db = await openDB();
            const existing = await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE).objectStore(IDB_KEY_STORE).get('mainKey');
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            });
            if (existing?.key) return importKey(existing.key);

            const candidate = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
            const exported  = await crypto.subtle.exportKey('jwk', candidate);
            const winnerJwk = await new Promise((resolve, reject) => {
                const tx    = db.transaction(IDB_KEY_STORE, 'readwrite');
                const store = tx.objectStore(IDB_KEY_STORE);
                let result  = exported;
                const get   = store.get('mainKey');
                get.onsuccess = () => {
                    if (get.result?.key) result = get.result.key;
                    else store.put({ id: 'mainKey', key: exported });
                };
                tx.oncomplete = () => resolve(result);
                tx.onerror = tx.onabort = () => reject(tx.error || new Error('key store write failed'));
            });
            return importKey(winnerJwk);
        })().catch(e => { _cryptoKeyPromise = null; return Promise.reject(e); });
        return _cryptoKeyPromise;
    }

    async function encryptPassword(plaintext) {
        const key    = await getCryptoKey();
        const iv     = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
        return bufToB64(iv.buffer) + ':' + bufToB64(cipher);
    }

    async function decryptPassword(stored) {
        try {
            const key = await getCryptoKey();
            const [ivB64, cipherB64] = stored.split(':');
            const plain = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) }, key, b64ToBuf(cipherB64));
            return new TextDecoder().decode(plain);
        } catch (e) {
            console.warn(LOG, '解密失敗:', e);
            return null;
        }
    }

    // ── IndexedDB（角色快照 + 密鑰）──────────────────────────────────────────

    let _db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const req = indexedDB.open(IDB_NAME, 2);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE))     db.createObjectStore(IDB_STORE,     { keyPath: 'accountName' });
                if (!db.objectStoreNames.contains(IDB_KEY_STORE)) db.createObjectStore(IDB_KEY_STORE, { keyPath: 'id' });
            };
            req.onsuccess = e => {
                _db = e.target.result;
                // 另一個分頁／插件要升版時主動讓路，並在下次使用時重新開啟
                _db.onversionchange = () => { _db.close(); _db = null; };
                resolve(_db);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function dbGet(accountName) {
        try {
            const db = await openDB();
            return await new Promise(resolve => {
                const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(accountName);
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            });
        } catch { return null; }
    }

    /** 以 transaction 完成作為成功依據（request 的 onsuccess 只代表排入，不代表已提交） */
    async function dbPut(profile) {
        try {
            const db = await openDB();
            return await new Promise(resolve => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).put(profile);
                tx.oncomplete = () => resolve(true);
                tx.onerror = tx.onabort = () => resolve(false);
            });
        } catch { return false; }
    }

    async function dbDelete(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return false;
        try {
            const db = await openDB();
            return await new Promise(resolve => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.objectStore(IDB_STORE).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = tx.onabort = () => resolve(false);
            });
        } catch { return false; }
    }

    // ── localStorage（帳號列表）───────────────────────────────────────────────

    function loadAccounts() {
        try { const list = JSON.parse(localStorage.getItem(MPL_KEY) || '[]'); return Array.isArray(list) ? list : []; }
        catch { return []; }
    }

    function saveAccounts(list) { localStorage.setItem(MPL_KEY, JSON.stringify(list)); }

    async function addOrUpdateAccount(accountName, plainPassword) {
        const key       = accountName.toUpperCase();
        const encrypted = await encryptPassword(plainPassword);
        const list      = loadAccounts();
        const idx       = list.findIndex(a => a.accountName === key);
        if (idx >= 0) list[idx].password = encrypted;
        else list.push({ accountName: key, password: encrypted, addedAt: Date.now() });
        saveAccounts(list);
        return key;
    }

    function removeAccount(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return;
        saveAccounts(loadAccounts().filter(a => a.accountName !== key));
    }

    // ── 角色快照（頭像 + 暱稱 + ID）──────────────────────────────────────────

    /**
     * 一張拍成功的頭像至少該有這麼多位元組。
     * 角色外觀沒載完時 Player.Canvas 有尺寸但內容空白，toDataURL 仍會回傳正常外觀的資料；
     * 而 WebP 對純色壓縮率極高，空白圖會明顯小於真正的頭像，用大小判斷「有沒有東西」最簡單。
     */
    const MIN_AVATAR_BYTES = 900;

    /** @returns {Promise<Blob|null>} WebP 頭像；拍不到或拍到空白時回傳 null */
    async function makeAvatarBlob(size = 56) {
        try {
            const src = Player?.Canvas;
            if (!src?.width || !src?.height) return null;
            const off = document.createElement('canvas');
            off.width = size; off.height = size;
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#0a0c12';
            ctx.fillRect(0, 0, size, size);
            const cropSize = 210;
            ctx.drawImage(src, src.width / 2 - cropSize / 2, 740, cropSize, cropSize, 0, 0, size, size);
            const blob = await new Promise(resolve => off.toBlob(resolve, 'image/webp', 0.9));
            return blob?.size >= MIN_AVATAR_BYTES ? blob : null;
        } catch { return null; }
    }

    /**
     * 存一次角色快照。
     * 拍不到頭像就沿用上一張，絕不把 null 寫回去洗掉已存在的好資料。
     * @returns {Promise<boolean>} 這次有沒有拍到新頭像
     */
    async function captureAndSaveProfile() {
        try {
            if (typeof Player === 'undefined' || !Player?.AccountName) return false;
            const accountName = Player.AccountName.toUpperCase();
            const avatarBlob  = await makeAvatarBlob(56);
            const prev        = avatarBlob ? null : await dbGet(accountName);

            const saved = await dbPut({
                accountName,
                name:         Player.Name         || '',
                nickname:     Player.Nickname     || null,
                memberNumber: Player.MemberNumber ?? null,
                avatarBlob:   avatarBlob ?? prev?.avatarBlob ?? null,
                // 舊版以 base64 data URL 儲存；保留讀取相容性，拍到 Blob 後不再複製
                avatarDataUrl: avatarBlob ? null : (prev?.avatarDataUrl ?? null),
                savedAt:      Date.now(),
            });
            if (!saved) return false;
            window.dispatchEvent(new CustomEvent(ACCOUNTS_UPDATED_EVENT));
            return !!avatarBlob;
        } catch (e) {
            console.warn(LOG, '快照失敗:', e);
            return false;
        }
    }

    /** 拍到好的為止，最多試 tries 次；每一輪都會順手更新名稱／暱稱／ID */
    function scheduleProfileCapture({ tries = 6, intervalMs = 5000 } = {}) {
        let attempt = 0;
        (function tryOnce() {
            attempt++;
            captureAndSaveProfile().then(gotAvatar => {
                if (gotAvatar || attempt >= tries) return;
                setTimeout(tryOnce, intervalMs);
            });
        })();
    }

    // ── BC DOM 隱藏 / 還原 ────────────────────────────────────────────────────

    const BC_HIDE_IDS = [
        'InputName', 'InputPassword',
        'login-name-label', 'login-password-label',
        'login-welcome-message', 'login-status',
        'login-login-button', 'login-new-character-label',
        'login-register-button', 'login-password-reset-button',
        'login-password-reset-hint', 'login-cheats-button',
        'login-footer', 'LanguageDropdown',
    ];

    // 需要維持可見的外掛管理器（FUSAM / PCM）
    const BC_PASSTHROUGH_IDS = [
        'fusam-show-button', 'fusam-addon-manager-container',
        'bc-plugin-btn-group', 'bc-plugin-panel', 'pcm-fusam-modal-root',
    ];

    // Themed-BC 在登入頁加的 HTML 元素，MPL 登入模式下遮蔽
    const THIRD_PARTY_HIDE_CSS = '#tmd-login-options-open,#tmd-login-options-dialog{display:none !important}';

    /**
     * 外掛管理器常駐置頂規則。
     * 管理器面板是「點開才建立」的；用 CSS 規則（而非 inline style + MutationObserver）
     * 才能涵蓋之後才建立、甚至被重建的元素，不受建立時序影響。
     */
    function ensureAddonManagersVisible() {
        injectStyle('mpl-addon-manager-top',
            `${BC_PASSTHROUGH_IDS.map(id => `#${id}`).join(',')}{z-index:${Z.FUSAM} !important}`);
    }

    function hideBC() {
        BC_HIDE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', 'none', 'important');
        });
        getCanvas()?.style.setProperty('display', 'none', 'important');
        injectStyle('mpl-hide-thirdparty', THIRD_PARTY_HIDE_CSS);
        // 手機上把 FUSAM 管理器縮成可操作的尺寸（只在 MPL 登入模式期間套用）
        injectStyle('mpl-fusam-mobile', `
            #fusam-addon-manager-container {
                position:fixed !important; top:10vh !important; left:4vw !important;
                width:92vw !important; height:80vh !important;
                max-width:92vw !important; max-height:80vh !important;
                font-size:10px !important; border-radius:12px !important; overflow:hidden !important;
            }
            #fusam-show-button { position:fixed !important; pointer-events:auto !important }
        `);
        ensureAddonManagersVisible();
    }

    /** 還原 BC 原生登入 UI。外掛管理器置頂規則是常駐的，故意不移除 */
    function showBC() {
        BC_HIDE_IDS.forEach(id => document.getElementById(id)?.style.removeProperty('display'));
        getCanvas()?.style.removeProperty('display');
        removeStyle('mpl-hide-thirdparty');
        removeStyle('mpl-fusam-mobile');
    }

    // ── 登入頁樣式 ────────────────────────────────────────────────────────────

    function injectLoginStyles() {
        if (document.getElementById('mpl-styles')) return;
        const s = document.createElement('style');
        s.id = 'mpl-styles';
        s.textContent = `
/* ══ MPL Login UI ══════════════════════════════════════════════════════════ */
#mpl-bg { position:fixed; inset:0; z-index:${Z.LOGIN}; background:#0a0c12; overflow:hidden; }
#mpl-bg-img {
    position:absolute; top:0; left:-150%; width:400%; height:100%;
    object-fit:cover; object-position:top left; pointer-events:none;
}
#mpl-bg-overlay  { position:absolute; inset:0; background:rgba(0,0,0,0.38); pointer-events:none; }
#mpl-bg-fallback {
    position:absolute; inset:0;
    background-image:
        radial-gradient(ellipse at 30% 60%,rgba(90,50,140,0.38) 0%,transparent 55%),
        radial-gradient(ellipse at 75% 40%,rgba(140,70,100,0.28) 0%,transparent 50%),
        linear-gradient(180deg,#1a1225 0%,#251530 60%,#1e1028 100%);
    pointer-events:none;
}
#mpl-root {
    position:absolute; inset:0;
    display:flex; flex-direction:column; align-items:center; justify-content:space-between;
    pointer-events:none;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;
}
#mpl-root > * { pointer-events:auto; }
#mpl-top {
    width:100%; padding:30px 24px 5px; text-align:center;
    background:linear-gradient(180deg,rgba(0,0,0,0.55) 0%,transparent 100%);
}
#mpl-title { font-size:28px; font-weight:700; color:#e8dcff; letter-spacing:2px; text-shadow:0 0 24px rgba(167,139,250,0.50); }
#mpl-status { margin-top:10px; font-size:19px; color:rgba(200,185,255,0.80); min-height:26px; text-shadow:0 1px 8px rgba(0,0,0,0.8); }
#mpl-status.error { color:rgba(255,120,120,0.95); }
#mpl-accounts-section { width:100%; max-width:560px; padding:0 20px; }
#mpl-accounts-row {
    display:flex; gap:14px; overflow-x:auto; overflow-y:visible; scrollbar-width:none;
    padding:16px 50px 20px; cursor:grab; user-select:none; justify-content:flex-start;
    perspective:600px; perspective-origin:50% 50%;
}
#mpl-accounts-row:active { cursor:grabbing; }
#mpl-accounts-row::-webkit-scrollbar { display:none; }
.mpl-acct-card {
    flex-shrink:0; width:84px; border-radius:13px;
    border:1.5px solid rgba(200,180,255,0.25); background:rgba(20,14,36,0.68);
    backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
    padding:7px 8px 8px; display:flex; flex-direction:column; align-items:center; gap:4px;
    cursor:pointer; position:relative; user-select:none;
    transition:border-color .22s,background .22s,transform .35s cubic-bezier(0.25,0.8,0.25,1),box-shadow .35s,opacity .35s;
    transform-style:preserve-3d; will-change:transform,opacity; transform-origin:center center;
}
.mpl-acct-card:hover  { border-color:rgba(200,180,255,0.55); }
.mpl-acct-card.active { border-color:rgba(200,170,255,0.80); background:rgba(127,83,205,0.22); box-shadow:0 4px 18px rgba(127,83,205,0.35); }
.mpl-acct-ghost { flex-shrink:0; width:84px; pointer-events:none; visibility:hidden; }
.mpl-acct-top-label {
    font-size:10px; font-weight:600; color:rgba(200,185,255,0.70); text-align:center; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; width:100%; letter-spacing:0.3px; line-height:1.2;
}
.mpl-avatar {
    width:42px; height:42px; border-radius:9px; background:rgba(127,83,205,0.22);
    border:1px solid rgba(200,180,255,0.25); overflow:hidden; display:flex; align-items:center; justify-content:center;
}
.mpl-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
.mpl-avatar-ph { font-size:20px; }
.mpl-acct-name { font-size:16px; font-weight:600; color:#ddd5f8; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; }
.mpl-acct-id  { font-size:15px; color:rgba(190,175,225,0.55); text-align:center; }
.mpl-acct-del {
    position:absolute; top:5px; right:5px; width:16px; height:16px; border-radius:4px;
    background:rgba(239,68,68,0.12); border:0.5px solid rgba(239,68,68,0.30);
    color:rgba(255,130,130,0.75); font-size:8px; display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:background .12s; z-index:2;
}
.mpl-acct-del:hover { background:rgba(239,68,68,0.30); }
#mpl-form-section { max-width:420px; padding:0; display:flex; flex-direction:column; gap:10px; align-items:center; }
.mpl-field { display:flex; flex-direction:row; align-items:center; gap:40px; width:100%; }
.mpl-field-label {
    font-size:20px; color:rgba(210,195,245,0.75); text-shadow:0 1px 6px rgba(0,0,0,0.7);
    white-space:nowrap; flex-shrink:0; width:48px; text-align:left; text-overflow:ellipsis;
}
.mpl-input {
    background:#ffffff; border:1.5px solid rgba(200,180,255,0.35); border-radius:11px;
    color:#1a1a2e; -webkit-text-fill-color:#1a1a2e; padding:5px 15px; font-size:21px; font-family:inherit;
    outline:none; transition:border-color .15s,box-shadow .15s; flex:0 0 220px; width:220px;
}
.mpl-input:focus { border-color:rgba(127,83,205,0.70); box-shadow:0 0 0 3px rgba(127,83,205,0.15); }
.mpl-input::placeholder { color:rgba(100,90,130,0.55); -webkit-text-fill-color:rgba(100,90,130,0.55); }
/* 密碼欄不用 type=password：避免瀏覽器跳出「記住密碼」。外觀同為圓點 */
.mpl-input.mpl-masked { -webkit-text-security:disc; }
#mpl-btn-row { width:80%; max-width:420px; padding:0; display:flex; flex-direction:column; gap:8px; align-items:stretch; margin-top:10px; }
#mpl-btn-login {
    width:100%; padding:10px; background:rgba(127,83,205,0.30); border:1.5px solid rgba(200,170,255,0.55);
    border-radius:12px; color:#e8dcff; font-size:21px; font-weight:700; font-family:inherit;
    cursor:pointer; transition:background .15s; text-shadow:0 0 12px rgba(167,139,250,0.4);
}
#mpl-btn-login:hover    { background:rgba(127,83,205,0.48); }
#mpl-btn-login:disabled { opacity:0.40; cursor:default; }
#mpl-btn-row-secondary  { display:flex; gap:10px; width:100%; }
#mpl-btn-save-acct, #mpl-btn-reset {
    flex:1; min-width:0; padding:10px; background:rgba(14,10,28,0.55); backdrop-filter:blur(8px);
    border:1.5px solid rgba(200,180,255,0.35); border-radius:12px; color:rgba(220,210,245,0.85);
    font-size:13px; font-family:inherit; cursor:pointer; transition:background .15s,border-color .15s; white-space:nowrap;
}
#mpl-btn-save-acct:hover, #mpl-btn-reset:hover { background:rgba(127,83,205,0.22); border-color:rgba(200,170,255,0.55); }
#mpl-privacy-note { font-size:13px; color:rgba(180,170,210,0.45); text-align:center; letter-spacing:0.5px; margin-top:1px; }
#mpl-register-section { width:100%; max-width:420px; padding:0 24px; display:flex; flex-direction:column; gap:9px; align-items:center; }
.mpl-divider { display:flex; align-items:center; gap:10px; width:70%; }
.mpl-div-line { flex:1; height:0.5px; background:rgba(200,185,230,0.15); }
.mpl-div-text { font-size:17px; color:rgba(200,185,230,0.45); }
#mpl-btn-register {
    width:80%; padding:10px; background:rgba(14,10,28,0.55); backdrop-filter:blur(8px);
    border:1.5px solid rgba(200,180,255,0.28); border-radius:12px; color:rgba(220,210,245,0.85);
    font-size:18px; font-family:inherit; cursor:pointer; transition:background .15s,border-color .15s;
}
#mpl-btn-register:hover { background:rgba(127,83,205,0.18); border-color:rgba(200,170,255,0.50); }
#mpl-bottom {
    width:100%; padding:10px 20px 30px; background:linear-gradient(0deg,rgba(0,0,0,0.55) 0%,transparent 100%);
    display:flex; flex-direction:column; gap:20px; align-items:center;
}
#mpl-bottom-controls { width:100%; max-width:560px; display:flex; align-items:center; justify-content:center; gap:10px; }
#mpl-lang-select {
    background:rgba(14,10,28,0.72); border:1px solid rgba(200,180,255,0.28); border-radius:8px;
    color:rgba(220,210,245,0.85); font-size:17px; padding:7px 20px 7px 10px; font-family:inherit; cursor:pointer;
    flex-shrink:0; appearance:auto; -webkit-appearance:auto;
}
#mpl-settings-btn {
    height:38px; padding:0 18px; border-radius:9px; background:rgba(14,10,28,0.72);
    border:1px solid rgba(200,180,255,0.28); color:rgba(220,210,245,0.85); font-size:17px; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:5px; cursor:pointer;
    transition:background .15s; flex-shrink:0; white-space:nowrap;
}
#mpl-settings-btn:hover { background:rgba(127,83,205,0.28); border-color:rgba(200,170,255,0.50); }
#mpl-marquee-wrap {
    width:100%; max-width:560px; overflow:hidden; height:22px;
    mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
    -webkit-mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
}
#mpl-marquee-inner { display:flex; gap:28px; position:relative; will-change:transform; white-space:nowrap; }
.mpl-marquee-item { font-size:17px; color:rgba(200,185,230,0.40); white-space:nowrap; flex-shrink:0; }
.mpl-marquee-item span { color:rgba(200,180,255,0.65); }
#mpl-settings-overlay {
    display:none; position:absolute; inset:0; z-index:20; background:rgba(0,0,0,0.60);
    backdrop-filter:blur(4px); align-items:center; justify-content:center;
}
#mpl-settings-overlay.visible { display:flex; }
#mpl-settings-box {
    background:rgba(14,10,26,0.96); border:1px solid rgba(200,180,255,0.28); border-radius:16px;
    padding:20px; width:min(290px,88vw); display:flex; flex-direction:column; gap:13px;
    box-shadow:0 16px 40px rgba(0,0,0,0.5);
}
.mpl-sett-title { font-size:20px; font-weight:600; color:#ddd5f8; }
.mpl-sett-row { display:flex; align-items:center; justify-content:space-between; font-size:19px; color:rgba(210,195,240,0.85); }
.mpl-sett-row input[type=checkbox] { accent-color:#7F53CD; cursor:pointer; width:18px; height:18px; }
.mpl-sett-close {
    width:100%; padding:9px; background:rgba(127,83,205,0.18); border:1px solid rgba(200,170,255,0.35);
    border-radius:9px; color:#c4b5fd; font-size:19px; font-family:inherit; cursor:pointer;
}
        `;
        document.head.appendChild(s);
    }

    // ── 狀態字串同步 ──────────────────────────────────────────────────────────

    let _lastStatusMsg   = null;
    let _lastStatusError = null;

    function syncStatus() {
        const el = document.getElementById('mpl-status');
        if (!el) return;
        const bcText = k => (typeof TextGet === 'function' ? TextGet(k) : '');

        let msg = '', isError = false;
        if (typeof LoginErrorMessage !== 'undefined' && LoginErrorMessage) {
            msg     = bcText(LoginErrorMessage) || LoginErrorMessage;
            isError = true;
        } else if (typeof ServerIsConnected !== 'undefined' && !ServerIsConnected) {
            msg = bcText('ConnectingToServer') || MPLT('login.enter_hint');
        } else if (typeof LoginQueuePosition !== 'undefined' && LoginQueuePosition !== -1) {
            const tmpl = bcText('LoginQueueWait') || 'Queue: QUEUE_POS';
            msg = tmpl.replace('QUEUE_POS', String(LoginQueuePosition));
        } else if (typeof LoginSubmitted !== 'undefined' && LoginSubmitted) {
            msg = bcText('ValidatingNamePassword') || '...';
        } else {
            msg = bcText('EnterNamePassword') || MPLT('login.enter_hint');
        }

        if (msg !== _lastStatusMsg || isError !== _lastStatusError) {
            _lastStatusMsg   = msg;
            _lastStatusError = isError;
            el.textContent   = msg;
            el.classList.toggle('error', isError);
        }

        const loginBtn = document.getElementById('mpl-btn-login');
        if (loginBtn) {
            const canLogin = (typeof ServerIsConnected !== 'undefined' ? ServerIsConnected : true)
                && !(typeof LoginSubmitted !== 'undefined' && LoginSubmitted);
            if (loginBtn.disabled === canLogin) loginBtn.disabled = !canLogin;
        }
    }

    // ── DOM 建構 ──────────────────────────────────────────────────────────────

    let mplBg        = null;
    let mplActive    = false;
    let selectedIdx  = null;
    let settingsOpen = false;

    let marqueeRAF   = null;
    let marqueePosX  = 0;
    let marqueeLastT = null;
    let marqueeHalfW = 0;
    const MARQUEE_SPEED = 28; // px/s

    function getThankYouList() {
        return (typeof LoginThankYouList !== 'undefined' && Array.isArray(LoginThankYouList)) ? LoginThankYouList : [];
    }

    function buildUI() {
        if (document.getElementById('mpl-bg')) return;

        mplBg = document.createElement('div'); mplBg.id = 'mpl-bg';

        const bgImg      = document.createElement('img');  bgImg.id = 'mpl-bg-img'; bgImg.alt = '';
        bgImg.onerror    = () => { bgImg.style.display = 'none'; };
        bgImg.src        = getBgUrl();
        const bgOverlay  = document.createElement('div'); bgOverlay.id  = 'mpl-bg-overlay';
        const bgFallback = document.createElement('div'); bgFallback.id = 'mpl-bg-fallback';
        mplBg.appendChild(bgFallback);
        mplBg.appendChild(bgImg);
        mplBg.appendChild(bgOverlay);

        // 設定浮層
        const settOverlay = document.createElement('div'); settOverlay.id = 'mpl-settings-overlay';
        const settBox     = document.createElement('div'); settBox.id     = 'mpl-settings-box';
        const settTitle = document.createElement('div'); settTitle.className = 'mpl-sett-title';
        i18nText(settTitle, 'settings.title');

        const mkSettRow = (labelKey, checkboxId) => {
            const row   = document.createElement('div'); row.className = 'mpl-sett-row';
            const label = document.createElement('span');
            i18nText(label, labelKey);
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = checkboxId; cb.checked = true;
            row.appendChild(label); row.appendChild(cb);
            return row;
        };

        const settClose = document.createElement('button'); settClose.className = 'mpl-sett-close';
        settClose.id = 'mpl-sett-close-btn';
        i18nText(settClose, 'settings.close');

        settBox.appendChild(settTitle);
        settBox.appendChild(mkSettRow('settings.marquee', 'mpl-sett-marquee'));
        settBox.appendChild(mkSettRow('settings.accts',   'mpl-sett-accts'));
        settBox.appendChild(settClose);
        settOverlay.appendChild(settBox);
        settOverlay.addEventListener('click', e => { if (e.target === settOverlay) closeSettings(); });
        mplBg.appendChild(settOverlay);

        const root = document.createElement('div'); root.id = 'mpl-root';

        // 頂部
        const top = document.createElement('div'); top.id = 'mpl-top';
        const titleEl  = document.createElement('div'); titleEl.id = 'mpl-title'; titleEl.textContent = 'Bondage Club';
        const statusEl = document.createElement('div'); statusEl.id = 'mpl-status';
        top.appendChild(titleEl); top.appendChild(statusEl);
        root.appendChild(top);

        // 帳號卡片列
        const acctSection = document.createElement('div'); acctSection.id = 'mpl-accounts-section';
        const acctRow     = document.createElement('div'); acctRow.id = 'mpl-accounts-row';
        acctSection.appendChild(acctRow);
        root.appendChild(acctSection);

        // 主表單
        const formSection = document.createElement('div'); formSection.id = 'mpl-form-section';
        const maskable = typeof CSS !== 'undefined' && CSS.supports?.('-webkit-text-security', 'disc');

        const mkField = (labelKey, inputId, inputType, placeholderKey, autocomplete, enterkeyhint, masked) => {
            const field = document.createElement('div'); field.className = 'mpl-field';
            const label = document.createElement('div'); label.className = 'mpl-field-label';
            i18nText(label, labelKey);
            const input = document.createElement('input');
            input.className = 'mpl-input'; input.id = inputId;
            // 密碼欄在支援 text-security 時改用 text + 遮罩，避免瀏覽器的「記住密碼」提示；
            // 不支援就退回 type=password，寧可跳提示也不能讓密碼裸奔
            input.type = masked ? (maskable ? 'text' : 'password') : inputType;
            if (masked && maskable) input.classList.add('mpl-masked');
            i18nAttr(input, 'placeholder', placeholderKey);
            input.autocomplete = autocomplete; input.setAttribute('enterkeyhint', enterkeyhint);
            if (masked) {
                input.spellcheck = false;
                input.setAttribute('autocapitalize', 'off');
                input.setAttribute('autocorrect', 'off');
            }
            field.appendChild(label); field.appendChild(input);
            return field;
        };

        formSection.appendChild(mkField('login.label_username', 'mpl-input-name', 'text', 'login.placeholder_user', 'off', 'next', false));
        formSection.appendChild(mkField('login.label_password', 'mpl-input-pass', 'password', 'login.placeholder_pass', 'off', 'go', true));
        root.appendChild(formSection);

        // 按鈕列
        const btnRow = document.createElement('div'); btnRow.id = 'mpl-btn-row';
        const loginBtn = document.createElement('button'); loginBtn.id = 'mpl-btn-login';
        i18nText(loginBtn, 'login.btn_login');

        const btnRowSec = document.createElement('div'); btnRowSec.id = 'mpl-btn-row-secondary';
        const saveBtn   = document.createElement('button'); saveBtn.id = 'mpl-btn-save-acct';
        i18nText(saveBtn, 'login.btn_save_acct');
        const resetBtn  = document.createElement('button'); resetBtn.id = 'mpl-btn-reset';
        i18nText(resetBtn, 'login.btn_reset');
        btnRowSec.appendChild(saveBtn); btnRowSec.appendChild(resetBtn);

        const privacyNote = document.createElement('div'); privacyNote.id = 'mpl-privacy-note';
        i18nText(privacyNote, 'login.privacy_note');

        btnRow.appendChild(loginBtn); btnRow.appendChild(btnRowSec); btnRow.appendChild(privacyNote);
        root.appendChild(btnRow);

        // 建立角色
        const regSection = document.createElement('div'); regSection.id = 'mpl-register-section';
        const divider    = document.createElement('div'); divider.className = 'mpl-divider';
        const divLine1   = document.createElement('div'); divLine1.className = 'mpl-div-line';
        const divText    = document.createElement('span'); divText.className = 'mpl-div-text';
        i18nText(divText, 'login.or_divider');
        const divLine2   = document.createElement('div'); divLine2.className = 'mpl-div-line';
        divider.appendChild(divLine1); divider.appendChild(divText); divider.appendChild(divLine2);

        const regBtn = document.createElement('button'); regBtn.id = 'mpl-btn-register';
        i18nText(regBtn, 'login.btn_register');
        regSection.appendChild(divider); regSection.appendChild(regBtn);
        root.appendChild(regSection);

        // 底部
        const bottom      = document.createElement('div'); bottom.id = 'mpl-bottom';
        const bottomCtrl  = document.createElement('div'); bottomCtrl.id = 'mpl-bottom-controls';
        const langSel     = document.createElement('select'); langSel.id = 'mpl-lang-select';
        const settingsBtn = document.createElement('button'); settingsBtn.id = 'mpl-settings-btn';
        i18nText(settingsBtn, 'login.settings_btn');
        bottomCtrl.appendChild(langSel); bottomCtrl.appendChild(settingsBtn);

        const marqueeWrap  = document.createElement('div'); marqueeWrap.id = 'mpl-marquee-wrap';
        const marqueeInner = document.createElement('div'); marqueeInner.id = 'mpl-marquee-inner';
        marqueeWrap.appendChild(marqueeInner);

        bottom.appendChild(bottomCtrl); bottom.appendChild(marqueeWrap);
        root.appendChild(bottom);

        mplBg.appendChild(root);
        document.body.appendChild(mplBg);

        bindLoginEvents();
        buildLanguageSelect();
        buildMarquee();
        mplRefreshAccountRow();
        syncStatus();
    }

    // ── 事件綁定 ──────────────────────────────────────────────────────────────

    function bindLoginEvents() {
        // isComposing：輸入法選字時按 Enter 不該觸發跳欄／登入
        document.getElementById('mpl-input-name').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) document.getElementById('mpl-input-pass').focus();
        });
        document.getElementById('mpl-input-pass').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.isComposing) doLogin();
        });

        document.getElementById('mpl-btn-login').addEventListener('click', doLogin);

        document.getElementById('mpl-btn-save-acct').addEventListener('click', async () => {
            const name = document.getElementById('mpl-input-name')?.value.trim();
            const pass = document.getElementById('mpl-input-pass')?.value;
            if (!name || !pass) return;
            try {
                const key      = await addOrUpdateAccount(name, pass);
                const newIdx   = loadAccounts().findIndex(a => a.accountName === key);
                if (newIdx >= 0) selectedIdx = newIdx;
                mplRefreshAccountRow();
            } catch (e) {
                console.warn(LOG, '保存帳號失敗:', e);
            }
        });

        document.getElementById('mpl-btn-reset').addEventListener('click', () => {
            if (typeof CommonSetScreen === 'function') CommonSetScreen('Character', 'PasswordReset');
        });

        document.getElementById('mpl-btn-register').addEventListener('click', () => {
            if (typeof DisclaimerOpen === 'function') {
                DisclaimerOpen(accepted => {
                    if (!accepted) { window.location.reload(); return; }
                    if (typeof CharacterCreatePlayer === 'function') CharacterCreatePlayer();
                    if (typeof InventoryRemove === 'function') {
                        InventoryRemove(Player, 'ItemFeet');
                        InventoryRemove(Player, 'ItemLegs');
                        InventoryRemove(Player, 'ItemArms');
                    }
                    if (typeof CharacterAppearanceSetDefault === 'function') CharacterAppearanceSetDefault(Player);
                    if (typeof CharacterAppearanceLoadCharacter === 'function')
                        CharacterAppearanceLoadCharacter(Player, r => CommonSetScreen('Character', r ? 'Creation' : 'Login'));
                });
            }
        });

        document.getElementById('mpl-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('mpl-sett-close-btn').addEventListener('click', closeSettings);

        // 語言切換：優先透過原生 dropdown 觸發 BC 的完整切換流程（含翻譯載入）
        document.getElementById('mpl-lang-select').addEventListener('change', function () {
            const code   = this.value;
            const langEl = document.getElementById('LanguageDropdown');
            if (langEl) {
                if (langEl.value !== code) {
                    langEl.value = code;
                    langEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (typeof TranslationSwitchLanguage === 'function') {
                TranslationSwitchLanguage(code || 'EN');
                if (typeof TextLoad === 'function')               TextLoad();
                if (typeof ActivityDictionaryLoad === 'function') ActivityDictionaryLoad();
                if (typeof AssetLoadDescription === 'function')   AssetLoadDescription('Female3DCG');
            }
            setTimeout(() => { _lastStatusMsg = null; syncStatus(); refreshAllI18n(); }, 100);
        });

        document.getElementById('mpl-sett-marquee').addEventListener('change', function () {
            document.getElementById('mpl-marquee-wrap').style.display = this.checked ? '' : 'none';
        });
        document.getElementById('mpl-sett-accts').addEventListener('change', function () {
            document.getElementById('mpl-accounts-section').style.display = this.checked ? '' : 'none';
        });

        initRowDrag();
    }

    // ── Coverflow 3D 旋轉效果 ─────────────────────────────────────────────────

    function updateCoverflowTransforms() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        const cards = row.querySelectorAll('.mpl-acct-card:not(.mpl-acct-ghost)');
        if (!cards.length) return;
        const rowRect   = row.getBoundingClientRect();
        const rowCenter = rowRect.left + rowRect.width / 2;

        cards.forEach(card => {
            const rect   = card.getBoundingClientRect();
            const dist   = rect.left + rect.width / 2 - rowCenter;
            const t      = Math.min(Math.abs(dist) / (rowRect.width * 0.55), 1);
            const rotY   = dist > 0 ? -35 * t : 35 * t;
            const scale  = 1 - 0.22 * t;
            const tx     = dist > 0 ? -12 * t : 12 * t;
            card.style.transform = `translateX(${tx}px) scale(${scale}) rotateY(${rotY}deg)`;
            card.style.opacity   = 1 - 0.40 * t;
            card.style.zIndex    = Math.round((1 - t) * 10);
        });
    }

    function initRowDrag() {
        const el = document.getElementById('mpl-accounts-row');
        if (!el) return;
        let isDown = false, startX = 0, scrollLeft = 0;

        el.addEventListener('scroll',    updateCoverflowTransforms, { passive: true });
        el.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
        el.addEventListener('mouseleave', () => { isDown = false; });
        el.addEventListener('mouseup',    () => { isDown = false; });
        el.addEventListener('mousemove',  e => {
            if (!isDown) return;
            e.preventDefault();
            el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX);
        });
        el.addEventListener('touchstart', e => { startX = e.touches[0].pageX - el.offsetLeft; scrollLeft = el.scrollLeft; }, { passive: true });
        el.addEventListener('touchmove',  e => { el.scrollLeft = scrollLeft - (e.touches[0].pageX - el.offsetLeft - startX); }, { passive: true });

        requestAnimationFrame(updateCoverflowTransforms);
        window.addEventListener('resize', updateCoverflowTransforms);
    }

    function buildLanguageSelect() {
        const sel = document.getElementById('mpl-lang-select');
        if (!sel) return;
        sel.innerHTML = '';
        const currentLang = localStorage.getItem('BondageClubLanguage') || 'EN';

        const bcDropdown = document.getElementById('LanguageDropdown');
        if (bcDropdown && bcDropdown.options.length > 0) {
            Array.from(bcDropdown.options).forEach(bcOpt => {
                const opt = document.createElement('option');
                opt.value = bcOpt.value; opt.textContent = bcOpt.textContent;
                opt.selected = bcOpt.value === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        if (typeof TranslationDictionary !== 'undefined' && Array.isArray(TranslationDictionary)) {
            TranslationDictionary.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.LanguageCode;
                opt.textContent = (l.Icon ? l.Icon + ' ' : '') + (l.LanguageName || l.EnglishName || l.LanguageCode);
                opt.selected = l.LanguageCode === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        const fallback = document.createElement('option');
        fallback.value = 'EN'; fallback.textContent = 'English'; fallback.selected = currentLang === 'EN';
        sel.appendChild(fallback);
    }

    // ── 帳號卡片列渲染 ────────────────────────────────────────────────────────

    /** 取得頭像的 src；Blob 以 object URL 呈現並在載入後釋放，舊版 data URL 直接使用 */
    function setAvatarImage(av, profile, alt) {
        const blob = profile.avatarBlob instanceof Blob ? profile.avatarBlob : null;
        const src  = blob ? URL.createObjectURL(blob) : profile.avatarDataUrl;
        if (!src) return;
        const img = document.createElement('img');
        img.alt = alt;
        if (blob) {
            const revoke = () => URL.revokeObjectURL(src);
            img.addEventListener('load',  revoke, { once: true });
            img.addEventListener('error', revoke, { once: true });
        }
        img.src = src;
        av.innerHTML = '';
        av.appendChild(img);
    }

    function mplRefreshAccountRow() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        row.innerHTML = '';

        const accounts = loadAccounts();

        const ghostBefore = document.createElement('div'); ghostBefore.className = 'mpl-acct-ghost';
        row.appendChild(ghostBefore);

        const profilePromises = accounts.map((acct, idx) => {
            const card = document.createElement('div');
            card.className = 'mpl-acct-card' + (selectedIdx === idx ? ' active' : '');

            const topLabel = document.createElement('div'); topLabel.className = 'mpl-acct-top-label';
            topLabel.textContent = acct.accountName;

            const del = document.createElement('div'); del.className = 'mpl-acct-del';
            del.textContent = '✕';
            del.addEventListener('click', e => { e.stopPropagation(); deleteAccount(idx); });

            const av = document.createElement('div'); av.className = 'mpl-avatar';
            const ph = document.createElement('span'); ph.className = 'mpl-avatar-ph'; ph.textContent = '🐈';
            av.appendChild(ph);

            const nm = document.createElement('div'); nm.className = 'mpl-acct-name'; nm.textContent = acct.accountName;
            const id = document.createElement('div'); id.className = 'mpl-acct-id';   id.textContent = '';

            card.appendChild(del); card.appendChild(topLabel);
            card.appendChild(av);  card.appendChild(nm); card.appendChild(id);
            card.addEventListener('click', () => selectAccount(idx));
            row.appendChild(card);

            return dbGet(acct.accountName).then(profile => {
                if (!profile) return;
                const displayName = profile.nickname || profile.name || acct.accountName;
                nm.textContent = displayName;
                if (profile.memberNumber) id.textContent = '#' + profile.memberNumber;
                setAvatarImage(av, profile, displayName);
            });
        });

        const ghostAfter = document.createElement('div'); ghostAfter.className = 'mpl-acct-ghost';
        row.appendChild(ghostAfter);

        requestAnimationFrame(updateCoverflowTransforms);
        Promise.all(profilePromises).then(() => requestAnimationFrame(updateCoverflowTransforms));
    }

    function selectAccount(idx) {
        selectedIdx = idx;
        const acct = loadAccounts()[idx];
        if (!acct) return;

        const currentSelection = idx;
        const nameEl = document.getElementById('mpl-input-name');
        const passEl = document.getElementById('mpl-input-pass');
        if (nameEl) nameEl.value = acct.accountName;
        if (passEl) passEl.value = '';

        const row   = document.getElementById('mpl-accounts-row');
        const cards = row?.querySelectorAll('.mpl-acct-card');
        cards?.forEach((card, i) => card.classList.toggle('active', i === idx));

        const selectedCard = cards?.[idx];
        if (row && selectedCard) {
            const targetScroll = selectedCard.offsetLeft - (row.offsetWidth - selectedCard.offsetWidth) / 2;
            row.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
        requestAnimationFrame(updateCoverflowTransforms);

        decryptPassword(acct.password).then(plain => {
            if (selectedIdx !== currentSelection) return;
            const el = document.getElementById('mpl-input-pass');
            if (el) el.value = plain ?? '';
        });
    }

    function deleteAccount(idx) {
        const acct = loadAccounts()[idx];
        if (!acct) return;
        removeAccount(acct.accountName);
        dbDelete(acct.accountName);
        if (selectedIdx === idx) {
            selectedIdx = null;
            document.getElementById('mpl-input-name').value = '';
            document.getElementById('mpl-input-pass').value = '';
        } else if (selectedIdx !== null && selectedIdx > idx) {
            selectedIdx--;
        }
        mplRefreshAccountRow();
    }

    // ── 設定浮層 ──────────────────────────────────────────────────────────────

    function toggleSettings() {
        settingsOpen = !settingsOpen;
        document.getElementById('mpl-settings-overlay')?.classList.toggle('visible', settingsOpen);
    }

    function closeSettings() {
        settingsOpen = false;
        document.getElementById('mpl-settings-overlay')?.classList.remove('visible');
    }

    // ── 登入 ──────────────────────────────────────────────────────────────────

    function doLogin() {
        const name = document.getElementById('mpl-input-name')?.value || '';
        const pass = document.getElementById('mpl-input-pass')?.value || '';

        if (!name || !pass) {
            const el = document.getElementById('mpl-status');
            if (el) {
                el.textContent = MPLT('login.fill_fields');
                el.classList.add('error');
                _lastStatusMsg   = el.textContent;
                _lastStatusError = true;
            }
            return;
        }

        // 直接把帳密交給 BC 的 LoginDoLogin（它收的是參數，不是欄位值）。
        // 不再寫入 BC 的 InputName / InputPassword：只要密碼被寫進 DOM 欄位，
        // 瀏覽器就會判定使用者剛用這組帳密登入而跳出記住密碼提示。
        if (typeof LoginDoLogin === 'function') { LoginDoLogin(name, pass); return; }

        // 退路：舊版 BC 沒有 LoginDoLogin，只能填欄位再按它的登入鈕
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const bcName = document.getElementById('InputName');
        const bcPass = document.getElementById('InputPassword');
        if (bcName && setter) { setter.call(bcName, name); bcName.dispatchEvent(new Event('input', { bubbles: true })); }
        if (bcPass && setter) { setter.call(bcPass, pass); bcPass.dispatchEvent(new Event('input', { bubbles: true })); }
        document.getElementById('login-login-button')?.click();
    }

    // ── 跑馬燈 ────────────────────────────────────────────────────────────────

    function buildMarquee() {
        const inner = document.getElementById('mpl-marquee-inner');
        if (!inner) return;

        const list = getThankYouList();
        if (!list.length) {
            document.getElementById('mpl-marquee-wrap')?.style.setProperty('display', 'none');
            return;
        }
        document.getElementById('mpl-marquee-wrap')?.style.removeProperty('display');

        inner.innerHTML = '';
        [...list, ...list].forEach(name => {
            const el = document.createElement('span'); el.className = 'mpl-marquee-item';
            const label = document.createElement('span');
            i18nText(label, 'login.marquee_thanks');
            const span = document.createElement('span');
            span.textContent = name;
            el.appendChild(label);
            el.appendChild(span);
            inner.appendChild(el);
        });
        marqueePosX = 0;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            marqueeHalfW = inner.scrollWidth / 2;
            startMarquee();
        }));
    }

    function startMarquee() {
        if (marqueeRAF) cancelAnimationFrame(marqueeRAF);
        marqueeLastT = null;
        const step = ts => {
            if (!mplActive) { marqueeRAF = null; return; }
            if (!marqueeLastT) marqueeLastT = ts;
            const dt = Math.min((ts - marqueeLastT) / 1000, 0.05);
            marqueeLastT = ts;
            marqueePosX -= MARQUEE_SPEED * dt;
            if (marqueeHalfW > 0 && marqueePosX <= -marqueeHalfW) marqueePosX += marqueeHalfW;
            const inner = document.getElementById('mpl-marquee-inner');
            if (inner) inner.style.transform = `translateX(${marqueePosX}px)`;
            marqueeRAF = requestAnimationFrame(step);
        };
        marqueeRAF = requestAnimationFrame(step);
    }

    // ── 啟用 / 停用 ───────────────────────────────────────────────────────────

    let _statusTimer = null;

    function mplApply() {
        if (mplActive) return;
        mplActive = true;
        buildUI();
        hideBC();
        mplBg = document.getElementById('mpl-bg');
        if (mplBg) mplBg.style.display = '';
        const bgImg = document.getElementById('mpl-bg-img');
        if (bgImg) bgImg.src = getBgUrl();
        _lastStatusMsg   = null;
        _lastStatusError = null;
        _statusTimer = setInterval(syncStatus, 500);
        // 重新進入登入頁（例如登出後）時，跑馬燈要重新啟動
        if (document.getElementById('mpl-marquee-inner')?.childElementCount) startMarquee();
    }

    function mplRemove() {
        if (!mplActive) return;
        mplActive = false;
        showBC();
        closeSettings();
        if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
        if (marqueeRAF)   { cancelAnimationFrame(marqueeRAF); marqueeRAF = null; }
        const bg = document.getElementById('mpl-bg');
        if (bg) bg.style.display = 'none';
    }

    // LCE 登入／離開時會更新同一份帳號資料庫，這裡跟著刷新卡片列
    window.addEventListener(ACCOUNTS_UPDATED_EVENT, () => { if (mplActive) mplRefreshAccountRow(); });

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化
    // ════════════════════════════════════════════════════════════════════════════

    function waitForBC(retryCount = 0) {
        const MAX_RETRIES = 120; // 最多等 60 秒
        if (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined') {
            if (retryCount >= MAX_RETRIES) {
                console.warn(LOG, '等待 BC 核心逾時，插件停止初始化');
                return;
            }
            return setTimeout(() => waitForBC(retryCount + 1), 500);
        }

        const publish = () => {
            injectLoginStyles();
            ensureAddonManagersVisible();
            refreshAllI18n();
            Object.assign(window.Liko.MPL, {
                version:            MOD_VER,
                render:             renderCshList,
                refreshSpaceButton: refreshCshSpaceButton,
                refreshAllI18n,
                Vertical,
                getOwnerSet:        () => [...getOwnerSet()],
                getLoverSet:        () => [...getLoverSet()],
                getFriendSet:       () => [...getFriendSet()],
                debugFirstRoom:     () => {
                    const room = getCshRoomsSource()[0];
                    return room ? { room, relations: getRoomRelations(room), topRelation: getTopRelation(room) } : null;
                },
                testClick:     drInjectClick,
                rebuildMirror: drStartMirror,
            });
        };

        ensureI18n()
            .then(() => {
                window.Liko.MPL.i18n = { t: (key, vars) => window.Liko.__Sys_i18n__.t('MPL', key, vars) };
                getCryptoKey().catch(e => console.warn(LOG, '加密系統初始化失敗:', e));
                publish();
            })
            .catch(e => {
                // i18n 載入失敗時不阻斷插件，MPLT() 會 fallback 到 key 原文
                console.error(LOG, 'i18n 載入失敗，以 key 原文顯示:', e);
                window.Liko.MPL.i18n = { t: key => key };
                getCryptoKey().catch(() => {});
                publish();
            });
    }

    waitForBC();

})();