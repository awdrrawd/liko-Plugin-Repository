import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../JSON-Editor/validation.js';
import {withLocalVersion} from './lib/plugin-versions.mjs';
import {fileURLToPath} from 'node:url';

const addon = () => ({id: 'example', name: {en: 'Example'}, versions: [{source: 'https://example.test/plugin.js'}]});
test('authored validation includes skipped addons and rejects invalid types and string flags', () => {
  assert.deepEqual(validate('manifest.json', {addons: [addon()]}), []);
  const errors = validate('manifest.json', {addons: [{...addon(), type: 'typo', pcmskip: 'true'}]});
  assert(errors.some(error => error.includes('.type')));
  assert(errors.some(error => error.includes('.pcmskip')));
  assert(validate('manifest.json', {addons: [{...addon(), pcmskip: true, versions: []}]}).length);
});
test('authored validation handles malformed records and duplicate identifiers', () => {
  for (const value of [null, [], 'bad']) assert(validate('manifest.json', value).length);
  assert(validate('manifest.json', {addons: [null]}).length);
  assert(validate('manifest.json', {addons: [addon(), addon()]}).some(error => error.includes('重複')));
  assert(validate('manifest.json', {addons: [{...addon(), versions: [null]}]}).length);
  assert(validate('external.json', {addons: [], plugins: []}).length);
});
test('metadata and sites reject malformed data and unsafe URLs', () => {
  assert(validate('meta.json', {updateId: '1', changelog: {cn: [], en: [2]}}).length);
  assert(validate('sites.json', {defaultSite: 'missing', sites: []}).length);
  assert(validate('sites.json', {sites: [{id: 'a', name: 'A', url: 'javascript:alert(1)'}]}).length);
  assert.deepEqual(validate('external.json', {plugins: [{id: 'a', name: 'A', url: 'https://example.test/a.js'}]}), []);
});
test('missing local plugin fails instead of retaining a stale version', () => {
  assert.throws(() => withLocalVersion({url: 'https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/nonexistent-test-plugin.js', version: 'old'}, fileURLToPath(new URL('../', import.meta.url))), /Missing repository plugin/);
});
