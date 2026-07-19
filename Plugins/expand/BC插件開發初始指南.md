# Bondage Club 插件開發初始指南

整理自 `liko-Plugin-Repository` 內的共用系統擴充（`Plugins/expand/`）與各插件實作，作為新插件開發時的起手式參考，避開常見的坑。

---

## 一、共用系統擴充（`Plugins/expand/`）

這幾支都是「掛在 `window.Liko` 底下、以 `__Sys_` 開頭」的共用小工具，設計上都可被多個插件同時載入而不互相衝突（檔頭都有「已存在就 return」的防重複載入判斷）。

### 1. `BC_i18n.js` — 多語翻譯引擎

一份檔案內含兩個子系統：

| 掛載點 | 用途 |
|---|---|
| `window.Liko.__Sys_i18n__` | 介面字串翻譯（同步取字） |
| `window.Liko.__Sys_L10N__` | 聊天訊息在地化（送出英文底本，各收訊端依自己語言重寫顯示） |

**核心設計原則：語言由「插件自己」決定，引擎只負責翻譯。** 不要依賴引擎幫你判斷語言，因為每個插件的語言選單邏輯不同（有的有 `auto`、有的有自己的白名單）。流程：

```js
// 插件自己算出最終語言碼
function myLang() {
    const sel = CONFIG.lang || 'auto';
    if (sel !== 'auto') return sel;
    return Liko.__Sys_i18n__.detectLang(); // auto 才借用引擎的偵測
}

// 註冊字庫
Liko.__Sys_i18n__.register('MYMOD', {
    loaded: { EN: 'MyMod v{v} loaded', TW: 'MyMod v{v} 已載入', CN: 'MyMod v{v} 已载入' }
});

// 取字（vars 傳物件 → 具名 {v}；傳陣列 → 位置式 {0}{1}）
Liko.__Sys_i18n__.t('MYMOD', 'loaded', { v: '1.0' }, myLang());
```

`detectLang()` 偵測順序是 `localStorage['BondageClubLanguage']` → `TranslationLanguage` → `navigator.language` → `EN`（優先讀 localStorage 是因為 BC 剛啟動時 `TranslationLanguage` 會先短暫是預設值 `"EN"`，之後才被 `TranslationLoad()` 覆寫成真正語系）。

聊天訊息在地化（`__Sys_L10N__`）用法：

```js
L10N.register('MYMOD', { propose: { EN: '{0} proposed to {1}', TW: '{0} 向 {1} 求婚' } });
L10N.install(modApi);           // 載入時裝一次 ChatRoomMessage hook 即可（多插件共用同一個 hook）
L10N.send('MYMOD', 'propose', myName, targetName);
```

字庫可用「單一合併 JS」或「依語言分檔（`.js`/`.json`）」兩種方式載入，字串一律用**純字串**（不要用函式字串），才能被 JSON 化與正確讀取。細節與跨插件接入範例可參考同目錄下的 `README-bc-i18n.md`。

### 2. `BC_ThemeColorCheck.js` — 介面顏色偵測 API

掛在 `window.Liko.__Sys_ColorAPI__`，只做三件事：

```js
ColorAPI.getCanvasColor({ x, y, size }) // 讀出 canvas 上某座標實際渲染出來的顏色（取平均像素，預設抓右上角一小塊），回傳 '#rrggbb' 或 null
ColorAPI.isDark(color, threshold)       // 用 WCAG 相對亮度公式判斷該顏色是亮是暗（threshold 預設 0.5）
ColorAPI.setOverride(color, isDark)     // 演算法判斷錯誤時，手動覆寫某個顏色的亮暗結論
```

用途：BC 有淺色/深色兩套介面主題，插件想讓自己畫的按鈕、文字顏色跟著主題自動變化時，可以用這支工具讀取實際渲染色來判斷目前是哪種主題，而不必去猜測或寫死顏色規則。用法就是一般 `<script>` 載入即可，載入後直接呼叫。

### 3. `BC_toast_system.user.js` — 全域浮動提示訊息

掛在 `window.Liko.__Sys_Toast__`（同時保留全域別名 `window.ChatRoomSendLocalStyled` 供舊插件呼叫）：

```js
window.Liko.__Sys_Toast__(message, duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "24px");
// 或用相容別名
window.ChatRoomSendLocalStyled("已儲存設定", 2000, "#00ff00");
```

功能是在畫面上浮出一則會自動淡出、可堆疊排列（多則訊息會自動往上疊、消失後自動補位）的提示文字，不需要自己刻 DOM 動畫。`x`/`y` 省略時置中在畫面下方；有指定時走絕對定位、不參與自動排列。

> 這三支加上 `bcModsdk` 都遵循同一套「系統擴充命名規則」：統一掛在 `window.Liko.__Sys_<name>__`，頂部都用「已存在就 `return`」防止重複載入，多個插件重複 `<script>` 引入也不會出錯，晚載入者自動跳過。

---

## 二、`bcModSdk`（Bondage Club Mod SDK）

