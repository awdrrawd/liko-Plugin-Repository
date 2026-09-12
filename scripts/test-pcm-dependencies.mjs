import assert from 'node:assert/strict';
import {DependencyLoader} from '../src/pcm/dependencies.js';

const global = {
  bcModSdk: {registerMod() {}},
  Liko: {
    __Sys_i18n__: {ensure() {}},
    __Sys_L10N__: {localize() {}},
    __Sys_Toast__: {}, __Sys_ColorAPI__: {}, __Sys_ChatRoomButtons__: {},
  },
};
const loader = new DependencyLoader({global, documentRef: {}});
let calls = 0;
loader.load = async path => {
  assert.equal(path, 'expand/BC_i18n.js');
  calls++;
  global.Liko.__Sys_Flags__ = {ensure() {}, renderLabel() {}};
};
await Promise.all([loader.ensureCore(), loader.ensureCore()]);
assert.equal(calls, 1, 'old i18n without flags reloads once across simultaneous callers');
await loader.ensureCore();
assert.equal(calls, 1, 'complete services need no additional download');
delete global.Liko.__Sys_Flags__;
await loader.ensureCore();
assert.equal(calls, 2, 'a past successful promise must not mask a missing service');
delete global.Liko.__Sys_Flags__.renderLabel;
await loader.ensureCore();
assert.equal(calls, 3, 'flag downloading alone does not satisfy the SVG label API');

let available = false;
let attempts = 0;
loader.load = async () => { attempts++; if (attempts === 1) throw new Error('offline'); available = true; };
const request = {name: 'retry', relativePath: 'retry.js', ready: () => available};
await assert.rejects(loader.ensure(request), /offline/);
await loader.ensure(request);
assert.equal(attempts, 2, 'failed download permits a later retry');
console.log('PCM dependency tests passed: service readiness, concurrent deduplication, reload and retry.');
