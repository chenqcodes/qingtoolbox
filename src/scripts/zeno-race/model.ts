/** Constant-speed motion on a continuous real-valued time axis (metres, seconds). */
export interface RaceParameters { lead: number; rabbit: number; turtle: number }
export const DEFAULT_RACE: Readonly<RaceParameters> = Object.freeze({ lead: 10, rabbit: 10, turtle: 1 });
export const MAX_STAGES = 200;
export interface Stage {
  index: number; duration: number; time: number; gap: number; tail: number | null;
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
function productExp(value: number, exponent: number): number {
  // Use the direct form when possible; log-space avoids an overflowing intermediate ratio.
  const power = Math.exp(exponent);
  return power > 0 && Number.isFinite(power) ? value * power : Math.exp(Math.log(value) + exponent);
}
export function stageAt(p: RaceParameters, index: number): Stage {
  validateParameters(p);
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Stage index must be a non-negative safe integer.');
  const limit = meetingTime(p);
  const result = (duration: number, time: number, gap: number, tail: number | null, reachable = true): Stage => ({
    index, duration, time, gap, tail, rabbitPosition: p.rabbit * time, turtlePosition: p.rabbit * time + gap, reachable,
  });
  if (index === 0 || p.lead === 0) return result(0, 0, p.lead, limit);
  if (p.rabbit === 0) return result(0, 0, p.lead, null, false);
  const first = p.lead / p.rabbit;
  if (p.turtle === 0) return result(index === 1 ? first : 0, first, 0, 0);
  if (p.rabbit === p.turtle) return result(first, first * index, p.lead, null);
  const logQ = ratioLog(p), power = logQ * index;
  const gap = productExp(p.lead, power), duration = productExp(first, logQ * (index - 1));
  if (limit !== null) {
    // expm1 preserves the small difference 1-q^n when the speeds nearly match.
    return result(duration, limit * -Math.expm1(power), gap, productExp(limit, power));
  }
  const sumFactor = Math.expm1(power) / Math.expm1(logQ);
  return result(duration, first * sumFactor, gap, null);
}
export type StepStop = 'already-met' | 'stationary-rabbit' | 'resolution' | 'stage-cap' | null;
export function nextStage(p: RaceParameters, current: Stage): { stage: Stage; stop: StepStop } {
  if (p.lead === 0 || (p.turtle === 0 && current.index >= 1)) return { stage: current, stop: 'already-met' };
  if (p.rabbit === 0) return { stage: current, stop: 'stationary-rabbit' };
  if (current.index >= MAX_STAGES) return { stage: current, stop: 'stage-cap' };
  const next = stageAt(p, current.index + 1), limit = meetingTime(p);
  // Stop BEFORE finite precision would draw a positive-gap finite stage as the meeting itself.
  if (![next.duration, next.time, next.gap, next.rabbitPosition, next.turtlePosition].every(Number.isFinite)
    || next.time <= current.time || (p.turtle > 0 && limit !== null && (next.time >= limit || next.gap === 0 || next.tail === 0))) {
    return { stage: current, stop: 'resolution' };
  }
  return { stage: next, stop: null };
}
export function observationEnd(p: RaceParameters): number {
  const limit = meetingTime(p);
  if (limit === null || limit === 0) return 5;
  return limit * 1.35;
}
