import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  extractWeekNumber,
  formatIsoDate,
  parseIsoDate,
  resolveWeekNumber,
  semesterWeekCount,
  toUtcDate,
  weekIndexFor,
} from '../lib/dates';

test('toUtcDate normalizes ISO strings to UTC midnight', () => {
  const d = toUtcDate('2026-09-08');
  assert.equal(d.toISOString(), '2026-09-08T00:00:00.000Z');
});

test('parseIsoDate rejects garbage', () => {
  assert.equal(parseIsoDate('not-a-date'), null);
  assert.equal(parseIsoDate(''), null);
  assert.equal(parseIsoDate(null), null);
  assert.equal(parseIsoDate('2026-02-30'), null);
});

test('resolveWeekNumber: week 1 clamps to semester start when term begins mid-week', () => {
  // Tuesday Sep 8, 2026
  const start = toUtcDate('2026-09-08');
  const week1 = resolveWeekNumber(start, 1);
  assert.equal(formatIsoDate(week1!), '2026-09-08');
});

test('resolveWeekNumber: week N lands on the Monday of that week', () => {
  const start = toUtcDate('2026-09-08'); // Tuesday; week-1 Monday = Sep 7
  const week8 = resolveWeekNumber(start, 8);
  assert.equal(formatIsoDate(week8!), '2026-10-26'); // Sep 7 + 7 weeks
});

test('resolveWeekNumber rejects out-of-range weeks', () => {
  const start = toUtcDate('2026-09-08');
  assert.equal(resolveWeekNumber(start, 0), null);
  assert.equal(resolveWeekNumber(start, 31), null);
  assert.equal(resolveWeekNumber(start, 2.5), null);
});

test('extractWeekNumber finds explicit week references only', () => {
  assert.equal(extractWeekNumber('Midterm — around Week 8'), 8);
  assert.equal(extractWeekNumber('week #3'), 3);
  assert.equal(extractWeekNumber('Weeks 10'), 10);
  assert.equal(extractWeekNumber('a weekly quiz'), null);
  assert.equal(extractWeekNumber('late in the term'), null);
  assert.equal(extractWeekNumber(null), null);
});

test('semesterWeekCount counts inclusive weeks', () => {
  assert.equal(semesterWeekCount(toUtcDate('2026-09-07'), toUtcDate('2026-12-18')), 15);
  assert.equal(semesterWeekCount(toUtcDate('2026-09-07'), toUtcDate('2026-09-07')), 1);
});

test('weekIndexFor maps dates to semester weeks', () => {
  const start = toUtcDate('2026-09-08'); // Tuesday, week-1 Monday = Sep 7
  assert.equal(weekIndexFor(start, toUtcDate('2026-09-08')), 1);
  assert.equal(weekIndexFor(start, toUtcDate('2026-09-13')), 1); // Sunday same week
  assert.equal(weekIndexFor(start, toUtcDate('2026-09-14')), 2); // next Monday
  assert.equal(weekIndexFor(start, toUtcDate('2026-09-01')), null); // before term
});
