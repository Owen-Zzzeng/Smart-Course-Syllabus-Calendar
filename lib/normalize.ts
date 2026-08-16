import { isAfter, isBefore } from 'date-fns';
import {
  extractWeekNumber,
  formatIsoDate,
  parseIsoDate,
  resolveWeekNumber,
  toUtcDate,
} from './dates';
import type { ExtractionResult } from './extraction-schema';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type EventType = 'EXAM' | 'ASSIGNMENT' | 'QUIZ' | 'PROJECT' | 'READING' | 'OTHER';

export interface NormalizedEvent {
  title: string;
  type: EventType;
  date: Date | null;
  rawDateText: string | null;
  confidence: Confidence;
  needsReview: boolean;
  description: string | null;
  gradeWeight: number | null;
  /** Explains to the user why this row was flagged. Not persisted. */
  reviewReason: string | null;
  /** True when the app derived the date from "Week N" rather than the model. */
  derivedFromWeek: boolean;
}

export interface ValidationWarning {
  code: 'WEIGHTS_DO_NOT_SUM' | 'DATE_OUT_OF_RANGE' | 'DUPLICATE_EVENT' | 'NO_EVENTS';
  message: string;
}

export interface NormalizedExtraction {
  courseName: string;
  courseCode: string | null;
  instructor: string | null;
  gradingComponents: { name: string; weight: number }[];
  events: NormalizedEvent[];
  warnings: ValidationWarning[];
  stats: {
    totalEvents: number;
    needsReview: number;
    highConfidence: number;
    weightTotal: number;
  };
}

export interface NormalizeOptions {
  semesterStart: Date;
  semesterEnd: Date;
}

const WEIGHT_TOLERANCE = 2; // percentage points

/**
 * Step 3 of the pipeline: everything between "the model replied" and "we trust
 * this enough to show it".
 *
 * Responsibilities:
 *  1. Coerce and range-check dates.
 *  2. Resolve "Week N" against the real semester start when the model couldn't.
 *  3. Drop dates that fall outside the semester rather than plotting nonsense.
 *  4. De-duplicate identical rows the model sometimes emits twice.
 *  5. Decide which rows a human must confirm.
 */
export function normalizeExtraction(
  raw: ExtractionResult,
  { semesterStart, semesterEnd }: NormalizeOptions,
): NormalizedExtraction {
  const warnings: ValidationWarning[] = [];
  const start = toUtcDate(semesterStart);
  const end = toUtcDate(semesterEnd);

  const seen = new Set<string>();
  const events: NormalizedEvent[] = [];

  for (const item of raw.events) {
    const title = item.title.trim();
    if (!title) continue;

    let date = parseIsoDate(item.resolvedDate);
    let confidence: Confidence = item.confidence;
    let derivedFromWeek = false;
    let reviewReason: string | null = null;

    // The model is told to leave relative references unresolved. We resolve
    // them here because only the app knows the true semester start date.
    if (!date) {
      const week = item.weekNumber ?? extractWeekNumber(item.rawDateText);
      if (week !== null) {
        const resolved = resolveWeekNumber(start, week);
        if (resolved) {
          date = resolved;
          derivedFromWeek = true;
          confidence = 'MEDIUM';
          reviewReason = `Derived from "${item.rawDateText ?? `Week ${week}`}" using your semester start date — confirm the exact day.`;
        }
      }
    }

    // A date outside the term is almost always a hallucinated year or a date
    // copied from a previous offering of the course. Keep the text, drop the date.
    if (date && (isBefore(date, start) || isAfter(date, end))) {
      warnings.push({
        code: 'DATE_OUT_OF_RANGE',
        message: `"${title}" resolved to ${formatIsoDate(date)}, which is outside the semester.`,
      });
      reviewReason = `The extracted date ${formatIsoDate(date)} falls outside your semester.`;
      date = null;
      confidence = 'LOW';
    }

    if (!date && !reviewReason) {
      reviewReason = item.rawDateText
        ? `Could not turn "${item.rawDateText}" into a calendar date.`
        : 'No date was found for this item.';
      confidence = 'LOW';
    }

    if (date && confidence === 'HIGH' && !derivedFromWeek) {
      reviewReason = null;
    }

    // Only HIGH-confidence rows with a real date bypass human review.
    const needsReview = !date || confidence !== 'HIGH';

    const dedupeKey = `${title.toLowerCase()}|${date ? formatIsoDate(date) : item.rawDateText ?? ''}`;
    if (seen.has(dedupeKey)) {
      warnings.push({ code: 'DUPLICATE_EVENT', message: `Skipped duplicate entry "${title}".` });
      continue;
    }
    seen.add(dedupeKey);

    events.push({
      title,
      type: item.type,
      date,
      rawDateText: item.rawDateText?.trim() || null,
      confidence,
      needsReview,
      description: item.description?.trim() || null,
      gradeWeight: item.gradeWeight ?? null,
      reviewReason,
      derivedFromWeek,
    });
  }

  events.sort((a, b) => {
    if (a.date && b.date) return a.date.getTime() - b.date.getTime();
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });

  const gradingComponents = raw.gradingComponents
    .map((c) => ({ name: c.name.trim(), weight: Math.round(c.weight * 100) / 100 }))
    .filter((c) => c.name.length > 0);

  const weightTotal = gradingComponents.reduce((sum, c) => sum + c.weight, 0);

  if (gradingComponents.length > 0 && Math.abs(weightTotal - 100) > WEIGHT_TOLERANCE) {
    warnings.push({
      code: 'WEIGHTS_DO_NOT_SUM',
      message: `Grading weights sum to ${weightTotal.toFixed(1)}%, not 100%. The syllabus may list extra credit or an incomplete breakdown.`,
    });
  }

  if (events.length === 0) {
    warnings.push({
      code: 'NO_EVENTS',
      message: 'No dated items were found in this document.',
    });
  }

  return {
    courseName: raw.courseName.trim(),
    courseCode: raw.courseCode?.trim() || null,
    instructor: raw.instructor?.trim() || null,
    gradingComponents,
    events,
    warnings,
    stats: {
      totalEvents: events.length,
      needsReview: events.filter((e) => e.needsReview).length,
      highConfidence: events.filter((e) => !e.needsReview).length,
      weightTotal: Math.round(weightTotal * 100) / 100,
    },
  };
}
