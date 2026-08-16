import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import { AppShell } from '@/components/app-shell';
import { UploadZone } from '@/components/upload/upload-zone';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { toUtcDate } from '@/lib/dates';

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const { id } = await params;
  const semester = await db.semester.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  if (!semester) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Add your syllabi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {semester.name} · {format(toUtcDate(semester.startDate), 'MMM d')} –{' '}
          {format(toUtcDate(semester.endDate), 'MMM d, yyyy')}
        </p>
        <div className="mt-6">
          <UploadZone semesterId={semester.id} />
        </div>
      </div>
    </AppShell>
  );
}
