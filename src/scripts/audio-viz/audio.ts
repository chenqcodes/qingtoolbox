export type AudioEngine = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  getFrequency: () => Uint8Array<ArrayBuffer>;
  connectFile: (file: File) => Promise<boolean>;
  connectMic: () => Promise<boolean>;
  stop: () => void;
  dispose: () => Promise<void>;
};

/** Dependencies are injectable so graph/lifecycle tests never request a real microphone. */
export function createAudioEngine(deps: {
  context?: AudioContext;
  getUserMedia?: () => Promise<MediaStream>;
} = {}): AudioEngine {
  const ctx = deps.context ?? new AudioContext();
  const getUserMedia = deps.getUserMedia ?? (() => navigator.mediaDevices.getUserMedia({ audio: true }));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  const data = new Uint8Array(analyser.frequencyBinCount);
  let source: AudioNode | null = null;
  let mediaStream: MediaStream | null = null;
  let bufferSource: AudioBufferSourceNode | null = null;
  let generation = 0;
  let disposed = false;

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
    // Defensive invariant: the analyser has no output route, in any mode.
    analyser.disconnect();
    data.fill(0);
  };
  const begin = () => {
    if (disposed) throw new Error('Audio engine is closed');
    const token = ++generation;
    disconnectSource();
    return token;
  };
  const isCurrent = (token: number) => !disposed && token === generation;

  return {
    ctx,
    analyser,
    getFrequency: () => {
      if (source) analyser.getByteFrequencyData(data);
      else data.fill(0);
      return data;
    },
    connectFile: async (file) => {
      const token = begin();
      if (ctx.state === 'suspended') await ctx.resume();
      if (!isCurrent(token)) return false;
      const buf = await file.arrayBuffer();
      if (!isCurrent(token)) return false;
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      if (!isCurrent(token)) return false;
      const next = ctx.createBufferSource();
      next.buffer = audioBuf;
      next.loop = true;
      next.connect(analyser);
      // Playback takes its own branch. The analyser NEVER connects to speakers,
      // so a later microphone cannot inherit a file's output connection.
      next.connect(ctx.destination);
      source = bufferSource = next;
      next.start(0);
      return true;
    },
    connectMic: async () => {
      const token = begin();
      if (ctx.state === 'suspended') await ctx.resume();
      if (!isCurrent(token)) return false;
      const stream = await getUserMedia();
      if (!isCurrent(token)) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      try {
        const mic = ctx.createMediaStreamSource(stream);
        mic.connect(analyser);
        mediaStream = stream;
        source = mic;
        return true;
      } catch (error) {
        stream.getTracks().forEach((track) => track.stop());
        throw error;
      }
    },
    stop: () => { ++generation; disconnectSource(); },
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      ++generation;
      disconnectSource();
      if (ctx.state !== 'closed') await ctx.close();
    },
  };
}
