// ==UserScript==
// @name         Liko - PCM 本地測試載入器
// @name:zh      Liko的插件管理器 - 本地測試
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1
// @description  本地測試載入器：設定 LikoDevBase 指向 localhost，再載入四個本體；引擎/擴充/字庫由各本體自行抓取
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// ==/UserScript==

// ─────────────────────────────────────────────────────────────────────────────
//  用法：
//   1. 在 repo 根目錄執行：  node dev/serve-local.mjs      （帶 CORS，port 5175）
//   2. Tampermonkey 安裝本檔，並「停用」正式的 PCM_Loader.user.js（避免兩份同時載入）
//   3. 重整 BC 分頁
//
//  設計：本檔只設 window.LikoDevBase = http://localhost:5175/…/Plugins/ 並載入「四個本體」。
//  引擎(BC_i18n.js)/擴充(toast、ColorAPI)/字庫(XXX-i18n.js) 由各本體內部依 LikoDevBase 自行抓取，
//  路徑以本體內為準 —— 之後這些檔案改名也不必再更新本 loader（不會像寫死清單那樣壞掉）。
//
//  改完任何檔案存檔後，重整 BC 即可（伺服器 no-store + ?t= 時間戳確保拿到最新版）。
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
        'main/Liko%20-%20MAT.main.user.js',
        'main/Liko%20-%20MPL.main.user.js',
        'main/Liko%20-%20Prank.main.user.js',
    ];

    try {
        for (const m of mains) { await load(m); }
        console.log('🐈‍⬛ [PCM local] ✅ 本地四個本體已載入，依賴由各本體自行抓取');
    } catch (e) {
        console.error('🐈‍⬛ [PCM local] ❌ 載入失敗（node dev/serve-local.mjs 有開嗎？）:', e.message);
    }
})();
