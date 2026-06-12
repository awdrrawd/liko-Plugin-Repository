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
        'login.enter_hint':        { TW: '請輸入帳號與密碼',                     EN: 'Enter your username and password',               JP: 'ユーザー名とパスワードを入力してください' },
        'login.fill_fields':       { TW: '請輸入帳號與密碼',                     EN: 'Please enter username and password',              JP: 'ユーザー名とパスワードを入力してください' },
        'login.label_username':    { TW: '帳號',                                EN: 'Username',                                        JP: 'ユーザー名' },
        'login.label_password':    { TW: '密碼',                                EN: 'Password',                                        JP: 'パスワード' },
        'login.placeholder_user':  { TW: '輸入帳號',                            EN: 'Enter username',                                  JP: 'ユーザー名を入力' },
        'login.placeholder_pass':  { TW: '輸入密碼',                            EN: 'Enter password',                                  JP: 'パスワードを入力' },
        'login.btn_login':         { TW: '登入',                                EN: 'Log in',                                          JP: 'ログイン' },
        'login.btn_save_acct':     { TW: '保存帳號',                            EN: 'Save account',                                    JP: 'アカウントを保存' },
        'login.btn_reset':         { TW: '修改密碼',                            EN: 'Change password',                                 JP: 'パスワードを変更' },
        'login.btn_register':      { TW: '建立新角色',                          EN: 'Create new character',                            JP: '新しいキャラクターを作成' },
        'login.privacy_note':      { TW: '帳戶已 AES-GCM 加密，僅存於本地裝置', EN: 'Credentials are AES-GCM encrypted and stored locally only', JP: '資格情報はAES-GCM暗号化されローカルにのみ保存されます' },
        'login.or_divider':        { TW: '或',                                  EN: 'or',                                              JP: 'または' },
        'login.settings_btn':      { TW: '⚙ 設定',                             EN: '⚙ Settings',                                      JP: '⚙ 設定' },

        // ── 設定浮層 ──────────────────────────────────────────────────────
        'settings.title':          { TW: '⚙ 登入頁面設定',                      EN: '⚙ Login page settings',                           JP: '⚙ ログイン画面設定' },
        'settings.marquee':        { TW: '顯示感謝跑馬燈',                      EN: 'Show credits marquee',                            JP: 'クレジットマーキーを表示' },
        'settings.accts':          { TW: '顯示帳號卡片列',                      EN: 'Show account card row',                           JP: 'アカウントカード列を表示' },
        'settings.close':          { TW: '關閉',                                EN: 'Close',                                           JP: '閉じる' },

        // ── ChatSelect ────────────────────────────────────────────────────
        'chatselect.exit_aria':    { TW: '離開',                                EN: 'Exit',                                            JP: '退出' },

        // ── ChatSearch 搜尋畫面 ───────────────────────────────────────────
        'chatsearch.search_ph':    { TW: '🔍 搜尋房間...',                      EN: '🔍 Search rooms...',                               JP: '🔍 ルームを検索...' },
        'chatsearch.clear_aria':   { TW: '清除',                                EN: 'Clear',                                           JP: 'クリア' },
        'chatsearch.filter_aria':  { TW: '篩選',                                EN: 'Filter',                                          JP: 'フィルター' },
        'chatsearch.space_male':   { TW: '目前在混區（含 M 角色固定混區）',      EN: 'Currently in mixed space (M characters always use mixed)', JP: '現在ミックスルームにいます（Mキャラは常にミックス）' },
        'chatsearch.space_to_f':   { TW: '目前在混區，點擊切換到女區',          EN: 'Mixed space — tap to switch to female space',     JP: 'ミックス → 女性専用に切替' },
        'chatsearch.space_to_x':   { TW: '目前在女區，點擊切換到混區',          EN: 'Female space — tap to switch to mixed space',     JP: '女性専用 → ミックスに切替' },
        'chatsearch.create_aria':  { TW: '建立房間',                            EN: 'Create room',                                     JP: 'ルームを作成' },
        'chatsearch.prev_aria':    { TW: '上一頁',                              EN: 'Previous page',                                   JP: '前のページ' },
        'chatsearch.next_aria':    { TW: '下一頁',                              EN: 'Next page',                                       JP: '次のページ' },
        'chatsearch.page_info':    { TW: '{page}/{total} · {count}間',          EN: '{page}/{total} · {count} rooms',                  JP: '{page}/{total} · {count}ルーム' },
        'chatsearch.no_rooms':     { TW: '沒有找到房間',                        EN: 'No rooms found',                                  JP: 'ルームが見つかりません' },
        'chatsearch.exit_btn':     { TW: '離開',                                EN: 'Exit',                                            JP: '退出' },
        'chatsearch.block_prefix': { TW: '屏蔽: ',                              EN: 'Blocked: ',                                       JP: 'ブロック: ' },
        'chatsearch.access_prefix':{ TW: '權限: ',                              EN: 'Access: ',                                        JP: 'アクセス: ' },

        // ── 房間卡片 ──────────────────────────────────────────────────────
        'room.unnamed':            { TW: '未命名房間',                          EN: 'Unnamed room',                                    JP: '名称未設定ルーム' },
        'room.by_prefix':          { TW: 'by ',                                EN: 'by ',                                             JP: 'by ' },
        'room.info_aria':          { TW: '房間資訊',                            EN: 'Room info',                                       JP: 'ルーム情報' },

        // ── 房間資訊卡 ────────────────────────────────────────────────────
        'room_info.no_desc':       { TW: '沒有描述',                            EN: 'No description',                                  JP: '説明なし' },
        'room_info.can_join':      { TW: '加入房間',                            EN: 'Join room',                                       JP: 'ルームに参加' },
        'room_info.cannot_join':   { TW: '房間不可加入',                        EN: 'Room unavailable',                                JP: '参加できません' },

        // ── 關係標籤 ──────────────────────────────────────────────────────
        'rel.owner':               { TW: '主人',                                EN: 'Owner',                                           JP: 'オーナー' },
        'rel.lover':               { TW: '戀人',                                EN: 'Lover',                                           JP: '恋人' },
        'rel.friend':              { TW: '好友',                                EN: 'Friend',                                          JP: 'フレンド' },

        // ── 假輸入框 ──────────────────────────────────────────────────────
        'fake_input.title':        { TW: '輸入訊息',                            EN: 'Type your message',                               JP: 'メッセージを入力' },
        'fake_input.cancel':       { TW: '取消',                                EN: 'Cancel',                                          JP: 'キャンセル' },
        'fake_input.send':         { TW: '送出',                                EN: 'Send',                                            JP: '送信' },
    });
})();
