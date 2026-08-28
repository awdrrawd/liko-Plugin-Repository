export function createPluginIcon(plugin, {size = 42, fallback = '🔌', onImageError = null} = {}) {
  const root = document.createElement('div');
  root.className = 'bc-plugin-icon';
  root.style.width = `${size}px`;
  root.style.height = `${size}px`;
  const imageUrl = httpsUrl(plugin.customIcon) || httpsUrl(plugin.icon);
  const emoji = plugin.iemoji || (!httpsUrl(plugin.icon) ? plugin.icon : null) || fallback;
  const fallbackNode = document.createElement('span');
  fallbackNode.className = 'bc-plugin-icon-fallback';
  fallbackNode.textContent = emoji;

  if (!imageUrl) {
    root.appendChild(fallbackNode);
    return root;
  }

  const image = document.createElement('img');
  image.className = 'bc-plugin-icon-image';
  image.src = imageUrl;
  image.alt = '';
  fallbackNode.hidden = true;
  image.addEventListener('error', () => {
    image.hidden = true;
    fallbackNode.hidden = false;
    onImageError?.(plugin, imageUrl);
  }, {once: true});
  root.append(image, fallbackNode);
  return root;
}

function httpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
}
