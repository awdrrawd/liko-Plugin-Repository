// ==UserScript==
// @name         Liko - PCM 本地測試載入器
// @name:zh      Liko的插件管理器 - 本地測試
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.0
// @description  本地測試載入器：一次從 localhost 載入引擎/擴充/四個字庫/四個本體，用來驗證新版 i18n 適配
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
//  原理：先設 window.LikoDevBase = http://localhost:5175/…/Plugins/，四個本體讀到它就會
//  把引擎/字庫的依賴網址全部指向本地；本檔再依序把本地檔案抓下來 eval 執行。
//  （改完檔案存檔後，重整 BC 即可，伺服器 no-store + ?t= 時間戳確保拿到最新版）
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    'use strict';
    const PORT = 5175;
    const BASE = `http://localhost:${PORT}/Plugins/`;
    window.LikoDevBase = BASE;   // ← 四個本體會讀這個覆寫依賴基底

    const load = async (path) => {
        const res = await fetch(BASE + path + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
        const code = await res.text();
        if (code.trimStart().startsWith('<')) throw new Error(`${path} → 收到 HTML（伺服器有開嗎？）`);
        new Function(code)();
    };

    // 依序：先系統擴充與字庫（自註冊），再本體（本體的 ensureI18n 會發現引擎/字庫已就緒而略過重載）
    const modules = [
        'expand/bcmodsdk.js',
        'expand/BC_i18n.js',
        'expand/BC_toast_system.user.js',
        'expand/BC_ThemeColorCheck.js',
        'Translation/PCM-i18n.js',
        'Translation/MAT-i18n.js',
        'Translation/MPL-i18n.js',
        'Translation/Prank-i18n.js',
        'main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js',
        'main/Liko%20-%20MAT.main.user.js',
        'main/Liko%20-%20MPL.main.user.js',
        'main/Liko%20-%20Prank.main.user.js',
    ];

    try {
        for (const m of modules) { await load(m); }
        console.log('🐈‍⬛ [PCM local] ✅ 本地全部載入完成');
        console.log('🐈‍⬛ [PCM local] __SystemAPI__ =', JSON.stringify(window.Liko?.__SystemAPI__));
    } catch (e) {
        console.error('🐈‍⬛ [PCM local] ❌ 載入失敗（node dev/serve-local.mjs 有開嗎？）:', e.message);
    }
})();
