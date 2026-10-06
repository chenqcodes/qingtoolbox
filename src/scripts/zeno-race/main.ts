import { DEFAULT_RACE, MAX_STAGES, meetingTime, positionsAt, stageAt, nextStage, observationEnd, cameraForGap, pursuitFrame, pursuitTime, groundAnchor, formatLogDistance, type RaceParameters, type Stage, type StepStop } from './model';

const root = document.querySelector<HTMLElement>('#zeno-race-lab');
if (root) {
  const el = <T extends Element = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const text = (id: string, value: string) => { el(id).textContent = value; };
  const format = (value: number, digits = 6): string => {
    if (!Number.isFinite(value)) return '超出显示范围';
    if (value === 0) return '0';
    if (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6) return value.toExponential(2).replace('e+', 'e');
    return String(Number(value.toFixed(digits)));
  };
  const logTime = (value: number | null): string => {
    if (value === null) return '不会追上';
    if (value === -Infinity) return '0 s';
    if (value > -9 && value < 14) return `${format(Math.exp(value))} s`;
    let exponent = Math.floor(value / Math.LN10), mantissa = Number(Math.exp(value - exponent * Math.LN10).toFixed(2));
    if (mantissa >= 10) { mantissa = 1; exponent++; }
    return `${mantissa} × 10^${exponent} s`;
  };
  const isDefault = () => p.lead === 10 && p.rabbit === 10 && p.turtle === 1;
  let p: RaceParameters = { ...DEFAULT_RACE };
  let mode: 'steps' | 'continuous' = 'steps';
  let stage: Stage = stageAt(p, 0), time = 0, running = false, frame = 0, lastFrame: number | null = null;
  let pending: Stage | null = null, progress = 0, autoplay = false, resumeAutoplay = false, historyKey = '';
  let phase: 'idle' | 'chase' = 'idle', phaseTime = 0;
  const STEP_SECONDS = 2.8;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const play = el<HTMLButtonElement>('zr-play'), next = el<HTMLButtonElement>('zr-next');
  const scrub = el<HTMLInputElement>('zr-scrub'), explanation = el<HTMLDetailsElement>('zr-explanation');
  const ns = 'http://www.w3.org/2000/svg';
  const svgElement = (tag: string, attrs: Record<string, string | number>, value?: string): SVGElement => {
    const node = document.createElementNS(ns, tag);
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, String(val));
    if (value) node.textContent = value;
    return node;
  };
  const horizon = () => Math.min(Math.max(observationEnd(p), stage.time * 1.12), Number.MAX_VALUE / (Math.max(p.rabbit, p.turtle, 1) + 1) / 4);
  const announce = (message: string) => text('zr-status', message);
  function pause(discard = false) {
    if (running && mode === 'steps') resumeAutoplay = autoplay;
    running = false; autoplay = false; cancelAnimationFrame(frame); frame = 0; lastFrame = null;
    if (discard) { pending = null; progress = 0; phase = 'idle'; phaseTime = 0; resumeAutoplay = false; }
    root!.dataset.running = 'false';
  }
  function stopCopy(reason: StepStop): string {
    if (reason === 'already-met') return p.lead === 0 ? '起点已经相遇，不需要逐段追赶。' : '乌龟不动，兔子第一段就已追上。';
    if (reason === 'stationary-rabbit') return '兔子速度为 0，不能到达乌龟的旧位置。';
    if (reason === 'stage-cap') return `已展示 ${MAX_STAGES} 个有限步骤。这是页面展示上限，没有完成“无穷步”；数学上仍有下一段。`;
    if (reason === 'resolution') return '这组参数已经超出页面的数值范围，停在最后一个可表示的步骤，没有完成“无穷步”。';
    return '';
  }
  function renderTimeline(end: number, limit: number | null) {
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const start = mobile ? 12 : 150, width = mobile ? 414 : 900, x = (t: number) => start + Math.min(1, Math.max(0, t / end)) * width;
    el('zr-timeline').setAttribute('viewBox', mobile ? '0 0 440 180' : '0 0 1100 180');
    el('zr-continuous-baseline').setAttribute('d', `M${start} 117H${start + width + (mobile ? 0 : 10)}`);
    el('zr-axis-zero').setAttribute('x', String(start));
    el('zr-axis-end').setAttribute('x', String(start + width));
    const axisLabels = root!.querySelectorAll<SVGTextElement>('.zr-axis-label');
    axisLabels[0].setAttribute('y', mobile ? '18' : '51'); axisLabels[1].setAttribute('y', mobile ? '91' : '121');
    const hasLimit = limit !== null;
    const meetX = hasLimit ? x(limit) : x(end);
    const line = el<SVGGElement>('zr-limit-line'); line.style.display = hasLimit ? '' : 'none'; line.setAttribute('transform', `translate(${meetX} 0)`);
    el('zr-limit-axis-text').setAttribute('text-anchor', limit === 0 ? 'start' : 'middle');
    text('zr-limit-axis-text', limit === 0 ? '起点已相遇' : `相遇 ${format(limit ?? 0)} s`);
    text('zr-axis-end', `${format(end)} s →`);
    el('zr-snapshot-baseline').setAttribute('d', `M${start} 47H${hasLimit ? meetX : x(end)}`);
    const future = el('zr-future-region'); future.replaceChildren();
    if (hasLimit && limit > 0) {
      future.append(svgElement('rect', { x: meetX, y: 24, width: x(end) - meetX, height: 112, fill: 'url(#zr-future-hatch)', rx: 3 }));
      future.append(svgElement('text', { x: (meetX + x(end)) / 2, y: 83, 'text-anchor': 'middle', fill: '#9b83a8', 'font-size': 12 }, mobile ? '继续 →' : '时间仍会继续 →'));
    }
    const segments = el('zr-segments'), snapshots = el('zr-snapshots'); segments.replaceChildren(); snapshots.replaceChildren();
    snapshots.append(svgElement('circle', { cx: start, cy: 47, r: 4, fill: '#b6a2c1' }));
    const count = Math.min(stage.index, 24);
    for (let i = 1; i <= count; i++) {
      const s = stageAt(p, i), prev = stageAt(p, i - 1), left = x(prev.time), right = x(s.time);
      segments.append(svgElement('path', { d: `M${left} 47H${right}`, stroke: i % 2 ? '#b5a0c0' : '#ddc89f', 'stroke-width': 8 }));
      snapshots.append(svgElement('circle', { cx: right, cy: 47, r: 4, fill: '#8f729d', stroke: '#fff', 'stroke-width': 1 }));
      if (!mobile && right - left > 68) snapshots.append(svgElement('text', { x: (left + right) / 2, y: 27, fill: '#967aa4', 'font-size': 12, 'text-anchor': 'middle' }, `第 ${i} 段 · ${format(s.duration)} s`));
    }
    if (stage.index > count) snapshots.append(svgElement('circle', { cx: x(stage.time), cy: 47, r: 4, fill: '#8f729d', stroke: '#fff', 'stroke-width': 1 }));
    if (limit !== null && limit > 0 && stage.time < limit) {
      segments.append(svgElement('path', { d: `M${x(stage.time)} 47H${meetX}`, stroke: '#cfb881', 'stroke-width': 4, 'stroke-dasharray': '3 3' }));
    }
    el('zr-live-progress').setAttribute('d', `M${start} 117H${x(time)}`); el('zr-time-cursor').setAttribute('cx', String(x(time)));
    const sequence = el('zr-sequence'); sequence.replaceChildren();
    const chip = (value: string, hint = false) => { const item = document.createElement('span'); item.textContent = value; if (hint) item.className = 'zr-sequence-hint'; sequence.append(item); };
    chip('起点 0 s');
    for (let i = 1; i <= Math.min(stage.index, 3); i++) chip(`第 ${i} 张 · ${format(stageAt(p, i).time)} s`);
    if (stage.index > 4) chip('…', true);
    if (stage.index > 3) chip(`第 ${stage.index} 张 · ${format(stage.time)} s`);
    if (stage.index === 0) chip(mode === 'steps' ? '每按一次，新增一个有限编号的时刻' : '上方还没有选定的截图；下方时钟已经可以继续', true);
    else if (p.lead > 0 && p.rabbit > p.turtle && p.turtle > 0) chip('编号没有最后一项 · 相遇不在这份截图清单中', true);
  }
  function renderGap() {
    const ratio = p.rabbit > 0 ? p.turtle / p.rabbit : 1;
    const moving = !!pending && !reducedMotion.matches;
    const scene = pursuitFrame(p, stage.index, moving ? progress : 0);
    const { rabbitX: left, turtleX: right, screenGap, logGap, logPixelsPerMetre,
      glyphScale: scale, bodyOpacity, pointMix } = scene;
    const magnification = logGap === -Infinity ? 0 : logPixelsPerMetre - Math.log(560 / p.lead);
    // Positions and ground use one affine projection. Animals are deliberately
    // screen-space schematics that shrink gently into persistent position dots.
    const bob = moving ? Math.sin((stage.index + progress) * Math.PI * 10) * 2.5 * scale : 0;
    el('zr-camera').setAttribute('transform', 'matrix(1 0 0 1 0 0)');
    for (const [id, x, shift] of [['zr-rabbit', left, -44], ['zr-turtle', right, 44]] as const) {
      const bodyY = 235 - 11 * scale;
      const group = el(id); group.setAttribute('transform', `translate(${x} ${bodyY})`);
      const whole = group.querySelector('.zr-whole')!, head = group.querySelector('.zr-head')!, point = group.querySelector('.zr-point')!;
      whole.setAttribute('transform', `translate(${shift * scale} ${id === 'zr-rabbit' ? bob : bob * .25}) scale(${scale})`);
      whole.setAttribute('opacity', String(bodyOpacity)); head.setAttribute('opacity', '0');
      point.setAttribute('transform', `translate(0 ${224 - bodyY})`); point.setAttribute('r', '5');
      point.setAttribute('opacity', String(pointMix));
    }
    const world = el('zr-world'), grid = el('zr-ground-grid'); world.replaceChildren();
    world.setAttribute('transform', 'translate(0 0)');
    const anchor = groundAnchor(p, stage.index, scene);
    world.append(svgElement('rect', { x: 0, y: 100, width: 900, height: 280, fill: '#f1eee7' }));
    grid.replaceChildren();
    // Nested metric grids keep a single physical origin. Coarse lines expand
    // continuously while finer divisions fade in; neither spacing nor origin
    // resets at an integer stage. This is the visible witness of magnification.
    const decade = Math.floor((Math.log(70) - logPixelsPerMetre) / Math.LN10);
    for (let level = decade - 1; level <= decade + 2; level++) {
      const spacing = Math.exp(level * Math.LN10 + logPixelsPerMetre);
      const opacity = Math.max(0, Math.min(1, (spacing - 12) / 42, (1800 - spacing) / 1300));
      if (!opacity || !Number.isFinite(spacing) || spacing <= 0) continue;
      let lines = '';
      const firstX = ((anchor % spacing) + spacing) % spacing;
      for (let x = firstX; x <= 900; x += spacing) lines += `M${x} 100V380`;
      const firstY = 100 + ((135 % spacing) + spacing) % spacing;
      for (let y = firstY; y <= 380; y += spacing) lines += `M0 ${y}H900`;
      grid.append(svgElement('path', { d: lines, stroke: '#a49e8d', 'stroke-width': 1, opacity: opacity * .28, fill: 'none', 'data-world-unit': level }));
    }
    world.append(grid);
    world.append(svgElement('path', { d: 'M0 235H900', stroke: '#9f9c89', 'stroke-width': 1.5 }));
    world.append(svgElement('path', { id: 'zr-ground-landmark', d: `M${anchor} 235v12m-5-5h10`, stroke: '#89946d', 'stroke-width': 1.5, opacity: .6, fill: 'none' }));
    el('zr-gap-wash').setAttribute('x', String(left)); el('zr-gap-wash').setAttribute('width', String(screenGap));
    el('zr-gap-wash').setAttribute('y', '229'); el('zr-gap-wash').setAttribute('height', '6'); el('zr-gap-wash').setAttribute('opacity', '1');
    el('zr-gap-bracket').setAttribute('d', `M${left} 259v9H${right}v-9`);
    el('zr-gap-svg').setAttribute('x', String((left + right) / 2)); el('zr-gap-svg').setAttribute('y', '300');
    const distance = formatLogDistance(logGap);
    text('zr-gap', distance); text('zr-gap-svg', distance);
    text('zr-gap-label', logGap === -Infinity ? '此刻间距' : '还差');
    text('zr-gap-context', p.lead === 0 || logGap === -Infinity ? '这组条件下，它们已经相遇' : p.rabbit <= p.turtle ? '这组速度下，间距不会收敛到零' : '一直向前，镜头也一直靠近');
    const unit = distance.split(' ').at(-1) ?? 'm';
    const scaleNames: Record<string, string> = { m: '米的尺度', cm: '厘米的尺度', mm: '毫米的尺度', 'μm': '微米的尺度', nm: '纳米的尺度', pm: '皮米的尺度' };
    text('zr-scale-label', logGap === -Infinity ? '已经相遇' : distance.includes('e-') ? '继续细分 · 数学尺度' : scaleNames[unit] ?? '数学尺度');
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    el('zr-gap-svg').setAttribute('font-size', mobile ? '28' : '20');
    el('zr-ruler-value').setAttribute('font-size', mobile ? '24' : '13');
    el('zr-old-label').setAttribute('font-size', mobile ? '23' : '14');
    const zoomPower = magnification / Math.LN10;
    text('zr-camera-label', logGap === -Infinity ? '两者已经相遇' : `${ratio < 1 && p.turtle > 0 ? '连续放大' : '跟随镜头'} · ×${Math.abs(zoomPower) < 3 ? format(10 ** zoomPower, 1) : `10^${format(zoomPower, 1)}`}`);
    text('zr-ruler-value', logGap === -Infinity ? '位置标记已重合' : `${formatLogDistance(Math.log(120) - logPixelsPerMetre)} / 标尺`);
    const showMarker = p.lead > 0 && logGap !== -Infinity;
    // Stage markers cross-fade through zero at their handover; no dashed line
    // teleports while the moving scene, lens, and animal silhouettes continue.
    const markerOpacity = !showMarker ? 0 : stage.index === 0 ? Math.min(1, (1 - progress) * 8)
      : moving ? Math.min(1, progress * 8, (1 - progress) * 8) : 0;
    const targetX = scene.targetX;
    el('zr-old-marker').setAttribute('d', `M${targetX} 150V250`); el('zr-old-marker').setAttribute('opacity', String(markerOpacity * .65));
    el('zr-old-label').setAttribute('x', String(Math.min(775, Math.max(120, targetX)))); el('zr-old-label').setAttribute('opacity', String(markerOpacity));
    text('zr-old-label', '乌龟这一段的旧位置');
    for (const [id, x] of [['zr-rabbit-pin', left], ['zr-turtle-pin', right]] as const) {
      el(id).setAttribute('cx', String(x)); el(id).setAttribute('r', '2.5');
    }
    const outlines = el('zr-history-outlines'); outlines.replaceChildren();
    if (showMarker && markerOpacity) outlines.append(svgElement('path', {
      d: `M${scene.originRabbitX} 236H${left}`, stroke: '#ae91b9', 'stroke-width': 3, opacity: .3 * markerOpacity }));
    text('zr-stage-label', logGap === -Infinity ? stage.index ? `第 ${stage.index} 段 · 已追上` : '起点 · 已经相遇'
      : moving ? `第 ${stage.index + 1} 段 · 连续追赶` : stage.index ? `第 ${stage.index} 段 · 还差一点` : '起点 · 第 0 段');
    text('zr-phase-label', logGap === -Infinity ? '位置重合，已经追上了' : ratio < 1 ? '边追近，边放大 · 脚步不停' : '连续向前 · 观察间距');
    let observation = moving ? `脚步没有停，镜头也在靠近。现在还差 ${distance}。`
      : stage.index ? `到过一个旧位置，仍然还差 ${distance}。` : '兔子向前追，镜头随它靠近。格线会展开，间距会缩小。';
    if (p.lead === 0) observation = '起点就已相遇。这里没有需要追赶的领先距离。';
    else if (p.rabbit === 0) observation = '兔子不动，连乌龟的第一个旧位置也到不了。';
    else if (p.turtle === 0) observation = logGap === -Infinity ? '乌龟一直没有动。兔子在第一段就真的追上了。' : pending ? '乌龟留在原地。兔子正在靠近，这一段就能追上。' : '乌龟没有移动。兔子只需跑完这一段。';
    else if (p.rabbit === p.turtle) observation = '两者一样快。每次到达旧位置，间距仍然不变。';
    else if (p.rabbit < p.turtle) observation = '乌龟更快，间距只会增加。这组条件不产生逐段收缩。';
    text('zr-observation', observation);
    root!.dataset.phase = phase; root!.dataset.gap = String(Math.exp(logGap)); root!.dataset.logGap = String(logGap);
    root!.dataset.screenGap = String(screenGap); root!.dataset.glyphScale = String(scale); root!.dataset.logZoom = String(magnification);
    root!.dataset.rabbitX = String(left); root!.dataset.turtleX = String(right); root!.dataset.targetX = String(targetX);
    root!.dataset.motionTime = String(moving && pending ? pursuitTime(p, stage.index, progress) : stage.time);
    root!.dataset.logTail = String(scene.logTail); root!.dataset.cameraScale = String(logPixelsPerMetre); root!.dataset.progress = String(progress);
    const key = `${p.lead}/${p.rabbit}/${p.turtle}/${stage.index}`;
    if (historyKey !== key) {
      historyKey = key;
      const history = el('zr-gap-history'); history.replaceChildren();
      for (let i = Math.max(0, stage.index - 3); i <= stage.index; i++) {
        const s = stageAt(p, i), row = document.createElement('div'); row.className = 'zr-history-row';
        const label = document.createElement('span'); label.textContent = i === 0 ? '起点' : `#${i}`;
        const content = document.createElement('div'), bar = document.createElement('i'), value = document.createElement('b');
        // These miniature bars share a compressed visual scale; the labels carry exact distance.
        bar.style.width = `${Math.max(3, cameraForGap(s.logGap, p.lead > 0 ? Math.log(p.lead) : -Infinity).screenGap / 560 * 32)}px`;
        value.textContent = formatLogDistance(s.logGap); content.append(bar, value); row.append(label, content); history.append(row);
      }
    }
    text('zr-history-heading', p.lead > 0 && p.rabbit > p.turtle && p.turtle > 0 ? '距离，一次次缩小' : '每一步的实际间距');
    text('zr-ratio-note', p.lead === 0 ? '起点间距为零。' : p.rabbit === 0 ? '兔子静止，无法完成第一段。' : p.turtle === 0 ? '乌龟静止，第一段即可到达。' : p.rabbit > p.turtle ? `每到一个旧位置，间距变成上一段的 ${format(p.turtle / p.rabbit * 100, 2)}%。` : p.rabbit === p.turtle ? '速度相同，每段间距保持不变。' : `每到一个旧位置，间距变成上一段的 ${format(p.turtle / p.rabbit, 2)} 倍。`);
  }
  function renderExplanation() {
    const limit = meetingTime(p), end = horizon(), pos = positionsAt(p, time);
    const domain = Math.max(1, p.lead, p.rabbit * end, p.lead + p.turtle * end) * 1.06;
    const x = (value: number) => 50 + value / domain * 780;
    el('zr-full-rabbit').setAttribute('transform', `translate(${x(pos.rabbit)} 85)`);
    el('zr-full-turtle').setAttribute('transform', `translate(${x(pos.turtle)} 158)`);
    el('zr-meeting-marker').setAttribute('transform', `translate(${x(limit === null ? 0 : p.rabbit * limit)} 0)`);
    el<SVGElement>('zr-meeting-marker').style.display = limit === null ? 'none' : '';
    text('zr-rabbit-position', `${format(pos.rabbit)} m`); text('zr-turtle-position', `${format(pos.turtle)} m`);
    text('zr-full-gap', pos.gap === 0 ? '此刻相遇 · 间距 0 m' : `${pos.gap > 0 ? '仍差' : '兔子已领先'} ${format(Math.abs(pos.gap))} m`);
    text('zr-full-observation', isDefault() && Math.abs(time - 1.2) < 1e-12 ? '1.2 秒：兔子在 12 m，乌龟在 11.2 m，兔子已领先 0.8 m。' : pos.gap < 0 ? '时钟已经越过相遇线，兔子继续向前。' : pos.gap === 0 ? '这是真正的相遇时刻，不是最后一个有限编号的步骤。' : limit === null ? '这组参数没有相遇时刻。' : '连续时钟不会被观察步骤的编号限制。');
    text('zr-segment', stage.index ? logTime(stage.logDuration) : '尚未开始');
    text('zr-time', `${format(time)} s`);
    text('zr-tail-label', mode === 'continuous' && limit !== null && time > limit ? '相遇后又过了' : '距相遇还需');
    text('zr-tail', mode === 'steps' ? logTime(pursuitFrame(p, stage.index, pending && !reducedMotion.matches ? progress : 0).logTail) : limit === null ? '不会追上' : `${format(Math.abs(limit - time))} s`);
    text('zr-limit-heading', limit === 0 ? '起点已经相遇' : limit === null ? '当前条件下' : '相遇发生在');
    text('zr-limit-time', limit === null ? '无法追上' : isDefault() ? '10/9 s' : `${format(limit)} s`);
    text('zr-limit-detail', limit === null ? (p.rabbit === p.turtle ? '速度相同，间距不变' : '兔子没有速度优势') : isDefault() ? '≈ 1.111111… 秒 · 100/9 米处' : `相遇位置 ${format(p.rabbit * limit)} m`);
    el<HTMLButtonElement>('zr-meet').disabled = limit === null;
    el('zr-mode-steps').setAttribute('aria-pressed', String(mode === 'steps')); el('zr-mode-continuous').setAttribute('aria-pressed', String(mode === 'continuous'));
    el<HTMLElement>('zr-complete-view').hidden = mode !== 'continuous';
    el<HTMLElement>('zr-continuous-controls').hidden = mode !== 'continuous';
    const fullPlay = el('zr-continuous-play'); fullPlay.textContent = mode === 'continuous' && running ? '暂停完整时间' : '播放完整时间'; fullPlay.setAttribute('aria-pressed', String(mode === 'continuous' && running));
    scrub.value = String(Math.round(time / end * 1000)); text('zr-scrub-value', `${format(time)} s`);
    text('zr-timeline-caption', limit === null ? '这组参数没有相遇线' : limit === 0 ? '起点已相遇' : '上方步骤靠近相遇线 · 下方时间穿过它');
    renderTimeline(end, limit);
  }
  function render() {
    root!.dataset.mode = mode; root!.dataset.time = String(time); root!.dataset.stage = String(stage.index); root!.dataset.running = String(running);
    const availability = nextStage(p, stage).stop;
    next.disabled = !!availability || !!pending;
    play.disabled = !!availability && !pending;
    play.textContent = mode === 'steps' && running ? '暂停' : pending ? '继续追赶' : '自动追赶';
    play.setAttribute('aria-pressed', String(mode === 'steps' && running));
    text('zr-play-note', reducedMotion.matches ? '已减少动态：直接显示每段终点。播放时长不是实际用时。' : '连续慢放与放大同时进行；插画逐渐缩成位置点，不代表动物体积。');
    renderGap();
    const note = el<HTMLElement>('zr-resolution');
    note.hidden = availability !== 'stage-cap' && availability !== 'resolution';
    note.textContent = note.hidden ? '' : `${stopCopy(availability)} 当前还差 ${formatLogDistance(stage.logGap)}。`;
    if (explanation.open) renderExplanation();
  }
  function finishStep() {
    if (!pending) return;
    stage = pending; pending = null; progress = 0; phase = 'idle'; phaseTime = 0; time = stage.time;
    const availability = nextStage(p, stage).stop;
    announce(availability ? stopCopy(availability) : `第 ${stage.index} 段，还差 ${formatLogDistance(stage.logGap)}。`);
    if (availability || !autoplay) pause();
  }
  function prepareStep() {
    const result = nextStage(p, stage);
    if (result.stop) { pause(); announce(stopCopy(result.stop)); return false; }
    pending = result.stage; progress = 0; phaseTime = 0; phase = 'chase'; return true;
  }
  function tick(timestamp: number) {
    if (!running) return;
    const elapsed = lastFrame === null ? 0 : Math.max(0, Math.min((timestamp - lastFrame) / 1000, .1)); lastFrame = timestamp;
    if (mode === 'continuous') {
      time = Math.min(horizon(), time + elapsed * horizon() / 6);
      if (time >= horizon()) { pause(); announce('完整时间播放完了。相遇之后，运动仍然继续。'); }
    } else {
      if (!pending && !prepareStep()) { render(); return; }
      phaseTime += elapsed;
      if (reducedMotion.matches) { if (phaseTime >= STEP_SECONDS) finishStep(); }
      else {
        progress = Math.min(1, phaseTime / STEP_SECONDS);
        if (phaseTime >= STEP_SECONDS) {
          const remainder = phaseTime - STEP_SECONDS;
          finishStep();
          // Carry wall-clock remainder through the boundary in this same frame.
          // No hold, frozen zoom, blank frame, or zero-velocity easing between steps.
          if (running && autoplay && prepareStep()) {
            phaseTime = remainder; progress = remainder / STEP_SECONDS;
          }
        }
      }
    }
    if (mode === 'steps' && pending && !reducedMotion.matches) time = pursuitTime(p, stage.index, progress);
    render(); if (running) frame = requestAnimationFrame(tick);
  }
  function runFrames() { running = true; lastFrame = null; render(); frame = requestAnimationFrame(tick); }
  function chooseSteps() { if (mode !== 'steps') { pause(true); mode = 'steps'; time = stage.time; } }
  function takeStep() {
    chooseSteps(); if (pending) return;
    pause(); if (!prepareStep()) { render(); return; }
    if (reducedMotion.matches) { finishStep(); render(); } else runFrames();
  }
  function startSteps() {
    chooseSteps();
    const shouldRepeat = pending ? resumeAutoplay : true;
    if (!pending && !prepareStep()) { render(); return; }
    autoplay = shouldRepeat; announce('正在连续追赶与放大。脚步不停，间距逐渐缩小。'); runFrames();
  }
  function reset(announceReset = true) {
    pause(true); stage = stageAt(p, 0); time = 0; historyKey = '';
    if (announceReset) announce('已回到起点，保留当前速度与领先距离。'); render();
  }
  function syncInputs() {
    for (const [id, value, unit] of [['zr-lead', p.lead, 'm'], ['zr-rabbit-speed', p.rabbit, 'm/s'], ['zr-turtle-speed', p.turtle, 'm/s']] as const) {
      el<HTMLInputElement>(id).value = String(value); text(`${id}-value`, `${format(value)} ${unit}`);
    }
  }
  for (const [id, field] of [['zr-lead', 'lead'], ['zr-rabbit-speed', 'rabbit'], ['zr-turtle-speed', 'turtle']] as const) {
    el<HTMLInputElement>(id).addEventListener('input', event => {
      const input = event.currentTarget as HTMLInputElement, value = input.valueAsNumber;
      if (!Number.isFinite(value)) return;
      p[field] = Math.min(Number(input.max), Math.max(Number(input.min), value)); syncInputs(); reset(false); announce('参数已更新，播放已暂停并回到起点。');
    });
  }
  for (const chosen of ['steps', 'continuous'] as const) el(`zr-mode-${chosen}`).addEventListener('click', () => {
    pause(true); mode = chosen; time = chosen === 'continuous' ? 0 : stage.time; render();
  });
  next.addEventListener('click', takeStep);
  play.addEventListener('click', () => { if (running && mode === 'steps') { pause(); announce('已暂停在这一段，可以继续追赶。'); render(); } else { pause(); startSteps(); } });
  el('zr-reset').addEventListener('click', () => { mode = 'steps'; reset(); });
  el('zr-replay').addEventListener('click', () => { reset(false); if (mode === 'steps') startSteps(); else runFrames(); });
  el('zr-continuous-play').addEventListener('click', () => { if (running) { pause(); render(); } else { mode = 'continuous'; if (time >= horizon()) time = 0; runFrames(); } });
  el('zr-meet').addEventListener('click', () => {
    const limit = meetingTime(p); if (limit === null) return;
    pause(true); mode = 'continuous'; time = limit; render();
  });
  el('zr-compare').addEventListener('click', () => {
    pause(true); p = { ...DEFAULT_RACE }; syncInputs(); mode = 'continuous'; stage = stageAt(p, 3); time = 1.2; historyKey = ''; render();
  });
  scrub.addEventListener('input', () => { pause(true); time = Number(scrub.value) / 1000 * horizon(); render(); });
  explanation.addEventListener('toggle', () => { if (!explanation.open && mode === 'continuous') { pause(true); mode = 'steps'; time = stage.time; } render(); });
  reducedMotion.addEventListener('change', () => { pause(); if (pending) finishStep(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render(); announce('页面隐藏，播放已暂停。回来后可手动继续。'); } });
  window.addEventListener('pagehide', () => pause());
  // A back/forward-cache restore keeps the DOM; refresh paused button state too.
  window.addEventListener('pageshow', () => render());
  window.addEventListener('resize', render);
  syncInputs(); render();
}
