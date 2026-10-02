/** Educational conservative surface-flow model, not a hydraulic engineering solver.
 * Closed boundary; rainfall only on non-building ground. Flux follows head differences.
 * Every donor's simultaneous transfers are scaled together to prevent negative water. */
export const COLS = 32, ROWS = 24, MAX_DEPTH = 4;
export type Tile = 0 | 1 | 2 | 3 | 4; // ground, street, building, park, drain
export type Preset = 'neighborhood' | 'sponge' | 'empty';
export interface Budget { rain: number; drained: number; infiltrated: number; overflow: number }
export class RainModel {
  readonly width: number; readonly height: number;
  readonly tiles: Uint8Array; readonly elevation: Float64Array; readonly water: Float64Array;
  readonly flowX: Float64Array; readonly flowY: Float64Array;
  readonly budget: Budget = { rain: 0, drained: 0, infiltrated: 0, overflow: 0 };
  time = 0;
  constructor(width = COLS, height = ROWS) {
    this.width = width; this.height = height; const n = width * height;
    this.tiles = new Uint8Array(n); this.elevation = new Float64Array(n); this.water = new Float64Array(n);
    this.flowX = new Float64Array(n); this.flowY = new Float64Array(n);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = (x - width * 0.6) / width, dy = (y - height * 0.56) / height;
      this.elevation[this.index(x, y)] = 0.32 * (dx * dx + dy * dy) + 0.045 * x / width;
    }
  }
  index(x: number, y: number) { return y * this.width + x; }
  ground(i: number) { return this.elevation[i] - (this.tiles[i] === 1 || this.tiles[i] === 4 ? 0.025 : 0); }
  resetWater() { this.water.fill(0); this.flowX.fill(0); this.flowY.fill(0); this.time = 0; Object.assign(this.budget, { rain: 0, drained: 0, infiltrated: 0, overflow: 0 }); }
  preset(name: Preset) {
    this.tiles.fill(0); this.resetWater();
    if (name === 'empty') return;
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const i = this.index(x, y), road = x % 8 < 2 || y % 8 < 2;
      if (road) this.tiles[i] = 1;
      else if (x % 8 >= 3 && x % 8 <= 6 && y % 8 >= 3 && y % 8 <= 6) this.tiles[i] = 2;
      else this.tiles[i] = 0;
      if (road && x % 8 === 1 && y % 8 === 1) this.tiles[i] = 4;
      if (name === 'sponge' && !road && this.tiles[i] !== 2) this.tiles[i] = 3;
      if (name === 'sponge' && x >= 18 && x <= 22 && y >= 11 && y <= 14) this.tiles[i] = 3;
    }
  }
  /** Building edits relocate existing water to nearest open cell, never silently discard it. */
  paint(x: number, y: number, type: Tile, radius = 0) {
    for (let yy = y - radius; yy <= y + radius; yy++) for (let xx = x - radius; xx <= x + radius; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue;
      const i = this.index(xx, yy); this.tiles[i] = type;
      if (type === 2 && this.water[i] > 0) {
        let target = -1, distance = Infinity;
        for (let j = 0; j < this.tiles.length; j++) if (this.tiles[j] !== 2 && j !== i) {
          const d = Math.abs(j % this.width - xx) + Math.abs(Math.floor(j / this.width) - yy);
          if (d < distance) { target = j; distance = d; }
        }
        if (target >= 0) { const accepted = Math.min(MAX_DEPTH - this.water[target], this.water[i]); this.water[target] += accepted; this.budget.overflow += this.water[i] - accepted; }
        else this.budget.overflow += this.water[i];
        this.water[i] = 0;
      }
    }
  }
  step(dt: number, rainfall: number, drainage: number) {
    if (!(dt > 0 && Number.isFinite(dt))) return;
    dt = Math.min(dt, 0.1); rainfall = Math.max(0, Math.min(100, Number.isFinite(rainfall) ? rainfall : 0)); drainage = Math.max(0, Math.min(100, Number.isFinite(drainage) ? drainage : 0));
    const n = this.water.length, outgoing = new Float64Array(n), change = new Float64Array(n);
    const edges: [number, number, number, number, number][] = [];
    this.flowX.fill(0); this.flowY.fill(0);
    for (let i = 0; i < n; i++) {
      if (this.tiles[i] === 2) continue;
      const addition = rainfall * 0.0003 * dt; this.water[i] += addition; this.budget.rain += addition;
      const infiltration = Math.min(this.water[i], (this.tiles[i] === 3 ? 0.04 : this.tiles[i] === 0 ? 0.001 : 0) * dt);
      this.water[i] -= infiltration; this.budget.infiltrated += infiltration;
      if (this.tiles[i] === 4) { const removal = Math.min(this.water[i], drainage * 0.01 * dt); this.water[i] -= removal; this.budget.drained += removal; }
    }
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const i = this.index(x, y); if (this.tiles[i] === 2) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (x + dx >= this.width || y + dy >= this.height) continue;
        const j = this.index(x + dx, y + dy); if (this.tiles[j] === 2) continue;
        const difference = this.ground(i) + this.water[i] - this.ground(j) - this.water[j];
        const from = difference > 0 ? i : j, to = difference > 0 ? j : i;
        const proposal = Math.abs(difference) * 3.5 * dt;
        if (proposal > 0) { outgoing[from] += proposal; edges.push([from, to, proposal, difference > 0 ? dx : -dx, difference > 0 ? dy : -dy]); }
      }
    }
    for (const [from, to, proposal, dx, dy] of edges) {
      const amount = proposal * Math.min(1, this.water[from] / (outgoing[from] || 1));
      change[from] -= amount; change[to] += amount; this.flowX[from] += amount * dx; this.flowY[from] += amount * dy;
    }
    for (let i = 0; i < n; i++) {
      const value = Math.max(0, this.water[i] + change[i]);
      if (value > MAX_DEPTH) this.budget.overflow += value - MAX_DEPTH;
      this.water[i] = Math.min(MAX_DEPTH, value);
    }
    this.time += dt;
  }
  summary() {
    let total = 0, maximum = 0, wet = 0, land = 0;
    for (let i = 0; i < this.water.length; i++) if (this.tiles[i] !== 2) { total += this.water[i]; maximum = Math.max(maximum, this.water[i]); if (this.water[i] > 0.03) wet++; land++; }
    return { total, maximum, coverage: land ? wet / land : 0, balance: this.budget.rain - total - this.budget.drained - this.budget.infiltrated - this.budget.overflow };
  }
}
