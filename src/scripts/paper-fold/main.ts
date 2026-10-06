import { DEFAULT_THICKNESS_MM, MAX_FOLDS, journeyFoldLimit, MIN_THICKNESS_MM, MAX_THICKNESS_MM, clampFolds, clampThickness, thicknessMetres, layers, formatLength, scientificMetres, milestoneFold } from './model';
import { drawScene, viewLog } from './draw';
import { DETAIL_FOLD_END, foldGeometry, interpolateFoldGeometry, type FoldGeometry } from './stack-fold';
import { JOURNEY_REFERENCES, MILESTONE_REFERENCES, adjacentReferences, projectedReferences, formatRatio } from './references';

let dispose: (() => void) | undefined;
export function bootPaperFold(): void {
  dispose?.();
  const root = document.querySelector<HTMLElement>('#paper-fold-lab');
  if (!root) return;
  const get = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
  const canvas = get<HTMLCanvasElement>('pf-canvas'), ctx = canvas.getContext('2d');
  const range = get<HTMLInputElement>('pf-folds'), initial = get<HTMLInputElement>('pf-initial');
  const play = get<HTMLButtonElement>('pf-play'), step = get<HTMLButtonElement>('pf-step');
  const speed = get<HTMLSelectElement>('pf-speed');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController(), { signal } = abort;
  let folds = 0, thicknessMm = DEFAULT_THICKNESS_MM, playing = false;
  const foldLimit = () => journeyFoldLimit(thicknessMm);
  let exponent = 0, logMm = Math.log2(thicknessMm), logView = viewLog(0, thicknessMm);
  let width = 800, height = 575, raf = 0, nextFoldAt = 0;
  let detailPose = (half: number): FoldGeometry => foldGeometry(0, half);
  let detailCustom = false;
  type Motion = { fromExponent: number; toExponent: number; fromLogMm: number; toLogMm: number; fromView: number; toView: number; start: number; duration: number; detailJump: boolean; fromDetail: (half: number) => FoldGeometry };
  let motion: Motion | undefined;
  const status = (text: string) => { get('pf-status').textContent = text; };
  const superscript = (text: string) => text.replace(/\^(-?\d+)/g, (_, digits: string) => [...digits].map(char => ({'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'}[char] ?? char)).join(''));
  function paint() {
    root!.dataset.motion = String(Boolean(motion));
    root!.dataset.view = logView.toFixed(8);
    root!.dataset.visualFold = exponent.toFixed(6);
    renderReferenceContext();
    const detail = detailPose(80);
    root!.dataset.foldAngle = detail.angle.toFixed(6);
    root!.dataset.foldPhase = detail.phase.toFixed(6);
    root!.dataset.foldRotation = detail.rotation.toFixed(6);
    root!.dataset.foldAxis = detail.axis;
    root!.dataset.foldYaw = (Math.floor(exponent) * Math.PI / 2 + detail.rotation).toFixed(6);
    root!.dataset.foldBundle = String(Math.floor(exponent));
    root!.dataset.foldMode = motion?.detailJump ? 'journey' : detail.phase >= DETAIL_FOLD_END ? 'rotate' : detail.phase > 0 ? 'whole-stack' : 'rest';
    const layerFold = Math.floor(exponent) + (detail.phase >= DETAIL_FOLD_END ? 1 : 0);
    const layerText = layerFold < 10 ? `${2 ** layerFold} 层` : superscript(`2^${layerFold} 层`);
    const nextLayerText = layerFold < 9 ? `${2 ** (layerFold + 1)} 层` : superscript(`2^${layerFold + 1} 层`);
    const backward = Boolean(motion && motion.toExponent < motion.fromExponent);
    get('pf-fold-detail-title').textContent = motion?.detailJump ? `前往第 ${folds} 次`
      : detail.phase >= DETAIL_FOLD_END ? `${layerText} · 转向 90°`
      : detail.phase > 0 ? backward ? `${nextLayerText} → ${layerText}` : `${layerText} → ${nextLayerText}`
      : `${layerText}，${folds === foldLimit() ? '旅程抵达终点' : '准备对折'}`;
    get('pf-fold-detail-state').textContent = motion?.detailJump ? '纸叠从当前形态连续过渡'
      : backward ? '沿同一过程倒放，回看上一折'
      : detail.phase >= DETAIL_FOLD_END ? '形状保持不变，整叠转向下一轴'
      : detail.phase > 0 ? '全部已有层一起折起、合拢'
      : '合拢后转向 90°，再沿下一轴对折';
    if (ctx) drawScene(ctx, width, height, { exponent, thicknessMm: 2 ** logMm, logView, foldPose: detailPose });
  }
  function renderReferenceContext() {
    // Follow the visible fractional state, not the selected endpoint of a jump.
    const metres = 2 ** logMm / 1000 * 2 ** exponent;
    const { previous, next } = adjacentReferences(metres);
    const area = height - 60 - 155;
    const visible = projectedReferences(logView, area, metres);
    const text = (id: string, value: string) => { const node = get(id); if (node.textContent !== value) node.textContent = value; };
    root!.dataset.referencePrevious = previous?.id ?? 'start';
    root!.dataset.referenceNext = next?.id ?? 'end';
    root!.dataset.referenceVisible = visible.filter(item => item.opacity >= .5 && item.pixels >= 10 && item.pixels <= area).map(item => item.reference.id).join(',');
    text('pf-reference-now', `画面此刻 · ${formatLength(metres)}`);
    for (const [side, reference] of [['previous', previous], ['next', next]] as const) {
      const button = get<HTMLButtonElement>(`pf-reference-${side}`);
      const isPrevious = side === 'previous';
      button.dataset.reference = reference?.id ?? '';
      const unreachable = Boolean(reference && milestoneFold(reference.metres, thicknessMm) === null);
      button.disabled = !reference || unreachable;
      text(`pf-${side}-name`, reference?.name ?? (isPrevious ? '最初的纸张' : '更远的宇宙'));
      text(`pf-${side}-dimension`, reference?.dimension ?? (isPrevious ? `${formatLength(2 ** logMm / 1000)} 的起点` : '整个宇宙有多大，目前还不知道'));
      text(`pf-${side}-ratio`, reference ? (isPrevious ? `当前约为它的 ${formatRatio(metres / reference.metres)} 倍` : `目标是当前的 ${formatRatio(reference.metres / metres)} 倍`) : (isPrevious ? `已经放大 ${formatRatio(2 ** exponent)} 倍` : '可观测范围之外，没有已知的总直径'));
      const pixels = reference ? reference.metres * area / 2 ** logView : 0;
      const placement = !reference ? (isPrevious ? '起点' : '大小未知') : unreachable ? `超出 ${MAX_FOLDS} 折` : pixels < 10 ? '↓ 已缩小' : pixels > area ? '↑ 画面之外' : '同尺可见';
      text(`pf-${side}-placement`, placement);
      button.setAttribute('aria-label', reference ? `${isPrevious ? '已越过' : '正靠近'}${reference.name}，${reference.dimension}。${milestoneFold(reference.metres, thicknessMm) === null ? '超过当前折叠上限' : '跳到这个尺度'}` : isPrevious ? '最初的纸张' : '整个宇宙大小未知，没有可跳转的总直径');
    }
    const start = previous?.metres ?? Math.min(2 ** logMm / 1000, metres);
    const end = next?.metres ?? metres;
    const progress = next ? Math.min(1, Math.max(0, Math.log(metres / start) / Math.log(end / start))) : 1;
    get('pf-reference-progress').style.setProperty('--progress', `${Number.isFinite(progress) ? progress * 100 : 0}%`);
  }
  function renderValues() {
    const metres = thicknessMetres(folds, thicknessMm), exactLayers = layers(folds).toLocaleString('zh-CN');
    root!.dataset.folds = String(folds); root!.dataset.playing = String(playing); root!.dataset.thickness = String(metres);
    get('pf-count').textContent = String(folds); get('pf-thickness').textContent = formatLength(metres);
    get('pf-scientific').textContent = superscript(scientificMetres(metres));
    get('pf-layers').textContent = exactLayers; get('pf-layer-power').textContent = superscript(`= 2^${folds}`);
    get('pf-formula-initial').textContent = `${thicknessMm} mm`; get('pf-formula-power').textContent = String(folds); get('pf-formula-result').textContent = formatLength(metres);
    get('pf-folds-output').textContent = `第 ${folds} 次`; range.max = String(foldLimit()); range.value = String(folds);
    get('pf-limit').textContent = `OF ${foldLimit()}`;
    get('pf-timeline-label').textContent = `拖动，穿过 ${foldLimit()} 次翻倍`;
    root!.dataset.foldLimit = String(foldLimit());
    get('pf-ticks').innerHTML = [0,20,40,60,80,foldLimit()].map(n => `<span style="left:${n / foldLimit() * 100}%">${n}</span>`).join('');
    range.setAttribute('aria-valuetext', `${folds} 次对折，厚度 ${formatLength(metres)}`);
    play.innerHTML = `<span aria-hidden="true">${playing?'Ⅱ':'▶'}</span> ${playing?'暂停折叠':folds===foldLimit()?'重新旅行':folds===0?'开始折叠':'继续折叠'}`;
    play.setAttribute('aria-pressed', String(playing)); step.disabled = folds === foldLimit() || !ctx; play.disabled = !ctx;
    const reached = [...MILESTONE_REFERENCES].reverse().find(ref => metres >= ref.metres);
    for (const ref of MILESTONE_REFERENCES) {
      const first = milestoneFold(ref.metres, thicknessMm);
      root!.querySelector<HTMLElement>(`[data-milestone-fold="${ref.id}"]`)!.textContent = `${first} 次`;
      root!.querySelector<HTMLButtonElement>(`[data-milestone="${ref.id}"]`)!.setAttribute('aria-current', String(reached?.id === ref.id));
    }
    canvas.setAttribute('aria-label', `已选择 ${folds} 次对折，理论厚度 ${formatLength(metres)}，共 ${exactLayers} 层。左侧厚度刻度与参照物的高度、直径或距离共用长度比例尺；整叠交替折叠、转向的形态与层纹为示意。下方提供相邻参照与倍数。`);
  }
  function cancelFrame() { if (raf) cancelAnimationFrame(raf); raf=0; }
  function requestFrame() { if (!raf && !document.hidden && (motion || playing)) raf=requestAnimationFrame(frame); }
  function finishMotion() { motion=undefined; exponent=folds;logMm=Math.log2(thicknessMm);logView=viewLog(folds,thicknessMm);detailCustom=false;const settledFold=folds;detailPose=(half)=>foldGeometry(settledFold,half); }
  function pause(message?: string, settle = false) {
    playing=false;nextFoldAt=0;cancelFrame();
    if(settle)finishMotion();else motion=undefined;
    renderValues();paint();if(message)status(message);
  }
  function moveTo(target: number, duration=850) {
    folds=Math.min(foldLimit(),clampFolds(target));
    const toLogMm=Math.log2(thicknessMm), toView=viewLog(folds,thicknessMm);
    if(media.matches || duration===0)finishMotion();
    else motion={fromExponent:exponent,toExponent:folds,fromLogMm:logMm,toLogMm,fromView:logView,toView,start:performance.now(),duration,detailJump:Math.abs(folds-exponent)>1.001||detailCustom,fromDetail:detailPose};
    renderValues();paint();requestFrame();
  }
  function jumpTo(target: number, message: string) {
    // Start a new camera move exactly where the interrupted one is drawn.
    pause(undefined,false);moveTo(target,Math.abs(target-exponent)<=1.001?1100:Math.min(1800,550+Math.abs(target-exponent)*24));status(message);
  }
  function frame(now: number) {
    raf=0;if(document.hidden)return;
    if(motion){
      const progress=Math.min(1,(now-motion.start)/motion.duration),ease=progress*progress*(3-2*progress);
      const travel = motion.detailJump ? ease : progress;
      exponent=motion.fromExponent+(motion.toExponent-motion.fromExponent)*travel;
      logMm=motion.fromLogMm+(motion.toLogMm-motion.fromLogMm)*ease;
      logView=motion.fromView+(motion.toView-motion.fromView)*ease;
      detailCustom=motion.detailJump;
      const visibleExponent=exponent, fromDetail=motion.fromDetail, target=motion.toExponent;
      detailPose=motion.detailJump ? (half)=>interpolateFoldGeometry(fromDetail(half),foldGeometry(target,half),ease) : (half)=>foldGeometry(visibleExponent,half);
      if(progress>=1)finishMotion();
      paint();
    }
    if(playing&&!motion&&now>=nextFoldAt){
      if(folds>=foldLimit()){pause(`已抵达可观测宇宙尺度 · ${foldLimit()} 次旅程完成`);return;}
      const interval=Number(speed.value);nextFoldAt=now+interval;
      moveTo(folds+1,interval);status(`正在折叠 · 第 ${folds} 次`);
    }
    requestFrame();
  }
  play.addEventListener('click',()=>{
    if(playing){pause('已暂停 · 可以细看这一刻');return;}
    if(folds===foldLimit()){folds=0;finishMotion();renderValues();paint();}
    if(Math.abs(exponent-folds)>1e-8)moveTo(folds,650);
    playing=true;nextFoldAt=0;renderValues();status(media.matches?'逐步播放 · 已减少动态效果':'镜头会随纸叠一起向外');requestFrame();
  },{signal});
  step.addEventListener('click',()=>jumpTo(folds+1,`再折一次 · 第 ${Math.min(foldLimit(),folds+1)} 次`),{signal});
  get('pf-reset').addEventListener('click',()=>{
    pause(undefined,false);thicknessMm=DEFAULT_THICKNESS_MM;initial.value=String(thicknessMm);get('pf-input-help').textContent='初始厚度 0.01–1 mm · 修改会暂停';moveTo(0,media.matches?0:1100);status('回到最初的 0.1 mm 纸张');
  },{signal});
  range.addEventListener('input',()=>jumpTo(Number(range.value),`停在第 ${range.value} 次 · 可继续折叠`),{signal});
  root.querySelectorAll<HTMLButtonElement>('[data-milestone]').forEach(button=>button.addEventListener('click',()=>{
    const ref=MILESTONE_REFERENCES.find(item=>item.id===button.dataset.milestone)!;
    jumpTo(milestoneFold(ref.metres,thicknessMm)??foldLimit(),`抵达${ref.name}尺度 · 理想模型`);
  },{signal}));
  root.querySelectorAll<HTMLButtonElement>('[data-nearby]').forEach(button => button.addEventListener('click', () => {
    const reference = JOURNEY_REFERENCES.find(item => item.id === button.dataset.reference);
    if (!reference) return;
    const target = milestoneFold(reference.metres, thicknessMm);
    if (target !== null) jumpTo(target, `抵达${reference.name}尺度 · 理想模型`);
  }, { signal }));
  initial.addEventListener('input',()=>{if(playing)pause('已暂停 · 正在更换纸张');},{signal});
  initial.addEventListener('change',()=>{
    const value=initial.valueAsNumber;
    if(!Number.isFinite(value)){initial.value=String(thicknessMm);status('请输入 0.01–1 mm 的有效厚度');return;}
    pause(undefined,false);thicknessMm=clampThickness(value);initial.value=String(thicknessMm);
    const bounded=value<MIN_THICKNESS_MM||value>MAX_THICKNESS_MM;
    get('pf-input-help').textContent=bounded?'已限制在 0.01–1 mm 的安全范围':'初始厚度 0.01–1 mm · 修改会暂停';
    moveTo(Math.min(folds,foldLimit()),650);status(`新纸张 ${thicknessMm} mm · 里程碑已重算`);
  },{signal});
  initial.addEventListener('keydown',event=>{if(event.key==='Enter')initial.blur();},{signal});
  speed.addEventListener('change',()=>{if(playing)nextFoldAt=performance.now()+Number(speed.value);},{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('离开页面 · 已为你暂停');},{signal});
  media.addEventListener('change',()=>{get('pf-motion-note').hidden=!media.matches;pause(media.matches?'已减少动态效果':'已恢复平滑缩放',true);},{signal});
  function resize() {
    const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);
    paint();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  window.addEventListener('resize',resize,{signal});
  get('pf-motion-note').hidden=!media.matches;
  renderValues();resize();
  if(!ctx)status('浏览器未提供画布 · 仍可用滑杆查看精确数值');
  dispose=()=>{cancelFrame();abort.abort();observer.disconnect();};
}
bootPaperFold();
document.addEventListener('astro:page-load',bootPaperFold);
document.addEventListener('astro:before-swap',()=>dispose?.());
