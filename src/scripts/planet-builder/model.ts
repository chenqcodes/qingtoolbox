/** Procedural illustration, not a climate, atmosphere, or habitability simulation. */
export const TAU = Math.PI * 2;
export const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, value: number) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const wrap = (value: number, period: number) => ((value % period) + period) % period;

export type WorldKind = 'oasis' | 'ember' | 'frost';
export interface PlanetSettings {
  kind: WorldKind;
  seed: number;
  sea: number;
  relief: number;
  clouds: number;
  atmosphere: number;
  warmth: number;
  phase: number;
  aurora: boolean;
  storm: boolean;
}
export const PRESETS: Record<WorldKind, PlanetSettings> = {
  oasis: { kind: 'oasis', seed: 2718, sea: 55, relief: 58, clouds: 47, atmosphere: 65, warmth: 42, phase: 38, aurora: false, storm: false },
  ember: { kind: 'ember', seed: 1618, sea: 18, relief: 82, clouds: 18, atmosphere: 36, warmth: 85, phase: 46, aurora: false, storm: true },
  frost: { kind: 'frost', seed: 3141, sea: 39, relief: 46, clouds: 33, atmosphere: 82, warmth: 13, phase: 62, aurora: true, storm: false },
};

// Integer hashing and lattice interpolation keep textures deterministic and seamless on a sphere.
export function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  return mix(mix(mix(hash3(ix, iy, iz, seed), hash3(ix + 1, iy, iz, seed), u), mix(hash3(ix, iy + 1, iz, seed), hash3(ix + 1, iy + 1, iz, seed), u), v), mix(mix(hash3(ix, iy, iz + 1, seed), hash3(ix + 1, iy, iz + 1, seed), u), mix(hash3(ix, iy + 1, iz + 1, seed), hash3(ix + 1, iy + 1, iz + 1, seed), u), v), w);
}
export function fractal(x: number, y: number, z: number, seed: number, octaves = 5): number {
  let total = 0, weight = 0, amplitude = .5;
  for (let octave = 0; octave < octaves; octave++) {
    total += noise3(x, y, z, seed + octave * 157) * amplitude;
    weight += amplitude;
    x *= 2.03; y *= 2.03; z *= 2.03; amplitude *= .5;
  }
  return total / weight;
}
export function surfaceAt(longitude: number, latitude: number, seed: number): { height: number; cloud: number; detail: number } {
  const cosLat = Math.cos(latitude);
  const x = cosLat * Math.cos(longitude), y = Math.sin(latitude), z = cosLat * Math.sin(longitude);
  const warp = noise3(x * 2 + 4, y * 2 + 2, z * 2 + 7, seed + 41) - .5;
  const elevation = fractal(x * 2.7 + warp * .7 + 1.3, y * 2.7 - .4, z * 2.7 + warp * .5, seed, 6);
  const height = clamp((elevation - .27) * 2.1);
  const wind = 1.1 * Math.sin(latitude * 5) + warp * .8;
  const cloud = fractal(x * 5.1 + wind, y * 5.1 + 2, z * 5.1 + wind, seed + 918, 5);
  return { height, cloud, detail: noise3(x * 72, y * 72, z * 72, seed + 11) };
}
export interface PlanetTexture { width: number; height: number; terrain: Float32Array; clouds: Float32Array; detail: Float32Array }
function allocateTexture(width: number, height: number): PlanetTexture {
  return { width, height, terrain: new Float32Array(width * height), clouds: new Float32Array(width * height), detail: new Float32Array(width * height) };
}
function fillTextureRow(texture: PlanetTexture, seed: number, y: number): void {
  const { width, height, terrain, clouds, detail } = texture;
  const latitude = (y / (height - 1) - .5) * Math.PI;
  for (let x = 0; x < width; x++) {
    const i = y * width + x, sample = surfaceAt(x / width * TAU, latitude, seed);
    terrain[i] = sample.height; clouds[i] = sample.cloud; detail[i] = sample.detail;
  }
}
export function createTexture(seed: number, width = 1024, height = 512): PlanetTexture {
  const texture = allocateTexture(width, height);
  for (let y = 0; y < height; y++) fillTextureRow(texture, seed, y);
  return texture;
}
export interface TextureJobOptions {
  signal?: AbortSignal;
  /** Injectable cooperative yield for deterministic scheduler/cancellation tests. */
  yieldControl?: () => Promise<void>;
  budgetMs?: number;
}
/** Same deterministic samples as createTexture, yielded in <=8-row / ~6ms chunks. */
export async function createTextureAsync(seed: number, width = 1024, height = 512, options: TextureJobOptions = {}): Promise<PlanetTexture> {
  const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  const checkCancelled = () => { if (options.signal?.aborted) throw new DOMException('Texture generation cancelled', 'AbortError'); };
  checkCancelled();
  await yieldControl(); // Paint loading UI and honor a newer request before allocating.
  checkCancelled();
  const texture = allocateTexture(width, height);
  const budget = clamp(options.budgetMs ?? 6, 1, 12);
  let chunkStarted = performance.now(), rowsInChunk = 0;
  for (let y = 0; y < height; y++) {
    checkCancelled();
    fillTextureRow(texture, seed, y);
    rowsInChunk++;
    if (y < height - 1 && (rowsInChunk >= 8 || performance.now() - chunkStarted >= budget)) {
      await yieldControl();
      checkCancelled();
      chunkStarted = performance.now(); rowsInChunk = 0;
    }
  }
  checkCancelled();
  return texture;
}
export function seaThreshold(sea: number): number { return .23 + clamp(sea, 0, 100) / 100 * .57; }
export function oceanFraction(texture: PlanetTexture, sea: number): number {
  const threshold = seaThreshold(sea);
  let wet = 0, total = 0;
  for (let y = 0; y < texture.height; y++) {
    const weight = Math.cos((y / (texture.height - 1) - .5) * Math.PI);
    for (let x = 0; x < texture.width; x += 4) {
      total += weight;
      if (texture.terrain[y * texture.width + x] < threshold) wet += weight;
    }
  }
  return wet / total;
}
/** Fraction of the visible disk illuminated by a distant point source. */
export function illuminatedFraction(phaseDegrees: number): number { return (1 + Math.cos(clamp(phaseDegrees, 0, 180) * Math.PI / 180)) / 2; }

