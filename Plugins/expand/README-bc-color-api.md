# BC Color API 使用說明（v2.2）

BC 的按鈕、文字、面板全部畫在同一張 `<canvas>` 上，不是各自的 DOM 元素，所以沒辦法像
一般網頁那樣「查元素的 CSS」。這支 API 提供三條取色路線，由上而下能用哪條就用哪條：

| 路線 | 作法 | 準確度 | 相依 |
|---|---|---|---|
| **LCE 主題 API**（v2.2 新增，最優先） | 玩家有裝 Liko Club Extensions（LCE）且開啟染色時，直接讀 `window.Liko.LCE.Theme.Main`——LCE 本身就是那個在換色的引擎，這是「正在套用」的主題色 | 最準確，直接是主題色本身 | 需要 LCE 且已開啟染色 |
| **宣告值**（v2.0 新增） | hook `DrawRect` / `DrawButton` / `DrawEmptyRect`，直接讀傳進去的顏色參數 | 精確，就是原始色碼 | 需要 `bcModSdk` |
| **像素**（後備） | 從 canvas 上取樣實際渲染的結果 | 受抗鋸齒、疊圖影響 | 無 |

三條路線**由呼叫端無感自動選用**：`getThemeColor()` 會先試 LCE，沒有就退宣告值，再沒有就退像素，最後保底用「上次成功值 / DOM 背景」。呼叫端永遠只要問這支腳本要顏色，不必自己判斷「有沒有裝 LCE / 有沒有 bcModSdk」。

**為什麼要有宣告值路線：** BC 的介面顏色本來就是程式碼裡的一個字串——主題插件換色，
換的就是 `DrawRect(0, 0, 2000, 1000, "#212121")` 裡的那個 `"#212121"`。與其在螢幕上取樣
去「猜」它是什麼顏色，不如直接把那個字串讀出來。這條路線不受任何蓋在上面的東西影響。

## 安裝

把 `BC_ThemeColorCheck.js` 當一般 script 載入，API 會掛在 `window.Liko.__Sys_ColorAPI__` 上
（系統擴充統一掛在 `window.Liko` 底下、以 `__Sys_` 開頭）。

沒有相依套件。若頁面上剛好有 `bcModSdk`（大多數插件都會 `@require`），宣告值路線會**自動啟用**；
沒有的話自動退回像素路線，呼叫端不用改任何程式碼。

## API

```js
const Color = Liko.__Sys_ColorAPI__;

// 1. 取得目前介面的主題底色 —— 建議優先用這個
Color.getThemeColor();   // -> '#212121'

// 2. 讀某座標上那個元件的「宣告顏色」（沒有 bcModSdk 或該點沒元件時回 null）
Color.getUIColor({ x: 1910, y: 60 });

// 3. 讀某區域「實際渲染出來」的顏色（v2.0 起取眾數，不再取平均）
Color.getCanvasColor();
Color.getCanvasColor({ x: 500, y: 300, size: 8 });

// 4. 判斷一個顏色是亮還是暗（WCAG 明度公式 + 可調閾值）
Color.isDark('#eeeeee'); // -> false
Color.isDark('#202020'); // -> true

// 5. 覺得算法判斷錯了？手動覆寫這個顏色以後都當亮/暗處理
Color.setOverride('#eeeeee', true);
Color.clearOverrides();

// 6. 目前走的是哪條路線（除錯用）
Color.getMode();  // -> { version:'2.2', lceAvailable:false, hooked:true, armed:true, tainted:false, lastFrameRects:37, ... }
```

## 典型用法

```js
const themeColor = Liko.__Sys_ColorAPI__.getThemeColor();
if (themeColor && Liko.__Sys_ColorAPI__.isDark(themeColor)) {
  // 目前畫面偏暗，套用深色主題的素材/樣式
} else {
  // 偏亮，套用一般樣式
}
```

## v2.0 的改動

**`getThemeColor()` 是新的主要入口。** 它會找出上一幀「面積最大且蓋住畫面中心」的矩形——
主題插件就是靠畫一張滿版 `DrawRect` 來換底色的，所以那張的顏色就是主題色本身。
拿不到就依序退回 `getUIColor()` → `getCanvasColor()`。

**`getCanvasColor()` 從「平均」改成「眾數」。** 這是舊版判斷不準的主因：取樣區只要壓到一點
文字或圖示，平均就會把前景色混進背景色，算出一個畫面上根本不存在的顏色。實測一個
`#d8d8d8` 的亮色主題，取樣區只要有 30% 是深色圖示，平均會算出 `#9d9d9d`，`isDark()`
就**直接判反**成暗色；改取眾數則穩定回傳 `#d8d8d8`。眾數的邏輯是「一塊區域裡出現次數最多的
顏色就是背景色本身」，而且回傳的是真實存在的色碼。

預設取樣邊長也從 4 加大到 8，讓眾數更穩。

## v2.2 的改動：LCE 主題路線（路線 0）

新增最優先的一條路線：**如果玩家裝了 LCE（Liko Club Extensions）並開啟它的染色功能，LCE 本身就是那個在畫面上換色的引擎**，它 `window.Liko.LCE.Theme` 裡的 `Main` 色碼就是「當下實際套用」的主題色。直接讀它，比自己 hook 繪製函式或取樣像素都更直接，也不受「畫面尚未繪製、跨域汙染」等問題影響。

`getThemeColor()` 會先試這條：只有「有裝 LCE 且 `Theme.enabled === true`」時才採用；沒裝、還沒載入好、或裝了但沒開染色，就靜靜落到宣告值 / 像素路線，呼叫端完全無感。`getMode()` 多了 `lceAvailable` 欄位，可看目前是否走這條。

## 相容性

`getCanvasColor` / `isDark` / `setOverride` / `clearOverrides` 的簽名與呼叫方式**完全沒變**，
舊的呼叫端不用改。唯一的行為差異是 `getCanvasColor` 回傳的顏色從「平均色」變成「眾數色」——
這是修正，不是破壞。

## 備註

- **第一次呼叫 `getUIColor()` / `getThemeColor()` 會回退到像素路線。** 因為宣告值清單要等
  一幀 `DrawProcess` 跑完才有內容，從第二幀起才是精確值。這類 API 通常在繪製迴圈裡被反覆
  呼叫，所以實務上不影響。
- **沒人用就會自動停止記錄。** 超過 10 秒沒有任何人呼叫宣告值路線，每幀的記錄就會關掉，
  下次呼叫時再自動打開，不會白白吃效能。
- `getCanvasColor()` 讀的是「當下那一刻」canvas 實際畫出來的結果，圖片、漸層背景蓋在
  取樣點上一樣會影響它；如果背景不是純色，建議改用 `getThemeColor()`。
- `isDark()` 的閾值預設 0.5，符合大多數情況；覺得整體判斷偏鬆或偏緊可以自己傳第二個參數，
  例如 `isDark(color, 0.4)`。
- 覆寫清單存在記憶體中，重新整理頁面就會消失；需要跨次瀏覽保留的話，自行存 localStorage。
