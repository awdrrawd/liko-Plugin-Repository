# BC 插件開發指南：從現有實作做出功能

> 適用對象：開發本工作區 BC 插件的人與 AI。
> 原則：先做出可驗收的效果，再把必要的原生流程、相容性與限制補齊。
> 核對日期：2026-09-14；續寫與容量限制補正：2026-09-15。遊戲基準：本地 `BCJS/Bondage-College-master/BondageClub`，`GameVersion = "R131"`；SDK 基準：`Plugins/expand/bcmodsdk.js`，版本 1.2.0。
> 本文件已對照原始碼；範例尚未在遊戲內執行驗證。實作案例代表現有程式的做法，不代表所有版本、姿勢或插件組合都已測通。

## 1. 怎麼使用這份指南

先把需求寫成一句可驗收的描述，例如：「直式畫面點一下按鈕，原生對話框只執行一次操作」，或「好友列表顯示完整頭像，載入失敗時保留替代圖」。再依下面的索引找實作。

| 想做出的成果 | 優先參考 | 先確認的事情 |
| --- | --- | --- |
| 第一個按鈕與設定 | 第 3 節的最小插件 | 載入時機、Draw／Click 成對處理 |
| 直式 UI、原生按鈕映射 | LCE，第 5 節 | 原畫面區域、顯示區域、輸入事件路徑 |
| 頭像、角色快照 | FCM，第 6 節 | 資料來源、材質就緒、裁切、快取 |
| 道具圖層變形或拾取 | AEE，第 7 節 | 哪個角色、哪個圖層、哪個渲染後端 |
| 貼著角色的特效 | HSC，第 7 節 | 姿勢／身高／縮放、Canvas 到 DOM 座標 |
| 個人設定、公開狀態 | 第 8 節 | 誰需要讀取、保存在哪裡、何時同步 |
| 180K 限制、大資料保存與遷移 | 第 8.5～8.7 節 | 完整 payload 位元組數、預算、超限後的處理 |
| 原生道具／互動功能 | 第 9 節 | 權限、驗證、外觀與聊天室同步 |
| 更新後功能失效 | 第 10、11 節 | 原生入口是否改動、hook 是否執行、資料是否被覆寫 |

每個完成的功能至少留下：入口函式、參考來源、操作步驟、預期結果，以及實際驗證結果。只有建置通過，還不能證明遊戲內功能完成。

## 2. 原始碼與實作來源

以下相對連結以本文件所在的 `liko-Plugin-Repository/docs` 為起點；跨專案連結依賴工作區維持目前的並列目錄結構。上傳到單一 Git 倉庫後，跨倉庫連結不一定能開啟。

| 來源 | 用途與閱讀入口 |
| --- | --- |
| [BC 遊戲本體](../../BCJS/Bondage-College-master/BondageClub) | 原生函式簽名、狀態、副作用的基準 |
| [指定 SDK](../Plugins/expand/bcmodsdk.js) | `registerMod`、hook chain、patch、卸載；這是 SDK，不是完整插件載入器 |
| [SDK 型別](../../BCJS/Bondage-College-master/BondageClub/Scripts/lib/bcmodsdk.d.ts) | 查 API 合約；與指定 SDK 有差異時以實際載入版本為準 |
| [LCE 直式入口](../../BC-LCE/src/features/vertical/index.js) | 畫面判定、resize、安裝與移除 |
| [LCE 聊天室／Dialog 映射](../../BC-LCE/src/features/vertical/chatroom.js) | Canvas 區域複製、座標反算、事件注入、DOM 搬移 |
| [FCM 頭像與資料庫](../../BC-FCM/src/data/profile-db.js) | 擷取、等待穩定、IndexedDB、角色重建及清理 |
| [FCM 原生事件 hooks](../../BC-FCM/src/core/hooks.js) | 角色進房／更新後接續處理、UI 插入 |
| [AEE 繪圖 hooks](../../BC-AEE/src/hooks/drawingHooks.ts) | `CharacterLoadCanvas`、`GLDrawImage`、圖層擷取 |
| [AEE 渲染 hooks](../../BC-AEE/src/hooks/renderHooks.ts) | 變形作用域、Canvas／WebGL 處理 |
| [AEE 圖層拾取](../../BC-AEE/src/controllers/appearancePickerController.ts) | 從實際繪圖參數回推點擊圖層 |
| [HSC 座標](../../BC-HSC/src/util/geometry.js) | 角色錨點、身高／姿勢轉換、DOM 定位 |
| [HSC hooks](../../BC-HSC/src/core/hooks.js) | 繪製位置與遊戲事件整合 |
| [HSC 特效生命週期](../../BC-HSC/src/effects/lifecycle.js) | 取消工作、避免舊非同步回呼復活 |

搜尋優先讀 `src` 與原生呼叫端。`dist`、壓縮 userscript、`Plugins/Temp` 用來確認實際發布內容；不要把不同版本的片段混成一個假想 API。複用程式前也要確認來源授權與署名要求。

## 3. 第一個可運行插件

### 3.1 登入與載入是不同階段

這份 R131 提供公開函式 `ServerIsLoggedIn()` 與 `ServerIsLoggedInAsync()`，見 [Server.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Server.js)。後者先等遊戲載入，再等登入成功。

[Game.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Game.js) 將 `GameReadyState.login` 標為 private，註解要求使用 `ServerIsLoggedInAsync`。不要直接依賴這個內部 Promise，也不要把頂層 `const` 一律當作 `window` 屬性。

初始化順序：

1. 等必要函式與 SDK 存在。
2. 註冊 mod；若有必須攔到的早期事件，此時安裝不依賴玩家資料的 hook。
3. 等登入成功。
4. 初始化設定與功能；額外圖片、外部資料或特定資源另外等待。

`Player` 存在不等於已登入。對這份版本優先用公開登入 API；相容舊版本時，才另外實作 `LoginResponse` hook，先 `next(args)` 再檢查成功狀態。失敗回應不能消耗掉一次性初始化。

### 3.2 完整起手式：主廳按鈕與持久設定

**執行前提：** BC 頁面已載入指定 SDK，以下程式在頁面 JS 環境執行。使用 userscript 時，設定符合目標站台的 `@match`；`@grant none` 是常見做法，仍需確認腳本管理器的實際注入環境。SDK 自身不會替你下載或啟動插件。

這個範例只示範主廳按鈕切換設定，不包含特效。按鈕位置只是示範，正式整合須確認與其他 UI 不重疊。

```js
(async () => {
    const NAME = "ExampleBCGuide";
    const SLOT = "__exampleBCGuide";
    if (globalThis[SLOT]) return;
    const state = { disposed: false, mod: null };
    globalThis[SLOT] = state;

    state.dispose = () => {
        state.disposed = true;
        state.mod?.unload();
        if (globalThis[SLOT] === state) delete globalThis[SLOT];
    };

    async function waitForAPIs(timeout = 15000) {
        const started = Date.now();
        while (!state.disposed) {
            if (globalThis.bcModSdk?.registerMod
                && typeof ServerIsLoggedInAsync === "function"
                && typeof MainHallRun === "function"
                && typeof MainHallClick === "function"
                && typeof ServerPlayerExtensionSettingsSync === "function") return;
            if (Date.now() - started > timeout) throw new Error("必要 API 尚未就緒");
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error("初始化已取消");
    }

    try {
        await waitForAPIs();
        if (state.disposed) return;
        const mod = state.mod = bcModSdk.registerMod({
            name: NAME, fullName: "BC Guide Example", version: "1.0.0",
        });
        await ServerIsLoggedInAsync();
        if (state.disposed) return;

        Player.ExtensionSettings ??= {};
        let enabled = false;
        try {
            const saved = JSON.parse(Player.ExtensionSettings[NAME] ?? "null");
            enabled = saved?.enabled === true;
        } catch (error) {
            console.warn(`[${NAME}] 設定解析失敗，使用預設值`, error);
        }
        const button = { x: 1600, y: 800, w: 300, h: 65 };

        mod.hookFunction("MainHallRun", 0, (args, next) => {
            const result = next(args);
            DrawButton(button.x, button.y, button.w, button.h,
                `Example: ${enabled ? "ON" : "OFF"}`, "White");
            return result;
        });
        mod.hookFunction("MainHallClick", 0, (args, next) => {
            if (!MouseIn(button.x, button.y, button.w, button.h)) return next(args);
            enabled = !enabled;
            Player.ExtensionSettings[NAME] = JSON.stringify({ version: 1, enabled });
            ServerPlayerExtensionSettingsSync(NAME);
            // 此點擊已由本按鈕消耗，避免繼續觸發下方的原生按鈕。
            return;
        });
        console.info(`[${NAME}] ready`);
    } catch (error) {
        state.dispose();
        console.error(`[${NAME}] 初始化失敗`, error);
    }
})();
```

