export const COUNTRY_LANGS = {
  AR: ['es'], AT: ['de'], AU: ['en'], BE: ['nl', 'fr', 'de'], BR: ['pt'],
  BY: ['ru', 'be'], CA: ['en', 'fr'], CH: ['de', 'fr', 'it'], CL: ['es'],
  CN: ['zh'], CO: ['es'], CZ: ['cs'], DE: ['de'], DK: ['da'], EG: ['ar'],
  ES: ['es'], FI: ['fi', 'sv'], FR: ['fr'], GB: ['en'], GR: ['el'],
  HK: ['zh', 'en'], HU: ['hu'], ID: ['id'], IE: ['en', 'ga'], IL: ['he'],
  IN: ['hi', 'en'], IR: ['fa'], IT: ['it'], JP: ['ja'], KR: ['ko'],
  KZ: ['kk', 'ru'], MX: ['es'], MY: ['ms', 'en'], NG: ['en'], NL: ['nl'],
  NO: ['no'], NZ: ['en'], PH: ['en', 'fil'], PL: ['pl'], PT: ['pt'],
  RO: ['ro'], RU: ['ru'], SA: ['ar'], SE: ['sv'], SG: ['en', 'zh', 'ms'],
  TH: ['th'], TR: ['tr'], TW: ['zh'], UA: ['uk'], US: ['en'],
  VN: ['vi'], ZA: ['en', 'af', 'zu'],
};

export const READING_DEFS = {
  'request.ip': { layer: 'request', label: 'IP-адрес' },
  'request.country': { layer: 'request', label: 'Страна (IP)' },
  'request.region': { layer: 'request', label: 'Регион (IP)' },
  'request.city': { layer: 'request', label: 'Город (IP)' },
  'request.ipTimezone': { layer: 'request', label: 'Часовой пояс IP' },
  'request.acceptLanguage': { layer: 'request', label: 'Accept-Language' },
  'request.userAgent': { layer: 'request', label: 'User-Agent (HTTP)' },
  'request.secChUaPlatform': { layer: 'request', label: 'Sec-CH-UA-Platform' },
  'request.secGpc': { layer: 'request', label: 'Sec-GPC' },
  'request.dnt': { layer: 'request', label: 'DNT' },
  'network.type': { layer: 'network', label: 'Тип сети' },
  'network.asn': { layer: 'network', label: 'ASN' },
  'network.org': { layer: 'network', label: 'Организация' },
  'network.proxy': { layer: 'network', label: 'Прокси / VPN / Tor' },
  'script.timezone': { layer: 'script', label: 'Часовой пояс браузера' },
  'script.languages': { layer: 'script', label: 'Языки браузера' },
  'script.userAgent': { layer: 'script', label: 'User-Agent (JS)' },
  'script.uaDataPlatform': { layer: 'script', label: 'Платформа (Client Hints)' },
  'script.screen': { layer: 'script', label: 'Экран и DPR' },
  'script.gpu': { layer: 'script', label: 'WebGL GPU' },
  'script.cores': { layer: 'script', label: 'Потоки CPU' },
  'script.memory': { layer: 'script', label: 'Память устройства' },
  'script.touch': { layer: 'script', label: 'Точки касания' },
  'script.canvas': { layer: 'script', label: 'Хеш Canvas' },
  'script.privacy': { layer: 'script', label: 'Флаги приватности' },
  'probe.srflxIp': { layer: 'probe', label: 'Публичный IP WebRTC' },
  'probe.hostIps': { layer: 'probe', label: 'Локальные IP WebRTC' },
};

export const RULE_COMPARES = {
  'tz-offset': true,
  'lang-country': true,
  'lang-header-script': true,
  'ua-platform': true,
  'ua-gpu': true,
  'webrtc-ip': true,
  'webrtc-tun': false,
  'ip-network-type': false,
};

function hasAll(s, needs) {
  return needs.every(id => s[id] !== undefined && s[id].value !== '');
}

function presentEvidence(s, needs) {
  return needs.filter(id => s[id] !== undefined && s[id].value !== '');
}

function unknownFinding(ruleId, s, needs) {
  return { ruleId, verdict: 'unknown', evidence: presentEvidence(s, needs), params: {} };
}

export function primarySubtag(tag) {
  return (tag || '').split(/[-_]/)[0].trim().toLowerCase();
}

export function firstLanguageFromHeader(header) {
  let best = null;
  let bestQ = -1;
  for (const part of (header || '').split(',')) {
    const m = /^([a-z]{1,8}(?:-[a-z0-9]{1,8})*)(?:\s*;\s*q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?))?$/i.exec(part.trim());
    if (!m) continue;
    const q = m[2] === undefined ? 1 : Number(m[2]);
    if (q > 0 && q > bestQ) {
      bestQ = q;
      best = primarySubtag(m[1]);
    }
  }
  return best;
}

export function firstScriptLanguage(langs) {
  const first = (langs || '').split(',')[0]?.trim();
  return first ? primarySubtag(first) : null;
}