export interface SphereMap { size: number; x: Float32Array; y: Float32Array; z: Float32Array; longitude: Float32Array; latitude: Float32Array; inside: Uint32Array }
export function createSphereMap(size: number, tilt: number): SphereMap {
  const count = size * size, x = new Float32Array(count), y = new Float32Array(count), z = new Float32Array(count), longitude = new Float32Array(count), latitude = new Float32Array(count);
  const inside: number[] = [], cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const px = ((column + .5) / size * 2 - 1), py = 1 - (row + .5) / size * 2;
    const distance = px * px + py * py;
    if (distance > 1) continue;
    const i = row * size + column, pz = Math.sqrt(1 - distance), wy = py * cosTilt + pz * sinTilt, wz = pz * cosTilt - py * sinTilt;
    x[i] = px; y[i] = py; z[i] = pz;
    longitude[i] = Math.atan2(px, wz); latitude[i] = Math.asin(clamp(wy, -1, 1));
    inside.push(i);
  }
  return { size, x, y, z, longitude, latitude, inside: Uint32Array.from(inside) };
}

const PALETTES: Record<WorldKind, { deep: number[]; shore: number[]; low: number[]; high: number[]; ice: number[]; air: number[] }> = {
  oasis: { deep: [9, 46, 75], shore: [23, 110, 122], low: [75, 106, 66], high: [160, 145, 113], ice: [222, 238, 233], air: [56, 155, 225] },
  ember: { deep: [54, 19, 13], shore: [180, 69, 29], low: [135, 65, 39], high: [213, 150, 92], ice: [211, 165, 127], air: [229, 113, 55] },
  frost: { deep: [12, 58, 80], shore: [73, 164, 178], low: [153, 195, 197], high: [223, 232, 230], ice: [231, 246, 248], air: [89, 191, 220] },
};
export function atmosphereColor(kind: WorldKind): number[] { return PALETTES[kind].air; }

