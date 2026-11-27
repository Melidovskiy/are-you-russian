const theme = document.getElementById('theme');

function applyTheme(value) {
  if (value === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  document.documentElement.dataset.themeChoice = value;
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

  const picker = theme.nextElementSibling?.classList.contains('theme-picker')
    ? theme.nextElementSibling
    : null;

  if (picker) {
    const trigger = picker.querySelector('.theme-trigger');
    const buttons = [...picker.querySelectorAll('.theme-option')];

    function syncUI() {
      buttons.forEach(btn => {
        const selected = btn.dataset.value === theme.value;
        btn.setAttribute('aria-selected', String(selected));
        btn.classList.toggle('is-selected', selected);
      });
    }

    function setOpen(open) {
      picker.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (theme.value !== btn.dataset.value) {
          theme.value = btn.dataset.value;
          theme.dispatchEvent(new Event('change', { bubbles: true }));
        }
        syncUI();
        setOpen(false);
        trigger.focus();
      });
    });

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
    syncUI();
  }
}
