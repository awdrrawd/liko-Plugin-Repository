import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const browserTests = ['test-media.cjs', 'test-tool-ui.cjs', 'test-json-editor.cjs'];
const browser = process.argv.includes('--browser');
const files = readdirSync(new URL('./', import.meta.url)).filter(name =>
  /^test-.*\.(cjs|mjs)$/.test(name) && browserTests.includes(name) === browser
).sort().map(name => `scripts/${name}`);
if (!files.length) throw new Error('No tests found');
const result = spawnSync(process.execPath, ['--test', ...files], {cwd: root, stdio: 'inherit', timeout: 300_000});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
