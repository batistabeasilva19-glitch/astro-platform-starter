'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ClipboardCopy, Download, Eye, FileCheck2, History, Lock, Plus, RefreshCw, RotateCcw, Save, Sparkles, Trash2, Unlock } from 'lucide-react';
import { autoFillReportTexts, finalizeReport, getReportAiBrief, refreshReportData, reopenReport, restoreReportVersion, saveReportEdits, saveReportVersion, setReportStatus, setReportVisible } from '@/lib/actions/perf';
import { parseAiResponse } from '@/lib/perf/narrative';
import { REPORT_SECTIONS, REPORT_STATUS, REPORT_STATUS_LABEL, REPORT_TEXT_FIELDS, type Insight, type ReportEdits } from '@/lib/perf/types';
import { Button, LinkButton, buttonClass } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';

interface Props {
  clientId: string;
  report: { id: string; month: string; status: string; visible: boolean; finalized_at: string | null; sent_at: string | null };
  label: string;
  edits: ReportEdits;
  versions: { id: string; version_number: number; label: string; is_final: boolean; created_at: string }[];
  /** resumo numérico (server) exibido no topo */
  summary: React.ReactNode;
}

const statusChip = (s: string) => cn('rounded-full px-3 py-1 text-xs', s === 'sent' ? 'bg-wine text-white' : s === 'final' ? 'bg-wine/90 text-white' : 'bg-blush text-wine');

