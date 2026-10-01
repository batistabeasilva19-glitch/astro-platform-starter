'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { deleteSnapshot, saveContentMeta, saveSnapshot, setFinalSnapshot } from '@/lib/actions/perf';
import { fmtInt, fmtPct, normalizeMetrics, pickSnapshot, todayBR } from '@/lib/perf/calc';
import { CONTENT_FIELDS, CONTENT_METRIC_DEF, OBJECTIVES, SNAPSHOT_LABELS, SNAPSHOT_LABEL_TEXT, SOURCE_LABEL, TAG_SUGGESTIONS, toFormatGroup, type SnapshotLabel, type SnapshotRow } from '@/lib/perf/types';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtDate } from '@/lib/utils';
import { LineChart } from './charts';
import { MetricGroup, NotesField, SourceFields, toStrings } from './forms';

const chip = (on: boolean) => cn('rounded-full border px-3.5 py-1.5 text-[0.8rem] transition active:scale-[0.97]', on ? 'border-wine bg-wine text-white' : 'border-wine/30 bg-white text-wine hover:bg-blush');

interface Props {
  content: { id: string; title: string; format: string; status: string; scheduled_date: string | null };
  tags: string[];
  objectives: string[];
  snapshots: SnapshotRow[];
  knownTags: string[];
  missing?: boolean;
}

