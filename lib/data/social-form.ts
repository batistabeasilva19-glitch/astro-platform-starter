import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kindOf, sanitizeAnswers, type Answers, type FormKind, type FormStatus } from '@/lib/social-form/questions';

export interface SocialFormRow {
  id: string;
  client_id: string;
  status: FormStatus;
  kind: FormKind;
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
  const kind = kindOf((data as { answers: unknown }).answers);
  return { form: { ...(data as SocialFormRow), kind, answers: sanitizeAnswers((data as { answers: unknown }).answers, kind) }, missing: false };
}
