// ==UserScript==
// @name         Hotfix - R133 Echo compatibility fix
// @namespace    TheSecretCoder-BC
// @version      0.1.0
// @description  R133 fixes for Echo's clothing mod and activity mod. Starts the mod, draws in the right place, redraws Chinese-named items, keeps swapped-in art cached, restores instant redraw and wardrobe renaming, and fixes DrawGetImage crashes. Every part turns itself off once Echo ships its own fix.
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @run-at       document-start
// @grant        none
// ==/UserScript==

/*
 * WHEN TO REMOVE THIS SCRIPT
 *   Once Echo ships its R133 fix, open the console and look for lines that
 *   start with "[EchoR133Fix]" saying "skipped", "redirected" or "rewrote".
 *   If none appear after Echo has loaded, nothing here is doing anything and
 *   you can delete the script. window.EchoR133Fix lists what was applied.
 *
 * PART 1: LET THE MOD START
 *   R133 removed DrawRefreshCharacterForImage and LoginPerformCraftingFixups.
 *   Echo's clothing mod (服装拓展) hooks both. ModSDK throws on a missing
 *   function and the first throw aborts the mod's setup before it registers
 *   any items.
 *
 *   window.bcModSdk is wrapped so that, for the mods in GUARDED_MODS only, a
 *   hook or patch on a function this game version lacks no longer throws:
 *     - hookFunction("DrawRefreshCharacterForImage") is moved onto R133's
 *       ImageCache._refreshCharactersForImage (Part 1d), so drink icons and
 *       arm masks redraw as soon as they load, as before.
 *     - hookFunction("LoginPerformCraftingFixups") is moved onto
 *       WardrobeFixLength, which R133 calls right after the wardrobe is
 *       loaded at login, so retired Echo items in saved outfits are renamed.
 *     - patchFunction("DrawRefreshCharacterForImage") is dropped, because
 *       Part 2 does the same job.
 *     - anything else that is missing is skipped with a console warning.
 *   Every other mod, and every call on a function that exists, goes straight
 *   to the real ModSDK.
 *
 * PART 1b: CHARACTER POSITION
 *   Echo widens the character canvas and draws everything 250px to the right,
 *   then shifts the result back in DrawCharacter. R133 changed the
 *   "GLDrawImage(..., 0)," calls in GLDrawAppearanceBuild to end in ";", so
 *   the keys that add the +250 stop matching while the -250 still applies:
 *   bodies and clothes land 250px left. The comma is dropped from those keys,
 *   which then match old and new game versions.
 *
 * PART 1c: ACTIVITY MOD, CUSTOM-BACKGROUND ROOMS
 *   Echo's activity mod (动作拓展) patches ChatRoomCharacterViewDraw with three
 *   keys. R133 changed the line one of them targets to
 *   "if (backgroundURL && charIdx % charsPerRow === 0) {", so the key that
 *   declares pidx stops matching while the one that uses it still applies:
 *   "ReferenceError: pidx is not defined" every frame in rooms with a custom
 *   background. The stale key is swapped for the new form.
 *
 * PART 1d: IMAGE-LOADED BRIDGE
 *   R133 has no DrawRefreshCharacterForImage. The nearest thing is
 *   ImageCache._refreshCharactersForImage(CachedImage), called on every load
 *   or failure. A small chain on that method runs the redirected Echo hooks,
 *   handing them {src: url} like the old <img> argument.
 *
 * PART 2: REDRAW CHINESE-NAMED ITEMS
 *   R133's ImageCache matches a loaded image to worn assets via the URL's
 *   percent-encoded pathname, so "奶茶_底色.png" never matches. This decodes
 *   the path first.
 *
 * PART 3: KEEP SUBSTITUTED ART CACHED WHILE WORN
 *   R133 evicts cached images unused for 30 minutes and keeps worn items alive
 *   by re-touching every URL in each shown character's DrawnAssets. That list
 *   records the path the game asked for, before mods like Echo swap in art from
 *   their own CDN, so the replacement is never touched and is evicted while
 *   still worn. This also records the URL actually drawn.
 *   Registers as a small ModSDK mod named "EchoR133Fix".
 *
 * PART 4: DrawGetImage RETURN TYPE
 *   R132's DrawGetImage always returned an <img>, possibly still loading. R133
 *   returns undefined until loaded, then an ImageBitmap.
 *   a) ImageBitmap gets a .complete that returns true (every ImageBitmap the
 *      game hands out is already decoded).
 *   b) When Echo's own code (identified from the call stack, and only when the
 *      image isn't loaded yet) gets undefined, it gets a loading <img> for the
 *      same URL instead, as R132 did. When that <img> finishes loading, all
 *      characters are marked for redraw (debounced), so canvases that Echo
 *      cached while the image was missing are rebuilt.
 *
 * PART 5: NO REVALIDATION OF PINNED CDN IMAGES
 *   R133's BrowserCache re-checks every cached image once per session with a
 *   conditional request (If-None-Match / If-Modified-Since). Those headers are
 *   not CORS-safelisted, so for a cross-origin CDN the browser sends a
 *   preflight first, and if the CDN doesn't allow it fetch() throws. The game
 *   then logs "GET request to ... failed (undefined) - retrying" up to 10
 *   times per image. Echo's images live on jsDelivr at a pinned commit
 *   (".../echo-clothing-ext@<hash>/..."), which never changes, so the check is
 *   pointless there. Revalidation is skipped for those URLs only; the cached
 *   copy is used as before.
 *
 * PART 1e: COLOR-NAME CSV PATHS
 *   R133 moved Assets/<family>/ColorGroups.csv and LayerNames.csv to
 *   Assets/ColorGroups.csv and Assets/LayerNames.csv, so ItemColorLoad now
 *   reads "`Assets/ColorGroups.csv`". Echo patches ItemColorLoad with keys
 *   written against "`Assets/${c.AssetFamily}/ColorGroups.csv`", which stop
 *   matching ("Patching ItemColorLoad ... not applied"). Any key (and its
 *   replacement) containing "Assets/${c.AssetFamily}/" is rewritten to
 *   "Assets/", but only if the game's ItemColorLoad no longer uses the old form.
 *
 * Every part checks what it is changing and does nothing, with a console note,
 * if a future game version no longer matches.
 */

