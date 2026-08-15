# Liko JSON Editor 　Liko JSON 編輯器

A standalone, no-install web tool for safely editing `external.json`, `manifest.json`, and `meta.json` through forms — no more hand-editing commas and brackets.

這是一個不需要安裝套件的獨立網頁工具,用表單安全維護 `external.json`、`manifest.json` 與 `meta.json`,不必手動處理逗號與括號。

**Open it online 直接線上開啟:** https://awdrrawd.github.io/liko-Plugin-Repository/JSON-Editor/index.html

> **Note 請注意**: Editing here does **not** change any file in the repository directly. Every change stays in your browser until you click "Download this file" / "Download all" to export the updated JSON — you then submit those downloaded files as a pull request (or upload them) yourself.
> 在這裡編輯**不會**直接修改儲存庫中的檔案。所有變更都只存在瀏覽器裡,必須按「下載此檔」／「下載全部」把更新後的 JSON 匯出,再自行以 Pull Request(或上傳)方式提交那些下載下來的檔案。

## Tabs 分頁

The tool has four tabs, shown in order: `meta`, `manifest`, `external`, `FUSAM` (meta is shown by default).

工具共有四個分頁,依序為 `meta`、`manifest`、`external`、`FUSAM`(預設顯示 meta)。

| Tab 分頁 | English | 中文說明 |
| --- | --- | --- |
| `meta` | Edit the update ID and the Chinese/English changelog entries for this release. | 編輯本次更新的 updateId,以及中文／英文的更新內容(changelog)。 |
| `manifest` | Edit your own repository's `manifest.json` — plugin/addon entries with bilingual name, description, tags, version sources, etc. | 編輯自己儲存庫的 `manifest.json`——插件項目的雙語名稱、說明、標籤、版本來源等。 |
| `external` | Edit `external.json` — external plugin entries with bilingual name/description, stable and beta URLs, priority, etc. | 編輯 `external.json`——外部插件項目,含雙語名稱／說明、正式版與測試版網址、優先順序等。 |
| `FUSAM` | A separate pink-themed workspace for editing the **FUSAM** addon loader's `manifest.json`. See below for details. | 獨立的桃粉色工作區,用於編輯 **FUSAM** 插件載入器的 `manifest.json`,詳見下方說明。 |

## FUSAM support FUSAM 支援

