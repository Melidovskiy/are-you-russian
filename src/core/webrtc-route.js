export function publicAddress(value) {
  if (typeof value !== 'string') return null;
  const address = value.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1');
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) {
    const octets = address.split('.').map(Number);
    const [a, b] = octets;
    if (octets.some(n => n > 255) || a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return null;
    return { family: 4, value: octets.join('.') };
  }
  if (!address.includes(':') || !/^[0-9a-f:.]+$/.test(address)) return null;
  try {
    const normalized = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(normalized);
    if (mapped) {
      const [a, b] = mapped.slice(1).map(word => parseInt(word, 16));
      return publicAddress([a >> 8, a & 255, b >> 8, b & 255].join('.'));
    }
    if (!/^[23]/.test(normalized)) return null;
    return { family: 6, value: normalized };
  } catch {
    return null;
  }
}

export const routeComparisonLabels = {
  disabled: 'WebRTC выключен',
  unavailable: 'HTTPS IP недоступен',
  no_public: 'Публичный адрес WebRTC не получен',
  other_family: 'WebRTC и HTTPS используют разные семейства IP',
  match: 'Публичный адрес WebRTC совпадает с IP сайта',
  mismatch: 'Публичный адрес WebRTC отличается от IP сайта',
  mixed: 'WebRTC показал совпадающие и отличающиеся адреса',
};

export function compareWebrtcRoute(httpsIp, signal) {
  const https = publicAddress(httpsIp);
  if (signal?.reason === 'disabled') return { status: 'disabled' };
  if (!https) return { status: 'unavailable' };
  const candidates = (signal?.details?.candidates || [])
    .filter(candidate => candidate.scope === 'public' && ['host', 'srflx', 'prflx'].includes(candidate.type))
    .map(candidate => publicAddress(candidate.address)).filter(Boolean);
  const comparable = [...new Set(candidates.filter(ip => ip.family === https.family).map(ip => ip.value))];
  const matched = comparable.includes(https.value);
  const differs = comparable.some(ip => ip !== https.value);
  const status = matched ? (differs ? 'mixed' : 'match') : differs ? 'mismatch'
    : candidates.length ? 'other_family' : 'no_public';
  return { status, https: https.value, family: https.family, comparable };
}
