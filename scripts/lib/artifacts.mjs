import {readFileSync} from 'node:fs';

// Shared by clean-build verification and main's generated-file commit.
export const artifacts = [
  'dist/pcm/PCM.js',
  ...JSON.parse(readFileSync(new URL('../../src/pcm/userscripts.json', import.meta.url), 'utf8')).map(item => item.output),
  'Plugins.json', 'README.md', 'index.html',
];
