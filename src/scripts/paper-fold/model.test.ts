import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AU, LIGHT_YEAR_METRES, OBSERVABLE_UNIVERSE_DIAMETER_METRES, journeyFoldLimit, MIN_FOLDS, MAX_FOLDS,
  DEFAULT_THICKNESS_MM, MIN_THICKNESS_MM, MAX_THICKNESS_MM,
  REFERENCES, clampFolds, clampThickness, thicknessMetres,
  layers, formatLength, scientificMetres, milestoneFold, niceScale,
} from './model';

test('folds are rounded, bounded, and reset on invalid numbers', () => {
  assert.equal(MIN_FOLDS, 0);
  assert.equal(MAX_FOLDS, 107);
  for (const [input, expected] of [[-100, 0], [-0.4, 0], [0, 0], [0.49, 0], [0.5, 1], [7.49, 7], [7.5, 8], [79.9, 80], [80, 80], [107, 107], [107.9, 107], [1e99, 107]]) {
    assert.equal(clampFolds(input), expected);
  }
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(clampFolds(invalid), 0);
});

test('thickness preserves fractions and clamps only to the physical input range', () => {
  assert.equal(DEFAULT_THICKNESS_MM, 0.1);
  assert.equal(MIN_THICKNESS_MM, 0.01);
  assert.equal(MAX_THICKNESS_MM, 1);
  for (const [input, expected] of [[-5, 0.01], [0, 0.01], [0.001, 0.01], [0.01, 0.01], [0.125, 0.125], [1, 1], [10, 1]]) {
    assert.equal(clampThickness(input), expected);
  }
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(clampThickness(invalid), 0.1);
});

test('thickness converts millimetres to metres and doubles on every fold', () => {
  assert.equal(thicknessMetres(0), 0.0001);
  assert.equal(thicknessMetres(1), 0.0002);
  assert.equal(thicknessMetres(10), 0.1024);
  assert.equal(thicknessMetres(42), 439_804_651.1104);
  assert.equal(thicknessMetres(0, 1), 0.001);
  assert.equal(thicknessMetres(1.6, 0.2), thicknessMetres(2, 0.2));
  assert.equal(thicknessMetres(NaN, Infinity), 0.0001);
  assert.equal(thicknessMetres(900, 8), thicknessMetres(MAX_FOLDS, 1));
});

test('layer counts stay exact across all allowed folds, including beyond safe integer precision', () => {
  assert.equal(layers(0), 1n);
  assert.equal(layers(1), 2n);
  assert.equal(layers(53), 9_007_199_254_740_992n);
  assert.equal(layers(80), 1_208_925_819_614_629_174_706_176n);
  assert.equal(layers(Infinity), 1n);
  assert.equal(layers(-5), 1n);
  assert.equal(layers(200), layers(MAX_FOLDS));
  for (let fold = 1; fold <= MAX_FOLDS; fold++) assert.equal(layers(fold), layers(fold - 1) * 2n);
});

test('every allowed fold and thickness stays finite, positive, and monotonic', () => {
  for (let step = 1; step <= 100; step++) {
    const initial = step / 100;
    let previous = 0;
    for (let fold = 0; fold <= MAX_FOLDS; fold++) {
      const metres = thicknessMetres(fold, initial);
      assert.ok(Number.isFinite(metres));
      assert.ok(metres > previous);
      if (fold > 0) assert.equal(metres, previous * 2);
      assert.doesNotMatch(formatLength(metres), /NaN|Infinity|undefined|—/);
      assert.doesNotMatch(scientificMetres(metres), /NaN|Infinity|undefined|—/);
      previous = metres;
    }
  }
});

test('reference dimensions distinguish heights, diameters, and an approximate orbit', () => {
  assert.deepEqual(REFERENCES.map(reference => reference.id), ['person', 'house', 'earth', 'sun', 'solar']);
  assert.deepEqual(REFERENCES.map(reference => reference.metres), [1.7, 10, 12_756_000, 1_391_400_000, 60 * AU]);
  assert.match(REFERENCES[0].dimension, /身高.*示意/);
  assert.match(REFERENCES[1].dimension, /高度.*示意/);
  assert.match(REFERENCES[2].dimension, /赤道直径/);
  assert.match(REFERENCES[3].dimension, /直径/);
  assert.match(REFERENCES[4].dimension, /轨道直径.*60 AU.*近似.*并非太阳系边界/);
  for (const reference of REFERENCES.slice(2)) {
    assert.ok(reference.source?.label);
    assert.ok(reference.source?.url.startsWith('https://'));
    assert.match(new URL(reference.source!.url).hostname, /(^|\.)nasa\.gov$/);
  }
  assert.equal(AU, 149_597_870_700);
  assert.equal(LIGHT_YEAR_METRES, 9_460_730_472_580_800);
});

