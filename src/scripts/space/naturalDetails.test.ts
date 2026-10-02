import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRockGeometry } from './naturalDetails';
import { CometSystem } from './cometSystem';
import { COMETS } from './comets';
import { createSunGroup } from './materials';

test('procedural rocks are deterministic, irregular and bounded', () => {
  const a = createRockGeometry(), b = createRockGeometry();
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
  assert.ok(a.boundingSphere!.radius > 0.8 && a.boundingSphere!.radius < 1.4);
  const p = a.attributes.position;
  const radii = new Set(Array.from({ length: p.count }, (_, i) => Math.round(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) * 100)));
  assert.ok(radii.size > 10);
  a.dispose(); b.dispose();
});

test('comets have resolved nuclei, feathered ribbons, and origin-invariant anti-solar tails', () => {
  const scene = new THREE.Scene();
  const comets = new CometSystem(scene);
  comets.updatePositions(new Date('2026-10-02T00:00:00Z'));
  assert.equal(scene.getObjectsByProperty('isPoints', true).length, 0);
  for (let i = 0; i < COMETS.length; i++) {
    const id = COMETS[i].id;
    const group = comets.root.children[i];
    const ion = group.getObjectByName('anti-solar-ion-tail') as THREE.Mesh;
    const dust = group.getObjectByName('curved-dust-tail') as THREE.Mesh;
    const p = ion.geometry.getAttribute('position');
    const end = new THREE.Vector3().fromBufferAttribute(p, p.count - 1);
    assert.ok(end.clone().normalize().dot(comets.antiSunDir(id)) > .99999);
    assert.ok(end.length() > 0 && end.length() <= .55001);
    assert.ok(dust.geometry.index!.count > 100);
    const original = Array.from(p.array);
    const logical = comets.getLogicalPos(id).clone();
    const origin = new THREE.Vector3(7, -2, 4);
    comets.syncOrigin(origin);
    scene.updateMatrixWorld(true);
    assert.ok(comets.getWorldPos(id).add(origin).distanceTo(logical) < 1e-9);
    assert.deepEqual(Array.from(p.array), original);
  }
});

test('Sun uses a continuous feathered corona instead of stacked hard sphere halos', () => {
  const sun = createSunGroup(.06, new THREE.Texture());
  assert.equal(sun.group.children.length, 2);
  const corona = sun.group.getObjectByName('solar-streamer-corona') as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  assert.ok(corona);
  assert.equal(corona.material.depthWrite, false);
  assert.match(corona.material.fragmentShader, /edgeFade/);
  assert.match(corona.material.fragmentShader, /logdepthbuf_fragment/);
  sun.update(10);
  assert.equal(corona.material.uniforms.uTime.value, 10);
});

test('scene cleanup disposes shared geometry, material, maps and instance buffers once', async () => {
  const { disposeSceneResources } = await import('./disposeSceneResources');
  const root = new THREE.Group();
  const geometry = createRockGeometry();
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map });
  const instances = new THREE.InstancedMesh(geometry, material, 3);
  root.add(instances, new THREE.Mesh(geometry, material));
  let geometries = 0, materials = 0, maps = 0, buffers = 0;
  geometry.addEventListener('dispose', () => geometries++);
  material.addEventListener('dispose', () => materials++);
  map.addEventListener('dispose', () => maps++);
  instances.addEventListener('dispose', () => buffers++);
  disposeSceneResources(root, [map]);
  assert.deepEqual([geometries, materials, maps, buffers], [1, 1, 1, 1]);
});

test('every logarithmic-depth custom vertex shader includes the Three common helpers', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['materials.ts', 'naturalDetails.ts', 'cometSystem.ts']) {
    const source = await readFile(new URL(name, import.meta.url), 'utf8');
    const shaders = [...source.matchAll(/vertexShader:\s*(?:\/\*.*?\*\/\s*)?`([\s\S]*?)`/g)];
    assert.ok(shaders.length > 0, name);
    for (const [, shader] of shaders) {
      assert.match(shader, /#include <logdepthbuf_pars_vertex>/, `${name}: depth declarations`);
      assert.match(shader, /#include <logdepthbuf_vertex>/, `${name}: depth output`);
      assert.match(shader, /#include <common>/, `${name}: isPerspectiveMatrix helper`);
      assert.ok(shader.indexOf('#include <common>') < shader.indexOf('#include <logdepthbuf_vertex>'));
    }
  }
});
