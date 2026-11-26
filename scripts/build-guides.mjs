import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { guides, guideCategories, guideSources } from '../src/guides/catalog.js';

const revision = '2026-11-21';
const revisionLabel = '21 ноября 2026';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function prepareGuide(markdown) {
  const toc = [];
  const html = marked.parse(markdown, { async: false, gfm: true })
    .replace(/<h2>([\s\S]*?)<\/h2>/g, (_, heading) => {
      const id = `section-${toc.length + 1}`;
      toc.push({ id, title: heading.replace(/<[^>]+>/g, '') });
      return `<h2 id="${id}">${heading}</h2>`;
    })
    .replace(/<table>[\s\S]*?<\/table>/g, table => `<div class="table-scroll" role="region" aria-label="Таблица" tabindex="0">${table}</div>`);
  const words = markdown.replace(/```[\s\S]*?```/g, '').split(/\s+/).filter(Boolean).length;
  return { html, toc, minutes: Math.max(1, Math.ceil(words / 220)) };
}

function renderGuidePage({ main, title, description, base }) {
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapedDescription}">
    <meta name="theme-color" content="#f4f1eb">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://api.ipify.org https://api6.ipify.org; object-src 'none'; base-uri 'self'; form-action 'none'">
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
    <script type="module" src="${base}guides.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">К содержимому</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="wordmark" href="${base}" translate="no">are you russian</a>
        <nav class="site-nav" aria-label="Навигация">
          <a href="${base}#main">Проверка</a>
          <a class="active" href="${base}guides/" aria-current="page">Руководства</a>
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
    <main id="main" class="shell guides-main">${main}</main>
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

function guideLink(guide, href, minutes) {
  return `<a class="guide-link" href="${href}"><div><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.summary)}</p></div><span class="guide-duration">${minutes} мин</span></a>`;
}

export async function buildGuides(root, destination) {
  const prepared = new Map();
  const seen = new Set();
  for (const guide of guides) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug) || seen.has(guide.slug)) throw new Error(`Invalid guide slug: ${guide.slug}`);
    if (!guideCategories[guide.category]) throw new Error(`Unknown category: ${guide.category}`);
    seen.add(guide.slug);
    const markdown = await readFile(path.join(root, 'docs/guides', `${guide.slug}.md`), 'utf8');
    prepared.set(guide.slug, prepareGuide(markdown));
  }

  const entries = guides.filter(guide => guide.slug !== 'claude-cage').map(guide =>
    guideLink(guide, `./${guide.slug}/`, prepared.get(guide.slug).minutes)).join('');
  const hub = `
    <header class="guides-intro">
      <h1>Руководства по Claude</h1>
      <p class="lead">Как читать результаты проверки, что даёт Claude Cage и где искать причину сетевых ошибок.</p>
    </header>
    <section class="guide-feature" aria-labelledby="cage-title">
      <div>
        <h2 id="cage-title">Claude Cage</h2>
        <p>Изолированная среда из китайского сообщества. Объединяет инструменты Claude, настройки окружения и контроль сетевого выхода.</p>
        <a class="button primary" href="./claude-cage/">Подробнее о Claude Cage</a>
      </div>
      <div class="feature-note">
        <p>Cage проверен в нашей конфигурации.</p>
        <p>Для работы нужен действующий прокси. Результат зависит от конфигурации, сети и правил Anthropic.</p>
      </div>
    </section>
    <section class="guide-catalog" aria-labelledby="catalog-title">
      <h2 id="catalog-title">Проверка и диагностика</h2>
      <div class="guide-list">${entries}</div>
    </section>
    <aside class="guide-policy">
      <h2>Региональные ограничения</h2>
      <p>Россия отсутствует в списке поддерживаемых регионов Anthropic. Сканирование помогает разобраться в техническом окружении. Условия доступа определяет компания.</p>
      <a href="${guideSources.regions.url}" target="_blank" rel="noopener noreferrer">Региональная политика Anthropic</a>
      <p class="guide-meta">Редакция <time datetime="${revision}">${revisionLabel}</time></p>
    </aside>`;
  await mkdir(path.join(destination, 'guides'), { recursive: true });
  await writeFile(path.join(destination, 'guides/index.html'), renderGuidePage({
    main: hub,
    title: 'Руководства по Claude',
    description: 'Проверка окружения Claude, Claude Cage, требования к VPS и диагностика ошибок доступа.',
    base: '../',
  }));

  for (const guide of guides) {
    const article = prepared.get(guide.slug);
    const toc = article.toc.map(item => `<li><a href="#${item.id}">${escapeHtml(item.title)}</a></li>`).join('');
    const navigation = guides.map(item => `<a href="../${item.slug}/"${item.slug === guide.slug ? ' aria-current="page"' : ''}>${escapeHtml(item.title)}</a>`).join('');
    const sources = guide.sources.map(id => {
      const source = guideSources[id];
      if (!source) throw new Error(`Unknown source: ${id}`);
      return `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`;
    }).join('');
    const related = guide.related.map(slug => {
      const next = guides.find(item => item.slug === slug);
      if (!next) throw new Error(`Unknown related guide: ${slug}`);
      return guideLink(next, `../${slug}/`, prepared.get(slug).minutes);
    }).join('');
    const main = `
      <nav class="breadcrumbs" aria-label="Навигационная цепочка"><a href="../../">Проверка</a><span aria-hidden="true">/</span><a href="../">Руководства</a></nav>
      <div class="guide-layout">
        <aside class="article-sidebar">
          <nav class="article-navigation" aria-label="Руководства">${navigation}</nav>
          <nav class="article-toc" aria-label="Содержание статьи"><h2>В этой статье</h2><ul>${toc}</ul></nav>
        </aside>
        <article class="guide-article">
          <header class="article-header"><h1>${escapeHtml(guide.title)}</h1><p class="lead">${escapeHtml(guide.summary)}</p><p class="guide-meta">${article.minutes} мин чтения · <time datetime="${revision}">${revisionLabel}</time></p></header>
          <details class="article-toc mobile-toc"><summary>Содержание статьи</summary><ul>${toc}</ul></details>
          <div class="article-body">${article.html}</div>
          <footer class="article-sources"><h2>Источники</h2><ul>${sources}</ul></footer>
          <section class="related-guides" aria-labelledby="related-title"><h2 id="related-title">Читать дальше</h2><div class="guide-list">${related}</div></section>
          <p class="back-to-guides"><a href="../">Все руководства</a></p>
        </article>
      </div>`;
    const directory = path.join(destination, 'guides', guide.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), renderGuidePage({
      main,
      title: guide.title,
      description: guide.summary,
      base: '../../',
    }));
  }
}
