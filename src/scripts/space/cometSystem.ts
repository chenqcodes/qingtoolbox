import * as THREE from 'three';
import { COMETS, cometPosition, type CometDef, type CometId } from './comets';
import { createRockGeometry, createComa } from './naturalDetails';

/** 彗星核 + 背日彗尾粒子 */
export class CometSystem {
  root = new THREE.Group();
  floatingOrigin = new THREE.Vector3();
  private meshes = new Map<CometId, THREE.Group>();
  private logical = new Map<CometId, THREE.Vector3>();
  private tails = new Map<CometId, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[]>();
  private comas = new Map<CometId, ReturnType<typeof createComa>>();
  private tmp = new THREE.Vector3();
  private tmpSun = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    for (const def of COMETS) {
      this.logical.set(def.id, new THREE.Vector3());
      this.meshes.set(def.id, this.createComet(def));
    }
  }

  private createComet(def: CometDef) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(createRockGeometry(2), new THREE.MeshStandardMaterial({
      color: 0x746b60, roughness: 1, metalness: 0, flatShading: true,
    }));
    core.name = `${def.id}-nucleus`;
    core.scale.set(def.visualRadius * 1.3, def.visualRadius, def.visualRadius * 0.85);
    core.rotation.set(0.4, 0.7, 0.2);
    g.add(core);
    const coma = createComa(def.visualRadius);
    coma.frustumCulled = false;
    this.comas.set(def.id, coma);
    g.add(coma);
    const tails = [this.createTail(false), this.createTail(true)];
    tails.forEach(tail => g.add(tail));
    this.tails.set(def.id, tails);
    this.root.add(g);
    return g;
  }

  /** A continuous ribbon expanded perpendicular to its projected tangent, never square points. */
  private createTail(dust: boolean) {
    const segments = 64;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const tangents = new Float32Array(positions.length);
    const uv = new Float32Array((segments + 1) * 4);
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      uv.set([i / segments, 0, i / segments, 1], i * 4);
      if (i < segments) { const k = i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uWidth: { value: 0.01 }, uActivity: { value: 1 },
        uColor: { value: new THREE.Color(dust ? 0xe4c9a1 : 0x71a9eb) },
        uDust: { value: dust ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        #include <common>
      #include <logdepthbuf_pars_vertex>
        attribute vec3 tangent;
        varying vec2 vUv;
        uniform float uWidth;
        uniform float uDust;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vec3 dir = mat3(modelViewMatrix) * tangent;
          vec2 side = vec2(-dir.y, dir.x);
          side = length(side) > 0.00001 ? normalize(side) : vec2(1.0, 0.0);
          float spread = mix(0.11 + uv.x * 0.55, 0.06 + pow(uv.x, 0.8) * 1.3, uDust);
          mv.xy += side * (uv.y * 2.0 - 1.0) * uWidth * spread;
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <logdepthbuf_pars_fragment>
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uActivity;
        uniform float uDust;
        void main() {
          #include <logdepthbuf_fragment>
          float crossTail = abs(vUv.y * 2.0 - 1.0);
          float feather = exp(-crossTail * crossTail * 5.0) * (1.0 - smoothstep(0.7, 1.0, crossTail));
          float fade = pow(1.0 - vUv.x, 1.5) * smoothstep(0.0, 0.015, vUv.x);
          float striae = 0.85 + 0.15 * sin(vUv.y * 47.0 + vUv.x * 15.0);
          gl_FragColor = vec4(uColor, feather * fade * striae * uActivity * mix(0.30, 0.20, uDust));
        }
      `,
    });
    const tail = new THREE.Mesh(geometry, material);
    tail.name = dust ? 'curved-dust-tail' : 'anti-solar-ion-tail';
    tail.frustumCulled = false;
    return tail;
  }

  updatePositions(when: Date) {
    for (const def of COMETS) {
      const p = cometPosition(def, when);
      this.logical.get(def.id)!.set(p.x, p.y, p.z);
      this.applyLocal(def.id);
      this.updateTail(def, when);
    }
  }

  private updateTail(def: CometDef, when: Date) {
    const log = this.logical.get(def.id)!;
    const away = this.tmpSun.copy(log).normalize();
    if (away.lengthSq() < 1e-8) away.set(1, 0, 0);
    // Dust lags orbital motion; ionized gas follows the anti-solar wind more directly.
    const before = cometPosition(def, new Date(when.getTime() - 86400000));
    const lag = new THREE.Vector3(before.x - log.x, before.y - log.y, before.z - log.z);
    lag.addScaledVector(away, -lag.dot(away)).normalize();
    const distance = Math.max(log.length(), 0.5);
    const activity = Math.min(1, 2.5 / (distance * distance));
    const len = Math.min(0.55, Math.max(def.visualRadius * 12, 0.35 / distance));
    this.comas.get(def.id)!.material.uniforms.uActivity.value = activity;
    this.tails.get(def.id)!.forEach((tail, index) => {
      const dust = index === 1;
      const pos = tail.geometry.getAttribute('position') as THREE.BufferAttribute;
      const tangent = tail.geometry.getAttribute('tangent') as THREE.BufferAttribute;
      const segments = pos.count / 2 - 1;
      const length = len * (dust ? 0.8 : 1);
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const curve = dust ? length * 0.32 * t * t : 0;
        for (let side = 0; side < 2; side++) {
          const k = i * 2 + side;
          pos.setXYZ(k, away.x * length * t + lag.x * curve, away.y * length * t + lag.y * curve, away.z * length * t + lag.z * curve);
          const bend = dust ? 0.64 * t : 0;
          tangent.setXYZ(k, away.x + lag.x * bend, away.y + lag.y * bend, away.z + lag.z * bend);
        }
      }
      pos.needsUpdate = true;
      tangent.needsUpdate = true;
      tail.material.uniforms.uWidth.value = Math.max(def.visualRadius * 3, length * (dust ? 0.065 : 0.017));
      tail.material.uniforms.uActivity.value = activity;
    });
  }

  private applyLocal(id: CometId) {
    const log = this.logical.get(id)!;
    const g = this.meshes.get(id)!;
    g.position.set(
      log.x - this.floatingOrigin.x,
      log.y - this.floatingOrigin.y,
      log.z - this.floatingOrigin.z,
    );
  }

  setFloatingOrigin(next: THREE.Vector3): THREE.Vector3 {
    const delta = this.tmp.copy(next).sub(this.floatingOrigin);
    if (delta.lengthSq() < 1e-18) return this.tmp.set(0, 0, 0);
    this.floatingOrigin.copy(next);
    for (const def of COMETS) this.applyLocal(def.id);
    return delta;
  }

  /** 与行星共用同一 FO 时直接同步原点 */
  syncOrigin(origin: THREE.Vector3) {
    this.floatingOrigin.copy(origin);
    for (const def of COMETS) this.applyLocal(def.id);
  }

  getWorldPos(id: CometId, out = new THREE.Vector3()) {
    const g = this.meshes.get(id);
    if (!g) return out.set(0, 0, 0);
    return g.getWorldPosition(out);
  }

  getLogicalPos(id: CometId, out = new THREE.Vector3()) {
    return out.copy(this.logical.get(id)!);
  }

  getDef(id: CometId): CometDef {
    return COMETS.find((c) => c.id == id)!;
  }

  setRootVisible(v: boolean) {
    this.root.visible = v;
  }

  /** 反日方向单位向量（世界），用于跟随彗尾视角 */
  antiSunDir(id: CometId, out = new THREE.Vector3()) {
    const log = this.logical.get(id)!;
    return out.copy(log).normalize();
  }
}
