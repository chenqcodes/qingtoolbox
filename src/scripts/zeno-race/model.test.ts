import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RACE, MAX_STAGES, meetingTime, positionsAt, stageAt, nextStage, observationEnd, formatLogDistance, cameraForGap } from './model';
const close = (a: number, b: number, tolerance = 1e-12) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
test('default stages are 1, 0.1, 0.01 seconds; the finite limit is 10/9', () => {
  close(meetingTime(DEFAULT_RACE)!, 10 / 9);
  for (let n = 1; n <= 12; n++) {
    const s = stageAt(DEFAULT_RACE, n);
    close(s.duration, 10 ** (1 - n)); close(s.gap, 10 ** (1 - n));
    close(s.time + s.tail!, 10 / 9);
    assert.ok(s.time < meetingTime(DEFAULT_RACE)!); assert.ok(s.tail! > 0);
  }
  close(stageAt(DEFAULT_RACE, 2).time, 1.1);
  const meet = positionsAt(DEFAULT_RACE, 10 / 9);
  close(meet.rabbit, 100 / 9); close(meet.turtle, 100 / 9); close(meet.gap, 0);
  const pass = positionsAt(DEFAULT_RACE, 1.2);
  close(pass.rabbit, 12); close(pass.turtle, 11.2); close(pass.gap, -.8);
});
test('each finite endpoint is the preceding tortoise position', () => {
  for (const p of [DEFAULT_RACE, { lead: 4, rabbit: 3, turtle: 2 }, { lead: 5, rabbit: 1, turtle: 2 }]) {
    for (let i = 1; i < 12; i++) {
      close(stageAt(p, i).rabbitPosition, stageAt(p, i - 1).turtlePosition);
      close(stageAt(p, i).time - stageAt(p, i - 1).time, stageAt(p, i).duration);
    }
  }
});
test('zero lead is already met, including both stationary', () => {
  for (const p of [{ lead: 0, rabbit: 0, turtle: 0 }, { lead: 0, rabbit: 1, turtle: 2 }, { lead: 0, rabbit: 2, turtle: 1 }]) {
    assert.equal(meetingTime(p), 0); assert.equal(stageAt(p, 100).time, 0);
    assert.equal(nextStage(p, stageAt(p, 0)).stop, 'already-met');
    assert.ok(Number.isFinite(observationEnd(p)));
  }
});
test('stationary tortoise is reached in one step; stationary rabbit never reaches its lead', () => {
  const p = { lead: 10, rabbit: 2, turtle: 0 }, s = nextStage(p, stageAt(p, 0));
  assert.equal(s.stage.time, 5); assert.equal(s.stage.gap, 0);
  assert.equal(nextStage(p, s.stage).stop, 'already-met');
  for (const turtle of [0, 1, 20]) {
    const p = { lead: 10, rabbit: 0, turtle };
    assert.equal(meetingTime(p), null); assert.equal(stageAt(p, 1).reachable, false);
    assert.equal(nextStage(p, stageAt(p, 0)).stop, 'stationary-rabbit');
    assert.ok(Object.values(positionsAt(p, 1)).every(Number.isFinite));
  }
});
test('equal/slower rabbit has no catch and nonshrinking old-position stages', () => {
  const equal = { lead: 10, rabbit: 2, turtle: 2 };
  assert.equal(meetingTime(equal), null); assert.equal(stageAt(equal, 100).time, 500); assert.equal(stageAt(equal, 100).gap, 10);
  const slower = { lead: 10, rabbit: 1, turtle: 2 };
  assert.equal(meetingTime(slower), null); close(stageAt(slower, 3).time, 70); close(stageAt(slower, 3).gap, 80);
});
test('nearly equal speeds avoid catastrophic cancellation', () => {
  const p = { lead: 10, rabbit: 1 + 1e-12, turtle: 1 };
  close(stageAt(p, 1).time, 10 / p.rabbit, 1e-14);
  close(stageAt(p, 2).time, 10 / p.rabbit * (1 + p.turtle / p.rabbit), 1e-14);
  assert.ok(stageAt(p, 2).gap > 0); assert.ok(stageAt(p, 2).tail! > 0);
});
test('rounded total time never prevents advancing to the honest finite-stage cap', () => {
  let s = stageAt(DEFAULT_RACE, 0), roundedTimes = 0;
  for (let index = 1; index <= MAX_STAGES; index++) {
    const next = nextStage(DEFAULT_RACE, s);
    assert.equal(next.stop, null); assert.equal(next.stage.index, index);
    assert.ok(next.stage.logGap < s.logGap); assert.ok(next.stage.logTail! < s.logTail!);
    if (next.stage.time === s.time) roundedTimes++;
    s = next.stage;
  }
  assert.ok(roundedTimes > 100);
  assert.equal(s.time, meetingTime(DEFAULT_RACE));
  assert.ok(s.gap > 0); assert.ok(s.tail! > 0);
  close(s.logGap, Math.log(10) - MAX_STAGES * Math.LN10);
  assert.equal(nextStage(DEFAULT_RACE, s).stop, 'stage-cap');
  // Only selecting the continuous meeting event yields the model's exact zero.
  assert.equal(positionsAt(DEFAULT_RACE, s.time).gap, 0);
});
test('underflowing numeric gaps retain positive logarithmic distances, tails and durations', () => {
  const p = { lead: 30, rabbit: 20, turtle: .1 };
  let s = stageAt(p, 0), underflowed = false;
  for (let index = 1; index <= MAX_STAGES; index++) {
    const next = nextStage(p, s);
    assert.equal(next.stop, null);
    assert.ok(next.stage.logGap < s.logGap);
    assert.ok([next.stage.logGap, next.stage.logTail, next.stage.logDuration].every(Number.isFinite));
    if (next.stage.logGap >= Math.log(Number.MIN_VALUE)) assert.ok(next.stage.gap > 0);
    if (next.stage.gap === 0) {
      underflowed = true;
      assert.notEqual(formatLogDistance(next.stage.logGap), '0 m');
    }
    s = next.stage;
  }
  assert.ok(underflowed); assert.equal(s.gap, 0); assert.equal(s.tail, 0); assert.equal(s.duration, 0);
  assert.equal(nextStage(p, s).stop, 'stage-cap');
  close(s.logTail!, s.logGap - Math.log(p.rabbit - p.turtle));
  close(s.logDuration, Math.log(p.lead / p.rabbit) + 199 * Math.log(p.turtle / p.rabbit));
});
test('every positive supported catching speed pair has valid logarithms at stage 200', () => {
  for (let rabbitTenths = 2; rabbitTenths <= 200; rabbitTenths++) {
    for (let turtleTenths = 1; turtleTenths < rabbitTenths; turtleTenths++) {
      const p = { lead: turtleTenths % 2 ? .1 : 30, rabbit: rabbitTenths / 10, turtle: turtleTenths / 10 };
      const before = stageAt(p, MAX_STAGES - 1), next = nextStage(p, before);
      assert.equal(next.stop, null); assert.equal(next.stage.index, MAX_STAGES);
      assert.ok(next.stage.logGap < before.logGap);
      assert.ok(next.stage.logTail! < before.logTail!);
      assert.ok(Number.isFinite(next.stage.logDuration));
    }
  }
});
test('extreme supported inputs remain finite and larger mathematical values stop safely', () => {
  for (const p of [{ lead: 30, rabbit: 20, turtle: .1 }, { lead: 30, rabbit: .1, turtle: 20 }, { lead: 1e-100, rabbit: 1e100, turtle: 1 }, { lead: 1e100, rabbit: 1e-100, turtle: 0 }]) {
    const s = nextStage(p, stageAt(p, 0));
    assert.ok([s.stage.duration, s.stage.time, s.stage.gap, s.stage.rabbitPosition].every(Number.isFinite));
  }
  let s = stageAt({ lead: 30, rabbit: .1, turtle: 20 }, 0);
  for (let i = 0; i < MAX_STAGES + 1; i++) { const next = nextStage({ lead: 30, rabbit: .1, turtle: 20 }, s); if (next.stop) { assert.equal(next.stop, 'resolution'); return; } s = next.stage; }
  assert.fail('Expected finite-precision stop before overflow');
});
test('invalid parameters, time and stage indices are rejected', () => {
  for (const lead of [-1, NaN, Infinity]) assert.throws(() => meetingTime({ lead, rabbit: 10, turtle: 1 }), RangeError);
  assert.throws(() => positionsAt(DEFAULT_RACE, -1), RangeError);
  assert.throws(() => stageAt(DEFAULT_RACE, 1.2), RangeError);
  assert.throws(() => stageAt(DEFAULT_RACE, Infinity), RangeError);
});

