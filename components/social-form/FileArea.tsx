'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { createSocialUpload, registerSocialFile, removeSocialFile, setSocialFileCaption } from '@/lib/actions/social-form-files';
import { FILE_GROUPS, type FileGroup, type SocialFile } from '@/lib/social-form/questions';
import { MEDIA_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { LightImage } from '@/components/content/LightImage';
import { useToast } from '@/components/ui/Toast';

export type FileWithUrl = SocialFile & { url: string | null };
const isImage = (f: { mime: string; name: string }) => f.mime.startsWith('image/') && !/svg/.test(f.mime);

/** Área de envio de arquivos por grupo (logo, fotos, referências…). O arquivo vai direto do aparelho para o Storage. */
export function FileArea({ token, files, groups }: { token: string; files: FileWithUrl[]; groups: readonly FileGroup[] }) {
  return (
    <div className="space-y-8">
      {FILE_GROUPS.filter((g) => groups.includes(g.id)).map((g) => (
        <Group key={g.id} token={token} group={g.id} label={g.label} hint={g.hint} files={files.filter((f) => f.group === g.id)} />
      ))}
      <p className="text-xs text-ink/45">Imagens, PDF, ZIP, vídeo (MP4/MOV) ou documentos · até 25 MB cada. Arquivos maiores: coloque o link do Drive na lista de links.</p>
    </div>
  );
}

function Group({ token, group, label, hint, files }: { token: string; group: FileGroup; label: string; hint: string; files: FileWithUrl[] }) {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(list: File[]) {
    for (const [i, f] of list.entries()) {
      setBusy(`Enviando ${i + 1} de ${list.length}…`);
      try {
        const r = await createSocialUpload(token, { fileName: f.name, mime: f.type, size: f.size });
        if (!r.ok) throw new Error(r.error);
        const { error } = await createClient().storage.from(MEDIA_BUCKET).uploadToSignedUrl(r.path, r.uploadToken, f, { contentType: f.type || undefined });
        if (error) throw new Error(error.message);
        const reg = await registerSocialFile(token, { path: r.path, fileName: f.name, mime: f.type, group });
        if (!reg.ok) throw new Error(reg.error);
      } catch (e) {
        toast(`${f.name}: ${e instanceof Error ? e.message : 'falha no envio'}`, 'error');
      }
    }
    setBusy(null);
    router.refresh();
  }

  return (
    <section>
      <h4 className="text-[0.95rem] font-medium text-ink">{label}</h4>
      <p className="mb-3 text-xs text-ink/50">{hint}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {files.map((f) => <FileCard key={f.id} token={token} file={f} />)}
        <button type="button" disabled={!!busy} onClick={() => ref.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-wine/30 p-3 text-center text-xs text-wine transition hover:border-wine hover:bg-blush disabled:opacity-70">
          {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
          {busy ?? 'Adicionar arquivos'}
        </button>
      </div>
      <input ref={ref} type="file" multiple hidden onChange={(e) => { upload([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </section>
  );
}

function FileCard({ token, file }: { token: string; file: FileWithUrl }) {
  const router = useRouter();
  const toast = useToast();
  const [caption, setCaption] = useState(file.caption);
  const [pending, setPending] = useState(false);
  return (
    <figure className="overflow-hidden rounded-2xl border border-wine/20 bg-white">
      <div className="relative aspect-square bg-blush">
        {file.url && isImage(file) ? (
          <LightImage src={file.url} alt={file.name} width={420} className="size-full object-cover" />
        ) : (
          <a href={file.url ?? undefined} target="_blank" rel="noopener noreferrer" className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-xs text-wine">
            <FileText className="size-8" />
            <span className="line-clamp-2 break-all">{file.name}</span>
          </a>
        )}
        <button
          aria-label="Remover arquivo"
          disabled={pending}
          onClick={async () => {
            if (!confirm(`Remover “${file.name}”?`)) return;
            setPending(true);
            const r = await removeSocialFile(token, file.id);
            setPending(false);
            if (!r.ok) return toast(r.error, 'error');
            router.refresh();
          }}
          className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-wine transition hover:bg-wine hover:text-white"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      <input value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={async () => caption !== file.caption && (await setSocialFileCaption(token, file.id, caption))} placeholder="Observação (opcional)" aria-label="Observação sobre o arquivo" maxLength={300} className="w-full border-t border-wine/15 px-3 py-2 text-xs outline-none placeholder:text-ink/35 focus:bg-blush/40" />
    </figure>
  );
}
