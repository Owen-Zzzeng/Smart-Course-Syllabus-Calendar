import { db } from '@/lib/db';
import { handleApiError, notFound, requireApiUser } from '@/lib/api';
import { buildIcs } from '@/lib/ics';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/semesters/:id/export.ics?courses=id1,id2
 * Omitting ?courses exports every course in the semester.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;

    const url = new URL(request.url);
    const courseFilter = url.searchParams.get('courses')?.split(',').filter(Boolean);

    const semester = await db.semester.findFirst({
      where: { id, userId: user.id },
      include: {
        courses: {
          where: courseFilter?.length ? { id: { in: courseFilter } } : undefined,
          include: { events: { where: { date: { not: null } } } },
        },
      },
    });
    if (!semester) throw notFound('Semester');

    const ics = buildIcs(
      semester.courses.map((c) => ({
        name: c.name,
        courseCode: c.courseCode,
        events: c.events,
      })),
      semester.name,
    );

    const fileName = `${semester.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.ics`;
    return new Response(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
