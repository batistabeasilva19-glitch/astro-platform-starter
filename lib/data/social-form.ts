import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitizeAnswers, type Answers, type FormStatus } from '@/lib/social-form/questions';

export interface SocialFormRow {
  id: string;
  client_id: string;
  status: FormStatus;
  answers: Answers;
  sent_at: string;
  submitted_at: string | null;
  submitted_by: string | null;
}

/** Formulário do cliente (admin: via RLS; portal: via service role depois de validar o token). `missing` = falta a migration 0016. */
export async function getSocialForm(db: SupabaseClient, clientId: string): Promise<{ form: SocialFormRow | null; missing: boolean }> {
  const { data, error } = await db.from('client_social_forms').select('*').eq('client_id', clientId).maybeSingle();
  if (error) return { form: null, missing: true };
  if (!data) return { form: null, missing: false };
  return { form: { ...(data as SocialFormRow), answers: sanitizeAnswers((data as SocialFormRow).answers) }, missing: false };
}
