import test from 'node:test';
import assert from 'node:assert/strict';
import ip from '../api/ip.js';
import check from '../api/check.js';
import whoami from '../api/whoami.js';

test('Vercel IP route uses the platform address and ignores query and other forwarding headers', async () => {
  const request = new Request('https://example.test/api/ip?format=json&ip=8.8.8.8', {
    headers: {
      'x-real-ip': '::1',
      'x-forwarded-for': '8.8.8.8',
      'x-vercel-proxied-for': '1.1.1.1',
    },
  });
  const response = await ip.fetch(request);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ip, '::1');
  assert.equal(body.purity, null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('Vercel IP route keeps a missing or invalid platform address unknown', async () => {
  for (const address of ['', 'invalid', '8.8.8.8, 1.1.1.1']) {
    const response = await ip.fetch(new Request('https://example.test/api/ip?format=json', {
      headers: { 'x-real-ip': address, 'x-forwarded-for': '8.8.8.8' },
    }));
    const body = await response.json();
    assert.equal(body.ip, null);
    assert.equal(body.notice.code, 'no_ip');
  }
});

test('Vercel check route preserves language scoring and text negotiation', async () => {
  const headers = { 'x-real-ip': '127.0.0.1', 'accept-language': 'ru-RU,ru;q=0.9' };
  const response = await check.fetch(new Request('https://example.test/api/check?format=json', { headers }));
  const body = await response.json();
  assert.equal(body.signals.find(signal => signal.id === 'language').contribution, 35);
  const text = await check.fetch(new Request('https://example.test/api/check', { headers }));
  assert.ok(text.headers.get('content-type').startsWith('text/plain'));
  assert.match(await text.text(), /Индекс российских настроек/);
});

test('Vercel whoami route returns platform IP, geo, and filtered headers', async () => {
  const response = await whoami.fetch(new Request('https://example.test/api/whoami', {
    headers: {
      'x-real-ip': '198.51.100.7',
      'x-vercel-ip-country': 'NL',
      'accept-language': 'en-US,en;q=0.9',
    },
  }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ip, '198.51.100.7');
  assert.equal(body.geo.country, 'NL');
  assert.equal(body.headers['accept-language'], 'en-US,en;q=0.9');
});

test('all Vercel routes support preflight and reject unsupported methods', async () => {
  for (const route of [ip, check, whoami]) {
    const options = await route.fetch(new Request('https://example.test/api', { method: 'OPTIONS' }));
    assert.equal(options.status, 204);
    const post = await route.fetch(new Request('https://example.test/api', { method: 'POST' }));
    assert.equal(post.status, 405);
  }
});
