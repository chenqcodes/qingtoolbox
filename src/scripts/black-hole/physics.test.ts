import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schwarzschildRadiusKm, referenceQuantities, sceneScale, SHADOW_RADIUS_RS, approach, clamp } from './physics';

test('Schwarzschild radius is about 2.953 km per solar mass and scales linearly', () => {
  assert.ok(Math.abs(schwarzschildRadiusKm(1) - 2.95334) < 0.0001);
  assert.equal(schwarzschildRadiusKm(10), schwarzschildRadiusKm(1) * 10);
  assert.throws(() => schwarzschildRadiusKm(-1));
  assert.throws(() => schwarzschildRadiusKm(Infinity));
});
test('fixed distance in Rs preserves angular size when mass changes', () => {
  const small = referenceQuantities(1, 48), large = referenceQuantities(8, 48);
  assert.equal(small.shadowAngleDegrees, large.shadowAngleDegrees);
  assert.ok(Math.abs(large.rs / small.rs - 1e7) < 1e-6);
  assert.equal(small.shadowRadiusKm, small.rs * SHADOW_RADIUS_RS);
  assert.equal(small.distanceKm, small.rs * 48);
});
test('twice the distance halves the scene scale and small-angle diameter', () => {
  assert.equal(sceneScale(1200, 600, 40), 2 * sceneScale(1200, 600, 80));
  assert.equal(referenceQuantities(6, 40).shadowAngleDegrees, 2 * referenceQuantities(6, 80).shadowAngleDegrees);
});
test('interpolation has no overshoot and immediately accepts a reversed target', () => {
  const next = approach(48, 100, 0.016);
  assert.ok(next > 48 && next < 100);
  assert.ok(approach(next, 25, 0.016) < next);
  assert.ok(Math.abs(approach(48, 100, 0.1) - approach(approach(48, 100, 0.05), 100, 0.05)) < 1e-12);
  assert.equal(clamp(NaN, 25, 110), 25);
});
