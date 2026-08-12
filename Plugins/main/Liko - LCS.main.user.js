// ==UserScript==
// @name           Liko - Code Sandbox
// @name:zh        Liko - 程式碼沙盒
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.0
// @description    Executes testcode globally, accurately tracking and resolving side effects caused by the sandbox 
//                 itself; supports multiple sandboxes, can be merged, and can switch to pure console mode.
// @description:zh 在全域作用域執行測試碼，精準追蹤並還原「這個沙盒自己造成」的副作用；支援多重沙盒、可收合、可切純控制台模式
// @include        /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/Sandbox/Sandbox-icon.png
// @grant          none
// @require        https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_ChatRoomButtons.js
// @run-at         document-end
// @downloadURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20LCS.main.user.js
// @updateURL      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20LCS.main.user.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.LCS) return;
    const MOD_VER = "1.0";
    window.Liko.LCS = MOD_VER;

    // 依你的擴充道具實際會寫入的既有全域容器補上路徑（支援 a.b.c 點記法）。
    // 陣列 / Map / Set 用「新增的元素或 key」做 diff，一般物件用「新增的 key」做 diff。
    // 容器一定要是「執行前就已存在」的東西；先在 console 用 typeof 確認型別再啟用。
    // bcModSdk.registerMod({ name: "", fullName: "", version: "" }, { allowReplace: true })，最尾部加入allowReplace: true
    const REGISTRIES = [
        // "AssetGroupMap",
        // "Asset",
        // "AssetGroup",
    ];

    const codeStorageKey = (id) => `bc_sandbox_code_${id}`;

    const ICON_URL = "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/Sandbox/Sandbox-icon.png";
    const CRB_ID = "sandbox";
    const CRB_ORDER = 8; // 數字越大越靠左（MAT=2 / Tool=9 / DDT=99）

    // APNG：平時只顯示靜止影格（poster canvas），游標移上去才切到 <img> 播放。
    // host 必須是 position:relative/fixed 且 overflow:hidden。
    function attachIcon(host) {
        const base = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;";
        const poster = document.createElement("canvas");
        poster.width = poster.height = 96;
        poster.style.cssText = base + "display:block;";
        const img = document.createElement("img");
        img.alt = "";
        img.crossOrigin = "anonymous"; // 讓 poster 能 drawImage 擷取影格而不汙染畫布
        img.style.cssText = base + "display:none;";
        host.appendChild(poster);
        host.appendChild(img);

        const snap = () => {
            try {
                const c = poster.getContext("2d");
                c.clearRect(0, 0, 96, 96);
                c.drawImage(img, 0, 0, 96, 96);
            } catch (e) {}
        };
        img.addEventListener("load", () => { if (img.style.display === "none") snap(); });
        host.addEventListener("pointerenter", () => { img.style.display = "block"; poster.style.display = "none"; });
        host.addEventListener("pointerleave", () => { snap(); img.style.display = "none"; poster.style.display = "block"; });
        img.src = ICON_URL;
    }

    // 拖曳：按下才掛 document 監聽、放開就拆掉，關掉面板/氣球後不會留下殘骸 listener。
    // onEnd(moved) 讓呼叫端分辨「只是點一下」還是真的拖過。
    function dragBy(el, downEvent, onEnd) {
        const r = el.getBoundingClientRect();
        const ox = downEvent.clientX - r.left;
        const oy = downEvent.clientY - r.top;
        let moved = false;
        const move = (e) => {
            moved = true;
            el.style.left = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, e.clientX - ox)) + "px";
            el.style.top = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, e.clientY - oy)) + "px";
            el.style.right = "auto";
            el.style.bottom = "auto";
        };
        const up = () => {
            orig.removeEventListener.call(document, "mousemove", move);
            orig.removeEventListener.call(document, "mouseup", up);
            if (onEnd) onEnd(moved);
        };
        orig.addEventListener.call(document, "mousemove", move);
        orig.addEventListener.call(document, "mouseup", up);
    }

    // ---------------- 工具函式 ----------------

    function fmt(v) {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (typeof v === "object") {
            try {
                return JSON.stringify(v, null, 2);
            } catch (e) {
                return String(v);
            }
        }
        return String(v);
    }

    function resolvePath(path) {
        const parts = path.split(".");
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
            if (obj == null) return null;
            obj = obj[parts[i]];
        }
        if (obj == null) return null;
        return { parent: obj, key: parts[parts.length - 1] };
    }

    function snapshotRegistry(path) {
        const ref = resolvePath(path);
        if (!ref) return { path, kind: "missing" };
        const value = ref.parent[ref.key];
        if (Array.isArray(value)) return { path, kind: "array", before: value.slice() };
        if (value instanceof Map) return { path, kind: "map", before: new Set(value.keys()) };
        if (value instanceof Set) return { path, kind: "set", before: new Set(value) };
        if (value && typeof value === "object") return { path, kind: "object", before: new Set(Object.keys(value)) };
        return { path, kind: "missing" };
    }

    function diffRegistry(descriptor) {
        if (descriptor.kind === "missing") return [];
        const ref = resolvePath(descriptor.path);
        if (!ref) return [];
        const value = ref.parent[ref.key];
        if (descriptor.kind === "array" && Array.isArray(value)) {
            return value.filter((item) => descriptor.before.indexOf(item) === -1);
        }
        if (descriptor.kind === "map" && value instanceof Map) {
            return Array.from(value.keys()).filter((k) => !descriptor.before.has(k));
        }
        if (descriptor.kind === "set" && value instanceof Set) {
            return Array.from(value).filter((item) => !descriptor.before.has(item));
        }
        if (descriptor.kind === "object" && value && typeof value === "object") {
            return Object.keys(value).filter((k) => !descriptor.before.has(k));
        }
        return [];
    }

    function removeRegistryEntries(descriptor, entries) {
        if (!entries || !entries.length) return 0;
        const ref = resolvePath(descriptor.path);
        if (!ref) return 0;
        const value = ref.parent[ref.key];
        let count = 0;
        if (descriptor.kind === "array" && Array.isArray(value)) {
            for (const item of entries) {
                const idx = value.indexOf(item);
                if (idx > -1) {
                    value.splice(idx, 1);
                    count++;
                }
            }
        } else if (descriptor.kind === "map" && value instanceof Map) {
            for (const key of entries) if (value.delete(key)) count++;
        } else if (descriptor.kind === "set" && value instanceof Set) {
            for (const item of entries) if (value.delete(item)) count++;
        } else if (descriptor.kind === "object" && value && typeof value === "object") {
            for (const key of entries) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    delete value[key];
                    count++;
                }
            }
        }
        return count;
    }

    // ---------------- 因果歸因：currentInstance stack ----------------
    // 只有在「這個沙盒真的在執行」的當下，新建立的 DOM node / timer / listener
    // 才會被標記成屬於這個沙盒；跟這個沙盒無關的動作不會被追蹤或清除。

    const instanceStack = [];
    function currentInstance() {
        return instanceStack.length ? instanceStack[instanceStack.length - 1] : null;
    }
    function pushInstance(inst) {
        instanceStack.push(inst);
    }
    function popInstance() {
        instanceStack.pop();
    }

    // ---------------- 全域 patch（只裝一次，所有沙盒共用） ----------------

    const orig = {
        setTimeout: window.setTimeout.bind(window),
        setInterval: window.setInterval.bind(window),
        clearTimeout: window.clearTimeout.bind(window),
        clearInterval: window.clearInterval.bind(window),
        addEventListener: EventTarget.prototype.addEventListener,
        removeEventListener: EventTarget.prototype.removeEventListener,
        createElement: Document.prototype.createElement,
        createElementNS: Document.prototype.createElementNS,
    };

    // 把 callback 包一層，讓它「真正執行的那一刻」currentInstance 也還原成當時
    // 排這個 timer 的沙盒。限制：只解決「隔一層 timer」的情況，callback 裡若
    // 又 await 了 Promise，await 之後的延續依然追蹤不到。
    function wrapDeferredCallback(ci, fn) {
        if (typeof fn !== "function") return fn;
        return function (...cbArgs) {
            pushInstance(ci);
            try {
                return fn.apply(this, cbArgs);
            } finally {
                popInstance();
            }
        };
    }

    window.setTimeout = function (fn, delay, ...rest) {
        const ci = currentInstance();
        const wrapped = ci ? wrapDeferredCallback(ci, fn) : fn;
        const id = orig.setTimeout(wrapped, delay, ...rest);
        if (ci) ci.track.timeouts.add(id);
        return id;
    };
    window.setInterval = function (fn, delay, ...rest) {
        const ci = currentInstance();
        const wrapped = ci ? wrapDeferredCallback(ci, fn) : fn;
        const id = orig.setInterval(wrapped, delay, ...rest);
        if (ci) ci.track.intervals.add(id);
        return id;
    };
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        const ci = currentInstance();
        if (ci) ci.track.listeners.push({ target: this, type, listener, options });
        return orig.addEventListener.call(this, type, listener, options);
    };
    Document.prototype.createElement = function (...args) {
        const el = orig.createElement.apply(this, args);
        const ci = currentInstance();
        if (ci) ci.track.createdNodes.add(el);
        return el;
    };
    Document.prototype.createElementNS = function (...args) {
        const el = orig.createElementNS.apply(this, args);
        const ci = currentInstance();
        if (ci) ci.track.createdNodes.add(el);
        return el;
    };

    const OrigMutationObserver = window.MutationObserver;
    if (OrigMutationObserver) {
        window.MutationObserver = function (callback) {
            const ci = currentInstance();
            const observer = new OrigMutationObserver(callback);
            if (ci) ci.track.observers.add(observer);
            return observer;
        };
        window.MutationObserver.prototype = OrigMutationObserver.prototype;
    }

    // console 鏡射：把執行期間的 console 輸出同步進面板（devtools 仍照常收到）。
    // logTarget 蓋同步執行的區段（含控制台模式）；currentInstance() 補上 timer 回呼裡的 log。
    let logTarget = null;
    for (const method of ["log", "warn", "error", "info"]) {
        const origFn = console[method].bind(console);
        console[method] = function (...args) {
            const t = logTarget || currentInstance();
            if (t && t.appendOutput) t.appendOutput(args.map(fmt).join(" "));
            return origFn(...args);
        };
    }

    // 手動追蹤 API：給不是透過 createElement 產生的 DOM（例如 innerHTML）使用。
    window.__bcSandboxTrack = function (node) {
        const ci = currentInstance();
        if (ci && node) ci.track.createdNodes.add(node);
        return node;
    };

    // 手動清除回呼 API：清除順序有要求時（例如要先脫道具才能刪 Asset 定義），
    // 把清除邏輯包成函式丟進來，clear() 時會依「後註冊先執行」(LIFO) 呼叫。
    window.__bcSandboxOnClear = function (fn) {
        const ci = currentInstance();
        if (ci && typeof fn === "function") {
            ci.track.cleanups.push(fn);
        } else if (!ci) {
            console.warn("🐈‍⬛ [LCS] __bcSandboxOnClear 是在沙盒追蹤範圍之外被呼叫的，這個清除回呼不會被記錄。");
        }
        return fn;
    };

    // ---------------- bcModSdk 支援 ----------------
    // 攔截 bcModSdk.registerMod：記下沙盒執行期間註冊過的 mod name，方便顯示；
    // 若剛好遇到有 unloadMod 的 SDK 版本就順手呼叫，但不依賴它。真正能讓測試
    // mod 重複執行的關鍵，是 mod 自己的 registerMod 呼叫要帶 { allowReplace: true }。
    let modSdkPatched = false;
    let modSdkTimer = 0;
    function tryPatchModSdk() {
        if (modSdkPatched) return orig.clearInterval(modSdkTimer);
        const sdk = window.bcModSdk;
        if (!sdk || typeof sdk.registerMod !== "function") return;

        const originalRegisterMod = sdk.registerMod.bind(sdk);
        const wrapped = function (config, ...rest) {
            const api = originalRegisterMod(config, ...rest);
            const ci = currentInstance();
            if (ci && config && config.name) ci.track.modSdkNames.add(config.name);
            return api;
        };

        try {
            sdk.registerMod = wrapped;
        } catch (e) {
            // 属性唯读或物件被冻结，改用 defineProperty 硬覆写试试
            try {
                Object.defineProperty(sdk, "registerMod", {
                    value: wrapped,
                    writable: true,
                    configurable: true,
                });
            } catch (e2) {
                console.warn("🐈‍⬛ [LCS] 無法 patch bcModSdk.registerMod（此屬性唯讀且不可重新定義），mod 名稱追蹤功能停用。", e2);
                modSdkPatched = true; // 放弃重试，避免每 500ms 重复报错
                return;
            }
        }

        modSdkPatched = true;
        console.log("🐈‍⬛ [LCS] 已掛上 bcModSdk.registerMod 攔截。");
    }
    modSdkTimer = orig.setInterval(tryPatchModSdk, 500);

    // ---------------- SandboxInstance ----------------

    let nextId = 1;

    class SandboxInstance {
        constructor(manager) {
            this.manager = manager;
            this.id = nextId++;
            this.active = false;
            this.collapsed = false;
            this.consoleMode = false; // true = 純控制台：直接在全域跑，不追蹤也不還原
            this.beforeGlobalKeys = null;
            this.registrySnapshots = [];
            this.track = {
                timeouts: new Set(),
                intervals: new Set(),
                listeners: [],
                createdNodes: new Set(),
                addedGlobals: new Set(),
                registryAdds: new Map(),
                cleanups: [],
                modSdkNames: new Set(),
                observers: new Set(),
            };
            this.box = null;
            this.textarea = null;
            this.output = null;
            this.statusEl = null;
            this.buildUI();
            this.restoreCode();
        }

        // ---- 執行 ----

        beginTrackingIfNeeded() {
            if (this.active) return; // 沿用同一次 session 的 baseline，讓多次「執行」可以累加
            this.beforeGlobalKeys = new Set(Object.keys(window));
            this.registrySnapshots = REGISTRIES.map(snapshotRegistry);
            this.active = true;
        }

        captureNewGlobalsAndWrap() {
            const currentKeys = Object.keys(window);
            for (const key of currentKeys) {
                if (this.beforeGlobalKeys.has(key)) continue;
                if (this.track.addedGlobals.has(key)) continue;
                this.track.addedGlobals.add(key);
                const val = window[key];
                if (typeof val === "function" && !val.__bcSandboxWrapped) {
                    this.wrapGlobalFunction(key, val);
                }
            }
        }

        wrapGlobalFunction(key, original) {
            const instance = this;
            const wrapped = function (...args) {
                pushInstance(instance);
                try {
                    const r = original.apply(this, args);
                    if (r instanceof Promise) {
                        return r.then(
                            (v) => {
                                pushInstance(instance);
                                try {
                                    instance.captureNewGlobalsAndWrap();
                                    instance.captureRegistryAdds();
                                } finally {
                                    popInstance();
                                }
                                return v;
                            },
                            (e) => {
                                pushInstance(instance);
                                try {
                                    instance.captureNewGlobalsAndWrap();
                                    instance.captureRegistryAdds();
                                } finally {
                                    popInstance();
                                }
                                throw e;
                            }
                        );
                    }
                    return r;
                } finally {
                    popInstance();
                }
            };
            wrapped.__bcSandboxWrapped = true;
            wrapped.__bcSandboxOriginal = original;
            try {
                window[key] = wrapped;
            } catch (e) {
                /* 唯讀的 key 就放著，之後清除時仍會嘗試 delete */
            }
        }

        captureRegistryAdds() {
            for (const descriptor of this.registrySnapshots) {
                const added = diffRegistry(descriptor);
                if (!added.length) continue;
                let set = this.track.registryAdds.get(descriptor.path);
                if (!set) {
                    set = new Set();
                    this.track.registryAdds.set(descriptor.path, set);
                }
                for (const item of added) set.add(item);
            }
        }

        run(code) {
            if (!code || !code.trim()) {
                this.clearOutput();
                this.setOutput("// 請輸入要執行的程式碼");
                return;
            }
            const tracked = !this.consoleMode;
            this.clearOutput();
            if (tracked) {
                this.beginTrackingIfNeeded();
                this.setStatus(true);
            }

            if (tracked) pushInstance(this);
            logTarget = this;
            let result, errored = false, err;
            try {
                // 用 (0, eval) 在全域作用域執行，宣告的 function/var 會真的變成 window.xxx
                result = (0, eval)(code);
            } catch (e) {
                errored = true;
                err = e;
            } finally {
                logTarget = null;
                if (tracked) popInstance();
            }

            if (tracked) {
                this.captureNewGlobalsAndWrap();
                this.captureRegistryAdds();
            }

            if (errored) {
                // 頂層 let/const/class 走全域 eval 會建立「全域語彙綁定」：不在 window 上，
                // 所以既刪不掉也不能重複宣告 —— 這是重跑同一段測試碼最常見的爆點。
                const redeclared = err instanceof SyntaxError && /already been declared/.test(err.message);
                this.setOutput("❌ " + err.message + "\n" + (err.stack || ""));
                if (redeclared) this.setOutput("💡 頂層 let / const / class 在全域 eval 只能宣告一次，且無法被 ⏹ 清除。改用 var，或重新整理頁面。");
                return;
            }
            if (result instanceof Promise) {
                this.setOutput("⏳ 執行中（回傳 Promise，等待完成）...");
                const recapture = () => {
                    if (!tracked) return;
                    pushInstance(this);
                    try {
                        this.captureNewGlobalsAndWrap();
                        this.captureRegistryAdds();
                    } finally {
                        popInstance();
                    }
                };
                result.then(
                    (v) => {
                        recapture();
                        this.setOutput(v === undefined ? "✅ 執行完成（resolved，無回傳值）" : "➜ " + fmt(v));
                    },
                    (e) => {
                        recapture();
                        this.setOutput("❌ " + e.message);
                    }
                );
                return;
            }
            this.setOutput(
                result === undefined
                ? "✅ 執行完成（無回傳值，一般 log 請看 devtools console）"
                : "➜ " + fmt(result)
            );
        }

        // ---- 停止（還原這個沙盒造成的副作用） ----
        clear() {
            if (!this.active) {
                this.beforeGlobalKeys = null;
                this.registrySnapshots = [];
                this.setOutput("（這個沙盒目前沒有東西可停）");
                this.setStatus(false);
                return 0;
            }

            // 重新 diff 一次 registry，抓到 run() 之後、停止之前才非同步寫入的項目。
            this.captureRegistryAdds();

            let count = 0;

            // 先執行手動清除回呼（可能有順序要求，此時其他資料還沒被清掉）。
            const cleanups = this.track.cleanups.slice().reverse();
            for (const fn of cleanups) {
                try {
                    const r = fn();
                    if (r instanceof Promise) {
                        r.catch((e) => console.warn("🐈‍⬛ [LCS] 非同步清除回呼失敗：", e));
                    }
                    count++;
                } catch (e) {
                    console.warn("🐈‍⬛ [LCS] 清除回呼執行失敗（略過，繼續清除其他項目）：", e);
                }
            }
            this.track.cleanups = [];

            // bcModSdk 公開 API 沒有 unloadMod；下面只是 best-effort 嘗試。
            // 真正可靠的方式是讓 mod 自己以 { allowReplace: true } 呼叫 registerMod。
            for (const name of this.track.modSdkNames) {
                try {
                    if (window.bcModSdk && typeof window.bcModSdk.unloadMod === "function") {
                        window.bcModSdk.unloadMod(name);
                        count++;
                    } else {
                        console.warn(`🐈‍⬛ [LCS] mod "${name}" 的 hook 在 SDK 內部仍會保留（此 SDK 版本沒有 unloadMod）。`);
                    }
                } catch (e) {
                    console.warn(`🐈‍⬛ [LCS] bcModSdk.unloadMod("${name}") 執行失敗：`, e);
                }
            }
            this.track.modSdkNames.clear();

            this.track.timeouts.forEach((id) => orig.clearTimeout(id));
            count += this.track.timeouts.size;
            this.track.timeouts.clear();

            this.track.intervals.forEach((id) => orig.clearInterval(id));
            count += this.track.intervals.size;
            this.track.intervals.clear();

            for (const observer of this.track.observers) {
                try {
                    observer.disconnect();
                    count++;
                } catch (e) {}
            }
            this.track.observers.clear();

            for (const { target, type, listener, options } of this.track.listeners) {
                try {
                    orig.removeEventListener.call(target, type, listener, options);
                    count++;
                } catch (e) {}
            }
            this.track.listeners = [];

            for (const node of this.track.createdNodes) {
                if (node && node.isConnected && node.parentNode) {
                    node.parentNode.removeChild(node);
                    count++;
                }
            }
            this.track.createdNodes.clear();

            for (const descriptor of this.registrySnapshots) {
                const adds = this.track.registryAdds.get(descriptor.path);
                if (adds && adds.size) count += removeRegistryEntries(descriptor, Array.from(adds));
            }
            this.track.registryAdds.clear();

            for (const key of this.track.addedGlobals) {
                try {
                    delete window[key];
                    count++;
                } catch (e) {
                    window[key] = undefined;
                }
            }
            this.track.addedGlobals.clear();

            this.active = false;
            this.beforeGlobalKeys = null;
            this.registrySnapshots = [];
            this.setStatus(false);
            this.setOutput(`⏹ 已停止，共還原 ${count} 項副作用（只包含這個沙盒 #${this.id} 造成的）`);
            return count;
        }

        // 停止並清除面板內目前的程式碼
        stopAndClearCode() {
            const count = this.clear();
            this.textarea.value = "";
            try {
                localStorage.removeItem(codeStorageKey(this.id));
            } catch (e) {}
            this.setOutput(`🗑 已停止並清除程式碼（還原 ${count} 項副作用）`);
        }

        // ---- UI ----

        buildUI() {
            const box = document.createElement("div");
            box.className = "bc-sandbox-box";
            box.style.cssText = `
        position: fixed; width: 600px; max-width: 90vw; max-height: 78vh;
        background: #1a1a2e; border: 2px solid #4a4a8a; border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,.8); z-index: 999999; display: flex;
        flex-direction: column; font-family: Consolas, monospace; color: #e0e0e0;
        overflow: hidden;`;

            const cascade = ((this.id - 1) % 6) * 28;
            box.style.bottom = 20 + cascade + "px";
            box.style.right = 20 + cascade + "px";

            const header = document.createElement("div");
            header.className = "bc-sandbox-header";
            header.style.cssText = `display:flex;justify-content:space-between;align-items:center;
        padding:10px 16px;background:#2a2a4a;border-bottom:1px solid #4a4a8a;cursor:move;flex-shrink:0;`;
            header.innerHTML = `
        <span style="font-weight:bold;color:#7cf7ff;">🧪 沙盒 #${this.id}
          <span class="bc-sandbox-status" style="font-size:12px;color:#888;margin-left:8px;">⏸️ 待命</span>
        </span>
        <div>
          <button data-act="mode" title="沙盒模式（追蹤副作用，可 ⏹ 還原）— 點擊切成控制台" style="background:#3a3a5a;color:#fff;border:none;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer;">🧪</button>
          <button data-act="run" title="執行 (Ctrl+Enter)" style="background:#4a8a4a;color:#fff;border:none;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer;">▶</button>
          <button data-act="stop" title="停止" style="background:#8a6a2a;color:#fff;border:none;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer;">⏹</button>
          <button data-act="stopclear" title="停止並清除程式碼" style="background:#8a3a3a;color:#fff;border:none;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer;">🗑</button>
          <button data-act="collapse" title="收合/展開" style="background:#3a3a5a;color:#fff;border:none;border-radius:4px;padding:4px 10px;margin-right:6px;cursor:pointer;">▁</button>
          <button data-act="close" title="關閉並停止" style="background:transparent;color:#ff6b6b;border:1px solid #ff6b6b;border-radius:4px;padding:2px 10px;cursor:pointer;">✕</button>
        </div>`;
            box.appendChild(header);

            const body = document.createElement("div");
            body.className = "bc-sandbox-body";
            body.style.cssText = `display:flex;flex-direction:column;flex:1;min-height:0;`;

            const textarea = document.createElement("textarea");
            textarea.spellcheck = false;
            textarea.style.cssText = `flex:1;min-height:200px;padding:12px;background:#0d0d1a;color:#e0e0e0;
        border:none;font-family:Consolas,monospace;font-size:13px;line-height:1.6;resize:vertical;outline:none;tab-size:4;`;
            textarea.placeholder =
                "// 貼測試碼，Ctrl+Enter 執行\n// 若用 innerHTML 產生節點，記得包一層 window.__bcSandboxTrack(node) 才會被自動清除。\n// 若清除順序有要求，用 window.__bcSandboxOnClear(fn) 註冊。";
            body.appendChild(textarea);

            const output = document.createElement("div");
            output.style.cssText = `max-height:140px;min-height:50px;padding:8px 12px;background:#0d0d1a;
        border-top:1px solid #2a2a4a;font-size:12px;line-height:1.5;overflow-y:auto;color:#aaa;
        white-space:pre-wrap;word-break:break-all;flex-shrink:0;`;
            output.textContent = "// 等待執行...";
            body.appendChild(output);

            box.appendChild(body);
            document.body.appendChild(box);

            this.box = box;
            this.body = body;
            this.textarea = textarea;
            this.output = output;
            this.statusEl = header.querySelector(".bc-sandbox-status");
            this.modeBtn = header.querySelector('[data-act="mode"]');

            header.addEventListener("click", (e) => {
                const btn = e.target.closest("button");
                if (!btn) return;
                const act = btn.dataset.act;
                if (act === "mode") this.toggleMode();
                else if (act === "run") this.run(this.textarea.value);
                else if (act === "stop") this.clear();
                else if (act === "stopclear") this.stopAndClearCode();
                else if (act === "collapse") this.toggleCollapse();
                else if (act === "close") this.destroy();
            });

            textarea.addEventListener("keydown", (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    this.run(textarea.value);
                }
                if (e.key === "Tab") {
                    e.preventDefault();
                    const s = textarea.selectionStart,
                          en = textarea.selectionEnd;
                    textarea.value = textarea.value.slice(0, s) + "    " + textarea.value.slice(en);
                    textarea.selectionStart = textarea.selectionEnd = s + 4;
                }
            });
            textarea.addEventListener("input", () => this.persistCode());

            box.addEventListener("mousedown", () => this.manager.bringToFront(this));

            this.makeDraggable(box, header);
        }

        // 累加而非覆蓋：一次執行可能夾雜多筆 console 輸出＋最後的結果。只留最後 300 行。
        setOutput(text) {
            const lines = (this.output.textContent ? this.output.textContent + "\n" : "").concat(text).split("\n");
            this.output.textContent = lines.slice(-300).join("\n");
            this.output.scrollTop = this.output.scrollHeight;
        }
        appendOutput(text) {
            this.setOutput(text);
        }
        clearOutput() {
            this.output.textContent = "";
        }

        toggleMode() {
            this.consoleMode = !this.consoleMode;
            this.modeBtn.textContent = this.consoleMode ? "💻" : "🧪";
            this.modeBtn.title = this.consoleMode ? "控制台模式（不追蹤、不還原）— 點擊切回沙盒" : "沙盒模式（追蹤副作用，可 ⏹ 還原）— 點擊切成控制台";
            this.setOutput(
                this.consoleMode
                ? "💻 控制台模式：直接在全域執行，不追蹤也不清除副作用。"
                : "🧪 沙盒模式：執行內容會被追蹤，可用 ⏹ 還原。"
            );
            if (this.consoleMode && this.active) this.setOutput("⚠️ 先前沙盒模式追蹤的東西還在，需要的話先按 ⏹ 還原。");
        }

        setStatus(active) {
            this.statusEl.textContent = active ? "🟢 運行中" : "⏸️ 待命";
            this.statusEl.style.color = active ? "#7cf7ff" : "#888";
        }

        toggleCollapse() {
            this.collapsed = !this.collapsed;
            this.body.style.display = this.collapsed ? "none" : "flex";
            this.box.style.maxHeight = this.collapsed ? "" : "78vh";
        }

        makeDraggable(el, handle) {
            handle.addEventListener("mousedown", (e) => {
                if (e.target.closest("button")) return;
                e.preventDefault();
                dragBy(el, e);
            });
        }

        persistCode() {
            try {
                localStorage.setItem(codeStorageKey(this.id), this.textarea.value);
            } catch (e) {}
        }

        restoreCode() {
            try {
                const saved = localStorage.getItem(codeStorageKey(this.id));
                if (saved) this.textarea.value = saved;
            } catch (e) {}
        }

        destroy() {
            this.clear();
            this.box.remove();
            try {
                localStorage.removeItem(codeStorageKey(this.id));
            } catch (e) {}
            this.manager.remove(this);
        }
    }

    // ---------------- SandboxManager ----------------

    class SandboxManager {
        constructor() {
            this.instances = [];
            this.zTop = 999999;
            this.buildDock();
            this.buildChatRoomButton();
        }

        // 左下角氣球：登入前才顯示（登入後改用 #chat-room-buttons 的按鈕）。
        // 拖曳移動位置，單純點擊（沒拖動）則新增一個沙盒。
        buildDock() {
            const dock = document.createElement("div");
            dock.id = "bc-sandbox-dock";
            dock.title = "點擊新增沙盒（可拖曳移動）";
            dock.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; width: 48px; height: 48px;
        border-radius: 50%; background:#4a4a8a; overflow:hidden; cursor:grab;
        user-select:none; box-shadow:0 2px 10px rgba(0,0,0,.5); z-index:1000000;`;
            attachIcon(dock);
            document.body.appendChild(dock);
            this.dock = dock;

            dock.addEventListener("mousedown", (e) => {
                e.preventDefault();
                dock.style.cursor = "grabbing";
                dragBy(dock, e, (moved) => {
                    dock.style.cursor = "grab";
                    if (!moved) this.spawn();
                });
            });

            // 登入後藏起氣球；登出回登入畫面會自己出現（雙向同步，1s 一次夠用）。
            const syncDock = () => {
                dock.style.display = window.Player?.MemberNumber === undefined ? "block" : "none";
            };
            syncDock();
            orig.setInterval(syncDock, 1000);
        }

        // 聊天室按鈕列的入口（交給共用協調器 BC_ChatRoomButtons 中央託管）。
        buildChatRoomButton() {
            const createBtn = () => {
                const btn = document.createElement("button");
                btn.id = "bc-sandbox-crb-btn";
                btn.type = "button";
                btn.className = "blank-button button HideOnPopup chat-room-button";
                btn.setAttribute("role", "menuitem");
                btn.title = "新增程式碼沙盒";
                btn.style.cssText = "position:relative;padding:0;overflow:hidden;border-radius:12px;";
                attachIcon(btn);
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.spawn();
                });
                return btn;
            };
            // 同步交出 spec：協調器已載入就直接 add，否則推進待處理佇列等它初始化排空。
            const spec = [CRB_ID, CRB_ORDER, createBtn, { plain: true }];
            const L = (window.Liko = window.Liko || {});
            if (L.__Sys_ChatRoomButtons__?.add) L.__Sys_ChatRoomButtons__.add(...spec);
            else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);
        }

        spawn() {
            const inst = new SandboxInstance(this);
            this.instances.push(inst);
            this.bringToFront(inst);
            return inst;
        }

        remove(inst) {
            this.instances = this.instances.filter((i) => i !== inst);
        }

        bringToFront(inst) {
            this.zTop += 1;
            inst.box.style.zIndex = this.zTop;
        }

        toggleAll() {
            const anyVisible = this.instances.some((i) => i.box.style.display !== "none");
            const show = !anyVisible;
            for (const i of this.instances) i.box.style.display = show ? "flex" : "none";
        }
    }

    // ---------------- 啟動 ----------------
    function init() {
        const check = orig.setInterval(() => {
            if (typeof Player !== "undefined" && typeof AssetGroup !== "undefined") {
                orig.clearInterval(check);
                const manager = new SandboxManager();
                window.__bcSandboxManager = manager;
                console.log(`🐈‍⬛ [LCS] ✅ v${MOD_VER} loaded`);
            }
        }, 500);
    }

    init();
})();