import * as THREE from 'three';
import type { TestContext } from 'node:test';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraController } from './camera';
import { BODY_BY_ID, type BodyId } from './constants';
import { bodyPosition } from './astronomy';

/** Exercise the real controller and OrbitControls without a renderer or WebGL.
 * Only event-capable DOM surfaces and astronomical systems are test doubles. */
export function createController(t: TestContext, options: { aspect?: number; when?: Date } = {}) {
  const document = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    style: {}, ownerDocument: document, getRootNode: () => document,
    clientWidth: 1200, clientHeight: 800, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }),
  });
  const bodiesOrigin = new THREE.Vector3(), starsOrigin = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const coordinates: Partial<Record<BodyId, number[]>> = {
    sun: [0, 0, 0], earth: [1, 0, 0], moon: [1.03, .01, 0], mars: [1.7, .3, 1],
    jupiter: [5, .3, 2], io: [5.05, .31, 2], europa: [5.09, .3, 2.04],
    ganymede: [4.88, .31, 2], callisto: [5.2, .29, 1.98],
  };
  const logical = (id: BodyId) => {
    if (options.when) {
      const def = BODY_BY_ID[id];
      const p = bodyPosition(id, def.astro, options.when);
      return new THREE.Vector3(p.x, p.y, p.z).add(movement);
    }
    const p = coordinates[id] ?? [2.5, 0, -.5];
    return new THREE.Vector3(p[0], p[1], p[2]).add(movement);
  };
  const visible = { bodies: true, stars: false, comets: true };
  const bodies = {
    floatingOrigin: bodiesOrigin,
    getDef: (id: BodyId) => BODY_BY_ID[id],
    getLogicalPos: (id: BodyId, out: THREE.Vector3) => out.copy(logical(id)),
    getWorldPos: (id: BodyId, out: THREE.Vector3) => out.copy(logical(id)).sub(bodiesOrigin),
    setFloatingOrigin: (origin: THREE.Vector3) => { const delta = origin.clone().sub(bodiesOrigin); bodiesOrigin.copy(origin); return delta; },
    setRootVisible: (value: boolean) => { visible.bodies = value; },
  };
  const starLogical = (id: string, out: THREE.Vector3) => id === 'sol' ? out.set(0, 0, 0)
    : id === 'sirius' ? out.set(-5, .4, 7) : out.set(4.2, .2, 0);
  const stars = {
    getLogicalPos: starLogical,
    getWorldPos: (id: string, out: THREE.Vector3) => starLogical(id, out).sub(starsOrigin),
    setFloatingOrigin: (origin: THREE.Vector3) => { const delta = origin.clone().sub(starsOrigin); starsOrigin.copy(origin); return delta; },
    setVisible: (value: boolean) => { visible.stars = value; },
  };
  const comets = {
    setRootVisible: (value: boolean) => { visible.comets = value; }, syncOrigin() {},
    getLogicalPos: (_: string, out: THREE.Vector3) => out.set(2, .5, -.5).add(movement),
    getWorldPos: (_: string, out: THREE.Vector3) => out.set(2, .5, -.5).add(movement).sub(bodiesOrigin),
    antiSunDir: (_: string, out: THREE.Vector3) => out.set(2, .5, -.5).normalize(),
  };
  const camera = new THREE.PerspectiveCamera(58, options.aspect ?? 1, .0001, 8000);
  const scaleChanges: string[] = [], captures: string[] = [];
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: new EventTarget() });
  let cam: CameraController;
  try {
    cam = new CameraController(camera, canvas as unknown as HTMLCanvasElement, bodies as any, stars as any, comets as any,
      scale => scaleChanges.push(scale), () => captures.push(visible.stars ? 'stellar' : 'solar'));
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else delete (globalThis as any).window;
  }
  cam.stopEntryOrbit();
  t.after(() => cam.dispose());
  const orbit = (cam as any).orbit as OrbitControls;
  return { cam, camera, orbit, bodies, stars, comets, bodiesOrigin, starsOrigin, movement, visible, scaleChanges, captures };
}

export function advance(cam: CameraController, seconds: number, dt = 1 / 120) {
  const frames = Math.ceil(seconds / dt);
  for (let i = 0; i < frames; i++) cam.update(seconds / frames);
}

export function finish(cam: CameraController) {
  for (let i = 0; i < 2400 && cam.mode === 'travel'; i++) cam.update(1 / 120);
  if (cam.mode === 'travel') throw Error('Navigation did not finish within 20 seconds');
}