驗收：登入前注入與登入後注入都能出現按鈕；按一次只切換一次；重複注入不重複註冊；重新載入後設定保留；執行 `globalThis.__exampleBCGuide.dispose()` 後按鈕消失。若儲存失敗，要檢查送出與下次登入讀回的結果，不能只看按鈕文字。

## 4. SDK：精確改動原生流程

### 4.1 hook 的執行順序

```js
const removeHook = mod.hookFunction("SomeFunction", 5, (args, next) => {
    // 原生流程前：讀取或調整參數
    const result = next(args);
    // 原生流程後：補畫、讀取結果
    return result;
});
// 停用該功能時：removeHook();
```

指定 SDK 以 priority 由大到小排序。若 A=10、B=5，兩者都正常呼叫 `next`：

```text
A 前置 → B 前置 → 原生函式 → B 後置 → A 後置
```

因此「先進入 hook」與「最後疊畫」不是同一件事。沒有通用的 priority 區間可以保證不與其他插件衝突；還要看對方是否呼叫 `next`、是否切換子畫面，以及你的 Draw 與 Click 是否使用同一個啟用條件。

- 一般延伸只呼叫一次 `next(args)`，保留參數與回傳值。
- 吞掉 `next` 代表接管該次呼叫，會同時略過後續 hooks 與原生流程。
- `callOriginal` 在指定 SDK 中呼叫保存的原始函式，繞過 SDK 的 hook 與 patch；不能當作 `next` 的替代品。
- 不要任意把同步 hook 改成 `async`，否則原呼叫端收到的值會變成 Promise。
- 原函式本來是非同步時，必須等它完成才能讀取完成後狀態。例如 R131 的 `ChatRoomSync` 是 `async`；「呼叫 next 後馬上讀資料」不保證同步已結束。

### 4.2 patch、診斷與卸載

`patchFunction` 依函式文字替換。指定 SDK 在字串沒命中時發出警告，不保證自動阻止插件繼續跑。因此 patch 要記錄原文錨點、支援版本、命中檢查及失效時的處理。

可用 `getOriginalHash`、`bcModSdk.getPatchingInfo()` 與 `getModsInfo()` 輔助診斷。雜湊只代表函式文字是否相同，不代表行為相容性已驗證。

`mod.unload()` 移除該 mod 的 SDK hook／patch。它不會幫你清理 DOM、事件監聽、timer、RAF、Object URL、自己覆寫的 prototype 或自訂全域狀態。這些資源必須由插件自己的 dispose 處理。

避免直接替換已被其他插件包裝的全域函式。若必須包裝 prototype，恢復時要確認目前仍是自己的 wrapper，避免覆蓋後來安裝的其他插件。

## 5. 實作案例：LCE 直式 UI 與按鈕映射

### 5.1 做出的效果

LCE 的 [chatroom.js](../../BC-LCE/src/features/vertical/chatroom.js) 將原生 Dialog 所在的 Canvas 右半部複製到直式畫面的另一區，再把點擊反算回原生位置，交回遊戲處理。它不是替每個原生按鈕重寫業務邏輯。

必須分清三個座標空間：

| 空間 | 本案例的單位 |
| --- | --- |
| BC UI | 2000 × 1000 邏輯座標 |
| 原始區域 | Dialog 右半部：x=1000、y=0、w=1000、h=1000 |
| 目標區域 | 直式版面中的 CSS 像素矩形，位置與尺寸隨視窗改變 |

以下是可重用的純座標函式，不包含事件注入：

```js
function mapToSource(clientX, clientY, dest, source) {
    if (dest.width <= 0 || dest.height <= 0) return null;
    const u = (clientX - dest.left) / dest.width;
    const v = (clientY - dest.top) / dest.height;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    return { x: source.x + u * source.width, y: source.y + v * source.height };
}
```

前提是目標矩形正好對應來源區域；若有留白、裁切或 `object-fit`，先算出真正的內容矩形。不要把容器外框直接當內容範圍。

### 5.2 事件不能只改 MouseX／MouseY

LCE 的 `drInjectClick` 除了設定 BC 滑鼠座標，也把映射結果換算成原 Canvas 的 `clientX/clientY`，派送 Pointer／Mouse 事件。它暫時處理合成 pointer 的 capture 問題，並在 `finally` 恢復方法，之後清除殘留滑鼠座標。

這是特定輸入管線的整合方案。移植時要追 [Mouse.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Mouse.js) 的事件處理與實際入口，不能假設同時派送多組事件一定安全：最重要的驗收是「一次觸控只觸發一次原生操作」。合成事件也不等同於可信的使用者手勢，不能假設能解鎖所有瀏覽器功能。

### 5.3 DOM 與生命週期

Canvas 複製不會複製 Dialog 的 DOM 輸入框、選色器或第三方 React 面板。LCE 另外處理 DOM 位置，並記錄上次套用的位置，避免每幀累加偏移。

需要一起處理：切換畫面、旋轉、resize、輸入框聚焦、虛擬鍵盤、關閉功能後還原樣式，以及取消鏡像 RAF。`CommonIsMobile` 是輸入裝置(手機)判斷，不能代替直式／可用空間判斷。

驗收：按鈕中央與邊緣、區域外點擊、觸控與滑鼠、旋轉、鍵盤開合、離開再返回，以及 AEE 選色器等 DOM 元件的對齊。若只改顯示沒改輸入，這個功能尚未完成。

## 6. 實作案例：FCM 頭像與角色快照

### 6.1 完整處理鏈

[profile-db.js](../../BC-FCM/src/data/profile-db.js) 提供兩條來源：已有角色 Canvas 的快照，以及保存的角色 bundle 重建。基本流程是：

```text
取得角色資料 → 取得／重建角色 → 等待貼圖與 Canvas 更新
→ 裁切頭像 → 快取／保存 → 更新列表 → 清理暫存資源
```

有 `C.Canvas` 或 Canvas 寬度非零，不代表貼圖已載完。FCM 的 `captureFace` 會暖機、觀察 `C.MustDraw`、重建 Canvas、比較多次結果，並設定逾時。這是避免半張頭像的實務啟發式，不是原生的「所有材質載入完成」保證；動畫角色也可能一直不穩定。

### 6.2 裁切參數是案例設定

FCM 的 `_face` 從 `C.Canvas` 以 `cropSize = 210`、來源 y=740 裁切，輸出 WebP。這是該實作對角色 Canvas 的選擇，不是通用的「頭部 y 座標」。

複用時要確認來源 Canvas 的 padding、姿勢、身高與其他插件的影響，至少測站立、跪姿、趴姿及不同身高。輸出為空、透明或頭部被切掉時，應保留替代圖並記錄失敗，不把空圖當成功快取。

### 6.3 重建角色的副作用

`loadAvatarFromBundle` 使用 `CharacterLoadOnline`、`CharacterRefresh(C, false, undefined)`，等待擷取後再清理。原生 `CharacterLoadOnline` 涉及全域角色集合，不是純 JSON 解碼函式。

