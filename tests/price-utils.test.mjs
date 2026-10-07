import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPrice,
  classifyPriceLevel,
  createPriceTicks,
  findCurrentPoint,
  getVisiblePoints,
  groupSelectedPeriods,
  isCheapestHoursEnabled,
  normalizePoints,
  selectCheapestDuration,
  splitByLocalDay,
} from '../src/price-utils.js';

const zone = 'Europe/Amsterdam';

function quarterDay(day, basePrice = 0.40) {
  const points = [];
  for (let i = 0; i < 96; i += 1) {
    const hh = String(Math.floor(i / 4)).padStart(2, '0');
    const mm = String((i % 4) * 15).padStart(2, '0');
    points.push({ start_time: `${day}T${hh}:${mm}:00+02:00`, price_per_kwh: basePrice + i / 10000 });
  }
  return points;
}

test('€0.25 belongs to expensive class while lower values are cheap', () => {
  assert.equal(classifyPrice(0.2499, 0.25), 'cheap');
  assert.equal(classifyPrice(0.25, 0.25), 'expensive');
});

test('price levels include a fixed negative blue-green band', () => {
  assert.equal(classifyPriceLevel(-0.01, 0.15, 0.25, 0.40), 'negative');
  assert.equal(classifyPriceLevel(0.12, 0.15, 0.25, 0.40), 'cheap');
  assert.equal(classifyPriceLevel(0.24, 0.15, 0.25, 0.40), 'normal');
  assert.equal(classifyPriceLevel(0.41, 0.15, 0.25, 0.40), 'expensive');
});

test('five y-axis price ticks include both scale endpoints', () => {
  assert.deepEqual(createPriceTicks(0.10, 0.50, 5), [0.50, 0.40, 0.30, 0.20, 0.10]);
});

test('cheapest hours is disabled unless configured with a positive value', () => {
  assert.equal(isCheapestHoursEnabled(undefined), false);
  assert.equal(isCheapestHoursEnabled(null), false);
  assert.equal(isCheapestHoursEnabled(0), false);
  assert.equal(isCheapestHoursEnabled(false), false);
  assert.equal(isCheapestHoursEnabled(4), true);
  assert.equal(isCheapestHoursEnabled('4'), true);
});

test('selected quarter-hours are grouped into contiguous table periods', () => {
  const points = normalizePoints(quarterDay('2026-10-07'), zone);
  const selected = new Set([0, 1, 4, 5, 6].map((index) => points[index].timestamp));
  const periods = groupSelectedPeriods(points, selected, 15);
  assert.equal(periods.length, 2);
  assert.deepEqual(periods.map((period) => period.durationMinutes), [30, 45]);
  assert.equal(periods[0].startTimestamp, points[0].timestamp);
  assert.equal(periods[0].endTimestamp, points[1].timestamp + 15 * 60000);
  assert.equal(periods[1].startTimestamp, points[4].timestamp);
  assert.equal(periods[1].endTimestamp, points[6].timestamp + 15 * 60000);
});

test('tomorrow is hidden before 14:00 and appears at 14:00 local time', () => {
  const data = [...quarterDay('2026-10-06'), ...quarterDay('2026-10-07')];
  const before = getVisiblePoints(data, new Date('2026-10-06T11:59:00Z'), zone, 14);
  const at = getVisiblePoints(data, new Date('2026-10-06T12:00:00Z'), zone, 14);
  assert.equal(new Set(before.map((point) => point.dayKey)).size, 1);
  assert.equal(new Set(at.map((point) => point.dayKey)).size, 2);
});

test('current price comes from the active price interval, not the sensor state', () => {
  const points = normalizePoints(quarterDay('2026-10-06', 0.30), zone);
  const current = findCurrentPoint(points, new Date('2026-10-06T12:07:00Z'));
  assert.equal(current.startTime, '2026-10-06T14:00:00+02:00');
  assert.equal(current.price, points[56].price);
});

test('selects non-consecutive cheapest quarter-hours totalling four hours', () => {
  const points = normalizePoints(quarterDay('2026-10-06', 0.50).map((point, index) => ({
    ...point,
    price_per_kwh: index % 6 === 0 ? index / 10000 : 0.50 + index / 10000,
  })), zone);
  const selected = selectCheapestDuration(points, 240);
  assert.equal(selected.size, 16);
  for (let i = 0; i < 96; i += 6) assert.ok(selected.has(points[i].timestamp));
});

test('cheapest duration is calculated independently per day', () => {
  const visible = getVisiblePoints(
    [...quarterDay('2026-10-06'), ...quarterDay('2026-10-07')],
    new Date('2026-10-06T13:00:00Z'),
    zone,
    14,
  );
  const groups = splitByLocalDay(visible);
  assert.equal(groups.size, 2);
  for (const points of groups.values()) {
    assert.equal(selectCheapestDuration(points, 240).size, 16);
  }
});
