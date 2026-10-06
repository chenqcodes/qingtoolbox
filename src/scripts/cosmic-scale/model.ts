/** SI metres throughout. View exponent is log10(horizontal field width in metres). */
export const AU = 149_597_870_700;
export const LIGHT_YEAR = 299_792_458 * 365.25 * 86_400;
export type Kind = 'dna' | 'cell' | 'sand' | 'cup' | 'person' | 'block' | 'city' | 'earth' | 'moon-distance' | 'sun' | 'solar' | 'stellar' | 'galaxy' | 'virus' | 'bacterium' | 'pollen' | 'seed' | 'coin' | 'tree' | 'park' | 'region' | 'moon-body' | 'jupiter' | 'giant' | 'orbit' | 'heliosphere' | 'comet-orbit' | 'oort' | 'nebula' | 'cluster' | 'bubble' | 'arm' | 'galaxy-distance' | 'galaxy-group' | 'galaxy-cluster' | 'supercluster' | 'laniakea' | 'wall' | 'cosmic-web' | 'observable';
export interface ScaleStop {
  id: string; name: string; chapter: string; size: number; dimension: string; kind: Kind;
  color: string; fact: string; caveat: string; source?: { name: string; url: string };
}
const LANDMARKS: readonly ScaleStop[] = [
  { id: 'dna', name: 'DNA 双螺旋', chapter: '01 / 微观世界', size: 10e-9, dimension: '片段长 10 纳米 · 双螺旋直径约 2 纳米', kind: 'dna', color: '#87dddb', fact: '遗传信息，写在分子里。常见 B 型 DNA 的双螺旋宽约 2 纳米，一圈长约 3.4 纳米。', caveat: '绘制长度为 10 纳米的片段；颜色与骨架粗细为示意，并非分子的真实外观。', source: { name: 'NCBI · DNA 结构', url: 'https://www.ncbi.nlm.nih.gov/books/NBK9944/' } },
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
  { id: 'stellar', name: '最近的恒星邻居', chapter: '06 / 银河里的风景', size: 4.24 * LIGHT_YEAR, dimension: '比邻星距离约 4.24 光年', kind: 'stellar', color: '#f6cfaa', fact: '光年是长度，不是时间。即使是光，从太阳附近前往比邻星，也需要四年多。', caveat: '画线长度表示日近邻到比邻星的约略距离；两端星点为放大的定位标记，非恒星尺寸。', source: { name: 'NASA · 比邻星', url: 'https://asd.gsfc.nasa.gov/luvoir/events/seminars/2017/ProximaCenb_LUVOIRcolloquium.pdf' } },
  { id: 'galaxy', name: '银河系', chapter: '06 / 银河里的风景', size: 100_000 * LIGHT_YEAR, dimension: '恒星盘直径约 10 万光年', kind: 'galaxy', color: '#d6c2fa', fact: '旋臂连成星盘，太阳只是其中一颗恒星。约十万光年的尺度，不是一条清晰的外边界。', caveat: '螺旋结构与恒星光点为艺术示意；约 10 万光年指恒星盘，不包含更大的暗物质晕。', source: { name: 'NASA · 银河的尺度', url: 'https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/' } },
];
/** Intermediate references close former multi-decade holes. Selected examples are
 * explicitly examples, not standard object dimensions or observational imagery. */
