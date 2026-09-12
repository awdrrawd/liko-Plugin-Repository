const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../Plugins/main/Liko - CMC.main.user.js'),'utf8');
function extract(name) {
    const match=new RegExp('    (?:async )?function '+name+'\\(').exec(source);
    assert.ok(match,name);
    const end=source.indexOf('\n    }',match.index);
    return source.slice(match.index,end+'\n    }'.length);
}
function clock() {
    let id=0;const jobs=new Map();
    return {jobs,setTimeout(fn){jobs.set(++id,fn);return id;},clearTimeout(id){jobs.delete(id);},
        setInterval(fn){jobs.set(++id,fn);return id;},clearInterval(id){jobs.delete(id);},
        requestAnimationFrame(fn){jobs.set(++id,fn);return id;},cancelAnimationFrame(id){jobs.delete(id);},
        tick(){const [id,fn]=jobs.entries().next().value;jobs.delete(id);fn();}};
}
(async()=>{
    // Actual full script: stopping before SDK/login must cancel waits and allow reload.
    const timer=clock(),window=new EventTarget(),document=new EventTarget();
    document.getElementById=()=>null;document.querySelectorAll=()=>[];
    const errors=[];
    const sandbox=vm.createContext({window,document,...timer,AbortController,URL,console:{log(){},error(...args){errors.push(args);},warn(){}}});
    for(let i=0;i<2;i++){
        vm.runInContext(source,sandbox);
        window.Liko.CMC.Destroy();
        await Promise.resolve();await Promise.resolve();
        assert.equal(timer.jobs.size,0);
        assert.equal(window.Liko.CMC,undefined);
    }
    assert.equal(errors.length,0);

    // Request success is not commit success. An abort must reject the write.
    let tx;
    const dbCtx=vm.createContext({cmcDB:{transaction(){return tx={objectStore:()=>({put(){}})};}}});
    vm.runInContext(extract('dbPut'),dbCtx);
    let completed=false;
    const write=vm.runInContext("dbPut({id:'x'})",dbCtx).then(()=>{completed=true;});
    await Promise.resolve();assert.equal(completed,false);
    tx.oncomplete();await write;assert.equal(completed,true);
    const failure=vm.runInContext("dbPut({id:'x'})",dbCtx);
    tx.error=Error('quota');tx.onabort();await assert.rejects(failure,/quota/);

    // Open request timing out then succeeding must close the late database.
    const openTimer=clock();let request,closed=0;
    const openCtx=vm.createContext({...openTimer,AbortController,disposed:false,cmcDB:null,indexedDB:{open(){return request={};}}});
    vm.runInContext('const lifecycle=new AbortController();'+extract('initIndexedDB'),openCtx);
    const opening=vm.runInContext('initIndexedDB()',openCtx);
    openTimer.tick();await assert.rejects(opening,/timed out/);
    request.result={close(){closed++;}};request.onsuccess();assert.equal(closed,1);
    assert.equal(openCtx.cmcDB,null);

    // Trusted transport sender and controller/permission checks precede mutations.
    const syncCtx=vm.createContext({Number,URL});
    vm.runInContext(`
        const MAX_TRACKS=500,CONSTANTS={DEFAULT_VOLUME:0.25},disposed=false,Player={MemberNumber:1};
        const musicPlayer={currentPlaylist:[],currentIndex:-1};
        const ChatRoomData={Character:[{MemberNumber:2,OnlineSharedSettings:{cmc:{rank:0}}},{MemberNumber:3,OnlineSharedSettings:{cmc:{rank:1}}}]};
        let updates=0;
        function isSafeMediaURL(url){return url.startsWith('https://')&&url.endsWith('.mp3');}
        function ChatRoomCharacterIsAdmin(){return false;}function getPermission(){return {canPlay:false,canEdit:false};}
        function updatePanelUI(){updates++;}function log(){}function isFirstController(){return false;}
        ${extract('normalizePlaylist')}
        ${extract('handleMusicSync')}
    `,syncCtx);
    const run=code=>vm.runInContext(code,syncCtx);
    run("handleMusicSync({Sender:2,Dictionary:[{From:3,Action:'TrackAdd',Track:{name:'x',url:'https://a/x.mp3'}}]})");
    run("handleMusicSync({Sender:2,Dictionary:[{From:2,Action:'TrackAdd',Track:{name:'x',url:'https://a/x.mp3'}}]})");
    assert.equal(run('musicPlayer.currentPlaylist.length'),0);
    run("handleMusicSync({Sender:3,Dictionary:[{From:3,Action:'TrackAdd',Track:{name:'x',url:'https://a/x.mp3'}}]})");
    assert.equal(run('musicPlayer.currentPlaylist.length'),1);
    assert.throws(()=>run("normalizePlaylist([{name:'x',url:'javascript:bad'}],true)"));

    // Stopping before the delayed audio creation must not start a player.
    const audioTimer=clock();let created=0,resolvePlay;
    const audioCtx=vm.createContext({...audioTimer,Audio:class{constructor(){created++;}play(){return new Promise(resolve=>{resolvePlay=resolve;});}}});
    vm.runInContext(`
        let playbackToken=0,disposed=false;
        const mediaTimers=new Set(), CONSTANTS={LOADING_TIMEOUT:5000};
        const musicPlayer={isLoading:false,isPlaying:false,volume:0.25};
        function isSafeMediaURL(){return true;}function muteBCIfNeeded(){}function log(){}function error(){}function updatePanelUI(){}
        function cleanupBilibiliPlayer(){}function cleanupYouTubePlayer(){}function cleanupAudioPlayer(){}
        ${extract('mediaLater')}
        ${extract('loadAudioTrack')}
        loadAudioTrack('https://a/x.mp3');playbackToken++;
    `,audioCtx);
    audioTimer.tick();assert.equal(created,0);
    vm.runInContext("musicPlayer.isLoading=false;loadAudioTrack('https://a/y.mp3');",audioCtx);
    audioTimer.tick();assert.equal(created,1);
    vm.runInContext('playbackToken++;musicPlayer.isPlaying=false;',audioCtx);
    resolvePlay();await Promise.resolve();await Promise.resolve();
    assert.equal(vm.runInContext('musicPlayer.isPlaying',audioCtx),false);
    console.log('CMC lifecycle, transaction, sync and stale-playback checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
