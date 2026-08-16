import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ApiError, handleApiError, notFound, parseBody, requireApiUser } from '@/lib/api';
import { extractSyllabus, ExtractionError } from '@/lib/ai';
import { normalizeExtraction } from '@/lib/normalize';
import { formatIsoDate } from '@/lib/dates';

export const runtime = 'nodejs';
export const maxDuration = 120;

const extractRequestSchema = z.object({
  syllabusId: z.string().min(1),
});

/**
 * Step 2 + 3 of the pipeline: run the LLM over previously parsed text, push
 * the result through the validation/normalization layer, and return the
 * normalized preview. Nothing is persisted here — the client reviews the
 * preview and commits it via POST /api/courses.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const { syllabusId } = await parseBody(request, extractRequestSchema);

    const syllabus = await db.syllabus.findFirst({
      where: { id: syllabusId, semester: { userId: user.id } },
      include: { semester: { select: { name: true, startDate: true, endDate: true } } },
    });
    if (!syllabus) throw notFound('Syllabus');
    if (!syllabus.rawText) {
      throw new ApiError(422, 'This document has no extracted text to analyze.');
    }

    try {
      const raw = await extractSyllabus({
        text: syllabus.rawText,
        semesterName: syllabus.semester.name,
        semesterStart: syllabus.semester.startDate,
        semesterEnd: syllabus.semester.endDate,
      });

      const normalized = normalizeExtraction(raw, {
        semesterStart: syllabus.semester.startDate,
        semesterEnd: syllabus.semester.endDate,
      });

      await db.syllabus.update({
        where: { id: syllabus.id },
        data: { status: 'EXTRACTED', error: null },
      });

      return NextResponse.json({
        syllabusId: syllabus.id,
        extraction: {
          ...normalized,
          events: normalized.events.map((e) => ({
            ...e,
            date: e.date ? formatIsoDate(e.date) : null,
          })),
        },
      });
    } catch (error) {
      if (error instanceof ExtractionError) {
        await db.syllabus.update({
          where: { id: syllabus.id },
          data: { status: 'FAILED', error: error.message },
        });
        throw new ApiError(502, error.message);
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
