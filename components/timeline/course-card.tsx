'use client';

import { differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { withAlpha } from '@/lib/colors';
import { todayUtc, toUtcDate } from '@/lib/dates';
import type { CourseDto } from '@/types';

/** Per-course card with a visual grading-weight bar and upcoming-deadline count. */
export function CourseCard({ course }: { course: CourseDto }) {
  const today = todayUtc();
  const upcoming = course.events.filter(
    (e) => e.date && differenceInCalendarDays(toUtcDate(e.date), today) >= 0,
  ).length;

  const totalWeight = course.components.reduce((s, c) => s + c.weight, 0);

  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{course.name}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[course.courseCode, course.instructor].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <span
            className="mt-1 h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: course.color }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {course.components.length > 0 ? (
          <div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full">
              {course.components.map((c, i) => (
                <div
                  key={c.id}
                  title={`${c.name}: ${c.weight}%`}
                  style={{
                    width: `${(c.weight / Math.max(totalWeight, 100)) * 100}%`,
                    backgroundColor: withAlpha(course.color, 1 - i * 0.15),
                  }}
                />
              ))}
            </div>
            <ul className="mt-2 space-y-1">
              {course.components.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-sm"
                      style={{ backgroundColor: withAlpha(course.color, 1 - i * 0.15) }}
                    />
                    {c.name}
                  </span>
                  <span className="font-medium">{c.weight}%</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No grading breakdown found.</p>
        )}
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">Upcoming deadlines</span>
          <Badge variant="secondary">{upcoming}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
