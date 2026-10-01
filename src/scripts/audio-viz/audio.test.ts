import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioEngine } from './audio';

class NodeMock {
  connections: NodeMock[] = [];
  stops = 0;
  starts = 0;
  lastOffset = 0;
  buffer: unknown;
  loop = false;
  onended: (() => void) | null = null;
  gain = { value: 1 };
  frequencyBinCount = 256;
  fftSize = 512;
  smoothingTimeConstant = 0;
  connect(target: NodeMock) { this.connections.push(target); }
  disconnect() { this.connections = []; }
  start(_when = 0, offset = 0) { this.starts++; this.lastOffset = offset; }
  stop() { this.stops++; }
  getByteFrequencyData(data: Uint8Array) { data.fill(128); }
}
function setup() {
  const analyser = new NodeMock();
  const destination = new NodeMock();
  const output = new NodeMock();
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
    currentTime: 0,
    sampleRate: 48000,
    createGain: () => output,
    createBuffer: (_channels: number, length: number, sampleRate: number) => ({ duration: length / sampleRate, getChannelData: () => new Float32Array(length) }),
    destination,
    createAnalyser: () => analyser,
    createBufferSource: () => { const node = new NodeMock(); files.push(node); return node; },
    createMediaStreamSource: () => { const node = new NodeMock(); microphones.push(node); return node; },
    decodeAudioData: async () => ({ duration: 30 }),
    close: async () => { context.state = 'closed'; },
    resume: async () => { context.state = 'running'; },
  };
  return { context, analyser, destination, output, files, microphones, tracks, makeStream };
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
  assert.deepEqual(m.files[0].connections, [m.analyser, m.output]);
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
  const pending = deferred<{ duration: number }>();
  let decode = 0;
  m.context.decodeAudioData = () => ++decode === 1 ? pending.promise : Promise.resolve({ duration: 30 });
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  const first = engine.connectFile(file);
  await Promise.resolve();
  const second = engine.connectFile(file);
  assert.equal(await second, true);
  pending.resolve({ duration: 30 });
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


test('buffered playback pauses at position, seeks, resumes and ends without a stale source', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  await engine.connectFile(file);
  m.context.currentTime = 7;
  engine.pause();
  assert.equal(engine.getState().position, 7);
  assert.equal(engine.getState().playback, 'paused');
  assert.equal(m.files[0].stops, 1);
  engine.seek(12);
  assert.equal(engine.getState().position, 12);
  await engine.resume();
  assert.equal(m.files.length, 2);
  engine.setLoop(false);
  m.context.currentTime = 10;
  assert.equal(engine.getState().position, 15);
  m.files.at(-1)!.onended?.();
  assert.equal(engine.getState().playback, 'ended');
  assert.equal(engine.getState().position, 30);
  await engine.resume();
  assert.equal(engine.getState().position, 0);
});

test('demo is user-started, bounded, uses playback branch and switches safely to mic', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext, getUserMedia: async () => m.makeStream() });
  assert.equal(m.files.length, 0);
  assert.equal(engine.getState().mode, 'idle');
  await engine.connectDemo();
  assert.equal(engine.getState().duration, 12);
  assert.equal(engine.getState().mode, 'demo');
  assert.deepEqual(m.files[0].connections, [m.analyser, m.output]);
  engine.setVolume(2); assert.equal(m.output.gain.value, 1);
  engine.setVolume(-1); assert.equal(m.output.gain.value, 0);
  await engine.connectMic();
  assert.equal(m.files[0].stops, 1);
  assert.deepEqual(m.microphones[0].connections, [m.analyser]);
  assert.deepEqual(m.analyser.connections, []);
  assert.equal(engine.getState().duration, 0);
  await engine.dispose();
  assert.equal(m.tracks[0].stops, 1);
  assert.deepEqual(m.output.connections, []);
});


test('turning loop off preserves current cycle position, and seeking to end really ends', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  await engine.connectFile(file);
  m.context.currentTime = 67;
  assert.equal(engine.getState().position, 7);
  engine.setLoop(false);
  assert.equal(engine.getState().position, 7);
  engine.seek(30);
  assert.equal(engine.getState().playback, 'ended');
  assert.equal(engine.getState().position, 30);
  assert.equal(m.files.at(-1)!.connections.length, 0);
});


test('terminal seek cancels pending context resume and cannot restart from zero', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  engine.setLoop(false);
  await engine.connectFile(file);
  m.context.currentTime = 5;
  engine.pause();
  const pending = deferred<void>();
  m.context.state = 'suspended';
  m.context.resume = () => pending.promise;
  const resuming = engine.resume();
  const sourcesBeforeSeek = m.files.length;
  engine.seek(30);
  assert.equal(engine.getState().playback, 'ended');
  m.context.state = 'running';
  pending.resolve(undefined);
  assert.equal(await resuming, false);
  assert.equal(m.files.length, sourcesBeforeSeek);
  assert.equal(engine.getState().position, 30);
  assert.equal(engine.getState().playback, 'ended');
  assert.ok(m.files.every((node) => node.connections.length === 0));
  // A subsequent explicit Play still deliberately restarts the ended file.
  assert.equal(await engine.resume(), true);
  assert.equal(m.files.at(-1)!.lastOffset, 0);
});

test('nonterminal seek supersedes pending resume, preserves pause and the chosen offset', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  await engine.connectFile(file);
  engine.pause();
  const pending = deferred<void>();
  m.context.state = 'suspended';
  m.context.resume = () => pending.promise;
  const resuming = engine.resume();
  engine.seek(12);
  m.context.state = 'running'; pending.resolve(undefined);
  assert.equal(await resuming, false);
  assert.equal(m.files.length, 1);
  assert.equal(engine.getState().playback, 'paused');
  assert.equal(engine.getState().position, 12);
  assert.equal(await engine.resume(), true);
  assert.equal(m.files.at(-1)!.lastOffset, 12);
});

test('new demo source wins over an older context resume without an extra source', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  await engine.connectFile(file);
  engine.pause();
  const pending = deferred<void>();
  m.context.state = 'suspended';
  m.context.resume = () => pending.promise;
  const resuming = engine.resume();
  const replacement = engine.connectDemo();
  m.context.state = 'running'; pending.resolve(undefined);
  assert.equal(await resuming, false);
  assert.equal(await replacement, true);
  assert.equal(m.files.length, 2);
  assert.equal(engine.getState().mode, 'demo');
  assert.equal(engine.getState().duration, 12);
  assert.equal(m.files[0].connections.length, 0);
});

test('a later Pause cancels a resume still awaiting context activation', async () => {
  const m = setup();
  const engine = createAudioEngine({ context: m.context as unknown as AudioContext });
  await engine.connectFile(file);
  m.context.currentTime = 5; engine.pause();
  const pending = deferred<void>();
  m.context.state = 'suspended'; m.context.resume = () => pending.promise;
  const resuming = engine.resume();
  engine.pause();
  m.context.state = 'running'; pending.resolve(undefined);
  assert.equal(await resuming, false);
  assert.equal(m.files.length, 1);
  assert.equal(engine.getState().playback, 'paused');
  assert.equal(engine.getState().position, 5);
});
