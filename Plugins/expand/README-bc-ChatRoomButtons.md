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

常用欄位：

- `id`：唯一且穩定的儲存識別值。
- `order`：沒有使用者自訂順序時的預設順位，數字越大越前面。
- `buttonId`：可選的 DOM id。
- `icon`：SVG 字串、DOM Node，或 `{ src, alt?, animated?, poster?, crossOrigin? }`。
- `icon.animated: true`：GIF/APNG/animated WebP 懸停播放、移開顯示靜止 poster；也可用 `"auto"` 依副檔名判斷。
- `icon.poster`：可選的靜態圖片；未提供時 CRB 以 canvas 擷取影格。
- `onClick`：插件自己的點擊行為。
- `createButton`：特殊情況使用的按鈕工廠函式。
- `plain`：不顯示 BC 原生 `::before` 底色，適合自帶圖片或動畫圖示。
- `tooltip`、`background`、`border`：由協調器套用的提示與樣式。
- `active`：啟用狀態的樣式。
- `collapse: false`：唯一不跟隨原生收合鈕的例外；預設為 `true`。

動圖若跨來源且沒有 CORS，canvas 可能無法擷取；此時建議提供 `poster`。設定面板永遠使用 poster，不播放動畫；`prefers-reduced-motion` 開啟時也只顯示靜態圖。

更新狀態：

```js
const crb = window.Liko.__Sys_ChatRoomButtons__;
crb.setActive('my-plugin', true);
crb.setState('my-plugin', { tooltip: 'Enabled', background: '#2e7d32' });
crb.remove('my-plugin');
```

## 使用者設定

點擊 `chat-room-send` 會開啟設定面板，可：

- 在「顯示／隱藏」兩個純圖示區域內拖放調整順序，或拖到另一區切換顯示狀態。
- 點擊圖示可直接在顯示與隱藏之間移動；名稱保留為懸停提示。
- 選擇由右至左或由左至右顯示。
- 設定同時可見的插件按鈕數量（預設 5，不包含固定的 `chat-room-send`）。
- 隱藏個別按鈕。
- 還原預設值。

資料存在 `Player.ExtensionSettings.LikoChatRoomButtons`：

```js
{
    order: ['ddt', 'likotool', 'kaomoji', 'mat', 'liko-image-cache'],
    direction: 'rtl',
    hidden: [],
    visibleCount: 5
}
```

`chat-room-send` 永遠顯示且不參與拖動；其他按鈕可以拖動按鈕列，或在按鈕列上使用滑鼠滾輪來水平捲動。協調器會監看聊天室按鈕列的重建及原生收合狀態，插件端不需要輪詢處理。
