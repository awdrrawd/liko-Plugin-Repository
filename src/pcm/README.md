# PCM runtime and release pipeline

PCM has one production implementation: `compat/core.js` exports `startPCM()`. Both
`entry.js` (ESM) and `classic-entry.js` (userscript) invoke it. The classic release is
now generated, including the same UI, FUSAM integration and translations as ESM.
Do not edit `dist/pcm/PCM.js` or `Plugins/main/Liko - Plugin Collection Manager.main.user.js`.

## Source ownership

- `release.js`: canonical PCM and loader version numbers.
- `userscripts.json`: userscript metadata templates and output paths.
- `compat/core.js`: production application, UI and plugin orchestration.
- `dependencies.js`: required SDK readiness and optional service capability checks.
- `lifecycle.js`: owned timers, listeners, cleanup and cancellable sleeps.
- `manifest.js`: validation shared by the production core and catalog build.
- `network.js` / `download-queue.js`: streamed downloads and the three-request FIFO limit.
- `config.js`: storage keys, timeouts and repository source policies.
- `i18n/PCM-i18n.js`: the only PCM dictionary, including English and all translations.
- `i18n/index.js`: registration and fallback when the translation engine is unavailable.
- `loader.js`: the common production/local bootstrap.
- `experimental/`: retained migration prototypes, excluded from release bundles.

The PCM dictionary is bundled in both formats. There is no deployed PCM dictionary
in `Plugins/Translation` and no extra runtime dictionary fetch. Other plugins retain
their own translation files. `BC_i18n.js` remains the shared external language/flag
engine, with capabilities checked by `DependencyLoader` before the core initializes.

## Startup and fallback

`startPCM` owns `window.Liko.__PCMStartup__`, with a promise and starting/ready/failed
status. Both release formats share this lock. The previous separate module boot
lock is gone. `window.Liko.PCM` is assigned after SDK and initial UI readiness.
Independent plugin/account loading remains in the background. Failed starts dispose
owned resources and release SDK registration before another attempt. Early plugin
promises survive retries so an already-started early plugin is not executed twice.

The loader owns only source selection and its own in-flight invocation lock.
Production stores the exact successfully executed bytes in `pcm_main_cache` as
`{schema: 1, format, code, url, time, version}`; format is `module` or `classic`.
Failed attempts preserve the last good cache. Cached execution follows network
attempts. Pre-handshake cache entries are ignored until a successful online start
replaces them. Local mode does not read/write production cache.

PCM ESM is self-contained and imported from a temporary Blob URL, revoked after
evaluation. Keep relative imports bundled and avoid `import.meta.url` asset paths.
The classic artifact is an alternative execution format of the same release;
last-known-good cache provides version rollback. The cache covers PCM itself,
not every external dependency or managed plugin.

## Build and verify

Run `npm run build` to build PCM, resolve catalog versions, and generate `Plugins.json`,
`README.md` and `index.html` in that order. CI uses this same pipeline and one publishing
workflow. All output paths and userscript metadata come from source files, so
existing generated artifacts are not needed to rebuild.

For PCM-only changes, `npm run build:pcm` generates the bundle and all three
userscripts. Configure the local URL in `loader-local-entry.js`, then rebuild.
Existing installation URLs are preserved.

Run `npm run test:pcm` for download, startup, dependency, lifecycle, translation,
version-source, artifact-parity, visibility and flag checks. The startup tests run
the actual core and generated classic artifact against browser/game boundaries;
they do not replace core initialization code. Experimental imports are checked
separately and are not evidence of production feature parity.

## Download policy

Fetch requests wait up to 45 seconds for first body bytes and abort after 30 seconds
without progress. Continuous progress has no total-duration limit. Source attempts
are sequential. Plugin-native script/module requests expose no byte progress and
retain browser completion/error handling; a hung native request can occupy a queue
slot until the browser settles it. Plugin-owned requests are outside PCM's queue.
