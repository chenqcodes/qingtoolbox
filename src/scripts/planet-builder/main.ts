import { PRESETS, TAU, atmosphereColor, clamp, createSphereMap, createTextureAsync, hash3, illuminatedFraction, oceanFraction, renderSphere, wrap, type PlanetSettings, type PlanetTexture, type SphereMap, type WorldKind } from './model';
import { LatestTextureLoader } from './texture-jobs';

const WORLD_COPY: Record<WorldKind, [string, string]> = {
  oasis: ['潮汐花园', '山脉、群岛与一片蓝色的可能'],
  ember: ['赤色荒原', '暖光掠过古老山脊，风暴缓缓醒来'],
  frost: ['极夜冰原', '在冰与深海之间，等一道极光'],
};
type SliderKey = 'sea' | 'relief' | 'clouds' | 'atmosphere' | 'warmth' | 'phase';

export function bootPlanetBuilder(): void {
  const root = document.querySelector<HTMLElement>('#planet-builder');
  if (!root || root.dataset.booted) return;
  root.dataset.booted = 'true';
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const canvas = query<HTMLCanvasElement>('#pb-canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    query('#pb-loading').hidden = true;
    query('#pb-unavailable').hidden = false;
    root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('button, input').forEach(control => control.disabled = true);
    return;
  }
  const ctx = context;
  const controller = new AbortController();
  const { signal } = controller;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let settings = { ...PRESETS.oasis }, rotation = 1.1, tilt = .18, cloudRotation = 0;
  let playing = !motion.matches, disposed = false, visible = true, dirty = true, pendingTexture = true;
  let frame = 0, previousTime = 0, frameHandle = 0, seaUpdate = true;
  let texture: PlanetTexture | null = null;
  let textureSeed: number | null = null;
  let textureRequest: Promise<PlanetTexture | null> | null = null;
  let generation = 0;
  const textureLoader = new LatestTextureLoader();
  let map: SphereMap | null = null;
  const sphereCanvas = document.createElement('canvas');
  const sphereContext = sphereCanvas.getContext('2d')!;
  let spherePixels: ImageData;
  const background = document.createElement('canvas');
  let lastSize = '', cssWidth = 1, cssHeight = 1;

  function updatePlayback(): void {
    query('#pb-play-label').textContent = playing ? '暂停自转' : '继续自转';
    query('#pb-play-icon').textContent = playing ? 'Ⅱ' : '▷';
    query('#pb-play').setAttribute('aria-pressed', String(playing));
    root!.dataset.playing = String(playing);
    previousTime = 0;
    schedule();
  }
  function syncControls(): void {
    root!.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => {
      const key = input.dataset.setting as SliderKey;
      input.value = String(settings[key]);
      input.style.setProperty('--range', `${settings[key] / Number(input.max) * 100}%`);
      query(`#pb-${key}-value`).textContent = `${settings[key]}${key === 'phase' ? '°' : ''}`;
    });
    root!.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach(input => input.checked = settings[input.dataset.toggle as 'aurora' | 'storm']);
    root!.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === settings.kind)));
    query('#pb-world-name').textContent = WORLD_COPY[settings.kind][0];
    query('#pb-world-subtitle').textContent = WORLD_COPY[settings.kind][1];
    query('#pb-seed-value').textContent = String(settings.seed).padStart(4, '0');
    query('#pb-light-stat').innerHTML = `${Math.round(illuminatedFraction(settings.phase) * 100)}<span>%</span>`;
    query('#pb-star-stat').textContent = settings.warmth < 30 ? '清冷蓝光' : settings.warmth > 68 ? '温暖橙光' : '柔和白光';
    root!.dataset.preset = settings.kind;
    root!.dataset.seed = String(settings.seed);
    root!.dataset.phase = String(settings.phase);
    root!.dataset.aurora = String(settings.aurora);
    root!.dataset.storm = String(settings.storm);
    canvas.setAttribute('aria-label', `${WORLD_COPY[settings.kind][0]}，可见受光面 ${Math.round(illuminatedFraction(settings.phase) * 100)}%，${settings.aurora ? '开启极光，' : ''}拖动或使用方向键旋转，空格暂停或继续自转`);
  }
  function drawBackground(target: HTMLCanvasElement, width: number, height: number): void {
    target.width = width; target.height = height;
    const b = target.getContext('2d')!;
    b.fillStyle = '#050d17'; b.fillRect(0, 0, width, height);
    const nebula = b.createRadialGradient(width * .2, height * .18, 0, width * .4, height * .48, width * .85);
    nebula.addColorStop(0, '#112b3980'); nebula.addColorStop(.4, '#0d273242'); nebula.addColorStop(1, '#020a1600');
    b.fillStyle = nebula; b.fillRect(0, 0, width, height);
    const dust = b.createRadialGradient(width * .8, height * .75, 0, width * .8, height * .75, width * .45);
    dust.addColorStop(0, '#20384324'); dust.addColorStop(1, '#050d1700'); b.fillStyle = dust; b.fillRect(0, 0, width, height);
    const scale = width / 800;
    for (let i = 0; i < 230; i++) {
      const x = hash3(i, 2, 8, 91) * width, y = hash3(i, 3, 8, 91) * height;
      const brightness = hash3(i, 5, 8, 91);
      b.globalAlpha = .13 + brightness * .45;
      b.fillStyle = i % 7 === 0 ? '#d7bc8e' : '#a1c1ce';
      b.beginPath(); b.arc(x, y, Math.max(.4, (.3 + brightness * .75) * scale), 0, TAU); b.fill();
      if (brightness > .975) {
        b.globalAlpha = .09; b.fillRect(x - 4 * scale, y, 8 * scale, .7 * scale); b.fillRect(x, y - 4 * scale, .7 * scale, 8 * scale);
      }
    }
    b.globalAlpha = 1;
  }
  function measure(): void {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cssWidth = rect.width; cssHeight = rect.height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.round(cssWidth * dpr), height = Math.round(cssHeight * dpr);
    const sizeKey = `${width}:${height}`;
    if (sizeKey === lastSize) return;
    lastSize = sizeKey;
    canvas.width = width; canvas.height = height;
    drawBackground(background, width, height);
    ctx.drawImage(background, 0, 0);
    const size = Math.round(clamp(Math.min(cssWidth * .73, cssHeight * .69) * Math.min(dpr, 1.25), 180, 440));
    sphereCanvas.width = size; sphereCanvas.height = size;
    spherePixels = sphereContext.createImageData(size, size);
    map = createSphereMap(size, tilt);
    dirty = true;
    schedule();
  }
  function paintScene(target: CanvasRenderingContext2D, width: number, height: number, sphere: HTMLCanvasElement, exporting = false, appearance: PlanetSettings = settings): void {
    const diameter = Math.min(width * .73, height * .69), radius = diameter / 2, cx = width * .50, cy = height * .52;
    if (exporting) {
      const exportBackground = document.createElement('canvas'); drawBackground(exportBackground, width, height); target.drawImage(exportBackground, 0, 0);
    } else target.drawImage(background, 0, 0);
    const air = atmosphereColor(appearance.kind);
    const atmosphere = appearance.atmosphere / 100;
    if (atmosphere > 0) {
      const glow = target.createRadialGradient(cx, cy, radius * .95, cx, cy, radius * (1.04 + atmosphere * .13));
      glow.addColorStop(0, `rgba(${air.join(',')},0)`);
      glow.addColorStop(.25, `rgba(${air.join(',')},${.24 * atmosphere})`);
      glow.addColorStop(.52, `rgba(${air.join(',')},${.035 * atmosphere})`);
      glow.addColorStop(1, `rgba(${air.join(',')},0)`);
      target.fillStyle = glow; target.beginPath(); target.arc(cx, cy, radius * 1.2, 0, TAU); target.fill();
    }
    // A faint measurement reticle belongs to the studio, never to the planet's surface.
    target.strokeStyle = '#577c881b'; target.lineWidth = Math.max(1, width / 900);
    const reticleRadius = radius * 1.19;
    target.setLineDash([2 * width / 800, 7 * width / 800]);
    target.beginPath(); target.arc(cx, cy, reticleRadius, .12, Math.PI * .56); target.stroke();
    target.beginPath(); target.arc(cx, cy, reticleRadius, Math.PI * 1.08, Math.PI * 1.72); target.stroke();
    target.setLineDash([]);
    target.drawImage(sphere, cx - radius, cy - radius, diameter, diameter);
    if (exporting) {
      target.fillStyle = '#e0e9dc'; target.font = '42px sans-serif'; target.fillText(WORLD_COPY[appearance.kind][0], width * .07, height * .12);
      target.font = '16px monospace'; target.fillStyle = '#66838b'; target.fillText(`SEED ${appearance.seed}  /  PROCEDURAL WORLD`, width * .07, height * .93);
    }
  }
  function draw(): void {
    if (!map || !texture || pendingTexture || textureSeed !== settings.seed) return;
    const started = performance.now();
    renderSphere(spherePixels.data, map, texture, settings, rotation, cloudRotation);
    sphereContext.putImageData(spherePixels, 0, 0);
    paintScene(ctx, canvas.width, canvas.height, sphereCanvas);
    if (seaUpdate) { query('#pb-ocean-stat').innerHTML = `${Math.round(oceanFraction(texture, settings.sea) * 100)}<span>%</span>`; seaUpdate = false; }
    root!.dataset.frame = String(++frame);
    root!.dataset.rotation = rotation.toFixed(4);
    root!.dataset.ready = 'true';
    query('#pb-loading').hidden = true;
    if (performance.now() - started > 48 && map.size > 260) {
      const size = Math.max(260, Math.floor(map.size * .88));
      sphereCanvas.width = size; sphereCanvas.height = size;
      spherePixels = sphereContext.createImageData(size, size);
      map = createSphereMap(size, tilt);
    }
  }
  function tick(time: number): void {
    frameHandle = 0;
    if (disposed || document.hidden || !visible) { previousTime = 0; return; }
    // A pending world never combines the previous texture with the newly chosen
    // settings. Chunked generation keeps controls responsive while this frame holds.
    if (pendingTexture) { previousTime = 0; return; }
    const elapsed = previousTime ? Math.min(120, time - previousTime) : 0;
    if (dirty || (playing && elapsed >= 65) || (playing && !previousTime)) {
      if (playing && elapsed) { rotation = wrap(rotation + elapsed * .00005, TAU); cloudRotation += elapsed * .000007; }
      previousTime = time;
      draw(); dirty = false;
    }
    if (playing || dirty) schedule();
  }
  function schedule(): void {
    if (!disposed && !frameHandle && !document.hidden && visible) frameHandle = requestAnimationFrame(tick);
  }
  function regenerate(resetRotation: boolean): void {
    const requestGeneration = ++generation, seed = settings.seed;
    pendingTexture = true; dirty = true; seaUpdate = true;
    root!.dataset.generating = 'true';
    root!.dataset.ready = 'false';
    canvas.setAttribute('aria-busy', 'true');
    if (resetRotation) { rotation = 1.1; tilt = .18; cloudRotation = 0; if (map) map = createSphereMap(map.size, tilt); }
    syncControls();
    query('#pb-ocean-stat').textContent = '…';
    query('#pb-loading').textContent = '正在铺展海岸线…'; query('#pb-loading').hidden = false;
    const request = textureLoader.request(seed);
    textureRequest = request;
    void request.then(result => {
      if (!result || disposed || requestGeneration !== generation || settings.seed !== seed) return;
      texture = result; textureSeed = seed; pendingTexture = false;
      root!.dataset.generating = 'false'; root!.dataset.textureSeed = String(seed);
      canvas.setAttribute('aria-busy', 'false');
      seaUpdate = true; dirty = true; previousTime = 0;
      query('#pb-loading').hidden = true;
      if (!exporting && query('#pb-status').textContent?.startsWith('正在')) query('#pb-status').textContent = '世界已生成 · PNG 图片 · 1600 × 1400';
      schedule();
    }).catch(() => {
      if (disposed || requestGeneration !== generation) return;
      root!.dataset.generating = 'false'; canvas.setAttribute('aria-busy', 'false');
      query('#pb-loading').textContent = '地形生成未完成，请再选一个世界或重试';
      query('#pb-status').textContent = '生成失败，可重新选择预设或换一片大陆';
    });
    schedule();
  }

  root.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => input.addEventListener('input', () => {
    const key = input.dataset.setting as SliderKey;
    settings[key] = clamp(Number(input.value), Number(input.min), Number(input.max));
    seaUpdate ||= key === 'sea'; syncControls(); dirty = true; schedule();
  }, { signal }));
  root.querySelectorAll<HTMLInputElement>('[data-toggle]').forEach(input => input.addEventListener('change', () => {
    settings[input.dataset.toggle as 'aurora' | 'storm'] = input.checked;
    syncControls(); dirty = true; schedule();
  }, { signal }));
  root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.addEventListener('click', () => {
    settings = { ...PRESETS[button.dataset.preset as WorldKind] }; regenerate(true);
    query('#pb-status').textContent = `正在塑造${WORLD_COPY[settings.kind][0]} · 可随时切换或调整参数`;
  }, { signal }));
  query('#pb-regenerate').addEventListener('click', () => {
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const nextSeed = random[0] % 100000;
    settings.seed = nextSeed === settings.seed ? (nextSeed + 1) % 100000 : nextSeed;
    regenerate(false); query('#pb-status').textContent = '正在生成新地形，保留你的创作参数';
  }, { signal });
  query('#pb-play').addEventListener('click', () => { playing = !playing; updatePlayback(); }, { signal });
  query('#pb-home').addEventListener('click', () => {
    rotation = 1.1; tilt = .18; cloudRotation = 0;
    if (map) map = createSphereMap(map.size, tilt);
    dirty = true; schedule(); query('#pb-status').textContent = '视角已重置，保留当前地形与参数';
  }, { signal });
  let dragging = false, lastX = 0, lastY = 0, pointerId = -1;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dragging = true; lastX = event.clientX; lastY = event.clientY; pointerId = event.pointerId;
    canvas.setPointerCapture(pointerId); canvas.focus({ preventScroll: true });
    playing = false; updatePlayback();
  }, { signal });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== pointerId) return;
    rotation = wrap(rotation + (event.clientX - lastX) / Math.max(200, cssWidth) * 4, TAU);
    const nextTilt = clamp(tilt + (event.clientY - lastY) / Math.max(250, cssHeight) * 2, -.95, .95);
    if (map && Math.abs(nextTilt - tilt) > .002) { tilt = nextTilt; map = createSphereMap(map.size, tilt); }
    lastX = event.clientX; lastY = event.clientY;
    dirty = true; schedule();
  }, { signal });
  const endDrag = () => { dragging = false; pointerId = -1; };
  canvas.addEventListener('pointerup', endDrag, { signal });
  canvas.addEventListener('pointercancel', endDrag, { signal });
  canvas.addEventListener('lostpointercapture', endDrag, { signal });
  canvas.addEventListener('keydown', event => {
    if (event.code === 'Space') { event.preventDefault(); playing = !playing; updatePlayback(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); playing = false; updatePlayback();
    if (event.key === 'ArrowLeft') rotation -= .12;
    if (event.key === 'ArrowRight') rotation += .12;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { tilt = clamp(tilt + (event.key === 'ArrowUp' ? .08 : -.08), -.95, .95); if (map) map = createSphereMap(map.size, tilt); }
    rotation = wrap(rotation, TAU); dirty = true; schedule();
  }, { signal });

  let exporting = false;
  const downloadUrls = new Set<string>();
  query<HTMLButtonElement>('#pb-export').addEventListener('click', async () => {
    if (exporting) return;
    exporting = true;
    const exportSettings = { ...settings }, textureSnapshot = textureSeed === settings.seed && !pendingTexture ? texture : null, requestSnapshot = textureRequest, exportRotation = rotation, exportCloudRotation = cloudRotation, exportTilt = tilt;
    const button = query<HTMLButtonElement>('#pb-export'); button.disabled = true;
    query('#pb-status').textContent = '正在生成高清 PNG…';
    // Let the pending UI paint before the bounded high-resolution raster pass.
    await new Promise<void>(resolve => setTimeout(resolve, 30));
    if (disposed) return;
    try {
      // Reuse the matching pending job. If a newer UI choice cancels that job,
      // cooperatively finish this explicitly requested export's frozen seed instead.
      const pendingResult = textureSnapshot ? null : await requestSnapshot?.catch(() => null);
      if (disposed) return;
      const exportTexture = textureSnapshot ?? pendingResult ?? await createTextureAsync(exportSettings.seed, 1024, 512, { signal });
      if (disposed) return;
      const output = document.createElement('canvas'); output.width = 1600; output.height = 1400;
      const outputContext = output.getContext('2d')!;
      const exportSphere = document.createElement('canvas'); exportSphere.width = 1000; exportSphere.height = 1000;
      const exportContext = exportSphere.getContext('2d')!;
      const pixels = exportContext.createImageData(1000, 1000);
      renderSphere(pixels.data, createSphereMap(1000, exportTilt), exportTexture, exportSettings, exportRotation, exportCloudRotation);
      exportContext.putImageData(pixels, 0, 0); paintScene(outputContext, 1600, 1400, exportSphere, true, exportSettings);
      const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG export failed');
      if (disposed) return;
      const url = URL.createObjectURL(blob); downloadUrls.add(url);
      const link = document.createElement('a'); link.href = url; link.download = `planet-${exportSettings.kind}-${exportSettings.seed}.png`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 30_000);
      query('#pb-status').textContent = 'PNG 已生成 · 1600 × 1400 · 查看浏览器下载';
    } catch { if (!disposed) query('#pb-status').textContent = '导出失败，请稍后重试或截屏保存'; }
    finally { exporting = false; button.disabled = false; }
  }, { signal });

  const resizeObserver = new ResizeObserver(measure); resizeObserver.observe(canvas);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) { previousTime = 0; schedule(); }
    else if (frameHandle) { cancelAnimationFrame(frameHandle); frameHandle = 0; previousTime = 0; }
  }, { rootMargin: '100px' }); intersectionObserver.observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frameHandle); frameHandle = 0; previousTime = 0; }
    else schedule();
  }, { signal });
  motion.addEventListener('change', () => { if (motion.matches) { playing = false; updatePlayback(); } }, { signal });
  function cleanup(): void {
    disposed = true; generation++; textureLoader.dispose(); cancelAnimationFrame(frameHandle); controller.abort(); resizeObserver.disconnect(); intersectionObserver.disconnect();
    downloadUrls.forEach(url => URL.revokeObjectURL(url)); downloadUrls.clear();
    texture = null; map = null;
  }
  // A bfcache page keeps its listeners and resumes naturally; a real unload releases buffers.
  window.addEventListener('pagehide', event => { if (!event.persisted) cleanup(); else { cancelAnimationFrame(frameHandle); frameHandle = 0; } }, { signal });
  window.addEventListener('pageshow', event => { if (event.persisted) { previousTime = 0; schedule(); } }, { signal });
  document.addEventListener('astro:before-swap', cleanup, { once: true, signal });
  syncControls(); measure(); updatePlayback(); regenerate(false);
}
