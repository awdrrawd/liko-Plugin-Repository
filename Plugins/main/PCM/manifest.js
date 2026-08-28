const SAFE_PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const LOAD_TYPES = new Set(['eval', 'scr', 'mod']);

export function normalizeManifest(data, onWarning = null) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.plugins)) return null;
  const plugins = [];
  const seen = new Set();

  for (const raw of data.plugins) {
    const result = normalizePlugin(raw, seen);
    if (result.plugin) {
      plugins.push(result.plugin);
      seen.add(result.plugin.id);
    } else {
      onWarning?.(result.reason, raw);
    }
  }

  return plugins.length ? {...data, plugins} : null;
}

export function normalizePlugin(raw, seen = new Set()) {
  if (!raw || typeof raw !== 'object') return {plugin: null, reason: 'Plugin entry is not an object'};
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const type = raw.type || 'eval';
  const urls = [raw.url, raw.mirrorUrl, raw.altUrl, raw.altMirrorUrl].filter(Boolean);

  if (!SAFE_PLUGIN_ID.test(id)) return {plugin: null, reason: `Invalid plugin id: ${id || '(missing)'}`};
  if (seen.has(id)) return {plugin: null, reason: `Duplicate plugin id: ${id}`};
  if (!name) return {plugin: null, reason: `Missing plugin name: ${id}`};
  if (!LOAD_TYPES.has(type)) return {plugin: null, reason: `Invalid load type for ${id}: ${type}`};
  if (!raw.url && !raw.inlineCode) return {plugin: null, reason: `Missing source for ${id}`};
  if (!urls.every(url => typeof url === 'string' && /^https:\/\//i.test(url))) {
    return {plugin: null, reason: `Non-HTTPS source for ${id}`};
  }

  return {
    plugin: {
      ...raw,
      id,
      name,
      type,
      priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 5,
    },
    reason: null,
  };
}

export function applySavedSettings(plugins, settings) {
  return plugins.map(plugin => {
    const saved = settings[plugin.id];
    const next = {...plugin};
    if (plugin.altUrl) next.state = saved !== undefined ? saved : 'off';
    else next.enabled = saved !== undefined ? Boolean(saved) : false;
    if (settings[`${plugin.id}_customIcon`]) next.customIcon = settings[`${plugin.id}_customIcon`];
    return next;
  });
}
