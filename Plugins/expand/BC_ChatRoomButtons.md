# BC_ChatRoomButtons

給 Bondage Club 插件共用的基礎設施：管理聊天室那一排按鈕容器 `#chat-room-buttons` 的**排序**、**收合/展開動畫**、**單排捲動排版**與**關閉底色**。單獨載入即可運作，無外部依賴。

- 掛載點：`window.Liko.__Sys_ChatRoomButtons__`
- 版本守衛：`V = 5`，已存在且版本 ≥ 本檔就跳過（升級沿用舊 slots / plainIds，不清掉別人登記的順位）。
- `V5` 新增中央託管 API `add` / `remove`（見「五」）；`V4` 起的 `register` / `reapply` / `setPlain` 仍相容保留。
- `V5` 另支援待處理佇列 `window.Liko.__CRB_pending__`：插件在本檔載入前就先 `push([id, order, createFn, opts])`，本檔載入時自動排空——讓按鈕登記與協調器載入時機解耦（見「五」要點）。

---

## 一、排序

`#chat-room-buttons` 是 `direction: rtl` 的 CSS Grid，grid 項目遵守 CSS `order`。每個插件替自己的按鈕設定 `order = N`，瀏覽器就照數字排版，不管載入順序、無 race condition。

| order | 相對 BC 原生按鈕（原生視為 0） | rtl 下的視覺位置 |
|-------|------------------------------|------------------|
| 正數  | 排在原生按鈕之後              | 偏左             |
| 0     | 原生按鈕                     | —                |
| 負數  | 排在原生按鈕之前              | 偏右             |

**數字越大 → 越靠左。** 各插件目前的順位（`sys_CRB`）自行約定，例如 MAT = `2`、DDT = `99`。

### API — `window.Liko.__Sys_ChatRoomButtons__`

| 函式 | 說明 |
|------|------|
| `add(id, order, createFn, opts?)` | **推薦**。交出「順位＋工廠函式」由本檔中央託管：容器建立/重建、收合同步、底色全自動。`opts = { plain?, collapse? }`。見「五」 |
| `remove(id)` | 移除 `add` 的按鈕與所有登記狀態（停用／熱更新用） |
| `register(id, order, el)` | 低階：記錄某 id 的順位並套用到 `el`，回傳 order（自行 `append` 時用） |
| `get(id)` | 查某 id 已宣告的順位（沒有回 `undefined`） |
| `reapply(id, el)` | 低階：BC 重建按鈕列後，把記錄的順位重新套回新按鈕 |
| `setPlain(id, on=true)` | 關閉／開啟該按鈕的 BC 原生底色（見「四、關閉底色」） |

**自我巡邏**：每 500ms 自動把記住的順位補套回目前仍在文件內的元素。就算插件自己的重繪忘了 `reapply`，只要按鈕還在，順位就不會跑掉；已移除的元素會被清出參照。

---

## 二、收合 / 展開動畫

BC 原生收合鈕是直接對每顆子按鈕切換 `[hidden]`（瞬間消失/出現）。本檔用 `MutationObserver` **只監看** `#chat-room-buttons` 底下子元素的 `hidden` 屬性變化，改寫成：

- 收合：向右滑出 + 淡出，動畫播完才真的隱藏
- 展開：從右邊滑回原位 + 淡入

不攔截原生點擊邏輯，所以不管是原生按鈕還是其他插件改的可見度，都一視同仁套動畫，且不依賴任何其他插件是否載入。

細節：動畫 200ms／位移 18px（對齊 Kaomoji 面板風格）；尊重 `prefers-reduced-motion`（開啟時維持瞬間切換）；`chat-room-send` 排除在外；用 `WeakMap` 記「元素是否第一次被看到」，過濾插件重建按鈕後的初始同步（第一次出現只記錄狀態、不播動畫），避免切換畫面時誤觸動畫。

Observer 綁在 `document.documentElement`（穩定祖先）而非容器本身，因為容器會隨切換聊天室被 BC 整個重建。只過濾 `attributeFilter: ['hidden']`、不看 `childList`，開銷小。

