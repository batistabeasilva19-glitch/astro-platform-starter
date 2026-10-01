'use client';

import { LightImage } from '@/components/content/LightImage';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImagePlus, Loader2, Trash2, UploadCloud, Video } from 'lucide-react';
import type { ContentFormat, SignedMedia, VersionWithMedia } from '@/lib/types';
import { registerMedia, removeMedia, reorderMedia, setDuration } from '@/lib/actions/content';
import { readVideoDuration, shrinkImage, uploadToStorage, validateFile } from '@/lib/upload';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtDuration } from '@/lib/utils';

interface Props {
  ownerId: string;
  clientId: string;
  contentId: string;
  format: ContentFormat;
  version: VersionWithMedia;
  editable: boolean;
}

export function MediaManager({ ownerId, clientId, contentId, format, version, editable }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const images = version.media.filter((m) => m.kind === 'image').sort((a, b) => a.position - b.position);
  const [order, setOrder] = useState<string[] | null>(null);
  const shown = order ? order.map((id) => images.find((i) => i.id === id)).filter((x): x is SignedMedia => !!x) : images;
  const folder = `${ownerId}/${clientId}/${contentId}`;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function upload(files: File[], kind: 'image' | 'video' | 'cover') {
    if (!files.length) return;
    const checkKind = kind === 'video' ? 'video' : 'image';
    for (const f of files) {
      const err = validateFile(f, checkKind);
      if (err) return toast(err, 'error');
    }
    setBusy(kind);
    try {
      for (const f of files) {
        const file = kind === 'video' ? f : await shrinkImage(f);
        const path = await uploadToStorage(file, folder);
        const res = await registerMedia({ contentId, versionId: version.id, kind, path, mime: file.type });
        if (!res.ok) throw new Error(res.error);
        if (kind === 'video') {
          const d = await readVideoDuration(f);
          if (d) await setDuration(contentId, d);
        }
      }
      toast(kind === 'image' && files.length > 1 ? `${files.length} imagens enviadas` : 'Arquivo enviado');
      setOrder(null);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Falha no upload.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    const res = await removeMedia(id);
    setBusy(null);
    if (!res.ok) return toast(res.error, 'error');
    setOrder(null);
    router.refresh();
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = shown.map((i) => i.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setOrder(next);
    const res = await reorderMedia(version.id, next);
    if (!res.ok) toast(res.error, 'error');
    router.refresh();
  }

  if (!editable) {
    return <p className="rounded-2xl bg-blush/70 px-4 py-3 text-sm text-wine">Você está vendo uma versão anterior (somente leitura). Para editar, volte para a versão atual.</p>;
  }

  const isVideo = format === 'reel' || format === 'video';
  const video = version.media.find((m) => m.kind === 'video');
  const cover = version.media.find((m) => m.kind === 'cover');
  const label = format === 'story' ? 'Tela' : 'Slide';

  if (isVideo) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot
          title={format === 'reel' ? 'Vídeo do Reel' : 'Vídeo'}
          hint={`MP4 ou MOV · até ${200} MB`}
          accept="video/*"
          icon={<Video className="size-6" />}
          loading={busy === 'video'}
          onFiles={(f) => upload(f, 'video')}
          filled={!!video}
          onRemove={video ? () => remove(video.id) : undefined}
          preview={video ? <video src={video.url} className="size-full object-cover" muted playsInline /> : null}
          footer={version.duration_seconds ? `Duração: ${fmtDuration(version.duration_seconds)}` : undefined}
          aspect="aspect-[9/16]"
        />
        <Slot
          title="Capa"
          hint="Aparece no feed e como poster do vídeo"
          accept="image/*"
          icon={<ImagePlus className="size-6" />}
          loading={busy === 'cover'}
          onFiles={(f) => upload(f, 'cover')}
          filled={!!cover}
          onRemove={cover ? () => remove(cover.id) : undefined}
          preview={cover ? <LightImage src={cover.url} alt="Capa" width={540} className="size-full object-cover" /> : null}
          aspect="aspect-[9/16]"
        />
      </div>
    );
  }

  if (format === 'post') {
    const img = images[0];
    return (
      <div className="max-w-xs">
        <Slot
          title="Arte do post"
          hint="Formato recomendado 4:5 (1080×1350)"
          accept="image/*"
          icon={<ImagePlus className="size-6" />}
          loading={busy === 'image'}
          onFiles={(f) => upload(f.slice(0, 1), 'image')}
          filled={!!img}
          onRemove={img ? () => remove(img.id) : undefined}
          preview={img ? <LightImage src={img.url} alt="Arte" width={540} className="size-full object-cover" /> : null}
          aspect="aspect-[4/5]"
        />
      </div>
    );
  }

  // carrossel / story: várias imagens em ordem, com drag and drop
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={shown.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {shown.map((m, i) => (
              <SortableThumb key={m.id} media={m} label={`${label} ${String(i + 1).padStart(2, '0')}`} aspect={format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} busy={busy === m.id} onRemove={() => remove(m.id)} />
            ))}
            <AddTile loading={busy === 'image'} aspect={format === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} label={`Adicionar ${label.toLowerCase()}s`} onFiles={(f) => upload(f, 'image')} />
          </div>
        </SortableContext>
      </DndContext>
      <p className="mt-3 text-xs text-ink/55">Arraste pelo ícone ⠿ para reorganizar. A ordem acima é a ordem que o cliente vê.</p>
    </div>
  );
}

