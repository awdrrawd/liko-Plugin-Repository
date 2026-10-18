// ==UserScript==
// @name         Hotfix - Crafting Asset Recovery (HCR)
// @name:zh      熱修 - 製作物品的擴充物品資產保護 
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.1.4
// @description  Preserves crafted items while extension assets are unavailable and restores them after the assets load.
// @description:zh 在擴充資產尚未載入時保留 Craft 物品，並於資產載入後自動恢復使用。
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-start
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HCR.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/Hotfix/HCR.user.js
// ==/UserScript==

(function () {
    "use strict";

    window.Liko = window.Liko ?? {};
    if (window.Liko.HCR) return;

    const MOD_VERSION = "0.1.4";
    const TAG = "🐈‍⬛ [HCR]";
    const SLOT_COUNT = 200;
    const BACKUP_ROOT = "HCR";
    const BACKUP_FORMAT = 2;
    const BACKUP_SETS = [
        { name: "set1", from: 0, to: 100 },
        { name: "set2", from: 100, to: 200 },
    ];
    // Budget for ONE AccountUpdate (measured as UTF-8 bytes of ["AccountUpdate", payload]).
    // The official per-transfer limit is 180K; keep headroom.
    const PAYLOAD_BUDGET = 150000;
    const RAW = "__hcrRaw";
    const RESOLVE_POLL_MS = 2000;

    const STRINGS = {
        TW: "此物品的資產丟失，如果為拓展套件請重新加載後再次確認",
        CN: "此物品的资产丢失，如果为扩展组件请重新加载后再次确认",
        EN: "This item's asset is missing. If it comes from an extension, reload it and check again.",
        DE: "Das Asset dieses Gegenstands fehlt. Falls es von einer Erweiterung stammt, lade diese neu und prüfe erneut.",
        FR: "La ressource de cet objet est manquante. Si elle provient d’une extension, rechargez celle-ci puis vérifiez à nouveau.",
        RU: "Ресурс этого предмета отсутствует. Если он добавлен расширением, перезагрузите расширение и проверьте снова.",
        UA: "Ресурс цього предмета відсутній. Якщо його додано розширенням, перезавантажте розширення та перевірте знову.",
    };
    const WARNING_IMAGE = `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 7 96 90H4Z" fill="#ffd43b" stroke="#111" stroke-width="7" stroke-linejoin="round"/><path d="M50 31v32" stroke="#111" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="77" r="5.5" fill="#111"/></svg>'
    )}`;

    // ---------------------------------------------------------------- state
    let loaded = false;   // this session's account crafting data has been loaded and reconciled
    let loading = false;  // currently inside CraftingLoadServer
    let assetSignature = { ref: null, length: -1 };
    const warnedOnce = new Set();

    // ------------------------------------------------------------- helpers
    function waitFor(predicate, timeout = 30000) {
        const start = Date.now();
        return new Promise((resolve) => {
            (function check() {
                let ok = false;
                try { ok = predicate(); } catch (_) { /* not ready yet */ }
                if (ok) return resolve(true);
                if (Date.now() - start >= timeout) return resolve(false);
                setTimeout(check, 50);
            })();
        });
    }

    function warnOnce(key, ...args) {
        if (warnedOnce.has(key)) return;
        warnedOnce.add(key);
        console.error(TAG, ...args);
    }

    function language() {
        let raw = "";
        try { raw = localStorage.getItem("BondageClubLanguage") || ""; } catch (_) { /* ignored */ }
        if (!raw && typeof TranslationLanguage === "string") raw = TranslationLanguage;
        const low = raw.toLowerCase();
        if (low.startsWith("zh")) return low.includes("cn") || low.includes("hans") ? "CN" : "TW";
        const code = raw.toUpperCase().split("-")[0];
        return Object.hasOwn(STRINGS, code) ? code : "EN";
    }

    function tooltip() {
        return STRINGS[language()] || STRINGS.EN;
    }

    function utf8Bytes(text) {
        return typeof TextEncoder === "function" ? new TextEncoder().encode(text).byteLength : text.length * 3;
    }

    function isPlain(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function isLoggedIn() {
        try {
            return typeof ServerIsLoggedIn === "function" ? !!ServerIsLoggedIn() : Player?.MemberNumber != null;
        } catch (_) { return false; }
    }

    // ------------------------------------------------- raw slot strings
    function rawItemName(raw) {
        return typeof raw === "string" ? raw.split(CraftingSerializeFieldSep, 1)[0] : "";
    }

    function validRaw(raw) {
        return typeof raw === "string" && raw !== "" && rawItemName(raw) !== "";
    }

    function isPlaceholder(craft) {
        return craft != null && typeof craft[RAW] === "string";
    }

    // Decode the game's account packet into per-slot raw strings WITHOUT the game's asset check.
    function packetToRaw(packet) {
        if (typeof packet !== "string" || !packet) return [];
        let text = null;
        try { text = LZString.decompressFromUTF16(packet); } catch (_) { text = null; }
        if (typeof text !== "string" || !text) return [];
        return text.split(CraftingSerializeItemSep).slice(0, SLOT_COUNT);
    }

    function rawToPacket(slots) {
        const list = slots.slice(0, SLOT_COUNT);
        while (list.length && !list[list.length - 1]) list.pop();
        return LZString.compressToUTF16(list.join(CraftingSerializeItemSep));
    }

    // -------------------------------------------------------- asset index
    // CraftingAssets is built once by AssetLoadAll(); assets added by extensions later are missing.
    function refreshCraftingAssets(force = false) {
        if (typeof Asset === "undefined" || typeof CraftingAssetsPopulate !== "function") return false;
        if (!force && Asset === assetSignature.ref && Asset.length === assetSignature.length) return false;
        assetSignature = { ref: Asset, length: Asset.length };
        try {
            CraftingAssets = CraftingAssetsPopulate();
            return true;
        } catch (error) {
            console.warn(`${TAG} failed to rebuild the crafting asset index`, error);
            return false;
        }
    }

    function assetsFor(itemName) {
        if (typeof itemName !== "string" || !itemName) return [];
        refreshCraftingAssets();
        return (typeof CraftingAssets === "object" && CraftingAssets?.[itemName]) || [];
    }

    // ------------------------------------------------------- placeholders
    function buildPlaceholder(raw) {
        if (!validRaw(raw)) return null;
        const f = raw.split(CraftingSerializeFieldSep);
        const craft = {
            Item: f[0],
            Name: f[3] || f[0],
            Description: f[4] || "",
            Color: f[5] || "",
            Lock: f[2] || "",
            Private: f[6] === "T",
            ItemProperty: {},
            Type: undefined,
            TypeRecord: null,
            Effects: {},
            Partial: false,
        };
        Object.defineProperty(craft, RAW, { value: raw, enumerable: false, writable: true, configurable: true });
        return craft;
    }

    function placeholderSlots() {
        const out = [];
        if (!Array.isArray(Player?.Crafting)) return out;
        Player.Crafting.forEach((craft, i) => { if (isPlaceholder(craft)) out.push(i); });
        return out;
    }

    // Keep the legacy wire fields that the game's serializer blanks ("DO NOT REMOVE" fields) while the
    // craft still holds a legacy Type that has not been converted to a TypeRecord.
    function keepLegacyFields(craft, encoded) {
        if (!isPlain(craft) || typeof encoded !== "string" || !encoded) return encoded;
        const needType = craft.TypeRecord == null && typeof craft.Type === "string" && craft.Type !== "";
        const needProperty = typeof craft.Property === "string" && craft.Property !== "";
        if (!needType && !needProperty) return encoded;
        const fields = encoded.split(CraftingSerializeFieldSep);
        if (needProperty) fields[1] = craft.Property;
        if (needType) fields[7] = craft.Type;
        return fields.map((value) => value.replace(CraftingSerializeSanitize, "")).join(CraftingSerializeFieldSep);
    }

    function announce(name, indices, phase) {
        if (!indices.length) return;
        window.dispatchEvent(new CustomEvent(name, {
            detail: { indices: indices.slice(), count: indices.length, phase },
        }));
    }

    // Turn placeholders into real crafts once their asset exists in the index.
    function resolvePlaceholders(reason = "manual") {
        if (!loaded || !Array.isArray(Player?.Crafting)) return 0;
        const slots = placeholderSlots();
        if (!slots.length) return 0;
        refreshCraftingAssets();

        const resolved = [];
        let needSave = false;
        for (const i of slots) {
            const placeholder = Player.Crafting[i];
            const raw = placeholder[RAW];
            if (!assetsFor(rawItemName(raw)).length) continue;

            let real = null;
            try { real = CraftingDeserialize(raw); } catch (error) {
                console.warn(`${TAG} could not rebuild slot ${i}`, error);
            }
            if (real == null) continue;

            let status;
            try { status = CraftingValidate(real, null, false, true); } catch (error) {
                console.warn(`${TAG} validation threw for slot ${i}`, error);
                continue;
            }
            if (status === CraftingStatusType.OK) {
                Player.Crafting[i] = real;
                resolved.push(i);
            } else if (status === CraftingStatusType.ERROR) {
                // The validator repaired the craft in place; persist the repair.
                Player.Crafting[i] = real;
                resolved.push(i);
                needSave = true;
            } else {
                // The game itself would delete this one. Keep the placeholder (never drop silently).
                warnOnce(`critical-${i}-${raw}`, `slot ${i} (${rawItemName(raw)}) has its asset but failed validation; kept unchanged`);
            }
        }
        if (resolved.length) {
            console.info(`${TAG} resolved ${resolved.length} crafted item(s) (${reason})`);
            announce("HCRCraftingResolved", resolved, reason);
            if (needSave) CraftingSaveServer();
        }
        return resolved.length;
    }

    // ------------------------------------------------------------ backup
    function readBackupRoot() {
        let root = Player?.ExtensionSettings?.[BACKUP_ROOT];
        if (typeof root === "string") {
            try { root = JSON.parse(root); } catch (_) { return null; }
        }
        return isPlain(root) ? root : null;
    }

    function decodeSet(value, size) {
        if (value === "") return [];
        // LZString can decode invalid alphabet characters into non-empty garbage.
        if (typeof value !== "string" || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,3}$/.test(value)) return null;
        let text = null;
        try { text = LZString.decompressFromBase64(value); } catch (_) { text = null; }
        // A non-empty value must decode to something; "" would mean it is corrupt.
        if (typeof text !== "string" || text === "") return null;
        return text.split(CraftingSerializeItemSep).slice(0, size);
    }

    function packSet(list) {
        const copy = list.slice();
        while (copy.length && !copy[copy.length - 1]) copy.pop();
        if (!copy.length) return "";
        return LZString.compressToBase64(copy.join(CraftingSerializeItemSep));
    }

    // slots:    sets + legacy (0.1.x) backup, used for restoring holes
    // setSlots: sets only, used to decide whether a set needs to be written
    function readBackup() {
        const info = {
            slots: Array(SLOT_COUNT).fill(""),
            setSlots: Array(SLOT_COUNT).fill(""),
            invalid: [],
            persisted: false,
            hasLegacy: false,
            legacyItems: 0,
        };
        const root = readBackupRoot();
        if (!root) return info;

        const sets = isPlain(root.Backup) ? root.Backup : {};
        let persisted = true;
        for (const set of BACKUP_SETS) {
            const value = sets[set.name];
            if (typeof value !== "string") { persisted = false; continue; }
            const decoded = decodeSet(value, set.to - set.from);
            if (decoded === null) { info.invalid.push(set.name); persisted = false; continue; }
            decoded.forEach((raw, i) => {
                if (!validRaw(raw)) return;
                info.setSlots[set.from + i] = raw;
                info.slots[set.from + i] = raw;
            });
        }
        info.persisted = persisted;

        // 0.1.x single-packet backup (ExtensionSettings.HCR.p, LZ UTF16). Import only what is missing.
        if (typeof root.p === "string" && root.p) {
            info.hasLegacy = true;
            packetToRaw(root.p).forEach((raw, i) => {
                if (!info.slots[i] && validRaw(raw)) { info.slots[i] = raw; info.legacyItems++; }
            });
        }
        return info;
    }

    // Create the container for the nested keys when it does not exist yet. The nested paths below
    // only work if ExtensionSettings.HCR is already an object on the server.
    function ensureContainer() {
        const settings = Player?.ExtensionSettings;
        if (!settings) return false;
        const stored = settings[BACKUP_ROOT];
        let parsed = stored;
        const wasString = typeof stored === "string";
        if (wasString) {
            try { parsed = JSON.parse(stored); } catch (_) {
                warnOnce("corrupt-root", "ExtensionSettings.HCR is a corrupt string; refusing to overwrite it");
                return false;
            }
        }

        if (parsed === undefined || parsed === null || wasString) {
            if (parsed != null && !isPlain(parsed)) {
                warnOnce("odd-root", "ExtensionSettings.HCR has an unexpected type; refusing to overwrite it");
                return false;
            }
            // Preserve legacy data until both replacement sets have been sent successfully.
            const next = parsed == null ? { v: BACKUP_FORMAT } : { ...parsed };
            if (next.Backup === undefined) next.Backup = { set1: "", set2: "" };
            if (!isPlain(next.Backup)) return false;
            const payload = { [`ExtensionSettings.${BACKUP_ROOT}`]: next };
            if (utf8Bytes(JSON.stringify(["AccountUpdate", payload])) > PAYLOAD_BUDGET) return false;
            try {
                // Detach the queued snapshot from subsequent local set changes.
                ServerSend("AccountUpdate", JSON.parse(JSON.stringify(payload)));
            } catch (error) {
                console.error(`${TAG} failed to initialize backup container`, error);
                return false;
            }
            settings[BACKUP_ROOT] = next;
            return true;
        }
        if (!isPlain(parsed)) {
            warnOnce("odd-root", "ExtensionSettings.HCR has an unexpected type; refusing to overwrite it");
            return false;
        }
        if (parsed.Backup === undefined) {
            try {
                ServerSend("AccountUpdate", { [`ExtensionSettings.${BACKUP_ROOT}.Backup`]: { set1: "", set2: "" } });
            } catch (error) {
                console.error(`${TAG} failed to initialize backup sets`, error);
                return false;
            }
            parsed.Backup = { set1: "", set2: "" };
            return true;
        }
        if (!isPlain(parsed.Backup)) {
            warnOnce("odd-backup", "ExtensionSettings.HCR.Backup has an unexpected type; refusing to overwrite it");
            return false;
        }
        return true;
    }

    // One set = one AccountUpdate for exactly one nested path.
    function sendBackupSet(name, value) {
        const path = `ExtensionSettings.${BACKUP_ROOT}.Backup.${name}`;
        const payload = { [path]: value };
        const bytes = utf8Bytes(JSON.stringify(["AccountUpdate", payload]));
        if (bytes > PAYLOAD_BUDGET) {
            warnOnce(`oversize-${name}`, `${name} would use ${bytes} bytes (budget ${PAYLOAD_BUDGET}); not written, previous backup kept`);
            return false;
        }
        if (!ensureContainer()) return false;

        const backup = Player.ExtensionSettings[BACKUP_ROOT].Backup;
        const previous = backup[name];
        backup[name] = value;
        try {
            ServerSend("AccountUpdate", payload);
        } catch (error) {
            backup[name] = previous;
            console.error(`${TAG} failed to send ${path}`, error);
            return false;
        }
        console.info(`${TAG} backup ${name} updated (${bytes} bytes)`);
        return true;
    }

    function serializeCurrent() {
        const raw = Array(SLOT_COUNT).fill("");
        const failed = [];
        if (!Array.isArray(Player?.Crafting)) return { raw, failed };
        Player.Crafting.slice(0, SLOT_COUNT).forEach((craft, i) => {
            if (craft == null) return;
            let text = "";
            try { text = CraftingSerialize(craft); } catch (error) {
                console.warn(`${TAG} serialize failed for slot ${i}`, error);
            }
            if (validRaw(text)) raw[i] = text;
            else failed.push(i);
        });
        return { raw, failed };
    }

    // Mirror the current crafting list into the backup sets (only sets that changed).
    function syncBackup(reason = "save") {
        if (!loaded || !Array.isArray(Player?.Crafting) || !Player?.ExtensionSettings) return false;
        const { raw, failed } = serializeCurrent();
        const stored = readBackup();
        // A craft that cannot be serialized must never erase what the backup already holds.
        for (const i of failed) raw[i] = stored.slots[i];

        let ok = true;
        for (const set of BACKUP_SETS) {
            if (stored.invalid.includes(set.name)) {
                warnOnce(`invalid-${set.name}`, `${set.name} in ExtensionSettings is unreadable; leaving it untouched`);
                ok = false;
                continue;
            }
            const next = raw.slice(set.from, set.to);
            const prev = stored.setSlots.slice(set.from, set.to);
            const hasSet = typeof readBackupRoot()?.Backup?.[set.name] === "string";
            if (hasSet && next.every((value, i) => value === prev[i])) continue;
            if (!sendBackupSet(set.name, packSet(next))) ok = false;
        }
        if (!ok) console.warn(`${TAG} backup sync (${reason}) was incomplete`);
        // Clear the legacy source in the same session, before later deletions can be undone by it.
        // Failed serialization or incomplete sets must retain the old recovery source.
        if (ok && !failed.length && readBackup().persisted) clearLegacyBackup();
        return ok;
    }

    // After this session's sets are in place, the 0.1.x packet is redundant.
    function clearLegacyBackup() {
        const root = Player?.ExtensionSettings?.[BACKUP_ROOT];
        if (!isPlain(root) || typeof root.p !== "string" || root.p === "") return;
        try {
            ServerSend("AccountUpdate", { [`ExtensionSettings.${BACKUP_ROOT}.p`]: "" });
            root.p = "";
            console.info(`${TAG} cleared the legacy 0.1.x backup packet`);
        } catch (error) {
            console.warn(`${TAG} could not clear legacy backup`, error);
        }
    }

    // ------------------------------------------------------- load / merge
    // Server data is authoritative. The backup may only fill an EMPTY slot:
    //  - slot holds a valid item (same or different)  -> keep it; a different backup value means the
    //    slot was replaced, so the backup is stale and is NOT restored (counted as a conflict);
    //  - the identical item already exists in another slot (it was moved) -> not restored again.
    function mergeRaw(serverRaw, backupSlots) {
        const raw = Array(SLOT_COUNT).fill("");
        const restored = [];
        const conflicts = [];
        const duplicates = [];
        const present = new Set();
        for (let i = 0; i < SLOT_COUNT; i++) {
            if (validRaw(serverRaw[i])) { raw[i] = serverRaw[i]; present.add(serverRaw[i]); }
        }
        for (let i = 0; i < SLOT_COUNT; i++) {
            const backup = backupSlots[i];
            if (!backup) continue;
            if (raw[i]) {
                if (raw[i] !== backup) conflicts.push(i);
            } else if (present.has(backup)) {
                duplicates.push(i);
            } else {
                raw[i] = backup;
                present.add(backup);
                restored.push(i);
            }
        }
        return { raw, restored, conflicts, duplicates };
    }

    function finishLoad(ctx) {
        if (!Array.isArray(Player?.Crafting)) return;

        // Things the game still rejected (asset present but the craft is invalid): never silent.
        const rejected = [];
        for (let i = 0; i < SLOT_COUNT; i++) {
            if (ctx.merged.raw[i] && Player.Crafting[i] == null) rejected.push({ slot: i, raw: ctx.merged.raw[i] });
        }
        if (rejected.length) console.error(`${TAG} the game rejected ${rejected.length} crafted item(s) with a known asset; raw data:`, rejected);

        loaded = true;
        if (ctx.merged.restored.length) {
            console.warn(`${TAG} restored ${ctx.merged.restored.length} crafted item(s) from backup`);
            CraftingSaveServer(); // pushes the repaired list to the server; the hook mirrors the backup
            announce("HCRCraftingRestored", ctx.merged.restored, "initialization");
        } else {
            syncBackup("initialization");
        }
        // Assets may already be available (rebuilt index), so try once right away.
        resolvePlaceholders("initialization");
    }

    async function lateReconcile() {
        // HCR was installed after the account had already loaded: the game's null entries are gone,
        // but the backup can still fill holes.
        if (loaded || loading || !isLoggedIn() || !Array.isArray(Player?.Crafting)) return;
        const backup = readBackup();
        const { raw } = serializeCurrent();
        const hasHole = mergeRaw(raw, backup.slots).restored.length > 0;
        if (hasHole) CraftingLoadServer(rawToPacket(raw)); // goes through the hook below
        else {
            loaded = true;
            syncBackup("late");
            resolvePlaceholders("late");
        }
    }

    // ------------------------------------------------------------ display
    function installSlotDisplayPatch() {
        const original = CraftingSlots._createButtonAllSections;
        if (typeof original !== "function" || original.__likoCraftingAssetRecovery) return;

        const patched = function (mode, options = null) {
            const result = original.call(this, mode, options);
            for (const args of result?.modeArgs || []) {
                const craft = args.craft;
                if (!craft) continue;
                if (!isPlaceholder(craft) && assetsFor(craft.Item).length) continue;

                const oldButton = args.button;
                const index = oldButton?.getAttribute("data-index");
                if (!oldButton || index == null) continue;

                const button = ElementButton.Create(
                    null,
                    null,
                    {
                        label: ElementCreate({ tag: "span", children: [craft.Name || craft.Item || "?"] }),
                        labelPosition: "right",
                        image: WARNING_IMAGE,
                        tooltip: tooltip(),
                    },
                    {
                        button: {
                            classList: ["crafting-slot-button", "crafting-slot-unresolved"],
                            dataAttributes: { index },
                        },
                    }
                );
                if (mode === "Slot") {
                    // Mode listeners are attached after this function returns. A capture listener
                    // blocks only editor entry while leaving Delete/Reorder modes available.
                    button.addEventListener("click", (event) => {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                    }, true);
                }
                oldButton.replaceWith(button);
                args.button = button;
            }
            return result;
        };
        patched.__likoCraftingAssetRecovery = true;
        CraftingSlots._createButtonAllSections = patched;
    }

    // --------------------------------------------------------------- init
    Promise.all([
        waitFor(() => typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function"),
        waitFor(() => typeof CraftingValidate === "function"
            && typeof CraftingLoadServer === "function"
            && typeof CraftingSaveServer === "function"
            && typeof CraftingSerialize === "function"
            && typeof CraftingDeserialize === "function"
            && typeof CraftingAssetsPopulate === "function"
            && typeof CraftingSlots === "object"
            && typeof ElementButton === "object"
            && typeof ServerSend === "function"
            && typeof LZString === "object"
            && typeof CraftingSerializeFieldSep === "string"),
    ]).then(([sdkReady, gameReady]) => {
        if (!sdkReady || !gameReady) {
            console.error(`${TAG} ModSDK or Crafting API unavailable`);
            return;
        }

        let modApi;
        try {
            modApi = bcModSdk.registerMod({
                name: "Liko - HCR",
                fullName: "Hotfix - Crafting Asset Recovery",
                version: MOD_VERSION,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
            });
        } catch (error) {
            console.error(`${TAG} ModSDK registration failed`, error);
            return;
        }

        // Unknown-asset items become placeholders instead of null, but only while the account loads.
        modApi.hookFunction("CraftingDeserialize", 100, (args, next) => {
            const result = next(args);
            if (result != null || !loading || assetsFor(rawItemName(args[0])).length) return result;
            return buildPlaceholder(args[0]);
        });

        // A placeholder is preserved, not validated.
        modApi.hookFunction("CraftingValidate", 100, (args, next) => {
            if (isPlaceholder(args[0])) return CraftingStatusType.OK;
            return next(args);
        });

        // A placeholder serializes back to exactly what the server sent.
        modApi.hookFunction("CraftingSerialize", 100, (args, next) => {
            const craft = args[0];
            if (isPlaceholder(craft)) return craft[RAW];
            return keepLegacyFields(craft, next(args));
        });

        modApi.hookFunction("CraftingSaveServer", 100, (args, next) => {
            const result = next(args);
            syncBackup("crafting-change");
            return result;
        });

        modApi.hookFunction("CraftingLoadServer", 100, (args, next) => {
            loaded = false;
            warnedOnce.clear();
            refreshCraftingAssets(true);

            const serverRaw = packetToRaw(args[0]);
            const backup = readBackup();
            const merged = mergeRaw(serverRaw, backup.slots);
            if (backup.invalid.length) console.error(`${TAG} unreadable backup set(s):`, backup.invalid);
            if (merged.conflicts.length || merged.duplicates.length) {
                console.info(`${TAG} backup not applied: ${merged.conflicts.length} replaced slot(s), ${merged.duplicates.length} moved/duplicate slot(s)`);
            }

            let result;
            loading = true;
            try {
                result = next([rawToPacket(merged.raw)]);
            } finally {
                loading = false;
            }
            try {
                finishLoad({ merged });
            } catch (error) {
                loaded = true;
                console.error(`${TAG} post-load reconciliation failed`, error);
            }
            return result;
        });

        // Entering the crafting room is a good moment to pick up assets that arrived late.
        if (typeof CraftingLoad === "function") {
            modApi.hookFunction("CraftingLoad", 100, (args, next) => {
                try {
                    refreshCraftingAssets(true);
                    resolvePlaceholders("screen");
                } catch (error) {
                    console.warn(`${TAG} resolve on screen load failed`, error);
                }
                return next(args);
            });
        }

        installSlotDisplayPatch();

        setInterval(() => {
            if (!loaded || !placeholderSlots().length) return;
            if (refreshCraftingAssets()) resolvePlaceholders("assets-changed");
        }, RESOLVE_POLL_MS);

        window.Liko.HCR = {
            version: MOD_VERSION,
            assetsFor,
            tooltip,
            warningImage: WARNING_IMAGE,
            status() {
                const info = readBackup();
                const root = readBackupRoot();
                const sets = {};
                for (const set of BACKUP_SETS) {
                    const value = isPlain(root?.Backup) ? root.Backup[set.name] : undefined;
                    sets[set.name] = {
                        items: info.setSlots.slice(set.from, set.to).filter(Boolean).length,
                        bytes: typeof value === "string" ? utf8Bytes(value) : null,
                    };
                }
                return {
                    version: MOD_VERSION,
                    loaded,
                    placeholders: placeholderSlots().map((i) => ({ slot: i, item: Player.Crafting[i].Item })),
                    backup: { ...sets, invalid: info.invalid, legacyPacketPresent: info.hasLegacy },
                };
            },
            backup: {
                read: () => readBackup().slots.slice(),
                save: () => syncBackup("manual"),
                reconcile: () => resolvePlaceholders("manual"),
            },
        };

        if (isLoggedIn()) setTimeout(() => { lateReconcile().catch((error) => console.error(`${TAG} late reconcile failed`, error)); }, 500);
        console.log(`${TAG} v${MOD_VERSION} loaded`);
    });
})();
