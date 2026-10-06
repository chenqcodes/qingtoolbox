import { clamp, projectedSize, STOPS, stopExponent, type ScaleStop } from './model';

/** A comparison lane, not a spatial map. The intervals are in metres and never
 * overlap: the layout changes position, never an object's physical scale. */
export const heightFactor = (stop: ScaleStop): number => ['dna', 'bacterium'].includes(stop.kind) ? .4 : ['moon-distance', 'stellar', 'galaxy-distance'].includes(stop.kind) ? .14 : stop.kind === 'comet-orbit' ? Math.sqrt(1 - .85 ** 2) : ['arm', 'nebula', 'wall', 'supercluster'].includes(stop.kind) ? .7 : 1;
export const widthFactor = (stop: ScaleStop): number => stop.kind === 'person' ? .34 : stop.kind === 'tree' ? .72 : 1;
const CENTRES: readonly number[] = STOPS.reduce<number[]>((centres, stop, index) => {
  centres.push(index ? centres[index - 1] + .6 * (STOPS[index - 1].size * widthFactor(STOPS[index - 1]) + stop.size * widthFactor(stop)) : 0);
  return centres;
}, []);
// Match camera velocity at every anchor. Keep the middle of each journey linear
// so long transitions do not stall, and blend only the first/last 18%.
const EXPONENTS = STOPS.map(stopExponent);
const SLOPES = CENTRES.slice(1).map((centre, index) => (centre - CENTRES[index]) / (EXPONENTS[index + 1] - EXPONENTS[index]));
const TANGENTS = CENTRES.map((_, index) => index === 0 ? SLOPES[0] : index === CENTRES.length - 1 ? SLOPES.at(-1)! : 2 / (1 / SLOPES[index - 1] + 1 / SLOPES[index]));
const hermite = (t: number, a: number, b: number, da: number, db: number) => (2 * t ** 3 - 3 * t ** 2 + 1) * a + (t ** 3 - 2 * t ** 2 + t) * da + (-2 * t ** 3 + 3 * t ** 2) * b + (t ** 3 - t ** 2) * db;
function cameraProgress(t: number, lower: number, upper: number): number {
  if (lower === upper) return 0;
  const buffer = .18;
  const ratio = (EXPONENTS[upper] - EXPONENTS[lower]) / (CENTRES[upper] - CENTRES[lower]);
  if (t < buffer) return hermite(t / buffer, 0, buffer, TANGENTS[lower] * ratio * buffer, buffer);
  if (t > 1 - buffer) return hermite((t - 1 + buffer) / buffer, 1 - buffer, 1, buffer, TANGENTS[upper] * ratio * buffer);
  return t;
}
export interface SceneObject {
  stop: ScaleStop; index: number; x: number; y: number; pixels: number;
  left: number; right: number; visibleSpan: number; visibleExtent: number; alpha: number;
}
export interface Scene {
  exponent: number; objects: SceneObject[]; lower: ScaleStop; upper: ScaleStop; progress: number;
}
export function sceneAt(value: number, width: number, height: number): Scene {
  const exponent = clamp(value);
  let lowerIndex = STOPS.findIndex(stop => stopExponent(stop) > exponent) - 1;
  if (lowerIndex < 0) lowerIndex = exponent >= stopExponent(STOPS.at(-1)!) ? STOPS.length - 1 : 0;
  const upperIndex = Math.min(STOPS.length - 1, lowerIndex + 1);
  const lower = STOPS[lowerIndex], upper = STOPS[upperIndex];
  const progress = lowerIndex === upperIndex ? 0 : Math.max(0, Math.min(1, (exponent - stopExponent(lower)) / (stopExponent(upper) - stopExponent(lower))));
  // C1 camera pan in world metres + logarithmic zoom. Both position and
  // velocity remain continuous when the next interval begins.
  const camera = CENTRES[lowerIndex] + (CENTRES[upperIndex] - CENTRES[lowerIndex]) * cameraProgress(progress, lowerIndex, upperIndex);
  const objects: SceneObject[] = [];
  for (let index = Math.max(0, lowerIndex - 3); index <= Math.min(STOPS.length - 1, upperIndex + 1); index++) {
    const stop = STOPS[index];
    const pixels = projectedSize(stop.size, exponent, width);
    const x = width * .5 + projectedSize(CENTRES[index] - camera, exponent, width);
    const halfWidth = pixels * widthFactor(stop) / 2;
    const left = x - halfWidth, right = x + halfWidth;
    const visibleSpan = Math.max(0, Math.min(width, right) - Math.max(0, left));
    if (pixels < .7 || visibleSpan <= 0 || pixels > width * 24) continue;
    const visibleHeight = Math.max(0, Math.min(height - 75, height * .52 + pixels * heightFactor(stop) / 2) - Math.max(105, height * .52 - pixels * heightFactor(stop) / 2));
    const visibleExtent = visibleSpan >= width * .08 ? Math.max(visibleSpan, visibleHeight) : visibleSpan;
    objects.push({ stop, index, x, y: height * .52, pixels, left, right, visibleSpan, visibleExtent, alpha: Math.min(1, pixels / 5) });
  }
  return { exponent, objects, lower, upper, progress };
}
export function measureAxis(stop: ScaleStop): 'vertical' | 'horizontal' {
  return stop.kind === 'person' || stop.kind === 'tree' ? 'vertical' : 'horizontal';
}
export function labelAnchor(object: SceneObject, width: number, height: number) {
  const low = width < 500 ? 60 : 100;
  return {
    x: Math.max(low, Math.min(width - low, object.x)),
    y: Math.min(height - 101, object.y + Math.min(object.pixels * .57, height * .25) + 15),
  };
}

