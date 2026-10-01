import * as Astronomy from 'astronomy-engine';
import { dayBounds, DEFAULT_TIME_ZONE } from './time';

export type RiseSet = { rise: Date | null; set: Date | null };

export type PlanetRow = {
  name: string;
  body: Astronomy.Body;
  altitude: number;
  azimuth: number;
  magnitude: number;
};

const PLANETS: { name: string; body: Astronomy.Body }[] = [
  { name: '水星', body: Astronomy.Body.Mercury },
  { name: '金星', body: Astronomy.Body.Venus },
  { name: '火星', body: Astronomy.Body.Mars },
  { name: '木星', body: Astronomy.Body.Jupiter },
  { name: '土星', body: Astronomy.Body.Saturn },
];

function observer(lat: number, lon: number) {
  return new Astronomy.Observer(lat, lon, 0);
}

/** 月相：0 新月 → 1 满月（照明比例） */
export function moonIllumination(when: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, when).phase_fraction;
}

/** 升落属于观测点所选时区的日历日，含 23/25 小时夏令时日。 */
export function riseSet(body: Astronomy.Body, when: Date, lat: number, lon: number, zone = DEFAULT_TIME_ZONE): RiseSet {
  const obs = observer(lat, lon);
  const { start, end } = dayBounds(when, zone);
  const days = (end.getTime() - start.getTime()) / 86400000;
  const riseEv = Astronomy.SearchRiseSet(body, obs, +1, start, days);
  const setEv = Astronomy.SearchRiseSet(body, obs, -1, start, days);
  const inside = (d: Date | undefined) => d && d >= start && d < end ? d : null;
  return { rise: inside(riseEv?.date), set: inside(setEv?.date) };
}

export function observingStatus(altitude: number, sunAltitude: number): string {
  if (altitude <= 0) return '地平线下';
  if (sunAltitude > -6) return '地平线上 · 白昼/暮光，难以辨认';
  if (altitude < 10) return '低空 · 易受遮挡与大气影响';
  return '夜间地平线上 · 仍需晴空与无遮挡';
}

export function horizontal(
  body: Astronomy.Body,
  when: Date,
  lat: number,
  lon: number,
): { altitude: number; azimuth: number } {
  const eq = Astronomy.Equator(body, when, observer(lat, lon), true, true);
  const hor = Astronomy.Horizon(when, observer(lat, lon), eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

export function planetTable(when: Date, lat: number, lon: number): PlanetRow[] {
  return PLANETS.map((p) => {
    const h = horizontal(p.body, when, lat, lon);
    return { name: p.name, body: p.body, altitude: h.altitude, azimuth: h.azimuth, magnitude: Astronomy.Illumination(p.body, when).mag };
  });
}

export function sunMoonRiseSet(when: Date, lat: number, lon: number, zone = DEFAULT_TIME_ZONE) {
  return {
    sun: riseSet(Astronomy.Body.Sun, when, lat, lon, zone),
    moon: riseSet(Astronomy.Body.Moon, when, lat, lon, zone),
  };
}
