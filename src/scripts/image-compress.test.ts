import assert from 'node:assert/strict';
import test from 'node:test';
import { compressToTarget, fitDimensions, parseOptionalDimension, safeOutputName, targetFromKB, uniqueOutputNames, type CompressionOptions, type OutputMime } from './image-compress/core';

const options = (overrides: Partial<CompressionOptions> = {}): CompressionOptions => ({ width: 800, height: 400, mime: 'image/jpeg', maxQuality: 0.92, targetBytes: 50_000, allowResize: false, ...overrides });
const blob = (size: number, mime: OutputMime = 'image/jpeg') => new Blob([new Uint8Array(size)], { type: mime });

test('width and height bounds preserve the full image and never upscale', () => {
  assert.deepEqual(fitDimensions(800, 400, 300, 300), { width: 300, height: 150 });
  assert.deepEqual(fitDimensions(400, 800, 300, 300), { width: 150, height: 300 });
  assert.deepEqual(fitDimensions(800, 400, 200), { width: 200, height: 100 });
  assert.deepEqual(fitDimensions(800, 400, undefined, 100), { width: 200, height: 100 });
  assert.deepEqual(fitDimensions(800, 400, 1600, 1600), { width: 800, height: 400 });
  assert.deepEqual(fitDimensions(800, 400, undefined, undefined, 0.5), { width: 400, height: 200 });
  assert.deepEqual(fitDimensions(1, 100, 1, 1), { width: 1, height: 1 });
});

test('rejects invalid, unsafe, fractional and excessive dimensions', () => {
  assert.equal(parseOptionalDimension(''), undefined);
  assert.equal(parseOptionalDimension('300'), 300);
  for (const value of ['0', '-2', '2.4', 'NaN', 'Infinity', '20000']) assert.throws(() => parseOptionalDimension(value));
  assert.throws(() => fitDimensions(0, 20));
  assert.throws(() => fitDimensions(8000, 8000));
  assert.throws(() => fitDimensions(800, 400, 0));
  assert.throws(() => fitDimensions(800, 400, undefined, undefined, 0));
});

test('target KB has an explicit, non-rounded byte ceiling', () => {
  assert.equal(targetFromKB('200'), 204800);
  assert.equal(targetFromKB('0.1'), 102);
  assert.equal(targetFromKB('1.001'), 1025);
  for (const value of ['', '0', '-10', 'Infinity', 'nope', '102401']) assert.throws(() => targetFromKB(value));
});

test('safe names prevent paths, HTML markup, reserved names and suffix collisions', () => {
  assert.equal(safeOutputName('../../photo.png', 'image/jpeg'), 'photo.jpg');
  assert.equal(safeOutputName('folder\\photo.png', 'image/webp'), 'photo.webp');
  assert.equal(safeOutputName('<img onerror="x">.png', 'image/jpeg'), '_img onerror=_x__.jpg');
  assert.equal(safeOutputName('CON.jpg', 'image/png'), 'image-CON.png');
  assert.equal(safeOutputName('.png', 'image/png'), 'image.png');
  assert.deepEqual(uniqueOutputNames(['pic.jpg', 'pic.jpg', 'pic-1.jpg', 'PIC.jpg']), ['pic.jpg', 'pic-1.jpg', 'pic-1-1.jpg', 'PIC-2.jpg']);
});

test('manual mode encodes once at the chosen quality', async () => {
  const calls: number[] = [];
  const result = await compressToTarget(async (_w, _h, q) => { calls.push(q); return blob(1234); }, options({ targetBytes: undefined }));
  assert.deepEqual(calls, [0.92]);
  assert.equal(result.targetMet, undefined);
  assert.equal(result.blob.size, 1234);
  assert.equal(result.resized, false);
});

test('exact byte boundary passes without reducing quality', async () => {
  let calls = 0;
  const result = await compressToTarget(async () => { calls++; return blob(204800); }, options({ targetBytes: targetFromKB('200') }));
  assert.equal(result.targetMet, true);
  assert.equal(result.quality, 0.92);
  assert.equal(calls, 1);
});

