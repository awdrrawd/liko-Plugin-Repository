const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
const pending = [], notices = [];
const result = { isConnected: true, style: {}, textContent: '' };
const ctx = vm.createContext({
    config: { recvLang: 'ja' }, selectionPopup: { style: {} },
    window: { getSelection: () => 'selected' },
    document: { getElementById: () => result },
    stripStutter: text => text, extractCleanMessage: () => 'message',
    ui: key => key, apiHint: error => error, updateClickToolbarStatus() {},
    ChatRoomSendLocal: text => notices.push(text),
    translateChunked: () => new Promise(resolve => pending.push(resolve)),
});
vm.runInContext('const manualTranslationRequests = new WeakMap(); let selectionRequestId = 0;', ctx);
for (const name of ['manualTranslateMessage', 'hideSelectionPopup', 'translateSelectedText']) {
    const start = source.indexOf(`    ${name === 'hideSelectionPopup' ? '' : 'async '}function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n    }', start) + 6), ctx);
}
(async () => {
    const node = { isConnected: true, nextElementSibling: null };
    const old = ctx.manualTranslateMessage(node, 'ja');
    const newer = ctx.manualTranslateMessage(node, 'en');
    pending.shift()({ translated: null, error: 'timeout' });
    await old;
    assert.equal(notices.length, 0, 'superseded result ignored');
    pending.shift()({ translated: null, error: 'timeout' });
    await newer;
    assert.equal(notices.length, 1, 'current manual failure displayed');
    const again = ctx.manualTranslateMessage(node, 'en');
    pending.shift()({ translated: null, error: 'timeout' });
    await again;
    assert.equal(notices.length, 2, 'manual failure not muted');
    const firstSelection = ctx.translateSelectedText('ja');
    const nextSelection = ctx.translateSelectedText('en');
    pending.shift()({ translated: 'old' });
    await firstSelection;
    assert.equal(result.textContent, 'translating');
    pending.shift()({ translated: 'new' });
    await nextSelection;
    assert.equal(result.textContent, '[EN] new');
    const hidden = ctx.translateSelectedText('ja');
    ctx.hideSelectionPopup();
    pending.shift()({ translated: 'hidden' });
    await hidden;
    assert.equal(result.textContent, '', 'closed popup stays cleared');
    console.log('MAT superseded manual/selection results and unmuted manual errors checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
