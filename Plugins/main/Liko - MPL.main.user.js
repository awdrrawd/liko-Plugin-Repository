// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.2.0
// @description    Supports vertical layout for ChatSearch and ChatRoom
// @description:zh 支援房間搜尋與聊天室的直版佈局
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon           https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @author         Likolisu
// @grant          none
// @require        https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    'use strict';
    window.Liko = window.Liko ?? {};
    const MOD_VER = '0.2.0';
    if (window.Liko.MPL) return;
    window.Liko.MPL = MOD_VER;

    const modApi = bcModSdk.registerMod({
        name:'Liko - MPL', fullName:'Mobile Portrait Layout', version:MOD_VER,
        repository: 'Supports vertical layout for ChatSearch and ChatRoom, This is a trial piece; continuous updates are not guaranteed.',
    });

    // ─── 常數 ───────────────────────────────────────────────────────────────────
    const PORTRAIT_MAX_WIDTH = 768;
    const MENU_PX            = 44;
    const CARD_MIN_H         = 82;
    const CARD_GAP           = 5;

    // ════════════════════════════════════════════════════════════════════════════
    // 工具函數
    // ════════════════════════════════════════════════════════════════════════════

    function isPortrait() {
        return window.innerWidth <= PORTRAIT_MAX_WIDTH || window.innerWidth < window.innerHeight;
    }

    function getCanvas() {
        return document.getElementById('MainCanvas') || document.querySelector('canvas');
    }

    function gameBase() {
        const ver = typeof GameVersion !== 'undefined' ? GameVersion : 'R128';
        return `https://www.bondageprojects.elementfx.com/${ver}/BondageClub/`;
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

    function forceCanvasStyle(cvH) {
        const cv = getCanvas();
        if (!cv) return;
        const vw = window.innerWidth;
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
        if (!cv) return;
        ['position','top','left','transform','width','height','z-index','margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 玩家關係工具
    //   依賴：Player 全域變數（由 BC 提供）
    // ════════════════════════════════════════════════════════════════════════════

    /** 遞迴收集物件中的成員編號（數字 or 純數字字串） */
    function collectMemberNumbers(value, seen = new Set()) {
        const out = new Set();
        const walk = (v) => {
            if (v == null) return;
            if (typeof v === 'number' && Number.isFinite(v)) { out.add(Number(v)); return; }
            if (typeof v === 'string' && /^\d+$/.test(v))    { out.add(Number(v)); return; }
            if (typeof v !== 'object') return;
            if (seen.has(v)) return;
            seen.add(v);
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
        [Player.FriendList, Player.FriendNames, Player.OnlineSharedSettings?.FriendList]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    /** 回傳成員與玩家的關係：'owner' | 'lover' | 'friend' | null */
    function getRelation(memberNumber) {
        const mn = Number(memberNumber);
        if (!Number.isFinite(mn)) return null;
        if (getOwnerSet().has(mn)) return 'owner';
        if (getLoverSet().has(mn)) return 'lover';
        if (getFriendSet().has(mn)) return 'friend';
        return null;
    }

    /** 關係中文標籤 */
    function getRelationLabel(rel) {
        return rel === 'owner' ? '主人' : rel === 'lover' ? '戀人' : rel === 'friend' ? '好友' : '';
    }

    /** 取得房間內與玩家有關係的成員列表，依關係優先度排序 */
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

    /** 取得房間中最高優先度的關係 */
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
        } catch {
            return false;
        }
    }

    function getCurrentSpace() {
        if (typeof ChatSearchGetSpace === 'function') return ChatSearchGetSpace();
        return typeof ChatSearchSpace !== 'undefined' ? ChatSearchSpace : 'X';
    }

    /** 依目前狀態決定空間切換按鈕顯示的圖示 */
    function getSpaceButtonIcon() {
        const base = gameBase();
        if (playerHasMaleGender() || getCurrentSpace() === 'X')
            return base + 'Icons/Gender.png';
        return base + 'Screens/Online/ChatSelect/Female.png';
    }

    /** 依目前狀態決定空間切換按鈕的 aria-label */
    function getSpaceButtonLabel() {
        if (playerHasMaleGender()) return '目前在混區（含 M 角色固定混區）';
        return getCurrentSpace() === 'X'
            ? '目前在混區，點擊切換到女區'
            : '目前在女區，點擊切換到混區';
    }

    /** 計算下一個要切換的空間 */
    function getToggleTargetSpace() {
        if (playerHasMaleGender()) return 'X';
        return getCurrentSpace() === 'X' ? '' : 'X';
    }

    /** 套用空間並觸發搜尋 */
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
    let crOrigRect = null;   // 僅於第一次進入時儲存，離開後清除

    function crCalc() {
        const vw = window.innerWidth, vh = window.innerHeight;
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
        crActive = true;
        const L = crCalc();
        injectStyle('liko-ml-cr', `
            html, body { overflow-x: hidden !important }
            #chat-room-top-menu { position: fixed !important; z-index: 15 !important }
            #chat-room-div      { position: fixed !important; z-index: 10 !important }
        `);
        forceCanvasStyle(L.cvH);
        // 僅在尚未儲存時記錄原始 Rect（避免 crRemove 後再 crApply 覆蓋還原值）
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
        });
    }

    function crRemove() {
        if (!crActive) return;
        crActive = false;
        clearCanvasStyle();
        removeStyle('liko-ml-cr');
        if (crOrigRect && typeof ChatRoomDivRect !== 'undefined')
            [0, 1, 2, 3].forEach(i => ChatRoomDivRect[i] = crOrigRect[i]);
        // 離開後清除，確保下次進入房間能重新記錄正確的原始值
        crOrigRect = null;
        if (typeof ChatRoomResize === 'function') try { ChatRoomResize(false); } catch {}
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSelect 直版模式（csXxx）
    // ════════════════════════════════════════════════════════════════════════════

    let csActive = false;

    function csApply() {
        csActive = true;
        const base = gameBase();
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

            /* 離開按鈕 */
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

            /* 選項列 */
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
        const base = gameBase();
        const T = typeof TextGet === 'function' ? TextGet : k => k;

        const bg = document.createElement('div'); bg.id = 'liko-cs-bg';

        const bgImg = document.createElement('img'); bgImg.id = 'liko-cs-bg-img';
        bgImg.src = base + 'Backgrounds/BrickWall.jpg'; bgImg.alt = '';
        bg.appendChild(bgImg);

        const ol = document.createElement('div'); ol.id = 'liko-cs-overlay';

        // 離開按鈕
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

        // 三個選項按鈕
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

    let cshActive    = false;
    let cshSyncTimer = null;
    let cshNeedSync  = false;
    let cshPage      = 1;
    let cshRoomsCache = [];

    // BC 原生元素 ID（搜尋模式啟動時隱藏）
    const CSH_BC_IDS = [
        'chat-search-room-header',
        'chat-search-body',
        'chat-search-room-grid',
        'chat-search-search-menu',
        'chat-search-filter-help-screen',
    ];

    // ── 資料來源 ────────────────────────────────────────────────────────────────

    function getCshRoomsSource() {
        if (typeof ChatSearchGetRooms === 'function') {
            const rooms = ChatSearchGetRooms();
            return Array.isArray(rooms) ? rooms.slice() : [];
        }
        if (typeof ChatSearchResult !== 'undefined' && Array.isArray(ChatSearchResult))
            return ChatSearchResult.slice();
        return [];
    }

    /** 依視窗高度計算每頁最多顯示幾間房間（2 欄） */
    function calcCshPerPage() {
        const HEADER_H = 52, FOOTER_H = 48, PADDING = 12;
        const listH = window.innerHeight - HEADER_H - FOOTER_H - PADDING * 2;
        const rows = Math.max(1, Math.floor(listH / (CARD_MIN_H + CARD_GAP)));
        return rows * 2;
    }

    // ── 房間資訊頁籤工具 ────────────────────────────────────────────────────────

    function buildRoomTags(room) {
        const tags = [];
        if (room.Space     !== undefined && typeof ChatSearchGetSpaceName    === 'function') tags.push(ChatSearchGetSpaceName(room.Space));
        if (room.Language               && typeof ChatSearchGetLanguageName  === 'function') tags.push(ChatSearchGetLanguageName(room.Language));
        if (room.Game                   && typeof TextGet                    === 'function') tags.push(TextGet(room.Game) || room.Game);
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

    // ── 空間切換按鈕狀態刷新 ────────────────────────────────────────────────────

    function refreshCshSpaceButton() {
        const btn = document.getElementById('liko-csh-space-btn');
        if (!btn) return;
        const img = btn.querySelector('img');
        if (img) img.src = getSpaceButtonIcon();
        btn.setAttribute('aria-label', getSpaceButtonLabel());
        btn.style.opacity   = playerHasMaleGender() ? '0.85' : '1';
        btn.dataset.locked  = playerHasMaleGender() ? 'true' : 'false';
    }

    // ── CSS ─────────────────────────────────────────────────────────────────────

    function cshApply() {
        cshActive   = true;
        cshNeedSync = false;
        const HEADER_H = 52, FOOTER_H = 48;

        forceCanvasStyle(0);

        // 隱藏 BC 原生介面
        injectStyle('liko-ml-csh-hide',
            CSH_BC_IDS.map(id => `#${id} { display: none !important }`).join('\n'));

        injectStyle('liko-ml-csh', `
            html, body { overflow-x: hidden !important }

            /* ── Shell ── */
            #liko-csh-shell {
                position: fixed; inset: 0; z-index: 50;
                display: flex; flex-direction: column;
                background: #0a0a14; overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }

            /* ── Header ── */
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

            /* 標頭按鈕（無 hover，僅 active） */
            .liko-csh-hbtn {
                flex-shrink: 0; width: 36px; height: 36px; border-radius: 9px;
                border: 1px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.07);
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; padding: 0;
            }
            .liko-csh-hbtn img { width: 22px; height: 22px; object-fit: contain; }
            .liko-csh-hbtn:active { background: rgba(255,255,255,0.18); }
            .liko-csh-hbtn.create {
                border-color: rgba(120,80,220,0.60);
                background: rgba(100,60,200,0.25);
            }

            /* ── 房間列表（2 欄 Grid） ── */
            #liko-csh-list {
                flex: 1; overflow-y: auto; overflow-x: hidden;
                display: grid; grid-template-columns: 1fr 1fr;
                gap: ${CARD_GAP}px; padding: 6px; box-sizing: border-box;
                align-content: start;
            }
            #liko-csh-list::-webkit-scrollbar { width: 3px; }
            #liko-csh-list::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.18); border-radius: 2px;
            }

            /* 房間卡片 */
            .liko-csh-card {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 10px; padding: 7px 8px;
                cursor: pointer;
                display: flex; flex-direction: column; gap: 3px;
                min-height: ${CARD_MIN_H}px;
                box-sizing: border-box; position: relative;
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

            /* 卡片頂列 */
            .liko-csh-card-top { display: flex; align-items: flex-start; gap: 3px; padding-right: 22px; }
            .liko-csh-card-lock { font-size: 11px; flex-shrink: 0; line-height: 1.4; }
            .liko-csh-card-name {
                font-size: 12px; font-weight: 600; color: #f0e8ff;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
            }

            /* 資訊按鈕 */
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

            /* 卡片其他文字 */
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

            /* 卡片底列 */
            .liko-csh-card-foot {
                display: flex; justify-content: flex-start; align-items: center;
                font-size: 10px; color: rgba(160,200,255,0.72);
                padding-top: 2px; margin-top: auto; gap: 5px;
            }
            .liko-csh-card-count { white-space: nowrap; }
            .liko-csh-card-count.full { color: rgba(255,90,90,0.98); font-weight: 800; }

            /* 關係標籤（帶色點） */
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

            /* 空狀態 */
            .liko-csh-empty {
                grid-column: 1 / -1; text-align: center;
                color: rgba(255,255,255,0.28); font-size: 13px; padding: 50px 0;
            }

            /* ── Footer ── */
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

            /* ── 房間資訊底板（bottom sheet） ── */
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

    // ── UI 建構 ─────────────────────────────────────────────────────────────────

    /** 建立標頭小按鈕（圖示 + aria-label，無 title tooltip） */
    function makeHBtn(imgSrc, ariaLabel, onClick, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = 'liko-csh-hbtn' + (extraClass ? ' ' + extraClass : '');
        btn.setAttribute('aria-label', ariaLabel);
        if (imgSrc) {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.style.cssText = 'width:22px;height:22px;object-fit:contain;pointer-events:none;';
            img.onerror = () => { img.style.display = 'none'; btn.textContent = ariaLabel.slice(0, 2); };
            btn.appendChild(img);
        }
        if (onClick) btn.addEventListener('click', onClick);
        return btn;
    }

    function buildCshShell() {
        document.getElementById('liko-csh-shell')?.remove();
        const base = gameBase();

        const shell = document.createElement('div'); shell.id = 'liko-csh-shell';

        // ── Header ──────────────────────────────────────────────────
        const header = document.createElement('div'); header.id = 'liko-csh-header';

        // 搜尋框
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

        // 篩選按鈕
        header.appendChild(makeHBtn(base + 'Icons/Search.png', '篩選', () => {
            const bcFilterBtn = document.querySelector('#chat-search-room-header button[id*="filter"]');
            if (bcFilterBtn) { bcFilterBtn.style.removeProperty('display'); bcFilterBtn.click(); }
        }));

        // 空間切換按鈕
        const spaceBtn = makeHBtn(getSpaceButtonIcon(), getSpaceButtonLabel(), () => {
            if (playerHasMaleGender()) { refreshCshSpaceButton(); return; }
            const q = inp.value ?? (typeof ChatSearchQueryString !== 'undefined' ? ChatSearchQueryString : '');
            applySpace(getToggleTargetSpace(), q);
            refreshCshSpaceButton();
        });
        spaceBtn.id = 'liko-csh-space-btn';
        header.appendChild(spaceBtn);

        // 建立房間按鈕
        header.appendChild(makeHBtn(base + 'Icons/Plus.png', '建立房間', () => {
            const bcCreate = document.querySelector('#chat-search-room-header button[id*="create"]')
                          || document.querySelector('[id*="chat-search"][id*="create"]');
            if (bcCreate) { bcCreate.style.removeProperty('display'); bcCreate.click(); return; }
            if (typeof ChatSearchCreateRoom === 'function') ChatSearchCreateRoom();
        }, 'create'));

        shell.appendChild(header);

        // ── 列表區 ──────────────────────────────────────────────────
        const list = document.createElement('div'); list.id = 'liko-csh-list';
        shell.appendChild(list);

        // ── Footer ──────────────────────────────────────────────────
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
            const bcExit = document.querySelector('#chat-search-room-header button[id*="exit"]')
                        || document.querySelector('[id*="chat-search"][id*="exit"]');
            if (bcExit) { bcExit.click(); return; }
            if (typeof ChatSearchExit === 'function') ChatSearchExit();
            else if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSelect');
        });
        footRight.appendChild(exitBtn);

        footer.appendChild(footLeft); footer.appendChild(footPages); footer.appendChild(footRight);
        shell.appendChild(footer);

        // 儲存分頁控件參照，供 renderCshList 更新
        shell._prev     = prevBtn;
        shell._next     = nextBtn;
        shell._pageInfo = pageInfo;

        document.body.appendChild(shell);

        // 若玩家有男性角色，強制切到混區
        if (playerHasMaleGender() && getCurrentSpace() !== 'X')
            applySpace('X', inp.value ?? '');

        refreshCshSpaceButton();
        renderCshList();
    }

    /** 渲染房間列表（從 BC 取資料） */
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
            for (const room of pageRooms) {
                list.appendChild(buildRoomCard(room));
            }
        }

        if (shell) {
            shell._prev.className     = 'liko-csh-page-btn' + (cshPage > 1          ? '' : ' disabled');
            shell._next.className     = 'liko-csh-page-btn' + (cshPage < totalPages ? '' : ' disabled');
            shell._pageInfo.textContent = totalRooms > 0 ? `${cshPage}/${totalPages} · ${totalRooms}間` : '0/0';
        }
        refreshCshSpaceButton();
    }

    /** 建構單一房間卡片 DOM */
    function buildRoomCard(room) {
        const joinBtn    = room?.Order != null ? document.getElementById(`chat-search-room-join-button-${room.Order}`) : null;
        const name       = room.Name || '未命名房間';
        const creator    = room.Creator || '';
        const desc       = room.Description || '';
        const memberCount = room.MemberCount ?? null;
        const limit      = room.MemberLimit ?? null;
        const locked     = !room.CanJoin;
        const isFull     = memberCount !== null && limit !== null && memberCount >= limit;
        const hasFriend  = Array.isArray(room.Friends) && room.Friends.length > 0;
        const topRel     = getTopRelation(room);

        const card = document.createElement('div');
        card.className = 'liko-csh-card' + (isFull ? ' full' : '') + (hasFriend ? ' has-friend' : '');

        // 頂列（鎖頭 + 名稱）
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

        // 資訊按鈕（右上角絕對定位）
        const infoBtn = document.createElement('button'); infoBtn.className = 'liko-csh-card-info';
        infoBtn.textContent = 'ⓘ'; infoBtn.setAttribute('aria-label', '房間資訊');
        infoBtn.addEventListener('click', e => { e.stopPropagation(); cshShowRoomInfo(room); });
        card.appendChild(infoBtn);

        // 創建者
        if (creator) {
            const ownerEl = document.createElement('div'); ownerEl.className = 'liko-csh-card-owner';
            ownerEl.textContent = `by ${creator}`;
            card.appendChild(ownerEl);
        }

        // 描述
        if (desc) {
            const descEl = document.createElement('div'); descEl.className = 'liko-csh-card-desc';
            descEl.textContent = desc;
            card.appendChild(descEl);
        }

        // 底列（人數 + 關係標籤）
        const foot = document.createElement('div'); foot.className = 'liko-csh-card-foot';
        const cnt  = document.createElement('span'); cnt.className = 'liko-csh-card-count' + (isFull ? ' full' : '');
        cnt.textContent = memberCount !== null ? `👥 ${memberCount}${limit !== null ? '/' + limit : ''}` : '';
        foot.appendChild(cnt);

        if (topRel) {
            const rel  = document.createElement('span'); rel.className = `liko-csh-card-rel ${topRel}`;
            const dot  = document.createElement('span'); dot.className = 'dot';
            const text = document.createElement('span');
            text.textContent = topRel === 'owner' ? '主人' : topRel === 'lover' ? '戀人' : '好友';
            rel.appendChild(dot); rel.appendChild(text);
            foot.appendChild(rel);
        }
        card.appendChild(foot);

        // 點擊進入房間
        card.addEventListener('click', () => {
            if (joinBtn) joinBtn.click();
            else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
        });

        return card;
    }

    // ── 房間資訊底板 ────────────────────────────────────────────────────────────

    function cshCloseRoomInfo() {
        document.getElementById('liko-csh-info-backdrop')?.remove();
    }

    function cshShowRoomInfo(room) {
        cshCloseRoomInfo();

        const backdrop = document.createElement('div'); backdrop.id = 'liko-csh-info-backdrop';
        backdrop.addEventListener('click', cshCloseRoomInfo);

        const sheet = document.createElement('div'); sheet.id = 'liko-csh-info-sheet';
        sheet.addEventListener('click', e => e.stopPropagation());

        // 拖曳把手（視覺提示）
        const handle = document.createElement('div'); handle.id = 'liko-csh-info-handle';
        sheet.appendChild(handle);

        // 標題區
        const head  = document.createElement('div'); head.id = 'liko-csh-info-head';
        const main  = document.createElement('div'); main.id = 'liko-csh-info-main';
        const title = document.createElement('div'); title.id = 'liko-csh-info-title'; title.textContent = room.Name || '未命名房間';
        const owner = document.createElement('div'); owner.id = 'liko-csh-info-owner'; owner.textContent = room.Creator ? `by ${room.Creator}` : '';
        main.appendChild(title); main.appendChild(owner);
        const closeBtn = document.createElement('button'); closeBtn.id = 'liko-csh-info-close';
        closeBtn.textContent = '✕'; closeBtn.addEventListener('click', cshCloseRoomInfo);
        head.appendChild(main); head.appendChild(closeBtn);
        sheet.appendChild(head);

        // 描述
        const descEl = document.createElement('div'); descEl.id = 'liko-csh-info-desc';
        descEl.textContent = room.Description || '沒有描述';
        sheet.appendChild(descEl);

        // 標籤
        const tagsWrap = document.createElement('div'); tagsWrap.id = 'liko-csh-info-tags';
        for (const tagText of buildRoomTags(room)) {
            const tag = document.createElement('div'); tag.className = 'liko-csh-tag';
            tag.textContent = tagText;
            tagsWrap.appendChild(tag);
        }
        sheet.appendChild(tagsWrap);

        // 關係人列表
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

        // 底列：人數 + 加入按鈕
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

    // ── 清除 ────────────────────────────────────────────────────────────────────

    function cshRemove() {
        if (!cshActive) return;
        cshActive = false;
        if (cshSyncTimer) { clearTimeout(cshSyncTimer); cshSyncTimer = null; }
        cshNeedSync = false;
        clearCanvasStyle();
        removeStyle('liko-ml-csh-hide');
        removeStyle('liko-ml-csh');
        document.getElementById('liko-csh-shell')?.remove();
        CSH_BC_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.removeProperty('display');
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測（每幀呼叫）
    // ════════════════════════════════════════════════════════════════════════════

    function checkScene() {
        if (!isPortrait()) {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            return;
        }
        const scr      = typeof CurrentScreen   !== 'undefined' ? CurrentScreen   : '';
        const noDialog = typeof CurrentCharacter === 'undefined' || CurrentCharacter === null;

        if (scr === 'ChatRoom' && noDialog) {
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (!crActive) crApply();
        } else if (scr === 'ChatSearch') {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (!cshActive) cshApply();
        } else if (scr === 'ChatSelect') {
            if (crActive)  crRemove();
            if (cshActive) cshRemove();
            if (!csActive) csApply();
        } else {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC 函數鉤子（Hooks）
    // ════════════════════════════════════════════════════════════════════════════

    // ChatRoom
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

    // ChatSearch — 結果回來後標記需要同步，並在下一次 Run 時觸發（避免競態）
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

    // ChatSelect / ChatSearch 重新載入
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

    // DrawProcess：場景偵測 + Canvas 維持
    modApi.hookFunction('DrawProcess', 5, (args, next) => {
        next(args);
        checkScene();
        if (crActive) forceCanvasStyle(Math.round(window.innerHeight * 0.5));
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 視窗尺寸事件
    // ════════════════════════════════════════════════════════════════════════════

    function handleResize() {
        const p = isPortrait();
        if (crActive)  { crRemove();  if (p) crApply();  }
        if (csActive)  { csRemove();  if (p) csApply();  }
        if (cshActive) { cshRemove(); if (p) cshApply(); }
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化（等待 BC 載入完畢）
    // ════════════════════════════════════════════════════════════════════════════

    function waitForBC() {
        if (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined')
            return setTimeout(waitForBC, 500);

        console.log(`🐈‍⬛ [MPL] ✅ 初始化完成 v${MOD_VER}`);

        // 開發用 debug API
        window.CSHMobilePatch = {
            render:              renderCshList,
            refreshSpaceButton:  refreshCshSpaceButton,
            getOwnerSet:         () => [...getOwnerSet()],
            getLoverSet:         () => [...getLoverSet()],
            getFriendSet:        () => [...getFriendSet()],
            debugFirstRoom:      () => {
                const room = getCshRoomsSource()[0];
                return room
                    ? { room, relations: getRoomRelations(room), topRelation: getTopRelation(room) }
                    : null;
            },
        };
    }

    waitForBC();
})();
