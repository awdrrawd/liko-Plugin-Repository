export const PCM_VERSION = '2.2.0';
export const NETWORK_TIMEOUT_MS = 12_000;

export const STORAGE_KEYS = Object.freeze({
  settings: 'BC_PluginManager_Settings',
  account: 'PCMAccount',
  accountConfig: 'PCMConfig',
  pluginCache: 'pcm_plugin_cache',
  jsonCache: 'pcm_json_cache',
  customPlugins: 'pcm_custom_plugins',
  lastPluginError: 'pcm_last_plugin_error',
});

export function getRepositoryBases(global = window) {
  if (global.LikoDevBase) {
    return {
      plugins: [global.LikoDevBase],
      root: [new URL('../', global.LikoDevBase).href],
    };
  }
  return {
    plugins: [
      'https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/',
      'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/',
      'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/',
    ],
    root: [
      'https://awdrrawd.github.io/liko-Plugin-Repository/',
      'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/',
      'https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/',
    ],
  };
}

export function getPluginListUrls(global = window) {
  const {root} = getRepositoryBases(global);
  const timestamp = Date.now();
  return root.map((base, index) => `${base}Plugins.json${index === 0 ? `?timestamp=${timestamp}` : ''}`);
}
