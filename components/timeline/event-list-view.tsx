'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { withAlpha } from '@/lib/colors';
import { todayUtc, toUtcDate, weekIndexFor } from '@/lib/dates';
import { EVENT_TYPE_LABELS, EventTypeIcon } from './event-type-icon';
import { EventDetail } from './event-detail';
import type { CourseDto, SemesterDto } from '@/types';
import type { EventType } from '@/lib/normalize';

interface EventListViewProps {
  semester: SemesterDto;
  courses: CourseDto[];
}

/** Chronological list grouped by week, filterable by course and event type. */
export function EventListView({ semester, courses }: EventListViewProps) {
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const start = toUtcDate(semester.startDate);
  const currentWeek = weekIndexFor(start, todayUtc());

  const groups = useMemo(() => {
    const rows: { event: CourseDto['events'][number]; course: CourseDto }[] = [];
    for (const course of courses) {
      if (courseFilter !== 'all' && course.id !== courseFilter) continue;
      for (const event of course.events) {
        if (typeFilter !== 'all' && event.type !== typeFilter) continue;
        rows.push({ event, course });
      }
    }

    const dated = rows
      .filter((r) => r.event.date)
      .sort((a, b) => a.event.date!.localeCompare(b.event.date!));
    const undated = rows.filter((r) => !r.event.date);

    const byWeek = new Map<number, typeof dated>();
    for (const row of dated) {
      const week = weekIndexFor(start, toUtcDate(row.event.date!)) ?? 0;
      byWeek.set(week, [...(byWeek.get(week) ?? []), row]);
    }
    return { byWeek: [...byWeek.entries()].sort((a, b) => a[0] - b[0]), undated };
  }, [courses, courseFilter, typeFilter, start]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-52" aria-label="Filter by course">
            <SelectValue placeholder="All courses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All courses</SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.courseCode ?? c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by event type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups.byWeek.length === 0 && groups.undated.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No events match these filters.
        </p>
      )}

      {groups.byWeek.map(([week, rows]) => (
        <section key={week}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            Week {week}
            {week === currentWeek && <Badge>this week</Badge>}
          </h3>
          <div className="divide-y rounded-lg border">
            {rows.map(({ event, course }) => (
              <Popover key={event.id}>
                <PopoverTrigger asChild>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: withAlpha(course.color, 0.14), color: course.color }}
                    >
                      <EventTypeIcon type={event.type} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{event.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {course.courseCode ?? course.name} · {EVENT_TYPE_LABELS[event.type]}
                        {event.gradeWeight != null && ` · ${event.gradeWeight}%`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {format(parseISO(event.date!), 'EEE, MMM d')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <EventDetail event={event} course={course} />
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </section>
      ))}

      {groups.undated.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">No date yet</h3>
          <div className="divide-y rounded-lg border border-dashed">
            {groups.undated.map(({ event, course }) => (
              <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: withAlpha(course.color, 0.14), color: course.color }}
                >
                  <EventTypeIcon type={event.type} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {course.courseCode ?? course.name}
                    {event.rawDateText && ` · “${event.rawDateText}”`}
                  </p>
                </div>
                <Badge variant="warning">needs review</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
