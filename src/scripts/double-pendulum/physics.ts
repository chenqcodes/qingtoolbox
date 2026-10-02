/** Angles from downward vertical, SI units. Massless rods, point masses, no friction.
 * Equations: https://www.myphysicslab.com/pendulum/double-pendulum-en.html */
export type State = [number, number, number, number];
export interface Parameters { l1: number; l2: number; m1: number; m2: number; g: number }
export const PARAMETERS: Parameters = { l1: 1, l2: 1, m1: 1, m2: 1, g: 9.81 };
export const STEP = 1 / 240;
export const HISTORY_LIMIT = 1801;
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const degrees = (angle: number) => ((angle * 180 / Math.PI + 180) % 360 + 360) % 360 - 180;
export function derivative(s: State, p = PARAMETERS): State {
  const [a, b, u, v] = s, delta = a - b;
  const aa = (p.m1 + p.m2) * p.l1 ** 2, bb = p.m2 * p.l1 * p.l2 * Math.cos(delta), cc = p.m2 * p.l2 ** 2;
  const r1 = -p.m2 * p.l1 * p.l2 * v * v * Math.sin(delta) - (p.m1 + p.m2) * p.g * p.l1 * Math.sin(a);
  const r2 = p.m2 * p.l1 * p.l2 * u * u * Math.sin(delta) - p.m2 * p.g * p.l2 * Math.sin(b);
  const det = aa * cc - bb * bb;
  return [u, v, (r1 * cc - r2 * bb) / det, (r2 * aa - r1 * bb) / det];
}
export function rk4(s: State, dt = STEP, p = PARAMETERS): State {
  const add = (k: State, scale: number) => s.map((x, i) => x + scale * k[i]) as State;
  const a = derivative(s, p), b = derivative(add(a, dt / 2), p), c = derivative(add(b, dt / 2), p), d = derivative(add(c, dt), p);
  return s.map((x, i) => x + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6) as State;
}
export function positions(s: State, p = PARAMETERS) {
  const x1 = p.l1 * Math.sin(s[0]), y1 = p.l1 * Math.cos(s[0]);
  return { x1, y1, x2: x1 + p.l2 * Math.sin(s[1]), y2: y1 + p.l2 * Math.cos(s[1]) };
}
export function energy(s: State, p = PARAMETERS) {
  const [a, b, u, v] = s;
  return 0.5 * (p.m1 + p.m2) * p.l1 ** 2 * u * u + 0.5 * p.m2 * p.l2 ** 2 * v * v + p.m2 * p.l1 * p.l2 * u * v * Math.cos(a - b) - (p.m1 + p.m2) * p.g * p.l1 * Math.cos(a) - p.m2 * p.g * p.l2 * Math.cos(b);
}
export function separation(a: State, b: State) { const p = positions(a), q = positions(b); return Math.hypot(p.x2 - q.x2, p.y2 - q.y2); }
export interface Frame { t: number; states: State[] }
/** Ring buffer keeps at most 30 simulated seconds, sampled at 60 Hz. */
export class Timeline {
  private data: (Frame | undefined)[] = new Array(HISTORY_LIMIT);
  private start = 0;
  length = 0;
  get(index: number): Frame { const f = this.data[(this.start + Math.max(0, Math.min(this.length - 1, index))) % HISTORY_LIMIT]; if (!f) throw new Error('Empty timeline'); return f; }
  push(frame: Frame) { if (this.length < HISTORY_LIMIT) this.data[(this.start + this.length++) % HISTORY_LIMIT] = frame; else { this.data[this.start] = frame; this.start = (this.start + 1) % HISTORY_LIMIT; } }
  truncate(index: number) { this.length = Math.min(this.length, index + 1); }
  clear() { this.start = 0; this.length = 0; this.data.fill(undefined); }
}
