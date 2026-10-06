import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MAX_EXP, MIN_EXP, STOPS, stopExponent } from './model';
import { sceneAt, measureAxis, measurementLabel, sceneLabels, zoomOverlay } from './scene';

test('44 recognizable references bridge every scale through the observable universe', () => {
  assert.equal(STOPS.length, 44);
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

test('canvas labels distinguish segment length, height, orbit diameter and distance', () => {
  const label = (id: string) => measurementLabel(STOPS.find(s => s.id === id)!);
  assert.equal(label('dna'), '片段长'); assert.equal(label('person'), '身高');
  assert.equal(label('moon'), '中心距离'); assert.equal(label('earth-orbit'), '轨道直径');
  assert.equal(label('comet-orbit'), '长轴'); assert.equal(label('oort-outer'), '模型直径');
});


test('the selected object always keeps its measurement label on mobile and desktop', () => {
  for (const width of [280, 320, 390, 600, 1100]) for (const stop of STOPS) {
    const height = width < 500 ? 430 : 600;
    const labels = sceneLabels(sceneAt(stopExponent(stop), width, height), width, height, stop);
    assert.ok(labels.some(label => label.object.stop.id === stop.id), `${stop.id} at ${width}px lost its label`);
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      assert.ok(Math.abs(labels[i].x - labels[j].x) > (labels[i].width + labels[j].width) / 2 + 6 || Math.abs(labels[i].y - labels[j].y) > 43);
    }
  }
});


test('camera velocity matches across every anchor, not only its position', () => {
  for (const stop of STOPS.slice(1, -1)) {
    // Close extragalactic anchors have higher curvature: reduce truncation error.
    const e = stopExponent(stop), h = 1e-7;
    const x = (value: number) => sceneAt(value, 1100, 600).objects.find(o => o.stop.id === stop.id)!.x;
    const incoming = (x(e) - x(e - h)) / h, outgoing = (x(e + h) - x(e)) / h;
    assert.ok(Math.abs(incoming - outgoing) < .05, `${stop.id} changed camera velocity abruptly`);
  }
});

test('fractional-scale labels do not sit underneath zoom controls', () => {
  for (const width of [280, 320, 390, 600, 1100]) for (let e = MIN_EXP; e < MAX_EXP; e += .041) {
    const height = width < 500 ? 430 : 600;
    const scene = sceneAt(e, width, height), overlay = zoomOverlay(width, height);
    const focus = STOPS.reduce((best, s) => Math.abs(stopExponent(s)-e) < Math.abs(stopExponent(best)-e) ? s : best);
    for (const label of sceneLabels(scene, width, height, focus)) assert.ok(label.x + label.width / 2 < overlay.left || label.y + 22 < overlay.top || label.y - 15 > overlay.bottom);
  }
});
