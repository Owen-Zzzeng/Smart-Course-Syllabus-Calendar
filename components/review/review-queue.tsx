'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EventDto } from '@/types';
import { ReviewItem } from './review-item';

interface ReviewCourse {
  id: string;
  name: string;
  courseCode: string | null;
  color: string;
  events: EventDto[];
}

interface ReviewQueueProps {
  semesterId: string;
  semesterStart: string;
  semesterEnd: string;
  courses: ReviewCourse[];
}

/**
 * The trust-building step: every LOW/MEDIUM confidence extraction is shown
 * with its verbatim source text next to the AI's guess, and the human decides.
 */
export function ReviewQueue({ semesterId, semesterStart, semesterEnd, courses }: ReviewQueueProps) {
  const router = useRouter();
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const total = useMemo(() => courses.reduce((sum, c) => sum + c.events.length, 0), [courses]);
  const remaining = total - resolved.size;

  const markResolved = (eventId: string) =>
    setResolved((prev) => new Set(prev).add(eventId));

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <h1 className="text-2xl font-bold tracking-tight">Nothing needs your review</h1>
        <p className="text-sm text-muted-foreground">
          Every extracted date was high-confidence. You&apos;re all set.
        </p>
        <Button onClick={() => router.push(`/semester/${semesterId}`)}>
          Go to my semester <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Review &amp; confirm</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI wasn&apos;t fully sure about these. Confirm, fix, or remove each one — the original
          syllabus text is shown so you can verify.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${total === 0 ? 100 : (resolved.size / total) * 100}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
            {remaining === 0 ? 'All done!' : `${remaining} of ${total} need your input`}
          </span>
        </div>
      </div>

      {courses.map((course) => {
        const open = course.events.filter((e) => !resolved.has(e.id));
        if (open.length === 0) return null;
        return (
          <section key={course.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} />
              <h2 className="font-semibold">
                {course.courseCode ? `${course.courseCode} — ` : ''}
                {course.name}
              </h2>
              <Badge variant="secondary">{open.length}</Badge>
            </div>
            <div className="space-y-3">
              {course.events.map((event) =>
                resolved.has(event.id) ? null : (
                  <ReviewItem
                    key={event.id}
                    event={event}
                    color={course.color}
                    semesterStart={semesterStart}
                    semesterEnd={semesterEnd}
                    onResolved={() => markResolved(event.id)}
                  />
                ),
              )}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end border-t pt-6">
        <Button
          size="lg"
          variant={remaining === 0 ? 'default' : 'outline'}
          onClick={() => router.push(`/semester/${semesterId}`)}
        >
          {remaining === 0 ? 'Finish setup' : `Skip remaining ${remaining} for now`}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