/** Aba "Desempenho" de cada conteúdo: pilares, objetivos e coletas (24h, 7 dias, 30 dias…) sem nunca substituir dados antigos. */
export function ContentPerformancePanel({ content, tags, objectives, snapshots, knownTags, missing }: Props) {
  const [t, setT] = useState<string[]>(tags);
  const [o, setO] = useState<string[]>(objectives);
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState<SnapshotRow | 'new' | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const group = toFormatGroup(content.format);

  const sorted = useMemo(() => [...snapshots].sort((a, b) => a.collected_on.localeCompare(b.collected_on) || a.created_at.localeCompare(b.created_at)), [snapshots]);
  const used = pickSnapshot(snapshots);
  const metaDirty = t.join('|') !== tags.join('|') || o.join('|') !== objectives.join('|');
  const suggestions = [...new Set([...TAG_SUGGESTIONS, ...knownTags])];

  if (missing) {
    return (
      <section id="desempenho" className="card border-dashed p-6 text-center">
        <p className="h-display text-2xl text-wine">Falta um passo no Supabase</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Rode a migration <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/0008_desempenho.sql</code> no SQL Editor e recarregue esta página.</p>
      </section>
    );
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return toast(r.error ?? 'Erro', 'error');
      toast(msg);
      router.refresh();
    });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addCustom = () => {
    const v = custom.trim();
    if (v && !t.some((x) => x.toLowerCase() === v.toLowerCase())) setT([...t, v.slice(0, 30)]);
    setCustom('');
  };
  const mainKey = group === 'reel' || group === 'story' ? 'views' : 'reach';
  const evolution = sorted.map((s) => ({ label: `${SNAPSHOT_LABEL_TEXT[s.label] ?? s.label} · ${s.collected_on.slice(8, 10)}/${s.collected_on.slice(5, 7)}`, value: normalizeMetrics(s.metrics)[mainKey] ?? null }));

  return (
    <section id="desempenho" className="card space-y-8 p-5 sm:p-7">
      <header>
        <p className="label mb-1 text-wine/70">Desempenho</p>
        <h2 className="h-display text-3xl text-wine">Resultados desta publicação</h2>
        <p className="mt-1 text-sm text-ink/60">Registre os números em datas diferentes (24 horas, 7 dias, 30 dias…). Nada é substituído: cada coleta fica no histórico e o relatório usa o resultado final (ou o mais recente).</p>
        {content.status !== 'published' && <p className="mt-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">Este conteúdo ainda não está como “Publicado”. Você já pode cadastrar resultados, mas só faz sentido depois que ele for ao ar.</p>}
      </header>

      {/* pilares e objetivos */}
      <div className="space-y-5">
        <div>
          <p className="label mb-2 text-wine">Pilar de conteúdo (tags)</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" aria-pressed={t.includes(s)} onClick={() => toggle(t, setT, s)} className={chip(t.includes(s))}>{t.includes(s) && <Check className="mr-1 inline size-3.5" />}{s}</button>
            ))}
            {t.filter((x) => !suggestions.includes(x)).map((s) => (
              <button key={s} type="button" aria-pressed onClick={() => toggle(t, setT, s)} className={chip(true)}><Check className="mr-1 inline size-3.5" />{s}</button>
            ))}
          </div>
          <div className="mt-3 flex max-w-sm gap-2">
            <Input value={custom} maxLength={30} placeholder="Outro pilar…" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
            <Button variant="soft" onClick={addCustom} disabled={!custom.trim()}>Adicionar</Button>
          </div>
        </div>
        <div>
          <p className="label mb-2 text-wine">Objetivo do conteúdo</p>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVES.map((s) => (
              <button key={s} type="button" aria-pressed={o.includes(s)} onClick={() => toggle(o, setO, s)} className={chip(o.includes(s))}>{o.includes(s) && <Check className="mr-1 inline size-3.5" />}{s}</button>
            ))}
          </div>
        </div>
        {metaDirty && <Button loading={pending} onClick={() => run(() => saveContentMeta(content.id, { tags: t, objectives: o }), 'Pilares e objetivos salvos ♡')}>Salvar pilares e objetivos</Button>}
      </div>

      {/* coletas */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label text-wine">Coletas de resultado</p>
            {used && <p className="mt-1 text-xs text-ink/55">Última atualização: {fmtDate(used.collected_on, true)} · {used.is_final ? 'resultado final marcado' : 'o relatório usa a coleta mais recente'}</p>}
          </div>
          <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Registrar resultado</Button>
        </div>

        {sorted.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-wine/25 px-6 py-10 text-center text-sm text-ink/60">Nenhum resultado registrado ainda.</p>
        ) : (
          <>
            {sorted.length > 1 && (
              <div className="mb-5">
                <p className="label mb-2 text-wine/70">Evolução da publicação · {mainKey === 'views' ? 'visualizações' : 'alcance'}</p>
                <LineChart points={evolution} ariaLabel="Evolução da publicação" />
              </div>
            )}
            <ul className="space-y-2">
              {[...sorted].reverse().map((s) => {
                const m = normalizeMetrics(s.metrics);
                const isUsed = used?.id === s.id;
                return (
                  <li key={s.id} className={cn('rounded-2xl border p-4', isUsed ? 'border-wine/40 bg-blush-soft' : 'border-wine/15 bg-white')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-wine px-3 py-0.5 text-xs text-white">{SNAPSHOT_LABEL_TEXT[s.label]}</span>
                      <span className="text-sm text-ink">{fmtDate(s.collected_on, true)}</span>
                      <span className="text-xs text-ink/45">{SOURCE_LABEL[s.source] ?? s.source}</span>
                      {isUsed && <span className="rounded-full border border-wine/40 px-2.5 py-0.5 text-[0.7rem] text-wine">{s.is_final ? 'Resultado final' : 'Usado no relatório'}</span>}
                      <span className="ml-auto flex gap-1">
                        <button aria-label={s.is_final ? 'Desmarcar como resultado final' : 'Marcar como resultado final do relatório'} title={s.is_final ? 'Desmarcar como resultado final' : 'Marcar como resultado final do relatório'} onClick={() => run(() => setFinalSnapshot(s.id, !s.is_final), s.is_final ? 'Resultado final desmarcado' : 'Marcado como resultado final ♡')} className="rounded-full p-2 text-wine transition hover:bg-blush"><Star className={cn('size-4', s.is_final && 'fill-current')} /></button>
                        <button aria-label="Editar" onClick={() => setEditing(s)} className="rounded-full p-2 text-wine transition hover:bg-blush"><Pencil className="size-4" /></button>
                        <button aria-label="Excluir" onClick={() => confirm('Excluir esta coleta?') && run(() => deleteSnapshot(s.id), 'Coleta excluída')} className="rounded-full p-2 text-wine transition hover:bg-blush"><Trash2 className="size-4" /></button>
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink/65">
                      {Object.entries(m).slice(0, 9).map(([k, v]) => `${CONTENT_METRIC_DEF[k]?.label.replace(/ \(.*\)/, '') ?? k}: ${CONTENT_METRIC_DEF[k]?.unit === 'pct' ? fmtPct(v) : fmtInt(v)}`).join(' · ')}
                    </p>
                    {s.notes && <p className="mt-1 text-xs text-ink/50">{s.notes}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {editing && <SnapshotForm key={editing === 'new' ? 'new' : editing.id} content={content} snapshot={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function SnapshotForm({ content, snapshot, onClose }: { content: Props['content']; snapshot: SnapshotRow | null; onClose: () => void }) {
  const group = toFormatGroup(content.format);
  const [on, setOn] = useState(snapshot?.collected_on ?? todayBR());
  const [label, setLabel] = useState<SnapshotLabel>(snapshot?.label ?? '24h');
  const [values, setValues] = useState<Record<string, string>>(toStrings(snapshot?.metrics));
  const [source, setSource] = useState(snapshot?.source ?? 'instagram_insights');
  const [sourceNote, setSourceNote] = useState(snapshot?.source_note ?? '');
  const [notes, setNotes] = useState(snapshot?.notes ?? '');
  const [final, setFinal] = useState(snapshot?.is_final ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const submit = () =>
    start(async () => {
      setError(null);
      const r = await saveSnapshot(content.id, { id: snapshot?.id, collected_on: on, label, values, source, source_note: sourceNote, notes, is_final: final });
      if (!r.ok) return setError(r.error);
      toast('Resultado salvo ♡');
      onClose();
      router.refresh();
    });

  return (
    <Modal open onClose={onClose} title={snapshot ? 'Editar coleta' : 'Registrar resultado'} className="sm:!max-w-3xl">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coleta">
            <Select value={label} onChange={(e) => setLabel(e.target.value as SnapshotLabel)}>
              {SNAPSHOT_LABELS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
          <Field label="Data da coleta" hint="O dia em que você leu os números no Instagram.">
            <Input type="date" value={on} max={todayBR()} min={content.scheduled_date ?? undefined} onChange={(e) => setOn(e.target.value)} />
          </Field>
        </div>
        <MetricGroup defs={CONTENT_FIELDS[group]} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
        <SourceFields source={source} note={sourceNote} onSource={setSource} onNote={setSourceNote} />
        <NotesField value={notes} onChange={setNotes} />
        <label className="flex items-start gap-3 rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
          <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} className="mt-1 size-4 accent-[#771430]" />
          <span>Usar esta coleta como <strong className="font-normal underline">resultado final para o relatório</strong>. <span className="text-wine/70">Sem marcar, o relatório usa a coleta mais recente.</span></span>
        </label>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button loading={pending} onClick={submit}>Salvar resultado</Button>
        </div>
      </div>
    </Modal>
  );
}
