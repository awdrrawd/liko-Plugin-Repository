# R133 插件檢查（2026-10-18）

## 後續修復結果

以下初次檢查紀錄保留作為修復前基準。後續依使用者要求，已修復 Chat TtoB 1.1.2 的 DOM 注入與卸載問題，以及 HCR 0.1.4 的舊備份復活、同步失敗回復、字串容器保留與非法 Base64 檢查；發布目錄已重新建置。Image Cache 本次未修改。

HCR 舊測試已改寫，舊 `test-main-r132.cjs` 改名為 `test-main-compat.cjs`。完整測試結果：非瀏覽器 63 項、瀏覽器 4 組全部通過；HCR 另外採用本地 R133 原生 wire 函式與 LZString 的 7 組測試亦通過。建置一致性、資料驗證及 diff 空白檢查通過。測試整理理由及重跑方式見 [scripts/README.md](../scripts/README.md)。以上仍屬隔離測試，沒有在真實帳號寫入備份。

## 範圍與方法

以同層 `Bondage-College-Mirror-bondageclub` 本地原碼為準：`Scripts/Game.js:4` 為 R133；CHANGELOG 更新至 2026-10-16。未將網路版本視為本次基準。

檢查本倉庫 Plugins 的 69 個 JavaScript 檔語法、146 處固定字串 Hook/patch 引用，執行既有非瀏覽器測試與資料驗證，並人工追查下列實際程式路徑。固定字串掃描只用於找候選問題，不代表所有動態 Hook、參數及插件組合都經過驗證。外部倉庫／遠端插件不在本次完整檢查範圍。

本次只產出報告，未修改插件、版本或發布產物。

## 需要修改的項目

### 1. 高優先：Chat TtoB 將聊天內容當 HTML，存在注入風險

- 位置：`Plugins/main/Liko - Chat TtoB.main.user.js:242-254`、`:300`、`:373`、`:481-486`；提示框 HTML 寫入在 `:90`。
- `processTextContent` 將房間名稱直接填入雙引號包住的 `data-room-name`，沒有屬性編碼。聊天室的普通文字可以含雙引號；原生以文字顯示，插件卻重新解讀成 HTML。
- 使用原始函式、隔離 VM 與簡單元素替身，輸入 `#x" onmouseenter="globalThis.auditMarker=1#`，實際輸出包含獨立的 `onmouseenter="globalThis.auditMarker=1"` 屬性。這次驗證的是不安全 HTML 的生成，未在登入遊戲中執行事件。
- `showDesc` 使用 innerHTML，且停用時將 dataset/textContent 寫回 outerHTML，亦可能把原本安全的文字重新解讀為標籤。
- 建議：以文字節點為單位轉換，用 createElement、textContent、dataset 建立按鈕；提示框以 DOM 節點建立；還原使用 replaceWith(document.createTextNode(...))。只修正雙引號不足以覆蓋所有入口。

### 2. 中優先：Image Cache 未適配 R133 圖片載入架構

- 位置：`Plugins/main/Liko - Image Cache.main.user.js:481`、`:735-757`。
- 插件主要攔截 HTMLImageElement.src，但 R133 的原生繪圖透過 ImageCache 取得 Blob，再用 createImageBitmap 解碼：`Scripts/ImageCache.js:150`、`Scripts/GLDraw.js:631`、`:679`、`Scripts/Drawing.js:136`。
- 因此原生人物繪圖的主要載入路徑不會經過插件的 src 攔截，不能再假定插件的持久快取覆蓋這些圖片；仍使用 HTMLImageElement 的介面及其他插件可能繼續受益。
- `GLDrawBingImageToTextureInfo` 在 R133 已不存在，掛接會被存在性檢查跳過，並重試約 60 秒。不是立即拋出錯誤，但舊 guard 不會生效。
- 建議：先評估 R133 已內建的 BrowserStorageCache 是否使此插件功能重複；若保留，針對新 ImageCache 路徑設計整合。不能只把舊函式名換成 GLDrawLoadTransient，兩者輸入及回傳契約不同；後者也不是一般 URL 圖片快取入口。

### 3. 中優先：HCR 0.1.3 的回歸測試仍使用 0.1.2 契約

- 位置：`scripts/test-hcr.cjs:9-46`、`:57-61`、`:80`；新版初始化條件在 `Plugins/Hotfix/HCR.user.js:551` 起。
- 實跑第一個失敗是 HCR API 未建立，讀取 version 時拋出 TypeError。測試替身缺少新版要求的 CraftingDeserialize、ServerSend，初始化一直等候。
- 此外測試仍寫死版本 0.1.2，並使用新版已不提供的 backup.encode 與舊單一 p 封包假設；不能只更新版本字串。
- 建議：更新替身與雙組備份格式測試，覆蓋舊格式遷移、刪除不復活、資產晚載入、備份損壞及傳輸大小限制。此測試失敗不等同已證明 HCR 在遊戲中不能運作。

### 4. 中優先：發布目錄 HCR 版本與程式不一致

- 位置：`Plugins.json:605-613` 將 Fix-HCR 標為 0.1.2；`Plugins/Hotfix/HCR.user.js:6`、`:25` 已為 0.1.3。
- `test-pcm-architecture.mjs` 實測失敗（0.1.3 !== 0.1.2）。PCM 目錄顯示與實際執行版本不一致。
- 建議：透過既有產生流程更新目錄與相關文件，並執行 check:build 及測試，避免手動修改產物後再次被覆寫。

### 5. 較低優先：Chat TtoB 銷毀時並未解除 Hook

- 位置：`Plugins/main/Liko - Chat TtoB.main.user.js:496-520`、`:455` 附近。
- hookCleanup 只有 console.log，沒有保存或呼叫 hookFunction 回傳的解除函式；destroyPlugin 卻刪除 instance 標記，使再次載入成為可能。
- 已排程的進房提示 setTimeout 也未納入清理，因此在停用／銷毀／離開後仍可能執行，重載後還可能留下多個 Hook。
- 建議：保存 SDK 回傳的解除函式，清除提示計時器，並在延後回呼確認插件仍啟用及目前畫面。

## 驗證結果與限制

- 69 個 Plugins JavaScript 檔：語法全部通過。
- `npm test`：57 項，55 通過、2 失敗（HCR 測試及目錄版本一致性）。
- `npm run validate`：通過；此檢查不代表產物版本同步。
- `npm run test:browser`：3 個測試均在瀏覽器啟動前失敗，環境缺少 Playwright Chromium executable；沒有據此判定產品有問題。
- 原有 R132 非同步載入回歸、MAT、CMC、CPB、PCM 載入等既有測試通過，但不少測試使用替身，不能取代 R133 遊戲內驗證。
- ECHO 熱修中的舊函式名稱是相容轉接程式的一部分，沒有僅憑字串命中列為失效 Hook。
- 尚需遊戲內檢查：圖片快取命中、聊天按鈕與提示框、插件卸載重載、多插件組合及 HCR 備份恢復。其餘插件未在此次檢查中確認新的阻斷問題，不代表全面保證相容。
