'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSession, destroySession, findOrCreateUser } from '@/lib/auth';
import { db } from '@/lib/db';

const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  name: z.string().trim().max(80).optional(),
});

export interface AuthFormState {
  error: string | null;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const user = await findOrCreateUser(parsed.data.email, parsed.data.name);
  await createSession(user.id);

  // First login with no semester yet → straight into semester creation.
  const semester = await db.semester.findFirst({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
    select: { id: true },
  });

  redirect(semester ? '/dashboard' : '/semester/new');
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect('/');
}
