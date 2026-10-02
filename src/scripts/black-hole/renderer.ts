import { clamp, sceneScale, SHADOW_RADIUS_RS } from './physics';

export interface SceneSettings { distance: number; inclination: number; lensing: boolean; beaming: boolean }
const TAU = Math.PI * 2;
const TEX_W = 2048, TEX_H = 512;
const TEX_MASK = TEX_W - 1, TEX_SHIFT = 11;
function smoothstep(a: number, b: number, value: number) { const t = clamp((value - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function random(seed: number) { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
/** An original procedural illustration. The image mapping deliberately is not GR ray integration. */
export class BlackHoleRenderer {
  private ctx: CanvasRenderingContext2D;
  private raster = document.createElement('canvas');
  private rasterCtx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private cssWidth = 0;
  private cssHeight = 0;
  private image!: ImageData;
  private backdrop!: Uint8ClampedArray;
  private sky!: Uint8ClampedArray;
  private activeCount = 0;
  private positions = new Uint32Array(0);
  private sampleA = new Int32Array(0);
  private sampleB = new Int32Array(0);
  private gainA = new Float32Array(0);
  private gainB = new Float32Array(0);
  private texture = new Float32Array(TEX_W * TEX_H);
  private rowOffsets = new Uint16Array(TEX_H);
  private palette = new Uint8ClampedArray(8192 * 3);
  private geometryKey = '';
  frames = 0;
  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false });
    const rasterContext = this.raster.getContext('2d', { alpha: false });
    if (!context || !rasterContext) throw new Error('Canvas2D unavailable');
    this.ctx = context; this.rasterCtx = rasterContext;
    this.buildTexture();
    for (let i = 0; i < 8192; i++) {
      const light = i / 1900;
      this.palette[i * 3] = 255 * (1 - Math.exp(-light * 2.1));
      this.palette[i * 3 + 1] = 255 * (1 - Math.exp(-light * 0.87));
      this.palette[i * 3 + 2] = 255 * (1 - Math.exp(-light * 0.32));
    }
  }
  private buildTexture() {
    for (let y = 0; y < TEX_H; y++) {
      const r = y / (TEX_H - 1);
      const radius = 3 + r * 10;
      const emissivity = smoothstep(3, 3.6, radius) * (3.8 / radius) ** 1.7 * (1 - smoothstep(10, 13, radius));
      for (let x = 0; x < TEX_W; x++) {
        const a = x / TEX_W * TAU;
        const winding = a * 5 + r * 19;
        const turbulence = Math.sin(winding + Math.sin(a * 3 - r * 14) * 1.3);
        const fine = Math.sin(r * 513 + a * 4 + turbulence * 2.8);
        const finer = Math.sin(r * 973 + a * 9 + Math.sin(winding) * 1.5);
        const streak = Math.sin(a * 11 - r * 42 + Math.sin(a * 4 + r * 20));
        const intensity = 0.68 + fine * 0.13 + finer * 0.075 + turbulence * 0.12 + streak * 0.06 + random(x + y * 37) * 0.09;
        this.texture[y * TEX_W + x] = Math.max(0.05, intensity) * emissivity;
      }
    }
  }
  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, bounds.width); this.cssHeight = Math.max(1, bounds.height);
    // CPU raster size is bounded independently of device pixel ratio.
    const ratio = Math.min(1.15, 880 / this.cssWidth, 600 / this.cssHeight);
    this.width = Math.round(this.cssWidth * ratio); this.height = Math.round(this.cssHeight * ratio);
    this.canvas.width = Math.round(this.cssWidth * Math.min(window.devicePixelRatio || 1, 2));
    this.canvas.height = Math.round(this.cssHeight * Math.min(window.devicePixelRatio || 1, 2));
    this.raster.width = this.width; this.raster.height = this.height;
    this.image = this.rasterCtx.createImageData(this.width, this.height);
    this.geometryKey = '';
    const count = this.width * this.height;
    this.positions = new Uint32Array(count); this.sampleA = new Int32Array(count); this.sampleB = new Int32Array(count);
    this.gainA = new Float32Array(count); this.gainB = new Float32Array(count);
    this.sky = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) { this.sky[i * 4] = 2; this.sky[i * 4 + 1] = 3; this.sky[i * 4 + 2] = 7; this.sky[i * 4 + 3] = 255; }
    for (let i = 0; i < 320; i++) {
      const px = Math.floor(random(i * 5 + 1) * this.width), py = Math.floor(random(i * 5 + 2) * this.height);
      const intensity = 18 + random(i * 5 + 3) ** 5 * 120;
      const k = (py * this.width + px) * 4;
      this.sky[k] += intensity * .78; this.sky[k + 1] += intensity * .85; this.sky[k + 2] += intensity;
    }
  }
  private sample(radius: number, angle: number) {
    return Math.min(TEX_H - 1, Math.max(0, Math.floor((radius - 3) / 10 * (TEX_H - 1)))) * TEX_W + ((Math.floor(angle / TAU * TEX_W) % TEX_W + TEX_W) % TEX_W);
  }
  private buildGeometry(settings: SceneSettings) {
    const { width: w, height: h } = this;
    const scale = sceneScale(w, h, settings.distance);
    const cos = Math.max(0.052, Math.cos(settings.inclination * Math.PI / 180));
    const sin = Math.sin(settings.inclination * Math.PI / 180);
    const lensStrength = settings.lensing ? sin ** 2 : 0;
    const rotation = -0.085;
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    const centerX = w * 0.5, centerY = h * 0.505;
    this.backdrop = this.sky.slice();
    const { positions, sampleA, sampleB, gainA, gainB } = this;
    let count = 0;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const k = (py * w + px) * 4;
        const xx = (px - centerX) / scale, yy = (py - centerY) / scale;
        const x = xx * cr + yy * sr, y = -xx * sr + yy * cr;
        const rho = Math.sqrt(x * x + y * y);
        let first = -1, second = -1, gainFirst = 0, gainSecond = 0;
        // Far-side light is compressed into an upper arc by an illustrative inverse mapping.
        const lensY = y / (0.91 + cos * .09);
        const lensR = Math.sqrt(x * x + lensY * lensY);
        if (lensStrength > .01 && lensR >= SHADOW_RADIUS_RS && lensR < 4.28 && y < 0.2) {
          const r = 3 + (lensR - SHADOW_RADIUS_RS) / (4.28 - SHADOW_RADIUS_RS) * 10;
          first = this.sample(r, Math.atan2(lensY, x));
          gainFirst = lensStrength * 2.0 * (0.6 + 0.4 * smoothstep(-.05, -.8, y));
        }
        // A dimmer underside image hugs the lower critical curve.
        if (lensStrength > .01 && rho >= SHADOW_RADIUS_RS && rho < 3.06 && y > 0) {
          first = this.sample(3 + (rho - SHADOW_RADIUS_RS) / .46 * 10, -Math.atan2(y, x));
          gainFirst = lensStrength * .65;
        }
        const directY = y / cos;
        const rDirect = Math.sqrt(x * x + directY * directY);
        if (rDirect >= 3 && rDirect <= 13 && (rho > SHADOW_RADIUS_RS || y > 0)) {
          const direct = this.sample(rDirect, Math.atan2(y / cos, x));
          const opacity = smoothstep(3, 3.3, rDirect) * (1 - smoothstep(12, 13, rDirect));
          second = direct; gainSecond = 1.3 * opacity;
          if (y > 0) gainFirst *= 1 - opacity;
        }
        if (first >= 0 || second >= 0) {
          // Brightness-inspired Doppler factor, not a calibrated spectrum.
          const beam = settings.beaming ? Math.pow(1 / (1 + .37 * sin * x / Math.max(3, Math.abs(x), rDirect < 13 ? rDirect : lensR)), 2.5) : 1;
          positions[count] = k; sampleA[count] = first; sampleB[count] = second;
          gainA[count] = gainFirst * beam; gainB[count] = gainSecond * beam;
          this.backdrop[k] = 2; this.backdrop[k + 1] = 3; this.backdrop[k + 2] = 7;
          count++;
        }
        if (rho < SHADOW_RADIUS_RS && !(rDirect >= 3 && rDirect <= 13 && y > 0)) {
          this.backdrop[k] = 1; this.backdrop[k + 1] = 2; this.backdrop[k + 2] = 5;
        }
      }
    }
    this.activeCount = count;
  }

  render(settings: SceneSettings, time: number) {
    if (!this.width) this.resize();
    // Quantization avoids repeatedly rebuilding a map for subpixel camera changes.
    const key = `${Math.round(settings.distance * 10)}:${Math.round(settings.inclination * 8)}:${settings.lensing}:${settings.beaming}`;
    if (key !== this.geometryKey) { this.buildGeometry(settings); this.geometryKey = key; }
    for (let row = 0; row < TEX_H; row++) {
      const r = 3 + row / (TEX_H - 1) * 10;
      this.rowOffsets[row] = Math.floor(time * 190 * (3 / r) ** 1.5) % TEX_W;
    }
    const data = this.image.data;
    data.set(this.backdrop);
    const { positions, sampleA, sampleB, gainA, gainB, texture, rowOffsets, palette } = this;
    for (let n = 0; n < this.activeCount; n++) {
      const a = sampleA[n], b = sampleB[n];
      let light = 0;
      if (a >= 0) light += texture[(a & ~TEX_MASK) + ((a + rowOffsets[a >> TEX_SHIFT]) & TEX_MASK)] * gainA[n];
      if (b >= 0) light += texture[(b & ~TEX_MASK) + ((b + rowOffsets[b >> TEX_SHIFT]) & TEX_MASK)] * gainB[n];
      const color = Math.min(8191, Math.floor(light * 1900)) * 3, k = positions[n];
      data[k] = Math.max(data[k], palette[color]); data[k + 1] = Math.max(data[k + 1], palette[color + 1]); data[k + 2] = Math.max(data[k + 2], palette[color + 2]);
    }
    this.rasterCtx.putImageData(this.image, 0, 0);
    const ctx = this.ctx;
    ctx.setTransform(this.canvas.width / this.cssWidth, 0, 0, this.canvas.height / this.cssHeight, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.raster, 0, 0, this.cssWidth, this.cssHeight);
    // Narrow higher-order images: intentionally stylized, not an actual photon-sphere surface.
    if (settings.lensing) {
      const radius = sceneScale(this.cssWidth, this.cssHeight, settings.distance) * SHADOW_RADIUS_RS;
      ctx.save(); ctx.translate(this.cssWidth * .5, this.cssHeight * .505); ctx.rotate(-.085);
      const alpha = .16 + Math.sin(settings.inclination * Math.PI / 180) * .28;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath(); ctx.arc(0, 0, radius + ring * 1.2, Math.PI, TAU);
        ctx.strokeStyle = `rgba(255,213,154,${alpha / (ring + 1)})`; ctx.lineWidth = ring === 0 ? 1.2 : .6; ctx.stroke();
      }
      ctx.restore();
    }
    this.frames++;
  }
  dispose() { this.positions = new Uint32Array(0); this.backdrop = new Uint8ClampedArray(0); this.raster.width = 1; this.raster.height = 1; }
}
