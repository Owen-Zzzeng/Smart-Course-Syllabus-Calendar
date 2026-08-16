import {
  AlertCircle,
  BookOpen,
  Calendar,
  FileText,
  HelpCircle,
  Layers,
  type LucideIcon,
} from 'lucide-react';
import type { EventType } from '@/lib/normalize';

export const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  EXAM: AlertCircle,
  ASSIGNMENT: FileText,
  QUIZ: HelpCircle,
  PROJECT: Layers,
  READING: BookOpen,
  OTHER: Calendar,
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  EXAM: 'Exam',
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  PROJECT: 'Project',
  READING: 'Reading',
  OTHER: 'Other',
};

export function EventTypeIcon({ type, className }: { type: EventType; className?: string }) {
  const Icon = EVENT_TYPE_ICONS[type] ?? Calendar;
  return <Icon className={className} aria-label={EVENT_TYPE_LABELS[type]} />;
}
