// Liko - MAT i18n 字庫
// 此檔案由 MAT 插件動態載入，不需手動安裝
// 載入完畢後自動呼叫 register，將字串注入共用引擎 BC_i18n
// 佔位符以 {name} 表示，由引擎的 t(ns, key, vars) 代入

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko MAT strings] i18n 引擎尚未載入');
        return;
    }

    window.Liko.i18n.register('MAT', {

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

        // ── API / 翻譯失敗 ────────────────────────────────────────────────
        'apiFail': {
            TW: "⚠️ [MAT] Google 翻譯請求失敗\n・{hint}\n・將自動重試",
            CN: "⚠️ [MAT] Google 翻译请求失败\n・{hint}\n・将自动重试",
            EN: "⚠️ [MAT] Google Translate request failed\n・{hint}\n・Will retry automatically",
            DE: "⚠️ [MAT] Google-Übersetzungsanfrage fehlgeschlagen\n・{hint}\n・Wird automatisch wiederholt",
            FR: "⚠️ [MAT] Échec de la requête Google Traduction\n・{hint}\n・Nouvelle tentative automatique",
            RU: "⚠️ [MAT] Сбой запроса Google Переводчика\n・{hint}\n・Повтор автоматически",
            UA: "⚠️ [MAT] Помилка запиту Google Перекладача\n・{hint}\n・Повтор автоматично"
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
        'optAutoScroll': {
            TW: "翻譯後自動捲動",
            CN: "翻译后自动滚动",
            EN: "Auto-Scroll After Translate",
            DE: "Nach Übersetzung automatisch scrollen",
            FR: "Défilement auto après traduction",
            RU: "Автопрокрутка после перевода",
            UA: "Автопрокручування після перекладу"
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
    });

    console.log('[Liko MAT strings] ✅ 已注入 i18n 字庫');
})();
