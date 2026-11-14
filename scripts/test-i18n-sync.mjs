import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const testBase = fileURLToPath(new URL('../', import.meta.url));
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { syncI18n, targets } from './sync-i18n.mjs';

test('manual sync validates before writing, records the copy, and checks offline without pinning a version', async () => {
  const root = await mkdtemp(resolve(testBase, '.i18n-test-'));
  const engine = await readFile(new URL('../Plugins/expand/BC_i18n.js', import.meta.url), 'utf8');
  const source = resolve(root, 'upstream.js');
  const nativeFetch = globalThis.fetch;
  try {
    await writeFile(source, engine);
    globalThis.fetch = () => { throw Error('offline check must not fetch'); };
    for (const [name, target] of Object.entries(targets)) {
      const project = resolve(root, name);
      await mkdir(resolve(project, dirname(target)), { recursive: true });
      await mkdir(resolve(project, 'scripts'));
      await writeFile(resolve(project, 'package.json'), JSON.stringify({ name }));
      await writeFile(resolve(project, target), 'previous copy');
      assert.equal(await syncI18n(project, { source }), true);
      assert.equal(await syncI18n(project, { source }), false);
      assert.equal(await syncI18n(project, { check: true }), false);
      const before = await readFile(resolve(project, target), 'utf8');
      await writeFile(source, '<html>upstream unavailable</html>');
      await assert.rejects(syncI18n(project, { source }), /Invalid i18n/);
      assert.equal(await readFile(resolve(project, target), 'utf8'), before);
      await writeFile(resolve(project, target), before + '\n// local fork');
      await assert.rejects(syncI18n(project, { check: true }), /differs/);
      await writeFile(source, engine);
      await syncI18n(project, { source });
      await syncI18n(project, { check: true });
    }
  } finally {
    globalThis.fetch = nativeFetch;
    const rel = relative(testBase, root);
    assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel));
    await rm(root, { recursive: true, force: true });
  }
});
