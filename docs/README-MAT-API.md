# MAT 翻譯 API（v1）

同一頁面中的插件可呼叫 `window.Liko.MAT.translate(text, targetLang, options)`。
`window.Liko.MAT` 是 MAT 的公開物件，`version` 為插件版本字串，`apiVersion` 為介面版本（目前是 `1`）。
API 就緒時會在 window 發出
`liko:mat-ready` 事件；先檢查 API 是否存在，若不存在才等待事件。

```js
async function translateWithMAT(text, targetLang) {
    const api = window.Liko?.MAT;
    if (typeof api?.translate !== 'function') return { translated: null, detectedLang: null, error: 'unavailable' };
    return api.translate(text, targetLang);
}

const result = await translateWithMAT('Hello', 'zh-TW');
if (!result.error) myElement.textContent = result.translated;
```

## 設定與依方向翻譯

以下介面均位於 `window.Liko.MAT`，新增功能沿用相容的 `apiVersion: 1`：

| 介面 | 用途 |
| --- | --- |
| `recvLang` / `sendLang` | 即時讀取接收／發送目標語言 |
| `settingsReady` | 登入設定是否已載入 |
| `getLanguages()` | MAT 設定介面支援的語言代碼副本；設定未就緒時為空陣列 |
| `getHistory()` | 查詢仍在快取中的成功翻譯片段，依完成時間由新到舊回傳副本 |
| `getCachedTranslation(text, targetLang)` | 只查快取，不送請求；完整命中回傳譯文，缺少任一片段或輸入無效則回傳 `null` |
| `translateReceivedText(text, options)` | 使用目前接收語言，遵守總開關與接收開關 |
| `translateSentText(text, options)` | 使用目前發送語言，遵守總開關與發送開關；**不會發送訊息** |

API 不提供設定或開關的修改介面。歷史沿用共用快取，最多 300 個片段、有效 30 分鐘；
不是永久聊天紀錄，不包含失敗紀錄、發話者或 Bio 整篇快取。重新整理後清空。
每筆為 `{ text, targetLang, translated, detectedLang, translatedAt, expiresAt }`，時間為 Unix 毫秒。
重複翻譯命中快取不會新增歷史；查詢歷史或快取不會延長期限或改變淘汰順序。

`liko:mat-ready` 表示 API 可呼叫；登入設定載入後另發出 `liko:mat-settings-ready`。
設定未就緒時，讀取值可能是預設值（`recvLang` 可能為 `null`）；先檢查 `settingsReady`。
依方向翻譯在設定未就緒時回傳 `not_ready`，對應開關停用時回傳 `disabled`。
它們與 `translate()` 共用快取、佇列及回傳格式，不套用聊天室的內容略過規則。

```js
const mat = window.Liko.MAT;
if (mat.settingsReady) {
    console.log(mat.recvLang, mat.sendLang);
    const result = await mat.translateReceivedText('Hello');
    const history = mat.getHistory();
    const cached = mat.getCachedTranslation('Hello', mat.recvLang);
}
```

## 指定語言翻譯的輸入與結果

- `text`：字串，最多 10,000 個 UTF-16 code units（JavaScript 的 `.length`）。
- `targetLang`：Google 翻譯語言代碼，例如 `en`、`ja`、`zh-TW`；API 檢查代碼格式，實際支援由服務端決定。
- 回傳 Promise：成功為 `{ translated, detectedLang }`，失敗為 `{ translated: null, detectedLang: null, error }`。
- 本地錯誤包含 `invalid_argument`、`text_too_long`、`disabled`；網路錯誤包含 `timeout`、`network`、`offline`、`rate_limit`、`blocked`、`http_狀態碼`。
- 空白文字原樣回傳。MAT 停用時不接受 API 翻譯；已排隊項目仍完成。
- `options` 可省略；`{ priority: 'manual' }` 用於使用者主動點擊的翻譯，預設為 `'chat'`，批次或背景工作應使用預設。
- 不套用聊天符號過濾或結巴移除，不插入 UI。呼叫者自行顯示結果及錯誤。
- 回傳結果是副本；快取與內部佇列不公開。此介面供同一頁面 JavaScript 環境使用。

## 快取與排程

所有入口共用「目標語言＋精確原文片段」快取，10 分鐘、300 筆，命中不延長期限。
長文先切成最多 500 字元的片段；相同進行中請求合併，失敗不快取。

Bio 先同步建立整批翻譯項目，再由佇列逐筆請求。順位為手動／整句 > Bio > 聊天／預設外部 API；
已送出的請求會先完成。同優先序依入列順序處理；等待不會因超過 3 秒被丟棄。
取消 Bio 會跳過無其他呼叫者等待的尚未送出項目；已送出的請求仍完成並可寫入快取。
合併請求採有效呼叫者中的最高順位。大量高順位工作可能讓其他呼叫等待較久。

每個片段最多共嘗試 3 次（首次＋2 次重試），請求逾時上限依序為 3／1／1 秒。
失敗後不額外等待 3 秒，直接回到相同順位的佇列尾端；基本請求起始間隔為 300 毫秒，
只有服務端限流（429）才提高全域節流間隔，最高 3 秒。其他結果逐步恢復基本間隔。
5 秒是三次請求的逾時預算總和，不是從呼叫到回傳的總時限；排隊與節流時間另計。
全部失敗才回傳最後一次錯誤，異常或空白的翻譯回應視為 `invalid_response`，不會當成成功快取。
聊天及 Bio 的錯誤提示包含原因與稍後再試，5 分鐘內只提醒一次，這只限制提示，不阻擋新請求。
MAT 手動／整句與選取文字翻譯的最終失敗仍各自顯示；API 呼叫者每次都會收到結果，不受提示冷卻影響。
