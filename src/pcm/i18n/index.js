import {PCM_STRINGS} from './PCM-i18n.js';

export function registerPCMTranslations({global = window, lifecycle, attempt = 0} = {}) {
  if (lifecycle?.disposed) return false;
  const engine = global.Liko?.__Sys_i18n__;
  if (typeof engine?.register === 'function') {
    engine.register('PCM', PCM_STRINGS);
    return true;
  }
  if (lifecycle && attempt < 100) {
    lifecycle.timeout(() => registerPCMTranslations({global, lifecycle, attempt: attempt + 1}), 100);
  }
  return false;
}

export function translatePCM(key, vars = {}, language, global = window) {
  const engine = global.Liko?.__Sys_i18n__;
  if (typeof engine?.t === 'function') return engine.t('PCM', key, vars, language);
  const strings = PCM_STRINGS[key];
  const text = strings?.[language || getLanguage(global)] ?? strings?.EN ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] == null ? match : String(vars[name]));
}

export function getLanguage(global = window) {
  return global.Liko?.__Sys_i18n__?.detectLang?.() ?? 'EN';
}

export function isCJK(global = window) {
  return ['TW', 'CN'].includes(getLanguage(global));
}
