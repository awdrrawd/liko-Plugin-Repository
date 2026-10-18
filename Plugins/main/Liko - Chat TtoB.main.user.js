// ==UserScript==
// @name         Liko - Chat toB
// @name:zh      Liko的對話變按鈕
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.1.2
// @description  display command buttons in chatroom, copying command to input and showing description
// @author       likolisu
// @include      /^https:\/\/(www\.)?(bondage(projects\.elementfx|-(europe|asia))\.com|bondageeurope\.com)\/R*/
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Chat%20TtoB.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20Chat%20TtoB.main.user.js
// ==/UserScript==

(function () {
    "use strict";
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.1.2";
    if (window.Liko.CTB) return;
    window.Liko.CTB = MOD_VER;

    let modApi;
    let isEnabled = true;
    let destroyed = false;
    let initialized = false;
    let scanInterval;
    let descElement;
    let cancelLogin;
    let roomGeneration = 0;
    const timers = new Set();
    const originals = new WeakMap();
    const selector = '.likoCommandInChat, .likoRoomInChat';

    const pluginInstance = {
        isEnabled: () => isEnabled && !destroyed,
        enable: enablePlugin,
        disable: disablePlugin,
        toggle() { if (isEnabled) disablePlugin(); else enablePlugin(); return isEnabled; },
        destroy: destroyPlugin,
    };
    window.LikoChatTtoBInstance = pluginInstance;

    function hideDesc() {
        if (descElement) descElement.style.display = 'none';
    }

    function showDesc(text) {
        if (!isEnabled || destroyed || !descElement) return;
        descElement.textContent = text;
        descElement.style.display = 'block';
    }

    function findCommandObjectByTag(tag) {
        const normalize = value => String(value).normalize('NFKC').trim().toLowerCase();
        return Array.isArray(window.Commands)
            ? window.Commands.find(command => normalize(command.Tag) === normalize(tag)) : undefined;
    }

    function makeButton(kind, value, original, command) {
        const el = document.createElement('span');
        el.className = kind === 'room' ? 'likoRoomInChat' : 'likoCommandInChat';
        el.textContent = kind === 'room' ? '🚪' + value + '🚪' : value;
        el.style.color = kind === 'room' ? '#65b5ff' : kind === 'append' ? '#65ff8a' : '#ff65f2';
        el.style.cursor = 'pointer';
        el.dataset.likoKind = kind;
        el.dataset.likoValue = value;
        if (command) el.dataset.likoDescription = command.Description || '';
        originals.set(el, original);
        return el;
    }

    // Only text nodes are replaced: existing links, images, listeners and message metadata survive.
    function processTextContent(element) {
        if (!isEnabled || destroyed || element.closest('a')) return;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!node.parentElement.closest('a, button, script, style, ' + selector)) nodes.push(node);
        }
        for (const node of nodes) {
            const text = node.nodeValue;
            if (/https?:\/\//i.test(text)) continue;
            const pattern = /#([^#\n\r]{1,50})#|!!(\S+)|(^|\s)(\/[\p{L}\p{N}_-]+)/gu;
            let offset = 0;
            let changed = false;
            const fragment = document.createDocumentFragment();
            for (const match of text.matchAll(pattern)) {
                const kind = match[1] !== undefined ? 'room' : match[2] !== undefined ? 'append' : 'command';
                const prefix = kind === 'command' ? match[3] : '';
                const value = kind === 'room' ? match[1] : kind === 'append' ? match[2] : match[4];
                const command = kind === 'command' ? findCommandObjectByTag(value.slice(1)) : null;
                if (!value.trim() || (kind === 'command' && !command)) continue;
                fragment.append(document.createTextNode(text.slice(offset, match.index) + prefix));
                fragment.append(makeButton(kind, value, match[0].slice(prefix.length), command));
                offset = match.index + match[0].length;
                changed = true;
            }
            if (changed) {
                fragment.append(document.createTextNode(text.slice(offset)));
                node.replaceWith(fragment);
            }
        }
    }

    function scanChat() {
        document.querySelectorAll('.chat-room-message-content').forEach(processTextContent);
    }

    function buttonFromEvent(event) {
        const button = event.target instanceof Element ? event.target.closest(selector) : null;
        return button && originals.has(button) ? button : null;
    }

    function onClick(event) {
        if (!isEnabled || destroyed) return;
        const button = buttonFromEvent(event);
        if (!button) return;
        event.stopPropagation();
        const value = button.dataset.likoValue;
        if (button.dataset.likoKind === 'room') {
            if (typeof enterRoom === 'function') enterRoom(value.trim());
            else {
                ChatRoomLeave();
                CommonSetScreen('Online', 'ChatSearch');
                ServerSend('ChatRoomJoin', { Name: value.trim() });
            }
        } else {
            const input = document.querySelector('#InputChat');
            if (!input) return;
            if (button.dataset.likoKind === 'append') input.value += value;
            else input.value = value + ' ';
            input.focus();
        }
    }

    function onMouseOver(event) {
        const button = buttonFromEvent(event);
        if (!button) return;
        const value = button.dataset.likoValue;
        if (button.dataset.likoKind === 'room') showDesc('點擊後加入房間: ' + value + '\nClick to join room: ' + value);
        else if (button.dataset.likoKind === 'append') showDesc('點擊後添加文字: ' + value + '\nClick to append: ' + value);
        else showDesc((button.dataset.likoDescription || value) + '\n點擊後聊天窗貼上命令\nClick to paste command in chat input');
    }

    function clearWelcomeTimers() {
        roomGeneration++;
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
    }

    function enablePlugin() {
        if (destroyed) return;
        isEnabled = true;
        if (!initialized) return;
        if (scanInterval == null) scanInterval = setInterval(scanChat, 500);
        scanChat();
    }

    function disablePlugin() {
        isEnabled = false;
        hideDesc();
        clearWelcomeTimers();
        if (scanInterval != null) clearInterval(scanInterval);
        scanInterval = undefined;
        document.querySelectorAll(selector).forEach(button => {
            if (originals.has(button)) button.replaceWith(document.createTextNode(originals.get(button)));
        });
    }

    function destroyPlugin() {
        if (destroyed) return;
        destroyed = true;
        disablePlugin();
        cancelLogin?.();
        modApi?.unload();
        document.removeEventListener('click', onClick);
        document.removeEventListener('mouseover', onMouseOver);
        document.removeEventListener('mouseout', hideDesc);
        window.removeEventListener('beforeunload', destroyPlugin);
        descElement?.remove();
        if (window.LikoChatTtoBInstance === pluginInstance) {
            delete window.LikoChatTtoBInstance;
            delete window.Liko.CTB;
            delete window.LikoChatTtoBWelcomed;
        }
    }

    async function initialize() {
        modApi = window.bcModSdk.registerMod({
            name: 'Liko - CTB', fullName: 'BC - Chat room text conversion button',
            version: MOD_VER, repository: 'https://github.com/awdrrawd/liko-Plugin-Repository',
        });
        window.addEventListener('beforeunload', destroyPlugin);
        if (typeof Player === 'undefined' || Player?.MemberNumber == null) {
            await new Promise(resolve => {
                cancelLogin = resolve;
                const remove = modApi.hookFunction('LoginResponse', 0, (args, next) => {
                    const result = next(args);
                    queueMicrotask(() => {
                        if (destroyed || typeof Player === 'undefined' || Player?.MemberNumber == null) return;
                        remove();
                        resolve();
                    });
                    return result;
                });
            });
        }
        cancelLogin = undefined;
        if (destroyed) return;
        descElement = document.createElement('div');
        descElement.id = 'likoCommandDescription';
        Object.assign(descElement.style, {
            position: 'fixed', left: '0px', top: '0px', color: 'white', background: 'rgb(96, 10, 182)',
            fontSize: '22px', fontFamily: 'Comfortaa', padding: '8px', textAlign: 'center',
            width: '100%', display: 'none', zIndex: '1000', whiteSpace: 'pre-wrap',
        });
        document.body.appendChild(descElement);
        document.addEventListener('click', onClick);
        document.addEventListener('mouseover', onMouseOver);
        document.addEventListener('mouseout', hideDesc);
        modApi.hookFunction('ChatRoomLoad', 0, async (args, next) => {
            clearWelcomeTimers();
            const generation = roomGeneration;
            const result = await next(args);
            if (destroyed || !isEnabled || generation !== roomGeneration || CurrentScreen !== 'ChatRoom') return result;
            const timer = setTimeout(() => {
                timers.delete(timer);
                if (destroyed || !isEnabled || generation !== roomGeneration || CurrentScreen !== 'ChatRoom' || window.LikoChatTtoBWelcomed) return;
                ChatRoomSendLocal('<p>💭 Liko - Chat TtoB v' + MOD_VER + '：/指令、!!內容、#房間名稱# 可點擊使用。</p>', 30000);
                window.LikoChatTtoBWelcomed = true;
            }, 1000);
            timers.add(timer);
            return result;
        });
        modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
            clearWelcomeTimers();
            hideDesc();
            return next(args);
        });
        initialized = true;
        if (isEnabled) enablePlugin();
        console.log('🐈‍⬛ [CTB] v' + MOD_VER + ' loaded');
    }
    initialize().catch(error => {
        console.error('[CTB] Initialization failed:', error);
        destroyPlugin();
    });
})();
