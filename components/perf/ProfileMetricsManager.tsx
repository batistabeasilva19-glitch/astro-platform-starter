'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteProfileMetrics, saveProfileMetrics } from '@/lib/actions/perf';
import { aggregateProfile, dayMonth, fmtInt, fmtPct, fmtSigned, todayBR } from '@/lib/perf/calc';
import { PROFILE_FIELDS, SOURCE_LABEL, type ProfileRow } from '@/lib/perf/types';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { BeforeAfterGroup, MetricGroup, NotesField, SourceFields } from './forms';

const DEFAULT_START = () => `${todayBR().slice(0, 8)}01`;

/** Cadastro das métricas gerais do perfil por período (semana, quinzena, mês…). */
export function ProfileMetricsManager({ clientId, rows }: { clientId: string; rows: ProfileRow[] }) {
  const [editing, setEditing] = useState<ProfileRow | 'new' | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink/65">Registre os números do perfil durante o mês (por semana, por quinzena ou o mês inteiro). Os períodos não podem se sobrepor. O sistema calcula crescimento, engajamento e variações sozinho.</p>
        <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Novo período</Button>
      </div>

      {rows.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum período cadastrado ainda.</p>
      ) : (
        <ul className="space-y-2">
          {[...rows].sort((a, b) => b.period_start.localeCompare(a.period_start)).map((r) => {
            const a = aggregateProfile([r], { from: r.period_start, to: r.period_end, label: '' });
            return (
              <li key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-sm text-ink">{r.period_start === r.period_end ? dayMonth(r.period_end) : `${dayMonth(r.period_start)} a ${dayMonth(r.period_end)}`}/{r.period_end.slice(0, 4)} <span className="text-xs text-ink/45">· {SOURCE_LABEL[r.source] ?? r.source}</span></p>
                  <p className="mt-1 text-xs text-ink/60">Seguidores {fmtInt(a.followersEnd)} ({fmtSigned(a.net)}) · Alcance {fmtInt(a.reach)} · Impressões {fmtInt(a.impressions)} · Interações {fmtInt(a.interactions)} · Engajamento {fmtPct(a.erReach)}</p>
                </div>
                <div className="flex gap-1">
                  <button aria-label="Editar" onClick={() => setEditing(r)} className="rounded-full p-2 text-wine transition hover:bg-blush"><Pencil className="size-4" /></button>
                  <button
                    aria-label="Excluir"
                    onClick={() => confirm('Excluir este período? Os números dele saem dos gráficos e relatórios em rascunho.') && start(async () => {
                      const res = await deleteProfileMetrics(r.id);
                      if (!res.ok) return toast(res.error, 'error');
                      toast('Período excluído');
                      router.refresh();
                    })}
                    className="rounded-full p-2 text-wine transition hover:bg-blush"
                    disabled={pending}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && <ProfileForm key={editing === 'new' ? 'new' : editing.id} clientId={clientId} row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ProfileForm({ clientId, row, onClose }: { clientId: string; row: ProfileRow | null; onClose: () => void }) {
  const [start, setStart] = useState(row?.period_start ?? DEFAULT_START());
  const [end, setEnd] = useState(row?.period_end ?? todayBR());
  const [source, setSource] = useState(row?.source ?? 'instagram_insights');
  const [sourceNote, setSourceNote] = useState(row?.source_note ?? '');
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    if (row) for (const g of PROFILE_FIELDS) for (const f of g.fields) if (row[f.key as keyof ProfileRow] != null) v[f.key] = String(row[f.key as keyof ProfileRow]);
    return v;
  });
  const [bStart, setBStart] = useState(row?.before_start ?? '');
  const [bEnd, setBEnd] = useState(row?.before_end ?? '');
  const [before, setBefore] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(row?.before ?? {}).map(([k, v]) => [k, String(v)])));
  const [error, setError] = useState<string | null>(null);
  const [pending, startT] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const num = (k: string) => {
    const t = (values[k] ?? '').replace(',', '.');
    return t === '' || Number.isNaN(Number(t)) ? null : Number(t);
  };
  const live = useMemo(() => {
    const fs = num('followers_start');
    const fe = num('followers_end');
    const net = fs != null && fe != null ? fe - fs : null;
    const interactions = num('interactions') ?? (['likes', 'comments', 'shares', 'saves', 'replies'].some((k) => num(k) != null) ? ['likes', 'comments', 'shares', 'saves', 'replies'].reduce((a, k) => a + (num(k) ?? 0), 0) : null);
    const reach = num('reach');
    return { net, pct: net != null && fs ? (net / fs) * 100 : null, interactions, er: interactions != null && reach ? (interactions / reach) * 100 : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const submit = () =>
    startT(async () => {
      setError(null);
      const res = await saveProfileMetrics(clientId, { id: row?.id, period_start: start, period_end: end, source, source_note: sourceNote, notes, values, before, before_start: bStart, before_end: bEnd });
      if (!res.ok) return setError(res.error);
      toast('Métricas salvas ♡');
      onClose();
      router.refresh();
    });

  return (
    <Modal open onClose={onClose} title={row ? 'Editar período' : 'Novo período'} className="sm:!max-w-3xl">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data inicial"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Data final"><Input type="date" value={end} max={todayBR()} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="rounded-2xl border border-wine/15 p-4">
          <p className="label mb-1 text-wine">Período de antes (opcional)</p>
          <p className="mb-3 text-xs text-ink/55">Os números de “Antes” de cada métrica abaixo servem de base de comparação (por exemplo, o perfil antes de começar o trabalho). Se deixar em branco, o sistema compara com o período anterior já cadastrado.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Antes — data inicial"><Input type="date" value={bStart} max={start || undefined} onChange={(e) => setBStart(e.target.value)} /></Field>
            <Field label="Antes — data final"><Input type="date" value={bEnd} max={start || undefined} onChange={(e) => setBEnd(e.target.value)} /></Field>
          </div>
        </div>
        {PROFILE_FIELDS.map((g) =>
          g.group === 'Seguidores' ? (
            <MetricGroup key={g.group} title="Seguidores (início = antes · final = depois)" defs={g.fields} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
          ) : (
            <BeforeAfterGroup key={g.group} title={g.group} defs={g.fields} before={before} after={values} onBefore={(k, v) => setBefore((s) => ({ ...s, [k]: v }))} onAfter={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
          ),
        )}
        <div className="rounded-2xl bg-blush px-4 py-3 text-sm text-wine">
          <p className="label mb-1">Calculado automaticamente</p>
          <p>Crescimento líquido: <strong className="font-normal">{fmtSigned(live.net)}</strong> <span className="text-wine/60">(seguidores finais − iniciais)</span></p>
          <p>Taxa de crescimento: <strong className="font-normal">{fmtPct(live.pct)}</strong> <span className="text-wine/60">(líquido ÷ seguidores iniciais × 100)</span></p>
          <p>Interações: <strong className="font-normal">{fmtInt(live.interactions)}</strong> · Engajamento por alcance: <strong className="font-normal">{fmtPct(live.er)}</strong></p>
        </div>
        <SourceFields source={source} note={sourceNote} onSource={setSource} onNote={setSourceNote} />
        <NotesField value={notes} onChange={setNotes} />
        <FormMessage error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button loading={pending} onClick={submit}>Salvar métricas</Button>
        </div>
      </div>
    </Modal>
  );
}
