// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.4
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
    const MOD_VER = '0.4';
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

    function isPortrait() { return window.innerWidth < window.innerHeight; }

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
        const canvasPixelX = vw + screenX;
        const canvasPixelY = screenY - cvH;
        const cv = getCanvas();
        if (!cv) return;
        const rect = cv.getBoundingClientRect();

        if (typeof MouseX !== 'undefined') window.MouseX = 1000 + (screenX / vw) * 1000;
        if (typeof MouseY !== 'undefined') window.MouseY = (screenY - cvH) / cvH * 1000;

        const eventOpts = {
            bubbles: true,
            cancelable: true,
            clientX: canvasPixelX + rect.left,
            clientY: canvasPixelY + rect.top,
            pointerType,
            isPrimary: true,
        };

        if (typeof PointerEvent === 'function') {
            // BC 的 GamePointerDown/GamePointerUp 會對收到的 pointerdown/pointerup 呼叫
            // setPointerCapture/releasePointerCapture，但合成事件的 pointerId 沒有對應
            // 真實的活躍 pointer，瀏覽器會丟 NotFoundError。
            // 暫時用空函式取代這兩個方法，dispatch 完畢後在 finally 還原。
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

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {

                if (typeof MouseX !== 'undefined') window.MouseX = -1;
                if (typeof MouseY !== 'undefined') window.MouseY = -1;

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
        const scr = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
        const p   = isPortrait();
        const hasDialog = typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;

        // ── MPL Login ──
        if (scr === 'Login' && p) mplApply();      // MPL Login 的 mplApply
        else if (mplActive)       mplRemove();     // MPL Login 的 mplRemove

        // ── 非直向時全部關掉 ──
        if (!p) {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
            return;
        }
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
    modApi.hookFunction('LoginResponse', 0, (args, next) => {
        const result = next(args);
        if (args[0] && typeof args[0] === 'object')
            setTimeout(captureAndSaveProfile, 4000);
        return result;
    });
    modApi.hookFunction('LoginLoad', 0, (args, next) => {
        const r = next(args);
        if (isPortrait()) setTimeout(mplApply, 50);
        return r;
    });
    modApi.hookFunction('LoginUnload', 0, (args, next) => {
        mplRemove(); return next(args);
    });
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
    // MPL Login
    // ════════════════════════════════════════════════════════════════════════════
    const MPL_KEY       = 'mpl_accounts';
    const IDB_NAME      = 'mpl-profiles';
    const IDB_STORE     = 'profiles';
    const IDB_KEY_STORE = 'cryptokeys';

    // ════════════════════════════════════════════════════════════════════════════
    // 工具
    // ════════════════════════════════════════════════════════════════════════════
    //function isPortrait() { return window.innerWidth <= 768 || window.innerWidth < window.innerHeight; }
    function getBgUrl() {
        const href = window.location.href;
        // 確保 base 有 trailing slash，避免路徑拼接錯誤
        const base = href.includes('/')
        ? href.slice(0, href.lastIndexOf('/') + 1)
        : href + '/';
        const bg = typeof LoginBackground !== 'undefined' ? LoginBackground : 'Dressing';
        return base + 'Backgrounds/' + bg + '.jpg';
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AES-GCM 加密工具
    // ════════════════════════════════════════════════════════════════════════════

    function bufToB64(buf) {
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }
    function b64ToBuf(b64) {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
    }

    let _cryptoKeyPromise = null;

    function getCryptoKey() {
        if (_cryptoKeyPromise) return _cryptoKeyPromise;
        _cryptoKeyPromise = (async () => {
            const db = await openDB();
            const existing = await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE).objectStore(IDB_KEY_STORE).get('mainKey');
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            });
            if (existing?.key) {
                return crypto.subtle.importKey(
                    'jwk', existing.key,
                    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
                );
            }
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
            );
            const exported = await crypto.subtle.exportKey('jwk', key);
            await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE, 'readwrite')
                .objectStore(IDB_KEY_STORE)
                .put({ id: 'mainKey', key: exported });
                req.onsuccess = () => resolve(true);
                req.onerror   = () => resolve(false);
            });
            return key;
        })().catch(e => {
            // 失敗時重置，下次重試
            _cryptoKeyPromise = null;
            return Promise.reject(e);
        });
        return _cryptoKeyPromise;
    }

    async function encryptPassword(plaintext) {
        const key = await getCryptoKey();
        const iv  = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );
        return bufToB64(iv.buffer) + ':' + bufToB64(cipher);
    }

    async function decryptPassword(stored) {
        try {
            const key = await getCryptoKey();
            const [ivB64, cipherB64] = stored.split(':');
            const dec = new TextDecoder();
            const plain = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) },
                key,
                b64ToBuf(cipherB64)
            );
            return dec.decode(plain);
        } catch (e) {
            console.warn('🐈‍⬛ [MPL] 解密失敗:', e);
            return null;
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // IndexedDB（角色快照 + 密鑰）
    // ════════════════════════════════════════════════════════════════════════════

    let _db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const req = indexedDB.open(IDB_NAME, 2);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE))
                    db.createObjectStore(IDB_STORE, { keyPath: 'accountName' });
                if (!db.objectStoreNames.contains(IDB_KEY_STORE))
                    db.createObjectStore(IDB_KEY_STORE, { keyPath: 'id' });
            };
            req.onsuccess = e => { _db = e.target.result; resolve(_db); };
            req.onerror   = () => reject(req.error);
        });
    }

    async function dbGet(accountName) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(accountName);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = () => resolve(null);
        });
    }

    async function dbPut(profile) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(profile);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    async function dbDelete(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return false;

        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite')
            .objectStore(IDB_STORE)
            .delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // localStorage（帳號列表）
    // ════════════════════════════════════════════════════════════════════════════

    function loadAccounts() {
        try { return JSON.parse(localStorage.getItem(MPL_KEY) || '[]'); }
        catch { return []; }
    }

    function saveAccounts(list) {
        localStorage.setItem(MPL_KEY, JSON.stringify(list));
    }

    // 公開介面：加密後存入，回傳正規化後的 key（大寫）
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

    // ════════════════════════════════════════════════════════════════════════════
    // 角色快照（頭像 + 暱稱 + ID）
    // ════════════════════════════════════════════════════════════════════════════

    function makeAvatarDataUrl(size = 48) {
        try {
            const src = Player?.Canvas;
            if (!src || src.width === 0) return null;
            const off = document.createElement('canvas');
            off.width = size; off.height = size;
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#0a0c12';
            ctx.fillRect(0, 0, size, size);
            const sx = src.width * 0.39, sy = src.height * 0.40;
            const sw = src.width * 0.22, sh = src.height * 0.12;
            ctx.drawImage(src, sx, sy, sw, sh, 0, 0, size, size);
            return off.toDataURL('image/jpeg', 0.85);
        } catch { return null; }
    }

    async function captureAndSaveProfile() {
        try {
            if (typeof Player === 'undefined' || !Player?.AccountName) return;
            //統一使用大寫 key，與 localStorage 保持一致
            const accountKey = Player.AccountName.toUpperCase();
            const profile = {
                accountName:   accountKey,
                name:          Player.Name        || '',
                nickname:      Player.Nickname    || null,
                memberNumber:  Player.MemberNumber ?? null,
                avatarDataUrl: makeAvatarDataUrl(56),
                savedAt:       Date.now(),
            };
            await dbPut(profile);
            mplRefreshAccountRow();
        } catch (e) {
            console.warn('🐈‍⬛ [MPL] 快照失敗:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC DOM 隱藏 / 還原
    // ════════════════════════════════════════════════════════════════════════════

    const BC_HIDE_IDS = [
        'InputName', 'InputPassword',
        'login-name-label', 'login-password-label',
        'login-welcome-message', 'login-status',
        'login-login-button', 'login-new-character-label',
        'login-register-button', 'login-password-reset-button',
        'login-password-reset-hint', 'login-cheats-button',
        'login-footer', 'LanguageDropdown',
    ];

    const BC_PASSTHROUGH_IDS = ['fusam-show-button', 'fusam-addon-manager-container'];

    function hideBC() {
        BC_HIDE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', 'none', 'important');
        });
        const cv = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (cv) cv.style.setProperty('display', 'none', 'important');
        ensureFusamVisible();
    }

    let _fusamObserver = null;

    function ensureFusamVisible() {
        BC_PASSTHROUGH_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                applyFusamStyle(el);
                if (id === 'fusam-addon-manager-container') watchFusamContainerRemoval();
            }
        });
        if (!document.getElementById('fusam-show-button') && !_fusamObserver && mplActive) {
            _fusamObserver = new MutationObserver(() => {
                BC_PASSTHROUGH_IDS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && mplActive) {
                        applyFusamStyle(el);
                        if (id === 'fusam-addon-manager-container') watchFusamContainerRemoval();
                    }
                });
            });
            _fusamObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    function applyFusamStyle(el) {
        el.style.removeProperty('display');
        if (el.id === 'fusam-addon-manager-container') {
            let node = el;
            while (node && node !== document.body) {
                node.style.setProperty('z-index', '2000', 'important');
                node.style.setProperty('position', 'relative', 'important');
                node = node.parentElement;
            }
            el.style.setProperty('font-size',     '10px',   'important');
            el.style.setProperty('max-width',      '92vw',   'important');
            el.style.setProperty('max-height',     '80vh',   'important');
            el.style.setProperty('width',          '92vw',   'important');
            el.style.setProperty('height',         '80vh',   'important');
            el.style.setProperty('top',            '10vh',   'important');
            el.style.setProperty('left',           '4vw',    'important');
            el.style.setProperty('border-radius',  '12px',   'important');
            el.style.setProperty('overflow',       'hidden', 'important');
            el.style.setProperty('position',       'fixed',  'important');
        } else {
            el.style.setProperty('position',       'fixed',  'important');
            el.style.setProperty('z-index',        '2000',   'important');
            el.style.setProperty('pointer-events', 'auto',   'important');
        }
    }

    function watchFusamContainerRemoval() {
        const container = document.getElementById('fusam-addon-manager-container');
        if (!container) return;
        const modified = [];
        let node = container;
        while (node && node !== document.body) { modified.push(node); node = node.parentElement; }
        const removalObserver = new MutationObserver(() => {
            if (!document.getElementById('fusam-addon-manager-container')) {
                modified.forEach(n => {
                    n.style.removeProperty('z-index');
                    n.style.removeProperty('position');
                });
                ['font-size','max-width','max-height','width','height','top','left','border-radius','overflow','position']
                    .forEach(p => container.style.removeProperty(p));
                removalObserver.disconnect();
            }
        });
        removalObserver.observe(document.body, { childList: true, subtree: true });
    }

    function showBC() {
        BC_HIDE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.removeProperty('display');
        });
        const cv = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (cv) cv.style.removeProperty('display');
        BC_PASSTHROUGH_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.removeProperty('z-index');
                el.style.removeProperty('position');
                el.style.removeProperty('pointer-events');
            }
        });
        if (_fusamObserver) { _fusamObserver.disconnect(); _fusamObserver = null; }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 樣式注入
    // ════════════════════════════════════════════════════════════════════════════

    function injectStyles() {
        if (document.getElementById('mpl-styles')) return;
        const s = document.createElement('style');
        s.id = 'mpl-styles';
        s.textContent = `
/* ── MPL Login UI ── */
#mpl-bg {
    position: fixed; inset: 0; z-index: 1000;
    background: #0a0c12; overflow: hidden;
}
#mpl-bg-img {
    position: absolute;
    top: 0; left: -150%;
    width: 400%; height: 100%;
    object-fit: cover; object-position: top left;
    pointer-events: none;
}
#mpl-bg-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.38); pointer-events: none;
}
#mpl-bg-fallback {
    position: absolute; inset: 0;
    background-image:
        radial-gradient(ellipse at 30% 60%, rgba(90,50,140,0.38) 0%, transparent 55%),
        radial-gradient(ellipse at 75% 40%, rgba(140,70,100,0.28) 0%, transparent 50%),
        linear-gradient(180deg, #1a1225 0%, #251530 60%, #1e1028 100%);
    pointer-events: none;
}

/* ── 主 UI 層 ── */
#mpl-root {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;
}
#mpl-root > * { pointer-events: auto; }

/* ── 1. 頂部 ── */
#mpl-top {
    width: 100%; padding: 30px 24px 5px;
    text-align: center;
    background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%);
}
#mpl-title {
    font-size: 28px; font-weight: 700; color: #e8dcff;
    letter-spacing: 2px;
    text-shadow: 0 0 24px rgba(167,139,250,0.50);
}
#mpl-status {
    margin-top: 10px; font-size: 19px;
    color: rgba(200,185,255,0.80); min-height: 26px;
    text-shadow: 0 1px 8px rgba(0,0,0,0.8);
}
#mpl-status.error { color: rgba(255,120,120,0.95); }

/* ── 2. 帳號列 ── */
#mpl-accounts-section {
    width: 100%; max-width: 560px; padding: 0 20px;
}

#mpl-accounts-row {
    display: flex; gap: 14px;
    overflow-x: auto; overflow-y: visible;
    scrollbar-width: none;
    padding: 16px 50px 20px;
    cursor: grab; user-select: none;
    justify-content: flex-start;
    perspective: 600px;
    perspective-origin: 50% 50%;
}
#mpl-accounts-row:active { cursor: grabbing; }
#mpl-accounts-row::-webkit-scrollbar { display: none; }

.mpl-acct-card {
    flex-shrink: 0; width: 84px;
    border-radius: 13px;
    border: 1.5px solid rgba(200,180,255,0.25);
    background: rgba(20,14,36,0.68);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    padding: 7px 8px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer; position: relative; user-select: none;
    transition: border-color 0.22s, background 0.22s, transform 0.35s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.35s, opacity 0.35s;
    transform-style: preserve-3d;
    will-change: transform, opacity;
    transform-origin: center center;
}
.mpl-acct-card:hover  { border-color: rgba(200,180,255,0.55); }
.mpl-acct-card.active {
    border-color: rgba(200,170,255,0.80);
    background: rgba(127,83,205,0.22);
    box-shadow: 0 4px 18px rgba(127,83,205,0.35);
}

.mpl-acct-ghost {
    flex-shrink: 0; width: 84px; pointer-events: none; visibility: hidden;
}
.mpl-acct-top-label {
    font-size: 10px; font-weight: 600;
    color: rgba(200,185,255,0.70);
    text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    width: 100%; letter-spacing: 0.3px;
    line-height: 1.2;
}
.mpl-avatar {
    width: 42px; height: 42px; border-radius: 9px;
    background: rgba(127,83,205,0.22); border: 1px solid rgba(200,180,255,0.25);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.mpl-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mpl-avatar-ph { font-size: 20px; }
.mpl-acct-name {
    font-size: 16px; font-weight: 600; color: #ddd5f8;
    text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; width: 100%;
}
.mpl-acct-id  { font-size: 15px; color: rgba(190,175,225,0.55); text-align: center; }
.mpl-acct-del {
    position: absolute; top: 5px; right: 5px;
    width: 16px; height: 16px; border-radius: 4px;
    background: rgba(239,68,68,0.12); border: 0.5px solid rgba(239,68,68,0.30);
    color: rgba(255,130,130,0.75); font-size: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.12s; z-index: 2;
}
.mpl-acct-del:hover { background: rgba(239,68,68,0.30); }

/* ── 3. 主表單 ── */
#mpl-form-section {
    max-width: 420px; padding: 0;
    display: flex; flex-direction: column; gap: 11px;
    align-items: center;
}
.mpl-field {
    display: flex; flex-direction: row;
    align-items: center; gap: 10px;
    width: 100%;
}
.mpl-field-label {
    font-size: 20px; color: rgba(210,195,245,0.75);
    text-shadow: 0 1px 6px rgba(0,0,0,0.7);
    white-space: nowrap; flex-shrink: 0;
    width: 44px; text-align: right;
}
.mpl-input {
    background: #ffffff;
    border: 1.5px solid rgba(200,180,255,0.35);
    border-radius: 11px;
    color: #1a1a2e;
    -webkit-text-fill-color: #1a1a2e;
    padding: 5px 15px; font-size: 21px; font-family: inherit;
    outline: none; flex: 1;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.mpl-input:focus {
    border-color: rgba(127,83,205,0.70);
    box-shadow: 0 0 0 3px rgba(127,83,205,0.15);
}
.mpl-input::placeholder {
    color: rgba(100,90,130,0.55);
    -webkit-text-fill-color: rgba(100,90,130,0.55);
}

/* ── 4. 按鈕列 ── */
#mpl-btn-row {
    width: 70%; max-width: 420px; padding: 0;
    display: flex; flex-direction: column; gap: 8px;
    align-items: stretch;
    margin-top: 10px;
}
#mpl-btn-login {
    width: 100%; padding: 10px;
    background: rgba(127,83,205,0.30);
    border: 1.5px solid rgba(200,170,255,0.55);
    border-radius: 12px; color: #e8dcff;
    font-size: 21px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: background 0.15s;
    text-shadow: 0 0 12px rgba(167,139,250,0.4);
}
#mpl-btn-login:hover    { background: rgba(127,83,205,0.48); }
#mpl-btn-login:disabled { opacity: 0.40; cursor: default; }

#mpl-btn-row-secondary {
    display: flex; gap: 8px; width: 100%;
}
#mpl-btn-save-acct,
#mpl-btn-reset {
    flex: 1; min-width: 0; padding: 10px;
    background: rgba(14,10,28,0.55); backdrop-filter: blur(8px);
    border: 1.5px solid rgba(200,180,255,0.35);
    border-radius: 12px; color: rgba(220,210,245,0.85);
    font-size: 17px; font-family: inherit; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
}
#mpl-btn-save-acct:hover,
#mpl-btn-reset:hover {
    background: rgba(127,83,205,0.22);
    border-color: rgba(200,170,255,0.55);
}
#mpl-privacy-note {
    font-size: 13px; color: rgba(180,170,210,0.45);
    text-align: center; letter-spacing: 0.3px;
    margin-top: 1px;
}

/* ── 5. 建立角色 ── */
#mpl-register-section {
    width: 100%; max-width: 420px; padding: 0 24px;
    display: flex; flex-direction: column; gap: 9px; align-items: center;
}
.mpl-divider { display: flex; align-items: center; gap: 10px; width: 70%; }
.mpl-div-line { flex: 1; height: 0.5px; background: rgba(200,185,230,0.15); }
.mpl-div-text { font-size: 17px; color: rgba(200,185,230,0.45); }
#mpl-btn-register {
    width: 70%; padding: 10px;
    background: rgba(14,10,28,0.55); backdrop-filter: blur(8px);
    border: 1.5px solid rgba(200,180,255,0.28);
    border-radius: 12px; color: rgba(220,210,245,0.85);
    font-size: 20px; font-family: inherit; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
#mpl-btn-register:hover { background: rgba(127,83,205,0.18); border-color: rgba(200,170,255,0.50); }

/* ── 6. 底部 ── */
#mpl-bottom {
    width: 100%; padding: 10px 20px 30px;
    background: linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%);
    display: flex; flex-direction: column; gap: 20px; align-items: center;
}
#mpl-bottom-controls {
    width: 100%; max-width: 560px;
    display: flex; align-items: center; justify-content: center; gap: 10px;
}
#mpl-lang-select {
    background: rgba(14,10,28,0.72);
    border: 1px solid rgba(200,180,255,0.28); border-radius: 8px;
    color: rgba(220,210,245,0.85);
    font-size: 17px;
    padding: 7px 100px 7px 10px;
    font-family: inherit; cursor: pointer;
    flex-shrink: 0;
    appearance: auto; -webkit-appearance: auto;
}
#mpl-settings-btn {
    height: 38px; padding: 0 18px; border-radius: 9px;
    background: rgba(14,10,28,0.72);
    border: 1px solid rgba(200,180,255,0.28);
    color: rgba(220,210,245,0.85); font-size: 17px; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    cursor: pointer; transition: background 0.15s;
    flex-shrink: 0; white-space: nowrap;
}
#mpl-settings-btn:hover { background: rgba(127,83,205,0.28); border-color: rgba(200,170,255,0.50); }

/* 跑馬燈 */
#mpl-marquee-wrap {
    width: 100%; max-width: 560px; overflow: hidden;
    mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
    height: 22px;
}
#mpl-marquee-inner {
    display: flex; gap: 28px; position: relative;
    will-change: transform; white-space: nowrap;
}
.mpl-marquee-item { font-size: 17px; color: rgba(200,185,230,0.40); white-space: nowrap; flex-shrink: 0; }
.mpl-marquee-item span { color: rgba(200,180,255,0.65); }

/* ── 設定浮層 ── */
#mpl-settings-overlay {
    display: none; position: absolute; inset: 0; z-index: 20;
    background: rgba(0,0,0,0.60); backdrop-filter: blur(4px);
    align-items: center; justify-content: center;
}
#mpl-settings-overlay.visible { display: flex; }
#mpl-settings-box {
    background: rgba(14,10,26,0.96); border: 1px solid rgba(200,180,255,0.28);
    border-radius: 16px; padding: 20px; width: min(290px, 88vw);
    display: flex; flex-direction: column; gap: 13px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.5);
}
.mpl-sett-title { font-size: 20px; font-weight: 600; color: #ddd5f8; }
.mpl-sett-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 19px; color: rgba(210,195,240,0.85);
}
.mpl-sett-row input[type=checkbox] { accent-color: #7F53CD; cursor: pointer; width: 18px; height: 18px; }
.mpl-sett-close {
    width: 100%; padding: 9px;
    background: rgba(127,83,205,0.18); border: 1px solid rgba(200,170,255,0.35);
    border-radius: 9px; color: #c4b5fd; font-size: 19px; font-family: inherit; cursor: pointer;
}
        `;
        document.head.appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 狀態字串快取
    // ════════════════════════════════════════════════════════════════════════════

    let _lastStatusMsg   = null;
    let _lastStatusError = null;

    function syncStatus() {
        const el = document.getElementById('mpl-status');
        if (!el) return;

        let msg     = '';
        let isError = false;

        if (typeof LoginErrorMessage !== 'undefined' && LoginErrorMessage) {
            msg = (typeof TextGet === 'function' ? TextGet(LoginErrorMessage) : '') || LoginErrorMessage;
            isError = true;
        } else if (typeof ServerIsConnected !== 'undefined' && !ServerIsConnected) {
            msg = (typeof TextGet === 'function' ? TextGet('ConnectingToServer') : '') || '正在連接伺服器…';
        } else if (typeof LoginQueuePosition !== 'undefined' && LoginQueuePosition !== -1) {
            const tmpl = (typeof TextGet === 'function' ? TextGet('LoginQueueWait') : '') || '排隊中：第 QUEUE_POS 位';
            msg = tmpl.replace('QUEUE_POS', String(LoginQueuePosition));
        } else if (typeof LoginSubmitted !== 'undefined' && LoginSubmitted) {
            msg = (typeof TextGet === 'function' ? TextGet('ValidatingNamePassword') : '') || '正在驗證帳號密碼…';
        } else {
            msg = (typeof TextGet === 'function' ? TextGet('EnterNamePassword') : '') || '請輸入帳號與密碼';
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

    // ════════════════════════════════════════════════════════════════════════════
    // DOM 構建
    // ════════════════════════════════════════════════════════════════════════════

    let mplBg        = null;
    let mplActive    = false;
    let selectedIdx  = null;
    let settingsOpen = false;

    let marqueeRAF   = null;
    let marqueePosX  = 0;
    let marqueeLastT = null;
    let marqueeHalfW = 0;
    const marqueeSpeed = 28;

    const THANK_YOU_LIST = [
        'AlexG','Amazing','Andres','Asriel','Aybes','Brad','bryce','Canti',
        'Cerberus','Christian','Cm382714','Deamonfox','Desch','Dragokahn',
        'dynilath','EBXD','Exusiai','Fabian','fumoffu','George','Greendragon',
        'Hhhhh','I.F.S.','jazzybanana','Jerry','John','Jonas','Kim','Laurie',
        'Michel','Mindtie','Misa','NeReFox','Nikita','PristessSakura','Salix',
        'ShadeofBrass','shadowhack','Soulcollar','Spare2','Sticks','Sunny',
        'Tam','Tarram1010','Teli','Thkdt','Troubadix','Troy','Ultimate',
        'Verena','WhiteSniper','Witchy','XDWolfie','Xepherio',
    ];

    function buildUI() {
        if (document.getElementById('mpl-bg')) return;

        mplBg = document.createElement('div');
        mplBg.id = 'mpl-bg';

        const bgImg = document.createElement('img');
        bgImg.id = 'mpl-bg-img'; bgImg.alt = '';
        bgImg.onerror = () => { bgImg.style.display = 'none'; };
        bgImg.src = getBgUrl();
        const bgOverlay  = document.createElement('div'); bgOverlay.id  = 'mpl-bg-overlay';
        const bgFallback = document.createElement('div'); bgFallback.id = 'mpl-bg-fallback';
        mplBg.appendChild(bgFallback);
        mplBg.appendChild(bgImg);
        mplBg.appendChild(bgOverlay);

        const settOverlay = document.createElement('div'); settOverlay.id = 'mpl-settings-overlay';
        const settBox = document.createElement('div'); settBox.id = 'mpl-settings-box';
        settBox.innerHTML = `
            <div class="mpl-sett-title">⚙ 登入頁面設定</div>
            <div class="mpl-sett-row">
                <span>顯示感謝跑馬燈</span>
                <input type="checkbox" id="mpl-sett-marquee" checked>
            </div>
            <div class="mpl-sett-row">
                <span>顯示帳號卡片列</span>
                <input type="checkbox" id="mpl-sett-accts" checked>
            </div>
            <button class="mpl-sett-close" id="mpl-sett-close-btn">關閉</button>
        `;
        settOverlay.appendChild(settBox);
        settOverlay.addEventListener('click', e => { if (e.target === settOverlay) closeSettings(); });
        mplBg.appendChild(settOverlay);

        const root = document.createElement('div'); root.id = 'mpl-root';

        // ── 1. 頂部 ──
        const top = document.createElement('div'); top.id = 'mpl-top';
        top.innerHTML = `
            <div id="mpl-title">Bondage Club</div>
            <div id="mpl-status"></div>
        `;
        root.appendChild(top);

        // ── 2. 帳號列 ──
        const acctSection = document.createElement('div'); acctSection.id = 'mpl-accounts-section';
        acctSection.innerHTML = `
            <div id="mpl-accounts-row"></div>
        `;
        root.appendChild(acctSection);

        // ── 3. 主表單 ──
        const formSection = document.createElement('div'); formSection.id = 'mpl-form-section';
        formSection.innerHTML = `
            <div class="mpl-field">
                <div class="mpl-field-label">帳號</div>
                <input class="mpl-input" id="mpl-input-name" type="text"
                       placeholder="輸入帳號" autocomplete="username" enterkeyhint="next">
            </div>
            <div class="mpl-field">
                <div class="mpl-field-label">密碼</div>
                <input class="mpl-input" id="mpl-input-pass" type="password"
                       placeholder="輸入密碼" autocomplete="current-password" enterkeyhint="go">
            </div>
        `;
        root.appendChild(formSection);

        // ── 4. 按鈕列 ──
        const btnRow = document.createElement('div'); btnRow.id = 'mpl-btn-row';
        btnRow.innerHTML = `
            <button id="mpl-btn-login">登入</button>
            <div id="mpl-btn-row-secondary">
                <button id="mpl-btn-save-acct">保存帳號</button>
                <button id="mpl-btn-reset">修改密碼</button>
            </div>
            <div id="mpl-privacy-note">帳戶已 AES-GCM 加密，僅存於本地裝置</div>
        `;
        root.appendChild(btnRow);

        // ── 5. 建立角色 ──
        const regSection = document.createElement('div'); regSection.id = 'mpl-register-section';
        regSection.innerHTML = `
            <div class="mpl-divider">
                <div class="mpl-div-line"></div>
                <span class="mpl-div-text">或</span>
                <div class="mpl-div-line"></div>
            </div>
            <button id="mpl-btn-register">建立新角色</button>
        `;
        root.appendChild(regSection);

        // ── 6. 底部 ──
        const bottom = document.createElement('div'); bottom.id = 'mpl-bottom';
        bottom.innerHTML = `
            <div id="mpl-bottom-controls">
                <select id="mpl-lang-select"></select>
                <button id="mpl-settings-btn">⚙ 設定</button>
            </div>
            <div id="mpl-marquee-wrap">
                <div id="mpl-marquee-inner"></div>
            </div>
        `;
        root.appendChild(bottom);

        mplBg.appendChild(root);
        document.body.appendChild(mplBg);

        bindEvents();
        buildLanguageSelect();
        buildMarquee();
        mplRefreshAccountRow();
        syncStatus();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 事件綁定
    // ════════════════════════════════════════════════════════════════════════════

    function bindEvents() {
        document.getElementById('mpl-input-name').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('mpl-input-pass').focus();
        });
        document.getElementById('mpl-input-pass').addEventListener('keydown', e => {
            if (e.key === 'Enter') doLogin();
        });

        document.getElementById('mpl-btn-login').addEventListener('click', doLogin);

        document.getElementById('mpl-btn-save-acct').addEventListener('click', async () => {
            const name = document.getElementById('mpl-input-name')?.value.trim();
            const pass = document.getElementById('mpl-input-pass')?.value;
            if (!name || !pass) return;
            const key = await addOrUpdateAccount(name, pass);

            const accounts = loadAccounts();
            const newIdx = accounts.findIndex(a => a.accountName === key);
            if (newIdx >= 0) selectedIdx = newIdx;
            mplRefreshAccountRow();
        });

        document.getElementById('mpl-btn-reset').addEventListener('click', () => {
            if (typeof CommonSetScreen === 'function')
                CommonSetScreen('Character', 'PasswordReset');
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
                    if (typeof CharacterAppearanceSetDefault === 'function')
                        CharacterAppearanceSetDefault(Player);
                    if (typeof CharacterAppearanceLoadCharacter === 'function')
                        CharacterAppearanceLoadCharacter(Player, r =>
                                                         CommonSetScreen('Character', r ? 'Creation' : 'Login'));
                });
            }
        });

        document.getElementById('mpl-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('mpl-sett-close-btn').addEventListener('click', closeSettings);

        // 語言切換只呼叫 BC 自身的切換流程一次，避免雙重觸發
        document.getElementById('mpl-lang-select').addEventListener('change', function() {
            const code = this.value;
            // 優先透過原生 dropdown 觸發 BC 的完整切換流程（含翻譯載入）
            const langEl = document.getElementById('LanguageDropdown');
            if (langEl) {
                if (langEl.value !== code) {
                    langEl.value = code;
                    langEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (typeof TranslationSwitchLanguage === 'function') {
                // 若原生 dropdown 不存在（尚未渲染）才直接呼叫
                TranslationSwitchLanguage(code || 'EN');
                if (typeof TextLoad === 'function') TextLoad();
                if (typeof ActivityDictionaryLoad === 'function') ActivityDictionaryLoad();
                if (typeof AssetLoadDescription === 'function') AssetLoadDescription('Female3DCG');
            }
            setTimeout(() => { _lastStatusMsg = null; syncStatus(); }, 100);
        });

        document.getElementById('mpl-sett-marquee').addEventListener('change', function() {
            document.getElementById('mpl-marquee-wrap').style.display = this.checked ? '' : 'none';
        });
        document.getElementById('mpl-sett-accts').addEventListener('change', function() {
            document.getElementById('mpl-accounts-section').style.display = this.checked ? '' : 'none';
        });

        initRowDrag();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Coverflow 旋轉選單
    // ════════════════════════════════════════════════════════════════════════════

    function updateCoverflowTransforms() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        const cards = row.querySelectorAll('.mpl-acct-card:not(.mpl-acct-ghost)');
        if (!cards.length) return;
        const rowRect   = row.getBoundingClientRect();
        const rowCenter = rowRect.left + rowRect.width / 2;

        cards.forEach(card => {
            const rect   = card.getBoundingClientRect();
            const cardCx = rect.left + rect.width / 2;
            const dist   = cardCx - rowCenter;
            const absD   = Math.abs(dist);
            const maxDist = rowRect.width * 0.55;
            const t      = Math.min(absD / maxDist, 1);

            const rotateY = dist > 0 ? -35 * t : 35 * t;
            const scale   = 1 - 0.22 * t;
            const opacity = 1 - 0.40 * t;
            const transX  = dist > 0 ? -12 * t : 12 * t;

            card.style.transform = `translateX(${transX}px) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity   = opacity;
            card.style.zIndex    = Math.round((1 - t) * 10);
        });
    }

    function initRowDrag() {
        const el = document.getElementById('mpl-accounts-row');
        if (!el) return;
        let isDown = false, startX = 0, scrollLeft = 0;

        el.addEventListener('scroll', updateCoverflowTransforms, { passive: true });
        el.addEventListener('mousedown', e => {
            isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
        });
        el.addEventListener('mouseleave', () => { isDown = false; });
        el.addEventListener('mouseup',    () => { isDown = false; });
        el.addEventListener('mousemove',  e => {
            if (!isDown) return;
            e.preventDefault();
            el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX);
        });
        el.addEventListener('touchstart', e => {
            startX = e.touches[0].pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
        }, { passive: true });
        el.addEventListener('touchmove', e => {
            el.scrollLeft = scrollLeft - (e.touches[0].pageX - el.offsetLeft - startX);
        }, { passive: true });

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
                opt.value = bcOpt.value;
                opt.textContent = bcOpt.textContent;
                opt.selected = bcOpt.value === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        if (
            typeof TranslationDictionary !== 'undefined' &&
            Array.isArray(TranslationDictionary) &&
            TranslationDictionary.length > 0
        ) {
            TranslationDictionary.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.LanguageCode;
                opt.textContent =
                    (l.Icon ? l.Icon + ' ' : '') +
                    (l.LanguageName || l.EnglishName || l.LanguageCode);
                opt.selected = l.LanguageCode === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        const fallbackOpt = document.createElement('option');
        fallbackOpt.value = 'EN';
        fallbackOpt.textContent = 'English';
        fallbackOpt.selected = currentLang === 'EN';
        sel.appendChild(fallbackOpt);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 帳號列渲染
    // ════════════════════════════════════════════════════════════════════════════

    function mplRefreshAccountRow() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        row.innerHTML = '';

        const accounts = loadAccounts();

        const ghostBefore = document.createElement('div');
        ghostBefore.className = 'mpl-acct-ghost';
        row.appendChild(ghostBefore);

        // 收集所有 dbGet Promise，等全部完成後才計算 coverflow，避免非同步插入造成位置跳動
        const profilePromises = accounts.map((acct, idx) => {
            const card = document.createElement('div');
            card.className = 'mpl-acct-card' + (selectedIdx === idx ? ' active' : '');

            const topLabel = document.createElement('div');
            topLabel.className = 'mpl-acct-top-label';
            topLabel.textContent = acct.accountName;

            const del = document.createElement('div');
            del.className = 'mpl-acct-del'; del.textContent = '✕';
            del.addEventListener('click', e => { e.stopPropagation(); deleteAccount(idx); });

            const av = document.createElement('div'); av.className = 'mpl-avatar';
            const ph = document.createElement('span'); ph.className = 'mpl-avatar-ph'; ph.textContent = '🐈';
            av.appendChild(ph);

            const nm = document.createElement('div'); nm.className = 'mpl-acct-name';
            nm.textContent = acct.accountName;
            const id = document.createElement('div'); id.className = 'mpl-acct-id';
            id.textContent = '';

            card.appendChild(del);
            card.appendChild(topLabel);
            card.appendChild(av);
            card.appendChild(nm);
            card.appendChild(id);
            card.addEventListener('click', () => selectAccount(idx));
            row.appendChild(card);

            // 回傳 Promise，待非同步資料就緒後更新該卡片
            return dbGet(acct.accountName).then(profile => {
                if (!profile) return;
                const displayName = profile.nickname || profile.name || acct.accountName;
                nm.textContent = displayName;
                if (profile.memberNumber) id.textContent = '#' + profile.memberNumber;
                if (profile.avatarDataUrl) {
                    const img = document.createElement('img');
                    img.src = profile.avatarDataUrl; img.alt = displayName;
                    av.innerHTML = ''; av.appendChild(img);
                }
            });
        });

        const ghostAfter = document.createElement('div');
        ghostAfter.className = 'mpl-acct-ghost';
        row.appendChild(ghostAfter);

        // 同步 DOM 先算一次（讓卡片位置穩定），非同步資料到後再算一次
        requestAnimationFrame(updateCoverflowTransforms);
        Promise.all(profilePromises).then(() => requestAnimationFrame(updateCoverflowTransforms));
    }

    // 點選帳號卡片：解密後填入輸入框，解密失敗（回傳 null）時清空欄位，而非填入 null
    function selectAccount(idx) {
        selectedIdx = idx;
        const acct = loadAccounts()[idx];
        if (!acct) return;

        const currentSelection = idx;
        const nameEl = document.getElementById('mpl-input-name');
        const passEl = document.getElementById('mpl-input-pass');

        if (nameEl) nameEl.value = acct.accountName;
        if (passEl) passEl.value = '';

        decryptPassword(acct.password).then(plain => {
            if (selectedIdx !== currentSelection) return;
            const el = document.getElementById('mpl-input-pass');
            if (el) el.value = plain ?? '';
        });

        mplRefreshAccountRow();
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

    // ════════════════════════════════════════════════════════════════════════════
    // 設定浮層
    // ════════════════════════════════════════════════════════════════════════════

    function toggleSettings() {
        settingsOpen = !settingsOpen;
        document.getElementById('mpl-settings-overlay')?.classList.toggle('visible', settingsOpen);
    }

    function closeSettings() {
        settingsOpen = false;
        document.getElementById('mpl-settings-overlay')?.classList.remove('visible');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 登入
    // ════════════════════════════════════════════════════════════════════════════

    function doLogin() {
        const name = document.getElementById('mpl-input-name')?.value || '';
        const pass = document.getElementById('mpl-input-pass')?.value || '';
        if (!name || !pass) {
            _lastStatusMsg = null; _lastStatusError = null;
            const el = document.getElementById('mpl-status');
            if (el) { el.textContent = '請輸入帳號與密碼'; el.classList.add('error'); }
            _lastStatusMsg = '請輸入帳號與密碼'; _lastStatusError = true;
            return;
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const bcName = document.getElementById('InputName');
        const bcPass = document.getElementById('InputPassword');
        if (bcName && setter) { setter.call(bcName, name); bcName.dispatchEvent(new Event('input', { bubbles: true })); }
        if (bcPass && setter) { setter.call(bcPass, pass); bcPass.dispatchEvent(new Event('input', { bubbles: true })); }

        if (typeof LoginDoLogin === 'function') LoginDoLogin(name, pass);
        else document.getElementById('login-login-button')?.click();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 跑馬燈
    // ════════════════════════════════════════════════════════════════════════════

    function buildMarquee() {
        const inner = document.getElementById('mpl-marquee-inner');
        if (!inner) return;
        inner.innerHTML = '';
        [...THANK_YOU_LIST, ...THANK_YOU_LIST].forEach(name => {
            const el = document.createElement('span');
            el.className = 'mpl-marquee-item';
            el.innerHTML = `感謝 <span>${name}</span>`;
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
        function step(ts) {
            if (!mplActive) { marqueeRAF = null; return; }
            if (!marqueeLastT) marqueeLastT = ts;
            const dt = Math.min((ts - marqueeLastT) / 1000, 0.05);
            marqueeLastT = ts;
            marqueePosX -= marqueeSpeed * dt;
            if (marqueeHalfW > 0 && marqueePosX <= -marqueeHalfW) marqueePosX += marqueeHalfW;
            const inner = document.getElementById('mpl-marquee-inner');
            if (inner) inner.style.transform = `translateX(${marqueePosX}px)`;
            marqueeRAF = requestAnimationFrame(step);
        }
        marqueeRAF = requestAnimationFrame(step);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 啟用 / 停用
    // ════════════════════════════════════════════════════════════════════════════

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
        _lastStatusMsg = null; _lastStatusError = null;
        _statusTimer = setInterval(syncStatus, 500);
    }

    function mplRemove() {
        if (!mplActive) return;
        mplActive = false;
        showBC();
        if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
        if (marqueeRAF)   { cancelAnimationFrame(marqueeRAF); marqueeRAF = null; }
        const bg = document.getElementById('mpl-bg');
        if (bg) bg.style.display = 'none';
    }

    function init() {
        injectStyles();
        hookDrawProcess();
        getCryptoKey().then(() => {
        }).catch(e => {
            console.warn('🐈‍⬛ [MPL] 加密系統初始化失敗:', e);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化
    // ════════════════════════════════════════════════════════════════════════════

    function waitForBC() {
        if (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined')
            return setTimeout(waitForBC, 500);

        // MPL Login 初始化
        injectStyles();        // MPL Login 的樣式
        getCryptoKey().catch(e => console.warn('[MPL] 加密系統初始化失敗:', e));

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
