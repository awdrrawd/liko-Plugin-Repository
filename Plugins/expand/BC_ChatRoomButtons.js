/**
 * =============================================================================
 *  BC ChatRoomButtons Order + Collapse Animation (BC_ChatRoomButtons.js)
 * =============================================================================
 *
 *  兩件事，都圍繞 BC 的 #chat-room-buttons：
 *
 *  【1. 排序】多個插件都往 #chat-room-buttons 加自訂按鈕時，用來協調彼此的排列順序。
 *  #chat-room-buttons 是 CSS Grid（direction:rtl），grid 項目會遵守 CSS `order` 屬性 ——
 *  所以每個插件只要對「自己的按鈕」設 style.order = N，瀏覽器就會照 N 由小到大排版，
 *  完全不受 DOM 插入順序或載入時機影響（無競態、無需集中重排）。
 *  BC 原生按鈕沒有 order → 視為 0；正數排在原生按鈕之後（rtl 下＝偏左），負數排在之前。
 *
 *  【2. 收合/展開動畫】BC 原生的 #chat-room-buttons-collapse 按鈕，點下去是直接對每個
 *  子按鈕切換 [hidden]（等同 display:none），沒有任何過渡效果，觀感是「瞬間消失/出現」。
 *  這裡不去攔截、取代原生的點擊邏輯（風險高，還要處理 click/touch/hold 各種事件），
 *  而是用 MutationObserver 純觀察 #chat-room-buttons 底下子元素的 [hidden] 屬性變化，
 *  把「瞬間切換」改寫成「向右滑出淡出後才真的隱藏／從右邊滑回原位淡入」。因為只監看 DOM 屬性，
 *  不管 hidden 是原生按鈕、Kaomoji 的 syncTriggerVisibility、還是任何其他腳本切換的，
 *  都會一視同仁套上動畫 —— 這也表示動畫本身完全不依賴任何其他插件是否有載入成功。
 *
 *  API（掛在 window.Liko.__Sys_ChatRoomButtons__）：
 *    register(id, order, el)  記錄某插件的順位並套到按鈕上（回傳 order）
 *    get(id)                  查某插件已宣告的順位（沒有則 undefined）
 *    reapply(id, el)          BC 重建按鈕列後，把記錄的順位重新套回新按鈕（手動呼叫用）
 *
 *  排序本身也會自我巡邏：register/reapply 時會記住元素參照，之後用低頻 interval 定期
 *  把記得的順位補套回目前還在文件內的元素。也就是說，就算某個插件自己的重繪/重掛勾邏輯
 *  掛掉、忘了呼叫 reapply，只要按鈕元素本身還在，順位依然不會跑掉 —— 這個檔案本身單獨
 *  載入（其他插件都沒載入成功）也能完整提供排序功能，不必依賴任何外部呼叫。
 *
 *  用法：當一般 <script> 載入即可，無依賴。契約刻意極簡且凍結 —— 任何插件都能內嵌同一份
 *  v1 bootstrap（只有排序）自行建立，版本守衛保證較新版本（本檔）生效、且保留已登記的
 *  順位，多份副本不會打架；動畫子系統則只有這份完整版才有，不強求其他插件跟著實作。
 * =============================================================================
 */
