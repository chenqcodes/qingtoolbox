import { drawOrbit, orbitPhaseText } from './draw';
import { hohmann, transferState } from './physics';
const $ = (id: string) => document.getElementById(id)!;
export function bootOrbitLab() {
  const canvas = $('orbit-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) { $('orbit-phase').textContent = '当前浏览器无法绘制画布，请使用支持 Canvas 的浏览器'; return; }
  const r1El = $('orbit-r1') as HTMLInputElement;
  const r2El = $('orbit-r2') as HTMLInputElement;
  const progress = $('orbit-progress') as HTMLInputElement;
  const mode = $('orbit-mode') as HTMLSelectElement;
  let playing = false, t = 0, last = performance.now(), frameId = 0;
  let passedArrival = false;
  const oneBurn = () => mode.value === 'one';
  const end = () => oneBurn() ? 2 : 1;
  const setPlaying = (value: boolean) => {
    playing = value;
    $('orbit-play').textContent = playing ? '暂停' : (t >= end() ? '重新开始' : t === 0 ? '从出发点开始' : '继续');
    $('orbit-play').setAttribute('aria-pressed', String(playing));
    if (playing && !frameId) { last = performance.now(); frameId = requestAnimationFrame(frame); }
    if (!playing && frameId) { cancelAnimationFrame(frameId); frameId = 0; }
  };
  const render = () => {
    const r1 = Number(r1El.value), r2 = Number(r2El.value), h = hohmann(r1, r2);
    drawOrbit(ctx, canvas.getBoundingClientRect().width, canvas.getBoundingClientRect().height, r1, r2, t, oneBurn());
    const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(5)}`;
    $('orbit-dv1').textContent = sign(h.dv1);
    $('orbit-dv2').textContent = oneBurn() ? '未执行（若圆化需 ' + sign(h.dv2) + '）' : sign(h.dv2);
    $('orbit-dvt').textContent = (oneBurn() ? Math.abs(h.dv1) : h.dvTotal).toFixed(5);
    $('orbit-a').textContent = h.a.toFixed(3);
    $('orbit-r1-val').textContent = r1.toFixed(2);
    $('orbit-r2-val').textContent = r2.toFixed(2);
    $('orbit-phase').textContent = orbitPhaseText(t, oneBurn(), r1 === r2);
    progress.value = String(t * 100);
    progress.max = String(end() * 100);
    $('orbit-progress-val').textContent = `${Math.round(t * 100)}% / ${end() * 100}%`;
    $('orbit-time').textContent = `${(h.transferTime * t).toFixed(3)} / ${(h.transferTime * end()).toFixed(3)} 相对时间单位`;
    const v = transferState(r1, r2, t);
    $('orbit-speed').textContent = (!oneBurn() && t >= 1 ? Math.sqrt(1 / r2) : Math.hypot(v.vx, v.vy)).toFixed(4) + (!oneBurn() && t >= 1 ? '（圆化后）' : r1 === r2 ? '（圆轨道）' : '（转移轨道）');
    $('orbit-direction').textContent = r1 === r2 ? '等半径：无点火，圆轨道自由飞行' : r2 > r1 ? '升轨：两次顺行加速' : '降轨：两次逆行减速';
  };
  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr); canvas.height = Math.floor(rect.height * dpr);
    // Draw in CSS pixels so labels remain legible on high-density mobile screens.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  };
  // Render's logical canvas bounds use CSS pixels, independently of the backing store.
  const reset = () => { t = 0; passedArrival = false; setPlaying(false); render(); };
  function frame(now: number) {
    frameId = 0;
    const dt = Math.min((now - last) / 1000, .1); last = now;
    if (playing && !document.hidden) {
      const next = Math.min(end(), t + dt / 8);
      if (!passedArrival && t < 1 && next >= 1) { t = 1; passedArrival = true; setPlaying(false); }
      else { t = next; if (t >= end()) setPlaying(false); }
      render();
    }
    if (playing) frameId = requestAnimationFrame(frame);
  }
  r1El.addEventListener('input', reset); r2El.addEventListener('input', reset);
  mode.addEventListener('change', reset);
  progress.addEventListener('input', () => { setPlaying(false); t = Number(progress.value) / 100; passedArrival = t >= 1; render(); });
  $('orbit-play').addEventListener('click', () => {
    if (t >= end()) { t = 0; passedArrival = false; }
    setPlaying(!playing); render();
  });
  $('orbit-replay').addEventListener('click', reset);
  document.querySelectorAll<HTMLButtonElement>('[data-r1]').forEach(btn => btn.addEventListener('click', () => {
    r1El.value = btn.dataset.r1 || '1'; r2El.value = btn.dataset.r2 || '2'; reset();
  }));
  window.addEventListener('resize', syncSize);
  window.addEventListener('pagehide', () => setPlaying(false));
  window.addEventListener('pageshow', syncSize);
  syncSize(); setPlaying(false);
}
