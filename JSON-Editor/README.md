# Liko JSON 編輯器

這是一個不需要安裝套件的獨立網頁工具，分別處理 `external.json`、`manifest.json` 與 `meta.json` 的資料結構。

## 使用方式

建議從儲存庫根目錄啟動既有的本機伺服器：

```powershell
node dev/serve-local.mjs
```

再開啟 <http://localhost:5175/JSON-Editor/index.html>。工具預設會直接從
`https://github.com/awdrrawd/liko-Plugin-Repository/tree/main` 讀取三個 JSON，不需要先複製檔案。

「GitHub 儲存庫網址」接受以下格式：

- `https://github.com/awdrrawd/liko-Plugin-Repository/`
- `https://github.com/awdrrawd/liko-Plugin-Repository/tree/main`
- 其他儲存庫、分支或子目錄的同類網址

也能以網址參數指定：

```text
http://localhost:5175/JSON-Editor/index.html?repo=https://github.com/awdrrawd/liko-Plugin-Repository/tree/main
```

也可以直接雙擊 `index.html`；只要能連上網路，一樣可以直接讀取 GitHub。若網路或瀏覽器政策阻擋，再使用「匯入 JSON」選取三個檔案。編輯完成後按「下載此檔」或「下載全部」，再將下載的檔案上傳到儲存庫即可。

## 安全設計

- 表單輸出一律透過 `JSON.stringify` 產生，不會有漏逗號或引號未跳脫的問題。
- 下載前檢查各格式的必要欄位。
- JSON 預覽可供進階修改，解析失敗時不能套用。
- 表單只修改已知欄位，原始資料中的其他欄位會原樣保留。
- 離開尚未下載的頁面前會顯示提醒。
