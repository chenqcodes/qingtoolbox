import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlackHoleRenderer, type SceneSettings } from './renderer';

/** Numeric raster checks only. This is not a real browser or a UI screenshot test. */
function harness(width: number, height: number) {
  let pixels = new Uint8ClampedArray(0);
  const ctx = {
    createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData(image: { data: Uint8ClampedArray }) { pixels = image.data.slice(); },
    setTransform() {}, drawImage() {}, save() {}, translate() {}, rotate() {}, beginPath() {}, arc() {}, stroke() {}, restore() {},
  };
  let backingWidth = width, backingHeight = height, dimensionWrites = 0;
  const canvas = {
    get width() { return backingWidth; }, set width(value: number) { backingWidth = value; dimensionWrites++; pixels.fill(0); },
    get height() { return backingHeight; }, set height(value: number) { backingHeight = value; dimensionWrites++; pixels.fill(0); },
    getContext: () => ctx, getBoundingClientRect: () => ({ width, height }),
  };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'document', { value: { createElement: () => ({ ...canvas }) }, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { devicePixelRatio: 1 }, configurable: true });
  const renderer = new BlackHoleRenderer(canvas as unknown as HTMLCanvasElement);
  return { renderer, pixels: () => pixels, dimensionWrites: () => dimensionWrites, setSize: (w: number, h: number) => { width = w; height = h; }, render(settings: SceneSettings, time = 0) { renderer.render(settings, time); return pixels; },
    restore() { renderer.dispose(); if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument); else Reflect.deleteProperty(globalThis, 'document'); if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window'); } };
}
const settings: SceneSettings = { distance: 48, inclination: 78, lensing: true, beaming: true };
function luminousPixels(pixels: Uint8ClampedArray) { let count = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 80 && pixels[i] > pixels[i + 2] * 1.5) count++; return count; }

test('procedural raster has textured emission and changes with time, lensing and distance', () => {
  const h = harness(640, 480);
  try {
    const initial = h.render(settings);
    assert.ok(luminousPixels(initial) > 8000);
    assert.notDeepEqual(h.render(settings, 2), initial);
    assert.notDeepEqual(h.render({ ...settings, lensing: false }), initial);
    const far = h.render({ ...settings, distance: 96 });
    assert.ok(luminousPixels(far) < luminousPixels(initial) * .35);
    const repeat = h.render(settings);
    assert.deepEqual(repeat, initial, 'returning to a prior view at the same time is deterministic');
  } finally { h.restore(); }
});

test('face-on Doppler illustration is invariant to brightness toggle', () => {
  const h = harness(390, 340);
  try {
    const faceOn = h.render({ ...settings, inclination: 0 });
    assert.deepEqual(h.render({ ...settings, inclination: 0, beaming: false }), faceOn);
    const inclined = h.render(settings);
    assert.notDeepEqual(h.render({ ...settings, beaming: false }), inclined);
  } finally { h.restore(); }
});

test('resize is idempotent and synchronously restores a held frame without an animation callback', () => {
  const h = harness(800, 600);
  try {
    const original = h.render(settings, 2.5);
    const writes = h.dimensionWrites(), frames = h.renderer.frames;
    assert.equal(h.renderer.resize(), false);
    assert.equal(h.dimensionWrites(), writes, 'same dimensions must not clear the visible canvas');
    assert.equal(h.renderer.frames, frames);
    assert.deepEqual(h.pixels(), original);
    h.setSize(390, 340);
    assert.equal(h.renderer.resize(), true);
    assert.equal(h.renderer.frames, frames + 1, 'a real resize paints the retained scene synchronously');
    assert.ok(luminousPixels(h.pixels()) > 2000, 'paused/offscreen resize must not leave a cleared frame');
    const mobile = h.pixels();
    assert.deepEqual(h.render(settings, 2.5), mobile, 'the held animation phase is unchanged');
    h.setSize(0, 0);
    assert.equal(h.renderer.resize(), false);
    assert.deepEqual(h.pixels(), mobile, 'transient hidden bounds preserve the last bitmap');
  } finally { h.restore(); }
});

test('bounded desktop and mobile geometry benchmark (numeric harness, no browser)', (t) => {
  for (const [width, height] of [[800, 600], [390, 340]]) {
    const h = harness(width, height);
    try {
      h.render(settings);
      const steady = performance.now(); for (let i = 0; i < 30; i++) h.render(settings, i / 30);
      const steadyMs = (performance.now() - steady) / 30;
      const maps = performance.now(); for (let i = 0; i < 20; i++) h.render({ ...settings, distance: 48 + i * .2, inclination: 78 - i * .2 }, i / 30);
      const mapMs = (performance.now() - maps) / 20;
      t.diagnostic(`${width}×${height}: steady=${steadyMs.toFixed(2)} ms, geometry+frame=${mapMs.toFixed(2)} ms. Excludes browser canvas upload/compositing.`);
      assert.equal(h.renderer.frames, 51);
    } finally { h.restore(); }
  }
});
