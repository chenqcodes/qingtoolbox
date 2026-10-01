import type { Atom, Bond, Molecule } from './presets';
const BASE_COLOR: Record<string, number> = { A: 0xff6666, T: 0x55dd88, G: 0xffbb44, C: 0x5599ff };
/** Stylized group-level helix. It is deliberately NOT an atomic DNA model. */
export function buildDna(pairs = 16): Molecule {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const bases = ['A', 'T', 'G', 'C'] as const;
  const r = 2.2;
  const rise = 0.34 * 3.2;
  const twist = (Math.PI * 2) / 10.5;
  for (let i = 0; i < pairs; i++) {
    const a = i * twist;
    const y = (i - (pairs - 1) / 2) * rise;
    const base = bases[i % 4];
    const complement = base === 'A' ? 'T' : base === 'T' ? 'A' : base === 'G' ? 'C' : 'G';
    for (let side = 0; side < 2; side++) {
      const angle = a + side * Math.PI;
      const b = side === 0 ? base : complement;
      const start = atoms.length;
      const node = (el: Atom['el'], radius: number, kind: Atom['kind'], label: string, color?: number): Atom => ({ el, x: radius * Math.cos(angle), y, z: radius * Math.sin(angle), kind, label: `第 ${i + 1} 对 · 链 ${side + 1} · ${label}`, color });
      atoms.push(node('P', r, 'phosphate', '磷酸基团'), node('C', r - 0.7, 'sugar', '脱氧核糖'), node('N', r - 1.4, 'base', `碱基 ${b}`, BASE_COLOR[b]));
      bonds.push({ a: start, b: start + 1, kind: 'backbone' }, { a: start + 1, b: start + 2, kind: 'backbone' });
      if (i > 0) bonds.push({ a: start - 6, b: start, kind: 'backbone' });
    }
    bonds.push({ a: i * 6 + 2, b: i * 6 + 5, kind: 'pair' });
  }
  return { id: 'dna', name: `DNA 双螺旋示意（${pairs} bp）`, modelKind: 'schematic', atoms, bonds };
}
export function dnaChainCounts(mol: Molecule) {
  const p = mol.atoms.filter((atom) => atom.kind === 'phosphate').length;
  return { phosphates: p, half: p / 2 };
}
