import { AU, LIGHT_YEAR_METRES, REFERENCES, type ScaleReference } from './model';

export type JourneyReference = Omit<ScaleReference, 'kind'> & {
  kind: ScaleReference['kind'] | 'hair' | 'card' | 'grain' | 'ball' | 'book' | 'building' | 'tower' | 'mountain' | 'moon' | 'jupiter' | 'distance' | 'galaxy';
};
const nasaDimensions = { label: 'NASA/JPL · 太阳系尺寸', url: 'https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf' };
const lightUnits = { label: 'NASA/JPL · 光速与儒略年', url: 'https://ssd.jpl.nasa.gov/astro_par.html' };
const lightDistance = (id: string, name: string, metres: number, dimension: string): JourneyReference => ({ id, name, metres, dimension, kind: 'distance', color: '#c4b8eb', source: lightUnits });

/** Everyday dimensions are selected examples, not population averages or standards.
 * Astronomical diameters, orbital diameters, and distances are all lengths, with
 * their measurement stated explicitly. Artwork is drawn here, not copied assets. */
export const JOURNEY_REFERENCES: readonly JourneyReference[] = [
  { id: 'hair', name: '一根头发', dimension: '直径 0.07 毫米（示意）', metres: .00007, kind: 'hair', color: '#c5ac89' },
  { id: 'card', name: '一张卡片', dimension: '厚度 0.8 毫米（示意）', metres: .0008, kind: 'card', color: '#a1c7ba' },
  { id: 'grain', name: '一粒米', dimension: '长度 7 毫米（示意）', metres: .007, kind: 'grain', color: '#ddcfab' },
  { id: 'ball', name: '一颗网球', dimension: '直径 6.7 厘米（示意）', metres: .067, kind: 'ball', color: '#c2cf8e' },
  { id: 'book', name: '一本书', dimension: '高度 24 厘米（示意）', metres: .24, kind: 'book', color: '#a2c5c9' },
  REFERENCES[0], REFERENCES[1],
  { id: 'building', name: '一座高楼', dimension: '高度 100 米（示意）', metres: 100, kind: 'building', color: '#9ebdc7' },
  { id: 'tower', name: '哈利法塔', dimension: '建筑高度约 828 米', metres: 828, kind: 'tower', color: '#b7c4cb', source: { label: '哈利法塔 · 建筑数据', url: 'https://www.burjkhalifa.ae/img/fact-sheet.pdf' } },
  { id: 'everest', name: '珠穆朗玛峰', dimension: '海拔约 8,849 米（相对海平面）', metres: 8849, kind: 'mountain', color: '#cad7d5', source: { label: '尼泊尔政府 · 珠峰高程', url: 'https://mofa.gov.np/wp-content/uploads/2022/01/Annual-Report-2078-Final-A.pdf' } },
  { id: 'karman', name: '卡门线', dimension: '离地高度 100 千米（约定界线）', metres: 100_000, kind: 'distance', color: '#90c3d4', source: { label: 'FAI · 100 千米卡门线', url: 'https://www.fai.org/news/statement-about-karman-line' } },
  { id: 'iss', name: '空间站轨道高度', dimension: '离地约 400 千米（随轨道变化）', metres: 400_000, kind: 'distance', color: '#afc9d9', source: { label: 'ESA · 空间站轨道高度', url: 'https://www.esa.int/ESA_Multimedia/Videos/2022/04/ISS_Reboost_Cosmic_Kiss/' } },
  { id: 'moon', name: '月球', dimension: '平均直径约 3,475 千米', metres: 3_475_000, kind: 'moon', color: '#cbd0d4', source: nasaDimensions },
  REFERENCES[2],
  { id: 'jupiter', name: '木星', dimension: '赤道直径约 142,984 千米', metres: 142_984_000, kind: 'jupiter', color: '#dac2a8', source: nasaDimensions },
  { id: 'earth-moon', name: '地月距离', dimension: '中心间平均距离约 384,400 千米', metres: 384_400_000, kind: 'distance', color: '#abcbd7', source: { label: 'NASA · 月球距离', url: 'https://science.nasa.gov/moon/facts/' } },
  REFERENCES[3],
  lightDistance('light-minute', '光走一分钟', 299_792_458 * 60, '真空中 60 秒的路程'),
  { id: 'au', name: '日地距离尺度', dimension: '1 AU（约为日地平均距离）', metres: AU, kind: 'distance', color: '#ddbb8c', source: lightUnits },
  { id: 'jupiter-orbit', name: '木星轨道', dimension: '轨道长轴约 10.4 AU', metres: 10.4 * AU, kind: 'solar', color: '#d8c3a2', source: { label: 'NASA · 木星轨道', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html' } },
  REFERENCES[4],
  lightDistance('light-day', '光走一天', 299_792_458 * 86_400, '真空中 24 小时的路程'),
  lightDistance('light-week', '光走一周', 299_792_458 * 86_400 * 7, '真空中 7 天的路程'),
  lightDistance('light-month', '光走三十天', 299_792_458 * 86_400 * 30, '真空中 30 天的路程'),
  lightDistance('light-year', '一光年', LIGHT_YEAR_METRES, '真空中光走一儒略年（365.25 天）的路程'),
  { id: 'proxima', name: '比邻星距离', dimension: '距太阳约 4.24 光年', metres: 4.24 * LIGHT_YEAR_METRES, kind: 'distance', color: '#d2b4b2', source: { label: 'NASA · 最近的恒星', url: 'https://science.nasa.gov/sun/facts/' } },
  lightDistance('ten-light-years', '十光年', 10 * LIGHT_YEAR_METRES, '真空中光走 10 儒略年的路程'),
  lightDistance('hundred-light-years', '一百光年', 100 * LIGHT_YEAR_METRES, '真空中光走 100 儒略年的路程'),
  lightDistance('thousand-light-years', '一千光年', 1000 * LIGHT_YEAR_METRES, '真空中光走 1,000 儒略年的路程'),
  lightDistance('ten-thousand-light-years', '一万光年', 10_000 * LIGHT_YEAR_METRES, '真空中光走 10,000 儒略年的路程'),
  { id: 'galactic-center', name: '银河系中心距离', dimension: '距太阳约 26,000 光年', metres: 26_000 * LIGHT_YEAR_METRES, kind: 'distance', color: '#d8bbdd', source: { label: 'NASA · 银河系中心', url: 'https://www.nasa.gov/universe/scientists-take-viewers-to-the-center-of-the-milky-way/' } },
  { id: 'milky-way', name: '银河系恒星盘', dimension: '直径约 10 万光年（近似尺度）', metres: 100_000 * LIGHT_YEAR_METRES, kind: 'galaxy', color: '#cbb8df', source: { label: 'NASA · 银河系尺度', url: 'https://imagine.gsfc.nasa.gov/ask_astro/galaxies.html' } },
  lightDistance('million-light-years', '一百万光年', 1_000_000 * LIGHT_YEAR_METRES, '真空中光走 100 万儒略年的路程'),
];

/** Neighbours always bracket the *displayed* thickness, including fractional
 * camera transitions. At either catalog edge the available neighbour remains. */
export function adjacentReferences(metres: number) {
  const nextIndex = JOURNEY_REFERENCES.findIndex(ref => ref.metres > metres);
  const previous = nextIndex === -1 ? JOURNEY_REFERENCES.at(-1) : JOURNEY_REFERENCES[nextIndex - 1];
  const next = nextIndex === -1 ? undefined : JOURNEY_REFERENCES[nextIndex];
  return { previous, next };
}

/** Same projection used by the canvas and coverage tests. A full-size reference
 * is always retained in the 10 px–scene-height band; adjacent objects fade at
 * the band edges rather than disappearing in long gaps. */
export function projectedReferences(logView: number, area: number) {
  return JOURNEY_REFERENCES.map((reference, index) => {
    const pixels = reference.metres * area / 2 ** logView;
    const fadeIn = Math.min(1, Math.max(0, (pixels - 3) / 7));
    const fadeOut = Math.min(1, Math.max(0, (area * 2.2 - pixels) / (area * 1.2)));
    return { reference, index, pixels, opacity: fadeIn * fadeOut };
  }).filter(item => item.opacity > .01);
}

const ratioFormatter = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 3, notation: 'compact' });
export const formatRatio = (value: number) => ratioFormatter.format(value);