test('directly selected meeting is coincident without treating neighboring times as equal', () => {
  const p = { lead: 17, rabbit: 3.7, turtle: 2.9 }, t = meetingTime(p)!;
  assert.equal(positionsAt(p, t).gap, 0); assert.equal(positionsAt(p, t).rabbit, positionsAt(p, t).turtle);
  assert.ok(positionsAt(p, t * (1 - 1e-10)).gap > 0); assert.ok(positionsAt(p, t * (1 + 1e-10)).gap < 0);
});

test('distance labels adapt units and stay nonzero hundreds of decades below underflow', () => {
  for (const [metres, expected] of [
    [10, '10 m'], [1, '1 m'], [.1, '10 cm'], [.01, '1 cm'], [.001, '1 mm'],
    [.0001, '100 μm'], [1e-6, '1 μm'], [1e-7, '100 nm'], [1e-9, '1 nm'],
    [1e-10, '100 pm'], [1e-12, '1 pm'], [1e-13, '1e-13 m'], [1e6, '1e6 m'],
    [Number.MIN_VALUE, '4.94e-324 m'],
  ] as const) assert.equal(formatLogDistance(Math.log(metres)), expected);
  assert.equal(formatLogDistance(-460 * Math.LN10), '1e-460 m');
  assert.equal(formatLogDistance(Math.log(3.25) - 460 * Math.LN10), '3.25e-460 m');
  assert.equal(formatLogDistance(-Infinity), '0 m');
  assert.equal(formatLogDistance(NaN), '超出显示范围');
  assert.equal(formatLogDistance(Infinity), '超出显示范围');
});

