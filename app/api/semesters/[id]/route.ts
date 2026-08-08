import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { handleApiError, notFound, requireApiUser } from '@/lib/api';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;

    const semester = await db.semester.findFirst({
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

    if (!semester) throw notFound('Semester');
    return NextResponse.json({ semester });
  } catch (error) {
    return handleApiError(error);
  }
}
