'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Copy, Plus, Repeat, Trash2 } from 'lucide-react';
import { addColumn, addMember, createTag, deleteBoard, deleteColumn, deleteRecurrence, deleteTag, duplicateBoard, moveColumn, removeMember, saveBoardSettings, saveRecurrence, setRecurrenceActive, updateBoard, updateColumn, updateTag } from '@/lib/actions/production';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { CATEGORIES, COLUMN_KINDS, PRIORITIES, SYNC_KINDS, TAG_COLORS, type BoardRow, type ClientLite, type ColumnRow, type MemberRow, type TagRow } from '@/lib/production/types';
import { MemberAvatar, useRun } from './shared';

export interface RecurrenceRow {
  id: string;
  title: string;
  column_id: string;
  client_id: string | null;
  category: string;
  priority: string;
  cadence: 'daily' | 'weekly' | 'monthly' | 'custom';
  weekday: number | null;
  month_day: number | null;
  every_days: number | null;
  due_offset: number;
  next_run: string;
  active: boolean;
}
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const cadenceText = (r: RecurrenceRow) => (r.cadence === 'daily' ? 'Todo dia' : r.cadence === 'weekly' ? `Toda ${WEEKDAYS[r.weekday ?? 1].toLowerCase()}` : r.cadence === 'monthly' ? `Todo dia ${String(r.month_day ?? 1).padStart(2, '0')}` : `A cada ${r.every_days} dias`);

const TABS = [['geral', 'Geral'], ['colunas', 'Colunas'], ['automacao', 'Automações'], ['recorrentes', 'Recorrentes'], ['equipe', 'Equipe e tags']] as const;

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-wine/15 p-4">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-[#771430]" />
      <span><span className="block text-sm text-ink">{label}</span>{hint && <span className="mt-0.5 block text-xs text-ink/55">{hint}</span>}</span>
    </label>
  );
}

