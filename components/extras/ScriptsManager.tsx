'use client';

import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteScript, moveScript, saveScript, setScriptVisible } from '@/lib/actions/extras';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { monthKey, monthTitle, shortDate, type ScriptRow } from '@/lib/extras/types';
import { cn } from '@/lib/utils';
import { OrderControls, useAct } from './shared';

const today = () => new Date().toISOString().slice(0, 7);

/** Roteiros dos vídeos a gravar: em ordem (1, 2, 3…), por mês. O cliente vê e copia pelo link dele. */
export function ScriptsManager({ clientId, rows }: { clientId: string; rows: ScriptRow[] }) {
  const months = [...new Set([today(), ...rows.map((r) => monthKey(r.month))])].sort().reverse();
  const [month, setMonth] = useState(months[0]);
  const [edit, setEdit] = useState<ScriptRow | 'new' | null>(null);
  const { act, pending } = useAct();
  const list = rows.filter((r) => monthKey(r.month) === month).sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="!w-auto" aria-label="Mês" />
          {months.filter((m) => rows.some((r) => monthKey(r.month) === m) && m !== month).slice(0, 4).map((m) => <button key={m} onClick={() => setMonth(m)} className="rounded-full border border-wine/25 px-3 py-1.5 text-xs text-wine hover:bg-blush">{monthTitle(`${m}-01`)}</button>)}
        </div>
        <Button onClick={() => setEdit('new')}><Plus className="size-4" /> Novo roteiro</Button>
      </div>
      <p className="text-sm text-ink/60">Coloque os vídeos <strong className="font-normal text-wine">na ordem em que precisam ser gravados</strong>. No link do cliente eles aparecem numerados, com o roteiro pronto para copiar.</p>

      {list.length === 0 ? (
        <p className="card border-dashed px-6 py-12 text-center text-sm text-ink/60">Nenhum roteiro em {monthTitle(`${month}-01`)}.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r, i) => (
            <li key={r.id} className={cn('card flex gap-3 p-4', !r.visible && 'bg-ink/[0.03]')}>
              <OrderControls n={i + 1} first={i === 0} last={i === list.length - 1} disabled={pending} onUp={() => act(() => moveScript(r.id, -1))} onDown={() => act(() => moveScript(r.id, 1))} />
              <div className="min-w-0 flex-1">
                <p className="text-base text-ink">{r.title}</p>
                <p className="text-xs text-ink/50">{r.shoot_date ? `Gravar em ${shortDate(r.shoot_date)} · ` : ''}{r.visible ? 'Visível ao cliente' : 'Oculto'}</p>
                <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-ink/65">{r.script || <span className="text-ink/35">Sem roteiro ainda.</span>}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button aria-label={r.visible ? 'Ocultar do cliente' : 'Mostrar ao cliente'} onClick={() => act(() => setScriptVisible(r.id, !r.visible))} className="rounded-full p-2 text-wine hover:bg-blush">{r.visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                <button aria-label="Editar" onClick={() => setEdit(r)} className="rounded-full p-2 text-wine hover:bg-blush"><Pencil className="size-4" /></button>
                <button aria-label="Excluir" onClick={() => confirm(`Excluir o roteiro “${r.title}”?`) && act(() => deleteScript(r.id), 'Roteiro excluído')} className="rounded-full p-2 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && <ScriptForm key={edit === 'new' ? 'new' : edit.id} clientId={clientId} month={month} row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ScriptForm({ clientId, month, row, onClose }: { clientId: string; month: string; row: ScriptRow | null; onClose: () => void }) {
  const [f, setF] = useState({ title: row?.title ?? '', script: row?.script ?? '', notes: row?.notes ?? '', shoot_date: row?.shoot_date ?? '', month: row ? monthKey(row.month) : month, visible: row?.visible ?? true });
  const [error, setError] = useState<string | null>(null);
  const { act, pending } = useAct();
  const submit = () => act(async () => {
    const r = await saveScript({ id: row?.id, clientId, month: f.month, title: f.title, script: f.script, notes: f.notes, shoot_date: f.shoot_date, visible: f.visible });
    if (!r.ok) setError(r.error);
    return r;
  }, 'Roteiro salvo ♡', onClose);
  return (
    <Modal open onClose={onClose} title={row ? 'Editar roteiro' : 'Novo roteiro'} className="sm:!max-w-3xl">
      <div className="space-y-4">
        <Field label="Título do vídeo"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: 3 erros que sabotam sua pele" maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mês"><Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} /></Field>
          <Field label="Data para gravar (opcional)"><Input type="date" value={f.shoot_date} onChange={(e) => setF({ ...f, shoot_date: e.target.value })} /></Field>
        </div>
        <Field label="Roteiro" hint="O cliente copia o texto exatamente como está aqui (as quebras de linha são mantidas)."><Textarea rows={12} value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} placeholder={'Abertura: …\nDesenvolvimento: …\nFechamento / chamada para ação: …'} /></Field>
        <Field label="Observações para o cliente (opcional)"><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Ex.: gravar na clínica, com jaleco branco." /></Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-[#771430]" checked={f.visible} onChange={(e) => setF({ ...f, visible: e.target.checked })} /> Visível para o cliente</label>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={pending} disabled={!f.title.trim()} onClick={submit}>Salvar roteiro</Button></div>
      </div>
    </Modal>
  );
}
