import Link from 'next/link';
import { ArrowRight, CalendarRange, ScanText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';

const STEPS = [
  {
    icon: Upload,
    title: 'Upload your syllabi',
    body: 'Drop in up to six PDFs or DOCX files at once, straight from your course pages.',
  },
  {
    icon: ScanText,
    title: 'AI reads every deadline',
    body: 'Exams, assignments, quizzes, and grading weights are extracted — and anything ambiguous is flagged for you to confirm.',
  },
  {
    icon: CalendarRange,
    title: 'See your whole semester',
    body: 'One color-coded timeline across all courses, with a “this week” view you can check every Monday.',
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen flex-col">
      <header className="container flex h-16 items-center justify-between">
        <span className="font-semibold tracking-tight">Smart Syllabus Visualizer</span>
        <Button asChild variant="ghost" size="sm">
          <Link href={user ? '/dashboard' : '/sign-in'}>{user ? 'Dashboard' : 'Sign in'}</Link>
        </Button>
      </header>

      <section className="container flex flex-1 flex-col items-center justify-center py-20 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Upload your syllabi. See your entire semester in{' '}
          <span className="text-blue-600">30 seconds</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Every deadline, exam, and grading weight from all your courses — extracted by AI into one
          visual semester map.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link href={user ? '/dashboard' : '/sign-in'}>
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>

        <div className="mt-24 grid max-w-4xl gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="mt-4 text-sm font-medium text-muted-foreground">Step {i + 1}</div>
              <h3 className="mt-1 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
