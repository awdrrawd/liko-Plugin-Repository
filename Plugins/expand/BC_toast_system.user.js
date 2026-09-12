// BC toast — 用法見 README-bc-toast.md
(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.__Sys_Toast__) return;
    const MOD_VER = '2.0';
    const entries = new Set();
    const keyed = new Map();
    const MAX_VISIBLE = 5;
    const FADE_MS = 200;
    const STYLE_NAMES = new Set(['classic', 'card', 'pill', 'glass']);
    const tones = {
        success: { color: '#69db9c', icon: '✓' },
        error: { color: '#ff8585', icon: '!' },
        warning: { color: '#ffd166', icon: '!' },
        info: { color: '#83c9ff', icon: 'i' },
        loading: { color: '#c9b6ff', icon: '…' },
    };
    let stack;
    let styles;
    function mount() {
        if (!styles?.isConnected) {
            styles = document.createElement('style');
            styles.textContent = `
                .liko-toast-stack { position:fixed; bottom:max(120px,env(safe-area-inset-bottom)); left:50%; transform:translateX(-50%); width:max-content; max-width:calc(100vw - 24px); display:flex; flex-direction:column-reverse; gap:10px; align-items:center; pointer-events:none; z-index:9999; }
                .liko-toast { box-sizing:border-box; max-width:min(560px,calc(100vw - 24px)); padding:10px 16px; border-radius:10px; background:rgba(0,0,0,.82); font-weight:bold; line-height:1.4; white-space:pre-wrap; overflow-wrap:anywhere; user-select:none; pointer-events:none; opacity:1; transition:opacity .2s,transform .2s; box-shadow:0 4px 18px #0003; }
                .liko-toast[data-style="card"] { background:#202735; border-left:4px solid currentColor; border-radius:8px; }
                .liko-toast[data-style="pill"] { border-radius:28px; padding:8px 18px; border:1px solid currentColor; background:#18212ef2; }
                .liko-toast[data-style="glass"] { background:#18212edb; backdrop-filter:blur(12px); border:1px solid #ffffff40; }
                .liko-toast.lk-toast-enter { opacity:0; transform:translateY(12px); }
                @media(prefers-reduced-motion:reduce) { .liko-toast { transition:none; } }
            `;
            document.head.appendChild(styles);
        }
        if (!stack?.isConnected) {
            stack = document.createElement('div');
            stack.className = 'liko-toast-stack';
            document.body.appendChild(stack);
        }
    }

    function ChatRoomSendLocalStyled(message, duration = 3000, color = '#ff69b4', x = null, y = null, fontSize = '24px') {
        const options = typeof duration === 'object' && duration !== null
            ? { duration: 3000, fontSize: '20px', ...duration }
            : { duration, color, x, y, fontSize };
        const key = options.dedupeKey ?? options.id;
        if (key != null && keyed.has(key)) {
            const existing = keyed.get(key);
            existing.handle.update(message, options);
            return existing.handle;
        }
        mount();
        while (entries.size >= MAX_VISIBLE) entries.values().next().value.handle.dismiss();
        return createToast(message, options, key);
    }

    // Appearance and placement do not change the notification's lifetime.
    function renderToast(el, message, cfg) {
        const tone = tones[cfg.type];
        el.textContent = `${tone && cfg.icon !== false ? tone.icon + ' ' : ''}${String(message ?? '')}`;
        el.style.color = cfg.color || tone?.color || '#ff69b4';
        el.style.fontSize = typeof cfg.fontSize === 'number' ? `${cfg.fontSize}px` : cfg.fontSize;
        el.dataset.style = STYLE_NAMES.has(cfg.style) ? cfg.style : 'classic';
        el.setAttribute('aria-live', cfg.type === 'error' ? 'assertive' : 'polite');
        positionToast(el, cfg);
    }

    function positionToast(el, cfg) {
        const positioned = cfg.x != null || cfg.y != null;
        el.style.position = positioned ? 'fixed' : '';
        el.style.left = positioned ? (cfg.x != null ? `${cfg.x}px` : '50%') : '';
        el.style.bottom = positioned ? `${cfg.y ?? 120}px` : '';
        el.style.translate = positioned && cfg.x == null ? '-50% 0' : '';
        el.style.zIndex = positioned ? '9999' : '';
        const parent = positioned ? document.body : stack;
        if (el.parentNode !== parent) parent.appendChild(el);
    }

    function createToast(message, options, key) {
        const el = document.createElement('div');
        el.className = 'liko-toast lk-toast-enter';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        const entry = { handle: null };
        let timer = null;
        let frame = null;
        let closed = false;
        function restartTimer() {
            clearTimeout(timer);
            timer = null;
            const ms = Number(options.duration);
            // duration: 0 keeps a progress notification until update/dismiss.
            if (ms !== 0) timer = setTimeout(() => {
                el.classList.add('lk-toast-enter');
                timer = setTimeout(dismiss, FADE_MS);
            }, Number.isFinite(ms) && ms > 0 ? Math.min(ms, 2147483000) : 3000);
        }
        function dismiss() {
            if (closed) return;
            closed = true;
            clearTimeout(timer);
            cancelAnimationFrame(frame);
            el.remove();
            entries.delete(entry);
            if (key != null && keyed.get(key) === entry) keyed.delete(key);
        }
        entry.handle = {
            update(nextMessage, patch = {}) {
                if (closed) return entry.handle;
                if (nextMessage !== undefined) message = nextMessage;
                Object.assign(options, patch);
                el.classList.remove('lk-toast-enter');
                renderToast(el, message, options);
                restartTimer();
                return entry.handle;
            },
            dismiss,
        };
        entries.add(entry);
        if (key != null) keyed.set(key, entry);
        renderToast(el, message, options);
        restartTimer();
        frame = requestAnimationFrame(() => el.classList.remove('lk-toast-enter'));
        return entry.handle;
    }
    ChatRoomSendLocalStyled.clear = () => [...entries].forEach(entry => entry.handle.dismiss());
    ChatRoomSendLocalStyled.teardown = () => {
        ChatRoomSendLocalStyled.clear();
        stack?.remove(); styles?.remove();
        if (window.Liko.__Sys_Toast__ === ChatRoomSendLocalStyled) delete window.Liko.__Sys_Toast__;
        if (window.ChatRoomSendLocalStyled === ChatRoomSendLocalStyled) delete window.ChatRoomSendLocalStyled;
    };
    ChatRoomSendLocalStyled._version = MOD_VER;
    ChatRoomSendLocalStyled._loadTime = Date.now();
    window.Liko.__Sys_Toast__ = window.ChatRoomSendLocalStyled = ChatRoomSendLocalStyled;
})();
