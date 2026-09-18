const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 10000;
const sent = [], releases = [], events = [];
const context = vm.createContext({
    MOD_VER: source.match(/const MOD_VER = "([^"]+)"/)[1],
    Date: { now: () => now }, queueMicrotask, setTimeout,
    window: { Liko: {}, dispatchEvent: event => events.push(event.type) },
    CustomEvent: class { constructor(type) { this.type = type; } },
    config: { enabled: true },
    translateGoogle: (text, lang) => {
        sent.push(text);
        return new Promise(resolve => releases.push(() => resolve({ translated: `${lang}:${text}`, detectedLang: 'en' })));
    },
    isPureUrl: line => line.startsWith('https://'),
    apiErrorNotifier: { notify() {} }, updateBioTranslationDisplay() {},
});
vm.runInContext(source.slice(source.indexOf('    const translationCache ='), source.indexOf('    // API 失敗通知器')), context);
vm.runInContext(source.slice(source.indexOf('    function isBioSkipLine('), source.indexOf('    const BIO_TRANS_ID')), context);
const run = code => vm.runInContext(code, context);
run('translateQueue.baseInterval = translateQueue.minInterval = translateQueue.maxInterval = 0');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function finish() { assert.ok(releases.length); releases.shift()(); await flush(); }
(async () => {
    assert.deepEqual(events, ['liko:mat-ready']);
    const first = run("translateChunked('active-chat', 'ja')");
    await flush();
    const waiting = run("translateChunked('waiting-chat', 'ja')");
    const bio = run("translateBioSmart('bio1\\nbio2\\nhttps://example.com', 'ja', {cancelled:false})");
    assert.equal(run('translateQueue.queue.length'), 3, 'entire Bio queued before first Bio request');
    const manual = run("translateChunked('manual', 'ja', null, 2)");
    now += 60000;
    await finish(); await finish(); await finish(); await finish(); await finish();
    await Promise.all([first, waiting, bio, manual]);
    assert.deepEqual(sent, ['active-chat', 'manual', 'bio1', 'bio2', 'waiting-chat']);
    const api = context.window.Liko.MAT;
    assert.deepEqual(Object.keys(context.window.Liko), ['MAT'], 'MAT exports stay inside plugin namespace');
    assert.equal(api.version, context.MOD_VER);
    assert.equal(api.apiVersion, 1);
    assert.equal(Object.isFrozen(api), true);
    const initialization = source.slice(source.indexOf('    window.Liko ='), source.indexOf('    // MAT 圖示'));
    vm.runInContext(`(() => { ${initialization} })()`, context);
    assert.equal(context.window.Liko.MAT, api, 'duplicate loading preserves published API');
    const cached = await api.translate('bio1', 'ja');
    cached.translated = 'mutated';
    assert.equal((await api.translate('bio1', 'ja')).translated, 'ja:bio1');
    assert.equal((await api.translate(null, 'ja')).error, 'invalid_argument');
    assert.equal((await api.translate('x'.repeat(10001), 'ja')).error, 'text_too_long');
    context.config.enabled = false;
    assert.equal((await api.translate('bio1', 'ja')).error, 'disabled');
    context.config.enabled = true;
    run('globalThis.token = {cancelled:false}');
    const shared = run("translateChunked('shared', 'ja')");
    const cancelBio = run("translateBioSmart('shared\\ncancel-only', 'ja', token)");
    run('token.cancelled = true');
    await flush(); await finish();
    await Promise.all([shared, cancelBio]);
    assert.equal(sent.at(-1), 'shared');
    assert.equal(sent.includes('cancel-only'), false);
    const before = sent.length;
    const longBio = run("translateBioSmart('x'.repeat(10000), 'ja', {cancelled:false})");
    await flush(); await finish();
    await longBio;
    assert.equal(sent.length - before, 1, 'identical chunks within 10,000-character Bio merge');
    assert.equal(run('translationPending.size'), 0);
    const blocker = run("translateChunked('blocker', 'ja')");
    await flush();
    const promotionBio = run("translateBioSmart('priority-bio', 'ja', {cancelled:false})");
    const promotionChat = run("translateChunked('promoted', 'ja')");
    const promoted = api.translate('promoted', 'ja', {priority:'manual'});
    await finish(); await finish(); await finish();
    await Promise.all([blocker, promotionBio, promotionChat, promoted]);
    assert.deepEqual(sent.slice(-3), ['blocker', 'promoted', 'priority-bio'], 'merged manual caller promotes existing request');
    console.log('MAT API/Bio queue checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
