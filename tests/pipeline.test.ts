import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toUtcDate } from '../lib/dates';
import { extractionResultSchema } from '../lib/extraction-schema';
import { mockExtract } from '../lib/mock-extractor';
import { normalizeExtraction } from '../lib/normalize';

const fixture = readFileSync(join(__dirname, 'fixtures', 'cs348-syllabus.txt'), 'utf8');
const semesterStart = toUtcDate('2026-09-08');
const semesterEnd = toUtcDate('2026-12-18');

test('mock extractor output conforms to the extraction schema', () => {
  const result = mockExtract({ text: fixture, semesterStart, semesterEnd });
  const parsed = extractionResultSchema.safeParse(result);
  assert.ok(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues, null, 2));
});

test('mock extractor finds course metadata', () => {
  const result = mockExtract({ text: fixture, semesterStart, semesterEnd });
  assert.equal(result.courseCode, 'CS 348');
  assert.match(result.instructor ?? '', /Lovelace/);
});

test('mock extractor finds grading components', () => {
  const result = mockExtract({ text: fixture, semesterStart, semesterEnd });
  const names = result.gradingComponents.map((c) => c.name.toLowerCase());
  assert.ok(names.some((n) => n.includes('assignment')));
  assert.ok(names.some((n) => n.includes('midterm')));
  const total = result.gradingComponents.reduce((s, c) => s + c.weight, 0);
  assert.equal(total, 100);
});

test('mock extractor produces mixed-confidence events end-to-end', () => {
  const raw = mockExtract({ text: fixture, semesterStart, semesterEnd });
  const normalized = normalizeExtraction(raw, { semesterStart, semesterEnd });

  assert.ok(normalized.events.length >= 5, `expected >=5 events, got ${normalized.events.length}`);
  // Explicit dates → confident
  assert.ok(normalized.stats.highConfidence >= 2);
  // "Week 10" milestone and TBD paper → review queue
  assert.ok(normalized.stats.needsReview >= 2);

  const milestone = normalized.events.find((e) => /milestone/i.test(e.title));
  assert.ok(milestone?.date, 'Week reference should be resolved to a date');
  assert.equal(milestone!.derivedFromWeek, true);
});
