'use client';

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { CalendarCheck2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withAlpha } from '@/lib/colors';
import { todayUtc, toUtcDate } from '@/lib/dates';
import { EVENT_TYPE_LABELS, EventTypeIcon } from './event-type-icon';
import type { CourseDto } from '@/types';

/**
 * The "come back every Monday" panel: everything due in the next 7 days,
 * across all courses, always visible.
 */
export function ThisWeekPanel({ courses }: { courses: CourseDto[] }) {
  const today = todayUtc();

  const upcoming = courses
    .flatMap((course) =>
      course.events
        .filter((e) => e.date)
        .map((event) => ({
          event,
          course,
          days: differenceInCalendarDays(toUtcDate(event.date!), today),
        })),
    )
    .filter(({ days }) => days >= 0 && days < 7)
    .sort((a, b) => a.days - b.days);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck2 className="h-4 w-4 text-blue-600" />
          This week
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {upcoming.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">
            Nothing due in the next 7 days. 🎉
          </p>
        )}
        {upcoming.map(({ event, course, days }) => (
          <div
            key={event.id}
            className="flex items-center gap-2.5 rounded-md border p-2.5 animate-fade-in"
            style={{ borderLeftWidth: 3, borderLeftColor: course.color }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded"
              style={{ backgroundColor: withAlpha(course.color, 0.14), color: course.color }}
            >
              <EventTypeIcon type={event.type} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{event.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {course.courseCode ?? course.name} · {EVENT_TYPE_LABELS[event.type]}
              </p>
            </div>
            <Badge variant={days <= 1 ? 'destructive' : 'secondary'} className="shrink-0">
              {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : format(parseISO(event.date!), 'EEE')}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
