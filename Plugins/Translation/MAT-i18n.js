// Liko - MAT i18n 字庫
// 此檔案由 MAT 插件動態載入，不需手動安裝
// 載入完畢後自動呼叫 register，將字串注入共用引擎 BC_i18n
// 佔位符以 {name} 表示，由引擎的 t(ns, key, vars) 代入

(function () {
    if (!window.Liko?.__Sys_i18n__?.register) {
        console.error('[Liko MAT strings] i18n 引擎尚未載入');
        return;
    }

    window.Liko.__Sys_i18n__.register('MAT', {

        'foldOriginalLabel': { TW: '原文', CN: '原文', EN: 'Original', DE: 'Original', FR: 'Original', RU: 'Оригинал', UA: 'Оригінал' },

        // ── 載入 / SDK ────────────────────────────────────────────────────
        'sdkTimeout': {
            TW: "bcModSdk 等待逾時，插件無法載入",
            CN: "bcModSdk 等待超时，插件无法加载",
            EN: "bcModSdk timed out, plugin failed to load",
            DE: "bcModSdk-Zeitüberschreitung, Plugin konnte nicht geladen werden",
            FR: "Délai bcModSdk dépassé, échec du chargement du plugin",
            RU: "Тайм-аут bcModSdk, плагин не загружен",
            UA: "Тайм-аут bcModSdk, плагін не вдалося завантажити"
        },
        'loaded': {
            TW: "🌐 [MAT] v{v} 載入成功，可用 /mat help 或到拓展設定內設置",
            CN: "🌐 [MAT] v{v} 加载成功，可用 /mat help 或到拓展设置内设置",
            EN: "🌐 [MAT] v{v} loaded! Use /mat help or open Extension Settings",
            DE: "🌐 [MAT] v{v} geladen! /mat help verwenden oder Erweiterungseinstellungen öffnen",
            FR: "🌐 [MAT] v{v} chargé ! Utilisez /mat help ou ouvrez les paramètres d'extension",
            RU: "🌐 [MAT] v{v} загружен! Используйте /mat help или откройте настройки расширений",
            UA: "🌐 [MAT] v{v} завантажено! Використайте /mat help або відкрийте налаштування розширень"
        },
        'cmdNotLoggedIn': {
            TW: "⚠️ 未登入，無法保存翻譯設定",
            CN: "⚠️ 未登录，无法保存翻译设置",
            EN: "⚠️ Not logged in, cannot save settings",
            DE: "⚠️ Nicht angemeldet, Einstellungen können nicht gespeichert werden",
            FR: "⚠️ Non connecté, impossible d'enregistrer les paramètres",
            RU: "⚠️ Вы не вошли в систему, не удаётся сохранить настройки",
            UA: "⚠️ Ви не увійшли, неможливо зберегти налаштування"
        },
        'scrollFreezeLoadFail': {
            TW: "⚠️ [MAT] 進階聊天室凍結模組載入失敗，已改用 BC 內建的基礎凍結機制，不影響一般使用",
            CN: "⚠️ [MAT] 进阶聊天室冻结模块加载失败，已改用 BC 内建的基础冻结机制，不影响一般使用",
            EN: "⚠️ [MAT] Advanced chat-freeze module failed to load; falling back to BC's built-in basic freeze (no impact on normal use)",
            DE: "⚠️ [MAT] Erweitertes Chat-Freeze-Modul konnte nicht geladen werden; es wird auf die integrierte Basis-Freeze-Funktion von BC zurückgegriffen (keine Auswirkung auf die normale Nutzung)",
            FR: "⚠️ [MAT] Échec du chargement du module avancé de gel du chat ; retour au gel de base intégré de BC (aucun impact sur l'utilisation normale)",
            RU: "⚠️ [MAT] Не удалось загрузить расширенный модуль заморозки чата; используется встроенный базовый механизм BC (не влияет на обычное использование)",
            UA: "⚠️ [MAT] Не вдалося завантажити розширений модуль заморозки чату; використовується вбудований базовий механізм BC (не впливає на звичайне використання)"
        },

        // ── API / 翻譯失敗 ────────────────────────────────────────────────
        'apiFail': {
            TW: "⚠️ [MAT] Google 翻譯請求失敗\n・{hint}",
            CN: "⚠️ [MAT] Google 翻译请求失败\n・{hint}",
            EN: "⚠️ [MAT] Google Translate request failed\n・{hint}",
            DE: "⚠️ [MAT] Google-Übersetzungsanfrage fehlgeschlagen\n・{hint}",
            FR: "⚠️ [MAT] Échec de la requête Google Traduction\n・{hint}",
            RU: "⚠️ [MAT] Сбой запроса Google Переводчика\n・{hint}",
            UA: "⚠️ [MAT] Помилка запиту Google Перекладача\n・{hint}"
        },
        'translateFail': {
            TW: "⚠️ [MAT] 翻譯失敗\n・{hint}",
            CN: "⚠️ [MAT] 翻译失败\n・{hint}",
            EN: "⚠️ [MAT] Translation failed\n・{hint}",
            DE: "⚠️ [MAT] Übersetzung fehlgeschlagen\n・{hint}",
            FR: "⚠️ [MAT] Échec de la traduction\n・{hint}",
            RU: "⚠️ [MAT] Сбой перевода\n・{hint}",
            UA: "⚠️ [MAT] Помилка перекладу\n・{hint}"
        },
        'hint_rate_limit': {
            TW: "請求過於頻繁，稍候即可恢復",
            CN: "请求过于频繁，稍候即可恢复",
            EN: "Too many requests, will recover shortly",
            DE: "Zu viele Anfragen, erholt sich in Kürze",
            FR: "Trop de requêtes, rétablissement imminent",
            RU: "Слишком много запросов, скоро восстановится",
            UA: "Забагато запитів, скоро відновиться"
        },
        'hint_blocked': {
            TW: "該節點可能被封鎖，建議切換網路節點",
            CN: "该节点可能被封锁，建议切换网络节点",
            EN: "This node may be blocked, try switching your network node",
            DE: "Dieser Knoten ist möglicherweise blockiert, wechseln Sie den Netzwerkknoten",
            FR: "Ce nœud est peut-être bloqué, essayez de changer de nœud réseau",
            RU: "Этот узел может быть заблокирован, попробуйте сменить сетевой узел",
            UA: "Цей вузол може бути заблокований, спробуйте змінити мережевий вузол"
        },
        'hint_network': {
            TW: "網路連線異常，請確認網路狀態",
            CN: "网络连接异常，请确认网络状态",
            EN: "Network error, please check your connection",
            DE: "Netzwerkfehler, bitte überprüfen Sie Ihre Verbindung",
            FR: "Erreur réseau, veuillez vérifier votre connexion",
            RU: "Ошибка сети, проверьте подключение",
            UA: "Помилка мережі, перевірте з'єднання"
        },
        'hint_offline': {
            TW: "裝置目前處於離線狀態，請檢查網路連線",
            CN: "设备当前处于离线状态，请检查网络连接",
            EN: "Your device appears offline, please check your connection",
            DE: "Ihr Gerät scheint offline zu sein, bitte überprüfen Sie Ihre Verbindung",
            FR: "Votre appareil semble hors ligne, veuillez vérifier votre connexion",
            RU: "Похоже, устройство offline, проверьте подключение",
            UA: "Схоже, пристрій офлайн, перевірте з'єднання"
        },
        'hint_timeout': {
            TW: "請求逾時，已略過這則翻譯",
            CN: "请求超时，已跳过这条翻译",
            EN: "Request timed out; this translation was skipped",
            DE: "Zeitüberschreitung; diese Übersetzung wurde übersprungen",
            FR: "Délai dépassé ; cette traduction a été ignorée",
            RU: "Тайм-аут запроса; этот перевод пропущен",
            UA: "Тайм-аут запиту; цей переклад пропущено"
        },
        'hint_unknown': {
            TW: "發生錯誤（{err}）",
            CN: "发生错误（{err}）",
            EN: "Error: {err}",
            DE: "Fehler: {err}",
            FR: "Erreur : {err}",
            RU: "Ошибка: {err}",
            UA: "Помилка: {err}"
        },
        'translating': {
            TW: "翻譯中...",
            CN: "翻译中...",
            EN: "Translating...",
            DE: "Übersetze...",
            FR: "Traduction...",
            RU: "Перевод...",
            UA: "Переклад..."
        },
        'selectionFail': {
            TW: "⚠️ 翻譯失敗，請檢查網路",
            CN: "⚠️ 翻译失败，请检查网络",
            EN: "⚠️ Translation failed, check your network",
            DE: "⚠️ Übersetzung fehlgeschlagen, prüfen Sie Ihr Netzwerk",
            FR: "⚠️ Échec de la traduction, vérifiez votre réseau",
            RU: "⚠️ Сбой перевода, проверьте сеть",
            UA: "⚠️ Помилка перекладу, перевірте мережу"
        },

        // ── 工具列 / 標籤 ──────────────────────────────────────────────────
        'dblClickRemove': {
            TW: "雙擊移除翻譯",
            CN: "双击移除翻译",
            EN: "Double-click to remove",
            DE: "Zum Entfernen doppelklicken",
            FR: "Double-cliquez pour supprimer",
            RU: "Дважды щёлкните, чтобы удалить",
            UA: "Двічі клацніть, щоб видалити"
        },
        'removeTranslation': {
            TW: "移除翻譯",
            CN: "移除翻译",
            EN: "Remove",
            DE: "Entfernen",
            FR: "Supprimer",
            RU: "Удалить",
            UA: "Видалити"
        },
        'otherLang': {
            TW: "臨時選擇語言",
            CN: "临时选择语言",
            EN: "Other language",
            DE: "Andere Sprache",
            FR: "Autre langue",
            RU: "Другой язык",
            UA: "Інша мова"
        },
        'translateTo': {
            TW: "選擇語言翻譯",
            CN: "选择语言翻译",
            EN: "Translate to...",
            DE: "Übersetzen nach...",
            FR: "Traduire vers...",
            RU: "Перевести на...",
            UA: "Перекласти на..."
        },

        // ── 快捷鍵 ─────────────────────────────────────────────────────────
        'hotkeyNone': {
            TW: "（未設定）",
            CN: "（未设定）",
            EN: "(none)",
            DE: "(keine)",
            FR: "(aucun)",
            RU: "(нет)",
            UA: "(немає)"
        },
        'hotkeyEnabled': {
            TW: "✅ MAT 已開啟 ({hk})",
            CN: "✅ MAT 已开启 ({hk})",
            EN: "✅ MAT enabled ({hk})",
            DE: "✅ MAT aktiviert ({hk})",
            FR: "✅ MAT activé ({hk})",
            RU: "✅ MAT включён ({hk})",
            UA: "✅ MAT увімкнено ({hk})"
        },
        'hotkeyDisabled': {
            TW: "❌ MAT 已關閉 ({hk})",
            CN: "❌ MAT 已关闭 ({hk})",
            EN: "❌ MAT disabled ({hk})",
            DE: "❌ MAT deaktiviert ({hk})",
            FR: "❌ MAT désactivé ({hk})",
            RU: "❌ MAT выключен ({hk})",
            UA: "❌ MAT вимкнено ({hk})"
        },
        'hotkeyRecording': {
            TW: "按下新快捷鍵... (Esc取消)",
            CN: "按下新快捷键... (Esc取消)",
            EN: "Press a key... (Esc=cancel)",
            DE: "Taste drücken... (Esc=Abbrechen)",
            FR: "Appuyez sur une touche... (Échap=annuler)",
            RU: "Нажмите клавишу... (Esc=отмена)",
            UA: "Натисніть клавішу... (Esc=скасувати)"
        },

        // ── 設定頁 ─────────────────────────────────────────────────────────
        'btnBack': {
            TW: "返回", CN: "返回", EN: "Back", DE: "Zurück", FR: "Retour", RU: "Назад", UA: "Назад"
        },
        'pageTitle': {
            TW: "機器翻譯設定  v{v}",
            CN: "机器翻译设置  v{v}",
            EN: "Machine Translation Settings  v{v}",
            DE: "Maschinelle Übersetzung – Einstellungen  v{v}",
            FR: "Paramètres de traduction automatique  v{v}",
            RU: "Настройки машинного перевода  v{v}",
            UA: "Налаштування машинного перекладу  v{v}"
        },
        'secLive': {
            TW: "── 即時翻譯 ──",
            CN: "── 即时翻译 ──",
            EN: "── Live Translation ──",
            DE: "── Live-Übersetzung ──",
            FR: "── Traduction en direct ──",
            RU: "── Перевод в реальном времени ──",
            UA: "── Переклад у реальному часі ──"
        },
        'secLang': {
            TW: "── 語言設定 ──",
            CN: "── 语言设置 ──",
            EN: "── Language Settings ──",
            DE: "── Spracheinstellungen ──",
            FR: "── Paramètres de langue ──",
            RU: "── Настройки языка ──",
            UA: "── Налаштування мови ──"
        },
        'secHotkey': {
            TW: "── 快捷鍵 ──",
            CN: "── 快捷键 ──",
            EN: "── Hotkeys ──",
            DE: "── Tastenkürzel ──",
            FR: "── Raccourcis ──",
            RU: "── Горячие клавиши ──",
            UA: "── Гарячі клавіші ──"
        },
        'optEnabled': {
            TW: "啟用", CN: "启用", EN: "Enable", DE: "Aktivieren", FR: "Activer", RU: "Включить", UA: "Увімкнути"
        },
        'optRecv': {
            TW: "接收翻譯",
            CN: "接收翻译",
            EN: "Translate Received",
            DE: "Empfangenes übersetzen",
            FR: "Traduire les messages reçus",
            RU: "Переводить полученное",
            UA: "Перекладати отримане"
        },
        'optSend': {
            TW: "發送翻譯",
            CN: "发送翻译",
            EN: "Translate Sent",
            DE: "Gesendetes übersetzen",
            FR: "Traduire les messages envoyés",
            RU: "Переводить отправленное",
            UA: "Перекладати надіслане"
        },
        'optChat': {
            TW: "點選翻譯按鈕",
            CN: "点选翻译按钮",
            EN: "Click-to-Translate Button",
            DE: "Klick-zum-Übersetzen-Schaltfläche",
            FR: "Bouton cliquer-pour-traduire",
            RU: "Кнопка перевода по клику",
            UA: "Кнопка перекладу по кліку"
        },
        'optSelection': {
            TW: "選取翻譯",
            CN: "选取翻译",
            EN: "Selection Translate",
            DE: "Auswahl übersetzen",
            FR: "Traduire la sélection",
            RU: "Перевод выделения",
            UA: "Переклад виділеного"
        },
        'optChatScrollFreeze': {
            TW: "拓展信息凍結功能",
            CN: "拓展信息冻结功能",
            EN: "Chat Scroll Freeze Extension",
            DE: "Chat-Scroll-Freeze-Erweiterung",
            FR: "Extension de gel du défilement du chat",
            RU: "Расширение заморозки прокрутки чата",
            UA: "Розширення заморозки прокрутки чату"
        },
        'optSkipStutter': {
            TW: "略過結巴前綴",
            CN: "略过结巴前缀",
            EN: "Skip Stutter Prefix",
            DE: "Stotter-Präfix überspringen",
            FR: "Ignorer le préfixe de bégaiement",
            RU: "Пропускать заикание",
            UA: "Пропускати заїкання"
        },
        'lblRecvLang': {
            TW: "接收語言：",
            CN: "接收语言：",
            EN: "Recv Lang: ",
            DE: "Empf.-Sprache: ",
            FR: "Langue reçue : ",
            RU: "Язык приёма: ",
            UA: "Мова отримання: "
        },
        'lblSendLang': {
            TW: "發送語言：",
            CN: "发送语言：",
            EN: "Send Lang: ",
            DE: "Sendesprache: ",
            FR: "Langue envoi : ",
            RU: "Язык отправки: ",
            UA: "Мова надсилання: "
        },
        'tipRecvLang': {
            TW: "接收語言",
            CN: "接收语言",
            EN: "Recv Lang",
            DE: "Empfangssprache",
            FR: "Langue reçue",
            RU: "Язык приёма",
            UA: "Мова отримання"
        },
        'tipSendLang': {
            TW: "發送語言",
            CN: "发送语言",
            EN: "Send Lang",
            DE: "Sendesprache",
            FR: "Langue d'envoi",
            RU: "Язык отправки",
            UA: "Мова надсилання"
        },
        'lblHotkeyToggle': {
            TW: "開關翻譯：",
            CN: "开关翻译：",
            EN: "Toggle MAT: ",
            DE: "MAT umschalten: ",
            FR: "Activer/désactiver MAT : ",
            RU: "Переключить MAT: ",
            UA: "Перемкнути MAT: "
        },
        'tipHotkeySet': {
            TW: "點擊設定",
            CN: "点击设定",
            EN: "Click to set",
            DE: "Zum Festlegen klicken",
            FR: "Cliquez pour définir",
            RU: "Нажмите, чтобы задать",
            UA: "Натисніть, щоб задати"
        },
        'btnHotkeyClear': {
            TW: "清除", CN: "清除", EN: "Clear", DE: "Löschen", FR: "Effacer", RU: "Очистить", UA: "Очистити"
        },
        'desc1': {
            TW: "該插件為聊天室即時翻譯插件，支援 Bio 翻譯，使用 Google 翻譯 API",
            CN: "该插件为聊天室即时翻译插件，支持 Bio 翻译，使用 Google 翻译 API",
            EN: "Chat room live translation with Bio support, powered by Google Translate API",
            DE: "Live-Übersetzung im Chat mit Bio-Unterstützung, via Google Translate API",
            FR: "Traduction en direct du chat avec prise en charge de la Bio, via l'API Google Traduction",
            RU: "Перевод чата в реальном времени с поддержкой Bio, через API Google Переводчика",
            UA: "Переклад чату в реальному часі з підтримкою Bio, через API Google Перекладача"
        },
        'desc2': {
            TW: "插件停用時不影響 Bio 與選取翻譯（需開啟）的功能",
            CN: "插件停用时不影响 Bio 与选取翻译（需开启）的功能",
            EN: "Disabling does not affect Bio or Selection translate (if enabled)",
            DE: "Deaktivieren beeinflusst Bio- und Auswahlübersetzung nicht (falls aktiviert)",
            FR: "La désactivation n'affecte pas la traduction de la Bio ni de la sélection (si activée)",
            RU: "Отключение не влияет на перевод Bio и выделения (если включено)",
            UA: "Вимкнення не впливає на переклад Bio та виділення (якщо увімкнено)"
        },
        'desc3': {
            TW: "請依需求設定，聊天室指令 /mat settings 可直接開啟此頁",
            CN: "请按需求设置，聊天室指令 /mat settings 可直接打开此页",
            EN: "Configure as needed. Chat command /mat settings opens this page",
            DE: "Nach Bedarf konfigurieren. Der Chat-Befehl /mat settings öffnet diese Seite",
            FR: "Configurez selon vos besoins. La commande /mat settings ouvre cette page",
            RU: "Настройте по необходимости. Команда /mat settings открывает эту страницу",
            UA: "Налаштуйте за потреби. Команда /mat settings відкриває цю сторінку"
        },

        // ── Bio 工具列 ─────────────────────────────────────────────────────
        'bioTranslate': {
            TW: "翻譯Bio",
            CN: "翻译Bio",
            EN: "Translate Bio",
            DE: "Bio übersetzen",
            FR: "Traduire la Bio",
            RU: "Перевести Bio",
            UA: "Перекласти Bio"
        },
        'bioCancelTranslate': {
            TW: "點擊取消翻譯",
            CN: "点击取消翻译",
            EN: "Click to cancel",
            DE: "Zum Abbrechen klicken",
            FR: "Cliquez pour annuler",
            RU: "Нажмите, чтобы отменить",
            UA: "Натисніть, щоб скасувати"
        },
        'bioClose': {
            TW: "關閉翻譯",
            CN: "关闭翻译",
            EN: "Close Translation",
            DE: "Übersetzung schließen",
            FR: "Fermer la traduction",
            RU: "Закрыть перевод",
            UA: "Закрити переклад"
        },

        // ── 指令回應 ───────────────────────────────────────────────────────
        'cmdOn': {
            TW: "✅ 聊天室翻譯已開啟",
            CN: "✅ 聊天室翻译已开启",
            EN: "✅ Chat translation enabled",
            DE: "✅ Chat-Übersetzung aktiviert",
            FR: "✅ Traduction du chat activée",
            RU: "✅ Перевод чата включён",
            UA: "✅ Переклад чату увімкнено"
        },
        'cmdOff': {
            TW: "❌ 聊天室翻譯已關閉",
            CN: "❌ 聊天室翻译已关闭",
            EN: "❌ Chat translation disabled",
            DE: "❌ Chat-Übersetzung deaktiviert",
            FR: "❌ Traduction du chat désactivée",
            RU: "❌ Перевод чата выключен",
            UA: "❌ Переклад чату вимкнено"
        },
        'cmdSend': {
            TW: "發送翻譯: {v}",
            CN: "发送翻译: {v}",
            EN: "Translate sent: {v}",
            DE: "Gesendetes übersetzen: {v}",
            FR: "Traduire les envois : {v}",
            RU: "Переводить отправленное: {v}",
            UA: "Перекладати надіслане: {v}"
        },
        'cmdChat': {
            TW: "點選翻譯按鈕: {v}",
            CN: "点选翻译按钮: {v}",
            EN: "Click-to-translate button: {v}",
            DE: "Klick-zum-Übersetzen-Schaltfläche: {v}",
            FR: "Bouton cliquer-pour-traduire : {v}",
            RU: "Кнопка перевода по клику: {v}",
            UA: "Кнопка перекладу по кліку: {v}"
        },
        'cmdUnknown': {
            TW: "❓ 未知指令，使用 /mat help",
            CN: "❓ 未知指令，使用 /mat help",
            EN: "❓ Unknown command, use /mat help",
            DE: "❓ Unbekannter Befehl, /mat help verwenden",
            FR: "❓ Commande inconnue, utilisez /mat help",
            RU: "❓ Неизвестная команда, используйте /mat help",
            UA: "❓ Невідома команда, використайте /mat help"
        },
        'prefButton': {
            TW: "機器翻譯設定",
            CN: "机器翻译设置",
            EN: "MAT Settings",
            DE: "MAT-Einstellungen",
            FR: "Paramètres MAT",
            RU: "Настройки MAT",
            UA: "Налаштування MAT"
        },

        // ── /mat help（精簡版，只保留 4 條指令）──────────────────────────────
        'help': {
            TW: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>聊天室與 Bio 即時翻譯（Google 翻譯）。選取文字即可翻譯；開啟個人檔案可翻譯 Bio。</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — 開關聊天室翻譯<br>
<b style='color:#87CEEB;'>/mat send</b> — 切換是否翻譯你發送的訊息<br>
<b style='color:#87CEEB;'>/mat chat</b> — 切換點選翻譯按鈕<br>
<b style='color:#87CEEB;'>/mat settings</b> — 開啟設定頁面
</div>
</div>`,
            CN: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>聊天室与 Bio 即时翻译（Google 翻译）。选取文字即可翻译；打开个人资料可翻译 Bio。</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — 开关聊天室翻译<br>
<b style='color:#87CEEB;'>/mat send</b> — 切换是否翻译你发送的消息<br>
<b style='color:#87CEEB;'>/mat chat</b> — 切换点选翻译按钮<br>
<b style='color:#87CEEB;'>/mat settings</b> — 打开设置页面
</div>
</div>`,
            EN: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>Live chat &amp; Bio translation (Google Translate). Select text to translate it; open a profile to translate the Bio.</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — Toggle chat translation<br>
<b style='color:#87CEEB;'>/mat send</b> — Toggle translating your sent messages<br>
<b style='color:#87CEEB;'>/mat chat</b> — Toggle the click-to-translate button<br>
<b style='color:#87CEEB;'>/mat settings</b> — Open the settings page
</div>
</div>`,
            DE: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>Live-Übersetzung von Chat &amp; Bio (Google Translate). Text markieren zum Übersetzen; ein Profil öffnen, um die Bio zu übersetzen.</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — Chat-Übersetzung umschalten<br>
<b style='color:#87CEEB;'>/mat send</b> — Übersetzung deiner gesendeten Nachrichten umschalten<br>
<b style='color:#87CEEB;'>/mat chat</b> — Klick-zum-Übersetzen-Schaltfläche umschalten<br>
<b style='color:#87CEEB;'>/mat settings</b> — Einstellungsseite öffnen
</div>
</div>`,
            FR: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>Traduction en direct du chat et de la Bio (Google Traduction). Sélectionnez du texte pour le traduire ; ouvrez un profil pour traduire la Bio.</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — Activer/désactiver la traduction du chat<br>
<b style='color:#87CEEB;'>/mat send</b> — Activer/désactiver la traduction de vos messages envoyés<br>
<b style='color:#87CEEB;'>/mat chat</b> — Activer/désactiver le bouton cliquer-pour-traduire<br>
<b style='color:#87CEEB;'>/mat settings</b> — Ouvrir la page des paramètres
</div>
</div>`,
            RU: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>Перевод чата и Bio в реальном времени (Google Переводчик). Выделите текст для перевода; откройте профиль, чтобы перевести Bio.</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — Переключить перевод чата<br>
<b style='color:#87CEEB;'>/mat send</b> — Переключить перевод ваших отправленных сообщений<br>
<b style='color:#87CEEB;'>/mat chat</b> — Переключить кнопку перевода по клику<br>
<b style='color:#87CEEB;'>/mat settings</b> — Открыть страницу настроек
</div>
</div>`,
            UA: `<div style='background:#1a1a2e;color:#eee;padding:10px;border-radius:5px;'>
<h3 style='color:#4CAF50;margin:0 0 8px 0;'>🌐 BC MAT v{v}</h3>
<div style='color:#aaa;margin:0 0 6px 0;'>Переклад чату та Bio в реальному часі (Google Перекладач). Виділіть текст для перекладу; відкрийте профіль, щоб перекласти Bio.</div>
<div style='background:#2d2d44;padding:6px 8px;border-radius:3px;'>
<b style='color:#87CEEB;'>/mat on</b> · <b style='color:#87CEEB;'>/mat off</b> — Перемкнути переклад чату<br>
<b style='color:#87CEEB;'>/mat send</b> — Перемкнути переклад ваших надісланих повідомлень<br>
<b style='color:#87CEEB;'>/mat chat</b> — Перемкнути кнопку перекладу по кліку<br>
<b style='color:#87CEEB;'>/mat settings</b> — Відкрити сторінку налаштувань
</div>
</div>`,
        },

        // ── 登入通知（v1.6）────────────────────────────────────────────────
        'loginNotice': {
            TW: "🌐 [MAT] v{v} 已初始化完成，將收到與發送的訊息自動翻譯。可能有不穩定的情況，可稍後再試，或檢查你的網路環境是否支援 Google 服務。第一次使用可到 /mat settings 前往設定。",
            CN: "🌐 [MAT] v{v} 已初始化完成，将收到与发送的消息自动翻译。可能有不稳定的情况，可稍后再试，或检查你的网络环境是否支持 Google 服务。第一次使用可到 /mat settings 前往设置。",
            EN: "🌐 [MAT] v{v} initialized — incoming and outgoing messages will be auto-translated. It may be unstable; try again later or check whether your network supports Google services. First time? Open /mat settings to configure.",
            DE: "🌐 [MAT] v{v} initialisiert — ein- und ausgehende Nachrichten werden automatisch übersetzt. Bei Instabilität später erneut versuchen oder prüfen, ob dein Netzwerk Google-Dienste unterstützt. Erstnutzung: /mat settings öffnen.",
            FR: "🌐 [MAT] v{v} initialisé — les messages entrants et sortants seront traduits automatiquement. En cas d'instabilité, réessayez plus tard ou vérifiez si votre réseau prend en charge les services Google. Première utilisation : /mat settings.",
            RU: "🌐 [MAT] v{v} инициализирован — входящие и исходящие сообщения переводятся автоматически. Возможны сбои; повторите позже или проверьте, поддерживает ли сеть сервисы Google. Впервые? Откройте /mat settings.",
            UA: "🌐 [MAT] v{v} ініціалізовано — вхідні та вихідні повідомлення перекладаються автоматично. Можливі збої; спробуйте пізніше або перевірте, чи підтримує мережа сервіси Google. Уперше? Відкрийте /mat settings."
        },

        // ── 設定頁：頁簽 ───────────────────────────────────────────────────
        'tab_master': { TW: "總開關", CN: "总开关", EN: "Master", DE: "Haupt", FR: "Principal", RU: "Главный", UA: "Головний" },
        'tab_basic':  { TW: "基本設定", CN: "基本设置", EN: "Basic", DE: "Grundlagen", FR: "Base", RU: "Основные", UA: "Основні" },
        'tab_send':   { TW: "發送設定", CN: "发送设置", EN: "Send", DE: "Senden", FR: "Envoi", RU: "Отправка", UA: "Надсилання" },
        'tab_recv':   { TW: "接收設定", CN: "接收设置", EN: "Receive", DE: "Empfang", FR: "Réception", RU: "Приём", UA: "Отримання" },
        'tab_other':  { TW: "其他設定", CN: "其他设置", EN: "Other", DE: "Sonstiges", FR: "Autres", RU: "Прочее", UA: "Інше" },
        'tab_hotkeys': { TW: "快捷鍵", CN: "快捷键", EN: "Hotkeys", DE: "Tastenkürzel", FR: "Raccourcis", RU: "Горячие клавиши", UA: "Гарячі клавіші" },

        // ── 總開關（左側第 0 鍵）──────────────────────────────────────────
        'masterOn':  { TW: "總開關：開啟", CN: "总开关：开启", EN: "Master: ON", DE: "Haupt: AN", FR: "Principal : ON", RU: "Главный: ВКЛ", UA: "Головний: УВІМК" },
        'masterOff': { TW: "總開關：關閉", CN: "总开关：关闭", EN: "Master: OFF", DE: "Haupt: AUS", FR: "Principal : OFF", RU: "Главный: ВЫКЛ", UA: "Головний: ВИМК" },

        // ── 總開關頁 ───────────────────────────────────────────────────────
        'optMasterEnable': {
            TW: "啟用 MAT 自動翻譯", CN: "启用 MAT 自动翻译", EN: "Enable MAT auto-translate",
            DE: "MAT-Autoübersetzung aktivieren", FR: "Activer la traduction auto MAT", RU: "Включить автоперевод MAT", UA: "Увімкнути автопереклад MAT"
        },
        'masterStatusOn': {
            TW: "目前為啟用狀態。\n收到與發送的訊息會依你的設定自動翻譯。",
            CN: "当前为启用状态。\n收到与发送的消息会按你的设置自动翻译。",
            EN: "Currently ON.\nIncoming and outgoing messages are auto-translated per your settings.",
            DE: "Derzeit AN.\nEingehende und ausgehende Nachrichten werden gemäß Ihren Einstellungen automatisch übersetzt.",
            FR: "Actuellement ACTIVÉ.\nLes messages entrants et sortants sont traduits automatiquement selon vos paramètres.",
            RU: "Сейчас включено.\nВходящие и исходящие сообщения переводятся автоматически согласно вашим настройкам.",
            UA: "Зараз увімкнено.\nВхідні та вихідні повідомлення перекладаються автоматично згідно з вашими налаштуваннями."
        },
        'masterStatusOff': {
            TW: "目前為停用狀態。\n只有自動接收／發送翻譯停止，其他設定功能仍會作用。",
            CN: "当前为停用状态。\n只有自动接收／发送翻译停止，其他设置功能仍会生效。",
            EN: "Currently OFF.\nOnly automatic receive/send translation is stopped; Other settings still work.",
            DE: "Derzeit AUS.\nNur die automatische Empfangs-/Sendeübersetzung ist gestoppt; andere Einstellungen funktionieren weiterhin.",
            FR: "Actuellement DÉSACTIVÉ.\nSeule la traduction automatique de réception/envoi est arrêtée ; les autres paramètres restent actifs.",
            RU: "Сейчас выключено.\nОстановлен только автоматический перевод при приёме/отправке; остальные настройки продолжают работать.",
            UA: "Зараз вимкнено.\nЗупинено лише автоматичний переклад під час отримання/надсилання; інші налаштування продовжують працювати."
        },

        // ── 發送 / 接收：分類標籤 ──────────────────────────────────────────
        'optEmote':   { TW: "動作翻譯 (Emote)", CN: "动作翻译 (Emote)", EN: "Emote", DE: "Emote", FR: "Emote", RU: "Эмоция (Emote)", UA: "Емоція (Emote)" },
        'optAction':  { TW: "互動翻譯 (Action)", CN: "互动翻译 (Action)", EN: "Action", DE: "Aktion", FR: "Action", RU: "Действие (Action)", UA: "Дія (Action)" },
        'optWhisper': { TW: "悄悄話 (Whisper)", CN: "悄悄话 (Whisper)", EN: "Whisper", DE: "Flüstern", FR: "Chuchotement", RU: "Шёпот (Whisper)", UA: "Шепіт (Whisper)" },
        'optBeep':    { TW: "私信翻譯 (Beep)", CN: "私信翻译 (Beep)", EN: "Beep", DE: "Beep", FR: "Beep", RU: "Бип (Beep)", UA: "Біп (Beep)" },
        'optLocal':   { TW: "系統翻譯 (Local)", CN: "系统翻译 (Local)", EN: "System (Local)", DE: "System (Local)", FR: "Système (Local)", RU: "Системные (Local)", UA: "Системні (Local)" },
        'optSkipZh':  {
            TW: "語言為中文時跳過簡繁翻譯", CN: "语言为中文时跳过简繁翻译", EN: "Skip zh↔zh when lang is Chinese",
            DE: "Zh↔Zh überspringen, wenn Sprache Chinesisch", FR: "Ignorer zh↔zh si langue chinoise", RU: "Пропускать кит.↔кит. при кит. языке", UA: "Пропускати кит.↔кит. за кит. мови"
        },
        'optHideOrig': {
            TW: "隱藏原句、僅譯文", CN: "隐藏原句、仅译文", EN: "Hide original, translation only",
            DE: "Original ausblenden, nur Übersetzung", FR: "Masquer l'original, traduction seule", RU: "Скрыть оригинал, только перевод", UA: "Сховати оригінал, лише переклад"
        },
        'optFold': {
            TW: "譯文摺疊", CN: "译文折叠", EN: "Fold translation",
            DE: "Übersetzung einklappen", FR: "Replier la traduction", RU: "Свернуть перевод", UA: "Згорнути переклад"
        },

        // ── 其他設定：標籤 ─────────────────────────────────────────────────
        'optLoginNotice': { TW: "登入通知訊息", CN: "登录通知消息", EN: "Login notice", DE: "Login-Hinweis", FR: "Avis de connexion", RU: "Уведомление при входе", UA: "Сповіщення при вході" },
        'optManual':      { TW: "手動翻譯（點選訊息）", CN: "手动翻译（点选消息）", EN: "Manual translate (click message)", DE: "Manuell übersetzen (Nachricht klicken)", FR: "Traduction manuelle (clic message)", RU: "Ручной перевод (клик по сообщению)", UA: "Ручний переклад (клік на повідомлення)" },
        'optChatButton':  { TW: "聊天室快捷按鈕", CN: "聊天室快捷按钮", EN: "Chat room quick button", DE: "Chat-Schnellschaltfläche", FR: "Bouton rapide du chat", RU: "Быстрая кнопка в чате", UA: "Швидка кнопка в чаті" },
        'optFilterTranslations': { TW: "過濾指定開頭信息", CN: "过滤指定开头信息", EN: "Filter messages by prefix", DE: "Nachrichten nach Präfix filtern", FR: "Filtrer les messages par préfixe", RU: "Фильтровать сообщения по префиксу", UA: "Фільтрувати повідомлення за префіксом" },
        'hkToggle': { TW: "快捷鍵－總開關", CN: "快捷键－总开关", EN: "Hotkey — master", DE: "Tastenkürzel — Haupt", FR: "Raccourci — principal", RU: "Клавиша — главный", UA: "Клавіша — головний" },
        'hkRecv':   { TW: "快捷鍵－接收翻譯", CN: "快捷键－接收翻译", EN: "Hotkey — receive", DE: "Tastenkürzel — Empfang", FR: "Raccourci — réception", RU: "Клавиша — приём", UA: "Клавіша — отримання" },
        'hkSend':   { TW: "快捷鍵－發送翻譯", CN: "快捷键－发送翻译", EN: "Hotkey — send", DE: "Tastenkürzel — Senden", FR: "Raccourci — envoi", RU: "Клавиша — отправка", UA: "Клавіша — надсилання" },

        // ── 聊天室快捷選單 ─────────────────────────────────────────────────
        'cbtnMaster':   { TW: "總開關", CN: "总开关", EN: "Master", DE: "Haupt", FR: "Principal", RU: "Главный", UA: "Головний" },
        'cbtnSend':     { TW: "發送翻譯", CN: "发送翻译", EN: "Send", DE: "Senden", FR: "Envoi", RU: "Отправка", UA: "Надсилання" },
        'cbtnRecv':     { TW: "接收翻譯", CN: "接收翻译", EN: "Receive", DE: "Empfang", FR: "Réception", RU: "Приём", UA: "Отримання" },
        'cbtnSettings': { TW: "前往設定", CN: "前往设置", EN: "Settings", DE: "Einstellungen", FR: "Paramètres", RU: "Настройки", UA: "Налаштування" },

        // ── 快捷鍵 / 快捷選單：切換回饋 ────────────────────────────────────
        'hkRecvOn':  { TW: "✅ 接收翻譯已開啟", CN: "✅ 接收翻译已开启", EN: "✅ Receive translation ON", DE: "✅ Empfangsübersetzung an", FR: "✅ Traduction réception activée", RU: "✅ Перевод приёма включён", UA: "✅ Переклад отримання увімкнено" },
        'hkRecvOff': { TW: "❌ 接收翻譯已關閉", CN: "❌ 接收翻译已关闭", EN: "❌ Receive translation OFF", DE: "❌ Empfangsübersetzung aus", FR: "❌ Traduction réception désactivée", RU: "❌ Перевод приёма выключен", UA: "❌ Переклад отримання вимкнено" },
        'hkSendOn':  { TW: "✅ 發送翻譯已開啟", CN: "✅ 发送翻译已开启", EN: "✅ Send translation ON", DE: "✅ Sendeübersetzung an", FR: "✅ Traduction envoi activée", RU: "✅ Перевод отправки включён", UA: "✅ Переклад надсилання увімкнено" },
        'hkSendOff': { TW: "❌ 發送翻譯已關閉", CN: "❌ 发送翻译已关闭", EN: "❌ Send translation OFF", DE: "❌ Sendeübersetzung aus", FR: "❌ Traduction envoi désactivée", RU: "❌ Перевод отправки выключен", UA: "❌ Переклад надсилання вимкнено" },

        // ── 分頁常駐說明 ───────────────────────────────────────────────────
        'descMaster': {
            TW: "MAT 總開關只控制聊天室的自動接收／發送翻譯。關閉後，其他設定中的手動翻譯、選取翻譯、翻譯訊息過濾、聊天室功能與快捷鍵等仍會作用。",
            CN: "MAT 总开关只控制聊天室的自动接收／发送翻译。关闭后，其他设置中的手动翻译、选取翻译、翻译消息过滤、聊天室功能与快捷键等仍会生效。",
            EN: "The MAT master switch controls only automatic receive/send translation. Manual and selection translation, message filtering, chat utilities, hotkeys, and other settings continue to work while it is off.", DE: "Der MAT-Hauptschalter steuert nur automatische eingehende/ausgehende Übersetzungen. Manuelle und Auswahlübersetzung, Nachrichtenfilter, Chatfunktionen und Tastenkürzel bleiben aktiv.", FR: "Le commutateur principal contrôle seulement la traduction automatique des messages reçus/envoyés. Traduction manuelle et de sélection, filtres, fonctions de chat et raccourcis restent actifs.", RU: "Главный переключатель MAT управляет только автоматическим переводом входящих/исходящих сообщений. Ручной перевод, перевод выделения, фильтры, функции чата и горячие клавиши продолжают работать.", UA: "Головний перемикач MAT керує лише автоматичним перекладом вхідних/вихідних повідомлень. Ручний переклад, переклад виділення, фільтри, функції чату та гарячі клавіші залишаються активними."
        },
        'descBasic': {
            TW: "基本設定：開關「接收翻譯」「發送翻譯」並選擇各自的目標語言。細部分類（動作/互動/悄悄話/私信）在發送、接收分頁。",
            CN: "基本设置：开关「接收翻译」「发送翻译」并选择各自的目标语言。细部分类（动作/互动/悄悄话/私信）在发送、接收分页。",
            EN: "Basic: toggle Receive/Send translation and pick their target languages. Per-type toggles (emote/action/whisper/beep) are on the Send and Receive tabs.",
            DE: "Grundeinstellungen: „Empfangsübersetzung\" und „Sendeübersetzung\" ein-/ausschalten und jeweilige Zielsprache wählen. Detaillierte Optionen (Emote/Aktion/Flüstern/Beep) befinden sich auf den Tabs Senden und Empfangen.",
            FR: "Paramètres de base : activez/désactivez la « traduction reçue » et la « traduction envoyée » et choisissez leur langue cible. Les options détaillées (émote/action/chuchotement/bip) se trouvent dans les onglets Envoi et Réception.",
            RU: "Основные настройки: включите/выключите «перевод при получении» и «перевод при отправке» и выберите целевой язык для каждого. Детальные переключатели (эмоции/действия/шёпот/сигнал) находятся на вкладках «Отправка» и «Получение».",
            UA: "Основні налаштування: увімкніть/вимкніть «переклад отримання» та «переклад надсилання» і виберіть цільову мову для кожного. Детальні перемикачі (емоції/дії/шепіт/сигнал) знаходяться на вкладках «Надсилання» та «Отримання»."
        },
        'descSend': {
            TW: "發送設定：可隨時預先調整動作、互動、悄悄話、私信與其他細項；「發送翻譯」關閉時設定仍可修改，重新開啟後生效。",
            CN: "发送设置：可随时预先调整动作、互动、悄悄话、私信与其他细项；「发送翻译」关闭时设置仍可修改，重新开启后生效。",
            EN: "Send settings can be edited at any time. When Send translation is off, these options remain configurable and take effect when it is turned back on.",
            DE: "Sendeeinstellungen können jederzeit im Voraus angepasst werden (Aktion, Interaktion, Flüstern, Privatnachricht usw.). Bei deaktivierter „Sendeübersetzung\" bleiben diese Optionen änderbar und wirken, sobald sie wieder aktiviert wird.",
            FR: "Les paramètres d'envoi peuvent être ajustés à tout moment (action, interaction, chuchotement, message privé, etc.). Lorsque la « traduction envoyée » est désactivée, ces options restent modifiables et prennent effet une fois réactivées.",
            RU: "Настройки отправки можно менять заранее в любое время (действия, взаимодействия, шёпот, личные сообщения и т.д.). Когда «перевод при отправке» выключен, эти параметры остаются доступными для изменения и вступят в силу после повторного включения.",
            UA: "Налаштування надсилання можна змінювати заздалегідь у будь-який час (дії, взаємодії, шепіт, приватні повідомлення тощо). Коли «переклад надсилання» вимкнено, ці параметри залишаються доступними для зміни та набудуть чинності після повторного увімкнення."
        },
        'descRecv': {
            TW: "接收設定：可隨時預先調整動作、互動、悄悄話、私信、系統訊息與其他細項；「接收翻譯」關閉時設定仍可修改，重新開啟後生效。",
            CN: "接收设置：可随时预先调整动作、互动、悄悄话、私信、系统消息与其他细项；「接收翻译」关闭时设置仍可修改，重新开启后生效。",
            EN: "Receive settings can be edited at any time. When Receive translation is off, these options remain configurable and take effect when it is turned back on.",
            DE: "Empfangseinstellungen können jederzeit im Voraus angepasst werden (Aktion, Interaktion, Flüstern, Privatnachricht, Systemnachricht usw.). Bei deaktivierter „Empfangsübersetzung\" bleiben diese Optionen änderbar und wirken, sobald sie wieder aktiviert wird.",
            FR: "Les paramètres de réception peuvent être ajustés à tout moment (action, interaction, chuchotement, message privé, message système, etc.). Lorsque la « traduction reçue » est désactivée, ces options restent modifiables et prennent effet une fois réactivées.",
            RU: "Настройки получения можно менять заранее в любое время (действия, взаимодействия, шёпот, личные сообщения, системные сообщения и т.д.). Когда «перевод при получении» выключен, эти параметры остаются доступными для изменения и вступят в силу после повторного включения.",
            UA: "Налаштування отримання можна змінювати заздалегідь у будь-який час (дії, взаємодії, шепіт, приватні повідомлення, системні повідомлення тощо). Коли «переклад отримання» вимкнено, ці параметри залишаються доступними для зміни та набудуть чинності після повторного увімкнення."
        },
        'descOther': {
            TW: "其他設定：登入通知、手動翻譯、選取翻譯、自動捲動、略過結巴、聊天室快捷按鈕與翻譯訊息過濾。",
            CN: "其他设置：登录通知、手动翻译、选取翻译、自动滚动、略过结巴、聊天室快捷按钮与翻译消息过滤。",
            EN: "Other: login notice, manual translate, selection translate, auto-scroll, skip stutter, chat quick button, and translation-message filtering.",
            DE: "Sonstiges: Anmeldebenachrichtigung, manuelle Übersetzung, Auswahlübersetzung, automatisches Scrollen, Stotter-Präfix überspringen, Chat-Schnellschaltfläche und Filterung übersetzter Nachrichten.",
            FR: "Autres : notification de connexion, traduction manuelle, traduction de la sélection, défilement automatique, ignorer le préfixe de bégaiement, bouton rapide du chat et filtrage des messages traduits.",
            RU: "Прочее: уведомление о входе, ручной перевод, перевод выделения, автопрокрутка, пропуск заикания, быстрая кнопка чата и фильтрация переведённых сообщений.",
            UA: "Інше: сповіщення про вхід, ручний переклад, переклад виділеного, автопрокрутка, пропуск заїкання, швидка кнопка чату та фільтрація перекладених повідомлень."
        },
        'descHotkeys': {
            TW: "快捷鍵：設定 MAT 總開關、接收翻譯與發送翻譯三組快捷鍵。每組快捷鍵需勾選啟用才會生效。",
            CN: "快捷键：设置 MAT 总开关、接收翻译与发送翻译三组快捷键。每组快捷键需勾选启用才会生效。",
            EN: "Hotkeys: configure shortcuts for the MAT master switch, receive translation, and send translation. Each shortcut must be enabled to take effect.",
            DE: "Tastenkürzel für MAT-Hauptschalter, Empfang und Senden. Jedes Kürzel muss aktiviert werden.",
            FR: "Configurez les raccourcis MAT principal, réception et envoi. Chaque raccourci doit être activé.",
            RU: "Настройте клавиши MAT для главного переключателя, приёма и отправки. Каждую нужно включить.",
            UA: "Налаштуйте клавіші MAT для головного перемикача, отримання й надсилання. Кожну треба ввімкнути."
        },

        // ── 逐項說明 ───────────────────────────────────────────────────────
        'dRecv':     { TW: "自動翻譯收到的聊天訊息。", CN: "自动翻译收到的聊天消息。", EN: "Auto-translate messages you receive.", DE: "Empfangene Nachrichten automatisch übersetzen.", FR: "Traduire automatiquement les messages reçus.", RU: "Автоматически переводить входящие сообщения.", UA: "Автоматично перекладати отримані повідомлення." },
        'dRecvLang': { TW: "收到的訊息要翻成的語言。", CN: "收到的消息要翻成的语言。", EN: "Language to translate received messages into.", DE: "Zielsprache für empfangene Nachrichten.", FR: "Langue cible des messages reçus.", RU: "Язык перевода входящих сообщений.", UA: "Мова перекладу отриманих повідомлень." },
        'dSend':     { TW: "自動翻譯你發送的訊息並廣播 [🌐] 版本。", CN: "自动翻译你发送的消息并广播 [🌐] 版本。", EN: "Auto-translate your outgoing messages and broadcast a [🌐] version.", DE: "Ausgehende Nachrichten automatisch übersetzen und eine [🌐]-Version senden.", FR: "Traduire automatiquement vos messages et diffuser une version [🌐].", RU: "Автоматически переводить исходящие сообщения и отправлять версию [🌐].", UA: "Автоматично перекладати вихідні повідомлення та надсилати версію [🌐]." },
        'dSendLang': { TW: "你發送的訊息要翻成的語言。", CN: "你发送的消息要翻成的语言。", EN: "Language to translate your outgoing messages into.", DE: "Zielsprache für gesendete Nachrichten.", FR: "Langue cible des messages envoyés.", RU: "Язык перевода исходящих сообщений.", UA: "Мова перекладу надісланих повідомлень." },
        'dEmote':    { TW: "翻譯 *動作* 訊息（Emote）。", CN: "翻译 *动作* 消息（Emote）。", EN: "Translate *emote* messages.", DE: "*Emote*-Nachrichten übersetzen.", FR: "Traduire les messages *emote*.", RU: "Переводить сообщения *Emote*.", UA: "Перекладати повідомлення *Emote*." },
        'dAction':   { TW: "翻譯互動／活動類訊息（Action）。", CN: "翻译互动／活动类消息（Action）。", EN: "Translate action/activity messages.", DE: "Aktions-/Aktivitätsnachrichten übersetzen.", FR: "Traduire les messages d’action/activité.", RU: "Переводить сообщения о действиях.", UA: "Перекладати повідомлення про дії." },
        'dWhisper':  { TW: "翻譯悄悄話（Whisper）。", CN: "翻译悄悄话（Whisper）。", EN: "Translate whispers.", DE: "Flüsternachrichten übersetzen.", FR: "Traduire les chuchotements.", RU: "Переводить шёпот.", UA: "Перекладати шепіт." },
        'dBeep':     { TW: "翻譯私信（Beep）。", CN: "翻译私信（Beep）。", EN: "Translate beep messages.", DE: "Beep-Nachrichten übersetzen.", FR: "Traduire les messages Beep.", RU: "Переводить сообщения Beep.", UA: "Перекладати повідомлення Beep." },
        'dLocal':    { TW: "翻譯系統／本機（Local）訊息，例如系統提示。預設關閉。", CN: "翻译系统／本机（Local）消息，例如系统提示。默认关闭。", EN: "Translate system/local messages (e.g. system notices). Off by default.", DE: "System-/lokale Nachrichten übersetzen. Standardmäßig aus.", FR: "Traduire les messages système/locaux. Désactivé par défaut.", RU: "Переводить системные/локальные сообщения. По умолчанию выключено.", UA: "Перекладати системні/локальні повідомлення. Типово вимкнено." },
        'dSkipZh':   { TW: "當你的語言設為繁/簡體，且對象內容已是中文（含日、韓例外）時跳過翻譯，避免中翻中。", CN: "当你的语言设为繁/简体，且对象内容已是中文（日、韩例外）时跳过翻译，避免中翻中。", EN: "When your language is Traditional/Simplified Chinese and the text is already Chinese (Japanese/Korean excepted), skip the pointless zh→zh translation.", DE: "Bei traditionellem/vereinfachtem Chinesisch als Zielsprache bereits chinesischen Text überspringen, außer Japanisch/Koreanisch.", FR: "Si la langue cible est le chinois traditionnel/simplifié, ignorer les textes déjà chinois, sauf le japonais/coréen.", RU: "При переводе на традиционный/упрощённый китайский пропускать уже китайский текст, кроме японского/корейского.", UA: "При перекладі традиційною/спрощеною китайською пропускати вже китайський текст, крім японського/корейського." },
        'dHideOrigSend': { TW: "發送聊天/私聊/動作/情境時不送原句，只送出翻譯結果（仍帶 [🌐] 與隱藏旗標供對方判斷）；翻譯失敗才補送原文。因翻譯需等待，自己的訊息會略慢幾百毫秒出現。", CN: "发送聊天/私聊/动作/情境时不送原句，只送出翻译结果（仍带 [🌐] 与隐藏旗标供对方判断）；翻译失败才补送原文。因翻译需等待，自己的消息会略慢几百毫秒出现。", EN: "For Chat/Whisper/Emote/Action, don't send the original — send only the translation (still tagged [🌐] plus a hidden flag); fall back to the original only if translation fails. Your message appears a few hundred ms later due to the async translation.", DE: "Für Chat/Whisper/Emote/Action nur die Übersetzung mit [🌐] und versteckter Markierung senden. Bei Fehlern das Original senden. Die Übersetzung verzögert die Anzeige um einige hundert Millisekunden.", FR: "Pour Chat/Whisper/Emote/Action, envoyer seulement la traduction avec [🌐] et un marqueur caché. Envoyer l’original en cas d’échec. Le message apparaît avec quelques centaines de millisecondes de retard.", RU: "Для Chat/Whisper/Emote/Action отправлять только перевод с [🌐] и скрытой меткой. При ошибке отправлять оригинал. Сообщение появляется с задержкой в несколько сотен миллисекунд.", UA: "Для Chat/Whisper/Emote/Action надсилати лише переклад із [🌐] та прихованою міткою. У разі помилки надсилати оригінал. Повідомлення з’являється із затримкою в кілька сотень мілісекунд." },
        'dHideOrigRecv': { TW: "接收訊息並翻譯成功後，隱藏原句、只留譯文。翻譯失敗或簡繁跳過時原句保留。", CN: "接收消息并翻译成功后，隐藏原句、只留译文。翻译失败或简繁跳过时原句保留。", EN: "After a message is received and translated, hide the original and keep only the translation. The original stays if translation fails or is zh-skipped.", DE: "Nach erfolgreicher Übersetzung das Original ausblenden. Bei Fehlern oder übersprungenem Chinesisch bleibt es sichtbar.", FR: "Masquer l’original après une traduction réussie. Le conserver en cas d’échec ou de chinois ignoré.", RU: "Скрывать оригинал после успешного перевода. При ошибке или пропуске китайского сохранять его.", UA: "Приховувати оригінал після успішного перекладу. У разі помилки або пропуску китайської залишати його." },
        'dFoldRecv': { TW: "收到訊息並翻譯成功後，把原句與譯文合併成一組；展開時譯文在上、原文在下，點訊息前方的「A/文」按鈕可展開/收合原句。翻譯失敗或簡繁跳過時不摺疊。", CN: "收到消息并翻译成功后，把原句与译文合并成一组；展开时译文在上、原文在下，点消息前方的「A/文」按钮可展开/折叠原句。翻译失败或简繁跳过时不折叠。", EN: "After translating a received message, group the original and translation; when expanded, the translation is above the original. Click \"A/文\" to show/hide the original. Not folded if translation fails or is zh-skipped.", DE: "Nach erfolgreicher Übersetzung Original und Übersetzung gruppieren. Aufgeklappt steht die Übersetzung oben. Mit „A/文“ das Original ein-/ausklappen. Bei Fehlern oder übersprungenem Chinesisch nicht einklappen.", FR: "Après traduction, regrouper traduction et original, traduction en haut. « A/文 » affiche/masque l’original. Aucun repli en cas d’échec ou de chinois ignoré.", RU: "После перевода объединять перевод и оригинал; перевод сверху. Кнопка «A/文» показывает/скрывает оригинал. При ошибке или пропуске китайского не сворачивать.", UA: "Після перекладу об’єднувати переклад та оригінал; переклад зверху. Кнопка «A/文» показує/приховує оригінал. У разі помилки або пропуску китайської не згортати." },
        'dFoldSend': { TW: "你發送的訊息翻譯廣播回顯後，把原句與譯文合併成一組（僅自己畫面）；展開時譯文在上、原文在下，點「A/文」可展開/收合原句。需搭配「僅發送譯文」關閉才有原句可摺。", CN: "你发送的消息翻译广播回显后，把原句与译文合并成一组（仅自己画面）；展开时译文在上、原文在下，点「A/文」可展开/折叠原句。需关闭「仅发送译文」才有原句可折。", EN: "After your translation broadcast echoes back, group it with your original (your view only); when expanded, the translation is above the original. Click \"A/文\" to show/hide it. Requires \"Send translation only\" to be OFF.", DE: "Nach Rückkehr der gesendeten Übersetzung diese nur in deiner Ansicht mit dem Original gruppieren; Übersetzung oben. „A/文“ klappt das Original ein/aus. „Nur Übersetzung senden“ muss ausgeschaltet sein.", FR: "Au retour de votre traduction diffusée, la regrouper avec l’original dans votre vue, traduction en haut. « A/文 » affiche/masque l’original. Désactiver « Envoyer seulement la traduction ».", RU: "После возврата отправленного перевода объединять его с оригиналом только у вас; перевод сверху. «A/文» показывает/скрывает оригинал. Требуется отключить отправку только перевода.", UA: "Після повернення надісланого перекладу об’єднувати його з оригіналом лише у вашому вікні; переклад зверху. «A/文» показує/приховує оригінал. Потрібно вимкнути надсилання лише перекладу." },
        'foldShowOrig': { TW: "顯示原文", CN: "显示原文", EN: "Show original", DE: "Original anzeigen", FR: "Afficher l'original", RU: "Показать оригинал", UA: "Показати оригінал" },
        'foldHideOrig': { TW: "收合原文", CN: "折叠原文", EN: "Hide original", DE: "Original einklappen", FR: "Masquer l'original", RU: "Свернуть оригинал", UA: "Згорнути оригінал" },
        'dLoginNotice':  { TW: "登入時在聊天室顯示 MAT 初始化通知。", CN: "登录时在聊天室显示 MAT 初始化通知。", EN: "Show the MAT init notice in chat on login.", DE: "Beim Anmelden die MAT-Startmeldung im Chat anzeigen.", FR: "Afficher la notification de démarrage MAT dans le chat à la connexion.", RU: "Показывать уведомление запуска MAT в чате при входе.", UA: "Показувати сповіщення запуску MAT у чаті під час входу." },
        'dManual':       { TW: "點選一則訊息時，出現手動翻譯的小工具列。", CN: "点选一则消息时，出现手动翻译的小工具栏。", EN: "Show a small manual-translate toolbar when you click a message.", DE: "Beim Anklicken einer Nachricht die Werkzeugleiste zur manuellen Übersetzung anzeigen.", FR: "Afficher la barre de traduction manuelle au clic sur un message.", RU: "Показывать панель ручного перевода при нажатии на сообщение.", UA: "Показувати панель ручного перекладу при натисканні на повідомлення." },
        'dSelection':    { TW: "選取任意文字後，出現翻譯氣泡（總開關關閉時仍可用）。", CN: "选取任意文字后，出现翻译气泡（总开关关闭时仍可用）。", EN: "Show a translate bubble after selecting text (works even when MAT is off).", DE: "Nach Textauswahl eine Übersetzungsblase anzeigen, auch wenn MAT ausgeschaltet ist.", FR: "Afficher une bulle de traduction après sélection de texte, même si MAT est désactivé.", RU: "Показывать окно перевода при выделении текста, даже если MAT выключен.", UA: "Показувати вікно перекладу при виділенні тексту, навіть якщо MAT вимкнено." },
        'dChatScrollFreeze': {
            TW: "載入並啟用聊天室訊息凍結擴充：往上捲看歷史訊息時新訊息不會把你捲走，並可在畫面上搜尋已顯示的內容。停用時會卸載此擴充（需重整頁面）。",
            CN: "加载并启用聊天室消息冻结扩展：往上滚看历史消息时新消息不会把你滚走，并可在画面上搜索已显示的内容。停用时会卸载此扩展（需刷新页面）。",
            EN: "Loads and enables the chat message freeze extension: scrolling up to read history won't get pulled away by new messages, and lets you search what's currently on screen. Disabling this unloads the extension (Refresh required).",
            DE: "Lädt und aktiviert die Chat-Nachrichten-Freeze-Erweiterung: Beim Hochscrollen zum Lesen der Historie wirst du nicht durch neue Nachrichten weggezogen, und du kannst den aktuell sichtbaren Inhalt durchsuchen. Deaktivieren entlädt die Erweiterung (Seite neu laden erforderlich).",
            FR: "Charge et active l'extension de gel des messages du chat : en remontant pour lire l'historique, vous ne serez plus entraîné par les nouveaux messages, et vous pouvez rechercher le contenu actuellement affiché. La désactiver décharge l'extension (actualisation requise).",
            RU: "Загружает и включает расширение заморозки сообщений чата: при прокрутке вверх для чтения истории новые сообщения не будут уводить вас вниз, а также можно искать текст на экране. Отключение выгружает расширение (требуется обновление страницы).",
            UA: "Завантажує та вмикає розширення заморозки повідомлень чату: під час прокрутки вгору для читання історії нові повідомлення не будуть тягнути вас донизу, і можна шукати текст на екрані. Вимкнення вивантажує розширення (потрібно оновити сторінку)."
        },
        'dSkipStutter':  { TW: "翻譯前移除結巴前綴（如 n-no → no），避免破碎結果。", CN: "翻译前移除结巴前缀（如 n-no → no），避免破碎结果。", EN: "Strip stutter prefixes (e.g. n-no → no) before translating to avoid broken results.", DE: "Stotterpräfixe vor der Übersetzung entfernen (z. B. n-no → no).", FR: "Supprimer les préfixes de bégaiement avant traduction (ex. n-no → no).", RU: "Удалять заикание перед переводом (например, n-no → no).", UA: "Видаляти заїкання перед перекладом (наприклад, n-no → no)." },
        'dChatButton':   { TW: "在聊天室按鈕列新增 🌐 按鈕，點擊向上展開總開關／發送／接收／前往設定。", CN: "在聊天室按钮栏新增 🌐 按钮，点击向上展开总开关／发送／接收／前往设置。", EN: "Add a 🌐 button to the chat button bar; click to pop up master/send/receive/settings.", DE: "Eine 🌐-Schaltfläche im Chat für Hauptschalter, Senden, Empfangen und Einstellungen hinzufügen.", FR: "Ajouter un bouton 🌐 au chat ouvrant les commandes principales, d’envoi, de réception et les paramètres.", RU: "Добавить кнопку 🌐 в чат для главного переключателя, отправки, приёма и настроек.", UA: "Додати кнопку 🌐 у чат для головного перемикача, надсилання, отримання та налаштувань." },
        'dFilterTranslations': { TW: "隱藏以指定文字開頭的訊息。下方輸入框以逗號分隔，預設為 [🌐],🔊；留空不過濾。修改或關閉後會恢復不再符合條件的訊息。", CN: "隐藏以指定文字开头的消息。下方输入框以逗号分隔，默认为 [🌐],🔊；留空不过滤。修改或关闭后会恢复不再符合条件的消息。", EN: "Hide messages starting with a listed prefix. Separate prefixes with commas below; default: [🌐],🔊. Empty means no filtering. Editing or disabling restores messages that no longer match.", DE: "Blendet Nachrichten mit einem angegebenen Präfix aus. Präfixe unten durch Kommas trennen; Standard: [🌐],🔊. Leer bedeutet keine Filterung. Nach Änderungen oder Deaktivierung werden nicht mehr passende Nachrichten wieder angezeigt.", FR: "Masque les messages commençant par un préfixe indiqué. Séparez les préfixes par des virgules ; par défaut : [🌐],🔊. Un champ vide désactive le filtrage. Modifier ou désactiver le filtre restaure les messages qui ne correspondent plus.", RU: "Скрывает сообщения с указанным началом. Разделяйте префиксы запятыми; по умолчанию: [🌐],🔊. Пустое поле отключает фильтрацию. После изменения или отключения неподходящие сообщения снова отображаются.", UA: "Приховує повідомлення із зазначеним початком. Розділяйте префікси комами; типово: [🌐],🔊. Порожнє поле вимикає фільтрацію. Після зміни або вимкнення повідомлення, що більше не відповідають умовам, відновлюються." },
        'dHkToggle': { TW: "啟用後可用快捷鍵切換 MAT 總開關（預設 Ctrl+M）。點右側按鈕可重新綁定。", CN: "启用后可用快捷键切换 MAT 总开关（默认 Ctrl+M）。点右侧按钮可重新绑定。", EN: "When enabled, a hotkey toggles the MAT master switch (default Ctrl+M). Click the button to rebind.", DE: "Aktiviert ein Tastenkürzel für MAT-Hauptschalter (Standard Ctrl+M). Rechts neu belegen.", FR: "Activer un raccourci pour MAT (par défaut Ctrl+M). Cliquer à droite pour le modifier.", RU: "Включить горячую клавишу для переключения MAT (по умолчанию Ctrl+M). Кнопка справа меняет сочетание.", UA: "Увімкнути гарячу клавішу для перемикання MAT (типово Ctrl+M). Кнопка праворуч змінює комбінацію." },
        'dHkRecv':   { TW: "啟用後可用快捷鍵切換接收翻譯（預設 Ctrl+R）。點右側按鈕可重新綁定。", CN: "启用后可用快捷键切换接收翻译（默认 Ctrl+R）。点右侧按钮可重新绑定。", EN: "When enabled, a hotkey toggles receive translation (default Ctrl+R). Click the button to rebind.", DE: "Aktiviert ein Tastenkürzel für Empfangsübersetzung (Standard Ctrl+R). Rechts neu belegen.", FR: "Activer un raccourci pour la traduction reçue (par défaut Ctrl+R). Cliquer à droite pour le modifier.", RU: "Включить горячую клавишу для переключения перевод входящих (по умолчанию Ctrl+R). Кнопка справа меняет сочетание.", UA: "Увімкнути гарячу клавішу для перемикання переклад вхідних (типово Ctrl+R). Кнопка праворуч змінює комбінацію." },
        'dHkSend':   { TW: "啟用後可用快捷鍵切換發送翻譯（預設 Ctrl+S）。點右側按鈕可重新綁定。", CN: "启用后可用快捷键切换发送翻译（默认 Ctrl+S）。点右侧按钮可重新绑定。", EN: "When enabled, a hotkey toggles send translation (default Ctrl+S). Click the button to rebind.", DE: "Aktiviert ein Tastenkürzel für Sendeübersetzung (Standard Ctrl+S). Rechts neu belegen.", FR: "Activer un raccourci pour la traduction envoyée (par défaut Ctrl+S). Cliquer à droite pour le modifier.", RU: "Включить горячую клавишу для переключения перевод исходящих (по умолчанию Ctrl+S). Кнопка справа меняет сочетание.", UA: "Увімкнути гарячу клавішу для перемикання переклад вихідних (типово Ctrl+S). Кнопка праворуч змінює комбінацію." },
        'optShrinkNonDialogue': { TW: "對話以外縮小", CN: "对话以外缩小", EN: "Shrink non-dialogue messages", DE: "Nichtdialog-Nachrichten verkleinern", FR: "Réduire les messages hors dialogue", RU: "Уменьшать сообщения вне диалога", UA: "Зменшувати повідомлення поза діалогом" },
        'dShrinkNonDialogue': { TW: "譯文跟隨遊戲「對話以外縮小」設定，套用原訊息實際顯示的字級。", CN: "译文跟随游戏「对话以外缩小」设置，使用原消息实际显示的字号。", EN: "Match translated non-dialogue messages to the original font size used by the game’s shrink setting.", DE: "Übersetzte Nichtdialog-Nachrichten verwenden die Originalschriftgröße gemäß der Verkleinerungseinstellung des Spiels.", FR: "Les traductions hors dialogue reprennent la taille du texte original définie par le réglage de réduction du jeu.", RU: "Переводы сообщений вне диалога используют размер шрифта оригинала согласно настройке уменьшения в игре.", UA: "Переклади повідомлень поза діалогом використовують розмір шрифту оригіналу відповідно до налаштування зменшення у грі." },
    });

    console.log('[Liko MAT strings] ✅ 已注入 i18n 字庫');
})();
