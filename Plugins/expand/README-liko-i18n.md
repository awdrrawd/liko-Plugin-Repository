# Liko 共用多語引擎（Liko-i18n.js）接入指南

> 一份 JS、兩個子系統：`window.Liko.i18n`（介面字串）+ `window.Liko.L10N`（聊天訊息在地化）。
> 供 **BC-HSC / BC-AFC / BC-FCM**（及其他 Liko 插件）接入時參閱與修改。

檔案位置（本倉庫）：
- **引擎** → `Plugins/expand/Liko-i18n.js`（與 bcmodsdk / toast / ColorAPI 等系統擴充同處）。
- **各插件文本字庫**（`XXX-i18n.js`）→ `Plugins/Translation/`。
- sibling repo 各自把引擎放自己的 `Translation/`（或 `expand/`）、文本放自己的 `Translation/`，路徑自訂，行為一致即可。

CDN / 取得網址：

| 來源 | 網址 |
|------|------|
| raw | `https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/expand/Liko-i18n.js` |
| jsDelivr | `https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/Liko-i18n.js` |
| Pages | `https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/Liko-i18n.js` |

各 sibling repo 若透過 `copy-assets` 自帶一份，請把自己 `Translation/Liko-i18n.js` 同步成本檔內容即可（引擎有版本防重載，先載到者建立，後載者跳過）。

---

## 1. 設計要點

- **同一份檔、兩個引擎、共用內部**：語言偵測、佔位符代入、字庫倉儲、字庫載入全部共用。
- **佔位符**：以 **具名 `{name}`** 為主（`vars` 傳物件），亦相容 **位置式 `{0}{1}`**（`vars` 傳陣列）。字串一律用純字串（**不要用函式字串**），才能 JSON 化。
- **語言 fallback 鏈**：目標語言 →（`TW`↔`CN` 互退、再退 `ZH`）→ `EN` → 表中任一。
- **字庫來源**：可用「單一合併 JS」或「依語言分檔」（`.js` 自註冊 / `.json` 純資料），大文本插件可只載目前語言。
- **防重複載入**：`window.Liko.i18n.version === '2.0.0'` 時後續載入自動跳過，不會洗掉他人已註冊字庫。

---

## 2. 核心原則：語言由「插件」決定，引擎只負責翻譯

**每支插件先用自己的邏輯算出「最終語言碼」，再連同插件名、要翻的 key 一起丟給引擎。**
不要讓引擎替你判斷語言 —— 因為各插件情況不同：有的有 `auto`、有的固定語言、有的有自己的 `SUPPORTED_LANGS` 白名單（如 `HSC_LANGS = ['auto','TW','CN','EN','JP','KR','DE','FR','RU','UA']`）。

流程：

```
插件內部： 使用者選擇(auto/手動) + 自己的 LANGS 白名單  →  finalLang
呼叫引擎： Liko.i18n.t(ns, key, vars, finalLang)     // UI 字串
           Liko.i18n.ensure(ns, spec, finalLang)     // 依語言分檔時，只抓 finalLang(+EN)
```

範例（插件自帶語言選單）：

```js
const HSC_LANGS = ['auto','TW','CN','EN','JP','KR','DE','FR','RU','UA'];
function hscLang() {                       // ← 插件自己的語言決策
    const sel = CONFIG.lang || 'auto';     // 使用者手動選
    if (sel !== 'auto') return sel;        // 固定語言：直接用
    return Liko.i18n.detectLang();         // auto：才借用引擎的偵測當預設
}
Liko.i18n.t('HSC', 'loaded', { v: '1.0' }, hscLang());   // 插件名 + key + 語言
```

> `detectLang()` 只是「給沒有語言選單的純 auto 插件」用的便利預設。凡插件有自己的語言決策，一律自己算好、用第 4 參 `forceLang` 傳入，這樣**不同插件之間互不干擾**（引擎不持有全域語言狀態）。

### `detectLang()` 偵測順序（auto 預設用）

**`localStorage['BondageClubLanguage']` → `TranslationLanguage` → `navigator.language` → `EN`**。

> 為何 localStorage 優先？BC 啟動時先把 `TranslationLanguage` 宣告為預設 `"EN"`，稍後才由 `TranslationLoad()` 覆寫成真正語系。若先信任 `TranslationLanguage`，第一次渲染會抓到瞬間的 `EN`（中文使用者會看到英文閃一下再變中文）。`localStorage` 保存的是「上次選定」的真語言，開場即正確。

中文各寫法歸一：`zh` / `zh-TW` / `zh-Hant` → `TW`；`zh-CN` / `zh-Hans` → `CN`。其餘 `xx-YY` 取前段大寫。

---

## 3. `window.Liko.i18n` API（介面字串）

