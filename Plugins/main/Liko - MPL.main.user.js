// ==UserScript==
// @name           Liko - Mobile Portrait Layout
// @name:zh        Liko的手機直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.5.4
// @description    Supports vertical layout for ChatSearch and ChatRoom
// @description:zh 支援房間搜尋與聊天室的直版佈局
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
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

    const MOD_VER = '0.5.4';
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
    const PORTRAIT_MAX_WIDTH = 768;   // 直向模式最大寬度（未實際使用，供未來擴充）
    const MENU_PX            = 44;    // ChatRoom 頂部選單高度（px）
    const CARD_MIN_H         = 82;    // ChatSearch 房間卡片最小高度（px）
    const CARD_GAP           = 5;     // 卡片間距（px）
    const BASE_URL           = window.location.href;

    /**
     * 統一管理會與「主 canvas」共享同一個 stacking context 的 z-index。
     * 物件不多，數值故意壓低、留間隔，未來要插入新層時方便排序。
     * 凡是會疊在 ChatRoom/Dialog 直版模式 canvas 上下的元素都應該引用這裡，
     * 而不是各自寫死數字——否則像這次「canvas 蓋住 .dialog-root」的問題
     * 很難一次看出全貌。
     *   CANVAS       主 canvas（forceCanvasStyle 強制定位時）。
     *                故意設為 0：canvas 本身不需要疊在任何東西之上，
     *                只要比它低或不設 z-index 的元素都會被蓋住。
     *   CHAT_DIV     #chat-room-div（聊天訊息／輸入框）
     *   TOP_MENU     #chat-room-top-menu（ChatRoom 頂部選單列）
     *   DIALOG_ROOT  .dialog-root（自介、表情選擇等彈出視窗）—— 須高於 CANVAS
     *   DR_MIRROR    Dialog 直版模式（drXxx）下半螢幕的 mirror canvas
     *   DR_OVERLAY   Dialog 直版模式（drXxx）下半螢幕的點擊覆蓋層
     *   FUSAM        FUSAM 等外部彈窗，需蓋過上述所有層
     */
    const Z = {
        CANVAS:      0,
        DR_MIRROR:   1,
        CHAT_DIV:    2,
        DR_OVERLAY:  2,
        TOP_MENU:    3,
        DIALOG_ROOT: 4,
        FUSAM:       1000,
    };
    // ════════════════════════════════════════════════════════════════════════════
    // i18n：動態翻譯函式
    // 必須是模組層級函式，讓所有 UI 建構函式都能取用。
    // waitForBC() 完成後 window.Liko.MPL.i18n.t 才會就緒，
    // 這裡用 getter 包裝確保每次呼叫時都是最新的函式。
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 取得翻譯字串。
     * i18n 引擎尚未就緒時直接回傳 key，不會拋出例外。
     * @param {string} key  - MPL 字庫中的鍵值（如 'chatsearch.exit_btn'）
     * @param {object} vars - 插值變數（如 { page: 1, total: 5, count: 30 }）
     * @returns {string}
     */
    function MPLT(key, vars) {
        const fn = window.Liko?.MPL?.i18n?.t;
        return fn ? fn(key, vars) : key;
    }

    /**
     * 設定元素的 textContent 並記錄 i18n key，方便 refreshAllI18n() 重刷。
     * @param {HTMLElement} el
     * @param {string} key
     * @param {object} [vars]
     */
    function i18nText(el, key, vars) {
        el.textContent = MPLT(key, vars);
        el.dataset.i18nKey = key;
        if (vars) el.dataset.i18nVars = JSON.stringify(vars);
    }

    /**
     * 設定元素的屬性值並記錄 i18n key，方便 refreshAllI18n() 重刷。
     * @param {HTMLElement} el
     * @param {string} attr  - 屬性名稱（如 'placeholder'、'aria-label'）
     * @param {string} key
     */
    function i18nAttr(el, attr, key) {
        el.setAttribute(attr, MPLT(key));
        el.dataset.i18nAttr    = attr;
        el.dataset.i18nAttrKey = key;
    }

    /**
     * 重刷當前所有帶有 i18n 標記的 DOM 節點。
     * 語言切換後呼叫此函式即可即時更新 UI 文字，無需重建整個 DOM。
     */
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

    /** 判斷目前是否為直向（portrait）模式 */
    function isPortrait() {
        return window.innerWidth < window.innerHeight;
    }

    /** 取得主 canvas 元素 */
    function getCanvas() {
        return document.getElementById('MainCanvas') || document.querySelector('canvas');
    }

    /**
     * 注入或更新一個 <style> 標籤。
     * @param {string} id  - style 元素的 id
     * @param {string} css - CSS 字串
     */
    function injectStyle(id, css) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = css;
    }

    /** 移除指定 id 的 <style> 標籤 */
    function removeStyle(id) {
        document.getElementById(id)?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // i18n 動態載入
    // ════════════════════════════════════════════════════════════════════════════

    // production 走 CDN；本地測試由 window.LikoDevBase 覆寫成 http://localhost/…/Plugins/
    const _I18N_BASE = (typeof window !== 'undefined' && window.LikoDevBase) || 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/';
    const LIKO_I18N_ENGINE_URL = _I18N_BASE + 'expand/BC_i18n.js';
    const LIKO_MPL_STRINGS_URL = _I18N_BASE + 'Translation/MPL-i18n.js';

    /**
     * 動態載入並執行一個遠端 JS 檔案。
     * @param {string} url
     * @returns {Promise<void>}
     */
    function loadScript(url) {
        return fetch(url)
            .then(res => {
            if (!res.ok) throw new Error(`[MPL] 無法載入 ${url} (${res.status})`);
            return res.text();
        })
            .then(code => { new Function(code)(); });
    }

    /**
     * 確保 i18n 引擎與 MPL 字庫都已就緒。
     * 用能力偵測（ensure）判斷 v2 引擎 —— 舊版 v1 只有 version，會被誤判為已載入而擋掉 v2。
     * 字庫改用引擎的 ensure() 載入（依 URL 去重，不需自訂旗標）。
     * @returns {Promise<void>}
     */
    async function ensureI18n() {
        if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') await loadScript(LIKO_I18N_ENGINE_URL);
        if (typeof window.Liko?.__Sys_i18n__?.ensure === 'function') await window.Liko.__Sys_i18n__.ensure('MPL', LIKO_MPL_STRINGS_URL);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Canvas 強制樣式
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 快取上一次套用的數值，避免在 DrawProcess（每幀）重複寫入相同的 inline style
     * 造成不必要的 reflow。
     * @type {{ cv: HTMLElement, vw: number, cvH: number } | null}
     */
    let _lastForcedCanvas = null;

    /**
     * 強制設定 canvas 的 inline style，讓直版模式正確顯示。
     * 同樣數值不重複寫入，避免每幀 reflow。
     * @param {number} cvH - canvas 高度（px）
     */
    function forceCanvasStyle(cvH) {
        const cv = getCanvas();
        if (!cv) return;
        const vw = window.innerWidth;

        if (_lastForcedCanvas
            && _lastForcedCanvas.cv  === cv
            && _lastForcedCanvas.vw  === vw
            && _lastForcedCanvas.cvH === cvH) return;

        _lastForcedCanvas = { cv, vw, cvH };
        cv.style.setProperty('position',  'fixed',         'important');
        cv.style.setProperty('top',       '0',             'important');
        cv.style.setProperty('left',      '0',             'important');
        cv.style.setProperty('transform', 'none',          'important');
        cv.style.setProperty('width',     (vw * 2) + 'px', 'important');
        cv.style.setProperty('height',    cvH + 'px',      'important');
        cv.style.setProperty('z-index',   String(Z.CANVAS), 'important');
        cv.style.setProperty('margin',    '0',             'important');
    }

    /** 清除 canvas 的所有 inline style，恢復 BC 原始控制 */
    function clearCanvasStyle() {
        const cv = getCanvas();
        _lastForcedCanvas = null;
        if (!cv) return;
        ['position', 'top', 'left', 'transform', 'width', 'height', 'z-index', 'margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 玩家關係工具
    // 用於在房間列表中標示好友／戀人／主人
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 遞迴收集物件中所有看起來像 MemberNumber 的數字。
     * 支援 Map、Set、Array 與一般物件（只走 MemberNumber 相關的 key）。
     * @param {*} value
     * @param {Set} [seen] - 用於防止循環參照
     * @returns {Set<number>}
     */
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

    /** @returns {Set<number>} 目前玩家的主人的 MemberNumber 集合 */
    function getOwnerSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        [Player.Owner, Player.Ownership, Player.Ownership?.Owner,
         Player.Ownership?.Owners, Player.Ownership?.MemberNumber,
         Player.Ownership?.MemberNumbers]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    /** @returns {Set<number>} 目前玩家的戀人的 MemberNumber 集合 */
    function getLoverSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        [Player.Lover, Player.Lovers, Player.Lovership,
         Player.Lovership?.MemberNumber, Player.Lovership?.MemberNumbers]
            .forEach(src => collectMemberNumbers(src).forEach(n => set.add(n)));
        return set;
    }

    /** @returns {Set<number>} 目前玩家的好友的 MemberNumber 集合 */
    function getFriendSet() {
        const set = new Set();
        if (typeof Player === 'undefined' || !Player) return set;
        // Player.FriendNames 是 Map<MemberNumber, NickName>，只需要 key
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

    /**
     * 取得指定玩家與目前角色的最高關係等級。
     * @param {number} memberNumber
     * @returns {'owner' | 'lover' | 'friend' | null}
     */
    function getRelation(memberNumber) {
        const mn = Number(memberNumber);
        if (!Number.isFinite(mn)) return null;
        if (getOwnerSet().has(mn)) return 'owner';
        if (getLoverSet().has(mn)) return 'lover';
        if (getFriendSet().has(mn)) return 'friend';
        return null;
    }

    /**
     * 取得房間內所有熟人，依關係等級排序（主人 > 戀人 > 好友）。
     * @param {object} room - BC 房間資料物件
     * @returns {Array<{ memberNumber: number, memberName: string, relation: string }>}
     */
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

    /**
     * 取得房間內最高等級的關係。
     * @param {object} room
     * @returns {'owner' | 'lover' | 'friend' | null}
     */
    function getTopRelation(room) {
        const people = getRoomRelations(room);
        return people.length ? people[0].relation : null;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSearch 區域（Space）工具
    // ════════════════════════════════════════════════════════════════════════════

    /** @returns {boolean} 玩家是否有男性角色 */
    function playerHasMaleGender() {
        try {
            const genders = typeof Player?.GetGenders === 'function' ? Player.GetGenders() : [];
            return Array.isArray(genders) && genders.includes('M');
        } catch { return false; }
    }

    /** @returns {string} 目前的搜尋空間（'X' = 混合, '' = 女性）*/
    function getCurrentSpace() {
        if (typeof ChatSearchGetSpace === 'function') return ChatSearchGetSpace();
        return typeof ChatSearchSpace !== 'undefined' ? ChatSearchSpace : 'X';
    }

    /** @returns {string} 空間切換按鈕的圖示 URL */
    function getSpaceButtonIcon() {
        if (playerHasMaleGender() || getCurrentSpace() === 'X')
            return BASE_URL + 'Icons/Gender.png';
        return BASE_URL + 'Screens/Online/ChatSelect/Female.png';
    }

    /** @returns {string} 空間切換按鈕的 aria-label（i18n） */
    function getSpaceButtonLabel() {
        if (playerHasMaleGender()) return MPLT('chatsearch.space_male');
        return getCurrentSpace() === 'X'
            ? MPLT('chatsearch.space_to_f')
        : MPLT('chatsearch.space_to_x');
    }

    /** @returns {string} 點擊空間按鈕後應切換到的目標空間 */
    function getToggleTargetSpace() {
        if (playerHasMaleGender()) return 'X';
        return getCurrentSpace() === 'X' ? '' : 'X';
    }

    /**
     * 套用搜尋空間並重新查詢。
     * @param {string} space     - 目標空間（'X' 或 ''）
     * @param {string} [queryText] - 搜尋關鍵字（預設空字串）
     */
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
    // 上半螢幕：canvas（人物 + 選單）
    // 下半螢幕：HTML chat-room-div（聊天訊息 + 輸入框）
    // ════════════════════════════════════════════════════════════════════════════

    let crActive   = false;
    let crOrigRect = null;  // 進入前的 ChatRoomDivRect 備份，離開時還原
    let crLockedVH = 0;     // 鎖定進入聊天室時的視窗高度，防止手機鍵盤彈出時重算

    /**
     * 計算 ChatRoom 直版模式所需的各區域尺寸。
     * @returns {{ cvH, mLY, mLH, mLW, cLY, cLH }}
     */
    function crCalc() {
        const vw  = window.innerWidth;
        const vh  = crLockedVH || window.innerHeight;
        const cvH = Math.round(vh * 0.5);
        const sx  = (vw * 2) / 2000;
        const sy  = cvH / 1000;
        const mLY = Math.round(cvH / sy);
        const mLH = Math.round(MENU_PX / sy);
        const mLW = Math.round(vw / sx);
        const cSY = cvH + MENU_PX;
        const cSH = Math.max(120, vh - cSY);
        return {
            cvH,
            mLY, mLH, mLW,
            cLY: Math.round(cSY / sy),
            cLH: Math.round(cSH / sy),
        };
    }

    // ── 假輸入框覆蓋層 ──────────────────────────────────────────────────────────
    // 攔截 chat-room-div 內的 input/textarea focus，
    // 顯示全螢幕覆蓋層 + 假輸入框，讓使用者確認後再送出，
    // 避免手機鍵盤彈出推動畫面導致版面跑版。

    let crFakeInputActive = false;

    //顯示假輸入框覆蓋層，攔截手機鍵盤彈出。
    function crShowFakeInput(realInput) {
        if (crFakeInputActive) return;
        crFakeInputActive = true;
        injectStyle('liko-cr-keyboard-lock', `html, body { height: 100vh !important; overflow: hidden !important;}`);
        const realInputId = realInput.id || null;   // ★ 記住 id，供之後即時查詢

        /** ★ 取得目前 DOM 中真正的輸入框（避免拿到已被 BC 重建移除的舊節點） */
        const getLiveInput = () =>
        (realInputId && document.getElementById(realInputId)) || realInput;
        // 暫時設 readonly 後立刻移除，讓 iOS 不彈出鍵盤
        realInput.setAttribute('readonly', 'true');
        realInput.blur();
        requestAnimationFrame(() => { realInput.removeAttribute('readonly'); });

        const overlay = document.createElement('div');
        overlay.id = 'liko-cr-fake-input-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:200;
            background:rgba(0,0,0,0.72);
            display:flex; flex-direction:column;
            align-items:center; justify-content:flex-start;
            padding-top:18px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            width:92%; max-width:520px;
            background:#1a1a2e;
            border:1px solid rgba(255,255,255,0.18);
            border-radius:14px;
            padding:12px 14px;
            display:flex; flex-direction:column; gap:10px;
        `;

        const title = document.createElement('div');
        i18nText(title, 'fake_input.title');
        title.style.cssText = 'color:rgba(255,255,255,0.55);font-size:12px;';

        const ta = document.createElement('textarea');
        ta.value       = realInput.value || '';
        ta.placeholder = realInput.placeholder || '';
        ta.rows        = 4;
        ta.setAttribute('enterkeyhint', 'send')
        ta.style.cssText = `
            width:100%; box-sizing:border-box;
            background:rgba(255,255,255,0.08);
            border:1px solid rgba(255,255,255,0.18);
            border-radius:9px; color:#fff; font-size:15px;
            padding:10px 12px; outline:none; resize:none;
            font-family:inherit; line-height:1.5;
        `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';

        const cancelBtn = document.createElement('button');
        i18nText(cancelBtn, 'fake_input.cancel');
        cancelBtn.style.cssText = `
            padding:8px 20px; border-radius:8px;
            border:1px solid rgba(255,255,255,0.18);
            background:rgba(255,255,255,0.07);
            color:#fff; font-size:14px; cursor:pointer;
        `;

        const sendBtn = document.createElement('button');
        i18nText(sendBtn, 'fake_input.send');
        sendBtn.style.cssText = `
            padding:8px 20px; border-radius:8px;
            border:1px solid rgba(100,80,220,0.60);
            background:rgba(80,60,200,0.40);
            color:#fff; font-size:14px; font-weight:700; cursor:pointer;
        `;

        const close = () => {
            crFakeInputActive = false;
            removeStyle('liko-cr-keyboard-lock');
            overlay.remove();
        };

        cancelBtn.addEventListener('click', close);

        sendBtn.addEventListener('click', () => {
            const target = getLiveInput();   // ★ 改用即時查詢的元素
            target.value = ta.value;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            ['keydown', 'keypress', 'keyup'].forEach(type => {
                target.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter', code: 'Enter', keyCode: 13,
                    bubbles: true, cancelable: true,
                }));
            });
            close();
        });
        // Enter送出
        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendBtn.click();
            }
        });
        // 點擊遮罩關閉
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(sendBtn);
        box.appendChild(title);
        box.appendChild(ta);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // iOS 需要在 user gesture 的極短延遲內 focus 才能彈出鍵盤
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                ta.focus();
                ta.selectionStart = ta.selectionEnd = ta.value.length;
            });
        });
    }

    // focusin 可能由 BC 自己（例如送出訊息後）以程式呼叫 .focus() 觸發，
    // 並非使用者手動點擊。只有在「使用者真的按下/點過」之後一小段時間內
    // 收到 focusin，才視為使用者主動點擊輸入框，避免假輸入框無故彈出。
    let crLastUserGesture = 0;
    const CR_GESTURE_WINDOW_MS = 800;

    /** 為 chat-room-div 掛載假輸入框攔截器 */
    function crHookChatInput() {
        const chatDiv = document.getElementById('chat-room-div');
        if (!chatDiv || chatDiv._likoFakeInputHandler) return;

        const gestureHandler = () => { crLastUserGesture = Date.now(); };
        chatDiv.addEventListener('pointerdown', gestureHandler, true);
        chatDiv.addEventListener('touchstart',  gestureHandler, true);

        const handler = e => {
            if (!crActive || !isPortrait()) return;
            const el = e.target;
            if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
            if (Date.now() - crLastUserGesture > CR_GESTURE_WINDOW_MS) return;
            e.preventDefault();
            crShowFakeInput(el);
        };
        chatDiv._likoFakeInputHandler  = handler;
        chatDiv._likoGestureHandler    = gestureHandler;
        chatDiv.addEventListener('focusin', handler, true);
    }

    /** 移除 chat-room-div 的假輸入框攔截器 */
    function crUnhookChatInput() {
        const chatDiv = document.getElementById('chat-room-div');
        if (!chatDiv || !chatDiv._likoFakeInputHandler) return;
        chatDiv.removeEventListener('focusin', chatDiv._likoFakeInputHandler, true);
        chatDiv.removeEventListener('pointerdown', chatDiv._likoGestureHandler, true);
        chatDiv.removeEventListener('touchstart',  chatDiv._likoGestureHandler, true);
        delete chatDiv._likoFakeInputHandler;
        delete chatDiv._likoGestureHandler;
    }

    //每幀維護 ChatRoom 直版版面（供 DrawProcess hook 呼叫）。同步更新 canvas、選單與聊天框的位置。

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
        crHookChatInput();
    }

    /** 啟用 ChatRoom 直版模式 */
    function crApply() {
        crActive   = true;
        crLockedVH = getLockedVH();
        const L = crCalc();

        // 注意：canvas 用 Z.CANVAS（0，等同未設定）而不是給它疊上更高的值，
        // 是因為 .dialog-root 等彈出視窗的 z-index 實測會被 BC 重建/重新渲染
        // 沖掉（無論寫 CSS 規則或用 JS 強制 inline style 都留不住）。
        // 讓 canvas 維持最低的 z-index，靠「誰在 DOM 後面誰畫上面」這條規則，
        // 後加入的彈出視窗才會穩定蓋在 canvas 之上。
        injectStyle('liko-ml-cr', `
            html, body { overflow-x: hidden !important }
            #chat-room-top-menu { position:fixed !important; z-index:${Z.TOP_MENU} !important }
            #chat-room-div      { position:fixed !important; z-index:${Z.CHAT_DIV} !important }
        `);

        forceCanvasStyle(L.cvH);

        // 備份原始 ChatRoomDivRect，離開時還原
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
            crHookChatInput();
        });
    }

    /** 關閉 ChatRoom 直版模式，還原所有修改 */
    function crRemove() {
        if (!crActive) return;
        crActive          = false;
        crLockedVH        = 0;
        crFakeInputActive = false;

        document.getElementById('liko-cr-fake-input-overlay')?.remove();
        removeStyle('liko-cr-keyboard-lock');
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
    // 以全螢幕原生 HTML UI 替代 BC 的 canvas 版房間類型選擇畫面
    // ════════════════════════════════════════════════════════════════════════════

    let csActive = false;

    /** 啟用 ChatSelect 直版模式 */
    function csApply() {
        csActive = true;
        injectStyle('liko-ml-cs', `
            html, body { overflow-x:hidden !important }
            #liko-cs-bg {
                position:fixed; inset:0; z-index:100;
                overflow:hidden; background:#111;
            }
            #liko-cs-bg-img {
                position:absolute; top:0; left:-50vw;
                width:200vw; height:100%;
                object-fit:cover; object-position:top left;
                pointer-events:none;
            }
            #liko-cs-overlay {
                position:absolute; inset:0; z-index:101;
                display:flex; flex-direction:column;
                align-items:center; justify-content:space-evenly;
                padding:28px 24px; box-sizing:border-box;
                background:rgba(0,0,0,0.40);
            }
            #liko-cs-exit {
                position:absolute; top:10px; right:10px; z-index:102;
                width:42px; height:42px; border-radius:8px;
                border:1px solid rgba(255,255,255,0.28);
                background:rgba(0,0,0,0.60);
                cursor:pointer;
                display:flex; align-items:center; justify-content:center;
                padding:0;
            }
            #liko-cs-exit img { width:26px; height:26px; object-fit:contain; }
            #liko-cs-exit:active { background:rgba(120,20,20,0.80); }
            .liko-cs-row {
                width:100%; max-width:480px;
                display:flex; flex-direction:column;
                align-items:stretch; gap:9px;
            }
            .liko-cs-btn {
                width:100%; min-height:64px; border-radius:14px;
                border:1px solid rgba(255,255,255,0.28);
                background:rgba(15,15,35,0.80);
                color:#fff; font-size:18px; font-weight:700;
                cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:14px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                user-select:none; padding:0 20px;
                backdrop-filter:blur(4px);
            }
            .liko-cs-btn:active { background:rgba(80,50,200,0.65); }
            .liko-cs-btn.disabled { opacity:0.35; pointer-events:none; }
            .liko-cs-btn img { width:34px; height:34px; flex-shrink:0; }
            .liko-cs-desc {
                font-size:13px; line-height:1.5;
                color:rgba(230,220,255,0.78); text-align:center;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                user-select:none; padding:0 8px;
            }
        `);
        buildCsBg();
    }

    /** 建立 ChatSelect 全螢幕背景與選項按鈕 */
    function buildCsBg() {
        document.getElementById('liko-cs-bg')?.remove();
        const T = typeof TextGet === 'function' ? TextGet : k => k;

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

        // 三個空間選項的設定
        const options = [
            {
                icon:  BASE_URL + 'Screens/Online/ChatSelect/Female.png',
                label: T('FemaleOnlyChat'),
                desc:  T('FemaleOnlyChatDescription1'),
                space: '',
                ok:    typeof ChatSelectAllowedInFemaleOnly !== 'undefined' ? ChatSelectAllowedInFemaleOnly : true,
            },
            {
                icon:  BASE_URL + 'Icons/Gender.png',
                label: T('MixedChat'),
                desc:  T('MixedChatDescription1'),
                space: 'X',
                ok:    true,
            },
            {
                icon:  BASE_URL + 'Screens/Online/ChatSelect/Male.png',
                label: T('MaleOnlyChat'),
                desc:  T('MaleOnlyChatDescription1'),
                space: 'M',
                // 注意：若 BC 更新導致此變數消失，fallback 為 true（允許點擊），
                // 由 ChatSelectStartSearch 自行決定是否允許進入。
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

    /** 關閉 ChatSelect 直版模式 */
    function csRemove() {
        if (!csActive) return;
        csActive = false;
        removeStyle('liko-ml-cs');
        document.getElementById('liko-cs-bg')?.remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // ChatSearch 直版模式（cshXxx）
    // 以全螢幕原生 HTML UI 替代 BC 的 canvas 版房間搜尋畫面
    // ════════════════════════════════════════════════════════════════════════════

    let cshActive     = false;
    let cshSyncTimer  = null;   // 收到伺服器房間列表更新後的 debounce timer
    let cshNeedSync   = false;  // 標記是否需要在下一個 Run tick 重刷列表
    let cshPage       = 1;
    let cshRoomsCache = [];     // 目前取得的完整房間列表
    let cshAnimating  = false;
    let cshDrag       = null;

    // BC 原生 ChatSearch DOM 元素的 id 列表（進入直版模式時隱藏）
    const CSH_BC_IDS = [
        'chat-search-room-header',
        'chat-search-body',
        'chat-search-room-grid',
        'chat-search-search-menu',
        'chat-search-filter-help-screen',
    ];

    /**
     * 取得目前的房間列表資料來源。
     * 優先使用 ChatSearchGetRooms()，fallback 到 ChatSearchResult 全域變數。
     * @returns {object[]}
     */
    function getCshRoomsSource() {
        if (typeof ChatSearchGetRooms === 'function') {
            const rooms = ChatSearchGetRooms();
            return Array.isArray(rooms) ? rooms.slice() : [];
        }
        if (typeof ChatSearchResult !== 'undefined' && Array.isArray(ChatSearchResult))
            return ChatSearchResult.slice();
        return [];
    }

    /**
     * 根據目前視窗高度計算每頁應顯示幾張卡片（雙欄）。
     * @returns {number}
     */
    function calcCshPerPage() {
        const HEADER_H = 52, FOOTER_H = 48, PADDING = 12;
        const listH = window.innerHeight - HEADER_H - FOOTER_H - PADDING * 2;
        const rows  = Math.max(1, Math.floor(listH / (CARD_MIN_H + CARD_GAP)));
        return rows * 2;
    }

    /**
     * 根據房間屬性建立標籤字串陣列。
     * @param {object} room
     * @returns {string[]}
     */
    function buildRoomTags(room) {
        const tags = [];
        if (room.Space !== undefined && typeof ChatSearchGetSpaceName === 'function')
            tags.push(ChatSearchGetSpaceName(room.Space));
        if (room.Language && typeof ChatSearchGetLanguageName === 'function')
            tags.push(ChatSearchGetLanguageName(room.Language));
        if (room.Game && typeof TextGet === 'function')
            tags.push(TextGet(room.Game) || room.Game);
        if (room.MapType && room.MapType !== 'Never' && typeof ChatSearchGetRoomTypeName === 'function')
            tags.push(ChatSearchGetRoomTypeName(room.MapType));
        if (Array.isArray(room.BlockCategory)) {
            for (const b of room.BlockCategory)
                tags.push(MPLT('chatsearch.block_prefix') + (typeof TextGet === 'function' ? (TextGet(b) || b) : b));
        }
        if (Array.isArray(room.Access)) {
            for (const a of room.Access) {
                if (a === 'All') continue;
                tags.push(MPLT('chatsearch.access_prefix') + (typeof TextGet === 'function' ? (TextGet(a + 'Access') || a) : a));
            }
        }
        return tags;
    }

    /** 更新空間切換按鈕的圖示與標籤 */
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
     * 嘗試在 ChatSearch 原生 DOM 中找出特定功能的按鈕。
     * 使用 id 關鍵字比對，這是「能動但脆弱」的做法——若 BC 更新改變按鈕命名規則，
     * 此函式會回傳 null，呼叫端應使用全域函式作為 fallback。
     * @param {...string} keywords - 要比對的 id 關鍵字（小寫）
     * @returns {HTMLButtonElement | null}
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

    /** 啟用 ChatSearch 直版模式 */
    function cshApply() {
        cshActive     = true;
        cshNeedSync   = false;
        cshPage       = 1;
        cshAnimating  = false;
        cshDrag       = null;
        const HEADER_H = 52, FOOTER_H = 48;

        // 隱藏 canvas（ChatSearch 頁不需要顯示角色）
        forceCanvasStyle(0);

        // 隱藏 BC 原生 ChatSearch DOM
        injectStyle('liko-ml-csh-hide',
                    CSH_BC_IDS.map(id => `#${id} { display:none !important }`).join('\n'));

        injectStyle('liko-ml-csh', `
            html, body { overflow-x:hidden !important }
            #liko-csh-shell {
                position:fixed; inset:0; z-index:50;
                display:flex; flex-direction:column;
                background:#0a0a14; overflow:hidden;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
            }
            /* ── Header ── */
            #liko-csh-header {
                flex-shrink:0; height:${HEADER_H}px;
                display:flex; align-items:center; gap:5px;
                padding:0 8px; box-sizing:border-box;
                background:#12121e;
                border-bottom:1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-search-wrap {
                flex:1; min-width:0; height:36px;
                display:flex; align-items:center; position:relative;
            }
            #liko-csh-search-wrap input {
                flex:1; height:100%; box-sizing:border-box;
                background:rgba(255,255,255,0.08);
                border:1px solid rgba(255,255,255,0.18);
                border-radius:9px; color:#fff; font-size:13px;
                padding:0 30px 0 10px; outline:none;
            }
            #liko-csh-search-wrap input::placeholder { color:rgba(255,255,255,0.38); }
            #liko-csh-clear {
                position:absolute; right:6px; top:50%; transform:translateY(-50%);
                background:none; border:none; color:rgba(255,255,255,0.45);
                font-size:15px; cursor:pointer; padding:0; line-height:1; display:none;
            }
            #liko-csh-clear.visible { display:block; }
            /* ── Header 按鈕 ── */
            .liko-csh-hbtn {
                flex-shrink:0; width:44px; height:44px; border-radius:10px;
                border:1px solid rgba(255,255,255,0.18);
                background:rgba(255,255,255,0.07);
                display:flex; align-items:center; justify-content:center;
                cursor:pointer; padding:0;
            }
            .liko-csh-hbtn img { width:26px; height:26px; object-fit:contain; }
            .liko-csh-hbtn:active { background:rgba(255,255,255,0.18); }
            .liko-csh-hbtn.create {
                border-color:rgba(120,80,220,0.60);
                background:rgba(100,60,200,0.25);
            }
            /* ── 房間卡片列表 ── */
#liko-csh-list {
    flex:1;
    overflow:hidden;
    position:relative;
    touch-action:none;
}
#liko-csh-track {
    position:absolute;
    inset:0;
    will-change:transform;
}

.liko-csh-page {
    position:absolute;
    top:0;
    width:100%;
    height:100%;
    display:grid;
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:5px;
    padding:6px;
    box-sizing:border-box;
    align-content:start;
}

.liko-csh-page.prev { left:-100%; }
.liko-csh-page.curr { left:0; }
.liko-csh-page.next { left:100%; }

#liko-csh-track.animating {
    transition:transform 220ms ease;
}
            #liko-csh-list::-webkit-scrollbar { width:3px; }
            #liko-csh-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:2px; }
            /* ── 卡片 ── */
            .liko-csh-card {
                background:rgba(255,255,255,0.05);
                border:1px solid rgba(255,255,255,0.10);
                border-radius:10px; padding:7px 8px;
                cursor:pointer;
                display:flex; flex-direction:column; gap:3px;
                min-height:${CARD_MIN_H}px;
                box-sizing:border-box; position:relative;
                min-width:0; overflow:hidden;
            }
            .liko-csh-card:active { background:rgba(255,255,255,0.14); }
            .liko-csh-card.full {
                border-color:rgba(255,70,70,0.88); border-width:2px;
                background:rgba(80,20,20,0.20);
                box-shadow:inset 0 0 0 1px rgba(255,70,70,0.18);
            }
            .liko-csh-card.has-friend {
                border-color:rgba(82,214,109,0.38);
                box-shadow:0 0 0 1px rgba(82,214,109,0.08) inset;
            }
            .liko-csh-card.has-friend:not(.full) {
                background:linear-gradient(180deg,rgba(82,214,109,0.06),rgba(82,214,109,0.02)),
                            rgba(255,255,255,0.03);
            }
            .liko-csh-card-top { display:flex; align-items:flex-start; gap:3px; padding-right:22px; }
            .liko-csh-card-lock { font-size:11px; flex-shrink:0; line-height:1.4; }
            .liko-csh-card-name {
                font-size:12px; font-weight:600; color:#f0e8ff;
                overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;
            }
            .liko-csh-card-info {
                position:absolute; top:5px; right:5px;
                width:18px; height:18px; border-radius:4px;
                border:1px solid rgba(255,255,255,0.20);
                background:rgba(255,255,255,0.08);
                color:rgba(255,255,255,0.55); font-size:10px;
                display:flex; align-items:center; justify-content:center;
                cursor:pointer; flex-shrink:0;
            }
            .liko-csh-card-info:active { background:rgba(255,255,255,0.22); }
            .liko-csh-card-owner {
                font-size:10px; color:rgba(180,170,210,0.60);
                overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
            }
            .liko-csh-card-desc {
                font-size:10px; color:rgba(185,175,210,0.72);
                overflow:hidden; display:-webkit-box;
                -webkit-line-clamp:2; -webkit-box-orient:vertical;
                line-height:1.35; flex:1;
            }
            .liko-csh-card-foot {
                display:flex; justify-content:flex-start; align-items:center;
                font-size:10px; color:rgba(160,200,255,0.72);
                padding-top:2px; margin-top:auto; gap:5px;
            }
            .liko-csh-card-count { white-space:nowrap; }
            .liko-csh-card-count.full { color:rgba(255,90,90,0.98); font-weight:800; }
            /* ── 關係標籤 ── */
            .liko-csh-card-rel {
                display:inline-flex; align-items:center; gap:4px;
                white-space:nowrap; font-size:10px; font-weight:700;
            }
            .liko-csh-card-rel .dot { width:7px; height:7px; border-radius:999px; display:inline-block; }
            .liko-csh-card-rel.friend { color:rgba(90,230,120,0.95); }
            .liko-csh-card-rel.friend .dot { background:#52d66d; }
            .liko-csh-card-rel.lover  { color:rgba(255,120,210,0.95); }
            .liko-csh-card-rel.lover  .dot { background:#ff66c4; }
            .liko-csh-card-rel.owner  { color:rgba(255,175,90,0.98); }
            .liko-csh-card-rel.owner  .dot { background:#ff9b3d; }
            .liko-csh-empty {
                grid-column:1 / -1; text-align:center;
                color:rgba(255,255,255,0.28); font-size:13px; padding:50px 0;
            }
            /* ── Footer ── */
            #liko-csh-footer {
                flex-shrink:0; height:${FOOTER_H}px;
                display:flex; align-items:center;
                padding:0 8px; gap:6px; box-sizing:border-box;
                background:#12121e;
                border-top:1px solid rgba(255,255,255,0.10);
            }
            #liko-csh-foot-left  { flex:1; }
            #liko-csh-foot-pages { display:flex; align-items:center; gap:6px; flex:2; justify-content:center; }
            #liko-csh-foot-right { flex:1; display:flex; justify-content:flex-end; }
            .liko-csh-page-btn {
                height:34px; padding:0 14px; border-radius:8px;
                border:1px solid rgba(255,255,255,0.18);
                background:rgba(255,255,255,0.07);
                color:#fff; font-size:12px; cursor:pointer; white-space:nowrap;
            }
            .liko-csh-page-btn:active   { background:rgba(255,255,255,0.18); }
            .liko-csh-page-btn.disabled { opacity:0.30; pointer-events:none; }
            #liko-csh-pageinfo { font-size:11px; color:rgba(255,255,255,0.45); white-space:nowrap; }
            #liko-csh-exit-btn {
                height:34px; padding:0 14px; border-radius:8px;
                border:1px solid rgba(255,100,100,0.30);
                background:rgba(80,20,20,0.40);
                color:rgba(255,160,160,0.85); font-size:12px; cursor:pointer;
            }
            #liko-csh-exit-btn:active { background:rgba(120,30,30,0.60); }
            /* ── 房間資訊 Bottom Sheet ── */
            #liko-csh-info-backdrop {
                position:fixed; inset:0; z-index:80;
                background:rgba(0,0,0,0.52);
                display:flex; align-items:flex-end; justify-content:center;
            }
            #liko-csh-info-sheet {
                width:100%; max-width:768px; max-height:82vh; overflow:auto;
                background:#151522;
                border-top-left-radius:18px; border-top-right-radius:18px;
                border:1px solid rgba(255,255,255,0.10);
                box-shadow:0 -10px 30px rgba(0,0,0,0.35);
                padding:14px 14px 16px; box-sizing:border-box;
            }
            #liko-csh-info-handle {
                width:42px; height:4px; border-radius:999px;
                background:rgba(255,255,255,0.20); margin:0 auto 12px;
            }
            #liko-csh-info-head  { display:flex; align-items:flex-start; gap:8px; }
            #liko-csh-info-main  { flex:1; min-width:0; }
            #liko-csh-info-title { font-size:16px; font-weight:700; color:#f3ecff; line-height:1.3; word-break:break-word; }
            #liko-csh-info-owner { margin-top:3px; font-size:12px; color:rgba(200,190,220,0.72); }
            #liko-csh-info-close {
                flex-shrink:0; width:34px; height:34px; border-radius:9px;
                border:1px solid rgba(255,255,255,0.14);
                background:rgba(255,255,255,0.06); color:#fff; cursor:pointer;
            }
            #liko-csh-info-desc {
                margin-top:12px; font-size:13px; line-height:1.55;
                color:rgba(230,225,240,0.88); white-space:pre-wrap; word-break:break-word;
            }
            #liko-csh-info-tags   { margin-top:12px; display:flex; flex-wrap:wrap; gap:6px; }
            .liko-csh-tag {
                padding:6px 10px; border-radius:999px;
                background:rgba(255,255,255,0.07);
                border:1px solid rgba(255,255,255,0.10);
                color:#e9defa; font-size:11px; line-height:1.2;
            }
            #liko-csh-info-people { margin-top:12px; display:flex; flex-direction:column; gap:6px; }
            .liko-csh-info-person {
                display:flex; align-items:center; gap:8px;
                padding:8px 10px; border-radius:10px;
                background:rgba(255,255,255,0.05);
                border:1px solid rgba(255,255,255,0.08);
                font-size:12px; color:#efe7ff;
            }
            .liko-csh-rel-dot { width:8px; height:8px; border-radius:999px; flex-shrink:0; }
            .liko-csh-rel-dot.friend { background:#52d66d; }
            .liko-csh-rel-dot.lover  { background:#ff66c4; }
            .liko-csh-rel-dot.owner  { background:#ff9b3d; }
            .liko-csh-rel-label { font-size:11px; color:rgba(255,255,255,0.55); margin-left:auto; }
            #liko-csh-info-footer { margin-top:14px; display:flex; align-items:center; gap:8px; }
            #liko-csh-info-members { flex:1; font-size:12px; color:rgba(160,200,255,0.82); }
            #liko-csh-info-join {
                height:38px; padding:0 16px; border-radius:10px;
                border:1px solid rgba(120,80,220,0.55);
                background:rgba(100,60,200,0.28);
                color:#fff; font-size:13px; font-weight:700; cursor:pointer;
            }
            #liko-csh-info-join.disabled { opacity:0.4; pointer-events:none; }
        `);

        buildCshShell();
    }

    /**
     * 建立一個帶有圖示的 header 按鈕。
     * @param {string} imgSrc    - 圖示 URL
     * @param {string} ariaLabel - 無障礙標籤
     * @param {Function} onClick
     * @param {string} [extraClass]
     * @returns {HTMLButtonElement}
     */
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
    function cshGoPrevPage() { cshAnimatePageTurn(-1); }
    function cshGoNextPage() { cshAnimatePageTurn(1); }

    function cshAnimatePageTurn(dir) {
        const shell = document.getElementById('liko-csh-shell');
        const track = shell?._track;
        if (!track || cshAnimating) return;

        const perPage = Math.max(1, calcCshPerPage());
        const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
        const targetPage = cshPage + dir;

        if (targetPage < 1 || targetPage > totalPages) return;

        cshAnimating = true;
        track.classList.add('animating');
        // dir = 1（下一頁）→ track 往左移 → translateX(-100%)
        // dir = -1（上一頁）→ track 往右移 → translateX(+100%)
        track.style.transform = `translateX(${dir > 0 ? '-100%' : '100%'})`;

        const done = () => {
            track.removeEventListener('transitionend', done);
            cshPage = targetPage;
            renderCshList(false);
            cshAnimating = false;
        };
        track.addEventListener('transitionend', done, { once: true });
    }
    /**
     * 建立單張房間卡片 DOM 元素。
     * @param {object} room - BC 房間資料物件
     * @returns {HTMLElement}
     */
    function buildRoomCard(room) {
        // 取得 BC 原生的加入按鈕（用於觸發 BC 的加入邏輯）
        const joinBtn     = room?.Order != null
        ? document.getElementById(`chat-search-room-join-button-${room.Order}`)
        : null;

        const name        = room.Name        || MPLT('room.unnamed');
        const creator     = room.Creator     || '';
        const desc        = room.Description || '';
        const memberCount = room.MemberCount ?? null;
        const limit       = room.MemberLimit ?? null;
        const locked      = !room.CanJoin;
        const isFull      = memberCount !== null && limit !== null && memberCount >= limit;
        const hasFriend   = Array.isArray(room.Friends) && room.Friends.length > 0;

        const card = document.createElement('div');
        card.className = 'liko-csh-card'
            + (isFull    ? ' full'       : '')
            + (hasFriend ? ' has-friend' : '');

        // 名稱列（含鎖頭圖示）
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

        // 詳情按鈕（右上角）
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

        // 底部：人數 + 關係標籤
        const foot = document.createElement('div'); foot.className = 'liko-csh-card-foot';
        const cnt  = document.createElement('span');
        cnt.className = 'liko-csh-card-count' + (isFull ? ' full' : '');
        cnt.textContent = memberCount !== null
            ? `👥 ${memberCount}${limit !== null ? '/' + limit : ''}`
        : '';
        foot.appendChild(cnt);

        // 顯示所有關係類型（去重，同一人只取最高，但不同人的不同關係都顯示）
        const allRelations = getRoomRelations(room);
        const relTypes = [...new Set(allRelations.map(p => p.relation))];
        for (const relType of relTypes) {
            const rel  = document.createElement('span'); rel.className = `liko-csh-card-rel ${relType}`;
            const dot  = document.createElement('span'); dot.className = 'dot';
            const text = document.createElement('span');
            i18nText(text, `rel.${relType}`);
            rel.appendChild(dot);
            rel.appendChild(text);
            foot.appendChild(rel);
        }
        card.appendChild(foot);

        // 點擊卡片加入房間
        card.addEventListener('click', () => {
            if (joinBtn) joinBtn.click();
            else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
        });

        return card;
    }
    /** 建立 ChatSearch 直版殼層（header + 列表 + footer） */
    function buildCshShell() {
        document.getElementById('liko-csh-shell')?.remove();
        const shell = document.createElement('div'); shell.id = 'liko-csh-shell';

        // ── Header ────────────────────────────────────────────────────────────
        const header = document.createElement('div'); header.id = 'liko-csh-header';

        const wrap     = document.createElement('div');   wrap.id = 'liko-csh-search-wrap';
        const inp      = document.createElement('input'); inp.type = 'text';
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
            inp._deb = setTimeout(() => {
                if (typeof ChatSearchQuery === 'function') ChatSearchQuery(inp.value);
            }, 400);
        });

        wrap.appendChild(inp);
        wrap.appendChild(clearBtn);
        header.appendChild(wrap);

        // 篩選按鈕
        header.appendChild(makeHBtn(
            BASE_URL + 'Icons/Search.png',
            MPLT('chatsearch.filter_aria'),
            () => {
                const bcFilterBtn = findChatSearchButton('filter');
                if (bcFilterBtn) { bcFilterBtn.style.removeProperty('display'); bcFilterBtn.click(); }
                else console.warn('🐈‍⬛ [MPL] 找不到原生篩選按鈕，BC 介面可能已更新');
            }
        ));

        // 空間切換按鈕
        const spaceBtn = makeHBtn(
            getSpaceButtonIcon(),
            getSpaceButtonLabel(),
            () => {
                if (playerHasMaleGender()) { refreshCshSpaceButton(); return; }
                const q = inp.value ?? (typeof ChatSearchQueryString !== 'undefined' ? ChatSearchQueryString : '');
                applySpace(getToggleTargetSpace(), q);
                refreshCshSpaceButton();
            }
        );
        spaceBtn.id = 'liko-csh-space-btn';
        header.appendChild(spaceBtn);

        // 建立房間按鈕
        header.appendChild(makeHBtn(
            BASE_URL + 'Icons/Plus.png',
            MPLT('chatsearch.create_aria'),
            () => {
                const bcCreate = findChatSearchButton('create');
                if (bcCreate) { bcCreate.style.removeProperty('display'); bcCreate.click(); return; }
                if (typeof ChatSearchCreateRoom === 'function') ChatSearchCreateRoom();
                else console.warn('🐈‍⬛ [MPL] 找不到原生建立房間按鈕，BC 介面可能已更新');
            },
            'create'
        ));

        shell.appendChild(header);

        // ── 房間卡片列表 ──────────────────────────────────────────────────────
        const list = document.createElement('div'); list.id = 'liko-csh-list';

        const track = document.createElement('div'); track.id = 'liko-csh-track';

        list.appendChild(track);

        shell._list  = list;
        shell._track = track;

        shell.appendChild(list);

        // ── Footer ────────────────────────────────────────────────────────────
        const footer    = document.createElement('div'); footer.id = 'liko-csh-footer';
        const footLeft  = document.createElement('div'); footLeft.id  = 'liko-csh-foot-left';
        const footPages = document.createElement('div'); footPages.id = 'liko-csh-foot-pages';
        const footRight = document.createElement('div'); footRight.id = 'liko-csh-foot-right';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'liko-csh-page-btn disabled';
        prevBtn.textContent = '‹';
        i18nAttr(prevBtn, 'aria-label', 'chatsearch.prev_aria');
        prevBtn.addEventListener('click', cshGoPrevPage);

        const pageInfo = document.createElement('span'); pageInfo.id = 'liko-csh-pageinfo';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'liko-csh-page-btn disabled';
        nextBtn.textContent = '›';
        i18nAttr(nextBtn, 'aria-label', 'chatsearch.next_aria');
        nextBtn.addEventListener('click', cshGoNextPage);

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
            else console.warn('🐈‍⬛ [MPL] 找不到原生離開按鈕，BC 介面可能已更新');
        });
        footRight.appendChild(exitBtn);

        footer.appendChild(footLeft);
        footer.appendChild(footPages);
        footer.appendChild(footRight);
        shell.appendChild(footer);

        // 儲存翻頁控制元素參考，供 renderCshList 更新狀態
        shell._prev     = prevBtn;
        shell._next     = nextBtn;
        shell._pageInfo = pageInfo;

        document.body.appendChild(shell);

        // 男性角色強制混區
        if (playerHasMaleGender() && getCurrentSpace() !== 'X')
            applySpace('X', inp.value ?? '');

        refreshCshSpaceButton();
        renderCshList();
        cshBindSwipe(list);
    }

    /**
     * 渲染（或重新渲染）當前頁的房間卡片列表。
     * @param {boolean} [resetPage=false] - 是否重置到第一頁
     */
    function getCshPageRooms(page) {
        const perPage = Math.max(1, calcCshPerPage());
        const totalRooms = cshRoomsCache.length;
        const totalPages = Math.max(1, Math.ceil(totalRooms / perPage));
        if (page < 1 || page > totalPages) return [];
        const start = (page - 1) * perPage;
        return cshRoomsCache.slice(start, start + perPage);
    }

    function fillCshPage(panel, rooms) {
        panel.innerHTML = '';
        if (!rooms.length) return;
        for (const room of rooms) panel.appendChild(buildRoomCard(room));
    }
    function cshResetTrackPosition(track, value = 'translateX(0)') {
        if (!track) return;
        track.classList.remove('animating');
        track.style.setProperty('transition', 'none', 'important');
        track.style.transform = value;
        track.offsetHeight; // 強制 reflow，確保 none 生效後再解除
        track.style.removeProperty('transition');
    }
    function renderCshList(resetPage = false) {
        const shell = document.getElementById('liko-csh-shell');
        const track = shell?._track;
        if (!shell || !track) return;

        cshRoomsCache = getCshRoomsSource();

        const perPage = Math.max(1, calcCshPerPage());
        const totalRooms = cshRoomsCache.length;
        const totalPages = Math.max(1, Math.ceil(totalRooms / perPage));

        if (resetPage) cshPage = 1;
        cshPage = Math.min(Math.max(1, cshPage), totalPages);

        track.innerHTML = '';

        const prev = document.createElement('div');
        prev.className = 'liko-csh-page prev';

        const curr = document.createElement('div');
        curr.className = 'liko-csh-page curr';

        const next = document.createElement('div');
        next.className = 'liko-csh-page next';

        fillCshPage(prev, getCshPageRooms(cshPage - 1));
        fillCshPage(curr, getCshPageRooms(cshPage));
        fillCshPage(next, getCshPageRooms(cshPage + 1));

        if (!curr.childElementCount) {
            const emp = document.createElement('div');
            emp.className = 'liko-csh-empty';
            i18nText(emp, 'chatsearch.no_rooms');
            curr.appendChild(emp);
        }

        track.appendChild(prev);
        track.appendChild(curr);
        track.appendChild(next);
        cshResetTrackPosition(track, 'translateX(0)');

        shell._prev.className = 'liko-csh-page-btn' + (cshPage > 1 ? '' : ' disabled');
        shell._next.className = 'liko-csh-page-btn' + (cshPage < totalPages ? '' : ' disabled');
        shell._pageInfo.textContent = totalRooms > 0
            ? MPLT('chatsearch.page_info', { page: cshPage, total: totalPages, count: totalRooms })
        : '0/0';

        refreshCshSpaceButton();
    }
    function cshBindSwipe(list) {
        if (!list || list._likoSwipeBound) return;
        list._likoSwipeBound = true;

        list.addEventListener('pointerdown', e => {
            if (cshAnimating) return;
            cshDrag = {
                startX: e.clientX,
                dx: 0,
                dragging: true,
            };
        });

        list.addEventListener('pointermove', e => {
            if (!cshDrag?.dragging) return;

            const shell = document.getElementById('liko-csh-shell');
            const track = shell?._track;
            if (!track) return;

            let dx = e.clientX - cshDrag.startX;

            const perPage = Math.max(1, calcCshPerPage());
            const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
            const atFirst = cshPage <= 1;
            const atLast = cshPage >= totalPages;

            if ((dx > 0 && atFirst) || (dx < 0 && atLast)) {
                dx *= 0.22;
            }

            cshDrag.dx = dx;
            track.classList.remove('animating');
            track.style.transform = `translateX(${dx}px)`;
        }, { passive: true });

        function endDrag() {
            if (!cshDrag?.dragging) return;

            const shell = document.getElementById('liko-csh-shell');
            const track = shell?._track;
            if (!track) return;

            const dx = cshDrag.dx;
            cshDrag = null;

            const perPage = Math.max(1, calcCshPerPage());
            const totalPages = Math.max(1, Math.ceil(cshRoomsCache.length / perPage));
            const threshold = Math.min(120, window.innerWidth * 0.20);

            if (dx > threshold && cshPage > 1) {
                cshAnimating = true;
                track.classList.add('animating');
                track.style.transform = 'translateX(100%)';
                track.addEventListener('transitionend', function done() {
                    track.removeEventListener('transitionend', done);
                    cshAnimating = false;
                    cshPage--;
                    renderCshList(false);
                }, { once: true });
                return;
            }

            if (dx < -threshold && cshPage < totalPages) {
                cshAnimating = true;
                track.classList.add('animating');
                track.style.transform = 'translateX(-100%)';
                track.addEventListener('transitionend', function done() {
                    track.removeEventListener('transitionend', done);
                    cshAnimating = false;
                    cshPage++;
                    renderCshList(false);
                }, { once: true });
                return;
            }

            track.classList.add('animating');
            track.style.transform = 'translateX(0)';
        }

        list.addEventListener('pointerup', endDrag);
        list.addEventListener('pointercancel', endDrag);
    }

    /** 關閉房間詳情 bottom sheet */
    function cshCloseRoomInfo() {
        document.getElementById('liko-csh-info-backdrop')?.remove();
    }

    /**
     * 顯示房間詳情 bottom sheet。
     * @param {object} room - BC 房間資料物件
     */
    function cshShowRoomInfo(room) {
        cshCloseRoomInfo();

        const backdrop = document.createElement('div'); backdrop.id = 'liko-csh-info-backdrop';
        backdrop.addEventListener('click', cshCloseRoomInfo);
        backdrop.addEventListener('pointerdown', e => e.stopPropagation());
        backdrop.addEventListener('pointermove', e => e.stopPropagation());
        backdrop.addEventListener('pointerup',   e => e.stopPropagation());

        const sheet = document.createElement('div'); sheet.id = 'liko-csh-info-sheet';
        sheet.addEventListener('click', e => e.stopPropagation());

        // 拖曳把手（視覺用）
        const handle = document.createElement('div'); handle.id = 'liko-csh-info-handle';
        sheet.appendChild(handle);

        // 標題列
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

        // 描述
        const descEl = document.createElement('div'); descEl.id = 'liko-csh-info-desc';
        descEl.textContent = room.Description || MPLT('room_info.no_desc');
        sheet.appendChild(descEl);

        // 標籤列
        const tagsWrap = document.createElement('div'); tagsWrap.id = 'liko-csh-info-tags';
        for (const tagText of buildRoomTags(room)) {
            const tag = document.createElement('div'); tag.className = 'liko-csh-tag';
            tag.textContent = tagText;
            tagsWrap.appendChild(tag);
        }
        sheet.appendChild(tagsWrap);

        // 好友列表
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

        // 底部：人數 + 加入按鈕
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
            const joinBtnDom = room?.Order != null
            ? document.getElementById(`chat-search-room-join-button-${room.Order}`)
            : null;
            if (joinBtnDom) joinBtnDom.click();
            else if (typeof ChatSearchClickRoom === 'function') ChatSearchClickRoom(room);
        });

        footer.appendChild(members);
        footer.appendChild(joinBtn2);
        sheet.appendChild(footer);

        backdrop.appendChild(sheet);
        document.body.appendChild(backdrop);
    }

    /** 關閉 ChatSearch 直版模式 */
    function cshRemove() {
        if (!cshActive) return;
        cshActive     = false;
        cshAnimating  = false;
        cshDrag       = null;

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

    let drActive    = false;
    let drMirrorRAF = null;   // mirror canvas 的 requestAnimationFrame handle
    let drCapture   = null;   // { overlay, onPointer }

    /**
     * 將下半螢幕的點擊座標轉換為 BC 虛擬座標，並注入點擊事件。
     * 由於合成事件的 pointerId 沒有對應真實 pointer，需暫時覆蓋
     * setPointerCapture / releasePointerCapture 以避免 NotFoundError。
     * @param {number} screenX
     * @param {number} screenY
     * @param {string} [pointerType]
     */
    function drInjectClick(screenX, screenY, pointerType = 'touch') {
        const vw  = window.innerWidth;
        const cvH = Math.round(window.innerHeight * 0.5);
        const cv  = getCanvas();
        if (!cv) return;

        const rect = cv.getBoundingClientRect();

        // 設定 BC 全域滑鼠座標（虛擬座標系，右半 x:1000~2000）
        if (typeof MouseX !== 'undefined') window.MouseX = 1000 + (screenX / vw) * 1000;
        if (typeof MouseY !== 'undefined') window.MouseY = (screenY - cvH) / cvH * 1000;

        const eventOpts = {
            bubbles: true, cancelable: true,
            clientX: (vw + screenX) + rect.left,
            clientY: (screenY - cvH) + rect.top,
            pointerType,
            isPrimary: true,
        };

        if (typeof PointerEvent === 'function') {
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

        // 兩幀後重置滑鼠座標，避免影響後續的 BC 事件判斷
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (typeof MouseX !== 'undefined') window.MouseX = -1;
                if (typeof MouseY !== 'undefined') window.MouseY = -1;
            });
        });
    }

    /**
     * 記錄每個被搬移過的 dialog 元素「上一次我們設定的 left/top」。
     * 用來判斷 BC 這一幀是否重新定位過它——避免持續疊加位移造成漂移/抖動。
     * @type {WeakMap<HTMLElement, { lastSetLeft: number, lastSetTop: number }>}
     */
    const drMovedElements = new WeakMap();

    /**
     * 每幀將 dialog-root 等頂層容器移到下半螢幕。
     * 只移動頂層容器，子元素保持相對定位不變。
     */
    function drMoveDomElements() {
        if (!drActive) return;
        const vw  = window.innerWidth;
        const cvH = Math.round(window.innerHeight * 0.5);

        document.querySelectorAll('.dialog-root, #color-picker, #layering').forEach(el => {
            const r    = el.getBoundingClientRect();
            const prev = drMovedElements.get(el);

            // 若目前位置與上次我們設定的相同，代表 BC 這幀沒有重新定位，跳過
            if (prev
                && Math.abs(r.left - prev.lastSetLeft) < 1
                && Math.abs(r.top  - prev.lastSetTop)  < 1) return;

            // 只處理 BC 定位在螢幕右側（超出 vw）的元素
            if (r.left < vw * 0.5) return;

            const newLeft = r.left - vw;
            const newTop  = r.top  + cvH;

            el.style.setProperty('left',    newLeft + 'px', 'important');
            el.style.setProperty('top',     newTop  + 'px', 'important');
            el.style.setProperty('z-index', String(Z.DIALOG_ROOT), 'important');
            if (el.classList.contains('dialog-root'))
                el.style.setProperty('width', vw + 'px', 'important');

            drMovedElements.set(el, { lastSetLeft: newLeft, lastSetTop: newTop });
        });
    }

    /**
     * 建立 mirror canvas，持續複製主 canvas 右半（Dialog 區）到下半螢幕。
     * 每 2 幀複製一次背景（30fps 足夠），每幀執行 DOM 搬移。
     */
    function drStartMirror() {
        const cvH = Math.round(window.innerHeight * 0.5);
        const vw  = window.innerWidth;

        document.getElementById('liko-dr-mirror')?.remove();
        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }

        const mirror    = document.createElement('canvas'); mirror.id = 'liko-dr-mirror';
        mirror.width    = vw;
        mirror.height   = cvH;
        mirror.style.cssText = `
            position:fixed !important;
            top:${cvH}px !important; left:0 !important;
            width:${vw}px !important; height:${cvH}px !important;
            z-index:${Z.DR_MIRROR} !important;
            pointer-events:none !important;
        `;
        document.body.appendChild(mirror);

        const ctx = mirror.getContext('2d');
        const src = getCanvas();
        let frameCount = 0;

        const loop = () => {
            drMirrorRAF = requestAnimationFrame(loop);
            if (!drActive || !src) return;
            frameCount++;
            if (frameCount % 2 === 0) {
                ctx.clearRect(0, 0, vw, cvH);
                try { ctx.drawImage(src, 1000, 0, 1000, 1000, 0, 0, vw, cvH); } catch {}
            }
            drMoveDomElements();
        };
        loop();
    }

    /** 啟用 Dialog 直版模式 */
    function drApply() {
        if (drActive) return;
        drActive = true;

        const cvH = Math.round(window.innerHeight * 0.5);
        forceCanvasStyle(cvH);

        injectStyle('liko-ml-dr', `
            html, body { overflow-x:hidden !important }
            #liko-dr-overlay {
                position:fixed;
                top:${cvH}px; left:0;
                width:100vw; height:calc(100vh - ${cvH}px);
                z-index:${Z.DR_OVERLAY} !important;
                cursor:pointer;
                -webkit-tap-highlight-color:transparent;
                background:transparent;
            }
            .dialog-root {
                pointer-events:auto !important;
                overflow-y:auto !important;
            }
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
            const pt = e.type === 'touchstart' ? 'touch' : 'mouse';
            if (x != null && y != null) drInjectClick(x, y, pt);
        };

        overlay.addEventListener('mousedown',  onPointer, { passive: false });
        overlay.addEventListener('touchstart', onPointer, { passive: false });
        document.body.appendChild(overlay);

        drCapture = { overlay, onPointer };
        drMoveDomElements();
    }

    /** 關閉 Dialog 直版模式，還原所有修改 */
    function drRemove() {
        if (!drActive) return;
        drActive = false;

        if (drMirrorRAF) { cancelAnimationFrame(drMirrorRAF); drMirrorRAF = null; }
        document.getElementById('liko-dr-mirror')?.remove();

        // 還原所有被搬移的 dialog 元素
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

    /** 每幀維護 Dialog 直版版面（供 DrawProcess hook 呼叫） */
    function drMaintain() {
        if (!drActive) return;
        forceCanvasStyle(Math.round(window.innerHeight * 0.5));
        // mirror canvas 由自己的 rAF loop 維持，不需要額外呼叫
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測（每幀由 DrawProcess hook 呼叫）
    // 根據目前螢幕方向與 BC 場景，決定啟用/關閉哪個直版模式
    // ════════════════════════════════════════════════════════════════════════════

    function checkScene() {
        const scr       = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
        const p         = isPortrait();
        const hasDialog = typeof CurrentCharacter !== 'undefined' && CurrentCharacter !== null;

        // 登入頁直版模式
        if (scr === 'Login' && p) mplApply();
        else if (mplActive)       mplRemove();

        // 非直向時全部關閉
        if (!p) {
            if (crActive)  crRemove();
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (drActive)  drRemove();
            return;
        }

        if (scr === 'ChatRoom' && hasDialog) {
            // 聊天室中開啟 Dialog
            if (csActive)  csRemove();
            if (cshActive) cshRemove();
            if (crActive)  crRemove();
            if (!drActive) drApply();
        } else if (scr === 'ChatRoom' && !hasDialog) {
            // 聊天室（無 Dialog）
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
        // 登入成功後 4 秒擷取角色快照（等待角色資料完全載入）
        if (args[0] && typeof args[0] === 'object')
            setTimeout(captureAndSaveProfile, 5000);
        return result;
    });

    modApi.hookFunction('LoginLoad', 0, (args, next) => {
        const r = next(args);
        if (isPortrait()) setTimeout(mplApply, 50);
        return r;
    });

    modApi.hookFunction('LoginUnload', 0, (args, next) => {
        mplRemove();
        return next(args);
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

    // 註：新版 BC 已移除 ChatRoomTopMenuPosition（頂部選單改為 #chat-room-div 內、
    // 由 CSS flex 排版的子元素），不再有可攔的單獨定位函式。重套直版版面的責任改由
    // 下面的 ChatRoomResize hook 與 window resize/orientationchange 監聽器承擔。
    modApi.hookFunction('ChatRoomResize', 0, (args, next) => {
        const r = next(args);
        crMaintain();
        return r;
    });

    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
        crRemove();
        return next(args);
    });

    modApi.hookFunction('ChatSearchResultResponse', 0, (args, next) => {
        const r = next(args);
        if (cshActive) cshNeedSync = true;
        return r;
    });

    modApi.hookFunction('ChatSearchRun', 0, (args, next) => {
        const r = next(args);
        // 收到新房間列表後，debounce 100ms 再重刷（BC 可能連續呼叫多次 Run）
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
    // 視窗尺寸事件處理
    // ════════════════════════════════════════════════════════════════════════════

    /** @returns {boolean} 假輸入框覆蓋層是否正在顯示中 */
    function isFakeInputVisible() {
        return crFakeInputActive || !!document.getElementById('liko-cr-fake-input-overlay');
    }

    function handleResize() {
        // 假輸入框顯示時不重算版面，避免鍵盤彈出觸發 resize 造成跑版
        if (isFakeInputVisible()) return;
        const p = isPortrait();

        if (crActive) {
            if (!p) crRemove();
            else    crMaintain();
        }
        if (csActive) {
            csRemove();
            if (p) csApply();
        }
        if (cshActive) {
            if (!p) cshRemove();
            else    renderCshList(false);
        }
        if (drActive) {
            if (!p) drRemove();
            else  { drMaintain(); drMoveDomElements(); }
        }
    }

    // 取得排除軟體鍵盤後的視窗高度。 優先使用 visualViewport.height（iOS/Android 鍵盤彈出後會縮小）。
    function getLockedVH() { return window.visualViewport ? window.visualViewport.height : window.innerHeight; }

    // visualViewport resize：調整假輸入框覆蓋層高度，防止被鍵盤推走
    window.visualViewport?.addEventListener('resize', () => {
        const overlay = document.getElementById('liko-cr-fake-input-overlay');
        if (overlay) overlay.style.height = getLockedVH() + 'px';
    });

    // window resize 加上 debounce（部分瀏覽器連續觸發多次會造成閃爍）
    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(handleResize, 120);
    });
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));

    // ════════════════════════════════════════════════════════════════════════════
    // MPL Login 登入頁直版模式
    // ════════════════════════════════════════════════════════════════════════════

    // ── 常數 ──────────────────────────────────────────────────────────────────
    const MPL_KEY       = 'mpl_accounts';   // localStorage key（帳號列表）
    const IDB_NAME      = 'mpl-profiles';   // IndexedDB 資料庫名稱
    const IDB_STORE     = 'profiles';       // 角色快照的 ObjectStore
    const IDB_KEY_STORE = 'cryptokeys';     // AES-GCM 金鑰的 ObjectStore

    //取得登入背景圖 URL。
    function getBgUrl() {
        const href = window.location.href;
        const base = href.includes('/')
        ? href.slice(0, href.lastIndexOf('/') + 1)
        : href + '/';
        const bg = typeof LoginBackground !== 'undefined' ? LoginBackground : 'Dressing';
        return base + 'Backgrounds/' + bg + '.jpg';
    }

    // ── AES-GCM 加密工具 ───────────────────────────────────────────────────────

    const bufToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
    const b64ToBuf = b64 => {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
    };

    //AES-GCM 金鑰（存放於 IndexedDB，首次使用時自動生成）。
    let _cryptoKeyPromise = null;

    function getCryptoKey() {
        if (_cryptoKeyPromise) return _cryptoKeyPromise;
        _cryptoKeyPromise = (async () => {
            const db       = await openDB();
            const existing = await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE).objectStore(IDB_KEY_STORE).get('mainKey');
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            });
            if (existing?.key) {
                return crypto.subtle.importKey('jwk', existing.key, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
            }
            const key      = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
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
            _cryptoKeyPromise = null;
            return Promise.reject(e);
        });
        return _cryptoKeyPromise;
    }

    //加密明文密碼，格式：base64(iv) + ':' + base64(ciphertext)
    async function encryptPassword(plaintext) {
        const key    = await getCryptoKey();
        const iv     = crypto.getRandomValues(new Uint8Array(12));
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(plaintext)
        );
        return bufToB64(iv.buffer) + ':' + bufToB64(cipher);
    }

    /**
     * 解密已加密的密碼字串，失敗時回傳 null。
     * @param {string} stored - 格式：base64(iv) + ':' + base64(ciphertext)
     * @returns {Promise<string | null>}
     */
    async function decryptPassword(stored) {
        try {
            const key          = await getCryptoKey();
            const [ivB64, cipherB64] = stored.split(':');
            const plain        = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) },
                key,
                b64ToBuf(cipherB64)
            );
            return new TextDecoder().decode(plain);
        } catch (e) {
            console.warn('🐈‍⬛ [MPL] 解密失敗:', e);
            return null;
        }
    }

    // ── IndexedDB（角色快照 + 密鑰）──────────────────────────────────────────

    let _db = null;

    /** @returns {Promise<IDBDatabase>} */
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

    //從 IndexedDB 取得角色快照。
    async function dbGet(accountName) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(accountName);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = () => resolve(null);
        });
    }

    //寫入角色快照到 IndexedDB。
    async function dbPut(profile) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(profile);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    //從 IndexedDB 刪除角色快照。
    async function dbDelete(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return false;
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    // ── localStorage（帳號列表）───────────────────────────────────────────────

    /** @returns {Array<{ accountName: string, password: string, addedAt: number }>} */
    function loadAccounts() {
        try { return JSON.parse(localStorage.getItem(MPL_KEY) || '[]'); }
        catch { return []; }
    }

    /** @param {Array} list */
    function saveAccounts(list) {
        localStorage.setItem(MPL_KEY, JSON.stringify(list));
    }

    //新增或更新一個帳號（密碼加密後存入）。
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

    /** @param {string} accountName */
    function removeAccount(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return;
        saveAccounts(loadAccounts().filter(a => a.accountName !== key));
    }

    // ── 角色快照（頭像 + 暱稱 + ID）──────────────────────────────────────────

    //從 Player.Canvas 擷取頭像縮圖（臉部區域），回傳 Data URL。
    function makeAvatarDataUrl(size = 48) {
        try {
            const src = Player?.Canvas;
            if (!src || src.width === 0) return null;
            const off = document.createElement('canvas');
            off.width = size; off.height = size;
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#0a0c12';
            ctx.fillRect(0, 0, size, size);
            // 擷取臉部區域（BC canvas 的相對座標，根據實測調整）
            const sx = src.width * 0.39, sy = src.height * 0.40;
            const sw = src.width * 0.22, sh = src.height * 0.12;
            ctx.drawImage(src, sx, sy, sw, sh, 0, 0, size, size);
            return off.toDataURL('image/jpeg', 0.85);
        } catch { return null; }
    }

    /** 擷取目前登入角色的快照並存入 IndexedDB，完成後重刷帳號卡片列 */
    async function captureAndSaveProfile() {
        try {
            if (typeof Player === 'undefined' || !Player?.AccountName) return;
            const accountKey = Player.AccountName.toUpperCase();
            await dbPut({
                accountName:   accountKey,
                name:          Player.Name        || '',
                nickname:      Player.Nickname    || null,
                memberNumber:  Player.MemberNumber ?? null,
                avatarDataUrl: makeAvatarDataUrl(56),
                savedAt:       Date.now(),
            });
            mplRefreshAccountRow();
        } catch (e) {
            console.warn('🐈‍⬛ [MPL] 快照失敗:', e);
        }
    }

    // ── BC DOM 隱藏 / 還原 ────────────────────────────────────────────────────

    // 進入 MPL 登入模式時需要隱藏的 BC 原生元素
    const BC_HIDE_IDS = [
        'InputName', 'InputPassword',
        'login-name-label', 'login-password-label',
        'login-welcome-message', 'login-status',
        'login-login-button', 'login-new-character-label',
        'login-register-button', 'login-password-reset-button',
        'login-password-reset-hint', 'login-cheats-button',
        'login-footer', 'LanguageDropdown',
    ];

    // 需要維持可見的第三方插件元素（FUSAM）
    const BC_PASSTHROUGH_IDS = ['fusam-show-button', 'fusam-addon-manager-container'];

    /** 隱藏 BC 原生登入 UI，並確保 FUSAM 保持可見 */
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

    /** 確保 FUSAM 插件元素在 MPL 登入模式下保持可見且可互動 */
    function ensureFusamVisible() {
        BC_PASSTHROUGH_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                applyFusamStyle(el);
                if (id === 'fusam-addon-manager-container') watchFusamContainerRemoval();
            }
        });
        // 若 FUSAM 尚未渲染，使用 MutationObserver 等待它出現
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

    /** 為 FUSAM 元素設定 fixed 定位與高 z-index，確保在 MPL 背景上方顯示 */
    function applyFusamStyle(el) {
        el.style.removeProperty('display');
        if (el.id === 'fusam-addon-manager-container') {
            let node = el;
            while (node && node !== document.body) {
                node.style.setProperty('z-index', String(Z.FUSAM), 'important');
                node.style.setProperty('position', 'relative', 'important');
                node = node.parentElement;
            }
            el.style.setProperty('font-size',    '10px',   'important');
            el.style.setProperty('max-width',     '92vw',   'important');
            el.style.setProperty('max-height',    '80vh',   'important');
            el.style.setProperty('width',         '92vw',   'important');
            el.style.setProperty('height',        '80vh',   'important');
            el.style.setProperty('top',           '10vh',   'important');
            el.style.setProperty('left',          '4vw',    'important');
            el.style.setProperty('border-radius', '12px',   'important');
            el.style.setProperty('overflow',      'hidden',  'important');
            el.style.setProperty('position',      'fixed',   'important');
        } else {
            el.style.setProperty('position',       'fixed', 'important');
            el.style.setProperty('z-index',        String(Z.FUSAM), 'important');
            el.style.setProperty('pointer-events', 'auto',  'important');
        }
    }

    //監聽 FUSAM container 從 DOM 中移除的事件，移除後還原祖先元素的樣式。 避免 FUSAM 關閉後父元素殘留高 z-index 影響其他 UI。
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
                ['font-size', 'max-width', 'max-height', 'width', 'height',
                 'top', 'left', 'border-radius', 'overflow', 'position']
                    .forEach(p => container.style.removeProperty(p));
                removalObserver.disconnect();
            }
        });
        removalObserver.observe(document.body, { childList: true, subtree: true });
    }

    /** 還原 BC 原生登入 UI，清除 FUSAM 的 override 樣式 */
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

    // ── 登入頁樣式 ────────────────────────────────────────────────────────────

    function injectLoginStyles() {
        if (document.getElementById('mpl-styles')) return;
        const s = document.createElement('style');
        s.id = 'mpl-styles';
        s.textContent = `
/* ══ MPL Login UI ══════════════════════════════════════════════════════════ */
#mpl-bg {
    position:fixed; inset:0; z-index:1000;
    background:#0a0c12; overflow:hidden;
}
#mpl-bg-img {
    position:absolute; top:0; left:-150%;
    width:400%; height:100%;
    object-fit:cover; object-position:top left;
    pointer-events:none;
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

/* ── 主 UI 層 ── */
#mpl-root {
    position:absolute; inset:0;
    display:flex; flex-direction:column;
    align-items:center; justify-content:space-between;
    pointer-events:none;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC',sans-serif;
}
#mpl-root > * { pointer-events:auto; }

