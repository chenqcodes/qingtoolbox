import { twoline2satrec, propagate, gstime, eciToEcf, eciToGeodetic, ecfToLookAngles, degreesLat, degreesLong } from 'satellite.js';
import * as Astronomy from 'astronomy-engine';
import snapshot from '../../../public/data/iss-tle.json';
import { validateTle, tleEpoch, type TleData, MAX_TLE_AGE_DAYS } from './tle';
import { horizontal } from '../astro-today/ephemeris';

export type Satrec = ReturnType<typeof twoline2satrec>;
export type LookSample = { time: Date; elevation: number; azimuth: number; rangeSat: number; likelyVisible?: boolean };
export type VisibleWindow = { start: Date; end: Date; startAz: number; endAz: number };
export type Pass = { start: Date; max: Date; end: Date; maxEl: number; azAtMax: number; startAz: number; endAz: number; visible: VisibleWindow[] };
export const bundledTle: TleData = validateTle(snapshot);
export function loadSatrec(data: TleData = bundledTle) { const t = validateTle(data); return twoline2satrec(t.line1, t.line2); }
export function tleMeta(data: TleData = bundledTle) { return { ...data, epoch: tleEpoch(data.line1) }; }

export function lookAt(satrec: Satrec, when: Date, latDeg: number, lonDeg: number): LookSample | null {
  const pv = propagate(satrec, when); if (!pv?.position || !pv.velocity) return null;
  const gmst = gstime(when);
  const look = ecfToLookAngles({ longitude: lonDeg * Math.PI / 180, latitude: latDeg * Math.PI / 180, height: 0 }, eciToEcf(pv.position, gmst));
  if (![look.elevation, look.azimuth, look.rangeSat].every(Number.isFinite)) return null;
  return { time: when, elevation: look.elevation * 180 / Math.PI, azimuth: look.azimuth * 180 / Math.PI, rangeSat: look.rangeSat };
}
export function geodeticAt(satrec: Satrec, when: Date) {
  const pv = propagate(satrec, when); if (!pv?.position) return null;
  const geo = eciToGeodetic(pv.position, gstime(when));
  return { lat: degreesLat(geo.latitude), lon: degreesLong(geo.longitude), heightKm: geo.height };
}
/** Conservative disk occultation model: partial shadow is not counted as fully sunlit. */
export function satelliteSunlit(position: { x: number; y: number; z: number }, sunKm: { x: number; y: number; z: number }): boolean {
  const r = Math.hypot(position.x, position.y, position.z);
  if (r <= 6378.137) return false;
  const toSun = { x: sunKm.x - position.x, y: sunKm.y - position.y, z: sunKm.z - position.z };
  const d = Math.hypot(toSun.x, toSun.y, toSun.z);
  const separation = Math.acos(Math.max(-1, Math.min(1, -(position.x * toSun.x + position.y * toSun.y + position.z * toSun.z) / (r * d))));
  return separation > Math.asin(6378.137 / r) + Math.asin(695700 / d);
}
export function visibilityAt(satrec: Satrec, when: Date, lat: number, lon: number) {
  const look = lookAt(satrec, when, lat, lon);
  const sunAltitude = horizontal(Astronomy.Body.Sun, when, lat, lon).altitude;
  const pv = propagate(satrec, when);
  // Sun EQD is a sufficiently close approximation to TEME for this twilight/occultation filter.
  const sun = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(when), Astronomy.GeoVector(Astronomy.Body.Sun, when, true));
  const auKm = 149597870.7;
  const sunlit = !!pv?.position && satelliteSunlit(pv.position, { x: sun.x * auKm, y: sun.y * auKm, z: sun.z * auKm });
  return { sunAltitude, sunlit, likelyVisible: !!look && look.elevation >= 10 && sunAltitude <= -6 && sunlit };
}
/** Bisection of a bracketed event to better than half a second. */
export function refineBoundary(a: number, b: number, predicate: (ms: number) => boolean): number {
  const state = predicate(a);
  while (b - a > 500) { const m = (a + b) / 2; if (predicate(m) === state) a = m; else b = m; }
  return (a + b) / 2;
}
export function visibleWindows(satrec: Satrec, lat: number, lon: number, start: Date, end: Date): VisibleWindow[] {
  const result: VisibleWindow[] = [];
  const test = (t: number) => visibilityAt(satrec, new Date(t), lat, lon).likelyVisible;
  let prev = start.getTime(), state = test(prev), since = state ? prev : null;
  for (let t = Math.min(prev + 10000, end.getTime()); t <= end.getTime();) {
    const current = test(t);
    if (current !== state) {
      const boundary = refineBoundary(prev, t, test);
      if (current) since = boundary;
      else if (since !== null) { result.push({ start: new Date(since), end: new Date(boundary), startAz: lookAt(satrec, new Date(since), lat, lon)!.azimuth, endAz: lookAt(satrec, new Date(boundary), lat, lon)!.azimuth }); since = null; }
    }
    prev = t; state = current;
    if (t === end.getTime()) break;
    t = Math.min(t + 10000, end.getTime());
  }
  if (since !== null) result.push({ start: new Date(since), end, startAz: lookAt(satrec, new Date(since), lat, lon)!.azimuth, endAz: lookAt(satrec, end, lat, lon)!.azimuth });
  return result;
}
/** Geometric horizon crossings, not naked-eye sightings. No stale ephemeris extrapolation. */
export function findPasses(satrec: Satrec, lat: number, lon: number, from = new Date(), hours = 48, minElDeg = 10, stepSec = 30): Pass[] {
  if (!(hours > 0 && hours <= 168 && stepSec >= 1 && stepSec <= 60 && minElDeg >= 0 && minElDeg <= 90)) throw new Error('过境搜索参数无效');
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
  if (from.getTime() - epochMs > MAX_TLE_AGE_DAYS * 86400000 || from.getTime() < epochMs - 86400000) throw new Error('轨道历元超出可靠预测范围，请更新数据');
  const until = Math.min(from.getTime() + hours * 3600000, epochMs + MAX_TLE_AGE_DAYS * 86400000);
  const elevation = (t: number) => lookAt(satrec, new Date(t), lat, lon)?.elevation ?? -90;
  const above = (t: number) => elevation(t) >= 0;
  const passes: Pass[] = []; const step = stepSec * 1000;
  let previous = from.getTime() - 20 * 60000, prevAbove = above(previous), start: number | null = null;
  for (let t = previous + step; t <= until + 20 * 60000; t += step) {
    const current = above(t);
    if (current && !prevAbove) start = refineBoundary(previous, t, above);
    if (!current && prevAbove && start !== null) {
      const end = refineBoundary(previous, t, above);
      if (end >= from.getTime() && start < until && end <= epochMs + MAX_TLE_AGE_DAYS * 86400000) {
        let a = start, b = end;
        while (b - a > 500) { const l = a + (b - a) / 3, r = b - (b - a) / 3; if (elevation(l) < elevation(r)) a = l; else b = r; }
        const max = new Date((a + b) / 2), peak = lookAt(satrec, max, lat, lon)!;
        if (peak.elevation >= minElDeg) passes.push({ start: new Date(start), max, end: new Date(end), maxEl: peak.elevation, azAtMax: peak.azimuth, startAz: lookAt(satrec, new Date(start), lat, lon)!.azimuth, endAz: lookAt(satrec, new Date(end), lat, lon)!.azimuth, visible: visibleWindows(satrec, lat, lon, new Date(start), new Date(end)) });
      }
      start = null;
    }
    previous = t; prevAbove = current;
  }
  return passes;
}
