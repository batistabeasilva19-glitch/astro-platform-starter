'use client';

import { useState } from 'react';
import { Clapperboard, Eye, EyeOff, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { deleteEvent, saveEvent, setEventVisible } from '@/lib/actions/extras';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { EVENT_KINDS, EVENT_STATUS_LABEL, dayTitle, hhmm, type EventRow, type EventStatus } from '@/lib/extras/types';
import { cn } from '@/lib/utils';
import { useAct } from './shared';

const todayIso = () => new Date().toISOString().slice(0, 10);
const KIND_ICON = { recording: Clapperboard, meeting: Users } as const;
const STATUS_CHIP: Record<EventStatus, string> = { scheduled: 'bg-amber-100 text-amber-800', done: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-red-100 text-red-700' };

/** Agenda do cliente: gravações e reuniões de alinhamento. Aparece no link do cliente (se estiver visível). */
export function EventsManager({ clientId, rows }: { clientId: string; rows: EventRow[] }) {
  const [edit, setEdit] = useState<EventRow | 'new' | null>(null);
  const { act, pending } = useAct();
  const today = todayIso();
  const upcoming = rows.filter((r) => r.event_date >= today);
  const past = rows.filter((r) => r.event_date < today).reverse();

  const Row = ({ r }: { r: EventRow }) => {
    const Icon = KIND_ICON[r.kind];
    return (
      <li className={cn('card flex gap-3 p-4', !r.visible && 'bg-ink/[0.03]')}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-base text-ink">{r.title}</p>
          <p className="text-xs text-ink/55">
            {EVENT_KINDS.find((k) => k.id === r.kind)?.label} · {dayTitle(r.event_date)}{r.start_time ? ` · ${hhmm(r.start_time)}${r.end_time ? `–${hhmm(r.end_time)}` : ''}` : ''}
          </p>
          {r.location && <p className="mt-1 flex items-center gap-1 text-xs text-ink/55"><MapPin className="size-3" /> {r.location}</p>}
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cn('rounded-full px-2.5 py-0.5', STATUS_CHIP[r.status])}>{EVENT_STATUS_LABEL[r.status]}</span>
            <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-ink/60">{r.visible ? 'Visível ao cliente' : 'Oculto'}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <button aria-label={r.visible ? 'Ocultar do cliente' : 'Mostrar ao cliente'} onClick={() => act(() => setEventVisible(r.id, !r.visible))} className="rounded-full p-2 text-wine hover:bg-blush">{r.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          <button aria-label="Editar" onClick={() => setEdit(r)} className="rounded-full p-2 text-wine hover:bg-blush"><Pencil className="size-4" /></button>
          <button aria-label="Excluir" onClick={() => confirm(`Excluir “${r.title}”?`) && act(() => deleteEvent(r.id), 'Excluído')} className="rounded-full p-2 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink/60">Agende as <strong className="font-normal text-wine">gravações</strong> e as <strong className="font-normal text-wine">reuniões de alinhamento</strong>. O cliente vê tudo no link dele, com data, horário, local e um botão para adicionar ao Google Agenda.</p>
        <Button onClick={() => setEdit('new')} disabled={pending}><Plus className="size-4" /> Novo compromisso</Button>
      </div>
      {rows.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum compromisso agendado ainda.</p>
      ) : (
        <>
          <section>
            <h2 className="label mb-3 text-wine/70">Próximos</h2>
            {upcoming.length ? <ul className="space-y-3">{upcoming.map((r) => <Row key={r.id} r={r} />)}</ul> : <p className="text-sm text-ink/55">Nada marcado daqui para frente.</p>}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="label mb-3 text-wine/70">Já passaram</h2>
              <ul className="space-y-3 opacity-80">{past.map((r) => <Row key={r.id} r={r} />)}</ul>
            </section>
          )}
        </>
      )}
      {edit && <EventForm key={edit === 'new' ? 'new' : edit.id} clientId={clientId} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventForm({ clientId, row, onClose }: { clientId: string; row: EventRow | null; onClose: () => void }) {
  const [f, setF] = useState({
    kind: row?.kind ?? 'recording',
    title: row?.title ?? '',
    event_date: row?.event_date ?? '',
    start_time: hhmm(row?.start_time ?? null),
    end_time: hhmm(row?.end_time ?? null),
    location: row?.location ?? '',
    link: row?.link ?? '',
    notes: row?.notes ?? '',
    status: row?.status ?? 'scheduled',
    visible: row?.visible ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const { act, pending } = useAct();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = () => act(async () => {
    const r = await saveEvent({ id: row?.id, clientId, ...f });
    if (!r.ok) setError(r.error);
    return r;
  }, 'Agenda salva ♡', onClose);
  return (
    <Modal open onClose={onClose} title={row ? 'Editar compromisso' : 'Novo compromisso'} className="sm:!max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo"><Select value={f.kind} onChange={set('kind')}>{EVENT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
          <Field label="Situação"><Select value={f.status} onChange={set('status')}>{(Object.keys(EVENT_STATUS_LABEL) as EventStatus[]).map((s) => <option key={s} value={s}>{EVENT_STATUS_LABEL[s]}</option>)}</Select></Field>
        </div>
        <Field label="Título"><Input autoFocus value={f.title} onChange={set('title')} placeholder={f.kind === 'meeting' ? 'Ex.: Alinhamento do mês de novembro' : 'Ex.: Gravação dos Reels da semana'} maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data"><Input type="date" value={f.event_date} onChange={set('event_date')} /></Field>
          <Field label="Início (opcional)"><Input type="time" value={f.start_time} onChange={set('start_time')} /></Field>
          <Field label="Fim (opcional)"><Input type="time" value={f.end_time} onChange={set('end_time')} /></Field>
        </div>
        <Field label="Local (opcional)"><Input value={f.location} onChange={set('location')} placeholder="Ex.: Clínica da cliente · Rua X, 123 — ou: Google Meet" maxLength={300} /></Field>
        <Field label="Link da reunião online (opcional)"><Input value={f.link} onChange={set('link')} placeholder="https://meet.google.com/…" /></Field>
        <Field label="Observações para o cliente (opcional)"><Textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Ex.: Levar 3 trocas de roupa. Chegar 15 min antes." /></Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#771430]" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Visível para o cliente</label>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} disabled={!f.title.trim() || !f.event_date} onClick={submit}>Salvar</Button></div>
      </div>
    </Modal>
  );
}
