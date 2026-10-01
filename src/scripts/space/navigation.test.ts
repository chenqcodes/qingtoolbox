import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraController } from './camera';
import { BODY_BY_ID, type BodyId } from './constants';
import { bodyPosition } from './astronomy';

function controller(aspect = 1, when?: Date) {
  const bodiesOrigin = new THREE.Vector3();
  const starsOrigin = new THREE.Vector3();
  const logical = (id: string) => {
    if (when) {
      const def = BODY_BY_ID[id as BodyId];
      const position = bodyPosition(def.id, def.astro, when);
      return new THREE.Vector3(position.x, position.y, position.z);
    }
    return id === 'moon' ? new THREE.Vector3(1.03, .01, 0) : id === 'earth' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3();
  };
  const bodies = {
    floatingOrigin: bodiesOrigin,
    getDef: (id: keyof typeof BODY_BY_ID) => BODY_BY_ID[id],
    getLogicalPos: (id: string, out: THREE.Vector3) => out.copy(logical(id)),
    getWorldPos: (id: string, out: THREE.Vector3) => out.copy(logical(id)).sub(bodiesOrigin),
    setFloatingOrigin: (origin: THREE.Vector3) => bodiesOrigin.copy(origin),
    setRootVisible() {},
  };
  const cam = Object.assign(Object.create(CameraController.prototype), {
    camera: new THREE.PerspectiveCamera(58, aspect, .0001, 8000),
    bodies,
    stars: {
      getLogicalPos: (_: string, out: THREE.Vector3) => out.set(4.2, .2, 0),
      getWorldPos: (_: string, out: THREE.Vector3) => out.set(4.2, .2, 0).sub(starsOrigin),
      setFloatingOrigin: (origin: THREE.Vector3) => starsOrigin.copy(origin),
      setVisible() {},
    },
    comets: { setRootVisible() {}, syncOrigin() {}, getLogicalPos: (_: string, out: THREE.Vector3) => out.set(2, 0, 0), getWorldPos: (_: string, out: THREE.Vector3) => out.set(2, 0, 0).sub(bodiesOrigin) },
    orbit: { enabled: true, enableDamping: true, target: new THREE.Vector3(), minDistance: .001, maxDistance: 120, update() {} },
    keys: new Set(['w']),
    tmp: new THREE.Vector3(), tmp2: new THREE.Vector3(), tmp3: new THREE.Vector3(),
    mode: 'travel', touring: false, crossPhase: 'leave', pendingStar: 'proxima', returningToSol: true,
    travelDone: () => { throw Error('Aborted callback must not run'); },
    focus: 'earth', starFocus: 'proxima', scaleMode: 'solar', baseFov: 58,
    onScaleChange() {},
  });
  return cam as CameraController & { camera: THREE.PerspectiveCamera; orbit: any; keys: Set<string> };
}

test('instant guide travel escapes cinematic flight and returns from stars to Earth', () => {
  const cam: any = controller();
  cam.jumpToStar('proxima');
  assert.equal(cam.scaleMode, 'stellar');
  assert.equal(cam.mode, 'observe');
  assert.equal(cam.crossPhase, null);
  assert.equal(cam.travelDone, null);
  assert.equal(cam.keys.size, 0);
  cam.jumpToBody('earth');
  assert.equal(cam.scaleMode, 'solar');
  assert.equal(cam.focus, 'earth');
  assert.equal(cam.cometFocus, null);
  assert.ok(cam.camera.position.toArray().every(Number.isFinite));
  assert.ok(cam.camera.position.distanceTo(cam.orbit.target) > .03);
});
test('reduced motion uses immediate body, star, comet and return paths', () => {
  const cam: any = controller();
  cam.setReducedMotion(true);
  assert.equal(cam.orbit.enableDamping, false);
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
test('mobile zoom respects bounds and reset cancels flight without changing target', () => {
  const cam: any = controller();
  cam.jumpToBody('moon');
  cam.zoomBy(1e-8);
  assert.ok(Math.abs(cam.camera.position.distanceTo(cam.orbit.target) - cam.orbit.minDistance) < 1e-8);
  cam.zoomBy(1e9);
  assert.ok(cam.camera.position.distanceTo(cam.orbit.target) <= 120 + 1e-8);
  cam.resetView();
  assert.equal(cam.focus, 'moon');
  assert.equal(cam.mode, 'observe');
});

for (const [width, height] of [[390, 844], [1440, 1000], [844, 390]]) {
  for (const reducedMotion of [false, true]) {
    test(`Jupiter guide frames all real-position satellites at ${width}x${height}, reduced motion ${reducedMotion}`, () => {
      const cam: any = controller(width / height, new Date('2026-10-01T11:00:00Z'));
      cam.setReducedMotion(reducedMotion);
      if (reducedMotion) cam.travelTo('jupiter');
      else cam.jumpToBody('jupiter');
      cam.camera.updateMatrixWorld(true);
      for (const id of ['io', 'europa', 'ganymede', 'callisto'] as const) {
        const center = cam.bodies.getWorldPos(id, new THREE.Vector3());
        const radius = BODY_BY_ID[id].visualRadius;
        // Include visible body extent, not just centers; no renderer/WebGL is needed.
        const offsets = [[0, 0, 0], [radius, 0, 0], [-radius, 0, 0], [0, radius, 0], [0, -radius, 0], [0, 0, radius], [0, 0, -radius]];
        for (const offset of offsets) {
          const ndc = center.clone().add(new THREE.Vector3(...offset)).project(cam.camera);
          assert.ok(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.z) <= 1,
            `${id} outside ${width}x${height} viewport at ${ndc.toArray()}`);
        }
      }
      assert.equal(cam.mode, 'observe');
    });
  }
}
