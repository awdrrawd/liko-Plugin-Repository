// PCM-i18n.js — Plugin Collection Manager translations (non-EN)
// Loaded by the PCM loader after BC_i18n.js.
// EN strings live in the main body as fallback; this file only registers other languages.
(function () {
    window.Liko = window.Liko ?? {};

    const _strings = {
        'loaded': {
            TW: 'Liko的插件管理器 v{ver} 載入完成！點擊浮動按鈕管理插件。',
            CN: 'Liko的插件管理器 v{ver} 载入完成！点击浮动按钮管理插件。',
            DE: 'Liko\'s Plugin Collection Manager v{ver} geladen! Klicke den schwebenden Button zum Verwalten.',
            FR: 'Liko\'s Plugin Collection Manager v{ver} chargé ! Cliquez sur le bouton flottant.',
            RU: 'Менеджер плагинов Liko v{ver} загружен! Нажмите кнопку для управления плагинами.',
            UA: 'Менеджер плагінів Liko v{ver} завантажено! Натисніть кнопку для керування.',
        },
        'shortLoaded': {
            TW: '📋 Liko 插件管理器 說明書\n\n🎮 使用方法：\n• 點擊浮動按鈕開啟管理面板\n• 切換開關來啟用/停用插件\n• 三段開關：OFF → ON → BETA\n\n📝 可用指令：\n/pcm help — 顯示此說明\n/pcm list — 查看所有插件\n\n💡 插件啟用後自動載入，或下次刷新生效。',
            CN: '📋 Liko 插件管理器 说明书\n\n🎮 使用方法：\n• 点击浮动按钮打开管理面板\n• 切换开关来启用/停用插件\n• 三段开关：OFF → ON → BETA\n\n📝 可用指令：\n/pcm help — 显示此说明\n/pcm list — 查看所有插件\n\n💡 插件启用后自动载入，或下次刷新生效。',
            DE: '📋 Liko Plugin-Manager Handbuch\n\n🎮 Verwendung:\n• Schwebenden Button klicken\n• Schalter umlegen zum Aktivieren/Deaktivieren\n\n📝 Befehle:\n/pcm help — Hilfe anzeigen\n/pcm list — Plugins auflisten',
            FR: '📋 Manuel du Gestionnaire de Plugins Liko\n\n🎮 Utilisation:\n• Cliquez sur le bouton flottant\n• Basculez les interrupteurs pour activer/désactiver\n\n📝 Commandes:\n/pcm help — afficher l\'aide\n/pcm list — lister les plugins',
            RU: '📋 Руководство по менеджеру плагинов Liko\n\n🎮 Использование:\n• Нажмите плавающую кнопку\n• Переключайте для включения/отключения плагинов\n\n📝 Команды:\n/pcm help — справка\n/pcm list — список плагинов',
            UA: '📋 Посібник менеджера плагінів Liko\n\n🎮 Використання:\n• Натисніть кнопку\n• Перемикайте для увімкнення/вимкнення\n\n📝 Команди:\n/pcm help — довідка\n/pcm list — список плагінів',
        },
        'welcomeTitle':      { TW: '🐈‍⬛ 插件管理器', CN: '🐈‍⬛ 插件管理器', DE: '🐈‍⬛ Plugin-Manager', FR: '🐈‍⬛ Gestionnaire de plugins', RU: '🐈‍⬛ Менеджер плагинов', UA: '🐈‍⬛ Менеджер плагінів' },
        'tabLocal':          { TW: '📱 本地',         CN: '📱 本地',         DE: '📱 Lokal',          FR: '📱 Local',                 RU: '📱 Локальные',        UA: '📱 Локальні' },
        'tabAccount':        { TW: '☁️ 帳戶',         CN: '☁️ 账户',         DE: '☁️ Konto',          FR: '☁️ Compte',                RU: '☁️ Аккаунт',          UA: '☁️ Акаунт' },
        'tabCustom':         { TW: '🔧 自訂',         CN: '🔧 自定义',       DE: '🔧 Eigene',         FR: '🔧 Personnalisé',          RU: '🔧 Свои',             UA: '🔧 Власні' },
        'searchPlaceholder': { TW: '搜尋插件...',     CN: '搜索插件...',     DE: 'Plugins suchen...', FR: 'Rechercher des plugins...',RU: 'Поиск плагинов...',   UA: 'Пошук плагінів...' },
        'filterAll':         { TW: '顯示：全部',      CN: '显示：全部',      DE: 'Alle',              FR: 'Tous',                     RU: 'Все',                 UA: 'Усі' },
        'filterEnabled':     { TW: '顯示：已啟用',    CN: '显示：已启用',    DE: 'Aktivierte',        FR: 'Activés',                  RU: 'Включённые',          UA: 'Увімкнені' },
        'filterDisabled':    { TW: '顯示：已停用',    CN: '显示：已停用',    DE: 'Deaktivierte',      FR: 'Désactivés',               RU: 'Выключённые',         UA: 'Вимкнені' },
        'pluginEnabled':     { TW: '已啟用',          CN: '已启用',          DE: 'aktiviert',         FR: 'activé',                   RU: 'включён',             UA: 'увімкнено' },
        'pluginDisabled':    { TW: '已停用',          CN: '已停用',          DE: 'deaktiviert',       FR: 'désactivé',                RU: 'выключен',            UA: 'вимкнено' },
        'willTakeEffect':    { TW: '插件已載入或將在下次刷新生效', CN: '插件已载入或将在下次刷新生效', DE: 'Plugin geladen oder wirkt nach dem nächsten Refresh', FR: 'Plugin chargé ou prendra effet au prochain rechargement', RU: 'Плагин загружен или вступит в силу после перезагрузки', UA: 'Плагін завантажено або набуде чинності після оновлення' },
        'willNotStart':      { TW: '下次載入時將不會啟動', CN: '下次载入时将不会启动', DE: 'Wird beim nächsten Laden nicht gestartet', FR: 'Ne démarrera pas au prochain chargement', RU: 'Не будет запущен при следующей загрузке', UA: 'Не запуститься при наступному завантаженні' },
        'visitWebsite':      { TW: '訪問網站', CN: '访问网站', DE: 'Website besuchen', FR: 'Visiter le site', RU: 'Посетить сайт', UA: 'Відвідати сайт' },
        'changelogTitle':    { TW: '📋 更新日誌', CN: '📋 更新日志', DE: '📋 Änderungsprotokoll', FR: '📋 Journal des mises à jour', RU: '📋 Журнал обновлений', UA: '📋 Журнал оновлень' },
        'changelogClose':    { TW: '關閉', CN: '关闭', DE: 'Schließen', FR: 'Fermer', RU: 'Закрыть', UA: 'Закрити' },
        'newVersionTitle':   { TW: '✨ PCM 已更新', CN: '✨ PCM 已更新', DE: '✨ PCM aktualisiert', FR: '✨ PCM mis à jour', RU: '✨ PCM обновлён', UA: '✨ PCM оновлено' },
        'newVersionHint':    { TW: '隨時點擊 📋 再次查看', CN: '随时点击 📋 再次查看', DE: 'Jederzeit 📋 klicken zum Erneut-Anzeigen', FR: 'Cliquez sur 📋 pour revoir à tout moment', RU: 'Нажмите 📋 в любое время', UA: 'Натисніть 📋 будь-коли' },
        'loadingPlugins':    { TW: '正在載入插件清單...', CN: '正在载入插件清单...', DE: 'Plugin-Liste wird geladen...', FR: 'Chargement de la liste...', RU: 'Загрузка списка плагинов...', UA: 'Завантаження списку плагінів...' },
        'loadPluginsFailed': { TW: '插件清單載入失敗，請刷新頁面', CN: '插件清单载入失败，请刷新页面', DE: 'Plugin-Liste konnte nicht geladen werden', FR: 'Impossible de charger la liste des plugins', RU: 'Не удалось загрузить список плагинов', UA: 'Не вдалося завантажити список плагінів' },
        'refreshTitle':      { TW: '清除快取並重新下載', CN: '清除缓存并重新下载', DE: 'Cache leeren & aktualisieren', FR: 'Vider le cache et actualiser', RU: 'Очистить кэш и обновить', UA: 'Очистити кеш і оновити' },
        'refreshing':        { TW: '正在清除快取並重新下載...', CN: '正在清除缓存并重新下载...', DE: 'Cache wird geleert und neu geladen...', FR: 'Vidage du cache et téléchargement...', RU: 'Очистка кэша и повторная загрузка...', UA: 'Очищення кешу та повторне завантаження...' },
        'refreshDone':       { TW: '所有快取已清除，插件清單已更新為最新版！請重新整理遊戲頁面以完整套用最新的主程式與各插件。', CN: '所有缓存已清除，插件清单已更新为最新版！请重新刷新游戏页面以完整套用最新的主程序与各插件。', DE: 'Cache geleert, Plugin-Liste aktualisiert! Bitte das Spiel neu laden, um Hauptskript und Plugins vollständig zu aktualisieren.', FR: 'Cache vidé, liste des plugins mise à jour ! Veuillez actualiser le jeu pour appliquer entièrement le script principal et les plugins.', RU: 'Кэш очищен, список плагинов обновлён! Обновите игру, чтобы полностью применить последнюю версию основного скрипта и плагинов.', UA: 'Кеш очищено, список плагінів оновлено! Оновіть гру, щоб повністю застосувати останню версію основного скрипту та плагінів.' },
        'refreshFailed':     { TW: '更新失敗，使用舊版清單', CN: '更新失败，使用旧版清单', DE: 'Aktualisierung fehlgeschlagen', FR: 'Mise à jour échouée, liste en cache utilisée', RU: 'Обновление не удалось, используется кэш', UA: 'Оновлення не вдалося, використовується кеш' },
        'pluginLoadComplete':{ TW: '插件載入完成', CN: '插件载入完成', DE: 'Plugin-Laden abgeschlossen', FR: 'Chargement des plugins terminé', RU: 'Загрузка плагинов завершена', UA: 'Завантаження плагінів завершено' },
        'successLoaded':     { TW: '已載入', CN: '已载入', DE: 'Geladen', FR: 'Chargés', RU: 'Загружено', UA: 'Завантажено' },
        'plugins':           { TW: '個插件', CN: '个插件', DE: 'Plugins', FR: 'plugins', RU: 'плагинов', UA: 'плагінів' },
        'failed':            { TW: '個失敗', CN: '个失败', DE: 'fehlgeschlagen', FR: 'échoués', RU: 'не удалось', UA: 'невдало' },
        'pluginLoadFailed':  { TW: '{name} 載入失敗', CN: '{name} 载入失败', DE: '{name} konnte nicht geladen werden', FR: '{name} n\'a pas pu être chargé', RU: '{name} не удалось загрузить', UA: '{name} не вдалося завантажити' },
        'pluginLoadRetry':   { TW: '點擊插件上的 ↺ 重試', CN: '点击插件上的 ↺ 重试', DE: 'Klicke ↺ am Plugin zum Wiederholen', FR: 'Cliquez sur ↺ pour réessayer', RU: 'Нажмите ↺ для повтора', UA: 'Натисніть ↺ для повторної спроби' },
        'accountNotLoggedIn':{ TW: '🔒\n請先登入遊戲帳號', CN: '🔒\n请先登录游戏账号', DE: '🔒\nBitte anmelden', FR: '🔒\nVeuillez vous connecter', RU: '🔒\nВойдите в аккаунт', UA: '🔒\nУвійдіть до акаунту' },
        'customAddTitle':    { TW: '新增自訂插件', CN: '新增自定义插件', DE: 'Plugin hinzufügen', FR: 'Ajouter un plugin', RU: 'Добавить плагин', UA: 'Додати плагін' },
        'customFieldName':   { TW: '插件名稱 *', CN: '插件名称 *', DE: 'Plugin-Name *', FR: 'Nom du plugin *', RU: 'Название *', UA: 'Назва *' },
        'customFieldUrl':    { TW: '插件網址 (.js) *', CN: '插件网址 (.js) *', DE: 'URL (.js) *', FR: 'URL (.js) *', RU: 'URL (.js) *', UA: 'URL (.js) *' },
        'customFieldIcon':   { TW: '圖示（emoji 或圖片網址，選填）', CN: '图标（emoji 或图片网址，选填）', DE: 'Symbol — Emoji oder Bild-URL (optional)', FR: 'Icône — emoji ou URL (optionnel)', RU: 'Иконка — emoji или URL (необязательно)', UA: 'Іконка — emoji або URL (необов\'язково)' },
        'customFieldDesc':   { TW: '描述（選填）', CN: '描述（选填）', DE: 'Beschreibung (optional)', FR: 'Description (optionnel)', RU: 'Описание (необязательно)', UA: 'Опис (необов\'язково)' },
        'customBtnAdd':      { TW: '新增', CN: '新增', DE: 'Hinzufügen', FR: 'Ajouter', RU: 'Добавить', UA: 'Додати' },
        'customBtnCancel':   { TW: '取消', CN: '取消', DE: 'Abbrechen', FR: 'Annuler', RU: 'Отмена', UA: 'Скасувати' },
        'customDeleteConfirm':{ TW: '確定要移除「{name}」嗎？', CN: '确定要移除「{name}」吗？', DE: '„{name}" entfernen?', FR: 'Supprimer « {name} » ?', RU: 'Удалить «{name}»?', UA: 'Видалити «{name}»?' },
        'customDeleteYes':   { TW: '移除', CN: '移除', DE: 'Entfernen', FR: 'Supprimer', RU: 'Удалить', UA: 'Видалити' },
        'customAdded':       { TW: '{name} 已新增', CN: '{name} 已新增', DE: '{name} hinzugefügt', FR: '{name} ajouté', RU: '{name} добавлен', UA: '{name} додано' },
        'customDeleted':     { TW: '{name} 已移除', CN: '{name} 已移除', DE: '{name} entfernt', FR: '{name} supprimé', RU: '{name} удалён', UA: '{name} видалено' },
        'customUrlInvalid':  { TW: '網址必須以 .js 結尾', CN: '网址必须以 .js 结尾', DE: 'URL muss mit .js enden', FR: 'L\'URL doit se terminer par .js', RU: 'URL должен заканчиваться на .js', UA: 'URL має закінчуватися на .js' },
        'customNameRequired':{ TW: '請輸入插件名稱', CN: '请输入插件名称', DE: 'Bitte einen Namen eingeben', FR: 'Veuillez saisir un nom', RU: 'Введите название', UA: 'Введіть назву' },
        'customEmptyHint':   { TW: '尚無自訂插件。\n點擊上方 ⚙ 來新增。', CN: '尚无自定义插件。\n点击上方 ⚙ 来新增。', DE: 'Noch keine eigenen Plugins.\nKlicke ⚙ oben.', FR: 'Aucun plugin personnalisé.\nCliquez sur ⚙ ci-dessus.', RU: 'Своих плагинов пока нет.\nНажмите ⚙ выше.', UA: 'Власних плагінів немає.\nНатисніть ⚙ вище.' },
        'prefButton':        { TW: 'PCM 插件管理器', CN: 'PCM 插件管理器', DE: 'PCM Plugin-Manager', FR: 'Gestionnaire de plugins PCM', RU: 'Менеджер плагинов PCM', UA: 'Менеджер плагінів PCM' },
    };

    // 引擎（window.Liko.__Sys_i18n__）有時會晚一點才就位（例如 Electron-BC 環境下，
    // 抓取順序/時間跟一般瀏覽器不同）。原本用 `?.register(...)` 只嘗試一次，
    // 若當下引擎還沒掛上去，這行會靜靜地失敗、翻譯資料就永遠不會被註冊。
    // 改成輪詢等待，最多等 10 秒，引擎隨時就位就立刻補註冊。
    (function registerWhenReady(tries) {
        if (window.Liko.__Sys_i18n__?.register) {
            window.Liko.__Sys_i18n__.register('PCM', _strings);
            return;
        }
        if ((tries ?? 0) > 100) {
            console.warn('🐈‍⬛ [PCM-i18n] ⚠️ __Sys_i18n__ never became available, translations not registered');
            return;
        }
        setTimeout(() => registerWhenReady((tries ?? 0) + 1), 100);
    })();
})();