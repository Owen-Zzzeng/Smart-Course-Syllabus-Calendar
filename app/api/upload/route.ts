import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, notFound, requireApiUser } from '@/lib/api';
import { EmptyDocumentError, parseDocument, UnsupportedFileError } from '@/lib/parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB

/**
 * Step 1 of the pipeline: accept a file, extract its raw text, persist both
 * the metadata and the text as a Syllabus record. The raw text is stored so
 * extraction can be re-run later without re-uploading.
 */
export async function POST(request: Request) {
  try {
    const user = await requireApiUser();

    const form = await request.formData();
    const file = form.get('file');
    const semesterId = form.get('semesterId');

    if (!(file instanceof File)) throw new ApiError(400, 'A "file" field is required.');
    if (typeof semesterId !== 'string' || !semesterId)
      throw new ApiError(400, 'A "semesterId" field is required.');
    if (file.size === 0) throw new ApiError(400, `"${file.name}" is empty.`);
    if (file.size > MAX_FILE_BYTES)
      throw new ApiError(413, `"${file.name}" is larger than 15MB.`);

    const semester = await db.semester.findFirst({
      where: { id: semesterId, userId: user.id },
      select: { id: true },
    });
    if (!semester) throw notFound('Semester');

    const buffer = Buffer.from(await file.arrayBuffer());

    let syllabus;
    try {
      const parsed = await parseDocument(buffer, file.name, file.type);
      syllabus = await db.syllabus.create({
        data: {
          semesterId: semester.id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          status: 'PARSED',
          rawText: parsed.text,
          likelyScanned: parsed.likelyScanned,
        },
        select: { id: true, fileName: true, status: true, likelyScanned: true },
      });
      return NextResponse.json(
        { syllabus: { ...syllabus, textLength: parsed.text.length } },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof UnsupportedFileError) throw new ApiError(415, error.message);
      if (error instanceof EmptyDocumentError) {
        // Record the failure so the user sees an honest per-file error state.
        await db.syllabus.create({
          data: {
            semesterId: semester.id,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            status: 'FAILED',
            likelyScanned: error.likelyScanned,
            error: error.message,
          },
        });
        throw new ApiError(422, error.message);
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
