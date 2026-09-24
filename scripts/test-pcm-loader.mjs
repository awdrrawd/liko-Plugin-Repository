import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {build} from 'esbuild';
import {pcmBrowser} from './helpers/pcm-browser.mjs';
import {PCM_VERSION} from '../src/pcm/release.js';
import {startLoader} from '../src/pcm/loader.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
const code = '/* bundled PCM __PCMStartup__ */';
const offline = async () => { throw new Error('offline'); };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

function fixture(t) {
  for (const level of ['log', 'warn', 'error']) t.mock.method(console, level, () => {});
  const storage = new Map();
  const global = {Liko: {}, localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  }};
  const executed = [];
  const execute = (text, pending = Promise.resolve()) => {
    executed.push(text);
    const startup = {status: 'starting', promise: null};
    global.Liko.__PCMStartup__ = startup;
    startup.promise = pending.then(() => {
      startup.status = 'ready';
      global.Liko.PCM = 'test';
      global.Liko.PCMApi = {version: 'test'};
    }, error => {
      startup.status = 'failed';
      delete global.Liko.PCM;
      delete global.Liko.PCMApi;
      throw error;
    });
  };
  const options = {global, download: async () => ({text: code}), executeModule: execute, executeClassic: execute};
  const seedCache = (format = 'module', text = code) => {
    const value = JSON.stringify({schema: 1, format, code: text, time: 123, version: 'old'});
    storage.set('pcm_main_cache', value);
    return value;
  };
  return {global, storage, executed, execute, options, seedCache};
}

test('waits for asynchronous readiness and caches the exact successfully executed module', async t => {
  const f = fixture(t), gate = deferred();
  const pending = startLoader({...f.options, executeModule: text => f.execute(text, gate.promise)});
  await flush();
  assert.equal(f.global.Liko.PCM, undefined);
  assert.equal(f.storage.size, 0);
  gate.resolve();
  assert.equal((await pending).format, 'module');
  const saved = JSON.parse(f.storage.get('pcm_main_cache'));
  assert.equal(saved.format, 'module');
  assert.equal(saved.code, f.executed[0]);
  assert.equal(saved.version, f.global.Liko.PCM);
});

test('async startup failure tries another source without replacing the good cache early', async t => {
  const f = fixture(t), failed = deferred(), recovery = deferred();
  const old = f.seedCache();
  let executions = 0;
  const pending = startLoader({...f.options, executeModule: text => {
    f.execute(text, ++executions === 1 ? failed.promise : recovery.promise);
  }});
  await flush(); failed.reject(new Error('SDK initialization failed')); await flush();
  assert.equal(executions, 2);
  assert.equal(f.storage.get('pcm_main_cache'), old);
  recovery.resolve();
  assert.match((await pending).url, /raw\.githubusercontent/);
});

test('failed module sources fall back to classic and wait for its readiness', async t => {
  const f = fixture(t), gate = deferred();
  let attempts = 0;
  const pending = startLoader({...f.options,
    executeModule: async () => { attempts++; throw new SyntaxError('bad module'); },
    executeClassic: text => f.execute(text, gate.promise),
  });
  await flush();
  assert.equal(attempts, 3);
  assert.equal(f.storage.size, 0);
  gate.resolve();
  assert.equal((await pending).format, 'classic');
  assert.equal(JSON.parse(f.storage.get('pcm_main_cache')).format, 'classic');
});

test('normal module success supplies cache rescue on the next all-offline startup', async t => {
  const f = fixture(t);
  await startLoader(f.options);
  const old = f.storage.get('pcm_main_cache');
  f.global.Liko = {};
  let requests = 0;
  const result = await startLoader({...f.options, download: async () => { requests++; return offline(); }});
  assert.equal(requests, 6);
  assert.equal(result.cached, true);
  assert.equal(result.format, 'module');
  assert.equal(f.storage.get('pcm_main_cache'), old);
  assert.equal(f.executed.length, 2);
});

