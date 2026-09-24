const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../Plugins/main');
function read(name) { return fs.readFileSync(path.join(root, `Liko - ${name}.main.user.js`), 'utf8'); }
function hook(name, target, context) {
    const source = read(name);
    const re = new RegExp(`^( +)modApi\\.hookFunction\\(["']${target}["']`, 'm');
    const match = re.exec(source);
    assert.ok(match, `${name}: ${target}`);
    const end = source.indexOf('\n' + match[1] + '});', match.index);
    assert.ok(end > match.index);
    let callback;
    context.modApi = {hookFunction(n, priority, fn) {callback = fn;}};
    vm.runInNewContext(source.slice(match.index, end) + '\n' + match[1] + '});', context);
    return callback;
}
(async () => {
    // Every main script must parse, including plugins without changes.
    const files = fs.readdirSync(root).filter(n => n.endsWith('.js'));
    for (const file of files) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename:file});
    const cases = [
        ['ACV','ChatRoomLoad','ChatRoom'], ['CRA','ChatRoomLoad','ChatRoom'],
        ['Image Uploader','ChatRoomLoad','ChatRoom'], ['CPB','InformationSheetLoad','InformationSheet'],
        ['MPL','ChatSelectLoad','ChatSelect'], ['MPL','ChatSearchLoad','ChatSearch'],
        ['MAT','ChatRoomSync','ChatRoom'],
    ];
    for (const [name,target,screen] of cases) {
        let effects = 0, calls = 0;
        const ctx = {CurrentScreen:screen, console, csActive:true,cshActive:true,
            config:{enabled:true}, setTimeout(){effects++;},requestAnimationFrame(){effects++;},
            setupChatObserver(){effects++;},notifyReady(){effects++;},getCurrentViewingCharacter(){effects++;return {};},stopObserver(){effects++;},
            startObserver(){effects++;},hideClickToolbar(){effects++;}};
        const fn = hook(name,target,ctx);
        let resolve;
        const pending = fn([], () => { calls++; return new Promise(r=>{resolve=r;}); });
        assert.equal(effects,0, `${name}: no work before native load resolves`);
        resolve(42);
        assert.equal(await pending,42);
        assert.equal(calls,1);
        assert.ok(effects>0, `${name}: native load followed by plugin work`);
        effects=0;
        const stale = fn([], () => new Promise(r=>{resolve=r;}));
        ctx.CurrentScreen='Login';resolve(7);
        assert.equal(await stale,7);
        assert.equal(effects,0, `${name}: navigation during load cancels UI work`);
        ctx.CurrentScreen=screen;
        await assert.rejects(fn([],()=>Promise.reject(Error('native load failed'))), /native load failed/);
    }
    // CPB must never retry the native loader when its own post-load step fails.
    let calls=0;
    const cpb=hook('CPB','InformationSheetLoad',{CurrentScreen:'InformationSheet',
        console:{error(){}},getCurrentViewingCharacter(){throw Error('plugin failure');}});
    assert.equal(await cpb([],()=>{calls++;return Promise.resolve(9);}),9);
    assert.equal(calls,1);
    const cdb=read('CDB');
    assert.doesNotMatch(cdb,/CharacterSetActivePose/);
    assert.match(cdb,/PoseSetActive\(target, pose.name\)/);
    for(const name of new Set(cases.map(c=>c[0]).concat('CDB'))) {
        const s=read(name),header=/@version\s+(\S+)/.exec(s)[1];
        assert.equal(/const MOD_VER = ["']([^"']+)/.exec(s)[1],header, `${name}: version metadata`);
    }
    console.log(`${files.length} main scripts parse; R132 async hooks, stale navigation, error propagation and versions passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
