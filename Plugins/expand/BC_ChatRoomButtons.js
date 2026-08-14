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
    const ANIM_MS = 200;
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

    const visibilityState = new WeakMap();
    const visibilityTimers = new WeakMap();

    function setHiddenAnimated(el, shouldHide) {
        const previous = visibilityState.get(el);
        visibilityState.set(el, shouldHide);
        if (previous === undefined) { el.hidden = shouldHide; return; }
        if (previous === shouldHide) return;
        const oldTimer = visibilityTimers.get(el);
        if (oldTimer) clearTimeout(oldTimer);
        el.hidden = false;
        el.classList.add('lk-crb-animating');
        if (shouldHide) {
            requestAnimationFrame(() => el.classList.add('lk-crb-collapsed'));
            const timer = setTimeout(() => {
                if (visibilityState.get(el)) el.hidden = true;
                el.classList.remove('lk-crb-animating', 'lk-crb-collapsed');
                visibilityTimers.delete(el);
            }, ANIM_MS + 30);
            visibilityTimers.set(el, timer);
        } else {
            el.classList.add('lk-crb-collapsed');
            void el.offsetWidth;
            requestAnimationFrame(() => el.classList.remove('lk-crb-collapsed'));
            const timer = setTimeout(() => {
                el.classList.remove('lk-crb-animating');
                visibilityTimers.delete(el);
            }, ANIM_MS + 30);
            visibilityTimers.set(el, timer);
        }
    }

    function applyVisibility(el) {
        if (!el || el.id === 'chat-room-send' || el.id === 'chat-room-buttons-collapse') return;
        const key = buttonKey(el);
        const spec = key && specs.get(key);
        const userHidden = key && settings().hidden.includes(key);
        const collapseHidden = (!spec || spec.collapse !== false) && !collapseExpanded();
        setHiddenAnimated(el, !!(userHidden || collapseHidden));
    }

    function orderedKeys(container) {
        const buttons = Array.from(container.children).filter(el => el.matches && el.matches('button') && el.id !== 'chat-room-send' && el.id !== 'chat-room-buttons-collapse');
        const preferred = settings().order.filter(key => buttons.some(el => buttonKey(el) === key));
        const missing = buttons
            .filter(el => !preferred.includes(buttonKey(el)))
            .sort((a, b) => (slots[buttonKey(a)] || 0) - (slots[buttonKey(b)] || 0))
            .map(buttonKey);
        const keys = preferred.concat(missing);
        return settings().direction === 'rtl' ? keys.reverse() : keys;
    }

    function applyLayout() {
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        container.dir = 'ltr';
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
#${CONTAINER_ID}>.lk-crb-animating[hidden]{display:flex!important}
#${CONTAINER_ID}>.lk-crb-animating{transition:opacity ${ANIM_MS}ms ease,transform ${ANIM_MS}ms ease;opacity:1;transform:translateX(0);pointer-events:auto}
#${CONTAINER_ID}>.lk-crb-animating.lk-crb-collapsed{opacity:0!important;transform:translateX(18px)!important;pointer-events:none}
.lk-crb-tooltip{position:fixed;z-index:2147483646;padding:6px 9px;border:1px solid #ffffff2e;border-radius:7px;background:#121419f7;color:#f2f3f5;font:600 12px/1.35 sans-serif;pointer-events:none}
#${PANEL_ID}-backdrop{position:fixed;inset:0;z-index:2147483646;background:#05070b99;backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px;box-sizing:border-box}
#${PANEL_ID}{width:min(540px,100%);max-height:min(720px,calc(100vh - 40px));overflow:auto;box-sizing:border-box;padding:0;border:1px solid #8ea4ff45;border-radius:20px;background:linear-gradient(155deg,#202637f7,#11141dfb);color:#f4f5f7;font:14px/1.4 system-ui,sans-serif;box-shadow:0 28px 90px #000d,0 0 0 1px #ffffff0c inset}
#${PANEL_ID} .lk-crb-head,#${PANEL_ID} .lk-crb-actions{display:flex;align-items:center;gap:10px}
#${PANEL_ID} .lk-crb-head{position:sticky;top:0;z-index:2;padding:18px 20px;background:#1b2030ed;border-bottom:1px solid #ffffff14} #${PANEL_ID} .lk-crb-head b{flex:1;font-size:18px}
#${PANEL_ID} .lk-crb-body{padding:16px 20px} #${PANEL_ID} .lk-crb-direction{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
#${PANEL_ID} .lk-crb-list{display:grid;gap:8px} #${PANEL_ID} .lk-crb-row{display:grid;grid-template-columns:34px 44px 1fr auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid #ffffff16;border-radius:12px;background:#ffffff08;cursor:grab;transition:border-color .15s,background .15s,transform .15s}
#${PANEL_ID} .lk-crb-row:hover{border-color:#8298ff72;background:#8298ff12} #${PANEL_ID} .lk-crb-row.lk-crb-sort-drag{opacity:.45} #${PANEL_ID} .lk-crb-row.lk-crb-sort-over{border-color:#91a4ff;transform:translateY(2px)}
#${PANEL_ID} .lk-crb-grip{font-size:20px;color:#8c96ad;text-align:center} #${PANEL_ID} .lk-crb-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:10px;background:#090b11;overflow:hidden;pointer-events:none} #${PANEL_ID} .lk-crb-icon>*{max-width:100%!important;max-height:100%!important;width:100%!important;height:100%!important;object-fit:contain!important}
#${PANEL_ID} .lk-crb-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650} #${PANEL_ID} .lk-crb-visible{display:flex;align-items:center;gap:6px;cursor:pointer;color:#b7bfd3}
#${PANEL_ID} button,#${PANEL_ID} select{border:1px solid #ffffff25;border-radius:8px;background:#2a3145;color:#fff;padding:7px 10px;cursor:pointer} #${PANEL_ID} .lk-crb-close{font-size:20px;line-height:1;padding:5px 9px}
#${PANEL_ID} .lk-crb-actions{margin-top:16px;justify-content:flex-end}
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

    function copyButtonIcon(source, target) {
        const canvas = source.querySelector('canvas');
        if (canvas) {
            try { const image = new Image(); image.src = canvas.toDataURL(); target.appendChild(image); return; } catch (_error) {}
        }
        const clone = source.cloneNode(true);
        clone.removeAttribute('aria-label'); clone.removeAttribute('role'); clone.tabIndex = -1;
        clone.style.order = ''; clone.hidden = false; clone.style.pointerEvents = 'none';
        target.appendChild(clone);
    }

    function openSettingsPanel() {
        const old = document.getElementById(PANEL_ID + '-backdrop');
        if (old) { old.remove(); return; }
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        const backdrop = document.createElement('div'); backdrop.id = PANEL_ID + '-backdrop';
        const panel = document.createElement('section'); panel.id = PANEL_ID; backdrop.appendChild(panel);

        const saveDisplayedOrder = keys => {
            settings().order = settings().direction === 'rtl' ? keys.slice().reverse() : keys.slice();
            saveSettings(); applyLayout();
        };
        const render = () => {
            const keys = orderedKeys(container);
            const sources = new Map(Array.from(container.children).map(el => [buttonKey(el), el]));
            panel.innerHTML = `<div class="lk-crb-head"><b>聊天室按鈕設定</b><button class="lk-crb-close" data-close aria-label="關閉">×</button></div><div class="lk-crb-body"><label class="lk-crb-direction"><span>排列方向</span><select data-direction><option value="rtl">由右至左</option><option value="ltr">由左至右</option></select></label><div class="lk-crb-list" data-list></div><div class="lk-crb-actions"><button data-reset>還原預設</button></div></div>`;
            panel.querySelector('[data-direction]').value = settings().direction;
            const list = panel.querySelector('[data-list]');
            keys.forEach(key => {
                const source = sources.get(key);
                const row = document.createElement('div'); row.className = 'lk-crb-row'; row.dataset.key = key; row.draggable = true;
                row.innerHTML = `<span class="lk-crb-grip" aria-hidden="true">⠿</span><span class="lk-crb-icon"></span><span class="lk-crb-name"></span><label class="lk-crb-visible"><input type="checkbox" ${settings().hidden.includes(key) ? '' : 'checked'}><span>顯示</span></label>`;
                row.querySelector('.lk-crb-name').textContent = source?.dataset.lkCrbTooltip || source?.getAttribute('aria-label') || source?.title || key;
                if (source) copyButtonIcon(source, row.querySelector('.lk-crb-icon'));
                list.appendChild(row);
            });
            panel.querySelector('[data-close]').onclick = () => backdrop.remove();
            panel.querySelector('[data-direction]').onchange = event => {
                settings().direction = event.target.value;
                saveSettings(); applyLayout(); render();
            };
            panel.querySelector('[data-reset]').onclick = () => {
                Object.assign(settings(), { order: [], direction: 'rtl', hidden: [] });
                saveSettings(); applyLayout(); render();
            };
            list.onchange = event => {
                const row = event.target.closest('.lk-crb-row'); if (!row) return;
                const hidden = settings().hidden, index = hidden.indexOf(row.dataset.key);
                if (event.target.checked && index >= 0) hidden.splice(index, 1);
                else if (!event.target.checked && index < 0) hidden.push(row.dataset.key);
                saveSettings(); applyLayout();
            };
            let draggedKey = null;
            list.addEventListener('dragstart', event => {
                const row = event.target.closest('.lk-crb-row'); if (!row) return;
                draggedKey = row.dataset.key; row.classList.add('lk-crb-sort-drag');
                event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', draggedKey);
            });
            list.addEventListener('dragover', event => {
                const row = event.target.closest('.lk-crb-row'); if (!row || row.dataset.key === draggedKey) return;
                event.preventDefault(); list.querySelectorAll('.lk-crb-sort-over').forEach(el => el.classList.remove('lk-crb-sort-over')); row.classList.add('lk-crb-sort-over');
            });
            list.addEventListener('drop', event => {
                const target = event.target.closest('.lk-crb-row'); if (!target || !draggedKey) return;
                event.preventDefault();
                const order = orderedKeys(container), from = order.indexOf(draggedKey), to = order.indexOf(target.dataset.key);
                if (from >= 0 && to >= 0 && from !== to) { order.splice(from, 1); order.splice(to, 0, draggedKey); saveDisplayedOrder(order); }
                render();
            });
            list.addEventListener('dragend', () => { draggedKey = null; list.querySelectorAll('.lk-crb-sort-drag,.lk-crb-sort-over').forEach(el => el.classList.remove('lk-crb-sort-drag', 'lk-crb-sort-over')); });
        };
        backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
        render(); document.body.appendChild(backdrop);
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
