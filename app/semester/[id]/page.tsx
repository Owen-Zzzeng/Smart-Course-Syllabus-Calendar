import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CalendarRange, List, Plus } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ExportButton } from '@/components/export-button';
import { CourseCard } from '@/components/timeline/course-card';
import { EventListView } from '@/components/timeline/event-list-view';
import { SemesterTimeline } from '@/components/timeline/semester-timeline';
import { ThisWeekPanel } from '@/components/timeline/this-week-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatIsoDate } from '@/lib/dates';
import type { SemesterDto } from '@/types';

export default async function SemesterPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const record = await db.semester.findFirst({
    where: { id, userId: user.id },
    include: {
      courses: {
        orderBy: { createdAt: 'asc' },
        include: {
          components: { orderBy: { weight: 'desc' } },
          events: { orderBy: [{ date: 'asc' }, { title: 'asc' }] },
        },
      },
    },
  });
  if (!record) notFound();

  const semester: SemesterDto = {
    id: record.id,
    name: record.name,
    startDate: formatIsoDate(record.startDate),
    endDate: formatIsoDate(record.endDate),
    courses: record.courses.map((c) => ({
      id: c.id,
      name: c.name,
      courseCode: c.courseCode,
      instructor: c.instructor,
      color: c.color,
      components: c.components.map((g) => ({ id: g.id, name: g.name, weight: g.weight })),
      events: c.events.map((e) => ({
        id: e.id,
        courseId: e.courseId,
        title: e.title,
        type: e.type,
        date: e.date ? formatIsoDate(e.date) : null,
        rawDateText: e.rawDateText,
        confidence: e.confidence,
        needsReview: e.needsReview,
        description: e.description,
        gradeWeight: e.gradeWeight,
      })),
    })),
  };

  const needsReview = semester.courses.reduce(
    (sum, c) => sum + c.events.filter((e) => e.needsReview).length,
    0,
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{semester.name}</h1>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(semester.startDate), 'MMM d')} –{' '}
              {format(parseISO(semester.endDate), 'MMM d, yyyy')} · {semester.courses.length}{' '}
              course{semester.courses.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsReview > 0 && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/semester/${semester.id}/review`}>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Review <Badge variant="warning">{needsReview}</Badge>
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/semester/${semester.id}/upload`}>
                <Plus className="h-4 w-4" />
                Add syllabi
              </Link>
            </Button>
            {semester.courses.length > 0 && (
              <ExportButton semesterId={semester.id} courses={semester.courses} />
            )}
          </div>
        </div>

        {semester.courses.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-20 text-center">
            <CalendarRange className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No courses yet — upload your first syllabus.</p>
            <Button asChild>
              <Link href={`/semester/${semester.id}/upload`}>
                <Plus className="h-4 w-4" /> Upload syllabi
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Main column: view toggle. On mobile, "This week" is rendered first. */}
            <div className="order-2 min-w-0 lg:order-1">
              <Tabs defaultValue="timeline">
                <TabsList>
                  <TabsTrigger value="timeline">
                    <CalendarRange className="h-4 w-4" /> Timeline
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4" /> List
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                  <SemesterTimeline semester={semester} courses={semester.courses} />
                </TabsContent>
                <TabsContent value="list">
                  <EventListView semester={semester} courses={semester.courses} />
                </TabsContent>
              </Tabs>

              <div className="mt-8">
                <h2 className="mb-3 font-semibold">Courses</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {semester.courses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            </div>

            <aside className="order-1 lg:order-2">
              <div className="lg:sticky lg:top-20">
                <ThisWeekPanel courses={semester.courses} />
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
