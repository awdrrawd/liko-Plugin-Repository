// One-time migration. Run from the canonical repo; no Git commits or pushes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncI18n, targets } from './sync-i18n.mjs';

const canonical = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projects = ['BC-AFC', 'BC-FCM', 'BC-HSC', 'BC-LCE', 'BC-Responsive'];

async function edit(root, relative, change) {
  const path = resolve(root, relative);
  const before = await readFile(path, 'utf8');
  const after = change(before.replace(/\r\n/g, '\n'));
  if (after !== before.replace(/\r\n/g, '\n')) await writeFile(path, after);
}

export async function install(root) {
  root = resolve(root);
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const target = targets[pkg.name];
  if (!target) throw Error('Unsupported project: ' + root);
  await mkdir(resolve(root, '.github/workflows'), { recursive: true });
  await mkdir(resolve(root, 'scripts'), { recursive: true });
  for (const [from, to] of [
    ['scripts/sync-i18n.mjs', 'scripts/sync-i18n.mjs'],
    ['scripts/templates/sync-i18n.yml', '.github/workflows/sync-i18n.yml'],
    ['scripts/templates/check-i18n.yml', '.github/workflows/check-i18n.yml'],
  ]) await writeFile(resolve(root, to), await readFile(resolve(canonical, from)));

  pkg.scripts['sync:i18n'] = 'node scripts/sync-i18n.mjs';
  pkg.scripts['check:i18n'] = 'node scripts/sync-i18n.mjs --check';
  await writeFile(resolve(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  if (['bc-afc', 'bc-fcm', 'bc-hsc'].includes(pkg.name)) {
    // Imported upstream code must remain byte-for-byte identical, including its formatting.
    await edit(root, 'eslint.config.js', text => text.includes(`'${target}'`) ? text : text.replace('ignores: [', `ignores: ['${target}', `));
  }
  if (pkg.name === 'responsive-liko') {
    const ignore = resolve(root, '.prettierignore');
    let text = await readFile(ignore, 'utf8');
    for (const path of [target, 'scripts/sync-i18n.mjs']) {
      if (!text.split(/\r?\n/).includes(path)) text += `\n${path}\n`;
    }
    await writeFile(ignore, text);
    await edit(root, 'tests/security.test.js', text => text.replace("body.indexOf('fetch(_bust(url))')", "body.indexOf('return _load(')"));
  }
  if (pkg.name === 'bc-lce') {
    await edit(root, 'tests/security-patches.test.mjs', text => {
      text = text.replace('fetch: fetchImpl, Function:', 'fetch: fetchImpl, AbortController, Function:');
      if (!text.includes('rt.window.Liko =')) text = text.replace("    await rt.load('src/core/i18n-engine.js');", "    rt.window.Liko = { __Sys_Flags__: {} }; // Isolate script requests from flag image preloading.\n    await rt.load('src/core/i18n-engine.js');");
      return text;
    });
    await edit(root, 'src/core/i18n-registry.js', text => text
      .replace("import { LOG } from './constants.js';\n", '')
      .replace(/const API_VERSION = '[^']+';\n/, '')
      .replace(/    if \(engine.version !== API_VERSION\) \{\n[^\n]*\n    }\n/, ''));
  }
  if (pkg.name === 'bc-fcm') {
    await edit(root, 'scripts/i18n-language-change.test.mjs', text => text.includes('globalThis.Liko =') ? text : text.replace('globalThis.window = globalThis;', 'globalThis.window = globalThis;\nglobalThis.Liko = { __Sys_Flags__: {} }; // Language tests must not download flag images.'));
    await edit(root, 'src/i18n/i18n.js', text => text.replace('引擎依 URL 去重、自帶時間戳破快取。', '引擎共用載入中的 Promise，成功後沿用字庫。'));
  }
  if (pkg.name === 'bc-hsc') {
    await edit(root, 'src/core/core-init.js', text => text.includes("import '../expansion/BC_i18n.js';") ? text : "import '../expansion/BC_i18n.js';\n" + text);
    await edit(root, 'src/expansion/i18n.js', text => {
      text = text.replace("import './BC_i18n.js';\n", '').replace('    _i18nLoadScript,\n', '');
      if (!text.includes('function _i18nLoadScript(')) return text;
      const start = text.indexOf('    // 載入共用引擎腳本：');
      const end = text.indexOf('    async function ensureI18n()', start);
      if (start < 0 || end < 0) throw Error('HSC loader changed; inspect before migrating');
      text = text.slice(0, start) + text.slice(end);
      return text
        .replace('動態載入共用引擎 + HSC 字庫', '內建共用引擎 + 按需載入 HSC 字庫')
        .replace("import { assetUrl, cdnUrl } from '../util/icons.js';", "import { assetUrl } from '../util/icons.js';")
        .replace(/    \/\/ 共用引擎腳本：[\s\S]*?    const T_ENGINE = '[^']+';\n/, '    // 共用引擎隨插件打包；只有字庫按語言下載。\n')
        .replace(/            \/\/ 能力偵測：[^\n]*\n[^\n]*await _i18nLoadScript\(T_ENGINE\);\n/, '')
        .replace(/                \/\/ 語言檔同時註冊 UI 與 L10N[^\n]*\n[^\n]*\n/, '                // 每支語言檔同時註冊 UI 與 L10N，只需載入一次。\n')
        .replace(/^\s*await window\.Liko\?\.__Sys_L10N__\?\.ensure\(I18N_NS, urlMap, lang\);\n/gm, '');
    });
  }
  await syncI18n(root, { source: resolve(canonical, 'Plugins/expand/BC_i18n.js') });
  await syncI18n(root, { check: true });
  console.log('Installed manual i18n sync: ' + root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const parent = process.argv[2];
  if (!parent || process.argv.length !== 3) throw Error('Usage: node scripts/install-i18n-sync.mjs <parent-containing-five-repositories>');
  // Preflight all expected repositories before making changes to any of them.
  for (const name of projects) {
    const pkg = JSON.parse(await readFile(resolve(parent, name, 'package.json'), 'utf8'));
    if (!targets[pkg.name]) throw Error('Unexpected repository: ' + name);
  }
  for (const name of projects) await install(resolve(parent, name));
}
