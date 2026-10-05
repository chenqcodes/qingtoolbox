import { DEFAULT_RACE, MAX_STAGES, meetingTime, positionsAt, stageAt, nextStage, observationEnd, type RaceParameters, type Stage, type StepStop } from './model';

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
  const isDefault = () => p.lead === 10 && p.rabbit === 10 && p.turtle === 1;
  let p: RaceParameters = { ...DEFAULT_RACE };
  let mode: 'steps' | 'continuous' = 'steps';
  let stage: Stage = stageAt(p, 0), time = 0, running = false, frame = 0, lastFrame: number | null = null, stageElapsed = 0;
  let stopReason: StepStop = null;
  const play = el<HTMLButtonElement>('zr-play'), next = el<HTMLButtonElement>('zr-next');
  const scrub = el<HTMLInputElement>('zr-scrub');
  const ns = 'http://www.w3.org/2000/svg';
  const svgElement = (tag: string, attrs: Record<string, string | number>, value?: string): SVGElement => {
    const node = document.createElementNS(ns, tag);
    for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, String(val));
    if (value) node.textContent = value;
    return node;
  };
  const horizon = () => Math.max(observationEnd(p), stage.time * 1.12);
  const announce = (message: string) => text('zr-status', message);
  function pause() {
    running = false; cancelAnimationFrame(frame); frame = 0; lastFrame = null; stageElapsed = 0;
    root!.dataset.running = 'false'; play.setAttribute('aria-pressed', 'false');
  }
  function stopCopy(reason: StepStop): string {
    if (reason === 'already-met') return p.lead === 0 ? '起点就已相遇；可以切换到连续时间，看之后怎样运动。' : '乌龟不动，兔子第一段就已追上，不需要无限分段。';
    if (reason === 'stationary-rabbit') return '兔子速度为 0，不能到达乌龟的旧位置。试试连续时间。';
    if (reason === 'stage-cap') return `已展示 ${MAX_STAGES} 个有限段。这是页面的展示上限，不是“做完无穷步”。`;
    if (reason === 'resolution') return '再细分就超出数值分辨率，已停在最后一个可区分的有限截图；没有完成“无穷步”。';
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
  function render() {
    const limit = meetingTime(p), end = horizon();
    const pos = positionsAt(p, time);
    const gap = mode === 'steps' ? stage.gap : pos.gap;
    const domain = Math.max(1, p.lead, p.rabbit * end, p.lead + p.turtle * end) * 1.035;
    const x = (value: number) => 62 + value / domain * 775;
    root!.dataset.mode = mode; root!.dataset.time = String(time); root!.dataset.stage = String(stage.index);
    root!.dataset.gap = String(gap); root!.dataset.running = String(running);
    el('zr-rabbit').setAttribute('transform', `translate(${x(pos.rabbit)} 188)`);
    el('zr-turtle').setAttribute('transform', `translate(${x(pos.turtle)} 258)`);
    const marker = el<SVGGElement>('zr-meeting-marker'); marker.style.display = limit === null ? 'none' : ''; marker.setAttribute('transform', `translate(${x(limit === null ? 0 : p.rabbit * limit)} 0)`);
    const old = el<SVGGElement>('zr-old-marker'); old.style.display = mode === 'steps' && p.lead > 0 ? '' : 'none'; old.setAttribute('transform', `translate(${x(stageAt(p, Math.max(0, stage.index - 1)).turtlePosition)} 0)`);
    const ticks = el('zr-distance-ticks'); ticks.replaceChildren();
    for (let i = 0; i <= 5; i++) {
      const value = domain * i / 5, px = x(value);
      ticks.append(svgElement('path', { d: `M${px} 288V295`, stroke: '#8f9982' }));
      ticks.append(svgElement('text', { x: px, y: 311, 'text-anchor': 'middle' }, format(value, 1)));
    }
    text('zr-scene-clock', `t = ${format(time)} s`); text('zr-rabbit-position', `${format(pos.rabbit)} m`); text('zr-turtle-position', `${format(pos.turtle)} m`);
    text('zr-segment', mode === 'steps' ? (stage.index ? `${format(stage.duration)} s` : '尚未开始') : '连续观察');
    text('zr-time', `${format(time)} s`);
    text('zr-gap-label', gap < 0 ? '兔子已领先' : gap === 0 ? '两者间距' : '仍然落后'); text('zr-gap', `${format(Math.abs(gap))} m`);
    const tail = mode === 'steps' ? stage.tail : limit === null ? null : Math.max(0, limit - time);
    text('zr-tail-label', limit !== null && time > limit ? '相遇之后又过了' : '距相遇还需');
    text('zr-tail', limit !== null && time > limit ? `${format(time - limit)} s` : tail === null ? '不会追上' : `${format(tail)} s`);
    text('zr-limit-heading', limit === 0 ? '已经在起点相遇' : limit === null ? '当前条件下' : '相遇发生在');
    text('zr-limit-time', limit === null ? '无法追上' : isDefault() ? '10/9 s' : `${format(limit)} s`);
    text('zr-limit-detail', limit === null ? (p.rabbit === p.turtle ? '速度相同，领先距离不变' : '兔子更慢，领先距离只会增加') : isDefault() ? '≈ 1.111111… 秒 · 100/9 米处' : `相遇位置 ${format(p.rabbit * limit)} m`);
    el<HTMLButtonElement>('zr-meet').disabled = limit === null;
    const availability = nextStage(p, stage).stop;
    next.hidden = mode !== 'steps'; next.disabled = !!availability;
    play.disabled = mode === 'steps' && !!availability;
    play.textContent = running ? '暂停' : mode === 'steps' ? '逐张播放' : time >= end ? '重新播放' : time > 0 ? '继续慢放' : '连续慢放';
    play.setAttribute('aria-pressed', String(running));
    el('zr-mode-steps').setAttribute('aria-pressed', String(mode === 'steps')); el('zr-mode-continuous').setAttribute('aria-pressed', String(mode === 'continuous'));
    el<HTMLElement>('zr-continuous-controls').hidden = mode !== 'continuous';
    scrub.value = String(Math.round(time / end * 1000)); text('zr-scrub-value', `${format(time)} s`);
    text('zr-play-note', mode === 'steps' ? '每 0.85 秒展示一张截图；这不是每一段实际耗时。兔子实际并不停步。' : '按比例慢放：约 6 秒播放完整时间轴。这里的秒数是模型时间。');
    let observation: string;
    if (mode === 'steps') {
      text('zr-stage-label', stage.index ? `第 ${stage.index} 张截图 · 一个有限编号` : '起点 · 第 0 张截图');
      if (p.lead === 0) observation = '起点就已相遇。这里没有“永远追不到”的前提。';
      else if (p.rabbit === 0) observation = '兔子不动，到不了乌龟的旧位置，第一段无法完成。';
      else if (p.turtle === 0 && stage.index > 0) observation = '乌龟没有再往前走，兔子在第一段就真的追上了。';
      else if (p.rabbit <= p.turtle) observation = p.rabbit === p.turtle ? '两者一样快。每次追到旧位置，间距依然相同。' : '乌龟跑得更快。这次的间距不会缩小，也没有相遇极限。';
      else if (stage.index === 0) observation = '下一张截图：等兔子跑到乌龟现在的位置，再按暂停。';
      else observation = `此刻仍差 ${format(stage.gap)} m，距相遇还需 ${format(stage.tail!)} s。你选的这个时刻，仍在相遇之前。`;
    } else {
      text('zr-stage-label', gap < 0 ? '连续时间 · 兔子已经超越' : limit !== null && time === limit ? '连续时间 · 此刻相遇' : '连续时间 · 时钟不受截图编号限制');
      if (isDefault() && Math.abs(time - 1.2) < 1e-12) observation = '1.2 秒：兔子跑到 12 m，乌龟在 11.2 m。兔子已经领先 0.8 m。';
      else if (gap < 0) observation = `时钟走过了相遇线。兔子已经领先 ${format(-gap)} m，不需要某张“最后截图”。`;
      else if (gap === 0) observation = p.lead === 0 ? '它们在起点就在一起；继续播放，看看速度不同会怎样。' : '两者位置相同：这是相遇时刻，不是任何有限编号的旧位置截图。';
      else if (limit === null) observation = '兔子没有速度优势。这次追不上，与无限分段无关。';
      else observation = '这只是完整赛跑中的一个时刻。继续走，时钟会经过相遇线。';
    }
    text('zr-observation', observation);
    text('zr-timeline-caption', limit === null ? '这组参数不收敛到相遇：没有相遇线' : limit === 0 ? '起点已相遇，连续时间照常继续' : '上方截图挤向相遇线 · 下方时间可以穿过它');
    const resolution = el<HTMLElement>('zr-resolution');
    const precisionNote = availability === 'resolution' || availability === 'stage-cap' ? stopCopy(availability) + ` 当前仍差 ${format(stage.gap)} m${stage.tail === null ? '。' : `，还需 ${format(stage.tail)} s。`}` : stage.index >= 5 && limit !== null && p.turtle > 0 ? '图形可能已经重叠、四舍五入后的时间可能相同，但这仍是相遇之前的有限截图。正的剩余距离与时间单独计算，没有被当成零。' : '';
    resolution.hidden = mode !== 'steps' || !precisionNote; resolution.textContent = precisionNote;
    renderTimeline(end, limit);
  }
  function takeStep(): boolean {
    const result = nextStage(p, stage); stopReason = result.stop;
    if (stopReason) { pause(); announce(stopCopy(stopReason)); render(); return false; }
    stage = result.stage; time = stage.time;
    const after = nextStage(p, stage).stop;
    if (after) { pause(); stopReason = after; announce(stopCopy(after)); }
    else announce(`第 ${stage.index} 张截图，模型时间 ${format(time)} 秒，间距 ${format(stage.gap)} 米。`);
    render(); return !after;
  }
  function tick(timestamp: number) {
    if (!running) return;
    const elapsed = lastFrame === null ? 0 : Math.min((timestamp - lastFrame) / 1000, .1); lastFrame = timestamp;
    if (mode === 'steps') {
      stageElapsed += elapsed;
      if (stageElapsed >= .85) { stageElapsed -= .85; if (!takeStep()) return; }
    } else {
      time = Math.min(horizon(), time + elapsed * horizon() / 6);
      if (time >= horizon()) { pause(); announce('这一段连续时间播放完了。相遇之后，运动仍然继续。'); }
      render();
    }
    if (running) frame = requestAnimationFrame(tick);
  }
  function start() {
    pause();
    if (mode === 'steps' && nextStage(p, stage).stop) { announce(stopCopy(nextStage(p, stage).stop)); render(); return; }
    if (mode === 'continuous' && time >= horizon()) time = 0;
    running = true; lastFrame = null; announce(mode === 'steps' ? '正在依次显示选定截图。兔子本身没有停步。' : '连续时钟正在前进，可以越过相遇时刻。'); render(); frame = requestAnimationFrame(tick);
  }
  function reset(announceReset = true) {
    pause(); stage = stageAt(p, 0); time = 0; stopReason = null;
    if (announceReset) announce('已回到起点，当前速度与领先距离保持不变。');
    render();
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
    pause(); mode = chosen; if (mode === 'steps') time = stage.time;
    announce(mode === 'steps' ? '现在只看选定的有限截图；这些时刻不是完整时间。' : '现在可以拖动或播放连续时钟，走过相遇线。'); render();
  });
  next.addEventListener('click', () => { pause(); takeStep(); });
  play.addEventListener('click', () => { if (running) { pause(); announce('已暂停，可以继续，或换一种观察方式。'); render(); } else start(); });
  el('zr-reset').addEventListener('click', () => reset());
  el('zr-replay').addEventListener('click', () => { reset(false); start(); });
  el('zr-meet').addEventListener('click', () => {
    const limit = meetingTime(p); if (limit === null) return;
    pause(); mode = 'continuous'; time = limit; stopReason = null;
    announce('已切换到连续时间，直接选中相遇时刻。它不是某个最后编号的截图。'); render();
  });
  el('zr-compare').addEventListener('click', () => {
    pause(); p = { ...DEFAULT_RACE }; syncInputs(); mode = 'continuous'; stage = stageAt(p, 3); time = 1.2; stopReason = null;
    announce('默认参数下，1.2 秒时兔子在 12 米，乌龟在 11.2 米；兔子已领先 0.8 米。'); render();
  });
  scrub.addEventListener('input', () => { pause(); time = Number(scrub.value) / 1000 * horizon(); render(); announce(`已选中连续时刻 ${format(time)} 秒。`); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running) { pause(); render(); announce('页面隐藏，播放已暂停。回来后可手动继续。'); } });
  window.addEventListener('pagehide', pause);
  window.addEventListener('resize', render);
  syncInputs(); render();
}
