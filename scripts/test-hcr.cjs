const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Plugins/Hotfix/HCR.user.js'), 'utf8');

async function boot(backup) {
    const hooks = {}, timers = [];
    const ctx = vm.createContext({
        console: { log() {}, info() {}, warn() {}, error() {} },
        window: { dispatchEvent() {} }, CustomEvent: class {},
        setTimeout(fn) { timers.push(fn); },
        Player: { MemberNumber: 1, Crafting: [], ExtensionSettings: backup ? { HCR: backup } : {} },
        CraftingSerializeFieldSep: '|', CraftingSerializeSanitize: /[|§]/g,
        LZString: { compressToUTF16: value => value },
        CommonIsObject: value => value != null && typeof value === 'object' && !Array.isArray(value),
        CommonEnumerate: value => value.entries(),
        CraftingStatusType: { OK: 2, ERROR: 1, CRITICAL_ERROR: 0 },
        CraftingPropertyMap: new Map([['Soft', {}]]),
        CraftingAssets: { Known: [{ Name: 'Known' }] },
        CraftingAssetsPopulate() { return ctx.CraftingAssets; },
        ExtendedItemTypeToRecord(asset, type) { return { converted: type }; },
        CraftingSlots: {}, ElementButton: {}, syncs: 0, saves: 0, failSync: false,
        ServerPlayerExtensionSettingsSync() { if (ctx.failSync) throw Error('sync'); ctx.syncs++; },
        CraftingSerialize(c) { return [c.Item, '', c.Lock || '', c.Name, c.Description || '', c.Color || '', c.Private ? 'T' : '', '', '', JSON.stringify(c.ItemProperty || {}), JSON.stringify(c.TypeRecord ?? null), '', JSON.stringify(c.Effects || {})].join('|'); },
        CraftingDecompressServerData(packet) {
            if (Array.isArray(packet)) return packet;
            return packet ? packet.split('§').map(row => {
                if (!row) return null;
                const f = row.split('|');
                return { Item: f[0], Property: f[1] || undefined, Name: f[3], Type: f[7] || undefined,
                    ItemProperty: JSON.parse(f[9]), TypeRecord: JSON.parse(f[10]), Effects: JSON.parse(f[12]), Partial: false };
            }) : [];
        },
        CraftingValidate(c) { return c && c.Item ? 2 : 0; },
        CraftingLoadServer(data) { ctx.Player.Crafting = data; },
        CraftingSaveServer() { ctx.saves++; ctx.serverPacket = ctx.Player.Crafting.map(c => c ? ctx.CraftingSerialize(c) : '').join('§'); },
        bcModSdk: { registerMod() { return { hookFunction(name, priority, hook) {
            hooks[name] = hook;
            const original = ctx[name];
            ctx[name] = (...args) => hook(args, nextArgs => original(...nextArgs));
        } }; } },
    });
    vm.runInContext(source, ctx);
    await Promise.resolve(); await Promise.resolve();
    ctx.flushTimers = async () => {
        for (const fn of timers.splice(0)) fn();
        await Promise.resolve(); await Promise.resolve();
    };
    return ctx;
}

