# PCM migration prototypes

These modules are retained prototypes, not the production entry or a supported second runtime.
The production implementation is compat/core.js, built into both ESM and classic releases.

Dependencies, lifecycle, translations, manifest validation and network helpers have already
been adopted by production and live in the parent directory. Future extraction should
replace one corresponding core implementation at a time, with behavior tests, then remove
the duplicate. Do not add features to both PCMApp and compat/core.js.

The prototype application is incomplete (including its UI and restart behavior). Build
checks verify its imports only; passing checks do not imply feature parity with production.
