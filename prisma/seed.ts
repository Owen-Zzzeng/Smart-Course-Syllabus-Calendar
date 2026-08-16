/**
 * Seeds a demo user with one semester and two courses processed through the
 * real pipeline (mock extractor → normalization), so the dashboard, review
 * queue, and export all have realistic data.
 *
 * Run: npm run db:seed
 * Sign in afterwards as demo@student.edu
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { pickCourseColor } from '../lib/colors';
import { toUtcDate } from '../lib/dates';
import { mockExtract } from '../lib/mock-extractor';
import { normalizeExtraction } from '../lib/normalize';

const db = new PrismaClient();

const SEMESTER = {
  name: 'Fall 2026',
  startDate: toUtcDate('2026-09-08'),
  endDate: toUtcDate('2026-12-18'),
};

const SYLLABI = ['cs348-syllabus.txt', 'psych101-syllabus.txt'];

async function main() {
  const user = await db.user.upsert({
    where: { email: 'demo@student.edu' },
    update: {},
    create: { email: 'demo@student.edu', name: 'Demo Student' },
  });

  // Idempotent: wipe the demo user's previous seed data.
  await db.semester.deleteMany({ where: { userId: user.id } });

  const semester = await db.semester.create({
    data: { userId: user.id, ...SEMESTER },
  });

  const usedColors: string[] = [];

  for (const file of SYLLABI) {
    const text = readFileSync(join(__dirname, '..', 'tests', 'fixtures', file), 'utf8');
    const raw = mockExtract({
      text,
      semesterStart: SEMESTER.startDate,
      semesterEnd: SEMESTER.endDate,
    });
    const normalized = normalizeExtraction(raw, {
      semesterStart: SEMESTER.startDate,
      semesterEnd: SEMESTER.endDate,
    });

    const color = pickCourseColor(usedColors);
    usedColors.push(color);

    const course = await db.course.create({
      data: {
        semesterId: semester.id,
        name: normalized.courseName,
        courseCode: normalized.courseCode,
        instructor: normalized.instructor,
        color,
        components: { create: normalized.gradingComponents },
        events: {
          create: normalized.events.map((e) => ({
            title: e.title,
            type: e.type,
            date: e.date,
            rawDateText: e.rawDateText,
            confidence: e.confidence,
            needsReview: e.needsReview,
            confirmed: !e.needsReview,
            description: e.description,
            gradeWeight: e.gradeWeight,
          })),
        },
      },
    });

    await db.syllabus.create({
      data: {
        semesterId: semester.id,
        courseId: course.id,
        fileName: file,
        mimeType: 'text/plain',
        status: 'EXTRACTED',
        rawText: text,
      },
    });

    console.log(
      `Seeded ${normalized.courseName}: ${normalized.stats.totalEvents} events (${normalized.stats.needsReview} need review)`,
    );
  }

  console.log('\nDone. Sign in as demo@student.edu');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
