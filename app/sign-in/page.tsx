import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { SignInForm } from './sign-in-form';

export default async function SignInPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <SignInForm />
    </main>
  );
}
