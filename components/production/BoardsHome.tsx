'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Plus, Star } from 'lucide-react';
import { createBoard, setBoardFlag } from '@/lib/actions/production';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select, Textarea } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { BOARD_TEMPLATES, type ClientLite } from '@/lib/production/types';

export interface BoardCard {
  id: string;
  name: string;
  description: string;
  favorite: boolean;
  archived: boolean;
  client_name: string | null;
  open: number;
  overdue: number;
  done: number;
}

/** Lista de quadros (favoritos primeiro) + "+ Novo quadro". */
export function BoardsHome({ boards, clients }: { boards: BoardCard[]; clients: ClientLite[] }) {
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const list = boards.filter((b) => b.archived === showArchived).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  const archivedCount = boards.filter((b) => b.archived).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="h-display text-3xl text-wine">{showArchived ? 'Quadros arquivados' : 'Quadros'}</h2>
        <div className="flex flex-wrap gap-2">
          {archivedCount > 0 && <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>{showArchived ? 'Ver quadros ativos' : `Ver arquivados (${archivedCount})`}</Button>}
          <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Novo quadro</Button>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="card border-dashed px-6 py-14 text-center">
          <p className="h-display text-2xl text-wine">{showArchived ? 'Nenhum quadro arquivado' : 'Crie o seu primeiro quadro'}</p>
          {!showArchived && <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">Use o modelo de produção: Ideias → A fazer → Em produção → Em revisão → Aguardando cliente → … → Concluído.</p>}
          {!showArchived && <Button className="mt-5" onClick={() => setOpen(true)}><Plus className="size-4" /> Novo quadro</Button>}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="card card-hover group relative p-5">
              <Link href={`/admin/producao/${b.id}`} className="absolute inset-0 rounded-[inherit]" aria-label={`Abrir ${b.name}`} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="h-display truncate text-2xl text-wine">{b.name}</p>
                  {b.client_name && <p className="truncate text-xs text-wine/70">{b.client_name}</p>}
                </div>
                <div className="relative z-10 flex shrink-0 gap-0.5">
                  <button aria-label={b.favorite ? 'Remover dos favoritos' : 'Favoritar'} onClick={async () => { const r = await setBoardFlag(b.id, 'favorite', !b.favorite); if (!r.ok) toast(r.error, 'error'); router.refresh(); }} className="rounded-full p-1.5 text-wine hover:bg-blush"><Star className={cn('size-4', b.favorite && 'fill-current')} /></button>
                  <button aria-label={b.archived ? 'Restaurar' : 'Arquivar'} onClick={async () => { const r = await setBoardFlag(b.id, 'archived', !b.archived); if (!r.ok) toast(r.error, 'error'); else toast(b.archived ? 'Quadro restaurado' : 'Quadro arquivado'); router.refresh(); }} className="rounded-full p-1.5 text-wine hover:bg-blush">{b.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}</button>
                </div>
              </div>
              {b.description && <p className="mt-1 line-clamp-2 text-sm text-ink/55">{b.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-blush px-3 py-1 text-wine">{b.open} {b.open === 1 ? 'aberta' : 'abertas'}</span>
                {b.overdue > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-white">{b.overdue} {b.overdue === 1 ? 'atrasada' : 'atrasadas'}</span>}
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">{b.done} {b.done === 1 ? 'concluída' : 'concluídas'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && <NewBoard clients={clients} onClose={() => setOpen(false)} />}
    </section>
  );
}

function NewBoard({ clients, onClose }: { clients: ClientLite[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [tpl, setTpl] = useState<string>('producao');
  const [client, setClient] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const create = async () => {
    setBusy(true);
    setError(null);
    const r = await createBoard({ name, description: desc, template: tpl, client_id: client || null });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.push(`/admin/producao/${r.id}`);
  };
  return (
    <Modal open onClose={onClose} title="Novo quadro" className="sm:!max-w-xl">
      <div className="space-y-4">
        <Field label="Nome do quadro"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Conteúdo — Outubro, Identidade Visual, Soltria Interno…" maxLength={120} onKeyDown={(e) => e.key === 'Enter' && name.trim() && create()} /></Field>
        <Field label="Descrição (opcional)"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} /></Field>
        <div>
          <p className="label mb-2 text-wine">Colunas</p>
          <div className="space-y-2">
            {BOARD_TEMPLATES.map((t) => (
              <label key={t.id} className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition', tpl === t.id ? 'border-wine bg-blush-soft' : 'border-wine/15 hover:bg-blush-soft')}>
                <input type="radio" name="tpl" checked={tpl === t.id} onChange={() => setTpl(t.id)} className="mt-1 accent-[#771430]" />
                <span><span className="block text-sm text-ink">{t.label}</span><span className="text-xs text-ink/55">{t.hint}</span></span>
              </label>
            ))}
          </div>
        </div>
        <Field label="Quadro de um cliente? (opcional)" hint="Só para organizar — as tarefas de qualquer quadro podem ser de qualquer cliente."><Select value={client} onChange={(e) => setClient(e.target.value)}><option value="">Todos os clientes (quadro geral)</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <FormMessage error={error} />
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button loading={busy} disabled={!name.trim()} onClick={create}>Criar quadro</Button></div>
      </div>
    </Modal>
  );
}
