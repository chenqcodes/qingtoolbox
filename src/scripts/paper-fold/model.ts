/** Ideal folding model: every fold doubles thickness, with no compression. */
export const MIN_FOLDS = 0;
export const MAX_FOLDS = 107;
export const DEFAULT_THICKNESS_MM = 0.1;
export const MIN_THICKNESS_MM = 0.01;
export const MAX_THICKNESS_MM = 1;

/** Exact SI definition of the astronomical unit, in metres. */
export const AU = 149_597_870_700;
/** Distance light travels in vacuum in one Julian year (365.25 days). */
export const LIGHT_YEAR_METRES = 299_792_458 * 365.25 * 86_400;

/** Present-day diameter, rounded NASA educational estimate (not the whole universe). */
export const OBSERVABLE_UNIVERSE_DIAMETER_METRES = 92_000_000_000 * LIGHT_YEAR_METRES;
export const SUN_DIAMETER_METRES = 1_391_400_000;

export type ReferenceKind = 'person' | 'house' | 'earth' | 'sun' | 'solar';

export interface ScaleReference {
  id: string;
  name: string;
  dimension: string;
  metres: number;
  color: string;
  kind: ReferenceKind;
  source?: { label: string; url: string };
}

/** Illustrative everyday heights and explicitly defined astronomical scales. */
export const REFERENCES: readonly ScaleReference[] = [
  {
    id: 'person', name: '一个人', dimension: '身高 1.7 米（示意）',
    metres: 1.7, color: '#34d399', kind: 'person',
  },
  {
    id: 'house', name: '一栋房子', dimension: '高度 10 米（示意）',
    metres: 10, color: '#fbbf24', kind: 'house',
  },
  {
    id: 'earth', name: '地球', dimension: '赤道直径约 12,756 千米',
    metres: 12_756_000, color: '#38bdf8', kind: 'earth',
    source: { label: 'NASA：地球数据', url: 'https://science.nasa.gov/earth/facts/' },
  },
  {
    id: 'sun', name: '太阳', dimension: '直径约 1,391,400 千米',
    metres: SUN_DIAMETER_METRES, color: '#fb923c', kind: 'sun',
    source: { label: 'NASA JPL：太阳系尺寸', url: 'https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf' },
  },
  {
    id: 'solar', name: '海王星轨道',
    dimension: '轨道直径约 60 AU（近似值，并非太阳系边界）',
    metres: 60 * AU, color: '#a78bfa', kind: 'solar',
    source: { label: 'NASA：海王星轨道数据', url: 'https://science.nasa.gov/neptune/neptune-facts/' },
  },
];

export type Reference = (typeof REFERENCES)[number];

/** Round to the nearest fold; an invalid number resets to the unfolded sheet. */
export function clampFolds(value: number): number {
  if (!Number.isFinite(value)) return MIN_FOLDS;
  return Math.min(MAX_FOLDS, Math.max(MIN_FOLDS, Math.round(value)));
}

/** Keep fractional millimetres intact; an invalid number uses ordinary paper. */
export function clampThickness(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THICKNESS_MM;
  return Math.min(MAX_THICKNESS_MM, Math.max(MIN_THICKNESS_MM, value));
}

export function thicknessMetres(folds: number, thicknessMm = DEFAULT_THICKNESS_MM): number {
  return (clampThickness(thicknessMm) / 1_000) * 2 ** clampFolds(folds);
}

/** BigInt keeps the layer count exact beyond Number.MAX_SAFE_INTEGER. */
export function layers(folds: number): bigint {
  return 1n << BigInt(clampFolds(folds));
}

const lengthFormatter = new Intl.NumberFormat('zh-CN', {
  maximumSignificantDigits: 4,
  notation: 'compact',
  compactDisplay: 'short',
});

/** Unit selection uses the unrounded value; negative/non-finite lengths are invalid. */
export function formatLength(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  let unit: string;
  let amount: number;
  if (metres >= LIGHT_YEAR_METRES) {
    unit = '光年'; amount = metres / LIGHT_YEAR_METRES;
  } else if (metres >= AU) {
    unit = 'AU'; amount = metres / AU;
  } else if (metres >= 1_000) {
    unit = '千米'; amount = metres / 1_000;
  } else if (metres >= 1) {
    unit = '米'; amount = metres;
  } else if (metres >= 0.01) {
    unit = '厘米'; amount = metres * 100;
  } else {
    unit = '毫米'; amount = metres * 1_000;
  }
  return `${lengthFormatter.format(amount)} ${unit}`;
}

/** Four significant digits with a normalized mantissa, including rounding to 10. */
export function scientificMetres(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '—';
  const [mantissa, exponent] = metres.toExponential(3).split('e');
  return `${Number(mantissa)} × 10^${Number(exponent)} m`;
}

/** First allowed fold meeting the reference, or null if it cannot be reached. */
export function milestoneFold(referenceMetres: number, thicknessMm = DEFAULT_THICKNESS_MM): number | null {
  if (!Number.isFinite(referenceMetres) || referenceMetres < 0) return null;
  const initialMetres = clampThickness(thicknessMm) / 1_000;
  // Only 108 candidates: a direct comparison avoids log2 boundary round-off.
  for (let folds = MIN_FOLDS; folds <= MAX_FOLDS; folds++) {
    if (initialMetres * 2 ** folds >= referenceMetres) return folds;
  }
  return null;
}

/** Largest 1/2/5 × 10^n scale at or below a positive canvas-ruler length. */
export function niceScale(metres: number): number {
  if (!Number.isFinite(metres) || metres <= 0) return 1;
  const exponent = Math.floor(Math.log10(metres));
  // String-to-number conversion also handles the smallest subnormal doubles.
  for (let power = exponent; power >= -324; power--) {
    for (const coefficient of [5, 2, 1]) {
      const candidate = Number(`${coefficient}e${power}`);
      if (candidate > 0 && candidate <= metres) return candidate;
    }
  }
  return Number.MIN_VALUE;
}

/** End at the first fold reaching the observable universe for the selected paper.
 * A per-paper endpoint avoids inventing reference objects beyond observation. */
export function journeyFoldLimit(thicknessMm = DEFAULT_THICKNESS_MM): number {
  return milestoneFold(OBSERVABLE_UNIVERSE_DIAMETER_METRES, thicknessMm)!;
}
