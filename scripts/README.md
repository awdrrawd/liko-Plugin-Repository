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
