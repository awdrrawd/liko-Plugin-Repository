// ==UserScript==
// @name           Hotfix - ECHO LegsOpen Pose Warning Fix
// @name:zh        ECHO LegsOpen 姿勢警告修正
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        0.1
// @description    Silence the spammy `Item.AllowActivePose: Ignoring invalid "LegsOpen" pose` warning and report which items still carry the obsolete pose name.
// @description:zh 消除一直洗版的 `Item.AllowActivePose: Ignoring invalid "LegsOpen" pose` 警告，並列出還帶著舊姿勢名稱的物品，方便回報給 ECHO 作者。
// @author         likolisu
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant          none
// @run-at         document-end
// ==/UserScript==

/* global PoseRecord, PoseToMapping, Player, Asset, InventoryGetItemProperty */

(function () {
    "use strict";
    window.Liko = window.Liko ?? {};
    if (window.Liko.ECHOPoseFix) return;

    const TAG = "[EchoPoseFix]";
    // Poses BC no longer knows (renamed/removed). Kept only for the report label.
    // "LegsOpen" was renamed to "Spread" years ago; ECHO's data still uses the old name.
    const dropped = new Set();

    const isValid = (p) => !!(typeof PoseRecord !== "undefined" && PoseRecord[p]);

    // --- 1. Silence at the single choke point -------------------------------
    // Both `Item.AllowActivePose` and `Item.SetPose` warnings come from
    // PoseToMapping.Array / .Scalar (Pose.js). Filtering the input array there
    // is behaviour-identical to what BC already does (it ignores the pose),
    // minus the console spam.
    function wrap(name) {
        const orig = PoseToMapping[name];
        if (typeof orig !== "function" || orig.__echoPoseFix) return;
        const patched = function (poses, prefix) {
            if (Array.isArray(poses)) {
                const clean = poses.filter((p) => {
                    if (isValid(p)) return true;
                    if (!dropped.has(p)) {
                        dropped.add(p);
                        console.info(`${TAG} dropping obsolete pose "${p}" (via ${prefix || "?"})`);
                    }
                    return false;
                });
                if (clean.length !== poses.length) poses = clean;
            }
            return orig.call(this, poses, prefix);
        };
        patched.__echoPoseFix = true;
        PoseToMapping[name] = patched;
    }

    // --- 2. Diagnostic: which assets/items still carry an invalid pose -------
    function scanFields(getPoses) {
        const hits = [];
        for (const item of Player?.Appearance ?? []) {
            for (const field of ["AllowActivePose", "SetPose"]) {
                const arr = getPoses(item, field);
                const bad = (arr ?? []).filter((p) => !isValid(p));
                if (bad.length) {
                    hits.push({
                        Group: item.Asset?.Group?.Name,
                        Asset: item.Asset?.Name,
                        Field: field,
                        Invalid: bad,
                    });
                }
            }
        }
        return hits;
    }

    function scan() {
        const hits = scanFields((item, field) => InventoryGetItemProperty(item, field));
        if (hits.length) {
            console.warn(`${TAG} equipped items with obsolete poses (report these to the ECHO author):`);
            console.table(hits);
        } else {
            console.info(`${TAG} no equipped item currently carries an obsolete pose.`);
        }
        return hits;
    }

    // --- boot: wait until BC pose tables exist ------------------------------
    let tries = 0;
    const timer = setInterval(() => {
        if (typeof PoseToMapping !== "undefined" && typeof PoseRecord !== "undefined") {
            clearInterval(timer);
            wrap("Array");
            wrap("Scalar");
            window.Liko.PoseFix = { version: "0.1", scan, dropped };
            console.info(`${TAG} active. Run Liko.PoseFix.scan() to list offending items.`);
        } else if (++tries > 120) {
            clearInterval(timer);
            console.warn(`${TAG} gave up waiting for BC pose tables.`);
        }
    }, 500);
})();

// ---- self-check (run in a plain page console, not required in-game) --------
// globalThis.PoseRecord = { Spread: {}, LegsClosed: {} };
// let seen; globalThis.PoseToMapping = { Array:(p)=>{seen=p;} };
// ...load this IIFE... then:
// PoseToMapping.Array(["Spread","LegsOpen"], "Item.AllowActivePose");
// console.assert(JSON.stringify(seen) === '["Spread"]', "LegsOpen must be dropped, Spread kept");
