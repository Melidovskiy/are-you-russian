const theme = document.getElementById('theme');

function applyTheme(value) {
  if (value === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).backgroundColor;
}

if (theme) {
  try {
    const saved = localStorage.getItem('theme');
    if (['light', 'dark', 'system'].includes(saved)) theme.value = saved;
  } catch {}

  applyTheme(theme.value);
  theme.addEventListener('change', () => {
    applyTheme(theme.value);
    try { localStorage.setItem('theme', theme.value); } catch {}
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(theme.value));

  const options = [...theme.options].map(opt => ({ value: opt.value, label: opt.textContent }));
  const picker = document.createElement('div');
  picker.className = 'theme-picker';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'theme-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', theme.getAttribute('aria-label') || 'Цветовая тема');

  const labelEl = document.createElement('span');
  labelEl.className = 'theme-trigger-label';

  const arrow = document.createElement('span');
  arrow.className = 'chevron theme-chevron';
  arrow.setAttribute('aria-hidden', 'true');

  trigger.append(labelEl, arrow);

  const menuWrap = document.createElement('div');
  menuWrap.className = 'theme-menu-wrap';

  const menu = document.createElement('div');
  menu.className = 'theme-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', theme.getAttribute('aria-label') || 'Цветовая тема');

  const buttons = options.map(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-option';
    btn.setAttribute('role', 'option');
    btn.dataset.value = opt.value;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      if (theme.value !== opt.value) {
        theme.value = opt.value;
        theme.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncUI();
      setOpen(false);
      trigger.focus();
    });
    return btn;
  });

  menu.append(...buttons);
  menuWrap.append(menu);
  picker.append(trigger, menuWrap);

  function syncUI() {
    const current = options.find(o => o.value === theme.value) || options[0];
    labelEl.textContent = current.label;
    buttons.forEach(btn => {
      const selected = btn.dataset.value === current.value;
      btn.setAttribute('aria-selected', String(selected));
      btn.classList.toggle('is-selected', selected);
    });
  }

  function setOpen(open) {
    picker.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  }

  trigger.addEventListener('click', () => setOpen(!picker.classList.contains('is-open')));

  picker.addEventListener('keydown', event => {
    const isOpen = picker.classList.contains('is-open');
    if (event.key === 'Escape' && isOpen) {
      event.preventDefault();
      setOpen(false);
      trigger.focus();
      return;
    }
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      setOpen(true);
      const active = buttons.find(b => b.classList.contains('is-selected')) || buttons[0];
      active.focus();
      return;
    }
    if (isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const idx = buttons.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown'
        ? (idx + 1) % buttons.length
        : (idx - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    }
  });

  document.addEventListener('click', event => {
    if (!picker.contains(event.target)) setOpen(false);
  });

  theme.addEventListener('change', syncUI);
  theme.classList.add('theme-native-hidden');
  theme.tabIndex = -1;
  theme.setAttribute('aria-hidden', 'true');
  theme.after(picker);
  syncUI();
}