test('downloaded JavaScript without a real startup signal cannot overwrite classic rescue', async t => {
  const f = fixture(t);
  const old = f.seedCache('classic', `${code} /* old */`);
  const result = await startLoader({...f.options,
    executeModule: () => {},
    executeClassic: text => { if (text.includes('old')) f.execute(text); },
  });
  assert.equal(result.cached, true);
  assert.equal(f.storage.get('pcm_main_cache'), old);
});

test('HTML, empty and pre-handshake releases are rejected before executing', async t => {
  const f = fixture(t);
  for (const text of ['  ', '<!DOCTYPE html>', 'window.Liko.PCM = "old";']) {
    await assert.rejects(startLoader({...f.options, download: async () => ({text})}), /無可用/);
    assert.equal(f.global.Liko.__PCMLoader__, undefined);
  }
  assert.equal(f.executed.length, 0);
  assert.equal(f.storage.size, 0);
});

test('cache storage failure does not restart a successfully initialized PCM', async t => {
  const f = fixture(t);
  f.global.localStorage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.equal((await startLoader(f.options)).cached, false);
  assert.equal(f.executed.length, 1);
});

test('simultaneous loader invocations share one download and one startup', async t => {
  const f = fixture(t), gate = deferred();
  const options = {...f.options, executeModule: text => f.execute(text, gate.promise)};
  const first = startLoader(options), second = startLoader(options);
  assert.equal(first, second);
  await flush(); assert.equal(f.executed.length, 1);
  gate.resolve(); await first;
});

test('a failed independent startup can still recover through the loader', async t => {
  const f = fixture(t), gate = deferred();
  f.execute(code, gate.promise);
  const pending = startLoader(f.options);
  await flush();
  gate.reject(new Error('independent start failed'));
  assert.equal((await pending).cached, false);
  assert.equal(f.executed.length, 2);
});

test('local loader uses local sources, waits for readiness and leaves production cache intact', async t => {
  const f = fixture(t), requested = [];
  const old = f.seedCache();
  const result = await startLoader({...f.options, localBase: 'http://localhost:5175/',
    download: async url => {
      requested.push(url);
      if (url.includes('/dist/')) throw new Error('module unavailable');
      return {text: code};
    },
  });
  assert.equal(result.format, 'classic');
  assert.equal(requested.length, 2);
  assert(requested.every(url => url.startsWith('http://localhost:5175/')));
  assert.equal(f.global.LikoDevBase, 'http://localhost:5175/Plugins/');
  assert.equal(f.storage.get('pcm_main_cache'), old);
});

test('all stalled first-byte downloads abort, advance sources and eventually reach cache', async t => {
  const f = fixture(t);
  f.seedCache();
  t.mock.timers.enable({apis: ['setTimeout']});
  const signals = [];
  t.mock.method(globalThis, 'fetch', (_url, {signal}) => new Promise((_, reject) => {
    signals.push(signal);
    signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  }));
  const {download, ...options} = f.options;
  const pending = startLoader(options);
  for (let i = 0; i < 6; i++) {
    await flush();
    assert.equal(signals.length, i + 1);
    t.mock.timers.tick(45000);
    await flush();
    assert.equal(signals[i].aborted, true);
  }
  assert.equal((await pending).cached, true);
});

test('body inactivity aborts the response and allows cache rescue', async t => {
  const f = fixture(t);
  f.seedCache();
  t.mock.timers.enable({apis: ['setTimeout']});
  let body, firstSignal, requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url, {signal}) => {
    if (++requests > 1) throw new Error('offline');
    firstSignal = signal;
    return new Response(new ReadableStream({start(controller) {
      body = controller;
      signal.addEventListener('abort', () => controller.error(signal.reason), {once: true});
    }}));
  });
  const {download, ...options} = f.options;
  const pending = startLoader(options);
  await flush();
  body.enqueue(new TextEncoder().encode('/* first bytes'));
  await flush();
  t.mock.timers.tick(30000);
  assert.equal((await pending).cached, true);
  assert.equal(firstSignal.aborted, true);
});


