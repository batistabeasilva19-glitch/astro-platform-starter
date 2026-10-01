'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquarePlus, Minus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { IdentityAnnotation, SignedAsset } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';

export interface FeedbackActions {
  viewer: 'client' | 'admin';
  onAdd: (input: { assetId: string; x?: number | null; y?: number | null; message: string }) => Promise<{ ok: boolean; error?: string }>;
  onDelete?: (annotationId: string) => Promise<{ ok: boolean; error?: string }>;
}

interface Props {
  asset: SignedAsset | null;
  onClose: () => void;
  annotations?: IdentityAnnotation[];
  feedback?: FeedbackActions;
  /** coração (aplicações): só aparece quando informado */
  favorite?: { on: boolean; toggle: () => void; busy?: boolean };
  dark?: boolean;
  title?: string;
}

const MIN = 1;
const MAX = 5;

/**
 * Visualizador em tela cheia: zoom (botões, roda do mouse e pinça), arrastar quando ampliado
 * e comentários presos a um ponto da imagem (marcador numerado).
 */
export function ImageViewer({ asset, onClose, annotations = [], feedback, favorite, dark, title }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState('');
  const [general, setGeneral] = useState('');
  const [busy, start] = useTransition();
  const [active, setActive] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; moved: number; startX: number; startY: number; px: number; py: number } | null>(null);

  const list = annotations.filter((a) => a.asset_id === asset?.id);
  const marked = list.filter((a) => a.x !== null && a.y !== null);
  const generalList = list.filter((a) => a.x === null);

  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setPending(null);
    setText('');
    setGeneral('');
    setActive(null);
  }, [asset?.id]);

  useEffect(() => {
    if (!asset) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [asset, onClose]);

  // zoom com a roda do mouse (precisa de listener não-passivo)
  useEffect(() => {
    const el = frame.current;
    if (!el || !asset) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => Math.min(MAX, Math.max(MIN, s * (e.deltaY < 0 ? 1.12 : 0.89))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [asset]);

  useEffect(() => {
    if (scale === 1) setPos({ x: 0, y: 0 });
  }, [scale]);

  if (!asset) return null;

  const zoom = (f: number) => setScale((s) => Math.min(MAX, Math.max(MIN, +(s * f).toFixed(2))));

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current = {
      dist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0,
      scale,
      moved: 0,
      startX: e.clientX,
      startY: e.clientY,
      px: pos.x,
      py: pos.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    g.moved = Math.max(g.moved, Math.hypot(e.clientX - g.startX, e.clientY - g.startY));
    if (pts.length === 2 && g.dist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      setScale(Math.min(MAX, Math.max(MIN, g.scale * (d / g.dist))));
    } else if (pts.length === 1 && scale > 1) {
      setPos({ x: g.px + (e.clientX - g.startX), y: g.py + (e.clientY - g.startY) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    // toque curto (sem arrastar) = marcar um ponto para comentar
    if (g && wasSingle && g.moved < 6 && feedback && img.current && e.target === img.current) {
      const r = img.current.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
        setPending({ x: +x.toFixed(2), y: +y.toFixed(2) });
        setActive(null);
      }
    }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const save = (point: { x: number; y: number } | null, message: string, reset: () => void) => {
    if (!feedback || !message.trim()) return;
    start(async () => {
      const r = await feedback.onAdd({ assetId: asset.id, x: point?.x ?? null, y: point?.y ?? null, message });
      if (!r.ok) return toast(r.error ?? 'Não foi possível salvar.', 'error');
      toast('Comentário salvo ♡');
      reset();
      router.refresh();
    });
  };
  const remove = (id: string) =>
    start(async () => {
      const r = await feedback?.onDelete?.(id);
      if (r && !r.ok) toast(r.error ?? 'Erro', 'error');
      router.refresh();
    });

  const nextNumber = marked.length + 1;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-ink/95 text-white sm:flex-row" role="dialog" aria-modal="true" aria-label={title ?? 'Imagem'}>
      {/* imagem */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={frame}
          className={cn('absolute inset-0 touch-none select-none overflow-hidden', scale > 1 ? 'cursor-grab active:cursor-grabbing' : feedback ? 'cursor-crosshair' : '')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex size-full items-center justify-center p-4 sm:p-10">
            <div className="relative inline-block max-h-full max-w-full" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: gesture.current ? 'none' : 'transform 0.15s ease-out' }}>
              <img loading="lazy" decoding="async" ref={img} src={asset.url} alt={asset.name || asset.caption || ''} draggable={false} className={cn('block max-h-[calc(100dvh-9rem)] max-w-full rounded-lg object-contain sm:max-h-[calc(100dvh-5rem)]', dark ? 'bg-ink' : 'bg-white')} />
              {marked.map((a) => (
                <button
                  key={a.id}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setActive(active === a.id ? null : a.id)}
                  style={{ left: `${a.x}%`, top: `${a.y}%`, transform: `translate(-50%, -50%) scale(${1 / scale})` }}
                  className={cn('absolute flex size-7 items-center justify-center rounded-full border-2 border-white text-xs font-normal shadow transition', active === a.id ? 'bg-white text-wine' : 'bg-wine text-white')}
                  aria-label={`Marcador ${a.number}`}
                >
                  {a.number}
                </button>
              ))}
              {pending && (
                <span style={{ left: `${pending.x}%`, top: `${pending.y}%`, transform: `translate(-50%, -50%) scale(${1 / scale})` }} className="absolute flex size-7 animate-pulse items-center justify-center rounded-full border-2 border-white bg-wine text-xs text-white">
                  {nextNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* controles */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <IconBtn label="Aproximar" onClick={() => zoom(1.4)}><Plus className="size-4" /></IconBtn>
          <IconBtn label="Afastar" onClick={() => zoom(1 / 1.4)}><Minus className="size-4" /></IconBtn>
          <IconBtn label="Tamanho original" onClick={() => setScale(1)}><RotateCcw className="size-4" /></IconBtn>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs tabular-nums">{Math.round(scale * 100)}%</span>
          {favorite && (
            <IconBtn label={favorite.on ? 'Remover dos favoritos' : 'Favoritar'} onClick={favorite.toggle} active={favorite.on}>
              <Heart className={cn('size-4', favorite.on && 'fill-current')} />
            </IconBtn>
          )}
        </div>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 rounded-full bg-white/15 p-2 transition hover:bg-white/30">
          <X className="size-5" />
        </button>
        {feedback && !pending && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-white/70">Toque na imagem para comentar em um ponto</p>}
      </div>

      {/* comentários */}
      {feedback && (
        <aside className="max-h-[42dvh] w-full shrink-0 overflow-y-auto bg-white p-4 text-ink sm:max-h-none sm:w-80 sm:p-5">
          <p className="label mb-3 text-wine">Comentários na imagem</p>

          {pending && (
            <div className="mb-4 rounded-2xl border border-wine/30 bg-blush/50 p-3">
              <p className="mb-2 flex items-center gap-2 text-xs text-wine">
                <span className="flex size-5 items-center justify-center rounded-full bg-wine text-[0.65rem] text-white">{nextNumber}</span> Novo marcador
              </p>
              <Textarea rows={3} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Gostaria desse símbolo um pouco menor." />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setPending(null); setText(''); }}>Cancelar</Button>
                <Button size="sm" loading={busy} disabled={!text.trim()} onClick={() => save(pending, text, () => { setPending(null); setText(''); })}>Salvar</Button>
              </div>
            </div>
          )}

          {list.length === 0 && !pending && <p className="mb-4 text-sm text-ink/55">Nenhum comentário nesta imagem ainda.</p>}
          <ul className="mb-4 space-y-2.5">
            {[...marked, ...generalList].map((a) => (
              <li key={a.id} onClick={() => setActive(a.id)} className={cn('rounded-2xl border p-3 text-sm', active === a.id ? 'border-wine bg-blush/50' : a.author_type === 'client' ? 'border-wine/15 bg-blush/30' : 'border-wine/15')}>
                <p className="mb-1 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.12em] text-wine">
                  {a.number ? <span className="flex size-5 items-center justify-center rounded-full bg-wine text-[0.65rem] text-white">{a.number}</span> : null}
                  {a.author_type === 'client' ? 'Cliente' : 'Soltria'} · {a.author_name}
                  {feedback.viewer === 'admin' && feedback.onDelete && (
                    <button aria-label="Excluir comentário" onClick={(e) => { e.stopPropagation(); remove(a.id); }} className="ml-auto text-wine/60 hover:text-wine"><Trash2 className="size-3.5" /></button>
                  )}
                </p>
                <p className="whitespace-pre-line leading-relaxed">{a.message}</p>
                <p className="mt-1 text-[0.68rem] text-ink/45">{fmtStamp(a.created_at)}</p>
              </li>
            ))}
          </ul>

          <div className="border-t border-wine/10 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs text-wine"><MessageSquarePlus className="size-3.5" /> Comentário geral sobre esta imagem</p>
            <Textarea rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Escreva aqui…" />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" loading={busy && !pending} disabled={!general.trim()} onClick={() => save(null, general, () => setGeneral(''))}>Enviar</Button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn('rounded-full p-2 transition', active ? 'bg-white text-wine' : 'bg-white/15 hover:bg-white/30')}>
      {children}
    </button>
  );
}
