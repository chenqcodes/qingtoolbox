import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PRESETS, displayedAtomIndices, describeAtom, groupIndices } from './presets';
import { buildDna } from './dna';
const expected = { water: [3, 2, 2], caffeine: [24, 10, 25], dopamine: [22, 11, 22], serotonin: [25, 12, 26] };
for (const mol of PRESETS) test(`${mol.id}: source atom counts, full valence, bond order and H filtering agree`, () => {
  const [total, hydrogen, bonds] = expected[mol.id as keyof typeof expected];
  assert.equal(mol.atoms.length, total); assert.equal(mol.atomCount, total);
  assert.equal(mol.atoms.filter((atom) => atom.el === 'H').length, hydrogen);
  assert.equal(mol.bonds.length, bonds);
  assert.equal(displayedAtomIndices(mol, false).length, total - hydrogen);
  assert.equal(displayedAtomIndices(mol, true).length, total);
  assert.equal(new Set(mol.atoms.map((atom) => atom.aid)).size, total);
  const valence = Array(total).fill(0);
  const pairs = new Set<string>();
  for (const bond of mol.bonds) {
    assert.ok(bond.a >= 0 && bond.a < total && bond.b >= 0 && bond.b < total);
    assert.notEqual(bond.a, bond.b); assert.ok([1, 2].includes(bond.order!));
    const key = [bond.a, bond.b].sort((a, b) => a - b).join('-'); assert.ok(!pairs.has(key)); pairs.add(key);
    valence[bond.a] += bond.order!; valence[bond.b] += bond.order!;
  }
  mol.atoms.forEach((atom, index) => {
    assert.ok([atom.x, atom.y, atom.z].every(Number.isFinite));
    assert.equal(valence[index], { H: 1, O: 2, C: 4, N: 3, P: 5, S: 2 }[atom.el]);
  });
  assert.equal(mol.source?.coordinateType, 'computed-3d');
  const counts: Record<string, number> = {};
  for (const atom of mol.atoms) counts[atom.el] = (counts[atom.el] ?? 0) + 1;
  const formula = [...mol.formula!.matchAll(/([A-Z][a-z]?)(\d*)/g)].map((match) => [match[1], Number(match[2] || 1)]);
  assert.deepEqual(Object.fromEntries(formula), counts);
});

test('oxygen comparison labels match actual attached H and double bonds', () => {
  for (const mol of PRESETS.filter((mol) => mol.id !== 'water')) {
    const oxygen = groupIndices(mol, 'oxygen');
    assert.equal(oxygen.length, mol.id === 'serotonin' ? 1 : 2);
    for (const index of oxygen) assert.match(describeAtom(mol, index), mol.id === 'caffeine' ? /羰基/ : /羟基/);
  }
});

test('DNA nodes and links are explicitly group-level proxies, with complementary bases', () => {
  const dna = buildDna(16);
  assert.equal(dna.modelKind, 'schematic'); assert.equal(dna.atoms.length, 96);
  assert.equal(displayedAtomIndices(dna, false).length, 96);
  assert.equal(groupIndices(dna, 'phosphate').length, 32);
  assert.equal(groupIndices(dna, 'base').length, 32);
  assert.match(describeAtom(dna, 0), /不是单个原子/);
  for (const bond of dna.bonds.filter((bond) => bond.kind === 'pair')) {
    const pair = [dna.atoms[bond.a].label!.slice(-1), dna.atoms[bond.b].label!.slice(-1)].sort().join('');
    assert.ok(['AT', 'CG'].includes(pair)); assert.equal(bond.order, undefined);
  }
});

test('stored exported source hashes match the immutable raw snapshots', () => {
  for (const mol of PRESETS) {
    const exported = JSON.parse(readFileSync(new URL(`./data/${mol.id}.json`, import.meta.url), 'utf8'));
    const raw = readFileSync(new URL(`./data/raw/${mol.id}.pubchem-3d.json`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), exported.source.sha256);
  }
});

test('water oxygen is not mislabeled as a hydroxyl functional group', () => {
  const water = PRESETS.find(mol => mol.id === 'water')!;
  const oxygen = water.atoms.findIndex(atom => atom.el === 'O');
  assert.match(describeAtom(water, oxygen), /水分子中的氧/);
  assert.doesNotMatch(describeAtom(water, oxygen), /羟基|羰基/);
});
