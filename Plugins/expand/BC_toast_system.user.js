// toast-system.js
(function() {
    window.Liko = window.Liko ?? {};
    window.Liko.__SystemAPI__ = window.Liko.__SystemAPI__ ?? {};
    // 統一防重複載入 + 註冊：__SystemAPI__.Toast 與 window.Liko.Toast 指向同一函式（見檔尾登記）
    if (window.Liko.__SystemAPI__.Toast) return;
    const MOD_VER = "1.3";

    let activeMessages = [];

    const BASE_HEIGHT  = 120;
    const MSG_SPACING  = 35;

    function repositionMessages() {
        activeMessages.forEach((msg, i) => {
            if (msg?.style) msg.style.bottom = `${BASE_HEIGHT + i * MSG_SPACING}px`;
        });
    }

    function ChatRoomSendLocalStyled(message, duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "24px") {
        try {
            if (typeof duration === 'object' && duration !== null) {
                ({ duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "20px" } = duration);
            }

            const cfg = { duration, color, x, y, fontSize };

            const msgEl = document.createElement("div");
            msgEl.classList.add("liko-toast");
            msgEl.textContent = message;

            const translateX = cfg.x !== null ? '0' : '-50%';

            Object.assign(msgEl.style, {
                position:     'fixed',
                background:   'rgba(0,0,0,0.7)',
                color:        cfg.color,
                padding:      '8px 15px',
                borderRadius: '10px',
                fontSize:     typeof cfg.fontSize === 'number' ? cfg.fontSize + 'px' : cfg.fontSize,
                fontWeight:   'bold',
                opacity:      '0',
                transition:   'opacity 0.5s, transform 0.5s',
                zIndex:       '9999',
                left:         cfg.x !== null ? cfg.x + 'px' : '50%',
                bottom:       cfg.y !== null ? cfg.y + 'px' : `${BASE_HEIGHT + activeMessages.length * MSG_SPACING}px`,
                transform:    `translateX(${translateX}) translateY(0px)`,
                pointerEvents: 'none',
                userSelect:   'none',
                webkitUserSelect: 'none',
            });

            document.body.appendChild(msgEl);
            activeMessages.push(msgEl);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    msgEl.style.opacity   = '1';
                    msgEl.style.transform = `translateX(${translateX}) translateY(-20px)`;
                });
            });

            setTimeout(() => {
                msgEl.style.opacity   = '0';
                msgEl.style.transform = `translateX(${translateX}) translateY(-40px)`;
                setTimeout(() => {
                    msgEl?.parentNode?.removeChild(msgEl);
                    activeMessages = activeMessages.filter(m => m !== msgEl);
                    if (cfg.y === null) repositionMessages();
                }, 500);
            }, cfg.duration);

        } catch (e) {
            console.error("🐈‍⬛ [GlobalToast] ❌", e);
        }
    }

    ChatRoomSendLocalStyled._version  = MOD_VER;
    ChatRoomSendLocalStyled._loadTime = Date.now();

    window.Liko.Toast              = ChatRoomSendLocalStyled;   // 暴露 API 供其他插件調用
    window.ChatRoomSendLocalStyled = ChatRoomSendLocalStyled;   // 相容全域別名（有實際調用端）
    window.Liko.__SystemAPI__.Toast = ChatRoomSendLocalStyled;  // 統一登記（同一參考）
    console.log(`🐈‍⬛ [BC toast] ✅ v${MOD_VER} loaded`);
})();
