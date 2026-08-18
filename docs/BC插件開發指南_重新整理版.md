# Bondage Club 插件開發指南

> **定位：給第一次寫 BC 插件的人看的實用起手式，也給 AI 當作 BC 插件開發的結構化參考。**
>
> 本指南以本次提供的 **Bondage Club 源碼**、**ECHO Clothing Extension** 與 `liko-Plugin-Repository` 實作為主要分析材料。  
> 原則是：**先講能直接使用的做法，再集中放容易混淆的特殊情況與實務限制。**

---

## 目錄

1. [先理解 BC 插件的基本模型](#1-先理解-bc-插件的基本模型)
2. [一個插件應該怎麼開始](#2-一個插件應該怎麼開始)
3. [bcModSdk：插件與 BC 原生函式的橋樑](#3-bcmodsdk插件與-bc-原生函式的橋樑)
4. [資料與伺服器：ExtensionSettings、ServerSend 與登入生命週期](#4-資料與伺服器extensionsettingsserversend-與登入生命週期)
5. [Preference 設定頁與 Commander](#5-preference-設定頁與-commander)
6. [Canvas：文字、按鈕、勾選箱與 Hover](#6-canvas文字按鈕勾選箱與-hover)
7. [DOM 與 Canvas 混用](#7-dom-與-canvas-混用)
8. [Character、Drawing 與 GLDraw：到底是哪一套渲染在工作](#8-characterdrawing-與-gldraw到底是哪一套渲染在工作)
9. [Inventory 與 Extended Item](#9-inventory-與-extended-item)
10. [Dialog：在雙人互動畫面加入功能](#10-dialog在雙人互動畫面加入功能)
11. [聊天室訊息與插件間通訊](#11-聊天室訊息與插件間通訊)
12. [插件共用工具與專案慣例](#12-插件共用工具與專案慣例)
13. [開發時的快速檢查順序](#13-開發時的快速檢查順序)
14. [附錄：實務限制、特殊案例與容易誤判的地方](#14-附錄實務限制特殊案例與容易誤判的地方)

---

## 1. 先理解 BC 插件的基本模型

BC 插件最常見的工作可以分成五類：

| 類型 | 常見需求 | 主要入口 |
|---|---|---|
| UI | 按鈕、文字、設定頁、面板 | `DrawText`、`DrawButton`、`ElementCreate`、`PreferenceRegisterExtensionSetting` |
| 遊戲資料 | 自己的設定、狀態 | `Player.ExtensionSettings`、`ServerPlayerExtensionSettingsSync` |
| 遊戲內容 | Asset、Inventory、Extended Item | `AssetAdd`、`Inventory...`、`ExtendedItem...` |
| 遊戲流程 | 攔截或增加原生行為 | `bcModSdk.hookFunction` |
| 網路／多人 | 聊天、同步、插件間通訊 | `ServerSend`、`ChatRoomMessage`、`AccountBeep` |

寫插件時先問自己：

> **我要改的是 UI、角色畫面、Inventory、Dialog、聊天資料，還是 BC 原生流程？**

通常可以藉此直接找到正確的切入點，而不是從 `ServerSend` 或 `DrawImage` 開始亂 hook。

### Canvas 與 DOM 的基本分工

BC 本身大量 UI 使用 Canvas；DOM 則用於需要真正 HTML 元素的場景，例如輸入框、滑桿、文字輸入、瀏覽器元素等。

- **Canvas**：適合固定版面、按鈕、圖示、文字、遊戲畫面。
- **DOM**：適合文字輸入、原生 HTML 控制項、需要瀏覽器互動能力的 UI。
- **混用時**：一定要考慮兩邊的座標、縮放、層級與遮擋。

不要把「Canvas 座標」直接當成「瀏覽器 CSS 像素」。

---

## 2. 一個插件應該怎麼開始

建議把初始化分成兩階段，兩者責任要分開：

1. **Phase 1（早期階段）**：等待並 `registerMod` 註冊 `bcModSdk`，安裝不依賴玩家資料的 hook。**這一步不需要等登入，越早做越好。**
2. **Phase 2（登入後階段）**：等玩家真的登入、遊戲資源就緒後，才初始化設定、UI、Inventory、指令等業務邏輯。

**為什麼要拆開：** 如果把「註冊 SDK」也拖到登入之後才做，一旦頁面上其他插件已經在你之前 hook 了同一個函式，你自己的 mod 卻還沒註冊，可能發生載入順序依賴、或你需要的 hook 因為註冊太晚而錯過某次呼叫時機。及早註冊、延後執行，就不會出現「因為登入判斷卡住，導致 SDK 註冊太晚」這種連動問題。

### 2.1 登入判定不能只看 `Player` 是否存在

`Player` 這個全域物件在玩家還沒登入（甚至還在讀取登入畫面）時就已經存在，是一個空殼物件，所以：

```js
// ❌ 一定會誤判
if (window.Player) { ... }
```

正確作法是看 `Player` 底下「登入後才會被賦值」的欄位，最常用、最可靠的是 `Player.MemberNumber`。**未登入時它不是 `0`、不是空字串，而是貨真價實的 `undefined`**，所以要用 `!== undefined` 判斷，不要用 truthy 判斷（否則 0 號會員會被誤判成未登入）：

```js
if (window.Player?.MemberNumber !== undefined) {
    // 已登入
}
```

統一使用 `!== undefined` 這個寫法；不要混用 `Player.ID`、`AccountName` 或其他 truthy 判斷登入狀態。

### 2.2 尚未登入時：用 `LoginResponse` hook，不要輪詢 `Player`

`bcModSdk` 本身沒有獨立的「登入完成」事件 API；`LoginResponse` 是 BC 遊戲原生函式（登入成功後被呼叫，內部會把 `Player.MemberNumber` 等欄位賦值），可以透過通用的 `hookFunction` 訂閱它來取代輪詢：

```js
function isLoggedIn() {
    return typeof Player !== "undefined" && Player?.MemberNumber !== undefined;
}

function waitForLogin(modApi) {
    if (isLoggedIn()) return Promise.resolve();

    return new Promise(resolve => {
        const removeLoginHook = modApi.hookFunction("LoginResponse", 0, (args, next) => {
            const result = next(args); // 一定先讓原生 LoginResponse 執行完，Player 才會被賦值
            queueMicrotask(() => {
                if (!isLoggedIn()) return; // 登入失敗（例如密碼錯誤）時保留 hook，等下一次回應
                removeLoginHook();
                resolve();
            });
            return result;
        });
    });
}

async function bootstrap() {
    await waitFor(() => !!window.bcModSdk?.registerMod);

    const modApi = window.bcModSdk.registerMod({
        name: "MyMod",
        fullName: "My Mod",
        version: "1.0.0",
        repository: "https://github.com/example/example",
    });

    installEarlyHooks(modApi); // 不依賴 Player 的 hook 先掛，避免錯過事件

    await waitForLogin(modApi);
    initializeAfterLogin(modApi);
}

bootstrap().catch(error => console.error("[MyMod] init error:", error));
```

幾個重點：

- `LoginResponse` 必須先呼叫 `next(args)` 讓原生流程真正把 `Player.MemberNumber` 等欄位賦值完，才檢查 `isLoggedIn()`；不要在呼叫 `next` 之前就判斷。
- **BC 沒有「登出」這個選單項目。** 畫面上看起來像登出的操作（回到登入畫面、切換角色等），底層走的其實都是 `window.location.reload()`——整個頁面連同所有插件都會被完整重新載入，不是在同一份 JS 執行環境裡切換 `Player`。這代表**正常情況下，一個頁面生命週期內 `LoginResponse` 只會真正觸發一次**，不會有「同一頁面內登出又登入另一個帳號」這種情境需要處理。
- 因此上面「一次性登入初始化模板」對絕大多數插件已經足夠：初始化成功後呼叫 `hookFunction` 回傳的移除函式（`removeLoginHook`），把 hook 拆掉即可，不需要額外設計「換帳號」的邏輯。
- 唯一會讓 `LoginResponse` 在同一頁面內被呼叫多次的情況是**暫時斷線後自動重連**（`ServerHandleRelog`）——這種情況下帳號沒有變、`Player.MemberNumber` 也不會被清掉，所以就算沒移除 hook 也不會有副作用；如果真的想保守一點、讓插件在這種重連情境下也能自我修復，才用 `MemberNumber` 做冪等判斷取代「移除 hook」：

```js
let initializedMemberNumber;

function initializeCurrentAccount() {
    if (!isLoggedIn() || initializedMemberNumber === Player.MemberNumber) return;
    initializedMemberNumber = Player.MemberNumber;
    initializeAfterLogin();
}

modApi.hookFunction("LoginResponse", 0, (args, next) => {
    const result = next(args);
    queueMicrotask(initializeCurrentAccount);
    return result;
});

initializeCurrentAccount(); // 插件可能在登入完成「後」才由載入器注入，載入當下就先檢查一次
```

這只是「一次性模板」的保守版本，不是因為 BC 真的支援同頁面換帳號才需要。

- 輪詢（`setInterval` 或 `waitFor(() => Player...)`）只保留給「沒有可靠事件、且確實會延後建立」的其他 BC API；登入狀態一律用 `LoginResponse` hook，Hook 不是輪詢，只有函式真的被呼叫時才會執行，不會浪費資源。

如果插件還需要 Asset 或其他遊戲資源，登入完成後再另外等待（這屬於「資源就緒」而非「登入判定」，不要混在一起）：

```js
await waitFor(() =>
    !!window.AssetFemale3DCG &&
    typeof AssetGroupGet === "function"
);
```

---

## 3. bcModSdk：插件與 BC 原生函式的橋樑

常用 API：

```js
bcModSdk.registerMod(...)
modApi.hookFunction(name, priority, hook)
modApi.patchFunction(name, patches)
modApi.callOriginal(name, args)
modApi.unload()
```

最常用的是：

```js
modApi.hookFunction("SomeBCFunction", 5, (args, next) => {
    // 修改 args、在原函式前做事
    const result = next(args);
    // 原函式後做事
    return result;
});
```

### Hook 的基本原則

- 不需要改原流程時，**呼叫 `next(args)`**。
- 真的要阻止原流程時，才不呼叫 `next`。
- 修改參數前先確認資料結構。
- 同一個 BC 函式可能有多支插件 hook，因此 priority 要有意識地選擇：**數字越大越先執行**（`bcModSdk` 官方型別定義裡寫的是「Higher number is called first」），不是越大越晚。
- 不要為了「保險」而大量 hook；優先找更上層、語意更清楚的入口。

### Hook 要挑對「層級」，不是挑最底層

同一個效果幾乎都能在好幾個不同層級攔到。以「修改角色身上某個道具的顯示」為例，從高到低可能的入口大致是：

```text
語意最高（建議）
  ExtendedItem 相關函式 / Asset.DynamicScriptDraw
  ↓
  CharacterRefresh / DrawCharacter
  ↓
  DrawImage / DrawImageEx（Canvas 2D 路徑）
  ↓
  GLDrawImage（WebGL 路徑）
  ↓
  uniformMatrix4fv 之類的 WebGL 底層呼叫
語意最低（不建議）
```

`uniformMatrix4fv` 這種等級的 hook 技術上做得到（BC 走 WebGL 渲染時，角色每一層道具的每一次繪製最終都會呼叫到這類 GL API），但**這已經是瀏覽器 WebGL context 本身的原生方法，不是 BC 定義的語意函式**。挑這個層級下手，代表：

- 任何跟繪圖矩陣、著色器管線有關的呼叫都會經過你的 hook，不只是你想改的那個道具，**影響範圍遠大於你的實際需求**。
- BC 或瀏覽器只要調整渲染管線的實作細節（哪怕只是效能優化、換一種 WebGL 呼叫方式），你的 hook 完全不會有任何語意上的警告，就直接壞掉、或做出跟預期不同的結果，而且很難排查——因為問題出現的地方（`uniformMatrix4fv`）跟你真正想改的東西（某個道具的顯示）中間隔了好幾層。
- 一旦這支插件跟其他也在做繪圖相關 hook 的插件同時安裝，大家都卡在最底層互相搶同一組呼叫，衝突機率和除錯難度都會被放大。

**多數效果並不需要做到這個程度**，官方也不希望插件開發者往這個方向走——BC 提供 `DynamicScriptDraw`、`ExtendedItem*` 系列函式、`ScriptPermissions` 這類語意化的入口，就是希望插件透過這些管道跟遊戲互動，而不是直接鑽進渲染管線內部。**選擇 hook 目標時，先問「有沒有語意更高、影響範圍更小的函式可以做到同樣的事」，只有在真的沒有更高層入口、且效果非做到這個深度不可時，才考慮往下鑽**，並且要有心理準備：越底層的 hook，遇到官方更新時越容易整支插件一起壞掉，出問題時受影響的範圍也越大、越難定位。

實務上一個常見情境是「在別人畫面上疊加自己的按鈕」（例如在 `InformationSheetRun` 上畫濾鏡設定按鈕）。這類 hook 慣例上把 priority 設在 **5 以上、但不超過 10**：BCX 這類主流管理型插件的子畫面掛在數字 10 的層級，5 以上又能確保排在大多數其他插件的按鈕之後、正常疊上去。跟這個慣例數字區間保持一致，通常就足夠避免衝突，不需要額外寫「偵測其他插件子畫面」的邏輯（例如 `window.bcx?.inBcxSubscreen?.()`）；那種偵測只在真的與某個知名插件確定衝突、且對方剛好有暴露對應查詢 API 時，才值得當補丁加上去。

### `@grant`

使用 `bcModSdk` 時，Userscript 建議使用：

```js
// @grant none
```

因為 Mod SDK 需要直接操作頁面中的 BC 全域與函式。

---

## 4. 資料與伺服器：ExtensionSettings、ServerSend 與登入生命週期

### 4.1 ExtensionSettings 只保存自己的鍵

插件自己的設定應放在：

```js
Player.ExtensionSettings.MyPlugin
```

儲存時不要把整個 `Player.ExtensionSettings` 塞回 `AccountUpdate`。

推薦：

```js
const EXTENSION_KEY = "MyPlugin";

Player.ExtensionSettings ??= {};
Player.ExtensionSettings[EXTENSION_KEY] = JSON.stringify(mySettings);

ServerPlayerExtensionSettingsSync(EXTENSION_KEY);
```

BC 目前的 `ServerPlayerExtensionSettingsSync` 會只建立：

```js
{
    "ExtensionSettings.MyPlugin": "..."
}
```

再送出 `AccountUpdate`。

**核心原則：只同步自己的鍵，而且只在真的需要保存時同步。**

> ⚠️ **實務觀察（非 BC 原始碼證實，僅供參考）**：`AccountUpdate` 單次傳輸似乎存在容量上限，社群實測抓到的門檻大約在 `180000` 字元量級。BC 客戶端原始碼裡沒有這個常數（只有 `ServerChatMessageMaxLength = 2000` 這類聊天字數上限），所以 `180000` 不是官方保證值，不要當成安全邊界寫死判斷。真正該守住的底線是：**永遠只送出自己真正變更、確定歸屬自己的單一鍵，不要有「整包回傳」或「幫其他插件補送」的邏輯路徑**；如果自己的單一鍵本身就大到有疑慮，才需要處理壓縮、拆鍵，或改用其他儲存方式（如 `localStorage`）。

### 4.2 ServerSend 不等於「直接送出」

插件常見：

```js
ServerSend("ChatRoomChat", {...});
ServerSend("AccountBeep", {...});
ServerSend("ChatRoomAdmin", {...});
```

但 `ServerSend` 本身還會經過 BC 的送出佇列與限制。因此：

> **不要假設呼叫 `ServerSend()` 就代表資料已經立即抵達伺服器。**

若需求是「攔截原生流程」，優先考慮 hook BC 函式，而不是自行掛 socket。

### 4.3 `OnlineSharedSettings`：核心功能是「分享你想分享的資訊」，不只是存資料

`Player.OnlineSharedSettings` 跟 `ExtensionSettings` 最根本的差異，不是同步機制細節，而是**用途本身**：`ExtensionSettings` 是插件寫給自己看的私有資料，其他玩家的用戶端完全看不到；`OnlineSharedSettings` 則會**隨角色資料一起同步給場景裡看得到你的其他人**，本質上是「你主動公開讓別人（的角色、對方的插件）能讀到的一組宣告」。BC 原生的 `AllowFullWardrobeAccess`（願不願意讓對方直接用完整衣櫃）、`BlockBodyCosplay`（願不願意讓人 cosplay 你的身體）、`ScriptPermissions`（願意讓哪個關係等級的腳本做 Hide/Block）都是這個用途的例子——這些欄位存在的意義就是「讓別人知道並尊重你的選擇」，不是單純的個人儲存空間。

所以插件在思考要不要用 `OnlineSharedSettings` 時，該問的第一個問題是：**這筆資料是不是本來就該讓別人看到、讓別人的邏輯可以據此判斷？** 如果答案是「不需要別人知道，只是我自己插件要記住的狀態」，就應該用 `ExtensionSettings`，不要往 `OnlineSharedSettings` 塞。

理解了用途之後，再看兩者在**同步機制**上的具體差異，混用會直接出錯：

| | `ExtensionSettings` | `OnlineSharedSettings` |
|---|---|---|
| 結構 | 開放式，鍵是插件自訂的字串 | 封閉式，只有 BC 定義好的固定欄位（`AllowFullWardrobeAccess`、`BlockBodyCosplay`、`AllowPlayerLeashing`、`AllowRename`、`DisablePickingLocksOnSelf`、`ItemsAffectExpressions`、`WheelFortune`、`ScriptPermissions` 等） |
| 同步方式 | 逐鍵 dot-notation（`ServerPlayerExtensionSettingsSync`），只送自己的鍵 | 整包物件當成**單一頂層欄位**送出，沒有逐欄位同步 API |
| 驗證 | 插件自己的資料，BC 不檢查內容 | 每次都會經過 `PreferenceOnlineSharedSettingsValidate` 逐欄位驗證，**未定義的多餘欄位會被丟棄**，不是「先放著、以後兼容」 |

實務上這代表幾件事：

1. **對插件來說，`OnlineSharedSettings` 最常見的使用情境其實是「讀」，不是「寫」。** 想知道場景裡某個角色是否允許被使用完整衣櫃、是否封鎖 Body Cosplay、願意開放哪個等級的腳本權限，直接讀 `C.OnlineSharedSettings.欄位名稱` 即可——這份資料已經隨對方的角色資料同步給你，是對方主動公開的宣告，插件應該讀取並尊重它，而不是自己另外設計一套「詢問對方權限」的通訊協定。
2. **不要把 `OnlineSharedSettings` 當成另一個可以塞自訂資料的地方。** 它的 schema 是封閉的，插件自己加的欄位會在下一次驗證時被丟掉，不會保留。插件自己的私有資料一律走 `ExtensionSettings`；只有「這件事本來就該讓別人知道」的資訊才考慮 `OnlineSharedSettings`——而目前開放的欄位是 BC 自己定義好的，插件基本上只會是這些既有欄位的讀者，不太會有自己造新欄位的空間。
3. **如果真的需要修改自己的 `OnlineSharedSettings`（例如做一個 UI 讓玩家快速切換 `AllowFullWardrobeAccess`），必須讀出目前完整的物件、只改自己要改的欄位，再把整包物件送回去**，不要自己组一個只有部分欄位的新物件：

```js
Player.OnlineSharedSettings.AllowFullWardrobeAccess = true;
ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
```

`ServerAccountUpdate.QueueData` 內部用 `Map` 依「頂層欄位名稱」去重、debounce 2 秒後（最長不超過 8 秒）合併送出一次 `AccountUpdate`；同一個 2～8 秒視窗內若有多次呼叫都動到 `OnlineSharedSettings` 這個 key，**最後一次覆蓋前一次**，不是深層合併。所以如果插件在這個視窗內只送出「部分欄位」的物件，會直接把玩家其他還沒送出的 `OnlineSharedSettings` 變更（例如玩家剛好也在 Preference 頁面改了別的選項）一起蓋掉。**一律基於當下的 `Player.OnlineSharedSettings` 做修改，而不是自己另外持有一份副本。**

4. **`ScriptPermissions` 是 BC 官方提供給「腳本／插件」的授權欄位，不是插件自訂資料，但插件應該讀它、尊重它。** 它記錄玩家願意讓哪個關係等級（Self／Owner／Lovers／Friends／Whitelist／Public）的腳本去做「跳過嚴格驗證的 Hide / Block 操作」。查詢時用 BC 原生的 `ValidationHasScriptPermission(character, property, permissionLevel)`：

```js
if (ValidationHasScriptPermission(targetCharacter, "Block", ScriptPermissionLevel.FRIENDS)) {
    // 對方已經在 Preference → Scripts 開放「朋友」等級的 Block 權限，可以照這個授權做事
}
```

這跟本文一貫強調的「找語意最高的入口，而不是繞過去硬做」是同一個原則：**BC 本身就有這條 official 的授權管道**，插件要修改別人身上道具的 Hide/Block 屬性時，應該先查這個權限，而不是直接無視對方的 Preference 設定用 hook 硬改。玩家自己的 `ScriptPermissions` 則在 Preference → Scripts 分頁調整，插件通常不需要、也不應該自己另開一套 UI 去改這個欄位。

---

## 5. Preference 設定頁與 Commander

### 5.1 `PreferenceRegisterExtensionSetting`

插件可以在：

**Preference → Extensions / 其他插件設定**

加入自己的設定頁。

基本形式：

```js
PreferenceRegisterExtensionSetting({
    Identifier: "MYMOD_SETTING",
    ButtonText: "My Mod 設定",
    Image: "Icons/Settings.png",

    load: () => MyModScreen.load(),
    run: () => MyModScreen.run(),
    click: () => MyModScreen.click(),
    unload: () => MyModScreen.unload(),
    exit: () => MyModScreen.exit(),
});
```

BC 會檢查：

- `Identifier` 必須是非空字串且唯一。
- `load`、`run`、`click` 必須是函式。
- `ButtonText` 必須是文字或函式。
- `Image` 可以是文字、函式或省略。

### 5.2 Preference 返回鍵

如果自己的設定頁沒有特殊 UI 規劃，可以沿用目前常見的 BC 插件版面：

```js
DrawButton(
    1815, 75, 90, 90,
    "",
    "White",
    "Icons/Exit.png",
    T.back
);
```

點擊：

```js
if (MouseIn(1815, 75, 90, 90)) {
    PreferenceExit();
    return;
}
```

這不是 BC 強制規格，而是很實用的**版面慣例**。

### 5.3 Commander 快速前往設定

如果插件同時有 Commander 說明／指令，並且使用 `PreferenceRegisterExtensionSetting`，建議在 Commander 中提供「前往設定」。

`PreferenceRegisterExtensionSetting` 的：

```js
Identifier: "MYMOD_SETTING"
```

可以直接配合：

```js
PreferenceSubscreenExtensionsOpen("MYMOD_SETTING");
```

也就是：

```js
const modname_setting = PreferenceRegisterExtensionSetting.Identifier;

PreferenceSubscreenExtensionsOpen(modname_setting);
```

實際程式通常會把 Identifier 抽成常數，避免重複字串：

```js
const SETTING_ID = "MYMOD_SETTING";
```

然後：

```js
PreferenceRegisterExtensionSetting({
    Identifier: SETTING_ID,
    ...
});

// Commander
PreferenceSubscreenExtensionsOpen(SETTING_ID);
```

---

## 6. Canvas：文字、按鈕、勾選箱與 Hover

### 6.1 文字

BC 最基本的文字繪製：

```js
DrawText("Hello", X, Y, "White", "Gray");
```

更適合 UI 的通常是：

```js
DrawTextFit("Hello", X, Y, Width, "White", "Gray");
```

需要注意：

- Canvas 文字的 `X/Y` 是繪製基準點，不一定是左上角。
- `textAlign`、`textBaseline` 會影響位置。
- 長文字不要只靠固定寬度硬塞，優先使用 `DrawTextFit` 或換行工具。
- 多語言後文字長度可能完全不同，版面不要只用英文測試。

### 6.2 按鈕

BC 的原生：

```js
DrawButton(
    Left, Top, Width, Height,
    Label,
    Color,
    Image,
    HoveringText,
    Disabled,
    tooltipPosition
);
```

例如：

```js
DrawButton(
    1400, 800, 300, 80,
    "儲存",
    "White",
    null,
    "儲存目前設定"
);
```

`DrawButton` 會：

1. 畫背景與邊框。
2. 畫文字。
3. 有圖片時在按鈕內畫圖片。
4. 有 Hover 文字時加入 BC 的 Hover 系統。

### 6.3 勾選箱

BC 已經有：

```js
DrawCheckbox(
    Left, Top, Width, Height,
    Text,
    IsChecked
);
```

它的結構其實很簡單：

```js
DrawText(Text, Left + 100, Top + 33, ...);
DrawButton(
    Left, Top, Width, Height,
    "",
    ...,
    IsChecked ? "Icons/Checked.png" : ""
);
```

**重要：預設 Checked 圖片本身可能很大。**

如果你的 Checkbox UI 比較小，不能只把按鈕縮小後就認為圖片會自動變成理想尺寸。必要時應該：

- 自己指定適合尺寸的 Checked 圖片；
- 或不要直接使用 `DrawCheckbox`，自行畫 `DrawButton` / `DrawImageResize`；
- 點擊區域與圖片顯示尺寸分開思考。

例如需要小型 Checkbox 時：

```js
DrawButton(
    100, 100, 45, 45,
    "",
    "White",
    checked ? "Images/MyChecked.png" : ""
);
```

這樣可以完全控制圖片尺寸與點擊區域。

### 6.4 Hover 說明的特殊規則

BC 的 `DrawButtonHover` 有非常明確的左右判定：

```js
Left = (MouseX > 1000)
    ? Left - 475
    : Left + Width + 25;
```

也就是：

- 滑鼠在 **X ≤ 1000**：Hover 文字往物件右邊顯示。
- 滑鼠在 **X > 1000**：Hover 文字往物件左邊顯示。

因此開發 Canvas UI 時不要只想「我的按鈕放哪裡」，還要想：

> **Hover 框會跑去哪裡？那個方向有沒有 DOM 或其他重要 UI？**

尤其當 Canvas 旁邊有 DOM 元素時：

- X ≤ 1000 的物件，Hover 可能往右蓋到 DOM。
- X > 1000 的物件，Hover 可能往左蓋到 DOM。

必要時可以傳入 `tooltipPosition`，自行控制 Hover 區域。

---

## 7. DOM 與 Canvas 混用

BC 的 DOM 元素通常會使用 Canvas 座標系轉成實際瀏覽器位置，例如：

```js
ElementPosition(element, X, Y, W, H);
ElementPositionFixed(element, X, Y, W, H);
```

因此不要直接寫：

```js
element.style.left = X + "px";
```

然後期待它與 Canvas 的 `X` 完全一致。

### DOM 開發要特別注意

不同視窗尺寸、瀏覽器縮放、裝置比例下，Canvas 與 DOM 的實際 CSS 尺寸都可能改變。

因此：

- 優先使用 BC 的 `ElementPosition` / `ElementPositionFixed` 等工具。
- 不要把某個螢幕上的瀏覽器像素位置當成永久座標。
- 輸入框、滑桿等 DOM 元件要跟 Canvas 的設計座標建立清楚的對應。
- DOM 如果蓋住 Canvas，反過來也可能影響 Canvas 的 Hover 或操作體驗。
- 測試至少要包含一般桌面尺寸與較窄／較矮的視窗。

**Canvas UI 看起來正常，不代表 DOM UI 也會正常。**

---

## 8. Character、Drawing 與 GLDraw：到底是哪一套渲染在工作

這是 BC 插件開發最容易因為「看起來應該可以」而踩坑的區域。

### 8.1 `DrawImage` 不代表所有角色圖片都會經過它

BC 的一般 UI 繪圖大量使用：

```js
DrawImage(...)
DrawImageResize(...)
DrawImageEx(...)
```

但角色本體的生成與繪製有自己的流程。

`DrawCharacter()` 會使用角色自己的 Canvas，角色外觀中的 Asset 會在角色 Canvas 建立／更新時被組合。

因此：

> **如果你只是畫自己的 UI，使用 `DrawButton`、`DrawText`、`DrawImage` 就好。**
>
> **如果你要修改角色身上的 Asset 渲染，就必須理解 Character → Asset → Drawing / GLDraw 的流程。**

### 8.2 Character：角色是「組合後的畫布」

角色不是每一幀都把所有 Asset 當成獨立 DOM 元素。

BC 會建立角色 Canvas，將：

- 身體
- 髮型
- 衣服
- 配件
- 束縛
- 其他 Asset

依照 BC 的 Asset / Layering 規則組合。

之後 `DrawCharacter()` 再把組合好的角色 Canvas 畫到目前畫面。

因此如果你的目的是：

- 在角色最上方加一個 UI 圖示 → 不要改 Asset 渲染，直接在較上層畫。
- 改某個 Asset 的實際材質 → 才需要深入 Asset / Drawing / GLDraw。
- 做角色動態效果 → 優先研究 `DynamicScriptDraw` / `ScriptDraw` 等 BC 已提供的角色繪製入口。

### 8.3 GLDraw：角色 Asset 可能走另一條渲染路徑

BC 有 WebGL 渲染路徑，包含：

```js
GLDrawLoad
GLDrawImage
GLDraw2DCanvas
...
```

因此這個判斷非常重要：

> **你 hook `DrawImage`，不代表你一定攔得到角色 Asset。**

如果角色 Asset 當下走 GL 路徑，實際圖片可能是在 `GLDrawImage` 中處理。

如果 WebGL 不可用或發生 context 問題，BC 又可能退回 Canvas 2D 路徑。

所以要做「Asset 級別的渲染修改」時：

```text
只 hook DrawImage
        ↓
可能只攔到 Canvas UI
        ↓
角色 Asset 仍然走 GLDraw
        ↓
結果與預期不同
```

> 這種情況常常會讓人想乾脆往更底層 hook（甚至到 `GLDrawImage` 內部呼叫的 WebGL 原生方法），確保「不管走哪條路徑都攔得到」。但如第 3 節提過的，**越底層的入口影響範圍越大、跟 BC 內部實作耦合也越深**，多數情況下更好的做法是透過 `DynamicScriptDraw` 這類語意化入口，讓 BC 自己決定要走 Canvas 2D 還是 GL，你只需要在它前後插入邏輯。

### 8.4 ECHO 特別要注意（角色繪製範圍與座標會被改動）

> 這一節內容依實際使用 ECHO 時觀察與確認過的行為整理，本次工作階段拿到的原始碼只有 BC 本體分支，沒有 ECHO 自己的原始碼分支可以逐行核對，如果要精確追某個函式的實作，仍建議直接翻 ECHO 對應分支的原始碼確認。

ECHO Clothing / Activity Extension 不是單純「使用 BC API 多畫幾張圖片」的插件，它的核心工作其實是在**角色渲染的座標系統本身**動手腳：

- **擴大角色可繪製的座標範圍**，例如把原本大致 `0~250` 的角色繪製範圍延伸到 `-125~375` 這種更大的區間，讓超出原本身體邊界的服裝/道具素材有地方可以畫。
- **搬動角色本身的繪製座標**，不是只加大畫布，而是實際去調整角色在畫面上的定位/位移。
- **替換原生身體素材**，用自己的身體圖層取代 BC 原本的身體，作為它擴充服裝系統的基礎。

因此：

> **在裝有 ECHO 的環境中，角色的繪製座標系統本身就跟純 BC 原生不同**，不只是「多畫了什麼」，而是「角色本來畫在哪裡、佔多大範圍」都可能被改變。

如果你的插件也要對角色繪製動手（例如疊自己的圖層、算角色某個部位在畫面上的座標），要先確認：

1. 你算座標時用的基準，是 BC 原生的角色繪製範圍，還是要考慮 ECHO 擴張後的範圍——兩者不一致時，疊加的圖層位置會跟角色本體對不上。
2. 你 hook／依賴的繪製函式，是不是剛好被 ECHO patch 過（例如角色 Canvas 尺寸、身體素材來源），導致你原本假設的輸入/輸出跟純 BC 原生不同。
3. 你的效果是否只需要作用在「角色內部 Canvas」畫完之後的結果（例如疊一個跟角色位置無關的 UI 圖示），還是真的需要理解角色內部座標系統（例如要疊在角色身體的某個特定部位上）——只有後者才需要深入研究 ECHO 怎麼改座標，前者通常不受影響。
4. 是否能改用更高層的 BC API（例如 `DynamicScriptDraw`），讓 BC／ECHO 自己決定實際座標，你只在它前後插入邏輯，而不要自己重新計算一套座標。

### 8.5 Layering 的思考方式

BC 沒有 CSS 那種「所有東西都有 z-index」的模型。

對角色 Asset 而言，最終效果主要由：

- Asset Group；
- Layering；
- Asset 本身的繪製流程；
- Dynamic Script Draw；
- 繪製先後；

共同決定。

因此想「畫在最上面」時，先問：

> 我要的是「角色內部最上層」，還是「整個遊戲 Canvas 最上層」？

這兩者不是同一件事。

---

## 9. Inventory 與 Extended Item

### 9.1 Inventory 的核心

Inventory 開發通常會接觸：

```js
InventoryGet(...)
InventoryWear(...)
InventoryRemove(...)
InventoryAdd(...)
ChatRoomCharacterItemUpdate(...)
CharacterRefresh(...)
```

一個最基本的思路是：

```js
InventoryWear(C, "MyAsset", "ItemMisc");
CharacterRefresh(C);
```

如果是在聊天室角色上更新，通常還要考慮：

```js
ChatRoomCharacterItemUpdate(C, "ItemMisc");
```

不要只改本地物件後就假設其他玩家一定知道。

### 9.2 Extended Item

BC 對 `Asset.Extended === true` 的道具，有一套既有的 Extended Item 流程。

很多原生道具會使用：

```text
Load
Draw
Click
Exit
```

等生命週期。

如果新增真正的 Extended Asset，BC 會依照：

```text
Inventory + Group + Asset
```

組合出對應的 Extended Item 函式名稱。

因此要做自己的 Extended Item 時，優先研究 BC `Scripts/ExtendedItem.js` 與現有 Inventory 道具，而不是自己發明另一套畫面生命週期。

### 9.3 自訂 Extended Item UI

BC 已提供像：

```js
ExtendedItemCustomDraw(...)
ExtendedItemCustomClick(...)
ExtendedItemCustomClickAndPush(...)
```

以及 `ExtendedXY` 等既有版面資料。

如果你的選項本質上就是 Extended Item 的幾個選擇按鈕，優先沿用這些工具。

這樣可以：

- 跟 BC 其他 Extended Item 的版面一致；
- 少處理 hover / permission；
- 少處理選項位置；
- 減少不同尺寸下的 UI 問題。

---

## 10. Dialog：在雙人互動畫面加入功能

Dialog 是玩家點擊角色／身體部位後的互動畫面。

常見概念：

```js
DialogFocusItem
CharacterGetCurrent()
DialogCanUnlock(...)
```

以及：

```js
DialogClick(...)
```

### 10.1 不要只看「按鈕在哪裡」

Dialog 裡常常同時存在：

- 角色；
- 身體部位；
- Item；
- 操作按鈕；
- Item 參數；
- Exit；
- DOM 控制項。

因此加入自訂按鈕前，先確認：

1. 你要的是「對角色」的操作還是「對 Item」的操作。
2. 是否需要權限檢查。
3. 是否會跟 BC 原生按鈕重疊。
4. Hover 說明會往哪邊跑。
5. 操作後是否需要 `CharacterRefresh` 或 `ChatRoomCharacterItemUpdate`。

### 10.2 Dialog 跟 ECHO 的關係其實不大

先前的版本在這裡寫過「ECHO 會在 Dialog 上加自己的按鈕」，重新核對後這個說法沒有把握——這次拿到的原始碼裡沒有 ECHO 自己的分支可以逐行確認，不應該繼續當成定論寫在這裡。

比較確定的分類是：**ECHO 主要動的是「角色怎麼被畫出來」這件事**（角色可繪製座標範圍、角色定位、身體素材本身），屬於第 8.4 節討論的範圍，**不是** Dialog 這個「雙人互動選單畫面」的範圍。Dialog 本身（`DialogClick`、`CurrentCharacter.Dialog` 等）在目前確認過的行為裡就是純 BC 原生畫面。

所以實務上的判斷順序是：

1. 你要加的東西是「Dialog 選單裡的一個選項/按鈕」→ 這就是純 BC 原生 Dialog，照第 10.1 節的方式處理，不需要特別考慮 ECHO。
2. 你要加的東西是「角色身上某個部位的顯示/座標」→ 這其實是角色渲染問題，去看第 8 節（特別是 8.4），不是 Dialog 問題。
3. 只有在你自己安裝 ECHO 後**實際觀察到** Dialog 畫面出現了 BC 原生沒有的按鈕或控制項，才需要進一步去確認那是不是 ECHO 加的、加在哪個 hook 點——這種情況下請直接對照當時安裝的 ECHO 版本原始碼，不要照抄本文舊版沒把握的推測。

### 10.3 在 InformationSheet（角色資訊卡）上加按鈕

除了 Dialog，另一個插件常疊加功能的畫面是角色的「資訊卡」（InformationSheet），例如濾鏡設定、背景設定等按鈕。做法通常是 hook `InformationSheetRun`：

```js
modApi.hookFunction("InformationSheetRun", 5, (args, next) => {
    const result = next(args); // 先讓原本（以及優先度更高的其他 mod）畫完
    if (shouldShowMyButton()) drawMyButton();
    return result;
});
```

priority 慣例上設在 **5 以上、不超過 10**（見第 3 節）。另外記得同時 hook 對應的 `InformationSheetExit`（離開畫面時清理狀態/計時器）與必要時的 `InformationSheetResize`（視窗縮放時重新定位自己畫的面板座標），否則容易發生「切換角色或縮放視窗後按鈕位置飄掉、或殘留在錯誤畫面」的問題。

InformationSheet 和 Dialog 是兩個不同畫面、不同的注入點，不要搞混。

---

## 11. 聊天室訊息與插件間通訊

### 11.1 `ChatRoomChat`

送出：

```js
ServerSend("ChatRoomChat", {
    Type: "Hidden",
    Content: "MyMod_Sync",
    Dictionary: [
        { Tag: "MyMod_Sync", Value: "..." }
    ],
});
```

接收時通常在：

```js
ChatRoomMessage(data)
```

中判斷。

### 11.2 `Hidden`

適合：

> **同一聊天室內，已安裝插件的玩家之間同步資料。**

它不應該被當成一般聊天訊息。

接收端一定要先檢查自己的識別：

```js
if (
    data.Type === "Hidden" &&
    data.Content === "MyMod_Sync"
) {
    // 處理自己的資料
}
```

### 11.3 `AccountBeep`

適合：

> **指定某一個會員進行跨聊天室的插件通訊。**

例如：

```js
ServerSend("AccountBeep", {
    MemberNumber: targetMemberNumber,
    BeepType: "MyMod",
    Message: JSON.stringify(payload),
});
```

接收：

```js
ServerSocket.on("AccountBeep", data => {
    if (data.BeepType !== "MyMod") return;

    const payload = JSON.parse(data.Message);
});
```

不要把 `AccountBeep` 當成無限制的網路通道；是否能送達仍受 BC / 伺服器規則影響。**目前確認 `AccountBeep` 需要雙方互為好友**，非好友會被伺服器端擋下、完全收不到，一般或自訂 `BeepType` 都繞不過。唯一的例外是原生的 `BeepType: "Leash"` 通道：即使對象不是好友，只要彼此已有牽繩關係就能送達，且只要酬載不夾帶 `ChatRoomName`（否則會觸發跳轉房間），風險不高。

如果需求是「即時問答」而不是單向推送，可以在 `AccountBeep` 之上疊一層自訂的 Query-Reply：發送端夾帶自己的識別與一個 Query 標記，接收端在監聽中判斷 `Target` 是自己就原地回覆——這跟 BC 原生的 `AccountQuery` / `AccountQueryResult` 是完全不同的兩回事，不要混用或搞混名稱。

### 11.4 `hookFunction` 還是 `ServerSocket.on`？

簡單選擇：

| 需求 | 優先 |
|---|---|
| 只想旁聽 socket 事件 | `ServerSocket.on` |
| 要修改／阻止 BC 原生處理 | `hookFunction` |
| 要與其他 hook 協調順序 | `hookFunction` |
| 只是自己的 `BeepType` 監聽 | `ServerSocket.on` |

---

## 12. 插件共用工具與專案慣例（`liko-Plugin-Repository`）

這幾支都是掛在 `window.Liko` 底下、以 `__Sys_` 開頭的共用小工具，設計上都可被多個插件同時載入而不互相衝突（檔頭都有「已存在就 `return`」的防重複載入判斷，晚載入者自動跳過）。**引用時不需要在自己插件裡寫死版本號**；真的要寫，先核對倉庫內該檔案頂端目前的版本號，並確認工具實際行為沒有跟這裡的描述出現落差——工具持續在更新。

### 12.1 `BC_i18n.js` — 多語翻譯引擎

一份檔案含兩個子系統：

| 掛載點 | 用途 |
|---|---|
| `window.Liko.__Sys_i18n__` | 介面字串翻譯（同步取字） |
| `window.Liko.__Sys_L10N__` | 聊天訊息在地化（送出英文底本，各收訊端依自己語言重寫顯示） |

**核心設計原則：語言由插件自己決定，引擎只負責翻譯。** 不要依賴引擎幫你判斷語言，因為每個插件的語言選單邏輯不同：

```js
// 插件自己算出最終語言碼
function myLang() {
    const sel = CONFIG.lang || "auto";
    if (sel !== "auto") return sel;
    return Liko.__Sys_i18n__.detectLang(); // auto 才借用引擎的偵測
}

// 註冊字庫
Liko.__Sys_i18n__.register("MYMOD", {
    loaded: { EN: "MyMod v{v} loaded", TW: "MyMod v{v} 已載入", CN: "MyMod v{v} 已载入" },
});

// 取字（vars 傳物件 → 具名 {v}；傳陣列 → 位置式 {0}{1}）
Liko.__Sys_i18n__.t("MYMOD", "loaded", { v: "1.0" }, myLang());
```

`detectLang()` 偵測順序是 `localStorage['BondageClubLanguage']` → `TranslationLanguage` → `navigator.language` → `EN`（優先讀 `localStorage` 是因為 BC 剛啟動時 `TranslationLanguage` 會先短暫是預設值 `"EN"`，之後才被 `TranslationLoad()` 覆寫成真正語系）。

> **BC 官方語系只有 7 種：`TW` `CN` `EN` `DE` `FR` `RU` `UA`**，由全域變數 `TranslationLanguage` 決定，做翻譯優先照顧這 7 種就涵蓋絕大多數玩家。引擎另外多支援 `JA`/`KO`（超出官方的擴充語系）——可以做超過官方的語系，但 `TranslationLanguage` 不會給這些值，得靠插件自己的語言選單指定。取語言用「三段判定」最穩：**① 插件自己的語系設定（使用者手動選）→ ② `TranslationLanguage` 的設定（`auto` 時即 `detectLang()`）→ ③ 最後退回英文 `EN`**（任何語言缺字一律退 `EN`）。

聊天訊息在地化（`__Sys_L10N__`）用法：

```js
L10N.register("MYMOD", { propose: { EN: "{0} proposed to {1}", TW: "{0} 向 {1} 求婚" } });
L10N.install(modApi);  // 載入時裝一次 ChatRoomMessage hook 即可，多插件共用同一個 hook
L10N.send("MYMOD", "propose", myName, targetName);
```

字庫一律用**純字串**（不要用函式字串），才能被 JSON 化與正確讀取。

> **想在多語介面顯示萬國旗 emoji（🇹🇼 🇯🇵 🇨🇳…）？指定 `"Twemoji Country Flags"` 字型即可，不必自己載字型。** BC 在 `index.html` 已載入 `country-flag-emoji-polyfill`，會在瀏覽器本身不會畫國旗 emoji 的情況下（最典型是 Windows 上的 Chrome/Edge）自動注入一個全域 `@font-face`，把這個字型族註冊到整份文件。插件只要把字型名稱加進 `font-family` 就會正常顯示：
> ```js
> el.style.fontFamily = '"Twemoji Country Flags", sans-serif'; // DOM
> ctx.font = '36px "Twemoji Country Flags", sans-serif';       // Canvas（DrawText 前設定）
> ```
> 在原生就能畫國旗的平台（多數 macOS／iOS／Android）上 polyfill 不會注入這個字型，但那些平台本來就會用系統 emoji 正常畫出國旗，所以當 fallback 指定在各平台都安全。

### 12.2 `BC_ThemeColorCheck.js` — 介面主題顏色偵測

掛在 `window.Liko.__Sys_ColorAPI__`。BC 有淺色/深色兩套介面主題，插件想讓自己畫的按鈕、文字顏色跟著主題自動變化時，用這支工具讀出目前主題底色來判斷亮暗，不必猜測或寫死顏色規則：

```js
const Color = Liko.__Sys_ColorAPI__;
Color.getThemeColor();                // ★建議用這個：取目前介面主題底色 '#rrggbb'（已自動處理下述三條路線 + 保底）
Color.getUIColor({ x, y });           // 讀某座標上該元件「宣告時傳入」的顏色（需 bcModSdk）
Color.getCanvasColor({ x, y, size }); // 讀某區域「實際渲染出來」的顏色（取眾數，避免混入抗鋸齒髒色）
Color.isDark(color, threshold);       // 用 WCAG 相對亮度判斷亮/暗（threshold 預設 0.5）
Color.setOverride(color, isDark);     // 演算法判斷錯時手動覆寫
Color.getMode();                      // 除錯：目前走哪條路線、是否偵測到 LCE 等
```

`getThemeColor()` 內部依序試三條取色路線，呼叫端完全無感：

1. **LCE 主題 API**（最準）：玩家裝了 Liko Club Extensions（LCE）並開啟染色時，直接讀它算好的 `window.Liko.LCE.Theme.Main` 主色。
2. **宣告值**（需 `bcModSdk`）：hook `DrawRect`/`DrawButton`/`DrawEmptyRect` 直接讀傳進去的顏色字串，比取樣精確。
3. **像素取樣**（後備、無相依）：從 canvas 上取樣實際渲染結果取眾數，最後再保底用「上次成功值 → DOM 背景色」。

```js
const c = Liko.__Sys_ColorAPI__.getThemeColor();
if (c && Liko.__Sys_ColorAPI__.isDark(c)) { /* 深色主題 */ } else { /* 淺色主題 */ }
```

### 12.3 `BC_toast_system.user.js` — 全域浮動提示訊息

掛在 `window.Liko.__Sys_Toast__`（同時保留全域別名 `window.ChatRoomSendLocalStyled` 供舊插件呼叫）：

```js
window.Liko.__Sys_Toast__(message, duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "24px");
// 或用相容別名
window.ChatRoomSendLocalStyled("已儲存設定", 2000, "#00ff00");
```

功能是浮出一則會自動淡出、可堆疊排列（多則訊息自動往上疊、消失後自動補位）的提示文字，不需要自己刻 DOM 動畫。`x`/`y` 省略時置中在畫面下方；有指定時走絕對定位、不參與自動排列。

### 12.4 `BC_ChatRoomButtons.js` — 聊天室按鈕列共用協調器

目前 API 為 v5：用 `add({ id, buttonId, order, icon, tooltip, background, active, collapse, onClick })` 註冊按鈕，並以 `setActive(id, on)` / `setState(id, patch)` 更新狀態。掛在 `window.Liko.__Sys_ChatRoomButtons__`。協調器統一負責建立與重建、排序、收合動畫、底色/外框、懸停說明、顯示/隱藏、可視數量（預設 5 顆插件按鈕，不含送出鈕）及動圖播放；插件只需交付已完成顏色處理的圖示、按鈕樣式資料與行為，協調器不修改 SVG fill/stroke 或圖片內容。

```js
const L = window.Liko = window.Liko || {};
const spec = {
    id: "myplugin",
    buttonId: "myplugin-chat-button",
    order: 99,
    icon: { src: ICON_URL, animated: true }, // GIF/APNG/WebP；靜態圖片不用 animated
    tooltip: "開啟插件",
    background: "#455a64",
    onClick: openMyPlugin,
};
// 協調器已載入就直接 add；否則推進待處理佇列，等它（無論被誰載入）初始化時自動排空
if (L.__Sys_ChatRoomButtons__?.add) L.__Sys_ChatRoomButtons__.add(spec);
else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);
```

兩個關鍵坑：

- **登記與載入要解耦**：務必**同步**把 spec 交出去（直接 `add` 或 push 進 `__CRB_pending__`），**別**寫成 `ensureCRB().then(() => add(...))`——協調器可能由別的插件載入，你的 `.then` 沒在對的時機跑，按鈕就永遠不出現。
- **圖示由插件先處理完成**：協調器不染色。動圖可提供 `{ src, animated: true, poster? }`；沒有 `poster` 時會嘗試擷取影格，跨來源沒有 CORS 時應自行提供 poster。特殊 DOM 才用 `createButton`，每次呼叫都要回傳新元素。

> 這幾支加上 `bcModSdk` 都遵循同一套「系統擴充命名規則」：統一掛在 `window.Liko.__Sys_<name>__`，頂部都用「已存在就 `return`」防止重複載入，多個插件重複 `<script>` 引入也不會出錯。

---

## 13. 開發時的快速檢查順序

遇到「程式有執行但效果不對」，依照以下順序檢查：

### A. 插件是否真的初始化？

```text
Userscript 載入
 ↓
bcModSdk 是否存在？
 ↓
registerMod 是否成功？
 ↓
Player.MemberNumber 是否存在？
 ↓
需要的 Asset / Screen / Function 是否存在？
```

### B. 你 hook 的函式真的被呼叫嗎？

先確認：

```js
console.log("hook reached");
```

如果完全沒出現，先不要修改邏輯。

### C. 你是否 hook 到「錯的渲染層」？

尤其是角色 Asset：

```text
UI → DrawImage
角色 → Character Canvas
角色 Asset → Drawing / GLDraw
ECHO → 可能再 patch / 包裝
```

### D. Canvas 與 DOM 是否互相遮住？

檢查：

- Canvas 座標；
- DOM 實際 CSS 位置；
- Hover 方向；
- 視窗尺寸。

### E. 多人資料是否真的同步？

確認：

- 本地資料是否改變；
- 是否呼叫正確的同步 API；
- 伺服器訊息是否送出；
- 對方是否能收到；
- 對方是否安裝對應插件。

---

## 14. 附錄：實務限制、特殊案例與容易誤判的地方

本節集中放「知道它很重要，但不適合塞進每一個基本 API 說明旁邊」的內容。  
這樣主體可以保持簡單；日後新增特殊案例也可以直接補在這裡。

### A. `Player.ID`、`Player.MemberNumber` 不要混用

一般來說：

- `Player.MemberNumber`：玩家的會員編號。
- `Player.ID`：BC 內部使用的另一個識別值。

不要因為某個伺服器資料欄位叫 `MemberNumber`，就自動認為它一定要放 `Player.MemberNumber`。

例如 `ChatRoomAdmin` 的某些 Update 流程就是特殊情況。遇到這種 API：

> **以 BC 原生呼叫位置與現有可工作的實例為準，不要只依欄位名稱猜。**

### B. `ChatRoomAdmin` 更新房間設定

想更新房間本身的設定（背景圖、音樂網址、密碼、人數上限等）走的是 `ServerSend("ChatRoomAdmin", { ..., Action: "Update" })`。這裡的 `MemberNumber` 欄位**要填 `Player.ID`，不是 `Player.MemberNumber`**——這點已對照 BC 原生 `Screens/Online/ChatAdmin/ChatAdmin.js` 內 `ServerSend("ChatRoomAdmin", { MemberNumber: Player.ID, ..., Action: "Update" })` 的寫法確認過，不是憑欄位名稱猜的。`Player.ID` 在 `Scripts/Character.js` 裡對玩家角色恆為 `0`，跟「帳號會員編號」完全是兩件事，只是這個特定指令的欄位剛好取名為 `MemberNumber`：

```js
function updateRoomMusicURL(url) {
    if (!isFirstController() || !ChatRoomPlayerIsAdmin()) return; // 先確認自己有權限
    ChatRoomData.Custom = ChatRoomData.Custom || {};
    ChatRoomData.Custom.MusicURL = url;
    ServerSend("ChatRoomAdmin", {
        MemberNumber: Player.ID,                 // ⚠️ 這裡要 Player.ID，不是 Player.MemberNumber
        Room: ChatRoomGetSettings(ChatRoomData),  // 用原生 ChatRoomGetSettings() 包裝整包房間資料再送出
        Action: "Update",
    });
}
```

這是 `ChatRoomAdmin` 這個特定指令、特定 `Action` 的特例，**不應推論成「所有 `MemberNumber` 欄位都應該放 `Player.ID`」**。遇到任何「同名欄位、不同指令期望值不同」的情況，最保險的做法是在倉庫或其他已知能動的插件裡找一個實際案例照抄欄位怎麼填，而不是憑欄位名稱猜。另外，改房間設定前務必先確認自己有房主/管理員權限（`ChatRoomPlayerIsAdmin()`），且要先改本地 `ChatRoomData`，再用 `ChatRoomGetSettings(ChatRoomData)` 包裝整包送出，不是只送單一改動欄位。

### C. ExtensionSettings 的大小

不要把整個：

```js
Player.ExtensionSettings
```

拿來計算「我的插件還剩多少空間」。

真正應該關心的是自己送出的：

```text
ExtensionSettings.<自己的鍵>
```

如果自己的單一設定過大，應從資料設計本身處理，例如：

- 減少資料；
- 壓縮；
- 分拆；
- 改用其他儲存方式。

不要靠「把所有插件一起送一次」解決。

### D. Activity

自訂 Activity 涉及：

- `ActivityFemale3DCG`
- `ActivityID`
- `ActivityDictionary`
- 前置條件；
- 權限；
- Server / ChatRoom 流程。

如果只是想做一般按鈕功能，不要為了方便就新增 Activity。

只有當需求本身就是：

> **讓玩家在 BC 的 Activity / 互動動作系統裡看到一個新的動作**

才進入這條路。

### E. Asset 與鎖

`AssetAdd()` 可以讓新的 Asset 存在，但：

> **「有一個新的鎖 Asset」與「有一套新的獨立解鎖系統」是兩件不同的事情。**

如果只是想做外觀不同、但沿用既有鎖規則，可以借用原生鎖的資料／流程。

如果真的需要全新解鎖流程，則應把它視為一個完整的 Extended Item / Inventory UI 專案，而不是單純新增 Asset。

### F. `DrawImage` 與角色 Asset 的渲染陷阱

如果效果只針對 UI：

```js
DrawImage
DrawButton
DrawText
```

通常就夠。

如果效果針對角色 Asset：

```text
DrawImage
    ≠
GLDrawImage
    ≠
Character Canvas
```

ECHO 還可能再對其中部分流程做 patch。

所以遇到「我 hook 了 DrawImage，但角色圖片沒有改變」時，第一個問題不是「hook 寫錯」，而是：

> **那張圖片到底是哪個渲染路徑畫出來的？**

### G. Canvas Hover 與 DOM 遮擋

BC Hover 的左右方向由滑鼠 X 決定：

```text
MouseX ≤ 1000 → 向右
MouseX > 1000 → 向左
```

所以 UI 版面應該預留 Hover 空間。

特別是 Canvas + DOM 混用時：

```text
Canvas 按鈕
    ↓
Hover
    ↓
DOM
```

可能造成 DOM 被遮住或玩家誤以為 DOM 消失。

### H. 不同畫面尺寸

不要只在自己目前的 1920×1080 視窗測試。

至少思考：

- 寬度縮小；
- 高度縮小；
- 瀏覽器縮放；
- DOM 元件縮放；
- Canvas Hover；
- 按鈕是否仍在可點擊範圍；
- 文字是否超出按鈕。

### I. ECHO 與 BC 的責任邊界

當 ECHO 存在時，最重要的判斷不是：

> 「這是不是 BC 的畫面？」

而是：

> 「這個畫面／圖片目前到底由 BC 哪一層、ECHO 哪一層負責？」

尤其是：

```text
BC MainCanvas
  ├─ BC UI
  ├─ Character Canvas
  │    ├─ Asset
  │    ├─ DynamicScriptDraw
  │    └─ GLDraw / Canvas2D
  └─ DOM

ECHO
  └─ 可能 patch Character / GLDraw / 自己的 draw layer
```

插件應盡量選擇**語意最高、依賴最少的入口**。

---

## 最後：給新插件作者的一句話

不要一開始就研究整個 BC。

先回答四個問題：

1. **我要改什麼？** UI / Character / Inventory / Dialog / Chat / Data
2. **BC 原生哪個函式已經在做這件事？**
3. **我要加入它、在它前後做事，還是完全取代它？**
4. **有沒有語意更高、影響範圍更小的入口可以做到同樣的事？** 不要預設答案就是 Canvas、Character Canvas、GLDraw 這類最底層的繪圖管線——那是「其他方法都用過還是不行」時才走的最後一步，不是起手式。

只要這四題能回答清楚，大部分 BC 插件開發問題都會從「不知道該從哪裡開始」變成「找到正確的函式，然後寫自己的邏輯」；而第四題同時也是在提醒自己：**選對 hook 的目標，比 hook 得夠深更重要。**
