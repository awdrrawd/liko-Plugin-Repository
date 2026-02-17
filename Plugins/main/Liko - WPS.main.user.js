// ==UserScript==
// @name         Liko - WPS
// @namespace    https://likulisu.dev/
// @version      1.1.1
// @description  WCE Profile Share
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    /* ================= 防止重複載入 ================= */
    if (window.LikoWPSInstance) return;
    window.LikoWPSInstance = true;

    /* ================= 基本設定 ================= */
    const PREFIX = "[LIKOSHARE]";
    const OPEN_MARK = "LIKOSHARE_OPEN";
    const CHUNK_SIZE = 800;
    const VERSION = "1.1.1";

    const incoming = new Map();
    const cache = new Map();
    window.__LIKOSHARE_CACHE__ = cache;

    const log = (...a) => console.log("[Liko-WPS]", ...a);

    /* ================= Language ================= */
    function detectLanguage() {
        let gameLang = null;

        if (typeof TranslationLanguage !== "undefined") {
            gameLang = TranslationLanguage;
        }

        const browserLang = navigator.language || navigator.userLanguage || "en";
        const lang = gameLang || browserLang;

        // 只把「簡中環境」當 CN
        return lang.toLowerCase().startsWith("zh")
        || lang.toLowerCase().includes("cn");
    }
    const isCN = detectLanguage();

    function getI18N() {
        const isCN = detectLanguage();

        return {
            sharedSelf: isCN
            ? (name, id) => `📜 已分享 ${name} (${id}) 的 Profile`
            : (name, id) => `📜 Shared profile: ${name} (${id})`,

            sharedFrom: isCN
            ? (from, display, date) =>
            `📜 ${from} 分享了 ${display} 保存於: ${date}`
            : (from, display, date) =>
            `📜 ${from} shared a profile: ${display} saved: ${date}`
        };
    }
    function getUILabel(key) {
        const isCN = detectLanguage();
        const UI = {
            share: isCN ? "分享 " : "Share "
        };
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
            log("save error", e);
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
                    Content: `${PREFIX} ${shareId} ${i + 1}/${total} ${chunk}`
                });
            }
            ChatRoomSendLocal(getI18N().sharedSelf(displayName, memberNumber),0);
        };
    }

    /* ================= 接收端（Hidden only） ================= */
    function handleShareMessage(data) {
        if (!data?.Content?.startsWith(PREFIX)) return false;

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
                const openToken = `[${OPEN_MARK} ${payload.sharedAt} ${p.memberNumber}]`;

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
            log("parse error", e);
        }
        return true;
    }

    /* ================= UI：開啟按鈕 ================= */
    function processShareText(element) {
        if (element.dataset.likoShareProcessed === "1") return;
        const html = element.innerHTML;
        if (!html || !html.includes(OPEN_MARK)) return;

        const replaced = html.replace(
            /\[LIKOSHARE_OPEN\s+(\d+)\s+(\d+)\]/g,
            (m, sharedAt, memberNumber) => {
                const key = `${sharedAt}:${memberNumber}`;
                if (!cache.has(key)) return m;
                return `<span class="likoShareOpen" data-key="${key}"
                    style="color:#885CB0;cursor:pointer;">▶ 開啟</span>`;
            }
        );

        if (replaced !== html) {
            element.innerHTML = replaced;
            element.dataset.likoShareProcessed = "1";

            element.querySelectorAll(".likoShareOpen").forEach(el => {
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
        document.querySelectorAll("a.bce-profile-open").forEach(open => {
            if (open.dataset.likoShareAdded) return;
            open.dataset.likoShareAdded = "1";

            const text = open.parentElement?.textContent || "";
            const m = text.match(/\((\d+)\)/);
            if (!m) return;

            const memberNumber = Number(m[1]);
            const btn = document.createElement("a");
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
        name: "Liko's WPS",
        fullName: "Liko's WCE Profile Share",
        version: VERSION,
        repository: "WCE個人資料分享 | WCE Profile Share"
    });

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
    //log("Liko-WPS", VERSION);
})();
