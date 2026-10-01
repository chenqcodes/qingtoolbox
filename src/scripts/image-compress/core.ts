/** All limits use exact bytes: 1 KB = 1024 bytes. No network is needed. */
export const MIN_QUALITY = 0.1;
export const MAX_DIMENSION = 16384;
export const MAX_PIXELS = 40_000_000;
export type OutputMime = 'image/jpeg' | 'image/webp' | 'image/png';
export type Dimensions = { width: number; height: number };
export type CompressionOptions = Dimensions & {
  mime: OutputMime;
  maxQuality: number;
  targetBytes?: number;
  allowResize: boolean;
};
export type CompressionResult = Dimensions & {
  blob: Blob;
  quality?: number;
  targetMet?: boolean;
  resized: boolean;
};
export type Encoder = (width: number, height: number, quality: number) => Promise<Blob>;

export function parseOptionalDimension(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_DIMENSION) {
    throw new Error(`宽高需为 1–${MAX_DIMENSION} 的整数`);
  }
  return n;
}

export function targetFromKB(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.1 || n > 102400) {
    throw new Error('目标大小需在 0.1–102400 KB 之间');
  }
  return Math.floor(n * 1024);
}

/** Width and height are bounding-box limits; never crop, stretch, or upscale. */
export function fitDimensions(
  sourceWidth: number,
  sourceHeight: number,
  width?: number,
  height?: number,
  scale = 1,
): Dimensions {
  if (![sourceWidth, sourceHeight].every((n) => Number.isInteger(n) && n > 0)) {
    throw new Error('无法读取图片尺寸');
  }
  if (![width, height].every((n) => n === undefined || (Number.isInteger(n) && n > 0 && n <= MAX_DIMENSION))) {
    throw new Error('宽高无效');
  }
  if (!Number.isFinite(scale) || scale <= 0 || scale > 1) throw new Error('尺寸比例无效');
  const ratio = width !== undefined || height !== undefined
    ? Math.min(1, width === undefined ? 1 : width / sourceWidth, height === undefined ? 1 : height / sourceHeight)
    : scale;
  const result = {
    width: Math.max(1, Math.round(sourceWidth * ratio)),
    height: Math.max(1, Math.round(sourceHeight * ratio)),
  };
  if (result.width > MAX_DIMENSION || result.height > MAX_DIMENSION || result.width * result.height > MAX_PIXELS) {
    throw new Error('输出尺寸过大，请先降低尺寸比例或宽高上限（最多 4000 万像素）');
  }
  return result;
}

export function safeOutputName(original: string, mime: OutputMime): string {
  const leaf = original.split(/[\\/]/).pop() || 'image';
  const stem = leaf.replace(/\.[^.]*$/, '').replace(/[<>:"|?*\u0000-\u001f\u007f]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 150) || 'image';
  const safeStem = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem) ? `image-${stem}` : stem;
  return `${safeStem}.${mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png'}`;
}

/** Resolve every collision, including names which already contain a suffix. */
export function uniqueOutputNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let candidate = name;
    let i = 1;
    while (used.has(candidate.toLowerCase())) candidate = `${stem}-${i++}${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

/** Bounded quality-first search. A pass always comes from a measured Blob, never an estimate. */
export async function compressToTarget(
  encode: Encoder,
  options: CompressionOptions,
  isCancelled: () => boolean = () => false,
): Promise<CompressionResult> {
  const { width, height, mime, maxQuality, targetBytes, allowResize } = options;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) throw new Error('输出尺寸无效或过大');
  if (!Number.isFinite(maxQuality) || maxQuality < MIN_QUALITY || maxQuality > 1) throw new Error('质量无效');
  if (targetBytes !== undefined && (!Number.isInteger(targetBytes) || targetBytes < 1)) throw new Error('目标大小无效');
  if (!['image/jpeg', 'image/webp', 'image/png'].includes(mime)) throw new Error('输出格式无效');
  const check = () => { if (isCancelled()) throw new DOMException('已取消', 'AbortError'); };
  const candidate = async (w: number, h: number, quality: number): Promise<CompressionResult> => {
    check();
    const blob = await encode(w, h, quality);
    check();
    if (!blob.size) throw new Error('图片导出为空，请减小尺寸后重试');
    if (blob.type !== mime) throw new Error(`浏览器不支持所选格式（实际返回 ${blob.type || '未知格式'}），请改用 JPEG 或 PNG`);
    return { blob, width: w, height: h, quality: mime === 'image/png' ? undefined : quality, targetMet: targetBytes === undefined ? undefined : blob.size <= targetBytes, resized: w !== width || h !== height };
  };
  const atSize = async (w: number, h: number): Promise<CompressionResult> => {
    const high = await candidate(w, h, maxQuality);
    if (targetBytes === undefined || high.targetMet || mime === 'image/png' || maxQuality === MIN_QUALITY) return high;
    const low = await candidate(w, h, MIN_QUALITY);
    if (!low.targetMet) return low.blob.size < high.blob.size ? low : high;
    let best = low;
    let qLo = MIN_QUALITY;
    let qHi = maxQuality;
    for (let i = 0; i < 8; i++) {
      const q = (qLo + qHi) / 2;
      const result = await candidate(w, h, q);
      if (result.targetMet) { best = result; qLo = q; } else qHi = q;
    }
    return best;
  };
  let smallest = await atSize(width, height);
  if (targetBytes === undefined || smallest.targetMet || !allowResize) return smallest;

  // Find a smaller passing size, then refine the largest passing scale.
  // Quality is fully searched at each tested size. Rounding is at most one pixel.
  let failedScale = 1;
  let searchScale = 1;
  let previousWidth = width;
  let previousHeight = height;
  for (let step = 0; step < 18; step++) {
    const suggested = Math.sqrt(targetBytes / smallest.blob.size) * 0.95;
    searchScale *= Math.min(0.8, Math.max(0.1, suggested));
    const w = step === 17 ? 1 : Math.max(1, Math.floor(width * searchScale));
    const h = step === 17 ? 1 : Math.max(1, Math.floor(height * searchScale));
    if (w === previousWidth && h === previousHeight) continue;
    previousWidth = w;
    previousHeight = h;
    const result = await atSize(w, h);
    if (result.blob.size < smallest.blob.size) smallest = result;
    if (result.targetMet) {
      let best = result;
      let lowScale = Math.min(w / width, h / height);
      let highScale = failedScale;
      for (let i = 0; i < 6; i++) {
        const middle = (lowScale + highScale) / 2;
        const mw = Math.max(1, Math.floor(width * middle));
        const mh = Math.max(1, Math.floor(height * middle));
        if (mw === best.width && mh === best.height) { lowScale = middle; continue; }
        const refined = await atSize(mw, mh);
        if (refined.targetMet) { best = refined; lowScale = middle; } else highScale = middle;
      }
      return best;
    }
    if (w === 1 && h === 1) break;
    failedScale = searchScale;
  }
  return smallest;
}