test('zoom camera continuously shrinks the visible gap and both glyphs through all stages', () => {
  for (const p of [DEFAULT_RACE, { lead: 30, rabbit: 20, turtle: .1 }, { lead: .1, rabbit: 20, turtle: 19.9 }]) {
    const initialLogGap = Math.log(p.lead);
    let previous = cameraForGap(initialLogGap, initialLogGap);
    assert.equal(previous.screenGap, 560); assert.equal(previous.glyphScale, 1); assert.equal(previous.logZoom, 0);
    for (let index = 1; index <= MAX_STAGES; index++) {
      const s = stageAt(p, index), current = cameraForGap(s.logGap, initialLogGap);
      assert.ok(Object.values(current).every(Number.isFinite));
      assert.ok(current.screenGap < previous.screenGap); assert.ok(current.screenGap > 8);
      assert.ok(current.glyphScale < previous.glyphScale); assert.ok(current.glyphScale > .11);
      assert.ok(current.logZoom > previous.logZoom);
      close(current.logZoom, initialLogGap - s.logGap + Math.log(current.screenGap / 560));
      previous = current;
    }
  }
  const deep = cameraForGap(-460 * Math.LN10, 0);
  assert.ok(deep.screenGap < 11); assert.ok(deep.glyphScale < .12);
});

test('camera handles genuine zero, equal or growing gaps without invalid geometry', () => {
  assert.deepEqual(cameraForGap(-Infinity, -Infinity), { screenGap: 0, logZoom: 0, glyphScale: 1, decades: 0 });
  assert.deepEqual(cameraForGap(-Infinity, Math.log(10)), { screenGap: 0, logZoom: 0, glyphScale: 1, decades: 0 });
  assert.deepEqual(cameraForGap(Math.log(20), Math.log(10)), cameraForGap(Math.log(10), Math.log(10)));
  assert.ok(Object.values(cameraForGap(-Number.MAX_VALUE, Number.MAX_VALUE)).every(Number.isFinite));
  assert.throws(() => cameraForGap(NaN, 0), RangeError);
  assert.throws(() => cameraForGap(0, Infinity), RangeError);
});
