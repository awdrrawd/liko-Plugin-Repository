// ==UserScript==
// @name         ShuangCustomAssets - loder
// @name:zh      Shuang的貼圖分享
// @namespace    https://gitgud.io/yeshuang26/shuangcustomassets
// @supportURL   https://gitgud.io/yeshuang26/shuangcustomassets
// @version      0.1.0
// @description  新增貼圖分享物品。可設定貼圖網址，設置在角色身上並分享顯示給其他人
// @author       Shuang
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function () {
    const supportedDomains = [
        'bondageprojects.elementfx.com',
        'bondage-europe.com',
        'bondageprojects.com',
        'bondage-asia.com'
    ];
    if (!supportedDomains.some(d => window.location.hostname.includes(d))) {
        console.warn('[ShuangCustomAssets] 非支援域名，跳過載入');
        return;
    }

    // 第一層：ESM bundle，走 dynamic import()（需要目標站點開 CORS）
    const ESM_SOURCES = [
        `https://shuang-custom-assets.pages.dev/shuang-assets.esm.js`,
        `https://shuang-custom-assets.netlify.app/shuang-assets.esm.js`,
    ];
    // 第二層：純 IIFE bundle，不含 import/export，走 <script src>（不受 CORS 限制，真保底）
    const IIFE_SOURCES = [
        `https://shuang-custom-assets.pages.dev/shuang-assets.iife.js`,
        `https://shuang-custom-assets.netlify.app/shuang-assets.iife.js`,
        `https://gitgud.io/yeshuang26/shuangcustomassets/-/raw/master/dist/shuang-assets.iife.js`,
    ];

    async function tryEsm() {
        for (const url of ESM_SOURCES) {
            try {
                await import(`${url}?t=${Date.now()}`);
                console.log(`[ShuangCustomAssets] ESM 載入成功: ${url}`);
                return true;
            } catch (e) {
                console.warn(`[ShuangCustomAssets] ESM 失敗 ${url}: ${e.message}`);
            }
        }
        return false;
    }

    function tryScriptTag(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = `${url}?t=${Date.now()}`;
            s.onload = () => resolve(true);
            s.onerror = () => reject(new Error('script load error'));
            document.body.appendChild(s);
        });
    }

    async function tryIife() {
        for (const url of IIFE_SOURCES) {
            try {
                await tryScriptTag(url);
                console.log(`[ShuangCustomAssets] IIFE 載入成功: ${url}`);
                return true;
            } catch (e) {
                console.warn(`[ShuangCustomAssets] IIFE 失敗 ${url}: ${e.message}`);
            }
        }
        return false;
    }

    (async () => {
        console.log('[ShuangCustomAssets] 正在載入...');
        if (await tryEsm()) return;
        if (await tryIife()) return;
        console.error('[ShuangCustomAssets] 所有來源皆載入失敗');
    })();
})();
