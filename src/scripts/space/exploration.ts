import type { BodyId } from './constants';
import type { StarId } from './starCatalog';

export type QualityMode = 'auto' | 'light' | 'high';
export interface ExploreStop {
  title: string;
  body?: BodyId;
  star?: StarId;
  text: string;
}
export const EXPLORATIONS: Record<string, { title: string; source: string; stops: ExploreStop[] }> = {
  moon: {
    title: '地月邻居', source: 'https://science.nasa.gov/moon/facts/', stops: [
      { title: '从地球出发', body: 'earth', text: '先找到地球与月球。拖动旋转、双指缩放；用“拉远”观察两者。导览会暂停模拟时间，方便比较。' },
      { title: '靠近月球', body: 'moon', text: '观察月球的明暗分界。月球位置方向来自天文计算，但画面地月间距至少放大 12 倍，球体也放大了，不能从截图测量距离或月相。' },
      { title: '回看地月系统', body: 'earth', text: '回到地球，在控制台选择更快的时间，再看月球沿轨道运动。你可以随时暂停，或按“回地球”结束探索。' },
    ],
  },
  jupiter: {
    title: '木星与四大卫星', source: 'https://science.nasa.gov/jupiter/jupiter-moons/', stops: [
      { title: '木星系统', body: 'jupiter', text: '这四颗伽利略卫星按离木星由近到远排列。轨道方向来自计算，间距至少放大 28 倍，便于看清；小圆点不是实际大小。' },
      { title: '木卫一与木卫二', body: 'io', text: '木卫一是四者中最靠近木星的。点击左侧木星下的卫星按钮可以自由跳转，也可继续看木卫二。' },
      { title: '木卫二', body: 'europa', text: '把视线拉远，比较木卫二与木卫一的轨道。卫星运动使用同一个模拟时刻；导览中时间保持暂停。' },
      { title: '木卫三与木卫四', body: 'ganymede', text: '继续到木卫四，观察外侧轨道。这里是三维空间示意，不是地面望远镜当天看到的天球投影。' },
      { title: '外侧的木卫四', body: 'callisto', text: '完成木星之旅。可以通过“重置视角”重新居中当前目标，或返回地球。' },
    ],
  },
  nearby: {
    title: '走向邻近恒星', source: 'https://science.nasa.gov/asset/hubble/proxima-centauri/', stops: [
      { title: '离开太阳系', body: 'sun', text: '太阳系以 AU 为距离单位；1 AU 约 1.496 亿千米。下一站切换到光年尺度，不能把两种视图的像素长度直接比较。' },
      { title: '比邻星', star: 'proxima', text: '比邻星距太阳约 4.25 光年，是太阳最近的恒星邻居。恒星球体是夸张的标记；光年是距离，不是航行时间。' },
      { title: '南门二 A', star: 'alpha_cen_a', text: '邻近恒星的位置来自静态赤经、赤纬与距离星表，不随时间控件做自行或双星轨道演化。两颗星看起来靠近不意味着尺度与太阳系一致。' },
      { title: '天狼星', star: 'sirius', text: '天狼星距太阳约 8.6 光年。使用“回地球”直接回到太阳系；你的模拟日期会保留。' },
    ],
  },
};

export function qualitySettings(mode: QualityMode, pixelRatio: number, coarsePointer: boolean) {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  return {
    pixelRatio: mode === 'high' ? Math.min(ratio, 2) : mode === 'light' || coarsePointer ? 1 : Math.min(ratio, 1.5),
    bloom: mode === 'high' || (mode === 'auto' && !coarsePointer),
  };
}

/** Manual, finite stops preserve user control; nothing auto-advances. */
export function clampStop(index: number, count: number) {
  return Math.max(0, Math.min(Math.trunc(index) || 0, Math.max(0, count - 1)));
}
