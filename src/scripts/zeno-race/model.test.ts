import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RACE, MAX_STAGES, meetingTime, positionsAt, stageAt, nextStage, observationEnd, formatLogDistance, cameraForGap, pursuitFrame, pursuitCamera, groundAnchor } from './model';
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

const pursuitStages = [0, 1, 5, 20, 199] as const;
const pursuitSamples = [0, .001, .125, .25, .5, .75, .875, .999, 1] as const;
const pursuitCases = [
  DEFAULT_RACE,
  { lead: 30, rabbit: 20, turtle: 19.9 },
  { lead: 30, rabbit: 20, turtle: .1 },
  { lead: 10, rabbit: 1, turtle: 1 },
  { lead: 10, rabbit: 1, turtle: 2 },
] as const;

test('each pursuit keeps its camera and old-position target fixed while both animals move forward', () => {
  for (const p of pursuitCases) for (const index of pursuitStages) {
    const initial = pursuitFrame(p, index, 0), end = pursuitFrame(p, index, 1);
    const q = p.turtle / p.rabbit, travel = initial.targetX - initial.rabbitX;
    close(initial.turtleX, initial.targetX);
    close(end.rabbitX, initial.targetX);
    close(end.turtleX - initial.turtleX, q * travel);
    let previous = initial;
    for (const u of pursuitSamples) {
      const current = pursuitFrame(p, index, u);
      assert.ok(Object.values(current).every(Number.isFinite), `non-finite frame at stage ${index}, u=${u}`);
      assert.equal(current.targetX, initial.targetX);
      assert.equal(current.logPixelsPerMetre, initial.logPixelsPerMetre);
      assert.equal(current.glyphScale, initial.glyphScale);
      assert.equal(current.decades, initial.decades);
      close(current.rabbitX, initial.rabbitX + travel * u);
      close(current.turtleX, initial.turtleX + q * travel * u);
      assert.ok(current.rabbitX >= previous.rabbitX);
      assert.ok(current.turtleX >= previous.turtleX);
      assert.ok(current.rabbitX >= 140 && current.turtleX <= 720 + 1e-10);
      assert.ok(current.screenGap > 0);
      close(current.screenGap, current.turtleX - current.rabbitX);
      if (q < 1) assert.ok(current.screenGap <= previous.screenGap + 1e-10);
      if (q === 1) close(current.screenGap, initial.screenGap);
      if (q > 1) assert.ok(current.screenGap >= previous.screenGap - 1e-10);
      previous = current;
    }
  }
});

test('pursuit screen distances and logarithmic gaps use the same fixed affine camera', () => {
  for (const p of pursuitCases) for (const index of pursuitStages) {
    const stage = stageAt(p, index), q = p.turtle / p.rabbit;
    for (const u of pursuitSamples) {
      const current = pursuitFrame(p, index, u);
      close(current.logGap, stage.logGap + Math.log(1 - u + q * u));
      close(Math.log(current.screenGap), current.logGap + current.logPixelsPerMetre);
      if (u === 1) close(current.logGap, stageAt(p, index + 1).logGap);
      assert.notEqual(formatLogDistance(current.logGap), '0 m');
    }
  }
});

test('successive completed pursuits shrink gently without hiding a finite logarithmic gap', () => {
  for (const p of pursuitCases.filter(p => p.rabbit > p.turtle)) {
    let previous = pursuitFrame(p, 0, 1);
    for (let index = 1; index < MAX_STAGES; index++) {
      const current = pursuitFrame(p, index, 1);
      assert.ok(current.screenGap < previous.screenGap);
      assert.ok(current.glyphScale < previous.glyphScale);
      assert.ok(current.glyphScale > .5);
      assert.ok(current.logGap < previous.logGap);
      assert.ok(current.logPixelsPerMetre > previous.logPixelsPerMetre);
      assert.ok(current.screenGap > 0);
      assert.notEqual(formatLogDistance(current.logGap), '0 m');
      previous = current;
    }
  }
  const underflow = { lead: 30, rabbit: 20, turtle: .1 };
  assert.equal(stageAt(underflow, MAX_STAGES).gap, 0);
  const frame = pursuitFrame(underflow, MAX_STAGES - 1, 1);
  assert.ok(Number.isFinite(frame.logGap));
  assert.ok(frame.screenGap > 0);
  assert.notEqual(formatLogDistance(frame.logGap), '0 m');
});

