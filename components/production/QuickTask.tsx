'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { getQuickTaskOptions, quickCreateTask } from '@/lib/actions/production';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input, Select } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CATEGORIES, TASK_TEMPLATES } from '@/lib/production/types';

/** Atalho global: "+ Nova tarefa" disponível em todo o admin (criação rápida; detalhes depois). */
export function QuickTask() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<{ boards: { id: string; name: string }[]; clients: { id: string; name: string }[] } | null>(null);
  const [f, setF] = useState({ title: '', client: '', due: '', category: 'other', board: '', tpl: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const show = async () => {
    setOpen(true);
    setError(null);
    if (!opts) {
      const r = await getQuickTaskOptions();
      if (r.ok) setOpts(r);
      else setError(r.error);
    }
  };
  const create = async (openAfter: boolean) => {
    setBusy(true);
    setError(null);
    const r = await quickCreateTask({ title: f.title, client_id: f.client || null, due_date: f.due || null, category: f.category, board_id: f.board || null, templateId: f.tpl || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast('Tarefa criada ♡');
    setOpen(false);
    setF({ title: '', client: '', due: '', category: 'other', board: '', tpl: '' });
    if (openAfter) router.push(`/admin/producao/${r.boardId}?card=${r.id}`);
    else router.refresh();
  };

  return (
    <>
      <button onClick={show} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-wine px-5 py-3 text-sm text-white shadow-lg transition hover:bg-wine-dark active:scale-[0.97] max-lg:bottom-20" aria-label="Nova tarefa">
        <Plus className="size-4" /> Nova tarefa
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Nova tarefa" className="sm:!max-w-lg">
          <div className="space-y-4">
            <Field label="Título"><Input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="O que precisa ser feito?" maxLength={200} onKeyDown={(e) => e.key === 'Enter' && (f.title.trim() || f.tpl) && create(false)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cliente"><Select value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}><option value="">Sem cliente</option>{opts?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <Field label="Prazo"><Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Field>
              <Field label="Categoria"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
              <Field label="Quadro"><Select value={f.board} onChange={(e) => setF({ ...f, board: e.target.value })}><option value="">{opts?.boards.length ? 'Primeiro quadro' : 'Criar quadro “Produção”'}</option>{opts?.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            </div>
            <Field label="Modelo (opcional)" hint="Já traz checklist pronto."><Select value={f.tpl} onChange={(e) => setF({ ...f, tpl: e.target.value })}><option value="">Sem modelo</option>{TASK_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select></Field>
            <FormMessage error={error} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button variant="outline" loading={busy} disabled={!f.title.trim() && !f.tpl} onClick={() => create(true)}>Criar e abrir detalhes</Button>
              <Button loading={busy} disabled={!f.title.trim() && !f.tpl} onClick={() => create(false)}>Criar</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
