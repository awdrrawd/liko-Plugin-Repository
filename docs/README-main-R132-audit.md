# Plugins/main R132 相容性檢查

本次對照本地 Bondage-College-Mirror-bondageclub 的 GameVersion R132，掃描 28 個主程式的固定名稱 Hook、已棄用函式引用與非同步載入流程。這是靜態檢查與隔離回歸測試，不代表每個插件都已完成遊戲內端到端驗證。

## 修改項目

| 插件 | 版本 | 修正 |
| --- | --- | --- |
| ACV | 1.5.1 → 1.5.2 | 等待 ChatRoomLoad 完成；離開畫面後不送載入通知 |
| CRA | 1.0.2 → 1.0.3 | 等待 ChatRoomLoad 完成；離開畫面後不送載入通知 |
| Image Uploader | 1.6.2 → 1.6.3 | 等待 ChatRoomLoad 完成後設定聊天觀察器；離開畫面後略過 |
| CDB | 1.5.2 → 1.5.3 | CharacterSetActivePose 改用 R132 PoseSetActive，參數語意相同 |
| CPB | 1.2.2-1 → 1.2.2-2 | 等待 InformationSheetLoad；插件後處理失敗不再重複呼叫原生載入；同步執行期版本 |
| MPL | 0.5.4 → 0.5.5 | 等待 ChatSelectLoad、ChatSearchLoad；延後 UI 工作再次確認目前畫面 |
| MAT | 1.7.11 → 1.7.12 | 等待 ChatRoomSync 完成後建立聊天觀察器，移除猜測載入時間的 500ms 延遲 |

其餘插件未在上述檢查範圍發現需立即修改的固定 Hook/API 問題，因此未增加版本。Region switch 的 ElementContent 命中僅為註解，不是實際呼叫。先前已修正的 CMC 保留版本。

## 驗證

- `node scripts/test-main-r132.cjs`：28 個主程式語法、載入完成順序、離開畫面、原生錯誤傳遞、CPB 單次載入、版本一致性。
- `scripts/test-mat-*.cjs` 共 9 項測試通過。
- 快取測試原本寫死 10 分鐘，與既有 30 分鐘程式設定不符；改依 TTL 常數驗證到期前與到期邊界，未改動產品快取期限。
- `git diff --check` 通過。

仍需遊戲內驗證慢速連線進房、手機版搜尋頁、人物資料頁，以及多插件同時載入時的畫面行為。
