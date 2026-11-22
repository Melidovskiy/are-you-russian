import test from 'node:test';
import assert from 'node:assert/strict';
import { measureIpFamilies } from '../src/ip-families.js';

test('family probes require opt-in and reject a response of the wrong family', async t => {
  const request = t.mock.method(globalThis, 'fetch', async url =>
    new Response(url.includes('api6.') ? '8.8.4.4' : '1.1.1.1\n'));
  assert.deepEqual(await measureIpFamilies(false), []);
  assert.equal(request.mock.callCount(), 0);
  assert.deepEqual(await measureIpFamilies(true), [
    { family: 4, ip: '1.1.1.1', status: 'ok' }, { family: 6, status: 'unavailable' },
  ]);
  assert.ok(request.mock.calls.every(c => c.arguments[1].credentials === 'omit'));
});

test('one failed probe does not hide a measured IPv6 address', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    if (!url.includes('api6.')) throw new TypeError('Unreachable');
    return new Response('2606:4700:0000::1111');
  });
  assert.deepEqual(await measureIpFamilies(true), [
    { family: 4, status: 'unavailable' }, { family: 6, ip: '2606:4700::1111', status: 'ok' },
  ]);
});
