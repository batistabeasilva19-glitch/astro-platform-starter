'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signIn } from '@/lib/actions/auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Fields';

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(signIn, null);
  const next = useSearchParams().get('next') ?? '/admin';
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required placeholder="voce@soltria.com.br" />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage error={state && !state.ok ? state.error : null} />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
