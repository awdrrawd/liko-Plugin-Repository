// ==UserScript==
// @name         MPL Login
// @name:zh      MPL 登入介面
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.2-2
// @description  Mobile-first portrait login screen for Bondage Club (with AES-GCM encrypted account storage)
// @description:zh 手機直版優化的登入介面，含 AES-GCM 加密帳號管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';
    window.Liko = window.Liko ?? {};
    if (window.Liko.MPL) return;
    const MOD_VERSION = '1.2';
    window.Liko.MPL = MOD_VERSION;

    const LS_KEY        = 'mpl_accounts';
    const IDB_NAME      = 'mpl-profiles';
    const IDB_STORE     = 'profiles';
    const IDB_KEY_STORE = 'cryptokeys';

    // ════════════════════════════════════════════════════════════════════════════
    // 工具
    // ════════════════════════════════════════════════════════════════════════════

    function isPortrait() {
        return window.innerWidth <= 768 || window.innerWidth < window.innerHeight;
    }

    function getBgUrl() {
        const href = window.location.href;
        // 確保 base 有 trailing slash，避免路徑拼接錯誤
        const base = href.includes('/')
        ? href.slice(0, href.lastIndexOf('/') + 1)
        : href + '/';
        const bg = typeof LoginBackground !== 'undefined' ? LoginBackground : 'Dressing';
        return base + 'Backgrounds/' + bg + '.jpg';
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AES-GCM 加密工具
    // ════════════════════════════════════════════════════════════════════════════

    function bufToB64(buf) {
        return btoa(String.fromCharCode(...new Uint8Array(buf)));
    }
    function b64ToBuf(b64) {
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return buf.buffer;
    }

    let _cryptoKeyPromise = null;

    function getCryptoKey() {
        if (_cryptoKeyPromise) return _cryptoKeyPromise;
        _cryptoKeyPromise = (async () => {
            const db = await openDB();
            const existing = await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE).objectStore(IDB_KEY_STORE).get('mainKey');
                req.onsuccess = () => resolve(req.result ?? null);
                req.onerror   = () => resolve(null);
            });
            if (existing?.key) {
                return crypto.subtle.importKey(
                    'jwk', existing.key,
                    { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
                );
            }
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
            );
            const exported = await crypto.subtle.exportKey('jwk', key);
            await new Promise(resolve => {
                const req = db.transaction(IDB_KEY_STORE, 'readwrite')
                .objectStore(IDB_KEY_STORE)
                .put({ id: 'mainKey', key: exported });
                req.onsuccess = () => resolve(true);
                req.onerror   = () => resolve(false);
            });
            console.log('[MPL] 🔑 AES-GCM 密鑰已生成並儲存至 IndexedDB');
            return key;
        })().catch(e => {
            // 失敗時重置，下次重試
            _cryptoKeyPromise = null;
            return Promise.reject(e);
        });
        return _cryptoKeyPromise;
    }

    async function encryptPassword(plaintext) {
        const key = await getCryptoKey();
        const iv  = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder();
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(plaintext)
        );
        return bufToB64(iv.buffer) + ':' + bufToB64(cipher);
    }

    async function decryptPassword(stored) {
        try {
            const key = await getCryptoKey();
            const [ivB64, cipherB64] = stored.split(':');
            const dec = new TextDecoder();
            const plain = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: new Uint8Array(b64ToBuf(ivB64)) },
                key,
                b64ToBuf(cipherB64)
            );
            return dec.decode(plain);
        } catch (e) {
            console.warn('[MPL] 解密失敗:', e);
            return null;
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // IndexedDB（角色快照 + 密鑰）
    // ════════════════════════════════════════════════════════════════════════════

    let _db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            if (_db) return resolve(_db);
            const req = indexedDB.open(IDB_NAME, 2);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE))
                    db.createObjectStore(IDB_STORE, { keyPath: 'accountName' });
                if (!db.objectStoreNames.contains(IDB_KEY_STORE))
                    db.createObjectStore(IDB_KEY_STORE, { keyPath: 'id' });
            };
            req.onsuccess = e => { _db = e.target.result; resolve(_db); };
            req.onerror   = () => reject(req.error);
        });
    }

    async function dbGet(accountName) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(accountName);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror   = () => resolve(null);
        });
    }

    async function dbPut(profile) {
        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(profile);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    async function dbDelete(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return false;

        const db = await openDB();
        return new Promise(resolve => {
            const req = db.transaction(IDB_STORE, 'readwrite')
            .objectStore(IDB_STORE)
            .delete(key);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => resolve(false);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // localStorage（帳號列表）
    // ════════════════════════════════════════════════════════════════════════════

    function loadAccounts() {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
        catch { return []; }
    }

    function saveAccounts(list) {
        localStorage.setItem(LS_KEY, JSON.stringify(list));
    }

    // 公開介面：加密後存入，回傳正規化後的 key（大寫）
    async function addOrUpdateAccount(accountName, plainPassword) {
        const key       = accountName.toUpperCase();
        const encrypted = await encryptPassword(plainPassword);
        const list      = loadAccounts();
        const idx       = list.findIndex(a => a.accountName === key);
        if (idx >= 0) list[idx].password = encrypted;
        else list.push({ accountName: key, password: encrypted, addedAt: Date.now() });
        saveAccounts(list);
        return key;
    }

    function removeAccount(accountName) {
        const key = String(accountName || '').toUpperCase();
        if (!key) return;
        saveAccounts(loadAccounts().filter(a => a.accountName !== key));
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 角色快照（頭像 + 暱稱 + ID）
    // ════════════════════════════════════════════════════════════════════════════

    function makeAvatarDataUrl(size = 48) {
        try {
            const src = Player?.Canvas;
            if (!src || src.width === 0) return null;
            const off = document.createElement('canvas');
            off.width = size; off.height = size;
            const ctx = off.getContext('2d');
            ctx.fillStyle = '#0a0c12';
            ctx.fillRect(0, 0, size, size);
            const sx = src.width * 0.39, sy = src.height * 0.40;
            const sw = src.width * 0.22, sh = src.height * 0.12;
            ctx.drawImage(src, sx, sy, sw, sh, 0, 0, size, size);
            return off.toDataURL('image/jpeg', 0.85);
        } catch { return null; }
    }

    async function captureAndSaveProfile() {
        try {
            if (typeof Player === 'undefined' || !Player?.AccountName) return;
            //統一使用大寫 key，與 localStorage 保持一致
            const accountKey = Player.AccountName.toUpperCase();
            const profile = {
                accountName:   accountKey,
                name:          Player.Name        || '',
                nickname:      Player.Nickname    || null,
                memberNumber:  Player.MemberNumber ?? null,
                avatarDataUrl: makeAvatarDataUrl(56),
                savedAt:       Date.now(),
            };
            await dbPut(profile);
            console.log(`[MPL] ✅ 快照已儲存 ${accountKey}`);
            mplRefreshAccountRow();
        } catch (e) {
            console.warn('[MPL] 快照失敗:', e);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC 函數 Hook
    // ════════════════════════════════════════════════════════════════════════════

    function hookLoginResponse() {
        if (typeof window.LoginResponse !== 'function')
            return setTimeout(hookLoginResponse, 500);
        const _orig = window.LoginResponse;
        window.LoginResponse = function (...args) {
            const result = _orig.apply(this, args);
            if (args[0] && typeof args[0] === 'object')
                setTimeout(captureAndSaveProfile, 4000);
            return result;
        };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // BC DOM 隱藏 / 還原
    // ════════════════════════════════════════════════════════════════════════════

    const BC_HIDE_IDS = [
        'InputName', 'InputPassword',
        'login-name-label', 'login-password-label',
        'login-welcome-message', 'login-status',
        'login-login-button', 'login-new-character-label',
        'login-register-button', 'login-password-reset-button',
        'login-password-reset-hint', 'login-cheats-button',
        'login-footer', 'LanguageDropdown',
    ];

    const BC_PASSTHROUGH_IDS = ['fusam-show-button', 'fusam-addon-manager-container'];

    function hideBC() {
        BC_HIDE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', 'none', 'important');
        });
        const cv = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (cv) cv.style.setProperty('display', 'none', 'important');
        ensureFusamVisible();
    }

    let _fusamObserver = null;

    function ensureFusamVisible() {
        BC_PASSTHROUGH_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                applyFusamStyle(el);
                if (id === 'fusam-addon-manager-container') watchFusamContainerRemoval();
            }
        });
        if (!document.getElementById('fusam-show-button') && !_fusamObserver && mplActive) {
            _fusamObserver = new MutationObserver(() => {
                BC_PASSTHROUGH_IDS.forEach(id => {
                    const el = document.getElementById(id);
                    if (el && mplActive) {
                        applyFusamStyle(el);
                        if (id === 'fusam-addon-manager-container') watchFusamContainerRemoval();
                    }
                });
            });
            _fusamObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    function applyFusamStyle(el) {
        el.style.removeProperty('display');
        if (el.id === 'fusam-addon-manager-container') {
            let node = el;
            while (node && node !== document.body) {
                node.style.setProperty('z-index', '2000', 'important');
                node.style.setProperty('position', 'relative', 'important');
                node = node.parentElement;
            }
            el.style.setProperty('font-size',     '10px',   'important');
            el.style.setProperty('max-width',      '92vw',   'important');
            el.style.setProperty('max-height',     '80vh',   'important');
            el.style.setProperty('width',          '92vw',   'important');
            el.style.setProperty('height',         '80vh',   'important');
            el.style.setProperty('top',            '10vh',   'important');
            el.style.setProperty('left',           '4vw',    'important');
            el.style.setProperty('border-radius',  '12px',   'important');
            el.style.setProperty('overflow',       'hidden', 'important');
            el.style.setProperty('position',       'fixed',  'important');
        } else {
            el.style.setProperty('position',       'fixed',  'important');
            el.style.setProperty('z-index',        '2000',   'important');
            el.style.setProperty('pointer-events', 'auto',   'important');
        }
    }

    function watchFusamContainerRemoval() {
        const container = document.getElementById('fusam-addon-manager-container');
        if (!container) return;
        const modified = [];
        let node = container;
        while (node && node !== document.body) { modified.push(node); node = node.parentElement; }
        const removalObserver = new MutationObserver(() => {
            if (!document.getElementById('fusam-addon-manager-container')) {
                modified.forEach(n => {
                    n.style.removeProperty('z-index');
                    n.style.removeProperty('position');
                });
                ['font-size','max-width','max-height','width','height','top','left','border-radius','overflow','position']
                    .forEach(p => container.style.removeProperty(p));
                removalObserver.disconnect();
            }
        });
        removalObserver.observe(document.body, { childList: true, subtree: true });
    }

    function showBC() {
        BC_HIDE_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.removeProperty('display');
        });
        const cv = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (cv) cv.style.removeProperty('display');
        BC_PASSTHROUGH_IDS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.removeProperty('z-index');
                el.style.removeProperty('position');
                el.style.removeProperty('pointer-events');
            }
        });
        if (_fusamObserver) { _fusamObserver.disconnect(); _fusamObserver = null; }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 樣式注入
    // ════════════════════════════════════════════════════════════════════════════

    function injectStyles() {
        if (document.getElementById('mpl-styles')) return;
        const s = document.createElement('style');
        s.id = 'mpl-styles';
        s.textContent = `
/* ── MPL Login UI ── */
#mpl-bg {
    position: fixed; inset: 0; z-index: 1000;
    background: #0a0c12; overflow: hidden;
}
#mpl-bg-img {
    position: absolute;
    top: 0; left: -150%;
    width: 400%; height: 100%;
    object-fit: cover; object-position: top left;
    pointer-events: none;
}
#mpl-bg-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.38); pointer-events: none;
}
#mpl-bg-fallback {
    position: absolute; inset: 0;
    background-image:
        radial-gradient(ellipse at 30% 60%, rgba(90,50,140,0.38) 0%, transparent 55%),
        radial-gradient(ellipse at 75% 40%, rgba(140,70,100,0.28) 0%, transparent 50%),
        linear-gradient(180deg, #1a1225 0%, #251530 60%, #1e1028 100%);
    pointer-events: none;
}

/* ── 主 UI 層 ── */
#mpl-root {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: space-between;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;
}
#mpl-root > * { pointer-events: auto; }

/* ── 1. 頂部 ── */
#mpl-top {
    width: 100%; padding: 30px 24px 5px;
    text-align: center;
    background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%);
}
#mpl-title {
    font-size: 28px; font-weight: 700; color: #e8dcff;
    letter-spacing: 2px;
    text-shadow: 0 0 24px rgba(167,139,250,0.50);
}
#mpl-status {
    margin-top: 10px; font-size: 19px;
    color: rgba(200,185,255,0.80); min-height: 26px;
    text-shadow: 0 1px 8px rgba(0,0,0,0.8);
}
#mpl-status.error { color: rgba(255,120,120,0.95); }

/* ── 2. 帳號列 ── */
#mpl-accounts-section {
    width: 100%; max-width: 560px; padding: 0 20px;
}

#mpl-accounts-row {
    display: flex; gap: 14px;
    overflow-x: auto; overflow-y: visible;
    scrollbar-width: none;
    padding: 16px 50px 20px;
    cursor: grab; user-select: none;
    justify-content: flex-start;
    perspective: 600px;
    perspective-origin: 50% 50%;
}
#mpl-accounts-row:active { cursor: grabbing; }
#mpl-accounts-row::-webkit-scrollbar { display: none; }

.mpl-acct-card {
    flex-shrink: 0; width: 84px;
    border-radius: 13px;
    border: 1.5px solid rgba(200,180,255,0.25);
    background: rgba(20,14,36,0.68);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    padding: 7px 8px 8px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    cursor: pointer; position: relative; user-select: none;
    transition: border-color 0.22s, background 0.22s, transform 0.35s cubic-bezier(0.25,0.8,0.25,1), box-shadow 0.35s, opacity 0.35s;
    transform-style: preserve-3d;
    will-change: transform, opacity;
    transform-origin: center center;
}
.mpl-acct-card:hover  { border-color: rgba(200,180,255,0.55); }
.mpl-acct-card.active {
    border-color: rgba(200,170,255,0.80);
    background: rgba(127,83,205,0.22);
    box-shadow: 0 4px 18px rgba(127,83,205,0.35);
}

.mpl-acct-ghost {
    flex-shrink: 0; width: 84px; pointer-events: none; visibility: hidden;
}
.mpl-acct-top-label {
    font-size: 10px; font-weight: 600;
    color: rgba(200,185,255,0.70);
    text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    width: 100%; letter-spacing: 0.3px;
    line-height: 1.2;
}
.mpl-avatar {
    width: 42px; height: 42px; border-radius: 9px;
    background: rgba(127,83,205,0.22); border: 1px solid rgba(200,180,255,0.25);
    overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.mpl-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.mpl-avatar-ph { font-size: 20px; }
.mpl-acct-name {
    font-size: 16px; font-weight: 600; color: #ddd5f8;
    text-align: center; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; width: 100%;
}
.mpl-acct-id  { font-size: 15px; color: rgba(190,175,225,0.55); text-align: center; }
.mpl-acct-del {
    position: absolute; top: 5px; right: 5px;
    width: 16px; height: 16px; border-radius: 4px;
    background: rgba(239,68,68,0.12); border: 0.5px solid rgba(239,68,68,0.30);
    color: rgba(255,130,130,0.75); font-size: 8px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.12s; z-index: 2;
}
.mpl-acct-del:hover { background: rgba(239,68,68,0.30); }

/* ── 3. 主表單 ── */
#mpl-form-section {
    max-width: 420px; padding: 0;
    display: flex; flex-direction: column; gap: 11px;
    align-items: center;
}
.mpl-field {
    display: flex; flex-direction: row;
    align-items: center; gap: 10px;
    width: 100%;
}
.mpl-field-label {
    font-size: 20px; color: rgba(210,195,245,0.75);
    text-shadow: 0 1px 6px rgba(0,0,0,0.7);
    white-space: nowrap; flex-shrink: 0;
    width: 44px; text-align: right;
}
.mpl-input {
    background: #ffffff;
    border: 1.5px solid rgba(200,180,255,0.35);
    border-radius: 11px;
    color: #1a1a2e;
    -webkit-text-fill-color: #1a1a2e;
    padding: 5px 15px; font-size: 21px; font-family: inherit;
    outline: none; flex: 1;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.mpl-input:focus {
    border-color: rgba(127,83,205,0.70);
    box-shadow: 0 0 0 3px rgba(127,83,205,0.15);
}
.mpl-input::placeholder {
    color: rgba(100,90,130,0.55);
    -webkit-text-fill-color: rgba(100,90,130,0.55);
}

/* ── 4. 按鈕列 ── */
#mpl-btn-row {
    width: 70%; max-width: 420px; padding: 0;
    display: flex; flex-direction: column; gap: 8px;
    align-items: stretch;
    margin-top: 10px;
}
#mpl-btn-login {
    width: 100%; padding: 10px;
    background: rgba(127,83,205,0.30);
    border: 1.5px solid rgba(200,170,255,0.55);
    border-radius: 12px; color: #e8dcff;
    font-size: 21px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: background 0.15s;
    text-shadow: 0 0 12px rgba(167,139,250,0.4);
}
#mpl-btn-login:hover    { background: rgba(127,83,205,0.48); }
#mpl-btn-login:disabled { opacity: 0.40; cursor: default; }

#mpl-btn-row-secondary {
    display: flex; gap: 8px; width: 100%;
}
#mpl-btn-save-acct,
#mpl-btn-reset {
    flex: 1; min-width: 0; padding: 10px;
    background: rgba(14,10,28,0.55); backdrop-filter: blur(8px);
    border: 1.5px solid rgba(200,180,255,0.35);
    border-radius: 12px; color: rgba(220,210,245,0.85);
    font-size: 17px; font-family: inherit; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    white-space: nowrap;
}
#mpl-btn-save-acct:hover,
#mpl-btn-reset:hover {
    background: rgba(127,83,205,0.22);
    border-color: rgba(200,170,255,0.55);
}
#mpl-privacy-note {
    font-size: 13px; color: rgba(180,170,210,0.45);
    text-align: center; letter-spacing: 0.3px;
    margin-top: 1px;
}

/* ── 5. 建立角色 ── */
#mpl-register-section {
    width: 100%; max-width: 420px; padding: 0 24px;
    display: flex; flex-direction: column; gap: 9px; align-items: center;
}
.mpl-divider { display: flex; align-items: center; gap: 10px; width: 70%; }
.mpl-div-line { flex: 1; height: 0.5px; background: rgba(200,185,230,0.15); }
.mpl-div-text { font-size: 17px; color: rgba(200,185,230,0.45); }
#mpl-btn-register {
    width: 70%; padding: 10px;
    background: rgba(14,10,28,0.55); backdrop-filter: blur(8px);
    border: 1.5px solid rgba(200,180,255,0.28);
    border-radius: 12px; color: rgba(220,210,245,0.85);
    font-size: 20px; font-family: inherit; cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
}
#mpl-btn-register:hover { background: rgba(127,83,205,0.18); border-color: rgba(200,170,255,0.50); }

/* ── 6. 底部 ── */
#mpl-bottom {
    width: 100%; padding: 10px 20px 30px;
    background: linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%);
    display: flex; flex-direction: column; gap: 20px; align-items: center;
}
#mpl-bottom-controls {
    width: 100%; max-width: 560px;
    display: flex; align-items: center; justify-content: center; gap: 10px;
}
#mpl-lang-select {
    background: rgba(14,10,28,0.72);
    border: 1px solid rgba(200,180,255,0.28); border-radius: 8px;
    color: rgba(220,210,245,0.85);
    font-size: 17px;
    padding: 7px 100px 7px 10px;
    font-family: inherit; cursor: pointer;
    flex-shrink: 0;
    appearance: auto; -webkit-appearance: auto;
}
#mpl-settings-btn {
    height: 38px; padding: 0 18px; border-radius: 9px;
    background: rgba(14,10,28,0.72);
    border: 1px solid rgba(200,180,255,0.28);
    color: rgba(220,210,245,0.85); font-size: 17px; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 5px;
    cursor: pointer; transition: background 0.15s;
    flex-shrink: 0; white-space: nowrap;
}
#mpl-settings-btn:hover { background: rgba(127,83,205,0.28); border-color: rgba(200,170,255,0.50); }

/* 跑馬燈 */
#mpl-marquee-wrap {
    width: 100%; max-width: 560px; overflow: hidden;
    mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%);
    height: 22px;
}
#mpl-marquee-inner {
    display: flex; gap: 28px; position: relative;
    will-change: transform; white-space: nowrap;
}
.mpl-marquee-item { font-size: 17px; color: rgba(200,185,230,0.40); white-space: nowrap; flex-shrink: 0; }
.mpl-marquee-item span { color: rgba(200,180,255,0.65); }

/* ── 設定浮層 ── */
#mpl-settings-overlay {
    display: none; position: absolute; inset: 0; z-index: 20;
    background: rgba(0,0,0,0.60); backdrop-filter: blur(4px);
    align-items: center; justify-content: center;
}
#mpl-settings-overlay.visible { display: flex; }
#mpl-settings-box {
    background: rgba(14,10,26,0.96); border: 1px solid rgba(200,180,255,0.28);
    border-radius: 16px; padding: 20px; width: min(290px, 88vw);
    display: flex; flex-direction: column; gap: 13px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.5);
}
.mpl-sett-title { font-size: 20px; font-weight: 600; color: #ddd5f8; }
.mpl-sett-row {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 19px; color: rgba(210,195,240,0.85);
}
.mpl-sett-row input[type=checkbox] { accent-color: #7F53CD; cursor: pointer; width: 18px; height: 18px; }
.mpl-sett-close {
    width: 100%; padding: 9px;
    background: rgba(127,83,205,0.18); border: 1px solid rgba(200,170,255,0.35);
    border-radius: 9px; color: #c4b5fd; font-size: 19px; font-family: inherit; cursor: pointer;
}
        `;
        document.head.appendChild(s);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 狀態字串快取
    // ════════════════════════════════════════════════════════════════════════════

    let _lastStatusMsg   = null;
    let _lastStatusError = null;

    function syncStatus() {
        const el = document.getElementById('mpl-status');
        if (!el) return;

        let msg     = '';
        let isError = false;

        if (typeof LoginErrorMessage !== 'undefined' && LoginErrorMessage) {
            msg = (typeof TextGet === 'function' ? TextGet(LoginErrorMessage) : '') || LoginErrorMessage;
            isError = true;
        } else if (typeof ServerIsConnected !== 'undefined' && !ServerIsConnected) {
            msg = (typeof TextGet === 'function' ? TextGet('ConnectingToServer') : '') || '正在連接伺服器…';
        } else if (typeof LoginQueuePosition !== 'undefined' && LoginQueuePosition !== -1) {
            const tmpl = (typeof TextGet === 'function' ? TextGet('LoginQueueWait') : '') || '排隊中：第 QUEUE_POS 位';
            msg = tmpl.replace('QUEUE_POS', String(LoginQueuePosition));
        } else if (typeof LoginSubmitted !== 'undefined' && LoginSubmitted) {
            msg = (typeof TextGet === 'function' ? TextGet('ValidatingNamePassword') : '') || '正在驗證帳號密碼…';
        } else {
            msg = (typeof TextGet === 'function' ? TextGet('EnterNamePassword') : '') || '請輸入帳號與密碼';
        }

        if (msg !== _lastStatusMsg || isError !== _lastStatusError) {
            _lastStatusMsg   = msg;
            _lastStatusError = isError;
            el.textContent   = msg;
            el.classList.toggle('error', isError);
        }

        const loginBtn = document.getElementById('mpl-btn-login');
        if (loginBtn) {
            const canLogin = (typeof ServerIsConnected !== 'undefined' ? ServerIsConnected : true)
            && !(typeof LoginSubmitted !== 'undefined' && LoginSubmitted);
            if (loginBtn.disabled === canLogin) loginBtn.disabled = !canLogin;
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // DOM 構建
    // ════════════════════════════════════════════════════════════════════════════

    let mplBg        = null;
    let mplActive    = false;
    let selectedIdx  = null;
    let settingsOpen = false;

    let marqueeRAF   = null;
    let marqueePosX  = 0;
    let marqueeLastT = null;
    let marqueeHalfW = 0;
    const marqueeSpeed = 28;

    const THANK_YOU_LIST = [
        'AlexG','Amazing','Andres','Asriel','Aybes','Brad','bryce','Canti',
        'Cerberus','Christian','Cm382714','Deamonfox','Desch','Dragokahn',
        'dynilath','EBXD','Exusiai','Fabian','fumoffu','George','Greendragon',
        'Hhhhh','I.F.S.','jazzybanana','Jerry','John','Jonas','Kim','Laurie',
        'Michel','Mindtie','Misa','NeReFox','Nikita','PristessSakura','Salix',
        'ShadeofBrass','shadowhack','Soulcollar','Spare2','Sticks','Sunny',
        'Tam','Tarram1010','Teli','Thkdt','Troubadix','Troy','Ultimate',
        'Verena','WhiteSniper','Witchy','XDWolfie','Xepherio',
    ];

    function buildUI() {
        if (document.getElementById('mpl-bg')) return;

        mplBg = document.createElement('div');
        mplBg.id = 'mpl-bg';

        const bgImg = document.createElement('img');
        bgImg.id = 'mpl-bg-img'; bgImg.alt = '';
        bgImg.onerror = () => { bgImg.style.display = 'none'; };
        bgImg.src = getBgUrl();
        const bgOverlay  = document.createElement('div'); bgOverlay.id  = 'mpl-bg-overlay';
        const bgFallback = document.createElement('div'); bgFallback.id = 'mpl-bg-fallback';
        mplBg.appendChild(bgFallback);
        mplBg.appendChild(bgImg);
        mplBg.appendChild(bgOverlay);

        const settOverlay = document.createElement('div'); settOverlay.id = 'mpl-settings-overlay';
        const settBox = document.createElement('div'); settBox.id = 'mpl-settings-box';
        settBox.innerHTML = `
            <div class="mpl-sett-title">⚙ 登入頁面設定</div>
            <div class="mpl-sett-row">
                <span>顯示感謝跑馬燈</span>
                <input type="checkbox" id="mpl-sett-marquee" checked>
            </div>
            <div class="mpl-sett-row">
                <span>顯示帳號卡片列</span>
                <input type="checkbox" id="mpl-sett-accts" checked>
            </div>
            <button class="mpl-sett-close" id="mpl-sett-close-btn">關閉</button>
        `;
        settOverlay.appendChild(settBox);
        settOverlay.addEventListener('click', e => { if (e.target === settOverlay) closeSettings(); });
        mplBg.appendChild(settOverlay);

        const root = document.createElement('div'); root.id = 'mpl-root';

        // ── 1. 頂部 ──
        const top = document.createElement('div'); top.id = 'mpl-top';
        top.innerHTML = `
            <div id="mpl-title">Bondage Club</div>
            <div id="mpl-status"></div>
        `;
        root.appendChild(top);

        // ── 2. 帳號列 ──
        const acctSection = document.createElement('div'); acctSection.id = 'mpl-accounts-section';
        acctSection.innerHTML = `
            <div id="mpl-accounts-row"></div>
        `;
        root.appendChild(acctSection);

        // ── 3. 主表單 ──
        const formSection = document.createElement('div'); formSection.id = 'mpl-form-section';
        formSection.innerHTML = `
            <div class="mpl-field">
                <div class="mpl-field-label">帳號</div>
                <input class="mpl-input" id="mpl-input-name" type="text"
                       placeholder="輸入帳號" autocomplete="username" enterkeyhint="next">
            </div>
            <div class="mpl-field">
                <div class="mpl-field-label">密碼</div>
                <input class="mpl-input" id="mpl-input-pass" type="password"
                       placeholder="輸入密碼" autocomplete="current-password" enterkeyhint="go">
            </div>
        `;
        root.appendChild(formSection);

        // ── 4. 按鈕列 ──
        const btnRow = document.createElement('div'); btnRow.id = 'mpl-btn-row';
        btnRow.innerHTML = `
            <button id="mpl-btn-login">登入</button>
            <div id="mpl-btn-row-secondary">
                <button id="mpl-btn-save-acct">保存帳號</button>
                <button id="mpl-btn-reset">修改密碼</button>
            </div>
            <div id="mpl-privacy-note">帳戶已 AES-GCM 加密，僅存於本地裝置</div>
        `;
        root.appendChild(btnRow);

        // ── 5. 建立角色 ──
        const regSection = document.createElement('div'); regSection.id = 'mpl-register-section';
        regSection.innerHTML = `
            <div class="mpl-divider">
                <div class="mpl-div-line"></div>
                <span class="mpl-div-text">或</span>
                <div class="mpl-div-line"></div>
            </div>
            <button id="mpl-btn-register">建立新角色</button>
        `;
        root.appendChild(regSection);

        // ── 6. 底部 ──
        const bottom = document.createElement('div'); bottom.id = 'mpl-bottom';
        bottom.innerHTML = `
            <div id="mpl-bottom-controls">
                <select id="mpl-lang-select"></select>
                <button id="mpl-settings-btn">⚙ 設定</button>
            </div>
            <div id="mpl-marquee-wrap">
                <div id="mpl-marquee-inner"></div>
            </div>
        `;
        root.appendChild(bottom);

        mplBg.appendChild(root);
        document.body.appendChild(mplBg);

        bindEvents();
        buildLanguageSelect();
        buildMarquee();
        mplRefreshAccountRow();
        syncStatus();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 事件綁定
    // ════════════════════════════════════════════════════════════════════════════

    function bindEvents() {
        document.getElementById('mpl-input-name').addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('mpl-input-pass').focus();
        });
        document.getElementById('mpl-input-pass').addEventListener('keydown', e => {
            if (e.key === 'Enter') doLogin();
        });

        document.getElementById('mpl-btn-login').addEventListener('click', doLogin);

        document.getElementById('mpl-btn-save-acct').addEventListener('click', async () => {
            const name = document.getElementById('mpl-input-name')?.value.trim();
            const pass = document.getElementById('mpl-input-pass')?.value;
            if (!name || !pass) return;
            const key = await addOrUpdateAccount(name, pass);

            const accounts = loadAccounts();
            const newIdx = accounts.findIndex(a => a.accountName === key);
            if (newIdx >= 0) selectedIdx = newIdx;
            mplRefreshAccountRow();
        });

        document.getElementById('mpl-btn-reset').addEventListener('click', () => {
            if (typeof CommonSetScreen === 'function')
                CommonSetScreen('Character', 'PasswordReset');
        });

        document.getElementById('mpl-btn-register').addEventListener('click', () => {
            if (typeof DisclaimerOpen === 'function') {
                DisclaimerOpen(accepted => {
                    if (!accepted) { window.location.reload(); return; }
                    if (typeof CharacterCreatePlayer === 'function') CharacterCreatePlayer();
                    if (typeof InventoryRemove === 'function') {
                        InventoryRemove(Player, 'ItemFeet');
                        InventoryRemove(Player, 'ItemLegs');
                        InventoryRemove(Player, 'ItemArms');
                    }
                    if (typeof CharacterAppearanceSetDefault === 'function')
                        CharacterAppearanceSetDefault(Player);
                    if (typeof CharacterAppearanceLoadCharacter === 'function')
                        CharacterAppearanceLoadCharacter(Player, r =>
                                                         CommonSetScreen('Character', r ? 'Creation' : 'Login'));
                });
            }
        });

        document.getElementById('mpl-settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('mpl-sett-close-btn').addEventListener('click', closeSettings);

        // 語言切換只呼叫 BC 自身的切換流程一次，避免雙重觸發
        document.getElementById('mpl-lang-select').addEventListener('change', function() {
            const code = this.value;
            // 優先透過原生 dropdown 觸發 BC 的完整切換流程（含翻譯載入）
            const langEl = document.getElementById('LanguageDropdown');
            if (langEl) {
                if (langEl.value !== code) {
                    langEl.value = code;
                    langEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (typeof TranslationSwitchLanguage === 'function') {
                // 若原生 dropdown 不存在（尚未渲染）才直接呼叫
                TranslationSwitchLanguage(code || 'EN');
                if (typeof TextLoad === 'function') TextLoad();
                if (typeof ActivityDictionaryLoad === 'function') ActivityDictionaryLoad();
                if (typeof AssetLoadDescription === 'function') AssetLoadDescription('Female3DCG');
            }
            setTimeout(() => { _lastStatusMsg = null; syncStatus(); }, 100);
        });

        document.getElementById('mpl-sett-marquee').addEventListener('change', function() {
            document.getElementById('mpl-marquee-wrap').style.display = this.checked ? '' : 'none';
        });
        document.getElementById('mpl-sett-accts').addEventListener('change', function() {
            document.getElementById('mpl-accounts-section').style.display = this.checked ? '' : 'none';
        });

        initRowDrag();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Coverflow 旋轉選單
    // ════════════════════════════════════════════════════════════════════════════

    function updateCoverflowTransforms() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        const cards = row.querySelectorAll('.mpl-acct-card:not(.mpl-acct-ghost)');
        if (!cards.length) return;
        const rowRect   = row.getBoundingClientRect();
        const rowCenter = rowRect.left + rowRect.width / 2;

        cards.forEach(card => {
            const rect   = card.getBoundingClientRect();
            const cardCx = rect.left + rect.width / 2;
            const dist   = cardCx - rowCenter;
            const absD   = Math.abs(dist);
            const maxDist = rowRect.width * 0.55;
            const t      = Math.min(absD / maxDist, 1);

            const rotateY = dist > 0 ? -35 * t : 35 * t;
            const scale   = 1 - 0.22 * t;
            const opacity = 1 - 0.40 * t;
            const transX  = dist > 0 ? -12 * t : 12 * t;

            card.style.transform = `translateX(${transX}px) scale(${scale}) rotateY(${rotateY}deg)`;
            card.style.opacity   = opacity;
            card.style.zIndex    = Math.round((1 - t) * 10);
        });
    }

    function initRowDrag() {
        const el = document.getElementById('mpl-accounts-row');
        if (!el) return;
        let isDown = false, startX = 0, scrollLeft = 0;

        el.addEventListener('scroll', updateCoverflowTransforms, { passive: true });
        el.addEventListener('mousedown', e => {
            isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
        });
        el.addEventListener('mouseleave', () => { isDown = false; });
        el.addEventListener('mouseup',    () => { isDown = false; });
        el.addEventListener('mousemove',  e => {
            if (!isDown) return;
            e.preventDefault();
            el.scrollLeft = scrollLeft - (e.pageX - el.offsetLeft - startX);
        });
        el.addEventListener('touchstart', e => {
            startX = e.touches[0].pageX - el.offsetLeft; scrollLeft = el.scrollLeft;
        }, { passive: true });
        el.addEventListener('touchmove', e => {
            el.scrollLeft = scrollLeft - (e.touches[0].pageX - el.offsetLeft - startX);
        }, { passive: true });

        requestAnimationFrame(updateCoverflowTransforms);
        window.addEventListener('resize', updateCoverflowTransforms);
    }

    function buildLanguageSelect() {
        const sel = document.getElementById('mpl-lang-select');
        if (!sel) return;

        sel.innerHTML = '';
        const currentLang = localStorage.getItem('BondageClubLanguage') || 'EN';

        const bcDropdown = document.getElementById('LanguageDropdown');
        if (bcDropdown && bcDropdown.options.length > 0) {
            Array.from(bcDropdown.options).forEach(bcOpt => {
                const opt = document.createElement('option');
                opt.value = bcOpt.value;
                opt.textContent = bcOpt.textContent;
                opt.selected = bcOpt.value === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        if (
            typeof TranslationDictionary !== 'undefined' &&
            Array.isArray(TranslationDictionary) &&
            TranslationDictionary.length > 0
        ) {
            TranslationDictionary.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.LanguageCode;
                opt.textContent =
                    (l.Icon ? l.Icon + ' ' : '') +
                    (l.LanguageName || l.EnglishName || l.LanguageCode);
                opt.selected = l.LanguageCode === currentLang;
                sel.appendChild(opt);
            });
            return;
        }

        const fallbackOpt = document.createElement('option');
        fallbackOpt.value = 'EN';
        fallbackOpt.textContent = 'English';
        fallbackOpt.selected = currentLang === 'EN';
        sel.appendChild(fallbackOpt);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 帳號列渲染
    // ════════════════════════════════════════════════════════════════════════════

    function mplRefreshAccountRow() {
        const row = document.getElementById('mpl-accounts-row');
        if (!row) return;
        row.innerHTML = '';

        const accounts = loadAccounts();

        const ghostBefore = document.createElement('div');
        ghostBefore.className = 'mpl-acct-ghost';
        row.appendChild(ghostBefore);

        // 收集所有 dbGet Promise，等全部完成後才計算 coverflow，避免非同步插入造成位置跳動
        const profilePromises = accounts.map((acct, idx) => {
            const card = document.createElement('div');
            card.className = 'mpl-acct-card' + (selectedIdx === idx ? ' active' : '');

            const topLabel = document.createElement('div');
            topLabel.className = 'mpl-acct-top-label';
            topLabel.textContent = acct.accountName;

            const del = document.createElement('div');
            del.className = 'mpl-acct-del'; del.textContent = '✕';
            del.addEventListener('click', e => { e.stopPropagation(); deleteAccount(idx); });

            const av = document.createElement('div'); av.className = 'mpl-avatar';
            const ph = document.createElement('span'); ph.className = 'mpl-avatar-ph'; ph.textContent = '🐈';
            av.appendChild(ph);

            const nm = document.createElement('div'); nm.className = 'mpl-acct-name';
            nm.textContent = acct.accountName;
            const id = document.createElement('div'); id.className = 'mpl-acct-id';
            id.textContent = '';

            card.appendChild(del);
            card.appendChild(topLabel);
            card.appendChild(av);
            card.appendChild(nm);
            card.appendChild(id);
            card.addEventListener('click', () => selectAccount(idx));
            row.appendChild(card);

            // 回傳 Promise，待非同步資料就緒後更新該卡片
            return dbGet(acct.accountName).then(profile => {
                if (!profile) return;
                const displayName = profile.nickname || profile.name || acct.accountName;
                nm.textContent = displayName;
                if (profile.memberNumber) id.textContent = '#' + profile.memberNumber;
                if (profile.avatarDataUrl) {
                    const img = document.createElement('img');
                    img.src = profile.avatarDataUrl; img.alt = displayName;
                    av.innerHTML = ''; av.appendChild(img);
                }
            });
        });

        const ghostAfter = document.createElement('div');
        ghostAfter.className = 'mpl-acct-ghost';
        row.appendChild(ghostAfter);

        // 同步 DOM 先算一次（讓卡片位置穩定），非同步資料到後再算一次
        requestAnimationFrame(updateCoverflowTransforms);
        Promise.all(profilePromises).then(() => requestAnimationFrame(updateCoverflowTransforms));
    }

    // 點選帳號卡片：解密後填入輸入框，解密失敗（回傳 null）時清空欄位，而非填入 null
    function selectAccount(idx) {
        selectedIdx = idx;
        const acct = loadAccounts()[idx];
        if (!acct) return;

        const currentSelection = idx;
        const nameEl = document.getElementById('mpl-input-name');
        const passEl = document.getElementById('mpl-input-pass');

        if (nameEl) nameEl.value = acct.accountName;
        if (passEl) passEl.value = '';

        decryptPassword(acct.password).then(plain => {
            if (selectedIdx !== currentSelection) return;
            const el = document.getElementById('mpl-input-pass');
            if (el) el.value = plain ?? '';
        });

        mplRefreshAccountRow();
    }

    function deleteAccount(idx) {
        const acct = loadAccounts()[idx];
        if (!acct) return;
        removeAccount(acct.accountName);
        dbDelete(acct.accountName);
        if (selectedIdx === idx) {
            selectedIdx = null;
            document.getElementById('mpl-input-name').value = '';
            document.getElementById('mpl-input-pass').value = '';
        } else if (selectedIdx !== null && selectedIdx > idx) {
            selectedIdx--;
        }
        mplRefreshAccountRow();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 設定浮層
    // ════════════════════════════════════════════════════════════════════════════

    function toggleSettings() {
        settingsOpen = !settingsOpen;
        document.getElementById('mpl-settings-overlay')?.classList.toggle('visible', settingsOpen);
    }

    function closeSettings() {
        settingsOpen = false;
        document.getElementById('mpl-settings-overlay')?.classList.remove('visible');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 登入
    // ════════════════════════════════════════════════════════════════════════════

    function doLogin() {
        const name = document.getElementById('mpl-input-name')?.value || '';
        const pass = document.getElementById('mpl-input-pass')?.value || '';
        if (!name || !pass) {
            _lastStatusMsg = null; _lastStatusError = null;
            const el = document.getElementById('mpl-status');
            if (el) { el.textContent = '請輸入帳號與密碼'; el.classList.add('error'); }
            _lastStatusMsg = '請輸入帳號與密碼'; _lastStatusError = true;
            return;
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        const bcName = document.getElementById('InputName');
        const bcPass = document.getElementById('InputPassword');
        if (bcName && setter) { setter.call(bcName, name); bcName.dispatchEvent(new Event('input', { bubbles: true })); }
        if (bcPass && setter) { setter.call(bcPass, pass); bcPass.dispatchEvent(new Event('input', { bubbles: true })); }

        if (typeof LoginDoLogin === 'function') LoginDoLogin(name, pass);
        else document.getElementById('login-login-button')?.click();
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 跑馬燈
    // ════════════════════════════════════════════════════════════════════════════

    function buildMarquee() {
        const inner = document.getElementById('mpl-marquee-inner');
        if (!inner) return;
        inner.innerHTML = '';
        [...THANK_YOU_LIST, ...THANK_YOU_LIST].forEach(name => {
            const el = document.createElement('span');
            el.className = 'mpl-marquee-item';
            el.innerHTML = `感謝 <span>${name}</span>`;
            inner.appendChild(el);
        });
        marqueePosX = 0;
        requestAnimationFrame(() => requestAnimationFrame(() => {
            marqueeHalfW = inner.scrollWidth / 2;
            startMarquee();
        }));
    }

    function startMarquee() {
        if (marqueeRAF) cancelAnimationFrame(marqueeRAF);
        marqueeLastT = null;
        function step(ts) {
            if (!mplActive) { marqueeRAF = null; return; }
            if (!marqueeLastT) marqueeLastT = ts;
            const dt = Math.min((ts - marqueeLastT) / 1000, 0.05);
            marqueeLastT = ts;
            marqueePosX -= marqueeSpeed * dt;
            if (marqueeHalfW > 0 && marqueePosX <= -marqueeHalfW) marqueePosX += marqueeHalfW;
            const inner = document.getElementById('mpl-marquee-inner');
            if (inner) inner.style.transform = `translateX(${marqueePosX}px)`;
            marqueeRAF = requestAnimationFrame(step);
        }
        marqueeRAF = requestAnimationFrame(step);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 啟用 / 停用
    // ════════════════════════════════════════════════════════════════════════════

    let _statusTimer = null;

    function mplApply() {
        if (mplActive) return;
        mplActive = true;
        buildUI();
        hideBC();
        mplBg = document.getElementById('mpl-bg');
        if (mplBg) mplBg.style.display = '';
        const bgImg = document.getElementById('mpl-bg-img');
        if (bgImg) bgImg.src = getBgUrl();
        _lastStatusMsg = null; _lastStatusError = null;
        _statusTimer = setInterval(syncStatus, 500);
    }

    function mplRemove() {
        if (!mplActive) return;
        mplActive = false;
        showBC();
        if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
        if (marqueeRAF)   { cancelAnimationFrame(marqueeRAF); marqueeRAF = null; }
        const bg = document.getElementById('mpl-bg');
        if (bg) bg.style.display = 'none';
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 場景偵測
    // ════════════════════════════════════════════════════════════════════════════

    function checkScene() {
        const scr      = typeof CurrentScreen !== 'undefined' ? CurrentScreen : null;
        const portrait = isPortrait();
        if (scr === 'Login' && portrait) mplApply();
        else if (mplActive) mplRemove();
    }

    window.addEventListener('resize',            () => checkScene());
    window.addEventListener('orientationchange', () => setTimeout(checkScene, 250));

    // ════════════════════════════════════════════════════════════════════════════
    // BC DrawProcess / polling hook
    // ════════════════════════════════════════════════════════════════════════════

    function hookDrawProcess() {
        if (typeof bcModSdk === 'undefined') {
            setInterval(checkScene, 1000);
            return;
        }
        try {
            const modApi = bcModSdk.registerMod({
                name: 'MPL Login', fullName: 'MPL Login UI', version: MOD_VERSION,
            });
            modApi.hookFunction('DrawProcess', 4, (args, next) => {
                next(args); checkScene();
            });
            modApi.hookFunction('LoginLoad', 0, (args, next) => {
                const r = next(args);
                if (isPortrait()) setTimeout(mplApply, 50);
                return r;
            });
            modApi.hookFunction('LoginUnload', 0, (args, next) => {
                mplRemove(); return next(args);
            });
        } catch (e) {
            console.warn('[MPL] bcModSdk hook 失敗，使用 polling', e);
            setInterval(checkScene, 1000);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 初始化
    // ════════════════════════════════════════════════════════════════════════════

    function init() {
        injectStyles();
        hookLoginResponse();
        hookDrawProcess();
        getCryptoKey().then(() => {
            console.log('[MPL] 🔑 加密系統就緒');
        }).catch(e => {
            console.warn('[MPL] 加密系統初始化失敗:', e);
        });
        function waitForBC() {
            if (typeof CurrentScreen === 'undefined') return setTimeout(waitForBC, 500);
            checkScene();
            console.log(`[MPL] ✅ v${MOD_VERSION} 已載入`);
        }
        waitForBC();
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init, { once: true });
    else
        init();
})();
