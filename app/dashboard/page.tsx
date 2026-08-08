import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * /dashboard resolves to the user's most recent semester. Keeping it as a
 * redirect means every deep link and post-auth landing spot shares one
 * canonical semester URL.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const semester = await db.semester.findFirst({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });

  redirect(semester ? `/semester/${semester.id}` : '/semester/new');
}
