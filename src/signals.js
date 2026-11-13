import { signalsFor, riskBand } from './core/signals.js';

const DESCRIPTIONS = {
  timezone: {
    label: 'Часовой пояс',
    method: 'Читается из Intl.DateTimeFormat и сравнивается со списком российского профиля оригинала.',
    limit: 'Часовой пояс доступен странице и может расходиться с регионом IP. В исходнике связь с известной проверкой Claude Code отмечена только для китайского профиля.',
  },
  language: {
    label: 'Языки браузера',
    method: 'Используется navigator.languages. В оригинале ru-RU имеет полный вес, ru — частичный. Языки после первого получают меньший вклад.',
    limit: 'Признак из оценочного российского профиля FuckClaude. Его использование внутренним классификатором Claude не подтверждено.',
  },
  vendorFonts: {
    label: 'Шрифты приложений',
    method: 'Canvas сравнивает ширину текста с YS Text, YS Display, SB Sans Text, SB Sans Display и VK Sans Display.',
    limit: 'Шрифты могут указывать на установленное приложение. Они встречаются у пользователей разных стран. Их участие в проверках Claude не подтверждено.',
  },
  webrtcLeak: {
    label: 'WebRTC',
    method: 'Оригинальный детектор собирает ICE-кандидаты с помощью STUN Google и ищет доступные сетевые адреса.',
    limit: 'Адрес из ICE-кандидата сам по себе не определяет страну и может быть локальным. Это вспомогательная эвристика автора FuckClaude.',
  },
  cnBrowser: {
    label: 'Браузер',
    method: 'User-Agent и UA-CH brands проверяются на маркеры Яндекс Браузера по российскому профилю оригинала.',
    limit: 'Название браузера доступно сайтам, но использовать его можно в любой стране. Связь с решениями Claude о блокировке не подтверждена.',
  },
  intlLocale: {
    label: 'Региональные форматы',
    method: 'Используется локаль Intl.DateTimeFormat, которая определяет формат дат.',
    limit: 'Форматы связаны с языком и настройками системы. Их вклад сохранён по исходной методике.',
  },
  emoji: {
    label: 'Платформа и emoji',
    method: 'Исходник предполагает стиль emoji по User-Agent и платформе устройства. Изображение emoji не считывается.',
    limit: 'Слабый косвенный признак из оригинала. Тип устройства не устанавливает страну, а использование этого признака Claude не подтверждено.',
  },
};

export const SIGNALS = signalsFor('ru').map(signal => ({ ...signal, ...DESCRIPTIONS[signal.id] }));

function translateRaw(raw) {
  const values = {
    'none detected': 'Совпадений не найдено', 'canvas unavailable': 'Canvas недоступен',
    'no leak detected': 'Сетевые адреса не получены', 'unknown': 'Данные недоступны',
    'Apple style': 'Apple', 'Microsoft style': 'Microsoft', 'Google style': 'Google',
    'Linux / Other style': 'Linux / другая платформа', 'Unknown style': 'Неизвестная платформа',
    'Yandex Browser': 'Яндекс Браузер',
  };
  return values[raw] || raw.replace(/^candidate leak \((.*)\)$/, 'Получены адреса ($1)');
}

export async function detectSignal(signal, includeWebRTC) {
  if (signal.id === 'webrtcLeak' && !includeWebRTC) {
    return { id: signal.id, points: null, score: null, value: 'Выключено', reason: 'disabled' };
  }
  if (signal.id === 'webrtcLeak' && !globalThis.RTCPeerConnection) {
    return { id: signal.id, points: null, score: null, value: 'WebRTC недоступен', reason: 'unavailable' };
  }
  try {
    const result = await signal.detect();
    if (['unknown', 'canvas unavailable'].includes(result.raw) || !Number.isFinite(result.score)) throw new Error('Unavailable');
    if (signal.id === 'webrtcLeak' && result.raw === 'no leak detected') {
      return { id: signal.id, points: null, score: null, value: translateRaw(result.raw), reason: 'unavailable' };
    }
    return { id: signal.id, value: translateRaw(result.raw), score: result.score, points: result.score * signal.weight };
  } catch {
    return { id: signal.id, value: 'Браузер ограничил доступ к данным', points: null, score: null, reason: 'unavailable' };
  }
}

export function summarize(results) {
  let minimum = 0;
  let unknown = 0;
  for (const signal of SIGNALS) {
    const result = results.find(item => item.id === signal.id);
    if (!result || result.points === null) unknown += signal.weight;
    else minimum += result.points;
  }
  const lower = Math.round(minimum);
  const upper = Math.round(minimum + unknown);
  return {
    minimum: lower, maximum: upper, band: lower === upper ? riskBand(lower) : null,
    available: results.filter(result => result.points !== null).length,
    matches: results.filter(result => result.score >= 0.25).length,
  };
}
