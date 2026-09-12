// Run explicitly from the canonical repository to synchronize deployment copies.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const engine = await readFile(new URL('Plugins/expand/BC_i18n.js', root), 'utf8');
const flagsStart = engine.indexOf('    function installFlags()');
const flagsEnd = engine.indexOf('    // 語言偵測：', flagsStart);
const normalizeStart = engine.indexOf('    function normalizeLang(');
const normalizeEnd = engine.indexOf('    function detectLang(', normalizeStart);
if ([flagsStart, flagsEnd, normalizeStart, normalizeEnd].some(i => i < 0)) throw new Error('Engine extraction markers changed');
const flagsOnly = '// Generated from liko-Plugin-Repository/Plugins/expand/BC_i18n.js; do not edit.\n// flag-icons 7.3.2, MIT: https://github.com/lipis/flag-icons/blob/v7.3.2/LICENSE\n(function () {\n    if (typeof window === "undefined") return;\n    window.Liko ??= {};\n' + engine.slice(flagsStart, flagsEnd) + engine.slice(normalizeStart, normalizeEnd) + '    installFlags();\n})();\n';
const copies = [
  ['../BC-AFC/src/i18n/engine.js', engine],
  ['../BC-FCM/src/i18n/i18n-engine.js', engine],
  ['../BC-HSC/src/expansion/BC_i18n.js', engine],
  ['../BC-LCE/src/core/i18n-engine.js', engine],
  ['../BC-Responsive/src/core/i18n-engine.js', engine],
  ['../BC-AEE/src/i18n/flags-engine.js', flagsOnly],
];
for (const [path, content] of copies) {
  const target = new URL(path, root);
  if (process.argv.includes('--check')) {
    const current = await readFile(target, 'utf8');
    if (current.replace(/\r\n/g, '\n') !== content.replace(/\r\n/g, '\n')) throw new Error(`Outdated copy: ${path}`);
  } else await writeFile(target, content);
  console.log(fileURLToPath(target));
}
