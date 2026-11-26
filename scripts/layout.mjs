export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function renderLayout({
  title,
  description,
  base,
  active,
  script,
  main,
  mainClass = 'shell guides-main',
  connectSrc = "'self'",
}) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const navItem = (id, href, label) => (
    active === id
      ? `<a class="active" href="${href}" aria-current="page">${label}</a>`
      : `<a href="${href}">${label}</a>`
  );
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapedDescription}">
    <meta name="theme-color" content="#f4f1eb">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src ${connectSrc}; object-src 'none'; base-uri 'self'; form-action 'none'">
    <meta property="og:title" content="${escapedTitle}">
    <meta property="og:description" content="${escapedDescription}">
    <meta property="og:type" content="website">
    <title>${escapedTitle} — are you russian</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23c96442'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='Georgia,serif' font-size='18' fill='%23ffffff'%3Eа%3C/text%3E%3C/svg%3E">
    <link rel="preload" href="${base}assets/roboto-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${base}assets/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${base}assets/source-serif-4-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${base}assets/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>
    <script src="${base}theme-init.js"></script>
    <link rel="stylesheet" href="${base}src/styles.css">
    <script type="module" src="${base}${script}"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">К содержимому</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="wordmark" href="${base}" translate="no">are you russian</a>
        <nav class="site-nav" aria-label="Навигация">
          ${navItem('home', `${base}#main`, 'Проверка')}
          ${navItem('whoami', `${base}who-am-i/`, 'Согласованность')}
          ${navItem('guides', `${base}guides/`, 'Руководства')}
          <a href="${base}#method">Методика</a>
          <a href="https://github.com/Melidovskiy/are-you-russian" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <select id="theme" aria-label="Цветовая тема">
          <option value="system">Авто</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </div>
    </header>
    <main id="main" class="${mainClass}">${main}</main>
    <footer class="site-footer">
      <div class="shell footer-inner">
        <a href="https://github.com/Melidovskiy/are-you-russian">Melidovskiy</a>
        <span>На основе <a href="https://github.com/LinXiaoTao/FuckClaude">FuckClaude</a> от LinXiaoTao. <a href="${base}LICENSE">MIT License</a>.</span>
      </div>
    </footer>
  </body>
</html>
`;
}
