const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('Plugins/expand/BC_i18n.js', 'utf8');
const mat = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
const dictionary = fs.readFileSync('Plugins/Translation/MAT-i18n.js', 'utf8');
const timers = new Map();
let timerId = 0, requests = 0, respond;
const context = vm.createContext({
    document: {}, URL,
    window: { Liko: { __Sys_Flags__: {} } }, AbortController,
    console: { log() {}, warn() {} }, setInterval() {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    fetch(...args) { requests++; return respond(...args); },
});
const run = code => vm.runInContext(code, context);
const response = code => ({ ok: true, text: async () => code });
(async () => {
    run(source);
    const engine = context.window.Liko.__Sys_i18n__;
    for (const url of ['https://evil.example/a.js', 'https://cdn.jsdelivr.net/gh/other/repo/a.js', 'https://raw.githubusercontent.com/other/repo/a.js', 'https://user:pass@awdrrawd.github.io/a.js', '/relative.js']) {
        assert.equal(await engine.loadScript(url), false);
    }
    assert.equal(requests, 0, 'untrusted scripts are rejected before fetching');
    const changes = [];
    const unsubscribe = engine.onChange(lang => changes.push(lang));
    context.TranslationLanguage = 'TW';
    assert.equal(engine.refreshLanguage(), true);
    assert.equal(engine.refreshLanguage(), false);
    unsubscribe();
    context.TranslationLanguage = 'EN';
    engine.refreshLanguage();
    assert.deepEqual(changes, ['TW']);
    let release;
    respond = () => new Promise(resolve => { release = resolve; });
    const first = engine.ensure('MAT', 'https://awdrrawd.github.io/test/mat.js');
    const second = engine.ensure('MAT', 'https://awdrrawd.github.io/test/mat.js');
    assert.equal(first, second, 'concurrent callers share completion, not an early success');
    assert.equal(engine.has('MAT', 'prefButton'), false);
    release(response(dictionary));
    assert.equal(await second, true);
    assert.equal(requests, 1);
    assert.equal(engine.has('MAT', 'prefButton'), true);
    assert.equal(await first, true);
    assert.equal(await engine.ensure('MAT', 'https://awdrrawd.github.io/test/mat.js'), true);
    assert.equal(requests, 1, 'completed dictionary is reused');

    for (const invalid of ['', '<html>Unavailable</html>', 'throw new Error("broken script")']) {
        respond = async () => response(invalid);
        assert.equal(await engine.loadScript('https://awdrrawd.github.io/test/retry.js'), false);
    }
    respond = async () => response('window.recovered = true;');
    assert.equal(await engine.loadScript('https://awdrrawd.github.io/test/retry.js'), true);
    assert.equal(context.window.recovered, true);
    respond = async () => ({ ok: false, status: 503 });
    assert.equal(await engine.loadScript('https://awdrrawd.github.io/test/http.js'), false);
    respond = (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const timeout = engine.loadScript('https://awdrrawd.github.io/test/timeout.js');
    [...timers.values()][0]();
    assert.equal(await timeout, false);
    assert.equal(timers.size, 0, 'timers released after success, failure and timeout');

    respond = async () => ({ ok: true, json: async () => ({ greeting: 'Hello' }) });
    await Promise.all([
        engine.loadLangs('one', { EN: 'shared.json' }, 'EN'),
        engine.loadLangs('two', { EN: 'shared.json' }, 'EN'),
        context.window.Liko.__Sys_L10N__.loadLangs('one', { EN: 'shared.json' }, 'EN'),
    ]);
    assert.equal(engine.t('one', 'greeting'), 'Hello');
    assert.equal(engine.t('two', 'greeting'), 'Hello');
    assert.equal(context.window.Liko.__Sys_L10N__.t('one', 'greeting'), 'Hello');
    let hooks = 0;
    const l10n = context.window.Liko.__Sys_L10N__;
    l10n.install({ hookFunction() { throw Error('not ready'); } });
    l10n.install({ hookFunction() { hooks++; } });
    l10n.install({ hookFunction() { hooks++; } });
    assert.equal(hooks, 1, 'failed hook installation may retry, success is deduplicated');

    // Exercise MAT's actual loader against the engine, including mirror fallback and recovery.
    run(mat.slice(mat.indexOf("    const I18N_NS ="), mat.indexOf('    // 取翻譯字串')));
    run(mat.slice(mat.indexOf('    const _EXPAND_BASES ='), mat.indexOf('    // 共用按鈕順序協調器')));
    delete context.window.Liko.__Sys_i18n__;
    delete context.window.Liko.__Sys_L10N__;
    let offline = true;
    const urls = [];
    respond = async url => {
        urls.push(url);
        if (offline || url.includes('cdn.jsdelivr.net')) return response('<html>Unavailable</html>');
        return response(url.endsWith('BC_i18n.js') ? source : dictionary);
    };
    await assert.rejects(run('ensureI18n()'), /bad content/);
    offline = false;
    await Promise.all([run('ensureI18n()'), run('ensureI18n()')]);
    assert.equal(context.window.Liko.__Sys_i18n__.has('MAT', 'prefButton'), true);
    assert.ok(urls.some(url => url.includes('github.io') && url.endsWith('MAT-i18n.js')));
    const count = urls.length;
    await run('ensureI18n()');
    assert.equal(urls.length, count, 'opening UI with a ready dictionary does no network work');
    assert.equal(timers.size, 0);
    console.log('i18n concurrent loading, invalid content, timeout, namespaces, MAT mirrors and recovery passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
