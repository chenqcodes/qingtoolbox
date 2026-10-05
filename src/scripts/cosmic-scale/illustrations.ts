import { AU, type ScaleStop } from './model';
type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const random = (n: number) => { const x = Math.sin(n * 131.71 + 61.3) * 47831.53; return x - Math.floor(x); };
function dot(c: C, x: number, y: number, r: number, color: string | CanvasGradient) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = color; c.fill(); }
function path(c: C, points: number[], color: string, lineWidth = .008, fill = false) { c.beginPath(); points.forEach((v, i) => { if (i % 2) return; i ? c.lineTo(v, points[i + 1]) : c.moveTo(v, points[i + 1]); }); c.strokeStyle = color; c.lineWidth = lineWidth; if (fill) { c.closePath(); c.fillStyle = color; c.fill(); } else c.stroke(); }
function glow(c: C, x: number, y: number, r: number, color: string, opacity = '99') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color + opacity); g.addColorStop(1, color + '00'); dot(c, x, y, r, g); }
function ring(c: C, r: number, color: string, width = .003) { c.beginPath(); c.arc(0, 0, r, 0, TAU); c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
function sphere(c: C, color: string, light: string, shade: string) { const g = c.createRadialGradient(-.19, -.21, 0, 0, 0, .64); g.addColorStop(0, light); g.addColorStop(.52, color); g.addColorStop(1, shade); dot(c, 0, 0, .5, g); }
function clipDisc(c: C) { c.beginPath(); c.arc(0, 0, .5, 0, TAU); c.clip(); }
function starField(c: C, count: number, concentrate: boolean) {
  for (let i = 0; i < count; i++) {
    const r = .5 * (concentrate ? random(i + 98) ** 1.8 : Math.sqrt(random(i + 98)));
    const a = random(i + 739) * TAU;
    dot(c, Math.cos(a) * r, Math.sin(a) * r, .001 + random(i + 131) * .0035, ['#f7d7a8', '#dddeff', '#accaff', '#fff4da'][i % 4]);
  }
}
/** All painted dimensions are normalized to one selected physical dimension.
 * Line/glow thickness is illustrative; solid body bounds and orbit axes are not. */
export function paintIntermediate(c: C, stop: ScaleStop): void {
  switch (stop.kind) {
    case 'virus': {
      sphere(c, '#807eb2', '#d7d3f6', '#35334f');
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; path(c, [Math.cos(a) * .41, Math.sin(a) * .41, Math.cos(a) * .49, Math.sin(a) * .49], '#c2b5ef', .023); dot(c, Math.cos(a) * .477, Math.sin(a) * .477, .02, '#e0d6fd'); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; path(c, [0, 0, Math.cos(a) * .38, Math.sin(a) * .38, Math.cos(a + TAU / 6) * .38, Math.sin(a + TAU / 6) * .38, 0, 0], '#d8d2f888', .007); }
      for (let i = 0; i < 80; i++) { const a = random(i) * TAU, r = Math.sqrt(random(i + 30)) * .36; dot(c, Math.cos(a) * r, Math.sin(a) * r, .004, '#e0cef088'); } break;
    }
    case 'bacterium': {
      c.beginPath(); c.ellipse(0, 0, .5, .2, 0, 0, TAU); c.fillStyle = '#9dc798'; c.fill(); c.strokeStyle = '#d0e8b8'; c.lineWidth = .008; c.stroke();
      c.beginPath(); c.ellipse(0, -.025, .44, .14, 0, 0, TAU); c.fillStyle = '#c9dba8'; c.fill();
      const points: number[] = []; for (let i = 0; i <= 160; i++) points.push(-.3 + i / 160 * .6, Math.sin(i * .35) * .07 + Math.cos(i * .19) * .04); path(c, points, '#568e83', .007);
      for (let i = 0; i < 55; i++) dot(c, (random(i + 77) - .5) * .78, (random(i + 199) - .5) * .21, .007, '#61755a66'); break;
    }
    case 'pollen': {
      sphere(c, '#cc9e48', '#f5dd87', '#634521');
      for (let i = 0; i < 110; i++) { const a = random(i + 10) * TAU, r = Math.sqrt(random(i + 33)) * .43; const x = Math.cos(a) * r, y = Math.sin(a) * r; dot(c, x, y, .018, '#6a4c2255'); dot(c, x - .004, y - .006, .012, '#f5d479'); }
      for (let i = 0; i < 26; i++) { const a = i / 26 * TAU; path(c, [Math.cos(a - .034) * .464, Math.sin(a - .034) * .464, Math.cos(a) * .5, Math.sin(a) * .5, Math.cos(a + .034) * .464, Math.sin(a + .034) * .464], '#ddba66', .005, true); } break;
    }
    case 'seed': {
      const g = c.createLinearGradient(-.5, -.2, .5, .2); g.addColorStop(0, '#a88450'); g.addColorStop(.4, '#f0d9a9'); g.addColorStop(1, '#b69768');
      c.beginPath(); c.moveTo(-.5, 0); c.bezierCurveTo(-.22, -.31, .33, -.33, .5, 0); c.bezierCurveTo(.33, .3, -.22, .3, -.5, 0); c.fillStyle = g; c.fill();
      for (let i = 0; i < 8; i++) { const y = (i - 3.5) * .046; c.beginPath(); c.moveTo(-.43, 0); c.bezierCurveTo(-.15, y, .14, y, .43, 0); c.strokeStyle = '#88633c44'; c.lineWidth = .006; c.stroke(); } break;
    }
    case 'coin': {
      sphere(c, '#baa568', '#f7e6b6', '#746035'); ring(c, .465, '#f7e8bf', .016); ring(c, .399, '#8e773d', .009);
      for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; path(c, [Math.cos(a) * .43, Math.sin(a) * .43, Math.cos(a) * .45, Math.sin(a) * .45], '#806c3d', .004); }
      path(c, [0, -.22, .053, -.065, .215, -.065, .086, .03, .135, .19, 0, .09, -.135, .19, -.086, .03, -.215, -.065, -.053, -.065], '#d9c790', .01, true); break;
    }
    case 'tree': {
      path(c, [-.029, .5, -.018, -.27, .026, -.29, .043, .5], '#af9274', .02, true);
      for (let i = 0; i < 18; i++) { const y = .29 - i * .04, side = i % 2 ? 1 : -1; path(c, [0, y, side * (.15 + random(i) * .09), y - .16], '#af9274', .013); }
      for (let i = 0; i < 105; i++) { const a = random(i + 37) * TAU, r = Math.sqrt(random(i + 101)); const x = Math.cos(a) * r * .29, y = -.18 + Math.sin(a) * r * .24; dot(c, x, y, .03 + random(i + 8) * .034, ['#678d57', '#8faf74', '#a7c786', '#456d4a'][i % 4]); }
      dot(c, 0, -.44, .06, '#a7c786'); path(c, [-.07, .5, .079, .5], '#b9a586', .009); break;
    }
    case 'park': case 'region': {
      c.save(); c.beginPath(); c.rect(-.5, -.5, 1, 1); c.clip(); c.fillStyle = stop.kind === 'park' ? '#31534c' : '#263f4b'; c.fillRect(-.5, -.5, 1, 1);
      if (stop.kind === 'park') {
        for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { const n = random(i * 24 + j); c.fillStyle = n > .75 ? '#84a886' : n > .48 ? '#aeae91' : '#637f76'; c.fillRect(-.5 + i / 24 + .004, -.5 + j / 24 + .004, .029, .027); }
        for (let i = 0; i < 5; i++) { path(c, [-.5, -.43 + i * .2, .5, -.43 + i * .2], '#d2c3a188', .013); path(c, [-.4 + i * .2, -.5, -.4 + i * .2, .5], '#d2c3a177', .013); }
      } else {
        for (let i = 0; i < 155; i++) { const x = random(i) - .5, y = random(i + 82) - .5, r = .04 + random(i + 951) * .15; dot(c, x, y, r, ['#68876a', '#4d6e56', '#84a17c', '#9ba787', '#3d6154'][i % 5]); }
        for (let i = 0; i < 17; i++) { const y = -.5 + i * .065; const p: number[] = []; for (let j = 0; j <= 40; j++) { const x = -.55 + j / 36; p.push(x, y + Math.sin(j * .48 + i * .3) * .07); } path(c, p, '#d1d6b644', .009); }
      }
      c.beginPath(); c.moveTo(-.6, .25); c.bezierCurveTo(-.21, -.36, .12, .38, .6, -.24); c.strokeStyle = '#183d52'; c.lineWidth = .09; c.stroke(); c.strokeStyle = '#81bacc'; c.lineWidth = .026; c.stroke(); c.restore(); break;
    }
    case 'moon-body': {
      sphere(c, '#939da3', '#e2e3db', '#333b47'); c.save(); clipDisc(c);
      for (let i = 0; i < 11; i++) { const a = random(i + 103) * TAU, r = Math.sqrt(random(i + 52)) * .4; dot(c, Math.cos(a) * r, Math.sin(a) * r, .04 + random(i + 9) * .11, '#5b66784d'); }
      for (let i = 0; i < 100; i++) { const a = random(i + 70) * TAU, r = Math.sqrt(random(i + 257)) * .49; const x = Math.cos(a) * r, y = Math.sin(a) * r, size = .003 + random(i + 300) ** 3 * .035; dot(c, x, y, size, '#48505d88'); c.beginPath(); c.arc(x, y, size, -.3, 3.2); c.strokeStyle = '#e6e6d77d'; c.lineWidth = .002; c.stroke(); } c.restore(); break;
    }
    case 'jupiter': {
      sphere(c, '#cdb191', '#fae6c6', '#6e645a'); c.save(); clipDisc(c);
      for (let i = 0; i < 30; i++) { const p: number[] = []; for (let j = 0; j <= 100; j++) p.push(-.5 + j / 100, -.5 + i / 30 + Math.sin(j * .12 + i) * .008); path(c, p, ['#c5a58b', '#e7d7b6', '#af8972', '#e9ddc8', '#cbb9a0'][i % 5], .027); }
      c.beginPath(); c.ellipse(.19, .13, .085, .046, -.1, 0, TAU); c.fillStyle = '#b97d64'; c.fill(); c.beginPath(); c.ellipse(.2, .126, .062, .028, -.1, 0, TAU); c.strokeStyle = '#e3b996'; c.lineWidth = .007; c.stroke();
      const shade = c.createLinearGradient(-.5, -.2, .5, .2); shade.addColorStop(0, '#07152a00'); shade.addColorStop(.6, '#07152a09'); shade.addColorStop(1, '#07152aa0'); c.fillStyle = shade; c.fillRect(-.5, -.5, 1, 1); c.restore(); break;
    }
    case 'giant': {
      glow(c, 0, 0, .6, '#ee8559', '66'); sphere(c, '#e28449', '#ffe0a1', '#973b2a'); c.save(); clipDisc(c);
      for (let i = 0; i < 240; i++) { const a = random(i + 10) * TAU, r = Math.sqrt(random(i + 33)) * .5; const x = Math.cos(a) * r, y = Math.sin(a) * r; dot(c, x, y, .008 + random(i + 442) * .035, i % 3 ? '#ffe4a024' : '#7d28183b'); } c.restore(); break;
    }
    case 'orbit': {
      ring(c, .5, stop.color + 'cc', .003); ring(c, .5, stop.color + '22', .016); dot(c, 0, 0, .009, '#ffe7a1'); glow(c, 0, 0, .05, '#ffd791');
      if (stop.id === 'earth-orbit') { ring(c, .5 * .387, '#cebd9666'); ring(c, .5 * .723, '#cebd9666'); }
      dot(c, .5 * Math.cos(.8), .5 * Math.sin(.8), .012, stop.color); break;
    }
    case 'heliosphere': {
      glow(c, 0, 0, .5, '#72bfdc', '11'); ring(c, .5, '#8ed0e766', .004);
      for (let i = 0; i < 27; i++) { const a = i / 27 * TAU; const p: number[] = []; for (let j = 0; j <= 30; j++) { const r = .06 + j / 30 * .43; p.push(Math.cos(a + r * .45) * r, Math.sin(a + r * .45) * r); } path(c, p, '#8ed0e72c', .004); }
      ring(c, 30.06 / 240, '#d6c8efbb'); dot(c, 0, 0, .007, '#f8dfad'); break;
    }
    case 'comet-orbit': {
      const e = .85, b = .5 * Math.sqrt(1 - e * e);
      c.beginPath(); c.ellipse(0, 0, .5, b, 0, 0, TAU); c.strokeStyle = '#a7c6d5'; c.lineWidth = .003; c.stroke(); dot(c, -.5 * e, 0, .007, '#ffe4a0'); glow(c, -.5 * e, 0, .033, '#ffd79b');
      const x = .5 * Math.cos(-.9), y = b * Math.sin(-.9); glow(c, x, y, .035, '#c8e8ef'); dot(c, x, y, .006, '#e5f4f7'); path(c, [x, y, x + .11, y - .035], '#c2e3ee77', .005); break;
    }
    case 'oort': {
      glow(c, 0, 0, .5, '#8fb1ee', '0e');
      for (let i = 0; i < 800; i++) { const a = random(i + 82) * TAU, z = random(i + 851) * 2 - 1; const r = (.32 + random(i + 410) * .18) * Math.sqrt(1 - z * z); dot(c, Math.cos(a) * r, Math.sin(a) * r, .001 + random(i + 525) * .002, i % 3 ? '#adc6e388' : '#f6e9dca6'); }
      ring(c, .5, '#92aed12a', .002); dot(c, 0, 0, .006, '#f6deab'); glow(c, 0, 0, .028, '#e8cea9');
      const r = 30.06 * AU / stop.size; if (r > .004) ring(c, r, '#e3d3f999', .002); break;
    }
    case 'nebula': {
      c.save(); c.beginPath(); c.rect(-.5, -.4, 1, .8); c.clip();
      for (let i = 0; i < 85; i++) { const x = (random(i + 84) - .5) * .87, y = (random(i + 301) - .5) * .56 + Math.sin(x * 7) * .1; glow(c, x, y, Math.max(.01, Math.min(.08 + random(i + 38) * .14, .5 - Math.abs(x), .4 - Math.abs(y))), i % 3 ? '#c978ab' : '#76c5d1', '48'); }
      for (let i = 0; i < 14; i++) { const x = -.45 + i / 14 * .9, y = Math.sin(x * 9) * .1; glow(c, x, y, .07, '#081321', 'bb'); }
      for (let i = 0; i < 100; i++) dot(c, random(i + 5) - .5, (random(i + 106) - .5) * .7, .001 + random(i + 384) * .003, '#faf0e6aa');
      glow(c, -.1, -.04, .11, '#edcfeb', 'bb'); dot(c, -.1, -.04, .008, '#fff3dd'); c.restore(); break;
    }
    case 'cluster': {
      glow(c, 0, 0, .5, '#bdc3de', '22'); glow(c, 0, 0, .24, '#f7d9b0', '55'); starField(c, 1400, true); break;
    }
    case 'bubble': {
      for (let j = 0; j < 10; j++) { const p: number[] = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * TAU; const r = .41 + Math.sin(a * 3) * .035 + Math.sin(a * 7) * .023 + j * .002; p.push(Math.cos(a) * r, Math.sin(a) * r); } path(c, p, j % 3 ? '#8fccce33' : '#e4b6ce44', .006); }
      for (let i = 0; i < 40; i++) { const a = random(i + 144) * TAU, r = .43; glow(c, Math.cos(a) * r, Math.sin(a) * r, .023 + random(i) * .025, i % 3 ? '#76bfc5' : '#e9aaca', '88'); }
      dot(c, -.06, .08, .006, '#f6db9c'); break;
    }
    case 'arm': {
      c.save(); c.beginPath(); c.rect(-.5, -.34, 1, .68); c.clip();
      for (let i = 0; i < 50; i++) { const x = -.5 + i / 49; const y = Math.sin(x * 3.2) * .16; glow(c, x, y, .15, '#968ed5', '12'); glow(c, x, y - .03, .06, '#c1bfec', '21'); }
      for (let i = 0; i < 1400; i++) { const x = random(i + 190) - .5, y = Math.sin(x * 3.2) * .16 + (random(i + 398) - .5) * .23; dot(c, x, y, .001 + random(i + 546) * .0023, ['#d1d4f4', '#aebdec', '#f5d2ba'][i % 3]); }
      for (let i = 0; i < 12; i++) { const x = -.46 + i * .084; glow(c, x, Math.sin(x * 3.2) * .16 - .06, .025, '#cf80ab', '99'); } c.restore(); break;
    }
  }
}
