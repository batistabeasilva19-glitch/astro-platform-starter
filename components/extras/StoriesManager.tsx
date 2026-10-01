'use client';

import { RichTextarea } from '@/components/ui/RichText';
import { useState } from 'react';
import { Pencil, Plus, RotateCcw, Trash2, ListPlus } from 'lucide-react';
import { addStories, deleteStory, moveStory, resetStory, saveStory } from '@/lib/actions/extras';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { dayTitle, shortDate, type StoryRow } from '@/lib/extras/types';
import { fmtStamp } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Chip, OrderControls, useAct } from './shared';

interface ContentOpt { id: string; title: string; format: string; date: string | null }
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

/** Stories por dia, em ordem (1, 2, 3…). O cliente marca “OK” em cada um que postou. */
export function StoriesManager({ clientId, rows, contents }: { clientId: string; rows: StoryRow[]; contents: ContentOpt[] }) {
  const [day, setDay] = useState(todayKey());
  const [edit, setEdit] = useState<StoryRow | 'new' | null>(null);
  const [bulk, setBulk] = useState(false);
  const { act, pending } = useAct();
  const list = rows.filter((r) => r.story_date === day).sort((a, b) => a.position - b.position);
  const days = [...new Set(rows.map((r) => r.story_date))].sort().reverse().slice(0, 12);
  const progress = (d: string) => {
    const l = rows.filter((r) => r.story_date === d);
    return { done: l.filter((r) => r.done).length, total: l.length };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="!w-auto" aria-label="Dia" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setBulk(true)}><ListPlus className="size-4" /> Adicionar vários</Button>
          <Button onClick={() => setEdit('new')}><Plus className="size-4" /> Novo story</Button>
        </div>
      </div>
      {days.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {days.map((d) => {
            const p = progress(d);
            return <button key={d} onClick={() => setDay(d)} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition', d === day ? 'border-wine bg-wine text-white' : 'border-wine/25 bg-white text-wine hover:bg-blush')}>{shortDate(d)} · {p.done}/{p.total}</button>;
          })}
        </div>
      )}
      <p className="text-sm text-ink/60">Coloque os stories <strong className="font-normal text-wine">na ordem em que devem ser postados</strong> em {dayTitle(day)}. No link do cliente eles aparecem numerados e ela marca “OK, postei”.</p>

      {list.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum story neste dia.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((s, i) => (
            <li key={s.id} className={cn('card flex gap-3 p-4', s.done && 'border-emerald-300 bg-emerald-50/40', !s.visible && 'bg-ink/[0.03]')}>
              <OrderControls n={i + 1} first={i === 0} last={i === list.length - 1} disabled={pending} onUp={() => act(() => moveStory(s.id, -1))} onDown={() => act(() => moveStory(s.id, 1))} />
              <div className="min-w-0 flex-1">
                <p className="text-base text-ink">{s.title}</p>
                {s.description && <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-ink/60">{s.description}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {s.done ? <Chip className="bg-emerald-100 text-emerald-800">✓ Postado{s.done_by ? ` por ${s.done_by}` : ''}{s.done_at ? ` · ${fmtStamp(s.done_at)}` : ''}</Chip> : <Chip className="bg-ink/5 text-ink/55">Falta postar</Chip>}
                  {!s.visible && <Chip className="bg-ink/5 text-ink/55">Oculto</Chip>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button aria-label="Editar" onClick={() => setEdit(s)} className="rounded-full p-2 text-wine hover:bg-blush"><Pencil className="size-4" /></button>
                {s.done && <button aria-label="Desmarcar como postado" title="Desmarcar como postado" onClick={() => act(() => resetStory(s.id), 'Desmarcado')} className="rounded-full p-2 text-wine hover:bg-blush"><RotateCcw className="size-4" /></button>}
                <button aria-label="Excluir" onClick={() => confirm(`Excluir “${s.title}”?`) && act(() => deleteStory(s.id), 'Story excluído')} className="rounded-full p-2 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && <StoryForm key={edit === 'new' ? 'new' : edit.id} clientId={clientId} day={day} row={edit === 'new' ? null : edit} contents={contents} onClose={() => setEdit(null)} />}
      {bulk && <BulkForm clientId={clientId} day={day} onClose={() => setBulk(false)} />}
    </div>
  );
}

function StoryForm({ clientId, day, row, contents, onClose }: { clientId: string; day: string; row: StoryRow | null; contents: ContentOpt[]; onClose: () => void }) {
  const [f, setF] = useState({ story_date: row?.story_date ?? day, title: row?.title ?? '', description: row?.description ?? '', link: row?.link ?? '', content_id: row?.content_id ?? '', visible: row?.visible ?? true });
  const [error, setError] = useState<string | null>(null);
  const { act, pending } = useAct();
  return (
    <Modal open onClose={onClose} title={row ? 'Editar story' : 'Novo story'} className="sm:!max-w-xl">
      <div className="space-y-4">
        <Field label="Dia"><Input type="date" value={f.story_date} onChange={(e) => setF({ ...f, story_date: e.target.value })} /></Field>
        <Field label="Título"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Enquete sobre skincare" maxLength={200} /></Field>
        <Field label="O que fazer / texto do story (opcional)"><RichTextarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Link (opcional)" hint="Ex.: pasta do Drive com a arte."><Input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Mostrar a arte de um conteúdo já cadastrado (opcional)"><Select value={f.content_id} onChange={(e) => setF({ ...f, content_id: e.target.value })}><option value="">Sem arte</option>{contents.map((c) => <option key={c.id} value={c.id}>{c.title}{c.date ? ` · ${shortDate(c.date)}` : ''}</option>)}</Select></Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#771430]" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Visível para o cliente</label>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} disabled={!f.title.trim()} onClick={() => act(async () => { const r = await saveStory({ id: row?.id, clientId, ...f, content_id: f.content_id || null }); if (!r.ok) setError(r.error); return r; }, 'Story salvo ♡', onClose)}>Salvar story</Button></div>
      </div>
    </Modal>
  );
}

function BulkForm({ clientId, day, onClose }: { clientId: string; day: string; onClose: () => void }) {
  const [date, setDate] = useState(day);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { act, pending } = useAct();
  return (
    <Modal open onClose={onClose} title="Adicionar vários stories" className="sm:!max-w-xl">
      <div className="space-y-4">
        <Field label="Dia"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Um story por linha (na ordem em que serão postados)"><Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Bom dia + enquete\nBastidores da clínica\nDepoimento da cliente\nChamada para agendar'} /></Field>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} disabled={!text.trim()} onClick={() => act(async () => { const r = await addStories(clientId, date, text.split('\n')); if (!r.ok) setError(r.error); return r; }, 'Stories adicionados ♡', onClose)}>Adicionar</Button></div>
      </div>
    </Modal>
  );
}
