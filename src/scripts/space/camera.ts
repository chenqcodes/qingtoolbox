import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { C_AU_PER_S, BODY_BY_ID, BODIES, type BodyId } from './constants';
import type { BodySystem } from './bodies';
import type { TravelTrail } from './minimap';
import type { StarSystem, StarId } from './stars';
import { STAR_BY_ID } from './stars';
import { applyScaleVisibility, type ScaleMode } from './scale';
import type { CometSystem } from './cometSystem';
import type { CometId } from './comets';
import { COMET_BY_ID } from './comets';
import { ViewTransition } from './transition';

export type CamMode = 'observe' | 'fly' | 'travel' | 'tour' | 'facesun';
type TravelDomain = 'body' | 'star' | 'comet';
type Destination = { domain: TravelDomain; id: BodyId | StarId | CometId };
const UP = new THREE.Vector3(0, 1, 0);
const VIEW_DIRECTION = new THREE.Vector3(.65, .35, 1).normalize();
const TOUR_IDS = BODIES.filter(body => !body.moonOf).map(body => body.id);

/** Camera position, attitude, target and lens always have exactly one owner.
 * Transitions start at the rendered pose; interrupts invalidate their callbacks.
 * AU and ly are deliberately separate visual models, joined by a scene dissolve. */
export class CameraController {
  mode: CamMode = 'observe';
  speedMult = 1;
  focus: BodyId = 'earth';
  starFocus: StarId = 'sol';
  scaleMode: ScaleMode = 'solar';
  currentSpeedAu = 0;
  touring = false;
  reducedMotion = false;
  travelTrail: TravelTrail | null = null;
  travelDestId: BodyId = 'earth';
  travelDestStar: StarId = 'sirius';
  travelDestComet: CometId = 'halley';
  cometFocus: CometId | null = null;
  travelDomain: TravelDomain = 'body';
  private orbit: OrbitControls;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private flyRoll = 0;
  private baseFov: number;
  private transition: ViewTransition | null = null;
  private destination: Destination | null = null;
  private endOffset = new THREE.Vector3();
  private targetOffset = new THREE.Vector3();
  private trackedPivot = new THREE.Vector3();
  private travelDone: (() => void) | null = null;
  private tourIndex = 0;
  private tourElapsed = 0;
  private entryOrbit = true;
  private entryOrbitLeft = 14;
  private abort = new AbortController();