> ⚠️ **消費端要點（讓自己的按鈕能被收合）**
>
> 1. **同步收合狀態**：原生收合鈕只會在**點擊當下**對「當時存在的」子按鈕切換 `[hidden]`，**不會**自動套到你之後才注入／重建的按鈕。所以要在自己的注入迴圈裡依收合鈕狀態補一次（MAT / Kaomoji / DDT 都這樣做）。**只呼叫協調器的 `register`/`reapply` 不會處理收合**——那只管順位；沒補這一步的按鈕會在每次進聊天室都固定顯示、無視收合狀態：
>    ```js
>    const c = document.getElementById("chat-room-buttons-collapse");
>    btn.hidden = c ? c.getAttribute("aria-expanded") !== "true" : false; // aria-expanded="true" ⟺ 展開
>    ```
> 2. **別用 `display:…!important`**：`[hidden]` 是靠優先權很低的 `display:none` 生效，你若在按鈕上寫 `display:flex !important` 之類會直接蓋過它，收合時按鈕就藏不起來（連本檔的收合動畫也救不回）。要置中圖示請改用 `::before` 遮罩，或把規則限定成 `你的選擇器:not([hidden])`（收合動畫期間的顯示交給本檔的 `.lk-crb-anim[hidden]` 規則接手）。

---

## 三、單排捲動排版（往左長 + 上限約 7 顆）

BC 原生 `#chat-room-buttons` 是**固定 3 欄**的 grid（`chat.css`：`grid-template-columns: repeat(3, min-content)`），所以第 4 顆按鈕就會往上換到第二排。多個插件各加一顆很容易破 3 顆而擠成兩排。

本檔載入時注入一段樣式：

- 把容器改成 **column 流向、只留一列**（`grid-auto-flow: column`），按鈕沿 rtl 方向持續往左排、不換行。
- 寬度限制在約 **`MAX_VISIBLE = 7`** 顆（`max-width: calc(var(--button-size) * 7 + gap * 8)`），超過的部分溢出並可捲動；捲軸隱藏。
- **拖曳捲動**：用滑鼠左右拖曳容器即可找超出的按鈕（用事件代理綁在 `document`，容器被 BC 重建也不必重掛）。移動超過 4px 才算拖曳，並吞掉拖曳後那次 `click` 以免誤觸按鈕；觸控/筆走原生滑動。

改 `MAX_VISIBLE` 常數即可調整可視顆數。統一放在協調器（而非各插件）是因為容器是共用的，設一次最乾淨。

> ⚠️ 取捨：`justify-self: end` + rtl 下，初始看到的是**最右邊**那幾顆（含送出鈕）；順位越靠左（order 越大）的越可能被藏在左邊，往右拖曳才看得到。

---

## 四、關閉底色（讓自訂圖示露出）

BC 原生 `.chat-room-button::before` 會鋪滿整顆按鈕並填上 `background-color: var(--button-color)`（`chat.css`），蓋在按鈕內容之上——所以你放進按鈕的 `<img>` 圖示會被這層底色蓋住看不到。

呼叫 `setPlain(id)` 讓該按鈕帶上 `lk-crb-plain` class，本檔的樣式就會把它的 `::before` 底色關掉（`background:none`），露出按鈕自己的圖示。設定會被自我巡邏記住（存在 `plainIds`），BC 重建按鈕後也會自動補回。

```js
crb.register("myplugin", "99", btn);
crb.setPlain("myplugin", true);   // 關閉底色，露出 btn 裡的 <img>
```

> 圖示大小請自己在插件端設定（例如 `img{ width:100%; height:100%; object-fit:contain; }`）；本檔只負責關掉底色，不決定圖示怎麼排。關掉底色後也沒有原生的 hover 上色，需要的話自行加。

---

## 五、如何在自己的插件加一顆按鈕（複製即用）

**推薦用中央託管 `add()`：** 你只給「順位＋一個回傳按鈕的工廠函式」，容器建立/重建、跟隨收合鈕、關閉底色都由本檔統一處理——插件端**不必**自己輪詢、掛 observer、或 append/reapply。

