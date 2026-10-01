import { hohmann, MU } from './physics';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// μ=1, r1=1, r2=2 → Δv1≈0.1547, Δv2≈0.1298
const expect1 = Math.sqrt(1 / 1) * (Math.sqrt((2 * 2) / (1 + 2)) - 1);
const expect2 = Math.sqrt(1 / 2) * (1 - Math.sqrt((2 * 1) / (1 + 2)));
const h = hohmann(1, 2, MU);
assert(Math.abs(h.a - 1.5) < 1e-9, `a=${h.a}`);
assert(Math.abs(h.dv1 - expect1) / expect1 < 1e-3, `dv1=${h.dv1}`);
assert(Math.abs(h.dv2 - expect2) / expect2 < 1e-3, `dv2=${h.dv2}`);

console.log('PASS: orbit-lab Hohmann OK');
console.log(`  dv1=${h.dv1.toFixed(6)} dv2=${h.dv2.toFixed(6)} total=${h.dvTotal.toFixed(6)}`);

import { transferPos, transferState } from './physics';
for (const [r1, r2] of [[1, 2], [3, 1], [2, 2], [0.5, 7]]) {
  const start = transferPos(r1, r2, 0), end = transferPos(r1, r2, 1);
  assert(Math.abs(start.x - r1) < 1e-9 && Math.abs(start.y) < 1e-9, 'departure endpoint');
  assert(Math.abs(end.x + r2) < 1e-9 && Math.abs(end.y) < 1e-9, 'arrival endpoint');
  const h = hohmann(r1, r2);
  assert(Math.sign(h.dv1) === Math.sign(r2 - r1), 'first burn direction');
  assert(Math.sign(h.dv2) === Math.sign(r2 - r1), 'second burn direction');
  for (const t of [0, .1, .5, .9, 1]) {
    const p = transferState(r1, r2, t);
    const radius = Math.hypot(p.x, p.y);
    assert(Math.abs(p.vx ** 2 + p.vy ** 2 - (2 / radius - 1 / h.a)) < 1e-9, 'vis viva');
    assert(Math.abs(p.x * p.vy - p.y * p.vx - Math.sqrt(r1 * r2 / h.a)) < 1e-9, 'angular momentum');
  }
  const returnPoint = transferState(r1, r2, 2);
  assert(Math.abs(returnPoint.x - r1) < 1e-9, 'one burn returns on ellipse');
}
assert(hohmann(2, 2).dvTotal === 0, 'equal-radius zero burn');
for (const bad of [0, -1, NaN, Infinity]) {
  let rejected = false; try { hohmann(bad, 2); } catch { rejected = true; }
  assert(rejected, 'invalid radius rejected');
}
console.log('PASS: endpoints, ascent/descent/equal radii, vis-viva, momentum and one-burn return');
