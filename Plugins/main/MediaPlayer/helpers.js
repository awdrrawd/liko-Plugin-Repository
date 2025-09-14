/**
 * BC Enhanced Media - Helpers Module
 * 基礎工具函數模組
 */

window.BCEnhancedMedia = window.BCEnhancedMedia || {};
window.BCEnhancedMedia.Helpers = (function() {
    'use strict';

    // 生成GUID
    function generateGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 字符串trim處理
    function trim(string) {
        if (string && string.trim) {
            return string.trim();
        } else if (string) {
            let reg = /^\s+|\s+$/g;
            return string.replace(reg, "");
        }
        return "";
    }

    // 動態載入腳本
    function loadScript(url) {
        return new Promise(function(resolve, reject) {
            // 檢查是否已載入
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                resolve();
                return;
            }

            const scriptElement = document.createElement('script');
            scriptElement.src = url;
            scriptElement.onload = resolve;
            scriptElement.onerror = reject;
            document.head.appendChild(scriptElement);
        });
    }

    // 顏色插值計算
    function interpolateColor(color1, color2, percent) {
        if (!color1 || !color2) return color1 || '#ffffff';
        
        // 轉換hex顏色為RGB值
        const r1 = parseInt(color1.substring(1, 3), 16);
        const g1 = parseInt(color1.substring(3, 5), 16);
        const b1 = parseInt(color1.substring(5, 7), 16);

        const r2 = parseInt(color2.substring(1, 3), 16);
        const g2 = parseInt(color2.substring(3, 5), 16);
        const b2 = parseInt(color2.substring(5, 7), 16);

        // 插值計算RGB值
        const r = Math.round(r1 + (r2 - r1) * percent);
        const g = Math.round(g1 + (g2 - g1) * percent);
        const b = Math.round(b1 + (b2 - b1) * percent);

        // 轉回hex顏色
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // 獲取透明顏色
    function getTransparentColor(color, alpha = 0.1) {
        if (!color) return `rgba(128,128,128,${alpha})`;
        const R = color.substring(1, 3);
        const G = color.substring(3, 5);
        const B = color.substring(5, 7);
        return `rgba(${parseInt(R, 16)}, ${parseInt(G, 16)}, ${parseInt(B, 16)}, ${alpha})`;
    }

    // 獲取玩家名稱
    function getPlayerName(player) {
        if (!player) return "Unknown";
        return player.Nickname && player.Nickname !== '' ? player.Nickname : player.Name || "Unknown";
    }

    // 獲取玩家默認顏色
    function getPlayerDefaultColor(player) {
        if (!player || !player.LabelColor) return '#ffffff';
        return interpolateColor('#ffffff', player.LabelColor, 0.3);
    }

    // 檢查滑鼠位置
    function mouseIn(x, y, width, height) {
        return MouseX >= x && MouseX <= x + width && MouseY >= y && MouseY <= y + height;
    }

    // 顯示本地聊天訊息
    function showLocalChatMsg(text) {
        const div = document.createElement("div");
        div.setAttribute('style', 'background-color:' + getTransparentColor("#0000FF") + ';');
        div.setAttribute('class', 'ChatMessage ChatMessageAction');
        div.setAttribute('data-time', ChatRoomCurrentTime());
        div.innerHTML = "(" + text + ")";
        ChatRoomAppendChat(div);
    }

    // 防止文字選取樣式
    function preventTextSelection(element) {
        if (!element) return;
        
        const style = element.style;
        style.userSelect = 'none';
        style.webkitUserSelect = 'none';
        style.mozUserSelect = 'none';
        style.msUserSelect = 'none';
        
        // 添加CSS類
        if (!document.getElementById('bc-media-no-select-style')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'bc-media-no-select-style';
            styleElement.textContent = `
                .bc-media-no-select {
                    -webkit-user-select: none !important;
                    -moz-user-select: none !important;
                    -ms-user-select: none !important;
                    user-select: none !important;
                }
            `;
            document.head.appendChild(styleElement);
        }
        
        element.classList.add('bc-media-no-select');
    }

    // 深度克隆對象
    function deepClone(obj) {
        if (obj === null || typeof obj !== "object") return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => deepClone(item));
        if (typeof obj === "object") {
            const cloned = {};
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = deepClone(obj[key]);
                }
            }
            return cloned;
        }
    }

    // 獲取支援的媒體格式
    function getSupportedFormats() {
        return {
            video: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'm3u8'],
            audio: ['mp3', 'aac', 'ogg', 'flac', 'm4a', 'wav'],
            playlist: ['m3u', 'm3u8'],
            streaming: ['hls', 'dash']
        };
    }

    // 檢查是否為移動設備
    function isMobile() {
        return CommonIsMobile || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // 獲取文件擴展名
    function getFileExtension(url) {
        if (!url) return '';
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const extension = pathname.split('.').pop().toLowerCase();
            return extension || '';
        } catch (e) {
            return '';
        }
    }

    // 格式化時間（秒轉為 mm:ss 格式）
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 節流函數
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 防抖函數
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, wait);
        };
    }

    // 公開API
    return {
        generateGUID,
        trim,
        loadScript,
        interpolateColor,
        getTransparentColor,
        getPlayerName,
        getPlayerDefaultColor,
        mouseIn,
        showLocalChatMsg,
        preventTextSelection,
        deepClone,
        getSupportedFormats,
        isMobile,
        getFileExtension,
        formatTime,
        throttle,
        debounce
    };

})();
