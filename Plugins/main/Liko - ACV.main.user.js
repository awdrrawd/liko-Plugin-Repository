// ==UserScript==
// @name         Liko - ACV
// @name:zh      Liko的自動創建影片
// @namespace    https://likolisu.dev/
// @version      1.3.1
// @description  Auto video player - detects video links and adds play buttons
// @author       likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.3.1";
    if (window.Liko.ACV) return;
    window.Liko.ACV = MOD_VER;
    
    if (window.LikoVideoPlayerInstance) return;

    let modApi;
    let isEnabled = true;
    let scanInterval;

    // ─────────────────────────────────────────────────────────────
    //  常數 & 設定
    // ─────────────────────────────────────────────────────────────

    // BC 聊天區域約 980px 可用寬；考慮上下 UI 高度上限設 520px
    const PLAYER_MAX_W = 980;
    const PLAYER_MAX_H = 520;

    const PLATFORM_DISPLAY_NAME = {
        bilibiliVideo:   "Bilibili",
        bilibiliBangumi: "Bilibili",
        youtube:         "YouTube",
        youtubeShorts:   "YouTube",
        youtubeLive:     "YouTube Live",
        facebook:        "Facebook",
        instagram:       "Instagram",
        spotify:         "Spotify",
        twitter:         "Twitter/X",
        twitch:          "Twitch",
        vimeo:           "Vimeo",
        niconico:        "Niconico",
        douyin:          "抖音",
    };

    // ─────────────────────────────────────────────────────────────
    //  影片平台 Patterns
    //  ratio: "16:9" | "9:16" | "1:1" | "auto"(twitter/spotify)
    // ─────────────────────────────────────────────────────────────
    const videoPatterns = {
        youtubeShorts: {
            regex: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
            embedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,
            ratio: "9:16",
        },
        youtubeLive: {
            regex: /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
            embedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,
            ratio: "16:9",
        },
        youtube: {
            regex: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            embedUrl: (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,
            ratio: "16:9",
        },
        bilibiliVideo: {
            regex: /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
            embedUrl: (id) => `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0&isOutside=true`,
            ratio: "16:9",
        },
        bilibiliBangumi: {
            regex: /bilibili\.com\/bangumi\/play\/(ep|ss)(\d+)/,
            embedUrl: (type, id) =>
                `https://player.bilibili.com/player.html?${type === "ep" ? "ep_id" : "season_id"}=${id}&autoplay=0&isOutside=true`,
            ratio: "16:9",
        },
        douyin: {
            regex: /douyin\.com\/(?:video\/(\d+)|jingxuan\?modal_id=(\d+))/,
            embedUrl: (id) => `https://open.douyin.com/player/video?vid=${id}&autoplay=0`,
            ratio: "9:16",
            referrerpolicy: "unsafe-url", // 抖音 embed 需要寬鬆的 referrer，否則無法播放
            name: "抖音",
        },
        instagram: {
            regex: /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/,
            embedUrl: (id) => `https://www.instagram.com/p/${id}/embed/`,
            ratio: "9:16",
        },
        twitch: {
            regex: /twitch\.tv\/(?:(?:videos\/([0-9]+))|([a-zA-Z0-9_]+))(?:[\/?].*)?/,
            ratio: "16:9",
        },
        vimeo: {
            regex: /vimeo\.com\/([0-9]+)/,
            embedUrl: (id) => `https://player.vimeo.com/video/${id}`,
            ratio: "16:9",
        },
        niconico: {
            regex: /nicovideo\.jp\/watch\/(sm[0-9]+)/,
            embedUrl: (id) => `https://embed.nicovideo.jp/watch/${id}`,
            ratio: "16:9",
        },
        twitter: {
            regex: /(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/,
            ratio: "auto",
        },
        facebook: {
            regex: /facebook\.com\/(reel\/\d+|watch\/\?v=\d+|.*\/videos\/\d+)/,
            embedUrl: (url) =>
                `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
            ratio: "9:16",
        },
        spotify: {
            regex: /open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/,
            ratio: "auto",
        },
    };

    // ─────────────────────────────────────────────────────────────
    //  URL 偵測
    // ─────────────────────────────────────────────────────────────


    function detectVideoUrl(url) {
        for (const platform in videoPatterns) {
            const p = videoPatterns[platform];
            const m = url.match(p.regex);
            if (!m) continue;
            const base = { platform, originalUrl: url, platformName: PLATFORM_DISPLAY_NAME[platform] || platform };
            if (platform === "twitch")          return { ...base, id: m[1] || m[2], type: m[1] ? "video" : "channel" };
            if (platform === "bilibiliBangumi") return { ...base, type: m[1], id: m[2] };
            if (platform === "facebook")        return { ...base };
            if (platform === "spotify")         return { ...base, type: m[1], id: m[2] };
            // ★ 抖音有兩種 URL 格式：video/(m[1]) 和 jingxuan?modal_id=(m[2])
            if (platform === "douyin")          return { ...base, id: m[1] || m[2] };
            return { ...base, id: m[1] };
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    //  ★ 影片播放器 HTML 生成（修正尺寸）
    //    16:9 → 最大寬 980px，高度由 aspect-ratio 決定（≈551px）
    //    9:16 → 固定高 500px，寬度由 aspect-ratio 決定（≈281px）
    // ─────────────────────────────────────────────────────────────
    function buildPlayerHTML(videoInfo) {
        const p = videoPatterns[videoInfo.platform];

        // ── Twitter ──
        if (videoInfo.platform === "twitter") {
            if (!window.twttr) {
                const s = document.createElement("script");
                s.src = "https://platform.twitter.com/widgets.js";
                s.async = true;
                document.head.appendChild(s);
            }
            return `<div style="max-width:500px;margin:0.3em auto;">
                <blockquote class="twitter-tweet" data-media-max-width="500">
                    <a href="https://twitter.com/i/status/${videoInfo.id}"></a>
                </blockquote>
            </div>`;
        }

        // ── Spotify ──
        if (videoInfo.platform === "spotify") {
            const H = { track:80, album:352, playlist:352, artist:352, episode:152, show:232 };
            return `<div style="width:100%;max-width:500px;margin:0.3em 0;">
                <iframe src="https://open.spotify.com/embed/${videoInfo.type}/${videoInfo.id}"
                    width="100%" height="${H[videoInfo.type] ?? 80}" frameborder="0" loading="lazy"
                    allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture"
                    style="border-radius:12px;"></iframe>
            </div>`;
        }

        // ── 取得 src ──
        let src;
        if (videoInfo.platform === "twitch") {
            src = videoInfo.type === "video"
                ? `https://player.twitch.tv/?video=${videoInfo.id}&parent=${location.hostname}&autoplay=false`
                : `https://player.twitch.tv/?channel=${videoInfo.id}&parent=${location.hostname}&autoplay=false`;
        } else if (videoInfo.platform === "facebook") {
            src = p.embedUrl(videoInfo.originalUrl);
        } else if (videoInfo.platform === "bilibiliBangumi") {
            src = p.embedUrl(videoInfo.type, videoInfo.id);
        } else {
            src = p.embedUrl(videoInfo.id);
        }

        // ── 抖音：直向 9:16，350×622 ──
        if (videoInfo.platform === "douyin") {
            return `<div style="width: 100%; max-width: 350px; margin: 0.3em auto; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 622px;">
                    <iframe src="${src}"
                            frameborder="0" allowfullscreen
                            referrerpolicy="unsafe-url"
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`;
        }

        const [rw, rh] = p.ratio.split(":").map(Number);
        const isPortrait = rh > rw;
        const rp = p.referrerpolicy || "strict-origin-when-cross-origin"; // 各平台可覆寫

        // ★ aspect-ratio 直接放在 iframe，不用外層 overflow:hidden
        //   避免裁掉控制列造成黑邊/底部被吃
        if (isPortrait) {
            const pw = Math.round(PLAYER_MAX_H * rw / rh);
            return `<iframe src="${src}"
                style="display:block;width:${pw}px;height:${PLAYER_MAX_H}px;border:none;border-radius:6px;background:#000;margin:0.3em 0;"
                frameborder="0" scrolling="no" allowfullscreen
                referrerpolicy="${rp}"
                allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share"></iframe>`;
        } else {
            return `<iframe src="${src}"
                style="display:block;width:100%;max-width:${PLAYER_MAX_W}px;aspect-ratio:${rw}/${rh};border:none;border-radius:6px;background:#000;margin:0.3em 0;"
                frameborder="0" scrolling="no" allowfullscreen
                referrerpolicy="${rp}"
                allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share"></iframe>`;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  訊息掃描：🎬 按鈕（行內）
    // ─────────────────────────────────────────────────────────────
    function processInlineButtons(element) {
        if (!isEnabled) return;
        const links = element.querySelectorAll("a[href]:not([data-liko-processed])");
        links.forEach((link) => {
            const href = link.getAttribute("href");
            if (!href) return;
            const videoInfo = detectVideoUrl(href);
            if (!videoInfo) return; // 行內只處理影片（資訊卡走 SendLocal）

            const btn = document.createElement("span");
            btn.className = "likoVideoButton";
            btn.textContent = "🎬";
            btn.title = `播放 ${videoInfo.platformName}`;
            btn.style.cssText = `
                color:#ff4757;cursor:pointer;font-size:1.2em;
                padding:3px 6px;border-radius:4px;
                background:rgba(255,71,87,0.1);border:1px solid rgba(255,71,87,0.3);
                transition:all 0.15s;display:inline-block;vertical-align:middle;
                margin-left:5px;min-width:26px;text-align:center;
            `;

            let playerEl = null;
            btn.addEventListener("click", (e) => {
                if (!isEnabled) return;
                e.preventDefault(); e.stopPropagation();
                const msgContent = btn.closest(".chat-room-message-content");
                if (!msgContent) return;

                if (!playerEl) {
                    playerEl = document.createElement("div");
                    playerEl.className = "likoVideoIframe";
                    playerEl.style.position = "relative";
                    playerEl.innerHTML = buildPlayerHTML(videoInfo);

                    const closeBtn = document.createElement("button");
                    closeBtn.textContent = "✕";
                    closeBtn.style.cssText = `
                        position:absolute;top:6px;right:6px;
                        background:rgba(0,0,0,0.75);color:#fff;border:none;
                        border-radius:50%;width:26px;height:26px;cursor:pointer;
                        font-size:13px;font-weight:bold;z-index:10;line-height:1;
                    `;
                    closeBtn.addEventListener("click", () => {
                        playerEl.remove(); playerEl = null;
                        btn.textContent = "🎬"; btn.style.color = "#ff4757";
                    });
                    playerEl.appendChild(closeBtn);

                    if (videoInfo.platform === "twitter" && window.twttr)
                        window.twttr.widgets.load(playerEl);

                    msgContent.appendChild(playerEl);
                    btn.textContent = "📺"; btn.style.color = "#2ed573";
                } else {
                    const visible = playerEl.style.display !== "none";
                    playerEl.style.display = visible ? "none" : "block";
                    btn.textContent = visible ? "🎬" : "📺";
                    btn.style.color = visible ? "#ff4757" : "#2ed573";
                }
            });

            link.before(btn);
            link.before(document.createTextNode(" "));
            link.dataset.likoProcessed = "1";
        });
    }

    function scanChatMessages() {
        if (!isEnabled) return;
        document.querySelectorAll(".chat-room-message-content,[role='log']>div").forEach((el) => {
            processInlineButtons(el);
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  插件控制
    // ─────────────────────────────────────────────────────────────

    // ★ MutationObserver：新訊息出現時立刻掃，不等 interval
    //   同時保留 interval 作為 fallback（防止 observer 遺漏）
    let observer = null;

    function startObserver() {
        if (observer) return;
        const chatLog = document.querySelector('#TextAreaChatLog, [role="log"]');
        if (!chatLog) return;
        observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;
            // 只有真的新增節點才觸發（避免我們自己插按鈕時再掃）
            const hasNew = mutations.some(m =>
                [...m.addedNodes].some(n => n.nodeType === 1 && !n.classList?.contains('likoVideoButton'))
            );
            if (hasNew) scanChatMessages();
        });
        observer.observe(chatLog, { childList: true, subtree: false });
    }

    function stopObserver() {
        observer?.disconnect();
        observer = null;
    }

    function enablePlugin() {
        isEnabled = true;
        // 立刻掃一次
        scanChatMessages();
        // MutationObserver（即時）
        startObserver();
        // interval 作 fallback（萬一 observer miss 的情況）
        if (!scanInterval) {
            scanInterval = setInterval(scanChatMessages, 3000); // 可以調長，observer 才是主力
        }
    }

    function disablePlugin() {
        isEnabled = false;
        stopObserver();
        clearInterval(scanInterval); scanInterval = null;
        document.querySelectorAll(".likoVideoButton,.likoVideoIframe").forEach((el) => el.remove());
        document.querySelectorAll("[data-liko-processed]").forEach((el) => {
            delete el.dataset.likoProcessed;
        });
    }

    function togglePlugin() { isEnabled ? disablePlugin() : enablePlugin(); return isEnabled; }
    function destroyPlugin() { disablePlugin(); stopObserver(); delete window.LikoVideoPlayerInstance; }

    window.LikoVideoPlayerInstance = {
        isEnabled: () => isEnabled,
        enable: enablePlugin,
        disable: disablePlugin,
        toggle: togglePlugin,
        destroy: destroyPlugin,
    };

    // ─────────────────────────────────────────────────────────────
    //  BC Hooks
    // ─────────────────────────────────────────────────────────────
    function hookChatRoomLoad() {
        if (!modApi?.hookFunction) return;

        modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
            const result = next(args);
            setTimeout(() => {
                if (!window.LikoVideoPlayerWelcomed && isEnabled) {
                    const platforms = [...new Set(
                        Object.keys(videoPatterns).map((k) => PLATFORM_DISPLAY_NAME[k] || k)
                    )].join(", ");
                    ChatRoomSendLocal(
                        `<p style='background:#4C2772;color:#EEE;display:block;padding:5px;'>
                         <b>🎬 Liko's ACV v${MOD_VER}</b>
                         <br>· 偵測影片連結，插入 🎬 按鈕，點擊展開播放器
                         <br>· 支援: ${platforms}
                         </p>`.replace(/\s+/g, " "),
                        10000
                    );
                    window.LikoVideoPlayerWelcomed = true;
                }
            }, 1000);
            return result;
        });

        modApi.hookFunction("ChatRoomMessage", 0, (args, next) => {
            next(args);
            setTimeout(() => scanChatMessages(), 150);
        });

        // 自己發訊息：只重掃 🎬 按鈕，不重複生成資訊卡
        // （自己的訊息會透過 ChatRoomMessage hook 回傳，已在那邊處理）
        modApi.hookFunction("ServerSend", 0, (args, next) => {
            next(args);
            const [type, data] = args;
            if (type === "ChatRoomChat" && data?.Type === "Chat") {
                setTimeout(() => scanChatMessages(), 200);
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  初始化
    // ─────────────────────────────────────────────────────────────
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko - ACV",
                fullName: "Liko's Automatically create video.",
                version: MOD_VER,
                repository: "自動創建影片 | Automatically create video.",
            });
        }
    } catch (e) {
        console.error("❌ ACV init failed:", e.message);
    }

    hookChatRoomLoad();
    enablePlugin();
    window.addEventListener("beforeunload", destroyPlugin);

})();
