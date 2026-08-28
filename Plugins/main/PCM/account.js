import {STORAGE_KEYS} from './config.js';

export class AccountSettings {
  constructor({global = window, runtime = null} = {}) {
    this.global = global;
    this.runtime = runtime;
    this.loaded = false;
    this.settings = {};
  }

  async waitUntilAvailable({timeoutMs = 15 * 60 * 1000, intervalMs = 1000, signal = null} = {}) {
    const startedAt = Date.now();
    while (!this.global.Player?.AccountName) {
      if (signal?.aborted || Date.now() - startedAt >= timeoutMs) return false;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    this.reload();
    return true;
  }

  reload() {
    const raw = this.global.Player?.ExtensionSettings?.[STORAGE_KEYS.account];
    try {
      this.settings = raw ? (typeof raw === 'object' ? {...raw} : JSON.parse(raw)) : {};
    } catch (error) {
      this.settings = {};
      this.runtime?.log('WARN', 'Invalid account plugin settings', {error: String(error?.message || error)});
    }
    this.loaded = Boolean(this.global.Player?.AccountName);
    return {...this.settings};
  }

  get(pluginId) {
    return this.settings[pluginId] ?? 'off';
  }

  isEnabled(pluginId) {
    const value = this.get(pluginId);
    return value !== 0 && value !== false && value !== 'off';
  }

  set(pluginId, value) {
    if (value === 0 || value === false || value === 'off' || value == null) delete this.settings[pluginId];
    else this.settings[pluginId] = value === true ? 1 : value;
    return this.save();
  }

  save() {
    const player = this.global.Player;
    if (!player?.ExtensionSettings) return false;
    const compact = {};
    for (const [id, value] of Object.entries(this.settings)) {
      if (value === 1 || value === true) compact[id] = 1;
      else if (value === 'stable' || value === 'beta') compact[id] = value;
    }
    try {
      player.ExtensionSettings[STORAGE_KEYS.account] = JSON.stringify(compact);
      this.global.ServerPlayerExtensionSettingsSync(STORAGE_KEYS.account);
      return true;
    } catch (error) {
      this.runtime?.log('ERROR', 'Account settings sync failed', {error: String(error?.message || error)});
      return false;
    }
  }
}
