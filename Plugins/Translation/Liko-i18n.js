// ==UserScript==
// @name           Liko - i18n Engine
// @name:zh        Liko 共用多語引擎
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.0.0
// @description    Shared i18n engine for all Liko plugins
// @author         Likolisu
// @grant          none
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.i18n?.version) return;

    const ENGINE_VER = '1.0.0';

    // ── 字庫倉儲 ─────────────────────────────────────────────────────────
    // _store[namespace][key][langCode] = '翻譯字串'
    const _store = Object.create(null);

    // ── 語言偵測 ─────────────────────────────────────────────────────────
    // 優先序：BC TranslationLanguage → localStorage → 瀏覽器語言 → EN
    function detectLang() {
        const raw =
            (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : null) ||
            localStorage.getItem('BondageClubLanguage') ||
            navigator.language?.slice(0, 2).toUpperCase() ||
            'EN';
        const code = String(raw).toUpperCase().trim();
        const ALIAS = { 'ZH': 'TW' };
        return ALIAS[code] ?? code;
    }

    // ── register ─────────────────────────────────────────────────────────
    // 各插件用此函式注入自己的字庫
    // 格式：{ 'key': { TW: '...', EN: '...', JP: '...' }, ... }
    function register(ns, strings) {
        if (!ns || typeof strings !== 'object') return;
        _store[ns] = _store[ns] ?? Object.create(null);
        for (const [key, langs] of Object.entries(strings)) {
            _store[ns][key] = Object.assign(_store[ns][key] ?? Object.create(null), langs);
        }
    }

    // ── t ────────────────────────────────────────────────────────────────
    // 語言 fallback 鏈：當前語言 → CN fallback TW → EN → key 原文
    function t(ns, key, vars) {
        const lang  = detectLang();
        const entry = _store[ns]?.[key];
        if (!entry) {
            console.warn(`[Liko i18n] Missing key: "${ns}/${key}"`);
            return key;
        }
        const FALLBACK = { 'CN': 'TW' };
        let str = entry[lang] ?? entry[FALLBACK[lang]] ?? entry['EN'] ?? key;
        if (vars) {
            for (const [k, v] of Object.entries(vars))
                str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
        return str;
    }

    window.Liko.i18n = { version: ENGINE_VER, register, t, detectLang };
})();
