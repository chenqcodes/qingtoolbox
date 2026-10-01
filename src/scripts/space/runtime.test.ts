import test from 'node:test';
import assert from 'node:assert/strict';
import { hasWebGL2 } from './runtime';

test('unsupported WebGL is a normal capability result', () => {
  assert.equal(hasWebGL2({ getContext: () => null } as any), false);
  assert.equal(hasWebGL2({ getContext: () => { throw new Error('blocked'); } } as any), false);
});
test('requires WebGL2 and accepts an available context', () => {
  let requested = '';
  assert.equal(hasWebGL2({ getContext: (kind: string) => { requested = kind; return {}; } } as any), true);
  assert.equal(requested, 'webgl2');
});
