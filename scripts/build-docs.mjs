import { readFileSync, writeFileSync } from 'node:fs';

const plugins = JSON.parse(readFileSync('Plugins.json', 'utf8')).plugins;
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8')).addons;
const tagMap = new Map(manifest.map((plugin) => [plugin.id, plugin.tags ?? []]));

const categoryOf = (plugin) => {
  if (plugin.id.startsWith('Fix-')) return 'hotfix';
  if (plugin.id.startsWith('Liko-')) return 'liko';
  return 'community';
};

const groups = {
  liko: plugins.filter((plugin) => categoryOf(plugin) === 'liko'),
  community: plugins.filter((plugin) => categoryOf(plugin) === 'community'),
  hotfix: plugins.filter((plugin) => categoryOf(plugin) === 'hotfix'),
};

const iconOf = (plugin) => {
  const icon = plugin.iemoji || plugin.icon;
  return icon && !/^https?:/i.test(icon) ? icon : '🐈‍⬛';
};

const md = (value = '') => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const tableRows = (items) => items.map((plugin) => {
  const english = plugin.en_name && plugin.en_name !== plugin.name
    ? `<br><sub>${md(plugin.en_name)}</sub>`
    : '';
  const version = plugin.version ? `v${md(plugin.version)}` : '持續更新';
  const extra = plugin.additionalInfo ? `<br><sub>${md(plugin.additionalInfo)}</sub>` : '';
  const website = plugin.website ? ` · [專案網站](${plugin.website})` : '';
  return `| ${iconOf(plugin)} **${md(plugin.name)}**${english}<br>\`${md(plugin.id)}\` | ${md(plugin.description)}${extra} | ${version} | [安裝](${plugin.url})${website} |`;
}).join('\n');

const readme = `<div align="center">

<img src="Images/PCM_ICON.png" alt="PCM icon" width="160">

# Plugin Collection Manager（PCM）

[![PCM](https://img.shields.io/badge/PCM-v2.2.0-9F7AEA?style=for-the-badge)](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js)
[![License](https://img.shields.io/badge/License-MIT-C084FC?style=for-the-badge)](LICENSE)

集中安裝、啟用與管理 Bondage Club 插件。建議優先使用 PCM；也保留書籤、控制台及單獨安裝方式。

[立即安裝 PCM](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js) · [瀏覽插件網站](https://awdrrawd.github.io/liko-Plugin-Repository/)

</div>

## 安裝 PCM

### 推薦：腳本管理器

安裝 Tampermonkey、Violentmonkey 或 Userscripts 後，點擊下方連結即可安裝並自動更新 PCM：

### [👉 點此安裝 PCM](https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js)

進入遊戲後可輸入 \`/pcm help\` 查看說明，或輸入 \`/pcm list\` 查看插件狀態。

### 其他載入方式

#### 書籤

建立新書籤，將下列內容貼到書籤網址：

\`\`\`javascript
javascript:(function(){var s=document.createElement('script');s.src='https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?'+Date.now();s.type='text/javascript';s.crossOrigin='anonymous';document.head.appendChild(s)})();
\`\`\`

#### 瀏覽器控制台

開啟開發者工具，在 Console 貼上：

\`\`\`javascript
import(\`https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?v=\${(Date.now() / 10000).toFixed(0)}\`);
\`\`\`

#### 單獨安裝插件

如果不使用 PCM，可直接點擊下方插件表格中的「安裝」，或前往 [Plugins](./Plugins) 選擇個別腳本。

## 插件收藏

目前收錄 ${plugins.length} 款插件：${groups.liko.length} 款 Liko 插件、${groups.community.length} 款社群插件與 ${groups.hotfix.length} 款修正補丁，涵蓋聊天室、外觀、互動、媒體、介面優化與開發輔助。

### Liko 插件

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
${tableRows(groups.liko)}

### 社群插件

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
${tableRows(groups.community)}

### 修正補丁

| 插件 | 功能介紹 | 版本 | 連結 |
|---|---|---:|---|
${tableRows(groups.hotfix)}

## 開發參考

- [BC 插件開發指南](docs/BC插件開發指南.md)
- [自訂捲軸與拖曳捲動指南](docs/自訂捲軸與拖曳捲動指南.md)

## 授權

[MIT License](LICENSE)
`;

