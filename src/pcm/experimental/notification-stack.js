export class NotificationStack {
  constructor({bottom = '15vh', right = '20px', gap = '10px'} = {}) {
    this.bottom = bottom;
    this.right = right;
    this.gap = gap;
    this.sequence = 0;
  }

  ensureContainer() {
    let container = document.getElementById('pcm-notification-stack');
    if (container) return container;
    container = document.createElement('div');
    container.id = 'pcm-notification-stack';
    container.className = 'bc-liko-notification-stack';
    container.style.bottom = this.bottom;
    container.style.right = this.right;
    container.style.gap = this.gap;
    document.body.appendChild(container);
    return container;
  }

  show({icon = 'ℹ️', title = 'PCM', message = '', durationMs = 3500, id = null}) {
    if (id && document.getElementById(id)) return null;
    const notification = document.createElement('div');
    notification.id = id || `pcm-notification-${++this.sequence}`;
    notification.className = 'bc-liko-system-notification';

    const heading = document.createElement('div');
    heading.style.cssText = 'display:flex;align-items:center;margin-bottom:2px;';
    const iconNode = document.createElement('span');
    iconNode.style.cssText = 'font-size:16px;margin-right:7px;';
    iconNode.textContent = icon;
    const titleNode = document.createElement('strong');
    titleNode.style.fontSize = '12px';
    titleNode.textContent = title;
    const messageNode = document.createElement('div');
    messageNode.style.cssText = 'font-size:11px;opacity:.85;';
    messageNode.textContent = message;
    heading.append(iconNode, titleNode);
    notification.append(heading, messageNode);

    notification.addEventListener('click', () => this.dismiss(notification), {once: true});
    this.ensureContainer().appendChild(notification);
    requestAnimationFrame(() => requestAnimationFrame(() => notification.classList.add('show')));
    setTimeout(() => this.dismiss(notification), durationMs);
    return notification;
  }

  dismiss(notification) {
    if (!notification || notification.dataset.dismissing === 'true') return;
    notification.dataset.dismissing = 'true';
    notification.classList.remove('show');
    notification.classList.add('hide');
    setTimeout(() => {
      const container = notification.parentElement;
      notification.remove();
      if (container?.id === 'pcm-notification-stack' && !container.children.length) container.remove();
    }, 400);
  }

  clear() {
    document.getElementById('pcm-notification-stack')?.remove();
  }
}
