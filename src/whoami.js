import './theme.js';
import {
  READING_DEFS,
  evaluateRules,
  formatUtcOffset,
} from './core/whoami.js';
import { inspectWebrtc } from './signals.js';
import { networkTypeLabel } from './ip.js';

const RULE_META = {
  'tz-offset': {
    title: 'Часовой пояс IP и браузера',
    description: 'Сравнивает смещение UTC часового пояса выходного IP и системного пояса браузера.',
  },
  'lang-country': {
    title: 'Страна IP и языки браузера',
    description: 'Проверяет, есть ли основной язык страны IP в списке языков браузера.',
  },
  'lang-header-script': {
    title: 'Accept-Language и navigator.languages',
    description: 'Сверяет первый язык HTTP-заголовка с основным языком в JavaScript.',
  },
  'ua-platform': {
    title: 'User-Agent и платформа Client Hints',
    description: 'Сравнивает семейство ОС из строки User-Agent и данных платформы браузера.',
  },
  'ua-gpu': {
    title: 'User-Agent и WebGL GPU',
    description: 'Проверяет совместимость заявленной ОС и рендерера видеокарты WebGL.',
  },
  'webrtc-ip': {
    title: 'Публичный IP HTTPS и WebRTC',
    description: 'Сопоставляет публичный адрес HTTPS-запроса и srflx-адрес WebRTC одного семейства.',
  },
  'webrtc-tun': {
    title: 'Туннельные адреса WebRTC (198.18.0.0/15)',
    description: 'Ищет среди локальных кандидатов WebRTC диапазон, характерный для TUN/FakeIP-клиентов.',
  },
  'ip-network-type': {
    title: 'Тип сети и флаги прокси',
    description: 'Оценивает, относится ли выходной IP к домашней сети или дата-центру/прокси.',
  },
};

const LAYER_META = [
  { id: 'request', title: 'HTTP-запрос', description: 'То, что сервер видит в заголовках и на границе сети.' },
  { id: 'network', title: 'Сеть и IP', description: 'Тип сети, ASN, организация и флаги прокси по данным /api/ip.' },
  { id: 'script', title: 'Браузер (JavaScript)', description: 'Параметры окружения, доступные скриптам на странице.' },
  { id: 'probe', title: 'WebRTC-зонд', description: 'Запускается только по нажатию кнопки и обращается к STUN.' },
];

const startedAt = performance.now();
const snapshot = {};
let webrtcRunning = false;

const el = id => document.getElementById(id);

function node(tag, textContent, className) {
  const n = document.createElement(tag);
  if (textContent !== undefined) n.textContent = textContent;
  if (className) n.className = className;
  return n;
}

function setReading(id, value) {
  if (value === null || value === undefined || value === '') return;
  const def = READING_DEFS[id];
  if (!def) return;
  snapshot[id] = {
    id,
    layer: def.layer,
    value: String(value),
    atMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

function getWebglRenderer() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'Недоступно';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return gl.getParameter(gl.RENDERER) || 'Скрыто';
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'Скрыто';
  } catch {
    return 'Недоступно';
  }
}

function getCanvasHash() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 36;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'Недоступно';
    ctx.textBaseline = 'top';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#c96442';
    ctx.fillRect(8, 6, 40, 20);
    ctx.fillStyle = '#1b1917';
    ctx.fillText('are-you-russian 012', 12, 10);
    const data = canvas.toDataURL();
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  } catch {
    return 'Недоступно';
  }
}

function collectScriptReadings() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const offset = formatUtcOffset(-new Date().getTimezoneOffset());
    if (tz) setReading('script.timezone', `${tz} (${offset})`);
  } catch {}
  const langs = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages.join(', ')
    : (navigator.language || '');
  if (langs) setReading('script.languages', langs);
  if (navigator.userAgent) setReading('script.userAgent', navigator.userAgent);
  const platform = navigator.userAgentData?.platform || navigator.platform || '';
  if (platform) setReading('script.uaDataPlatform', platform);
  if (globalThis.screen) {
    setReading('script.screen', `${screen.width}×${screen.height} @${window.devicePixelRatio || 1}x`);
  }
  setReading('script.gpu', getWebglRenderer());
  if (Number.isFinite(navigator.hardwareConcurrency)) {
    setReading('script.cores', String(navigator.hardwareConcurrency));
  }
  if (Number.isFinite(navigator.deviceMemory)) {
    setReading('script.memory', `${navigator.deviceMemory} ГБ`);
  }
  if (Number.isFinite(navigator.maxTouchPoints)) {
    setReading('script.touch', String(navigator.maxTouchPoints));
  }
  setReading('script.canvas', getCanvasHash());
  const flags = [
    `webdriver: ${navigator.webdriver ? 'да' : 'нет'}`,
    `DNT: ${navigator.doNotTrack ?? 'не задан'}`,
    `GPC: ${navigator.globalPrivacyControl ? 'да' : 'нет'}`,
  ];
  setReading('script.privacy', flags.join(' · '));
}

