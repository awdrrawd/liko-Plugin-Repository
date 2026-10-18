const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const source = fs.readFileSync(path.join(__dirname, '../Plugins/main/Liko - Chat TtoB.main.user.js'), 'utf8');
const sdk = fs.readFileSync(path.join(__dirname, '../Plugins/expand/bcmodsdk.js'), 'utf8');
(async () => {
    const browser = await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL || undefined});
    try {
        const page = await browser.newPage();
        const errors=[];page.on('pageerror', e=>errors.push(e.message));
        await page.route('**/*', route=>route.request().url()==='https://ctb.test/'
            ? route.fulfill({contentType:'text/html',body:'<!doctype html><body><textarea id="InputChat"></textarea><div id="log"></div></body>'}) : route.abort());
        await page.goto('https://ctb.test/');
        await page.evaluate(() => {
            window.Player={MemberNumber:1};window.CurrentScreen='ChatRoom';
            window.Commands=[{Tag:'help',Description:'<img src=x onerror="globalThis.injected=1">'}];
            window.sent=[];window.notices=[];window.ChatRoomSendLocal=text=>notices.push(text);
            window.ChatRoomLoad=()=>Promise.resolve(42);window.ChatRoomLeave=()=>7;window.LoginResponse=()=>9;
            window.ServerSend=(...args)=>sent.push(args);window.CommonSetScreen=(module,screen)=>{CurrentScreen=screen;};
            window.jobs=new Map();window.loops=new Map();let id=0;
            window.setTimeout=fn=>{jobs.set(++id,fn);return id;};window.clearTimeout=id=>jobs.delete(id);
            window.setInterval=fn=>{loops.set(++id,fn);return id;};window.clearInterval=id=>loops.delete(id);
            window.tick=()=>{for(const fn of [...loops.values()])fn();};
            window.flush=()=>{const pending=[...jobs.values()];jobs.clear();for(const fn of pending)fn();};
            window.message=text=>{const el=document.createElement('div');el.className='chat-room-message-content';el.textContent=text;document.querySelector('#log').append(el);return el;};
            window.originals=[
                '#x" onmouseenter="globalThis.injected=1#',
                '!!<img/src=x/onerror=globalThis.injected=1>',
                '#<img src=x onerror=globalThis.injected=1>#',
                '/help !!hello #Lobby#',
            ];
            originals.forEach(message);
            const mixed=message('/help ');mixed.id='mixed';
            const link=document.createElement('a');link.href='https://example.test/';link.textContent='#Link#';mixed.append(link);
            window.link=link;window.linkClicks=0;link.addEventListener('click',event=>{event.preventDefault();linkClicks++;});
        });
        await page.addScriptTag({content:sdk});
        await page.addScriptTag({content:source});
        assert.equal(await page.evaluate(()=>loops.size),1);
        assert.equal(await page.locator('#log [onmouseenter], #log [onerror], #log img').count(),0);
        await page.locator('#log .likoRoomInChat').first().dispatchEvent('mouseover');
        assert.equal(await page.locator('#likoCommandDescription img').count(),0);
        assert.match(await page.locator('#likoCommandDescription').textContent(),/onmouseenter/);
        await page.locator('#log .likoCommandInChat[data-liko-kind="append"]').first().dispatchEvent('mouseover');
        assert.equal(await page.locator('#likoCommandDescription img').count(),0);
        await page.locator('#log .likoCommandInChat[data-liko-kind="command"]').first().dispatchEvent('mouseover');
        assert.equal(await page.locator('#likoCommandDescription img').count(),0);
        assert.equal(await page.evaluate(()=>window.injected),undefined);
        await page.locator('#log .likoCommandInChat[data-liko-kind="command"]').first().click();
        assert.equal(await page.locator('#InputChat').inputValue(),'/help ');
        await page.locator('#log .likoCommandInChat[data-liko-value="hello"]').click();
        assert.equal(await page.locator('#InputChat').inputValue(),'/help hello');
        await page.locator('#log .likoRoomInChat[data-liko-value="Lobby"]').click();
        assert.deepEqual(await page.evaluate(()=>sent),[['ChatRoomJoin',{Name:'Lobby'}]]);
        await page.locator('#mixed a').click();
        assert.equal(await page.evaluate(()=>linkClicks),1);
        assert.equal(await page.evaluate(()=>link===document.querySelector('#mixed a')),true);
        // Repeated scans don't nest buttons; new text inside an existing message is still processed.
        const count=await page.locator('#log .likoCommandInChat, #log .likoRoomInChat').count();
        await page.evaluate(()=>{tick();tick();});
        assert.equal(await page.locator('#log .likoCommandInChat, #log .likoRoomInChat').count(),count);
        await page.evaluate(()=>{document.querySelector('#mixed').append(document.createTextNode(' !!new'));tick();});
        assert.equal(await page.locator('[data-liko-value="new"]').count(),1);
        await page.evaluate(()=>LikoChatTtoBInstance.disable());
        assert.deepEqual(await page.locator('#log > div').evaluateAll(els=>els.slice(0,4).map(el=>el.textContent)),
            await page.evaluate(()=>originals));
        assert.equal(await page.locator('#log img, #log [onerror], #log [onmouseenter]').count(),0);
        assert.equal(await page.evaluate(()=>loops.size),0);
        await page.evaluate(()=>{LikoChatTtoBInstance.enable();CurrentScreen='ChatRoom';});
        assert.equal(await page.evaluate(()=>ChatRoomLoad()),42);
        assert.equal(await page.evaluate(()=>jobs.size),1);
        await page.evaluate(()=>{ChatRoomLeave();flush();});
        assert.equal(await page.evaluate(()=>notices.length),0);
        await page.evaluate(()=>ChatRoomLoad());
        await page.evaluate(()=>{LikoChatTtoBInstance.disable();flush();});
        assert.equal(await page.evaluate(()=>notices.length),0);
        await page.evaluate(()=>{LikoChatTtoBInstance.enable();});
        await page.evaluate(()=>ChatRoomLoad());
        await page.evaluate(()=>flush());
        assert.equal(await page.evaluate(()=>notices.length),1);
        // Destroy/reload releases the real SDK registration and all local resources.
        await page.evaluate(()=>LikoChatTtoBInstance.destroy());
        assert.equal(await page.evaluate(()=>jobs.size+loops.size),0);
        assert.equal(await page.locator('#likoCommandDescription').count(),0);
        await page.addScriptTag({content:source});
        assert.equal(await page.evaluate(()=>loops.size),1);
        // A pending native load may finish after destroy; it must not resurrect the plugin.
        await page.evaluate(()=>{LikoChatTtoBInstance.destroy();window.ChatRoomLoad=()=>new Promise(resolve=>{window.finishLoad=resolve;});});
        await page.addScriptTag({content:source});
        await page.evaluate(()=>{window.pending=ChatRoomLoad();LikoChatTtoBInstance.destroy();finishLoad(88);});
        assert.equal(await page.evaluate(()=>pending),88);
        assert.equal(await page.evaluate(()=>jobs.size+loops.size),0);
        // Destruction before login cancels initialization and allows a later clean install.
        await page.evaluate(()=>{delete window.Player;});
        await page.addScriptTag({content:source});
        await page.evaluate(()=>{LikoChatTtoBInstance.destroy();window.Player={MemberNumber:1};LoginResponse();});
        assert.equal(await page.locator('#likoCommandDescription').count(),0);
        await page.addScriptTag({content:source});
        assert.equal(await page.evaluate(()=>loops.size),1);
        await page.evaluate(()=>LikoChatTtoBInstance.destroy());
        assert.deepEqual(errors,[]);
        console.log('Chat TtoB: literal text, DOM preservation, buttons, tooltips, restore, async load and SDK unload/reload passed.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
