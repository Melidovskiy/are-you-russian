import { signalsFor, riskBand } from './core/signals.js';

const descriptions = {
  timezone: {
    label: 'Часовой пояс',
    method: 'Название системного часового пояса и смещение относительно UTC.',
    rule: 'Пояс из российского списка даёт 34 балла. Смещения зимой и летом показаны отдельно.',
    suggestion: 'Проверьте часовой пояс в настройках системы. VPN обычно сохраняет системный часовой пояс.',
  },
  language: {
    label: 'Языки браузера',
    method: 'Основной язык и полный список языков в порядке предпочтения.',
    rule: 'ru-RU на первом месте даёт 22 балла, ru — 17,6. Для остальных позиций применяется коэффициент 0,7.',
    suggestion: 'Проверьте порядок языков в браузере. Язык интерфейса и список языков могут настраиваться отдельно.',
  },
  vendorFonts: {
    label: 'Шрифты приложений',
    method: 'Проверка пяти шрифтов Яндекса, Сбера и VK по ширине текста в Canvas.',
    rule: 'Один найденный шрифт даёт 9,96 балла. Каждый следующий увеличивает вклад до максимума в 12 баллов.',
    suggestion: 'Найденные шрифты доступны сайтам через Canvas. Сравните результат с отдельным профилем браузера.',
  },
  webrtcLeak: {
    label: 'Адреса WebRTC',
    method: 'ICE-кандидаты, тип соединения и доступность адресов при запросе к STUN.',
    rule: 'Исходная методика добавляет 5 баллов при получении сетевого адреса. Страна адреса здесь не определяется.',
    suggestion: 'Сопоставьте публичный адрес WebRTC с выходным адресом VPN. Частные адреса показывают локальную сеть.',
  },
  cnBrowser: {
    label: 'Браузер',
    method: 'User-Agent, данные Client Hints и маркеры Яндекс Браузера.',
    rule: 'YaBrowser или Yowser в строке браузера дают 10 баллов.',
    suggestion: 'Сравните результат в другом браузере. Приватное окно обычно передаёт ту же строку User-Agent.',
  },
  intlLocale: {
    label: 'Региональные форматы',
    method: 'Локаль, календарь, система цифр и примеры форматирования даты и числа.',
    rule: 'ru-RU даёт 8 баллов, ru — 6,4. Формат даты и числа помогает увидеть применённую локаль.',
    suggestion: 'Проверьте региональные форматы системы и браузера. Они могут отличаться от языка интерфейса.',
  },
  emoji: {
    label: 'Платформа',
    method: 'Система устройства и предполагаемый поставщик emoji по данным браузера.',
    rule: 'Косвенная эвристика оригинала с весом 4 балла. Apple даёт 1 балл, Microsoft — 1,6, Google — 1,4, Linux — 2.',
    suggestion: '',
  },
};

export const SIGNALS = signalsFor('ru').map(signal => ({ ...signal, ...descriptions[signal.id] }));

function translateRaw(raw) {
  const values = {
    'none detected': 'Совпадений нет', 'canvas unavailable': 'Canvas недоступен',
    'no leak detected': 'Адреса не получены', unknown: 'Данные недоступны',
    'Apple style': 'Apple', 'Microsoft style': 'Microsoft', 'Google style': 'Google',
    'Linux / Other style': 'Linux', 'Unknown style': 'Неизвестная платформа',
    'Yandex Browser': 'Яндекс Браузер',
  };
  return values[raw] || raw.replace(/^candidate leak \((.*)\)$/, '$1');
}

export async function detectSignal(signal, includeWebRTC) {
  const started = performance.now();
  if (signal.id === 'webrtcLeak' && !includeWebRTC) {
    return { id: signal.id, points: null, score: null, value: 'Выключено', reason: 'disabled', details: {} };
  }
  if (signal.id === 'webrtcLeak' && !globalThis.RTCPeerConnection) {
    return { id: signal.id, points: null, score: null, value: 'WebRTC недоступен', reason: 'unavailable', details: {} };
  }
  try {
    const result = await signal.detect();
    if (typeof result.raw !== 'string' || ['unknown', 'canvas unavailable'].includes(result.raw)
        || !Number.isFinite(result.score) || result.score < 0 || result.score > 1) {
      throw new Error('Unavailable');
    }
    const elapsedMs = Math.round(performance.now() - started);
    if (signal.id === 'webrtcLeak' && result.raw === 'no leak detected') {
      return { id: signal.id, points: null, score: null, value: translateRaw(result.raw),
        reason: 'unavailable', details: result.details || {}, elapsedMs };
    }
    return { id: signal.id, value: translateRaw(result.raw), score: result.score,
      points: result.score * signal.weight, details: result.details || {}, elapsedMs };
  } catch {
    return { id: signal.id, value: 'Данные недоступны', points: null, score: null,
      reason: 'unavailable', details: {}, elapsedMs: Math.round(performance.now() - started) };
  }
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
    case 'language':
      return [['Основной язык', data.primaryLanguage || missing],
        ...(data.languages || []).map((language, index) => [`Приоритет ${index + 1}`, language])];
    case 'vendorFonts':
      return (data.fonts || []).map(font => [font.name, font.available ? 'Найден' : 'Не найден']);
    case 'webrtcLeak': {
      const scopes = { public: 'Публичный', private: 'Локальный', masked: 'Скрыт через mDNS' };
      return [['STUN', data.stunServer || 'stun.l.google.com:19302'],
        ...(data.candidates || []).map(candidate => [candidate.address, `${scopes[candidate.scope]} · ${candidate.type}`])];
    }
    case 'cnBrowser':
      return [['Маркеры Яндекса', data.browser || 'Не найдены'],
        ['Client Hints', (data.brands || []).map(brand => `${brand.brand} ${brand.version}`).join(', ') || missing],
        ['User-Agent', data.userAgent || missing]];
    case 'intlLocale':
      return [['Локаль', data.locale || missing], ['Календарь', data.calendar || missing],
        ['Цифры', data.numberingSystem || missing], ['Дата 15 июня 2026', data.date || missing],
        ['Число 12345,67', data.number || missing]];
    case 'emoji':
      return [['Платформа', data.platform || missing], ['Поставщик emoji', data.vendor || missing],
        ['Точек касания', String(data.touchPoints ?? missing)],
        ['Глубина цвета', data.colorDepth ? `${data.colorDepth} бит` : missing],
        ['Масштаб экрана', data.pixelRatio ? `${data.pixelRatio}×` : missing]];
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
    minimum += result.points;
    available += 1;
    if (result.score >= 0.25) matches += 1;
  }
  const lower = Math.round(minimum);
  const upper = Math.round(minimum + unknown);
  return { minimum: lower, maximum: upper, band: lower === upper ? riskBand(lower) : null, available, matches };
}
