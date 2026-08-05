// ==UserScript==
// @name         Liko - ACV
// @name:zh      Liko的自動創建影片
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.5.0
// @description  Auto video player - detects video links and adds play buttons
// @author       likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20ACV.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20ACV.main.user.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.ACV) return;
    const MOD_VER = "1.5.0";
    window.Liko.ACV = MOD_VER;

    if (window.LikoVideoPlayerInstance) return;

    let modApi;
    let isEnabled = true;
    let scanInterval;

    // ─────────────────────────────────────────────────────────────
    //  常數 & 設定
    // ─────────────────────────────────────────────────────────────

    const PLAYER_MAX_W = 980;
    const PLAYER_MAX_H = 520;

    // fallback interval：主要靠 hook ChatRoomMessageDisplay 即時處理新訊息，
    // 這裡只當作「以防萬一」的保險（例如非本插件涵蓋的訊息路徑），
    // 拉長到 20 秒把背景開銷降到最低
    const FALLBACK_SCAN_MS = 20000;

    // 每一則訊息在 BC 原始碼裡都是直接 append 到 #TextAreaChatLog 的 <div>
    // （見 ChatRoomAppendChat/ChatRoomMessageDisplay），用這個選到的就是「一整則訊息」的容器，
    // 不會誤選到回覆引用用的 .chat-room-message-content 小 span
    const CHAT_LOG_SELECTOR = "#TextAreaChatLog>div";

    const PLATFORM_DISPLAY_NAME = {
        youtube:         "YouTube",
        youtubeShorts:   "YouTube",
        youtubeLive:     "YouTube Live",
        bilibiliVideo:   "Bilibili",
        bilibiliBangumi: "Bilibili",
        facebook:        "Facebook",
        twitch:          "Twitch",
        vimeo:           "Vimeo",
        niconico:        "Niconico",
        douyin:          "抖音",
        catbox:          "Catbox/Litterbox",
        githubRaw:       "GitHub",
        streamable:      "Streamable",
        dailymotion:     "Dailymotion",
        imgurVideo:      "Imgur",
        discordCdn:      "Discord",
        pornhub:         "Pornhub",
        twitter:         "Twitter/X",
        instagram:       "Instagram",
        spotify:         "Spotify",
        soundcloud:      "SoundCloud",
        appleMusic:      "Apple Music",
        neteaseMusic:    "網易雲音樂",
    };

    // ─────────────────────────────────────────────────────────────
    //  影片平台 Patterns
    //  ratio 除了保留原字串（顯示/除錯用），額外預先算好 ratioW/ratioH 數字，
    //  避免每次 buildPlayerHTML 都重新 split + map(Number) 解析字串
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
            referrerpolicy: "unsafe-url",
            name: "抖音",
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
        catbox: {
            regex: /(?:files\.catbox\.moe|litter(?:box)?\.catbox\.moe)\/([a-zA-Z0-9]+\.(?:mp4|webm|mov|m4v|ogg|ogv))/i,
            ratio: "auto",
        },
        githubRaw: {
            regex: /(?:github\.com\/[^\/\s]+\/[^\/\s]+\/raw\/[^\s]+|raw\.githubusercontent\.com\/[^\s]+)\.(mp4|webm|mov|m4v|ogg|ogv)(?:\?[^\s]*)?/i,
            ratio: "auto",
        },
        streamable: {
            regex: /streamable\.com\/([a-zA-Z0-9]+)/,
            embedUrl: (id) => `https://streamable.com/e/${id}`,
            ratio: "16:9",
        },
        dailymotion: {
            regex: /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
            embedUrl: (id) => `https://www.dailymotion.com/embed/video/${id}`,
            ratio: "16:9",
        },
        imgurVideo: {
            regex: /i\.imgur\.com\/([a-zA-Z0-9]+\.(?:mp4|webm|mov|m4v|ogv))/i,
            ratio: "auto",
        },
        discordCdn: {
            regex: /(?:cdn\.discordapp\.com|media\.discordapp\.net)\/attachments\/[^\s]+\.(?:mp4|webm|mov|m4v|ogg|ogv)(?:\?[^\s]*)?/i,
            ratio: "auto",
        },
        pornhub: {
            regex: /(?:[\w-]+\.)?pornhub\.com\/view_video\.php\?viewkey=([A-Za-z0-9]+)/,
            embedUrl: (id) => `https://www.pornhub.com/embed/${id}`,
            ratio: "16:9",
        },
        twitch: {
            regex: /twitch\.tv\/(?:(?:videos\/([0-9]+))|([a-zA-Z0-9_]+))(?:[\/?].*)?/,
            ratio: "16:9",
        },
        instagram: {
            regex: /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/,
            embedUrl: (id) => `https://www.instagram.com/p/${id}/embed/`,
            ratio: "9:16",
        },
        soundcloud: {
            regex: /(?:soundcloud\.com\/[^\s]+|snd\.sc\/[^\s]+)/i,
            ratio: "auto",
        },
        spotify: {
            regex: /open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/,
            ratio: "auto",
        },
        neteaseMusic: {
            regex: /music\.163\.com\/(?:#\/)?song(?:\?id=|\/)(\d+)/,
            ratio: "auto",
        },
        appleMusic: {
            regex: /music\.apple\.com\/[a-z]{2}\/(?:album|song|playlist|artist)\/[^\s]+/i,
            ratio: "auto",
        },
    };

    // 預先算好每個平台的數字比例，render 階段直接讀，不再重複 split/parse
    for (const key in videoPatterns) {
        const p = videoPatterns[key];
        if (p.ratio && p.ratio !== "auto") {
            const [rw, rh] = p.ratio.split(":").map(Number);
            p.ratioW = rw;
            p.ratioH = rh;
            p.isPortrait = rh > rw;
        }
    }

    // 所有平台 regex 的聯集，只當作「這則訊息裡有沒有可能含影片網址」的快速篩選。
    // 絕大多數聊天訊息完全不含這些網域，用一次 test() 就能跳過，
    // 不用對每則訊息都跑一次完整的 for...in 迴圈比對每個平台 regex
    const combinedVideoRegex = new RegExp(
        Object.values(videoPatterns).map((p) => `(?:${p.regex.source})`).join("|"),
        "i"
    );

    // ─────────────────────────────────────────────────────────────
    //  URL 偵測（dispatch table 取代序列 if 判斷，O(1) 查找）
    // ─────────────────────────────────────────────────────────────
    function fileNameFromUrl(url) {
        return url.split("/").pop().split("?")[0];
    }

    const idExtractors = {
        twitch: (m) => ({ id: m[1] || m[2], type: m[1] ? "video" : "channel" }),
        bilibiliBangumi: (m) => ({ type: m[1], id: m[2] }),
        facebook: (m) => ({ id: m[1] }),
        spotify: (m) => ({ type: m[1], id: m[2] }),
        douyin: (m) => ({ id: m[1] || m[2] }),
        githubRaw: (m) => ({ id: fileNameFromUrl(m[0]) }),
        discordCdn: (m) => ({ id: fileNameFromUrl(m[0]) }),
        soundcloud: () => ({ id: null }),
        appleMusic: () => ({ id: null }),
    };

    function detectVideoUrl(url) {
        for (const platform in videoPatterns) {
            const p = videoPatterns[platform];
            const m = url.match(p.regex);
            if (!m) continue;
            // 用 m[0]（實際比對到的片段）而不是整個傳入字串：
            // 從純文字裡截出的 token 可能夾帶逗號/句號等尾隨字元，m[0] 天然不含這些
            const base = { platform, originalUrl: m[0], platformName: PLATFORM_DISPLAY_NAME[platform] || platform };
            const extractor = idExtractors[platform];
            const extra = extractor ? extractor(m, url) : { id: m[1] };
            return { ...base, ...extra };
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────
    //  播放器渲染（dispatch table）
    // ─────────────────────────────────────────────────────────────
    function escapeHtmlAttr(str) {
        // 單次 pass 取代兩次 replace 呼叫
        return String(str).replace(/[&"]/g, (c) => (c === "&" ? "&amp;" : "&quot;"));
    }

    function renderTwitter(videoInfo) {
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

    const SPOTIFY_HEIGHTS = { track: 80, album: 352, playlist: 352, artist: 352, episode: 152, show: 232 };
    function renderSpotify(videoInfo) {
        return `<div style="width:100%;max-width:500px;margin:0.3em 0;">
            <iframe src="https://open.spotify.com/embed/${videoInfo.type}/${videoInfo.id}"
                width="100%" height="${SPOTIFY_HEIGHTS[videoInfo.type] ?? 80}" frameborder="0" loading="lazy"
                allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture"
                style="border-radius:12px;"></iframe>
        </div>`;
    }

    function renderSoundcloud(videoInfo) {
        return `<div style="width:100%;max-width:500px;margin:0.3em 0;">
            <iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
                src="https://w.soundcloud.com/player/?url=${encodeURIComponent(videoInfo.originalUrl)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false"
                style="border-radius:8px;"></iframe>
        </div>`;
    }

    function renderAppleMusic(videoInfo) {
        const embedSrc = videoInfo.originalUrl.replace("music.apple.com", "embed.music.apple.com");
        const isSong = /\/song\//.test(videoInfo.originalUrl) || /[?&]i=/.test(videoInfo.originalUrl);
        const h = isSong ? 175 : 450;
        return `<div style="width:100%;max-width:500px;margin:0.3em 0;">
            <iframe allow="autoplay *;encrypted-media *;fullscreen *;clipboard-write"
                frameborder="0" height="${h}" style="width:100%;overflow:hidden;border-radius:10px;background:transparent;"
                sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
                src="${escapeHtmlAttr(embedSrc)}"></iframe>
        </div>`;
    }

    function renderRawVideo(videoInfo) {
        return `<video controls preload="metadata"
            src="${escapeHtmlAttr(videoInfo.originalUrl)}"
            style="display:block;width:100%;max-width:${PLAYER_MAX_W}px;max-height:${PLAYER_MAX_H}px;border:none;border-radius:6px;background:#000;margin:0.3em 0;"
            ></video>`;
    }

    function renderNetease(videoInfo) {
        return `<div style="width:100%;max-width:330px;margin:0.3em 0;">
            <iframe frameborder="no" border="0" marginwidth="0" marginheight="0"
                width="100%" height="86"
                src="https://music.163.com/outchain/player?type=2&id=${videoInfo.id}&auto=0&height=66"
                style="border-radius:6px;"></iframe>
        </div>`;
    }

    function renderDouyin(videoInfo) {
        const p = videoPatterns.douyin;
        const src = p.embedUrl(videoInfo.id);
        return `<div style="width: 100%; max-width: 350px; margin: 0.3em auto; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
            <div style="position: relative; width: 100%; height: 622px;">
                <iframe src="${src}"
                        frameborder="0" allowfullscreen
                        referrerpolicy="unsafe-url"
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
            </div>
        </div>`;
    }

    // 通用 iframe 播放器：youtube 系列 / bilibili / vimeo / niconico / facebook / twitch /
    // streamable / dailymotion / pornhub / instagram
    function renderGenericIframe(videoInfo) {
        const p = videoPatterns[videoInfo.platform];
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

        const rp = p.referrerpolicy || "strict-origin-when-cross-origin";

        if (p.isPortrait) {
            const pw = Math.round(PLAYER_MAX_H * p.ratioW / p.ratioH);
            return `<iframe src="${src}"
                style="display:block;width:${pw}px;height:${PLAYER_MAX_H}px;border:none;border-radius:6px;background:#000;margin:0.3em 0;"
                frameborder="0" scrolling="no" allowfullscreen
                referrerpolicy="${rp}"
                allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share"></iframe>`;
        }
        return `<iframe src="${src}"
            style="display:block;width:100%;max-width:${PLAYER_MAX_W}px;aspect-ratio:${p.ratioW}/${p.ratioH};border:none;border-radius:6px;background:#000;margin:0.3em 0;"
            frameborder="0" scrolling="no" allowfullscreen
            referrerpolicy="${rp}"
            allow="autoplay;clipboard-write;encrypted-media;picture-in-picture;web-share"></iframe>`;
    }

    const platformRenderers = {
        twitter: renderTwitter,
        spotify: renderSpotify,
        soundcloud: renderSoundcloud,
        appleMusic: renderAppleMusic,
        catbox: renderRawVideo,
        githubRaw: renderRawVideo,
        imgurVideo: renderRawVideo,
        discordCdn: renderRawVideo,
        neteaseMusic: renderNetease,
        douyin: renderDouyin,
    };

    function buildPlayerHTML(videoInfo) {
        const renderer = platformRenderers[videoInfo.platform];
        return renderer ? renderer(videoInfo) : renderGenericIframe(videoInfo);
    }

    // ─────────────────────────────────────────────────────────────
    //  連結顯示文字
    // ─────────────────────────────────────────────────────────────
    const titleCache = new Map();

    function buildIdLabel(videoInfo) {
        const name = videoInfo.platformName || videoInfo.platform;
        if (videoInfo.platform === "bilibiliBangumi") {
            return `${name} - ${videoInfo.type}${videoInfo.id}`;
        }
        return videoInfo.id ? `${name} - ${videoInfo.id}` : name;
    }

    // ─────────────────────────────────────────────────────────────
    //  JSONP 輔助函式
    // ─────────────────────────────────────────────────────────────
    let jsonpCounter = 0;
    function jsonpFetch(url, timeoutMs = 5000) {
        return new Promise((resolve) => {
            const cbName = `__liko_jsonp_${jsonpCounter++}`;
            const script = document.createElement("script");
            let done = false;

            const cleanup = () => {
                delete window[cbName];
                script.remove();
                clearTimeout(timer);
            };

            window[cbName] = (data) => {
                if (done) return;
                done = true;
                cleanup();
                resolve(data);
            };

            const timer = setTimeout(() => {
                if (done) return;
                done = true;
                cleanup();
                resolve(null);
            }, timeoutMs);

            script.onerror = () => {
                if (done) return;
                done = true;
                cleanup();
                resolve(null);
            };

            script.src = `${url}${url.includes("?") ? "&" : "?"}jsonp=jsonp&callback=${cbName}`;
            document.head.appendChild(script);
        });
    }

    async function fetchYoutubeTitle(videoInfo) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoInfo.originalUrl)}&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? (await res.json())?.title || null : null;
    }

    async function fetchBilibiliTitle(videoInfo) {
        const data = await jsonpFetch(`https://api.bilibili.com/x/web-interface/view?bvid=${videoInfo.id}`);
        return data?.code === 0 && data?.data?.title ? data.data.title : null;
    }

    async function fetchVimeoTitle(videoInfo) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoInfo.originalUrl)}`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? (await res.json())?.title || null : null;
    }

    async function fetchSoundcloudTitle(videoInfo) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const url = `https://soundcloud.com/oembed?url=${encodeURIComponent(videoInfo.originalUrl)}&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res.ok ? (await res.json())?.title || null : null;
    }

    const titleFetchers = {
        youtube: fetchYoutubeTitle,
        youtubeShorts: fetchYoutubeTitle,
        youtubeLive: fetchYoutubeTitle,
        bilibiliVideo: fetchBilibiliTitle,
        vimeo: fetchVimeoTitle,
        soundcloud: fetchSoundcloudTitle,
    };

    async function fetchVideoTitle(videoInfo) {
        const cacheKey = `${videoInfo.platform}:${videoInfo.id}`;
        if (titleCache.has(cacheKey)) return titleCache.get(cacheKey);

        let title = null;
        const fetcher = titleFetchers[videoInfo.platform];
        if (fetcher) {
            try {
                title = await fetcher(videoInfo);
            } catch (e) {
                title = null; // 靜默失敗：CORS 被擋、逾時、影片下架等都不提示
            }
        }

        titleCache.set(cacheKey, title);
        return title;
    }

    // ─────────────────────────────────────────────────────────────
    //  訊息掃描：🎬 按鈕（行內）
    // ─────────────────────────────────────────────────────────────

    // 建立播放按鈕。container 是「這則訊息」的實際 DOM 容器參考（直接從呼叫端傳進來），
    // 不用 closest(".chat-room-message-content") 去猜——那個 class 在原始碼裡其實只用在
    // 回覆引用的小 span 上，一般訊息容器根本沒有這個 class，用 closest 猜會抓空。
    function createPlayButton(videoInfo, container) {
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

                container.appendChild(playerEl);
                btn.textContent = "📺"; btn.style.color = "#2ed573";
            } else {
                const visible = playerEl.style.display !== "none";
                playerEl.style.display = visible ? "none" : "block";
                btn.textContent = visible ? "🎬" : "📺";
                btn.style.color = visible ? "#ff4757" : "#2ed573";
            }
        });

        return btn;
    }

    // 把還沒被本插件處理過的 <a href> 升級成「平台 - ID」顯示文字，並回傳是否有升級
    function upgradeLinkLabel(link, videoInfo) {
        const href = link.getAttribute("href");
        if (link.textContent !== href) return; // 使用者自訂過顯示文字，不要動
        const idLabel = buildIdLabel(videoInfo);
        link.textContent = idLabel;
        fetchVideoTitle(videoInfo).then((title) => {
            if (!title) return;
            if (!link.isConnected || link.textContent !== idLabel) return;
            const shortTitle = title.length > 40 ? title.slice(0, 40) + "…" : title;
            link.textContent = `${videoInfo.platformName} - ${shortTitle}`;
        });
    }

    // ★ 核心：BC 的聊天訊息本身是純文字，並不會自動變成 <a href>
    //   （會變成超連結是因為裝了 LCE/WCE 之類的擴充，它們自己用 setInterval 去把文字轉連結）。
    //   直接在純文字節點裡找網址、自己組出 <a> + 按鈕，不依賴任何其他 mod 幫忙轉連結，
    //   這樣訊息一進來就能馬上處理，不用等其他 mod 的輪詢週期。
    function linkifyRawText(container) {
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                // 已經在連結內、或是我們自己插入的按鈕/播放器裡的文字，跳過
                if (parent.closest("a, .likoVideoButton, .likoVideoIframe")) return NodeFilter.FILTER_REJECT;
                if (!node.textContent || !combinedVideoRegex.test(node.textContent)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const targets = [];
        let node;
        while ((node = walker.nextNode())) targets.push(node);
        if (targets.length === 0) return;

        for (const textNode of targets) {
            const parts = textNode.textContent.split(/(\s+)/); // 保留空白，依空白切成 token
            let matchedAny = false;
            const frag = document.createDocumentFragment();

            for (const part of parts) {
                if (!part) continue;
                if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }

                const videoInfo = detectVideoUrl(part);
                if (!videoInfo) { frag.appendChild(document.createTextNode(part)); continue; }

                matchedAny = true;

                const link = document.createElement("a");
                link.href = videoInfo.originalUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.dataset.likoProcessed = "1";
                const idLabel = buildIdLabel(videoInfo);
                link.textContent = idLabel;
                fetchVideoTitle(videoInfo).then((title) => {
                    if (!title) return;
                    if (!link.isConnected || link.textContent !== idLabel) return;
                    const shortTitle = title.length > 40 ? title.slice(0, 40) + "…" : title;
                    link.textContent = `${videoInfo.platformName} - ${shortTitle}`;
                });

                frag.appendChild(createPlayButton(videoInfo, container));
                frag.appendChild(document.createTextNode(" "));
                frag.appendChild(link);
            }

            if (matchedAny) textNode.replaceWith(frag);
        }
    }

    function processInlineButtons(container) {
        if (!isEnabled) return;
        const text = container.textContent || "";
        if (!text || !combinedVideoRegex.test(text)) return; // 快速跳過完全沒有影片網址的一般訊息

        // 相容其他 mod（例如 LCE 的 augmentChat）可能已經先把文字轉成 <a> 的情況
        container.querySelectorAll("a[href]:not([data-liko-processed])").forEach((link) => {
            const href = link.getAttribute("href");
            if (!href) return;
            const videoInfo = detectVideoUrl(href);
            if (!videoInfo) return;
            upgradeLinkLabel(link, videoInfo);
            link.before(createPlayButton(videoInfo, container));
            link.before(document.createTextNode(" "));
            link.dataset.likoProcessed = "1";
        });

        // 主要路徑：直接解析純文字裡的網址
        linkifyRawText(container);
    }

    // 全域重掃（初次進房 / fallback interval 用）
    function scanChatMessages() {
        if (!isEnabled) return;
        document.querySelectorAll(CHAT_LOG_SELECTOR).forEach((el) => {
            processInlineButtons(el);
        });
    }

    // ─────────────────────────────────────────────────────────────
    //  插件控制
    // ─────────────────────────────────────────────────────────────
    function enablePlugin() {
        isEnabled = true;
        scanChatMessages(); // 初次進房需要完整掃一次既有訊息
        if (!scanInterval) {
            scanInterval = setInterval(scanChatMessages, FALLBACK_SCAN_MS);
        }
    }

    function disablePlugin() {
        isEnabled = false;
        clearInterval(scanInterval); scanInterval = null;
        document.querySelectorAll(".likoVideoButton,.likoVideoIframe").forEach((el) => el.remove());
        document.querySelectorAll("[data-liko-processed]").forEach((el) => {
            delete el.dataset.likoProcessed;
        });
    }

    function togglePlugin() { isEnabled ? disablePlugin() : enablePlugin(); return isEnabled; }
    function destroyPlugin() { disablePlugin(); delete window.LikoVideoPlayerInstance; }

    function stopAllPlayers() {
        document.querySelectorAll(".likoVideoIframe").forEach((el) => el.remove());
        document.querySelectorAll(".likoVideoButton").forEach((el) => el.remove());
        document.querySelectorAll("[data-liko-processed]").forEach((el) => {
            delete el.dataset.likoProcessed;
        });
    }

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

        // ★ 核心：ChatRoomMessageDisplay 是實際建立訊息 div 並回傳它的地方
        //   （Chat / Whisper / Emote / Action 等主要訊息類型都會經過這裡）。
        //   直接拿 next() 回傳的 div 處理，不需要任何 DOM 查詢或猜測「新增了什麼」，
        //   比 MutationObserver 更快、更準，且不受其他 mod 操作 DOM 的干擾。
        if (typeof ChatRoomMessageDisplay === "function") {
            modApi.hookFunction("ChatRoomMessageDisplay", 0, (args, next) => {
                const div = next(args);
                if (div) processInlineButtons(div);
                return div;
            });
        }

        // ★ 離開房間時自動停止播放
        if (typeof ChatRoomLeave === "function") {
            modApi.hookFunction("ChatRoomLeave", 0, (args, next) => {
                stopAllPlayers();
                return next(args);
            });
        }
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
                repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
            });
        }
    } catch (e) {
        console.error("❌ ACV init failed:", e.message);
    }

    hookChatRoomLoad();
    enablePlugin();
    window.addEventListener("beforeunload", destroyPlugin);

})();