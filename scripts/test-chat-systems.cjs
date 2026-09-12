const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../Plugins/expand', name), 'utf8');
function clock() {
    let id = 0;
    const jobs = new Map();
    return { jobs, setTimeout(fn) { jobs.set(++id, fn); return id; }, clearTimeout(id) { jobs.delete(id); },
        tick() { const [id, fn] = jobs.entries().next().value; jobs.delete(id); fn(); } };
}

// Exercise the real replay functions with deterministic scheduling and room changes.
const freeze = read('BC_ChatScrollFreeze.js');
const replay = freeze.slice(freeze.indexOf('\tfunction flushQueue()'), freeze.indexOf('\n\t/**', freeze.indexOf('\tfunction flushQueue()')));
const capture = freeze.slice(freeze.indexOf('\tfunction captureWhileFrozen('), freeze.indexOf('\n\t/**', freeze.indexOf('\tfunction captureWhileFrozen(')));
const timer = clock();
const ctx = vm.createContext({ ...timer, performance: { now: () => 0 }, console });
vm.runInContext(`
    let messageQueue = [], replayTimer = null, replayLog = null, replaying = false, frozen = false;
    const MAX_PENDING_MESSAGES = 1000, REPLAY_BATCH_SIZE = 40, REPLAY_BUDGET_MS = 8;
    let room = {scrollTop:0, scrollHeight:100}, output = [];
    function getChatLog() { return room; }
    function hideBadge() {} function closeSearchBar() {} function showBadge() {}
    function exitFreezeToLatest() { frozen = false; flushQueue(); }
    ${replay}
    ${capture}
    for(let i=0;i<95;i++) messageQueue.push(()=>output.push(i));
    flushQueue();
`, ctx);
assert.equal(vm.runInContext('output.length', ctx), 40);
vm.runInContext('captureWhileFrozen(()=>output.push(95))', ctx);
while (timer.jobs.size) timer.tick();
assert.deepEqual(Array.from(vm.runInContext('output', ctx)), Array.from({length:96}, (_,i)=>i));
assert.equal(vm.runInContext('replaying', ctx), false);
vm.runInContext('frozen=true; output=[]; for(let i=0;i<1000;i++) captureWhileFrozen(()=>output.push(i));', ctx);
assert.equal(vm.runInContext('frozen', ctx), false);
assert.equal(vm.runInContext('output.length', ctx), 40);
vm.runInContext('room = {};', ctx);
timer.tick();
assert.equal(vm.runInContext('messageQueue.length', ctx), 0);
assert.equal(vm.runInContext('output.length', ctx), 40);
vm.runInContext('messageQueue = Array.from({length:100},()=>()=>output.push(1)); flushQueue(); replayBatch(true);', ctx);
assert.equal(vm.runInContext('messageQueue.length', ctx), 0);
assert.equal(timer.jobs.size, 0);

// Even when the time budget has elapsed, each batch must make progress.
let elapsed = 0;
ctx.performance.now = () => (elapsed += 10);
vm.runInContext('output=[]; messageQueue=Array.from({length:3},(_,i)=>()=>output.push(i)); flushQueue();', ctx);
assert.equal(vm.runInContext('output.length', ctx), 1);
while (timer.jobs.size) timer.tick();
assert.deepEqual(Array.from(vm.runInContext('output', ctx)), [0,1,2]);

// Small DOM stub: assert API lifecycle and placement, not browser layout.
class Element {
    constructor() { this.children=[]; this.style={}; this.dataset={}; this.attributes={}; this.classList={add(){},remove(){}}; }
    setAttribute(k,v) { this.attributes[k]=v; }
    appendChild(el) { el.remove(); this.children.push(el); el.parentNode=this; el.isConnected=true; }
    remove() { if(this.parentNode) this.parentNode.children=this.parentNode.children.filter(el=>el!==this); this.parentNode=null; this.isConnected=false; }
}
const document = { head:new Element(), body:new Element(), createElement:()=>new Element() };
const toastTimer=clock();
const window={};
vm.runInNewContext(read('BC_toast_system.user.js'), {window,document,...toastTimer,requestAnimationFrame:()=>0,cancelAnimationFrame(){}});
const toast=window.ChatRoomSendLocalStyled;
const fixed=toast('fixed',{id:'fixed',y:30,duration:0});
const floating=document.body.children.find(el=>el.textContent==='fixed');
const normal=toast('normal',{id:'save',duration:0});
assert.equal(toast('updated',{id:'save',duration:0}),normal);
assert.equal(document.body.children.find(el=>el.className==='liko-toast-stack').children.length,1);
normal.dismiss();
assert.equal(floating.style.bottom,'30px');
fixed.update('done',{type:'success',style:'card',duration:0});
assert.equal(floating.textContent,'✓ done');
assert.equal(floating.dataset.style,'card');
for(let i=0;i<9;i++) toast(String(i),{duration:0});
assert.equal(document.body.children.find(el=>el.className==='liko-toast-stack').children.length,5);
assert.equal(floating.isConnected,false);
toast.clear();
const updatedDuringFade=toast('working');
toastTimer.tick(); // Fade-out has started but removal has not run yet.
updatedDuringFade.update('complete',{duration:0});
assert.equal(toastTimer.jobs.size,0);
assert.equal(document.body.children.find(el=>el.className==='liko-toast-stack').children[0].textContent,'complete');
updatedDuringFade.dismiss();
toast('expire'); toastTimer.tick(); toastTimer.tick();
assert.equal(document.body.children.find(el=>el.className==='liko-toast-stack').children.length,0);
toast.teardown();
assert.equal(window.ChatRoomSendLocalStyled,undefined);
assert.equal(toastTimer.jobs.size,0);

// Seeding must wait for Player and must not undo a user's later visibility choice.
const crb=read('BC_ChatRoomButtons.js');
const seed=crb.slice(crb.indexOf('    function seedDefaultVisibility('),crb.indexOf('    function saveSettings('));
const seedCtx=vm.createContext({});
vm.runInContext(`let value={seeded:[],hidden:[]}; let saves=0; function settings(){return value} function saveSettings(){saves++} ${seed} seedDefaultVisibility('msg-Send',true);`,seedCtx);
assert.equal(vm.runInContext('saves',seedCtx),0);
vm.runInContext("var Player={}; seedDefaultVisibility('msg-Send',true);",seedCtx);
assert.equal(vm.runInContext("value.hidden.includes('msg-Send')",seedCtx),true);
vm.runInContext("value.hidden=[]; seedDefaultVisibility('msg-Send',true);",seedCtx);
assert.equal(vm.runInContext('value.hidden.length',seedCtx),0);
console.log('Chat system regression checks passed.');
