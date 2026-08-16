import type { Confidence, EventType, ValidationWarning } from '@/lib/normalize';

/** Extraction preview as it crosses the API boundary (dates as YYYY-MM-DD strings). */
export interface ExtractionPreviewEvent {
  title: string;
  type: EventType;
  date: string | null;
  rawDateText: string | null;
  confidence: Confidence;
  needsReview: boolean;
  description: string | null;
  gradeWeight: number | null;
  reviewReason: string | null;
  derivedFromWeek: boolean;
}

export interface ExtractionPreview {
  courseName: string;
  courseCode: string | null;
  instructor: string | null;
  gradingComponents: { name: string; weight: number }[];
  events: ExtractionPreviewEvent[];
  warnings: ValidationWarning[];
  stats: {
    totalEvents: number;
    needsReview: number;
    highConfidence: number;
    weightTotal: number;
  };
}

export type FileStage = 'uploading' | 'parsing' | 'extracting' | 'saving' | 'done' | 'error';

export interface ProcessingFile {
  id: string;
  fileName: string;
  stage: FileStage;
  error: string | null;
  courseId: string | null;
  extraction: ExtractionPreview | null;
}

/** Serialized shapes used by dashboard/review server → client components. */
export interface EventDto {
  id: string;
  courseId: string;
  title: string;
  type: EventType;
  date: string | null;
  rawDateText: string | null;
  confidence: Confidence;
  needsReview: boolean;
  description: string | null;
  gradeWeight: number | null;
}

export interface CourseDto {
  id: string;
  name: string;
  courseCode: string | null;
  instructor: string | null;
  color: string;
  components: { id: string; name: string; weight: number }[];
  events: EventDto[];
}

export interface SemesterDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  courses: CourseDto[];
}