function SortableThumb({ media, label, aspect, busy, onRemove }: { media: SignedMedia; label: string; aspect: string; busy: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('group relative overflow-hidden rounded-2xl border border-wine/20 bg-blush', aspect, isDragging && 'z-10 opacity-60 ring-2 ring-wine')}>
      <LightImage src={media.url} alt={label} width={360} className="size-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pb-1.5 pt-6 text-[0.68rem] text-white">{label}</span>
      <button {...attributes} {...listeners} aria-label={`Arrastar ${label}`} className="absolute left-1.5 top-1.5 cursor-grab touch-none rounded-full bg-white/90 p-1 text-wine active:cursor-grabbing">
        <GripVertical className="size-4" />
      </button>
      <button onClick={onRemove} aria-label={`Remover ${label}`} className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-wine transition hover:bg-wine hover:text-white">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </button>
    </div>
  );
}

function AddTile({ onFiles, loading, aspect, label }: { onFiles: (f: File[]) => void; loading: boolean; aspect: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button type="button" onClick={() => ref.current?.click()} className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-wine/30 p-2 text-center text-xs text-wine transition hover:border-wine hover:bg-blush', aspect)}>
      {loading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
      {label}
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </button>
  );
}

function Slot({ title, hint, accept, icon, loading, onFiles, filled, onRemove, preview, footer, aspect }: {
  title: string; hint: string; accept: string; icon: React.ReactNode; loading: boolean; onFiles: (f: File[]) => void; filled: boolean; onRemove?: () => void; preview: React.ReactNode; footer?: string; aspect: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <p className="label mb-2 text-wine">{title}</p>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
        className={cn('relative overflow-hidden rounded-2xl border-2 border-dashed transition', aspect, over ? 'border-wine bg-blush' : 'border-wine/30', filled && 'border-solid border-wine/20')}
      >
        {filled ? preview : (
          <button type="button" onClick={() => ref.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-wine transition hover:bg-blush">
            {loading ? <Loader2 className="size-6 animate-spin" /> : icon}
            <span className="text-sm">Clique ou arraste o arquivo</span>
            <span className="text-xs text-ink/50">{hint}</span>
          </button>
        )}
        {filled && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button onClick={() => ref.current?.click()} className="rounded-full bg-white/90 px-3 py-1 text-xs text-wine hover:bg-wine hover:text-white">{loading ? '…' : 'Trocar'}</button>
            {onRemove && <button onClick={onRemove} aria-label="Remover" className="rounded-full bg-white/90 p-1.5 text-wine hover:bg-wine hover:text-white"><Trash2 className="size-3.5" /></button>}
          </div>
        )}
        <input ref={ref} type="file" accept={accept} hidden onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </div>
      {footer && <p className="mt-1.5 text-xs text-ink/55">{footer}</p>}
    </div>
  );
}
