const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
class Message {
    constructor(text, display = '') {
        this.textContent = text;
        this.dataset = {};
        this.style = { display };
        const classes = new Set(['ChatMessage']);
        this.classList = { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) };
    }
    querySelector() { return { textContent: this.textContent }; }
}
const nodes = [new Message('[🌐] hello'), new Message('hello [🌐]'), new Message('🔊 hello'), new Message('custom hello'), new Message('[🌐] hidden', 'none')];
const context = vm.createContext({ HTMLElement: Message, config: { filterTranslations: true, filterPrefixes: '[🌐],🔊' }, document: { querySelector: () => ({querySelectorAll: selector => nodes.filter(n => n.classList.contains(selector.slice(1)))}) }, startObserver() {}, stopObserver() {} });
for (const name of ['isPureUrl', 'extractCleanMessage', 'isTranslationMessageNode', 'applyTranslationMessageFilterToNode', 'applyTranslationMessageFilter']) {
    const start = source.indexOf('    function ' + name + '(');
    const end = source.indexOf('\n    }', start) + 6;
    vm.runInContext(source.slice(start, end), context);
}
for (const text of ['https://example.com', '(HTTP://example.com)', '( HTTP://example.com)', '( HTTPS://example.com)', '（ https://example.com）']) assert.equal(context.isPureUrl(text), true, text);
for (const text of ['hello https://example.com', 'HTTP is a protocol', '( hello)']) assert.equal(context.isPureUrl(text), false, text);
context.applyTranslationMessageFilter();
assert.deepEqual(nodes.map(n=>n.style.display), ['none','','none','','none']);
context.config.filterPrefixes = 'custom,, ';
context.applyTranslationMessageFilter();
assert.deepEqual(nodes.map(n=>n.style.display), ['','','','none','none']);
context.config.filterPrefixes = '';
context.applyTranslationMessageFilter();
assert.deepEqual(nodes.map(n=>n.style.display), ['','','','','none']);
context.config.filterPrefixes = '[🌐],🔊';
context.applyTranslationMessageFilter();
context.config.filterTranslations = false;
context.applyTranslationMessageFilter();
assert.deepEqual(nodes.map(n=>n.style.display), ['','','','','none']);
console.log('MAT URL and prefix filter checks passed.');

// Skip-translation rules are independent from visibility filters.
{
    const start = source.indexOf('    function matchesSkipTranslationRule(');
    const end = source.indexOf('\n    }', start) + 6;
    vm.runInContext(source.slice(start, end), context);
    for (const text of ['[🌐] hello', '🔊 hello', '📞 hello', '🎬 hello', 'https://example.com']) assert.equal(context.matchesSkipTranslationRule(text), true, text);
    assert.equal(context.matchesSkipTranslationRule('ordinary message'), false);
    context.config.skipTranslationRules = '';
    assert.equal(context.matchesSkipTranslationRule('🎬 hello'), false);
    assert.equal(context.matchesSkipTranslationRule('https://example.com'), false);
    context.config.skipTranslationRules = 'custom,$url';
    assert.equal(context.matchesSkipTranslationRule('a custom message'), true);
    assert.equal(context.matchesSkipTranslationRule('(https://example.com)'), true);
    assert.equal(context.matchesSkipTranslationRule('🎬 hello'), false);
}

context.config.skipTranslationEnabled = false;
assert.equal(context.matchesSkipTranslationRule('a custom message'), false);
context.config.skipTranslationEnabled = true;
assert.equal(context.matchesSkipTranslationRule('a custom message'), true);
