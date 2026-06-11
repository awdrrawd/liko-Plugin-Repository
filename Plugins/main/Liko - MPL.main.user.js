// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.3.3
// @description    Supports vertical layout for ChatSearch and ChatRoom
// @description:zh 支援房間搜尋與聊天室的直版佈局
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant          none
// @require        https://cdn.jsdelivr.net/gh/Jomshir98/bondage-club-mod-sdk@0.3.3/dist/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    window.Liko.MPL = window.Liko.MPL ?? {};
    if (window.Liko.MPL.version) return;
    const MOD_VER = '0.3.3';
    window.Liko.MPL.version = MOD_VER;
    const modApi = bcModSdk.registerMod({
        name:       'Liko - MPL',
        fullName:   'Mobile Portrait Layout',
        version:    MOD_VER,
        repository: 'Supports vertical layout for ChatSearch and ChatRoom.',
    });

    // ─── 常數 ───────────────────────────────────────────────────────────────────
    const PORTRAIT_MAX_WIDTH = 768;
    const MENU_PX            = 44;
    const CARD_MIN_H         = 82;
    const CARD_GAP           = 5;
    const base = window.location.href;

    // ════════════════════════════════════════════════════════════════════════════
    // 工具函數
    // ════════════════════════════════════════════════════════════════════════════

    function isPortrait() {
        return window.innerWidth <= PORTRAIT_MAX_WIDTH || window.innerWidth < window.innerHeight;
    }

    function getCanvas() {
        return document.getElementById('MainCanvas') || document.querySelector('canvas');
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

    function removeStyle(id) {
        document.getElementById(id)?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Canvas 控制
    // ════════════════════════════════════════════════════════════════════════════

    // 快取上一次套用的數值，避免在 DrawProcess（每幀）重複寫入相同的 inline style
    // 造成不必要的 reflow。
    let _lastForcedCanvas = null; // { cv, vw, cvH }

    function forceCanvasStyle(cvH) {
        const cv = getCanvas();
        if (!cv) return;
        const vw = window.innerWidth;

        if (_lastForcedCanvas
            && _lastForcedCanvas.cv  === cv
            && _lastForcedCanvas.vw  === vw
            && _lastForcedCanvas.cvH === cvH) {
            return;
        }
        _lastForcedCanvas = { cv, vw, cvH };

        cv.style.setProperty('position',  'fixed',         'important');
        cv.style.setProperty('top',       '0',             'important');
        cv.style.setProperty('left',      '0',             'important');
        cv.style.setProperty('transform', 'none',          'important');
        cv.style.setProperty('width',     (vw * 2) + 'px', 'important');
        cv.style.setProperty('height',    cvH + 'px',      'important');
        cv.style.setProperty('z-index',   '5',             'important');
        cv.style.setProperty('margin',    '0',             'important');
    }

    function clearCanvasStyle() {
        const cv = getCanvas();
        _lastForcedCanvas = null;
        if (!cv) return;
        ['position','top','left','transform','width','height','z-index','margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 玩家關係工具
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
            // Map / Set 的鍵值對不是「自身可列舉屬性」，Object.entries 對它們無效，
            // 必須額外處理，否則像 Player.FriendNames（Map）這類資料會被整個忽略。
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

        // Player.FriendNames 是一個 Map，key 為好友的 MemberNumber、value 為暱稱：
        //   Map(1) { 192263 => "likolisu" }
        // 只需要 key（MemberNumber）即可，name 用不到。
        const fn = Player.FriendNames;
        if (fn instanceof Map) {
            for (const key of fn.keys()) {
                const n = Number(key);
                if (Number.isFinite(n)) set.add(n);
            }
        } else {
            // 備援：舊版/其他資料結構
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

    function getRelationLabel(rel) {
        return rel === 'owner' ? '主人' : rel === 'lover' ? '戀人' : rel === 'friend' ? '好友' : '';
    }

    function getRoomRelations(room) {
        const friends = Array.isArray(room?.Friends) ? room.Friends : [];
        const RANK = { owner: 3, lover: 2, friend: 1 };
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
    // 搜尋區域工具
    // ════════════════════════════════════════════════════════════════════════════

    function playerHasMaleGender() {
        try {
            const genders = typeof Player?.GetGenders === 'function' ? Player.GetGenders() : [];
            return Array.isArray(genders) && genders.includes('M');
        } catch { return false; }
    }

    function getCurrentSpace() {
        if (typeof ChatSearchGetSpace === 'function') return ChatSearchGetSpace();
        return typeof ChatSearchSpace !== 'undefined' ? ChatSearchSpace : 'X';
    }

    function getSpaceButtonIcon() {
        if (playerHasMaleGender() || getCurrentSpace() === 'X')
            return base + 'Icons/Gender.png';
        return base + 'Screens/Online/ChatSelect/Female.png';
    }

    function getSpaceButtonLabel() {
        if (playerHasMaleGender()) return '目前在混區（含 M 角色固定混區）';
        return getCurrentSpace() === 'X'
            ? '目前在混區，點擊切換到女區'
        : '目前在女區，點擊切換到混區';
    }

    function getToggleTargetSpace() {
        if (playerHasMaleGender()) return 'X';
        return getCurrentSpace() === 'X' ? '' : 'X';
    }

    function applySpace(space, queryText = '') {
        try {
            if (typeof Player !== 'undefined' && Player?.ChatSearchSettings)
                Player.ChatSearchSettings.Space = space;
            if (typeof ChatSearchSpace !== 'undefined')
                window.ChatSearchSpace = space;
        } catch (e) {
            console.error('🐈‍⬛ [MPL] 切換區域失敗', e);
        }
        if (typeof ChatSearchQuery === 'function') ChatSearchQuery(queryText);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatRoom 直版模式（crXxx）
    // ════════════════════════════════════════════════════════════════════════════

    let crActive   = false;
    let crOrigRect = null;
    let crLockedVH = 0;   // 鎖定進入聊天室時的視窗高度，防止鍵盤彈出時重算

    function crCalc() {
        const vw = window.innerWidth;
        const vh = crLockedVH || window.innerHeight;   // 使用鎖定高度
        const cvW = vw * 2,         cvH = Math.round(vh * 0.5);
        const sx = cvW / 2000,      sy  = cvH / 1000;
        const mLY = Math.round(cvH / sy);
        const mLH = Math.round(MENU_PX / sy);
        const mLW = Math.round(vw / sx);
        const cSY = cvH + MENU_PX,  cSH = Math.max(120, vh - cSY);
        return {
            cvH,
            mLY, mLH, mLW,
            cLY: Math.round(cSY / sy),
            cLH: Math.round(cSH / sy),
        };
    }

    // ── 假輸入框覆蓋層 ──────────────────────────────────────────────────────────
    // 攔截 chat-room-div 內的 input/textarea focus，
    // 顯示全螢幕覆蓋層 + 假輸入框，讓使用者確認後再送出，避免手機鍵盤彈出推動畫面。

    let crFakeInputActive = false;

    function crShowFakeInput(realInput) {
        if (crFakeInputActive) return;
        crFakeInputActive = true;

        realInput.setAttribute('readonly', 'true');
        realInput.blur();

        requestAnimationFrame(() => {
            realInput.removeAttribute('readonly');
        });

        // 建立 overlay
        const overlay = document.createElement('div');
        overlay.id = 'liko-cr-fake-input-overlay';
        overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 200;
        background: rgba(0,0,0,0.72);
        display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start;
        padding-top: 18px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

        const box = document.createElement('div');
        box.style.cssText = `
        width: 92%; max-width: 520px;
        background: #1a1a2e;
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 14px;
        padding: 12px 14px;
        display: flex; flex-direction: column; gap: 10px;
    `;

        const title = document.createElement('div');
        title.textContent = '輸入訊息';
        title.style.cssText = 'color: rgba(255,255,255,0.55); font-size: 12px;';
        box.appendChild(title);

        const ta = document.createElement('textarea');
        ta.value       = realInput.value || '';
        ta.placeholder = realInput.placeholder || '';
        ta.rows        = 4;
        ta.style.cssText = `
        width: 100%; box-sizing: border-box;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 9px; color: #fff; font-size: 15px;
        padding: 10px 12px; outline: none; resize: none;
        font-family: inherit; line-height: 1.5;
    `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 8px; justify-content: flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
        padding: 8px 20px; border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.07);
        color: #fff; font-size: 14px; cursor: pointer;
    `;

        const sendBtn = document.createElement('button');
        sendBtn.textContent = '送出';
        sendBtn.style.cssText = `
        padding: 8px 20px; border-radius: 8px;
        border: 1px solid rgba(100,80,220,0.60);
        background: rgba(80,60,200,0.40);
        color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
    `;

        const close = () => {
            crFakeInputActive = false;
            overlay.remove();
        };

        cancelBtn.addEventListener('click', close);

        sendBtn.addEventListener('click', () => {
            realInput.value = ta.value;
            realInput.dispatchEvent(new Event('input', { bubbles: true }));
            ['keydown', 'keypress', 'keyup'].forEach(type => {
                realInput.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter', code: 'Enter', keyCode: 13,
                    bubbles: true, cancelable: true,
                }));
            });
            close();
        });

        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(sendBtn);
        box.appendChild(ta);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // iOS 需要在 user gesture 的同步呼叫或極短延遲內 focus
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ta.focus();
                ta.selectionStart = ta.selectionEnd = ta.value.length;
            });
        });
    }

    // ── 攔截聊天輸入框 ────────────────────────────────────────────────────────
    function crHookChatInput() {
        const chatDiv = document.getElementById('chat-room-div');
        if (!chatDiv || chatDiv._likoFakeInputHandler) return;

        const handler = (e) => {
            if (!crActive || !isPortrait()) return;
            const el = e.target;
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
            e.preventDefault();
            crShowFakeInput(el);
        };
        chatDiv._likoFakeInputHandler = handler;
        chatDiv.addEventListener('focusin', handler, true);
    }

    function crUnhookChatInput() {
        const chatDiv = document.getElementById('chat-room-div');
        if (!chatDiv || !chatDiv._likoFakeInputHandler) return;
        chatDiv.removeEventListener('focusin', chatDiv._likoFakeInputHandler, true);
        delete chatDiv._likoFakeInputHandler;
    }

    function crMaintain() {
        if (!crActive) return;
        const L = crCalc();
        forceCanvasStyle(L.cvH);
        if (typeof ChatRoomDivRect !== 'undefined') {
            ChatRoomDivRect[0] = 0;
            ChatRoomDivRect[1] = L.cLY;
            ChatRoomDivRect[2] = L.mLW;
            ChatRoomDivRect[3] = L.cLH;
        }
        if (typeof ElementPositionFix === 'function') {
            const fs = typeof ChatRoomFontSize !== 'undefined' ? ChatRoomFontSize : 30;
            ElementPositionFix('chat-room-top-menu', fs, 0, L.mLY, L.mLW, L.mLH);
        }
    }

    function crApply() {
        crActive   = true;
        crLockedVH = getLockedVH();
        const L = crCalc();
        injectStyle('liko-ml-cr', `
            html, body { overflow-x: hidden !important }
            #chat-room-top-menu { position: fixed !important; z-index: 15 !important }
            #chat-room-div      { position: fixed !important; z-index: 10 !important }
        `);
        forceCanvasStyle(L.cvH);
        if (!crOrigRect && typeof ChatRoomDivRect !== 'undefined')
            crOrigRect = [...ChatRoomDivRect];
        if (typeof ChatRoomDivRect !== 'undefined') {
            ChatRoomDivRect[0] = 0;
            ChatRoomDivRect[1] = L.cLY;
            ChatRoomDivRect[2] = L.mLW;
            ChatRoomDivRect[3] = L.cLH;
        }
        requestAnimationFrame(() => {
            crMaintain();
            if (typeof ChatRoomResize === 'function') try { ChatRoomResize(false); } catch {}
            crHookChatInput();   // hook 輸入框
        });
    }

    function crRemove() {
        if (!crActive) return;
        crActive   = false;
        crLockedVH = 0;
        crFakeInputActive = false;
        document.getElementById('liko-cr-fake-input-overlay')?.remove();
        crUnhookChatInput();
        clearCanvasStyle();
        removeStyle('liko-ml-cr');
        if (crOrigRect && typeof ChatRoomDivRect !== 'undefined')
            [0, 1, 2, 3].forEach(i => ChatRoomDivRect[i] = crOrigRect[i]);
        crOrigRect = null;
        if (typeof ChatRoomResize === 'function') try { ChatRoomResize(false); } catch {}
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSelect 直版模式（csXxx）
    // ════════════════════════════════════════════════════════════════════════════

    let csActive = false;

    function csApply() {
        csActive = true;
        injectStyle('liko-ml-cs', `
            html, body { overflow-x: hidden !important }
            #liko-cs-bg {
                position: fixed; inset: 0; z-index: 100;
                overflow: hidden; background: #111;
            }
            #liko-cs-bg-img {
                position: absolute; top: 0; left: -50vw;
                width: 200vw; height: 100%;
                object-fit: cover; object-position: top left;
                pointer-events: none;
            }
            #liko-cs-overlay {
                position: absolute; inset: 0; z-index: 101;
                display: flex; flex-direction: column;
                align-items: center; justify-content: space-evenly;
                padding: 28px 24px; box-sizing: border-box;
                background: rgba(0,0,0,0.40);
            }
            #liko-cs-exit {
                position: absolute; top: 10px; right: 10px; z-index: 102;
                width: 42px; height: 42px; border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.28);
                background: rgba(0,0,0,0.60);
                cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                padding: 0;
            }
            #liko-cs-exit img { width: 26px; height: 26px; object-fit: contain; }
            #liko-cs-exit:active { background: rgba(120,20,20,0.80); }
            .liko-cs-row {
                width: 100%; max-width: 480px;
                display: flex; flex-direction: column;
                align-items: stretch; gap: 9px;
            }
            .liko-cs-btn {
                width: 100%; min-height: 64px; border-radius: 14px;
                border: 1px solid rgba(255,255,255,0.28);
                background: rgba(15,15,35,0.80);
                color: #fff; font-size: 18px; font-weight: 700;
                cursor: pointer;
                display: flex; align-items: center; justify-content: center; gap: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                user-select: none; padding: 0 20px;
                backdrop-filter: blur(4px);
            }
            .liko-cs-btn:active { background: rgba(80,50,200,0.65); }
            .liko-cs-btn.disabled { opacity: 0.35; pointer-events: none; }
            .liko-cs-btn img { width: 34px; height: 34px; flex-shrink: 0; }
            .liko-cs-desc {
                font-size: 13px; line-height: 1.5;
                color: rgba(230,220,255,0.78); text-align: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                user-select: none; padding: 0 8px;
            }
        `);
        buildCsBg();
    }

    function buildCsBg() {
        document.getElementById('liko-cs-bg')?.remove();
        const T = typeof TextGet === 'function' ? TextGet : k => k;

        const bg = document.createElement('div'); bg.id = 'liko-cs-bg';
        const bgImg = document.createElement('img'); bgImg.id = 'liko-cs-bg-img';
        bgImg.src = base + 'Backgrounds/BrickWall.jpg'; bgImg.alt = '';
        bg.appendChild(bgImg);

        const ol = document.createElement('div'); ol.id = 'liko-cs-overlay';

        const exitBtn = document.createElement('button'); exitBtn.id = 'liko-cs-exit';
        exitBtn.setAttribute('aria-label', '離開');
        const exitImg = document.createElement('img'); exitImg.src = base + 'Icons/Exit.png';
        exitImg.onerror = () => { exitImg.style.display = 'none'; exitBtn.textContent = '✕'; };
        exitBtn.appendChild(exitImg);
        exitBtn.addEventListener('click', () => {
            if (typeof ChatSelectExit === 'function') ChatSelectExit();
            else if (typeof CommonSetScreen === 'function') CommonSetScreen('Room', 'MainHall');
        });
        ol.appendChild(exitBtn);

        const options = [
            {
                icon:  base + 'Screens/Online/ChatSelect/Female.png',
                label: T('FemaleOnlyChat'),
                desc:  T('FemaleOnlyChatDescription1'),
                space: '',
                ok:    typeof ChatSelectAllowedInFemaleOnly !== 'undefined' ? ChatSelectAllowedInFemaleOnly : true,
            },
            {
                icon:  base + 'Icons/Gender.png',
                label: T('MixedChat'),
                desc:  T('MixedChatDescription1'),
                space: 'X',
                ok:    true,
            },
            {
                icon:  base + 'Screens/Online/ChatSelect/Male.png',
                label: T('MaleOnlyChat'),
                desc:  T('MaleOnlyChatDescription1'),
                space: 'M',
                // 註：若 ChatSelectAllowedInMaleOnly / FemaleOnly 在未來版本改名或被移除，
                // 這裡會 fallback 為 true（按鈕可點）。這是刻意「失效時開放」的選擇，
                // 避免在 BC 改版時整顆按鈕被永久鎖死；風險是萬一真的不可進入，
                // 點擊後行為交由 ChatSelectStartSearch 自行處理（通常會被 BC 拒絕）。
                ok:    typeof ChatSelectAllowedInMaleOnly !== 'undefined' ? ChatSelectAllowedInMaleOnly : true,
            },
        ];

        for (const opt of options) {
            const row = document.createElement('div'); row.className = 'liko-cs-row';
            const btn = document.createElement('button');
            btn.className = 'liko-cs-btn' + (opt.ok ? '' : ' disabled');
            const img = document.createElement('img'); img.src = opt.icon;
            img.onerror = () => img.style.display = 'none';
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

    let cshActive     = false;
    let cshSyncTimer  = null;
    let cshNeedSync   = false;
    let cshPage       = 1;
    let cshRoomsCache = [];

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
        const HEADER_H = 52, FOOTER_H = 48, PADDING = 12;
        const listH = window.innerHeight - HEADER_H - FOOTER_H - PADDING * 2;
        const rows = Math.max(1, Math.floor(listH / (CARD_MIN_H + CARD_GAP)));
        return rows * 2;
    }

    function buildRoomTags(room) {
        const tags = [];
        if (room.Space !== undefined && typeof ChatSearchGetSpaceName === 'function') tags.push(ChatSearchGetSpaceName(room.Space));
        if (room.Language && typeof ChatSearchGetLanguageName === 'function') tags.push(ChatSearchGetLanguageName(room.Language));
        if (room.Game && typeof TextGet === 'function') tags.push(TextGet(room.Game) || room.Game);
        if (room.MapType && room.MapType !== 'Never' && typeof ChatSearchGetRoomTypeName === 'function')
            tags.push(ChatSearchGetRoomTypeName(room.MapType));
        if (Array.isArray(room.BlockCategory))
            for (const b of room.BlockCategory)
                tags.push(`屏蔽: ${typeof TextGet === 'function' ? (TextGet(b) || b) : b}`);
        if (Array.isArray(room.Access))
            for (const a of room.Access) {
                if (a === 'All') continue;
                tags.push(`權限: ${typeof TextGet === 'function' ? (TextGet(a + 'Access') || a) : a}`);
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
     * 嘗試在 ChatSearch 畫面的原生 DOM 中找出指定功能的按鈕。
     *
     * 注意：BC 並未提供穩定的 API 來取得這些按鈕，這裡用 id 關鍵字比對是
     * 「能動但脆弱」的做法 —— 若未來 BC 更新導致按鈕 id 命名規則改變，
     * 這個函式會回傳 null。呼叫端務必保留對應全域函式（ChatSearchCreateRoom /
     * ChatSearchExit 等）作為 fallback，並視需要在 console 留下警告，
     * 方便日後快速定位「按鈕失效」的原因。
     */
    function findChatSearchButton(...keywords) {
        const candidates = document.querySelectorAll(
            '#chat-search-room-header button, [id^="chat-search"] button'
        );
        for (const btn of candidates) {
            const id = (btn.id || '').toLowerCase();
            if (keywords.some(k => id.includes(k))) return btn;
        }
        return null;
    }

    function cshApply() {
        cshActive   = true;
        cshNeedSync = false;
        cshPage     = 1;   // 每次重新進入 ChatSearch 都從第一頁開始，避免殘留上次頁碼
        const HEADER_H = 52, FOOTER_H = 48;

        forceCanvasStyle(0);

        injectStyle('liko-ml-csh-hide',
                    CSH_BC_IDS.map(id => `#${id} { display: none !important }`).join('\n'));

        injectStyle('liko-ml-csh', `
            html, body { overflow-x: hidden !important }
            #liko-csh-shell {
                position: fixed; inset: 0; z-index: 50;
                display: flex; flex-direction: column;
                background: #0a0a14; overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #liko-csh-header {
                flex-shrink: 0; height: ${HEADER_H}px;
                display: flex; align-items: center; gap: 5px;
                padding: 0 8px; box-sizing: border-box;
                background: #12121e;
                border-bottom: 1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-search-wrap {
                flex: 1; min-width: 0; height: 36px;
                display: flex; align-items: center; position: relative;
            }
            #liko-csh-search-wrap input {
                flex: 1; height: 100%; box-sizing: border-box;
                background: rgba(255,255,255,0.08);
                border: 1px solid rgba(255,255,255,0.18);
                border-radius: 9px; color: #fff; font-size: 13px;
                padding: 0 30px 0 10px; outline: none;
            }
            #liko-csh-search-wrap input::placeholder { color: rgba(255,255,255,0.38); }
            #liko-csh-clear {
                position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
                background: none; border: none; color: rgba(255,255,255,0.45);
                font-size: 15px; cursor: pointer; padding: 0; line-height: 1; display: none;
            }
            #liko-csh-clear.visible { display: block; }
            .liko-csh-hbtn {
                flex-shrink: 0; width: 44px; height: 44px; border-radius: 10px;
                border: 1px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.07);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; padding: 0;
            }
            .liko-csh-hbtn img { width: 26px; height: 26px; object-fit: contain; }
            .liko-csh-hbtn:active { background: rgba(255,255,255,0.18); }
            .liko-csh-hbtn.create {
                border-color: rgba(120,80,220,0.60);
                background: rgba(100,60,200,0.25);
            }
            #liko-csh-list {
                flex: 1; overflow-y: auto; overflow-x: hidden;
                display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: ${CARD_GAP}px; padding: 6px; box-sizing: border-box;
                align-content: start;
            }
            #liko-csh-list::-webkit-scrollbar { width: 3px; }
            #liko-csh-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 2px; }
            .liko-csh-card {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 10px; padding: 7px 8px;
                cursor: pointer;
                display: flex; flex-direction: column; gap: 3px;
                min-height: ${CARD_MIN_H}px;
                box-sizing: border-box; position: relative;
                min-width: 0; overflow: hidden;
            }
            .liko-csh-card:active { background: rgba(255,255,255,0.14); }
            .liko-csh-card.full {
                border-color: rgba(255,70,70,0.88); border-width: 2px;
                background: rgba(80,20,20,0.20);
                box-shadow: inset 0 0 0 1px rgba(255,70,70,0.18);
            }
            .liko-csh-card.has-friend {
                border-color: rgba(82,214,109,0.38);
                box-shadow: 0 0 0 1px rgba(82,214,109,0.08) inset;
            }
            .liko-csh-card.has-friend:not(.full) {
                background: linear-gradient(180deg, rgba(82,214,109,0.06), rgba(82,214,109,0.02)),
                            rgba(255,255,255,0.03);
            }
            .liko-csh-card-top { display: flex; align-items: flex-start; gap: 3px; padding-right: 22px; }
            .liko-csh-card-lock { font-size: 11px; flex-shrink: 0; line-height: 1.4; }
            .liko-csh-card-name {
                font-size: 12px; font-weight: 600; color: #f0e8ff;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
            }
            .liko-csh-card-info {
                position: absolute; top: 5px; right: 5px;
                width: 18px; height: 18px; border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.20);
                background: rgba(255,255,255,0.08);
                color: rgba(255,255,255,0.55); font-size: 10px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; flex-shrink: 0;
            }
            .liko-csh-card-info:active { background: rgba(255,255,255,0.22); }
            .liko-csh-card-owner {
                font-size: 10px; color: rgba(180,170,210,0.60);
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .liko-csh-card-desc {
                font-size: 10px; color: rgba(185,175,210,0.72);
                overflow: hidden; display: -webkit-box;
                -webkit-line-clamp: 2; -webkit-box-orient: vertical;
                line-height: 1.35; flex: 1;
            }
            .liko-csh-card-foot {
                display: flex; justify-content: flex-start; align-items: center;
                font-size: 10px; color: rgba(160,200,255,0.72);
                padding-top: 2px; margin-top: auto; gap: 5px;
            }
            .liko-csh-card-count { white-space: nowrap; }
            .liko-csh-card-count.full { color: rgba(255,90,90,0.98); font-weight: 800; }
            .liko-csh-card-rel {
                display: inline-flex; align-items: center; gap: 4px;
                white-space: nowrap; font-size: 10px; font-weight: 700;
            }
            .liko-csh-card-rel .dot { width: 7px; height: 7px; border-radius: 999px; display: inline-block; }
            .liko-csh-card-rel.friend { color: rgba(90,230,120,0.95); }
            .liko-csh-card-rel.friend .dot { background: #52d66d; }
            .liko-csh-card-rel.lover  { color: rgba(255,120,210,0.95); }
            .liko-csh-card-rel.lover  .dot { background: #ff66c4; }
            .liko-csh-card-rel.owner  { color: rgba(255,175,90,0.98); }
            .liko-csh-card-rel.owner  .dot { background: #ff9b3d; }
            .liko-csh-empty {
                grid-column: 1 / -1; text-align: center;
                color: rgba(255,255,255,0.28); font-size: 13px; padding: 50px 0;
            }
            #liko-csh-footer {
                flex-shrink: 0; height: ${FOOTER_H}px;
                display: flex; align-items: center;
                padding: 0 8px; gap: 6px; box-sizing: border-box;
                background: #12121e;
                border-top: 1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-foot-left  { flex: 1; }
            #liko-csh-foot-pages { display: flex; align-items: center; gap: 6px; flex: 2; justify-content: center; }
            #liko-csh-foot-right { flex: 1; display: flex; justify-content: flex-end; }
            .liko-csh-page-btn {
                height: 34px; padding: 0 14px; border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.07);
                color: #fff; font-size: 12px; cursor: pointer; white-space: nowrap;
            }
            .liko-csh-page-btn:active   { background: rgba(255,255,255,0.18); }
            .liko-csh-page-btn.disabled { opacity: 0.30; pointer-events: none; }
            #liko-csh-pageinfo { font-size: 11px; color: rgba(255,255,255,0.45); white-space: nowrap; }
            #liko-csh-exit-btn {
                height: 34px; padding: 0 14px; border-radius: 8px;
                border: 1px solid rgba(255,100,100,0.30);
                background: rgba(80,20,20,0.40);
                color: rgba(255,160,160,0.85); font-size: 12px; cursor: pointer;
            }
            #liko-csh-exit-btn:active { background: rgba(120,30,30,0.60); }
            #liko-csh-info-backdrop {
                position: fixed; inset: 0; z-index: 80;
                background: rgba(0,0,0,0.52);
                display: flex; align-items: flex-end; justify-content: center;
            }
            #liko-csh-info-sheet {
                width: 100%; max-width: 768px; max-height: 82vh; overflow: auto;
                background: #151522;
                border-top-left-radius: 18px; border-top-right-radius: 18px;
                border: 1px solid rgba(255,255,255,0.10);
                box-shadow: 0 -10px 30px rgba(0,0,0,0.35);
                padding: 14px 14px 16px; box-sizing: border-box;
            }
            #liko-csh-info-handle {
                width: 42px; height: 4px; border-radius: 999px;
                background: rgba(255,255,255,0.20); margin: 0 auto 12px;
            }
            #liko-csh-info-head  { display: flex; align-items: flex-start; gap: 8px; }
            #liko-csh-info-main  { flex: 1; min-width: 0; }
            #liko-csh-info-title { font-size: 16px; font-weight: 700; color: #f3ecff; line-height: 1.3; word-break: break-word; }
            #liko-csh-info-owner { margin-top: 3px; font-size: 12px; color: rgba(200,190,220,0.72); }
            #liko-csh-info-close {
                flex-shrink: 0; width: 34px; height: 34px; border-radius: 9px;
                border: 1px solid rgba(255,255,255,0.14);
                background: rgba(255,255,255,0.06); color: #fff; cursor: pointer;
            }
            #liko-csh-info-desc {
                margin-top: 12px; font-size: 13px; line-height: 1.55;
                color: rgba(230,225,240,0.88); white-space: pre-wrap; word-break: break-word;
            }
            #liko-csh-info-tags   { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
            .liko-csh-tag {
                padding: 6px 10px; border-radius: 999px;
                background: rgba(255,255,255,0.07);
                border: 1px solid rgba(255,255,255,0.10);
                color: #e9defa; font-size: 11px; line-height: 1.2;
            }
            #liko-csh-info-people { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
            .liko-csh-info-person {
                display: flex; align-items: center; gap: 8px;
                padding: 8px 10px; border-radius: 10px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                font-size: 12px; color: #efe7ff;
            }
            .liko-csh-rel-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
            .liko-csh-rel-dot.friend { background: #52d66d; }
            .liko-csh-rel-dot.lover  { background: #ff66c4; }
            .liko-csh-rel-dot.owner  { background: #ff9b3d; }
            .liko-csh-rel-label { font-size: 11px; color: rgba(255,255,255,0.55); margin-left: auto; }
            #liko-csh-info-footer { margin-top: 14px; display: flex; align-items: center; gap: 8px; }
            #liko-csh-info-members { flex: 1; font-size: 12px; color: rgba(160,200,255,0.82); }
            #liko-csh-info-join {
                height: 38px; padding: 0 16px; border-radius: 10px;
                border: 1px solid rgba(120,80,220,0.55);
                background: rgba(100,60,200,0.28);
                color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
            }
            #liko-csh-info-join.disabled { opacity: 0.4; pointer-events: none; }
        `);

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

    function buildCshShell() {
        document.getElementById('liko-csh-shell')?.remove();
        const shell = document.createElement('div'); shell.id = 'liko-csh-shell';

        const header = document.createElement('div'); header.id = 'liko-csh-header';

        const wrap   = document.createElement('div');   wrap.id = 'liko-csh-search-wrap';
        const inp    = document.createElement('input'); inp.type = 'text'; inp.placeholder = '🔍 搜尋房間...';
        inp.value = typeof ChatSearchQueryString !== 'undefined' ? ChatSearchQueryString : '';
        const clearBtn = document.createElement('button'); clearBtn.id = 'liko-csh-clear';
        clearBtn.textContent = '✕'; clearBtn.setAttribute('aria-label', '清除');
        if (inp.value) clearBtn.classList.add('visible');
        clearBtn.addEventListener('click', () => {
            inp.value = ''; clearBtn.classList.remove('visible');
            if (typeof ChatSearchQuery === 'function') ChatSearchQuery('');
        });
        inp.addEventListener('input', () => {
            clearBtn.classList.toggle('visible', inp.value.length > 0);
            clearTimeout(inp._deb);
            inp._deb = setTimeout(() => {
                if (typeof ChatSearchQuery === 'function') ChatSearchQuery(inp.value);
            }, 400);
        });
        wrap.appendChild(inp); wrap.appendChild(clearBtn);
        header.appendChild(wrap);

        header.appendChild(makeHBtn(base + 'Icons/Search.png', '篩選', () => {
            const bcFilterBtn = findChatSearchButton('filter');
            if (bcFilterBtn) {
                bcFilterBtn.style.removeProperty('display');
                bcFilterBtn.click();
            } else {
                console.warn('🐈‍⬛ [MPL] 找不到原生篩選按鈕，BC 介面可能已更新');
            }
        }));

        const spaceBtn = makeHBtn(getSpaceButtonIcon(), getSpaceButtonLabel(), () => {
            if (playerHasMaleGender()) { refreshCshSpaceButton(); return; }
            const q = inp.value ?? (typeof ChatSearchQueryString !== 'undefined' ? ChatSearchQueryString : '');
            applySpace(getToggleTargetSpace(), q);
            refreshCshSpaceButton();
        });
        spaceBtn.id = 'liko-csh-space-btn';
        header.appendChild(spaceBtn);

        header.appendChild(makeHBtn(base + 'Icons/Plus.png', '建立房間', () => {
            const bcCreate = findChatSearchButton('create');
            if (bcCreate) {
                bcCreate.style.removeProperty('display');
                bcCreate.click();
                return;
            }
            if (typeof ChatSearchCreateRoom === 'function') ChatSearchCreateRoom();
            else console.warn('🐈‍⬛ [MPL] 找不到原生建立房間按鈕，BC 介面可能已更新');
        }, 'create'));

        shell.appendChild(header);

        const list = document.createElement('div'); list.id = 'liko-csh-list';
        shell.appendChild(list);

        const footer    = document.createElement('div'); footer.id = 'liko-csh-footer';
        const footLeft  = document.createElement('div'); footLeft.id  = 'liko-csh-foot-left';
        const footPages = document.createElement('div'); footPages.id = 'liko-csh-foot-pages';
        const footRight = document.createElement('div'); footRight.id = 'liko-csh-foot-right';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'liko-csh-page-btn disabled';
        prevBtn.textContent = '‹'; prevBtn.setAttribute('aria-label', '上一頁');
        prevBtn.addEventListener('click', () => {
            if (cshPage <= 1) return;
            cshPage--;
            renderCshList(false);
        });

        const pageInfo = document.createElement('span'); pageInfo.id = 'liko-csh-pageinfo';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'liko-csh-page-btn disabled';
        nextBtn.textContent = '›'; nextBtn.setAttribute('aria-label', '下一頁');
        nextBtn.addEventListener('click', () => {
            const perPage    = Math.max(1, calcCshPerPage());
            const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
            if (cshPage >= totalPages) return;
            cshPage++;
            renderCshList(false);
        });

        footPages.appendChild(prevBtn); footPages.appendChild(pageInfo); footPages.appendChild(nextBtn);

        const exitBtn = document.createElement('button'); exitBtn.id = 'liko-csh-exit-btn';
        exitBtn.textContent = '離開';
        exitBtn.addEventListener('click', () => {
            const bcExit = findChatSearchButton('exit');
            if (bcExit) { bcExit.click(); return; }
            if (typeof ChatSearchExit === 'function') ChatSearchExit();
            else if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSelect');
            else console.warn('🐈‍⬛ [MPL] 找不到原生離開按鈕，BC 介面可能已更新');
        });
        footRight.appendChild(exitBtn);

        footer.appendChild(footLeft); footer.appendChild(footPages); footer.appendChild(footRight);
        shell.appendChild(footer);

        shell._prev     = prevBtn;
        shell._next     = nextBtn;
        shell._pageInfo = pageInfo;

        document.body.appendChild(shell);

        if (playerHasMaleGender() && getCurrentSpace() !== 'X')
            applySpace('X', inp.value ?? '');

        refreshCshSpaceButton();
        renderCshList();
    }

    function renderCshList(resetPage = false) {
        const shell = document.getElementById('liko-csh-shell');
        const list  = document.getElementById('liko-csh-list');
        if (!list) return;

        cshRoomsCache = getCshRoomsSource();

        const perPage    = Math.max(1, calcCshPerPage());
        const totalRooms = cshRoomsCache.length;
        const totalPages = Math.max(1, Math.ceil(totalRooms / perPage));

        if (resetPage) cshPage = 1;
        cshPage = Math.min(Math.max(1, cshPage), totalPages);

        const start     = (cshPage - 1) * perPage;
        const pageRooms = cshRoomsCache.slice(start, start + perPage);

        list.innerHTML = '';

        if (!pageRooms.length) {
            const emp = document.createElement('div');
            emp.className = 'liko-csh-empty';
            emp.textContent = '沒有找到房間';
            list.appendChild(emp);
        } else {
            for (const room of pageRooms) list.appendChild(buildRoomCard(room));
        }

        if (shell) {
            shell._prev.className     = 'liko-csh-page-btn' + (cshPage > 1          ? '' : ' disabled');
            shell._next.className     = 'liko-csh-page-btn' + (cshPage < totalPages ? '' : ' disabled');
            shell._pageInfo.textContent = totalRooms > 0 ? `${cshPage}/${totalPages} · ${totalRooms}間` : '0/0';
        }
        refreshCshSpaceButton();
    }

    function buildRoomCard(room) {
        const joinBtn     = room?.Order != null ? document.getElementById(`chat-search-room-join-button-${room.Order}`) : null;
        const name        = room.Name || '未命名房間';
        const creator     = room.Creator || '';
        const desc        = room.Description || '';
        const memberCount = room.MemberCount ?? null;
        const limit       = room.MemberLimit ?? null;
        const locked      = !room.CanJoin;
        const isFull      = memberCount !== null && limit !== null && memberCount >= limit;
        const hasFriend   = Array.isArray(room.Friends) && room.Friends.length > 0;
        const topRel      = getTopRelation(room);

        const card = document.createElement('div');
        card.className = 'liko-csh-card' + (isFull ? ' full' : '') + (hasFriend ? ' has-friend' : '');

        const top = document.createElement('div'); top.className = 'liko-csh-card-top';
        if (locked) {
            const lockEl = document.createElement('span');
            lockEl.className = 'liko-csh-card-lock'; lockEl.textContent = '🔒';
            top.appendChild(lockEl);
        }
        const nameEl = document.createElement('div'); nameEl.className = 'liko-csh-card-name';
        nameEl.textContent = name;
        top.appendChild(nameEl);
        card.appendChild(top);

        const infoBtn = document.createElement('button'); infoBtn.className = 'liko-csh-card-info';
        infoBtn.textContent = 'ⓘ'; infoBtn.setAttribute('aria-label', '房間資訊');
        infoBtn.addEventListener('click', e => { e.stopPropagation(); cshShowRoomInfo(room); });
        card.appendChild(infoBtn);

        if (creator) {
            const ownerEl = document.createElement('div'); ownerEl.className = 'liko-csh-card-owner';
            ownerEl.textContent = `by ${creator}`;
            card.appendChild(ownerEl);
        }

        if (desc) {
            const descEl = document.createElement('div'); descEl.className = 'liko-csh-card-desc';
            descEl.textContent = desc;
            card.appendChild(descEl);
        }

        const foot = document.createElement('div'); foot.className = 'liko-csh-card-foot';
        const cnt  = document.createElement('span'); cnt.className = 'liko-csh-card-count' + (isFull ? ' full' : '');
        cnt.textContent = memberCount !== null ? `👥 ${memberCount}${limit !== null ? '/' + limit : ''}` : '';
        foot.appendChild(cnt);

        // 顯示所有關係（可能同時有主人/戀人/好友）
        const allRelations = getRoomRelations(room);
        // 去重：同一個人只顯示最高關係，但不同人的不同關係都顯示
        const relTypes = [...new Set(allRelations.map(p => p.relation))];
        for (const relType of relTypes) {
            const REL_LABEL = { owner: '主人', lover: '戀人', friend: '好友' };
            const rel  = document.createElement('span'); rel.className = `liko-csh-card-rel ${relType}`;
            const dot  = document.createElement('span'); dot.className = 'dot';
            const text = document.createElement('span'); text.textContent = REL_LABEL[relType] ?? relType;
            rel.appendChild(dot); rel.appendChild(text);
            foot.appendChild(rel);
        }
        card.appendChild(foot);

        card.addEventListener('click', () => {
            if (joinBtn) joinBtn.click();
            else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
        });

        return card;
    }

    function cshCloseRoomInfo() {
        document.getElementById('liko-csh-info-backdrop')?.remove();
    }

    function cshShowRoomInfo(room) {
        cshCloseRoomInfo();

        const backdrop = document.createElement('div'); backdrop.id = 'liko-csh-info-backdrop';
        backdrop.addEventListener('click', cshCloseRoomInfo);

        const sheet = document.createElement('div'); sheet.id = 'liko-csh-info-sheet';
        sheet.addEventListener('click', e => e.stopPropagation());

        const handle = document.createElement('div'); handle.id = 'liko-csh-info-handle';
        sheet.appendChild(handle);

        const head  = document.createElement('div'); head.id = 'liko-csh-info-head';
        const main  = document.createElement('div'); main.id = 'liko-csh-info-main';
        const title = document.createElement('div'); title.id = 'liko-csh-info-title'; title.textContent = room.Name || '未命名房間';
        const owner = document.createElement('div'); owner.id = 'liko-csh-info-owner'; owner.textContent = room.Creator ? `by ${room.Creator}` : '';
        main.appendChild(title); main.appendChild(owner);
        const closeBtn = document.createElement('button'); closeBtn.id = 'liko-csh-info-close';
        closeBtn.textContent = '✕'; closeBtn.addEventListener('click', cshCloseRoomInfo);
        head.appendChild(main); head.appendChild(closeBtn);
        sheet.appendChild(head);

        const descEl = document.createElement('div'); descEl.id = 'liko-csh-info-desc';
        descEl.textContent = room.Description || '沒有描述';
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
                label.textContent = getRelationLabel(p.relation);
                row.appendChild(dot); row.appendChild(name); row.appendChild(label);
                peopleWrap.appendChild(row);
            }
            sheet.appendChild(peopleWrap);
        }

        const footer  = document.createElement('div'); footer.id = 'liko-csh-info-footer';
        const members = document.createElement('div'); members.id = 'liko-csh-info-members';
        members.textContent = `${room.MemberCount ?? 0} / ${room.MemberLimit ?? '?'}`;

        const canJoin = !!(room.CanJoin && (room.MemberCount ?? 0) < (room.MemberLimit ?? 999));
        const joinBtn = document.createElement('button'); joinBtn.id = 'liko-csh-info-join';
        joinBtn.textContent = canJoin ? '加入房間' : '房間不可加入';
        if (!canJoin) joinBtn.classList.add('disabled');
        joinBtn.addEventListener('click', () => {
            if (!canJoin) return;
            cshCloseRoomInfo();
            const joinBtnDom = room?.Order != null
            ? document.getElementById(`chat-search-room-join-button-${room.Order}`) : null;
            if (joinBtnDom) joinBtnDom.click();
            else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
        });

        footer.appendChild(members); footer.appendChild(joinBtn);
        sheet.appendChild(footer);

        backdrop.appendChild(sheet);
        document.body.appendChild(backdrop);
    }

    function cshRemove() {
        if (!cshActive) return;
        cshActive = false;
        if (cshSyncTimer) { clearTimeout(cshSyncTimer); cshSyncTimer = null; }
        cshNeedSync = false;
        cshCloseRoomInfo();   // 確保房間資訊 sheet 不會在離開 ChatSearch 後殘留
        clearCanvasStyle();
        removeStyle('liko-ml-csh-hide');
        removeStyle('liko-ml-csh');
        document.getElementById('liko-csh-shell')?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Dialog 直版模式（drXxx）
    //
    // 原理：
    //   上半螢幕：canvas 顯示左半（人物區，BC 虛擬 x:0~1000）
    //   下半螢幕：mirror canvas 複製主 canvas 右半（Dialog 區，BC 虛擬 x:1000~2000）
    //
    //   點擊下半時，把螢幕座標換算成 BC 虛擬座標，
    //   直接設定 BC 全域 MouseX/MouseY 後 dispatch 點擊事件，
    //   讓 BC 自己處理所有點擊邏輯，不需要移動任何 DOM。
    // ════════════════════════════════════════════════════════════════════════════

    let drActive      = false;
    let drMirrorRAF   = null;   // mirror canvas 的 requestAnimationFrame handle
    let drCapture     = null;   // { overlay, onPointer }

    /** 把下半螢幕點擊座標轉成 BC 虛擬座標，直接觸發 BC 點擊邏輯 */
    function drInjectClick(screenX, screenY, pointerType = 'touch') {
        const vw  = window.innerWidth;
        const cvH = Math.round(window.innerHeight * 0.5);

        // 下半螢幕 (0~vw, cvH~vh) → BC canvas 右半 (vw~vw*2, 0~cvH) 的像素座標。
        // 因為下半螢幕的寬/高分別與 vw / cvH 相同，這其實是 1:1 平移，
        // 不是縮放（原本寫成 (screenX/vw)*vw 容易誤導成有額外比例）。
        const canvasPixelX = vw + screenX;
        const canvasPixelY = screenY - cvH;

        const cv = getCanvas();
        if (!cv) return;
        const rect = cv.getBoundingClientRect();

        // 設定 BC 全域座標（BC 在 click handler / 下一幀 DrawProcess 裡會讀這些）
        if (typeof MouseX !== 'undefined') MouseX = 1000 + (screenX / vw) * 1000;
        if (typeof MouseY !== 'undefined') MouseY = (screenY - cvH) / cvH * 1000;

        const eventOpts = {
            bubbles: true,
            cancelable: true,
            clientX: canvasPixelX + rect.left,
            clientY: canvasPixelY + rect.top,
            pointerType,
            isPrimary: true,
        };

        // 同時 dispatch PointerEvent 與 MouseEvent：
        // - PointerEvent 涵蓋現代瀏覽器對 touch/mouse 統一處理的互動（拖曳、長按等）
        // - MouseEvent 作為相容性後備，給只監聽滑鼠事件的舊邏輯使用
        if (typeof PointerEvent === 'function') {
            cv.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
            cv.dispatchEvent(new PointerEvent('pointerup',   eventOpts));
        }
        cv.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        cv.dispatchEvent(new MouseEvent('mouseup',   eventOpts));
        cv.dispatchEvent(new MouseEvent('click',     eventOpts));

        // 延遲兩個 frame 再把 MouseX/MouseY 重置為 -1：
        // 如果 BC 是在下一幀的 DrawProcess 才讀取座標，單層 rAF 可能會在
        // BC 讀到值之前就把它歸零，導致點擊被判定在畫面外。
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (typeof MouseX !== 'undefined') MouseX = -1;
                if (typeof MouseY !== 'undefined') MouseY = -1;
            });
        });
    }

    // 記錄每個被搬移過的 dialog 元素「上一次我們設定的 left/top」，
    // 用來判斷 BC 這一幀是否重新定位過它 —— 避免每幀都用「目前已被我們
    // 搬移後的座標」再疊加一次位移，造成持續漂移/抖動。
    const drMovedElements = new WeakMap(); // el -> { lastSetLeft, lastSetTop }

    /** 只移動 dialog-root 等頂層容器到下半螢幕，子元素不動（保持相對定位） */
    function drMoveDomElements() {
        if (!drActive) return;
        const vw  = window.innerWidth;
        const cvH = Math.round(window.innerHeight * 0.5);

        document.querySelectorAll('.dialog-root, #color-picker, #layering').forEach(el => {
            const r = el.getBoundingClientRect();
            const prev = drMovedElements.get(el);

            // 如果目前位置就是我們上次設定的位置，代表 BC 這一幀沒有重新
            // 定位它，不需要再做任何事，避免重複疊加位移造成漂移。
            if (prev
                && Math.abs(r.left - prev.lastSetLeft) < 1
                && Math.abs(r.top  - prev.lastSetTop)  < 1) {
                return;
            }

            // 元素在螢幕右側外（超出 vw）才視為「BC 剛重新定位過的原始座標」
            if (r.left < vw * 0.5) return;

            const newLeft = r.left - vw;
            const newTop  = r.top  + cvH;

            el.style.setProperty('left',    newLeft + 'px', 'important');
            el.style.setProperty('top',     newTop  + 'px', 'important');
            el.style.setProperty('z-index', '20', 'important');
            if (el.classList.contains('dialog-root')) {
                el.style.setProperty('width', vw + 'px', 'important');
            }

            drMovedElements.set(el, { lastSetLeft: newLeft, lastSetTop: newTop });
        });
    }

    /** 建立／更新 mirror canvas（複製主 canvas 右半到下半螢幕） */
    function drStartMirror() {
        const cvH = Math.round(window.innerHeight * 0.5);
        const vw  = window.innerWidth;

        // 移除舊的
        document.getElementById('liko-dr-mirror')?.remove();
        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }

        const mirror = document.createElement('canvas');
        mirror.id = 'liko-dr-mirror';
        // 用實際像素大小，避免模糊
        mirror.width  = vw;
        mirror.height = cvH;
        mirror.style.cssText = `
            position: fixed !important;
            top: ${cvH}px !important; left: 0 !important;
            width: ${vw}px !important; height: ${cvH}px !important;
            z-index: 6 !important;
            pointer-events: none !important;
        `;
        document.body.appendChild(mirror);

        const ctx = mirror.getContext('2d');
        const src = getCanvas();
        let frameCount = 0;

        function loop() {
            drMirrorRAF = requestAnimationFrame(loop);
            if (!drActive || !src) return;
            frameCount++;
            // 背景每 2 幀複製一次（30fps 足夠）
            if (frameCount % 2 === 0) {
                ctx.clearRect(0, 0, vw, cvH);
                try { ctx.drawImage(src, 1000, 0, 1000, 1000, 0, 0, vw, cvH); } catch(e) {}
            }
            // DOM 搬移每幀執行（BC 每幀重設位置）
            drMoveDomElements();
        }
        loop();
    }

    function drApply() {
        if (drActive) return;
        drActive = true;

        const cvH = Math.round(window.innerHeight * 0.5);
        forceCanvasStyle(cvH);

        injectStyle('liko-ml-dr', `
        html, body { overflow-x: hidden !important }
        #liko-dr-overlay {
            position: fixed;
            top: ${cvH}px; left: 0;
            width: 100vw; height: calc(100vh - ${cvH}px);
            z-index: 10 !important;
            cursor: pointer;
            -webkit-tap-highlight-color: transparent;
            background: transparent;
        }
        .dialog-root {
            pointer-events: auto !important;
            overflow-y: auto !important;
        }
    `);

        drStartMirror();

        document.getElementById('liko-dr-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.id = 'liko-dr-overlay';

        const onPointer = (e) => {
            if (!drActive) return;
            e.preventDefault();
            e.stopPropagation();
            const x = e.clientX ?? e.changedTouches?.[0]?.clientX;
            const y = e.clientY ?? e.changedTouches?.[0]?.clientY;
            const pointerType = e.type === 'touchstart' ? 'touch' : 'mouse';
            if (x != null && y != null) drInjectClick(x, y, pointerType);
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

        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }
        document.getElementById('liko-dr-mirror')?.remove();

        document.querySelectorAll('.dialog-root, #color-picker, #layering').forEach(el => {
            el.style.removeProperty('left');
            el.style.removeProperty('top');
            el.style.removeProperty('z-index');
            el.style.removeProperty('width');
            drMovedElements.delete(el);
        });

        clearCanvasStyle();
        removeStyle('liko-ml-dr');

        if (drCapture) {
            const { overlay, onPointer } = drCapture;
            overlay.removeEventListener('mousedown',  onPointer);
            overlay.removeEventListener('touchstart', onPointer);
            overlay.remove();
            drCapture = null;
        }
    }

    function drMaintain() {
        if (!drActive) return;
        forceCanvasStyle(Math.round(window.innerHeight * 0.5));
        // mirror canvas 由自己的 rAF loop 維持，不需要額外呼叫
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測（每幀呼叫）
    // ════════════════════════════════════════════════════════════════════════════

    function checkScene() {
        if (!isPortrait()) {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
            return;
        }
        const scr       = typeof CurrentScreen    !== 'undefined' ? CurrentScreen    : '';
        const hasDialog = typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;

        if (scr === 'ChatRoom' && hasDialog) {
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (crActive)  crRemove();
            if (!drActive) drApply();
        } else if (scr === 'ChatRoom' && !hasDialog) {
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
            if (!crActive) crApply();
        } else if (scr === 'ChatSearch') {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (drActive)  drRemove();
            if (!cshActive) cshApply();
        } else if (scr === 'ChatSelect') {
            if (crActive)  crRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
            if (!csActive) csApply();
        } else {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC 函數鉤子（Hooks）
    // ════════════════════════════════════════════════════════════════════════════

    modApi.hookFunction('DialogLoad', 0, (args, next) => {
        const r = next(args);
        if (isPortrait() && !drActive) drApply();
        return r;
    });

    modApi.hookFunction('DialogLeave', 0, (args, next) => {
        const r = next(args);
        if (drActive) drRemove();
        return r;
    });

    modApi.hookFunction('ChatRoomTopMenuPosition', 0, (args, next) => {
        if (crActive) { crMaintain(); return; }
        return next(args);
    });
    modApi.hookFunction('ChatRoomResize', 0, (args, next) => {
        const r = next(args); crMaintain(); return r;
    });
    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
        crRemove(); return next(args);
    });

    modApi.hookFunction('ChatSearchResultResponse', 0, (args, next) => {
        const r = next(args);
        if (cshActive) cshNeedSync = true;
        return r;
    });
    modApi.hookFunction('ChatSearchRun', 0, (args, next) => {
        const r = next(args);
        if (cshActive && cshNeedSync && !cshSyncTimer) {
            cshNeedSync  = false;
            cshSyncTimer = setTimeout(() => {
                cshSyncTimer = null;
                if (cshActive) renderCshList(true);
            }, 100);
        }
        return r;
    });

    modApi.hookFunction('ChatSelectLoad', 0, (args, next) => {
        const r = next(args);
        if (csActive) requestAnimationFrame(buildCsBg);
        return r;
    });
    modApi.hookFunction('ChatSearchLoad', 0, (args, next) => {
        const r = next(args);
        if (cshActive) setTimeout(() => { if (cshActive) renderCshList(); }, 600);
        return r;
    });

    modApi.hookFunction('DrawProcess', 5, (args, next) => {
        next(args);
        checkScene();
        if (crActive) forceCanvasStyle(Math.round(window.innerHeight * 0.5));
        if (drActive) drMaintain();
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 視窗尺寸事件
    // ════════════════════════════════════════════════════════════════════════════
    function isFakeInputVisible() {return crFakeInputActive || !!document.getElementById('liko-cr-fake-input-overlay');}
    function handleResize() {
        if (isFakeInputVisible()) return;

        const p = isPortrait();

        if (crActive) {
            if (!p) crRemove();
            else crMaintain();
        }

        if (csActive) {
            csRemove();
            if (p) csApply();
        }

        if (cshActive) {
            if (!p) cshRemove();
            else renderCshList(false);
        }

        if (drActive) {
            if (!p) drRemove();
            else {
                drMaintain();
                drMoveDomElements();
            }
        }
    }

    // ── 工具：取得視窗高度（排除軟鍵盤）──────────────────────────────────────
    function getLockedVH() {
        return window.visualViewport
            ? window.visualViewport.height
        : window.innerHeight;
    }

    // 監聽 visualViewport resize，防止 overlay 被鍵盤推走
    window.visualViewport?.addEventListener('resize', () => {
        const overlay = document.getElementById('liko-cr-fake-input-overlay');
        if (overlay) overlay.style.height = getLockedVH() + 'px';
    });

    // window.resize 加上簡單的 debounce：部分瀏覽器在 UI 收合/展開過程中會
    // 連續觸發多次 resize，若每次都重建版面（remove + apply）會造成閃爍。
    let resizeDebounceTimer = null;
    function debouncedHandleResize() {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(handleResize, 120);
    }
    window.addEventListener('resize', debouncedHandleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化
    // ════════════════════════════════════════════════════════════════════════════

    function waitForBC() {
        if (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined')
            return setTimeout(waitForBC, 500);

        console.log(`🐈‍⬛ [MPL] ✅ 初始化完成 v${MOD_VER}`);

        // window.Liko.MPL 是給外部（其他 mod / console 除錯）使用的公開 API 物件，
        // 與最上方用來防止重複載入的 window.Liko.MPLLoaded（boolean）是兩個
        // 完全獨立、型別固定的東西。
        window.Liko.MPL = {
            version:            MOD_VER,
            render:             renderCshList,
            refreshSpaceButton: refreshCshSpaceButton,
            getOwnerSet:        () => [...getOwnerSet()],
            getLoverSet:        () => [...getLoverSet()],
            getFriendSet:       () => [...getFriendSet()],
            debugFirstRoom:     () => {
                const room = getCshRoomsSource()[0];
                return room
                    ? { room, relations: getRoomRelations(room), topRelation: getTopRelation(room) }
                : null;
            },
            // screenY 需大於 cvH（下半）才會觸發 dialog 點擊
            testClick: drInjectClick,
            // 強制重建 mirror（解析度改變時）
            rebuildMirror: drStartMirror,
        };
    }

    waitForBC();
})();
