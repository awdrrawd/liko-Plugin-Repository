// Browser regression tests with isolated game fixtures: no account or server is contacted.
// npm install --no-save playwright, or provide NODE_PATH to an existing installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'liko-tool-ui-'));
const source = fs.readFileSync(path.join(__dirname, '../Plugins/main/Liko - Tool.main.user.js'), 'utf8');
const instrumented = source.replace("    initialize().catch(error => { console.error('[LT] Initialization failed:', error); destroy(); });", `
    window.testTool = { showToolPanel, hideToolPanel, phoneBack, createPanel, popPage, requestItemSelection,
        openCraftTargetPicker, openSingleCraftEditor, requestButtons, requestCharacter, openUndoPanel, saveUndoSnapshot,
        setupHooks, setupFreeHandsHooks, toolPreviewZone, drawToolCharacter, toolCharacterCanvasOffset, toolLockPreview, craftForEdit, getES, saveES, setRpMode, fullLock, heightLockCommand, heightFixCommand,
        initializeStorage, t, LANG, get pages() { return phonePages; }, get timers() { return intervals.size; },
        setApi(api) { modApi = api; } };
`);
(async () => {
    const browser = await chromium.launch({ headless: true, channel: process.env.TOOL_TEST_BROWSER || 'msedge' });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 820 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('https://tool.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="background:#242735"></body></html>' }));
        await page.goto('https://tool.test/');
        // Match BC's global canvas styling: previews must override it locally.
        await page.addStyleTag({content:'canvas{padding:0;margin:auto;outline:none;display:block;top:0;bottom:0;left:0;right:0;position:absolute;width:100%}@media(min-aspect-ratio:2/1){canvas{width:unset;height:100%}}'});
        await page.evaluate(() => {
            window.TranslationLanguage = 'EN'; window.CurrentScreen = 'ChatRoom'; window.CurrentCharacter = null;
            window.Player = { MemberNumber: 1, Name: 'Tester', AccountName: 'Online-1', AssetFamily: 'Female3DCG',
                Appearance: [], ExtensionSettings: {}, OnlineSharedSettings: {}, HeightRatio: .65, HeightModifier: 140,
                IsPlayer: () => true, IsKneeling: () => false, CanInteract: () => false, IsRestrained: () => true, CanChangeOwnClothes: () => false };
            window.ChatRoomCharacter = [Player]; window.ChatRoomData = { Name: 'Fixture' };
            const characterCanvas = document.createElement('canvas'); characterCanvas.width=500; characterCanvas.height=1850;
            const ctx=characterCanvas.getContext('2d');ctx.fillStyle='#b7a0d0';ctx.fillRect(180,800,140,760);Player.Canvas=characterCanvas;
            window.CanvasUpperOverflow=700;window.CanvasDrawHeight=1850;
            const segmentCanvas=document.createElement('canvas');
            window.bcModSdk={getModsInfo:()=>window.echoInstalled?[{name:'echo-clothing-ext',repository:'https://github.com/SugarChain-Studio/echo-clothing-ext'}]:[]};
            window.DrawCanvasSegment=(source,left,top,width,height)=>{
                segmentCanvas.width=width;segmentCanvas.height=height;
                segmentCanvas.getContext('2d').drawImage(source,left,top,width,height,0,0,width,height);
                return segmentCanvas;
            };
            window.CharacterAppearanceXOffset=(C,r)=>500*(1-r)/2;
            window.CharacterAppearanceYOffset=(C,r)=>1000*(1-r)-C.HeightModifier*r;
            window.CharacterAppearsInverted=C=>!!C.inverted;
            window.DrawImageEx=()=>{throw Error('Previews must not enter screen-coordinate DrawImageEx hooks');};
            window.AssetGroup = ['ItemArms','ItemLegs','ItemFeet'].map((Name, i) => ({ Name, Description: Name, Zone: [[160,200+i*220,180,160]], IsItem: () => true }));
            Player.Appearance = AssetGroup.slice(0,2).map((Group,i) => ({ Asset: { Group, Name:'Fixture'+i, Description:'Item '+i }, Color:['Red'],
                Craft: { Name:'Original '+i, Description:'Keep me', Private:true, MemberNumber:99, MemberName:'Other', Effects:{Large:1}, ItemProperty:{OverridePriority:7}, TypeRecord:{a:1}, Color:'Blue' } }));
            window.InventoryGet = (C, group) => C.Appearance.find(item => item.Asset.Group.Name === group);
            window.InventoryGroupIsBlocked = () => false;
            window.ServerChatRoomGetAllowItem = () => true;
            window.ChatRoomCharacterUpdate = () => { window.updateCount = (window.updateCount || 0) + 1; };
            window.ServerAppearanceBundle = items => items.map(item => ({Group:item.Asset.Group.Name, Name:item.Asset.Name}));
            window.ServerBundledItemToAppearanceItem = (family,b) => ({Asset:{Name:b.Name,Group:AssetGroup.find(g=>g.Name===b.Group)}});
            window.CharacterCreate = () => ({ ID: 88, Canvas: characterCanvas, HeightRatio:1, HeightModifier:0 }); window.CharacterDelete = () => { window.deletedPreviews=(window.deletedPreviews||0)+1; }; window.CharacterRefresh = () => {};
            window.CharacterType = { NPC: 1 };
            window.DrawCharacter = () => { throw Error('Previews must not call DrawCharacter: it writes to MainCanvas'); };
            window.DialogGetCharacterZone = (C,zone,x,y,zoom,ratio) => [x+(500*(1-ratio)/2+zone[0]*ratio)*zoom,y+(1000*(1-ratio)-C.HeightModifier*ratio+zone[1]*ratio)*zoom,zone[2]*zoom*ratio,zone[3]*zoom*ratio];
            window.LZString = {compressToBase64:s=>btoa(unescape(encodeURIComponent(s))),decompressFromBase64:s=>decodeURIComponent(escape(atob(s)))};
            window.CommonClipboardWrite = (value, callback) => {window.exported = value;callback({err:false});};
            window.ChatRoomSendLocalStyled = () => {};
            window.ServerSend = () => {}; window.Command = [];
        });
        await page.addScriptTag({content:instrumented});
        await page.evaluate(() => {testTool.initializeStorage();testTool.showToolPanel();});
        const panel = page.locator('#lt-quick-panel'); await panel.waitFor({state:'visible'});
        assert.equal(await panel.getByRole('button',{name:'←',exact:true}).count(),0);
        const gear = panel.locator('.ltq-hdr button[title="Edit feature order and visibility"]');
        assert.equal(await gear.locator('svg').getAttribute('viewBox'),'0 0 100 100');
        assert.equal(await gear.locator('svg').getAttribute('fill'),'currentColor');
        await gear.click();
        const firstAction = panel.locator('.ltq-action').first(); const firstId = await firstAction.getAttribute('data-menu-id');
        await firstAction.locator('.ltq-delete').click();
        assert.match(await firstAction.getAttribute('class'),/ltq-hidden-feature/);
        assert.equal(await firstAction.locator('.ltq-delete').getAttribute('aria-pressed'),'false');
        const toggle = panel.locator('.ltq-toggle').first(); const toggleId = await toggle.getAttribute('data-menu-id');
        await toggle.locator('.ltq-delete').click(); await gear.click();
        assert.equal(await panel.locator(`.ltq-action[data-menu-id="${firstId}"]`).count(),0);
        assert.equal(await panel.locator(`.ltq-toggle[data-menu-id="${toggleId}"]`).isVisible(),false);
        // Restore hidden entries and drag both kinds using pointer events.
        await gear.click(); await panel.locator(`.ltq-action[data-menu-id="${firstId}"] .ltq-delete`).click();
        await panel.locator(`.ltq-toggle[data-menu-id="${toggleId}"] .ltq-delete`).click();
        async function drag(selector) {
            const rows = panel.locator(selector); const from = await rows.nth(0).locator('.ltq-delete').boundingBox(), to = await rows.nth(1).boundingBox();
            await page.mouse.move(from.x+12,from.y+from.height/2); await page.mouse.down();
            await page.waitForTimeout(450);
            await page.mouse.move(to.x+12,to.y+to.height/2,{steps:8}); await page.mouse.up();
        }
        const visibilityBefore=await page.evaluate(()=>JSON.stringify(testTool.getES().menuLayout.hidden));
        await drag('.ltq-action'); await drag('.ltq-toggle');
        assert.equal(await page.evaluate(()=>JSON.stringify(testTool.getES().menuLayout.hidden)),visibilityBefore);
        const circle=panel.locator('.ltq-action .ltq-delete').first();
        const circleBox=await circle.boundingBox();
        // Long hold without movement and a quick swipe must not toggle visibility.
        await page.mouse.move(circleBox.x+9,circleBox.y+9);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();
        assert.equal(await page.evaluate(()=>JSON.stringify(testTool.getES().menuLayout.hidden)),visibilityBefore);
        await page.mouse.move(circleBox.x+9,circleBox.y+9);await page.mouse.down();await page.mouse.move(circleBox.x+28,circleBox.y+9);await page.mouse.up();
        assert.equal(await page.evaluate(()=>JSON.stringify(testTool.getES().menuLayout.hidden)),visibilityBefore);
        // A cancelled long press must also suppress its eventual click.
        await circle.evaluate(el=>el.addEventListener('pointerdown',e=>{window.cancelPointerId=e.pointerId;},{once:true}));
        await page.mouse.move(circleBox.x+9,circleBox.y+9);await page.mouse.down();await page.waitForTimeout(450);
        await circle.evaluate(el=>el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:window.cancelPointerId})));
        await page.mouse.up();
        assert.equal(await page.evaluate(()=>JSON.stringify(testTool.getES().menuLayout.hidden)),visibilityBefore);
        // The next short click remains usable after suppressed drag clicks.
        await circle.click();assert.equal(await circle.getAttribute('aria-pressed'),'false');
        await panel.locator('.ltq-action .ltq-delete').first().click();
        await gear.click();
        const persisted = await page.evaluate(() => ({ actions:Player.ExtensionSettings.LikoTOOL.buttonOrder,layout:Player.ExtensionSettings.LikoTOOL.menuLayout }));
        assert.notEqual(persisted.actions[0],firstId); assert.notEqual(persisted.layout.toggles[0],toggleId);
        // Native zone scale invariants and descriptor preservation across unusual heights/poses.
        const geometry = await page.evaluate(() => {
            const before = Object.getOwnPropertyDescriptors(Player);
            testTool.heightLockCommand();
            const values = [.4,.8,1,1.4].map(ratio => testTool.toolPreviewZone({HeightRatio:ratio,HeightModifier:140},[100,200,180,160]));
            return {values, height:Player.HeightRatio,modifier:Player.HeightModifier, getter:!!Object.getOwnPropertyDescriptor(Player,'HeightRatio').get};
        });
        geometry.values.forEach(rect => {assert.equal(rect[2],180);assert.equal(rect[3],160);});
        assert.equal(geometry.height,.65); assert.equal(geometry.modifier,140); assert.equal(geometry.getter,false);
        // Both representations share a selection set; cancelling owns and stops preview timers.
        await page.evaluate(() => {window.selectionPromise=testTool.requestItemSelection('Choose',Player,AssetGroup.slice(0,2).map(g=>({group:g.Name,text:g.Description})));});
        await panel.locator('.ltp-page:not(.ltp-covered) .lt-btn-list button').first().click();
        const viewToggle=panel.locator('.ltq-hdr button[title="List view; click for character"]');
        assert.ok((await viewToggle.innerHTML()).includes('M4 6h16'));
        await viewToggle.click();
        assert.equal(await panel.locator('.lt-zone-button.selected').count(),1);
        assert.equal(await panel.locator('.lt-zone-choices').count(),0);
        await page.waitForTimeout(100);
        const mapLayout=await panel.locator('.lt-item-map').evaluate(el=>{
            const content=el.closest('.lt-content'),r=el.getBoundingClientRect();return {w:r.width,h:r.height,inset:r.top-el.parentElement.getBoundingClientRect().top,scroll:content.scrollHeight-content.clientHeight};
        });
        assert.ok(Math.abs(mapLayout.w*2-mapLayout.h)<1);assert.ok(mapLayout.scroll<=1,JSON.stringify(mapLayout));assert.ok(mapLayout.inset>=3);
        await page.screenshot({path:path.join(screenshotDir,'character-map.png')});
        assert.ok((await panel.locator('.ltq-hdr button[title="Character view; click for list"]').innerHTML()).includes('<rect'));
        await panel.locator('.lt-zone-button[title="ItemLegs"]').click();
        await panel.locator('.ltq-hdr button[title="Character view; click for list"]').click();
        assert.equal(await panel.locator('.ltp-page:not(.ltp-covered) .lt-btn-list .selected').count(),2);
        await panel.getByRole('button',{name:'Confirm',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>window.selectionPromise),['ItemArms','ItemLegs']);
        assert.equal(await page.evaluate(()=>testTool.timers),0);
        // Craft target footer + side editor: preserve all unedited properties, don't pop after save.
        await page.evaluate(()=>testTool.openCraftTargetPicker(Player));
        assert.match(await panel.getByRole('button',{name:'Single edit',exact:true}).getAttribute('class'),/lt-btn-primary/);
        await panel.getByRole('button',{name:'Single edit',exact:true}).click();
        await panel.locator('.ltp-page:not(.ltp-covered) .lt-btn-list button').first().click();
        const side = panel.locator('.lt-craft-side');
        assert.equal(await side.evaluate(el=>getComputedStyle(el).transitionDuration.split(',')[0].trim()),'0.28s');
        // Reverse a collapse before it finishes: no delayed callback may hide a reopened editor.
        await page.evaluate(()=>{testTool.phoneBack();document.querySelector('.ltp-page:not(.ltp-covered) .lt-btn-list button').click();});
        await page.waitForTimeout(320);
        assert.equal(await side.evaluate(el=>el.classList.contains('is-open')&&!el.inert),true);

        assert.equal(await side.locator('input:not([type="checkbox"])').inputValue(),'Original 0');
        await side.locator('input:not([type="checkbox"])').fill('New name');
        await side.getByRole('button',{name:'Confirm',exact:true}).click();
        const craft = await page.evaluate(()=>Player.Appearance[0].Craft);
        assert.equal(craft.Name,'New name'); assert.equal(craft.MemberNumber,1); assert.deepEqual(craft.Effects,{Large:1});
        assert.deepEqual(craft.ItemProperty,{OverridePriority:7}); assert.equal(craft.Color,'Blue');
        assert.equal(await side.isVisible(),true);
        await side.getByRole('button',{name:'Export',exact:true}).click();
        const exported = await page.evaluate(()=>JSON.parse(LZString.decompressFromBase64(window.exported)));
        assert.equal(exported.Name,'New name'); assert.equal(exported.Partial,false); assert.equal(exported.MemberNumber,undefined);
        const contentRect = await panel.locator('.ltp-page:not(.ltp-covered) .lt-craft-items').boundingBox();
        const sideRect = await side.boundingBox(); assert.ok(sideRect.x > contentRect.x);
        await page.screenshot({path:path.join(screenshotDir,'craft.png')});
        await panel.locator('.ltq-back').click(); await side.waitFor({state:'hidden'}); assert.equal(await side.isVisible(),false);
        await panel.locator('.ltq-back').click();
        await panel.getByRole('button',{name:'Batch edit',exact:true}).waitFor({state:'visible'});
        assert.equal(await panel.getByRole('button',{name:'Batch edit',exact:true}).isVisible(),true, JSON.stringify(await page.evaluate(()=>({pages:testTool.pages.map(p=>({title:p.title,cls:p.el.className,inert:p.el.inert})),title:document.querySelector('.ltq-title').textContent}))));
        await page.evaluate(()=>{testTool.hideToolPanel();testTool.showToolPanel();testTool.saveUndoSnapshot(Player,99);testTool.openUndoPanel(Player);});
        assert.equal(await panel.locator('.lt-undo-meta-row').count(),2);
        await page.waitForTimeout(350);
        const layout = await page.evaluate(()=>{
            const page=document.querySelector('.lt-undo-page'),content=page.querySelector('.lt-content');
            return {width:page.clientWidth,viewport:document.querySelector('.ltp-viewport').clientWidth,scroll:content.scrollHeight-content.clientHeight,homeInert:document.querySelector('.ltp-home').inert};
        });
        assert.equal(layout.width,layout.viewport); assert.ok(layout.scroll<=1,JSON.stringify(layout)); assert.equal(layout.homeInert,true);
        await page.screenshot({path:path.join(screenshotDir,'undo.png')});
        await page.evaluate(()=>testTool.hideToolPanel());
        assert.equal(await page.evaluate(()=>window.deletedPreviews),1);
        // A square in native or ECHO padded storage stays square after every preview transform.
        const aspectRatios=await page.evaluate(()=>{
            const results=[];
            const fixed=testTool.getES().fixedZones;testTool.getES().fixedZones=0;
            for(const echo of [false,true]) for(const ratio of [.65,1,1.4]) for(const inverted of [false,true]) {
                window.echoInstalled=echo;const source=document.createElement('canvas');source.width=echo?1000:500;source.height=1850;
                const input=source.getContext('2d');input.fillStyle='red';input.fillRect(200+(echo?250:0),1100,100,100);
                const output=document.createElement('canvas');output.width=500;output.height=1000;const ctx=output.getContext('2d');
                testTool.drawToolCharacter({Canvas:source,HeightRatio:ratio,HeightModifier:0,inverted,echo},ctx);
                const pixels=ctx.getImageData(0,0,500,1000).data;let left=500,right=-1,top=1000,bottom=-1;
                for(let y=0;y<1000;y++)for(let x=0;x<500;x++)if(pixels[(y*500+x)*4+3]>200){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
                results.push({w:right-left+1,h:bottom-top+1});
            }testTool.getES().fixedZones=fixed;return results;
        });
        aspectRatios.forEach(({w,h})=>{assert.ok(w>0);assert.ok(Math.abs(w-h)<=1,JSON.stringify({w,h}));});
        // Regression: ECHO shifts content 250px right; native extraction must recenter head and feet.
        const fullBody=await page.evaluate(()=>{
            return [{w:500,h:1850,top:700,scale:1,pad:0},{w:1000,h:1850,top:700,scale:1,pad:250}].map(layout=>{
                window.echoInstalled=!!layout.pad;const source=document.createElement('canvas');source.width=layout.w;source.height=layout.h;
                const input=source.getContext('2d');input.fillStyle='red';input.fillRect(200*layout.scale+layout.pad,layout.top+20*layout.scale,100*layout.scale,100*layout.scale);
                input.fillStyle='blue';input.fillRect(200*layout.scale+layout.pad,layout.top+880*layout.scale,100*layout.scale,100*layout.scale);
                const output=document.createElement('canvas');output.width=500;output.height=1000;const ctx=output.getContext('2d');
                testTool.drawToolCharacter({Canvas:source,HeightRatio:1,HeightModifier:0,echo:!!layout.pad},ctx,0,0,1,false);
                return {head:[...ctx.getImageData(250,50,1,1).data],feet:[...ctx.getImageData(250,950,1,1).data]};
            });
        });
        fullBody.forEach(body=>{assert.deepEqual(body.head,[255,0,0,255]);assert.deepEqual(body.feet,[0,0,255,255]);});
        const compatibility=await page.evaluate(()=>{
            const canvas=document.createElement('canvas');canvas.width=1000;
            window.echoInstalled=false;const absent=testTool.toolCharacterCanvasOffset({Canvas:canvas});
            window.echoInstalled=true;const expanded=testTool.toolCharacterCanvasOffset({Canvas:canvas});
            canvas.width=500;const pending=testTool.toolCharacterCanvasOffset({Canvas:canvas});window.echoInstalled=false;
            return {absent,expanded,pending,magic:testTool.toolLockPreview({Name:'淫纹锁LuziPadlock'}),afc:testTool.toolLockPreview({Name:'Heart Padlock'})};
        });
        assert.equal(compatibility.absent,0);assert.equal(compatibility.expanded,250);assert.equal(compatibility.pending,0);
        assert.ok(compatibility.magic.includes('@52afa10aaa854907422727eb623c658b20ee1b4d/'));
        assert.equal(compatibility.afc,'https://cdn.jsdelivr.net/gh/awdrrawd/BC-AFC@main/Images/AFC-Heart_Lock.png');
        // Batch form remains above its selection page; auto-focus cannot scroll the viewport sideways.
        const activePage=panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave)');
        await page.evaluate(()=>testTool.openCraftTargetPicker(Player));
        await panel.getByRole('button',{name:'Batch edit',exact:true}).click();
        await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) .lt-btn-list button').first().click();
        await panel.getByRole('button',{name:'Confirm',exact:true}).click();
        await page.waitForTimeout(350);
        const stack=await page.evaluate(()=>({count:testTool.pages.length,scroll:document.querySelector('.ltp-viewport').scrollLeft,leaving:document.querySelectorAll('.ltp-leave').length}));
        assert.equal(stack.count,3);assert.equal(stack.scroll,0);assert.equal(stack.leaving,0);
        await page.screenshot({path:path.join(screenshotDir,'batch-form.png')});
        await panel.locator('.ltq-back').click();
        await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) .lt-item-picker').waitFor({state:'visible'});
        assert.equal(await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) .lt-list-btn.selected').count(),1);
        await activePage.getByRole('button',{name:'Confirm',exact:true}).click();
        await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) input[type=text]').fill('Batch new name');
        await activePage.getByRole('button',{name:'Confirm',exact:true}).click();
        await panel.getByRole('button',{name:'Batch edit',exact:true}).waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>Player.Appearance[0].Craft.Name),'Batch new name');
        // Cancel exits the whole feature while Back above retained the selection page.
        await panel.getByRole('button',{name:'Batch edit',exact:true}).click();
        await activePage.locator('.lt-btn-list button').first().click();
        await activePage.getByRole('button',{name:'Confirm',exact:true}).click();
        await activePage.getByRole('button',{name:'Cancel',exact:true}).click();
        assert.equal(await page.evaluate(()=>testTool.pages.length),0);
        assert.equal(await panel.isVisible(),true);
        await page.evaluate(()=>testTool.hideToolPanel());
        // Three-column lock cards include image + label, selecting returns a stable ID.
        await page.evaluate(()=>{window.lockPromise=testTool.requestButtons('Locks',Array.from({length:7},(_,i)=>({text:'Lock '+i,value:'Lock'+i,image:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'})),false,{grid:true});});
        assert.equal(await panel.locator('.lt-lock-grid img').count(),7);
        const columns = await panel.locator('.lt-lock-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length); assert.equal(columns,3);
        await panel.getByRole('button',{name:'Lock 2',exact:true}).click(); assert.equal(await page.evaluate(()=>lockPromise),'Lock2');
        // Compact view: editor is still to the right, footer remains reachable and no horizontal scroll leaks.
        await page.setViewportSize({width:390,height:700});
        await page.evaluate(()=>testTool.openSingleCraftEditor(Player));
        await panel.locator('.ltp-page:not(.ltp-covered) .lt-btn-list button').first().click();
        const mobile=await panel.evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:innerWidth,scroll:el.scrollWidth-el.clientWidth}));
        assert.ok(mobile.left>=0 && mobile.right<=mobile.width && mobile.scroll<=1,JSON.stringify(mobile));
        await page.screenshot({path:path.join(screenshotDir,'mobile.png')});
        await panel.locator('.ltq-hdr button[title="List view; click for character"]').click();
        await page.waitForTimeout(100);
        const compactMap=await panel.locator('.lt-item-map').evaluate(el=>{
            const r=el.getBoundingClientRect(),host=el.closest('.lt-craft-items');
            return {w:r.width,h:r.height,scroll:host.scrollHeight-host.clientHeight,width:host.clientWidth,height:host.clientHeight};
        });
        assert.ok(compactMap.scroll<=1 && compactMap.w<=compactMap.width && compactMap.h<=compactMap.height,JSON.stringify(compactMap));
        assert.ok(Math.abs(compactMap.w*2-compactMap.h)<1);
        await page.screenshot({path:path.join(screenshotDir,'mobile-map.png')});
        const footerOrder=await side.locator('.lt-footer button').allTextContents();
        assert.deepEqual(footerOrder,['Confirm','Export','Cancel']);
        await side.getByRole('button',{name:'Cancel',exact:true}).click();
        assert.equal(await page.evaluate(()=>testTool.pages.length),0);
        await page.evaluate(()=>testTool.hideToolPanel());
        // Reopening a different feature restores the shared view preference.
        await page.evaluate(()=>{testTool.showToolPanel();testTool.openSingleCraftEditor(Player);});
        assert.equal(await panel.locator('.ltq-hdr button[title="Character view; click for list"]').count(),1);
        await panel.locator('.ltq-hdr button[title="Character view; click for list"]').click();
        await page.evaluate(()=>{testTool.hideToolPanel();testTool.showToolPanel();testTool.openSingleCraftEditor(Player);});
        assert.equal(await panel.locator('.ltq-hdr button[title="List view; click for character"]').count(),1);
        await page.evaluate(()=>testTool.hideToolPanel());
        const storageChecks=await page.evaluate(()=>{
            const original=Player.ExtensionSettings.LikoTOOL;
            const shared=Player.OnlineSharedSettings.LikoTOOL;
            let syncCount=0;window.ServerPlayerExtensionSettingsSync=key=>{if(key==='LikoTOOL')syncCount++;};
            localStorage.setItem('likoTool_theme',JSON.stringify({mode:'light',accentId:'purple'}));
            localStorage.setItem('likoTool_btn_order',JSON.stringify(['lock','undo']));
            localStorage.setItem('likoTool_ui_layout',JSON.stringify({hidden:['lock'],toggles:['dnd']}));
            localStorage.setItem('likoTool_ui_panel',JSON.stringify({x:22,y:33}));
            Player.ExtensionSettings.LikoTOOL=LZString.compressToBase64(JSON.stringify({heightFix:1,heightLock:1,customRetained:{value:42}}));
            testTool.initializeStorage();
            const migrated=structuredClone(Player.ExtensionSettings.LikoTOOL);
            // After migration, saving preferences must not use compression.
            const compress=LZString.compressToBase64;LZString.compressToBase64=()=>{throw Error('Settings must not be compressed');};
            testTool.getES().itemViewMode='character';testTool.setRpMode(true);testTool.saveES();
            Player.ExtensionSettings.LikoTOOL=JSON.parse(JSON.stringify(Player.ExtensionSettings.LikoTOOL));
            localStorage.setItem('likoTool_theme',JSON.stringify({mode:'dark',accentId:'red'}));
            testTool.initializeStorage();const restored=structuredClone(Player.ExtensionSettings.LikoTOOL);
            LZString.compressToBase64=compress;
            // A different account's existing settings win over the legacy browser values.
            Player.ExtensionSettings.LikoTOOL={theme:{mode:'dark',accentId:'blue'},itemViewMode:'list'};
            const preferred=testTool.getES().theme.accentId;
            Player.ExtensionSettings.LikoTOOL=original;Player.OnlineSharedSettings.LikoTOOL=shared;testTool.initializeStorage();
            return {migrated,restored,syncCount,preferred,devious:testTool.toolLockPreview({Name:'DeviousPadlock'})};
        });
        assert.equal(storageChecks.migrated.heightFix,1);assert.equal(storageChecks.migrated.fixedZones,1);
        assert.deepEqual(storageChecks.migrated.panelPosition,{x:22,y:33});
        assert.deepEqual(storageChecks.migrated.menuLayout.hidden,['lock']);
        assert.deepEqual(storageChecks.migrated.buttonOrder,['lock','undo']);
        assert.equal(storageChecks.restored.theme.mode,'light');assert.equal(storageChecks.restored.itemViewMode,'character');
        assert.equal(storageChecks.restored.rpMode,1);assert.equal(storageChecks.restored.customRetained.value,42);
        assert.equal(storageChecks.preferred,'blue');assert.ok(storageChecks.syncCount>=3);
        assert.equal(storageChecks.devious,'https://cdn.jsdelivr.net/gh/FurryZoi/Devious-Obligate-Great-Stuff@main/src/images/devious-padlock.png');
        const lockCheck=await page.evaluate(()=>{
            const asset={Name:'DeviousPadlock',Description:'Devious',IsLock:true};const calls=[];
            window.AssetGroupGet=()=>({Asset:[asset]});window.AssetGet=()=>asset;
            window.InventoryIsPermissionBlocked=(C,name,group)=>group==='ItemLegs';
            window.InventoryLock=(C,item,lock,member)=>{calls.push({group:item.Asset.Group.Name,name:lock.Asset.Name,member});};
            testTool.fullLock('',Player,asset);return calls;
        });
        assert.deepEqual(lockCheck,[{group:'ItemArms',name:'DeviousPadlock',member:1}]);
        // Shared menus preserve opaque values, even when labels are identical.
        await page.evaluate(()=>{testTool.showToolPanel();window.choice=testTool.requestButtons('Same labels',[{text:'Same',value:'one'},{text:'Same',value:'two'}],true);});
        await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) .lt-list-btn').nth(1).click();
        await panel.getByRole('button',{name:'Confirm',exact:true}).click();
        assert.deepEqual(await page.evaluate(()=>window.choice),['two']);
        await page.evaluate(()=>{window.targetChoice=testTool.requestCharacter('Pick target');});
        await panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave) .lt-list-btn').first().click();
        assert.equal(await page.evaluate(async()=>await window.targetChoice===Player),true);
        // Cancel settles both nested requests, while shared footer contains one Cancel.
        await page.evaluate(()=>{
            window.parentChoice=testTool.requestButtons('Parent',[{text:'Parent option'}]);
            window.childChoice=testTool.requestButtons('Child',[{text:'Child option'}],true);
        });
        const nestedPage=panel.locator('.ltp-page:not(.ltp-covered):not(.ltp-leave)');
        assert.equal(await nestedPage.getByRole('button',{name:'Cancel',exact:true}).count(),1);
        await nestedPage.getByRole('button',{name:'Cancel',exact:true}).click();
        assert.deepEqual(await page.evaluate(async()=>Promise.all([window.parentChoice,window.childChoice])),[null,[]]);
        assert.equal(await page.evaluate(()=>testTool.pages.length),0);
        await page.evaluate(()=>testTool.hideToolPanel());
        const translationCheck=await page.evaluate(()=>{
            const zh=Object.keys(testTool.LANG.zh),en=Object.keys(testTool.LANG.en);
            const missing=[...zh.filter(k=>!en.includes(k)),...en.filter(k=>!zh.includes(k))];
            for(const key of zh){
                const tokens=text=>(text.match(/\{[^}]+\}/g)||[]).sort().join(',');
                if(tokens(testTool.LANG.zh[key])!==tokens(testTool.LANG.en[key]))missing.push(key+':placeholders');
            }
            window.TranslationLanguage='EN';const english=testTool.t('accentPurple');
            window.TranslationLanguage='TW';const chinese=testTool.t('menuVisibility');
            window.TranslationLanguage='EN';return {missing,english,chinese};
        });
        assert.deepEqual(translationCheck.missing,[]);assert.equal(translationCheck.english,'Purple');
        assert.ok(translationCheck.chinese.includes('長按'));
        // Promise-aware hooks and Player replacement; original return values are retained.
        const hooksResult = await page.evaluate(async()=>{
            const hooks={}, removed=[];
            const names=['CommonSetScreen','ChatRoomSendChat','ServerSend','ChatRoomCharacterViewDrawOverlay','DrawProcess','ChatRoomClick','DrawCharacter','CharacterAppearanceYOffset','DialogGetCharacterZone','ChatRoomSync','ChatRoomSyncMemberJoin','ChatRoomCharacterItemUpdate','ChatRoomSyncItem','ChatRoomSyncSingle','ServerPlayerAppearanceSync'];
            names.forEach(name=>{window[name] ||= ()=>{};});
            testTool.setApi({hookFunction(name,p,fn){hooks[name]=fn;return()=>removed.push(name);},unload(){}});testTool.setupHooks();
            let release, scans=0;window.ChatRoomData={Name:'Async'};const promise=new Promise(resolve=>release=resolve);
            const bundle=ServerAppearanceBundle;window.ServerAppearanceBundle=items=>{scans++;return bundle(items);};
            const pending=hooks.ChatRoomSync([],()=>promise);
            await new Promise(resolve=>setTimeout(resolve,10)); const before=scans;
            release(42);const returned=await pending;const after=scans;
            let leave;const leaving=hooks.ChatRoomSync([],()=>new Promise(resolve=>leave=resolve));
            window.ChatRoomData={Name:'Different room'};leave(17);await leaving;const afterLeave=scans;
            const nativeZone=window.DialogGetCharacterZone;
            const zoneResults=[];window.CurrentCharacter=Player;
            for(const ratio of [.4,.85,1,1.5]) for(const modifier of [-180,0,250]) {
                Player.HeightRatio=ratio;Player.HeightModifier=modifier;
                const args=[Player,[100,220,150,120],0,0,.75,ratio];
                const rect=hooks.DialogGetCharacterZone(args,a=>nativeZone(...a));
                zoneResults.push({rect,ratio:Player.HeightRatio,modifier:Player.HeightModifier});
            }
            // Independent toggles: ratio and vertical displacement have different responsibilities.
            const fixedBefore=testTool.getES().fixedZones;
            testTool.heightFixCommand();
            const independent=testTool.getES().fixedZones===fixedBefore && testTool.getES().heightFix===1;
            Player.HeightRatio=1.4;Player.HeightModifier=250;
            const raised=hooks.CharacterAppearanceYOffset([Player,1,false],a=>CharacterAppearanceYOffset(...a));
            const construction=hooks.CharacterAppearanceYOffset([Player,1,true],a=>CharacterAppearanceYOffset(...a));
            const drawArgs=[Player,500,0,1,true];
            const displayed=hooks.DrawCharacter(drawArgs,a=>({resize:a[4],ratio:Player.HeightRatio,modifier:Player.HeightModifier}));
            testTool.heightLockCommand();
            const raiseStillOn=testTool.getES().heightFix===1;
            const unscaled=hooks.DrawCharacter(drawArgs,a=>a[4]);
            testTool.heightLockCommand();
            window.CurrentCharacter=null;
            const untouched=hooks.DialogGetCharacterZone([Player,[0,0,150,120],0,0,1,.5],a=>nativeZone(...a));
            testTool.setupFreeHandsHooks(); window.Player={...Player,MemberNumber:2};testTool.setupFreeHandsHooks();
            const outside=hooks.CharacterAppearanceYOffset([Player,1,false],a=>CharacterAppearanceYOffset(...a));
            const result={returned,removed:removed.length,before,after,afterLeave,zoneResults,untouched,independent,raised,construction,displayed,raiseStillOn,unscaled,outside};testTool.setApi(null);return result;
        });
        assert.equal(hooksResult.returned,42); assert.equal(hooksResult.removed,3);
        assert.equal(hooksResult.before,0);assert.equal(hooksResult.after,1);assert.equal(hooksResult.afterLeave,1);
        hooksResult.zoneResults.forEach(({rect})=>{assert.equal(rect[2],112.5);assert.equal(rect[3],90);});
        assert.equal(hooksResult.untouched[2],75);
        assert.equal(hooksResult.independent,true);assert.equal(hooksResult.raised,0);assert.equal(hooksResult.construction,-250);
        assert.deepEqual(hooksResult.displayed,{resize:false,ratio:1.4,modifier:250});assert.equal(hooksResult.raiseStillOn,true);assert.equal(hooksResult.unscaled,true);assert.equal(hooksResult.outside,-250);
        await page.evaluate(()=>Liko.Tool.Destroy()); assert.equal(await panel.count(),0);
        assert.deepEqual(errors,[]);
        console.log('TOOL browser checks passed: menu editing/drag, zones, craft persistence/export, stack/undo layout, locks and hook lifecycle.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
