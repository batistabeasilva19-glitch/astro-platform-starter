'use server';

import { requireUser } from '@/lib/data/clients';
import { escapeHtml, sendEmail } from '@/lib/notifications';
import { fail, type ActionResult } from './shared';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Texto simples → HTML com a cara da Soltria (links viram clicáveis, quebras de linha preservadas). */
function toHtml(text: string) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#771430">$1</a>')
    .replace(/\n/g, '<br>');
  return `<div style="font-family:Poppins,Arial,sans-serif;color:#282828;font-size:15px;line-height:1.6;max-width:560px">${body}<p style="margin-top:28px;color:#771430">✦ Soltria</p></div>`;
}

/** E-mail escrito pela administradora (modelo editável) enviado ao cliente. */
export async function sendClientEmail(to: string, subject: string, text: string): Promise<ActionResult> {
  await requireUser();
  const dest = to.trim();
  if (!EMAIL.test(dest)) return fail('E-mail do cliente inválido.');
  if (!subject.trim() || !text.trim()) return fail('Preencha o assunto e a mensagem.');
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATIONS_FROM) {
    return fail('O envio automático ainda não está configurado (RESEND_API_KEY e NOTIFICATIONS_FROM no Vercel). Use “Abrir no meu e-mail” ou “Copiar”.');
  }
  const ok = await sendEmail(dest, subject.trim().slice(0, 200), toHtml(text.slice(0, 8000)), process.env.ADMIN_NOTIFICATION_EMAIL || undefined);
  return ok ? { ok: true } : fail('O provedor recusou o envio. Confira o remetente (NOTIFICATIONS_FROM) e a chave no Vercel.');
}
