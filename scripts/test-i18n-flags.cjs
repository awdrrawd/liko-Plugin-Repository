const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('Plugins/expand/BC_i18n.js', 'utf8');
let calls = [];
let fail = false;
let now = 0;
let sequence = 0;
const oldI18n = {};
const context = vm.createContext({
    window: { Liko: { __Sys_i18n__: oldI18n, __Sys_L10N__: {} } },
    fetch: async url => { calls.push(url); return { ok: !fail, status: 503, text: async () => '<svg/>' }; },
    DOMParser: class { parseFromString() { return { querySelector: () => null, documentElement: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' } }; } },
    document: { createElement: () => ({ style: {} }) },
    URL: { createObjectURL: () => `blob:flag-${++sequence}` },
    Blob, AbortController, setTimeout, clearTimeout, Date: { now: () => now }, console
});
(async () => {
    vm.runInContext(source, context);
    const flags = context.window.Liko.__Sys_Flags__;
    assert.equal(context.window.Liko.__Sys_i18n__, oldI18n, 'preserve older engine and add flags');
    assert.equal(calls.length, 11);
    assert.ok((await flags.ready).every(result => result.status === 'fulfilled'));
    assert.equal(flags.forLanguage('VI'), 'vn');
    assert.equal(flags.forLanguage('JA'), 'jp');
    assert.equal(flags.forLanguage('EN'), 'gb');
    assert.equal(flags.supports('vi'), true);
    assert.equal(flags.has('TW'), true);
    assert.equal(flags.get('TW'), await flags.ensure('tw'));
    assert.equal(calls.length, 11, 'cached flag does not download again');
    const first = flags.ensure('tw', '1:1');
    assert.equal(first, flags.ensure('TW', 'circle'), 'circle shares pending square request');
    assert.equal(flags.status('tw', 'circle'), 'loading');
    await first;
    const round = await flags.create('tw', { format: 'circle', size: 30, alt: '台灣' });
    assert.equal(round.width, 30);
    assert.equal(round.height, 30);
    assert.equal(round.style.borderRadius, '50%');
    assert.equal(calls.length, 12);
    assert.notEqual(round, await flags.create('tw', { format: 'circle' }), 'each consumer owns its image node');
    vm.runInContext(source, context);
    assert.equal(context.window.Liko.__Sys_Flags__, flags);
    assert.equal(calls.length, 12, 'repeat engine load does not preload again');
    await assert.rejects(flags.ensure('../bad'));
    assert.equal(flags.status('tw', 'bad'), 'unsupported');
    fail = true;
    await assert.rejects(flags.ensure('us'));
    assert.equal(flags.status('us'), 'error');
    const failedCount = calls.length;
    await assert.rejects(flags.ensure('us'));
    assert.equal(calls.length, failedCount, 'failure cooldown');
    fail = false;
    now = 6000;
    await flags.ensure('us');
    assert.equal(flags.status('us'), 'ready');
    // Fresh startup still installs working translations alongside the independent flag service.
    context.setInterval = () => 0;
    delete context.window.Liko.__Sys_i18n__;
    delete context.window.Liko.__Sys_L10N__;
    vm.runInContext(source, context);
    const i18n = context.window.Liko.__Sys_i18n__;
    assert.equal(i18n.version, '2.2.0');
    i18n.register('test', { hello: { EN: 'Hello' } });
    assert.equal(i18n.t('test', 'hello', {}, 'EN'), 'Hello');
    for (const namespace of ['DDT', 'MAT', 'MPL', 'PCM', 'Prank']) {
        vm.runInContext(fs.readFileSync(`Plugins/Translation/${namespace}-i18n.js`, 'utf8'), context);
        assert.ok(i18n.getNamespaceLanguages(namespace).length > 0, `${namespace} dictionary works with 2.2`);
    }
    assert.equal(context.window.Liko.__Sys_Flags__, flags);
    console.log('Flags: preload, deduplication, formats, legacy coexistence, retries passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
