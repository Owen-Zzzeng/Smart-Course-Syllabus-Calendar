'use client';

import { useState } from 'react';
import { CalendarPlus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { CourseDto } from '@/types';

interface ExportButtonProps {
  semesterId: string;
  courses: CourseDto[];
}

/** Lets the user export all courses or a subset as a single .ics download. */
export function ExportButton({ semesterId, courses }: ExportButtonProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(courses.map((c) => c.id)));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = selected.size === courses.length;
  const href =
    `/api/semesters/${semesterId}/export.ics` +
    (allSelected ? '' : `?courses=${[...selected].join(',')}`);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="h-4 w-4" />
          Export to Calendar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="text-sm font-medium">Include courses</p>
        <div className="mt-2 space-y-1.5">
          {courses.map((course) => (
            <label key={course.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(course.id)}
                onChange={() => toggle(course.id)}
                className="h-4 w-4 rounded border-input accent-blue-600"
              />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: course.color }} />
              <span className="truncate">{course.courseCode ?? course.name}</span>
            </label>
          ))}
        </div>
        <Button asChild size="sm" className="mt-3 w-full" disabled={selected.size === 0}>
          <a href={href} download aria-disabled={selected.size === 0}>
            <Download className="h-4 w-4" />
            Download .ics ({selected.size} course{selected.size === 1 ? '' : 's'})
          </a>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
