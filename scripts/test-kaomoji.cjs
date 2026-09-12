const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../Plugins/main/Liko - Kaomoji.main.user.js'), 'utf8');
function extract(name) {
    const match = new RegExp('        (?:async )?function ' + name + '\\(').exec(source);
    assert.ok(match, name);
    const end = source.indexOf('\n        }', match.index);
    return source.slice(match.index, end + '\n        }'.length);
}
const functions = ['validEmotes', 'validGroups', 'loadGroups', 'loadRecent', 'mergeImportedGroups', 'importGroups', 'insertToChat', 'listen', 'waitUntil'].map(extract).join('\n');
const storage = new Map();
let failWrites = false;
let uuid = 0;
let alerts = 0;
const context = vm.createContext({
    console: {warn(){}}, AbortController, Event, EventTarget, setTimeout, clearTimeout,
    crypto: {randomUUID:()=>String(++uuid)},
    window: {alert(){alerts++;}},
    localStorage: {getItem:key=>storage.get(key) ?? null, setItem(key,value){if(failWrites) throw Error('full'); storage.set(key,value);}},
});
vm.runInContext(`
    let _destroyed=false, _loaded=true, _data={}, groups=[], saves=0;
    const RESERVED_GROUP_IDS=new Set(['all']), STORAGE_GROUPS='groups', STORAGE_RECENT='recent', RECENT_MAX=30;
    const lifecycle=new AbortController();
    function saveData(){saves++;} function renderTabs(){} function renderGrid(){} function t(key){return key;}
    let value='', autoSend=false, autoClose=false, sent=0, recent=[];
    const input={selectionStart:0,selectionEnd:0,focus(){},setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},dispatchEvent(){}};
    const document={getElementById:()=>input};
    function ElementValue(id,next){if(next!==undefined)value=next;return value;}
    function recordRecent(text){recent.push(text);} function closePanel(){} function ChatRoomSendChat(){sent++;}
    ${functions}
`, context);
const run = code => vm.runInContext(code, context);

(async () => {
    assert.equal(run("validGroups([{id:'all',name:'bad',emotes:[]},{id:'g',name:'A',emotes:['x','x',null]},{id:'g',name:'duplicate',emotes:[]},{id:'bad',name:'bad'}]).length"), 1);
    assert.equal(run("validGroups([{id:'g',name:'A',emotes:['x','x',null]}])[0].emotes.length"), 1);
    run("_data={groups:[{id:'g',name:'A',emotes:['x']}],recent:['x']};");
    failWrites=true;
    run('groups=loadGroups();loadRecent();');
    assert.equal(run("'groups' in _data && 'recent' in _data"),true);
    failWrites=false;
    run('loadGroups();loadRecent();');
    assert.equal(run("'groups' in _data || 'recent' in _data"),false);
    assert.equal(storage.has('groups'),true);

    const file={size:100,text:async()=>JSON.stringify({format:'liko-kaomoji',version:1,groups:[{name:'A',emotes:['x','y']},{name:'B',emotes:['z']}]})};
    context.file=file;
    await run('importGroups(file)');
    assert.equal(run('groups.length'),2);
    assert.equal(run("groups[0].emotes.join(',')"),'x,y');
    const saved=storage.get('groups');
    failWrites=true;
    await run('importGroups(file)');
    assert.equal(storage.get('groups'),saved);
    assert.equal(alerts,1);
    failWrites=false;
    assert.throws(()=>run("mergeImportedGroups(groups,{format:'liko-kaomoji',version:1,groups:[{name:'broken',emotes:[3]}]})"));

    run("value='hello world';input.selectionStart=6;input.selectionEnd=11;insertToChat(':)');");
    assert.equal(run('value'),'hello :)');
    assert.equal(run('input.selectionStart'),8);
    run("value='ab';input.selectionStart=1;input.selectionEnd=1;insertToChat('X');");
    assert.equal(run('value'),'a Xb');

    const pending=run('waitUntil(()=>false)');
    run('const target=new EventTarget();let hits=0;listen(target,"test",()=>hits++);target.dispatchEvent(new Event("test"));');
    run('_destroyed=true;lifecycle.abort();target.dispatchEvent(new Event("test"));');
    assert.equal(await pending,false);
    assert.equal(run('hits'),1);
    console.log('Kaomoji data, caret and lifecycle checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
