# 共用 i18n：手動同步，單一來源

唯一維護來源：`Plugins/expand/BC_i18n.js`。

各插件保留可獨立建置的本地副本；平常建置及遊戲啟動都不下載引擎最新版。翻譯字庫仍由各插件維護。只有手動同步時才讀取主倉庫 `main`，不需要設定或更新固定版本。

## 一次性安裝

先確認五個專案目前的改動已有備份或提交，再從本倉庫執行：

```powershell
node scripts/install-i18n-sync.mjs "D:\_Data\Documents\GitHub\liko"
```

安裝器會讀取本倉庫的引擎，更新五個專案的副本、接入方式、package scripts、同步工具與兩個工作流程。它不執行 Git 提交、推送或部署。可重複執行。安裝後請在各專案執行既有檢查及建置，檢視差異後提交。

| 專案 | 副本位置 |
|---|---|
| BC-AFC | `src/i18n/engine.js` |
| BC-FCM | `src/i18n/i18n-engine.js` |
| BC-HSC | `src/expansion/BC_i18n.js` |
| BC-LCE | `src/core/i18n-engine.js` |
| BC-Responsive | `src/core/i18n-engine.js` |

HSC 改成靜態 import 引擎，移除獨立下載引擎與重複載入聊天字庫的流程。LCE 以 API 能力判斷相容性，不再比對固定版本字串。同步副本排除各專案的格式重寫；主來源負責驗證，離線雜湊檢查確保副本一致。

## 後續手動同步

先把主倉庫的引擎修改發布至 `main`，再在需要更新的插件目錄執行：

```sh
npm run sync:i18n
npm run check:i18n
npm test
npm run build
```

`sync:i18n` 下載固定來源 URL 的最新內容，先驗證腳本及必要 API，成功後才覆寫副本。連線失敗、HTML 錯誤頁或不完整引擎不會覆寫現有檔案。

`scripts/i18n-source.json` 自動記錄來源、引擎自述版本及 SHA-256；不是版本鎖定設定。`check:i18n` 只比對本地副本與上次同步記錄，不上網，也不會因上游發布新版本而阻擋舊副本建置。副本與記錄一起提交 Git；回退時一起還原。

從本倉庫同步本地尚未發布的引擎，可使用 `node scripts/sync-i18n-clients.mjs`。此命令只更新上述五個專案，不處理 BC-AEE。

## GitHub Actions

安裝器會在各插件新增：

- **Manually sync shared i18n**：只接受 `workflow_dispatch`。在 Actions 手動按 Run workflow，拉取最新引擎，執行副本檢查、現有 lint／格式檢查、測試及建置。通過且有變更才建立新的 `sync/i18n-…` 分支，摘要提供建立 PR 的連結。沒有排程、沒有自動更新 main、沒有直接部署。
- **Verify shared i18n copy**：在 push main／PR 或手動執行時離線檢查副本，不拉取最新內容。

請透過摘要連結自行建立 PR，讓原有 PR 檢查正常觸發。這避免使用 `GITHUB_TOKEN` 自動開 PR 時不觸發其他工作流程的限制，也不需要額外 PAT。既有部署流程保持原樣，合併後依各專案原有流程部署。

首次必須先提交主倉庫新版引擎及各插件安裝結果，才在 GitHub 執行手動同步；遠端尚未發布支援的引擎時，同步驗證會拒絕覆寫。

## 引擎統一行為

- 下載中的請求共用 Promise，失敗可重試；拒絕空白／HTML 腳本，下載有逾時。
- JSON 字庫依 realm、namespace、語言與 URL 分別登記。
- 語言變化由事件與 `refreshLanguage()` 通知，沒有固定輪詢計時器。
- 遠端腳本允許作者的 Pages、GitHub raw、jsDelivr GitHub 路徑及本機開發位址；拒絕其他作者路徑、明文遠端 HTTP 與帳密 URL。
- 國旗選單保留可視視窗定位；LCE 登入頁自己的選單樣式仍由 LCE 維護。

同一頁仍沿用第一個已安裝的引擎，不在運作中強制替換有字庫與監聽器的實例。五個插件完成同步及發布後，重新整理遊戲頁面使用新版；混用尚未更新的舊插件仍可能先載入舊引擎。
