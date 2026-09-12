# Liko 共用多語引擎（BC_i18n.js）接入指南

> 一份 JS、三個全域服務：`window.Liko.__Sys_i18n__`（介面字串）、`window.Liko.__Sys_L10N__`（聊天訊息在地化）、`window.Liko.__Sys_Flags__`（按需下載國旗）。

## 國旗服務（2.2.0 新增）

素材使用 flag-icons 7.3.2（MIT，https://github.com/lipis/flag-icons/tree/v7.3.2），按需從 jsDelivr npm CDN 下載單面 SVG。完整圖集與產生腳本已移除；授權保留在 `Plugins/expand/LICENSE.flag-icons.txt`。

```js
const flags = window.Liko.__Sys_Flags__;
flags.supports('tw');         // 是否在素材支援清單（不發送網路請求）
flags.has('tw');              // 4:3 是否已下載成功
flags.status('tw');           // unsupported / idle / loading / ready / error
await flags.ensure('tw');     // 下載並回傳共用 Blob URL；同時請求共用 Promise
flags.get('tw');              // 同步取得已快取 URL，未下載回傳 null

const image = await flags.create('tw', { format: 'circle', size: 24, alt: '台灣' });
container.append(image);      // 每次建立自己的 img 節點，共用下載素材

const country = flags.forLanguage('VI'); // vn；EN → gb、JA/JP → jp、KO/KR → kr
if (country) await flags.ensure(country);
const results = await flags.ready;      // 啟動預載的 allSettled 結果，不拋出單旗失敗
```

`ensure/get/has/status` 第二參數為 `4:3`（預設）、`1:1` 或 `circle`。圓形與 1:1 共用快取；圓形裁切由 `create()` 的圖片樣式提供，單獨引用 URL 不會自帶裁切。`create()` 預設 `alt=""` 作裝飾圖片，仍應保留可讀的語言名稱。

啟動自動預載 11 面 **4:3** 國旗：`TW→tw、CN→cn、EN→gb、DE→de、FR→fr、RU→ru、UA→ua、JA→jp、KO→kr、VI→vn、ES→es`。方形／圓形首次使用時才下載。也可呼叫 `flags.preload(['TW', 'JA'], '1:1')`，回傳依輸入順序排列的 allSettled 結果。

國旗 API 接受的是**國家／地區碼**；語言必須先經 `forLanguage()`，避免將越南語 `VI` 與美屬維京群島 `vi` 混淆。`languageCountries` 是唯讀的預設對照；插件可自行決定英語改用 `us`。對照已涵蓋 MAT 的 24 種語言，但不會因此增加預設 11 面的預載；MAT 開啟語言清單時才預載其完整清單。

國旗服務 API 版本為 `1.1.0`（翻譯引擎仍是 `2.2.0`），另提供顯示轉接：

```js
flags.renderLabel(labelNode, '🇹🇼 繁體中文'); // 先顯示文字；圖片成功解碼才替換國旗
flags.bindSelect(select);                  // 原生 select 的值/事件不變，SVG popup 支援鍵盤操作
if (!flags.draw(ctx, 'tw', x, y, 32, 24)) {
    ctx.fillText('🇹🇼', x, y);              // Canvas 尚未就緒或下載失敗時回退
}
```

`renderLabel` 只用於專用文字容器，不要傳入含按鈕或 React 管理的 DOM。它會避免過期的下載結果覆蓋新標籤。`bindSelect` 可在 options/value 更新後重複呼叫，未變動時不重建；圖片失敗保留 Twemoji 文字。React 的 AEE 使用自己的 `CountryLabel` 元件管理狀態。

下載最長 15 秒，失敗後冷卻 5 秒再允許重試；不阻塞翻譯初始化。Blob URL 在同一頁面生命週期內保留，呼叫端不可自行 revoke，否則會影響其他插件。重新整理後記憶體快取會重建；HTTP 快取由瀏覽器處理。遊戲的 CSP 必須允許 CDN fetch 與 blob 圖片，實際遊戲環境尚需驗證。

