import { STEP, Timeline, radians, degrees, rk4, energy, positions, separation, type State, type Frame } from './physics';

const root = document.querySelector<HTMLElement>('#double-pendulum-lab');
if (root) {
  const el = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const canvas = el<HTMLCanvasElement>('dp-canvas'), ctx = canvas.getContext('2d');
  if (!ctx) { el('dp-status').textContent = '当前浏览器不支持 Canvas'; }
  else {
    const context = ctx, angle1 = el<HTMLInputElement>('dp-angle1'), angle2 = el<HTMLInputElement>('dp-angle2');
    const offset = el<HTMLSelectElement>('dp-offset'), speed = el<HTMLSelectElement>('dp-speed');
    const ensemble = el<HTMLInputElement>('dp-ensemble'), trails = el<HTMLInputElement>('dp-trails'), rewind = el<HTMLInputElement>('dp-rewind');
    const play = el<HTMLButtonElement>('dp-play'), status = el('dp-status');
    const timeline = new Timeline(), motion = matchMedia('(prefers-reduced-motion: reduce)');
    let current: Frame, selected = 0, initialEnergy = 0, playing = false, raf = 0, last = 0, accumulator = 0, steps = 0;
    let inViewport = true;
    let w = 600, h = 500, scale = 90, ox = 300, oy = 250, lastReadout = 0, drag = 0, activePointer = -1, disposed = false;
    function updateReadouts() {
      const s = current.states[0];
      el('dp-time').innerHTML = current.t.toFixed(2) + ' <span>s</span>';
      el('dp-distance').innerHTML = separation(s, current.states[1]).toFixed(4) + ' <span>m</span>';
      el('dp-error').innerHTML = (Math.abs(energy(s) - initialEnergy) / 29.43 * 100).toFixed(5) + ' <span>%</span>';
      rewind.max = String(Math.max(0, timeline.length - 1)); rewind.value = String(selected);
      el('dp-window').textContent = '最近 ' + (current.t - timeline.get(0).t).toFixed(1) + ' 秒';
      root!.dataset.time = current.t.toFixed(3); root!.dataset.count = String(current.states.length);
    }
    function pause(message = '已暂停 · 可拖动摆球') {
      playing = false; cancelAnimationFrame(raf); raf = 0; last = 0;
      play.textContent = '继续实验'; play.setAttribute('aria-pressed', 'false'); status.textContent = message;
      updateReadouts(); draw();
    }
    function reset(continuePlaying = playing) {
      cancelAnimationFrame(raf); raf = 0; playing = false; accumulator = 0; steps = 0; last = 0;
      const a = radians(Number(angle1.value)), b = radians(Number(angle2.value)), delta = radians(Number(offset.value));
      const states: State[] = [[a, b, 0, 0], [a, b + delta, 0, 0]];
      if (ensemble.checked) for (let i = 0; i < 16; i++) states.push([a, b + delta * (i - 7.5) / 8, 0, 0]);
      current = { t: 0, states }; timeline.clear(); timeline.push(current); selected = 0; initialEnergy = energy(states[0]);
      el('dp-angle1-value').textContent = angle1.value + '°'; el('dp-angle2-value').textContent = angle2.value + '°';
      play.textContent = '开始实验'; play.setAttribute('aria-pressed', 'false'); status.textContent = '准备就绪 · 拖动摆球';
      updateReadouts(); draw(); if (continuePlaying) start();
    }
    function start() {
      if (playing || disposed || document.hidden) return;
      timeline.truncate(selected); current = timeline.get(selected); accumulator = 0; steps = 0;
      playing = true; last = 0; play.textContent = '暂停实验'; play.setAttribute('aria-pressed', 'true');
      status.textContent = inViewport ? '正在释放 · RK4' : '画布在屏幕外 · 等待返回'; if (inViewport) raf = requestAnimationFrame(tick);
    }
    function tick(now: number) {
      if (!playing || disposed || !inViewport) return;
      if (!last) last = now;
      accumulator += Math.min((now - last) / 1000, 0.05) * Number(speed.value); last = now;
      // Fixed physical timestep; a slow frame slows wall-clock playback instead of destabilizing integration.
      let budget = 28;
      while (accumulator >= STEP && budget-- > 0) {
        current = { t: current.t + STEP, states: current.states.map(s => rk4(s)) };
        accumulator -= STEP;
        if (++steps % 4 === 0) { timeline.push(current); selected = timeline.length - 1; }
      }
      if (!current.states.every(s => s.every(Number.isFinite))) { reset(false); status.textContent = '数值状态已重置，请降低初始能量'; return; }
      if (now - lastReadout > 100) { updateReadouts(); lastReadout = now; }
      draw(); raf = requestAnimationFrame(tick);
    }
    const point = (x: number, y: number) => ({ x: ox + x * scale, y: oy + y * scale });
    function drawTrail(index: number, color: string, alpha: number) {
      if (!trails.checked || selected < 1) return;
      context.beginPath();
      const begin = Math.max(0, selected - (index < 2 ? 900 : 300));
      for (let i = begin; i <= selected; i += index < 2 ? 1 : 3) {
        const state = timeline.get(i).states[index]; if (!state) continue;
        const p = positions(state), v = point(p.x2, p.y2);
        if (i === begin) context.moveTo(v.x, v.y); else context.lineTo(v.x, v.y);
      }
      context.strokeStyle = color; context.globalAlpha = alpha; context.lineWidth = index < 2 ? 1.15 : 0.6; context.stroke(); context.globalAlpha = 1;
    }
    function drawPendulum(state: State, color: string, isPrimary: boolean) {
      const p = positions(state), a = point(p.x1, p.y1), b = point(p.x2, p.y2);
      context.lineCap = 'round';
      if (isPrimary) {
        context.beginPath(); context.moveTo(ox + 2, oy + 3); context.lineTo(a.x + 2, a.y + 3); context.lineTo(b.x + 2, b.y + 3);
        context.strokeStyle = '#080e0d'; context.lineWidth = 6; context.stroke();
      }
      context.beginPath(); context.moveTo(ox, oy); context.lineTo(a.x, a.y); context.lineTo(b.x, b.y);
      context.strokeStyle = color; context.lineWidth = isPrimary ? 2.5 : 1.5; context.globalAlpha = isPrimary ? 1 : 0.8; context.stroke(); context.globalAlpha = 1;
      for (const q of [a, b]) {
        context.beginPath(); context.arc(q.x, q.y, isPrimary ? 8 : 5.5, 0, Math.PI * 2);
        const fill = context.createRadialGradient(q.x - 3, q.y - 3, 0, q.x, q.y, 9);
        fill.addColorStop(0, isPrimary ? '#ffe1af' : '#c8eef0'); fill.addColorStop(0.55, color); fill.addColorStop(1, isPrimary ? '#8d6540' : '#407880');
        context.fillStyle = fill; context.fill();
        if (isPrimary) { context.strokeStyle = '#eac69844'; context.lineWidth = 1; context.beginPath(); context.arc(q.x, q.y, 13, 0, 2 * Math.PI); context.stroke(); }
      }
    }
    function draw() {
      if (!current || disposed || !inViewport) return;
      context.clearRect(0, 0, w, h);
      // Engraved instrument scale, intentionally understated behind the trajectories.
      context.lineWidth = 1; context.strokeStyle = '#dbe0c710';
      for (const radius of [scale, scale * 2]) { context.beginPath(); context.arc(ox, oy, radius, 0, Math.PI * 2); context.stroke(); }
      for (let i = 0; i < 72; i++) {
        const a = i * Math.PI / 36, r = scale * 2 + 7;
        context.beginPath(); context.moveTo(ox + Math.sin(a) * r, oy + Math.cos(a) * r); context.lineTo(ox + Math.sin(a) * (r + (i % 6 ? 3 : 7)), oy + Math.cos(a) * (r + (i % 6 ? 3 : 7))); context.stroke();
      }
      context.setLineDash([2, 6]); context.beginPath(); context.moveTo(ox, oy - 2 * scale); context.lineTo(ox, oy + 2 * scale); context.moveTo(ox - 2 * scale, oy); context.lineTo(ox + 2 * scale, oy); context.stroke(); context.setLineDash([]);
      context.font = '9px ui-monospace, monospace'; context.fillStyle = '#89958b'; context.textAlign = 'center';
      context.fillText('0°', ox, oy + 2 * scale + 27); context.fillText('180°', ox, oy - 2 * scale - 18);
      for (let i = 2; i < current.states.length; i++) drawTrail(i, i % 2 ? '#d6ae86' : '#87b7ba', 0.23);
      drawTrail(1, '#86c8d0', 0.8); drawTrail(0, '#e5b574', 0.8);
      drawPendulum(current.states[1], '#86c8d0', false); drawPendulum(current.states[0], '#e5b574', true);
      context.beginPath(); context.arc(ox, oy, 5, 0, Math.PI * 2); context.fillStyle = '#cbd4c8'; context.fill();
      context.beginPath(); context.arc(ox, oy, 2, 0, Math.PI * 2); context.fillStyle = '#27332c'; context.fill();
      context.textAlign = 'left'; context.fillStyle = '#8d9a90'; context.fillText('l₁ = l₂ = 1 m', 24, h - 22);
      context.textAlign = 'right'; context.fillText('Δθ₂ = ' + offset.value + '°', w - 24, h - 22);
    }
    const resize = new ResizeObserver(() => {
      const rect = canvas.getBoundingClientRect(); w = rect.width; h = rect.height;
      const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0); ox = w / 2; oy = h / 2 + 5; scale = Math.min((w - 78) / 4, (h - 120) / 4); draw();
    });
    resize.observe(canvas);
    const visibility = new IntersectionObserver(entries => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (visible === inViewport) return; inViewport = visible;
      if (!visible) { cancelAnimationFrame(raf); raf = 0; last = 0; if (playing) status.textContent = '画布在屏幕外 · 等待返回'; }
      else { draw(); if (playing && !document.hidden) { last = 0; status.textContent = '正在释放 · RK4'; raf = requestAnimationFrame(tick); } }
    }, { threshold: 0.01 });
    visibility.observe(canvas);

    play.addEventListener('click', () => playing ? pause() : start());
    el('dp-reset').addEventListener('click', () => reset(false));
    [angle1, angle2, offset, ensemble].forEach(input => input.addEventListener('input', () => reset()));
    trails.addEventListener('change', draw);
    rewind.addEventListener('input', () => { const next = Number(rewind.value); pause('回看中 · 继续将生成新分支'); selected = next; current = timeline.get(selected); updateReadouts(); draw(); });
    root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = button.dataset.preset; const values = preset === 'gentle' ? [18, 24] : preset === 'folded' ? [90, -160] : [125, 145];
      angle1.value = String(values[0]); angle2.value = String(values[1]); reset();
    }));
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      const rect = canvas.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      const p = positions(current.states[0]), a = point(p.x1, p.y1), b = point(p.x2, p.y2);
      drag = Math.hypot(x - b.x, y - b.y) < 30 ? 2 : Math.hypot(x - a.x, y - a.y) < 30 ? 1 : 0;
      if (!drag) return;
      pause('设置初始角度 · 松手后点击开始'); angle1.value = String(Math.round(degrees(current.states[0][0]))); angle2.value = String(Math.round(degrees(current.states[0][1])));
      reset(false); activePointer = event.pointerId; canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== activePointer) return;
      const rect = canvas.getBoundingClientRect(), p = positions(current.states[0]);
      const pivot = drag === 1 ? { x: ox, y: oy } : point(p.x1, p.y1);
      const a = Math.atan2(event.clientX - rect.left - pivot.x, event.clientY - rect.top - pivot.y);
      (drag === 1 ? angle1 : angle2).value = String(Math.round(degrees(a))); reset(false);
    });
    const finishDrag = (event: PointerEvent) => { if (event.pointerId === activePointer) { drag = 0; activePointer = -1; } }; canvas.addEventListener('pointerup', finishDrag); canvas.addEventListener('pointercancel', finishDrag); canvas.addEventListener('lostpointercapture', finishDrag);
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause('标签页已暂停 · 点击继续'); });
    motion.addEventListener('change', () => { if (motion.matches && playing) pause('减少动态效果 · 已暂停'); });
    window.addEventListener('pagehide', () => { pause(); });
    document.addEventListener('astro:before-swap', () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); visibility.disconnect(); }, { once: true });
    reset(!motion.matches);
  }
}
