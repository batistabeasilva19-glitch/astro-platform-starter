'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ensureProfile, requireUser } from '@/lib/data/clients';
import { seedDemo } from '@/lib/demo-seed';
import { fail, type ActionResult } from './shared';

export async function signIn(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') || '').trim();
  const password = String(fd.get('password') || '');
  const next = String(fd.get('next') || '/admin');
  if (!email || !password) return fail('Informe e-mail e senha.');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail('E-mail ou senha incorretos.');
  redirect(next.startsWith('/admin') ? next : '/admin');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function loadDemoData(): Promise<ActionResult<{ clientId: string }>> {
  const user = await requireUser();
  try {
    await ensureProfile(user);
    const { clientId } = await seedDemo(user.id);
    revalidatePath('/admin', 'layout');
    return { ok: true, clientId };
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Falha ao criar dados de demonstração.');
  }
}