(async () => {
    const c = await boot();
    const old = { Item: 'Known', Name: 'Old', Type: 'a', Property: 'Soft', OverridePriority: 12 };
    c.CraftingLoadServer([old]);
    assert.equal(c.window.Liko.HCR.version, '0.1.2');
    assert.equal(old.Partial, false);
    assert.equal(old.TypeRecord.converted, 'a');
    assert.equal(old.Effects.Soft, 1);
    assert.equal(old.ItemProperty.OverridePriority, 12);
    assert.equal(c.Player.ExtensionSettings.HCR.version, '0.1.2');
    assert.equal(c.saves, 1);

    // Completed migration is not rerun; the ordinary login protection remains active.
    c.CraftingLoadServer(c.CraftingDecompressServerData(c.Player.ExtensionSettings.HCR.p));
    assert.equal(c.saves, 1);
    c.CraftingLoadServer([]);
    assert.equal(c.Player.Crafting[0].Name, 'Old');

    // Add, delete, then log in again: intentional deletions must not resurrect.
    c.Player.Crafting.push({ Item: 'Known', Name: 'New', Partial: false });
    c.CraftingSaveServer();
    assert.equal(c.CraftingDecompressServerData(c.Player.ExtensionSettings.HCR.p).length, 2);
    c.Player.Crafting = [];
    c.CraftingSaveServer();
    c.CraftingLoadServer([]);
    assert.equal(c.Player.Crafting.length, 0);

    // Old backup-only slot is upgraded and restored, while a populated live slot wins.
    const seed = await boot();
    const packet = seed.window.Liko.HCR.backup.encode([{ Item: 'Known', Name: 'Backup', Type: 'b', Property: 'Soft' }]);
    const restored = await boot({ v: 1, p: packet });
    restored.CraftingLoadServer([]);
    assert.equal(restored.Player.Crafting[0].TypeRecord.converted, 'b');
    assert.equal(restored.Player.Crafting[0].Effects.Soft, 1);
    restored.CraftingLoadServer([{ Item: 'Known', Name: 'Live' }]);
    assert.equal(restored.Player.Crafting[0].Name, 'Live');

    // Missing assets keep legacy Type in BOTH packets; retry after asset availability.
    const missing = await boot();
    missing.CraftingLoadServer([{ Item: 'Extension', Name: 'Protected', Type: 'x' }]);
    assert.equal(missing.Player.Crafting[0].Partial, false);
    assert.equal(missing.Player.ExtensionSettings.HCR.version, undefined);
    assert.equal(missing.CraftingDecompressServerData(missing.serverPacket)[0].Type, 'x');
    assert.equal(missing.CraftingDecompressServerData(missing.Player.ExtensionSettings.HCR.p)[0].Type, 'x');
    missing.CraftingAssets.Extension = [{ Name: 'Extension' }];
    missing.CraftingLoadServer(missing.serverPacket);
    assert.equal(missing.Player.Crafting[0].TypeRecord.converted, 'x');
    assert.equal(missing.Player.ExtensionSettings.HCR.version, '0.1.2');

    // A 0.1.2 marker must not hide disabled-extension data in either list.
    const disabledPacket = seed.window.Liko.HCR.backup.encode([
        null, { Item: 'Disabled', Name: 'Backup extension', Type: 'backup', Property: 'Soft' },
    ]);
    const disabled = await boot({ v: 1, p: disabledPacket, version: '0.1.2' });
    disabled.CraftingLoadServer([
        { Item: 'Disabled', Name: 'Live extension', Type: 'live', Property: 'Soft', OverridePriority: 9 },
    ]);
    for (const craft of disabled.Player.Crafting) {
        assert.equal(craft.Partial, false);
        assert.equal(craft.Effects.Soft, 1);
        assert.equal(craft.Property, undefined);
    }
    assert.equal(disabled.Player.Crafting[0].ItemProperty.OverridePriority, 9);
    assert.equal(disabled.Player.ExtensionSettings.HCR.version, '0.1.2');
    // Simulate a new session with the extension enabled: unresolved types still migrate.
    const enabled = await boot(JSON.parse(JSON.stringify(disabled.Player.ExtensionSettings.HCR)));
    enabled.CraftingAssets.Disabled = [{ Name: 'Disabled' }];
    enabled.CraftingLoadServer(disabled.serverPacket);
    assert.equal(enabled.Player.Crafting[0].TypeRecord.converted, 'live');
    assert.equal(enabled.Player.Crafting[1].TypeRecord.converted, 'backup');
    const savesAfterMigration = enabled.saves;
    enabled.CraftingLoadServer(enabled.serverPacket);
    assert.equal(enabled.saves, savesAfterMigration);

    // Failed settings synchronization cannot persist a completed migration marker.
    const failing = await boot({ v: 1, p: packet });
    failing.failSync = true;
    failing.CraftingLoadServer([]);
    assert.equal(failing.Player.ExtensionSettings.HCR.version, undefined);

    // Late installation upgrades existing account data without waiting for another login.
    const late = await boot({ v: 1, p: packet, version: '0.1.1' });
    late.Player.Crafting = [{ Item: 'Known', Name: 'Late', Type: 'late' }];
    await late.flushTimers();
    assert.equal(late.Player.Crafting[0].TypeRecord.converted, 'late');
    assert.equal(late.Player.ExtensionSettings.HCR.version, '0.1.2');

    // A newer account marker must never be downgraded by this release.
    const future = await boot({ v: 1, p: packet, version: '0.2.0' });
    future.CraftingLoadServer([{ Item: 'Known', Name: 'Future' }]);
    assert.equal(future.Player.ExtensionSettings.HCR.version, '0.2.0');

    // Partial/invalid objects do not enter the missing-extension protection path.
    assert.equal(c.CraftingValidate({ Name: 'Partial' }, null, true, false, true), 0);
    assert.equal(c.CraftingValidate({ Name: 'Invalid' }), 0);
    console.log('HCR migration, backup maintenance, login recovery and deferred conversion checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
