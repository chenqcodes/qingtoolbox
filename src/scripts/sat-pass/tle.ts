import { twoline2satrec, propagate } from 'satellite.js';
export const TLE_SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
export const MAX_TLE_AGE_DAYS = 7;
export type TleData = { name: string; norad: number; fetchedAt: string | null; source: string; line1: string; line2: string };
export function tleEpoch(line1: string): Date {
  const yy = Number(line1.slice(18, 20)); const day = Number(line1.slice(20, 32));
  const year = yy >= 57 ? 1900 + yy : 2000 + yy;
  const maxDay = new Date(Date.UTC(year, 2, 0)).getUTCDate() === 29 ? 366 : 365;
  if (!/^\d{2}\d{3}\.\d{8}$/.test(line1.slice(18, 32)) || day < 1 || day >= maxDay + 1) throw new Error('TLE 历元无效');
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86400000);
}
export function tleChecksum(line: string): boolean {
  return line.length === 69 && /^\d$/.test(line[68]) && [...line.slice(0, 68)].reduce((n, c) => n + (c === '-' ? 1 : /\d/.test(c) ? Number(c) : 0), 0) % 10 === Number(line[68]);
}
export function validateTle(value: unknown): TleData {
  const t = value as Partial<TleData> | null;
  if (!t || typeof t.line1 !== 'string' || typeof t.line2 !== 'string' || !t.line1.startsWith('1 25544') || !t.line2.startsWith('2 25544') || !tleChecksum(t.line1) || !tleChecksum(t.line2)) throw new Error('ISS TLE 格式、编号或校验和无效');
  const epoch = tleEpoch(t.line1);
  const numeric = (field: string) => /^ *[+-]?\d+(?:\.\d+)? *$/.test(field) ? Number(field) : NaN;
  const inclination = numeric(t.line2.slice(8, 16));
  const angles = [t.line2.slice(17, 25), t.line2.slice(34, 42), t.line2.slice(43, 51)].map(numeric);
  const eccentricity = t.line2.slice(26, 33);
  const motion = numeric(t.line2.slice(52, 63));
  if (!(inclination >= 0 && inclination <= 180) || !angles.every(a => a >= 0 && a < 360) || !/^\d{7}$/.test(eccentricity) || !(motion > 0 && motion <= 18) || !/^ *[+-]?\.\d+$/.test(t.line1.slice(33, 43)) || !/^[ +-]\d{5}[+-]\d$/.test(t.line1.slice(44, 52)) || !/^[ +-]\d{5}[+-]\d$/.test(t.line1.slice(53, 61))) throw new Error('TLE 轨道参数无效');
  const sat = twoline2satrec(t.line1, t.line2);
  const state = propagate(sat, epoch);
  if (sat.error || !Number.isFinite(sat.no) || !Number.isFinite(sat.ecco) || !state?.position || !state.velocity || !Object.values(state.position).every(Number.isFinite) || !Object.values(state.velocity).every(Number.isFinite) || Math.hypot(state.position.x, state.position.y, state.position.z) <= 6378.137) throw new Error('TLE 无法生成有效轨道');
  return { name: 'ISS (ZARYA)', norad: 25544, line1: t.line1, line2: t.line2, source: TLE_SOURCE, fetchedAt: typeof t.fetchedAt === 'string' && Number.isFinite(Date.parse(t.fetchedAt)) ? t.fetchedAt : null };
}
export function tleFreshness(data: TleData, now = new Date()) {
  const epoch = tleEpoch(data.line1); const ageDays = (now.getTime() - epoch.getTime()) / 86400000;
  const usable = ageDays >= -1 && ageDays <= MAX_TLE_AGE_DAYS;
  return { epoch, ageDays, usable, status: !usable ? 'stale' : ageDays > 3 ? 'aging' : 'fresh', expires: new Date(epoch.getTime() + MAX_TLE_AGE_DAYS * 86400000) };
}
export function parseTleText(text: string, fetchedAt = new Date()): TleData {
  const lines = text.trim().split(/\r?\n/).map(l => l.trimEnd());
  const line1 = lines.find(l => l.startsWith('1 ')); const line2 = lines.find(l => l.startsWith('2 '));
  return validateTle({ line1, line2, fetchedAt: fetchedAt.toISOString() });
}
