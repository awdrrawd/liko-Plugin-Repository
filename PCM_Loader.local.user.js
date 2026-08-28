// ==UserScript==
// @name         本地測試 - PCM 載入器
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      0.2
// @description  本地測試載入器：優先載入模組版 PCM，失敗時回退保留的單檔版
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @grant        none
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @run-at       document-end
// ==/UserScript==

// ─────────────────────────────────────────────────────────────────────────────
//  用法：在 repo 根目錄執行：  node dev/serve-local.mjs
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
    window.LikoDevBase = `http://localhost:5175/Plugins/`;

    const load = async (path) => {
        const res = await fetch(`http://localhost:5175/Plugins/` + path + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
        const code = await res.text();
        if (code.trimStart().startsWith('<')) throw new Error(`${path} → 收到 HTML（伺服器有開嗎？）`);
        new Function(code)();
    };

    const loadModule = (path, timeoutMs = 15000) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const timer = setTimeout(() => {
            script.remove();
            reject(new Error(`${path} → 模組載入逾時`));
        }, timeoutMs);
        script.type = 'module';
        script.src = `http://localhost:5175/Plugins/${path}?t=${Date.now()}`;
        script.onload = () => {
            clearTimeout(timer);
            if (window.Liko?.PCM) resolve();
            else reject(new Error(`${path} → PCM 未啟動`));
        };
        script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            reject(new Error(`${path} → 模組執行失敗`));
        };
        (document.head || document.documentElement).appendChild(script);
    });

    try {
        try {
            await loadModule('main/PCM/entry.js');
            console.log('🐈‍⬛ [PCM local] ✅ 本地模組版已載入');
        } catch (moduleError) {
            console.warn(`🐈‍⬛ [PCM local] ⚠️ 模組版失敗，回退單檔版：${moduleError.message}`);
            await load('main/Liko%20-%20Plugin%20Collection%20Manager.main.user.js');
            console.log('🐈‍⬛ [PCM local] ✅ 本地單檔版已載入（fallback）');
        }
    } catch (e) {
        console.error('🐈‍⬛ [PCM local] ❌ 載入失敗（node dev/serve-local.mjs 有開嗎？）:', e.message);
    }
})();
