/**
 * BC_ChatRoomButtons.js — shared coordinator for #chat-room-buttons.
 * Owns insertion, colour/state, collapse, scrolling, ordering and visibility.
 */
(function (global) {
    'use strict';

    global.Liko = global.Liko || {};
    if (global.Liko.__Sys_ChatRoomButtons__) return;

    const CONTAINER_ID = 'chat-room-buttons';
    const SETTINGS_KEY = 'LikoChatRoomButtons';
    const PANEL_ID = 'lk-crb-settings-panel';
    const MAX_VISIBLE_PLUGINS = 5;
    const HEAL_INTERVAL_MS = 500;
    const slots = {};
    const plainIds = new Set();
    const els = new Map();
    const specs = new Map();

    function settings() {
        const fallback = { order: [], direction: 'rtl', hidden: [] };
        if (typeof Player === 'undefined' || !Player) return fallback;
        Player.ExtensionSettings = Player.ExtensionSettings || {};
        const saved = Player.ExtensionSettings[SETTINGS_KEY];
        if (!saved || typeof saved !== 'object') Player.ExtensionSettings[SETTINGS_KEY] = fallback;
        const value = Player.ExtensionSettings[SETTINGS_KEY];
        if (!Array.isArray(value.order)) value.order = [];
        if (!Array.isArray(value.hidden)) value.hidden = [];
        if (value.direction !== 'ltr' && value.direction !== 'rtl') value.direction = 'rtl';
        return value;
    }

    function saveSettings() {
        if (typeof Player === 'undefined' || !Player) return;
        try {
            if (typeof ServerPlayerExtensionSettingsSync === 'function') ServerPlayerExtensionSettingsSync(SETTINGS_KEY);
        } catch (error) { console.warn('[CRB] Failed to sync settings:', error); }
    }

    function buttonKey(el) {
        return el && (el.dataset.lkCrbId || el.id);
    }

    function collapseExpanded() {
        const button = document.getElementById('chat-room-buttons-collapse');
        return !button || button.getAttribute('aria-expanded') === 'true';
    }

    function applyVisibility(el) {
        if (!el || el.id === 'chat-room-send' || el.id === 'chat-room-buttons-collapse') return;
        const key = buttonKey(el);
        const spec = key && specs.get(key);
        const userHidden = key && settings().hidden.includes(key);
        const collapseHidden = (!spec || spec.collapse !== false) && !collapseExpanded();
        el.hidden = !!(userHidden || collapseHidden);
    }

    function orderedKeys(container) {
        const buttons = Array.from(container.children).filter(el => el.matches && el.matches('button') && el.id !== 'chat-room-send' && el.id !== 'chat-room-buttons-collapse');
        const preferred = settings().order.filter(key => buttons.some(el => buttonKey(el) === key));
        const missing = buttons
            .filter(el => !preferred.includes(buttonKey(el)))
            .sort((a, b) => (slots[buttonKey(b)] || 0) - (slots[buttonKey(a)] || 0))
            .map(buttonKey);
        return preferred.concat(missing);
    }

    function applyLayout() {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        container.dir = settings().direction;
        const keys = orderedKeys(container);
        Array.from(container.children).forEach(el => {
            const key = buttonKey(el);
            if (el.id === 'chat-room-send') el.style.order = '-10000';
            else if (el.id === 'chat-room-buttons-collapse') el.style.order = '10000';
            else if (key) el.style.order = String(keys.indexOf(key));
            applyVisibility(el);
        });
    }

    function register(id, order, el) {
        slots[id] = Number(order) || 0;
        if (el) {
            els.set(id, el);
            el.dataset.lkCrbId = id;
            el.classList.toggle('lk-crb-plain', plainIds.has(id));
        }
        applyLayout();
        return slots[id];
    }

    function get(id) { return slots[id]; }
    function reapply(id, el) { if (id in slots) register(id, slots[id], el); }
    function setPlain(id, on = true) {
        if (on) plainIds.add(id); else plainIds.delete(id);
        els.get(id)?.classList.toggle('lk-crb-plain', on);
    }

    function createManagedButton(spec) {
        const button = document.createElement('button');
        button.id = spec.buttonId || ('lk-crb-' + spec.id);
        button.type = 'button';
        button.className = 'blank-button button HideOnPopup chat-room-button';
        button.setAttribute('role', 'menuitem');
        let icon = typeof spec.icon === 'function' ? spec.icon(button) : spec.icon;
        if (icon instanceof Node) button.appendChild(icon);
        else if (icon && typeof icon === 'object' && icon.src) {
            const img = document.createElement('img');
            img.src = icon.src; img.alt = icon.alt || ''; img.className = icon.className || '';
            button.appendChild(img);
        } else if (typeof icon === 'string') button.innerHTML = icon;
        if (typeof spec.onClick === 'function') button.addEventListener('click', event => {
            event.preventDefault(); event.stopPropagation(); spec.onClick(event, button);
        });
        return button;
    }

    function applyState(id, patch) {
        const spec = specs.get(id);
        if (!spec) return;
        spec.state = Object.assign({}, spec.state || {}, patch || {});
        const el = els.get(id);
        if (!el) return;
        const active = !!spec.state.active;
        const activeSpec = spec.active || {};
        const border = spec.state.border || (active && activeSpec.border) || spec.border;
        el.classList.toggle('lk-crb-active', active);
        el.classList.toggle('lk-crb-borderless', border === 'none');
        let tooltip = spec.state.tooltip || (active && activeSpec.tooltip) || spec.tooltip || id;
        if (typeof tooltip === 'function') tooltip = tooltip(active, el);
        el.setAttribute('aria-label', String(tooltip));
        el.dataset.lkCrbTooltip = String(tooltip);
        const values = {
            '--lk-crb-current-bg': spec.state.background || (active && activeSpec.background) || spec.background,
            '--lk-crb-current-border': border,
            '--lk-crb-current-color': spec.state.color || (active && activeSpec.color),
            '--lk-crb-current-shadow': spec.state.boxShadow || (active && activeSpec.boxShadow),
        };
        Object.entries(values).forEach(([name, value]) => value ? el.style.setProperty(name, value) : el.style.removeProperty(name));
    }

    function ensureButton(id) {
        const spec = specs.get(id);
        const container = document.getElementById(CONTAINER_ID);
        if (!spec || !container) return;
        let el = els.get(id);
        if (!el || !el.isConnected || el.parentElement !== container) {
            if (el?.isConnected) el.remove();
            el = spec.createButton ? spec.createButton() : createManagedButton(spec);
            if (!el) return;
            if (!el.id) el.id = 'lk-crb-' + id;
            container.appendChild(el);
        }
        el.classList.add('lk-crb-managed');
        if (!spec.tooltip && el.title) spec.tooltip = el.title;
        el.removeAttribute('title');
        if (spec.className) el.classList.add(...String(spec.className).split(/\s+/).filter(Boolean));
        if (spec.plain) plainIds.add(id);
        register(id, spec.order, el);
        applyState(id, spec.state || {});
    }

    function add(input) {
        if (!input || typeof input !== 'object' || !input.id || (!input.icon && typeof input.createButton !== 'function')) throw new TypeError('CRB.add requires { id, order, icon|createButton }');
        const spec = Object.assign({ order: 0, tooltip: input.id, collapse: true, plain: false, state: {} }, input);
        specs.set(spec.id, spec);
        ensureButton(spec.id);
        return spec.id;
    }

    function remove(id) {
        specs.delete(id);
        els.get(id)?.remove();
        els.delete(id); delete slots[id]; plainIds.delete(id);
        applyLayout();
    }

    function injectStyle() {
        if (document.getElementById('lk-crb-layout-style')) return;
        const style = document.createElement('style');
        style.id = 'lk-crb-layout-style';
        style.textContent = `
#${CONTAINER_ID}{grid-template-columns:unset!important;grid-template-rows:min-content!important;grid-auto-flow:column!important;grid-auto-columns:min-content!important;max-width:calc(var(--button-size) * ${MAX_VISIBLE_PLUGINS + 1} + min(.4vh,.2vw) * ${MAX_VISIBLE_PLUGINS + 2})!important;overflow-x:auto!important;overflow-y:visible!important;scrollbar-width:none!important;overscroll-behavior-x:contain!important}
#${CONTAINER_ID}::-webkit-scrollbar{display:none!important}
#${CONTAINER_ID}.lk-crb-dragging{cursor:grabbing!important}
#${CONTAINER_ID}>button:not(#chat-room-send){cursor:grab}
#${CONTAINER_ID}>.lk-crb-plain::before{background:none!important}
#${CONTAINER_ID}>.lk-crb-managed{position:relative!important;background:var(--lk-crb-current-bg)!important;color:var(--lk-crb-current-color)!important;border:var(--lk-crb-current-border)!important;box-shadow:var(--lk-crb-current-shadow)!important}
#${CONTAINER_ID}>.lk-crb-managed.lk-crb-borderless{border:none!important;outline:none!important}
.lk-crb-tooltip{position:fixed;z-index:2147483646;padding:6px 9px;border:1px solid #ffffff2e;border-radius:7px;background:#121419f7;color:#f2f3f5;font:600 12px/1.35 sans-serif;pointer-events:none}
#${PANEL_ID}{position:fixed;z-index:2147483647;right:16px;bottom:76px;width:min(380px,calc(100vw - 32px));max-height:min(620px,calc(100vh - 100px));overflow:auto;box-sizing:border-box;padding:14px;border:1px solid #ffffff35;border-radius:12px;background:#171a22f7;color:#f4f5f7;font:14px/1.4 sans-serif;box-shadow:0 14px 50px #000b}
#${PANEL_ID} .lk-crb-head,#${PANEL_ID} .lk-crb-row,#${PANEL_ID} .lk-crb-actions{display:flex;align-items:center;gap:8px}
#${PANEL_ID} .lk-crb-head{margin-bottom:12px} #${PANEL_ID} .lk-crb-head b{flex:1;font-size:17px}
#${PANEL_ID} .lk-crb-row{padding:7px 0;border-top:1px solid #ffffff18} #${PANEL_ID} .lk-crb-row span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#${PANEL_ID} button,#${PANEL_ID} select{border:1px solid #ffffff30;border-radius:6px;background:#292e3b;color:#fff;padding:5px 8px;cursor:pointer}
#${PANEL_ID} .lk-crb-actions{margin-top:12px;justify-content:flex-end}
`;
        (document.head || document.documentElement).appendChild(style);
    }

    let tooltipEl;
    function hideTooltip() { tooltipEl?.remove(); tooltipEl = null; }
    function showTooltip(button) {
        const text = button?.dataset.lkCrbTooltip;
        if (!text) return;
        hideTooltip(); tooltipEl = document.createElement('div'); tooltipEl.className = 'lk-crb-tooltip'; tooltipEl.textContent = text; document.body.appendChild(tooltipEl);
        const r = button.getBoundingClientRect(), t = tooltipEl.getBoundingClientRect();
        tooltipEl.style.left = Math.max(8, Math.min(innerWidth - t.width - 8, r.left + (r.width - t.width) / 2)) + 'px';
        tooltipEl.style.top = Math.max(8, r.top - t.height - 8) + 'px';
    }

    function openSettingsPanel() {
        const old = document.getElementById(PANEL_ID);
        if (old) { old.remove(); return; }
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        const panel = document.createElement('section'); panel.id = PANEL_ID;
        const render = () => {
            const keys = orderedKeys(container);
            const names = new Map(Array.from(container.children).map(el => [buttonKey(el), el.dataset.lkCrbTooltip || el.getAttribute('aria-label') || el.title || buttonKey(el)]));
            panel.innerHTML = `<div class="lk-crb-head"><b>聊天室按鈕設定</b><button data-close aria-label="關閉">×</button></div><label>顯示方向 <select data-direction><option value="rtl">由右至左</option><option value="ltr">由左至右</option></select></label><div data-list></div><div class="lk-crb-actions"><button data-reset>還原</button></div>`;
            panel.querySelector('[data-direction]').value = settings().direction;
            const list = panel.querySelector('[data-list]');
            keys.forEach((key, index) => {
                const row = document.createElement('div'); row.className = 'lk-crb-row'; row.dataset.key = key;
                row.innerHTML = `<input type="checkbox" ${settings().hidden.includes(key) ? '' : 'checked'} aria-label="顯示"><span></span><button data-up ${index === 0 ? 'disabled' : ''}>↑</button><button data-down ${index === keys.length - 1 ? 'disabled' : ''}>↓</button>`;
                row.querySelector('span').textContent = names.get(key) || key;
                list.appendChild(row);
            });
            panel.querySelector('[data-close]').onclick = () => panel.remove();
            panel.querySelector('[data-direction]').onchange = event => { settings().direction = event.target.value; saveSettings(); applyLayout(); };
            panel.querySelector('[data-reset]').onclick = () => { Object.assign(settings(), { order: [], direction: 'rtl', hidden: [] }); saveSettings(); applyLayout(); render(); };
            list.onchange = event => { const row = event.target.closest('.lk-crb-row'); if (!row) return; const hidden = settings().hidden; const i = hidden.indexOf(row.dataset.key); if (event.target.checked && i >= 0) hidden.splice(i, 1); else if (!event.target.checked && i < 0) hidden.push(row.dataset.key); saveSettings(); applyLayout(); };
            list.onclick = event => { const row = event.target.closest('.lk-crb-row'); if (!row || (!event.target.matches('[data-up]') && !event.target.matches('[data-down]'))) return; const order = orderedKeys(container); const from = order.indexOf(row.dataset.key); const to = from + (event.target.matches('[data-up]') ? -1 : 1); if (to < 0 || to >= order.length) return; [order[from], order[to]] = [order[to], order[from]]; settings().order = order; saveSettings(); applyLayout(); render(); };
        };
        render(); document.body.appendChild(panel);
    }

    let drag = null;
    document.addEventListener('pointerdown', event => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        const button = event.target.closest?.(`#${CONTAINER_ID}>button`);
        if (!button || button.id === 'chat-room-send' || button.dataset.crbNoDrag !== undefined) return;
        const container = button.parentElement;
        drag = { container, startX: event.clientX, startScroll: container.scrollLeft, moved: false };
    }, true);
    document.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.startX;
        if (!drag.moved && Math.abs(dx) > 4) { drag.moved = true; drag.container.classList.add('lk-crb-dragging'); }
        if (drag.moved) { drag.container.scrollLeft = drag.startScroll - dx; event.preventDefault(); }
    }, true);
    function endDrag() {
        if (!drag) return;
        const { container, moved } = drag; drag = null; container.classList.remove('lk-crb-dragging');
        if (moved) document.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); }, { capture: true, once: true });
    }
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);

    document.addEventListener('click', event => {
        if (!event.target.closest?.('#chat-room-send')) return;
        event.preventDefault(); event.stopImmediatePropagation(); openSettingsPanel();
    }, true);
    document.addEventListener('pointerover', event => { const b = event.target.closest?.(`#${CONTAINER_ID}>.lk-crb-managed`); if (b) showTooltip(b); }, true);
    document.addEventListener('pointerout', event => { if (event.target.closest?.(`#${CONTAINER_ID}>.lk-crb-managed`)) hideTooltip(); }, true);

    const observer = new MutationObserver(() => {
        specs.forEach((_spec, id) => ensureButton(id));
        applyLayout();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
    setInterval(() => { specs.forEach((_spec, id) => ensureButton(id)); applyLayout(); }, HEAL_INTERVAL_MS);
    injectStyle();

    global.Liko.__Sys_ChatRoomButtons__ = {
        v: '5.0', slots, plainIds, register, get, reapply, setPlain, add, remove,
        setState: applyState, setActive: (id, active) => applyState(id, { active: !!active }),
        openSettings: openSettingsPanel, applyLayout,
    };

    const pending = global.Liko.__CRB_pending__;
    if (Array.isArray(pending)) while (pending.length) { try { add(pending.shift()); } catch (error) { console.warn('[CRB] pending add failed:', error); } }
})(window);
