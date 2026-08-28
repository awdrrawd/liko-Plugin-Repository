import {NETWORK_TIMEOUT_MS} from './config.js';
import {fetchFirstText, fetchText, isJavaScriptText} from './network.js';

const OWN_RAW = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/';
const OWN_PAGES = 'https://awdrrawd.github.io/liko-Plugin-Repository/';

export function buildSourceUrls(url, mirrorUrl = null) {
  return [...new Set([...expandSourceUrl(url), ...expandSourceUrl(mirrorUrl)].filter(Boolean))];
}

export function expandSourceUrl(url) {
  if (!url) return [];
  if (url.startsWith(OWN_RAW)) {
    const relative = url.slice(OWN_RAW.length);
    return [
      `${OWN_PAGES}${relative}${relative.includes('?') ? '&' : '?'}timestamp=${Date.now()}`,
      `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${relative}`,
      url,
    ];
  }
  if (url.startsWith(OWN_PAGES)) {
    const relative = url.slice(OWN_PAGES.length).split('?')[0];
    return [
      `${OWN_PAGES}${relative}?timestamp=${Date.now()}`,
      `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${relative}`,
      `${OWN_RAW}${relative}`,
    ];
  }
  const cdn = url.replace(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/,
    'https://cdn.jsdelivr.net/gh/$1/$2@$3/$4',
  );
  return cdn !== url ? [cdn, url] : [url];
}

export class PluginLoader {
  constructor({runtime, cache, documentRef = document}) {
    this.runtime = runtime;
    this.cache = cache;
    this.document = documentRef;
    this.loaded = new Set();
    this.pending = new Map();
    this.sourceRegistry = new Map();
  }

  load(plugin, source = 'local') {
    if (this.loaded.has(plugin.id)) return Promise.resolve(this.runtime.get(plugin.id));
    if (this.pending.has(plugin.id)) return this.pending.get(plugin.id);
    const promise = this.loadOnce(plugin, source).finally(() => this.pending.delete(plugin.id));
    this.pending.set(plugin.id, promise);
    return promise;
  }

  async loadOnce(plugin, source) {
    const canonicalUrl = activePluginUrl(plugin, source);
    const distribution = plugin.altUrl && canonicalUrl === plugin.altUrl ? 'beta' : 'stable';
    const loadType = normalizeLoadType(plugin.type);
    const mirror = distribution === 'beta' ? (plugin.altMirrorUrl || plugin.mirrorUrl) : plugin.mirrorUrl;
    const urls = buildSourceUrls(canonicalUrl, mirror);
    this.runtime.update(plugin.id, {status: 'loading', source, loadType, distribution, canonicalUrl});

    try {
      if (plugin.inlineCode && !canonicalUrl) {
        this.injectInline(plugin.id, plugin.inlineCode);
      } else if (loadType === 'eval') {
        await this.loadEval(plugin, urls, canonicalUrl, distribution);
      } else if (loadType === 'scr') {
        const loadedUrl = await this.loadScriptSources(plugin.id, urls, 'text/javascript');
        this.runtime.update(plugin.id, {loadedUrl});
      } else {
        const loadedUrl = await this.loadModuleSources(plugin.id, urls);
        this.runtime.update(plugin.id, {loadedUrl});
      }
      this.loaded.add(plugin.id);
      const current = this.runtime.get(plugin.id);
      return this.runtime.update(plugin.id, {status: current.status === 'cached' ? 'cached' : 'loaded'});
    } catch (error) {
      return Promise.reject(Object.assign(error instanceof Error ? error : new Error(String(error)), {
        runtime: this.runtime.update(plugin.id, {status: 'failed', error: String(error?.message || error)}),
      }));
    }
  }

  async loadEval(plugin, urls, canonicalUrl, distribution) {
    const cached = this.cache.get(plugin.id, distribution, canonicalUrl);
    try {
      const result = await fetchFirstText(urls, {cache: 'no-store'}, isJavaScriptText);
      this.injectInline(plugin.id, result.text);
      this.cache.set(plugin.id, distribution, canonicalUrl, result.text);
      this.runtime.update(plugin.id, {loadedUrl: result.url});
    } catch (networkError) {
      if (!cached?.code) throw networkError;
      this.injectInline(plugin.id, cached.code);
      this.runtime.update(plugin.id, {status: 'cached', loadedUrl: cached.url || canonicalUrl});
    }
  }

  injectInline(pluginId, code) {
    if (!isJavaScriptText(code)) throw new Error('Received HTML or empty JavaScript');
    const script = this.document.createElement('script');
    script.dataset.plugin = pluginId;
    script.textContent = `${code}\n//# sourceURL=pcm-plugin-${pluginId}.js`;
    this.document.head.appendChild(script);
    this.sourceRegistry.set(`pcm-plugin-${pluginId}.js`, pluginId);
  }

  async loadScriptSources(pluginId, urls, type) {
    const errors = [];
    for (const url of urls) {
      try {
        await this.injectExternal(pluginId, url, type);
        this.sourceRegistry.set(url, pluginId);
        return url;
      } catch (error) { errors.push(error); }
    }
    throw new AggregateError(errors, `All ${type} sources failed`);
  }

  async loadModuleSources(pluginId, urls) {
    const errors = [];
    for (const url of urls) {
      try {
        await import(url);
        this.sourceRegistry.set(url, pluginId);
        return url;
      } catch (directError) {
        try {
          const {response, text} = await fetchText(url, {cache: 'no-store'});
          if (!response.ok || !isJavaScriptText(text)) throw new Error(`HTTP ${response.status}`);
          const blobUrl = URL.createObjectURL(new Blob([`${text}\n//# sourceURL=liko-plugin://${pluginId}`], {type: 'text/javascript'}));
          try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
          this.sourceRegistry.set(url, pluginId);
          return url;
        } catch (blobError) { errors.push(directError, blobError); }
      }
    }
    throw new AggregateError(errors, 'All module sources failed');
  }

  injectExternal(pluginId, url, type) {
    return new Promise((resolve, reject) => {
      const script = this.document.createElement('script');
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error(`Timeout after ${NETWORK_TIMEOUT_MS}ms`));
      }, NETWORK_TIMEOUT_MS);
      script.dataset.plugin = pluginId;
      script.type = type;
      script.src = url;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(new Error(`Script load failed: ${url}`)); };
      this.document.head.appendChild(script);
    });
  }
}

export function normalizeLoadType(type) {
  return type === 'mod' || type === 'scr' ? type : 'eval';
}

export function activePluginUrl(plugin, source = 'local') {
  const state = source === 'account' ? plugin.accountState : plugin.state;
  return plugin.altUrl && state === 'beta' ? plugin.altUrl : plugin.url;
}