`bcModsdk.js` 是 [bondage-club-mod-sdk](https://github.com/Jomshir98/bondage-club-mod-sdk) 的 vendored（內嵌）版本，掛在 `window.bcModSdk`。它是插件與 BC 原生函式之間的「中介層」，讓多個插件可以**安全地同時 hook 同一個 BC 函式**而不會互相蓋掉對方的修改，主要提供：

```js
bcModSdk.registerMod(info, options)   // 註冊一個 mod，取得該 mod 專屬的 modApi
modApi.hookFunction(name, priority, hook) // 攔截函式：hook(args, next) 形式，可在呼叫原函式前後動手腳
modApi.patchFunction(name, patches)   // 用字串替換方式改寫函式原始碼片段
modApi.callOriginal(name, args)       // 直接呼叫「原始未被任何 mod 修改」的版本
modApi.unload()                       // 卸載這個 mod 的所有 hook/patch
```

`registerMod` 至少需要 `name`（唯一識別字串）、`fullName`、`version`；`hookFunction` 依 `priority` 數字決定多個插件對同一函式的執行順序（數字越大越晚被呼叫到、越接近最外層）。

**⚠️ 重要：使用 `bcModsdk` 時，Userscript 標頭的 `@grant` 必須是 `none`。**

```js
// ==UserScript==
// ...
// @grant        none
// @require      https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/bcmodsdk.js
// ==/UserScript==
```

原因：`bcModSdk` 內部用 `eval` / `new Function` 動態重組函式原始碼來實作 `hookFunction`/`patchFunction`（把原函式字串抓出來改寫後再 `eval` 回函式），並直接讀寫 `window.bcModSdk`、`window.Player` 等全域物件。只要 `@grant` 不是 `none`，Tampermonkey/Greasemonkey 就會把 script 放進「沙盒環境」執行，此時 `window` 不是頁面真正的 `window`，`eval` 出來的函式也抓不到 BC 的原生函式與變數，會直接壞掉或整段報錯。所以只要一支插件會用到 `bcModSdk`（或它 `@require` 了 `bcmodsdk.js`），該插件全篇的 `@grant` 就只能設 `none`，不能同時 grant 其他 API。

---

## 三、插件的載入與初始化守則

### 1. 先註冊 SDK，登入後才初始化業務邏輯

`registerMod` 這個動作本身不需要等玩家登入，越早做越好；反而是「登入判定」才需要延後。常見寫法（拆成兩個 Phase）：

```js
async function initialize() {
    // Phase 1：先確保 bcModSdk 就緒並註冊自己（不等登入）
    await waitFor(() => !!window.bcModSdk);
    const modApi = window.bcModSdk.registerMod({
        name: 'MyMod', fullName: 'My Mod Full Name', version: '1.0.0',
        repository: 'https://github.com/xxx/xxx',
    });

    // Phase 2：等玩家真的登入、遊戲資源就緒後，才做業務邏輯初始化
    await waitFor(() => !!window.Player?.AccountName);
    // ...這裡才開始掛按鈕、註冊指令、讀寫 ExtensionSettings 等
}
initialize().catch(e => console.error('init error', e));
```

**為什麼要拆開：** 如果把「註冊 SDK」也拖到登入之後才做，一旦頁面上有其他插件在你之前就已經 hook 了同一個函式並呼叫 `getOriginalHash`/`patchFunction` 之類的操作，你自己的 mod 卻還沒註冊，可能導致載入順序依賴、或者你自己需要用到的 hook 因為註冊太晚而錯過某次呼叫時機。及早註冊、延後執行，兩者責任分開，就不用擔心「因為登入判斷卡住，導致 SDK 註冊太晚」這種連動出錯。

### 2. 判斷「是否已登入」不能只看 `Player` 是否存在

**`Player` 這個全域物件在玩家還沒登入（甚至還在讀取登入畫面）時就已經存在**（是一個空殼物件），所以不能用 `if (window.Player)` 來判斷登入與否，一定會誤判。正確作法是看 `Player` 底下「登入後才會被賦值」的欄位，常見以下幾個都可以當依據：

- `Player.AccountName`
- `Player.CharacterID`
- `Player.Name`
- `Player.MemberNumber`

以上任何一個「未登入時是 `undefined`」都可以拿來判斷。特別提醒 **`Player.MemberNumber`**：未登入時它不是 `0`、不是空字串，而是**貨真價實的 `undefined`**，所以絕對不要寫 `if (Player.MemberNumber === '')` 或用 `!Player.MemberNumber && Player.MemberNumber !== 0` 這種容易誤判 0 號會員的寫法，直接用 `!== undefined` 或直接 `?.` 配合 truthy 判斷即可，例如：

```js
await waitFor(() => !!window.Player?.AccountName);
// 或
await waitFor(() => window.Player?.MemberNumber !== undefined);
```

倉庫裡的實際案例（`BC_Custom_Heart_Lock.user.js`）就是用 `!!window.Player?.AccountName` 當作「遊戲資源就緒」條件的一部分：

```js
const gameReady = await waitFor(() =>
    !!window.Player?.AccountName &&
    !!window.AssetFemale3DCG &&
    !!AssetGroupGet?.('Female3DCG', 'ItemMisc')
);
```

---

## 四、常用 BC 原生 API 使用方式

### 1. `PreferenceRegisterExtensionSetting` — 在偏好設定頁掛出插件設定入口

BC 的「偏好設定 → 其他設定」清單裡，每個插件可以掛一個自己的分頁按鈕，點下去進入插件自己畫的子畫面。用法（沿用 BC 畫面系統的 `load/run/click/unload/exit` 生命週期函式）：

```js
// 等待 BC 的偏好設定系統就緒後再註冊，避免太早呼叫抓不到函式
await waitFor(() => typeof PreferenceRegisterExtensionSetting === 'function');

PreferenceRegisterExtensionSetting({
    Identifier: 'MYMOD',                       // 唯一識別字串
    ButtonText: 'My Mod 設定',                   // 按鈕顯示文字
    Image: 'Icons/Settings.png',                 // 按鈕圖示（可用 BC 內建 icon 或自訂圖）
    load:   () => MyModScreen.load(),            // 進入子畫面時
    run:    () => MyModScreen.run(),             // 每幀繪製
    click:  () => MyModScreen.click(),           // 處理點擊
    unload: () => MyModScreen.unload(),           // 離開子畫面時
    exit:   () => MyModScreen.exit(),            // 按下退出鍵
});
```

**畫「返回/離開」按鈕的慣例座標：** 如果你的子畫面沒有特殊的版面需求，建議直接沿用倉庫內大多數插件一致的配置，這樣視覺上跟大部分插件的「返回」按鈕會在同一個位置、同一個大小，玩家切換不同插件設定畫面時不會感覺跳動：

```js
// run()：畫面每幀繪製時
DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", T.back);

// click()：處理點擊時
if (MouseIn(1815, 75, 90, 90)) {
    if (typeof PreferenceExit === "function") PreferenceExit();
    return;
}
```

沒有特別理由（例如版面本來就要跟別人不一樣、或是要跟自己畫面裡其他元素對齊）的話，**不需要自己重新設計返回鍵的位置跟大小**，跟著這個既有慣例走，維護成本最低。

### 2. `CommandCombine` — 註冊聊天室 `/指令`

```js
if (typeof CommandCombine === 'function') {
    CommandCombine([{
        Tag: 'mymod',                       // 觸發字：/mymod
        Description: '：這支指令的說明文字',
        Action: (args, msg, parsed) => {
            // 指令實際邏輯
        }
    }]);
}
```

建議在真正呼叫前先確認 `typeof CommandCombine === 'function'`（有些載入時機下還沒掛出來），若失敗可用 `waitFor()` 輪詢等它出現；也可用 `GetCommands()` 檢查同名指令是否已被自己（或別的分頁/重複載入）註冊過，避免重複註冊。

### 3. 新增互動姿勢／動作（Activity）— 原生做法

倉庫內 `Liko - Prank.main.user.js` 有一個叫 `AddActivity()` 的函式，**但這不是 BC 原生 API，只是這支插件自己寫的一層封裝**，其他插件並不會走這條路（除非你也決定寫一支一樣的工具函式）。真正在做的事情、也是**其他插件會直接採用的原生做法**，是下面這幾件事：

**(1) 把動作模板塞進原生陣列**

```js
const activity = {
    Name: 'MyMod_CutClothes',                 // 建議加上自己的前綴避免撞名
    MaxProgress: 50, MaxProgressSelf: 50,
    Prerequisite: [],                          // 前置條件名稱列表（見下）
    Target: ['ItemTorso', 'ItemPelvis'],       // 可對「他人」使用的身體部位群組
    TargetSelf: ['ItemTorso', 'ItemPelvis'],   // 可對「自己」使用的身體部位群組（不需要就整個省略）
};
ActivityFemale3DCG.push(activity);
// ⚠️ R130 起 ActivityFemale3DCGOrdering 用 let 宣告，見下方警告，務必用 typeof 包起來
if (typeof ActivityFemale3DCGOrdering !== 'undefined') {
    ActivityFemale3DCGOrdering.push(activity.Name);   // 只影響此動作在動作清單中的排序位置，非必要
}
```

> **⚠️ R130 大坑：`var` vs `let` 全域變數，用戶腳本只看得到 `var`。**
>
> BC 的腳本是**傳統 `<script>`（非 module）**載入的。傳統腳本的頂層宣告分兩種去處：
> - `var` / `function` → 進「全域物件環境」，也就是掛到 `window` 上 → **用戶腳本（Tampermonkey，即使 `@grant none`）看得到**，裸寫識別字或 `window.X` 都能存取。
> - `let` / `const` / `class` → 進「全域**詞法**環境」，**不**掛 `window` → **用戶腳本存取不到**，裸寫會直接 `ReferenceError`。
>
> R130 把 `ActivityFemale3DCGOrdering` 從 `var` 改成了 `let`（`ActivityFemale3DCG` 仍是 `var`）。結果是：舊插件裡一句 `ActivityFemale3DCGOrdering.push(...)` 會在 R130 拋 `ReferenceError`，若它剛好落在 `try/catch` 的註冊流程裡，**整個活動註冊會被靜默中斷、所有自訂按鈕消失，而且畫面上不一定看得到錯誤**（只在 console 有一行）。Prank v1.6.7→ 就是踩這個坑修掉的。
>
> 通則：**不要假設任何 BC 全域變數都在 `window` 上。** 會被用戶腳本 `push`/讀取的 BC 全域，存取前先 `typeof X !== 'undefined'` 探測；`ActivityFemale3DCGOrdering` 這種只影響排序、非必要的更要能省則省。想知道某個全域是 `var` 還是 `let`，在 BC 原始碼搜它的宣告即可。

> **⚠️ R130 另一個必備欄位：活動要能通過權限檢查，靠 `ActivityID` 或 hook `PreferenceGetActivityFactor`。**
>
> R130 的 `PreferenceGetActivityFactor(C, Type, Self)` 對「沒有合法 `ActivityID`（非負整數）」的活動一律回傳 `0`，而 `ActivityCheckPermissions` 把 `0` 當成「不允許」→ 活動被過濾掉、按鈕不出現。原生活動的 `ActivityID` 是寫死在 `Female3DCG.js` 裡的；自訂活動沒有。兩種解法：
> 1. **hook `PreferenceGetActivityFactor`**，對自己前綴的活動直接回非零值（Prank 的做法）：
>    ```js
>    modApi.hookFunction('PreferenceGetActivityFactor', 4, (args, next) =>
>        (typeof args[1] === 'string' && args[1].startsWith('MyMod_')) ? 2 : next(args));
>    ```
> 2. 或給活動指定一個不與原生衝突的大 `ActivityID`（超出 `ArousalSettings.Activity` 字串長度時，原生會 fallback 成「普通=2」，等於自動放行）。`@sugarch/bc-activity-manager`（Echo 用的）走的是這條，所以 Echo 的按鈕在 R130 正常。

**(2) 補上聊天訊息在地化字典（`ActivityDictionary`）**，否則畫面上只會顯示看不懂的原始 key：

```js
ActivityDictionary.push(
    ['Activity' + activity.Name, '剪開衣物'],                                    // 動作按鈕的標籤文字
    ['Label-ChatOther-ItemTorso-' + activity.Name, '剪開衣物'],                   // 對他人使用時，按鈕上顯示的標籤
    ['ChatOther-ItemTorso-' + activity.Name, '剪開了 TargetCharacter 的衣物。'],  // 對他人使用時，送出的聊天訊息
    ['Label-ChatSelf-ItemTorso-' + activity.Name, '剪開衣物'],
    ['ChatSelf-ItemTorso-' + activity.Name, '剪開了自己的衣物。'],
);
```

> **⚠️ R130 大坑：`ActivityDictionaryText()` 不再讀 `ActivityDictionary` 陣列，改讀 TextCache。**
>
> R130 的 `ActivityDictionaryText(key)` 內部是
> `TextGetInScope(ScreenFileGetPath("ActivityDictionary.csv","Character","Preference"), key)`，也就是去查一個 **`TextCache` 實例**的 `.cache` 物件；全域 `ActivityDictionary` 陣列（雖然還在、還是 `var`）**已經沒人讀**。所以只 push 進陣列 → 按鈕標籤會顯示 `MISSING TEXT IN "ActivityDictionary": Label-ChatSelf-…`（按鈕出得來、只有標籤是亂碼）。正確做法是把標籤注入那個 TextCache：
>
> ```js
> const cache = TextPrefetchFile(ScreenFileGetPath("ActivityDictionary.csv", "Character", "Preference"));
> const inject = () => { cache.cache['Label-ChatSelf-ItemTorso-' + activity.Name] = '剪開衣物'; /* …其餘 key… */ };
> // onRebuild(fn, true)：立刻注入一次，並在每次快取重建（含語言切換）後自動重注入
> cache.onRebuild(inject, true);
> ```
>
> 重點：
> - `cache.cache` 是普通物件，直接 `cache.cache[key] = 文字` 即可；`cacheLines()` 是**合併**進 `this.cache`（不清空），所以自訂 key 能跨重建存活，但仍建議掛 `onRebuild` 以防未來改動。
> - `get()` 只有在 `this.loaded === true` 後才回值，所以第一次要靠 `TextPrefetchFile` 觸發建置、或 `onRebuild` 在建置完成後補上。
> - **群組鏡射**：BC 對有陰莖的角色會把 `ItemVulva`/`ItemVulvaPiercings` 標籤鍵鏡射成 `ItemPenis`/`ItemGlans`（見 `ActivityBuildChatTag` 的 `groupMap`），這些群組的活動要**額外**注入鏡射鍵，否則該類角色身上標籤會 MISSING。
> - Echo 用的 `@sugarch/bc-activity-manager` 就是走 TextCache 注入，所以 R130 標籤正常。Prank v1.7.1 起改用此法修掉。（例如「必須手上正拿著剪刀」），要 hook `ActivityCheckPrerequisite`**：BC 原生只認得它自己內建的那些前置條件名稱字串，自訂名稱必須攔截這個函式自己判斷：

```js
modApi.hookFunction('ActivityCheckPrerequisite', 4, (args, next) => {
    const [prereqName, acting, acted, group] = args;
    if (prereqName === 'MyMod_HoldingScissors') {
        return InventoryGet(acting, 'ItemHandheld')?.Asset?.Name === 'Scissors';
    }
    return next(args);   // 不是自己的前置條件名稱，交回原生繼續判斷
});
```

並記得把這個名稱加進 `activity.Prerequisite` 陣列（`activity.Prerequisite.push('MyMod_HoldingScissors')`）。

**(4) 若需要「自訂動作邏輯」（動作真正被執行時要做什麼），要 hook `ServerSend`**，攔截 `Type: 'Activity'` 且動作名稱是自己的那一筆，自行處理、不再往下送：

```js
modApi.hookFunction('ServerSend', 4, (args, next) => {
    const [message, params] = args;
    if (message === 'ChatRoomChat' && params.Type === 'Activity') {
        const name = params.Dictionary?.find(d => d.ActivityName)?.ActivityName;
        if (name === activity.Name) {
            // 這裡執行自己的邏輯（例如真的把衣服脫掉），
            // 不呼叫 next(args)，就不會照 BC 原生流程再送一次
            return;
        }
    }
    return next(args);
});
```

**(5) 若要自訂動作按鈕的圖示**，hook `ElementButton.CreateForActivity`，在 BC 建立按鈕時塞進自己的圖片：

```js
modApi.hookFunction('ElementButton.CreateForActivity', 4, (args, next) => {
    const bundle = args[1];
    if (bundle?.Activity?.Name === activity.Name) {
        args[4] = args[4] || {};
        args[4].image = 'https://.../Scissors.png';
    }
    return next(args);
});
```

核心概念：一個「Activity」本質上就是塞進 `ActivityFemale3DCG` 的一筆資料 + `ActivityDictionary` 裡對應的顯示文字；BC 原生只認得**它自己內建**的前置條件與動作邏輯，任何「自訂」的部分（自訂前置條件、自訂執行邏輯、自訂圖示）都得靠 `hookFunction` 攔截對應的原生函式自己補上，這才是其他插件實際會採用、也不依賴任何自製包裝函式的做法。

### 4. 新增道具（Asset）— 原生做法

新增一個全新道具，核心且通用的原生做法是呼叫 `AssetAdd()`，把定義塞進對應的 Asset 群組：

```js
function createMyAsset() {
    if (!window.AssetFemale3DCG || !window.AssetGroupGet || !window.AssetAdd) return false;

    const groupDef = AssetFemale3DCG.find(g => g.Group === 'ItemMisc');    // 找到要塞進去的原始群組定義
    if (groupDef.Asset?.find(a => a.Name === 'MyItemName')) return true;    // 已存在就不重複加

    const compiledGroup = AssetGroupGet('Female3DCG', 'ItemMisc');          // 已編譯的群組（真正給引擎用的）
    const def = { Name: 'MyItemName', Value: 10, Wear: true /* ...其餘照 BC 原生 Asset 定義欄位填 */ };

    groupDef.Asset.push(def);                        // 塞進未編譯的原始群組定義
    AssetAdd(compiledGroup, def, null, groupDef);     // 讓引擎重新編譯、正式註冊這個新 Asset

    if (Player?.Inventory && !Player.Inventory.some(i => i.Asset?.Name === 'MyItemName'))
        InventoryAdd(Player, 'MyItemName', 'ItemMisc');   // 給玩家背包塞一份，才能實際使用
    return true;
}
```

要點：

- 必須等 `AssetFemale3DCG`、`AssetGroupGet`、`AssetAdd` 都存在（也就是遊戲資源已載入）才能做，通常放在「登入後」的初始化階段。
- 新道具的預覽圖若想自訂，BC 原生會去抓 `Female3DCG/<群組>/Preview/<Name>.png`，抓不到就會破圖；常見做法是額外 hook `DrawImage`，攔截這個特定路徑、換成自己遠端的圖片網址：
  ```js
  modApi.hookFunction('DrawImage', 0, (args, next) => {
      if (typeof args[0] === 'string' && args[0].includes('ItemMisc/Preview/MyItemName.png'))
          args[0] = 'https://.../my_item_preview.png';
      return next(args);
  });
  ```

**如果新道具是「鎖」，要另外說明一個現實：** 用 `AssetAdd()` 註冊一個 `IsLock: true` 的新 Asset，只能讓它「存在」（有名字、有圖、可以被穿戴、可以被當作鎖具套用到其他道具上），但**要讓它真的有一套完整、獨立的解鎖互動邏輯（密碼鎖介面、鑰匙比對、計時器等），是一個份量不小的工程**，等同於要重新實作 BC 原生某一種鎖的完整前端邏輯。因此像 `BC_Custom_Heart_Lock.user.js` 這樣的插件採取的是一個務實的折衷做法：先用 `AssetAdd()` 讓「心形鎖」以獨立名稱、獨立圖示存在，但實際的解鎖規則、把手，直接沿用（借殼）BC 原生已經寫好的某一種鎖（例如高安全鎖）——做法是在道具被穿上鎖住的當下，直接改寫該道具的 `item.Property.LockedBy`、`item.Property.LockPickSeed` 等欄位，讓引擎把它當成那把原生鎖來處理解鎖判定，只是外觀/名稱顯示成自己的道具。

**這是心形鎖插件自己的設計選擇，不是「新增鎖具」唯一或必要的做法** ——如果你確實想寫一套完全獨立、自己控制解鎖流程的新鎖種，仍然可以做，只是工作量遠大於單純呼叫 `AssetAdd()`，需要自己處理該群組的點擊/繪製/`ExtendedItem` 相關流程；上面的「借殼」手法只是在「想要新道具視覺獨立、但不想重寫一整套鎖的互動邏輯」時的一個快捷方案，實作前建議先確認自己真正需要的是哪一種。

**如果真的要寫一套完全獨立的自訂解鎖/擴充道具畫面**，BC 原生的呼叫方式是**函式命名慣例派發**：當玩家點開一個 `Asset.Extended === true` 的道具，BC 會用 `` `Inventory${Group.Name}${Asset.Name}Load/Click/Draw/Exit` `` 這樣拼出函式名稱（見 `ExtendedItemFunctionPrefix()`），再用 `CommonCallFunctionByNameWarn` 動態呼叫，所以你只需要在全域（`globalThis`/`window`）定義好這四個同名函式，BC 自然就會在對應時機呼叫到你的邏輯，不需要額外註冊：

```js
// 假設群組是 ItemMisc、道具叫 MyLockName
window.InventoryItemMiscMyLockNameLoad = function () { /* 畫面載入時 */ };
window.InventoryItemMiscMyLockNameDraw = function () {
    // 用 BC 內建的座標表畫「假選項按鈕」，跟其他道具的擴充畫面版面一致
    ExtendedItemCustomDraw('MyOption', 1185, 400, 'Icons/MyOption.png', isSelected);
};
window.InventoryItemMiscMyLockNameClick = function () {
    ExtendedItemCustomClickAndPush(CharacterGetCurrent(), DialogFocusItem, 'MyOption', () => {
        // 這裡才是選項被點下、且通過權限檢查後真正要做的事
    });
};
window.InventoryItemMiscMyLockNameExit = function () { /* 離開畫面時清理 */ };
```

`ExtendedItemCustomDraw`/`ExtendedItemCustomClickAndPush` 是 BC 內建的輔助函式，會自動處理擴充道具權限模式（`ExtendedItemPermissionMode`）、按鈕反白等細節；座標可以直接照抄 `ExtendedXY`/`ExtendedXYWithoutImages` 這幾個內建版面表（依選項數量分配好的固定座標），這樣畫出來的按鈕排版才會跟其他道具的擴充畫面一致，不用自己重新設計版面。

---

## 五、更新聊天室設定（`ChatRoomAdmin`）— 注意 `Player.ID` 陷阱

這不是通用的初始化守則，而是**這一個特定原生指令的特例**：想更新房間本身的設定（例如背景圖、音樂網址、密碼、人數上限等），走的是 `ServerSend('ChatRoomAdmin', { ..., Action: 'Update' })`。倉庫內 `Liko - CMC.main.user.js` 更新房間音樂網址的實際寫法：

```js
function updateRoomMusicURL(url) {
    if (!isFirstController() || !ChatRoomPlayerIsAdmin()) return;   // 先確認自己是房主/管理員
    try {
        muteBCMusic();
        ChatRoomData.Custom = ChatRoomData.Custom || {};
        ChatRoomData.Custom.MusicURL = url;
        ServerSend("ChatRoomAdmin", {
            MemberNumber: Player.ID,                     // ⚠️ 這裡要的是 Player.ID，不是 Player.MemberNumber
            Room: ChatRoomGetSettings(ChatRoomData),      // 用原生 ChatRoomGetSettings() 把當前房間資料包裝成伺服器要的格式
            Action: "Update"
        });
    } catch(e) { error('更新房間音樂URL失敗:', e); }
}
```

三個重點：

1. **`ChatRoomAdmin` 的 `MemberNumber` 欄位在做房間更新（`Action: "Update"`）時，實際要填的是 `Player.ID`，不是 `Player.MemberNumber`**——即使欄位名稱看起來像帳號會員編號。這只是這一個指令、這一個 `Action` 的特例，不代表所有帶 `MemberNumber` 欄位的原生指令都這樣，前面第三節提過的「`Player.ID` 恆為 `0`、`Player.MemberNumber` 才是帳號編號」的區分，在這裡剛好是「原生指令欄位期望值跟欄位名稱對不上」的一個具體案例。
2. **修改房間設定前，記得先確認自己有權限**（`ChatRoomPlayerIsAdmin()`），並且要先修改本地的 `ChatRoomData`（例如 `ChatRoomData.Custom.MusicURL = url`），再透過 `ChatRoomGetSettings(ChatRoomData)` 把整包房間資料轉成伺服器期待的格式送出——不是只送單一改動欄位。
3. 遇到任何「同名欄位、不同指令期望值不同」的情況，最保險的做法一樣是：**在倉庫或其他已知能動的插件裡找一個實際案例照抄欄位怎麼填，而不是憑欄位名稱去猜。**

---

## 六、在 InformationSheet（角色資訊卡）上繪製按鈕的注意事項

多個插件常會在別人的「資訊卡」畫面上加自己的功能按鈕（例如濾鏡設定、背景設定等）。做法通常是 hook `InformationSheetRun`：

```js
modApi.hookFunction('InformationSheetRun', 5, (args, next) => {
    const result = next(args);   // 先讓原本（以及優先度更高的其他 mod）畫完
    if (shouldShowMyButton()) drawMyButton();
    return result;
});
```

需要注意的重點：

1. **`hookFunction` 的第二參數（priority）決定多個插件對同一函式的執行/繪製順序。** 這類「在資訊卡上畫按鈕」的 hook，慣例上都是設在 **5 這個數字或再往上一點**，基本原則是「**設 5 以上，但不要超過 10**」。理由是 **BCX 是目前最主流的管理型插件**，它自己的子畫面（subscreen）掛在數字 10 的層級；只要你不超過 10，就不會蓋到 BCX 的畫面，同時 5 以上也能確保自己排在大部分其他插件的按鈕之後、正常疊上去。
2. **正常情況下，priority 設在這個區間內就足夠了，不需要額外寫子畫面偵測邏輯。** 原因很單純：你不可能、也不應該試著把市面上每一支插件都拿來 `window.xxx?.inXxxSubscreen?.()` 這樣一一檢查——插件是持續在增加的，未來新出的插件你也無從得知它會不會存在、行為是什麼，這種寫法本質上不可維護。**跟 BC 原生慣例的層級數字保持一致（5~10 之間），才是長期理想的做法**，而不是靠偵測特定插件來閃避衝突。
3. **偵測特定插件的子畫面（例如 `window.bcx?.inBcxSubscreen?.()`）只在「真的沒有更好選擇」的少數情況下才使用**，例如你發現自己跟某個已知、確定會被大量人同時使用的插件（如 BCX）在某個特定情境下無論怎麼調整 priority 都還是會衝突，且對方剛好有暴露這樣的公開查詢 API 可以用，這時才值得加這一段當作補丁：
   ```js
   const shouldSkip = window.bcx?.inBcxSubscreen?.() === true;
   ```
   但要清楚意識到：**這只對「剛好有暴露這種 API」的少數知名插件有效**，大部分插件並不會提供這類查詢介面，所以這終究是特例補丁，不是通用解法，也不需要每支插件都預先寫好一長串各家插件的判斷式。
4. 記得同時 hook 對應的 `InformationSheetExit`（離開畫面時清理狀態/計時器）與必要時的 `InformationSheetResize`（畫面縮放時重新定位自己畫的面板座標），否則容易發生「切換角色/縮放視窗後按鈕位置飄掉、或殘留在錯誤畫面」的問題。

---

## 七、BC 的人物繪製機制（背景 / 人物都是「圖層 0」，靠繪製順序決定疊放）

BC 的整個遊戲畫面本質上是畫在**一塊 2D Canvas** 上，**不是**像網頁 CSS 那樣有真正獨立的 z-index/圖層堆疊系統。不論是背景圖、角色本體、角色身上的每一件穿戴道具，全部都只是「依序被畫上去的一張張圖片」——先畫的會被後畫的蓋住，**誰在上面完全取決於程式呼叫 `DrawImage` 之類繪圖函式的先後順序**，而不是設定了哪個「圖層編號」。

延伸到插件開發上的實務意義：

- 如果你的插件要在畫面上疊加任何自訂圖案、按鈕、特效，本質上都是在**某個時間點插入一次繪製呼叫**；你選擇 hook 哪個函式、hook 的 priority 是多少，直接決定了你畫的東西會蓋住誰、或被誰蓋住。這也是前一節「InformationSheet 按鈕」那個問題的根本原因——不是「圖層設定錯了」，而是「繪製的時機被排在別人前面或後面」。
- 角色身上的道具（衣服、鎖具、飾品等）疊放順序，是由 BC 的 `AssetGroup` 定義中的排序（穿戴群組本身的先後順序、以及同一群組內道具的堆疊規則）決定畫的順序，同樣不是靠「圖層數字」去指定，而是靠 BC 內部固定的繪製順序表。
- 因此插件如果想要「確保某個東西一定畫在最上面」，唯一可靠的做法就是**把自己的繪製呼叫放在整個繪製流程的最後一步去 hook**（例如整個角色/背景都畫完之後才執行的某個函式，或是用足夠高的 priority 排在其他已知會畫東西的 hook 之後），而不是想辦法去設定一個不存在的「z-index」或「圖層編號」。

**額外的坑：BC 實際上有兩套繪圖後端（WebGL / Canvas2D），角色身上每一件道具圖層怎麼畫，走的路徑不一樣。** BC 啟動時會嘗試建立 `webgl2`/`webgl` context（見 `GLDrawLoad`），成功的話角色身上**每一件道具的每一層圖片**會透過 GL 著色器管線（`GLDrawImage`，有自己獨立的 `GLDrawImageCache`/材質快取）畫進一塊隱藏的 GL canvas，畫完才把整塊角色畫布複製貼到 `C.Canvas`；如果瀏覽器不支援 WebGL、或 GL context 反覆遺失（`GLDrawOnContextLost` 偵測到短時間內連續遺失兩次），BC 會自動切回**純 Canvas2D** 的逐層繪製路徑。兩條路徑最終都會把組好的角色畫布透過同一個 `DrawImageEx`/`DrawCharacter` 貼到 `MainCanvas` 上，但**中間「每一件道具怎麼被畫上去」這一步是分岔的**：

- 如果你的插件只是想在畫面上疊加自己的 UI 元素（按鈕、面板、圖示），一律走 `DrawImage`/`DrawImageResize`/`DrawButton` 這些畫在 `MainCanvas` 上的函式，跟 GL/2D 無關，正常 hook 就好，不受影響。
- 但如果你的插件目的是**攔截「角色身上某件道具的某一層圖片實際被畫出來」這個動作**（例如想在某道具的圖層上疊自訂材質、做即時濾鏡），只 hook `DrawImage`/`DrawImageEx` **在使用者開啟 WebGL 渲染時攔截不到**——因為道具的逐層繪製走的是 GL 路徑裡的 `GLDrawImage`，完全是另一套函式，`DrawImage`/`DrawImageEx` 那時根本沒被呼叫到。
- 而且**渲染模式在一次遊戲過程中可能中途切換**（GL context 遺失後自動降級成 Canvas2D），不能假設「這台裝置一開始是 GL 模式，全程都會是」。

實務上：如果只是要疊 UI（按鈕、面板），不用管這個問題；但如果真的要做「攔截道具圖層繪製」這種效果，需要同時處理兩條路徑（`DrawImage`/`DrawImageEx` 與 `GLDrawImage`），或改成從更上層的角度切入（例如利用 `Asset.DynamicScriptDraw` 提供的 `ScriptDraw` 動態繪製掛鉤，讓 BC 自己決定要走哪條底層路徑，你只需要在角色畫布組好前後插入邏輯）。

---

## 八、聊天室訊息（`ChatRoomChat` / `ChatRoomMessage`）的資料結構

BC 聊天室裡所有訊息，不論是玩家打字、系統事件、還是插件想偷偷傳資料，本質上走的都是同一條路：送出用 `ServerSend('ChatRoomChat', data)`，接收端則是 `ChatRoomMessage(data)` 這個函式被呼叫（可用 `modApi.hookFunction('ChatRoomMessage', priority, (args, next) => {...})` 攔截）。`data.Type` 決定這則訊息屬於哪一種，倉庫內實際出現過的類型：

| `Type` | 說明 |
|---|---|
| `Chat` | 一般聊天發言（打字送出的內容） |
| `Whisper` | 悄悄話（僅特定對象看得到，聊天室其他人看不到） |
| `Emote` | 以 `*` 或括號開頭的動作敘述（表情/roleplay 文字） |
| `Action` | BC 系統自己產生的動作訊息（例如穿脫道具、解鎖等系統事件），畫面上會用特殊樣式呈現，常搭配 `Content: 'CUSTOM_SYSTEM_ACTION'` 與 `Dictionary` 讓插件塞入客製化的顯示文字 |
| `Activity` | 執行「互動動作」（Activity，見前面第四節）時送出的訊息，`Dictionary` 內會帶 `ActivityName` |
| `Hidden` | 完全不會顯示在聊天室畫面上的訊息，純粹用來在裝了對應插件的用戶端之間傳遞資料（見下一節） |
| `LocalMessage` | 只顯示在自己畫面上、不會真的送到伺服器/其他人的本地訊息（例如系統提示、錯誤訊息） |

實務上：想要「顯示一則系統風格的自訂訊息」通常用 `Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION'` 搭配 `Dictionary` 塞文字；想要「純粹傳資料、完全不顯示」則用 `Type: 'Hidden'`。判斷收到的訊息要不要處理，一律是在 `ChatRoomMessage` hook 裡先看 `data.Type` 是不是自己在意的類型，再進一步看 `data.Content` 或 `data.Dictionary` 裡有沒有自己插件的專屬標記（Tag），沒有的話就 `return next(args)` 讓其他插件/原生邏輯繼續處理。

### 攔截訊息該用 `hookFunction` 還是 `ServerSocket.on`？

BC 原生程式碼裡，事件從 socket 進來到真正被處理，走的都是同一種掛法（`ServerInit()` 內部）：

```js
ServerSocket.on("ChatRoomMessage", function (data) { ChatRoomMessage(data); });
ServerSocket.on("AccountBeep", function (data) { ServerAccountBeep(data); });
```

**`ServerSocket.on` 是 socket.io 的原生事件監聽機制，本質是「可以同時掛很多個、彼此平行、互不取代」**——不是「誰先搶到誰處理，其他人就收不到」。這帶來兩個明確限制：

1. **無法阻止或修改原本的處理結果**：原生的監聽器在 `ServerInit()`（頁面剛載入、遠早於任何插件的登入後初始化）就已經註冊，你的插件用 `ServerSocket.on` 額外掛的監聽器一定排在它之後執行，收到的是「原生邏輯已經處理過」的資料，沒辦法在它跑之前攔截或竄改。
2. **無法跟其他插件協調執行順序**：如果多支插件都對同一事件用 `ServerSocket.on`，全部都會被呼叫，但順序只看誰先註冊，沒有任何「排在誰前面/後面」的協調機制。

`bcModSdk` 的 `modApi.hookFunction(name, priority, (args, next) => {...})` 攔截的則是**函式呼叫本身**，能在原邏輯執行前檢查/修改參數，甚至直接不呼叫 `next()` 讓原邏輯完全不執行；多個插件同時 hook 同一函式時，也能用 `priority` 明確定義彼此的包裹順序，是可協調的。

**選擇原則很單純：**

| 需求 | 選擇 | 原因 |
|---|---|---|
| 需要「攔截並可能阻止/修改」原本的處理（例如判斷是自己的 `Hidden` 內部訊息後就 `return`、不讓它繼續往下傳給其他邏輯） | `hookFunction` | 只有它能真正擋下或改寫；且熱點函式（如 `ChatRoomMessage`）常有其他知名插件（如 BCX）也在 hook，需要用 `priority` 跟大家排順序 |
| 純粹「旁聽、不需要阻止/修改任何東西」（例如 `AccountBeep` 收自訂 `BeepType`——原生對這些字串本來就什麼都不做，沒有東西需要攔） | `ServerSocket.on` | 更輕量，不需要依賴 `bcModSdk`、不需要把整支插件的 `@grant` 改成 `none` |

本文第九節下面 `AccountBeep` 用 `ServerSocket.on`、`ChatRoomMessage` 用 `hookFunction`，就是分別對應到這兩種情境，不是隨意混用。

---

## 九、插件間「隱藏資訊」傳遞手法：`Hidden` vs `Beep`（含 `Leash`），以及 Query 模式

插件與插件之間常常需要偷偷交換資料（例如狀態同步、詢問對方權限、遠端控制），常見手法主要是同房廣播（`Hidden`）與跨房私訊（`AccountBeep`）兩種管道，`AccountBeep` 底下又有一條特殊的原生 `Leash` 通道，各自適用場合與限制不同：

### 1. `ChatRoomChat` + `Type: 'Hidden'` — 同一聊天室內廣播

```js
ServerSend('ChatRoomChat', {
    Type: 'Hidden',
    Content: 'MyMod_Sync',
    Dictionary: [{ Tag: 'MyMod_Sync', Target: targetMemberNumber, payload: {...} }],
});
```

- **適用場合**：雙方（或多方）**同時待在同一間聊天室**，需要即時廣播/同步資料。
- **特性**：這則訊息會送給房間內所有人，但**畫面上完全不顯示**（`Type: 'Hidden'` 本身就是設計給「純資料、不顯示」用的），沒裝對應插件的人的用戶端會直接忽略。接收端在 `ChatRoomMessage` hook 裡判斷 `data.Type === 'Hidden' && data.Content === 'MyMod_Sync'` 才處理。
- **限制**：離開房間、對方不在同一間房，就收不到；不能用來跨房間通知。

### 2. `AccountBeep` — 跨房間／不同房間也能送達

```js
ServerSend('AccountBeep', {
    MemberNumber: targetMemberNumber,
    BeepType: 'MyModTag',     // 自訂字串，用來跟一般好友 Beep 區分
    Message: JSON.stringify({...}),
});
```

接收端不是用 `ChatRoomMessage`，而是監聽底層 socket 事件：

```js
ServerSocket.on('AccountBeep', (data) => {
    if (data.BeepType !== 'MyModTag') return;   // 不是自己的專屬類型就略過
    // ...處理 data
});
```

- **適用場合**：目標**不一定在同一間房間**、甚至不一定在線上同一個場景，只要對方帳號在線就能送達（例如戀人系統要跨房間分享房名、遠端控制類插件要通知離線房間的對方）。
- **關鍵特性**：BC 原生前端（`ServerAccountBeep`）目前只對兩種 `BeepType` 有特殊處理：`BeepType` 是空字串時（一般好友私聊 Beep）會彈出通知並記錄到 Beep 記錄；`BeepType === "Leash"` 時會觸發原生的牽繩跟隨邏輯（見下方獨立說明）。**除了這兩種之外的任何自訂 `BeepType` 字串，原生程式碼完全不會處理，也就不會跳出任何通知**——但這不代表訊息沒有送達，Socket 事件本身還是會確實觸發，只是原生邏輯選擇不理它，插件自己另外掛的 `ServerSocket.on('AccountBeep', ...)` 監聽器一樣收得到完整資料，可以自己判斷 `BeepType` 再處理。
- **⚠️ 限制（目前認知，之後可能需要修正）**：`AccountBeep` 本身的收發**很可能是需要雙方互為好友關係才能送達**（伺服器端限制，不是單純的前端行為）——**自訂 `BeepType` 能不能繞過這個好友限制，目前不確定，印象中是不行的**，也就是說就算你把 `BeepType` 換成自己專屬的字串讓畫面不跳通知，對方如果沒有加你好友，這則 Beep 本身可能一開始就送不到。這點還需要之後實測/查證再回來修正說明，先當作「預設仍然需要好友關係」來規劃你的插件邏輯比較保險。
- **限制**：只能一對一送給指定 `MemberNumber`，沒有「廣播給整個房間」的概念；且它本質上是走 `ServerSocket` 事件，不是 `ChatRoomMessage`，攔截的地方不一樣，容易忘記。

**兩者怎麼選：** 同房間內要多人同步/廣播 → 用 `Hidden`；要跨房間找特定一個人、且對方通常也是好友關係 → 用 `AccountBeep`（自訂 `BeepType` 讓對方不跳通知）。

### 3. `BeepType: "Leash"` — 原生牽繩通道（不需要好友關係、也不會跳通知，風險比想像中低）

BC 原生程式碼裡，`ServerAccountBeep` 對 `BeepType === "Leash"` 有一段獨立、跟一般 Beep 完全不同的處理邏輯，且**要真的觸發「跳轉房間」，必須同時滿足三個條件**：

```js
} else if (data.BeepType == "Leash" && ChatRoomLeashPlayer == data.MemberNumber && data.ChatRoomName) {
    if (Player.OnlineSharedSettings.AllowPlayerLeashing && (...)) {
        // 才會真的離開目前房間、跳轉去發送者所在的房間
    }
}
```

也就是 `BeepType === "Leash"` **加上**自己目前確實處於「被這個發送者牽繩」的狀態（`ChatRoomLeashPlayer == data.MemberNumber`）**加上**訊息裡有帶 `ChatRoomName` 這個欄位，三者缺一才會進到跳轉邏輯；即使前兩者都符合，只要**不在酬載裡放 `ChatRoomName`**，這個分支從最外層的判斷式就直接不成立，完全不會有跳轉房間的副作用。這條通道有兩個特性剛好符合「隱藏傳訊」的需求：

- **不受一般 Beep 的好友關係限制**——牽繩本身是建立在「牽繩者持有你的牽繩道具/擁有對應的互動權限」之上，不是好友名單，所以牽繩對象不需要是好友也能透過這個管道跨房間收到訊息。
- **完全不會跳通知**——`ServerAccountBeep` 對 `Leash` 這個分支完全沒有呼叫 `ServerShowBeep`、也不會寫進 `FriendListBeepLog`，是徹頭徹尾的靜默處理。

**因此實際風險比乍看之下低**：只要送出時確保酬載裡沒有 `ChatRoomName` 這個 key（或明確設成 `undefined`/不存在），原生的跳轉邏輯就完全不會被觸發，不需要額外 hook 攔截什麼流程。真正的前提限制反而是 `ChatRoomLeashPlayer == data.MemberNumber` 這一條——**這個通道只在「自己正被對方牽繩」的狀態下才收得到**，也就是說它並不是任兩個人之間隨時可用的隱藏通道，而是綁定在牽繩關係已經建立的前提上。

**實務上什麼時候才需要走 `Leash` 這條路：** 一般情況下，同房間內傳資料本來就有 `Hidden` 可以用；跨房間需要找的對象，大多數情況下你們本來就已經是好友關係（例如戀人、主奴、常態合作的插件使用者之間），直接用一般 `AccountBeep` + 自訂 `BeepType` 就足夠。只有在「對方確定不是好友、但彼此之間已經有牽繩關係，需要在完全不跳通知的前提下跨房間傳遞資料」這種情境下，才會考慮用 `Leash` 這條原生通道，且只要記得不夾帶 `ChatRoomName` 就不會有意外的跳轉副作用。多數插件用不到，僅在確實有牽繩相關需求時才需要用到這個機制。

### 4. 自訂「Query-Reply」問答模式（一問一答，注意跟原生 `AccountQuery` 是兩回事）

不管走 `Hidden` 還是 `AccountBeep`，很多場合需要的不是單向廣播，而是「問一句、等對方回一句」，例如「打開某人的資訊卡時，即時問對方：我能不能編輯你的設定？」。

**⚠️ 這裡的「Query」是插件自己在應用層模擬出來的問答語意，跟 BC 原生的 `AccountQuery`/`AccountQueryResult` 是完全不同的兩套機制，不要混用、也不能互相取代：**

- 原生 `ServerSend('AccountQuery', { Query: '...' })` 問的對象是**伺服器**，且伺服器端只認得幾個寫死的固定字串（目前程式碼看到的有 `OnlineFriends`、`EmailStatus`、`EmailUpdate`），回覆時觸發的 `AccountQueryResult` 也是照這幾個固定字串分派處理（`ServerAccountQueryResult` 裡是 `if/else if` 硬判斷，沒有 fallback），塞一個自訂字串進去不會有任何反應，因為根本沒有人（沒有任何 handler）認得它。
- 它問的是「跟自己帳號有關、只有伺服器答得出來」的資料（好友名單、信箱驗證狀態），**不是**「跟另一個正在線上的玩家有關、只有對方用戶端才知道」的資料（例如對方本機的權限白名單設定）——這種問題伺服器根本答不出來，只有對方的插件能答。
- 也因此，BC 原生**沒有**提供「玩家對玩家」的問答通道；下面這種靠 `Hidden` 訊息模擬問答的做法，是目前唯一能讓「同房間內另一個玩家的插件」收到問題並回覆的辦法，不是繞遠路，而是原生沒有對應功能時的必要手段。

做法是**送出時帶上 `Target`（詢問對象）與自己的請求標記，接收端看到 `Target` 是自己，就立刻原地回一封帶著 `Target: 對方MemberNumber` 的回覆訊息**：

```js
// 發問方：開啟對方資訊卡時送出詢問
ServerSend('ChatRoomChat', { Type: 'Hidden', Content: 'MyMod_PermQuery',
    Dictionary: [{ Tag: 'MyMod_PermQuery', Target: Number(otherMemberNumber) }] });

// 被問方：收到詢問，判斷 Target 是不是自己，是的話立刻回覆（只回給問的人）
modApi.hookFunction('ChatRoomMessage', 1, (args, next) => {
    const data = args[0];
    if (data?.Type === 'Hidden' && data.Content === 'MyMod_PermQuery') {
        const d = data.Dictionary?.find(x => x?.Tag === 'MyMod_PermQuery');
        if (d && Number(d.Target) === Player?.MemberNumber) {
            const sender = Number(data.Sender);
            ServerSend('ChatRoomChat', { Type: 'Hidden', Content: 'MyMod_PermReply',
                Dictionary: [{ Tag: 'MyMod_PermReply', Target: sender, canEdit: true /* ...依自己白名單判斷 */ }] });
        }
        return;   // 這種內部溝通訊息不必再往下傳
    }
    return next(args);
});

// 發問方：另外再 hook 一次 ChatRoomMessage 收自己要的回覆
// data.Content === 'MyMod_PermReply' && Number(d.Target) === Player.MemberNumber → 存進快取
```

這種「問→答」模式的重點：

- **雙方都必須裝了同一支插件**才問得到、答得到，沒裝的人收不到訊息、自然也不會回覆，所以發問方通常會做「一段時間沒收到回覆就用預設值/退回舊快取」的容錯（例如靠公告快照或本機快取當 fallback）。
- 回覆一律**只回給發問的那個人**（`Target` 設成 `data.Sender`），不要廣播給全房間，避免洩漏「誰對誰有什麼權限」這種私密設定給第三人看到。
- 適合拿來做「即時查詢型」的資料（權限、目前狀態），比起讓插件各自維護、定期廣播全量快照，這種「有人問才答」的方式流量更省、資料也更即時。

---

## 十、在雙人互動「Dialog」畫面裡插入自訂選項

點自己或點別人角色時跳出的那個雙人互動畫面（原生程式碼裡叫 `Dialog` screen，畫面邏輯在 `Dialog.js`），玩家看到的那些可點選文字選項，來源是**目前互動對象（`CurrentCharacter`）身上的 `C.Dialog` 陣列**——這個陣列平常由 BC 自己讀取對應的 CSV 對話檔（`CharacterBuildDialog`/`CharacterLoadCSVDialog`）建構，每一筆是一個 `{ Stage, NextStage, Option, Result, Function, Prerequisite, Group, Trait }` 物件，`Option` 是玩家會看到的選項文字，點下去後如果有填 `Function`，BC 會直接動態執行這段字串（`CommonDynamicFunctionParams`）。

**插件要新增自己的選項，做法不是呼叫什麼註冊 API，而是直接把同樣格式的物件塞進 `C.Dialog` 這個陣列。** 倉庫內 `Liko - Abundantia Florum Chromatica.main.user.js`（AFC，戀人系統插件）就是這樣把「求婚」「分手」等選項塞進對話選單的：

```js
const AFC_MARKER = "__AFC__";   // 自訂標記，用來識別「這幾筆是我塞的」

function makeDialog(option, result, fn, marker) {
    return {
        Stage: "RelationshipSubmenu",   // 要插入到哪個既有的對話階段/子選單底下
        NextStage: "0",
        Function: fn,                    // 點下去要執行的全域函式呼叫字串
        Option: option,                  // 顯示的選項文字
        Result: result,                  // 選下去之後角色說的話
        [AFC_MARKER]: marker,            // 自訂標記欄位（BC 不會用到，純粹自己拿來識別）
    };
}

function injectAFCDialogs(C) {
    if (!C) return;
    const dialog = C.Dialog;
    if (!Array.isArray(dialog) || dialog.length === 0) return;

    // 每次注入前，先把「上一次自己塞的」全部清掉，避免重複呼叫導致選項一直疊加
    for (let i = dialog.length - 1; i >= 0; i--)
        if (dialog[i]?.[AFC_MARKER]) dialog.splice(i, 1);

    // 找一個已知存在的「錨點」——這裡是原生選單裡「返回」選項的位置，插在它前面
    const backIndex = dialog.findIndex(d => d?.Stage === "RelationshipSubmenu" && d?.NextStage === "10");
    if (backIndex === -1) return;

    const toInsert = [];
    if (window.ChatRoomAFCCanPropose?.())
        toInsert.push(makeDialog("求婚", "……", "ChatRoomAFCPropose()", "propose"));
    // ...依條件塞入其他選項

    if (toInsert.length) dialog.splice(backIndex, 0, ...toInsert);
}

// 每次畫面重繪、或角色資訊卡重繪時都重新跑一次注入，確保選項跟目前狀態同步；
// 另外用一個保底的輪詢，避免漏掉某些沒被 hook 到的重繪時機
modApi.hookFunction("ChatRoomCharacterViewDraw", 1, (args, next) => {
    const r = next(args);
    if (CurrentCharacter) injectAFCDialogs(CurrentCharacter);
    return r;
});
modApi.hookFunction("ChatRoomMenuDraw", 1, (args, next) => {
    const r = next(args);
    if (CurrentCharacter) injectAFCDialogs(CurrentCharacter);
    return r;
});
setInterval(() => { if (CurrentCharacter) injectAFCDialogs(CurrentCharacter); }, 1000);
```

幾個重點：

1. **`C.Dialog` 會在對話 CSV 重新載入時被整組換掉**（例如切換角色、重新整理、階段改變觸發 `CharacterLoadCSVDialog` 重跑），插入進去的自訂選項會跟著消失，所以不能「插入一次就永久有效」，得像上面這樣**每次可能重繪的時機都重跑一次注入**，並且靠一個自訂標記欄位（範例中的 `__AFC__`）先清掉上次塞的舊資料再重新塞一次，避免每次重繪都疊加、選項越長越多。
2. **插入位置要挑一個「確定存在」的錨點**，通常是原生選單裡某個固定 `Stage`/`NextStage` 組合（例如某子選單的「返回」選項），用 `Array.prototype.findIndex` 找到它的位置，再 `splice` 插到它前面，而不是寫死陣列索引（索引會因為對話檔內容而變動）。
3. `Function` 欄位存的是**會被動態執行的字串**，通常寫成呼叫一個掛在 `window` 上的全域函式（如範例中的 `ChatRoomAFCPropose()`），所以要新增這種對話選項，得先把對應的處理函式掛到全域，`Function` 只負責觸發，實際邏輯寫在那個全域函式裡。
4. 這個技巧只對「雙人互動 Dialog 畫面」有效（也就是 `CurrentCharacter` 不是 `null` 時的畫面），跟本文第六節提到的 `InformationSheetRun`（資訊卡畫面）是完全不同的畫面/不同的注入點，兩者不要搞混。

---

## 附錄：起手式檢查清單

寫一支新插件時，可以照這個順序檢查，能避開多數常見的坑：

- [ ] Userscript 標頭：若用到 `bcModSdk`，`@grant` 設為 `none`
- [ ] 載入後立刻 `waitFor(() => !!window.bcModSdk)` 並 `registerMod` 註冊自己（不等登入）
- [ ] 業務邏輯初始化改用 `waitFor(() => !!window.Player?.AccountName)`（或 `MemberNumber`/`CharacterID`/`Name`）判斷登入完成，且明確意識到 `MemberNumber` 未登入時是 `undefined` 不是空值
- [ ] 需要偏好設定分頁 → 等 `PreferenceRegisterExtensionSetting` 就緒後才註冊；沒有特殊版面需求就直接沿用 `DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png", ...)` 這組返回鍵慣例座標
- [ ] 需要聊天指令 → `CommandCombine` 前檢查函式已存在，並用 `GetCommands()` 防重複註冊
- [ ] 需要新增互動動作 → 直接操作原生 `ActivityFemale3DCG`/`ActivityDictionary`，自訂前置條件/邏輯/圖示分別 hook `ActivityCheckPrerequisite`/`ServerSend`/`ElementButton.CreateForActivity`
- [ ] 需要新增道具 → 呼叫原生 `AssetAdd()`；若是鎖具且想要完整自訂解鎖邏輯，評估工作量後再決定要不要走「借殼既有鎖種」的折衷做法，或改走 `Inventory<Group><Name>Load/Click/Draw/Exit` 命名慣例自己刻完整擴充畫面
- [ ] 需要更新房間設定（`ChatRoomAdmin`, `Action: "Update"`）→ 記得這個指令的 `MemberNumber` 欄位要填 `Player.ID`，這是這個指令的特例，不是通用規則
- [ ] 需要多語 → 直接掛載共用的 `BC_i18n.js`，插件自己決定語言碼再丟給引擎
- [ ] 需要浮動提示 → 直接掛載共用的 `BC_toast_system.user.js`
- [ ] 需要在 InformationSheet 疊按鈕 → priority 設在 **5~10 之間**即可，不必自行加一堆偵測其他插件子畫面的邏輯；只有在確定跟某個知名插件衝突、且對方有暴露查詢 API 時，才把該偵測當補丁加上去
- [ ] 任何要疊加在畫面上的東西，思考的是「我這次繪製呼叫排在誰前面/後面」，而不是「我該設定哪個圖層」；若要攔截「道具圖層怎麼被畫出來」，記得 BC 有 WebGL/Canvas2D 兩條路徑，只 hook `DrawImage` 在 WebGL 模式下攔不到
- [ ] 插件間傳資料：同房間廣播/同步用 `Type: 'Hidden'`；跨房間找特定對象（通常本來就是好友）用 `AccountBeep`（記得把 `BeepType` 設成自己專屬字串，才不會在對方畫面跳出通知；**注意 `AccountBeep` 很可能仍需要雙方互為好友才能送達，自訂 `BeepType` 能否繞過此限制目前不確定**）；如果對象確定不是好友、但彼此已有牽繩關係，才考慮原生 `BeepType: "Leash"` 通道——只要酬載不夾帶 `ChatRoomName` 就不會觸發跳轉房間，風險不高；需要即時問答就用自訂的「發送 Query → 對方判斷 Target 是自己就原地回覆」模式（跟原生 `AccountQuery`/`AccountQueryResult` 是兩回事，別搞混）
- [ ] 攔截訊息時，先問自己「需不需要阻止/修改原本的處理」：需要 → 用 `hookFunction`（可 `return` 不呼叫 `next()`、可跟其他插件協調 `priority`）；只是想旁聽、不干涉原生處理（例如 `AccountBeep` 收自訂 `BeepType`）→ 直接 `ServerSocket.on` 就好，更輕量也不必依賴 `bcModSdk`
- [ ] 需要在雙人互動 Dialog 畫面加自訂選項 → 直接把物件塞進 `CurrentCharacter.Dialog` 陣列，記得用自訂標記欄位防止每次重繪重複疊加，並在每次可能重繪的時機重新注入一次