```js
const sys_CRB = "99";               // 順位（數字越大越靠左）
const BTN_ID  = "lk-myplugin-btn";

// 1) 載入協調器（已存在就跳過；能力偵測用 ?.add，舊版協調器會被視為未就緒而抓新版）
const BASES = window.LikoDevBase ? [window.LikoDevBase] : [
    "https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/",
    "https://awdrrawd.github.io/liko-Plugin-Repository/Plugins/",
    "https://raw.githubusercontent.com/awdrrawd/liko-Plugin-Repository/main/Plugins/",
];
let depPromise = null;
function ensureCRB() {
    if (window.Liko?.__Sys_ChatRoomButtons__?.add) return Promise.resolve();
    if (depPromise) return depPromise;
    depPromise = (async () => {
        for (const base of BASES) {
            try {
                const res = await fetch(base + "expand/BC_ChatRoomButtons.js", { cache: "no-store" });
                if (!res.ok) throw new Error("HTTP " + res.status);
                const text = await res.text();
                if (!text || text.trimStart().startsWith("<")) throw new Error("bad content");
                const s = document.createElement("script");
                s.textContent = text;
                document.head.appendChild(s);   // inline script 同步執行，回傳後 add 已可用
                return;
            } catch (e) { /* 換下一個 base */ }
        }
        throw new Error("BC_ChatRoomButtons 載入失敗");
    })();
    return depPromise;
}

// 2) 工廠函式：每次(重)建按鈕都會被呼叫、回傳一顆全新的按鈕（含 icon / click / 自帶 style）。
//    ⚠️ 每次都要 new 一顆，別回傳同一個快取的元素——容器重建後舊元素已失聯。
function createButton() {
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.className = "blank-button button HideOnPopup chat-room-button"; // 要帶 chat-room-button 才吃排版
    btn.setAttribute("role", "menuitem");
    btn.title = "我的插件";
    // 例：放自己的圖示（大小自己控）
    // const img = document.createElement("img"); img.src = "..."; img.style.cssText = "width:100%;height:100%;object-fit:contain"; btn.appendChild(img);
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); /* 你的動作 */ });
    return btn;
}

// 3) 「同步」交出按鈕規格——別綁在載入 promise 上。協調器已載入就直接 add，否則推進待處理佇列，
//    等協調器（無論被誰、何時載入）初始化時自動排空。這樣按鈕出現與協調器載入時機**完全無關**。
const L = window.Liko = window.Liko || {};
const spec = ["myplugin", sys_CRB, createButton, { plain: true }];
if (L.__Sys_ChatRoomButtons__?.add) L.__Sys_ChatRoomButtons__.add(...spec);
else (L.__CRB_pending__ = L.__CRB_pending__ || []).push(spec);

// 4) 確保協調器最終會被載入（獨立安裝時）；但規格已在上面登記好，不依賴這步的時機/成敗。
ensureCRB().catch(e => console.warn("[myplugin] BC_ChatRoomButtons 載入失敗:", e.message));
```

要點：

- **登記與載入解耦（重要）**：一定要**同步**把 spec 交出去（直接 `add` 或推進 `__CRB_pending__`），**不要**寫成 `ensureCRB().then(() => add(...))`。後者把「登記按鈕」綁死在「你自己載入協調器成功」上——若協調器是由別人（PCM）或在不同時機載入，你的 `.then` 沒在對的時間跑，spec 就從沒交出去、按鈕永遠不出現。
- `add(id, order, createFn, { plain, collapse })`：`createFn` 每次(重)建都會被呼叫；`plain:true` 露出自帶 `<img>`/SVG 圖示；`collapse:false` 則不跟隨收合鈕。停用/熱更新用 `remove(id)`。
- 用 `<img>`/SVG 當圖示 → 帶 `{ plain: true }`；圖示大小在 `createFn` 內自己設定。
- **別在按鈕上寫 `display:…!important`**（見「二」消費端要點 2）：會蓋掉 `[hidden]` 讓按鈕收不起來。改用 `::before` 遮罩或 `你的選擇器:not([hidden])`。
- **獨立安裝也要能載入本檔**：保留 `ensureCRB()`（或用 `@require` 引入本檔）。沒有協調器就沒有按鈕——但有了待處理佇列，載入早晚都不影響按鈕出現。

> 進階（低階 API）：若要完全自己掌控 DOM 生命週期，仍可用 `register(id, order, el)` / `reapply(id, el)` / `setPlain(id)` 自行 `append` 與在 BC 重建後補回（`add` 內部就是用它們＋一個共用 observer 實作的）。多數情況用 `add` 即可，不必碰這層。

要點：`id` 唯一；`className` 帶 `chat-room-button` 才能吃到容器排版；用 `register`/`reapply` 交出順位；靠 **`documentElement` 上的 `MutationObserver`** 在 BC 重建按鈕列後即時補回（childList），並在收合鈕 `aria-expanded` 變化時同步顯隱——取代舊版每 200ms 輪詢：閒置房間零開銷、收合反應即時、忙碌房間靠「按鈕還在就短路」不空轉。動畫是本檔自動處理的，插件端不用管。

> 💡 為什麼不用 `setInterval` 輪詢：容器 `#chat-room-buttons` 會隨切換聊天室/畫面被 BC 整個重建，把 observer 綁在穩定的 `documentElement` 上（同「二、四」）就不必處理重新掛勾；childList 只在「按鈕真的不見了」時才動作，比每 200ms 無條件跑 `reapply` 更省。
