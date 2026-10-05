import { AU, LIGHT_YEAR_METRES, SUN_DIAMETER_METRES, OBSERVABLE_UNIVERSE_DIAMETER_METRES, REFERENCES, type ScaleReference } from './model';

export type JourneyReference = Omit<ScaleReference, 'kind'> & {
  kind: ScaleReference['kind'] | 'hair' | 'card' | 'grain' | 'ball' | 'book' | 'building' | 'tower' | 'mountain' | 'moon' | 'jupiter' | 'distance' | 'galaxy' | 'star' | 'nebula' | 'cluster' | 'supercluster' | 'universe';
};
const nasaDimensions = { label: 'NASA/JPL · 太阳系尺寸', url: 'https://www.jpl.nasa.gov/edu/pdfs/scaless_reference.pdf' };
const lightUnits = { label: 'NASA/JPL · 光速与儒略年', url: 'https://ssd.jpl.nasa.gov/astro_par.html' };
const lightDistance = (id: string, name: string, metres: number, dimension: string): JourneyReference => ({ id, name, metres, dimension, kind: 'distance', color: '#c4b8eb', source: lightUnits });

// A radius quoted in solar radii has the SAME diameter ratio, not twice it.
const star = (id: string, name: string, solarRadii: number, dimension: string, color: string, source: JourneyReference['source']): JourneyReference => ({
  id, name, metres: solarRadii * SUN_DIAMETER_METRES, dimension, kind: 'star', color, source,
});

/** Everyday dimensions are selected examples, not population averages or standards.
 * Astronomical diameters, orbital diameters, and distances are all lengths, with
 * their measurement stated explicitly. Artwork is drawn here, not copied assets. */
