# 建置與自動檢查

可以直接推送 `main`，不需要先建立 PR，也不需要先提交建置產物。其他插件仍可維持 `Plugins/` 下的單檔形式。

每次推送 main、建立／更新 PR 或手動執行 workflow，都會先建置、驗證來源資料和本倉庫的插件下載路徑，再執行所有 Node 測試、乾淨重建一致性檢查及三支 Chromium 測試。外部插件不會在 CI 中下載或執行。

驗證成功後，只有 main 的執行會重新建置並自動提交生成檔。若 main 已有更新，舊執行跳過回寫，交由新執行處理；不會強制推送或把舊產物 rebase 到新來源。檢查失敗不會回寫生成檔，但不會撤銷已經推送的來源 commit。

驗證 job 只有讀取權限；回寫 job 才有 `contents: write`。倉庫需允許 GitHub Actions 寫入 main。使用內建 `GITHUB_TOKEN` 的回寫不會再次觸發 push workflow。

## 本機指令

```sh
npm ci
npm run build
npm test
npm run check:build
npx playwright install chromium
npm run test:browser
```

`npm run validate` 可單獨檢查四份來源資料。首次從沒有產物的環境開始，先執行 `npm run build`。

`npm test` 自動收集 `scripts/test-*.cjs` 與 `scripts/test-*.mjs`，瀏覽器測試另由 `test:browser` 執行。新增瀏覽器測試時，需更新 `scripts/run-tests.mjs` 的清單。可用 `TEST_BROWSER_CHANNEL=msedge` 選用本機 Edge，CI 預設使用 Playwright 安裝的 Chromium。

來源資料驗證器位於 `JSON-Editor/validation.js`，編輯器與建置共用。它檢查編輯格式；PCM 執行期另驗證遠端清單格式。單檔插件的版本仍從檔頭 `@version` 讀取。

`scripts/lib/artifacts.mjs` 集中定義回寫和重建檢查的產物。乾淨重建在暫存目錄執行，不刪除工作區檔案，也不要求 PR 提前提交產物。請勿手動修改生成檔。

`.github/scripts/update-versions.mjs` 保留為舊指令的相容入口，呼叫相同的清單建置流程，不再有獨立的版本回寫 workflow。

