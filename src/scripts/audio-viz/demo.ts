export const DEMO_SECONDS = 12;
/** Locally synthesized, original three-band signal. No asset fetch or microphone. */
export function fillDemo(samples: Float32Array, sampleRate: number) {
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    const beat = Math.pow(Math.max(0, 1 - (t % 0.5) / 0.5), 5);
    const low = Math.sin(2 * Math.PI * 90 * t) * beat;
    const phrase = Math.floor(t / 3) % 4;
    const pitch = [440, 554.365, 659.255, 523.251][phrase];
    const envelope = Math.sin(Math.PI * (t % 0.75) / 0.75) ** 2;
    const mid = Math.sin(2 * Math.PI * pitch * t) * envelope;
    const high = Math.sin(2 * Math.PI * 3200 * t) * Math.pow(Math.max(0, 1 - (t % 0.25) / 0.08), 3);
    // Smooth edges avoid clicks when looping. Peak is bounded below 0.7.
    const fade = Math.min(1, t / 0.02, (samples.length / sampleRate - t) / 0.02);
    samples[i] = (low * 0.35 + mid * 0.2 + high * 0.1) * Math.max(0, fade);
  }
}
