import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = resolve(root, 'dist', 'pcm', 'PCM.js');

await mkdir(dirname(outfile), {recursive: true});
await build({
  entryPoints: [resolve(root, 'src', 'pcm', 'entry.js')],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  charset: 'utf8',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  banner: {
    js: '// AUTO-GENERATED from src/pcm by scripts/build-pcm.mjs. Do not edit directly.',
  },
});

console.log('✅ PCM bundle built → dist/pcm/PCM.js');

// The fallback userscript uses the same network implementation without ESM imports.
const helper = await build({
  stdin: {contents: "export {fetchText} from './network.js'; export {downloads} from './download-queue.js';", resolveDir: resolve(root, 'src/pcm')},
  bundle: true, write: false, format: 'iife', globalName: '__pcmDownloads',
  platform: 'browser', target: ['es2022'], minify: true, legalComments: 'none',
});
const legacyPath = resolve(root, 'Plugins/main/Liko - Plugin Collection Manager.main.user.js');
const legacy = await readFile(legacyPath, 'utf8');
const region = /\/\/ BEGIN GENERATED DOWNLOAD HELPERS[\s\S]*?\/\/ END GENERATED DOWNLOAD HELPERS/;
if (!region.test(legacy)) throw new Error('Legacy download helper markers missing');
await writeFile(legacyPath, legacy.replace(region, () => `// BEGIN GENERATED DOWNLOAD HELPERS\n${helper.outputFiles[0].text}\n    // END GENERATED DOWNLOAD HELPERS`));
