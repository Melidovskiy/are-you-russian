import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderLayout } from './layout.mjs';

export async function buildWhoami(destination) {
  const main = `
      <header class="guides-intro whoami-intro">
        <h1>Проверка согласованности</h1>
        <p id="whoami-place" class="lead">Сверяем показания HTTP-запроса, сети и браузера по 8 правилам согласованности.</p>
        <div class="whoami-toolbar">
          <button id="whoami-webrtc" class="button primary" type="button">Проверить WebRTC</button>
          <button id="whoami-export" class="button secondary" type="button" disabled>Скачать JSON</button>
        </div>
      </header>
      <div id="whoami-loading" class="whoami-loading" role="status">
        <span class="scan-spinner" aria-hidden="true"></span>
        <span>Собираем показания браузера и сети…</span>
      </div>
      <div id="whoami-content" class="whoami-content" hidden>
        <section class="whoami-summary" aria-label="Сводка согласованности">
          <div class="whoami-stat">
            <span class="whoami-stat-label">Совпадают</span>
            <strong id="whoami-matches" class="whoami-stat-value" data-verdict="match">0</strong>
          </div>
          <div class="whoami-stat">
            <span class="whoami-stat-label">Расхождения</span>
            <strong id="whoami-mismatches" class="whoami-stat-value" data-verdict="mismatch">0</strong>
          </div>
          <div class="whoami-stat">
            <span class="whoami-stat-label">Нет данных</span>
            <strong id="whoami-unknown" class="whoami-stat-value" data-verdict="unknown">0</strong>
          </div>
          <div class="whoami-stat">
            <span class="whoami-stat-label">Показания</span>
            <strong id="whoami-readings-count" class="whoami-stat-value">0</strong>
          </div>
        </section>
        <section class="whoami-section" aria-labelledby="whoami-rules-title">
          <h2 id="whoami-rules-title">Парные проверки</h2>
          <p class="section-description">Каждое правило сопоставляет два независимых источника данных или проверяет сетевой признак.</p>
          <div id="whoami-findings" class="whoami-grid"></div>
        </section>
        <section class="whoami-section" aria-labelledby="whoami-layers-title">
          <h2 id="whoami-layers-title">Все показания по слоям</h2>
          <p class="section-description">Сырые значения и время их получения с момента открытия страницы.</p>
          <div id="whoami-layers" class="signal-list"></div>
        </section>
      </div>`;
  const directory = path.join(destination, 'who-am-i');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), renderLayout({
    title: 'Проверка согласованности',
    description: 'Проверка согласованности окружения: сравнение выходного IP, часового пояса, языков, заголовков HTTP, GPU и WebRTC.',
    base: '../',
    active: 'whoami',
    script: 'whoami.js',
    main,
  }));
}
