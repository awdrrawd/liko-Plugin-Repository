// 本地測試用的零依賴靜態伺服器（帶 CORS）。
// 用法：在 repo 根目錄執行  node dev/serve-local.mjs   （預設 port 5175）
// 然後在 Tampermonkey 安裝 PCM_Loader.local.user.js、停用正式 PCM loader，重整 BC。
//
// 為何需要它：BC 是 HTTPS 頁面，會跨來源 fetch 到 http://localhost（Chrome 視 localhost 為安全來源），
// 但一定要回 CORS 標頭，否則瀏覽器會擋掉。python -m http.server 不帶 CORS，故用這支。

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..')); // repo 根
const PORT = Number(process.env.PORT) || 5175;

const TYPES = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
};

http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    try {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
        const path = normalize(join(ROOT, rel));
        // 防目錄穿越：解析後必須仍在 ROOT 底下
        if (path !== ROOT && !path.startsWith(ROOT + sep)) { res.statusCode = 403; return res.end('403'); }
        const data = await readFile(path);
        res.setHeader('Content-Type', TYPES[extname(path).toLowerCase()] || 'application/octet-stream');
        res.end(data);
    } catch (e) {
        res.statusCode = 404;
        res.end('404 Not Found: ' + req.url);
    }
}).listen(PORT, () => {
    console.log(`🐈‍⬛ [dev server] serving  ${ROOT}`);
    console.log(`🐈‍⬛ [dev server] at       http://localhost:${PORT}/  (CORS on, no-store)`);
    console.log(`🐈‍⬛ [dev server] loader   → 安裝 PCM_Loader.local.user.js 後重整 BC`);
});
