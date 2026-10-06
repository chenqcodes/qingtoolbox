import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawScale } from './draw';
import { MIN_EXP, MAX_EXP, STOPS, nearestStop, stopExponent } from './model';

function mockCanvas() {
  let paths = 0, marks = 0, saves = 0;
  const gradient = { addColorStop: (at: number, color: string) => { assert.ok(at >= 0 && at <= 1); assert.ok(color); } };
  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  for (const key of ['clearRect', 'fillRect', 'strokeRect', 'arc', 'ellipse', 'moveTo', 'lineTo', 'bezierCurveTo', 'rect', 'translate', 'scale', 'rotate']) {
    methods[key] = (...args) => { for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `${key}: nonfinite geometry`); paths++; };
  }
  for (const key of ['createRadialGradient', 'createLinearGradient']) methods[key] = (...args) => { for (const arg of args) assert.ok(Number.isFinite(arg)); return gradient; };
  for (const key of ['beginPath', 'closePath', 'clip']) methods[key] = () => {};
  methods.fill = methods.stroke = methods.fillText = () => { marks++; };
  methods.save = () => { saves++; }; methods.restore = () => { saves--; assert.ok(saves >= 0); };
  return { context: new Proxy({}, { get: (_, key) => methods[key as string], set: () => true }) as CanvasRenderingContext2D, check: () => { assert.equal(saves, 0); assert.ok(paths > 100); assert.ok(marks > 100); } };
}

test('every illustration renders finite geometry at mobile and desktop sizes', () => {
  for (const [width, height] of [[320, 385], [880, 600]]) for (const stop of STOPS) {
    const c = mockCanvas(); drawScale(c.context, width, height, stopExponent(stop), stop); c.check();
  }
});

test('intermediate continuous zoom and bounded edges never render invalid geometry', () => {
  for (let exponent = MIN_EXP; exponent <= MAX_EXP; exponent += .127) {
    const c = mockCanvas(); drawScale(c.context, 500, 600, exponent, nearestStop(exponent)); c.check();
  }
});
