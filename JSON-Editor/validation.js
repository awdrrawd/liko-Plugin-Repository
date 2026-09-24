// Shared by the editor and repository builds; no browser or Node dependencies.
export function validate(file, data) {
  const errors = [];
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const error = (path, message) => errors.push(`${file}: ${path} ${message}`);
  const url = (value, path) => {
    try {
      if (!text(value) || !['https:', 'http:'].includes(new URL(value).protocol)) throw new Error();
    } catch { error(path, '必須是 HTTP(S) 網址'); }
  };
  const rows = (items, path, check) => {
    if (!Array.isArray(items)) return error(path, '必須是陣列');
    const ids = new Set();
    items.forEach((item, index) => {
      const at = `${path}[${index}]`;
      if (!object(item)) return error(at, '必須是物件');
      if (!text(item.id)) error(`${at}.id`, '不可空白');
      else if (ids.has(item.id)) error(`${at}.id`, `重複：${item.id}`);
      ids.add(item.id);
      check(item, at);
    });
  };
  if (!object(data)) return [`${file}: 必須是 JSON 物件`];
  if (file === 'meta.json') {
    if (!text(data.updateId)) error('updateId', '不可空白');
    for (const lang of ['cn', 'en']) {
      const entries = data.changelog?.[lang];
      if (!Array.isArray(entries) || entries.some(item => typeof item !== 'string')) error(`changelog.${lang}`, '必須是字串陣列');
    }
  } else if (file === 'sites.json') {
    rows(data.sites, 'sites', (site, at) => {
      if (!text(site.name)) error(`${at}.name`, '不可空白');
      url(site.url, `${at}.url`);
      if (site.enabled !== undefined && typeof site.enabled !== 'boolean') error(`${at}.enabled`, '必須是布林值');
      if (site.order !== undefined && !Number.isFinite(site.order)) error(`${at}.order`, '必須是數字');
    });
    if (data.defaultSite !== undefined && (!Array.isArray(data.sites) || !data.sites.some(site => site?.id === data.defaultSite))) error('defaultSite', '不在 sites 清單中');
  } else if (['manifest.json', 'fusam.json', 'external.json'].includes(file)) {
    const addons = file !== 'external.json' || data.addons !== undefined;
    if (file === 'external.json' && data.addons !== undefined && data.plugins !== undefined) error('addons/plugins', '只能擇一');
    rows(addons ? data.addons : data.plugins, addons ? 'addons' : 'plugins', (item, at) => {
      if (addons ? !object(item.name) || !Object.values(item.name).some(text) : !text(item.name)) error(`${at}.name`, '缺少名稱');
      const types = addons ? ['eval', 'module', 'script'] : ['mod', 'scr', 'eval'];
      if (item.type !== undefined && !types.includes(item.type)) error(`${at}.type`, `必須是 ${types.join('/')}`);
      if (item.pcmskip !== undefined && typeof item.pcmskip !== 'boolean') error(`${at}.pcmskip`, '必須是布林值');
      if (item.priority !== undefined && !Number.isFinite(item.priority)) error(`${at}.priority`, '必須是數字');
      if (addons) {
        if (!Array.isArray(item.versions) || !item.versions.length) error(`${at}.versions`, '必須有版本來源');
        else item.versions.forEach((version, i) => url(version?.source, `${at}.versions[${i}].source`));
        for (const key of ['stable', 'beta']) if (item.mirror?.[key] !== undefined) url(item.mirror[key], `${at}.mirror.${key}`);
      } else {
        url(item.url, `${at}.url`);
        for (const key of ['altUrl', 'mirrorUrl', 'altMirrorUrl']) if (item[key]) url(item[key], `${at}.${key}`);
      }
    });
  } else error('', '未知的資料格式');
  return errors;
}
