import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, notFound, parseBody, requireApiUser } from '@/lib/api';
import { toUtcDate } from '@/lib/dates';
import { EVENT_TYPES } from '@/lib/extraction-schema';

type Params = { params: Promise<{ id: string }> };

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  gradeWeight: z.number().min(0).max(100).nullable().optional(),
  /** Set by the review flow when the user accepts the AI's suggestion as-is. */
  confirm: z.boolean().optional(),
});

async function ownedEvent(id: string, userId: string) {
  const event = await db.event.findFirst({
    where: { id, course: { semester: { userId } } },
    select: { id: true },
  });
  if (!event) throw notFound('Event');
  return event;
}

/**
 * Used by the Review & Confirm step. When a human sets or confirms a date the
 * row is promoted to HIGH confidence and leaves the review queue — but
 * `rawDateText` is never touched, so the original source stays auditable.
 */
export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await parseBody(request, updateEventSchema);

    await ownedEvent(id, user.id);

    const humanSetDate = body.date !== undefined && body.date !== null;
    const confirmed = humanSetDate || body.confirm === true;

    const event = await db.event.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.date !== undefined && { date: body.date ? toUtcDate(body.date) : null }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.gradeWeight !== undefined && { gradeWeight: body.gradeWeight }),
        ...(confirmed && { confidence: 'HIGH', needsReview: false, confirmed: true }),
      },
    });

    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await ownedEvent(id, user.id);
    await db.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
