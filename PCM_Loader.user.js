// ==UserScript==
// @name           Liko - Plugin Collection Manager-Loader
// @name:zh        Liko的插件管理器-Loader
// @namespace      https://github.com/awdrrawd/liko-Plugin-Repository
// @version        1.5.0
// @description    Liko's Plugin Collection Manager
// @author         Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @grant          none
// @icon           https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @updateURL      https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js
// @downloadURL    https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js
// @supportURL     https://github.com/awdrrawd/liko-Plugin-Repository/issues
// @run-at         document-end
// ==/UserScript==

// AUTO-GENERATED from src/pcm/loader-entry.js by scripts/build-pcm.mjs. Do not edit directly.
(() => {
  // src/pcm/config.js
  var NETWORK_TIMEOUT_MS = 3e4;
  var STORAGE_KEYS = Object.freeze({
    settings: "BC_PluginManager_Settings",
    account: "PCMAccount",
    accountConfig: "PCMConfig",
    pluginCache: "pcm_plugin_cache",
    jsonCache: "pcm_json_cache",
    customPlugins: "pcm_custom_plugins",
    lastPluginError: "pcm_last_plugin_error"
  });
  function getRepositoryBases(global = window) {
    if (global.LikoDevBase) {
      return {
        plugins: [global.LikoDevBase],
        root: [new URL("../", global.LikoDevBase).href]
      };
    }
    return {
      plugins: [
        "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/",
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/",
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/"
      ],
      root: [
        "https://awdrrawd.github.io/liko-Plugin-Repository/",
        "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/",
        "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/"
      ]
    };
  }

  // src/pcm/download-queue.js
  var DownloadQueue = class {
    constructor(limit = 3) {
      this.limit = limit;
      this.active = 0;
      this.waiting = [];
    }
    run(task, signal) {
      return new Promise((resolve, reject) => {
        const job = { task, resolve, reject, signal };
        const cancel = () => {
          const index = this.waiting.indexOf(job);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
        };
        job.detach = () => signal?.removeEventListener("abort", cancel);
        if (signal?.aborted) {
          cancel();
          return;
        }
        signal?.addEventListener("abort", cancel, { once: true });
        this.waiting.push(job);
        this.drain();
      });
    }
    drain() {
      while (this.active < this.limit && this.waiting.length) {
        const job = this.waiting.shift();
        job.detach();
        this.active++;
        Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
          this.active--;
          this.drain();
        });
      }
    }
  };
  var downloads = new DownloadQueue(3);

  // src/pcm/network.js
  var NetworkTimeoutError = class extends Error {
    constructor(url, timeoutMs) {
      super(`Timeout after ${timeoutMs}ms: ${url}`);
      this.name = "NetworkTimeoutError";
      this.url = url;
      this.timeoutMs = timeoutMs;
    }
  };
  function fetchText(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
    return downloads.run(() => receiveText(url, options, timeoutMs), options.signal);
  }
  async function receiveText(url, options, timeoutMs) {
    const controller = new AbortController();
    let timer, timeoutError, reader;
    const arm = (delay, stage) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timeoutError = new NetworkTimeoutError(url, delay);
        timeoutError.message = `No download progress (${stage}) for ${delay}ms: ${url}`;
        controller.abort(timeoutError);
      }, delay);
    };
    const abort = () => controller.abort(options.signal.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    arm(Math.max(45e3, timeoutMs), "first byte");
    try {
      const response = await fetch(url, { priority: "low", ...options, signal: controller.signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.body?.getReader) throw new Error("Readable response body unavailable");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parts = [];
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value.byteLength) {
          arm(timeoutMs, "body");
          parts.push(decoder.decode(value, { stream: true }));
        }
      }
      parts.push(decoder.decode());
      const text = parts.join("");
      return { response, text, url };
    } catch (error) {
      if (timeoutError) throw timeoutError;
      throw error;
    } finally {
      clearTimeout(timer);
      reader?.releaseLock();
      options.signal?.removeEventListener("abort", abort);
    }
  }
  function isJavaScriptText(text) {
    return typeof text === "string" && text.trim().length > 0 && !text.trimStart().startsWith("<");
  }

  // src/pcm/loader.js
  var CACHE_KEY = "pcm_main_cache";
  var PATHS = {
    module: "dist/pcm/PCM.js",
    classic: "Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js"
  };
  function sourceUrls(path, localBase) {
    if (localBase) return [new URL(`${path}?t=${Date.now()}`, localBase).href];
    return getRepositoryBases({}).root.map((base, index) => `${base}${path}${index === 0 ? `?timestamp=${Date.now()}` : ""}`);
  }
  function validateCode(code) {
    if (!isJavaScriptText(code)) throw new Error("Received HTML or empty JavaScript");
    if (!code.includes("__PCMStartup__")) throw new Error("PCM release lacks startup handshake");
  }
  async function importCode(code) {
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    try {
      await import(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function waitForStartup(global) {
    const startup = global.Liko.__PCMStartup__;
    if (!startup?.promise) throw new Error("PCM startup handshake missing");
    await startup.promise;
    if (startup.status !== "ready" || !global.Liko.PCM || !global.Liko.PCMApi) {
      throw new Error("PCM initialization did not complete");
    }
  }
  function readCache(global) {
    try {
      const cached = JSON.parse(global.localStorage.getItem(CACHE_KEY) || "null");
      if (cached?.schema !== 1 || !["module", "classic"].includes(cached.format)) return null;
      validateCode(cached.code);
      return cached;
    } catch {
      return null;
    }
  }
  function writeCache(global, record) {
    try {
      global.localStorage.setItem(CACHE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn("[PCM] 無法儲存備援快取：", error);
    }
  }
  function startLoader({
    localBase = null,
    global = window,
    download = fetchText,
    executeModule = importCode,
    executeClassic = (code) => new Function(code)()
  } = {}) {
    global.Liko ??= {};
    const previous = global.Liko.__PCMLoader__;
    if (previous?.promise) return previous.promise;
    const loader = { promise: null };
    global.Liko.__PCMLoader__ = loader;
    loader.promise = Promise.resolve().then(async () => {
      if (localBase) global.LikoDevBase = new URL("Plugins/", localBase).href;
      const errors = [];
      if (global.Liko.__PCMStartup__?.status === "starting" || global.Liko.__PCMStartup__?.status === "ready") {
        try {
          await waitForStartup(global);
          return { format: "existing" };
        } catch (error) {
          errors.push(error);
        }
      }
      if (global.Liko.PCM) return { format: "existing" };
      const cached = localBase ? null : readCache(global);
      const execute = async (format, code) => {
        validateCode(code);
        const before = global.Liko.__PCMStartup__;
        await (format === "module" ? executeModule(code) : executeClassic(code));
        if (global.Liko.__PCMStartup__ === before) throw new Error("PCM did not create a startup handshake");
        await waitForStartup(global);
      };
      for (const format of ["module", "classic"]) {
        for (const url of sourceUrls(PATHS[format], localBase)) {
          try {
            const { text: code } = await download(url, { cache: "no-store" });
            await execute(format, code);
            if (!localBase) writeCache(global, {
              schema: 1,
              format,
              code,
              url,
              time: Date.now(),
              version: global.Liko.PCM
            });
            console.log(`[PCM] ✅ ${localBase ? "Local " : ""}${format} PCM started`);
            return { format, url, cached: false };
          } catch (error) {
            errors.push(error);
            console.warn(`[PCM] ⚠️ ${url}:`, error);
          }
        }
      }
      if (cached) {
        try {
          await execute(cached.format, cached.code);
          console.log("[PCM] ✅ PCM started (cached fallback)");
          return { format: cached.format, url: cached.url, cached: true };
        } catch (error) {
          errors.push(error);
        }
      }
      throw new AggregateError(errors, "PCM 載入失敗，無可用的備援版本");
    }).catch((error) => {
      if (global.Liko.__PCMLoader__ === loader) delete global.Liko.__PCMLoader__;
      throw error;
    });
    loader.promise.catch((error) => console.error("[PCM] ❌", error));
    return loader.promise;
  }

  // src/pcm/loader-entry.js
  startLoader();
})();