/* ── 頂部 ── */
#mpl-top {
    width:100%; padding:30px 24px 5px; text-align:center;
    background:linear-gradient(180deg,rgba(0,0,0,0.55) 0%,transparent 100%);
}
#mpl-title {
    font-size:28px; font-weight:700; color:#e8dcff;
    letter-spacing:2px;
    text-shadow:0 0 24px rgba(167,139,250,0.50);
}
#mpl-status {
    margin-top:10px; font-size:19px;
    color:rgba(200,185,255,0.80); min-height:26px;
    text-shadow:0 1px 8px rgba(0,0,0,0.8);
}
#mpl-status.error { color:rgba(255,120,120,0.95); }

/* ── 帳號卡片列 ── */
#mpl-accounts-section { width:100%; max-width:560px; padding:0 20px; }
#mpl-accounts-row {
    display:flex; gap:14px;
    overflow-x:auto; overflow-y:visible; scrollbar-width:none;
    padding:16px 50px 20px;
    cursor:grab; user-select:none; justify-content:flex-start;
    perspective:600px; perspective-origin:50% 50%;
}
#mpl-accounts-row:active { cursor:grabbing; }
#mpl-accounts-row::-webkit-scrollbar { display:none; }

.mpl-acct-card {
    flex-shrink:0; width:84px; border-radius:13px;
    border:1.5px solid rgba(200,180,255,0.25);
    background:rgba(20,14,36,0.68);
    backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
    padding:7px 8px 8px;
    display:flex; flex-direction:column; align-items:center; gap:4px;
    cursor:pointer; position:relative; user-select:none;
    transition:border-color .22s,background .22s,
               transform .35s cubic-bezier(0.25,0.8,0.25,1),
               box-shadow .35s,opacity .35s;
    transform-style:preserve-3d; will-change:transform,opacity;
    transform-origin:center center;
}
.mpl-acct-card:hover  { border-color:rgba(200,180,255,0.55); }
.mpl-acct-card.active {
    border-color:rgba(200,170,255,0.80);
    background:rgba(127,83,205,0.22);
    box-shadow:0 4px 18px rgba(127,83,205,0.35);
}
.mpl-acct-ghost { flex-shrink:0; width:84px; pointer-events:none; visibility:hidden; }
.mpl-acct-top-label {
    font-size:10px; font-weight:600; color:rgba(200,185,255,0.70);
    text-align:center; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; width:100%;
    letter-spacing:0.3px; line-height:1.2;
}
.mpl-avatar {
    width:42px; height:42px; border-radius:9px;
    background:rgba(127,83,205,0.22); border:1px solid rgba(200,180,255,0.25);
    overflow:hidden; display:flex; align-items:center; justify-content:center;
}
.mpl-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
.mpl-avatar-ph { font-size:20px; }
.mpl-acct-name {
    font-size:16px; font-weight:600; color:#ddd5f8;
    text-align:center; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; width:100%;
}
.mpl-acct-id  { font-size:15px; color:rgba(190,175,225,0.55); text-align:center; }
.mpl-acct-del {
    position:absolute; top:5px; right:5px;
    width:16px; height:16px; border-radius:4px;
    background:rgba(239,68,68,0.12); border:0.5px solid rgba(239,68,68,0.30);
    color:rgba(255,130,130,0.75); font-size:8px;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:background .12s; z-index:2;
}
.mpl-acct-del:hover { background:rgba(239,68,68,0.30); }

