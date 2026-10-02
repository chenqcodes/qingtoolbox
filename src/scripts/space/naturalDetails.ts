import * as THREE from 'three';

/** Deterministic, seam-free faceted stone. Repeated triangle vertices share displacement. */
export function createRockGeometry(detail = 1): THREE.IcosahedronGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const relief = 1 + 0.16 * Math.sin(x * 8 + y * 3) * Math.cos(z * 7 - y * 4)
      + 0.07 * Math.sin(x * 19 + z * 13);
    positions.setXYZ(i, x * relief, y * relief * 0.78, z * relief * 0.91);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** View-facing analytic glow, with no texture allocation or square particle boundary. */
export function createComa(radius: number): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  return new THREE.Mesh(new THREE.PlaneGeometry(radius * 14, radius * 14), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uActivity: { value: 1 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv;
      void main() { vUv = uv; vec4 center = modelViewMatrix * vec4(0.,0.,0.,1.);
        center.xy += position.xy; gl_Position = projectionMatrix * center;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      varying vec2 vUv; uniform float uActivity;
      void main() {
        #include <logdepthbuf_fragment>
        float r = length(vUv * 2. - 1.);
        float a = exp(-r * 6.) * (1. - smoothstep(.65,1.,r));
        gl_FragColor = vec4(mix(vec3(.45,.72,.80),vec3(.83,.94,.83),exp(-r*9.)), a * .55 * uActivity); }`,
  }));
}
