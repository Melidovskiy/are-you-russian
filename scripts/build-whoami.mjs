import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function buildWhoami(destination) {
  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Проверка согласованности окружения: сравнение выходного IP, часового пояса, языков, заголовков HTTP, GPU и WebRTC.">
    <meta name="theme-color" content="#f4f1eb">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
    <meta property="og:title" content="Проверка согласованности — are you russian">
    <meta property="og:description" content="27 показаний браузера и сети и 8 правил согласованности.">
    <meta property="og:type" content="website">
    <title>Проверка согласованности — are you russian</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23c96442'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='Georgia,serif' font-size='18' fill='%23ffffff'%3Eа%3C/text%3E%3C/svg%3E">
    <link rel="preload" href="../assets/roboto-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="../assets/roboto-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="../assets/source-serif-4-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="../assets/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>
    <script src="../theme-init.js"></script>
    <link rel="stylesheet" href="../src/styles.css">
    <script type="module" src="../whoami.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">К содержимому</a>
    <header class="site-header">
      <div class="shell header-inner">
        <a class="wordmark" href="../" translate="no">are you russian</a>
        <nav class="site-nav" aria-label="Навигация">
          <a href="../#main">Проверка</a>
          <a class="active" href="../who-am-i/" aria-current="page">Согласованность</a>
          <a href="../guides/">Руководства</a>
          <a href="../#method">Методика</a>
          <a href="https://github.com/Melidovskiy/are-you-russian" target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
        <select id="theme" aria-label="Цветовая тема">
          <option value="system">Авто</option>
          <option value="light">Светлая</option>
          <option value="dark">Тёмная</option>
        </select>
      </div>
    </header>
    <main id="main" class="shell guides-main">
      <header class="guides-intro whoami-intro">
        <h1>Проверка согласованности</h1>
        <p id="whoami-place" class="lead">Сверяем показания HTTP-запроса, сети и браузера по 8 правилам согласованности.</p>
        <div class="whoami-toolbar">
          <button id="whoami-webrtc" class="button primary" type="button">Проверить WebRTC</button>
          <button id="whoami-export" class="button secondary" type="button">Скачать JSON</button>
        </div>
      </header>
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
          <strong id="whoami-unknown" class="whoami-stat-value" data-verdict="unknown">8</strong>
        </div>
        <div class="whoami-stat">
          <span class="whoami-stat-label">Показания</span>
          <strong id="whoami-readings-count" class="whoami-stat-value">0 из 27</strong>
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
    </main>
    <footer class="site-footer">
      <div class="shell footer-inner">
        <a href="https://github.com/Melidovskiy/are-you-russian">Melidovskiy</a>
        <span>На основе <a href="https://github.com/LinXiaoTao/FuckClaude">FuckClaude</a> от LinXiaoTao. <a href="../LICENSE">MIT License</a>.</span>
      </div>
    </footer>
  </body>
</html>
`;
  const directory = path.join(destination, 'who-am-i');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'index.html'), html);
}
