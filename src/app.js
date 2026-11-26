import { SIGNALS, detectSignal, inspectWebrtc, resultDetails, summarize } from './signals.js';
import { reportImage, saveBlob } from './export.js';
import { checkIp, renderIp } from './ip.js';
import { compareWebrtcRoute } from './core/webrtc-route.js';
import { measureIpFamilies } from './ip-families.js';
import './theme.js';

const element = id => document.getElementById(id);
const views = new Map();
let scanning = false;
let report = null;

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function updateExpandButton() {
  const expanded = [...views.values()].every(view => view.row.open);
  element('expand').textContent = expanded ? 'Свернуть всё' : 'Развернуть всё';
  element('expand').setAttribute('aria-expanded', String(expanded));
}

function createSignal(signal) {
  const row = document.createElement('details');
  row.className = 'signal-row';
  row.dataset.signal = signal.id;
  const summary = document.createElement('summary');
  const heading = document.createElement('div');
  const title = text('span', '', 'signal-title');
  const status = text('span', 'Ожидает проверки', 'signal-state');
  title.append(text('span', signal.label, 'signal-name'), status);
  const value = text('span', '—', 'signal-value');
  heading.append(title, value, text('span', signal.method, 'signal-description'));
  const points = text('span', '—', 'points-value');
  const contribution = text('span', '', 'signal-points');
  contribution.append(points, text('span', `из ${signal.weight}`, 'signal-weight'));
  const chevron = text('span', '', 'chevron');
  chevron.setAttribute('aria-hidden', 'true');
  summary.append(heading, contribution, chevron);
  const detail = document.createElement('div');
  detail.className = 'signal-detail';
  const measurements = document.createElement('dl');
  measurements.className = 'measurements';
  measurements.hidden = true;
  const notice = text('p', 'Запустите проверку, чтобы увидеть значения.', 'unavailable');
  const suggestion = text('p', signal.suggestion, 'suggestion');
  suggestion.hidden = true;
  detail.append(measurements, notice, text('p', signal.rule, 'calculation'), suggestion);
  row.append(summary, detail);
  row.addEventListener('toggle', updateExpandButton);
  views.set(signal.id, { row, status, value, points, measurements, notice, suggestion });
  return row;
}

function statusFor(result) {
  if (result.points === null) return 'Недоступно';
  if (result.score >= 0.6) return 'Совпадение';
  if (result.score >= 0.25) return 'Частичное совпадение';
  return 'Без совпадений';
}

function updateSignal(signal, result) {
  const view = views.get(signal.id);
  view.status.textContent = statusFor(result);
  view.status.dataset.kind = result.score >= 0.25 ? 'match' : 'info';
  view.value.textContent = result.value;
  view.points.textContent = result.points === null ? '—' : `+${Number(result.points.toFixed(2)).toLocaleString('ru-RU')}`;
  const entries = resultDetails(signal, result);
  const rows = entries.map(([label, value]) => {
    const row = text('div', '', 'measurement');
    row.append(text('dt', label), text('dd', value));
    return row;
  });
  view.measurements.replaceChildren(...rows);
  view.measurements.hidden = rows.length === 0;
  view.notice.hidden = result.points !== null;
  view.notice.textContent = 'Браузер не вернул данные. Вес этой проверки включён в верхнюю границу индекса.';
  view.suggestion.hidden = !signal.suggestion || result.points === null || result.score < 0.25;
}

function renderSummary(results, finished) {
  const summary = summarize(results);
  element('score').textContent = summary.minimum === summary.maximum
    ? String(summary.minimum) : `${summary.minimum}–${summary.maximum}`;
  element('score-meter').value = summary.minimum;
  element('score-status').dataset.status = finished ? ({ low: 'good', medium: 'warning', high: 'bad' }[summary.band] || 'unknown') : 'unknown';
  const verdicts = { low: 'Низкий индекс', medium: 'Средний индекс', high: 'Высокий индекс' };
  element('verdict').textContent = 'Проверяем окружение…';
  if (finished) element('verdict').textContent = verdicts[summary.band] || 'Неполная проверка';
  element('score-status').setAttribute('aria-label', finished ? (verdicts[summary.band] || 'Неполная проверка') : 'Проверяем окружение');
  element('score-status').title = element('score-status').getAttribute('aria-label');
  element('score-note').textContent = `Доступно ${summary.available} из ${SIGNALS.length} проверок. Совпадений ${summary.matches}.`;
  element('progress').value = results.length;
  element('scan-state').textContent = `Обработано ${results.length} из ${SIGNALS.length}`;
  return summary;
}