  constructor(
    private camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    private bodies: BodySystem,
    private stars: StarSystem,
    private comets: CometSystem,
    private onScaleChange?: (mode: ScaleMode) => void,
    private onBeforeScaleChange?: () => void,
  ) {
    this.baseFov = camera.fov;
    this.orbit = new OrbitControls(camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = .08;
    this.orbit.rotateSpeed = .6;
    this.orbit.zoomSpeed = 1.25;
    this.orbit.panSpeed = .45;
    this.orbit.screenSpacePanning = true;
    this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.orbit.addEventListener('start', () => {
      // OrbitControls dispatches start before its first movement: the exact current
      // frame becomes its anchor, so dragging can also interrupt an automatic flight.
      this.cancelNavigation();
      this.adoptRenderedView();
    });
    canvas.style.touchAction = 'none';
    const options = { signal: this.abort.signal };
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
    canvas.addEventListener('wheel', event => {
      if (this.mode === 'fly') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
      this.zoomBy(Math.exp(THREE.MathUtils.clamp(event.deltaY * units * .0015, -1, 1)));
    }, { ...options, capture: true, passive: false });
    let drag = false, x = 0, y = 0;
    canvas.addEventListener('pointerdown', event => {
      if (this.mode !== 'fly') return;
      drag = true; x = event.clientX; y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (!drag || this.mode !== 'fly') return;
      this.yaw -= (event.clientX - x) * .003;
      if (event.clientY !== y) this.pitch = THREE.MathUtils.clamp(this.pitch - (event.clientY - y) * .003, -Math.PI / 2 + .0001, Math.PI / 2 - .0001);
      x = event.clientX; y = event.clientY;
    }, options);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = false; }, options);
    window.addEventListener('keydown', event => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.code === 'KeyF') this.setMode(this.mode === 'fly' ? 'observe' : 'fly');
      if (event.code === 'KeyT') this.toggleTour();
    }, options);
    window.addEventListener('keyup', event => this.keys.delete(event.code), options);
    window.addEventListener('blur', () => { this.keys.clear(); drag = false; }, options);
    this.beginEarthEntryOrbit();
  }

  dispose() { this.abort.abort(); this.orbit.dispose(); }
  stopEntryOrbit() { this.entryOrbit = false; }
  beginEarthEntryOrbit() {
    this.jumpToBody('earth');
    this.entryOrbit = !this.reducedMotion;
    this.entryOrbitLeft = 14;
  }

  private currentDestination(): Destination {
    if (this.scaleMode === 'stellar') return { domain: 'star', id: this.starFocus };
    if (this.cometFocus) return { domain: 'comet', id: this.cometFocus };
    return { domain: 'body', id: this.focus };
  }
  private pivot(dest = this.currentDestination()): THREE.Vector3 {
    const out = new THREE.Vector3();
    if (dest.domain === 'star') return this.stars.getWorldPos(dest.id as StarId, out);
    if (dest.domain === 'comet') return this.comets.getWorldPos(dest.id as CometId, out);
    return this.bodies.getWorldPos(dest.id as BodyId, out);
  }
  private minimum(dest: Destination) {
    if (dest.domain === 'star') return Math.max(STAR_BY_ID[dest.id as StarId].visualRadius * 8, .45);
    if (dest.domain === 'comet') return Math.max(COMET_BY_ID[dest.id as CometId].visualRadius * 40, .08);
    return dest.id === 'sun' ? .7 : Math.max(this.bodies.getDef(dest.id as BodyId).visualRadius * 1.6, .0005);
  }
  private viewDistance(dest: Destination) {
    if (dest.domain === 'star') return Math.max(STAR_BY_ID[dest.id as StarId].visualRadius * 22, 1.15);
    if (dest.domain === 'comet') return .65;
    if (dest.id === 'sun') return 1.4;
    const def = this.bodies.getDef(dest.id as BodyId);
    const target = this.pivot(dest);
    let envelope = def.visualRadius;
    for (const moon of BODIES.filter(body => body.parent === dest.id)) {
      envelope = Math.max(envelope, this.bodies.getWorldPos(moon.id, new THREE.Vector3()).distanceTo(target) + moon.visualRadius);
    }
    const vertical = this.baseFov * Math.PI / 360;
    const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
    return Math.max(def.visualRadius * 10, envelope / Math.sin(Math.min(vertical, horizontal)) * 1.2, .025);
  }
  private viewOffset(dest: Destination) {
    if (dest.domain !== 'comet') return VIEW_DIRECTION.clone().multiplyScalar(this.viewDistance(dest));
    const away = this.comets.antiSunDir(dest.id as CometId, new THREE.Vector3()).normalize();
    const side = new THREE.Vector3().crossVectors(UP, away);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    return away.addScaledVector(side.normalize(), .28).addScaledVector(UP, .08).normalize().multiplyScalar(this.viewDistance(dest));
  }
  private setDestination(dest: Destination) {
    this.travelDomain = dest.domain;
    this.cometFocus = null;
    if (dest.domain === 'star') this.starFocus = this.travelDestStar = dest.id as StarId;
    else if (dest.domain === 'comet') this.cometFocus = this.travelDestComet = dest.id as CometId;
    else { this.focus = this.travelDestId = dest.id as BodyId; this.starFocus = 'sol'; }
    this.trackedPivot.copy(this.pivot(dest));
  }

  /** Flush controls' private inertia by updating once with damping off, but restore
   * the rendered pose afterwards. Merely disabling controls does not clear inertia. */
  private drainOrbit() {
    const position = this.camera.position.clone(), quaternion = this.camera.quaternion.clone();
    const target = this.orbit.target.clone();
    const damping = this.orbit.enableDamping, minimum = this.orbit.minDistance, maximum = this.orbit.maxDistance;
    this.orbit.enableDamping = false;
    this.orbit.minDistance = 0;
    this.orbit.maxDistance = Infinity;
    this.orbit.update();
    this.camera.position.copy(position);
    this.camera.quaternion.copy(quaternion);
    this.orbit.target.copy(target);
    this.orbit.enableDamping = damping;
    this.orbit.minDistance = minimum;
    this.orbit.maxDistance = maximum;
  }
  private cancelNavigation() {
    this.transition = null;
    this.destination = null;
    this.travelDone = null;
    this.travelTrail = null;
    this.touring = false;
    this.stopEntryOrbit();
    this.keys.clear();
    this.drainOrbit();
  }
  private renderedTarget() {
    const distance = Math.max(this.camera.position.distanceTo(this.orbit.target), .001);
    return this.camera.position.clone().addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()), distance);
  }
  private adoptRenderedView() {
    this.orbit.target.copy(this.renderedTarget());
    this.trackedPivot.copy(this.pivot());
    this.targetOffset.copy(this.orbit.target).sub(this.trackedPivot);
    this.orbit.minDistance = Math.min(this.minimum(this.currentDestination()), this.camera.position.distanceTo(this.orbit.target));
    this.orbit.maxDistance = Math.max(120, this.camera.position.distanceTo(this.orbit.target));
    // OrbitControls.lookAt must inherit the in-flight roll on takeover. Relax
    // its up vector gradually in update(), rather than snapping it to world-up.
    const roll = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').z;
    this.camera.up.copy(UP);
    if (Math.abs(roll) > 1e-8) this.camera.up.applyQuaternion(this.camera.quaternion);
    this.mode = 'observe';
    this.orbit.enabled = true;
  }

  setMode(mode: CamMode) {
    if (mode === 'tour') { this.startTour(); return; }
    if (mode !== 'fly' && mode !== 'observe') return;
    this.cancelNavigation();
    if (mode === 'observe') this.adoptRenderedView();
    else {
      this.mode = 'fly';
      this.orbit.enabled = false;
      const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.yaw = euler.y; this.pitch = euler.x; this.flyRoll = euler.z;
    }
  }
  setReducedMotion(enabled: boolean) {
    this.reducedMotion = enabled;
    this.orbit.enableDamping = !enabled;
    if (enabled) {
      const dest = this.destination ?? this.currentDestination();
      this.jump(dest);
    }
  }

  /** A scale change cannot be a physical zoom: the two views use different units
   * and deliberately exaggerated radii. Capture the old rendered scene first;
   * the renderer blends it with the new live scene without a blank/flash frame. */
  private switchScale(scale: ScaleMode) {
    if (scale === this.scaleMode) return false;
    if (!this.reducedMotion) this.onBeforeScaleChange?.();
    this.scaleMode = scale;
    applyScaleVisibility(scale, this.bodies, this.stars);
    this.comets.setRootVisible(scale === 'solar');
    this.onScaleChange?.(scale);
    return true;
  }
  private jump(dest: Destination) {
    this.cancelNavigation();
    this.switchScale(dest.domain === 'star' ? 'stellar' : 'solar');
    this.setDestination(dest);
    this.targetOffset.set(0, 0, 0);
    this.orbit.target.copy(this.pivot(dest));
    this.camera.position.copy(this.orbit.target).add(this.viewOffset(dest));
    this.camera.up.copy(UP);
    this.camera.lookAt(this.orbit.target);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
    this.orbit.minDistance = this.minimum(dest);
    this.orbit.maxDistance = 120;
    this.mode = 'observe';
    this.orbit.enabled = true;
  }
  jumpToBody(id: BodyId) { this.jump({ domain: 'body', id }); }
  jumpToStar(id: StarId) { id === 'sol' ? this.jumpToBody('earth') : this.jump({ domain: 'star', id }); }

  private navigate(dest: Destination, onDone?: () => void, offset?: THREE.Vector3, duration?: number, targetOffset = new THREE.Vector3()) {
    if (this.reducedMotion) {
      this.jump(dest);
      if (offset) {
        this.targetOffset.copy(targetOffset);
        this.orbit.target.copy(this.pivot(dest)).add(targetOffset);
        this.camera.position.copy(this.orbit.target).add(offset);
        this.camera.lookAt(this.orbit.target);
      }
      onDone?.(); return;
    }
    const wasTouring = this.touring;
    // Snapshot before canceling anything, including a partially interpolated look.
    const from = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), target: this.renderedTarget(), fov: this.camera.fov };
    this.cancelNavigation();
    const changedScale = this.switchScale(dest.domain === 'star' ? 'stellar' : 'solar');
    this.setDestination(dest);
    this.targetOffset.copy(targetOffset);
    const target = this.pivot(dest).add(targetOffset);
    const endOffset = offset?.clone() ?? this.viewOffset(dest);
    if (changedScale) {
      // Destination scale starts already framed, behind the captured source image.
      // The dissolve owns this boundary; never interpolate AU values as ly.
      this.camera.position.copy(target).add(endOffset);
      this.camera.up.copy(UP);
      this.camera.lookAt(target);
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
      from.position.copy(this.camera.position);
      from.quaternion.copy(this.camera.quaternion);
      from.target.copy(target);
      from.fov = this.baseFov;
    }
    this.orbit.target.copy(from.target);
    this.endOffset.copy(endOffset);
    this.destination = dest;
    this.transition = new ViewTransition(from, changedScale ? .85 : duration ?? Math.min(2.8, Math.max(.8, 1 + Math.log1p(from.position.distanceTo(target)) * .3)));
    this.travelDone = onDone ?? null;
    this.mode = 'travel';
    this.touring = wasTouring;
    // Controls remain interactive, but update() is exclusively owned by transition
    // until an actual gesture explicitly cancels it.
    this.orbit.enabled = true;
    this.orbit.minDistance = 0;
    this.orbit.maxDistance = Infinity;
    this.travelTrail = { from: from.position.clone(), mid: from.position.clone().lerp(target, .5), to: target.clone().add(endOffset), progress: 0 };
  }
  navigateToBody(id: BodyId, onDone?: () => void) { this.stopTour(); this.navigate({ domain: 'body', id }, onDone); }
  navigateToStar(id: StarId, onDone?: () => void) {
    this.stopTour();
    this.navigate(id === 'sol' ? { domain: 'body', id: 'earth' } : { domain: 'star', id }, onDone);
  }
  travelTo(id: BodyId, onDone?: () => void) { this.navigate({ domain: 'body', id }, onDone); }
  travelToStar(id: StarId, onDone?: () => void) { this.navigateToStar(id, onDone); }
  returnToSol(onDone?: () => void) { this.navigateToBody('earth', onDone); }
  travelToComet(id: CometId, onDone?: () => void) { this.stopTour(); this.navigate({ domain: 'comet', id }, onDone); }
  setFocus(id: BodyId) { if (id !== this.focus || this.cometFocus) this.navigateToBody(id); }
  setStarFocus(id: StarId) { if (id !== this.starFocus) this.navigateToStar(id); }
  resetView() { this.stopTour(); this.navigate(this.destination ?? this.currentDestination()); }

  zoomBy(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const dest = this.destination ?? this.currentDestination();
    const target = this.renderedTarget();
    const offset = this.camera.position.clone().sub(target);
    const desired = this.transition && this.destination ? this.endOffset.length() : offset.length();
    const length = THREE.MathUtils.clamp(desired * factor, this.minimum(dest), 120);
    const targetOffset = target.clone().sub(this.pivot(dest));
    const end = offset.normalize().multiplyScalar(length);
    this.stopTour();
    if (this.reducedMotion) {
      this.cancelNavigation(); this.setDestination(dest); this.targetOffset.copy(targetOffset);
      this.orbit.target.copy(target); this.camera.position.copy(target).add(end);
      this.mode = 'observe'; this.orbit.enabled = true;
      this.orbit.minDistance = this.minimum(dest); this.orbit.maxDistance = 120;
    } else this.navigate(dest, undefined, end, .45, targetOffset);
  }

  faceSun() {
    if (this.scaleMode !== 'solar') return;
    this.stopTour();
    const dest = this.destination ?? this.currentDestination();
    const target = this.pivot(dest);
    const away = target.clone().sub(this.bodies.getWorldPos('sun', new THREE.Vector3()));
    if (away.lengthSq() < 1e-10) away.set(0, .12, 1);
    away.normalize();
    const side = new THREE.Vector3().crossVectors(UP, away).normalize();
    const distance = Math.max(this.camera.position.distanceTo(target), this.minimum(dest));
    const offset = away.multiplyScalar(.9).addScaledVector(side, .32).normalize().multiplyScalar(distance);
    this.navigate(dest, undefined, offset, 1.3);
  }
  toggleTour() { this.touring ? this.stopTour() : this.startTour(); }
  startTour() {
    if (this.reducedMotion || this.scaleMode !== 'solar') return;
    this.stopTour();
    this.touring = true;
    const parent = BODY_BY_ID[this.focus]?.moonOf;
    this.tourIndex = Math.max(0, TOUR_IDS.indexOf(parent ?? this.focus));
    this.gotoTourBody();
  }
  stopTour() {
    const active = this.touring;
    this.touring = false;
    if (active) { this.cancelNavigation(); this.adoptRenderedView(); }
  }
  private gotoTourBody() {
    this.navigate({ domain: 'body', id: TOUR_IDS[this.tourIndex] }, () => {
      if (!this.touring) return;
      this.mode = 'tour'; this.tourElapsed = 0;
    });
  }

  applyOriginShift(delta: THREE.Vector3) {
    if (delta.lengthSq() < 1e-18) return;
    this.camera.position.sub(delta);
    this.orbit.target.sub(delta);
    this.trackedPivot.sub(delta);
    this.transition?.shift(delta);
    if (this.travelTrail) { this.travelTrail.from.sub(delta); this.travelTrail.mid.sub(delta); this.travelTrail.to.sub(delta); }
  }
  getAdaptiveSpeedAu() {
    if (this.mode === 'fly' && this.scaleMode === 'solar') return Math.max(this.camera.position.clone().add(this.bodies.floatingOrigin).length() * .22, .025) * this.speedMult;
    return Math.max(this.camera.position.distanceTo(this.pivot()) * .55, this.scaleMode === 'stellar' ? .02 : .015) * this.speedMult;
  }
  update(delta: number) {
    const dt = Math.min(.05, Math.max(0, Number.isFinite(delta) ? delta : 0));
    this.currentSpeedAu = this.getAdaptiveSpeedAu();
    if (this.transition && this.destination) {
      this.trackedPivot.copy(this.pivot(this.destination));
      const target = this.trackedPivot.clone().add(this.targetOffset);
      const pose = this.transition.sample(dt, target, this.endOffset, this.baseFov);
      this.camera.position.copy(pose.position); this.camera.quaternion.copy(pose.quaternion);
      this.orbit.target.copy(pose.target);
      if (this.camera.fov !== pose.fov) { this.camera.fov = pose.fov; this.camera.updateProjectionMatrix(); }
      if (this.travelTrail) { this.travelTrail.progress = pose.progress; this.travelTrail.to.copy(target).add(this.endOffset); }
      if (pose.done) {
        const done = this.travelDone;
        this.transition = null; this.destination = null; this.travelDone = null; this.travelTrail = null;
        this.mode = 'observe';
        this.camera.up.copy(UP);
        this.orbit.minDistance = Math.min(this.minimum(this.currentDestination()), this.endOffset.length());
        this.orbit.maxDistance = Math.max(120, this.endOffset.length());
        done?.();
      }
      return;
    }
    if (this.mode === 'fly') {
      const turn = 1.2 * dt;
      if (this.keys.has('ArrowLeft')) this.yaw += turn;
      if (this.keys.has('ArrowRight')) this.yaw -= turn;
      const pitchInput = Number(this.keys.has('ArrowUp')) - Number(this.keys.has('ArrowDown'));
      if (pitchInput) this.pitch = THREE.MathUtils.clamp(this.pitch + pitchInput * turn, -Math.PI / 2 + .0001, Math.PI / 2 - .0001);
      this.flyRoll *= Math.exp(-3 * dt);
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.flyRoll, 'YXZ'));
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      const x = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      const y = Number(this.keys.has('KeyE') || this.keys.has('Space')) - Number(this.keys.has('KeyQ') || this.keys.has('ShiftLeft'));
      const z = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      this.camera.position.add(forward.multiplyScalar(z).addScaledVector(right, x).addScaledVector(up, y).normalize().multiplyScalar(this.currentSpeedAu * dt));
      return;
    }
    // Follow only the body's movement. Do not replace a panned/flight view's target.
    const livePivot = this.pivot();
    const movement = livePivot.clone().sub(this.trackedPivot);
    this.camera.position.add(movement);
    this.orbit.target.add(movement);
    this.trackedPivot.copy(livePivot);
    const target = this.orbit.target;
    if (this.mode === 'tour' || this.entryOrbit) {
      if (this.entryOrbit) { this.entryOrbitLeft -= dt; if (this.entryOrbitLeft <= 0) this.entryOrbit = false; }
      const offset = this.camera.position.clone().sub(target).applyAxisAngle(UP, (this.mode === 'tour' ? .3 : .12) * dt);
      this.camera.position.copy(target).add(offset); this.camera.lookAt(target);
      if (this.mode === 'tour') {
        this.tourElapsed += dt;
        if (this.tourElapsed >= 9) { this.tourIndex = (this.tourIndex + 1) % TOUR_IDS.length; this.gotoTourBody(); }
        return;
      }
    }
    this.camera.up.lerp(UP, 1 - Math.exp(-3 * dt)).normalize();
    this.orbit.update(dt);
    // Keep manual pan rather than snapping it back on the next frame.
    this.targetOffset.copy(this.orbit.target).sub(this.pivot());
  }
}

/** 光速：ly / 秒 */
const C_LY_PER_S = 1 / (365.25 * 86400);

export function formatSpeed(auPerS: number, stellar = false): string {
  if (stellar) {
    const lyPerS = auPerS; // 星域场景单位即 ly
    const c = lyPerS / C_LY_PER_S;
    if (lyPerS >= 0.1) return `${lyPerS.toFixed(2)} ly/s · ${c.toFixed(0)}c`;
    if (c >= 1) return `${(lyPerS * 1e3).toFixed(2)} mly/s · ${c.toFixed(1)}c`;
    return `${(lyPerS * 1e6).toFixed(1)} μly/s · ${c.toFixed(2)}c`;
  }
  const c = auPerS / C_AU_PER_S;
  if (c >= 100) return `${auPerS.toFixed(2)} AU/s · ${c.toFixed(0)}c`;
  if (c >= 1) return `${auPerS.toFixed(3)} AU/s · ${c.toFixed(1)}c`;
  const km = auPerS * 149597870.7;
  return `${(km / 1000).toFixed(0)} 千km/s · ${c.toFixed(2)}c`;
}
