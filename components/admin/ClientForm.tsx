'use client';

import { useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Loader2 } from 'lucide-react';
import { saveClient } from '@/lib/actions/clients';
import type { ActionResult } from '@/lib/actions/shared';
import type { ClientWithProject } from '@/lib/types';
import { uploadToStorage, validateFile } from '@/lib/upload';
import { Button, buttonClass } from '@/components/ui/Button';
import { Field, FormMessage, Input, Textarea } from '@/components/ui/Fields';
import { Avatar } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';

export function ClientForm({ ownerId, newId, client, next }: { ownerId: string; newId: string; client?: ClientWithProject; next?: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(saveClient, null);
  const id = client?.id ?? newId;
  const [avatarPath, setAvatarPath] = useState<string | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(client?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [name, setName] = useState(client?.company_name ?? '');

  async function pick(file?: File) {
    if (!file) return;
    const err = validateFile(file, 'image');
    if (err) return toast(err, 'error');
    setUploading(true);
    try {
      setAvatarPath(await uploadToStorage(file, `${ownerId}/${id}/avatar`));
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no upload.', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={action} className="card space-y-6 p-6 sm:p-8">
      <input type="hidden" name="id" value={id} />
      {client && <input type="hidden" name="editing" value={client.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      {avatarPath !== undefined && <input type="hidden" name="avatar_path" value={avatarPath} />}

      <div className="flex items-center gap-5">
        <button type="button" onClick={() => fileRef.current?.click()} className="group relative shrink-0" aria-label="Enviar foto ou logo">
          <Avatar name={name || 'Cliente'} src={preview} className="size-24 text-2xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-wine/70 text-white opacity-0 transition group-hover:opacity-100">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
          </span>
        </button>
        <div>
          <p className="label text-wine">Foto / logo</p>
          <p className="mt-1 text-sm text-ink/60">Clique no círculo para enviar. Aparece no perfil e nas publicações simuladas.</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome da empresa *">
          <Input name="company_name" required defaultValue={client?.company_name} onChange={(e) => setName(e.target.value)} placeholder="C&M Estética Avançada" />
        </Field>
        <Field label="@ do Instagram">
          <Input name="instagram_handle" defaultValue={client?.instagram_handle} placeholder="@cliente" />
        </Field>
        <Field label="Responsável *" hint="Esse nome assina as aprovações e comentários do cliente.">
          <Input name="contact_name" required defaultValue={client?.contact_name} placeholder="Nome da pessoa" />
        </Field>
        <Field label="E-mail do responsável" hint="Usado nos avisos por e-mail (quando ativados).">
          <Input name="contact_email" type="email" defaultValue={client?.contact_email ?? ''} placeholder="contato@empresa.com" />
        </Field>
        <Field label="Nome exibido no perfil do Instagram" className="sm:col-span-2">
          <Input name="display_name" defaultValue={client?.display_name ?? ''} placeholder="Como aparece acima da bio" />
        </Field>
        <Field label="Bio do Instagram" className="sm:col-span-2" hint="Usada na simulação do perfil.">
          <Textarea name="bio" rows={3} defaultValue={client?.bio} placeholder="Estética avançada ✨ …" />
        </Field>
        <Field label="Observações" className="sm:col-span-2" hint="Apenas para você — o cliente não vê.">
          <Textarea name="notes" rows={3} defaultValue={client?.notes} />
        </Field>
      </div>

      <FormMessage error={state && !state.ok ? state.error : null} />
      <div className="flex flex-wrap justify-end gap-3">
        <Link href={client ? `/admin/clients/${client.id}` : '/admin/clients'} className={buttonClass('ghost')}>
          Cancelar
        </Link>
        <Button type="submit" loading={pending || uploading}>
          {client ? 'Salvar alterações' : 'Criar cliente'}
        </Button>
      </div>
    </form>
  );
}
