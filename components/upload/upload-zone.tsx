'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExtractionPreview, ProcessingFile } from '@/types';
import { FileCard } from './file-card';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_FILES = 6;

interface UploadZoneProps {
  semesterId: string;
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/**
 * Owns the whole onboarding pipeline client-side. Each file independently
 * walks Uploading → Parsing → Extracting → Saving → Done so one bad scan
 * doesn't stall the other five syllabi.
 */
export function UploadZone({ semesterId }: UploadZoneProps) {
  const router = useRouter();
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const patch = useCallback((id: string, update: Partial<ProcessingFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...update } : f)));
  }, []);

  const processFile = useCallback(
    async (file: File, id: string) => {
      try {
        // 1. Upload + parse
        const form = new FormData();
        form.append('file', file);
        form.append('semesterId', semesterId);
        patch(id, { stage: 'uploading' });

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: form });
        if (!uploadRes.ok) throw new Error(await readError(uploadRes));
        const { syllabus } = (await uploadRes.json()) as {
          syllabus: { id: string };
        };
        patch(id, { stage: 'extracting' });

        // 2. AI extraction + validation
        const extractRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ syllabusId: syllabus.id }),
        });
        if (!extractRes.ok) throw new Error(await readError(extractRes));
        const { extraction } = (await extractRes.json()) as { extraction: ExtractionPreview };
        patch(id, { stage: 'saving', extraction });

        // 3. Persist as a course
        const courseRes = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            semesterId,
            syllabusId: syllabus.id,
            name: extraction.courseName,
            courseCode: extraction.courseCode,
            instructor: extraction.instructor,
            gradingComponents: extraction.gradingComponents,
            events: extraction.events.map(
              ({ reviewReason: _r, derivedFromWeek: _d, ...event }) => event,
            ),
          }),
        });
        if (!courseRes.ok) throw new Error(await readError(courseRes));
        const { course } = (await courseRes.json()) as { course: { id: string } };

        patch(id, { stage: 'done', courseId: course.id });
      } catch (error) {
        patch(id, {
          stage: 'error',
          error: error instanceof Error ? error.message : 'Something went wrong.',
        });
      }
    },
    [patch, semesterId],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming).filter((f) =>
        ACCEPTED_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext)),
      );
      const room = MAX_FILES - files.filter((f) => f.stage !== 'error').length;
      for (const file of list.slice(0, Math.max(0, room))) {
        const id = `file-${counter.current++}`;
        setFiles((prev) => [
          ...prev,
          { id, fileName: file.name, stage: 'uploading', error: null, courseId: null, extraction: null },
        ]);
        void processFile(file, id);
      }
    },
    [files, processFile],
  );

  const active = files.filter((f) => f.stage !== 'done' && f.stage !== 'error');
  const succeeded = files.filter((f) => f.stage === 'done');
  const needsReview = succeeded.reduce((sum, f) => sum + (f.extraction?.stats.needsReview ?? 0), 0);
  const allSettled = files.length > 0 && active.length === 0;

  return (
    <div className="space-y-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload syllabus files"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors',
          dragging ? 'border-blue-500 bg-blue-50' : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        )}
      >
        <UploadCloud className="h-10 w-10 text-muted-foreground" />
        <p className="mt-4 font-medium">Drop your syllabi here, or click to browse</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOCX, or TXT · up to {MAX_FILES} files at once
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}

      {allSettled && succeeded.length > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-6 text-center animate-fade-in">
          <p className="text-sm text-muted-foreground">
            {succeeded.length} course{succeeded.length === 1 ? '' : 's'} added
            {needsReview > 0
              ? ` — ${needsReview} item${needsReview === 1 ? '' : 's'} need${needsReview === 1 ? 's' : ''} your review.`
              : ' — every date was extracted with high confidence.'}
          </p>
          <Button
            size="lg"
            onClick={() =>
              router.push(
                needsReview > 0 ? `/semester/${semesterId}/review` : `/semester/${semesterId}`,
              )
            }
          >
            {needsReview > 0 ? 'Review & Confirm' : 'Go to my semester'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
