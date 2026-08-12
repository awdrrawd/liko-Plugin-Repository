// ==UserScript==
// @name           Liko - Chatroom UI Swap
// @name:zh        Liko的聊天室左右介面交換
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.1
// @description    Chatroom UI Swap: chat log on the left, characters on the right
// @description:zh 聊天室左右介面交換：左側聊天訊息、右側人物。手動開關。
// @author         Likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant          none
// @require        https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at         document-end
// ==/UserScript==

(function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════════════════
    // 防止重複載入
    // ════════════════════════════════════════════════════════════════════════════
    window.Liko     = window.Liko     ?? {};
    window.Liko.CUS = window.Liko.CUS ?? {};
    if (window.Liko.CUS.version) return;

    const MOD_VER = '0.1';
    window.Liko.CUS.version = MOD_VER;

    const modApi = bcModSdk.registerMod({
        name:       'Liko - CUS',
        fullName:   'Chat Landscape Layout',
        version:    MOD_VER,
        repository: 'https://github.com/awdrrawd/liko-Plugin-Repository',
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 原理（＝ MPL/APL 同一招：位移 canvas，點擊原生對應）
    //
    // 人物由 BC 畫在虛擬 x:0~1000（左半），它的「繪製」與「點擊熱區」都以此為準。
    // 只要「不動虛擬座標、改用 CSS 位移 / 縮放 #MainCanvas」，把這半邊擺到螢幕右欄，
    // 人物的繪製、點擊、狀態泡泡、overlay 按鈕會全部一致地跟著移動——因為 BC 用
    //   MouseX = (clientX - canvas.offsetLeft) * 2000 / canvas.clientWidth
    // 反算，CSS 位移會被自動計入。（v0.2.0 改動虛擬座標 +1000 反而讓部分點擊路徑
    //  對不上，故點不到——本版回到 canvas 位移。）
    //
    // 聊天 DOM（#chat-room-div，含頂部選單）由 ElementPositionFix 依 ChatRoomDivRect
    // 定位，換算同樣走 canvas 幾何（MainCanvas.offsetLeft/clientWidth）。所以只要把
    // ChatRoomDivRect 設成「對映到螢幕左欄」的虛擬矩形（因 canvas 已右移，左欄會落在
    // 負虛擬 x），聊天 DOM 就會貼到左欄，且與人物一起隨 canvas letterbox、永遠對齊。
    //
    // 版面（＝ BC 預設的鏡像，不放大人物、不犧牲聊天空間）：
    //   ‧ canvas 維持 BC 原生 2:1 尺寸（2000×1000 的顯示比例，上下 letterbox），
    //     只「往右平移半個 canvas」→ 人物（虛擬 0~1000）落到螢幕右半、原生大小。
    //   ‧ 聊天 DOM 拿完整左半 [0, vw/2] × canvas 高度帶（與人物同一 letterbox 帶）。
    //   這樣左右各半，跟 BC 預設一致，只是左右對調。
    // ════════════════════════════════════════════════════════════════════════════

    const LS_KEY      = 'liko_cus_enabled';   // 手動開關持久化
    const Z_CANVAS    = 0;
    // 開關按鈕：比照 TRC 畫在 canvas 虛擬座標上（0,0，尺寸 45）
    const BTN_X       = 0;
    const BTN_Y       = 0;
    const BTN_SIZE    = 45;

    let cusWanted    = localStorage.getItem(LS_KEY) === '1';
    let cusActive    = false;
    let savedDivRect = null;                  // 進入前 ChatRoomDivRect 備份

    // ── 工具 ────────────────────────────────────────────────────────────────────
    function getCanvas() {
        return document.getElementById('MainCanvas') || document.querySelector('canvas');
    }
    function inChatRoom() {
        return typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom';
    }
    /** 只在 ChatRoom 且未開 Dialog 時套用（Dialog 用整塊 canvas 畫互動 UI，位移會壞）。 */
    function isChatRoomPlain() {
        return inChatRoom() && !(typeof CurrentCharacter !== 'undefined' && CurrentCharacter);
    }

    // ── 版面計算 ─────────────────────────────────────────────────────────────────
    /** @returns {{vw,vh,cw,ch,left,top,divRect:number[]}} */
    function calcLayout() {
        const vw = window.innerWidth, vh = window.innerHeight;
        // BC 原生 2:1 適配：寬螢幕(>2:1)貼合高度，其餘貼合寬度（上下 letterbox）
        let cw, ch;
        if (vw > 2 * vh) { ch = vh;      cw = 2 * vh; }
        else             { cw = vw;      ch = vw / 2; }
        const left   = vw / 2;                 // 往右平移半個 canvas：虛擬 x=0 落在螢幕中線 → 人物在右半
        const top    = (vh - ch) / 2;          // 原生垂直置中
        const scaleX = cw / 2000;              // 螢幕px/虛擬px（水平）
        // 聊天 DOM 目標 = 螢幕左半 [0, vw/2]，同一 letterbox 帶（虛擬 y:2~1000，同 BC 預設）
        const dx = -left / scaleX;             // 反解左半起點的虛擬 x（負值）
        const dw = (vw / 2) / scaleX;          // 左半寬對應的虛擬寬
        const divRect = [ dx, 2, dw, 998 ];
        return { vw, vh, cw, ch, left, top, divRect };
    }

    // ── Canvas 強制樣式（右欄，逐幀重套；快取避免同值重寫）────────────────────────
    let _forcedKey = '';
    function forceCanvas(L) {
        const cv = getCanvas();
        if (!cv) return;
        const key = L.cw + 'x' + L.ch + '@' + L.left + ',' + L.top;
        if (_forcedKey === key) return;
        _forcedKey = key;
        cv.style.setProperty('position',  'fixed',            'important');
        cv.style.setProperty('top',       L.top + 'px',       'important');
        cv.style.setProperty('left',      L.left + 'px',      'important');
        cv.style.setProperty('transform', 'none',             'important');
        cv.style.setProperty('width',     L.cw + 'px',        'important');
        cv.style.setProperty('height',    L.ch + 'px',        'important');
        cv.style.setProperty('z-index',   String(Z_CANVAS),   'important');
        cv.style.setProperty('margin',    '0',                'important');
    }
    function clearCanvas() {
        const cv = getCanvas();
        _forcedKey = '';
        if (!cv) return;
        ['position', 'top', 'left', 'transform', 'width', 'height', 'z-index', 'margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    /** 寫入 ChatRoomDivRect（供 BC 的 ElementPositionFix 定位聊天 DOM）。 */
    function setDivRect(rect) {
        if (typeof ChatRoomDivRect === 'undefined') return;
        for (let i = 0; i < 4; i++) ChatRoomDivRect[i] = rect[i];
    }

    // ── 套用 / 還原 ──────────────────────────────────────────────────────────────
    function apply() {
        if (cusActive) return;
        cusActive = true;
        if (!savedDivRect && typeof ChatRoomDivRect !== 'undefined')
            savedDivRect = [...ChatRoomDivRect];
        const L = calcLayout();
        forceCanvas(L);
        setDivRect(L.divRect);
        if (typeof ChatRoomResize === 'function') try { ChatRoomResize(false); } catch {}
    }
    function remove() {
        if (!cusActive) return;
        cusActive = false;
        clearCanvas();
        if (savedDivRect) { setDivRect(savedDivRect); savedDivRect = null; }
        if (typeof ChatRoomResize === 'function') try { ChatRoomResize(false); } catch {}
    }

    // ── 場景同步 ─────────────────────────────────────────────────────────────────
    function syncScene() {
        const want = cusWanted && isChatRoomPlain();
        if (want && !cusActive) apply();
        else if (!want && cusActive) remove();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Hooks
    // ════════════════════════════════════════════════════════════════════════════

    async function initialize() {
        if (typeof Player === 'undefined' || Player?.MemberNumber === undefined) {
            await new Promise(resolve => {
                const removeHook = modApi.hookFunction('LoginResponse', 0, (args, next) => {
                    const result = next(args);
                    queueMicrotask(() => {
                        if (typeof Player === 'undefined' || Player?.MemberNumber === undefined) return;
                        removeHook();
                        resolve();
                    });
                    return result;
                });
            });
        }

    // BC 重算版面時：先套好 canvas 與 ChatRoomDivRect，再讓 BC 定位聊天 DOM。
    modApi.hookFunction('ChatRoomResize', 0, (args, next) => {
        if (cusActive) {
            const L = calcLayout();
            forceCanvas(L);
            setDivRect(L.divRect);
        }
        return next(args);
    });

    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
        remove();
        return next(args);
    });

    modApi.hookFunction('DrawProcess', 5, (args, next) => {
        next(args);
        syncScene();
        if (cusActive) forceCanvas(calcLayout());   // BC 每幀會重置 canvas 樣式，需重套
        // 開關按鈕（比照 TRC：畫在 canvas 虛擬 0,0，尺寸 45）
        if (isChatRoomPlain() && typeof DrawButton === 'function') {
            MainCanvas.globalAlpha = 0.75;
            DrawButton(BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE, '⬌',
                       cusWanted ? 'Pink' : 'Gray', '', '左訊息／右人物 橫版佈局');
            MainCanvas.globalAlpha = 1.0;
        }
    });

    // 點擊開關按鈕：命中就切換並吃掉點擊，否則交還 BC。
    modApi.hookFunction('ChatRoomClick', 10, (args, next) => {
        if (isChatRoomPlain() && typeof MouseIn === 'function' && MouseIn(BTN_X, BTN_Y, BTN_SIZE, BTN_SIZE)) {
            cusWanted = !cusWanted;
            localStorage.setItem(LS_KEY, cusWanted ? '1' : '0');
            syncScene();
            return;
        }
        return next(args);
    });

    console.log(`🐈‍⬛ [CUS] ✅ v${MOD_VER} loaded`);
    }
    initialize();
})();
