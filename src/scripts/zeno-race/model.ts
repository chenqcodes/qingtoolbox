/** Constant-speed motion on a continuous real-valued time axis (metres, seconds). */
export interface RaceParameters { lead: number; rabbit: number; turtle: number }
export const DEFAULT_RACE: Readonly<RaceParameters> = Object.freeze({ lead: 10, rabbit: 10, turtle: 1 });
export const MAX_STAGES = 200;
export interface Stage {
  index: number; duration: number; time: number; gap: number; tail: number | null;
  /** Natural logarithms preserve positive finite-stage values after numeric underflow.
   * -Infinity means a genuine zero; a null tail means that no meeting exists. */
  logGap: number; logTail: number | null; logDuration: number;
  rabbitPosition: number; turtlePosition: number; reachable: boolean;
}
export function validateParameters(p: RaceParameters): void {
  if (![p.lead, p.rabbit, p.turtle].every(v => Number.isFinite(v) && v >= 0)) {
    throw new RangeError('Distances and speeds must be finite and non-negative.');
  }
}
export function meetingTime(p: RaceParameters): number | null {
  validateParameters(p);
  if (p.lead === 0) return 0;
  return p.rabbit > p.turtle ? p.lead / (p.rabbit - p.turtle) : null;
}
export function positionsAt(p: RaceParameters, time: number) {
  validateParameters(p);
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Time must be finite and non-negative.');
  const rabbit = p.rabbit * time;
  // A directly selected computed meeting event is exact in this model. Do not
  // mistake cancellation noise for an overtake or use an epsilon for nearby times.
  if (p.rabbit > p.turtle && time === meetingTime(p)) return { rabbit, turtle: rabbit, gap: 0 };
  return { rabbit, turtle: p.lead + p.turtle * time, gap: p.lead + (p.turtle - p.rabbit) * time };
}
function ratioLog(p: RaceParameters): number {
  const relative = (p.turtle - p.rabbit) / p.rabbit;
  return Math.abs(relative) < 0.5 ? Math.log1p(relative) : Math.log(p.turtle) - Math.log(p.rabbit);
}
function productExp(value: number, exponent: number, logValue = Math.log(value)): number {
  // Keep ordinary arithmetic when it is safe, then combine logs before exponentiating.
  // In particular, a ratio may underflow even while the scaled result is representable.
  const power = Math.exp(exponent);
  const product = value * power;
  return power >= Number.MIN_VALUE / Number.EPSILON && Number.isFinite(power) && product > 0 && Number.isFinite(product)
    ? product : Math.exp(logValue + exponent);
}
function logExpm1(value: number): number {
  return value > 50 ? value + Math.log1p(-Math.exp(-value)) : Math.log(Math.expm1(value));
}
export function stageAt(p: RaceParameters, index: number): Stage {
  validateParameters(p);
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Stage index must be a non-negative safe integer.');
  const limit = meetingTime(p);
  const logLead = Math.log(p.lead);
  const logLimit = limit === null ? null : p.lead === 0 ? -Infinity : logLead - Math.log(p.rabbit - p.turtle);
  const result = (duration: number, time: number, gap: number, tail: number | null, reachable = true,
    logGap = Math.log(gap), logTail = tail === null ? null : Math.log(tail), logDuration = Math.log(duration)): Stage => ({
    index, duration, time, gap, tail, logGap, logTail, logDuration,
    rabbitPosition: p.rabbit * time, turtlePosition: p.rabbit * time + gap, reachable,
  });
  if (index === 0 || p.lead === 0) return result(0, 0, p.lead, limit, true, logLead, logLimit);
  if (p.rabbit === 0) return result(0, 0, p.lead, null, false);
  const first = p.lead / p.rabbit, logFirst = logLead - Math.log(p.rabbit);
  if (p.turtle === 0) return result(index === 1 ? first : 0, first, 0, 0, true, -Infinity, -Infinity, index === 1 ? logFirst : -Infinity);
  if (p.rabbit === p.turtle) return result(first, first * index, p.lead, null, true, logLead, null, logFirst);
  const logQ = ratioLog(p), power = logQ * index;
  const logGap = logLead + power, logDuration = logFirst + logQ * (index - 1);
  const gap = productExp(p.lead, power), duration = productExp(first, logQ * (index - 1), logFirst);
  if (limit !== null) {
    // expm1 preserves the small difference 1-q^n when the speeds nearly match.
    // The numeric sum eventually rounds to the limit, but the independently stored
    // log tail remains finite. That rounded sum must never classify this as meeting.
    const fraction = -Math.expm1(power);
    const time = Number.isFinite(limit) ? limit * fraction : Math.exp(logLimit! + Math.log(fraction));
    return result(duration, time, gap, productExp(limit, power, logLimit!), true, logGap, logLimit! + power, logDuration);
  }
  const sumFactor = Math.expm1(power) / Math.expm1(logQ);
  const directTime = first * sumFactor;
  const time = directTime > 0 && Number.isFinite(directTime)
    ? directTime : Math.exp(logFirst + logExpm1(power) - logExpm1(logQ));
  return result(duration, time, gap, null, true, logGap, null, logDuration);
}
export type StepStop = 'already-met' | 'stationary-rabbit' | 'resolution' | 'stage-cap' | null;
export function nextStage(p: RaceParameters, current: Stage): { stage: Stage; stop: StepStop } {
  if (p.lead === 0 || (p.turtle === 0 && current.index >= 1)) return { stage: current, stop: 'already-met' };
  if (p.rabbit === 0) return { stage: current, stop: 'stationary-rabbit' };
  if (current.index >= MAX_STAGES) return { stage: current, stop: 'stage-cap' };
  const next = stageAt(p, current.index + 1), limit = meetingTime(p);
  // A log-space stage remains distinguishable after its ordinary time or positions
  // round to the meeting event and even after its numeric gap underflows to zero.
  // Only an actual zero-gap branch, unavailable logarithm, or overflow stops it.
  if (![next.duration, next.time, next.gap, next.rabbitPosition, next.turtlePosition].every(Number.isFinite)
    || !next.reachable || (p.turtle > 0 && (!Number.isFinite(next.logGap) || !Number.isFinite(next.logDuration)
      || (limit !== null && !Number.isFinite(next.logTail))))) {
    return { stage: current, stop: 'resolution' };
  }
  return { stage: next, stop: null };
}
export function observationEnd(p: RaceParameters): number {
  const limit = meetingTime(p);
  if (limit === null || limit === 0) return 5;
  return limit * 1.35;
}

