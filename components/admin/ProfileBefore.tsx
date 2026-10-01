'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Lock, Trash2, X } from 'lucide-react';
import { addProfileShot, deleteProfileShot, updateProfileShot } from '@/lib/actions/profile-shots';
import { uploadToStorage, validateFile } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/lib/utils';
import type { ProfileShot } from '@/lib/data/profile-shots';

/** "Perfil antes": prints do perfil do cliente no início do trabalho. Só a administradora vê. */
export function ProfileBefore({ ownerId, clientId, shots, missing }: { ownerId: string; clientId: string; shots: ProfileShot[]; missing: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [takenOn, setTakenOn] = useState('');
  const [open, setOpen] = useState<ProfileShot | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  if (missing) {
    return (
      <section className="card border-dashed p-5 text-center text-sm text-ink/65">
        Para guardar o print do perfil, rode <code className="rounded bg-blush px-1.5 py-0.5">supabase/migrations/0009_perfil_antes.sql</code> no SQL Editor do Supabase.
      </section>
    );
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setError(null);
    for (const f of files) {
      const err = validateFile(f, 'image');
      if (err) return setError(err);
    }
    setBusy(true);
    try {
      for (const f of files) {
        const path = await uploadToStorage(f, `${ownerId}/${clientId}/profile-before`);
        const r = await addProfileShot({ clientId, path, caption: files.length === 1 ? caption : '', takenOn });
        if (!r.ok) throw new Error(r.error);
      }
      toast(files.length > 1 ? `${files.length} prints salvos ♡` : 'Print salvo ♡');
      setCaption('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no envio.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label mb-1 flex items-center gap-1.5 text-wine/70"><Lock className="size-3" /> Só você vê</p>
          <h2 className="h-display text-2xl text-wine">Perfil antes</h2>
          <p className="mt-1 max-w-xl text-sm text-ink/60">Guarde o print do Instagram do cliente de quando você começou. Não aparece no link do cliente nem nos relatórios.</p>
        </div>
        <Button variant="outline" loading={busy} onClick={() => ref.current?.click()}><ImagePlus className="size-4" /> Adicionar print</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Legenda (opcional)"><Input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="Ex.: Perfil em outubro/2026, antes da Soltria" /></Field>
        <Field label="Data do print (opcional)"><Input type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} /></Field>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
      <div className="mt-3"><FormMessage error={error} /></div>
      {busy && <p className="mt-3 flex items-center gap-2 text-sm text-wine"><Loader2 className="size-4 animate-spin" /> Enviando…</p>}

      {shots.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shots.map((s) => (
            <li key={s.id} className="overflow-hidden rounded-2xl border border-wine/15 bg-white">
              <button type="button" onClick={() => setOpen(s)} className="block aspect-[9/16] w-full overflow-hidden bg-blush" aria-label="Abrir print">
                {s.url && (
                  <img src={s.url} alt={s.caption || 'Print do perfil antes'} className="size-full object-cover object-top" />
                )}
              </button>
              <div className="flex items-start gap-1 p-2.5">
                <p className="min-w-0 flex-1 text-xs text-ink/65">{s.caption || 'Sem legenda'}{s.taken_on ? ` · ${fmtDate(s.taken_on, true)}` : ''}</p>
                <button aria-label="Excluir print" disabled={pending} onClick={() => confirm('Excluir este print?') && start(async () => {
                  const r = await deleteProfileShot(s.id);
                  if (!r.ok) return toast(r.error, 'error');
                  toast('Print excluído');
                  router.refresh();
                })} className="rounded-full p-1.5 text-wine hover:bg-blush"><Trash2 className="size-3.5" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <Modal open onClose={() => setOpen(null)} title="Perfil antes" className="sm:!max-w-xl">
          <img src={open.url} alt={open.caption || 'Print do perfil antes'} className="mx-auto max-h-[70vh] w-auto rounded-2xl" />
          <EditCaption shot={open} onDone={() => setOpen(null)} />
        </Modal>
      )}
    </section>
  );
}

function EditCaption({ shot, onDone }: { shot: ProfileShot; onDone: () => void }) {
  const [c, setC] = useState(shot.caption);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="mt-4 flex gap-2">
      <Input value={c} onChange={(e) => setC(e.target.value)} maxLength={300} placeholder="Legenda" />
      <Button loading={pending} onClick={() => start(async () => {
        const r = await updateProfileShot(shot.id, { caption: c });
        if (!r.ok) return toast(r.error, 'error');
        toast('Legenda salva ♡');
        onDone();
        router.refresh();
      })}>Salvar</Button>
      <Button variant="ghost" onClick={onDone} aria-label="Fechar"><X className="size-4" /></Button>
    </div>
  );
}