/** Editor do relatório mensal: textos, análises (automáticas e manuais), versões, finalizar/reabrir e liberar ao cliente. */
export function ReportEditor({ clientId, report, label, edits: initial, versions, summary }: Props) {
  const [edits, setEdits] = useState<ReportEdits>(initial);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionModal, setVersionModal] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [pasted, setPasted] = useState('');
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const locked = report.status === 'final' || report.status === 'sent';
  const base = `/admin/clients/${clientId}/relatorios/${report.month.slice(0, 7)}`;

  const patch = (fn: (e: ReportEdits) => ReportEdits) => {
    setEdits((e) => fn(e));
    setDirty(true);
  };
  const setText = (group: 'texts' | 'analyses' | 'titles', key: string, v: string) => patch((e) => ({ ...e, [group]: { ...e[group], [key]: v } }));
  const setInsight = (id: string, p: Partial<Insight>) => patch((e) => ({ ...e, insights: e.insights.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  /** Executa uma ação; antes, salva o que foi editado para nada se perder. */
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, opts: { save?: boolean; after?: () => void } = {}) =>
    start(async () => {
      setError(null);
      if (opts.save !== false && dirty && !locked) {
        const s = await saveReportEdits(report.id, edits);
        if (!s.ok) return setError(s.error);
        setDirty(false);
      }
      const r = await fn();
      if (!r.ok) return setError(r.error ?? 'Não foi possível concluir.');
      if (msg) toast(msg);
      opts.after?.();
      router.refresh();
    });

  const save = () => act(async () => ({ ok: true }), 'Relatório salvo ♡');

  const autoFill = (overwrite: boolean) =>
    act(async () => {
      const r = await autoFillReportTexts(report.id, overwrite);
      if (r.ok) toast(r.filled ? `${r.filled} ${r.filled === 1 ? 'campo preenchido' : 'campos preenchidos'} com os dados ♡` : 'Nada novo para preencher: os campos já têm texto.');
      return r;
    }, '');

  const openAi = () =>
    start(async () => {
      setError(null);
      const r = await getReportAiBrief(report.id);
      if (!r.ok) return setError(r.error);
      setBrief(r.text);
      setAiMsg(null);
      setAiOpen(true);
    });
  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      toast('Copiado! Cole na sua IA ♡');
    } catch {
      toast('Não consegui copiar automaticamente. Selecione o texto e copie.', 'error');
    }
  };
  const downloadBrief = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([brief], { type: 'text/plain;charset=utf-8' }));
    a.download = `dados-relatorio-${report.month.slice(0, 7)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyPasted = () => {
    const r = parseAiResponse(pasted);
    if (!r.found) return setAiMsg('Não encontrei nenhum campo. A resposta da IA precisa ter blocos começando com “### Nome do campo”.');
    patch((e) => ({ ...e, texts: { ...e.texts, ...r.texts }, analyses: { ...e.analyses, ...r.analyses } }));
    setAiMsg(null);
    setAiOpen(false);
    setPasted('');
    toast(`${r.found} ${r.found === 1 ? 'campo preenchido' : 'campos preenchidos'} com a resposta da IA. Revise e clique em Salvar ♡`);
  };

  return (
    <div className="space-y-6">
      {/* barra de ações */}
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={statusChip(report.status)}>{REPORT_STATUS_LABEL[report.status]}</span>
          {locked && <span className="flex items-center gap-1.5 text-xs text-ink/55"><Lock className="size-3.5" /> Dados congelados em {report.finalized_at ? fmtStamp(report.finalized_at) : '—'} — mudanças em métricas ou posts não alteram este relatório.</span>}
          {!locked && (
            <Select value={report.status} onChange={(e) => act(() => setReportStatus(report.id, e.target.value), 'Status atualizado')} className="!w-auto !py-2 text-sm" aria-label="Status do relatório">
              {REPORT_STATUS.filter((s) => ['draft', 'in_review', 'ready'].includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!locked ? (
            <>
              <Button loading={pending} onClick={save} disabled={!dirty}><Save className="size-4" /> Salvar</Button>
              <Button variant="outline" loading={pending} onClick={() => act(async () => { const r = await refreshReportData(report.id); return r; }, 'Dados do mês atualizados ♡')}><RefreshCw className="size-4" /> Atualizar dados do mês</Button>
              <Button variant="outline" onClick={() => setVersionModal(true)}><History className="size-4" /> Salvar versão</Button>
              <Button variant="soft" loading={pending} onClick={() => act(async () => ({ ok: true }), '', { after: () => router.push(`${base}?aba=preview`) })}><Eye className="size-4" /> Visualizar relatório</Button>
              <Button variant="dark" loading={pending} onClick={() => confirm('Finalizar o relatório? Os dados do mês ficam congelados: se você alterar métricas ou posts depois, este relatório NÃO muda (você pode reabrir quando quiser).') && act(() => finalizeReport(report.id), 'Relatório finalizado ♡')}><FileCheck2 className="size-4" /> Finalizar relatório</Button>
            </>
          ) : (
            <>
              <LinkButton href={`${base}?aba=preview`} variant="soft"><Eye className="size-4" /> Visualizar relatório</LinkButton>
              <Button variant="outline" loading={pending} onClick={() => confirm('Reabrir o relatório? Ele sai do portal do cliente até ser finalizado e liberado de novo.') && act(() => reopenReport(report.id), 'Relatório reaberto', { save: false })}><Unlock className="size-4" /> Reabrir relatório</Button>
            </>
          )}
          <a href={`${base}/pdf`} className={buttonClass('primary', 'md')}><Download className="size-4" /> Exportar PDF</a>
        </div>
        {locked && (
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
            <input type="checkbox" checked={report.visible} disabled={pending} onChange={(e) => act(() => setReportVisible(report.id, e.target.checked), e.target.checked ? 'Disponível para o cliente ♡' : 'Oculto do cliente', { save: false })} className="mt-1 size-4 accent-[#771430]" />
            <span><strong className="font-normal">Disponibilizar para cliente</strong> {report.visible ? '— o cliente vê este relatório na área “Resultados” e pode baixar o PDF.' : '— ligado, aparece em “Resultados” no link do cliente.'}{report.sent_at && report.visible ? ` Enviado em ${fmtStamp(report.sent_at)}.` : ''}</span>
          </label>
        )}
        <FormMessage error={error} />
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="h-display text-2xl text-wine">Textos e análises com ajuda dos dados</h2>
        <p className="text-sm text-ink/60">Não precisa escrever do zero: o sistema redige os textos e as análises de cada seção só com os números cadastrados (sem inventar nada), ou você leva todos os dados para a sua IA e cola a resposta de volta.</p>
        <div className="flex flex-wrap gap-2">
          {!locked && <Button variant="outline" loading={pending} onClick={() => autoFill(false)}><Sparkles className="size-4" /> Preencher automaticamente</Button>}
          {!locked && <Button variant="ghost" loading={pending} onClick={() => confirm('Refazer TODOS os textos e análises com os dados? O que você escreveu nesses campos será substituído.') && autoFill(true)}><RefreshCw className="size-4" /> Refazer todos</Button>}
          <Button variant="soft" loading={pending} onClick={openAi}><Bot className="size-4" /> Dados para a IA</Button>
        </div>
        <p className="text-xs text-ink/45">“Preencher automaticamente” só completa os campos vazios. Depois você pode editar tudo.</p>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="h-display text-2xl text-wine">Números de {label}</h2>
        <p className="mb-4 mt-1 text-sm text-ink/55">Vêm do que você cadastrou em Desempenho. Use “Atualizar dados do mês” para trazer números novos para o rascunho.</p>
        {summary}
      </section>

      <fieldset disabled={locked} className="space-y-6 disabled:opacity-70">
        {/* análises automáticas e manuais */}
        <section className="card p-5 sm:p-6">
          <h2 className="h-display text-2xl text-wine">Análises</h2>
          <p className="mb-4 mt-1 text-sm text-ink/55">As automáticas usam só os dados cadastrados — edite o texto, desligue as que não quiser ou escreva as suas.</p>
          <ul className="space-y-3">
            {edits.insights.map((i) => (
              <li key={i.id} className="flex gap-3">
                <input type="checkbox" checked={i.enabled} onChange={(e) => setInsight(i.id, { enabled: e.target.checked })} className="mt-3 size-4 shrink-0 accent-[#771430]" aria-label="Incluir no relatório" />
                <div className="min-w-0 flex-1">
                  <Textarea rows={2} value={i.text} onChange={(e) => setInsight(i.id, { text: e.target.value, edited: true })} className={cn('!min-h-0', !i.enabled && 'opacity-50')} />
                  <p className="mt-1 text-[0.7rem] text-ink/40">{i.key ? (i.edited ? 'Análise automática (editada por você)' : 'Análise automática') : 'Escrita por você'}</p>
                </div>
                <button type="button" aria-label="Remover análise" onClick={() => patch((e) => ({ ...e, insights: e.insights.filter((x) => x.id !== i.id) }))} className="mt-2 h-fit rounded-full p-2 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <Button variant="soft" size="sm" className="mt-4" onClick={() => patch((e) => ({ ...e, insights: [...e.insights, { id: `m-${Date.now()}`, key: '', text: '', enabled: true, edited: true }] }))}><Plus className="size-3.5" /> Adicionar análise</Button>
        </section>

        <section className="card space-y-5 p-5 sm:p-6">
          <h2 className="h-display text-2xl text-wine">Textos do relatório</h2>
          {REPORT_TEXT_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <Textarea rows={f.key === 'summary' || f.key === 'results' ? 4 : 3} value={edits.texts[f.key] ?? ''} onChange={(e) => setText('texts', f.key, e.target.value)} maxLength={4000} />
            </Field>
          ))}
        </section>

        <section className="card space-y-5 p-5 sm:p-6">
          <h2 className="h-display text-2xl text-wine">Análise e título de cada seção</h2>
          <p className="-mt-3 text-sm text-ink/55">Escreva uma leitura curta para os gráficos de cada seção e, se quiser, troque o título.</p>
          {REPORT_SECTIONS.map((s) => (
            <div key={s.id} className="rounded-2xl border border-wine/10 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                <Field label={`Título · ${s.title}`}><Input value={edits.titles[s.id] ?? ''} placeholder={s.title} onChange={(e) => setText('titles', s.id, e.target.value)} maxLength={80} /></Field>
                {s.analysis && <Field label="Análise da seção"><Textarea rows={2} value={edits.analyses[s.id] ?? ''} onChange={(e) => setText('analyses', s.id, e.target.value)} maxLength={2000} /></Field>}
              </div>
            </div>
          ))}
        </section>

        <section className="card p-5 sm:p-6">
          <Field label="Observações internas" hint="Só você vê. Nunca aparecem no PDF nem no portal do cliente.">
            <Textarea rows={3} value={edits.internal_notes} onChange={(e) => patch((x) => ({ ...x, internal_notes: e.target.value }))} maxLength={4000} />
          </Field>
        </section>
      </fieldset>

      {!locked && dirty && <div className="sticky bottom-4 z-10 flex justify-end"><Button loading={pending} onClick={save} className="shadow-lg"><Save className="size-4" /> Salvar alterações</Button></div>}

      <section className="card p-5 sm:p-6">
        <h2 className="h-display text-2xl text-wine">Versões</h2>
        <p className="mb-4 mt-1 text-sm text-ink/55">Cada versão guarda os textos e os números daquele momento. Nada é apagado.</p>
        <ul className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-blush-soft px-4 py-2.5 text-sm">
              <span className={cn('rounded-full px-3 py-0.5 text-xs', v.is_final ? 'bg-wine text-white' : 'bg-blush text-wine')}>{v.is_final ? 'FINAL' : `V${v.version_number}`}</span>
              <span className="text-ink/80">{v.label}</span>
              <span className="text-xs text-ink/45">{fmtStamp(v.created_at)}</span>
              {!locked && (
                <Button variant="ghost" size="sm" className="ml-auto" loading={pending} onClick={() => confirm(`Restaurar os textos da versão “${v.label}” no rascunho? O que você escreveu agora será substituído (as versões salvas continuam guardadas).`) && act(() => restoreReportVersion(report.id, v.id), 'Versão restaurada', { save: false, after: () => { setDirty(false); } })}><RotateCcw className="size-3.5" /> Restaurar textos</Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {aiOpen && (
        <Modal open onClose={() => setAiOpen(false)} title="Dados para a IA" className="sm:!max-w-3xl">
          <p className="mb-3 text-sm text-ink/65">1) Copie o texto abaixo (ele já tem o pedido e todos os dados do mês) e cole na sua IA. 2) Cole aqui a resposta dela para preencher os campos.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button onClick={copyBrief}><ClipboardCopy className="size-4" /> Copiar tudo</Button>
            <Button variant="outline" onClick={downloadBrief}><Download className="size-4" /> Baixar .txt</Button>
          </div>
          <textarea readOnly value={brief} rows={9} className="field w-full resize-y font-mono !text-xs leading-relaxed" onFocus={(e) => e.currentTarget.select()} />
          {!locked && (
            <div className="mt-5">
              <Field label="2) Resposta da IA" hint="Cole aqui. Os blocos precisam começar com “### Nome do campo” (o pedido já ensina a IA a responder assim)."><Textarea rows={7} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="### Resumo do mês&#10;..." /></Field>
              {aiMsg && <p className="mt-2 text-sm text-wine">{aiMsg}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAiOpen(false)}>Fechar</Button>
                <Button onClick={applyPasted} disabled={!pasted.trim()}>Preencher os campos</Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {versionModal && (
        <Modal open onClose={() => setVersionModal(false)} title="Salvar versão do relatório" className="sm:!max-w-md">
          <Field label="Nome da versão (opcional)"><Input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="Ex.: Versão para revisão" maxLength={60} /></Field>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setVersionModal(false)}>Cancelar</Button>
            <Button loading={pending} onClick={() => act(() => saveReportVersion(report.id, versionLabel), 'Versão salva ♡', { after: () => { setVersionModal(false); setVersionLabel(''); } })}>Salvar versão</Button>
          </div>
        </Modal>
      )}
      <p className="text-center text-xs text-ink/40"><Link href={`/admin/clients/${clientId}/relatorios`} className="underline">Voltar para os relatórios</Link></p>
    </div>
  );
}
