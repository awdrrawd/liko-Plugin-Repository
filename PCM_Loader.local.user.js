// ==UserScript==
// @name         Liko - PCM 載入器 - 本地測試
// @name:zh      Liko的插件管理器 - 本地測試
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1
// @description  本地測試載入器：設定 LikoDevBase 指向 localhost，再載入四個本體；引擎/擴充/字庫由各本體自行抓取
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @run-at       document-end
// ==/UserScript==

// ─────────────────────────────────────────────────────────────────────────────
//  用法：在 repo 根目錄執行：  node dev/serve-local.mjs
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    'use strict';
    const PORT = 5175;
    const BASE = `http://localhost:${PORT}/Plugins/`;
    window.LikoDevBase = BASE;   // ← 四個本體會讀這個覆寫依賴基底（引擎/擴充/字庫全走本地）

    const load = async (path) => {
        const res = await fetch(BASE + path + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
        const code = await res.text();
        if (code.trimStart().startsWith('<')) throw new Error(`${path} → 收到 HTML（伺服器有開嗎？）`);
        new Function(code)();
    };

    // 只載入本體；其餘依賴由本體自己抓（與正式環境載入路徑一致）
    const mains = [
        'main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js',
    ];

    try {
        for (const m of mains) { await load(m); }
        console.log('🐈‍⬛ [PCM local] ✅ 本地四個本體已載入，依賴由各本體自行抓取');
    } catch (e) {
        console.error('🐈‍⬛ [PCM local] ❌ 載入失敗（node dev/serve-local.mjs 有開嗎？）:', e.message);
    }
})();
