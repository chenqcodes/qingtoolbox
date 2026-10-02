import test from 'node:test';
import assert from 'node:assert/strict';
import { RainModel, MAX_DEPTH } from './model';
test('closed grid conserves rain minus explicit sinks', () => {
  const m = new RainModel(); m.preset('neighborhood');
  for (let i = 0; i < 1000; i++) m.step(0.05, 65, 40);
  assert.ok(m.summary().total > 0); assert.ok(Math.abs(m.summary().balance) < 1e-7);
  assert.ok(m.water.every(v => v >= 0 && v <= MAX_DEPTH));
});
test('flow follows head and respects building barriers', () => {
  const m = new RainModel(3, 1); m.tiles.fill(1); m.elevation.fill(0); m.water[0] = 1; m.tiles[1] = 2;
  m.step(0.05, 0, 0); assert.equal(m.water[0], 1); assert.equal(m.water[2], 0);
  m.tiles[1] = 1; m.step(0.05, 0, 0); assert.ok(m.water[0] < 1); assert.ok(m.water[1] > 0);
  assert.ok(Math.abs(m.water.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});
test('positive conservative transport under extreme head gradients', () => {
  const m = new RainModel(5, 5); m.tiles.fill(1); m.elevation[12] = 1000; m.water[12] = 1;
  for (let i = 0; i < 100; i++) m.step(0.1, 0, 0);
  assert.ok(m.water.every(v => v >= 0)); assert.ok(Math.abs(m.summary().total - 1) < 1e-12);
});
test('drain and park remove water with explicit budget tracking', () => {
  const park = new RainModel(1, 1); park.tiles[0] = 3; park.step(0.1, 100, 0); assert.equal(park.water[0], 0);
  const drain = new RainModel(1, 1); drain.tiles[0] = 4; drain.step(0.1, 100, 100); assert.equal(drain.water[0], 0);
  assert.ok(park.budget.infiltrated > 0); assert.ok(drain.budget.drained > 0);
});
test('building edits, capacity overflow and all-building grids stay finite and accounted', () => {
  const m = new RainModel(3, 3); m.tiles.fill(1); for (let i = 0; i < 100; i++) m.step(0.1, 100, 0);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) m.paint(x, y, 2);
  assert.equal(m.summary().total, 0); assert.ok(Math.abs(m.summary().balance) < 1e-10);
  m.step(100, Infinity, NaN); assert.ok(m.water.every(Number.isFinite)); assert.equal(m.summary().coverage, 0);
});
test('sponge preset retains less water than paved neighborhood under equal forcing', () => {
  const base = new RainModel(), sponge = new RainModel(); base.preset('neighborhood'); sponge.preset('sponge');
  for (let i = 0; i < 400; i++) { base.step(0.05, 70, 30); sponge.step(0.05, 70, 30); }
  assert.ok(sponge.summary().total < base.summary().total); assert.ok(sponge.budget.infiltrated > base.budget.infiltrated);
});
test('drainage is monotonic without rainfall and production timestep is capped', () => {
  const dry = new RainModel(3, 3); dry.tiles.fill(4); dry.water.fill(.5);
  let previous = dry.summary().total;
  for (let i = 0; i < 100; i++) { dry.step(.05, 0, 50); const next = dry.summary().total; assert.ok(next <= previous + 1e-12); previous = next; }
  const a = new RainModel(2, 2), b = new RainModel(2, 2); a.tiles.fill(1); b.tiles.fill(1);
  a.step(2, 60, 0); b.step(.1, 60, 0); assert.deepEqual(a.water, b.water); assert.equal(a.time, .1);
  a.step(-1, 60, 0); assert.equal(a.time, .1);
});
test('uniform water at flat head remains at rest without sources or sinks', () => {
  const m = new RainModel(5, 5); m.tiles.fill(1); m.elevation.fill(0); m.water.fill(.25);
  for (let i = 0; i < 20; i++) m.step(.05, 0, 0);
  assert.ok(m.water.every(v => Math.abs(v - .25) < 1e-14));
});
