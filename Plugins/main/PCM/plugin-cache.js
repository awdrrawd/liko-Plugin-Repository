import {STORAGE_KEYS} from './config.js';

const CACHE_SIZE_LIMIT = 3_500_000;

export class PluginCodeCache {
  constructor(storage) {
    this.storage = storage;
    this.store = null;
  }

  load() {
    if (this.store) return this.store;
    const value = this.storage.read(STORAGE_KEYS.pluginCache, {});
    this.store = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    this.migrateLegacyKeys();
    return this.store;
  }

  key(pluginId, distribution, canonicalUrl) {
    return `${pluginId}|${distribution}|${canonicalUrl}`;
  }

  get(pluginId, distribution, canonicalUrl) {
    const store = this.load();
    const key = this.key(pluginId, distribution, canonicalUrl);
    const entry = store[key] ?? store[pluginId];
    if (typeof entry === 'string') return {code: entry, legacy: true};
    return entry?.code ? {...entry, legacy: false} : null;
  }

  set(pluginId, distribution, canonicalUrl, code) {
    const store = this.load();
    const key = this.key(pluginId, distribution, canonicalUrl);
    const now = Date.now();
    store[key] = {
      code,
      url: canonicalUrl,
      distribution,
      hash: hashCode(code),
      cachedAt: now,
      lastSuccessAt: now,
    };
    if (key !== pluginId) delete store[pluginId];
    this.prune();
    return this.storage.write(STORAGE_KEYS.pluginCache, store);
  }

  clear() {
    this.store = {};
    this.storage.remove(STORAGE_KEYS.pluginCache);
  }

  prune(limit = CACHE_SIZE_LIMIT) {
    const store = this.load();
    let serialized = JSON.stringify(store);
    if (serialized.length <= limit) return;
    const oldest = Object.entries(store)
      .filter(([, value]) => value && typeof value === 'object')
      .sort((a, b) => (a[1].lastSuccessAt || a[1].cachedAt || 0) - (b[1].lastSuccessAt || b[1].cachedAt || 0));
    while (serialized.length > limit && oldest.length) {
      delete store[oldest.shift()[0]];
      serialized = JSON.stringify(store);
    }
  }

  migrateLegacyKeys() {
    const prefix = 'pcm_p_';
    const backend = this.storage.backend;
    if (!backend || typeof backend.length !== 'number' || typeof backend.key !== 'function') return;
    const oldKeys = [];
    for (let index = 0; index < backend.length; index++) {
      const key = backend.key(index);
      if (key?.startsWith(prefix)) oldKeys.push(key);
    }
    for (const key of oldKeys) {
      const id = key.slice(prefix.length);
      const value = this.storage.read(key, null);
      const code = typeof value === 'string' ? value : value?.code;
      if (code && !this.store[id]) this.store[id] = code;
      this.storage.remove(key);
    }
    if (oldKeys.length) this.storage.write(STORAGE_KEYS.pluginCache, this.store);
  }
}

export function hashCode(code) {
  let hash = 2166136261;
  for (let index = 0; index < code.length; index++) hash = Math.imul(hash ^ code.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}
