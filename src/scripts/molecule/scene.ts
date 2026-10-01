import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_COLOR, ELEMENT_RADIUS, displayedAtomIndices, type Molecule } from './presets';

export type RenderStyle = 'ball-stick' | 'space-fill' | 'sticks';
export type MolScene = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  setMolecule: (mol: Molecule, showPairs: boolean, showHydrogen?: boolean, style?: RenderStyle) => void;
  setSelection: (indices: number[]) => void;
  resetView: () => void;
  setAutoSpin: (on: boolean) => void;
  dispose: () => void;
};

function addStarfield(scene: THREE.Scene) {
  const n = 1200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 40 + Math.random() * 80;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    pos[i * 3 + 2] = r * Math.cos(ph);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.15, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

export function createMolScene(canvas: HTMLCanvasElement, onPick: (index: number) => void = () => {}): MolScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0c1424, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  addStarfield(scene);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  camera.position.set(5, 4, 7);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 0.85;
  // 单指旋转时不要带动页面滚动
  canvas.style.touchAction = 'none';

  scene.add(new THREE.AmbientLight(0xc8d8f0, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(8, 12, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x00e8ff, 0.75);
  rim.position.set(-6, 2, -8);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffc857, 0.55, 60);
  warm.position.set(-4, -3, 5);
  scene.add(warm);

  const root = new THREE.Group();
  scene.add(root);

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  tick();

  let resetView = () => {};
  const setMolecule = (mol: Molecule, showPairs: boolean, showHydrogen = true, style: RenderStyle = 'ball-stick') => {
    while (root.children.length) {
      const ch = root.children[0];
      root.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat.dispose();
        }
      });
    }

    root.position.set(0, 0, 0);
    // 统一坐标尺度，靠相机距离适配画布，避免大分子溢出
    const scale = 1;

    const visible = new Set(displayedAtomIndices(mol, showHydrogen));
    for (const [index, atom] of mol.atoms.entries()) {
      if (!visible.has(index)) continue;
      const radiusScale = style === 'space-fill' ? 2.7 : style === 'sticks' ? 0.35 : 1;
      const geo = new THREE.SphereGeometry(ELEMENT_RADIUS[atom.el] * scale * radiusScale, 24, 18);
      const mat = new THREE.MeshStandardMaterial({
        color: atom.color ?? ELEMENT_COLOR[atom.el],
        roughness: 0.28,
        metalness: 0.22,
        emissive: atom.color ?? ELEMENT_COLOR[atom.el],
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(atom.x * scale, atom.y * scale, atom.z * scale);
      mesh.userData.atomIndex = index;
      root.add(mesh);
    }

    if (style !== 'space-fill') for (const bond of mol.bonds) {
      if (!visible.has(bond.a) || !visible.has(bond.b)) continue;
      const A = mol.atoms[bond.a];
      const B = mol.atoms[bond.b];
      const isPair = bond.kind === 'pair';
      if (isPair && !showPairs) continue;
      const start = new THREE.Vector3(A.x, A.y, A.z);
      const end = new THREE.Vector3(B.x, B.y, B.z);
      const dir = end.clone().sub(start);
      const len = dir.length();
      if (len < 1e-6) continue;
      const normalized = dir.clone().normalize();
      const axis = Math.abs(normalized.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
      const perpendicular = normalized.clone().cross(axis).normalize();
      const order = mol.modelKind === 'schematic' ? 1 : bond.order ?? 1;
      for (let line = 0; line < order; line++) {
        const radius = isPair ? 0.045 : order > 1 ? 0.055 : 0.075;
        const geo = new THREE.CylinderGeometry(radius, radius, len, 10);
        const mat = new THREE.MeshStandardMaterial({ color: isPair ? 0xffc857 : 0x99bbdd, roughness: 0.35, metalness: 0.1 });
        const stick = new THREE.Mesh(geo, mat);
        stick.position.copy(start).add(end).multiplyScalar(0.5).addScaledVector(perpendicular, (line - (order - 1) / 2) * 0.17);
        stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalized);
        root.add(stick);
      }
    }

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    controls.target.set(0, 0, 0);
    // 按包围盒 + FOV 拉远，四周留白，保证整颗分子进画布
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.5);
    const fitH = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const fitW = fitH / Math.max(camera.aspect, 0.2);
    const dist = Math.max(fitH, fitW) * 1.55;
    resetView = () => {
      camera.position.set(dist * 0.72, dist * 0.42, dist * 0.95);
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.35;
      controls.maxDistance = dist * 6;
      controls.update();
    };
    resetView();
  };

  const raycaster = new THREE.Raycaster();
  let pointerStart = { x: 0, y: 0 };
  const pointerDown = (event: PointerEvent) => { pointerStart = { x: event.clientX, y: event.clientY }; };
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(root.children).find((item) => Number.isInteger(item.object.userData.atomIndex));
    if (hit) onPick(hit.object.userData.atomIndex);
  };
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  return {
    renderer,
    camera,
    controls,
    root,
    setMolecule,
    resetView: () => resetView(),
    setSelection: (indices) => {
      const selected = new Set(indices);
      root.children.forEach((child) => {
        if (Number.isInteger(child.userData.atomIndex)) {
          const material = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          material.emissiveIntensity = selected.has(child.userData.atomIndex) ? 0.8 : 0.08;
          child.scale.setScalar(selected.has(child.userData.atomIndex) ? 1.12 : 1);
        }
      });
    },
    setAutoSpin: (on) => {
      controls.autoRotate = on;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      window.removeEventListener('resize', resize);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
    },
  };
}