/** CPU rasterizer, no GPU, remote textures, or WebGL context required. */
export function renderSphere(target: Uint8ClampedArray, map: SphereMap, texture: PlanetTexture, settings: PlanetSettings, rotation: number, cloudRotation: number): void {
  target.fill(0);
  const { width, height, terrain, clouds, detail } = texture, { x, y, z, longitude, latitude } = map;
  const threshold = seaThreshold(settings.sea), palette = PALETTES[settings.kind];
  const phase = settings.phase * Math.PI / 180;
  const sx = -Math.sin(phase) * Math.cos(.275), sy = Math.sin(phase) * Math.sin(.275), sz = Math.cos(phase);
  const halfNorm = Math.sqrt(sx * sx + sy * sy + (sz + 1) ** 2) || 1;
  const hx = sx / halfNorm, hy = sy / halfNorm, hz = (sz + 1) / halfNorm;
  const warmth = settings.warmth / 100, star = [mix(.78, 1.18, warmth), mix(.95, .82, warmth), mix(1.16, .59, warmth)];
  const air = settings.atmosphere / 100, cloudThreshold = .72 - settings.clouds / 100 * .43;
  const relief = settings.relief / 100;
  for (let j = 0; j < map.inside.length; j++) {
    const i = map.inside[j], lat = latitude[i], lon = wrap(longitude[i] + rotation, TAU);
    const ux = lon / TAU * width, uy = (lat / Math.PI + .5) * (height - 1);
    const tx = Math.floor(ux) % width, ty = Math.min(height - 1, Math.floor(uy)), fx = ux - Math.floor(ux), fy = uy - ty;
    const ti = ty * width + tx, right = ty * width + (tx + 1) % width, nextRow = Math.min(height - 1, ty + 1) * width;
    const elevation = mix(mix(terrain[ti], terrain[right], fx), mix(terrain[nextRow + tx], terrain[nextRow + (tx + 1) % width], fx), fy), wet = elevation < threshold;
    const waterDepth = clamp((threshold - elevation) * 9), landHeight = clamp((elevation - threshold) / Math.max(.08, 1 - threshold) * 1.6);
    const light = x[i] * sx + y[i] * sy + z[i] * sz, day = smoothstep(-.045, .055, light);
    const diffuse = Math.max(0, light), limb = Math.pow(1 - z[i], 3.4);
    const neighboring = mix(mix(terrain[ty * width + (tx + 2) % width], terrain[ty * width + (tx + 3) % width], fx), mix(terrain[nextRow + (tx + 2) % width], terrain[nextRow + (tx + 3) % width], fx), fy);
    const bump = wet ? 1 : clamp(1 + (elevation - neighboring) * relief * 18, .56, 1.35);
    const grain = mix(mix(detail[ti], detail[right], fx), mix(detail[nextRow + tx], detail[nextRow + (tx + 1) % width], fx), fy);
    const terrainGrain = .91 + grain * .18;
    const iceLine = settings.kind === 'frost' ? .49 : .91;
    const ice = settings.kind === 'ember' ? 0 : smoothstep(iceLine, iceLine + .22, Math.abs(lat) + (elevation - .5) * .2);
    const cloudX = wrap(lon + cloudRotation, TAU) / TAU * width, cx = Math.floor(cloudX) % width, cfx = cloudX - Math.floor(cloudX);
    const cloudSample = mix(mix(clouds[ty * width + cx], clouds[ty * width + (cx + 1) % width], cfx), mix(clouds[nextRow + cx], clouds[nextRow + (cx + 1) % width], cfx), fy);
    let cloud = settings.clouds === 0 ? 0 : smoothstep(cloudThreshold, cloudThreshold + .16, cloudSample);
    if (settings.storm) {
      const stormLon = wrap(lon - .8 + Math.PI, TAU) - Math.PI, stormLat = lat - .12;
      const radius = Math.sqrt((stormLon * .78) ** 2 + stormLat ** 2);
      const angle = Math.atan2(stormLat, stormLon * .78);
      const spiral = .5 + .5 * Math.sin(angle * 3 + radius * 59);
      cloud = Math.max(cloud, smoothstep(.37, .07, radius) * smoothstep(.015, .055, radius) * (.5 + .5 * spiral));
    }
    const specular = wet ? Math.pow(Math.max(0, x[i] * hx + y[i] * hy + z[i] * hz), 80) * .72 * (1 - cloud) : 0;
    const lightStrength = .035 + diffuse * 1.1;
    const auroraBand = settings.aurora ? Math.exp(-Math.pow((Math.abs(lat) - 1.07 - Math.sin(lon * 9) * .026) / .045, 2)) : 0;
    const aurora = settings.aurora ? auroraBand * (1 - day * .92) * (.52 + Math.sin(lon * 39) * .22 + Math.sin(lon * 81) * .13) : 0;
    for (let channel = 0; channel < 3; channel++) {
      let base = wet ? mix(palette.shore[channel], palette.deep[channel], waterDepth) : mix(palette.low[channel], palette.high[channel], landHeight);
      base = mix(base, palette.ice[channel], ice) * terrainGrain;
      let value = base * lightStrength * bump * star[channel] * (1 - cloud * .25);
      value = mix(value, (193 + diffuse * 59) * (.07 + .93 * day) * star[channel], cloud * .9);
      value += specular * 220 * star[channel];
      value += palette.air[channel] * limb * air * (.08 + .75 * day);
      value += aurora * [42, 233, 165][channel];
      // Forward scattering at the sunset limb is an artistic approximation.
      value += Math.exp(-Math.abs(light) * 25) * limb * air * [79, 29, 8][channel];
      target[i * 4 + channel] = clamp(value, 0, 255);
    }
    target[i * 4 + 3] = Math.min(255, z[i] * map.size * 4);
  }
}
