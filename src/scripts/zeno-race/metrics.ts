import { pursuitFrame, pursuitTime, stageAt, type RaceParameters } from './model';

/** The physical clock within one old-position-to-old-position segment.
 * Compute small amounts independently in log space, never by subtracting two
 * almost equal accumulated clocks. A completed snapshot belongs to its last
 * segment; an active chase belongs to the next one. */
export function pursuitMetrics(p: RaceParameters, index: number, progress: number, active: boolean) {
  const completed = !active && index > 0;
  const origin = completed ? index - 1 : index;
  const fraction = completed ? 1 : Math.min(1, Math.max(0, progress));
  const possible = p.lead > 0 && p.rabbit > 0 && !(p.turtle === 0 && origin > 0);
  const segment = origin + 1;
  const duration = possible ? stageAt(p, segment).logDuration : -Infinity;
  const modelFraction = possible ? pursuitFrame(p, origin, fraction).modelFraction : 0;
  // The completed stationary-turtle segment has fraction 1, even though its
  // endpoint frame naturally represents the already-met state.
  const elapsedFraction = completed && possible ? 1 : modelFraction;
  const logElapsed = elapsedFraction === 0 ? -Infinity : duration + Math.log(elapsedFraction);
  const totalTime = active ? pursuitTime(p, index, progress) : stageAt(p, index).time;
  const logTotalDistance = p.rabbit > 0 && totalTime > 0 ? Math.log(p.rabbit) + Math.log(totalTime) : -Infinity;
  const baselineTime = stageAt(p, origin).time;
  const logBaselineTime = Math.log(baselineTime);
  const logBaselineDistance = p.rabbit > 0 ? Math.log(p.rabbit) + logBaselineTime : -Infinity;
  const logIncrementDistance = p.rabbit > 0 ? Math.log(p.rabbit) + logElapsed : -Infinity;
  return { segment, completed, possible, logDuration: duration, logElapsed,
    baselineTime, logBaselineTime, logBaselineDistance, logIncrementDistance,
    fraction: elapsedFraction, totalTime, logTotalDistance };
}

/** Compact SI time units retain three significant figures at every scale.
 * Scientific notation is built directly from logs, including below underflow. */
export function formatMetricTime(logSeconds: number): string {
  if (logSeconds === -Infinity) return '0 s';
  if (!Number.isFinite(logSeconds)) return '超出显示范围';
  let exponent = Math.floor(logSeconds / Math.LN10);
  let mantissa = Number(Math.exp(logSeconds - exponent * Math.LN10).toPrecision(3));
  if (mantissa >= 10) { mantissa = 1; exponent++; }
  const unit = exponent >= 0 && exponent < 4 ? { exponent: 0, label: 's' }
    : exponent >= -3 && exponent < 0 ? { exponent: -3, label: 'ms' }
      : exponent >= -6 && exponent < -3 ? { exponent: -6, label: 'μs' }
        : exponent >= -9 && exponent < -6 ? { exponent: -9, label: 'ns' }
          : exponent >= -12 && exponent < -9 ? { exponent: -12, label: 'ps' } : null;
  if (!unit) return `${mantissa}e${exponent} s`;
  return `${Number((mantissa * 10 ** (exponent - unit.exponent)).toPrecision(3))} ${unit.label}`;
}

export interface StopwatchReading {
  /** The same six character positions for every value: 000.00. */
  digits: string;
  unit: string;
  /** A separately reserved line, never inserted into the mantissa. */
  exponent: number | null;
  value: string;
}

/** Fixed hundredths within a compact SI unit. Log-space scientific notation
 * retains positive readings below floating-point underflow; only -Infinity is 0.
 * Three integer slots, two decimals and reserved suffixes never change geometry. */
export function stopwatchReading(logValue: number, kind: 'distance' | 'time'): StopwatchReading {
  const base = kind === 'distance' ? 'm' : 's';
  if (logValue === -Infinity) return { digits: '000.00', unit: base, exponent: null, value: `0.00 ${base}` };
  if (!Number.isFinite(logValue)) return { digits: '---.--', unit: base, exponent: null, value: '超出显示范围' };
  // Tolerate logarithm roundoff exactly at powers of ten, without erasing
  // genuinely sub-boundary values. Carry rounded 999.995 into the next scale.
  let power = Math.floor(logValue / Math.LN10 + 1e-12);
  const units = kind === 'distance'
    ? [[3, 'km'], [0, 'm'], [-2, 'cm'], [-3, 'mm'], [-6, 'μm'], [-9, 'nm'], [-12, 'pm']] as const
    : [[0, 's'], [-3, 'ms'], [-6, 'μs'], [-9, 'ns'], [-12, 'ps']] as const;
  let unitIndex = units.findIndex(([exponent]) => power >= exponent);
  let unit: (typeof units)[number] | undefined = units[unitIndex];
  let exponent: number | null = null;
  let amount = Math.exp(logValue - (unit?.[0] ?? power) * Math.LN10);
  if (unit && unitIndex > 0) {
    const next = units[unitIndex - 1];
    // Carry the rounded hundredths straight into the adjacent SI unit. Never
    // flash 1.00e0 s between 999.99 ms and 1.00 s.
    if (amount >= 10 ** (next[0] - unit[0]) - .005) {
      unit = next; amount = Math.exp(logValue - unit[0] * Math.LN10);
    }
  }
  if (!unit || amount >= 999.995) {
    amount = Math.exp(logValue - power * Math.LN10);
    if (amount >= 9.995) { amount = 1; power++; }
    // The rounded mantissa can also enter the smallest supported SI unit.
    unitIndex = units.findIndex(([unitPower]) => power >= unitPower);
    unit = units[unitIndex];
    if (unit && power - unit[0] < 3) amount *= 10 ** (power - unit[0]);
    else { unit = undefined; exponent = power; }
  }
  const fixed = amount.toFixed(2), label = unit?.[1] ?? base;
  return { digits: fixed.padStart(6, '0'), unit: label, exponent,
    value: `${fixed}${exponent === null ? '' : `e${exponent}`} ${label}` };
}
