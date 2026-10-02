import * as THREE from 'three';

/** Release shared scene resources once, including generated maps and instance buffers. */
export function disposeSceneResources(root: THREE.Object3D, extraTextures: THREE.Texture[] = []) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(extraTextures);
  root.traverse(object => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      const entries = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      entries.forEach(material => materials.add(material));
    }
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    if (material instanceof THREE.ShaderMaterial) {
      for (const uniform of Object.values(material.uniforms)) {
        if (uniform.value instanceof THREE.Texture) textures.add(uniform.value);
      }
    }
    material.dispose();
  }
  geometries.forEach(geometry => geometry.dispose());
  textures.forEach(texture => texture.dispose());
}
