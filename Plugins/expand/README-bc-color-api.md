# BC Color API（最小化版）使用說明

BC 的按鈕、文字、面板全部畫在同一張 `<canvas>` 上，不是各自的 DOM 元素，
所以不去猜「BC 內部傳了什麼顏色字串」，改成直接讀 canvas 上實際渲染出來
的像素顏色——不管有沒有裝主題插件、BC 以後怎麼改配色都一樣準。

## 安裝

把 `BC_ThemeColorCheck.js` 當一般 script 載入，API 會掛在 `window.Liko.__Sys_ColorAPI__` 上
（系統擴充統一掛在 `window.Liko` 底下、以 `__Sys_` 開頭），無其他相依套件。

## API（只有 4 個函式）

```js
// 1. 讀取目前 canvas 上某個位置實際的顏色（預設讀左上角 4x4 像素取平均）
Liko.__Sys_ColorAPI__.getCanvasColor();               // -> '#eeeeee'
Liko.__Sys_ColorAPI__.getCanvasColor({ x: 500, y: 300, size: 8 }); // 也可以指定座標/取樣範圍

// 2. 判斷一個顏色是亮還是暗（WCAG 明度公式 + 可調閾值）
Liko.__Sys_ColorAPI__.isDark('#eeeeee'); // -> false
Liko.__Sys_ColorAPI__.isDark('#202020'); // -> true

// 3. 覺得算法判斷錯了？手動覆寫這個顏色以後都當亮/暗處理
Liko.__Sys_ColorAPI__.setOverride('#eeeeee', true); // 以後 isDark('#eeeeee') 都回傳 true
Liko.__Sys_ColorAPI__.isDark('#eeeeee'); // -> true（採用你的覆寫）

// 4. 清除所有手動覆寫，恢復自動判斷
Liko.__Sys_ColorAPI__.clearOverrides();
```

## 典型用法

```js
const currentColor = Liko.__Sys_ColorAPI__.getCanvasColor();
if (currentColor && Liko.__Sys_ColorAPI__.isDark(currentColor)) {
  // 目前畫面偏暗，套用深色主題的素材/樣式
} else {
  // 偏亮，套用一般樣式
}
```

## 備註

- `getCanvasColor()` 讀的是「當下那一刻」canvas 實際畫出來的顏色，不是
  BC 傳給 DrawRect 的原始色碼，所以圖片、漸層背景蓋在取樣點上也會影響結果；
  如果背景不是純色，建議取樣一個你確定是背景色、沒有文字或圖片蓋住的座標。
- `isDark()` 的閾值預設 0.5，符合大多數情況；如果覺得整體判斷偏鬆或偏緊，
  呼叫時可以自己傳第二個參數調整，例如 `isDark(color, 0.4)`。
- 覆寫清單存在記憶體中，重新整理頁面就會消失；如果需要跨次瀏覽保留，
  自行把 `setOverride` 的內容存進 localStorage 之類的地方即可。
