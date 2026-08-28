import {STORAGE_KEYS} from './config.js';
import {AccountSettings} from './account.js';
import {PluginCatalog} from './catalog.js';
import {DependencyLoader} from './dependencies.js';
import {Lifecycle} from './lifecycle.js';
import {NotificationStack} from './notification-stack.js';
import {PluginCodeCache} from './plugin-cache.js';
import {PluginLoader} from './plugin-loader.js';
import {RuntimeStore} from './runtime.js';
import {DebouncedDocumentStore, JsonStorage} from './storage.js';

export function createPCMServices({global = window, documentRef = document, storageBackend = localStorage} = {}) {
  const runtime = new RuntimeStore();
  const storage = new JsonStorage(storageBackend, (operation, key, error) => {
    runtime.log('ERROR', `Storage ${operation} failed: ${key}`, {error: String(error?.message || error)});
  });
  const settings = new DebouncedDocumentStore(storage, STORAGE_KEYS.settings);
  const cache = new PluginCodeCache(storage);
  const catalog = new PluginCatalog({storage, settingsStore: settings, runtime, global});
  const loader = new PluginLoader({runtime, cache, documentRef});
  const notifications = new NotificationStack();
  const account = new AccountSettings({global, runtime});
  const dependencies = new DependencyLoader({global, documentRef, runtime});
  const lifecycle = new Lifecycle();
  return {global, document: documentRef, runtime, storage, settings, cache, catalog, loader, notifications, account, dependencies, lifecycle};
}