國旗服務會在翻譯引擎防重載檢查**之前**獨立初始化：即使頁面已有舊 i18n/L10N，載入此版仍能增加 Flags，且不覆蓋既有字庫。AFC、FCM、HSC、LCE、Responsive 使用同步的 2.2 引擎；AEE 保留 i18next，只打包由同一權威檔產生的國旗部分。兩種入口共用 `__Sys_Flags__`。

同步部署副本：`node scripts/sync-i18n-clients.mjs`（需同層存在上述六個倉庫），之後各插件執行 `npm run build`。不要分叉修改副本。`Plugins/Translation` 的五個字庫維持原有格式，已驗證能註冊至 2.2；UI 國旗不寫入翻譯字串 HTML。

驗證：`node scripts/test-i18n-flags.cjs`（模擬網路，涵蓋預載、請求合併、比例共用、失敗重試、重複初始化、舊引擎共存與五個字庫）。`node scripts/flags-browser-check.mjs` 提供 localhost:8794 瀏覽器回歸頁，以測試 SVG 驗證顯示、過期結果、錯誤回退、下拉事件、Canvas 和圓形；不代表實際遊戲 CSP / CDN 連線驗收。
> 供 **BC-AFC / BC-FCM / BC-LCE / PCM**（及其他 Liko 插件）接入時參閱。BC-AEE 使用 i18next，維持獨立。

檔案位置（本倉庫）：
- **引擎** → `Plugins/expand/BC_i18n.js`（與 bcmodsdk / toast / ColorAPI 等系統擴充同處）。
- **各插件文本字庫**（`XXX-i18n.js`）→ `Plugins/Translation/`。
- sibling repo 可內嵌本檔的部署副本以支援獨立啟動，但不得在各專案分叉修改；唯一權威來源是本檔。

CDN / 取得網址：

| 來源 | 網址 |
|------|------|
| raw | `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/BC_i18n.js` |
| jsDelivr | `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/BC_i18n.js` |
| Pages | `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_i18n.js` |

各 sibling repo 若需支援獨立啟動，可在 `src` 內保留本檔的部署副本並打包；更新時必須完整同步權威檔，不要各自修改（引擎有版本防重載，先載到者建立，後載者跳過）。

---

## 1. 設計要點

- **同一份檔、兩個引擎、共用內部**：語言偵測、佔位符代入、字庫倉儲、字庫載入全部共用。
- **佔位符**：以 **具名 `{name}`** 為主（`vars` 傳物件），亦相容 **位置式 `{0}{1}`**（`vars` 傳陣列）。字串一律用純字串（**不要用函式字串**），才能 JSON 化。
- **語言 fallback 鏈**：目標語言 →（`TW`↔`CN` 互退、再退 `ZH`）→ `EN` → 表中任一。
- **字庫來源**：新專案統一使用每語言一份 `.json` 純資料；`loadScript()` 僅保留給既有單檔插件相容。
- **防重複載入**：`window.Liko.__Sys_i18n__` 與 `__Sys_L10N__` 都存在時，後續載入自動跳過，不會洗掉他人已註冊字庫。
- **目前版本**：`2.2.0`；新增獨立 Flags 全域，並保留 `normalizeLang()`、`onChange()`、capabilities，以及可獨立呼叫的 `L10N.localize(data)`。

---

## 2. 核心原則：語言由「插件」決定，引擎只負責翻譯

**每支插件先用自己的設定算出「自動或手動」，再把最終語言碼連同插件名、key 交給引擎。**
插件可以有自己的語言選單，但不應用共用引擎的官方語言 metadata 限制字庫；引擎會正規化任意有效的 2–3 碼語言碼，實際支援度由各 namespace 已註冊的字庫決定。未指定語言時才使用 `detectLang()`。

流程：

```
插件內部： 使用者選擇(auto/手動) + 自己的 LANGS 白名單  →  finalLang
呼叫引擎： Liko.__Sys_i18n__.t(ns, key, vars, finalLang)     // UI 字串
           Liko.__Sys_i18n__.ensure(ns, spec, finalLang)     // 依語言分檔時，只抓 finalLang(+EN)
```

範例（插件自帶語言選單）：

