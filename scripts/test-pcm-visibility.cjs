const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/pcm/compat/core.js', 'utf8');
const ctx = vm.createContext({ window: {location:{href:'https://example.test/'}}, CurrentScreen:'Login', Player:{MemberNumber:1}, getCurrentViewingCharacter:()=>({MemberNumber:1}), floatingButtonHidden:{} });
for (const name of ['readFloatingButtonHidden','shouldShowUI']) {
    const start=source.indexOf('    function '+name+'(');
    vm.runInContext(source.slice(start,source.indexOf('\n    }',start)+6),ctx);
}
const check=(screen,expected,id)=>{ctx.CurrentScreen=screen;ctx.PreferenceExtensionsCurrent=id===undefined?undefined:{Identifier:id};assert.equal(ctx.shouldShowUI(),expected,screen+':'+id);};
ctx.floatingButtonHidden=ctx.readFloatingButtonHidden({});
for(const screen of ['Login','MainHall','InformationSheet','Preference'])check(screen,true);
check('Preference',true,'PCMSettings');check('Preference',false,'LCE');check('ChatRoom',false);check('Character',false);
ctx.floatingButtonHidden=ctx.readFloatingButtonHidden({showFloatingBtn:false});
check('Login',true);check('MainHall',true);check('Preference',false);check('InformationSheet',false);check('Preference',true,'PCMSettings');
ctx.floatingButtonHidden=ctx.readFloatingButtonHidden({showFloatingBtn:false,floatingButtonHidden:{mainHall:true,preference:false,informationSheet:false}});
check('MainHall',false);check('Preference',true);check('InformationSheet',true);check('Login',true);
for(const flag of ['bcx','LITTLISH_CLUB','MPA','LSCG_REMOTE_WINDOW_OPEN']){
 ctx.window[flag]=flag==='bcx'?{inBcxSubscreen:()=>true}:flag==='LITTLISH_CLUB'?{inModSubscreen:()=>true}:flag==='MPA'?{menuLoaded:true}:true;
 check('Preference',false,'PCMSettings');check('InformationSheet',false);delete ctx.window[flag];
}
ctx.getCurrentViewingCharacter=()=>({MemberNumber:2});check('InformationSheet',false);
console.log('PCM visibility and legacy migration checks passed.');
