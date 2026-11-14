// Explicit local synchronization; normal builds never invoke this script.
import { syncI18n } from './sync-i18n.mjs';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../Plugins/expand/BC_i18n.js', import.meta.url));
for (const name of ['BC-AFC', 'BC-FCM', 'BC-HSC', 'BC-LCE', 'BC-Responsive']) {
  const root = fileURLToPath(new URL('../../' + name + '/', import.meta.url));
  await syncI18n(root, { source, check: process.argv.includes('--check') });
  console.log(name + ': i18n synchronized');
}
