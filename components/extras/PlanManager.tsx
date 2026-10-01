'use client';

import { RichTextarea } from '@/components/ui/RichText';
import { useState } from 'react';
import { ArrowDownUp, ExternalLink, Pencil, Plus, RotateCcw, Send, Trash2, Undo2 } from 'lucide-react';
import { createPlan, deletePlan, deletePlanItem, movePlanItem, resetPlanItem, savePlanItem, sendPlan, sortPlanByDate, unsendPlan, updatePlan } from '@/lib/actions/extras';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { FORMAT_LABEL, ITEM_STATUS_LABEL, PLAN_FORMATS, PLAN_STATUS_LABEL, monthKey, monthTitle, shortDate, type PlanFormat, type PlanItemRow, type PlanRow } from '@/lib/extras/types';
import { Chip, OrderControls, useAct } from './shared';

type Plan = PlanRow & { items: PlanItemRow[] };
interface ContentOpt { id: string; title: string; format: string; date: string | null }
const ITEM_CHIP = { pending: 'bg-ink/5 text-ink/60', approved: 'bg-emerald-100 text-emerald-800', changes_requested: 'bg-red-100 text-red-700' } as const;
const QUICK: PlanFormat[] = ['post', 'carousel', 'reel', 'video'];

/**
 * Calendário do mês para aprovação (mesmo jeito do Roteiro de vídeos): botões para adicionar Post, Carrossel, Reel
 * ou Vídeo na ordem de entrega; o cliente aprova, pede ajuste e comenta em cada item.
 */
