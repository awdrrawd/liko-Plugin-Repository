// Liko - MPL i18n 字庫
// 此檔案由 MPL 插件動態載入，不需手動安裝
// 載入完畢後自動呼叫 register，將字串注入共用引擎

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko MPL strings] i18n 引擎尚未載入');
        return;
    }

    window.Liko.i18n.register('MPL', {

        // ── 登入頁面 ──────────────────────────────────────────────────────
        'login.enter_hint':     { TW: '請輸入帳號與密碼', EN: 'Enter your username and password', DE: 'Geben Sie Ihren Benutzernamen und Ihr Passwort ein', FR: 'Entrez votre nom d’utilisateur et votre mot de passe', RU: 'Введите имя пользователя и пароль', CN: '请输入账号和密码', UA: 'Введіть ім’я користувача та пароль' },
        'login.fill_fields':    { TW: '請輸入帳號與密碼', EN: 'Please enter username and password', DE: 'Bitte geben Sie Benutzernamen und Passwort ein', FR: 'Veuillez saisir le nom d’utilisateur et le mot de passe', RU: 'Пожалуйста, введите имя пользователя и пароль', CN: '请输入账号和密码', UA: 'Будь ласка, введіть ім’я користувача та пароль' },
        'login.label_username': { TW: '帳號',            EN: 'Username',                           DE: 'Benutzername',                      FR: 'Nom d’utilisateur',                  RU: 'Имя пользователя',                   CN: '账号',             UA: 'Ім’я користувача' },
        'login.label_password': { TW: '密碼',            EN: 'Password',                            DE: 'Passwort',                           FR: 'Mot de passe',                       RU: 'Пароль',                             CN: '密码',             UA: 'Пароль' },
        'login.placeholder_user': { TW: '輸入帳號',      EN: 'Enter username',                      DE: 'Benutzernamen eingeben',             FR: 'Saisissez le nom d’utilisateur',     RU: 'Введите имя пользователя',           CN: '输入账号',         UA: 'Введіть ім’я користувача' },
        'login.placeholder_pass': { TW: '輸入密碼',      EN: 'Enter password',                      DE: 'Passwort eingeben',                  FR: 'Saisissez le mot de passe',          RU: 'Введите пароль',                     CN: '输入密码',         UA: 'Введіть пароль' },
        'login.btn_login':      { TW: '登入',            EN: 'Log in',                              DE: 'Anmelden',                           FR: 'Se connecter',                       RU: 'Войти',                              CN: '登录',             UA: 'Увійти' },
        'login.btn_save_acct':  { TW: '保存帳號',        EN: 'Save account',                        DE: 'Konto speichern',                    FR: 'Enregistrer le compte',              RU: 'Сохранить аккаунт',                   CN: '保存账号',         UA: 'Зберегти обліковий запис' },
        'login.btn_reset':      { TW: '修改密碼',        EN: 'Change password',                     DE: 'Passwort ändern',                    FR: 'Modifier le mot de passe',           RU: 'Сменить пароль',                      CN: '修改密码',         UA: 'Змінити пароль' },
        'login.btn_register':   { TW: '建立新角色',      EN: 'Create new character',                DE: 'Neuen Charakter erstellen',          FR: 'Créer un nouveau personnage',        RU: 'Создать нового персонажа',           CN: '创建新角色',       UA: 'Створити нового персонажа' },
        'login.privacy_note':   { TW: '帳戶已 AES-GCM 加密，僅存於本地裝置', EN: 'Credentials are AES-GCM encrypted and stored locally only', DE: 'Zugangsdaten sind mit AES-GCM verschlüsselt und nur lokal gespeichert', FR: 'Les identifiants sont chiffrés en AES-GCM et stockés uniquement localement', RU: 'Данные учётной записи зашифрованы AES-GCM и хранятся только локально', CN: '账号已使用 AES-GCM 加密，仅存储在本地设备', UA: 'Облікові дані зашифровані AES-GCM і зберігаються лише локально' },
        'login.or_divider':     { TW: '或',              EN: 'or',                                  DE: 'oder',                               FR: 'ou',                                 RU: 'или',                                CN: '或',               UA: 'або' },
        'login.settings_btn':   { TW: '⚙ 設定',          EN: '⚙ Settings',                          DE: '⚙ Einstellungen',                    FR: '⚙ Paramètres',                       RU: '⚙ Настройки',                         CN: '⚙ 设置',           UA: '⚙ Налаштування' },

        // ── 設定浮層 ──────────────────────────────────────────────────────
        'settings.title':       { TW: '⚙ 登入頁面設定',  EN: '⚙ Login page settings',              DE: '⚙ Einstellungen der Anmeldeseite',   FR: '⚙ Paramètres de la page de connexion', RU: '⚙ Настройки страницы входа',         CN: '⚙ 登录页设置',     UA: '⚙ Налаштування сторінки входу' },
        'settings.marquee':     { TW: '顯示感謝跑馬燈',   EN: 'Show credits marquee',                DE: 'Dankeslaufband anzeigen',            FR: 'Afficher le défilement des remerciements', RU: 'Показывать бегущую строку благодарностей', CN: '显示感谢跑马灯', UA: 'Показувати рядок подяки' },
        'settings.accts':       { TW: '顯示帳號卡片列',   EN: 'Show account card row',               DE: 'Kontokartenzeile anzeigen',          FR: 'Afficher la rangée des cartes de compte', RU: 'Показывать ряд карточек аккаунтов', CN: '显示账号卡片列', UA: 'Показувати ряд карток облікових записів' },
        'settings.close':       { TW: '關閉',            EN: 'Close',                               DE: 'Schließen',                          FR: 'Fermer',                             RU: 'Закрыть',                            CN: '关闭',             UA: 'Закрити' },

        // ── ChatSelect ────────────────────────────────────────────────────
        'chatselect.exit_aria': { TW: '離開',            EN: 'Exit',                                DE: 'Verlassen',                          FR: 'Quitter',                            RU: 'Выйти',                              CN: '离开',             UA: 'Вийти' },

        // ── ChatSearch 搜尋畫面 ───────────────────────────────────────────
        'chatsearch.search_ph':  { TW: '🔍 搜尋房間...',  EN: '🔍 Search rooms...',                  DE: '🔍 Räume suchen...',                 FR: '🔍 Rechercher des salles...',        RU: '🔍 Поиск комнат...',                  CN: '🔍 搜索房间...',    UA: '🔍 Шукати кімнати...' },
        'chatsearch.clear_aria': { TW: '清除',            EN: 'Clear',                               DE: 'Löschen',                            FR: 'Effacer',                            RU: 'Очистить',                           CN: '清除',             UA: 'Очистити' },
        'chatsearch.filter_aria':{ TW: '篩選',            EN: 'Filter',                              DE: 'Filtern',                            FR: 'Filtrer',                            RU: 'Фильтр',                             CN: '筛选',             UA: 'Фільтр' },
        'chatsearch.space_male': { TW: '目前在混區（含 M 角色固定混區）', EN: 'Currently in mixed space (M characters always use mixed)', DE: 'Derzeit im Mischbereich (M-Charaktere immer gemischt)', FR: 'Actuellement en zone mixte (les personnages M utilisent toujours la zone mixte)', RU: 'Сейчас в смешанной зоне (персонажи M всегда в смешанной)', CN: '目前在混区（含 M 角色固定混区）', UA: 'Зараз у змішаній зоні (персонажі M завжди в змішаній)' },
        'chatsearch.space_to_f': { TW: '目前在混區，點擊切換到女區', EN: 'Mixed space — tap to switch to female space', DE: 'Mischbereich – tippen, um zur Frauenzone zu wechseln', FR: 'Zone mixte — appuyez pour passer à la zone féminine', RU: 'Смешанная зона — нажмите, чтобы перейти в женскую', CN: '目前在混区，点击切换到女区', UA: 'Змішана зона — натисніть, щоб перейти до жіночої' },
        'chatsearch.space_to_x': { TW: '目前在女區，點擊切換到混區', EN: 'Female space — tap to switch to mixed space', DE: 'Frauenzone – tippen, um zum Mischbereich zu wechseln', FR: 'Zone féminine — appuyez pour passer à la zone mixte', RU: 'Женская зона — нажмите, чтобы перейти в смешанную', CN: '目前在女区，点击切换到混区', UA: 'Жіноча зона — натисніть, щоб перейти до змішаної' },
        'chatsearch.create_aria': { TW: '建立房間',      EN: 'Create room',                         DE: 'Raum erstellen',                     FR: 'Créer une salle',                    RU: 'Создать комнату',                    CN: '创建房间',         UA: 'Створити кімнату' },
        'chatsearch.prev_aria':  { TW: '上一頁',          EN: 'Previous page',                       DE: 'Vorherige Seite',                    FR: 'Page précédente',                    RU: 'Предыдущая страница',                CN: '上一页',           UA: 'Попередня сторінка' },
        'chatsearch.next_aria':  { TW: '下一頁',          EN: 'Next page',                           DE: 'Nächste Seite',                      FR: 'Page suivante',                      RU: 'Следующая страница',                 CN: '下一页',           UA: 'Наступна сторінка' },
        'chatsearch.page_info':  { TW: '{page}/{total} · {count}間', EN: '{page}/{total} · {count} rooms', DE: '{page}/{total} · {count} Räume', FR: '{page}/{total} · {count} salles', RU: '{page}/{total} · {count} комнат', CN: '{page}/{total} · {count}间', UA: '{page}/{total} · {count} кімнат' },
        'chatsearch.no_rooms':   { TW: '沒有找到房間',    EN: 'No rooms found',                      DE: 'Keine Räume gefunden',               FR: 'Aucune salle trouvée',               RU: 'Комнаты не найдены',                  CN: '没有找到房间',     UA: 'Кімнат не знайдено' },
        'chatsearch.exit_btn':   { TW: '離開',            EN: 'Exit',                                DE: 'Verlassen',                          FR: 'Quitter',                            RU: 'Выйти',                              CN: '离开',             UA: 'Вийти' },
        'chatsearch.block_prefix': { TW: '屏蔽: ',        EN: 'Blocked: ',                           DE: 'Blockiert: ',                         FR: 'Bloqué : ',                          RU: 'Заблокировано: ',                    CN: '屏蔽: ',           UA: 'Заблоковано: ' },
        'chatsearch.access_prefix': { TW: '權限: ',       EN: 'Access: ',                            DE: 'Zugriff: ',                           FR: 'Accès : ',                           RU: 'Доступ: ',                           CN: '权限: ',           UA: 'Доступ: ' },

        // ── 房間卡片 ──────────────────────────────────────────────────────
        'room.unnamed':         { TW: '未命名房間',      EN: 'Unnamed room',                        DE: 'Unbenannter Raum',                   FR: 'Salle sans nom',                     RU: 'Комната без названия',               CN: '未命名房间',       UA: 'Кімната без назви' },
        'room.by_prefix':       { TW: 'by ',             EN: 'by ',                                 DE: 'von ',                               FR: 'par ',                               RU: 'от ',                                CN: 'by ',              UA: 'від ' },
        'room.info_aria':       { TW: '房間資訊',        EN: 'Room info',                           DE: 'Rauminformationen',                   FR: 'Infos de la salle',                  RU: 'Информация о комнате',               CN: '房间信息',         UA: 'Інформація про кімнату' },

        // ── 房間資訊卡 ────────────────────────────────────────────────────
        'room_info.no_desc':    { TW: '沒有描述',        EN: 'No description',                      DE: 'Keine Beschreibung',                  FR: 'Aucune description',                 RU: 'Описание отсутствует',                CN: '没有描述',         UA: 'Опис відсутній' },
        'room_info.can_join':   { TW: '加入房間',        EN: 'Join room',                           DE: 'Raum beitreten',                     FR: 'Rejoindre la salle',                 RU: 'Войти в комнату',                    CN: '加入房间',         UA: 'Приєднатися до кімнати' },
        'room_info.cannot_join':{ TW: '房間不可加入',    EN: 'Room unavailable',                    DE: 'Raum nicht verfügbar',               FR: 'Salle indisponible',                 RU: 'Комната недоступна',                 CN: '房间不可加入',     UA: 'Кімната недоступна' },

        // ── 關係標籤 ──────────────────────────────────────────────────────
        'rel.owner':            { TW: '主人',            EN: 'Owner',                               DE: 'Besitzer',                           FR: 'Propriétaire',                       RU: 'Владелец',                           CN: '主人',             UA: 'Власник' },
        'rel.lover':            { TW: '戀人',            EN: 'Lover',                               DE: 'Geliebte/r',                         FR: 'Amoureux',                            RU: 'Возлюбленный',                       CN: '恋人',             UA: 'Коханий/кохана' },
        'rel.friend':           { TW: '好友',            EN: 'Friend',                              DE: 'Freund',                             FR: 'Ami',                                 RU: 'Друг',                               CN: '好友',             UA: 'Друг' },

        // ── 假輸入框 ──────────────────────────────────────────────────────
        'fake_input.title':     { TW: '輸入訊息',        EN: 'Type your message',                   DE: 'Nachricht eingeben',                 FR: 'Saisissez votre message',            RU: 'Введите сообщение',                  CN: '输入消息',         UA: 'Введіть повідомлення' },
        'fake_input.cancel':    { TW: '取消',            EN: 'Cancel',                              DE: 'Abbrechen',                          FR: 'Annuler',                            RU: 'Отмена',                             CN: '取消',             UA: 'Скасувати' },
        'fake_input.send':      { TW: '送出',            EN: 'Send',                                DE: 'Senden',                             FR: 'Envoyer',                            RU: 'Отправить',                          CN: '发送',             UA: 'Надіслати' },
    });
})();
