'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { signIn, type AuthFormState } from '@/app/auth/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: AuthFormState = { error: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Welcome</CardTitle>
        <CardDescription>
          Enter your email to sign in — an account is created automatically on first use.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@university.edu"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="name" name="name" placeholder="Vivian" autoComplete="name" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/" className="underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