async function collectServerReadings() {
  try {
    const response = await fetch(new URL('../api/whoami', document.baseURI), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      if (data.ip) setReading('request.ip', data.ip);
      if (data.geo?.country) setReading('request.country', data.geo.country);
      if (data.geo?.region) setReading('request.region', data.geo.region);
      if (data.geo?.city) setReading('request.city', data.geo.city);
      if (data.geo?.timezone) setReading('request.ipTimezone', data.geo.timezone);
      if (data.headers?.['accept-language']) setReading('request.acceptLanguage', data.headers['accept-language']);
      if (data.headers?.['user-agent']) setReading('request.userAgent', data.headers['user-agent']);
      if (data.headers?.['sec-ch-ua-platform']) setReading('request.secChUaPlatform', data.headers['sec-ch-ua-platform'].replace(/^"|"$/g, ''));
      if (data.headers?.['sec-gpc']) setReading('request.secGpc', data.headers['sec-gpc']);
      if (data.headers?.dnt) setReading('request.dnt', data.headers.dnt);
    }
  } catch {}
}

async function collectNetworkReadings() {
  try {
    const response = await fetch(new URL('../api/ip?format=json', document.baseURI), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      if (data.ip && !snapshot['request.ip']) setReading('request.ip', data.ip);
      if (data.geo?.countryCode && !snapshot['request.country']) setReading('request.country', data.geo.countryCode);
      if (data.geo?.region && !snapshot['request.region']) setReading('request.region', data.geo.region);
      if (data.geo?.city && !snapshot['request.city']) setReading('request.city', data.geo.city);
      if (data.network?.type) setReading('network.type', networkTypeLabel(data.network.type));
      if (data.network?.asn) setReading('network.asn', String(data.network.asn));
      if (data.network?.org || data.network?.isp) setReading('network.org', data.network.org || data.network.isp);
      const proxyFlags = [data.flags?.proxy, data.flags?.vpn, data.flags?.tor];
      if (proxyFlags.some(v => v === true)) setReading('network.proxy', 'Да');
      else if (proxyFlags.some(v => v === false)) setReading('network.proxy', 'Нет');
    }
  } catch {}
}

function renderSummary(findings) {
  const matches = findings.filter(f => f.verdict === 'match').length;
  const mismatches = findings.filter(f => f.verdict === 'mismatch').length;
  const unknown = findings.filter(f => f.verdict === 'unknown').length;
  const count = Object.keys(snapshot).length;
  const total = Object.keys(READING_DEFS).length;
  el('whoami-matches').textContent = String(matches);
  el('whoami-mismatches').textContent = String(mismatches);
  el('whoami-unknown').textContent = String(unknown);
  el('whoami-readings-count').replaceChildren(
    document.createTextNode(String(count)),
    node('span', ` / ${total}`, 'whoami-stat-unit'),
  );
  const place = [snapshot['request.city']?.value, snapshot['request.country']?.value].filter(Boolean).join(', ');
  const placeEl = el('whoami-place');
  if (place) {
    placeEl.textContent = `Выходной IP определяется как ${place}.`;
    placeEl.hidden = false;
  } else {
    placeEl.hidden = true;
  }
}

