'use client';

import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { CourseDto, EventDto } from '@/types';
import { EVENT_TYPE_LABELS, EventTypeIcon } from './event-type-icon';

/** Shared popover body for an event, used by both timeline and list views. */
export function EventDetail({ event, course }: { event: EventDto; course: CourseDto }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <EventTypeIcon type={event.type} className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium leading-tight">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {course.courseCode ? `${course.courseCode} — ` : ''}
            {course.name}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{EVENT_TYPE_LABELS[event.type]}</Badge>
        {event.gradeWeight != null && <Badge variant="outline">{event.gradeWeight}% of grade</Badge>}
        {event.needsReview && <Badge variant="warning">unconfirmed</Badge>}
      </div>
      {event.date && (
        <p className="text-sm">{format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}</p>
      )}
      {event.rawDateText && (
        <p className="text-xs text-muted-foreground">
          Syllabus text: &ldquo;{event.rawDateText}&rdquo;
        </p>
      )}
      {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
    </div>
  );
}