```js
const HSC_LANGS = ['auto','TW','CN','EN','JP','KR','DE','FR','RU','UA'];
function hscLang() {                       // ← 插件自己的語言決策
    const sel = CONFIG.lang || 'auto';     // 使用者手動選
    if (sel !== 'auto') return sel;        // 固定語言：直接用
    return Liko.__Sys_i18n__.detectLang();         // auto：才借用引擎的偵測當預設
}
Liko.__Sys_i18n__.t('HSC', 'loaded', { v: '1.0' }, hscLang());   // 插件名 + key + 語言
```

> `detectLang()` 只是「給沒有語言選單的純 auto 插件」用的便利預設。凡插件有自己的語言決策，一律自己算好、用第 4 參 `forceLang` 傳入，這樣**不同插件之間互不干擾**（引擎不持有全域語言狀態）。

### `detectLang()` 偵測順序（auto 預設用）

**`localStorage['BondageClubLanguage']` → `TranslationLanguage` → `navigator.language` → `EN`**。

> 為何 localStorage 優先？BC 啟動時先把 `TranslationLanguage` 宣告為預設 `"EN"`，稍後才由 `TranslationLoad()` 覆寫成真正語系。若先信任 `TranslationLanguage`，第一次渲染會抓到瞬間的 `EN`（中文使用者會看到英文閃一下再變中文）。`localStorage` 保存的是「上次選定」的真語言，開場即正確。

中文各寫法歸一：`zh` / `zh-TW` / `zh-Hant` → `TW`；`zh-CN` / `zh-Hans` → `CN`。其餘 `xx-YY` 取前段大寫。

### BC 官方語系與翻譯優先序

**BC 目前官方內建的語系只有 7 種：`TW`、`CN`、`EN`、`DE`、`FR`、`RU`、`UA`**，由全域變數 `TranslationLanguage` 決定（`detectLang()` 也是以它為主要依據之一）。做翻譯時**建議優先照顧這 7 種**——這是實際會有玩家用到的語系。

`officialLanguages` 只列官方 7 種，並不限制插件。其他語言會由 `normalizeLang()` 保留，實際支援度依各 namespace 已註冊的字庫動態決定，可用 `getNamespaceLanguages(ns)` 查詢。因此 FCM 可以提供 JA／KO／ES／VI，而 LCE 不會被誤認為也支援這些語言。

若你的插件支援超過官方 7 種的語系，取語言時用「雙／三段判定」最穩，優先序由高到低：

1. **插件自己的語系設定**（使用者在你的選單裡手動選的 `TW`/`JA`/…）—— 最高優先，用 `t()` 的第 4 參 `forceLang` 傳入。
2. **`TranslationLanguage` 的設定**（＝ `detectLang()` 的結果，跟隨 BC 目前語言）—— 使用者沒手動選（`auto`）時用這個。
3. **最後退回英文 `EN`**（`_pick()` 內建：任何語言缺字時一律退 `EN`，CJK 之間會先互退再退 `EN`）。

```js
function myLang() {
    const sel = CONFIG.lang || 'auto';          // 1) 插件自己的語系設定
    if (sel !== 'auto') return sel;
    return Liko.__Sys_i18n__.detectLang();       // 2) 跟隨 TranslationLanguage；缺字時引擎自動 3) 退 EN
}
Liko.__Sys_i18n__.t('MYMOD', 'loaded', { v: '1.0' }, myLang());
```

---

## 3. `window.Liko.__Sys_i18n__` API（介面字串）

```js
i18n.version                       // '2.2.0'
i18n.detectLang()                  // → 'TW' | 'CN' | 'EN' | 'JP' | ...
i18n.register(ns, strings)         // strings = { key: { EN, TW, CN, JP, ... } }
i18n.has(ns, key)                  // boolean
i18n.t(ns, key, vars?, forceLang?) // 取字；vars 物件→具名，陣列→位置式；forceLang 覆寫語言
i18n.loadScript(url)               // 抓一支合併字庫 JS 並執行（自註冊），去重 + 時間戳防快取
i18n.loadLangs(ns, urlMap, lang?)  // 依語言分檔，只抓 lang(或detectLang)+EN；urlMap={TW:url,CN:url,EN:url}
i18n.ensure(ns, spec, lang?)       // 便捷：spec 字串→loadScript；spec 物件→loadLangs
```

