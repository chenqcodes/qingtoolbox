import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RACE, pursuitTime, stageAt } from './model';
import { pursuitMetrics, formatMetricTime, stopwatchReading } from './metrics';
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

test('stopwatch slots retain hundredths, fixed integer columns and scientific exponents', () => {
  for (const [log, kind, digits, unit, exponent] of [
    [-Infinity, 'time', '000.00', 's', null], [0, 'time', '001.00', 's', null],
    [Math.log(10), 'distance', '010.00', 'm', null], [Math.log(.1), 'distance', '010.00', 'cm', null],
    [Math.log(.001), 'time', '001.00', 'ms', null], [Math.log(.0001), 'time', '100.00', 'μs', null],
    [-460 * Math.LN10, 'time', '001.00', 's', -460], [300 * Math.LN10, 'distance', '001.00', 'm', 300],
    [Math.log(9.999e-16), 'distance', '001.00', 'm', -15],
  ] as const) {
    const reading = stopwatchReading(log, kind);
    assert.equal(reading.digits, digits); assert.equal(reading.unit, unit); assert.equal(reading.exponent, exponent);
  }
  for (let power = -500; power <= 300; power++) for (const fraction of [1, 1.23456, 9.999]) {
    const log = power * Math.LN10 + Math.log(fraction);
    for (const kind of ['time', 'distance'] as const) {
      const reading = stopwatchReading(log, kind);
      assert.match(reading.digits, /^\d{3}\.\d{2}$/); assert.notEqual(reading.digits, '000.00');
      assert.ok(reading.unit.length <= 2);
    }
  }
});
test('cumulative baseline plus current-segment increment is independently meaningful', () => {
  for (const p of [DEFAULT_RACE, { lead: 30, rabbit: .1, turtle: .2 }, { lead: 10, rabbit: 10, turtle: 0 }]) {
    for (const index of p.turtle === 0 ? [0] : [0, 1, 5]) for (const progress of [0, .2, .7, 1]) {
      const m = pursuitMetrics(p, index, progress, true);
      close(m.baselineTime + Math.exp(m.logElapsed), m.totalTime);
      close(Math.exp(m.logBaselineDistance) + Math.exp(m.logIncrementDistance), p.rabbit * m.totalTime);
    }
  }
  const done = pursuitMetrics(DEFAULT_RACE, 1, 0, false), next = pursuitMetrics(DEFAULT_RACE, 1, 0, true);
  close(done.baselineTime, 0); close(Math.exp(done.logElapsed), 1);
  close(next.baselineTime, 1); assert.equal(next.logElapsed, -Infinity);
  const deep = pursuitMetrics({ lead: 10, rabbit: 20, turtle: .1 }, 199, .7, true);
  assert.ok(Number.isFinite(deep.logIncrementDistance));
  assert.notEqual(stopwatchReading(deep.logIncrementDistance, 'distance').digits, '000.00');
});
