import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNALS, detectSignal, inspectWebrtc, formatOffset, resultDetails, summarize } from '../src/signals.js';
import { REGIONS, parseIceCandidate, riskBand, scoreLanguagesForRegion, scoreTimezoneForRegion, signalsFor } from '../src/core/signals.js';
import { assertRegionProfiles } from '../src/core/regions.js';

test('индекс учитывает четыре региональных признака', () => {
  assertRegionProfiles();
  assert.deepEqual(Object.fromEntries(SIGNALS.map(signal => [signal.id, signal.weight])), {
    timezone: 40, language: 35, vendorFonts: 14, cnBrowser: 11,
  });
  assert.equal(SIGNALS.reduce((total, signal) => total + signal.weight, 0), 100);
});

test('связь с известной проверкой Claude Code сохраняется только у китайского часового пояса', () => {
  assert.equal(signalsFor('cn').find(signal => signal.id === 'timezone').claudeUsed, true);
  assert.ok(SIGNALS.every(signal => !signal.claudeUsed));
});

test('исходный детектор сравнивает часовые пояса по названию', () => {
  for (const timezone of ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Anadyr']) assert.equal(scoreTimezoneForRegion(timezone, REGIONS.ru), 1);
  for (const timezone of ['Europe/Minsk', 'Europe/Istanbul', 'Europe/Stockholm', 'UTC']) assert.equal(scoreTimezoneForRegion(timezone, REGIONS.ru), 0);
});

test('сохраняется исходный вклад языка и порядка языков', () => {
  assert.equal(scoreLanguagesForRegion(['ru-RU'], 'ru'), 1);
  assert.equal(scoreLanguagesForRegion(['ru'], 'ru'), 0.8);
  assert.equal(scoreLanguagesForRegion(['en-US', 'ru-RU'], 'ru'), 0.7);
  assert.equal(scoreLanguagesForRegion(['en-US'], 'ru'), 0);
});

test('сохраняются исходные пороги индекса', () => {
  assert.equal(riskBand(30), 'low');
  assert.equal(riskBand(31), 'medium');
  assert.equal(riskBand(60), 'medium');
  assert.equal(riskBand(61), 'high');
});

test('непроверенный сигнал расширяет диапазон', () => {
  const results = SIGNALS.map(signal => ({ id: signal.id, points: 0, score: 0 }));
  results.find(item => item.id === 'cnBrowser').points = null;
  results.find(item => item.id === 'timezone').points = 40;
  results.find(item => item.id === 'timezone').score = 1;
  assert.deepEqual(summarize(results), { minimum: 40, maximum: 51, band: null, available: 3, matches: 1 });
  assert.equal(summarize([]).maximum, 100);
});

test('вклад каждой проверки округляется перед сложением, как в оригинале', () => {
  const results = SIGNALS.map(signal => ({ id: signal.id, points: signal.id === 'language' ? 17.6 : signal.id === 'cnBrowser' ? 1.6 : 0, score: 0 }));
  assert.equal(summarize(results).minimum, 20);
  assert.equal(summarize(results).maximum, 20);
});

test('выключенный WebRTC не запускает детектор', async () => {
  assert.deepEqual(await inspectWebrtc(false), { reason: 'disabled' });
});

test('ошибки детектора сохраняются как недоступные данные', async () => {
  const result = await detectSignal({ id: 'language', weight: 35, detect() { throw new Error('Blocked'); } });
  assert.equal(result.points, null);
  assert.equal(result.reason, 'unavailable');
});

test('пустой результат Canvas не становится успешной проверкой', async () => {
  const result = await detectSignal({ id: 'vendorFonts', weight: 14, detect() { return { raw: 'canvas unavailable', score: 0 }; } });
  assert.equal(result.points, null);
});

test('IPv6 с сокращением и тип ICE сохраняются', () => {
  assert.deepEqual(parseIceCandidate({ candidate: 'candidate:1 1 udp 123 2001:db8::15 443 typ srflx' }),
    { address: '2001:db8::15', type: 'srflx', scope: 'public' });
});

test('локальные адреса и mDNS различаются', () => {
  for (const address of ['10.0.0.2', '192.168.1.5', '172.16.0.1', '172.31.255.1', 'fe80::2', 'fd00::4', '::1', '::ffff:192.168.1.2']) {
    assert.equal(parseIceCandidate({ address, type: 'host' }).scope, 'private', address);
  }
  assert.equal(parseIceCandidate({ address: 'device.local', type: 'host' }).scope, 'masked');
  assert.equal(parseIceCandidate({ address: 'device.LOCAL', type: 'host' }).scope, 'masked');
  assert.equal(parseIceCandidate({ address: '172.32.0.1', type: 'srflx' }).scope, 'public');
  assert.equal(parseIceCandidate({ address: '0.0.0.0' }), null);
  assert.equal(parseIceCandidate({ candidate: '' }), null);
});

test('отчёт сохраняет подробности и время измерения', async () => {
  const details = { languages: ['en-US', 'ru-RU'], primaryLanguage: 'en-US' };
  const result = await detectSignal({ id: 'language', weight: 35,
    detect: () => ({ raw: 'en-us, ru-ru', score: 0.7, details }) });
  assert.deepEqual(result.details, details);
  assert.equal(result.points, 25);
  assert.ok(Number.isFinite(result.elapsedMs));
});

test('некорректная оценка сохраняет проверку как недоступную', async () => {
  for (const score of [NaN, Infinity, -1, 1.1]) {
    const result = await detectSignal({ id: 'timezone', weight: 40, detect: () => ({ raw: 'Europe/Moscow', score }) });
    assert.equal(result.points, null);
    assert.equal(result.reason, 'unavailable');
  }
});

test('повторные и посторонние записи не увеличивают число проверок', () => {
  const summary = summarize([{ id: 'timezone', points: 40, score: 1 },
    { id: 'timezone', points: 40, score: 1 }, { id: 'other', points: 100, score: 1 }]);
  assert.equal(summary.available, 1);
  assert.equal(summary.matches, 1);
  assert.equal(summary.minimum, 40);
  assert.equal(summary.maximum, 100);
});

test('невозможный вклад не выходит за пределы ста баллов', () => {
  const summary = summarize([{ id: 'timezone', points: 500, score: 1 }]);
  assert.equal(summary.minimum, 0);
  assert.equal(summary.maximum, 100);
});

test('смещение UTC показывает неполные часы и нулевое смещение', () => {
  assert.equal(formatOffset(330), 'UTC+5:30');
  assert.equal(formatOffset(-210), 'UTC−3:30');
  assert.equal(formatOffset(0), 'UTC+0:00');
  assert.equal(formatOffset(undefined), 'Недоступно');
});

test('каждый шрифт и порядок языков попадают в подробные результаты', () => {
  const fonts = [{ name: 'YS Text', available: false }, { name: 'VK Sans Display', available: true }];
  assert.deepEqual(resultDetails({ id: 'vendorFonts' }, { details: { fonts } }),
    [['YS Text', 'Не найден'], ['VK Sans Display', 'Найден']]);
  assert.deepEqual(resultDetails({ id: 'language' }, { details: { primaryLanguage: 'en-US', languages: ['en-US', 'ru-RU'], formats: { locale: 'ru-RU' } } }),
    [['Основной язык', 'en-US'], ['Приоритет 1', 'en-US'], ['Приоритет 2', 'ru-RU'],
      ['Локаль форматов', 'ru-RU'], ['Календарь', 'Недоступно'], ['Цифры', 'Недоступно'],
      ['Пример даты', 'Недоступно'], ['Пример числа', 'Недоступно']]);
});

test('WebRTC собирает IPv4, IPv6 и mDNS, затем закрывает соединение', async () => {
  const keys = ['window', 'RTCPeerConnection'];
  const descriptors = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  let closed = 0;
  class Peer {
    createDataChannel() {}
    async createOffer() { return { type: 'offer', sdp: '' }; }
    async setLocalDescription() {
      for (const address of ['192.168.1.2', '2001:db8::15', 'phone.local']) {
        this.onicecandidate({ candidate: { address, type: 'host', candidate: `candidate:1 1 udp 1 ${address} 443 typ host` } });
      }
      this.onicecandidate({ candidate: null });
    }
    close() { closed += 1; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { RTCPeerConnection: Peer } });
  Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: Peer });
  try {
    const result = await inspectWebrtc(true);
    assert.equal(result.reason, 'measured');
    assert.equal('points' in result, false);
    assert.ok(SIGNALS.every(signal => signal.id !== 'webrtcLeak'));
    assert.equal(result.details.candidates.length, 3);
    assert.deepEqual(result.details.candidates.map(candidate => candidate.scope), ['private', 'public', 'masked']);
    assert.equal(closed, 1);
  } finally {
    keys.forEach((key, index) => {
      if (descriptors[index]) Object.defineProperty(globalThis, key, descriptors[index]);
      else delete globalThis[key];
    });
  }
});
