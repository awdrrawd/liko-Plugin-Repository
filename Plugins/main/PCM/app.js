import {PCM_VERSION, STORAGE_KEYS} from './config.js';
import {loadPCMTranslations, isCJK} from './i18n/index.js';
import {createPCMServices} from './services.js';
import {installComponentStyles} from './ui/component-styles.js';

export class PCMApp {
  constructor(options = {}) {
    this.services = createPCMServices(options);
    this.plugins = [];
    this.started = false;
  }

  async start() {
    if (this.started) return this;
    this.started = true;
    const {dependencies, runtime, catalog, storage, loader, account, lifecycle} = this.services;
    installComponentStyles();

    await dependencies.ensureCore();
    await loadPCMTranslations().catch(error => runtime.log('WARN', 'PCM translations failed', {error: String(error?.message || error)}));
    const data = await catalog.load();
    this.plugins = data.plugins;
    this.installApi();
    this.showPreviousError();
    this.installRuntimeErrorTracking();

    await this.loadLocalPlugins();
    lifecycle.timeout(() => void this.loadCustomPlugins(), 5000);
    void account.waitUntilAvailable({signal: this.abortSignal}).then(available => {
      if (available && !lifecycle.disposed) return this.loadAccountPlugins();
    });
    lifecycle.add(() => this.services.notifications.clear());
    runtime.log('INFO', `PCM modular app ${PCM_VERSION} started`, {plugins: this.plugins.length});
    return this;
  }

  get abortSignal() {
    this.abortController ??= new AbortController();
    return this.abortController.signal;
  }

  enabledLocally(plugin) {
    return plugin.altUrl ? plugin.state !== 'off' : Boolean(plugin.enabled);
  }

  async loadLocalPlugins() {
    const enabled = this.plugins.filter(plugin => this.enabledLocally(plugin));
    await this.loadBatch(enabled, 'local');
  }

  async loadAccountPlugins() {
    const {account} = this.services;
    const enabled = this.plugins
      .filter(plugin => account.isEnabled(plugin.id))
      .map(plugin => ({...plugin, accountState: account.get(plugin.id)}));
    await this.loadBatch(enabled, 'account');
  }

  async loadCustomPlugins() {
    const custom = this.services.storage.read(STORAGE_KEYS.customPlugins, []);
    await this.loadBatch(Array.isArray(custom) ? custom.filter(plugin => plugin.enabled) : [], 'custom');
  }

  async loadBatch(plugins, source) {
    for (let index = 0; index < plugins.length; index += 4) {
      const batch = plugins.slice(index, index + 4);
      await Promise.allSettled(batch.map(plugin => this.services.loader.load(plugin, source)));
      if (index + 4 < plugins.length) await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  showPreviousError() {
    const previous = this.services.storage.consume(STORAGE_KEYS.lastPluginError, null);
    if (!previous?.pluginId) return;
    this.services.notifications.show({
      id: 'pcm-previous-error-notif',
      icon: '⚠️',
      title: isCJK() ? '上次插件錯誤' : 'Previous plugin error',
      message: isCJK()
        ? `上次 ${previous.pluginName || previous.pluginId} 插件發生錯誤；若仍持續發生，建議暫時停用。`
        : `${previous.pluginName || previous.pluginId} reported an error last time. If it continues, consider disabling it.`,
      durationMs: 8000,
    });
  }

  installRuntimeErrorTracking() {
    const listener = event => {
      const source = event.filename || event.error?.stack || '';
      const match = [...this.services.loader.sourceRegistry].find(([key]) => source.includes(key));
      if (!match) return;
      const pluginId = match[1];
      const plugin = this.plugins.find(item => item.id === pluginId);
      const message = String(event.error?.message || event.message || 'Runtime error');
      this.services.runtime.update(pluginId, {postLoadError: message});
      this.services.storage.write(STORAGE_KEYS.lastPluginError, {
        pluginId,
        pluginName: plugin?.name || pluginId,
        message: message.slice(0, 500),
        phase: 'runtime',
        time: Date.now(),
      });
    };
    this.services.lifecycle.listen(window, 'error', listener, true);
  }

  installApi() {
    const {runtime, catalog, loader} = this.services;
    window.Liko.PCMApi = Object.freeze({
      apiVersion: 1,
      version: PCM_VERSION,
      list: () => this.plugins.map(plugin => ({
        id: plugin.id,
        name: plugin.name,
        enabled: this.enabledLocally(plugin),
        runtime: runtime.get(plugin.id),
      })),
      getRuntimeState: id => runtime.get(String(id)),
      refreshCatalog: () => catalog.load({allowCache: false}),
      load: id => {
        const plugin = this.plugins.find(item => item.id === id);
        return plugin ? loader.load(plugin, 'local') : Promise.reject(new Error(`Unknown plugin: ${id}`));
      },
      exportDiagnostic: () => JSON.stringify({
        pcmVersion: PCM_VERSION,
        generatedAt: new Date().toISOString(),
        language: window.Liko?.__Sys_i18n__?.detectLang?.() ?? 'EN',
        plugins: runtime.entries(),
        logs: runtime.logs,
      }, null, 2),
    });
  }

  stop() {
    this.abortController?.abort();
    this.services.lifecycle.dispose();
    this.started = false;
  }
}
