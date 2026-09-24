import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {artifacts} from './lib/artifacts.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
function git(...args) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}
export function publishArtifacts(runGit = git) {
  // Never rebase generated output onto newer source. The newer push has its own run.
  runGit('fetch', 'origin', 'main');
  const source = runGit('rev-parse', 'HEAD');
  if (source !== runGit('rev-parse', 'origin/main')) return 'main advanced; publication left to the newer run.';
  if (!runGit('status', '--porcelain', '--', ...artifacts)) return 'Generated artifacts already up to date.';
  runGit('config', 'user.name', 'github-actions[bot]');
  runGit('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  runGit('add', '--', ...artifacts);
  runGit('commit', '-m', 'chore: build repository artifacts');
  try { runGit('push', 'origin', 'HEAD:main'); }
  catch (error) {
    // Handle another push arriving between the initial fetch and our push.
    runGit('fetch', 'origin', 'main');
    if (runGit('rev-parse', 'origin/main') !== source) return 'main advanced during publication; publication left to the newer run.';
    throw error;
  }
  return 'Generated artifacts published.';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(publishArtifacts());
}
