'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { portalLogin, type PortalKind } from '@/lib/actions/portal-auth';
import type { ActionResult } from '@/lib/actions/shared';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Fields';

export function LoginForm({ token, kind = 'portal' }: { token: string; kind?: PortalKind }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await portalLogin(kind, token, prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, null);
  return (
    <form action={action} className="mt-8 w-full max-w-sm space-y-4 text-left">
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage error={state && !state.ok ? state.error : null} />
      <Button type="submit" size="lg" loading={pending} className="w-full">Entrar</Button>
    </form>
  );
}
