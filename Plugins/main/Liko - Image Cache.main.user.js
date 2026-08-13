// ==UserScript==
// @name         Liko - Image Cache
// @name:zh-TW   Liko - 圖片快取
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.6.0
// @description  Persistent, size-limited image cache for Bondage Club and custom assets.
// @description:zh-TW 為 Bondage Club 與自訂資產提供有容量上限的持久圖片快取。
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_ChatRoomButtons.js
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @run-at       document-start
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Image%20Cache.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Image%20Cache.main.user.js
// ==/UserScript==

(function () {
    "use strict";

    const VERSION = "0.6.0";
    const TAG = "[Liko Image Cache]";
    const CACHE_NAME = "liko-image-cache-v1";
    const DB_NAME = "liko-image-cache-meta";
    const DB_VERSION = 1;
    const STORE = "images";
    const LIMIT_KEY = "LikoImageCacheLimitMB";
    const ENABLE_KEY = "LikoImageCacheEnabled";
    const PANEL_POS_KEY = "LikoImageCachePanelPosition";
    const DEFAULT_LIMIT_MB = 512;
    const MIN_LIMIT_MB = 64;
    const CLEANUP_RATIO = 0.9;
    const WRITE_CONCURRENCY = 2;
    const READ_CONCURRENCY = 16;
    const NEGATIVE_TTL = 60 * 60 * 1000;
    const TRANSIENT_NEGATIVE_TTL = 60 * 1000;
    const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    const IMAGE_EXT = /\.(?:png|jpe?g|webp|gif|avif|svg)(?:[?#]|$)/i;
    const ASSET_PATH = /\/Assets\/Female3DCG\//i;
    const CORE_GROUPS = /\/Female3DCG\/(?:Body|BodyUpper|BodyLower|Head|Hair|HairFront|HairBack|Eyes|Eyes2|Eyebrows|Mouth|Nipples|Pussy|Height|Hands|LeftHand|RightHand)(?:\/|$)/i;

    window.Liko = window.Liko ?? {};
    if (window.Liko.ImageCache) return;

    const nativeSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!nativeSrc?.get || !nativeSrc?.set || !window.caches || !window.indexedDB) {
        console.warn(`${TAG} Cache Storage or IndexedDB is unavailable.`);
        return;
    }

    const logicalSources = new WeakMap();
    const generations = new WeakMap();
    const objectUrls = new WeakMap();
    const activeRequests = new Map();
    const knownEntries = new Map();
    const writeQueue = [];
    const queuedWrites = new Set();
    const readQueue = [];
    let activeWrites = 0;
    let activeReads = 0;
    let completedReads = 0;
    let metadataBytes = 0;
    let dbPromise;
    let cleaning = false;
    let enabled = localStorage.getItem(ENABLE_KEY) !== "false";
    let panel;
    let panelTimer;
    const counters = { hits: 0, misses: 0, stored: 0, fallbacks: 0, suppressed404: 0, servedBytes: 0, downloadedBytes: 0 };
    const recentRequests = [];

    function recordRequest(hit) {
        counters[hit ? "hits" : "misses"]++;
        const now = Date.now();
        recentRequests.push({ time: now, hit });
        while (recentRequests.length && recentRequests[0].time < now - 60000) recentRequests.shift();
    }

    function limitBytes() {
        const value = Number(localStorage.getItem(LIMIT_KEY));
        return Math.max(MIN_LIMIT_MB, Number.isFinite(value) && value > 0 ? value : DEFAULT_LIMIT_MB) * 1024 * 1024;
    }

    function absoluteUrl(value) {
        try { return new URL(value, document.baseURI).href; } catch (_) { return null; }
    }

    function shouldHandle(value) {
        if (!enabled || typeof value !== "string" || !value || value.startsWith("blob:") || value.startsWith("data:")) return false;
        const url = absoluteUrl(value);
        return !!url && IMAGE_EXT.test(url) && (ASSET_PATH.test(url) || /echo-clothing-ext|sugarchain-studio|bondage(projects\.elementfx|-(?:europe|asia))\.com/i.test(url));
    }

    function isCore(url) {
        let decoded = url;
        try { decoded = decodeURIComponent(url); } catch (_) {}
        return CORE_GROUPS.test(decoded) || /(?:hair|face|body|head|eyes?|mouth|brow|頭髮|头发|臉|脸|身體|身体)/i.test(decoded);
    }

    function openDb() {
        if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore(STORE, { keyPath: "url" });
                store.createIndex("lastUsed", "lastUsed");
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return dbPromise;
    }

    async function withStore(mode, action) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const result = action(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    }

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function touch(url, size, core) {
        const previous = knownEntries.get(url);
        const entry = { url, size, core, lastUsed: Date.now() };
        knownEntries.set(url, entry);
        metadataBytes += size - (previous?.size || 0);
        await withStore("readwrite", store => store.put(entry));
    }

    async function allMetadata() {
        const db = await openDb();
        const tx = db.transaction(STORE, "readonly");
        return requestResult(tx.objectStore(STORE).getAll());
    }

    async function removeEntries(entries) {
        if (!entries.length) return;
        const cache = await caches.open(CACHE_NAME);
        await Promise.all(entries.map(entry => cache.delete(entry.url)));
        await withStore("readwrite", store => entries.forEach(entry => store.delete(entry.url)));
        for (const entry of entries) {
            knownEntries.delete(entry.url);
            metadataBytes -= entry.size || 0;
        }
    }

    async function cleanup(force = false) {
        if (cleaning) return;
        cleaning = true;
        try {
            const entries = Array.from(knownEntries.values());
            let total = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
            const limit = limitBytes();
            if (!force && total <= limit) return;
            const target = force ? 0 : limit * CLEANUP_RATIO;
            const ordered = entries.sort((a, b) => Number(a.core) - Number(b.core) || a.lastUsed - b.lastUsed);
            const victims = [];
            for (const entry of ordered) {
                if (total <= target) break;
                victims.push(entry);
                total -= entry.size || 0;
            }
            await removeEntries(victims);
        } catch (error) {
            console.warn(`${TAG} cleanup failed:`, error);
        } finally {
            cleaning = false;
        }
    }

    async function obtain(url) {
        if (activeRequests.has(url)) return activeRequests.get(url);
        const task = (async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(url, { ignoreVary: true });
            if (cached) {
                const blob = await cached.blob();
                if (blob.size) {
                    recordRequest(true);
                    counters.servedBytes += blob.size;
                    const entry = knownEntries.get(url);
                    if (!entry?.lastUsed || Date.now() - entry.lastUsed > 60000) touch(url, blob.size, isCore(url)).catch(() => {});
                    return blob;
                }
                await cache.delete(url);
            }

            knownEntries.delete(url);
            throw new Error("Cached entry missing");
        })().finally(() => activeRequests.delete(url));
        activeRequests.set(url, task);
        return task;
    }

    function nextFrame() {
        return new Promise(resolve => {
            if (document.hidden || typeof requestAnimationFrame !== "function") setTimeout(resolve, 0);
            else requestAnimationFrame(() => resolve());
        });
    }

    function pumpReadQueue() {
        while (activeReads < READ_CONCURRENCY && readQueue.length) {
            const job = readQueue.shift();
            activeReads++;
            job.run().finally(async () => {
                activeReads--;
                completedReads++;
                if (completedReads % READ_CONCURRENCY === 0) await nextFrame();
                pumpReadQueue();
            });
        }
    }

    function queueCachedRead(url, run) {
        readQueue.push({ priority: isCore(url) ? 0 : 1, run });
        readQueue.sort((a, b) => a.priority - b.priority);
        pumpReadQueue();
    }

    function pumpWriteQueue() {
        while (activeWrites < WRITE_CONCURRENCY && writeQueue.length) {
            const url = writeQueue.shift();
            activeWrites++;
            (async () => {
                try {
                    const response = await fetch(url, { credentials: "same-origin", cache: "force-cache" });
                    if (!response.ok || response.type === "opaque") throw new Error(`HTTP ${response.status || "opaque"}`);
                    const type = response.headers.get("content-type") || "";
                    if (type && !type.startsWith("image/")) throw new Error(`Unexpected content type: ${type}`);
                    const blob = await response.clone().blob();
                    if (!blob.size) throw new Error("Empty image response");
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(url, response);
                    await touch(url, blob.size, isCore(url));
                    counters.stored++;
                    counters.downloadedBytes += blob.size;
                    cleanup(false);
                } catch (error) {
                    counters.fallbacks++;
                    console.debug(`${TAG} background store skipped for ${url}:`, error);
                } finally {
                    queuedWrites.delete(url);
                    activeWrites--;
                    pumpWriteQueue();
                }
            })();
        }
    }

    function queueWrite(url) {
        if (knownEntries.has(url) || queuedWrites.has(url)) return;
        queuedWrites.add(url);
        writeQueue.push(url);
        pumpWriteQueue();
    }

    async function markNegative(url, ttl = TRANSIENT_NEGATIVE_TTL) {
        const entry = { url, size: 0, core: false, negativeUntil: Date.now() + ttl, lastUsed: Date.now() };
        knownEntries.set(url, entry);
        await withStore("readwrite", store => store.put(entry));
    }

    async function classifyFailure(url) {
        let ttl = TRANSIENT_NEGATIVE_TTL;
        try {
            const response = await fetch(url, { credentials: "same-origin", cache: "no-cache" });
            if (response.status === 404 || response.status === 410) ttl = NEGATIVE_TTL;
        } catch (_) {}
        return markNegative(url, ttl);
    }

    function refreshCharacters() {
        try {
            for (const character of window.Character ?? []) character.MustDraw = true;
        } catch (_) {}
    }

    function releaseObjectUrl(image) {
        const old = objectUrls.get(image);
        if (old) {
            URL.revokeObjectURL(old);
            objectUrls.delete(image);
        }
    }

    function setImageSource(image, value) {
        const original = String(value ?? "");
        // Native HTMLImageElement.src always reads back as an absolute URL. BC and
        // ECHO rely on that and call new URL(img.src) with no base argument.
        logicalSources.set(image, absoluteUrl(original) ?? original);
        const generation = (generations.get(image) || 0) + 1;
        generations.set(image, generation);
        releaseObjectUrl(image);

        if (!shouldHandle(original)) {
            nativeSrc.set.call(image, original);
            return;
        }

        const url = absoluteUrl(original);
        const known = knownEntries.get(url);
        if (known?.negativeUntil > Date.now()) {
            counters.suppressed404++;
            nativeSrc.set.call(image, TRANSPARENT_PIXEL);
            return;
        } else if (known?.negativeUntil) {
            knownEntries.delete(url);
            withStore("readwrite", store => store.delete(url)).catch(() => {});
        }

        if (!known || known.negativeUntil) {
            recordRequest(false);
            image.addEventListener("load", () => {
                if (generations.get(image) === generation) queueWrite(url);
            }, { once: true });
            image.addEventListener("error", () => {
                if (generations.get(image) === generation) classifyFailure(url).catch(() => {});
            }, { once: true });
            nativeSrc.set.call(image, original);
            return;
        }

        // GLDrawImageCache may reuse this Image before its queued read starts.
        // Keep it backed by valid pixels so texImage2D never receives a 0x0 image.
        nativeSrc.set.call(image, TRANSPARENT_PIXEL);
        queueCachedRead(url, async () => {
            if (generations.get(image) !== generation) return;
            try {
                const blob = await obtain(url);
                if (generations.get(image) !== generation) return;
                const objectUrl = URL.createObjectURL(blob);
                objectUrls.set(image, objectUrl);
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error("Cached image decode timeout")), 15000);
                    image.addEventListener("load", () => { clearTimeout(timer); refreshCharacters(); resolve(); }, { once: true });
                    image.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Cached image decode failed")); }, { once: true });
                    nativeSrc.set.call(image, objectUrl);
                });
            } catch (error) {
                if (generations.get(image) !== generation) return;
                counters.fallbacks++;
                recordRequest(false);
                image.addEventListener("load", () => queueWrite(url), { once: true });
                image.addEventListener("error", () => classifyFailure(url).catch(() => {}), { once: true });
                console.debug(`${TAG} stale cache entry; using native load for ${url}:`, error);
                nativeSrc.set.call(image, original);
            }
        });
    }

    Object.defineProperty(HTMLImageElement.prototype, "src", {
        configurable: nativeSrc.configurable,
        enumerable: nativeSrc.enumerable,
        get() { return logicalSources.get(this) ?? nativeSrc.get.call(this); },
        set(value) { setImageSource(this, value); },
    });

    async function stats() {
        const estimate = await navigator.storage?.estimate?.();
        const recentCutoff = Date.now() - 60000;
        while (recentRequests.length && recentRequests[0].time < recentCutoff) recentRequests.shift();
        const recentHits = recentRequests.reduce((sum, item) => sum + Number(item.hit), 0);
        const coreEntries = Array.from(knownEntries.values()).filter(entry => !entry.negativeUntil && entry.core).length;
        return {
            enabled,
            entries: Array.from(knownEntries.values()).filter(entry => !entry.negativeUntil).length,
            bytes: metadataBytes,
            limitBytes: limitBytes(),
            originUsage: estimate?.usage,
            originQuota: estimate?.quota,
            writeQueue: writeQueue.length,
            activeWrites,
            readQueue: readQueue.length,
            activeReads,
            recentHits,
            recentMisses: recentRequests.length - recentHits,
            coreEntries,
            generalEntries: Array.from(knownEntries.values()).filter(entry => !entry.negativeUntil && !entry.core).length,
            ...counters,
        };
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return "—";
        const units = ["B", "KB", "MB", "GB"];
        let value = bytes;
        let unit = 0;
        while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
        return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
    }

    function closePanel() {
        panel?.remove();
        panel = null;
        clearInterval(panelTimer);
        panelTimer = null;
        document.getElementById("liko-image-cache-button")?.classList.remove("lic-open");
    }

    function clampPanelPosition(left, top) {
        const width = panel?.offsetWidth || 380;
        const height = panel?.offsetHeight || 460;
        return {
            left: Math.max(6, Math.min(left, window.innerWidth - width - 6)),
            top: Math.max(6, Math.min(top, window.innerHeight - Math.min(height, 100) - 6)),
        };
    }

    function setPanelPosition(left, top, save = false) {
        if (!panel) return;
        const pos = clampPanelPosition(left, top);
        panel.style.left = `${pos.left}px`;
        panel.style.top = `${pos.top}px`;
        if (save) localStorage.setItem(PANEL_POS_KEY, JSON.stringify(pos));
    }

    function makePanelDraggable(handle) {
        let drag = null;
        handle.addEventListener("pointerdown", event => {
            if (event.button !== 0 || event.target.closest("button")) return;
            const rect = panel.getBoundingClientRect();
            drag = { pointerId: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top };
            handle.setPointerCapture(event.pointerId);
            panel.classList.add("lic-dragging");
            event.preventDefault();
        });
        handle.addEventListener("pointermove", event => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            setPanelPosition(event.clientX - drag.x, event.clientY - drag.y);
        });
        const finish = event => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            drag = null;
            panel.classList.remove("lic-dragging");
            const rect = panel.getBoundingClientRect();
            setPanelPosition(rect.left, rect.top, true);
        };
        handle.addEventListener("pointerup", finish);
        handle.addEventListener("pointercancel", finish);
    }

    async function updatePanel() {
        if (!panel?.isConnected) return;
        const output = panel.querySelector("[data-lic-stats]");
        try {
            const data = await stats();
            const recentTotal = data.recentHits + data.recentMisses;
            const recentHitPercent = recentTotal ? data.recentHits / recentTotal * 100 : 0;
            const readLoad = data.activeReads + data.readQueue;
            const writeLoad = data.activeWrites + data.writeQueue;
            const pressure = Math.min(100, Math.max(data.activeReads / READ_CONCURRENCY * 35, readLoad / 64 * 70) + Math.min(30, writeLoad / 32 * 30));
            const pressureLabel = pressure >= 75 ? "HIGH" : pressure >= 35 ? "BUSY" : pressure > 2 ? "ACTIVE" : "IDLE";
            const cachePercent = data.limitBytes ? Math.min(100, data.bytes / data.limitBytes * 100) : 0;
            output.innerHTML = `
                <div class="lic-gauge-zone">
                    <div class="lic-gauge" style="--rate:${pressure * 1.8}deg"><div class="lic-gauge-cut"><strong>${Math.round(pressure)}%</strong><small>PIPELINE ${pressureLabel}</small></div></div>
                    <div class="lic-gauge-scale"><span>IDLE</span><b>CACHE PRESSURE</b><span>MAX</span></div>
                </div>
                <div class="lic-capacity"><div><span>IMAGE CACHE</span><b>${formatBytes(data.bytes)} <i>/ ${formatBytes(data.limitBytes)}</i></b></div><div class="lic-bar"><i style="width:${cachePercent}%"></i></div></div>
                <div class="lic-distribution"><div><i style="width:${recentHitPercent}%"></i></div><span>最近 60 秒：快取 ${recentHitPercent.toFixed(0)}% · 原生 ${Math.max(0, 100 - recentHitPercent).toFixed(0)}%</span></div>
                <div class="lic-grid">
                    <div><small>CACHED</small><b>${data.entries}</b><span>快取項目</span></div>
                    <div><small>SERVED</small><b>${formatBytes(data.servedBytes)}</b><span>由持久快取供應</span></div>
                    <div><small>CAPTURED</small><b>${formatBytes(data.downloadedBytes)}</b><span>本次新增資料</span></div>
                    <div><small>READ</small><b>${data.activeReads}<i> +${data.readQueue}</i></b><span>工作中＋等待</span></div>
                    <div><small>WRITE</small><b>${data.activeWrites}<i> +${data.writeQueue}</i></b><span>工作中＋等待</span></div>
                    <div><small>BLOCKED</small><b>${data.suppressed404}</b><span>抑制重複錯圖</span></div>
                </div>`;
        } catch (error) {
            output.textContent = `讀取統計失敗：${error.message}`;
        }
    }

    function openPanel() {
        if (panel?.isConnected) { closePanel(); return; }
        const style = document.getElementById("liko-image-cache-style") || document.createElement("style");
        style.id = "liko-image-cache-style";
        style.textContent = `
            #liko-image-cache-panel{position:fixed;width:380px;z-index:10050;color:#eaf7ff;background:linear-gradient(145deg,#111722 0%,#171e2c 65%,#10151f 100%);border:1px solid #35c8e766;border-radius:5px;box-shadow:0 0 0 1px #9b4dff22,0 16px 50px #000c,0 0 28px #19d9ff18;font:14px "Segoe UI",Arial,sans-serif;overflow:hidden;user-select:none;-webkit-user-select:none;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px))}
            #liko-image-cache-panel::before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,#20e3ff,#8a4dff 65%,#ff3f9a);z-index:2}
            #liko-image-cache-panel.lic-dragging{cursor:grabbing;box-shadow:0 0 0 1px #38e7ff88,0 20px 60px #000d,0 0 35px #20dfff3d}
            #liko-image-cache-panel .lic-head{display:flex;align-items:center;padding:13px 15px;background:linear-gradient(90deg,#202a3a,#151c29);font-size:16px;letter-spacing:.4px;cursor:grab;touch-action:none;border-bottom:1px solid #42d9ff30}
            #liko-image-cache-panel .lic-head b{flex:1;text-shadow:0 0 12px #54dcff66} #liko-image-cache-panel button{cursor:pointer;font-weight:700}
            #liko-image-cache-panel .lic-close{border:0;background:transparent;color:#9fb2c7;font-size:22px} #liko-image-cache-panel .lic-close:hover{color:#ff579c;text-shadow:0 0 9px #ff3f9a}
            #liko-image-cache-panel .lic-body{padding:12px 15px 15px;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff04 1px,transparent 1px);background-size:18px 18px}
            #liko-image-cache-panel .lic-gauge-zone{position:relative;height:132px;text-align:center;padding-top:6px}
            #liko-image-cache-panel .lic-gauge{--rate:0deg;position:relative;margin:auto;width:220px;height:110px;overflow:hidden}
            #liko-image-cache-panel .lic-gauge::before{content:"";position:absolute;width:220px;height:220px;left:0;top:0;border-radius:50%;background:conic-gradient(from 270deg,#22d8ff 0deg,#7d55ff var(--rate),#263244 var(--rate),#263244 180deg,transparent 180deg);filter:drop-shadow(0 0 7px #28dfff66)}
            #liko-image-cache-panel .lic-gauge-cut{position:absolute;left:17px;top:17px;width:186px;height:186px;border-radius:50%;background:#131a26;display:flex;flex-direction:column;align-items:center;padding-top:31px;box-sizing:border-box}
            #liko-image-cache-panel .lic-gauge strong{font-size:31px;line-height:34px;color:#fff;text-shadow:0 0 13px #4ae4ff} #liko-image-cache-panel .lic-gauge small{font-size:10px;color:#53dcff;letter-spacing:2px}
            #liko-image-cache-panel .lic-gauge-scale{position:absolute;left:52px;right:52px;bottom:3px;display:flex;justify-content:space-between;color:#71839a;font-size:10px} #liko-image-cache-panel .lic-gauge-scale b{color:#b6c7da;letter-spacing:1.5px}
            #liko-image-cache-panel .lic-capacity{padding:8px 10px;background:#0d131dc9;border-left:2px solid #44dcff;margin-bottom:9px} #liko-image-cache-panel .lic-capacity>div:first-child{display:flex;justify-content:space-between;align-items:end}
            #liko-image-cache-panel .lic-capacity span{color:#58dfff;font-size:10px;letter-spacing:1.4px} #liko-image-cache-panel .lic-capacity b{font-size:14px} #liko-image-cache-panel .lic-capacity i{font-style:normal;color:#788ba1;font-size:11px}
            #liko-image-cache-panel .lic-bar{height:4px;background:#273346;margin-top:7px;overflow:hidden} #liko-image-cache-panel .lic-bar i{display:block;height:100%;background:linear-gradient(90deg,#28dcff,#8d53ff);box-shadow:0 0 8px #39deff}
            #liko-image-cache-panel .lic-distribution{margin:0 1px 9px;color:#8294a9;font-size:10px} #liko-image-cache-panel .lic-distribution>div{height:5px;background:#7a3c5f;margin-bottom:5px;overflow:hidden} #liko-image-cache-panel .lic-distribution i{display:block;height:100%;background:#27d8ff;box-shadow:0 0 8px #27d8ff}
            #liko-image-cache-panel .lic-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px} #liko-image-cache-panel .lic-grid>div{min-height:61px;padding:7px 8px;background:linear-gradient(135deg,#1d2736d9,#111824e8);border:1px solid #64809c2b;display:flex;flex-direction:column}
            #liko-image-cache-panel .lic-grid small{font-size:9px;letter-spacing:1.2px;color:#4edcff} #liko-image-cache-panel .lic-grid b{font-size:18px;line-height:22px;color:#f5f9ff} #liko-image-cache-panel .lic-grid b i{font-style:normal;font-size:12px;color:#7d90a7} #liko-image-cache-panel .lic-grid span{font-size:10px;color:#7f91a6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            #liko-image-cache-panel .lic-controls{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:center;margin-top:12px;padding-top:11px;border-top:1px solid #56dfff2b}
            #liko-image-cache-panel input{user-select:auto;-webkit-user-select:auto;accent-color:#25d9ff} #liko-image-cache-panel input[type=number]{width:86px;padding:5px;background:#0d131d;color:#fff;border:1px solid #42cbea66;border-radius:2px}
            #liko-image-cache-panel .lic-actions{display:flex;gap:7px;margin-top:12px} #liko-image-cache-panel .lic-actions button{flex:1;padding:8px 5px;border:1px solid #54ddff66;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);background:linear-gradient(135deg,#236984,#334a82);color:#fff;text-shadow:0 1px 2px #000}
            #liko-image-cache-panel .lic-actions button:hover{filter:brightness(1.2);box-shadow:0 0 12px #32deff55} #liko-image-cache-panel .lic-actions button[data-lic-clear]{background:linear-gradient(135deg,#7d294a,#9d3651);border-color:#ff5c8c88}
            #liko-image-cache-button{font-size:24px!important} #liko-image-cache-button.lic-open{box-shadow:0 0 0 2px #62d5ff inset!important}`;
        document.head.appendChild(style);

        panel = document.createElement("section");
        panel.id = "liko-image-cache-panel";
        panel.innerHTML = `
            <div class="lic-head"><b>🖼️ Liko 圖片快取</b><button class="lic-close" title="關閉">×</button></div>
            <div class="lic-body">
                <div data-lic-stats>讀取中…</div>
                <div class="lic-controls">
                    <label><input data-lic-enabled type="checkbox" ${enabled ? "checked" : ""}> 啟用圖片快取</label><span></span>
                    <label for="lic-limit">容量上限（MB）</label><input id="lic-limit" data-lic-limit type="number" min="${MIN_LIMIT_MB}" step="64" value="${Math.round(limitBytes() / 1024 / 1024)}">
                </div>
                <div class="lic-actions"><button data-lic-save>套用設定</button><button data-lic-refresh>重新整理</button><button data-lic-clear>清空快取</button></div>
            </div>`;
        document.body.appendChild(panel);
        let savedPosition = null;
        try { savedPosition = JSON.parse(localStorage.getItem(PANEL_POS_KEY)); } catch (_) {}
        setPanelPosition(savedPosition?.left ?? window.innerWidth - 400, savedPosition?.top ?? 90);
        makePanelDraggable(panel.querySelector(".lic-head"));
        document.getElementById("liko-image-cache-button")?.classList.add("lic-open");
        panel.querySelector(".lic-close").addEventListener("click", closePanel);
        panel.querySelector("[data-lic-save]").addEventListener("click", () => {
            enabled = panel.querySelector("[data-lic-enabled]").checked;
            localStorage.setItem(ENABLE_KEY, String(enabled));
            api.setLimitMB(panel.querySelector("[data-lic-limit]").value);
            updatePanel();
        });
        panel.querySelector("[data-lic-refresh]").addEventListener("click", updatePanel);
        panel.querySelector("[data-lic-clear]").addEventListener("click", async () => {
            if (!confirm("確定清空這個 BC 網址的圖片快取？")) return;
            await api.clear();
            updatePanel();
        });
        updatePanel();
        panelTimer = setInterval(updatePanel, 1000);
    }

    function createChatButton() {
        const button = document.createElement("button");
        button.id = "liko-image-cache-button";
        button.className = "blank-button button HideOnPopup chat-room-button";
        button.type = "button";
        button.textContent = "🖼️";
        button.title = "圖片快取監控";
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            openPanel();
        });
        return button;
    }

    function setupChatButton() {
        const spec = ["liko-image-cache", 4, createChatButton, { plain: true }];
        if (window.Liko.__Sys_ChatRoomButtons__?.add) window.Liko.__Sys_ChatRoomButtons__.add(...spec);
        else (window.Liko.__CRB_pending__ = window.Liko.__CRB_pending__ || []).push(spec);
    }

    const api = {
        version: VERSION,
        get enabled() { return enabled; },
        set enabled(value) {
            enabled = !!value;
            localStorage.setItem(ENABLE_KEY, String(enabled));
        },
        stats,
        clear: () => cleanup(true),
        setLimitMB(value) {
            const mb = Math.max(MIN_LIMIT_MB, Number(value) || DEFAULT_LIMIT_MB);
            localStorage.setItem(LIMIT_KEY, String(mb));
            cleanup(false);
            return mb;
        },
    };
    window.Liko.ImageCache = api;
    setupChatButton();

    function registerMod() {
        if (typeof window.bcModSdk?.registerMod !== "function") return false;
        try {
            window.bcModSdk.registerMod({
                name: "Liko Image Cache",
                fullName: "Liko - Image Cache",
                version: VERSION,
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
            });
        } catch (error) {
            console.warn(`${TAG} bcModSdk registration failed:`, error);
        }
        return true;
    }

    if (!registerMod()) {
        let attempts = 0;
        const timer = setInterval(() => {
            if (registerMod() || ++attempts >= 120) clearInterval(timer);
        }, 250);
    }

    allMetadata().then(entries => {
        const now = Date.now();
        for (const entry of entries) {
            if (entry.negativeUntil && entry.negativeUntil <= now) continue;
            if (knownEntries.has(entry.url)) continue;
            knownEntries.set(entry.url, entry);
            metadataBytes += entry.size || 0;
        }
        cleanup(false);
    }).catch(error => console.warn(`${TAG} metadata initialization failed:`, error));
    console.info(`${TAG} ${VERSION} active. API: Liko.ImageCache`);
})();
