# BC Toast 系統使用說明（BC_toast_system.user.js，v2.0）

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
- 文字走 `textContent`，不解析 HTML；支援換行與長文字自動折行，不支援富文本。
- 版本讀 `window.Liko.__Sys_Toast__._version`（目前 `"2.0"`）。

## v2 提示管理與風格

一般提示以 flex 自動堆疊，依實際高度留出間隔。指定 `x` 或 `y` 的提示獨立定位，不會被其他提示的補位影響。同時最多保留 5 則（包含自訂位置與常駐提示），超過會移除最舊的一則。

options 新增：

| 欄位 | 說明 |
|---|---|
| `id` / `dedupeKey` | 同 key 重複呼叫會更新既有提示並重設計時；兩者都有時使用 `dedupeKey`。 |
| `type` | `success`、`error`、`warning`、`info`、`loading`，提供預設顏色與文字符號；明確設定 `color` 可覆蓋顏色。 |
| `style` | `classic`（預設）、`card`（側邊色條）、`pill`（膠囊）、`glass`（毛玻璃）。 |
| `icon` | 設 `false` 可隱藏類型符號。 |
| `duration` | 毫秒；`0` 表示持續到手動關閉、更新期限或被數量限制移除。`loading` 也需明確指定 `0`。 |

每次呼叫回傳 `{ update(message, options), dismiss() }`。`update` 合併設定並重設計時；key 在建立後保持不變。已關閉的 handle 再呼叫不會重新顯示。

```js
const toast = window.Liko.__Sys_Toast__;
toast('設定已儲存', { id: 'settings-saved', type: 'success', style: 'pill' });
const progress = toast('正在處理…', {
    id: 'job', type: 'loading', style: 'card', duration: 0,
});
progress.update('處理完成', { type: 'success', duration: 2500 });
// progress.dismiss();
```

`toast.clear()` 移除所有提示；`toast.teardown()` 另清除樣式、容器與本模組全域入口。提示支援 reduced-motion，使用 live region 宣告內容，且維持不攔截滑鼠操作。