element('scan').addEventListener('click', async () => {
  if (scanning) return;
  scanning = true;
  const minimumDuration = new Promise(resolve => setTimeout(resolve, 400));
  report = null;
  element('scan').disabled = true;
  element('scan-label').textContent = 'Проверяем…';
  element('scan-spinner').hidden = false;
  element('result').setAttribute('aria-busy', 'true');
  element('include-webrtc').disabled = true;
  element('include-ip-families').disabled = true;
  element('download').disabled = true;
  element('image').disabled = true;
  element('share').disabled = true;
  element('result').hidden = false;
  element('report-results').hidden = true;
  element('scan-progress').hidden = false;
  element('ip-result').textContent = 'Проверяем IP и запрашиваем источники репутации…';
  const ipCheck = checkIp();
  const includeWebRTC = element('include-webrtc').checked;
  const webrtcCheck = inspectWebrtc(includeWebRTC);
  const ipFamiliesCheck = measureIpFamilies(element('include-ip-families').checked);
  const results = [];
  for (const view of views.values()) {
    view.status.textContent = 'Проверяем…';
    view.status.dataset.kind = 'info';
    view.value.textContent = '—';
    view.points.textContent = '—';
    view.measurements.hidden = true;
    view.notice.hidden = true;
    view.suggestion.hidden = true;
  }
  renderSummary(results, false);
  try {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(SIGNALS.map(async signal => {
      const result = await detectSignal(signal);
      results.push(result);
      element('progress').value = results.length;
      element('scan-state').textContent = `Обработано ${results.length} из ${SIGNALS.length}`;
    }));
    element('scan-state').textContent = 'Собираем результаты…';
    element('progress').removeAttribute('value');
    const [ip, webrtc, ipFamilies] = await Promise.all([ipCheck, webrtcCheck, ipFamiliesCheck, minimumDuration]);
    for (const signal of SIGNALS) {
      updateSignal(signal, results.find(result => result.id === signal.id));
    }
    const renderCurrentIp = currentIp => {
      const webrtcRoute = compareWebrtcRoute(currentIp.result?.ip, webrtc);
      renderIp(element('ip-result'), currentIp, webrtcRoute, webrtc, ipFamilies, async () => {
        element('ip-result').textContent = 'Повторяем проверку IP…';
        const retried = await checkIp();
        const nextRoute = compareWebrtcRoute(retried.result?.ip, webrtc);
        if (report) report = { ...report, ip: retried, webrtcRoute: nextRoute };
        renderCurrentIp(retried);
      });
      return webrtcRoute;
    };
    const webrtcRoute = renderCurrentIp(ip);
    const summary = renderSummary(results, true);
    report = {
      version: 5, checkedAt: new Date().toISOString(),
      methodology: 'are-you-russian, adapted FuckClaude Russian profile',
      source: 'https://github.com/LinXiaoTao/FuckClaude/tree/e730162a5482c51317732c270e2d9f68ca79c858',
      includesWebRTC: includeWebRTC, summary, ip, webrtcRoute, webrtc, ipFamilies,
      results: SIGNALS.map(signal => ({ ...results.find(result => result.id === signal.id), label: signal.label, weight: signal.weight })),
    };
    const ipMessage = ip.status === 'ok' ? 'Результат проверки IP получен.' : 'Проверка IP недоступна.';
    element('scan-message').textContent = `Проверка завершена. Индекс от ${summary.minimum} до ${summary.maximum} баллов. ${ipMessage}`;
    element('download').disabled = false;
    element('image').disabled = false;
    element('share').disabled = false;
    element('scan-progress').hidden = true;
    element('report-results').hidden = false;
  } catch {
    element('verdict').textContent = 'Проверка прервана';
    element('scan-message').textContent = 'Запустите проверку ещё раз.';
    element('scan-state').textContent = 'Проверка прервана';
  } finally {
    scanning = false;
    element('scan').disabled = false;
    element('scan-label').textContent = 'Проверить ещё раз';
    element('scan-spinner').hidden = true;
    element('result').setAttribute('aria-busy', 'false');
    element('include-webrtc').disabled = false;
    element('include-ip-families').disabled = false;
  }
});

element('expand').addEventListener('click', () => {
  const expand = ![...views.values()].every(view => view.row.open);
  for (const view of views.values()) view.row.open = expand;
  updateExpandButton();
});

element('download').addEventListener('click', () => {
  if (!report) return;
  const blob = new Blob([JSON.stringify(report, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'are-you-russian-claude-report.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

element('image').addEventListener('click', async () => {
  if (!report) return;
  try { saveBlob(await reportImage(report), 'are-you-russian.png'); }
  catch { element('scan-message').textContent = 'Не удалось создать изображение. Можно скачать JSON.'; }
});
element('share').addEventListener('click', async () => {
  if (!report) return;
  const current = report;
  try {
    const file = new File([await reportImage(current)], 'are-you-russian.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Are you Russian' });
    else {
      saveBlob(file, file.name);
      element('scan-message').textContent = 'Картинка сохранена — её можно отправить вручную.';
    }
  } catch (error) {
    if (error.name !== 'AbortError') element('scan-message').textContent = 'Отправка недоступна. Сохраните PNG или JSON.';
  }
});

element('progress').max = SIGNALS.length;
element('signals').replaceChildren(...SIGNALS.map(createSignal));
