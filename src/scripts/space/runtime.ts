/** Probe before loading large textures; Three r185 requires WebGL 2. */
export function hasWebGL2(canvas: Pick<HTMLCanvasElement, 'getContext'>): boolean {
  try {
    return !!canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
  } catch {
    return false;
  }
}

export function prefersReducedMotion(media: Pick<MediaQueryList, 'matches'>): boolean {
  return media.matches;
}
