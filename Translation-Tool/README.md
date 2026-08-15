# Translation Studio 翻譯工作室

The shortcut list in `sites.json` is loaded when `index.html` starts. Adding or removing a shortcut does not require editing the HTML.

`sites.json` 中的捷徑清單會在 `index.html` 啟動時載入。新增或移除捷徑不需要編輯 HTML。

## Add a site 新增站點

Append an item to `sites`:

在 `sites` 中新增一筆項目:

```json
{
  "id": "example",
  "name": "Example Translation",
  "url": "https://github.com/OWNER/REPOSITORY/tree/main/Translation",
  "enabled": true,
  "order": 50
}
```

| Field 欄位 | English | 中文說明 |
| --- | --- | --- |
| `id` | Unique stable identifier; use it in `defaultSite` to make this entry the default. | 唯一且固定的識別碼;在 `defaultSite` 中使用它可將此項目設為預設。 |
| `name` | Label shown in the shortcut selector. | 顯示在捷徑選單中的標籤名稱。 |
| `url` | GitHub translation folder or file URL. | GitHub 上翻譯資料夾或檔案的網址。 |
| `enabled` | Set to `false` to hide an entry without deleting it. | 設為 `false` 可隱藏該項目而不刪除它。 |
| `order` | Lower numbers appear first. | 數字越小,排序越前面。 |

The published page is expected at:

發布後的頁面預期網址為:

`https://awdrrawd.github.io/liko-Plugin-Repository/Translation-Tool/`
