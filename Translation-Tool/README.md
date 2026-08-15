# Translation Studio 翻譯工作室

A browser-based tool for translating BC plugin dictionaries — no setup, no build step, everything runs locally in your browser.

一個純瀏覽器操作的插件字庫翻譯工具 — 不需安裝、不需編譯,所有資料都只在你的瀏覽器裡處理。

**Try it here 立即使用:** https://awdrrawd.github.io/liko-Plugin-Repository/Translation-Tool/

## What it does 這個工具能做什麼

| Feature 功能 | English | 中文說明 |
| --- | --- | --- |
| Load from GitHub 從 GitHub 載入 | Paste a GitHub `tree`, `blob`, `raw`, or GitHub Pages URL, or pick a preset plugin repo from the dropdown. The tool downloads every translation file it finds. | 貼上 GitHub 的 tree、blob、raw 或 Pages 網址,或直接從下拉選單選擇預設插件庫,工具會自動下載找到的所有翻譯檔案。 |
| Side-by-side comparison 逐項對照 | Pick a source language and a target language; every string is shown in a two-column table so you can translate key by key. | 選擇來源語言與目標語言,所有字串會以雙欄表格逐一列出,方便逐項比對翻譯。 |
| Search & filter 搜尋與篩選 | Search by key or text, and filter to show only blank, possibly-untranslated (identical to source), placeholder-error, or completed entries. | 可依 key 或文字內容搜尋,並篩選出「空白未翻譯」「疑似未翻譯(與來源相同)」「佔位符錯誤」或「已完成」的項目。 |
| Placeholder checking 佔位符檢查 | Automatically flags entries where `{placeholder}` tokens in the translation don't match the source, so nothing breaks at runtime. | 自動偵測翻譯內的 `{placeholder}` 佔位符是否與來源一致,避免程式執行時出錯。 |
| Add a new language 新增語言 | Create a brand-new language column in one click, using a built-in reference list of language codes. | 一鍵建立新的語言欄位,並附有內建語言代碼對照表可查詢。 |
| Progress tracking 進度追蹤 | Live counters for total strings, translated, untranslated, and placeholder issues, plus a progress bar. | 即時顯示總字串數、已翻譯數、未翻譯數與佔位符問題數,並附進度條。 |
| Export JSON 匯出 JSON | Export the finished translation as a single-language JSON file, ready to submit as a pull request. | 將完成的翻譯匯出成單一語言的 JSON 檔,可直接用於提交 Pull Request。 |
| Multilingual interface 多語介面 | The tool's own interface supports English, Traditional/Simplified Chinese, Japanese, Korean, and several European languages. | 工具介面本身支援英文、繁體/簡體中文、日文、韓文及多種歐洲語言。 |

## How to use it 使用方式

1. Open the published page (link above) or run `index.html` locally.
   開啟上方連結,或在本機開啟 `index.html`。
2. Choose a preset plugin repository, or paste a GitHub URL pointing to a translation folder/file.
   從下拉選單選擇預設插件庫,或貼上指向翻譯資料夾/檔案的 GitHub 網址。
3. Set the **source language** (what you're translating from) and **target language** (what you're translating into).
   設定「來源語言」(翻譯的原文)與「目標語言」(要翻成的語言)。
4. Fill in translations directly in the target column. Rows with placeholder mismatches are highlighted automatically.
   直接在目標欄位輸入翻譯內容,佔位符不一致的項目會自動標示。
5. Click **Export JSON** to download the finished translation file, then submit it as a pull request to the relevant plugin repository.
   點擊「匯出 JSON」下載完成的翻譯檔,再提交 Pull Request 到對應的插件儲存庫。

## Notes 補充說明

- All processing happens client-side in your browser — no data is uploaded anywhere.
  所有處理都在瀏覽器端進行,不會上傳任何資料到伺服器。
- Which repositories appear in the preset dropdown is controlled by `sites.json` in this same folder — see that file if you want to add your own plugin repo to the list.
  下拉選單中顯示哪些預設插件庫,是由同資料夾中的 `sites.json` 控制;若想把自己的插件庫加入清單,可參考該檔案。
