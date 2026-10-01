'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, GitCompareArrows, History, Star } from 'lucide-react';
import { chooseProposal } from '@/lib/actions/identity-portal';
import { LOGO_SLOTS, latestLogoVersion, type ProposalData, type SignedAsset } from '@/lib/identity/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { cn, fmtFullDate } from '@/lib/utils';
import { ImageViewer } from '../ImageViewer';
import { FavButton, useFavorites, useFeedback, type ViewCtx } from '../view-context';
import { Empty } from './shared';
import { VersionCompare } from './VersionCompare';

const SLOT_LABEL = Object.fromEntries(LOGO_SLOTS) as Record<string, string>;
const slotBg: Record<string, string> = { light: 'bg-ink', dark: 'bg-blush', mono: 'bg-blush-soft', avatar: 'bg-white', symbol: 'bg-white' };

export function LogoView({ ctx }: { ctx: ViewCtx }) {
  const { stage } = ctx;
  const router = useRouter();
  const toast = useToast();
  const fav = useFavorites(ctx);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<ProposalData | null>(null);

  const awaiting = stage.status === 'awaiting';
  const canAct = ctx.mode === 'client' && awaiting;
  const chosen = stage.proposals.find((p) => p.is_chosen);
  const list = stage.status === 'approved' && chosen ? [chosen] : stage.proposals;
  if (!stage.proposals.length) return <Empty text="As propostas de logo ainda estão sendo criadas." />;

  const choose = (p: ProposalData) =>
    start(async () => {
      const r = await chooseProposal(ctx.token!, p.id);
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
          <strong className="font-normal">Escolher esta proposta</strong> indica qual segue adiante. <strong className="font-normal">Aprovar logo</strong> é um passo à parte, no fim da página.
        </p>
      )}
      {list.map((p) => (
        <ProposalCard key={p.id} ctx={ctx} proposal={p} canAct={canAct} favOn={fav.has('logo', p.id)} favEnabled={fav.enabled} favBusy={fav.busy} onFav={() => fav.toggle('logo', p.id, { on: 'Você marcou esta proposta como favorita.' })} onChoose={() => setConfirm(p)} />
      ))}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Escolher esta proposta?">
        <p className="mb-6 text-[0.95rem]">
          Você está escolhendo a <strong className="font-normal text-wine">{confirm?.label}</strong>. Depois é só aprovar o logo. Você pode trocar de escolha enquanto não aprovar.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Voltar</Button>
          <Button onClick={() => confirm && choose(confirm)} loading={pending}>Sim, escolher</Button>
        </div>
      </Modal>
    </div>
  );
}

