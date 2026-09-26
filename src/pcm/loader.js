import {fetchText, isJavaScriptText} from './network.js';
import {getRepositoryBases} from './config.js';
import {isChangelogPage} from './page-policy.js';

const CACHE_KEY = 'pcm_main_cache';
const PATHS = {
  module: 'dist/pcm/PCM.js',
  classic: 'Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js',
};

function sourceUrls(path, localBase) {
  if (localBase) return [new URL(`${path}?t=${Date.now()}`, localBase).href];
  return getRepositoryBases({}).root.map((base, index) => `${base}${path}${index === 0 ? `?timestamp=${Date.now()}` : ''}`);
}

function validateCode(code) {
  if (!isJavaScriptText(code)) throw new Error('Received HTML or empty JavaScript');
  // Pre-handshake releases cannot report asynchronous startup failure safely.
  // Reject them before execution so their early version marker cannot block rescue.
  if (!code.includes('__PCMStartup__')) throw new Error('PCM release lacks startup handshake');
}

async function importCode(code) {
  // build:pcm emits a self-contained bundle without relative imports/import.meta URLs.
  // Fetch once, execute these exact bytes, then cache only after successful startup.
  const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
  try { await import(url); } finally { URL.revokeObjectURL(url); }
}

async function waitForStartup(global) {
  const startup = global.Liko.__PCMStartup__;
  if (!startup?.promise) throw new Error('PCM startup handshake missing');
  await startup.promise;
  if (startup.status !== 'ready' || !global.Liko.PCM || !global.Liko.PCMApi) {
    throw new Error('PCM initialization did not complete');
  }
}

function readCache(global) {
  try {
    const cached = JSON.parse(global.localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.schema !== 1 || !['module', 'classic'].includes(cached.format)) return null;
    validateCode(cached.code);
    return cached;
  } catch { return null; }
}

function writeCache(global, record) {
  try { global.localStorage.setItem(CACHE_KEY, JSON.stringify(record)); }
  catch (error) { console.warn('[PCM] 無法儲存備援快取：', error); }
}

// Execution/download parameters also allow deterministic failure-path regression tests.
export function startLoader({
  localBase = null,
  global = window,
  download = fetchText,
  executeModule = importCode,
  executeClassic = code => new Function(code)(),
} = {}) {
  if (isChangelogPage(global.location)) return Promise.resolve();
  global.Liko ??= {};
  const previous = global.Liko.__PCMLoader__;
  if (previous?.promise) return previous.promise;
  const loader = {promise: null};
  global.Liko.__PCMLoader__ = loader;

  loader.promise = Promise.resolve().then(async () => {
    if (localBase) global.LikoDevBase = new URL('Plugins/', localBase).href;
    const errors = [];
    if (global.Liko.__PCMStartup__?.status === 'starting' || global.Liko.__PCMStartup__?.status === 'ready') {
      try {
        await waitForStartup(global);
        return {format: 'existing'};
      } catch (error) { errors.push(error); }
    }
    // Do not replace a PCM installed independently by the user.
    if (global.Liko.PCM) return {format: 'existing'};
    const cached = localBase ? null : readCache(global);

    const execute = async (format, code) => {
      validateCode(code);
      const before = global.Liko.__PCMStartup__;
      await (format === 'module' ? executeModule(code) : executeClassic(code));
      if (global.Liko.__PCMStartup__ === before) throw new Error('PCM did not create a startup handshake');
      await waitForStartup(global);
    };

    for (const format of ['module', 'classic']) {
      for (const url of sourceUrls(PATHS[format], localBase)) {
        try {
          // Shared downloader: 45 s to first byte, 30 s without body progress.
          const {text: code} = await download(url, {cache: 'no-store'});
          await execute(format, code);
          if (!localBase) writeCache(global, {
            schema: 1, format, code, url, time: Date.now(), version: global.Liko.PCM,
          });
          console.log(`[PCM] ✅ ${localBase ? 'Local ' : ''}${format} PCM started`);
          return {format, url, cached: false};
        } catch (error) {
          errors.push(error);
          console.warn(`[PCM] ⚠️ ${url}:`, error);
        }
      }
    }

    if (cached) {
      try {
        await execute(cached.format, cached.code);
        console.log('[PCM] ✅ PCM started (cached fallback)');
        return {format: cached.format, url: cached.url, cached: true};
      } catch (error) { errors.push(error); }
    }
    throw new AggregateError(errors, 'PCM 載入失敗，無可用的備援版本');
  }).catch(error => {
    if (global.Liko.__PCMLoader__ === loader) delete global.Liko.__PCMLoader__;
    throw error;
  });
  // Keep direct userscript startup failures visible without unhandled rejections.
  loader.promise.catch(error => console.error('[PCM] ❌', error));
  return loader.promise;
}
