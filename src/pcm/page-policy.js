// Match the document path, not query/hash text or a particular game host/release.
export function isChangelogPage(location) {
  let pathname = location?.pathname;
  if (typeof pathname !== 'string') {
    try { pathname = new URL(location?.href).pathname; } catch { return false; }
  }
  return /\/changelog\.html$/i.test(pathname);
}
