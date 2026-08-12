# BC Toast 系統使用說明（BC_toast_system.user.js，v1.3）

在畫面上浮出一則會自動淡出、可堆疊排列的提示文字（toast）。不需要自己刻 DOM 動畫、不用管定位與淡出，適合拿來顯示「已儲存設定」「已複製」「錯誤」這類短暫回饋。無外部依賴。

- 掛載點：`window.Liko.__Sys_Toast__`（系統擴充統一掛在 `window.Liko` 底下、以 `__Sys_` 開頭）。
- 相容全域別名：`window.ChatRoomSendLocalStyled`（有既有插件在呼叫，保留）。
- **單一初始化**：多個插件各自 `@require` 本檔，先到者建立、其餘 `return` 跳過。

## 安裝

當一般 `<script>` 載入即可（或用 `@require`）：

```
// @require https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/expand/BC_toast_system.user.js
```

## API

```js
window.Liko.__Sys_Toast__(message, duration = 3000, color = "#ff69b4", x = null, y = null, fontSize = "24px");
// 或用相容別名
window.ChatRoomSendLocalStyled("已儲存設定", 2000, "#00ff00");
```

| 參數 | 預設 | 說明 |
|---|---|---|
| `message` | —（必填） | 要顯示的文字（純文字，走 `textContent`，不解析 HTML） |
| `duration` | `3000` | 顯示毫秒數，時間到才開始淡出 |
| `color` | `"#ff69b4"` | 文字顏色（背景固定是半透明黑 `rgba(0,0,0,0.7)`） |
| `x` | `null` | 水平位置（px，絕對定位）；`null` = 水平置中 |
| `y` | `null` | 垂直位置（px，距底部）；`null` = 置於畫面下方並參與自動堆疊 |
| `fontSize` | `"24px"` | 字級；傳數字會自動補 `px` |

### 兩種定位模式

- **省略 `x`／`y`（預設）**：訊息置中在畫面下方，並**參與自動排列**——多則同時出現會自動往上疊，某則消失後下方自動補位。大多數情況用這個就好。
- **指定 `x`／`y`**：走絕對定位，**不參與**自動堆疊排列（適合固定釘在某個角落的提示）。

### 也接受單一 options 物件

第二參數若傳物件，會被解構成設定（此時 `fontSize` 預設變 `20px`）：

```js
window.Liko.__Sys_Toast__("已複製", { duration: 1500, color: "#00ff00", fontSize: 20 });
```

## 典型用法

```js
const toast = window.Liko?.__Sys_Toast__;
toast?.("設定已儲存", 2000, "#00ff00");        // 綠色、2 秒、置中堆疊
toast?.("上傳失敗", 4000, "#ff5555");           // 紅色錯誤提示
```

> 用 `?.` 保護：本檔未載入時 `window.Liko.__Sys_Toast__` 會是 `undefined`，別直接裸呼叫。

## 備註

- toast 是 `position: fixed`、`z-index: 9999`、`pointer-events: none`（不擋點擊），畫在 `document.body` 上，跟 BC 的 `MainCanvas` 繪製流程無關，不需要 hook 任何 BC 函式。
- 文字走 `textContent`，天生防 XSS；要換行 / 富文本本檔不支援，需自訂請自己刻。
- 版本讀 `window.Liko.__Sys_Toast__._version`（目前 `"1.3"`）。