範例：

```js
i18n.register('HSC', { loaded: { EN: 'HSC v{v} loaded', TW: 'HSC v{v} 已載入', CN: 'HSC v{v} 已载入' } });
i18n.t('HSC', 'loaded', { v: '1.0' });          // 依 detectLang()
i18n.t('HSC', 'loaded', { v: '1.0' }, 'JP');    // 強制日文（插件自己的語言選單）
i18n.t('HSC', 'greet', ['A', 'B']);             // 位置式 → 'Hi A and B'
```

---

## 4. `window.Liko.__Sys_L10N__` API（聊天訊息在地化）

概念：送出時 `Text` 放**英文底本**（沒裝插件者看到英文），`Dictionary` 夾帶 `{ Tag:'Liko_L10N', ns, key, data }`；每個裝了引擎的**接收端** hook `ChatRoomMessage`，偵測到標記就用**自己的語言**重寫後顯示（含自己發的）。

```js
L10N.version
L10N.lang()                        // = detectLang()
L10N.register(ns, table)           // table = { key: { EN, TW, CN, ... } }
L10N.has(ns, key)
L10N.t(ns, key, ...args)           // 位置式參數
L10N.tl(lang, ns, key, ...args)    // 指定語言取字
L10N.send(ns, key, ...args)        // ServerSend 一條在地化 Action（含 EN 底本 + 標記）
L10N.install(modApi)               // 安裝唯一的 ChatRoomMessage hook（多插件共用，只裝一次）
L10N.loadScript / loadLangs / ensure   // 與 i18n 相同
```

標記常數：`Tag = 'Liko_L10N'`、Action 底本走 `CUSTOM_SYSTEM_ACTION`。

> 注意：接收端改寫用 `detectLang()`（讀者的 BC 語言）。若插件想讓「手動語言選單」也影響聊天在地化，屬少數情境，需自行處理；多數情況跟隨 BC 語言即可。

範例：

```js
L10N.register('AFC', { propose: { EN: '{0} proposed to {1}', TW: '{0} 向 {1} 求婚', CN: '{0} 向 {1} 求婚' } });
L10N.install(modApi);                 // 載入時裝一次
L10N.send('AFC', 'propose', myName, targetName);
```

---

## 5. 字庫檔格式

新專案使用 (C) JSON。以下 (A)、(B) JS 格式只供既有 Plugin Repository 單檔插件相容，不作為 AFC / FCM / LCE 新字庫的範本。

**(A) 單一合併 JS**（`XXX-i18n.js`，自註冊；本倉庫 PCM/MAT/MPL/Prank 用此法）

```js
(function () {
  window.Liko = window.Liko ?? {};
  window.Liko.__Sys_i18n__?.register('HSC', {
    loaded: { EN: 'HSC v{v} loaded', TW: 'HSC v{v} 已載入', CN: 'HSC v{v} 已载入' },
    // ...
  });
})();
```
載入：`await Liko.__Sys_i18n__.ensure('HSC', 'https://.../Translation/HSC-i18n.js');`

**(B) 依語言分檔（`.js`，自註冊單一語言；舊格式）**

```js
// HSC-i18n.TW.js
(function () { window.Liko?.__Sys_i18n__?.register('HSC', { loaded: { TW: 'HSC v{v} 已載入' } }); })();
```
載入：
```js
await Liko.__Sys_i18n__.ensure('HSC', {
  TW: 'https://.../Translation/HSC-i18n.TW.js',
  CN: 'https://.../Translation/HSC-i18n.CN.js',
  EN: 'https://.../Translation/HSC-i18n.EN.js',
}, hscLang());   // 第 3 參給插件算好的語言；只會抓該語言 + EN
```

**(C) 依語言分檔（`.json`，純資料；標準格式）** — 最易維護，可交給翻譯者

```json
// HSC-i18n.TW.json
{ "loaded": "HSC v{v} 已載入", "help": "指令列表…" }
```
載入方式同 (B)：URL 以 `.json` 結尾時，引擎會把整份當成該語言的字庫註冊。