新的實作應明確追蹤角色所有權：只清理本次確定建立且不再被使用的臨時角色。呼叫 `CharacterDelete(C, false)` 前檢查是否仍被玩家、聊天室、Dialog、Appearance 或其他功能持有；不要只因「不在房間」就刪掉共用角色。

`CharacterRefresh` 的第二參數設為 false 可避免玩家外觀推送，但仍有其他刷新副作用，見第 10 節。不能把它理解成純渲染 API。

### 6.4 快取與驗收

FCM 使用 IndexedDB 保存頭像，並有記憶體快取、更新事件及舊資料轉換。新功能至少要定義：快取鍵、何時失效、請求去重、容量清理、失敗重試上限，以及停用後如何處理未完成工作。使用 Blob URL 時，移除或替換圖片後要適時 `URL.revokeObjectURL`。

驗收：首次遇見、已有快取、重建離線角色、慢速貼圖、逾時、更新外觀、資料庫失敗，以及反覆操作後角色集合／記憶體是否持續增長。不能用假頭像通過 UI 測試後，就宣稱角色擷取已驗證。

## 7. 實作案例：AEE／HSC 繪圖

### 7.1 先選正確入口

| 效果 | 起查位置 | 注意事項 |
| --- | --- | --- |
| 畫面上的按鈕、文字 | 所屬畫面的 Run／Click、Drawing.js | 顯示與點擊條件一致 |
| 整個角色旁的標記 | `DrawCharacter` 或該場景 overlay | 檢查實際角色位置與疊畫順序 |
| 貼著嘴、眼睛的 DOM 特效 | DrawCharacter 位置＋角色座標轉換 | 姿勢、身高、縮放與 DOM 位置都要算 |
| 道具顯示、排序、遮罩 | `CharacterLoadCanvas`、角色 hooks、CommonDraw | 先理解渲染用資料與實際 Appearance 的區別 |
| 單層翻轉、斜切、拾取 | AEE 的 GLDrawImage／renderHooks／picker | 包含變換作用域與後端差異 |
| 道具自己的動態繪製 | Asset 的 DynamicScriptDraw 與對應實作 | 依具體資產查看呼叫契約 |

不是所有圖片都經過 `DrawImage`。原生 [Character.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Character.js)、[CommonDraw.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/CommonDraw.js)、[GLDraw.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/GLDraw.js) 與 [Drawing.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Drawing.js) 分別承擔角色資料整理、圖層組合、渲染與畫面繪製。

### 7.2 AEE：深入圖層時如何限制作用範圍

AEE 在 `CharacterLoadCanvas` 附近追蹤角色與拾取資料，在 `GLDrawImage` 擷取圖片及位置參數。`renderGlImage` 複製 DrawOptions 後調整翻轉，並以 `try/finally` 管理活動中的變形狀態。

它也確實包裝 `WebGL2RenderingContext.prototype.uniformMatrix4fv` 等方法，處理斜切／鏡像。這說明底層操作有實際用途；移植時必須保留完整的角色／圖層作用域、狀態恢復、停用路徑與相容性檢查，不能只複製矩陣片段。

尤其要確認：一般圖與眨眼圖的連續呼叫、錯誤中斷、巢狀繪製、另一個 WebGL context、其他插件再次包裝同一個方法，以及 Canvas2D fallback。某後端不支援時可以明確停用該效果，不要宣稱兩條路徑等價。

圖層拾取應使用實際繪製取得的轉換參數，讓命中判定與顯示一致。變形後仍用變形前矩形判定，會出現「看得到但點不到」。

### 7.3 HSC：從角色位置到 DOM 位置

[geometry.js](../../BC-HSC/src/util/geometry.js) 的基本方式是使用實際繪製的 x／y／zoom，加上身高比例與原生 `CharacterAppearanceXOffset`、`CharacterAppearanceYOffset`，再把 BC 座標換成 CSS 像素。

```js
function bcToClient(x, y, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: rect.left + x * rect.width / 2000,
        y: rect.top + y * rect.height / 1000,
    };
}
```

這個函式假設 Canvas 顯示整個 2000×1000 UI、沒有旋轉／額外裁切，回傳 viewport 座標，適合 `position: fixed`。若元素相對其他容器定位，要再扣除容器位置；若 LCE 正在鏡像區域，要套用該區域映射。

HSC 優先取 `DrawCharacter` 記錄的實際錨點，再回退到 overlay 的位置。這可處理部分其他插件造成的角色位移，但不是對所有變換的保證。嘴部／眼睛位置中的校正值也屬於效果設定，需要視覺驗收。

resize、捲動或版面改變後應更新快取矩形。離房、換頁、目標消失或停用時，除了取消動畫，也要使舊的非同步工作失效；可參考 HSC 的 generation／checkpoint 與 [run.js](../../BC-HSC/src/effects/run.js)。

驗收：不同姿勢與身高、不同 zoom、角色移動／重排／分頁、視窗縮放、直式模式、停用時仍有排程中的效果，以及同時啟用其他角色繪圖插件。

## 8. 設定、同步與多人資料

> **AccountUpdate 提交原則：180K 限制套用在每次傳輸。每次只提交此次操作必要的變更欄位，不以整份插件 key 作為預設更新單位。** 例如只改 RULE，就提交 `ExtensionSettings.MyPlugin.RULE`；若只改 RULE 中一個可獨立更新的欄位，則再縮小到該欄位。未變更的 TEST 或其他設定不隨包重送。每個實際送出的 AccountUpdate（包括 QueueData 合併結果）都要符合大小限制。

「重點請求」在本指南指這種最小必要更新，不是把大型父物件換個 key 名稱後照樣整包提交。巢狀更新前先確認儲存結構與該欄位的更新契約；JSON 字串與必須整體替換的值不能直接假裝是可拆的物件。

### 8.1 先決定誰需要看見

| 資料 | 優先儲存方式 | 實作要求 |
| --- | --- | --- |
| 個人設定、希望隨帳號保存 | `Player.ExtensionSettings.<插件鍵>` | 版本化、驗證、只同步自己實際變更的欄位 |
| 圖片快取、大量本機資料 | IndexedDB | 容量、失效、清除；不假設跨裝置存在 |
| 當前頁面的暫態狀態 | 記憶體 | 離房／停用／重新載入時清理 |
| 要讓其他客戶端讀取的角色宣告 | `OnlineSharedSettings` 或明確的插件通訊 | 命名空間、資料最小化、接收端驗證 |
| 即時事件 | 原生聊天／插件訊息流程 | 版本、來源、目標、去重、節流 |

### 8.2 ExtensionSettings：依實際變更欄位局部更新

**180K 是單次傳輸限制，不是整個 ExtensionSettings 或單一插件累積儲存量的上限。** 依維護者確認，假設 `ExtensionSettings.BCX` 合計 300K，分成符合限制的 180K 與 120K 兩次傳輸，不會因累積超過 180K 而被此限制阻擋。這裡的大小指完整單次傳輸；實作仍需計入封裝開銷。

所以「只送自己的插件鍵」還不夠精確：當只改 RULE 時，送 `ExtensionSettings.BCX.RULE`，不要重送整包 `ExtensionSettings.BCX`。TEST 有改再送 `ExtensionSettings.BCX.TEST`。BCX 在這裡是維護者提供的路徑示例，不代表本指南已核對該版本 BCX 的實際儲存 schema；自己的插件不能寫入 BCX 的資料。

**既有小型字串設定範例：** 第 3、9.1 節為展示初始化／UI，把小型設定存成單一 JSON 字串，以下 helper 會整個替換該字串。這是原子值保存示例，不能當成大型設定的更新架構；正式設計可局部更新的設定時，應採下方的必要欄位提交方式。

```js
Player.ExtensionSettings ??= {};
Player.ExtensionSettings.MyPlugin = JSON.stringify({ version: 1, enabled: true });
ServerPlayerExtensionSettingsSync("MyPlugin");
```

指定版本的 `ServerPlayerExtensionSettingsSync` 會檢查該鍵不是 undefined，建立 `ExtensionSettings.MyPlugin` 欄位，再呼叫 `ServerSend("AccountUpdate", obj)`。不要把整包其他插件設定重新送回去。