function ProposalCard({ ctx, proposal: p, canAct, favOn, favEnabled, favBusy, onFav, onChoose }: { ctx: ViewCtx; proposal: ProposalData; canAct: boolean; favOn: boolean; favEnabled: boolean; favBusy: boolean; onFav: () => void; onChoose: () => void }) {
  const latest = latestLogoVersion(p);
  const [selectedId, setSelectedId] = useState(latest?.id);
  const [older, setOlder] = useState(false);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [open, setOpen] = useState<SignedAsset | null>(null);
  const feedback = useFeedback(ctx);

  const idx = Math.max(0, p.versions.findIndex((v) => v.id === selectedId));
  const sel = p.versions[idx] ?? latest;
  const prev = p.versions[idx - 1];
  const isLatest = sel?.id === latest?.id;
  if (!sel) return null;

  const by = (slot: string) => sel.assets.filter((a) => a.slot === slot);
  const main = by('primary')[0] ?? sel.assets[0];
  const others = LOGO_SLOTS.filter(([s]) => s !== 'primary').flatMap(([s]) => by(s));

  return (
    <article className={cn('card overflow-hidden !rounded-[2rem]', p.is_chosen && 'ring-2 ring-wine')}>
      <header className="flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
        <div>
          <p className="label mb-2 text-wine/70">{p.is_chosen ? 'Proposta escolhida' : 'Proposta'}</p>
          <h3 className="h-display text-3xl text-wine">{p.label}</h3>
          {p.description && <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-relaxed text-ink/70">{p.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.is_chosen && <span className="inline-flex items-center gap-1.5 rounded-full bg-wine px-3 py-1 text-xs text-white"><Star className="size-3.5 fill-current" /> Escolhida</span>}
          {favEnabled ? (
            <FavButton on={favOn} onClick={onFav} busy={favBusy} size="sm" />
          ) : (
            favOn && <span className="rounded-full bg-blush px-3 py-1 text-xs text-wine">♡ Favorita do cliente</span>
          )}
          {canAct && (
            <Button size="sm" variant={p.is_chosen ? 'dark' : 'soft'} onClick={onChoose} disabled={p.is_chosen}>
              <Check className="size-4" /> {p.is_chosen ? 'Escolhida' : 'Escolher esta proposta'}
            </Button>
          )}
        </div>
      </header>

      {favOn && favEnabled && <p className="mx-6 mb-4 rounded-2xl bg-blush px-4 py-2.5 text-sm text-wine sm:mx-8">Você marcou esta proposta como favorita.</p>}

      {/* versões: V1 - 28/09/2026 … V3 [VERSÃO ATUAL] */}
      <div className="border-t border-wine/10 px-6 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-wine px-3 py-1 text-xs text-white">
            V{latest.version_number} · {fmtFullDate(latest.created_at)} {isLatest && '· VERSÃO ATUAL'}
          </span>
          {p.versions.length > 1 && (
            <button onClick={() => setOlder((o) => !o)} className="inline-flex items-center gap-1.5 rounded-full border border-wine/30 px-3 py-1 text-xs text-wine transition hover:bg-blush">
              <History className="size-3.5" /> {older ? 'Ocultar versões anteriores' : 'Ver versões anteriores'}
            </button>
          )}
          {p.versions.length > 1 && (
            <button onClick={() => setCompare({ a: (prev ?? p.versions[Math.max(0, p.versions.length - 2)]).id, b: sel.id })} className="inline-flex items-center gap-1.5 rounded-full border border-wine px-3 py-1 text-xs text-wine transition hover:bg-wine hover:text-white">
              <GitCompareArrows className="size-3.5" /> {prev ? 'Comparar com versão anterior' : 'Comparar versões'}
            </button>
          )}
        </div>
        {older && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...p.versions].reverse().map((v) => (
              <li key={v.id}>
                <button onClick={() => setSelectedId(v.id)} aria-pressed={selectedId === v.id} className={cn('rounded-full border px-3 py-1 text-xs transition', selectedId === v.id ? 'border-wine bg-blush text-wine' : 'border-wine/20 text-ink/65 hover:bg-blush')}>
                  V{v.version_number} - {fmtFullDate(v.created_at)} {v.id === latest.id && '[VERSÃO ATUAL]'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!isLatest && (
          <p className="mt-3 rounded-2xl border border-dashed border-wine/40 px-4 py-2.5 text-sm text-wine">
            Você está vendo a V{sel.version_number} (anterior). <button className="underline underline-offset-2" onClick={() => setSelectedId(latest.id)}>Voltar para a versão atual</button>
          </p>
        )}
        {sel.changes && (
          <div className="mt-4 rounded-2xl bg-blush/60 p-4 text-sm">
            <p className="label mb-1.5 text-wine">V{sel.version_number} · Alterações</p>
            <p className="whitespace-pre-line leading-relaxed text-ink/80">{sel.changes}</p>
          </div>
        )}
      </div>

      {!sel.assets.length ? (
        <p className="px-8 pb-8 text-sm text-ink/50">Nenhum arquivo nesta versão ainda.</p>
      ) : (
        <div className="border-t border-wine/10 bg-blush-soft/60 p-4 sm:p-6">
          {main && (
            <button onClick={() => setOpen(main)} className="mb-3 flex h-56 w-full items-center justify-center rounded-3xl bg-white p-8 transition hover:shadow-sm sm:mb-4 sm:h-80">
              <img loading="lazy" decoding="async" src={main.url} alt={`${p.label} — ${SLOT_LABEL[main.slot] ?? 'logo'}`} className="max-h-full max-w-full object-contain" />
            </button>
          )}
          {others.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {others.map((a) => (
                <figure key={a.id}>
                  <button onClick={() => setOpen(a)} className={cn('flex aspect-[4/3] w-full items-center justify-center overflow-hidden p-5 transition hover:shadow-sm', a.slot === 'avatar' ? 'rounded-3xl' : 'rounded-2xl', slotBg[a.slot] ?? 'bg-white')}>
                    <img loading="lazy" decoding="async" src={a.url} alt={SLOT_LABEL[a.slot] ?? 'logo'} className={cn('max-h-full max-w-full object-contain', a.slot === 'avatar' && 'size-24 rounded-full object-cover')} />
                  </button>
                  <figcaption className="label mt-2 text-center text-ink/55">{SLOT_LABEL[a.slot] ?? a.slot}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <ImageViewer asset={open} onClose={() => setOpen(null)} annotations={ctx.annotations} feedback={feedback} dark={open?.slot === 'light'} title={`${p.label} V${sel.version_number}`} />
      {compare && <VersionCompare proposal={p} open onClose={() => setCompare(null)} initialA={compare.a} initialB={compare.b} />}
    </article>
  );
}
