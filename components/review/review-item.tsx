'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, Loader2, Quote, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EventTypeIcon } from '@/components/timeline/event-type-icon';
import type { EventDto } from '@/types';

interface ReviewItemProps {
  event: EventDto;
  color: string;
  semesterStart: string;
  semesterEnd: string;
  onResolved: () => void;
}

export function ReviewItem({ event, color, semesterStart, semesterEnd, onResolved }: ReviewItemProps) {
  const [date, setDate] = useState(event.date ?? '');
  const [busy, setBusy] = useState<'save' | 'confirm' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aiGuess = event.date ? format(parseISO(event.date), 'EEEE, MMM d, yyyy') : null;

  async function submit(kind: 'save' | 'confirm' | 'delete') {
    setBusy(kind);
    setError(null);
    try {
      const res =
        kind === 'delete'
          ? await fetch(`/api/events/${event.id}`, { method: 'DELETE' })
          : await fetch(`/api/events/${event.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(kind === 'confirm' ? { confirm: true } : { date }),
            });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Request failed.');
      }
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  return (
    <div
      className="rounded-lg border p-4 animate-fade-in"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <EventTypeIcon type={event.type} className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{event.title}</span>
        <Badge variant={event.confidence === 'LOW' ? 'destructive' : 'warning'}>
          {event.confidence.toLowerCase()} confidence
        </Badge>
        {event.gradeWeight != null && <Badge variant="outline">{event.gradeWeight}% of grade</Badge>}
      </div>

      {event.rawDateText && (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Syllabus says: <em>&ldquo;{event.rawDateText}&rdquo;</em>
          </span>
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {aiGuess ? (
          <>
            AI&apos;s guess: <span className="font-medium text-foreground">{aiGuess}</span>
          </>
        ) : (
          'The AI could not determine a date.'
        )}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={date}
          min={semesterStart}
          max={semesterEnd}
          onChange={(e) => setDate(e.target.value)}
          className="h-9 w-auto"
          aria-label={`Correct date for ${event.title}`}
        />
        <Button size="sm" onClick={() => submit('save')} disabled={!date || busy !== null}>
          {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Set date
        </Button>
        {aiGuess && (
          <Button size="sm" variant="secondary" onClick={() => submit('confirm')} disabled={busy !== null}>
            {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guess is right
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => submit('delete')}
          disabled={busy !== null}
        >
          {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Remove
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
