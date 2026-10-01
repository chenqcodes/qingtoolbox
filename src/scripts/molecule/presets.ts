import waterData from './data/water.json';
import caffeineData from './data/caffeine.json';
import dopamineData from './data/dopamine.json';
import serotoninData from './data/serotonin.json';

export type AtomEl = 'C' | 'H' | 'O' | 'N' | 'P' | 'S';
export type Atom = { el: AtomEl; x: number; y: number; z: number; aid?: number; label?: string; color?: number; kind?: 'phosphate' | 'sugar' | 'base' };
export type Bond = { a: number; b: number; order?: number; kind?: 'pair' | 'backbone' };
export type Molecule = {
  id: string;
  name: string;
  atoms: Atom[];
  bonds: Bond[];
  formula?: string;
  atomCount?: number;
  hydrogenCount?: number;
  heavyAtomCount?: number;
  modelKind?: 'computed' | 'schematic';
  source?: { name: string; url: string; recordUrl: string; retrievedAt: string; coordinateType: string; conformerId: string; coordinateUnits: string };
};
export const ELEMENT_COLOR: Record<AtomEl, number> = { C: 0x8592a4, H: 0xeeeeee, O: 0xff5555, N: 0x5588ff, P: 0xffaa33, S: 0xe8d94a };
export const ELEMENT_RADIUS: Record<AtomEl, number> = { C: 0.35, H: 0.22, O: 0.32, N: 0.33, P: 0.4, S: 0.38 };
export const ELEMENT_NAME: Record<AtomEl, string> = { C: '碳', H: '氢', O: '氧', N: '氮', P: '磷', S: '硫' };
const convert = (data: { id: string; name: string; formula: string; atomCount: number; hydrogenCount: number; heavyAtomCount: number; atoms: { aid: number; el: string; x: number; y: number; z: number }[]; bonds: Bond[]; source: NonNullable<Molecule['source']> }): Molecule => ({ ...data, modelKind: 'computed', atoms: data.atoms.map((atom) => ({ ...atom, el: atom.el as AtomEl })) });
export const water = convert(waterData);
export const caffeine = convert(caffeineData);
export const dopamine = convert(dopamineData);
export const serotonin = convert(serotoninData);
export const PRESETS = [water, caffeine, dopamine, serotonin];

export function displayedAtomIndices(mol: Molecule, showHydrogen: boolean) {
  return mol.atoms.flatMap((atom, index) => showHydrogen || mol.modelKind === 'schematic' || atom.el !== 'H' ? [index] : []);
}
export function describeAtom(mol: Molecule, index: number): string {
  const atom = mol.atoms[index];
  if (!atom) return '请选择一个原子或示意节点。';
  if (mol.modelKind === 'schematic') return `${atom.label}。这是代表整个基团的示意节点，不是单个原子；节点间距离与连接线仅用于说明双链与配对。`;
  const neighbors = mol.bonds.filter((bond) => bond.a === index || bond.b === index);
  const links = neighbors.map((bond) => {
    const other = mol.atoms[bond.a === index ? bond.b : bond.a];
    return `${other.el} #${other.aid}（${bond.order === 2 ? '双' : bond.order === 3 ? '三' : '单'}键）`;
  });
  const bonded = neighbors.map(bond => ({ atom: mol.atoms[bond.a === index ? bond.b : bond.a], order: bond.order }));
  const group = atom.el === 'O' ? (
    mol.id === 'water' ? '水分子中的氧，与两个氢原子成键。' :
    bonded.some(n => n.atom.el === 'C' && n.order === 2) ? '属于羰基的氧。' :
    bonded.some(n => n.atom.el === 'H') && bonded.some(n => n.atom.el === 'C' && n.order === 1) ? '属于羟基的氧。' : ''
  ) : '';
  return `${ELEMENT_NAME[atom.el]} ${atom.el} · PubChem 原子 #${atom.aid}。${group}连接：${links.join('、')}。键级来自 PubChem；芳香体系采用一种交替单双键表示。`;
}
export function groupIndices(mol: Molecule, group: string): number[] {
  return mol.atoms.flatMap((atom, index) => {
    if (group === 'all') return [index];
    if (mol.modelKind === 'schematic') return atom.kind === group ? [index] : [];
    if (group === 'oxygen') return atom.el === 'O' ? [index] : [];
    if (group === 'nitrogen') return atom.el === 'N' ? [index] : [];
    if (group === 'carbon') return atom.el === 'C' ? [index] : [];
    return [];
  });
}
