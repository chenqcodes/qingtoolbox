import { buildDna } from './dna';
import { caffeine, dopamine, serotonin, water, displayedAtomIndices, describeAtom, groupIndices, type Molecule } from './presets';
import { createMolScene, type MolScene, type RenderStyle } from './scene';
import { createTour } from './tour';
function $(id: string) { return document.getElementById(id)!; }
const TOUR_ORDER = ['dna', 'dopamine', 'serotonin', 'caffeine', 'water'] as const;
const subscript = (formula: string) => formula.replace(/\d/g, (digit) => '₀₁₂₃₄₅₆₇₈₉'[Number(digit)]);
const GUIDE: Record<string, string> = {
  dna: '观察双链：橙色是磷酸基团，灰色是糖，彩色是 A / T / G / C 碱基。黄线只表示碱基配对；A 配 T、G 配 C。',
  water: '观察弯曲结构：水只有 3 个原子。打开氢显示，再点选氧，查看两个 O–H 单键。这里使用计算构象，不代表精确实验键角。',
  dopamine: '与 5-羟色胺比较：多巴胺含一个六元碳环、两个羟基和含氮侧链。高亮氧后点选两个红球，能看到它们都与氢相连。',
  serotonin: '与多巴胺比较：5-羟色胺含两个稠合环、一个羟基和两个氮。红球只有一个；蓝球分别处于环内和侧链。',
  caffeine: '与多巴胺比较：咖啡因也有两个氧，但它们通过双键连接碳，属于羰基。球棍视图中的平行双棍显示双键。',
};
export function bootMolecule() {
  const canvas = $('mol-canvas') as HTMLCanvasElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const opts = { signal: events.signal };
  const catalog: Record<string, Molecule> = { water, caffeine, dopamine, serotonin, dna: buildDna(16) };
  let scene: MolScene | null = null;
  let showPairs = true;
  let showHydrogen = true;
  let style: RenderStyle = 'ball-stick';
  let rendered = '';
  let previousModel = '';
  let selected = -1;
  const tour = createTour('dna', TOUR_ORDER, () => apply());
  const atomSelect = $('mol-atom') as HTMLSelectElement;
  const groupSelect = $('mol-group') as HTMLSelectElement;
  const selectAtom = (index: number) => {
    selected = index;
    tour.pause();
    atomSelect.value = String(index);
    groupSelect.value = 'none';
    scene?.setSelection([index]);
    $('mol-inspect').textContent = describeAtom(catalog[tour.current], index);
  };
  try { scene = createMolScene(canvas, selectAtom); }
  catch { $('mol-view-status').textContent = '当前设备无法启用 WebGL 三维画面。仍可切换模型，查看来源、数量和原子说明。'; canvas.hidden = true; }
  const apply = () => {
    const mol = catalog[tour.current];
    const schematic = mol.modelKind === 'schematic';
    const visible = displayedAtomIndices(mol, showHydrogen);
    const key = `${mol.id}:${showPairs}:${showHydrogen}:${style}`;
    if (rendered !== key) {
      scene?.setMolecule(mol, showPairs, showHydrogen, style);
      rendered = key;
      atomSelect.replaceChildren(new Option('选择或点击画面中的节点', '-1'), ...visible.map((index) => {
        const atom = mol.atoms[index];
        return new Option(schematic ? atom.label : `${atom.el} · #${atom.aid}`, String(index));
      }));
      if (visible.includes(selected) && previousModel === mol.id) { atomSelect.value = String(selected); scene?.setSelection([selected]); }
      else { selected = -1; $('mol-inspect').textContent = '点击球体，或用上方选择框查看同样的说明。'; }
      if (previousModel === mol.id && groupSelect.value !== 'none' && groupSelect.value) scene?.setSelection(groupIndices(mol, groupSelect.value));
    }
    if (previousModel !== mol.id) {
      groupSelect.replaceChildren(new Option('不高亮', 'none'), ...(schematic ? [['磷酸基团', 'phosphate'], ['糖', 'sugar'], ['碱基', 'base']] : [['氧 O', 'oxygen'], ['氮 N', 'nitrogen'], ['碳骨架 C', 'carbon']]).map(([name, value]) => new Option(name, value)));
      previousModel = mol.id;
    }
    scene?.setAutoSpin(tour.running && !motion.matches);
    $('mol-name').textContent = schematic ? mol.name : `${mol.name} · ${subscript(mol.formula!)}`;
    $('mol-count').textContent = schematic ? `${mol.atoms.length} 个示意节点 · 16 对碱基` : `显示 ${visible.length} / 总计 ${mol.atomCount} 原子 · 省略 ${mol.atoms.length - visible.length} 个 H`;
    $('mol-model-note').textContent = schematic ? 'DNA 是基团级教学示意，不是全原子结构。节点、半径、间距与连接线均不用于化学测量。' : `PubChem 计算三维构象 · 完整分子含 ${mol.heavyAtomCount} 个非氢原子 + ${mol.hydrogenCount} 个 H。坐标单位 Å；球体大小仅为视觉示意，不表示真实电子云。`;
    $('mol-guide').textContent = GUIDE[mol.id];
    const source = $('mol-source') as HTMLAnchorElement;
    source.hidden = !mol.source;
    if (mol.source) { source.href = mol.source.url; source.textContent = `PubChem 来源 · CID ${mol.source.url.split('/').pop()} · 核验 ${mol.source.retrievedAt}`; }
    ($('mol-select') as HTMLSelectElement).value = mol.id;
    $('mol-pairs').hidden = !schematic;
    $('mol-hydrogen-wrap').hidden = schematic;
    $('mol-tour').textContent = tour.running ? '暂停巡游' : '开始巡游';
    $('mol-tour').setAttribute('aria-pressed', String(tour.running));
    $('mol-tour-note').textContent = tour.running ? '自动巡游中 · 9s 切换' : '已暂停自动切换';
    $('mol-legend').textContent = schematic ? '基团：磷酸 橙 · 糖 灰 · 碱基 A 红 / T 绿 / G 黄 / C 蓝；黄线表示配对' : '元素：C 灰 · H 白 · O 红 · N 蓝；双棍表示双键';
  };
  $('mol-select').addEventListener('change', (e) => tour.select((e.target as HTMLSelectElement).value), opts);
  $('mol-pairs').addEventListener('click', () => {
    showPairs = !showPairs;
    $('mol-pairs').textContent = showPairs ? '隐藏碱基对' : '显示碱基对';
    $('mol-pairs').setAttribute('aria-pressed', String(showPairs));
    tour.pause();
  }, opts);
  $('mol-hydrogen').addEventListener('change', (e) => { showHydrogen = (e.target as HTMLInputElement).checked; tour.pause(); }, opts);
  $('mol-style').addEventListener('change', (e) => { style = (e.target as HTMLSelectElement).value as RenderStyle; tour.pause(); }, opts);
  atomSelect.addEventListener('change', () => selectAtom(Number(atomSelect.value)), opts);
  groupSelect.addEventListener('change', () => {
    selected = -1;
    tour.pause();
    atomSelect.value = '-1';
    const indices = groupIndices(catalog[tour.current], groupSelect.value);
    scene?.setSelection(indices);
    $('mol-inspect').textContent = groupSelect.value === 'none' ? '点击球体，或用选择框查看说明。' : `高亮 ${indices.length} 个${tour.current === 'dna' ? '基团节点' : '原子'}。${GUIDE[tour.current]}`;
  }, opts);
  document.querySelectorAll<HTMLButtonElement>('[data-mol-compare]').forEach((button) => button.addEventListener('click', () => {
    tour.select(button.dataset.molCompare!);
    groupSelect.value = 'oxygen';
    groupSelect.dispatchEvent(new Event('change'));
  }, opts));
  $('mol-reset').addEventListener('click', () => { tour.pause(); scene?.resetView(); }, opts);
  $('mol-tour').addEventListener('click', () => tour.running ? tour.pause() : tour.start(), opts);
  motion.addEventListener('change', () => { if (motion.matches) tour.pause(); }, opts);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); tour.pause(); $('mol-view-status').textContent = '三维画面已中断，请刷新页面重试。模型说明仍可阅读。'; }, opts);
  document.addEventListener('visibilitychange', () => { if (document.hidden) tour.pause(); }, opts);
  window.addEventListener('pagehide', () => tour.pause(), opts);
  document.addEventListener('astro:before-swap', () => { tour.pause(); scene?.dispose(); events.abort(); }, { once: true });
  apply();
  if (!motion.matches && scene) tour.start();
}
