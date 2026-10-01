import type { NightPlan } from './tonight';
import { formatAt } from './time';
export function drawNightPlan(canvas: HTMLCanvasElement, plan: NightPlan, zone: string) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2), box = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(box.width * dpr)); canvas.height = Math.max(1, Math.round(box.height * dpr));
  ctx.scale(dpr, dpr);
  const w = box.width, h = box.height, left = 38, right = w - 14, top = 18, bottom = h - 34;
  const x = (date: Date) => left + (+date - +plan.start) / (+plan.end - +plan.start) * (right - left);
  const y = (alt: number) => bottom - (Math.max(-30, Math.min(90, alt)) + 30) / 120 * (bottom - top);
  ctx.fillStyle = '#06111e'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < plan.samples.length - 1; i++) if (plan.samples[i].sunAltitude <= -6) {
    ctx.fillStyle = '#010409'; ctx.fillRect(x(plan.samples[i].time), top, Math.max(1, x(plan.samples[i + 1].time) - x(plan.samples[i].time)), bottom - top);
  }
  ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
  for (const alt of [-30, 0, 30, 60, 90]) { ctx.strokeStyle = alt === 0 ? '#52758b' : '#163045'; ctx.beginPath(); ctx.moveTo(left, y(alt)); ctx.lineTo(right, y(alt)); ctx.stroke(); ctx.fillStyle = '#b7ccdc'; ctx.fillText(`${alt}°`, left - 5, y(alt) + 4); }
  ctx.setLineDash([3, 4]); ctx.strokeStyle = '#8b8050'; ctx.beginPath(); ctx.moveTo(left, y(10)); ctx.lineTo(right, y(10)); ctx.stroke(); ctx.setLineDash([]);
  for (let i = 1; i < plan.samples.length; i++) { const a = plan.samples[i - 1], b = plan.samples[i]; ctx.strokeStyle = b.sunAltitude <= -6 && b.altitude >= 10 ? '#00e8ff' : '#65798c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(a.time), y(a.altitude)); ctx.lineTo(x(b.time), y(b.altitude)); ctx.stroke(); }
  if (plan.windows[0]) { const best = plan.windows[0].best; ctx.fillStyle = '#ffc857'; ctx.beginPath(); ctx.arc(x(best.time), y(best.altitude), 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#b7ccdc'; ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) { const d = new Date(+plan.start + (+plan.end - +plan.start) * i / 4); ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center'; ctx.fillText(formatAt(d, zone, true), x(d), h - 12); }
}
