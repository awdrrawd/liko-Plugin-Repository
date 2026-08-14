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
        if (!el) return '';
        if (el.dataset.lkCrbId || el.id || el.dataset.lkCrbNativeKey) return el.dataset.lkCrbId || el.id || el.dataset.lkCrbNativeKey;
        const hint = el.getAttribute('aria-label') || el.title || Array.from(el.classList).join('-') || el.tagName.toLowerCase();
        el.dataset.lkCrbNativeKey = 'native-' + String(hint).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
        return el.dataset.lkCrbNativeKey;
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
        const buttons = Array.from(container.children).filter(el => el instanceof HTMLElement && el.id !== 'chat-room-send' && el.id !== 'chat-room-buttons-collapse');
        const preferred = settings().order.filter(key => buttons.some(el => buttonKey(el) === key));
        const missing = buttons
            .filter(el => !preferred.includes(buttonKey(el)))
            .sort((a, b) => (slots[buttonKey(a)] || 0) - (slots[buttonKey(b)] || 0))
            .map(buttonKey);
        const keys = preferred.concat(missing);
        return settings().direction === 'ltr' ? keys.reverse() : keys;
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
        } else if (typeof icon === 'string') {
            if (spec.id === 'mat') icon = icon.replace(/fill:\s*#000000/gi, 'fill:currentColor');
            if (spec.id === 'kaomoji') icon = icon.replace('<svg ', '<svg fill="currentColor" ');
            button.innerHTML = icon;
        }
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
            '--lk-crb-current-color': spec.state.color || (active && activeSpec.color) || spec.color,
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
        if (input.icon && input.plain === undefined) spec.plain = true;
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
#${CONTAINER_ID}>.lk-crb-managed{position:relative!important;overflow:hidden!important;border-radius:12px!important;background:var(--lk-crb-current-bg)!important;color:var(--lk-crb-current-color)!important;border:var(--lk-crb-current-border)!important;box-shadow:var(--lk-crb-current-shadow)!important}
#${CONTAINER_ID}>.lk-crb-managed.lk-crb-borderless{border:none!important;outline:none!important}
#${CONTAINER_ID}>.lk-crb-managed>svg{position:absolute!important;z-index:2!important;inset:19%!important;width:62%!important;height:62%!important;display:block!important;pointer-events:none!important}
#${CONTAINER_ID}>.lk-crb-animating[hidden]{display:flex!important}
#${CONTAINER_ID}>.lk-crb-animating{transition:opacity ${ANIM_MS}ms ease,transform ${ANIM_MS}ms ease;opacity:1;transform:translateX(0);pointer-events:auto}
#${CONTAINER_ID}>.lk-crb-animating.lk-crb-collapsed{opacity:0!important;transform:translateX(18px)!important;pointer-events:none}
.lk-crb-tooltip{position:fixed;z-index:2147483646;padding:6px 9px;border:1px solid #ffffff2e;border-radius:7px;background:#121419f7;color:#f2f3f5;font:600 12px/1.35 sans-serif;pointer-events:none}
#${PANEL_ID}-backdrop{position:fixed;inset:0;z-index:2147483646;background:#05070b99;backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px;box-sizing:border-box}
#${PANEL_ID}{width:min(450px,100%);max-height:min(560px,calc(100vh - 40px));overflow:auto;box-sizing:border-box;padding:0;border:1px solid #8ea4ff45;border-radius:18px;background:linear-gradient(155deg,#202637f7,#11141dfb);color:#f4f5f7;font:14px/1.4 system-ui,sans-serif;box-shadow:0 28px 90px #000d,0 0 0 1px #ffffff0c inset}
#${PANEL_ID} .lk-crb-head,#${PANEL_ID} .lk-crb-actions{display:flex;align-items:center;gap:10px}
#${PANEL_ID} .lk-crb-head{position:sticky;top:0;z-index:2;padding:18px 20px;background:#1b2030ed;border-bottom:1px solid #ffffff14} #${PANEL_ID} .lk-crb-head b{flex:1;font-size:18px}
#${PANEL_ID} .lk-crb-body{padding:14px 18px 18px} #${PANEL_ID} .lk-crb-direction{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:16px}
#${PANEL_ID} .lk-crb-zone-label{margin:10px 2px 6px;color:#aeb7cc;font-size:14px;font-weight:700} #${PANEL_ID} .lk-crb-zone{min-height:72px;display:flex;align-content:flex-start;flex-wrap:wrap;gap:10px;padding:12px;border:1px dashed #7683a54d;border-radius:14px;background:#06081045;transition:border-color .15s,background .15s}
#${PANEL_ID} .lk-crb-zone.lk-crb-zone-over{border-color:#91a4ff;background:#7d91ff12} #${PANEL_ID} .lk-crb-item{position:relative;width:54px;height:54px;display:grid;place-items:center;border:1px solid #ffffff20;border-radius:13px;background:#0b0e16;cursor:grab;overflow:hidden;transition:transform .15s,border-color .15s,opacity .15s}
#${PANEL_ID} .lk-crb-item:hover{transform:translateY(-2px);border-color:#91a4ff} #${PANEL_ID} .lk-crb-item.lk-crb-sort-drag{opacity:.35} #${PANEL_ID} .lk-crb-item>*{max-width:100%!important;max-height:100%!important;width:100%!important;height:100%!important;object-fit:contain!important;pointer-events:none!important}
#${PANEL_ID} .lk-crb-item svg{width:62%!important;height:62%!important;display:block!important} #${PANEL_ID} .lk-crb-emoji{display:grid!important;place-items:center;font-size:28px!important;line-height:1!important}
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
        const sourceStyle = getComputedStyle(source);
        target.style.background = sourceStyle.background;
        target.style.backgroundColor = sourceStyle.backgroundColor;
        target.style.color = sourceStyle.color;
        target.style.boxShadow = sourceStyle.boxShadow;
        const imageSource = source.querySelector('img');
        if (imageSource) {
            const image = imageSource.cloneNode(true);
            image.hidden = false; image.className = ''; image.style.cssText = 'display:block!important;width:100%!important;height:100%!important;object-fit:contain!important';
            target.appendChild(image); return;
        }
        const svgSource = source.querySelector('svg');
        if (svgSource) { target.appendChild(svgSource.cloneNode(true)); return; }
        const canvas = source.querySelector('canvas');
        if (canvas) {
            try { const image = new Image(); image.src = canvas.toDataURL(); target.appendChild(image); return; } catch (_error) {}
        }
        const text = source.textContent.trim();
        if (text) {
            const emoji = document.createElement('span'); emoji.className = 'lk-crb-emoji'; emoji.textContent = text;
            target.appendChild(emoji); return;
        }
        const pseudo = getComputedStyle(source, '::before');
        const preview = document.createElement('span');
        preview.style.cssText = `display:block!important;width:100%!important;height:100%!important;background:${pseudo.background};background-color:${pseudo.backgroundColor};background-image:${pseudo.backgroundImage};background-position:${pseudo.backgroundPosition};background-size:${pseudo.backgroundSize};background-repeat:${pseudo.backgroundRepeat};mask-image:${pseudo.maskImage};mask-position:${pseudo.maskPosition};mask-size:${pseudo.maskSize};mask-repeat:${pseudo.maskRepeat};-webkit-mask-image:${pseudo.webkitMaskImage};-webkit-mask-position:${pseudo.webkitMaskPosition};-webkit-mask-size:${pseudo.webkitMaskSize};-webkit-mask-repeat:${pseudo.webkitMaskRepeat};color:${pseudo.color}`;
        target.appendChild(preview);
    }

    function panelText() {
        const language = typeof TranslationLanguage === 'string' ? TranslationLanguage.toUpperCase() : 'EN';
        if (language === 'TW') return { title: '聊天室按鈕設定', close: '關閉', direction: '排列方向', rtl: '由右至左', ltr: '由左至右', visible: '顯示', hidden: '隱藏', reset: '還原預設' };
        if (language === 'CN') return { title: '聊天室按钮设置', close: '关闭', direction: '排列方向', rtl: '由右至左', ltr: '由左至右', visible: '显示', hidden: '隐藏', reset: '恢复默认' };
        return { title: 'Chat Button Settings', close: 'Close', direction: 'Direction', rtl: 'Right to left', ltr: 'Left to right', visible: 'Visible', hidden: 'Hidden', reset: 'Reset defaults' };
    }

    function openSettingsPanel() {
        const old = document.getElementById(PANEL_ID + '-backdrop');
        if (old) { old.remove(); return; }
        const container = document.getElementById(CONTAINER_ID);
        if (!container) return;
        const backdrop = document.createElement('div'); backdrop.id = PANEL_ID + '-backdrop';
        const panel = document.createElement('section'); panel.id = PANEL_ID; backdrop.appendChild(panel);

        const saveDisplayedOrder = keys => {
            settings().order = settings().direction === 'ltr' ? keys.slice().reverse() : keys.slice();
            saveSettings(); applyLayout();
        };
        const render = () => {
            const text = panelText();
            const keys = orderedKeys(container);
            const sources = new Map(Array.from(container.children).map(el => [buttonKey(el), el]));
            panel.innerHTML = `<div class="lk-crb-head"><b>${text.title}</b><button class="lk-crb-close" data-close aria-label="${text.close}">×</button></div><div class="lk-crb-body"><label class="lk-crb-direction"><span>${text.direction}</span><select data-direction><option value="rtl">${text.rtl}</option><option value="ltr">${text.ltr}</option></select></label><div class="lk-crb-zone-label">${text.visible}</div><div class="lk-crb-zone" data-zone="visible"></div><div class="lk-crb-zone-label">${text.hidden}</div><div class="lk-crb-zone" data-zone="hidden"></div><div class="lk-crb-actions"><button data-reset>${text.reset}</button></div></div>`;
            panel.querySelector('[data-direction]').value = settings().direction;
            panel.querySelectorAll('.lk-crb-zone').forEach(zone => { zone.dir = settings().direction; });
            keys.forEach(key => {
                const source = sources.get(key);
                const hidden = settings().hidden.includes(key);
                const item = document.createElement('div'); item.className = 'lk-crb-item'; item.dataset.key = key; item.draggable = true;
                item.title = source?.dataset.lkCrbTooltip || source?.getAttribute('aria-label') || source?.title || key;
                if (source) copyButtonIcon(source, item);
                panel.querySelector(`[data-zone="${hidden ? 'hidden' : 'visible'}"]`).appendChild(item);
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
            let draggedKey = null;
            const zones = Array.from(panel.querySelectorAll('.lk-crb-zone'));
            const commitZones = () => {
                const visible = Array.from(panel.querySelector('[data-zone="visible"]').children).map(el => el.dataset.key);
                const hidden = Array.from(panel.querySelector('[data-zone="hidden"]').children).map(el => el.dataset.key);
                settings().hidden = hidden; saveDisplayedOrder(visible.concat(hidden));
            };
            panel.addEventListener('click', event => {
                const item = event.target.closest('.lk-crb-item'); if (!item) return;
                const destination = item.parentElement.dataset.zone === 'visible' ? panel.querySelector('[data-zone="hidden"]') : panel.querySelector('[data-zone="visible"]');
                destination.appendChild(item); commitZones();
            });
            panel.addEventListener('dragstart', event => {
                const item = event.target.closest('.lk-crb-item'); if (!item) return;
                draggedKey = item.dataset.key; item.classList.add('lk-crb-sort-drag');
                event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', draggedKey);
            });
            zones.forEach(zone => {
                zone.addEventListener('dragover', event => {
                    event.preventDefault(); zone.classList.add('lk-crb-zone-over');
                    const item = event.target.closest('.lk-crb-item');
                    const dragged = panel.querySelector(`.lk-crb-item[data-key="${CSS.escape(draggedKey || '')}"]`);
                    if (dragged && item && item !== dragged) zone.insertBefore(dragged, item);
                    else if (dragged && !item) zone.appendChild(dragged);
                });
                zone.addEventListener('dragleave', event => { if (!zone.contains(event.relatedTarget)) zone.classList.remove('lk-crb-zone-over'); });
                zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('lk-crb-zone-over'); commitZones(); });
            });
            panel.addEventListener('dragend', () => { if (draggedKey) commitZones(); draggedKey = null; panel.querySelectorAll('.lk-crb-sort-drag,.lk-crb-zone-over').forEach(el => el.classList.remove('lk-crb-sort-drag', 'lk-crb-zone-over')); });
        };
        backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.remove(); });
        render(); document.body.appendChild(backdrop);
    }

    let drag = null;
    document.addEventListener('pointerdown', event => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        const button = event.target.closest?.(`#${CONTAINER_ID}>*`);
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