const coreBuild = await build({
  stdin: {contents: "export {startPCM} from './src/pcm/compat/core.js';", resolveDir: process.cwd()},
  bundle: true, write: false, format: 'iife', globalName: 'PCMTest', target: ['es2022'],
});
const realCore = coreBuild.outputFiles[0].text;

test('real core waits for DOM/UI, cleans failed SDK registration and can restart', async t => {
  fixture(t);
  const browser = pcmBrowser({failStyles: true});
  t.after(() => browser.stop());
  vm.runInContext(realCore, browser.context);
  const start = browser.context.PCMTest.startPCM;
  const first = start();
  const failure = assert.rejects(first, /UI failed/);
  assert.equal(first, start(), 'concurrent starts share the actual core promise');
  await flush();
  assert.equal(browser.registered, 1);
  assert.equal(browser.context.Liko.PCM, undefined);
  browser.ready(); await failure;
  assert.equal(browser.context.Liko.__PCMStartup__.status, 'failed');
  assert.equal(browser.unloaded, 1);
  assert.equal(browser.windowListeners.size, 0);
  assert.equal(browser.timers.size, 0);
  assert.equal(browser.intervals.size, 0);
  browser.failStyles = false;
  await start(); await flush();
  assert.equal(browser.context.Liko.PCM, PCM_VERSION);
  assert.equal(browser.context.Liko.__PCMStartup__.status, 'ready');
  assert.equal(browser.registered, 2);
  assert.equal(browser.dictionaries.get('PCM').hideMainHall.TW, '大廳');
  assert.equal(browser.dictionaries.get('PCM').hideMainHall.EN, 'Main hall');
  assert(browser.requests.every(url => !url.includes('PCM-i18n')));
});

test('real production dependency loader rejects missing SDK before reporting ready', async t => {
  fixture(t);
  const browser = pcmBrowser({loading: false});
  delete browser.context.bcModSdk;
  browser.context.fetch = offline;
  vm.runInContext(realCore, browser.context);
  await assert.rejects(browser.context.PCMTest.startPCM());
  assert.equal(browser.context.Liko.PCM, undefined);
  assert.equal(browser.context.Liko.__PCMStartup__.status, 'failed');
  assert.equal(browser.windowListeners.size, 0);
  assert.equal(browser.timers.size, 0);
});

for (const filename of ['PCM_Loader.user.js', 'PCM_Loader.local.user.js']) {
  test(filename + ': generated loader starts the unmodified generated classic core', async t => {
    fixture(t);
    const browser = pcmBrowser();
    t.after(() => browser.stop());
    const loader = await readFile(filename, 'utf8');
    const core = await readFile('Plugins/main/Liko - Plugin Collection Manager.main.user.js', 'utf8');
    const originalFetch = browser.context.fetch;
    let sourceRequests = 0;
    browser.context.fetch = async url => {
      if (url.includes('/dist/')) { sourceRequests++; throw new Error('module unavailable'); }
      if (url.includes('Collection%20Manager.main.user.js')) { sourceRequests++; return new Response(core); }
      return originalFetch(url);
    };
    vm.runInContext(loader, browser.context);
    const pending = browser.context.Liko.__PCMLoader__.promise;
    await flush();
    assert.equal(browser.context.Liko.PCM, undefined);
    assert.equal(browser.storage.has('pcm_main_cache'), false);
    browser.ready();
    assert.equal((await pending).format, 'classic');
    assert.equal(browser.context.Liko.PCM, PCM_VERSION);
    assert.equal(browser.dictionaries.get('PCM').hideMainHall.TW, '大廳');
    assert.equal(sourceRequests, filename.includes('.local.') ? 2 : 4);
    if (filename.includes('.local.')) assert.equal(browser.storage.has('pcm_main_cache'), false);
    else assert.equal(JSON.parse(browser.storage.get('pcm_main_cache')).code, core);
  });
}
