import test from 'node:test';
import assert from 'node:assert/strict';
import { apiResponse, clientIp, checkHeaders } from '../src/server/api.js';
import { evaluateIp, buildPurity, parseProxycheck, parseAbuse, parseIpwho, rateLimit } from '../src/server/ip-purity.js';

test('forwarded headers cannot replace an untrusted peer address', () => {
  const headers = new Headers({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.1.1.1' });
  assert.equal(clientIp('::ffff:192.0.2.15', headers, ''), '192.0.2.15');
  assert.equal(clientIp('127.0.0.1', headers, '127.0.0.1'), '8.8.8.8');
  assert.equal(clientIp('127.0.0.1', new Headers({ 'x-real-ip': '8.8.8.8,1.1.1.1' }), '127.0.0.1'), '127.0.0.1');
});

test('HTTP check leaves browser-only and missing signals unknown', () => {
  const empty = checkHeaders(new Headers());
  assert.equal(empty.minimum, 0);
  assert.equal(empty.maximum, 100);
  assert.equal(empty.normalizedScore, null);
  const russian = checkHeaders(new Headers({ 'accept-language': 'ru-RU,ru;q=0.9', 'user-agent': 'Mozilla Windows YaBrowser/26' }));
  assert.equal(russian.minimum, 46);
  assert.equal(russian.measuredWeight, 46);
  assert.equal(russian.signals.find(x => x.id === 'timezone').measured, false);
  assert.equal(russian.signals.find(x => x.id === 'language').contribution, 35);
});

test('Accept-Language ignores excluded and wildcard languages and orders positive preferences', () => {
  const language = value => checkHeaders(new Headers({ 'accept-language': value })).signals.find(x => x.id === 'language');
  assert.equal(language('en-US,ru-RU;q=0').contribution, 0);
  assert.equal(language('ru-RU;q=0.2, en-US;q=0.9, *;q=1').contribution, 25);
  assert.equal(language('en-US;q=0.2, RU-RU;Q=0.9').contribution, 35);
  assert.equal(language('*;q=1, ru;q=0.000, ru-RU;q=2').measured, false);
});
test('private addresses never trigger reputation network requests', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('unexpected network'); };
  try {
    const outcome = await evaluateIp(new Headers(), '127.0.0.1');
    assert.equal(outcome.body.purity, null);
    assert.equal(outcome.body.notice.code, 'private_ip');
  } finally { globalThis.fetch = original; }
});

test('API ignores arbitrary query IP and forged forwarding headers', async () => {
  const response = await apiResponse('/api/ip', new Request('http://localhost/api/ip?ip=8.8.8.8&format=json', { headers: { 'x-forwarded-for': '8.8.8.8' } }), '127.0.0.1');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ip, '127.0.0.1');
  assert.equal(body.purity, null);
  assert.equal(JSON.stringify(body).includes('API_KEY'), false);
});

test('IP score remains separate and unknown without reputation data', () => {
  const unknown = { status: 'unconfigured' };
  const geo = { country: null, city: null, region: null, countryCode: null };
  const input = { ip: '8.8.8.8', sourcesConfigured: false, sources: { proxycheck: unknown, abuseipdb: unknown, ipwho: parseIpwho({ success: true, country: 'Sweden', country_code: 'SE', connection: { asn: 1234, isp: 'Test' } }) }, vercelGeo: geo, notice: null };
  assert.equal(buildPurity(input).purity, null);
  const proxy = parseProxycheck({ status: 'ok', '8.8.8.8': { proxy: 'yes', type: 'VPN', risk: 80 } }, '8.8.8.8');
  const abuse = parseAbuse({ data: { abuseConfidenceScore: 50, usageType: 'Data Center/Web Hosting/Transit' } });
  const result = buildPurity({ ...input, sourcesConfigured: true, sources: { ...input.sources, proxycheck: proxy, abuseipdb: abuse } });
  assert.ok(result.purity < 70);
  assert.ok(result.deductions.length > 0);
});

test('rate limiting recovers after a minute', () => {
  for (let i = 0; i < 30; i++) assert.equal(rateLimit('test-client', 1000), true);
  assert.equal(rateLimit('test-client', 1000), false);
  assert.equal(rateLimit('test-client', 61001), true);
});

test('API supports preflight and rejects writes', async () => {
  const options = await apiResponse('/api/check', new Request('http://localhost/api/check', { method: 'OPTIONS' }), '127.0.0.1');
  assert.equal(options.status, 204);
  const post = await apiResponse('/api/check', new Request('http://localhost/api/check', { method: 'POST' }), '127.0.0.1');
  assert.equal(post.status, 405);
});

test('source failures stay unknown and cached results avoid repeated lookups', async () => {
  const originalFetch = globalThis.fetch;
  const savedKeys = [process.env.PROXYCHECK_API_KEY, process.env.ABUSEIPDB_API_KEY];
  delete process.env.PROXYCHECK_API_KEY;
  delete process.env.ABUSEIPDB_API_KEY;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ success: false }), { status: 503 }); };
  try {
    const first = await evaluateIp(new Headers(), '9.9.9.9');
    const second = await evaluateIp(new Headers(), '9.9.9.9');
    assert.equal(first.body.purity, null);
    assert.equal(second.body.purity, null);
    assert.equal(first.body.sourcesConfigured, false);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [index, key] of ['PROXYCHECK_API_KEY', 'ABUSEIPDB_API_KEY'].entries()) {
      if (savedKeys[index] === undefined) delete process.env[key];
      else process.env[key] = savedKeys[index];
    }
  }
});
