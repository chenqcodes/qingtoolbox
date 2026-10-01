import test from 'node:test';
import assert from 'node:assert/strict';
import { Body } from 'astronomy-engine';
import { moonPhaseInfo, moonTerminator } from './moon-render';
import { dayBounds, civilTime, fromCivil } from './time';
import { riseSet, observingStatus, planetTable } from './ephemeris';
test('fixed new, full and quarter dates use lunar cycle, not illuminated fraction', () => {
  const cases = [['2024-04-08T18:21:00Z', '新月', 0], ['2024-03-25T07:00:00Z', '满月', 1], ['2024-04-15T19:13:00Z', '上弦月', 0.5], ['2024-04-02T03:15:00Z', '下弦月', 0.5]] as const;
  for (const [date, name, fraction] of cases) { const p = moonPhaseInfo(new Date(date)); assert.equal(p.name, name); assert.ok(Math.abs(p.fraction - fraction) < 0.01); }
});
test('shadow geometry gives full bright/full dark, and opposite quarter sides', () => {
  assert.equal(moonTerminator(0, 0, 0).edge, 1);
  assert.equal(moonTerminator(1, 179.99, 0).edge, -1);
  assert.equal(moonTerminator(0.5, 90, 0).waxing, true);
  assert.equal(moonTerminator(0.5, 270, 0).waxing, false);
  // Numerically integrate the lit area for several phases.
  for (const fraction of [0, 0.1, 0.5, 0.9, 1]) for (const cycle of [70, 290]) {
    let area = 0; for (let i = 0; i < 10000; i++) { const m = moonTerminator(fraction, cycle, -1 + (i + 0.5) / 5000); area += (m.waxing ? m.halfWidth - m.edge : m.edge + m.halfWidth) / 5000; }
    assert.ok(Math.abs(area / Math.PI - fraction) < 0.00001);
  }
});
test('observer zone selects date independently of process timezone and handles DST', () => {
  const instant = new Date('2024-06-21T18:00:00Z');
  assert.equal(civilTime(instant, 'Asia/Shanghai').slice(0, 10), '2024-06-22');
  assert.equal(civilTime(instant, 'America/New_York').slice(0, 10), '2024-06-21');
  for (const [date, hours] of [['2024-03-10T12:00:00Z', 23], ['2024-11-03T12:00:00Z', 25]] as const) { const b = dayBounds(new Date(date), 'America/New_York'); assert.equal((+b.end - +b.start) / 3600000, hours); }
  assert.equal(fromCivil('2024-03-10T02:30', 'America/New_York'), null);
  assert.equal(fromCivil('2024-11-03T01:30', 'America/New_York')?.toISOString(), '2024-11-03T05:30:00.000Z');
  assert.equal(fromCivil('2024-02-30T12:00', 'UTC'), null);
  const rs = riseSet(Body.Sun, instant, 39.9, 116.4, 'Asia/Shanghai');
  assert.equal(civilTime(rs.rise!, 'Asia/Shanghai').slice(0, 10), '2024-06-22');
});
test('no-rise days and daylight status are honest; brightness is a separate quantity', () => {
  assert.equal(riseSet(Body.Sun, new Date('2024-06-21T12:00Z'), 89, 0, 'UTC').set, null);
  assert.match(observingStatus(30, 20), /白昼/); assert.match(observingStatus(-5, -20), /地平线下/);
  assert.ok(planetTable(new Date('2024-06-21T12:00Z'), 39.9, 116.4).every(p => Number.isFinite(p.magnitude)));
});
