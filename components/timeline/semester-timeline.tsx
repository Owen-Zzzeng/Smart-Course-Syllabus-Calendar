'use client';

import { useEffect, useMemo, useRef } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { todayUtc, utcToLocalMidnight } from '@/lib/dates';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { withAlpha } from '@/lib/colors';
import { semesterWeekCount, toUtcDate, weekIndexFor } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { CourseDto, SemesterDto } from '@/types';
import { EventDetail } from './event-detail';
import { EventTypeIcon } from './event-type-icon';

const WEEK_WIDTH = 160; // px per week column
const LABEL_WIDTH = 176; // px for the sticky course label column

interface SemesterTimelineProps {
  semester: SemesterDto;
  courses: CourseDto[];
}

/**
 * Custom Gantt-style timeline built from plain divs:
 * one row per course, one column per semester week, events grouped into the
 * week cell they fall in. Horizontal scroll, sticky course labels, and the
 * current week auto-scrolled into view and highlighted.
 */
export function SemesterTimeline({ semester, courses }: SemesterTimelineProps) {
  const start = toUtcDate(semester.startDate);
  const end = toUtcDate(semester.endDate);
  const weekCount = semesterWeekCount(start, end);
  const currentWeek = weekIndexFor(start, todayUtc());
  const scrollRef = useRef<HTMLDivElement>(null);

  const weeks = useMemo(
    () =>
      Array.from({ length: weekCount }, (_, i) => {
        const monday = addDays(toUtcDate(start), i * 7 - ((start.getUTCDay() + 6) % 7));
        return { index: i + 1, monday };
      }),
    [start, weekCount],
  );

  // Bring the current week into view on mount.
  useEffect(() => {
    if (currentWeek && currentWeek >= 1 && currentWeek <= weekCount && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, (currentWeek - 2) * WEEK_WIDTH);
    }
  }, [currentWeek, weekCount]);

  const eventsByCourseWeek = useMemo(() => {
    const map = new Map<string, CourseDto['events']>();
    for (const course of courses) {
      for (const event of course.events) {
        if (!event.date) continue;
        const week = weekIndexFor(start, toUtcDate(event.date));
        if (!week || week < 1 || week > weekCount) continue;
        const key = `${course.id}:${week}`;
        map.set(key, [...(map.get(key) ?? []), event]);
      }
    }
    return map;
  }, [courses, start, weekCount]);

  if (courses.length === 0) return null;

  return (
    <div ref={scrollRef} className="timeline-scroll overflow-x-auto rounded-lg border">
      <div style={{ minWidth: LABEL_WIDTH + weekCount * WEEK_WIDTH }}>
        {/* Week header */}
        <div className="flex border-b bg-muted/50">
          <div
            className="sticky left-0 z-20 shrink-0 border-r bg-muted/95 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur"
            style={{ width: LABEL_WIDTH }}
          >
            Course
          </div>
          {weeks.map((week) => (
            <div
              key={week.index}
              className={cn(
                'shrink-0 border-r px-2 py-2 text-xs',
                week.index === currentWeek && 'bg-blue-50',
              )}
              style={{ width: WEEK_WIDTH }}
            >
              <span className={cn('font-semibold', week.index === currentWeek && 'text-blue-700')}>
                Week {week.index}
              </span>
              <span className="ml-1.5 text-muted-foreground">
                {format(utcToLocalMidnight(week.monday), 'MMM d')}
              </span>
              {week.index === currentWeek && (
                <span className="ml-1.5 rounded bg-blue-600 px-1 py-0.5 text-[10px] font-medium text-white">
                  now
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Course rows */}
        {courses.map((course) => (
          <div key={course.id} className="flex border-b last:border-b-0">
            <div
              className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r bg-background/95 px-3 py-3 backdrop-blur"
              style={{ width: LABEL_WIDTH }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: course.color }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{course.courseCode ?? course.name}</p>
                {course.courseCode && (
                  <p className="truncate text-xs text-muted-foreground">{course.name}</p>
                )}
              </div>
            </div>

            {weeks.map((week) => {
              const cellEvents = eventsByCourseWeek.get(`${course.id}:${week.index}`) ?? [];
              return (
                <div
                  key={week.index}
                  className={cn(
                    'flex min-h-[64px] shrink-0 flex-col gap-1 border-r p-1.5',
                    week.index === currentWeek && 'bg-blue-50/60',
                  )}
                  style={{ width: WEEK_WIDTH }}
                >
                  {cellEvents.map((event) => (
                    <Popover key={event.id}>
                      <PopoverTrigger asChild>
                        <button
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-medium transition-transform animate-fade-in hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{
                            backgroundColor: withAlpha(course.color, 0.14),
                            color: course.color,
                            border: `1px solid ${withAlpha(course.color, 0.35)}`,
                          }}
                        >
                          <EventTypeIcon type={event.type} className="h-3 w-3 shrink-0" />
                          <span className="truncate">{event.title}</span>
                          {event.date && (
                            <span className="ml-auto shrink-0 opacity-70">
                              {format(parseISO(event.date), 'd')}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" className="w-80">
                        <EventDetail event={event} course={course} />
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
