'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Utils = require('../js/utils');
const { getAllCities } = require('../js/cities');

function makeBuilding(overrides = {}) {
    return {
        name: 'Test Building',
        floors: 2,
        floorHeight: 3,
        units: 2,
        shape: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 8 },
            { x: 0, y: 8 }
        ],
        ...overrides
    };
}

function makeProject(overrides = {}) {
    return {
        latitude: 36.65,
        longitude: 117.12,
        timeZone: 'Asia/Shanghai',
        scaleRatio: 1,
        buildings: [makeBuilding()],
        ...overrides
    };
}

test('formats fractional hours by rounded total minutes', () => {
    assert.equal(Utils.formatTime(10.1), '10:06');
    assert.equal(Utils.formatTime(10.05), '10:03');
});

test('creates exactly 120 midpoint samples for the 06:00-18:00 range', () => {
    const samples = Utils.createTimeSamples(6, 18, 0.1);
    assert.equal(samples.length, 120);
    assert.equal(samples[0], 6.05);
    assert.equal(samples.at(-1), 17.95);
    assert.equal(samples.length * 0.1, 12);
});

test('creates stable fingerprints independent of object key order', () => {
    const first = {
        buildings: [{ shape: [{ x: 1, y: 2 }], floors: 2 }],
        location: { longitude: 117.12, latitude: 36.65 }
    };
    const reordered = {
        location: { latitude: 36.65, longitude: 117.12 },
        buildings: [{ floors: 2, shape: [{ y: 2, x: 1 }] }]
    };
    const changed = {
        ...reordered,
        buildings: [{ floors: 3, shape: [{ y: 2, x: 1 }] }]
    };

    assert.equal(Utils.stableSerialize(first), Utils.stableSerialize(reordered));
    assert.equal(Utils.createFingerprint(first), Utils.createFingerprint(reordered));
    assert.notEqual(Utils.createFingerprint(first), Utils.createFingerprint(changed));
    assert.throws(() => Utils.createFingerprint({ value: Infinity }), /non-finite/);
});

test('occlusion budget scales with both mesh count and triangle complexity', () => {
    assert.equal(Utils.estimateOcclusionWork(1000, [12, 24], 12), 3000);
    assert.equal(Utils.estimateOcclusionWork(100000, new Array(500).fill(12), 12), 50000000);
    assert.ok(Utils.estimateOcclusionWork(100001, new Array(500).fill(12), 12) > 50000000);
    assert.equal(Utils.estimateOcclusionWork(1000, [Infinity], 12), Infinity);
});

test('parses calendar dates without local-time-zone rollover', () => {
    assert.deepEqual(Utils.parseDateParts('2026-01-01'), { year: 2026, month: 1, day: 1 });
    assert.equal(Utils.getDayOfYear('2026-01-01'), 1);
    assert.equal(Utils.getDayOfYear('2026-12-31'), 365);
    assert.equal(Utils.parseDateParts('2026-02-30'), null);
});

test('uses IANA offsets and longitude to convert civil time to solar time', () => {
    assert.equal(Utils.getTimeZoneOffsetMinutes('2026-01-01', 'America/New_York'), -300);
    assert.equal(Utils.getTimeZoneOffsetMinutes('2026-07-01', 'America/New_York'), -240);
    const urumqiOffset = Utils.calculateSolarTimeOffset('2026-01-01', 87.62, 'Asia/Shanghai');
    assert.ok(urumqiOffset < -2 && urumqiOffset > -2.4);
});

test('maps solstice and equinox names to the selected hemisphere', () => {
    assert.equal(Utils.getSeasonTranslationKey('december-solstice', 36), 'winterSolstice');
    assert.equal(Utils.getSeasonTranslationKey('december-solstice', -34), 'summerSolstice');
    assert.equal(Utils.getSeasonTranslationKey('june-solstice', -34), 'winterSolstice');
    assert.equal(Utils.getSeasonTranslationKey('march-equinox', -34), 'autumnEquinox');
});

