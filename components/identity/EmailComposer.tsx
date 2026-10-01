'use client';

import { useState, useTransition } from 'react';
import { Copy, ExternalLink, Mail, Send } from 'lucide-react';
import { sendClientEmail } from '@/lib/actions/email';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export interface EmailCtx {
  clientName: string;
  clientEmail: string;
  url: string;
}

/** O que o e-mail comenta: uma etapa, uma postagem ou os conteúdos em geral. */
export interface EmailItem {
  /** Ex.: a etapa “Logo” · a postagem “Título” · os conteúdos do mês. */
  thing: string;
  /** Ex.: “Logo” · “Título” · Conteúdos (usado no assunto). */
  short: string;
  /** Próxima etapa (se houver). */
  next?: string | null;
  /** Já aprovado? (escolhe o modelo inicial) */
  approved?: boolean;
  /** Plural ("os conteúdos") muda a conjugação. */
  plural?: boolean;
}

const TEMPLATES = [
  { id: 'awaiting', label: 'Aguardando aprovação' },
  { id: 'next', label: 'Aguardando envio da próxima etapa' },
  { id: 'changes', label: 'Alteração feita — aprove novamente' },
  { id: 'approved', label: 'Aprovado — agradecimento' },
  { id: 'reminder', label: 'Lembrete gentil' },
  { id: 'access', label: 'Acesso ao portal (link, e-mail e senha)' },
  { id: 'custom', label: 'Em branco (escrever do zero)' },
] as const;

function build(id: string, c: EmailCtx, it: EmailItem) {
  const hi = `Olá, ${c.clientName}! ♡\n\n`;
  const bye = '\n\nQualquer dúvida, é só me chamar por aqui.\nCom carinho,\nEquipe Soltria';
  const link = `\n\n🔗 Acesse o portal: ${c.url}`;
  const cap = it.thing.charAt(0).toUpperCase() + it.thing.slice(1);
  const [is, are] = it.plural ? ['estão', 'estão'] : ['está', 'está'];
  switch (id) {
    case 'awaiting':
      return { subject: `${it.short}: aguardando a sua aprovação`, text: `${hi}${cap} ${is} pronto${it.plural ? 's' : ''} e esperando a sua aprovação. Dê uma olhada com calma e me conte o que achou — se quiser ajustar algo, é só pedir alteração pelo portal.${link}${bye}` };
    case 'next':
      return { subject: 'Próxima etapa em andamento', text: `${hi}${cap} ${it.plural ? 'foram concluídos' : 'foi concluída'} e já estamos preparando ${it.next ? `a próxima etapa: “${it.next}”` : 'a próxima etapa'}. Assim que estiver pronta, aviso você por aqui para fazer a aprovação.${link}${bye}` };
    case 'changes':
      return { subject: `Ajustes feitos: ${it.short}`, text: `${hi}Fiz os ajustes que você pediu em ${it.thing}. A nova versão já está no portal para você conferir e aprovar.${link}${bye}` };
    case 'approved':
      return { subject: `${it.short}: aprovado ♡`, text: `${hi}Obrigada por aprovar ${it.thing}! ${it.next ? `Seguimos agora para “${it.next}” e te aviso quando estiver pronta.` : 'Seguimos com o projeto e te aviso das próximas novidades.'}${link}${bye}` };
    case 'reminder':
      return { subject: `Lembrete: ${it.short} aguardando você`, text: `${hi}Passando para lembrar que ${it.thing} ${are} aguardando a sua aprovação. Quando puder, dê uma olhada — assim seguimos sem atrasos.${link}${bye}` };
    case 'access':
      return { subject: 'Seu acesso ao portal da Soltria', text: `${c.clientName}, esse link vai te acompanhar durante todo o nosso processo. Por ele, você poderá acessar tudo o que está sendo desenvolvido, acompanhar as informações do projeto, visualizar as alterações realizadas e fazer as aprovações de forma mais organizada.\n\n🔗 Link de acesso: ${c.url}\n📧 E-mail para login: ${c.clientEmail || '[inserir e-mail]'}\n🔒 Senha: [inserir senha]\n\nSempre que houver alguma atualização ou alteração, ela ficará registrada por aqui para você acompanhar com facilidade.\n\nGuarde esse acesso, porque será o nosso espaço principal para aprovações e acompanhamento do projeto. ✨` };
    default:
      return { subject: '', text: `${hi}${link}${bye}` };
  }
}

/** Escreve e envia (ou copia / abre no e-mail) um aviso ao cliente. Tudo pode ser editado antes de enviar. */
export function EmailComposer({ ctx, item }: { ctx: EmailCtx; item: EmailItem }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const initial = (id: string) => build(id, ctx, item);
  const firstId = item.approved ? 'approved' : 'awaiting';
  const [tpl, setTpl] = useState<string>(firstId);
  const [to, setTo] = useState(ctx.clientEmail);
  const [subject, setSubject] = useState(initial(firstId).subject);
  const [text, setText] = useState(initial(firstId).text);

  function pick(id: string) {
    setTpl(id);
    const t = initial(id);
    setSubject(t.subject);
    setText(t.text);
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" /> E-mail ao cliente
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="E-mail ao cliente" className="max-w-2xl">
        <div className="space-y-4">
          <Field label="Modelo">
            <Select value={tpl} onChange={(e) => pick(e.target.value)}>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Para"><Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@cliente.com" /></Field>
          <Field label="Assunto"><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
          <Field label="Mensagem" hint="Edite à vontade antes de enviar."><Textarea rows={11} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => navigator.clipboard.writeText(`${subject}\n\n${text}`).then(() => toast('Copiado ♡'), () => toast('Não foi possível copiar.', 'error'))}><Copy className="size-3.5" /> Copiar</Button>
            <a
              href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-wine px-4 py-2 text-sm text-wine transition hover:bg-wine hover:text-white"
            >
              <ExternalLink className="size-3.5" /> Abrir no Gmail
            </a>
            <a
              href={`mailto:${to.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-wine/80 transition hover:bg-blush"
            >
              <Mail className="size-3.5" /> Outro app de e-mail
            </a>
            <Button
              loading={pending}
              onClick={() => start(async () => {
                const r = await sendClientEmail(to, subject, text);
                if (r.ok) { toast('E-mail enviado ♡'); setOpen(false); } else toast(r.error, 'error');
              })}
            >
              <Send className="size-3.5" /> Enviar agora
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
