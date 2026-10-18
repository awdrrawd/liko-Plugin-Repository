const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Plugins/Hotfix/HCR.user.js'), 'utf8');
const version = /@version\s+(\S+)/.exec(source)[1];
// Optional integration mode executes this checkout's actual BC wire functions and LZString.
// The default fixture is deliberately limited to the public wire contract, not HCR internals.
const bcRoot = process.env.BC_SOURCE_ROOT;
const codec = {
    compressToUTF16: s => 'U' + Buffer.from(s).toString('base64'),
    decompressFromUTF16: s => s?.startsWith('U') ? Buffer.from(s.slice(1), 'base64').toString() : null,
    compressToBase64: s => Buffer.from('B' + s).toString('base64'),
    decompressFromBase64: s => { const text=Buffer.from(s, 'base64').toString(); return text.startsWith('B') ? text.slice(1) : null; },
};
function raw(item = 'Known', name = 'Craft', type = '') {
    return [item, '', '', name, '', '', '', type, '', '{}', '', '', '{}'].join('|');
}
async function boot(backup, options = {}) {
    const timers = [], sent = [], events = [], logs = [];
    let ctx;
    ctx = vm.createContext({
        console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(k => [k, (...a) => logs.push(a)])),
        window: { dispatchEvent: e => events.push(e) }, CustomEvent: class { constructor(type, init) { this.type=type; Object.assign(this, init); } },
        TextEncoder, setTimeout: fn => timers.push(fn), setInterval() {},
        Player: { MemberNumber: 1, Crafting: [], ExtensionSettings: backup == null ? {} : { HCR: structuredClone(backup) } },
        CraftingSerializeFieldSep: '|', CraftingSerializeItemSep: '§', CraftingSerializeSanitize: /[|§]/g,
        LZString: codec, Asset: [{ Name: 'Known' }], CraftingAssets: { Known: [{ Name: 'Known' }] },
        CraftingAssetsPopulate() { return Object.fromEntries(ctx.Asset.map(a => [a.Name, [a]])); },
        CraftingStatusType: { OK: 2, ERROR: 1, CRITICAL_ERROR: 0 }, CraftingSlots: {}, ElementButton: {},
        CommonEnumerate: list => list.entries(),
        CommonJSONParse(s) { try { return JSON.parse(s); } catch { return null; } },
        AppearanceItem: { fromAsset: (asset, options = {}) => ({ Asset: asset, Property: options.property || {} }) },
        ItemPropertiesCompress: item => item.Property, ItemPropertiesDecompress: (item, property) => property,
        ServerSend(type, payload) {
            if (ctx.failPath && Object.keys(payload).some(k => k.endsWith(ctx.failPath))) throw Error('simulated send failure');
            sent.push([type, structuredClone(payload)]);
        },
        saves: 0,
        ServerAccountUpdate: { QueueData(data) { ctx.saves++; ctx.serverPacket = data.Crafting; } },
        CraftingSerialize(c) {
            if (c.failSerialize) throw Error('serialize');
            if (!ctx.CraftingAssets[c.Item]) return '';
            return [c.Item, '', '', c.Name, '', '', '', '', '', JSON.stringify(c.ItemProperty || {}), c.TypeRecord ? JSON.stringify(c.TypeRecord) : '', '', JSON.stringify(c.Effects || {})].join('|');
        },
        CraftingDeserialize(s) {
            const f = s.split('|');
            if (!ctx.CraftingAssets[f[0]]) return null;
            return { Item:f[0], Name:f[3], Type:f[7] || undefined, TypeRecord:f[10] ? JSON.parse(f[10]) : null,
                ItemProperty:JSON.parse(f[9] || '{}'), Effects:JSON.parse(f[12] || '{}'), Partial:false };
        },
        CraftingValidate(c) {
            if (!c?.Item || c.Name === 'Rejected') return 0;
            if (c.Type && c.TypeRecord == null) { c.TypeRecord = { converted: c.Type }; delete c.Type; return 1; }
            return 2;
        },
        CraftingDecompressServerData(packet) { return (ctx.LZString.decompressFromUTF16(packet) || '').split('§').map(s => ctx.CraftingDeserialize(s)); },
        CraftingLoadServer(packet) {
            let refresh=false;
            ctx.Player.Crafting = ctx.CraftingDecompressServerData(packet).map(c => {
                if (!c) return null;
                const status=ctx.CraftingValidate(c);
                refresh ||= status !== 2;
                return status === 0 ? null : c;
            });
            if (refresh) ctx.CraftingSaveServer();
        },
        CraftingSaveServer() {
            const slots=ctx.Player.Crafting.map(c => c ? ctx.CraftingSerialize(c) : '');
            while (slots.length && !slots.at(-1)) slots.pop();
            ctx.ServerAccountUpdate.QueueData({Crafting:ctx.LZString.compressToUTF16(slots.join('§'))});
        },
        bcModSdk: { registerMod() { return { hookFunction(name, priority, hook) {
            assert.equal(typeof ctx[name], 'function', name);
            const original=ctx[name];
            ctx[name]=(...args)=>hook(args, nextArgs=>original(...nextArgs));
        } }; } },
    });
    if (bcRoot) {
        vm.runInContext(fs.readFileSync(path.join(bcRoot, 'Scripts/lib/LZString.js'), 'utf8'), ctx);
        const native=fs.readFileSync(path.join(bcRoot, 'Screens/Room/Crafting/Crafting.js'), 'utf8');
        const start=native.indexOf('function CraftingSerialize('), end=native.indexOf('function CraftingClick(',start);
        assert.ok(start >= 0 && end > start);
        vm.runInContext(native.slice(start,end),ctx);
    }
    Object.assign(ctx, options);
    vm.runInContext(source, ctx);
    await Promise.resolve(); await Promise.resolve();
    assert.equal(ctx.window.Liko.HCR?.version, version, 'initialization and metadata agree');
    return Object.assign(ctx, { sent, events, logs,
        packet: slots => ctx.LZString.compressToUTF16(slots.join('§')),
        setPacket: slots => ctx.LZString.compressToBase64(slots.join('§')),
        async flushTimers() { for (const fn of timers.splice(0)) await fn(); },
    });
}

