// ==UserScript==
// @name         Liko - WPS
// @namespace    https://likulisu.dev/
// @version      1.0.0
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

    const PREFIX = "[LIKOSHARE]";
    const OPEN_MARK = "LIKOSHARE_OPEN";
    const CHUNK_SIZE = 800;
    const modversion = "1.0.0";
    let modApi = null;

    const log = (...a) => console.log("[LikoShare]", ...a);

    // 等待 bcModSdk
    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== "undefined" && bcModSdk?.registerMod) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    /* ================= IndexedDB ================= */
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

    async function getProfile(memberNumber) {
        const db = await openBceDB();
        return new Promise(resolve => {
            const tx = db.transaction("profiles", "readonly");
            const store = tx.objectStore("profiles");
            const req = store.get(memberNumber);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    }

    function idbGet(store, key) {
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function saveIfNewer(profile) {
        try {
            const db = await openBceDB();
            const tx = db.transaction("profiles", "readwrite");
            const store = tx.objectStore("profiles");
            const local = await idbGet(store, profile.memberNumber);
            //log("saveIfNewer local:", local);
            if (!local || profile.seen > local.seen) {
                store.put(profile);
            }
        } catch (e) {
            log("saveIfNewer error", e);
        }
    }


    function buildPayload(profile) {
        return {
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
    }

    async function shareProfile(memberNumber) {
        const profile = await getProfile(memberNumber);
        if (!profile) return;

        const payload = buildPayload(profile);
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const total = Math.ceil(encoded.length / CHUNK_SIZE);

        for (let i = 0; i < total; i++) {
            const chunk = encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            ServerSend("ChatRoomChat", {
                Type: "Hidden",
                Content: `${PREFIX} ${shareId} ${i + 1}/${total} ${chunk}`
            });
        }
        log("shared", memberNumber, total);
    }

    /* ================= 接收端 ================= */
    const incoming = new Map();
    window.__LIKOSHARE_CACHE__ = new Map();

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
                window.__LIKOSHARE_CACHE__.set(key, payload);

                const p = payload.profile;
                const from = payload.from || {};
                const isSelf = from.memberNumber === Player?.MemberNumber;
                if (isSelf) {
                    ChatRoomSendLocal(`📜 已分享 ${p.lastNick || p.name} (${p.memberNumber}) 的 Profile`, 0);
                } else {
                    const fromName = from.name || from.memberNumber || "某人";
                    ChatRoomSendLocal(`📜 ${fromName} 分享了 [${OPEN_MARK} ${payload.sharedAt} ${p.memberNumber}] ${p.lastNick || p.name} (${p.memberNumber}) 的 Profile`, 0);
                }
            }
        } catch (e) {
            log("chunk error", e);
        }
        return true;
    }

    /* ================= UI ================= */
    function processShareText(element) {
        if (element.dataset.likoShareProcessed === "1") return;
        const html = element.innerHTML;
        if (!html || !html.includes(OPEN_MARK)) return;

        let changed = false;
        const replaced = html.replace(
            new RegExp(`\\[LIKOSHARE_OPEN\\s+(\\d+)\\s+(\\d+)\\]`, "g"),
            (m, sharedAt, memberNumber) => {
                const key = `${sharedAt}:${memberNumber}`;
                if (!window.__LIKOSHARE_CACHE__?.has(key)) return m;
                changed = true;
                return `<span class="likoShareOpen" data-share-key="${key}" style="color:#885CB0;cursor:pointer;">▶ 開啟</span>`;
            }
        );

        if (changed) {
            element.innerHTML = replaced;
            element.dataset.likoShareProcessed = "1";
            bindShareButtons(element);
        }
    }

    function bindShareButtons(root) {
        root.querySelectorAll(".likoShareOpen").forEach(el => {
            if (el.dataset.likoEventAdded) return;
            el.dataset.likoEventAdded = "1";
            const key = el.dataset.shareKey;
            const payload = window.__LIKOSHARE_CACHE__?.get(key);
            if (!payload) return;
            el.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                const p = payload.profile;
                const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber);
                InformationSheetLoadCharacter(C);
                saveIfNewer(p);
            });
        });
    }

    function enhanceProfilesUI() {
        document.querySelectorAll("a.bce-profile-open").forEach(open => {
            if (open.dataset.likoShareAdded) return;
            open.dataset.likoShareAdded = "1";
            const text = open.parentElement?.textContent || "";
            const m = text.match(/\((\d+)\)/);
            if (!m) return;
            const memberNumber = Number(m[1]);
            const share = document.createElement("a");
            share.href = "#";
            share.textContent = "分享";
            share.style.marginLeft = "6px";
            share.style.color = "#885CB0";
            share.style.cursor = "pointer";
            share.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                shareProfile(memberNumber);
            });
            open.after(share);
        });
    }

    /* ================= 初始化 ================= */
    (async () => {
        const ok = await waitForBcModSdk();
        if (ok) {
            try {
                modApi = bcModSdk.registerMod({
                    name: "Liko - WPS",
                    fullName: "Liko's WCE Profile Share",
                    version: modversion,
                    repository: "https://likulisu.dev/"
                });
                log("modApi 註冊成功");
            } catch (e) {
                console.warn("[LikoShare] modApi.registerMod 失敗，fallback 模式：", e.message);
            }
        }

        // 攔截 ChatRoomMessage：處理分享訊息
        if (modApi && typeof modApi.hookFunction === "function") {
            modApi.hookFunction("ChatRoomMessage", 0, (args, next) => {
                const data = args[0];
                if (handleShareMessage(data)) return; // 已處理，不傳給原始函式
                return next(args);
            });

            // 在 profile 渲染時插入分享按鈕
            modApi.hookFunction("OnlineProfileRun", 0, (args, next) => {
                const ret = next(args);
                enhanceProfilesUI();
                return ret;
            });
        } else {
            // fallback：直接覆蓋 ChatRoomMessage
            const _ChatRoomMessage = window.ChatRoomMessage;
            window.ChatRoomMessage = function (data) {
                if (handleShareMessage(data)) return;
                return _ChatRoomMessage.apply(this, arguments);
            };
        }

        // 定時掃描 UI：保險機制，避免 UI 被覆蓋
        setInterval(() => {
            document.querySelectorAll(".chat-room-message-content").forEach(processShareText);
            document.querySelectorAll(".ChatMessageLocalMessage").forEach(processShareText);
            enhanceProfilesUI();
        }, 500);

        log("loaded (Liko - WPS)");
    })();
})();
