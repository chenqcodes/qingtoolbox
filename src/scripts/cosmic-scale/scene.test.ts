import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_EXP, MIN_EXP, STOPS, stopExponent } from './model';
import { sceneAt, measureAxis } from './scene';

test('35 recognizable references bridge the former empty decades', () => {
  assert.equal(STOPS.length, 35);
  for (let i = 1; i < STOPS.length; i++) assert.ok(STOPS[i].size / STOPS[i - 1].size <= 15, `${STOPS[i-1].id}→${STOPS[i].id}`);
  for (const id of ['virus', 'bacterium', 'pollen', 'coin', 'tree', 'park', 'moon-body', 'jupiter', 'comet-orbit', 'oort-inner', 'oort-outer', 'nebula', 'cluster', 'bubble', 'arm']) assert.ok(STOPS.find(s => s.id === id));
});

test('every fractional viewport retains a substantial visible physical reference', () => {
  for (const width of [280, 320, 390, 900, 1400]) for (let e = MIN_EXP; e <= MAX_EXP; e += .013) {
    const scene = sceneAt(e, width, 430);
    assert.ok(scene.objects.length > 0 && scene.objects.length <= 6);
    assert.ok(scene.objects.some(o => o.visibleExtent >= Math.min(width, 430) * .24), `empty scene at ${e}`);
    // A bounded painter never traverses every past object or magnifies tiny ones.
    for (const object of scene.objects) {
      assert.ok(Number.isFinite(object.x) && Number.isFinite(object.pixels));
      assert.ok(Math.abs(object.pixels / width - object.stop.size / 10 ** e) < 1e-10);
    }
  }
});

test('adjacent physical bounds never overlap and use one exact ratio', () => {
  for (let e = MIN_EXP; e <= MAX_EXP; e += .019) {
    const scene = sceneAt(e, 900, 600);
    for (let i = 1; i < scene.objects.length; i++) {
      const small = scene.objects[i - 1], large = scene.objects[i];
      assert.ok(small.right < large.left);
      assert.ok(Math.abs(large.pixels / small.pixels - large.stop.size / small.stop.size) < 1e-9);
    }
  }
});

test('camera is continuous on both sides of every stop, with no object teleport', () => {
  for (const stop of STOPS.slice(1, -1)) {
    const e = stopExponent(stop);
    const before = sceneAt(e - 1e-6, 900, 600), after = sceneAt(e + 1e-6, 900, 600);
    for (const object of before.objects) {
      const same = after.objects.find(o => o.stop.id === object.stop.id);
      if (same) assert.ok(Math.abs(object.x - same.x) < .02 && Math.abs(object.pixels - same.pixels) < .1);
    }
  }
});

test('height definitions stay separate from horizontal diameters and distances', () => {
  for (const stop of STOPS) assert.equal(measureAxis(stop), ['person', 'tree'].includes(stop.kind) ? 'vertical' : 'horizontal');
  assert.match(STOPS.find(s => s.id === 'comet-orbit')!.caveat, /虚构/);
  assert.match(STOPS.find(s => s.id === 'oort-outer')!.caveat, /半径 5 万/);
  assert.match(STOPS.find(s => s.id === 'heliosphere')!.caveat, /不是实测全宽/);
});
