const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 0;
const timers = [], sent = [], notices = [], timeouts = [], failures = [];
const ctx = vm.createContext({
    MOD_VER: source.match(/const MOD_VER = "([^"]+)"/)[1],
    Date: { now: () => now }, queueMicrotask,
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
    window: { Liko: {}, dispatchEvent() {} }, CustomEvent: class {},
    config: { enabled: true },
    translateGoogle: async (text, lang, timeout) => {
        sent.push(text);
        timeouts.push(timeout);
        if (text === 'bad') return new Promise(resolve => failures.push(() => resolve({ translated: null, error: 'network', detectedLang: null })));
        if (text === 'recover' && sent.filter(x => x === text).length < 2) throw new Error('timeout');
        return { translated: text, detectedLang: 'en' };
    },
    ChatRoomSendLocal: text => notices.push(text),
    ui: (key, vars) => `${key}:${vars.hint}`, apiHint: reason => reason,
});
vm.runInContext(source.slice(source.indexOf('    const translationCache ='), source.indexOf('    // 單次請求逾時')), ctx);
const run = code => vm.runInContext(code, ctx);
run('translateQueue.baseInterval = translateQueue.minInterval = translateQueue.maxInterval = 0');
const flush = () => new Promise(resolve => setImmediate(resolve));
async function failAttempt() {
    assert.ok(failures.length);
    failures.shift()(); await flush();
}
(async () => {
    const bad = ctx.window.Liko.MAT.translate('bad', 'ja');
    await flush();
    assert.equal(sent.length, 1);
    const duplicate = ctx.window.Liko.MAT.translate('bad', 'ja');
    const good = ctx.window.Liko.MAT.translate('good', 'ja');
    await failAttempt();
    assert.equal((await good).translated, 'good');
    assert.deepEqual(sent, ['bad', 'good', 'bad'], 'retry joins tail and allows normal work');
    await failAttempt(); await failAttempt();
    assert.equal((await bad).error, 'network');
    assert.equal((await duplicate).error, 'network');
    assert.equal(sent.filter(x => x === 'bad').length, 3);
    assert.equal(timers.length, 0, 'no fourth attempt');
    assert.deepEqual(timeouts.filter((_, i) => sent[i] === 'bad'), [3000, 1000, 1000]);
    const recover = ctx.window.Liko.MAT.translate('recover', 'ja');
    await flush();
    assert.equal((await recover).translated, 'recover');
    assert.equal(timers.length, 0, 'success stops retries');
    run("apiErrorNotifier.notify('network'); apiErrorNotifier.notify('timeout')");
    assert.equal(notices.length, 1);
    now += 299999;
    run("apiErrorNotifier.notify('network')");
    assert.equal(notices.length, 1);
    assert.equal((await ctx.window.Liko.MAT.translate('during-cooldown', 'ja')).translated, 'during-cooldown');
    now++;
    run("apiErrorNotifier.notify('timeout')");
    assert.equal(notices.length, 2);
    // Manual callers retain their own error paths rather than the automatic notifier.
    for (const name of ['manualTranslateMessage', 'translateSelectedText']) {
        const start = source.indexOf(`    async function ${name}(`);
        const body = source.slice(start, source.indexOf('\n    }', start));
        assert.ok(body.includes('null, 2)'));
        assert.ok(body.includes("ui('translateFail'"));
        assert.ok(!body.includes('apiErrorNotifier'));
    }
    console.log('MAT 3/1/1 attempt budgets, retry fairness and notification cooldown checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
