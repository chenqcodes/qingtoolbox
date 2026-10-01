import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPLORATIONS, qualitySettings, clampStop } from './exploration';
import { BODY_BY_ID } from './constants';
import { STAR_BY_ID } from './starCatalog';

test('every guided stop resolves to exactly one existing celestial target', () => {
  assert.deepEqual(Object.keys(EXPLORATIONS), ['moon', 'jupiter', 'nearby']);
  for (const route of Object.values(EXPLORATIONS)) {
    assert.match(route.source, /^https:\/\/science\.nasa\.gov\//);
    for (const stop of route.stops) {
      assert.notEqual(!!stop.body, !!stop.star);
      assert.ok(stop.body ? BODY_BY_ID[stop.body] : STAR_BY_ID[stop.star!]);
      assert.ok(stop.text.length > 20);
    }
  }
});
test('manual tours have bounded start and end stops', () => {
  assert.equal(clampStop(-1, 3), 0);
  assert.equal(clampStop(3, 3), 2);
  assert.equal(clampStop(1, 3), 1);
  assert.equal(clampStop(NaN, 3), 0);
});
test('adaptive and low-power graphics never exceed their pixel/bloom budgets', () => {
  assert.deepEqual(qualitySettings('auto', 3, true), { pixelRatio: 1, bloom: false });
  assert.deepEqual(qualitySettings('auto', 3, false), { pixelRatio: 1.5, bloom: true });
  assert.deepEqual(qualitySettings('light', 3, false), { pixelRatio: 1, bloom: false });
  assert.deepEqual(qualitySettings('high', 3, true), { pixelRatio: 2, bloom: true });
  assert.deepEqual(qualitySettings('high', NaN, false), { pixelRatio: 1, bloom: true });
});
