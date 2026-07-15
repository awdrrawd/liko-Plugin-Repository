// ==UserScript==
// @name         Liko - CRA
// @name:zh      聊天室輔助工具
// @namespace    https://likolisu.dev/
// @version      1.0.2
// @description  替他人改姿勢、輸入歷史、BIO時區頭頂時間、@動作自帶名字、指令/房間轉按鈕 | Chat room assistant
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @grant        none
// @icon         https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Images/PCM_ICON.png
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// @run-at       document-end
// @downloadURL  https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CRA.main.user.js
// @updateURL    https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/main/Liko%20-%20CRA.main.user.js
// ==/UserScript==

(function () {
    "use strict";

    window.Liko = window.Liko ?? {};
    if (window.Liko.CRA) return;
    const MOD_VER = "1.0.2";
    window.Liko.CRA = MOD_VER;

    const LOG = "🐈‍⬛ [CRA]";

    // ================================
    // 語言
    // ================================
    const Lang = {
        _lang: null,
        get: function () {
            if (this._lang) return this._lang;
            // TW/CN 共用 zh；UA(BC) 與 uk(瀏覽器) 皆對應 ua
            const norm = (l) => {
                if (!l) return null;
                l = l.toLowerCase();
                if (l === 'tw' || l === 'cn' || l.startsWith('zh')) return 'zh';
                if (l.startsWith('de')) return 'de';
                if (l.startsWith('fr')) return 'fr';
                if (l.startsWith('ru')) return 'ru';
                if (l === 'ua' || l.startsWith('uk')) return 'ua';
                if (l.startsWith('en')) return 'en';
                return null;
            };
            try {
                if (typeof TranslationLanguage !== 'undefined') {
                    const m = norm(TranslationLanguage);
                    if (m) return this._lang = m;
                    if (TranslationLanguage) return this._lang = 'en';
                }
            } catch (e) {}
            try {
                const m = norm(navigator.language || navigator.userLanguage || '');
                if (m) return this._lang = m;
            } catch (e) {}
            return this._lang = 'en';
        },
        reset: function () { this._lang = null; },
        t: function (key) {
            const dict = STRINGS[this.get()] || STRINGS.en;
            return dict[key] || STRINGS.en[key] || key;
        }
    };

    const STRINGS = {
        zh: {
            poseLabel: "姿勢",
            poseToggleOn: "姿勢選單：展開中（再按收起）",
            poseToggleOff: "姿勢選單：點我展開",
            poseAction: "{src} 將 {tgt} 擺成「{pose}」的姿勢。",
            descPasteCmd: "點擊後把指令貼到輸入框 / Click to paste command",
            descJoinRoom: "點擊後加入房間：{room} / Click to join room",
            welcome: [
                "<b>🐈‍⬛ Liko 聊天室工具箱 v" + MOD_VER + "</b>",
                "・點選他人 → 左上『姿勢』鈕，用圖示替對方換姿勢",
                "・聊天框 ↑/↓ 叫回先前送出的訊息（含 @ 訊息）",
                "・對方 BIO 寫有 GMT/UTC±N 時，頭頂顯示其當地時間",
                "・訊息以 @ 開頭＝動作並自帶你的名字；@@＝不帶名字",
                "・聊天中的 /指令(粉)與 #房間#(藍) 會變成可點按鈕"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "放鬆手臂" },
                { name: "Yoked", display: "高舉雙手" },
                { name: "OverTheHead", display: "雙手過頭" },
                { name: "BackBoxTie", display: "反綁雙手" },
                { name: "BackElbowTouch", display: "肘部相觸" },
                { name: "BackCuffs", display: "背後扣手" },
                { name: "BaseLower", display: "站立" },
                { name: "LegsClosed", display: "併腿站立" },
                { name: "Kneel", display: "跪下" },
                { name: "KneelingSpread", display: "跪姿分腿" },
                { name: "AllFours", display: "趴跪" }
            ]
        },
        en: {
            poseLabel: "Pose",
            poseToggleOn: "Pose menu: open (click to close)",
            poseToggleOff: "Pose menu: click to open",
            poseAction: "{src} arranges {tgt} into the {pose} pose.",
            descPasteCmd: "Click to paste command into the chat input",
            descJoinRoom: "Click to join room: {room}",
            welcome: [
                "<b>🐈‍⬛ Liko ChatRoom Toolkit v" + MOD_VER + "</b>",
                "・Click someone → top-left 'Pose' button to repose them with icons",
                "・Chat box Up/Down recalls your sent messages (incl. @ ones)",
                "・If their BIO has GMT/UTC±N, their local time shows above their head",
                "・Message starting with @ = action with your name; @@ = without name",
                "・/commands (pink) and #rooms# (blue) in chat become clickable buttons"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "Arms Relaxed" },
                { name: "Yoked", display: "Hands Raised" },
                { name: "OverTheHead", display: "Hands Over Head" },
                { name: "BackBoxTie", display: "Box Tie" },
                { name: "BackElbowTouch", display: "Elbow Touch" },
                { name: "BackCuffs", display: "Back Cuffs" },
                { name: "BaseLower", display: "Standing" },
                { name: "LegsClosed", display: "Legs Closed" },
                { name: "Kneel", display: "Kneeling" },
                { name: "KneelingSpread", display: "Kneeling Spread" },
                { name: "AllFours", display: "All Fours" }
            ]
        },
        de: {
            poseLabel: "Pose",
            poseToggleOn: "Posen-Menü: offen (zum Schließen klicken)",
            poseToggleOff: "Posen-Menü: zum Öffnen klicken",
            poseAction: "{src} bringt {tgt} in die Pose „{pose}“.",
            descPasteCmd: "Klicken, um den Befehl in die Eingabe einzufügen",
            descJoinRoom: "Klicken, um dem Raum beizutreten: {room}",
            welcome: [
                "<b>🐈‍⬛ Liko ChatRoom Toolkit v" + MOD_VER + "</b>",
                "・Auf jemanden klicken → oben links „Pose“-Knopf, um ihn per Symbol umzustellen",
                "・Eingabefeld ↑/↓ ruft gesendete Nachrichten ab (auch @-Nachrichten)",
                "・Steht im BIO GMT/UTC±N, wird die Ortszeit über dem Kopf angezeigt",
                "・Nachricht mit @ = Aktion mit deinem Namen; @@ = ohne Namen",
                "・/Befehle (rosa) und #Räume# (blau) im Chat werden zu Klick-Buttons"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "Arme entspannt" },
                { name: "Yoked", display: "Hände gehoben" },
                { name: "OverTheHead", display: "Hände über dem Kopf" },
                { name: "BackBoxTie", display: "Hinter dem Rücken" },
                { name: "BackElbowTouch", display: "Ellbogen berühren" },
                { name: "BackCuffs", display: "Hinter gefesselt" },
                { name: "BaseLower", display: "Stehen" },
                { name: "LegsClosed", display: "Beine geschlossen" },
                { name: "Kneel", display: "Knien" },
                { name: "KneelingSpread", display: "Kniend gespreizt" },
                { name: "AllFours", display: "Auf allen Vieren" }
            ]
        },
        fr: {
            poseLabel: "Pose",
            poseToggleOn: "Menu des poses : ouvert (cliquer pour fermer)",
            poseToggleOff: "Menu des poses : cliquer pour ouvrir",
            poseAction: "{src} place {tgt} dans la pose « {pose} ».",
            descPasteCmd: "Cliquer pour coller la commande dans la saisie",
            descJoinRoom: "Cliquer pour rejoindre le salon : {room}",
            welcome: [
                "<b>🐈‍⬛ Liko ChatRoom Toolkit v" + MOD_VER + "</b>",
                "・Cliquez sur quelqu'un → bouton « Pose » en haut à gauche pour le repositionner avec des icônes",
                "・Champ de saisie ↑/↓ rappelle vos messages envoyés (y compris @)",
                "・Si son BIO contient GMT/UTC±N, son heure locale s'affiche au-dessus de sa tête",
                "・Message commençant par @ = action avec votre nom ; @@ = sans nom",
                "・Les /commandes (rose) et #salons# (bleu) dans le chat deviennent cliquables"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "Bras détendus" },
                { name: "Yoked", display: "Mains levées" },
                { name: "OverTheHead", display: "Mains au-dessus de la tête" },
                { name: "BackBoxTie", display: "Mains dans le dos" },
                { name: "BackElbowTouch", display: "Coudes joints" },
                { name: "BackCuffs", display: "Menottes dans le dos" },
                { name: "BaseLower", display: "Debout" },
                { name: "LegsClosed", display: "Jambes fermées" },
                { name: "Kneel", display: "À genoux" },
                { name: "KneelingSpread", display: "À genoux écartée" },
                { name: "AllFours", display: "À quatre pattes" }
            ]
        },
        ru: {
            poseLabel: "Поза",
            poseToggleOn: "Меню поз: открыто (нажмите, чтобы закрыть)",
            poseToggleOff: "Меню поз: нажмите, чтобы открыть",
            poseAction: "{src} ставит {tgt} в позу «{pose}».",
            descPasteCmd: "Нажмите, чтобы вставить команду в поле ввода",
            descJoinRoom: "Нажмите, чтобы войти в комнату: {room}",
            welcome: [
                "<b>🐈‍⬛ Liko ChatRoom Toolkit v" + MOD_VER + "</b>",
                "・Нажмите на кого-то → кнопка «Поза» вверху слева, чтобы менять позы значками",
                "・Поле ввода ↑/↓ возвращает отправленные сообщения (включая @)",
                "・Если в BIO указано GMT/UTC±N, над головой показывается местное время",
                "・Сообщение с @ = действие с вашим именем; @@ = без имени",
                "・/команды (розовые) и #комнаты# (синие) в чате становятся кнопками"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "Руки расслаблены" },
                { name: "Yoked", display: "Руки подняты" },
                { name: "OverTheHead", display: "Руки над головой" },
                { name: "BackBoxTie", display: "Руки за спиной" },
                { name: "BackElbowTouch", display: "Локти вместе" },
                { name: "BackCuffs", display: "Скованы за спиной" },
                { name: "BaseLower", display: "Стоя" },
                { name: "LegsClosed", display: "Ноги вместе" },
                { name: "Kneel", display: "На коленях" },
                { name: "KneelingSpread", display: "На коленях, ноги врозь" },
                { name: "AllFours", display: "На четвереньках" }
            ]
        },
        ua: {
            poseLabel: "Поза",
            poseToggleOn: "Меню поз: відкрито (натисніть, щоб закрити)",
            poseToggleOff: "Меню поз: натисніть, щоб відкрити",
            poseAction: "{src} ставить {tgt} у позу «{pose}».",
            descPasteCmd: "Натисніть, щоб вставити команду в поле вводу",
            descJoinRoom: "Натисніть, щоб увійти до кімнати: {room}",
            welcome: [
                "<b>🐈‍⬛ Liko ChatRoom Toolkit v" + MOD_VER + "</b>",
                "・Натисніть на когось → кнопка «Поза» вгорі зліва, щоб змінювати пози значками",
                "・Поле вводу ↑/↓ повертає надіслані повідомлення (зокрема @)",
                "・Якщо в BIO вказано GMT/UTC±N, над головою показується місцевий час",
                "・Повідомлення з @ = дія з вашим іменем; @@ = без імені",
                "・/команди (рожеві) та #кімнати# (сині) в чаті стають кнопками"
            ].join("<br>"),
            poses: [
                { name: "BaseUpper", display: "Руки розслаблені" },
                { name: "Yoked", display: "Руки підняті" },
                { name: "OverTheHead", display: "Руки над головою" },
                { name: "BackBoxTie", display: "Руки за спиною" },
                { name: "BackElbowTouch", display: "Лікті разом" },
                { name: "BackCuffs", display: "Скуті за спиною" },
                { name: "BaseLower", display: "Стоячи" },
                { name: "LegsClosed", display: "Ноги разом" },
                { name: "Kneel", display: "На колінах" },
                { name: "KneelingSpread", display: "На колінах, ноги нарізно" },
                { name: "AllFours", display: "Рачки" }
            ]
        }
    };

    // ================================
    // 常量
    // ================================
    const IconPathHelper = {
        _icons: null,
        getIconsPath: function () {
            if (this._icons) return this._icons;
            let href = window.location.href;
            if (!href.endsWith('/')) href = href.substring(0, href.lastIndexOf('/') + 1);
            this._icons = href + 'Icons/';
            return this._icons;
        }
    };

    const CONFIG = {
        // 姿勢選單幾何（沿用 EBCH 的擺放區域：左上角點選角色對話框內）
        ANCHOR_X: 400,          // 切換鈕 X
        ANCHOR_Y: 10,           // 切換鈕 Y
        TOGGLE_W: 64,
        TOGGLE_H: 64,
        ICON_SIZE: 64,          // 姿勢圖示格子邊長（圖示縮放填入，CDB 樣式）
        ICON_PAD: 3,            // 圖示與格子內距
        ICON_GAP: 6,
        ICON_COL_X: 400,        // 姿勢圖示欄位 X（切換鈕正下方，單一直欄）
        ICON_START_Y: 84,

        POSE_COOLDOWN: 800,     // 改姿勢冷卻(ms)
        HISTORY_MAX: 80,        // 輸入歷史上限
        SCAN_INTERVAL: 500,     // 聊天掃描(ms)

        // BIO 時區偵測：抓 "GMT+8" / "UTC -5" 之類
        TZ_RE: /(?:gmt|utc)\s*([+-])\s*(\d{1,2})/i,

        get POSES() { return Lang.t('poses'); },
        getPoseIconURL: function (name) { return IconPathHelper.getIconsPath() + 'Poses/' + name + '.png'; }
    };

    // ================================
    // 狀態
    // ================================
    let modApi = null;
    let poseCooldown = 0;
    let poseExpanded = false;
    let scanTimer = null;
    let descElement = null;

    // 輸入歷史（不持久化，僅本次連線）
    const hist = { list: [], index: null, draft: "" };

    // BIO 時區快取： MemberNumber -> { desc, off }
    const tzCache = new Map();

    // ================================
    // 工具
    // ================================
    function log(...a) { try { console.log(LOG, ...a); } catch (e) {} }
    function err(...a) { try { console.error(LOG, ...a); } catch (e) {} }

    function waitFor(check, timeout) {
        const start = Date.now();
        return new Promise((resolve) => {
            (function loop() {
                let ok = false;
                try { ok = check(); } catch (e) {}
                if (ok) return resolve(true);
                if (timeout && Date.now() - start > timeout) { err("等待逾時"); return resolve(false); }
                setTimeout(loop, 100);
            })();
        });
    }

    function nick(c) {
        try { return (typeof CharacterNickname === 'function') ? CharacterNickname(c) : (c.Nickname || c.Name); }
        catch (e) { return (c && (c.Nickname || c.Name)) || "?"; }
    }

    function getChatInput() { return document.getElementById('InputChat'); }

    function sendActionText(text) {
        if (!text || typeof ServerSend !== 'function') return;
        ServerSend("ChatRoomChat", {
            Content: "CUSTOM_SYSTEM_ACTION",
            Type: "Action",
            Dictionary: [
                { Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: text }
            ]
        });
    }

    // ================================
    // 功能 1：替他人改姿勢（圖示按鈕，畫在點選角色的對話框）
    // ================================
    function poseDisabled(target, name) {
        if (poseCooldown > Date.now()) return true;
        try {
            if (target.Pose && target.Pose.includes(name)) return true;
            if (typeof PoseCanChangeUnaided === 'function' && !PoseCanChangeUnaided(target, name)) return true;
        } catch (e) {}
        return false;
    }

    function changePoseOnTarget(target, poseDef) {
        const now = Date.now();
        try {
            if (poseCooldown > now) return false;
            if (typeof Player === 'undefined' || !Player.CanInteract()) return false;
            if (!target || target.IsPlayer()) return false;
            if (target.HasOnBlacklist && target.HasOnBlacklist(Player)) return false;
            if (typeof ServerChatRoomGetAllowItem === 'function' && !ServerChatRoomGetAllowItem(Player, target)) return false;
            if (typeof PoseCanChangeUnaided === 'function' && !PoseCanChangeUnaided(target, poseDef.name)) return false;
            if (target.Pose && target.Pose.includes(poseDef.name)) return false;

            PoseSetActive(target, poseDef.name, false, true);
            if (typeof ChatRoomCharacterUpdate === 'function') ChatRoomCharacterUpdate(target);
            poseCooldown = now + CONFIG.POSE_COOLDOWN;

            const msg = Lang.t('poseAction')
            .replace('{src}', nick(Player))
            .replace('{tgt}', nick(target))
            .replace('{pose}', poseDef.display);
            sendActionText(msg);
            return true;
        } catch (e) { err("改姿勢失敗", e); return false; }
    }

    function poseIconRect(i) {
        return [
            CONFIG.ICON_COL_X,
            CONFIG.ICON_START_Y + i * (CONFIG.ICON_SIZE + CONFIG.ICON_GAP),
            CONFIG.ICON_SIZE,
            CONFIG.ICON_SIZE
        ];
    }

    function isPoseTarget() {
        return typeof CurrentCharacter !== 'undefined' && CurrentCharacter &&
            !CurrentCharacter.IsPlayer() && CurrentCharacter.IsOnline && CurrentCharacter.IsOnline();
    }

    function drawPoseMenu() {
        if (typeof DrawButton !== 'function' || !isPoseTarget()) return;

        const hover = poseExpanded ? Lang.t('poseToggleOn') : Lang.t('poseToggleOff');
        DrawButton(CONFIG.ANCHOR_X, CONFIG.ANCHOR_Y, CONFIG.TOGGLE_W, CONFIG.TOGGLE_H,
                   Lang.t('poseLabel'), poseExpanded ? "#5323a1" : "White", "", hover);

        if (!poseExpanded) return;
        const poses = CONFIG.POSES;
        for (let i = 0; i < poses.length; i++) {
            const [x, y, w, h] = poseIconRect(i);
            const disabled = poseDisabled(CurrentCharacter, poses[i].name);
            // 先畫格子框（含 hover 與點擊區），再把 90px 圖示縮放填入格子
            DrawButton(x, y, w, h, "", disabled ? "Grey" : "White", "", poses[i].display, disabled);
            if (typeof DrawImageResize === 'function') {
                const p = CONFIG.ICON_PAD;
                DrawImageResize(CONFIG.getPoseIconURL(poses[i].name), x + p, y + p, w - 2 * p, h - 2 * p);
            }
        }
    }

    function clickPoseMenu() {
        if (typeof MouseIn !== 'function' || !isPoseTarget()) return false;

        if (MouseIn(CONFIG.ANCHOR_X, CONFIG.ANCHOR_Y, CONFIG.TOGGLE_W, CONFIG.TOGGLE_H)) {
            poseExpanded = !poseExpanded;
            return true;
        }
        if (poseExpanded) {
            const poses = CONFIG.POSES;
            for (let i = 0; i < poses.length; i++) {
                const [x, y, w, h] = poseIconRect(i);
                if (MouseIn(x, y, w, h)) {
                    changePoseOnTarget(CurrentCharacter, poses[i]);
                    return true;
                }
            }
        }
        return false;
    }

    // ================================
    // 功能 2：輸入歷史（上/下方向鍵）+ 歷史模式提示
    // ================================
    function injectHistoryStyle() {
        if (document.getElementById('liko-cra-style')) return;
        const s = document.createElement('style');
        s.id = 'liko-cra-style';
        s.textContent =
            '#InputChat.liko-cra-hist{background:#1c1230 !important;color:#ffcf6b !important;' +
            'outline:2px solid #9d4edd !important;outline-offset:-2px;}';
        document.head.appendChild(s);
    }

    function setHistMode(on) {
        const ic = getChatInput();
        if (!ic) return;
        ic.classList.toggle('liko-cra-hist', !!on);
    }

    function resetHistoryNav() {
        hist.index = null;
        setHistMode(false);
    }

    function pushHistory(text) {
        text = (text || "").trim();
        if (!text) return;
        if (hist.list[hist.list.length - 1] === text) return; // 不記連續重複
        hist.list.push(text);
        if (hist.list.length > CONFIG.HISTORY_MAX) hist.list.shift();
    }

    function handleHistoryKey(e) {
        const ic = getChatInput();
        if (!ic || e.target !== ic) return;
        if (e.shiftKey || e.ctrlKey || e.altKey) return;
        if (hist.list.length === 0) return;

        if (e.key === 'ArrowUp') {
            // 僅在游標位於開頭、或已在瀏覽歷史時接管（避免干擾多行編輯）
            if (hist.index === null && ic.selectionStart !== 0) return;
            if (hist.index === null) { hist.draft = ic.value; hist.index = hist.list.length; }
            if (hist.index > 0) hist.index--;
            ic.value = hist.list[hist.index] ?? "";
            ic.selectionStart = ic.selectionEnd = ic.value.length;
            setHistMode(true);
            e.preventDefault();
            e.stopPropagation();
        } else if (e.key === 'ArrowDown') {
            if (hist.index === null) return;
            hist.index++;
            if (hist.index >= hist.list.length) {
                hist.index = null;
                ic.value = hist.draft;
                setHistMode(false);
            } else {
                ic.value = hist.list[hist.index];
                setHistMode(true);
            }
            ic.selectionStart = ic.selectionEnd = ic.value.length;
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // ================================
    // 功能 3：@ 開頭 → 動作訊息，並自帶自己名字
    //  回傳 true = 已攔截（不要走原本送出流程）
    // ================================
    function handleAtActivity(raw, ic) {
        if (!ic || !raw || raw[0] !== '@') return false;
        if (raw.startsWith('@@@')) return false; // 保留：@@@ 不處理

        let text;
        if (raw.startsWith('@@')) {
            text = raw.slice(2).trim();          // @@ = 純動作，不帶名字
        } else {
            const body = raw.slice(1).trim();    // @  = 動作並在前面加上自己的名字
            text = body ? (nick(Player) + ' ' + body) : "";
        }
        if (!text) return false;

        sendActionText(text);
        ic.value = "";
        return true;
    }

    // ================================
    // 功能 4：時區（讀對方 BIO 偵測，頭頂顯示當地時間）
    // ================================
    function detectTimezone(C) {
        try {
            if (!C || typeof C.MemberNumber === 'undefined') return null;
            const desc = C.Description || "";
            const cached = tzCache.get(C.MemberNumber);
            if (cached && cached.desc === desc) return cached.off;

            let off = null;
            const m = CONFIG.TZ_RE.exec(desc);
            if (m) {
                const n = parseInt(m[1] + m[2], 10);
                if (!isNaN(n) && n >= -12 && n <= 12) off = n;
            }
            tzCache.set(C.MemberNumber, { desc, off });
            return off;
        } catch (e) { return null; }
    }

    function drawTimezoneOverlay(C, CharX, CharY, Zoom) {
        try {
            if (typeof ChatRoomHideIconState !== 'undefined' && ChatRoomHideIconState >= 1) return;
            const off = detectTimezone(C);
            if (typeof off !== 'number') return;

            const d = new Date(Date.now() + off * 3600000);
            const txt = String(d.getUTCHours()).padStart(2, '0'); // 只顯示兩位數小時（同 MBCHC）

            if (typeof DrawTextFit === 'function') {
                DrawTextFit(txt, CharX + 200 * Zoom, CharY + 25 * Zoom, 46 * Zoom, "white", "black");
            }
        } catch (e) {}
    }

    // ================================
    // 功能 5：聊天訊息內 /指令(粉) 與 #房間#(藍) 轉可點按鈕
    //  （參考 Liko - Chat TtoB，僅做指令與房間）
    // ================================
    function createDescElement() {
        if (descElement) return;
        descElement = document.createElement("div");
        descElement.id = "likoCRADesc";
        Object.assign(descElement.style, {
            position: "fixed", left: "0px", top: "0px", color: "white",
            background: "rgb(96, 10, 182)", fontSize: "20px", fontFamily: "Comfortaa",
            padding: "8px", textAlign: "center", width: "100%", display: "none", zIndex: 1000
        });
        document.body.appendChild(descElement);
    }
    function showDesc(text) { if (descElement) { descElement.innerHTML = text; descElement.style.display = "block"; } }
    function hideDesc() { if (descElement) descElement.style.display = "none"; }

    function normalizeCmd(s) { return s.normalize("NFKC").trim().toLowerCase(); }
    function findCommand(cmdKey) {
        if (!Array.isArray(window.Commands)) return null;
        return Commands.find(c => normalizeCmd(c.Tag) === normalizeCmd(cmdKey) || c.Tag === cmdKey);
    }

    function joinRoom(name) {
        const clean = (name || "").trim();
        if (typeof enterRoom === "function") { enterRoom(clean); return; }
        try {
            if (typeof ChatRoomLeave === 'function') ChatRoomLeave();
            if (typeof CommonSetScreen === 'function') CommonSetScreen("Online", "ChatSearch");
            if (typeof ServerSend === 'function') ServerSend("ChatRoomJoin", { Name: clean });
        } catch (e) { err("加入房間失敗", e); }
    }

    function processMessage(element) {
        if (!element || element.dataset.likoCraDone === "1") return;
        // 避免與 Chat TtoB 重複處理
        if (element.dataset.likoProcessed === "1") { element.dataset.likoCraDone = "1"; return; }
        if (element.closest && element.closest('a')) return;

        let html = element.innerHTML;
        if (/https?:\/\//i.test(html)) return;
        let changed = false;

        // #房間# → 藍色
        html = html.replace(/#([^#\n\r]{1,50})#/g, (match, room) => {
            if (room && room.trim().length > 0) {
                changed = true;
                return '<span class="likoCraRoom" style="color:#65b5ff;cursor:pointer;" data-room="' +
                    room.trim() + '">🚪' + room + '🚪</span>';
            }
            return match;
        });

        // /指令 → 粉色（需為已註冊指令）
        html = html.replace(/(^|\s)(\/[\p{L}\p{N}_-]+)/gu, (match, prefix, cmdText) => {
            const cmdObj = findCommand(cmdText.slice(1));
            if (cmdObj) {
                changed = true;
                const desc = (cmdObj.Description || '').replace(/"/g, '&quot;');
                return prefix + '<span class="likoCraCmd" style="color:#ff65f2;cursor:pointer;" data-cmd="' +
                    cmdText + '" data-desc="' + desc + '">' + cmdText + '</span>';
            }
            return match;
        });

        if (changed) {
            element.innerHTML = html;
            bindSpanEvents(element);
        }
        element.dataset.likoCraDone = "1";
    }

    function bindSpanEvents(element) {
        element.querySelectorAll('.likoCraCmd[data-cmd]').forEach(el => {
            if (el.dataset.bound) return;
            el.dataset.bound = "1";
            const cmd = el.dataset.cmd, desc = el.dataset.desc;
            el.addEventListener("click", () => {
                const input = getChatInput();
                if (input) { input.value = cmd + " "; input.focus(); }
            });
            el.addEventListener("mouseenter", () => showDesc((desc || ("執行 " + cmd)) + '<br>' + Lang.t('descPasteCmd')));
            el.addEventListener("mouseleave", hideDesc);
        });
        element.querySelectorAll('.likoCraRoom[data-room]').forEach(el => {
            if (el.dataset.bound) return;
            el.dataset.bound = "1";
            const room = el.dataset.room;
            el.addEventListener("click", (ev) => { ev.stopPropagation(); joinRoom(room); });
            el.addEventListener("mouseenter", () => showDesc(Lang.t('descJoinRoom').replace('{room}', room)));
            el.addEventListener("mouseleave", hideDesc);
        });
    }

    function scanChat() {
        try { document.querySelectorAll(".chat-room-message-content").forEach(processMessage); }
        catch (e) {}
    }

    // ================================
    // 初始化
    // ================================
    async function init() {
        const sdkOk = await waitFor(() => typeof bcModSdk !== 'undefined' && bcModSdk && bcModSdk.registerMod, 30000);
        if (!sdkOk) { err("bcModSdk 載入失敗，停止"); return; }

        modApi = bcModSdk.registerMod({
            name: "Liko-CRA",
            fullName: "Liko - ChatRoom Assistant",
            version: MOD_VER,
            repository: "https://github.com/awdrrawd/liko-Plugin-Repository"
        });

        await waitFor(() => typeof DrawButton === 'function' && typeof Player !== 'undefined');
        await waitFor(() => typeof Player !== 'undefined' && Player.MemberNumber);

        Lang.reset();
        injectHistoryStyle();
        createDescElement();

        // ── 姿勢選單：畫在點選角色的對話框 ──
        modApi.hookFunction("DialogDraw", 4, (args, next) => {
            const r = next(args);
            try { drawPoseMenu(); } catch (e) { err(e); }
            return r;
        });
        modApi.hookFunction("DialogClick", 4, (args, next) => {
            try { if (clickPoseMenu()) return; } catch (e) { err(e); }
            return next(args);
        });
        modApi.hookFunction("DialogLeave", 4, (args, next) => {
            poseExpanded = false;
            return next(args);
        });

        // ── 時區：角色頭頂顯示當地時間 ──
        if (typeof ChatRoomCharacterViewDrawOverlay !== 'undefined') {
            modApi.hookFunction("ChatRoomCharacterViewDrawOverlay", 4, (args, next) => {
                const r = next(args);
                try { drawTimezoneOverlay(args[0], args[1], args[2], args[3]); } catch (e) {}
                return r;
            });
        }

        // ── 送出攔截：紀錄歷史 + @ 動作 ──
        modApi.hookFunction("ChatRoomSendChat", 4, (args, next) => {
            try {
                const ic = getChatInput();
                const raw = ic ? ic.value : "";
                if (raw && raw.trim()) pushHistory(raw); // 任何成功送出的句子都進歷史（含 @）
                resetHistoryNav();
                if (handleAtActivity(raw, ic)) return;   // @ → 動作訊息，攔截原送出
            } catch (e) { err(e); }
            return next(args);
        });

        // ── 輸入歷史：方向鍵（capture 階段攔截，避免與原生衝突）──
        document.addEventListener('keydown', (e) => {
            try { handleHistoryKey(e); } catch (e2) {}
        }, true);
        // 使用者一旦真的打字（programmatic 設值不會觸發 input），離開歷史模式
        document.addEventListener('input', (e) => {
            if (e.target && e.target.id === 'InputChat') resetHistoryNav();
        });
        // 點擊頁面隱藏說明框
        document.addEventListener('click', hideDesc);

        // ── 聊天掃描：/指令 與 #房間# 轉按鈕 ──
        scanTimer = setInterval(scanChat, CONFIG.SCAN_INTERVAL);

        // ── 指令註冊 ──
        const registerCommands = () => {
            CommandCombine([{
                Tag: 'cum',
                Description: "：引起高潮。",
                Action: () => {
                    ActivityOrgasmRuined = false;
                    ActivityOrgasmStart(Player);
                }
            }]);
        };

        const tryRegister = () => {
            if (GetCommands().some(c => c.Tag.toLowerCase() === 'cum')) {
                log("/cum 指令已存在，跳過註冊");
                return;
            }
            try { registerCommands(); }
            catch (e) { err("指令註冊失敗", e); }
        };

        if (typeof CommandCombine === 'function' && typeof GetCommands === 'function') {
            tryRegister();
        } else {
            waitFor(() => typeof CommandCombine === 'function' && typeof GetCommands === 'function').then(tryRegister);
        }

        // 歡迎訊息（每連線一次）
        if (!window.LikoCRAWelcomed && typeof ChatRoomSendLocal === 'function') {
            modApi.hookFunction("ChatRoomLoad", 0, (args, next) => {
                const r = next(args);
                setTimeout(() => {
                    if (!window.LikoCRTWelcomed) {
                        ChatRoomSendLocal("<div style='background:#4C2772;color:#EEE;padding:6px;border-radius:6px;'>" +
                                          Lang.t('welcome') + "</div>", 30000);
                        window.LikoCRTWelcomed = true;
                    }
                }, 1000);
                return r;
            });
        }

        log(`✅ v${MOD_VER} loaded`);
    }

    init();
})();
