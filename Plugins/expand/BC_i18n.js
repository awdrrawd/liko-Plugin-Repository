// ==UserScript==
// @name           Liko - i18n / L10N / Flags Engine
// @name:zh        Liko 共用多語引擎（介面 + 聊天在地化 + 國旗）
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        2.2.0
// @description    Shared UI translations, chat localization and on-demand flags (__Sys_i18n__, __Sys_L10N__, __Sys_Flags__)
// @author         Likolisu
// @include        /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @require        https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @grant          none
// ==/UserScript==

// 統一多語引擎：window.Liko.__Sys_i18n__（介面字串）+ __Sys_L10N__（聊天在地化）。用法見 README-bc-i18n.md

(function () {
    'use strict';
    if (typeof window === 'undefined') return;
    window.Liko = window.Liko ?? {};

    // Flags initializes independently, including when an older translation engine won the race.
    installFlags();
    if (window.Liko.__Sys_i18n__ && window.Liko.__Sys_L10N__) return;   // 防重複載入（先到者勝）
    const ENGINE_VER = '2.2.0';

    function installFlags() {
        if (window.Liko.__Sys_Flags__) return;
        const version = '7.3.2';
        const base = `https://cdn.jsdelivr.net/npm/flag-icons@${version}/flags`;
        const countries = new Set(('ad ae af ag ai al am ao aq ar arab as asean at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cefta cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz eac ec ee eg eh er es-ct es-ga es-pv es et eu fi fj fk fm fo fr ga gb-eng gb-nir gb-sct gb-wls gb gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh-ac sh-hl sh-ta sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt za zm zw').split(' '));
        const languageCountries = Object.freeze({ TW: 'tw', CN: 'cn', EN: 'gb', DE: 'de', FR: 'fr', RU: 'ru', UA: 'ua', JA: 'jp', KO: 'kr', VI: 'vn', ES: 'es', IT: 'it', PT: 'pt', PL: 'pl', NL: 'nl', TR: 'tr', SV: 'se', CS: 'cz', HU: 'hu', RO: 'ro', AR: 'sa', TH: 'th', ID: 'id', MS: 'my' });
        const defaultLanguages = ['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA', 'JA', 'KO', 'VI', 'ES'];
        const cache = new Map();
        const pending = new Map();
        const failures = new Map();
        function spec(country, format = '4:3') {
            const code = String(country ?? '').trim().toLowerCase();
            if (!countries.has(code)) throw new RangeError(`Unknown flag: ${code}`);
            if (!['4:3', '1:1', 'circle'].includes(format)) throw new RangeError(`Unknown flag format: ${format}`);
            const ratio = format === '4:3' ? '4x3' : '1x1';
            return { code, ratio, key: `${version}/${ratio}/${code}` };
        }
        function forLanguage(language) {
            if (typeof language !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(language.trim())) return null;
            return languageCountries[normalizeLang(language)] || null;
        }
        function supports(country) {
            return countries.has(String(country ?? '').trim().toLowerCase());
        }
        function get(country, format) {
            try { return cache.get(spec(country, format).key) || null; } catch { return null; }
        }
        function status(country, format) {
            let key;
            try { key = spec(country, format).key; } catch { return 'unsupported'; }
            return cache.has(key) ? 'ready' : pending.has(key) ? 'loading' : failures.has(key) ? 'error' : 'idle';
        }
        function ensure(country, format = '4:3') {
            let entry;
            try { entry = spec(country, format); } catch (error) { return Promise.reject(error); }
            const { key, ratio, code } = entry;
            if (cache.has(key)) return Promise.resolve(cache.get(key));
            if (pending.has(key)) return pending.get(key);
            const failure = failures.get(key);
            if (failure && Date.now() - failure.time < 5000) return Promise.reject(failure.error);
            const request = (async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 15000);
                try {
                    const response = await fetch(`${base}/${ratio}/${code}.svg`, { signal: controller.signal, credentials: 'omit' });
                    if (!response.ok) throw new Error(`Flag ${code}: HTTP ${response.status}`);
                    const text = await response.text();
                    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
                    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg' || xml.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') throw new Error(`Invalid SVG: ${code}`);
                    // Render only as an image: never inject remote SVG markup into the game DOM.
                    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
                    cache.set(key, url);
                    failures.delete(key);
                    return url;
                } catch (error) {
                    failures.set(key, { time: Date.now(), error });
                    throw error;
                } finally {
                    clearTimeout(timer);
                }
            })();
            pending.set(key, request);
            // Cleanup without creating an unhandled rejecting promise.
            request.then(() => pending.delete(key), () => pending.delete(key));
            return request;
        }
        async function create(country, { format = '4:3', size = 24, alt = '' } = {}) {
            if (!Number.isFinite(size) || size <= 0) throw new RangeError('Flag size must be positive');
            const url = await ensure(country, format);
            const img = document.createElement('img');
            img.src = url;
            img.alt = String(alt);
            img.width = size;
            img.height = format === '4:3' ? Math.round(size * 3 / 4) : size;
            img.style.objectFit = 'cover';
            if (format === 'circle') img.style.borderRadius = '50%';
            return img;
        }
        function preload(languages = defaultLanguages, format = '4:3') {
            return Promise.allSettled(languages.map(language => {
                const country = forLanguage(language);
                return country ? ensure(country, format) : Promise.reject(new RangeError(`No flag for language: ${language}`));
            }));
        }
        const labels = new WeakMap();
        const bitmaps = new Map();
        function parts(text) {
            const match = String(text).match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
            if (!match) return null;
            const country = [...match[0]].map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97)).join('');
            return supports(country) ? { country, emoji: match[0], index: match.index } : null;
        }
        // Set only a dedicated label node, never a React-owned node or a container with controls.
        function renderLabel(element, text) {
            text = String(text);
            const token = {};
            labels.set(element, token);
            element.textContent = text;
            const flag = parts(text);
            if (!flag) return;
            create(flag.country).then(img => {
                img.style.cssText += ';width:1.33em;height:1em;vertical-align:-0.12em;object-fit:cover';
                img.onload = () => {
                    if (labels.get(element) !== token || element.textContent !== text) return;
                    element.replaceChildren(document.createTextNode(text.slice(0, flag.index)), img, document.createTextNode(text.slice(flag.index + flag.emoji.length)));
                };
                // Decode before replacing the visible emoji, including CSP / image load failures.
                if (img.complete && img.naturalWidth) img.onload();
            }).catch(() => {});
        }
        function draw(ctx, country, x, y, width, height) {
            if (!supports(country)) return false;
            const key = String(country).toLowerCase();
            let image = bitmaps.get(key);
            if (!image) {
                image = { pending: true };
                bitmaps.set(key, image);
                create(key).then(img => {
                    const failed = () => { image.failedAt = Date.now(); image.pending = false; };
                    img.onload = () => { image.img = img; image.pending = false; };
                    img.onerror = failed;
                    if (img.complete && img.naturalWidth) img.onload();
                }).catch(() => { image.failedAt = Date.now(); image.pending = false; });
            }
            if (image.img) { ctx.drawImage(image.img, x, y, width, height); return true; }
            if (!image.pending && Date.now() - image.failedAt > 5000) bitmaps.delete(key);
            return false;
        }
        const selects = new WeakMap();
        let closePicker = null;
        function bindSelect(select) {
            if (select.multiple || select.size > 1) return;
            if (selects.has(select)) { selects.get(select)(); return; }
            const original = { backgroundImage: select.style.backgroundImage, backgroundRepeat: select.style.backgroundRepeat,
                backgroundPosition: select.style.backgroundPosition, backgroundSize: select.style.backgroundSize, paddingLeft: select.style.paddingLeft };
            const savedLabels = new Map();
            let sequence = 0;
            let signature = '';
            let selectedNode = null;
            const sync = () => {
                const next = JSON.stringify([select.value, [...select.options].map(o => [o.value, savedLabels.get(o) || o.label])]);
                if (next === signature && selectedNode === select.selectedOptions[0]) return;
                signature = next;
                selectedNode = select.selectedOptions[0];
                const stamp = ++sequence;
                for (const [option, label] of savedLabels) { option.label = label; }
                savedLabels.clear();
                Object.assign(select.style, original);
                const option = select.selectedOptions[0];
                const label = option?.label || '';
                const flag = parts(label);
                if (!flag) return;
                create(flag.country).then(img => {
                    img.onload = () => {
                        if (stamp !== sequence || select.selectedOptions[0] !== option) return;
                        savedLabels.set(option, label);
                        option.label = label.replace(flag.emoji, '').trim();
                        Object.assign(select.style, { backgroundImage: `url("${img.src}")`, backgroundRepeat: 'no-repeat', backgroundPosition: '6px center', backgroundSize: '1.33em 1em', paddingLeft: '1.9em' });
                    };
                    if (img.complete && img.naturalWidth) img.onload();
                }).catch(() => {});
            };
            const open = event => {
                if (select.disabled || ![...select.options].some(o => parts(savedLabels.get(o) || o.label))) return;
                if (event.type === 'keydown' && ![' ', 'Enter', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
                event.preventDefault();
                closePicker?.();
                const rect = select.getBoundingClientRect();
                const menu = document.createElement('div');
                const style = getComputedStyle(select);
                menu.setAttribute('role', 'listbox');
                menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Language');
                menu.style.cssText = `position:fixed;z-index:2147483647;box-sizing:border-box;overflow:auto;max-height:45vh;padding:4px;border:1px solid currentColor;border-radius:6px;box-shadow:0 4px 16px #0008;`;
                Object.assign(menu.style, { left: `${Math.max(4, Math.min(rect.left, innerWidth - Math.max(rect.width, 180) - 4))}px`, top: `${Math.min(rect.bottom + 3, innerHeight * .5)}px`, minWidth: `${Math.min(Math.max(rect.width, 180), innerWidth - 8)}px`, maxWidth: 'calc(100vw - 8px)', background: style.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#222' : style.backgroundColor, color: style.color, font: style.font });
                const controller = new AbortController();
                let removalObserver;
                const close = () => {
                    controller.abort(); removalObserver?.disconnect(); menu.remove();
                    delete select.dataset.likoFlagPicker;
                    select.setAttribute('aria-expanded', 'false');
                    if (closePicker === close) closePicker = null;
                    select.dispatchEvent(new Event('liko-flags-close'));
                };
                closePicker = close;
                select.dataset.likoFlagPicker = 'open';
                select.setAttribute('aria-expanded', 'true');
                const rows = [];
                for (const option of select.options) {
                    const row = document.createElement('button');
                    row.type = 'button'; row.disabled = option.disabled || !!option.parentElement?.disabled;
                    row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(option.selected));
                    row.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:0;text-align:left;padding:7px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;';
                    renderLabel(row, savedLabels.get(option) || option.label);
                    row.onclick = () => { select.value = option.value; sync(); close(); select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); select.focus(); };
                    menu.appendChild(row); if (!row.disabled) rows.push(row);
                }
                menu.onkeydown = e => {
                    const index = rows.indexOf(document.activeElement);
                    if (e.key === 'Escape') { e.preventDefault(); close(); select.focus(); }
                    else if (e.key === 'Tab') close();
                    else if (rows.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                        e.preventDefault(); rows[e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length].focus();
                    }
                };
                document.body.appendChild(menu);
                removalObserver = new MutationObserver(() => { if (!select.isConnected || select.style.display === 'none') close(); });
                removalObserver.observe(document.body, { childList: true, subtree: true });
                removalObserver.observe(select, { attributes: true, attributeFilter: ['style'] });
                (menu.querySelector('[aria-selected="true"]:not(:disabled)') || rows[0])?.focus();
                document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) close(); }, { capture: true, signal: controller.signal });
                window.addEventListener('resize', close, { signal: controller.signal });
                window.addEventListener('scroll', e => { if (!menu.contains(e.target)) close(); }, { capture: true, signal: controller.signal });
            };
            select.addEventListener('pointerdown', open);
            select.addEventListener('keydown', open);
            select.addEventListener('change', sync);
            selects.set(select, sync);
            sync();
        }
        const api = { version: '1.1.0', assetVersion: version, languageCountries, forLanguage, supports,
            has: (country, format) => get(country, format) !== null, get, status, ensure, create, preload, renderLabel, draw, bindSelect };
        window.Liko.__Sys_Flags__ = api;
        // Keep blob URLs alive for the page lifetime; any plugin may still reference them.
        api.ready = preload();
        Object.freeze(api);
    }

    // 語言偵測：localStorage → TranslationLanguage → 瀏覽器語系 → EN（BC 啟動瞬間 TranslationLanguage 尚是預設 "EN"，故 localStorage 優先）
    // 官方預設語系僅作 metadata；引擎不以此限制插件可註冊的語言。
    const OFFICIAL_LANGUAGES = Object.freeze(['TW', 'CN', 'EN', 'DE', 'FR', 'RU', 'UA']);
    function normalizeLang(raw) {
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
        // BC 用國家碼 JP/KR；統一成 ISO 639-1 語言碼 JA/KO（字庫檔名與各插件一致）
        if (code === 'JP') code = 'JA';
        else if (code === 'KR') code = 'KO';
        else if (code === 'UK' || code === 'UKR') code = 'UA';
        // 保留可辨識的語言碼，實際支援度由每個 namespace 已註冊的字庫決定。
        return /^[A-Z]{2,3}$/.test(code) ? code : 'EN';
    }

    function detectLang() {
        let raw = '';
        try { raw = (typeof localStorage !== 'undefined' && localStorage.getItem('BondageClubLanguage')) || ''; } catch {}
        if (!raw && typeof TranslationLanguage !== 'undefined' && TranslationLanguage) raw = String(TranslationLanguage);
        if (!raw && typeof navigator !== 'undefined') raw = navigator.language || '';
        return normalizeLang(raw);
    }

    const _languageListeners = new Set();
    let _lastDetectedLang = detectLang();
    setInterval(() => {
        const next = detectLang();
        if (next === _lastDetectedLang) return;
        _lastDetectedLang = next;
        for (const listener of _languageListeners) {
            try { listener(next); } catch (e) { console.warn('[Liko i18n] language listener failed:', e); }
        }
    }, 2000);
    function onChange(listener) {
        if (typeof listener !== 'function') return () => {};
        _languageListeners.add(listener);
        return () => _languageListeners.delete(listener);
    }

    // ── 共用：字庫存取（_bank[realm][ns][key][lang] = string）─────────────────
    //  realm: 'ui' 給 Liko.__Sys_i18n__；'msg' 給 Liko.__Sys_L10N__。兩者隔離但共用同一套函式。
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
    function _languages(realm, ns) {
        const found = new Set();
        for (const entry of Object.values(_bank[realm][ns] || {})) {
            for (const lang of Object.keys(entry || {})) found.add(normalizeLang(lang));
        }
        return [...found];
    }

    // 語言解析：目前語言 →（TW/CN 互退、再退 ZH）→ EN → 表中任一
    function _pick(entry, lang) {
        if (!entry) return undefined;
        const isCJK = (lang === 'TW' || lang === 'CN');
        let s = entry[lang];
        // CJK 之間互退、再退 ZH（僅 CJK）
        if (s == null && isCJK) s = entry[lang === 'TW' ? 'CN' : 'TW'] ?? entry.ZH;
        // 預設一律退英文 —— 非 CJK 語言缺翻譯時直接看英文，不會退到中文（單字簡單、通用）
        if (s == null) s = entry.EN;
        // 最後手段：表中任一（理論上不該用到；請確保每個 key 都有 EN）
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
        const lang = normalizeLang(forceLang || detectLang());
        const wanted = [...new Set([lang, lang === 'CN' ? 'TW' : null, 'EN'].filter(Boolean))];
        const jobs = [];
        for (const code of wanted) {
            const url = urlMap[code];
            if (!url) continue;
            jobs.push(/\.json(\?|$)/i.test(url) ? _loadJsonLang(realm, ns, code, url) : loadScript(url));
        }
        return Promise.all(jobs).then(() => {});
    }

    // ── 對外 API：Liko.__Sys_i18n__（介面字串）────────────────────────────────────────
    //  t(ns, key, vars, forceLang)：forceLang 省略時用 detectLang()；插件有自己的語言
    //  選單（如 HSC/FCM 的 auto/TW/CN/JP…）時，算出語言後以第 4 參數傳入即可，不會污染其他插件。
    function ui_t(ns, key, vars, forceLang) {
        const out = _resolve('ui', normalizeLang(forceLang || detectLang()), ns, key, vars);
        if (out == null) { console.warn(`🐈‍⬛ [Liko i18n] missing key: "${ns}/${key}"`); return key; }
        return out;
    }

    window.Liko.__Sys_i18n__ = {
        version: ENGINE_VER,
        capabilities: Object.freeze({ json: true, script: true, onChange: true, normalizeLang: true, dynamicLanguages: true }),
        officialLanguages: OFFICIAL_LANGUAGES,
        detectLang,
        normalizeLang,
        onChange,
        register: (ns, strings) => _register('ui', ns, strings),
        has: (ns, key) => _has('ui', ns, key),
        getNamespaceLanguages: ns => _languages('ui', ns),
        t: ui_t,
        // 字庫載入
        loadScript,                                                          // 單一合併 JS
        loadLangs: (ns, urlMap, lang) => _loadLangs('ui', ns, urlMap, lang), // 依語言分檔（.js/.json）
        // 便捷：不論合併檔或語言分檔，統一入口。spec 為字串 → 合併檔；為物件 → 語言分檔
        ensure: (ns, spec, lang) => (typeof spec === 'string' ? loadScript(spec) : _loadLangs('ui', ns, spec, lang)),
    };

    // ── 對外 API：Liko.__Sys_L10N__（聊天訊息在地化）─────────────────────────────────
    //  送出時 Text 放英文底本（沒裝插件者看到英文），Dictionary 夾帶 { Tag:'Liko_L10N', ns, key, data }。
    //  接收端 hook ChatRoomMessage，偵測標記→用「自己的語言」重寫 Text 後顯示（含自己發的）。
    const L10N_TAG   = 'Liko_L10N';
    const CUSTOM_TAG = 'CUSTOM_SYSTEM_ACTION';
    let _l10nInstalled = false;

    function msg_tl(lang, ns, key, ...args) {
        return _resolve('msg', normalizeLang(lang), ns, key, args.length ? args : null);
    }
    function msg_t(ns, key, ...args) { return msg_tl(detectLang(), ns, key, ...args); }

    function msg_localize(data) {
        try {
            const dict = data && Array.isArray(data.Dictionary) ? data.Dictionary : null;
            const d = dict && dict.find(x => x && x.Tag === L10N_TAG && x.key);
            if (!d) return false;
            let arr = [];
            try { const p = JSON.parse(d.data ?? '[]'); if (Array.isArray(p)) arr = p; } catch {}
            const local = msg_tl(detectLang(), d.ns, d.key, ...arr);
            if (local == null) return false;
            const custom = dict.find(x => x && typeof x.Tag === 'string' && x.Tag.includes(CUSTOM_TAG));
            if (custom) custom.Text = local; else data.Content = local;
            return true;
        } catch { return false; }
    }

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
        } catch {}
    }

    function msg_install(modApi) {
        if (_l10nInstalled || !modApi?.hookFunction) return;
        _l10nInstalled = true;
        try {
            modApi.hookFunction('ChatRoomMessage', 5, (a, next) => {
                msg_localize(a[0]);
                return next(a);
            });
        } catch (e) { console.warn('🐈‍⬛ [Liko L10N] hook 失敗:', e.message); }
    }

    window.Liko.__Sys_L10N__ = {
        version: ENGINE_VER,
        capabilities: Object.freeze({ localize: true, install: true, onChange: true, normalizeLang: true, dynamicLanguages: true }),
        officialLanguages: OFFICIAL_LANGUAGES,
        lang: detectLang,
        detectLang,
        normalizeLang,
        onChange,
        register: (ns, table) => _register('msg', ns, table),
        has: (ns, key) => _has('msg', ns, key),
        getNamespaceLanguages: ns => _languages('msg', ns),
        t: msg_t,
        tl: msg_tl,
        send: msg_send,
        localize: msg_localize,
        install: msg_install,
        loadScript,
        loadLangs: (ns, urlMap, lang) => _loadLangs('msg', ns, urlMap, lang),
        ensure: (ns, spec, lang) => (typeof spec === 'string' ? loadScript(spec) : _loadLangs('msg', ns, spec, lang)),
    };

    console.log(`🐈‍⬛ [BC i18n] ✅ v${ENGINE_VER}  loaded (i18n + L10N)`);
})();