/* ── 主表單 ── */
#mpl-form-section {
    max-width:420px; padding:0;
    display:flex; flex-direction:column; gap:10px; align-items:center;
}
.mpl-field {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 40px;
    width: 100%;
}
.mpl-field-label {
    font-size: 20px;
    color: rgba(210,195,245,0.75);
    text-shadow: 0 1px 6px rgba(0,0,0,0.7);
    white-space: nowrap;
    flex-shrink: 0;
    width: 48px;
    text-align: left;
    text-overflow: ellipsis;
}
.mpl-input {
    background:#ffffff; border:1.5px solid rgba(200,180,255,0.35);
    border-radius:11px; color:#1a1a2e; -webkit-text-fill-color:#1a1a2e;
    padding:5px 15px; font-size:21px; font-family:inherit;
    outline:none; flex:1; transition:border-color .15s,box-shadow .15s;
        flex: 0 0 220px;
    width: 220px;
}
.mpl-input:focus {
    border-color:rgba(127,83,205,0.70);
    box-shadow:0 0 0 3px rgba(127,83,205,0.15);
}
.mpl-input::placeholder {
    color:rgba(100,90,130,0.55);
    -webkit-text-fill-color:rgba(100,90,130,0.55);
}

/* ── 按鈕列 ── */
#mpl-btn-row {
    width:80%; max-width:420px; padding:0;
    display:flex; flex-direction:column; gap:8px; align-items:stretch; margin-top:10px;
}
#mpl-btn-login {
    width:100%; padding:10px;
    background:rgba(127,83,205,0.30); border:1.5px solid rgba(200,170,255,0.55);
    border-radius:12px; color:#e8dcff; font-size:21px; font-weight:700; font-family:inherit;
    cursor:pointer; transition:background .15s;
    text-shadow:0 0 12px rgba(167,139,250,0.4);
}
#mpl-btn-login:hover    { background:rgba(127,83,205,0.48); }
#mpl-btn-login:disabled { opacity:0.40; cursor:default; }
#mpl-btn-row-secondary  { display:flex; gap:10px; width:100%; }
#mpl-btn-save-acct,
#mpl-btn-reset {
    flex:1; min-width:0; padding:10px;
    background:rgba(14,10,28,0.55); backdrop-filter:blur(8px);
    border:1.5px solid rgba(200,180,255,0.35); border-radius:12px;
    color:rgba(220,210,245,0.85); font-size:13px; font-family:inherit;
    cursor:pointer; transition:background .15s,border-color .15s; white-space:nowrap;
}
#mpl-btn-save-acct:hover,
#mpl-btn-reset:hover { background:rgba(127,83,205,0.22); border-color:rgba(200,170,255,0.55); }
#mpl-privacy-note {
    font-size:13px; color:rgba(180,170,210,0.45);
    text-align:center; letter-spacing:0.5px; margin-top:1px;
}

