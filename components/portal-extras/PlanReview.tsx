'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ExternalLink, MessageSquare, Pencil, Undo2 } from 'lucide-react';
import { approveWholePlan, commentPlanItem, decidePlanItem } from '@/lib/actions/extras-portal';
import { Button } from '@/components/ui/Button';
import { FormMessage, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { FORMAT_LABEL, ITEM_STATUS_LABEL, PLAN_STATUS_LABEL, monthKey, monthTitle, shortDate, type PlanItemRow, type PlanRow } from '@/lib/extras/types';
import { cn } from '@/lib/utils';

type Plan = PlanRow & { items: PlanItemRow[] };

/** Calendário do mês para aprovar: itens em ordem, aprovar cada um (ou tudo de uma vez) ou pedir alteração. */
export function PlanReview({ token, plans, thumbs }: { token: string; plans: Plan[]; thumbs: Record<string, string> }) {
  const [month, setMonth] = useState(monthKey(plans[0].month));
  const plan = plans.find((p) => monthKey(p.month) === month) ?? plans[0];
  const [change, setChange] = useState<PlanItemRow | null>(null);
  const [comment, setComment] = useState<PlanItemRow | null>(null);
  const [note, setNote] = useState('');
  const [all, setAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) return setError(r.error ?? 'Não foi possível concluir.');
      toast(msg);
      after?.();
      router.refresh();
    });
  const approved = plan.items.filter((i) => i.client_status === 'approved').length;
  const pendingCount = plan.items.length - approved;

  return (
    <div>
      {plans.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1">
          {plans.map((p) => <button key={p.id} onClick={() => setMonth(monthKey(p.month))} className={cn('shrink-0 rounded-full border px-4 py-2 text-[0.82rem] transition', monthKey(p.month) === month ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{monthTitle(p.month)}</button>)}
        </div>
      )}
      <section className="card mb-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="h-display text-3xl text-wine">{monthTitle(plan.month)}</h2>
          <span className={cn('rounded-full px-3 py-1 text-xs', plan.status === 'approved' ? 'bg-wine text-white' : plan.status === 'changes_requested' ? 'border border-dashed border-wine text-wine' : 'bg-blush text-wine')}>{PLAN_STATUS_LABEL[plan.status].client}</span>
        </div>
        {plan.note && <p className="mt-3 whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/75">{plan.note}</p>}
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-ink/55"><span>{approved} de {plan.items.length} aprovados</span>{plan.status === 'approved' && plan.approved_by && <span>Aprovado por {plan.approved_by}</span>}</div>
          <div className="h-2 overflow-hidden rounded-full bg-blush"><div className="h-full rounded-full bg-wine transition-all" style={{ width: `${plan.items.length ? (approved / plan.items.length) * 100 : 0}%` }} /></div>
        </div>
        {pendingCount > 0 && <Button size="lg" className="mt-5 !tracking-[0.08em] max-sm:w-full max-sm:!text-[0.8rem]" onClick={() => setAll(true)}><Check className="size-4" /> Aprovar calendário completo</Button>}
      </section>

      <FormMessage error={error} />
      <ol className="mt-2 space-y-4">
        {plan.items.map((it, i) => (
          <li key={it.id} className={cn('card p-4 sm:p-5', it.client_status === 'approved' && 'border-wine/40', it.client_status === 'changes_requested' && 'border-dashed !border-wine')}>
            <div className="flex gap-4">
              <span className="h-display flex size-10 shrink-0 items-center justify-center rounded-full bg-wine text-lg text-white">{i + 1}</span>
              {it.content_id && thumbs[it.content_id] && (
                <img src={thumbs[it.content_id]} alt="" loading="lazy" className="size-20 shrink-0 rounded-2xl object-cover sm:size-24" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blush px-3 py-0.5 text-xs text-wine">{FORMAT_LABEL[it.format]}</span>
                  {it.publish_date && <span className="text-xs text-ink/55">{shortDate(it.publish_date)}</span>}
                  {it.client_status !== 'pending' && <span className={cn('rounded-full px-3 py-0.5 text-xs', it.client_status === 'approved' ? 'bg-wine text-white' : 'border border-dashed border-wine text-wine')}>{ITEM_STATUS_LABEL[it.client_status]}</span>}
                </div>
                <h3 className="mt-1 text-[1.05rem] leading-snug text-ink">{it.title}</h3>
                {it.description && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink/65">{it.description}</p>}
                {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-wine underline-offset-4 hover:underline">Ver arte <ExternalLink className="size-3.5" /></a>}
                {it.client_note && <p className="mt-2 rounded-xl bg-blush px-3 py-2 text-sm text-wine"><span className="label mr-1 text-[0.6rem]">Sua consideração:</span>“{it.client_note}”</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 sm:pl-14">
              {it.client_status === 'pending' ? (
                <>
                  <Button size="sm" loading={pending} onClick={() => run(() => decidePlanItem(token, it.id, 'approved'), 'Aprovado ♡')}><Check className="size-3.5" /> Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setChange(it); setNote(it.client_note); setError(null); }}><Pencil className="size-3.5" /> Pedir ajuste</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => decidePlanItem(token, it.id, 'pending'), 'Decisão desfeita')}><Undo2 className="size-3.5" /> Mudar minha decisão</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setComment(it); setNote(it.client_note); setError(null); }}><MessageSquare className="size-3.5" /> {it.client_note ? 'Editar consideração' : 'Deixar consideração'}</Button>
            </div>
          </li>
        ))}
      </ol>

      {change && (
        <Modal open onClose={() => setChange(null)} title="Pedir ajuste">
          <p className="mb-3 text-sm text-ink/65">{change.title}</p>
          <Textarea autoFocus rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que você gostaria de ajustar?" />
          <div className="mt-3"><FormMessage error={error} /></div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setChange(null)}>Voltar</Button>
            <Button loading={pending} disabled={!note.trim()} onClick={() => run(() => decidePlanItem(token, change.id, 'changes_requested', note), 'Pedido de ajuste enviado. Obrigada! ♡', () => setChange(null))}>Enviar pedido</Button>
          </div>
        </Modal>
      )}
      {comment && (
        <Modal open onClose={() => setComment(null)} title="Sua consideração">
          <p className="mb-3 text-sm text-ink/65">{comment.title}</p>
          <Textarea autoFocus rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escreva aqui o que quiser comentar sobre este item…" />
          <div className="mt-3"><FormMessage error={error} /></div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setComment(null)}>Voltar</Button>
            <Button loading={pending} onClick={() => run(() => commentPlanItem(token, comment.id, note), 'Consideração salva ♡', () => setComment(null))}>Salvar</Button>
          </div>
        </Modal>
      )}
      {all && (
        <Modal open onClose={() => setAll(false)} title="Aprovar calendário completo">
          <p className="mb-2 text-[0.95rem]">Tem certeza que deseja aprovar todos os {plan.items.length} itens de {monthTitle(plan.month)}?</p>
          <p className="mb-6 text-sm text-ink/60">Você ainda pode mudar a decisão de um item depois.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setAll(false)}>Voltar</Button>
            <Button loading={pending} onClick={() => run(() => approveWholePlan(token, plan.id), 'Calendário aprovado ♡', () => setAll(false))}><Check className="size-4" /> Sim, aprovar tudo</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
