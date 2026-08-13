/**
 * BC_ChatRoomButtons.js — 聊天室按鈕列 #chat-room-buttons 的共用協調器
 * 排序 / 收合動畫 / 單排捲動排版 / 關閉底色 / 中央託管 add()。無外部依賴。
 * 掛載點 window.Liko.__Sys_ChatRoomButtons__；用法與細節見 BC_ChatRoomButtons.md。
 */
(function (global) {
    'use strict';

    global.Liko = global.Liko ?? {};
    // 多個插件各自 @require 本檔，只初始化一次（先到者勝）。
    if (global.Liko.__Sys_ChatRoomButtons__) return;

    const CONTAINER_ID = 'chat-room-buttons';
    const ANIM_MS = 200; // 對齊 Kaomoji 面板開合的速度與 easing 風格（transition:...200ms ease）
    const SLIDE_PX = 18; // 收合/展開時的水平位移距離
    const HEAL_INTERVAL_MS = 500;
    const MAX_VISIBLE_PLUGINS = 5;
    const FIXED_NATIVE_BUTTONS = 1; // chat-room-send

    // ── 排序 + 關閉底色（plain）──
    const slots = {};           // id -> order
    const plainIds = new Set(); // 要關閉原生 ::before 底色的 id（露出自帶圖示）
    const els = new Map();      // id -> 目前已知的按鈕元素，供自我巡邏使用
    const specs = new Map();    // id -> { order, createFn, opts }（add() 託管的按鈕）

    function applyPlain(id, el) {
        if (el) el.classList.toggle('lk-crb-plain', plainIds.has(id));
    }

    function register(id, order, el) {
        slots[id] = order;
        if (el) {
            els.set(id, el);
            el.style.order = String(order);
            applyPlain(id, el);
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
            applyPlain(id, el);
        }
    }

    // 關閉/開啟某按鈕的原生底色：關閉後不畫 BC 的 ::before，露出按鈕自己的圖示（如 <img>）。
    function setPlain(id, on = true) {
        if (on) plainIds.add(id); else plainIds.delete(id);
        applyPlain(id, els.get(id));
    }

    // ── 中央託管：插件用 add() 交出「順位 + 工廠函式」，(重)建/收合同步/底色都由本檔處理 ──
    function collapseExpanded() {
        const c = document.getElementById('chat-room-buttons-collapse');
        return c ? c.getAttribute('aria-expanded') === 'true' : true; // 沒有收合鈕時視為展開
    }
    function applyCollapse(id, el) {
        const spec = specs.get(id);
        if (!el || !spec || spec.collapse === false) return;
        el.hidden = !collapseExpanded();
    }

    // 確保某 id 的按鈕存在且掛好：還在就只補順位/底色/收合；不在（首次或容器被重建）就用工廠重建。
    function ensureButton(id) {
        const spec = specs.get(id);
        if (!spec) return;
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return; // 還沒進聊天室；容器出現時 lifecycleObserver / healOrders 會再補
        let el = els.get(id);
        if (el && el.isConnected && el.parentElement === container) {
            register(id, spec.order, el);
            applyManagedSpec(spec, el);
            if (spec.plain) setPlain(id, true);
            applyCollapse(id, el);
            return;
        }
        if (el && el.parentElement && el.parentElement !== container) { try { el.remove(); } catch (e) {} }
        el = spec.createButton ? spec.createButton() : createManagedButton(spec);
        if (!el) return;
        if (!el.id) el.id = id; // 工廠沒設 id 就用註冊 id 保底
        container.appendChild(el);
        register(id, spec.order, el);
        applyManagedSpec(spec, el);
        if (spec.plain) setPlain(id, true);
        applyCollapse(id, el);
    }

    // 交出按鈕：id 唯一；order 順位（數字越大越靠左）；createFn 每次(重)建都會被呼叫、回傳一顆新按鈕；
    // opts.plain 關閉原生底色；opts.collapse=false 則不跟隨原生收合鈕。回傳 order。
    function add(spec) {
        if (!spec || typeof spec !== 'object' || !spec.id || (!spec.icon && typeof spec.createButton !== 'function')) throw new TypeError('CRB.add requires { id, order, icon|createButton }');
        spec = Object.assign({ order: 0, tooltip: spec.id, collapse: true, plain: false, state: {} }, spec);
        specs.set(spec.id, spec);
        ensureButton(spec.id);
        return spec.id;
    }

    function createManagedButton(spec) {
        const button = document.createElement('button');
        button.id = spec.buttonId || ('lk-crb-' + spec.id);
        button.type = 'button';
        button.className = 'blank-button button HideOnPopup chat-room-button';
        button.setAttribute('role', 'menuitem');
        let icon = spec.icon;
        if (typeof icon === 'function') icon = icon(button);
        if (icon instanceof Node) button.appendChild(icon);
        else if (icon && typeof icon === 'object' && icon.src) {
            const img = document.createElement('img');
            img.src = icon.src;
            img.alt = icon.alt || '';
            if (icon.className) img.className = icon.className;
            button.appendChild(img);
        } else if (typeof icon === 'string') button.innerHTML = icon;
        if (typeof spec.onClick === 'function') button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            spec.onClick(event, button);
        });
        return button;
    }

    function applyManagedSpec(spec, el) {
        el.classList.add('lk-crb-managed');
        if (!spec.tooltip && el.title) spec.tooltip = el.title;
        el.removeAttribute('title');
        el.dataset.lkCrbId = spec.id;
        if (spec.className) el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
        applyState(spec.id, spec.state || {});
    }

    function applyState(id, patch) {
        const spec = specs.get(id);
        if (!spec) return;
        spec.state = Object.assign({}, spec.state || {}, patch || {});
        const el = els.get(id);
        if (!el) return;
        const active = !!spec.state.active;
        const activeSpec = spec.active || {};
        el.classList.toggle('lk-crb-active', active);
        let tooltip = spec.state.tooltip || (active && activeSpec.tooltip) || spec.tooltip || id;
        if (typeof tooltip === 'function') tooltip = tooltip(active, el);
        el.setAttribute('aria-label', String(tooltip));
        el.dataset.lkCrbTooltip = String(tooltip);
        const values = {
            '--lk-crb-current-bg': spec.state.background || (active && activeSpec.background) || spec.background,
            '--lk-crb-current-border': spec.state.border || (active && activeSpec.border),
            '--lk-crb-current-color': spec.state.color || (active && activeSpec.color),
            '--lk-crb-current-shadow': spec.state.boxShadow || (active && activeSpec.boxShadow),
        };
        Object.entries(values).forEach(([name, value]) => value ? el.style.setProperty(name, value) : el.style.removeProperty(name));
    }

    function setState(id, patch) { applyState(id, patch); }
    function setActive(id, active) { applyState(id, { active: !!active }); }
    // 卸載（熱更新/停用用）：移除按鈕與所有登記狀態。
    function remove(id) {
        specs.delete(id);
        const el = els.get(id);
        if (el) { try { el.remove(); } catch (e) {} }
        els.delete(id);
        delete slots[id];
        plainIds.delete(id);
    }

    // 自我巡邏：定期把記得的順位/底色設定補套回目前還連接在文件內的元素，不必等插件自己呼叫 reapply。
    // 即使某插件的重繪迴圈掛掉、或這份檔案是唯一成功載入的插件相關腳本，順位依然穩定。
    function healOrders() {
        els.forEach((el, id) => {
            if (el.isConnected && id in slots) {
                const want = String(slots[id]);
                if (el.style.order !== want) el.style.order = want;
                applyPlain(id, el);
            } else if (!el.isConnected) {
                els.delete(id); // 按鈕已經被移除（插件卸載/BC 重建），清掉過期參照避免累積
            }
        });
        // add() 託管的按鈕：元素不見了（容器被重建/被別的腳本移除）就用工廠補回——observer 之外的安全網。
        specs.forEach((_spec, id) => {
            const el = els.get(id);
            if (!el || !el.isConnected) ensureButton(id);
        });
    }
    setInterval(healOrders, HEAL_INTERVAL_MS);

    // ── 單排排版 + 捲動：原生是固定 3 欄 grid，改成 column 流向單排往左長，寬度上限 MAX_VISIBLE 顆，
    //    超過的用拖曳捲動找（見 MD「三」）──
    function injectLayoutStyle() {
        if (document.getElementById('lk-crb-layout-style')) return;
        const style = document.createElement('style');
        style.id = 'lk-crb-layout-style';
        style.textContent = [
            `#${CONTAINER_ID}{`,
            '  grid-template-columns:unset!important;',
            '  grid-template-rows:min-content!important;',
            '  grid-auto-flow:column!important;',
            '  grid-auto-columns:min-content!important;',
            `  max-width:calc(var(--button-size) * ${MAX_VISIBLE_PLUGINS + FIXED_NATIVE_BUTTONS} + min(0.4vh, 0.2vw) * ${MAX_VISIBLE_PLUGINS + FIXED_NATIVE_BUTTONS + 1})!important;`,
            '  overflow-x:auto!important;',
            '  overflow-y:visible!important;',
            '  scrollbar-width:none!important;',       // Firefox：隱藏捲軸
            '  overscroll-behavior-x:contain!important;',
            '  cursor:grab!important;',
            '}',
            `#${CONTAINER_ID}::-webkit-scrollbar{ display:none!important; }`, // WebKit：隱藏捲軸
            `#${CONTAINER_ID}.lk-crb-dragging{ cursor:grabbing!important; }`,
            // 關閉底色：帶 lk-crb-plain 的按鈕不畫 BC 原生的 ::before 底色，露出自己的圖示（如 <img>）
            `#${CONTAINER_ID} > .lk-crb-plain::before{ background:none!important; }`,
            `#${CONTAINER_ID} > .lk-crb-managed{position:relative!important;background:var(--lk-crb-current-bg)!important;color:var(--lk-crb-current-color)!important;border-color:var(--lk-crb-current-border)!important;box-shadow:var(--lk-crb-current-shadow)!important;}`,
            '.lk-crb-tooltip{position:fixed;z-index:2147483646;max-width:min(280px,calc(100vw - 16px));padding:6px 9px;border:1px solid rgba(255,255,255,.18);border-radius:7px;background:rgba(18,20,25,.97);color:#f2f3f5;font:600 12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.45);pointer-events:none;opacity:0;transform:translateY(3px);transition:opacity .12s,transform .12s;}',
            '.lk-crb-tooltip.show{opacity:1;transform:translateY(0);}',
        ].join('\n');
        (document.head || document.documentElement).appendChild(style);
    }
    injectLayoutStyle();

    // 拖曳捲動：按鈕超過可視上限時，用滑鼠左右拖曳容器來找（觸控裝置走原生滑動，不介入）。
    // 用事件代理綁在 document（容器會被 BC 重建，代理就不必重新掛勾）。
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return; // 觸控/筆交給原生捲動
        const c = e.target.closest && e.target.closest('#' + CONTAINER_ID);
        if (!c) return;
        if (e.target.closest('#chat-room-send,#chat-room-buttons-collapse,[data-crb-no-drag]')) return;
        drag = { c, startX: e.clientX, startScroll: c.scrollLeft, moved: false };
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; drag.c.classList.add('lk-crb-dragging'); }
        if (drag.moved) { drag.c.scrollLeft = drag.startScroll - dx; e.preventDefault(); }
    }, true);
    function endDrag() {
        if (!drag) return;
        const c = drag.c, moved = drag.moved;
        drag = null;
        if (!moved) return;
        c.classList.remove('lk-crb-dragging');
        // 吞掉拖曳後緊接的那次 click，避免誤觸按鈕
        const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        document.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => document.removeEventListener('click', swallow, true), 50);
    }
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);

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
        const firstSight = !lastHidden.has(el);
        if (!firstSight && lastHidden.get(el) === isHidden) return; // 濾掉「值沒變」的重複觸發（插件輪詢重設同狀態）
        lastHidden.set(el, isHidden);

        // firstSight（WeakMap 以元素為鍵）＝重建後的初始 hidden 同步，非使用者切換：只記錄不播動畫。
        if (firstSight) return;

        if (reduceMotion) return; // 尊重「減少動態效果」偏好，維持原生瞬間切換

        injectAnimStyle();
        if (isHidden) animateOut(el);
        else animateIn(el);
    }

    // 只監看 hidden 屬性變化（誰改的都算）；綁在穩定的 documentElement，容器重建不必重掛。
    const observer = new MutationObserver((records) => {
        for (const r of records) handleHiddenChange(/** @type {HTMLElement} */ (r.target));
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['hidden'],
        subtree: true,
    });

    // add() 託管按鈕的生命週期 observer：childList → 容器重建後補回不在文件內的按鈕；
    // aria-expanded → 原生收合鈕切換時同步託管按鈕顯隱。
    const lifecycleObserver = new MutationObserver((records) => {
        let hasChild = false, hasAttr = false;
        for (const r of records) { if (r.type === 'attributes') hasAttr = true; else hasChild = true; }
        if (hasChild) {
            specs.forEach((_spec, id) => {
                const el = els.get(id);
                if (!el || !el.isConnected || (el.parentElement && el.parentElement.id !== CONTAINER_ID)) ensureButton(id);
            });
        }
        if (hasAttr) els.forEach((el, id) => applyCollapse(id, el));
    });
    lifecycleObserver.observe(document.documentElement, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['aria-expanded'],
    });

    let tooltipEl = null;
    function hideTooltip() {
        if (!tooltipEl) return;
        tooltipEl.classList.remove('show');
    }
    function showTooltip(button) {
        const text = button && button.dataset.lkCrbTooltip;
        if (!text) return;
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'lk-crb-tooltip';
            document.body.appendChild(tooltipEl);
        }
        tooltipEl.textContent = text;
        tooltipEl.style.left = '-9999px';
        tooltipEl.style.top = '-9999px';
        tooltipEl.classList.add('show');
        const r = button.getBoundingClientRect();
        const t = tooltipEl.getBoundingClientRect();
        const margin = 8;
        let left = r.left + (r.width - t.width) / 2;
        left = Math.max(margin, Math.min(window.innerWidth - t.width - margin, left));
        let top = r.top - t.height - margin;
        if (top < margin) top = Math.min(window.innerHeight - t.height - margin, r.bottom + margin);
        tooltipEl.style.left = Math.round(left) + 'px';
        tooltipEl.style.top = Math.round(top) + 'px';
    }
    document.addEventListener('pointerover', (e) => {
        const button = e.target.closest && e.target.closest('#' + CONTAINER_ID + ' > .lk-crb-managed');
        if (button) showTooltip(button);
    }, true);
    document.addEventListener('pointerout', (e) => {
        const button = e.target.closest && e.target.closest('#' + CONTAINER_ID + ' > .lk-crb-managed');
        if (button && (!e.relatedTarget || !button.contains(e.relatedTarget))) hideTooltip();
    }, true);
    document.addEventListener('focusin', (e) => {
        const button = e.target.closest && e.target.closest('#' + CONTAINER_ID + ' > .lk-crb-managed');
        if (button) showTooltip(button);
    }, true);
    document.addEventListener('focusout', hideTooltip, true);

    global.Liko.__Sys_ChatRoomButtons__ = {
        v: '4.0',
        slots,
        plainIds,
        register,
        get,
        reapply,
        setPlain,
        add,
        remove,
        setState,
        setActive,
    };

    // 排空待處理佇列：插件在本檔載入前 push(spec) 到 __CRB_pending__，此處排空。
    // 讓「登記按鈕」與「載入協調器」的時機完全解耦（見 MD「五」）。
    const pendingAdds = global.Liko.__CRB_pending__;
    if (Array.isArray(pendingAdds)) {
        while (pendingAdds.length) { try { add(pendingAdds.shift()); } catch (e) { console.warn('🐈‍⬛ [CRB] pending add 失敗:', e); } }
    }
})(window);
