/** A quiet stopwatch face. Nodes and character slots are created once, then only
 * their text changes: no rolling reels, transitions, font changes or timers. */
import type { StopwatchReading } from './metrics';

export class StopwatchNumber {
  private readonly accessible = document.createElement('span');
  private readonly digits: HTMLSpanElement[] = [];
  private readonly exponent = document.createElement('span');
  private readonly unit = document.createElement('span');
  private readonly power = document.createElement('sup');
  constructor(private readonly element: HTMLElement) {
    element.classList.add('zr-stopwatch-number');
    this.accessible.className = 'zr-number-accessible';
    const ink = document.createElement('span'); ink.className = 'zr-number-ink'; ink.setAttribute('aria-hidden', 'true');
    const face = document.createElement('span'); face.className = 'zr-number-face';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('span'); slot.className = i === 3 ? 'zr-number-point' : 'zr-number-digit';
      face.append(slot); this.digits.push(slot);
    }
    this.unit.className = 'zr-number-unit'; this.exponent.className = 'zr-number-exponent';
    this.exponent.append(document.createTextNode('×10'), this.power);
    ink.append(face, this.unit, this.exponent); element.replaceChildren(this.accessible, ink);
  }
  set(reading: StopwatchReading) {
    this.element.dataset.value = reading.value;
    this.accessible.textContent = reading.value;
    for (let i = 0; i < this.digits.length; i++) {
      if (this.digits[i].textContent !== reading.digits[i]) this.digits[i].textContent = reading.digits[i];
    }
    this.unit.textContent = reading.unit;
    this.exponent.style.visibility = reading.exponent === null ? 'hidden' : 'visible';
    this.power.textContent = reading.exponent === null ? '+000' : `${reading.exponent < 0 ? '−' : '+'}${Math.abs(reading.exponent).toString().padStart(3, '0')}`;
    this.element.dataset.exponent = reading.exponent === null ? '' : String(reading.exponent);
  }
}
