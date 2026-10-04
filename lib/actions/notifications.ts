'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/data/clients';

/** Marca tudo como lido neste navegador (guarda a hora da visita num cookie de 1 ano). */
export async function markNotificationsRead(): Promise<{ ok: true }> {
  await requireUser();
  (await cookies()).set('notif_seen', new Date().toISOString(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 365 * 86_400 });
  revalidatePath('/admin', 'layout');
  return { ok: true };
}
