import * as Astronomy from 'astronomy-engine';

export type MoonPhaseInfo = {
  fraction: number;
  angleDeg: number;
  name: string;
  emoji: string;
};

const MOON_TEX = '/space/textures/2k_moon.jpg';
let moonImg: HTMLImageElement | null = null;
let moonLoad: Promise<HTMLImageElement> | null = null;

function loadMoonTex() {
  if (moonImg) return Promise.resolve(moonImg);
  if (!moonLoad) {
    moonLoad = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        moonImg = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = MOON_TEX;
    });
  }
  return moonLoad;
}

export function moonPhaseInfo(when: Date): MoonPhaseInfo {
  const ill = Astronomy.Illumination(Astronomy.Body.Moon, when);
  const f = ill.phase_fraction;
  // MoonPhase is the 0..360° lunar cycle; phase_angle is a different 0..180° geometry.
  const angle = Astronomy.MoonPhase(when);
  const names = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
  const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  const index = Math.round(angle / 45) % 8;
  return { fraction: f, angleDeg: angle, name: names[index], emoji: emojis[index] };
}

/** Normalized shadow edge. Illuminated disk area is exactly fraction, not cycle fraction. */
export function moonTerminator(fraction: number, cycleDeg: number, y: number) {
  const halfWidth = Math.sqrt(Math.max(0, 1 - y * y));
  const waxing = cycleDeg < 180;
  return { halfWidth, edge: (waxing ? 1 : -1) * (1 - 2 * fraction) * halfWidth, waxing };
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.55);
  g.addColorStop(0, '#0a1628');
  g.addColorStop(1, '#020408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  let s = seed;
  for (let i = 0; i < 120; i++) {
    s = (s * 16807 + 7) % 2147483647;
    const x = ((s % 10000) / 10000) * w;
    s = (s * 16807 + 7) % 2147483647;
    const y = ((s % 10000) / 10000) * h * 0.85;
    const a = 0.25 + ((s % 100) / 100) * 0.75;
    ctx.fillStyle = `rgba(200,230,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + (s % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function shadeMoonDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fraction: number, cycleDeg: number) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(2,4,8,0.94)';
  // Fill a shadow polygon without destination-out, which would erase the texture beneath it.
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const y = -1 + i / 80; const { halfWidth, waxing } = moonTerminator(fraction, cycleDeg, y);
    const x = (waxing ? -1 : 1) * halfWidth;
    if (i === 0) ctx.moveTo(cx + x * r, cy + y * r); else ctx.lineTo(cx + x * r, cy + y * r);
  }
  for (let i = 160; i >= 0; i--) {
    const y = -1 + i / 80; const { edge } = moonTerminator(fraction, cycleDeg, y);
    ctx.lineTo(cx + edge * r, cy + y * r);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

function drawHudFrame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(0,232,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = 'rgba(0,232,255,0.55)';
  ctx.font = '11px monospace';
  ctx.fillText('LUNAR TELEMETRY', 24, 28);
}

export async function drawMoonHero(
  canvas: HTMLCanvasElement,
  when: Date,
  illumPct: number,
  phaseName: string,
) {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width != w || canvas.height != h) {
    canvas.width = w;
    canvas.height = h;
  }

  drawStarfield(ctx, w, h, Math.floor(when.getTime() / 86400000));
  drawHudFrame(ctx, w, h);

  const img = await loadMoonTex().catch(() => null);
  const cx = w * 0.5;
  const cy = h * 0.48;
  const r = Math.min(w, h) * 0.32;

  const glow = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.35);
  glow.addColorStop(0, 'rgba(200,220,255,0.12)');
  glow.addColorStop(1, 'rgba(0,232,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else { ctx.fillStyle = '#c8cdd4'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
  const limb = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = limb;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();

  const info = moonPhaseInfo(when);
  shadeMoonDisk(ctx, cx, cy, r, info.fraction, info.angleDeg);

  ctx.strokeStyle = 'rgba(0,232,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(232,244,255,0.85)';
  ctx.font = `${Math.floor(14 * dpr)}px monospace`;
  ctx.fillText(`${phaseName}  ·  照明 ${illumPct.toFixed(1)}%`, 24, h - 36);
  ctx.fillStyle = 'rgba(0,232,255,0.65)';
  ctx.font = `${Math.floor(11 * dpr)}px monospace`;
  ctx.fillText('北向上月相示意 · 非地平视角', 24, h - 18);
}

export function drawMoonHeroSync(canvas: HTMLCanvasElement, when: Date, illumPct: number, phaseName: string) {
  drawMoonHero(canvas, when, illumPct, phaseName).catch(() => {
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00e8ff';
    ctx.font = '14px monospace';
    ctx.fillText('月表纹理加载中…', 20, 40);
  });
}
