// ==UserScript==
// @name         BC - Cash Flow Management
// @name:zh      BC活動金流管理
// @namespace    https://likolisu.dev/
// @version      1.0
// @description  BC活動資金管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function() {
    // Register mod with bcModSdk
    let modApi;
    (function () {
        try {
            if (typeof bcModSdk === "object" && typeof bcModSdk.registerMod === "function") {
                modApi = bcModSdk.registerMod({
                    name: 'CMF',
                    fullName: 'BC - Cash Flow Management',
                    version: '1.0',
                    repository: 'BC活動資金管理 // Cash Flow Management'
                });
                console.log("Liko's Money Manager registered with bcModSdk");
            }
        } catch (e) {
            console.log("Failed to register with bcModSdk:", e.message);
        }
    })();

    // === Configuration ===
    const GOOGLE_SHEET_SCRIPT_URL = 'https://...'; //API 讀寫資料的接口 cloudflare Worker等網站
    const GOOGLE_SHEET_URL = 'https://...'; //Google 試算表（Spreadsheet）
    const BUTTON_X = 955;
    const BUTTON_Y = 80;
    const BUTTON_SIZE = 45;
    let isEnabled = false;
    let hookBound = false;

    // === Command Keywords ===
    const COMMANDS = {
        EVENT: ["活動", "活动", "獎勵", "奖励", "event", "bounties"],
        RECLAIM: ["回收", "罰款","罚款", "reclaim", "fine"],
        PAY: ["支付", "pay"],
        BALANCE: ["查錢", "查钱", "查帳", "查帐", "balance", "audit"],
        CFM: ["CFM","cfm"],
        EVENTDM: ["活動海報","活动海报","eventdm","EVENTDM"]
    };

    // === Normalize Message ===
    function normalizeMessage(msg) {
        return msg
            .toLowerCase()
            .trim();
    }

    // === Send System Message ===
    function sendSystemMessage(message) {
        const systemMessage = message;
        ServerSend("ChatRoomChat", {
            Type: "Action",
            Content: "CUSTOM_SYSTEM_ACTION",
            Dictionary: [
                { Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: systemMessage }
            ]
        });
    }

    // === Retry Fetch ===
    async function fetchWithRetry(url, options, retries = 3, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, options);
                if (response.ok) return response;
                throw new Error(`HTTP error! Status: ${response.status}`);
            } catch (e) {
                if (i < retries - 1) {
                    console.log(`Retrying (${i + 1}/${retries}) after ${delay}ms: ${e.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw e;
                }
            }
        }
    }

    // === Fetch Balance from Google Sheets ===
    async function fetchBalance(memberId) {
        console.log(`Fetching balance for ID: ${memberId}`);
        try {
            const response = await fetchWithRetry(`${GOOGLE_SHEET_SCRIPT_URL}?action=getBalance&id=${memberId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            console.log(`fetchBalance response status: ${response.status}`);
            const data = await response.json();
            console.log(`fetchBalance response data: ${JSON.stringify(data)}`);
            if (data.error) {
                throw new Error(`Server error: ${data.error}`);
            }
            return data.balance || 0;
        } catch (e) {
            console.error("錯誤：無法獲取餘額", e.message);
            sendSystemMessage(`無法獲取餘額（ID: ${memberId}）：${e.message}`);
            return 0;
        }
    }

    // === Record Transaction to Google Sheets ===
    async function recordTransaction(senderId, senderName, targetId, targetName, amount, action, remark) {
        console.log(`Recording transaction: ${JSON.stringify({ senderId, senderName, targetId, targetName, amount, action, remark })}`);
        try {
            const data = {
                action: 'recordTransaction',
                senderId: String(senderId),
                senderName,
                targetId: targetId ? String(targetId) : '',
                targetName: targetName || '',
                amount,
                behavior: action,
                remark: remark || '',
                timestamp: new Date().toISOString()
            };
            const response = await fetchWithRetry(GOOGLE_SHEET_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log(`recordTransaction response status: ${response.status}`);
            const result = await response.json();
            console.log(`recordTransaction response data: ${JSON.stringify(result)}`);
            if (!result.success) {
                throw new Error('Transaction failed on server');
            }
            return result;
        } catch (e) {
            console.error("錯誤：無法記錄交易", e.message);
            sendSystemMessage(`無法記錄交易：${e.message}`);
            return { success: false };
        }
    }

    // === Get Player Name (Nickname > Name) ===
    function getPlayerName(character) {
        return character.Nickname || character.Name || `ID ${character.MemberNumber}`;
    }

    // === Find Player in ChatRoom ===
    function findPlayer(identifier) {
        if (/^\d+$/.test(identifier)) {
            const character = ChatRoomCharacter.find(c => String(c.MemberNumber) === identifier);
            return character ? { id: character.MemberNumber, name: getPlayerName(character) } : null;
        }
        const character = ChatRoomCharacter.find(c =>
            (c.Nickname && c.Nickname.toLowerCase() === identifier.toLowerCase()) ||
            c.Name.toLowerCase() === identifier.toLowerCase()
        );
        return character ? { id: character.MemberNumber, name: getPlayerName(character) } : null;
    }

    // === Handle Event (System pays player) ===
    async function handleEvent(sender, targetId, targetName, amount, remark) {
        const senderName = getPlayerName(sender);
        if (sender.MemberNumber !== Player.MemberNumber) {
            sendSystemMessage(`僅活動人員可執行活動命令`);
            return;
        }
        const target = ChatRoomCharacter.find(c => c.MemberNumber === targetId);
        if (!target) {
            sendSystemMessage(`玩家 ${targetName} 不在房間內`);
            return;
        }
        const finalRemark = remark;
        await recordTransaction(sender.MemberNumber, senderName, targetId, targetName, amount, "活動", finalRemark);
        sendSystemMessage(`[${finalRemark}] ${senderName}給予${targetName}(${targetId}) ${amount}元`);
    }

    // === Handle Reclaim (Player pays system, capped at balance) ===
    async function handleReclaim(sender, targetId, targetName, amount, remark) {
        const senderName = getPlayerName(sender);
        if (sender.MemberNumber !== Player.MemberNumber) {
            sendSystemMessage(`僅活動人員可執行回收命令`);
            return;
        }
        const target = ChatRoomCharacter.find(c => c.MemberNumber === targetId);
        if (!target) {
            sendSystemMessage(`玩家 ${targetName} 不在房間內`);
            return;
        }
        const balance = await fetchBalance(targetId);
        if (balance <= 0) {
            sendSystemMessage(`${targetName} 無餘額可回收`);
            return;
        }
        const actualAmount = Math.min(amount, balance);
        if (actualAmount === 0) {
            sendSystemMessage(`${targetName} 無餘額可回收`);
            return;
        }
        const finalRemark = remark;
        await recordTransaction(sender.MemberNumber, senderName, targetId, targetName, -actualAmount, "回收", finalRemark);
        sendSystemMessage(`[${finalRemark}] ${senderName}回收${targetName}(${targetId}) ${actualAmount}元`);
    }

    // === Handle Payment (Anyone to plugin owner, check sender balance) ===
    async function handlePayment(sender, targetId, targetName, amount, remark) {
        const senderName = getPlayerName(sender);
        if (targetId !== Player.MemberNumber) {
            sendSystemMessage(`支付對象必須是工作人員`);
            return;
        }
        const balance = await fetchBalance(sender.MemberNumber);
        if (balance < amount) {
            sendSystemMessage(`${senderName}(${sender.MemberNumber})餘額不足，無法支付${amount}元`);
            return;
        }
        const finalRemark = remark;
        await recordTransaction(sender.MemberNumber, senderName, sender.MemberNumber, senderName, -amount, "支付", finalRemark);
        sendSystemMessage(`[${finalRemark}] ${senderName}(${sender.MemberNumber})支付${targetName} ${amount} 元`);
    }

    // === Handle Balance Check ===
    async function handleBalance(sender, targetId, targetName) {
        const balance = await fetchBalance(targetId);
        sendSystemMessage(`${targetName}(${targetId})持有${balance}元`);
    }

    // === Handle EVENTDM Command ===
    function handleEVENTDM() {
        const manual = [
            "=== 賭 上 拍 賣 會 ===",
            "主办人：竹",
            "協办人：liko yumi",
            "活动简介：满足DOM和SUB的拍卖会，尊重DOM和SUB的各种",
            "情况也可仔细关注参与拍卖会的小奴的心理状况，还为各位不熟练或不喜欢参与偷窃的小奴提供了观众室，可以观赏拍卖会全程，包括且不限于：拍卖现场、公开演出、私房任务、互动培训等内容。",
            "活动宗旨：尊重、包容、互爱、满足",
            "活动时间：9.12-9.14；每晚20:30-23:30",
            "详情请加QQ好友：3204824761",
            "DM1 - https://ibb.co/XrTz1p0K",
            "DM2 - https://ibb.co/5WkMrvVT",
            "DM3 - https://ibb.co/B574FmMq"
        ].join("\n");
        sendSystemMessage(manual);
    }

    // === Handle CFM Command ===
    function handleCFM() {
        const manual = [
            "=== BC - Cash Flow Management 說明書 ===",
            "此为BC活动的金流管理设置，只提供给活动方使用",
            "命令说明：",
            "- 活动海报：显示当前活动的信息",
            "- 活动/奖励 [ID/昵称/名称] [金额] [备注]：工作人员给予玩家资金（玩家需在房间内）",
            "- 回收/罚款 [ID/昵称/名称] [金额] [备注]：从玩家回收资金",
            "- 支付 [ID/昵称/名称] [金额] [备注]：支付款项给工作人员（需检查余额）",
            "- 查钱/查帐 [ID/昵称/名称]：查询玩家余额（无参数查自己）",
            "- 總帳 https://reurl.cc/A3Xrr3"
        ].join("\n");
        sendSystemMessage(manual);
    }

    // === ChatRoom Load Hook ===
    modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
        const result = next(args);
        if (!hookBound) {
            hookBound = true;
            ServerSocket.on("ChatRoomMessage", async data => {
                if (!isEnabled) return;
                if ((data.Type !== "Chat" && data.Type !== "Emote") || typeof data.Content !== "string") return;

                const rawMsg = data.Content.trim();
                const msg = normalizeMessage(rawMsg);
                const sender = ChatRoomCharacter.find(c => c.MemberNumber === data.Sender);
                if (!sender) return;

                // Parse command
                let command = null;
                let keyword = "";
                for (const [key, words] of Object.entries(COMMANDS)) {
                    for (const word of words) {
                        // 要求命令後有空格或結束，且後續有參數（避免誤觸發日常對話）
                        const regex = new RegExp(`^${word}(\\s+|$)`);
                        if (regex.test(msg)) {
                            command = key.toLowerCase();
                            keyword = msg.slice(word.length).trim();
                            break;
                        }
                    }
                    if (command) break;
                }
                if (!command) return;

                // Log for debugging
                console.log(`Received message: ${msg}, Command: ${command}, Keyword: ${keyword}`);

                // Handle CFM command
                if (command === "cfm") {
                    handleCFM();
                    return;
                } else if (command === "eventdm") {
                // Handle EVENTDM command
                    handleEVENTDM();
                    return;
                }

                // Parse target, amount, and remark
                const parts = keyword.split(/\s+/);
                let targetId = null;
                let targetName = "";
                let amount = 0;
                let remark = "";

                if (command === "balance") {
                    if (parts.length < 1 || !keyword) {
                        targetId = sender.MemberNumber;
                        targetName = getPlayerName(sender);
                    } else {
                        const player = findPlayer(parts[0]);
                        if (!player) {
                            sendSystemMessage(`玩家 ${parts[0]} 不在房間內`);
                            return;
                        }
                        targetId = player.id;
                        targetName = player.name;
                    }
                    await handleBalance(sender, targetId, targetName);
                    return;
                }

                if (parts.length < 2) {
                    sendSystemMessage(`命令格式錯誤：需要玩家和金額`);
                    return;
                }
                const player = findPlayer(parts[0]);
                if (!player) {
                    sendSystemMessage(`玩家 ${parts[0]} 不在房間內`);
                    return;
                }
                targetId = player.id;
                targetName = player.name;
                amount = parseInt(parts[1]);
                remark = parts.slice(2).join(" ") || "";
                if (isNaN(amount) || amount <= 0) {
                    sendSystemMessage(`無效的金額：${parts[1]}`);
                    return;
                }

                // Execute command
                if (command === "event") {
                    await handleEvent(sender, targetId, targetName, amount, remark);
                } else if (command === "reclaim") {
                    await handleReclaim(sender, targetId, targetName, amount, remark);
                } else if (command === "pay") {
                    await handlePayment(sender, targetId, targetName, amount, remark);
                }
            });
        }
        return result;
    });

    // === Draw Button ===
    modApi.hookFunction("ChatRoomMenuDraw", 4, (args, next) => {
        DrawButton(
            BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE,
            isEnabled ? "💰" : "💵",
            isEnabled ? "Green" : "Gray", "", "活動金流管理"
        );
        next(args);
    });

    // === Handle Button Click ===
    modApi.hookFunction("ChatRoomClick", 4, (args, next) => {
        if (MouseIn(BUTTON_X, BUTTON_Y, BUTTON_SIZE, BUTTON_SIZE)) {
            isEnabled = !isEnabled;
            sendSystemMessage(isEnabled ? "活動金流管理女僕 值班" : "活動金流管理女僕 下班");
            return;
        }
        next(args);
    });

    // 標記插件存在
    window.LikoMoneyManager = true;
})();
