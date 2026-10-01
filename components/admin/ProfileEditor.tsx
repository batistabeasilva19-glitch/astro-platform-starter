'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { updateProfile } from '@/lib/actions/profile';
import { uploadToStorage, validateFile } from '@/lib/upload';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Fields';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';

interface Props {
  ownerId: string;
  name: string;
  hasName: boolean;
  avatarUrl: string | null;
  avatarPath: string | null;
}

/** "Editar perfil": nome e foto da administradora, direto da saudação do painel. */
export function ProfileEditor({ ownerId, name, hasName, avatarUrl, avatarPath }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(hasName ? name : '');
  const [path, setPath] = useState<string | null | undefined>(undefined); // undefined = não mexeu na foto
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  async function pick(file?: File) {
    if (!file) return;
    const err = validateFile(file, 'image');
    if (err) return setError(err);
    setError(null);
    setUploading(true);
    try {
      setPath(await uploadToStorage(file, `${ownerId}/profile`));
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no upload da foto.');
    } finally {
      setUploading(false);
    }
  }

  const save = () =>
    start(async () => {
      setError(null);
      const r = await updateProfile({ name: value, avatarPath: path });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setPath(undefined);
      toast('Perfil atualizado ♡');
      router.refresh();
    });

  return (
    <>
      <button
        onClick={() => {
          setValue(hasName ? name : '');
          setPreview(avatarUrl);
          setPath(undefined);
          setError(null);
          setOpen(true);
        }}
        className="group flex items-center gap-4 text-left"
        aria-label="Editar perfil"
      >
        <span className="relative shrink-0">
          <Avatar name={name} src={avatarUrl} className="size-20 text-2xl ring-2 ring-wine/20 ring-offset-4 sm:size-24" />
          <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-wine text-white transition group-hover:scale-110">
            <Camera className="size-4" />
          </span>
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Meu perfil">
        <div className="mb-6 flex items-center gap-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" aria-label="Trocar foto">
            <Avatar name={value || name} src={preview} className="size-24 text-3xl" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-wine/70 text-white opacity-0 transition group-hover:opacity-100">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </span>
          </button>
          <div className="space-y-2">
            <p className="text-sm text-ink/65">Sua foto aparece no painel. Clique nela para trocar.</p>
            {(preview || avatarPath) && (
              <button
                type="button"
                onClick={() => {
                  setPath(null);
                  setPreview(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-wine hover:underline"
              >
                <Trash2 className="size-3.5" /> Remover foto
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <Field label="Como você quer ser chamada?" hint="Aparece na saudação: “Olá, ___ ♡”.">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Bia" maxLength={80} autoFocus />
        </Field>
        <div className="mt-3"><FormMessage error={error} /></div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} loading={pending || uploading} disabled={!value.trim()}>Salvar</Button>
        </div>
      </Modal>
    </>
  );
}
