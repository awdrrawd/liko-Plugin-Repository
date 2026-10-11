// ==UserScript==
// @name         Liko - WPS
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.4
// @description  WCE Profile Share
// @author       Likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @grant        none
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20WPS.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20WPS.main.user.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.1.4";

    /* ================= 與 FCM / LCE 的協調 =================
     * 接收優先序：FCM > LCE > 獨立 WPS。FCM 或 LCE 負責接收時，本外掛不處理 PROFILESHARE。
     * 送出時，若 FCM / LCE 在，改走它們的分享（有分塊配速與大小檢查），否則用本外掛自己的。 */
    const fcmProfiles = () => {
        const fcm = window.Liko?.FCM;
        return fcm?.apiVersion >= 1
            && typeof fcm.profiles?.has === "function"
            && typeof fcm.profiles?.share === "function"
            ? fcm.profiles : null;
    };
    const lceWps = () => {
        const wps = window.Liko?.LCE?.ProfileShare;
        return wps?.apiVersion >= 1 && typeof wps.share === "function" ? wps : null;
    };
    const higherReceiver = () => !!fcmProfiles() || lceWps()?.handlesReceive?.() === true;
    if (window.Liko.WPS) return;
    window.Liko.WPS = MOD_VER;

    /* ================= 線路協定（與 FCM / LCE 一致，不可更動） =================
     * Hidden 聊天訊息 Content = `[PROFILESHARE] <shareId> <i>/<n> <chunk>`（i 從 1 起算）
     * 所有 chunk 依序串接 = base64( UTF-8( JSON.stringify(payload) ) )
     * payload = { sharedAt, from:{memberNumber,name}, profile:{memberNumber,name,lastNick,seen,characterBundle} }
     * 每塊大小只由送出端決定；LCE 會送最大 1800 字元的分塊，所以接收端接受到 2000 字元。 */
    const PROFILE_SHARE_PREFIX = "[PROFILESHARE]";
    const PROFILE_SHARE_OPEN_MARK = "PROFILESHARE_OPEN";

    const LIMITS = Object.freeze({
        maxChunks: 400,          // 單一分享最多分塊數
        maxChunkChars: 2000,     // 單塊內容上限（BC 的 ServerChatMessageMaxLength）
        maxChars: 400 * 2000,    // 單一分享在接收端最多佔用的字元數
        ttlMs: 60_000,           // 組裝中的分享逾時
        maxAssemblies: 8,        // 同時組裝的分享總數
        maxPerSender: 2,         // 每位送出者同時組裝的分享數
    });
    const LEGACY_CHUNK = 800, MAX_CHUNK = 1800, MIN_CHUNK = 400, RESERVED = 200;
    const CHUNK_RE = /^\[PROFILESHARE\] ([A-Za-z0-9_-]{1,40}) (\d{1,4})\/(\d{1,4}) ([A-Za-z0-9+/=]*)$/;
    const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

    // 送出配速
    const SHARE_GAP_MS = 100;        // 兩塊之間的最小間隔（約每秒 10 則，低於 BC 的 14 則 / 1.2 秒）
    const SHARE_RETRY_MS = 50;       // BC 發送佇列非空時的重試間隔
    const SHARE_STALL_MS = 10_000;   // 佇列一直不空超過這段時間就放棄這次分享

    // 開啟用快取（只存在記憶體，有數量與時間上限）
    const CACHE_TTL = 30 * 60 * 1000;
    const CACHE_MAX = 32;
    const cache = new Map();         // `${cacheId}:${memberNumber}` -> { profile, cachedAt }
    let cacheSeq = 0;
    let shareInFlight = false;       // 同一時間只送一份，避免連按「分享」塞滿 BC 發送佇列

    const log = (...a) => console.log("🐈‍⬛ [WPS]", ...a);

    /* ================= Language ================= */
    function detectLanguage() {
        if (typeof TranslationLanguage !== "undefined") {
            const l = TranslationLanguage.toLowerCase();
            return l === 'tw' || l === 'cn';
        }
        return (navigator.language || 'en').toLowerCase().startsWith('zh');
    }

    const isCN = detectLanguage();

    function getI18N() {
        return {
            sharedSelf: isCN
            ? (name, id) => `📜 已分享 ${name} (${id}) 的 Profile`
            : (name, id) => `📜 Shared profile: ${name} (${id})`,
            sharedFrom: isCN
            ? (from, display, date) => `📜 ${from} 分享了 ${display} 保存於: ${date}`
            : (from, display, date) => `📜 ${from} shared a profile: ${display} saved: ${date}`,
            busy: isCN
            ? "📜 上一份 Profile 還在傳送，請稍候"
            : "📜 Previous profile is still being sent, please wait",
            tooLarge: isCN
            ? (size, max) => `📜 這份 Profile 太大（約 ${size} KB），超過可分享的上限（約 ${max} KB），未傳送`
            : (size, max) => `📜 This profile is too large to share (about ${size} KB, limit about ${max} KB); not sent`,
            open: isCN ? "▶ 開啟" : "▶ Open"
        };
    }

    function getUILabel(key) {
        const UI = { share: isCN ? "分享 " : "Share " };
        return UI[key] || key;
    }

    /* ================= 編碼 / 驗證 ================= */
    function toBase64Utf8(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(binary);
    }

    function fromBase64Utf8(b64) {
        if (!BASE64_RE.test(b64) || b64.length % 4 === 1) throw new Error("invalid base64");
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }

    // ChatRoomSendLocal 以 HTML 顯示內容，下面還會把 token 換成按鈕：名稱一律跳脫，
    // 連方括號也跳脫，避免對方在名稱裡塞出假的 [PROFILESHARE_OPEN …] 標記或 HTML。
    function escapeHtml(value) {
        return String(value).replace(/[&<>"'[\]]/g, c => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "[": "&#91;", "]": "&#93;"
        })[c]);
    }

    // BC 的單則訊息上限可能是頂層 const（不在 window 上），所以兩種都讀。
    function bcMaxMessageChars() {
        try {
            if (typeof ServerChatMessageMaxLength !== "undefined") return Number(ServerChatMessageMaxLength);
        } catch { /* 退回 window */ }
        return Number(window.ServerChatMessageMaxLength);
    }

    function chunkSizeFor(maxMessageChars) {
        if (!Number.isFinite(maxMessageChars) || maxMessageChars <= 0) return LEGACY_CHUNK;
        return Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, Math.floor(maxMessageChars) - RESERVED));
    }

    function buildShareMessages(payload, shareId, chunkSize) {
        const encoded = toBase64Utf8(JSON.stringify(payload));
        const total = Math.ceil(encoded.length / chunkSize);
        if (total > LIMITS.maxChunks) return { tooLarge: true, chars: encoded.length, limit: LIMITS.maxChunks * chunkSize };
        const contents = [];
        for (let i = 0; i < total; i++) {
            contents.push(`${PROFILE_SHARE_PREFIX} ${shareId} ${i + 1}/${total} ${encoded.slice(i * chunkSize, (i + 1) * chunkSize)}`);
        }
        return { contents, chars: encoded.length };
    }

    const isInt = v => Number.isSafeInteger(v) && v > 0;
    const str = (v, max) => (typeof v === "string" && v.length <= max ? v : undefined);

    /** 逐欄驗證；不合格回傳 null。seen 不得晚於現在，否則「未來時間」的個資會擋掉之後所有真正的更新。 */
    function normalizeSharedProfile(raw, now = Date.now()) {
        const p = raw?.profile;
        if (!p || typeof p !== "object") return null;
        if (!isInt(p.memberNumber)) return null;
        const name = str(p.name, 100);
        if (!name) return null;
        if (typeof p.characterBundle !== "string" || !p.characterBundle || p.characterBundle.length > LIMITS.maxChars) return null;
        if (!Number.isFinite(p.seen) || p.seen < 0) return null;
        let bundle;
        try { bundle = JSON.parse(p.characterBundle); } catch { return null; }
        if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) || bundle.MemberNumber !== p.memberNumber) return null;
        return {
            profile: {
                memberNumber: p.memberNumber,
                name,
                lastNick: str(p.lastNick, 100),
                seen: Math.min(p.seen, now),
                characterBundle: p.characterBundle
            },
            fromName: str(raw?.from?.name, 40) ?? ""
        };
    }

    /* ================= 接收組裝（以「伺服器附的送出者 + shareId」為鍵） ================= */
    const assemblies = new Map();   // `${sender}:${shareId}` -> { sender, total, chunks, received, chars, createdAt }

    function oldestAssembly(pred) {
        let pick = null;
        for (const [key, a] of assemblies) if (pred(a) && (!pick || a.createdAt < pick.a.createdAt)) pick = { key, a };
        return pick?.key;
    }

    /** @returns {{status:'ignored'|'rejected'|'pending'|'complete', payload?:object}} */
    function acceptChunk(sender, content) {
        if (typeof content !== "string" || !content.startsWith(PROFILE_SHARE_PREFIX)) return { status: "ignored" };
        if (!Number.isSafeInteger(sender) || sender <= 0) return { status: "rejected" };
        if (content.length > LIMITS.maxChunkChars + 80) return { status: "rejected" };
        const m = CHUNK_RE.exec(content);
        if (!m) return { status: "rejected" };
        const [, shareId, idxText, totalText, chunk] = m;
        const idx = Number(idxText), total = Number(totalText);
        if (total < 1 || total > LIMITS.maxChunks || idx < 1 || idx > total) return { status: "rejected" };
        if (chunk.length > LIMITS.maxChunkChars) return { status: "rejected" };

        const t = Date.now();
        for (const [key, a] of assemblies) if (t - a.createdAt > LIMITS.ttlMs) assemblies.delete(key);

        const key = `${sender}:${shareId}`;
        let entry = assemblies.get(key);
        if (!entry) {
            let mine = 0;
            for (const a of assemblies.values()) if (a.sender === sender) mine++;
            if (mine >= LIMITS.maxPerSender) assemblies.delete(oldestAssembly(a => a.sender === sender));
            if (assemblies.size >= LIMITS.maxAssemblies) assemblies.delete(oldestAssembly(() => true));
            entry = { sender, total, chunks: new Array(total), received: 0, chars: 0, createdAt: t };
            assemblies.set(key, entry);
        }
        if (entry.total !== total) { assemblies.delete(key); return { status: "rejected" }; }

        if (entry.chunks[idx - 1] === undefined) {
            entry.chunks[idx - 1] = chunk;
            entry.received++;
            entry.chars += chunk.length;
            if (entry.chars > LIMITS.maxChars) { assemblies.delete(key); return { status: "rejected" }; }
        }
        if (entry.received < entry.total) return { status: "pending" };

        assemblies.delete(key);
        try {
            const payload = normalizeSharedProfile(JSON.parse(fromBase64Utf8(entry.chunks.join(""))), t);
            return payload ? { status: "complete", payload } : { status: "rejected" };
        } catch { return { status: "rejected" }; }
    }

    function pruneCache(now = Date.now()) {
        for (const [key, entry] of cache) if (now - entry.cachedAt > CACHE_TTL) cache.delete(key);
        while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }

    /* ================= IndexedDB（沿用 WCE / LCE 共用的 bce-past-profiles） ================= */
    // 不指定版本：沿用現存版本，絕不為了本外掛升版（升版會讓仍指定舊版本的其他插件開庫失敗）。
    let _dbPromise = null;
    function openBceDB() {
        if (_dbPromise) return _dbPromise;
        _dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open("bce-past-profiles");
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
        });
        return _dbPromise;
    }

    async function saveIfNewer(profile) {
        try {
            const db = await openBceDB();
            if (!db.objectStoreNames.contains("profiles")) return;
            const tx = db.transaction("profiles", "readwrite");
            const store = tx.objectStore("profiles");
            const req = store.get(profile.memberNumber);
            req.onsuccess = () => {
                const local = req.result;
                if (!local || profile.seen > local.seen) {
                    store.put({
                        memberNumber: profile.memberNumber,
                        name: profile.name,
                        lastNick: profile.lastNick,
                        seen: profile.seen,
                        characterBundle: profile.characterBundle
                    });
                }
            };
        } catch (e) {
            log("❌ save error", e);
        }
    }

    async function loadProfile(memberNumber) {
        const db = await openBceDB();
        if (!db.objectStoreNames.contains("profiles")) return null;
        return new Promise((resolve, reject) => {
            const req = db.transaction("profiles", "readonly").objectStore("profiles").get(memberNumber);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    /* ================= 分享端 ================= */
    const inRoom = () => (typeof ServerPlayerIsInChatRoom === "function" ? ServerPlayerIsInChatRoom() : CurrentScreen === "ChatRoom");

    function bcSendQueueLength() {
        try {
            if (typeof ServerSendRateLimitQueue !== "undefined" && Array.isArray(ServerSendRateLimitQueue)) return ServerSendRateLimitQueue.length;
        } catch { /* 選用訊號，讀不到就當作空 */ }
        return 0;
    }

    function localNotice(text) {
        if (typeof ChatRoomSendLocal === "function") ChatRoomSendLocal(escapeHtml(text), 0);
    }

    /** 依序送出分塊：BC 發送佇列非空就讓路，塊與塊之間至少隔 SHARE_GAP_MS。回傳是否全部送出。 */
    function sendShareChunks(contents) {
        return new Promise(resolve => {
            let index = 0, waitStart = null;
            const step = () => {
                try {
                    if (!inRoom()) return resolve(false);
                    if (index >= contents.length) return resolve(true);
                    if (bcSendQueueLength() > 0) {
                        const now = Date.now();
                        waitStart ??= now;
                        if (now - waitStart > SHARE_STALL_MS) return resolve(false);
                        return void setTimeout(step, SHARE_RETRY_MS);
                    }
                    waitStart = null;
                    ServerSend("ChatRoomChat", { Type: "Hidden", Content: contents[index++] });
                    setTimeout(step, SHARE_GAP_MS);
                } catch (e) { log("❌ chunk send error", e); resolve(false); }
            };
            step();
        });
    }

    async function shareOwn(memberNumber) {
        if (!inRoom() || typeof ServerSend !== "function") return false;
        if (shareInFlight) { localNotice(getI18N().busy); return false; }
        shareInFlight = true;
        try {
            const profile = await loadProfile(memberNumber);
            if (!profile) return false;

            const payload = {
                sharedAt: Date.now(),
                from: {
                    memberNumber: Player?.MemberNumber,
                    name: (typeof CharacterNickname === "function" ? CharacterNickname(Player) : null)
                        || Player?.Nickname || Player?.Name || String(Player?.MemberNumber)
                },
                profile: {
                    memberNumber: profile.memberNumber,
                    name: profile.name,
                    lastNick: profile.lastNick,
                    seen: profile.seen,
                    characterBundle: profile.characterBundle
                }
            };

            const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const built = buildShareMessages(payload, shareId, chunkSizeFor(bcMaxMessageChars()));
            if (built.tooLarge) {
                localNotice(getI18N().tooLarge(Math.ceil(built.chars / 1000), Math.floor(built.limit / 1000)));
                return false;
            }
            const displayName = profile.lastNick || profile.name || memberNumber;
            localNotice(getI18N().sharedSelf(displayName, memberNumber));
            return await sendShareChunks(built.contents);
        } catch (e) {
            log("❌ share error", e);
            return false;
        } finally {
            shareInFlight = false;
        }
    }

    function shareProfile(memberNumber) {
        const fcm = fcmProfiles();
        if (fcm) return fcm.share(memberNumber);
        const lce = lceWps();
        if (lce) return lce.share(memberNumber);
        return shareOwn(memberNumber);
    }

    /* ================= 接收端（Hidden only） ================= */
    function handleShareMessage(data) {
        if (!data?.Content?.startsWith(PROFILE_SHARE_PREFIX)) return false;
        if (higherReceiver()) return false;

        try {
            const sender = Number(data.Sender ?? data.SenderMemberNumber) || 0;
            const result = acceptChunk(sender, data.Content);
            if (result.status !== "complete") return true;
            if (sender === Number(Player?.MemberNumber)) return true;   // 自己分享的不用再顯示一次

            const { profile: p, fromName: claimedName } = result.payload;
            // 來源以伺服器附的送出者為準，不採用 payload 自稱的名字。
            const known = typeof ChatRoomCharacter !== "undefined"
                ? ChatRoomCharacter.find(c => Number(c?.MemberNumber) === sender) : null;
            const fromName = (known && typeof CharacterNickname === "function" ? CharacterNickname(known) : null)
                || claimedName || String(sender);

            // 開啟用的快取鍵由接收端自己產生（不採用對方自訂的 sharedAt）。
            const cacheId = Date.now() * 1000 + (cacheSeq++ % 1000);
            cache.set(`${cacheId}:${p.memberNumber}`, { profile: p, cachedAt: Date.now() });
            pruneCache();

            const displayName = p.lastNick || p.name || p.memberNumber;
            const openToken = `[${PROFILE_SHARE_OPEN_MARK} ${cacheId} ${p.memberNumber}]`;
            const seenDate = new Date(p.seen);
            const seenText = seenDate.getFullYear() + "/" + (seenDate.getMonth() + 1) + "/" + seenDate.getDate();

            ChatRoomSendLocal(
                getI18N().sharedFrom(escapeHtml(fromName), `${openToken} ${escapeHtml(displayName)} (${p.memberNumber})`, seenText),
                0
            );
        } catch (e) {
            log("❌ parse error", e);
        }
        return true;
    }

    /* ================= UI：開啟按鈕 ================= */
    function processShareText(element) {
        if (higherReceiver()) return;
        if (element.dataset.profileShareProcessed === "1") return;
        const html = element.innerHTML;
        if (!html || !html.includes(PROFILE_SHARE_OPEN_MARK)) return;

        const replaced = html.replace(
            /\[PROFILESHARE_OPEN\s+(\d+)\s+(\d+)\]/g,
            (m, cacheId, memberNumber) => {
                const key = `${cacheId}:${memberNumber}`;
                if (!cache.has(key)) return m;
                return `<span class="profileShareOpen" data-key="${key}"
                    style="color:#885CB0;cursor:pointer;">${getI18N().open}</span>`;
            }
        );

        if (replaced !== html) {
            element.innerHTML = replaced;
            element.dataset.profileShareProcessed = "1";

            element.querySelectorAll(".profileShareOpen").forEach(el => {
                if (el.dataset.bound) return;
                el.dataset.bound = "1";

                /* 防止被選取 */
                el.style.userSelect = "none";
                el.style.webkitUserSelect = "none";
                el.style.msUserSelect = "none";
                el.onselectstart = () => false;

                el.addEventListener("mousedown", e => {
                    e.preventDefault();
                    e.stopPropagation();
                });

                el.addEventListener("click", e => {
                    e.preventDefault();
                    e.stopPropagation();

                    const entry = cache.get(el.dataset.key);
                    if (!entry) return;

                    const p = entry.profile;
                    try {
                        const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber);
                        C.BCESeen = p.seen;
                        InformationSheetLoadCharacter(C);
                        saveIfNewer(p);
                    } catch (err) {
                        log("❌ open error", err);
                    }
                });
            });
        }
    }

    /* ================= Profile UI：分享按鈕 ================= */
    function enhanceProfilesUI() {
        // FCM 的入口位於自己的面板，不與此處衝突；只有 LCE 也在
        // /profiles 建立分享按鈕，因此獨立 WPS 僅對 LCE 的 UI 避讓。
        if (lceWps()) {
            document.querySelectorAll(".liko-wps-share").forEach(button => button.remove());
            return;
        }
        document.querySelectorAll("a.bce-profile-open").forEach(open => {
            if (open.dataset.profileShareAdded) return;
            open.dataset.profileShareAdded = "1";

            const text = open.parentElement?.textContent || "";
            const m = text.match(/\((\d+)\)/);
            if (!m) return;

            const memberNumber = Number(m[1]);
            const btn = document.createElement("a");
            btn.className = "liko-wps-share";
            btn.href = "#";
            btn.textContent = getUILabel("share");
            btn.style.marginLeft = "6px";
            btn.style.color = "#885CB0";
            btn.style.userSelect = "none";
            btn.style.webkitUserSelect = "none";
            btn.style.msUserSelect = "none";

            btn.addEventListener("mousedown", e => e.preventDefault());

            btn.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                shareProfile(memberNumber);
            });

            open.after(btn);
        });
    }

    /* ================= 初始化（純 ModSDK） ================= */
    if (!window.bcModSdk?.registerMod) {
        console.warn("[Liko-WPS] ModSDK not found, plugin disabled");
        return;
    }

    const modApi = bcModSdk.registerMod({
        name: "Liko - WPS",
        fullName: "Liko's WCE Profile Share",
        version: MOD_VER,
        repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
    });

    async function initialize() {
        if (typeof Player === "undefined" || Player?.MemberNumber === undefined) {
            await new Promise(resolve => {
                const remove = modApi.hookFunction("LoginResponse", 0, (args, next) => {
                    const result = next(args);
                    queueMicrotask(() => {
                        if (typeof Player === "undefined" || Player?.MemberNumber === undefined) return;
                        remove();
                        resolve();
                    });
                    return result;
                });
            });
        }

        modApi.hookFunction("ChatRoomMessage", 0, (args, next) => {
            const data = args[0];
            if (data?.Type === "Hidden" && handleShareMessage(data)) return;
            return next(args);
        });

        modApi.hookFunction("OnlineProfileRun", 0, (args, next) => {
            const ret = next(args);
            enhanceProfilesUI();
            return ret;
        });

        setInterval(() => {
            document.querySelectorAll(".ChatMessageLocalMessage").forEach(processShareText);
            enhanceProfilesUI();
        }, 500);
        log(`🐈‍⬛ [WPS] ✅ v${MOD_VER} loaded`);
    }
    initialize();
})();
