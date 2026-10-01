import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ViewTransition, type ViewPose } from './transition';

function pose(): ViewPose {
  return { position: new THREE.Vector3(1, 2, 4), target: new THREE.Vector3(1, 2, 0),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(.2, -.4, .1)), fov: 73 };
}
const target = new THREE.Vector3(8, -2, 3), offset = new THREE.Vector3(.3, .1, .5);
function finite(p: ViewPose) {
  assert.ok([...p.position, ...p.target, ...p.quaternion, p.fov].every(Number.isFinite));
  assert.ok(Math.abs(p.quaternion.length() - 1) < 1e-10);
}
function equalPose(a: ViewPose, b: ViewPose, epsilon = 1e-9) {
  assert.ok(a.position.distanceTo(b.position) < epsilon);
  assert.ok(a.target.distanceTo(b.target) < epsilon);
  assert.ok(1 - Math.abs(a.quaternion.dot(b.quaternion)) < epsilon);
  assert.ok(Math.abs(a.fov - b.fov) < epsilon);
}

test('transition owns immutable snapshots and preserves the exact initial rendered pose', () => {
  const from = pose(), original = pose(), transition = new ViewTransition(from, 2);
  from.position.setScalar(99); from.target.setScalar(99); from.quaternion.identity(); from.fov = 1;
  equalPose(transition.sample(0, target, offset, 58), original);
  const first = transition.sample(.001, target, offset, 58);
  assert.ok(first.position.distanceTo(original.position) < 1e-7, 'position eases away from rest');
  assert.ok(Math.abs(first.fov - original.fov) < 1e-7, 'lens eases away from rest');
});

test('one continuous lens curve has no old liftoff, warp or settling FOV kicks', () => {
  const transition = new ViewTransition(pose(), 2), dt = 1 / 240;
  let prior = transition.sample(0, target, offset, 58);
  for (let i = 0; i < 482; i++) {
    const next = transition.sample(dt, target, offset, 58);
    finite(next);
    // Quintic smoothstep has maximum derivative 1.875. Any phase-edge reset
    // exceeds this analytical per-frame bound by orders of magnitude.
    assert.ok(Math.abs(next.fov - prior.fov) <= 1.875 * 15 * dt / 2 + 1e-10);
    assert.ok(next.fov <= prior.fov + 1e-10);
    assert.ok(next.progress >= prior.progress - 1e-12 && next.progress <= 1 + 1e-12);
    prior = next;
  }
  assert.equal(prior.done, true);
  assert.ok(prior.position.distanceTo(target.clone().add(offset)) < 1e-10);
  assert.equal(prior.fov, 58);
  equalPose(transition.sample(.02, target, offset, 58), prior);
});

test('intermediate pose and logarithmic radius are independent of display frame rate', () => {
  const samples = [30, 60, 120, 240].map(hz => {
    const transition = new ViewTransition(pose(), 2);
    let sample = transition.sample(0, target, offset, 58);
    for (let i = 0; i < hz; i++) sample = transition.sample(1 / hz, target, offset, 58);
    return sample;
  });
  for (const sample of samples) {
    equalPose(sample, samples[0]);
    assert.ok(Math.abs(sample.position.distanceTo(sample.target) - Math.sqrt(4 * offset.length())) < 1e-10);
    assert.ok(sample.target.distanceTo(pose().target.lerp(target, .5)) < 1e-10);
    assert.ok(Math.abs(sample.fov - 65.5) < 1e-10);
  }
});

test('retargeting from an intermediate attitude and lens has no first-frame jump', () => {
  const old = new ViewTransition(pose(), 2);
  let middle = old.sample(0, target, offset, 58);
  for (let i = 0; i < 70; i++) middle = old.sample(.01, target, offset, 58);
  const newer = new ViewTransition(middle, 1);
  equalPose(newer.sample(0, new THREE.Vector3(-50, 20, 0), new THREE.Vector3(0, 1, 0), 58), middle);
  assert.ok(newer.sample(.001, target, offset, 58).position.distanceTo(middle.position) < 1e-6);
});

test('rebasing a floating origin preserves the physical path, target, attitude and FOV', () => {
  const original = new ViewTransition(pose(), 2), shifted = new ViewTransition(pose(), 2);
  const delta = new THREE.Vector3(10, -4, 5);
  for (let i = 0; i < 50; i++) { original.sample(.01, target, offset, 58); shifted.sample(.01, target, offset, 58); }
  shifted.shift(delta);
  for (let i = 0; i < 160; i++) {
    const a = original.sample(.01, target, offset, 58);
    const b = shifted.sample(.01, target.clone().sub(delta), offset, 58);
    b.position.add(delta); b.target.add(delta);
    equalPose(a, b);
  }
});

test('zero-distance, antipodal and very different-scale offsets remain finite and land exactly', () => {
  for (const [fromOffset, endOffset] of [
    [new THREE.Vector3(), new THREE.Vector3(0, 0, 1)],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3()],
    [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)],
    [new THREE.Vector3(1e-12, 0, 0), new THREE.Vector3(0, 1e5, 0)],
  ]) {
    const from = { ...pose(), target: new THREE.Vector3(), position: fromOffset };
    const transition = new ViewTransition(from, 1);
    equalPose(transition.sample(0, target, endOffset, 58), from);
    let sample = transition.sample(0, target, endOffset, 58);
    for (let i = 0; i < 121; i++) { sample = transition.sample(1 / 120, target, endOffset, 58); finite(sample); }
    assert.equal(sample.done, true);
    assert.ok(sample.position.distanceTo(target.clone().add(endOffset)) < 1e-8);
  }
});

test('invalid delta and a resumed background tab cannot skip an entire transition', () => {
  const transition = new ViewTransition(pose(), 1);
  for (const dt of [NaN, Infinity, -1]) equalPose(transition.sample(dt, target, offset, 58), pose());
  const sample = transition.sample(100, target, offset, 58);
  assert.equal(transition.elapsed, .05);
  assert.equal(sample.done, false);
  assert.ok(sample.progress < .002);
});

test('crossing the camera-up pole never flips attitude between adjacent frames', () => {
  const position = new THREE.Vector3(-.65, .35, -1).normalize();
  const end = new THREE.Vector3(.65, .35, 1).normalize();
  const center = new THREE.Vector3();
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, center, new THREE.Vector3(0, 1, 0)));
  const transition = new ViewTransition({ position, target: center, quaternion, fov: 58 }, 2);
  let prior = transition.sample(0, center, end, 58);
  for (let i = 0; i < 2002; i++) {
    const next = transition.sample(.001, center, end, 58);
    assert.ok(prior.quaternion.angleTo(next.quaternion) <= 1.875 * Math.PI * .001 / 2 + 1e-6,
      `attitude flip near ${transition.elapsed}s`);
    prior = next;
  }
  assert.equal(prior.done, true);
});
