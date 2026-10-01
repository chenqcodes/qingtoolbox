import * as THREE from 'three';

export interface ViewPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
  fov: number;
}

const UP = new THREE.Vector3(0, 1, 0);
export const smoothStep = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * u * (u * (u * 6 - 15) + 10); };

/** One owner for an entire navigation. No phase edges, shared scratch vectors or
 * FOV kicks. Log-distance interpolation gives small destinations a real approach
 * instead of spending almost the whole flight at interplanetary distance. */
export class ViewTransition {
  elapsed = 0;
  readonly from: ViewPose;
  readonly fromOffset: THREE.Vector3;
  constructor(from: ViewPose, readonly duration: number) {
    this.from = { position: from.position.clone(), quaternion: from.quaternion.clone(), target: from.target.clone(), fov: from.fov };
    this.fromOffset = from.position.clone().sub(from.target);
  }
  shift(delta: THREE.Vector3) {
    this.from.position.sub(delta);
    this.from.target.sub(delta);
  }
  sample(dt: number, target: THREE.Vector3, offset: THREE.Vector3, fov: number): ViewPose & { done: boolean; progress: number } {
    // A resumed background tab must not consume an entire navigation in one frame.
    this.elapsed += Math.min(.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    const raw = Math.min(1, this.elapsed / this.duration);
    const t = smoothStep(raw);
    const pivot = this.from.target.clone().lerp(target, t);
    const fromRadius = this.fromOffset.length();
    const toRadius = offset.length();
    // A fly camera can be exactly on its pivot. Give a zero-length offset a
    // usable direction, but keep its actual radius so sample(0) is still exact.
    const fromDir = fromRadius > 0 ? this.fromOffset.clone().divideScalar(fromRadius)
      : toRadius > 0 ? offset.clone().divideScalar(toRadius) : new THREE.Vector3(0, 0, 1);
    const toDir = toRadius > 0 ? offset.clone().divideScalar(toRadius) : fromDir.clone();
    const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
    const a = new THREE.Spherical().setFromVector3(fromDir);
    const b = new THREE.Spherical().setFromVector3(toDir);
    const direction = new THREE.Vector3().setFromSpherical(new THREE.Spherical(
      1, a.phi + (b.phi - a.phi) * t, a.theta + wrap(b.theta - a.theta) * t,
    ));
    const radius = fromRadius === 0 || toRadius === 0
      ? fromRadius + (toRadius - fromRadius) * t
      : Math.exp(Math.log(fromRadius) * (1 - t) + Math.log(toRadius) * t);
    const position = pivot.clone().addScaledVector(direction, radius);
    const look = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(toDir, new THREE.Vector3(), UP));
    // Interpolate endpoint yaw/pitch with a wrapped yaw. This avoids both the
    // UP-pole lookAt flip and the artificial mid-flight roll introduced by a
    // shortest quaternion arc (which OrbitControls would discard on takeover).
    const start = new THREE.Euler().setFromQuaternion(this.from.quaternion, 'YXZ');
    const end = new THREE.Euler().setFromQuaternion(look, 'YXZ');
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      start.x + (end.x - start.x) * t,
      start.y + wrap(end.y - start.y) * t,
      start.z + wrap(end.z - start.z) * t, 'YXZ',
    ));
    return { position, target: pivot, quaternion, fov: this.from.fov + (fov - this.from.fov) * t, done: raw === 1, progress: t };
  }
}