export function PlanManager({ clientId, plans, thumbs, contents }: { clientId: string; plans: Plan[]; thumbs: Record<string, string>; contents: ContentOpt[] }) {
  const [month, setMonth] = useState(plans[0] ? monthKey(plans[0].month) : new Date().toISOString().slice(0, 7));
  const plan = plans.find((p) => monthKey(p.month) === month);
  const [edit, setEdit] = useState<{ item: PlanItemRow | null; format: PlanFormat } | null>(null);
  const { act, pending } = useAct();
  const decided = plan ? plan.items.filter((i) => i.client_status !== 'pending').length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="!w-auto" aria-label="Mês" />
        {plans.filter((p) => monthKey(p.month) !== month).slice(0, 5).map((p) => <button key={p.id} onClick={() => setMonth(monthKey(p.month))} className="rounded-full border border-wine/25 px-3 py-1.5 text-xs text-wine hover:bg-blush">{monthTitle(p.month)}</button>)}
      </div>

      <div className="space-y-3">
        <p className="text-sm text-ink/60">Adicione o que será publicado <strong className="font-normal text-wine">na ordem de entrega</strong>. Em cada item, o cliente aprova, pede ajuste ou deixa considerações.</p>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((f) => <Button key={f} onClick={() => setEdit({ item: null, format: f })}><Plus className="size-4" /> {f === 'carousel' ? 'Carrossel' : FORMAT_LABEL[f]}</Button>)}
          {plan && plan.items.length > 1 && <Button variant="outline" loading={pending} onClick={() => act(() => sortPlanByDate(plan.id), 'Ordenado por data ♡')}><ArrowDownUp className="size-4" /> Ordenar por data</Button>}
        </div>
      </div>

      {plan && (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="h-display text-2xl text-wine">{monthTitle(plan.month)}</h2>
          <Chip className={plan.status === 'approved' ? 'bg-wine text-white' : plan.status === 'changes_requested' ? 'bg-red-100 text-red-700' : 'bg-blush text-wine'}>{PLAN_STATUS_LABEL[plan.status].admin}</Chip>
          {plan.visible && <span className="text-xs text-ink/50">{decided}/{plan.items.length} decididos pelo cliente</span>}
          {plan.status === 'approved' && plan.approved_by && <span className="text-xs text-ink/50">aprovado por {plan.approved_by}</span>}
        </div>
      )}

      {!plan || plan.items.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum item em {monthTitle(`${month}-01`)}. Use os botões acima para adicionar posts, carrosséis, Reels ou vídeos.</p>
      ) : (
        <ul className="space-y-3">
          {plan.items.map((it, i) => (
            <li key={it.id} className="card flex gap-3 p-4">
              <OrderControls n={i + 1} first={i === 0} last={i === plan.items.length - 1} disabled={pending} onUp={() => act(() => movePlanItem(it.id, -1))} onDown={() => act(() => movePlanItem(it.id, 1))} />
              {it.content_id && thumbs[it.content_id] && (
                <img src={thumbs[it.content_id]} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Chip className="bg-wine text-white">{FORMAT_LABEL[it.format]}</Chip>{it.publish_date && <span className="text-xs text-ink/55">{shortDate(it.publish_date)}</span>}{plan.visible && <Chip className={ITEM_CHIP[it.client_status]}>{ITEM_STATUS_LABEL[it.client_status]}</Chip>}</div>
                <p className="mt-1 text-base text-ink">{it.title}</p>
                {it.description && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-ink/60">{it.description}</p>}
                {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-wine underline-offset-4 hover:underline">Arte / pasta <ExternalLink className="size-3" /></a>}
                {it.client_note && <p className={`mt-2 rounded-xl px-3 py-2 text-sm ${it.client_status === 'changes_requested' ? 'bg-red-50 text-red-800' : 'bg-blush text-wine'}`}><span className="label mr-1 text-[0.6rem]">Cliente:</span>“{it.client_note}”</p>}
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button aria-label="Editar" onClick={() => setEdit({ item: it, format: it.format })} className="rounded-full p-2 text-wine hover:bg-blush"><Pencil className="size-4" /></button>
                {it.client_status !== 'pending' && <button aria-label="Voltar para aguardando" title="Voltar para aguardando" onClick={() => act(() => resetPlanItem(it.id), 'Voltou para aguardando')} className="rounded-full p-2 text-wine hover:bg-blush"><RotateCcw className="size-4" /></button>}
                <button aria-label="Excluir" onClick={() => confirm(`Excluir “${it.title}”?`) && act(() => deletePlanItem(it.id), 'Item excluído')} className="rounded-full p-2 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {plan && (
        <section className="card space-y-4 p-5">
          <h3 className="h-display text-xl text-wine">Enviar para o cliente</h3>
          <PlanNote plan={plan} />
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => act(() => sendPlan(plan.id), plan.visible ? 'Atualizado para o cliente ♡' : 'Enviado para aprovação ♡')}><Send className="size-4" /> {plan.visible ? 'Atualizar envio' : 'Enviar para aprovação'}</Button>
            {plan.visible && <Button variant="outline" loading={pending} onClick={() => confirm('Voltar para rascunho? O cliente deixa de ver este calendário.') && act(() => unsendPlan(plan.id), 'Voltou para rascunho')}><Undo2 className="size-4" /> Tirar do ar</Button>}
            <Button variant="danger" onClick={() => confirm('Excluir este calendário e todos os itens?') && act(() => deletePlan(plan.id), 'Calendário excluído')}><Trash2 className="size-4" /> Excluir</Button>
          </div>
          {!plan.visible && <p className="text-xs text-ink/50">Enquanto não enviar, o cliente não vê nada deste calendário.</p>}
        </section>
      )}
      {edit && <ItemForm key={edit.item?.id ?? `new-${edit.format}`} clientId={clientId} month={month} plan={plan ?? null} item={edit.item} defaultFormat={edit.format} contents={contents} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PlanNote({ plan }: { plan: Plan }) {
  const [v, setV] = useState(plan.note);
  const { act } = useAct();
  return (
    <Field label="Recado para o cliente (opcional)">
      <Textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== plan.note && act(() => updatePlan(plan.id, { note: v }), 'Recado salvo ♡')} placeholder="Ex.: Olá! Segue o planejamento de outubro. Me avise o que quiser ajustar." />
    </Field>
  );
}

function ItemForm({ clientId, month, plan, item, defaultFormat, contents, onClose }: { clientId: string; month: string; plan: Plan | null; item: PlanItemRow | null; defaultFormat: PlanFormat; contents: ContentOpt[]; onClose: () => void }) {
  const [f, setF] = useState({ format: item?.format ?? defaultFormat, title: item?.title ?? '', publish_date: item?.publish_date ?? '', description: item?.description ?? '', link: item?.link ?? '', content_id: item?.content_id ?? '' });
  const [error, setError] = useState<string | null>(null);
  const { act, pending } = useAct();
  const options = contents.filter((c) => c.format === f.format || (f.format === 'video' && c.format === 'reel'));
  return (
    <Modal open onClose={onClose} title={item ? 'Editar item' : `Novo ${FORMAT_LABEL[f.format].toLowerCase()} para aprovação`} className="sm:!max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato"><Select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value as PlanFormat, content_id: '' })}>{PLAN_FORMATS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
          <Field label="Data de publicação (opcional)"><Input type="date" value={f.publish_date} onChange={(e) => setF({ ...f, publish_date: e.target.value })} /></Field>
        </div>
        <Field label="Título / tema"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Carrossel — 5 sinais de pele desidratada" maxLength={200} /></Field>
        <Field label="Descrição / ideia / legenda (opcional)"><RichTextarea rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Link da arte (opcional)" hint="Drive, Canva, Figma… O cliente abre para ver a arte antes de aprovar."><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" inputMode="url" /></Field>
        <Field label="Mostrar a arte de um conteúdo já cadastrado (opcional)" hint="O cliente vê a miniatura da arte junto com o item.">
          <Select value={f.content_id} onChange={(e) => setF({ ...f, content_id: e.target.value })}><option value="">Sem arte</option>{options.map((c) => <option key={c.id} value={c.id}>{c.title}{c.date ? ` · ${shortDate(c.date)}` : ''}</option>)}</Select>
        </Field>
        {item && item.client_status !== 'pending' && plan?.visible && <p className="rounded-2xl bg-blush px-4 py-3 text-xs text-wine">Se você mudar o conteúdo deste item, ele volta para “Aguardando” e o cliente decide de novo.</p>}
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button loading={pending} disabled={!f.title.trim()} onClick={() => act(async () => {
            // o calendário do mês é criado sozinho no primeiro item
            let planId = plan?.id;
            if (!planId) {
              const c = await createPlan(clientId, month);
              if (!c.ok) { setError(c.error); return c; }
              planId = c.id;
            }
            const r = await savePlanItem({ id: item?.id, planId, ...f, content_id: f.content_id || null });
            if (!r.ok) setError(r.error);
            return r;
          }, 'Item salvo ♡', onClose)}>Salvar item</Button>
        </div>
      </div>
    </Modal>
  );
}
