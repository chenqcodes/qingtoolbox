/** Dimensionless model: choose length and time units so gravitational parameter μ=1. */
export const MU = 1;
export type HohmannResult = { r1: number; r2: number; a: number; dv1: number; dv2: number; dvTotal: number; transferTime: number };
function validate(r1: number, r2: number, mu = MU) {
  if (![r1, r2, mu].every(v => Number.isFinite(v) && v > 0)) throw new RangeError('半径和引力参数必须为有限正数');
}
export function hohmann(r1: number, r2: number, mu = MU): HohmannResult {
  validate(r1, r2, mu);
  const a = (r1 + r2) / 2;
  const dv1 = Math.sqrt(mu / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1);
  const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
  return { r1, r2, a, dv1, dv2, dvTotal: Math.abs(dv1) + Math.abs(dv2), transferTime: Math.PI * Math.sqrt(a ** 3 / mu) };
}
/** t is elapsed time / half-period. Signed eccentricity makes either apsis the departure.
 * Solves E - e sin(E) = πt, starting at (+r1,0), reaching (-r2,0).
 * t>1 continues around the same ellipse (the no-second-burn experiment).
 */
export function transferState(r1: number, r2: number, t: number, mu = MU) {
  validate(r1, r2, mu);
  if (!Number.isFinite(t)) throw new RangeError('进度必须为有限数');
  const a = (r1 + r2) / 2;
  const e = (r2 - r1) / (r1 + r2);
  const b = Math.sqrt(r1 * r2);
  const M = Math.PI * Math.min(2, Math.max(0, t));
  // Monotonic bisection stays stable even at extreme radius ratios.
  let lo = 0, hi = 2 * Math.PI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (mid - e * Math.sin(mid) < M) lo = mid; else hi = mid;
  }
  const E = (lo + hi) / 2;
  const rate = Math.sqrt(mu / a ** 3) / (1 - e * Math.cos(E));
  return { x: a * (Math.cos(E) - e), y: b * Math.sin(E), vx: -a * Math.sin(E) * rate, vy: b * Math.cos(E) * rate };
}
export function transferPos(r1: number, r2: number, t: number) {
  const { x, y } = transferState(r1, r2, Math.min(1, Math.max(0, t)));
  return { x, y };
}
