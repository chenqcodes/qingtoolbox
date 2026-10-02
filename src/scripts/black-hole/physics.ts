/** Schwarzschild reference quantities, not a general-relativistic ray tracer. */
export const G = 6.67430e-11;
export const C = 299_792_458;
export const SOLAR_MASS_KG = 1.98847e30;
export const AU_KM = 149_597_870.7;
export const SHADOW_RADIUS_RS = 3 * Math.sqrt(3) / 2;
export const DEFAULTS = { massLog: Math.log10(4.3e6), distanceRs: 48, inclination: 78 };
export const PRESETS = {
  stellar: { massLog: 1, distanceRs: 48, inclination: 78 },
  sagittarius: { ...DEFAULTS },
  m87: { massLog: Math.log10(6.5e9), distanceRs: 62, inclination: 55 },
};
export type Preset = keyof typeof PRESETS;
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
export function schwarzschildRadiusKm(solarMasses: number): number {
  if (!Number.isFinite(solarMasses) || solarMasses <= 0) throw new RangeError('Mass must be positive and finite');
  return 2 * G * solarMasses * SOLAR_MASS_KG / (C * C * 1000);
}
export function referenceQuantities(massLog: number, distanceRs: number) {
  const mass = 10 ** clamp(massLog, 1, 10);
  const rs = schwarzschildRadiusKm(mass);
  const distance = clamp(distanceRs, 25, 110);
  return { mass, rs, distanceKm: rs * distance, shadowRadiusKm: rs * SHADOW_RADIUS_RS,
    // Angular diameter at a distant observer, small-angle reference approximation.
    shadowAngleDegrees: 2 * SHADOW_RADIUS_RS / distance * 180 / Math.PI };
}
/** Fixed angular camera: size changes with distance/Rs, not independently with mass. */
export function sceneScale(width: number, height: number, distanceRs: number): number {
  return Math.max(1, Math.min(width / 27, height / 17)) * 48 / clamp(distanceRs, 25, 110);
}
export function formatMass(value: number): string {
  if (value >= 1e8) return `${(value / 1e8).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 亿`;
  if (value >= 1e4) return `${(value / 1e4).toLocaleString('zh-CN', { maximumFractionDigits: 1 })} 万`;
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}
export function formatKm(value: number): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: value < 100 ? 2 : 0 })} km`;
}
/** Frame-rate independent interpolation that can be retargeted without a queued transition. */
export function approach(current: number, target: number, seconds: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) * 9));
}
