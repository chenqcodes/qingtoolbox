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
type Point = [number, number];
const webCache = new Map<string, [Point, Point][]>();
/** Seeded Voronoi cell edges form irregular filaments around visible voids.
 * Geometry is cached once, never regenerated while zooming. */
function webEdges(count: number, seed: number): [Point, Point][] {
  const key = `${count}:${seed}`;
  const cached = webCache.get(key); if (cached) return cached;
  const points: Point[] = Array.from({ length: count }, (_, i) => [noise(i * 7 + seed) - .5, noise(i * 7 + seed + 194) - .5]);
  const edges: [Point, Point][] = [], seen = new Set<string>();
  for (const [index, a] of points.entries()) {
    let polygon: Point[] = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
    for (const [other, b] of points.entries()) {
      if (other === index || !polygon.length) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const side = (p: Point) => (p[0] - mx) * dx + (p[1] - my) * dy;
      const clipped: Point[] = [];
      for (let j = 0; j < polygon.length; j++) {
        const p = polygon[j], q = polygon[(j + 1) % polygon.length], dp = side(p), dq = side(q);
        if (dp <= 0) clipped.push(p);
        if ((dp <= 0) !== (dq <= 0)) { const t = dp / (dp - dq); clipped.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
      polygon = clipped;
    }
    for (let j = 0; j < polygon.length; j++) {
      const p = polygon[j], q = polygon[(j + 1) % polygon.length];
      const edgeKey = [p.map(v => v.toFixed(5)).join(','), q.map(v => v.toFixed(5)).join(',')].sort().join(':');
      if (!seen.has(edgeKey)) { seen.add(edgeKey); edges.push([p,q]); }
    }
  }
  webCache.set(key, edges); return edges;
}
function web(c: C, count: number, seed: number, color: string) {
  const edges = webEdges(count, seed);
  for (const [i, [a, b]] of edges.entries()) {
    line(c, [...a, ...b], color + '12', .007); line(c, [...a, ...b], color + '50', .0014);
    const steps = Math.max(3, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 240));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, jitter = (noise(i * 73 + j + seed) - .5) * .006;
      dot(c, a[0] + (b[0] - a[0]) * t + jitter, a[1] + (b[1] - a[1]) * t + jitter, .0006 + noise(i * 17 + j) * .0014, color + (j % 4 ? '99' : 'da'));
    }
    glow(c, a[0], a[1], .006, color, '88'); dot(c, a[0], a[1], .0016, '#eee6efcc');
  }
}
/** Branches are a structural illustration, never an observed member map. */
function filament(c: C, a: Point, b: Point, bend: number, seed: number, color: string) {
  const points: number[] = [], dx = b[0] - a[0], dy = b[1] - a[1];
  for (let j = 0; j <= 100; j++) {
    const t = j / 100, curve = Math.sin(t * Math.PI) * bend;
    const x = a[0] + dx * t - dy * curve, y = a[1] + dy * t + dx * curve;
    points.push(x, y);
    for (let k = 0; k < 3; k++) {
      const spread = .005 + .005 * Math.sin(t * Math.PI);
      dot(c, x + (noise(seed + j * 13 + k) - .5) * spread, y + (noise(seed + j * 29 + k) - .5) * spread, .0007 + noise(j + seed + k * 71) * .002, color + 'aa');
    }
  }
  line(c, points, color + '15', .013); line(c, points, color + '50', .002);
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
    case 'supercluster': {
      const nodes: Point[] = [[-.49,-.08],[-.38,-.19],[-.33,.07],[-.21,-.02],[-.07,.055],[.1,-.05],[.28,-.14],[.49,-.03],[.13,.18],[.35,.29],[-.23,.29],[-.08,-.31],[.24,-.27]];
      const edges = [[0,1],[0,2],[1,3],[2,3],[3,4],[4,5],[5,6],[6,7],[5,8],[8,9],[4,10],[3,11],[6,12]];
      for (const [i, [a,b]] of edges.entries()) filament(c, nodes[a], nodes[b], (noise(i + 481) - .5) * .7, i * 137, '#bac4e8');
      nodes.forEach(([x,y], i) => {
        glow(c, x, y, i === 4 ? .065 : .024 + noise(i + 727) * .021, '#c9cbe7', '88');
        for (let j = 0; j < 35; j++) { const a = noise(i * 53 + j) * TAU, r = noise(i * 81 + j) * .025; galaxyMark(c, x + Math.cos(a) * r, y + Math.sin(a) * r, .003 + noise(j + 731) * .012, i * 29 + j); }
      }); break;
    }
    case 'laniakea': {
      const attraction: Point = [-.17,.07];
      const edges: [Point, Point][] = [
        [[-.48,-.15],[-.29,-.09]], [[-.43,.2],[-.3,.14]], [[-.29,-.41],[-.12,-.17]],
        [[-.03,-.44],[.09,-.23]], [[.25,-.37],[.09,-.23]], [[.47,-.17],[.27,-.08]],
        [[.49,.04],[.27,-.08]], [[.43,.29],[.18,.22]], [[.22,.42],[.18,.22]],
        [[-.03,.38],[-.02,.21]], [[-.29,-.09],attraction], [[-.3,.14],attraction],
        [[-.12,-.17],attraction], [[.09,-.23],[-.12,-.17]], [[.27,-.08],[.08,.035]],
        [[.18,.22],[.08,.035]], [[-.02,.21],attraction], [[.08,.035],attraction],
      ];
      for (const [i, [a,b]] of edges.entries()) {
        filament(c, a, b, (noise(i + 302) - .5) * 1.3, i * 251, '#e7c3a4');
        // Parallel, gently curved flow lines describe an asymmetric basin.
        for (const offset of [-.014,.014]) filament(c, [a[0],a[1]+offset], [b[0],b[1]+offset*.2], (noise(i + 302) - .5) * 1.3, i * 251 + 791, '#a7c9de');
        glow(c, b[0], b[1], .025, '#e5c39f', '66');
      }
      glow(c, attraction[0], attraction[1], .06, '#ffe2b9', '99'); break;
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
      c.fillStyle = '#0b17252b'; c.fillRect(-.5, -.5, 1, 1); web(c, 76, 337, '#b8c8ed');
      c.strokeStyle = '#b2cbe34d'; c.lineWidth = .0015; c.strokeRect(-.5, -.5, 1, 1); c.restore(); break;
    }
    case 'observable': {
      // This is a present-day spatial schematic. It does not pretend to be a
      // photograph outside the universe, nor a literal CMB sphere / physical rim.
      c.save(); c.beginPath(); c.arc(0, 0, .5, 0, TAU); c.clip();
      glow(c, 0, 0, .5, '#99afd1', '19'); web(c, 210, 617, '#b8cdeb');
      for (let i = 0; i < 2000; i++) { const a = noise(i + 73) * TAU, r = Math.sqrt(noise(i + 933)) * .498; dot(c, Math.cos(a) * r, Math.sin(a) * r, .0005 + noise(i + 473) * .0006, '#cad5e878'); }
      c.restore(); boundary(c, '#c6dcefbb');
      line(c, [-.02, 0, .02, 0], '#f6e5bdaa', .0018); line(c, [0, -.02, 0, .02], '#f6e5bdaa', .0018); break;
    }
  }
}