**大型物件型設定：** 若伺服器中自己的插件資料是可局部更新的物件，依變更葉節點送 dot-notation 欄位。以下是整合片段；`nextRule` 是呼叫端已驗證的 JSON 值，大小檢查沿用 8.5 的保守預算：

```js
function saveMyPluginRule(nextRule) {
    // 固定屬於本插件的路徑；不接受外部輸入任意指定更新路徑。
    const serialized = JSON.stringify(nextRule);
    if (serialized === undefined) throw new TypeError("RULE 不能是 undefined");
    const value = JSON.parse(serialized);
    const payload = { "ExtensionSettings.MyPlugin.RULE": value };
    const bytes = new TextEncoder().encode(JSON.stringify(["AccountUpdate", payload])).byteLength;
    if (bytes > 150_000) throw new RangeError("RULE 單次提交超過插件預算");

    Player.ExtensionSettings ??= {};
    const settings = Player.ExtensionSettings.MyPlugin;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new TypeError("需要先建立／遷移物件型 MyPlugin 設定");
    }
    settings.RULE = value;
    ServerSend("AccountUpdate", payload);
    // 沒有重送 TEST，也沒有重送整包 MyPlugin。
}
```

不能直接呼叫 `ServerPlayerExtensionSettingsSync("MyPlugin.RULE")` 期待 helper 自動走訪物件：它讀的是 `Player.ExtensionSettings[dataKeyName]`，沒有拆解巢狀路徑。局部更新使用明確的 AccountUpdate payload，並同步維護本地對應欄位。

也不能對已序列化的 JSON 字串做物件路徑更新。若 `ExtensionSettings.MyPlugin` 現在是字串，`.RULE` 並不是其可更新子欄位；要先規劃遷移為物件型結構或獨立可更新欄位。只有單一不可再拆的值本身仍超過傳輸預算時，才進一步考慮壓縮、應用層分塊或本機儲存。

讀取 JSON 要處理舊版格式與損壞資料。高頻滑桿／拖曳在提交或 debounce 後保存，不要每幀送出。**官方限制單次傳輸大小為 180K，用於防止一次性大資料造成服務負擔與 DDoS 風險；插件必須將它當成硬性設計約束。** 先只傳必要的變更欄位，再檢查每次 payload 大小；整個插件資料超過 180K 本身不是要求刪減資料或改存本機的理由。

來源說明（2026-09-15 補正）：官方限制與用途由本工作區維護者確認。本次另核對到本地 BCX 的 `PROBLEMATIC_MESSAGE_SIZE = 180_000`、LSCG 的 `MAX_BYTES = 180000`；它們是插件端佐證，不冒充官方伺服器原始碼。舊文因客戶端沒有此常數而省略限制，已更正。實作方法及量測範圍見 8.5。

### 8.3 OnlineSharedSettings：本地 R131 會保留額外欄位

這點修正舊版指南：本地 [Preference.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Preference.js) 與 Server 的角色驗證，使用 `ValidationApplyRecord(..., true)`；[Validation.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Validation.js) 的 `allowExtraKeys` 會保留額外欄位。因此不能說「自訂欄位一律會被丟棄」。

客戶端行為不等於伺服器對任意內容／大小的保證。使用自訂公開狀態時，以插件名稱分組並帶版本，只傳需要公開的資料；不能把它當成秘密儲存區。接收端須驗證型別、長度、允許值，不能把其他玩家送來的欄位直接當作操作授權。

修改既有公開選項時，保留其他欄位：

```js
Player.OnlineSharedSettings.AllowFullWardrobeAccess = true;
ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
```

這是帳號資料排程更新。若要求同房者立即看見，還要核對原生對應操作的角色廣播流程，並以第二個客戶端驗證。

`QueueData` 按提交的欄位名稱存入 Map，同鍵後值取代前值，不做深層合併。它使用 2 秒 timer，並以 8 秒條件限制持續重新排程；不要把這簡化為嚴格的「8 秒內必定送達」。

### 8.4 多人功能的完成條件

追蹤完整路徑：本地狀態 → 原生送出函式 → 伺服器回應／廣播 → 對方接收 → 對方顯示。`ServerSend` 被呼叫只證明進入客戶端送出流程，不代表對方已收到。

協定應定義名稱、版本、訊息大小、來源及目標檢查、重複訊息處理、節流與未知版本處理。對方未安裝插件時要有可預期行為。不要用接收者提供的角色識別值取代可信的訊息來源，也不要在日誌輸出完整私人資料。

### 8.5 180K 單次限制：量測完整提交並預留餘量

本指南採 `180_000` bytes 作為 180K 的開發限制值，**不是 180,000 個 JavaScript 字元，也不是 180 KiB（184,320 bytes）**。精確的伺服器計量範圍、封包外層開銷與邊界比較式尚未從伺服器碼核對，所以不能把剛好低於這個值當成必定可送。

本地對照來源：

- [BCX errorReporting.ts](../../BCJS/bondage-club-extended-master/src/errorReporting.ts)：量測 outgoing message，在超過 `180_000` 時回報問題。
- [BCX utils.ts](../../BCJS/bondage-club-extended-master/src/utils.ts)：`measureDataSize` 使用 JSON 序列化與 `TextEncoder` 量測位元組，不是 `.length`。
- [LSCG outfitCollection.ts](../../BCJS/LSCG-main/src/Settings/OutfitCollection/outfitCollection.ts)：衣櫃儲存採 `MAX_BYTES = 180000`。

要量測的是**實際提交的整個 payload**，包括鍵名、JSON 包裝、巢狀 JSON 字串的跳脫、同包其他欄位及協定開銷。設定值能塞進 180K，不表示裝進 AccountUpdate 後仍能送出。中文、emoji 的字元數與 UTF-8 bytes 也不相同。

下面的函式可供第 3、9.1 節這類 JSON 單鍵設定保存使用。它在修改 Player 與提交前先檢查，採 **150,000 bytes 的插件自訂預算**；150K 是預留餘量的範例政策，不是另一個官方上限，也不是適用所有訊息類型的安全保證。

```js
function prepareExtensionUpdate(key, settings, budgetBytes = 150_000) {
    if (typeof key !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) {
        throw new TypeError("請使用插件自己的單一設定鍵");
    }
    if (!Number.isSafeInteger(budgetBytes) || budgetBytes <= 0 || budgetBytes >= 180_000) {
        throw new RangeError("提交預算必須低於 180K 並保留餘量");
    }
    const value = JSON.stringify(settings);
    if (value === undefined) throw new TypeError("設定不能是 undefined");
    const payload = { [`ExtensionSettings.${key}`]: value };
    // JSON 訊息的保守估算，包含事件名稱；不是底層傳輸封包的逐位元組重建。
    const bytes = new TextEncoder().encode(JSON.stringify(["AccountUpdate", payload])).byteLength;
    if (bytes > budgetBytes) throw new RangeError(`提交過大：${bytes} bytes／預算 ${budgetBytes}`);
    return { value, bytes };
}

// 僅適用必須整體替換的小型 JSON 字串；物件型設定改用必要欄位更新。
function saveGuideSettings(settings) {
    const key = "ExampleBCGuide";
    const prepared = prepareExtensionUpdate(key, settings);
    Player.ExtensionSettings ??= {};
    Player.ExtensionSettings[key] = prepared.value;
    ServerPlayerExtensionSettingsSync(key);
    return prepared.bytes;
}
```

這個 helper 的輸入限定為已驗證的 JSON 設定資料；它不負責 schema 驗證，也不攔截其他插件。循環引用、BigInt 等序列化錯誤直接交給保存 UI 顯示，不能把量測失敗視為 0 bytes 然後照送。

欄位檢查與完整訊息檢查各有用途：平常只送自己實際變更的欄位，必要時深入到 RULE／TEST 等子欄位；每次仍檢查真正的整包提交。不要把插件資料累積大小當成「剩餘傳輸容量」，也不能把其他插件的資料刪掉來讓自己的提交通過。

