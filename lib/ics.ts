import { createEvents, type EventAttributes } from 'ics';
import { toUtcDate } from './dates';

export interface IcsCourse {
  name: string;
  courseCode: string | null;
  events: {
    title: string;
    type: string;
    date: Date | null;
    description: string | null;
    gradeWeight: number | null;
    rawDateText: string | null;
    confidence: string;
  }[];
}

const TYPE_LABEL: Record<string, string> = {
  EXAM: 'Exam',
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  PROJECT: 'Project',
  READING: 'Reading',
  OTHER: 'Event',
};

function buildDescription(
  event: IcsCourse['events'][number],
  course: IcsCourse,
): string {
  const parts = [
    `Course: ${course.courseCode ? `${course.courseCode} — ` : ''}${course.name}`,
    `Type: ${TYPE_LABEL[event.type] ?? event.type}`,
  ];
  if (event.gradeWeight != null) parts.push(`Worth: ${event.gradeWeight}% of final grade`);
  if (event.description) parts.push('', event.description);
  if (event.rawDateText) parts.push('', `Source text: "${event.rawDateText}"`);
  if (event.confidence !== 'HIGH') {
    parts.push(`Date confidence: ${event.confidence} — verify against your syllabus.`);
  }
  return parts.join('\n');
}

/**
 * Emits all-day VEVENTs. Syllabus deadlines rarely carry a reliable time, and
 * an all-day entry is honest about that rather than inventing 9:00 AM.
 */
export function buildIcs(courses: IcsCourse[], calendarName: string): string {
  const attributes: EventAttributes[] = [];

  for (const course of courses) {
    for (const event of course.events) {
      if (!event.date) continue; // undated items cannot be put on a calendar
      const d = toUtcDate(event.date);
      const prefix = course.courseCode ?? course.name;

      attributes.push({
        title: `${prefix}: ${event.title}`,
        start: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()],
        duration: { days: 1 },
        description: buildDescription(event, course),
        categories: [TYPE_LABEL[event.type] ?? 'Event'],
        productId: 'smart-syllabus-visualizer',
        calName: calendarName,
        busyStatus: 'FREE',
        transp: 'TRANSPARENT',
      });
    }
  }

  if (attributes.length === 0) {
    // A valid but empty calendar beats a 500 when nothing is dated yet.
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//smart-syllabus-visualizer//EN',
      `X-WR-CALNAME:${calendarName}`,
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }

  const { error, value } = createEvents(attributes);
  if (error || !value) {
    throw new Error(`Failed to generate calendar: ${error?.message ?? 'unknown error'}`);
  }
  return value;
}
