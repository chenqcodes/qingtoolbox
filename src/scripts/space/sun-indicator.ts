import * as THREE from 'three';

export interface ScreenRect { left: number; top: number; right: number; bottom: number }
export interface SunBearing { x: number; y: number; angle: number }

/** Camera-space bearing, never a projected point behind the camera (which flips
 * left/right). The same calculation works in AU or ly and after origin rebases. */
export function sunBearing(
  view: { x: number; y: number; z: number },
  projectionX: number,
  projectionY: number,
  viewport: ScreenRect,
  obstacles: ScreenRect[] = [],
  previousAngle = -Math.PI / 2,
): SunBearing | null {
  if (![view.x, view.y, view.z, projectionX, projectionY, viewport.left, viewport.top, viewport.right, viewport.bottom].every(Number.isFinite)) return null;
  const width = viewport.right - viewport.left, height = viewport.bottom - viewport.top;
  if (width < 64 || height < 64 || Math.hypot(view.x, view.y, view.z) < 1e-12) return null;
  const px = view.x * projectionX, py = view.y * projectionY;
  if (view.z < 0 && Math.abs(px) <= -view.z && Math.abs(py) <= -view.z) return null;
  // At the exact rear pole there is no unique turn direction. Retain the last
  // bearing rather than dividing by zero or flickering between opposite edges.
  const angle = Math.hypot(px, py) < Math.hypot(view.x, view.y, view.z) * 1e-8
    ? previousAngle : Math.atan2(-py * height, px * width);
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const pad = 30; // 44px marker + 8px breathing room
  const bounds = { left: viewport.left + pad, right: viewport.right - pad, top: viewport.top + pad, bottom: viewport.bottom - pad };
  const cx = (viewport.left + viewport.right) / 2, cy = (viewport.top + viewport.bottom) / 2;
  const scale = Math.min((width / 2 - pad) / Math.max(Math.abs(dx), 1e-12), (height / 2 - pad) / Math.max(Math.abs(dy), 1e-12));
  const desired = { x: cx + dx * scale, y: cy + dy * scale };
  const blocked = obstacles.map(r => ({ left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad }));
  // All changes in edge availability occur at an obstacle endpoint. Test those
  // plus the desired bearing, keeping the icon on the viewport edge, away from
  // the explorer, drawers, mobile controls, readouts, and the minimap.
  const candidates: { x: number; y: number }[] = [];
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  for (const x of [bounds.left, bounds.right]) {
    for (const y of [desired.y, bounds.top, bounds.bottom, ...blocked.flatMap(r => [r.top - 1, r.bottom + 1])]) candidates.push({ x, y: clamp(y, bounds.top, bounds.bottom) });
  }
  for (const y of [bounds.top, bounds.bottom]) {
    for (const x of [desired.x, bounds.left, bounds.right, ...blocked.flatMap(r => [r.left - 1, r.right + 1])]) candidates.push({ x: clamp(x, bounds.left, bounds.right), y });
  }
  let best: { x: number; y: number } | null = null, distance = Infinity;
  for (const point of candidates) {
    if (blocked.some(r => point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom)) continue;
    const d = Math.hypot(point.x - desired.x, point.y - desired.y);
    if (d < distance) { distance = d; best = point; }
  }
  return best ? { ...best, angle } : null;
}

export class SunIndicator {
  private element: HTMLDivElement;
  private arrow: HTMLElement;
  private view = new THREE.Vector3();
  private previousAngle = -Math.PI / 2;
  private nextLayout = 0;
  private obstacles: ScreenRect[] = [];
  private viewport: ScreenRect = { left: 0, top: 0, right: 0, bottom: 0 };
  constructor(private hud: HTMLElement, private canvas: HTMLCanvasElement) {
    this.element = document.createElement('div');
    this.element.id = 'sp-sun-direction';
    this.element.hidden = true;
    this.element.setAttribute('role', 'img');
    this.element.setAttribute('aria-label', '太阳在视野外，箭头指向太阳');
    this.element.innerHTML = '<span class="sp-sun-arrow" aria-hidden="true">➤</span><span class="sp-sun-symbol" aria-hidden="true">☀</span><span class="sp-sun-caption" aria-hidden="true">太阳</span>';
    this.arrow = this.element.querySelector('.sp-sun-arrow')!;
    hud.append(this.element);
  }
  update(camera: THREE.PerspectiveCamera, sunWorld: THREE.Vector3, now: number) {
    if (now >= this.nextLayout) {
      this.nextLayout = now + 150;
      this.viewport = this.canvas.getBoundingClientRect();
      this.obstacles = [...this.hud.querySelectorAll<HTMLElement>('.sp-top, .sp-explorer, .sp-quick-nav, .sp-minimap-wrap, .sp-drawer, .sp-readout, .sp-speed')]
        .filter(el => !el.hidden && getComputedStyle(el).display !== 'none')
        .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    }
    camera.updateMatrixWorld(true);
    this.view.copy(sunWorld).applyMatrix4(camera.matrixWorldInverse);
    const p = camera.projectionMatrix.elements;
    const result = sunBearing(this.view, p[0], p[5], this.viewport, this.obstacles, this.previousAngle);
    this.element.hidden = !result;
    if (!result) return;
    this.previousAngle = result.angle;
    this.element.style.left = `${result.x}px`;
    this.element.style.top = `${result.y}px`;
    this.arrow.style.transform = `rotate(${result.angle}rad)`;
  }
  dispose() { this.element.remove(); }
}
