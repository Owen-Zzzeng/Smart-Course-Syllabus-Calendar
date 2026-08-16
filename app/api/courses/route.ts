import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { handleApiError, notFound, parseBody, requireApiUser } from '@/lib/api';
import { pickCourseColor } from '@/lib/colors';
import { toUtcDate } from '@/lib/dates';
import { CONFIDENCE_LEVELS, EVENT_TYPES } from '@/lib/extraction-schema';

const eventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(EVENT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rawDateText: z.string().max(300).nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS),
  needsReview: z.boolean(),
  description: z.string().max(2000).nullable(),
  gradeWeight: z.number().min(0).max(100).nullable(),
});

const createCourseSchema = z.object({
  semesterId: z.string().min(1),
  syllabusId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(150),
  courseCode: z.string().trim().max(30).nullable(),
  instructor: z.string().trim().max(120).nullable(),
  gradingComponents: z.array(z.object({ name: z.string().trim().min(1).max(100), weight: z.number().min(0).max(100) })).max(30),
  events: z.array(eventSchema).max(300),
});

/**
 * Commits one reviewed extraction as a Course with its events and grading
 * components, all in a single transaction. Links the source Syllabus record
 * so raw text remains traceable to the course it produced.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await parseBody(request, createCourseSchema);

    const semester = await db.semester.findFirst({
      where: { id: body.semesterId, userId: user.id },
      include: { courses: { select: { color: true } } },
    });
    if (!semester) throw notFound('Semester');

    if (body.syllabusId) {
      const syllabus = await db.syllabus.findFirst({
        where: { id: body.syllabusId, semesterId: semester.id },
        select: { id: true },
      });
      if (!syllabus) throw notFound('Syllabus');
    }

    const color = pickCourseColor(semester.courses.map((c) => c.color));

    const course = await db.$transaction(async (tx) => {
      const created = await tx.course.create({
        data: {
          semesterId: semester.id,
          name: body.name,
          courseCode: body.courseCode,
          instructor: body.instructor,
          color,
          components: {
            create: body.gradingComponents,
          },
          events: {
            create: body.events.map((e) => ({
              title: e.title,
              type: e.type,
              date: e.date ? toUtcDate(e.date) : null,
              rawDateText: e.rawDateText,
              confidence: e.confidence,
              needsReview: e.needsReview,
              confirmed: !e.needsReview,
              description: e.description,
              gradeWeight: e.gradeWeight,
            })),
          },
        },
        include: { events: true, components: true },
      });

      if (body.syllabusId) {
        await tx.syllabus.update({
          where: { id: body.syllabusId },
          data: { courseId: created.id },
        });
      }

      return created;
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