test('north alignment rotates shapes, centers, and the apartment split axis together', () => {
    const source = makeProject({
        northAngle: 90,
        buildings: [makeBuilding({
            center: { x: 2, y: 1 },
            unitSplitAngleDeg: 30
        })]
    });
    const transformed = Utils.transformProjectData(source, 90);
    assert.ok(Math.abs(transformed.buildings[0].shape[1].x) < 1e-9);
    assert.equal(transformed.buildings[0].shape[1].y, -10);
    assert.deepEqual(transformed.buildings[0].center, { x: 1.0000000000000002, y: -2 });
    assert.equal(transformed.buildings[0].unitSplitAngleDeg, -60);
    assert.equal(source.buildings[0].unitSplitAngleDeg, 30);
});

test('all city presets include valid coordinates and IANA time zones', () => {
    const cities = getAllCities();
    assert.ok(cities.length >= 50);
    cities.forEach(city => {
        assert.ok(Number.isFinite(city.lat) && city.lat >= -90 && city.lat <= 90, city.name);
        assert.ok(Number.isFinite(city.lon) && city.lon >= -180 && city.lon <= 180, city.name);
        assert.equal(Utils.isValidTimeZone(city.timeZone), true, city.name);
    });
});

test('normalizes legacy defaults and makes isThisCommunity consistent', () => {
    const project = makeProject();
    delete project.latitude;
    delete project.longitude;
    delete project.timeZone;
    const result = Utils.normalizeBuildingData(project, {
        defaults: { latitude: -33.87, longitude: 151.21, timeZone: 'Australia/Sydney' }
    });
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.data.latitude, -33.87);
    assert.equal(result.data.longitude, 151.21);
    assert.equal(result.data.timeZone, 'Australia/Sydney');
    assert.equal(result.data.buildings[0].isThisCommunity, true);
    assert.equal(result.warnings.length, 3);
});

test('validates per-floor apartment counts and derives one authoritative building height', () => {
    const variableUnits = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({
            floors: 2,
            units: 2,
            unitsPerFloor: [1, 2],
            unitRatiosPerFloor: [[1], [1, 1]],
            totalHeight: 6
        })]
    }));
    assert.equal(variableUnits.valid, true, variableUnits.errors.join('\n'));
    assert.deepEqual(variableUnits.data.buildings[0].unitsPerFloor, [1, 2]);
    assert.equal(variableUnits.data.buildings[0].totalHeight, 6);

    const repeatedLastCount = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({
            floors: 3,
            units: 2,
            unitsPerFloor: [1],
            unitRatiosPerFloor: [[1]],
            totalHeight: 9
        })]
    }));
    assert.equal(repeatedLastCount.valid, true, repeatedLastCount.errors.join('\n'));
    assert.deepEqual(repeatedLastCount.data.buildings[0].unitsPerFloor, [1, 1, 1]);

    const sharedRatios = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({
            floors: 2,
            units: 2,
            unitsPerFloor: [1, 2],
            unitRatiosPerFloor: [[1]]
        })]
    }));
    assert.equal(sharedRatios.valid, false);
    assert.match(sharedRatios.errors.join('\n'), /不能共用一行/);

    const mismatchedHeight = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({ floors: 2, floorHeight: 3, totalHeight: 1 })]
    }));
    assert.equal(mismatchedHeight.valid, false);
    assert.match(mismatchedHeight.errors.join('\n'), /总高须等于/);
});

test('rejects non-finite values, out-of-range values, and self-intersecting polygons', () => {
    const nonFinite = Utils.normalizeBuildingData(makeProject({ latitude: Infinity }));
    assert.equal(nonFinite.valid, false);
    assert.match(nonFinite.errors.join('\n'), /必须是有效数字/);

    const tooTall = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({ floors: 301 })]
    }));
    assert.equal(tooTall.valid, false);
    assert.match(tooTall.errors.join('\n'), /须在/);

    const crossing = Utils.normalizeBuildingData(makeProject({
        buildings: [makeBuilding({
            shape: [
                { x: 0, y: 0 },
                { x: 4, y: 4 },
                { x: 0, y: 4 },
                { x: 4, y: 0 }
            ]
        })]
    }));
    assert.equal(crossing.valid, false);
    assert.match(crossing.errors.join('\n'), /不能自相交/);
});

test('accepts the repository sample JSON through the production schema', () => {
    const samplePath = path.join(__dirname, '..', 'examples', 'sample.json');
    const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    const result = Utils.normalizeBuildingData(sample);
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.ok(result.data.buildings.length > 0);
});
