import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { db } from './db';
import { env } from './env';

const COOKIE_NAME = 'ssv_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Minimal signed-cookie session.
 *
 * Auth is deliberately kept behind this small module: `getCurrentUser` and
 * `requireUser` are the only things the rest of the app calls, so swapping in
 * Clerk/NextAuth later is a change to this file alone.
 */
function sign(value: string): string {
  return createHmac('sha256', env.AUTH_SECRET).update(value).digest('base64url');
}

function serialize(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx <= 0) return null;

  const userId = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = sign(userId);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, serialize(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** Deduplicated per request so multiple components can call it freely. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const userId = verify(store.get(COOKIE_NAME)?.value);
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

/** Sign-in and sign-up are the same action: email is the identity. */
export async function findOrCreateUser(email: string, name?: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  return db.user.upsert({
    where: { email: normalized },
    update: name ? { name } : {},
    create: { email: normalized, name: name?.trim() || null },
    select: { id: true, email: true, name: true },
  });
}
