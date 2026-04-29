// ==UserScript==
// @name         BC Custom Heart Lock
// @name:zh      BC 自訂心形鎖
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      2.1.4
// @description  Custom Heart Lock
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// @grant        none
// ==/UserScript==

/*
 * v2.1.4 變更：整合 Abundantia Florum ─Chromatica─ (EL) 拓展戀人系統
 *   - 新增 isAllowedToLock(memberNum)：
 *       允許條件 = BC 原生戀人 OR 拓展戀人 OR (主人 + EL 設定允許主人使用鎖)
 *   - 兩處 isLover 判斷改為 isAllowedToLock()
 *   - 查詢 window.ELAbundantiaAPI（由 EL 插件在登入後掛載）
 *     EL 未安裝時自動降回 BC 原生戀人模式
 */

(function () {
    'use strict';

    // ── 防止重複執行（油猴裝了獨立版 + EL 又動態載入時只執行一次）──
    if (window._AFC_HeartLockLoaded) {
        console.log("🐈‍⬛ [HeartLock] 已載入，跳過重複執行");
        return;
    }
    window._AFC_HeartLockLoaded = true;

    const HEARTLOCK_NAME   = 'Heart Padlock';
    const HSLOCK_NAME      = 'HighSecurityPadlock';
    const MOD_NAME         = 'HeartLockBC';
    const EXT_KEY          = 'HeartLock';
    const HEARTLOCK_IMAGE  = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/main/Images/Heart_Lock.png';
    const VIBE_INTERVAL_MS = 5000;
    const VIBE_MSG_CYCLE   = 12;   // 12 × 5s = 60 秒發一次震動訊息

    const PX = 1100; const PY  = 130;
    const PW = 870;  const PH  = 840;
    const TAB_H = 60; const TAB_W = 200;
    const CX = PX + 20; const CY = PY + TAB_H + 10;
    const CW = PW - 40; const CH = PH - TAB_H - 10;
    const TAB_OVERVIEW = 'overview';
    const TAB_NOTE     = 'note';
    const TAB_TIMER    = 'timer';
    const TAB_CONTROL  = 'control';
    const TABS = [TAB_OVERVIEW, TAB_NOTE, TAB_TIMER, TAB_CONTROL];

    // ═══════════════════════════════════════════
    //  i18n
    // ═══════════════════════════════════════════
    function getLang() {
        const l = window.TranslationLanguage ?? 'EN';
        if (l === 'CN' || l === 'TW') return 'ZH';
        if (l === 'DE' || l === 'FR' || l === 'UA' || l === 'RU') return l;
        return 'EN';
    }

    const I18N = {
        ZH: {
            tabOverview    : '總覽',      tabNote        : '筆記',
            tabTimer       : '計時器',    tabControl     : '控制',
            noteTitle      : '♥ 愛情筆記 ♥',    timerTitle  : '♥ 計時器 ♥',
            controlTitle   : '♥ 控制 ♥',         noteHeader  : '♥ 筆記 ♥',
            noConfig       : '尚無設定。',         noTimer     : '無計時器',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : '只有鎖主可以編輯。',
            ownerOnlyTimer : '只有鎖主可以設置計時器。',
            ownerOnlyCtrl  : '只有鎖主可以更改設定。',
            maxChars       : '最多 200 字',        editNote    : '✏ 編輯筆記',
            setTimer       : '設置計時器',          clearTimer  : '清除計時器',
            settings       : '⚙ 設定',
            editingHint    : '編輯中 — 點擊修改，再儲存',
            vibStrength    : '震動強度',             restriction : '限制',
            remain         : '剩餘：',               until       : '截止：',
            adjust         : '調整：',               noNote      : '（尚未撰寫筆記…）',
            settingsChanged: '{0}更改了{1}身上的{2}的設定。',
            vibelow        : '{0}身上的{1}發出輕微的震動聲',
            vibemid        : '{0}身上的{1}發出震動聲',
            vibehigh       : '{0}身上的{1}發出激烈的震動聲',
            resistEscape   : '{0}身上的{1}抵禦了掙脫嘗試。',
            resistRestore  : '{0}身上的{1}抵禦了外部干擾，自動復原。',
            protectDisabled: '{0}的{1}防護暫時停用，請聯繫鎖主處理衝突。',
            timerExpired   : '{0}身上的{1}隨約定時刻到來，化作點點微光悄然消散。',
            lockedBy       : '被{0}鎖住了',          memberNum   : '成員編號：',
            lockedLabel    : '鎖定：',               vibeLabel   : '震動：',
            controlLabel   : '高潮控制：',            vibeOff     : '關閉',
            vibeLow        : '低 ♥',                  vibeMid     : '中 ♥♥',
            vibeHigh       : '高 ♥♥♥',               modeNormal  : '正常',
            modeEdge       : '邊緣 ～',               modeDeny    : '拒絕 ✕',
        },
        EN: {
            tabOverview    : 'Overview',  tabNote        : 'Note',
            tabTimer       : 'Timer',     tabControl     : 'Control',
            noteTitle      : '♥ Love Note ♥',       timerTitle  : '♥ Timer ♥',
            controlTitle   : '♥ Control ♥',          noteHeader  : '♥ Note ♥',
            noConfig       : 'No configuration.',    noTimer     : 'No timer',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Only the lock owner can edit.',
            ownerOnlyTimer : 'Only the lock owner can set the timer.',
            ownerOnlyCtrl  : 'Only the lock owner can change settings.',
            maxChars       : 'max 200 chars',         editNote    : '✏ Edit Note',
            setTimer       : 'Set Timer',             clearTimer  : 'Clear Timer',
            settings       : '⚙ Settings',
            editingHint    : 'Editing — click to change, then Save',
            vibStrength    : 'Vibration Strength',    restriction : 'Restriction',
            remain         : 'Remain:',               until       : 'Until:',
            adjust         : 'Adjust:',               noNote      : '(No note written yet…)',
            settingsChanged: '{0} changed the settings of {1}\'s {2}.',
            vibelow        : '{0}\'s {1} emits a faint vibration.',
            vibemid        : '{0}\'s {1} vibrates.',
            vibehigh       : '{0}\'s {1} vibrates intensely.',
            resistEscape   : '{0}\'s {1} resisted the escape attempt.',
            resistRestore  : '{0}\'s {1} resisted external interference and restored automatically.',
            protectDisabled: '{0}\'s {1} protection is temporarily disabled. Please contact the lock owner.',
            timerExpired   : 'The {1} on {0} dissolves into a gentle shimmer as the promised moment arrives.',
            lockedBy       : 'Locked by {0}',         memberNum   : 'Member #:',
            lockedLabel    : 'Locked:',               vibeLabel   : 'Vibe:',
            controlLabel   : 'Control:',              vibeOff     : 'Off',
            vibeLow        : 'Low ♥',                  vibeMid     : 'Med ♥♥',
            vibeHigh       : 'High ♥♥♥',              modeNormal  : 'Normal',
            modeEdge       : 'Edge ～',                modeDeny    : 'Deny ✕',
        },
        DE: {
            tabOverview    : 'Übersicht',  tabNote       : 'Notiz',
            tabTimer       : 'Timer',      tabControl    : 'Kontrolle',
            noteTitle      : '♥ Liebesnotiz ♥',  timerTitle  : '♥ Timer ♥',
            controlTitle   : '♥ Kontrolle ♥',    noteHeader  : '♥ Notiz ♥',
            noConfig       : 'Keine Konfiguration.',    noTimer     : 'Kein Timer',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Nur der Schlossbesitzer kann bearbeiten.',
            ownerOnlyTimer : 'Nur der Schlossbesitzer kann den Timer setzen.',
            ownerOnlyCtrl  : 'Nur der Schlossbesitzer kann Einstellungen ändern.',
            maxChars       : 'max. 200 Zeichen',  editNote    : '✏ bearbeiten',
            setTimer       : 'Timer setzen',      clearTimer  : 'Timer löschen',
            settings       : '⚙ Einstellungen',
            editingHint    : 'Bearbeitung — klicken zum Ändern, dann Speichern',
            vibStrength    : 'Vibrationsstärke',  restriction : 'Einschränkung',
            remain         : 'Verbleibend:',      until       : 'Bis:',
            adjust         : 'Anpassen:',         noNote      : '(Noch keine Notiz…)',
            settingsChanged: '{0} hat die Einstellungen von {1}s {2} geändert.',
            vibelow        : '{0}s {1} vibriert leise.',
            vibemid        : '{0}s {1} vibriert.',
            vibehigh       : '{0}s {1} vibriert heftig.',
            resistEscape   : '{0}s {1} hat dem Fluchtversuch widerstanden.',
            resistRestore  : '{0}s {1} hat äußere Einflüsse abgewehrt und sich wiederhergestellt.',
            protectDisabled: '{0}s {1}-Schutz ist vorübergehend deaktiviert. Bitte den Schlossbesitzer kontaktieren.',
            timerExpired   : 'Das {1} von {0} löst sich in sanftes Licht auf, als der vereinbarte Moment kommt.',
            lockedBy       : 'Gesperrt durch {0}',  memberNum   : 'Mitglied #:',
            lockedLabel    : 'Gesperrt:',           vibeLabel   : 'Vibration:',
            controlLabel   : 'Kontrolle:',          vibeOff     : 'Aus',
            vibeLow        : 'Niedrig ♥',            vibeMid     : 'Mittel ♥♥',
            vibeHigh       : 'Hoch ♥♥♥',            modeNormal  : 'Normal',
            modeEdge       : 'Edging ～',            modeDeny    : 'Verweigern ✕',
        },
        FR: {
            tabOverview    : 'Aperçu',    tabNote       : 'Note',
            tabTimer       : 'Minuterie', tabControl    : 'Contrôle',
            noteTitle      : '♥ Note d\'amour ♥',  timerTitle  : '♥ Minuterie ♥',
            controlTitle   : '♥ Contrôle ♥',       noteHeader  : '♥ Note ♥',
            noConfig       : 'Aucune configuration.',  noTimer  : 'Pas de minuterie',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Seul le propriétaire peut modifier.',
            ownerOnlyTimer : 'Seul le propriétaire peut définir la minuterie.',
            ownerOnlyCtrl  : 'Seul le propriétaire peut modifier les paramètres.',
            maxChars       : 'max. 200 caractères',  editNote   : '✏ Modifier',
            setTimer       : 'Définir minuterie',    clearTimer : 'Effacer minuterie',
            settings       : '⚙ Paramètres',
            editingHint    : 'Édition — cliquer pour modifier, puis Sauvegarder',
            vibStrength    : 'Intensité de vibration',  restriction : 'Restriction',
            remain         : 'Restant :',    until      : 'Jusqu\'à :',
            adjust         : 'Ajuster :',    noNote     : '(Pas encore de note…)',
            settingsChanged: '{0} a modifié les paramètres du {2} de {1}.',
            vibelow        : 'Le {1} de {0} émet une légère vibration.',
            vibemid        : 'Le {1} de {0} vibre.',
            vibehigh       : 'Le {1} de {0} vibre intensément.',
            resistEscape   : 'Le {1} de {0} a résisté à la tentative d\'évasion.',
            resistRestore  : 'Le {1} de {0} a résisté aux interférences et s\'est restauré automatiquement.',
            protectDisabled: 'La protection du {1} de {0} est temporairement désactivée. Contactez le propriétaire.',
            timerExpired   : 'Le {1} de {0} se dissout en une douce lueur à l\'heure convenue.',
            lockedBy       : 'Verrouillé par {0}',  memberNum   : 'Membre n° :',
            lockedLabel    : 'Verrouillé :',         vibeLabel   : 'Vibration :',
            controlLabel   : 'Contrôle :',           vibeOff     : 'Désactivé',
            vibeLow        : 'Faible ♥',              vibeMid     : 'Moyen ♥♥',
            vibeHigh       : 'Fort ♥♥♥',             modeNormal  : 'Normal',
            modeEdge       : 'Edging ～',             modeDeny    : 'Refuser ✕',
        },
        RU: {
            tabOverview    : 'Обзор',      tabNote       : 'Заметка',
            tabTimer       : 'Таймер',     tabControl    : 'Контроль',
            noteTitle      : '♥ Любовная записка ♥',  timerTitle  : '♥ Таймер ♥',
            controlTitle   : '♥ Контроль ♥',           noteHeader  : '♥ Заметка ♥',
            noConfig       : 'Нет настроек.',           noTimer     : 'Без таймера',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Только владелец замка может редактировать.',
            ownerOnlyTimer : 'Только владелец замка может задать таймер.',
            ownerOnlyCtrl  : 'Только владелец замка может изменять настройки.',
            maxChars       : 'макс. 200 символов',  editNote    : '✏ Редактировать',
            setTimer       : 'Задать таймер',       clearTimer  : 'Сбросить таймер',
            settings       : '⚙ Настройки',
            editingHint    : 'Редактирование — нажмите для изменения, затем Сохранить',
            vibStrength    : 'Сила вибрации',   restriction : 'Ограничение',
            remain         : 'Остаток:',        until       : 'До:',
            adjust         : 'Настроить:',      noNote      : '(Заметка ещё не написана…)',
            memberNum      : 'Участник #:',     lockedLabel : 'дата:',
            vibeLabel      : 'Вибрация:',       controlLabel: 'Контроль:',
            vibeOff        : 'Выкл.',           vibeLow     : 'Слабо ♥',
            vibeMid        : 'Средне ♥♥',       vibeHigh    : 'Сильно ♥♥♥',
            modeNormal     : 'Нормально',        modeEdge    : 'Эджинг ～',
            modeDeny       : 'Запрет ✕',
            settingsChanged: '{0} изменил(а) настройки {2} для {1}.',
            vibelow        : '{2} {0} слабо вибрирует.',
            vibemid        : '{2} {0} вибрирует.',
            vibehigh       : '{2} {0} сильно вибрирует.',
            resistEscape   : '{2} {0} отразил попытку побега.',
            resistRestore  : '{2} {0} отразил внешнее вмешательство и автоматически восстановился.',
            protectDisabled: 'Защита {2} {0} временно отключена. Обратитесь к владельцу замка.',
            timerExpired   : '{1} {0} растворяется в мягком свете, когда наступает условленный момент.',
            lockedBy       : 'Закрыто {0}',
        },
        UA: {
            tabOverview    : 'Огляд',      tabNote       : 'Нотатка',
            tabTimer       : 'Таймер',     tabControl    : 'Контроль',
            noteTitle      : '♥ Любовна нотатка ♥',  timerTitle  : '♥ Таймер ♥',
            controlTitle   : '♥ Контроль ♥',          noteHeader  : '♥ Нотатка ♥',
            noConfig       : 'Немає конфігурації.',    noTimer     : 'Без таймера',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Лише власник замка може редагувати.',
            ownerOnlyTimer : 'Лише власник замка може встановити таймер.',
            ownerOnlyCtrl  : 'Лише власник замка може змінювати налаштування.',
            maxChars       : 'макс. 200 символів',  editNote    : '✏ Редагувати',
            setTimer       : 'Встановити таймер',   clearTimer  : 'Очистити таймер',
            settings       : '⚙ Налаштування',
            editingHint    : 'Редагування — натисніть для зміни, потім Зберегти',
            vibStrength    : 'Сила вібрації',  restriction : 'Обмеження',
            remain         : 'Залишок:',       until       : 'До:',
            adjust         : 'Налаштувати:',   noNote      : '(Нотатку ще не написано…)',
            settingsChanged: '{0} змінив(ла) налаштування {2} для {1}.',
            vibelow        : '{2} {0} тихо вібрує.',
            vibemid        : '{2} {0} вібрує.',
            vibehigh       : '{2} {0} сильно вібрує.',
            resistEscape   : '{2} {0} відбив спробу втечі.',
            resistRestore  : '{2} {0} відбив зовнішній вплив і автоматично відновився.',
            protectDisabled: 'Захист {2} {0} тимчасово вимкнений. Зверніться до власника замка.',
            timerExpired   : '{1} {0} розчиняється у м\'якому світлі, коли настає обумовлений момент.',
            lockedBy       : 'Закрито {0}',     memberNum   : 'Учасник #:',
            lockedLabel    : 'Заблоковано:',    vibeLabel   : 'Вібрація:',
            controlLabel   : 'Контроль:',       vibeOff     : 'Вимк.',
            vibeLow        : 'Слабо ♥',          vibeMid     : 'Середньо ♥♥',
            vibeHigh       : 'Сильно ♥♥♥',       modeNormal  : 'Нормально',
            modeEdge       : 'Едгінг ～',         modeDeny    : 'Заборона ✕',
        },
    };

    function T(key, ...args) {
        const table = I18N[getLang()] ?? I18N.EN;
        let str = table[key] ?? I18N.EN[key] ?? key;
        args.forEach((a, i) => { str = str.replaceAll(`{${i}}`, a ?? ''); });
        return str;
    }

    const CC = {
        bg: '#0f0008', panel: '#1a0010', border: '#8B1A4A', acc: '#CC2266',
        tSel: '#8B1A4A', tOff: '#280a1c', text: '#FFFFFF', sub: '#CC99BB',
        dim: '#555555', gold: '#FFCC66', btn: '#280a1c', btnA: '#8B1A4A', danger: '#5a0a0a',
    };

    const CLOSE_X = PX + PW - 62; const CLOSE_Y = PY + 2;
    const CLOSE_W = 58;            const CLOSE_H = TAB_H - 4;

    const TOP_H = Math.floor(CH * 3 / 7);
    const BOT_H = CH - TOP_H - 8;
    const TOP_Y = CY;
    const BOT_Y = CY + TOP_H + 8;

    const IMG_COL = Math.floor(CW * 3 / 7);
    const IMG_X   = PX + 4;
    const IMG_Y   = TOP_Y + 4;
    const IMG_W   = IMG_COL - 22;
    const IMG_H   = TOP_H - 8;

    const INFO_COL = Math.floor(CW * 2 / 7);
    const LBL_X    = CX + IMG_COL - 17;
    const VAL_X    = CX + IMG_COL + INFO_COL - 51;
    const ROW_H    = 34; const ROW_GAP = 6;
    const ROWS_TOP = TOP_Y + 57;

    const NOTE_PREV_X = CX; const NOTE_PREV_Y = BOT_Y;
    const NOTE_PREV_W = CW; const NOTE_PREV_H = BOT_H - 4;
    const NOTE_HDR_H  = 28;

    const NOTE_TITLE_Y  = CY + 28;
    const NOTE_BOX_Y    = CY + 58;  const NOTE_BOX_H = 420;
    const NOTE_TA_ID    = 'HeartLockNoteTA';
    const NOTE_BTN_Y    = NOTE_BOX_Y + NOTE_BOX_H + 14;
    const NOTE_BTN_H    = 54;
    const NOTE_BTN_W    = 200;
    const NOTE_SAVE_X   = CX + CW - NOTE_BTN_W;
    const NOTE_CANCEL_X = CX + CW - NOTE_BTN_W * 2 - 16;

    const TMR_TITLE_Y = CY + 28;
    const TMR_ROW_H   = 44;
    const TMR_GAP     = 10;
    const TMR_REM_Y   = CY + 56;
    const TMR_DDAT_Y  = TMR_REM_Y + TMR_ROW_H + TMR_GAP;
    const TMR_VAL_X   = CX + 170;
    const TMR_CAL_W   = 52;
    const TMR_CAL_X   = CX + CW - TMR_CAL_W;
    const TMR_ADJ_Y   = TMR_DDAT_Y + TMR_ROW_H + TMR_GAP;
    const TMR_DISP_Y  = TMR_ADJ_Y + 26;
    const TMR_DISP_H  = 52;
    const TMR_PM_BTN_W = 110;
    const TMR_PM_GAP   = 5;
    const TMR_PM_TOTAL = 6 * TMR_PM_BTN_W + 5 * TMR_PM_GAP;
    const TMR_PM_X0    = CX + CW - TMR_PM_TOTAL;
    const TMR_PM = [
        { l:'-7d', dx:0, dh:-7*24 }, { l:'-1d', dx:1, dh:-24 },
        { l:'-1h', dx:2, dh:-1    }, { l:'+1h', dx:3, dh:1   },
        { l:'+1d', dx:4, dh:24    }, { l:'+7d', dx:5, dh:7*24 },
    ];
    const TMR_ACT_Y   = TMR_DISP_Y + TMR_DISP_H + TMR_GAP;
    const TMR_ACT_H   = 52;
    const TMR_ACT_W   = 190;
    const TMR_ACT_GAP = 16;
    const TMR_SET_X   = PX + PW/2 - TMR_ACT_W - TMR_ACT_GAP/2;
    const TMR_CLR_X   = PX + PW/2 + TMR_ACT_GAP/2;

    const CTL_TITLE_Y    = CY + 28;
    const CTL_VIBE_LBL_Y = CY + 58;
    const CTL_VIBE_BTN_Y = CTL_VIBE_LBL_Y + 28; const CTL_VIBE_BTN_H = 54;
    const CTL_ORG_LBL_Y  = CTL_VIBE_BTN_Y + CTL_VIBE_BTN_H + 32;
    const CTL_ORG_BTN_Y  = CTL_ORG_LBL_Y  + 28; const CTL_ORG_BTN_H  = 54;
    const CTL_SAVE_Y     = CTL_ORG_BTN_Y   + CTL_ORG_BTN_H + 30;
    const CTL_SAVE_H     = 54;
    const CTL_SAVE_W     = 200;
    const CTL_SAVE_X     = CX + CW - CTL_SAVE_W;
    const CTL_CANCEL_W   = 200;
    const CTL_CANCEL_X   = CX + CW - CTL_SAVE_W - CTL_CANCEL_W - 16;

    const CTL_VIBE_OPTS = [{ v:'off',l:'Off' },{ v:'low',l:'♥ Low' },{ v:'mid',l:'♥♥ Med' },{ v:'high',l:'♥♥♥ High' }];
    const CTL_ORG_OPTS  = [{ o:'normal',l:'Normal' },{ o:'edge',l:'Edge ～' },{ o:'deny',l:'Deny ✕' }];

    // ═══════════════════════════════════════════
    //  全域狀態
    // ═══════════════════════════════════════════
    const state = {
        initialized: false, assetCreated: false, modApi: null,
        vibeTimer: null, vibeCycle: 0, lastIntegritySync: 0,
        _lastRestoreMsg: 0, _restoring: false, _unlocking: false,
        _inServerSync: false, _sendingResist: false, _timerUnlocking: false,
        panel: {
            tab: TAB_OVERVIEW, targetChar: null, groupName: null,
            timerInput: 0, noteEditing: false, ctlEditing: false,
            ctlVibe: 'off', ctlOrg: 'normal',
            dpYear: 2026, dpMonth: 1, dpDay: 1, dpHour: 0, dpMin: 0,
        },
    };

    const grabStateChar   = { count: 0, firstTriggerTime: Date.now(), state: false };
    const grabStateSingle = { count: 0, firstTriggerTime: Date.now(), state: false };
    const GRAB_WINDOW_MS   = 14000;
    const GRAB_COOLDOWN_MS = 120000;

    // ═══════════════════════════════════════════
    //  EL 整合：上鎖許可判斷
    // ═══════════════════════════════════════════
    /**
     * 判斷 Player 是否有資格替角色 ch 上 Heart Lock。
     *
     * 判斷邏輯（以 ch 的共享設定為準，因為 ch 才是被鎖的一方）：
     *   1. ch 是 Player 的 BC 原生戀人 → 始終允許（原版行為，不需 EL 設定）
     *   2. ch 未啟用 EL Lock（ch.OnlineSharedSettings.AFC.lockPerms.enableELLock = false）→ 拒絕
     *   3. ch 是 Player 的拓展戀人（EL） → 允許
     *   4. Player 是 ch 的主人 且 ch 設定允許主人使用鎖 → 允許
     */
    function isAllowedToLock(ch) {
        const memberNum = ch?.MemberNumber;
        if (!memberNum) return false;

        // 1. BC 原生戀人 → 始終允許
        if (Player.Lovership?.some(l => Number(l.MemberNumber) === Number(memberNum)))
            return true;

        // 2. 讀取 ch 的共享鎖定權限（其他玩家可見）
        const elPerms = ch.OnlineSharedSettings?.AFC?.lockPerms;
        if (!elPerms?.enableELLock) return false;  // ch 未開啟 EL Lock

        const api = window.ELAbundantiaAPI;

        // 3. 拓展戀人
        if (api?.isELLover?.(memberNum)) return true;

        // 4. Player 是 ch 的主人，且 ch 允許主人使用鎖
        if (elPerms.enableOwnerLock &&
            ch.Ownership?.MemberNumber != null &&
            Number(ch.Ownership.MemberNumber) === Number(Player.MemberNumber))
            return true;

        return false;
    }

    // ═══════════════════════════════════════════
    //  工具
    // ═══════════════════════════════════════════
    function log(...a) { console.log('🐈‍⬛ [HeartLock]', ...a); }
    function clone(v)  { return JSON.parse(JSON.stringify(v)); }
    function wait(ms)  { return new Promise(r => setTimeout(r, ms)); }
    async function waitFor(fn, timeout = 45000, interval = 100) {
        const start = Date.now();
        while (true) {
            try { if (fn()) return true; } catch {}
            if (Date.now() - start > timeout) return false;
            await wait(interval);
        }
    }

    function hit(x, y, w, h) {
        return MouseX >= x && MouseX <= x + w && MouseY >= y && MouseY <= y + h;
    }

    function bRect(x, y, w, h, bg, label, tc) {
        DrawRect(x, y, w, h, bg);
        DrawText(label, x + w / 2, y + h / 2, tc ?? CC.text, 'transparent');
    }

    function textLeft(text, x, cy, color) {
        const prev = MainCanvas.textAlign;
        MainCanvas.textAlign = 'left';
        DrawText(text, x, cy, color, 'transparent');
        MainCanvas.textAlign = prev;
    }

    function wrapLinesCanvas(text, maxPx) {
        if (!text) return [''];
        const canvas = window.MainCanvas;
        const ctx2d  = (canvas && typeof canvas.getContext === 'function') ? canvas.getContext('2d') : null;
        const prevFont = ctx2d?.font;
        if (ctx2d) { try { ctx2d.font = typeof CommonGetFont === 'function' ? CommonGetFont(36) : 'bold 36px Arial'; } catch {} }
        const measure = s => ctx2d ? ctx2d.measureText(s).width : s.length * 18;
        const paragraphs = text.split(/\r?\n/);
        const allLines = [];
        const hardWrap = (word) => {
            const chunks = []; let chunk = '';
            for (const ch of word) {
                const test = chunk + ch;
                if (measure(test) > maxPx && chunk) { chunks.push(chunk); chunk = ch; }
                else chunk = test;
            }
            if (chunk) chunks.push(chunk);
            return chunks.length ? chunks : [word];
        };
        for (const para of paragraphs) {
            if (!para.trim()) { allLines.push(''); continue; }
            const words = para.split(/\s+/).filter(Boolean);
            let cur = '';
            for (const w of words) {
                if (measure(w) > maxPx) {
                    if (cur) { allLines.push(cur); cur = ''; }
                    hardWrap(w).forEach(l => allLines.push(l)); continue;
                }
                const test = cur ? `${cur} ${w}` : w;
                if (measure(test) > maxPx && cur) { allLines.push(cur); cur = w; }
                else cur = test;
            }
            if (cur) allLines.push(cur);
        }
        if (ctx2d && prevFont) { try { ctx2d.font = prevFont; } catch {} }
        return allLines.length ? allLines : [''];
    }

    function getBCScreenPos(bcX, bcY) {
        const canvas = document.getElementById('MainCanvas') || document.querySelector('canvas');
        if (!canvas) return { left: window.innerWidth * 0.7, top: window.innerHeight * 0.6, scaleX: 1, scaleY: 1 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / 2000, scaleY = rect.height / 1000;
        return { left: rect.left + bcX * scaleX, top: rect.top + bcY * scaleY, scaleX, scaleY };
    }

    function timerRemainStr(cfg) {
        if (!cfg?.unlockTime) return null;
        const rem = Math.max(0, new Date(cfg.unlockTime).getTime() - Date.now());
        if (rem === 0) return 'Expired';
        const totalSec = Math.floor(rem / 1000);
        if (totalSec < 60) return '< 1 minute';
        const totalMin = Math.floor(totalSec / 60);
        if (totalMin < 60) return `${totalMin} min`;
        const h = Math.floor(totalMin / 60);
        if (h < 24) return `${h}h ${totalMin % 60}m`;
        const d = Math.floor(h / 24);
        return `${d}d ${h % 24}h`;
    }

    function timerDateOnlyStr(cfg) {
        if (!cfg?.unlockTime) return null;
        const d = new Date(cfg.unlockTime);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function timerDateShortStr(cfg) {
        if (!cfg?.unlockTime) return null;
        const d = new Date(cfg.unlockTime);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function timerDeltaStr(hours) {
        if (!hours) return '';
        const sign = hours > 0 ? '+' : '-';
        const h = Math.abs(hours);
        if (h < 24) return `(${sign}${h}h)`;
        const d = Math.floor(h / 24), rh = h % 24;
        return rh ? `(${sign}${d}d ${rh}h)` : `(${sign}${d}d)`;
    }

    function lockedAtStr(cfg) {
        if (!cfg?.lockedAt) return '—';
        const d = new Date(cfg.lockedAt);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
    }

    function dpInit(cfg) {
        state.panel._dpInitDate = cfg?.unlockTime ? new Date(cfg.unlockTime) : new Date(Date.now() + 86400000);
    }

    function showHTMLDatePicker(onConfirm, initDate) {
        document.getElementById('HL_DatePicker')?.remove();
        const picker = document.createElement('div');
        picker.id = 'HL_DatePicker';
        const _pos = getBCScreenPos(TMR_VAL_X, TMR_DDAT_Y + TMR_ROW_H + 4);
        picker.style.cssText = `position:fixed;left:${_pos.left}px;top:${_pos.top}px;width:290px;background:#1a0010;border:2px solid #8B1A4A;border-radius:8px;padding:12px;z-index:999999;color:#fff;font-family:Arial,sans-serif;box-shadow:0 4px 24px #000a;`;
        let date = initDate ? new Date(initDate) : new Date(Date.now() + 86400000);
        const selStyle = `background:#280a1c;color:#fff;border:1px solid #8B1A4A;border-radius:4px;padding:3px 5px;font-size:13px;`;
        function genOptions(min, max, selected) {
            let h = '';
            for (let i = min; i <= max; i++)
                h += `<option value="${i}"${i===selected?' selected':''}>${String(i).padStart(2,'0')}</option>`;
            return h;
        }
        function genYearOpts(cur) {
            let h = '';
            for (let i = cur-2; i <= cur+5; i++)
                h += `<option value="${i}"${i===cur?' selected':''}>${i}</option>`;
            return h;
        }
        function render() {
            const y = date.getFullYear(), m = date.getMonth();
            const first = new Date(y, m, 1).getDay();
            const days  = new Date(y, m+1, 0).getDate();
            const prev  = new Date(y, m, 0).getDate();
            let dayCells = '';
            for (let i = 0; i < 42; i++) {
                let d, off = 0;
                if (i < first)              { d = prev - first + i + 1; off = -1; }
                else if (i >= first + days) { d = i - first - days + 1; off =  1; }
                else                        { d = i - first + 1; }
                const isOther = off !== 0, isSelected = !isOther && d === date.getDate();
                dayCells += `<div data-d="${d}" data-off="${off}" style="text-align:center;padding:3px 2px;cursor:pointer;border-radius:3px;font-size:12px;background:${isSelected?'#8B1A4A':'#280a1c'};color:${isOther?'#554':'#fff'};">${d}</div>`;
            }
            picker.innerHTML = `
                <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
                    <select id="hl_y" style="${selStyle}">${genYearOpts(y)}</select>
                    <span style="color:#CC99BB">/</span>
                    <select id="hl_m" style="${selStyle}">${genOptions(1,12,m+1)}</select>
                </div>
                <div style="display:grid;grid-template-columns:repeat(7,1fr);text-align:center;color:#CC99BB;font-size:11px;margin-bottom:3px;">
                    ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>`<div>${d}</div>`).join('')}
                </div>
                <div id="hl_days" style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:10px;">${dayCells}</div>
                <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
                    <span style="color:#CC99BB;font-size:13px;">🕐</span>
                    <select id="hl_h" style="${selStyle}">${genOptions(0,23,date.getHours())}</select>
                    <span style="color:#CC99BB">:</span>
                    <select id="hl_min" style="${selStyle}">${genOptions(0,59,date.getMinutes())}</select>
                </div>
                <div style="display:flex;gap:8px;">
                    <button id="hl_ok" style="flex:1;background:#8B1A4A;color:#fff;border:none;border-radius:4px;padding:7px;cursor:pointer;font-size:13px;">✔ Confirm</button>
                    <button id="hl_cancel" style="flex:1;background:#280a1c;color:#CC99BB;border:1px solid #8B1A4A;border-radius:4px;padding:7px;cursor:pointer;font-size:13px;">✕ Cancel</button>
                </div>`;
            picker.querySelector('#hl_y').onchange  = e => { date.setFullYear(+e.target.value); render(); };
            picker.querySelector('#hl_m').onchange  = e => { date.setMonth(+e.target.value-1);  render(); };
            picker.querySelector('#hl_days').onclick = e => {
                const cell = e.target.closest('[data-d]');
                if (!cell) return;
                date.setMonth(date.getMonth() + +cell.dataset.off);
                date.setDate(+cell.dataset.d);
                render();
            };
            picker.querySelector('#hl_ok').onclick = () => {
                date.setHours(+picker.querySelector('#hl_h').value, +picker.querySelector('#hl_min').value, 0, 0);
                if (date.getTime() > Date.now()) { onConfirm(date); }
                picker.remove();
            };
            picker.querySelector('#hl_cancel').onclick = () => picker.remove();
        }
        document.body.appendChild(picker);
        render();
        setTimeout(() => {
            document.addEventListener('mousedown', function close(e) {
                if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('mousedown', close); }
            });
        }, 0);
    }

    // ═══════════════════════════════════════════
    //  Storage（與原版完全一致）
    // ═══════════════════════════════════════════
    const DEFAULT_STORAGE = { debug: false, previewImage: HEARTLOCK_IMAGE, padlocks: {} };

    function ensureStorage() {
        if (!window.Player) return false;
        if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
        const es = Player.ExtensionSettings;
        if (!es[EXT_KEY] || typeof es[EXT_KEY] !== 'object') es[EXT_KEY] = clone(DEFAULT_STORAGE);
        if (!es[EXT_KEY].padlocks) es[EXT_KEY].padlocks = {};
        Player.HeartLock = es[EXT_KEY];
        return true;
    }

    function getSetting(key) { return Player?.HeartLock?.[key] ?? DEFAULT_STORAGE[key]; }

    function getPadlockConfig(character, groupName) {
        if (!character || !groupName) return null;
        const store = character.IsPlayer() ? (Player.HeartLock?.padlocks ?? {}) : (character.HeartLock?.padlocks ?? {});
        return store[groupName] ?? null;
    }

    function getOrCreateConfig(groupName) {
        if (!ensureStorage()) return null;
        const p = Player.HeartLock.padlocks;
        if (!p[groupName]) {
            p[groupName] = {
                owner: Player.MemberNumber, ownerName: Player.Nickname || Player.Name,
                lockedAt: new Date().toISOString(),
                note: '', unlockTime: null, vibe: 'off', orgasmMode: 'normal',
            };
        }
        return p[groupName];
    }

    function deleteConfig(groupName) {
        if (!ensureStorage()) return;
        delete Player.HeartLock.padlocks[groupName];
        saveAndSync();
    }

    function saveAndSync() {
        if (!ensureStorage()) return;
        try { if (typeof ServerPlayerExtensionSettingsSync === 'function') ServerPlayerExtensionSettingsSync(EXT_KEY); } catch {}
        broadcastStorage();
    }

    function sendSettingsChange(character, groupName) {
        if (!character || character.IsPlayer()) return;
        try {
            const wearer = character.Nickname || character.Name;
            const self   = Player.Nickname || Player.Name;
            ServerSend('ChatRoomChat', {
                Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION',
                Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION',
                              Text: T('settingsChanged', self, wearer, HEARTLOCK_NAME) }],
            });
        } catch {}
    }

    function broadcastStorage() {
        try {
            if (typeof ServerSend !== 'function') return;
            ServerSend('ChatRoomChat', {
                Type: 'Hidden', Content: 'HeartLockSync',
                Dictionary: [{ Tag: 'HeartLockData', Data: clone(Player.HeartLock) }],
            });
        } catch {}
    }

    function requestHeartLockData(character) {
        if (!character || character.IsPlayer()) return;
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Hidden', Content: 'HeartLockRequest',
                Dictionary: [{ Tag: 'HeartLockRequest', Target: character.MemberNumber }],
            });
        } catch {}
    }

    function pushConfig(character, groupName, patch) {
        if (character.IsPlayer()) {
            if (!ensureStorage()) return;
            const cfg = Player.HeartLock.padlocks[groupName];
            if (cfg) { Object.assign(cfg, patch); saveAndSync(); }
        } else {
            try {
                ServerSend('ChatRoomChat', {
                    Type: 'Hidden', Content: 'HeartLockUpdate',
                    Dictionary: [{ Tag: 'HeartLockUpdate', Target: character.MemberNumber, Group: groupName, Config: patch }],
                });
            } catch {}
        }
    }

    function notifyRemove(character, groupName) {
        if (character.IsPlayer()) { deleteConfig(groupName); return; }
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Hidden', Content: 'HeartLockRemove',
                Dictionary: [{ Tag: 'HeartLockRemove', Target: character.MemberNumber, Group: groupName }],
            });
        } catch {}
    }

    function handleHidden(data) {
        if (!data || data.Type !== 'Hidden') return;
        if (data.Content === 'HeartLockRequest') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockRequest');
            if (e?.Target === Player.MemberNumber) broadcastStorage();
        }
        if (data.Content === 'HeartLockSync') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockData');
            if (e) {
                const s = ChatRoomCharacter?.find(c => c.MemberNumber === data.Sender);
                if (s) s.HeartLock = e.Data;
            }
        }
        if (data.Content === 'HeartLockApply') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockApply');
            if (!e || e.Target !== Player.MemberNumber) return;
            if (Number(e.Owner) !== Number(data.Sender)) return;
            const existing = Player.HeartLock?.padlocks?.[e.Group];
            if (existing && Number(existing.owner) !== Number(data.Sender)) return;
            const cfg = getOrCreateConfig(e.Group);
            if (!cfg) return;
            cfg.owner = e.Owner; cfg.ownerName = e.OwnerName;
            cfg.lockedAt = e.LockedAt; cfg.assetName = e.AssetName ?? null; cfg.lockId = e.LockId ?? null;
            try {
                const item = InventoryGet?.(Player, e.Group);
                if (item) {
                    cfg._fullSnapshot = { assetName: item.Asset?.Name, groupName: e.Group, color: item.Color ? clone(item.Color) : undefined, craft: item.Craft ? clone(item.Craft) : undefined, difficulty: item.Difficulty };
                    if (item?.Property) item.Property.HeartLockId = e.LockId;
                }
            } catch {}
            saveAndSync();
        }
        if (data.Content === 'HeartLockUpdate') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockUpdate');
            if (!e || e.Target !== Player.MemberNumber) return;
            if (!ensureStorage()) return;
            const p = Player.HeartLock.padlocks;
            if (p[e.Group]) { Object.assign(p[e.Group], e.Config); saveAndSync(); }
        }
        if (data.Content === 'HeartLockRemove') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockRemove');
            if (!e || e.Target !== Player.MemberNumber) return;
            deleteConfig(e.Group);
        }
    }

    // ═══════════════════════════════════════════
    //  權限
    // ═══════════════════════════════════════════
    function canEdit(wearerChar, cfg) {
        if (!wearerChar || !cfg) return false;
        if (wearerChar.IsPlayer()) return false;
        return cfg.owner === Player.MemberNumber;
    }

    // ═══════════════════════════════════════════
    //  Asset 建立
    // ═══════════════════════════════════════════
    function createHeartLockAsset() {
        if (state.assetCreated) return true;
        if (!window.AssetFemale3DCG || !window.AssetGroupGet || !window.AssetAdd || !window.InventoryAdd) return false;
        const itemMisc = AssetFemale3DCG.find(g => g.Group === 'ItemMisc');
        if (!itemMisc) return false;
        if (itemMisc.Asset.find(a => a.Name === HEARTLOCK_NAME)) { state.assetCreated = true; return true; }
        const def = { AllowType: ['LockPickSeed'], Effect: [], ExclusiveUnlock: true, Extended: true, IsLock: true, Name: HEARTLOCK_NAME, PickDifficulty: 20, Time: 10, Value: 70, Wear: false };
        try {
            itemMisc.Asset.push(def);
            AssetAdd(AssetGroupGet('Female3DCG', 'ItemMisc'), def, AssetFemale3DCGExtended);
            if (Player?.Inventory && !Player.Inventory.some(i => i.Asset?.Name === HEARTLOCK_NAME))
                InventoryAdd(Player, HEARTLOCK_NAME, 'ItemMisc');
            state.assetCreated = true;
            log('Asset created.');            return true;
        } catch (e) { console.error('[HeartLock] Asset creation failed', e); return false; }
    }

    // ═══════════════════════════════════════════
    //  ModAPI — 優先共用 EL 的 modApi，否則自行註冊
    // ═══════════════════════════════════════════
    function getModApi() {
        if (state.modApi) return state.modApi;

        // 優先使用 Abundantia Florum ─Chromatica─ (EL) 的共用 modApi
        // EL 在 bcModSdk 就緒後立即掛載此物件，HeartLock 不需要另行 registerMod
        const sharedApi = window.ELAbundantiaAPI?.modApi;
        if (sharedApi) {
            state.modApi = sharedApi;
            console.log('🐈‍⬛ [HeartLock] 共用 EL modApi');
            return sharedApi;
        }

        // 備援：EL 未載入時自行註冊獨立 mod
        if (!window.bcModSdk?.registerMod) return null;
        try {
            state.modApi = window.bcModSdk.registerMod({
                name: MOD_NAME, fullName: 'Heart Lock BC (standalone)',
                version: '2.1.1', repository: 'https://github.com/awdrrawd/liko-tool-Image-storage',
            });
            console.log('🐈‍⬛ [HeartLock] 獨立 modApi 已註冊（EL 未載入）');
            return state.modApi;
        } catch (e) {
            if (!window.bcModSdk.getModsInfo?.().find(m => m.name === MOD_NAME))
                console.error('[HeartLock] registerMod failed', e);
            return null;
        }
    }

    // ═══════════════════════════════════════════
    //  上鎖轉換（與原版一致）
    // ═══════════════════════════════════════════
    function convertToHeartLock(character, item, groupName) {
        if (!item?.Property) return;
        if (character.IsPlayer()) {
            const cfg = getOrCreateConfig(groupName);
            if (cfg) {
                cfg._fullSnapshot = { assetName: item.Asset?.Name, groupName, color: item.Color ? clone(item.Color) : undefined, craft: item.Craft ? clone(item.Craft) : undefined, difficulty: item.Difficulty };
            }
        }
        item.Property.Name = HEARTLOCK_NAME;
        item.Property.LockPickSeed = '8,3,5,10,4,2,6,7,1,9,0,11';
        if (character?.Ownership?.MemberNumber != null && item.Property.LockMemberNumber == null)
            item.Property.LockMemberNumber = character.Ownership.MemberNumber;
        const lockId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
        const assetName = item.Asset?.Name ?? null;
        item.Property.HeartLockId = lockId;
        const now = new Date().toISOString();
        if (character.IsPlayer()) {
            const cfg = getOrCreateConfig(groupName);
            if (cfg) { cfg.owner = Player.MemberNumber; cfg.ownerName = Player.Nickname || Player.Name; cfg.lockedAt = now; cfg.assetName = assetName; cfg.lockId = lockId; saveAndSync(); }
        } else {
            try {
                ServerSend('ChatRoomChat', { Type: 'Hidden', Content: 'HeartLockApply', Dictionary: [{ Tag: 'HeartLockApply', Target: character.MemberNumber, Group: groupName, Owner: Player.MemberNumber, OwnerName: Player.Nickname || Player.Name, LockedAt: now, AssetName: assetName, LockId: lockId }] });
            } catch {}
        }
        try { if (typeof ChatRoomCharacterItemUpdate === 'function' && groupName) ChatRoomCharacterItemUpdate(character, groupName); } catch {}
    }

    function reapplyFromAppearance() {
        if (!ensureStorage()) return;
        const padlocks = Player.HeartLock.padlocks;
        Player.Appearance?.forEach(item => {
            if (!item?.Property) return;
            if (item.Property.LockedBy !== HSLOCK_NAME) return;
            // 只處理確實由心鎖系統加的鎖（有 HeartLockId 或 Name=HEARTLOCK_NAME）
            // 避免把合法的高安全鎖也轉換掉
            const isHeartLock = item.Property.Name === HEARTLOCK_NAME || !!item.Property.HeartLockId;
            if (!isHeartLock) return;
            const gn = item.Asset?.Group?.Name;
            if (!gn || padlocks[gn]) return;
            padlocks[gn] = {
                owner: item.Property.LockMemberNumber ?? Player.MemberNumber,
                ownerName: item.Property.LockMemberName ?? '',
                lockedAt: new Date().toISOString(),
                note: '', unlockTime: null, vibe: 'off', orgasmMode: 'normal',
            };
        });
        for (const gn of Object.keys(padlocks)) {
            try { const item = InventoryGet?.(Player, gn); if (!item) continue; if (!item?.Property?.LockedBy) deleteConfig(gn); } catch {}
        }
    }

    function watchForUnlock(character, groupName, item) {
        let checks = 0;
        const iv = setInterval(() => {
            checks++;
            if (!item?.Property?.LockedBy) { clearInterval(iv); notifyRemove(character, groupName); return; }
            if (checks > 20) clearInterval(iv);
        }, 500);
    }

    function restoreLockFromConfig(gn, cfg) {
        let item = InventoryGet?.(Player, gn);
        if (!item) {
            const snap = cfg._fullSnapshot;
            if (!snap?.assetName) { log('restore: no snapshot for', gn); return; }
            try {
                const asset = AssetGet?.(Player.AssetFamily, gn, snap.assetName);
                if (!asset) { log('restore: asset not found', snap.assetName); return; }
                state._restoring = true;
                item = InventoryWear?.(Player, snap.assetName, gn, snap.color, asset.Difficulty, Player.MemberNumber, snap.craft);
                state._restoring = false;
                if (!item) item = InventoryGet?.(Player, gn);
                if (!item) { log('restore: InventoryWear failed for', gn); return; }
            } catch (e) { state._restoring = false; log('restore: error', e); return; }
        }
        if (cfg.assetName && item.Asset?.Name !== cfg.assetName) return;
        try {
            const hsAsset = AssetGet?.('Female3DCG', 'ItemMisc', HSLOCK_NAME);
            if (hsAsset) InventoryLock?.(Player, item, { Asset: hsAsset }, cfg.owner);
        } catch {}
        if (!item.Property) item.Property = {};
        item.Property.Name = HEARTLOCK_NAME;
        item.Property.LockPickSeed = '8,3,5,10,4,2,6,7,1,9,0,11';
        item.Property.ExclusiveUnlock = true;
        if (cfg.lockId) item.Property.HeartLockId = cfg.lockId;
        try { ValidationSanitizeProperties?.(Player, item); ValidationSanitizeLock?.(Player, item); } catch {}
        log('restore: Heart Padlock restored on', gn);
    }

    function checkLockIntegrity() {
        if (!ensureStorage()) return;
        if (state._unlocking) return;
        const padlocks = Player.HeartLock?.padlocks ?? {};
        for (const gn of Object.keys(padlocks)) {
            const cfg = padlocks[gn];
            if (!cfg) continue;
            const item = InventoryGet?.(Player, gn);
            if (!item) continue;
            if (cfg.assetName && item.Asset?.Name !== cfg.assetName) continue;
            const badLockedBy = item.Property?.LockedBy !== HSLOCK_NAME;
            const badName     = item.Property?.Name     !== HEARTLOCK_NAME;
            const badLockId   = cfg.lockId && item.Property?.HeartLockId !== cfg.lockId;
            if (badLockedBy || badName || badLockId) { log('Lock integrity violation on', gn, { badLockedBy, badName, badLockId }); restoreLockFromConfig(gn, cfg); }
        }
    }

    // ═══════════════════════════════════════════
    //  震動
    // ═══════════════════════════════════════════
    function startVibeTimer() {
        if (state.vibeTimer) return;
        state.vibeTimer = setInterval(vibeStep, VIBE_INTERVAL_MS);
    }

    function vibeStep() {
        if (!window.Player?.ArousalSettings || !ensureStorage()) return;
        const padlocks = Player.HeartLock?.padlocks ?? {};
        const order = { off:0, low:1, mid:2, high:3 };
        let maxStr = 'off', any = false;
        for (const gn of Object.keys(padlocks)) {
            const cfg = padlocks[gn];
            if (!cfg?.vibe || cfg.vibe === 'off') continue;
            const item = InventoryGet?.(Player, gn);
            if (!item?.Property || item.Property.Name !== HEARTLOCK_NAME) { delete padlocks[gn]; continue; }
            any = true;
            Player.ArousalSettings.Progress = Math.min(100, (Player.ArousalSettings.Progress ?? 0) + ({ off:0,low:1,mid:2,high:3 }[cfg.vibe] ?? 0));
            if ((order[cfg.vibe] ?? 0) > (order[maxStr] ?? 0)) maxStr = cfg.vibe;
        }
        if (!any) return;
        state.vibeCycle = (state.vibeCycle + 1) % VIBE_MSG_CYCLE;
        if (state.vibeCycle === 0) {
            // 讀取穿戴者的 AFC 設定判斷是否發送震動訊息
            const vibeMsgEnabled = Player.OnlineSharedSettings?.AFC?.enableVibeMsg ?? true;
            if (vibeMsgEnabled) {
                const nick = Player.Nickname || Player.Name;
                const msg = { low: T('vibelow', nick, HEARTLOCK_NAME), mid: T('vibemid', nick, HEARTLOCK_NAME), high: T('vibehigh', nick, HEARTLOCK_NAME) }[maxStr];
                if (msg) try { ServerSend('ChatRoomChat', { Type:'Action', Content:'CUSTOM_SYSTEM_ACTION', Dictionary:[{ Tag:'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text:msg }] }); } catch {}
            }
        }
    }

    // ═══════════════════════════════════════════
    //  高潮攔截
    // ═══════════════════════════════════════════
    function setupOrgasmHook(modApi) {
        const getMode = () => {
            if (!ensureStorage()) return 'normal';
            let mode = 'normal';
            for (const gn of Object.keys(Player.HeartLock?.padlocks ?? {})) {
                const cfg = Player.HeartLock.padlocks[gn];
                if (!cfg?.orgasmMode || cfg.orgasmMode === 'normal') continue;
                const item = InventoryGet?.(Player, gn);
                if (!item?.Property || item.Property.Name !== HEARTLOCK_NAME) continue;
                if (cfg.orgasmMode === 'deny') { mode = 'deny'; break; }
                if (cfg.orgasmMode === 'edge') mode = 'edge';
            }
            return mode;
        };
        modApi.hookFunction('ActivityOrgasmPrepare', 11, (args, next) => {
            if (!args[0]?.IsPlayer?.()) return next(args);
            const mode = getMode();
            if (mode === 'deny') { if (Player.ArousalSettings?.Progress != null) Player.ArousalSettings.Progress = 0; return; }
            if (mode === 'edge') { if (Player.ArousalSettings?.Progress != null) Player.ArousalSettings.Progress = 99; return; }
            return next(args);
        });
        modApi.hookFunction('ActivityOrgasmStart', 11, (args, next) => {
            if (!args[0]?.IsPlayer?.()) return next(args);
            const mode = getMode();
            if (mode === 'deny' || mode === 'edge') { if (Player.ArousalSettings?.Progress != null) Player.ArousalSettings.Progress = mode === 'deny' ? 0 : 99; return; }
            return next(args);
        });
    }

    // ═══════════════════════════════════════════
    //  Timer 自動解鎖
    // ═══════════════════════════════════════════
    function startTimerCheck() { setInterval(checkTimers, 60000); }
    function checkTimers() {
        if (!ensureStorage()) return;
        const now = Date.now();
        for (const gn of Object.keys(Player.HeartLock?.padlocks ?? {})) {
            const cfg = Player.HeartLock.padlocks[gn];
            if (!cfg?.unlockTime || now < new Date(cfg.unlockTime).getTime()) continue;
            try {
                const item = InventoryGet?.(Player, gn);
                if (item?.Property?.Name === HEARTLOCK_NAME) {
                    state._timerUnlocking = true;
                    InventoryUnlock?.(Player, gn);
                    state._timerUnlocking = false;
                    ChatRoomCharacterUpdate?.(Player);
                    const nick = Player.Nickname || Player.Name;
                    ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('timerExpired', nick, HEARTLOCK_NAME) }] });
                }
            } catch { state._timerUnlocking = false; }
            deleteConfig(gn);
        }
    }

    // ═══════════════════════════════════════════
    //  Note TextArea
    // ═══════════════════════════════════════════
    function showNoteTA() {
        if (!document.getElementById(NOTE_TA_ID)) ElementCreateTextArea(NOTE_TA_ID);
        const el = document.getElementById(NOTE_TA_ID);
        if (el) { el.style.display = ''; el.maxLength = 200; }
        ElementPositionFixed(NOTE_TA_ID, CX, NOTE_BOX_Y, CW, NOTE_BOX_H);
    }
    function hideNoteTA() { const el = document.getElementById(NOTE_TA_ID); if (el) { el.style.display = 'none'; el.value = ''; } }
    function getNoteTAValue() { return document.getElementById(NOTE_TA_ID)?.value ?? ''; }
    function setNoteTAValue(text) { const el = document.getElementById(NOTE_TA_ID); if (el) el.value = text || ''; }

    // ═══════════════════════════════════════════
    //  Draw 函式（與原版完全一致）
    // ═══════════════════════════════════════════
    function drawFrame(curTab) {
        DrawRect(PX-3, PY-3, PW+6, PH+6, CC.border);
        DrawRect(PX, PY, PW, PH, CC.bg);
        TABS.forEach((tab, i) => {
            const tx = PX + i * TAB_W, sel = tab === curTab;
            const thisW = (i === TABS.length - 1) ? (CLOSE_X - tx + 1) : TAB_W;
            DrawRect(tx-1, PY-1, thisW+1, TAB_H+1, sel ? CC.tSel : CC.tOff);
            if (sel) DrawRect(tx-1, PY+TAB_H-2, thisW+1, 3, CC.acc);
            const tabLabels = { [TAB_OVERVIEW]: T('tabOverview'), [TAB_NOTE]: T('tabNote'), [TAB_TIMER]: T('tabTimer'), [TAB_CONTROL]: T('tabControl') };
            DrawText(tabLabels[tab] ?? tab, tx+TAB_W/2-1, PY+TAB_H/2, sel ? CC.text : CC.sub, 'transparent');
        });
        DrawRect(PX, PY+TAB_H, PW, 2, CC.border);
        bRect(CLOSE_X, CLOSE_Y, CLOSE_W, CLOSE_H, CC.danger, '✕');
    }

    function drawGeneral(cfg) {
        DrawImageResize(getSetting('previewImage'), IMG_X, IMG_Y, IMG_W, IMG_H);
        const rightCenter = LBL_X + (CW - IMG_COL) / 2 - 20;
        DrawText('♥ Heart Padlock ♥', rightCenter, TOP_Y + 20, CC.acc, 'transparent');
        if (!cfg) { DrawText(T('noConfig'), rightCenter, TOP_Y + 68, CC.dim, 'transparent'); }
        else {
            const remain = timerRemainStr(cfg), date = timerDateShortStr(cfg);
            const rows = [
                { label: T('memberNum'),    value: String(cfg.owner ?? '?'),                                                                   vc: CC.text },
                { label: T('lockedLabel'),  value: lockedAtStr(cfg),                                                                           vc: CC.sub  },
                { label: T('remain'),       value: remain || T('noTimer'),                                                                      vc: remain ? CC.gold : CC.dim },
                { label: T('until'),        value: date   || '—',                                                                               vc: remain ? CC.sub  : CC.dim },
                { label: T('vibeLabel'),    value: ({off:T('vibeOff'),low:T('vibeLow'),mid:T('vibeMid'),high:T('vibeHigh')})[cfg.vibe ?? 'off'], vc: CC.text },
                { label: T('controlLabel'), value: ({normal:T('modeNormal'),edge:T('modeEdge'),deny:T('modeDeny')})[cfg.orgasmMode ?? 'normal'], vc: CC.text },
            ];
            rows.forEach(({ label, value, vc }, i) => {
                const ry = ROWS_TOP + i * (ROW_H + ROW_GAP);
                textLeft(label, LBL_X, ry + ROW_H/2, CC.sub);
                textLeft(value, VAL_X, ry + ROW_H/2, vc);
            });
        }
        DrawRect(NOTE_PREV_X, NOTE_PREV_Y, NOTE_PREV_W, NOTE_PREV_H, CC.panel);
        DrawRect(NOTE_PREV_X, NOTE_PREV_Y, NOTE_PREV_W, NOTE_HDR_H, '#280a1c');
        DrawText(T('noteHeader'), NOTE_PREV_X + NOTE_PREV_W/2, NOTE_PREV_Y + NOTE_HDR_H/2, CC.acc, 'transparent');
        const note = cfg?.note || '', maxPx = NOTE_PREV_W - 28;
        const lines = wrapLinesCanvas(note || T('noNote'), maxPx);
        const maxLine = Math.floor((NOTE_PREV_H - NOTE_HDR_H - 10) / 30);
        lines.slice(0, maxLine).forEach((l, i) => textLeft(l, NOTE_PREV_X + 14, NOTE_PREV_Y + NOTE_HDR_H + 22 + i*30, note ? CC.text : CC.dim));
    }

    function drawNote(cfg, editable) {
        DrawText(T('noteTitle'), PX+PW/2, NOTE_TITLE_Y, CC.acc, 'transparent');
        const p = state.panel;
        if (p.noteEditing && editable) {
            const NB = 4;
            DrawRect(CX-NB, NOTE_BOX_Y-NB, CW+NB*2, NB, CC.border);
            DrawRect(CX-NB, NOTE_BOX_Y+NOTE_BOX_H, CW+NB*2, NB, CC.border);
            DrawRect(CX-NB, NOTE_BOX_Y-NB, NB, NOTE_BOX_H+NB*2, CC.border);
            DrawRect(CX+CW, NOTE_BOX_Y-NB, NB, NOTE_BOX_H+NB*2, CC.border);
            DrawRect(CX, NOTE_BOX_Y, CW, NOTE_BOX_H, '#1a001a');
            textLeft(T('maxChars'), CX + 8, NOTE_BTN_Y + NOTE_BTN_H/2, CC.dim);
            bRect(NOTE_CANCEL_X, NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H, CC.btnA, '💾 Save');
            bRect(NOTE_SAVE_X,   NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H, CC.btn,  '✕ Cancel', CC.sub);
        } else {
            const note = cfg?.note || '';
            const lines = wrapLinesCanvas(note || T('noNote'), CW - 28);
            const boxH = Math.max(lines.length * 36 + 24, NOTE_BOX_H);
            DrawRect(CX, NOTE_BOX_Y, CW, boxH, CC.panel);
            lines.forEach((l, i) => textLeft(l, CX+14, NOTE_BOX_Y+24+i*36, note ? CC.text : CC.dim));
            if (editable) bRect(NOTE_SAVE_X, NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H, CC.btnA, T('editNote'));
            else DrawText(T('ownerOnlyEdit'), PX+PW/2, NOTE_BTN_Y+NOTE_BTN_H/2, CC.dim, 'transparent');
        }
    }

    function clickNote(character, gName, editable) {
        const p = state.panel;
        if (p.noteEditing && editable) {
            if (hit(NOTE_CANCEL_X, NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H)) { pushConfig(character, gName, { note: getNoteTAValue().slice(0, 200) }); sendSettingsChange(character, gName); hideNoteTA(); p.noteEditing = false; }
            if (hit(NOTE_SAVE_X,   NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H)) { hideNoteTA(); p.noteEditing = false; }
        } else if (editable && hit(NOTE_SAVE_X, NOTE_BTN_Y, NOTE_BTN_W, NOTE_BTN_H)) {
            setNoteTAValue(getPadlockConfig(character, gName)?.note || ''); showNoteTA(); p.noteEditing = true;
        }
    }

    function drawTimer(cfg, editable) {
        DrawText(T('timerTitle'), PX+PW/2, TMR_TITLE_Y, CC.acc, 'transparent');
        const remain = timerRemainStr(cfg), date = timerDateOnlyStr(cfg);
        const delta = state.panel.timerInput, deltaS = timerDeltaStr(delta);
        DrawRect(CX, TMR_REM_Y, CW, TMR_ROW_H, CC.panel);
        textLeft(T('remain'), CX + 14, TMR_REM_Y + TMR_ROW_H/2, CC.sub);
        textLeft(remain || T('noTimerSet'), TMR_VAL_X, TMR_REM_Y + TMR_ROW_H/2, remain ? CC.gold : CC.dim);
        if (editable && deltaS) textLeft(deltaS, TMR_VAL_X + 280, TMR_REM_Y + TMR_ROW_H/2, delta > 0 ? CC.gold : '#FF9999');
        DrawRect(CX, TMR_DDAT_Y, CW, TMR_ROW_H, CC.panel);
        textLeft(T('until'), CX + 14, TMR_DDAT_Y + TMR_ROW_H/2, CC.sub);
        textLeft(date || '—', TMR_VAL_X, TMR_DDAT_Y + TMR_ROW_H/2, date ? CC.sub : CC.dim);
        if (editable) bRect(TMR_CAL_X, TMR_DDAT_Y + 4, TMR_CAL_W, TMR_ROW_H - 8, CC.btn, '📅', CC.sub);
        if (!editable) { DrawText(T('ownerOnlyTimer'), PX+PW/2, TMR_DDAT_Y + TMR_ROW_H + 30, CC.dim, 'transparent'); return; }
        textLeft(T('adjust'), CX + 14, TMR_ADJ_Y + TMR_DISP_H / 2, CC.sub);
        TMR_PM.forEach((b, i) => bRect(TMR_PM_X0 + i * (TMR_PM_BTN_W + TMR_PM_GAP), TMR_ADJ_Y, TMR_PM_BTN_W, TMR_DISP_H, CC.btn, b.l, CC.sub));
        bRect(TMR_SET_X, TMR_ACT_Y, TMR_ACT_W, TMR_ACT_H, CC.btnA,   T('setTimer'));
        bRect(TMR_CLR_X, TMR_ACT_Y, TMR_ACT_W, TMR_ACT_H, CC.danger, T('clearTimer'));
    }

    function clickTimer(character, gName, editable) {
        if (!editable) return;
        const cfg = getPadlockConfig(character, gName);
        if (hit(TMR_CAL_X, TMR_DDAT_Y + 4, TMR_CAL_W, TMR_ROW_H - 8)) {
            const initDate = cfg?.unlockTime ? new Date(cfg.unlockTime) : (state.panel._dpInitDate || new Date(Date.now() + 86400000));
            showHTMLDatePicker(d => { pushConfig(character, gName, { unlockTime: d.toISOString() }); dpInit({ unlockTime: d.toISOString() }); sendSettingsChange(character, gName); }, initDate);
            return;
        }
        TMR_PM.forEach((b, i) => { if (hit(TMR_PM_X0 + i * (TMR_PM_BTN_W + TMR_PM_GAP), TMR_ADJ_Y, TMR_PM_BTN_W, TMR_DISP_H)) state.panel.timerInput = (state.panel.timerInput || 0) + b.dh; });
        if (hit(TMR_SET_X, TMR_ACT_Y, TMR_ACT_W, TMR_ACT_H)) {
            const delta = state.panel.timerInput || 0;
            const base  = cfg?.unlockTime ? new Date(cfg.unlockTime).getTime() : Date.now();
            const newTime = base + delta * 3600000;
            if (newTime > Date.now()) { pushConfig(character, gName, { unlockTime: new Date(newTime).toISOString() }); dpInit({ unlockTime: new Date(newTime).toISOString() }); sendSettingsChange(character, gName); state.panel.timerInput = 0; }
        }
        if (hit(TMR_CLR_X, TMR_ACT_Y, TMR_ACT_W, TMR_ACT_H)) { pushConfig(character, gName, { unlockTime: null }); dpInit(null); sendSettingsChange(character, gName); state.panel.timerInput = 0; }
    }

    function drawControl(cfg, editable) {
        DrawText(T('controlTitle'), PX+PW/2, CTL_TITLE_Y, CC.acc, 'transparent');
        const p = state.panel;
        const curV = p.ctlEditing ? p.ctlVibe : (cfg?.vibe ?? 'off');
        const curO = p.ctlEditing ? p.ctlOrg  : (cfg?.orgasmMode ?? 'normal');
        const vibeLabels = { off:T('vibeOff'), low:T('vibeLow'), mid:T('vibeMid'), high:T('vibeHigh') };
        const orgLabels  = { normal:T('modeNormal'), edge:T('modeEdge'), deny:T('modeDeny') };
        textLeft(T('vibStrength'), CX+14, CTL_VIBE_LBL_Y, CC.sub);
        CTL_VIBE_OPTS.forEach((o, i) => bRect(CX+i*210, CTL_VIBE_BTN_Y, 200, CTL_VIBE_BTN_H, o.v===curV ? CC.btnA : CC.btn, vibeLabels[o.v], o.v===curV ? CC.text : CC.sub));
        textLeft(T('restriction'), CX+14, CTL_ORG_LBL_Y, CC.sub);
        CTL_ORG_OPTS.forEach((o, i) => bRect(CX+i*280, CTL_ORG_BTN_Y, 268, CTL_ORG_BTN_H, o.o===curO ? CC.btnA : CC.btn, orgLabels[o.o], o.o===curO ? CC.text : CC.sub));
        if (!editable) { DrawText(T('ownerOnlyCtrl'), PX+PW/2, CTL_SAVE_Y+CTL_SAVE_H/2, CC.dim, 'transparent'); return; }
        if (!p.ctlEditing) bRect(CTL_SAVE_X, CTL_SAVE_Y, CTL_SAVE_W, CTL_SAVE_H, CC.btnA, T('settings'));
        else {
            bRect(CTL_SAVE_X,   CTL_SAVE_Y, CTL_SAVE_W,   CTL_SAVE_H, CC.btn,  '✕ Cancel', CC.sub);
            bRect(CTL_CANCEL_X, CTL_SAVE_Y, CTL_CANCEL_W, CTL_SAVE_H, CC.btnA, '💾 Save');
            DrawText(T('editingHint'), PX+PW/2, CTL_SAVE_Y + CTL_SAVE_H + 28, CC.sub, 'transparent');
        }
    }

    function clickControl(character, gName, cfg, editable) {
        const p = state.panel;
        if (!editable) return;
        if (!p.ctlEditing) {
            if (hit(CTL_SAVE_X, CTL_SAVE_Y, CTL_SAVE_W, CTL_SAVE_H)) { p.ctlVibe = cfg?.vibe ?? 'off'; p.ctlOrg = cfg?.orgasmMode ?? 'normal'; p.ctlEditing = true; }
        } else {
            CTL_VIBE_OPTS.forEach((o, i) => { if (hit(CX+i*210, CTL_VIBE_BTN_Y, 200, CTL_VIBE_BTN_H)) p.ctlVibe = o.v; });
            CTL_ORG_OPTS.forEach((o, i)  => { if (hit(CX+i*280, CTL_ORG_BTN_Y,  268, CTL_ORG_BTN_H))  p.ctlOrg  = o.o; });
            if (hit(CTL_CANCEL_X, CTL_SAVE_Y, CTL_CANCEL_W, CTL_SAVE_H)) { pushConfig(character, gName, { vibe: p.ctlVibe, orgasmMode: p.ctlOrg }); sendSettingsChange(character, gName); p.ctlEditing = false; }
            if (hit(CTL_SAVE_X,   CTL_SAVE_Y, CTL_SAVE_W,   CTL_SAVE_H)) p.ctlEditing = false;
        }
    }

    // ═══════════════════════════════════════════
    //  面板主函式
    // ═══════════════════════════════════════════
    function getGroupFromFocusItem() {
        const item = window.DialogFocusSourceItem;
        if (item?.Asset?.Group?.Name) return item.Asset.Group.Name;
        const ch = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
        return ch?.FocusGroup?.Name ?? null;
    }

    function panelLoad() {
        const ch  = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
        const gn  = getGroupFromFocusItem();
        const cfg = ch ? getPadlockConfig(ch, gn) : null;
        state.panel.targetChar  = ch;
        state.panel.groupName   = gn;
        state.panel.tab         = TAB_OVERVIEW;
        state.panel.timerInput  = 0;
        state.panel.noteEditing = false;
        state.panel.ctlEditing  = false;
        hideNoteTA();
        dpInit(cfg);
        if (ch && !ch.IsPlayer()) requestHeartLockData(ch);
    }

    function panelDraw() {
        const p = state.panel, ch = p.targetChar, gn = p.groupName;
        const cfg = ch ? getPadlockConfig(ch, gn) : null;
        const canEd = canEdit(ch, cfg);
        drawFrame(p.tab);
        switch (p.tab) {
            case TAB_OVERVIEW: drawGeneral(cfg);          break;
            case TAB_NOTE    : drawNote(cfg, canEd);      break;
            case TAB_TIMER   : drawTimer(cfg, canEd);     break;
            case TAB_CONTROL : drawControl(cfg, canEd);   break;
        }
    }

    function panelClick() {
        const p = state.panel, ch = p.targetChar, gn = p.groupName;
        const cfg = ch ? getPadlockConfig(ch, gn) : null;
        const canEd = canEdit(ch, cfg);
        if (hit(CLOSE_X, CLOSE_Y, CLOSE_W, CLOSE_H)) { hideNoteTA(); p.noteEditing = false; p.ctlEditing = false; DialogFocusItem = null; return; }
        TABS.forEach((tab, i) => {
            if (hit(PX+i*TAB_W, PY, TAB_W-2, TAB_H) && p.tab !== tab) {
                if (p.noteEditing) { hideNoteTA(); p.noteEditing = false; }
                if (p.ctlEditing)  p.ctlEditing = false;
                p.tab = tab;
                if (tab === TAB_TIMER) { dpInit(ch ? getPadlockConfig(ch, p.groupName) : null); p.timerInput = 0; }
            }
        });
        switch (p.tab) {
            case TAB_NOTE   : clickNote(ch, gn, canEd);         break;
            case TAB_TIMER  : clickTimer(ch, gn, canEd);        break;
            case TAB_CONTROL: clickControl(ch, gn, cfg, canEd); break;
        }
    }

    // ═══════════════════════════════════════════
    //  Hooks（兩處 isLover 改為 isAllowedToLock）
    // ═══════════════════════════════════════════
    function patchFunctions(modApi) {

        // ── InventoryRemove 攔截 ──────────────────────────────────────
        modApi.hookFunction('InventoryRemove', 0, (args, next) => {
            const C = args[0], grp = args[1];
            if (state._restoring) return next(args);
            if (!C?.IsPlayer?.()) {
                const item = InventoryGet?.(C, grp);
                if (item?.Property?.Name === HEARTLOCK_NAME) {
                    const cfg2 = getPadlockConfig(C, grp);
                    if (cfg2) { if (Number(cfg2.owner) !== Number(Player.MemberNumber)) { return; } notifyRemove(C, grp); }
                }
                return next(args);
            }
            const item = InventoryGet?.(Player, grp);
            if (item?.Property?.Name === HEARTLOCK_NAME) {
                const cfg2 = getPadlockConfig(Player, grp);
                if (cfg2) {
                    if (Number(cfg2.owner) !== Number(Player.MemberNumber)) {
                        log('InventoryRemove blocked — not owner');                        if (!state._sendingResist) {
                            state._sendingResist = true;
                            setTimeout(() => {
                                try { ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('resistEscape', Player.Nickname || Player.Name, HEARTLOCK_NAME) }] }); } catch {}
                                state._sendingResist = false;
                            }, 300);
                        }
                        return;
                    }
                    deleteConfig(grp);
                }
            }
            if (state._inServerSync) return next(args);
            return next(args);
        });

        // ── 非允許者隱藏 HeartLock ────────────────────────────────────
        // ▼ CHANGE 1: isLover → isAllowedToLock ▼
        modApi.hookFunction('DialogInventoryAdd', 10, (args, next) => {
            const C    = args[0];
            const item = args[1];
            if (item?.Asset?.Name !== HEARTLOCK_NAME) return next(args);
            if (DialogMenuMode === 'permissions') return next(args);
            if (C.ID === 0) return;  // 穿戴者自己不顯示

            // 只有被允許的關係才能看到此鎖
            if (!isAllowedToLock(C)) return;  // 不呼叫 next → 不顯示

            return next(args);
        });

        // ── 上鎖 ──────────────────────────────────────────────────────
        // ▼ CHANGE 2: isLover → isAllowedToLock ▼
        modApi.hookFunction('DialogLockingClick', 2, (args, next) => {
            const cl = args[0], ch = args[1], item = args[2];
            if (cl?.Asset?.Name !== HEARTLOCK_NAME) return next(args);
            if (DialogMenuMode === 'permissions') return next(args);
            if (typeof InventoryBlockedOrLimited === 'function' && InventoryBlockedOrLimited(ch, cl)) return next(args);

            // 只有被允許的關係才能上鎖
            if (!isAllowedToLock(ch)) return;

            const hsAsset = AssetGet?.('Female3DCG', 'ItemMisc', HSLOCK_NAME);
            if (!hsAsset) return next(args);
            const fg = ch?.FocusGroup?.Name, ori = cl.Asset;
            cl.Asset = hsAsset; next(args); cl.Asset = ori;
            if (item?.Property) { convertToHeartLock(ch, item, fg); if (fg) watchForUnlock(ch, fg, item); }
        });

        // ── ServerSend：ActionAddLock 修正 ────────────────────────────
        modApi.hookFunction('ServerSend', 0, (args, next) => {
            if (args[0] === 'ChatRoomChat') {
                const d = args[1];
                if (d?.Content === 'ActionAddLock' && Array.isArray(d.Dictionary)) {
                    d.Dictionary.forEach(e => {
                        if (e.AssetName === HSLOCK_NAME) e.AssetName = HEARTLOCK_NAME;
                        if (e.Tag === 'NextAsset' && e.Text === HSLOCK_NAME) e.Text = HEARTLOCK_NAME;
                    });
                }
            }
            return next(args);
        });

        // ── 面板 Hooks ────────────────────────────────────────────────
        modApi.hookFunction('InventoryItemMiscHighSecurityPadlockLoad', 11, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name !== HEARTLOCK_NAME) return next(args);
            next(args); panelLoad();
        });
        modApi.hookFunction('InventoryItemMiscHighSecurityPadlockDraw', 11, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name !== HEARTLOCK_NAME) return next(args);
            panelDraw();
        });
        modApi.hookFunction('InventoryItemMiscHighSecurityPadlockClick', 11, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name !== HEARTLOCK_NAME) return next(args);
            panelClick();
        });
        modApi.hookFunction('DialogLeaveFocusItem', 0, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name === HEARTLOCK_NAME) { hideNoteTA(); state.panel.noteEditing = false; state.panel.ctlEditing = false; }
            return next(args);
        });

        // ── 封包（hidden message）────────────────────────────────────
        modApi.hookFunction('ChatRoomMessage', 0, (args, next) => {
            state._inServerSync = true; handleHidden(args[0]);
            const result = next(args); state._inServerSync = false;
            return result;
        });

        // ── ChatRoomSync / CharacterRefresh ───────────────────────────
        modApi.hookFunction('ChatRoomSync', 0, (args, next) => {
            const result = next(args); setTimeout(() => ensureStorage(), 500); return result;
        });
        modApi.hookFunction('CharacterRefresh', 0, (args, next) => {
            const result = next(args);
            if (args[0]?.IsPlayer?.()) setTimeout(() => { ensureStorage(); reapplyFromAppearance(); }, 300);
            return result;
        });

        // ── 圖片替換 ──────────────────────────────────────────────────
        modApi.hookFunction('DrawImageResize', 0, (args, next) => {
            if (typeof args[0] === 'string' && args[0].includes(`ItemMisc/Preview/${HEARTLOCK_NAME}.png`)) args[0] = getSetting('previewImage');
            return next(args);
        });
        try { modApi.hookFunction('DrawImage', 0, (args, next) => { if (typeof args[0] === 'string' && args[0].includes(`ItemMisc/Preview/${HEARTLOCK_NAME}.png`)) args[0] = getSetting('previewImage'); return next(args); }); } catch {}
        modApi.hookFunction('ElementButton.CreateForAsset', 0, (args, next) => {
            args[4] ??= {};
            const asset = ('Asset' in args[1]) ? args[1].Asset : args[1];
            if (asset?.Name === HEARTLOCK_NAME) args[4].image = getSetting('previewImage');
            return next(args);
        });
        try {
            modApi.hookFunction('ElementButton.Create', 0, (args, next) => {
                const opts = args[2];
                if (opts?.icons && Array.isArray(opts.icons)) {
                    opts.icons = opts.icons.map(icon => {
                        if (icon === HEARTLOCK_NAME) return { name: HEARTLOCK_NAME, iconSrc: getSetting('previewImage') };
                        if (typeof icon === 'object' && icon?.name === HEARTLOCK_NAME) return { ...icon, iconSrc: getSetting('previewImage') };
                        return icon;
                    });
                }
                return next(args);
            });
        } catch {}

        // ── 狀態列圖示 ────────────────────────────────────────────────
        modApi.hookFunction('DialogGetLockIcon', 2, (args, next) => {
            const item = args[0], icons = next(args) || [];
            if (item?.Property?.Name === HEARTLOCK_NAME) {
                const idx = icons.indexOf(HSLOCK_NAME);
                if (idx !== -1) icons.splice(idx, 1, HEARTLOCK_NAME);
                else if (!icons.includes(HEARTLOCK_NAME)) icons.push(HEARTLOCK_NAME);
            }
            return icons;
        });

        // ── 鎖圖示 tooltip ───────────────────────────────────────────
        try { modApi.hookFunction('InterfaceTextGet', 2, (args, next) => { const key = String(args[0] ?? ''); if (key === HEARTLOCK_NAME) return T('lockedBy', HEARTLOCK_NAME); return next(args); }); } catch {}
        try {
            modApi.hookFunction('ElementButton.Create', 11, (args, next) => {
                const result = next(args);
                setTimeout(() => { try { document.querySelectorAll(`[id$="icon-li-${HEARTLOCK_NAME}"]`).forEach(li => { if (!li.textContent?.trim()) li.textContent = T('lockedBy', HEARTLOCK_NAME); }); } catch {} }, 0);
                return result;
            });
        } catch {}

        // ── PickLock 隱藏 ─────────────────────────────────────────────
        modApi.hookFunction('DialogMenuButtonBuild', 0, (args, next) => {
            next(args);
            const C = args[0], gn = C?.FocusGroup?.Name;
            const item = gn ? InventoryGet?.(C, gn) : null;
            if (item?.Property?.Name === HEARTLOCK_NAME) {
                for (let i = DialogMenuButton.length - 1; i >= 0; i--)
                    if (typeof DialogMenuButton[i] === 'string' && DialogMenuButton[i].startsWith('PickLock')) DialogMenuButton.splice(i, 1);
            }
        });

        // ── InventoryUnlock 攔截 ──────────────────────────────────────
        modApi.hookFunction('InventoryUnlock', 10, (args, next) => {
            if (state._timerUnlocking) { state._unlocking = true; const result = next(args); state._unlocking = false; return result; }
            const C = args[0], itemOrGrp = args[1];
            const item = (itemOrGrp && typeof itemOrGrp === 'object') ? itemOrGrp : InventoryGet?.(C, typeof itemOrGrp === 'string' ? itemOrGrp : null);
            if (item?.Property?.Name === HEARTLOCK_NAME) {
                const gn = item.Asset?.Group?.Name, cfg = getPadlockConfig(C, gn);
                if (cfg && Number(cfg.owner) !== Number(Player.MemberNumber)) { return; }
            }
            state._unlocking = true; const result = next(args); state._unlocking = false;
            return result;
        });

        // ── ChatRoomSyncItem ──────────────────────────────────────────
        modApi.hookFunction('ChatRoomSyncItem', 0, (args, next) => {
            state._inServerSync = true;
            const data = args[0], grp = data?.Item?.Group, src = data?.Source;
            if (grp && src && ensureStorage()) {
                const cfg2 = Player.HeartLock?.padlocks?.[grp];
                if (cfg2 && Number(src) === Number(cfg2.owner) && !data?.Item?.Name) { deleteConfig(grp); }
            }
            const result = next(args); state._inServerSync = false;
            return result;
        });

        // ── ChatRoomSyncCharacter ─────────────────────────────────────
        modApi.hookFunction('ChatRoomSyncCharacter', 1, (args, next) => {
            const data = args[0];
            state._inServerSync = true; const result = next(args); state._inServerSync = false;
            if (data?.Character?.MemberNumber !== Player.MemberNumber) return result;
            if (!ensureStorage() || grabStateChar.state) return result;
            const sourceMember = data?.SourceMemberNumber;
            const padlocks = Player.HeartLock?.padlocks ?? {};
            let anyRestored = false;
            for (const gn of Object.keys(padlocks)) {
                const cfg = padlocks[gn], item = InventoryGet?.(Player, gn);
                const broken = !item || item.Property?.Name !== HEARTLOCK_NAME || item.Property?.LockedBy !== HSLOCK_NAME;
                if (broken) {
                    if (sourceMember != null && Number(sourceMember) === Number(cfg.owner)) { deleteConfig(gn); continue; }
                    if (sourceMember != null && Number(sourceMember) === Player.MemberNumber && Number(cfg.owner) === Player.MemberNumber) { deleteConfig(gn); continue; }
                    grabStateChar.count++;
                    if (grabStateChar.count === 1) grabStateChar.firstTriggerTime = Date.now();
                    if (grabStateChar.count > 3 && Date.now() - grabStateChar.firstTriggerTime < GRAB_WINDOW_MS) {
                        grabStateChar.state = true; grabStateChar.count = 0;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('protectDisabled', nick, HEARTLOCK_NAME) }] }); } catch {}
                        setTimeout(() => { grabStateChar.state = false; grabStateChar.count = 0; }, GRAB_COOLDOWN_MS);
                        return result;
                    }
                    restoreLockFromConfig(gn, cfg); anyRestored = true;
                } else { grabStateChar.count = 0; }
            }
            if (anyRestored) {
                setTimeout(() => {
                    try { ChatRoomCharacterUpdate?.(Player); } catch {}
                    const now = Date.now();
                    if (now - state._lastRestoreMsg > 2000) {
                        state._lastRestoreMsg = now;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('resistRestore', nick, HEARTLOCK_NAME) }] }); } catch {}
                    }
                }, 300);
            }
            return result;
        });

        // ── ChatRoomSyncSingle ────────────────────────────────────────
        modApi.hookFunction('ChatRoomSyncSingle', 1, (args, next) => {
            const data = args[0], result = next(args);
            if (data?.Character?.MemberNumber !== Player.MemberNumber) return result;
            if (!ensureStorage() || grabStateSingle.state) return result;
            const sourceMember = data?.SourceMemberNumber;
            const padlocks = Player.HeartLock?.padlocks ?? {};
            let anyRestored = false;
            for (const gn of Object.keys(padlocks)) {
                const cfg = padlocks[gn], item = InventoryGet?.(Player, gn);
                const broken = !item || item.Property?.Name !== HEARTLOCK_NAME || item.Property?.LockedBy !== HSLOCK_NAME;
                if (broken) {
                    if (sourceMember != null && Number(sourceMember) === Number(cfg.owner)) { deleteConfig(gn); continue; }
                    if (sourceMember != null && Number(sourceMember) === Player.MemberNumber && Number(cfg.owner) === Player.MemberNumber) { deleteConfig(gn); continue; }
                    grabStateSingle.count++;
                    if (grabStateSingle.count === 1) grabStateSingle.firstTriggerTime = Date.now();
                    if (grabStateSingle.count > 3 && Date.now() - grabStateSingle.firstTriggerTime < GRAB_WINDOW_MS) {
                        grabStateSingle.state = true; grabStateSingle.count = 0;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('protectDisabled', nick, HEARTLOCK_NAME) }] }); } catch {}
                        setTimeout(() => { grabStateSingle.state = false; grabStateSingle.count = 0; }, GRAB_COOLDOWN_MS);
                        return result;
                    }
                    restoreLockFromConfig(gn, cfg); anyRestored = true;
                } else { grabStateSingle.count = 0; }
            }
            if (anyRestored) {
                setTimeout(() => {
                    try { ChatRoomCharacterUpdate?.(Player); } catch {}
                    const now = Date.now();
                    if (now - state._lastRestoreMsg > 2000) {
                        state._lastRestoreMsg = now;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('resistRestore', nick, HEARTLOCK_NAME) }] }); } catch {}
                    }
                }, 300);
            }
            return result;
        });

        // ── CharacterReleaseTotal 攔截 ────────────────────────────────
        modApi.hookFunction('CharacterReleaseTotal', 10, (args, next) => {
            const C = args[0];
            if (!C?.Appearance) return next(args);
            const snapshots = [];
            C.Appearance.forEach(item => {
                if (item?.Property?.Name !== HEARTLOCK_NAME) return;
                const gn = item.Asset?.Group?.Name, cfg = getPadlockConfig(C, gn);
                if (!cfg) return;
                snapshots.push({ gn, prop: JSON.parse(JSON.stringify(item.Property)) });
            });
            const result = next(args);
            snapshots.forEach(({ gn, prop }) => {
                const item = C.Appearance?.find(i => i.Asset?.Group?.Name === gn);
                if (item) Object.assign(item.Property ?? (item.Property = {}), prop);
            });
            if (snapshots.length > 0 && C.IsPlayer?.()) { try { ChatRoomCharacterUpdate?.(C); } catch {} }
            return result;
        });

        setupOrgasmHook(modApi);
    }

    // ═══════════════════════════════════════════
    //  初始化
    // ═══════════════════════════════════════════
    async function initialize() {
        if (state.initialized) return;

        // Phase 1：等 bcModSdk 或 EL 的共用 modApi（無超時）
        // EL 載入時：等 window.ELAbundantiaAPI.modApi 出現
        // EL 未載入時：等 bcModSdk 本身
        const sdkReady = await waitFor(
            () => !!window.ELAbundantiaAPI?.modApi || !!window.bcModSdk,
            600000
        );
        if (!sdkReady) { console.error('[HeartLock] ModSDK / EL timeout.'); return; }

        const modApi = getModApi();
        if (!modApi) { console.error('[HeartLock] modApi unavailable.'); return; }

        // Phase 2：等玩家登入 + 遊戲資源就緒
        const gameReady = await waitFor(() => !!window.Player?.AccountName && !!window.AssetFemale3DCG, 600000);
        if (!gameReady) { console.error('[HeartLock] Game load timeout.'); return; }

        createHeartLockAsset();
        patchFunctions(modApi);
        await waitFor(() => window.Player?.ExtensionSettings !== undefined, 30000);
        ensureStorage();
        saveAndSync();
        reapplyFromAppearance();
        startVibeTimer();
        startTimerCheck();
        setInterval(checkLockIntegrity, 3000);
        state.initialized = true;
        log('HeartLock v2.1.1 (EL Edition) initialized.');
    }

    initialize().catch(e => console.error('[HeartLock] init error', e));
})();
