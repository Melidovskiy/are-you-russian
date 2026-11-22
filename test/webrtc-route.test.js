import test from 'node:test';
import assert from 'node:assert/strict';
import { compareWebrtcRoute } from '../src/core/webrtc-route.js';

const candidate = (address, type = 'srflx', scope = 'public') => ({ address, type, scope });
const signal = (...candidates) => ({ details: { candidates } });

test('compares equivalent IPv6 and mapped IPv4 addresses', () => {
  assert.equal(compareWebrtcRoute('2606:4700:0:0::1111', signal(candidate('2606:4700::1111'))).status, 'match');
  assert.equal(compareWebrtcRoute('1.1.1.1', signal(candidate('::ffff:0101:0101'))).status, 'match');
});

test('distinguishes a mixed route from exclusions and missing data', () => {
  assert.equal(compareWebrtcRoute('1.1.1.1', signal(candidate('8.8.8.8'))).status, 'mismatch');
  assert.equal(compareWebrtcRoute('1.1.1.1', signal(candidate('1.1.1.1'), candidate('8.8.8.8'))).status, 'mixed');
  assert.equal(compareWebrtcRoute('1.1.1.1', signal(candidate('2606:4700::1111'))).status, 'other_family');
  assert.equal(compareWebrtcRoute('1.1.1.1', signal(candidate('8.8.8.8', 'relay'), candidate('100.64.0.10'), candidate('192.168.1.5'))).status, 'no_public');
  assert.equal(compareWebrtcRoute(null, signal()).status, 'unavailable');
  assert.equal(compareWebrtcRoute(null, { reason: 'disabled' }).status, 'disabled');
});
