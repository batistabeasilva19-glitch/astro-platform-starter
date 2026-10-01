'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteCampaign, deleteCampaignMetrics, saveCampaign, saveCampaignMetrics, setCampaignContents, setMonthPaid } from '@/lib/actions/perf';
import { fmtInt, fmtMoney, fmtPct, fmtRatio, monthLabel, monthStart, paidTotals, todayBR } from '@/lib/perf/calc';
import { CAMPAIGN_STATUS, CAMPAIGN_STATUS_LABEL, PAID_FIELDS, PLATFORMS, PLATFORM_LABEL, type CampaignContentRow, type CampaignMetricRow, type CampaignRow, type ContentLite, type MonthConfigRow } from '@/lib/perf/types';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtDate } from '@/lib/utils';
import { MetricGroup, NotesField, SourceFields, toStrings } from './forms';

interface Props {
  clientId: string;
  campaigns: CampaignRow[];
  metrics: CampaignMetricRow[];
  links: CampaignContentRow[];
  contents: ContentLite[];
  months: MonthConfigRow[];
}

/** Área OPCIONAL de tráfego pago: configuração do mês, campanhas, métricas mensais e criativos (conteúdos do sistema). */
export function PaidManager({ clientId, campaigns, metrics, links, contents, months }: Props) {
  const [month, setMonth] = useState(todayBR().slice(0, 7));
  const [camp, setCamp] = useState<CampaignRow | 'new' | null>(null);
  const [metric, setMetric] = useState<{ campaign: CampaignRow; row: CampaignMetricRow | null } | null>(null);
  const [linking, setLinking] = useState<CampaignRow | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const cfg = months.find((m) => m.month === `${month}-01`);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Erro', 'error');
      toast(msg);
      router.refresh();
    });

  return (
    <div className="space-y-8">
      <section className="card p-5 sm:p-6">
        <h2 className="h-display text-2xl text-wine">Usou tráfego pago neste mês?</h2>
        <p className="mt-1 text-sm text-ink/60">Se marcar “Não”, a seção de tráfego pago não aparece no painel nem no relatório daquele mês. Se marcar “Sim”, todos os campos ficam ativos.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="!w-auto" aria-label="Mês" />
          {(['yes', 'no'] as const).map((k) => {
            const on = k === 'yes' ? cfg?.uses_paid === true : cfg?.uses_paid === false;
            return (
              <button key={k} type="button" disabled={pending} onClick={() => run(() => setMonthPaid(clientId, monthStart(`${month}-01`), k === 'yes'), k === 'yes' ? 'Tráfego pago ativado neste mês' : 'Tráfego pago desativado neste mês')} className={cn('rounded-full border px-5 py-2 text-sm transition', on ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
                {k === 'yes' ? 'Sim' : 'Não'}
              </button>
            );
          })}
          <span className="text-xs text-ink/50">{cfg ? `${monthLabel(`${month}-01`)}: ${cfg.uses_paid ? 'com tráfego pago' : 'sem tráfego pago'}` : 'Sem definição: aparece se houver números cadastrados.'}</span>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="h-display text-3xl text-wine">Campanhas</h2>
          <Button onClick={() => setCamp('new')}><Plus className="size-4" /> Nova campanha</Button>
        </div>
        {campaigns.length === 0 ? (
          <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhuma campanha cadastrada.</p>
        ) : (
          <ul className="space-y-4">
            {campaigns.map((c) => {
              const rows = metrics.filter((m) => m.campaign_id === c.id).sort((a, b) => b.month.localeCompare(a.month));
              const linked = links.filter((l) => l.campaign_id === c.id).map((l) => contents.find((x) => x.id === l.content_id)).filter(Boolean) as ContentLite[];
              return (
                <li key={c.id} className="card p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 basis-60">
                      <p className="text-base text-ink">{c.name}</p>
                      <p className="mt-0.5 text-xs text-ink/55">{PLATFORM_LABEL[c.platform]} · {CAMPAIGN_STATUS_LABEL[c.status]}{c.objective ? ` · ${c.objective}` : ''}{c.start_date ? ` · ${fmtDate(c.start_date, true)}${c.end_date ? ` a ${fmtDate(c.end_date, true)}` : ''}` : ''}</p>
                      {(c.budget != null || c.spent != null) && <p className="mt-0.5 text-xs text-ink/55">Orçamento {fmtMoney(c.budget)} · Gasto {fmtMoney(c.spent)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button aria-label="Conteúdos da campanha" title="Conteúdos (criativos)" onClick={() => setLinking(c)} className="rounded-full p-2 text-wine transition hover:bg-blush"><Link2 className="size-4" /></button>
                      <button aria-label="Editar campanha" onClick={() => setCamp(c)} className="rounded-full p-2 text-wine transition hover:bg-blush"><Pencil className="size-4" /></button>
                      <button aria-label="Excluir campanha" onClick={() => confirm(`Excluir “${c.name}” e todos os seus resultados?`) && run(() => deleteCampaign(c.id), 'Campanha excluída')} className="rounded-full p-2 text-wine transition hover:bg-blush"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                  {linked.length > 0 && <p className="mt-3 text-xs text-ink/60">Criativos: {linked.map((l) => l.title).join(' · ')}</p>}
                  <div className="mt-4 space-y-2">
                    {rows.map((r) => {
                      const t = paidTotals([r.metrics]);
                      return (
                        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-blush-soft px-4 py-2.5 text-xs text-ink/70">
                          <span className="text-sm text-wine">{monthLabel(r.month)}</span>
                          <span>Invest. {fmtMoney(t.investment)} · Cliques {fmtInt(t.clicks)} · CTR {fmtPct(t.ctr)} · CPC {fmtMoney(t.cpc)} · Leads {fmtInt(t.leads)} · CPL {fmtMoney(t.cpl)} · Conv. {fmtInt(t.conversions)} · ROAS {fmtRatio(t.roas)}</span>
                          <span className="ml-auto flex gap-1">
                            <button aria-label="Editar resultado" onClick={() => setMetric({ campaign: c, row: r })} className="rounded-full p-1.5 text-wine hover:bg-blush"><Pencil className="size-3.5" /></button>
                            <button aria-label="Excluir resultado" onClick={() => confirm('Excluir o resultado deste mês?') && run(() => deleteCampaignMetrics(r.id), 'Resultado excluído')} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-3.5" /></button>
                          </span>
                        </div>
                      );
                    })}
                    <Button variant="soft" size="sm" onClick={() => setMetric({ campaign: c, row: null })}><Plus className="size-3.5" /> Resultado do mês</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {camp && <CampaignForm key={camp === 'new' ? 'new' : camp.id} clientId={clientId} campaign={camp === 'new' ? null : camp} onClose={() => setCamp(null)} />}
      {metric && <CampaignMetricsForm key={`${metric.campaign.id}-${metric.row?.id ?? 'new'}`} campaign={metric.campaign} row={metric.row} onClose={() => setMetric(null)} />}
      {linking && <LinkContents key={linking.id} campaign={linking} contents={contents} selected={links.filter((l) => l.campaign_id === linking.id).map((l) => l.content_id)} onClose={() => setLinking(null)} />}
    </div>
  );
}

function CampaignForm({ clientId, campaign, onClose }: { clientId: string; campaign: CampaignRow | null; onClose: () => void }) {
  const [f, setF] = useState({ name: campaign?.name ?? '', platform: campaign?.platform ?? 'meta', objective: campaign?.objective ?? '', start_date: campaign?.start_date ?? '', end_date: campaign?.end_date ?? '', budget: campaign?.budget != null ? String(campaign.budget).replace('.', ',') : '', spent: campaign?.spent != null ? String(campaign.spent).replace('.', ',') : '', status: campaign?.status ?? 'active', notes: campaign?.notes ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveCampaign(clientId, { id: campaign?.id, ...f });
      if (!r.ok) return setError(r.error);
      toast('Campanha salva ♡');
      onClose();
      router.refresh();
    });
  return (
    <Modal open onClose={onClose} title={campaign ? 'Editar campanha' : 'Nova campanha'} className="sm:!max-w-2xl">
      <div className="space-y-4">
        <Field label="Nome da campanha"><Input value={f.name} onChange={set('name')} placeholder="Ex.: Conversão — Setembro" maxLength={160} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plataforma"><Select value={f.platform} onChange={set('platform')}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
          <Field label="Status"><Select value={f.status} onChange={set('status')}>{CAMPAIGN_STATUS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
          <Field label="Objetivo" className="sm:col-span-2"><Input value={f.objective} onChange={set('objective')} placeholder="Ex.: Geração de leads" maxLength={160} /></Field>
          <Field label="Data inicial"><Input type="date" value={f.start_date} onChange={set('start_date')} /></Field>
          <Field label="Data final"><Input type="date" value={f.end_date} onChange={set('end_date')} /></Field>
          <Field label="Orçamento (R$)"><Input inputMode="decimal" value={f.budget} onChange={(e) => setF((s) => ({ ...s, budget: e.target.value.replace(/[^\d.,]/g, '') }))} /></Field>
          <Field label="Valor gasto (R$)"><Input inputMode="decimal" value={f.spent} onChange={(e) => setF((s) => ({ ...s, spent: e.target.value.replace(/[^\d.,]/g, '') }))} /></Field>
        </div>
        <Field label="Observações"><Textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} onClick={submit}>Salvar campanha</Button></div>
      </div>
    </Modal>
  );
}

function CampaignMetricsForm({ campaign, row, onClose }: { campaign: CampaignRow; row: CampaignMetricRow | null; onClose: () => void }) {
  const [month, setMonth] = useState(row ? row.month.slice(0, 7) : todayBR().slice(0, 7));
  const [values, setValues] = useState<Record<string, string>>(toStrings(row?.metrics));
  const [source, setSource] = useState(row?.source ?? 'meta_ads');
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const live = useMemo(() => paidTotals([Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '' && !Number.isNaN(Number(v.replace(',', '.')))).map(([k, v]) => [k, Number(v.replace(',', '.'))]))]), [values]);
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveCampaignMetrics(campaign.id, { month: `${month}-01`, values, source, notes });
      if (!r.ok) return setError(r.error);
      toast('Resultados salvos ♡');
      onClose();
      router.refresh();
    });
  return (
    <Modal open onClose={onClose} title={`Resultados · ${campaign.name}`} className="sm:!max-w-3xl">
      <div className="space-y-6">
        <Field label="Mês dos resultados" hint="Cada mês tem um registro por campanha; salvar de novo no mesmo mês atualiza esse registro."><Input type="month" value={month} max={todayBR().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} disabled={!!row} /></Field>
        <MetricGroup defs={PAID_FIELDS} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
        <div className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
          <p className="label mb-1">Calculado automaticamente (— quando falta dado)</p>
          <p>CTR {fmtPct(live.ctr)} · CPC {fmtMoney(live.cpc)} · CPM {fmtMoney(live.cpm)} · CPL {fmtMoney(live.cpl)} · CPA {fmtMoney(live.cpa)} · Custo/mensagem {fmtMoney(live.cpMessage)} · ROAS {fmtRatio(live.roas)}</p>
        </div>
        <SourceFields source={source} note="" onSource={setSource} onNote={() => {}} hideNote />
        <NotesField value={notes} onChange={setNotes} label="Observações / outras métricas" />
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} onClick={submit}>Salvar resultados</Button></div>
      </div>
    </Modal>
  );
}

function LinkContents({ campaign, contents, selected, onClose }: { campaign: CampaignRow; contents: ContentLite[]; selected: string[]; onClose: () => void }) {
  const [sel, setSel] = useState<string[]>(selected);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const sorted = [...contents].sort((a, b) => (b.scheduled_date ?? '').localeCompare(a.scheduled_date ?? ''));
  return (
    <Modal open onClose={onClose} title={`Criativos · ${campaign.name}`} className="sm:!max-w-xl">
      <p className="mb-3 text-sm text-ink/60">Marque os conteúdos que viraram anúncio nesta campanha. Isso permite comparar resultado orgânico × pago.</p>
      <ul className="max-h-80 space-y-1 overflow-y-auto">
        {sorted.map((c) => (
          <li key={c.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-blush">
              <input type="checkbox" className="size-4 accent-[#771430]" checked={sel.includes(c.id)} onChange={() => setSel((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <span className="text-xs text-ink/45">{c.scheduled_date ? fmtDate(c.scheduled_date) : 'sem data'}</span>
            </label>
          </li>
        ))}
        {sorted.length === 0 && <li className="py-6 text-center text-sm text-ink/50">Este cliente ainda não tem conteúdos.</li>}
      </ul>
      <div className="mt-4"><FormMessage error={error} /></div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button loading={pending} onClick={() => start(async () => {
          const r = await setCampaignContents(campaign.id, sel);
          if (!r.ok) return setError(r.error);
          toast('Criativos salvos ♡');
          onClose();
          router.refresh();
        })}>Salvar</Button>
      </div>
    </Modal>
  );
}