[FUSAM](https://gitlab.com/Sidiousious/bc-addon-loader) is a separate BC addon loader project (hosted on GitLab, not this repository). This tool includes dedicated support for editing its `manifest.json`, making it easy to prepare your plugin submission without touching FUSAM's source directly.

[FUSAM](https://gitlab.com/Sidiousious/bc-addon-loader) 是另一個獨立的 BC 插件載入器專案(託管在 GitLab,不屬於本儲存庫)。這個工具內建了專門編輯 FUSAM `manifest.json` 的功能,讓你不需要直接接觸 FUSAM 原始碼,也能輕鬆準備要提交的插件資料。

- **Auto-load on switch 切換分頁自動載入**: Switching to the FUSAM tab automatically fetches the latest `manifest.json` from `https://gitlab.com/Sidiousious/bc-addon-loader/-/raw/main/manifest.json?ref_type=heads` — no need to enter a URL manually.
  切換至 FUSAM 分頁時,會自動從上述 GitLab 網址載入最新的 `manifest.json`,不需要手動輸入網址。

- **Won't overwrite unsaved edits 不會覆蓋未下載的修改**: If you've already made changes to the FUSAM tab that haven't been downloaded yet, the tool keeps your edits instead of silently reloading over them.
  如果 FUSAM 分頁已有尚未下載的修改,工具會保留你的內容,不會自動覆蓋。

- **Same form-based editing 相同的表單編輯體驗**: FUSAM entries use the same bilingual name/description fields, tags, version sources (`stable` / `beta` / `dev`), and drag-to-reorder as the `manifest` tab, so preparing a FUSAM submission works exactly like editing your own manifest.
  FUSAM 項目使用與 `manifest` 分頁相同的雙語名稱／說明欄位、標籤、版本來源(`stable`／`beta`／`dev`)與拖曳排序功能,準備 FUSAM 提交資料的操作方式與編輯自己的 manifest 完全一致。

- **Correct filename on download 下載時自動使用正確檔名**: Downloading from the FUSAM tab saves the file as `FUSAM-manifest.json` (not `manifest.json`), so it's clear which file is which before you open a merge/pull request.
  從 FUSAM 分頁下載時,檔案會另存為 `FUSAM-manifest.json`(而非 `manifest.json`),方便在提交合併請求前分辨檔案用途。

## Getting started 使用方式

By default, the tool loads the three JSON files directly from `https://github.com/awdrrawd/liko-Plugin-Repository/tree/main`.

工具預設會直接從 `https://github.com/awdrrawd/liko-Plugin-Repository/tree/main` 讀取三個 JSON 檔。

### Running locally instead 改為在本機執行

If you'd rather run it locally, start the existing local server from the repository root:

若想在本機執行,建議從儲存庫根目錄啟動既有的本機伺服器:

```powershell
node dev/serve-local.mjs
```

Then open <http://localhost:5175/JSON-Editor/index.html>.

再開啟 <http://localhost:5175/JSON-Editor/index.html>。

### Accepted repository URL formats 接受的儲存庫網址格式

The "GitHub repository URL" field accepts:

「GitHub 儲存庫網址」欄位接受以下格式:

- `https://github.com/awdrrawd/liko-Plugin-Repository/`
- `https://github.com/awdrrawd/liko-Plugin-Repository/tree/main`
- Equivalent URLs for other repositories, branches, or subdirectories
  其他儲存庫、分支或子目錄的同類網址
- A single GitHub or GitLab `manifest.json` blob URL
  GitHub 或 GitLab 的單一 `manifest.json` blob 網址

GitLab blob/raw URLs are automatically converted to the GitLab API endpoint, which supports cross-origin requests from the browser.

GitLab 的 blob／raw 網址會自動改用具備瀏覽器跨來源支援的 GitLab API 端點。

You can also specify the repository via a URL parameter:

也能以網址參數指定:

```text
http://localhost:5175/JSON-Editor/index.html?repo=https://github.com/awdrrawd/liko-Plugin-Repository/tree/main
```

You can also just double-click `index.html` directly — as long as you're online, it can still load from GitHub the same way. If network access or browser policy blocks it, use "Import JSON" to select the three files manually instead.

也可以直接雙擊 `index.html`;只要能連上網路,一樣可以直接讀取 GitHub。若網路或瀏覽器政策阻擋,再使用「匯入 JSON」選取三個檔案。

## Safety design 安全設計

| Feature 功能 | English | 中文說明 |
| --- | --- | --- |
| Clean JSON output 乾淨的 JSON 輸出 | Form output is always generated via `JSON.stringify`, so there's no risk of missing commas or unescaped quotes. | 表單輸出一律透過 `JSON.stringify` 產生,不會有漏逗號或引號未跳脫的問題。 |
| Drag to reorder 拖曳調整順序 | `external.json` and `manifest.json` entries can be reordered by dragging plugin cards in the sidebar. | `external.json` 與 `manifest.json` 可直接拖曳左側插件卡片調整輸出順序。 |
| Flexible bilingual fields 彈性的雙語欄位 | Manifest name/description fields accept either a plain string or `{cn, en}`; version sources support `stable`, `beta`, and `dev`. | Manifest 的名稱與說明同時相容純字串及 `{cn, en}`,版本來源支援 `stable`、`beta`、`dev`。 |
| Pre-download validation 下載前驗證 | Required fields for each format are checked before download; you're warned if anything is missing. | 下載前檢查各格式的必要欄位,若有缺漏會顯示提醒。 |
| Raw JSON preview 原始 JSON 預覽 | An advanced JSON preview/edit dialog is available; invalid JSON can't be applied. | JSON 預覽可供進階修改,解析失敗時不能套用。 |
| Preserves unknown fields 保留未知欄位 | The form only touches known fields — any other fields already in the source data are kept as-is. | 表單只修改已知欄位,原始資料中的其他欄位會原樣保留。 |
| Unsaved-changes warning 未下載提醒 | You'll be warned before leaving the page if there are unsaved (not-yet-downloaded) changes. | 離開尚未下載的頁面前會顯示提醒。 |