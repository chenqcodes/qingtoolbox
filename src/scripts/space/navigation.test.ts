import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BODY_BY_ID } from './constants';
import { createController, finish } from './camera-test-fixture';

test('instant guide travel escapes cinematic flight and returns from stars to Earth', t => {
  const { cam, camera, orbit } = createController(t);
  let aborted = 0;
  cam.travelTo('mars', () => aborted++);
  cam.update(.05);
  cam.jumpToStar('proxima');
  assert.equal(cam.scaleMode, 'stellar');
  assert.equal(cam.mode, 'observe');
  assert.equal(cam.travelTrail, null);
  cam.jumpToBody('earth');
  assert.equal(cam.scaleMode, 'solar');
  assert.equal(cam.focus, 'earth');
  assert.equal(cam.cometFocus, null);
  assert.ok(camera.position.toArray().every(Number.isFinite));
  assert.ok(camera.position.distanceTo(orbit.target) > .03);
  for (let i = 0; i < 100; i++) cam.update(.05);
  assert.equal(aborted, 0);
});
test('reduced motion uses immediate body, star, comet and return paths', t => {
  const { cam, orbit } = createController(t);
  cam.setReducedMotion(true);
  assert.equal(orbit.enableDamping, false);
  cam.travelTo('moon');
  assert.equal(cam.focus, 'moon');
  assert.equal(cam.mode, 'observe');
  cam.travelToStar('proxima');
  assert.equal(cam.starFocus, 'proxima');
  assert.equal(cam.mode, 'observe');
  cam.returnToSol();
  assert.equal(cam.focus, 'earth');
  assert.equal(cam.scaleMode, 'solar');
  cam.travelToComet('halley');
  assert.equal(cam.cometFocus, 'halley');
  assert.equal(cam.mode, 'observe');
  cam.startTour();
  assert.equal(cam.touring, false);
});
test('mobile zoom respects bounds and reset cancels flight without changing target', t => {
  const { cam, camera, orbit } = createController(t);
  cam.setReducedMotion(true);
  cam.jumpToBody('moon');
  cam.zoomBy(1e-8);
  assert.ok(Math.abs(camera.position.distanceTo(orbit.target) - orbit.minDistance) < 1e-8);
  cam.zoomBy(1e9);
  assert.ok(camera.position.distanceTo(orbit.target) <= 120 + 1e-8);
  cam.resetView();
  assert.equal(cam.focus, 'moon');
  assert.equal(cam.mode, 'observe');
});

for (const [width, height] of [[390, 844], [1440, 1000], [844, 390]]) {
  for (const reducedMotion of [false, true]) {
    test(`Jupiter guide frames all real-position satellites at ${width}x${height}, reduced motion ${reducedMotion}`, t => {
      const { cam, camera, bodies } = createController(t, { aspect: width / height, when: new Date('2026-10-01T11:00:00Z') });
      cam.setReducedMotion(reducedMotion);
      if (reducedMotion) cam.travelTo('jupiter');
      else { cam.navigateToBody('jupiter'); finish(cam); }
      camera.updateMatrixWorld(true);
      for (const id of ['io', 'europa', 'ganymede', 'callisto'] as const) {
        const center = bodies.getWorldPos(id, new THREE.Vector3());
        const radius = BODY_BY_ID[id].visualRadius;
        // Include visible body extent, not just centers; no renderer/WebGL is needed.
        const offsets = [[0, 0, 0], [radius, 0, 0], [-radius, 0, 0], [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius]];
        for (const offset of offsets) {
          const ndc = center.clone().add(new THREE.Vector3(...offset)).project(camera);
          assert.ok(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.z) <= 1,
            `${id} outside ${width}x${height} viewport at ${ndc.toArray()}`);
        }
      }
      assert.equal(cam.mode, 'observe');
    });
  }
}
