'use client';

import { AlertTriangle, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FileStage, ProcessingFile } from '@/types';

const STAGE_LABEL: Record<FileStage, string> = {
  uploading: 'Uploading…',
  parsing: 'Parsing document…',
  extracting: 'Extracting deadlines with AI…',
  saving: 'Saving course…',
  done: 'Done',
  error: 'Failed',
};

const STAGE_ORDER: FileStage[] = ['uploading', 'parsing', 'extracting', 'saving', 'done'];

export function FileCard({ file }: { file: ProcessingFile }) {
  const inProgress = file.stage !== 'done' && file.stage !== 'error';
  const progress =
    file.stage === 'error'
      ? 0
      : ((STAGE_ORDER.indexOf(file.stage) + 1) / STAGE_ORDER.length) * 100;

  return (
    <div className="rounded-lg border p-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            file.stage === 'done' && 'bg-emerald-50 text-emerald-600',
            file.stage === 'error' && 'bg-red-50 text-red-600',
            inProgress && 'bg-blue-50 text-blue-600',
          )}
        >
          {file.stage === 'done' ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : file.stage === 'error' ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.fileName}</p>
          <p className={cn('text-xs', file.stage === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
            {file.stage === 'error' ? file.error : STAGE_LABEL[file.stage]}
          </p>
        </div>

        {inProgress && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {inProgress && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {file.stage === 'done' && file.extraction && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-sm font-medium">{file.extraction.courseName}</span>
          {file.extraction.courseCode && (
            <Badge variant="outline">{file.extraction.courseCode}</Badge>
          )}
          <Badge variant="secondary">{file.extraction.stats.totalEvents} events</Badge>
          {file.extraction.stats.needsReview > 0 ? (
            <Badge variant="warning">{file.extraction.stats.needsReview} need review</Badge>
          ) : (
            <Badge variant="success">all dates confident</Badge>
          )}
          {file.extraction.warnings.map((w) => (
            <span key={w.code + w.message} className="w-full text-xs text-amber-700">
              ⚠ {w.message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
