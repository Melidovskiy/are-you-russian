import { signalsFor, riskBand, detectWebrtcLeak } from './core/signals.js';

const descriptions = {
  timezone: {
    label: 'Часовой пояс',
    method: 'Название системного часового пояса и смещение относительно UTC.',
    rule: 'Пояс из российского списка даёт 40 баллов. Смещения зимой и летом показаны отдельно.',
    suggestion: 'Проверьте часовой пояс в настройках системы. VPN обычно сохраняет системный часовой пояс.',
  },
  language: {
    label: 'Язык и форматы',
    method: 'Языки браузера и форматы даты и числа.',
    rule: 'ru-RU на первом месте даёт 35 баллов, ru — 28. Для остальных позиций применяется коэффициент 0,7. Форматы показаны в деталях и отдельно не оцениваются.',
    suggestion: 'Проверьте порядок языков в браузере. Язык интерфейса и список языков могут настраиваться отдельно.',
  },
  vendorFonts: {
    label: 'Шрифты приложений',
    method: 'Проверка пяти шрифтов Яндекса, Сбера и VK по ширине текста в Canvas.',
    rule: 'Один найденный шрифт даёт 12 баллов, два — 13, три и больше — 14.',
    suggestion: 'Найденные шрифты доступны сайтам через Canvas. Сравните результат с отдельным профилем браузера.',
  },
  cnBrowser: {
    label: 'Браузер',
    method: 'User-Agent, данные Client Hints и маркеры Яндекс Браузера.',
    rule: 'Маркеры YaBrowser или Yowser дают 11 баллов. Платформа показана для справки.',
    suggestion: 'Сравните результат в другом браузере. Приватное окно обычно передаёт ту же строку User-Agent.',
  },
};

export const SIGNALS = signalsFor('ru').map(signal => ({ ...signal, ...descriptions[signal.id] }));

function translateRaw(raw) {
  const values = {
    'none detected': 'Совпадений нет', 'canvas unavailable': 'Canvas недоступен',
    unknown: 'Данные недоступны',
    'Yandex Browser': 'Яндекс Браузер',
  };
  return values[raw] || raw;
}

export async function detectSignal(signal) {
  const started = performance.now();
  try {
    const result = await signal.detect();
    if (typeof result.raw !== 'string' || ['unknown', 'canvas unavailable'].includes(result.raw)
        || !Number.isFinite(result.score) || result.score < 0 || result.score > 1) {
      throw new Error('Unavailable');
    }
    const elapsedMs = Math.round(performance.now() - started);
    return { id: signal.id, value: translateRaw(result.raw), score: result.score,
      points: Math.round(result.score * signal.weight), details: result.details || {}, elapsedMs };
  } catch {
    return { id: signal.id, value: 'Данные недоступны', points: null, score: null,
      reason: 'unavailable', details: {}, elapsedMs: Math.round(performance.now() - started) };
  }
}

export async function inspectWebrtc(enabled) {
  if (!enabled) return { reason: 'disabled' };
  if (!globalThis.RTCPeerConnection) return { reason: 'unavailable' };
  const { details } = await detectWebrtcLeak();
  return { reason: details?.candidates?.length ? 'measured' : 'unavailable', details };
}

export function formatOffset(minutes) {
  if (!Number.isFinite(minutes)) return 'Недоступно';
  const sign = minutes >= 0 ? '+' : '−';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const remainder = String(Math.abs(minutes) % 60).padStart(2, '0');
  return `UTC${sign}${hours}:${remainder}`;
}

export function resultDetails(signal, result) {
  const data = result.details || {};
  const missing = 'Недоступно';
  switch (signal.id) {
    case 'timezone':
      return [['Название', data.timezone || missing], ['Сейчас', formatOffset(data.offsetMinutes)],
        ['В январе', formatOffset(data.januaryOffset)], ['В июле', formatOffset(data.julyOffset)]];
    case 'language': {
      const formats = data.formats || {};
      return [['Основной язык', data.primaryLanguage || missing],
        ...(data.languages || []).map((language, index) => [`Приоритет ${index + 1}`, language]),
        ['Локаль форматов', formats.locale || missing], ['Календарь', formats.calendar || missing],
        ['Цифры', formats.numberingSystem || missing], ['Пример даты', formats.date || missing],
        ['Пример числа', formats.number || missing]];
    }
    case 'vendorFonts':
      return (data.fonts || []).map(font => [font.name, font.available ? 'Найден' : 'Не найден']);
    case 'cnBrowser':
      return [['Маркеры Яндекса', data.browser || 'Не найдены'],
        ['Client Hints', (data.brands || []).map(brand => `${brand.brand} ${brand.version}`).join(', ') || missing],
        ['User-Agent', data.userAgent || missing], ['Платформа', data.platform || missing]];
    default:
      return [];
  }
}

export function summarize(results) {
  let minimum = 0;
  let unknown = 0;
  let available = 0;
  let matches = 0;
  for (const signal of SIGNALS) {
    const result = results.find(item => item.id === signal.id);
    if (!result || !Number.isFinite(result.points) || result.points < 0 || result.points > signal.weight) {
      unknown += signal.weight;
      continue;
    }
    minimum += Math.round(result.points);
    available += 1;
    if (result.score >= 0.25) matches += 1;
  }
  const lower = Math.round(minimum);
  const upper = Math.round(minimum + unknown);
  return { minimum: lower, maximum: upper, band: lower === upper ? riskBand(lower) : null, available, matches };
}