(function () {
	"use strict";
	const tag = "[EchoR133Fix]";
	const VERSION = "0.1.0";

	// ModInfo.name of the mods to guard: Echo's clothing and activity mods.
	const GUARDED_MODS = new Set(["服装拓展", "动作拓展"]);

	/** What this script did, for diagnosis: window.EchoR133Fix */
	const status = { version: VERSION, applied: [], skipped: [] };
	try {
		window.EchoR133Fix = status;
	} catch (e) { /* ignore */ }
	const note = (what) => { status.applied.push(what); console.log(tag, what); };
	const warn = (what) => { status.skipped.push(what); console.warn(tag, what); };

	// ---- helpers ----------------------------------------------------------

	/** @param {string} path e.g. "DrawCharacter" or "GLDrawImageCache._refreshCharactersForImage" */
	function functionExists(path) {
		try {
			return typeof path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window) === "function";
		} catch (e) {
			return false;
		}
	}

	// R133+ marker: this function was removed in R133.
	const isR133Plus = () => !functionExists("DrawRefreshCharacterForImage");

	/** The game's ImageCache prototype (shared by every cache), once a cache exists. */
	function imageCacheProto() {
		const cache = window.GLDrawImageCache || window.DrawImageCache;
		return cache ? Object.getPrototypeOf(cache) : null;
	}

	// ---- part 1d: image-loaded bridge ---------------------------------------

	/** @type {{ priority: number, cb: Function }[]} Echo hooks that were meant for DrawRefreshCharacterForImage */
	const imageListeners = [];
	let bridgeInstalled = false;

	function addImageListener(priority, cb) {
		imageListeners.push({ priority, cb });
		imageListeners.sort((a, b) => b.priority - a.priority);
		// A function that removes the listener, like the real hookFunction returns.
		return () => {
			const i = imageListeners.findIndex((l) => l.cb === cb);
			if (i !== -1) imageListeners.splice(i, 1);
		};
	}

	/** Must run after part 2 (which re-creates the method from its source). */
	function installImageBridge() {
		if (bridgeInstalled) return true;
		const proto = imageCacheProto();
		if (!proto) return false;
		const orig = proto._refreshCharactersForImage;
		if (typeof orig !== "function") {
			warn("part 1d: _refreshCharactersForImage not found; Echo's redirected image hooks will not run.");
			bridgeInstalled = true;
			return true;
		}
		proto._refreshCharactersForImage = function (img) {
			const self = this;
			const run = (i, args) => {
				if (i >= imageListeners.length) return orig.apply(self, args);
				const next = (a) => run(i + 1, a || args);
				try {
					// Echo's hooks read args[0].src, as the old <img> had.
					return imageListeners[i].cb([{ src: args[0] && args[0].url }], () => next(args));
				} catch (e) {
					console.error(tag, "redirected image hook failed:", e);
					return next(args);
				}
			};
			return run(0, [img]);
		};
		bridgeInstalled = true;
		note("image-loaded bridge installed (part 1d)");
		return true;
	}

	// ---- part 1: ModSDK guard ---------------------------------------------

	// Removed R132 functions whose job moved elsewhere in R133.
	// kind -> how to emulate hookFunction (hook) or what to do with patchFunction (patch).
	const REDIRECTS = {
		DrawRefreshCharacterForImage: {
			hook: (mod, priority, cb, modName) => {
				note(`${modName}: redirected hookFunction("DrawRefreshCharacterForImage") to the image-loaded bridge`);
				return addImageListener(priority, cb);
			},
			// Part 2 already decodes the path; the mod's own patch would have nothing to patch.
			patch: (modName) => note(`${modName}: dropped patchFunction("DrawRefreshCharacterForImage"); part 2 covers it`),
		},
		LoginPerformCraftingFixups: {
			// WardrobeFixLength runs straight after Player.Wardrobe is loaded at login.
			hook: (mod, priority, cb, modName) => {
				if (!functionExists("WardrobeFixLength")) {
					warn(`${modName}: WardrobeFixLength not found; wardrobe renaming skipped.`);
					return () => {};
				}
				note(`${modName}: redirected hookFunction("LoginPerformCraftingFixups") to WardrobeFixLength`);
				return mod.hookFunction("WardrobeFixLength", priority, cb);
			},
		},
	};

	// Patch keys that R133 broke. Each rule rewrites one stale key (and its replacement
	// text) into the form R133 needs. A rule is skipped if the mod already sends the
	// new key (a fixed Echo build), if the replacement text isn't what was expected,
	// or if its "when" test fails.
	const needsBackgroundFix = () => {
		try {
			if (String(window.ChatRoomCharacterViewDraw).includes("backgroundURL && charIdx % charsPerRow === 0")) return true;
		} catch (e) { /* fall through */ }
		return isR133Plus();
	};

	const REKEY = {
		// 服装拓展 drawMod.js: calls now end in ";" instead of ","
		GLDrawAppearanceBuild: [
			{
				from: "GLDrawImage(src, gl, x, y, opts, 0),",
				to: "GLDrawImage(src, gl, x, y, opts, 0)",
				value: (v) => (v.endsWith(",") ? v.slice(0, -1) : null),
			},
			{
				from: "GLDrawImage(src, gl, x, y, opts, blinkOffset),",
				to: "GLDrawImage(src, gl, x, y, opts, blinkOffset)",
				value: (v) => (v.endsWith(",") ? v.slice(0, -1) : null),
			},
		],
		// 动作拓展 (bc-modding-utilities XCharacterDrawlist.js): background check gained "backgroundURL &&"
		ChatRoomCharacterViewDraw: [
			{
				from: "if (charIdx % charsPerRow === 0) {",
				to: "if (backgroundURL && charIdx % charsPerRow === 0) {",
				value: (v) => (v.endsWith("if (pflag) {") ? v.slice(0, -"if (pflag) {".length) + "if (backgroundURL && pflag) {" : null),
				when: needsBackgroundFix,
			},
		],
	};

	// 服装拓展: ItemColorLoad keys that still use the old per-family CSV path.
	const OLD_FAMILY_PATH = "Assets/${c.AssetFamily}/";
	function rekeyFamilyPaths(patches, modName) {
		if (!patches || typeof patches !== "object") return patches;
		if (!Object.keys(patches).some((k) => k.includes(OLD_FAMILY_PATH))) return patches;
		let stillOld = false;
		try { stillOld = String(window.ItemColorLoad).includes(OLD_FAMILY_PATH); } catch (e) { /* assume new */ }
		if (stillOld) return patches; // older game version, keys are right as they are
		const out = {};
		for (const [k, v] of Object.entries(patches)) {
			if (!k.includes(OLD_FAMILY_PATH)) { out[k] = v; continue; }
			const nk = k.split(OLD_FAMILY_PATH).join("Assets/");
			out[nk] = typeof v === "string" ? v.split(OLD_FAMILY_PATH).join("Assets/") : v;
			note(`${modName}: rewrote ItemColorLoad patch key for this game version: ${nk}`);
		}
		return out;
	}

	function rekey(fnName, patches, modName) {
		if (fnName === "ItemColorLoad") return rekeyFamilyPaths(patches, modName);
		const rules = REKEY[fnName];
		if (!rules || !patches || typeof patches !== "object") return patches;
		const out = { ...patches };
		for (const rule of rules) {
			if (!(rule.from in out) || rule.to in out) continue;
			if (rule.when && !rule.when()) continue;
			const value = typeof out[rule.from] === "string" ? rule.value(out[rule.from]) : null;
			if (value == null) {
				warn(`${modName}: ${fnName} patch has unexpected replacement text; left as is.`);
				continue;
			}
			// Rebuild the object so the key keeps its position in the patch order.
			const rebuilt = {};
			for (const [k, v] of Object.entries(out)) {
				if (k === rule.from) rebuilt[rule.to] = value;
				else rebuilt[k] = v;
			}
			Object.keys(out).forEach((k) => delete out[k]);
			Object.assign(out, rebuilt);
			note(`${modName}: rewrote ${fnName} patch key for this game version: ${rule.to}`);
		}
		return out;
	}

	function guardMod(mod, modName) {
		const missing = (method, name) => typeof name === "string" && !functionExists(name);

		return Object.freeze({
			...mod,
			hookFunction(name, priority, cb) {
				if (missing("hookFunction", name)) {
					const redirect = REDIRECTS[name] && REDIRECTS[name].hook;
					if (redirect) return redirect(mod, priority, cb, modName);
					warn(`${modName}: skipped hookFunction("${name}"), which this game version doesn't have.`);
					return () => {};
				}
				return mod.hookFunction(name, priority, cb);
			},
			patchFunction(name, patches) {
				if (missing("patchFunction", name)) {
					const redirect = REDIRECTS[name] && REDIRECTS[name].patch;
					if (redirect) redirect(modName);
					else warn(`${modName}: skipped patchFunction("${name}"), which this game version doesn't have.`);
					return undefined;
				}
				return mod.patchFunction(name, rekey(name, patches, modName));
			},
		});
	}

	let realSdk = null;

	function wrapSdk() {
		const sdk = window.bcModSdk;
		if (!sdk) return false;
		if (sdk.__echoR133Fix) return true;
		realSdk = sdk;
		if (sdk.apiVersion !== 1 || typeof sdk.registerMod !== "function") {
			warn("unrecognised ModSDK; part 1 not applied.");
			return true;
		}
		try {
			window.bcModSdk = Object.freeze({
				// Same version and apiVersion, so ModSDK copies loaded later by mods reuse this.
				version: sdk.version,
				apiVersion: sdk.apiVersion,
				registerMod(info, options) {
					const mod = sdk.registerMod(info, options);
					return info && GUARDED_MODS.has(info.name) ? guardMod(mod, info.name) : mod;
				},
				getModsInfo: (...a) => sdk.getModsInfo(...a),
				getPatchingInfo: (...a) => sdk.getPatchingInfo(...a),
				errorReporterHooks: sdk.errorReporterHooks,
				__echoR133Fix: true,
			});
			console.log(tag, "ModSDK guard installed for", [...GUARDED_MODS]);
		} catch (e) {
			console.error(tag, "could not install ModSDK guard:", e);
		}
		return true;
	}

	// ---- part 2: decoded image path ---------------------------------------

	const KEY = "const path = new URL(img.url, location.href).pathname;";
	const FIX = "let path = new URL(img.url, location.href).pathname; try { path = decodeURI(path); } catch (e) {}";

	function fixRefresh() {
		const proto = imageCacheProto();
		if (!proto) return false;
		const fn = proto._refreshCharactersForImage;
		if (typeof fn !== "function") {
			warn("_refreshCharactersForImage not found; part 2 not applied.");
			return installImageBridge() || true;
		}
		if (!fn.__echoR133Fix) {
			const src = fn.toString();
			const hits = src.split(KEY).length - 1;
			if (hits !== 1) {
				warn(`part 2: expected 1 match, found ${hits}; not applied.`);
			} else {
				try {
					const patched = (0, eval)("(function " + src.replace(KEY, FIX) + ")");
					patched.__echoR133Fix = true;
					proto._refreshCharactersForImage = patched;
					note("image refresh path decoding applied (part 2)");
				} catch (e) {
					console.error(tag, "could not apply image refresh fix:", e);
				}
			}
		}
		// The bridge wraps whatever the method is now, so it always goes second.
		return installImageBridge();
	}

	// ---- part 5: skip revalidation of pinned jsDelivr images ----------------

	const PINNED_CDN = /^https:\/\/cdn\.jsdelivr\.net\/gh\/[^/]+\/[^/@]+@[0-9a-f]{7,40}\//i;

	function fixRevalidate() {
		const cache = window.GLDrawImageCache || window.DrawImageCache;
		if (!cache) return false;
		const store = cache.browserCache;
		if (!store) return true; // no persistent store, nothing is revalidated
		const proto = Object.getPrototypeOf(store);
		const orig = proto && proto._revalidate;
		if (typeof orig !== "function") {
			warn("part 5: BrowserCache._revalidate not found; not applied.");
			return true;
		}
		if (orig.__echoR133Fix) return true;
		const patched = function (key, url, ...rest) {
			if (typeof url === "string" && PINNED_CDN.test(url)) {
				try { this._revalidated.add(key); } catch (e) { /* ignore */ }
				return;
			}
			return orig.call(this, key, url, ...rest);
		};
		patched.__echoR133Fix = true;
		proto._revalidate = patched;
		note("revalidation skipped for pinned jsDelivr images (part 5)");
		return true;
	}

	// ---- part 3 and 4: drawn-asset warming, DrawGetImage ----------------------

	const ECHO_CALLER = /sugarchain|echo-(clothing|activity)-ext/i;

	/** True if Echo's code is on the call stack. Chrome keeps only 10 frames by default and ModSDK's hook chain eats most of them, so the limit is raised for the capture. */
	function calledByEcho() {
		const old = Error.stackTraceLimit;
		try {
			Error.stackTraceLimit = 100;
			return ECHO_CALLER.test(new Error().stack || "");
		} catch (e) {
			return false;
		} finally {
			Error.stackTraceLimit = old;
		}
	}
	const legacyImages = new Map();
	let redrawTimer = 0;

	function scheduleRedraw() {
		if (redrawTimer) return;
		redrawTimer = setTimeout(() => {
			redrawTimer = 0;
			try {
				for (const c of Character) c.MustDraw = true;
			} catch (e) { /* game not ready */ }
		}, 250);
	}

	function legacyImage(url) {
		let img = legacyImages.get(url);
		if (!img) {
			img = new Image();
			img.crossOrigin = "anonymous";
			img.addEventListener("load", scheduleRedraw);
			img.src = url;
			legacyImages.set(url, img);
		}
		return img;
	}

	function fixImageBitmapComplete() {
		if (typeof ImageBitmap === "undefined" || "complete" in ImageBitmap.prototype) return;
		try {
			Object.defineProperty(ImageBitmap.prototype, "complete", { configurable: true, get: () => true });
			note("ImageBitmap.complete added (part 4a)");
		} catch (e) {
			console.error(tag, "could not add ImageBitmap.complete:", e);
		}
	}

	function fixWarming() {
		const sdk = realSdk || window.bcModSdk;
		if (!sdk || !functionExists("GLDrawAppearanceBuild") || !functionExists("GLDrawImage")) return false;
		if (!functionExists("CommonDrawWarmDrawnAssets")) {
			warn("CommonDrawWarmDrawnAssets not found; part 3 not needed on this game version.");
			return true;
		}
		try {
			const mod = sdk.registerMod({ name: "EchoR133Fix", fullName: "Echo R133 compatibility fix", version: VERSION });
			let building = null;
			mod.hookFunction("GLDrawAppearanceBuild", 100, (args, next) => {
				const prev = building;
				building = args[0];
				try {
					return next(args);
				} finally {
					building = prev;
				}
			});
			// Lowest priority, so it runs innermost and sees the URL after every mod has remapped it.
			mod.hookFunction("GLDrawImage", -1000, (args, next) => {
				const src = args[0];
				if (building && typeof src === "string" && building.DrawnAssets instanceof Set) building.DrawnAssets.add(src);
				return next(args);
			});
			note("drawn-asset warming fix applied (part 3)");

			// Part 4b. Innermost, so the URL is already remapped. The stack is only
			// inspected when the image isn't loaded yet, which is rare once warmed up.
			if (functionExists("DrawGetImage")) {
				mod.hookFunction("DrawGetImage", -1000, (args, next) => {
					const ret = next(args);
					if (ret !== undefined || typeof args[0] !== "string") return ret;
					return calledByEcho() ? legacyImage(args[0]) : ret;
				});
				note("DrawGetImage compatibility for Echo applied (part 4b)");
			}
		} catch (e) {
			console.error(tag, "could not apply drawn-asset warming fix:", e);
		}
		return true;
	}

	// ---- run ------------------------------------------------------------------

	fixImageBitmapComplete();
	let sdkDone = wrapSdk();
	let refreshDone = fixRefresh();
	let warmDone = sdkDone && fixWarming();
	let revalDone = fixRevalidate();
	if (!sdkDone || !refreshDone || !warmDone || !revalDone) {
		const timer = setInterval(() => {
			if (!sdkDone) sdkDone = wrapSdk();
			if (!refreshDone) refreshDone = fixRefresh();
			if (sdkDone && !warmDone) warmDone = fixWarming();
			if (!revalDone) revalDone = fixRevalidate();
			if (sdkDone && refreshDone && warmDone && revalDone) clearInterval(timer);
		}, 20);
		setTimeout(() => clearInterval(timer), 120000);
	}
})();