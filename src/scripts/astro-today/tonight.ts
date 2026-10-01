import * as Astronomy from 'astronomy-engine';
import { horizontal } from './ephemeris';
import { civilTime, fromCivil } from './time';
export type NightSample = { time: Date; altitude: number; azimuth: number; sunAltitude: number };
export type NightWindow = { start: Date; end: Date; best: NightSample; recommendedStart: Date; recommendedEnd: Date };
export type NightPlan = { start: Date; end: Date; samples: NightSample[]; windows: NightWindow[]; hasDarkness: boolean };
export const NIGHT_TARGETS = [
  { body: Astronomy.Body.Moon, name: '月亮' }, { body: Astronomy.Body.Venus, name: '金星' },
  { body: Astronomy.Body.Jupiter, name: '木星' }, { body: Astronomy.Body.Mars, name: '火星' },
  { body: Astronomy.Body.Saturn, name: '土星' }, { body: Astronomy.Body.Mercury, name: '水星' },
];
/** The selected calendar date's evening: local noon through next local noon. */
export function tonightRange(when: Date, zone: string) {
  const date = civilTime(when, zone).slice(0, 10);
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const start = fromCivil(`${date}T12:00`, zone), end = fromCivil(`${next.toISOString().slice(0, 10)}T12:00`, zone);
  if (!start || !end) throw new Error('所选日期因时区变更不存在');
  return { start, end };
}
function sampleAt(body: Astronomy.Body, lat: number, lon: number, t: number): NightSample {
  return { time: new Date(t), ...horizontal(body, new Date(t), lat, lon), sunAltitude: horizontal(Astronomy.Body.Sun, new Date(t), lat, lon).altitude };
}
function observingWindow(start: number, end: number, at: (t: number) => NightSample): NightWindow {
  let best = at(start);
  for (let t = start; t <= end; t += 60000) { const sample = at(t); if (sample.altitude > best.altitude) best = sample; }
  const last = at(end); if (last.altitude > best.altitude) best = last;
  return { start: new Date(start), end: new Date(end), best, recommendedStart: new Date(Math.max(start, +best.time - 30 * 60000)), recommendedEnd: new Date(Math.min(end, +best.time + 30 * 60000)) };
}
/** Derive actionable windows from a cached whole-night plan without changing the chart.
 * Both live and manually selected timestamps are cutoffs, including dates in the past.
 */
export function remainingNightWindows(plan: NightPlan, body: Astronomy.Body, when: Date, lat: number, lon: number): NightWindow[] {
  const at = (t: number) => sampleAt(body, lat, lon, t);
  return plan.windows
    .filter(window => window.end > when)
    .map(window => observingWindow(Math.max(+window.start, +when), +window.end, at))
    .sort((a, b) => b.best.altitude - a.best.altitude);
}
export function buildNightPlan(body: Astronomy.Body, when: Date, lat: number, lon: number, zone: string): NightPlan {
  const { start, end } = tonightRange(when, zone);
  const at = (t: number) => sampleAt(body, lat, lon, t);
  const okay = (s: NightSample) => s.sunAltitude <= -6 && s.altitude >= 10;
  const boundary = (a: number, b: number, state: boolean) => {
    while (b - a > 1000) { const m = (a + b) / 2; if (okay(at(m)) === state) a = m; else b = m; }
    return (a + b) / 2;
  };
  const samples: NightSample[] = [];
  for (let t = +start; t < +end; t += 300000) samples.push(at(t));
  samples.push(at(+end));
  const windows: NightWindow[] = [];
  let since: number | null = okay(samples[0]) ? +start : null;
  const finish = (until: number) => {
    if (since === null) return;
    windows.push(observingWindow(since, until, at));
    since = null;
  };
  for (let i = 1; i < samples.length; i++) {
    const previous = okay(samples[i - 1]), current = okay(samples[i]);
    if (current !== previous) { const t = boundary(+samples[i - 1].time, +samples[i].time, previous); if (current) since = t; else finish(t); }
  }
  if (since !== null) finish(+end);
  return { start, end, samples, windows: windows.sort((a, b) => b.best.altitude - a.best.altitude), hasDarkness: samples.some(s => s.sunAltitude <= -6) };
}
