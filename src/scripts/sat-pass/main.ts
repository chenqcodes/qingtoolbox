import { DEFAULT_LAT, DEFAULT_LON, formatAz, parseLatLon, requestGeo } from '../shared/geo';
import { loadSatrec, bundledTle, findPasses, type Pass } from './propagate';
import { samplePassTrack, startSkyAnim, type SkyVizState } from './sky-viz';
import { tleFreshness, validateTle } from './tle';
import { DEFAULT_TIME_ZONE, formatAt, validTimeZone } from '../astro-today/time';
import { countdownText } from './countdown';
const $ = (id: string) => document.getElementById(id)!;
export function bootSatPass() {
  if (window.matchMedia('(max-width: 640px)').matches) document.querySelector('.lab-details')?.removeAttribute('open');
  let data = bundledTle, satrec = loadSatrec(data), lat = DEFAULT_LAT, lon = DEFAULT_LON, zone = DEFAULT_TIME_ZONE;
  let skyState: SkyVizState = { passes: [], track: [], passIndex: 0 };
  let allPasses: Pass[] = [];
  const latInput = $('sat-lat') as HTMLInputElement, lonInput = $('sat-lon') as HTMLInputElement;
  const zoneInput = $('sat-zone') as HTMLInputElement, filter = $('sat-filter') as HTMLSelectElement;
  latInput.value = String(lat); lonInput.value = String(lon); zoneInput.value = zone;
  const canvas = $('sat-canvas') as HTMLCanvasElement;
  startSkyAnim(canvas, () => skyState);
  const fmt = (d: Date) => formatAt(d, zone);
  const clear = (message: string) => {
    skyState = { passes: [], track: [], passIndex: 0, emptyMessage: message, timeZone: zone, paused: skyState.paused };
    $('sat-rows').replaceChildren(); $('sat-pass-cards').replaceChildren(); $('sat-countdown').textContent = '暂无待观测窗口'; $('sat-next').textContent = message;
    $('sat-card-when').textContent = message; $('sat-card-el').textContent = '—'; $('sat-card-az').textContent = '—';
    canvas.dispatchEvent(new Event('skychange'));
  };
  const selectPass = (index: number) => {
    const pass = skyState.passes[index]; if (!pass) return;
    skyState = { ...skyState, passIndex: index, track: samplePassTrack(satrec, lat, lon, pass, 6) };
    document.querySelectorAll<HTMLButtonElement>('[data-pass]').forEach(b => { b.setAttribute('aria-pressed', String(Number(b.dataset.pass) === index)); b.closest('tr')?.classList.toggle('sat-row-active', Number(b.dataset.pass) === index); });
    $('sat-status').textContent = `${allPasses.length} 次几何过境；${allPasses.filter(p => p.visible.length).length} 次含可能可见窗口 · 当前演示第 ${index + 1} 次（非实时）`;
    canvas.dispatchEvent(new Event('skychange'));
  };
  function renderPasses() {
    if (!tleFreshness(data).usable) { run(); return; }
    const selectedStart = skyState.passes[skyState.passIndex]?.start.getTime();
    const paused = skyState.paused;
    const passes = filter.value === 'visible' ? allPasses.filter(p => p.visible.some(v => v.end > new Date())) : allPasses;
    skyState = { passes, track: [], passIndex: 0, timeZone: zone, paused };
    if (!passes.length) {
      clear(filter.value === 'visible' ? '暂无满足条件的可见窗口' : '暂无最高仰角 ≥10° 的过境');
      $('sat-status').textContent = `预测范围内共有 ${allPasses.length} 次几何过境；可切换查看。云和遮挡未纳入计算。`;
      return;
    }
    const next = passes[0], window = next.visible.find(v => v.end > new Date());
    $('sat-card-when').textContent = fmt(filter.value === 'visible' && window ? window.start : next.start);
    $('sat-card-el').textContent = `${next.maxEl.toFixed(0)}° · ${next.maxEl >= 60 ? '接近头顶' : next.maxEl >= 30 ? '中高空' : '低空，注意遮挡'}`;
    $('sat-card-az').textContent = formatAz(filter.value === 'visible' && window ? window.startAz : next.startAz);
    $('sat-next').textContent = window ? `可能可见 ${fmt(window.start)}–${fmt(window.end)} · ${zone}` : `仅几何过境，未满足可见条件 · ${zone}`;
    $('sat-rows').innerHTML = passes.map((p, i) => `<tr><td><button class="lab-btn secondary" type="button" data-pass="${i}" aria-pressed="false" aria-label="演示第 ${i + 1} 次过境">${fmt(p.start)}</button></td><td>${fmt(p.max)}</td><td>${fmt(p.end)}</td><td>${p.maxEl.toFixed(1)}°<br/>${formatAz(p.azAtMax)}</td><td>${p.visible.length ? p.visible.map(v => `${fmt(v.start)}–${fmt(v.end)}`).join('<br/>') : '仅几何，未满足条件'}</td></tr>`).join('');
    $('sat-rows').querySelectorAll<HTMLButtonElement>('[data-pass]').forEach(b => b.addEventListener('click', () => selectPass(Number(b.dataset.pass))));
    $('sat-pass-cards').innerHTML = passes.map((p, i) => {
      const visible = p.visible.find(v => v.end > new Date());
      const start = filter.value === 'visible' && visible ? visible.start : p.start;
      const end = filter.value === 'visible' && visible ? visible.end : p.end;
      const startAz = filter.value === 'visible' && visible ? visible.startAz : p.startAz;
      const endAz = filter.value === 'visible' && visible ? visible.endAz : p.endAz;
      const minutes = Math.round((+end - +start) / 6000) / 10;
      return `<article class="sat-pass-card"><p class="sat-pass-kind">${visible ? filter.value === 'visible' ? '可能肉眼可见 · 需晴空' : '几何全程 · 部分时段可能可见' : '仅几何过境 · 不建议据此等待'}</p><h3>${fmt(start)}–${formatAt(end, zone, true)}</h3><p>持续约 ${minutes.toFixed(1)} 分钟 · 整次过境最高 ${p.maxEl.toFixed(0)}°</p><p>开始朝 ${formatAz(startAz)} → 结束朝 ${formatAz(endAz)}</p><p class="lab-note">几何最高 ${formatAt(p.max, zone, true)} · ${formatAz(p.azAtMax)}。${visible ? `可见筛选 ${fmt(visible.start)}–${formatAt(visible.end, zone, true)}；提前 2–3 分钟找到开阔位置` : '未同时满足暗天空与空间站日照条件'}</p><button type="button" class="lab-btn secondary" data-pass="${i}" aria-pressed="false">查看第 ${i + 1} 次轨迹</button></article>`;
    }).join('');
    $('sat-pass-cards').querySelectorAll<HTMLButtonElement>('[data-pass]').forEach(b => b.addEventListener('click', () => selectPass(Number(b.dataset.pass))));
    const selectedIndex = selectedStart ? passes.findIndex(p => Math.abs(+p.start - selectedStart) < 2000) : 0;
    selectPass(Math.max(0, selectedIndex));
    $('sat-countdown').textContent = countdownText(passes[0], new Date(), filter.value === 'visible');
  }
  function run() {
    // Expiry is independent of an unfinished/invalid observer edit.
    const now = new Date(), f = tleFreshness(data, now);
    if (!f.usable) {
      $('sat-updated').textContent = `${f.epoch.toISOString()} · 年龄 ${f.ageDays.toFixed(1)} 天`;
      const badge = document.getElementById('sat-freshness');
      if (badge) { badge.textContent = `轨道数据不可用 · 年龄 ${f.ageDays.toFixed(1)} 天`; badge.classList.add('sat-warning'); }
      $('sat-range').textContent = '—'; allPasses = []; clear('轨道数据过期，预测已暂停');
      $('sat-status').textContent = 'TLE 历元超过 7 天或异常地位于未来。请刷新数据；不会使用陈旧数据生成抬头时间。';
      return;
    }
    const p = latInput.value.trim() && lonInput.value.trim() ? parseLatLon(latInput.value, lonInput.value) : null;
    if (!p || !validTimeZone(zoneInput.value.trim())) { $('sat-geo-note').textContent = '请输入有效经纬度与 IANA 时区'; return; }
    lat = p.lat; lon = p.lon; zone = zoneInput.value.trim();
    $('sat-updated').textContent = `${f.epoch.toISOString().replace('T', ' ').slice(0, 19)} UTC · 年龄 ${f.ageDays.toFixed(1)} 天${f.status === 'aging' ? ' · 偏旧，建议刷新' : ''}`;
    $('sat-freshness').textContent = `${f.usable ? f.status === 'aging' ? '轨道数据偏旧' : '轨道数据可用' : '轨道数据不可用'} · 历元 ${formatAt(f.epoch, zone)} · 年龄 ${f.ageDays.toFixed(1)} 天`;
    $('sat-freshness').classList.toggle('sat-warning', f.status !== 'fresh');
    $('sat-fetched').textContent = data.fetchedAt ? new Date(data.fetchedAt).toISOString() : '未知';
    $('sat-geo-note').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)} · 所有时刻 ${zone}。定位不自动推断时区。`;
    try {
      allPasses = findPasses(satrec, lat, lon, now);
      $('sat-range').textContent = `${fmt(now)}–${fmt(new Date(Math.min(now.getTime() + 48 * 3600000, f.expires.getTime())))} · ${zone}`;
      renderPasses();
    } catch { allPasses = []; clear('轨道计算失败，请刷新数据'); }
  }
  async function refreshData() {
    const button = $('sat-refresh') as HTMLButtonElement; button.disabled = true;
    $('sat-fetch-status').textContent = '正在读取站点最新快照…';
    try {
      const response = await fetch(`/data/iss-tle.json?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('星历下载失败');
      const incoming = validateTle(await response.json());
      if (tleFreshness(data).usable && tleFreshness(incoming).epoch < tleFreshness(data).epoch) throw new Error('服务器快照比当前数据旧');
      if (!tleFreshness(incoming).usable) throw new Error('服务器快照已过期');
      data = incoming; satrec = loadSatrec(data); $('sat-fetch-status').textContent = '已校验站点快照；数据年龄按 TLE 历元计算';
    } catch (error) { $('sat-fetch-status').textContent = `${error instanceof Error ? error.message : '刷新失败'}。保留原快照，仅在有效期内预测。`; }
    finally { button.disabled = false; run(); }
  }
  $('sat-apply').addEventListener('click', run); filter.addEventListener('change', renderPasses);
  $('sat-refresh').addEventListener('click', refreshData);
  $('sat-gps').addEventListener('click', () => requestGeo(pos => { latInput.value = pos.lat.toFixed(4); lonInput.value = pos.lon.toFixed(4); run(); $('sat-geo-note').textContent += pos.source === 'gps' ? ' GPS 已更新，请确认时区。' : ' 定位未成功，使用北京默认坐标。'; }));
  $('sat-pause').addEventListener('click', () => {
    skyState = { ...skyState, paused: !skyState.paused };
    $('sat-pause').textContent = skyState.paused ? '播放示意动画' : '暂停示意动画';
    $('sat-pause').setAttribute('aria-pressed', String(skyState.paused));
    canvas.dispatchEvent(new Event('skychange'));
  });
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    skyState.paused = true;
    const pauseButton = $('sat-pause') as HTMLButtonElement;
    pauseButton.disabled = true; pauseButton.textContent = '已启用减少动态效果'; pauseButton.setAttribute('aria-pressed', 'true');
  }
  run(); void refreshData(); setInterval(run, 60000);
  setInterval(() => {
    if (!tleFreshness(data).usable && skyState.passes.length) { run(); return; }
    $('sat-countdown').textContent = countdownText(skyState.passes[0], new Date(), filter.value === 'visible');
  }, 1000);
}
