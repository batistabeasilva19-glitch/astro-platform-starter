'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clapperboard, GalleryHorizontal, ImageOff, RotateCcw, Save, Video } from 'lucide-react';
import type { ContentCardData } from '@/lib/types';
import { Avatar } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { STATUS_META } from '@/lib/constants';
import { saveFeedLayout } from '@/lib/actions/content';
import { cn } from '@/lib/utils';

interface Profile {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
}

interface Props {
  profile: Profile;
  items: ContentCardData[]; // grid (sem stories), na ordem atual
  stories: ContentCardData[];
  /** Link de cada conteúdo = `${hrefBase}/${id}`. */
  hrefBase: string;
  /** Administradora: habilita drag and drop + "Salvar organização do feed". */
  clientId?: string;
  editable?: boolean;
  savedLayout?: boolean;
}

export function ProfileFeed({ profile, items, stories, hrefBase, clientId, editable, savedLayout }: Props) {
  const hrefFor = (item: ContentCardData) => `${hrefBase}/${item.id}`;
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [dirty, setDirty] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const ordered = order.map((id) => byId.get(id)).filter((x): x is ContentCardData => !!x);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((o) => arrayMove(o, o.indexOf(String(active.id)), o.indexOf(String(over.id))));
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const res = clientId ? await saveFeedLayout(clientId, order) : null;
      if (res?.ok) {
        setDirty(false);
        toast('Organização do feed salva ♡');
      } else toast(res && !res.ok ? res.error : 'Não foi possível salvar.', 'error');
    });

  const active = activeId ? byId.get(activeId) : null;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      {/* Cabeçalho do perfil (simulação visual) */}
      <div className="card !rounded-b-none border-b-0 p-5 sm:p-7">
        <div className="flex items-center gap-5 sm:gap-8">
          <Avatar name={profile.displayName} src={profile.avatarUrl} className="size-20 shrink-0 text-xl ring-2 ring-wine/25 ring-offset-4 sm:size-28 sm:text-3xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-normal">@{profile.handle}</p>
            <div className="mt-3 grid grid-cols-3 text-center sm:text-left">
              {[
                [ordered.length + stories.length, 'posts'],
                ['—', 'seguidores'],
                ['—', 'seguindo'],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-xl text-wine">{n}</p>
                  <p className="text-xs text-ink/55">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm font-normal">{profile.displayName}</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/75">{profile.bio}</p>

        {stories.length > 0 && (
          <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-1">
            {stories.map((s) => (
              <Link key={s.id} href={hrefFor(s)} className="group w-16 shrink-0 text-center">
                <span className="mx-auto block size-16 overflow-hidden rounded-full border-2 border-wine p-0.5 transition group-hover:scale-105">
                  {s.thumb ? <img src={s.thumb} alt="" className="size-full rounded-full object-cover" /> : <span className="block size-full rounded-full bg-blush" />}
                </span>
                <span className="mt-1 block truncate text-[0.65rem] text-ink/60">{s.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {editable && (
        <div className="sticky top-2 z-20 -mx-1 mb-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-full border border-wine/20 bg-white/95 px-4 py-2 backdrop-blur">
          <p className="text-xs text-ink/60">
            Arraste para testar a ordem. {savedLayout && !dirty ? 'Organização salva.' : dirty ? 'Alterações não salvas.' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty}
              onClick={() => {
                setOrder(items.map((i) => i.id));
                setDirty(false);
              }}
            >
              <RotateCcw className="size-3.5" /> Desfazer
            </Button>
            <Button size="sm" onClick={save} loading={pending} disabled={!dirty}>
              <Save className="size-3.5" /> Salvar organização do feed
            </Button>
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="card !rounded-t-none p-10 text-center text-sm text-ink/60">Nenhum conteúdo no feed ainda.</div>
      ) : editable ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-0.5 border border-t-0 border-wine/15 bg-wine/15">
              {ordered.map((it) => (
                <Tile key={it.id} item={it} href={hrefFor(it)} sortable />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>{active ? <TileBody item={active} className="opacity-90 ring-2 ring-wine" /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 border border-t-0 border-wine/15 bg-wine/15">
          {ordered.map((it) => (
            <Tile key={it.id} item={it} href={hrefFor(it)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ item, href, sortable }: { item: ContentCardData; href: string; sortable?: boolean }) {
  if (sortable) return <SortableTile item={item} href={href} />;
  return (
    <Link href={href} className="group block">
      <TileBody item={item} />
    </Link>
  );
}

function SortableTile({ item, href }: { item: ContentCardData; href: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const dragged = useRef(false);
  useEffect(() => {
    if (isDragging) dragged.current = true;
    else if (dragged.current) {
      const t = setTimeout(() => (dragged.current = false), 150); // evita navegar ao soltar
      return () => clearTimeout(t);
    }
  }, [isDragging]);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group relative touch-manipulation', isDragging && 'z-10 opacity-40')}
      {...attributes}
      {...listeners}
    >
      <Link href={href} draggable={false} className="block" onClick={(e) => (isDragging || dragged.current) && e.preventDefault()}>
        <TileBody item={item} />
      </Link>
    </div>
  );
}

function TileBody({ item, className }: { item: ContentCardData; className?: string }) {
  return (
    <div className={cn('relative aspect-[4/5] overflow-hidden bg-blush', className)}>
      {item.thumb ? (
        <img src={item.thumb} alt={item.title} className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" draggable={false} />
      ) : (
        <div className="flex size-full items-center justify-center text-wine/40">
          <ImageOff className="size-5" />
        </div>
      )}
      {/* Ícones indicam Carrossel / Reel, como no perfil real */}
      <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
        {item.format === 'carousel' && <GalleryHorizontal className="size-4" />}
        {item.format === 'reel' && <Clapperboard className="size-4" />}
        {item.format === 'video' && <Video className="size-4" />}
      </span>
      <span className={cn('absolute bottom-1.5 left-1.5 size-2 rounded-full ring-2 ring-white', STATUS_META[item.status].dot === 'bg-white' ? 'bg-wine' : STATUS_META[item.status].dot)} title={STATUS_META[item.status].label} />
    </div>
  );
}
