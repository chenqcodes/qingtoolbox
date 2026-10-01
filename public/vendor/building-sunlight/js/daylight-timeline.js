/** Pure selected-facade summary. Does not change project/cache schemas or whole-project analysis. */
(function (root) {
    'use strict';
    function summarize(samples, step) {
        if (!Array.isArray(samples) || !Number.isFinite(step) || step <= 0) throw new TypeError('Invalid timeline');
        const intervals = [];
        let sunHours = 0;
        let isolatedHours = 0;
        for (const sample of samples) {
            if (!Number.isFinite(sample.hour)) throw new TypeError('Invalid sample time');
            if (sample.status === 'sun') sunHours += step;
            if (sample.isolatedSun) isolatedHours += step;
            const start = sample.hour - step / 2;
            const end = sample.hour + step / 2;
            const previous = intervals[intervals.length - 1];
            if (previous && previous.status === sample.status && previous.blocker === sample.blocker && Math.abs(previous.end - start) < 1e-7) {
                previous.end = end;
            } else {
                intervals.push({ start, end, status: sample.status, blocker: sample.blocker });
            }
        }
        const sunny = intervals.filter(interval => interval.status === 'sun');
        return {
            intervals,
            sunHours,
            isolatedHours,
            otherBuildingLoss: Math.max(0, isolatedHours - sunHours),
            longestSunHours: sunny.reduce((longest, interval) => Math.max(longest, interval.end - interval.start), 0),
        };
    }
    function classify(direction, outward, hit) {
        if (!direction) return 'low-sun';
        if (outward && (Number(outward.x || 0) * direction.x + Number(outward.y || 0) * direction.z) <= 1e-6) return 'back-facing';
        return hit ? 'blocked' : 'sun';
    }
    function evaluateSample(direction, outward, sortedBlockerIndices, ownBuildingIndex) {
        const blockers = sortedBlockerIndices || [];
        const status = classify(direction, outward, blockers.length > 0);
        return {
            status,
            blockerIndex: status === 'blocked' ? blockers[0] : null,
            isolatedSun: (status === 'sun' || status === 'blocked') && !blockers.includes(ownBuildingIndex),
        };
    }
    const api = { summarize, classify, evaluateSample };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.DaylightTimeline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
