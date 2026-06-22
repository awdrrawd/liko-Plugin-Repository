import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPO_RAW_PREFIX = 'https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/';
const JSON_PATH = 'Plugins.json';

const data = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
let changed = false;

function extractVersion(filePath) {
  if (!existsSync(filePath)) return null;
  const src = readFileSync(filePath, 'utf8');
  // 抓檔頭的 // @version 1.2.3
  const m = src.match(/^\/\/\s*@version\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

for (const p of data.plugins) {
  const url = p.url || '';
  if (!url.startsWith(REPO_RAW_PREFIX)) continue;                     // 外部插件：跳過（方案 A）
  const rel = decodeURIComponent(url.slice(REPO_RAW_PREFIX.length));  // → Plugins/main/Liko - CPB.main.user.js
  const ver = extractVersion(rel);
  if (!ver) { console.warn(`⚠️ 找不到版本: ${p.id} -> ${rel}`); continue; }
  if (p.version !== ver) {
    console.log(`🔄 ${p.id}: ${p.version ?? '(無)'} -> ${ver}`);
    p.version = ver;
    changed = true;
  }
}

if (changed) {
  writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('✅ Plugins.json 已更新');
} else {
  console.log('ℹ️ 無變更');
}
