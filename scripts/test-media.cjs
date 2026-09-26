const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const source = name => fs.readFileSync(path.join(__dirname,`../Plugins/main/Liko - ${name}.main.user.js`),'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL || undefined});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().url()==='https://fixture.test/'
   ? route.fulfill({body:'<!doctype html><body><div id="TextAreaChatLog"></div><textarea id="InputChat"></textarea><button id="choose">Choose</button><div id="message"><a href="https://youtu.be/abcdefghijk">Custom label</a></div></body>',contentType:'text/html'})
   : route.abort());
  await page.goto('https://fixture.test/');
  await page.evaluate(()=>{
   window.CurrentScreen='ChatRoom';window.ChatRoomData={};window.Player={MemberNumber:1,ExtensionSettings:{}};
   window.notices=[];window.ChatRoomSendLocalStyled=(text)=>notices.push(text);
   window.CommandCombine=()=>{};
   window.sent=[];window.ServerSend=(...args)=>sent.push(args);
   window.hooks={};window.bcModSdk={registerMod:()=>({hookFunction:(name,p,fn)=>{(hooks[name]??=[]).push(fn);return ()=>{};}})};
   window.ChatRoomMessageDisplay=()=>{};window.ChatRoomLeave=()=>{};
   window.fetch=async()=>({ok:true,text:async()=>'https://litter.catbox.moe/test.png'});
  });
  await page.addScriptTag({content:source('Image Uploader')});
  await page.waitForFunction(()=>window.Liko?.ImageUploader);
  assert.equal(await page.evaluate(()=>notices.filter(n=>n.includes('載入！')).length),1);
  await page.evaluate(async()=>{for(const fn of hooks.ChatRoomLoad)await fn([],async()=>{});});
  assert.equal(await page.evaluate(()=>notices.filter(n=>n.includes('載入！')).length),1);
  // Exercise this repository's public API directly, without an external consumer.
  assert.equal(await page.evaluate(()=>Liko.ImageUploader.uploadFile(new File(['image'],'test.png',{type:'image/png'}))), 'https://litter.catbox.moe/test.png');
  await page.evaluate(()=>document.querySelector('#choose').onclick=()=>Liko.ImageUploader.chooseImage(url=>{window.uploadResult=url;}));
  const [chooser]=await Promise.all([page.waitForEvent('filechooser'),page.click('#choose')]);
  await chooser.setFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from('test')});
  await page.waitForFunction(()=>window.uploadResult);
  assert.equal(await page.evaluate(()=>uploadResult),'https://litter.catbox.moe/test.png');
  assert.equal(await page.evaluate(()=>sent.length),0);
  assert.equal(await page.inputValue('#InputChat'),'');
  await page.addScriptTag({content:source('ACV')});
  await page.waitForFunction(()=>window.LikoVideoPlayerInstance);
  await page.evaluate(()=>{
   const message=document.querySelector('#message');
   LikoVideoPlayerInstance.processMessage(message);
   LikoVideoPlayerInstance.processMessage(message);
  });
  assert.equal(await page.locator('#message .likoVideoButton').count(),1);
  await page.click('#message .likoVideoButton');
  assert.equal(await page.locator('#message .likoVideoIframe').count(),1);
  // Uguu uses the same native media rendering as Catbox, including file subdomains.
  for (const [url, tag] of [
   ['https://uguu.se/example.mp4', 'video'],
   ['https://a.uguu.se/example.WEBM?download=1#play', 'video'],
   ['https://files.uguu.se/example.mp3#play', 'audio'],
   ['https://files.catbox.moe/example.mp4', 'video'],
  ]) {
   await page.evaluate(url=>{
    document.querySelector('#media-test')?.remove();
    const node=document.createElement('div');node.id='media-test';
    const link=document.createElement('a');link.href=url;link.textContent='Media link';
    node.append(link);document.body.append(node);
    LikoVideoPlayerInstance.processMessage(node);
    LikoVideoPlayerInstance.processMessage(node);
   }, url);
   assert.equal(await page.locator('#media-test .likoVideoButton').count(),1);
   await page.locator('#media-test .likoVideoButton').click();
   assert.equal(await page.locator(`#media-test ${tag}`).getAttribute('src'),url);
  }
  for (const url of ['https://uguu.se/example.png', 'https://uguu.se/example.mp4.exe', 'https://uguu.se.example.org/example.mp4', 'https://notuguu.se/example.mp4']) {
   const count=await page.evaluate(url=>{
    const node=document.createElement('div');node.textContent=url;document.body.append(node);
    LikoVideoPlayerInstance.processMessage(node);
    const count=node.querySelectorAll('.likoVideoButton').length;node.remove();return count;
   },url);
   assert.equal(count,0,url);
  }
  await page.evaluate(()=>LikoVideoPlayerInstance.disable());
  assert.equal(await page.locator('.likoVideoButton,.likoVideoIframe').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Local media API checks passed: notice deduplication, upload callback isolation, video links and cleanup.');
 } finally {await browser.close();}
 assert.doesNotMatch(source('CDB'),/bcxExport|bcxImport|CDB_BCX/);
 const vm=require('node:vm'),cdb=source('CDB');
 const begin=cdb.indexOf('            modApi.hookFunction("AppearanceMenuBuild"');
 const end=cdb.indexOf('\n            });',begin);
 let callback;
 const ctx={modApi:{hookFunction:(name,priority,fn)=>callback=fn},CharacterAppearanceMode:'',
  AppearanceMenu:['Wardrobe','Copy','Paste','Random'],removeColorPickerMenuButtons(){},removeLayeringDOMButtons(){}};
 vm.runInNewContext(cdb.slice(begin,end)+'\n            });',ctx);callback([],()=>{});
 assert.deepEqual(Array.from(ctx.AppearanceMenu),['CDB_Zoom','CDB_Extension','Wardrobe','Copy','Paste']);
})().catch(error=>{console.error(error);process.exitCode=1;});
