import {mkdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import * as release from '../src/pcm/release.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const common = {
  bundle: true, platform: 'browser', target: ['es2022'], charset: 'utf8',
  legalComments: 'none', sourcemap: false,
};
const notice = entry => '// AUTO-GENERATED from src/pcm/' + entry + ' by scripts/build-pcm.mjs. Do not edit directly.';
await mkdir(resolve(root, 'dist/pcm'), {recursive: true});
await build({
  ...common, entryPoints: [resolve(root, 'src/pcm/entry.js')],
  outfile: resolve(root, 'dist/pcm/PCM.js'), format: 'esm', minify: true,
  banner: {js: notice('entry.js')},
});

const definitions = JSON.parse(await readFile(resolve(root, 'src/pcm/userscripts.json'), 'utf8'));
for (const {entry, output, metadata} of definitions) {
  const header = metadata.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!release[key]) throw new Error('Unknown release variable: ' + key);
    return release[key];
  });
  await build({
    ...common, entryPoints: [resolve(root, 'src/pcm', entry)],
    outfile: resolve(root, output), format: 'iife', minify: false,
    banner: {js: header + '\n\n' + notice(entry)},
  });
  console.log('✅ PCM userscript built → ' + output);
}
console.log('✅ PCM module built → dist/pcm/PCM.js');
