import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules, ipInTunBenchmarkRange } from '../src/core/whoami.js';
import { apiResponse, whoamiPayload } from '../src/server/api.js';

function reading(id, value) {
  return { id, layer: id.split('.')[0], value, atMs: 10 };
}

test('whoami rules detect matching and mismatched timezone, language, platform, GPU, WebRTC, and network', () => {
  const consistent = {
    'script.timezone': reading('script.timezone', 'Europe/Berlin (UTC+1:00)'),
    'request.ipTimezone': reading('request.ipTimezone', 'Europe/Berlin'),
    'script.languages': reading('script.languages', 'de-DE, en-US'),
    'request.country': reading('request.country', 'DE'),
    'request.acceptLanguage': reading('request.acceptLanguage', 'de-DE,de;q=0.9,en;q=0.8'),
    'request.userAgent': reading('request.userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    'script.userAgent': reading('script.userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    'script.uaDataPlatform': reading('script.uaDataPlatform', 'Windows'),
    'script.gpu': reading('script.gpu', 'ANGLE (NVIDIA, NVIDIA GeForce Direct3D11 vs_5_0)'),
    'probe.srflxIp': reading('probe.srflxIp', '198.51.100.10'),
    'request.ip': reading('request.ip', '198.51.100.10'),
    'probe.hostIps': reading('probe.hostIps', '192.168.1.20'),
    'network.type': reading('network.type', 'Домашняя сеть'),
    'network.proxy': reading('network.proxy', 'Нет'),
  };
  const ok = Object.fromEntries(evaluateRules(consistent).map(f => [f.ruleId, f.verdict]));
  assert.deepEqual(ok, {
    'tz-offset': 'match',
    'lang-country': 'match',
    'lang-header-script': 'match',
    'ua-platform': 'match',
    'ua-gpu': 'match',
    'webrtc-ip': 'match',
    'webrtc-tun': 'match',
    'ip-network-type': 'match',
  });

  const conflicting = {
    'script.timezone': reading('script.timezone', 'Europe/Moscow (UTC+3:00)'),
    'request.ipTimezone': reading('request.ipTimezone', 'America/New_York'),
    'script.languages': reading('script.languages', 'ru-RU, ru'),
    'request.country': reading('request.country', 'US'),
    'request.acceptLanguage': reading('request.acceptLanguage', 'en-US,en;q=0.9'),
    'request.userAgent': reading('request.userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    'script.userAgent': reading('script.userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),
    'script.uaDataPlatform': reading('script.uaDataPlatform', 'Windows'),
    'script.gpu': reading('script.gpu', 'ANGLE (Intel Direct3D11 vs_5_0)'),
    'probe.srflxIp': reading('probe.srflxIp', '203.0.113.5'),
    'request.ip': reading('request.ip', '198.51.100.10'),
    'probe.hostIps': reading('probe.hostIps', '198.18.0.1'),
    'network.type': reading('network.type', 'Дата-центр'),
    'network.proxy': reading('network.proxy', 'Да'),
  };
  const bad = Object.fromEntries(evaluateRules(conflicting).map(f => [f.ruleId, f.verdict]));
  assert.deepEqual(bad, {
    'tz-offset': 'mismatch',
    'lang-country': 'mismatch',
    'lang-header-script': 'mismatch',
    'ua-platform': 'mismatch',
    'ua-gpu': 'mismatch',
    'webrtc-ip': 'mismatch',
    'webrtc-tun': 'mismatch',
    'ip-network-type': 'mismatch',
  });
  assert.equal(ipInTunBenchmarkRange('198.18.0.1'), true);
  assert.equal(ipInTunBenchmarkRange('192.168.1.1'), false);
});

test('/api/whoami returns filtered headers, decoded Vercel geo, and rejects writes', async () => {
  const headers = new Headers({
    'accept-language': 'ru-RU,ru;q=0.9',
    'user-agent': 'TestBrowser/1.0',
    'sec-ch-ua-platform': '"Windows"',
    'x-vercel-ip-country': 'DE',
    'x-vercel-ip-city': 'Frankfurt%20am%20Main',
    'x-vercel-ip-timezone': 'Europe/Berlin',
    authorization: 'Bearer secret',
  });
  const payload = whoamiPayload(headers, '198.51.100.42');
  assert.equal(payload.ip, '198.51.100.42');
  assert.equal(payload.geo.city, 'Frankfurt am Main');
  assert.equal(payload.geo.timezone, 'Europe/Berlin');
  assert.equal(payload.headers['accept-language'], 'ru-RU,ru;q=0.9');
  assert.equal('authorization' in payload.headers, false);

  const response = await apiResponse('/api/whoami', new Request('http://localhost/api/whoami', { headers }), '198.51.100.42');
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.ip, '198.51.100.42');

  const post = await apiResponse('/api/whoami', new Request('http://localhost/api/whoami', { method: 'POST' }), '198.51.100.42');
  assert.equal(post.status, 405);
});
