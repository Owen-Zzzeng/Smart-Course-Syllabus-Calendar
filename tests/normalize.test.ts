import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatIsoDate, toUtcDate } from '../lib/dates';
import type { ExtractionResult } from '../lib/extraction-schema';
import { normalizeExtraction } from '../lib/normalize';

const semesterStart = toUtcDate('2026-09-08');
const semesterEnd = toUtcDate('2026-12-18');

function baseResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    courseName: 'Intro to Databases',
    courseCode: 'CS 348',
    instructor: 'Dr. Ada Lovelace',
    gradingComponents: [
      { name: 'Assignments', weight: 40 },
      { name: 'Midterm', weight: 25 },
      { name: 'Final', weight: 35 },
    ],
    events: [],
    ...overrides,
  };
}

test('high-confidence dated events bypass review', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Midterm Exam',
          type: 'EXAM',
          rawDateText: 'October 20, 2026',
          resolvedDate: '2026-10-20',
          weekNumber: null,
          confidence: 'HIGH',
          description: null,
          gradeWeight: 25,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]!.needsReview, false);
  assert.equal(result.stats.highConfidence, 1);
});

test('week references are resolved against the semester start and flagged MEDIUM', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Project Milestone 1',
          type: 'PROJECT',
          rawDateText: 'Week 8',
          resolvedDate: null,
          weekNumber: 8,
          confidence: 'MEDIUM',
          description: null,
          gradeWeight: null,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  const event = result.events[0]!;
  assert.ok(event.date, 'week reference should resolve to a date');
  assert.equal(formatIsoDate(event.date!), '2026-10-26');
  assert.equal(event.confidence, 'MEDIUM');
  assert.equal(event.needsReview, true);
  assert.equal(event.derivedFromWeek, true);
  assert.match(event.reviewReason ?? '', /Week 8/);
});

test('week number is recovered from rawDateText when the model omits it', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Quiz 3',
          type: 'QUIZ',
          rawDateText: 'around Week 5',
          resolvedDate: null,
          weekNumber: null,
          confidence: 'LOW',
          description: null,
          gradeWeight: null,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  assert.ok(result.events[0]!.date);
  assert.equal(result.events[0]!.confidence, 'MEDIUM');
});

test('dates outside the semester are dropped and flagged', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Final Exam',
          type: 'EXAM',
          rawDateText: 'December 15, 2025',
          resolvedDate: '2025-12-15', // wrong year — outside term
          weekNumber: null,
          confidence: 'HIGH',
          description: null,
          gradeWeight: null,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  const event = result.events[0]!;
  assert.equal(event.date, null);
  assert.equal(event.confidence, 'LOW');
  assert.equal(event.needsReview, true);
  assert.equal(event.rawDateText, 'December 15, 2025', 'raw text must survive');
  assert.ok(result.warnings.some((w) => w.code === 'DATE_OUT_OF_RANGE'));
});

test('undated vague events are LOW confidence and reviewed', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Term Paper',
          type: 'ASSIGNMENT',
          rawDateText: 'late in the term',
          resolvedDate: null,
          weekNumber: null,
          confidence: 'LOW',
          description: null,
          gradeWeight: 20,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  assert.equal(result.events[0]!.date, null);
  assert.equal(result.events[0]!.needsReview, true);
  assert.ok(result.events[0]!.reviewReason);
});

test('duplicate events are collapsed with a warning', () => {
  const dup = {
    title: 'Quiz 1',
    type: 'QUIZ' as const,
    rawDateText: 'Sept 22',
    resolvedDate: '2026-09-22',
    weekNumber: null,
    confidence: 'HIGH' as const,
    description: null,
    gradeWeight: null,
  };
  const result = normalizeExtraction(baseResult({ events: [dup, { ...dup }] }), {
    semesterStart,
    semesterEnd,
  });

  assert.equal(result.events.length, 1);
  assert.ok(result.warnings.some((w) => w.code === 'DUPLICATE_EVENT'));
});

test('grading weights that do not sum to 100 produce a warning', () => {
  const result = normalizeExtraction(
    baseResult({
      gradingComponents: [
        { name: 'Homework', weight: 30 },
        { name: 'Final', weight: 40 },
      ],
      events: [],
    }),
    { semesterStart, semesterEnd },
  );

  assert.ok(result.warnings.some((w) => w.code === 'WEIGHTS_DO_NOT_SUM'));
  assert.equal(result.stats.weightTotal, 70);
});

test('weights within tolerance do not warn', () => {
  const result = normalizeExtraction(
    baseResult({
      gradingComponents: [
        { name: 'A', weight: 50.5 },
        { name: 'B', weight: 49 },
      ],
    }),
    { semesterStart, semesterEnd },
  );
  assert.ok(!result.warnings.some((w) => w.code === 'WEIGHTS_DO_NOT_SUM'));
});

test('events sort dated-first, chronologically', () => {
  const result = normalizeExtraction(
    baseResult({
      events: [
        {
          title: 'Vague thing',
          type: 'OTHER',
          rawDateText: 'TBD',
          resolvedDate: null,
          weekNumber: null,
          confidence: 'LOW',
          description: null,
          gradeWeight: null,
        },
        {
          title: 'Later',
          type: 'ASSIGNMENT',
          rawDateText: 'Nov 1',
          resolvedDate: '2026-11-01',
          weekNumber: null,
          confidence: 'HIGH',
          description: null,
          gradeWeight: null,
        },
        {
          title: 'Sooner',
          type: 'ASSIGNMENT',
          rawDateText: 'Oct 1',
          resolvedDate: '2026-10-01',
          weekNumber: null,
          confidence: 'HIGH',
          description: null,
          gradeWeight: null,
        },
      ],
    }),
    { semesterStart, semesterEnd },
  );

  assert.deepEqual(
    result.events.map((e) => e.title),
    ['Sooner', 'Later', 'Vague thing'],
  );
});
