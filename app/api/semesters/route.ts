import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, parseBody, requireApiUser } from '@/lib/api';
import { toUtcDate } from '@/lib/dates';

const createSemesterSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: 'The semester must end after it starts.',
  });

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await parseBody(request, createSemesterSchema);

    const semester = await db.semester.create({
      data: {
        userId: user.id,
        name: body.name,
        startDate: toUtcDate(body.startDate),
        endDate: toUtcDate(body.endDate),
      },
    });

    return NextResponse.json({ semester }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const user = await requireApiUser();
    const semesters = await db.semester.findMany({
      where: { userId: user.id },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { courses: true } } },
    });
    return NextResponse.json({ semesters });
  } catch (error) {
    return handleApiError(error);
  }
}
