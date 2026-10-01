/** Civil dates belong to the selected IANA zone, never implicitly to the browser. */
export const DEFAULT_TIME_ZONE = 'Asia/Shanghai';
export function validTimeZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; }
}
export function civilTime(when: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(when);
  const get = (kind: string) => parts.find(p => p.type === kind)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}
/** Reject nonexistent DST wall times; repeated fall-back times choose the earlier instant. */
export function fromCivil(value: string, zone: string): Date | null {
  if (!validTimeZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null;
  const target = value.length === 16 ? `${value}:00` : value;
  const wallMs = Date.parse(`${target}Z`);
  if (!Number.isFinite(wallMs)) return null;
  const candidates: number[] = [];
  // Offsets on both sides of a DST transition, including half-hour changes.
  for (const offsetHours of [-36, 0, 36]) {
    const probe = new Date(wallMs + offsetHours * 3600000);
    const offset = Date.parse(`${civilTime(probe, zone)}Z`) - probe.getTime();
    const candidate = wallMs - offset;
    if (civilTime(new Date(candidate), zone) === target) candidates.push(candidate);
  }
  return candidates.length ? new Date(Math.min(...candidates)) : null;
}
export function dayBounds(when: Date, zone = DEFAULT_TIME_ZONE) {
  const date = civilTime(when, zone).slice(0, 10);
  const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  const start = fromCivil(`${date}T00:00`, zone);
  const end = fromCivil(`${next.toISOString().slice(0, 10)}T00:00`, zone);
  if (!start || !end) throw new Error('该日期的午夜因时区变更不存在，请选择其他日期');
  return { start, end };
}
export function formatAt(when: Date, zone: string, clockOnly = false): string {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: zone, ...(clockOnly ? {} : { month: 'numeric', day: 'numeric' }), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(when);
}
