# PCM modular runtime

This directory contains the native ES module distribution of PCM. The existing
`../Liko - Plugin Collection Manager.main.user.js` remains an independent,
stable fallback and is not overwritten by the modular build.

Module boundaries:

- `config.js` — version, storage keys and repository URLs.
- `network.js` — timeout-aware sequential source loading.
- `storage.js` — safe JSON persistence and debounced documents.
- `manifest.js` — validation, normalization and saved settings.
- `runtime.js` — plugin state machine, diagnostics and subscriptions.
- `notification-stack.js` — independent stacked side notifications.

`entry.js` acquires the shared `window.Liko.__PCMBoot__` lock and imports
`compat/core.js`. The compatibility core is an exact copy of the retained 2.2.0
userscript, so the module URL has the same UI, badge, account, command,
preferences and plugin-loading behaviour from its first release. Extracted
services remain available beside it and can replace internals incrementally
without changing the entry URL or public API.

Run `node scripts/build-pcm.mjs` from the repository root to publish this tree
to `Plugins/main/PCM`. The production and local loaders try `PCM/entry.js`
first, then fall back to the retained single-file userscript if module loading
fails. When the legacy userscript changes, update `compat/core.js` in the same
commit and verify that both files are byte-identical.
