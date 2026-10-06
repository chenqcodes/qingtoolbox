import { drawScale } from './draw';
import { sceneAt } from './scene';
import { clamp, formatLength, HOME_EXP, MAX_EXP, MIN_EXP, nearestStop, nextStop, scaleBar, STOPS, stopExponent } from './model';
let dispose: (() => void) | undefined;
export function bootCosmicScale(): void {
  dispose?.();
  const root = document.querySelector<HTMLElement>('#cosmic-app');
  if (!root) return;
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const canvas = get<HTMLCanvasElement>('cosmic-canvas');
  const context = canvas.getContext('2d');
  const stage = get<HTMLDivElement>('cosmic-stage');
  const slider = get<HTMLInputElement>('cosmic-range');
  const select = get<HTMLSelectElement>('cosmic-select');
  const play = get<HTMLButtonElement>('cosmic-play');
  const wheel = get<HTMLInputElement>('cosmic-wheel');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const signal = abort.signal;
  let exponent = HOME_EXP;
  let width = 600, height = 525, dpr = 1, lastStop = '';
  let raf = 0, previousTime = 0, playing = false;
  let motion: { from: number; to: number; start: number; duration: number } | undefined;
  let status = '';
  function tell(message: string) {
    if (message !== status) { get('cosmic-status').textContent = message; status = message; }
  }
  function paint() {
    const stop = nearestStop(exponent);
    root!.style.setProperty('--cosmic-accent', stop.color);
    root!.dataset.exponent = exponent.toFixed(6);
    root!.dataset.playing = String(playing);
    root!.dataset.motion = String(Boolean(motion));
    slider.value = String(exponent);
    slider.setAttribute('aria-valuetext', `视野宽 ${formatLength(10 ** exponent)}；附近尺度：${stop.name}`);
    get('cosmic-field-size').textContent = formatLength(10 ** exponent);
    get('cosmic-ruler-label').textContent = formatLength(scaleBar(exponent, width).metres);
    get('cosmic-exponent').textContent = `对数尺 · 每一整格 = 10 倍`;
    get<HTMLButtonElement>('cosmic-in').disabled = exponent <= MIN_EXP + .001;
    get<HTMLButtonElement>('cosmic-out').disabled = exponent >= MAX_EXP - .001;
    get<HTMLButtonElement>('cosmic-prev').disabled = exponent <= MIN_EXP + .001;
    get<HTMLButtonElement>('cosmic-next').disabled = exponent >= MAX_EXP - .001;
    const scene = sceneAt(exponent, width, height);
    root!.dataset.visibleObjects = scene.objects.map(object => object.stop.id).join(',');
    root!.dataset.sceneCoverage = String(Math.max(...scene.objects.map(object => object.visibleExtent / Math.min(width, height)), 0));
    get('cosmic-art-note').textContent = stop.kind === 'observable' ? '观测范围示意 · 不是宇宙的实体边缘' : scene.objects.some(object => ['solar', 'stellar', 'orbit', 'heliosphere', 'comet-orbit', 'oort', 'nebula', 'cluster', 'bubble', 'arm', 'galaxy', 'galaxy-distance', 'galaxy-group', 'galaxy-cluster', 'supercluster', 'laniakea', 'wall', 'cosmic-web', 'observable'].includes(object.stop.kind) && object.visibleSpan > width * .08) ? '区域 / 距离按比例 · 光点放大示意' : '尺寸按比例 · 插画非照片';
    get('cosmic-lane-caption').textContent = scene.lower.id === scene.upper.id ? `已抵达 ${scene.upper.name}` : `${scene.lower.name} → ${scene.upper.name}`;
    get('cosmic-progress').style.setProperty('--journey-progress', `${(exponent - MIN_EXP) / (MAX_EXP - MIN_EXP) * 100}%`);
    if (stop.id !== lastStop) {
      lastStop = stop.id;
      get('cosmic-chapter').textContent = stop.chapter;
      get('cosmic-name').textContent = stop.name;
      get('cosmic-dimension').textContent = stop.dimension;
      get('cosmic-fact').textContent = stop.fact;
      get('cosmic-caveat').textContent = stop.caveat;
      get('cosmic-kind').textContent = stop.dimension.includes('示例') ? '选定尺度 · 示意' : '科学尺寸 · 近似值';
      const source = get<HTMLAnchorElement>('cosmic-source');
      source.hidden = !stop.source;
      if (stop.source) { source.href = stop.source.url; source.textContent = `${stop.source.name} ↗`; }
      select.value = stop.id;
      root!.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stop === stop.id)));
    }
    canvas.setAttribute('aria-label', `${stop.name}，${stop.dimension}。画布视野宽 ${formatLength(10 ** exponent)}。${stop.caveat} 同比例可见参照：${scene.objects.filter(object => object.pixels >= 6).map(object => object.stop.name).join('、')}。`);
    if (context) drawScale(context, width, height, exponent, stop, dpr);
  }
  function buttonState() {
    play.disabled = media.matches || !context;
    play.textContent = media.matches ? '已减少动态效果' : playing ? 'Ⅱ 暂停旅行' : '▷ 自动向外旅行';
    play.setAttribute('aria-pressed', String(playing));
  }
  function pause(message?: string) {
    playing = false; motion = undefined;
    cancelAnimationFrame(raf); raf = 0; previousTime = 0;
    buttonState();
    if (message) tell(message);
  }
  function requestFrame() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    raf = 0;
    if (document.hidden) return;
    const dt = previousTime ? Math.min((now - previousTime) / 1000, .06) : 0;
    previousTime = now;
    if (playing) {
      exponent = clamp(exponent + dt * .5);
      if (exponent >= MAX_EXP) pause('已抵达可观测宇宙。这里是观测范围，不是整个宇宙的边缘；仍可以向内探索。');
    } else if (motion) {
      const t = Math.min(1, (now - motion.start) / motion.duration);
      const ease = t * t * (3 - 2 * t);
      exponent = motion.from + (motion.to - motion.from) * ease;
      if (t === 1) { exponent = motion.to; motion = undefined; }
    }
    paint();
    if (playing || motion) requestFrame();
    else previousTime = 0;
  }
  function go(value: number, immediate = false) {
    pause();
    const destination = clamp(value);
    const stop = nearestStop(destination);
    tell(`已暂停旅行 · ${stop.name}附近。视野宽 ${formatLength(10 ** destination)}。`);
    if (media.matches || immediate || Math.abs(destination - exponent) < .001) { exponent = destination; paint(); }
    else {
      motion = { from: exponent, to: destination, start: performance.now(), duration: Math.min(4500, 300 + Math.abs(destination - exponent) * 200) };
      requestFrame();
    }
  }
  function toggle() {
    if (media.matches || !context) return;
    if (playing) { pause('旅行已暂停。可以拖动标尺，也可以换一个站点。'); paint(); return; }
    motion = undefined;
    if (exponent >= MAX_EXP - .001) exponent = MIN_EXP;
    playing = true; buttonState(); tell('正在自动向外旅行 · 点击暂停或操作任意尺度控制即可停下。');
    requestFrame();
  }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context?.setTransform(dpr, 0, 0, dpr, 0, 0); paint();
  }
  const observer = new ResizeObserver(resize); observer.observe(stage);
  slider.addEventListener('input', () => go(Number(slider.value), true), { signal });
  slider.addEventListener('pointerdown', () => { pause('已暂停旅行，可以拖动标尺。'); paint(); }, { signal });
  select.addEventListener('change', () => { const stop = STOPS.find(item => item.id === select.value); if (stop) go(stopExponent(stop)); }, { signal });
  root.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach(button => button.addEventListener('click', () => { const stop = STOPS.find(item => item.id === button.dataset.stop); if (stop) go(stopExponent(stop)); }, { signal }));
  get('cosmic-home').addEventListener('click', () => go(HOME_EXP), { signal });
  get('cosmic-in').addEventListener('click', () => go(exponent - 1), { signal });
  get('cosmic-out').addEventListener('click', () => go(exponent + 1), { signal });
  get('cosmic-prev').addEventListener('click', () => go(stopExponent(nextStop(exponent, -1))), { signal });
  get('cosmic-next').addEventListener('click', () => go(stopExponent(nextStop(exponent, 1))), { signal });
  play.addEventListener('click', toggle, { signal });
  wheel.addEventListener('change', () => { pause(wheel.checked ? '滚轮缩放已开启；仅在画布上拦截滚动。' : '滚轮缩放已关闭，页面可正常滚动。'); paint(); }, { signal });
  stage.addEventListener('wheel', (event) => {
    if (!wheel.checked || event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    go(exponent + Math.max(-.6, Math.min(.6, delta * .0025)), true);
  }, { signal, passive: false });
  stage.addEventListener('keydown', (event) => {
    if (event.target !== stage) return;
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return;
    event.preventDefault();
    if (event.key === ' ') toggle();
    else if (event.key === 'Home') go(HOME_EXP);
    else if (event.key === 'End') go(MAX_EXP);
    else if (event.key === 'PageUp' || event.key === 'PageDown') go(stopExponent(nextStop(exponent, event.key === 'PageUp' ? -1 : 1)));
    else go(exponent + (event.key === 'ArrowRight' || event.key === 'ArrowUp' ? .2 : -.2), true);
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pause('页面已隐藏，旅行自动暂停。回来后可手动继续。'); paint(); }
    else resize();
  }, { signal });
  media.addEventListener('change', () => {
    pause(media.matches ? '已减少动态效果：定位即时完成，自动旅行关闭。' : '旅行已暂停，可手动重新开始。'); paint();
  }, { signal });
  window.addEventListener('pagehide', (event) => {
    pause(); observer.disconnect();
    // A BFCache suspension keeps the same document and its selected scale.
    // Only a real unload disposes its listeners.
    if (!event.persisted) abort.abort();
  }, { signal });
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    observer.observe(stage); resize();
    tell('已回到离开时的尺度。旅行保持暂停，可手动继续。');
  }, { signal });
  dispose = () => { pause(); observer.disconnect(); abort.abort(); };
  buttonState(); resize();
  if (!context) tell('画布暂不可用。仍可用滑杆和站点阅读尺寸说明，下方保留全部资料。');
  else if (media.matches) tell('已减少动态效果：定位即时完成，自动旅行关闭。');
}
