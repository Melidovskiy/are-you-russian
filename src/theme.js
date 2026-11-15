const theme = document.getElementById('theme');

function applyTheme(value) {
  if (value === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).backgroundColor;
}

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
