> 本文件對應版本：v0.4
>
> v0.4 起，原本獨立的「貼貼熱修復」已併入 HLF：斷線重連時復原貼貼／拉到身邊等
> `XCharacterDrawOrder` 配對，並在任一端移除時連動移除另一端。localStorage 快取依
> 帳號（`Player.MemberNumber`）分開，避免多帳號互相污染。本文件以下只記錄牽引部分。

## 問題背景

BC 原版牽引有以下幾個問題：

### 問題一：跨區性別判定

BC 在收到牽引 Beep 時會先檢查性別是否符合目標房間（`ChatSelectGendersAllowed`），跨區牽引（女性區 → 混合區）會因此失敗，`ChatRoomLeashPlayer` 被清空，Sub 就停在大廳。

### 問題二：LSCG 等自訂牽引系統

LSCG 的牽引完全繞過 BC 原版的 `ChatRoomDoHoldLeash`，不設定 `ChatRoomLeashPlayer`，導致 Sub 就算收到 Beep 也因為沒有牽引狀態而無法正確跟隨，且加入後可能被踢出。

### 問題三：部分擴充插件的牽引訊息並非單向

部分擴充插件（例如處理房間移動的插件）在移動房間時，會同時對「移動者自己」與「被牽引者」各自送出一份 `BeepType: "Leash"` 的訊息，甚至可能對同一次移動重複送出多份，這跟 BC 原生「只有被牽引者該收到通知」的設計不同。若不加處理，會導致 `ChatRoomLeashPlayer` 這個全域狀態被錯誤設定或污染，讓雙方看起來都處於「被牽引」狀態。

### 問題四：其他插件借用 Leash Beep 做別的用途

`BeepType: "Leash"` 並非牽引專用──不少插件會借用同一種 Beep 傳遞其他訊號。HLF 原本只要在 `ChatRoomLeashPlayer` 尚未設定時收到 Leash Beep，就會直接把發送者「認領」成牽引者並跟著切房。這使得任何借用 Leash Beep 的插件都可能觸發 HLF 的錯誤攔截與錯誤前往，因此需要在攔截前先確認發送者確實與我們有牽引關係。

### 問題五：三套牽引系統記錄狀態的方式各不相同

判斷「這則 Leash Beep 是不是真正的牽引」時，必須同時涵蓋三套系統，但它們記錄牽引狀態的方式互不相同，**沒有任何單一判斷能全部涵蓋**：

| 系統 | 牽引狀態記在哪 | 會設 `ChatRoomLeashPlayer`？ | `ChatRoomCanBeLeashedBy(sender)` |
| --- | --- | --- | --- |
| BC 原版 | 真實頸具 + `ChatRoomLeashList` / `ChatRoomLeashPlayer` | ✅ 會 | ✅ 為真（身上有帶 Leash effect 的頸具） |
| LSCG | 自己的 `Pairings` 清單，並 hook `ChatRoomCanBeLeashedBy` | ❌ 不會 | ✅ 為真（被 hook，依自己資料回報） |
| ECHO | `ChatRoomOrderTools` 的 follow/lead 模式 | ✅ 會（寫進被牽者的 `ChatRoomLeashPlayer`） | ❌ 常為假（穿的是 `ItemMisc`／`ItemTorso` 等非頸具） |

- **LSCG**：牽手、抓手臂、咬住、抓耳朵… 各種抓取動作全部存在自己的 `Pairings`（`LeashedByMemberNumbers` 等），並 hook `ChatRoomCanBeLeashedBy` 回報「某人是否正牽著我」；但**不設定** `ChatRoomLeashPlayer`。所以只能靠 `ChatRoomCanBeLeashedBy` 認出。
- **ECHO**：拉到身邊、騎上去、鑽進懷裡、抱入懷中、手推車、駕駛馬車… 等動作透過 `ChatRoomOrderTools` 的 `"follow"` 模式，把牽引者寫進被牽者的 `ChatRoomLeashPlayer`（`驾驶马车.js` 甚至直接 `ChatRoomLeashPlayer = ...` / `ChatRoomLeashList.push(...)`）。但被牽者穿的是 `贴贴`、`鞍`、`Trolley` 等**非頸部束縛**物品，沒有 Leash effect，因此 `ChatRoomCanBeLeashedBy` 往往回報為假。這正是「就算 `ChatRoomLeashPlayer` 有值，BC 原生流程還是牽不走人」的原因——原生 Beep 處理卡在 `ChatRoomCanBeLeashedBy` 這關，需要 HLF 介入強制加入。所以 ECHO 只能靠 `ChatRoomLeashPlayer` 認出。

