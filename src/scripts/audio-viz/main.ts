import { createAudioEngine, type AudioEngine } from './audio';
import { createParticles, drawParticles, updateParticles } from './particles';

function $(id: string) { return document.getElementById(id)!; }

export function bootAudioViz() {
  const canvas = $('audio-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) { $('audio-status').textContent = '此浏览器无法创建画布，请换用支持 Canvas 的浏览器。'; return; }
  const sensEl = $('audio-sens') as HTMLInputElement;
  const countEl = $('audio-count') as HTMLInputElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let engine: AudioEngine | null = null;
  let request = 0;
  let raf = 0;
  let particles = createParticles(400, 800, 400);
  let last = performance.now();
  const events = new AbortController();
  const opts = { signal: events.signal };
  const syncPause = () => {
    $('audio-pause').textContent = paused ? '继续画面' : '暂停画面';
    $('audio-pause').setAttribute('aria-pressed', String(paused));
  };
  syncPause();
  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const n = Math.min(800, Math.max(50, Number(countEl.value) || 400));
    particles = createParticles(n, canvas.width, canvas.height);
    drawParticles(ctx, particles, canvas.width, canvas.height);
  };
  syncSize();
  window.addEventListener('resize', syncSize, opts);
  const ensureEngine = () => {
    if (!engine || engine.ctx.state === 'closed') engine = createAudioEngine();
    return engine;
  };
  $('audio-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ''; // Selecting the same file again is a new request.
    const token = ++request;
    $('audio-status').textContent = '解码中…';
    try {
      const connected = await ensureEngine().connectFile(file);
      if (token === request && connected) $('audio-status').textContent = `播放：${file.name}`;
    } catch {
      if (token === request) $('audio-status').textContent = '无法播放该音频，请检查文件格式或浏览器音频支持。';
    }
  }, opts);
  $('audio-mic').addEventListener('click', async () => {
    const token = ++request;
    $('audio-status').textContent = '请求麦克风…';
    try {
      const connected = await ensureEngine().connectMic();
      if (token === request && connected) $('audio-status').textContent = '麦克风已连接，仅分析，不通过扬声器回放';
    } catch {
      if (token === request) $('audio-status').textContent = '麦克风不可用或未授权；可改选本地音频。';
    }
  }, opts);
  $('audio-stop').addEventListener('click', () => {
    ++request;
    engine?.stop();
    $('audio-status').textContent = '已停止，麦克风已释放';
  }, opts);
  $('audio-pause').addEventListener('click', () => { paused = !paused; syncPause(); }, opts);
  motion.addEventListener('change', () => { paused = motion.matches; syncPause(); }, opts);
  countEl.addEventListener('change', syncSize, opts);
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      const freq = engine?.getFrequency() ?? new Uint8Array(256);
      updateParticles(particles, freq, canvas.width, canvas.height, Number(sensEl.value) || 1, dt);
      drawParticles(ctx, particles, canvas.width, canvas.height);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const release = () => {
    ++request;
    cancelAnimationFrame(raf);
    void engine?.dispose().catch(() => {});
    engine = null;
    $('audio-status').textContent = '已停止，点击音源重新开始';
  };
  window.addEventListener('pagehide', release, opts);
  window.addEventListener('pageshow', (event) => { if (event.persisted) { last = performance.now(); raf = requestAnimationFrame(frame); } }, opts);
  document.addEventListener('astro:before-swap', () => { release(); events.abort(); }, { once: true });
}
