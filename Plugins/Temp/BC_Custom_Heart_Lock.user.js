// ==UserScript==
// @name         BC Heart Lock Extension
// @name:zh      BC 心形鎖拓展
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @supportURL   https://github.com/awdrrawd/liko-Plugin-Repository
// @author       Likolisu
// @version      2.6.0
// @description  Heart Padlock for Bondage Club with AFC lover integration
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @run-at       document-end
// @grant        none
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

(function () {
    window.Liko = window.Liko ?? {};
    if (window.Liko.AFC_HeartLock) return;
    const MOD_VER = '2.6.0';
    window.Liko.AFC_HeartLock = MOD_VER;

    const HEARTLOCK_NAME   = 'Heart Padlock';
    const HSLOCK_NAME      = 'HighSecurityPadlock';
    const MOD_NAME         = 'HeartLockBC';
    const EXT_KEY          = 'AFC_HeartLock';
    const EXT_KEY_OLD      = 'HeartLock';   // 舊 key，搬遷後刪除（短期輔助，未來移除）
    const HEARTKEY_IMAGE   = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/main/Images/Heart_key.png';
    const HEARTLOCK_IMAGE  = 'https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/main/Images/Heart_Lock.png';
    const VIBE_INTERVAL_MS = 5000;
    const MAX_TEXT         = 500; //note最大字數
    const VIBE_MSG_CYCLE   = 12;  // 12 × 5s = 60 秒發一次震動訊息

    const PX = 1110; const PY  = 15;
    const PW = 870;  const PH  = 950;
    const TAB_H = 60; const TAB_W = 161;  // 5 tabs × 161 ≈ 808px = (CLOSE_X - PX)
    const CX = PX + 20; const CY = PY + TAB_H + 10;
    const CW = PW - 40; const CH = PH - TAB_H - 10;
    const TAB_OVERVIEW = 'overview';
    const TAB_NOTE     = 'note';
    const TAB_TIMER    = 'timer';
    const TAB_CONTROL  = 'control';
    const TAB_UNLOCK   = 'unlock';
    const TABS = [TAB_OVERVIEW, TAB_NOTE, TAB_TIMER, TAB_CONTROL, TAB_UNLOCK];

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
            tabTimer       : '計時器',    tabControl     : '控制',    tabUnlock : '解鎖',
            unlockTitle    : '♥ 解鎖確認 ♥',
            unlockWarn1    : '解鎖後，所有設定（筆記、計時器、震動設定）將永久刪除，',
            unlockWarn2    : '請確認對方同意解開此鎖。',
            unlockOwner    : '鎖主：',
            unlockNoRight  : '只有鎖主或與穿戴者的戀人才能解鎖。',
            unlockConfirm  : '確認解鎖',
            unlockCancel   : '取消',
            unlockPending  : '已發送解鎖請求給鎖主，請等待…',
            unlockDone     : '{0}解開了{1}身上的{2}。',
            noteTitle      : '♥ 愛情筆記 ♥',    timerTitle  : '♥ 計時器 ♥',
            controlTitle   : '♥ 控制 ♥',         noteHeader  : '♥ 筆記 ♥',
            noConfig       : '尚無設定。',         noTimer     : '無計時器',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : '只有鎖主可以編輯。',
            ownerOnlyTimer : '只有鎖主可以設置計時器。',
            ownerOnlyCtrl  : '只有鎖主可以更改設定。',
            maxChars       : `最多 ${MAX_TEXT} 字`,        editNote    : '✏ 編輯筆記',
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
            pendingRestore : '{0}身上的{1}因相依物件（如 Echo 拘束）尚未載入而無法復原，將於下次登入或刷新遊戲後自動嘗試。',
            timerExpired   : '{0}身上的{1}隨約定時刻到來，化作點點微光悄然消散。',
            removeRestraints   : '時間到時移除拘束',
            removeRestraintsSub: '(同時移除所有被鎖住的拘束物品)',
            lockedBy       : '被{0}鎖住了',          memberNum   : '成員編號：',
            lockedLabel    : '鎖定：',               vibeLabel   : '震動：',
            controlLabel   : '高潮控制：',            vibeOff     : '關閉',
            vibeLow        : '低 ♥',                  vibeMid     : '中 ♥♥',
            vibeHigh       : '高 ♥♥♥',               modeNormal  : '正常',
            modeEdge       : '邊緣 ～',               modeDeny    : '拒絕 ✕',
        },
        EN: {
            tabOverview    : 'Overview',  tabNote        : 'Note',
            tabTimer       : 'Timer',     tabControl     : 'Control',  tabUnlock : 'Unlock',
            unlockTitle    : '♥ Unlock Confirm ♥',
            unlockWarn1    : 'Unlocking will permanently delete all settings (notes, timer, vibe).',
            unlockWarn2    : 'Please confirm that the wearer agrees to unlock.',
            unlockOwner    : 'Lock owner:',
            unlockNoRight  : 'Only the lock owner or the wearer\'s lovers can unlock.',
            unlockConfirm  : 'Confirm Unlock',
            unlockCancel   : 'Cancel',
            unlockPending  : 'Unlock request sent to owner, please wait…',
            unlockDone     : '{0} unlocked the {2} on {1}.',
            noteTitle      : '♥ Love Note ♥',       timerTitle  : '♥ Timer ♥',
            controlTitle   : '♥ Control ♥',          noteHeader  : '♥ Note ♥',
            noConfig       : 'No configuration.',    noTimer     : 'No timer',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Only the lock owner can edit.',
            ownerOnlyTimer : 'Only the lock owner can set the timer.',
            ownerOnlyCtrl  : 'Only the lock owner can change settings.',
            maxChars       : `max ${MAX_TEXT} chars`,         editNote    : '✏ Edit Note',
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
            pendingRestore : 'The {1} on {0} cannot be restored yet because a dependent item (e.g. an Echo restraint) has not loaded. It will retry on next login or page refresh.',
            timerExpired   : 'The {1} on {0} dissolves into a gentle shimmer as the promised moment arrives.',
            removeRestraints   : 'Remove restraints on expiry',
            removeRestraintsSub: '(Also removes all locked restraint items)',
            lockedBy       : 'Locked by {0}',         memberNum   : 'Member #:',
            lockedLabel    : 'Locked:',               vibeLabel   : 'Vibe:',
            controlLabel   : 'Control:',              vibeOff     : 'Off',
            vibeLow        : 'Low ♥',                  vibeMid     : 'Med ♥♥',
            vibeHigh       : 'High ♥♥♥',              modeNormal  : 'Normal',
            modeEdge       : 'Edge ～',                modeDeny    : 'Deny ✕',
        },
        DE: {
            tabOverview    : 'Übersicht',  tabNote       : 'Notiz',
            tabTimer       : 'Timer',      tabControl    : 'Kontrolle',  tabUnlock : 'Entsperren',
            unlockTitle    : '♥ Entsperren bestätigen ♥',
            unlockWarn1    : 'Das Entsperren löscht alle Einstellungen (Notizen, Timer, Vibration) dauerhaft.',
            unlockWarn2    : 'Bitte bestätigen, dass der Träger dem Entsperren zustimmt.',
            unlockOwner    : 'Schlossbesitzer:',
            unlockNoRight  : 'Nur der Schlossbesitzer oder Liebhaber kann entsperren.',
            unlockConfirm  : 'Entsperren bestätigen',
            unlockCancel   : 'Abbrechen',
            unlockDone     : '{0} hat {2} von {1} entsperrt.',
            noteTitle      : '♥ Liebesnotiz ♥',  timerTitle  : '♥ Timer ♥',
            controlTitle   : '♥ Kontrolle ♥',    noteHeader  : '♥ Notiz ♥',
            noConfig       : 'Keine Konfiguration.',    noTimer     : 'Kein Timer',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Nur der Schlossbesitzer kann bearbeiten.',
            ownerOnlyTimer : 'Nur der Schlossbesitzer kann den Timer setzen.',
            ownerOnlyCtrl  : 'Nur der Schlossbesitzer kann Einstellungen ändern.',
            maxChars       : `max ${MAX_TEXT} Zeichen`,  editNote    : '✏ bearbeiten',
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
            tabTimer       : 'Minuterie', tabControl    : 'Contrôle',  tabUnlock : 'Déverrouiller',
            unlockTitle    : '♥ Confirmer le déverrouillage ♥',
            unlockWarn1    : 'Le déverrouillage supprimera définitivement tous les paramètres.',
            unlockWarn2    : 'Confirmez que le porteur accepte de déverrouiller.',
            unlockOwner    : 'Propriétaire :',
            unlockNoRight  : 'Seul le propriétaire ou les amants peuvent déverrouiller.',
            unlockConfirm  : 'Confirmer',
            unlockCancel   : 'Annuler',
            unlockDone     : '{0} a déverrouillé le {2} de {1}.',
            noteTitle      : '♥ Note d\'amour ♥',  timerTitle  : '♥ Minuterie ♥',
            controlTitle   : '♥ Contrôle ♥',       noteHeader  : '♥ Note ♥',
            noConfig       : 'Aucune configuration.',  noTimer  : 'Pas de minuterie',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Seul le propriétaire peut modifier.',
            ownerOnlyTimer : 'Seul le propriétaire peut définir la minuterie.',
            ownerOnlyCtrl  : 'Seul le propriétaire peut modifier les paramètres.',
            maxChars       : `max ${MAX_TEXT} caractères`,  editNote   : '✏ Modifier',
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
            tabTimer       : 'Таймер',     tabControl    : 'Контроль',  tabUnlock : 'Открыть',
            unlockTitle    : '♥ Подтверждение открытия ♥',
            unlockWarn1    : 'Открытие навсегда удалит все настройки (заметки, таймер, вибрацию).',
            unlockWarn2    : 'Подтвердите, что носитель согласен на открытие замка.',
            unlockOwner    : 'Владелец замка:',
            unlockNoRight  : 'Только владелец или возлюбленный могут открыть замок.',
            unlockConfirm  : 'Подтвердить',
            unlockCancel   : 'Отмена',
            unlockDone     : '{0} открыл(а) {2} на {1}.',
            noteTitle      : '♥ Любовная записка ♥',  timerTitle  : '♥ Таймер ♥',
            controlTitle   : '♥ Контроль ♥',           noteHeader  : '♥ Заметка ♥',
            noConfig       : 'Нет настроек.',           noTimer     : 'Без таймера',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Только владелец замка может редактировать.',
            ownerOnlyTimer : 'Только владелец замка может задать таймер.',
            ownerOnlyCtrl  : 'Только владелец замка может изменять настройки.',
            maxChars       : `макс ${MAX_TEXT} символов`,  editNote    : '✏ Редактировать',
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
            tabTimer       : 'Таймер',     tabControl    : 'Контроль',  tabUnlock : 'Відкрити',
            unlockTitle    : '♥ Підтвердження відкриття ♥',
            unlockWarn1    : 'Відкриття назавжди видалить усі налаштування (нотатки, таймер, вібрацію).',
            unlockWarn2    : 'Підтвердіть, що носій погоджується відкрити замок.',
            unlockOwner    : 'Власник замка:',
            unlockNoRight  : 'Лише власник або коханий можуть відкрити замок.',
            unlockConfirm  : 'Підтвердити',
            unlockCancel   : 'Скасувати',
            unlockDone     : '{0} відкрив(ла) {2} на {1}.',
            noteTitle      : '♥ Любовна нотатка ♥',  timerTitle  : '♥ Таймер ♥',
            controlTitle   : '♥ Контроль ♥',          noteHeader  : '♥ Нотатка ♥',
            noConfig       : 'Немає конфігурації.',    noTimer     : 'Без таймера',
            noTimerSet     : 'N/A',
            ownerOnlyEdit  : 'Лише власник замка може редагувати.',
            ownerOnlyTimer : 'Лише власник замка може встановити таймер.',
            ownerOnlyCtrl  : 'Лише власник замка може змінювати налаштування.',
            maxChars       : `макс ${MAX_TEXT} символів`,  editNote    : '✏ Редагувати',
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

    const CLOSE_X = PX + PW - 62;  // 右邊對齊 PX+PW，x=1908
    const CLOSE_Y = PY + 2;         // y=132（JSON 確認值）
    const CLOSE_W = 62;             // w=62（JSON 確認值）
    const CLOSE_H = 62;             // h=62（JSON 確認值）

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
    const NOTE_OVERLAY_ID = 'HeartLockNoteOverlay';
    const NOTE_BTN_Y    = NOTE_BOX_Y + NOTE_BOX_H + 14;
    const NOTE_BTN_H    = 54;
    const NOTE_BTN_W    = 200;
    const NOTE_SAVE_X   = CX + CW - NOTE_BTN_W;
    const NOTE_CANCEL_X = CX + CW - NOTE_BTN_W * 2 - 16;

    function closeNoteOverlay() {
        document.getElementById(NOTE_OVERLAY_ID)?.remove();
    }

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
            timerInput: 0, noteEditing: false, ctlEditing: false, noteDraft: null,
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
     * 判斷 Player 是否能替 C 上心鎖。
     * 所有條件都以 C 的 lockPerms 為準（穿戴者的選擇）。
     */
    /**
     * 判斷 Player 是否能對 ch 上鎖。
     * 讀穿戴者 ch 的 OnlineSharedSettings（公開資料，伺服器直接提供）。
     * lockPerms 控制穿戴者允許哪些關係使用心鎖；
     * 關係從 ch.Lovership / ch.Ownership / ch.OnlineSharedSettings.AFC.lovers 判斷。
     */
    function isAllowedToLock(ch) {
        if (!ch?.MemberNumber) return false;
        const meNum     = Number(Player.MemberNumber);
        const lockPerms = ch.OnlineSharedSettings?.AFC?.lockPerms;

        // 主人（enableOwnerLock）
        if (lockPerms?.enableOwnerLock) {
            const ownerNum = ch.Ownership?.MemberNumber;
            if (ownerNum != null && Number(ownerNum) === meNum) return true;
        }

        if (!lockPerms?.enableAFCLock) {
            log(`isAllowedToLock: ❌ enableAFCLock=false (ch=${ch.MemberNumber})`);
            return false;
        }

        // 優先使用 AFC API（若已載入）
        if (typeof window.AFC?.api?.canUseHeartLock === 'function')
            return window.AFC.api.canUseHeartLock(ch);

        // Fallback：直接讀 OnlineSharedSettings
        const afcLovers = ch.OnlineSharedSettings?.AFC?.lovers ?? [];
        if (afcLovers.some(l => Number(l.memberNumber) === meNum)) return true;
        if (ch.Lovership?.some(l => Number(l.MemberNumber) === meNum)) return true;

        return false;
    }

    /**
     * 判斷 Player 是否能解開 C 身上的心鎖。
     * 邏輯與上鎖相同，但 cfg.owner 始終可解鎖。
     */

    // ═══════════════════════════════════════════
    //  工具
    // ═══════════════════════════════════════════
    function log(...a) { console.log('🐈‍⬛ [HeartLock]', ...a); }
    function clone(v)  { return JSON.parse(JSON.stringify(v)); }
    function wait(ms)  { return new Promise(r => setTimeout(r, ms)); }
    async function waitFor(fn, timeout = 0, interval = 100) {
        const start = Date.now();
        while (true) {
            try { if (fn()) return true; } catch {}
            if (timeout > 0 && Date.now() - start > timeout) return false;
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
    const DEFAULT_STORAGE = { debug: false, previewImage: HEARTLOCK_IMAGE, padlocks: {}, updatedAt: 0 };

    // 因相依物件（如 Echo 拘束）尚未載入而無法復原的部位 → 暫掛，下次登入/刷新再試，不定時重試/洗版
    const _pendingRestore = new Set();

    function ensureStorage() {
        if (!window.Player) return false;
        if (!Player.ExtensionSettings) Player.ExtensionSettings = {};
        const es = Player.ExtensionSettings;
        // 一次性搬遷：舊 key 'HeartLock' → 'AFC_HeartLock'（保留作用中的鎖設定）
        if (es[EXT_KEY_OLD] !== undefined) {
            if ((!es[EXT_KEY] || typeof es[EXT_KEY] !== 'object') && typeof es[EXT_KEY_OLD] === 'object')
                es[EXT_KEY] = es[EXT_KEY_OLD];
            delete es[EXT_KEY_OLD];
            try { ServerAccountUpdate?.QueueData?.({ ExtensionSettings: Player.ExtensionSettings }, true); } catch {}
        }
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
        Player.HeartLock.updatedAt = Date.now();   // 任何上鎖/解鎖/設定變動都更新時間戳
        try { if (typeof ServerPlayerExtensionSettingsSync === 'function') ServerPlayerExtensionSettingsSync(EXT_KEY); } catch {}
        _hlLsWrite();   // 同步寫一份本地存底 DB
        broadcastStorage();
    }

    // ═══════════════════════════════════════════
    //  本地存底 DB（localStorage）+ 啟動對帳
    //  抗「ExtensionSettings 整欄被清空 / 被初始化」與「跨裝置復原」的衝突。
    // ═══════════════════════════════════════════
    function _hlLsKey() { return 'HL_DB::' + (Player?.AccountName ?? Player?.MemberNumber ?? 'anon'); }

    function _hlLsWrite() {
        try {
            localStorage.setItem(_hlLsKey(), JSON.stringify({
                ts:   Player.HeartLock?.updatedAt ?? 0,
                data: clone(Player.HeartLock),
            }));
        } catch {}
    }
    function _hlLsRead() {
        try { const raw = localStorage.getItem(_hlLsKey()); return raw ? JSON.parse(raw) : null; } catch { return null; }
    }

    // 鎖狀態指紋：部位 + 鎖主 + lockId + 計時 + 設定（用於判斷兩份資料是否一致）
    function _hlNormalize(s) {
        const p = s?.padlocks ?? {};
        return Object.keys(p).sort().map(gn => {
            const c = p[gn] ?? {};
            return `${gn}:${c.owner}:${c.lockId ?? ''}:${c.unlockTime ?? ''}:${c.vibe ?? ''}:${c.orgasmMode ?? ''}`;
        }).join('|');
    }
    function _hlStorageEqual(a, b) { return _hlNormalize(a) === _hlNormalize(b); }

    function _hlAdoptDB(data) {
        if (!data || typeof data !== 'object') return;
        Player.ExtensionSettings[EXT_KEY] = clone(data);
        if (!Player.ExtensionSettings[EXT_KEY].padlocks) Player.ExtensionSettings[EXT_KEY].padlocks = {};
        Player.HeartLock = Player.ExtensionSettings[EXT_KEY];
        saveAndSync();                         // 會 bump updatedAt 並回寫 DB，使兩邊一致
        try { reapplyFromAppearance(); } catch {}
        try { CharacterRefresh?.(Player, false); ChatRoomCharacterUpdate?.(Player); } catch {}
    }

    function reconcileHLStorage() {
        if (!ensureStorage()) return;
        const db = _hlLsRead();
        const serverTs    = Player.HeartLock?.updatedAt ?? 0;
        const serverLocks = Object.keys(Player.HeartLock?.padlocks ?? {}).length;

        if (!db) {
            // 本機沒有 DB（換裝置 / 初次）→ 若伺服器有資料就建立 DB，不警告
            if (serverTs > 0 || serverLocks > 0) _hlLsWrite();
            return;
        }
        const dbTs    = db.ts ?? 0;
        const dbLocks = Object.keys(db.data?.padlocks ?? {}).length;

        // 情況1：伺服器時間戳為 0/null（被初始化）但 DB 有鎖 → 全部一起壞，直接抓 DB
        if ((serverTs === 0 || serverTs == null) && dbLocks > 0) {
            log('reconcile: server updatedAt is 0/null but local DB has locks → restoring from DB');
            _hlAdoptDB(db.data);
            return;
        }
        // 情況2：伺服器時間比 DB 舊（可能在別的裝置復原過）→ 比對，不一致就採用最新（DB）
        //   理由：若 BUG 當下重新上/解鎖，時間戳會更新到現在，不可能比 DB 舊。
        if (serverTs < dbTs && !_hlStorageEqual(Player.HeartLock, db.data)) {
            log('reconcile: server older than DB and differs → adopting DB (newest)');
            _hlAdoptDB(db.data);
            return;
        }
        // 否則伺服器較新或相等 → 以伺服器為準，更新 DB 時間戳
        _hlLsWrite();
    }

    // ── 解鎖輔助（直接操作 Property，繞過 InventoryUnlock hook 干擾）──
    /** 解除自己身上指定部位的心鎖。回傳是否確實解了一個心鎖。 */
    function _unlockSelfItem(gn, removeRestraint = false) {
        const item = InventoryGet?.(Player, gn);
        let unlocked = false;
        if (item?.Property) {
            const isHL = item.Property.Name === HEARTLOCK_NAME
                || (item.Property.LockedBy === HSLOCK_NAME && item.Property.HeartLockId);
            if (isHL) {
                if (typeof ValidationDeleteLock === 'function') ValidationDeleteLock(item.Property, false);
                delete item.Property.Name;
                delete item.Property.HeartLockId;
                const keys = Object.keys(item.Property);
                if (keys.length === 0 || (keys.length === 1 && keys[0] === 'Effect' && !item.Property.Effect?.length))
                    item.Property = undefined;
                unlocked = true;
            }
        }
        if (item && removeRestraint) {
            try { state._timerUnlocking = true; InventoryRemove?.(Player, gn, false); }
            finally { state._timerUnlocking = false; }
        }
        return unlocked;
    }

    /** 移除自己身上指定部位的心鎖並刪除其設定。 */
    function removeLock(groupName, { removeRestraint = false } = {}) {
        if (!groupName || !ensureStorage()) return false;
        state._unlocking = true;   // 抑制 integrity 還原
        try {
            _unlockSelfItem(groupName, removeRestraint);
            delete Player.HeartLock.padlocks[groupName];
            saveAndSync();
            try { CharacterRefresh?.(Player, false); ChatRoomCharacterUpdate?.(Player); } catch {}
        } finally { state._unlocking = false; }
        return true;
    }

    /** 清除自己身上所有心鎖與其設定（防作弊 integrity 不會還原）。回傳清除數量。 */
    function clearAllLocks({ removeRestraints = false } = {}) {
        if (!ensureStorage()) return 0;
        state._unlocking = true;
        let count = 0;
        try {
            for (const gn of Object.keys(Player.HeartLock.padlocks ?? {}))
                if (_unlockSelfItem(gn, removeRestraints)) count++;
            Player.HeartLock.padlocks = {};
            saveAndSync();
            try { CharacterRefresh?.(Player, false); ChatRoomCharacterUpdate?.(Player); } catch {}
        } finally { state._unlocking = false; }
        log(`clearAllLocks: cleared ${count} lock(s)`);
        return count;
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
                Type: 'Hidden', Content: 'HeartLock::Sync',
                Dictionary: [{ Tag: 'HeartLock::Data', Data: clone(Player.HeartLock) }],
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
                    Type: 'Hidden', Content: 'HeartLock::Update',
                    Dictionary: [{ Tag: 'HeartLock::Update', Target: character.MemberNumber, Group: groupName, Config: patch }],
                });
            } catch {}
        }
    }

    function notifyRemove(character, groupName) {
        if (character.IsPlayer()) { deleteConfig(groupName); return; }
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Hidden', Content: 'HeartLock::Remove',
                Dictionary: [{ Tag: 'HeartLock::Remove', Target: character.MemberNumber, Group: groupName }],
            });
        } catch {}
    }

    function handleHidden(data) {
        if (!data || data.Type !== 'Hidden') return;
        if (data.Content === 'HeartLockRequest') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLockRequest');
            if (e?.Target === Player.MemberNumber) broadcastStorage();
        }
        if (data.Content === 'HeartLock::Sync') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLock::Data');
            if (e) {
                const s = ChatRoomCharacter?.find(c => c.MemberNumber === data.Sender);
                if (s) {
                    s.HeartLock = e.Data;
                    // 只有面板正在顯示該角色的鎖時才刷新，避免無關廣播觸發不必要的重繪
                    if (s.MemberNumber === state.panel.targetChar?.MemberNumber) {
                        hlRefreshCurrentTab();
                    }
                }
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
        if (data.Content === 'HeartLock::Update') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLock::Update');
            if (!e || e.Target !== Player.MemberNumber) return;
            if (!ensureStorage()) return;
            const p = Player.HeartLock.padlocks;
            if (p[e.Group]) { Object.assign(p[e.Group], e.Config); saveAndSync(); }
        }
        if (data.Content === 'HeartLock::Remove') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLock::Remove');
            if (!e || e.Target !== Player.MemberNumber) return;
            deleteConfig(e.Group);
        }
        // 非 owner 的 EL/BC 戀人請求解鎖
        // owner 收到後檢查 Requester 是否有權，若有則替代執行 InventoryUnlock
        if (data.Content === 'HeartLock::Unlock::Done') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLock::Unlock::Done');
            if (!e || e.Target !== Player.MemberNumber) return;
            // 解鎖已完成，清除 pending 並關閉面板
            state.panel.unlockPending = false;
            hideNoteTA();
            state.panel.noteEditing = false;
            state.panel.ctlEditing  = false;
            DialogFocusItem = null;
        }
        if (data.Content === 'HeartLock::Unlock::Request') {
            const e = data.Dictionary?.find(d => d.Tag === 'HeartLock::Unlock::Request');
            if (!e) return;
            if (!ensureStorage()) return;
            const gn  = e.Group;
            const cfg = Player.HeartLock?.padlocks?.[gn];
            if (!cfg || Number(cfg.owner) !== Number(Player.MemberNumber)) return;
            const requester = e.Requester;
            const wearerNum = e.WearerMemberNumber;
            const wearer    = ChatRoomCharacter?.find(c => c.MemberNumber === wearerNum);
            if (!wearer) return;
            const wearerAFCLovers = wearer.OnlineSharedSettings?.AFC?.lovers ?? [];
            const isAFCLover = wearerAFCLovers.some(l => Number(l.memberNumber) === Number(requester));
            const isBCLovr   = wearer.Lovership?.some(l => Number(l.MemberNumber) === Number(requester)) ?? false;
            if (!isAFCLover && !isBCLovr) return;
            try {
                state._unlocking = true;
                InventoryUnlock?.(wearer, gn);
                state._unlocking = false;
                ChatRoomCharacterUpdate?.(wearer);
                deleteConfig(gn);
                log(`HeartLock::Unlock::Request: 已替 #${requester} 解鎖 ${gn}`);
                try {
                    ServerSend('ChatRoomChat', {
                        Type: 'Hidden', Content: 'HeartLock::Unlock::Done',
                        Dictionary: [{ Tag: 'HeartLock::Unlock::Done', Target: requester, Group: gn }],
                    });
                } catch {}
            } catch { state._unlocking = false; }
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

    /**
     * 判斷 Player 是否有資格解開 C 身上的 HeartLock。
     * owner 始終可解鎖；戀人需穿戴者開啟 enableAFCLock；主人需開啟 enableOwnerLock。
     */
    function isAllowedToUnlock(C, cfg) {
        if (!C || !cfg) return false;
        const meNum = Number(Player.MemberNumber);
        // 掛鎖者始終可解鎖
        if (Number(cfg.owner) === meNum) return true;
        const lockPerms = C.OnlineSharedSettings?.AFC?.lockPerms;
        // 主人（需 enableOwnerLock）
        if (lockPerms?.enableOwnerLock &&
            C.Ownership?.MemberNumber != null &&
            Number(C.Ownership.MemberNumber) === meNum) return true;
        // 戀人需 enableAFCLock
        if (!lockPerms?.enableAFCLock) return false;
        // AFC 戀人
        const afcLovers = C.OnlineSharedSettings?.AFC?.lovers ?? [];
        if (afcLovers.some(l => Number(l.memberNumber) === meNum)) return true;
        // BC 原生戀人
        if (C.Lovership?.some(l => Number(l.MemberNumber) === meNum)) return true;
        return false;
    }

    // ═══════════════════════════════════════════
    //  Asset 建立
    // ═══════════════════════════════════════════
    function createHeartLockAsset() {
        if (state.assetCreated) return true;
        if (!window.AssetFemale3DCG || !window.AssetGroupGet || !window.AssetAdd || !window.InventoryAdd) return false;
        const itemMiscDef = AssetFemale3DCG.find(g => g.Group === 'ItemMisc');
        if (!itemMiscDef) return false;
        if (itemMiscDef.Asset?.find(a => a.Name === HEARTLOCK_NAME)) { state.assetCreated = true; return true; }
        const group = AssetGroupGet?.('Female3DCG', 'ItemMisc');
        if (!group) { console.error('🐈‍⬛ [HeartLock] ItemMisc group not ready, will retry.'); return false; }
        const def = { AllowType: ['LockPickSeed'], Effect: [], Extended: true, IsLock: true, Name: HEARTLOCK_NAME, PickDifficulty: 20, Time: 10, Value: 70, Wear: false };
        try {
            itemMiscDef.Asset.push(def);
            // R128: AssetAdd(Group, AssetDef, ExtendedConfig, GroupDef)
            // ExtendedConfig = null（R128 已移除 AssetFemale3DCGExtended）
            // GroupDef = 原始未編譯的 group 定義（必要的新參數）
            AssetAdd(group, def, null, itemMiscDef);
            if (Player?.Inventory && !Player.Inventory.some(i => i.Asset?.Name === HEARTLOCK_NAME))
                InventoryAdd(Player, HEARTLOCK_NAME, 'ItemMisc');
            state.assetCreated = true;
            return true;
        } catch (e) { console.error('🐈‍⬛ [HeartLock] Asset creation failed', e); return false; }
    }

    // ═══════════════════════════════════════════
    //  ModAPI — 優先共用 EL 的 modApi，否則自行註冊
    // ═══════════════════════════════════════════
    function getModApi() {
        if (state.modApi) return state.modApi;

        // HeartLock 獨立註冊 modApi（不再依賴 AFC/EL 的共用 modApi）
        if (!window.bcModSdk?.registerMod) return null;
        try {
            state.modApi = window.bcModSdk.registerMod({
                name: MOD_NAME, fullName: 'Heart Lock BC',
                version: MOD_VER, repository: "https://github.com/awdrrawd/liko-Plugin-Repository",
            });
            return state.modApi;
        } catch (e) {
            if (!window.bcModSdk.getModsInfo?.().find(m => m.name === MOD_NAME))
                console.error('🐈‍⬛ [HeartLock] registerMod failed', e);
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

    /**
     * @param {string} gn - group name
     * @param {object} cfg - padlock config
     * @param {boolean} [updateUI=true] - false = 只修資料，不動 DialogFocusItem / 面板狀態（編輯中保護）
     */
    // 相依物件尚未載入而無法復原 → 暫掛該部位，發一次性提示，停止定時重試
    function _markPendingRestore(gn) {
        if (!_pendingRestore.has(gn)) {
            _pendingRestore.add(gn);
            try {
                const nick = Player.Nickname || Player.Name;
                ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION',
                    Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION',
                                   Text: T('pendingRestore', nick, HEARTLOCK_NAME) }] });
            } catch {}
            log('restore: pending (dependent asset not loaded) for', gn);
        }
    }

    // 回傳：'ok' 成功復原 / 'pending' 相依物件未載入暫掛 / 'skip' 不需處理
    function restoreLockFromConfig(gn, cfg, updateUI = true) {
        let item = InventoryGet?.(Player, gn);
        if (!item) {
            const snap = cfg._fullSnapshot;
            if (!snap?.assetName) { _markPendingRestore(gn); return 'pending'; }
            try {
                const asset = AssetGet?.(Player.AssetFamily, gn, snap.assetName);
                if (!asset) { _markPendingRestore(gn); return 'pending'; }   // Echo 等自訂物件尚未註冊
                state._restoring = true;
                item = InventoryWear?.(Player, snap.assetName, gn, snap.color, asset.Difficulty, Player.MemberNumber, snap.craft);
                state._restoring = false;
                if (!item) item = InventoryGet?.(Player, gn);
                if (!item) { _markPendingRestore(gn); return 'pending'; }
            } catch (e) { state._restoring = false; log('restore: error', e); return 'skip'; }
        }
        if (cfg.assetName && item.Asset?.Name !== cfg.assetName) return 'skip';
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
        _pendingRestore.delete(gn);   // 復原成功 → 解除暫掛
        return 'ok';
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

        // 震動音效（只有自己聽到）
        if (Player.OnlineSharedSettings?.AFC?.enableVibeSound ?? true) {
            try { AudioPlaySoundEffect("VibrationShort"); } catch {}
        }

        state.vibeCycle = (state.vibeCycle + 1) % VIBE_MSG_CYCLE;
        if (state.vibeCycle === 0) {
            const mode = Player.OnlineSharedSettings?.AFC?.vibeMsgMode ?? 'broadcast';
            if (mode !== 'off') {
                const nick = Player.Nickname || Player.Name;
                const msg = { low: T('vibelow', nick, HEARTLOCK_NAME), mid: T('vibemid', nick, HEARTLOCK_NAME), high: T('vibehigh', nick, HEARTLOCK_NAME) }[maxStr];
                if (msg) {
                    try {
                        if (mode === 'broadcast') {
                            ServerSend('ChatRoomChat', { Type:'Action', Content:'CUSTOM_SYSTEM_ACTION', Dictionary:[{ Tag:'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text:msg }] });
                        } else {
                            // 'local' — 只有自己看到
                            ChatRoomSendLocal(msg);
                        }
                    } catch {}
                }
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
                const isHearLock = item?.Property?.Name === HEARTLOCK_NAME
                || (item?.Property?.LockedBy === HSLOCK_NAME && item?.Property?.HeartLockId);
                if (item && isHearLock) {
                    // 若要移除拘束，只移除本次心鎖對應的物品（gn），
                    // 不掃描全身，避免誤觸其他戀人的心鎖物品
                    // （在解鎖前先記錄，解鎖後 Effect:Lock 消失）
                    const willRemove = cfg.removeRestraints;

                    log(`計時器到期 gn=${gn} removeRestraints=${cfg.removeRestraints}`);

                    // 直接操作 Property，繞過 InventoryUnlock hook 的干擾
                    if (item.Property) {
                        if (typeof ValidationDeleteLock === 'function')
                            ValidationDeleteLock(item.Property, false);
                        delete item.Property.Name;
                        delete item.Property.HeartLockId;
                        const keys = Object.keys(item.Property);
                        if (keys.length === 0 || (keys.length === 1 && keys[0] === 'Effect' && !item.Property.Effect?.length))
                            item.Property = undefined;
                    }

                    // 移除物品本身（_timerUnlocking 讓 hook 放行）
                    if (willRemove) {
                        try {
                            state._timerUnlocking = true;
                            InventoryRemove?.(Player, gn, false);
                            state._timerUnlocking = false;
                        } catch { state._timerUnlocking = false; }
                    }

                    CharacterRefresh?.(Player, false);
                    ChatRoomCharacterUpdate?.(Player);
                    const nick = Player.Nickname || Player.Name;
                    try { ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('timerExpired', nick, HEARTLOCK_NAME) }] }); } catch {}
                }
            } catch (e) { log('checkTimers error: ' + e.message); }
            deleteConfig(gn);
        }
    }

    // ═══════════════════════════════════════════
    //  Note TextArea
    // ═══════════════════════════════════════════
    function showNoteTA(restoreText) {
        if (!document.getElementById(NOTE_TA_ID)) ElementCreateTextArea(NOTE_TA_ID);
        const el = document.getElementById(NOTE_TA_ID);
        if (el) {
            el.style.display = '';
            el.maxLength = MAX_TEXT;
            if (restoreText !== undefined) el.value = restoreText;
        }
        ElementPositionFixed(NOTE_TA_ID, CX, NOTE_BOX_Y, CW, NOTE_BOX_H);
    }
    function hideNoteTA() {
        const el = document.getElementById(NOTE_TA_ID);
        if (el) { el.style.display = 'none'; el.value = ''; }
        state.panel.noteDraft = null;
    }
    function getNoteTAValue() { return document.getElementById(NOTE_TA_ID)?.value ?? state.panel.noteDraft ?? ''; }
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
            const tabLabels = { [TAB_OVERVIEW]: T('tabOverview'), [TAB_NOTE]: T('tabNote'), [TAB_TIMER]: T('tabTimer'), [TAB_CONTROL]: T('tabControl'), [TAB_UNLOCK]: T('tabUnlock') };
            DrawText(tabLabels[tab] ?? tab, tx+TAB_W/2-1, PY+TAB_H/2, sel ? CC.text : CC.sub, 'transparent');
        });
        DrawRect(PX, PY+TAB_H, PW, 2, CC.border);
        bRect(CLOSE_X, CLOSE_Y, CLOSE_W, CLOSE_H, CC.danger, '✕');
    }

    // ═══════════════════════════════════════════
    //  DOM 面板（完整替換 canvas 面板）
    //  與 DialogFocusItem 生命週期完全脫鉤，
    //  玩家進出房間不會中斷檢查狀態。
    // ═══════════════════════════════════════════

    function _canUnlockHeartLock(ch, cfg) { return isAllowedToUnlock(ch, cfg); }

    const HL_PANEL_ID = 'HeartLockDOMPanel';
    let   _hlTimer    = null;

    function _hlScaleFactor() {
        const c = document.getElementById('MainCanvas');
        return c ? c.getBoundingClientRect().width / 2000 : 1;
    }
    function _repositionHLPanel() {
        const sc = _hlScaleFactor();
        const c  = document.getElementById('MainCanvas');
        const r  = c?.getBoundingClientRect() ?? { left:0, top:0, width:window.innerWidth, height:window.innerHeight };
        const p  = document.getElementById(HL_PANEL_ID);
        if (p) {
            p.style.left     = (r.left + PX * sc) + 'px';
            p.style.top      = (r.top  + PY * sc) + 'px';
            p.style.width    = (PW * sc) + 'px';
            p.style.height   = (PH * sc) + 'px';
            p.style.fontSize = Math.max(13, 26 * sc) + 'px';
        }
    }

    // ── 小工具 ────────────────────────────────
    function hlEl(tag, css, ...children) {
        const el = document.createElement(tag);
        if (css) el.style.cssText = css;
        for (const c of children) {
            if (c == null) continue;
            el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        }
        return el;
    }
    function hlBtn(label, primary, onClick, extra = '') {
        const bg  = primary ? '#C2185B' : '#2a0020';
        const btn = hlEl('button',
                         `background:${bg};color:#fff;border:1px solid #C2185B;padding:8px 18px;` +
                         `cursor:pointer;font-size:14px;border-radius:3px;${extra}`, label);
        if (onClick) btn.onclick = onClick;
        return btn;
    }
    function hlRow(label, value, color = '#fff') {
        const row = hlEl('div',
                         'display:flex;justify-content:space-between;align-items:center;' +
                         'padding:7px 0;border-bottom:1px solid #2a0020;font-size:14px;');
        row.appendChild(hlEl('span', 'color:#888;flex-shrink:0;', label));
        const v = hlEl('span', `color:${color};text-align:right;`, value);
        row.appendChild(v);
        return row;
    }
    function hlSection(title) {
        const s = hlEl('div', 'margin:10px 0 4px;color:#FF69B4;font-size:13px;font-weight:bold;', title);
        return s;
    }
    // ── 面板開關 ──────────────────────────────
    function openHLPanel(ch, gn) {
        removeHLPanel();
        const p = state.panel;
        p.targetChar = ch; p.groupName = gn; p.tab = TAB_OVERVIEW;
        p.noteEditing = false; p.noteDraft = null;
        p.ctlEditing = false; p.unlockConfirming = false;
        dpInit(getPadlockConfig(ch, gn));
        if (ch && !ch.IsPlayer()) requestHeartLockData(ch);

        const sc = _hlScaleFactor();
        const c  = document.getElementById('MainCanvas');
        const r  = c?.getBoundingClientRect() ?? { left:0, top:0, width:window.innerWidth, height:window.innerHeight };

        const panel = hlEl('div',
                           `position:fixed;background:${CC.bg};border:2px solid ${CC.border};` +
                           `box-sizing:border-box;display:flex;flex-direction:column;z-index:9999;` +
                           `font-family:"Arial","Microsoft JhengHei","微軟正黑體",sans-serif;color:${CC.text};overflow:hidden;` +
                           `user-select:none;-webkit-user-select:none;`);
        panel.id = HL_PANEL_ID;

        // 面板頭：隱形佔位（左）+ 置中標題 + 關閉按鈕（右）
        const header = hlEl('div',
                            `background:${CC.tOff};border-bottom:2px solid ${CC.border};flex-shrink:0;` +
                            `display:grid;grid-template-columns:2em 1fr 2em;align-items:center;padding:.25em .6em;user-select:none;`);
        const titleDiv = hlEl('div',
                              `color:${CC.acc};font-weight:bold;font-size:1em;text-align:center;user-select:none;`,
                              '♥ Heart Padlock ♥');
        const closeBtn = hlEl('button',
                              `background:none;border:none;color:${CC.sub};cursor:pointer;font-size:1.2em;padding:0;user-select:none;justify-self:end;`, '✕');
        closeBtn.onclick = () => { removeHLPanel(); DialogFocusItem = null; };
        header.appendChild(hlEl('span','')); // 左佔位
        header.appendChild(titleDiv);
        header.appendChild(closeBtn);

        // Tab 列
        const tabBar = hlEl('div', `display:flex;border-bottom:2px solid ${CC.border};flex-shrink:0;background:${CC.tOff};`);
        [['overview',T('tabOverview')],['note',T('tabNote')],['timer',T('tabTimer')],['control',T('tabControl')],['unlock',T('tabUnlock')]].forEach(([id,label]) => {
            const btn = hlEl('button', '', label);
            btn.id = `HL-tab-${id}`;
            btn.style.cssText = `flex:1;padding:.45em .2em;background:none;border:none;color:${CC.sub};cursor:pointer;font-size:inherit;border-bottom:3px solid transparent;user-select:none;`;
            btn.onclick = () => hlShowTab(ch, gn, id);
            tabBar.appendChild(btn);
        });

        const content = hlEl('div', `flex:1;overflow-y:auto;padding:.7em .9em;background:${CC.bg};`);
        content.id = 'HL-content';

        panel.appendChild(header); panel.appendChild(tabBar); panel.appendChild(content);
        document.body.appendChild(panel);

        // 定位：以 BC 虛擬座標換算到實際像素
        panel.style.left     = (r.left + PX * sc) + 'px';
        panel.style.top      = (r.top  + PY * sc) + 'px';
        panel.style.width    = (PW * sc) + 'px';
        panel.style.height   = (PH * sc) + 'px';
        panel.style.fontSize = Math.max(13, 26 * sc) + 'px';

        window.addEventListener('resize', _repositionHLPanel);
        hlShowTab(ch, gn, 'overview');
    }

    function removeHLPanel() {
        clearInterval(_hlTimer); _hlTimer = null;
        document.getElementById(HL_PANEL_ID)?.remove();
        closeNoteOverlay();
        window.removeEventListener('resize', _repositionHLPanel);
        state.panel.noteEditing = false; state.panel.ctlEditing = false;
        state.panel.targetChar  = null;  state.panel.groupName  = null;
    }

    // ── Tab 切換 ──────────────────────────────
    function hlShowTab(ch, gn, tabId) {
        clearInterval(_hlTimer); _hlTimer = null;
        if (state.panel.noteEditing && tabId !== 'note') { closeNoteOverlay(); state.panel.noteEditing = false; }
        if (state.panel.ctlEditing  && tabId !== 'control') state.panel.ctlEditing = false;
        state.panel.tab = { overview:TAB_OVERVIEW, note:TAB_NOTE, timer:TAB_TIMER, control:TAB_CONTROL, unlock:TAB_UNLOCK }[tabId] ?? TAB_OVERVIEW;
        ['overview','note','timer','control','unlock'].forEach(id => {
            const btn = document.getElementById(`HL-tab-${id}`);
            if (!btn) return;
            const a = id === tabId;
            btn.style.color = a ? CC.text : CC.sub;    // 選中=白色，未選=灰色
            btn.style.borderBottom = `3px solid ${a ? CC.border : 'transparent'}`;
            btn.style.background   = a ? CC.tSel : 'none';
            btn.style.fontWeight   = a ? 'bold'  : 'normal';
        });
        const content = document.getElementById('HL-content');
        if (!content) return;
        // 每次切換分頁前完整重置 content 樣式（避免 unlock tab 的 flex-center 污染其他分頁）
        content.innerHTML = '';
        content.style.cssText = `flex:1;overflow-y:auto;padding:.7em .9em;background:${CC.bg};`;
        const cfg = getPadlockConfig(ch, gn);
        switch (tabId) {
            case 'overview': hlTabOverview(content, ch, gn, cfg); break;
            case 'note':     hlTabNote(content, ch, gn, cfg);     break;
            case 'timer':    hlTabTimer(content, ch, gn, cfg);    break;
            case 'control':  hlTabControl(content, ch, gn, cfg);  break;
            case 'unlock':   hlTabUnlock(content, ch, gn, cfg);   break;
        }
    }

    // ── 刷新當前分頁（資料更新後呼叫）─────────────
    function hlRefreshCurrentTab() {
        const p = state.panel;
        const ch = p.targetChar, gn = p.groupName;
        if (!ch || !gn || !document.getElementById(HL_PANEL_ID)) return;
        // state.panel.tab 已經是字串 ID（'overview'/'note'/...），直接使用
        hlShowTab(ch, gn, p.tab ?? 'overview');
    }

    // ── 筆記圖片解析 ──────────────────────────────
    function renderNoteWithImages(text, container) {
        if (!text) { container.textContent = T('noNote'); container.style.color = CC.dim; return; }
        const IMG_RE = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|avif|svg)(?:\?[^\s]*)?/gi;
        let last = 0, m; IMG_RE.lastIndex = 0;
        while ((m = IMG_RE.exec(text)) !== null) {
            if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
            const url = m[0];
            const wrap = hlEl('span', 'display:inline;');
            const aLink = hlEl('a', `color:${CC.acc};word-break:break-all;`, url);
            aLink.href = url; aLink.target = '_blank';
            const embedBtn = hlEl('button',
                                  `background:none;border:1px solid ${CC.border};color:${CC.acc};cursor:pointer;font-size:.85em;padding:.1em .4em;margin-left:.3em;border-radius:3px;`,
                                  '(載入圖片)');
            embedBtn.onclick = () => {
                const img = document.createElement('img');
                img.src = url; img.style.cssText = 'max-width:100%;display:block;margin:.4em 0;border-radius:4px;';
                img.onerror = () => { img.alt = '(無法載入)'; };
                wrap.innerHTML = ''; wrap.appendChild(img);
            };
            wrap.appendChild(aLink); wrap.appendChild(embedBtn);
            container.appendChild(wrap);
            last = m.index + url.length;
        }
        if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
    }

    // ── Tab: 總覽（大/小螢幕自適應）──────────────
    function hlTabOverview(el, ch, gn, cfg) {
        const panelW = document.getElementById(HL_PANEL_ID)?.offsetWidth ?? 400;
        const isSmall = panelW < 280;
        const previewSrc = getSetting('previewImage');

        if (isSmall) {
            // 小螢幕：圖片在上，資訊在下
            el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.gap = '.5em';
            if (previewSrc) {
                const img = hlEl('img', 'width:5em;height:5em;object-fit:contain;display:block;margin:0 auto;pointer-events:none;user-select:none;');
                img.src = previewSrc; img.draggable = false; img.onerror = () => { img.style.display='none'; };
                el.appendChild(img);
            }
            const info = hlEl('div', 'display:flex;flex-direction:column;gap:.1em;');
            if (cfg) {
                const remain = timerRemainStr(cfg);
                [[T('unlockOwner'),cfg.ownerName??'?',CC.acc],[T('memberNum'),String(cfg.owner??'?'),CC.text],
                 [T('lockedLabel'),lockedAtStr(cfg),CC.sub],[T('remain'),remain||T('noTimer'),remain?CC.gold:CC.dim],
                 [T('until'),timerDateShortStr(cfg)||'—',remain?CC.sub:CC.dim],
                 [T('vibeLabel'),({off:T('vibeOff'),low:T('vibeLow'),mid:T('vibeMid'),high:T('vibeHigh')})[cfg.vibe??'off'],CC.text],
                 [T('controlLabel'),({normal:T('modeNormal'),edge:T('modeEdge'),deny:T('modeDeny')})[cfg.orgasmMode??'normal'],CC.text],
                ].forEach(([l,v,vc])=>info.appendChild(hlRow(l,v,vc)));
            } else {
                info.appendChild(hlEl('div',`color:${CC.dim};text-align:center;`,T('noConfig')));
            }
            el.appendChild(info);
        } else {
            // 大螢幕：圖片左、資訊右
            const top = hlEl('div', 'display:flex;gap:1em;margin-bottom:.8em;align-items:flex-start;');
            const imgBox = hlEl('div', 'flex:0 0 40%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;overflow:hidden;');
            if (previewSrc) {
                const img = hlEl('img', 'width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;');
                img.src = previewSrc; img.draggable = false; img.onerror = () => { img.style.display='none'; };
                imgBox.appendChild(img);
            }
            top.appendChild(imgBox);
            const info = hlEl('div', 'flex:1;display:flex;flex-direction:column;gap:.1em;');
            if (!cfg) {
                info.appendChild(hlEl('div',`color:${CC.dim};text-align:center;margin-top:1em;font-size:1.1em;`,T('noConfig')));
            } else {
                const remain = timerRemainStr(cfg);
                [[T('unlockOwner'),cfg.ownerName??'?',CC.acc],[T('memberNum'),String(cfg.owner??'?'),CC.text],
                 [T('lockedLabel'),lockedAtStr(cfg),CC.sub],[T('remain'),remain||T('noTimer'),remain?CC.gold:CC.dim],
                 [T('until'),timerDateShortStr(cfg)||'—',remain?CC.sub:CC.dim],
                 [T('vibeLabel'),({off:T('vibeOff'),low:T('vibeLow'),mid:T('vibeMid'),high:T('vibeHigh')})[cfg.vibe??'off'],CC.text],
                 [T('controlLabel'),({normal:T('modeNormal'),edge:T('modeEdge'),deny:T('modeDeny')})[cfg.orgasmMode??'normal'],CC.text],
                ].forEach(([l,v,vc])=>info.appendChild(hlRow(l,v,vc)));
            }
            top.appendChild(info);
            el.appendChild(top);
        }
        // 筆記預覽（不可選取標題，可選取內容）
        el.appendChild(hlEl('div',`background:${CC.panel};color:${CC.acc};text-align:center;padding:.35em;font-weight:bold;border-radius:4px 4px 0 0;border:1px solid ${CC.border};border-bottom:none;user-select:none;`,T('noteHeader')));
        const noteBox = hlEl('div',
                             `background:${CC.panel};border:1px solid ${CC.border};border-radius:0 0 4px 4px;` +
                             `padding:.6em .8em;min-height:5em;max-height:50%;overflow-y:auto;font-size:.9em;` +
                             `color:${cfg?.note?CC.text:CC.dim};white-space:pre-wrap;word-break:break-all;line-height:1.5;user-select:text;-webkit-user-select:text;`);
        renderNoteWithImages(cfg?.note||'', noteBox);
        el.appendChild(noteBox);
    }

    // ── Tab: 筆記（內嵌編輯，不用 overlay）──────
    function hlTabNote(el, ch, gn, cfg) {
        const editable = canEdit(ch, cfg);
        el.style.display='flex'; el.style.flexDirection='column'; el.style.gap='.6em';

        if (state.panel.noteEditing && editable) {
            // ── 編輯模式（內嵌 textarea）
            const ta = document.createElement('textarea');
            ta.id = NOTE_TA_ID;
            ta.maxLength = MAX_TEXT;
            ta.value = state.panel.noteDraft ?? cfg?.note ?? '';
            ta.style.cssText = `flex:1;min-height:8em;background:${CC.panel};color:${CC.text};border:1px solid ${CC.border};` +
                `padding:.7em;font-size:.95em;resize:none;outline:none;line-height:1.6;border-radius:4px;font-family:inherit;`;
            const counter = hlEl('div', `color:${CC.sub};font-size:.85em;`, `${ta.value.length} / ${MAX_TEXT}`);
            ta.oninput = () => { state.panel.noteDraft = ta.value; counter.textContent = `${ta.value.length} / ${MAX_TEXT}`; };
            const btnRow = hlEl('div', 'display:flex;gap:.6em;justify-content:flex-end;');
            const saveBtn = hlBtn('💾 Save', true, () => {
                pushConfig(ch, gn, { note: ta.value.slice(0, MAX_TEXT) });
                sendSettingsChange(ch, gn);
                state.panel.noteDraft = null;
                state.panel.noteEditing = false;
                hlShowTab(ch, gn, 'note');
            });
            const cancelBtn = hlBtn('✕ Cancel', false, () => {
                state.panel.noteDraft = null;
                state.panel.noteEditing = false;
                hlShowTab(ch, gn, 'note');
            });
            btnRow.appendChild(saveBtn); btnRow.appendChild(cancelBtn);
            el.appendChild(ta); el.appendChild(counter); el.appendChild(btnRow);
            ta.focus();
        } else {
            // ── 閱覽模式
            const noteBox = hlEl('div',
                                 `background:${CC.panel};border:1px solid ${CC.border};border-radius:4px;` +
                                 `padding:.7em 1em;flex:1;min-height:6em;overflow-y:auto;font-size:.95em;` +
                                 `color:${cfg?.note?CC.text:CC.dim};white-space:pre-wrap;word-break:break-all;line-height:1.6;user-select:text;`);
            renderNoteWithImages(cfg?.note||'', noteBox);
            el.appendChild(noteBox);
            if (editable) {
                const editBtn = hlBtn(T('editNote'), true, () => {
                    state.panel.noteEditing = true;
                    state.panel.noteDraft = cfg?.note ?? '';
                    hlShowTab(ch, gn, 'note');
                });
                editBtn.style.cssText += 'align-self:center;padding:.5em 2em;font-size:1.05em;';
                el.appendChild(editBtn);
            } else {
                el.appendChild(hlEl('p', `color:${CC.dim};text-align:center;font-size:.9em;user-select:none;`, T('ownerOnlyEdit')));
            }
        }
    }

    // ── Tab: 計時器 ───────────────────────────────
    function hlTabTimer(el, ch, gn, cfg) {
        const editable = canEdit(ch, cfg);
        el.style.display='flex'; el.style.flexDirection='column'; el.style.gap='.6em';

        // ① 時間顯示區
        const timerBox = hlEl('div', `background:${CC.panel};border:1px solid ${CC.border};border-radius:6px;padding:.6em 1em;`);
        const topRow   = hlEl('div', 'display:flex;align-items:baseline;justify-content:center;gap:.4em;');
        const remainEl = hlEl('span', `font-size:1.8em;color:${CC.gold};font-weight:bold;user-select:none;text-align:center;`);
        const deltaEl  = hlEl('span', `color:${CC.gold};font-size:1em;user-select:none;`, '');
        topRow.appendChild(remainEl); topRow.appendChild(deltaEl);
        // 截止日期行（left: 截止: date，right: 📅 button）
        const dateRow  = hlEl('div', 'display:flex;align-items:center;justify-content:space-between;margin-top:.3em;');
        const dateLbl  = hlEl('span', `color:${CC.sub};font-size:.9em;user-select:none;`, T('until') + ':');
        const dateVal  = hlEl('span', `color:${CC.text};font-size:1.05em;font-weight:bold;user-select:none;`, '');
        const dateLeft = hlEl('div', 'display:flex;align-items:center;gap:.4em;');
        dateLeft.appendChild(dateLbl); dateLeft.appendChild(dateVal);
        dateRow.appendChild(dateLeft);
        let timerDelta = 0;
        const refresh = () => {
            const c2=getPadlockConfig(ch,gn); const rem=timerRemainStr(c2);
            remainEl.textContent=rem||T('noTimerSet'); remainEl.style.color=rem?CC.gold:CC.dim;
            dateVal.textContent=timerDateOnlyStr(c2)||'—';
        };
        if (editable) {
            const calBtn = hlBtn('📅', false, () => {
                const c2=getPadlockConfig(ch,gn); const initDate=c2?.unlockTime?new Date(c2.unlockTime):new Date(Date.now()+86400000);
                showHTMLDatePicker(d=>{ pushConfig(ch,gn,{unlockTime:d.toISOString()}); sendSettingsChange(ch,gn); timerDelta=0; deltaEl.textContent=''; refresh(); }, initDate);
            }, 'padding:.2em .5em;font-size:.9em;');
            dateRow.appendChild(calBtn);
        }
        timerBox.appendChild(topRow); timerBox.appendChild(dateRow);
        refresh(); _hlTimer = setInterval(refresh, 5000);
        el.appendChild(timerBox);

        if (!editable) { el.appendChild(hlEl('p', `color:${CC.dim};text-align:center;font-size:.9em;user-select:none;`, T('ownerOnlyTimer'))); return; }

        // ② 調整按鈕（換行不影響 Set 位置）
        el.appendChild(hlEl('div', `color:${CC.sub};font-size:1em;user-select:none;`, T('adjust') + ':'));
        const adjRow = hlEl('div', 'display:flex;flex-wrap:wrap;gap:.4em;');
        TMR_PM.forEach(b => adjRow.appendChild(hlBtn(b.l, false, ()=>{
            timerDelta+=b.dh;
            deltaEl.textContent = timerDelta ? ' ' + timerDeltaStr(timerDelta) : '';
        }, 'font-size:1em;')));
        el.appendChild(adjRow);
        // Set 按鈕固定靠右（獨立 row）
        const setRow = hlEl('div', 'display:flex;justify-content:flex-end;align-items:center;gap:.5em;');
        setRow.appendChild(deltaEl);
        setRow.appendChild(hlBtn(T('setTimer'), true, ()=>{
            if (!timerDelta) return;
            const c2=getPadlockConfig(ch,gn); const base=c2?.unlockTime?new Date(c2.unlockTime).getTime():Date.now();
            const end=base+timerDelta*3600000; if(end>Date.now()){ pushConfig(ch,gn,{unlockTime:new Date(end).toISOString()}); sendSettingsChange(ch,gn); timerDelta=0; deltaEl.textContent=''; refresh(); }
        }, 'font-size:1em;padding:.4em 1.2em;'));
        el.appendChild(setRow);

        // ③ 移除拘束（無底色，不可選取標籤）
        const c2 = getPadlockConfig(ch,gn);
        const cbW = hlEl('label', 'display:flex;align-items:flex-start;gap:.6em;cursor:pointer;padding:.2em 0;');
        const cb  = hlEl('input', 'margin-top:.2em;width:1.1em;height:1.1em;accent-color:#C2185B;cursor:pointer;flex-shrink:0;');
        cb.type='checkbox'; cb.checked=c2?.removeRestraints??false;
        cb.onchange = ()=>{ pushConfig(ch,gn,{removeRestraints:cb.checked}); sendSettingsChange(ch,gn); };
        const cbT = hlEl('div','user-select:none;');
        cbT.appendChild(hlEl('div','font-size:1.05em;',T('removeRestraints')));
        cbT.appendChild(hlEl('div',`font-size:.9em;color:${CC.dim};margin-top:.1em;`,T('removeRestraintsSub')));
        cbW.appendChild(cb); cbW.appendChild(cbT);
        el.appendChild(cbW);

        // ④ 清除計時器（置中，最下方）
        el.appendChild(hlBtn(T('clearTimer'), false, ()=>{ pushConfig(ch,gn,{unlockTime:null}); sendSettingsChange(ch,gn); timerDelta=0; deltaEl.textContent=''; refresh(); },
                             `background:${CC.danger};display:block;margin:0 auto;padding:.45em 1.5em;font-size:1em;`));
    }

    // ── Tab: 控制 ─────────────────────────────────
    function hlTabControl(el, ch, gn, cfg) {
        const editable   = canEdit(ch, cfg);
        const vibeLabels = { off:T('vibeOff'), low:T('vibeLow'), mid:T('vibeMid'), high:T('vibeHigh') };
        const orgLabels  = { normal:T('modeNormal'), edge:T('modeEdge'), deny:T('modeDeny') };
        let curVibe = cfg?.vibe??'off', curOrg = cfg?.orgasmMode??'normal', editing = false;
        el.style.display='flex'; el.style.flexDirection='column'; el.style.gap='.7em';
        const setVibeBtn = () => Object.keys(vibeLabels).forEach(v=>{ const b=document.getElementById(`HL-vibe-${v}`); if(b){b.style.background=v===curVibe?CC.btnA:CC.btn;b.style.opacity=editing?'1':'0.65';} });
        const setOrgBtn  = () => Object.keys(orgLabels).forEach(o =>{ const b=document.getElementById(`HL-org-${o}`);  if(b){b.style.background=o===curOrg ?CC.btnA:CC.btn;b.style.opacity=editing?'1':'0.65';} });
        el.appendChild(hlEl('div', `color:${CC.sub};font-size:1em;user-select:none;`, T('vibStrength')));
        const vibeRow = hlEl('div', 'display:flex;flex-wrap:wrap;gap:.5em;');
        Object.entries(vibeLabels).forEach(([v,label])=>{ const b=hlBtn(label,v===curVibe,()=>{ if(editing){curVibe=v;setVibeBtn();} },'font-size:1.05em;'); b.id=`HL-vibe-${v}`; b.style.opacity='0.65'; vibeRow.appendChild(b); });
        el.appendChild(vibeRow);
        el.appendChild(hlEl('div', `color:${CC.sub};font-size:1em;user-select:none;`, T('restriction')));
        const orgRow = hlEl('div', 'display:flex;flex-wrap:wrap;gap:.5em;');
        Object.entries(orgLabels).forEach(([o,label])=>{ const b=hlBtn(label,o===curOrg,()=>{ if(editing){curOrg=o;setOrgBtn();} },'font-size:1.05em;'); b.id=`HL-org-${o}`; b.style.opacity='0.65'; orgRow.appendChild(b); });
        el.appendChild(orgRow);
        if (!editable) { el.appendChild(hlEl('p',`color:${CC.dim};text-align:center;font-size:.9em;user-select:none;`,T('ownerOnlyCtrl'))); return; }
        const actRow = hlEl('div', 'display:flex;gap:.6em;justify-content:center;');
        const editBtn   = hlBtn(T('settings'),true, ()=>{ editing=true; curVibe=cfg?.vibe??'off'; curOrg=cfg?.orgasmMode??'normal'; setVibeBtn(); setOrgBtn(); editBtn.style.display='none'; saveBtn.style.display=''; cancelBtn.style.display=''; },'font-size:1.05em;padding:.5em 1.5em;');
        const saveBtn   = hlBtn('💾 Save',   true, ()=>{ pushConfig(ch,gn,{vibe:curVibe,orgasmMode:curOrg}); sendSettingsChange(ch,gn); editing=false; setVibeBtn(); setOrgBtn(); editBtn.style.display=''; saveBtn.style.display='none'; cancelBtn.style.display='none'; },'font-size:1.05em;padding:.5em 1.5em;display:none;');
        const cancelBtn = hlBtn('✕ Cancel', false,()=>{ editing=false; curVibe=cfg?.vibe??'off'; curOrg=cfg?.orgasmMode??'normal'; setVibeBtn(); setOrgBtn(); editBtn.style.display=''; saveBtn.style.display='none'; cancelBtn.style.display='none'; },'font-size:1.05em;padding:.5em 1.5em;display:none;');
        actRow.appendChild(editBtn); actRow.appendChild(saveBtn); actRow.appendChild(cancelBtn);
        el.appendChild(actRow);
    }

    // ── Tab: 解鎖 ─────────────────────────────────
    function hlTabUnlock(el, ch, gn, cfg) {
        const canUnl = _canUnlockHeartLock(ch, cfg);
        el.style.display='flex'; el.style.flexDirection='column'; el.style.alignItems='center'; el.style.gap='.6em';
        const img = hlEl('img', 'width:9em;height:9em;object-fit:contain;pointer-events:none;user-select:none;');
        img.src = HEARTKEY_IMAGE; img.draggable = false; img.onerror = ()=>{ img.style.display='none'; };
        el.appendChild(img);
        if (cfg) el.appendChild(hlEl('div',`color:${CC.text};font-size:.95em;text-align:center;user-select:none;`,
                                     `${T('unlockOwner')} ${cfg.ownerName??'?'} #${cfg.owner??'?'}`));
        el.appendChild(hlEl('p', `color:#FF9999;text-align:center;font-size:1em;user-select:none;`, T('unlockWarn1')));
        el.appendChild(hlEl('p', `color:${CC.sub};text-align:center;font-size:.9em;user-select:none;`, T('unlockWarn2')));
        if (!canUnl) { el.appendChild(hlEl('p',`color:${CC.dim};text-align:center;font-size:.95em;margin-top:.5em;user-select:none;`,T('unlockNoRight'))); return; }
        const unlockBtn  = hlBtn(T('unlockConfirm'),false,()=>{ unlockBtn.style.display='none'; confirmRow.style.display='flex'; },`background:${CC.danger};border-color:#FF4444;font-size:1.1em;padding:.5em 2em;`);
        const confirmRow = hlEl('div', 'display:none;gap:.6em;');
        const yesBtn = hlBtn(T('unlockConfirm'),false,()=>{
            try {
                notifyRemove(ch,gn); state._unlocking=true; InventoryUnlock?.(ch,gn); state._unlocking=false;
                _cleanHeartLockProperty(ch,gn); ChatRoomCharacterUpdate?.(ch);
                const msg=T('unlockDone',Player.Nickname||Player.Name,ch.Nickname||ch.Name,HEARTLOCK_NAME);
                try { ServerSend('ChatRoomChat',{Type:'Action',Content:'CUSTOM_SYSTEM_ACTION',Dictionary:[{Tag:'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION',Text:msg}]}); } catch {}
                removeHLPanel(); DialogFocusItem=null;
            } catch { state._unlocking=false; }
        },`background:${CC.danger};border-color:#FF4444;font-size:1.05em;padding:.5em 1.5em;`);
        const noBtn = hlBtn(T('unlockCancel'),false,()=>{ confirmRow.style.display='none'; unlockBtn.style.display=''; },'font-size:1.05em;padding:.5em 1.5em;');
        confirmRow.appendChild(yesBtn); confirmRow.appendChild(noBtn);
        el.appendChild(unlockBtn); el.appendChild(confirmRow);
    }

    // ── 面板主函式
    function getGroupFromFocusItem() {
        const item = window.DialogFocusSourceItem;
        if (item?.Asset?.Group?.Name) return item.Asset.Group.Name;
        const ch = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
        return ch?.FocusGroup?.Name ?? null;
    }

    function panelLoad() {
        const ch = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
        const gn = getGroupFromFocusItem();
        if (!ch || !gn) return;
        openHLPanel(ch, gn);
    }
    function panelDraw()  {}
    function panelClick() {}

    // ═══════════════════════════════════════════
    //  Hooks（兩處 isLover 改為 isAllowedToLock）
    // ═══════════════════════════════════════════
    function patchFunctions(modApi) {

        // 返回鍵：優先關閉 HeartLock 面板，第二次才退出 BC dialog
        modApi.hookFunction('DialogLeave', 10, (args, next) => {
            if (document.getElementById(HL_PANEL_ID)) { removeHLPanel(); return; }
            return next(args);
        });
        modApi.hookFunction('InformationSheetExit', 10, (args, next) => {
            if (document.getElementById(HL_PANEL_ID)) { removeHLPanel(); return; }
            return next(args);
        });

        // InformationSheet 縮放時重新定位面板
        modApi.hookFunction('InformationSheetResize', 0, (args, next) => {
            const r = next(args); _repositionHLPanel(); return r;
        });
        modApi.hookFunction('InventoryRemove', 0, (args, next) => {
            const C = args[0], grp = args[1];
            if (state._restoring) return next(args);
            // 計時器到期移除：穿戴者自己移除，直接放行
            if (state._timerUnlocking) return next(args);
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

        // ── 有插件的人都能看到此鎖，但上鎖時才做權限檢查 ────────────
        modApi.hookFunction('DialogInventoryAdd', 10, (args, next) => {
            const C    = args[0];
            const item = args[1];
            if (item?.Asset?.Name !== HEARTLOCK_NAME) return next(args);
            if (DialogMenuMode === 'permissions') return next(args);
            if (C.ID === 0) return;           // 穿戴者自己不顯示
            if (!isAllowedToLock(C)) return;  // 無權限者不顯示
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
            // 設旗標，供 ServerSend hook 識別此次是 HeartLock 上鎖
            state._applyingHeartLock = true;
            cl.Asset = hsAsset; next(args); cl.Asset = ori;
            state._applyingHeartLock = false;
            if (item?.Property) { convertToHeartLock(ch, item, fg); if (fg) watchForUnlock(ch, fg, item); }
        });

        // ── ServerSend：ActionAddLock 修正 ────────────────────────────
        // 使用旗標識別 HeartLock 上鎖，避免誤改 Best Friend Lock 等其他高安鎖底子的鎖
        modApi.hookFunction('ServerSend', 0, (args, next) => {
            if (args[0] === 'ChatRoomChat') {
                const d = args[1];
                if (d?.Content === 'ActionAddLock' && Array.isArray(d.Dictionary) && state._applyingHeartLock) {
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
            next(args);
            // DOM 面板已存在 → 同步觸發的重載，不重設狀態
            if (document.getElementById(HL_PANEL_ID)) return;
            panelLoad();
        });
        modApi.hookFunction('InventoryItemMiscHighSecurityPadlockDraw', 11, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name !== HEARTLOCK_NAME) return next(args);
            // DOM 面板已接管所有 UI，canvas 層不繪製
        });
        modApi.hookFunction('InventoryItemMiscHighSecurityPadlockClick', 11, (args, next) => {
            if (window.DialogFocusSourceItem?.Property?.Name !== HEARTLOCK_NAME) {
                try { return next(args); } catch { return; }
            }
            // DOM 面板已接管所有點擊事件
        });
        modApi.hookFunction('DialogLeaveFocusItem', 10, (args, next) => {
            const isHL = window.DialogFocusSourceItem?.Property?.Name === HEARTLOCK_NAME;
            if (isHL && state._inServerSync) return;
            if (isHL) removeHLPanel();
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
        // ExclusiveUnlock 已移除，BC 伺服器接受任何有物品權限的玩家解鎖。
        // 我們在此攔截確保只有 owner / EL 戀人 / BC 戀人才能實際執行。
        modApi.hookFunction('InventoryUnlock', 10, (args, next) => {
            if (state._timerUnlocking || state._unlocking) {
                state._unlocking = true; const r = next(args); state._unlocking = false;
                _cleanHeartLockProperty(args[0], args[1]);
                return r;
            }
            const C = args[0], itemOrGrp = args[1];
            const item = (itemOrGrp && typeof itemOrGrp === 'object')
            ? itemOrGrp
            : InventoryGet?.(C, typeof itemOrGrp === 'string' ? itemOrGrp : null);
            if (item?.Property?.Name !== HEARTLOCK_NAME) {
                state._unlocking = true; const r = next(args); state._unlocking = false; return r;
            }
            const gn  = item.Asset?.Group?.Name;
            const cfg = getPadlockConfig(C, gn);
            if (cfg && !isAllowedToUnlock(C, cfg)) return;
            // 先通知穿戴者清除 config（避免 ChatRoomSyncCharacter 觸發復原）
            if (cfg) notifyRemove(C, gn);
            state._unlocking = true; const r = next(args); state._unlocking = false;
            _cleanHeartLockProperty(C, itemOrGrp);
            return r;
        });

        /** 清除解鎖後殘留的自訂 Property 欄位（Name / HeartLockId） */
        function _cleanHeartLockProperty(C, itemOrGrp) {
            try {
                const item = (itemOrGrp && typeof itemOrGrp === 'object')
                ? itemOrGrp
                : InventoryGet?.(C, typeof itemOrGrp === 'string' ? itemOrGrp : null);
                if (!item?.Property) return;
                if (item.Property.Name === HEARTLOCK_NAME) delete item.Property.Name;
                if (item.Property.HeartLockId !== undefined) delete item.Property.HeartLockId;
                // 若 Property 已空只剩 Effect:[]，清理讓外觀完全復原
                const keys = Object.keys(item.Property);
                if (keys.length === 1 && keys[0] === 'Effect' && item.Property.Effect?.length === 0)
                    item.Property = undefined;
            } catch {}
        }

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

        // 成員進出房間也需要保護，攔截 DialogLeaveFocusItem
        for (const evt of ['ChatRoomSyncMemberJoin', 'ChatRoomSyncMemberLeave']) {
            modApi.hookFunction(evt, 1, (args, next) => {
                state._inServerSync = true;
                const result = next(args);
                state._inServerSync = false;
                return result;
            });
        }

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
                    // 相依物件未載入而暫掛的部位：不重試、不計入防作弊、不洗版，留待下次登入/刷新或 Echo 重載後由 integrity 復原
                    if (_pendingRestore.has(gn)) continue;
                    if (sourceMember != null && Number(sourceMember) === Number(cfg.owner)) { deleteConfig(gn); continue; }
                    if (sourceMember != null && Number(sourceMember) === Player.MemberNumber && Number(cfg.owner) === Player.MemberNumber) { deleteConfig(gn); continue; }
                    if (sourceMember != null) {
                        const isELUnlocker = Player.OnlineSharedSettings?.AFC?.lovers
                        ?.some(l => Number(l.memberNumber) === Number(sourceMember)) ?? false;
                        const isBCUnlocker = Player.Lovership
                        ?.some(l => Number(l.MemberNumber) === Number(sourceMember)) ?? false;
                        if (isELUnlocker || isBCUnlocker) { deleteConfig(gn); continue; }
                    }
                    grabStateChar.count++;
                    if (grabStateChar.count === 1) grabStateChar.firstTriggerTime = Date.now();
                    if (grabStateChar.count > 3 && Date.now() - grabStateChar.firstTriggerTime < GRAB_WINDOW_MS) {
                        grabStateChar.state = true; grabStateChar.count = 0;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('protectDisabled', nick, HEARTLOCK_NAME) }] }); } catch {}
                        setTimeout(() => { grabStateChar.state = false; grabStateChar.count = 0; }, GRAB_COOLDOWN_MS);
                        return result;
                    }
                    // 若正在編輯此物品的筆記，只修資料，不動 UI 狀態
                    const editingThis = state.panel.noteEditing && gn === state.panel.groupName;
                    if (restoreLockFromConfig(gn, cfg, !editingThis) === 'ok') anyRestored = true;
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
            const data = args[0];
            state._inServerSync = true;
            const result = next(args);
            state._inServerSync = false;
            if (data?.Character?.MemberNumber !== Player.MemberNumber) return result;
            if (!ensureStorage() || grabStateSingle.state) return result;
            const sourceMember = data?.SourceMemberNumber;
            const padlocks = Player.HeartLock?.padlocks ?? {};
            let anyRestored = false;
            for (const gn of Object.keys(padlocks)) {
                const cfg = padlocks[gn], item = InventoryGet?.(Player, gn);
                const broken = !item || item.Property?.Name !== HEARTLOCK_NAME || item.Property?.LockedBy !== HSLOCK_NAME;
                if (broken) {
                    // 相依物件未載入而暫掛的部位：不重試、不計入防作弊、不洗版，留待下次登入/刷新或 Echo 重載後由 integrity 復原
                    if (_pendingRestore.has(gn)) continue;
                    if (sourceMember != null && Number(sourceMember) === Number(cfg.owner)) { deleteConfig(gn); continue; }
                    if (sourceMember != null && Number(sourceMember) === Player.MemberNumber && Number(cfg.owner) === Player.MemberNumber) { deleteConfig(gn); continue; }
                    // 授權解鎖者（EL 戀人 / BC 戀人）
                    if (sourceMember != null) {
                        const isELUnlocker = Player.OnlineSharedSettings?.AFC?.lovers
                        ?.some(l => Number(l.memberNumber) === Number(sourceMember)) ?? false;
                        const isBCUnlocker = Player.Lovership
                        ?.some(l => Number(l.MemberNumber) === Number(sourceMember)) ?? false;
                        if (isELUnlocker || isBCUnlocker) { deleteConfig(gn); continue; }
                    }
                    grabStateSingle.count++;
                    if (grabStateSingle.count === 1) grabStateSingle.firstTriggerTime = Date.now();
                    if (grabStateSingle.count > 3 && Date.now() - grabStateSingle.firstTriggerTime < GRAB_WINDOW_MS) {
                        grabStateSingle.state = true; grabStateSingle.count = 0;
                        try { const nick = Player.Nickname || Player.Name; ServerSend('ChatRoomChat', { Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION', Dictionary: [{ Tag: 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION', Text: T('protectDisabled', nick, HEARTLOCK_NAME) }] }); } catch {}
                        setTimeout(() => { grabStateSingle.state = false; grabStateSingle.count = 0; }, GRAB_COOLDOWN_MS);
                        return result;
                    }
                    const editingThis2 = state.panel.noteEditing && gn === state.panel.groupName;
                    if (restoreLockFromConfig(gn, cfg, !editingThis2) === 'ok') anyRestored = true;
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

        // Phase 1：等 bcModSdk 就緒
        const sdkReady = await waitFor(() => !!window.bcModSdk);

        const modApi = getModApi();
        if (!modApi) { console.error('🐈‍⬛ [HeartLock] modApi unavailable.'); return; }

        // Phase 2：等玩家登入 + 遊戲資源就緒
        const gameReady = await waitFor(() =>
                                        !!window.Player?.AccountName &&
                                        !!window.AssetFemale3DCG &&
                                        !!AssetGroupGet?.('Female3DCG', 'ItemMisc')
                                       );

        createHeartLockAsset();
        patchFunctions(modApi);
        await waitFor(() => window.Player?.ExtensionSettings !== undefined, 30000);
        ensureStorage();
        reconcileHLStorage();   // 與本機 DB 對帳：被初始化→抓 DB；伺服器較舊且不符→採用最新
        saveAndSync();
        reapplyFromAppearance();
        startVibeTimer();
        startTimerCheck();
        setInterval(checkLockIntegrity, 3000);
        state.initialized = true;

        // 對外 API（供 AFC 清鎖 / DEBUG / 資料復原輔助）
        window.Liko.HeartLock = Object.assign(window.Liko.HeartLock ?? {}, {
            version:        MOD_VER,
            getStorage:     () => { ensureStorage(); return clone(Player.HeartLock); },
            getPadlocks:    () => { ensureStorage(); return clone(Player.HeartLock.padlocks ?? {}); },
            removeLock:     (gn, opts)  => removeLock(gn, opts),
            clearAllLocks:  (opts)      => clearAllLocks(opts),
            restoreStorage: (data) => {
                if (!ensureStorage() || !data || typeof data !== 'object') return false;
                Player.ExtensionSettings[EXT_KEY] = clone(data);
                if (!Player.ExtensionSettings[EXT_KEY].padlocks) Player.ExtensionSettings[EXT_KEY].padlocks = {};
                Player.HeartLock = Player.ExtensionSettings[EXT_KEY];
                saveAndSync();
                try { reapplyFromAppearance(); } catch {}
                return true;
            },
        });

        log(`🐈‍⬛ [HeartLock] v${MOD_VER} initialized.`);
    }

    initialize().catch(e => console.error('🐈‍⬛ [HeartLock] init error', e));
})();
