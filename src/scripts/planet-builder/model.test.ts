import test from 'node:test';
import assert from 'node:assert/strict';
import { createSphereMap, createTexture, hash3, illuminatedFraction, noise3, oceanFraction, PRESETS, renderSphere, seaThreshold, surfaceAt, TAU, wrap } from './model';

test('seeded spherical terrain is deterministic, bounded and seamless', () => {
  for (let i = 0; i < 150; i++) {
    const lon = i * .7, lat = (i / 149 - .5) * Math.PI;
    const value = surfaceAt(lon, lat, 2718);
    assert.deepEqual(value, surfaceAt(lon, lat, 2718));
    for (const sample of Object.values(value)) assert.ok(sample >= 0 && sample <= 1);
    assert.ok(Math.abs(value.height - surfaceAt(lon + TAU, lat, 2718).height) < 1e-12);
  }
  assert.notEqual(surfaceAt(1, .2, 2718).height, surfaceAt(1, .2, 3141).height);
  assert.equal(wrap(-.5, TAU), TAU - .5);
});
test('noise is continuous at lattice borders and valid for negative coordinates', () => {
  for (const n of [-3, -1, 0, 2]) {
    assert.ok(Math.abs(noise3(n - 1e-6, -.2, .7, 19) - noise3(n + 1e-6, -.2, .7, 19)) < 1e-5);
    assert.ok(hash3(n, -7, 11, 19) >= 0 && hash3(n, -7, 11, 19) <= 1);
  }
});
test('illuminated disk obeys full, quarter and new phase geometry', () => {
  assert.equal(illuminatedFraction(0), 1);
  assert.equal(illuminatedFraction(90), .5);
  assert.equal(illuminatedFraction(180), 0);
  assert.equal(illuminatedFraction(-10), 1);
  assert.equal(illuminatedFraction(240), 0);
});
test('ocean fraction is area weighted and monotonic as sea level rises', () => {
  const texture = createTexture(2718, 96, 48);
  const low = oceanFraction(texture, 0), middle = oceanFraction(texture, 50), high = oceanFraction(texture, 100);
  assert.ok(0 <= low && low < middle && middle < high && high <= 1);
  assert.equal(seaThreshold(-30), seaThreshold(0));
  assert.equal(seaThreshold(130), seaThreshold(100));
});
test('sphere maps contain unit normals and preserve polar viewing constraints', () => {
  for (const tilt of [-.95, 0, .95]) {
    const map = createSphereMap(64, tilt);
    assert.ok(map.inside.length > 3100 && map.inside.length < 3300);
    for (const i of map.inside) {
      assert.ok(Math.abs(map.x[i] ** 2 + map.y[i] ** 2 + map.z[i] ** 2 - 1) < 1e-6);
      assert.ok(Number.isFinite(map.latitude[i]) && Math.abs(map.latitude[i]) <= Math.PI / 2);
    }
  }
});
test('CPU rasterizer produces colored spherical output with transparent corners', () => {
  const map = createSphereMap(80, .18), texture = createTexture(2718, 128, 64);
  const rgba = new Uint8ClampedArray(80 * 80 * 4);
  renderSphere(rgba, map, texture, PRESETS.oasis, 1.1, 0);
  assert.equal(rgba[3], 0);
  assert.equal(rgba[(40 * 80 + 40) * 4 + 3], 255);
  const colors = new Set<number>();
  for (const i of map.inside) colors.add(rgba[i * 4] << 16 | rgba[i * 4 + 1] << 8 | rgba[i * 4 + 2]);
  assert.ok(colors.size > 2000);
  const copy = new Uint8ClampedArray(rgba.length);
  renderSphere(copy, map, texture, PRESETS.oasis, 1.1, 0);
  assert.deepEqual(copy, rgba);
  renderSphere(copy, map, texture, { ...PRESETS.oasis, phase: 170 }, 1.1, 0);
  const brightness = (data: Uint8ClampedArray) => data.reduce((sum, value, i) => sum + (i % 4 === 3 ? 0 : value), 0);
  assert.ok(brightness(copy) < brightness(rgba) * .45);
});
test('cloud, storm and aurora toggles each change pixels and all presets render', () => {
  const map = createSphereMap(80, .4), texture = createTexture(2718, 128, 64);
  const base = new Uint8ClampedArray(80 * 80 * 4), changed = new Uint8ClampedArray(base.length);
  const settings = { ...PRESETS.oasis, clouds: 0, phase: 115 };
  renderSphere(base, map, texture, settings, .8, 0);
  for (const option of [{ clouds: 100 }, { storm: true }, { aurora: true }]) {
    renderSphere(changed, map, texture, { ...settings, ...option }, .8, 0);
    assert.notDeepEqual(changed, base);
  }
  for (const preset of Object.values(PRESETS)) {
    renderSphere(changed, map, texture, preset, 1.1, .2);
    assert.ok(changed.some(value => value > 0));
  }
});
