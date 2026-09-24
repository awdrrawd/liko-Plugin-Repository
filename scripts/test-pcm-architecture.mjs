import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import vm from 'node:vm';
import {Lifecycle} from '../src/pcm/lifecycle.js';
import {PCM_STRINGS} from '../src/pcm/i18n/PCM-i18n.js';
import {registerPCMTranslations, translatePCM} from '../src/pcm/i18n/index.js';
import {normalizeManifest} from '../src/pcm/manifest.js';
import {repositoryFile, withLocalVersion} from './lib/plugin-versions.mjs';
import * as release from '../src/pcm/release.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('lifecycle releases completed timers, cancels pending work and settles sleepers on disposal', async t => {
  t.mock.timers.enable({apis: ['setTimeout', 'setInterval']});
  const life = new Lifecycle(), events = new EventTarget();
  const calls = [];
  life.add(() => calls.push('first cleanup'));
  life.add(() => calls.push('last cleanup'));
  life.listen(events, 'test', () => calls.push('event'));
  life.timeout(() => calls.push('timeout'), 10);
  life.interval(() => calls.push('interval'), 20);
  t.mock.timers.tick(10);
  assert.equal(life.timeouts.size, 0);
  const sleep = life.sleep(100);
  const cancelled = life.timeout(() => calls.push('cancelled'), 100);
  life.clearTimeout(cancelled);
  events.dispatchEvent(new Event('test'));
  life.dispose();
  assert.equal(await sleep, false);
  events.dispatchEvent(new Event('test'));
  t.mock.timers.tick(200);
  assert.deepEqual(calls, ['timeout', 'event', 'last cleanup', 'first cleanup']);
  assert.equal(life.timeouts.size + life.intervals.size + life.cleanups.size, 0);
  life.timeout(() => assert.fail('disposed callback'), 1);
  life.dispose();
  assert.equal(await life.sleep(100), false);
});

test('one dictionary supplies every English fallback, placeholders and delayed registration', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  for (const [key, languages] of Object.entries(PCM_STRINGS)) {
    assert.equal(typeof languages.EN, 'string', key);
    const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const [language, text] of Object.entries(languages)) {
      assert.deepEqual(placeholders(text), placeholders(languages.EN), `${key}.${language}`);
    }
  }
  const global = {Liko: {}}, lifecycle = new Lifecycle();
  assert.equal(translatePCM('hideMainHall', {}, 'TW', global), '大廳');
  assert.equal(translatePCM('loaded', {ver: 'test'}, 'TW', global).includes('vtest'), true);
  assert.equal(registerPCMTranslations({global, lifecycle}), false);
  let registered;
  global.Liko.__Sys_i18n__ = {register: (namespace, data) => { registered = {namespace, data}; }};
  t.mock.timers.tick(100);
  assert.equal(registered.namespace, 'PCM');
  assert.equal(registered.data, PCM_STRINGS);
  assert.equal(lifecycle.timeouts.size, 0);
  lifecycle.dispose();
});

test('local versions resolve consistently across Pages/raw/CDN and reject foreign or escaping URLs', () => {
  const rel = 'Plugins/main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js';
  const urls = [
    `https://awdrrawd.github.io/liko-Plugin-Repository/${rel}?v=1`,
    `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/${rel}`,
    `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/${rel}`,
  ];
  for (const url of urls) assert.equal(withLocalVersion({url, version: 'old'}, root).version, release.PCM_VERSION);
  for (const url of [
    'https://other.github.io/liko-Plugin-Repository/plugin.js',
    'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/other/plugin.js',
    'https://awdrrawd.github.io/liko-Plugin-Repository/%2e%2e%2fsecret.js',
    'https://awdrrawd.github.io/liko-Plugin-Repository/%2e%2e%5csecret.js',
  ]) assert.equal(repositoryFile(url, root), null, url);
  assert.equal(withLocalVersion({url: 'https://example.test/plugin.js', version: 'external'}, root).version, 'external');
});

test('catalog and runtime share validation rules and generated versions match local files', async () => {
  const catalog = JSON.parse(await readFile(new URL('../Plugins.json', import.meta.url), 'utf8'));
  const warnings = [];
  const normalized = normalizeManifest(catalog, reason => warnings.push(reason));
  assert.deepEqual(warnings, []);
  assert.equal(normalized.plugins.length, catalog.plugins.length);
  assert.equal(catalog.version, release.PCM_VERSION);
  for (const plugin of catalog.plugins) assert.equal(withLocalVersion(plugin, root).version, plugin.version, plugin.id);
  for (const type of [false, 'invalid', 12]) {
    assert.equal(normalizeManifest({plugins: [{id: 'example', name: 'Example', url: 'https://example.test/a.js', type}]}), null);
  }
});

test('both release formats bundle the same production core, translations and services', async () => {
  const inputs = [];
  for (const entry of ['entry.js', 'classic-entry.js']) {
    const result = await build({entryPoints: [`src/pcm/${entry}`], bundle: true, write: false,
      metafile: true, format: entry === 'entry.js' ? 'esm' : 'iife', target: ['es2022']});
    const files = Object.keys(result.metafile.inputs).filter(path => path !== `src/pcm/${entry}`).sort();
    for (const path of ['compat/core.js', 'dependencies.js', 'lifecycle.js', 'manifest.js', 'i18n/PCM-i18n.js']) {
      assert(files.includes(`src/pcm/${path}`));
    }
    assert(files.every(path => !path.includes('/experimental/')));
    assert(!result.outputFiles[0].text.includes('Translation/PCM-i18n.js'));
    inputs.push(files);
  }
  assert.deepEqual(inputs[0], inputs[1]);
  await assert.rejects(access(new URL('../Plugins/Translation/PCM-i18n.js', import.meta.url)), {code: 'ENOENT'});
});

test('userscript metadata and generated README use the canonical release versions', async () => {
  const definitions = JSON.parse(await readFile(new URL('../src/pcm/userscripts.json', import.meta.url), 'utf8'));
  for (const definition of definitions) {
    const output = await readFile(new URL(`../${definition.output}`, import.meta.url), 'utf8');
    const header = definition.metadata.replace(/\{\{(\w+)\}\}/g, (_, key) => release[key]);
    assert.equal(output.replaceAll('\r\n', '\n').startsWith(header), true, definition.output);
  }
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert(readme.includes(`PCM-v${release.PCM_VERSION}-`));
});

test('retained prototypes still resolve their imports without entering production builds', async () => {
  await build({entryPoints: ['src/pcm/experimental/app.js'], bundle: true, write: false, format: 'esm', target: ['es2022']});
});

test('Translation Studio reads the sole ESM dictionary and still reads deployed plugin dictionaries', async () => {
  const html = await readFile(new URL('../Translation-Tool/index.html', import.meta.url), 'utf8');
  const parser = html.slice(html.indexOf('    function parseTranslationFile('), html.indexOf('    function getLanguages('));
  const context = vm.createContext({state: {namespace: 'test'}});
  vm.runInContext(parser, context);
  const pcm = context.parseTranslationFile('PCM-i18n.js', await readFile(new URL('../src/pcm/i18n/PCM-i18n.js', import.meta.url), 'utf8'));
  assert.equal(pcm.namespace, 'PCM');
  assert.equal(JSON.stringify(pcm.entries), JSON.stringify(PCM_STRINGS));
  const existing = context.parseTranslationFile('DDT-i18n.js', await readFile(new URL('../Plugins/Translation/DDT-i18n.js', import.meta.url), 'utf8'));
  assert.equal(existing.namespace, 'DDT');
  assert(Object.keys(existing.entries).length > 0);
});
