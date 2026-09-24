import vm from 'node:vm';

// Minimal browser/game boundaries; PCM dependencies, registration, startup and
// initialization remain real. Timers are owned by the harness, never wall-clock.
export function pcmBrowser({loading = true, failStyles = false} = {}) {
  const storage = new Map(), timers = new Map(), intervals = new Map();
  const windowListeners = new Map(), documentListeners = new Map();
  const dictionaries = new Map(), nodes = new Map(), requests = [];
  let sequence = 0, registered = 0, unloaded = 0, callbacks = [];
  let context;
  const add = (map, name, fn) => {
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(fn);
  };
  const remove = (map, name, fn) => {
    map.get(name)?.delete(fn);
    if (!map.get(name)?.size) map.delete(name);
  };
  const document = {
    readyState: loading ? 'loading' : 'complete',
    createElement(tag) {
      if (tag === 'style' && failStyles) throw new Error('UI failed');
      return {tag, dataset: {}, style: {}, textContent: '', remove() { nodes.delete(this.id); }};
    },
    getElementById: id => nodes.get(id) ?? null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: (name, fn) => add(documentListeners, name, fn),
    removeEventListener: (name, fn) => remove(documentListeners, name, fn),
    head: {appendChild(node) {
      if (node.id) nodes.set(node.id, node);
      if (node.tag === 'script' && node.textContent) vm.runInContext(node.textContent, context);
    }},
  };
  const sandbox = {
    console, document, URL, Blob, Response, AbortController, TextDecoder,
    TranslationLanguage: 'EN', CurrentScreen: 'ChatSearch',
    Player: null,
    PreferenceRegisterExtensionSetting() {}, CommandCombine() {},
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
      key: index => [...storage.keys()][index] ?? null,
      get length() { return storage.size; },
    },
    setTimeout: (fn, delay) => { timers.set(++sequence, {fn, delay}); return sequence; },
    clearTimeout: id => timers.delete(id),
    setInterval: (fn, delay) => { intervals.set(++sequence, {fn, delay}); return sequence; },
    clearInterval: id => intervals.delete(id),
    addEventListener: (name, fn) => add(windowListeners, name, fn),
    removeEventListener: (name, fn) => remove(windowListeners, name, fn),
    bcModSdk: {registerMod() {
      registered++;
      callbacks = [];
      return {
        onUnload: fn => callbacks.push(fn),
        unload() { unloaded++; for (const callback of callbacks) callback(); },
      };
    }},
    Liko: {
      __Sys_i18n__: {ensure() {}, register: (id, data) => dictionaries.set(id, data), detectLang: () => 'EN'},
      __Sys_L10N__: {localize() {}}, __Sys_Flags__: {ensure() {}, renderLabel() {}},
      __Sys_Toast__: {}, __Sys_ColorAPI__: {}, __Sys_ChatRoomButtons__: {},
    },
    fetch: async url => {
      requests.push(url);
      return new Response(JSON.stringify({plugins: [{id: 'example', name: 'Example', url: 'https://example.test/plugin.js'}]}));
    },
  };
  sandbox.window = sandbox;
  context = vm.createContext(sandbox);
  return {
    context, storage, timers, intervals, dictionaries, requests, windowListeners,
    get registered() { return registered; }, get unloaded() { return unloaded; },
    set failStyles(value) { failStyles = value; },
    ready() {
      document.readyState = 'complete';
      for (const listener of documentListeners.get('DOMContentLoaded') || []) listener();
      documentListeners.delete('DOMContentLoaded');
    },
    stop() { for (const callback of callbacks) callback(); },
  };
}
