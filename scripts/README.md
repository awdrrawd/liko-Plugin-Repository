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
node scripts/build.mjs
```

會用 `manifest.json` + `external.json` + `meta.json` 重新產生 `Plugins.json`。

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