function renderFindings(findings) {
  const verdictLabel = { match: 'Совпадает', mismatch: 'Расхождение', unknown: 'Нет данных' };
  const verdictSymbol = { match: '=', mismatch: '≠', unknown: '?' };
  const cards = findings.map(finding => {
    const meta = RULE_META[finding.ruleId] || { title: finding.ruleId, description: '' };
    const card = node('article', '', 'whoami-card');
    card.dataset.verdict = finding.verdict;

    const head = node('div', '', 'whoami-card-head');
    const titleWrap = node('div', '', 'whoami-card-title');
    titleWrap.append(node('h3', meta.title), node('p', meta.description, 'whoami-card-desc'));
    const badge = node('span', '', 'whoami-badge');
    badge.dataset.verdict = finding.verdict;
    badge.append(
      node('span', verdictSymbol[finding.verdict], 'whoami-symbol'),
      document.createTextNode(` ${verdictLabel[finding.verdict]}`),
    );
    head.append(titleWrap, badge);
    card.append(head);

    if (finding.evidence.length) {
      const pairs = node('div', '', 'whoami-pairs');
      for (const readingId of finding.evidence) {
        const def = READING_DEFS[readingId];
        const reading = snapshot[readingId];
        const item = node('div', '', 'whoami-pair');
        item.append(
          node('span', def?.label || readingId, 'whoami-pair-label'),
          node('bdi', reading?.value || '—', 'whoami-pair-value'),
        );
        pairs.append(item);
      }
      card.append(pairs);
    }
    return card;
  });
  el('whoami-findings').replaceChildren(...cards);
}

function renderLayers() {
  const sections = LAYER_META.map(layer => {
    const keys = Object.keys(READING_DEFS).filter(id => READING_DEFS[id].layer === layer.id);
    const present = keys.filter(id => snapshot[id]);
    const row = document.createElement('details');
    row.className = 'signal-row';

    const summary = document.createElement('summary');
    const heading = document.createElement('div');
    const title = node('span', '', 'signal-title');
    title.append(
      node('span', layer.title, 'signal-name'),
      node('span', `${present.length} из ${keys.length}`, 'signal-state'),
    );
    heading.append(title, node('span', layer.description, 'signal-description'));
    const points = node('span', '', 'signal-points');
    points.append(
      node('span', String(present.length), 'points-value'),
      node('span', `из ${keys.length}`, 'signal-weight'),
    );
    const chevron = node('span', '', 'chevron');
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(heading, points, chevron);

    const detail = node('div', '', 'signal-detail');
    const dl = document.createElement('dl');
    dl.className = 'measurements';
    for (const id of keys) {
      const def = READING_DEFS[id];
      const reading = snapshot[id];
      const item = node('div', '', 'measurement');
      const dt = node('dt', def.label);
      const dd = document.createElement('dd');
      dd.append(node('bdi', reading ? reading.value : 'Недоступно'));
      if (reading) {
        dd.append(node('span', ` · ${reading.atMs} мс`, 'whoami-timing'));
      }
      item.append(dt, dd);
      dl.append(item);
    }
    detail.append(dl);
    row.append(summary, detail);
    return row;
  });
  el('whoami-layers').replaceChildren(...sections);
}

function renderAll() {
  const findings = evaluateRules(snapshot);
  renderSummary(findings);
  renderFindings(findings);
  renderLayers();
  el('whoami-loading').hidden = true;
  el('whoami-content').hidden = false;
  el('whoami-export').disabled = false;
}

el('whoami-webrtc').addEventListener('click', async () => {
  if (webrtcRunning) return;
  webrtcRunning = true;
  const button = el('whoami-webrtc');
  button.disabled = true;
  button.textContent = 'Проверяем WebRTC…';
  try {
    const result = await inspectWebrtc(true);
    const candidates = result.details?.candidates || [];
    const srflx = candidates.find(c => c.scope === 'public' && c.type === 'srflx')
      || candidates.find(c => c.scope === 'public');
    const hosts = [...new Set(candidates.filter(c => c.scope === 'private').map(c => c.address))];
    setReading('probe.srflxIp', srflx ? srflx.address : 'Не получен');
    setReading('probe.hostIps', hosts.length ? hosts.join(', ') : 'Нет');
  } catch {
    setReading('probe.srflxIp', 'Недоступно');
    setReading('probe.hostIps', 'Недоступно');
  } finally {
    webrtcRunning = false;
    button.disabled = false;
    button.textContent = 'Повторить WebRTC';
    renderAll();
  }
});

el('whoami-export').addEventListener('click', () => {
  const payload = {
    checkedAt: new Date().toISOString(),
    findings: evaluateRules(snapshot),
    readings: snapshot,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'are-you-russian-whoami.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

collectScriptReadings();
Promise.all([collectServerReadings(), collectNetworkReadings()]).then(renderAll);