export function utcOffsetMinutesForZone(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
    if (tzPart === 'GMT' || tzPart === 'UTC') return 0;
    const m = /^(?:GMT|UTC)([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(tzPart);
    if (!m) return null;
    const sign = m[1] === '+' ? 1 : -1;
    const hours = Number(m[2]);
    const mins = Number(m[3] || 0);
    return sign * (hours * 60 + mins);
  } catch {
    return null;
  }
}

export function parseScriptTimezone(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  const m = /^([^\s(]+)(?:\s*\((?:UTC|GMT)([+-])(\d{1,2}):(\d{2})\))?$/.exec(text);
  if (!m) return { zone: text, offsetMin: null };
  let offsetMin = null;
  if (m[2]) {
    const sign = m[2] === '+' ? 1 : -1;
    offsetMin = sign * (Number(m[3]) * 60 + Number(m[4]));
  }
  return { zone: m[1], offsetMin };
}

export function osFamilyFromUserAgent(ua) {
  if (!ua) return null;
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/windows nt|win64|win32/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux|x11/i.test(ua)) return 'Linux';
  return null;
}

export function normalizeOsFamily(raw) {
  const v = (raw || '').replace(/^"|"$/g, '').trim().toLowerCase();
  if (!v) return null;
  if (v.includes('win')) return 'Windows';
  if (v.includes('mac') || v === 'darwin') return 'macOS';
  if (v.includes('android')) return 'Android';
  if (v.includes('ios') || v.includes('iphone') || v.includes('ipad')) return 'iOS';
  if (v.includes('chrome os') || v.includes('cros')) return 'ChromeOS';
  if (v.includes('linux')) return 'Linux';
  return null;
}

export function ipInTunBenchmarkRange(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec((ip || '').trim());
  if (!m) return false;
  const [a, b, c, d] = m.slice(1).map(Number);
  if ([a, b, c, d].some(n => n > 255)) return false;
  return a === 198 && (b === 18 || b === 19);
}

function sameIpFamily(a, b) {
  const aV6 = a.includes(':');
  const bV6 = b.includes(':');
  return aV6 === bV6;
}

export function formatUtcOffset(minutes) {
  if (!Number.isFinite(minutes)) return '—';
  const sign = minutes >= 0 ? '+' : '−';
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = String(Math.abs(minutes) % 60).padStart(2, '0');
  return `UTC${sign}${h}:${m}`;
}

function ruleTzOffset(s) {
  const needs = ['script.timezone', 'request.ipTimezone'];
  if (!hasAll(s, needs)) return unknownFinding('tz-offset', s, needs);
  const script = parseScriptTimezone(s['script.timezone'].value);
  const ipZone = s['request.ipTimezone'].value.trim();
  if (!script || !ipZone) return unknownFinding('tz-offset', s, needs);
  const serverOff = utcOffsetMinutesForZone(ipZone);
  const browserOff = script.offsetMin ?? utcOffsetMinutesForZone(script.zone);
  if (serverOff === null || browserOff === null) return unknownFinding('tz-offset', s, needs);
  return {
    ruleId: 'tz-offset',
    verdict: serverOff === browserOff ? 'match' : 'mismatch',
    evidence: [...needs],
    params: {
      browserOffset: formatUtcOffset(browserOff),
      serverOffset: formatUtcOffset(serverOff),
    },
  };
}

function ruleLangCountry(s) {
  const needs = ['script.languages', 'request.country'];
  if (!hasAll(s, needs)) return unknownFinding('lang-country', s, needs);
  const country = s['request.country'].value.trim().toUpperCase();
  const allowed = COUNTRY_LANGS[country];
  if (!allowed) return unknownFinding('lang-country', s, needs);
  const tags = s['script.languages'].value.split(',').map(t => primarySubtag(t.trim())).filter(Boolean);
  const hit = tags.some(t => allowed.includes(t));
  return {
    ruleId: 'lang-country',
    verdict: hit ? 'match' : 'mismatch',
    evidence: [...needs],
    params: { country, expected: allowed.join(', ') },
  };
}

function ruleLangHeaderScript(s) {
  const needs = ['request.acceptLanguage', 'script.languages'];
  if (!hasAll(s, needs)) return unknownFinding('lang-header-script', s, needs);
  const headerLang = firstLanguageFromHeader(s['request.acceptLanguage'].value);
  const scriptLang = firstScriptLanguage(s['script.languages'].value);
  if (!headerLang || !scriptLang) return unknownFinding('lang-header-script', s, needs);
  return {
    ruleId: 'lang-header-script',
    verdict: headerLang === scriptLang ? 'match' : 'mismatch',
    evidence: [...needs],
    params: { headerLang, scriptLang },
  };
}

function ruleUaPlatform(s) {
  const needs = ['request.userAgent', 'script.uaDataPlatform', 'request.secChUaPlatform'];
  const ua = s['request.userAgent']?.value;
  if (!ua) return unknownFinding('ua-platform', s, needs);
  const platformRaw = s['script.uaDataPlatform']?.value || s['request.secChUaPlatform']?.value;
  if (!platformRaw) return unknownFinding('ua-platform', s, needs);
  const fromUa = osFamilyFromUserAgent(ua);
  const fromPlatform = normalizeOsFamily(platformRaw);
  if (!fromUa || !fromPlatform) return unknownFinding('ua-platform', s, needs);
  return {
    ruleId: 'ua-platform',
    verdict: fromUa === fromPlatform ? 'match' : 'mismatch',
    evidence: presentEvidence(s, needs),
    params: { uaFamily: fromUa, platformFamily: fromPlatform },
  };
}

function ruleUaGpu(s) {
  const needs = ['script.userAgent', 'script.gpu'];
  if (!hasAll(s, needs)) return unknownFinding('ua-gpu', s, needs);
  const ua = s['script.userAgent'].value;
  const gpu = s['script.gpu'].value.toLowerCase();
  if (!gpu || gpu === 'masked' || gpu === 'unavailable' || gpu === 'недоступно') {
    return unknownFinding('ua-gpu', s, needs);
  }
  const isMac = /macintosh|mac os/i.test(ua);
  const isWin = /windows/i.test(ua);
  const isIos = /iphone|ipad/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const d3d = /direct3d|d3d11|d3d12/.test(gpu);
  const apple = /apple|metal/.test(gpu);
  if (isMac && d3d) return { ruleId: 'ua-gpu', verdict: 'mismatch', evidence: [...needs], params: {} };
  if (isWin && apple && !/intel/.test(gpu)) return { ruleId: 'ua-gpu', verdict: 'mismatch', evidence: [...needs], params: {} };
  if ((isMac && apple) || (isWin && d3d) || isIos || isAndroid) {
    return { ruleId: 'ua-gpu', verdict: 'match', evidence: [...needs], params: {} };
  }
  return unknownFinding('ua-gpu', s, needs);
}

function ruleWebrtcIp(s) {
  const needs = ['probe.srflxIp', 'request.ip'];
  if (!hasAll(s, needs)) return unknownFinding('webrtc-ip', s, needs);
  const probe = s['probe.srflxIp'].value.trim().toLowerCase();
  const req = s['request.ip'].value.trim().toLowerCase();
  if (!probe || !req || !sameIpFamily(probe, req)) return unknownFinding('webrtc-ip', s, needs);
  return {
    ruleId: 'webrtc-ip',
    verdict: probe === req ? 'match' : 'mismatch',
    evidence: [...needs],
    params: {},
  };
}

function ruleWebrtcTun(s) {
  const needs = ['probe.hostIps'];
  if (!hasAll(s, needs)) return unknownFinding('webrtc-tun', s, needs);
  const raw = s['probe.hostIps'].value.trim();
  if (!raw || raw === 'none' || raw === 'нет') return unknownFinding('webrtc-tun', s, needs);
  const hosts = raw.split(/,\s*/).filter(Boolean);
  if (hosts.length === 0) return unknownFinding('webrtc-tun', s, needs);
  const tunHit = hosts.some(h => ipInTunBenchmarkRange(h));
  return {
    ruleId: 'webrtc-tun',
    verdict: tunHit ? 'mismatch' : 'match',
    evidence: [...needs],
    params: {},
  };
}

function ruleIpNetworkType(s) {
  const needs = ['network.type', 'network.proxy'];
  const typeReading = s['network.type'];
  const proxyReading = s['network.proxy'];
  if (!typeReading && !proxyReading) return unknownFinding('ip-network-type', s, needs);
  const evidence = presentEvidence(s, needs);
  const type = typeReading?.value ?? '';
  const proxy = (proxyReading?.value ?? '').toLowerCase();
  if (proxy === 'yes' || proxy === 'да' || type === 'Datacenter' || type === 'Дата-центр') {
    return { ruleId: 'ip-network-type', verdict: 'mismatch', evidence, params: {} };
  }
  if (type === 'Residential' || type === 'Домашняя сеть') {
    return { ruleId: 'ip-network-type', verdict: 'match', evidence, params: {} };
  }
  return unknownFinding('ip-network-type', s, needs);
}

export const RULES = [
  { id: 'tz-offset', needs: ['script.timezone', 'request.ipTimezone'], evaluate: ruleTzOffset },
  { id: 'lang-country', needs: ['script.languages', 'request.country'], evaluate: ruleLangCountry },
  { id: 'lang-header-script', needs: ['request.acceptLanguage', 'script.languages'], evaluate: ruleLangHeaderScript },
  { id: 'ua-platform', needs: ['request.userAgent', 'script.uaDataPlatform', 'request.secChUaPlatform'], evaluate: ruleUaPlatform },
  { id: 'ua-gpu', needs: ['script.userAgent', 'script.gpu'], evaluate: ruleUaGpu },
  { id: 'webrtc-ip', needs: ['probe.srflxIp', 'request.ip'], evaluate: ruleWebrtcIp },
  { id: 'webrtc-tun', needs: ['probe.hostIps'], evaluate: ruleWebrtcTun },
  { id: 'ip-network-type', needs: ['network.type', 'network.proxy'], evaluate: ruleIpNetworkType },
];

export function evaluateRules(snapshot) {
  return RULES.map(rule => rule.evaluate(snapshot));
}
