import { formatLength, scaleBar, type ScaleStop } from './model';
import { sceneAt, measureAxis, sceneLabels, measurementLabel, type SceneObject } from './scene';
import { paintIntermediate } from './illustrations';
type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const noise = (n: number): number => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function disc(c: C, x: number, y: number, r: number, fill: string | CanvasGradient) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill(); }
function line(c: C, points: number[], color: string, width: number) { c.beginPath(); for (let i = 0; i < points.length; i += 2) i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
function gradient(c: C, x: number, y: number, r: number, stops: [number, string][]) { const g = c.createRadialGradient(x, y, 0, 0, 0, r); stops.forEach(([at, color]) => g.addColorStop(at, color)); return g; }
function earth(c: C) {
  disc(c, 0, 0, .5, gradient(c, -.22, -.22, .7, [[0, '#98e1ef'], [.35, '#277caf'], [.72, '#123c65'], [1, '#07152f']]));
  c.save(); c.beginPath(); c.arc(0, 0, .498, 0, TAU); c.clip();
  c.fillStyle = '#88ad8c';
  c.beginPath(); c.moveTo(-.48, -.2); c.bezierCurveTo(-.31, -.38, -.17, -.47, -.09, -.33); c.lineTo(-.17, -.18); c.lineTo(-.08, -.07); c.lineTo(-.18, .02); c.lineTo(-.22, .15); c.lineTo(-.28, .01); c.lineTo(-.42, -.05); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-.13, .06); c.bezierCurveTo(.08, .02, .13, .14, -.01, .24); c.lineTo(-.07, .39); c.lineTo(-.16, .47); c.lineTo(-.22, .27); c.lineTo(-.23, .13); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(.15, -.43); c.lineTo(.3, -.46); c.lineTo(.48, -.29); c.lineTo(.38, -.09); c.lineTo(.27, -.05); c.lineTo(.29, .17); c.lineTo(.17, .26); c.lineTo(.07, .04); c.lineTo(.1, -.1); c.lineTo(.22, -.15); c.closePath(); c.fill();
  c.fillStyle = '#c4ddd6'; c.beginPath(); c.ellipse(0, -.48, .27, .05, 0, 0, TAU); c.fill();
  for (let i = 0; i < 230; i++) {
    const x = noise(i + 90) - .5, y = noise(i + 710) - .5;
    disc(c, x, y, .001 + noise(i) * .003, '#d6ecd917');
  }
  for (let i = 0; i < 11; i++) {
    const x = noise(i + 14) * .65 - .42, y = noise(i + 55) * .9 - .45;
    c.beginPath(); c.moveTo(x, y);
    c.bezierCurveTo(x + .1, y - .035, x + .12, y + .04, x + .22, y - .015);
    c.strokeStyle = `rgba(242,251,250,${.12 + noise(i + 20) * .4})`; c.lineWidth = .007 + noise(i + 44) * .012; c.lineCap = 'round'; c.stroke();
  }
  const shade = c.createLinearGradient(-.5, -.1, .5, .3); shade.addColorStop(0, '#05122300'); shade.addColorStop(.5, '#05122308'); shade.addColorStop(1, '#020b23c0'); c.fillStyle = shade; c.fillRect(-.5, -.5, 1, 1); c.restore();
  c.beginPath(); c.arc(0, 0, .505, 0, TAU); c.strokeStyle = '#87d1ed77'; c.lineWidth = .01; c.stroke();
}
function cup(c: C) {
  // Outer physical bounds: x=-.5 … .5, including the handle.
  c.strokeStyle = '#8eb5a6'; c.lineWidth = .085; c.beginPath(); c.ellipse(.32, -.005, .138, .19, .2, 0, TAU); c.stroke();
  c.strokeStyle = '#c4dfcb'; c.lineWidth = .04; c.beginPath(); c.ellipse(.318, -.018, .132, .18, .2, -.9, 1.9); c.stroke();
  const g = c.createLinearGradient(-.5, 0, .27, 0); g.addColorStop(0, '#4d7169'); g.addColorStop(.13, '#a0c7b4'); g.addColorStop(.37, '#d5e7cb'); g.addColorStop(.68, '#bbd8bd'); g.addColorStop(1, '#789d8a');
  c.beginPath(); c.moveTo(-.5, -.28); c.lineTo(.27, -.28); c.lineTo(.23, .27); c.bezierCurveTo(.2, .48, -.4, .48, -.46, .27); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); c.ellipse(-.115, -.28, .385, .115, 0, 0, TAU); c.fillStyle = '#dae8cf'; c.fill();
  c.beginPath(); c.ellipse(-.115, -.278, .341, .082, 0, 0, TAU); c.fillStyle = '#4d3528'; c.fill();
  c.beginPath(); c.ellipse(-.11, -.27, .31, .063, 0, 0, TAU); c.fillStyle = '#9e7350'; c.fill();
  c.strokeStyle = '#ecdebb'; c.lineWidth = .01;
  for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-.1, -.268, .12 - i * .014, .025 - i * .003, i * .1, -.3, 2.8); c.stroke(); }
  c.strokeStyle = '#f4f3de55'; c.lineWidth = .012; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const x = -.29 + i * .17; c.beginPath(); c.moveTo(x, -.45); c.bezierCurveTo(x + .11, -.58, x - .09, -.66, x, -.83); c.stroke(); }
  c.fillStyle = '#34695688'; c.font = '0.08px sans-serif'; c.textAlign = 'center'; c.fillText('此 刻', -.12, .07);
}
function city(c: C, block: boolean) {
  c.save();
  if (block) { c.beginPath(); c.rect(-.5, -.5, 1, 1); c.clip(); }
  else { c.beginPath(); c.arc(0, 0, .5, 0, TAU); c.clip(); }
  c.fillStyle = '#152d39'; c.fillRect(-.5, -.5, 1, 1);
  const n = block ? 6 : 25;
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
    const r = noise(x * 45 + y + 53); const size = 1 / n;
    c.fillStyle = r > .88 ? '#3d6855' : ['#37606b', '#7d9688', '#b3b99c', '#688283'][Math.floor(r * 4)];
    c.fillRect(-.5 + x * size + size * .12, -.5 + y * size + size * .12, size * .7, size * (.4 + noise(x * 22 + y) * .35));
    if (block && r < .7) { c.fillStyle = '#cee1c3'; c.fillRect(-.5 + x * size + size * .17, -.5 + y * size + size * .17, size * .5, size * .08); }
  }
  if (!block) {
    c.beginPath(); c.moveTo(-.58, .2); c.bezierCurveTo(-.22, -.15, .14, .45, .52, -.25); c.lineWidth = .065; c.strokeStyle = '#193747'; c.stroke(); c.lineWidth = .033; c.strokeStyle = '#7ab2c0'; c.stroke();
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, .12 + i * .13, .09 + i * .14, .2, 0, TAU); c.strokeStyle = '#dfd2a866'; c.lineWidth = .006; c.stroke(); }
    line(c, [-.5, -.28, .5, .27], '#e4d6b888', .008); line(c, [-.24, -.5, .21, .5], '#e4d6b888', .008);
  }
  c.restore(); c.strokeStyle = '#8cc3c177'; c.lineWidth = .004; c.stroke();
}
function galaxy(c: C) {
  c.save(); c.rotate(-.25);
  disc(c, 0, 0, .57, gradient(c, 0, 0, .57, [[0, '#f8d7b788'], [.14, '#cdb5ed44'], [.55, '#9185d41a'], [1, '#b48beb00']]));
  for (let arm = 0; arm < 4; arm++) {
    for (let ribbon = 0; ribbon < 8; ribbon++) {
      c.beginPath();
      for (let j = 0; j < 100; j++) {
        const r = .02 + j / 100 * .46, a = arm * Math.PI / 2 + r * 9 + (ribbon - 4) * .035;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        j ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.strokeStyle = ribbon % 2 ? '#a79ddd1c' : '#c2bdf328'; c.lineWidth = .026; c.stroke();
    }
  }
  for (let arm = 0; arm < 4; arm++) {
    for (let j = 0; j < 430; j++) {
      const r = .025 + .475 * Math.sqrt(j / 430); const a = arm * Math.PI / 2 + r * 9 + (noise(j * 7 + arm * 99) - .5) * .53;
      const rr = Math.min(.498, r * (.9 + noise(j * 13 + arm) * .13));
      disc(c, Math.cos(a) * rr, Math.sin(a) * rr, .0008 + noise(j + arm * 22) * .003, ['#dbc8fac7', '#adb7e9bb', '#f8dbb6a6', '#fcf0d8de'][j % 4]);
    }
  }
  for (let i = 0; i < 700; i++) { const a = noise(i + 638) * TAU, r = .49 * Math.sqrt(noise(i + 777)); disc(c, Math.cos(a) * r, Math.sin(a) * r, .0007 + noise(i + 124) * .0016, '#c8c6e566'); }
  c.beginPath(); c.ellipse(0, 0, .16, .046, .35, 0, TAU); c.fillStyle = '#e5c8c622'; c.fill();
  disc(c, 0, 0, .14, gradient(c, 0, 0, .14, [[0, '#fff4dc'], [.18, '#ffe9cddd'], [.5, '#e8c7d377'], [1, '#e2bbe000']])); c.restore();
}
function paintObject(c: C, stop: ScaleStop) {
  switch (stop.kind) {
    default: paintIntermediate(c, stop); break;
    case 'cup': cup(c); break;
    case 'earth': earth(c); break;
    case 'block': city(c, true); break;
    case 'city': city(c, false); break;
    case 'galaxy': galaxy(c); break;
    case 'dna': {
      for (let i = 0; i < 30; i++) { const x = -.5 + i / 29; const y = Math.sin(x * TAU / .34) * .1; line(c, [x, y, x, -y], i % 2 ? '#e6c7a077' : '#aacebb99', .008); }
      for (let strand = 0; strand < 2; strand++) { const p: number[] = []; for (let i = 0; i <= 200; i++) { const x = -.5 + i / 200; p.push(x, Math.sin(x * TAU / .34 + strand * Math.PI) * .1); } line(c, p, strand ? '#e5b894' : '#92dcda', .018); }
      break;
    }
    case 'cell': {
      disc(c, 0, 0, .5, gradient(c, -.1, -.1, .58, [[0, '#682842'], [.25, '#9a3e57'], [.52, '#dd7982'], [.7, '#f19a9e'], [.9, '#9c3b56'], [1, '#551d37']]));
      for (let i = 0; i < 80; i++) { const a = noise(i) * TAU, r = Math.sqrt(noise(i + 81)) * .46; disc(c, Math.cos(a) * r, Math.sin(a) * r, .003, '#ffd4c522'); }
      c.beginPath(); c.ellipse(-.055, -.035, .22, .17, -.3, 0, TAU); c.strokeStyle = '#ffc5bf55'; c.lineWidth = .009; c.stroke(); break;
    }
    case 'sand': {
      const points = [-.5, -.11, -.24, -.43, .12, -.39, .5, -.12, .38, .31, .03, .43, -.38, .31];
      c.beginPath(); for (let i = 0; i < points.length; i += 2) i ? c.lineTo(points[i], points[i + 1]) : c.moveTo(points[i], points[i + 1]); c.closePath(); c.fillStyle = '#d7b178'; c.fill();
      for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-.06, -.03); c.lineTo(points[i * 2], points[i * 2 + 1]); c.lineTo(points[((i + 1) % 7) * 2], points[((i + 1) % 7) * 2 + 1]); c.closePath(); c.fillStyle = ['#f4dca6', '#ad8b60', '#e4bf87', '#cda570', '#f2ce93', '#af8452', '#e7c58c'][i]; c.fill(); }
      break;
    }
    case 'person': {
      disc(c, 0, -.421, .079, '#e7c0a9'); c.fillStyle = '#d5bda8'; c.fillRect(-.033, -.358, .066, .045);
      c.fillStyle = '#b3b1d6'; c.beginPath(); c.moveTo(-.09, -.33); c.lineTo(.09, -.33); c.lineTo(.16, -.01); c.lineTo(.105, .01); c.lineTo(.07, -.15); c.lineTo(.08, .08); c.lineTo(-.08, .08); c.lineTo(-.07, -.15); c.lineTo(-.105, .01); c.lineTo(-.16, -.01); c.closePath(); c.fill();
      c.strokeStyle = '#697b90'; c.lineWidth = .073; c.beginPath(); c.moveTo(-.042, .06); c.lineTo(-.053, .45); c.moveTo(.042, .06); c.lineTo(.057, .45); c.stroke();
      line(c, [-.083, .481, -.019, .481], '#e9d9ba', .037); line(c, [.021, .481, .086, .481], '#e9d9ba', .037); break;
    }
    case 'moon-distance': {
      line(c, [-.5, 0, .5, 0], '#c6d7ec66', .0015);
      c.save(); c.translate(-.5, 0); c.scale(12_756_000 / stop.size, 12_756_000 / stop.size); earth(c); c.restore();
      disc(c, .5, 0, 1_740_000 / stop.size, '#e8ddd0'); break;
    }
    case 'sun': {
      disc(c, 0, 0, .63, gradient(c, 0, 0, .63, [[0, '#e7b65e44'], [.74, '#efa34822'], [1, '#ffca5700']]));
      disc(c, 0, 0, .5, gradient(c, -.16, -.16, .72, [[0, '#fff4bd'], [.45, '#ffdc84'], [.73, '#ec9d43'], [1, '#c96327']]));
      for (let i = 0; i < 260; i++) { const r = Math.sqrt(noise(i + 28)) * .49, a = noise(i) * TAU; disc(c, Math.cos(a) * r, Math.sin(a) * r, .002 + noise(i + 71) * .004, '#b65a2024'); }
      break;
    }
    case 'solar': {
      const radii = [.387, .723, 1, 1.524, 5.203, 9.537, 19.191, 30.06];
      radii.forEach((au, i) => { const r = au / 60.12; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.strokeStyle = i < 4 ? '#d9c89e88' : '#b4bfe066'; c.lineWidth = .0015; c.stroke(); const a = i * 2.4 + .5; disc(c, Math.cos(a) * r, Math.sin(a) * r, .007, ['#b0bdc8', '#edc598', '#81c4e8', '#d9957c', '#d2b894', '#efc894', '#9ac4c7', '#9eaee3'][i]); });
      disc(c, 0, 0, .012, '#fff1b8'); break;
    }
    case 'stellar': {
      line(c, [-.5, 0, .5, 0], '#d0b99a66', .0015);
      for (const [x, color] of [[-.5, '#ffe6a3'], [.5, '#eea788']] as const) {
        const g = c.createRadialGradient(x, 0, 0, x, 0, .07); g.addColorStop(0, color); g.addColorStop(.15, color + 'bb'); g.addColorStop(1, color + '00'); disc(c, x, 0, .07, g); disc(c, x, 0, .007, color);
      } break;
    }
  }
}
// A bounded LRU caches static vector paintings, not animation frames. Eight 768²
// surfaces cost at most ~18 MiB; the mobile bucket is 512² (~8 MiB).
const artwork = new Map<string, HTMLCanvasElement>();
function drawObject(c: C, object: SceneObject, width: number, dpr: number) {
  const resolution = width < 600 ? 512 : 768;
  // Never upscale a cached body beyond its available device pixels. Incoming
  // foregrounds use the original vector paths, preserving edges and texture.
  if (object.pixels * dpr > resolution / 1.7) {
    c.save(); c.globalAlpha = object.alpha; c.translate(object.x, object.y); c.scale(object.pixels, object.pixels); paintObject(c, object.stop); c.restore(); return;
  }
  const key = `${object.stop.id}:${resolution}`;
  let sprite = artwork.get(key);
  if (typeof document !== 'undefined' && !sprite) {
    sprite = document.createElement('canvas'); sprite.width = sprite.height = resolution;
    const paint = sprite.getContext('2d');
    if (paint) {
      paint.translate(resolution / 2, resolution / 2); paint.scale(resolution / 1.7, resolution / 1.7); paintObject(paint, object.stop);
      artwork.set(key, sprite);
      if (artwork.size > 8) artwork.delete(artwork.keys().next().value!);
    } else sprite = undefined;
  }
  c.save(); c.globalAlpha = object.alpha;
  if (sprite) {
    artwork.delete(key); artwork.set(key, sprite);
    const side = object.pixels * 1.7;
    c.drawImage(sprite, object.x - side / 2, object.y - side / 2, side, side);
  } else { c.translate(object.x, object.y); c.scale(object.pixels, object.pixels); paintObject(c, object.stop); }
  c.restore();
}
export function drawScale(c: C, width: number, height: number, exponent: number, focused: ScaleStop, dpr = 1) {
  c.clearRect(0, 0, width, height);
  const bg = c.createRadialGradient(width * .48, height * .5, 0, width * .48, height * .5, Math.max(width, height) * .85);
  bg.addColorStop(0, exponent < 6 ? '#162e35' : '#1d2842'); bg.addColorStop(1, '#08121d'); c.fillStyle = bg; c.fillRect(0, 0, width, height);
  for (let i = 0; i < 80; i++) { const x = noise(i + 390) * width, y = noise(i + 928) * height; disc(c, x, y, noise(i + 48) * .6 + .2, exponent > 6 ? '#e1e6f83d' : '#cee9dd16'); }
  const fraction = exponent - Math.floor(exponent), spacing = width * 10 ** -fraction;
  c.lineWidth = 1;
  for (let level = 0; level < 2; level++) {
    const s = spacing / 10 ** level;
    c.strokeStyle = level ? '#b5d4d906' : '#b5d4d912'; c.beginPath();
    for (let x = width / 2 % s; x < width; x += s) { c.moveTo(x, 0); c.lineTo(x, height); }
    for (let y = height * .52 % s; y < height; y += s) { c.moveTo(0, y); c.lineTo(width, y); } c.stroke();
  }
  const scene = sceneAt(exponent, width, height);
  // Every object uses the same metres-to-pixels conversion. Incoming large
  // shapes are clipped by the viewport, never shrunk to fit an arbitrary card.
  c.save(); c.beginPath(); c.rect(0, 0, width, height); c.clip();
  for (const object of [...scene.objects].reverse()) drawObject(c, object, width, dpr);
  c.restore();
  // Show up to three unambiguous labels. Tiny bodies fade at their actual size;
  // we do not enlarge them to keep them visible or cover the picture with prose.
  for (const anchor of sceneLabels(scene, width, height, focused)) {
    const object = anchor.object;
    const labelWidth = anchor.width;
    c.save(); c.globalAlpha = Math.min(1, object.visibleSpan / (width * .15));
    if (anchor.y < object.y || Math.abs(anchor.x - object.x) > 12) {
      const endpoint = Math.max(7, Math.min(width - 7, object.x));
      const startY = anchor.y < object.y ? anchor.y + 25 : anchor.y - 20;
      line(c, [anchor.x, startY, endpoint, object.y], object.stop.color + '44', 1);
    }
    c.fillStyle = '#081521df'; c.fillRect(anchor.x - labelWidth / 2 - 4, anchor.y - 16, labelWidth + 8, 42);
    const name = object.stop.name.replace('你手边的', '').replace('一个人的身高', '身高').replace('一枚', '').replace('一粒', '');
    c.textAlign = 'center'; c.font = `${width < 500 ? 12 : 14}px system-ui, sans-serif`;
    c.fillStyle = '#ebf1ee'; c.fillText(name, anchor.x, anchor.y, labelWidth);
    c.font = `${width < 500 ? 11 : 12}px system-ui, sans-serif`; c.fillStyle = object.stop.color; c.fillText(`${measurementLabel(object.stop)} ${formatLength(object.stop.size)}`, anchor.x, anchor.y + 19, labelWidth);
    if (object.stop.id === focused.id && object.pixels < width * .55 && object.pixels > 40) {
      if (measureAxis(object.stop) === 'vertical') { const x = object.x + object.pixels * .36; const top = object.y - object.pixels / 2; line(c, [x - 4, top, x + 4, top, x, top, x, top + object.pixels, x - 4, top + object.pixels, x + 4, top + object.pixels], object.stop.color + '99', 1); }
      else { const y = anchor.y - 15; line(c, [object.left, y - 4, object.left, y, object.right, y, object.right, y - 4], object.stop.color + '77', 1); }
    }
    c.restore();
  }
  const bar = scaleBar(exponent, width);
  line(c, [25, height - 27, 25 + bar.pixels, height - 27], '#e2e9e4', 2);
  line(c, [25, height - 32, 25, height - 22], '#e2e9e4', 1);
  line(c, [25 + bar.pixels, height - 32, 25 + bar.pixels, height - 22], '#e2e9e4', 1);
}
