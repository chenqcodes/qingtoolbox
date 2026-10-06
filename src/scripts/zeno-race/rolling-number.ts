/** Quiet rolling numerals: only changed mantissa digits travel, once per sampled
 * reading. Units/exponents are atomic, not mechanical reels. No timers or RAFs
 * outlive the simulation: pause/reset settle immediately. */
export class RollingNumber {
  private value = '';
  private sampledAt = -Infinity;
  private animations: Animation[] = [];
  private readonly accessible = document.createElement('span');
  constructor(private readonly element: HTMLElement) {
    element.classList.add('zr-rolling-number');
    this.accessible.className = 'zr-number-accessible';
  }
  set(value: string, animate: boolean, now = performance.now()) {
    this.element.dataset.value = value;
    this.accessible.textContent = value;
    if (animate && now - this.sampledAt < 140) return;
    if (this.value === value) { if (!animate) this.settle(); return; }
    // Keep one font size throughout scientific notation, even when a rounded
    // mantissa loses a trailing zero (7.10e-17 -> 7.1e-17).
    this.element.dataset.compact = String(/e[+-]?\d/.test(value) || value.length >= 10);
    this.sampledAt = now;
    const previous = this.value;
    this.value = value;
    this.settle();
    // A notation/unit/decimal-place change gets a single gentle arrival, rather
    // than unrelated columns spinning (9.99 m -> 999 cm, or 1e-100 m).
    const split = (text: string) => /^(\d+(?:\.\d+)?)(.*)$/.exec(text);
    const before = split(previous), after = split(value);
    const sameLayout = !!before && !!after && before[2] === after[2]
      && before[1].length === after[1].length && before[1].indexOf('.') === after[1].indexOf('.');
    this.element.replaceChildren(this.accessible);
    const ink = document.createElement('span'); ink.className = 'zr-number-ink'; ink.setAttribute('aria-hidden', 'true');
    this.element.append(ink);
    if (!animate || !previous || !after) { ink.textContent = value; return; }
    if (!sameLayout) {
      ink.textContent = value;
      this.animations.push(ink.animate([{ transform: 'translateY(.13em)', opacity: .65 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 120, easing: 'ease-out' }));
      return;
    }
    const direction = Number(after[1]) >= Number(before![1]) ? 1 : -1;
    for (let i = 0; i < after[1].length; i++) {
      const digit = document.createElement('span'); digit.className = /\d/.test(after[1][i]) ? 'zr-number-digit' : 'zr-number-punctuation';
      const current = document.createElement('span'); current.textContent = after[1][i]; digit.append(current); ink.append(digit);
      if (before![1][i] === after[1][i] || after[1][i] === '.') continue;
      const outgoing = document.createElement('span'); outgoing.className = 'zr-number-outgoing'; outgoing.textContent = before![1][i]; digit.append(outgoing);
      const options = { duration: 130, easing: 'cubic-bezier(.2,.6,.35,1)', fill: 'forwards' as FillMode };
      this.animations.push(current.animate([{ transform: `translateY(${direction * 80}%)`, opacity: .35 }, { transform: 'translateY(0)', opacity: 1 }], options));
      this.animations.push(outgoing.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-direction * 80}%)`, opacity: 0 }], options));
    }
    const suffix = document.createElement('span'); suffix.className = 'zr-number-unit'; suffix.textContent = after[2]; ink.append(suffix);
  }
  private settle() {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
    this.element.querySelectorAll('.zr-number-outgoing').forEach(node => node.remove());
  }
}