test('stationary animals and genuine meetings preserve static or exactly coincident positions', () => {
  for (const turtle of [0, 1, 20]) for (const index of pursuitStages) {
    const p = { lead: 10, rabbit: 0, turtle }, initial = pursuitFrame(p, index, 0);
    for (const u of pursuitSamples) {
      const current = pursuitFrame(p, index, u);
      assert.deepEqual(current, initial);
      assert.ok(Object.values(current).every(Number.isFinite));
      close(current.logGap, Math.log(10));
    }
  }
  const stationaryTurtle = { lead: 10, rabbit: 10, turtle: 0 };
  const first = pursuitFrame(stationaryTurtle, 0, 0);
  for (const u of pursuitSamples) {
    const current = pursuitFrame(stationaryTurtle, 0, u);
    assert.equal(current.turtleX, first.turtleX);
    assert.equal(current.targetX, first.targetX);
    assert.equal(current.logPixelsPerMetre, first.logPixelsPerMetre);
    if (u < 1) {
      assert.ok(current.screenGap > 0);
      close(current.logGap, Math.log(10) + Math.log1p(-u));
    } else {
      assert.equal(current.rabbitX, current.turtleX);
      assert.equal(current.screenGap, 0);
      assert.equal(current.logGap, -Infinity);
    }
  }
  for (const p of [stationaryTurtle, { lead: 0, rabbit: 0, turtle: 0 }, { lead: 0, rabbit: 10, turtle: 1 }]) {
    for (const index of pursuitStages.filter(index => p.lead === 0 || index > 0)) for (const u of pursuitSamples) {
      const current = pursuitFrame(p, index, u);
      assert.equal(current.rabbitX, current.turtleX);
      assert.equal(current.targetX, current.rabbitX);
      assert.equal(current.screenGap, 0);
      assert.equal(current.logGap, -Infinity);
      for (const [key, value] of Object.entries(current)) if (key !== 'logGap') assert.ok(Number.isFinite(value), `${key} must be finite at a genuine meeting`);
    }
  }
});

test('pursuit handles supported speed extremes without non-finite geometry', () => {
  for (const p of [{ lead: 30, rabbit: .1, turtle: 20 }, { lead: 30, rabbit: 20, turtle: .1 }]) {
    let stage = stageAt(p, 0);
    while (true) {
      for (const u of [0, .5, 1]) {
        const current = pursuitFrame(p, stage.index, u);
        assert.ok(Object.values(current).every(Number.isFinite));
        assert.ok(current.screenGap > 0);
        assert.ok(current.rabbitX >= 140 && current.turtleX <= 720 + 1e-10);
      }
      const next = nextStage(p, stage);
      if (next.stop) break;
      stage = next.stage;
    }
  }
});

test('extreme finite speed ratios never turn a positive gap into a mathematical meeting', () => {
  for (const p of [
    { lead: 1e100, rabbit: 1e100, turtle: 1e-300 },
    { lead: 1e-100, rabbit: 1e-300, turtle: 1e100 },
  ]) {
    for (const u of [0, .5, 1]) {
      const current = pursuitFrame(p, 0, u);
      assert.ok(Number.isFinite(current.logGap));
      assert.ok(Object.values(current).every(Number.isFinite));
      assert.ok(current.screenGap >= 0);
      assert.notEqual(formatLogDistance(current.logGap), '0 m');
      if (u === 0) close(current.logGap, Math.log(p.lead));
      if (u === 1) close(current.logGap, stageAt(p, 1).logGap);
    }
  }
});



test('one camera maps every frozen coordinate coherently into the next chase', () => {
  for (const p of [DEFAULT_RACE, { lead: 30, rabbit: 20, turtle: .1 }, { lead: 10, rabbit: 10, turtle: 9 }, { lead: 10, rabbit: 1, turtle: 2 }, { lead: 10, rabbit: 2, turtle: 2 }]) {
    for (const index of [1, 2, 5, 20, 100, 199]) {
      const before = pursuitFrame(p, index - 1, 1), after = pursuitFrame(p, index, 0);
      if (!Number.isFinite(stageAt(p, index).time)) continue;
      const start = pursuitCamera(p, index, 0), end = pursuitCamera(p, index, 1);
      assert.deepEqual(start, { scale: 1, x: 0, y: 0 });
      close(before.rabbitX * end.scale + end.x, after.rabbitX, 1e-10);
      close(before.turtleX * end.scale + end.x, after.turtleX, 1e-10);
      const anchor = groundAnchor(p, index - 1, before), nextAnchor = groundAnchor(p, index, after);
      close(anchor * end.scale + end.x, nextAnchor, 1e-10);
      let previous = start.scale;
      for (let u = 0; u <= 1; u += .025) {
        const camera = pursuitCamera(p, index, u);
        assert.ok(Object.values(camera).every(Number.isFinite)); assert.ok(camera.scale > 0);
        close(235 * camera.scale + camera.y, 235);
        close(camera.x, end.x * u); close(camera.scale, 1 + (end.scale - 1) * u);
        if (p.turtle < p.rabbit) assert.ok(camera.scale >= previous);
        previous = camera.scale;
        close((before.turtleX - before.rabbitX) * camera.scale, before.screenGap * camera.scale, 1e-10);
      }
    }
  }
});

test('ground landmarks remain stationary through a chase and share the zoom focal point', () => {
  for (const p of [DEFAULT_RACE, { lead: 10, rabbit: 10, turtle: 9.9 }, { lead: 10, rabbit: 1, turtle: 2 }, { lead: 10, rabbit: 2, turtle: 2 }]) {
    for (const index of [0, 1, 20, 199]) {
      const origin = groundAnchor(p, index, pursuitFrame(p, index, 0));
      for (const u of [0, .2, .5, .8, 1]) close(groundAnchor(p, index, pursuitFrame(p, index, u)), origin, 1e-10);
    }
  }
  assert.throws(() => pursuitCamera(DEFAULT_RACE, 1, NaN), RangeError);
});