`QueueData` 可能把多次欄位更新合成一包。每個欄位各自低於預算，不代表合併後安全；需要分開的 RULE／TEST 更新不能因排程合併而又形成超大包。可建立各自符合預算的 AccountUpdate 呼叫，交給正常 ServerSend 佇列處理。合理分次局部更新是遵守限制的方式；仍應避免高頻切片與無限重試。

### 8.6 資料太大時，依用途處理

| 資料用途 | 優先做法 | 必須留下的行為 |
| --- | --- | --- |
| 少量設定 | 移除預設值、重複與可計算欄位 | 讀取時補預設，格式帶版本 |
| 頭像、歷史快照、素材 | IndexedDB；必要時提供匯出 | 顯示本機儲存範圍、容量及清除操作 |
| 可重建的列表／索引 | 保存來源 ID 與必要差異 | 缺資料時能重新取得或顯示替代內容 |
| 確實需要跨裝置的文字資料 | 規劃壓縮格式、版本與大小預算 | 檢查最終編碼後 payload，解壓也限制輸出大小 |
| 真正需要分批的操作 | 使用支援分批的協定與有限速排程 | 批次 ID、順序、確認、逾時、取消及中斷恢復 |

Base64 是編碼，不是壓縮，通常會增加大小。壓縮後再 Base64 的資料也應量測最終送出的字串。不要因壓縮後能送，就允許接收端無上限解壓或解析。

獨立設定欄位可以分次局部更新，不需要為 RULE／TEST 這類各自完整的值另外建立檔案分塊協定。只有把同一個值切成多段、需要接收端重新組合時，才要批次 ID、順序與完整性處理。分次更新仍要控制頻率；其他同步路徑也不要再把整個大型插件物件重送一次。這不表示累積資料另有 180K 上限。

提交超出預算時保留目前可用設定，提示減少資料／改存本機或匯出，停止自動重試。不得靠一連串失敗傳輸來試探邊界。

### 8.7 設定遷移：先讀懂舊資料，再決定是否寫回

持久設定建議採 `{ version, ...fields }`。讀取時把解析、版本判定、遷移、驗證與保存分開：

1. 無資料：建立預設值，不必立即送一次 AccountUpdate。
2. 已知舊版本：轉換到新格式，保留既有使用者選擇；測量新 payload 後再保存。
3. 格式損壞：顯示可恢復的錯誤或使用暫時預設，不要立即覆寫原始資料。
4. 未知新版本：避免舊版插件把新欄位全部清空後寫回；停用該保存路徑或提供相容讀取。
5. 遷移失敗／超出容量：保留原資料，提供匯出與重試入口；重試需要使用者操作或有上限的策略。

備份不應為了方便又塞進同一個 ExtensionSettings 值，讓提交大小加倍。適合的本機備份可放 IndexedDB 或下載檔案；日誌只記錄格式版本、大小與錯誤，不印出整包私人資料。

驗收：ASCII／中文／emoji、字串內引號與換行、接近預算／超過預算、循環引用、壓縮後變大、佇列合併、離線重試，以及遷移前後設定不遺失。180K 限制與可恢復的失敗提示都是功能完成條件。

## 9. 道具、互動與設定頁：按需求深入

這些區域保留為查找入口，沒有需要時不用先讀完。

| 需求 | 查找入口 | 完成標準 |
| --- | --- | --- |
| 插件設定頁（9.1） | `PreferenceRegisterExtensionSetting` 與現有插件註冊處 | 開啟、修改、保存、退出；DOM 清理 |
| Dialog／InformationSheet 按鈕 | 同畫面的 Run／Draw、Click、Exit 與選中角色狀態 | 對正確角色操作；子畫面中不誤觸 |
| 穿戴／移除／修改道具 | `InventoryWear`、`InventoryRemove`、`CharacterAppearanceSetItem` 及呼叫端 | 權限通過、驗證後仍保留、同步結果正確 |
| Extended Item | `ExtendedItem.js` 與最接近的原生道具實作 | Load／Draw／Click／Exit、Property、鎖與權限一致 |
| 自訂 Asset／鎖 | `Asset.js`、對應 Inventory 與 Extended Item 流程 | 圖片、設定、互動、對方顯示；新增 Asset 不等於新增解鎖系統 |
| 自訂 Activity | `Activity.js`、資產資料及聊天字典 | 前置條件、目標、權限與訊息完整 |
| 房間管理 | `ChatAdmin.js` 中相同 Action 的原生呼叫 | 管理員權限、完整 payload、伺服器結果 |

涉及 ECHO／WCE 或其他插件時，應列明實際 hook／patch 的共同入口與測試組合；不要把某插件的影響概括成「所有 UI 都受它控制」。

### 9.1 完整設定頁：Canvas 按鈕與 DOM 輸入框

原生入口分成兩個檔案：[Preference.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Character/Preference/Preference.js) 負責註冊，[Extensions.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Character/Preference/Extensions.js) 負責開啟、執行與清理。可搭配 [LCE 設定頁](../../BC-LCE/src/settings/settings-page.js) 與 [HSC 設定頁](../../BC-HSC/src/ui/preference.js) 閱讀。

| callback／欄位 | R131 的實際契約 |
| --- | --- |
| `Identifier` | 唯一的非空字串；重複註冊只記錄錯誤，不會替換舊頁 |
| `ButtonText` | 字串或回傳字串的函式；註冊時也用來排序 |
| `Image` | 可省略，或使用字串／函式 |
| `load` | 開啟頁面時執行；Extensions 呼叫端沒有等待其 Promise |
| `run`／`click` | 小寫名稱，分別繪製與處理點擊 |
| `exit` | 原生返回路徑會直接呼叫；回傳 `false` 阻止離開 |
| `unload` | 清除頁面或外部切換畫面時的清理入口 |
| `resize` | 可選，更新 DOM 位置與尺寸 |

註冊函式只驗證部分欄位，**沒檢查 `exit` 不代表可以不提供**。Extensions 的返回路徑直接執行 `.exit()`。而且該層未等待 `exit()` 的 Promise；`async exit()` 最終 resolve false 並不能可靠阻止離開。需要非同步保存時，使用顯式「儲存」操作與 loading 狀態，保存期間由同步 `exit` 回傳 false。

以下範例可在第 3 節的登入完成後另外呼叫一次。它有獨立設定鍵；點「儲存」寫回，離開時丟棄未保存草稿。這是頁面範例，不包含熱卸載註冊項目的機制。

```js
function registerExampleSettingsPage() {
    const key = "ExampleBCGuideSettings";
    const inputId = "example-bc-guide-label";
    let input = null;
    let enabled = false;
    let status = "";

    function cleanup() {
        input?.remove();
        input = null;
    }
    function resize() {
        if (input) ElementPosition(input, 1150, 350, 500, 65);
    }
    function load() {
        cleanup();
        let saved;
        try { saved = JSON.parse(Player.ExtensionSettings?.[key] ?? "null"); }
        catch { saved = null; }
        enabled = saved?.enabled === true;
        const label = typeof saved?.label === "string" ? saved.label.slice(0, 40) : "";
        input = ElementCreateInput(inputId, "text", label, 40);
        input.setAttribute("aria-label", "插件顯示文字");
        status = "未修改";
        resize();
    }
    PreferenceRegisterExtensionSetting({
        Identifier: key,
        ButtonText: "Guide Example Settings",
        load,
        run() {
            DrawText("顯示文字", 1150, 260, "Black", "Gray");
            DrawButton(900, 460, 500, 65, enabled ? "已啟用" : "已停用", "White");
            DrawButton(900, 560, 500, 65, "儲存", "White");
            DrawText(status, 1150, 680, "Black", "Gray");
        },
        click() {
            if (MouseIn(900, 460, 500, 65)) {
                enabled = !enabled;
                status = "尚未儲存";
            } else if (MouseIn(900, 560, 500, 65) && input) {
                try {
                    Player.ExtensionSettings ??= {};
                    Player.ExtensionSettings[key] = JSON.stringify({
                        version: 1, enabled, label: input.value.trim().slice(0, 40),
                    });
                    ServerPlayerExtensionSettingsSync(key);
                    status = "已提交儲存，重新登入可驗證";
                } catch (error) {
                    status = "提交失敗，請查看主控台";
                    console.error("[Guide settings]", error);
                }
            }
        },
        exit() { return true; },
        unload: cleanup,
        resize,
    });
}
```

