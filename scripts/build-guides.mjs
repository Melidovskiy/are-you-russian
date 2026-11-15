import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { guides, guideCategories, guideSources, readingPaths } from '../src/guides/catalog.js';

const revision = '2026-11-15';
const revisionLabel = '15 ноября 2026';

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

function page(template, main, title, description, base) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)} — are you russian</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/href="\.\//g, `href="${base}`)
    .replace('src="./app.js"', `src="${base}guides.js"`)
    .replace('<a class="active" href="#main" aria-current="page">Проверка</a>', `<a href="${base}#main">Проверка</a>`)
    .replace(`href="${base}guides/">Руководства</a>`, `class="active" href="${base}guides/" aria-current="page">Руководства</a>`)
    .replace('href="#method"', `href="${base}#method"`)
    .replace('href="#tools"', `href="${base}#tools"`)
    .replace(/<main id="main" class="shell">[\s\S]*?<\/main>/, `<main id="main" class="shell guides-main">${main}</main>`);
}

function guideCard(guide, href) {
  return `<a class="guide-card" href="${href}"><h3>${escapeHtml(guide.title)}</h3><p>${escapeHtml(guide.summary)}</p></a>`;
}

export async function buildGuides(root, destination) {
  const template = await readFile(path.join(root, 'index.html'), 'utf8');
  const prepared = new Map();
  const seen = new Set();
  for (const guide of guides) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.slug) || seen.has(guide.slug)) throw new Error(`Invalid guide slug: ${guide.slug}`);
    if (!guideCategories[guide.category]) throw new Error(`Unknown category: ${guide.category}`);
    seen.add(guide.slug);
    const markdown = await readFile(path.join(root, 'docs/guides', `${guide.slug}.md`), 'utf8');
    prepared.set(guide.slug, prepareGuide(markdown));
  }

  const paths = readingPaths.map(item => guideCard(item, `./${item.slug}/`)).join('');
  const options = Object.entries(guideCategories).map(([id, title]) => `<option value="${id}">${escapeHtml(title)}</option>`).join('');
  const categories = Object.entries(guideCategories).map(([id, title]) => {
    const cards = guides.filter(guide => guide.category === id).map(guide => {
      const search = `${guide.title} ${guide.summary} ${guide.keywords}`.toLocaleLowerCase('ru-RU');
      return `<article data-guide data-category="${id}" data-search="${escapeHtml(search)}">
        <a href="./${guide.slug}/"><h3>${escapeHtml(guide.title)}</h3></a>
        <p>${escapeHtml(guide.summary)}</p>
        <p class="guide-meta">${prepared.get(guide.slug).minutes} мин чтения</p>
      </article>`;
    }).join('');
    return `<section class="guide-group" data-guide-group id="${id}"><h2>${escapeHtml(title)}</h2><div class="guide-list">${cards}</div></section>`;
  }).join('');

  const hub = `
    <section class="guides-intro">
      <h1>Руководства по Claude</h1>
      <p class="lead">Региональные признаки, доступ к Claude и диагностика блокировок.</p>
      <p>Раздел адаптирован по темам FuckClaude. Примеры учитывают российские региональные настройки. В статьях указаны первоисточники и дата редакции.</p>
    </section>
    <section class="official-rules" aria-labelledby="rules-title">
      <h2 id="rules-title">Что опубликовано Anthropic</h2>
      <p class="guide-meta">Источники проверены ${revisionLabel}</p>
      <div class="rules-grid">
        <article><h3>Поддерживаемые регионы</h3><p>Россия отсутствует в текущем списке. Политика описывает местонахождение пользователей и условия для организаций.</p><a href="${guideSources.regions.url}" target="_blank" rel="noopener noreferrer">Региональная политика</a></article>
        <article><h3>Ограничение аккаунта</h3><p>В справочном центре описаны причины ограничений, форма апелляции и доступные действия с данными.</p><a href="${guideSources.appeals.url}" target="_blank" rel="noopener noreferrer">Апелляции и данные</a></article>
        <article><h3>Подписка и оплата</h3><p>Покупки на сайте и в мобильных магазинах обслуживаются соответствующим платёжным кабинетом.</p><a href="${guideSources.billing.url}" target="_blank" rel="noopener noreferrer">Платёжные вопросы</a></article>
      </div>
    </section>
    <section class="reading-paths" aria-labelledby="paths-title"><h2 id="paths-title">С чего начать</h2><div class="paths-grid">${paths}</div></section>
    <section class="guide-catalog" aria-labelledby="catalog-title">
      <h2 id="catalog-title">Все руководства</h2>
      <div class="guide-filters">
        <label>Поиск<input id="guide-search" type="search" placeholder="WebRTC, оплата, 403…" aria-controls="guide-catalog-results"></label>
        <label>Тема<select id="guide-category" aria-controls="guide-catalog-results"><option value="">Все темы</option>${options}</select></label>
      </div>
      <p id="guide-count" class="guide-meta" role="status">Показано ${guides.length} из ${guides.length}</p>
      <div id="guide-catalog-results">${categories}</div>
      <p id="guide-empty" hidden>По этому запросу руководства не найдены. Попробуйте другое слово или выберите все темы.</p>
    </section>`;
  await mkdir(path.join(destination, 'guides'), { recursive: true });
  await writeFile(path.join(destination, 'guides/index.html'), page(template, hub, 'Руководства по Claude', 'Русскоязычные руководства по браузеру, IP, аккаунтам, оплате, Claude Code и API.', '../'));

  for (const guide of guides) {
    const article = prepared.get(guide.slug);
    const toc = article.toc.map(item => `<li><a href="#${item.id}">${item.title}</a></li>`).join('');
    const sources = guide.sources.map(id => {
      const source = guideSources[id];
      if (!source) throw new Error(`Unknown source: ${id}`);
      return `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`;
    }).join('');
    const related = guide.related.map(slug => {
      const next = guides.find(item => item.slug === slug);
      if (!next) throw new Error(`Unknown related guide: ${slug}`);
      return guideCard(next, `../${slug}/`);
    }).join('');
    const main = `
      <nav class="breadcrumbs" aria-label="Навигационная цепочка"><a href="../../">Проверка</a><span aria-hidden="true">/</span><a href="../">Руководства</a></nav>
      <article class="guide-article">
        <header class="article-header"><p class="guide-meta">${escapeHtml(guideCategories[guide.category])}</p><h1>${escapeHtml(guide.title)}</h1><p class="lead">${escapeHtml(guide.summary)}</p><p class="guide-meta">${article.minutes} мин чтения · Редакция <time datetime="${revision}">${revisionLabel}</time></p></header>
        <nav class="article-toc" aria-label="Содержание статьи"><h2>В этой статье</h2><ol>${toc}</ol></nav>
        <div class="article-body">${article.html}</div>
        <footer class="article-sources"><h2>Источники</h2><ul>${sources}</ul><p>Русская редакция по теме <a href="https://github.com/LinXiaoTao/FuckClaude/blob/e730162a5482c51317732c270e2d9f68ca79c858/src/content/guides/${guide.slug}.ts" target="_blank" rel="noopener noreferrer">руководства FuckClaude</a> от LinXiaoTao.</p></footer>
      </article>
      <section class="related-guides" aria-labelledby="related-title"><h2 id="related-title">Читать дальше</h2><div class="paths-grid">${related}</div></section>
      <p class="back-to-guides"><a href="../">Все руководства</a></p>`;
    const directory = path.join(destination, 'guides', guide.slug);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'index.html'), page(template, main, guide.title, guide.summary, '../../'));
  }
}