/* ── 建立角色 ── */
#mpl-register-section {
    width:100%; max-width:420px; padding:0 24px;
    display:flex; flex-direction:column; gap:9px; align-items:center;
}
.mpl-divider { display:flex; align-items:center; gap:10px; width:70%; }
.mpl-div-line { flex:1; height:0.5px; background:rgba(200,185,230,0.15); }
.mpl-div-text { font-size:17px; color:rgba(200,185,230,0.45); }
#mpl-btn-register {
    width:80%; padding:10px;
    background:rgba(14,10,28,0.55); backdrop-filter:blur(8px);
    border:1.5px solid rgba(200,180,255,0.28); border-radius:12px;
    color:rgba(220,210,245,0.85); font-size:18px; font-family:inherit;
    cursor:pointer; transition:background .15s,border-color .15s;
}
#mpl-btn-register:hover { background:rgba(127,83,205,0.18); border-color:rgba(200,170,255,0.50); }

/* ── 底部 ── */
#mpl-bottom {
    width:100%; padding:10px 20px 30px;
    background:linear-gradient(0deg,rgba(0,0,0,0.55) 0%,transparent 100%);
    display:flex; flex-direction:column; gap:20px; align-items:center;
}
#mpl-bottom-controls {
    width:100%; max-width:560px;
    display:flex; align-items:center; justify-content:center; gap:10px;
}
#mpl-lang-select {
    background:rgba(14,10,28,0.72); border:1px solid rgba(200,180,255,0.28);
    border-radius:8px; color:rgba(220,210,245,0.85); font-size:17px;
    padding:7px 20px 7px 10px; font-family:inherit; cursor:pointer;
    flex-shrink:0; appearance:auto; -webkit-appearance:auto;
}
#mpl-settings-btn {
    height:38px; padding:0 18px; border-radius:9px;
    background:rgba(14,10,28,0.72); border:1px solid rgba(200,180,255,0.28);
    color:rgba(220,210,245,0.85); font-size:17px; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:5px;
    cursor:pointer; transition:background .15s; flex-shrink:0; white-space:nowrap;
}
#mpl-settings-btn:hover { background:rgba(127,83,205,0.28); border-color:rgba(200,170,255,0.50); }