`ElementPosition` 使用**中心座標**，`DrawButton` 使用左上角；這正是 Canvas 與 DOM 混用時容易差半個寬度的原因。`ElementCreateInput` 遇到相同 ID 會重用現有元素，不能靠重複呼叫保證值與監聽器已重設。每個插件使用自己的 DOM ID。

若要在設定頁內放自訂返回鈕，可呼叫 `PreferenceSubscreenExtensionsClear()`；此路徑會清理頁面，但不代替你的保存驗證。需要離開檢查時，先呼叫自己的同步判定，再執行 clear 並處理 Promise 錯誤。

指定註冊函式沒有回傳 remover。`mod.unload()` 不會移除這個設定頁；若產品要求熱卸載，需額外設計停用狀態、頁面關閉與版本相依的註冊清理，不能重複呼叫註冊假裝替換成功。

驗收：進入、保存、退出再開、未保存退出、resize、觸控鍵盤、透過其他功能直接切換畫面。關閉後 DOM 必須消失；重新開啟不得留下重複 listener。

### 9.2 InformationSheet：顯示與操作使用同一個角色

R131 的 [InformationSheet.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Character/InformationSheet/InformationSheet.js) 把 `InformationSheetSelection` 定義為角色物件或 null；不是會員編號。FCM 中同時接受數字與物件是其相容做法，不能反推原生型別。

下面是可整合的按鈕安裝函式。傳入已註冊的 mod API，以及開啟自己面板的同步 callback；位置沿用 FCM 案例附近的區域，**與 FCM 同時啟用時需另行安排位置**。

```js
function installProfileButton(mod, openPanel) {
    const box = { x: 1715, y: 420, w: 90, h: 90 };
    function getTarget() {
        if (CurrentScreen !== "InformationSheet" || InformationSheetSecondScreen) return null;
        const C = InformationSheetSelection;
        return C?.IsPlayer?.() ? C : null;
    }
    const removeDraw = mod.hookFunction("InformationSheetRun", 0, (args, next) => {
        const result = next(args);
        if (getTarget()) DrawButton(box.x, box.y, box.w, box.h, "Mod", "White");
        return result;
    });
    const removeClick = mod.hookFunction("InformationSheetClick", 0, (args, next) => {
        const C = getTarget();
        if (!C || !MouseIn(box.x, box.y, box.w, box.h)) return next(args);
        openPanel(C);
        return;
    });
    return () => { removeDraw(); removeClick(); };
}
```

這個範例只開啟自己的面板。若要處理他人資料，重新定義 `getTarget` 的適用條件，並在真正執行操作時再次驗證目標與權限。面板內的非同步查詢不能晚到後覆蓋已切換的角色；保存 MemberNumber 與請求世代，回傳時確認仍是同一個對象。

開啟原生資訊頁可用 `InformationSheetLoadCharacter(C)`，它同時設定 selection、記錄返回畫面並啟動切換；該 wrapper 本身沒有回傳切換 Promise。不要對它寫 `await` 就假設畫面載入完成。

Dialog 的焦點則要沿 `CharacterGetCurrent()`、`FocusGroup`、`DialogFocusItem` 與對應選單狀態追蹤，不能直接使用資訊頁的 selection。驗收至少涵蓋自己／他人、第二頁、面板關閉、切換角色，以及與會接管資訊頁的插件共存。

### 9.3 Inventory：操作、刷新與同步分三步

原生 [Inventory.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Inventory.js) 與 [Appearance.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Character/Appearance/Appearance.js) 的幾個關鍵行為：

| 函式 | 核對到的行為 | 不應假設的事情 |
| --- | --- | --- |
| `InventoryWear` | 找 Asset、建立 Item、套表情／Craft，預設 `CharacterRefresh(C, true)`，回傳 item 或 null | 呼叫成功不等於完整穿戴權限與互動流程已檢查 |
| `CharacterAppearanceSetItem` | 移除舊項、建立 `AppearanceItem`、執行 `ExtendedItemInit`、加入 Appearance | 不只是替換陣列值；舊 Property 不保證保留 |
| `InventoryRemove` | 接受單一或多個群組，委派 `InventoryRemoveItems`，回傳被移除項目陣列 | 回傳值不是 boolean，也不保證只移除一項 |
| `InventoryRemoveItems` | 依 `RemoveItemOnRemove` 遞迴處理關聯道具，預設刷新角色 | 直接 `splice`／`filter` 可能漏掉連帶移除與刷新 |

`InventoryRemove(C, group, { refresh: false })` 的 false 是停用刷新，不是乾跑；Appearance 仍已改變。`InventoryWear` 最後一個 `Refresh=false` 也是同理，而且不會停用前面的表情或 Craft 邏輯。

開發批次操作時採以下順序：

1. 依最接近的原生操作確認 Asset、群組、前置條件、鎖、角色關係與使用權限。`InventoryAllow` 只是其中一環，不是通用授權函式。
2. 完成所有可預先做的驗證，再執行修改。關閉逐項刷新可減少重建，但操作不是自動交易；中途失敗要有已定義的部分成功或回復方式。
3. 依需求執行一次角色刷新，決定是否推送玩家外觀，以及是否需要聊天室項目／角色更新。
4. 重新取得 `InventoryGet(C, group)` 確認結果。原 Item 可能已被替換，不要長期保存過期物件引用。

視覺預覽優先使用隔離的預覽角色。若暫改真實角色，即使事後恢復 Appearance，也可能已產生表情、動畫、網路或 Dialog 副作用，不能只靠陣列備份保證回復完整。

驗收：Asset 不存在、被封鎖、群組占用、帶鎖項目、Extended Item 預設 Property、關聯道具移除、Craft 與顏色、批次中途失敗、對方客戶端與重新登入後結果。

### 9.4 聊天室更新：函式名稱不能代替 payload 檢查

在本地 [ChatRoom.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Online/ChatRoom/ChatRoom.js) 中：

| 呼叫 | 客戶端實際送出的重點 | 使用前提／副作用 |
| --- | --- | --- |
| `ChatRoomCharacterUpdate(C)` | `ID: C.CharacterID`、ActivePose、Appearance bundle | 檢查在房間且允許更新；payload 本身沒包含任意 OnlineSharedSettings |
| `ChatRoomCharacterItemUpdate(C, Group)` | 指定群組的 Item 名稱、顏色、Property、Craft 等 | 群組省略時會依焦點判定，獨立插件操作應明確指定 |
| `ChatRoomPublishCustomAction(msg, LeaveDialog, Dictionary)` | `ChatRoomChat` 的 Action | 同時更新目前角色的項目，並可能離開 Dialog；不是純訊息函式 |
| `ServerSend("ChatRoomChat", payload)` | 指定類型、內容、目標與字典 | 經過送出佇列；接收與顯示仍是另一條流程 |

`ChatRoomCharacterUpdate` 周圍註解有「更新資料庫」與「不更新資料庫」的矛盾描述。這種情況應以函式本體確認客戶端送了什麼，再查伺服器或實測持久化，不能挑一句註解當保證。

`ChatRoomCharacterItemUpdate` 還會先更新本地 `ChatRoomData.Character` 中的 Appearance bundle；原生註解指出單項更新不會回送給來源成員。因此只手寫相似的 ServerSend，可能漏掉本地房間快取更新。