因為單看任一項都會漏掉一套系統（只看全域變數 → 漏掉 LSCG；只看 `ChatRoomCanBeLeashedBy` → 漏掉 ECHO），正確做法是取兩者的**聯集**：

> `ChatRoomLeashPlayer === sender` **或** `ChatRoomCanBeLeashedBy(sender, Player)` 任一成立，即視為真正的牽引。

- 第一個條件涵蓋 **BC 原版 + ECHO**；
- 第二個條件涵蓋 **BC 原版 + LSCG**；
- 其他插件借用 Leash Beep 做別的事時，兩個條件都不成立，仍會被擋在外面（問題四）。

判斷通過後，HLF 再統一把發送者補進 `ChatRoomLeashPlayer`（對 ECHO 是冪等、對 LSCG 是補上原本缺的值），讓 BC 原生的牽引相關 UI（例如地圖牽引線）也認得這次牽引。

（歷程：v0.4 只用 `ChatRoomLeashList` / `ChatRoomLeashPlayer` 判斷 → 誤擋 LSCG；v0.5 只用 `ChatRoomCanBeLeashedBy` 判斷 → 誤擋 ECHO；v0.6 改用聯集，兩套非官方牽引皆能涵蓋。）

## 補丁邏輯

### Hook 1：`ServerAccountBeep`（priority 5）

攔截所有 `BeepType: "Leash"` 的 Beep，處理流程如下：

1. **自我訊息防護**：若 Beep 的發送者號碼等於自己的 `MemberNumber`，視為與己無關的訊息，直接忽略，不做任何狀態變更。用來因應問題三中「插件也會通知移動者自己」的情況。
2. **去重／防抖**：對「同一位發送者 + 同一個房間」的 Beep，在短時間窗內（目前 3 秒）只處理第一次，其餘視為重複訊息忽略。
3. **加入互斥鎖**：上一次加入房間的流程尚未結束時，忽略新進來的 Beep，避免兩個加入流程併發搶跑造成狀態錯亂。
4. **牽引關係守門（聯集判斷）**：確認發送者確實與我們有牽引關係，才由 HLF 接手；否則交還原版處理、不攔截、不切房。判斷條件為 `ChatRoomLeashPlayer === sender`（涵蓋 BC 原版與 ECHO）**或** `ChatRoomCanBeLeashedBy(sender, Player)`（涵蓋 BC 原版與 LSCG）任一成立。之所以取聯集，是因為三套系統記錄牽引狀態的方式不同、沒有單一判斷能全部涵蓋（詳見問題五）。這樣**既能涵蓋 LSCG／ECHO 兩套非官方牽引，又能擋掉其他插件借用 Leash Beep 的情況**（問題四）。
5. **補設 `ChatRoomLeashPlayer`**：通過守門後，統一把發送者號碼寫入 `ChatRoomLeashPlayer`（對 ECHO 是冪等、對 LSCG 是補上原本缺的值）。這一步是為了讓 BC 原生的牽引相關 UI／邏輯（例如地圖牽引線）也認得這次牽引（問題二、問題五）。
6. **性別判定**：呼叫 `ChatSelectGendersAllowed` 在客戶端先行判斷。若不符合，向牽引者發送 `HLF` 的 `GenderFail` 通知並取消本次加入（不會呼叫 `ServerRoomJoin`）。
7. **加入房間前二次確認**：正式呼叫 `ServerRoomJoin` 前，再次確認目前是否已經在目標房間內，避免同步判斷與非同步執行之間的極短時間差造成誤判、重複切房。
8. **狀態清理**：任何不需要（或不應該）實際加入房間的分支——已經在目標房間、加入成功／失敗——結束前都會把 `ChatRoomLeashPlayer` 重設回 `null`，避免殘留狀態污染之後的判斷。

### Hook 2：`ChatRoomSync`（priority 0）—— 規劃中／尚未實作

> ⚠️ 以下為原始設計構想，目前程式碼尚未實作此 Hook，僅保留說明供後續評估。

每次成功進入房間時，若有牽引狀態（`ChatRoomLeashPlayer != null`），啟動一個 3 秒計時器：

- 3 秒後還在同一房間 → 正常，清除緩存
- 3 秒後不在任何房間（被踢出到大廳）→ 重試加入一次，且只重試一次，避免無限迴圈

#### 為什麼需要重試機制

WCE 的 `instantMessenger` 在某些情況下會在 Sub 加入房間的同時也發出加入請求，導致伺服器收到重複加入，第二次 `ChatRoomSync` 觸發時 `ChatRoomData` 已有值，BC 判定為重複加入並踢出。重試機制就是為了在這種情況下讓 Sub 能成功穩定地落在正確的房間裡。

此問題目前是否仍會發生、是否需要補上這段實作，待後續確認後再更新本文件與程式碼。
