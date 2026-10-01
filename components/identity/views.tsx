'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Download, FileText, Heart, Star } from 'lucide-react';
import type { ProposalData, SignedAsset, StageData, VersionData, StageContent } from '@/lib/identity/types';
import { CONCEPT_FIELDS, LOGO_SLOTS, STAGE_BY_KEY } from '@/lib/identity/types';
import { chooseProposal, toggleFavorite } from '@/lib/actions/identity-portal';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Sparkle } from '@/components/brand/Brand';
import { cn } from '@/lib/utils';

export const isImage = (a: SignedAsset) => (a.mime_type ?? '').startsWith('image/') || /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(a.file_name || a.storage_path);

const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => <p className={cn('label mb-3 text-wine/70', className)}>{children}</p>;

/** Apresentação de uma etapa. `portal` ativa favoritar/escolher no logo (somente cliente). */
export function StageView({ stage, version, portal }: { stage: StageData; version: VersionData; portal?: { token: string } }) {
  switch (stage.stage_key) {
    case 'concept':
      return <ConceptView content={version.content} images={version.assets} />;
    case 'moodboard':
      return <MoodboardView content={version.content} images={version.assets} />;
    case 'logo':
      return <LogoView stage={stage} version={version} portal={portal} />;
    case 'colors':
      return <ColorsView content={version.content} />;
    case 'typography':
      return <TypographyView content={version.content} images={version.assets} />;
    case 'files':
      return <FilesView content={version.content} files={version.assets} />;
    case 'final':
      return <FinalMessage content={version.content} />;
    default:
      return <GalleryView content={version.content} images={version.assets} />;
  }
}

