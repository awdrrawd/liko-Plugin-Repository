// One ordered pipeline for local builds and CI. Each stage consumes the previous output.
await import('./build-pcm.mjs');
await import('./build.mjs');
await import('./build-docs.mjs');