export function BoardSettingsModal({ board, columns, members, tags, clients, recurrences, onClose }: { board: BoardRow; columns: ColumnRow[]; members: MemberRow[]; tags: TagRow[]; clients: ClientLite[]; recurrences: RecurrenceRow[]; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('geral');
  const { run, pending } = useRun();
  const rt = useRouter();
  const [name, setName] = useState(board.name);
  const [desc, setDesc] = useState(board.description);
  const [newCol, setNewCol] = useState('');
  const [delCol, setDelCol] = useState<{ col: ColumnRow; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = board.settings;
  const [rec, setRec] = useState<{ title: string; column_id: string; cadence: string; weekday: number; month_day: number; every_days: number; category: string; priority: string; client_id: string; due_offset: number } | null>(null);
  const [mName, setMName] = useState('');
  const [mRole, setMRole] = useState('');
  const [tName, setTName] = useState('');
  const set = (patch: Parameters<typeof saveBoardSettings>[1], msg = 'Salvo ♡') => run(() => saveBoardSettings(board.id, patch), msg);

  return (
    <Modal open onClose={onClose} title="Configurações do quadro" className="sm:!max-w-3xl">
      <div className="no-scrollbar -mx-1 mb-5 flex gap-4 overflow-x-auto border-b border-wine/15 px-1">
        {TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={cn('-mb-px shrink-0 border-b-2 pb-2.5 text-sm transition', tab === id ? 'border-wine text-wine' : 'border-transparent text-ink/55 hover:text-wine')}>{label}</button>)}
      </div>
      <FormMessage error={error} />

      {tab === 'geral' && (
        <div className="space-y-4">
          <Field label="Nome do quadro"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
          <Field label="Descrição"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button loading={pending} onClick={() => run(() => updateBoard(board.id, { name, description: desc }), 'Quadro atualizado ♡')}>Salvar</Button>
            <Button variant="outline" loading={pending} onClick={() => run(() => duplicateBoard(board.id, false), 'Quadro duplicado (colunas e configurações) ♡')}><Copy className="size-4" /> Duplicar quadro</Button>
            <Button variant="outline" loading={pending} onClick={() => run(() => duplicateBoard(board.id, true), 'Quadro duplicado com as tarefas ♡')}><Copy className="size-4" /> Duplicar com tarefas</Button>
            <Button variant="danger" onClick={() => confirm(`Excluir o quadro “${board.name}” com todas as tarefas, checklists, comentários e anexos? Não dá para desfazer. (Para guardar sem excluir, use Arquivar.)`) && run(() => deleteBoard(board.id), 'Quadro excluído', () => rt.push('/admin/producao'))}><Trash2 className="size-4" /> Excluir</Button>
          </div>
        </div>
      )}

      {tab === 'colunas' && (
        <div className="space-y-3">
          <p className="text-sm text-ink/60">Renomeie, reordene, adicione ou remova colunas. O “papel” de cada coluna alimenta a sincronização de status, o dashboard e as métricas.</p>
          <ul className="space-y-2">
            {columns.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-blush-soft px-3 py-2">
                <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && run(() => updateColumn(c.id, { name: e.target.value }))} className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none focus:underline" aria-label="Nome da coluna" />
                <Select value={c.kind} onChange={(e) => run(() => updateColumn(c.id, { kind: e.target.value }))} className="!w-auto !py-1 text-xs" aria-label="Papel da coluna">
                  {COLUMN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                </Select>
                <button aria-label="Mover para a esquerda" disabled={i === 0} onClick={() => run(() => moveColumn(c.id, -1))} className="rounded-full p-1.5 text-wine hover:bg-blush disabled:opacity-30"><ArrowLeft className="size-4" /></button>
                <button aria-label="Mover para a direita" disabled={i === columns.length - 1} onClick={() => run(() => moveColumn(c.id, 1))} className="rounded-full p-1.5 text-wine hover:bg-blush disabled:opacity-30"><ArrowRight className="size-4" /></button>
                <button aria-label="Remover coluna" onClick={() => { setError(null); setDelCol({ col: c, to: columns.find((x) => x.id !== c.id)?.id ?? '' }); }} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input value={newCol} onChange={(e) => setNewCol(e.target.value)} placeholder="Nova coluna…" maxLength={80} onKeyDown={(e) => e.key === 'Enter' && newCol.trim() && run(() => addColumn(board.id, newCol), 'Coluna adicionada ♡', () => setNewCol(''))} />
            <Button variant="soft" disabled={!newCol.trim()} loading={pending} onClick={() => run(() => addColumn(board.id, newCol), 'Coluna adicionada ♡', () => setNewCol(''))}><Plus className="size-4" /> Adicionar</Button>
          </div>
          {delCol && (
            <div className="rounded-2xl border border-wine/30 bg-blush p-4">
              <p className="text-sm text-wine">Remover a coluna “{delCol.col.name}”? As tarefas dela vão para:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select value={delCol.to} onChange={(e) => setDelCol({ ...delCol, to: e.target.value })} className="!w-auto !py-1.5 text-sm">{columns.filter((c) => c.id !== delCol.col.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                <Button size="sm" loading={pending} onClick={() => run(() => deleteColumn(delCol.col.id, delCol.to || undefined), 'Coluna removida', () => setDelCol(null))}>Remover</Button>
                <Button size="sm" variant="ghost" onClick={() => setDelCol(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'automacao' && (
        <div className="space-y-3">
          <Toggle on={!!s.sync_status} onChange={(v) => set({ sync_status: v })} label="Sincronizar status automaticamente" hint={`Cards vinculados a um conteúdo mudam de coluna sozinhos: enviado para aprovação → “Aguardando cliente”; cliente pede alteração → “Alteração solicitada”; cliente aprova → “Aprovado”; programado → “Agendado”; publicado → “Publicado”. Depende do papel de cada coluna (aba Colunas). Desligado, nada se move sozinho.`} />
          <Toggle on={!!s.auto_create} onChange={(v) => set({ auto_create: v })} label="Criar tarefa automaticamente ao criar um conteúdo" hint="Cada conteúdo novo gera um card (cliente, prazo = data de publicação, checklist do formato) já vinculado ao conteúdo." />
          {s.auto_create && (
            <Field label="Coluna onde os cards automáticos entram">
              <Select value={s.auto_create_column_id ?? ''} onChange={(e) => set({ auto_create_column_id: e.target.value || null })}>
                <option value="">Primeira coluna</option>
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
          )}
          <Toggle on={!!s.require_checklist_for_done} onChange={(v) => set({ require_checklist_for_done: v })} label="Só permitir concluir com a checklist 100%" hint="Ao arrastar para “Publicado” ou “Concluído”, o sistema avisa se ainda houver itens abertos." />
          <Toggle on={!!s.hide_done} onChange={(v) => set({ hide_done: v })} label="Ocultar cards concluídos por padrão" hint="Você ainda pode mostrar pelo botão “Mostrar concluídos” no quadro." />
          <p className="text-xs text-ink/45">Prazos: o sistema já destaca ATRASADO, HOJE e AMANHÃ nos cards automaticamente.</p>
          <p className="text-xs text-ink/45">Colunas com papel de sincronização: {SYNC_KINDS.map((k) => COLUMN_KINDS.find((x) => x.id === k)?.label).join(', ')}.</p>
        </div>
      )}

      {tab === 'recorrentes' && (
        <div className="space-y-3">
          <p className="text-sm text-ink/60">Tarefas que se repetem (relatório mensal, planejamento, reunião semanal…). O card novo aparece sozinho quando você abre o quadro depois da data.</p>
          <ul className="space-y-2">
            {recurrences.map((r) => (
              <li key={r.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl bg-blush-soft px-4 py-2.5 text-sm', !r.active && 'opacity-55')}>
                <Repeat className="size-4 text-wine" />
                <span className="min-w-0 flex-1"><span className="block truncate">{r.title}</span><span className="text-xs text-ink/50">{cadenceText(r)} · próxima: {r.next_run.split('-').reverse().join('/')}</span></span>
                <button onClick={() => run(() => setRecurrenceActive(r.id, !r.active))} className="rounded-full border border-wine/25 px-3 py-1 text-xs text-wine hover:bg-blush">{r.active ? 'Pausar' : 'Ativar'}</button>
                <button aria-label="Excluir" onClick={() => confirm('Excluir esta tarefa recorrente? Os cards já criados continuam.') && run(() => deleteRecurrence(r.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
              </li>
            ))}
            {recurrences.length === 0 && <li className="text-sm text-ink/50">Nenhuma tarefa recorrente.</li>}
          </ul>
          {!rec ? (
            <Button variant="soft" onClick={() => setRec({ title: '', column_id: columns.find((c) => c.kind === 'todo')?.id ?? columns[0]?.id ?? '', cadence: 'monthly', weekday: 1, month_day: 1, every_days: 7, category: 'other', priority: 'medium', client_id: '', due_offset: 0 })}><Plus className="size-4" /> Nova tarefa recorrente</Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-wine/20 p-4">
              <Field label="Título"><Input value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} placeholder="Ex.: Relatório mensal" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Frequência">
                  <Select value={rec.cadence} onChange={(e) => setRec({ ...rec, cadence: e.target.value })}><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="custom">Personalizada</option></Select>
                </Field>
                {rec.cadence === 'weekly' && <Field label="Dia da semana"><Select value={rec.weekday} onChange={(e) => setRec({ ...rec, weekday: Number(e.target.value) })}>{WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}</option>)}</Select></Field>}
                {rec.cadence === 'monthly' && <Field label="Dia do mês"><Input type="number" min={1} max={31} value={rec.month_day} onChange={(e) => setRec({ ...rec, month_day: Number(e.target.value) })} /></Field>}
                {rec.cadence === 'custom' && <Field label="A cada quantos dias"><Input type="number" min={1} max={365} value={rec.every_days} onChange={(e) => setRec({ ...rec, every_days: Number(e.target.value) })} /></Field>}
                <Field label="Coluna"><Select value={rec.column_id} onChange={(e) => setRec({ ...rec, column_id: e.target.value })}>{columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label="Cliente (opcional)"><Select value={rec.client_id} onChange={(e) => setRec({ ...rec, client_id: e.target.value })}><option value="">Sem cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
                <Field label="Categoria"><Select value={rec.category} onChange={(e) => setRec({ ...rec, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
                <Field label="Prioridade"><Select value={rec.priority} onChange={(e) => setRec({ ...rec, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field>
                <Field label="Prazo (dias depois de criada)" hint="0 = vence no próprio dia."><Input type="number" min={0} max={60} value={rec.due_offset} onChange={(e) => setRec({ ...rec, due_offset: Number(e.target.value) })} /></Field>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setRec(null)}>Cancelar</Button>
                <Button loading={pending} disabled={!rec.title.trim()} onClick={() => run(() => saveRecurrence(board.id, { ...rec, client_id: rec.client_id || null, weekday: rec.weekday, month_day: rec.month_day, every_days: rec.every_days }), 'Tarefa recorrente salva ♡', () => setRec(null))}>Salvar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'equipe' && (
        <div className="space-y-6">
          <div>
            <p className="label mb-2 text-wine">Equipe</p>
            <p className="mb-3 text-sm text-ink/60">Hoje só você usa o sistema, mas já dá para cadastrar a equipe (Designer, Editor, Social Media…) e atribuir tarefas.</p>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-blush-soft px-3 py-2 text-sm"><MemberAvatar member={m} className="size-7" /><span className="flex-1">{m.name}{m.role ? <span className="text-ink/50"> · {m.role}</span> : null}</span>
                  {!m.user_id && <button aria-label="Remover membro" onClick={() => confirm(`Remover ${m.name}?`) && run(() => removeMember(m.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>}
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nome" maxLength={80} />
              <Input value={mRole} onChange={(e) => setMRole(e.target.value)} placeholder="Função (Designer, Editor…)" maxLength={60} />
              <Button variant="soft" disabled={!mName.trim()} loading={pending} onClick={() => run(() => addMember({ name: mName, role: mRole }), 'Membro adicionado ♡', () => { setMName(''); setMRole(''); })}><Plus className="size-4" /> Adicionar</Button>
            </div>
          </div>
          <div>
            <p className="label mb-2 text-wine">Tags</p>
            <ul className="space-y-2">
              {tags.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-blush-soft px-3 py-2">
                  <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && run(() => updateTag(t.id, { name: e.target.value }))} className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none focus:underline" aria-label="Nome da tag" />
                  <div className="flex gap-1">{TAG_COLORS.map((c) => <button key={c} aria-label={`Cor ${c}`} onClick={() => run(() => updateTag(t.id, { color: c }))} className={cn('size-5 rounded-full ring-offset-1', t.color === c && 'ring-2 ring-wine')} style={{ background: c }} />)}</div>
                  <button aria-label="Excluir tag" onClick={() => confirm(`Excluir a tag “${t.name}”? Ela sai de todos os cards.`) && run(() => deleteTag(t.id))} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-4" /></button>
                </li>
              ))}
              {tags.length === 0 && <li className="text-sm text-ink/50">Nenhuma tag ainda. Crie dentro de um card (URGENTE, INSTAGRAM, CAMPANHA…) ou abaixo.</li>}
            </ul>
            <div className="mt-3 flex gap-2">
              <Input value={tName} onChange={(e) => setTName(e.target.value)} placeholder="Nova tag…" maxLength={40} />
              <Button variant="soft" disabled={!tName.trim()} loading={pending} onClick={() => run(() => createTag(tName, TAG_COLORS[tags.length % TAG_COLORS.length]), 'Tag criada ♡', () => setTName(''))}><Plus className="size-4" /> Criar</Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
