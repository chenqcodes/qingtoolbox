import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RACE, MAX_STAGES, meetingTime, positionsAt, stageAt, nextStage, observationEnd } from './model';
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
test('finite-precision guard never silently finishes infinitely many positive-gap stages', () => {
  let s = stageAt(DEFAULT_RACE, 0), steps = 0;
  while (true) { const next = nextStage(DEFAULT_RACE, s); if (next.stop) { assert.equal(next.stop, 'resolution'); break; } s = next.stage; steps++; assert.ok(steps < MAX_STAGES); }
  assert.ok(s.gap > 0); assert.ok(s.tail! > 0); assert.ok(s.time < meetingTime(DEFAULT_RACE)!);
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
