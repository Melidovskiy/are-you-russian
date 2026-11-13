import test from 'node:test';
import assert from 'node:assert/strict';
import { SIGNALS, detectSignal, summarize } from '../src/signals.js';
import { REGIONS, riskBand, scoreLanguagesForRegion, scoreTimezoneForRegion, signalsFor } from '../src/core/signals.js';
import { assertRegionProfiles } from '../src/core/regions.js';

test('используется российский профиль оригинала с семью исходными весами', () => {
  assertRegionProfiles();
  assert.deepEqual(Object.fromEntries(SIGNALS.map(signal => [signal.id, signal.weight])), {
    timezone: 34, language: 22, vendorFonts: 12, webrtcLeak: 10, cnBrowser: 10, intlLocale: 8, emoji: 4,
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
  results.find(item => item.id === 'webrtcLeak').points = null;
  results.find(item => item.id === 'timezone').points = 34;
  results.find(item => item.id === 'timezone').score = 1;
  assert.deepEqual(summarize(results), { minimum: 34, maximum: 44, band: null, available: 6, matches: 1 });
  assert.equal(summarize([]).maximum, 100);
});

test('вклады складываются до округления, как в оригинале', () => {
  const results = SIGNALS.map(signal => ({ id: signal.id, points: signal.id === 'language' ? 17.6 : signal.id === 'emoji' ? 1.6 : 0, score: 0 }));
  assert.equal(summarize(results).minimum, 19);
  assert.equal(summarize(results).maximum, 19);
});

test('выключенный WebRTC не запускает детектор', async () => {
  let called = false;
  const result = await detectSignal({ id: 'webrtcLeak', weight: 10, detect() { called = true; } }, false);
  assert.equal(called, false);
  assert.equal(result.reason, 'disabled');
  assert.equal(result.points, null);
});

test('ошибки детектора сохраняются как недоступные данные', async () => {
  const result = await detectSignal({ id: 'language', weight: 22, detect() { throw new Error('Blocked'); } }, false);
  assert.equal(result.points, null);
  assert.equal(result.reason, 'unavailable');
});

test('пустой результат Canvas не становится успешной проверкой', async () => {
  const result = await detectSignal({ id: 'vendorFonts', weight: 12, detect() { return { raw: 'canvas unavailable', score: 0 }; } }, false);
  assert.equal(result.points, null);
});
