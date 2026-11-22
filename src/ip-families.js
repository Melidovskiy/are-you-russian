import { publicAddress } from './core/webrtc-route.js';

const endpoints = { 4: 'https://api.ipify.org/', 6: 'https://api6.ipify.org/' };

async function measure(family) {
  try {
    const response = await fetch(endpoints[family], {
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const address = publicAddress(await response.text());
      if (address?.family === family) return { family, status: 'ok', ip: address.value };
    }
  } catch {}
  return { family, status: 'unavailable' };
}

export function measureIpFamilies(enabled) {
  return enabled ? Promise.all([measure(4), measure(6)]) : Promise.resolve([]);
}

export function describeIpFamily(result) {
  return result.status === 'ok' ? result.ip : 'Не измерен';
}
