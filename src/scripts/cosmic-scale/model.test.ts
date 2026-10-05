import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AU, LIGHT_YEAR, STOPS, MIN_EXP, MAX_EXP, HOME_EXP, clamp, formatLength, nearestStop, nextStop, projectedSize, scaleBar, stopExponent } from './model';

test('SI constants and scientific reference dimensions remain explicit', () => {
  assert.equal(AU, 149_597_870_700);
  assert.equal(LIGHT_YEAR, 9_460_730_472_580_800);
  assert.equal(STOPS.find(s => s.id === 'earth')?.size, 12_756_000);
  assert.equal(STOPS.find(s => s.id === 'moon-body')?.size, 2 * 1_737_400);
  assert.equal(STOPS.find(s => s.id === 'jupiter')?.size, 2 * 69_911_000);
  assert.equal(STOPS.find(s => s.id === 'mercury-orbit')?.size, .774 * AU);
  assert.equal(STOPS.find(s => s.id === 'solar')!.size / AU, 60.12);
  assert.equal(STOPS.find(s => s.id === 'galaxy')!.size / LIGHT_YEAR, 100_000);
  for (const stop of STOPS) { assert.ok(stop.size > 0); assert.ok(stop.dimension); assert.ok(stop.caveat); }
});

test('one decade always changes linear pixel extent by ten', () => {
  for (const stop of STOPS) {
    const exponent = stopExponent(stop);
    assert.ok(Math.abs(projectedSize(stop.size, exponent, 900) - 300) < 1e-9);
    assert.ok(Math.abs(projectedSize(stop.size, exponent, 900) / projectedSize(stop.size, exponent + 1, 900) - 10) < 1e-9);
  }
  assert.ok(Math.abs(projectedSize(1.4e9, 10, 900) / projectedSize(12_756_000, 10, 900) - 109.75227344) < 1e-6);
});

test('stops ordered by metres and reachable without special coordinate changes', () => {
  assert.equal(new Set(STOPS.map(s => s.id)).size, STOPS.length);
  STOPS.forEach((stop, index) => {
    assert.equal(nearestStop(stopExponent(stop)), stop);
    if (index) assert.ok(stop.size > STOPS[index - 1].size);
  });
  assert.equal(nextStop(MIN_EXP, -1), STOPS[0]);
  assert.equal(nextStop(MAX_EXP, 1), STOPS.at(-1));
  assert.equal(nextStop(HOME_EXP, 1).id, 'person');
  assert.equal(nextStop(HOME_EXP, -1).id, 'coin');
});

test('invalid input and both endpoints are bounded', () => {
  assert.equal(clamp(-999), MIN_EXP); assert.equal(clamp(999), MAX_EXP);
  assert.equal(clamp(NaN), HOME_EXP); assert.equal(clamp(Infinity), HOME_EXP);
  assert.equal(clamp(HOME_EXP), HOME_EXP);
});

test('readable unit formatting avoids overflowing exponential strings', () => {
  assert.equal(formatLength(0), '0 米'); assert.equal(formatLength(2e-9), '2 纳米');
  assert.equal(formatLength(7.5e-6), '7.5 微米'); assert.equal(formatLength(.12), '12 厘米');
  assert.equal(formatLength(200), '200 米'); assert.equal(formatLength(30_000), '30 千米');
  assert.equal(formatLength(AU), '1 AU'); assert.equal(formatLength(100_000 * LIGHT_YEAR), '10 万光年');
  assert.equal(formatLength(NaN), '—');
  for (let e = MIN_EXP; e <= MAX_EXP; e += .11) assert.ok(!formatLength(10 ** e).includes('e+'));
});

test('scale ruler is physically correct at all zoom levels and viewport widths', () => {
  for (const width of [320, 800, 1200]) for (let e = MIN_EXP; e <= MAX_EXP; e += .071) {
    const bar = scaleBar(e, width);
    assert.ok(bar.pixels > width * .0799 && bar.pixels <= width * .20001);
    assert.ok(Math.abs(bar.pixels / width - bar.metres / 10 ** e) < 1e-12);
  }
});
