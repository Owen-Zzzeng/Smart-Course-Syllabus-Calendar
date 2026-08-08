'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { toUtcDate } from '@/lib/dates';

const semesterSchema = z
  .object({
    name: z.string().trim().min(1, 'Give your semester a name.').max(80),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date.'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick an end date.'),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: 'The semester must end after it starts.',
    path: ['endDate'],
  });

export interface SemesterFormState {
  error: string | null;
}

export async function createSemester(
  _prev: SemesterFormState,
  formData: FormData,
): Promise<SemesterFormState> {
  const user = await requireUser();

  const parsed = semesterSchema.safeParse({
    name: formData.get('name'),
    startDate: formData.get('startDate'),
    endDate: formData.get('endDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const semester = await db.semester.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      startDate: toUtcDate(parsed.data.startDate),
      endDate: toUtcDate(parsed.data.endDate),
    },
    select: { id: true },
  });

  redirect(`/semester/${semester.id}/upload`);
}
