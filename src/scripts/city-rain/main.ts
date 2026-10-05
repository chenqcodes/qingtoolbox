import { RainModel, COLS, ROWS, type Tile, type Preset } from './model';
interface Block { x: number; y: number; width: number; depth: number; height: number }
const root = document.querySelector<HTMLElement>('#city-rain-lab');
if (root) {
  const el = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const canvas = el<HTMLCanvasElement>('cr-canvas'), ctx = canvas.getContext('2d');
  if (!ctx) el('cr-status').textContent = '当前浏览器不支持 Canvas';
  else {
    const context = ctx, model = new RainModel(), rain = el<HTMLInputElement>('cr-rain'), drain = el<HTMLInputElement>('cr-drain');
    const play = el<HTMLButtonElement>('cr-play'), status = el('cr-status'), flow = el<HTMLInputElement>('cr-flow'), size = el<HTMLSelectElement>('cr-brush-size');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let w = 700, h = 535, tw = 20, th = 10, ox = 280, oy = 100, playing = false, disposed = false;
    let inViewport = true;
    let raf = 0, last = 0, accumulator = 0, lastReadout = 0, brush: Tile = 1, drawing = false, activePointer = -1, edits = 0;
    let cursor: { x: number; y: number } | null = null, previous: { x: number; y: number } | null = null;
    let blocks: Block[] = [];
    const names = ['地面', '街道', '建筑', '绿地', '排水口'];
    model.preset('neighborhood');
    function rebuildBlocks() {
      const visited = new Uint8Array(COLS * ROWS); blocks = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const i = model.index(x, y); if (model.tiles[i] !== 2 || visited[i]) continue;
        let width = 1, depth = 1;
        while (x + width < COLS && width < 6 && model.tiles[model.index(x + width, y)] === 2 && !visited[model.index(x + width, y)]) width++;
        outer: while (y + depth < ROWS && depth < 6) {
          for (let xx = x; xx < x + width; xx++) if (model.tiles[model.index(xx, y + depth)] !== 2 || visited[model.index(xx, y + depth)]) break outer;
          depth++;
        }
        for (let yy = y; yy < y + depth; yy++) for (let xx = x; xx < x + width; xx++) visited[model.index(xx, yy)] = 1;
        blocks.push({ x, y, width, depth, height: 1.1 + ((x * 7 + y * 13) % 5) * 0.22 });
      }
      blocks.sort((a, b) => (a.x + a.y + a.width + a.depth) - (b.x + b.y + b.width + b.depth));
    }
    function readouts() {
      const info = model.summary();
      el('cr-time').innerHTML = model.time.toFixed(1) + ' <span>s</span>';
      el('cr-coverage').innerHTML = (info.coverage * 100).toFixed(0) + ' <span>%</span>';
      el('cr-maximum').textContent = info.maximum.toFixed(3);
      el('cr-budget-rain').textContent = model.budget.rain.toFixed(1);
      el('cr-budget-stored').textContent = info.total.toFixed(1);
      el('cr-budget-removed').textContent = (model.budget.drained + model.budget.infiltrated).toFixed(1);
      el('cr-budget-overflow').textContent = model.budget.overflow.toFixed(1);
      root!.dataset.time = model.time.toFixed(2); root!.dataset.water = info.total.toFixed(5);
      root!.dataset.balance = info.balance.toExponential(2); root!.dataset.edits = String(edits);
      el('cr-rain-value').textContent = rain.value + ' / 100'; el('cr-drain-value').textContent = drain.value + ' / 100';
    }
    function pause(message = '已暂停 · 可以编辑城市') {
      playing = false; last = 0; cancelAnimationFrame(raf); raf = 0; play.textContent = '继续模拟'; play.setAttribute('aria-pressed', 'false'); status.textContent = message; readouts(); draw();
    }
    function start() {
      if (playing || disposed || document.hidden) return;
      playing = true; last = 0; accumulator = 0; play.textContent = '暂停模拟'; play.setAttribute('aria-pressed', 'true');
      status.textContent = !inViewport ? '画布在屏幕外 · 等待返回' : Number(rain.value) ? '正在降雨 · 观察汇流' : '雨已停 · 继续排水'; if (inViewport) raf = requestAnimationFrame(tick);
    }
    function tick(now: number) {
      if (!playing || disposed || !inViewport) return;
      if (!last) last = now;
      accumulator += Math.min(0.1, (now - last) / 1000); last = now;
      while (accumulator >= 0.05) { model.step(0.05, Number(rain.value), Number(drain.value)); accumulator -= 0.05; }
      if (now - lastReadout > 150) { readouts(); lastReadout = now; }
      draw(); raf = requestAnimationFrame(tick);
    }
    function project(x: number, y: number, z = 0) { return { x: ox + (x - y) * tw / 2, y: oy + (x + y) * th / 2 - z * tw }; }
    function polygon(points: {x: number; y: number}[], fill: string, stroke?: string) {
      context.beginPath(); points.forEach((p, i) => i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)); context.closePath(); context.fillStyle = fill; context.fill();
      if (stroke) { context.strokeStyle = stroke; context.lineWidth = 0.6; context.stroke(); }
    }
    function tile(x: number, y: number, fill: string) { polygon([project(x, y), project(x + 1.02, y), project(x + 1.02, y + 1.02), project(x, y + 1.02)], fill); }
    function line(a: {x: number; y: number}, b: {x: number; y: number}, color: string, width = 1) {
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.strokeStyle = color; context.lineWidth = width; context.stroke();
    }
    function building(b: Block) {
      const { x, y, width: bw, depth: bd, height: bh } = b;
      const a = project(x, y, bh), c = project(x + bw, y, bh), d = project(x + bw, y + bd, bh), e = project(x, y + bd, bh);
      polygon([c, project(x + bw, y), project(x + bw, y + bd), d], '#738a8b');
      polygon([e, d, project(x + bw, y + bd), project(x, y + bd)], '#506e72');
      polygon([a, c, d, e], '#bbc7bb', '#cfdbc840');
      // Raised roof rim, plant-room and fine facade bays turn grid footprints into architecture.
      const inset = 0.18;
      polygon([project(x + inset, y + inset, bh + 0.025), project(x + bw - inset, y + inset, bh + 0.025), project(x + bw - inset, y + bd - inset, bh + 0.025), project(x + inset, y + bd - inset, bh + 0.025)], '#a5b6ab');
      if (bw > 1 && bd > 1) {
        polygon([project(x + bw * .3, y + bd * .3, bh + .15), project(x + bw * .65, y + bd * .3, bh + .15), project(x + bw * .65, y + bd * .62, bh + .15), project(x + bw * .3, y + bd * .62, bh + .15)], '#c5cdbd');
        line(project(x + bw * .3, y + bd * .62, bh + .15), project(x + bw * .65, y + bd * .62, bh + .15), '#8c9f97', 1);
      }
      for (let z = .35; z < bh - .18; z += .4) {
        for (let xx = .35; xx < bw - .15; xx += .6) line(project(x + xx, y + bd + .015, z), project(x + xx + .22, y + bd + .015, z), '#bad2c58c', Math.max(1, tw * .075));
        for (let yy = .35; yy < bd - .15; yy += .6) line(project(x + bw + .015, y + yy, z), project(x + bw + .015, y + yy + .22, z), '#d4dfc999', Math.max(1, tw * .07));
      }
    }
    function tree(x: number, y: number) {
      const p = project(x + .5, y + .5), r = tw * .28;
      context.fillStyle = '#0b282730'; context.beginPath(); context.ellipse(p.x + 4, p.y + 2, r * 1.1, r * .5, 0, 0, 2 * Math.PI); context.fill();
      line(p, { x: p.x, y: p.y - r * 1.5 }, '#839d82', 1.3);
      for (const [dx, dy, color] of [[-.15, -.9, '#6f9c80'], [.2, -1.25, '#84aa83'], [0, -1.55, '#a1bb8b']] as [number, number, string][]) {
        context.fillStyle = color; context.beginPath(); context.arc(p.x + dx * r, p.y + dy * r, r * .65, 0, Math.PI * 2); context.fill();
      }
    }
    function draw() {
      if (disposed || !inViewport) return;
      context.clearRect(0, 0, w, h);
      const a = project(0, 0), b = project(COLS, 0), c = project(COLS, ROWS), d = project(0, ROWS);
      // Cutaway plinth and soft projected building shadows.
      polygon([d, c, { x: c.x, y: c.y + 13 }, { x: d.x, y: d.y + 13 }], '#304943');
      polygon([b, c, { x: c.x, y: c.y + 13 }, { x: b.x, y: b.y + 13 }], '#426056');
      polygon([a, b, c, d], '#799384');
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const i = model.index(x, y), type = model.tiles[i], variation = (x * 7 + y * 11) % 4;
        tile(x, y, type === 1 || type === 4 ? '#536f72' : type === 3 ? ['#688c6f', '#729777', '#789c7a', '#6d9375'][variation] : ['#889c85', '#859982', '#899f89', '#8ca18a'][variation]);
        if (type === 1 && x % 2 === 0 && y % 2 === 0) line(project(x + .2, y + .5), project(x + .75, y + .5), '#c4d0b64a', 0.7);
        if (type === 4) {
          const p = project(x + .5, y + .5);
          context.beginPath(); context.ellipse(p.x, p.y, tw * .26, th * .26, 0, 0, Math.PI * 2); context.fillStyle = '#193b42'; context.fill(); context.strokeStyle = '#aad6c0'; context.lineWidth = 1.2; context.stroke();
        }
      }
      for (const block of blocks) {
        const x = block.x, y = block.y, bw = block.width, bd = block.depth;
        polygon([project(x, y + bd), project(x + bw, y + bd), project(x + bw + 1.2, y + bd + 1), project(x + .7, y + bd + 1)], '#18312f25');
      }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const i = model.index(x, y), depth = model.water[i];
        if (depth > .002 && model.tiles[i] !== 2) {
          const ratio = Math.min(1, depth / .45), alpha = Math.min(.8, .12 + ratio * .7);
          tile(x, y, 'rgba(' + Math.round(68 - ratio * 34) + ',' + Math.round(163 - ratio * 55) + ',' + Math.round(186 - ratio * 29) + ',' + alpha + ')');
        }
      }
      if (flow.checked) for (let y = 1; y < ROWS; y += 3) for (let x = 1; x < COLS; x += 3) {
        const i = model.index(x, y), dx = model.flowX[i], dy = model.flowY[i], length = Math.hypot(dx, dy);
        if (model.water[i] < .015 || length < .00001) continue;
        const s = project(x + .5, y + .5), e = project(x + .5 + dx / length * .7, y + .5 + dy / length * .7);
        line(s, e, '#c6e5dfaa', Math.max(.8, tw * .04));
        const ang = Math.atan2(e.y - s.y, e.x - s.x), len = tw * .15;
        line(e, { x: e.x - Math.cos(ang - .5) * len, y: e.y - Math.sin(ang - .5) * len }, '#c6e5dfaa', .8);
        line(e, { x: e.x - Math.cos(ang + .5) * len, y: e.y - Math.sin(ang + .5) * len }, '#c6e5dfaa', .8);
      }
      const objects: { order: number; render: () => void }[] = blocks.map(block => ({ order: block.x + block.y + block.width + block.depth, render: () => building(block) }));
      for (let y = 1; y < ROWS; y += 2) for (let x = 1; x < COLS; x += 2) if (model.tiles[model.index(x, y)] === 3) objects.push({ order: x + y + 1, render: () => tree(x, y) });
      objects.sort((a, b) => a.order - b.order).forEach(object => object.render());
      if (cursor) {
        const radius = brush === 4 ? 0 : Number(size.value), left = Math.max(0, cursor.x - radius), top = Math.max(0, cursor.y - radius);
        const right = Math.min(COLS, cursor.x + radius + 1), bottom = Math.min(ROWS, cursor.y + radius + 1);
        polygon([project(left, top, .03), project(right, top, .03), project(right, bottom, .03), project(left, bottom, .03)], '#edf8ce25', '#f0f4c4');
      }
      if (playing && Number(rain.value) > 0 && !reduced.matches) {
        context.strokeStyle = '#b7d9de38'; context.lineWidth = .75;
        const count = Math.round(Number(rain.value) * .8);
        for (let i = 0; i < count; i++) {
          const x = ((i * 137.51 + model.time * 35) % (w + 50)) - 25, y = (i * 79.3 + model.time * 240) % h;
          context.beginPath(); context.moveTo(x, y); context.lineTo(x - 3, y + 11); context.stroke();
        }
      }
      context.fillStyle = '#bdd2c28c'; context.font = '9px ui-monospace, monospace'; context.textAlign = 'left';
      const label = project(0, ROWS); context.fillText('MODEL / 32 × 24', Math.max(15, label.x), Math.min(h - 20, label.y + 40));
      context.textAlign = 'right'; const right = project(COLS, 0); context.fillText('N ↗', Math.min(w - 20, right.x + 5), right.y - 22);
    }
    function hit(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect(), px = clientX - rect.left, py = clientY - rect.top;
      const inside = (points: { x: number; y: number }[]) => {
        let result = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const a = points[i], b = points[j];
          if ((a.y > py) !== (b.y > py) && px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x) result = !result;
        }
        return result;
      };
      const clampCell = (x: number, y: number, b: Block) => ({
        x: Math.max(b.x, Math.min(b.x + b.width - 1, Math.floor(x))),
        y: Math.max(b.y, Math.min(b.y + b.depth - 1, Math.floor(y))),
      });
      // Resolve visible architecture before the ground plane, back-to-front.
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i], { x, y, width: bw, depth: bd, height: bh } = b;
        const a = project(x, y, bh), c = project(x + bw, y, bh), d = project(x + bw, y + bd, bh), e = project(x, y + bd, bh);
        if (inside([a, c, d, e])) {
          const dx = (px - ox) / (tw / 2), dy = (py - oy + bh * tw) / (th / 2);
          return clampCell((dx + dy) / 2, (dy - dx) / 2, b);
        }
        if (inside([c, project(x + bw, y), project(x + bw, y + bd), d])) return clampCell(x + bw - 1, x + bw - 2 * (px - ox) / tw, b);
        if (inside([e, d, project(x + bw, y + bd), project(x, y + bd)])) return clampCell(y + bd + 2 * (px - ox) / tw, y + bd - 1, b);
      }
      const dx = (px - ox) / (tw / 2), dy = (py - oy) / (th / 2);
      const x = Math.floor((dx + dy) / 2), y = Math.floor((dy - dx) / 2);
      return x >= 0 && x < COLS && y >= 0 && y < ROWS ? { x, y } : null;
    }
    function paintAt(p: {x: number; y: number}) {
      const radius = brush === 4 ? 0 : Number(size.value);
      const from = previous || p, steps = Math.max(Math.abs(p.x - from.x), Math.abs(p.y - from.y), 1);
      for (let i = 0; i <= steps; i++) model.paint(Math.round(from.x + (p.x - from.x) * i / steps), Math.round(from.y + (p.y - from.y) * i / steps), brush, radius);
      previous = p; cursor = p; edits++; rebuildBlocks(); readouts();
      el('cr-edit-help').textContent = '已绘制' + names[brush] + ' · 第 ' + (p.x + 1) + ' 列，第 ' + (p.y + 1) + ' 行。雨水重新分配，超容量部分计入溢出。';
      draw();
    }
    const resize = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect(); w = r.width; h = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0); tw = Math.min((w - 40) / ((COLS + ROWS) / 2), (h - 140) / ((COLS + ROWS) / 4)); th = tw / 2;
      ox = (w - (COLS + ROWS) * tw / 2) / 2 + ROWS * tw / 2; oy = (h - (COLS + ROWS) * th / 2) / 2 + 25; draw();
    });
    resize.observe(canvas);
    const visibility = new IntersectionObserver(entries => {
      // Several crossings for this canvas can arrive together (for example,
      // capture/resize then restoration). Older entries must not overwrite the
      // final observation, or Resume can wait forever for an event already sent.
      let latest: IntersectionObserverEntry | undefined;
      for (const entry of entries) {
        if (entry.target === canvas && (!latest || entry.time >= latest.time)) latest = entry;
      }
      if (!latest || disposed) return;
      const visible = latest.isIntersecting;
      if (visible === inViewport) return; inViewport = visible;
      if (!visible) { cancelAnimationFrame(raf); raf = 0; last = 0; if (playing) status.textContent = '画布在屏幕外 · 等待返回'; }
      else { draw(); if (playing && !document.hidden) { last = 0; status.textContent = Number(rain.value) ? '正在降雨 · 观察汇流' : '雨已停 · 继续排水'; raf = requestAnimationFrame(tick); } }
    }, { threshold: 0.01 });
    visibility.observe(canvas);

    play.addEventListener('click', () => playing ? pause() : start());
    el('cr-clear').addEventListener('click', () => { pause(); model.resetWater(); readouts(); draw(); play.textContent = '开始降雨'; status.textContent = '雨水已清空 · 地图保留'; });
    [rain, drain].forEach(input => input.addEventListener('input', () => { readouts(); if (playing) status.textContent = Number(rain.value) ? '正在降雨 · 观察汇流' : '雨已停 · 继续排水'; draw(); }));
    flow.addEventListener('change', draw); size.addEventListener('change', draw);
    root.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(button => button.addEventListener('click', () => {
      brush = Number(button.dataset.brush) as Tile;
      root.querySelectorAll<HTMLButtonElement>('[data-brush]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      el('cr-edit-help').textContent = '当前工具：' + names[brush] + (brush === 4 ? '（单格）' : '') + '。点击或拖动绘制；方向键选格，空格绘制。'; draw();
    }));
    root.querySelectorAll<HTMLButtonElement>('[data-city]').forEach(button => button.addEventListener('click', () => {
      pause(); model.preset(button.dataset.city as Preset); cursor = null; previous = null; rebuildBlocks(); readouts(); draw(); status.textContent = button.textContent + ' · 等待降雨'; play.textContent = '开始降雨';
    }));
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      const p = hit(event.clientX, event.clientY); if (!p) return;
      pause('编辑中 · 点击继续观察'); drawing = true; activePointer = event.pointerId; previous = null; canvas.setPointerCapture(event.pointerId); paintAt(p);
    });
    canvas.addEventListener('pointermove', event => {
      if (drawing && event.pointerId !== activePointer) return;
      const p = hit(event.clientX, event.clientY); cursor = p;
      if (drawing && p) paintAt(p); else if (!playing) draw();
    });
    const end = (event: PointerEvent) => { if (event.pointerId === activePointer) { drawing = false; previous = null; activePointer = -1; } };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('pointerleave', () => { if (!drawing) { cursor = null; if (!playing) draw(); } });
    canvas.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); if (!cursor) cursor = { x: 15, y: 12 }; pause('键盘编辑 · 方向键选格');
      if (event.key === 'ArrowLeft') cursor.x = Math.max(0, cursor.x - 1);
      if (event.key === 'ArrowRight') cursor.x = Math.min(COLS - 1, cursor.x + 1);
      if (event.key === 'ArrowUp') cursor.y = Math.max(0, cursor.y - 1);
      if (event.key === 'ArrowDown') cursor.y = Math.min(ROWS - 1, cursor.y + 1);
      if (event.key === ' ' || event.key === 'Enter') { previous = null; paintAt(cursor); previous = null; }
      else { const i = model.index(cursor.x, cursor.y); el('cr-edit-help').textContent = '选中第 ' + (cursor.x + 1) + ' 列，第 ' + (cursor.y + 1) + ' 行；当前是' + names[model.tiles[i]] + '，模型水深 ' + model.water[i].toFixed(3) + '；空格绘制' + names[brush] + '。'; }
      draw();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause('标签页已暂停 · 点击继续'); });
    reduced.addEventListener('change', () => { if (reduced.matches && playing) pause('减少动态效果 · 已暂停'); });
    window.addEventListener('pagehide', () => pause());
    document.addEventListener('astro:before-swap', () => { disposed = true; cancelAnimationFrame(raf); resize.disconnect(); visibility.disconnect(); }, { once: true });
    rebuildBlocks(); readouts(); draw(); if (!reduced.matches) start();
  }
}
