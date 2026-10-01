'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Send } from 'lucide-react';
import { submitColorSelection } from '@/lib/actions/identity-portal';
import { allColors, cmykText, contrastLevel, contrastRatio, getPalettes, isDarkColor, rgbText } from '@/lib/identity/color';
import type { ColorItem, StageContent } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtStamp } from '@/lib/utils';
import { FavButton, useFavorites, type ViewCtx } from '../view-context';
import { Empty } from './shared';

export function ColorsView({ ctx, content }: { ctx: ViewCtx; content: StageContent }) {
  const palettes = getPalettes(content);
  const fav = useFavorites(ctx);
  if (!palettes.length) return <Empty text="A paleta de cores ainda está sendo definida." />;

  return (
    <div className="space-y-14">
      {(content.description ?? '').trim() && <p className="max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}

      {palettes.map((p, pi) => (
        <section key={p.id} className="animate-rise" style={{ animationDelay: `${pi * 70}ms` }}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label mb-1 text-wine/70">Paleta</p>
              <h3 className="h-display text-3xl text-wine">{p.label}</h3>
              {p.description && <p className="mt-1 max-w-xl text-sm text-ink/65">{p.description}</p>}
            </div>
            {(fav.enabled || fav.has('palette', p.id)) &&
              (fav.enabled ? (
                <FavButton on={fav.has('palette', p.id)} onClick={() => fav.toggle('palette', p.id, { on: 'Paleta marcada como favorita ♡' })} busy={fav.busy} label="Minha favorita" onLabel="Minha favorita" />
              ) : (
                <span className="rounded-full bg-blush px-3 py-1 text-xs text-wine">♡ Favorita do cliente</span>
              ))}
          </div>
          {/* faixa da paleta completa */}
          <div className="mb-4 flex h-14 overflow-hidden rounded-2xl border border-wine/15 sm:h-20">
            {p.colors.map((c) => (
              <span key={c.id} className="flex-1" style={{ backgroundColor: c.hex }} title={`${c.name} ${c.hex}`} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {p.colors.map((c) => (
              <ColorCard key={c.id} color={c} />
            ))}
          </div>
        </section>
      ))}

      <BuildPalette ctx={ctx} content={content} />
      <TestCombination content={content} />
    </div>
  );
}

function copy(text: string) {
  return navigator.clipboard.writeText(text);
}

function ColorCard({ color: c }: { color: ColorItem }) {
  const toast = useToast();
  const [ok, setOk] = useState(false);
  const hex = c.hex.toUpperCase();
  const onCopy = async () => {
    try {
      await copy(hex);
      setOk(true);
      toast('Cor copiada ♡');
      setTimeout(() => setOk(false), 1500);
    } catch {
      toast('Não foi possível copiar.', 'error');
    }
  };
  return (
    <div className="overflow-hidden rounded-3xl border border-wine/15 bg-white transition hover:-translate-y-0.5">
      <button onClick={onCopy} aria-label={`Copiar ${hex}`} className={cn('flex h-36 w-full items-end p-4 text-left sm:h-44', isDarkColor(c.hex) ? 'text-white' : 'text-ink')} style={{ backgroundColor: c.hex }}>
        <span className="label opacity-80">Toque para copiar</span>
      </button>
      <div className="p-4">
        <p className="h-display text-xl uppercase tracking-wide text-wine">{c.name || 'Cor'}</p>
        <button onClick={onCopy} className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-ink/80 transition hover:text-wine">
          {hex} {ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        <dl className="mt-2 space-y-0.5 font-mono text-[0.7rem] text-ink/50">
          <div>RGB {rgbText(c.hex)}</div>
          <div>CMYK {cmykText(c)}</div>
          {c.pantone && <div>Pantone {c.pantone}</div>}
        </dl>
      </div>
    </div>
  );
}

/** MONTE SUA PALETA: o cliente marca cores individuais e envia a seleção. */
function BuildPalette({ ctx, content }: { ctx: ViewCtx; content: StageContent }) {
  const colors = useMemo(() => allColors(content), [content]);
  const last = [...ctx.selections].reverse().find((s) => s.kind === 'colors');
  const [picked, setPicked] = useState<string[]>(() => (last?.payload.colorIds ?? []).filter((id) => colors.some((c) => c.id === id)));
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const fav = useFavorites(ctx);
  const isClient = ctx.mode === 'client';
  const selected = picked.map((id) => colors.find((c) => c.id === id)).filter((c): c is ColorItem => !!c);
  if (!colors.length) return null;

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const send = () =>
    start(async () => {
      const r = await submitColorSelection(ctx.token!, picked);
      if (!r.ok) return toast(r.error, 'error');
      toast('Seleção enviada ♡');
      router.refresh();
    });

  return (
    <section className="rounded-[2rem] bg-blush/60 p-5 sm:p-8">
      <p className="label mb-1 text-wine/70">Cores individuais</p>
      <h3 className="h-display mb-5 text-3xl text-wine">Monte sua paleta</h3>

      {/* paleta dinâmica no topo */}
      <div className="mb-6 rounded-3xl bg-white p-4">
        {selected.length ? (
          <div className="flex h-20 overflow-hidden rounded-2xl border border-wine/15 sm:h-24">
            {selected.map((c) => (
              <span key={c.id} className="flex flex-1 items-end justify-center pb-1.5 text-[0.62rem] transition-all" style={{ backgroundColor: c.hex, color: isDarkColor(c.hex) ? '#fff' : '#282828' }}>
                <span className="hidden sm:inline">{c.hex.toUpperCase()}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="flex h-20 items-center justify-center rounded-2xl border border-dashed border-wine/30 text-sm text-ink/50 sm:h-24">Marque as cores de que você gostou para montar sua paleta.</p>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink/55">
            {selected.length} {selected.length === 1 ? 'cor selecionada' : 'cores selecionadas'}
            {last && <> · última seleção enviada em {fmtStamp(last.created_at)}</>}
          </p>
          {isClient && (
            <Button onClick={send} loading={pending} disabled={!picked.length}>
              <Send className="size-4" /> Enviar minha seleção
            </Button>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {colors.map((c) => {
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <label className={cn('flex items-center gap-3 rounded-2xl border bg-white p-2.5 transition', on ? 'border-wine' : 'border-wine/15', isClient ? 'cursor-pointer' : 'cursor-default')}>
                <input type="checkbox" checked={on} disabled={!isClient} onChange={() => toggle(c.id)} className="size-4 accent-[#771430]" />
                <span className="size-9 shrink-0 rounded-xl border border-wine/15" style={{ backgroundColor: c.hex }} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm">{c.name || 'Cor'}</span>
                  <span className="block font-mono text-[0.68rem] text-ink/50">{c.hex.toUpperCase()}</span>
                </span>
                {fav.enabled && (
                  <button type="button" aria-label={fav.has('color', c.id) ? 'Remover cor dos favoritos' : 'Favoritar cor'} onClick={(e) => { e.preventDefault(); fav.toggle('color', c.id); }} className={cn('rounded-full p-1 transition', fav.has('color', c.id) ? 'text-wine' : 'text-wine/35 hover:text-wine')}>
                    <HeartIcon on={fav.has('color', c.id)} />
                  </button>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function HeartIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-4', on ? 'fill-current' : 'fill-none')} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

/** TESTAR COMBINAÇÃO: fundo, texto e destaque com simulação e orientação de contraste (WCAG). */
function TestCombination({ content }: { content: StageContent }) {
  const base = useMemo(() => {
    const list = allColors(content).map((c) => ({ id: c.id, name: c.name || 'Cor', hex: c.hex }));
    const extra = [
      { id: '__white', name: 'Branco', hex: '#ffffff' },
      { id: '__black', name: 'Preto', hex: '#000000' },
    ].filter((e) => !list.some((c) => c.hex.toLowerCase() === e.hex));
    return [...list, ...extra];
  }, [content]);
  const [bg, setBg] = useState(base.find((c) => !isDarkColor(c.hex))?.id ?? base[0]?.id);
  const [fg, setFg] = useState(base.find((c) => isDarkColor(c.hex))?.id ?? base[0]?.id);
  const [accent, setAccent] = useState(base[Math.min(1, base.length - 1)]?.id);
  if (!base.length) return null;
  const get = (id?: string) => base.find((c) => c.id === id) ?? base[0];
  const B = get(bg);
  const F = get(fg);
  const A = get(accent);
  const textLevel = contrastLevel(contrastRatio(F.hex, B.hex));
  const btnLevel = contrastLevel(contrastRatio(isDarkColor(A.hex) ? '#ffffff' : '#282828', A.hex));
  const tone = (t: 'high' | 'mid' | 'low') => (t === 'high' ? 'text-wine' : t === 'mid' ? 'text-ink/70' : 'text-ink/50');

  const Pick = ({ label, value, set }: { label: string; value?: string; set: (v: string) => void }) => (
    <label className="block">
      <span className="label mb-1.5 flex items-center gap-2 text-wine/70">
        <span className="size-3 rounded-full border border-wine/20" style={{ backgroundColor: get(value).hex }} /> {label}
      </span>
      <Select value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
        {base.map((c) => (
          <option key={c.id} value={c.id}>{c.name} · {c.hex.toUpperCase()}</option>
        ))}
      </Select>
    </label>
  );

  return (
    <section>
      <p className="label mb-1 text-wine/70">Combinações</p>
      <h3 className="h-display mb-5 text-3xl text-wine">Testar combinação</h3>
      <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
        <div className="space-y-3">
          <Pick label="Fundo" value={bg} set={setBg} />
          <Pick label="Texto" value={fg} set={setFg} />
          <Pick label="Destaque" value={accent} set={setAccent} />
          <p className="pt-1 text-xs leading-relaxed">
            <span className={tone(textLevel.tone)}>{textLevel.label}</span> entre texto e fundo ({contrastRatio(F.hex, B.hex).toFixed(1)}:1).<br />
            <span className={tone(btnLevel.tone)}>{btnLevel.label}</span> no botão.
            <span className="mt-1 block text-ink/40">Orientação visual baseada em WCAG, não uma certificação.</span>
          </p>
        </div>
        <div className="rounded-[2rem] border border-wine/15 p-7 transition-colors sm:p-10" style={{ backgroundColor: B.hex, color: F.hex }}>
          <p className="label mb-3 opacity-70">Prévia</p>
          <h4 className="h-display text-4xl leading-tight sm:text-5xl" style={{ color: F.hex }}>Sua marca, do seu jeito</h4>
          <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed" style={{ color: F.hex }}>
            Um texto de exemplo para você enxergar como as cores conversam entre si, na leitura e nos detalhes.
          </p>
          <span className="mt-6 inline-flex items-center rounded-full px-6 py-2.5 text-sm" style={{ backgroundColor: A.hex, color: isDarkColor(A.hex) ? '#ffffff' : '#282828' }}>
            Quero saber mais
          </span>
        </div>
      </div>
    </section>
  );
}

