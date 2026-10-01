import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioEngine } from './audio';

class NodeMock {
  connections: NodeMock[] = [];
  stops = 0;
  starts = 0;
  buffer: unknown;
  loop = false;
  onended: (() => void) | null = null;
  frequencyBinCount = 256;
  fftSize = 512;
  smoothingTimeConstant = 0;
  connect(target: NodeMock) { this.connections.push(target); }
  disconnect() { this.connections = []; }
  start() { this.starts++; }
  stop() { this.stops++; }
  getByteFrequencyData(data: Uint8Array) { data.fill(128); }
}
function setup() {
  const analyser = new NodeMock();
  const destination = new NodeMock();
  const files: NodeMock[] = [];
  const microphones: NodeMock[] = [];
  const tracks: { stops: number; stop(): void }[] = [];
  const makeStream = () => {
    const track = { stops: 0, stop() { this.stops++; } };
    tracks.push(track);
    return { getTracks: () => [track] } as unknown as MediaStream;
  };
  const context = {
    state: 'running',
    destination,
    createAnalyser: () => analyser,
    createBufferSource: () => { const node = new NodeMock(); files.push(node); return node; },
    createMediaStreamSource: () => { const node = new NodeMock(); microphones.push(node); return node; },
    decodeAudioData: async () => ({}),
    close: async () => { context.state = 'closed'; },
    resume: async () => { context.state = 'running'; },
  };
  return { context, analyser, destination, files, microphones, tracks, makeStream };
}
const file = { arrayBuffer: async () => new ArrayBuffer(8) } as File;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

test('file → mic → file never routes microphone or analyser to speakers', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext, getUserMedia: async () => m.makeStream() });
  await engine.connectFile(file);
  assert.deepEqual(m.files[0].connections, [m.analyser, m.destination]);
  await engine.connectMic();
  assert.equal(m.files[0].stops, 1);
  assert.deepEqual(m.files[0].connections, []);
  assert.deepEqual(m.analyser.connections, []);
  assert.deepEqual(m.microphones[0].connections, [m.analyser]);
  await engine.connectFile(file);
  assert.equal(m.tracks[0].stops, 1);
  assert.deepEqual(m.microphones[0].connections, []);
  engine.stop(); engine.stop();
  assert.equal(m.files[1].stops, 1);
  assert.deepEqual([...engine.getFrequency()], Array(256).fill(0));
  await engine.dispose(); await engine.dispose();
  assert.equal(m.context.state, 'closed');
});

test('stop cancels pending microphone and releases late tracks', async () => {
  const m = setup();
  const pending = deferred<MediaStream>();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext, getUserMedia: () => pending.promise });
  const connecting = engine.connectMic();
  engine.stop();
  pending.resolve(m.makeStream());
  assert.equal(await connecting, false);
  assert.equal(m.tracks[0].stops, 1);
  assert.equal(m.microphones.length, 0);
});

test('newer file wins when an earlier decode resolves last', async () => {
  const m = setup();
  const pending = deferred<object>();
  let decode = 0;
  m.context.decodeAudioData = () => ++decode === 1 ? pending.promise : Promise.resolve({});
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  const first = engine.connectFile(file);
  await Promise.resolve();
  const second = engine.connectFile(file);
  assert.equal(await second, true);
  pending.resolve({});
  assert.equal(await first, false);
  assert.equal(m.files.length, 1);
});

test('dispose while permission is pending releases late tracks and rejects reuse', async () => {
  const m = setup();
  const pending = deferred<MediaStream>();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext, getUserMedia: () => pending.promise });
  const connecting = engine.connectMic();
  await engine.dispose();
  pending.resolve(m.makeStream());
  assert.equal(await connecting, false);
  assert.equal(m.tracks[0].stops, 1);
  await assert.rejects(engine.connectFile(file), /closed/);
});

test('denied microphone leaves stopped graph safe', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext, getUserMedia: async () => { throw Error('denied'); } });
  await engine.connectFile(file);
  await assert.rejects(engine.connectMic(), /denied/);
  assert.deepEqual(m.files[0].connections, []);
  assert.deepEqual(m.analyser.connections, []);
});
