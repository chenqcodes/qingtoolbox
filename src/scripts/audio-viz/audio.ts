import { DEMO_SECONDS, fillDemo } from './demo';
export type AudioState = { mode: 'idle' | 'file' | 'demo' | 'mic'; playback: 'stopped' | 'loading' | 'playing' | 'paused' | 'ended'; duration: number; position: number; volume: number; loop: boolean };
export type AudioEngine = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  getFrequency: () => Uint8Array<ArrayBuffer>;
  getState: () => AudioState;
  connectFile: (file: File) => Promise<boolean>;
  connectMic: () => Promise<boolean>;
  connectDemo: () => Promise<boolean>;
  pause: () => void;
  resume: () => Promise<boolean>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  setLoop: (loop: boolean) => void;
  stop: () => void;
  dispose: () => Promise<void>;
};
/** The analyser has no output connection. Only buffered playback reaches speakers. */
export function createAudioEngine(deps: { context?: AudioContext; getUserMedia?: () => Promise<MediaStream> } = {}): AudioEngine {
  const ctx = deps.context ?? new AudioContext();
  const getUserMedia = deps.getUserMedia ?? (() => navigator.mediaDevices.getUserMedia({ audio: true }));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;
  const output = ctx.createGain();
  output.gain.value = 0.2;
  output.connect(ctx.destination);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let source: AudioNode | null = null;
  let mediaStream: MediaStream | null = null;
  let bufferSource: AudioBufferSourceNode | null = null;
  let buffer: AudioBuffer | null = null;
  let generation = 0;
  let disposed = false;
  let startedAt = 0;
  let offset = 0;
  let state: AudioState = { mode: 'idle', playback: 'stopped', duration: 0, position: 0, volume: 0.2, loop: true };
  const position = () => {
    if (!buffer || state.playback !== 'playing') return offset;
    const elapsed = Math.max(0, ctx.currentTime - startedAt + offset);
    return state.loop && buffer.duration > 0 ? elapsed % buffer.duration : Math.min(buffer.duration, elapsed);
  };
  const disconnectSource = () => {
    if (bufferSource) {
      bufferSource.onended = null;
      try { bufferSource.stop(); } catch { /* already stopped */ }
      bufferSource = null;
    }
    source?.disconnect();
    source = null;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    analyser.disconnect();
    data.fill(0);
  };
  const stop = () => {
    ++generation;
    disconnectSource();
    buffer = null;
    offset = 0;
    state = { ...state, mode: 'idle', playback: 'stopped', duration: 0, position: 0 };
  };
  const begin = (mode: AudioState['mode']) => {
    if (disposed) throw new Error('Audio engine is closed');
    stop();
    state = { ...state, mode, playback: 'loading' };
    return generation;
  };
  const isCurrent = (token: number) => !disposed && token === generation;
  const startBuffer = () => {
    if (!buffer || disposed) return;
    disconnectSource();
    const next = ctx.createBufferSource();
    next.buffer = buffer;
    next.loop = state.loop;
    next.connect(analyser);
    next.connect(output);
    source = bufferSource = next;
    if (offset >= buffer.duration) offset = 0;
    startedAt = ctx.currentTime;
    state.playback = 'playing';
    state.duration = buffer.duration;
    next.onended = () => {
      if (bufferSource !== next || state.loop) return;
      next.disconnect();
      source = bufferSource = null;
      offset = buffer?.duration ?? 0;
      state.playback = 'ended';
    };
    next.start(0, offset);
  };
  const fail = (token: number) => { if (isCurrent(token)) stop(); };
  return {
    ctx, analyser,
    getFrequency: () => { if (source) analyser.getByteFrequencyData(data); else data.fill(0); return data; },
    getState: () => ({ ...state, position: position() }),
    connectFile: async (file) => {
      const token = begin('file');
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        if (!isCurrent(token)) return false;
        const bytes = await file.arrayBuffer();
        if (!isCurrent(token)) return false;
        const decoded = await ctx.decodeAudioData(bytes.slice(0));
        if (!isCurrent(token)) return false;
        buffer = decoded;
        startBuffer();
        return true;
      } catch (error) { fail(token); throw error; }
    },
    connectDemo: async () => {
      const token = begin('demo');
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        if (!isCurrent(token)) return false;
        buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * DEMO_SECONDS), ctx.sampleRate);
        fillDemo(buffer.getChannelData(0), ctx.sampleRate);
        startBuffer();
        return true;
      } catch (error) { fail(token); throw error; }
    },
    connectMic: async () => {
      const token = begin('mic');
      try {
        if (ctx.state === 'suspended') await ctx.resume();
        if (!isCurrent(token)) return false;
        const stream = await getUserMedia();
        if (!isCurrent(token)) { stream.getTracks().forEach((track) => track.stop()); return false; }
        try {
          const mic = ctx.createMediaStreamSource(stream);
          mic.connect(analyser);
          mediaStream = stream;
          source = mic;
          state.playback = 'playing';
          return true;
        } catch (error) { stream.getTracks().forEach((track) => track.stop()); throw error; }
      } catch (error) { fail(token); throw error; }
    },
    pause: () => {
      if (!buffer) return;
      ++generation; // Also cancel an earlier resume still awaiting AudioContext.
      if (state.playback !== 'playing') return;
      offset = position();
      disconnectSource();
      state.playback = 'paused';
    },
    resume: async () => {
      if (!buffer || state.playback === 'playing' || disposed) return false;
      const token = ++generation;
      if (ctx.state === 'suspended') await ctx.resume();
      if (!isCurrent(token)) return false;
      startBuffer();
      return true;
    },
    seek: (seconds) => {
      if (!buffer || !Number.isFinite(seconds)) return;
      // A seek is a newer transport intent, even while resume() is awaiting the
      // context. A late resume must not restart an ended or newly paused seek.
      ++generation;
      offset = Math.max(0, Math.min(buffer.duration, seconds));
      if (offset >= buffer.duration && !state.loop) { disconnectSource(); state.playback = 'ended'; }
      else if (state.playback === 'playing') startBuffer();
      else if (state.playback === 'ended') state.playback = 'paused';
    },
    setVolume: (volume) => {
      if (!Number.isFinite(volume)) return;
      state.volume = Math.max(0, Math.min(1, volume));
      output.gain.value = state.volume;
    },
    setLoop: (loop) => {
      if (state.loop === loop) return;
      offset = position();
      state.loop = loop;
      if (bufferSource) startBuffer();
    },
    stop,
    dispose: async () => {
      if (disposed) return;
      stop();
      disposed = true;
      output.disconnect();
      if (ctx.state !== 'closed') await ctx.close();
    },
  };
}
