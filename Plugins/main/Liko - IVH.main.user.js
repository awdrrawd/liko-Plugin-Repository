// ==UserScript==
// @name         IVH - Immersive Voice Hypnosis
// @name:zh      沉浸式聲音催眠效果
// @namespace    https://likulisu.dev/
// @version      1.0
// @description  收到 [Voice] 訊息時觸發深度催眠視覺效果，支援 /ivh 指令
// @author       莉柯莉絲(Likolisu)
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @require      https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    const MOD_VER = "1.0";
    if (window.Liko.IVH) return;
    window.Liko.IVH = MOD_VER;

    let modApi = null;

    // ════════════════════════════════════════
    //  設定（可由指令切換）
    // ════════════════════════════════════════
    const CONFIG = {
        // 功能開關
        pinkFlash:      true,  // 粉紅暈染
        hypnoSpiral:    true,  // 催眠螺旋
        hypnoWaves:     true,  // 同心圓電波
        screenDistort:  true,  // 畫面扭曲
        vignette:       true,  // 邊緣暗角
        danmaku:        true,  // 彈幕文字
        steamParticles: true,  // 氣喘粒子
        expression:     true,  // 表情切換
        arousal:        true,  // 興奮度+
        climax:         true,  // 高潮特效
        climaxMode:    "orgasm", // orgasm=高潮才觸發 | always=每次催眠都觸發
        sound:          false, // 喘息聲音（預設關閉）
        // 強度（0.5 輕柔 / 1.0 正常 / 1.5 強烈）
        intensity:      1.0,
    };

    // ════════════════════════════════════════
    //  表情清單
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
    const BASE_EFFECT_DURATION  = 5000;
    const BASE_PINK_DURATION    = 3000;
    const BASE_WAVE_DURATION    = 3500;
    const BASE_DANMAKU_DURATION = 5000;
    const SPIRAL_DURATION       = 5500;
    const DISTORT_DURATION      = 1200;
    const VIGNETTE_DURATION     = 4500;
    const STEAM_COUNT           = 14;

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
    //  玩家座標
    // ════════════════════════════════════════
    const playerDrawPos = { x: 0, y: 0, zoom: 1, valid: false, isKneeling: false, isProne: false };

    // ════════════════════════════════════════
    //  畫布快取
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

    // ════════════════════════════════════════
    //  頭部位置設定（可由 /ivh debug 即時校正）
    //  Y 微調（BC 座標，正=往下）
    // ════════════════════════════════════════
    const HEAD_OFFSET = {
        base:  165,   // HeightRatio=1（身高 165）時的頭頂 Y（BC 座標）
        perUnit: 8.75, // HeightRatio 每差 0.01 對應的 Y 變化量
        poseStand: 0,   // 站立姿勢偏移
        poseKneel: 250, // 跪姿偏移（正=往下，因為 HeightModifier 讓格子下移）
        poseProne: 560, // 趴姿偏移
        x:     0,     // 水平微調
        yExtra: 0,    // 額外微調
    };

    // 根據 HeightRatio 和姿勢計算頭部 BC Y 座標
    function calcHeadBcY() {
        const hr = (typeof Player?.HeightRatio === 'number') ? Player.HeightRatio : 1.0;
        // 身高偏差：HeightRatio < 1 代表比基準矮，頭部 Y 要增加
        const heightDiff = Math.floor((1 - hr) / 0.01 * HEAD_OFFSET.perUnit);
        const baseY = HEAD_OFFSET.base + heightDiff;

        let poseOffset;
        if      (playerDrawPos.isProne)    poseOffset = HEAD_OFFSET.poseProne;
        else if (playerDrawPos.isKneeling) poseOffset = HEAD_OFFSET.poseKneel;
        else                               poseOffset = HEAD_OFFSET.poseStand;

        return baseY + poseOffset;
    }

    // 根據 BC 的 DrawCharacter 參數計算頭部螢幕座標
    // 參考 BC 源碼：
    //   XOffset = 500 * (1 - HeightRatio) / 2  （矮角色往右補）
    //   YOffset = 1000 * (1 - HeightRatio) * proportion - HeightModifier * HeightRatio
    let _lastDrawFrame = 0;

    // 判斷玩家是否在目前顯示的頁面（用 ChatRoomCharacterViewOffset 直接判斷）
    // BC 每列顯示 5 人（上排 5、下排 5，共 10 人），offset 指向第一個顯示的角色 index
    function isPlayerOnCurrentPage() {
        try {
            if (typeof ChatRoomCharacter === 'undefined' || !Array.isArray(ChatRoomCharacter)) return true;
            const myIdx = ChatRoomCharacter.findIndex(c => c?.MemberNumber === Player?.MemberNumber);
            if (myIdx < 0) return true; // 找不到就不擋
            const total = ChatRoomCharacter.length;
            if (total <= 5) return true; // 5人以下不分頁，永遠顯示
            const offset = (typeof ChatRoomCharacterViewOffset !== 'undefined') ? ChatRoomCharacterViewOffset : 0;
            // BC 一個「畫面」顯示最多 10 人（上排 5 + 下排 5）
            return myIdx >= offset && myIdx < offset + 10;
        } catch { return true; }
    }

    function getPlayerHeadScreenPos() {
        // 若玩家不在目前顯示頁，螺旋回到畫面正中間 BC (500, 500)
        if (!isPlayerOnCurrentPage()) {
            return bcToScreen(500, 500);
        }
        if (!playerDrawPos.valid || !_cachedRect) {
            if (!_cachedRect) return { x: window.innerWidth * 0.25, y: window.innerHeight * 0.15 };
            return { x: _cachedRect.left + _cachedRect.width * 0.25, y: _cachedRect.top + _cachedRect.height * 0.12 };
        }

        // ChatRoomCharacterViewDrawOverlay 給的 CharX/CharY 已是最終 BC 座標
        // 角色水平中心 = CharX + 250 * zoom（BC canvas 寬 500，中心在 250）
        const zoom    = playerDrawPos.zoom;
        const headBcX = 250 + HEAD_OFFSET.x;
        const headBcY = calcHeadBcY();

        const screenX = _cachedRect.left + (playerDrawPos.x + headBcX * zoom) * _cachedScaleX;
        const screenY = _cachedRect.top  + (playerDrawPos.y + headBcY  * zoom) * _cachedScaleY
        + HEAD_OFFSET.yExtra;

        return { x: screenX, y: screenY };
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
    //  取得目前興奮度（0~100）
    // ════════════════════════════════════════
    function getArousalLevel() {
        try {
            return Player?.ArousalSettings?.Progress ?? 0;
        } catch { return 0; }
    }

    // intensity 0.5~2.0，由 CONFIG.intensity × 興奮度加成
    function effectScale() {
        const arousal = getArousalLevel();
        const arousalBonus = 1 + (arousal / 100) * 0.6; // 最高 +60%
        return CONFIG.intensity * arousalBonus;
    }

    // ════════════════════════════════════════
    //  BCX 快取
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
            return _bcxReminderCache;
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] BCX 清單讀取失敗:', e.message);
            return (_bcxReminderCache = []);
        }
    }

    function clearBCXCache() { _bcxReminderCache = null; }

    // ════════════════════════════════════════
    //  效果佇列
    // ════════════════════════════════════════
    const effectQueue   = [];
    let isEffectPlaying = false;

    async function processQueue() {
        if (isEffectPlaying || effectQueue.length === 0) return;
        isEffectPlaying = true;
        const item = effectQueue.shift();
        try {
            await runEffect(item.text, item.isTest ?? false);
        } catch (e) {
            console.error('🐈‍⬛ [IVH] 效果執行錯誤:', e.message);
        } finally {
            isEffectPlaying = false;
            if (effectQueue.length > 0) setTimeout(processQueue, 300);
        }
    }

    function triggerVoiceEffect(voiceText, isTest = false) {
        if (effectQueue.length < 3) {
            effectQueue.push({ text: voiceText, isTest });
        }
        processQueue();
    }

    // ════════════════════════════════════════
    //  工具
    // ════════════════════════════════════════
    function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
    function randFloat(min, max) { return Math.random() * (max - min) + min; }

    // ── 語言判斷（每次呼叫時才讀，確保 TranslationLanguage 已載入）──
    function isZh() {
        try {
            if (typeof TranslationLanguage !== 'undefined' && TranslationLanguage) {
                const l = TranslationLanguage.toLowerCase();
                return l === 'cn' || l === 'tw';
            }
        } catch {}
        return (navigator.language || '').toLowerCase().startsWith('zh');
    }

    function T(zh, en) { return isZh() ? zh : en; }

    const TOGGLE_LABELS = {
        pinkFlash:      () => ['🌸', T('粉紅暈染','Pink Flash')],
        hypnoSpiral:    () => ['🌀', T('催眠螺旋','Hypno Spiral')],
        hypnoWaves:     () => ['〰️', T('同心電波','Hypno Waves')],
        screenDistort:  () => ['🔮', T('畫面扭曲','Distortion')],
        vignette:       () => ['🌑', T('邊緣暗角','Vignette')],
        danmaku:        () => ['💬', T('彈幕文字','Danmaku')],
        steamParticles: () => ['💨', T('氣喘粒子','Steam FX')],
        expression:     () => ['😳', T('表情切換','Expression')],
        arousal:        () => ['💗', T('興奮度+', 'Arousal+')],
        climax:         () => ['💥', T('高潮特效','Climax FX')],
        sound:          () => ['🔊', T('喘息聲音','Sound')],
    };

    function getOverlay() {
        let overlay = document.getElementById('ivh-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ivh-overlay';
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
    //  1. 粉紅暈染（強度動態）
    // ════════════════════════════════════════
    function triggerPinkFlash() {
        if (!CONFIG.pinkFlash) return;
        const scale   = effectScale();
        const dur     = BASE_PINK_DURATION * Math.min(scale, 1.5);
        const alpha1  = Math.min(0.18 * scale, 0.35);
        const alpha2  = Math.min(0.55 * scale, 0.80);
        const overlay = getOverlay();
        const el      = document.createElement('div');
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            background: `radial-gradient(ellipse at center, transparent 20%, rgba(255,105,180,${alpha1}) 60%, rgba(255,60,150,${alpha2}) 100%)`,
            animation:  `ivhPinkPulse ${dur}ms ease-in-out forwards`,
        });
        overlay.appendChild(el);
        setTimeout(() => el.remove(), dur + 200);
    }

    // ════════════════════════════════════════
    //  2. 邊緣暗角（沉浸感）
    // ════════════════════════════════════════
    function triggerVignette() {
        if (!CONFIG.vignette) return;
        const scale  = effectScale();
        const alpha  = Math.min(0.65 * scale, 0.90);
        const overlay = getOverlay();
        const el     = document.createElement('div');
        Object.assign(el.style, {
            position:   'absolute',
            inset:      '0',
            background: `radial-gradient(ellipse at 50% 45%, transparent 35%, rgba(0,0,0,${alpha}) 100%)`,
            animation:  `ivhVignette ${VIGNETTE_DURATION}ms ease-in-out forwards`,
        });
        overlay.appendChild(el);
        setTimeout(() => el.remove(), VIGNETTE_DURATION + 200);
    }

    // ════════════════════════════════════════
    //  3. 催眠螺旋（SVG 旋轉）
    // ════════════════════════════════════════
    function triggerHypnoSpiral() {
        if (!CONFIG.hypnoSpiral) return;
        const scale  = effectScale();
        const head   = getPlayerHeadScreenPos();
        const size   = Math.round(180 * Math.min(scale, 1.6));
        const overlay = getOverlay();

        // 螺旋固定在頭部正中央，不做隨機偏移
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position:      'fixed',
            left:          `${Math.round(head.x - size / 2)}px`,
            top:           `${Math.round(head.y - size / 2 - 20)}px`,
            width:         `${size}px`,
            height:        `${size}px`,
            pointerEvents: 'none',
            opacity:       '0',
            transition:    'opacity 0.4s ease',
        });

        // SVG 螺旋（阿基米德螺旋線，用多圈弧段組成）
        const ns   = 'http://www.w3.org/2000/svg';
        const svg  = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '-100 -100 200 200');
        svg.setAttribute('width',  `${size}`);
        svg.setAttribute('height', `${size}`);
        svg.style.animation = `ivhSpiralSpin ${1800 / scale}ms linear infinite`;

        const defs  = document.createElementNS(ns, 'defs');
        const grad  = document.createElementNS(ns, 'radialGradient');
        grad.id = 'ivhSpiralGrad';
        const stops = [
            { offset: '0%',   color: 'rgba(255,200,230,0.95)' },
            { offset: '50%',  color: 'rgba(255,120,180,0.75)' },
            { offset: '100%', color: 'rgba(255,60,150,0)' },
        ];
        stops.forEach(s => {
            const stop = document.createElementNS(ns, 'stop');
            stop.setAttribute('offset', s.offset);
            stop.setAttribute('stop-color', s.color);
            grad.appendChild(stop);
        });
        defs.appendChild(grad);
        svg.appendChild(defs);

        // 畫螺旋路徑（3 圈）
        const turns  = 3;
        const points = 360;
        let d        = '';
        for (let i = 0; i <= turns * points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const r     = (i / (turns * points)) * 88;
            const x     = r * Math.cos(angle);
            const y     = r * Math.sin(angle);
            d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
        }
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'url(#ivhSpiralGrad)');
        path.setAttribute('stroke-width', '3.5');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);

        // 中心光點
        const circle = document.createElementNS(ns, 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', '5');
        circle.setAttribute('fill', 'rgba(255,230,245,0.9)');
        circle.style.filter = 'blur(1px)';
        svg.appendChild(circle);

        wrap.appendChild(svg);
        overlay.appendChild(wrap);

        requestAnimationFrame(() => { wrap.style.opacity = '1'; });

        // 結束漸出
        setTimeout(() => {
            wrap.style.transition = 'opacity 0.6s ease';
            wrap.style.opacity    = '0';
        }, SPIRAL_DURATION - 600);
        setTimeout(() => wrap.remove(), SPIRAL_DURATION + 100);
    }

    // ════════════════════════════════════════
    //  4. 同心圓電波（左半邊任意位置，每次固定 3 組）
    // ════════════════════════════════════════
    function triggerHypnoWaves(wordCount = 1) {
        if (!CONFIG.hypnoWaves) return;
        const scale   = effectScale();
        const overlay = getOverlay();
        const dur     = BASE_WAVE_DURATION;

        // 固定 3 組電波，分佈在左半邊 BC 座標（X: 0~1000，Y: 全範圍）
        // BC 畫布是 2000 寬，左半邊是 0~1000
        const groupCount = 3;
        const usedPos = [];

        for (let g = 0; g < groupCount; g++) {
            let bcX, bcY, attempts = 0;
            do {
                bcX = randInt(30, 980);   // 左半邊全範圍
                bcY = randInt(80, 900);
                attempts++;
            } while (
                attempts < 30 &&
                usedPos.some(p => Math.abs(p.x - bcX) < 150 && Math.abs(p.y - bcY) < 120)
            );
            usedPos.push({ x: bcX, y: bcY });

            const pos       = bcToScreen(bcX, bcY);
            const ringCount = Math.round(4 * Math.min(scale, 1.5));
            const groupDelay = g * 220; // 各組略微錯開，視覺更層次

            const wrap = document.createElement('div');
            Object.assign(wrap.style, {
                position:      'fixed',
                left:          `${pos.x}px`,
                top:           `${pos.y}px`,
                width:         '0',
                height:        '0',
                pointerEvents: 'none',
            });

            for (let i = 0; i < ringCount; i++) {
                const ring = document.createElement('div');
                const hue  = 320 + Math.random() * 40;
                Object.assign(ring.style, {
                    position:     'absolute',
                    width:        '10px',
                    height:       '10px',
                    borderRadius: '50%',
                    border:       `2px solid hsla(${hue},100%,78%,0.88)`,
                    transform:    'translate(-50%, -50%)',
                    animation:    `ivhWaveExpand ${dur}ms ease-out ${groupDelay + i * 300}ms forwards`,
                    boxShadow:    `0 0 8px hsla(${hue},100%,75%,0.5)`,
                });
                wrap.appendChild(ring);
            }
            overlay.appendChild(wrap);
            setTimeout(() => wrap.remove(), dur + groupDelay + ringCount * 300 + 200);
        }
    }

    // ════════════════════════════════════════
    //  5. 快照扭曲（截取 canvas → img → CSS transform → 刪除）
    // ════════════════════════════════════════
    function triggerScreenDistort() {
        if (!CONFIG.screenDistort) return;
        const scale  = effectScale();
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return;

        // 截圖
        let dataURL;
        try { dataURL = canvas.toDataURL(); } catch(e) { return; } // 跨域保護時跳過

        const rect    = canvas.getBoundingClientRect();
        const overlay = getOverlay();

        const snap = document.createElement('img');
        snap.src = dataURL;
        Object.assign(snap.style, {
            position:        'fixed',
            left:            `${rect.left}px`,
            top:             `${rect.top}px`,
            width:           `${rect.width}px`,
            height:          `${rect.height}px`,
            pointerEvents:   'none',
            zIndex:          '99990',  // canvas 上，但在 overlay 文字效果下
            transformOrigin: '50% 50%',
            willChange:      'transform, filter, opacity',
        });
        document.body.appendChild(snap);

        // 催眠感：輕微旋轉 + 縮小拉近 + 粉色濾鏡，不做 skew
        const blurAmt = (2.5 * Math.min(scale, 1.8)).toFixed(1);
        const rotAmt  = (2.5 * Math.min(scale, 1.6)).toFixed(2);  // 最多約 4deg
        const HOLD    = 600;    // 扭曲維持時間
        const RECOVER = 1800;   // 恢復時間（慢慢清醒感）

        // 第一幀：旋轉縮小 + 模糊 + 粉調
        requestAnimationFrame(() => {
            snap.style.transition = `transform 400ms cubic-bezier(0.2,0,0.8,1),
                                     filter    400ms ease,
                                     opacity   200ms ease`;
            snap.style.transform  = `rotate(${rotAmt}deg) scale(0.97)`;
            snap.style.filter     = `blur(${blurAmt}px) brightness(0.85) saturate(1.5) hue-rotate(-15deg)`;
            snap.style.opacity    = '1';
        });

        // 中段：反向輕轉（回盪感）
        setTimeout(() => {
            snap.style.transition = `transform ${HOLD}ms cubic-bezier(0.4,0,0.6,1),
                                     filter    ${HOLD}ms ease`;
            snap.style.transform  = `rotate(-${(rotAmt * 0.4).toFixed(2)}deg) scale(0.99)`;
            snap.style.filter     = `blur(${(blurAmt * 0.4).toFixed(1)}px) brightness(0.93) saturate(1.2) hue-rotate(-5deg)`;
        }, 420);

        // 恢復：緩緩歸正，opacity 延後淡出（意識慢慢回來）
        setTimeout(() => {
            snap.style.transition = `transform ${RECOVER}ms cubic-bezier(0.25,0.1,0.25,1),
                                     filter    ${RECOVER}ms cubic-bezier(0.25,0.1,0.25,1),
                                     opacity   ${Math.round(RECOVER * 0.55)}ms ease ${Math.round(RECOVER * 0.45)}ms`;
            snap.style.transform  = 'rotate(0deg) scale(1)';
            snap.style.filter     = 'blur(0px) brightness(1) saturate(1) hue-rotate(0deg)';
            snap.style.opacity    = '0';
        }, 420 + HOLD + 80);

        // 清除快照
        setTimeout(() => snap.remove(), 420 + HOLD + RECOVER + 300);
    }

    // ════════════════════════════════════════
    //  Debug 工具：在螢幕指定位置畫紅圈（持續 N ms）
    // ════════════════════════════════════════
    function _debugDot(x, y, ms = 3000) {
        const dot = document.createElement('div');
        Object.assign(dot.style, {
            position:     'fixed',
            left:         `${x - 10}px`,
            top:          `${y - 10}px`,
            width:        '20px',
            height:       '20px',
            borderRadius: '50%',
            background:   'rgba(255,0,0,0.8)',
            border:       '2px solid white',
            zIndex:       '999999',
            pointerEvents:'none',
        });
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), ms);
    }

    // ════════════════════════════════════════
    //  座標校正 UI（/ivh calibrate 開啟）
    //  浮動面板 + 即時紅點，直接拖拉校正
    // ════════════════════════════════════════
    let _calibratePanel = null;

    function openCalibratePanel() {
        if (_calibratePanel) { _calibratePanel.remove(); _calibratePanel = null; }
        refreshCanvasCache();

        const panel = document.createElement('div');
        _calibratePanel = panel;
        Object.assign(panel.style, {
            position:    'fixed',
            top:         '60px',
            right:       '20px',
            width:       '260px',
            background:  'rgba(20,5,30,0.95)',
            border:      '1px solid rgba(255,100,200,0.4)',
            borderRadius:'10px',
            padding:     '12px',
            zIndex:      '999999',
            fontFamily:  'monospace',
            fontSize:    '12px',
            color:       '#ffccee',
            userSelect:  'none',
        });

        const title = document.createElement('div');
        title.textContent = '🌀 IVH 頭部座標校正';
        title.style.cssText = 'font-weight:bold;margin-bottom:10px;color:#ff99dd;font-size:13px';
        panel.appendChild(title);

        // 共四個滑條：stand / kneel / prone / x / yExtra
        const sliders = [
            { key: 'base',      label: '基準 Y（HR=1）', min: 50,   max: 400,  step: 5  },
            { key: 'poseKneel', label: '跪姿偏移',       min: 0,    max: 600,  step: 5  },
            { key: 'poseProne', label: '趴姿偏移',       min: 0,    max: 900,  step: 5  },
            { key: 'x',        label: '水平 X',          min: -200, max: 200,  step: 5  },
            { key: 'yExtra',   label: 'Y 微調',          min: -200, max: 200,  step: 2  },
        ];

        const dots = [];
        sliders.forEach(({ key, label, min, max, step }) => {
            const row = document.createElement('div');
            row.style.cssText = 'margin-bottom:8px';

            const labelEl = document.createElement('div');
            labelEl.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:2px';
            const lspan = document.createElement('span'); lspan.textContent = label;
            const vspan = document.createElement('span');
            vspan.textContent = HEAD_OFFSET[key];
            vspan.id = `ivh-cal-val-${key}`;
            labelEl.appendChild(lspan); labelEl.appendChild(vspan);

            const slider = document.createElement('input');
            slider.type  = 'range';
            slider.min   = String(min); slider.max = String(max); slider.step = String(step);
            slider.value = String(HEAD_OFFSET[key]);
            slider.style.cssText = 'width:100%;accent-color:#ff80cc;cursor:pointer';

            slider.addEventListener('input', () => {
                HEAD_OFFSET[key] = parseFloat(slider.value);
                vspan.textContent = slider.value;
                _updateCalibrateDot();
            });

            row.appendChild(labelEl); row.appendChild(slider);
            panel.appendChild(row);
        });

        // 紅點顯示目前頭部位置
        let _dot = null;
        function _updateCalibrateDot() {
            if (_dot) _dot.remove();
            const head = getPlayerHeadScreenPos();
            _dot = document.createElement('div');
            Object.assign(_dot.style, {
                position:     'fixed',
                left:         `${head.x - 12}px`,
                top:          `${head.y - 12}px`,
                width:        '24px',
                height:       '24px',
                borderRadius: '50%',
                background:   'rgba(255,0,80,0.85)',
                border:       '2px solid white',
                zIndex:       '999998',
                pointerEvents:'none',
                boxShadow:    '0 0 10px rgba(255,0,80,0.6)',
            });
            const line = document.createElement('div');
            Object.assign(line.style, {
                position: 'absolute', top: '50%', left: '-30px',
                width: '84px', height: '2px',
                background: 'rgba(255,100,100,0.5)',
                transform: 'translateY(-50%)',
            });
            _dot.appendChild(line);
            document.body.appendChild(_dot);
        }
        _updateCalibrateDot();

        // 複製值按鈕
        const copyRow = document.createElement('div');
        copyRow.style.cssText = 'margin-top:10px;display:flex;gap:6px';
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 複製設定值';
        copyBtn.style.cssText = 'flex:1;background:#3a0a50;border:1px solid #ff80cc;border-radius:5px;color:#ffccee;padding:5px;cursor:pointer;font-size:11px';
        copyBtn.onclick = () => {
            const txt = `stand:${HEAD_OFFSET.stand} kneel:${HEAD_OFFSET.kneel} prone:${HEAD_OFFSET.prone} x:${HEAD_OFFSET.x} yExtra:${HEAD_OFFSET.yExtra}`;
            navigator.clipboard.writeText(txt).catch(() => {});
            printChat('🔧 校正值已複製: ' + txt);
        };
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'background:#2a0a30;border:1px solid #ff80cc;border-radius:5px;color:#ffccee;padding:5px 8px;cursor:pointer';
        closeBtn.onclick = () => {
            panel.remove(); _calibratePanel = null;
            if (_dot) { _dot.remove(); _dot = null; }
        };
        copyRow.appendChild(copyBtn); copyRow.appendChild(closeBtn);
        panel.appendChild(copyRow);

        document.body.appendChild(panel);
        printChat('🔧 校正面板已開啟，拉動滑條即時看紅點位置，調好後點「複製設定值」給開發者');
    }

    // ════════════════════════════════════════
    //  自動換行：12 全形字元 / 24 半形字元換一行
    // ════════════════════════════════════════
    function wrapDanmakuText(text, fullWidth = 12) {
        // 判斷全形字（CJK、全形標點等）= 2 寬度；半形 = 1 寬度
        const charWidth = (ch) => {
            const code = ch.codePointAt(0);
            // CJK 統一漢字、全形符號、片假名、平假名
            if ((code >= 0x1100 && code <= 0x115F) ||
                (code >= 0x2E80 && code <= 0x9FFF) ||
                (code >= 0xA000 && code <= 0xA4CF) ||
                (code >= 0xAC00 && code <= 0xD7AF) ||
                (code >= 0xF900 && code <= 0xFAFF) ||
                (code >= 0xFE10 && code <= 0xFE1F) ||
                (code >= 0xFE30 && code <= 0xFE4F) ||
                (code >= 0xFF00 && code <= 0xFF60) ||
                (code >= 0xFFE0 && code <= 0xFFE6)) return 2;
            return 1;
        };
        const halfLimit = fullWidth * 2; // 半形字元上限
        const lines = [];
        let cur = '', curW = 0;
        for (const ch of [...text]) {
            const w = charWidth(ch);
            if (curW + w > halfLimit) { lines.push(cur); cur = ch; curW = w; }
            else                      { cur += ch; curW += w; }
        }
        if (cur) lines.push(cur);
        return lines.join('\n');
    }

    // ════════════════════════════════════════
    //  6. 彈幕：主台詞在頭上波浪，其餘散落左側
    //  - 旁白句：4~9 句，依 3 等份分配字體大小
    //    第一份最小，第三份最大（疊加感）
    //  - 主台詞：固定在角色頭部正上方，波浪動畫
    // ════════════════════════════════════════
    function triggerDanmakuMulti(triggerText, _count) {
        if (!CONFIG.danmaku) return;
        const scale   = effectScale();
        const overlay = getOverlay();
        const bcxList = getBCXReminderList();

        // ── 主台詞：角色頭上，波浪動畫 ──
        const head = getPlayerHeadScreenPos();
        _showMainDanmaku(overlay, triggerText, head, scale);

        // ── 旁白句：從 BCX 清單取 4~9 句，散落左側 ──
        if (bcxList.length === 0) return;
        const shuffled = [...bcxList].sort(() => Math.random() - 0.5);
        const sideCount = Math.min(Math.max(4, Math.floor(shuffled.length * 0.8)), 9);
        const sideTexts = shuffled.slice(0, sideCount);

        // 3 等份切割，計算每份的字體大小
        const third   = Math.ceil(sideCount / 3);
        // 預先決定每句的字體（小→中→大，在每份內再隨機 ±1pt）
        const basePts = [14, 20, 26]; // 三份的基礎 pt（14→20→26，每句+2）

        // 排除頭部附近的座標（BC 座標）
        const headBcX = playerDrawPos.valid ? playerDrawPos.x + 240 * playerDrawPos.zoom : 240;
        const headBcY = playerDrawPos.valid ? playerDrawPos.y + 120 * playerDrawPos.zoom : 120;
        const HEAD_SAFE_R = 180; // 頭部安全圓半徑（BC 座標單位）

        const usedSlots = [];

        sideTexts.forEach((text, idx) => {
            const tier     = Math.floor(idx / third);           // 0, 1, 2
            const basePt   = basePts[Math.min(tier, 2)];
            // 在同一份內每句 +2pt，製造疊加感
            const inTierIdx = idx % third;
            const fontSize  = Math.round((basePt + inTierIdx * 2) * Math.min(scale, 1.2));

            let bcX, bcY, attempts = 0;
            do {
                bcX = randInt(20, 500);   // 左半側
                bcY = randInt(80, 900);
                attempts++;
            } while (
                attempts < 30 && (
                    usedSlots.some(s => Math.abs(s.x - bcX) < 120 && Math.abs(s.y - bcY) < 70) ||
                    (Math.abs(bcX - headBcX) < HEAD_SAFE_R && Math.abs(bcY - headBcY) < HEAD_SAFE_R)
                )
            );
            usedSlots.push({ x: bcX, y: bcY });

            const pos       = bcToScreen(bcX, bcY);
            const lineDelay = idx * 180;

            const wrap = document.createElement('div');
            Object.assign(wrap.style, {
                position:      'fixed',
                left:          `${pos.x}px`,
                top:           `${pos.y}px`,
                fontSize:      `${fontSize}px`,
                fontWeight:    tier === 2 ? '700' : '500',
                fontFamily:    '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
                whiteSpace:    'nowrap',
                letterSpacing: '1.5px',
                color:         `rgba(255,210,235,${0.55 + tier * 0.15})`,
                textShadow:    `0 0 ${6 + tier * 4}px rgba(255,105,180,${0.6 + tier * 0.2})`,
                opacity:       '0',
                pointerEvents: 'none',
                transform:     'translateY(10px)',
            });
            overlay.appendChild(wrap);

            setTimeout(() => {
                wrap.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                wrap.style.opacity    = String(0.55 + tier * 0.15);
                wrap.style.transform  = 'translateY(0)';
            }, lineDelay);

            // 自動換行（12 全形 / 24 半形）
            const wrapped = wrapDanmakuText(text, 12);
            wrap.style.whiteSpace = 'pre-line';
            wrap.textContent = wrapped;

            const totalDur = lineDelay + BASE_DANMAKU_DURATION + sideCount * 80;
            setTimeout(() => {
                wrap.style.transition = 'opacity 1s ease, transform 1s ease';
                wrap.style.opacity    = '0';
                wrap.style.transform  = 'translateY(-14px)';
            }, totalDur - 1000);
            setTimeout(() => wrap.remove(), totalDur + 300);
        });
    }

    // 主台詞波浪效果（在角色頭部正上方）
    function _showMainDanmaku(overlay, text, headPos, scale) {
        const fontSize = Math.round(24 * Math.min(scale, 1.5));  // 主台詞比旁白大 +4pt
        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position:      'fixed',
            left:          `${headPos.x}px`,
            top:           `${headPos.y - fontSize * 2.2}px`,  // 頭頂上方
            fontSize:      `${fontSize}px`,
            fontWeight:    '700',
            fontFamily:    '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
            whiteSpace:    'nowrap',
            letterSpacing: '3px',
            color:         'rgba(255,230,245,1)',
            textShadow:    '0 0 10px rgba(255,80,160,1), 0 0 28px rgba(255,80,160,0.7), 0 0 50px rgba(255,60,140,0.4)',
            opacity:       '0',
            pointerEvents: 'none',
            transform:     'translateX(-50%)',  // 水平置中對齊頭部
        });

        // 主台詞也換行（12 全形 / 24 半形）
        const wrappedText = wrapDanmakuText(text, 12);
        // 逐字建立，每個字有波浪 delay
        const chars = [...wrappedText];
        chars.forEach((ch, i) => {
            const span = document.createElement('span');
            span.textContent = ch;
            span.style.cssText = `
                display:inline-block;
                animation: ivhWaveChar 1.8s ease-in-out ${i * 80}ms infinite;
                opacity:0;
                transition: opacity 0.3s ease ${i * 40}ms;
            `;
            wrap.appendChild(span);
        });

        overlay.appendChild(wrap);

        // 淡入
        requestAnimationFrame(() => requestAnimationFrame(() => {
            wrap.style.opacity = '1';
            wrap.querySelectorAll('span').forEach(s => s.style.opacity = '1');
        }));

        // 淡出（比旁白句晚一點消失，主台詞是重點）
        const dur = BASE_DANMAKU_DURATION + 1200;
        setTimeout(() => {
            wrap.style.transition = 'opacity 1.2s ease';
            wrap.style.opacity    = '0';
        }, dur - 1200);
        setTimeout(() => wrap.remove(), dur + 200);
    }

    // ════════════════════════════════════════
    //  7. 氣喘粒子
    // ════════════════════════════════════════
    function triggerSteamParticles() {
        if (!CONFIG.steamParticles) return;
        const scale   = effectScale();
        const body    = getPlayerBodyScreenPos();
        const overlay = getOverlay();
        const count   = Math.round(STEAM_COUNT * Math.min(scale, 1.5));
        const nodes   = [];
        let maxExpiry = 0;

        for (let i = 0; i < count; i++) {
            const p       = document.createElement('div');
            const size    = (4 + Math.random() * 9) * Math.min(scale, 1.3);
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
                animation:    `ivhSteamRise${i % 3} ${dur}ms ease-out ${delay}ms forwards`,
                willChange:   'transform, opacity',
            });
            overlay.appendChild(p);
            nodes.push(p);
            maxExpiry = Math.max(maxExpiry, dur + delay);
        }
        setTimeout(() => nodes.forEach(n => n.remove()), maxExpiry + 300);
    }

    // ════════════════════════════════════════
    //  高潮特效
    //  快照破壞：像素碎裂 + 紅白閃 + 震動
    // ════════════════════════════════════════
    function triggerClimaxEffect(scale = 1) {
        if (!CONFIG.climax) return;
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return;

        // 快照整個 canvas
        let dataURL;
        try { dataURL = canvas.toDataURL(); } catch(e) { return; }
        const rect = canvas.getBoundingClientRect();

        // ── 全螢幕用 window 尺寸（不限 canvas rect）──
        const SW = window.innerWidth;
        const SH = window.innerHeight;

        const overlay = getOverlay();

        // ── Layer 1: 黑幕底層（碎片飛散後顯示，然後慢慢淡出）──
        const blackBg = document.createElement('div');
        Object.assign(blackBg.style, {
            position:      'fixed',
            inset:         '0',
            background:    'black',
            zIndex:        '99989',   // 在碎片(99991)下面，確保碎片飛散後看到黑
            opacity:       '1',
            pointerEvents: 'none',
            transition:    'none',
        });
        document.body.appendChild(blackBg);

        // ── 紅白閃光（全螢幕）──
        const flash = document.createElement('div');
        Object.assign(flash.style, {
            position:      'fixed',
            inset:         '0',
            zIndex:        '99997',
            opacity:       '0',
            pointerEvents: 'none',
            animation:     `ivhClimaxFlash ${Math.round(700 / scale)}ms ease-out forwards`,
        });
        overlay.appendChild(flash);
        setTimeout(() => flash.remove(), 800);

        // ── 不規則多邊形碎片 ──
        // 先把 canvas 畫到一個全螢幕大小的 offscreen canvas
        const master = document.createElement('canvas');
        master.width  = SW;
        master.height = SH;
        const mctx = master.getContext('2d');
        // canvas 可能不是全螢幕，按實際位置繪製
        try {
            mctx.drawImage(canvas, rect.left, rect.top, rect.width, rect.height);
        } catch(e) { return; }

        // 產生 Voronoi 風格的隨機種子點
        const FRAG_COUNT = 48 + Math.round(scale * 10); // 48~60 個碎片（更密集）
        const seeds = Array.from({length: FRAG_COUNT}, () => ({
            x: Math.random() * SW,
            y: Math.random() * SH,
        }));

        // 每個種子建立一個不規則多邊形碎片（簡化：找最近的幾個鄰居拉出凸包近似）
        // 實作：用 clip path SVG polygon，讓每個碎片 canvas 用 clip 裁切
        seeds.forEach((seed, si) => {
            // 用隨機偏移建出一個不規則多邊形（6~9 個頂點）
            const sides  = 6 + Math.floor(Math.random() * 4);
            const radius = 60 + Math.random() * 80 * scale;
            const pts    = [];
            for (let k = 0; k < sides; k++) {
                const angle = (k / sides) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
                const r     = radius * (0.55 + Math.random() * 0.7);
                pts.push({ x: seed.x + r * Math.cos(angle), y: seed.y + r * Math.sin(angle) });
            }

            // 建立 canvas，clip 成多邊形，貼上截圖
            const fc  = document.createElement('canvas');
            fc.width  = SW;
            fc.height = SH;
            const fctx = fc.getContext('2d');
            fctx.beginPath();
            fctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach(p => fctx.lineTo(p.x, p.y));
            fctx.closePath();
            fctx.clip();
            fctx.drawImage(master, 0, 0);

            // 輕微邊緣描邊，增加撕裂感
            fctx.strokeStyle = 'rgba(255,120,160,0.6)';
            fctx.lineWidth   = 1.5;
            fctx.beginPath();
            fctx.moveTo(pts[0].x, pts[0].y);
            pts.slice(1).forEach(p => fctx.lineTo(p.x, p.y));
            fctx.closePath();
            fctx.stroke();

            const dx      = (seed.x - SW / 2) * (0.8 + Math.random() * 1.2) * scale;
            const dy      = (seed.y - SH / 2) * (0.8 + Math.random() * 1.2) * scale;
            const rot     = (Math.random() - 0.5) * 80 * scale;
            const dur     = (800 + Math.random() * 600) * (1 / Math.max(scale, 0.5));
            // 定格停頓：碎片先靜止 550ms（讓玩家看清破碎），再飛散
            // 每個碎片的 delay = 定格時間 + 輕微錯開（各片不完全同時）
            const FREEZE  = 550;
            const scatter = FREEZE + si * 10;

            Object.assign(fc.style, {
                position:        'fixed',
                left:            '0',
                top:             '0',
                width:           `${SW}px`,
                height:          `${SH}px`,
                pointerEvents:   'none',
                zIndex:          '99991',
                transformOrigin: `${seed.x}px ${seed.y}px`,
                // transition 帶入 delay，飛散前靜止
                transition:      `transform ${dur}ms cubic-bezier(0.15,0,0.9,1) ${scatter}ms,
                                  opacity   ${dur * 0.45}ms ease ${scatter + dur * 0.55}ms`,
                willChange:      'transform, opacity',
            });
            document.body.appendChild(fc);

            // 立刻渲染（定格在原位），delay 到時再飛散
            requestAnimationFrame(() => requestAnimationFrame(() => {
                fc.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${0.2 + Math.random() * 0.5})`;
                fc.style.opacity   = '0';
            }));

            setTimeout(() => fc.remove(), scatter + dur + 300);
        });

        // ── 全螢幕震動 ──
        const shakeEl = document.createElement('div');
        Object.assign(shakeEl.style, {
            position:      'fixed',
            inset:         '0',
            pointerEvents: 'none',
            zIndex:        '99999',
            animation:     `ivhClimaxShake ${Math.round(500 / scale)}ms ease-out forwards`,
        });
        overlay.appendChild(shakeEl);
        setTimeout(() => shakeEl.remove(), 600);

        // ── 黑幕淡出（碎片都飛散後，黑幕在 1~1.5 秒內淡出移除）──
        // 等最慢的碎片飛完（FREEZE=550 + scatter最大 si*10 + dur最長約1500）
        const blackFadeDelay = 550 + FRAG_COUNT * 10 + 800;
        const blackFadeDur   = 1200 + Math.random() * 300;
        setTimeout(() => {
            blackBg.style.transition = `opacity ${blackFadeDur}ms ease`;
            blackBg.style.opacity    = '0';
        }, blackFadeDelay);
        setTimeout(() => blackBg.remove(), blackFadeDelay + blackFadeDur + 100);
    }

    // ════════════════════════════════════════
    //  聲音系統
    //  音源系統：預載 GitHub 音源，有快取才播放
    //  載入失敗 → 本地聊天訊息提示（10秒後自動消失）
    //  音源來自 https://www.pincree.jp/
    // ════════════════════════════════════════
    const SOUND_URLS = [
        'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Sound/IVH/pincree_kitakami_tsubasa_groan1.mp3',
        'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Sound/IVH/pincree_kitakami_tsubasa_groan2.mp3',
        'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Sound/IVH/pincree_kitakami_tsubasa_groan3.mp3',
        'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Sound/IVH/pincree_kitakami_tsubasa_groan4.mp3',
    ];

    const _soundBufferCache = new Map(); // url → AudioBuffer
    let _audioCtx = null;

    function _getAudioCtx() {
        if (!_audioCtx || _audioCtx.state === 'closed') {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return _audioCtx;
    }

    // 預載所有音源（進房間後呼叫一次）
    // 失敗時用 printChat 留訊息（10 秒後自動消失）
    function preloadSounds() {
        if (!SOUND_URLS.length) return;
        let _failNotified = false;
        SOUND_URLS.forEach(url => {
            if (_soundBufferCache.has(url)) return;
            const ctx = _getAudioCtx();
            fetch(url)
                .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.arrayBuffer();
            })
                .then(ab => ctx.decodeAudioData(ab))
                .then(buf => {
                _soundBufferCache.set(url, buf);
            })
                .catch(e => {
                // 每次重新進房間只通知一次，避免四個 URL 連續刷訊息
                if (!_failNotified) {
                    _failNotified = true;
                    // 延遲 3 秒，等玩家看完催眠特效再顯示
                    setTimeout(() => {
                        printChat(
                            T('🔇 IVH 音源載入失敗，聲音效果暫時停用', '🔇 IVH sound load failed, audio disabled'),
                            10000  // 10 秒後消失
                        );
                    }, 3000);
                }
            });
        });
    }

    // 播放已快取的音源（隨機挑一個）
    function triggerBreathSound(scale = 1) {
        if (!CONFIG.sound) return;
        const cached = [..._soundBufferCache.values()];
        if (cached.length === 0) return; // 無快取靜默
        try {
            const ctx  = _getAudioCtx();
            const buf  = cached[Math.floor(Math.random() * cached.length)];
            const src  = ctx.createBufferSource();
            src.buffer = buf;
            const gain = ctx.createGain();
            gain.gain.value = Math.min(0.5 + scale * 0.15, 0.9);
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start();
        } catch(e) {
            // 播放失敗靜默
        }
    }

    // ════════════════════════════════════════
    //  8. 表情
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
        // 1. 用 BC 原生函式同步到伺服器（其他人看得到）
        for (const [g, val] of Object.entries(exprObj)) {
            try { CharacterSetFacialExpression(Player, g, val); } catch(e) {}
        }
        // 2. 直接操作 Appearance Property，確保本地 canvas 也立即更新
        for (const [g, val] of Object.entries(exprObj)) {
            try {
                const item = Player.Appearance.find(a => a.Asset.Group.Name === g);
                if (item) {
                    if (!item.Property) item.Property = {};
                    item.Property.Expression = val;
                }
            } catch(e) {}
        }
        // 3. 強制本地重繪
        try { CharacterRefresh(Player, false, false); } catch(e) {}
    }

    // ════════════════════════════════════════
    //  9. 興奮度
    // ════════════════════════════════════════
function addArousal() {
    if (!CONFIG.arousal) return 1;
    try {
        if (!Player.ArousalSettings || Player.ArousalSettings.Active === "Inactive") return 1;

        const current = Player.ArousalSettings.Progress ?? 0;
        
        let add = randInt(1, 5);
        
        // 越接近滿值增加越慢（更自然）
        if (current > 80) add = randInt(1, 3);
        if (current > 92) add = randInt(1, 2);

        const newVal = Math.min(current + add, 100);
        
        ActivitySetArousal(Player, newVal);

        return add;
    } catch (e) {
        console.error("[IVH] addArousal 錯誤:", e);
        return 1;
    }
}

    // ════════════════════════════════════════
    //  主效果流程
    // ════════════════════════════════════════
    async function runEffect(voiceText, isTest = false) {
        // 只在 ChatRoom 畫面內作用（避免在其他畫面觸發）
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen !== 'ChatRoom') {
            return;
        }
        refreshCanvasCache();

        // ① 先存原始表情，立即套用新表情
        //    如果本次會觸發高潮（BC 自帶表情），跳過 IVH 的表情替換
        const orgasmStageNow = Player?.ArousalSettings?.OrgasmStage ?? 0;
        const willOrgasm = orgasmStageNow === 2;
        let savedExpr = null;
        if (CONFIG.expression && !willOrgasm) {
            try { savedExpr = saveExpression(); } catch(e) {}
            const randomExpr = EXPRESSION_SETS[Math.floor(Math.random() * EXPRESSION_SETS.length)];
            try { applyExpression(randomExpr); } catch(e) {}
        }

        const arousalAdd   = addArousal();
        const scale        = effectScale();
        const danmakuCount = Math.max(1, Math.round(arousalAdd * Math.min(scale, 1.5)));
        const totalDur     = BASE_EFFECT_DURATION * Math.min(scale, 1.4);
        const wordCount    = voiceText.trim().split(/\s+/).length;

        // ③ 視覺效果同時觸發
        triggerVignette();
        triggerScreenDistort();
        triggerPinkFlash();
        triggerHypnoSpiral();
        triggerHypnoWaves(wordCount);
        triggerDanmakuMulti(voiceText, danmakuCount);
        triggerSteamParticles();
        if (CONFIG.sound) triggerBreathSound(scale);

        // ④ 高潮特效
        //   climaxMode='orgasm' → BC OrgasmStage=2（真正高潮）時觸發
        //   climaxMode='always' → 每次催眠都觸發
        //   OrgasmStage=0: 正常, =1: 抵抗中, =2: 真正高潮（不抵抗或抵抗失敗）
        const arousalNow   = getArousalLevel();
        const orgasmStage  = Player?.ArousalSettings?.OrgasmStage ?? 0;
        const bcOrgasming  = orgasmStage === 2;
        const doClimax     = CONFIG.climax && (
            CONFIG.climaxMode === 'always' ||
            bcOrgasming ||
            (isTest && arousalNow >= 95)
        );
        if (doClimax) {
            await wait(600);
            triggerClimaxEffect(scale);
        }

        // ⑤ 等效果播完
        await wait(totalDur);

        // ⑥ 恢復表情（特效結束後 1~2 秒，高潮時不恢復）
        if (CONFIG.expression && savedExpr && !willOrgasm) {
            await wait(1200 + Math.random() * 800);
            try { applyExpression(savedExpr); } catch(e) {}
        }
    }

    // ════════════════════════════════════════
    //  解析聊天文字
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
    //  /ivh 指令系統
    // ════════════════════════════════════════
    const HELP_TEXT = isZh() ? `
🌀 IVH v${MOD_VER} 指令列表：
  /ivh show          — 顯示控制面板
  /ivh test [文字]   — 立即觸發效果
  /ivh climax        — 測試高潮特效
  /ivh calibrate     — 頭部座標校正面板
  /ivh on/off        — 全部效果開/關
  /ivh intensity <值>— 強度 0.1~3.0
  /ivh toggle <效果> — 切換單一效果
    pink|spiral|waves|distort|vignette
    danmaku|steam|expr|arousal|climax|sound
  /ivh help          — 顯示此說明
`.trim() : `
🌀 IVH v${MOD_VER} Commands:
  /ivh show          — Show control panel
  /ivh test [text]   — Trigger effect now
  /ivh climax        — Test climax effect
  /ivh calibrate     — Head position calibration
  /ivh on/off        — Enable/disable all effects
  /ivh intensity <v> — Intensity 0.1~3.0
  /ivh toggle <key>  — Toggle single effect
    pink|spiral|waves|distort|vignette
    danmaku|steam|expr|arousal|climax|sound
  /ivh help          — Show this help
`.trim();

    const TOGGLE_MAP = {
        pink:    'pinkFlash',
        spiral:  'hypnoSpiral',
        waves:   'hypnoWaves',
        distort: 'screenDistort',
        vignette:'vignette',
        danmaku: 'danmaku',
        steam:   'steamParticles',
        expr:    'expression',
        arousal: 'arousal',
        climax:  'climax',
        sound:   'sound',
    };

    // climaxMode 單獨切換（不是 boolean，用 toggle 特殊處理）
    function toggleClimaxMode() {
        CONFIG.climaxMode = CONFIG.climaxMode === 'always' ? 'orgasm' : 'always';
        printChat(`💥 [IVH] 高潮特效模式 → ${CONFIG.climaxMode === 'always' ? '每次觸發' : '僅高潮時'}`);
    }

    // timeoutMs: 若 > 0，訊息在 N 毫秒後自動淡出移除
    function printChat(text, timeoutMs = 0) {
        try {
            const log = document.getElementById('TextAreaChatLog');
            if (!log) throw new Error('no log');
            const el = document.createElement('div');
            el.className = 'ChatMessage ChatMessageLocalMessage';
            Object.assign(el.style, {
                background:   'rgba(180,80,160,0.18)',
                borderLeft:   '3px solid #ff80cc',
                padding:      '4px 8px',
                margin:       '2px 0',
                color:        '#ffcce8',
                fontSize:     '0.92em',
                fontFamily:   'inherit',
                whiteSpace:   'pre-wrap',
                transition:   'opacity 0.5s ease',
            });
            el.innerHTML = '<span style="opacity:0.6;font-size:0.85em">🌀 IVH</span>　' + text.split('\n').join('<br>');
            log.appendChild(el);
            log.scrollTop = log.scrollHeight;
            if (timeoutMs > 0) {
                setTimeout(() => {
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 500);
                }, timeoutMs);
            }
            return;
        } catch(e) {}
        try {
            if (typeof ChatRoomMessage === 'function') {
                ChatRoomMessage({
                    Type:    'LocalMessage',
                    Sender:  Player.MemberNumber,
                    Content: `<font color="#ffb3d9">🌀 [IVH] ${text}</font>`,
                });
                return;
            }
        } catch(e2) {}
    }

    function handleIVHCommand(input) {
        const parts = input.trim().split(/\s+/);
        if (parts[0].toLowerCase() !== '/ivh') return false;

        const sub = (parts[1] ?? '').toLowerCase();

        if (!sub || sub === 'help') {
            printChat(HELP_TEXT);
            return true;
        }

        if (sub === 'test') {
            const testText = parts.slice(2).join(' ') || '你的意識正在沉睡…放鬆，放鬆…';
            triggerVoiceEffect(testText, true);
            printChat(`🌀 [IVH] 觸發測試效果：「${testText}」`);
            return true;
        }

        if (sub === 'on') {
            Object.keys(CONFIG).forEach(k => { if (k !== 'intensity') CONFIG[k] = true; });
            printChat('🌀 [IVH] 全部效果已開啟');
            return true;
        }

        if (sub === 'off') {
            Object.keys(CONFIG).forEach(k => { if (k !== 'intensity') CONFIG[k] = false; });
            printChat('🌀 [IVH] 全部效果已關閉');
            return true;
        }

        if (sub === 'intensity') {
            const val = parseFloat(parts[2]);
            if (isNaN(val) || val < 0.1 || val > 3.0) {
                printChat('⚠️ [IVH] intensity 請輸入 0.1~3.0 之間的數值');
            } else {
                CONFIG.intensity = val;
                printChat(`🌀 [IVH] 強度設為 ${val}`);
            }
            return true;
        }

        if (sub === 'toggle') {
            const key = (parts[2] ?? '').toLowerCase();
            const cfgKey = TOGGLE_MAP[key];
            if (!cfgKey) {
                printChat(`⚠️ [IVH] 未知效果「${key}」，可用: ${Object.keys(TOGGLE_MAP).join(', ')}`);
            } else {
                CONFIG[cfgKey] = !CONFIG[cfgKey];
                printChat(`🌀 [IVH] ${key} → ${CONFIG[cfgKey] ? '開啟' : '關閉'}`);
            }
            return true;
        }

        if (sub === 'climax') {
            triggerClimaxEffect(CONFIG.intensity);
            printChat('💥 [IVH] 高潮特效測試觸發');
            return true;
        }

        if (sub === 'calibrate') {
            openCalibratePanel();
            return true;
        }



        if (sub === 'show') {
            const chatContainer = document.getElementById('TextAreaChatLog') ||
                  document.querySelector('.ChatLog');
            if (!chatContainer) { printChat('⚠️ ' + T('找不到聊天框','Chat box not found')); return true; }
            if (_panel) { printChat(T('面板已顯示中','Panel already open')); return true; }
            buildPanel(chatContainer);
            return true;
        }



        printChat(`⚠️ [IVH] 未知指令「${sub}」，輸入 /ivh help 查看說明`);
        return true;
    }

    // ════════════════════════════════════════
    //  Hook 聊天室輸入攔截
    //  策略1: CommandCombine（最佳，與其他插件共存）
    //  策略2: window.ChatRoomSendChat 覆寫（fallback）
    //  策略3: keydown Enter 攔截（最後手段）
    // ════════════════════════════════════════
    function tryRegisterCommand() {
        try {
            if (typeof CommandCombine === 'function') {
                CommandCombine([{
                    Tag: 'ivh',
                    Description: '[IVH] 沉浸式催眠效果指令（/ivh help 查看說明）',
                    Action: (text) => {
                        // CommandCombine 傳入的是去掉 /ivh 後的部分
                        handleIVHCommand('/ivh ' + (text ?? ''));
                    },
                }]);
                return true;
            }
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] CommandCombine 註冊失敗:', e.message);
        }
        return false;
    }

    const _origChatRoomSendChat = window.ChatRoomSendChat;
    function setupSendChatFallback() {
        if (typeof window.ChatRoomSendChat !== 'function') return;
        window.ChatRoomSendChat = function () {
            try {
                const val = ElementValue('InputChat');
                if (typeof val === 'string' && val.trim().startsWith('/ivh')) {
                    handleIVHCommand(val.trim());
                    ElementValue('InputChat', '');
                    return;
                }
            } catch (e) {}
            return _origChatRoomSendChat.apply(this, arguments);
        };
    }

    function setupKeydownFallback() {
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const input = document.getElementById('InputChat') || document.querySelector('textarea[id*="Chat"]');
            if (!input) return;
            const val = input.value.trim();
            if (!val.startsWith('/ivh')) return;
            handleIVHCommand(val);
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
        }, true);
    }

    // 指令只需要註冊一次
    let _cmdRegistered = false;

    function registerCommandOnce() {
        if (_cmdRegistered) return;
        _cmdRegistered = true;

        if (tryRegisterCommand()) return;

        if (typeof window.ChatRoomSendChat === 'function') {
            setupSendChatFallback();
            return;
        }

        setupKeydownFallback();
    }

    // hookChatInput 只負責掛 keydown 保底（不等 CommandCombine）
    // 真正的 CommandCombine 註冊在進房間後的 setupDOMObserver 一起做
    function hookChatInput() {
        setupKeydownFallback();
    }

    // ════════════════════════════════════════
    //  IVH 控制面板
    // ════════════════════════════════════════
    let _panel = null;

    // PANEL_TOGGLES 在 buildPanel 時動態產生，確保語言正確
    function getPanelToggles() {
        return Object.entries(TOGGLE_LABELS).map(([key, fn]) => {
            const [icon, label] = fn();
            return { key, icon, label };
        });
    }

    function buildPanel(chatContainer) {
        if (_panel) return; // 已存在

        _panel = document.createElement('div');
        _panel.id = 'ivh-panel';
        // 面板作為普通 DOM 節點塞進 TextAreaChatLog
        // 行為跟一般聊天訊息完全相同：
        // - 新訊息進來會往上推（正常）
        // - 往上捲看舊訊息時，面板也跟著捲走（不卡底部）
        Object.assign(_panel.style, {
            background: 'linear-gradient(135deg, rgba(30,10,40,0.97) 0%, rgba(50,15,60,0.97) 100%)',
            borderTop:  '1px solid rgba(255,120,200,0.35)',
            padding:    '8px 10px 6px',
            boxShadow:  '0 -4px 20px rgba(180,60,160,0.25)',
            fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
            fontSize:   '12px',
            userSelect: 'none',
            marginTop:  '4px',
            display:    'block',
        });

        // ── 標題列 ──
        const header = document.createElement('div');
        Object.assign(header.style, {
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   '6px',
        });

        const title = document.createElement('span');
        title.innerHTML = '🌀 <b style="color:#ff99dd">IVH</b> <span style="color:#cc88bb;font-size:10px">v' + MOD_VER + '</span>';
        title.style.color = '#ffddee';

        // 全開/全關 + X 關閉按鈕
        const allOnBtn  = _mkBtn(T('全開','All On'),  '#2d6b2d', '#88ff88', () => {
            getPanelToggles().forEach(t => { CONFIG[t.key] = true; });
            _refreshToggles();
        });
        const allOffBtn = _mkBtn(T('全關','All Off'), '#6b2d2d', '#ff9999', () => {
            getPanelToggles().forEach(t => { CONFIG[t.key] = false; });
            _refreshToggles();
        });
        const closeXBtn = document.createElement('button');
        closeXBtn.textContent = '✕';
        Object.assign(closeXBtn.style, {
            background:   'rgba(100,20,40,0.8)',
            border:       '1px solid rgba(255,80,100,0.5)',
            borderRadius: '4px',
            color:        '#ff8899',
            cursor:       'pointer',
            fontSize:     '12px',
            padding:      '1px 6px',
            lineHeight:   '16px',
            fontWeight:   'bold',
        });
        closeXBtn.addEventListener('click', () => removePanel());

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;gap:4px;align-items:center';
        btnGroup.append(allOnBtn, allOffBtn, closeXBtn);
        header.append(title, btnGroup);

        // ── 強度控制列 ──
        const intensityRow = document.createElement('div');
        Object.assign(intensityRow.style, {
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            marginBottom: '6px',
        });
        const intensityLabel = document.createElement('span');
        intensityLabel.textContent = T('強度','Intensity');
        intensityLabel.style.cssText = 'color:#cc88bb;min-width:28px';

        const intensitySlider = document.createElement('input');
        intensitySlider.type  = 'range';
        intensitySlider.min   = '0.3';
        intensitySlider.max   = '3.0';
        intensitySlider.step  = '0.1';
        intensitySlider.value = String(CONFIG.intensity);
        Object.assign(intensitySlider.style, {
            flex:         '1',
            accentColor:  '#ff80cc',
            cursor:       'pointer',
            height:       '4px',
        });

        const intensityVal = document.createElement('span');
        intensityVal.textContent = CONFIG.intensity.toFixed(1);
        intensityVal.style.cssText = 'color:#ffccee;min-width:24px;text-align:right';

        intensitySlider.addEventListener('input', () => {
            CONFIG.intensity = parseFloat(intensitySlider.value);
            intensityVal.textContent = CONFIG.intensity.toFixed(1);
        });
        intensityRow.append(intensityLabel, intensitySlider, intensityVal);

        // ── 開關格子 ──
        const grid = document.createElement('div');
        grid.id = 'ivh-panel-grid';
        Object.assign(grid.style, {
            display:             'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap:                 '4px',
            marginBottom:        '6px',
        });

        getPanelToggles().forEach(({ key, label, icon }) => {
            const btn = document.createElement('button');
            btn.dataset.ivhKey = key;
            _styleToggleBtn(btn, key, icon, label);
            btn.addEventListener('click', () => {
                CONFIG[key] = !CONFIG[key];
                _styleToggleBtn(btn, key, icon, label);
            });
            grid.appendChild(btn);
        });

        // ── 底部操作列 ──
        const actionRow = document.createElement('div');
        Object.assign(actionRow.style, {
            display:    'flex',
            gap:        '5px',
            flexWrap:   'wrap',
            alignItems: 'center',
        });

        // 測試輸入框 + 按鈕
        const testInput = document.createElement('input');
        testInput.type        = 'text';
        testInput.placeholder = T('測試文字…','Test text…');
        Object.assign(testInput.style, {
            flex:        '1',
            minWidth:    '80px',
            background:  'rgba(255,255,255,0.07)',
            border:      '1px solid rgba(255,120,200,0.3)',
            borderRadius:'3px',
            color:       '#ffeeff',
            padding:     '3px 6px',
            fontSize:    '12px',
            outline:     'none',
        });
        // 阻止 Enter 送出聊天
        testInput.addEventListener('keydown', e => e.stopPropagation());

        const testBtn = _mkBtn(T('▶ 測試','▶ Test'), '#5a1f6e', '#ff99dd', () => {
            const txt = testInput.value.trim() || '你的意識正在沉睡…放鬆，放鬆…';
            triggerVoiceEffect(txt, true);
        });

        actionRow.append(testInput, testBtn);

        // ── 內容區 ──
        const collapsible = document.createElement('div');
        collapsible.append(intensityRow, grid, actionRow);
        _panel.append(header, collapsible);
        chatContainer.appendChild(_panel);
        // 捲到底部讓面板可見
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 重新刷新所有 toggle 按鈕外觀（/ivh on/off 後呼叫）
    function _refreshToggles() {
        if (!_panel) return;
        getPanelToggles().forEach(({ key, icon, label }) => {
            const btn = _panel.querySelector(`[data-ivh-key="${key}"]`);
            if (btn) _styleToggleBtn(btn, key, icon, label);
        });
    }

    function _styleToggleBtn(btn, key, icon, label) {
        const on = CONFIG[key];
        btn.textContent = `${icon} ${label}`;
        Object.assign(btn.style, {
            background:   on ? 'rgba(180,60,160,0.45)' : 'rgba(60,20,60,0.5)',
            border:       `1px solid ${on ? 'rgba(255,120,200,0.6)' : 'rgba(120,60,120,0.3)'}`,
            borderRadius: '4px',
            color:        on ? '#ffccee' : '#886688',
            cursor:       'pointer',
            fontSize:     '11px',
            padding:      '4px 2px',
            textAlign:    'center',
            transition:   'all 0.15s ease',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
        });
    }

    function _mkBtn(label, bgColor, textColor, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        Object.assign(btn.style, {
            background:   bgColor,
            border:       '1px solid rgba(255,255,255,0.15)',
            borderRadius: '3px',
            color:        textColor,
            cursor:       'pointer',
            fontSize:     '11px',
            padding:      '3px 7px',
            whiteSpace:   'nowrap',
        });
        btn.addEventListener('click', onClick);
        return btn;
    }

    function removePanel() {
        if (_panel) { _panel.remove(); _panel = null; }
    }
    let _domObserver = null;

    function setupDOMObserver() {
        const chatContainer =
              document.getElementById('TextAreaChatLog') ||
              document.querySelector('.ChatLog')         ||
              document.querySelector('[id*="ChatLog"]')  ||
              document.querySelector('[class*="ChatLog"]');

        if (!chatContainer) {
            setTimeout(setupDOMObserver, 2000);
            return;
        }

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

        // 預載音源
        preloadSounds();

        // 進房間後才註冊指令，確保 CommandCombine 已就緒
        registerCommandOnce();
    }

    // ════════════════════════════════════════
    //  Hook ChatRoomCharacterViewDrawOverlay
    //  參考 LT 的 rpIcon 邏輯：
    //  CharX/CharY/Zoom 已是 BC 計算好的最終座標
    //  包含 HeightRatio/XOffset/YOffset/翻頁偏移，完全正確
    // ════════════════════════════════════════
    function hookDrawCharacter() {
        if (!modApi) return;
        try {
            modApi.hookFunction('ChatRoomCharacterViewDrawOverlay', 1, (args, next) => {
                const result = next(args);
                const [character, charX, charY, zoom] = args;
                // 用 MemberNumber 比對，比 IsPlayer() 更可靠
                const isMe = character?.MemberNumber != null &&
                      Player?.MemberNumber != null &&
                      character.MemberNumber === Player.MemberNumber;
                if (isMe) {
                    // 座標每幀更新
                    playerDrawPos.x     = charX;
                    playerDrawPos.y     = charY;
                    playerDrawPos.zoom  = zoom;
                    playerDrawPos.valid = true;
                    _lastDrawFrame      = Date.now();
                    // 姿勢也每幀更新（不放在座標變化判斷內，避免姿勢變化被漏掉）
                    playerDrawPos.isKneeling = typeof character.IsKneeling === 'function' && character.IsKneeling();
                    playerDrawPos.isProne    = !!(
                        character.ActivePose?.some(p =>
                                                   ['Hogtied','AllFours','Suspension','SuspensionHogtied'].includes(p)
                                                  ) ||
                        Object.values(character.DrawPoseMapping || character.PoseMapping || {}).some(p =>
                                                                                                     ['Hogtied','AllFours','Suspension','SuspensionHogtied'].includes(p)
                                                                                                    )
                    );
                }
                return result;
            });
        } catch (e) {
            console.warn('🐈‍⬛ [IVH] ⚠️ ChatRoomCharacterViewDrawOverlay hook 失敗:', e.message);
        }
    }

    // ════════════════════════════════════════
    //  Hook OrgasmStage：偵測玩家進入 Stage 2（真正高潮）
    //  不依賴 [Voice] 觸發，任何高潮都可以觸發破片特效
    // ════════════════════════════════════════
    let _lastOrgasmStage = 0;
    let _climaxCooldown  = false;  // 防止同一次高潮重複觸發

    function hookOrgasmStage() {
        if (!modApi) return;

        const orgasmHandler = (args, next) => {
            const result = next(args);
            const [C] = args;
            if (C && typeof C.IsPlayer === 'function' && C.IsPlayer()
                && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom') {
                if (CONFIG.climax && !_climaxCooldown) {
                    _climaxCooldown = true;
                    const scale = effectScale();
                    setTimeout(() => {
                        triggerClimaxEffect(scale);
                        triggerPinkFlash();
                    }, 400);
                    setTimeout(() => { _climaxCooldown = false; }, 8000);
                }
            }
            return result;
        };

        // 嘗試多個 BC 版本中可能存在的高潮函數名，靜默嘗試，失敗就用輪詢
        const orgasmFnCandidates = [
            'ActivityOrgasm',
            'ActivityOrgasmStart',
            'ActivityOrgasmPrepare',
        ];
        let orgasmHooked = false;
        for (const fn of orgasmFnCandidates) {
            try {
                modApi.hookFunction(fn, 0, orgasmHandler);
                orgasmHooked = true;
                break;
            } catch { /* 函數不存在，試下一個 */ }
        }
        if (!orgasmHooked) {
            _hookOrgasmPoll();
        }
    }

    // fallback：每 500ms 輪詢 OrgasmStage
    function _hookOrgasmPoll() {
        setInterval(() => {
            if (!CONFIG.climax || _climaxCooldown) return;
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') {
                _lastOrgasmStage = Player?.ArousalSettings?.OrgasmStage ?? 0;
                return;
            }
            const stage = Player?.ArousalSettings?.OrgasmStage ?? 0;
            if (stage >= 2 && _lastOrgasmStage < 2) {
                _climaxCooldown = true;
                const scale = effectScale();
                setTimeout(() => {
                    triggerClimaxEffect(scale);
                    triggerPinkFlash();
                }, 400);
                setTimeout(() => { _climaxCooldown = false; }, 8000);
            }
            _lastOrgasmStage = stage;
        }, 500);
    }

    // ════════════════════════════════════════
    //  CSS
    // ════════════════════════════════════════
    function injectStyles() {
        if (document.getElementById('ivh-styles')) return;
        const style = document.createElement('style');
        style.id = 'ivh-styles';
        style.textContent = `
            @keyframes ivhPinkPulse {
                0%   { opacity: 0; }
                12%  { opacity: 1; }
                65%  { opacity: 0.85; }
                100% { opacity: 0; }
            }
            @keyframes ivhVignette {
                0%   { opacity: 0; }
                15%  { opacity: 1; }
                70%  { opacity: 0.9; }
                100% { opacity: 0; }
            }
            @keyframes ivhSpiralSpin {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
            }
            @keyframes ivhWaveExpand {
                0%   { width: 10px; height: 10px; opacity: 1; }
                80%  { opacity: 0.4; }
                100% { width: 220px; height: 220px; opacity: 0; }
            }
            @keyframes ivhSteamRise0 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.85; }
                50%  { transform: translateY(-55px) translateX(8px) scale(1.2); opacity: 0.5; }
                100% { transform: translateY(-110px) translateX(15px) scale(0.4); opacity: 0; }
            }
            @keyframes ivhSteamRise1 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.8; }
                50%  { transform: translateY(-50px) translateX(-10px) scale(1.3); opacity: 0.45; }
                100% { transform: translateY(-105px) translateX(-18px) scale(0.3); opacity: 0; }
            }
            @keyframes ivhSteamRise2 {
                0%   { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.9; }
                40%  { transform: translateY(-40px) translateX(4px) scale(1.1); opacity: 0.6; }
                100% { transform: translateY(-115px) translateX(-5px) scale(0.35); opacity: 0; }
            }
            @keyframes ivhClimaxFlash {
                0%   { opacity: 0; }
                8%   { opacity: 0.85; background: white; }
                30%  { opacity: 0.5; background: rgba(255,100,150,0.7); }
                60%  { opacity: 0.2; }
                100% { opacity: 0; }
            }
            @keyframes ivhClimaxShake {
                0%   { transform: translate(0,0) rotate(0deg); }
                15%  { transform: translate(-6px, 4px) rotate(-0.8deg); }
                30%  { transform: translate(5px, -4px) rotate(0.6deg); }
                45%  { transform: translate(-4px, 3px) rotate(-0.5deg); }
                60%  { transform: translate(4px, -2px) rotate(0.4deg); }
                75%  { transform: translate(-2px, 2px) rotate(-0.2deg); }
                100% { transform: translate(0,0) rotate(0deg); }
            }
            @keyframes ivhWaveChar {
                0%   { transform: translateY(0px); }
                25%  { transform: translateY(-5px); }
                50%  { transform: translateY(0px); }
                75%  { transform: translateY(3px); }
                100% { transform: translateY(0px); }
            }
        `;
        document.head.appendChild(style);
    }

    // ════════════════════════════════════════
    //  等待工具
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
                    clearBCXCache();
                    setTimeout(setupDOMObserver, 500);
                }
                return result;
            });
            modApi.hookFunction('ChatRoomLeave', 0, (args, next) => {
                const result = next(args);
                if (_domObserver) { _domObserver.disconnect(); _domObserver = null; }
                removePanel();
                clearBCXCache();
                started = false; // 允許下次進房間重建
                return result;
            });
        } else {
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
        console.log(`🐈‍⬛ [IVH] ⌛ 初始化 v${MOD_VER}...`);
        injectStyles();

        const sdkReady  = await waitForBcModSdk();
        const gameReady = await waitForGame();

        if (!gameReady) {
            console.error('🐈‍⬛ [IVH] ❌ 遊戲載入逾時');
            return;
        }

        if (sdkReady) {
            try {
                modApi = bcModSdk.registerMod({
                    name:       'liko - IVH',
                    fullName:   "liko's Immersive Voice Hypnosis",
                    version:    MOD_VER,
                    repository: '沉浸式催眠效果 | Immersive Voice Hypnosis',
                });
            } catch (e) {
                console.warn('🐈‍⬛ [IVH] ⚠️ registerMod 失敗，進入相容模式:', e.message);
            }

            if (modApi) {
                try {
                    modApi.onUnload(() => {
                        if (_domObserver)      { _domObserver.disconnect(); _domObserver = null; }
                        if (_fallbackInterval) { clearInterval(_fallbackInterval); _fallbackInterval = null; }
                        removePanel();
                        const overlay = document.getElementById('ivh-overlay');
                        if (overlay) overlay.remove();
                        const styles = document.getElementById('ivh-styles');
                        if (styles) styles.remove();
                        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
                        if (canvas) { canvas.style.filter = ''; canvas.style.transform = ''; }
                    });
                } catch (e) {
                    // 舊版 bcModSdk 不支援 onUnload，忽略即可
                }
            }
        }

        hookDrawCharacter();
        hookOrgasmStage();
        hookChatInput();       // 只掛 keydown 保底，CommandCombine 在進房間後才註冊
        waitForChatRoom();
        console.log(`🐈‍⬛ [IVH] ✅ 初始化完成 v${MOD_VER}`);

        // 進入房間後顯示載入提示（一次性）
        let _loadedNotified = false;
        const _loadCheck = setInterval(() => {
            if (typeof CurrentScreen === 'undefined' || CurrentScreen !== 'ChatRoom') return;
            clearInterval(_loadCheck);
            if (_loadedNotified) return;
            _loadedNotified = true;
            setTimeout(() => {
                printChat(T(`IVH v${MOD_VER} 已載入 ✅\n/ivh help 說明 | /ivh show 設定面板`, `IVH v${MOD_VER} loaded ✅\n/ivh help | /ivh show for settings`));
            }, 1000);
        }, 500);
    }

    initialize();

})();
