import { createTextureAsync, type PlanetTexture } from './model';

export type TextureFactory = (seed: number, signal: AbortSignal) => Promise<PlanetTexture>;

/** Latest-request-wins loader with a three-texture (~18 MiB) LRU cache. */
export class LatestTextureLoader {
  private generation = 0;
  private controller: AbortController | null = null;
  private disposed = false;
  private readonly cache = new Map<number, PlanetTexture>();

  constructor(private readonly factory: TextureFactory = (seed, signal) => createTextureAsync(seed, 1024, 512, { signal })) {}

  async request(seed: number): Promise<PlanetTexture | null> {
    if (this.disposed) return null;
    const generation = ++this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    try {
      const cached = this.cache.get(seed);
      const result = await (cached ? Promise.resolve(cached) : this.factory(seed, controller.signal));
      // Token checking is essential even if a worker/factory ignores its AbortSignal.
      if (this.disposed || generation !== this.generation || controller.signal.aborted) return null;
      this.cache.delete(seed); this.cache.set(seed, result);
      while (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!);
      return result;
    } catch (error) {
      if (controller.signal.aborted || generation !== this.generation || this.disposed) return null;
      throw error;
    }
  }

  dispose(): void {
    this.disposed = true; this.generation++;
    this.controller?.abort(); this.controller = null; this.cache.clear();
  }
}