同理，AEE 的公開設定案例在 QueueData 後呼叫 `ChatRoomCharacterUpdate(Player)`；只能確認它觸發了角色更新，不能據此宣稱該 payload 直接帶著公開設定。若需要保證同房立即取得最新值，要追伺服器回應並以第二客戶端驗收。

Action 的 Content 通常與原生字典／本地化標籤配合。自訂標籤要確認未安裝插件的接收者會看到什麼，不能假設任意字串都能依預期翻譯。

### 9.5 多人插件偵測：公開設定不代表插件正在執行

[AEE presence](../../BC-AEE/src/core/aeePresence.ts) 是可閱讀的完整案例：公開設定保存版本與功能宣告；實際在線狀態使用 Hidden 訊息的 request／reply、nonce、有效期限與房間成員檢查。

值得複用的是這個區分：角色帳號上還留著插件資料，不代表目前瀏覽器仍載入插件。反過來，沒有收到回應也可能是延遲，UI 宜顯示「尚未確認」，不要當成永久不支援。

以下純解析函式可作為接收端的起點，尚不包含網路發送、待回覆 nonce 管理與限流：

```js
function parseGuideReply(data, roomMembers) {
    const prefix = "ExampleBCGuide:presence:";
    if (data?.Type !== "Hidden" || typeof data.Content !== "string") return null;
    if (!Number.isInteger(data.Sender) || !roomMembers.has(data.Sender)) return null;
    if (!data.Content.startsWith(prefix) || data.Content.length > 1024) return null;
    try {
        const value = JSON.parse(data.Content.slice(prefix.length));
        if (!value || typeof value !== "object" || Array.isArray(value)) return null;
        if (value.protocol !== 1 || value.type !== "reply") return null;
        if (typeof value.nonce !== "string" || value.nonce.length < 1 || value.nonce.length > 64) return null;
        if (typeof value.version !== "string" || value.version.length > 64) return null;
        return { sender: data.Sender, nonce: value.nonce, version: value.version };
    } catch { return null; }
}
```

1024 是這個範例自己訂的處理上限，不是 BC 伺服器上限。解析成功後仍要核對 nonce 是否由本機發出且未過期，確認房間世代未改變，再更新狀態。對 request 限制每個 sender 的回應頻率，對 changed 通知合併重查，避免大家互相觸發大量廣播。

Hidden 表示訊息類型，不表示加密或秘密；不要用它傳秘密資料。它也沒有替你證明對方真的使用某個可信插件，回應內容只是對方客戶端的宣告，不授予任何道具或遠端控制權限。

停用／離房時清除 peers、待回覆 nonce、timer 與延遲請求。AEE 的既有 interval／callback 仍需按新插件的卸載需求補完整生命週期，不能假設 SDK 會清理。

### 9.6 原生訊息 handler 與 SDK hook 的 priority 不同

R131 提供 `ChatRoomRegisterMessageHandler`。其 `ChatRoomMessageRunHandlers` 按 Priority **由小到大**執行，負數為 pre，非負數為 post；這與 SDK 的高數字先進入完全不同。

原生 handler 的 callback 回傳 true 會中止該 handler 處理鏈；false 繼續，也可回傳轉換物件。不要把 SDK 的 `(args, next)` 契約套到這裡。R131 的 `ChatRoomMessage` 在基本資料／房間成員檢查後先跑 pre handlers，接著對 Hidden 提前返回；只有其餘訊息繼續抽取 metadata、替換文字，再跑 post handlers。因此 Hidden 可以進 pre，卻不會進 post；不要把兩階段視為等價。

指定版本的 handler 註冊會 push 到列表，沒有回傳 remover。若只是跟隨 AEE 處理 Hidden 協定，可先沿用 SDK 對 `ChatRoomMessage` 的 hook；解析失敗或不屬於自己時正常 `next(args)`，避免吞掉其他插件或原生訊息。

### 9.7 Extended Item：沿用原生選項與驗證流程

先查 Item 的 `Asset.Archetype` 與對應資料，不能把所有道具都當成只有一個 `Property.Type`。本地 Typed／Vibrating／Modular 等系統使用自己的選項資料與 TypeRecord；從最接近的原生道具移植時，要一起讀選項定義、初始化、驗證、套用、更新與發布訊息。

本輪對照 [ExtendedItem.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/ExtendedItem.js) 與 [TypedItem.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/TypedItem.js)，確認以下行為：

| 入口 | 重要細節 |
| --- | --- |
| `ExtendedItemInit(C, Item, Push, Refresh)` | 對 Extended Asset 動態呼叫 `Inventory<群組><道具>Init`；不是所有自訂 Asset 都能只加圖片就完成 |
| `ExtendedItemInitNoArch` | 深拷貝預設 Property，只補缺少的欄位；Refresh 與 Push 控制不同副作用 |
| `ExtendedItemValidate` | 檢查鎖、ChangeWhenLocked、Prerequisite、選項是否已套用等；回傳值可能是 null 或字串，部分分支是空字串 |
| `TypedItemSetOptionByName` | 只適用支援的 Typed／Vibrating archetype，先按名稱找選項，再委派 TypeRecord 設定 |
| `ExtendedItemSetOptionByRecord` | 合併 TypeRecord、逐選項驗證與套用；依 `C_Source` 是否為玩家選擇驗證路徑 |

`TypedItemSetOptionByName` 的註解描述字串錯誤，但本地實作委派 `ExtendedItemSetOptionByRecord` 時沒有回傳其結果，而且找不到 item 時也直接返回。因此 `undefined` **不能單獨當成成功證據**。套用後應重新讀取 Item 與選項，核對實際狀態。

多個 Modular 選項也不能預設為全有或全無的交易：本地 TypeRecord 流程逐項驗證，失敗項目可能記錄錯誤，而其他項目仍繼續。批次設定 UI 要顯示實際成功與失敗，不能只彈出「全部完成」。

預覽角色 `C.IsSimple()` 在部分驗證中走不同分支。因此「在 CraftingPreview 可以改」不能推論成「在真人鎖定道具上也可以改」。實際使用者操作必須帶入正確來源角色，不能為了通過驗證省略來源或把真實角色假裝成預覽。

新增自訂 Extended Item 的最小成果應包含：預設 Property、至少一個可切換選項、正確的返回／清理、保存後重新穿戴或載入仍一致，以及需要同步時的對方顯示。先做通一個選項，再擴充複雜 UI。

驗收：同選項重複套用、無效名稱、不同 archetype、鎖定不可改、前置條件失敗、自己／他人、預覽／真實角色、多模組部分失敗、重新載入及聊天室訊息。不要以「Property 變了」取代完整驗收。

## 10. BC 大型程式碼：插件最需要在意的部分

本次是針對插件入口與副作用的原始碼檢查，不是整個遊戲的完整 bug、安全或效能審計。核心 Scripts 中較大的檔案包括 Dialog、Element、Character、Common、Inventory、Drawing、Server、Validation；檔案大小只是閱讀導航，風險取決於實際呼叫路徑。