// ─── 01 Conceito ───────────────────────────────────────────────────────────
export function ConceptView({ content, images }: { content: StageContent; images: SignedAsset[] }) {
  const filled = CONCEPT_FIELDS.filter(([k]) => (content[k] ?? '').trim());
  const manifesto = (content.manifesto ?? '').trim();
  const keywords = (content.keywords ?? '').split(/[,\n;]/).map((k) => k.trim()).filter(Boolean);
  const rest = filled.filter(([k]) => k !== 'manifesto' && k !== 'keywords');
  if (!filled.length && !images.length) return <Empty text="O conceito ainda está sendo escrito." />;
  return (
    <div className="space-y-12">
      {(content.description ?? '').trim() && (
        <p className="h-display max-w-3xl whitespace-pre-line text-2xl leading-snug text-wine sm:text-3xl">{content.description}</p>
      )}
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {rest.filter(([k]) => k !== 'description').map(([k, label]) => (
          <section key={k}>
            <Label>{label}</Label>
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/85">{content[k]}</p>
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
        <section className="relative overflow-hidden rounded-[2rem] bg-wine px-7 py-12 text-center text-white sm:px-14">
          <Sparkle className="mx-auto mb-5 size-5 text-blush" animate />
          <Label className="text-white/70">Manifesto</Label>
          <p className="h-display mx-auto max-w-2xl whitespace-pre-line text-2xl leading-snug sm:text-3xl">{manifesto}</p>
        </section>
      )}
      {images.length > 0 && <Photos images={images} />}
    </div>
  );
}

// ─── 02 Moodboard ──────────────────────────────────────────────────────────
export function MoodboardView({ content, images }: { content: StageContent; images: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  if (!images.length) return <Empty text="O moodboard ainda está sendo montado." />;
  return (
    <div>
      {(content.title ?? '').trim() && <h3 className="h-display mb-3 text-3xl text-wine sm:text-4xl">{content.title}</h3>}
      {(content.description ?? '').trim() && <p className="mb-8 max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}
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
      <Lightbox asset={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// ─── 03 Logo ───────────────────────────────────────────────────────────────
const SLOT_LABEL = Object.fromEntries(LOGO_SLOTS) as Record<string, string>;
const slotBg: Record<string, string> = { light: 'bg-ink', dark: 'bg-blush', mono: 'bg-blush-soft', avatar: 'bg-white', symbol: 'bg-white' };

export function LogoView({ stage, version, portal }: { stage: StageData; version: VersionData; portal?: { token: string } }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<ProposalData | null>(null);
  const awaiting = stage.status === 'awaiting';
  const canAct = !!portal && awaiting;
  const chosen = version.proposals.find((p) => p.is_chosen);
  const approved = stage.status === 'approved';
  const list = approved && chosen ? [chosen] : version.proposals;

  if (!version.proposals.length) return <Empty text="As propostas de logo ainda estão sendo criadas." />;

  const fav = (p: ProposalData) =>
    start(async () => {
      const r = await toggleFavorite(portal!.token, p.id);
      if (!r.ok) return toast(r.error, 'error');
      toast(r.favorite ? 'Você marcou esta proposta como favorita. ♡' : 'Favorito removido');
      router.refresh();
    });
  const choose = (p: ProposalData) =>
    start(async () => {
      const r = await chooseProposal(portal!.token, p.id);
      setConfirm(null);
      if (!r.ok) return toast(r.error, 'error');
      toast(`${p.label} escolhida ♡ Agora é só aprovar o logo.`);
      router.refresh();
    });

  return (
    <div className="space-y-10">
      {canAct && (
        <p className="rounded-2xl bg-blush px-5 py-4 text-sm text-wine">
          <strong className="font-normal">♡ Favoritar</strong> marca as propostas de que você gostou — não aprova nada.{' '}
          <strong className="font-normal">Escolher</strong> indica a proposta que seguirá para a aprovação do logo.
        </p>
      )}
      {list.map((p) => (
        <article key={p.id} className={cn('card overflow-hidden !rounded-[2rem]', p.is_chosen && 'ring-2 ring-wine')}>
          <header className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
            <div>
              <p className="label mb-2 text-wine/70">{p.is_chosen ? 'Proposta escolhida' : 'Proposta'}</p>
              <h3 className="h-display text-3xl text-wine">{p.label}</h3>
              {p.description && <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-relaxed text-ink/70">{p.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.is_favorite && !canAct && <Tag icon={<Heart className="size-3.5 fill-current" />}>Favorita</Tag>}
              {p.is_chosen && <Tag icon={<Star className="size-3.5 fill-current" />}>Escolhida</Tag>}
              {canAct && (
                <>
                  <Button variant={p.is_favorite ? 'primary' : 'outline'} size="sm" onClick={() => fav(p)} loading={pending} aria-pressed={p.is_favorite}>
                    <Heart className={cn('size-4', p.is_favorite && 'fill-current')} /> {p.is_favorite ? 'Favorita' : 'Favoritar'}
                  </Button>
                  <Button variant={p.is_chosen ? 'dark' : 'soft'} size="sm" onClick={() => setConfirm(p)} disabled={p.is_chosen}>
                    <Check className="size-4" /> {p.is_chosen ? 'Escolhida' : 'Escolher'}
                  </Button>
                </>
              )}
            </div>
          </header>
          {canAct && p.is_favorite && <p className="mx-6 mb-4 rounded-2xl bg-blush px-4 py-2.5 text-sm text-wine sm:mx-8">Você marcou esta proposta como favorita. ♡</p>}
          <LogoShowcase proposal={p} />
        </article>
      ))}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Escolher esta proposta?">
        <p className="mb-6 text-[0.95rem]">Você está escolhendo a <strong className="font-normal text-wine">{confirm?.label}</strong>. Depois é só aprovar a etapa do logo. Você pode trocar de escolha enquanto não aprovar.</p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Voltar</Button>
          <Button onClick={() => confirm && choose(confirm)} loading={pending}>Sim, escolher</Button>
        </div>
      </Modal>
    </div>
  );
}

function LogoShowcase({ proposal }: { proposal: ProposalData }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const by = (slot: string) => proposal.assets.filter((a) => a.slot === slot);
  const main = by('primary')[0] ?? proposal.assets[0];
  const others = LOGO_SLOTS.filter(([s]) => s !== 'primary').flatMap(([s]) => by(s));
  if (!proposal.assets.length) return <p className="px-8 pb-8 text-sm text-ink/50">Nenhum arquivo nesta proposta ainda.</p>;
  return (
    <div className="border-t border-wine/10 bg-blush-soft/60 p-4 sm:p-6">
      {main && (
        <button onClick={() => setOpen(main)} className="mb-3 flex h-56 w-full items-center justify-center rounded-3xl bg-white p-8 transition hover:shadow-sm sm:mb-4 sm:h-72">
          <img src={main.url} alt={`${proposal.label} — ${SLOT_LABEL[main.slot] ?? 'logo'}`} className="max-h-full max-w-full object-contain" />
        </button>
      )}
      {others.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {others.map((a) => (
            <figure key={a.id}>
              <button onClick={() => setOpen(a)} className={cn('flex aspect-[4/3] w-full items-center justify-center overflow-hidden p-5 transition hover:shadow-sm', a.slot === 'avatar' ? 'rounded-3xl' : 'rounded-2xl', slotBg[a.slot] ?? 'bg-white')}>
                <img src={a.url} alt={SLOT_LABEL[a.slot] ?? 'logo'} className={cn('max-h-full max-w-full object-contain', a.slot === 'avatar' && 'size-24 rounded-full object-cover')} />
              </button>
              <figcaption className="label mt-2 text-center text-ink/55">{SLOT_LABEL[a.slot] ?? a.slot}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <Lightbox asset={open} onClose={() => setOpen(null)} dark={open?.slot === 'light'} />
    </div>
  );
}

// ─── 04 Cores ──────────────────────────────────────────────────────────────
const toRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};
const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 150;
};

export function ColorsView({ content }: { content: StageContent }) {
  const colors = content.colors ?? [];
  if (!colors.length) return <Empty text="A paleta de cores ainda está sendo definida." />;
  return (
    <div>
      {(content.description ?? '').trim() && <p className="mb-8 max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {colors.map((c, i) => (
          <div key={c.id} className={cn('animate-rise overflow-hidden rounded-3xl border border-wine/15', i === 0 && 'col-span-2 sm:col-span-1')} style={{ animationDelay: `${i * 60}ms` }}>
            <div className={cn('flex h-40 items-end p-4 sm:h-48', isDark(c.hex) ? 'text-white' : 'text-ink')} style={{ backgroundColor: c.hex }}>
              <span className="label opacity-80">{c.role || 'Cor'}</span>
            </div>
            <div className="bg-white p-4">
              <p className="h-display text-xl text-wine">{c.name}</p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-ink/70">
                {c.hex.toUpperCase()} <CopyButton text={c.hex.toUpperCase()} />
              </p>
              <p className="font-mono text-[0.7rem] text-ink/45">RGB {toRgb(c.hex)}</p>
            </div>
          </div>
        ))}
      </div>
      {/* barra de proporção */}
      <div className="mt-6 flex h-3 overflow-hidden rounded-full border border-wine/15">
        {colors.map((c) => (
          <span key={c.id} className="flex-1" style={{ backgroundColor: c.hex }} />
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      aria-label={`Copiar ${text}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {}
      }}
      className="rounded p-0.5 text-wine/60 transition hover:text-wine"
    >
      {ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

// ─── 05 Tipografia ─────────────────────────────────────────────────────────
export function TypographyView({ content, images }: { content: StageContent; images: SignedAsset[] }) {
  const fonts = content.fonts ?? [];
  useGoogleFonts(fonts.map((f) => f.name));
  if (!fonts.length && !images.length) return <Empty text="A tipografia ainda está sendo definida." />;
  return (
    <div className="space-y-10">
      {(content.description ?? '').trim() && <p className="max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}
      <div className="space-y-4">
        {fonts.map((f) => (
          <section key={f.id} className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="label text-wine/70">{f.role || 'Fonte'}</p>
              <p className="text-sm text-ink/60">{f.name}</p>
            </div>
            <p className="mt-4 break-words text-5xl leading-tight text-wine sm:text-6xl" style={{ fontFamily: `'${f.name}', var(--font-display)` }}>Aa</p>
            <p className="mt-3 whitespace-pre-line break-words text-xl leading-snug sm:text-2xl" style={{ fontFamily: `'${f.name}', var(--font-sans)` }}>{f.sample || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789'}</p>
            {f.note && <p className="mt-4 text-sm text-ink/60">{f.note}</p>}
          </section>
        ))}
      </div>
      {images.length > 0 && <Photos images={images} />}
    </div>
  );
}

/** Carrega as fontes pelo nome no Google Fonts (se a fonte não existir lá, usa a reserva da marca). */
function useGoogleFonts(names: string[]) {
  const key = names.join('|');
  useEffect(() => {
    for (const n of names) {
      const clean = n.trim().replace(/[^A-Za-z0-9 ]/g, '');
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
}

// ─── 06 Elementos / 07 Aplicações ──────────────────────────────────────────
export function GalleryView({ content, images }: { content: StageContent; images: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  if (!images.length) return <Empty text="Esta etapa ainda está sendo preparada." />;
  return (
    <div>
      {(content.description ?? '').trim() && <p className="mb-8 max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {images.map((img) => (
          <figure key={img.id} className="group">
            <button onClick={() => setOpen(img)} className="block w-full overflow-hidden rounded-3xl bg-blush">
              <img src={img.url} alt={img.caption || 'Imagem'} loading="lazy" className="w-full transition duration-500 group-hover:scale-[1.02]" />
            </button>
            {img.caption && <figcaption className="mt-2 px-1 text-sm text-ink/65">{img.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <Lightbox asset={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// ─── 09 Arquivos ───────────────────────────────────────────────────────────
export function FilesView({ content, files }: { content: StageContent; files: SignedAsset[] }) {
  if (!files.length) return <Empty text="Os arquivos finais aparecem aqui quando estiverem prontos." />;
  return (
    <div>
      {(content.description ?? '').trim() && <p className="mb-6 max-w-2xl whitespace-pre-line text-[0.95rem] leading-relaxed text-ink/80">{content.description}</p>}
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.id}>
            <a href={f.url} download={f.file_name || undefined} target="_blank" rel="noreferrer" className="card card-hover flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blush text-wine">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.caption || f.file_name || 'Arquivo'}</span>
                {f.caption && f.file_name && <span className="block truncate text-xs text-ink/50">{f.file_name}</span>}
              </span>
              <Download className="size-4 text-wine" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── 08 Aprovação final ────────────────────────────────────────────────────
export function FinalMessage({ content }: { content: StageContent }) {
  if (!(content.message ?? '').trim()) return null;
  return <p className="h-display max-w-3xl whitespace-pre-line text-2xl leading-snug text-wine sm:text-3xl">{content.message}</p>;
}

/** Resumo da identidade (logo escolhido, paleta, fontes, etapas aprovadas) para a aprovação final. */
export function IdentitySummary({ stages }: { stages: StageData[] }) {
  const get = (k: string) => stages.find((s) => s.stage_key === k && s.enabled);
  const cur = (s?: StageData) => s?.versions.find((v) => v.version_number === s.current_version) ?? s?.versions[s.versions.length - 1];
  const logoV = cur(get('logo'));
  const chosen = logoV?.proposals.find((p) => p.is_chosen);
  const logoImg = chosen?.assets.find((a) => a.slot === 'primary') ?? chosen?.assets[0];
  const colors = cur(get('colors'))?.content.colors ?? [];
  const fonts = cur(get('typography'))?.content.fonts ?? [];
  useGoogleFonts(fonts.map((f) => f.name));
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {logoImg && (
        <div className="card flex flex-col items-center justify-center gap-3 p-6 sm:row-span-2">
          <img src={logoImg.url} alt={chosen?.label} className="max-h-48 object-contain" />
          <p className="label text-wine/70">{chosen?.label} · escolhida</p>
        </div>
      )}
      {colors.length > 0 && (
        <div className="card p-6">
          <Label>Cores</Label>
          <div className="flex gap-2">
            {colors.map((c) => (
              <span key={c.id} title={`${c.name} ${c.hex}`} className="size-10 rounded-full border border-wine/15" style={{ backgroundColor: c.hex }} />
            ))}
          </div>
        </div>
      )}
      {fonts.length > 0 && (
        <div className="card p-6">
          <Label>Tipografia</Label>
          <ul className="space-y-1">
            {fonts.map((f) => (
              <li key={f.id} className="text-lg text-wine" style={{ fontFamily: `'${f.name}', var(--font-sans)` }}>{f.name} <span className="label text-ink/45">{f.role}</span></li>
            ))}
          </ul>
        </div>
      )}
      <ul className="card space-y-1.5 p-6 sm:col-span-2">
        {stages.filter((s) => s.enabled && STAGE_BY_KEY[s.stage_key].approvable && s.stage_key !== 'final').map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <span className="w-4 text-wine">{s.status === 'approved' ? '✓' : s.status === 'draft' ? '○' : '●'}</span>
            {STAGE_BY_KEY[s.stage_key].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── utilitários ───────────────────────────────────────────────────────────
function Photos({ images }: { images: SignedAsset[] }) {
  const [open, setOpen] = useState<SignedAsset | null>(null);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img) => (
          <button key={img.id} onClick={() => setOpen(img)} className="group overflow-hidden rounded-2xl bg-blush">
            <img src={img.url} alt={img.caption || ''} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      <Lightbox asset={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Lightbox({ asset, onClose, dark }: { asset: SignedAsset | null; onClose: () => void; dark?: boolean }) {
  return (
    <Modal open={!!asset} onClose={onClose} className={cn('sm:max-w-3xl', dark && '!bg-ink')}>
      {asset && (
        <div className="pt-6">
          <img src={asset.url} alt={asset.caption || ''} className="mx-auto max-h-[70dvh] w-auto max-w-full object-contain" />
          {asset.caption && <p className={cn('mt-3 text-center text-sm', dark ? 'text-white/80' : 'text-ink/65')}>{asset.caption}</p>}
        </div>
      )}
    </Modal>
  );
}

function Tag({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1 text-xs text-wine">{icon}{children}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
      <Sparkle className="size-5 text-wine/50" animate />
      <p className="text-sm text-ink/60">{text}</p>
    </div>
  );
}
