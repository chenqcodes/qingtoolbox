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
  return { segment, completed, possible, logDuration: duration, logElapsed,
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
