import * as Astronomy from 'astronomy-engine';
import { DEFAULT_LAT, DEFAULT_LON, formatAz, parseLatLon, requestGeo } from '../shared/geo';
import { moonIllumination, planetTable, sunMoonRiseSet, horizontal, observingStatus } from './ephemeris';
import { drawMoonHeroSync, moonPhaseInfo } from './moon-render';
import { civilTime, fromCivil, formatAt, validTimeZone, DEFAULT_TIME_ZONE } from './time';

const $ = (id: string) => document.getElementById(id)!;
export function bootAstroToday() {
  if (window.matchMedia('(max-width: 640px)').matches) document.querySelector('.lab-details')?.removeAttribute('open');
  const latInput = $('astro-lat') as HTMLInputElement;
  const lonInput = $('astro-lon') as HTMLInputElement;
  const zoneInput = $('astro-zone') as HTMLInputElement;
  const dateInput = $('astro-date') as HTMLInputElement;
  latInput.value = String(DEFAULT_LAT); lonInput.value = String(DEFAULT_LON);
  zoneInput.value = DEFAULT_TIME_ZONE;
  let live = true;
  function refresh() {
    const p = latInput.value.trim() && lonInput.value.trim() ? parseLatLon(latInput.value, lonInput.value) : null;
    const zone = zoneInput.value.trim();
    if (!p || !validTimeZone(zone)) { $('astro-geo-note').textContent = '请输入有效经纬度与 IANA 时区（例如 Asia/Shanghai）'; return; }
    const when = live ? new Date() : fromCivil(dateInput.value, zone);
    if (!when) { $('astro-geo-note').textContent = '日期时间无效，或该时刻因夏令时跳时而不存在'; return; }
    if (live) dateInput.value = civilTime(when, zone).slice(0, 16);
    try {
      const illum = moonIllumination(when); const phase = moonPhaseInfo(when);
      const rs = sunMoonRiseSet(when, p.lat, p.lon, zone); const planets = planetTable(when, p.lat, p.lon);
      const sunAlt = horizontal(Astronomy.Body.Sun, when, p.lat, p.lon).altitude;
      $('astro-now').textContent = `${formatAt(when, zone)} · ${zone}${live ? ' · 实时' : ' · 所选时刻'}`;
      $('astro-illum').textContent = `${(illum * 100).toFixed(1)}%`; $('astro-phase-name').textContent = `${phase.emoji} ${phase.name}`;
      for (const [id, date] of [['sun-rise', rs.sun.rise], ['sun-set', rs.sun.set], ['moon-rise', rs.moon.rise], ['moon-set', rs.moon.set]] as const)
        $(`astro-${id}`).textContent = date ? formatAt(date, zone) : '该日无此事件';
      $('astro-pos').textContent = `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)} · ${zone}`;
      $('astro-geo-note').textContent = `日历日 ${civilTime(when, zone).slice(0, 10)}；所有时刻按 ${zone}。换城市请同时检查时区。`;
      $('astro-card-phase').textContent = `${phase.name} · 亮面约 ${(illum * 100).toFixed(0)}%`;
      $('astro-card-sunset').textContent = rs.sun.set ? formatAt(rs.sun.set, zone, true) : '该日无日落事件';
      const up = planets.filter(p => p.altitude > 0).sort((a, b) => a.magnitude - b.magnitude);
      $('astro-card-planet').textContent = up.length ? `${up[0].name} · ${up[0].magnitude.toFixed(1)} 等 · ${formatAz(up[0].azimuth)}` : '五颗行星均在地平线下';
      $('astro-light-note').textContent = sunAlt > -6 ? '当前白昼或暮光：地平线上不等于肉眼可见，请勿用光学仪器搜寻太阳附近目标' : '当前天空较暗；亮度未计大气消光，云、光污染和遮挡仍影响观测';
      drawMoonHeroSync($('astro-moon') as HTMLCanvasElement, when, illum * 100, phase.name);
      $('astro-planets').innerHTML = planets.map(p => `<tr><td>${p.name}</td><td>${p.magnitude.toFixed(1)}</td><td>${p.altitude.toFixed(1)}°</td><td>${formatAz(p.azimuth)}</td><td>${observingStatus(p.altitude, sunAlt)}</td></tr>`).join('');
    } catch (error) { $('astro-geo-note').textContent = error instanceof Error ? error.message : '日期计算失败，请重新选择'; }
  }
  $('astro-apply').addEventListener('click', refresh);
  dateInput.addEventListener('change', () => { live = false; refresh(); });
  $('astro-live').addEventListener('click', () => { live = true; refresh(); });
  $('astro-gps').addEventListener('click', () => {
    $('astro-geo-note').textContent = '定位中…';
    requestGeo(pos => { latInput.value = pos.lat.toFixed(4); lonInput.value = pos.lon.toFixed(4); refresh(); $('astro-geo-note').textContent += pos.source === 'gps' ? ' GPS 已更新坐标，请确认时区。' : ' 定位未成功，使用北京默认坐标。'; });
  });
  window.addEventListener('resize', refresh);
  refresh(); setInterval(() => { if (live) refresh(); }, 60000);
}
