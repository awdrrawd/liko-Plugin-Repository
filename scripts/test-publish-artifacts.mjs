import test from 'node:test';
import assert from 'node:assert/strict';
import {publishArtifacts} from './publish-artifacts.mjs';
import {artifacts} from './lib/artifacts.mjs';

function fixture({advanced = false, changed = true, race = false, denied = false} = {}) {
  const calls = [];
  let pushed = false;
  return {calls, git: (...args) => {
    calls.push(args);
    if (args[0] === 'rev-parse') return args[1] === 'origin/main' && (advanced || (race && pushed)) ? 'new-source' : 'source';
    if (args[0] === 'status') return changed ? ' M Plugins.json' : '';
    if (args[0] === 'push') {
      pushed = true;
      if (race || denied) throw new Error('push rejected');
    }
    return '';
  }};
}
test('publication skips stale builds and unchanged artifacts without committing', () => {
  for (const options of [{advanced: true}, {changed: false}]) {
    const f = fixture(options);
    publishArtifacts(f.git);
    assert(!f.calls.some(args => ['add', 'commit', 'push'].includes(args[0])));
  }
});
test('publication stages only declared artifacts and never forces a push', () => {
  const f = fixture();
  assert.match(publishArtifacts(f.git), /published/);
  assert.deepEqual(f.calls.find(args => args[0] === 'add'), ['add', '--', ...artifacts]);
  assert.deepEqual(f.calls.find(args => args[0] === 'push'), ['push', 'origin', 'HEAD:main']);
});
test('publication tolerates newer pushes but still fails on write permission errors', () => {
  assert.match(publishArtifacts(fixture({race: true}).git), /advanced during/);
  assert.throws(() => publishArtifacts(fixture({denied: true}).git), /push rejected/);
});
