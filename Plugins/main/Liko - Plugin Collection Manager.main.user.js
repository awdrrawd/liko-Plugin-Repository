// ==UserScript==
// @name         Liko - Plugin Collection Manager
// @name:zh      Liko的插件管理器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      2.2.2
// @description  Liko的插件集合管理器 | Liko - Plugin Collection Manager
// @author       Liko
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js
// ==/UserScript==

// AUTO-GENERATED from src/pcm/classic-entry.js by scripts/build-pcm.mjs. Do not edit directly.
(() => {
  // src/pcm/release.js
  var PCM_VERSION = "2.2.2";

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
  function getPluginListUrls(global = window) {
    const { root } = getRepositoryBases(global);
    const timestamp = Date.now();
    return root.map((base, index) => `${base}Plugins.json${index === 0 ? `?timestamp=${timestamp}` : ""}`);
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
  async function fetchFirstText(urls, options = {}, validate = null) {
    const attempts = [];
    for (const url of [...new Set(urls.filter(Boolean))]) {
      const startedAt = Date.now();
      try {
        const result = await fetchText(url, options);
        if (!result.response.ok) throw new Error(`HTTP ${result.response.status}`);
        if (validate && !validate(result.text, result.response)) throw new Error("Invalid response content");
        return { ...result, attempts };
      } catch (error2) {
        attempts.push({ url, durationMs: Date.now() - startedAt, error: String(error2?.message || error2) });
      }
    }
    const error = new AggregateError(attempts.map((a) => new Error(`${a.url}: ${a.error}`)), "All sources failed");
    error.attempts = attempts;
    throw error;
  }
  function isJavaScriptText(text) {
    return typeof text === "string" && text.trim().length > 0 && !text.trimStart().startsWith("<");
  }

  // src/pcm/dependencies.js
  var SERVICE_LOADS_KEY = "__PCMServiceLoads__";
  var DependencyLoader = class {
    constructor({ global = window, documentRef = document, runtime = null } = {}) {
      this.global = global;
      this.document = documentRef;
      this.runtime = runtime;
      this.loads = global[SERVICE_LOADS_KEY] ??= /* @__PURE__ */ new Map();
    }
    ensure({ name, relativePath, ready }) {
      if (ready()) return Promise.resolve(true);
      if (this.loads.has(name)) return this.loads.get(name);
      const promise = this.load(relativePath).then(() => {
        if (!ready()) throw new Error(`${name} loaded without exposing its expected API`);
        return true;
      }).catch((error) => {
        if (this.runtime) this.runtime.log("WARN", `Dependency failed: ${name}`, { error: String(error?.message || error) });
        else console.warn(`[PCM] Dependency failed: ${name}`, error);
        throw error;
      }).finally(() => {
        if (this.loads.get(name) === promise) this.loads.delete(name);
      });
      this.loads.set(name, promise);
      return promise;
    }
    async load(relativePath) {
      const bases = getRepositoryBases(this.global).plugins;
      const result = await fetchFirstText(bases.map((base) => base + relativePath), { cache: "no-store" }, isJavaScriptText);
      const script = this.document.createElement("script");
      script.dataset.pcmDependency = relativePath;
      script.textContent = `${result.text}
//# sourceURL=${result.url}`;
      this.document.head.appendChild(script);
      return result.url;
    }
    async ensureCore() {
      await this.ensure({
        name: "bcmodsdk",
        relativePath: "expand/bcmodsdk.js",
        ready: () => Boolean(this.global.bcModSdk?.registerMod)
      });
      await this.ensure({
        name: "i18n",
        relativePath: "expand/BC_i18n.js",
        ready: () => {
          const liko = this.global.Liko;
          return typeof liko?.__Sys_i18n__?.ensure === "function" && typeof liko?.__Sys_L10N__?.localize === "function" && typeof liko?.__Sys_Flags__?.ensure === "function" && typeof liko?.__Sys_Flags__?.renderLabel === "function";
        }
      }).catch(() => {
      });
      const optional = [
        ["toast", "expand/BC_toast_system.user.js", () => Boolean(this.global.Liko?.__Sys_Toast__)],
        ["color", "expand/BC_ThemeColorCheck.js", () => Boolean(this.global.Liko?.__Sys_ColorAPI__)],
        ["chat-buttons", "expand/BC_ChatRoomButtons.js", () => Boolean(this.global.Liko?.__Sys_ChatRoomButtons__)]
      ];
      for (const [name, relativePath, ready] of optional) {
        await this.ensure({ name, relativePath, ready }).catch(() => {
        });
      }
    }
  };

  // src/pcm/lifecycle.js
  var Lifecycle = class {
    constructor() {
      this.disposed = false;
      this.cleanups = /* @__PURE__ */ new Set();
      this.timeouts = /* @__PURE__ */ new Set();
      this.intervals = /* @__PURE__ */ new Set();
    }
    timeout(callback, delay = 0) {
      if (this.disposed) return null;
      const id = setTimeout(() => {
        this.timeouts.delete(id);
        if (!this.disposed) callback();
      }, delay);
      this.timeouts.add(id);
      return id;
    }
    interval(callback, delay) {
      if (this.disposed) return null;
      const id = setInterval(() => {
        if (!this.disposed) callback();
      }, delay);
      this.intervals.add(id);
      return id;
    }
    listen(target, type, listener, options) {
      if (this.disposed) return listener;
      target.addEventListener(type, listener, options);
      this.add(() => target.removeEventListener(type, listener, options));
      return listener;
    }
    add(cleanup) {
      if (this.disposed) {
        cleanup();
        return () => {
        };
      }
      this.cleanups.add(cleanup);
      return cleanup;
    }
    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      for (const id of this.timeouts) clearTimeout(id);
      for (const id of this.intervals) clearInterval(id);
      this.timeouts.clear();
      this.intervals.clear();
      const cleanups = [...this.cleanups].reverse();
      this.cleanups.clear();
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (error) {
          console.error("[PCM] Cleanup failed", error);
        }
      }
    }
    clearTimeout(id) {
      clearTimeout(id);
      this.timeouts.delete(id);
    }
    clearInterval(id) {
      clearInterval(id);
      this.intervals.delete(id);
    }
    sleep(delay) {
      if (this.disposed) return Promise.resolve(false);
      return new Promise((resolve) => {
        const cancelled = () => resolve(false);
        this.add(cancelled);
        this.timeout(() => {
          this.cleanups.delete(cancelled);
          resolve(true);
        }, delay);
      });
    }
  };

  // src/pcm/manifest.js
  var SAFE_PLUGIN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  var LOAD_TYPES = /* @__PURE__ */ new Set(["eval", "scr", "mod"]);
  function normalizeManifest(data, onWarning = null) {
    if (!data || typeof data !== "object" || !Array.isArray(data.plugins)) return null;
    const plugins = [];
    const seen = /* @__PURE__ */ new Set();
    for (const raw of data.plugins) {
      const result = normalizePlugin(raw, seen);
      if (result.plugin) {
        plugins.push(result.plugin);
        seen.add(result.plugin.id);
      } else {
        onWarning?.(result.reason, raw);
      }
    }
    return plugins.length ? { ...data, plugins } : null;
  }
  function normalizePlugin(raw, seen = /* @__PURE__ */ new Set()) {
    if (!raw || typeof raw !== "object") return { plugin: null, reason: "Plugin entry is not an object" };
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const type = raw.type == null || raw.type === "" ? "eval" : raw.type;
    const urls = [raw.url, raw.mirrorUrl, raw.altUrl, raw.altMirrorUrl].filter(Boolean);
    if (!SAFE_PLUGIN_ID.test(id)) return { plugin: null, reason: `Invalid plugin id: ${id || "(missing)"}` };
    if (seen.has(id)) return { plugin: null, reason: `Duplicate plugin id: ${id}` };
    if (!name) return { plugin: null, reason: `Missing plugin name: ${id}` };
    if (!LOAD_TYPES.has(type)) return { plugin: null, reason: `Invalid load type for ${id}: ${type}` };
    if (!raw.url && !raw.inlineCode) return { plugin: null, reason: `Missing source for ${id}` };
    if (!urls.every((url) => typeof url === "string" && /^https:\/\//i.test(url))) {
      return { plugin: null, reason: `Non-HTTPS source for ${id}` };
    }
    return {
      plugin: {
        ...raw,
        id,
        name,
        type,
        priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 5
      },
      reason: null
    };
  }

  // src/pcm/i18n/PCM-i18n.js
  var PCM_STRINGS = Object.freeze({
    "hideBalloon": { "EN": "Hide balloon", "TW": "隱藏氣球", "CN": "隐藏气球", "DE": "Sprechblase ausblenden", "FR": "Masquer la bulle", "RU": "Скрывать значок", "UA": "Приховувати значок" },
    "hideMainHall": { "EN": "Main hall", "TW": "大廳", "CN": "大厅", "DE": "Haupthalle", "FR": "Hall principal", "RU": "Главный зал", "UA": "Головна зала" },
    "hidePreference": { "EN": "Settings page", "TW": "設定頁", "CN": "设置页", "DE": "Einstellungen", "FR": "Paramètres", "RU": "Настройки", "UA": "Налаштування" },
    "hideInformationSheet": { "EN": "Profile", "TW": "個人資料", "CN": "个人资料", "DE": "Profil", "FR": "Profil", "RU": "Профиль", "UA": "Профіль" },
    "loaded": { "EN": "Liko's Plugin Collection Manager v{ver} loaded! Click the floating button to manage plugins.", "TW": "Liko的插件管理器 v{ver} 載入完成！點擊浮動按鈕管理插件。", "CN": "Liko的插件管理器 v{ver} 载入完成！点击浮动按钮管理插件。", "DE": "Liko's Plugin Collection Manager v{ver} geladen! Klicke den schwebenden Button zum Verwalten.", "FR": "Liko's Plugin Collection Manager v{ver} chargé ! Cliquez sur le bouton flottant.", "RU": "Менеджер плагинов Liko v{ver} загружен! Нажмите кнопку для управления плагинами.", "UA": "Менеджер плагінів Liko v{ver} завантажено! Натисніть кнопку для керування." },
    "shortLoaded": { "EN": "📋 Liko Plugin Collection Manager Manual\n\n🎮 How to Use:\n• Click the floating button to open panel\n• Toggle switches to enable/disable plugins\n• Three-state toggle: OFF → ON → BETA\n\n📝 Commands:\n/pcm help — show this\n/pcm list — list all plugins\n\n💡 Plugins load on enable, or take effect on next refresh.", "TW": "📋 Liko 插件管理器 說明書\n\n🎮 使用方法：\n• 點擊浮動按鈕開啟管理面板\n• 切換開關來啟用/停用插件\n• 三段開關：OFF → ON → BETA\n\n📝 可用指令：\n/pcm help — 顯示此說明\n/pcm list — 查看所有插件\n\n💡 插件啟用後自動載入，或下次刷新生效。", "CN": "📋 Liko 插件管理器 说明书\n\n🎮 使用方法：\n• 点击浮动按钮打开管理面板\n• 切换开关来启用/停用插件\n• 三段开关：OFF → ON → BETA\n\n📝 可用指令：\n/pcm help — 显示此说明\n/pcm list — 查看所有插件\n\n💡 插件启用后自动载入，或下次刷新生效。", "DE": "📋 Liko Plugin-Manager Handbuch\n\n🎮 Verwendung:\n• Schwebenden Button klicken\n• Schalter umlegen zum Aktivieren/Deaktivieren\n\n📝 Befehle:\n/pcm help — Hilfe anzeigen\n/pcm list — Plugins auflisten", "FR": "📋 Manuel du Gestionnaire de Plugins Liko\n\n🎮 Utilisation:\n• Cliquez sur le bouton flottant\n• Basculez les interrupteurs pour activer/désactiver\n\n📝 Commandes:\n/pcm help — afficher l'aide\n/pcm list — lister les plugins", "RU": "📋 Руководство по менеджеру плагинов Liko\n\n🎮 Использование:\n• Нажмите плавающую кнопку\n• Переключайте для включения/отключения плагинов\n\n📝 Команды:\n/pcm help — справка\n/pcm list — список плагинов", "UA": "📋 Посібник менеджера плагінів Liko\n\n🎮 Використання:\n• Натисніть кнопку\n• Перемикайте для увімкнення/вимкнення\n\n📝 Команди:\n/pcm help — довідка\n/pcm list — список плагінів" },
    "welcomeTitle": { "EN": "🐈‍⬛ Plugin Manager", "TW": "🐈‍⬛ 插件管理器", "CN": "🐈‍⬛ 插件管理器", "DE": "🐈‍⬛ Plugin-Manager", "FR": "🐈‍⬛ Gestionnaire de plugins", "RU": "🐈‍⬛ Менеджер плагинов", "UA": "🐈‍⬛ Менеджер плагінів" },
    "tabLocal": { "EN": "📱 Local", "TW": "📱 本地", "CN": "📱 本地", "DE": "📱 Lokal", "FR": "📱 Local", "RU": "📱 Локальные", "UA": "📱 Локальні" },
    "tabAccount": { "EN": "☁️ Account", "TW": "☁️ 帳戶", "CN": "☁️ 账户", "DE": "☁️ Konto", "FR": "☁️ Compte", "RU": "☁️ Аккаунт", "UA": "☁️ Акаунт" },
    "tabCustom": { "EN": "🔧 Custom", "TW": "🔧 自訂", "CN": "🔧 自定义", "DE": "🔧 Eigene", "FR": "🔧 Personnalisé", "RU": "🔧 Свои", "UA": "🔧 Власні" },
    "tabFusam": { "EN": "◆ FUSAM", "TW": "◆ FUSAM", "CN": "◆ FUSAM", "DE": "◆ FUSAM", "FR": "◆ FUSAM", "RU": "◆ FUSAM", "UA": "◆ FUSAM" },
    "searchPlaceholder": { "EN": "Search plugins...", "TW": "搜尋插件...", "CN": "搜索插件...", "DE": "Plugins suchen...", "FR": "Rechercher des plugins...", "RU": "Поиск плагинов...", "UA": "Пошук плагінів..." },
    "filterAll": { "EN": "Showing: All", "TW": "顯示：全部", "CN": "显示：全部", "DE": "Alle", "FR": "Tous", "RU": "Все", "UA": "Усі" },
    "filterEnabled": { "EN": "Showing: Enabled", "TW": "顯示：已啟用", "CN": "显示：已启用", "DE": "Aktivierte", "FR": "Activés", "RU": "Включённые", "UA": "Увімкнені" },
    "filterDisabled": { "EN": "Showing: Disabled", "TW": "顯示：已停用", "CN": "显示：已停用", "DE": "Deaktivierte", "FR": "Désactivés", "RU": "Выключённые", "UA": "Вимкнені" },
    "pluginEnabled": { "EN": "enabled", "TW": "已啟用", "CN": "已启用", "DE": "aktiviert", "FR": "activé", "RU": "включён", "UA": "увімкнено" },
    "pluginDisabled": { "EN": "disabled", "TW": "已停用", "CN": "已停用", "DE": "deaktiviert", "FR": "désactivé", "RU": "выключен", "UA": "вимкнено" },
    "willTakeEffect": { "EN": "Plugin loaded or will take effect on next refresh", "TW": "插件已載入或將在下次刷新生效", "CN": "插件已载入或将在下次刷新生效", "DE": "Plugin geladen oder wirkt nach dem nächsten Refresh", "FR": "Plugin chargé ou prendra effet au prochain rechargement", "RU": "Плагин загружен или вступит в силу после перезагрузки", "UA": "Плагін завантажено або набуде чинності після оновлення" },
    "willNotStart": { "EN": "Will not start on next load", "TW": "下次載入時將不會啟動", "CN": "下次载入时将不会启动", "DE": "Wird beim nächsten Laden nicht gestartet", "FR": "Ne démarrera pas au prochain chargement", "RU": "Не будет запущен при следующей загрузке", "UA": "Не запуститься при наступному завантаженні" },
    "visitWebsite": { "EN": "Visit website", "TW": "訪問網站", "CN": "访问网站", "DE": "Website besuchen", "FR": "Visiter le site", "RU": "Посетить сайт", "UA": "Відвідати сайт" },
    "changelogTitle": { "EN": "📋 Update Log", "TW": "📋 更新日誌", "CN": "📋 更新日志", "DE": "📋 Änderungsprotokoll", "FR": "📋 Journal des mises à jour", "RU": "📋 Журнал обновлений", "UA": "📋 Журнал оновлень" },
    "changelogClose": { "EN": "Close", "TW": "關閉", "CN": "关闭", "DE": "Schließen", "FR": "Fermer", "RU": "Закрыть", "UA": "Закрити" },
    "newVersionTitle": { "EN": "✨ PCM Updated", "TW": "✨ PCM 已更新", "CN": "✨ PCM 已更新", "DE": "✨ PCM aktualisiert", "FR": "✨ PCM mis à jour", "RU": "✨ PCM обновлён", "UA": "✨ PCM оновлено" },
    "newVersionHint": { "EN": "Click 📋 to view again anytime", "TW": "隨時點擊 📋 再次查看", "CN": "随时点击 📋 再次查看", "DE": "Jederzeit 📋 klicken zum Erneut-Anzeigen", "FR": "Cliquez sur 📋 pour revoir à tout moment", "RU": "Нажмите 📋 в любое время", "UA": "Натисніть 📋 будь-коли" },
    "loadingPlugins": { "EN": "Loading plugin list...", "TW": "正在載入插件清單...", "CN": "正在载入插件清单...", "DE": "Plugin-Liste wird geladen...", "FR": "Chargement de la liste...", "RU": "Загрузка списка плагинов...", "UA": "Завантаження списку плагінів..." },
    "loadPluginsFailed": { "EN": "Failed to load plugin list, please refresh", "TW": "插件清單載入失敗，請刷新頁面", "CN": "插件清单载入失败，请刷新页面", "DE": "Plugin-Liste konnte nicht geladen werden", "FR": "Impossible de charger la liste des plugins", "RU": "Не удалось загрузить список плагинов", "UA": "Не вдалося завантажити список плагінів" },
    "refreshTitle": { "EN": "Clear Cache & Refresh", "TW": "清除快取並重新下載", "CN": "清除缓存并重新下载", "DE": "Cache leeren & aktualisieren", "FR": "Vider le cache et actualiser", "RU": "Очистить кэш и обновить", "UA": "Очистити кеш і оновити" },
    "refreshing": { "EN": "Clearing cache and re-downloading...", "TW": "正在清除快取並重新下載...", "CN": "正在清除缓存并重新下载...", "DE": "Cache wird geleert und neu geladen...", "FR": "Vidage du cache et téléchargement...", "RU": "Очистка кэша и повторная загрузка...", "UA": "Очищення кешу та повторне завантаження..." },
    "refreshDone": { "EN": "All cache cleared, plugin list updated! Please refresh the game to fully apply the latest main script and plugins.", "TW": "所有快取已清除，插件清單已更新為最新版！請重新整理遊戲頁面以完整套用最新的主程式與各插件。", "CN": "所有缓存已清除，插件清单已更新为最新版！请重新刷新游戏页面以完整套用最新的主程序与各插件。", "DE": "Cache geleert, Plugin-Liste aktualisiert! Bitte das Spiel neu laden, um Hauptskript und Plugins vollständig zu aktualisieren.", "FR": "Cache vidé, liste des plugins mise à jour ! Veuillez actualiser le jeu pour appliquer entièrement le script principal et les plugins.", "RU": "Кэш очищен, список плагинов обновлён! Обновите игру, чтобы полностью применить последнюю версию основного скрипта и плагинов.", "UA": "Кеш очищено, список плагінів оновлено! Оновіть гру, щоб повністю застосувати останню версію основного скрипту та плагінів." },
    "refreshFailed": { "EN": "Update failed, using cached list", "TW": "更新失敗，使用舊版清單", "CN": "更新失败，使用旧版清单", "DE": "Aktualisierung fehlgeschlagen", "FR": "Mise à jour échouée, liste en cache utilisée", "RU": "Обновление не удалось, используется кэш", "UA": "Оновлення не вдалося, використовується кеш" },
    "pluginLoadComplete": { "EN": "Plugin loading complete", "TW": "插件載入完成", "CN": "插件载入完成", "DE": "Plugin-Laden abgeschlossen", "FR": "Chargement des plugins terminé", "RU": "Загрузка плагинов завершена", "UA": "Завантаження плагінів завершено" },
    "successLoaded": { "EN": "Loaded", "TW": "已載入", "CN": "已载入", "DE": "Geladen", "FR": "Chargés", "RU": "Загружено", "UA": "Завантажено" },
    "pcmLoadedCount": { "EN": "PCM - {count} loaded successfully", "TW": "PCM - {count}個載入成功", "CN": "PCM - {count}个加载成功", "DE": "PCM - {count} erfolgreich geladen", "FR": "PCM - {count} chargés avec succès", "RU": "PCM - успешно загружено {count}", "UA": "PCM - успішно завантажено {count}" },
    "fusamLoadedCount": { "EN": "FUSAM - {count} loaded successfully", "TW": "FUSAM - {count}個載入成功", "CN": "FUSAM - {count}个加载成功", "DE": "FUSAM - {count} erfolgreich geladen", "FR": "FUSAM - {count} chargés avec succès", "RU": "FUSAM - успешно загружено {count}", "UA": "FUSAM - успішно завантажено {count}" },
    "pcmFailedCount": { "EN": "PCM - {count} failed to load", "TW": "PCM - {count}個載入失敗", "CN": "PCM - {count}个加载失败", "DE": "PCM - {count} konnten nicht geladen werden", "FR": "PCM - échec du chargement de {count}", "RU": "PCM - не удалось загрузить {count}", "UA": "PCM - не вдалося завантажити {count}" },
    "fusamFailedCount": { "EN": "FUSAM - {count} failed to load", "TW": "FUSAM - {count}個載入失敗", "CN": "FUSAM - {count}个加载失败", "DE": "FUSAM - {count} konnten nicht geladen werden", "FR": "FUSAM - échec du chargement de {count}", "RU": "FUSAM - не удалось загрузить {count}", "UA": "FUSAM - не вдалося завантажити {count}" },
    "plugins": { "EN": "plugins", "TW": "個插件", "CN": "个插件", "DE": "Plugins", "FR": "plugins", "RU": "плагинов", "UA": "плагінів" },
    "failed": { "EN": "failed", "TW": "個失敗", "CN": "个失败", "DE": "fehlgeschlagen", "FR": "échoués", "RU": "не удалось", "UA": "невдало" },
    "pluginLoadFailed": { "EN": "{name} failed to load", "TW": "{name} 載入失敗", "CN": "{name} 载入失败", "DE": "{name} konnte nicht geladen werden", "FR": "{name} n'a pas pu être chargé", "RU": "{name} не удалось загрузить", "UA": "{name} не вдалося завантажити" },
    "pluginLoadRetry": { "EN": "Click ↺ on the plugin to retry", "TW": "點擊插件上的 ↺ 重試", "CN": "点击插件上的 ↺ 重试", "DE": "Klicke ↺ am Plugin zum Wiederholen", "FR": "Cliquez sur ↺ pour réessayer", "RU": "Нажмите ↺ для повтора", "UA": "Натисніть ↺ для повторної спроби" },
    "accountNotLoggedIn": { "EN": "🔒\nPlease log in to use account settings", "TW": "🔒\n請先登入遊戲帳號", "CN": "🔒\n请先登录游戏账号", "DE": "🔒\nBitte anmelden", "FR": "🔒\nVeuillez vous connecter", "RU": "🔒\nВойдите в аккаунт", "UA": "🔒\nУвійдіть до акаунту" },
    "customAddTitle": { "EN": "Add Custom Plugin", "TW": "新增自訂插件", "CN": "新增自定义插件", "DE": "Plugin hinzufügen", "FR": "Ajouter un plugin", "RU": "Добавить плагин", "UA": "Додати плагін" },
    "customFieldName": { "EN": "Plugin name *", "TW": "插件名稱 *", "CN": "插件名称 *", "DE": "Plugin-Name *", "FR": "Nom du plugin *", "RU": "Название *", "UA": "Назва *" },
    "customFieldUrl": { "EN": "URL (.js) *", "TW": "插件網址 (.js) *", "CN": "插件网址 (.js) *", "DE": "URL (.js) *", "FR": "URL (.js) *", "RU": "URL (.js) *", "UA": "URL (.js) *" },
    "customFieldIcon": { "EN": "Icon — emoji or image URL (optional)", "TW": "圖示（emoji 或圖片網址，選填）", "CN": "图标（emoji 或图片网址，选填）", "DE": "Symbol — Emoji oder Bild-URL (optional)", "FR": "Icône — emoji ou URL (optionnel)", "RU": "Иконка — emoji или URL (необязательно)", "UA": "Іконка — emoji або URL (необов'язково)" },
    "customFieldDesc": { "EN": "Description (optional)", "TW": "描述（選填）", "CN": "描述（选填）", "DE": "Beschreibung (optional)", "FR": "Description (optionnel)", "RU": "Описание (необязательно)", "UA": "Опис (необов'язково)" },
    "customFieldType": { "EN": "Load method (advanced, leave default if unsure)", "TW": "載入方式（進階，不確定時請保留預設值）", "CN": "加载方式（高级，不确定时请保留默认值）", "DE": "Lademethode (erweitert; im Zweifel Standard beibehalten)", "FR": "Méthode de chargement (avancé, conserver la valeur par défaut en cas de doute)", "RU": "Способ загрузки (для опытных; если не уверены, оставьте значение по умолчанию)", "UA": "Спосіб завантаження (для досвідчених; якщо не впевнені, залиште типове значення)" },
    "customTypeEval": { "EN": "Eval — fetch code as text & run it (default)", "TW": "Eval — 將程式碼作為文字取得並執行（預設）", "CN": "Eval — 将代码作为文本获取并运行（默认）", "DE": "Eval — Code als Text abrufen und ausführen (Standard)", "FR": "Eval — récupérer le code comme texte et l’exécuter (par défaut)", "RU": "Eval — получить код как текст и выполнить (по умолчанию)", "UA": "Eval — отримати код як текст і виконати (типово)" },
    "customTypeScr": { "EN": "Script tag — <script src>, use if the host blocks fetch() with CORS", "TW": "Script 標籤 — 使用 <script src>；適用於主機以 CORS 阻擋 fetch() 時", "CN": "Script 标签 — 使用 <script src>；适用于主机通过 CORS 阻止 fetch() 时", "DE": "Script-Tag — <script src>; verwenden, wenn der Host fetch() durch CORS blockiert", "FR": "Balise script — <script src>, à utiliser si l’hôte bloque fetch() avec CORS", "RU": "Тег script — <script src>; используйте, если хост блокирует fetch() политикой CORS", "UA": "Тег script — <script src>; використовуйте, якщо хост блокує fetch() політикою CORS" },
    "customTypeMod": { "EN": "Module — dynamic import(), for Vite/Rollup ESM bundles", "TW": "模組 — 使用 dynamic import()；適用於 Vite／Rollup ESM 套件", "CN": "模块 — 使用 dynamic import()；适用于 Vite／Rollup ESM 包", "DE": "Modul — dynamic import(), für Vite-/Rollup-ESM-Bundles", "FR": "Module — dynamic import(), pour les bundles ESM Vite/Rollup", "RU": "Модуль — dynamic import(), для ESM-сборок Vite/Rollup", "UA": "Модуль — dynamic import(), для ESM-збірок Vite/Rollup" },
    "customBtnAdd": { "EN": "Add", "TW": "新增", "CN": "新增", "DE": "Hinzufügen", "FR": "Ajouter", "RU": "Добавить", "UA": "Додати" },
    "customBtnCancel": { "EN": "Cancel", "TW": "取消", "CN": "取消", "DE": "Abbrechen", "FR": "Annuler", "RU": "Отмена", "UA": "Скасувати" },
    "customDeleteConfirm": { "EN": 'Remove "{name}"?', "TW": "確定要移除「{name}」嗎？", "CN": "确定要移除「{name}」吗？", "DE": '„{name}" entfernen?', "FR": "Supprimer « {name} » ?", "RU": "Удалить «{name}»?", "UA": "Видалити «{name}»?" },
    "customDeleteYes": { "EN": "Remove", "TW": "移除", "CN": "移除", "DE": "Entfernen", "FR": "Supprimer", "RU": "Удалить", "UA": "Видалити" },
    "customAdded": { "EN": "{name} added", "TW": "{name} 已新增", "CN": "{name} 已新增", "DE": "{name} hinzugefügt", "FR": "{name} ajouté", "RU": "{name} добавлен", "UA": "{name} додано" },
    "customDeleted": { "EN": "{name} removed", "TW": "{name} 已移除", "CN": "{name} 已移除", "DE": "{name} entfernt", "FR": "{name} supprimé", "RU": "{name} удалён", "UA": "{name} видалено" },
    "customUrlInvalid": { "EN": "URL must end in .js", "TW": "網址必須以 .js 結尾", "CN": "网址必须以 .js 结尾", "DE": "URL muss mit .js enden", "FR": "L'URL doit se terminer par .js", "RU": "URL должен заканчиваться на .js", "UA": "URL має закінчуватися на .js" },
    "customNameRequired": { "EN": "Please enter a name", "TW": "請輸入插件名稱", "CN": "请输入插件名称", "DE": "Bitte einen Namen eingeben", "FR": "Veuillez saisir un nom", "RU": "Введите название", "UA": "Введіть назву" },
    "customEmptyHint": { "EN": "No custom plugins yet.\nTap ＋ in the lower-right corner to add one.", "TW": "尚無自訂插件。\n點擊右下角 ＋ 來新增。", "CN": "尚无自定义插件。\n点击右下角 ＋ 来新增。", "DE": "Noch keine eigenen Plugins.\nTippe unten rechts auf ＋.", "FR": "Aucun plugin personnalisé.\nTouchez ＋ en bas à droite.", "RU": "Своих плагинов пока нет.\nНажмите ＋ внизу справа.", "UA": "Власних плагінів немає.\nНатисніть ＋ унизу праворуч." },
    "prefButton": { "EN": "PCM Plugin Manager", "TW": "PCM 插件管理器", "CN": "PCM 插件管理器", "DE": "PCM Plugin-Manager", "FR": "Gestionnaire de plugins PCM", "RU": "Менеджер плагинов PCM", "UA": "Менеджер плагінів PCM" },
    "settingsTitle": { "EN": "PCM Settings", "TW": "PCM 設定", "CN": "PCM 设置", "DE": "PCM-Einstellungen", "FR": "Paramètres PCM", "RU": "Настройки PCM", "UA": "Налаштування PCM" },
    "settingsLanguage": { "EN": "Language", "TW": "語言", "CN": "语言", "DE": "Sprache", "FR": "Langue", "RU": "Язык", "UA": "Мова" },
    "settingsAuto": { "EN": "AUTO", "TW": "AUTO", "CN": "AUTO", "DE": "AUTO", "FR": "AUTO", "RU": "AUTO", "UA": "AUTO" },
    "settingsLoadNotif": { "EN": "Show plugin loading notifications", "TW": "顯示插件載入通知", "CN": "显示插件加载通知", "DE": "Plugin-Ladehinweise anzeigen", "FR": "Afficher les notifications de chargement", "RU": "Показывать уведомления о загрузке", "UA": "Показувати сповіщення про завантаження" },
    "settingsFusam": { "EN": "Load FUSAM plugin list", "TW": "載入 FUSAM 插件列表", "CN": "加载 FUSAM 插件列表", "DE": "FUSAM-Pluginliste laden", "FR": "Charger la liste des plugins FUSAM", "RU": "Загружать список плагинов FUSAM", "UA": "Завантажувати список плагінів FUSAM" },
    "settingsCustom": { "EN": "Show custom plugins tab", "TW": "顯示自訂插件分頁", "CN": "显示自定义插件分页", "DE": "Eigene Plugins anzeigen", "FR": "Afficher les plugins personnalisés", "RU": "Показывать свои плагины", "UA": "Показувати власні плагіни" },
    "settingsClose": { "EN": "Done", "TW": "完成", "CN": "完成", "DE": "Fertig", "FR": "Terminé", "RU": "Готово", "UA": "Готово" },
    "fusamTitle": { "EN": "Fantastic Ultimate Solution to Addon Management", "TW": "Fantastic Ultimate Solution to Addon Management", "CN": "Fantastic Ultimate Solution to Addon Management", "DE": "Fantastic Ultimate Solution to Addon Management", "FR": "Fantastic Ultimate Solution to Addon Management", "RU": "Fantastic Ultimate Solution to Addon Management", "UA": "Fantastic Ultimate Solution to Addon Management" },
    "fusamDesc": { "EN": "An independent community addon manager. PCM reads its official GitLab Pages manifest directly.", "TW": "獨立的社群插件管理器。PCM 直接讀取其官方 GitLab Pages Manifest。", "CN": "独立的社区插件管理器。PCM 直接读取其官方 GitLab Pages Manifest。", "DE": "Ein unabhängiger Community-Addon-Manager. PCM liest das offizielle Manifest direkt von GitLab Pages.", "FR": "Un gestionnaire communautaire indépendant. PCM lit directement son manifeste officiel sur GitLab Pages.", "RU": "Независимый менеджер дополнений сообщества. PCM напрямую читает официальный манифест с GitLab Pages.", "UA": "Незалежний менеджер доповнень спільноти. PCM безпосередньо читає офіційний маніфест із GitLab Pages." },
    "fusamOpen": { "EN": "Open official FUSAM installation page", "TW": "開啟 FUSAM 官方安裝頁", "CN": "打开 FUSAM 官方安装页", "DE": "Offizielle FUSAM-Installation öffnen", "FR": "Ouvrir l’installation officielle de FUSAM", "RU": "Открыть официальную страницу установки FUSAM", "UA": "Відкрити офіційну сторінку встановлення FUSAM" },
    "fusamLicense": { "EN": "FUSAM is an independent GPLv3 project. Addons installed there are managed by FUSAM.", "TW": "FUSAM 是獨立的 GPLv3 專案；由它安裝的插件會交由 FUSAM 管理。", "CN": "FUSAM 是独立的 GPLv3 项目；由它安装的插件将由 FUSAM 管理。", "DE": "FUSAM ist ein unabhängiges GPLv3-Projekt; dort installierte Addons werden von FUSAM verwaltet.", "FR": "FUSAM est un projet GPLv3 indépendant ; les extensions installées par ce biais sont gérées par FUSAM.", "RU": "FUSAM — независимый проект GPLv3; установленные через него плагины управляются FUSAM.", "UA": "FUSAM — незалежний проєкт GPLv3; встановленими через нього плагінами керує FUSAM." }
  });

  // src/pcm/i18n/index.js
  function registerPCMTranslations({ global = window, lifecycle, attempt = 0 } = {}) {
    if (lifecycle?.disposed) return false;
    const engine = global.Liko?.__Sys_i18n__;
    if (typeof engine?.register === "function") {
      engine.register("PCM", PCM_STRINGS);
      return true;
    }
    if (lifecycle && attempt < 100) {
      lifecycle.timeout(() => registerPCMTranslations({ global, lifecycle, attempt: attempt + 1 }), 100);
    }
    return false;
  }
  function translatePCM(key, vars = {}, language, global = window) {
    const engine = global.Liko?.__Sys_i18n__;
    if (typeof engine?.t === "function") return engine.t("PCM", key, vars, language);
    const strings = PCM_STRINGS[key];
    const text = strings?.[language || getLanguage(global)] ?? strings?.EN ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] == null ? match : String(vars[name]));
  }
  function getLanguage(global = window) {
    return global.Liko?.__Sys_i18n__?.detectLang?.() ?? "EN";
  }

  // src/pcm/fusam-compat.js
  var BRAND = Symbol.for("pcm.fusam.compat");
  var STYLE_ID = "pcm-fusam-compat-style";
  var MODAL_ROOT_ID = "pcm-fusam-modal-root";
  var LANGUAGES = ["TW", "CN", "EN", "DE", "FR", "RU", "UA"];
  function existingFusam() {
    const value = window.FUSAM;
    return !!value && typeof value === "object" && value.present === true;
  }
  function injectModalStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${MODAL_ROOT_ID}{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding:12px;background:#0005;font:16px Arial,sans-serif}
.pcm-fusam-modal{width:min(900px,calc(100vw - 24px));padding:18px 20px;border:1px solid #9c7cff;border-radius:0 0 16px 16px;background:#202124;color:#f2f2f2;box-shadow:0 18px 55px #0009;animation:pcm-fusam-in .24s ease-out both}.pcm-fusam-modal.closing{animation:pcm-fusam-out .2s ease-in both}.pcm-fusam-prompt{line-height:1.5;overflow-wrap:anywhere}.pcm-fusam-input{width:100%;margin-top:14px;padding:10px;border:1px solid #ffffff35;border-radius:8px;background:#0004;color:inherit;font:inherit}.pcm-fusam-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:15px;flex-wrap:wrap}.pcm-fusam-actions button{min-width:120px;padding:10px 16px;border:0;border-radius:9px;background:#ffffff20;color:inherit;font:inherit;font-weight:700;cursor:pointer}.pcm-fusam-actions button:hover{filter:brightness(1.2)}
@keyframes pcm-fusam-in{from{transform:translateY(-130%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes pcm-fusam-out{from{transform:translateY(0);opacity:1}to{transform:translateY(-130%);opacity:0}}
`;
    document.head.appendChild(style);
  }
  var modalQueue = [];
  var modalActive = false;
  function drainModalQueue() {
    if (modalActive || !modalQueue.length) return;
    modalActive = true;
    const options = modalQueue.shift();
    injectModalStyle();
    const root = document.createElement("div");
    root.id = MODAL_ROOT_ID;
    root.setAttribute("role", "presentation");
    const modal = document.createElement("section");
    modal.className = "pcm-fusam-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const prompt = document.createElement("div");
    prompt.className = "pcm-fusam-prompt";
    if (typeof options.prompt === "string") prompt.textContent = options.prompt;
    else if (options.prompt instanceof Node) prompt.append(options.prompt);
    modal.append(prompt);
    let input = null;
    if (options.input) {
      input = document.createElement(options.input.type === "textarea" ? "textarea" : "input");
      input.className = "pcm-fusam-input";
      if (input instanceof HTMLTextAreaElement) input.rows = 8;
      input.value = String(options.input.initial ?? "");
      input.readOnly = !!options.input.readonly;
      input.addEventListener("keydown", (event) => event.stopPropagation());
      modal.append(input);
    }
    const actions = document.createElement("div");
    actions.className = "pcm-fusam-actions";
    const buttons = options.buttons && typeof options.buttons === "object" ? options.buttons : {};
    const ordered = [
      ["submit", buttons.submit || "OK"],
      ...Object.entries(buttons).filter(([key]) => key !== "submit")
    ];
    const close = (action) => {
      for (const button of actions.querySelectorAll("button")) button.disabled = true;
      modal.classList.add("closing");
      const finish = () => {
        root.remove();
        try {
          options.callback?.(action, input?.value);
        } finally {
          modalActive = false;
          queueMicrotask(drainModalQueue);
        }
      };
      modal.addEventListener("animationend", finish, { once: true });
      setTimeout(() => {
        if (root.isConnected) finish();
      }, 260);
    };
    for (const [action, label] of ordered) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(label);
      button.addEventListener("click", () => close(action));
      actions.append(button);
    }
    modal.append(actions);
    root.append(modal);
    document.body.append(root);
    (input || actions.querySelector("button"))?.focus();
  }
  function openModal(options) {
    if (!options || typeof options !== "object") throw new TypeError("Modal options must be an object");
    modalQueue.push(options);
    drainModalQueue();
  }
  function openModalAsync(options) {
    return new Promise((resolve) => openModal({
      ...options,
      callback: (action, inputValue) => resolve([action, inputValue === void 0 ? null : inputValue])
    }));
  }
  function pcmButtonGroup() {
    return document.getElementById("bc-plugin-btn-group");
  }
  function pcmButton() {
    return pcmButtonGroup()?.querySelector(".bc-plugin-floating-btn") || null;
  }
  async function openPcmManager() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const button = pcmButton();
      if (button) {
        button.click();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  function createTranslationApi() {
    const catalogs = /* @__PURE__ */ new Map();
    const notify = (id) => window.dispatchEvent(new CustomEvent("fusam:addon-translations-changed", { detail: { id } }));
    return Object.freeze({
      register(id, catalog) {
        if (!id || typeof id !== "string") throw new TypeError("Addon translation id must be a non-empty string");
        if (!catalog || typeof catalog !== "object") throw new TypeError("Addon translations must be an object");
        const normalized = {};
        for (const language of LANGUAGES) {
          const entry = catalog[language];
          if (!entry) continue;
          if (typeof entry !== "object") throw new TypeError(`Invalid ${language} translation for ${id}`);
          normalized[language] = {};
          for (const field of ["name", "description"]) {
            if (entry[field] === void 0) continue;
            if (typeof entry[field] !== "string") throw new TypeError(`Invalid ${language} ${field} for ${id}`);
            normalized[language][field] = entry[field];
          }
        }
        catalogs.set(id, normalized);
        notify(id);
      },
      unregister(id) {
        if (catalogs.delete(id)) notify(id);
      },
      get(id) {
        return catalogs.get(id);
      }
    });
  }
  function installFusamCompat() {
    if (existingFusam()) return { installed: false, reason: "existing-fusam", api: window.FUSAM };
    const debugMethods = /* @__PURE__ */ new Map();
    const addons = {};
    const position = {};
    let zIndex = 2147483647;
    let forcedVisibility = null;
    const api = {
      present: true,
      addons,
      registerDebugMethod(name, method) {
        if (!name || typeof method !== "function") throw new TypeError("Debug method requires a name and function");
        debugMethods.set(String(name), method);
      },
      modals: Object.freeze({ open: openModal, openAsync: openModalAsync }),
      ui: { showButton: Object.freeze({
        getElement: pcmButton,
        isVisible: () => !!pcmButton() && getComputedStyle(pcmButtonGroup()).display !== "none",
        show() {
          forcedVisibility = true;
          const el = pcmButtonGroup();
          if (el) el.style.display = "";
        },
        hide() {
          forcedVisibility = false;
          const el = pcmButtonGroup();
          if (el) el.style.display = "none";
        },
        open: openPcmManager,
        setPosition(next) {
          for (const key of ["top", "right", "bottom", "left", "transform"]) if (typeof next?.[key] === "string") position[key] = next[key];
          const el = pcmButtonGroup();
          if (el) Object.assign(el.style, position);
        },
        setZIndex(next) {
          if (!Number.isFinite(next)) throw new TypeError("zIndex must be a finite number");
          zIndex = next;
          const el = pcmButtonGroup();
          if (el) el.style.zIndex = String(zIndex);
        }
      }) },
      translations: { addons: createTranslationApi() }
    };
    Object.defineProperty(api, BRAND, { value: true });
    window.FUSAM = api;
    window.Liko ??= {};
    window.Liko.__PCMFusamCompat__ = Object.freeze({
      api,
      isOwned: () => window.FUSAM === api,
      setAddonState(id, state) {
        if (!id) return;
        if (state == null) delete addons[id];
        else addons[id] = { ...state };
      },
      getDebugMethods: () => new Map(debugMethods),
      applyButtonOptions() {
        const el = pcmButtonGroup();
        if (el) {
          Object.assign(el.style, position);
          el.style.zIndex = String(zIndex);
          if (forcedVisibility !== null) el.style.display = forcedVisibility ? "" : "none";
        }
      }
    });
    return { installed: true, reason: "missing-fusam", api };
  }

  // src/pcm/compat/core.js
  function startPCM() {
    window.Liko = window.Liko ?? {};
    const MOD_VER = PCM_VERSION;
    const current = window.Liko.__PCMStartup__;
    if (current?.status === "starting" || current?.status === "ready") return current.promise;
    if (window.Liko.PCM) return Promise.resolve(window.Liko.PCMApi);
    const startup = { status: "starting", version: MOD_VER, promise: null };
    window.Liko.__PCMStartup__ = startup;
    let rollback = () => {
    };
    startup.promise = Promise.resolve().then(async () => {
      let modApi;
      let isInitialized = false;
      const _lifecycle = new Lifecycle();
      _lifecycle.add(() => {
        if (_lifecycle.mousemoveHandler) document.removeEventListener("mousemove", _lifecycle.mousemoveHandler);
        for (const id of ["bc-plugin-btn-group", "bc-plugin-panel", "bc-plugin-styles", "pcm-notification-stack"]) {
          document.getElementById(id)?.remove();
        }
      });
      rollback = () => {
        _lifecycle.dispose();
        try {
          modApi?.unload?.();
        } catch (error) {
          console.warn("[PCM] SDK cleanup:", error);
        }
      };
      installFusamCompat();
      function escapeHtml(str) {
        return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      }
      const PCM_UI_SETTINGS_KEY = "pcm_ui_settings";
      const DEFAULT_UI_SETTINGS = { language: "AUTO", showLoadNotifications: true, showFusamTab: false, showCustomTab: false };
      function loadUiSettings() {
        try {
          return { ...DEFAULT_UI_SETTINGS, ...JSON.parse(localStorage.getItem(PCM_UI_SETTINGS_KEY) || "{}") || {} };
        } catch (e) {
          return { ...DEFAULT_UI_SETTINGS };
        }
      }
      let pcmUiSettings = loadUiSettings();
      function saveUiSettings() {
        try {
          localStorage.setItem(PCM_UI_SETTINGS_KEY, JSON.stringify(pcmUiSettings));
        } catch (e) {
        }
      }
      const pcmLang = () => pcmUiSettings.language === "AUTO" ? void 0 : pcmUiSettings.language;
      const t = (key, vars) => translatePCM(key, vars, pcmLang());
      const PCM_HIDDEN_MSG = "PCM_BADGE_INIT";
      const PCM_BADGE_CONFIG = { offsetX: 240, offsetY: 25, size: 36, showBackground: false, backgroundColor: "#7F53CD", borderColor: "#FFFFFF", borderWidth: 1 };
      let pcmBadgeImage = null, pcmImageLoaded = false;
      const hoveredCharacters = /* @__PURE__ */ new Set(), characterDrawPositions = /* @__PURE__ */ new Map();
      let cachedViewingCharacter = null, lastCharacterCheck = 0;
      let lastScreenCheck = null, lastScreenCheckTime = 0;
      const CHARACTER_CACHE_TIME = 500;
      function cleanupLegacyOnlineSettings() {
        const doSetup = () => {
          try {
            if (Player?.OnlineSharedSettings?.PCM) delete Player.OnlineSharedSettings.PCM;
            Player.PCM = { version: MOD_VER };
            refreshAccountSettingsFromPlayer();
            const cfg = loadAccountConfig();
            floatingButtonHidden = readFloatingButtonHidden(cfg);
            if (!cfg.floatingButtonHidden) {
              cfg.floatingButtonHidden = { ...floatingButtonHidden };
              saveAccountConfig(cfg);
            }
            applyFloatingBtnVisibility();
          } catch (e) {
          }
        };
        if (typeof Player !== "undefined" && Player?.AccountName) doSetup();
        else {
          const id = _lifecycle.interval(() => {
            if (typeof Player !== "undefined" && Player?.AccountName) {
              _lifecycle.clearInterval(id);
              doSetup();
            }
          }, 500);
        }
      }
      function sendPCMInitialization(requestReply = false, target = null) {
        try {
          if (typeof ServerPlayerIsInChatRoom !== "function" || !ServerPlayerIsInChatRoom()) return;
          const msg = { Type: "Hidden", Content: PCM_HIDDEN_MSG, Sender: Player.MemberNumber, Dictionary: [{ pcm: { version: MOD_VER, replyRequested: requestReply } }] };
          if (target) msg.Target = target;
          ServerSend("ChatRoomChat", msg);
        } catch (e) {
        }
      }
      function parsePCMMessage(data, deferred = false) {
        try {
          if (data.Type !== "Hidden" || data.Content !== PCM_HIDDEN_MSG) return;
          const pcmData = Array.isArray(data.Dictionary) ? data.Dictionary.find((d) => d?.pcm)?.pcm : data.Dictionary?.pcm;
          if (!pcmData) return;
          const sender = Character?.find((c) => c.MemberNumber === data.Sender);
          if (!sender) {
            if (deferred !== true) queueMicrotask(() => parsePCMMessage(data, true));
            return;
          }
          if (sender.ID === 0) return;
          sender.PCM = { version: pcmData.version };
          if (pcmData.replyRequested) sendPCMInitialization(false, data.Sender);
        } catch (e) {
        }
      }
      function bindPCMSocketListener() {
        try {
          if (typeof ServerSocket === "undefined" || !ServerSocket) return;
          ServerSocket.off("ChatRoomMessage", parsePCMMessage);
          ServerSocket.on("ChatRoomMessage", parsePCMMessage);
        } catch (e) {
        }
      }
      function initializePCMBadgeImage() {
        if (!pcmBadgeImage) {
          const _badgePages = "https://awdrrawd.github.io/liko-Plugin-Repository/Images/PCM_Badge.png";
          const _badgeCdn = "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_Badge.png";
          const _badgeRaw = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/refs/heads/main/Images/PCM_Badge.png";
          const _badgeUrls = [_badgeCdn, _badgePages, _badgeRaw];
          let _badgeIndex = 0;
          pcmBadgeImage = new Image();
          pcmBadgeImage.crossOrigin = "anonymous";
          pcmBadgeImage.onload = () => {
            pcmImageLoaded = true;
          };
          pcmBadgeImage.onerror = () => {
            _badgeIndex++;
            if (_badgeIndex < _badgeUrls.length) pcmBadgeImage.src = _badgeUrls[_badgeIndex];
            else pcmImageLoaded = false;
          };
          pcmBadgeImage.src = _badgeUrls[_badgeIndex];
        }
      }
      function setupHoverTracking() {
        let rafPending = false;
        const onMouseMove = () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            hoveredCharacters.clear();
            try {
              if (CurrentScreen !== "ChatRoom" || typeof CurrentCharacter !== "undefined" && CurrentCharacter !== null) return;
              if (typeof ChatRoomHideIconState !== "undefined" && ChatRoomHideIconState !== 0) return;
              if (typeof MouseHovering !== "function") return;
              for (const [mn, pos] of characterDrawPositions) {
                if (MouseHovering(pos.x, pos.y, 400 * pos.zoom, 100 * pos.zoom)) hoveredCharacters.add(mn);
              }
            } catch (e) {
            }
          });
        };
        _lifecycle.mousemoveHandler = onMouseMove;
        document.addEventListener("mousemove", onMouseMove);
      }
      function drawPCMBadge(character, x, y, zoom) {
        try {
          if (!hoveredCharacters.has(character.MemberNumber) || !character.PCM) return;
          if (!pcmBadgeImage) {
            initializePCMBadgeImage();
            return;
          }
          const bx = x + PCM_BADGE_CONFIG.offsetX * zoom, by = y + PCM_BADGE_CONFIG.offsetY * zoom, bs = PCM_BADGE_CONFIG.size * zoom;
          if (PCM_BADGE_CONFIG.showBackground) {
            MainCanvas.fillStyle = PCM_BADGE_CONFIG.backgroundColor;
            MainCanvas.beginPath();
            MainCanvas.arc(bx, by, bs / 2, 0, 2 * Math.PI);
            MainCanvas.fill();
            if (PCM_BADGE_CONFIG.borderWidth > 0) {
              MainCanvas.strokeStyle = PCM_BADGE_CONFIG.borderColor;
              MainCanvas.lineWidth = PCM_BADGE_CONFIG.borderWidth * zoom;
              MainCanvas.stroke();
            }
          }
          if (pcmImageLoaded && pcmBadgeImage.complete) {
            MainCanvas.drawImage(pcmBadgeImage, bx - bs / 2, by - bs / 2, bs, bs);
          } else {
            MainCanvas.save();
            MainCanvas.fillStyle = "#FFFFFF";
            MainCanvas.font = `bold ${Math.max(10, bs / 3)}px Arial`;
            MainCanvas.textAlign = "center";
            MainCanvas.textBaseline = "middle";
            MainCanvas.fillText("PCM", bx, by);
            MainCanvas.restore();
          }
        } catch (e) {
        }
      }
      function syncDrawPositionsWithRoom() {
        if (!Array.isArray(ChatRoomCharacter)) return;
        const ids = new Set(ChatRoomCharacter.map((c) => c?.MemberNumber).filter((id) => id !== void 0));
        for (const id of characterDrawPositions.keys()) {
          if (!ids.has(id)) {
            characterDrawPositions.delete(id);
            hoveredCharacters.delete(id);
          }
        }
      }
      function hookCharacterDrawing() {
        if (!modApi || typeof modApi.hookFunction !== "function") return;
        const sh = (fn, pri, cb) => {
          try {
            modApi.hookFunction(fn, pri, cb);
          } catch (e) {
          }
        };
        sh("DrawCharacter", 5, (args, next) => {
          const [c, x, y, zoom] = args, result = next(args);
          if (c?.PCM && c.MemberNumber !== void 0) {
            characterDrawPositions.set(c.MemberNumber, { x, y, zoom });
            drawPCMBadge(c, x, y, zoom);
          }
          return result;
        });
        sh("ChatRoomClearAllElements", 5, (args, next) => {
          characterDrawPositions.clear();
          hoveredCharacters.clear();
          return next(args);
        });
        sh("ChatRoomSync", 5, (args, next) => {
          const r = next(args);
          syncDrawPositionsWithRoom();
          sendPCMInitialization(true);
          return r;
        });
        sh("ChatRoomSyncMemberJoin", 5, (args, next) => {
          const r = next(args);
          try {
            const d = args[0];
            if (d && d.SourceMemberNumber != null && d.SourceMemberNumber !== Player.MemberNumber) sendPCMInitialization(true, d.SourceMemberNumber);
          } catch (e) {
          }
          return r;
        });
        sh("ServerInit", 1, (args, next) => {
          const r = next(args);
          bindPCMSocketListener();
          return r;
        });
        sh("CommonSetScreen", 1, (args, next) => {
          const r = next(args);
          try {
            lastScreenCheck = null;
            lastScreenCheckTime = 0;
            cachedViewingCharacter = null;
            lastCharacterCheck = 0;
            currentUIState = null;
            checkLanguageChange();
            createManagerUI();
            if (!localLoadStarted) loadLocalPluginsPhase();
            if (!accountLoadStarted) loadAccountPluginsPhase();
          } catch (e) {
          }
          return r;
        });
        let _lastBcxState = false;
        sh("GameRun", 1, (args, next) => {
          const r = next(args);
          try {
            const cur = (window.bcx?.inBcxSubscreen?.() ?? false) || (window.LITTLISH_CLUB?.inModSubscreen?.() ?? false);
            if (currentUIState !== shouldShowUI() || cur !== _lastBcxState) {
              _lastBcxState = cur;
              lastScreenCheck = null;
              lastScreenCheckTime = 0;
              currentUIState = null;
              createManagerUI();
            }
          } catch (e) {
          }
          return r;
        });
      }
      function registerPCMBadge() {
        const wait = () => {
          if (_lifecycle.disposed) return;
          if (!modApi?.hookFunction || typeof ServerSocket === "undefined" || !ServerSocket) {
            _lifecycle.timeout(wait, 500);
            return;
          }
          initializePCMBadgeImage();
          setupHoverTracking();
          cleanupLegacyOnlineSettings();
          hookCharacterDrawing();
          bindPCMSocketListener();
          _lifecycle.add(() => {
            if (typeof ServerSocket !== "undefined") ServerSocket?.off("ChatRoomMessage", parsePCMMessage);
          });
          sendPCMInitialization(true);
          if (typeof modApi.onUnload === "function") modApi.onUnload(() => {
            _lifecycle.dispose();
            try {
              ServerSocket.off("ChatRoomMessage", parsePCMMessage);
            } catch (e) {
            }
            if (_lifecycle.mousemoveHandler) {
              document.removeEventListener("mousemove", _lifecycle.mousemoveHandler);
              _lifecycle.mousemoveHandler = null;
            }
            hoveredCharacters.clear();
            characterDrawPositions.clear();
          });
        };
        wait();
      }
      const PLUGINS_JSON_URLS = getPluginListUrls();
      async function fetchTextWithTimeout(url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) {
        const { response: res, text } = await fetchText(url, options, timeoutMs);
        return { res, text };
      }
      let saveTimer;
      function saveSettings(s) {
        _lifecycle.clearTimeout(saveTimer);
        saveTimer = _lifecycle.timeout(() => localStorage.setItem("BC_PluginManager_Settings", JSON.stringify(s)), 100);
      }
      function loadSettings() {
        try {
          const parsed = JSON.parse(localStorage.getItem("BC_PluginManager_Settings") || "{}");
          return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (e) {
          console.warn("🐈‍⬛ [PCM] ⚠️ 本機設定已損壞，改用預設設定：", e?.message || e);
          return {};
        }
      }
      let pluginSettings = loadSettings();
      let accountPluginSettings = {};
      let accountSettingsLoaded = false;
      let accountSettingsLoadPromise = null;
      function loadAccountSettings() {
        try {
          const raw = Player?.ExtensionSettings?.PCMAccount;
          if (!raw) return {};
          return typeof raw === "object" ? raw : JSON.parse(raw) || {};
        } catch (e) {
          return {};
        }
      }
      function refreshAccountSettingsFromPlayer() {
        if (typeof Player === "undefined" || !Player?.AccountName) return false;
        accountPluginSettings = loadAccountSettings();
        accountSettingsLoaded = true;
        return true;
      }
      async function ensureAccountSettingsLoaded() {
        if (accountSettingsLoaded) return true;
        if (accountSettingsLoadPromise) return accountSettingsLoadPromise;
        accountSettingsLoadPromise = (async () => {
          let waited = 0;
          while ((typeof Player === "undefined" || !Player?.AccountName) && waited < 15 * 6e4) {
            if (_lifecycle.disposed) return false;
            await _lifecycle.sleep(1e3);
            waited += 1e3;
          }
          if (_lifecycle.disposed) return false;
          return refreshAccountSettingsFromPlayer();
        })();
        try {
          return await accountSettingsLoadPromise;
        } finally {
          accountSettingsLoadPromise = null;
        }
      }
      function saveAccountSettings() {
        try {
          if (!Player?.ExtensionSettings) return;
          const c = {};
          for (const [id, v] of Object.entries(accountPluginSettings)) {
            if (v === 1 || v === true) c[id] = 1;
            else if (v === "stable" || v === "beta") c[id] = v;
          }
          Player.ExtensionSettings.PCMAccount = JSON.stringify(c);
          ServerPlayerExtensionSettingsSync("PCMAccount");
        } catch (e) {
        }
      }
      let floatingButtonHidden = { mainHall: false, preference: false, informationSheet: false };
      function readFloatingButtonHidden(cfg) {
        const oldHidden = cfg.showFloatingBtn === false;
        const flags = cfg.floatingButtonHidden || {};
        return { mainHall: flags.mainHall === true, preference: flags.preference ?? oldHidden, informationSheet: flags.informationSheet ?? oldHidden };
      }
      function loadAccountConfig() {
        try {
          const raw = Player?.ExtensionSettings?.PCMConfig;
          if (!raw) return {};
          return typeof raw === "object" ? raw : JSON.parse(raw) || {};
        } catch (e) {
          return {};
        }
      }
      function saveAccountConfig(cfg) {
        try {
          if (!Player?.ExtensionSettings) return;
          Player.ExtensionSettings.PCMConfig = JSON.stringify(cfg);
          ServerPlayerExtensionSettingsSync("PCMConfig");
        } catch (e) {
        }
      }
      const PLUGIN_CACHE_KEY = "pcm_plugin_cache";
      const PLUGIN_CACHE_PREFIX = "pcm_p_";
      function isJsDelivrUrl(url) {
        return typeof url === "string" && url.includes("cdn.jsdelivr.net");
      }
      function isOwnPagesUrl(url) {
        return typeof url === "string" && url.includes("awdrrawd.github.io/liko-Plugin-Repository");
      }
      const OWN_REPO_RAW_PREFIX = "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/";
      const OWN_REPO_PAGES_PREFIX = "https://awdrrawd.github.io/liko-Plugin-Repository/";
      let _pluginCacheStore = null;
      function loadPluginCacheStore() {
        if (_pluginCacheStore) return _pluginCacheStore;
        try {
          _pluginCacheStore = JSON.parse(localStorage.getItem(PLUGIN_CACHE_KEY) || "{}") || {};
        } catch (e) {
          _pluginCacheStore = {};
        }
        migrateOldPluginCache(_pluginCacheStore);
        return _pluginCacheStore;
      }
      function savePluginCacheStore() {
        try {
          let serialized = JSON.stringify(_pluginCacheStore);
          if (serialized.length > 35e5) {
            const removable = Object.entries(_pluginCacheStore).filter(([, value]) => value && typeof value === "object").sort((a, b) => (a[1].lastSuccessAt || a[1].cachedAt || 0) - (b[1].lastSuccessAt || b[1].cachedAt || 0));
            while (serialized.length > 35e5 && removable.length) {
              delete _pluginCacheStore[removable.shift()[0]];
              serialized = JSON.stringify(_pluginCacheStore);
            }
          }
          localStorage.setItem(PLUGIN_CACHE_KEY, serialized);
        } catch (e) {
          console.warn("🐈‍⬛ [PCM] ⚠️ 插件快取寫入失敗：", e?.message || e);
        }
      }
      function migrateOldPluginCache(store) {
        try {
          const oldKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(PLUGIN_CACHE_PREFIX)) oldKeys.push(k);
          }
          if (!oldKeys.length) return;
          for (const k of oldKeys) {
            try {
              const id = k.slice(PLUGIN_CACHE_PREFIX.length);
              const raw = JSON.parse(localStorage.getItem(k) || "null");
              const code = typeof raw === "string" ? raw : raw?.code;
              if (code && !store[id]) store[id] = code;
            } catch (e) {
            }
            localStorage.removeItem(k);
          }
          localStorage.setItem(PLUGIN_CACHE_KEY, JSON.stringify(store));
        } catch (e) {
        }
      }
      function getCachedPluginCode(cacheKey, legacyId) {
        const store = loadPluginCacheStore();
        const entry = store[cacheKey] ?? store[legacyId];
        return typeof entry === "string" ? entry : entry?.code || null;
      }
      function hashPluginCode(code) {
        let hash = 2166136261;
        for (let i = 0; i < code.length; i++) hash = Math.imul(hash ^ code.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(36);
      }
      function setCachedPluginCode(cacheKey, legacyId, code, url, distribution) {
        const store = loadPluginCacheStore();
        store[cacheKey] = { code, url, distribution, hash: hashPluginCode(code), cachedAt: Date.now(), lastSuccessAt: Date.now() };
        if (legacyId !== cacheKey && Object.prototype.hasOwnProperty.call(store, legacyId)) delete store[legacyId];
        savePluginCacheStore();
      }
      const JSON_CACHE_KEY = "pcm_json_cache";
      const JSON_CACHE_TTL = 24 * 60 * 60 * 1e3;
      function getCachedJSON() {
        try {
          const c = JSON.parse(localStorage.getItem(JSON_CACHE_KEY) || "null");
          if (!c || Date.now() - c.time > JSON_CACHE_TTL) {
            if (c) localStorage.removeItem(JSON_CACHE_KEY);
            return null;
          }
          return c.data;
        } catch (e) {
          return null;
        }
      }
      function setCachedJSON(data) {
        try {
          localStorage.setItem(JSON_CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
        } catch (e) {
        }
      }
      let subPlugins = [];
      let pluginsLoaded = false;
      let remoteVersion = MOD_VER, remoteUpdateId = null;
      let remoteChangelogTW = [], remoteChangelogEN = [];
      let _resolvePluginsReady;
      const pluginsReady = new Promise((r) => {
        _resolvePluginsReady = r;
      });
      function normalizePluginData(data) {
        return normalizeManifest(data, (reason) => console.warn("[PCM] Invalid plugin:", reason));
      }
      function applyPluginSettings(plugins) {
        return plugins.map((plugin) => {
          const saved = pluginSettings[plugin.id];
          if (isTriStatePlugin(plugin)) plugin.state = saved !== void 0 ? saved : "off";
          else plugin.enabled = saved !== void 0 ? saved : false;
          if (pluginSettings[`${plugin.id}_customIcon`]) plugin.customIcon = pluginSettings[`${plugin.id}_customIcon`];
          return plugin;
        });
      }
      function processPluginData(data) {
        remoteVersion = data.version || MOD_VER;
        remoteUpdateId = data.updateId || null;
        remoteChangelogTW = data.changelog || [];
        remoteChangelogEN = data.en_changelog || data.changelog || [];
        subPlugins = applyPluginSettings(data.plugins);
        subPlugins.sort((a, b) => (a.priority || 5) - (b.priority || 5));
        pluginsLoaded = true;
        console.log(`🐈‍⬛ [PCM] 📦 ${subPlugins.length} plugins loaded`);
      }
      async function fetchJSONFromNetwork() {
        for (const url of PLUGINS_JSON_URLS) {
          try {
            const { res, text } = await fetchTextWithTimeout(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              continue;
            }
            data = normalizePluginData(data);
            if (!data) continue;
            setCachedJSON(data);
            console.log(`🐈‍⬛ [PCM] ✅ Plugins.json fetched (${url})`);
            return data;
          } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`);
          }
        }
        return null;
      }
      async function initPlugins() {
        const data = await fetchJSONFromNetwork();
        if (_lifecycle.disposed) return;
        if (data) {
          processPluginData(data);
          _resolvePluginsReady(true);
          refreshPluginListUI();
          if (checkVersionUpdate()) {
            _lifecycle.timeout(() => {
              showChangelogModal();
              showNotification("✨", t("newVersionTitle"), `v${remoteVersion} — ${t("newVersionHint")}`);
            }, 2e3);
          }
          return;
        }
        const cached = getCachedJSON();
        const normalizedCache = normalizePluginData(cached);
        if (normalizedCache) {
          processPluginData(normalizedCache);
          _resolvePluginsReady(true);
          refreshPluginListUI();
        } else {
          showNotification("❌", "PCM", t("loadPluginsFailed"));
          _resolvePluginsReady(false);
        }
      }
      let isRefreshing = false;
      async function refreshPluginList() {
        if (isRefreshing) return;
        isRefreshing = true;
        const btn = document.getElementById("bc-plugin-refresh-btn");
        btn?.classList.add("spinning");
        showNotification("↻", t("refreshTitle"), t("refreshing"));
        try {
          localStorage.removeItem("pcm_main_cache");
          localStorage.removeItem(JSON_CACHE_KEY);
          localStorage.removeItem(PLUGIN_CACHE_KEY);
          _pluginCacheStore = {};
        } catch (e) {
        }
        const data = await fetchJSONFromNetwork();
        if (data) {
          processPluginData(data);
          refreshPluginListUI();
          showNotification("✅", t("refreshTitle"), t("refreshDone"));
        } else showNotification("⚠️", t("refreshTitle"), t("refreshFailed"));
        btn?.classList.remove("spinning");
        isRefreshing = false;
      }
      function refreshPluginListUI() {
        const lc = document.getElementById("bc-plugin-content-local");
        if (lc) {
          lc.innerHTML = "";
          subPlugins.forEach((p) => lc.appendChild(buildPluginItem(p, "local")));
        }
        const ac = document.getElementById("bc-plugin-content-account");
        if (ac) buildAccountContent(ac);
        applyFilter();
      }
      const CUSTOM_PLUGINS_KEY = "pcm_custom_plugins";
      let customPlugins = [];
      function loadCustomPlugins() {
        try {
          return JSON.parse(localStorage.getItem(CUSTOM_PLUGINS_KEY) || "[]");
        } catch (e) {
          return [];
        }
      }
      function saveCustomPlugins() {
        try {
          localStorage.setItem(CUSTOM_PLUGINS_KEY, JSON.stringify(customPlugins));
        } catch (e) {
        }
      }
      function checkVersionUpdate() {
        const saved = pluginSettings["_pcm_updateId"];
        if (remoteUpdateId && saved !== remoteUpdateId) {
          pluginSettings["_pcm_updateId"] = remoteUpdateId;
          saveSettings(pluginSettings);
          return saved !== void 0;
        }
        return false;
      }
      function isTriStatePlugin(p) {
        return !!p.altUrl;
      }
      function isPluginEnabled(p) {
        return isTriStatePlugin(p) ? p.state !== "off" : p.enabled;
      }
      function isPluginEnabledInAccount(p) {
        const v = accountPluginSettings[p.id];
        return v !== void 0 && v !== 0 && v !== "off";
      }
      function getPluginState(p, source) {
        return (source === "account" ? accountPluginSettings[p.id] : p.state) || "off";
      }
      function isPluginEnabledForSource(p, source) {
        return source === "account" ? isPluginEnabledInAccount(p) : isPluginEnabled(p);
      }
      function getPluginLoadSource(p) {
        return isPluginEnabled(p) ? "local" : "account";
      }
      function getActivePluginUrl(p, source = "local") {
        if (p.altUrl && getPluginState(p, source) === "beta") return p.altUrl;
        return p.url;
      }
      function getTriLabels(p) {
        return p.triLabels?.length === 3 ? p.triLabels : ["OFF", "ON", "BETA"];
      }
      function cycleTriState(s) {
        return s === "off" ? "stable" : s === "stable" ? "beta" : "off";
      }
      function getLang() {
        return pcmLang() || window.Liko.__Sys_i18n__?.detectLang() || "EN";
      }
      function isCJK() {
        const l = getLang();
        return l === "TW" || l === "CN";
      }
      function getPluginName(p) {
        return isCJK() ? p.name : p.en_name || p.name;
      }
      function getPluginDescription(p) {
        return isCJK() ? p.description : p.en_description || p.description;
      }
      function getPluginAdditionalInfo(p) {
        return isCJK() ? p.additionalInfo : p.en_additionalInfo || p.additionalInfo;
      }
      let loadedPlugins = /* @__PURE__ */ new Set(), failedPlugins = /* @__PURE__ */ new Set();
      const pluginLoadPromises = /* @__PURE__ */ new Map();
      const pluginRuntime = /* @__PURE__ */ new Map();
      const pcmLogs = [];
      const PCM_LOG_LIMIT = 300;
      let isLoadingPlugins = false, localLoadStarted = false, accountLoadStarted = false, customLoadStarted = false;
      let localPhasePromise = null;
      const LAST_PLUGIN_ERROR_KEY = "pcm_last_plugin_error";
      let previousPluginError = null;
      try {
        previousPluginError = JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || "null");
      } catch (e) {
      }
      try {
        localStorage.removeItem(LAST_PLUGIN_ERROR_KEY);
      } catch (e) {
      }
      function hasExternalFusam() {
        return !!window.FUSAM?.present && !window.Liko?.__PCMFusamCompat__?.isOwned?.();
      }
      function fusamDistributions(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) return {};
        return value.enabledDistributions && typeof value.enabledDistributions === "object" ? value.enabledDistributions : value;
      }
      function externalFusamEnabledIds() {
        const ids = /* @__PURE__ */ new Set();
        if (!hasExternalFusam()) return ids;
        try {
          const browser = fusamDistributions(JSON.parse(localStorage.getItem("fusam.settings") || "{}"));
          for (const [id, distribution] of Object.entries(browser)) if (distribution) ids.add(id);
        } catch (e) {
          console.warn("🐈‍⬛ [PCM] ⚠️ 無法讀取 FUSAM 瀏覽器設定:", e?.message || e);
        }
        try {
          const packed = Player?.ExtensionSettings?.FUSAMSettings || Player?.OnlineSettings?.FUSAMSettings;
          if (packed && typeof globalThis.LZString?.decompressFromBase64 === "function") {
            const account = fusamDistributions(JSON.parse(globalThis.LZString.decompressFromBase64(packed) || "{}"));
            for (const [id, distribution] of Object.entries(account)) if (distribution) ids.add(id);
          }
        } catch (e) {
          console.warn("🐈‍⬛ [PCM] ⚠️ 無法讀取 FUSAM 帳號設定:", e?.message || e);
        }
        return ids;
      }
      function isOwnedByExternalFusam(plugin) {
        const id = String(plugin?.fusamId || plugin?.id || "").replace(/^fusam:/, "");
        return !!id && externalFusamEnabledIds().has(id);
      }
      function pcmLog(level, message, data = null) {
        const entry = { time: Date.now(), level, message, ...data ? { data } : {} };
        pcmLogs.push(entry);
        if (pcmLogs.length > PCM_LOG_LIMIT) pcmLogs.splice(0, pcmLogs.length - PCM_LOG_LIMIT);
        return entry;
      }
      function rememberPluginError(id, err, phase = "runtime") {
        if (!id) return;
        const plugin = subPlugins.find((p) => p.id === id) || customPlugins.find((p) => p.id === id);
        const record = {
          pluginId: id,
          pluginName: plugin ? getPluginName(plugin) : id,
          phase,
          message: String(err?.message || err || "Unknown error").slice(0, 500),
          time: Date.now()
        };
        try {
          localStorage.setItem(LAST_PLUGIN_ERROR_KEY, JSON.stringify(record));
        } catch (e) {
        }
      }
      function setPluginRuntime(id, patch) {
        const previous = pluginRuntime.get(id) || { status: "idle" };
        const next = { ...previous, ...patch };
        if (patch.status === "loading" && !next.startedAt) next.startedAt = Date.now();
        if ((patch.status === "loaded" || patch.status === "cached" || patch.status === "failed" || patch.status === "delegated") && !next.settledAt) {
          next.settledAt = Date.now();
          if (next.startedAt) next.durationMs = next.settledAt - next.startedAt;
        }
        pluginRuntime.set(id, next);
        const fusamCompat = window.Liko?.__PCMFusamCompat__;
        if (fusamCompat?.isOwned?.()) {
          const status = next.status === "loading" ? "loading" : next.status === "loaded" || next.status === "cached" ? "loaded" : next.status === "failed" ? "error" : "missing";
          fusamCompat.setAddonState(id, {
            distribution: next.source === "fusam" ? next.distribution || "stable" : next.source === "account" ? "account" : next.source === "custom" ? "custom" : "stable",
            status
          });
        }
        if (patch.status && patch.status !== previous.status) pcmLog(
          patch.status === "failed" ? "ERROR" : "INFO",
          `Plugin ${id}: ${previous.status} -> ${patch.status}`,
          { source: next.source, loadType: next.loadType, durationMs: next.durationMs, error: next.error }
        );
        document.querySelectorAll(".bc-plugin-item[data-plugin-id]").forEach((item) => {
          if (item.getAttribute("data-plugin-id") !== id) return;
          item.classList.toggle("failed", next.status === "failed");
          item.classList.toggle("runtime-warning", !!next.postLoadError);
          const label = item.querySelector(".bc-plugin-runtime-status");
          if (label) {
            const labels = isCJK() ? { loading: "載入中…", loaded: "已載入", cached: "已從快取救援", failed: "載入失敗", delegated: "由 FUSAM 載入" } : { loading: "Loading…", loaded: "Loaded", cached: "Recovered from cache", failed: "Load failed", delegated: "Handled by FUSAM" };
            label.textContent = next.reloadRequired ? isCJK() ? "已停用，重新整理後生效" : "Disabled · reload required" : labels[next.status] || "";
            label.setAttribute("data-status", next.reloadRequired ? "reload" : next.status);
          }
        });
      }
      function installPCMReadOnlyApi() {
        window.Liko.PCMApi = Object.freeze({
          apiVersion: 1,
          version: MOD_VER,
          ...window.Liko?.__PCMFusamCompat__?.isOwned?.() ? { modals: window.Liko.__PCMFusamCompat__.api.modals } : {},
          list: () => subPlugins.map((plugin) => ({
            id: plugin.id,
            name: getPluginName(plugin),
            enabled: isPluginEnabled(plugin),
            runtime: { ...pluginRuntime.get(plugin.id) || { status: "idle" } }
          })),
          getRuntimeState: (id) => ({ ...pluginRuntime.get(String(id)) || { status: "idle" } }),
          getLastPluginError: () => {
            try {
              return JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || "null");
            } catch (e) {
              return null;
            }
          },
          getLogs: () => pcmLogs.map((entry) => ({ ...entry, ...entry.data ? { data: { ...entry.data } } : {} })),
          exportDiagnostic: () => JSON.stringify({
            pcmVersion: MOD_VER,
            generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
            language: getLang(),
            plugins: [...pluginRuntime].map(([id, state]) => ({ id, ...state })),
            lastPluginError: (() => {
              try {
                return JSON.parse(localStorage.getItem(LAST_PLUGIN_ERROR_KEY) || "null");
              } catch (e) {
                return null;
              }
            })(),
            logs: pcmLogs,
            fusamCompat: window.Liko?.__PCMFusamCompat__?.isOwned?.() ? {
              installed: true,
              registeredDebugMethods: [...window.Liko.__PCMFusamCompat__.getDebugMethods().keys()]
            } : { installed: false, reason: window.FUSAM?.present ? "external-fusam" : "unavailable" }
          }, null, 2)
        });
      }
      const _pluginSourceRegistry = /* @__PURE__ */ new Map();
      function registerPluginSource(id, ...keys) {
        keys.filter(Boolean).forEach((k) => _pluginSourceRegistry.set(k, id));
      }
      function _findPluginIdBySource(str) {
        if (!str) return null;
        for (const [key, id] of _pluginSourceRegistry) {
          if (str.includes(key)) return id;
        }
        return null;
      }
      function _handlePluginRuntimeError(id, err) {
        const plugin = subPlugins.find((p) => p.id === id) || customPlugins.find((p) => p.id === id);
        console.error(`🐈‍⬛ [PCM] ⚠️ 插件執行期錯誤 [${plugin ? getPluginName(plugin) : id}]:`, err?.message || err);
        rememberPluginError(id, err, "runtime");
        setPluginRuntime(id, { postLoadError: String(err?.message || err || "Unknown error").slice(0, 500) });
      }
      const _onPluginWindowError = (ev) => {
        try {
          const id = _findPluginIdBySource(ev.filename || ev.error?.stack || "");
          if (id) _handlePluginRuntimeError(id, ev.error || ev.message);
        } catch (e) {
        }
      };
      const _onPluginUnhandledRejection = (ev) => {
        try {
          const id = _findPluginIdBySource(ev.reason?.stack || String(ev.reason || ""));
          if (id) _handlePluginRuntimeError(id, ev.reason);
        } catch (e) {
        }
      };
      window.addEventListener("error", _onPluginWindowError);
      window.addEventListener("unhandledrejection", _onPluginUnhandledRejection);
      _lifecycle.add(() => {
        window.removeEventListener("error", _onPluginWindowError);
        window.removeEventListener("unhandledrejection", _onPluginUnhandledRejection);
      });
      function injectScript(id, code) {
        if (code.trimStart().startsWith("<")) throw new Error("Received HTML instead of JS");
        let caught = null;
        const onWindowError = (ev) => {
          if (caught === null) caught = ev.error || new Error(ev.message || "plugin execution error");
        };
        window.addEventListener("error", onWindowError);
        try {
          const s = document.createElement("script");
          s.setAttribute("data-plugin", id);
          s.textContent = `${code}
//# sourceURL=pcm-plugin-${id}.js`;
          document.body.appendChild(s);
        } finally {
          window.removeEventListener("error", onWindowError);
        }
        if (caught) {
          console.error(`🐈‍⬛ [PCM] plugin error (${id}):`, caught.message);
          throw caught;
        }
        registerPluginSource(id, `pcm-plugin-${id}.js`);
      }
      async function tryFetch(urls) {
        for (const url of urls) {
          try {
            const { res, text } = await fetchTextWithTimeout(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            if (!text || text.trimStart().startsWith("<")) throw new Error("Invalid content");
            return text;
          } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`);
          }
        }
        return null;
      }
      function uniqueUrls(urls) {
        return [...new Set(urls.filter(Boolean))];
      }
      function buildFetchUrls(url) {
        if (!url) return [];
        if (url.startsWith(OWN_REPO_RAW_PREFIX)) {
          const rel = url.slice(OWN_REPO_RAW_PREFIX.length);
          const pages = `${OWN_REPO_PAGES_PREFIX}${rel}${rel.includes("?") ? "&" : "?"}timestamp=${Date.now()}`;
          const cdn2 = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${rel}`;
          return [pages, cdn2, url];
        }
        if (url.startsWith(OWN_REPO_PAGES_PREFIX)) {
          const relWithQuery = url.slice(OWN_REPO_PAGES_PREFIX.length);
          const [rel] = relWithQuery.split("?");
          const pages = `${OWN_REPO_PAGES_PREFIX}${rel}${rel.includes("?") ? "&" : "?"}timestamp=${Date.now()}`;
          const cdn2 = `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${rel}`;
          const raw = `${OWN_REPO_RAW_PREFIX}${rel}`;
          return [pages, cdn2, raw];
        }
        const cdn = url.replace(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/, "https://cdn.jsdelivr.net/gh/$1/$2@$3/$4");
        return cdn !== url ? [cdn, url] : [url];
      }
      function buildAllFetchUrls(primaryUrl, mirrorUrl) {
        const urls = buildFetchUrls(primaryUrl);
        if (mirrorUrl) urls.push(...buildFetchUrls(mirrorUrl));
        return uniqueUrls(urls);
      }
      function getLoadType(plugin) {
        const ty = plugin?.type;
        return ty === "mod" || ty === "scr" ? ty : "eval";
      }
      async function tryImportModule(urls, id) {
        for (const url of urls) {
          try {
            await downloads.run(() => import(url));
            registerPluginSource(id, url);
            return true;
          } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ ${url} (direct import): ${e.message}`);
            let blobUrl;
            try {
              const { res, text } = await fetchTextWithTimeout(url, { cache: "no-store" });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              let code = text;
              if (!code || code.trimStart().startsWith("<")) throw new Error("Invalid content");
              const sourceTag = `liko-plugin://${id}`;
              code += `
//# sourceURL=${sourceTag}`;
              blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
              await import(blobUrl);
              registerPluginSource(id, url, sourceTag);
              return true;
            } catch (e2) {
              console.warn(`🐈‍⬛ [PCM] ⚠️ ${url} (blob import): ${e2.message}`);
            } finally {
              if (blobUrl) URL.revokeObjectURL(blobUrl);
            }
          }
        }
        return false;
      }
      function loadViaScriptTag(url, id) {
        return downloads.run(() => new Promise((resolve, reject) => {
          const s = document.createElement("script");
          let settled = false;
          const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            s.onload = s.onerror = null;
            fn(value);
          };
          s.src = url;
          s.setAttribute("data-plugin", id);
          s.onload = () => {
            registerPluginSource(id, url);
            finish(resolve);
          };
          s.onerror = () => finish(reject, new Error("script load error"));
          s.fetchPriority = "low";
          document.body.appendChild(s);
        }));
      }
      async function tryLoadScriptTag(urls, id) {
        for (const url of urls) {
          try {
            await loadViaScriptTag(url, id);
            return true;
          } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ ${url}: ${e.message}`);
          }
        }
        return false;
      }
      function loadSubPlugin(plugin, source = "local") {
        if (loadedPlugins.has(plugin.id)) return Promise.resolve();
        const existing = pluginLoadPromises.get(plugin.id);
        if (existing) return existing;
        const trackedPromise = loadSubPluginOnce(plugin, source).finally(() => {
          if (pluginLoadPromises.get(plugin.id) === trackedPromise) pluginLoadPromises.delete(plugin.id);
        });
        pluginLoadPromises.set(plugin.id, trackedPromise);
        return trackedPromise;
      }
      async function loadSubPluginOnce(plugin, source = "local") {
        const isCustom = source === "custom";
        if (loadedPlugins.has(plugin.id)) return;
        if (!isCustom) {
          if (source === "account" && !accountSettingsLoaded && !await ensureAccountSettingsLoaded()) return;
          if (!isPluginEnabledForSource(plugin, source)) return;
        }
        if (source === "fusam" && isOwnedByExternalFusam(plugin)) {
          console.info(`🐈‍⬛ [PCM] ↪ ${getPluginName(plugin)} 已由 FUSAM 啟用，PCM 略過載入`);
          setPluginRuntime(plugin.id, { status: "delegated", source: "fusam-external", error: null });
          return;
        }
        if (!plugin.url && plugin.inlineCode) {
          setPluginRuntime(plugin.id, { status: "loading", source, loadType: "eval", error: null, startedAt: Date.now(), settledAt: null });
          try {
            injectScript(plugin.id, plugin.inlineCode);
            loadedPlugins.add(plugin.id);
            setPluginRuntime(plugin.id, { status: "loaded" });
          } catch (e) {
            failedPlugins.add(plugin.id);
            setPluginRuntime(plugin.id, { status: "failed", error: String(e?.message || e) });
            rememberPluginError(plugin.id, e, "load");
            throw e;
          }
          return;
        }
        if (!plugin.url) return;
        setPluginRuntime(plugin.id, { status: "loading", source, distribution: source === "fusam" ? plugin.distribution : void 0, error: null, postLoadError: null, startedAt: Date.now(), settledAt: null, durationMs: null });
        const rawUrl = isCustom ? plugin.url : getActivePluginUrl(plugin, source);
        const loadType = getLoadType(plugin);
        const isAltUrl = !isCustom && plugin.altUrl && rawUrl === plugin.altUrl;
        const distribution = isAltUrl ? "beta" : isCustom ? "custom" : "stable";
        const cacheKey = `${plugin.id}|${distribution}|${rawUrl}`;
        const cachedCode = getCachedPluginCode(cacheKey, plugin.id);
        const mirrorUrl = isAltUrl ? plugin.altMirrorUrl || plugin.mirrorUrl : plugin.mirrorUrl;
        if (loadType === "mod" || loadType === "scr") {
          const urls2 = buildAllFetchUrls(rawUrl, mirrorUrl);
          const ok = loadType === "mod" ? await tryImportModule(urls2, plugin.id) : await tryLoadScriptTag(urls2, plugin.id);
          if (!ok) {
            failedPlugins.add(plugin.id);
            setPluginRuntime(plugin.id, { status: "failed", error: `All ${loadType} URLs failed` });
            rememberPluginError(plugin.id, `All ${loadType} URLs failed`, "load");
            showPluginRetryBtn(plugin.id);
            showLoadNotification("❌", t("pluginLoadFailed", { name: getPluginName(plugin) }), t("pluginLoadRetry"));
            throw new Error(`All ${loadType} URLs failed`);
          }
          loadedPlugins.add(plugin.id);
          failedPlugins.delete(plugin.id);
          setPluginRuntime(plugin.id, { status: "loaded", loadType, loadedUrl: rawUrl });
          hidePluginRetryBtn(plugin.id);
          return;
        }
        const urls = buildAllFetchUrls(rawUrl, mirrorUrl);
        const primary = urls[0];
        const useCache = isJsDelivrUrl(primary) || isOwnPagesUrl(primary);
        const oldCache = useCache ? cachedCode : null;
        const code = await tryFetch(urls);
        if (code) {
          try {
            injectScript(plugin.id, code);
            loadedPlugins.add(plugin.id);
            failedPlugins.delete(plugin.id);
            setPluginRuntime(plugin.id, { status: "loaded", loadType, loadedUrl: primary });
            hidePluginRetryBtn(plugin.id);
            if (useCache) setCachedPluginCode(cacheKey, plugin.id, code, rawUrl, distribution);
            return;
          } catch (e) {
            console.warn(`🐈‍⬛ [PCM] ⚠️ ${plugin.name} 新版執行失敗，改用舊版快取：${e.message}`);
          }
        }
        if (oldCache) {
          try {
            injectScript(plugin.id, oldCache);
            loadedPlugins.add(plugin.id);
            failedPlugins.delete(plugin.id);
            setPluginRuntime(plugin.id, { status: "cached", loadType, loadedUrl: primary });
            hidePluginRetryBtn(plugin.id);
            console.log(`🐈‍⬛ [PCM] ⚡ ${plugin.name} from cache (fallback)`);
            return;
          } catch (e) {
          }
        }
        failedPlugins.add(plugin.id);
        setPluginRuntime(plugin.id, { status: "failed", error: "All URLs failed" });
        rememberPluginError(plugin.id, "All URLs failed", "load");
        showPluginRetryBtn(plugin.id);
        showLoadNotification("❌", t("pluginLoadFailed", { name: getPluginName(plugin) }), t("pluginLoadRetry"));
        throw new Error("All URLs failed");
      }
      function showPluginRetryBtn(pluginId, targetItem = null) {
        const item = targetItem || document.querySelector(`.bc-plugin-item[data-plugin-id="${CSS.escape(pluginId)}"]`);
        if (!item || item.querySelector(".bc-plugin-retry-btn")) return;
        const btn = document.createElement("button");
        btn.className = "bc-plugin-retry-btn";
        btn.textContent = "↺";
        btn.title = t("pluginLoadRetry");
        btn.setAttribute("data-retry-id", pluginId);
        item.appendChild(btn);
        item.classList.add("failed");
      }
      function hidePluginRetryBtn(pluginId) {
        document.querySelector(`[data-retry-id="${CSS.escape(pluginId)}"]`)?.remove();
        document.querySelector(`.bc-plugin-item[data-plugin-id="${CSS.escape(pluginId)}"]`)?.classList.remove("failed");
      }
      async function runPluginBatch(plugins, source = "local") {
        while (isLoadingPlugins) {
          if (!await _lifecycle.sleep(200)) return;
        }
        if (!plugins.length) return;
        isLoadingPlugins = true;
        try {
          let ok = 0, fail = 0;
          const results = await Promise.allSettled(plugins.map((p) => loadSubPlugin(p, source)));
          results.forEach((r, idx) => {
            if (r.status === "fulfilled") ok++;
            else {
              fail++;
              console.error(`🐈‍⬛ [PCM] ❌ ${plugins[idx].name}`);
            }
          });
          if (plugins.length > 0) {
            if (ok > 0) showLoadNotification("✅", t(source === "fusam" ? "fusamLoadedCount" : "pcmLoadedCount", { count: ok }), "");
            if (fail > 0) showLoadNotification("❌", t(source === "fusam" ? "fusamFailedCount" : "pcmFailedCount", { count: fail }), "");
          }
        } finally {
          isLoadingPlugins = false;
        }
      }
      function loadLocalPluginsPhase() {
        if (localLoadStarted) return localPhasePromise;
        localLoadStarted = true;
        localPhasePromise = (async () => {
          await pluginsReady;
          if (!pluginsLoaded || _lifecycle.disposed) {
            localLoadStarted = false;
            localPhasePromise = null;
            return;
          }
          await runPluginBatch(subPlugins.filter((p) => isPluginEnabled(p)), "local");
        })();
        return localPhasePromise;
      }
      async function loadAccountPluginsPhase() {
        if (accountLoadStarted) return;
        accountLoadStarted = true;
        await pluginsReady;
        if (!pluginsLoaded) {
          accountLoadStarted = false;
          return;
        }
        const settingsReady = await ensureAccountSettingsLoaded();
        if (!settingsReady || _lifecycle.disposed) {
          accountLoadStarted = false;
          return;
        }
        if (localPhasePromise) await localPhasePromise;
        if (_lifecycle.disposed) {
          accountLoadStarted = false;
          return;
        }
        const pending = subPlugins.filter((p) => isPluginEnabledInAccount(p) && !loadedPlugins.has(p.id) && !pluginLoadPromises.has(p.id));
        await runPluginBatch(pending, "account");
      }
      async function loadCustomPluginsPhase() {
        if (customLoadStarted) return;
        customLoadStarted = true;
        while (isLoadingPlugins) {
          if (!await _lifecycle.sleep(500)) return;
        }
        const enabled = customPlugins.filter((p) => p.enabled);
        if (enabled.length) await runPluginBatch(enabled, "custom");
      }
      let currentUIState = null;
      let searchQuery = "";
      let filterMode = "all";
      let isCustomEditMode = false;
      let activeTab = "local";
      let _docClickHandler = null;
      _lifecycle.add(() => {
        if (_docClickHandler) document.removeEventListener("click", _docClickHandler);
      });
      let lastDetectedLanguage = null;
      function applyFilter() {
        const q = searchQuery.toLowerCase().trim();
        ["local", "account", "fusam", "custom"].forEach((src) => {
          const container = document.getElementById(`bc-plugin-content-${src}`);
          if (!container) return;
          container.querySelectorAll(".bc-plugin-item[data-plugin-id]").forEach((item) => {
            const id = item.getAttribute("data-plugin-id");
            const plugin = src === "custom" ? customPlugins.find((p) => p.id === id) : src === "fusam" ? fusamPlugins.find((p) => p.id === id) : subPlugins.find((p) => p.id === id);
            if (!plugin) return;
            let pass = true;
            if (filterMode === "enabled") pass = src === "account" ? isPluginEnabledInAccount(plugin) : src === "custom" || src === "fusam" ? plugin.enabled : isPluginEnabled(plugin);
            if (filterMode === "disabled") pass = !(src === "account" ? isPluginEnabledInAccount(plugin) : src === "custom" || src === "fusam" ? plugin.enabled : isPluginEnabled(plugin));
            if (pass && q) {
              pass = [plugin.id, plugin.name, plugin.en_name, plugin.description, plugin.en_description].some((s) => s && String(s).toLowerCase().includes(q));
            }
            item.style.display = pass ? "" : "none";
          });
        });
      }
      function getCurrentViewingCharacter() {
        const now = Date.now();
        if (now - lastCharacterCheck < CHARACTER_CACHE_TIME && cachedViewingCharacter !== null) return cachedViewingCharacter;
        try {
          let c = null;
          if (typeof InformationSheetCharacter !== "undefined" && InformationSheetCharacter) c = InformationSheetCharacter;
          else if (typeof InformationSheetSelection !== "undefined" && InformationSheetSelection !== null && typeof InformationSheetSelection === "object") {
            if (InformationSheetSelection.MemberNumber && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) c = ChatRoomCharacter.find((x) => x.MemberNumber === InformationSheetSelection.MemberNumber);
            else if (InformationSheetSelection.Name) c = InformationSheetSelection;
          } else if (typeof InformationSheetSelection === "number" && CurrentScreen === "ChatRoom" && Array.isArray(ChatRoomCharacter)) {
            c = ChatRoomCharacter.find((x) => x.MemberNumber === InformationSheetSelection);
          }
          if (!c) c = Player;
          cachedViewingCharacter = c;
          lastCharacterCheck = now;
          return c;
        } catch (e) {
          return Player;
        }
      }
      function shouldShowUI() {
        const screen = typeof CurrentScreen === "undefined" ? "" : CurrentScreen;
        if (screen === "Login" || !screen && /\/login|Login\.html/i.test(window.location.href)) return true;
        if (window.bcx?.inBcxSubscreen?.() || window.LITTLISH_CLUB?.inModSubscreen?.() || window.MPA?.menuLoaded || window.LSCG_REMOTE_WINDOW_OPEN) return false;
        if (screen === "MainHall") return !floatingButtonHidden.mainHall;
        if (screen === "InformationSheet") {
          if (floatingButtonHidden.informationSheet || typeof Player === "undefined") return false;
          const vc = getCurrentViewingCharacter();
          return !!vc && vc.MemberNumber === Player.MemberNumber;
        }
        if (screen === "Preference") {
          const identifier = typeof PreferenceExtensionsCurrent === "undefined" ? void 0 : PreferenceExtensionsCurrent?.Identifier;
          if (identifier === "PCMSettings") return true;
          return identifier == null && !floatingButtonHidden.preference;
        }
        return false;
      }
      function showChangelogModal() {
        const existing = document.getElementById("pcm-changelog-modal");
        if (existing) {
          existing.remove();
          return;
        }
        const overlay = document.createElement("div");
        overlay.id = "pcm-changelog-modal";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif;color:#fff;";
        const log = isCJK() ? remoteChangelogTW.length ? remoteChangelogTW : remoteChangelogEN : remoteChangelogEN.length ? remoteChangelogEN : remoteChangelogTW;
        const items = (log.length ? log : ["..."]).map((c) => `<li style="margin:6px 0;font-size:13px;color:#d4c8f5;">${escapeHtml(c)}</li>`).join("");
        box.innerHTML = `<div style="font-size:16px;font-weight:600;margin-bottom:4px;">${escapeHtml(t("changelogTitle"))}</div><div style="font-size:12px;color:#a0a9c0;margin-bottom:16px;">v${escapeHtml(remoteVersion)}</div><ul style="padding-left:18px;margin:0 0 20px;list-style:disc;">${items}</ul><button id="pcm-cl-close" style="width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:14px;cursor:pointer;font-family:inherit;">${escapeHtml(t("changelogClose"))}</button>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById("pcm-cl-close").addEventListener("click", () => overlay.remove());
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) overlay.remove();
        });
      }
      function injectStyles() {
        if (document.getElementById("bc-plugin-styles")) return;
        const style = document.createElement("style");
        style.id = "bc-plugin-styles";
        style.textContent = `
        .bc-plugin-container *,.bc-plugin-panel *,.bc-plugin-btn-group * { font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; user-select:none; -webkit-user-select:none; }

        .bc-plugin-btn-group { position:fixed; top:60px; right:20px; display:flex; flex-direction:column; align-items:center; gap:8px; z-index:2147483647; touch-action:none; }

        .bc-plugin-floating-btn { width:60px; height:60px; background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 50%,#C4B5FD 100%); border:none; border-radius:50%; cursor:grab; box-shadow:0 6px 20px rgba(127,83,205,0.3); transition:box-shadow .3s,background .3s; font-size:24px; display:flex; align-items:center; justify-content:center; animation:pcm-float 3s ease-in-out infinite; }
        .bc-plugin-floating-btn:active { cursor:grabbing; }
        .bc-plugin-floating-btn:hover { box-shadow:0 8px 25px rgba(127,83,205,0.4); background:linear-gradient(135deg,#6B46B2 0%,#9577E3 50%,#B7A3F5 100%); }
        .bc-plugin-floating-btn img { width:48px; height:48px; border-radius:50%; transform:scaleX(-1); pointer-events:none; }

        .bc-plugin-changelog-btn, #bc-plugin-refresh-btn { width:60px; height:60px; background:rgba(26,32,46,0.9); border:1px solid rgba(127,83,205,0.4); border-radius:50%; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.2); transition:all .3s ease; font-size:22px; display:flex; align-items:center; justify-content:center; }
        .bc-plugin-changelog-btn:hover, #bc-plugin-refresh-btn:hover { background:rgba(127,83,205,0.3); border-color:rgba(127,83,205,0.8); transform:scale(1.05); }
        #bc-plugin-refresh-btn.spinning { animation:pcm-spin .8s linear infinite; border-color:rgba(127,83,205,0.8); background:rgba(127,83,205,0.2); }

        @keyframes pcm-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes pcm-spin  { to{transform:rotate(360deg)} }

        .bc-plugin-panel { position:fixed; top:20px; right:auto; left:auto; width:380px; max-width:calc(100vw - 20px); max-height:calc(100vh - 120px); min-height:300px; background:rgba(26,32,46,0.95); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.1); border-radius:20px; z-index:2147483646; overflow:hidden; display:flex; flex-direction:column; transform:translateX(420px) scale(0.8); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s cubic-bezier(.34,1.56,.64,1),visibility 0s linear .4s; box-shadow:0 20px 40px rgba(0,0,0,0.3); visibility:hidden; pointer-events:none; }
        .bc-plugin-panel.show { transform:translateX(0) scale(1); opacity:1; visibility:visible; pointer-events:auto; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .4s cubic-bezier(.34,1.56,.64,1); }
        .bc-plugin-panel.hidden, .bc-plugin-btn-group.hidden { display:none !important; }

        .bc-plugin-header { background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 100%); padding:10px; color:#fff; text-align:center; position:relative; overflow:hidden; flex-shrink:0; }
        .bc-plugin-header::before { content:''; position:absolute; top:0; left:-60%; width:40%; height:100%; background:linear-gradient(to right,transparent,rgba(255,255,255,.22),transparent); animation:pcm-glow 2.2s ease-in-out infinite; }
        @keyframes pcm-glow { 0%{left:-60%} 100%{left:115%} }
        .bc-plugin-title { font-size:16px; font-weight:600; margin:0; position:relative; z-index:1; }

        .bc-plugin-tabs { display:flex; flex-shrink:0; background:rgba(0,0,0,0.25); border-bottom:1px solid rgba(255,255,255,0.07); }
        .bc-plugin-tab { flex:1; padding:8px 4px; background:none; border:none; border-bottom:2px solid transparent; color:rgba(255,255,255,.45); cursor:pointer; font-size:12px; font-weight:500; font-family:inherit; transition:all .2s ease; letter-spacing:.3px; }
        .bc-plugin-tab:hover:not(.active) { color:rgba(255,255,255,.75); background:rgba(255,255,255,.04); }
        .bc-plugin-tab.active { color:#fff; border-bottom-color:#A78BFA; }

        .bc-plugin-search-row { display:flex; align-items:center; gap:6px; padding:8px 12px; background:rgba(0,0,0,0.15); border-bottom:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
        .bc-plugin-search { flex:1; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:5px 10px; color:#fff; font-size:12px; font-family:inherit; outline:none; transition:border-color .2s; }
        .bc-plugin-search:focus { border-color:rgba(167,139,250,0.6); }
        .bc-plugin-search::placeholder { color:rgba(255,255,255,0.35); }
        .bc-plugin-filter-btn, .bc-plugin-gear-btn { width:28px; height:28px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:8px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; color:#fff; }
        .bc-plugin-filter-btn:hover, .bc-plugin-gear-btn:hover { background:rgba(127,83,205,0.3); border-color:rgba(167,139,250,0.5); }
        .bc-plugin-gear-btn.active { background:rgba(127,83,205,0.4); border-color:#A78BFA; }

        .bc-plugin-content { padding:12px; flex:1 1 auto; overflow-y:auto; overflow-x:hidden; max-height:400px; min-height:200px; scrollbar-width:thin; scrollbar-color:rgba(127,83,205,0.8) rgba(255,255,255,0.1); -webkit-overflow-scrolling:touch; }
        .bc-plugin-content::-webkit-scrollbar { width:6px; }
        .bc-plugin-content::-webkit-scrollbar-track { background:rgba(255,255,255,0.05); border-radius:3px; }
        .bc-plugin-content::-webkit-scrollbar-thumb { background:linear-gradient(135deg,#7F53CD,#A78BFA); border-radius:3px; }

        .bc-plugin-footer { background:rgba(255,255,255,0.02); padding:10px 20px; text-align:center; color:#a0a9c0; font-size:11px; border-top:1px solid rgba(255,255,255,0.05); flex-shrink:0; }
        .bc-plugin-footer-link { color:#C4B5FD; text-decoration:none; transition:color .2s; cursor:pointer; }
        .bc-plugin-footer-link:hover { color:#fff; text-decoration:underline; }

        .bc-plugin-item { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:12px; margin-bottom:10px; padding:14px; transition:all .3s ease; position:relative; overflow:hidden; }
        .bc-plugin-item.enabled { background:rgba(127,83,205,0.1); border-color:rgba(127,83,205,0.3); }
        .bc-plugin-item.enabled::before { content:''; position:absolute; top:0; left:0; width:0; height:0; border-left:20px solid #7F53CD; border-bottom:20px solid transparent; z-index:1; }
        .bc-plugin-item.beta-enabled { background:rgba(205,128,53,0.1); border-color:rgba(205,128,53,0.35); }
        .bc-plugin-item.beta-enabled::before { content:''; position:absolute; top:0; left:0; width:0; height:0; border-left:20px solid #CD8035; border-bottom:20px solid transparent; z-index:1; }
        .bc-plugin-item.failed { border-color:rgba(255,80,80,0.4); background:rgba(255,50,50,0.06); }
        .bc-plugin-item.runtime-warning { border-color:rgba(245,158,11,.5); }
        .bc-plugin-item:hover { background:rgba(255,255,255,0.08); border-color:rgba(127,83,205,0.3); transform:translateY(-2px); box-shadow:0 8px 20px rgba(127,83,205,0.15); }
        .bc-plugin-item-header { display:flex; align-items:center; position:relative; }
        .bc-plugin-icon { font-size:22px; margin-right:10px; display:flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:10px; background:rgba(255,255,255,0.1); flex-shrink:0; overflow:hidden; }
        .bc-plugin-icon img { display:block; width:100%; height:100%; border-radius:inherit; object-fit:cover; }
        .bc-plugin-info { flex:1; color:#fff; min-width:0; }
        .bc-plugin-name { font-size:13px; font-weight:500; margin:0; color:#fff; }
        .bc-plugin-desc { font-size:11px; color:#a0a9c0; margin:3px 0 0; line-height:1.4; }
        .bc-plugin-runtime-status { display:block; min-height:13px; margin-top:3px; color:#a0a9c0; font-size:9px; }
        .bc-plugin-runtime-status[data-status="loaded"] { color:#82d6a1; }
        .bc-plugin-runtime-status[data-status="cached"] { color:#f3c67a; }
        .bc-plugin-runtime-status[data-status="failed"] { color:#ff9292; }
        .bc-plugin-runtime-status[data-status="reload"] { color:#f3c67a; }

        .bc-plugin-info-btn { position:absolute; bottom:0; right:0; width:28px; height:28px; cursor:pointer; text-decoration:none; z-index:2; border-radius:0 0 12px 0; }
        .bc-plugin-info-btn::before { content:''; position:absolute; bottom:0; right:0; width:0; height:0; border-style:solid; border-width:0 0 28px 28px; border-color:transparent transparent rgba(255,255,255,0.08) transparent; transition:border-color .2s; }
        .bc-plugin-item.enabled .bc-plugin-info-btn::before { border-color:transparent transparent rgba(127,83,205,0.4) transparent; }
        .bc-plugin-info-btn::after { content:'🔗'; position:absolute; bottom:3px; right:3px; font-size:8px; opacity:.6; transition:opacity .2s; }
        .bc-plugin-info-btn:hover::after { opacity:1; }

        .bc-plugin-toggle { position:relative; width:48px; height:24px; background:rgba(255,255,255,0.2); border-radius:12px; cursor:pointer; transition:all .3s ease; border:none; outline:none; flex-shrink:0; margin-left:8px; }
        .bc-plugin-toggle.active { background:linear-gradient(135deg,#7F53CD,#A78BFA); }
        .bc-plugin-toggle::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px; background:#fff; border-radius:50%; transition:all .3s cubic-bezier(.25,.46,.45,.94); box-shadow:0 2px 6px rgba(0,0,0,0.2); }
        .bc-plugin-toggle.active::after { left:26px; }

        .bc-plugin-toggle-tri { position:relative; width:84px; height:24px; background:rgba(255,255,255,0.12); border-radius:12px; cursor:pointer; border:1px solid rgba(255,255,255,0.15); outline:none; display:flex; align-items:center; padding:0; overflow:hidden; flex-shrink:0; transition:border-color .3s; margin-left:8px; }
        .bc-plugin-toggle-tri:hover { border-color:rgba(196,181,253,0.4); }
        .bc-plugin-toggle-tri-track { position:absolute; top:2px; width:27px; height:20px; border-radius:10px; transition:left .3s cubic-bezier(.25,.46,.45,.94),background .3s; left:2px; background:rgba(255,255,255,.35); }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-track { left:29px; background:linear-gradient(135deg,#7F53CD,#A78BFA); }
        .bc-plugin-toggle-tri[data-state="beta"]   .bc-plugin-toggle-tri-track { left:55px; background:linear-gradient(135deg,#CD8035,#FAB87A); }
        .bc-plugin-toggle-tri-labels { position:relative; z-index:1; display:flex; width:100%; justify-content:space-around; align-items:center; height:100%; }
        .bc-plugin-toggle-tri-label { font-size:8px; font-weight:600; color:rgba(255,255,255,.45); width:28px; text-align:center; transition:color .3s; user-select:none; pointer-events:none; }
        .bc-plugin-toggle-tri[data-state="off"]    .bc-plugin-toggle-tri-label:nth-child(1) { color:rgba(255,255,255,.85); }
        .bc-plugin-toggle-tri[data-state="stable"] .bc-plugin-toggle-tri-label:nth-child(2) { color:#fff; }
        .bc-plugin-toggle-tri[data-state="beta"]   .bc-plugin-toggle-tri-label:nth-child(3) { color:#fff; }
        .bc-plugin-fusam-channel { min-width:58px; height:26px; margin-left:8px; padding:0 9px; border:1px solid rgba(255,255,255,.18); border-radius:13px; color:#d7d0e7; background:rgba(255,255,255,.1); font-size:9px; font-weight:700; cursor:pointer; flex-shrink:0; }
        .bc-plugin-fusam-channel[data-state="stable"] { color:#fff; border-color:#a78bfa; background:linear-gradient(135deg,#7F53CD,#9a6cff); }
        .bc-plugin-fusam-channel[data-state="beta"] { color:#fff; border-color:#f0aa64; background:linear-gradient(135deg,#a96627,#d98b3f); }
        .bc-plugin-fusam-channel[data-state="dev"] { color:#fff; border-color:#ee78a8; background:linear-gradient(135deg,#9d3766,#ce5489); }

        .bc-plugin-retry-btn { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:38px; height:38px; background:rgba(32,18,45,0.92); border:1px solid rgba(255,80,80,0.65); border-radius:50%; cursor:pointer; font-size:19px; color:#ff9b9b; display:flex; align-items:center; justify-content:center; transition:background .2s,color .2s,box-shadow .2s,transform .2s; z-index:4; padding:0; box-shadow:0 4px 14px rgba(0,0,0,.38); }
        .bc-plugin-retry-btn:hover { background:rgba(112,35,55,0.96); color:#fff; box-shadow:0 5px 18px rgba(255,80,80,.28); transform:translate(-50%,-50%) rotate(180deg); }

        .bc-plugin-delete-btn { position:absolute; inset:0; width:100%; height:100%; background:rgba(20,10,10,0.55); border:none; border-radius:12px; cursor:pointer; font-size:22px; color:#ff8080; display:flex; align-items:center; justify-content:center; transition:background .2s; z-index:4; padding:0; }
        .bc-plugin-delete-btn:hover { background:rgba(180,30,30,0.65); }

        .bc-plugin-add-item { display:flex; align-items:center; justify-content:center; min-height:60px; cursor:pointer; background:rgba(127,83,205,0.05); border:1px dashed rgba(127,83,205,0.3); }
        .bc-plugin-add-item:hover { background:rgba(127,83,205,0.12); border-color:rgba(167,139,250,0.5); }
        .bc-plugin-add-icon { font-size:28px; opacity:.6; transition:opacity .2s; }
        .bc-plugin-add-item:hover .bc-plugin-add-icon { opacity:1; }

        .bc-plugin-loading { text-align:center; padding:40px 20px; color:#a0a9c0; font-size:14px; }
        .bc-plugin-loading::after { content:''; display:block; width:28px; height:28px; margin:14px auto 0; border:3px solid rgba(127,83,205,0.3); border-top-color:#A78BFA; border-radius:50%; animation:pcm-spin .8s linear infinite; }
        .bc-plugin-empty { text-align:center; padding:32px 20px; color:#a0a9c0; font-size:13px; line-height:1.8; white-space:pre-wrap; }

        .bc-plugin-account-locked { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:#a0a9c0; font-size:13px; text-align:center; line-height:1.8; white-space:pre-wrap; }

        .bc-liko-toggle-notification { position:fixed; box-sizing:border-box; background:linear-gradient(135deg,#7F53CD 0%,#A78BFA 100%); color:#fff; padding:10px 14px; border-radius:10px; box-shadow:0 8px 20px rgba(127,83,205,0.25); z-index:2147483645; font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif; font-size:13px; transform:translateY(-6px); opacity:0; transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .3s ease; pointer-events:none; user-select:none; }
        .bc-liko-toggle-notification.show { transform:translateY(0); opacity:1; }
        .bc-liko-toggle-notification.hide { transform:translateY(-6px); opacity:0; }

        .bc-liko-notification-stack { position:fixed; right:20px; top:max(16px,15vh); bottom:auto; z-index:2147483648; width:min(312px,calc(100vw - 40px)); max-height:70vh; display:flex; flex-direction:column; align-items:stretch; gap:10px; pointer-events:none; }
        .bc-liko-system-notification { position:relative; box-sizing:border-box; width:100%; flex-shrink:0; background:rgba(26,32,46,0.95); border:1px solid rgba(127,83,205,0.4); color:#fff; padding:12px 16px; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.3); font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif; font-size:13px; transform:translateX(340px); opacity:0; transition:transform .4s cubic-bezier(.34,1.56,.64,1),opacity .3s ease; user-select:none; cursor:pointer; pointer-events:auto; }
        .bc-liko-system-notification.show { transform:translateX(0); opacity:1; }
        .bc-liko-system-notification.hide { transform:translateX(320px); opacity:0; }

        @media (max-width:480px) { .bc-plugin-btn-group{right:10px;top:40px;} }
        @media (max-height:600px) { .bc-plugin-content{max-height:160px;} }

        /* PCM mobile settings UI */
        .bc-plugin-panel { width:min(390px,calc(100vw - 16px)); max-width:none; max-height:calc(100dvh - 16px); min-height:0; background:rgba(21,19,35,.96); border-color:rgba(204,190,255,.16); border-radius:28px; box-shadow:0 26px 80px rgba(0,0,0,.55); backdrop-filter:blur(22px); }
        .bc-plugin-header { padding:16px 16px 10px; text-align:left; background:linear-gradient(155deg,rgba(117,68,223,.42),rgba(25,22,42,.28)); border-bottom:1px solid rgba(204,190,255,.12); overflow:visible; }
        .bc-plugin-header::before { display:none; }
        .bc-plugin-top-row { display:flex; align-items:center; gap:10px; min-height:44px; }
        .bc-plugin-brand { width:44px; height:44px; object-fit:cover; flex:0 0 44px; border-radius:14px; box-shadow:0 8px 22px rgba(113,71,220,.32); pointer-events:none; }
        .bc-plugin-title-wrap { min-width:0; flex:1; }
        .bc-plugin-title { margin:0; font-size:17px; line-height:1.2; font-weight:700; }
        .bc-plugin-summary { display:block; margin-top:4px; color:#b9b0cb; font-size:10px; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bc-plugin-header-actions { display:flex; align-items:center; gap:7px; }
        .bc-plugin-header .bc-plugin-changelog-btn,.bc-plugin-header #bc-plugin-refresh-btn,.bc-plugin-header .bc-plugin-settings-btn { width:36px; height:36px; flex:0 0 36px; border:1px solid rgba(204,190,255,.14); border-radius:12px; background:rgba(255,255,255,.055); box-shadow:none; color:#fff; font-size:16px; }
        .bc-plugin-header .bc-plugin-changelog-btn:hover,.bc-plugin-header #bc-plugin-refresh-btn:hover,.bc-plugin-header .bc-plugin-settings-btn:hover { transform:none; background:rgba(154,108,255,.15); border-color:rgba(175,145,255,.5); }
        .bc-plugin-header .bc-plugin-settings-btn.active { background:rgba(154,108,255,.3); border-color:#b99cff; }
        .bc-plugin-tabs { position:relative; display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-top:13px; padding:4px; border:0; border-radius:14px; background:rgba(8,7,15,.38); overflow:hidden; }
        .bc-plugin-tabs::before { content:''; position:absolute; z-index:0; top:4px; bottom:4px; left:4px; width:var(--pcm-tab-width,calc((100% - 16px) / 3)); transform:var(--pcm-tab-offset,translateX(0)); border:1px solid rgba(190,165,255,.34); border-radius:10px; background:linear-gradient(135deg,rgba(154,108,255,.42),rgba(92,65,155,.55)); box-shadow:0 4px 16px rgba(90,48,180,.28),inset 0 1px rgba(255,255,255,.08); transition:transform .28s cubic-bezier(.22,.8,.32,1),width .2s ease; }
        .bc-plugin-tab { position:relative; z-index:1; padding:8px 5px; border:0; border-radius:10px; color:#aaa3be; font-size:11px; font-weight:700; }
        .bc-plugin-tab:hover:not(.active) { background:rgba(255,255,255,.035); }
        .bc-plugin-tab.active { color:#fff; border:0; background:transparent; box-shadow:none; text-shadow:0 0 9px rgba(218,203,255,.72); }
        .bc-plugin-search-row { gap:7px; padding:11px 14px 9px; background:transparent; border:0; }
        .bc-plugin-search { height:38px; padding:0 12px; border-color:rgba(204,190,255,.12); border-radius:12px; background:rgba(255,255,255,.045); font-size:12px; user-select:text!important; -webkit-user-select:text!important; }
        .bc-plugin-filter-btn,.bc-plugin-gear-btn { width:38px; height:38px; border-color:rgba(204,190,255,.12); border-radius:12px; background:rgba(255,255,255,.045); }
        .bc-plugin-content { max-height:none; min-height:0; padding:4px 14px max(18px,env(safe-area-inset-bottom)); touch-action:none; cursor:grab; overscroll-behavior:contain; scroll-padding-bottom:max(18px,env(safe-area-inset-bottom)); -webkit-overflow-scrolling:touch; }
        .bc-plugin-content.dragging { cursor:grabbing; }
        #bc-plugin-content-settings { touch-action:pan-y; cursor:default; overscroll-behavior:contain; }
        .bc-plugin-item { min-height:0; margin-bottom:9px; padding:10px 11px; border-color:rgba(204,190,255,.12); border-radius:18px; background:linear-gradient(145deg,rgba(46,41,70,.82),rgba(31,28,48,.92)); }
        .bc-plugin-item.enabled { background:linear-gradient(145deg,rgba(58,45,91,.9),rgba(36,30,57,.94)); border-color:rgba(154,108,255,.3); }
        .bc-plugin-item.enabled::before,.bc-plugin-item.beta-enabled::before { display:none; }
        .bc-plugin-item:hover { transform:translateY(-1px); border-color:rgba(176,143,255,.36); box-shadow:none; }
        .bc-plugin-icon { width:50px; height:50px; flex:0 0 50px; margin-right:11px; border-radius:15px; background:rgba(154,108,255,.15); font-size:20px; }
        .bc-plugin-name { font-size:13px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bc-plugin-desc { font-size:10.5px; color:#aaa3be; white-space:normal; overflow-wrap:anywhere; }
        .bc-plugin-runtime-status { position:relative; padding-left:11px; margin-top:5px; font-size:9px; }
        .bc-plugin-runtime-status::before { content:''; position:absolute; left:0; top:50%; width:6px; height:6px; border-radius:50%; background:currentColor; transform:translateY(-50%); box-shadow:0 0 7px currentColor; }
        .bc-plugin-toggle { width:44px; height:26px; border-radius:16px; }
        .bc-plugin-toggle::after { top:3px; left:3px; width:20px; height:20px; }
        .bc-plugin-toggle.active::after { left:21px; }
        .bc-plugin-footer { padding:8px 16px; border-color:rgba(204,190,255,.1); background:rgba(255,255,255,.015); font-size:9px; }
        .bc-plugin-delete-btn { inset:auto; top:50%; right:62px; width:36px; height:36px; transform:translateY(-50%); border:1px solid rgba(255,100,120,.35); border-radius:12px; background:rgba(255,80,100,.12); color:#ff8394; font-size:17px; }
        .bc-plugin-delete-btn:hover { transform:translateY(-50%); background:rgba(180,30,50,.55); border-color:rgba(255,130,145,.8); }
        .bc-plugin-custom-fab { position:absolute; z-index:6; right:18px; bottom:36px; width:50px; height:50px; display:flex; align-items:center; justify-content:center; border:0; border-radius:17px; cursor:pointer; color:#fff; background:linear-gradient(145deg,#aa7cff,#7041db); box-shadow:0 12px 28px rgba(112,65,219,.45); font-size:27px; line-height:1; }
        .bc-plugin-custom-fab:hover { filter:brightness(1.08); }
        #bc-plugin-content-custom { padding-bottom:max(76px,env(safe-area-inset-bottom)); }
        .bc-plugin-empty { min-height:240px; display:flex; align-items:center; justify-content:center; }
        .bc-plugin-source-note { flex:1; min-width:0; color:#aaa3be; font-size:10px; line-height:1.35; }
        .bc-plugin-source-note a { color:#cdb9ff; }
        .bc-plugin-search-row.fusam { flex-wrap:wrap; }
        .bc-plugin-search-row.fusam .bc-plugin-source-note { order:-1; flex:0 0 100%; }
        .bc-plugin-fusam { min-height:260px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:24px; text-align:center; color:#aaa3be; }
        .bc-plugin-fusam h4 { margin:0; color:#fff; font-size:15px; }
        .bc-plugin-fusam p { margin:0; max-width:310px; font-size:11px; line-height:1.6; }
        .bc-plugin-fusam-link { padding:10px 15px; border:1px solid rgba(190,165,255,.32); border-radius:12px; color:#fff; background:linear-gradient(135deg,rgba(154,108,255,.38),rgba(92,65,155,.5)); text-decoration:none; }
        .bc-plugin-settings-overlay { position:fixed; inset:0; z-index:2147483648; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,.58); backdrop-filter:blur(4px); }
        .bc-plugin-settings-card { width:min(340px,94vw); max-height:calc(100dvh - 24px); overflow-y:auto; padding:18px; border:1px solid rgba(190,165,255,.3); border-radius:20px; color:#fff; background:#1c192b; box-shadow:0 22px 60px rgba(0,0,0,.48); }
        .bc-plugin-settings-card h3 { margin:0 0 15px; font-size:16px; }
        .bc-plugin-setting-row { display:flex; align-items:center; justify-content:space-between; gap:14px; min-height:44px; border-bottom:1px solid rgba(204,190,255,.1); color:#d8d2e5; font-size:12px; }
        .bc-plugin-setting-row select { max-width:150px; padding:7px 9px; border:1px solid rgba(204,190,255,.18); border-radius:9px; color:#fff; background:#292541; }
        .bc-plugin-setting-toggle { position:relative; width:44px; height:26px; flex:0 0 44px; }
        .bc-plugin-setting-toggle input { position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }
        .bc-plugin-setting-toggle-track { position:absolute; inset:0; border:1px solid rgba(204,190,255,.18); border-radius:16px; background:rgba(255,255,255,.09); cursor:pointer; transition:background .2s,border-color .2s; }
        .bc-plugin-setting-toggle-track::after { content:''; position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#aaa3be; box-shadow:0 2px 6px rgba(0,0,0,.35); transition:left .22s cubic-bezier(.22,.8,.32,1),background .2s; }
        .bc-plugin-setting-toggle input:checked + .bc-plugin-setting-toggle-track { border-color:#a987fa; background:linear-gradient(135deg,#9a6cff,#7147dc); }
        .bc-plugin-setting-toggle input:checked + .bc-plugin-setting-toggle-track::after { left:21px; background:#fff; }
        .bc-plugin-settings-done { width:100%; margin-top:16px; padding:10px; border:0; border-radius:11px; color:#fff; background:linear-gradient(135deg,#9a6cff,#7147dc); }
        .bc-plugin-settings-card .bc-plugin-fusam { min-height:0; padding:14px 0 0; gap:8px; }
        .bc-plugin-settings-inline { padding:12px 4px 72px; color:#fff; }
        .bc-plugin-settings-inline h3 { margin:0 0 12px; font-size:16px; }
        .bc-plugin-settings-inline .bc-plugin-fusam { min-height:0; padding:16px 0 4px; gap:9px; }
        .bc-plugin-language-select { position:relative; min-width:154px; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-trigger { width:100%; padding:8px 10px; border:1px solid rgba(204,190,255,.2); border-radius:10px; color:#fff; background:#292541; text-align:left; cursor:pointer; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-menu { position:absolute; z-index:12; top:calc(100% + 5px); right:0; width:100%; max-height:190px; overflow-y:auto; padding:5px; border:1px solid rgba(190,165,255,.3); border-radius:11px; background:#211e34; box-shadow:0 12px 30px rgba(0,0,0,.4); scrollbar-width:thin; scrollbar-color:#9a6cff rgba(0,0,0,.35); touch-action:pan-y; overscroll-behavior:contain; cursor:default; }
        .bc-plugin-language-menu::-webkit-scrollbar { width:10px; }
        .bc-plugin-language-menu::-webkit-scrollbar-track { background:rgba(0,0,0,.35); border-radius:7px; }
        .bc-plugin-language-menu::-webkit-scrollbar-thumb { background:#8258dc; border-radius:7px; }
        .bc-plugin-language-menu::-webkit-scrollbar-thumb:hover { background:#9a6cff; }
        .bc-plugin-language-menu.dragging,.bc-plugin-language-menu.dragging * { cursor:grabbing!important; user-select:none!important; }
        .bc-plugin-language-option { display:block; width:100%; padding:8px 9px; border:0; border-radius:8px; color:#d8d2e5; background:transparent; text-align:left; cursor:pointer; font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif; }
        .bc-plugin-language-option:hover,.bc-plugin-language-option.active { color:#fff; background:rgba(154,108,255,.28); }
        .bc-liko-toggle-notification { padding:9px 11px; border:1px solid rgba(194,170,255,.22); border-radius:14px; background:rgba(27,23,43,.97); box-shadow:0 12px 34px rgba(0,0,0,.35); }
        @media (max-width:480px) {
            .bc-plugin-panel { width:calc(100vw - 12px); min-height:0; border-radius:22px; }
            .bc-plugin-header { padding:13px 12px 8px; }
            .bc-plugin-brand { width:40px; height:40px; flex-basis:40px; border-radius:13px; }
            .bc-plugin-header .bc-plugin-changelog-btn,.bc-plugin-header #bc-plugin-refresh-btn,.bc-plugin-header .bc-plugin-settings-btn { width:32px; height:32px; flex-basis:32px; }
            .bc-plugin-search-row { padding-inline:11px; }
            .bc-plugin-content { padding-inline:11px; }
        }
        @media (max-height:600px) {
            .bc-plugin-panel { min-height:0; border-radius:18px; }
            .bc-plugin-header { padding-top:10px; }
            .bc-plugin-tabs { margin-top:8px; }
            .bc-plugin-search-row { padding-top:7px; padding-bottom:7px; }
            .bc-plugin-content { max-height:none; }
            .bc-plugin-item { min-height:0; padding:8px 9px; }
            .bc-plugin-icon { width:44px; height:44px; flex-basis:44px; }
        }
        `;
        document.head.appendChild(style);
      }
      function buildPluginItem(plugin, source = "local") {
        const item = document.createElement("div");
        const isTri = isTriStatePlugin(plugin);
        let currentState, isEnabled, isBeta;
        if (source === "account") {
          currentState = isTri ? accountPluginSettings[plugin.id] || "off" : null;
          isEnabled = isPluginEnabledInAccount(plugin);
        } else {
          currentState = isTri ? plugin.state || "off" : null;
          isEnabled = source === "custom" ? plugin.enabled : isPluginEnabled(plugin);
        }
        isBeta = source === "fusam" ? plugin.distribution === "beta" || plugin.distribution === "dev" : isTri && currentState === "beta";
        const runtime = pluginRuntime.get(plugin.id) || { status: "idle" };
        item.className = `bc-plugin-item${isEnabled && !isBeta ? " enabled" : ""}${isBeta ? " beta-enabled" : ""}${failedPlugins.has(plugin.id) ? " failed" : ""}${runtime.postLoadError ? " runtime-warning" : ""}`;
        item.setAttribute("data-plugin-id", plugin.id);
        const isHttpsUrl = (u) => typeof u === "string" && /^https:\/\//i.test(u);
        const iconUrl = isHttpsUrl(plugin.customIcon) ? plugin.customIcon : isHttpsUrl(plugin.icon) ? plugin.icon : null;
        const fallbackIcon = plugin.iemoji || (!isHttpsUrl(plugin.icon) ? plugin.icon : null) || "🔌";
        const iconHtml = iconUrl ? `<img class="bc-plugin-icon-image" src="${escapeHtml(iconUrl)}" alt="" /><span class="bc-plugin-icon-fallback" hidden>${escapeHtml(fallbackIcon)}</span>` : `<span class="bc-plugin-icon-fallback">${escapeHtml(fallbackIcon)}</span>`;
        const infoBtnHtml = isHttpsUrl(plugin.website) ? `<a class="bc-plugin-info-btn" href="${escapeHtml(plugin.website)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(t("visitWebsite"))}"></a>` : "";
        const toggleHtml = source === "fusam" ? `<button class="bc-plugin-fusam-channel" data-plugin-fusam-channel="${escapeHtml(plugin.id)}" data-state="${escapeHtml(plugin.distribution || "off")}">${escapeHtml(getFusamChannelLabel(plugin, plugin.distribution || "off"))}</button>` : isTri ? (() => {
          const labels = getTriLabels(plugin);
          return `<button class="bc-plugin-toggle-tri" data-plugin-tri="${plugin.id}" data-source="${source}" data-state="${currentState}"><div class="bc-plugin-toggle-tri-track"></div><div class="bc-plugin-toggle-tri-labels"><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[0])}</span><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[1])}</span><span class="bc-plugin-toggle-tri-label">${escapeHtml(labels[2])}</span></div></button>`;
        })() : `<button class="bc-plugin-toggle${isEnabled ? " active" : ""}" data-plugin="${plugin.id}" data-source="${source}"></button>`;
        const runtimeLabels = isCJK() ? { loading: "載入中…", loaded: "已載入", cached: "已從快取救援", failed: "載入失敗", delegated: "由 FUSAM 載入" } : { loading: "Loading…", loaded: "Loaded", cached: "Recovered from cache", failed: "Load failed", delegated: "Handled by FUSAM" };
        const runtimeStatus = runtime.reloadRequired ? "reload" : runtime.status;
        const runtimeText = runtime.reloadRequired ? isCJK() ? "已停用，重新整理後生效" : "Disabled · reload required" : runtimeLabels[runtime.status] || "";
        item.innerHTML = `${infoBtnHtml}<div class="bc-plugin-item-header"><div class="bc-plugin-icon">${iconHtml}</div><div class="bc-plugin-info"><h4 class="bc-plugin-name">${escapeHtml(getPluginName(plugin))}</h4><p class="bc-plugin-desc">${escapeHtml(getPluginDescription(plugin))}</p><small class="bc-plugin-runtime-status" data-status="${escapeHtml(runtimeStatus)}">${escapeHtml(runtimeText)}</small></div>${toggleHtml}</div>`;
        const iconImage = item.querySelector(".bc-plugin-icon-image");
        if (iconImage) iconImage.addEventListener("error", () => {
          console.warn(`🐈‍⬛ [PCM] ⚠️ 插件圖片載入失敗，改用 Emoji：${plugin.id} (${iconUrl})`);
          iconImage.hidden = true;
          const fallback = item.querySelector(".bc-plugin-icon-fallback");
          if (fallback) fallback.hidden = false;
        }, { once: true });
        if (failedPlugins.has(plugin.id)) showPluginRetryBtn(plugin.id, item);
        return item;
      }
      function buildAccountContent(container) {
        container.innerHTML = "";
        if (!Player?.AccountName) {
          container.innerHTML = `<div class="bc-plugin-account-locked">${t("accountNotLoggedIn")}</div>`;
          return;
        }
        if (!pluginsLoaded) {
          container.innerHTML = `<div class="bc-plugin-loading">${t("loadingPlugins")}</div>`;
          return;
        }
        subPlugins.forEach((p) => container.appendChild(buildPluginItem(p, "account")));
      }
      function buildCustomContent(container) {
        container.innerHTML = "";
        if (!customPlugins.length) {
          const hint = document.createElement("div");
          hint.className = "bc-plugin-empty";
          hint.textContent = t("customEmptyHint");
          container.appendChild(hint);
          return;
        }
        customPlugins.forEach((p) => container.appendChild(buildCustomPluginItem(p)));
      }
      function buildAddItem() {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "bc-plugin-custom-fab";
        item.innerHTML = "＋";
        item.title = t("customAddTitle");
        item.addEventListener("click", showAddPluginPanel);
        return item;
      }
      function buildCustomPluginItem(plugin) {
        const item = buildPluginItem(plugin, "custom");
        if (isCustomEditMode) {
          const btn = document.createElement("button");
          btn.className = "bc-plugin-delete-btn";
          btn.innerHTML = "❌";
          btn.title = t("customDeleteConfirm", { name: getPluginName(plugin) });
          btn.setAttribute("data-delete-id", plugin.id);
          item.appendChild(btn);
        }
        return item;
      }
      const FUSAM_URL = "https://sidiousious.gitlab.io/bc-addon-loader/";
      const FUSAM_MANIFEST_URLS = [
        "https://sidiousious.gitlab.io/bc-addon-loader/manifest.json"
      ];
      const FUSAM_CACHE_KEY = "pcm_fusam_manifest_cache";
      const FUSAM_SETTINGS_KEY = "pcm_fusam_plugin_settings";
      let fusamPluginSettings = (() => {
        try {
          return JSON.parse(localStorage.getItem(FUSAM_SETTINGS_KEY) || "{}") || {};
        } catch (e) {
          return {};
        }
      })();
      let fusamPlugins = [], fusamManifestPromise = null;
      function saveFusamPluginSettings() {
        try {
          localStorage.setItem(FUSAM_SETTINGS_KEY, JSON.stringify(fusamPluginSettings));
        } catch (e) {
        }
      }
      function normalizeFusamPlugin(addon) {
        const versions = Array.isArray(addon?.versions) ? addon.versions : [];
        const saved = fusamPluginSettings[String(addon?.id || "")];
        const requestedDistribution = saved === true ? "stable" : typeof saved === "string" ? saved : "off";
        const availableVersions = versions.filter((v) => v?.source && ["stable", "beta", "dev"].includes(v?.distribution));
        const selected = availableVersions.find((v) => v.distribution === requestedDistribution) || (saved === true ? availableVersions[0] : null);
        const manifestType = String(addon?.type || "").toLowerCase();
        return {
          ...addon,
          id: `fusam:${String(addon?.id || "")}`,
          fusamId: String(addon?.id || ""),
          url: selected?.source || "",
          fusamVersions: availableVersions.map((v) => ({ distribution: v.distribution, source: v.source })),
          distribution: selected?.distribution || "off",
          type: manifestType === "module" ? "mod" : manifestType === "script" ? "scr" : "eval",
          enabled: !!selected
        };
      }
      function normalizeFusamPlugins(addons) {
        return addons.filter((addon) => String(addon?.id || "") !== "WCE").map(normalizeFusamPlugin).sort((a, b) => fusamText(a.name).localeCompare(fusamText(b.name), void 0, { sensitivity: "base", numeric: true }));
      }
      function getFusamChannelLabel(plugin, distribution) {
        if (distribution === "off") return "OFF";
        if (plugin?.fusamVersions?.length === 1) return "ON";
        return String(distribution || "").toUpperCase();
      }
      function fusamText(value) {
        if (typeof value === "string") return value;
        if (!value || typeof value !== "object") return "";
        const lang = getLang().toLowerCase();
        return value[lang] || value[lang === "tw" ? "cn" : lang] || value.en || Object.values(value).find((v) => typeof v === "string") || "";
      }
      function getCachedFusamManifest() {
        try {
          const data = JSON.parse(localStorage.getItem(FUSAM_CACHE_KEY) || "null");
          return Array.isArray(data?.addons) ? data : null;
        } catch (e) {
          return null;
        }
      }
      async function loadFusamManifest(force = false) {
        if (fusamPlugins.length && !force) return fusamPlugins;
        if (fusamManifestPromise && !force) return fusamManifestPromise;
        fusamManifestPromise = (async () => {
          let networkError;
          try {
            let data = null;
            for (const url of FUSAM_MANIFEST_URLS) {
              try {
                const { res, text } = await fetchTextWithTimeout(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const candidate = JSON.parse(text);
                if (!Array.isArray(candidate.addons)) throw new Error("Invalid FUSAM manifest");
                data = candidate;
                break;
              } catch (e) {
                networkError = e;
                console.warn(`🐈‍⬛ [PCM] ⚠️ FUSAM manifest ${url}: ${e.message}`);
              }
            }
            if (!data) throw networkError || new Error("FUSAM manifest failed");
            localStorage.setItem(FUSAM_CACHE_KEY, JSON.stringify(data));
            fusamPlugins = normalizeFusamPlugins(data.addons);
          } catch (e) {
            const cached = getCachedFusamManifest();
            if (!cached) throw e;
            fusamPlugins = normalizeFusamPlugins(cached.addons);
            console.warn(`🐈‍⬛ [PCM] ⚠️ FUSAM manifest network failed; using cache: ${e.message}`);
          }
          return fusamPlugins;
        })();
        try {
          return await fusamManifestPromise;
        } finally {
          fusamManifestPromise = null;
        }
      }
      function buildFusamItem(plugin) {
        const item = buildPluginItem({ ...plugin, name: fusamText(plugin.name) || plugin.fusamId, description: fusamText(plugin.description), website: plugin.website || plugin.repository || FUSAM_URL, icon: plugin.icon || "◆" }, "fusam");
        item.classList.add("bc-plugin-fusam-item");
        item.dataset.fusamId = plugin.fusamId;
        return item;
      }
      async function buildFusamContent(container, force = false) {
        container.innerHTML = `<div class="bc-plugin-loading">${escapeHtml(t("loadingPlugins"))}</div>`;
        try {
          const addons = await loadFusamManifest(force);
          if (!container.isConnected && !document.body.contains(container)) return;
          container.innerHTML = "";
          addons.forEach((plugin) => container.appendChild(buildFusamItem(plugin)));
          applyFilter();
        } catch (e) {
          container.innerHTML = `<div class="bc-plugin-fusam"><h4>${escapeHtml(t("loadPluginsFailed"))}</h4><p>${escapeHtml(e.message)}</p><button class="bc-plugin-fusam-link" type="button">↻ ${escapeHtml(t("refreshTitle"))}</button><a class="bc-plugin-fusam-link" href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("fusamOpen"))}</a></div>`;
          container.querySelector("button")?.addEventListener("click", () => buildFusamContent(container, true));
        }
      }
      async function loadEnabledFusamPluginsPhase() {
        if (!Object.values(fusamPluginSettings).some(Boolean)) return;
        try {
          const addons = await loadFusamManifest();
          await runPluginBatch(addons.filter((plugin) => plugin.enabled && plugin.url), "fusam");
        } catch (e) {
          console.warn(`🐈‍⬛ [PCM] ⚠️ Enabled FUSAM plugins could not be loaded: ${e.message}`);
        }
      }
      const PCM_LANGS = [
        ["AUTO", "🌐", "AUTO"],
        ["TW", "🇹🇼", "繁體中文"],
        ["CN", "🇨🇳", "简体中文"],
        ["EN", "🇬🇧", "English"],
        ["DE", "🇩🇪", "Deutsch"],
        ["FR", "🇫🇷", "Français"],
        ["RU", "🇷🇺", "Русский"],
        ["UA", "🇺🇦", "Українська"]
      ];
      function buildPcmSettingsContent(container, onDone) {
        container.innerHTML = "";
        const card = document.createElement("div");
        card.className = "bc-plugin-settings-inline";
        card.innerHTML = `<h3>${escapeHtml(t("settingsTitle"))}</h3>
            <div class="bc-plugin-setting-row"><span>${escapeHtml(t("settingsLanguage"))}</span><div class="bc-plugin-language-select"><button type="button" class="bc-plugin-language-trigger"></button><div class="bc-plugin-language-menu" hidden></div></div></div>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t("settingsLoadNotif"))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showLoadNotifications"${pcmUiSettings.showLoadNotifications ? " checked" : ""}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t("settingsFusam"))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showFusamTab"${pcmUiSettings.showFusamTab ? " checked" : ""}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <label class="bc-plugin-setting-row"><span>${escapeHtml(t("settingsCustom"))}</span><span class="bc-plugin-setting-toggle"><input type="checkbox" data-setting="showCustomTab"${pcmUiSettings.showCustomTab ? " checked" : ""}><span class="bc-plugin-setting-toggle-track"></span></span></label>
            <div class="bc-plugin-fusam"><p>${escapeHtml(t("fusamLicense"))}</p><a class="bc-plugin-fusam-link" href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("fusamOpen"))}</a></div>
            <button class="bc-plugin-settings-done">${escapeHtml(t("settingsClose"))}</button>`;
        container.appendChild(card);
        let changed = false;
        const trigger = card.querySelector(".bc-plugin-language-trigger");
        const menu = card.querySelector(".bc-plugin-language-menu");
        const paintLanguage = () => {
          const entry = PCM_LANGS.find(([code]) => code === pcmUiSettings.language) || PCM_LANGS[0];
          trigger.textContent = `${entry[1]} ${entry[2]}`;
          window.Liko?.__Sys_Flags__?.renderLabel?.(trigger, trigger.textContent);
        };
        PCM_LANGS.forEach(([code, flag, name]) => {
          const option = document.createElement("button");
          option.type = "button";
          option.className = "bc-plugin-language-option";
          option.textContent = `${flag} ${name}`;
          window.Liko?.__Sys_Flags__?.renderLabel?.(option, option.textContent);
          option.classList.toggle("active", code === pcmUiSettings.language);
          option.addEventListener("click", (e) => {
            e.stopPropagation();
            pcmUiSettings.language = code;
            saveUiSettings();
            changed = true;
            menu.hidden = true;
            paintLanguage();
            menu.querySelectorAll(".bc-plugin-language-option").forEach((btn) => btn.classList.toggle("active", btn === option));
          });
          menu.appendChild(option);
        });
        enableAeeStyleDragScroll(menu);
        paintLanguage();
        trigger.addEventListener("click", (e) => {
          e.stopPropagation();
          menu.hidden = !menu.hidden;
        });
        card.querySelectorAll("input[data-setting]").forEach((input) => input.addEventListener("change", () => {
          pcmUiSettings[input.dataset.setting] = input.checked;
          saveUiSettings();
          changed = true;
          if (input.dataset.setting === "showFusamTab" || input.dataset.setting === "showCustomTab") onDone(true);
        }));
        card.querySelector(".bc-plugin-settings-done").addEventListener("click", (e) => {
          e.stopPropagation();
          onDone(changed);
        });
      }
      function showAddPluginPanel() {
        if (document.getElementById("pcm-add-panel")) return;
        const overlay = document.createElement("div");
        overlay.id = "pcm-add-panel";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:rgba(26,32,46,0.98);border:1px solid rgba(127,83,205,0.4);border-radius:16px;padding:20px;width:320px;max-width:90vw;box-shadow:0 20px 40px rgba(0,0,0,0.4);font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif;color:#fff;";
        const fieldStyle = "width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 10px;color:#fff;font-size:12px;font-family:inherit;outline:none;margin-bottom:10px;";
        box.innerHTML = `
            <div style="font-size:15px;font-weight:600;margin-bottom:14px;">${escapeHtml(t("customAddTitle"))}</div>
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t("customFieldName"))}</label>
            <input id="pcm-add-name" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t("customFieldUrl"))}</label>
            <input id="pcm-add-url"  type="text" style="${fieldStyle}" autocomplete="off" placeholder="https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t("customFieldIcon"))}</label>
            <input id="pcm-add-icon" type="text" style="${fieldStyle}" autocomplete="off" placeholder="🔌 / https://..." />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t("customFieldDesc"))}</label>
            <input id="pcm-add-desc" type="text" style="${fieldStyle}" autocomplete="off" />
            <label style="font-size:11px;color:#a0a9c0;display:block;margin-bottom:4px;">${escapeHtml(t("customFieldType"))}</label>
            <div id="pcm-add-type" class="pcm-module-select" style="position:relative;margin-bottom:14px;">
                <button id="pcm-add-type-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" style="${fieldStyle.replace("margin-bottom:10px", "margin-bottom:0")}text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <span id="pcm-add-type-label">${escapeHtml(t("customTypeEval"))}</span><span aria-hidden="true" style="font-size:10px;">▼</span>
                </button>
                <div id="pcm-add-type-menu" role="listbox" tabindex="-1" hidden style="position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:2;padding:4px;background:rgba(22,27,40,.99);border:1px solid rgba(167,139,250,.45);border-radius:9px;box-shadow:0 12px 28px rgba(0,0,0,.5);">
                    <button type="button" role="option" aria-selected="true" data-value="eval" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:rgba(127,83,205,.35);color:#fff;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t("customTypeEval"))}</button>
                    <button type="button" role="option" aria-selected="false" data-value="scr" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:transparent;color:#d8dcec;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t("customTypeScr"))}</button>
                    <button type="button" role="option" aria-selected="false" data-value="mod" style="display:block;width:100%;padding:8px 9px;border:0;border-radius:6px;background:transparent;color:#d8dcec;text-align:left;font:inherit;cursor:pointer;">${escapeHtml(t("customTypeMod"))}</button>
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button id="pcm-add-cancel" style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${escapeHtml(t("customBtnCancel"))}</button>
                <button id="pcm-add-confirm" style="flex:1;padding:9px;border:none;border-radius:8px;background:linear-gradient(135deg,#7F53CD,#A78BFA);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${escapeHtml(t("customBtnAdd"))}</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const nameInput = overlay.querySelector("#pcm-add-name");
        const urlInput = overlay.querySelector("#pcm-add-url");
        const iconInput = overlay.querySelector("#pcm-add-icon");
        const descInput = overlay.querySelector("#pcm-add-desc");
        const typeSelect = overlay.querySelector("#pcm-add-type");
        const typeTrigger = overlay.querySelector("#pcm-add-type-trigger");
        const typeLabel = overlay.querySelector("#pcm-add-type-label");
        const typeMenu = overlay.querySelector("#pcm-add-type-menu");
        const cancelBtn = overlay.querySelector("#pcm-add-cancel");
        const confirmBtn = overlay.querySelector("#pcm-add-confirm");
        if (!nameInput || !urlInput || !iconInput || !descInput || !typeSelect || !typeTrigger || !typeLabel || !typeMenu || !cancelBtn || !confirmBtn) {
          console.error("🐈‍⬛ [PCM] Custom plugin panel failed to render");
          overlay.remove();
          return;
        }
        nameInput.focus();
        let selectedType = "eval";
        const typeOptions = [...typeMenu.querySelectorAll('[role="option"]')];
        const setTypeMenuOpen = (open) => {
          typeMenu.hidden = !open;
          typeTrigger.setAttribute("aria-expanded", String(open));
          if (open) typeOptions.find((o) => o.dataset.value === selectedType)?.focus();
        };
        const selectType = (option) => {
          selectedType = option.dataset.value;
          typeLabel.textContent = option.textContent;
          typeOptions.forEach((o) => {
            const active = o === option;
            o.setAttribute("aria-selected", String(active));
            o.style.background = active ? "rgba(127,83,205,.35)" : "transparent";
          });
          setTypeMenuOpen(false);
          typeTrigger.focus();
        };
        typeTrigger.addEventListener("click", (e) => {
          e.stopPropagation();
          setTypeMenuOpen(typeMenu.hidden);
        });
        typeOptions.forEach((option) => option.addEventListener("click", (e) => {
          e.stopPropagation();
          selectType(option);
        }));
        typeSelect.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            setTypeMenuOpen(false);
            typeTrigger.focus();
            return;
          }
          if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) return;
          e.preventDefault();
          if (typeMenu.hidden) {
            setTypeMenuOpen(true);
            return;
          }
          const current2 = Math.max(0, typeOptions.indexOf(document.activeElement));
          if (e.key === "Enter" || e.key === " ") selectType(typeOptions[current2]);
          else typeOptions[(current2 + (e.key === "ArrowDown" ? 1 : -1) + typeOptions.length) % typeOptions.length].focus();
        });
        const close = () => overlay.remove();
        cancelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          close();
        });
        overlay.addEventListener("click", (e) => {
          e.stopPropagation();
          if (e.target === overlay) close();
        });
        confirmBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const name = nameInput.value.trim();
          const url = urlInput.value.trim();
          const icon = iconInput.value.trim();
          const desc = descInput.value.trim();
          if (!name) {
            showNotification("⚠️", "PCM", t("customNameRequired"));
            return;
          }
          if (!url.endsWith(".js")) {
            showNotification("⚠️", "PCM", t("customUrlInvalid"));
            return;
          }
          const type = selectedType;
          const plugin = { id: "custom_" + Date.now(), name, en_name: name, url, icon: icon || "🔌", description: desc, en_description: desc, enabled: false, type };
          customPlugins.push(plugin);
          saveCustomPlugins();
          const container = document.getElementById("bc-plugin-content-custom");
          if (container) buildCustomContent(container);
          applyFilter();
          close();
          showNotification("✅", "PCM", t("customAdded", { name }));
        });
      }
      function showDeleteConfirm(pluginId) {
        const plugin = customPlugins.find((p) => p.id === pluginId);
        if (!plugin) return;
        if (document.getElementById("pcm-delete-panel")) return;
        const overlay = document.createElement("div");
        overlay.id = "pcm-delete-panel";
        overlay.style.cssText = "position:fixed;inset:0;z-index:2147483648;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;";
        const box = document.createElement("div");
        box.style.cssText = "background:rgba(26,32,46,0.98);border:1px solid rgba(255,80,80,0.3);border-radius:14px;padding:20px;width:280px;max-width:90vw;font-family:'PingFang TC','Microsoft JhengHei','Noto Sans TC','Heiti TC',sans-serif;color:#fff;text-align:center;";
        box.innerHTML = `
            <div style="font-size:14px;margin-bottom:16px;line-height:1.5;">${escapeHtml(t("customDeleteConfirm", { name: plugin.name }))}</div>
            <div style="display:flex;gap:8px;">
                <button id="pcm-del-no"  style="flex:1;padding:9px;border:1px solid rgba(255,255,255,0.15);border-radius:8px;background:transparent;color:#a0a9c0;font-size:13px;cursor:pointer;font-family:inherit;">${escapeHtml(t("customBtnCancel"))}</button>
                <button id="pcm-del-yes" style="flex:1;padding:9px;border:none;border-radius:8px;background:rgba(200,50,50,0.7);color:#fff;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;">${escapeHtml(t("customDeleteYes"))}</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector("#pcm-del-no").addEventListener("click", (e) => {
          e.stopPropagation();
          close();
        });
        overlay.addEventListener("click", (e) => {
          e.stopPropagation();
          if (e.target === overlay) close();
        });
        overlay.querySelector("#pcm-del-yes").addEventListener("click", (e) => {
          e.stopPropagation();
          const name = plugin.name;
          customPlugins = customPlugins.filter((p) => p.id !== pluginId);
          saveCustomPlugins();
          loadedPlugins.delete(pluginId);
          const container = document.getElementById("bc-plugin-content-custom");
          if (container) buildCustomContent(container);
          applyFilter();
          close();
          showNotification("🗑️", "PCM", t("customDeleted", { name }));
        });
      }
      function handlePluginToggle(e) {
        if (e.target.closest(".bc-plugin-info-btn")) {
          e.stopPropagation();
          return;
        }
        const fusamChannel = e.target.closest(".bc-plugin-fusam-channel");
        if (fusamChannel) {
          const id = fusamChannel.getAttribute("data-plugin-fusam-channel");
          const plugin = fusamPlugins.find((p) => p.id === id);
          if (!plugin) return;
          const states = ["off", ...plugin.fusamVersions.map((v) => v.distribution)];
          const currentIndex = Math.max(0, states.indexOf(plugin.distribution || "off"));
          const next = states[(currentIndex + 1) % states.length];
          const version = plugin.fusamVersions.find((v) => v.distribution === next);
          plugin.distribution = next;
          plugin.enabled = next !== "off";
          plugin.url = version?.source || "";
          if (plugin.enabled) fusamPluginSettings[plugin.fusamId] = next;
          else delete fusamPluginSettings[plugin.fusamId];
          saveFusamPluginSettings();
          fusamChannel.setAttribute("data-state", next);
          fusamChannel.textContent = getFusamChannelLabel(plugin, next);
          const item = fusamChannel.closest(".bc-plugin-item");
          item.classList.toggle("enabled", next === "stable");
          item.classList.toggle("beta-enabled", next === "beta" || next === "dev");
          showToggleNotification(
            next === "off" ? "🐾" : next === "stable" ? "🐈‍⬛" : "🧪",
            next === "off" ? `${getPluginName(plugin)} ${t("pluginDisabled")}` : `${getPluginName(plugin)} ${getFusamChannelLabel(plugin, next)} ${t("pluginEnabled")}`,
            next === "off" ? t("willNotStart") : t("willTakeEffect")
          );
          setPluginRuntime(id, { reloadRequired: loadedPlugins.has(id), distribution: next });
          if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, "fusam").catch(() => {
          });
          return;
        }
        const retryBtn = e.target.closest(".bc-plugin-retry-btn");
        if (retryBtn) {
          const id = retryBtn.getAttribute("data-retry-id");
          const isCustom = !!customPlugins.find((p) => p.id === id);
          const isFusam = !!fusamPlugins.find((p) => p.id === id);
          const plugin = isCustom ? customPlugins.find((p) => p.id === id) : isFusam ? fusamPlugins.find((p) => p.id === id) : subPlugins.find((p) => p.id === id);
          if (!plugin) return;
          failedPlugins.delete(id);
          hidePluginRetryBtn(id);
          loadSubPlugin(plugin, isCustom ? "custom" : isFusam ? "fusam" : getPluginLoadSource(plugin)).catch(() => {
          });
          return;
        }
        const delBtn = e.target.closest(".bc-plugin-delete-btn");
        if (delBtn) {
          showDeleteConfirm(delBtn.getAttribute("data-delete-id"));
          return;
        }
        const toggle = e.target.closest(".bc-plugin-toggle");
        if (toggle) {
          const id = toggle.getAttribute("data-plugin");
          const src = toggle.getAttribute("data-source") || "local";
          const plugin = src === "custom" ? customPlugins.find((p) => p.id === id) : src === "fusam" ? fusamPlugins.find((p) => p.id === id) : subPlugins.find((p) => p.id === id);
          if (!plugin) return;
          if (src === "account") {
            const newVal = !isPluginEnabledInAccount(plugin);
            if (newVal) accountPluginSettings[id] = 1;
            else delete accountPluginSettings[id];
            saveAccountSettings();
            toggle.classList.toggle("active", newVal);
            toggle.closest(".bc-plugin-item").classList.toggle("enabled", newVal);
            showToggleNotification(newVal ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${newVal ? t("pluginEnabled") : t("pluginDisabled")}`, newVal ? t("willTakeEffect") : t("willNotStart"));
            setPluginRuntime(id, { reloadRequired: !newVal && loadedPlugins.has(id) });
            if (newVal && !loadedPlugins.has(id) && typeof Player !== "undefined") loadSubPlugin(plugin, "account").catch(() => {
            });
          } else if (src === "custom") {
            plugin.enabled = !plugin.enabled;
            saveCustomPlugins();
            toggle.classList.toggle("active", plugin.enabled);
            toggle.closest(".bc-plugin-item").classList.toggle("enabled", plugin.enabled);
            showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${plugin.name} ${plugin.enabled ? t("pluginEnabled") : t("pluginDisabled")}`, plugin.enabled ? t("willTakeEffect") : t("willNotStart"));
            setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
            if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, "custom").catch(() => {
            });
          } else if (src === "fusam") {
            plugin.enabled = !plugin.enabled;
            fusamPluginSettings[plugin.fusamId] = plugin.enabled;
            saveFusamPluginSettings();
            toggle.classList.toggle("active", plugin.enabled);
            toggle.closest(".bc-plugin-item").classList.toggle("enabled", plugin.enabled);
            showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${plugin.enabled ? t("pluginEnabled") : t("pluginDisabled")}`, plugin.enabled ? t("willTakeEffect") : t("willNotStart"));
            setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
            if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, "fusam").catch(() => {
            });
          } else {
            plugin.enabled = !plugin.enabled;
            pluginSettings[id] = plugin.enabled;
            saveSettings(pluginSettings);
            toggle.classList.toggle("active", plugin.enabled);
            toggle.closest(".bc-plugin-item").classList.toggle("enabled", plugin.enabled);
            showToggleNotification(plugin.enabled ? "🐈‍⬛" : "🐾", `${getPluginName(plugin)} ${plugin.enabled ? t("pluginEnabled") : t("pluginDisabled")}`, plugin.enabled ? t("willTakeEffect") : t("willNotStart"));
            setPluginRuntime(id, { reloadRequired: !plugin.enabled && loadedPlugins.has(id) });
            if (plugin.enabled && !loadedPlugins.has(id)) loadSubPlugin(plugin, "local").catch(() => {
            });
          }
          return;
        }
        const tri = e.target.closest(".bc-plugin-toggle-tri");
        if (tri) {
          const id = tri.getAttribute("data-plugin-tri");
          const src = tri.getAttribute("data-source") || "local";
          const plugin = subPlugins.find((p) => p.id === id);
          if (!plugin || !isTriStatePlugin(plugin)) return;
          const cur = src === "account" ? accountPluginSettings[id] || "off" : plugin.state || "off";
          const next = cycleTriState(cur);
          if (src === "account") {
            if (next === "off") delete accountPluginSettings[id];
            else accountPluginSettings[id] = next;
            saveAccountSettings();
          } else {
            plugin.state = next;
            pluginSettings[id] = next;
            saveSettings(pluginSettings);
          }
          tri.setAttribute("data-state", next);
          const item = tri.closest(".bc-plugin-item");
          item.classList.remove("enabled", "beta-enabled");
          if (next === "stable") item.classList.add("enabled");
          if (next === "beta") item.classList.add("beta-enabled");
          const labels = getTriLabels(plugin);
          showToggleNotification(
            next === "off" ? "🐾" : next === "stable" ? "🐈‍⬛" : "🧪",
            next === "off" ? `${getPluginName(plugin)} ${t("pluginDisabled")}` : `${getPluginName(plugin)} ${labels[next === "stable" ? 1 : 2]} ${t("pluginEnabled")}`,
            next === "off" ? t("willNotStart") : t("willTakeEffect")
          );
          setPluginRuntime(id, { reloadRequired: next === "off" && loadedPlugins.has(id) });
          if (next !== "off" && !loadedPlugins.has(id)) loadSubPlugin(plugin, src === "account" ? "account" : "local").catch(() => {
          });
        }
      }
      function enableAeeStyleDragScroll(area) {
        let drag = null, suppressClick = false;
        const onPointerDown = (event) => {
          if (!event.isPrimary || event.button !== 0 || area.scrollHeight <= area.clientHeight + 1) return;
          drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startScrollTop: area.scrollTop, dragging: false };
        };
        const onPointerMove = (event) => {
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
          if (!drag.dragging) {
            if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx)) return;
            drag.dragging = true;
            area.classList.add("dragging");
            try {
              area.setPointerCapture(event.pointerId);
            } catch (e) {
            }
          }
          event.preventDefault();
          area.scrollTop = drag.startScrollTop - dy;
        };
        const finish = (event) => {
          if (!drag || drag.pointerId !== event.pointerId) return;
          const wasDragging = drag.dragging;
          drag = null;
          area.classList.remove("dragging");
          if (!wasDragging) return;
          suppressClick = true;
          _lifecycle.timeout(() => {
            suppressClick = false;
          }, 0);
        };
        area.addEventListener("pointerdown", onPointerDown, true);
        area.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
        area.addEventListener("pointerup", finish, true);
        area.addEventListener("pointercancel", finish, true);
        area.addEventListener("click", (event) => {
          if (!suppressClick) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          suppressClick = false;
        }, true);
      }
      function makeDraggable(el) {
        let startX, startY, startL, startT, dragging = false;
        el.addEventListener("mousedown", (e) => {
          if (e.button !== 0 || e.target.closest("button, a")) return;
          const rect = el.getBoundingClientRect();
          startX = e.clientX;
          startY = e.clientY;
          startL = rect.left;
          startT = rect.top;
          dragging = false;
          e.preventDefault();
          const onMove = (mv) => {
            const dx = mv.clientX - startX, dy = mv.clientY - startY;
            if (!dragging && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
            dragging = true;
            el.style.right = "auto";
            el.style.animation = "none";
            el.style.left = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startL + dx)) + "px";
            el.style.top = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startT + dy)) + "px";
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        });
      }
      function applyFloatingBtnVisibility() {
        const g = document.getElementById("bc-plugin-btn-group");
        if (!g) return;
        g.style.display = !shouldShowUI() ? "none" : "";
      }
      function enableMomentumScroll(container) {
        let pointerId = null, lastY = 0, lastTime = 0, velocity = 0;
        let dragged = false, inertiaFrame = 0, suppressClick = false;
        const stopInertia = () => {
          if (inertiaFrame) cancelAnimationFrame(inertiaFrame);
          inertiaFrame = 0;
        };
        const runInertia = () => {
          if (Math.abs(velocity) < 0.015) {
            inertiaFrame = 0;
            return;
          }
          const before = container.scrollTop;
          container.scrollTop += velocity * 16;
          velocity *= 0.94;
          if (container.scrollTop === before) {
            inertiaFrame = 0;
            return;
          }
          inertiaFrame = requestAnimationFrame(runInertia);
        };
        container.addEventListener("pointerdown", (e) => {
          if (e.button !== 0 || e.target.closest("input,select,textarea,.bc-plugin-language-select")) return;
          stopInertia();
          pointerId = e.pointerId;
          lastY = e.clientY;
          lastTime = performance.now();
          velocity = 0;
          dragged = false;
          suppressClick = false;
        });
        container.addEventListener("pointermove", (e) => {
          if (pointerId !== e.pointerId) return;
          const now = performance.now(), deltaY = e.clientY - lastY, elapsed = Math.max(1, now - lastTime);
          const threshold = e.pointerType === "touch" ? 8 : 4;
          if (!dragged && Math.abs(deltaY) > threshold) {
            dragged = true;
            container.classList.add("dragging");
            container.setPointerCapture?.(pointerId);
          }
          if (dragged) {
            e.preventDefault();
            container.scrollTop -= deltaY;
            const instantVelocity = -deltaY / elapsed * 1.35;
            velocity = velocity * 0.65 + instantVelocity * 0.35;
            lastY = e.clientY;
            lastTime = now;
          }
        });
        const finish = (e) => {
          if (pointerId !== e.pointerId) return;
          if (container.hasPointerCapture?.(pointerId)) container.releasePointerCapture(pointerId);
          pointerId = null;
          container.classList.remove("dragging");
          suppressClick = dragged;
          if (dragged && Math.abs(velocity) >= 0.015) inertiaFrame = requestAnimationFrame(runInertia);
          _lifecycle.timeout(() => {
            suppressClick = false;
            dragged = false;
          });
        };
        container.addEventListener("pointerup", finish);
        container.addEventListener("pointercancel", finish);
        container.addEventListener("click", (e) => {
          if (!suppressClick) return;
          e.preventDefault();
          e.stopImmediatePropagation();
        }, true);
      }
      function createManagerUI() {
        const show = shouldShowUI();
        const eg = document.getElementById("bc-plugin-btn-group");
        const ep = document.getElementById("bc-plugin-panel");
        if (currentUIState === show) return;
        currentUIState = show;
        if (!show) {
          cachedViewingCharacter = null;
          lastCharacterCheck = 0;
          if (eg) eg.style.display = "none";
          if (ep) {
            ep.style.display = "none";
            ep.classList.remove("show");
          }
          return;
        }
        if (eg && ep) {
          eg.style.display = "";
          ep.style.display = "";
          applyFloatingBtnVisibility();
          return;
        }
        if (eg) eg.remove();
        if (ep) ep.remove();
        injectStyles();
        const btnGroup = document.createElement("div");
        btnGroup.id = "bc-plugin-btn-group";
        btnGroup.className = "bc-plugin-btn-group";
        const floatBtn = document.createElement("button");
        floatBtn.className = "bc-plugin-floating-btn";
        floatBtn.innerHTML = `<img src="https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png" alt="🐱" />`;
        floatBtn.title = t("welcomeTitle");
        const refreshBtn = document.createElement("button");
        refreshBtn.id = "bc-plugin-refresh-btn";
        refreshBtn.className = "bc-plugin-refresh-btn";
        refreshBtn.innerHTML = "↻";
        refreshBtn.title = t("refreshTitle");
        refreshBtn.style.display = "none";
        const changelogBtn = document.createElement("button");
        changelogBtn.className = "bc-plugin-changelog-btn";
        changelogBtn.innerHTML = "📋";
        changelogBtn.title = t("changelogTitle");
        changelogBtn.style.display = "none";
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "bc-plugin-settings-btn";
        settingsBtn.innerHTML = "⚙";
        settingsBtn.title = t("settingsTitle");
        btnGroup.append(floatBtn);
        document.body.appendChild(btnGroup);
        makeDraggable(btnGroup);
        applyFloatingBtnVisibility();
        window.Liko?.__PCMFusamCompat__?.applyButtonOptions?.();
        const panel = document.createElement("div");
        panel.id = "bc-plugin-panel";
        panel.className = "bc-plugin-panel";
        const header = document.createElement("div");
        header.className = "bc-plugin-header";
        header.innerHTML = `<div class="bc-plugin-top-row"><img class="bc-plugin-brand" src="https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png" alt=""><div class="bc-plugin-title-wrap"><h3 class="bc-plugin-title">${t("welcomeTitle")}</h3><small class="bc-plugin-summary"></small></div><div class="bc-plugin-header-actions"></div></div>`;
        header.querySelector(".bc-plugin-header-actions").append(changelogBtn, refreshBtn, settingsBtn);
        refreshBtn.style.display = "flex";
        changelogBtn.style.display = "flex";
        const tabsBar = document.createElement("div");
        tabsBar.className = "bc-plugin-tabs";
        tabsBar.dataset.active = "local";
        const tabs = {
          local: document.createElement("button"),
          account: document.createElement("button"),
          fusam: document.createElement("button"),
          custom: document.createElement("button")
        };
        tabs.local.className = "bc-plugin-tab active";
        tabs.account.className = "bc-plugin-tab";
        tabs.fusam.className = "bc-plugin-tab";
        tabs.custom.className = "bc-plugin-tab";
        tabs.local.textContent = t("tabLocal");
        tabs.account.textContent = t("tabAccount");
        tabs.fusam.textContent = t("tabFusam");
        tabs.custom.textContent = t("tabCustom");
        tabs.fusam.style.display = pcmUiSettings.showFusamTab ? "" : "none";
        tabs.custom.style.display = pcmUiSettings.showCustomTab ? "" : "none";
        tabsBar.append(tabs.local, tabs.account, tabs.fusam, tabs.custom);
        header.appendChild(tabsBar);
        const searchRow = document.createElement("div");
        searchRow.className = "bc-plugin-search-row";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "bc-plugin-search";
        searchInput.placeholder = t("searchPlaceholder");
        const filterBtn = document.createElement("button");
        filterBtn.className = "bc-plugin-filter-btn";
        filterBtn.title = t("filterAll");
        filterBtn.textContent = "☰";
        const gearBtn = document.createElement("button");
        gearBtn.className = "bc-plugin-gear-btn";
        gearBtn.textContent = "⚙";
        gearBtn.style.display = "none";
        const sourceNote = document.createElement("div");
        sourceNote.className = "bc-plugin-source-note";
        sourceNote.style.display = "none";
        sourceNote.innerHTML = `${escapeHtml(t("fusamDesc"))} <a href="${FUSAM_URL}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("fusamOpen"))}</a>`;
        searchRow.append(searchInput, sourceNote, filterBtn, gearBtn);
        const contentLocal = document.createElement("div");
        contentLocal.id = "bc-plugin-content-local";
        contentLocal.className = "bc-plugin-content";
        if (!pluginsLoaded) contentLocal.innerHTML = `<div class="bc-plugin-loading">${t("loadingPlugins")}</div>`;
        else subPlugins.forEach((p) => contentLocal.appendChild(buildPluginItem(p, "local")));
        const contentAccount = document.createElement("div");
        contentAccount.id = "bc-plugin-content-account";
        contentAccount.className = "bc-plugin-content";
        contentAccount.style.display = "none";
        buildAccountContent(contentAccount);
        const contentCustom = document.createElement("div");
        contentCustom.id = "bc-plugin-content-custom";
        contentCustom.className = "bc-plugin-content";
        contentCustom.style.display = "none";
        buildCustomContent(contentCustom);
        const contentFusam = document.createElement("div");
        contentFusam.id = "bc-plugin-content-fusam";
        contentFusam.className = "bc-plugin-content";
        contentFusam.style.display = "none";
        if (pcmUiSettings.showFusamTab) buildFusamContent(contentFusam);
        const contentSettings = document.createElement("div");
        contentSettings.id = "bc-plugin-content-settings";
        contentSettings.className = "bc-plugin-content";
        contentSettings.style.display = "none";
        [contentLocal, contentAccount, contentFusam, contentCustom].forEach(enableMomentumScroll);
        const footer = document.createElement("div");
        footer.className = "bc-plugin-footer";
        footer.innerHTML = `❖ <a class="bc-plugin-footer-link" href="https://awdrrawd.github.io/liko-Plugin-Repository/" target="_blank" rel="noopener noreferrer">Liko Plugin Manager v${MOD_VER}</a> ❖`;
        const customAddFab = buildAddItem();
        customAddFab.style.display = "none";
        panel.append(header, searchRow, contentLocal, contentAccount, contentFusam, contentCustom, contentSettings, footer, customAddFab);
        document.body.appendChild(panel);
        let isOpen = false;
        const contents = { local: contentLocal, account: contentAccount, fusam: contentFusam, custom: contentCustom };
        const visibleTabKeys = ["local", "account", ...pcmUiSettings.showFusamTab ? ["fusam"] : [], ...pcmUiSettings.showCustomTab ? ["custom"] : []];
        tabsBar.style.gridTemplateColumns = `repeat(${visibleTabKeys.length},1fr)`;
        tabsBar.style.setProperty("--pcm-tab-width", `calc((100% - ${8 + (visibleTabKeys.length - 1) * 4}px) / ${visibleTabKeys.length})`);
        const updateHeaderSummary = () => {
          if (activeTab === "fusam") {
            header.querySelector(".bc-plugin-summary").textContent = `${fusamPlugins.length} ${t("plugins")} · ${fusamPlugins.filter((plugin) => plugin.enabled).length} ${t("pluginEnabled")}`;
            return;
          }
          if (activeTab === "local" && (!pluginsLoaded || contents.local.querySelector(".bc-plugin-loading"))) {
            header.querySelector(".bc-plugin-summary").textContent = t("loadingPlugins");
            return;
          }
          const items = [...contents[activeTab].querySelectorAll(".bc-plugin-item:not(.bc-plugin-add-item)")];
          const enabled = items.filter((item) => item.classList.contains("enabled") || item.classList.contains("beta-enabled")).length;
          header.querySelector(".bc-plugin-summary").textContent = `${items.length} ${t("plugins")} · ${enabled} ${t("pluginEnabled")}`;
        };
        const summaryObserver = new MutationObserver(updateHeaderSummary);
        Object.values(contents).forEach((content) => summaryObserver.observe(content, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class"]
        }));
        const switchTab = (tab) => {
          activeTab = tab;
          tabsBar.dataset.active = tab;
          const tabIndex = Math.max(0, visibleTabKeys.indexOf(tab));
          tabsBar.style.setProperty("--pcm-tab-offset", `translateX(calc(${tabIndex * 100}% + ${tabIndex * 4}px))`);
          Object.keys(tabs).forEach((k) => {
            tabs[k].classList.toggle("active", k === tab);
            contents[k].style.display = k === tab ? "" : "none";
          });
          gearBtn.style.display = tab === "custom" ? "" : "none";
          customAddFab.style.display = tab === "custom" ? "flex" : "none";
          const isFusam = tab === "fusam";
          searchRow.classList.toggle("fusam", isFusam);
          searchInput.style.display = filterBtn.style.display = "";
          sourceNote.style.display = isFusam ? "" : "none";
          if (tab === "account") buildAccountContent(contentAccount);
          if (tab === "custom") buildCustomContent(contentCustom);
          applyFilter();
          updateHeaderSummary();
        };
        let settingsOpen = false, settingsReturnTab = "local";
        const closeSettings = (changed) => {
          settingsOpen = false;
          settingsBtn.classList.remove("active");
          if (changed) {
            document.getElementById("bc-plugin-btn-group")?.remove();
            document.getElementById("bc-plugin-panel")?.remove();
            currentUIState = null;
            createManagerUI();
            return;
          }
          contentSettings.style.display = "none";
          tabsBar.style.display = "";
          searchRow.style.display = "";
          switchTab(settingsReturnTab);
        };
        const openSettings = () => {
          if (settingsOpen) {
            closeSettings(false);
            return;
          }
          settingsOpen = true;
          settingsReturnTab = activeTab;
          settingsBtn.classList.add("active");
          tabsBar.style.display = "none";
          searchRow.style.display = "none";
          Object.values(contents).forEach((content) => {
            content.style.display = "none";
          });
          customAddFab.style.display = "none";
          contentSettings.style.display = "";
          header.querySelector(".bc-plugin-summary").textContent = t("settingsTitle");
          buildPcmSettingsContent(contentSettings, closeSettings);
        };
        tabs.local.addEventListener("click", () => switchTab("local"));
        tabs.account.addEventListener("click", () => switchTab("account"));
        tabs.fusam.addEventListener("click", () => switchTab("fusam"));
        tabs.custom.addEventListener("click", () => switchTab("custom"));
        const filterModes = ["all", "enabled", "disabled"];
        filterBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          filterMode = filterModes[(filterModes.indexOf(filterMode) + 1) % 3];
          applyFilter();
          showToggleNotification("☰", "PCM", t("filter" + filterMode.charAt(0).toUpperCase() + filterMode.slice(1)));
        });
        gearBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          isCustomEditMode = !isCustomEditMode;
          gearBtn.classList.toggle("active", isCustomEditMode);
          buildCustomContent(contentCustom);
          applyFilter();
        });
        searchInput.addEventListener("input", () => {
          searchQuery = searchInput.value;
          applyFilter();
        });
        let closeRebuildTimer = null, closeTransitionHandler = null;
        const cancelClosedRebuild = () => {
          if (closeRebuildTimer) _lifecycle.clearTimeout(closeRebuildTimer);
          closeRebuildTimer = null;
          if (closeTransitionHandler) panel.removeEventListener("transitionend", closeTransitionHandler);
          closeTransitionHandler = null;
        };
        const finalizeClosedRebuild = () => {
          if (isOpen || !panel.isConnected) return;
          cancelClosedRebuild();
          const groupRect = btnGroup.getBoundingClientRect();
          activeTab = "local";
          searchQuery = "";
          filterMode = "all";
          isCustomEditMode = false;
          if (_docClickHandler) {
            document.removeEventListener("click", _docClickHandler);
            _docClickHandler = null;
          }
          summaryObserver.disconnect();
          document.getElementById("pcm-add-panel")?.remove();
          document.getElementById("pcm-delete-panel")?.remove();
          panel.remove();
          btnGroup.remove();
          currentUIState = null;
          createManagerUI();
          const rebuiltGroup = document.getElementById("bc-plugin-btn-group");
          if (rebuiltGroup) {
            rebuiltGroup.style.left = Math.max(0, Math.min(window.innerWidth - rebuiltGroup.offsetWidth, groupRect.left)) + "px";
            rebuiltGroup.style.top = Math.max(0, Math.min(window.innerHeight - rebuiltGroup.offsetHeight, groupRect.top)) + "px";
            rebuiltGroup.style.right = "auto";
          }
        };
        const closeAndRebuildManager = () => {
          if (!isOpen) return;
          isOpen = false;
          panel.classList.remove("show");
          document.getElementById("pcm-add-panel")?.remove();
          document.getElementById("pcm-delete-panel")?.remove();
          cancelClosedRebuild();
          closeTransitionHandler = (event) => {
            if (event.target !== panel || event.propertyName !== "transform" && event.propertyName !== "opacity") return;
            finalizeClosedRebuild();
          };
          panel.addEventListener("transitionend", closeTransitionHandler);
          closeRebuildTimer = _lifecycle.timeout(finalizeClosedRebuild, 460);
        };
        floatBtn.addEventListener("click", (e) => {
          if (e.target !== floatBtn && e.target !== floatBtn.querySelector("img")) return;
          e.preventDefault();
          e.stopPropagation();
          if (isOpen) {
            closeAndRebuildManager();
            return;
          } else {
            cancelClosedRebuild();
            isOpen = true;
            panel.classList.add("show");
            const gr = btnGroup.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const pWidth = Math.min(390, vw - 12);
            panel.style.width = pWidth + "px";
            let left = gr.left - pWidth - 12;
            if (left < 10) left = Math.max(10, (vw - pWidth) / 2);
            left = Math.max(10, Math.min(vw - pWidth - 10, left));
            const compactViewport = vw <= 480 || vh <= 600;
            const top = compactViewport ? 6 : Math.max(10, Math.min(gr.top, vh - 200));
            panel.style.left = left + "px";
            panel.style.right = "auto";
            panel.style.top = top + "px";
            panel.style.maxHeight = vh - top - (compactViewport ? 6 : 20) + "px";
            if (pluginsLoaded && contentLocal.querySelector(".bc-plugin-loading")) {
              contentLocal.innerHTML = "";
              subPlugins.forEach((p) => contentLocal.appendChild(buildPluginItem(p, "local")));
              applyFilter();
              updateHeaderSummary();
            }
          }
        });
        refreshBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          refreshPluginList();
        });
        changelogBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showChangelogModal();
        });
        settingsBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSettings();
        });
        [contentLocal, contentAccount, contentFusam, contentCustom].forEach((c) => c.addEventListener("click", (e) => {
          handlePluginToggle(e);
          _lifecycle.timeout(updateHeaderSummary);
        }));
        updateHeaderSummary();
        if (_docClickHandler) document.removeEventListener("click", _docClickHandler);
        _docClickHandler = (e) => {
          if (!panel.contains(e.target) && !btnGroup.contains(e.target) && isOpen) {
            closeAndRebuildManager();
          }
        };
        document.addEventListener("click", _docClickHandler);
      }
      let toggleNotifTimer = null;
      function showToggleNotification(icon, title, message) {
        let notif = document.getElementById("pcm-toggle-notif");
        if (notif) {
          notif.classList.remove("show");
          _lifecycle.clearTimeout(toggleNotifTimer);
        } else {
          notif = document.createElement("div");
          notif.id = "pcm-toggle-notif";
          notif.className = "bc-liko-toggle-notification";
          document.body.appendChild(notif);
        }
        const panel = document.getElementById("bc-plugin-panel");
        if (panel) {
          const r = panel.getBoundingClientRect();
          const width = Math.min(250, Math.max(180, panel.clientWidth - 110));
          notif.style.top = r.top + 14 + "px";
          notif.style.width = width + "px";
          notif.style.left = r.left + Math.max(58, (panel.clientWidth - width) / 2) + "px";
          notif.style.right = "auto";
        }
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">${escapeHtml(icon)}</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div><div style="font-size:11px;opacity:.88;">${escapeHtml(message)}</div>`;
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add("show")));
        toggleNotifTimer = _lifecycle.timeout(() => {
          notif.classList.remove("show");
          notif.classList.add("hide");
          _lifecycle.timeout(() => notif?.parentNode?.removeChild(notif), 350);
        }, 1800);
      }
      function getNotificationStack() {
        let stack = document.getElementById("pcm-notification-stack");
        if (!stack) {
          stack = document.createElement("div");
          stack.id = "pcm-notification-stack";
          stack.className = "bc-liko-notification-stack";
          document.body.appendChild(stack);
        }
        return stack;
      }
      function dismissStackNotification(notif) {
        if (!notif || notif.dataset.dismissing === "true") return;
        notif.dataset.dismissing = "true";
        notif.classList.remove("show");
        notif.classList.add("hide");
        _lifecycle.timeout(() => {
          const stack = notif.parentElement;
          notif.remove();
          if (stack?.id === "pcm-notification-stack" && !stack.children.length) stack.remove();
        }, 400);
      }
      function showPreviousPluginErrorNotice() {
        if (!previousPluginError?.pluginId || document.getElementById("pcm-previous-error-notif")) return;
        const pluginName = previousPluginError.pluginName || previousPluginError.pluginId;
        const notif = document.createElement("div");
        notif.id = "pcm-previous-error-notif";
        notif.className = "bc-liko-system-notification";
        const title = isCJK() ? "上次插件錯誤" : "Previous plugin error";
        const message = isCJK() ? `上次 ${pluginName} 插件發生錯誤；若仍持續發生，建議暫時停用。` : `${pluginName} reported an error last time. If it continues, consider disabling it.`;
        notif.innerHTML = `<div style="display:flex;align-items:center;margin-bottom:2px;"><span style="font-size:16px;margin-right:7px;">⚠️</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div><div style="font-size:11px;opacity:.85;">${escapeHtml(message)}</div>`;
        const dismiss = () => dismissStackNotification(notif);
        notif.addEventListener("click", dismiss, { once: true });
        getNotificationStack().appendChild(notif);
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add("show")));
        _lifecycle.timeout(dismiss, 8e3);
        previousPluginError = null;
      }
      function showNotification(icon, title, message, durationMs = 3500) {
        _createSystemNotif(icon, title, message, durationMs);
      }
      function showLoadNotification(icon, title, message, durationMs = 3500) {
        if (pcmUiSettings.showLoadNotifications) _createSystemNotif(icon, title, message, durationMs);
      }
      function _createSystemNotif(icon, title, message, durationMs = 3500) {
        const notif = document.createElement("div");
        notif.className = "bc-liko-system-notification";
        notif.innerHTML = `<div style="display:flex;align-items:center;${message ? "margin-bottom:2px;" : ""}"><span style="font-size:16px;margin-right:7px;">${escapeHtml(icon)}</span><strong style="font-size:12px;">${escapeHtml(title)}</strong></div>${message ? `<div style="font-size:11px;opacity:.85;">${escapeHtml(message)}</div>` : ""}`;
        getNotificationStack().appendChild(notif);
        notif.addEventListener("click", () => dismissStackNotification(notif), { once: true });
        requestAnimationFrame(() => requestAnimationFrame(() => notif.classList.add("show")));
        _lifecycle.timeout(() => dismissStackNotification(notif), durationMs);
      }
      function checkLanguageChange() {
        const cur = getLang();
        if (lastDetectedLanguage !== null && lastDetectedLanguage !== cur) {
          const eg = document.getElementById("bc-plugin-btn-group");
          const ep = document.getElementById("bc-plugin-panel");
          if (eg) eg.remove();
          if (ep) ep.remove();
          currentUIState = null;
          createManagerUI();
        }
        lastDetectedLanguage = cur;
      }
      function monitorPageChanges() {
        const id = _lifecycle.interval(() => checkLanguageChange(), 5e3);
        createManagerUI();
      }
      function handle_PCM_Command(text) {
        const sub = String(text || "").trim().split(/\s+/)[0]?.toLowerCase() || "help";
        const zhMode = isCJK();
        const send = (msg) => {
          try {
            ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${msg}</font>`, Timeout: 6e4 });
          } catch (e) {
          }
        };
        if (sub === "help" || !sub) {
          send(t("shortLoaded"));
        } else if (sub === "list") {
          let list = "🔌 " + (zhMode ? "可用插件：" : "Available plugins:") + "\n\n";
          subPlugins.forEach((p) => {
            const on = isTriStatePlugin(p) ? p.state !== "off" ? "✅" : "⭕" : p.enabled ? "✅" : "⭕";
            const info = getPluginAdditionalInfo(p);
            list += `${on} ${p.icon || ""} ${getPluginName(p)}
  ${getPluginDescription(p)}${info ? `
  💡 ${info}` : ""}

`;
          });
          send(list);
        } else {
          send(zhMode ? "請輸入 /pcm help" : "Type /pcm help");
        }
      }
      function tryRegisterCommand() {
        let n = 0;
        const try_ = () => {
          if (_lifecycle.disposed) return;
          n++;
          try {
            if (typeof CommandCombine === "function") {
              CommandCombine([{ Tag: "pcm", Description: "Liko Plugin Collection Manager", Action: handle_PCM_Command }]);
              return;
            }
          } catch (e) {
          }
          if (n < 20) _lifecycle.timeout(try_, 3e3);
        };
        try_();
      }
      function sendLoadedMessage() {
        const wait = () => new Promise((r) => {
          let done = false;
          const check = () => {
            if (done) return;
            if (typeof CurrentScreen !== "undefined" && CurrentScreen === "ChatRoom") {
              done = true;
              r(true);
            } else _lifecycle.timeout(check, 1e3);
          };
          check();
          _lifecycle.timeout(() => {
            if (!done) {
              done = true;
              r(false);
            }
          }, 6e4);
        });
        wait().then((ok) => {
          if (!ok) return;
          try {
            if (pcmUiSettings.showLoadNotifications) {
              ChatRoomMessage({ Type: "LocalMessage", Sender: Player.MemberNumber, Content: `<font color="#885CB0">[PCM] ${t("shortLoaded")}</font>`, Timeout: 6e4 });
              showLoadNotification("🐈‍⬛", "PCM", t("loaded", { ver: MOD_VER }));
            }
          } catch (e) {
          }
        });
      }
      async function registerPreferencePage() {
        let n = 0;
        while (typeof PreferenceRegisterExtensionSetting !== "function" && n < 60) {
          if (_lifecycle.disposed) return;
          await _lifecycle.sleep(1e3);
          n++;
        }
        if (typeof PreferenceRegisterExtensionSetting !== "function" || _lifecycle.disposed) return;
        window.PreferenceSubscreenPCMSettingsLoad = () => {
        };
        window.PreferenceSubscreenPCMSettingsRun = () => {
          DrawCharacter(Player, 50, 50, 0.9);
          DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");
          MainCanvas.textAlign = "left";
          DrawText(isCJK() ? "- PCM 插件管理器設定 -" : "- PCM Plugin Manager Settings -", 500, 125, "Black", "Gray");
          DrawText(isCJK() ? `📱 本地已啟用：${subPlugins.filter((p) => isPluginEnabled(p)).length} 個` : `📱 Local enabled: ${subPlugins.filter((p) => isPluginEnabled(p)).length}`, 500, 280, "Black", "Gray");
          DrawText(isCJK() ? `☁️ 帳戶已啟用：${subPlugins.filter((p) => isPluginEnabledInAccount(p)).length} 個` : `☁️ Account enabled: ${subPlugins.filter((p) => isPluginEnabledInAccount(p)).length}`, 500, 355, "Black", "Gray");
          DrawText(t("hideBalloon"), 500, 440, "Black", "Gray");
          [["mainHall", "hideMainHall"], ["preference", "hidePreference"], ["informationSheet", "hideInformationSheet"]].forEach(([key, label], i) => {
            const x = 500 + i * 370;
            DrawCheckbox(x, 490, 64, 64, "", floatingButtonHidden[key]);
            DrawText(t(label), x + 80, 520, "Black", "Gray");
          });
          MainCanvas.textAlign = "center";
        };
        window.PreferenceSubscreenPCMSettingsClick = () => {
          if (MouseIn(1815, 75, 90, 90)) {
            PreferenceSubscreenPCMSettingsExit();
            return;
          }
          ["mainHall", "preference", "informationSheet"].forEach((key, i) => {
            if (!MouseIn(500 + i * 370, 490, 330, 64)) return;
            floatingButtonHidden[key] = !floatingButtonHidden[key];
            const cfg = loadAccountConfig();
            cfg.floatingButtonHidden = { ...floatingButtonHidden };
            saveAccountConfig(cfg);
            currentUIState = null;
            createManagerUI();
          });
        };
        window.PreferenceSubscreenPCMSettingsExit = () => PreferenceSubscreenExtensionsClear();
        PreferenceRegisterExtensionSetting({
          Identifier: "PCMSettings",
          ButtonText: t("prefButton"),
          Image: "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png",
          click: window.PreferenceSubscreenPCMSettingsClick,
          run: window.PreferenceSubscreenPCMSettingsRun,
          exit: window.PreferenceSubscreenPCMSettingsExit,
          load: window.PreferenceSubscreenPCMSettingsLoad
        });
      }
      const dependencies = new DependencyLoader();
      const EARLY_BOOT = [
        {
          id: "Liko-LCE",
          url: "https://awdrrawd.github.io/BC-LCE/assets/main.js",
          mirrorUrl: "https://awdrrawd.github.io/BC-LCE/loader.user.js",
          type: "mod"
        }
      ];
      function earlyBootEnabled(e) {
        const saved = pluginSettings[e.id];
        return saved !== void 0 && saved !== false && saved !== "off" && saved !== 0;
      }
      function earlyBootPlugins() {
        for (const e of EARLY_BOOT) {
          if (!earlyBootEnabled(e)) continue;
          const early = window.Liko.__PCMEarlyBoot__ ??= /* @__PURE__ */ new Map();
          let pending = early.get(e.id);
          if (!pending) {
            pending = loadSubPlugin({ ...e, enabled: true }, "local");
            early.set(e.id, pending);
            pending.catch(() => {
              if (early.get(e.id) === pending) early.delete(e.id);
            });
          }
          pluginLoadPromises.set(e.id, pending);
          pending.then(() => loadedPlugins.add(e.id), () => {
          }).finally(() => {
            if (pluginLoadPromises.get(e.id) === pending) pluginLoadPromises.delete(e.id);
          });
        }
      }
      await (async () => {
        earlyBootPlugins();
        await dependencies.ensureCore();
        try {
          if (typeof bcModSdk === "undefined" || typeof bcModSdk.registerMod !== "function") throw new Error("bcModSdk not available");
          modApi = bcModSdk.registerMod({ name: "Liko - PCM", fullName: "Liko's Plugin Collection Manager", version: MOD_VER, repository: "https://github.com/awdrrawd/liko-Plugin-Repository" });
          registerPCMBadge();
        } catch (e) {
          console.error("🐈‍⬛ [PCM] ❌ Init failed:", e.message);
          throw e;
        }
        if (document.readyState === "loading") await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
        await initialize();
        sendLoadedMessage();
        console.log(`🐈‍⬛ [PCM] ✅ v${MOD_VER} loaded`);
      })();
      async function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        registerPCMTranslations({ lifecycle: _lifecycle });
        await new Promise((r) => {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              r();
            }
          };
          const check = () => {
            if (done || _lifecycle.disposed) return finish();
            if (typeof TranslationLanguage !== "undefined") return finish();
            _lifecycle.timeout(check, 100);
          };
          check();
          _lifecycle.timeout(finish, 3e3);
        });
        lastDetectedLanguage = getLang();
        customPlugins = loadCustomPlugins();
        installPCMReadOnlyApi();
        injectStyles();
        monitorPageChanges();
        if (typeof modApi.onUnload === "function") modApi.onUnload(() => {
          _lifecycle.dispose();
          if (_lifecycle.mousemoveHandler) {
            document.removeEventListener("mousemove", _lifecycle.mousemoveHandler);
            _lifecycle.mousemoveHandler = null;
          }
          document.getElementById("pcm-notification-stack")?.remove();
          isInitialized = false;
        });
        tryRegisterCommand();
        _lifecycle.timeout(showPreviousPluginErrorNotice, 1200);
        initPlugins();
        loadLocalPluginsPhase();
        loadAccountPluginsPhase();
        _lifecycle.timeout(() => loadCustomPluginsPhase(), 5e3);
        _lifecycle.timeout(() => loadEnabledFusamPluginsPhase(), 5500);
        registerPreferencePage();
      }
      window.Liko.PCM = MOD_VER;
      startup.status = "ready";
      return window.Liko.PCMApi;
    }).catch((error) => {
      startup.status = "failed";
      startup.error = error;
      try {
        rollback();
      } catch (cleanupError) {
        console.warn("[PCM] Startup cleanup:", cleanupError);
      }
      if (window.Liko.__PCMStartup__ === startup) {
        delete window.Liko.PCM;
        delete window.Liko.PCMApi;
      }
      throw error;
    });
    startup.promise.catch((error) => console.error("[PCM] Startup failed:", error));
    return startup.promise;
  }

  // src/pcm/classic-entry.js
  startPCM();
})();
