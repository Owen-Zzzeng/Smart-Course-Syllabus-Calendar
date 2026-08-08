import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';
import { getCurrentUser, type SessionUser } from './auth';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function unauthorized(): ApiError {
  return new ApiError(401, 'You must be signed in.');
}

export function notFound(entity = 'Resource'): ApiError {
  return new ApiError(404, `${entity} not found.`);
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new ApiError(400, `Invalid request: ${detail}`);
  }
  return result.data;
}

/**
 * Wraps a route handler so every failure mode maps to a consistent
 * `{ error }` JSON body instead of leaking stack traces.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Validation failed.' }, { status: 400 });
  }
  console.error('[api] unhandled error:', error);
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return NextResponse.json({ error: message }, { status: 500 });
}
