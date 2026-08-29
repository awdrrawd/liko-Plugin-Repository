import {mkdir} from 'node:fs/promises';
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