test('default paper reaches each reference for the first time at the expected fold', () => {
  assert.deepEqual(REFERENCES.map(reference => milestoneFold(reference.metres)), [15, 17, 37, 44, 57]);
  for (const thickness of [0.01, 0.05, 0.1, 0.2, 1]) {
    for (const reference of REFERENCES) {
      const fold = milestoneFold(reference.metres, thickness);
      assert.notEqual(fold, null);
      assert.ok(thicknessMetres(fold!, thickness) >= reference.metres);
      assert.ok(fold === 0 || thicknessMetres(fold! - 1, thickness) < reference.metres);
    }
  }
  assert.equal(milestoneFold(1.7, 0.2), milestoneFold(1.7, 0.1)! - 1);
  assert.equal(milestoneFold(1.7, 0.05), milestoneFold(1.7, 0.1)! + 1);
  assert.equal(milestoneFold(1.7, NaN), milestoneFold(1.7));
});

test('milestones handle exact powers and their immediately higher floating-point neighbors', () => {
  for (const thickness of [0.01, 0.1, 0.13, 1]) {
    for (let fold = 0; fold <= MAX_FOLDS; fold++) {
      const exact = thicknessMetres(fold, thickness);
      assert.equal(milestoneFold(exact, thickness), fold);
      assert.equal(milestoneFold(exact * (1 + Number.EPSILON), thickness), fold === MAX_FOLDS ? null : fold + 1);
    }
  }
});

test('milestones cover zero, an unfolded sheet, unreachable lengths, and invalid references', () => {
  assert.equal(milestoneFold(0), 0);
  assert.equal(milestoneFold(0.00001), 0);
  assert.equal(milestoneFold(thicknessMetres(80)), 80);
  assert.equal(milestoneFold(thicknessMetres(MAX_FOLDS) * 2), null);
  for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.equal(milestoneFold(invalid), null);
});

test('length formatting covers every unit and switches at physical boundaries', () => {
  for (const [metres, output] of [
    [0, '0 毫米'], [0.00001, '0.01 毫米'], [0.0001, '0.1 毫米'],
    [0.009, '9 毫米'], [0.01, '1 厘米'], [0.99, '99 厘米'],
    [1, '1 米'], [1.7, '1.7 米'], [999, '999 米'], [1000, '1 千米'],
    [AU, '1 AU'], [60 * AU, '60 AU'],
    [LIGHT_YEAR_METRES, '1 光年'], [10_000 * LIGHT_YEAR_METRES, '1万 光年'],
  ] as const) assert.equal(formatLength(metres), output);
  assert.match(formatLength(AU * 0.999), /千米$/);
  assert.match(formatLength(LIGHT_YEAR_METRES * 0.999), /AU$/);
  assert.match(formatLength(thicknessMetres(80, 1)), /光年$/);
  for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.equal(formatLength(invalid), '—');
});

test('scientific formatting normalizes rounded mantissas and trims redundant zeroes', () => {
  assert.equal(scientificMetres(0), '0 × 10^0 m');
  assert.equal(scientificMetres(0.0001), '1 × 10^-4 m');
  assert.equal(scientificMetres(104.8576), '1.049 × 10^2 m');
  assert.equal(scientificMetres(9.9999), '1 × 10^1 m');
  assert.equal(scientificMetres(thicknessMetres(80)), '1.209 × 10^20 m');
  for (const invalid of [-1, NaN, Infinity, -Infinity]) assert.equal(scientificMetres(invalid), '—');
});

test('ruler picks the greatest 1/2/5 scale no larger than the available distance', () => {
  for (const [input, expected] of [[0.0001, 0.0001], [0.0019, 0.001], [0.02, 0.02], [0.49, 0.2], [0.5, 0.5], [1, 1], [1.99, 1], [2, 2], [4.99, 2], [5, 5], [9.99, 5], [10, 10], [100, 100], [250, 200], [9e20, 5e20]]) {
    assert.equal(niceScale(input), expected);
  }
  for (const invalid of [0, -1, NaN, Infinity, -Infinity]) assert.equal(niceScale(invalid), 1);
  assert.equal(niceScale(Number.MIN_VALUE), Number.MIN_VALUE);
  assert.ok(Number.isFinite(niceScale(Number.MAX_VALUE)));
  for (let fold = 0; fold <= MAX_FOLDS; fold++) {
    const target = thicknessMetres(fold) * 0.4;
    const scale = niceScale(target);
    assert.ok(scale > 0 && scale <= target);
    assert.ok(target / scale < 2.5);
  }
});

test('every paper ends on its first observable-universe fold, with no unreachable target', () => {
  assert.equal(OBSERVABLE_UNIVERSE_DIAMETER_METRES, 92e9 * LIGHT_YEAR_METRES);
  assert.equal(journeyFoldLimit(.01), 107);
  assert.equal(journeyFoldLimit(.1), 103);
  assert.equal(journeyFoldLimit(1), 100);
  for(let step=1;step<=100;step++) {
    const mm=step/100, limit=journeyFoldLimit(mm);
    assert.ok(limit <= MAX_FOLDS);
    assert.ok(thicknessMetres(limit,mm)>=OBSERVABLE_UNIVERSE_DIAMETER_METRES);
    assert.ok(thicknessMetres(limit-1,mm)<OBSERVABLE_UNIVERSE_DIAMETER_METRES);
    assert.ok(thicknessMetres(limit,mm)<OBSERVABLE_UNIVERSE_DIAMETER_METRES*2);
  }
});
