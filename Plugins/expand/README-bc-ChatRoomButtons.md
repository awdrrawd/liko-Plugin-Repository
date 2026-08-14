# BC_ChatRoomButtons

CRB v5 是 `#chat-room-buttons` 的共用協調器，集中管理插件按鈕的建立、重建、排序、顏色、外框、提示、收合動畫、單排捲動及使用者可見性。插件端不應另外製作收合動畫。

## 插件註冊

```js
const spec = {
    id: 'my-plugin',
    order: 10,
    createButton() {
        const button = document.createElement('button');
        button.id = 'my-plugin-button';
        button.type = 'button';
        button.className = 'blank-button button HideOnPopup chat-room-button';
        button.addEventListener('click', openMyPanel);
        return button;
    },
    plain: true,
    tooltip: 'My plugin',
    background: '#455a64',
};

const L = window.Liko = window.Liko || {};
if (L.__Sys_ChatRoomButtons__?.add) L.__Sys_ChatRoomButtons__.add(spec);
else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);
```

`createButton` 每次都必須回傳新的 `<button>`。插件只負責按鈕內容與自己的點擊功能，不要自行插入容器、同步收合、設定排序或製作收合動畫。

常用欄位：

- `id`：唯一且穩定的儲存識別值。
- `order`：沒有使用者自訂順序時的預設順位，數字越大越前面。
- `createButton`：建立按鈕的工廠函式。
- `plain`：不顯示 BC 原生 `::before` 底色，適合自帶圖片或動畫圖示。
- `tooltip`、`background`、`border`：由協調器套用的提示與樣式。
- `active`：啟用狀態的樣式。
- `collapse: false`：唯一不跟隨原生收合鈕的例外；預設為 `true`。

更新狀態：

```js
const crb = window.Liko.__Sys_ChatRoomButtons__;
crb.setActive('my-plugin', true);
crb.setState('my-plugin', { tooltip: 'Enabled', background: '#2e7d32' });
crb.remove('my-plugin');
```

## 使用者設定

點擊 `chat-room-send` 會開啟設定面板，可：

- 以圖示清單拖放調整按鈕順序。
- 選擇由右至左或由左至右顯示。
- 隱藏個別按鈕。
- 還原預設值。

資料存在 `Player.ExtensionSettings.LikoChatRoomButtons`：

```js
{
    order: ['ddt', 'likotool', 'kaomoji', 'mat', 'liko-image-cache'],
    direction: 'rtl',
    hidden: []
}
```

`chat-room-send` 永遠顯示且不參與拖動；其他按鈕可以拖動按鈕列來水平捲動。協調器會監看聊天室按鈕列的重建及原生收合狀態，插件端不需要輪詢處理。