test('HCR migrates legacy backups once; saves/deletions cannot resurrect them next login', async () => {
    const seed=await boot();
    const c=await boot({v:1,p:seed.packet([raw()]),version:'0.1.2'});
    c.CraftingLoadServer(c.packet([]));
    assert.equal(c.Player.Crafting[0].Name,'Craft');
    assert.equal(c.Player.ExtensionSettings.HCR.p,'');
    assert.ok(c.Player.ExtensionSettings.HCR.Backup.set1);
    assert.equal(c.Player.ExtensionSettings.HCR.Backup.set2,'');
    assert.equal(c.saves,1);
    assert.equal(c.events.filter(e=>e.type==='HCRCraftingRestored').length,1);
    const count=c.sent.length;
    c.window.Liko.HCR.backup.save();
    assert.equal(c.sent.length,count,'unchanged data is not sent again');
    c.Player.Crafting[0]=null; c.CraftingSaveServer();
    const next=await boot(c.Player.ExtensionSettings.HCR);
    next.CraftingLoadServer(c.serverPacket);
    assert.equal(next.Player.Crafting.filter(Boolean).length,0);
});

test('HCR preserves absent asset bytes and resolves them when assets arrive', async () => {
    const c=await boot(); const original=raw('Extension','Protected','legacy');
    c.CraftingLoadServer(c.packet([original]));
    assert.equal(c.CraftingSerialize(c.Player.Crafting[0]),original);
    assert.equal(c.window.Liko.HCR.status().placeholders.length,1);
    c.CraftingSaveServer();
    assert.equal(c.LZString.decompressFromUTF16(c.serverPacket),original);
    c.Asset.push({Name:'Extension'});
    assert.equal(c.window.Liko.HCR.backup.reconcile(),1);
    assert.equal(c.window.Liko.HCR.status().placeholders.length,0);
    assert.equal(c.Player.Crafting[0].TypeRecord.converted,'legacy');
    assert.equal(c.CraftingDeserialize(raw('StillMissing')),null,'outside loading native behavior is preserved');
    c.CraftingLoadServer(c.packet([raw('Known','Rejected')]));
    assert.equal(c.Player.Crafting[0],null,'known invalid items are not protected as absent assets');
});

test('HCR respects occupied/moved slots and independently saves the 100/200 slot boundary', async () => {
    const c=await boot(); const slots=Array(200).fill('');
    slots[0]=raw('Known','Old');slots[99]=raw('Known','End1');slots[100]=raw('Known','Start2');slots[199]=raw('Known','End2');
    c.Player.ExtensionSettings.HCR={v:2,Backup:{set1:c.setPacket(slots.slice(0,100)),set2:c.setPacket(slots.slice(100))}};
    const live=slots.slice();live[0]=raw('Known','Replacement');live[1]=slots[99];live[99]='';
    c.CraftingLoadServer(c.packet(live));
    assert.equal(c.Player.Crafting[0].Name,'Replacement');assert.equal(c.Player.Crafting[99],null);
    assert.equal(c.Player.Crafting[199].Name,'End2');
    c.sent.length=0; c.Player.Crafting[100].Name='Changed'; c.CraftingSaveServer();
    assert.deepEqual(c.sent.map(([,p])=>Object.keys(p)[0]),['ExtensionSettings.HCR.Backup.set2']);
});

