# 插件清單維護說明

清單資料只手動維護 **來源檔**，`Plugins.json` 由建置腳本產生，不要手改。

## 檔案分工

| 檔案 | 手改? | 內容 | 誰讀 |
|---|---|---|---|
| `manifest.json` | ✍️ | Liko 自己的 mod（FUSAM 標準欄位 + 自訂 PCM 欄位） | BMM / FUSAM 等第三方 **＋** 本專案建置器 |
| `external.json` | ✍️ | 其他作者的插件 + Hotfix（PCM-only，不發佈到 FUSAM） | 只有建置器 |
| `meta.json` | ✍️ | `updateId` + 更新日誌 changelog（cn/en） | 只有建置器 |
| `Plugins.json` | 🤖 產生 | 上面三份合併後的 PCM 清單 | PCM |

只手動維護 **三份** 來源：自己的插件（manifest）、別人的插件（external）、更新信息（meta），
再 build 成一份 `Plugins.json` 給 PCM。

## 改完任何來源檔後

```bash
npm run build
```

會依序建置 PCM、合併清單並解析版本，最後產生 README 與網站。

- PCM 核心只有 `src/pcm/compat/core.js` 一份來源，ESM 與單檔版皆由建置產生。
- PCM 與加載器版本維護於 `src/pcm/release.js`；userscript 標頭維護於 `src/pcm/userscripts.json`。
- 清單的本倉庫版本從實際檔案的 `@version` 取得，支援 Pages、raw GitHub、jsDelivr 網址；外部來源保留清單設定的版本。
- 舊命令 `node .github/scripts/update-versions.mjs` 現在會呼叫同一份清單建置，不再另外改寫版本。
- 單獨產生清單可用 `npm run build:catalog`；提交前執行 `npm run build` 和 `npm run test:pcm`。

CI 已整合成單一建置流程，避免多個工作同時推送不同產物。

## 測試維護（2026-10-18 檢查）

先建置再跑 `npm test`，因為目錄版本一致性測試會比較實際腳本與產物；最後執行 `npm run check:build`。瀏覽器測試另用 `npm run test:browser`，不連接真實遊戲帳號。

| 測試 | 本次處理與保留理由 |
|---|---|
| `test-hcr.cjs` | 重寫舊 0.1.2 fixture；移除不存在的 `backup.encode`、單一 `p` 備份及版本標記遷移假設。改成 7 組行為測試：雙組備份、刪除不復活、缺失資產、位置衝突、失敗重試、損壞／大小限制與晚載入。版本由腳本 metadata 讀取。 |
| `test-main-compat.cjs` | 原 `test-main-r132.cjs` 改名。等待原生載入、離開畫面取消後處理與錯誤傳遞仍適用；版本名稱過時不代表案例過時。這是隔離回歸測試，不是完整 R133 相容性認證。 |
| `test-chat-ttob.cjs` | 新增必要的真實 DOM 安全與卸載回歸測試，載入本倉庫實際 bcmodsdk，驗證文字不變成 HTML、原生節點保留、按鈕操作、計時器及登入前／載入中銷毀重載。 |
| `test-mat-*.cjs`（9 個） | 保留。快取、排程、重試、網路逾時、回覆、捲動、URL 過濾、設定 API 與手動翻譯競態是不同契約，沒有因檔案多就合併或刪除。 |
| PCM、目錄／發布、聊天系統、CMC／CPB、Tool／DDT、媒體與編輯器 | 保留。單元測試與瀏覽器測試分別驗證狀態及 DOM／操作行為；目錄版本測試此次確實找出 HCR 版本未同步。 |

本次 `npm test` 63 項通過，約一秒內完成；瀏覽器 4 組通過。沒有足以支持大量刪除測試的耗時或重複證據。部分既有測試從原始碼擷取函式片段，重構時可能需要同步調整；這是維護限制，不能只因失敗就移除案例。

HCR 可選擇使用本地 BC 的**實際序列化、反序列化、載入、儲存及 LZString** 重跑相同案例（驗證器與網路仍是隔離替身；CI 不依賴旁邊的 BC 倉庫）：

```powershell
$env:BC_SOURCE_ROOT = (Resolve-Path '../Bondage-College-Mirror-bondageclub').Path
node --test scripts/test-hcr.cjs
```

瀏覽器測試預設使用 Playwright Chromium；也可使用已安裝的 Edge：

```powershell
$env:TEST_BROWSER_CHANNEL = 'msedge'
npm run test:browser
```

瀏覽器缺失或沙箱阻止啟動屬於環境錯誤，不應刪除測試或改成無條件跳過。本次以獨立暫存設定檔的無頭 Edge 完成驗證，沒有使用使用者登入資料。

## 登入更新提示（changelog）

「登入說明」＝更新日誌。資料只寫在 `meta.json`，build 進 `Plugins.json` 的 `changelog`/`en_changelog`。
PCM 依 `updateId` 變化時自動彈出一次（`checkVersionUpdate`），彈過就不再彈；沒更新完全不彈。
要重新提示所有人，就把 `meta.json` 的 `updateId` 換新值。管理器內 📋 按鈕可隨時手動再看。

## manifest.json 欄位

**FUSAM 標準（第三方會讀）**：`id`、`name`/`description`（`{cn,en}` 物件）、`author`、
`repository`、`website`、`tags`、`type`（`module`/`script`/`eval`）、`icon`（圖片 URL）、
`versions[{distribution,source}]`、`noCacheBusting`。

**自訂欄位（第三方會自動忽略，只有建置器讀）**：
- `iemoji` — PCM 清單用的 emoji（`icon` 是圖片 URL，emoji 放這）
- `priority` — PCM 排序
- `version` — PCM 版本號
- `additionalInfo` — `{cn,en}`，PCM 的補充說明
- `mirror` — `{stable,beta}` 備援來源（對應 PCM 的 mirrorUrl/altMirrorUrl）
- `triLabels` — 三段開關標籤
- `pcmskip: true` — 發佈到 FUSAM 但**不**出現在 PCM 清單

## 載入方式對照（manifest → PCM）

| manifest `type` | PCM 載入方式 |
|---|---|
| `module` | `mod`（dynamic import） |
| `script` | `scr`（`<script src>`） |
| `eval`（或省略） | 預設 eval（fetch 文字後注入） |
