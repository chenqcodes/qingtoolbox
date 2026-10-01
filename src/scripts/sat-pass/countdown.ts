import type { Pass } from './propagate';
export function countdownText(pass: Pass | undefined, now: Date, visibleOnly: boolean): string {
  if (!pass) return '暂无待观测窗口';
  const window = visibleOnly ? pass.visible.find(v => v.end > now) : { start: pass.start, end: pass.end };
  if (!window) return '本次已结束，正在等待重算';
  if (now >= window.end) return '本次已结束，正在等待重算';
  const ongoing = now >= window.start;
  const seconds = Math.max(0, Math.ceil(((ongoing ? +window.end : +window.start) - +now) / 1000));
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60), secs = seconds % 60;
  const remaining = `${days ? `${days}天 ` : ''}${hours ? `${hours}小时 ` : ''}${minutes}分 ${String(secs).padStart(2, '0')}秒`;
  return ongoing ? `窗口进行中，还剩 ${remaining}` : `距离开始 ${remaining}`;
}
