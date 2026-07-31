/**
 * =============================================================================
 *  BC ChatRoomButtons Order + Collapse Animation (BC_ChatRoomButtons.js)
 * =============================================================================
BC_ChatRoomButtons.js 說明
一份給 Bondage Club 插件共用的基礎設施腳本,圍繞著聊天室畫面的 #chat-room-buttons(那一排按鈕的容器)處理兩件事:排序與收合/展開動畫。單獨載入(沒有其他插件配合)就能完整運作,無外部依賴。

掛載位置:window.Liko.__Sys_ChatRoomButtons__

一、排序功能
問題:多個插件都想在 #chat-room-buttons 裡加自己的按鈕,誰先誰後、誰放哪裡容易打架。
做法:#chat-room-buttons 是 CSS Grid(direction: rtl),grid 項目會遵守 CSS order 屬性。每個插件只要幫自己的按鈕設定 style.order = N,瀏覽器就會照數字排版——不管插件載入順序、不管誰先跑,不會有 race condition。
BC 原生按鈕沒有設 order → 視為 0
正數排在原生按鈕之後(rtl 下視覺上偏左)
負數排在原生按鈕之前

API:
函式	說明
register(id, order, el)	記錄某插件的順位並套用到按鈕上,回傳 order
get(id)	查某插件已宣告的順位(沒有則 undefined)
reapply(id, el)	BC 重建按鈕列後,把記錄的順位重新套回新按鈕(手動呼叫用)

自我巡邏(self-healing):每 500ms 會自動把記住的順位重新套回目前還在文件內的元素。所以就算某插件自己的重繪邏輯忘了呼叫 reapply,只要按鈕元素還在,順位依然不會跑掉。
版本相容:用版本號(V = 2)守衛,已存在且版本 ≥ 本檔就跳過;升級時沿用舊的 slots,不會清掉別人已登記的順位。契約刻意極簡凍結,其他插件可以自行內嵌一份精簡版(只有排序)也不會互相打架。

二、收合/展開動畫
問題:BC 原生的 chat-room-buttons-collapse 按鈕,點下去是直接對每顆子按鈕切換 [hidden],沒有任何過渡效果,是「瞬間消失/出現」。
做法:不去攔截、取代原生的點擊邏輯(風險高,要處理各種事件),而是用 MutationObserver 純觀察 #chat-room-buttons 底下子元素的 hidden 屬性變化,把「瞬間切換」改寫成:
收合:向右滑出 + 淡出,動畫播完才真的隱藏
展開:從右邊滑回原位 + 淡入
因為只監看屬性本身,不管是原生按鈕、其他插件的可見度同步邏輯改的,都會一視同仁套上動畫——動畫完全不依賴任何其他插件是否成功載入。
行為細節:

動畫時長 200ms,滑動距離 18px,對齊 Kaomoji 面板開合的速度風格
尊重 prefers-reduced-motion,開啟時維持原生瞬間切換
chat-room-send(送出按鈕)排除在動畫之外,本來就不會被收合
會過濾「值沒變」的重複觸發,避免動畫播到一半被同狀態重新觸發而頓一下

近期修正(重建誤觸發問題):切換畫面時,有些插件會整批重建自己的按鈕(產生全新的 DOM 元素而非重用舊的),插入後緊接著同步一次 hidden 狀態以符合目前收合/展開狀態——這個「同步」動作本身會被 observer 捕捉,誤判成使用者真的按了收合鈕,導致畫面切換時跳出不該有的滑動動畫。

修法是用 WeakMap(鍵是元素物件本身)判斷「這個按鈕元素是不是第一次被看到」:第一次出現只靜默記錄狀態、不播動畫;因為新建立的元素在 WeakMap 裡必然沒有舊紀錄,天然就能分辨「重建後的初始同步」跟「真正的使用者切換」,不需要另外監聽 childList 或去猜容器何時被整個換掉。

效能考量
排序巡邏是低頻 interval(500ms),量小
動畫觀察只過濾 hidden 屬性變化(attributeFilter: ['hidden']),沒有觀察 childList,對整頁 DOM 增刪不敏感,效能開銷小
綁在 document.documentElement 而非容器本身,是因為容器會隨切換聊天室被 BC 整個重建,綁在穩定的祖先節點上就不必處理重新掛勾的時機問題
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
        const firstSight = !lastHidden.has(el); // 這個「按鈕元素物件」是不是第一次被觀察到 hidden 變化
        if (!firstSight && lastHidden.get(el) === isHidden) return; // 有些插件會用自己的輪詢重複 set 同一個狀態，
        // 這種「值沒變」的重複觸發要濾掉，不然動畫播到一半又被同一個狀態重新觸發，看起來會頓一下
        lastHidden.set(el, isHidden);

        // 切換畫面時，有些插件會整批重建自己的按鈕（新的 DOM 元素，不是原本那顆），
        // 插入後緊接著把 hidden 同步成目前面板的收合/展開狀態，這一下 set 也會被上面的
        // MutationObserver 捕捉到。但這其實不是使用者按收合鈕的「真實切換」，只是重建後
        // 的初始同步 —— 因為 lastHidden 是用 WeakMap 存、鍵是元素本身，新元素在這裡一定
        // 是第一次出現（firstSight === true），藉此可以準確分辨兩者，不需要另外監看
        // childList 或去猜容器何時被整個換掉。第一次出現只記錄狀態，不播動畫；之後才是
        // 真正的收合/展開觸發。
        if (firstSight) return;

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