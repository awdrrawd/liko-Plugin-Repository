# FCM CHAT 媒體整合

- Image Uploader 1.6.5：已在聊天室才載入插件時也會顯示一次成功通知；進房 Hook 等待原生載入完成，畫面稍後建立時會補檢查，移除依賴一秒延遲的通知。
- FCM CHAT 輸入區新增圖片上傳按鈕，也支援拖曳圖片。連結追加到既有草稿，由 FCM 原本的送出流程處理密語／私訊、權限與離線佇列。上傳途中切換對話或重新建立輸入框，改顯示可複製連結，不會誤填另一位玩家的對話。
- ACV 1.5.4：處理 FCM 訊息內容內的媒體網址與自訂文字超連結，支援晚載入、開關面板、更新訊息與停用清理。離開遊戲聊天室只清理聊天室播放器，不影響 FCM。
- CDB 1.5.4：移除 BCX 外觀匯出／匯入函式、API 與按鈕替換；保留遊戲原生 Copy／Paste。

## 整合介面

- `window.Liko.ImageUploader.uploadFile(file)`：回傳 Promise，成功為網址，圖床失敗通常為 null；不自動發送訊息。
- `window.Liko.ImageUploader.chooseImage(onUploaded)`：必須由使用者點擊觸發；成功回呼 `onUploaded(url)`。未指定回呼時使用既有遊戲聊天室發送行為。
- `window.LikoVideoPlayerInstance.processMessage(element)`：處理指定訊息 DOM，重複呼叫不會重複加入按鈕；停用 ACV 時略過。

FCM 1.6.6 正式接用以上 API。`chat-media.js` 負責圖片按鈕、拖曳與原對話驗證；所有訊息／歷史渲染入口透過共同媒體處理呼叫 ACV。插件以 `liko:media-api-ready` 通知晚載入或重新啟用，FCM 只更新按鈕可用性與處理現有訊息，不重建草稿。

已移除 Image Uploader 的 FCM 按鈕注入、ACV 的 FCM DOM 監聽與定時掃描。請同時更新 FCM 建置與兩個媒體插件；未安裝圖片插件時 FCM 隱藏圖片按鈕，未安裝 ACV 時保留一般連結。

## 驗證

`node scripts/test-media-fcm.cjs` 使用 Playwright / Edge 驗證實際主程式：晚載入通知不重複、FCM 選檔與拖曳追加草稿、離開對話後結果隔離、自訂標籤影片連結、播放器去重與停用、原生 Copy／Paste 保留。

測試模擬圖床回應，沒有實際上傳檔案或對外發送訊息；完整遊戲多人環境仍需實測。
