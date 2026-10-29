const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('Plugins/main/Liko - MAT.main.user.js', 'utf8');
let now = 1000, saves = 0, mouse = [0, 0];
const draws = [];
const ctx = vm.createContext({
    Date: { now: () => now },
    config: { translateTool: 'google', toolChannels: {google: 'one'}, channelFailover: true },
    selectedTool: () => 'google', toolChannel: () => 'one',
    TRANSLATE_TOOL_IDS: ['google'],
    TRANSLATE_TOOLS: {google: {name: () => 'Google', channels: ['one'], failover: true}},
    TRANSLATE_CHANNELS: {one: {name: () => 'One'}},
    saveSettings: () => saves++, document: {getElementById: () => null},
    MainCanvas: {textAlign: 'center'}, ui: key => key,
    MouseIn: (x,y,w,h) => mouse[0] >= x && mouse[0] < x+w && mouse[1] >= y && mouse[1] < y+h,
    DrawRect: (...args) => draws.push(args), DrawEmptyRect() {},
    DrawText() {}, DrawTextFit() {}, DrawTextWrap() {}, DrawButton() {}, DrawCheckbox() {},
});
const start = source.indexOf('    const matSettingsScreen =');
const end = source.indexOf('\n    };', start) + '\n    };'.length;
vm.runInContext(source.slice(start, end) + '\nglobalThis.screen = matSettingsScreen;', ctx);
const screen = ctx.screen;
function open() { screen.openPanel(); now += 220; screen._panelProgress(); screen._runPanel(1); }
function click(x,y) { mouse = [x,y]; screen.click(); }
function finish() { now += 220; screen._panelProgress(); assert.equal(screen.panel, null); }
for (const position of [[100,100], [800,400]]) {
    open();
    screen.panel.draft.failover = false;
    click(...position);
    assert.equal(screen.panel.state, 'closing', 'background and help clicks cancel');
    assert.equal(ctx.config.channelFailover, true);
    assert.equal(saves, 0);
    finish();
}
open();
click(1400,700);
assert.equal(screen.panel.state, 'open', 'empty panel area stays open');
screen.panel.draft.failover = false;
click(1400,900);
assert.equal(saves, 1);
assert.equal(ctx.config.channelFailover, false);
finish();
assert.ok(draws.some(([x,y,w,h,color]) => x === 1300 && y === 0 && w === 700 && h === 1000 && color === 'White'), 'panel uses BC standard themeable background');
assert.ok(!source.includes('--lce-main'), 'no dependency on LCE CSS variables');
console.log('MAT panel cancellation, save, animation and standard background checks passed.');
