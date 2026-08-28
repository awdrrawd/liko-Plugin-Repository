// Publish the modular PCM source tree without bundling. Native ES module paths
// are preserved so GitHub Pages, raw GitHub and jsDelivr can serve the output.
import {cpSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'src', 'pcm');
const output = join(root, 'Plugins', 'main', 'PCM');

rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
cpSync(source, output, {recursive: true});

const files = [];
function collect(directory) {
  for (const entry of readdirSync(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else files.push(relative(root, path).replaceAll('\\', '/'));
  }
}
collect(output);
console.log(`✅ PCM modules published — ${files.length} files`);
for (const file of files) console.log(`  ${file}`);
