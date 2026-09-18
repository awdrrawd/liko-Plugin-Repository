const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 10000, calls = 0, fail = false;
const context = vm.createContext({
    Date: { now: () => now }, setTimeout: fn => queueMicrotask(fn), queueMicrotask, setInterval() {},
    translateGoogle: async (text, lang) => {
        calls++;
        return fail ? { translated: null, error: 'network' } : { translated: `${lang}:${text}`, detectedLang: 'en' };
    },
});
vm.runInContext(source.slice(source.indexOf('    const translationCache ='), source.indexOf('    // 單筆翻譯字數上限')), context);
vm.runInContext(source.slice(source.indexOf('    const bioCache ='), source.indexOf('    function strHash(')), context);
vm.runInContext('translateQueue.baseInterval = translateQueue.minInterval = translateQueue.maxInterval = 0;', context);
const run = code => vm.runInContext(code, context);
(async () => {
    await Promise.all([run("translateQueue.add('hello', 'zh-TW')"), run("translateQueue.add('hello', 'zh-TW')")]);
    assert.equal(calls, 1, 'concurrent requests merge');
    await run("translateQueue.add('hello', 'zh-TW')");
    assert.equal(calls, 1, 'completed result reused');
    await run("translateQueue.add('hello', 'ja')");
    assert.equal(calls, 2, 'languages isolated');
    now += 600000;
    await run("translateQueue.add('hello', 'zh-TW')");
    assert.equal(calls, 3, 'TTL expires');
    fail = true;
    await run("translateQueue.add('retry', 'ja')");
    fail = false;
    await run("translateQueue.add('retry', 'ja')");
    assert.equal(calls, 7, 'three failed attempts followed by a fresh successful request');
    assert.equal(run('translationPending.size'), 0);
    run('translationCache.clear()');
    for (let i = 0; i < 300; i++) await run(`translateQueue.add('item${i}', 'ja')`);
    await run("translateQueue.add('item0', 'ja')");
    await run("translateQueue.add('new', 'ja')");
    assert.equal(run('translationCache.size'), 300);
    assert.equal(run(`translationCache.has(JSON.stringify(['ja', 'item0']))`), true);
    assert.equal(run(`translationCache.has(JSON.stringify(['ja', 'item1']))`), false);
    for (let i = 0; i < 10; i++) run(`bioCacheSet(${i}, 'ja', 'hash', 'result')`);
    assert.equal(run("bioCacheGet(0, 'ja', 'hash')"), 'result');
    run("bioCacheSet(10, 'ja', 'hash', 'result')");
    assert.equal(run('bioCache.size'), 10);
    assert.equal(run('bioCache.has(1)'), false);
    run("bioCacheSet(0, 'zh-TW', 'hash', 'new result')");
    assert.equal(run('bioCache.size'), 10);
    assert.equal(run("bioCacheGet(0, 'ja', 'hash')"), null);
    assert.equal(run("bioCacheGet(0, 'zh-TW', 'hash')"), 'new result');
    assert.equal(run("bioCacheGet(0, 'zh-TW', 'changed')"), null);
    now += 600000;
    run('pruneTranslationCache(); pruneBioCache();');
    assert.equal(run('translationCache.size'), 0);
    assert.equal(run('bioCache.size'), 0);
    console.log('MAT cache checks passed: reuse, concurrency, language, TTL, retry, LRU and person limits.');
})().catch(error => { console.error(error); process.exitCode = 1; });

