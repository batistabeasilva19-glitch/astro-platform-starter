'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, ExternalLink, FolderOpen, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { saveIdentityLinks } from '@/lib/actions/identity';
import { newId, type QuickLink, type QuickLinkKind } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

const KIND: Record<QuickLinkKind, { label: string; icon: typeof Link2; placeholder: string }> = {
  drive: { label: 'Pasta do Drive', icon: FolderOpen, placeholder: 'https://drive.google.com/drive/folders/…' },
  form: { label: 'Formulário do Google', icon: ClipboardList, placeholder: 'https://forms.gle/… ou https://docs.google.com/forms/…' },
  other: { label: 'Outro link', icon: Link2, placeholder: 'https://…' },
};

/** Atalhos privados do projeto (só a administradora vê): botões de acesso rápido + editor. */
export function QuickLinks({ projectId, links }: { projectId: string; links: QuickLink[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuickLink[]>(links);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const up = (id: string, patch: Partial<QuickLink>) => setDraft((d) => d.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const add = (kind: QuickLinkKind) => setDraft((d) => [...d, { id: newId(), kind, label: KIND[kind].label, url: '' }]);
  const save = () =>
    start(async () => {
      const r = await saveIdentityLinks(projectId, draft);
      if (!r.ok) return toast(r.error, 'error');
      toast('Links salvos ♡');
      setOpen(false);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) => {
        const Icon = KIND[l.kind].icon;
        return (
          <a key={l.id} href={l.url} target="_blank" rel="noreferrer noopener" className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[0.8rem] transition', l.kind === 'other' ? 'border-wine/30 text-wine hover:bg-blush' : 'border-wine bg-wine text-white hover:bg-wine-dark')}>
            <Icon className="size-4" /> {l.label} <ExternalLink className="size-3 opacity-70" />
          </a>
        );
      })}
      <button
        onClick={() => {
          setDraft(links);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-wine/40 px-4 py-2 text-[0.8rem] text-wine transition hover:bg-blush"
      >
        {links.length ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />} {links.length ? 'Editar links' : 'Adicionar links (Drive, formulário)'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Links de acesso rápido" className="sm:!max-w-2xl">
        <p className="mb-4 text-sm text-ink/65">Atalhos só seus (o cliente não vê): pasta do Drive, formulário do Google e o que mais precisar.</p>
        <div className="space-y-3">
          {draft.map((l) => (
            <div key={l.id} className="grid gap-2 rounded-2xl border border-wine/15 p-3 sm:grid-cols-[11rem_1fr_auto]">
              <Select value={l.kind} onChange={(e) => up(l.id, { kind: e.target.value as QuickLinkKind })} aria-label="Tipo de link">
                {(Object.keys(KIND) as QuickLinkKind[]).map((k) => (
                  <option key={k} value={k}>{KIND[k].label}</option>
                ))}
              </Select>
              <div className="grid gap-2">
                <Input value={l.label} onChange={(e) => up(l.id, { label: e.target.value })} placeholder="Nome do botão" aria-label="Nome do link" />
                <Input value={l.url} onChange={(e) => up(l.id, { url: e.target.value })} placeholder={KIND[l.kind].placeholder} inputMode="url" aria-label="Endereço do link" />
              </div>
              <button aria-label="Remover link" onClick={() => setDraft((d) => d.filter((x) => x.id !== l.id))} className="self-start rounded-full p-2 text-wine transition hover:bg-blush">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {draft.length === 0 && <p className="rounded-2xl bg-blush/60 px-4 py-6 text-center text-sm text-ink/60">Nenhum link ainda. Adicione abaixo.</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => add('drive')}><FolderOpen className="size-4" /> Pasta do Drive</Button>
          <Button size="sm" variant="outline" onClick={() => add('form')}><ClipboardList className="size-4" /> Formulário</Button>
          <Button size="sm" variant="ghost" onClick={() => add('other')}><Plus className="size-4" /> Outro</Button>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} loading={pending}>Salvar links</Button>
        </div>
      </Modal>
    </div>
  );
}
