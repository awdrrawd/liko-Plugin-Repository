const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 10000, mode = 'timeout', attempts = 0;
const timers = new Map(), budgets = [], events = [];
let nextId = 0;
const ctx = vm.createContext({
    MOD_VER: source.match(/const MOD_VER = "([^"]+)"/)[1],
    Date: { now: () => now }, queueMicrotask, AbortController, TypeError,
    setTimeout: (fn, ms) => { const id = ++nextId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: id => timers.delete(id), navigator: { onLine: true },
    window: { Liko: {}, dispatchEvent() {} }, CustomEvent: class {}, config: { enabled: true },
    ChatRoomSendLocal() {}, ui() {},
    fetch: async (url, { signal }) => {
        attempts++;
        if (mode === 'timeout') {
            budgets.push([...timers.values()].at(-1).ms);
            return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
                events.push('aborted'); reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            }, { once: true }));
        }
        if (mode === 'invalid') return { ok: true, status: 200, json: async () => [null] };
        if (mode === 'limited') return { ok: false, status: 429 };
        return { ok: true, status: 200, json: async () => [[['translated']], null, 'en'] };
    },
});
vm.runInContext(source.slice(source.indexOf('    const translationCache ='), source.indexOf('    const TRANSLATE_MARKER')), ctx);
const run = code => vm.runInContext(code, ctx);
const flush = () => new Promise(resolve => setImmediate(resolve));
async function tick() {
    assert.equal(timers.size, 1, 'only one active request or throttle timer');
    const [id, timer] = timers.entries().next().value;
    timers.delete(id); now += timer.ms; timer.fn(); await flush();
}
(async () => {
    const api = ctx.window.Liko.MAT;
    const timed = api.translate('timed', 'ja');
    await flush();
    await tick(); await tick(); await tick();
    assert.equal((await timed).error, 'timeout');
    assert.deepEqual(budgets, [3000, 1000, 1000]);
    assert.equal(now, 15000, 'isolated timeout cycle takes 5 seconds without extra waits');
    assert.equal(events.length, 3);
    assert.equal(timers.size, 0);
    assert.equal(run('translationPending.size'), 0);
    assert.equal(run('translationCache.size'), 0);
    mode = 'invalid';
    const invalid = api.translate('invalid', 'ja');
    await flush();
    while (timers.size) await tick();
    assert.equal((await invalid).error, 'invalid_response');
    assert.equal(run('translationCache.size'), 0);
    mode = 'success';
    const success = api.translate('invalid', 'ja');
    await flush(); while (timers.size) await tick();
    assert.equal((await success).translated, 'translated');
    const before = attempts;
    assert.equal((await api.translate('invalid', 'ja')).translated, 'translated');
    assert.equal(attempts, before, 'only valid translation cached');
    mode = 'limited';
    const limited = api.translate('limited', 'ja');
    await flush(); while (timers.size) await tick();
    assert.equal((await limited).error, 'rate_limit');
    assert.equal(run('translateQueue.minInterval'), 2400, '429 retains protective backoff');
    console.log('MAT fetch abort, exact isolated timeout budget, invalid response and rate-limit checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
