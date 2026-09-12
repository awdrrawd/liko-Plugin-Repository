const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../Plugins/main/Liko - '+name+'.main.user.js'), 'utf8');
function section(source, start, end) {
    const a=source.indexOf(start), b=source.indexOf(end,a+start.length);
    assert.ok(a>=0 && b>a, start);
    return source.slice(a,b);
}
const tool=read('Tool'), ddt=read('DDT');
const toolContext=vm.createContext({structuredClone,Date,ServerAppearanceBundle:appearance=>appearance});
vm.runInContext(`
    const UNDO_MAX_PER_CHARACTER=30, UNDO_MAX_CHARACTERS=100, undoHistory={};
    ${section(tool,'    function saveUndoSnapshot(', '    function scanAllCharacters(')}
    const target={MemberNumber:1,Appearance:[]};
    for(let i=0;i<40;i++){target.Appearance=[{Group:'A',Name:String(i)}];saveUndoSnapshot(target,null);}
`,toolContext);
const tr=code=>vm.runInContext(code,toolContext);
assert.equal(tr('undoHistory[1].length'),30);
assert.equal(tr('undoHistory[1][0].bundle[0].Name'),'10');
tr("const frozenPreview=structuredClone(undoHistory[1]); target.Appearance[0].Name='changed';saveUndoSnapshot(target,null);");
assert.equal(tr('frozenPreview[0].bundle[0].Name'),'10');
assert.equal(tr('frozenPreview.at(-1).bundle[0].Name'),'39');
tr("for(let i=2;i<=102;i++)saveUndoSnapshot({MemberNumber:i,Appearance:[{Group:'A'}]},null)");
assert.equal(tr('Object.keys(undoHistory).length'),100);
assert.equal(JSON.stringify(tr("summarizeAppearanceDiff([{Group:'A',Name:'old'},{Group:'B'}],[{Group:'A',Name:'new'},{Group:'C'}])")),JSON.stringify({added:1,removed:1,changed:1}));

const storage=new Map(), jobs=new Map();
let failKey=null, id=0;
const clock={setTimeout(fn){jobs.set(++id,fn);return id;},clearTimeout(id){jobs.delete(id);}};
const context=vm.createContext({
    ...clock, structuredClone, console:{warn(){}}, alert(){},
    localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){if(key===failKey)throw Error('quota');storage.set(key,value);}},
});
vm.runInContext(`
    let disposed=false,penObjects=[],penSel=null,penSeq=1;
    const LS_PEN='objects', DEF_FONT=20,DEF_TEXTCOLOR='#fff',VARIANT={text:{},frame:{},button:{}};
    const T=key=>key;function renderPenPanel(){}
    ${section(ddt,'\tfunction newPenId()', '\tfunction normalizePenObj(')}
    ${section(ddt,'\tfunction normalizePenObj(', '\n\t/** 每個物件')}
    ${section(ddt,"\tconst LS_BACKUP =", '\n\tfunction loadPenObjects(')}
    ${section(ddt,'    function validatePenImport(', '\n\t/** 需求 3')}
`,context);
const run=code=>vm.runInContext(code,context);
const obj={x:10,y:20,w:30,h:40,text:'A'};
context.payload=JSON.stringify([obj]);
assert.equal(run('importPenJSON(payload)'),true);
assert.equal(run('penObjects.length'),1);
assert.equal(storage.get('DDTPenImportBackup'),'[]');
assert.equal(run('importPenJSON(payload)'),true);
assert.equal(run('penObjects.length'),2);
run('stepPenHistory()'); assert.equal(run('penObjects.length'),1);
run('stepPenHistory(true)'); assert.equal(run('penObjects.length'),2);
const before=run('JSON.stringify(penObjects)');
assert.equal(run("importPenJSON('[{\"x\":null,\"y\":0}]','replace')"),false);
assert.equal(run("importPenJSON('[]','replace')"),false);
assert.equal(run('JSON.stringify(penObjects)'),before);
failKey='objects';
assert.equal(run("importPenJSON(payload,'replace')"),false);
assert.equal(run('JSON.stringify(penObjects)'),before);
const undoCount=run('penUndo.length');
assert.equal(run('stepPenHistory()'),false);
assert.equal(run('penUndo.length'),undoCount);
failKey=null;
run("for(let i=0;i<40;i++){penObjects[0].x=i;savePenObjects(true);}");
assert.equal(run('penUndo.length'),30);
run('penObjects[0].x=100;savePenObjects();penObjects[0].x=101;savePenObjects();');
assert.equal(jobs.size,1);
run('flushPenObjects()'); assert.equal(jobs.size,0);
assert.equal(JSON.parse(storage.get('objects'))[0].x,101);
run('restoreImportBackup()');
assert.equal(run('penObjects.length'),2); // Backup from the failed replacement preserves its source.
console.log('TOOL snapshot and DDT transactional history checks passed.');

// Execute each complete script before login, destroy it, then load it again.
// This catches initialization/cleanup wiring errors that isolated helpers cannot.
(async () => {
    for(const [name,source] of [['Tool',tool],['DDT',ddt]]) {
        const jobs=new Map(); let id=0;
        const window=new EventTarget();
        const document=new EventTarget();
        document.getElementById=()=>null;
        document.querySelectorAll=()=>[];
        const errors=[];
        const sandbox=vm.createContext({window,document,AbortController,Event,structuredClone,
            console:{log(){},warn(){},error(...args){errors.push(args);}},
            localStorage:{getItem:()=>null}, Image:class {},
            setTimeout(fn){jobs.set(++id,fn);return id;}, clearTimeout(id){jobs.delete(id);},
            setInterval(fn){jobs.set(++id,fn);return id;},clearInterval(id){jobs.delete(id);},
            requestAnimationFrame(fn){jobs.set(++id,fn);return id;},cancelAnimationFrame(id){jobs.delete(id);},
        });
        for(let round=0;round<2;round++) {
            vm.runInContext(source,sandbox);
            assert.equal(typeof window.Liko[name].Destroy,'function',name);
            window.Liko[name].Destroy();
            await Promise.resolve(); await Promise.resolve();
            assert.equal(jobs.size,0,name+' leaked scheduled work');
            assert.equal(window.Liko[name],undefined);
        }
        assert.equal(errors.length,0,name+' init errors: '+JSON.stringify(errors));
    }
    console.log('Full-script pre-login destroy/reload checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
