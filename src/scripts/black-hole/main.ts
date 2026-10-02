import { AU_KM, DEFAULTS, PRESETS, approach, clamp, formatKm, formatMass, referenceQuantities, type Preset } from './physics';
import { BlackHoleRenderer, type SceneSettings } from './renderer';

export function bootBlackHole() {
  const candidate = document.querySelector<HTMLElement>('#bh-observatory');
  if (!candidate || candidate.dataset.booted === 'true') return;
  const root: HTMLElement = candidate;
  root.dataset.booted = 'true';
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const canvas = get<HTMLCanvasElement>('bh-canvas');
  const mass = get<HTMLInputElement>('bh-mass'), distance = get<HTMLInputElement>('bh-distance'), inclination = get<HTMLInputElement>('bh-inclination');
  const lensing = get<HTMLInputElement>('bh-lensing'), beaming = get<HTMLInputElement>('bh-beaming');
  const pause = get<HTMLButtonElement>('bh-pause');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  let renderer: BlackHoleRenderer | null = null;
  let paused = reduced.matches, inView = true, hidden = document.hidden, disposed = false, suspended = false;
  let raf = 0, lastTime = 0, phase = 0, lastPaint = 0;
  let state: SceneSettings = { distance: DEFAULTS.distanceRs, inclination: DEFAULTS.inclination, lensing: true, beaming: true };
  let target = { ...state };
  let massLog = DEFAULTS.massLog;
  let dirty = true;
  try { renderer = new BlackHoleRenderer(canvas); } catch { get('bh-fallback').hidden = false; canvas.hidden = true; }
  function updateUI() {
    const ref = referenceQuantities(massLog, target.distance);
    get('bh-mass-value').textContent = `${formatMass(ref.mass)} M☉`;
    get('bh-distance-value').textContent = `${Math.round(target.distance)} Rₛ`;
    get('bh-inclination-value').textContent = `${Math.round(target.inclination)}°`;
    mass.setAttribute('aria-valuetext', `${formatMass(ref.mass)} 倍太阳质量`);
    distance.setAttribute('aria-valuetext', `${Math.round(target.distance)} 倍史瓦西半径`);
    inclination.setAttribute('aria-valuetext', `${Math.round(target.inclination)} 度，0 度为俯视`);
    get('bh-radius').textContent = formatKm(ref.rs);
    const au = ref.distanceKm / AU_KM;
    get('bh-physical-distance').textContent = au >= .01 ? `${au.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} AU` : formatKm(ref.distanceKm);
    get('bh-distance-km').textContent = `距离 = ${Math.round(target.distance)} × Rₛ${au >= .01 ? ` · ${formatKm(ref.distanceKm)}` : ''}`;
    get('bh-angle').textContent = `${ref.shadowAngleDegrees.toFixed(2)}°`;
    get('bh-scene-scale').textContent = `视距 ${Math.round(target.distance)} Rₛ · 倾角 ${Math.round(target.inclination)}°`;
    pause.innerHTML = paused ? '<span aria-hidden="true">▷</span> 继续流动' : '<span aria-hidden="true">Ⅱ</span> 暂停流动';
    pause.setAttribute('aria-pressed', String(paused));
    pause.disabled = !renderer;
    get('bh-live-label').textContent = !renderer ? '结构示意' : paused ? '定格观测' : '实时观测';
    get('bh-status').textContent = !renderer ? '已启用静态结构图；参数读数仍可交互' : paused ? (reduced.matches ? '已暂停 · 遵循减少动态效果偏好' : '已暂停 · 参数仍可实时调整') : '气体纹理流动中 · 速度经艺术处理';
    root.dataset.paused = String(paused);
  }
  function cancel() { if (raf) cancelAnimationFrame(raf); raf = 0; lastTime = 0; }
  function schedule() { if (!raf && !disposed && !suspended && !hidden && inView && renderer) raf = requestAnimationFrame(frame); }
  function publishFrame() {
    if (!renderer) return;
    root.dataset.frame = String(renderer.frames);
    root.dataset.renderedDistance = state.distance.toFixed(2);
    root.dataset.renderedInclination = state.inclination.toFixed(2);
  }
  function paint(now = performance.now()) {
    if (!renderer || disposed) return;
    renderer.render(state, phase); lastPaint = now; dirty = false; publishFrame();
  }
  function frame(now: number) {
    raf = 0;
    if (disposed || suspended || hidden || !inView || !renderer) return;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .07) : 0;
    lastTime = now;
    if (!paused) phase += delta;
    const transitioning = Math.abs(state.distance - target.distance) > .015 || Math.abs(state.inclination - target.inclination) > .015;
    if (paused || reduced.matches) state = { ...target };
    else state = { ...target, distance: approach(state.distance, target.distance, delta || .016), inclination: approach(state.inclination, target.inclination, delta || .016) };
    if (dirty || now - lastPaint >= 32 || transitioning) {
      paint(now);
    }
    if (!paused || transitioning) schedule();
  }
  function changed() {
    dirty = true; updateUI();
    // A paused scene is a calculator still, including when mobile controls scroll it offscreen.
    if (paused) { state = { ...target }; paint(); }
    else schedule();
  }
  function clearPreset() { root!.querySelectorAll<HTMLButtonElement>('[data-bh-preset]').forEach(button => button.setAttribute('aria-pressed', 'false')); get('bh-preset-note').textContent = '自定义观测 · 质量改变物理尺度，视距与倾角改变画面'; }
  function setPreset(preset: Preset) {
    const next = PRESETS[preset]; massLog = next.massLog;
    target = { distance: next.distanceRs, inclination: next.inclination, lensing: lensing.checked, beaming: beaming.checked };
    mass.value = String(massLog); distance.value = String(target.distance); inclination.value = String(target.inclination);
    root!.querySelectorAll<HTMLButtonElement>('[data-bh-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bhPreset === preset)));
    get('bh-preset-note').textContent = preset === 'stellar' ? '10 倍太阳质量；恒星级黑洞的示意尺度。' : preset === 'm87' ? '约 65 亿太阳质量；仅作尺度参考，不还原真实观测。' : '约 430 万太阳质量；仅作尺度参考，不还原真实观测。';
    changed();
  }
  const options = { signal: events.signal };
  mass.addEventListener('input', () => { massLog = clamp(Number(mass.value), 1, 10); clearPreset(); changed(); }, options);
  distance.addEventListener('input', () => { target.distance = clamp(Number(distance.value), 25, 110); clearPreset(); changed(); }, options);
  inclination.addEventListener('input', () => { target.inclination = clamp(Number(inclination.value), 0, 87); clearPreset(); changed(); }, options);
  lensing.addEventListener('change', () => { target.lensing = lensing.checked; changed(); }, options);
  beaming.addEventListener('change', () => { target.beaming = beaming.checked; changed(); }, options);
  pause.addEventListener('click', () => { paused = !paused; cancel(); changed(); }, options);
  root.querySelectorAll<HTMLButtonElement>('[data-bh-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.bhPreset as Preset), options));
  get('bh-reset').addEventListener('click', () => { lensing.checked = true; beaming.checked = true; phase = 0; setPreset('sagittarius'); }, options);
  reduced.addEventListener('change', () => { if (reduced.matches) { paused = true; cancel(); changed(); } }, options);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (hidden) cancel(); else { dirty = true; schedule(); } }, options);
  const resize = new ResizeObserver(() => {
    if (disposed || !renderer?.resize()) return;
    // resize() restores the held image in this callback; visibility only gates animation.
    if (!renderer.frames) paint(); else publishFrame();
    if (!paused) schedule();
  });
  resize.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (inView) { dirty = true; schedule(); } else cancel(); }, { rootMargin: '80px' });
  visibility.observe(canvas);
  function destroy() { disposed = true; cancel(); events.abort(); resize.disconnect(); visibility.disconnect(); renderer?.dispose(); }
  window.addEventListener('pagehide', (event) => { if (event.persisted) { suspended = true; cancel(); } else destroy(); }, options);
  window.addEventListener('pageshow', () => { suspended = false; dirty = true; schedule(); }, options);
  document.addEventListener('astro:before-swap', destroy, { once: true, signal: events.signal });
  updateUI(); schedule();
}
