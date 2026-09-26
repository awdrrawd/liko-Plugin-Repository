import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {isChangelogPage} from '../src/pcm/page-policy.js';
import {startLoader} from '../src/pcm/loader.js';

test('changelog exclusion follows the document path across release directories', () => {
  for (const path of ['/changelog.html', '/R123/changelog.html?v=2#latest', '/R123/Changelog.HTML']) {
    assert(isChangelogPage(new URL(path, 'https://game.test')));
  }
  for (const path of ['/R123/', '/R123/index.html?next=changelog.html', '/R123/index.html#changelog.html', '/R123/changelog.html.js']) {
    assert.equal(isChangelogPage(new URL(path, 'https://game.test')), false);
  }
});

test('both loader modes stop before namespace creation, storage or downloads', async () => {
  for (const localBase of [null, 'http://localhost:5175/']) {
    const global = {location: new URL('https://game.test/R123/changelog.html')};
    Object.defineProperty(global, 'localStorage', {get() { assert.fail('storage accessed'); }});
    await startLoader({global, localBase, download() { assert.fail('download started'); }});
    assert.equal(global.Liko, undefined);
  }
});

test('generated loaders and both core entry formats do nothing on changelog pages', async () => {
  const scripts = await Promise.all(['PCM_Loader.user.js', 'PCM_Loader.local.user.js', 'Plugins/main/Liko - Plugin Collection Manager.main.user.js'].map(path => readFile(path, 'utf8')));
  // Bundle the ESM entry as an async wrapper for the VM while retaining its real imports.
  const module = await build({entryPoints: ['src/pcm/entry.js'], bundle: true, write: false, format: 'esm'});
  scripts.push(`(async () => {${module.outputFiles[0].text}\n})()`);
  for (const script of scripts) {
    const window = {location: new URL('https://game.test/R123/changelog.html?v=1#changes')};
    const context = vm.createContext({window, URL, console});
    // No DOM, fetch, storage or timers are supplied: touching any would fail.
    await vm.runInContext(script, context);
    assert.equal(window.Liko, undefined);
  }
});