(function (global) {
    'use strict';

    global.Liko = global.Liko ?? {};

    // 版本守衛：已存在且版本 >= 本檔就跳過；升級時沿用舊的 slots，不清掉別人登記過的順位。
    const V = 2;
    const cur = global.Liko.__Sys_ChatRoomButtons__;
    if (cur && cur.v >= V) return;

    const CONTAINER_ID = 'chat-room-buttons';
    const ANIM_MS = 200; // 對齊 Kaomoji 面板開合的速度與 easing 風格（transition:...200ms ease）
    const SLIDE_PX = 18; // 收合/展開時的水平位移距離
    const HEAL_INTERVAL_MS = 500;

    // ---------------------------------------------------------------------------
    // 排序（相容 v1 API，行為不變）
    // ---------------------------------------------------------------------------
    const slots = cur?.slots ?? {}; // id -> order（純數字，供 introspection，向下相容）
    const els = new Map(); // id -> 目前已知的按鈕元素，供自我巡邏使用

    function register(id, order, el) {
        slots[id] = order;
        if (el) {
            els.set(id, el);
            el.style.order = String(order);
        }
        return order;
    }

    function get(id) {
        return slots[id];
    }

    function reapply(id, el) {
        if (el && id in slots) {
            els.set(id, el);
            el.style.order = String(slots[id]);
        }
    }

    // 自我巡邏：定期把記得的順位補套回目前還連接在文件內的元素，不必等插件自己呼叫 reapply。
    // 即使某插件的重繪迴圈掛掉、或這份檔案是唯一成功載入的插件相關腳本，順位依然穩定。
    function healOrders() {
        els.forEach((el, id) => {
            if (el.isConnected && id in slots) {
                const want = String(slots[id]);
                if (el.style.order !== want) el.style.order = want;
            } else if (!el.isConnected) {
                els.delete(id); // 按鈕已經被移除（插件卸載/BC 重建），清掉過期參照避免累積
            }
        });
    }
    setInterval(healOrders, HEAL_INTERVAL_MS);

    // ---------------------------------------------------------------------------
    // 收合 / 展開動畫
    // ---------------------------------------------------------------------------
    const reduceMotion =
          global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function injectAnimStyle() {
        if (document.getElementById('lk-crb-anim-style')) return;
        const style = document.createElement('style');
        style.id = 'lk-crb-anim-style';
        style.textContent = [
            // 動畫進行中：即使已經有 [hidden]，也強制保持可視/可佈局，讓 opacity/transform 有東西可以過渡。
            // 動畫結束後會拿掉 lk-crb-anim class，[hidden] 才真正變回原生的 display:none。
            `#${CONTAINER_ID} > .lk-crb-anim[hidden]{display:flex!important;}`,
            `#${CONTAINER_ID} > .lk-crb-anim{`,
            `  transition:opacity ${ANIM_MS}ms ease,transform ${ANIM_MS}ms ease;`,
            '  opacity:1;transform:translateX(0);pointer-events:auto;',
            '}',
            // 「收起中/展開起點」狀態：淡出淡入共用同一組視覺終點/起點。
            // translateX 是物理座標（向右為正），不受 #chat-room-buttons 的 direction:rtl 影響 ——
            // 所以收合＝滑回右邊（往 collapse 按鈕的方向），展開＝從右邊滑向左邊、回到原位。
            `#${CONTAINER_ID} > .lk-crb-anim.lk-crb-collapsed-state{`,
            `  opacity:0!important;transform:translateX(${SLIDE_PX}px)!important;pointer-events:none;`,
            '}',
        ].join('\n');
        document.head.appendChild(style);
    }

    const pending = new WeakMap(); // el -> timeoutId，避免快速連續切換時動畫互相打架
    const lastHidden = new WeakMap(); // el -> 上次處理時的 hidden 狀態，用來過濾「假變化」

    function clearPending(el) {
        const t = pending.get(el);
        if (t) {
            clearTimeout(t);
            pending.delete(el);
        }
    }

    // 對應「BC 剛把 hidden 屬性加上去」：先讓它維持可見，下一影格才淡出，動畫播完才真的隱藏。
    function animateOut(el) {
        clearPending(el);
        el.classList.add('lk-crb-anim');
        requestAnimationFrame(() => el.classList.add('lk-crb-collapsed-state'));
        const t = setTimeout(() => {
            el.classList.remove('lk-crb-anim', 'lk-crb-collapsed-state');
            pending.delete(el);
        }, ANIM_MS + 30);
        pending.set(el, t);
    }

    // 對應「BC 剛把 hidden 屬性拿掉」：此時元素其實已經在正常顯示了，
    // 所以要立刻（同一輪，繪製前）把它壓回「隱藏中」的起始視覺狀態，下一影格再放開讓它淡入。
    function animateIn(el) {
        clearPending(el);
        el.classList.add('lk-crb-anim', 'lk-crb-collapsed-state');
        void el.offsetWidth; // 強制 reflow，確保起始狀態先被瀏覽器畫出來，之後的 class 移除才會有過渡
        requestAnimationFrame(() => el.classList.remove('lk-crb-collapsed-state'));
        const t = setTimeout(() => {
            el.classList.remove('lk-crb-anim');
            pending.delete(el);
        }, ANIM_MS + 30);
        pending.set(el, t);
    }

    function handleHiddenChange(el) {
        if (!(el instanceof HTMLElement)) return;
        if (!el.parentElement || el.parentElement.id !== CONTAINER_ID) return;
        if (el.id === 'chat-room-send') return; // 送出按鈕本來就不會被收合

        const isHidden = el.hasAttribute('hidden');
        if (lastHidden.get(el) === isHidden) return; // 有些插件會用自己的輪詢重複 set 同一個狀態，
        // 這種「值沒變」的重複觸發要濾掉，不然動畫播到一半又被同一個狀態重新觸發，看起來會頓一下
        lastHidden.set(el, isHidden);

        if (reduceMotion) return; // 尊重「減少動態效果」偏好，維持原生瞬間切換

        injectAnimStyle();
        if (isHidden) animateOut(el);
        else animateIn(el);
    }

    // 只監看 hidden 屬性變化，不管是誰改的（原生收合鈕、其他插件的可見度同步邏輯…都算）。
    // 綁在 document 上是刻意的：#chat-room-buttons 本身會隨切換聊天室/畫面被 BC 整個重建，
    // 若綁在容器上還得處理重新綁定時機；綁在穩定的祖先節點上，容器怎麼重建都不必重新掛勾。
    const observer = new MutationObserver((records) => {
        for (const r of records) handleHiddenChange(/** @type {HTMLElement} */ (r.target));
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true,
    });

    // ---------------------------------------------------------------------------
    global.Liko.__Sys_ChatRoomButtons__ = {
        v: V,
        slots,
        register,
        get,
        reapply,
    };
})(window);