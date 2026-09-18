const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 10000, calls = 0;
const ctx = vm.createContext({
    MOD_VER: 'test', Date: {now: () => now}, queueMicrotask, setTimeout,
    window: {Liko: {}, dispatchEvent() {}}, CustomEvent: class {},
    config: {enabled:true, translateReceived:true, translateSent:true, recvLang:'ja', sendLang:'en'},
    langCodes: ['en','ja','zh-TW'],
    translateGoogle: async (text, lang) => {calls++; return {translated:lang+':'+text, detectedLang:'en'};},
});
vm.runInContext(source.slice(source.indexOf('    const translationCache ='), source.indexOf('    // API 失敗通知器')), ctx);
vm.runInContext('translateQueue.baseInterval = translateQueue.minInterval = translateQueue.maxInterval = 0', ctx);
(async () => {
    const api = ctx.window.Liko.MAT;
    for (const key of ['updateSettings','getSettings','enabled','translateReceived','translateSent']) assert.equal(key in api, false);
    assert.equal((await api.translateReceivedText('hello')).error, 'not_ready');
    vm.runInContext('matSettingsReady = true', ctx);
    const langs = api.getLanguages(); langs.length = 0;
    assert.equal(api.getLanguages().length, 3);
    assert.equal((await api.translateReceivedText('hello')).translated, 'ja:hello');
    now++;
    assert.equal((await api.translateSentText('hello')).translated, 'en:hello');
    assert.equal(calls, 2);
    const history = api.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].targetLang, 'en');
    assert.equal(history[0].expiresAt - history[0].translatedAt, 600000);
    history[0].translated = 'mutated';
    assert.equal(api.getCachedTranslation('hello','en').translated, 'en:hello');
    assert.equal(api.getCachedTranslation('missing','en'), null);
    assert.equal(calls, 2, 'queries never request translation');
    const long = 'a'.repeat(600);
    const result = await api.translate(long, 'ja');
    assert.equal(api.getCachedTranslation(long, 'ja').translated, result.translated);
    ctx.config.sendLang = 'ja';
    assert.equal(api.sendLang, 'ja', 'language getter remains live');
    now += 600000;
    assert.equal(api.getHistory().length, 0);
    assert.equal(api.getCachedTranslation('hello','ja'), null);
    console.log('MAT read-only languages, history, cache-only lookup and translation checks passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
