const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../Plugins/main/Liko - CPB.main.user.js'), 'utf8');
function harness() {
  const hooks = {}, queued = [], synced = [], revoked = [], drawn = [];
  let fetches = 0;
  class TestURL extends URL {}
  TestURL.createObjectURL = () => `blob:test-${fetches}`;
  TestURL.revokeObjectURL = url => revoked.push(url);
  class Image { set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); } get src() {return this._src;} }
  const ctx = { console: {log(){},warn(){},error(){}}, URL: TestURL, Image, AbortController, setTimeout, clearTimeout, clearInterval,
    window: {location: {href:'https://game.test/R132/',origin:'https://game.test'}}, document:{querySelector:()=>null},
    Player: {MemberNumber:1, OnlineSharedSettings:{Other:42}, ExtensionSettings:{Other:43}},
    InformationSheetSelection:null, CurrentScreen:'InformationSheet', MainCanvasWidth:2000, MainCanvasHeight:1000,
    MainCanvas:{save(){},restore(){},drawImage(...args){drawn.push(args);}},
    ServerAccountUpdate:{QueueData(data){queued.push(data);}}, ServerPlayerExtensionSettingsSync(key){synced.push(key);},
    fetch:async()=>{fetches++; return {ok:true,blob:async()=>({size:50})};}
  };
  vm.createContext(ctx);
  vm.runInContext(source.replace('    initialize();', `    globalThis.api = {
    getSettings, saveSettings, getCurrentViewingCharacter, loadRemoteBackground, getTargetBackground, cleanup, loadImage,
    setup() { modApi = {hookFunction(name, priority, fn) { globalThis.hooks[name] = fn; }}; setupHooks(); },
    setLocal(image) {customBG=image;}, cache:remoteBackgrounds, pending:pendingRemoteBackgrounds,
    retry:remoteBackgroundRetryAfter, isProfilePage
  };`), Object.assign(ctx, {hooks}));
  return {ctx, api:ctx.api, hooks, queued, synced, revoked, drawn, fetches:()=>fetches};
}
(async()=>{
  const h=harness(), {ctx,api}=h;
  const before=JSON.stringify(ctx.Player);
  assert.equal(api.getSettings().enabled,true);
  assert.equal(JSON.stringify(ctx.Player),before,'reading defaults must not mutate account');
  api.saveSettings({enabled:true,imageUrl:'https://image.test/a.jpg',showRemoteBackground:false});
  assert.equal(h.queued.length,1); assert.deepEqual(h.synced,['CustomProfileBG']);
  assert.equal(ctx.Player.OnlineSharedSettings.Other,42); assert.equal(ctx.Player.ExtensionSettings.Other,43);
  assert.equal(api.getSettings().showRemoteBackground,false);
  ctx.InformationSheetSelection=ctx.Player;
  assert.equal(api.getCurrentViewingCharacter(),ctx.Player);
  const local={src:'local'}; api.setLocal(local); api.setup();
  let forwarded=0;
  const bounds={x:0,y:0,w:2000,h:1000};
  const frame=()=>h.hooks.DrawProcess([],()=>h.hooks.DrawRoomBackground(['https://ubc.test/custom.png',bounds],()=>{forwarded++;}));
  frame(); assert.equal(h.drawn.length,1); assert.equal(h.drawn[0][0],local);
  ctx.CurrentScreen='ChatRoom'; frame(); assert.equal(forwarded,1);
  ctx.CurrentScreen='InformationSheet'; ctx.window.MPA={menuLoaded:true};frame();assert.equal(forwarded,2);
  delete ctx.window.MPA;
  h.hooks.DrawRoomBackground(['Backgrounds/Other.jpg',{x:1,y:0,w:2000,h:1000}],()=>{forwarded++;});
  assert.equal(forwarded,3);
  let rects=0;
  h.hooks.DrawProcess([],()=>{
    h.hooks.DrawRoomBackground(['Backgrounds/UBC.jpg',bounds],()=>{});
    h.hooks.DrawRect([0,0,2000,1000,'var(--main)'],()=>rects++);
  });
  assert.equal(rects,0);
  h.hooks.DrawRect([0,0,2000,1000,'var(--main)'],()=>rects++); assert.equal(rects,1,'overlay guard ends with frame');
  ctx.InformationSheetSelection={MemberNumber:2,OnlineSharedSettings:{CustomProfileBG:{enabled:true,imageUrl:'https://image.test/remote.jpg'}}};
  ctx.Player.ExtensionSettings.CustomProfileBG.showRemoteBackground=true;
  const first=api.loadRemoteBackground('https://image.test/remote.jpg');
  await api.loadRemoteBackground('https://image.test/remote.jpg'); await first;
  assert.equal(h.fetches(),1); assert.equal(api.getTargetBackground(),api.cache.get('https://image.test/remote.jpg'));
  for(let i=0;i<16;i++) await api.loadRemoteBackground(`https://image.test/${i}.jpg`);
  assert.equal(api.cache.size,15); assert.ok(h.revoked.length>=2);
  ctx.fetch=async()=>{throw Error('offline');};
  await api.loadRemoteBackground('https://image.test/broken.jpg');
  assert.ok(api.retry.has('https://image.test/broken.jpg'));
  assert.equal(api.pending.size,0);
  api.cleanup(); assert.equal(api.cache.size,0); assert.equal(api.isProfilePage(),false);
  await assert.rejects(api.loadImage('https://image.test/a.jpg'),/已卸載/);
  const late=harness(); let resolve;
  late.ctx.fetch=()=>new Promise(r=>{resolve=r;});
  const pending=late.api.loadRemoteBackground('https://image.test/late.jpg');late.api.cleanup();
  resolve({ok:true,blob:async()=>({size:1})});await pending;
  assert.equal(late.api.cache.size,0,'unload prevents stale cache writes');
  assert.doesNotMatch(source,/CanvasRenderingContext2D\.prototype/);
  assert.equal((source.match(/saveSettings\(/g)||[]).length,2,'only explicit UI save persists settings');
  console.log('CPB: settings, UBC drawing, frame-scoped overlay, remote loading, LRU, retries and unload passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
