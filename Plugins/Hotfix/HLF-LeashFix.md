問題背景
BC 原版牽引有兩個問題：
問題一：跨區性別判定
BC 在收到牽引 Beep 時會先檢查性別是否符合目標房間（ChatSelectGendersAllowed），跨區牽引（女性區 → 混合區）會因此失敗，ChatRoomLeashPlayer 被清空，Sub 就停在大廳。
問題二：LSCG 等自訂牽引系統
LSCG 的牽引完全繞過 BC 原版的 ChatRoomDoHoldLeash，不設定 ChatRoomLeashPlayer，導致 Sub 就算收到 Beep 也因為沒有牽引狀態而無法正確跟隨，且加入後可能被踢出。

補丁邏輯
Hook 1：ServerAccountBeep（priority 5）
攔截所有 BeepType: "Leash" 的 Beep，做兩件事：

補設 ChatRoomLeashPlayer：如果還沒設定，手動設為發送者的號碼，修復 LSCG 繞過原版流程的問題。
跳過性別判定直接加入：如果 Beep 帶有房間名（ChatRoomName），跳過原版的 ChatSelectGendersAllowed 檢查，直接呼叫 ServerRoomJoin。性別不符的話伺服器自然會拒絕，不需要客戶端預先判定。沒有房間名的情況（如 LSCG 某些情況）則交給原版處理。

Hook 2：ChatRoomSync（priority 0）
每次成功進入房間時，若有牽引狀態（ChatRoomLeashPlayer != null），啟動一個 3 秒計時器：

3 秒後還在同一房間 → 正常，清除緩存
3 秒後不在任何房間（被踢出到大廳）→ 重試加入一次，且只重試一次，避免無限迴圈


為什麼需要重試機制
WCE 的 instantMessenger 在某些情況下會在 Sub 加入房間的同時也發出加入請求，導致伺服器收到重複加入，第二次 ChatRoomSync 觸發時 ChatRoomData 已有值，BC 判定為重複加入並踢出。重試機制就是為了在這種情況下讓 Sub 能成功穩定地落在正確的房間裡。
