export type VisualPreset = 'orbit' | 'bars' | 'rain';
export type Bands = { low: number; mid: number; high: number };
export type Particle = { x: number; y: number; vx: number; vy: number; r: number; life: number; band: 0 | 1 | 2 };
export const BAND_COLORS = ['0,232,255', '155,123,255', '255,200,87'];
/** RMS of normalized logarithmic spectrum bytes, not linear amplitude or calibrated loudness. */
export function analyseBands(freq: Uint8Array, sampleRate: number, fftSize: number): Bands {
  const sums = [0, 0, 0];
  const counts = [0, 0, 0];
  if (sampleRate <= 0 || fftSize <= 0) return { low: 0, mid: 0, high: 0 };
  for (let i = 0; i < freq.length; i++) {
    const hz = i * sampleRate / fftSize;
    if (hz < 20 || hz >= 20000) continue;
    const band = hz < 250 ? 0 : hz < 2000 ? 1 : 2;
    sums[band] += (freq[i] / 255) ** 2;
    counts[band]++;
  }
  const values = sums.map((sum, index) => counts[index] ? Math.sqrt(sum / counts[index]) : 0);
  return { low: values[0], mid: values[1], high: values[2] };
}
export function createParticles(n: number, w: number, h: number): Particle[] {
  return Array.from({ length: Math.max(0, Math.min(800, Math.floor(n))) }, (_, i) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 1 + Math.random() * 2, life: 0, band: (i % 3) as 0 | 1 | 2 }));
}
export function updateParticles(particles: Particle[], freq: Uint8Array, w: number, h: number, sensitivity: number, dt: number, bands: Bands = analyseBands(freq, 48000, freq.length * 2), preset: VisualPreset = 'orbit'): boolean {
  const levels = [bands.low, bands.mid, bands.high].map((value) => Math.min(1, Math.max(0, value * sensitivity)));
  const delta = Math.min(0.05, Math.max(0, dt));
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const intensity = levels[p.band];
    const angle = i / Math.max(1, particles.length) * Math.PI * 2;
    if (preset === 'rain') {
      p.x += (p.band - 1) * intensity * delta * 30;
      p.y += (8 + intensity * (70 + p.band * 60)) * delta;
    } else {
      const radius = Math.min(w, h) * (0.13 + p.band * 0.12 + intensity * 0.12);
      const targetX = w / 2 + Math.cos(angle) * radius;
      const targetY = h / 2 + Math.sin(angle) * radius;
      p.vx += (targetX - p.x) * delta * 0.4;
      p.vy += (targetY - p.y) * delta * 0.4;
      p.vx *= 0.96; p.vy *= 0.96;
      p.x += p.vx * delta * 60; p.y += p.vy * delta * 60;
    }
    p.r = 1 + intensity * (p.band === 0 ? 5 : 3);
    p.life = intensity;
    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
  }
  return particles.every((particle) => Number.isFinite(particle.x) && Number.isFinite(particle.y));
}
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], w: number, h: number, bands: Bands = { low: 0, mid: 0, high: 0 }, preset: VisualPreset = 'orbit', freq?: Uint8Array, sampleRate = 48000) {
  ctx.fillStyle = 'rgba(1,3,9,0.3)'; ctx.fillRect(0, 0, w, h);
  const radius = Math.min(w, h) * (0.14 + bands.low * 0.12);
  if (preset === 'bars' && freq) {
    const columns = 48;
    const step = w / columns;
    for (let i = 0; i < columns; i++) {
      const frequency = 20 * (Math.min(20000, sampleRate / 2) / 20) ** (i / (columns - 1));
      const bin = Math.min(freq.length - 1, Math.round(frequency / (sampleRate / 2) * freq.length));
      const value = freq[bin] / 255 || 0;
      const band = frequency < 250 ? 0 : frequency < 2000 ? 1 : 2;
      ctx.fillStyle = `rgba(${BAND_COLORS[band]},0.72)`;
      ctx.fillRect(i * step, h * 0.85 - value * h * 0.7, step * 0.7, Math.max(2, value * h * 0.7));
    }
  } else {
    ctx.strokeStyle = `rgba(${BAND_COLORS[0]},${0.3 + bands.low * 0.7})`;
    ctx.lineWidth = 2 + bands.low * 8;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 48; i++) {
      const angle = i / 48 * Math.PI * 2;
      const length = 5 + bands.mid * 60 * (0.5 + Math.abs(Math.sin(i * 0.7)));
      ctx.strokeStyle = `rgba(${BAND_COLORS[1]},${0.25 + bands.mid * 0.75})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(angle) * radius * 1.6, h / 2 + Math.sin(angle) * radius * 1.6);
      ctx.lineTo(w / 2 + Math.cos(angle) * (radius * 1.6 + length), h / 2 + Math.sin(angle) * (radius * 1.6 + length)); ctx.stroke();
    }
  }
  for (const p of particles) {
    ctx.fillStyle = `rgba(${BAND_COLORS[p.band]},${0.15 + p.life * 0.85})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
}