test('quality search keeps dimensions and picks a measured passing candidate', async () => {
  const result = await compressToTarget(async (_w, _h, q) => blob(Math.ceil(100000 * q)), options());
  assert.equal(result.targetMet, true);
  assert.ok(result.blob.size <= 50000);
  assert.ok(result.quality! <= 0.5 && result.quality! > 0.49);
  assert.equal(result.width, 800);
  assert.equal(result.height, 400);
  assert.equal(result.resized, false);
});

test('fixed size returns an explicitly failing result rather than silently resizing', async () => {
  const sizes: string[] = [];
  const result = await compressToTarget(async (w, h, q) => { sizes.push(`${w}x${h}`); return blob(1000 + Math.ceil(q * 1000)); }, options({ targetBytes: 1000 }));
  assert.equal(result.targetMet, false);
  assert.equal(result.quality, 0.1);
  assert.equal(result.blob.size, 1100);
  assert.equal(result.resized, false);
  assert.deepEqual(new Set(sizes), new Set(['800x400']));
});

test('optional size search uses the same aspect-fit image and actually meets the target', async () => {
  const result = await compressToTarget(async (w, h, q) => blob(100 + Math.ceil(w * h * q)), options({ targetBytes: 4000, allowResize: true }));
  assert.equal(result.targetMet, true);
  assert.ok(result.blob.size <= 4000);
  assert.ok(result.width < 800 && result.height < 400);
  assert.ok(Math.abs(result.width - result.height * 2) <= 1);
  assert.equal(result.resized, true);
});

test('PNG skips fake quality search and stays fixed unless explicitly allowed to shrink', async () => {
  let calls = 0;
  const encoder = async (w: number, h: number) => { calls++; return blob(200 + w * h, 'image/png'); };
  const fixed = await compressToTarget(encoder, options({ mime: 'image/png', targetBytes: 1000 }));
  assert.equal(fixed.targetMet, false);
  assert.equal(fixed.quality, undefined);
  assert.equal(calls, 1);
  const shrinking = await compressToTarget(encoder, options({ mime: 'image/png', targetBytes: 1000, allowResize: true }));
  assert.equal(shrinking.targetMet, true);
  assert.ok(shrinking.blob.size <= 1000);
  assert.ok(shrinking.width < 800);
});

test('an impossible target is bounded and reports failure even at minimum dimensions', async () => {
  let calls = 0;
  const result = await compressToTarget(async (w, h) => { calls++; return blob(1000 + w * h, 'image/png'); }, options({ mime: 'image/png', targetBytes: 1, allowResize: true }));
  assert.equal(result.targetMet, false);
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
  assert.ok(calls <= 19);
});

test('rejects silently substituted output types and empty encodes', async () => {
  await assert.rejects(compressToTarget(async () => blob(100, 'image/png'), options()), /浏览器不支持/);
  await assert.rejects(compressToTarget(async () => blob(0), options()), /导出为空/);
});

test('cancellation before and after an asynchronous encode cannot return a stale result', async () => {
  let calls = 0;
  await assert.rejects(compressToTarget(async () => { calls++; return blob(100); }, options(), () => true), { name: 'AbortError' });
  assert.equal(calls, 0);
  let cancelled = false;
  await assert.rejects(compressToTarget(async () => { cancelled = true; return blob(100); }, options(), () => cancelled), { name: 'AbortError' });
});

test('invalid compression settings fail before allocating an output', async () => {
  const encoder = async () => { throw new Error('must not encode'); };
  await assert.rejects(compressToTarget(encoder, options({ maxQuality: 0 })), /质量无效/);
  await assert.rejects(compressToTarget(encoder, options({ width: Infinity })), /输出尺寸/);
  await assert.rejects(compressToTarget(encoder, options({ targetBytes: 0 })), /目标大小无效/);
});
