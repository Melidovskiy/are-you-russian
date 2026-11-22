import { routeComparisonLabels } from './core/webrtc-route.js';

const networkTypes = { Residential: 'Домашняя сеть', Datacenter: 'Дата-центр', Business: 'Бизнес-сеть', Unknown: 'Неизвестно' };
const labels = { proxy: 'Прокси', vpn: 'VPN', tor: 'Tor', datacenter: 'Дата-центр', abusive: 'Жалобы' };
const deductions = { datacenter: 'Адрес дата-центра', business: 'Бизнес-сеть', tor: 'Выход Tor', proxy_vpn: 'Прокси и VPN', proxy: 'Прокси', vpn: 'VPN', abuse: 'Оценка жалоб AbuseIPDB', abuser: 'Адрес отмечен за нарушения', proxycheck_risk: 'Оценка риска proxycheck', conflict: 'Источники расходятся: выбран более строгий вариант' };
const sourceStates = { ok: 'Получены данные', unavailable: 'Недоступен', unconfigured: 'Ключ не настроен', error: 'Ошибка источника' };
const notices = { no_ip: 'Не удалось определить IP.', private_ip: 'Для локального адреса репутация недоступна.', unconfigured: 'Ключи источников репутации не настроены.', partial: 'Данные неполные.', degraded: 'Часть источников недоступна.' };

export function networkTypeLabel(type) {
  return networkTypes[type] || type || 'Неизвестно';
}

export async function checkIp() {
  try {
    const response = await fetch(new URL('./api/ip?format=json', document.baseURI), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) throw new Error('Слишком много запросов. Повторите через минуту.');
    if (!response.ok) throw new Error('Не удалось проверить IP. Попробуйте позднее.');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Сервис проверки IP недоступен.');
    const result = await response.json();
    if (!result?.geo || !result.network || !result.flags || !result.sources || !Array.isArray(result.deductions)) {
      throw new Error('Сервис проверки IP вернул неполный ответ.');
    }
    return { status: 'ok', result };
  } catch (error) {
    const message = error.name === 'TimeoutError'
      ? 'Источники не ответили вовремя. Попробуйте позднее.'
      : error.message;
    return { status: 'error', message };
  }
}

function measurements(entries) {
  const list = document.createElement('dl');
  list.className = 'measurements';
  for (const [label, value] of entries) {
    const row = document.createElement('div');
    row.className = 'measurement';
    const name = document.createElement('dt');
    name.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    row.append(name, detail);
    list.append(row);
  }
  return list;
}

export function renderIp(container, outcome, webrtcRoute) {
  const route = document.createElement('p');
  route.className = 'ip-route-comparison';
  route.textContent = `Сравнение с WebRTC: ${routeComparisonLabels[webrtcRoute.status]}.`;
  if (['mixed', 'mismatch'].includes(webrtcRoute.status)) {
    route.textContent += ' Проверьте маршрутизацию. Разные адреса сами по себе не доказывают утечку.';
  }
  if (outcome.status === 'error') {
    container.replaceChildren(document.createTextNode(outcome.message), route);
    return;
  }
  const body = outcome.result;
  const summary = document.createElement('p');
  summary.className = 'ip-summary';
  const score = document.createElement('span');
  score.className = 'ip-score';
  score.textContent = body.purity === null ? '—' : `${body.purity} / 100`;
  const indicator = document.createElement('span');
  indicator.className = 'status-dot';
  indicator.dataset.status = { high: 'good', medium: 'warning', low: 'bad' }[body.band] || 'unknown';
  indicator.setAttribute('role', 'img');
  indicator.setAttribute('aria-label', { high: 'Высокая репутация IP', medium: 'Средняя репутация IP', low: 'Низкая репутация IP' }[body.band] || 'Репутация IP неизвестна');
  indicator.title = indicator.getAttribute('aria-label');
  score.prepend(indicator);
  summary.append(score, document.createTextNode('Репутация IP · выше — лучше'));
  const overview = measurements([
    ['Выходной IP', body.ip || 'Не определён'],
    ['Геолокация IP', [body.geo.country, body.geo.city].filter(Boolean).join(' / ') || 'Неизвестно'],
    ['Сеть', `${body.network.asn || ''} ${body.network.org || body.network.isp || ''}`.trim() || 'Неизвестно'],
    ['Тип сети', networkTypeLabel(body.network.type)],
  ]);
  const details = document.createElement('details');
  details.className = 'ip-details';
  const heading = document.createElement('summary');
  heading.textContent = 'Источники и причины оценки';
  details.append(heading, measurements([
    ...Object.entries(body.flags).map(([key, value]) => [labels[key] || key, value === null ? 'Неизвестно' : value ? 'Да' : 'Нет']),
    ...Object.entries(body.sources).map(([key, value]) => [key, sourceStates[value.status] || value.status]),
    ...body.deductions.map(deduction => [deduction.source, `${deductions[deduction.code] || deduction.label}: ${deduction.points}`]),
  ]));
  container.replaceChildren(summary, overview, route, details);
  if (body.notice) {
    const notice = document.createElement('p');
    notice.textContent = notices[body.notice.code] || 'Данные неполные.';
    container.append(notice);
  }
}
