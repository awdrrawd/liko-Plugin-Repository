// Liko - IVH i18n 字庫
// 此檔案由 IVH 插件動態載入，不需手動安裝
// 載入後自動呼叫 register('IVH', {...})，將字串注入共用引擎 Liko-i18n
// 佔位符以 {name} 表示，由引擎 t('IVH', key, vars) 代入
// 語言：TW 繁中 / CN 簡中 / EN 英 / JP 日 / KR 韓 / DE 德 / FR 法 / RU 俄 / UA 烏

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko IVH strings] i18n 引擎尚未載入');
        return;
    }

    const IVH_STRINGS = {

        // ── 載入 / 指令 ───────────────────────────────────────────────
        'loaded': {
            TW: 'IVH v{v} 已載入 ✅\n/ivh help 說明 | /ivh setting 設定頁',
            CN: 'IVH v{v} 已加载 ✅\n/ivh help 说明 | /ivh setting 设置页',
            EN: 'IVH v{v} loaded ✅\n/ivh help | /ivh setting for settings',
            JP: 'IVH v{v} 読み込み完了 ✅\n/ivh help ヘルプ | /ivh setting 設定ページ',
            KR: 'IVH v{v} 로드됨 ✅\n/ivh help 도움말 | /ivh setting 설정 페이지',
            DE: 'IVH v{v} geladen ✅\n/ivh help | /ivh setting für Einstellungen',
            FR: 'IVH v{v} chargé ✅\n/ivh help | /ivh setting pour les réglages',
            RU: 'IVH v{v} загружен ✅\n/ivh help | /ivh setting — настройки',
            UA: 'IVH v{v} завантажено ✅\n/ivh help | /ivh setting — налаштування',
        },
        'help': {
            TW: '🌀 IVH v{v} 指令列表：\n  /ivh setting       — 開啟偏好設定頁\n  /ivh show          — 顯示控制面板\n  /ivh test [文字]   — 立即觸發效果\n  /ivh climax        — 測試高潮特效\n  /ivh depth [1~3]   — 測試催眠深度效果\n  /ivh calibrate     — 頭部座標校正面板\n  /ivh help          — 顯示此說明',
            CN: '🌀 IVH v{v} 指令列表：\n  /ivh setting       — 打开偏好设置页\n  /ivh show          — 显示控制面板\n  /ivh test [文字]   — 立即触发效果\n  /ivh climax        — 测试高潮特效\n  /ivh depth [1~3]   — 测试催眠深度效果\n  /ivh calibrate     — 头部坐标校正面板\n  /ivh help          — 显示此说明',
            EN: '🌀 IVH v{v} commands:\n  /ivh setting       — Open settings page\n  /ivh show          — Show control panel\n  /ivh test [text]   — Trigger effect now\n  /ivh climax        — Test climax effect\n  /ivh depth [1~3]   — Test depth effect\n  /ivh calibrate     — Head position calibration\n  /ivh help          — Show this help',
            JP: '🌀 IVH v{v} コマンド一覧：\n  /ivh setting       — 設定ページを開く\n  /ivh show          — コントロールパネル表示\n  /ivh test [文字]   — 効果を即時発動\n  /ivh climax        — 絶頂エフェクトをテスト\n  /ivh depth [1~3]   — 催眠深度エフェクトをテスト\n  /ivh calibrate     — 頭部座標の校正パネル\n  /ivh help          — このヘルプを表示',
            KR: '🌀 IVH v{v} 명령어 목록:\n  /ivh setting       — 설정 페이지 열기\n  /ivh show          — 컨트롤 패널 표시\n  /ivh test [문자]   — 효과 즉시 발동\n  /ivh climax        — 절정 효과 테스트\n  /ivh depth [1~3]   — 최면 심도 효과 테스트\n  /ivh calibrate     — 머리 좌표 보정 패널\n  /ivh help          — 이 도움말 표시',
            DE: '🌀 IVH v{v} Befehle:\n  /ivh setting       — Einstellungen öffnen\n  /ivh show          — Bedienfeld anzeigen\n  /ivh test [Text]   — Effekt jetzt auslösen\n  /ivh climax        — Höhepunkt-Effekt testen\n  /ivh depth [1~3]   — Tiefen-Effekt testen\n  /ivh calibrate     — Kopfposition kalibrieren\n  /ivh help          — Diese Hilfe anzeigen',
            FR: '🌀 IVH v{v} commandes :\n  /ivh setting       — Ouvrir les réglages\n  /ivh show          — Afficher le panneau\n  /ivh test [texte]  — Déclencher l\'effet\n  /ivh climax        — Tester l\'effet d\'apogée\n  /ivh depth [1~3]   — Tester l\'effet de profondeur\n  /ivh calibrate     — Calibrer la position de la tête\n  /ivh help          — Afficher cette aide',
            RU: '🌀 IVH v{v} команды:\n  /ivh setting       — Открыть настройки\n  /ivh show          — Показать панель\n  /ivh test [текст]  — Запустить эффект\n  /ivh climax        — Тест эффекта оргазма\n  /ivh depth [1~3]   — Тест эффекта глубины\n  /ivh calibrate     — Калибровка позиции головы\n  /ivh help          — Показать справку',
            UA: '🌀 IVH v{v} команди:\n  /ivh setting       — Відкрити налаштування\n  /ivh show          — Показати панель\n  /ivh test [текст]  — Запустити ефект\n  /ivh climax        — Тест ефекту оргазму\n  /ivh depth [1~3]   — Тест ефекту глибини\n  /ivh calibrate     — Калібрування позиції голови\n  /ivh help          — Показати довідку',
        },
        'cmdUnknown': {
            TW: '⚠️ [IVH] 未知指令「{sub}」，輸入 /ivh help 查看說明',
            CN: '⚠️ [IVH] 未知指令「{sub}」，输入 /ivh help 查看说明',
            EN: '⚠️ [IVH] Unknown command "{sub}", type /ivh help',
            JP: '⚠️ [IVH] 不明なコマンド「{sub}」、/ivh help を入力',
            KR: '⚠️ [IVH] 알 수 없는 명령「{sub}」, /ivh help 입력',
            DE: '⚠️ [IVH] Unbekannter Befehl „{sub}", /ivh help eingeben',
            FR: '⚠️ [IVH] Commande inconnue « {sub} », tapez /ivh help',
            RU: '⚠️ [IVH] Неизвестная команда «{sub}», введите /ivh help',
            UA: '⚠️ [IVH] Невідома команда «{sub}», введіть /ivh help',
        },
        'cantOpenSettings': { TW: '⚠️ 無法開啟設定頁（偏好系統未就緒）', CN: '⚠️ 无法打开设置页（偏好系统未就绪）', EN: '⚠️ Cannot open settings (preference not ready)', JP: '⚠️ 設定ページを開けません（プリファレンス未準備）', KR: '⚠️ 설정 페이지를 열 수 없습니다 (환경설정 미준비)', DE: '⚠️ Einstellungen können nicht geöffnet werden', FR: '⚠️ Impossible d\'ouvrir les réglages', RU: '⚠️ Не удаётся открыть настройки', UA: '⚠️ Не вдається відкрити налаштування' },
        'exportDone': { TW: '📤 IVH 設定已匯出 (IVH-settings.json)', CN: '📤 IVH 设置已导出 (IVH-settings.json)', EN: '📤 IVH settings exported (IVH-settings.json)', JP: '📤 IVH 設定をエクスポートしました (IVH-settings.json)', KR: '📤 IVH 설정을 내보냈습니다 (IVH-settings.json)', DE: '📤 IVH-Einstellungen exportiert', FR: '📤 Réglages IVH exportés', RU: '📤 Настройки IVH экспортированы', UA: '📤 Налаштування IVH експортовано' },
        'importDone': { TW: '📥 IVH 設定已匯入', CN: '📥 IVH 设置已导入', EN: '📥 IVH settings imported', JP: '📥 IVH 設定をインポートしました', KR: '📥 IVH 설정을 가져왔습니다', DE: '📥 IVH-Einstellungen importiert', FR: '📥 Réglages IVH importés', RU: '📥 Настройки IVH импортированы', UA: '📥 Налаштування IVH імпортовано' },
        'editedYourText': { TW: '📝 {who} 編輯了你的 IVH 催眠文本', CN: '📝 {who} 编辑了你的 IVH 催眠文本', EN: '📝 {who} edited your IVH hypnosis text', JP: '📝 {who} があなたの IVH 催眠テキストを編集しました', KR: '📝 {who} 님이 당신의 IVH 최면 텍스트를 편집했습니다', DE: '📝 {who} hat deinen IVH-Hypnosetext bearbeitet', FR: '📝 {who} a modifié votre texte d\'hypnose IVH', RU: '📝 {who} изменил(а) ваш текст гипноза IVH', UA: '📝 {who} змінив(ла) ваш текст гіпнозу IVH' },

        // ── 分頁名稱 ──────────────────────────────────────────────────
        'tab_basic':   { TW: '基本設定', CN: '基本设置', EN: 'Basic',      JP: '基本',       KR: '기본',     DE: 'Allgemein',   FR: 'Général',    RU: 'Основные',   UA: 'Основні' },
        'tab_effects': { TW: '效果設定', CN: '效果设置', EN: 'Effects',    JP: '効果',       KR: '효과',     DE: 'Effekte',     FR: 'Effets',     RU: 'Эффекты',    UA: 'Ефекти' },
        'tab_texts':   { TW: '文本設定', CN: '文本设置', EN: 'Texts',      JP: 'テキスト',   KR: '텍스트',   DE: 'Texte',       FR: 'Textes',     RU: 'Тексты',     UA: 'Тексти' },
        'tab_expr':    { TW: '表情設定', CN: '表情设置', EN: 'Expression', JP: '表情',       KR: '표정',     DE: 'Mimik',       FR: 'Expression', RU: 'Мимика',     UA: 'Міміка' },
        'tab_sounds':  { TW: '音效設定', CN: '音效设置', EN: 'Sounds',     JP: '音声',       KR: '사운드',   DE: 'Töne',        FR: 'Sons',       RU: 'Звуки',      UA: 'Звуки' },
        'tab_about':   { TW: '關於插件', CN: '关于插件', EN: 'About',      JP: '情報',       KR: '정보',     DE: 'Über',        FR: 'À propos',   RU: 'О плагине',  UA: 'Про плагін' },

        // ── 通用 ─────────────────────────────────────────────────────
        'exit':    { TW: '離開',   CN: '离开',   EN: 'Exit',    JP: '閉じる',     KR: '닫기',   DE: 'Schließen', FR: 'Quitter', RU: 'Выход',    UA: 'Вихід' },
        'info':    { TW: '── 說明 ──', CN: '── 说明 ──', EN: '── Info ──', JP: '── 説明 ──', KR: '── 설명 ──', DE: '── Info ──', FR: '── Info ──', RU: '── Справка ──', UA: '── Довідка ──' },
        'cancel':  { TW: '取消',   CN: '取消',   EN: 'Cancel',  JP: 'キャンセル', KR: '취소',   DE: 'Abbrechen', FR: 'Annuler', RU: 'Отмена',   UA: 'Скасувати' },
        'confirm': { TW: '確定',   CN: '确定',   EN: 'Confirm', JP: 'OK',         KR: '확인',   DE: 'OK',        FR: 'OK',      RU: 'OK',       UA: 'OK' },
        'save':    { TW: '💾 保存', CN: '💾 保存', EN: '💾 Save', JP: '💾 保存',   KR: '💾 저장', DE: '💾 Speichern', FR: '💾 Enregistrer', RU: '💾 Сохранить', UA: '💾 Зберегти' },
        'delete':  { TW: '🗑 刪除', CN: '🗑 删除', EN: '🗑 Delete', JP: '🗑 削除', KR: '🗑 삭제', DE: '🗑 Löschen', FR: '🗑 Supprimer', RU: '🗑 Удалить', UA: '🗑 Видалити' },
        'upload':  { TW: '上傳',   CN: '上传',   EN: 'Upload',  JP: 'アップロード', KR: '업로드', DE: 'Hochladen', FR: 'Téléverser', RU: 'Загрузить', UA: 'Завантажити' },
        'clear':   { TW: '清除',   CN: '清除',   EN: 'Clear',   JP: 'クリア',     KR: '지우기', DE: 'Leeren',    FR: 'Effacer', RU: 'Очистить', UA: 'Очистити' },
        'other':   { TW: '其他',   CN: '其他',   EN: 'Other',   JP: 'その他',     KR: '기타',   DE: 'Andere',    FR: 'Autre',   RU: 'Другое',   UA: 'Інше' },
        'restoreDefault': { TW: '還原預設', CN: '还原预设', EN: 'Reset', JP: 'リセット', KR: '초기화', DE: 'Zurücksetzen', FR: 'Réinitialiser', RU: 'Сброс', UA: 'Скинути' },
        'export':  { TW: '匯出設定', CN: '导出设置', EN: 'Export', JP: 'エクスポート', KR: '내보내기', DE: 'exportieren', FR: 'exporter', RU: 'Экспорт', UA: 'Експорт' },
        'import':  { TW: '匯入設定', CN: '导入设置', EN: 'Import', JP: 'インポート', KR: '가져오기', DE: 'importieren', FR: 'importer', RU: 'Импорт', UA: 'Імпорт' },

        // ── IVH 啟用 ─────────────────────────────────────────────────
        'enabledOn':  { TW: 'IVH 啟用中', CN: 'IVH 启用中', EN: 'IVH Enabled',  JP: 'IVH 有効',  KR: 'IVH 사용 중',     DE: 'IVH aktiv',     FR: 'IVH activé',   RU: 'IVH включён',  UA: 'IVH увімкнено' },
        'enabledOff': { TW: 'IVH 停用中', CN: 'IVH 停用中', EN: 'IVH Disabled', JP: 'IVH 無効',  KR: 'IVH 사용 안 함',  DE: 'IVH inaktiv',   FR: 'IVH désactivé', RU: 'IVH выключен', UA: 'IVH вимкнено' },
	'enabledDesc': {
	    "TW": "IVH 為提升催眠沉浸體驗的工具，需配合 BCX 或 IVH 催眠設定使用，包含視覺與音效等效果。所有功能皆可自訂，如感到任何不適，請立即調整設定或停用本插件。",
	    "CN": "IVH 为提升催眠沉浸体验的工具，需配合 BCX 或 IVH 催眠设定使用，包含视觉与音效等效果。所有功能皆可自定义，如感到任何不适，请立即调整设定或停用本插件。",
	    "EN": "IVH is a tool for enhancing hypnotic immersion, designed to be used with BCX or IVH hypnosis settings. It includes visual and audio effects. All features are customizable. If you experience any discomfort, please adjust the settings immediately or disable the plugin.",
	    "JP": "IVH は催眠没入体験を向上させるツールです。BCX または IVH の催眠設定と併用し、視覚効果や音響効果などを含みます。すべての機能はカスタマイズ可能です。不快に感じた場合は、すぐに設定を調整するか、プラグインを無効にしてください。",
	    "KR": "IVH는 최면 몰입 경험을 향상시키는 도구로, BCX 또는 IVH 최면 설정과 함께 사용해야 하며 시각 및 음향 효과를 포함합니다. 모든 기능은 사용자 정의가 가능합니다. 불편함을 느끼면 즉시 설정을 조정하거나 플러그인을 비활성화하세요.",
	    "DE": "IVH ist ein Tool zur Verbesserung des hypnotischen Eintauchens und wird in Verbindung mit BCX- oder IVH-Hypnoseeinstellungen verwendet. Es umfasst visuelle und akustische Effekte. Alle Funktionen sind anpassbar. Sollten Sie Unwohlsein verspüren, passen Sie bitte sofort die Einstellungen an oder deaktivieren Sie das Plugin.",
	    "FR": "IVH est un outil pour améliorer l'expérience d'immersion hypnotique, à utiliser avec les paramètres d'hypnose BCX ou IVH. Il comprend des effets visuels et sonores. Toutes les fonctionnalités sont personnalisables. En cas d'inconfort, veuillez ajuster immédiatement les paramètres ou désactiver le plugin.",
	    "RU": "IVH — это инструмент для улучшения гипнотического погружения, используемый вместе с настройками гипноза BCX или IVH. Включает визуальные и звуковые эффекты. Все функции настраиваемы. При возникновении дискомфорта немедленно отрегулируйте настройки или отключите плагин.",
	    "UA": "IVH — це інструмент для покращення гіпнотичного занурення, який використовується разом із налаштуваннями гіпнозу BCX або IVH. Включає візуальні та звукові ефекти. Усі функції налаштовуються. У разі дискомфорту негайно відрегулюйте налаштування або вимкніть плагін."
	},

        // ── 基本設定 ─────────────────────────────────────────────────
        'intensity':  { TW: '催眠強度', CN: '催眠强度', EN: 'Intensity', JP: '催眠強度', KR: '최면 강도', DE: 'Intensität', FR: 'Intensité', RU: 'Сила', UA: 'Сила' },
        'depthMax':   { TW: '催眠深度', CN: '催眠深度', EN: 'Depth',     JP: '催眠深度', KR: '최면 심도', DE: 'Tiefe',      FR: 'Profondeur', RU: 'Глубина', UA: 'Глибина' },
        'depthNone':  { TW: '無', CN: '无', EN: 'Off', JP: 'なし', KR: '없음', DE: 'Aus', FR: 'Aucun', RU: 'Нет', UA: 'Немає' },
        'depthLight': { TW: '輕', CN: '轻', EN: 'Light', JP: '弱', KR: '약', DE: 'Leicht', FR: 'Léger', RU: 'Слабо', UA: 'Слабко' },
        'depthMed':   { TW: '中', CN: '中', EN: 'Med', JP: '中', KR: '중', DE: 'Mittel', FR: 'Moyen', RU: 'Средне', UA: 'Середньо' },
        'depthHeavy': { TW: '重', CN: '重', EN: 'Heavy', JP: '強', KR: '강', DE: 'Stark', FR: 'Fort', RU: 'Сильно', UA: 'Сильно' },
        'interval':   { TW: '循環時間', CN: '循环时间', EN: 'Interval', JP: '周期', KR: '주기', DE: 'Intervall', FR: 'Intervalle', RU: 'Интервал', UA: 'Інтервал' },
        'minutes':    { TW: '分（1~99）', CN: '分（1~99）', EN: 'min (1~99)', JP: '分（1~99）', KR: '분 (1~99)', DE: 'Min. (1~99)', FR: 'min (1~99)', RU: 'мин (1~99)', UA: 'хв (1~99)' },
        'depthEffects': { TW: '── 深度效果 ──', CN: '── 深度效果 ──', EN: '── Depth FX ──', JP: '── 深度効果 ──', KR: '── 심도 효과 ──', DE: '── Tiefen-FX ──', FR: '── FX profondeur ──', RU: '── Эффекты глубины ──', UA: '── Ефекти глибини ──' },
        'triggerTarget': { TW: '觸發對象', CN: '触发对象', EN: 'Trigger by', JP: 'トリガー対象', KR: '트리거 대상', DE: 'Auslöser', FR: 'Déclencheur', RU: 'Кто запускает', UA: 'Хто запускає' },
        'anyone':     { TW: '任何人', CN: '任何人', EN: 'Anyone', JP: '全員', KR: '모두', DE: 'Jeder', FR: 'Tous', RU: 'Любой', UA: 'Будь-хто' },
        'whitelistOnly': { TW: '僅白名單', CN: '仅白名单', EN: 'Whitelist', JP: 'ホワイトリストのみ', KR: '화이트리스트만', DE: 'Nur Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'whitelist':  { TW: '白名單', CN: '白名单', EN: 'Whitelist', JP: 'ホワイトリスト', KR: '화이트리스트', DE: 'Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'allowOthersOn':  { TW: '允許他人增減我的文本：開', CN: '允许他人增减我的文本：开', EN: 'Allow others to edit my text: ON', JP: '他者によるテキスト編集：ON', KR: '타인의 텍스트 편집: 켜짐', DE: 'Andere dürfen meinen Text ändern: AN', FR: 'Autoriser autrui à modifier mon texte : OUI', RU: 'Разрешить другим менять мой текст: ВКЛ', UA: 'Дозволити іншим змінювати мій текст: УВІМК' },
        'allowOthersOff': { TW: '允許他人增減我的文本：關', CN: '允许他人增减我的文本：关', EN: 'Allow others to edit my text: OFF', JP: '他者によるテキスト編集：OFF', KR: '타인의 텍스트 편집: 꺼짐', DE: 'Andere dürfen meinen Text ändern: AUS', FR: 'Autoriser autrui à modifier mon texte : NON', RU: 'Разрешить другим менять мой текст: ВЫКЛ', UA: 'Дозволити іншим змінювати мій текст: ВИМК' },

        // ── 文本設定 ─────────────────────────────────────────────────
        'sec_hypnoText': { TW: '催眠文本', CN: '催眠文本', EN: 'Hypnosis text', JP: '催眠テキスト', KR: '최면 텍스트', DE: 'Hypnosetext', FR: 'Texte d\'hypnose', RU: 'Текст гипноза', UA: 'Текст гіпнозу' },
        'sec_statusMsg': { TW: '狀態訊息', CN: '状态信息', EN: 'Status message', JP: 'ステータスメッセージ', KR: '상태 메시지', DE: 'Statusnachricht', FR: 'Message d\'état', RU: 'Сообщение состояния', UA: 'Повідомлення стану' },
        'sec_triggerWords': { TW: '觸發詞', CN: '触发词', EN: 'Trigger words', JP: 'トリガーワード', KR: '트리거 단어', DE: 'Auslösewörter', FR: 'Mots déclencheurs', RU: 'Слова-триггеры', UA: 'Слова-тригери' },

        // ── 表情設定 ─────────────────────────────────────────────────
        'expr_edit':   { TW: '🎭 編輯表情', CN: '🎭 编辑表情', EN: '🎭 Edit expression', JP: '🎭 表情を編集', KR: '🎭 표정 편집', DE: '🎭 Mimik bearbeiten', FR: '🎭 Modifier l\'expression', RU: '🎭 Изменить мимику', UA: '🎭 Змінити міміку' },
        'expr_item':   { TW: '表情{n}', CN: '表情{n}', EN: 'Face {n}', JP: '表情{n}', KR: '표정{n}', DE: 'Mimik {n}', FR: 'Visage {n}', RU: 'Лицо {n}', UA: 'Обличчя {n}' },
        'expr_add':    { TW: '＋ 新增表情', CN: '＋ 新增表情', EN: '＋ Add from editor', JP: '＋ エディタから追加', KR: '＋ 편집기에서 추가', DE: '＋ Aus Editor hinzufügen', FR: '＋ Ajouter depuis l\'éditeur', RU: '＋ Добавить из редактора', UA: '＋ Додати з редактора' },
        'expr_hint':   { TW: '在右側設定好表情後，點某列「保存」或「＋新增」來儲存', CN: '在右侧设置好表情后，点某行「保存」或「＋新增」来保存', EN: 'Set up the expression on the right, then click a row\'s Save or Add to store it', JP: '右側で表情を設定後、各行の「保存」か「＋追加」で保存します', KR: '오른쪽에서 표정을 설정한 뒤, 각 행의 「저장」 또는 「＋추가」로 저장하세요', DE: 'Mimik rechts einstellen, dann „Speichern" einer Zeile oder „Hinzufügen" klicken', FR: 'Réglez l\'expression à droite, puis cliquez sur Enregistrer d\'une ligne ou Ajouter', RU: 'Настройте мимику справа, затем нажмите «Сохранить» в строке или «Добавить»', UA: 'Налаштуйте міміку праворуч, потім натисніть «Зберегти» у рядку або «Додати»' },
        'eyebrows':    { TW: '眉毛', CN: '眉毛', EN: 'Brows', JP: '眉', KR: '눈썹', DE: 'Brauen', FR: 'Sourcils', RU: 'Брови', UA: 'Брови' },
        'eyes':        { TW: '眼睛', CN: '眼睛', EN: 'Eyes', JP: '目', KR: '눈', DE: 'Augen', FR: 'Yeux', RU: 'Глаза', UA: 'Очі' },
        'mouth':       { TW: '嘴巴', CN: '嘴巴', EN: 'Mouth', JP: '口', KR: '입', DE: 'Mund', FR: 'Bouche', RU: 'Рот', UA: 'Рот' },
        'blush':       { TW: '臉紅', CN: '脸红', EN: 'Blush', JP: '赤面', KR: '홍조', DE: 'Erröten', FR: 'Rougeur', RU: 'Румянец', UA: 'Рум\'янець' },
        'exprNone':    { TW: '— 無 —', CN: '— 无 —', EN: '— None —', JP: '— なし —', KR: '— 없음 —', DE: '— Keine —', FR: '— Aucune —', RU: '— Нет —', UA: '— Немає —' },
        'previewLoading': { TW: '預覽載入中…', CN: '预览加载中…', EN: 'Loading preview…', JP: 'プレビュー読込中…', KR: '미리보기 로딩 중…', DE: 'Vorschau lädt…', FR: 'Chargement…', RU: 'Загрузка…', UA: 'Завантаження…' },
        'confirmReplace': { TW: '會用右側的內容替換「{name}」的資料，確定嗎？', CN: '会用右侧的内容替换「{name}」的数据，确定吗？', EN: 'Replace "{name}" with the editor content?', JP: 'エディタの内容で「{name}」を置き換えますか？', KR: '편집기 내용으로 「{name}」을(를) 교체할까요?', DE: '„{name}" durch den Editor-Inhalt ersetzen?', FR: 'Remplacer « {name} » par le contenu de l\'éditeur ?', RU: 'Заменить «{name}» содержимым редактора?', UA: 'Замінити «{name}» вмістом редактора?' },
        'confirmDelete':  { TW: '確定刪除「{name}」嗎？', CN: '确定删除「{name}」吗？', EN: 'Delete "{name}"?', JP: '「{name}」を削除しますか？', KR: '「{name}」을(를) 삭제할까요?', DE: '„{name}" löschen?', FR: 'Supprimer « {name} » ?', RU: 'Удалить «{name}»?', UA: 'Видалити «{name}»?' },
        'confirmReset':   { TW: '會清除所有自訂表情，恢復 4 組內建，確定嗎？', CN: '会清除所有自定义表情，恢复 4 组内建，确定吗？', EN: 'Clear all custom faces and restore the 4 built-ins?', JP: 'すべてのカスタム表情を消去し、内蔵4組を復元しますか？', KR: '모든 사용자 표정을 지우고 기본 4개를 복원할까요?', DE: 'Alle eigenen Mimiken löschen und die 4 Standardwerte wiederherstellen?', FR: 'Effacer tous les visages personnalisés et restaurer les 4 par défaut ?', RU: 'Удалить все свои выражения и восстановить 4 встроенных?', UA: 'Видалити всі власні вирази та відновити 4 вбудованих?' },

        // ── 音效設定 ─────────────────────────────────────────────────
        'snd_lib':     { TW: '🔊 音效庫', CN: '🔊 音效库', EN: '🔊 Sound library', JP: '🔊 音声ライブラリ', KR: '🔊 사운드 라이브러리', DE: '🔊 Tonbibliothek', FR: '🔊 Bibliothèque de sons', RU: '🔊 Библиотека звуков', UA: '🔊 Бібліотека звуків' },
        'snd_preset':  { TW: '預設', CN: '预设', EN: 'Preset', JP: 'プリセット', KR: '프리셋', DE: 'Vorgabe', FR: 'Préréglage', RU: 'Пресет', UA: 'Пресет' },
        'snd_local':   { TW: '本機', CN: '本机', EN: 'Local', JP: 'ローカル', KR: '로컬', DE: 'Lokal', FR: 'Local', RU: 'Локально', UA: 'Локально' },
        'snd_assignTo':{ TW: '指派給「{label}」：點上面任一音效', CN: '指派给「{label}」：点上面任一音效', EN: 'Assign to "{label}": click a sound above', JP: '「{label}」に割り当て：上の音声をクリック', KR: '「{label}」에 지정: 위 사운드 클릭', DE: '„{label}" zuweisen: oben einen Ton anklicken', FR: 'Affecter à « {label} » : cliquez un son ci-dessus', RU: 'Назначить «{label}»: выберите звук выше', UA: 'Призначити «{label}»: оберіть звук вище' },
        'snd_pickHint':{ TW: '點格子的「其他」後可在此指派；直接點則試聽。', CN: '点格子的「其他」后可在此指派；直接点则试听。', EN: 'Click a slot\'s "Other" to assign here; click directly to preview.', JP: 'スロットの「その他」を押すとここで割り当て；直接押すと試聴。', KR: '슬롯의 「기타」를 누르면 여기서 지정; 바로 누르면 미리듣기.', DE: 'Auf „Andere" eines Felds klicken zum Zuweisen; direkt klicken zum Anhören.', FR: 'Cliquez « Autre » d\'une case pour affecter ; cliquez directement pour écouter.', RU: 'Нажмите «Другое» у ячейки для назначения; нажмите прямо для прослушивания.', UA: 'Натисніть «Інше» у комірці для призначення; натисніть прямо для прослуховування.' },

        // ── 關於 ─────────────────────────────────────────────────────
        'about_author': { TW: '作者：莉柯莉絲(Likolisu)', CN: '作者：莉柯莉丝(Likolisu)', EN: 'Author: Likolisu', JP: '作者：Likolisu', KR: '제작자: Likolisu', DE: 'Autor: Likolisu', FR: 'Auteur : Likolisu', RU: 'Автор: Likolisu', UA: 'Автор: Likolisu' },
	'about_dev': {
	    "TW": "本插件僅提供催眠沉浸效果功能，所有文本、音效及預設內容皆可由使用者自行修改。作者不對使用者自訂內容、使用方式或因此產生之任何後果負責，如有其他錯誤或建議可到 GitHub 提出。",
	    "CN": "本插件仅提供催眠沉浸效果功能，所有文本、音效及预设内容皆可由用户自行修改。作者不对用户自定义内容、使用方式或因此产生之后果负责，如有其他错误或建议可到 GitHub 提出。",
	    "EN": "This plugin solely provides hypnotic immersion effects. All texts, audio, and default content are user-modifiable. The author assumes no responsibility for user-customized content, usage methods, or any consequences arising therefrom. For other bugs or suggestions, please submit them on GitHub.",
	    "JP": "このプラグインは催眠没入効果機能のみを提供します。すべてのテキスト、音声、およびデフォルトコンテンツはユーザーが自由に変更できます。作者はユーザーによるカスタマイズ内容、使用方法、またはそれにより生じるいかなる結果についても責任を負いません。その他の不具合や提案は GitHub までお願いします。",
	    "KR": "이 플러그인은 최면 몰입 효과 기능만을 제공합니다. 모든 텍스트, 음향 및 기본 콘텐츠는 사용자가 직접 수정할 수 있습니다. 저자는 사용자 맞춤 콘텐츠, 사용 방법 또는 이로 인해 발생하는 어떠한 결과에 대해서도 책임을 지지 않습니다. 기타 오류나 제안 사항은 GitHub에 제출해 주세요.",
	    "DE": "Dieses Plugin bietet ausschließlich hypnotische Immersionseffekte. Alle Texte, Audiomaterialien und Standardinhalte können vom Benutzer geändert werden. Der Autor übernimmt keine Verantwortung für benutzerdefinierte Inhalte, Nutzungsweisen oder daraus resultierende Folgen. Für weitere Fehler oder Vorschläge wenden Sie sich bitte an GitHub.",
	    "FR": "Ce plugin fournit uniquement des effets d'immersion hypnotique. Tous les textes, sons et contenus par défaut sont modifiables par l'utilisateur. L'auteur décline toute responsabilité quant au contenu personnalisé, aux méthodes d'utilisation ou aux conséquences qui en découlent. Pour d'autres bugs ou suggestions, veuillez les soumettre sur GitHub.",
	    "RU": "Этот плагин предоставляет исключительно эффекты гипнотического погружения. Все тексты, аудио и содержимое по умолчанию могут быть изменены пользователем. Автор не несёт ответственности за пользовательский контент, способы использования или любые последствия, возникающие в результате. О других ошибках или предложениях сообщайте на GitHub.",
	    "UA": "Цей плагін надає виключно ефекти гіпнотичного занурення. Усі тексти, аудіо та вміст за замовчуванням можуть бути змінені користувачем. Автор не несе відповідальності за користувацький вміст, способи використання або будь-які наслідки, що виникають у результаті. Про інші помилки або пропозиції повідомляйте на GitHub."
	},
        'about_report': { TW: '🐛 GitHub 回報', CN: '🐛 GitHub 回报', EN: '🐛 Report on GitHub', JP: '🐛 GitHub に報告', KR: '🐛 GitHub에 신고', DE: '🐛 Auf GitHub melden', FR: '🐛 Signaler sur GitHub', RU: '🐛 Сообщить на GitHub', UA: '🐛 Повідомити на GitHub' },
        'about_assets': { TW: '── 使用素材皆為免費素材 ──', CN: '── 使用素材皆为免费素材 ──', EN: '── All assets are free assets ──', JP: '── 使用素材はすべて無料素材です ──', KR: '── 사용된 모든 소재는 무료 소재입니다 ──', DE: '── Alle Materialien sind kostenlos ──', FR: '── Tous les éléments sont gratuits ──', RU: '── Все материалы — бесплатные ──', UA: '── Усі активи є безкоштовними ──' },

        // ── 基本設定 說明／深度效果／編輯模式／語言 ───────────────────
        'intensityD': { TW: '整體效果強度（0.1~3.0），同時決定背景深度等級（≈1輕/2中/3重，不超過深度上限）。可拖曳滑桿。', CN: '整体效果强度（0.1~3.0），同时决定背景深度等级（≈1轻/2中/3重，不超过深度上限）。可拖曳滑杆。', EN: 'Overall effect strength (0.1~3.0); also sets background depth level (≈1 light/2 med/3 heavy, capped by Depth). Drag the slider.', JP: '全体の効果強度（0.1~3.0）。背景の深度レベルも決定（≈1弱/2中/3強、深度上限を超えない）。スライダーで調整可。', KR: '전체 효과 강도(0.1~3.0). 배경 심도 레벨도 결정(≈1약/2중/3강, 심도 상한 초과 안 함). 슬라이더로 조절.', DE: 'Gesamtstärke (0.1~3.0); bestimmt auch die Tiefenstufe (≈1 leicht/2 mittel/3 stark, max. = Tiefe). Schieberegler ziehen.', FR: 'Force globale (0.1~3.0) ; définit aussi le niveau de profondeur (≈1 léger/2 moyen/3 fort, limité par Profondeur). Glissez le curseur.', RU: 'Общая сила (0.1~3.0); задаёт уровень глубины (≈1 слабо/2 средне/3 сильно, не выше Глубины). Тяните ползунок.', UA: 'Загальна сила (0.1~3.0); задає рівень глибини (≈1 слабко/2 середньо/3 сильно, не вище Глибини). Тягніть повзунок.' },
        'depthMaxD': { TW: '背景催眠的最深程度（與 VOICE 觸發分開）。「無」＝關閉背景循環。', CN: '背景催眠的最深程度（与 VOICE 触发分开）。「无」＝关闭背景循环。', EN: 'Max background hypnosis level (separate from VOICE). "Off" disables the loop.', JP: '背景催眠の最大深度（VOICE トリガーとは別）。「なし」＝背景ループを無効化。', KR: '배경 최면의 최대 심도(VOICE 트리거와 별개). 「없음」＝배경 루프 비활성화.', DE: 'Max. Hintergrund-Hypnosestufe (getrennt von VOICE). „Aus" deaktiviert die Schleife.', FR: 'Niveau max d\'hypnose de fond (séparé de VOICE). « Aucun » désactive la boucle.', RU: 'Макс. уровень фонового гипноза (отдельно от VOICE). «Нет» отключает цикл.', UA: 'Макс. рівень фонового гіпнозу (окремо від VOICE). «Немає» вимикає цикл.' },
        'intervalD': { TW: '每隔幾分鐘自動播放一次背景催眠（1~99）。深度「無」時不循環。', CN: '每隔几分钟自动播放一次背景催眠（1~99）。深度「无」时不循环。', EN: 'How often the background hypnosis plays (1~99 min). No loop when Depth is Off.', JP: '背景催眠が再生される間隔（1~99分）。深度「なし」ではループしません。', KR: '배경 최면 재생 간격(1~99분). 심도 「없음」이면 반복 안 함.', DE: 'Wie oft die Hintergrundhypnose abspielt (1~99 Min.). Keine Schleife bei Tiefe „Aus".', FR: 'Fréquence de l\'hypnose de fond (1~99 min). Pas de boucle si Profondeur = Aucun.', RU: 'Как часто играет фоновый гипноз (1~99 мин). Без цикла при Глубине «Нет».', UA: 'Як часто грає фоновий гіпноз (1~99 хв). Без циклу при Глибині «Немає».' },
        'depthRowLight': { TW: '深度輕', CN: '深度轻', EN: 'Light', JP: '深度弱', KR: '심도 약', DE: 'Leicht', FR: 'Léger', RU: 'Слабо', UA: 'Слабко' },
        'depthRowMed':   { TW: '深度中', CN: '深度中', EN: 'Med', JP: '深度中', KR: '심도 중', DE: 'Mittel', FR: 'Moyen', RU: 'Средне', UA: 'Середньо' },
        'depthRowHeavy': { TW: '深度重', CN: '深度重', EN: 'Heavy', JP: '深度強', KR: '심도 강', DE: 'Stark', FR: 'Fort', RU: 'Сильно', UA: 'Сильно' },
        'fx_smoke':   { TW: '煙霧', CN: '烟雾', EN: 'Smoke', JP: '煙', KR: '연기', DE: 'Rauch', FR: 'Fumée', RU: 'Дымка', UA: 'Дим' },
        'fx_smokeD':  { TW: '不定時淡粉煙霧', CN: '不定时淡粉烟雾', EN: 'Occasional pink haze', JP: '不定期の淡いピンクの煙', KR: '간헐적 연분홍 연기', DE: 'Gelegentlicher rosa Nebel', FR: 'Brume rose occasionnelle', RU: 'Редкая розовая дымка', UA: 'Зрідка рожевий серпанок' },
        'fx_pant':    { TW: '喘氣', CN: '喘气', EN: 'Pant', JP: '吐息', KR: '숨결', DE: 'Hecheln', FR: 'Halètement', RU: 'Дыхание', UA: 'Дихання' },
        'fx_pantD':   { TW: '規律喘氣白霧', CN: '规律喘气白雾', EN: 'Rhythmic breath fog', JP: '規則的な吐息の白霧', KR: '규칙적인 숨결 김', DE: 'Rhythmischer Atemnebel', FR: 'Buée de souffle rythmée', RU: 'Ритмичный парок дыхания', UA: 'Ритмічний парок дихання' },
        'fx_danmaku': { TW: '彈幕', CN: '弹幕', EN: 'Danmaku', JP: '弾幕', KR: '탄막', DE: 'Danmaku', FR: 'Danmaku', RU: 'Данмаку', UA: 'Данмаку' },
        'fx_danmakuD':{ TW: '聊天訊息變催眠彈幕', CN: '聊天信息变催眠弹幕', EN: 'Chat lines become hypno danmaku', JP: 'チャットが催眠弾幕に変化', KR: '채팅이 최면 탄막으로 변함', DE: 'Chat-Zeilen werden Hypno-Danmaku', FR: 'Le chat devient du danmaku hypnotique', RU: 'Чат становится гипно-данмаку', UA: 'Чат стає гіпно-данмаку' },
        'fx_Shadow':   { TW: '人影', CN: '人影', EN: 'Shadow', JP: '人影', KR: '그림자', DE: 'Schemen', FR: 'Ombre', RU: 'Тень', UA: 'Тінь' },
        'fx_ShadowD':  { TW: '背後低語人影＋耳邊文字', CN: '背后低语人影＋耳边文字', EN: 'Shadow whispering behind + text at your ear', JP: '背後に囁く人影＋耳元のテキスト', KR: '뒤에서 속삭이는 그림자＋귓가 텍스트', DE: 'Flüsternde Gestalt dahinter + Text am Ohr', FR: 'Silhouette qui murmure derrière + texte à l\'oreille', RU: 'Шепчущая фигура сзади + текст у уха', UA: 'Шепітна постать позаду + текст біля вуха' },
        'fx_figblur': { TW: '人物模糊', CN: '人物模糊', EN: 'Blur figure', JP: 'キャラぼかし', KR: '캐릭터 흐림', DE: 'Figur unscharf', FR: 'Flou perso', RU: 'Размытие фигуры', UA: 'Розмиття фігури' },
        'fx_figblurD':{ TW: '畫面模糊但人物/人影保持清晰', CN: '画面模糊但人物/人影保持清晰', EN: 'Screen blurs while figure/shadow stay sharp', JP: '画面はぼけるがキャラ／人影は鮮明なまま', KR: '화면은 흐려지지만 캐릭터/그림자는 선명', DE: 'Bild unscharf, Figur/Schemen bleiben scharf', FR: 'Écran flou, perso/ombre nets', RU: 'Экран размыт, фигура/тень чёткие', UA: 'Екран розмитий, фігура/тінь чіткі' },
        'fx_sfx':     { TW: '音效', CN: '音效', EN: 'SFX', JP: '効果音', KR: '효과음', DE: 'Ton', FR: 'Son', RU: 'Звук', UA: 'Звук' },
        'fx_sfxD':    { TW: '播放深度音效', CN: '播放深度音效', EN: 'Play the depth sound', JP: '深度効果音を再生', KR: '심도 효과음 재생', DE: 'Tiefen-Ton abspielen', FR: 'Joue le son de profondeur', RU: 'Воспроизвести звук глубины', UA: 'Відтворити звук глибини' },
        'fx_chatblur':{ TW: '聊天模糊', CN: '聊天模糊', EN: 'Blur chat', JP: 'チャットぼかし', KR: '채팅 흐림', DE: 'Chat unscharf', FR: 'Flou chat', RU: 'Размытие чата', UA: 'Розмиття чату' },
        'fx_chatblurD':{ TW: '右側聊天訊息模糊', CN: '右侧聊天信息模糊', EN: 'Blur the chat log on the right', JP: '右側のチャットログをぼかす', KR: '오른쪽 채팅 로그 흐림', DE: 'Chat-Log rechts unscharf', FR: 'Floute le journal de chat à droite', RU: 'Размыть журнал чата справа', UA: 'Розмити журнал чату праворуч' },
        'triggerTargetD': { TW: '誰說出觸發詞會讓你進入催眠。「僅白名單」時只有名單內成員有效。', CN: '谁说出触发词会让你进入催眠。「仅白名单」时只有名单内成员有效。', EN: 'Who can trigger your hypnosis by saying a trigger word. "Whitelist" = only listed members.', JP: '誰がトリガーワードであなたを催眠にできるか。「ホワイトリストのみ」＝リスト内のメンバーのみ。', KR: '누가 트리거 단어로 당신을 최면에 빠뜨릴 수 있는지. 「화이트리스트만」＝목록 내 멤버만.', DE: 'Wer dich per Auslösewort hypnotisieren kann. „Whitelist" = nur gelistete Mitglieder.', FR: 'Qui peut vous hypnotiser via un mot déclencheur. « Liste blanche » = membres listés seulement.', RU: 'Кто может запустить ваш гипноз словом-триггером. «Белый список» = только из списка.', UA: 'Хто може запустити ваш гіпноз словом-тригером. «Білий список» = лише зі списку.' },
        'allowEdit':  { TW: '允許文本修改', CN: '允许文本修改', EN: 'Allow text editing', JP: 'テキスト編集を許可', KR: '텍스트 편집 허용', DE: 'Text-Bearbeitung erlauben', FR: 'Autoriser l\'édition', RU: 'Разрешить правку текста', UA: 'Дозволити правку тексту' },
        'allowEditD': { TW: '誰可在你的角色資料頁增減你的催眠文本。「僅自己」只有你能編輯；「僅白名單」時名單內成員（含你自己）可編輯。', CN: '谁可在你的角色资料页增减你的催眠文本。「仅自己」只有你能编辑；「仅白名单」时名单内成员（含你自己）可编辑。', EN: 'Who can add/remove your hypnosis text from your profile. "Only me" = just you; "Whitelist" = listed members (incl. yourself).', JP: '誰があなたのプロフィールから催眠テキストを増減できるか。「自分のみ」＝あなただけ；「ホワイトリストのみ」＝リスト内（あなた含む）。', KR: '누가 프로필에서 당신의 최면 텍스트를 추가/삭제할 수 있는지. 「자신만」＝본인만; 「화이트리스트만」＝목록 멤버(본인 포함).', DE: 'Wer deinen Hypnosetext im Profil ändern darf. „Nur ich" = nur du; „Whitelist" = gelistete (inkl. dir).', FR: 'Qui peut modifier votre texte d\'hypnose. « Moi seul » = vous ; « Liste blanche » = membres listés (vous compris).', RU: 'Кто может менять ваш текст гипноза. «Только я» = вы; «Белый список» = из списка (включая вас).', UA: 'Хто може змінювати ваш текст гіпнозу. «Лише я» = ви; «Білий список» = зі списку (разом із вами).' },
        'editOff':       { TW: '僅自己', CN: '仅自己', EN: 'Only me', JP: '自分のみ', KR: '자신만', DE: 'Nur ich', FR: 'Moi seul', RU: 'Только я', UA: 'Лише я' },
        'editAny':       { TW: '所有人', CN: '所有人', EN: 'Anyone', JP: '全員', KR: '모두', DE: 'Jeder', FR: 'Tous', RU: 'Все', UA: 'Усі' },
        'editWhitelist': { TW: '僅白名單', CN: '仅白名单', EN: 'Whitelist', JP: 'ホワイトリストのみ', KR: '화이트리스트만', DE: 'Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'whitelistD': { TW: '會員編號，逗號或空白分隔。觸發對象與文本編輯共用此名單。', CN: '会员编号，逗号或空白分隔。触发对象与文本编辑共用此名单。', EN: 'Member numbers, comma/space separated. Shared by trigger target and text editing.', JP: '会員番号をカンマ／空白で区切る。トリガー対象とテキスト編集で共有。', KR: '회원 번호를 쉼표/공백으로 구분. 트리거 대상과 텍스트 편집이 공유.', DE: 'Mitgliedsnummern, durch Komma/Leerzeichen getrennt. Geteilt mit Auslöser und Bearbeitung.', FR: 'Numéros de membre, séparés par virgule/espace. Partagé par déclencheur et édition.', RU: 'Номера участников через запятую/пробел. Общий для триггера и редактирования.', UA: 'Номери учасників через кому/пробіл. Спільний для тригера й редагування.' },
        'whitelistPh': { TW: '例：12345, 67890', CN: '例：12345, 67890', EN: 'e.g. 12345, 67890', JP: '例：12345, 67890', KR: '예: 12345, 67890', DE: 'z. B. 12345, 67890', FR: 'ex. 12345, 67890', RU: 'напр. 12345, 67890', UA: 'напр. 12345, 67890' },
        'language':  { TW: '語言', CN: '语言', EN: 'Language', JP: '言語', KR: '언어', DE: 'Sprache', FR: 'Langue', RU: 'Язык', UA: 'Мова' },
        'languageD': { TW: '介面語言。Auto＝依遊戲登入語系；也可手動選擇。', CN: '界面语言。Auto＝依游戏登录语系；也可手动选择。', EN: 'UI language. Auto = follow game language; or pick manually.', JP: 'UI 言語。Auto＝ゲーム言語に従う；手動選択も可。', KR: 'UI 언어. Auto＝게임 언어 따름; 수동 선택도 가능.', DE: 'UI-Sprache. Auto = Spielsprache; oder manuell wählen.', FR: 'Langue de l\'interface. Auto = langue du jeu ; ou choisir manuellement.', RU: 'Язык интерфейса. Auto = язык игры; или выбрать вручную.', UA: 'Мова інтерфейсу. Auto = мова гри; або обрати вручну.' },
        'exportD': { TW: '把所有設定下載為 JSON 檔。', CN: '把所有设置下载为 JSON 档。', EN: 'Download all settings as a JSON file.', JP: 'すべての設定を JSON ファイルでダウンロード。', KR: '모든 설정을 JSON 파일로 다운로드.', DE: 'Alle Einstellungen als JSON-Datei herunterladen.', FR: 'Télécharger tous les réglages en JSON.', RU: 'Скачать все настройки как JSON.', UA: 'Завантажити всі налаштування як JSON.' },
        'importD': { TW: '從 JSON 檔還原所有設定。', CN: '从 JSON 档还原所有设置。', EN: 'Restore all settings from a JSON file.', JP: 'JSON ファイルからすべての設定を復元。', KR: 'JSON 파일에서 모든 설정 복원.', DE: 'Alle Einstellungen aus JSON-Datei wiederherstellen.', FR: 'Restaurer tous les réglages depuis un JSON.', RU: 'Восстановить все настройки из JSON.', UA: 'Відновити всі налаштування з JSON.' },

        // ── 效果設定 ───────────────────────────────────────────────────
        'effectsHint': { TW: '逐項開關 VOICE 觸發時的各種效果，滑鼠移到項目上可看說明。', CN: '逐项开关 VOICE 触发时的各种效果，鼠标移到项目上可看说明。', EN: 'Toggle each VOICE-trigger effect; hover an item to see its description.', JP: 'VOICE 発動時の各効果を個別に切替。項目にカーソルを合わせると説明が表示。', KR: 'VOICE 발동 시 각 효과를 개별 전환. 항목에 마우스를 올리면 설명 표시.', DE: 'Jeden VOICE-Effekt einzeln schalten; Maus über ein Element zeigt die Beschreibung.', FR: 'Activez chaque effet VOICE ; survolez un élément pour sa description.', RU: 'Включайте эффекты VOICE по отдельности; наведите курсор для описания.', UA: 'Вмикайте ефекти VOICE окремо; наведіть курсор для опису.' },
        'ev_pinkFlash':  { TW: '粉紅暈染', CN: '粉红晕染', EN: 'Pink Glow', JP: 'ピンク暈し', KR: '핑크 글로우', DE: 'Rosa Schimmer', FR: 'Lueur rose', RU: 'Розовое сияние', UA: 'Рожеве сяйво' },
        'ev_pinkFlashD': { TW: '畫面泛起粉紅光暈，營造迷濛氛圍。', CN: '画面泛起粉红光晕，营造迷蒙氛围。', EN: 'A pink glow washes over the screen for a hazy mood.', JP: '画面にピンクの光暈が広がり、朦朧とした雰囲気に。', KR: '화면에 핑크빛이 번져 몽롱한 분위기를 연출.', DE: 'Ein rosa Schimmer legt sich über den Bildschirm.', FR: 'Une lueur rose envahit l\'écran pour une ambiance floue.', RU: 'Розовое сияние окутывает экран, создавая дымку.', UA: 'Рожеве сяйво огортає екран, створюючи серпанок.' },
        'ev_hypnoSpiral':  { TW: '催眠螺旋', CN: '催眠螺旋', EN: 'Hypno Spiral', JP: '催眠スパイラル', KR: '최면 나선', DE: 'Hypno-Spirale', FR: 'Spirale hypno', RU: 'Гипноспираль', UA: 'Гіпноспіраль' },
        'ev_hypnoSpiralD': { TW: '在頭部上方出現旋轉螺旋。', CN: '在头部上方出现旋转螺旋。', EN: 'A spinning spiral appears above the head.', JP: '頭上に回転するスパイラルが現れる。', KR: '머리 위에 회전하는 나선이 나타남.', DE: 'Eine drehende Spirale über dem Kopf.', FR: 'Une spirale tournante apparaît au-dessus de la tête.', RU: 'Над головой появляется вращающаяся спираль.', UA: 'Над головою з\'являється обертова спіраль.' },
        'ev_hypnoWaves':  { TW: '同心電波', CN: '同心电波', EN: 'Ripple Waves', JP: '同心波', KR: '동심파', DE: 'Wellen', FR: 'Ondes', RU: 'Волны', UA: 'Хвилі' },
        'ev_hypnoWavesD': { TW: '畫面左側出現向外擴張的同心圓波。', CN: '画面左侧出现向外扩张的同心圆波。', EN: 'Concentric waves expand from the left.', JP: '画面左側に外へ広がる同心円の波。', KR: '화면 왼쪽에서 바깥으로 퍼지는 동심원 파동.', DE: 'Konzentrische Wellen breiten sich links aus.', FR: 'Des ondes concentriques s\'étendent à gauche.', RU: 'Концентрические волны расходятся слева.', UA: 'Концентричні хвилі розходяться зліва.' },
        'ev_screenDistort':  { TW: '畫面扭曲', CN: '画面扭曲', EN: 'Distortion', JP: '画面歪み', KR: '화면 왜곡', DE: 'Verzerrung', FR: 'Distorsion', RU: 'Искажение', UA: 'Спотворення' },
        'ev_screenDistortD': { TW: '畫面輕微旋轉模糊，像意識被攪動。', CN: '画面轻微旋转模糊，像意识被搅动。', EN: 'The screen slightly twists and blurs.', JP: '画面がわずかに回転・ぼやけ、意識がかき乱される感覚。', KR: '화면이 약간 비틀리고 흐려져 의식이 흐트러지는 느낌.', DE: 'Der Bildschirm dreht und verschwimmt leicht.', FR: 'L\'écran tournoie et se floute légèrement.', RU: 'Экран слегка крутится и размывается.', UA: 'Екран злегка крутиться й розмивається.' },
        'ev_vignette':  { TW: '邊緣暗角', CN: '边缘暗角', EN: 'Vignette', JP: 'ビネット', KR: '비네트', DE: 'Vignette', FR: 'Vignette', RU: 'Виньетка', UA: 'Віньєтка' },
        'ev_vignetteD': { TW: '畫面四周變暗，聚焦中央。', CN: '画面四周变暗，聚焦中央。', EN: 'Edges darken to focus the center.', JP: '画面の四隅が暗くなり中央に集中。', KR: '화면 가장자리가 어두워지며 중앙에 집중.', DE: 'Ränder verdunkeln, Fokus auf die Mitte.', FR: 'Les bords s\'assombrissent pour centrer.', RU: 'Края темнеют, фокус по центру.', UA: 'Краї темніють, фокус по центру.' },
        'ev_danmaku':  { TW: '彈幕文字', CN: '弹幕文字', EN: 'Danmaku Text', JP: '弾幕テキスト', KR: '탄막 텍스트', DE: 'Danmaku-Text', FR: 'Texte danmaku', RU: 'Текст данмаку', UA: 'Текст данмаку' },
        'ev_danmakuD': { TW: '主台詞在頭上、旁白句散落左側（含聊天歷史）。', CN: '主台词在头上、旁白句散落左侧（含聊天历史）。', EN: 'Main line over the head; narration scatters on the left (incl. chat history).', JP: 'メイン台詞は頭上、ナレーションは左側に散らばる（チャット履歴含む）。', KR: '메인 대사는 머리 위, 내레이션은 왼쪽에 흩어짐(채팅 기록 포함).', DE: 'Hauptzeile über dem Kopf; Erzählung links verteilt (inkl. Chatverlauf).', FR: 'Réplique principale au-dessus ; narration dispersée à gauche (avec historique).', RU: 'Главная фраза над головой; реплики слева (с историей чата).', UA: 'Головна фраза над головою; репліки зліва (з історією чату).' },
        'ev_steam':  { TW: '喘氣白霧', CN: '喘气白雾', EN: 'Breath Fog', JP: '吐息の白霧', KR: '숨결 김', DE: 'Atemnebel', FR: 'Buée', RU: 'Парок дыхания', UA: 'Парок дихання' },
        'ev_steamD': { TW: '嘴邊呼出柔和白霧，向左右下方飄散。', CN: '嘴边呼出柔和白雾，向左右下方飘散。', EN: 'Soft fog drifts from the mouth.', JP: '口元から柔らかな白霧が漂う。', KR: '입가에서 부드러운 김이 피어오름.', DE: 'Sanfter Nebel steigt vom Mund auf.', FR: 'Une buée douce s\'échappe de la bouche.', RU: 'Мягкий парок исходит изо рта.', UA: 'М\'який парок виходить із рота.' },
        'ev_expression':  { TW: '表情切換', CN: '表情切换', EN: 'Expression', JP: '表情切替', KR: '표정 전환', DE: 'Ausdruck', FR: 'Expression', RU: 'Выражение', UA: 'Вираз' },
        'ev_expressionD': { TW: '催眠時隨機套用表情，結束後還原。', CN: '催眠时随机套用表情，结束后还原。', EN: 'Apply a random expression while hypnotized, then restore.', JP: '催眠中にランダムな表情を適用し、終了後に復元。', KR: '최면 중 무작위 표정을 적용하고 종료 후 복원.', DE: 'Zufälliger Ausdruck während der Hypnose, danach zurück.', FR: 'Expression aléatoire pendant l\'hypnose, puis restaurée.', RU: 'Случайное выражение во время гипноза, затем возврат.', UA: 'Випадковий вираз під час гіпнозу, потім повернення.' },
        'ev_climax':  { TW: '高潮特效', CN: '高潮特效', EN: 'Climax FX', JP: '絶頂エフェクト', KR: '절정 효과', DE: 'Höhepunkt-FX', FR: 'Effet climax', RU: 'Эффект пика', UA: 'Ефект піку' },
        'ev_climaxD': { TW: '畫面碎裂＋紅白閃光＋震動。', CN: '画面碎裂＋红白闪光＋震动。', EN: 'Screen shatter + red/white flash + shake.', JP: '画面破砕＋赤白の閃光＋振動。', KR: '화면 깨짐＋적백 섬광＋진동.', DE: 'Bildbruch + rot/weißer Blitz + Beben.', FR: 'Écran brisé + flash rouge/blanc + secousse.', RU: 'Раскол экрана + красно-белая вспышка + тряска.', UA: 'Розкол екрана + червоно-білий спалах + трясіння.' },
        'ev_sound':  { TW: '喘息聲音', CN: '喘息声音', EN: 'Breath Sound', JP: '吐息の音', KR: '숨소리', DE: 'Atemton', FR: 'Son de souffle', RU: 'Звук дыхания', UA: 'Звук дихання' },
        'ev_soundD': { TW: '播放喘息音效（需音效設定）。', CN: '播放喘息音效（需音效设置）。', EN: 'Play a breath sound (needs Sound settings).', JP: '吐息の効果音を再生（音声設定が必要）。', KR: '숨소리 효과음 재생(사운드 설정 필요).', DE: 'Atemton abspielen (Ton-Einstellungen nötig).', FR: 'Joue un son de souffle (réglages son requis).', RU: 'Воспроизвести звук дыхания (нужны настройки звука).', UA: 'Відтворити звук дихання (потрібні налаштування звуку).' },
        'ev_headshot':  { TW: '中央頭像', CN: '中央头像', EN: 'Center Headshot', JP: '中央ポートレート', KR: '중앙 얼굴', DE: 'Zentrales Porträt', FR: 'Portrait central', RU: 'Портрет в центре', UA: 'Портрет у центрі' },
        'ev_headshotD': { TW: '每次觸發在畫面中央裁出頭像，螺旋／喘氣以它為基準（忽略分頁）。', CN: '每次触发在画面中央裁出头像，螺旋／喘气以它为基准（忽略分页）。', EN: 'Crop a centered headshot each trigger; spiral/breath anchor to it (ignores paging).', JP: '発動毎に中央へポートレートを切り出し、スパイラル／吐息の基準にする（ページ無視）。', KR: '발동마다 중앙에 얼굴을 잘라내 나선/숨결의 기준으로 사용(페이지 무시).', DE: 'Bei jedem Auslöser ein zentriertes Porträt; Spirale/Atem daran ausgerichtet (ignoriert Seiten).', FR: 'Portrait centré à chaque déclenchement ; spirale/souffle s\'y ancrent (ignore la pagination).', RU: 'Портрет по центру при каждом срабатывании; спираль/дыхание привязаны к нему (без учёта страниц).', UA: 'Портрет у центрі при кожному спрацюванні; спіраль/дихання прив\'язані до нього (без сторінок).' },
	'ev_dualSound': {TW: '觸發音疊加', CN: '触发音叠加', EN: 'Trigger Overlay', JP: 'トリガー音重ね', KR: '트리거음 중첩', DE: 'Auslöser-Overlay',  FR: 'Superposition déclencheur', RU: 'Наложение триггера', UA: 'Накладання тригера'},
	'ev_dualSoundD': {
	    TW: '播放催眠聲音的同時，額外疊放一個觸發音（鐘擺等，使用「觸發音」分類音效）。',
	    CN: '播放催眠声音的同时，额外叠放一个触发音（钟摆等，使用「触发音」分类音效）。',
	    EN: 'While playing the hypnosis voice, additionally layer a trigger sound (pendulum, etc., from the "Trigger" category).',
	    JP: '催眠音声を再生しながら、追加でトリガー音（振り子など「トリガー音」カテゴリ）を重ねる。',
	    KR: '최면 음성을 재생하면서 추가로 트리거음(시계추 등 「트리거음」 카테고리)을 중첩.',
	    DE: 'Während der Hypnose-Stimme wird zusätzlich ein Auslöser-Ton (Pendel usw. aus der Kategorie "Auslöser") überlagert.',
	    FR: 'Pendant la lecture de la voix hypnotique, superpose en plus un son déclencheur (pendule, etc., de la catégorie « Déclencheur »).',
	    RU: 'Во время воспроизведения гипно-голоса дополнительно накладывается звук-триггер (маятник и т.п. из категории «Триггер»).',
	    UA: 'Під час відтворення гіпно-голосу додатково накладається звук-тригер (маятник тощо з категорії «Тригер»).'
	},
        'ev_emote':  { TW: '狀態訊息', CN: '状态信息', EN: 'Status Emote', JP: 'ステータス表現', KR: '상태 이모트', DE: 'Status-Emote', FR: 'Statut emote', RU: 'Статус-эмоция', UA: 'Статус-емоція' },
        'ev_emoteD': { TW: '觸發時發送一條動作訊息，讓他人知道你的狀態。', CN: '触发时发送一条动作信息，让他人知道你的状态。', EN: 'Send an action message on trigger so others see your state.', JP: '発動時に動作メッセージを送り、状態を他者に知らせる。', KR: '발동 시 동작 메시지를 보내 상태를 타인에게 알림.', DE: 'Beim Auslösen eine Aktionsnachricht senden, damit andere deinen Zustand sehen.', FR: 'Envoie un message d\'action au déclenchement pour montrer votre état.', RU: 'Отправляет сообщение-действие при срабатывании, чтобы показать ваше состояние.', UA: 'Надсилає повідомлення-дію при спрацюванні, щоб показати ваш стан.' },
        'climaxMode':  { TW: '高潮模式', CN: '高潮模式', EN: 'Climax mode', JP: '絶頂モード', KR: '절정 모드', DE: 'Höhepunkt-Modus', FR: 'Mode apogée', RU: 'Режим оргазма', UA: 'Режим оргазму' },
        'climaxModeD': { TW: '「僅高潮時」＝BC 真正高潮才放破碎特效；「每次觸發」＝每次催眠都放。', CN: '「仅高潮时」＝BC 真正高潮才放破碎特效；「每次触发」＝每次催眠都放。', EN: '"On orgasm" = shatter FX only on real BC orgasm; "Every trigger" = on every hypnosis.', JP: '「絶頂時のみ」＝BC の実際の絶頂時のみ破砕効果；「毎回」＝催眠毎に発動。', KR: '「절정 시에만」＝BC 실제 절정에만 깨짐 효과; 「매번」＝최면마다 발동.', DE: '„Bei Orgasmus" = Bruch-FX nur bei echtem BC-Orgasmus; „Jeder Auslöser" = bei jeder Hypnose.', FR: '« À l\'orgasme » = effet seulement au vrai orgasme BC ; « Chaque déclenchement » = à chaque hypnose.', RU: '«При оргазме» = эффект только при реальном оргазме BC; «Каждый триггер» = при каждом гипнозе.', UA: '«При оргазмі» = ефект лише при справжньому оргазмі BC; «Кожен тригер» = при кожному гіпнозі.' },
        'climaxEvery':  { TW: '每次觸發', CN: '每次触发', EN: 'Every trigger', JP: '毎回', KR: '매번', DE: 'Jeder Auslöser', FR: 'Chaque déclenchement', RU: 'Каждый триггер', UA: 'Кожен тригер' },
        'climaxOrgasm': { TW: '僅高潮時', CN: '仅高潮时', EN: 'On orgasm', JP: '絶頂時のみ', KR: '절정 시에만', DE: 'Bei Orgasmus', FR: 'À l\'orgasme', RU: 'При оргазме', UA: 'При оргазмі' },

        // ── 文本設定 ───────────────────────────────────────────────────
        'textsHint': { TW: '每行一句，使用 $me 代表被催眠者名稱。', CN: '每行一句，使用 $me 代表被催眠者名称。', EN: 'One line per sentence; $me = the hypnotized person\'s name.', JP: '1行1文、$me は被催眠者の名前を表します。', KR: '한 줄에 한 문장, $me 는 피최면자의 이름을 나타냄.', DE: 'Eine Zeile pro Satz; $me = Name der hypnotisierten Person.', FR: 'Une ligne par phrase ; $me = nom de la personne hypnotisée.', RU: 'Одна строка — одна фраза; $me = имя загипнотизированного.', UA: 'Один рядок — одна фраза; $me = ім\'я загіпнотизованого.' },
        'hypnoTextD': { TW: '彈幕／人影旁白來源，會和 BCX 的聽我聲音一起使用，僅被催眠者能看見。', CN: '弹幕／人影旁白来源，会和 BCX 的听我声音一起使用，仅被催眠者能看见。', EN: 'Source for danmaku/shadow narration; used together with BCX "listen to me", only the hypnotized sees it.', JP: '弾幕／人影ナレーションのソース。BCX の「聞いて」と併用、被催眠者のみが見える。', KR: '탄막/그림자 내레이션 소스. BCX 「내 말 들어」와 함께 사용, 피최면자만 볼 수 있음.', DE: 'Quelle für Danmaku/Schemen-Erzählung; zusammen mit BCX „hör mir zu", nur der Hypnotisierte sieht es.', FR: 'Source de la narration danmaku/ombre ; utilisée avec « écoute-moi » de BCX, visible par l\'hypnotisé seul.', RU: 'Источник текста данмаку/тени; вместе с BCX «слушай меня», видит только загипнотизированный.', UA: 'Джерело тексту данмаку/тіні; разом із BCX «слухай мене», бачить лише загіпнотизований.' },
        'hypnoTextPh': { TW: '例：$me 好乖…放鬆…', CN: '例：$me 好乖…放松…', EN: 'e.g. $me, good… relax…', JP: '例：$me いい子だ…リラックス…', KR: '예: $me 착하지…긴장을 풀어…', DE: 'z. B. $me, brav… entspann dich…', FR: 'ex. $me, sage… détends-toi…', RU: 'напр. $me, умница… расслабься…', UA: 'напр. $me, молодець… розслабся…' },
        'statusMsgD': { TW: '觸發催眠時隨機發送的動作訊息。', CN: '触发催眠时随机发送的动作信息。', EN: 'Action message sent at random when hypnosis triggers.', JP: '催眠発動時にランダムで送る動作メッセージ。', KR: '최면 발동 시 무작위로 보내는 동작 메시지.', DE: 'Aktionsnachricht, die beim Auslösen zufällig gesendet wird.', FR: 'Message d\'action envoyé au hasard au déclenchement.', RU: 'Сообщение-действие, отправляемое случайно при срабатывании.', UA: 'Повідомлення-дія, що надсилається випадково при спрацюванні.' },
        'statusMsgPh': { TW: '例：$me 的思緒變得混亂了', CN: '例：$me 的思绪变得混乱了', EN: 'e.g. $me\'s mind grows hazy', JP: '例：$me の思考が混濁してきた', KR: '예: $me 의 생각이 흐려진다', DE: 'z. B. $me wird benommen', FR: 'ex. $me a l\'esprit embrumé', RU: 'напр. $me разум туманится', UA: 'напр. $me розум туманіє' },
        'triggerWordsD': { TW: '白名單成員在聊天說出含這些詞的訊息時會觸發你的催眠（[Voice] 永遠有效）。每行一個。', CN: '白名单成员在聊天说出含这些词的信息时会触发你的催眠（[Voice] 永远有效）。每行一个。', EN: 'When a whitelisted member says these words in chat, your hypnosis triggers ([Voice] always works). One per line.', JP: 'ホワイトリストのメンバーがこれらの語を含む発言をすると催眠が発動（[Voice] は常に有効）。1行1語。', KR: '화이트리스트 멤버가 이 단어를 채팅에 말하면 최면 발동([Voice]는 항상 작동). 한 줄에 하나.', DE: 'Wenn ein gelistetes Mitglied diese Wörter im Chat sagt, wird deine Hypnose ausgelöst ([Voice] immer aktiv). Eines pro Zeile.', FR: 'Quand un membre listé dit ces mots dans le chat, votre hypnose se déclenche ([Voice] toujours actif). Un par ligne.', RU: 'Когда участник из списка говорит эти слова в чате, срабатывает гипноз ([Voice] всегда). По одному на строку.', UA: 'Коли учасник зі списку каже ці слова в чаті, спрацьовує гіпноз ([Voice] завжди). По одному на рядок.' },
        'triggerWordsPh': { TW: '例：催眠　沉睡', CN: '例：催眠　沉睡', EN: 'e.g. hypnosis  sleep', JP: '例：催眠　眠り', KR: '예: 최면　잠', DE: 'z. B. Hypnose  Schlaf', FR: 'ex. hypnose  sommeil', RU: 'напр. гипноз  сон', UA: 'напр. гіпноз  сон' },

        // ── 音效設定 ───────────────────────────────────────────────────
        'soundsHint': { TW: '每格可貼網址或「上傳」本機檔。「▶」試聽、「✕」清除、「其他」從右側音效庫選用。空白＝預設。', CN: '每格可贴网址或「上传」本机档。「▶」试听、「✕」清除、「其他」从右侧音效库选用。空白＝默认。', EN: 'Paste a URL or "Upload" a local file in each slot. ▶ preview, ✕ clear, "Other" picks from the right library. Blank = default.', JP: '各スロットに URL を貼るか「アップロード」。▶試聴、✕クリア、「その他」で右のライブラリから選択。空欄＝デフォルト。', KR: '각 슬롯에 URL을 붙이거나 「업로드」. ▶미리듣기, ✕지우기, 「기타」로 오른쪽 라이브러리에서 선택. 공백＝기본값.', DE: 'URL einfügen oder lokale Datei „Hochladen". ▶ Vorhören, ✕ Löschen, „Andere" wählt aus der Bibliothek rechts. Leer = Standard.', FR: 'Collez une URL ou « Téléverser » un fichier local. ▶ écouter, ✕ effacer, « Autre » choisit dans la bibliothèque à droite. Vide = défaut.', RU: 'Вставьте URL или «Загрузить» локальный файл. ▶ прослушать, ✕ очистить, «Другое» — из библиотеки справа. Пусто = по умолчанию.', UA: 'Вставте URL або «Завантажити» локальний файл. ▶ прослухати, ✕ очистити, «Інше» — з бібліотеки праворуч. Порожньо = типово.' },
        'sndCat_hypno':  { TW: '催眠', CN: '催眠', EN: 'Hypno', JP: '催眠', KR: '최면', DE: 'Hypno', FR: 'Hypno', RU: 'Гипно', UA: 'Гіпно' },
	'sndCat_trigger':  { TW: '觸發音', CN: '触发音', EN: 'Trigger', JP: 'トリガー音', KR: '트리거음', DE: 'Auslöser', FR: 'Déclencheur', RU: 'Триггер', UA: 'Тригер' },
        'sndCat_climax': { TW: '高潮', CN: '高潮', EN: 'Climax', JP: '絶頂', KR: '절정', DE: 'Höhepunkt', FR: 'Apogée', RU: 'Пик', UA: 'Пік' },
        'sndCat_depth':  { TW: '深度', CN: '深度', EN: 'Depth', JP: '深度', KR: '심도', DE: 'Tiefe', FR: 'Profondeur', RU: 'Глубина', UA: 'Глибина' },
        'sndSlotHead':   { TW: '{name}音效（最多 {max}）', CN: '{name}音效（最多 {max}）', EN: '{name} sounds (max {max})', JP: '{name}音声（最大 {max}）', KR: '{name} 사운드(최대 {max})', DE: '{name}-Töne (max. {max})', FR: 'Sons {name} (max {max})', RU: 'Звуки «{name}» (макс. {max})', UA: 'Звуки «{name}» (макс. {max})' },
        'sndDefaultPh':  { TW: '（預設）{file}', CN: '（默认）{file}', EN: '(default) {file}', JP: '（デフォルト）{file}', KR: '(기본값) {file}', DE: '(Standard) {file}', FR: '(défaut) {file}', RU: '(по умолч.) {file}', UA: '(типово) {file}' },
        'sndUnsetPh':    { TW: '未設定 — 網址／上傳／其他', CN: '未设定 — 网址／上传／其他', EN: 'Unset — URL / Upload / Other', JP: '未設定 — URL／アップロード／その他', KR: '미설정 — URL／업로드／기타', DE: 'Nicht gesetzt — URL / Hochladen / Andere', FR: 'Non défini — URL / Téléverser / Autre', RU: 'Не задано — URL / Загрузить / Другое', UA: 'Не задано — URL / Завантажити / Інше' },
        'sndLocalName':  { TW: '本機音效', CN: '本机音效', EN: 'Local sound', JP: 'ローカル音声', KR: '로컬 사운드', DE: 'Lokaler Ton', FR: 'Son local', RU: 'Локальный звук', UA: 'Локальний звук' },

        // ── 預設催眠文本（換行＝多句） ─────────────────────────────────
        'defaultTexts': {
            TW: '放鬆…放鬆…\n你的意識正在沉睡\n聽我的聲音\n什麼都不用想\n越來越深沉\n順從是舒服的\n沉淪下去吧\n好乖…好乖…',
            CN: '放松…放松…\n你的意识正在沉睡\n听我的声音\n什么都不用想\n越来越深沉\n顺从是舒服的\n沉沦下去吧\n好乖…好乖…',
            EN: 'Relax… relax…\nYour mind is falling asleep\nListen to my voice\nNo need to think\nDeeper and deeper\nObeying feels good\nSink down…\nGood girl… good girl…',
            JP: 'リラックス…リラックス…\nあなたの意識は眠りに落ちていく\n私の声を聞いて\n何も考えなくていい\nどんどん深く\n従うのは心地いい\n沈んでいって…\nいい子だ…いい子だ…',
            KR: '긴장을 풀어…긴장을 풀어…\n당신의 의식이 잠들고 있어\n내 목소리를 들어\n아무것도 생각하지 마\n점점 더 깊이\n순종은 편안해\n가라앉아…\n착하지…착하지…',
            DE: 'Entspann dich… entspann…\nDein Geist schläft ein\nHöre meine Stimme\nDenk an nichts\nTiefer und tiefer\nGehorchen fühlt sich gut an\nSink hinab…\nBraves Mädchen…',
            FR: 'Détends-toi… détends…\nTon esprit s\'endort\nÉcoute ma voix\nNe pense à rien\nDe plus en plus profond\nObéir fait du bien\nSombre…\nGentille fille…',
            RU: 'Расслабься… расслабься…\nТвой разум засыпает\nСлушай мой голос\nНи о чём не думай\nГлубже и глубже\nПодчиняться приятно\nПогружайся…\nХорошая девочка…',
            UA: 'Розслабся… розслабся…\nТвій розум засинає\nСлухай мій голос\nНі про що не думай\nГлибше й глибше\nКоритися приємно\nЗанурюйся…\nГарна дівчинка…',
        },
        // ── 預設狀態訊息（換行＝多句，動作格式會自動帶名字） ──────────────
        'defaultEmotes': {
            TW: '$me 的思緒變得混亂了\n$me 的兩眼變得空洞…\n$me 的意識正在下沉\n$me 微微晃了一下，失神了\n$me 的表情變得恍惚',
            CN: '$me 的思绪变得混乱了\n$me 的两眼变得空洞…\n$me 的意识正在下沉\n$me 微微晃了一下，失神了\n$me 的表情变得恍惚',
            EN: '$me\'s mind grows hazy\n$me\'s eyes go blank…\n$me\'s awareness sinks down\n$me sways slightly, dazed\n$me\'s expression turns vacant',
            JP: '$me の思考が混濁してきた\n$me の両目が虚ろになる…\n$me の意識が沈んでいく\n$me が少しふらつき、放心した\n$me の表情がとろんとする',
            KR: '$me 의 생각이 흐려진다\n$me 의 두 눈이 공허해진다…\n$me 의 의식이 가라앉는다\n$me 가 살짝 비틀거리며 넋이 나갔다\n$me 의 표정이 멍해진다',
            DE: '$me wird benommen\n$me Augen werden leer…\n$me Bewusstsein sinkt\n$me schwankt leicht, benommen\n$me Miene wird abwesend',
            FR: '$me a l\'esprit embrumé\n$me a le regard vide…\n$me sombre dans la conscience\n$me vacille légèrement, hébété·e\n$me a l\'air absent',
            RU: '$me разум туманится\n$me взгляд пустеет…\n$me сознание погружается\n$me слегка покачивается, в трансе\n$me выражение становится отрешённым',
            UA: '$me розум туманіє\n$me погляд порожніє…\n$me свідомість занурюється\n$me трохи похитується, у трансі\n$me вираз стає відстороненим',
        },
    };

    window.Liko.i18n.register('IVH', IVH_STRINGS);
    window.Liko._IVH_strings = IVH_STRINGS;   // 供 IVH 自行依使用者選的語言查表
    if (window.Liko?.i18n) window.Liko.i18n._ivhStringsLoaded = true;
})();
