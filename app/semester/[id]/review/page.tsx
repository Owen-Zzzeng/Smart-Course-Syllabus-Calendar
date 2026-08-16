import { notFound, redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ReviewQueue } from '@/components/review/review-queue';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatIsoDate } from '@/lib/dates';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const semester = await db.semester.findFirst({
    where: { id, userId: user.id },
    include: {
      courses: {
        orderBy: { createdAt: 'asc' },
        include: {
          events: {
            where: { needsReview: true },
            orderBy: [{ confidence: 'asc' }, { title: 'asc' }],
          },
        },
      },
    },
  });
  if (!semester) notFound();

  const courses = semester.courses
    .filter((c) => c.events.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      courseCode: c.courseCode,
      color: c.color,
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
    }));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <ReviewQueue
          semesterId={semester.id}
          semesterStart={formatIsoDate(semester.startDate)}
          semesterEnd={formatIsoDate(semester.endDate)}
          courses={courses}
        />
      </div>
    </AppShell>
  );
}