const INTERMEDIATE: readonly ScaleStop[] = [
  { id: 'virus', name: '一颗病毒的尺度', chapter: '01 / 微观世界', size: 100e-9, dimension: '示例外径 100 纳米', kind: 'virus', color: '#b6b0ee', fact: 'DNA 片段还留在左边。眼前多面体的外径，是那段 DNA 长度的 10 倍。', caveat: '选取 100 纳米作病毒尺度示例；多面体、刺突和颜色为结构示意，不代表某一病毒的精确外形。', source: { name: 'NCBI · 病毒大小与结构', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7150055/' } },
  { id: 'bacterium', name: '一枚杆菌', chapter: '01 / 微观世界', size: 1e-6, dimension: '示例菌体长 1 微米', kind: 'bacterium', color: '#aedb9b', fact: '沿着同一把尺，病毒退成小点，细菌的轮廓开始完整。', caveat: '人为选取 1 微米长的杆状菌体，不表示所有细菌的标准尺寸；内部结构、颜色为示意，未画鞭毛。' },
  { id: 'pollen', name: '一粒花粉', chapter: '01 / 微观世界', size: 50e-6, dimension: '示例外径 50 微米', kind: 'pollen', color: '#eac66a', fact: '细胞并没有突然消失。它和花粉，仍在同一幅画面、同一个比例里。', caveat: '选取 50 微米的花粉示例，外缘含表面凸起；形状与颜色为示意，种类间差异很大。' },
  { id: 'seed', name: '一粒种子', chapter: '02 / 触手可及', size: .005, dimension: '示例长 5 毫米', kind: 'seed', color: '#dec690', fact: '沙粒、种子、硬币。几个熟悉的小东西，把微观世界接回日常。', caveat: '选定的 5 毫米种子，不指代特定品种；示意长轴按 5 毫米绘制。' },
  { id: 'coin', name: '一枚硬币', chapter: '02 / 触手可及', size: .024, dimension: '示例直径 24 毫米', kind: 'coin', color: '#ead59b', fact: '杯子即将从右边进入画面。它的总宽，恰好是这枚示例硬币直径的 5 倍。', caveat: '虚构的 24 毫米硬币，图案不对应真实货币；按正面直径比较。' },
  { id: 'tree', name: '一棵大树', chapter: '03 / 我们的星球', size: 20, dimension: '示例树高 20 米', kind: 'tree', color: '#a0d5a0', fact: '一个人站在旁边，树的高度才变得直观。这里的树高约为参照身高的 12 倍。', caveat: '虚构树木，树顶到地面高 20 米；枝叶形态为艺术示意。' },
  { id: 'park', name: '一片城区', chapter: '03 / 我们的星球', size: 2000, dimension: '示例边长 2 千米', kind: 'park', color: '#97cbbb', fact: '一个街区退成一小格。路网、公园与河道，开始组成一片城区。', caveat: '虚构的 2 千米正方形区域，边长是示例街区的 10 倍；内部道路不是实测地图。' },
  { id: 'region', name: '山川之间', chapter: '03 / 我们的星球', size: 300_000, dimension: '示例区域宽 300 千米', kind: 'region', color: '#a2c5a0', fact: '城市变成小斑点，山脉与海岸接过尺度。再远一点，月球也能完整出现。', caveat: '虚构的 300 千米宽地貌切片，不对应地理位置；宽度是比例参照，山高与色彩仅为示意。' },
  { id: 'moon-body', name: '月球', chapter: '03 / 我们的星球', size: 3_474_800, dimension: '平均直径约 3,474.8 千米', kind: 'moon-body', color: '#d2d2cf', fact: '这次比较的是月球本身的直径，还不是地球到月球的距离。', caveat: '按约 1,737.4 千米平均半径的两倍绘制球形；环形山与月海是程序插画，不是月面照片。', source: { name: 'NASA · 月球尺寸数据', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' } },
  { id: 'jupiter', name: '木星', chapter: '04 / 星间距离', size: 139_822_000, dimension: '平均直径约 139,822 千米', kind: 'jupiter', color: '#e4c39c', fact: '地球现在只有木星旁的一小颗。云带和大红斑让这个气态巨人有了清晰的轮廓。', caveat: '采用约 69,911 千米平均半径的两倍；简化为圆形，云带与大红斑为示意，不是实时外观。', source: { name: 'NASA · 木星事实', url: 'https://science.nasa.gov/jupiter/jupiter-facts/' } },
  { id: 'giant', name: '红巨星的尺度', chapter: '04 / 星间距离', size: 14e9, dimension: '示例直径 10 个太阳', kind: 'giant', color: '#f2ae79', fact: '把一颗示例恒星放大到太阳直径的 10 倍，太阳仍留在旁边作比较。', caveat: '选取 10 个太阳直径作红巨星尺度模型，不对应某颗实测恒星；亮晕不计入直径。' },
  { id: 'mercury-orbit', name: '水星的轨道', chapter: '04 / 星间距离', size: .774 * AU, dimension: '轨道直径约 0.774 AU', kind: 'orbit', color: '#e0caa9', fact: '实心星球退后，轨道的线条显现。这里比较的是围绕太阳的一整圈跨度。', caveat: '以约 0.387 AU 的半长轴画圆，直径取两倍；真实轨道有偏心率，中心与行星定位点放大显示。', source: { name: 'NASA · 水星轨道数据', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html' } },
  { id: 'earth-orbit', name: '地球的轨道', chapter: '04 / 星间距离', size: 2 * AU, dimension: '轨道直径约 2 AU', kind: 'orbit', color: '#a4d5ec', fact: '1 AU 约是日地平均距离。完整轨道的直径，则约为它的两倍。', caveat: '圆轨道半径取 1 AU；轨道线使用实际比例，中心与地球定位点放大显示，不能当作天体直径。', source: { name: 'IAU · 天文长度单位', url: 'https://iauarchive.eso.org/public/themes/measuring/' } },
  { id: 'betelgeuse', name: '参宿四的尺度', chapter: '04 / 星间距离', size: 700 * 1.4e9, dimension: '直径约为太阳的 700 倍', kind: 'giant', color: '#f4a17c', fact: '一颗红超巨星的直径，竟大过地球轨道的整圈跨度。把它们并列，才能感受这种差别。', caveat: '取 NASA 科普中的约 700 倍太阳直径。恒星外层没有硬边界，测量与模型有差异；表面与光晕为示意。', source: { name: 'NASA · 参宿四', url: 'https://science.nasa.gov/universe/what-is-betelgeuse-inside-the-strange-volatile-star/' } },
  { id: 'heliosphere', name: '日球层的尺度', chapter: '05 / 走向恒星之间', size: 240 * AU, dimension: '示例横跨 240 AU', kind: 'heliosphere', color: '#92cddf', fact: '行星轨道还在里面。太阳风吹出的区域，把我们的恒星与星际空间连在一起。', caveat: '以旅行者穿越处约 120 AU 的距离作半径示意，再取两倍。真实日球层不对称，240 AU 不是实测全宽；粒子为放大标记。', source: { name: 'NASA · 进入星际空间', url: 'https://www.nasa.gov/solar-system/the-voyage-to-interstellar-space/' } },
  { id: 'comet-orbit', name: '长周期彗星的轨道', chapter: '05 / 走向恒星之间', size: 2000 * AU, dimension: '示例长轴 2,000 AU', kind: 'comet-orbit', color: '#b8d9e8', fact: '彗星可以沿着狭长轨道远离太阳。这里用一条选定的椭圆，把行星区与遥远冰体连接起来。', caveat: '虚构轨道：半长轴 1,000 AU、偏心率 0.85。太阳位于一个焦点；太阳和彗星标记放大，非特定彗星的轨道。' },
  { id: 'oort-inner', name: '奥尔特云内侧尺度', chapter: '05 / 走向恒星之间', size: 10_000 * AU, dimension: '示例直径 1 万 AU', kind: 'oort', color: '#b6cce5', fact: '稀疏的冰体分布开始包围太阳。这个尺度不是一层坚硬的壳，而是一种区域估计。', caveat: 'NASA 给出的内缘估计距太阳约 2,000–5,000 AU；这里选半径 5,000 AU。点为放大的冰体标记，密度、形状与颜色为示意。', source: { name: 'NASA · 奥尔特云', url: 'https://science.nasa.gov/solar-system/oort-cloud/facts/' } },
  { id: 'oort-outer', name: '奥尔特云外侧尺度', chapter: '05 / 走向恒星之间', size: 100_000 * AU, dimension: '示例直径 10 万 AU', kind: 'oort', color: '#cad6ef', fact: '太阳已经小到无法按真实直径看清。如今可见的是围绕它的遥远区域。', caveat: '外缘半径估计范围约 1 万–10 万 AU，这里仅选半径 5 万 AU（直径 10 万 AU）作模型；理论云团并未被直接拍摄。', source: { name: 'NASA · 奥尔特云', url: 'https://science.nasa.gov/solar-system/oort-cloud/facts/' } },
  { id: 'nebula', name: '一片恒星诞生区', chapter: '06 / 银河里的风景', size: 30 * LIGHT_YEAR, dimension: '示例宽度 30 光年', kind: 'nebula', color: '#e3aacd', fact: '恒星之间的距离退成小线段。气体与尘埃铺成云，年轻恒星从其中亮起。', caveat: '选取 30 光年的虚构星云切片，不指代特定星云；彩色气体、亮星与密度均为艺术示意，不能当作望远镜照片。' },
  { id: 'cluster', name: '球状星团 M2', chapter: '06 / 银河里的风景', size: 150 * LIGHT_YEAR, dimension: '直径约 150 光年量级', kind: 'cluster', color: '#ebd8bc', fact: '一颗颗恒星，汇成一个古老而密集的星团。轮廓很大，每颗恒星却仍小得无法按直径分辨。', caveat: 'NASA 描述 M2 直径超过 150 光年，这里以 150 光年作近似参照；恒星点放大、分布为示意，不是实测星表。', source: { name: 'NASA · 球状星团 M2', url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-2/' } },
  { id: 'bubble', name: '本地泡', chapter: '06 / 银河里的风景', size: 1000 * LIGHT_YEAR, dimension: '跨度约 1,000 光年', kind: 'bubble', color: '#91d6d7', fact: '我们身处的星际邻域，有一个巨大的低密度空腔。恒星诞生的云，点缀在它的周围。', caveat: '约 1,000 光年是特征尺度，真实边界不规则；这里的薄壳与亮点为结构示意，不是可见光外观。', source: { name: 'CfA · 本地泡研究', url: 'https://www.cfa.harvard.edu/news/1000-light-year-wide-bubble-surrounding-earth-source-all-nearby-young-stars' } },
  { id: 'arm', name: '一段银河旋臂', chapter: '06 / 银河里的风景', size: 10_000 * LIGHT_YEAR, dimension: '示例切片宽 1 万光年', kind: 'arm', color: '#c8c6f2', fact: '星云、星团与星际空腔，开始汇成更宽阔的纹理。再退一步，整个银河的旋臂就出现了。', caveat: '取 1 万光年宽的虚构旋臂切片作过渡，不代表某条真实旋臂的全长；星点放大，结构与颜色为艺术示意。' },
];
/** Extragalactic lengths stay on the same SI line. Region extents are approximate,
 * and the final horizon describes the observable universe, never the whole universe. */
export const OBSERVABLE_DIAMETER = 92_000_000_000 * LIGHT_YEAR;
const EXTRAGALACTIC: readonly ScaleStop[] = [
  { id: 'andromeda', name: '仙女座星系', chapter: '07 / 银河之外', size: 220_000 * LIGHT_YEAR, dimension: '星盘直径约 22 万光年', kind: 'galaxy', color: '#b9d6f4', fact: '银河系并没有装下所有星星。旁边这个更大的恒星盘，是另一个星系。', caveat: '取 NASA 科普中的约 22 万光年星盘跨度，恒星盘没有清晰硬边界；这里画成正面结构示意，不是从地球看到的倾角，也不含气体晕。', source: { name: 'NASA · 银河与仙女座的尺度', url: 'https://science.nasa.gov/universe/exoplanets/our-milky-way-galaxy-how-big-is-space/' } },
  { id: 'andromeda-distance', name: '到仙女座的距离', chapter: '07 / 银河之外', size: 2_500_000 * LIGHT_YEAR, dimension: '距离约 250 万光年', kind: 'galaxy-distance', color: '#c9d5f3', fact: '两个星系之间，留着更宽广的空隙。横线比较的是距离，旁边的星盘仍按各自的直径缩小。', caveat: '线段长约 250 万光年，表示我们到仙女座的距离；两端星盘分别按 10 万和 22 万光年绘制，位置与朝向为示意，不是精确星图。', source: { name: 'NASA · 仙女座星系', url: 'https://www.nasa.gov/universe/galaxies/andromeda-galaxy/' } },
  { id: 'local-group', name: '本星系群', chapter: '07 / 银河之外', size: 10_000_000 * LIGHT_YEAR, dimension: '区域直径约 1,000 万光年', kind: 'galaxy-group', color: '#a7d4e3', fact: '银河、仙女座与许多较小的星系，组成我们的星系邻里。现在，一个光点代表的是星系。', caveat: '以 NASA 给出的接近 1,000 万光年直径为近似参照；虚线圈仅标示区域跨度，成员位置、亮度与数量为示意，星系定位点放大显示。', source: { name: 'NASA · 本星系群', url: 'https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html' } },
  { id: 'coma-cluster', name: '后发座星系团', chapter: '07 / 银河之外', size: 20_000_000 * LIGHT_YEAR, dimension: '跨度约 2,000 万光年量级', kind: 'galaxy-cluster', color: '#e1c9ab', fact: '星系聚成更密集的群落，星系之间还有炽热而稀薄的气体。这个团块包含数以千计的星系。', caveat: 'ESO 描述其跨度超过 2,000 万光年，这里取 2,000 万作量级参照；星系点与气体辉光是放大的结构示意，不是照片或实测成员地图。', source: { name: 'ESO · 星系团的大小与气体', url: 'https://www.eso.org/public/news/eso0320/' } },
  { id: 'local-supercluster', name: '本超星系团', chapter: '08 / 宇宙的大尺度结构', size: 100_000_000 * LIGHT_YEAR, dimension: '区域直径约 1 亿光年', kind: 'supercluster', color: '#b7bee9', fact: '许多星系群和星系团，连成更大的一片。室女座星系团位于本超星系团的中心区域。', caveat: 'NASA 给出的约 1 亿光年是区域特征尺度，不是坚硬边界；分支、节点与扁平形态为结构示意，非真实三维坐标。后发座星系团只在旁边比较大小，不表示属于此区域。', source: { name: 'NASA · 本超星系团', url: 'https://imagine.gsfc.nasa.gov/features/cosmic/local_supercluster_info.html' } },
  { id: 'laniakea', name: '拉尼亚凯亚超星系团', chapter: '08 / 宇宙的大尺度结构', size: 520_000_000 * LIGHT_YEAR, dimension: '特征跨度约 5.2 亿光年', kind: 'laniakea', color: '#e3bfa2', fact: '沿着星系的运动，可以勾勒更大的引力流域。我们所在的区域，也连进了这张更宽广的网。', caveat: '依据 Tully 等 2014 年提出的约 160 Mpc（约 5.2 亿光年）流域定义；边界依赖模型，不是单一引力束缚天体。流线与节点为艺术示意，不是实际速度场。', source: { name: 'Nature · 拉尼亚凯亚研究（2014）', url: 'https://www.nature.com/articles/nature13674' } },
  { id: 'sloan-wall', name: '斯隆长城', chapter: '08 / 宇宙的大尺度结构', size: 1_370_000_000 * LIGHT_YEAR, dimension: '长度约 13.7 亿光年', kind: 'wall', color: '#b8ceee', fact: '星系连成丝状与片状的结构，像宇宙中的一段长城。它不是一道实心的墙。', caveat: '取 Gott 等论文给出的约 13.7 亿光年长度；并非引力束缚在一起的单一天体，也不宣称它是当前最大的结构。弯曲形态、厚度与亮点为示意。', source: { name: 'Gott 等 · 宇宙地图', url: 'https://arxiv.org/abs/astro-ph/0310571' } },
  { id: 'cosmic-web', name: '宇宙网的一片区域', chapter: '08 / 宇宙的大尺度结构', size: 10_000_000_000 * LIGHT_YEAR, dimension: '示例区域宽 100 亿光年', kind: 'cosmic-web', color: '#a8c8e8', fact: '丝状结构交织，留下大片空洞。再向外看，刚才的超星系团与长城，也只是网中的细小纹理。', caveat: '人为选取 100 亿光年的示例切片作尺度过渡；不是名为“宇宙网”的单一天体直径，也不是这个范围的实测地图。网丝与节点放大显示，展示结构类型，不表示具体星系坐标。', source: { name: 'NASA · 星系网丝、片层与空洞', url: 'https://imagine.gsfc.nasa.gov/features/cosmic/sheets_voids_info.html' } },
  { id: 'observable', name: '可观测宇宙', chapter: '09 / 我们能看见的范围', size: OBSERVABLE_DIAMETER, dimension: '现今直径约 920 亿光年', kind: 'observable', color: '#c3daf0', fact: '旅程来到我们能观测的范围。因为空间一直在膨胀，现今直径远大于宇宙年龄乘以光速的两倍。', caveat: '采用 NASA 约 920 亿光年的现今直径估计。圆圈表示以观测者为中心的可观测范围，不是宇宙的实体边缘，也不是从宇宙外拍摄的照片。整座宇宙究竟多大、有限还是无限，目前没有可靠答案。', source: { name: 'NASA · 空间究竟有多大？', url: 'https://www.nasa.gov/science-research/astrophysics/how-big-is-space-we-asked-a-nasa-expert-episode-61/' } },
];
export const STOPS: readonly ScaleStop[] = [...LANDMARKS, ...INTERMEDIATE, ...EXTRAGALACTIC].sort((a, b) => a.size - b.size);
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
    if (ly >= 100_000_000) return `${number(ly / 100_000_000)} 亿光年`;
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
