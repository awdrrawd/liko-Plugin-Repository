// Shared maintenance tool. Run explicitly; builds never download an engine.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';

export const sourceUrl = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/BC_i18n.js';
export const targets = {
  'bc-afc': 'src/i18n/engine.js',
  'bc-fcm': 'src/i18n/i18n-engine.js',
  'bc-hsc': 'src/expansion/BC_i18n.js',
  'bc-lce': 'src/core/i18n-engine.js',
  'responsive-liko': 'src/core/i18n-engine.js',
};
const normalize = text => text.replace(/\r\n/g, '\n');
const hash = text => createHash('sha256').update(normalize(text)).digest('hex');

export function validateEngine(text) {
  if (Buffer.byteLength(text) > 1024 * 1024 || !text.includes('// ==UserScript==')) throw Error('Invalid i18n source');
  const script = new vm.Script(text, { filename: 'BC_i18n.js' });
  const context = vm.createContext({
    window: { Liko: { __Sys_Flags__: {} } }, document: {},
    console: { log() {}, warn() {} },
  });
  script.runInContext(context, { timeout: 1000 });
  const engine = context.window.Liko.__Sys_i18n__;
  if (!engine?.ensure || !engine?.refreshLanguage || !context.window.Liko.__Sys_L10N__?.localize) throw Error('Incomplete i18n API');
  return engine.version;
}

async function atomicWrite(path, text) {
  const temp = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temp, text, { flag: 'wx' });
    await rename(temp, path);
  } finally { await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export async function syncI18n(root, { check = false, source } = {}) {
  root = resolve(root);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const target = targets[pkg.name];
  if (!target) throw Error('Unsupported project: ' + pkg.name);
  const path = resolve(root, target);
  const recordPath = resolve(root, 'scripts/i18n-source.json');
  const current = normalize(await readFile(path, 'utf8'));
  if (check) {
    const record = JSON.parse(await readFile(recordPath, 'utf8'));
    if (record.source !== sourceUrl || record.target !== target || record.sha256 !== hash(current)) {
      throw Error('i18n copy differs from its last manual sync; run npm run sync:i18n');
    }
    validateEngine(current);
    return false;
  }
  let text;
  if (source) text = await readFile(resolve(source), 'utf8');
  else {
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000), cache: 'no-cache' });
    if (!response.ok) throw Error('i18n download: HTTP ' + response.status);
    text = await response.text();
  }
  text = normalize(text);
  const version = validateEngine(text);
  // Validate everything before replacing the working copy; failed downloads preserve it.
  if (text !== current) await atomicWrite(path, text);
  await atomicWrite(recordPath, JSON.stringify({ source: sourceUrl, target, version, sha256: hash(text) }, null, 2) + '\n');
  return text !== current;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw Error('Usage: node scripts/sync-i18n.mjs [--check]');
  const changed = await syncI18n(resolve(dirname(fileURLToPath(import.meta.url)), '..'), { check: args.includes('--check') });
  console.log(args.includes('--check') ? 'i18n local copy verified (offline).' : changed ? 'i18n updated from main.' : 'i18n already current.');
}
