import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sunBearing } from './sun-indicator';
const viewport = { left: 0, top: 0, right: 1000, bottom: 600 };

test('hide the Sun when in frame, including frame boundaries', () => {
  assert.equal(sunBearing({ x: 0, y: 0, z: -2 }, 1, 1, viewport), null);
  assert.equal(sunBearing({ x: 2, y: 0, z: -2 }, 1, 1, viewport), null);
});
test('front and rear bearings do not flip sides crossing the camera plane', () => {
  for (const z of [-.01, 0, .01, 10]) {
    const right = sunBearing({ x: 2, y: 0, z }, 1, 1, viewport)!;
    assert.equal(right.x, 970); assert.equal(right.y, 300);
    const left = sunBearing({ x: -2, y: 0, z }, 1, 1, viewport)!;
    assert.equal(left.x, 30); assert.ok(Math.abs(left.y - 300) < 1e-9);
  }
});
test('rear pole uses previous bearing and pathological coordinates never produce NaN', () => {
  assert.equal(sunBearing({ x: 0, y: 0, z: 2 }, 1, 1, viewport, [], 0)?.x, 970);
  assert.equal(sunBearing({ x: NaN, y: 0, z: 2 }, 1, 1, viewport), null);
  assert.equal(sunBearing({ x: 0, y: 0, z: 0 }, 1, 1, viewport), null);
  assert.equal(sunBearing({ x: 1, y: 0, z: 0 }, 1, 1, { ...viewport, right: 0 }), null);
});
test('vertical, diagonal and offset canvas bearings stay inside padded bounds', () => {
  const shifted = { left: 50, top: 20, right: 1050, bottom: 620 };
  for (const y of [-5, 0, 5]) for (const x of [-5, 0, 5]) {
    const result = sunBearing({ x, y, z: 1 }, 1, 1, shifted)!;
    assert.ok(result.x >= 80 && result.x <= 1020 && result.y >= 50 && result.y <= 590);
    if (y > 0) assert.ok(result.y < 320);
    if (y < 0) assert.ok(result.y > 320);
  }
});
test('avoids mobile HUD panels with a full marker margin', () => {
  const mobile = { left: 0, top: 0, right: 390, bottom: 844 };
  const panels = [{ left: 0, top: 0, right: 390, bottom: 110 }, { left: 60, top: 122, right: 382, bottom: 530 }, { left: 0, top: 760, right: 390, bottom: 844 }];
  const result = sunBearing({ x: 2, y: 2, z: 1 }, 1, 1, mobile, panels)!;
  assert.ok(result);
  for (const r of panels) assert.ok(result.x < r.left - 22 || result.x > r.right + 22 || result.y < r.top - 22 || result.y > r.bottom + 22);
  assert.equal(sunBearing({ x: 1, y: 0, z: 1 }, 1, 1, mobile, [mobile]), null);
});
test('camera rotation, both scene scales, and floating-origin rebases preserve bearings', () => {
  for (const unit of [1, 63241]) {
    const camera = new THREE.PerspectiveCamera(55, 5 / 3, .001, 1e8);
    camera.position.set(4 * unit, 2 * unit, 8 * unit);
    camera.lookAt(new THREE.Vector3(8 * unit, 2 * unit, 8 * unit));
    camera.updateMatrixWorld(true);
    const sun = new THREE.Vector3();
    const calculate = () => sunBearing(sun.clone().applyMatrix4(camera.matrixWorldInverse), camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5], viewport);
    const before = calculate()!;
    const shift = new THREE.Vector3(20 * unit, -3 * unit, 6 * unit);
    camera.position.sub(shift); sun.sub(shift); camera.updateMatrixWorld(true);
    const after = calculate()!;
    assert.ok(Math.abs(before.x - after.x) < 1e-8 && Math.abs(before.y - after.y) < 1e-8);
    assert.ok(Math.abs(before.angle - after.angle) < 1e-8);
  }
});
