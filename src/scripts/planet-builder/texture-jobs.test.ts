import test from 'node:test';
import assert from 'node:assert/strict';
import { createTexture, createTextureAsync, type PlanetTexture } from './model';
import { LatestTextureLoader } from './texture-jobs';

test('cooperative texture generation is byte-identical to the synchronous reference', async () => {
  let yields = 0;
  const asynchronous = await createTextureAsync(2718, 96, 48, { yieldControl: async () => { yields++; } });
  assert.deepEqual(asynchronous, createTexture(2718, 96, 48));
  assert.ok(yields >= 6, 'generation must yield at least once per eight rows');
});

test('a cancelled job stops before starting, and a running job stops at its next yield', async () => {
  const preCancelled = new AbortController(); preCancelled.abort();
  let preYields = 0;
  await assert.rejects(createTextureAsync(4, 64, 32, { signal: preCancelled.signal, yieldControl: async () => { preYields++; } }), { name: 'AbortError' });
  assert.equal(preYields, 0);
  const running = new AbortController(); let yields = 0;
  await assert.rejects(createTextureAsync(5, 64, 64, {
    signal: running.signal,
    yieldControl: async () => { if (++yields === 3) running.abort(); },
  }), { name: 'AbortError' });
  assert.equal(yields, 3, 'no more rows or yields may be scheduled after cancellation');
});

test('a newer world wins even if an older factory ignores cancellation and finishes late', async () => {
  const completions = new Map<number, (texture: PlanetTexture) => void>();
  const signals = new Map<number, AbortSignal>();
  const loader = new LatestTextureLoader((seed, signal) => {
    signals.set(seed, signal);
    return new Promise(resolve => completions.set(seed, resolve));
  });
  const oldWorld = loader.request(1), currentWorld = loader.request(2);
  assert.equal(signals.get(1)?.aborted, true);
  const latest = createTexture(2, 16, 8);
  completions.get(2)!(latest);
  assert.equal(await currentWorld, latest);
  completions.get(1)!(createTexture(1, 16, 8));
  assert.equal(await oldWorld, null, 'stale terrain must never be committed');
  assert.equal(await loader.request(2), latest, 'latest completed world should be cached');
  loader.dispose();
});

test('completed cache is bounded to three textures and disposal cancels pending work', async () => {
  let calls = 0;
  const loader = new LatestTextureLoader(async seed => { calls++; return createTexture(seed, 16, 8); });
  await loader.request(1); await loader.request(2); await loader.request(3);
  await loader.request(1); assert.equal(calls, 3);
  await loader.request(4); await loader.request(2);
  assert.equal(calls, 5, 'least recently used texture should have been evicted');
  loader.dispose(); assert.equal(await loader.request(1), null);

  let finish!: (texture: PlanetTexture) => void;
  let pendingSignal: AbortSignal | undefined;
  const pending = new LatestTextureLoader((_seed, signal) => { pendingSignal = signal; return new Promise(resolve => { finish = resolve; }); });
  const result = pending.request(17); pending.dispose();
  assert.equal(pendingSignal?.aborted, true);
  finish(createTexture(17, 16, 8));
  assert.equal(await result, null);
});
