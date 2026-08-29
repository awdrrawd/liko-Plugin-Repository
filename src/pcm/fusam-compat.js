const BRAND = Symbol.for('pcm.fusam.compat');
const STYLE_ID = 'pcm-fusam-compat-style';
const MODAL_ROOT_ID = 'pcm-fusam-modal-root';
const LANGUAGES = ['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA'];

function existingFusam() {
  const value = window.FUSAM;
  return !!value && typeof value === 'object' && value.present === true;
}

function injectModalStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${MODAL_ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding:12px;background:#0005;font:16px Arial,sans-serif}
.pcm-fusam-modal{width:min(900px,calc(100vw - 24px));padding:18px 20px;border:1px solid #9c7cff;border-radius:0 0 16px 16px;background:#202124;color:#f2f2f2;box-shadow:0 18px 55px #0009;animation:pcm-fusam-in .24s ease-out both}.pcm-fusam-modal.closing{animation:pcm-fusam-out .2s ease-in both}.pcm-fusam-prompt{line-height:1.5;overflow-wrap:anywhere}.pcm-fusam-input{width:100%;margin-top:14px;padding:10px;border:1px solid #ffffff35;border-radius:8px;background:#0004;color:inherit;font:inherit}.pcm-fusam-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:15px;flex-wrap:wrap}.pcm-fusam-actions button{min-width:120px;padding:10px 16px;border:0;border-radius:9px;background:#ffffff20;color:inherit;font:inherit;font-weight:700;cursor:pointer}.pcm-fusam-actions button:hover{filter:brightness(1.2)}
@keyframes pcm-fusam-in{from{transform:translateY(-130%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes pcm-fusam-out{from{transform:translateY(0);opacity:1}to{transform:translateY(-130%);opacity:0}}
`;
  document.head.appendChild(style);
}

const modalQueue = [];
let modalActive = false;

function drainModalQueue() {
  if (modalActive || !modalQueue.length) return;
  modalActive = true;
  const options = modalQueue.shift();
  injectModalStyle();
  const root = document.createElement('div');
  root.id = MODAL_ROOT_ID;
  root.setAttribute('role', 'presentation');
  const modal = document.createElement('section');
  modal.className = 'pcm-fusam-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  const prompt = document.createElement('div');
  prompt.className = 'pcm-fusam-prompt';
  if (typeof options.prompt === 'string') prompt.textContent = options.prompt;
  else if (options.prompt instanceof Node) prompt.append(options.prompt);
  modal.append(prompt);

  let input = null;
  if (options.input) {
    input = document.createElement(options.input.type === 'textarea' ? 'textarea' : 'input');
    input.className = 'pcm-fusam-input';
    if (input instanceof HTMLTextAreaElement) input.rows = 8;
    input.value = String(options.input.initial ?? '');
    input.readOnly = !!options.input.readonly;
    input.addEventListener('keydown', event => event.stopPropagation());
    modal.append(input);
  }

  const actions = document.createElement('div');
  actions.className = 'pcm-fusam-actions';
  const buttons = options.buttons && typeof options.buttons === 'object' ? options.buttons : {};
  const ordered = [
    ['submit', buttons.submit || 'OK'],
    ...Object.entries(buttons).filter(([key]) => key !== 'submit'),
  ];
  const close = action => {
    for (const button of actions.querySelectorAll('button')) button.disabled = true;
    modal.classList.add('closing');
    const finish = () => {
      root.remove();
      try { options.callback?.(action, input?.value); }
      finally { modalActive = false; queueMicrotask(drainModalQueue); }
    };
    modal.addEventListener('animationend', finish, {once: true});
    setTimeout(() => { if (root.isConnected) finish(); }, 260);
  };
  for (const [action, label] of ordered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(label);
    button.addEventListener('click', () => close(action));
    actions.append(button);
  }
  modal.append(actions); root.append(modal); document.body.append(root);
  (input || actions.querySelector('button'))?.focus();
}

function openModal(options) {
  if (!options || typeof options !== 'object') throw new TypeError('Modal options must be an object');
  modalQueue.push(options);
  drainModalQueue();
}

function openModalAsync(options) {
  return new Promise(resolve => openModal({
    ...options,
    callback: (action, inputValue) => resolve([action, inputValue === undefined ? null : inputValue]),
  }));
}

function pcmButtonGroup() {
  return document.getElementById('bc-plugin-btn-group');
}

function pcmButton() {
  return pcmButtonGroup()?.querySelector('.bc-plugin-floating-btn') || null;
}

async function openPcmManager() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const button = pcmButton();
    if (button) { button.click(); return; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function createTranslationApi() {
  const catalogs = new Map();
  const notify = id => window.dispatchEvent(new CustomEvent('fusam:addon-translations-changed', {detail: {id}}));
  return Object.freeze({
    register(id, catalog) {
      if (!id || typeof id !== 'string') throw new TypeError('Addon translation id must be a non-empty string');
      if (!catalog || typeof catalog !== 'object') throw new TypeError('Addon translations must be an object');
      const normalized = {};
      for (const language of LANGUAGES) {
        const entry = catalog[language];
        if (!entry) continue;
        if (typeof entry !== 'object') throw new TypeError(`Invalid ${language} translation for ${id}`);
        normalized[language] = {};
        for (const field of ['name', 'description']) {
          if (entry[field] === undefined) continue;
          if (typeof entry[field] !== 'string') throw new TypeError(`Invalid ${language} ${field} for ${id}`);
          normalized[language][field] = entry[field];
        }
      }
      catalogs.set(id, normalized); notify(id);
    },
    unregister(id) { if (catalogs.delete(id)) notify(id); },
    get(id) { return catalogs.get(id); },
  });
}

/** Install only when a genuine/foreign FUSAM is not already present. */
export function installFusamCompat() {
  if (existingFusam()) return {installed: false, reason: 'existing-fusam', api: window.FUSAM};
  const debugMethods = new Map();
  const addons = {};
  const position = {};
  let zIndex = 2147483647;
  let forcedVisibility = null;
  const api = {
    present: true,
    addons,
    registerDebugMethod(name, method) {
      if (!name || typeof method !== 'function') throw new TypeError('Debug method requires a name and function');
      debugMethods.set(String(name), method);
    },
    modals: Object.freeze({open: openModal, openAsync: openModalAsync}),
    ui: {showButton: Object.freeze({
      getElement: pcmButton,
      isVisible: () => !!pcmButton() && getComputedStyle(pcmButtonGroup()).display !== 'none',
      show() { forcedVisibility = true; const el = pcmButtonGroup(); if (el) el.style.display = ''; },
      hide() { forcedVisibility = false; const el = pcmButtonGroup(); if (el) el.style.display = 'none'; },
      open: openPcmManager,
      setPosition(next) {
        for (const key of ['top', 'right', 'bottom', 'left', 'transform']) if (typeof next?.[key] === 'string') position[key] = next[key];
        const el = pcmButtonGroup(); if (el) Object.assign(el.style, position);
      },
      setZIndex(next) {
        if (!Number.isFinite(next)) throw new TypeError('zIndex must be a finite number');
        zIndex = next; const el = pcmButtonGroup(); if (el) el.style.zIndex = String(zIndex);
      },
    })},
    translations: {addons: createTranslationApi()},
  };
  Object.defineProperty(api, BRAND, {value: true});
  window.FUSAM = api;
  window.Liko ??= {};
  window.Liko.__PCMFusamCompat__ = Object.freeze({
    api,
    isOwned: () => window.FUSAM === api,
    setAddonState(id, state) {
      if (!id) return;
      if (state == null) delete addons[id];
      else addons[id] = {...state};
    },
    getDebugMethods: () => new Map(debugMethods),
    applyButtonOptions() {
      const el = pcmButtonGroup();
      if (el) {
        Object.assign(el.style, position);
        el.style.zIndex = String(zIndex);
        if (forcedVisibility !== null) el.style.display = forcedVisibility ? '' : 'none';
      }
    },
  });
  return {installed: true, reason: 'missing-fusam', api};
}
