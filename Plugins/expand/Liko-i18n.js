// ==UserScript==
// @name           Liko - i18n / L10N Engine
// @name:zh        Liko 共用多語引擎（介面 + 聊天在地化）
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        2.0.0
// @description    Shared translation engine for all Liko plugins — UI strings (Liko.i18n) + chat-message localization (Liko.L10N)
// @author         Likolisu
// @grant          none
// ==/UserScript==

// ─────────────────────────────────────────────────────────────────────────────
//  統一多語引擎：同一份 JS 內含兩個子系統，共用語言偵測 / 佔位符 / 字庫載入。
//
//    window.Liko.i18n   介面字串（同步 register + 取字 t(ns,key,vars)）
//    window.Liko.L10N   聊天訊息在地化（送出英文底本 + Dictionary 標記，接收端依己方語言重寫）
//
//  佔位符：具名 {name} 為主，亦相容位置式 {0}{1}（vars 傳陣列時）。
//  字庫可用「單一合併 JS」或「依語言分檔（.js 自註冊 / .json 純資料）」兩種方式載入。
//  語言解析鏈：目前語言 →（TW/CN 互退、再退 ZH）→ EN → 表中任一。
// ─────────────────────────────────────────────────────────────────────────────

(function () {
    'use strict';
    if (typeof window === 'undefined') return;
    window.Liko = window.Liko ?? {};

    const ENGINE_VER = '2.0.0';
    // 已是相同（或更新）版本就跳過，避免重複安裝洗掉別的插件已註冊的字庫
    if (window.Liko.i18n?.version === ENGINE_VER && window.Liko.L10N?.version === ENGINE_VER) return;

    // ── 共用：語言偵測 ────────────────────────────────────────────────────────
    //  優先讀「已持久化」的 BondageClubLanguage —— BC 啟動時 TranslationLanguage 先是
    //  預設 "EN"，稍後才由 TranslationLoad() 覆寫成真正語系，直接信任它會抓到瞬間的 EN。
    //  故：localStorage → TranslationLanguage → 瀏覽器語系 → EN。
    const SUPPORTED = ['TW', 'CN', 'EN', 'JP', 'KR', 'DE', 'FR', 'RU', 'UA'];
    function detectLang() {
        let raw = '';
        try { raw = (typeof localStorage !== 'undefined' && localStorage.getItem('BondageClubLanguage')) || ''; } catch (e) {}
        if (!raw && typeof TranslationLanguage !== 'undefined' && TranslationLanguage) raw = String(TranslationLanguage);
        if (!raw && typeof navigator !== 'undefined') raw = navigator.language || '';

        const low = String(raw).toLowerCase();
        let code = String(raw).toUpperCase().trim();
        // 中文各種寫法歸一：zh / zh-TW / zh-Hant → TW；zh-CN / zh-Hans → CN
        if (code === 'ZH' || low.startsWith('zh')) {
            code = (low.includes('tw') || low.includes('hant')) ? 'TW'
                 : (low.includes('cn') || low.includes('hans')) ? 'CN'
                 : 'TW';
        } else if (code.includes('-')) {
            code = code.split('-')[0];
        }
        return code || 'EN';
    }

    // ── 共用：字庫存取（_bank[realm][ns][key][lang] = string）─────────────────
    //  realm: 'ui' 給 Liko.i18n；'msg' 給 Liko.L10N。兩者隔離但共用同一套函式。
    const _bank = { ui: Object.create(null), msg: Object.create(null) };

    function _register(realm, ns, strings) {
        if (!ns || !strings || typeof strings !== 'object') return;
        const store = _bank[realm];
        store[ns] = store[ns] ?? Object.create(null);
        for (const [key, langs] of Object.entries(strings)) {
            if (!langs || typeof langs !== 'object') continue;
            store[ns][key] = Object.assign(store[ns][key] ?? Object.create(null), langs);
        }
    }
    function _has(realm, ns, key) { return !!_bank[realm][ns]?.[key]; }

    // 語言解析：目前語言 →（TW/CN 互退、再退 ZH）→ EN → 表中任一
    function _pick(entry, lang) {
        if (!entry) return undefined;
        let s = entry[lang];
        if (s == null && (lang === 'TW' || lang === 'CN')) s = entry[lang === 'TW' ? 'CN' : 'TW'] ?? entry.ZH;
        if (s == null) s = entry.ZH;      // 舊字庫可能只有 ZH
        if (s == null) s = entry.EN;
        if (s == null) { const vals = Object.values(entry); s = vals.length ? vals[0] : undefined; }
        return s;
    }

    // 佔位符代入：vars 為物件 → 具名 {name}；vars 為陣列 → 位置式 {0}{1}
    function _subst(str, vars) {
        if (str == null || vars == null) return str;
        let s = String(str);
        if (Array.isArray(vars)) {
            return s.replace(/\{(\d+)\}/g, (m, i) => (vars[+i] == null ? m : String(vars[+i])));
        }
        if (typeof vars === 'object') {
            for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v == null ? '' : String(v));
            return s;
        }
        return s;
    }

    function _resolve(realm, lang, ns, key, vars) {
        const entry = _bank[realm][ns]?.[key];
        if (!entry) return null;
        return _subst(_pick(entry, lang), vars);
    }

    // ── 共用：字庫載入（單一合併 JS / 依語言分檔 .js|.json）───────────────────
    const _loadedUrls = new Set();     // 去重：同一 URL 只抓一次
    function _bust(url) { return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(); }

    // 抓一支 JS 並執行（合併字庫檔會自行呼叫 register 註冊）
    function loadScript(url) {
        if (!url || _loadedUrls.has(url)) return Promise.resolve(false);
        _loadedUrls.add(url);
        return fetch(_bust(url))
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
            .then(code => { if (code && !code.trimStart().startsWith('<')) new Function(code)(); return true; })
            .catch(e => { _loadedUrls.delete(url); console.warn(`🐈‍⬛ [Liko i18n] ⚠️ loadScript ${url}: ${e.message}`); return false; });
    }

    // 抓一支 .json（純資料 { key: "字串" }）並註冊成單一語言
    function _loadJsonLang(realm, ns, lang, url) {
        if (!url || _loadedUrls.has(url)) return Promise.resolve(false);
        _loadedUrls.add(url);
        return fetch(_bust(url))
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => {
                if (data && typeof data === 'object') {
                    const table = {};
                    for (const [k, v] of Object.entries(data)) table[k] = { [lang]: v };
                    _register(realm, ns, table);
                }
                return true;
            })
            .catch(e => { _loadedUrls.delete(url); console.warn(`🐈‍⬛ [Liko i18n] ⚠️ json ${url}: ${e.message}`); return false; });
    }

    // 依語言分檔：只抓「目標語言」與 EN 後備。urlMap = { TW:url, CN:url, EN:url, ... }
    //  forceLang 省略時用 detectLang()；插件有自己的語言選單時可指定要抓的語言。
    //  .json → 當純資料（該檔即該語言）；.js → 自註冊（可含多語，抓來執行即可）
    function _loadLangs(realm, ns, urlMap, forceLang) {
        if (!urlMap || typeof urlMap !== 'object') return Promise.resolve();
        const lang = forceLang || detectLang();
        const wanted = [...new Set([lang, lang === 'CN' ? 'TW' : null, 'EN'].filter(Boolean))];
        const jobs = [];
        for (const code of wanted) {
            const url = urlMap[code];
            if (!url) continue;
            jobs.push(/\.json(\?|$)/i.test(url) ? _loadJsonLang(realm, ns, code, url) : loadScript(url));
        }
        return Promise.all(jobs).then(() => {});
    }

    // ── 對外 API：Liko.i18n（介面字串）────────────────────────────────────────
    //  t(ns, key, vars, forceLang)：forceLang 省略時用 detectLang()；插件有自己的語言
    //  選單（如 HSC/FCM 的 auto/TW/CN/JP…）時，算出語言後以第 4 參數傳入即可，不會污染其他插件。
    function ui_t(ns, key, vars, forceLang) {
        const out = _resolve('ui', forceLang || detectLang(), ns, key, vars);
        if (out == null) { console.warn(`🐈‍⬛ [Liko i18n] missing key: "${ns}/${key}"`); return key; }
        return out;
    }

    window.Liko.i18n = {
        version: ENGINE_VER,
        detectLang,
        register: (ns, strings) => _register('ui', ns, strings),
        has: (ns, key) => _has('ui', ns, key),
        t: ui_t,
        // 字庫載入
        loadScript,                                                          // 單一合併 JS
        loadLangs: (ns, urlMap, lang) => _loadLangs('ui', ns, urlMap, lang), // 依語言分檔（.js/.json）
        // 便捷：不論合併檔或語言分檔，統一入口。spec 為字串 → 合併檔；為物件 → 語言分檔
        ensure: (ns, spec, lang) => (typeof spec === 'string' ? loadScript(spec) : _loadLangs('ui', ns, spec, lang)),
    };

    // ── 對外 API：Liko.L10N（聊天訊息在地化）─────────────────────────────────
    //  送出時 Text 放英文底本（沒裝插件者看到英文），Dictionary 夾帶 { Tag:'Liko_L10N', ns, key, data }。
    //  接收端 hook ChatRoomMessage，偵測標記→用「自己的語言」重寫 Text 後顯示（含自己發的）。
    const L10N_TAG   = 'Liko_L10N';
    const CUSTOM_TAG = 'CUSTOM_SYSTEM_ACTION';
    let _l10nInstalled = false;

    function msg_tl(lang, ns, key, ...args) {
        return _resolve('msg', lang, ns, key, args.length ? args : null);
    }
    function msg_t(ns, key, ...args) { return msg_tl(detectLang(), ns, key, ...args); }

    function msg_send(ns, key, ...args) {
        try {
            if (typeof ServerSend !== 'function') return;
            const base = msg_tl('EN', ns, key, ...args);
            if (base == null) return;
            ServerSend('ChatRoomChat', {
                Type: 'Action',
                Content: CUSTOM_TAG,
                Dictionary: [
                    { Tag: `MISSING TEXT IN "Interface.csv": ${CUSTOM_TAG}`, Text: base },
                    { Tag: L10N_TAG, ns, key: String(key), data: JSON.stringify(args) },
                ],
            });
        } catch (e) {}
    }

    function msg_install(modApi) {
        if (_l10nInstalled || !modApi?.hookFunction) return;
        _l10nInstalled = true;
        try {
            modApi.hookFunction('ChatRoomMessage', 5, (a, next) => {
                const data = a[0];
                try {
                    const dict = data && Array.isArray(data.Dictionary) ? data.Dictionary : null;
                    const d = dict && dict.find(x => x && x.Tag === L10N_TAG && x.key);
                    if (d) {
                        let arr = [];
                        try { const p = JSON.parse(d.data ?? '[]'); if (Array.isArray(p)) arr = p; } catch (e) {}
                        const local = msg_tl(detectLang(), d.ns, d.key, ...arr);
                        if (local != null) {
                            const custom = dict.find(x => x && typeof x.Tag === 'string' && x.Tag.includes(CUSTOM_TAG));
                            if (custom) custom.Text = local; else data.Content = local;
                        }
                    }
                } catch (e) {}
                return next(a);
            });
        } catch (e) { console.warn('🐈‍⬛ [Liko L10N] hook 失敗:', e.message); }
    }

    window.Liko.L10N = {
        version: ENGINE_VER,
        lang: detectLang,
        register: (ns, table) => _register('msg', ns, table),
        has: (ns, key) => _has('msg', ns, key),
        t: msg_t,
        tl: msg_tl,
        send: msg_send,
        install: msg_install,
        loadScript,
        loadLangs: (ns, urlMap, lang) => _loadLangs('msg', ns, urlMap, lang),
        ensure: (ns, spec, lang) => (typeof spec === 'string' ? loadScript(spec) : _loadLangs('msg', ns, spec, lang)),
    };

    // 一併登記到系統 API 註冊表（與 Toast / ColorAPI 同處，便於統一查詢）
    const _sys = (window.Liko.__SystemAPI__ = window.Liko.__SystemAPI__ ?? {});
    _sys.i18n = window.Liko.i18n;
    _sys.L10N = window.Liko.L10N;

    console.log(`🐈‍⬛ [Liko i18n] ✅ engine v${ENGINE_VER} ready (i18n + L10N)`);
})();