---

## 6. 各 sibling repo 接入對照

### BC-HSC（`src/i18n/i18n.js` + `l10n.js`）
- **字庫載入**：`ensureI18n()` / `_i18nLoadScript` → 改用 `Liko.__Sys_i18n__.ensure('HSC', HSC_I18N_URL)`（或 per-language map）。
- **取字**：保留 `hscLang()`（處理 `auto`/手動），改成 `Liko.__Sys_i18n__.t('HSC', key, vars, hscLang())`。
- **移除**私有 `window.Liko._HSC_strings` 與 `ui()` 內對它的讀取；`HSC_FALLBACK` 可留作「引擎尚未載入」的保底（可選）。
- **l10n.js**：私有 `HSC_L10N` tag → 改用共用 `Liko.__Sys_L10N__`（`register('HSC', …)` / `install(modApi)` / `send('HSC', key, …)`，Tag 統一為 `Liko_L10N`，跨插件互通）。

### BC-AFC（`src/i18n/i18n.js` + `l10n.js`）
- **UI**：`AFC_UI` 的**函式字串**（`(n)=>\`…${n}\``）→ 轉純字串 + 佔位（`'… {0}'` 或 `'… {name}'`），用 `Liko.__Sys_i18n__.register('AFC', {...})`；取字 `Liko.__Sys_i18n__.t('AFC', key, vars)`。`detectLang` 改用引擎。
- **l10n.js**：目前已用 `window.Liko.__Sys_L10N__`（自建 `makeEngine`）——**刪掉自建引擎**，直接沿用本檔的 `Liko.__Sys_L10N__`（介面相同：`register/has/t/tl/send/install`，Tag 同為 `Liko_L10N`）。`sendLocalizedAction`/`installL10n` 包裝可保留為呼叫 `L10N.send`/`L10N.install`。

### BC-FCM（`src/modules/i18n.js`）
- 把 `window.Liko._FCM_strings` 與內建 `L{zh,en}`（**函式字串 + 位置式**）→ 轉純字串，`Liko.__Sys_i18n__.register('FCM', {...})`。
- 保留 `T()` 包裝但改走引擎：
  ```js
  function T(key, ...args) { return Liko.__Sys_i18n__.t('FCM', key, args, fcmLang()); }
  ```
  （引擎第 3 參傳陣列即位置式；第 4 參 `fcmLang()` 支援手動語言）
- **移除**私有 `_FCM_strings` store 與 `ensureI18n`（改 `Liko.__Sys_i18n__.ensure('FCM', …)`）。

> 共同注意：所有**函式型字串**必須改為**純字串**才能 JSON 化並被引擎讀取，例如
> `loadingFriendAvatars: n => \`載入中… 剩餘 ${n} 人\`` → `'載入中… 剩餘 {0} 人'`（或 `{n}` 具名）。

---

## 7. 系統擴充命名規則：`window.Liko.__Sys_<name>__`

所有系統擴充**統一掛在 `window.Liko` 底下、以 `__Sys_` 開頭**，一看前綴即知是系統檔（不再有 `__SystemAPI__` 這一層，避免同一物件在兩處重複出現）：

| 擴充 | 掛載位置 | 版本 |
|------|---------|------|
| i18n 引擎 | `window.Liko.__Sys_i18n__` | `.version` |
| L10N 引擎 | `window.Liko.__Sys_L10N__` | `.version` |
| Toast | `window.Liko.__Sys_Toast__`（+ 相容別名 `window.ChatRoomSendLocalStyled`） | `._version` |
| ColorAPI | `window.Liko.__Sys_ColorAPI__` | `.version` |

各擴充頂部的防重載寫法一致（以自身是否存在為旗標）：

```js
window.Liko = window.Liko ?? {};
if (window.Liko.__Sys_i18n__) return;   // 已載入就跳過
const MOD_VER = '2.1.0';
// …建立 api…
window.Liko.__Sys_i18n__ = api;         // 掛上，即完成註冊（版本讀 api.version）
```

`bcModSdk` 不納入此規則（需最先、獨立載入，自帶 `window.bcModSdk` 防重載）。
