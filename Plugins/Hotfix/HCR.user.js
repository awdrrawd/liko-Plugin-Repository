// ==UserScript==
// @name         Hotfix - Crafting Asset Recovery (HCR)
// @name:zh      熱修 - 製作物品的擴充物品資產保護 
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.1
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

    const MOD_VERSION = "0.1";
    const UNKNOWN_ASSET = -1;
    const TAG = "🐈‍⬛ [HCR]";
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

    function waitFor(predicate, timeout = 30000) {
        const start = Date.now();
        return new Promise((resolve) => {
            (function check() {
                if (predicate()) return resolve(true);
                if (Date.now() - start >= timeout) return resolve(false);
                setTimeout(check, 50);
            })();
        });
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

    function populateAssets() {
        try {
            return typeof CraftingAssetsPopulate === "function" ? CraftingAssetsPopulate() : {};
        } catch (error) {
            console.warn(`${TAG} failed to rebuild the crafting asset index`, error);
            return {};
        }
    }

    function assetsFor(itemName) {
        if (typeof itemName !== "string" || !itemName) return [];
        const indexed = typeof CraftingAssets === "object" ? CraftingAssets[itemName] : undefined;
        if (indexed?.length) return indexed;

        const refreshed = populateAssets();
        const assets = refreshed[itemName] || [];
        if (assets.length) {
            // Keep the game's snapshot synchronized so later unhooked lookups also succeed.
            try { CraftingAssets = refreshed; } catch (_) { /* lexical globals may be read-only from some loaders */ }
        }
        return assets;
    }

    function installSlotDisplayPatch() {
        const original = CraftingSlots._createButtonAllSections;
        if (typeof original !== "function" || original.__likoCraftingAssetRecovery) return;

        const patched = function (mode, options = null) {
            const result = original.call(this, mode, options);
            for (const args of result?.modeArgs || []) {
                const craft = args.craft;
                if (!craft || assetsFor(craft.Item).length) continue;

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

    Promise.all([
        waitFor(() => typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function"),
        waitFor(() => typeof CraftingValidate === "function"
            && typeof CraftingLoadServer === "function"
            && typeof CraftingDecompressServerData === "function"
            && typeof CraftingSlots === "object"
            && typeof ElementButton === "object"),
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

        try { CraftingStatusType.UNKNOWN_ASSET = UNKNOWN_ASSET; } catch (_) { /* optional diagnostic enum */ }

        modApi.hookFunction("CraftingValidate", 100, (args, next) => {
            const [craft, suppliedAsset] = args;
            if (CommonIsObject(craft) && suppliedAsset == null) {
                const assets = assetsFor(craft.Item);
                if (!assets.length) return UNKNOWN_ASSET;
                // Passing the resolved asset bypasses a stale CraftingAssets snapshot in the original validator.
                args[1] = assets[0];
            }
            return next(args);
        });

        modApi.hookFunction("CraftingLoadServer", 100, (args) => {
            Player.Crafting = [];
            let refresh = false;
            const criticalErrors = {};
            const data = CraftingDecompressServerData(args[0]);

            for (const [i, item] of CommonEnumerate(data)) {
                if (item == null) {
                    Player.Crafting.push(null);
                    continue;
                }

                const status = CraftingValidate(item, undefined, undefined, true);
                if (status === CraftingStatusType.OK || status === UNKNOWN_ASSET) {
                    Player.Crafting.push(item);
                } else if (status === CraftingStatusType.ERROR) {
                    Player.Crafting.push(item);
                    refresh = true;
                } else {
                    Player.Crafting.push(null);
                    refresh = true;
                    criticalErrors[i] = item;
                }
                if (Player.Crafting.length >= 200) break;
            }

            if (refresh) {
                const count = Object.keys(criticalErrors).length;
                if (count) console.error(`Removing ${count} corrupted crafted items`, criticalErrors);
                CraftingSaveServer();
            }
        });

        installSlotDisplayPatch();
        window.Liko.HCR = {
            version: MOD_VERSION,
            assetsFor,
            tooltip,
            warningImage: WARNING_IMAGE,
        };
        console.log(`${TAG} v${MOD_VERSION} loaded`);
    });
})();