/** Name the measured axis. A 10 nm DNA segment is not a 10 nm helix diameter. */
export function measurementLabel(stop: ScaleStop): string {
  const names: Partial<Record<ScaleStop['kind'], string>> = {
    dna: '片段长', person: '身高', tree: '树高', cup: '总宽', seed: '长', sand: '宽',
    bacterium: '菌体长', block: '边长', park: '边长', city: '区域直径', region: '切片宽',
    'moon-distance': '中心距离', stellar: '距离', orbit: '轨道直径', solar: '轨道直径',
    'comet-orbit': '长轴', heliosphere: '模型跨度', oort: '模型直径', nebula: '切片宽',
    bubble: '跨度', arm: '切片宽', galaxy: '星盘直径', 'galaxy-distance': '距离',
    'galaxy-group': '区域直径', 'galaxy-cluster': '跨度', supercluster: '区域直径',
    laniakea: '跨度', wall: '长', 'cosmic-web': '示例宽', observable: '现今直径',
  };
  return names[stop.kind] ?? '直径';
}

export const zoomOverlay = (width: number, height: number) => ({ left: width - 82, right: width, top: height - 176, bottom: height - 62 });
export interface SceneLabel { object: SceneObject; x: number; y: number; width: number }
export function sceneLabels(scene: Scene, width: number, height: number, focused: ScaleStop): SceneLabel[] {
  const candidates = scene.objects.filter(o => o.pixels >= width * .06 && o.pixels <= width * 2.5 && o.visibleSpan > width * .07)
    .sort((a, b) => Number(b.stop.id === focused.id) - Number(a.stop.id === focused.id) || b.pixels - a.pixels);
  const labels: SceneLabel[] = [];
  const overlay = zoomOverlay(width, height);
  for (const object of candidates) {
    const below = labelAnchor(object, width, height);
    const above = { x: below.x, y: Math.max(145, object.y - Math.min(object.pixels * heightFactor(object.stop) * .55, height * .24) - 36) };
    const labelWidth = width < 500 ? 112 : 170;
    const anchor = [below, above].find(point => (point.x + labelWidth / 2 < overlay.left || point.y + 22 < overlay.top || point.y - 15 > overlay.bottom) && labels.every(label => Math.abs(label.x - point.x) > (label.width + labelWidth) / 2 + 6 || Math.abs(label.y - point.y) > 43));
    if (anchor) labels.push({ object, ...anchor, width: labelWidth });
    if (labels.length === 3) break;
  }
  return labels;
}
