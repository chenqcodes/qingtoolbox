'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, classify } = require('../js/daylight-timeline');

test('continuous bins use midpoint boundaries and separate changed occluders', () => {
  const result = summarize([
    { hour: 8.25, status: 'blocked', blocker: 'A', isolatedSun: true },
    { hour: 8.75, status: 'blocked', blocker: 'B', isolatedSun: true },
    { hour: 9.25, status: 'sun', isolatedSun: true },
    { hour: 9.75, status: 'sun', isolatedSun: true },
    { hour: 10.25, status: 'back-facing', isolatedSun: false },
  ], .5);
  assert.equal(result.sunHours, 1);
  assert.equal(result.isolatedHours, 2);
  assert.equal(result.otherBuildingLoss, 1);
  assert.equal(result.longestSunHours, 1);
  assert.deepEqual(result.intervals[2], { start: 9, end: 10, status: 'sun', blocker: undefined });
  assert.equal(result.intervals.length, 4);
});
test('night and back-facing facade never become sunny in isolation', () => {
  assert.equal(classify(null, { x: 1, y: 0 }, null), 'low-sun');
  assert.equal(classify({ x: -1, z: 0 }, { x: 1, y: 0 }, null), 'back-facing');
  assert.equal(classify({ x: 1, z: 0 }, { x: 1, y: 0 }, {}), 'blocked');
  assert.equal(classify({ x: 1, z: 0 }, { x: 1, y: 0 }, null), 'sun');
});
test('empty, all-shaded, noncontiguous and invalid samples are safe', () => {
  assert.equal(summarize([], .25).longestSunHours, 0);
  assert.equal(summarize([{ hour: 8, status: 'blocked', isolatedSun: false }], .25).sunHours, 0);
  assert.equal(summarize([{ hour: 8, status: 'sun' }, { hour: 9, status: 'sun' }], .25).intervals.length, 2);
  assert.throws(() => summarize([], 0));
  assert.throws(() => summarize([{ hour: NaN }], .25));
});

test('isolated scenario retains own-building shading behind a nearer neighbor', () => {
  const { evaluateSample } = require('../js/daylight-timeline');
  const direction = { x: 1, z: 0 };
  const outward = { x: 1, y: 0 };
  assert.deepEqual(evaluateSample(direction, outward, [2, 0], 0), { status: 'blocked', blockerIndex: 2, isolatedSun: false });
  assert.deepEqual(evaluateSample(direction, outward, [2, 3], 0), { status: 'blocked', blockerIndex: 2, isolatedSun: true });
  assert.deepEqual(evaluateSample(direction, outward, [], 0), { status: 'sun', blockerIndex: null, isolatedSun: true });
  assert.equal(evaluateSample(null, outward, [], 0).isolatedSun, false);
  assert.equal(evaluateSample({ x: -1, z: 0 }, outward, [], 0).isolatedSun, false);
});

test('vendored ray tracing identifies a nearer neighbor and a farther self-shadow', () => {
  const THREE = require('../vendor/three-r128/three.min.js');
  const { evaluateSample } = require('../js/daylight-timeline');
  const cube = (index, x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 4), new THREE.MeshBasicMaterial());
    mesh.position.x = x;
    mesh.userData.buildingIndex = index;
    mesh.updateMatrixWorld(true);
    return mesh;
  };
  const neighbor = cube(1, 5);
  const ownWing = cube(0, 10);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), .1, Infinity);
  const blockers = ray.intersectObjects([ownWing, neighbor], false).map(hit => hit.object.userData.buildingIndex);
  const result = evaluateSample({ x: 1, z: 0 }, { x: 1, y: 0 }, blockers, 0);
  assert.equal(result.blockerIndex, 1);
  assert.equal(result.isolatedSun, false);
});
