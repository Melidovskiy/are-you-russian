import { SIGNALS, detectSignal, summarize } from './signals.js';

const element = id => document.getElementById(id);
let scanning = false;
let report = null;

function text(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderSignals(results = []) {
  const rows = SIGNALS.map(signal => {
    const result = results.find(item => item.id === signal.id);
    const row = document.createElement('details');
    row.className = 'signal-row';
    const summary = document.createElement('summary');
    let state = 'Ожидает проверки';
    if (result) state = result.reason === 'disabled' ? 'Выключено' : result.points === null ? 'Недоступно'
      : result.score >= 0.6 ? 'Совпадение' : result.score >= 0.25 ? 'Слабый сигнал' : 'Без совпадений';
    const status = text('span', state, 'signal-state');
    status.dataset.kind = result?.score >= 0.25 ? 'match' : 'info';
    const points = result?.points === undefined || result.points === null ? '—'
      : `+${Number(result.points.toFixed(1)).toLocaleString('ru-RU')}`;
    summary.append(text('span', signal.label, 'signal-name'), text('span', result?.value || '—', 'signal-value'), status, text('span', points, 'signal-points'));
    const detail = document.createElement('div');
    detail.className = 'signal-detail';
    detail.append(text('p', signal.method), text('p', signal.limit), text('p', `Максимальный вклад — ${signal.weight} баллов.`));
    row.append(summary, detail);
    return row;
  });
  element('signals').replaceChildren(...rows);
}

function renderSummary(results, finished) {
  const summary = summarize(results);
  element('score').textContent = summary.minimum === summary.maximum ? String(summary.minimum) : `${summary.minimum}–${summary.maximum}`;
  const verdicts = { low: 'Низкий индекс', medium: 'Средний индекс', high: 'Высокий индекс' };
  element('verdict').textContent = !finished ? 'Проверяем сигналы…' : verdicts[summary.band] || 'Оценка с учётом непроверенных сигналов';
  element('score-note').textContent = `Доступно ${summary.available} из ${SIGNALS.length} проверок. Совпадений — ${summary.matches}.`;
  return summary;
}

element('scan').addEventListener('click', async () => {
  if (scanning) return;
  scanning = true;
  element('scan').disabled = true;
  element('include-webrtc').disabled = true;
  element('download').disabled = true;
  element('result').hidden = false;
  element('scan-state').textContent = 'Проверяем окружение';
  const includeWebRTC = element('include-webrtc').checked;
  const results = [];
  try {
    await Promise.all(SIGNALS.map(async signal => {
      const result = await detectSignal(signal, includeWebRTC);
      results.push(result);
      renderSignals(results);
      renderSummary(results, false);
    }));
    const summary = renderSummary(results, true);
    report = {
      version: 1, checkedAt: new Date().toISOString(),
      methodology: 'FuckClaude, Russian profile',
      source: 'https://github.com/LinXiaoTao/FuckClaude/tree/e730162a5482c51317732c270e2d9f68ca79c858',
      includesWebRTC: includeWebRTC, summary,
      results: SIGNALS.map(signal => ({ ...results.find(result => result.id === signal.id), weight: signal.weight })),
    };
    element('scan-state').textContent = 'Проверка завершена';
    element('scan-message').textContent = `Проверка завершена. Индекс от ${summary.minimum} до ${summary.maximum} баллов.`;
    element('scan').textContent = 'Проверить ещё раз';
    element('download').disabled = false;
  } catch {
    element('scan-state').textContent = 'Проверка прервана';
    element('scan-message').textContent = 'Проверка прервана. Попробуйте запустить её ещё раз.';
  } finally {
    scanning = false;
    element('scan').disabled = false;
    element('include-webrtc').disabled = false;
  }
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

renderSignals();
