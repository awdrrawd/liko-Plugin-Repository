export class CustomSelect {
  constructor({options, value, ariaLabel = '', onChange = null}) {
    this.options = options;
    this.value = value ?? options[0]?.value;
    this.onChange = onChange;
    this.root = document.createElement('div');
    this.root.className = 'pcm-module-select';
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'pcm-module-select-trigger';
    this.trigger.setAttribute('aria-haspopup', 'listbox');
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.setAttribute('aria-label', ariaLabel);
    this.label = document.createElement('span');
    this.arrow = document.createElement('span');
    this.arrow.className = 'pcm-module-select-arrow';
    this.arrow.textContent = '▼';
    this.menu = document.createElement('div');
    this.menu.className = 'pcm-module-select-menu';
    this.menu.role = 'listbox';
    this.menu.tabIndex = -1;
    this.menu.hidden = true;
    this.optionNodes = options.map(option => this.createOption(option));
    this.menu.append(...this.optionNodes);
    this.trigger.append(this.label, this.arrow);
    this.root.append(this.trigger, this.menu);
    this.renderValue();
    this.bind();
  }

  createOption(option) {
    const node = document.createElement('button');
    node.type = 'button';
    node.role = 'option';
    node.className = 'pcm-module-select-option';
    node.dataset.value = option.value;
    node.textContent = option.label;
    node.addEventListener('click', event => {
      event.stopPropagation();
      this.select(option.value);
    });
    return node;
  }

  bind() {
    this.trigger.addEventListener('click', event => {
      event.stopPropagation();
      this.setOpen(this.menu.hidden);
    });
    this.root.addEventListener('keydown', event => this.onKeyDown(event));
    this.outsideClick = event => {
      if (!this.root.contains(event.target)) this.setOpen(false);
    };
    document.addEventListener('click', this.outsideClick);
  }

  onKeyDown(event) {
    if (event.key === 'Escape') {
      this.setOpen(false);
      this.trigger.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    if (this.menu.hidden) {
      this.setOpen(true);
      return;
    }
    const current = Math.max(0, this.optionNodes.indexOf(document.activeElement));
    if (event.key === 'Enter' || event.key === ' ') this.select(this.optionNodes[current].dataset.value);
    else {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.optionNodes[(current + direction + this.optionNodes.length) % this.optionNodes.length].focus();
    }
  }

  select(value, notify = true) {
    if (!this.options.some(option => option.value === value)) return;
    const changed = this.value !== value;
    this.value = value;
    this.renderValue();
    this.setOpen(false);
    this.trigger.focus();
    if (changed && notify) this.onChange?.(value);
  }

  renderValue() {
    this.label.textContent = this.options.find(option => option.value === this.value)?.label ?? this.value;
    for (const node of this.optionNodes) {
      const selected = node.dataset.value === this.value;
      node.setAttribute('aria-selected', String(selected));
      node.classList.toggle('selected', selected);
    }
  }

  setOpen(open) {
    this.menu.hidden = !open;
    this.trigger.setAttribute('aria-expanded', String(open));
    if (open) this.optionNodes.find(node => node.dataset.value === this.value)?.focus();
  }

  destroy() {
    document.removeEventListener('click', this.outsideClick);
    this.root.remove();
  }
}
