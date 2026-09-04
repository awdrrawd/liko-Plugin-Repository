// ==UserScript==
// @name         Liko - WPS
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.3
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
    const MOD_VER = "1.1.3";
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
    
    const PROFILE_SHARE_PREFIX = "[PROFILESHARE]";
    const PROFILE_SHARE_OPEN_MARK = "PROFILESHARE_OPEN";
    const CHUNK_SIZE = 800;

    const incoming = new Map();
    const cache = new Map();

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
            : (from, display, date) => `📜 ${from} shared a profile: ${display} saved: ${date}`
        };
    }

    function getUILabel(key) {
        const UI = { share: isCN ? "分享 " : "Share " };
        return UI[key] || key;
    }
    /* ================= IndexedDB（沿用你原本邏輯） ================= */
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
            const tx = db.transaction("profiles", "readwrite");
            const store = tx.objectStore("profiles");
            const req = store.get(profile.memberNumber);
            req.onsuccess = () => {
                const local = req.result;
                if (!local || profile.seen > local.seen) {
                    store.put(profile);
                }
            };
        } catch (e) {
            log("❌ save error", e);
        }
    }

    /* ================= 分享端 ================= */
    async function shareProfile(memberNumber) {
        const db = await openBceDB();
        const tx = db.transaction("profiles", "readonly");
        const store = tx.objectStore("profiles");

        const req = store.get(memberNumber);
        req.onsuccess = () => {
            const profile = req.result;
            if (!profile) return;

            const payload = {
                sharedAt: Date.now(),
                from: {
                    memberNumber: Player?.MemberNumber,
                    name: Player?.Nickname || Player?.Name || String(Player?.MemberNumber)
                },
                profile: {
                    memberNumber: profile.memberNumber,
                    name: profile.name,
                    lastNick: profile.lastNick,
                    seen: profile.seen,
                    characterBundle: profile.characterBundle
                }
            };

            const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
            const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const total = Math.ceil(encoded.length / CHUNK_SIZE);
            const displayName = profile.lastNick || profile.name || memberNumber;

            for (let i = 0; i < total; i++) {
                const chunk = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                ServerSend("ChatRoomChat", {
                    Type: "Hidden",
                    Content: `${PROFILE_SHARE_PREFIX} ${shareId} ${i + 1}/${total} ${chunk}`
                });
            }
            ChatRoomSendLocal(getI18N().sharedSelf(displayName, memberNumber),0);
            return true;
        };
    }

    /* ================= 接收端（Hidden only） ================= */
    function handleShareMessage(data) {
        if (!data?.Content?.startsWith(PROFILE_SHARE_PREFIX)) return false;
        if (higherReceiver()) return false;

        try {
            const parts = data.Content.split(" ");
            const shareId = parts[1];
            const [idx, total] = parts[2].split("/").map(Number);
            const chunk = parts.slice(3).join(" ");

            if (!incoming.has(shareId)) {
                incoming.set(shareId, { total, chunks: [] });
            }

            const entry = incoming.get(shareId);
            entry.chunks[idx - 1] = chunk;

            if (entry.chunks.filter(Boolean).length === entry.total) {
                incoming.delete(shareId);

                const encoded = entry.chunks.join("");
                const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
                const key = `${payload.sharedAt}:${payload.profile.memberNumber}`;
                cache.set(key, payload);

                const p = payload.profile;
                const from = payload.from || {};
                const fromName = from.name || from.memberNumber || "某人";
                const isSelf = from.memberNumber === Player?.MemberNumber;
                const displayName = p.lastNick || p.name || p.memberNumber;
                const openToken = `[${PROFILE_SHARE_OPEN_MARK} ${payload.sharedAt} ${p.memberNumber}]`;

                const seenDate = new Date(p.seen);
                const seenText =
                      seenDate.getFullYear() + "/" +
                      (seenDate.getMonth() + 1) + "/" +
                      seenDate.getDate();

                if (!isSelf) {
                    ChatRoomSendLocal(getI18N().sharedFrom(fromName,`${openToken} ${displayName} (${p.memberNumber})`,seenText),0);
                }

            }
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
            (m, sharedAt, memberNumber) => {
                const key = `${sharedAt}:${memberNumber}`;
                if (!cache.has(key)) return m;
                return `<span class="profileShareOpen" data-key="${key}"
                    style="color:#885CB0;cursor:pointer;">▶ 開啟</span>`;
            }
        );

        if (replaced !== html) {
            element.innerHTML = replaced;
            element.dataset.profileShareProcessed = "1";

            element.querySelectorAll(".profileShareOpen").forEach(el => {
                if (el.dataset.bound) return;
                el.dataset.bound = "1";

                /* 防止被選取（關鍵在這） */
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

                    const payload = cache.get(el.dataset.key);
                    if (!payload) return;

                    const p = payload.profile;
                    const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber);
                    InformationSheetLoadCharacter(C);
                    saveIfNewer(p);
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
