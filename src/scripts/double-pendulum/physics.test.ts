import test from 'node:test';
import assert from 'node:assert/strict';
import { derivative, rk4, energy, positions, radians, Timeline, HISTORY_LIMIT, type State } from './physics';
test('downward equilibrium and rod lengths are exact', () => {
  assert.ok(derivative([0, 0, 0, 0]).every(v => v === 0));
  const p = positions([1.2, -2, 3, 4]); assert.ok(Math.abs(Math.hypot(p.x1, p.y1) - 1) < 1e-14); assert.ok(Math.abs(Math.hypot(p.x2 - p.x1, p.y2 - p.y1) - 1) < 1e-14);
});
test('RK4 conserves energy over 30 seconds at the production step', () => {
  let s: State = [radians(125), radians(145), 0, 0]; const e = energy(s);
  for (let i = 0; i < 7200; i++) s = rk4(s);
  assert.ok(s.every(Number.isFinite)); assert.ok(Math.abs(energy(s) - e) / 29.43 < 2e-5);
});
test('energy directional derivative is zero for arbitrary states', () => {
  for (const s of [[1, 2, 3, 4], [-2, 0.2, 8, -5], [0.2, -0.8, 0, 3]] as State[]) {
    const d = derivative(s), h = 1e-6;
    const de = (energy(s.map((v, i) => v + h * d[i]) as State) - energy(s.map((v, i) => v - h * d[i]) as State)) / (2 * h);
    assert.ok(Math.abs(de) < 1e-6, String(de));
  }
});
test('fourth order convergence and reversibility at short duration', () => {
  const s: State = [1.2, 2.1, 0, 0];
  const solve = (h: number) => { let x = s; for (let t = 0; t < Math.round(0.5 / h); t++) x = rk4(x, h); return x; };
  const a = solve(1 / 60), b = solve(1 / 120), c = solve(1 / 240);
  const distance = (x: State, y: State) => Math.hypot(...x.map((v, i) => v - y[i]));
  assert.ok(distance(a, c) > distance(b, c) * 10);
  assert.ok(distance(rk4(rk4(s), -1 / 240), s) < 1e-9);
});
test('rewind buffer stays bounded and branching preserves chosen frame', () => {
  const timeline = new Timeline(); for (let i = 0; i < 4000; i++) timeline.push({ t: i, states: [[0, 0, 0, 0]] });
  assert.equal(timeline.length, HISTORY_LIMIT); assert.equal(timeline.get(0).t, 4000 - HISTORY_LIMIT);
  timeline.truncate(100); assert.equal(timeline.length, 101); timeline.push({ t: 9999, states: [[1, 1, 0, 0]] }); assert.equal(timeline.get(101).t, 9999);
});