const referenceCatalog: JourneyReference[] = [
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
  star('sirius', '天狼星 A', 1.713, '恒星直径约为太阳的 1.71 倍', '#c6e1fa', { label: 'Davis 等（2011）· 天狼星 A 半径', url: 'https://arxiv.org/abs/1010.3790' }),
  star('arcturus', '大角星', 25.4, '红巨星直径约为太阳的 25.4 倍', '#f2bb7e', { label: 'IAC / Ramírez 等（2011）· 大角星半径', url: 'https://iac.es/en/science-and-technology/publications/fundamental-parameters-and-chemical-composition-arcturus' }),
  star('aldebaran', '毕宿五', 44.2, '红巨星直径约为太阳的 44.2 倍', '#efaa79', { label: 'Richichi 等（2005）· 毕宿五半径', url: 'https://arxiv.org/abs/astro-ph/0502181' }),
  star('antares', '心宿二', 700, '可见光直径约为太阳的 700 倍（估计）', '#e68b72', { label: 'ALMA · 心宿二可见光与射电尺寸', url: 'https://www.almaobservatory.org/en/press-releases/supergiant-atmosphere-of-antares-revealed-by-radio-telescopes/' }),
  star('betelgeuse', '参宿四', 764, '红超巨星直径约为太阳的 764 倍（模型估计）', '#f3a083', { label: 'Joyce 等（2020）· 参宿四半径模型', url: 'https://arxiv.org/abs/2006.09837' }),
  star('vy-cma', '大犬座 VY', 1420, '光球直径约为太阳的 1,420 倍（估计）', '#e38271', { label: 'Wittkowski 等（2012）· 大犬座 VY 光球半径', url: 'https://arxiv.org/abs/1203.5194' }),
  lightDistance('light-minute', '光走一分钟', 299_792_458 * 60, '真空中 60 秒的路程'),
  { id: 'au', name: '日地距离尺度', dimension: '1 AU（约为日地平均距离）', metres: AU, kind: 'distance', color: '#ddbb8c', source: lightUnits },
  { id: 'jupiter-orbit', name: '木星轨道', dimension: '轨道长轴约 10.4 AU', metres: 10.4 * AU, kind: 'solar', color: '#d8c3a2', source: { label: 'NASA · 木星轨道', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html' } },
  REFERENCES[4],
  lightDistance('light-day', '光走一天', 299_792_458 * 86_400, '真空中 24 小时的路程'),
  lightDistance('light-week', '光走一周', 299_792_458 * 86_400 * 7, '真空中 7 天的路程'),
  lightDistance('light-month', '光走三十天', 299_792_458 * 86_400 * 30, '真空中 30 天的路程'),
  lightDistance('light-year', '一光年', LIGHT_YEAR_METRES, '真空中光走一儒略年（365.25 天）的路程'),
  { id: 'proxima', name: '比邻星距离', dimension: '距太阳约 4.24 光年', metres: 4.24 * LIGHT_YEAR_METRES, kind: 'distance', color: '#d2b4b2', source: { label: 'NASA · 最近的恒星', url: 'https://science.nasa.gov/sun/facts/' } },
  { id: 'orion-nebula', name: '猎户座大星云', dimension: '气体与尘埃云跨度约 24 光年', metres: 24 * LIGHT_YEAR_METRES, kind: 'nebula', color: '#d7aacb', source: { label: 'NASA/JPL · 猎户座大星云跨度', url: 'https://nightsky.jpl.nasa.gov/news/174/' } },
  { id: 'omega-centauri', name: '半人马座 ω 星团', dimension: '星团直径约 150 光年', metres: 150 * LIGHT_YEAR_METRES, kind: 'cluster', color: '#d7cda9', source: { label: 'ESA · 半人马座 ω 星团直径', url: 'https://www.esa.int/About_Us/ESAC/A_puzzle_of_10_million_stars' } },
  { id: 'n44', name: 'N44 星云复合体', dimension: '整个复合体跨度约 1,000 光年', metres: 1000 * LIGHT_YEAR_METRES, kind: 'nebula', color: '#b0d4cc', source: { label: 'NASA Hubble · N44 星云复合体', url: 'https://science.nasa.gov/missions/hubble/mysterious-asuperbubblea-hollows-out-nebula-in-new-hubble-image/' } },
  { id: 'small-magellanic', name: '小麦哲伦星系', dimension: '星系跨度约 7,000 光年（近似）', metres: 7000 * LIGHT_YEAR_METRES, kind: 'galaxy', color: '#b2cadd', source: { label: 'NASA Swift · 麦哲伦星系尺度', url: 'https://www.nasa.gov/centers-and-facilities/goddard/nasas-swift-produces-best-ultraviolet-maps-of-the-nearest-galaxies/' } },
  { id: 'galactic-center', name: '银河系中心距离', dimension: '距太阳约 26,000 光年', metres: 26_000 * LIGHT_YEAR_METRES, kind: 'distance', color: '#d8bbdd', source: { label: 'NASA · 银河系中心', url: 'https://www.nasa.gov/universe/scientists-take-viewers-to-the-center-of-the-milky-way/' } },
  { id: 'milky-way', name: '银河系恒星盘', dimension: '直径约 10 万光年（近似尺度）', metres: 100_000 * LIGHT_YEAR_METRES, kind: 'galaxy', color: '#cbb8df', source: { label: 'NASA · 银河系尺度', url: 'https://imagine.gsfc.nasa.gov/ask_astro/galaxies.html' } },
  lightDistance('million-light-years', '一百万光年', 1_000_000 * LIGHT_YEAR_METRES, '真空中光走 100 万儒略年的路程'),
  { id: 'andromeda', name: '仙女座星系距离', dimension: '距地球约 250 万光年（星系间距离参照）', metres: 2_500_000 * LIGHT_YEAR_METRES, kind: 'distance', color: '#cabee9', source: { label: 'NASA · 仙女座星系距离', url: 'https://www.nasa.gov/missions/chandra/andromeda-galaxy-vibaj/' } },
  lightDistance('ten-million-light-years', '一千万光年', 10_000_000 * LIGHT_YEAR_METRES, '长度参照 · 1,000 万光年'),
  { id: 'm87-distance', name: 'M87 星系距离', dimension: '距地球约 5,400 万光年（室女座星系团内）', metres: 54_000_000 * LIGHT_YEAR_METRES, kind: 'distance', color: '#b7d0dc', source: { label: 'NASA Hubble · M87 距离', url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-87/' } },
  { id: 'laniakea', name: '拉尼亚凯亚超星系团', dimension: '速度流域跨度约 5.2 亿光年（定义相关）', metres: 520_000_000 * LIGHT_YEAR_METRES, kind: 'supercluster', color: '#a3d4cd', source: { label: 'Tully 等（2014）· 拉尼亚凯亚 160 Mpc 跨度', url: 'https://arxiv.org/abs/1409.0880' } },
  lightDistance('billion-light-years', '十亿光年', 1_000_000_000 * LIGHT_YEAR_METRES, '长度参照 · 10 亿光年'),
  lightDistance('ten-billion-light-years', '一百亿光年', 10_000_000_000 * LIGHT_YEAR_METRES, '长度参照 · 100 亿光年'),
  { id: 'observable-universe', name: '可观测宇宙', dimension: '当前直径约 920 亿光年（模型近似）', metres: OBSERVABLE_UNIVERSE_DIAMETER_METRES, kind: 'universe', color: '#d4bedf', source: { label: 'NASA（2025）· 可观测宇宙约 920 亿光年', url: 'https://www.nasa.gov/science-research/astrophysics/how-big-is-space-we-asked-a-nasa-expert-episode-61/' } },
];
// Sort actual measured lengths: a giant star can exceed an inner planetary orbit.
export const JOURNEY_REFERENCES: readonly JourneyReference[] = referenceCatalog.sort((a, b) => a.metres - b.metres);
export const MILESTONE_REFERENCES = JOURNEY_REFERENCES.filter(ref => ['person', 'house', 'earth', 'sun', 'betelgeuse', 'solar', 'milky-way', 'andromeda', 'laniakea', 'observable-universe'].includes(ref.id));

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
export function projectedReferences(logView: number, area: number, thicknessMetres?: number) {
  // Keep the diagram tied to its two named comparison cards. Dense stellar
  // estimates otherwise pile several bright discs onto the same two lanes.
  const neighbours = thicknessMetres === undefined ? undefined : adjacentReferences(thicknessMetres);
  const candidates = JOURNEY_REFERENCES.map((reference, index) => {
    const pixels = reference.metres * area / 2 ** logView;
    const fadeIn = Math.min(1, Math.max(0, (pixels - 3) / 7));
    const fadeOut = Math.min(1, Math.max(0, (area * 2.2 - pixels) / (area * 1.2)));
    return { reference, index, pixels, opacity: fadeIn * fadeOut };
  }).filter(item => item.opacity > .01);
  if (!neighbours) return candidates;
  const selected = candidates.filter(item => item.reference === neighbours.previous || item.reference === neighbours.next);
  const readable = (item: typeof candidates[number]) => item.pixels >= 10 && item.pixels <= area && item.opacity === 1;
  // The first folds deliberately hold a wider camera view. A single larger
  // anchor keeps very thin unfolded sheets from losing a readable comparison.
  if (!selected.some(readable)) {
    const anchor = candidates.find(readable);
    if (anchor && !selected.includes(anchor)) selected.push(anchor);
  }
  return selected;
}

const ratioFormatter = new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 3, notation: 'compact' });
export const formatRatio = (value: number) => ratioFormatter.format(value);

