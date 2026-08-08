import { AppShell } from '@/components/app-shell';
import { NewSemesterForm } from './new-semester-form';

export default function NewSemesterPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">Set up your semester</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The start and end dates let the AI turn references like “Week 8” into real calendar
          dates.
        </p>
        <div className="mt-6">
          <NewSemesterForm />
        </div>
      </div>
    </AppShell>
  );
}