/* ── 跑馬燈 ── */
#mpl-marquee-wrap {
    width:100%; max-width:560px; overflow:hidden; height:22px;
    mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
    -webkit-mask-image:linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%);
}
#mpl-marquee-inner {
    display:flex; gap:28px; position:relative;
    will-change:transform; white-space:nowrap;
}
.mpl-marquee-item { font-size:17px; color:rgba(200,185,230,0.40); white-space:nowrap; flex-shrink:0; }
.mpl-marquee-item span { color:rgba(200,180,255,0.65); }

/* ── 設定浮層 ── */
#mpl-settings-overlay {
    display:none; position:absolute; inset:0; z-index:20;
    background:rgba(0,0,0,0.60); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
}
#mpl-settings-overlay.visible { display:flex; }
#mpl-settings-box {
    background:rgba(14,10,26,0.96); border:1px solid rgba(200,180,255,0.28);
    border-radius:16px; padding:20px; width:min(290px,88vw);
    display:flex; flex-direction:column; gap:13px;
    box-shadow:0 16px 40px rgba(0,0,0,0.5);
}
.mpl-sett-title { font-size:20px; font-weight:600; color:#ddd5f8; }
.mpl-sett-row {
    display:flex; align-items:center; justify-content:space-between;
    font-size:19px; color:rgba(210,195,240,0.85);
}
.mpl-sett-row input[type=checkbox] { accent-color:#7F53CD; cursor:pointer; width:18px; height:18px; }
.mpl-sett-close {
    width:100%; padding:9px;
    background:rgba(127,83,205,0.18); border:1px solid rgba(200,170,255,0.35);
    border-radius:9px; color:#c4b5fd; font-size:19px; font-family:inherit; cursor:pointer;
}
        `;
        document.head.appendChild(s);
    }

    // ── 狀態字串同步 ──────────────────────────────────────────────────────────

    let _lastStatusMsg   = null;
    let _lastStatusError = null;

    /**
     * 將 BC 的登入狀態同步到 MPL 的狀態列。
     * 使用快取避免每次 poll 都重寫 DOM。
     */
    function syncStatus() {
        const el = document.getElementById('mpl-status');
        if (!el) return;

        let msg = '', isError = false;

        if (typeof LoginErrorMessage !== 'undefined' && LoginErrorMessage) {
            msg     = (typeof TextGet === 'function' ? TextGet(LoginErrorMessage) : '') || LoginErrorMessage;
            isError = true;
        } else if (typeof ServerIsConnected !== 'undefined' && !ServerIsConnected) {
            msg = (typeof TextGet === 'function' ? TextGet('ConnectingToServer') : '') || MPLT('login.enter_hint');
        } else if (typeof LoginQueuePosition !== 'undefined' && LoginQueuePosition !== -1) {
            const tmpl = (typeof TextGet === 'function' ? TextGet('LoginQueueWait') : '') || 'Queue: QUEUE_POS';
            msg = tmpl.replace('QUEUE_POS', String(LoginQueuePosition));
        } else if (typeof LoginSubmitted !== 'undefined' && LoginSubmitted) {
            msg = (typeof TextGet === 'function' ? TextGet('ValidatingNamePassword') : '') || '...';
        } else {
            msg = (typeof TextGet === 'function' ? TextGet('EnterNamePassword') : '') || MPLT('login.enter_hint');
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
    let selectedIdx  = null;  // 目前選中的帳號卡片索引
    let settingsOpen = false;

    // 跑馬燈狀態
    let marqueeRAF   = null;
    let marqueePosX  = 0;
    let marqueeLastT = null;
    let marqueeHalfW = 0;
    const MARQUEE_SPEED = 28; // px/s

    function getThankYouList() {
        return (typeof LoginThankYouList !== 'undefined' && Array.isArray(LoginThankYouList))
            ? LoginThankYouList
        : [];
    }

    /** 建立登入頁 UI（只建立一次，後續透過 show/hide 控制顯示） */
    function buildUI() {
        if (document.getElementById('mpl-bg')) return;

        mplBg = document.createElement('div'); mplBg.id = 'mpl-bg';

        // 背景圖層
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

        // 設定浮層內容（注意：此處文字由 bindEvents 內的 i18n 刷新，
        // 這裡先用 MPLT 填入初始值）
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

        // 主 UI 根層
        const root = document.createElement('div'); root.id = 'mpl-root';

        // ── 頂部 ──
        const top = document.createElement('div'); top.id = 'mpl-top';
        const titleEl  = document.createElement('div'); titleEl.id = 'mpl-title'; titleEl.textContent = 'Bondage Club';
        const statusEl = document.createElement('div'); statusEl.id = 'mpl-status';
        top.appendChild(titleEl); top.appendChild(statusEl);
        root.appendChild(top);

        // ── 帳號卡片列 ──
        const acctSection = document.createElement('div'); acctSection.id = 'mpl-accounts-section';
        const acctRow     = document.createElement('div'); acctRow.id = 'mpl-accounts-row';
        acctSection.appendChild(acctRow);
        root.appendChild(acctSection);

        // ── 主表單 ──
        const formSection = document.createElement('div'); formSection.id = 'mpl-form-section';

        const mkField = (labelKey, inputId, inputType, placeholderKey, autocomplete, enterkeyhint) => {
            const field = document.createElement('div'); field.className = 'mpl-field';
            const label = document.createElement('div'); label.className = 'mpl-field-label';
            i18nText(label, labelKey);
            const input = document.createElement('input');
            input.className = 'mpl-input'; input.id = inputId; input.type = inputType;
            i18nAttr(input, 'placeholder', placeholderKey);
            input.autocomplete = autocomplete; input.setAttribute('enterkeyhint', enterkeyhint);
            field.appendChild(label); field.appendChild(input);
            return field;
        };

        formSection.appendChild(mkField('login.label_username', 'mpl-input-name', 'text',     'login.placeholder_user', 'username',         'next'));
        formSection.appendChild(mkField('login.label_password', 'mpl-input-pass', 'password', 'login.placeholder_pass', 'current-password', 'go'));
        root.appendChild(formSection);

        // ── 按鈕列 ──
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

        // ── 建立角色 ──
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

        // ── 底部 ──
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
            const key      = await addOrUpdateAccount(name, pass);
            const accounts = loadAccounts();
            const newIdx   = accounts.findIndex(a => a.accountName === key);
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
                // 原生 dropdown 不存在時才直接呼叫（避免雙重觸發）
                TranslationSwitchLanguage(code || 'EN');
                if (typeof TextLoad === 'function')                 TextLoad();
                if (typeof ActivityDictionaryLoad === 'function')   ActivityDictionaryLoad();
                if (typeof AssetLoadDescription === 'function')     AssetLoadDescription('Female3DCG');
            }
            // BC 語言切換是非同步的，稍等後再刷新 i18n 與狀態
            setTimeout(() => {
                _lastStatusMsg = null;
                syncStatus();
                refreshAllI18n();   // ← 即時更新所有 MPL UI 文字
            }, 100);
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

    /**
     * 根據每張卡片與列表中心的距離，套用 3D 旋轉與透明度。
     * 在捲動事件與 resize 後呼叫。
     */
    function updateCoverflowTransforms() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        const cards     = row.querySelectorAll('.mpl-acct-card:not(.mpl-acct-ghost)');
        if (!cards.length) return;
        const rowRect   = row.getBoundingClientRect();
        const rowCenter = rowRect.left + rowRect.width / 2;

        cards.forEach(card => {
            const rect   = card.getBoundingClientRect();
            const cardCx = rect.left + rect.width / 2;
            const dist   = cardCx - rowCenter;
            const t      = Math.min(Math.abs(dist) / (rowRect.width * 0.55), 1);
            const rotY   = dist > 0 ? -35 * t : 35 * t;
            const scale  = 1 - 0.22 * t;
            const tx     = dist > 0 ? -12 * t : 12 * t;

            card.style.transform = `translateX(${tx}px) scale(${scale}) rotateY(${rotY}deg)`;
            card.style.opacity   = 1 - 0.40 * t;
            card.style.zIndex    = Math.round((1 - t) * 10);
        });
    }

    /** 初始化帳號卡片列的拖曳捲動 */
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

    /** 建立語言選擇 dropdown，優先從 BC 原生 dropdown 取得選項 */
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

        // Fallback：只提供英文選項
        const fallback = document.createElement('option');
        fallback.value = 'EN'; fallback.textContent = 'English'; fallback.selected = currentLang === 'EN';
        sel.appendChild(fallback);
    }

    // ── 帳號卡片列渲染 ────────────────────────────────────────────────────────

    /**
     * 重新渲染帳號卡片列。
     * 先同步建立 DOM（讓位置穩定），非同步資料（快照）到後再更新並重算 coverflow。
     */
    function mplRefreshAccountRow() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        row.innerHTML = '';

        const accounts = loadAccounts();

        // 兩端加 ghost 元素，讓第一張與最後一張卡片可以捲到列表中心
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

            // 非同步載入角色快照更新卡片內容
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

        const ghostAfter = document.createElement('div'); ghostAfter.className = 'mpl-acct-ghost';
        row.appendChild(ghostAfter);

        requestAnimationFrame(updateCoverflowTransforms);
        Promise.all(profilePromises).then(() => requestAnimationFrame(updateCoverflowTransforms));
    }

    /**
     * 點選帳號卡片：解密後填入輸入框。
     * 解密失敗（回傳 null）時清空密碼欄位，不填入 null。
     * @param {number} idx
     */
    function selectAccount(idx) {
        selectedIdx = idx;
        const acct = loadAccounts()[idx];
        if (!acct) return;

        const currentSelection = idx;
        const nameEl = document.getElementById('mpl-input-name');
        const passEl = document.getElementById('mpl-input-pass');
        if (nameEl) nameEl.value = acct.accountName;
        if (passEl) passEl.value = '';

        // 只切換 active class，不重建整個列（避免抖動）
        const row = document.getElementById('mpl-accounts-row');
        const cards = row?.querySelectorAll('.mpl-acct-card');
        cards?.forEach((card, i) => card.classList.toggle('active', i === idx));

        // 將選中卡片捲動到列中央
        const selectedCard = cards?.[idx];
        if (row && selectedCard) {
            const targetScroll = selectedCard.offsetLeft - (row.offsetWidth - selectedCard.offsetWidth) / 2;
            row.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
        requestAnimationFrame(updateCoverflowTransforms);

        decryptPassword(acct.password).then(plain => {
            if (selectedIdx !== currentSelection) return; // 使用者已切換其他帳號
            const el = document.getElementById('mpl-input-pass');
            if (el) el.value = plain ?? '';
        });
    }

    /** @param {number} idx */
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

    /**
     * 執行登入動作：將 MPL 輸入框的值同步到 BC 原生輸入框後觸發登入。
     * 使用 native setter 觸發 React/BC 的 onChange 監聽。
     */
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

        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const bcName = document.getElementById('InputName');
        const bcPass = document.getElementById('InputPassword');
        if (bcName && setter) { setter.call(bcName, name); bcName.dispatchEvent(new Event('input', { bubbles: true })); }
        if (bcPass && setter) { setter.call(bcPass, pass); bcPass.dispatchEvent(new Event('input', { bubbles: true })); }

        if (typeof LoginDoLogin === 'function') LoginDoLogin(name, pass);
        else document.getElementById('login-login-button')?.click();
    }

    // ── 跑馬燈 ────────────────────────────────────────────────────────────────

    /** 建立感謝名單跑馬燈 DOM（複製兩份以實現無縫循環） */
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
    /** 啟動跑馬燈動畫循環 */
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

    /** 啟用 MPL 登入頁直版模式 */
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
    }

    /** 關閉 MPL 登入頁直版模式，還原 BC 原生 UI */
    function mplRemove() {
        if (!mplActive) return;
        mplActive = false;
        showBC();
        if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
        if (marqueeRAF)   { cancelAnimationFrame(marqueeRAF); marqueeRAF = null; }
        const bg = document.getElementById('mpl-bg');
        if (bg) bg.style.display = 'none';
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 等待 BC 核心物件就緒後才初始化插件。
     * 每 500ms 輪詢，就緒後載入 i18n 並掛載公開 API。
     */
    function waitForBC(retryCount = 0) {
        const MAX_RETRIES = 120; // 最多等 60 秒
        if (typeof Player === 'undefined' || typeof CurrentScreen === 'undefined') {
            if (retryCount >= MAX_RETRIES) {
                console.warn('🐈‍⬛ [MPL] 等待 BC 核心逾時，插件停止初始化');
                return;
            }
            return setTimeout(() => waitForBC(retryCount + 1), 500);
        }

        ensureI18n()
            .then(() => {
            // 設定 MPL i18n 包裝函式（讓 MPLT() 能正確呼叫引擎）
            window.Liko.MPL.i18n = {
                t: (key, vars) => window.Liko.__Sys_i18n__.t('MPL', key, vars),
            };

            injectLoginStyles();
            getCryptoKey().catch(e => console.warn('🐈‍⬛ [MPL] 加密系統初始化失敗:', e));
            refreshAllI18n();

            // 公開 API（供其他插件或 console 使用）
            Object.assign(window.Liko.MPL, {
                version:            MOD_VER,
                render:             renderCshList,
                refreshSpaceButton: refreshCshSpaceButton,
                refreshAllI18n,
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
        })
            .catch(e => {
            // i18n 載入失敗時不阻斷插件，MPLT() 會 fallback 到 key 原文
            console.error('🐈‍⬛ [MPL] i18n 載入失敗，以 key 原文顯示:', e);
            window.Liko.MPL.i18n = { t: key => key };
            injectLoginStyles();
            getCryptoKey().catch(() => {});
        });
    }

    waitForBC();

})();
