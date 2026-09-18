const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
const body = 'It depends what you play. If you play alot of games involving good flow and/or reaction time, it matters a lot';
class Message {
    constructor(text, quote = '', content = true) {
        this.body = text; this.quote = quote; this.content = content;
        this.dataset = { sender: '188120' };
        this.textContent = `22:12:57 188120 ${quote} Celiko: ${text} Reply`;
        this.style = {};
        const classes = new Set(['ChatMessage', 'ChatMessageChat']);
        this.classList = { contains: c => classes.has(c), add: c => classes.add(c) };
    }
    querySelector(selector) {
        if (selector === '.chat-room-message-content') return this.content ? {textContent:this.body} : null;
        if (selector === '.chat-room-sender') return {textContent:this.dataset.sender};
        return null;
    }
    cloneNode() {
        const clone = { textContent: `${this.quote} Celiko: ${this.body}` };
        clone.querySelectorAll = selectors => selectors.includes('.chat-room-message-reply')
            ? [{remove: () => {clone.textContent = `Celiko: ${this.body}`;}}] : [];
        return clone;
    }
}
const calls = [], displayed = [];
const ctx = vm.createContext({
    HTMLElement: Message, TRANSLATE_MARKER: '[MAT]', Player: {MemberNumber:1},
    config: {enabled:true, translateReceived:true, recvLang:'zh-TW', recvFold:false},
    skipZhRecv: () => false, langReadable: () => true,
    smartTranslate: async (text, lang) => {calls.push({text,lang}); return '翻譯正文';},
    createTranslatedDiv: (node, text) => {displayed.push({node,text});},
});
for (const name of ['extractCleanMessage', 'recvGateAllows', 'handleReceivedMessage', 'hasRemoteTranslation', 'findOriginalNode']) {
    const prefix = name === 'handleReceivedMessage' ? 'async ' : '';
    const start = source.indexOf(`    ${prefix}function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n    }', start) + 6), ctx);
}
(async () => {
    for (const quote of ['莉柯莉絲: [🌐] When I play games...', 'Name: [MAT] translation', 'Name: ordinary reply']) {
        const node = new Message(body, quote);
        await ctx.handleReceivedMessage(node);
        assert.equal(calls.at(-1).text, body);
        assert.equal(displayed.at(-1).node, node);
        assert.equal(node.classList.contains('mat-processed'), true);
    }
    assert.equal(calls.length, 3);
    for (const text of ['[🌐] actual translation', '[MAT] actual translation']) {
        await ctx.handleReceivedMessage(new Message(text, 'ordinary quote'));
    }
    assert.equal(calls.length, 3, 'actual translation body still skipped');
    const legacy = new Message(body, 'Name: [🌐] quoted translation', false);
    assert.equal(ctx.extractCleanMessage(legacy), body, 'fallback strips reply block');
    await ctx.handleReceivedMessage(legacy);
    assert.equal(calls.length, 4);
    const original = new Message('original');
    const quoted = new Message(body, 'Name: [🌐] quote');
    original.nextElementSibling = quoted;
    assert.equal(ctx.hasRemoteTranslation(original), false, 'quoted marker is not a remote translation');
    const broadcast = new Message('[🌐] real translation');
    quoted.nextElementSibling = broadcast;
    broadcast.previousElementSibling = quoted;
    assert.equal(ctx.hasRemoteTranslation(original), true);
    assert.equal(ctx.findOriginalNode(broadcast), quoted, 'reply remains an eligible original');
    console.log('MAT Reply body translation, marker isolation, fallback and broadcast pairing checks passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
