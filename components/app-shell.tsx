import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarRange, LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { signOut } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <CalendarRange className="h-5 w-5 text-blue-600" />
            <span className="hidden sm:inline">Smart Syllabus Visualizer</span>
            <span className="sm:hidden">SSV</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name ?? user.email}
            </span>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