const publicPlugins = plugins.map((plugin) => ({
  id: plugin.id,
  name: plugin.name,
  enName: plugin.en_name || plugin.name,
  description: plugin.description,
  enDescription: plugin.en_description || plugin.description,
  additionalInfo: plugin.additionalInfo || '',
  enAdditionalInfo: plugin.en_additionalInfo || '',
  version: plugin.version || '',
  icon: plugin.icon || '',
  emoji: iconOf(plugin),
  url: plugin.url,
  website: plugin.website || '',
  category: categoryOf(plugin),
  tags: tagMap.get(plugin.id) || [],
}));

const embeddedPlugins = JSON.stringify(publicPlugins).replaceAll('<', '\\u003c');

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Liko 的 Bondage Club 插件收藏庫：探索聊天室、外觀、互動、媒體與工具插件。">
  <meta name="theme-color" content="#120f1e">
  <title>Liko Plugin Repository</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d0b14;
      --panel: rgba(27, 23, 42, .82);
      --panel-strong: #211b34;
      --line: rgba(196, 181, 253, .16);
      --text: #f5f1ff;
      --muted: #aaa2bc;
      --violet: #a78bfa;
      --pink: #f0abfc;
      --cyan: #67e8f9;
      --shadow: 0 24px 70px rgba(0, 0, 0, .35);
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 14% 4%, rgba(124, 58, 237, .24), transparent 30rem),
        radial-gradient(circle at 88% 24%, rgba(217, 70, 239, .12), transparent 25rem),
        var(--bg);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    a { color: inherit; }
    button, input { font: inherit; }
    .shell { width: min(1180px, calc(100% - 32px)); margin: auto; }
    .topbar {
      position: sticky; top: 0; z-index: 20;
      border-bottom: 1px solid var(--line);
      background: rgba(13, 11, 20, .76);
      backdrop-filter: blur(18px);
    }
    .nav { min-height: 66px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; text-decoration: none; letter-spacing: -.02em; }
    .brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid var(--line); border-radius: 13px; background: var(--panel); }
    .nav-actions { display: flex; align-items: center; gap: 8px; }
    .nav-link, .lang-button {
      border: 1px solid var(--line); border-radius: 999px; padding: 9px 13px;
      color: var(--muted); background: rgba(255,255,255,.025); text-decoration: none; cursor: pointer;
    }
    .nav-link:hover, .lang-button:hover { color: var(--text); border-color: rgba(167,139,250,.55); }
    .hero { padding: 78px 0 54px; text-align: center; }
    .pcm-icon { width: clamp(118px, 18vw, 168px); height: auto; margin-bottom: 22px; filter: drop-shadow(0 20px 38px rgba(124,58,237,.34)); }
    .eyebrow { margin: 0 0 16px; color: var(--cyan); font-size: .78rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    h1 { max-width: 980px; margin: 0 auto; font-size: clamp(2.7rem, 7vw, 6rem); line-height: .96; letter-spacing: -.06em; }
    .gradient { color: transparent; background: linear-gradient(110deg, var(--violet), var(--pink) 55%, var(--cyan)); background-clip: text; }
    .lead { max-width: 720px; margin: 25px auto 0; color: var(--muted); font-size: clamp(1.05rem, 2.2vw, 1.35rem); line-height: 1.7; }
    .hero-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 28px; }
    .hero-actions .button { min-height: 48px; padding-inline: 20px; }
    .stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 34px; }
    .stat { min-width: 132px; padding: 15px 18px; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); }
    .stat strong { display: block; font-size: 1.55rem; }
    .stat span { color: var(--muted); font-size: .82rem; }
    .catalog { padding: 42px 0 86px; }
    .catalog-head { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
    h2 { margin: 0; font-size: clamp(2rem, 4vw, 3.2rem); letter-spacing: -.045em; }
    .result-count { color: var(--muted); }
    .controls { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 12px; margin-bottom: 18px; }
    .search { width: 100%; min-height: 48px; border: 1px solid var(--line); border-radius: 15px; padding: 0 17px; color: var(--text); background: var(--panel); outline: none; }
    .search:focus { border-color: var(--violet); box-shadow: 0 0 0 3px rgba(167,139,250,.13); }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; }
    .filter { border: 1px solid var(--line); border-radius: 14px; padding: 0 15px; color: var(--muted); background: var(--panel); cursor: pointer; }
    .filter:hover, .filter.active { color: #120f1e; border-color: var(--violet); background: var(--violet); }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .card {
      display: flex; flex-direction: column; min-height: 285px; padding: 22px;
      border: 1px solid var(--line); border-radius: 23px; background: linear-gradient(155deg, rgba(35,29,55,.9), rgba(22,18,34,.84));
      box-shadow: 0 1px 0 rgba(255,255,255,.025) inset; transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
    }
    .card:hover { transform: translateY(-4px); border-color: rgba(167,139,250,.48); box-shadow: var(--shadow); }
    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .icon { display: grid; place-items: center; flex: 0 0 auto; width: 50px; height: 50px; border: 1px solid var(--line); border-radius: 15px; background: rgba(255,255,255,.04); font-size: 1.5rem; overflow: hidden; }
    .icon img { width: 100%; height: 100%; object-fit: cover; }
    .version { color: var(--cyan); font: 700 .73rem ui-monospace, SFMono-Regular, Consolas, monospace; }
    .card h3 { margin: 18px 0 6px; font-size: 1.18rem; line-height: 1.35; }
    .en-name { min-height: 1.2em; margin: 0 0 14px; color: var(--muted); font-size: .8rem; }
    .description { margin: 0; color: #d5cee2; line-height: 1.65; }
    .extra { margin: 12px 0 0; padding: 10px 12px; border-left: 2px solid var(--pink); color: var(--muted); background: rgba(240,171,252,.05); font-size: .86rem; line-height: 1.5; }
    .meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
    .chip { border: 1px solid var(--line); border-radius: 999px; padding: 4px 8px; color: var(--muted); font-size: .72rem; }
    .card-actions { display: flex; gap: 8px; margin-top: auto; padding-top: 20px; }
    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid var(--line); border-radius: 12px; padding: 0 13px; color: var(--text); text-decoration: none; font-size: .88rem; font-weight: 750; }
    .button.primary { color: #130f1e; border-color: var(--violet); background: linear-gradient(120deg, var(--violet), var(--pink)); }
    .button:hover { filter: brightness(1.1); }
    .empty { grid-column: 1 / -1; padding: 64px 20px; border: 1px dashed var(--line); border-radius: 22px; color: var(--muted); text-align: center; }
    .install { padding: 20px 0 72px; }
    .install-box { display: grid; grid-template-columns: 1.2fr .8fr; gap: 24px; padding: 30px; border: 1px solid var(--line); border-radius: 27px; background: var(--panel); }
    .install p { color: var(--muted); line-height: 1.7; }
    .install-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 10px; }
    .methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
    .method { padding: 20px; border: 1px solid var(--line); border-radius: 20px; background: rgba(27,23,42,.58); }
    .method h3 { margin: 0 0 8px; }
    .method p { margin: 0; font-size: .9rem; }
    details { margin-top: 14px; }
    summary { color: var(--violet); cursor: pointer; font-weight: 700; }
    pre { margin: 12px 0 0; padding: 13px; overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; color: #ddd6fe; background: #0b0911; font: .72rem/1.6 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
    footer { padding: 24px 0 42px; border-top: 1px solid var(--line); color: var(--muted); font-size: .86rem; }
    footer .shell { display: flex; justify-content: space-between; gap: 18px; }
    @media (max-width: 920px) { .grid { grid-template-columns: repeat(2, minmax(0,1fr)); } .install-box { grid-template-columns: 1fr; } .install-actions { justify-content: flex-start; } .methods { grid-template-columns: 1fr; } }
    @media (max-width: 650px) { .shell { width: min(100% - 22px, 1180px); } .nav-link.hide-mobile { display: none; } .hero { padding-top: 66px; } .controls { grid-template-columns: 1fr; } .filters { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; } .filter { min-height: 42px; white-space: nowrap; } .grid { grid-template-columns: 1fr; } .catalog-head { align-items: start; flex-direction: column; gap: 8px; } footer .shell { flex-direction: column; } }
  </style>
</head>
<body>
  <header class="topbar">
    <nav class="shell nav" aria-label="主選單">
      <a class="brand" href="#top"><span class="brand-mark">🐈‍⬛</span><span>Liko Plugins</span></a>
      <div class="nav-actions">
        <a class="nav-link hide-mobile" href="#install" data-t="navInstall">安裝</a>
        <a class="nav-link hide-mobile" href="#plugins" data-t="navPlugins">插件</a>
        <a class="nav-link" href="https://github.com/awdrrawd/liko-Plugin-Repository" target="_blank" rel="noreferrer">GitHub ↗</a>
        <button class="lang-button" id="language" type="button" aria-label="Switch language">EN</button>
      </div>
    </nav>
  </header>

  <main id="top">
    <section class="hero shell">
      <img class="pcm-icon" src="Images/PCM_ICON.png" alt="PCM">
      <p class="eyebrow" data-t="eyebrow">Liko 的插件管理器</p>
      <h1>Plugin Collection<br><span class="gradient">Manager</span></h1>
      <p class="lead" data-t="lead">集中安裝、啟用與管理 Bondage Club 插件。推薦先安裝 PCM，再從收藏庫挑選你需要的功能。</p>
      <div class="hero-actions">
        <a class="button primary" href="https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js" data-t="installNow">立即安裝 PCM</a>
        <a class="button" href="#install" data-t="otherMethods">其他安裝方式</a>
      </div>
      <div class="stats" aria-label="插件統計">
        <div class="stat"><strong>${plugins.length}</strong><span data-t="statAll">全部插件</span></div>
        <div class="stat"><strong>${groups.liko.length}</strong><span data-t="statLiko">Liko 插件</span></div>
        <div class="stat"><strong>${groups.community.length}</strong><span data-t="statCommunity">社群插件</span></div>
        <div class="stat"><strong>${groups.hotfix.length}</strong><span data-t="statHotfix">修正補丁</span></div>
      </div>
    </section>

    <section class="install shell" id="install">
      <div class="install-box">
        <div>
          <p class="eyebrow" data-t="installEyebrow">推薦安裝方式</p>
          <h2 data-t="installTitle">先安裝 PCM，再選擇插件。</h2>
          <p data-t="installText">使用 Tampermonkey、Violentmonkey 或 Userscripts 開啟安裝連結。進入遊戲後輸入 /pcm help 查看說明，或使用 /pcm list 查看插件狀態。</p>
        </div>
        <div class="install-actions">
          <a class="button primary" href="https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js" data-t="installPcm">安裝 PCM</a>
          <a class="button" href="https://github.com/awdrrawd/liko-Plugin-Repository" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </div>
      <div class="methods">
        <article class="method">
          <h3 data-t="bookmarkTitle">🔖 書籤載入</h3>
          <p data-t="bookmarkText">不使用腳本管理器時，可建立一個載入 PCM 的書籤。</p>
          <details><summary data-t="showCode">顯示程式碼</summary><pre>javascript:(function(){var s=document.createElement('script');s.src='https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?'+Date.now();s.type='text/javascript';s.crossOrigin='anonymous';document.head.appendChild(s)})();</pre></details>
        </article>
        <article class="method">
          <h3 data-t="consoleTitle">⌨️ 控制台載入</h3>
          <p data-t="consoleText">開啟開發者工具，在 Console 貼上載入指令。</p>
          <details><summary data-t="showCode">顯示程式碼</summary><pre>import(\`https://awdrrawd.github.io/liko-Plugin-Repository/PCM_Loader.user.js?v=\${(Date.now()/10000).toFixed(0)}\`);</pre></details>
        </article>
        <article class="method">
          <h3 data-t="singleTitle">🧩 單獨安裝</h3>
          <p data-t="singleText">不使用 PCM 時，仍可從插件卡片直接安裝個別腳本。</p>
          <div class="card-actions"><a class="button" href="#plugins" data-t="browsePlugins">瀏覽插件</a></div>
        </article>
      </div>
    </section>

    <section class="catalog shell" id="plugins">
      <div class="catalog-head">
        <div><p class="eyebrow" data-t="catalogEyebrow">完整收藏</p><h2 data-t="catalogTitle">探索插件</h2></div>
        <div class="result-count" id="result-count"></div>
      </div>
      <div class="controls">
        <input class="search" id="search" type="search" autocomplete="off" data-placeholder="search" placeholder="搜尋名稱、功能或 ID…">
        <div class="filters" role="group" aria-label="插件分類">
          <button class="filter active" type="button" data-filter="all" data-t="filterAll">全部</button>
          <button class="filter" type="button" data-filter="liko" data-t="filterLiko">Liko</button>
          <button class="filter" type="button" data-filter="community" data-t="filterCommunity">社群</button>
          <button class="filter" type="button" data-filter="hotfix" data-t="filterHotfix">補丁</button>
        </div>
      </div>
      <div class="grid" id="grid"></div>
    </section>

  </main>

  <footer><div class="shell"><span>© Liko Plugin Repository</span><span>MIT License</span></div></footer>

  <script>
    const plugins = ${embeddedPlugins};
    const copy = {
      zh: {
        navPlugins: '插件', navInstall: '安裝', eyebrow: 'Liko 的插件管理器',
        lead: '集中安裝、啟用與管理 Bondage Club 插件。推薦先安裝 PCM，再從收藏庫挑選你需要的功能。', installNow: '立即安裝 PCM', otherMethods: '其他安裝方式',
        statAll: '全部插件', statLiko: 'Liko 插件', statCommunity: '社群插件', statHotfix: '修正補丁',
        catalogEyebrow: '完整收藏', catalogTitle: '探索插件', filterAll: '全部', filterLiko: 'Liko', filterCommunity: '社群', filterHotfix: '補丁',
        search: '搜尋名稱、功能或 ID…', count: (n) => \`顯示 \${n} 款插件\`, empty: '沒有符合條件的插件。',
        install: '安裝', project: '專案網站', details: '補充',
        installEyebrow: '推薦安裝方式', installTitle: '先安裝 PCM，再選擇插件。', installText: '使用 Tampermonkey、Violentmonkey 或 Userscripts 開啟安裝連結。進入遊戲後輸入 /pcm help 查看說明，或使用 /pcm list 查看插件狀態。', installPcm: '安裝 PCM',
        bookmarkTitle: '🔖 書籤載入', bookmarkText: '不使用腳本管理器時，可建立一個載入 PCM 的書籤。', consoleTitle: '⌨️ 控制台載入', consoleText: '開啟開發者工具，在 Console 貼上載入指令。', singleTitle: '🧩 單獨安裝', singleText: '不使用 PCM 時，仍可從插件卡片直接安裝個別腳本。', showCode: '顯示程式碼', browsePlugins: '瀏覽插件'
      },
      en: {
        navPlugins: 'Plugins', navInstall: 'Install', eyebrow: "Liko's plugin manager",
        lead: 'Install, enable, and manage Bondage Club plugins in one place. Start with PCM, then choose the features you want from the collection.', installNow: 'Install PCM', otherMethods: 'Other install methods',
        statAll: 'All plugins', statLiko: 'Liko plugins', statCommunity: 'Community', statHotfix: 'Hotfixes',
        catalogEyebrow: 'The full collection', catalogTitle: 'Explore plugins', filterAll: 'All', filterLiko: 'Liko', filterCommunity: 'Community', filterHotfix: 'Hotfixes',
        search: 'Search by name, feature, or ID…', count: (n) => \`Showing \${n} plugins\`, empty: 'No plugins match your search.',
        install: 'Install', project: 'Project site', details: 'Note',
        installEyebrow: 'Recommended setup', installTitle: 'Install PCM, then choose your plugins.', installText: 'Open the installer with Tampermonkey, Violentmonkey, or Userscripts. In game, enter /pcm help for instructions or /pcm list to view plugin status.', installPcm: 'Install PCM',
        bookmarkTitle: '🔖 Bookmark loader', bookmarkText: 'Create a bookmark that loads PCM when you do not use a script manager.', consoleTitle: '⌨️ Console loader', consoleText: 'Open Developer Tools and paste the loader into the Console.', singleTitle: '🧩 Individual install', singleText: 'You can still install one script directly from its plugin card without PCM.', showCode: 'Show code', browsePlugins: 'Browse plugins'
      }
    };
    const state = { language: 'zh', filter: 'all', query: '' };
    const grid = document.querySelector('#grid');
    const count = document.querySelector('#result-count');
    const search = document.querySelector('#search');
    const language = document.querySelector('#language');

    const render = () => {
      const t = copy[state.language];
      const query = state.query.trim().toLocaleLowerCase();
      const visible = plugins.filter((plugin) => {
        const inCategory = state.filter === 'all' || plugin.category === state.filter;
        const text = [plugin.id, plugin.name, plugin.enName, plugin.description, plugin.enDescription, ...plugin.tags].join(' ').toLocaleLowerCase();
        return inCategory && (!query || text.includes(query));
      });
      count.textContent = t.count(visible.length);
      grid.replaceChildren();
      if (!visible.length) {
        const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = t.empty; grid.append(empty); return;
      }
      visible.forEach((plugin) => {
        const card = document.createElement('article'); card.className = 'card';
        const top = document.createElement('div'); top.className = 'card-top';
        const icon = document.createElement('div'); icon.className = 'icon'; icon.textContent = plugin.emoji;
        if (plugin.icon && /^https?:/i.test(plugin.icon)) {
          const image = document.createElement('img'); image.src = plugin.icon; image.alt = ''; image.loading = 'lazy'; image.onerror = () => image.replaceWith(document.createTextNode(plugin.emoji)); icon.replaceChildren(image);
        }
        const version = document.createElement('span'); version.className = 'version'; version.textContent = plugin.version ? \`v\${plugin.version}\` : plugin.id;
        top.append(icon, version);
        const title = document.createElement('h3'); title.textContent = state.language === 'zh' ? plugin.name : plugin.enName;
        const secondary = document.createElement('p'); secondary.className = 'en-name'; secondary.textContent = state.language === 'zh' ? plugin.enName : plugin.id;
        const description = document.createElement('p'); description.className = 'description'; description.textContent = state.language === 'zh' ? plugin.description : plugin.enDescription;
        card.append(top, title, secondary, description);
        const extraText = state.language === 'zh' ? plugin.additionalInfo : plugin.enAdditionalInfo;
        if (extraText) { const extra = document.createElement('p'); extra.className = 'extra'; extra.textContent = extraText; card.append(extra); }
        if (plugin.tags.length) { const meta = document.createElement('div'); meta.className = 'meta'; plugin.tags.forEach((tag) => { const chip = document.createElement('span'); chip.className = 'chip'; chip.textContent = tag; meta.append(chip); }); card.append(meta); }
        const actions = document.createElement('div'); actions.className = 'card-actions';
        const install = document.createElement('a'); install.className = 'button primary'; install.href = plugin.url; install.target = '_blank'; install.rel = 'noreferrer'; install.textContent = t.install;
        actions.append(install);
        if (plugin.website) { const project = document.createElement('a'); project.className = 'button'; project.href = plugin.website; project.target = '_blank'; project.rel = 'noreferrer'; project.textContent = t.project; actions.append(project); }
        card.append(actions); grid.append(card);
      });
    };

    const applyLanguage = () => {
      const t = copy[state.language];
      document.documentElement.lang = state.language === 'zh' ? 'zh-Hant' : 'en';
      document.querySelectorAll('[data-t]').forEach((node) => { node.textContent = t[node.dataset.t]; });
      search.placeholder = t.search;
      language.textContent = state.language === 'zh' ? 'EN' : '中文';
      render();
    };

    document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
      render();
    }));
    search.addEventListener('input', () => { state.query = search.value; render(); });
    language.addEventListener('click', () => { state.language = state.language === 'zh' ? 'en' : 'zh'; applyLanguage(); });
    applyLanguage();
  </script>
</body>
</html>
`;

writeFileSync('README.md', readme);
writeFileSync('index.html', html);
console.log(`✅ README.md and index.html rebuilt from ${plugins.length} plugins`);
