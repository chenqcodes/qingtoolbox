import type { ScaleStop } from './model';
type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const noise = (n: number) => { const x = Math.sin(n * 129.71 + 73.3) * 47831.53; return x - Math.floor(x); };
function dot(c: C, x: number, y: number, r: number, color: string | CanvasGradient) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = color; c.fill(); }
function glow(c: C, x: number, y: number, r: number, color: string, alpha = '77') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + alpha); g.addColorStop(1, color + '00'); dot(c, x, y, r, g); }
function line(c: C, points: number[], color: string, thickness: number) { c.beginPath(); points.forEach((x, i) => { if (i % 2) return; i ? c.lineTo(x, points[i + 1]) : c.moveTo(x, points[i + 1]); }); c.strokeStyle = color; c.lineWidth = thickness; c.stroke(); }
function boundary(c: C, color: string) {
  // Short arcs mean an extent reference, not a solid wall or luminous shell.
  for (let i = 0; i < 80; i++) { c.beginPath(); c.arc(0, 0, .5, i / 80 * TAU, (i + .42) / 80 * TAU); c.lineWidth = .0016; c.strokeStyle = color; c.stroke(); }
}
function galaxyMark(c: C, x: number, y: number, size: number, seed: number, spiral = false) {
  c.save(); c.translate(x, y); c.rotate(noise(seed) * TAU);
  c.scale(size, size * (.35 + noise(seed + 25) * .45));
  glow(c, 0, 0, .5, spiral ? '#acc8ef' : '#ebd2b4', 'aa');
  if (spiral) for (let arm = 0; arm < 2; arm++) {
    const p: number[] = [];
    for (let j = 0; j < 42; j++) { const r = j / 42 * .48, a = r * 8 + arm * Math.PI; p.push(Math.cos(a) * r, Math.sin(a) * r); }
    line(c, p, '#b7c6eba6', .04);
  }
  glow(c, 0, 0, .18, '#ffead1', 'cc'); c.restore();
}
/** An illustrative web, not a catalogue. Every node is stable as the camera moves.
 * Projected physical width is exactly 1; glow and node sizes are explicitly marks. */
