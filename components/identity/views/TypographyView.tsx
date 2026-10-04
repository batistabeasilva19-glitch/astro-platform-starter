'use client';

import { RichText } from '@/components/ui/RichText';
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { getFonts } from '@/lib/identity/color';
import { FONT_ROLES, type FontItem, type SignedAsset, type StageContent } from '@/lib/identity/types';
import { Input, Select } from '@/components/ui/Fields';
import { cn } from '@/lib/utils';
import { FavButton, useFavorites, type ViewCtx } from '../view-context';
import { Empty, Label } from './shared';
import { Photos } from './Photos';

const ROLE_LABEL = Object.fromEntries(FONT_ROLES) as Record<string, string>;

/** Arquivos de fonte enviados: asset de slot "font" cujo `name` guarda o id da fonte. */
const fontFiles = (assets: SignedAsset[]) => assets.filter((a) => a.slot === 'font');

/** Carrega as fontes: arquivo enviado (FontFace) ou, pelo nome, o Google Fonts. */
export function useLoadedFonts(fonts: FontItem[], assets: SignedAsset[]) {
  const key = fonts.map((f) => `${f.id}:${f.name}`).join('|') + assets.map((a) => a.id).join('|');
  useEffect(() => {
    for (const f of fonts) {
      const file = fontFiles(assets).find((a) => a.name === f.id);
      if (file && file.url && 'FontFace' in window) {
        const family = `soltria-${f.id}`;
        if ([...document.fonts].some((x) => x.family.replace(/"/g, '') === family)) continue;
        new FontFace(family, `url(${file.url})`).load().then((ff) => document.fonts.add(ff)).catch(() => {});
        continue;
      }
      const clean = f.name.trim().replace(/[^A-Za-z0-9 ]/g, '');
      if (!clean) continue;
      const id = `gf-${clean.replace(/ /g, '-')}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, '+')}:wght@300;400;500;700&display=swap`;
      document.head.appendChild(link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (f: FontItem | undefined, fallback = 'var(--font-sans)') => {
    if (!f) return fallback;
    const hasFile = fontFiles(assets).some((a) => a.name === f.id);
    return hasFile ? `'soltria-${f.id}', ${fallback}` : `'${f.name.replace(/'/g, '')}', ${fallback}`;
  };
}

const ALPHABET = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789'];

export function TypographyView({ ctx, content, images }: { ctx: ViewCtx; content: StageContent; images: SignedAsset[] }) {
  const fonts = useMemo(() => getFonts(content).filter((f) => f.name.trim()), [content]);
  const assets = images;
  const family = useLoadedFonts(fonts, assets);
  const fav = useFavorites(ctx);
  const [typed, setTyped] = useState('');
  const [aId, setA] = useState(fonts[0]?.id);
  const [bId, setB] = useState(fonts[1]?.id ?? fonts[0]?.id);
  const photos = assets.filter((a) => a.slot !== 'font');
  if (!fonts.length && !photos.length) return <Empty text="A tipografia ainda está sendo definida." />;

  const sorted = [...fonts].sort((x, y) => FONT_ROLES.findIndex(([r]) => r === x.role) - FONT_ROLES.findIndex(([r]) => r === y.role));
  const main = fonts.find((f) => f.role === 'main') ?? fonts[0];
  const secondary = fonts.find((f) => f.role === 'secondary') ?? main;
  const support = fonts.find((f) => f.role === 'support') ?? secondary;
  const text = typed.trim() || 'Beleza com propósito';
  const A = fonts.find((f) => f.id === aId) ?? fonts[0];
  const B = fonts.find((f) => f.id === bId) ?? fonts[0];

  return (
    <div className="space-y-14">
      {(content.description ?? '').trim() && <RichText text={content.description!} className="max-w-2xl text-[0.95rem] leading-relaxed text-ink/80" />}

      {/* testar: o texto digitado aparece em todas as fontes */}
      {fonts.length > 0 && (
        <label className="block">
          <span className="label mb-2 block text-wine">Digite algo para testar</span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Digite algo para testar" maxLength={120} className="!rounded-full !px-6 !py-4 !text-lg" />
        </label>
      )}

      <div className="space-y-4">
        {sorted.map((f) => (
          <section key={f.id} className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label text-wine/70">{ROLE_LABEL[f.role]}</p>
                <h3 className="mt-1 text-2xl text-wine" style={{ fontFamily: family(f) }}>{f.name}</h3>
                <p className="mt-1 text-xs text-ink/55">
                  {[f.category, f.usage].filter(Boolean).join(' · ')}
                  {f.reference && (
                    <a href={/^https?:\/\//.test(f.reference) ? f.reference : undefined} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-wine underline-offset-2 hover:underline">
                      referência <ExternalLink className="size-3" />
                    </a>
                  )}
                </p>
              </div>
              {(fav.enabled || fav.has('font', f.id)) &&
                (fav.enabled ? (
                  <FavButton on={fav.has('font', f.id)} onClick={() => fav.toggle('font', f.id, { on: 'Fonte marcada como favorita ♡' })} busy={fav.busy} label="Minha favorita" onLabel="Minha favorita" size="sm" />
                ) : (
                  <span className="rounded-full bg-blush px-3 py-1 text-xs text-wine">♡ Favorita do cliente</span>
                ))}
            </div>
            <p className="mt-5 text-7xl leading-none text-wine sm:text-8xl" style={{ fontFamily: family(f) }}>Aa</p>
            <div className="mt-4 space-y-0.5 break-all text-lg leading-snug sm:text-xl" style={{ fontFamily: family(f) }}>
              {ALPHABET.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
            <p className="mt-5 whitespace-pre-line break-words border-t border-wine/10 pt-4 text-2xl leading-snug sm:text-3xl" style={{ fontFamily: family(f) }}>
              {typed.trim() || f.sample || text}
            </p>
          </section>
        ))}
      </div>

      {/* aplicações da tipografia */}
      {main && (
        <section>
          <Label>Aplicações da tipografia</Label>
          <div className="card divide-y divide-wine/10 overflow-hidden">
            {[
              ['Título', <p key="t" className="break-words text-4xl leading-tight text-wine sm:text-5xl" style={{ fontFamily: family(main) }}>{text}</p>],
              ['Subtítulo', <p key="s" className="break-words text-2xl leading-snug" style={{ fontFamily: family(secondary) }}>Uma frase de apoio para introduzir o assunto</p>],
              ['Texto', <p key="x" className="max-w-xl text-base leading-relaxed text-ink/80" style={{ fontFamily: family(support) }}>Um parágrafo de exemplo para você avaliar o conforto de leitura em tamanhos pequenos, com linhas longas e espaçamento natural.</p>],
              ['Botão', <span key="b" className="inline-flex rounded-full bg-wine px-6 py-2.5 text-sm uppercase tracking-[0.14em] text-white" style={{ fontFamily: family(main) }}>Saiba mais</span>],
              ['Legenda', <p key="l" className="text-xs text-ink/60" style={{ fontFamily: family(support) }}>Foto: acervo da marca · 2026</p>],
            ].map(([label, node]) => (
              <div key={label as string} className="grid gap-2 p-5 sm:grid-cols-[8rem_1fr] sm:items-center sm:p-6">
                <p className="label text-wine/70">{label as string}</p>
                <div>{node}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* comparar fontes */}
      {fonts.length > 1 && A && B && (
        <section>
          <Label>Comparar tipografias</Label>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <Select value={aId} onChange={(e) => setA(e.target.value)} aria-label="Fonte A">
              {fonts.map((f) => (
                <option key={f.id} value={f.id}>Fonte A · {f.name}</option>
              ))}
            </Select>
            <span className="label text-center text-wine">VS</span>
            <Select value={bId} onChange={(e) => setB(e.target.value)} aria-label="Fonte B">
              {fonts.map((f) => (
                <option key={f.id} value={f.id}>Fonte B · {f.name}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[A, B].map((f, i) => (
              <div key={`${f.id}-${i}`} className={cn('card p-6')}>
                <p className="label mb-3 text-wine/70">{f.name}</p>
                <p className="break-words text-4xl leading-tight text-wine" style={{ fontFamily: family(f) }}>{text}</p>
                <p className="mt-3 text-base leading-relaxed text-ink/75" style={{ fontFamily: family(f) }}>O mesmo texto, em outra fonte, para você comparar com calma.</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {photos.length > 0 && <Photos ctx={ctx} images={photos} />}
    </div>
  );
}
