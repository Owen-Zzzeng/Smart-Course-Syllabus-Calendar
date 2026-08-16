import { formatIsoDate, toUtcDate } from './dates';
import type { ExtractedEvent, ExtractionResult } from './extraction-schema';

/**
 * Deterministic, offline stand-in for the LLM.
 *
 * It exists for three reasons: the product stays fully demoable with no API
 * key, the test suite runs without network or spend, and the pipeline's
 * downstream stages (validation, review UX, timeline) can be exercised against
 * stable fixtures. It is intentionally regex-based and much dumber than the
 * model — including producing the mixed-confidence output the review queue is
 * designed to handle.
 */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const MONTH_DAY = new RegExp(
  `\\b(${Object.keys(MONTHS).join('|')})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`,
  'i',
);
const NUMERIC_DATE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const WEEK_REF = /\bweek\s*#?\s*(\d{1,2})\b/i;

function classify(line: string): ExtractedEvent['type'] {
  const l = line.toLowerCase();
  if (/\b(midterm|final exam|exam)\b/.test(l)) return 'EXAM';
  if (/\bquiz(zes)?\b/.test(l)) return 'QUIZ';
  if (/\bproject|milestone|presentation|demo\b/.test(l)) return 'PROJECT';
  if (/\bread(ing)?s?\b|\bchapter\b/.test(l)) return 'READING';
  if (/\bassignment|homework|hw\b|\bproblem set\b|\bps\d\b|\blab\b|\bessay\b|\bpaper\b/.test(l))
    return 'ASSIGNMENT';
  return 'OTHER';
}

function resolveMonthDay(line: string, semesterStart: Date, semesterEnd: Date) {
  const m = MONTH_DAY.exec(line);
  if (m?.[1] && m[2]) {
    const month = MONTHS[m[1].toLowerCase()]!;
    const day = Number(m[2]);
    // Pick whichever year keeps the date inside the term.
    for (const year of [semesterStart.getUTCFullYear(), semesterEnd.getUTCFullYear()]) {
      const candidate = toUtcDate(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      );
      if (candidate >= semesterStart && candidate <= semesterEnd) {
        return { iso: formatIsoDate(candidate), raw: m[0] };
      }
    }
    return { iso: null, raw: m[0] };
  }

  const n = NUMERIC_DATE.exec(line);
  if (n?.[1] && n[2]) {
    const month = Number(n[1]);
    const day = Number(n[2]);
    const year = n[3]
      ? Number(n[3].length === 2 ? `20${n[3]}` : n[3])
      : semesterStart.getUTCFullYear();
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const candidate = toUtcDate(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      );
      const inTerm = candidate >= semesterStart && candidate <= semesterEnd;
      const fallback = toUtcDate(
        `${semesterEnd.getUTCFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      );
      if (inTerm) return { iso: formatIsoDate(candidate), raw: n[0] };
      if (fallback >= semesterStart && fallback <= semesterEnd)
        return { iso: formatIsoDate(fallback), raw: n[0] };
      return { iso: null, raw: n[0] };
    }
  }

  return null;
}

function cleanTitle(line: string): string {
  return line
    .replace(/^[\s*\-•|\d.]+/, '')
    .replace(/\s*[—–|:-]\s*(due|on)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120);
}

export function mockExtract(params: {
  text: string;
  semesterStart: Date;
  semesterEnd: Date;
}): ExtractionResult {
  const { text } = params;
  const semesterStart = toUtcDate(params.semesterStart);
  const semesterEnd = toUtcDate(params.semesterEnd);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const courseCode = /\b([A-Z]{2,5})\s?-?\s?(\d{3}[A-Z]?)\b/.exec(text);
  const courseNameLine =
    lines.find((l) => /^(course|class)\s*(title|name)?\s*[:—-]/i.test(l))?.split(/[:—-]/).slice(1).join(':').trim() ??
    lines[0] ??
    'Untitled Course';
  const instructor = /(?:instructor|professor|taught by|lecturer)\s*[:—-]\s*([^\n,]{3,60})/i.exec(text);

  const gradingComponents: { name: string; weight: number }[] = [];
  const seenComponent = new Set<string>();
  for (const line of lines) {
    // Requires an explicit separator (colon/dash) so prose like
    // "Late assignments lose 10% per day" is not mistaken for a component.
    const m = /^([A-Za-z][A-Za-z &/'()-]{2,40}?)\s*[:—–-]+\s*(\d{1,3}(?:\.\d+)?)\s*%/.exec(line);
    if (m?.[1] && m[2]) {
      const name = m[1].trim();
      const weight = Number(m[2]);
      const key = name.toLowerCase();
      if (!seenComponent.has(key) && weight > 0 && weight <= 100 && !/^week/i.test(name)) {
        seenComponent.add(key);
        gradingComponents.push({ name, weight });
      }
    }
  }

  const events: ExtractedEvent[] = [];
  const seenEvent = new Set<string>();

  for (const line of lines) {
    const type = classify(line);
    const hasKeyword =
      /\b(due|exam|midterm|final|quiz|assignment|homework|project|milestone|presentation|reading|problem set|lab|essay|paper)\b/i.test(
        line,
      );
    if (!hasKeyword) continue;

    const resolved = resolveMonthDay(line, semesterStart, semesterEnd);
    const week = WEEK_REF.exec(line);
    const gradeWeight = /(\d{1,3})\s*%/.exec(line);

    let rawDateText: string | null = null;
    let resolvedDate: string | null = null;
    let weekNumber: number | null = null;
    let confidence: ExtractedEvent['confidence'] = 'LOW';

    if (resolved) {
      rawDateText = resolved.raw;
      resolvedDate = resolved.iso;
      confidence = resolved.iso ? 'HIGH' : 'LOW';
    } else if (week?.[1]) {
      rawDateText = week[0];
      weekNumber = Number(week[1]);
      confidence = 'MEDIUM';
    } else if (/\b(tbd|tba|to be announced|late in the term|end of term)\b/i.test(line)) {
      rawDateText = /\b(tbd|tba|to be announced|late in the term|end of term)\b/i.exec(line)![0];
      confidence = 'LOW';
    } else {
      continue;
    }

    const title = cleanTitle(rawDateText ? line.replace(rawDateText, '') : line);
    if (title.length < 3) continue;

    const key = `${title.toLowerCase()}|${resolvedDate ?? rawDateText ?? ''}`;
    if (seenEvent.has(key)) continue;
    seenEvent.add(key);

    events.push({
      title,
      type,
      rawDateText,
      resolvedDate,
      weekNumber,
      confidence,
      description: null,
      gradeWeight: gradeWeight?.[1] ? Number(gradeWeight[1]) : null,
    });
  }

  return {
    courseName: cleanTitle(courseNameLine) || 'Untitled Course',
    courseCode: courseCode ? `${courseCode[1]} ${courseCode[2]}` : null,
    instructor: instructor?.[1]?.trim() ?? null,
    gradingComponents,
    events,
  };
}
