// Liko - IVH i18n 字庫
// 此檔案由 IVH 插件動態載入，不需手動安裝
// 載入後自動呼叫 register('IVH', {...})，將字串注入共用引擎 Liko-i18n
// 佔位符以 {name} 表示，由引擎 t('IVH', key, vars) 代入
// 語言：TW 繁中 / CN 簡中 / EN 英 / DE 德 / FR 法 / RU 俄 / UA 烏

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko IVH strings] i18n 引擎尚未載入');
        return;
    }

    window.Liko.i18n.register('IVH', {

        // ── 載入 / 指令 ───────────────────────────────────────────────
        'loaded': {
            TW: 'IVH v{v} 已載入 ✅\n/ivh help 說明 | /ivh setting 設定頁',
            CN: 'IVH v{v} 已加载 ✅\n/ivh help 说明 | /ivh setting 设置页',
            EN: 'IVH v{v} loaded ✅\n/ivh help | /ivh setting for settings',
            DE: 'IVH v{v} geladen ✅\n/ivh help | /ivh setting für Einstellungen',
            FR: 'IVH v{v} chargé ✅\n/ivh help | /ivh setting pour les réglages',
            RU: 'IVH v{v} загружен ✅\n/ivh help | /ivh setting — настройки',
            UA: 'IVH v{v} завантажено ✅\n/ivh help | /ivh setting — налаштування',
        },
        'help': {
            TW: '🌀 IVH v{v} 指令列表：\n  /ivh setting       — 開啟偏好設定頁\n  /ivh show          — 顯示控制面板\n  /ivh test [文字]   — 立即觸發效果\n  /ivh climax        — 測試高潮特效\n  /ivh depth [1~3]   — 測試催眠深度效果\n  /ivh calibrate     — 頭部座標校正面板\n  /ivh help          — 顯示此說明',
            CN: '🌀 IVH v{v} 指令列表：\n  /ivh setting       — 打开偏好设置页\n  /ivh show          — 显示控制面板\n  /ivh test [文字]   — 立即触发效果\n  /ivh climax        — 测试高潮特效\n  /ivh depth [1~3]   — 测试催眠深度效果\n  /ivh calibrate     — 头部坐标校正面板\n  /ivh help          — 显示此说明',
            EN: '🌀 IVH v{v} commands:\n  /ivh setting       — Open settings page\n  /ivh show          — Show control panel\n  /ivh test [text]   — Trigger effect now\n  /ivh climax        — Test climax effect\n  /ivh depth [1~3]   — Test depth effect\n  /ivh calibrate     — Head position calibration\n  /ivh help          — Show this help',
            DE: '🌀 IVH v{v} Befehle:\n  /ivh setting       — Einstellungen öffnen\n  /ivh show          — Bedienfeld anzeigen\n  /ivh test [Text]   — Effekt jetzt auslösen\n  /ivh climax        — Höhepunkt-Effekt testen\n  /ivh depth [1~3]   — Tiefen-Effekt testen\n  /ivh calibrate     — Kopfposition kalibrieren\n  /ivh help          — Diese Hilfe anzeigen',
            FR: '🌀 IVH v{v} commandes :\n  /ivh setting       — Ouvrir les réglages\n  /ivh show          — Afficher le panneau\n  /ivh test [texte]  — Déclencher l\'effet\n  /ivh climax        — Tester l\'effet d\'apogée\n  /ivh depth [1~3]   — Tester l\'effet de profondeur\n  /ivh calibrate     — Calibrer la position de la tête\n  /ivh help          — Afficher cette aide',
            RU: '🌀 IVH v{v} команды:\n  /ivh setting       — Открыть настройки\n  /ivh show          — Показать панель\n  /ivh test [текст]  — Запустить эффект\n  /ivh climax        — Тест эффекта оргазма\n  /ivh depth [1~3]   — Тест эффекта глубины\n  /ivh calibrate     — Калибровка позиции головы\n  /ivh help          — Показать справку',
            UA: '🌀 IVH v{v} команди:\n  /ivh setting       — Відкрити налаштування\n  /ivh show          — Показати панель\n  /ivh test [текст]  — Запустити ефект\n  /ivh climax        — Тест ефекту оргазму\n  /ivh depth [1~3]   — Тест ефекту глибини\n  /ivh calibrate     — Калібрування позиції голови\n  /ivh help          — Показати довідку',
        },
        'cmdUnknown': {
            TW: '⚠️ [IVH] 未知指令「{sub}」，輸入 /ivh help 查看說明',
            CN: '⚠️ [IVH] 未知指令「{sub}」，输入 /ivh help 查看说明',
            EN: '⚠️ [IVH] Unknown command "{sub}", type /ivh help',
            DE: '⚠️ [IVH] Unbekannter Befehl „{sub}", /ivh help eingeben',
            FR: '⚠️ [IVH] Commande inconnue « {sub} », tapez /ivh help',
            RU: '⚠️ [IVH] Неизвестная команда «{sub}», введите /ivh help',
            UA: '⚠️ [IVH] Невідома команда «{sub}», введіть /ivh help',
        },
        'cantOpenSettings': { TW: '⚠️ 無法開啟設定頁（偏好系統未就緒）', CN: '⚠️ 无法打开设置页（偏好系统未就绪）', EN: '⚠️ Cannot open settings (preference not ready)', DE: '⚠️ Einstellungen können nicht geöffnet werden', FR: '⚠️ Impossible d\'ouvrir les réglages', RU: '⚠️ Не удаётся открыть настройки', UA: '⚠️ Не вдається відкрити налаштування' },
        'exportDone': { TW: '📤 IVH 設定已匯出 (IVH-settings.json)', CN: '📤 IVH 设置已导出 (IVH-settings.json)', EN: '📤 IVH settings exported (IVH-settings.json)', DE: '📤 IVH-Einstellungen exportiert', FR: '📤 Réglages IVH exportés', RU: '📤 Настройки IVH экспортированы', UA: '📤 Налаштування IVH експортовано' },
        'importDone': { TW: '📥 IVH 設定已匯入', CN: '📥 IVH 设置已导入', EN: '📥 IVH settings imported', DE: '📥 IVH-Einstellungen importiert', FR: '📥 Réglages IVH importés', RU: '📥 Настройки IVH импортированы', UA: '📥 Налаштування IVH імпортовано' },
        'editedYourText': { TW: '📝 {who} 編輯了你的 IVH 催眠文本', CN: '📝 {who} 编辑了你的 IVH 催眠文本', EN: '📝 {who} edited your IVH hypnosis text', DE: '📝 {who} hat deinen IVH-Hypnosetext bearbeitet', FR: '📝 {who} a modifié votre texte d\'hypnose IVH', RU: '📝 {who} изменил(а) ваш текст гипноза IVH', UA: '📝 {who} змінив(ла) ваш текст гіпнозу IVH' },

        // ── 分頁名稱 ──────────────────────────────────────────────────
        'tab_basic':   { TW: '基本設定', CN: '基本设置', EN: 'Basic',      DE: 'Allgemein',   FR: 'Général',    RU: 'Основные',   UA: 'Основні' },
        'tab_effects': { TW: '效果設定', CN: '效果设置', EN: 'Effects',    DE: 'Effekte',     FR: 'Effets',     RU: 'Эффекты',    UA: 'Ефекти' },
        'tab_texts':   { TW: '文本設定', CN: '文本设置', EN: 'Texts',      DE: 'Texte',       FR: 'Textes',     RU: 'Тексты',     UA: 'Тексти' },
        'tab_expr':    { TW: '表情設定', CN: '表情设置', EN: 'Expression', DE: 'Mimik',       FR: 'Expression', RU: 'Мимика',     UA: 'Міміка' },
        'tab_sounds':  { TW: '音效設定', CN: '音效设置', EN: 'Sounds',     DE: 'Töne',        FR: 'Sons',       RU: 'Звуки',      UA: 'Звуки' },
        'tab_about':   { TW: '關於插件', CN: '关于插件', EN: 'About',      DE: 'Über',        FR: 'À propos',   RU: 'О плагине',  UA: 'Про плагін' },

        // ── 通用 ─────────────────────────────────────────────────────
        'exit':    { TW: '離開',   CN: '离开',   EN: 'Exit',    DE: 'Schließen', FR: 'Quitter', RU: 'Выход',    UA: 'Вихід' },
        'info':    { TW: '── 說明 ──', CN: '── 说明 ──', EN: '── Info ──', DE: '── Info ──', FR: '── Info ──', RU: '── Справка ──', UA: '── Довідка ──' },
        'cancel':  { TW: '取消',   CN: '取消',   EN: 'Cancel',  DE: 'Abbrechen', FR: 'Annuler', RU: 'Отмена',   UA: 'Скасувати' },
        'confirm': { TW: '確定',   CN: '确定',   EN: 'Confirm', DE: 'OK',        FR: 'OK',      RU: 'OK',       UA: 'OK' },
        'save':    { TW: '💾 保存', CN: '💾 保存', EN: '💾 Save', DE: '💾 Speichern', FR: '💾 Enregistrer', RU: '💾 Сохранить', UA: '💾 Зберегти' },
        'delete':  { TW: '🗑 刪除', CN: '🗑 删除', EN: '🗑 Delete', DE: '🗑 Löschen', FR: '🗑 Supprimer', RU: '🗑 Удалить', UA: '🗑 Видалити' },
        'upload':  { TW: '上傳',   CN: '上传',   EN: 'Upload',  DE: 'Hochladen', FR: 'Téléverser', RU: 'Загрузить', UA: 'Завантажити' },
        'clear':   { TW: '清除',   CN: '清除',   EN: 'Clear',   DE: 'Leeren',    FR: 'Effacer', RU: 'Очистить', UA: 'Очистити' },
        'other':   { TW: '其他',   CN: '其他',   EN: 'Other',   DE: 'Andere',    FR: 'Autre',   RU: 'Другое',   UA: 'Інше' },
        'restoreDefault': { TW: '還原預設', CN: '还原预设', EN: 'Reset', DE: 'Zurücksetzen', FR: 'Réinitialiser', RU: 'Сброс', UA: 'Скинути' },
        'export':  { TW: '匯出全部設定', CN: '导出全部设置', EN: 'Export all', DE: 'Alles exportieren', FR: 'Tout exporter', RU: 'Экспорт всего', UA: 'Експорт усього' },
        'import':  { TW: '匯入全部設定', CN: '导入全部设置', EN: 'Import all', DE: 'Alles importieren', FR: 'Tout importer', RU: 'Импорт всего', UA: 'Імпорт усього' },

        // ── IVH 啟用 ─────────────────────────────────────────────────
        'enabledOn':  { TW: 'IVH 啟用中', CN: 'IVH 启用中', EN: 'IVH Enabled',  DE: 'IVH aktiv',     FR: 'IVH activé',   RU: 'IVH включён',  UA: 'IVH увімкнено' },
        'enabledOff': { TW: 'IVH 停用中', CN: 'IVH 停用中', EN: 'IVH Disabled', DE: 'IVH inaktiv',   FR: 'IVH désactivé', RU: 'IVH выключен', UA: 'IVH вимкнено' },
        'enabledDesc': {
            TW: '開啟後此插件會有更高沉浸性，並包含部分可能令人不適的效果（強閃光、畫面破碎、震動等），請依個人狀況使用。',
            CN: '开启后此插件会有更高沉浸性，并包含部分可能令人不适的效果（强闪光、画面破碎、震动等），请依个人情况使用。',
            EN: 'When enabled this plugin adds high-immersion effects including some that may be uncomfortable (strong flashes, screen shatter, shaking). Use at your own discretion.',
            DE: 'Aktiviert bietet dieses Plugin intensive Effekte, darunter möglicherweise unangenehme (starke Blitze, zersplitterndes Bild, Erschütterung). Nutze es nach eigenem Ermessen.',
            FR: 'Une fois activé, ce plugin ajoute des effets immersifs, dont certains peuvent être inconfortables (flashs intenses, écran brisé, secousses). À utiliser à votre discrétion.',
            RU: 'При включении плагин добавляет эффекты погружения, включая потенциально неприятные (яркие вспышки, дробление экрана, тряска). Используйте на своё усмотрение.',
            UA: 'Після ввімкнення плагін додає ефекти занурення, зокрема потенційно неприємні (яскраві спалахи, дроблення екрана, тряска). Використовуйте на власний розсуд.',
        },

        // ── 基本設定 ─────────────────────────────────────────────────
        'intensity':  { TW: '催眠強度', CN: '催眠强度', EN: 'Intensity', DE: 'Intensität', FR: 'Intensité', RU: 'Сила', UA: 'Сила' },
        'depthMax':   { TW: '催眠深度', CN: '催眠深度', EN: 'Depth',     DE: 'Tiefe',      FR: 'Profondeur', RU: 'Глубина', UA: 'Глибина' },
        'depthNone':  { TW: '無', CN: '无', EN: 'Off', DE: 'Aus', FR: 'Aucun', RU: 'Нет', UA: 'Немає' },
        'depthLight': { TW: '輕', CN: '轻', EN: 'Light', DE: 'Leicht', FR: 'Léger', RU: 'Слабо', UA: 'Слабко' },
        'depthMed':   { TW: '中', CN: '中', EN: 'Med', DE: 'Mittel', FR: 'Moyen', RU: 'Средне', UA: 'Середньо' },
        'depthHeavy': { TW: '重', CN: '重', EN: 'Heavy', DE: 'Stark', FR: 'Fort', RU: 'Сильно', UA: 'Сильно' },
        'interval':   { TW: '循環時間', CN: '循环时间', EN: 'Interval', DE: 'Intervall', FR: 'Intervalle', RU: 'Интервал', UA: 'Інтервал' },
        'minutes':    { TW: '分（1~99）', CN: '分（1~99）', EN: 'min (1~99)', DE: 'Min. (1~99)', FR: 'min (1~99)', RU: 'мин (1~99)', UA: 'хв (1~99)' },
        'depthEffects': { TW: '── 深度效果 ──', CN: '── 深度效果 ──', EN: '── Depth FX ──', DE: '── Tiefen-FX ──', FR: '── FX profondeur ──', RU: '── Эффекты глубины ──', UA: '── Ефекти глибини ──' },
        'triggerTarget': { TW: '觸發對象', CN: '触发对象', EN: 'Trigger by', DE: 'Auslöser', FR: 'Déclencheur', RU: 'Кто запускает', UA: 'Хто запускає' },
        'anyone':     { TW: '任何人', CN: '任何人', EN: 'Anyone', DE: 'Jeder', FR: 'Tous', RU: 'Любой', UA: 'Будь-хто' },
        'whitelistOnly': { TW: '僅白名單', CN: '仅白名单', EN: 'Whitelist', DE: 'Nur Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'whitelist':  { TW: '白名單', CN: '白名单', EN: 'Whitelist', DE: 'Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'allowOthersOn':  { TW: '允許他人增減我的文本：開', CN: '允许他人增减我的文本：开', EN: 'Allow others to edit my text: ON', DE: 'Andere dürfen meinen Text ändern: AN', FR: 'Autoriser autrui à modifier mon texte : OUI', RU: 'Разрешить другим менять мой текст: ВКЛ', UA: 'Дозволити іншим змінювати мій текст: УВІМК' },
        'allowOthersOff': { TW: '允許他人增減我的文本：關', CN: '允许他人增减我的文本：关', EN: 'Allow others to edit my text: OFF', DE: 'Andere dürfen meinen Text ändern: AUS', FR: 'Autoriser autrui à modifier mon texte : NON', RU: 'Разрешить другим менять мой текст: ВЫКЛ', UA: 'Дозволити іншим змінювати мій текст: ВИМК' },

        // ── 高潮模式 ─────────────────────────────────────────────────
        'climaxMode':  { TW: '高潮模式', CN: '高潮模式', EN: 'Climax mode', DE: 'Höhepunkt-Modus', FR: 'Mode apogée', RU: 'Режим оргазма', UA: 'Режим оргазму' },
        'climaxOnOrgasm': { TW: '僅高潮時', CN: '仅高潮时', EN: 'On orgasm', DE: 'Bei Orgasmus', FR: 'À l\'orgasme', RU: 'При оргазме', UA: 'При оргазмі' },
        'climaxAlways':   { TW: '每次觸發', CN: '每次触发', EN: 'Every time', DE: 'Jedes Mal', FR: 'À chaque fois', RU: 'Каждый раз', UA: 'Щоразу' },

        // ── 文本設定 ─────────────────────────────────────────────────
        'sec_hypnoText': { TW: '催眠文本', CN: '催眠文本', EN: 'Hypnosis text', DE: 'Hypnosetext', FR: 'Texte d\'hypnose', RU: 'Текст гипноза', UA: 'Текст гіпнозу' },
        'sec_statusMsg': { TW: '狀態訊息', CN: '状态信息', EN: 'Status message', DE: 'Statusnachricht', FR: 'Message d\'état', RU: 'Сообщение состояния', UA: 'Повідомлення стану' },
        'sec_triggerWords': { TW: '觸發詞', CN: '触发词', EN: 'Trigger words', DE: 'Auslösewörter', FR: 'Mots déclencheurs', RU: 'Слова-триггеры', UA: 'Слова-тригери' },

        // ── 表情設定 ─────────────────────────────────────────────────
        'expr_edit':   { TW: '🎭 編輯表情', CN: '🎭 编辑表情', EN: '🎭 Edit expression', DE: '🎭 Mimik bearbeiten', FR: '🎭 Modifier l\'expression', RU: '🎭 Изменить мимику', UA: '🎭 Змінити міміку' },
        'expr_item':   { TW: '表情{n}', CN: '表情{n}', EN: 'Face {n}', DE: 'Mimik {n}', FR: 'Visage {n}', RU: 'Лицо {n}', UA: 'Обличчя {n}' },
        'expr_add':    { TW: '＋ 用右側內容新增', CN: '＋ 用右侧内容新增', EN: '＋ Add from editor', DE: '＋ Aus Editor hinzufügen', FR: '＋ Ajouter depuis l\'éditeur', RU: '＋ Добавить из редактора', UA: '＋ Додати з редактора' },
        'expr_hint':   { TW: '在右側設定好表情後，點某列「保存」或「＋新增」來儲存', CN: '在右侧设置好表情后，点某行「保存」或「＋新增」来保存', EN: 'Set up the expression on the right, then click a row\'s Save or Add to store it', DE: 'Mimik rechts einstellen, dann „Speichern" einer Zeile oder „Hinzufügen" klicken', FR: 'Réglez l\'expression à droite, puis cliquez sur Enregistrer d\'une ligne ou Ajouter', RU: 'Настройте мимику справа, затем нажмите «Сохранить» в строке или «Добавить»', UA: 'Налаштуйте міміку праворуч, потім натисніть «Зберегти» у рядку або «Додати»' },
        'eyebrows':    { TW: '眉毛', CN: '眉毛', EN: 'Brows', DE: 'Brauen', FR: 'Sourcils', RU: 'Брови', UA: 'Брови' },
        'eyes':        { TW: '眼睛', CN: '眼睛', EN: 'Eyes', DE: 'Augen', FR: 'Yeux', RU: 'Глаза', UA: 'Очі' },
        'mouth':       { TW: '嘴巴', CN: '嘴巴', EN: 'Mouth', DE: 'Mund', FR: 'Bouche', RU: 'Рот', UA: 'Рот' },
        'blush':       { TW: '臉紅', CN: '脸红', EN: 'Blush', DE: 'Erröten', FR: 'Rougeur', RU: 'Румянец', UA: 'Рум\'янець' },
        'exprNone':    { TW: '— 無 —', CN: '— 无 —', EN: '— None —', DE: '— Keine —', FR: '— Aucune —', RU: '— Нет —', UA: '— Немає —' },
        'previewLoading': { TW: '預覽載入中…', CN: '预览加载中…', EN: 'Loading preview…', DE: 'Vorschau lädt…', FR: 'Chargement…', RU: 'Загрузка…', UA: 'Завантаження…' },
        'confirmReplace': { TW: '會用右側的內容替換「{name}」的資料，確定嗎？', CN: '会用右侧的内容替换「{name}」的数据，确定吗？', EN: 'Replace "{name}" with the editor content?', DE: '„{name}" durch den Editor-Inhalt ersetzen?', FR: 'Remplacer « {name} » par le contenu de l\'éditeur ?', RU: 'Заменить «{name}» содержимым редактора?', UA: 'Замінити «{name}» вмістом редактора?' },
        'confirmDelete':  { TW: '確定刪除「{name}」嗎？', CN: '确定删除「{name}」吗？', EN: 'Delete "{name}"?', DE: '„{name}" löschen?', FR: 'Supprimer « {name} » ?', RU: 'Удалить «{name}»?', UA: 'Видалити «{name}»?' },
        'confirmReset':   { TW: '會清除所有自訂表情，恢復 4 組內建，確定嗎？', CN: '会清除所有自定义表情，恢复 4 组内建，确定吗？', EN: 'Clear all custom faces and restore the 4 built-ins?', DE: 'Alle eigenen Mimiken löschen und die 4 Standardwerte wiederherstellen?', FR: 'Effacer tous les visages personnalisés et restaurer les 4 par défaut ?', RU: 'Удалить все свои выражения и восстановить 4 встроенных?', UA: 'Видалити всі власні вирази та відновити 4 вбудованих?' },

        // ── 音效設定 ─────────────────────────────────────────────────
        'snd_lib':     { TW: '🔊 音效庫', CN: '🔊 音效库', EN: '🔊 Sound library', DE: '🔊 Tonbibliothek', FR: '🔊 Bibliothèque de sons', RU: '🔊 Библиотека звуков', UA: '🔊 Бібліотека звуків' },
        'snd_preset':  { TW: '預設', CN: '预设', EN: 'Preset', DE: 'Vorgabe', FR: 'Préréglage', RU: 'Пресет', UA: 'Пресет' },
        'snd_local':   { TW: '本機', CN: '本机', EN: 'Local', DE: 'Lokal', FR: 'Local', RU: 'Локально', UA: 'Локально' },
        'snd_assignTo':{ TW: '指派給「{label}」：點上面任一音效', CN: '指派给「{label}」：点上面任一音效', EN: 'Assign to "{label}": click a sound above', DE: '„{label}" zuweisen: oben einen Ton anklicken', FR: 'Affecter à « {label} » : cliquez un son ci-dessus', RU: 'Назначить «{label}»: выберите звук выше', UA: 'Призначити «{label}»: оберіть звук вище' },
        'snd_pickHint':{ TW: '點格子的「其他」後可在此指派；直接點則試聽。', CN: '点格子的「其他」后可在此指派；直接点则试听。', EN: 'Click a slot\'s "Other" to assign here; click directly to preview.', DE: 'Auf „Andere" eines Felds klicken zum Zuweisen; direkt klicken zum Anhören.', FR: 'Cliquez « Autre » d\'une case pour affecter ; cliquez directement pour écouter.', RU: 'Нажмите «Другое» у ячейки для назначения; нажмите прямо для прослушивания.', UA: 'Натисніть «Інше» у комірці для призначення; натисніть прямо для прослуховування.' },

        // ── 關於 ─────────────────────────────────────────────────────
        'about_author': { TW: '作者：莉柯莉絲(Likolisu)', CN: '作者：莉柯莉丝(Likolisu)', EN: 'Author: Likolisu', DE: 'Autor: Likolisu', FR: 'Auteur : Likolisu', RU: 'Автор: Likolisu', UA: 'Автор: Likolisu' },
        'about_dev':  { TW: '本插件為個人興趣開發，可能存在些許錯誤，歡迎到 GitHub 回報。', CN: '本插件为个人兴趣开发，可能存在些许错误，欢迎到 GitHub 回报。', EN: 'A personal hobby project; bugs may exist — please report on GitHub.', DE: 'Ein persönliches Hobbyprojekt; Fehler möglich — bitte auf GitHub melden.', FR: 'Projet personnel ; des bugs sont possibles — signalez-les sur GitHub.', RU: 'Личный проект; возможны ошибки — сообщайте на GitHub.', UA: 'Особистий проєкт; можливі помилки — повідомляйте на GitHub.' },
        'about_report': { TW: '🐛 GitHub 回報', CN: '🐛 GitHub 回报', EN: '🐛 Report on GitHub', DE: '🐛 Auf GitHub melden', FR: '🐛 Signaler sur GitHub', RU: '🐛 Сообщить на GitHub', UA: '🐛 Повідомити на GitHub' },
        'about_assets': { TW: '── 使用素材皆為免費素材 ──', CN: '── 使用素材皆为免费素材 ──', EN: '── All assets are free assets ──', DE: '── Alle Materialien sind kostenlos ──', FR: '── Tous les éléments sont gratuits ──', RU: '── Все материалы — бесплатные ──', UA: '── Усі матеріали — безкоштовні ──' },

        // ── 預設催眠文本（換行＝多句） ─────────────────────────────────
        'defaultTexts': {
            TW: '放鬆…放鬆…\n你的意識正在沉睡\n聽我的聲音\n什麼都不用想\n越來越深沉\n順從是舒服的\n沉淪下去吧\n好乖…好乖…',
            CN: '放松…放松…\n你的意识正在沉睡\n听我的声音\n什么都不用想\n越来越深沉\n顺从是舒服的\n沉沦下去吧\n好乖…好乖…',
            EN: 'Relax… relax…\nYour mind is falling asleep\nListen to my voice\nNo need to think\nDeeper and deeper\nObeying feels good\nSink down…\nGood girl… good girl…',
            DE: 'Entspann dich… entspann…\nDein Geist schläft ein\nHöre meine Stimme\nDenk an nichts\nTiefer und tiefer\nGehorchen fühlt sich gut an\nSink hinab…\nBraves Mädchen…',
            FR: 'Détends-toi… détends…\nTon esprit s\'endort\nÉcoute ma voix\nNe pense à rien\nDe plus en plus profond\nObéir fait du bien\nSombre…\nGentille fille…',
            RU: 'Расслабься… расслабься…\nТвой разум засыпает\nСлушай мой голос\nНи о чём не думай\nГлубже и глубже\nПодчиняться приятно\nПогружайся…\nХорошая девочка…',
            UA: 'Розслабся… розслабся…\nТвій розум засинає\nСлухай мій голос\nНі про що не думай\nГлибше й глибше\nКоритися приємно\nЗанурюйся…\nГарна дівчинка…',
        },
        // ── 預設狀態訊息（換行＝多句，動作格式會自動帶名字） ──────────────
        'defaultEmotes': {
            TW: '的思緒變得混亂了\n的兩眼變得空洞…\n的意識正在下沉\n微微晃了一下，失神了\n的表情變得恍惚',
            CN: '的思绪变得混乱了\n的两眼变得空洞…\n的意识正在下沉\n微微晃了一下，失神了\n的表情变得恍惚',
            EN: '\'s mind grows hazy\n\'s eyes go blank…\n\'s awareness sinks down\nsways slightly, dazed\n\'s expression turns vacant',
            DE: ' wird benommen\n Augen werden leer…\n Bewusstsein sinkt\n schwankt leicht, benommen\n Miene wird abwesend',
            FR: ' a l\'esprit embrumé\n a le regard vide…\n sombre dans la conscience\n vacille légèrement, hébété·e\n a l\'air absent',
            RU: ' разум туманится\n взгляд пустеет…\n сознание погружается\n слегка покачивается, в трансе\n выражение становится отрешённым',
            UA: ' розум туманіє\n погляд порожніє…\n свідомість занурюється\n трохи похитується, у трансі\n вираз стає відстороненим',
        },
    });

    if (window.Liko?.i18n) window.Liko.i18n._ivhStringsLoaded = true;
})();
