import {mkdtempSync, cpSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {artifacts} from './lib/artifacts.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(resolve(tmpdir(), 'liko-clean-build-'));
const within = (base, path) => {
  const rel = relative(base, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Unsafe path: ${path}`);
};
try {
  // Copy only build inputs. Existing generated files cannot mask missing inputs.
  for (const name of ['src', 'scripts', 'Plugins', 'JSON-Editor', 'Translation-Tool', 'manifest.json', 'external.json', 'meta.json', 'package.json', 'node_modules']) {
    cpSync(resolve(root, name), resolve(temp, name), {recursive: true});
  }
  for (const name of artifacts) {
    const path = resolve(temp, name);
    within(temp, path);
    rmSync(path, {force: true});
  }
  const build = () => {
    const result = spawnSync(process.execPath, ['scripts/build-all.mjs'], {cwd: temp, stdio: 'inherit', timeout: 120_000});
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Clean build failed');
  };
  build();
  const first = artifacts.map(name => readFileSync(resolve(temp, name)));
  build();
  artifacts.forEach((name, i) => assert.deepEqual(readFileSync(resolve(temp, name)), first[i], `Non-deterministic artifact: ${name}`));
  console.log('Clean build and repeated build produce identical artifacts.');
} finally {
  within(tmpdir(), temp);
  rmSync(temp, {recursive: true, force: true});
}
