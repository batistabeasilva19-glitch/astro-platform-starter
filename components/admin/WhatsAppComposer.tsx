'use client';

import { useState } from 'react';
import { Copy, ExternalLink, MessageCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export interface WhatsAppCtx {
  clientName: string;
  /** telefone cadastrado (pode estar vazio) */
  phone: string;
  /** link direto para o item no portal do cliente */
  url: string;
}
export interface WhatsAppItem {
  /** ex.: “Título do post” (entre aspas) */
  title: string;
  /** modelo que abre selecionado */
  start?: 'done' | 'awaiting' | 'approved' | 'reminder';
}

const TEMPLATES = [
  { id: 'done', label: 'Alteração realizada — verifique' },
  { id: 'awaiting', label: 'Aguardando aprovação' },
  { id: 'approved', label: 'Aprovado — agradecimento' },
  { id: 'reminder', label: 'Lembrete gentil' },
  { id: 'custom', label: 'Em branco' },
] as const;

function build(id: string, c: WhatsAppCtx, it: WhatsAppItem) {
  const hi = `Olá, ${c.clientName}! ♡\n\n`;
  const link = c.url ? `\n\n🔗 ${c.url}` : '';
  switch (id) {
    case 'done':
      return `${hi}A alteração solicitada em “${it.title}” foi realizada. Por favor, verifique e me diga se está tudo certo.${link}`;
    case 'awaiting':
      return `${hi}“${it.title}” já está pronto e aguardando a sua aprovação. Dê uma olhada com calma e me conte o que achou.${link}`;
    case 'approved':
      return `${hi}Obrigada por aprovar “${it.title}”! Já deixo tudo organizado por aqui. ✨${link}`;
    case 'reminder':
      return `${hi}Passando para lembrar que “${it.title}” está aguardando a sua aprovação. Quando puder, dê uma olhada, assim seguimos sem atrasos.${link}`;
    default:
      return `${hi}${link}`;
  }
}

/** Número para o link do WhatsApp: só dígitos; celular/fixo brasileiro sem DDI ganha o 55. */
export function waNumber(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

/** Abre o WhatsApp Web (ou o app) na conversa do cliente com a mensagem já escrita. A mensagem pode ser editada. */
export function WhatsAppComposer({ ctx, item, label = 'WhatsApp' }: { ctx: WhatsAppCtx; item: WhatsAppItem; label?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const first = item.start ?? 'done';
  const [tpl, setTpl] = useState<string>(first);
  const [phone, setPhone] = useState(ctx.phone);
  const [text, setText] = useState(build(first, ctx, item));
  const num = waNumber(phone);
  const q = encodeURIComponent(text);
  // com número: abre direto a conversa; sem número: o WhatsApp pede para escolher o contato
  const web = num ? `https://web.whatsapp.com/send?phone=${num}&text=${q}` : `https://web.whatsapp.com/send?text=${q}`;
  const app = num ? `https://wa.me/${num}?text=${q}` : `https://wa.me/?text=${q}`;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <MessageCircle className="size-3.5" /> {label}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Avisar no WhatsApp" className="max-w-2xl">
        <div className="space-y-4">
          <Field label="Modelo">
            <Select value={tpl} onChange={(e) => { setTpl(e.target.value); setText(build(e.target.value, ctx, item)); }}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="WhatsApp do cliente" hint={num ? `Abre a conversa com +${num}.` : 'Sem número, o WhatsApp deixa você escolher o contato. Cadastre em “Editar cliente” para abrir direto.'}>
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Mensagem" hint="Edite à vontade antes de abrir o WhatsApp."><Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => navigator.clipboard.writeText(text).then(() => toast('Mensagem copiada ♡'), () => toast('Não foi possível copiar.', 'error'))}><Copy className="size-3.5" /> Copiar</Button>
            <a href={app} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-wine/80 transition hover:bg-blush"><Smartphone className="size-3.5" /> Abrir no celular</a>
            <a href={web} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-wine px-5 py-2 text-sm text-white transition hover:bg-wine/90"><ExternalLink className="size-3.5" /> Abrir no WhatsApp Web</a>
          </div>
        </div>
      </Modal>
    </>
  );
}
