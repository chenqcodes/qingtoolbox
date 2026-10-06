import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RACE, pursuitTime, stageAt } from './model';
import { pursuitMetrics, formatMetricTime } from './metrics';
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-12, `${a} != ${b}`);
test('segment model time is nonlinear slow-motion time, not wall-clock fraction', () => {
  const m = pursuitMetrics(DEFAULT_RACE, 0, .5, true);
  close(Math.exp(m.logElapsed), (1 - Math.sqrt(.1)) / .9);
  assert.notEqual(Math.exp(m.logElapsed), .5);
  close(m.totalTime, pursuitTime(DEFAULT_RACE, 0, .5)); close(Math.exp(m.logTotalDistance), 10 * m.totalTime);
  assert.equal(m.segment, 1); close(Math.exp(m.logDuration), 1);
});
test('completed snapshots and next-leg starts have explicit different semantics', () => {
  const done = pursuitMetrics(DEFAULT_RACE, 1, 0, false), next = pursuitMetrics(DEFAULT_RACE, 1, 0, true);
  assert.equal(done.completed, true); assert.equal(done.segment, 1); close(Math.exp(done.logElapsed), 1); assert.equal(done.fraction, 1);
  assert.equal(next.completed, false); assert.equal(next.segment, 2); assert.equal(next.logElapsed, -Infinity); close(Math.exp(next.logDuration), .1);
  close(done.totalTime, next.totalTime); close(done.logTotalDistance, next.logTotalDistance);
});
test('deep microscopic segment clocks remain positive after absolute time rounds and duration underflows', () => {
  const p = { lead: 10, rabbit: 20, turtle: .1 };
  const m = pursuitMetrics(p, 199, .7, true), end = pursuitMetrics(p, 200, 0, false);
  assert.ok(Number.isFinite(m.logElapsed)); assert.ok(m.logElapsed < -1000);
  assert.notEqual(formatMetricTime(m.logElapsed), '0 s'); assert.ok(m.logElapsed < m.logDuration);
  assert.equal(end.logElapsed, stageAt(p, 200).logDuration); assert.equal(end.fraction, 1);
});
test('zero lead, stationary rabbit/turtle, equal and slower races keep truthful metrics', () => {
  assert.equal(pursuitMetrics({ lead: 0, rabbit: 10, turtle: 1 }, 0, 0, false).possible, false);
  assert.equal(pursuitMetrics({ lead: 10, rabbit: 0, turtle: 1 }, 0, 0, false).possible, false);
  const still = pursuitMetrics({ lead: 10, rabbit: 10, turtle: 0 }, 1, 0, false);
  assert.equal(still.fraction, 1); close(Math.exp(still.logElapsed), 1); close(still.totalTime, 1);
  for (const turtle of [10, 20]) {
    const p = { lead: 10, rabbit: 10, turtle }, m = pursuitMetrics(p, 2, .6, true);
    assert.ok(m.fraction > 0 && m.fraction < 1); assert.ok(m.logElapsed < m.logDuration);
    close(m.totalTime, pursuitTime(p, 2, .6));
  }
});
test('compact clock notation handles rounding across units without zeroing positive tiny times', () => {
  for (const [value, expected] of [[-Infinity, '0 s'], [0, '1 s'], [Math.log(.001), '1 ms'], [Math.log(.0001), '100 μs'], [Math.log(1e-9), '1 ns'], [Math.log(1e-12), '1 ps'], [-460 * Math.LN10, '1e-460 s'], [Math.log(.999999), '1 s']] as const) assert.equal(formatMetricTime(value), expected);
});
