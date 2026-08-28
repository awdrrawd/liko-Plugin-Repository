let translationPromise = null;

export function loadPCMTranslations() {
  translationPromise ??= import('./PCM-i18n.js');
  return translationPromise;
}

export function getLanguage(global = window) {
  return global.Liko?.__Sys_i18n__?.detectLang?.() ?? 'EN';
}

export function isCJK(global = window) {
  const language = getLanguage(global);
  return language === 'TW' || language === 'CN';
}
