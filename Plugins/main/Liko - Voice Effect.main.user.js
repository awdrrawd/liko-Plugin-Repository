// ==UserScript==
// @name         Liko - Voice Effect
// @name:zh      Liko的聲音催眠效果
// @namespace    https://likulisu.dev/
// @version      1.0.1
// @description  收到 [Voice] 訊息時觸發催眠視覺效果、彈幕、氣喘粒子、表情變化
// @author       莉柯莉絲(Likolisu)
// @match        https://bondageprojects.elementfx.com/*
// @match        https://bondage-europe.com/*
// @match        https://bondage-asia.com/*
// @match        https://www.bondageprojects.elementfx.com/*
// @match        https://www.bondage-europe.com/*
// @match        https://www.bondage-asia.com/*
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.0.1";
    if (window.Liko.VE) return;
    window.Liko.VE = MOD_VER;

    let modApi = null;

    // ════════════════════════════════════════
    //  表情清單 (四組隨機)
    // ════════════════════════════════════════
    const EXPRESSION_SETS = [
        { Eyebrows: "Soft",    Eyes: "VeryLewd",      Mouth: "Frown",  Blush: "High"     },
        { Eyebrows: "Lowered", Eyes: "HeartPink",      Mouth: "Moan",   Blush: "High"     },
        { Eyebrows: "Raised",  Eyes: "LewdHeartPink",  Mouth: "Ahegao", Blush: "VeryHigh" },
        { Eyebrows: "Lowered", Eyes: "Heart",          Mouth: "Open",   Blush: "Medium"   },
    ];

    // ════════════════════════════════════════
    //  時間設定
    // ════════════════════════════════════════
    const EFFECT_DURATION  = 4000;
    const PINK_DURATION    = 3000;
    const WAVE_DURATION    = 3500;
    const DANMAKU_DURATION = 4500;
    const STEAM_COUNT      = 14;

    // ════════════════════════════════════════
    //  BC 畫布常數
    // ════════════════════════════════════════
    const BC_CANVAS_W = 2000;
    const BC_CANVAS_H = 1000;

    const DANMAKU_X_MIN = 30;
    const DANMAKU_X_MAX = 750;
    const DANMAKU_Y_MIN = 60;
    const DANMAKU_Y_MAX = 780;

    // ════════════════════════════════════════
    //  玩家座標（DrawCharacter hook 更新）
    //  只在值真正變化時才寫入，減少無效賦值
    // ════════════════════════════════════════
    const playerDrawPos = { x: 0, y: 0, zoom: 1, valid: false };

    // ════════════════════════════════════════
    //  畫布 rect 快取（效果觸發期間只算一次）
    //  呼叫 getBoundingClientRect 會觸發 reflow，
    //  同一次效果快取起來給所有子函式共用
    // ════════════════════════════════════════
    let _cachedRect   = null;
    let _cachedScaleX = 1;
    let _cachedScaleY = 1;

    function refreshCanvasCache() {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) { _cachedRect = null; return; }
        _cachedRect   = canvas.getBoundingClientRect();
        _cachedScaleX = _cachedRect.width  / BC_CANVAS_W;
        _cachedScaleY = _cachedRect.height / BC_CANVAS_H;
    }

    function bcToScreen(bcX, bcY) {
        if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.25 };
        return {
            x: _cachedRect.left + bcX * _cachedScaleX,
            y: _cachedRect.top  + bcY * _cachedScaleY,
        };
    }

    function getPlayerHeadScreenPos() {
        if (!playerDrawPos.valid || !_cachedRect) {
            if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.22 };
            return { x: _cachedRect.left + _cachedRect.width * 0.25, y: _cachedRect.top + _cachedRect.height * 0.22 };
        }
        return bcToScreen(
            playerDrawPos.x + 240 * playerDrawPos.zoom,
            playerDrawPos.y +  75 * playerDrawPos.zoom
        );
    }

    function getPlayerBodyScreenPos() {
        if (!playerDrawPos.valid || !_cachedRect) {
            if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.55 };
            return { x: _cachedRect.left + _cachedRect.width * 0.25, y: _cachedRect.top + _cachedRect.height * 0.55 };
        }
        return bcToScreen(
            playerDrawPos.x + 240 * playerDrawPos.zoom,
            playerDrawPos.y + 500 * playerDrawPos.zoom
        );
    }

    // ════════════════════════════════════════
    //  BCX 催眠句子快取
    //  LZString 解壓成本不低，快取起來，
    //  只有讀不到或清單空時才重新解壓
    // ════════════════════════════════════════
    let _bcxReminderCache = null;

    function getBCXReminderList() {
        if (_bcxReminderCache !== null) return _bcxReminderCache;
        try {
            const bcxRaw = Player?.ExtensionSettings?.BCX;
            if (!bcxRaw) return (_bcxReminderCache = []);
            const parts      = bcxRaw.split(':');
            const compressed = parts[1];
            if (!compressed) return (_bcxReminderCache = []);
            const jsonStr    = LZString.decompressFromBase64(compressed);
            if (!jsonStr) return (_bcxReminderCache = []);
            const bcxData    = JSON.parse(jsonStr);
            const rule       = bcxData?.conditions?.rules?.conditions?.['other_constant_reminder'];
            _bcxReminderCache = rule?.data?.customData?.reminderText ?? [];
            console.log(`🎵 [VoiceEffect] BCX 清單快取完成，共 ${_bcxReminderCache.length} 句`);
            return _bcxReminderCache;
        } catch (e) {
            console.warn('🎵 [VoiceEffect] BCX 清單讀取失敗:', e.message);
            return (_bcxReminderCache = []);
        }
    }

    // BCX ExtensionSettings 更新時清除快取（換角色/重登時）
    function clearBCXCache() { _bcxReminderCache = null; }

    // ════════════════════════════════════════
    //  觸發佇列（效果播放中收到新訊息不丟棄，排隊等候）
    // ════════════════════════════════════════
    const effectQueue  = [];
    let isEffectPlaying = false;

    async function processQueue() {
        if (isEffectPlaying || effectQueue.length === 0) return;
        isEffectPlaying = true;
        const voiceText = effectQueue.shift();
        try {
            await runEffect(voiceText);
        } catch (e) {
            console.error('🎵 [VoiceEffect] 效果執行錯誤:', e.message);
        } finally {
            isEffectPlaying = false;
            // 繼續處理佇列中的下一則
            if (effectQueue.length > 0) setTimeout(processQueue, 200);
        }
    }

    function triggerVoiceEffect(voiceText) {
        // 佇列最多保留 3 則，避免累積太多
        if (effectQueue.length < 3) {
            effectQueue.push(voiceText);
            console.log(`🎵 [VoiceEffect] 排隊: "${voiceText}" (佇列: ${effectQueue.length})`);
        }
        processQueue();
    }

    // ════════════════════════════════════════
    //  工具
    // ════════════════════════════════════════
    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function getOverlay() {
        let overlay = document.getElementById('liko-voice-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'liko-voice-overlay';
            Object.assign(overlay.style, {
                position:      'fixed',
                top:           '0',
                left:          '0',
                width:         '100%',
                height:        '100%',
                pointerEvents: 'none',
                zIndex:        '99999',
                overflow:      'hidden',
            });
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    // ════════════════════════════════════════
    //  1. 粉紅畫面暈染
    // ════════════════════════════════════════
    function triggerPinkFlash() {
        const overlay = getOverlay();
        const el = document.createElement('div');
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            background: 'radial-gradient(ellipse at center, transparent 20%, rgba(255,105,180,0.18) 60%, rgba(255,60,150,0.55) 100%)',
            animation:  `likoPinkPulse ${PINK_DURATION}ms ease-in-out forwards`,
        });
        overlay.appendChild(el);
        setTimeout(() => el.remove(), PINK_DURATION + 200);
    }

    // ════════════════════════════════════════
    //  2. 催眠電波（頭部附近隨機偏移）
    // ════════════════════════════════════════
    function triggerHypnoWaves() {
        const head    = getPlayerHeadScreenPos();
        const overlay = getOverlay();

        const offsetX = (Math.random() - 0.5) * 120;
        const offsetY = (Math.random() - 0.5) * 80;

        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position:      'fixed',
            left:          `${head.x + offsetX}px`,
            top:           `${head.y + offsetY}px`,
            width:         '0',
            height:        '0',
            pointerEvents: 'none',
        });

        for (let i = 0; i < 5; i++) {
            const ring = document.createElement('div');
            Object.assign(ring.style, {
                position:     'absolute',
                width:        '10px',
                height:       '10px',
                borderRadius: '50%',
                border:       '2px solid rgba(255,255,255,0.92)',
                transform:    'translate(-50%, -50%)',
                animation:    `likoWaveExpand ${WAVE_DURATION}ms ease-out ${i * 350}ms forwards`,
                boxShadow:    '0 0 6px rgba(255,200,230,0.5)',
            });
            wrap.appendChild(ring);
        }
        overlay.appendChild(wrap);
        setTimeout(() => wrap.remove(), WAVE_DURATION + 5 * 350 + 200);
    }

    // ════════════════════════════════════════
    //  3. 彈幕（1~5句，隨機位置）
    // ════════════════════════════════════════
    function triggerDanmakuMulti(triggerText, count) {
        const overlay = getOverlay();
        const bcxList = getBCXReminderList();

        const texts = [triggerText];
        if (bcxList.length > 0 && count > 1) {
            const shuffled = [...bcxList].sort(() => Math.random() - 0.5);
            for (let i = 0; i < count - 1; i++) {
                texts.push(shuffled[i % shuffled.length]);
            }
        }

        const usedSlots = [];

        texts.forEach((text, idx) => {
            let bcX, bcY, attempts = 0;
            do {
                bcX = randInt(DANMAKU_X_MIN, DANMAKU_X_MAX);
                bcY = randInt(DANMAKU_Y_MIN, DANMAKU_Y_MAX);
                attempts++;
            } while (
                attempts < 20 &&
                usedSlots.some(s => Math.abs(s.x - bcX) < 150 && Math.abs(s.y - bcY) < 80)
            );
            usedSlots.push({ x: bcX, y: bcY });

            const pos      = bcToScreen(bcX, bcY);
            const delay    = idx * 180;
            const isFirst  = idx === 0;
            const fontSize = isFirst
                ? 24 + Math.random() * 8
                : 14 + Math.random() * 18;

            const el = document.createElement('div');
            el.textContent = text;
            Object.assign(el.style, {
                position:      'fixed',
                left:          `${pos.x}px`,
                top:           `${pos.y}px`,
                fontSize:      `${fontSize}px`,
                fontWeight:    'bold',
                color:         'rgba(255, 210, 235, 0.98)',
                textShadow:    '0 0 8px rgba(255,105,180,1), 0 0 20px rgba(255,105,180,0.7), 0 0 40px rgba(255,60,150,0.4)',
                fontFamily:    '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                whiteSpace:    'nowrap',
                letterSpacing: '2.5px',
                opacity:       '0',
                transform:     'translateY(16px) scale(0.75)',
                transition:    `opacity 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms,
                                transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms,
                                filter 0.5s ease ${delay}ms`,
                filter:        'blur(6px)',
                maxWidth:      '320px',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                willChange:    'opacity, transform, filter',
            });
            overlay.appendChild(el);

            requestAnimationFrame(() => requestAnimationFrame(() => {
                el.style.opacity   = '1';
                el.style.transform = 'translateY(0) scale(1)';
                el.style.filter    = 'blur(0px)';
            }));

            const fadeDelay = delay + DANMAKU_DURATION - 800;
            setTimeout(() => {
                el.style.transition = 'opacity 0.8s ease, transform 0.8s ease, filter 0.8s ease';
                el.style.opacity    = '0';
                el.style.transform  = 'translateY(-20px) scale(0.85)';
                el.style.filter     = 'blur(5px)';
            }, fadeDelay);

            setTimeout(() => el.remove(), delay + DANMAKU_DURATION + 300);
        });
    }

    // ════════════════════════════════════════
    //  4. 氣喘粒子
    //  改為一個統一 setTimeout 清理整批，
    //  減少 14 個獨立 timer
    // ════════════════════════════════════════
    function triggerSteamParticles() {
        const body    = getPlayerBodyScreenPos();
        const overlay = getOverlay();
        const nodes   = [];
        let maxExpiry = 0;

        for (let i = 0; i < STEAM_COUNT; i++) {
            const p       = document.createElement('div');
            const size    = 4 + Math.random() * 9;
            const offsetX = (Math.random() - 0.5) * 140;
            const delay   = Math.random() * 1200;
            const dur     = 1400 + Math.random() * 1600;

            Object.assign(p.style, {
                position:     'fixed',
                left:         `${body.x + offsetX}px`,
                top:          `${body.y}px`,
                width:        `${size}px`,
                height:       `${size}px`,
                borderRadius: '50%',
                background:   `rgba(255,255,255,${0.5 + Math.random() * 0.35})`,
                filter:       'blur(2.5px)',
                animation:    `likoSteamRise${i % 3} ${dur}ms ease-out ${delay}ms forwards`,
                willChange:   'transform, opacity',
            });
            overlay.appendChild(p);
            nodes.push(p);
            maxExpiry = Math.max(maxExpiry, dur + delay);
        }

        // 一個 timeout 統一清理所有粒子
        setTimeout(() => nodes.forEach(n => n.remove()), maxExpiry + 300);
    }

    // ════════════════════════════════════════
    //  5. 表情
    // ════════════════════════════════════════
    function saveExpression() {
        const groups = ["Eyebrows", "Eyes", "Mouth", "Blush"];
        const saved  = {};
        for (const g of groups) {
            const item = Player.Appearance.find(a => a.Asset.Group.Name === g);
            saved[g]   = item?.Property?.Expression ?? null;
        }
        return saved;
    }

    function applyExpression(exprObj) {
        for (const [g, val] of Object.entries(exprObj)) {
            try { CharacterSetFacialExpression(Player, g, val); } catch(e) {}
        }
    }

    // ════════════════════════════════════════
    //  6. 興奮度 +1~5
    // ════════════════════════════════════════
    function addArousal() {
        try {
            if (!Player.ArousalSettings || Player.ArousalSettings.Active === "Inactive") return 1;
            const current = Player.ArousalSettings.Progress ?? 0;
            const add     = randInt(1, 5);
            if (current < 80) {
                const newVal = Math.min(current + add, 100);
                ActivitySetArousal(Player, newVal);
                console.log(`🎵 [VoiceEffect] 興奮度 ${current} → ${newVal} (+${add})`);
            }
            return add;
        } catch (e) {
            console.warn('🎵 [VoiceEffect] 興奮度設定失敗:', e.message);
            return 1;
        }
    }

    // ════════════════════════════════════════
    //  主效果流程
    // ════════════════════════════════════════
    async function runEffect(voiceText) {
        console.log(`🎵 [VoiceEffect] 播放: "${voiceText}"`);

        // 效果開始前更新一次畫布快取
        refreshCanvasCache();

        const savedExpr    = saveExpression();
        const randomExpr   = EXPRESSION_SETS[Math.floor(Math.random() * EXPRESSION_SETS.length)];
        const arousalAdd   = addArousal();
        const danmakuCount = arousalAdd;

        triggerPinkFlash();
        triggerHypnoWaves();
        triggerDanmakuMulti(voiceText, danmakuCount);
        triggerSteamParticles();
        applyExpression(randomExpr);

        await wait(EFFECT_DURATION);
        applyExpression(savedExpr);
    }

    // ════════════════════════════════════════
    //  解析聊天室文字
    // ════════════════════════════════════════
    function parseVoiceText(rawText) {
        const brackets = rawText.match(/【([^】]+)】/g);
        if (brackets && brackets.length > 0) {
            const last     = brackets[brackets.length - 1].replace(/【|】/g, '');
            const colonIdx = last.indexOf(':');
            if (colonIdx !== -1) return last.slice(colonIdx + 1).trim();
            return last.trim();
        }
        return rawText.trim();
    }

    // ════════════════════════════════════════
    //  DOM Observer
    // ════════════════════════════════════════
    let _domObserver = null;

    function setupDOMObserver() {
        const chatContainer =
            document.getElementById('TextAreaChatLog') ||
            document.querySelector('.ChatLog')         ||
            document.querySelector('[id*="ChatLog"]')  ||
            document.querySelector('[class*="ChatLog"]');

        if (!chatContainer) {
            console.warn('🎵 [VoiceEffect] 找不到聊天室容器，2 秒後重試');
            setTimeout(setupDOMObserver, 2000);
            return;
        }

        // 避免重複掛載
        if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }

        _domObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    const isLocal =
                        node.classList.contains('ChatMessageLocalMessage') ||
                        !!node.querySelector?.('.ChatMessageLocalMessage');
                    if (!isLocal) continue;
                    const text       = node.textContent || '';
                    const voiceMatch = text.match(/\[Voice\]\s*(.*)/s);
                    if (!voiceMatch) continue;
                    triggerVoiceEffect(parseVoiceText(voiceMatch[1]));
                }
            }
        });

        _domObserver.observe(chatContainer, { childList: true, subtree: true });
        console.log('🎵 [VoiceEffect] ✅ DOM 觀察器已啟動');
    }

    // ════════════════════════════════════════
    //  Hook DrawCharacter
    //  只在值真的變化時才更新，避免每幀無效賦值
    // ════════════════════════════════════════
    function hookDrawCharacter() {
        if (!modApi) return;
        try {
            modApi.hookFunction('DrawCharacter', 1, (args, next) => {
                const result = next(args);
                const [character, x, y, zoom] = args;
                if (character && typeof character.IsPlayer === 'function' && character.IsPlayer()) {
                    if (playerDrawPos.x !== x || playerDrawPos.y !== y || playerDrawPos.zoom !== zoom) {
                        playerDrawPos.x     = x;
                        playerDrawPos.y     = y;
                        playerDrawPos.zoom  = zoom;
                        playerDrawPos.valid = true;
                    }
                }
                return result;
            });
            console.log('🎵 [VoiceEffect] ✅ DrawCharacter hook 已啟動');
        } catch (e) {
            console.warn('🎵 [VoiceEffect] ⚠️ DrawCharacter hook 失敗:', e.message);
        }
    }

    // ════════════════════════════════════════
    //  CSS
    // ════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('liko-voice-styles')) return;
        const style = document.createElement('style');
        style.id = 'liko-voice-styles';
        style.textContent = `
            @keyframes likoPinkPulse {
                0%   { opacity: 0; }
                12%  { opacity: 1; }
                65%  { opacity: 0.85; }
                100% { opacity: 0; }
            }
            @keyframes likoWaveExpand {
                0%   { width: 10px; height: 10px; opacity: 1; }
                80%  { opacity: 0.4; }
                100% { width: 200px; height: 200px; opacity: 0; }
            }
            @keyframes likoSteamRise0 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.85; }
                50%  { transform: translateY(-55px) translateX(8px) scale(1.2); opacity: 0.5; }
                100% { transform: translateY(-110px) translateX(15px) scale(0.4); opacity: 0; }
            }
            @keyframes likoSteamRise1 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.8; }
                50%  { transform: translateY(-50px) translateX(-10px) scale(1.3); opacity: 0.45; }
                100% { transform: translateY(-105px) translateX(-18px) scale(0.3); opacity: 0; }
            }
            @keyframes likoSteamRise2 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.9; }
                40%  { transform: translateY(-40px) translateX(4px) scale(1.1); opacity: 0.6; }
                100% { transform: translateY(-115px) translateX(-5px) scale(0.35); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════
    //  等待函數
    // ════════════════════════════════════════
    function waitForBcModSdk(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (typeof bcModSdk !== 'undefined' && bcModSdk?.registerMod) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    function waitForGame(timeout = 30000) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (
                    typeof Player !== 'undefined' &&
                    typeof CharacterSetFacialExpression === 'function' &&
                    typeof ChatRoomCharacter !== 'undefined'
                ) resolve(true);
                else if (Date.now() - start > timeout) resolve(false);
                else setTimeout(check, 100);
            };
            check();
        });
    }

    let _fallbackInterval = null;

    function waitForChatRoom() {
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
            setupDOMObserver();
            return;
        }
        if (modApi) {
            let started = false;
            modApi.hookFunction('ChatRoomRun', 0, (args, next) => {
                const result = next(args);
                if (!started) {
                    started = true;
                    // BCX 設定可能在換房間時更新，清除快取
                    clearBCXCache();
                    setTimeout(setupDOMObserver, 500);
                }
                return result;
            });
            // 離開房間時重置 Observer，下次進房間重新掛
            modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
                const result = next(args);
                if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }
                clearBCXCache();
                return result;
            });
        } else {
            // fallback：儲存 interval id 以便清理
            _fallbackInterval = setInterval(() => {
                if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                    clearInterval(_fallbackInterval);
                    _fallbackInterval = null;
                    setTimeout(setupDOMObserver, 500);
                }
            }, 1000);
        }
    }

    // ════════════════════════════════════════
    //  初始化
    // ════════════════════════════════════════
    async function initialize() {
        console.log('🎵 [VoiceEffect] ⌛ 初始化中...');
        injectStyles();

        const sdkReady  = await waitForBcModSdk();
        const gameReady = await waitForGame();

        if (!gameReady) {
            console.error('🎵 [VoiceEffect] ❌ 遊戲載入逾時');
            return;
        }

        if (sdkReady) {
            try {
                modApi = bcModSdk.registerMod({
                    name:       'Liko - Voice Effect',
                    fullName:   'Bondage Club - Liko Voice Hypno Effect',
                    version:    '1.0',
                    repository: '莉柯莉絲的聲音催眠效果',
                });
                console.log('🎵 [VoiceEffect] ✅ bcModSdk 註冊成功');

                modApi.onUnload(() => {
                    if (_domObserver)       { _domObserver.disconnect(); _domObserver = null; }
                    if (_fallbackInterval)  { clearInterval(_fallbackInterval); _fallbackInterval = null; }
                    const overlay = document.getElementById('liko-voice-overlay');
                    if (overlay) overlay.remove();
                    const styles = document.getElementById('liko-voice-styles');
                    if (styles) styles.remove();
                    console.log('🎵 [VoiceEffect] 已卸載');
                });
            } catch (e) {
                console.warn('🎵 [VoiceEffect] ⚠️ 相容模式:', e.message);
            }
        }

        hookDrawCharacter();
        waitForChatRoom();
        console.log('🎵 [VoiceEffect] ✅ 初始化完成 v1.0.1');
    }

    initialize();

})();
