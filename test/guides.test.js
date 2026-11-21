import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGuides, prepareGuide } from '../scripts/build-guides.mjs';
import { guides, guideCategories, guideSources } from '../src/guides/catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('guide catalog has complete bodies, valid sources and reachable related guides', async () => {
  const slugs = new Set(guides.map(guide => guide.slug));
  assert.equal(slugs.size, guides.length);
  for (const guide of guides) {
    assert.ok(guideCategories[guide.category]);
    const markdown = await readFile(path.join(root, 'docs/guides', `${guide.slug}.md`), 'utf8');
    assert.ok(markdown.includes('## '));
    for (const slug of guide.related) assert.ok(slugs.has(slug));
    for (const source of guide.sources) assert.equal(new URL(guideSources[source].url).protocol, 'https:');
  }
  assert.equal(guides.length, 5);
  assert.ok(slugs.has('claude-cage'));
  assert.equal(slugs.has('account-appeal-and-recovery-sop'), false);
});

test('article preparation keeps code escaped, headings addressable and tables scrollable', () => {
  const article = prepareGuide('## Проверка\n\n```text\n<script>\n```\n\n## Проверка\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
  assert.deepEqual(article.toc.map(item => item.id), ['section-1', 'section-2']);
  assert.match(article.html, /&lt;script&gt;/);
  assert.match(article.html, /class="table-scroll"/);
  assert.match(article.html, /tabindex="0"/);
});

test('generated guide pages preserve relative links, navigation, theme and local anchors', async () => {
  const destination = await mkdtemp(path.join(tmpdir(), 'ayr-guides-'));
  try {
    await buildGuides(root, destination);
    const pages = ['guides/index.html', ...guides.map(guide => `guides/${guide.slug}/index.html`)];
    for (const filename of pages) {
      const html = await readFile(path.join(destination, filename), 'utf8');
      const pathname = `/${filename.replace(/index\.html$/, '')}`;
      const base = new URL(pathname, 'https://example.test');
      assert.match(html, /id="theme"/);
      assert.match(html, /guides\.js/);
      assert.doesNotMatch(html, /src="[^\"]*app\.js"/);
      assert.match(html, /class="active"[^>]*aria-current="page">Руководства/);
      for (const match of html.matchAll(/href="([^"]+)"/g)) {
        const url = new URL(match[1], base);
        if (url.origin !== base.origin) continue;
        if (url.pathname.startsWith('/guides/')) {
          const target = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
          assert.equal((await stat(path.join(destination, target))).isFile(), true);
        }
        if (match[1].startsWith('#')) assert.ok(html.includes(`id="${url.hash.slice(1)}"`));
      }
    }
  } finally {
    const checked = path.resolve(destination);
    assert.ok(checked.startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(checked, { recursive: true, force: true });
  }
});
