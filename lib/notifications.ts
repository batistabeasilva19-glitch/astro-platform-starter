import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * ─── Notificações por e-mail (estrutura pronta para integração) ──────────
 *
 * Fluxo: cada evento grava uma linha em `notification_outbox` (fila) e tenta
 * entregar pelo provedor configurado. Sem RESEND_API_KEY nada é enviado — o
 * evento fica "pending" na fila e você pode integrar depois (cron/worker),
 * sem mudar o restante do sistema.
 *
 * Para ativar e-mails (Resend): defina no .env / Vercel
 *   RESEND_API_KEY, NOTIFICATIONS_FROM, ADMIN_NOTIFICATION_EMAIL
 */
export type NotificationEvent = 'awaiting_approval' | 'changes_requested' | 'approved';

interface NotifyInput {
  db: SupabaseClient;
  event: NotificationEvent;
  clientId: string;
  contentId: string;
  contentTitle: string;
  clientName: string;
  /** e-mail do responsável (usado em awaiting_approval). */
  clientEmail?: string | null;
  reviewUrl?: string;
  message?: string;
}

const SUBJECTS: Record<NotificationEvent, (i: NotifyInput) => string> = {
  awaiting_approval: (i) => `Conteúdo aguardando sua aprovação: ${i.contentTitle}`,
  changes_requested: (i) => `${i.clientName} solicitou alteração: ${i.contentTitle}`,
  approved: (i) => `${i.clientName} aprovou: ${i.contentTitle}`,
};

function body(i: NotifyInput): string {
  const link = i.reviewUrl ? `<p><a href="${i.reviewUrl}">Abrir portal de aprovação</a></p>` : '';
  const msg = i.message ? `<blockquote>${escapeHtml(i.message)}</blockquote>` : '';
  return `<div style="font-family:Poppins,Arial,sans-serif;color:#282828"><h2 style="color:#771430">${escapeHtml(
    SUBJECTS[i.event](i),
  )}</h2>${msg}${link}<p style="color:#771430">✦ Soltria</p></div>`;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

/** Provedor de e-mail. Troque aqui para SES, Postmark etc. Devolve o motivo quando o provedor recusa. */
export async function sendEmailDetailed(to: string, subject: string, html: string, replyTo?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATIONS_FROM;
  if (!key || !from) return { ok: false, error: 'Envio não configurado.' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (res.ok) return { ok: true };
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, error: j?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede.' };
  }
}

export async function sendEmail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  return (await sendEmailDetailed(to, subject, html, replyTo)).ok;
}

/** Nunca lança erro: notificação não pode quebrar o fluxo de aprovação. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipient =
      input.event === 'awaiting_approval'
        ? input.clientEmail || null
        : process.env.ADMIN_NOTIFICATION_EMAIL || null;

    const { data: row } = await input.db
      .from('notification_outbox')
      .insert({
        client_id: input.clientId,
        content_id: input.contentId,
        event: input.event,
        recipient,
        payload: {
          title: input.contentTitle,
          client: input.clientName,
          reviewUrl: input.reviewUrl,
          message: input.message,
        },
      })
      .select('id')
      .single();

    if (!recipient || !row) return;
    const sent = await sendEmail(recipient, SUBJECTS[input.event](input), body(input));
    if (sent) {
      await input.db
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  } catch (err) {
    console.error('[notifications] falha ao registrar/enviar', err);
  }
}
