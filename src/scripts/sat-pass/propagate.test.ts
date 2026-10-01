import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSatrec, findPasses, lookAt, satelliteSunlit, visibilityAt, refineBoundary } from './propagate';
import { tleEpoch, tleFreshness, validateTle, parseTleText } from './tle';
import { azElToXY } from './sky-viz';
// Immutable regression fixture, independent of the frequently updated deployment snapshot.
const bundledTle = validateTle({ line1: '1 25544U 98067A   26273.85230731  .00003748  00000+0  76931-4 0  9990', line2: '2 25544  51.6316 137.1559 0007005 207.6272 152.4345 15.48699564588139' });
const when = new Date('2026-10-01T11:00:00Z');
test('true line-1 epoch, checksums and data age are verified independently of fetch time', () => {
  const epoch = tleEpoch(bundledTle.line1);
  assert.equal(epoch.toISOString(), '2026-09-30T20:27:19.351Z');
  assert.ok(tleFreshness(bundledTle, when).usable);
  assert.equal(tleFreshness({ ...bundledTle, fetchedAt: '2099-01-01' }, new Date(+epoch + 8 * 86400000)).usable, false);
  assert.throws(() => validateTle({ ...bundledTle, line1: `${bundledTle.line1.slice(0, 68)}9` }), /校验和/);
  assert.throws(() => parseTleText('<html>blocked</html>'));
  assert.throws(() => findPasses(loadSatrec(bundledTle), 39.9, 116.4, new Date('2026-10-20T00:00Z')), /历元/);
});
test('refines horizon crossings and maximum, keeps ongoing pass, filters daylight/shadow', () => {
  const sat = loadSatrec(bundledTle); const passes = findPasses(sat, 39.9, 116.4, when);
  assert.ok(passes.length > 0); assert.ok(passes.some(p => p.visible.length)); assert.ok(passes.some(p => !p.visible.length));
  for (const p of passes) {
    assert.ok(p.start < p.max && p.max < p.end);
    assert.ok(Math.abs(lookAt(sat, p.start, 39.9, 116.4)!.elevation) < 0.1);
    assert.ok(Math.abs(lookAt(sat, p.end, 39.9, 116.4)!.elevation) < 0.1);
    for (const w of p.visible) {
      assert.ok(w.start >= p.start && w.end <= p.end);
      const v = visibilityAt(sat, new Date((+w.start + +w.end) / 2), 39.9, 116.4);
      assert.ok(v.sunlit && v.sunAltitude <= -6 && v.likelyVisible);
    }
  }
  const ongoing = findPasses(sat, 39.9, 116.4, passes[0].max, 1)[0];
  assert.ok(Math.abs(+ongoing.start - +passes[0].start) < 1000);
});
test('shadow model distinguishes Earth night side, sun side and off-axis sunlit', () => {
  const sun = { x: 149597870, y: 0, z: 0 };
  assert.equal(satelliteSunlit({ x: -6800, y: 0, z: 0 }, sun), false);
  assert.equal(satelliteSunlit({ x: 6800, y: 0, z: 0 }, sun), true);
  assert.equal(satelliteSunlit({ x: 0, y: 6800, z: 0 }, sun), true);
  assert.ok(Math.abs(refineBoundary(0, 10000, t => t >= 4000) - 4000) < 500);
});
test('all cardinal directions fit full circular sky and zenith is its center', () => {
  assert.deepEqual(azElToXY(0, 90, 100, 100, 80), { x: 100, y: 100 });
  const n = azElToXY(0, 0, 100, 100, 80), e = azElToXY(90, 0, 100, 100, 80), s = azElToXY(180, 0, 100, 100, 80), w = azElToXY(270, 0, 100, 100, 80);
  assert.ok(n.y < 100 && e.x > 100 && s.y > 100 && w.x < 100);
});

test('checksum-valid but malformed orbital fields and decayed states are rejected', () => {
  const withField = (start: number, end: number, value: string) => {
    const raw = bundledTle.line2.slice(0, start) + value + bundledTle.line2.slice(end, 68);
    const checksum = [...raw].reduce((n, c) => n + (c === '-' ? 1 : /\d/.test(c) ? Number(c) : 0), 0) % 10;
    return { ...bundledTle, line2: raw + checksum };
  };
  assert.throws(() => validateTle(withField(52, 63, '           ')), /参数/);
  assert.throws(() => validateTle(withField(52, 63, ' 0.00000000')), /参数/);
  assert.throws(() => validateTle(withField(8, 16, '181.0000')), /参数/);
  assert.throws(() => validateTle(withField(17, 25, '360.0000')), /参数/);
  assert.throws(() => validateTle(withField(26, 33, '       ')), /参数/);
  assert.throws(() => validateTle(withField(52, 63, '18.00000000')), /轨道/);
});
