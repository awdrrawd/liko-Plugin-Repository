# 本倉庫媒體插件 API

Image Uploader、ACV 與 CDB 的實作及測試由本倉庫維護。外部插件可以使用公開 API，但其介面、草稿、對話路由與整合測試應由各自倉庫維護。

## 公開介面

- `window.Liko.ImageUploader.uploadFile(file)`：回傳 Promise，成功為網址，圖床失敗通常為 null；不自動發送訊息。
- `window.Liko.ImageUploader.chooseImage(onUploaded)`：必須由使用者點擊觸發；成功回呼 `onUploaded(url)`。未指定回呼時使用既有遊戲聊天室發送行為。
- `window.LikoVideoPlayerInstance.processMessage(element)`：處理指定訊息 DOM，重複呼叫不會重複加入按鈕；停用 ACV 時略過。
- `liko:media-api-ready`：供 API 使用者在插件晚載入或重新啟用後更新介面。

這些介面不要求載入 FCM，也不由 PCM 特別處理。外部呼叫端需自行決定上傳結果的目的地及草稿生命週期。

## 驗證

`npm run test:browser` 中的 `scripts/test-media.cjs` 直接載入本倉庫主程式，驗證：

- Image Uploader 晚載入及進房通知不重複。
- `uploadFile` 回傳網址、`chooseImage` 回呼取得網址，不擅自發送訊息或改寫聊天室輸入框。
- ACV 自訂標籤影片連結、重複處理去重與停用清理。
- CDB 保留遊戲原生 Copy／Paste，沒有舊 BCX 外觀匯出／匯入替換。

測試使用簡單 DOM 與模擬圖床回應，不載入外部倉庫程式碼、不實際上傳檔案或對外發送訊息。完整遊戲多人環境仍需實測。
