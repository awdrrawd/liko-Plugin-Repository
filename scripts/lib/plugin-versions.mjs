import {existsSync, readFileSync} from 'node:fs';
import {resolve, relative, isAbsolute} from 'node:path';

const PREFIXES = [
  ['awdrrawd.github.io', '/liko-Plugin-Repository/'],
  ['raw.githubusercontent.com', '/awdrrawd/liko-Plugin-Repository/main/'],
  ['cdn.jsdelivr.net', '/gh/awdrrawd/liko-Plugin-Repository@main/'],
];

export function repositoryFile(source, root) {
  let url;
  try { url = new URL(source); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const match = PREFIXES.find(([host, prefix]) => url.hostname === host && url.pathname.startsWith(prefix));
  if (!match) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname.slice(match[1].length)); } catch { return null; }
  const file = resolve(root, pathname);
  const within = relative(root, file);
  if (!within || within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within)) return null;
  return file;
}

export function withLocalVersion(plugin, root) {
  const file = repositoryFile(plugin.url, root);
  if (!file || !existsSync(file)) return {...plugin};
  const version = readFileSync(file, 'utf8').match(/^\/\/\s*@version\s+(\S+)/m)?.[1];
  return version ? {...plugin, version} : {...plugin};
}