```js
i18n.version                       // '2.0.0'
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

## 4. `window.Liko.L10N` API（聊天訊息在地化）

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

## 5. 字庫檔三種寫法

**(A) 單一合併 JS**（`XXX-i18n.js`，自註冊；本倉庫 PCM/MAT/MPL/Prank 用此法）

```js
(function () {
  window.Liko = window.Liko ?? {};
  window.Liko.i18n?.register('HSC', {
    loaded: { EN: 'HSC v{v} loaded', TW: 'HSC v{v} 已載入', CN: 'HSC v{v} 已载入' },
    // ...
  });
})();
```
載入：`await Liko.i18n.ensure('HSC', 'https://.../Translation/HSC-i18n.js');`

**(B) 依語言分檔（`.js`，自註冊單一語言）** — 適合超大文本，只抓目前語言

```js
// HSC-i18n.TW.js
(function () { window.Liko?.i18n?.register('HSC', { loaded: { TW: 'HSC v{v} 已載入' } }); })();
```
載入：
```js
await Liko.i18n.ensure('HSC', {
  TW: 'https://.../Translation/HSC-i18n.TW.js',
  CN: 'https://.../Translation/HSC-i18n.CN.js',
  EN: 'https://.../Translation/HSC-i18n.EN.js',
}, hscLang());   // 第 3 參給插件算好的語言；只會抓該語言 + EN
```

**(C) 依語言分檔（`.json`，純資料）** — 最易維護，可交給翻譯者

```json
// HSC-i18n.TW.json
{ "loaded": "HSC v{v} 已載入", "help": "指令列表…" }
```
載入方式同 (B)：URL 以 `.json` 結尾時，引擎會把整份當成該語言的字庫註冊。

---

## 6. 各 sibling repo 接入對照

### BC-HSC（`src/i18n/i18n.js` + `l10n.js`）
- **字庫載入**：`ensureI18n()` / `_i18nLoadScript` → 改用 `Liko.i18n.ensure('HSC', HSC_I18N_URL)`（或 per-language map）。
- **取字**：保留 `hscLang()`（處理 `auto`/手動），改成 `Liko.i18n.t('HSC', key, vars, hscLang())`。
- **移除**私有 `window.Liko._HSC_strings` 與 `ui()` 內對它的讀取；`HSC_FALLBACK` 可留作「引擎尚未載入」的保底（可選）。
- **l10n.js**：私有 `HSC_L10N` tag → 改用共用 `Liko.L10N`（`register('HSC', …)` / `install(modApi)` / `send('HSC', key, …)`，Tag 統一為 `Liko_L10N`，跨插件互通）。

### BC-AFC（`src/i18n/i18n.js` + `l10n.js`）
- **UI**：`AFC_UI` 的**函式字串**（`(n)=>\`…${n}\``）→ 轉純字串 + 佔位（`'… {0}'` 或 `'… {name}'`），用 `Liko.i18n.register('AFC', {...})`；取字 `Liko.i18n.t('AFC', key, vars)`。`detectLang` 改用引擎。
- **l10n.js**：目前已用 `window.Liko.L10N`（自建 `makeEngine`）——**刪掉自建引擎**，直接沿用本檔的 `Liko.L10N`（介面相同：`register/has/t/tl/send/install`，Tag 同為 `Liko_L10N`）。`sendLocalizedAction`/`installL10n` 包裝可保留為呼叫 `L10N.send`/`L10N.install`。

### BC-FCM（`src/modules/i18n.js`）
- 把 `window.Liko._FCM_strings` 與內建 `L{zh,en}`（**函式字串 + 位置式**）→ 轉純字串，`Liko.i18n.register('FCM', {...})`。
- 保留 `T()` 包裝但改走引擎：
  ```js
  function T(key, ...args) { return Liko.i18n.t('FCM', key, args, fcmLang()); }
  ```
  （引擎第 3 參傳陣列即位置式；第 4 參 `fcmLang()` 支援手動語言）
- **移除**私有 `_FCM_strings` store 與 `ensureI18n`（改 `Liko.i18n.ensure('FCM', …)`）。

> 共同注意：所有**函式型字串**必須改為**純字串**才能 JSON 化並被引擎讀取，例如
> `loadingFriendAvatars: n => \`載入中… 剩餘 ${n} 人\`` → `'載入中… 剩餘 {0} 人'`（或 `{n}` 具名）。

---

## 7. 系統 API 註冊表 `window.Liko.__SystemAPI__`

引擎、Toast、ColorAPI 皆登記於此，便於統一查詢：

```js
window.Liko.__SystemAPI__  // { i18n, L10N, Toast, ColorAPI }
```

`bcModSdk` 不納入（需最先、獨立載入）。
