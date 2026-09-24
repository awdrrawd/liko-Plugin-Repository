const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({headless: true, channel: process.env.TEST_BROWSER_CHANNEL || undefined});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Serve actual modules and repository data, with no external network requests.
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      let path;
      if (url.hostname === 'editor.test') path = `JSON-Editor/${url.pathname.split('/').at(-1) || 'index.html'}`;
      else if (url.hostname === 'raw.githubusercontent.com') {
        path = url.pathname.endsWith('/sites.json') ? 'Translation-Tool/sites.json' : url.pathname.split('/').at(-1);
      } else return route.abort();
      try {
        const body = readFileSync(resolve(__dirname, '..', path));
        const contentType = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'text/html';
        return route.fulfill({body, contentType});
      } catch { return route.fulfill({status: 404, body: 'Not found'}); }
    });
    await page.goto('https://editor.test/index.html');
    await page.waitForFunction(() => document.querySelector('#fileStatus').textContent.includes('已載入'));
    await page.locator('#formatPreview').click();
    await page.locator('#jsonPreview').fill(JSON.stringify({updateId: 'test', changelog: {cn: [], en: []}}));
    assert.match(await page.locator('#previewValidation').textContent(), /必要欄位正確/);
    await page.locator('#applyPreview').click();
    const downloaded = page.waitForEvent('download');
    await page.locator('#saveFile').click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), 'meta.json');
    assert.equal(JSON.parse(readFileSync(await download.path(), 'utf8')).updateId, 'test');
    await page.locator('#formatPreview').click();
    await page.locator('#jsonPreview').fill(JSON.stringify({updateId: 'test', changelog: {cn: [], en: [42]}}));
    assert.match(await page.locator('#previewValidation').textContent(), /1 個欄位問題/);
    assert.deepEqual(errors, []);
    console.log('JSON editor loads shared validation, previews errors and exports valid data.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
