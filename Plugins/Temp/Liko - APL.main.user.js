// ==UserScript==
// @name           Liko - Appearance Portrait Layout
// @name:zh        Liko的更衣室直版佈局
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.1.0
// @description    Vertical (portrait) layout for the Appearance (wardrobe) screen
// @description:zh 更衣室（Appearance）畫面的直版佈局：UI 置頂、人物置底、隱藏左側放大鏡
// @author         Likolisu
// @include        /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
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
    window.Liko.APL = window.Liko.APL ?? {};
    if (window.Liko.APL.version) return;

    const MOD_VER = '0.1.0';
    window.Liko.APL.version = MOD_VER;

    const modApi = bcModSdk.registerMod({
        name:       'Liko - APL',
        fullName:   'Appearance Portrait Layout',
        version:    MOD_VER,
        repository: 'https://github.com/awdrrawd/liko-Plugin-Repository',
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 常數
    //
    // BC 更衣室（Appearance）畫面全部畫在 2000x1000 的虛擬 canvas 上：
    //   ‧ 右半（虛擬 x:1000~2000）＝ 所有互動 UI（頂部功能鈕、每列服裝鈕、
    //     配色/衣櫃/選衣三種子模式的面板）。
    //   ‧ 主角色      DrawCharacter(C, 660, 90, 0.95)（自己）/ (C, 660, 0, 1)（他人）
    //   ‧ 左側放大鏡  DrawCharacter(C, -600, …, 4) —— 使用者要求隱藏。
    //
    // 直版原理（比 MPL 的 Dialog 鏡射簡單很多）：
    //   把 canvas 用 CSS 往左移，讓「虛擬 x:UI_LEFT~2000」的右側 UI 剛好填滿
    //   螢幕上半並「原生可點」—— 因為 BC 用
    //     (clientX - canvas.offsetLeft) * 2000 / canvas.clientWidth
    //   換算 MouseX，CSS 位移會被自動計入，不需要任何點擊注入。
    //   人物則透過 hook DrawCharacter「位移」到 UI_LEFT 左邊（離開上半視野），
    //   再用一塊 mirror canvas 把人物區域複製到螢幕下半、填上更衣室灰底顯示。
    //
    // 為什麼 UI_LEFT 不是 1000：
    //   頂部功能鈕從右往左排：X = 2000 - N*117（N＝按鈕數，每顆寬 90、間距 117）。
    //   自己的預設模式最多 11~12 顆 → 最左按鈕落在 x≈713（11 顆）甚至 596（12 顆），
    //   都在 1000 的左邊。所以上半視野必須從更左（UI_LEFT）開始才塞得下整排。
    //   代價是 UI 會等比縮小一些。UI_LEFT 越小 → 能塞越多按鈕、但 UI 越小。
    // ════════════════════════════════════════════════════════════════════════════

    const TOP_RATIO = 0.50;   // 上半 UI 區佔視窗高度的比例（其餘給下半人物區）

    /** 上半視野的虛擬起點 x（右側 UI 起點）。必須 ≤ 最左按鈕的 x。
     *  700 可完整容納 11 顆按鈕（最左 713）；若你的更衣室被主人封鎖而出現
     *  第 12 顆（最左 596），可再往下調到約 590。 */
    const UI_LEFT = 700;

    /** 位移後人物 sprite 右緣與 UI_LEFT 之間保留的間距（虛擬 px），
     *  確保人物完全落在 UI_LEFT 左邊、不會露進上半 UI。 */
    const CHAR_MARGIN = 30;

    /** mirror 複製來源的垂直範圍（虛擬座標，全身站姿約 y:0~1000）。 */
    const AP_SRC_Y = 30;
    const AP_SRC_H = 970;

    /** 取樣失敗時的更衣室灰底 fallback 顏色。 */
    const BG_FALLBACK = '#6b7a85';

    /**
     * 與主 canvas 共享 stacking context 的 z-index 統一管理。
     * 刻意壓低、留間隔，方便日後插入新層。
     */
    const Z = {
        CANVAS: 0,   // 主 canvas（上半 UI）
        MIRROR: 1,   // 下半人物 mirror canvas
    };

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
     * @param {string} id
     * @param {string} css
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
    // Canvas 強制樣式
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * 快取上一次套用的數值，避免 DrawProcess（每幀）重複寫入相同 inline style 造成 reflow。
     * @type {{ cv: HTMLElement, vw: number, topH: number } | null}
     */
    let _lastForced = null;

    /**
     * 強制設定 canvas 的 inline style，讓直版上半正確顯示「虛擬 x:UI_LEFT~2000」。
     * 把虛擬區間 [UI_LEFT, 2000] 映射到螢幕 [0, vw]：
     *   s      = vw / (2000 - UI_LEFT)   螢幕 px / 虛擬 px
     *   width  = 2000 * s                虛擬 0~2000 對應的 CSS 寬
     *   left   = -UI_LEFT * s            讓虛擬 x:UI_LEFT 落在螢幕 x:0
     *   height = topH                    虛擬 y:0~1000 壓縮到上半 topH 高
     * @param {number} topH
     */
    function forceCanvasStyle(topH) {
        const cv = getCanvas();
        if (!cv) return;
        const vw = window.innerWidth;

        if (_lastForced && _lastForced.cv === cv && _lastForced.vw === vw && _lastForced.topH === topH) return;
        _lastForced = { cv, vw, topH };

        const s = vw / (2000 - UI_LEFT);

        cv.style.setProperty('position',  'fixed',                 'important');
        cv.style.setProperty('top',       '0',                     'important');
        cv.style.setProperty('left',      (-UI_LEFT * s) + 'px',   'important');
        cv.style.setProperty('transform', 'none',                  'important');
        cv.style.setProperty('width',     (2000 * s) + 'px',       'important');
        cv.style.setProperty('height',    topH + 'px',             'important');
        cv.style.setProperty('z-index',   String(Z.CANVAS),        'important');
        cv.style.setProperty('margin',    '0',                     'important');
    }

    /** 清除 canvas 的所有 inline style，恢復 BC 原始控制 */
    function clearCanvasStyle() {
        const cv = getCanvas();
        _lastForced = null;
        if (!cv) return;
        ['position', 'top', 'left', 'transform', 'width', 'height', 'z-index', 'margin']
            .forEach(p => cv.style.removeProperty(p));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Appearance 直版模式（apXxx）
    // ════════════════════════════════════════════════════════════════════════════

    let apActive    = false;
    let apMirrorRAF = null;   // mirror canvas 的 requestAnimationFrame handle
    let apBgColor   = BG_FALLBACK;   // 取樣自更衣室畫布的灰底色，供下半填滿

    /** 位移後主角色 sprite 的實際虛擬水平範圍（由 DrawCharacter hook 填入），供 mirror 取用。
     *  @type {{ x: number, w: number }} */
    let apCharBox = { x: UI_LEFT - CHAR_MARGIN - 475, w: 475 };

    /**
     * 從 MainCanvas 取樣更衣室背景色（左緣中段，必為 Dressing 灰底）。
     * getImageData 可能因跨域污染失敗，失敗則沿用 fallback。
     */
    function sampleBgColor() {
        try {
            const src = getCanvas();
            const ctx = src.getContext('2d');
            const d   = ctx.getImageData(5, Math.round(src.height * 0.5), 1, 1).data;
            if (d[3] > 0) apBgColor = `rgb(${d[0]},${d[1]},${d[2]})`;
        } catch { /* 沿用 apBgColor */ }
    }

    /** 計算直版各區域尺寸 */
    function apCalc() {
        const vw   = window.innerWidth;
        const vh   = window.innerHeight;
        const topH = Math.round(vh * TOP_RATIO);
        return { vw, vh, topH, bottomH: vh - topH };
    }

    /**
     * 建立 / 重建下半人物 mirror canvas，並啟動每幀複製迴圈。
     * 每 2 幀複製一次（30fps 足夠更衣預覽）。
     */
    function apStartMirror() {
        const { vw, topH, bottomH } = apCalc();

        document.getElementById('liko-ap-mirror')?.remove();
        if (apMirrorRAF) { cancelAnimationFrame(apMirrorRAF); apMirrorRAF = null; }

        const mirror  = document.createElement('canvas');
        mirror.id     = 'liko-ap-mirror';
        mirror.width  = vw;
        mirror.height = bottomH;
        mirror.style.cssText = `
            position:fixed !important;
            top:${topH}px !important; left:0 !important;
            width:${vw}px !important; height:${bottomH}px !important;
            z-index:${Z.MIRROR} !important;
            pointer-events:none !important;
            background:transparent !important;
        `;
        document.body.appendChild(mirror);

        const ctx = mirror.getContext('2d');
        let frameCount = 0;

        const loop = () => {
            apMirrorRAF = requestAnimationFrame(loop);
            if (!apActive) return;
            frameCount++;
            if (frameCount % 2 !== 0) return;
            apDrawMirror(ctx, vw, bottomH);
        };
        loop();
    }

    /**
     * 把 MainCanvas 上的人物區域複製到下半 mirror。
     * 先用更衣室灰底把整個下半填滿（消除左右黑框），再把人物置中、貼底、
     * 依比例放到最大（填滿高度）。人物高瘦、下半寬扁，左右必然留白，
     * 以連續灰底呈現而非黑框。
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} vw
     * @param {number} bottomH
     */
    function apDrawMirror(ctx, vw, bottomH) {
        const src = getCanvas();
        if (!src) return;

        // 先鋪滿更衣室灰底
        ctx.fillStyle = apBgColor;
        ctx.fillRect(0, 0, vw, bottomH);

        // 來源：位移後人物 sprite 的水平範圍（apCharBox）＋固定垂直範圍
        const box = apCharBox;
        const sx  = box.x    / 2000 * src.width;
        const sw  = box.w    / 2000 * src.width;
        const sy  = AP_SRC_Y / 1000 * src.height;
        const sh  = AP_SRC_H / 1000 * src.height;

        // 依人物虛擬長寬比縮放，填滿下半高度、水平置中、貼底
        const k     = Math.min(vw / box.w, bottomH / AP_SRC_H);
        const drawW = box.w    * k;
        const drawH = AP_SRC_H * k;
        const dx    = (vw - drawW) / 2;
        const dy    = bottomH - drawH;

        try { ctx.drawImage(src, sx, sy, sw, sh, dx, dy, drawW, drawH); } catch {}
    }

    /** 啟用 Appearance 直版模式 */
    function apApply() {
        if (apActive) return;
        apActive = true;

        const { topH } = apCalc();

        injectStyle('liko-ap', `
            html, body { overflow-x:hidden !important; overflow-y:hidden !important }
        `);

        sampleBgColor();     // 取樣更衣室灰底（此幀人物尚在原位、左緣為純背景）
        forceCanvasStyle(topH);
        apStartMirror();
    }

    /** 每幀維護（供 DrawProcess hook 呼叫） */
    function apMaintain() {
        if (!apActive) return;
        forceCanvasStyle(apCalc().topH);
    }

    /** 關閉 Appearance 直版模式，還原所有修改 */
    function apRemove() {
        if (!apActive) return;
        apActive = false;

        if (apMirrorRAF) { cancelAnimationFrame(apMirrorRAF); apMirrorRAF = null; }
        document.getElementById('liko-ap-mirror')?.remove();

        clearCanvasStyle();
        removeStyle('liko-ap');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測（每幀由 DrawProcess hook 呼叫）
    // ════════════════════════════════════════════════════════════════════════════

    function checkScene() {
        const scr = typeof CurrentScreen !== 'undefined' ? CurrentScreen : '';
        const p   = isPortrait();

        if (scr === 'Appearance' && p) {
            if (!apActive) apApply();
        } else if (apActive) {
            apRemove();
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC 函數鉤子（Hooks）
    // ════════════════════════════════════════════════════════════════════════════

    // 逐幀維護版面 + 場景偵測
    modApi.hookFunction('DrawProcess', 5, (args, next) => {
        next(args);
        checkScene();
        apMaintain();
    });

    // 攔截更衣室的角色繪製：
    //   ‧ 放大鏡（X=-600, Zoom=4）→ 不繪製（隱藏）
    //   ‧ 主角色（X=660）        → 位移到 UI_LEFT 左邊，離開上半 UI 視野，供 mirror 複製
    // 位移量依 UI_LEFT 與該次 Zoom 動態計算：讓 sprite 右緣 = UI_LEFT - CHAR_MARGIN，
    // 並把實際 sprite 水平範圍記到 apCharBox 供 mirror 精準取用。
    // 只在直版啟用且位於 Appearance 畫面時介入；其餘一律照原樣繪製。
    modApi.hookFunction('DrawCharacter', 0, (args, next) => {
        if (!apActive || (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'Appearance'))
            return next(args);

        const X    = args[1];
        const Zoom = args[3];

        // 左側放大鏡：跳過繪製
        if (X === -600 && Zoom === 4) return;

        // 主角色預覽：位移到左半
        if (X === 660) {
            const w  = 500 * Zoom;
            let   nx = UI_LEFT - CHAR_MARGIN - w;
            if (nx < 0) nx = 0;
            args[1]   = nx;
            apCharBox = { x: nx, w };
            return next(args);
        }

        return next(args);
    });

    // 離開更衣室畫面時關閉
    modApi.hookFunction('AppearanceExit', 0, (args, next) => {
        const r = next(args);
        apRemove();
        return r;
    });

    // ════════════════════════════════════════════════════════════════════════════
    // 視窗尺寸事件處理
    // ════════════════════════════════════════════════════════════════════════════

    function handleResize() {
        if (!apActive) { checkScene(); return; }
        if (!isPortrait()) { apRemove(); return; }
        // 直向下尺寸變化：重建 mirror（尺寸改變）並重套 canvas 樣式
        _lastForced = null;
        forceCanvasStyle(apCalc().topH);
        apStartMirror();
    }

    let resizeDebounceTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(handleResize, 120);
    });
    window.addEventListener('orientationchange', () => setTimeout(handleResize, 250));

    console.log(`🐈‍⬛ [APL] Appearance Portrait Layout v${MOD_VER} 已載入`);
})();
