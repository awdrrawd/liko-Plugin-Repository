import {readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validate} from '../JSON-Editor/validation.js';
import {repositoryFile} from './lib/plugin-versions.mjs';

export function validateRepository(root = fileURLToPath(new URL('../', import.meta.url))) {
  const errors = [], ids = new Set();
  for (const name of ['manifest.json', 'external.json', 'meta.json', 'Translation-Tool/sites.json']) {
    const data = JSON.parse(readFileSync(`${root}/${name}`, 'utf8'));
    const invalid = validate(name.split('/').at(-1), data);
    errors.push(...invalid);
    if (invalid.length) continue;
    for (const item of data.addons || data.plugins || []) {
      if (ids.has(item.id)) errors.push(`${name}: duplicate plugin id ${item.id}`);
      ids.add(item.id);
      const sources = data.addons
        ? [...(Array.isArray(item.versions) ? item.versions.map(v => v?.source) : []), ...Object.values(item.mirror || {})]
        : [item.url, item.altUrl, item.mirrorUrl, item.altMirrorUrl];
      for (const source of sources) {
        const local = repositoryFile(source, root);
        if (!local) continue;
        try { if (!statSync(local).isFile()) throw new Error(); }
        catch { errors.push(`${name}: ${item.id} references missing repository file: ${source}`); }
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  validateRepository();
  console.log('Repository data and local plugin URLs are valid.');
}
