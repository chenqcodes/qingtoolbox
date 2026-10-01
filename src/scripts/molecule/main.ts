import { buildDna } from './dna';
import { caffeine, dopamine, serotonin, water, type Molecule } from './presets';
import { createMolScene, type MolScene } from './scene';
import { createTour } from './tour';

function $(id: string) { return document.getElementById(id)!; }
const TOUR_ORDER = ['dna', 'dopamine', 'serotonin', 'caffeine', 'water'] as const;

export function bootMolecule() {
  const canvas = $('mol-canvas') as HTMLCanvasElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const opts = { signal: events.signal };
  let scene: MolScene | null = null;
  try { scene = createMolScene(canvas); }
  catch { $('mol-view-status').textContent = '当前设备无法启用 WebGL 三维画面。仍可切换下方模型并阅读说明。'; canvas.hidden = true; }
  const catalog: Record<string, Molecule> = { water, caffeine, dopamine, serotonin, dna: buildDna(16) };
  let showPairs = true;
  let rendered = '';
  const tour = createTour('dna', TOUR_ORDER, () => apply());
  const apply = () => {
    const mol = catalog[tour.current];
    if (rendered !== `${mol.id}:${showPairs}`) { scene?.setMolecule(mol, showPairs); rendered = `${mol.id}:${showPairs}`; }
    scene?.setAutoSpin(tour.running && !motion.matches);
    $('mol-name').textContent = mol.name;
    $('mol-count').textContent = `${mol.atoms.length} 个${mol.id === 'dna' ? '示意节点（不是原子数）' : '显示原子（可能省略 H）'}`;
    $('mol-model-note').textContent = mol.id === 'dna' ? 'DNA 双螺旋教学示意：球体代表糖、磷酸与碱基，不是全原子结构；连接线不表示化学键级。' : mol.id === 'water' ? '水分子教学模型，坐标经简化。' : '手工简化的分子示意，非已验证结构；不用于化学计算。';
    ($('mol-select') as HTMLSelectElement).value = mol.id;
    $('mol-pairs').hidden = mol.id !== 'dna';
    $('mol-tour').textContent = tour.running ? '暂停巡游' : '开始巡游';
    $('mol-tour').setAttribute('aria-pressed', String(tour.running));
    $('mol-tour-note').textContent = tour.running ? '自动巡游中 · 9s 切换' : '已暂停自动切换';
  };
  $('mol-select').addEventListener('change', (e) => tour.select((e.target as HTMLSelectElement).value), opts);
  $('mol-pairs').addEventListener('click', () => {
    showPairs = !showPairs;
    $('mol-pairs').textContent = showPairs ? '隐藏碱基对' : '显示碱基对';
    $('mol-pairs').setAttribute('aria-pressed', String(showPairs));
    tour.pause();
  }, opts);
  $('mol-tour').addEventListener('click', () => tour.running ? tour.pause() : tour.start(), opts);
  motion.addEventListener('change', () => { if (motion.matches) tour.pause(); }, opts);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    tour.pause();
    $('mol-view-status').textContent = '三维画面已中断，请刷新页面重试。模型说明仍可阅读。';
  }, opts);
  window.addEventListener('pagehide', () => tour.pause(), opts);
  document.addEventListener('astro:before-swap', () => { tour.pause(); scene?.dispose(); events.abort(); }, { once: true });
  apply();
  if (!motion.matches && scene) tour.start();
}
