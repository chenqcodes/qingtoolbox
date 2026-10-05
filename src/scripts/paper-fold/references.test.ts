import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyFoldLimit, SUN_DIAMETER_METRES, OBSERVABLE_UNIVERSE_DIAMETER_METRES, AU, LIGHT_YEAR_METRES, REFERENCES } from './model';
import { viewLog } from './draw';
import { JOURNEY_REFERENCES, adjacentReferences, projectedReferences, formatRatio } from './references';

test('dense reference ladder is ordered, explicit and spans every allowed thickness', () => {
  assert.equal(JOURNEY_REFERENCES.length, 46);
  assert.equal(new Set(JOURNEY_REFERENCES.map(ref => ref.id)).size, JOURNEY_REFERENCES.length);
  for (const [index, ref] of JOURNEY_REFERENCES.entries()) {
    assert.ok(ref.dimension.length > 5, ref.id);
    assert.ok(ref.metres > 0 && Number.isFinite(ref.metres));
    if (index) {
      const gap = ref.metres / JOURNEY_REFERENCES[index - 1].metres;
      assert.ok(gap > 1 && gap < 13, `${ref.id}: ${gap}`);
    }
    if (!ref.source) assert.match(ref.dimension, /示意/, ref.id);
    else assert.equal(new URL(ref.source.url).protocol, 'https:');
  }
  for (const existing of REFERENCES) assert.equal(JOURNEY_REFERENCES.find(ref => ref.id === existing.id), existing);
  assert.equal(JOURNEY_REFERENCES.at(-1)!.metres, OBSERVABLE_UNIVERSE_DIAMETER_METRES);
  const ref = (id: string) => JOURNEY_REFERENCES.find(item => item.id === id)!;
  assert.equal(ref('moon').metres, 3_475_000); assert.match(ref('moon').dimension, /平均直径/);
  assert.equal(ref('jupiter').metres, 142_984_000); assert.match(ref('jupiter').dimension, /赤道直径/);
  assert.equal(ref('earth-moon').metres, 384_400_000); assert.match(ref('earth-moon').dimension, /中心间平均/);
  assert.match(ref('everest').dimension, /海平面/); assert.match(ref('karman').dimension, /约定/);
  assert.equal(ref('jupiter-orbit').metres, 10.4 * AU); assert.match(ref('jupiter-orbit').dimension, /轨道长轴/);
  assert.equal(ref('light-day').metres, 299_792_458 * 86400);
  assert.equal(ref('light-year').metres, LIGHT_YEAR_METRES);
  assert.equal(ref('milky-way').metres, 100_000 * LIGHT_YEAR_METRES);
});

test('every fractional frame keeps a fully opaque 10px-or-larger reference on screen', () => {
  // 100 supported paper settings × the complete per-paper fractional journey × both scene heights.
  // This tests real projected size/opacity, not merely the presence of labels.
  for (let initial = 1; initial <= 100; initial++) {
    for (let eighth = 0; eighth <= journeyFoldLimit(initial / 100) * 8; eighth++) {
      const exponent = eighth / 8, mm = initial / 100;
      for (const area of [199, 260]) {
        const refs = projectedReferences(viewLog(exponent, mm), area, mm / 1000 * 2 ** exponent);
        assert.ok(refs.some(item => item.pixels >= 10 && item.pixels <= area && item.opacity === 1), `${mm} mm, fold ${exponent}, area ${area}`);
      }
    }
  }
});

test('neighbour pairs bracket displayed thickness through boundaries and transitions', () => {
  for (let initial = 1; initial <= 100; initial++) {
    for (let eighth = 0; eighth <= journeyFoldLimit(initial / 100) * 8; eighth++) {
      const metres = initial / 100_000 * 2 ** (eighth / 8);
      const { previous, next } = adjacentReferences(metres);
      if (!next) { assert.equal(previous?.id, 'observable-universe'); continue; }
      assert.ok(next.metres > metres);
      if (previous) {
        assert.ok(previous.metres <= metres);
        assert.equal(JOURNEY_REFERENCES.indexOf(next!), JOURNEY_REFERENCES.indexOf(previous) + 1);
        assert.doesNotMatch(formatRatio(metres / previous.metres), /NaN|Infinity/);
      } else assert.equal(next!.id, 'hair');
    }
  }
  for (const [index, ref] of JOURNEY_REFERENCES.entries()) {
    const neighbours = adjacentReferences(ref.metres);
    assert.equal(neighbours.previous, ref);
    assert.equal(neighbours.next, JOURNEY_REFERENCES[index + 1]);
  }
});

test('the original five landmarks leave gaps that the dense ladder closes', () => {
  const area = 199;
  const oldBlankFolds = Array.from({ length: 81 }, (_, n) => n).filter(n => !REFERENCES.some(ref => {
    const pixels = ref.metres * area / 2 ** viewLog(n, .1);
    return pixels >= 10 && pixels <= area;
  }));
  assert.ok(oldBlankFolds.length > 40);
  for (const n of oldBlankFolds) assert.ok(projectedReferences(viewLog(n, .1), area, .0001 * 2 ** n).some(item => item.pixels >= 10 && item.pixels <= area && item.opacity === 1));
});


test('stellar radius ratios become matching diameter ratios, with scoped uncertainty', () => {
  const get=(id:string)=>JOURNEY_REFERENCES.find(ref=>ref.id===id)!;
  for(const [id,ratio] of [['sirius',1.713],['arcturus',25.4],['aldebaran',44.2],['antares',700],['betelgeuse',764],['vy-cma',1420]] as const) {
    assert.equal(get(id).metres, ratio*SUN_DIAMETER_METRES);
    assert.equal(get(id).kind,'star');
    assert.match(get(id).dimension,/直径/);
    assert.doesNotMatch(get(id).dimension,/最大|纪录/);
  }
  assert.match(get('betelgeuse').dimension,/模型估计/);
  assert.match(get('vy-cma').dimension,/光球.*估计/);
  assert.ok(get('betelgeuse').metres < get('jupiter-orbit').metres);
  assert.ok(get('vy-cma').metres > get('jupiter-orbit').metres);
});

test('cosmic dimensions keep object extents distinct from intergalactic distances', () => {
  const get=(id:string)=>JOURNEY_REFERENCES.find(ref=>ref.id===id)!;
  for(const [id,ly,kind] of [['orion-nebula',24,'nebula'],['omega-centauri',150,'cluster'],['n44',1000,'nebula'],['small-magellanic',7000,'galaxy'],['andromeda',2.5e6,'distance'],['m87-distance',54e6,'distance'],['laniakea',520e6,'supercluster'],['observable-universe',92e9,'universe']] as const) {
    assert.equal(get(id).metres,ly*LIGHT_YEAR_METRES);assert.equal(get(id).kind,kind);assert.ok(get(id).source);
  }
  assert.match(get('andromeda').dimension,/距地球.*距离/);
  assert.match(get('m87-distance').dimension,/距地球/);
  assert.match(get('laniakea').dimension,/速度流域.*定义/);
  assert.match(get('observable-universe').dimension,/当前直径.*模型/);
});

test('visible silhouettes only depict the neighbouring named lengths', () => {
  for(let fold=0;fold<=journeyFoldLimit(.1);fold+=.03125) {
    const metres=.0001*2**fold, pair=adjacentReferences(metres);
    const visible=projectedReferences(viewLog(fold,.1),199,metres);
    assert.ok(visible.length<=2);
    assert.ok(visible.every(item=>item.reference===pair.previous||item.reference===pair.next));
  }
});
