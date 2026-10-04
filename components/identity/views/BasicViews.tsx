'use client';

import { RichText } from '@/components/ui/RichText';
import { useMemo, useState } from 'react';
import { Download, FileText, Lock } from 'lucide-react';
import { allColors, getFonts, getPalettes } from '@/lib/identity/color';
import { APPLICATION_CATEGORIES, CONCEPT_FIELDS, ELEMENT_CATEGORIES, FILE_CATEGORIES, FONT_ROLES, STAGE_BY_KEY, latestLogoVersion, type SignedAsset, type StageContent } from '@/lib/identity/types';
import { Sparkle } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';
import { ImageViewer } from '../ImageViewer';
import { useFavorites, useFeedback, type ViewCtx } from '../view-context';
import { Empty, Label } from './shared';
import { Photos } from './Photos';
import { useLoadedFonts } from './TypographyView';

// ─── 01 Conceito ───────────────────────────────────────────────────────────
export function ConceptView({ ctx, content, images }: { ctx: ViewCtx; content: StageContent; images: SignedAsset[] }) {
  const filled = CONCEPT_FIELDS.filter(([k]) => (content[k] ?? '').trim());
  const manifesto = (content.manifesto ?? '').trim();
  const keywords = (content.keywords ?? '').split(/[,\n;]/).map((k) => k.trim()).filter(Boolean);
  const rest = filled.filter(([k]) => !['manifesto', 'keywords', 'description'].includes(k));
  if (!filled.length && !images.length) return <Empty text="O conceito ainda está sendo escrito." />;
  return (
    <div className="space-y-14">
      {(content.description ?? '').trim() && <RichText text={content.description!} className="max-w-3xl text-xl font-medium leading-snug text-wine sm:text-2xl" />}
      <div className="grid gap-x-14 gap-y-10 sm:grid-cols-2">
        {rest.map(([k, label]) => (
          <section key={k} className="animate-rise">
            <Label>{label}</Label>
            <RichText text={content[k]!} className="text-[0.97rem] leading-relaxed text-ink/85" />
          </section>
        ))}
      </div>
      {keywords.length > 0 && (
        <section>
          <Label>Palavras-chave</Label>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <span key={k} className="rounded-full border border-wine/30 px-4 py-1.5 text-sm text-wine">{k}</span>
            ))}
          </div>
        </section>
      )}
      {manifesto && (
        <section className="relative overflow-hidden rounded-[2rem] bg-wine px-7 py-14 text-center text-white sm:px-16">
          <Sparkle className="mx-auto mb-5 size-5 text-blush" animate />
          <Label className="text-white/70">Manifesto</Label>
          <RichText text={manifesto} className="mx-auto max-w-2xl text-xl font-medium leading-snug sm:text-2xl" />
        </section>
      )}
      {images.length > 0 && <Photos ctx={ctx} images={images} />}
    </div>
  );
}

