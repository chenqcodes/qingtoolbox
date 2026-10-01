import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createController, advance, finish } from './camera-test-fixture';

function snapshot(camera: THREE.PerspectiveCamera) {
  return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
}
function samePose(camera: THREE.PerspectiveCamera, before: ReturnType<typeof snapshot>, message: string) {
  assert.ok(camera.position.distanceTo(before.position) < 1e-9, `${message}: position`);
  assert.ok(1 - Math.abs(camera.quaternion.dot(before.quaternion)) < 1e-10, `${message}: attitude`);
  assert.ok(Math.abs(camera.fov - before.fov) < 1e-10, `${message}: lens`);
}

for (const command of ['body', 'guide', 'focus', 'comet', 'reset', 'zoom', 'facesun'] as const) {
  test(`${command} navigation begins at the current rendered pose and has a real intermediate frame`, t => {
    const { cam, camera, orbit } = createController(t);
    if (command === 'reset') { camera.position.add(new THREE.Vector3(.4, .2, -.1)); camera.lookAt(orbit.target); }
    const before = snapshot(camera);
    if (command === 'body') cam.travelTo('mars');
    else if (command === 'guide') cam.navigateToBody('jupiter');
    else if (command === 'focus') cam.setFocus('moon');
    else if (command === 'comet') cam.travelToComet('halley');
    else if (command === 'reset') cam.resetView();
    else if (command === 'zoom') cam.zoomBy(.72);
    else cam.faceSun();
    assert.equal(cam.mode, 'travel');
    samePose(camera, before, 'command issue must not teleport');
    cam.update(0);
    samePose(camera, before, 'zero-time update');
    advance(cam, .2);
    assert.equal(cam.mode, 'travel');
    assert.ok(camera.position.distanceTo(before.position) > 1e-7, 'motion has begun before arrival');
    const middle = snapshot(camera);
    finish(cam);
    assert.equal(cam.mode, 'observe');
    assert.ok(camera.position.distanceTo(middle.position) > 1e-7, 'intermediate frame is not the destination');
    const arrived = snapshot(camera);
    advance(cam, .1);
    samePose(camera, arrived, 'handoff to OrbitControls must not jump');
  });
}

test('retargeting a flight preserves its partial pose and invokes only the latest callback once', t => {
  const { cam, camera } = createController(t);
  let old = 0, latest = 0;
  cam.travelTo('jupiter', () => old++);
  advance(cam, .5);
  const before = snapshot(camera);
  cam.travelToComet('halley', () => latest++);
  samePose(camera, before, 'midflight interruption');
  cam.update(.001);
  assert.ok(camera.position.distanceTo(before.position) < 1e-6);
  finish(cam);
  advance(cam, 4);
  assert.equal(old, 0);
  assert.equal(latest, 1);
  assert.equal(cam.cometFocus, 'halley');
  assert.equal(cam.travelTrail, null);
});

test('fly, observe and manual controls all cancel a flight without reviving its callback', t => {
  for (const mode of ['fly', 'observe', 'gesture'] as const) {
    const { cam, camera, orbit } = createController(t);
    let completed = 0;
    cam.travelTo('mars', () => completed++);
    advance(cam, .45);
    const before = snapshot(camera);
    if (mode === 'gesture') orbit.dispatchEvent({ type: 'start' });
    else cam.setMode(mode);
    samePose(camera, before, `${mode} interrupt`);
    advance(cam, 4);
    samePose(camera, before, `${mode} idle pose`);
    assert.equal(completed, 0);
    assert.equal(cam.mode, mode === 'fly' ? 'fly' : 'observe');
  }
});

test('real OrbitControls inertia cannot pull the camera after an automatic landing', t => {
  const { cam, camera, orbit } = createController(t);
  orbit.rotateLeft(.4);
  orbit.rotateUp(.2);
  orbit.pan(15, 8);
  orbit.update();
  const before = snapshot(camera);
  cam.navigateToBody('mars');
  samePose(camera, before, 'draining damping must retain the rendered frame');
  finish(cam);
  const arrived = snapshot(camera);
  advance(cam, 1);
  samePose(camera, arrived, 'no residual control inertia');
});

test('rapid zoom clicks accumulate their requested distance while each starts continuously', t => {
  const { cam, camera, orbit } = createController(t);
  const original = camera.position.distanceTo(orbit.target);
  cam.zoomBy(.72);
  advance(cam, .1);
  const midway = snapshot(camera);
  cam.zoomBy(.72);
  samePose(camera, midway, 'second zoom');
  finish(cam);
  assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - original * .72 ** 2) < 1e-9);
  for (const factor of [0, -1, NaN, Infinity]) {
    const before = snapshot(camera);
    cam.zoomBy(factor);
    samePose(camera, before, 'invalid zoom ignored');
    assert.equal(cam.mode, 'observe');
  }
});

test('normal navigation across AU and ly requests one source capture and completes callbacks', t => {
  const { cam, camera, visible, captures, scaleChanges } = createController(t);
  let stars = 0, earth = 0;
  cam.navigateToStar('proxima', () => stars++);
  assert.deepEqual(captures, ['solar']);
  assert.deepEqual(visible, { bodies: false, stars: true, comets: false });
  finish(cam);
  assert.equal(stars, 1);
  assert.equal(cam.starFocus, 'proxima');
  cam.returnToSol(() => earth++);
  assert.deepEqual(captures, ['solar', 'stellar']);
  finish(cam);
  advance(cam, 1);
  assert.equal(earth, 1, 'return completion must not lose its callback');
  assert.equal(stars, 1);
  assert.deepEqual(scaleChanges, ['stellar', 'solar']);
  assert.deepEqual(visible, { bodies: true, stars: false, comets: true });
  assert.equal(cam.focus, 'earth');
  assert.ok([...camera.position, ...camera.quaternion].every(Number.isFinite));
});

