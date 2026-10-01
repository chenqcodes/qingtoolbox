import assert from 'node:assert/strict';
import test from 'node:test';
import { analyseBands, createParticles, updateParticles } from './particles';
import { fillDemo } from './demo';

test('each frequency band responds independently to bins at its real frequency', () => {
  const freq = new Uint8Array(1024);
  const cases = [[100, 'low'], [1000, 'mid'], [5000, 'high']] as const;
  for (const [hz, band] of cases) {
    freq.fill(0); freq[Math.round(hz / (48000 / 2048))] = 255;
    const values = analyseBands(freq, 48000, 2048);
    assert.ok(values[band] > 0);
    for (const other of ['low', 'mid', 'high'] as const) if (other !== band) assert.equal(values[other], 0);
  }
});

test('empty/silent spectrum and repeated preset changes remain finite', () => {
  assert.deepEqual(analyseBands(new Uint8Array(), 48000, 2048), { low: 0, mid: 0, high: 0 });
  const particles = createParticles(800, 375, 300);
  for (const preset of ['orbit', 'bars', 'rain'] as const) {
    for (let frame = 0; frame < 60; frame++) assert.equal(updateParticles(particles, new Uint8Array(), 375, 300, 2.5, 0.016, undefined, preset), true);
  }
});

test('local demo signal is nonzero, bounded, finite and has smooth boundaries', () => {
  const samples = new Float32Array(48000 * 12);
  fillDemo(samples, 48000);
  let peak = 0;
  for (const sample of samples) { assert.ok(Number.isFinite(sample)); peak = Math.max(peak, Math.abs(sample)); }
  assert.ok(peak > 0.2 && peak < 0.66);
  assert.equal(samples[0], 0); assert.ok(Math.abs(samples.at(-1)!) < 0.001);
});
