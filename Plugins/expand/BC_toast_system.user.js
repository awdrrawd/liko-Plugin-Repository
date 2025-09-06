// toast-system.js
// 版本: 1.0
// 用法: ChatRoomSendLocalStyled(message, duration, color, x, y, fontSize)
//      或: ChatRoomSendLocalStyled(message, { duration, color, x, y, fontSize })

(function() {
    // 避免重複載入
    if (window.ChatRoomSendLocalStyled) {
        console.log("[GlobalToast] 系統已存在，版本:", window.ChatRoomSendLocalStyled._version || "未知");
        return;
    }

    console.log("[GlobalToast] 初始化全域訊息系統 v1.0");
    
    let activeMessages = [];
    let lastPromptTime = 0;
    
    function repositionMessages() {
        activeMessages.forEach((msg, index) => {
            if (msg && msg.style) {
                msg.style.bottom = `${20 + index * 35}px`;
            }
        });
    }
    
    window.ChatRoomSendLocalStyled = function (message, duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "20px") {
        try {
            if (typeof duration === 'object' && duration !== null) {
                const options = duration;
                const config = {
                    duration: 3000,
                    color: "#ff69b4",
                    x: null,
                    y: null,
                    fontSize: "20px",
                    ...options
                };
                duration = config.duration;
                color = config.color;
                x = config.x;
                y = config.y;
                fontSize = config.fontSize;
            }
            
            const config = { duration, color, x, y, fontSize };
            const now = Date.now();
            // if (now - lastPromptTime < 200) return; // 避免洗屏
            lastPromptTime = now;
            
            const msgEl = document.createElement("div");
            msgEl.classList.add("liko-toast");
            msgEl.textContent = message;
            msgEl.style.position = "fixed";
            msgEl.style.background = "rgba(0,0,0,0.7)";
            msgEl.style.color = config.color;
            msgEl.style.padding = "8px 15px";
            msgEl.style.borderRadius = "10px";
            msgEl.style.fontSize = typeof config.fontSize === "number" ? config.fontSize + "px" : config.fontSize;
            msgEl.style.fontWeight = "bold";
            msgEl.style.opacity = "0";
            msgEl.style.transition = "opacity 0.5s, transform 0.5s";
            msgEl.style.zIndex = 9999;
            
            if (config.x !== null) {
                msgEl.style.left = config.x + "px";
                msgEl.style.transform = "translateX(0)";
            } else {
                msgEl.style.left = "50%";
                msgEl.style.transform = "translateX(-50%)";
            }
            
            if (config.y !== null) {
                msgEl.style.bottom = config.y + "px";
            } else {
                msgEl.style.bottom = `${20 + activeMessages.length * 35}px`;
            }
            
            document.body.appendChild(msgEl);
            activeMessages.push(msgEl);
            
            requestAnimationFrame(() => {
                msgEl.style.opacity = "1";
                msgEl.style.transform += " translateY(-20px)";
            });
            
            setTimeout(() => {
                msgEl.style.opacity = "0";
                msgEl.style.transform += " translateY(-40px)";
                setTimeout(() => {
                    if (msgEl && msgEl.parentNode) {
                        msgEl.remove();
                    }
                    activeMessages = activeMessages.filter(m => m !== msgEl);
                    if (config.y === null) repositionMessages();
                }, 500);
            }, config.duration);
            
        } catch (error) {
            console.error("[GlobalToast] 錯誤:", error);
        }
    };
    
    // 添加版本標記
    window.ChatRoomSendLocalStyled._version = "1.0";
    window.ChatRoomSendLocalStyled._loadTime = Date.now();
    
    console.log("[GlobalToast] 載入完成，版本 1.0");
})();
