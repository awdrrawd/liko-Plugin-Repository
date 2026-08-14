# BC_ChatRoomButtons

CRB v5 是 `#chat-room-buttons` 的共用協調器，集中管理插件按鈕的建立、重建、排序、顏色、外框、提示、收合動畫、單排捲動及使用者可見性。插件端不應另外製作收合動畫。

## 插件註冊

```js
const spec = {
    id: 'my-plugin',
    buttonId: 'my-plugin-button',
    order: 10,
    icon: { src: ICON_URL, animated: true },
    tooltip: 'My plugin',
    background: '#455a64',
    onClick: openMyPanel,
};

const L = window.Liko = window.Liko || {};
if (L.__Sys_ChatRoomButtons__?.add) L.__Sys_ChatRoomButtons__.add(spec);
else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);
```

插件先準備好最終圖示（包括 SVG 的 fill/stroke），CRB 不會修改圖像內容。一般插件直接提供 `icon` 與 `onClick`；只有特殊 DOM 結構才需要 `createButton`，而且每次都必須回傳新的 `<button>`。

### 必要參數

| 欄位 | 說明 |
|---|---|
| `id` | 唯一且穩定的儲存識別值。缺少時 `add()` 會直接拋出 `TypeError`。 |
| `icon` 或 `createButton`（二擇一） | 至少要提供其中一項，否則 `add()` 會拋出 `TypeError`。 |

### 其他參數

| 欄位 | 說明 |
|---|---|
| `order` | 沒有使用者自訂順序時的預設順位，數字越大越前面。未提供時預設為 `0`。 |
| `buttonId` | 可選的 DOM id，未提供時預設為 `lk-crb-{id}`。 |
| `tooltip` | 提示文字，未提供時預設為 `id`。也可以傳入 `function(active, buttonEl)`，回傳動態文字。 |
| `background` | 由協調器套用的背景顏色（CSS 顏色值）。 |
| `border` | 由協調器套用的外框樣式（CSS border 值）。特殊值 `'none'` 會額外加上 `lk-crb-borderless` class，移除外框與陰影。 |
| `color` | 按鈕文字/圖示顏色（CSS 顏色值）。 |
| `boxShadow` | CSS box-shadow。**注意：寫在 spec 最外層不會生效**，只有透過 `active.boxShadow` 或 `setState({ boxShadow })` 才會套用。 |
| `active` | 啟用狀態時要覆蓋的樣式，可包含以下任意子欄位：`{ border, tooltip, background, color, boxShadow }`。 |
| `collapse` | 是否跟隨原生收合鈕；`false` 表示唯一的例外，不隨收合隱藏。預設為 `true`。 |
| `plain` | 是否不顯示 BC 原生 `::before` 底色，適合自帶圖片或動畫圖示。**若有提供 `icon` 且未指定 `plain`，會自動預設為 `true`**；若使用 `createButton` 則預設為 `false`。 |
| `className` | 額外附加的 CSS class，可用空白分隔多個，會加到按鈕元素上。 |
| `onClick` | 插件自己的點擊行為，簽名為 `function(event, buttonEl)`。 |
| `createButton` | 特殊情況使用的按鈕工廠函式，簽名為 `function(): HTMLButtonElement`，呼叫時不帶任何參數，且每次都必須回傳新的 `<button>`。 |
| `state` | 初始狀態物件，等同於註冊後立即呼叫一次 `setState()`。一般不需要手動設定，通常交給 `setState`/`setActive` 動態管理。 |

`add()` 會回傳 `spec.id`，方便後續呼叫 `setState`/`setActive`/`remove` 時使用。

### `icon` 欄位

`icon` 可以是以下四種形式之一：

- **SVG 字串**
- **DOM Node**
- **物件** `{ src, alt?, animated?, poster?, crossOrigin?, className? }`
- **函式** `function(buttonEl)`，回傳上述任一形式的內容（Node / 物件 / 字串），可在拿到按鈕元素後再動態決定要塞入的內容。

物件形式的子欄位：

| 欄位 | 說明 |
|---|---|
| `src` | 圖片來源，必要。 |
| `alt` | 替代文字，可選。 |
| `animated` | `true` 表示 GIF/APNG/animated WebP 懸停播放、移開顯示靜止 poster；也可用 `"auto"` 依副檔名自動判斷。 |
| `poster` | 可選的靜態圖片；未提供時 CRB 會用 canvas 擷取影格作為靜止畫面。 |
| `crossOrigin` | 跨來源設定，預設為 `'anonymous'`；明確設為 `false` 可停用。 |
| `className` | 附加到內部 `<img>` 元素上的額外 CSS class。 |

動圖若跨來源且沒有 CORS，canvas 可能無法擷取；此時建議提供 `poster`。設定面板永遠使用 poster，不播放動畫；`prefers-reduced-motion` 開啟時也只顯示靜態圖。

### 更新狀態

```js
const crb = window.Liko.__Sys_ChatRoomButtons__;
crb.setActive('my-plugin', true);
crb.setState('my-plugin', { tooltip: 'Enabled', background: '#2e7d32' });
crb.remove('my-plugin');
```

### 完整公開 API

`window.Liko.__Sys_ChatRoomButtons__` 除了 `add` / `setState` / `setActive` / `remove` 之外，還提供：

| 方法 / 屬性 | 說明 |
|---|---|
| `register(id, order, el)` | 底層註冊方法，直接指定順位與 DOM 元素。 |
| `get(id)` | 取得目前該 id 的 slot 順位。 |
| `reapply(id, el)` | 沿用既有的 order，重新綁定一個新的 DOM 元素。 |
| `setPlain(id, on = true)` | 動態切換該按鈕的 plain 樣式。 |
| `openSettings()` | 以程式方式開啟設定面板，效果等同點擊 `chat-room-send`。 |
| `applyLayout()` | 強制重新排版（一般不需要手動呼叫）。 |
| `Version` | 版本字串，目前為 `'1.0'`。 |
| `slots` / `plainIds` | 內部原始 Map / Set，一般插件不建議直接操作。 |

## 使用者設定

點擊 `chat-room-send` 會開啟設定面板，可：

- 在「**常駐**」「顯示」「隱藏」三個純圖示區域內拖放調整順序，或拖到另一區切換狀態。
  - **常駐**：使用者自行設定的按鈕即使原生按鈕列收合，也永遠顯示。這與插件端設定 `collapse: false`（開發者強制、不可由使用者更改）效果類似，但觸發者與優先層級不同。
- 點擊圖示可依序在常駐／顯示／隱藏之間循環切換；名稱保留為懸停提示。
- 設定同時可見的插件按鈕數量（預設 5，不包含固定的 `chat-room-send`）。
- 隱藏個別按鈕。
- 還原預設值。

資料存在 `Player.ExtensionSettings.LikoChatRoomButtons`：

```js
{
    order: ['ddt', 'likotool', 'kaomoji', 'mat', 'liko-image-cache'],
    persistent: [],
    hidden: [],
    visibleCount: 5
}
```

> 目前版本沒有可設定的顯示方向（LTR/RTL）欄位，按鈕列固定為由左至右排列。

`chat-room-send` 永遠顯示且不參與拖動；其他按鈕可以拖動按鈕列，或在按鈕列上使用滑鼠滾輪來水平捲動。協調器會監看聊天室按鈕列的重建及原生收合狀態，插件端不需要輪詢處理。