// ─── 02 Moodboard ──────────────────────────────────────────────────────────
export function MoodboardView({ ctx, content, images }: { ctx: ViewCtx; content: StageContent; images: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const feedback = useFeedback(ctx);
  if (!images.length) return <Empty text="O moodboard ainda está sendo montado." />;
  return (
    <div>
      {(content.title ?? '').trim() && <h3 className="mb-3 text-2xl font-medium tracking-tight text-wine sm:text-3xl">{content.title}</h3>}
      {(content.description ?? '').trim() && <RichText text={content.description!} className="mb-10 max-w-2xl text-[0.97rem] leading-relaxed text-ink/80" />}
      {/* composição em colunas, na ordem definida pela administradora */}
      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4">
        {images.map((img) => (
          <figure key={img.id} className="group mb-3 break-inside-avoid sm:mb-4">
            <button onClick={() => setOpen(img)} className="block w-full overflow-hidden rounded-2xl bg-blush">
              <img src={img.url} alt={img.caption || 'Referência'} loading="lazy" className="w-full transition duration-500 group-hover:scale-[1.03]" />
            </button>
            {img.caption && <figcaption className="mt-1.5 px-1 text-xs text-ink/60">{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <ImageViewer asset={open} onClose={() => setOpen(null)} annotations={ctx.annotations} feedback={feedback} />
    </div>
  );
}

// ─── 06 Elementos / 07 Aplicações ──────────────────────────────────────────
export function GalleryView({ ctx, content, images, kind }: { ctx: ViewCtx; content: StageContent; images: SignedAsset[]; kind: 'elements' | 'applications' }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const [cat, setCat] = useState('Todos');
  const feedback = useFeedback(ctx);
  const fav = useFavorites(ctx);
  const order = kind === 'elements' ? ELEMENT_CATEGORIES : APPLICATION_CATEGORIES;
  const catOf = (a: SignedAsset) => a.category || 'Outros';
  const cats = useMemo(() => {
    const present = new Set(images.map(catOf));
    return [...order.filter((c) => present.has(c)), ...[...present].filter((c) => !order.includes(c))];
  }, [images, order]);
  const shown = cat === 'Todos' ? images : images.filter((a) => catOf(a) === cat);
  if (!images.length) return <Empty text="Esta etapa ainda está sendo preparada." />;

  return (
    <div>
      {(content.description ?? '').trim() && <RichText text={content.description!} className="mb-8 max-w-2xl text-[0.97rem] leading-relaxed text-ink/80" />}
      {cats.length > 1 && (
        <div className="no-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
          {['Todos', ...cats].map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn('shrink-0 rounded-full border px-4 py-1.5 text-xs transition', cat === c ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className={cn('grid gap-4', kind === 'applications' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {shown.map((a) => (
          <figure key={a.id} className="group">
            <button onClick={() => setOpen(a)} className="relative block w-full overflow-hidden rounded-3xl bg-blush">
              <img src={a.url} alt={a.name || a.caption || 'Imagem'} loading="lazy" className={cn('w-full object-cover transition duration-500 group-hover:scale-[1.03]', kind === 'applications' ? 'aspect-[4/3]' : 'aspect-square')} />
              {kind === 'applications' && fav.has('application', a.id) && <span className="absolute right-3 top-3 rounded-full bg-wine px-2.5 py-1 text-xs text-white">♡</span>}
            </button>
            <figcaption className="mt-2 px-1">
              <span className="block text-sm text-ink/85">{a.name || a.caption}</span>
              <span className="label text-wine/60">{catOf(a)}</span>
              {a.description && <span className="mt-1 block text-xs leading-relaxed text-ink/60">{a.description}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      <ImageViewer
        asset={open}
        onClose={() => setOpen(null)}
        annotations={ctx.annotations}
        feedback={feedback}
        title={open?.name}
        favorite={kind === 'applications' && fav.enabled && open ? { on: fav.has('application', open.id), toggle: () => fav.toggle('application', open.id), busy: fav.busy } : undefined}
      />
    </div>
  );
}

// ─── 09 Arquivos ───────────────────────────────────────────────────────────
export function FilesView({ ctx, content, files }: { ctx: ViewCtx; content: StageContent; files: SignedAsset[] }) {
  const isClient = ctx.mode === 'client';
  const shown = isClient ? files.filter((f) => f.released) : files;
  if (!shown.length) return <Empty text={isClient ? 'Os arquivos da sua marca aparecem aqui quando forem liberados.' : 'Nenhum arquivo ainda.'} />;
  const groups = [...FILE_CATEGORIES.map(([k, l]) => ({ key: k, label: l })), { key: '', label: 'Outros' }].map((g) => ({
    ...g,
    items: shown.filter((f) => (g.key === '' ? !FILE_CATEGORIES.some(([k]) => k === f.category) : f.category === g.key)),
  }));
  return (
    <div className="space-y-10">
      {(content.description ?? '').trim() && <RichText text={content.description!} className="max-w-2xl text-[0.97rem] leading-relaxed text-ink/80" />}
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.key || 'outros'}>
          <Label>{g.label}</Label>
          <ul className="space-y-2">
            {g.items.map((f) => (
              <li key={f.id}>
                {isClient ? (
                  <a href={`/brand/review/${ctx.token}/download/${f.id}`} className="card card-hover flex items-center gap-4 p-4">
                    <FileRow f={f} />
                    <Download className="size-4 text-wine" />
                  </a>
                ) : (
                  <div className="card flex items-center gap-4 p-4">
                    <FileRow f={f} />
                    <span className={cn('rounded-full px-3 py-1 text-xs', f.released ? 'bg-wine text-white' : 'bg-ink/5 text-ink/60')}>
                      {f.released ? 'Liberado' : <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Bloqueado</span>}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FileRow({ f }: { f: SignedAsset }) {
  return (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine"><FileText className="size-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{f.name || f.caption || f.file_name || 'Arquivo'}</span>
        {(f.name || f.caption) && f.file_name && <span className="block truncate text-xs text-ink/50">{f.file_name}</span>}
      </span>
    </>
  );
}

// ─── 08 Aprovação final ────────────────────────────────────────────────────
export function FinalMessage({ content }: { content: StageContent }) {
  if (!(content.message ?? '').trim()) return null;
  return <RichText text={content.message ?? ''} className="max-w-3xl text-xl font-medium leading-snug text-wine sm:text-2xl" />;
}

/** Resumo: logo, paleta, tipografia, elementos e aplicações + etapas. */
export function IdentitySummary({ ctx }: { ctx: ViewCtx }) {
  const { allStages } = ctx;
  const get = (k: string) => allStages.find((s) => s.stage_key === k && s.enabled);
  const cur = (k: string) => {
    const s = get(k);
    return s?.versions.find((v) => v.version_number === s.current_version) ?? s?.versions[s.versions.length - 1];
  };
  const chosen = get('logo')?.proposals.find((p) => p.is_chosen);
  const lv = chosen ? latestLogoVersion(chosen) : undefined;
  const logoImg = lv?.assets.find((a) => a.slot === 'primary') ?? lv?.assets[0];

  const colorsContent = cur('colors')?.content;
  const palettes = colorsContent ? getPalettes(colorsContent) : [];
  const favPaletteId = ctx.favorites.find((f) => f.kind === 'palette')?.ref_id;
  const palette = palettes.find((p) => p.id === favPaletteId) ?? palettes[0];
  const sel = [...ctx.selections].reverse().find((s) => s.kind === 'colors');
  const picked = colorsContent ? allColors(colorsContent).filter((c) => (sel?.payload.colorIds ?? []).includes(c.id)) : [];
  const swatches = picked.length ? picked : (palette?.colors ?? []);

  const typo = cur('typography');
  const fonts = typo ? getFonts(typo.content).filter((f) => f.name.trim()) : [];
  const typoAssets = typo?.assets ?? [];
  const family = useLoadedFonts(fonts, typoAssets);
  const elements = cur('elements')?.assets ?? [];
  const apps = cur('applications')?.assets ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {logoImg && (
          <div className="card flex flex-col items-center justify-center gap-3 p-8 sm:row-span-2">
            <img loading="lazy" decoding="async" src={logoImg.url} alt={chosen?.label} className="max-h-52 object-contain" />
            <p className="label text-wine/70">{chosen?.label} · V{lv?.version_number} · logo escolhido</p>
          </div>
        )}
        {swatches.length > 0 && (
          <div className="card p-6">
            <Label>{picked.length ? 'Cores escolhidas' : (palette?.label ?? 'Cores')}</Label>
            <div className="flex flex-wrap gap-2">
              {swatches.map((c) => (
                <span key={c.id} title={`${c.name} ${c.hex}`} className="size-11 rounded-full border border-wine/15" style={{ backgroundColor: c.hex }} />
              ))}
            </div>
          </div>
        )}
        {fonts.length > 0 && (
          <div className="card p-6">
            <Label>Tipografia</Label>
            <ul className="space-y-2">
              {[...fonts].sort((a, b) => FONT_ROLES.findIndex(([r]) => r === a.role) - FONT_ROLES.findIndex(([r]) => r === b.role)).map((f) => (
                <li key={f.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-xl text-wine" style={{ fontFamily: family(f) }}>{f.name}</span>
                  <span className="label text-ink/45">{FONT_ROLES.find(([r]) => r === f.role)?.[1]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {(elements.length > 0 || apps.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[['Elementos', elements], ['Aplicações', apps]].map(([label, list]) =>
            (list as SignedAsset[]).length ? (
              <div key={label as string} className="card p-6">
                <Label>{label as string}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {(list as SignedAsset[]).slice(0, 8).map((a) => (
                    <img loading="lazy" decoding="async" key={a.id} src={a.url} alt={a.name} className="aspect-square w-full rounded-xl object-cover" />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
      <ul className="card grid gap-1.5 p-6 sm:grid-cols-2">
        {allStages.filter((s) => s.enabled && STAGE_BY_KEY[s.stage_key].approvable && s.stage_key !== 'final').map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="w-4 text-wine">{s.status === 'approved' ? '✓' : s.status === 'draft' ? '○' : '●'}</span>
            {STAGE_BY_KEY[s.stage_key].label}
          </li>
        ))}
      </ul>
    </div>
  );
}
