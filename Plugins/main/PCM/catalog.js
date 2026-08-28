import {getPluginListUrls, STORAGE_KEYS} from './config.js';
import {fetchFirstText} from './network.js';
import {applySavedSettings, normalizeManifest} from './manifest.js';

const CATALOG_TTL = 24 * 60 * 60 * 1000;

export class PluginCatalog {
  constructor({storage, settingsStore, runtime, global = window}) {
    this.storage = storage;
    this.settingsStore = settingsStore;
    this.runtime = runtime;
    this.global = global;
    this.data = null;
    this.sourceUrl = null;
  }

  async load({allowCache = true} = {}) {
    try {
      const result = await fetchFirstText(getPluginListUrls(this.global), {cache: 'no-store'});
      const parsed = JSON.parse(result.text);
      const normalized = normalizeManifest(parsed, (reason, raw) => this.runtime.log('WARN', reason, {id: raw?.id}));
      if (!normalized) throw new Error('No valid plugins in catalog');
      this.sourceUrl = result.url;
      this.storage.write(STORAGE_KEYS.jsonCache, {time: Date.now(), data: normalized});
      return this.apply(normalized);
    } catch (error) {
      this.runtime.log('WARN', 'Catalog network load failed', {error: String(error?.message || error)});
      if (!allowCache) throw error;
      const cached = this.storage.read(STORAGE_KEYS.jsonCache, null);
      if (!cached || Date.now() - Number(cached.time || 0) > CATALOG_TTL) throw error;
      const normalized = normalizeManifest(cached.data, (reason, raw) => this.runtime.log('WARN', reason, {id: raw?.id}));
      if (!normalized) throw error;
      this.sourceUrl = 'cache';
      return this.apply(normalized);
    }
  }

  apply(data) {
    const settings = this.settingsStore.read({});
    const plugins = applySavedSettings(data.plugins, settings)
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
    this.data = {...data, plugins};
    return this.data;
  }

  clearCache() {
    this.storage.remove(STORAGE_KEYS.jsonCache);
  }
}
