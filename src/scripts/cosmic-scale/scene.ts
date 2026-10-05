import { clamp, projectedSize, STOPS, stopExponent, type ScaleStop } from './model';

/** A comparison lane, not a spatial map. The intervals are in metres and never
 * overlap: the layout changes position, never an object's physical scale. */
export const heightFactor = (stop: ScaleStop): number => ['dna', 'bacterium'].includes(stop.kind) ? .4 : ['moon-distance', 'stellar'].includes(stop.kind) ? .14 : stop.kind === 'comet-orbit' ? Math.sqrt(1 - .85 ** 2) : ['arm', 'nebula'].includes(stop.kind) ? .7 : 1;
export const widthFactor = (stop: ScaleStop): number => stop.kind === 'person' ? .34 : stop.kind === 'tree' ? .72 : 1;
const CENTRES: readonly number[] = STOPS.reduce<number[]>((centres, stop, index) => {
  centres.push(index ? centres[index - 1] + .6 * (STOPS[index - 1].size * widthFactor(STOPS[index - 1]) + stop.size * widthFactor(stop)) : 0);
  return centres;
}, []);
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
  // Linear camera pan in world metres + logarithmic zoom. Both are continuous
  // even when the nearest information label changes to the next object.
  const camera = CENTRES[lowerIndex] + (CENTRES[upperIndex] - CENTRES[lowerIndex]) * progress;
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
