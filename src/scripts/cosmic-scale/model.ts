/** SI metres throughout. View exponent is log10(horizontal field width in metres). */
export const AU = 149_597_870_700;
export const LIGHT_YEAR = 299_792_458 * 365.25 * 86_400;
export type Kind = 'dna' | 'cell' | 'sand' | 'cup' | 'person' | 'block' | 'city' | 'earth' | 'moon-distance' | 'sun' | 'solar' | 'stellar' | 'galaxy';
export interface ScaleStop {
  id: string; name: string; chapter: string; size: number; dimension: string; kind: Kind;
  color: string; fact: string; caveat: string; source?: { name: string; url: string };
}
export const STOPS: readonly ScaleStop[] = [
  { id: 'dna', name: 'DNA 双螺旋', chapter: '01 / 微观世界', size: 10e-9, dimension: '直径约 2 纳米', kind: 'dna', color: '#87dddb', fact: '遗传信息，写在分子里。常见 B 型 DNA 的双螺旋宽约 2 纳米，一圈长约 3.4 纳米。', caveat: '绘制长度为 10 纳米的片段；颜色与骨架粗细为示意，并非分子的真实外观。', source: { name: 'NCBI · DNA 结构', url: 'https://www.ncbi.nlm.nih.gov/books/NBK9944/' } },
  { id: 'cell', name: '一枚红细胞', chapter: '01 / 微观世界', size: 7.5e-6, dimension: '直径约 7.5 微米', kind: 'cell', color: '#ed8793', fact: '小到肉眼看不见，却每时每刻都在运输氧气。正常人类红细胞的直径通常约为 7–8 微米。', caveat: '这里取 7.5 微米，绘制双凹圆盘的俯视示意；不同细胞大小有差异。', source: { name: '红细胞测量研究 · PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/7442327/' } },
  { id: 'sand', name: '一粒细沙', chapter: '02 / 触手可及', size: 0.0005, dimension: '示例宽度 0.5 毫米', kind: 'sand', color: '#e6c58f', fact: '从显微镜回到掌心。一粒沙不是固定大小的单位；这颗沙粒只是日常尺度的参照。', caveat: '人为选取 0.5 毫米的示例，形状和材质为艺术示意。' },
  { id: 'cup', name: '你手边的杯子', chapter: '02 / 触手可及', size: 0.12, dimension: '示例总宽 12 厘米', kind: 'cup', color: '#aadbc9', fact: '旅程从一个熟悉的物件开始。每向外跨一格，视野就扩大 10 倍，杯子会缩小到原来的十分之一。', caveat: '示例杯子含把手总宽 12 厘米；不是所有杯子的标准尺寸，蒸汽不计入宽度。' },
  { id: 'person', name: '一个人的身高', chapter: '02 / 触手可及', size: 1.7, dimension: '示例身高 1.7 米', kind: 'person', color: '#c4baeb', fact: '杯子、身体、街区，都在同一把尺上。熟悉的距离也可以成为理解宇宙的起点。', caveat: '1.7 米仅为选定的参照身高，人物为正视示意，姿态不改变标注身高。' },
  { id: 'block', name: '一个城市街区', chapter: '03 / 我们的星球', size: 200, dimension: '示例边长 200 米', kind: 'block', color: '#f3cb8b', fact: '从人的尺度退后，街道组成新的纹理。这一块方形街区，按 200 米边长绘制。', caveat: '虚构街区的俯视示意；建筑排列为设计，非实测地图。' },
  { id: 'city', name: '一座城市', chapter: '03 / 我们的星球', size: 30_000, dimension: '示例区域直径 30 千米', kind: 'city', color: '#96c9d9', fact: '道路像细细的神经，连接着许多人的日常。这片区域的跨度是 150 个示例街区。', caveat: '虚构的 30 千米城市范围，不代表特定城市的行政边界或实际大小。' },
  { id: 'earth', name: '地球', chapter: '03 / 我们的星球', size: 12_756_000, dimension: '赤道直径约 12,756 千米', kind: 'earth', color: '#83c8eb', fact: '我们所有的日常，都在这颗蓝色星球上。这里的标尺对应赤道直径；地球并非完美的球体。', caveat: '大陆轮廓、云层和光照为艺术示意，球面尺寸按赤道直径绘制。', source: { name: 'NASA · 地球事实', url: 'https://science.nasa.gov/earth/facts/' } },
  { id: 'moon', name: '地球到月球', chapter: '04 / 星间距离', size: 384_400_000, dimension: '平均中心距离约 38.44 万千米', kind: 'moon-distance', color: '#cbd5ee', fact: '地球与月球之间，是大片的空。两者平均中心距离约相当于 30 个地球直径。', caveat: '地月尺寸与中心距离使用同一比例；位置为示意，轨道距离随时间变化。', source: { name: 'NASA · 月球事实', url: 'https://science.nasa.gov/moon/facts/' } },
  { id: 'sun', name: '太阳', chapter: '04 / 星间距离', size: 1.4e9, dimension: '直径约 140 万千米', kind: 'sun', color: '#ffd58d', fact: '一颗恒星的分量。太阳直径约为地球的 110 倍；旁边的小蓝点与太阳使用相同的比例。', caveat: '地球被并排放置作尺寸对照，不是日地距离；发光晕不计入太阳直径。', source: { name: 'NASA · 太阳事实', url: 'https://science.nasa.gov/sun/facts/' } },
  { id: 'solar', name: '太阳系行星区', chapter: '04 / 星间距离', size: 60.12 * AU, dimension: '海王星轨道直径约 60.12 AU', kind: 'solar', color: '#d2b9f6', fact: '这次比较的是轨道，而不是行星的大小。海王星轨道半长轴约 30.06 AU，图中取两倍作为行星区跨度。', caveat: '轨道简化为共面圆，半径按比例；彩色定位点被放大，非行星直径。这不是整个太阳系的边界。', source: { name: 'NASA · 海王星轨道', url: 'https://science.nasa.gov/asset/hubble/compass-and-scale-image-of-neptune/' } },
  { id: 'stellar', name: '最近的恒星邻居', chapter: '05 / 银河之外的眼光', size: 4.24 * LIGHT_YEAR, dimension: '比邻星距离约 4.24 光年', kind: 'stellar', color: '#f6cfaa', fact: '光年是长度，不是时间。即使是光，从太阳附近前往比邻星，也需要四年多。', caveat: '画线长度表示日近邻到比邻星的约略距离；两端星点为放大的定位标记，非恒星尺寸。', source: { name: 'NASA · 比邻星', url: 'https://asd.gsfc.nasa.gov/luvoir/events/seminars/2017/ProximaCenb_LUVOIRcolloquium.pdf' } },
  { id: 'galaxy', name: '银河系', chapter: '05 / 银河之外的眼光', size: 100_000 * LIGHT_YEAR, dimension: '恒星盘直径约 10 万光年', kind: 'galaxy', color: '#d6c2fa', fact: '太阳只是银河中众多恒星之一。银河的恒星盘约横跨十万光年，边缘并没有一条清晰的界线。', caveat: '螺旋结构与恒星光点为艺术示意；约 10 万光年指恒星盘，不包含更大的暗物质晕。', source: { name: 'NASA · 银河的尺度', url: 'https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/' } },
];
export const MIN_EXP = Math.log10(STOPS[0].size * 3);
export const MAX_EXP = Math.log10(STOPS[STOPS.length - 1].size * 3);
export const HOME_EXP = Math.log10(STOPS.find(s => s.id === 'cup')!.size * 3);
export const clamp = (value: number, min = MIN_EXP, max = MAX_EXP): number => Math.min(max, Math.max(min, Number.isFinite(value) ? value : HOME_EXP));
export const stopExponent = (stop: ScaleStop): number => Math.log10(stop.size * 3);
export const projectedSize = (metres: number, exponent: number, width: number): number => metres / 10 ** exponent * width;
export function nearestStop(exponent: number): ScaleStop {
  return STOPS.reduce((best, stop) => Math.abs(stopExponent(stop) - exponent) < Math.abs(stopExponent(best) - exponent) ? stop : best);
}
const number = (n: number): string => new Intl.NumberFormat('zh-CN', { maximumSignificantDigits: 3 }).format(n);
export function formatLength(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m === 0) return '0 米';
  if (m >= LIGHT_YEAR * .1) {
    const ly = m / LIGHT_YEAR;
    return ly >= 10_000 ? `${number(ly / 10_000)} 万光年` : `${number(ly)} 光年`;
  }
  if (m >= AU * .1) return `${number(m / AU)} AU`;
  if (m >= 1e7) return `${number(m / 1e7)} 万千米`;
  if (m >= 1000) return `${number(m / 1000)} 千米`;
  if (m >= 1) return `${number(m)} 米`;
  if (m >= .01) return `${number(m * 100)} 厘米`;
  if (m >= .001) return `${number(m * 1000)} 毫米`;
  if (m >= 1e-6) return `${number(m * 1e6)} 微米`;
  return `${number(m * 1e9)} 纳米`;
}
/** Pick a 1/2/5 length spanning at most a fifth of the actual horizontal field. */
export function scaleBar(exponent: number, width: number): { metres: number; pixels: number } {
  const ideal = 10 ** exponent * .2;
  const order = 10 ** Math.floor(Math.log10(ideal));
  const multiplier = ideal / order >= 5 ? 5 : ideal / order >= 2 ? 2 : 1;
  const metres = multiplier * order;
  return { metres, pixels: projectedSize(metres, exponent, width) };
}
export function nextStop(exponent: number, direction: -1 | 1): ScaleStop {
  return direction === 1 ? STOPS.find(stop => stopExponent(stop) > exponent + .025) ?? STOPS[STOPS.length - 1] : [...STOPS].reverse().find(stop => stopExponent(stop) < exponent - .025) ?? STOPS[0];
}