test('HCR retains old recovery data on failed set sends and failed legacy cleanup; retry succeeds', async () => {
    const seed=await boot(); const packet=seed.packet([raw()]);
    const c=await boot({v:1,p:packet},{failPath:'.set1'});
    c.CraftingLoadServer(c.packet([]));
    assert.equal(c.Player.ExtensionSettings.HCR.p,packet);
    assert.equal(c.Player.ExtensionSettings.HCR.Backup.set1,'');
    c.failPath='.p'; c.window.Liko.HCR.backup.save();
    assert.equal(c.Player.ExtensionSettings.HCR.p,packet,'failed cleanup must not erase local retry state');
    c.failPath=null;c.window.Liko.HCR.backup.save();
    assert.equal(c.Player.ExtensionSettings.HCR.p,'');
    const failedContainer=await boot({v:1,p:packet},{failPath:'.Backup'});
    failedContainer.CraftingLoadServer(failedContainer.packet([]));
    assert.equal(failedContainer.Player.ExtensionSettings.HCR.Backup,undefined);
    assert.equal(failedContainer.Player.ExtensionSettings.HCR.p,packet);
    failedContainer.failPath=null;failedContainer.window.Liko.HCR.backup.save();
    assert.equal(failedContainer.Player.ExtensionSettings.HCR.p,'');
});

test('HCR preserves string roots and corrupt sets instead of replacing recovery sources', async () => {
    const seed=await boot();const packet=seed.packet([raw()]);
    const serialized=JSON.stringify({v:1,p:packet,version:'0.2.0'});
    const c=await boot(serialized,{failPath:'.HCR'});c.CraftingLoadServer(c.packet([]));
    assert.equal(c.Player.ExtensionSettings.HCR,serialized);
    c.failPath=null;c.window.Liko.HCR.backup.save();
    assert.equal(c.Player.ExtensionSettings.HCR.version,'0.2.0');
    assert.equal(c.Player.ExtensionSettings.HCR.p,'');
    assert.equal(c.sent[0][1]['ExtensionSettings.HCR'].p,packet,'initial queued snapshot retains legacy data');
    const broken=await boot({v:2,p:packet,Backup:{set1:'!corrupt!',set2:''}});
    broken.CraftingLoadServer(broken.packet([]));
    assert.equal(broken.Player.ExtensionSettings.HCR.Backup.set1,'!corrupt!');
    assert.equal(broken.Player.ExtensionSettings.HCR.p,packet);
});

test('HCR enforces transfer budget and preserves previous backups when serialization fails', async () => {
    const c=await boot();c.CraftingLoadServer(c.packet([raw()]));
    const previous=c.Player.ExtensionSettings.HCR.Backup.set1;
    // Test the transport boundary with an oversized encoded value, independent of compression ratio.
    const original=c.LZString.compressToBase64;
    c.LZString={...c.LZString,compressToBase64:()=> 'x'.repeat(150001)};
    c.Player.Crafting[0].Name='Changed';
    assert.equal(c.window.Liko.HCR.backup.save(),false);
    assert.equal(c.Player.ExtensionSettings.HCR.Backup.set1,previous);
    c.LZString.compressToBase64=original;
    const serialize=c.CraftingSerialize;c.CraftingSerialize=()=>{throw Error('serialize');};
    c.window.Liko.HCR.backup.save();
    assert.equal(c.Player.ExtensionSettings.HCR.Backup.set1,previous);
    c.CraftingSerialize=serialize;
    assert.ok(c.sent.every(message=>Buffer.byteLength(JSON.stringify(message))<=150000));
});

test('HCR late installation recovers backup holes without replacing live items', async () => {
    const seed=await boot();const c=await boot({v:1,p:seed.packet([raw('Known','Backup'),raw('Known','Hole')])});
    c.Player.Crafting=[c.CraftingDeserialize(raw('Known','Live'))];
    await c.flushTimers();
    assert.equal(c.Player.Crafting[0].Name,'Live');assert.equal(c.Player.Crafting[1].Name,'Hole');
});