test('a new destination during a scale crossing wins without stale leave/enter state', t => {
  const { cam, captures } = createController(t);
  let stale = 0, latest = 0;
  cam.travelToStar('proxima', () => stale++);
  advance(cam, .2);
  cam.navigateToBody('jupiter', () => latest++);
  finish(cam);
  advance(cam, 2);
  assert.equal(cam.scaleMode, 'solar');
  assert.equal(cam.focus, 'jupiter');
  assert.equal(stale, 0);
  assert.equal(latest, 1);
  assert.deepEqual(captures, ['solar', 'stellar']);
});

test('enabling reduced motion during travel lands once and prevents animation from resuming', t => {
  const { cam, camera, orbit, captures } = createController(t);
  let stale = 0;
  cam.travelTo('jupiter', () => stale++);
  advance(cam, .3);
  cam.setReducedMotion(true);
  assert.equal(cam.focus, 'jupiter');
  assert.equal(cam.mode, 'observe');
  assert.equal(orbit.enableDamping, false);
  const stopped = snapshot(camera);
  advance(cam, 5);
  samePose(camera, stopped, 'reduced motion stop');
  assert.equal(stale, 0);
  cam.navigateToStar('proxima');
  assert.equal(cam.mode, 'observe');
  assert.deepEqual(captures, [], 'reduced motion must not start a dissolve');
  cam.setReducedMotion(false);
  assert.equal(orbit.enableDamping, true);
  cam.navigateToStar('sirius');
  assert.equal(cam.mode, 'travel');
});

test('floating-origin updates during navigation preserve the entire physical camera pose', t => {
  const a = createController(t), b = createController(t);
  a.cam.travelTo('jupiter'); b.cam.travelTo('jupiter');
  advance(a.cam, .4); advance(b.cam, .4);
  const delta = new THREE.Vector3(3, -.4, 1);
  b.bodies.setFloatingOrigin(delta);
  b.cam.applyOriginShift(delta);
  for (let i = 0; i < 500; i++) {
    a.cam.update(1 / 120); b.cam.update(1 / 120);
    assert.ok(a.camera.position.distanceTo(b.camera.position.clone().add(delta)) < 1e-8);
    assert.ok(a.orbit.target.distanceTo(b.orbit.target.clone().add(delta)) < 1e-8);
    assert.ok(1 - Math.abs(a.camera.quaternion.dot(b.camera.quaternion)) < 1e-10);
    assert.equal(a.camera.fov, b.camera.fov);
  }
});

test('arrival tracks moving astronomical targets and remains stable in observation mode', t => {
  const { cam, camera, orbit, bodies, movement } = createController(t);
  cam.travelTo('mars');
  for (let i = 0; i < 500 && cam.mode === 'travel'; i++) {
    movement.add(new THREE.Vector3(.0001, .00002, -.00003));
    cam.update(1 / 120);
  }
  assert.equal(cam.mode, 'observe');
  const target = bodies.getWorldPos('mars', new THREE.Vector3());
  assert.ok(orbit.target.distanceTo(target) < 1e-9);
  const before = snapshot(camera), change = new THREE.Vector3(.03, .02, -.01);
  movement.add(change); cam.update(1 / 120);
  assert.ok(camera.position.distanceTo(before.position.clone().add(change)) < 1e-9);
  assert.ok(1 - Math.abs(camera.quaternion.dot(before.quaternion)) < 1e-10);
});

test('stopping a tour during approach or orbit leaves a stable manually controlled pose', t => {
  for (const afterArrival of [false, true]) {
    const { cam, camera } = createController(t);
    cam.startTour();
    if (afterArrival) { finish(cam); advance(cam, .3); assert.equal(cam.mode, 'tour'); }
    else advance(cam, .2);
    const before = snapshot(camera);
    cam.stopTour();
    samePose(camera, before, 'stop tour');
    advance(cam, 12);
    samePose(camera, before, 'stopped tour remains stopped');
    assert.equal(cam.mode, 'observe');
    assert.equal(cam.touring, false);
  }
});

test('interrupting an oblique, partially rolled flight keeps its rendered attitude', t => {
  for (const mode of ['fly', 'observe', 'gesture'] as const) {
    const { cam, camera, orbit } = createController(t);
    camera.position.copy(orbit.target).add(new THREE.Vector3().setFromSphericalCoords(.1, 3.1, 3.6));
    camera.lookAt(orbit.target);
    cam.navigateToBody('jupiter');
    advance(cam, .6);
    const before = snapshot(camera);
    if (mode === 'gesture') orbit.dispatchEvent({ type: 'start' });
    else cam.setMode(mode);
    samePose(camera, before, `${mode} command preserves roll`);
    cam.update(0);
    samePose(camera, before, `${mode} next frame preserves roll`);
    advance(cam, .25);
    samePose(camera, before, `${mode} idle preserves roll`);
  }
});
