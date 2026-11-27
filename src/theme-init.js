try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.themeChoice = t;
  } else {
    document.documentElement.dataset.themeChoice = 'system';
  }
} catch {}
