import { addDays, differenceInCalendarDays, isValid, parseISO, startOfWeek } from 'date-fns';

/**
 * All dates in this app are calendar dates, not instants. Storing them as UTC
 * midnight avoids the classic "assignment shows up a day early in California"
 * timezone bug when Postgres `date` columns round-trip through JS Date.
 */
export function toUtcDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const [y, m, d] = input.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a YYYY-MM-DD string, returning null when the value is not a real date. */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value.slice(0, 10));
  if (!isValid(parsed)) return null;
  return toUtcDate(parsed);
}

/**
 * Resolves "Week N" into a concrete date using the semester start.
 *
 * Week 1 is the week containing the semester start date. The returned date is
 * the Monday of that week, unless week 1 starts mid-week, in which case the
 * semester start itself is used so we never point at a date before the term.
 */
export function resolveWeekNumber(semesterStart: Date, weekNumber: number): Date | null {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 30) return null;

  const start = toUtcDate(semesterStart);
  const week1Monday = toUtcDate(startOfWeek(start, { weekStartsOn: 1 }));
  const target = addDays(week1Monday, (weekNumber - 1) * 7);

  return toUtcDate(target < start ? start : target);
}

/**
 * Last-resort parser for relative text the model marked as unresolved.
 * Deliberately conservative: it only recognises explicit week references.
 * Anything vaguer stays null and goes to the human review queue.
 */
const WEEK_PATTERN = /\bweeks?\s*#?\s*(\d{1,2})\b/i;

export function extractWeekNumber(rawText: string | null | undefined): number | null {
  if (!rawText) return null;
  const match = WEEK_PATTERN.exec(rawText);
  if (!match?.[1]) return null;
  const week = Number(match[1]);
  return week >= 1 && week <= 30 ? week : null;
}

/** Inclusive count of semester weeks, minimum 1. */
export function semesterWeekCount(startDate: Date, endDate: Date): number {
  const days = differenceInCalendarDays(toUtcDate(endDate), toUtcDate(startDate));
  return Math.max(1, Math.ceil((days + 1) / 7));
}

/** Today as a UTC-midnight calendar date, based on the user's local calendar day. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Converts a UTC-midnight calendar date to local midnight so date-fns `format`
 * renders the intended day regardless of the viewer's timezone.
 */
export function utcToLocalMidnight(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** 1-based index of the week a date falls into, or null if outside the term. */
export function weekIndexFor(semesterStart: Date, date: Date): number | null {
  const week1Monday = toUtcDate(startOfWeek(toUtcDate(semesterStart), { weekStartsOn: 1 }));
  const days = differenceInCalendarDays(toUtcDate(date), week1Monday);
  if (days < 0) return null;
  return Math.floor(days / 7) + 1;
}
