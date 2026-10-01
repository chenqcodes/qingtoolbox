import { smoothStep } from './transition';

/** Crossfade between different illustrative scales, not a fake AU→ly flight.
 * The source is the actual composed frame (including an interrupted dissolve).
 * Re-render before copying: WebGL's default drawing buffer is not preserved. */
export class SceneDissolve {
  private layer: HTMLCanvasElement | null = null;
  private elapsed = 0;
  private opacity = 0;
  constructor(private canvas: HTMLCanvasElement, private render: () => void) {}

  capture() {
    this.render();
    const next = document.createElement('canvas');
    next.width = this.canvas.width;
    next.height = this.canvas.height;
    next.dataset.spaceTransition = '';
    next.setAttribute('aria-hidden', 'true');
    const context = next.getContext('2d');
    if (!context) return;
    context.drawImage(this.canvas, 0, 0, next.width, next.height);
    if (this.layer) {
      context.globalAlpha = this.opacity;
      context.drawImage(this.layer, 0, 0, next.width, next.height);
    }
    this.clear();
    Object.assign(next.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1', opacity: '1' });
    this.canvas.insertAdjacentElement('afterend', next);
    this.layer = next;
    this.elapsed = 0;
    this.opacity = 1;
  }
  update(dt: number) {
    if (!this.layer) return;
    this.elapsed += Math.min(.05, Math.max(0, Number.isFinite(dt) ? dt : 0));
    this.opacity = 1 - smoothStep(this.elapsed / .85);
    this.layer.style.opacity = String(this.opacity);
    if (this.elapsed >= .85) this.clear();
  }
  clear() { this.layer?.remove(); this.layer = null; this.opacity = 0; }
}
