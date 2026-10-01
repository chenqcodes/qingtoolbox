import { createAudioEngine, type AudioEngine } from './audio';
import { analyseBands, createParticles, drawParticles, updateParticles, type VisualPreset } from './particles';
function $(id: string) { return document.getElementById(id)!; }
const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function bootAudioViz() {
  const canvas = $('audio-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) { $('audio-status').textContent = '此浏览器无法创建画布，请换用支持 Canvas 的浏览器。'; return; }
  const sensEl = $('audio-sens') as HTMLInputElement;
  const countEl = $('audio-count') as HTMLInputElement;
  const seekEl = $('audio-seek') as HTMLInputElement;
  const volumeEl = $('audio-volume') as HTMLInputElement;
  const loopEl = $('audio-loop') as HTMLInputElement;
  const playback = $('audio-playback') as HTMLButtonElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let engine: AudioEngine | null = null;
  let request = 0;
  let raf = 0;
  let preset: VisualPreset = 'orbit';
  let particles = createParticles(400, 800, 400);
  let last = performance.now();
  let lastUi = 0;
  let label = '';
  let phase = '';
  const events = new AbortController();
  const opts = { signal: events.signal };
  const empty = new Uint8Array(1024);
  const syncPause = () => { $('audio-pause').textContent = paused ? '继续画面' : '暂停画面'; $('audio-pause').setAttribute('aria-pressed', String(paused)); };
  syncPause();
  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    particles = createParticles(Math.min(800, Math.max(50, Number(countEl.value) || 400)), canvas.width, canvas.height);
    drawParticles(ctx, particles, canvas.width, canvas.height);
  };
  syncSize(); window.addEventListener('resize', syncSize, opts);
  const ensureEngine = () => {
    if (!engine || engine.ctx.state === 'closed') engine = createAudioEngine();
    engine.setVolume(Number(volumeEl.value)); engine.setLoop(loopEl.checked);
    return engine;
  };
  const syncPlayback = () => {
    const state = engine?.getState();
    const buffered = !!state && (state.mode === 'file' || state.mode === 'demo') && state.duration > 0;
    playback.disabled = !buffered;
    playback.textContent = state?.playback === 'playing' ? '暂停音频' : '播放音频';
    seekEl.disabled = !buffered;
    seekEl.max = String(state?.duration || 1);
    seekEl.value = String(state?.position || 0);
    $('audio-time').textContent = buffered ? `${timeLabel(state.position)} / ${timeLabel(state.duration)}` : state?.mode === 'mic' ? '实时输入 · 无播放进度' : '0:00 / 0:00';
    if (state && buffered && phase !== state.playback) {
      phase = state.playback;
      $('audio-status').textContent = `${state.playback === 'playing' ? '播放中' : state.playback === 'ended' ? '播放结束' : '已暂停'}：${label}`;
    }
  };
  const connect = async (kind: 'file' | 'mic' | 'demo', file?: File) => {
    const token = ++request;
    phase = '';
    label = kind === 'demo' ? '本地合成 · 三频段节奏' : kind === 'file' ? file!.name : '麦克风';
    $('audio-status').textContent = kind === 'mic' ? '请求麦克风…' : kind === 'demo' ? '生成本地示例…' : '解码中…';
    try {
      const active = ensureEngine();
      const connected = await (kind === 'file' ? active.connectFile(file!) : kind === 'demo' ? active.connectDemo() : active.connectMic());
      if (token !== request || !connected) return;
      $('audio-status').textContent = kind === 'mic' ? '麦克风已连接，仅分析，不通过扬声器回放' : `播放中：${label}`;
      phase = 'playing';
      syncPlayback();
    } catch {
      if (token === request) { $('audio-status').textContent = kind === 'mic' ? '麦克风不可用或未授权；可使用内置示例或本地音频。' : '无法播放音频，请检查文件格式或浏览器音频支持。'; syncPlayback(); }
    }
  };
  $('audio-file').addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0];
    if (!file) return; input.value = ''; void connect('file', file);
  }, opts);
  $('audio-demo').addEventListener('click', () => void connect('demo'), opts);
  $('audio-mic').addEventListener('click', () => void connect('mic'), opts);
  $('audio-stop').addEventListener('click', () => { ++request; engine?.stop(); phase = ''; $('audio-status').textContent = '已停止，麦克风已释放'; syncPlayback(); }, opts);
  playback.addEventListener('click', async () => {
    if (!engine) return;
    const token = request;
    try { if (engine.getState().playback === 'playing') engine.pause(); else await engine.resume(); }
    catch { if (token === request) $('audio-status').textContent = '浏览器暂未允许恢复音频，请重新选择音源。'; }
    if (token === request) syncPlayback();
  }, opts);
  seekEl.addEventListener('input', () => { engine?.seek(Number(seekEl.value)); syncPlayback(); }, opts);
  volumeEl.addEventListener('input', () => { engine?.setVolume(Number(volumeEl.value)); $('audio-volume-label').textContent = `${Math.round(Number(volumeEl.value) * 100)}%`; }, opts);
  loopEl.addEventListener('change', () => engine?.setLoop(loopEl.checked), opts);
  $('audio-preset').addEventListener('change', (event) => { preset = (event.target as HTMLSelectElement).value as VisualPreset; syncSize(); }, opts);
  $('audio-pause').addEventListener('click', () => { paused = !paused; syncPause(); }, opts);
  motion.addEventListener('change', () => { paused = motion.matches; syncPause(); }, opts);
  countEl.addEventListener('change', syncSize, opts);
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const freq = engine?.getFrequency() ?? empty;
    const bands = analyseBands(freq, engine?.ctx.sampleRate ?? 48000, engine?.analyser.fftSize ?? 2048);
    if (!paused) {
      updateParticles(particles, freq, canvas.width, canvas.height, Number(sensEl.value) || 1, dt, bands, preset);
      drawParticles(ctx, particles, canvas.width, canvas.height, bands, preset, freq, engine?.ctx.sampleRate ?? 48000);
    }
    if (now - lastUi > 150) {
      for (const band of ['low', 'mid', 'high'] as const) { ($(`audio-${band}`) as HTMLMeterElement).value = bands[band]; $(`audio-${band}-value`).textContent = `${Math.round(bands[band] * 100)}%`; }
      syncPlayback(); lastUi = now;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const release = () => { ++request; cancelAnimationFrame(raf); void engine?.dispose().catch(() => {}); engine = null; $('audio-status').textContent = '已停止，点击音源重新开始'; syncPlayback(); };
  window.addEventListener('pagehide', release, opts);
  window.addEventListener('pageshow', (event) => { if (event.persisted) { last = performance.now(); raf = requestAnimationFrame(frame); } }, opts);
  document.addEventListener('astro:before-swap', () => { release(); events.abort(); }, { once: true });
  syncPlayback();
}