function web(c: C, cells: number, seed: number, color: string) {
  const nodes: [number, number][] = [];
  for (let y = 0; y <= cells; y++) for (let x = 0; x <= cells; x++) {
    const id = y * (cells + 1) + x;
    nodes.push([-.5 + (x + (noise(id + seed) - .5) * .66) / cells, -.5 + (y + (noise(id + seed + 230) - .5) * .66) / cells]);
  }
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const id = y * (cells + 1) + x, a = nodes[id];
    const neighbors = [id + 1, id + cells + 1];
    if (noise(id + seed + 25) > .7) neighbors.push(id + cells + 2);
    for (const neighbor of neighbors) {
      const b = nodes[neighbor];
      line(c, [...a, ...b], color + '16', .019 / cells);
      line(c, [...a, ...b], color + '30', .007 / cells);
      for (let j = 0; j < 12; j++) {
        const t = j / 12, jitter = (noise(id * 71 + neighbor * 31 + j) - .5) * .027 / cells;
        const px = a[0] + (b[0] - a[0]) * t + jitter, py = a[1] + (b[1] - a[1]) * t + jitter;
        dot(c, px, py, (.003 + noise(id * 13 + j) * .007) / cells, color + (j % 4 ? '8c' : 'ce'));
      }
    }
    glow(c, a[0], a[1], .055 / cells, color, '77');
    dot(c, a[0], a[1], .01 / cells, '#eee6efcc');
  }
}
export function paintExtragalactic(c: C, stop: ScaleStop): void {
  switch (stop.kind) {
    case 'galaxy-group': {
      boundary(c, '#a7d4e333');
      // Disc regions and luminous member markers are shown separately.
      for (const [x, y, r] of [[-.14, .06, .24], [.12, -.04, .2], [.26, .19, .12]]) glow(c, x, y, r, '#7fafd3', '12');
      for (let i = 0; i < 48; i++) {
        const a = noise(i + 53) * TAU, r = Math.sqrt(noise(i + 343)) * .46;
        galaxyMark(c, Math.cos(a) * r, Math.sin(a) * r, .012 + noise(i + 212) * .018, i + 97, i % 3 === 0);
      }
      galaxyMark(c, -.15, .04, .075, 22, true); galaxyMark(c, .1, -.02, .1, 53, true); galaxyMark(c, .22, .16, .047, 37, true); break;
    }
    case 'galaxy-cluster': {
      boundary(c, '#dfc8ae22'); glow(c, 0, 0, .5, '#8d9fce', '22');
      glow(c, -.08, -.04, .28, '#a9b4df', '33'); glow(c, .15, .08, .17, '#8ebad8', '20');
      for (let i = 0; i < 390; i++) {
        const a = noise(i + 21) * TAU, r = noise(i + 701) ** .85 * .475;
        galaxyMark(c, Math.cos(a) * r, Math.sin(a) * r, .008 + noise(i + 11) ** 3 * .03, i + 702, i % 7 === 0);
      }
      galaxyMark(c, -.055, -.024, .095, 940); galaxyMark(c, .075, .025, .068, 137); break;
    }
    case 'supercluster': case 'laniakea': {
      c.save(); c.beginPath(); c.ellipse(0, 0, .5, stop.kind === 'supercluster' ? .34 : .46, 0, 0, TAU); c.clip();
      const branches = stop.kind === 'laniakea' ? 23 : 12;
      for (let i = 0; i < branches; i++) {
        const a = i / branches * TAU, points: number[] = [];
        const length = .3 + noise(i + 288) * .24;
        for (let j = 0; j < 80; j++) {
          const t = j / 79, r = t * length;
          const x = -.1 + Math.cos(a + .8 * t) * r * 1.12, y = .02 + Math.sin(a + .8 * t) * r * (stop.kind === 'supercluster' ? .66 : .9);
          points.push(x, y);
          if (j % 4 === 0) { glow(c, x, y, .012 + noise(i * 88 + j) * .008, stop.color, '66'); dot(c, x, y, .0018 + noise(j + i * 11) * .003, '#ede3f0cc'); }
          if (j % 17 === 0 && j) galaxyMark(c, x, y, .026, i * 62 + j, true);
        }
        line(c, points, stop.color + '35', .003); line(c, points, stop.color + '0b', .013);
      }
      glow(c, -.1, .02, .1, '#f4d3b3', '66'); c.restore(); break;
    }
    case 'wall': {
      c.save(); c.beginPath(); c.rect(-.5, -.35, 1, .7); c.clip();
      for (let branch = 0; branch < 8; branch++) {
        const points: number[] = [];
        for (let i = 0; i <= 180; i++) {
          const x = -.5 + i / 180, y = Math.sin(x * 7) * .14 + Math.sin(x * 15 + branch) * .026 + (branch - 3.5) * .016;
          points.push(x, y);
          const jitter = (noise(i * 37 + branch * 99) - .5) * .035;
          dot(c, x, y + jitter, .0015 + noise(i + branch * 250) * .0025, branch % 3 ? '#b4c9edbb' : '#f1d1bacc');
          if (i % 18 === 0) glow(c, x, y, .018, '#b9c8e9', '55');
        }
        line(c, points, '#9eb5dc1d', .012);
      }
      c.restore(); break;
    }
    case 'cosmic-web': {
      c.save(); c.beginPath(); c.rect(-.5, -.5, 1, 1); c.clip();
      c.fillStyle = '#0b17252b'; c.fillRect(-.5, -.5, 1, 1); web(c, 9, 337, '#b8c8ed');
      c.strokeStyle = '#b2cbe34d'; c.lineWidth = .0015; c.strokeRect(-.5, -.5, 1, 1); c.restore(); break;
    }
    case 'observable': {
      // This is a present-day spatial schematic. It does not pretend to be a
      // photograph outside the universe, nor a literal CMB sphere / physical rim.
      c.save(); c.beginPath(); c.arc(0, 0, .5, 0, TAU); c.clip();
      glow(c, 0, 0, .5, '#99afd1', '19'); web(c, 25, 617, '#abbfe3');
      for (let i = 0; i < 2000; i++) { const a = noise(i + 73) * TAU, r = Math.sqrt(noise(i + 933)) * .498; dot(c, Math.cos(a) * r, Math.sin(a) * r, .0005 + noise(i + 473) * .0006, '#cad5e878'); }
      c.restore(); boundary(c, '#c6dcefbb');
      line(c, [-.02, 0, .02, 0], '#f6e5bdaa', .0018); line(c, [0, -.02, 0, .02], '#f6e5bdaa', .0018); break;
    }
  }
}
