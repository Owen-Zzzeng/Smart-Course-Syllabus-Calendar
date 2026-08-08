'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { createSemester, type SemesterFormState } from './actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const initialState: SemesterFormState = { error: null };

export function NewSemesterForm() {
  const [state, formAction, pending] = useActionState(createSemester, initialState);

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Semester name</Label>
            <Input id="name" name="name" placeholder="Fall 2026" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">First day</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Last day</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create semester
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
