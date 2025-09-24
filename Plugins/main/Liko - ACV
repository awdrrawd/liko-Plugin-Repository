// ==UserScript==
// @name         Liko - ACV
// @name:zh      Liko的自動創建影片
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  Automatically create video.
// @author       likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// ==/UserScript==

(function () {
    "use strict";

    // 檢查是否已經載入過
    if (window.LikoVideoPlayerInstance) return;

    let modApi;
    const modVersion = "1.0";
    let isEnabled = true;
    let scanInterval;

    // 支援的影音平台配置
    const videoPatterns = {
        youtube: {
            regex: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[&?].*)?/,
            embedTemplate: (id) => `https://www.youtube.com/embed/${id}`,
            htmlTemplate: (id) => `<div style="width: 100%; max-width: none; margin: 0.3em 0; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                    <iframe src="https://www.youtube.com/embed/${id}"
                            frameborder="0" allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`,
            name: "YouTube"
        },
        bilibili: {
            regex: /bilibili\.com\/video\/(BV[a-zA-Z0-9]{10})(?:[\/\?&].*)?/,
            embedTemplate: (id) => `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
            htmlTemplate: (id) => `<div style="width: 100%; max-width: none; margin: 0.3em 0; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                    <iframe src="https://player.bilibili.com/player.html?bvid=${id}&autoplay=0"
                            frameborder="0" allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`,
            name: "Bilibili"
        },
        twitch: {
            regex: /twitch\.tv\/(?:(?:videos\/([0-9]+)(?:[\/?].*)?)|([a-zA-Z0-9_]+)(?:[\/?].*)?)/,
            embedTemplate: (id, type) => type === "video"
                ? `https://player.twitch.tv/?video=${id}&parent=${window.location.hostname}&autoplay=false`
                : `https://player.twitch.tv/?channel=${id}&parent=${window.location.hostname}&autoplay=false`,
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
            embedTemplate: (id) => `https://player.vimeo.com/video/${id}`,
            htmlTemplate: (id) => `<div style="width: 100%; max-width: none; margin: 0.3em 0; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                    <iframe src="https://player.vimeo.com/video/${id}"
                            frameborder="0" allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`,
            name: "Vimeo"
        },
        niconico: {
            regex: /nicovideo\.jp\/watch\/(sm[0-9]+)/,
            embedTemplate: (id) => `https://embed.nicovideo.jp/watch/${id}`,
            htmlTemplate: (id) => `<div style="width: 100%; max-width: none; margin: 0.3em 0; background: #000; border-radius: 0.2em; overflow: hidden; box-sizing: border-box;">
                <div style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%;">
                    <iframe src="https://embed.nicovideo.jp/watch/${id}"
                            frameborder="0" allowfullscreen
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"></iframe>
                </div>
            </div>`,
            name: "Niconico"
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
                fullName: "Liko'sAutomatically create video.",
                version: modVersion,
                repository: '自動創建影片 | Automatically create video.',
            });
        }
    } catch (e) {
        console.error("❌ Video Player Advanced 初始化失敗:", e.message);
    }

    // 简化URL显示
    function simplifyUrl(url) {
        // 移除协议前缀
        let simplified = url.replace(/^https?:\/\/(www\.)?/, '');

        // 特定平台的简化规则
        if (simplified.includes('bilibili.com/video/')) {
            const match = simplified.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]{10})/);
            if (match) return `bilibili.com/video/${match[1]}`;
        }

        if (simplified.includes('youtube.com/watch?v=')) {
            const match = simplified.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
            if (match) return `youtube.com/watch?v=${match[1]}`;
        }

        // 通用截断
        if (simplified.length > 60) {
            return simplified.substring(0, 57) + '...';
        }

        return simplified;
    }

    // 檢測影片網址
    function detectVideoUrl(url) {
        for (let platform in videoPatterns) {
            const pattern = videoPatterns[platform];
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
                        embedUrl: pattern.embedTemplate(id, type),
                        platformName: pattern.name
                    };
                } else {
                    const id = match[1];
                    return {
                        platform,
                        id,
                        originalUrl: url,
                        embedUrl: pattern.embedTemplate(id),
                        platformName: pattern.name
                    };
                }
            }
        }
        return null;
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

        // 鼠標懸停效果
        button.addEventListener("mouseenter", () => {
            if (!isEnabled) return;
            button.style.background = "rgba(255, 71, 87, 0.2)";
            button.style.transform = "scale(1.1)";
        });

        button.addEventListener("mouseleave", () => {
            button.style.background = "rgba(255, 71, 87, 0.1)";
            button.style.transform = "scale(1)";
        });

        // 點擊事件
        const clickHandler = (event) => {
            if (!isEnabled) return;
            event.preventDefault();
            event.stopPropagation();

            const messageElement = button.closest('.chat-room-message-content') || button.closest('[role="log"] div') || button.closest('div');
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
                const htmlContent = pattern.htmlTemplate(videoInfo.id, videoInfo.type);
                iframeContainer.innerHTML = htmlContent;

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

                iframeContainer.style.position = "relative";
                iframeContainer.appendChild(closeButton);

                messageElement.appendChild(iframeContainer);

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

    // 處理文本內容 - 回到简单有效的方法
    function processTextContent(element) {
        if (!isEnabled) return;
        if (element.dataset.likoVideoProcessed === "1") return;

        // 避免重复处理
        if (element.querySelector('.likoVideoButton')) return;

        let hasChanges = false;

        // 处理现有的链接
        const existingLinks = element.querySelectorAll('a[href]:not([data-liko-processed])');
        existingLinks.forEach(link => {
            const href = link.getAttribute('href');
            const videoInfo = detectVideoUrl(href);
            if (videoInfo) {
                const simplifiedUrl = simplifyUrl(href);
                link.textContent = simplifiedUrl;
                const button = createVideoButton(videoInfo, href);
                link.appendChild(button);
                link.style.cssText += `
                    background: rgba(255, 71, 87, 0.1);
                    padding: 3px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    text-decoration: none;
                    margin: 2px 0;
                `;
                link.dataset.likoProcessed = "1";
                hasChanges = true;
            }
        });

        // 处理纯文本中的视频链接
        let innerHTML = element.innerHTML;

        for (let platform in videoPatterns) {
            const pattern = videoPatterns[platform];
            const regex = new RegExp(pattern.regex.source, 'gi');

            innerHTML = innerHTML.replace(regex, (match) => {
                // 避免处理已经在链接中的URL
                if (match.includes('<') || match.includes('>')) return match;

                const videoInfo = detectVideoUrl(match);
                if (videoInfo) {
                    hasChanges = true;
                    const simplifiedUrl = simplifyUrl(match);
                    return `<span class="likoVideoLink" data-video-info='${JSON.stringify(videoInfo)}' data-original-url='${match}' style="background: rgba(255, 71, 87, 0.1); padding: 3px 6px; border-radius: 4px; display: inline-block; margin: 2px 0;">${simplifiedUrl}</span>`;
                }
                return match;
            });
        }

        if (hasChanges && innerHTML !== element.innerHTML) {
            element.innerHTML = innerHTML;

            // 为新创建的span添加按钮
            element.querySelectorAll('.likoVideoLink[data-video-info]:not([data-button-added])').forEach(span => {
                try {
                    const videoInfo = JSON.parse(span.dataset.videoInfo);
                    const originalUrl = span.dataset.originalUrl;
                    const button = createVideoButton(videoInfo, originalUrl);
                    span.appendChild(button);
                    span.dataset.buttonAdded = "1";
                } catch (e) {
                    console.error("Video Player: 添加按钮失败:", e);
                }
            });
        }

        element.dataset.likoVideoProcessed = "1";
    }

    // 掃描聊天消息
    function scanChatMessages() {
        if (!isEnabled) return;
        document.querySelectorAll(".chat-room-message-content, [role='log'] div").forEach(processTextContent);
    }

    // 插件控制函數
    function enablePlugin() {
        isEnabled = true;

        if (!scanInterval) {
            scanInterval = setInterval(scanChatMessages, 500);
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
                next(args);
                setTimeout(() => {
                    if (!window.LikoVideoPlayerWelcomed && isEnabled) {
                        const supportedPlatforms = Object.values(videoPatterns).map(p => p.name).join(", ");
                        ChatRoomSendLocal(
                            `<p style='background-color:#4C2772;color:#EEEEEE;display:block;padding:5px;'>
                            <b>🎬 Liko - Video Player Advanced v${modVersion} 🎬</b>
                            <br>- 自動檢測並簡化顯示影片連結，添加 🎬 播放按鈕
                            <br>- 支援平台: ${supportedPlatforms}
                            <br>- 點擊 🎬 按鈕播放，再次點擊隱藏，✕ 按鈕關閉
                            </p>`.replace(/\s+/g, " "), 10000
                        );
                        window.LikoVideoPlayerWelcomed = true;
                    }
                }, 1000);
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
