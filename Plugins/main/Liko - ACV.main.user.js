// ==UserScript==
// @name         Liko - ACV
// @name:zh      Liko的自動創建影片
// @namespace    https://likolisu.dev/
// @version      1.2.2
// @description  Advanced video player that auto-detects video links in chat and adds play buttons
// @author       likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // 檢查是否已經載入過
    if (window.LikoVideoPlayerInstance) return;

    let modApi;
    const modVersion = "1.2.2";
    let isEnabled = true;
    let scanInterval;

    // 支援的影音平台配置
    const PLATFORM_DISPLAY_NAME = {
        bilibiliVideo: "Bilibili",
        bilibiliBangumi: "Bilibili",

        youtube: "YouTube",
        youtubeShorts: "YouTube",

        facebook: "Facebook",
        instagram: "Instagram",
        spotify: "Spotify",
        twitter: "Twitter/X"
    };
    const videoPatterns = {
        youtubeShorts: {
            regex: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
            htmlTemplate: (id) =>
            createResponsiveIframe(`https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,{ratio: "9:16", maxWidth: 320}),
            name: "YouTube Shorts"
        },
        youtube: {
            regex: /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            htmlTemplate: (id) =>
            createResponsiveIframe( `https://www.youtube-nocookie.com/embed/${id}?autoplay=0&rel=0`,{ ratio: "16:9" } ),
            name: "YouTube"
        },
        bilibiliVideo: {
            regex: /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
            htmlTemplate: (id) =>
            createResponsiveIframe(`https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,{ ratio: "16:9" }),
            name: "Bilibili"
        },
        bilibiliBangumi: {
            regex: /bilibili\.com\/bangumi\/play\/(ep|ss)(\d+)/,
            htmlTemplate: (type, id) => {
                const param =
                      type === "ep"
                ? `ep_id=${id}`
                : `season_id=${id}`;
                return createResponsiveIframe(`https://player.bilibili.com/player.html?${param}&autoplay=0`,{ ratio: "16:9" });},
            name: "Bilibili 番劇"
        },
        douyin: {
            regex: /douyin\.com\/(?:video\/(\d+)|jingxuan\?modal_id=(\d+))/,
            htmlTemplate: (id1, id2) => {
                const id = id1 || id2;
                return `<div style="width: 100%; max-width: 300px; margin: 0.3em auto; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                    <div style="position: relative; width: 100%; height: 533px;">
                        <iframe src="https://open.douyin.com/player/video?vid=${id}&autoplay=0"
                                frameborder="0" allowfullscreen
                                referrerpolicy="unsafe-url"
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                </div>`;
            },
            //createResponsiveIframe(`https://open.douyin.com/player/video?vid=${id}&autoplay=0`,{ratio: "9:16",maxWidth: 360}),
            name: "抖音"
        },
        instagram: {
            regex: /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/,
            htmlTemplate: (id) =>
            createResponsiveIframe(`https://www.instagram.com/p/${id}/embed/`,{ratio: "9:16",maxWidth: 360}),
            name: "Instagram"
        },
        twitch: {
            regex: /twitch\.tv\/(?:(?:videos\/([0-9]+)(?:[\/?].*)?)|([a-zA-Z0-9_]+)(?:[\/?].*)?)/,
            htmlTemplate: (id, type) => `<div style="width: 100%; max-width: none; margin: 0.3em 0; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                    <iframe src="${type === "video"
            ? `https://player.twitch.tv/?video=${id}&parent=${window.location.hostname}&autoplay=false`
            : `https://player.twitch.tv/?channel=${id}&parent=${window.location.hostname}&autoplay=false`}"
                            frameborder="0" allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`,
            name: "Twitch"
        },
        vimeo: {
            regex: /vimeo\.com\/([0-9]+)/,
            htmlTemplate: (id) =>
            createResponsiveIframe(`https://player.vimeo.com/video/${id}`,{ratio: "16:9"}),
            name: "Vimeo"
        },
        niconico: {
            regex: /nicovideo\.jp\/watch\/(sm[0-9]+)/,
            htmlTemplate: (id) =>
            createResponsiveIframe(`https://embed.nicovideo.jp/watch/${id}`,{ratio: "16:9"}),
            name: "Niconico"
        },
        twitter: {
            regex: /(?:twitter\.com|x\.com)\/[^\/]+\/status\/(\d+)/,
            htmlTemplate: (id, username) =>
            {
                // 確保 widgets.js 已加載
                if (!window.twttr) {
                    const script = document.createElement('script');
                    script.src = 'https://platform.twitter.com/widgets.js';
                    script.async = true;
                    script.charset = 'utf-8';
                    document.head.appendChild(script);
                }

                return `<div class="twitter-embed-container" style="width: 100%; max-width: 500px; margin: 0.3em auto;">
                        <blockquote class="twitter-tweet" data-media-max-width="500">
                        <a href="https://twitter.com/i/status/${id}"></a>
                        </blockquote>
                        </div>`;
            },
            name: "Twitter/X",
            needsScriptReload: true // 標記需要重新加載腳本
        },
        facebook: {
            regex: /facebook\.com\/(reel\/\d+|watch\/\?v=\d+|.*\/videos\/\d+)/,
            htmlTemplate: (url) =>
            createResponsiveIframe(`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,{ratio: "9:16", maxWidth: 360 }),
            name: "Facebook Reel"
        },
        spotify: {
            regex: /open\.spotify\.com\/(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]+)/,
            htmlTemplate: (type, id) => {
                const HEIGHT_MAP = {
                    track: 80,
                    album: 352,
                    playlist: 352,
                    artist: 352,
                    episode: 152,
                    show: 232
                };
                const height = HEIGHT_MAP[type] ?? 80;
                return createSpotifyEmbed(`https://open.spotify.com/embed/${type}/${id}`,height);},
            name: "Spotify"
        }
    };

    // 儲存資源供清理使用
    const resources = {
        intervals: [],
        eventListeners: []
    };

    // 建立插件實例
    const pluginInstance = {
        isEnabled: () => isEnabled,
        enable: enablePlugin,
        disable: disablePlugin,
        toggle: togglePlugin,
        destroy: destroyPlugin
    };

    window.LikoVideoPlayerInstance = pluginInstance;

    // 註冊到 bcModSdk
    try {
        if (bcModSdk?.registerMod) {
            modApi = bcModSdk.registerMod({
                name: "Liko's ACV",
                fullName: "Liko's Automatically create video.",
                version: modVersion,
                repository: '自動創建影片 | Automatically create video.',
            });
        }
    } catch (e) {
        console.error("❌ Video Player Advanced 初始化失敗:", e.message);
    }

    // 檢測影片網址
    function detectVideoUrl(url) {
        for (let platform in videoPatterns) {
            const pattern = videoPatterns[platform];
            if (!pattern || !pattern.regex) continue; // 安全檢查

            const match = url.match(pattern.regex);
            if (match) {
                if (platform === "twitch") {
                    const type = match[1] ? "video" : "channel";
                    const id = match[1] || match[2];
                    return {
                        platform,
                        id,
                        type,
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                } else if (platform === "douyin") {
                    const id = match[1] || match[2];
                    const shortCode = match[3];
                    return {
                        platform,
                        id: id,
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                } else if (platform === "twitter") {
                    const id = match[1];
                    return {
                        platform,
                        id,
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                } else if (platform === "facebook") {
                    return {
                        platform,
                        url,              // ← 用完整 URL
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                } else if (platform === "spotify") {
                    return {
                        platform,
                        type: match[1], // track / album / playlist / episode / show / artist
                        id: match[2],
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                } else if (platform === "bilibiliBangumi") {
                    return {
                        platform,
                        type: match[1], // ep / ss
                        id: match[2],
                        originalUrl: url,
                        platformName: pattern.name
                    };
                } else {
                    const id = match[1];
                    return {
                        platform,
                        id,
                        originalUrl: url,
                        platformName: PLATFORM_DISPLAY_NAME[platform] || pattern.name
                    };
                }
            }
        }
        return null;
    }
    function createResponsiveIframe(src, {
        ratio = "16:9",
        maxWidth = null,
        extraAttrs = ""
    } = {}) {
        const [w, h] = ratio.split(":").map(Number);

        return `
        <div style="
            width: 100%;
            ${maxWidth ? `max-width:${maxWidth}px;` : ""}
            margin: 0.3em auto;
        ">
            <div style="
                position: relative;
                width: 100%;
                aspect-ratio: ${w} / ${h};
                background: #000;
                border-radius: 6px;
                overflow: hidden;
            ">
                <iframe
                    src="${src}"
                    style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        border: none;
                    "
                    scrolling="no"
                    frameborder="0"
                    allowfullscreen
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    ${extraAttrs}
                ></iframe>
            </div>
        </div>
    `;
    }

    function createSpotifyEmbed(src, height) {
        return `
        <div style="
            width: 100%;
            max-width: 500px;
            margin: 0.3em 0;
        ">
            <iframe
                src="${src}"
                width="100%"
                height="${height}"
                frameborder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                style="border-radius: 12px;"
                loading="lazy">
            </iframe>
        </div>
    `;
    }

    // 創建視頻播放按鈕
    function createVideoButton(videoInfo, originalUrl) {
        const button = document.createElement("span");
        button.className = "likoVideoButton";
        button.textContent = "🎬";
        button.title = `播放 ${videoInfo.platformName} 視頻`;
        button.style.cssText = `
            color: #ff4757;
            cursor: pointer;
            font-size: 1.3em;
            padding: 4px 6px;
            border-radius: 4px;
            background: rgba(255, 71, 87, 0.1);
            border: 1px solid rgba(255, 71, 87, 0.3);
            transition: all 0.2s ease;
            display: inline-block;
            vertical-align: middle;
            margin-left: 6px;
            min-width: 28px;
            text-align: center;
        `;

        button.addEventListener("mouseenter", () => {
            if (!isEnabled) return;
            button.style.background = "rgba(255, 71, 87, 0.2)";
            button.style.transform = "scale(1.1)";
        });

        button.addEventListener("mouseleave", () => {
            button.style.background = "rgba(255, 71, 87, 0.1)";
            button.style.transform = "scale(1)";
        });

        const clickHandler = (event) => {
            if (!isEnabled) return;
            event.preventDefault();
            event.stopPropagation();

            const messageElement = button.parentElement?.closest('.chat-room-message-content');
            if (!messageElement) return;

            let existingIframe = messageElement.querySelector('.likoVideoIframe');

            if (existingIframe) {
                if (existingIframe.style.display === 'none') {
                    existingIframe.style.display = 'block';
                    button.textContent = "📺";
                    button.style.color = "#2ed573";
                } else {
                    existingIframe.style.display = 'none';
                    button.textContent = "🎬";
                    button.style.color = "#ff4757";
                }
            } else {
                const iframeContainer = document.createElement("div");
                iframeContainer.className = "likoVideoIframe";

                const pattern = videoPatterns[videoInfo.platform];
                let htmlContent;
                if (videoInfo.platform === "douyin") {
                    htmlContent = pattern.htmlTemplate(videoInfo.id, null, videoInfo.shortCode);
                } else if (videoInfo.platform === "twitch") {
                    htmlContent = pattern.htmlTemplate(videoInfo.id, videoInfo.type);
                } else if (videoInfo.platform === "facebook") {
                    htmlContent = pattern.htmlTemplate(videoInfo.originalUrl);
                } else if (videoInfo.platform === "twitter") {
                    htmlContent = pattern.htmlTemplate(videoInfo.id);
                } else if (videoInfo.platform === "spotify") {
                    htmlContent = pattern.htmlTemplate(videoInfo.type, videoInfo.id);
                } else if (videoInfo.platform === "bilibiliBangumi") {
                    htmlContent = pattern.htmlTemplate(videoInfo.type, videoInfo.id);
                } else {
                    htmlContent = pattern.htmlTemplate(videoInfo.id);
                }

                const closeButton = document.createElement("button");
                closeButton.textContent = "✕";
                closeButton.style.cssText = `
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    font-size: 14px;
                    z-index: 100;
                    font-weight: bold;
                `;

                closeButton.addEventListener("click", () => {
                    iframeContainer.remove();
                    button.textContent = "🎬";
                    button.style.color = "#ff4757";
                });

                iframeContainer.innerHTML = htmlContent;
                iframeContainer.style.position = "relative";
                iframeContainer.appendChild(closeButton);

                messageElement.appendChild(iframeContainer);
                if (videoInfo.platform === "twitter" && window.twttr) {
                    window.twttr.widgets.load(iframeContainer);
                }

                button.textContent = "📺";
                button.style.color = "#2ed573";

                resources.eventListeners.push({
                    element: closeButton,
                    events: [{ type: "click", handler: closeButton.onclick }]
                });
            }
        };

        button.addEventListener("click", clickHandler);

        resources.eventListeners.push({
            element: button,
            events: [{ type: "click", handler: clickHandler }]
        });

        return button;
    }

    // 處理文本內容
    function processTextContent(element) {
        if (!isEnabled) return;

        const links = element.querySelectorAll('a[href]:not([data-liko-processed])');

        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;

            const videoInfo = detectVideoUrl(href);
            if (!videoInfo) return;

            const button = createVideoButton(videoInfo, href);

            // 插在 <a> 前面
            link.before(button);
            link.before(document.createTextNode(" "));

            // 只標記這個 link
            link.dataset.likoProcessed = "1";
        });
    }

    // 掃描聊天消息
    function scanChatMessages() {
        if (!isEnabled) return;
        const messageContainers = document.querySelectorAll(".chat-room-message-content, [role='log'] > div");
        messageContainers.forEach(container => {processTextContent(container);});
    }

    // 插件控制函數
    function enablePlugin() {
        isEnabled = true;

        if (!scanInterval) {
            scanInterval = setInterval(scanChatMessages, 1500);
            resources.intervals.push(scanInterval);
        }

        document.querySelectorAll(".chat-room-message-content, [role='log'] div").forEach(el => {
            el.dataset.likoVideoProcessed = "";
        });
        scanChatMessages();
    }

    function disablePlugin() {
        isEnabled = false;

        if (scanInterval) {
            clearInterval(scanInterval);
            const index = resources.intervals.indexOf(scanInterval);
            if (index > -1) resources.intervals.splice(index, 1);
            scanInterval = null;
        }

        document.querySelectorAll('.likoVideoButton, .likoVideoIframe').forEach(el => {
            el.remove();
        });

        document.querySelectorAll('.likoVideoLink').forEach(el => {
            const originalUrl = el.dataset.originalUrl;
            if (originalUrl) {
                const textNode = document.createTextNode(originalUrl);
                el.parentNode.replaceChild(textNode, el);
            }
        });

        document.querySelectorAll('[data-liko-processed], [data-liko-video-processed]').forEach(el => {
            delete el.dataset.likoProcessed;
            delete el.dataset.likoVideoProcessed;
        });
    }

    function togglePlugin() {
        if (isEnabled) {
            disablePlugin();
        } else {
            enablePlugin();
        }
        return isEnabled;
    }

    function destroyPlugin() {
        disablePlugin();

        resources.intervals.forEach(interval => {
            clearInterval(interval);
        });

        resources.eventListeners.forEach(({ element, events }) => {
            if (element) {
                events.forEach(({ type, handler }) => {
                    element.removeEventListener(type, handler);
                });
            }
        });

        document.querySelectorAll('.likoVideoButton, .likoVideoIframe, .likoVideoLink').forEach(el => {
            if (el.classList.contains('likoVideoLink')) {
                const originalUrl = el.dataset.originalUrl;
                if (originalUrl) {
                    const textNode = document.createTextNode(originalUrl);
                    el.parentNode.replaceChild(textNode, el);
                }
            } else {
                el.remove();
            }
        });

        delete window.LikoVideoPlayerInstance;
    }

    // Hook ChatRoomLoad
    function hookChatRoomLoad() {
        if (modApi && typeof modApi.hookFunction === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                const result = next(args);

                // 不管 sync / async，都延後處理
                setTimeout(() => {
                    if (!window.LikoVideoPlayerWelcomed && isEnabled) {
                        const supportedPlatforms = [
                            ...new Set(
                                Object.keys(videoPatterns).map(
                                    key => PLATFORM_DISPLAY_NAME[key] || videoPatterns[key].name
                                )
                            )
                        ].join(", ");

                        ChatRoomSendLocal(
                            `<p style='background-color:#4C2772;color:#EEEEEE;display:block;padding:5px;'>
                             <b>🎬 Liko's ACV v${modVersion} 🎬</b>
                              <br>- 自動檢測影片連結，添加 🎬 播放按鈕
                             <br>- 支援平台: ${supportedPlatforms}
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
                setTimeout(() => {
                    scanChatMessages();
                }, 100);
            });

            modApi.hookFunction("ServerSend", 0, (args, next) => {
                next(args);
                const [type, data] = args;
                if (type === "ChatRoomChat" && data.Type === "Chat") {
                    setTimeout(() => {
                        scanChatMessages();
                    }, 200);
                }
            });
        }
    }

    // 初始化
    hookChatRoomLoad();
    enablePlugin();

    window.addEventListener('beforeunload', destroyPlugin);

})();