/** Three significant figures, without ever exponentiating an underflowing distance. */
export function formatLogDistance(logMetres: number): string {
  if (logMetres === -Infinity) return '0 m';
  if (!Number.isFinite(logMetres)) return '超出显示范围';
  let exponent = Math.floor(logMetres / Math.LN10);
  let mantissa = Number(Math.exp(logMetres - exponent * Math.LN10).toPrecision(3));
  // Rounding can cross a unit boundary (including tiny log error at exact powers).
  if (mantissa >= 10) { mantissa = 1; exponent++; }
  const unit = exponent >= 0 && exponent < 6 ? { exponent: 0, label: 'm' }
    : exponent >= -2 && exponent < 0 ? { exponent: -2, label: 'cm' }
      : exponent === -3 ? { exponent: -3, label: 'mm' }
        : exponent >= -6 && exponent < -3 ? { exponent: -6, label: 'μm' }
          : exponent >= -9 && exponent < -6 ? { exponent: -9, label: 'nm' }
            : exponent >= -12 && exponent < -9 ? { exponent: -12, label: 'pm' } : null;
  if (!unit) return `${mantissa}e${exponent} m`;
  return `${Number((mantissa * 10 ** (exponent - unit.exponent)).toPrecision(3))} ${unit.label}`;
}

export interface GapCamera {
  /** SVG viewBox units, relative to an initial gap of 560. */
  screenGap: number;
  /** Natural logarithm of the magnification relative to the initial view. */
  logZoom: number;
  glyphScale: number;
  /** Number of decimal orders by which the actual distance has shrunk. */
  decades: number;
}

/** A continuous, non-resetting magnifier: actual gaps and displayed gaps both shrink.
 * The rational compression leaves a readable positive separation at every finite
 * positive gap, even hundreds of decades beyond floating-point underflow. */
export function cameraForGap(logGap: number, initialLogGap: number): GapCamera {
  if (logGap === -Infinity) return { screenGap: 0, logZoom: 0, glyphScale: 1, decades: 0 };
  if (!Number.isFinite(logGap) || !Number.isFinite(initialLogGap)) {
    throw new RangeError('Camera distances must have finite natural logarithms.');
  }
  const shrinkLog = Math.min(Number.MAX_VALUE, Math.max(0, initialLogGap - logGap));
  const decades = shrinkLog / Math.LN10;
  const screenGap = 8 + 552 / (1 + decades / 2);
  return {
    screenGap,
    logZoom: Math.max(0, shrinkLog + Math.log(screenGap / 560)),
    glyphScale: .11 + .89 / (1 + decades / 4),
    decades,
  };
}