| 區域／來源 | 已確認或應檢查的行為 | 對插件的影響 |
| --- | --- | --- |
| [Character.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Character.js)：`CharacterRefresh` | 預設 `Push=true`；整理 effect／pose、重建 Canvas，玩家會同步外觀，預設也可能刷新 Dialog | 不能當成便宜的純重畫；預覽要明確決定 push 與 Dialog 行為 |
| 同檔：`CharacterLoadCanvas` | 從 Appearance 建立 DrawAppearance／DrawPoseMapping，排序、遮罩、角色 hooks、身高與 Canvas 重建，最後清 MustDraw | 瞬間改 DrawAppearance 可能在下一次重建消失；需找穩定的渲染入口 |
| 同檔：`CharacterDelete` | 依 ID 找到角色，清動畫並從全域集合移除 | 預覽／頭像角色需要所有權，不能刪仍被其他功能共用的角色 |
| [ChatRoom.js](../../BCJS/Bondage-College-master/BondageClub/Screens/Online/ChatRoom/ChatRoom.js)：`ChatRoomSync` | 本版本為 async | 等完成後再讀新房間／角色狀態；延遲工作也要防止已離房 |
| [Server.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Server.js) | 登入 API、欄位佇列、ExtensionSettings 單鍵更新 | 不混用登入、連線與資源就緒；保存與廣播分開驗證 |
| [Validation.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Validation.js) | `ValidationApplyRecord` 是否保留額外欄位由參數決定 | 必須讀呼叫端，不能只看驗證表就推斷封閉 schema |
| [GLDraw.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/GLDraw.js) | 含 context lost／恢復相關處理 | 只攔 WebGL 的效果要定義失效與 fallback 行為 |
| [Dialog.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Dialog.js) | 多種選單與角色互動狀態，應沿實際按鈕呼叫追蹤 | 顯示、點擊、權限與退出不是單一 Draw hook 就能完成 |
| [Element.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Element.js)、[Mouse.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Mouse.js) | 核對 DOM 定位與事件轉換 | 直式映射必須同時驗證畫面與輸入，避免重複位移與重複點擊 |
| [Inventory.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/Inventory.js)、[ExtendedItem.js](../../BCJS/Bondage-College-master/BondageClub/Scripts/ExtendedItem.js) | 應沿原生操作追蹤 Property、權限與同步 | 直接改物件成功不代表原生驗證與多人流程成功 |

高頻路徑另查：是否每幀掃描全部角色、建立 DOM／圖片、序列化設定、重建所有 Canvas 或送網路訊息。把資料更新與繪製分開，使用有失效條件的快取；沒有量測前，不宣稱某個 hook 必然造成效能問題。

### 10.1 CommonSetScreen：畫面切換是非同步流程

本地 `CommonSetScreen` 先呼叫舊畫面的 Unload，檢查新畫面的 Run／Click，再設定 CurrentModule／CurrentScreen，等待文字資源與新畫面 Load，最後 resize。Load 失敗時會嘗試載回舊畫面。

這表示四件事：

- `CurrentScreen` 已改變不代表新畫面的 Load 已完成；依賴完成狀態時應等待 `CommonSetScreen` 本身的 Promise。
- 自訂畫面的必要全域 Run／Click 要先準備好。函式存在性檢查之前，舊畫面可能已經卸載。
- 直接改 `CurrentScreen`／`CurrentModule` 會跳過正式流程，不適合作為一般切換方式。
- Unload 要能重複安全執行。只在 Exit 清理不夠，因為外部功能可以直接切換畫面。

若只是在原畫面上開一個 DOM 面板，不一定需要創建新 BC 畫面。選擇完整畫面時，才提供對應 Load／Run／Click／Unload／Resize 與返回策略。

### 10.2 ServerSend：排隊中的 payload 仍可能被修改

本地 `ServerSend` 把 `{ Message, args }` 放入佇列，沒有深拷貝 payload。`ServerAccountUpdate.QueueData` 的 Map 也保存傳入 value。佇列受到限流時，呼叫之後再改原物件，可能影響稍後真正送出的內容。

對必須固定在提交瞬間的插件資料，先建立只含可序列化欄位的新 payload；巢狀欄位也要考慮引用，只有 `{ ...obj }` 不會複製內部物件。不要整包 clone 活的 Character，它含有方法與其他執行狀態；使用對應的 bundle／資料投影。

`ServerSendQueueProcess` 還會為 Chat／Emote／Whisper 類型加入 MsgId 字典項目。每次發送建立新物件與 Dictionary，避免重用後殘留欄位。這是排程與共享物件的注意事項，並不代表每次呼叫都會延遲發送。

### 10.3 文件審查發現，不等於遊戲 bug 報告

本輪已確認的高價值注意點是：設定頁 callback 的非同步限制、不同 priority 系統、畫面載入時序、道具連帶移除、更新 payload 範圍，以及排隊物件引用。這些應直接影響插件設計。

要將其中一項升級為 BC bug 報告，還需要：最小重現、實際／預期結果、版本、原生環境能否重現，以及排除插件攔截的結果。不要只因函式很大、註解矛盾或存在低階 API 就斷言遊戲有漏洞。

## 11. 實作與驗收流程

### 11.1 開始改動前

1. 描述使用者操作與預期效果，確認是否需要多人同步。
2. 找最接近的現有案例，讀入口與清理路徑。
3. 在指定 BC 原始碼搜尋入口，確認參數、回傳值、同步／非同步、副作用。
4. 記錄支援版本與必要插件；優先利用現有工具，不為一次功能建立整套框架。
5. 先完成最小效果，再加狀態、快取與設定。

### 11.2 最小驗收矩陣

| 類型 | 必測情境 |
| --- | --- |
| 載入 | 登入前／後注入、重複注入、停用、初始化失敗 |
| UI | 滑鼠／觸控、窄視窗／直式、退出返回、其他子畫面 |
| 繪圖 | 姿勢／身高／縮放、貼圖延遲、後端或 fallback、效果取消 |
| 資料 | 首次使用、舊格式／損壞資料、保存後重讀 |
| 多人 | 自己與第二客戶端、對方未安裝、離房／重連、重複事件 |
| 共存 | 實際會碰到相同入口的插件組合、不同載入順序 |

### 11.3 出錯時的查找順序

- **完全沒效果：** 確認執行環境、API 就緒、SDK 註冊、hook 是否進入及啟用條件。
- **有畫面不能點：** 比較 Draw 與 Click 條件、邏輯座標與 CSS 座標、DOM 遮擋。
- **只在部分角色／道具失效：** 確認渲染後端、Canvas 是否重建、真實圖層參數及來源版本。
- **設定下一次就消失：** 查保存 payload、驗證路徑、讀回及資料遷移。
- **只有自己看得到：** 查廣播與接收端，不以本地變數改變當同步成功。
- **離開畫面仍有特效：** 查 listener、timer、RAF、非同步回呼與 generation 失效機制。

### 11.4 交付記錄

```text
功能：
BC／SDK／相關插件版本：
參考實作：
修改檔案與原生入口：
操作步驟與預期結果：
已執行的建置／測試：
遊戲內實際結果：
尚未驗證的情境：
已知限制與停用／恢復方式：
```

測試投入要對準效果：純座標映射適合單元測試；頭像完整度與角色錨點需要視覺驗收；多人同步需要第二個客戶端。不要只測自己寫的 mock，再推論整個遊戲流程已完成。

### 11.5 本文件目前的驗證紀錄

180K 局部更新補正後：11 段 JavaScript 語法及所有本地連結重新檢查通過。巢狀 AccountUpdate 的伺服器行為依維護者提供的確認記錄，範例尚未送出至遊戲伺服器驗證。

2026-09-14：已檢查本文件所有本地檔案連結、9 段 JavaScript 的語法，以及 Git 差異空白檢查。另對純座標函式驗證中心映射、邊界排除與零尺寸；對 presence 解析函式驗證合法回覆、非房間成員、損壞 JSON、錯誤訊息類型與超長內容。

2026-09-15：續寫後重新檢查所有本地連結、10 段 JavaScript 語法與差異空白。新增提交大小函式已測中文／emoji、剛好等於自訂預算、超出預算、180K 大資料、不合法預算／鍵名、undefined 與循環引用。這些是本機資料檢查，沒有向伺服器發送大封包或測試限制邊界。

尚未執行遊戲內設定頁、按鈕點擊、繪圖、多插件共存或第二客戶端同步測試。上述檢查只驗證文件與純函式，不能代替每個案例列出的遊戲內驗收。

## 12. 文件維護與 skill 的界線

本 MD 維持開發知識、實作索引與驗收方式。新增案例時，補「成果、原生入口、來源、限制、驗收」，不要只累積 API 名稱。

目前不另建 skill。之後若要讓 AI 固定遵循開發流程，可抽成短 skill：讀本指南 → 查本地版本 → 找現有實例 → 完成最小功能 → 執行對應驗收 → 記錄未驗證項目。詳細案例仍連回本文件，避免維護兩份互相矛盾的內容。
