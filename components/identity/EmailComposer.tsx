'use client';

import { useMemo, useState, useTransition } from 'react';
import { Copy, ExternalLink, Mail, Send } from 'lucide-react';
import { sendClientEmail } from '@/lib/actions/email';
import { STAGES, type StageKey } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export interface EmailCtx {
  clientName: string;
  clientEmail: string;
  url: string;
  stages: { stage_key: StageKey; enabled: boolean; status: string }[];
}

const TEMPLATES = [
  { id: 'awaiting', label: 'Etapa aguardando aprovação' },
  { id: 'next', label: 'Aguardando envio da próxima etapa' },
  { id: 'changes', label: 'Alteração feita — aprove novamente' },
  { id: 'approved', label: 'Etapa aprovada — agradecimento' },
  { id: 'reminder', label: 'Lembrete gentil' },
  { id: 'custom', label: 'Em branco (escrever do zero)' },
] as const;

function build(id: string, c: EmailCtx, stageLabel: string, nextLabel: string | null) {
  const hi = `Olá, ${c.clientName}! ♡\n\n`;
  const bye = '\n\nQualquer dúvida, é só me chamar por aqui.\nCom carinho,\nEquipe Soltria';
  const link = `\n\n🔗 Acesse o portal: ${c.url}`;
  switch (id) {
    case 'awaiting':
      return { subject: `${stageLabel} aguardando a sua aprovação`, text: `${hi}A etapa “${stageLabel}” já está pronta e esperando a sua aprovação. Dê uma olhada com calma e me conte o que achou — se quiser ajustar algo, é só pedir alteração pelo portal.${link}${bye}` };
    case 'next':
      return { subject: 'Próxima etapa em andamento', text: `${hi}A etapa “${stageLabel}” foi concluída e já estamos preparando ${nextLabel ? `a próxima: “${nextLabel}”` : 'a próxima etapa'}. Assim que estiver pronta, aviso você por aqui para fazer a aprovação.${link}${bye}` };
    case 'changes':
      return { subject: `Ajustes feitos em ${stageLabel}`, text: `${hi}Fiz os ajustes que você pediu na etapa “${stageLabel}”. A nova versão já está no portal para você conferir e aprovar.${link}${bye}` };
    case 'approved':
      return { subject: `${stageLabel} aprovada ♡`, text: `${hi}Obrigada por aprovar a etapa “${stageLabel}”! ${nextLabel ? `Seguimos agora para “${nextLabel}” e te aviso quando estiver pronta.` : 'Estamos quase lá!'}${link}${bye}` };
    case 'reminder':
      return { subject: `Lembrete: ${stageLabel} aguardando você`, text: `${hi}Passando para lembrar que a etapa “${stageLabel}” está aguardando a sua aprovação. Quando puder, dê uma olhada — assim seguimos com o projeto sem atrasos.${link}${bye}` };
    default:
      return { subject: '', text: `${hi}${link}${bye}` };
  }
}

/** Escreve e envia (ou copia / abre no e-mail) um aviso ao cliente. Tudo pode ser editado antes de enviar. */
export function EmailComposer({ ctx, stageKey }: { ctx: EmailCtx; stageKey: StageKey }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const stageLabel = STAGES.find((s) => s.key === stageKey)?.label ?? '';
  const nextLabel = useMemo(() => {
    const order = STAGES.map((s) => s.key);
    const i = order.indexOf(stageKey);
    const n = STAGES.slice(i + 1).find((s) => ctx.stages.some((x) => x.stage_key === s.key && x.enabled && s.approvable));
    return n?.label ?? null;
  }, [ctx.stages, stageKey]);

  const initial = (id: string) => build(id, ctx, stageLabel, nextLabel);
  const firstId = ctx.stages.find((s) => s.stage_key === stageKey)?.status === 'approved' ? 'approved' : 'awaiting';
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
              href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
              className="inline-flex items-center gap-2 rounded-full border border-wine px-4 py-2 text-sm text-wine transition hover:bg-wine hover:text-white"
            >
              <ExternalLink className="size-3.5" /> Abrir no meu e-mail
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
