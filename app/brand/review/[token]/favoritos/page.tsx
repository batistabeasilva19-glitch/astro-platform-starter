import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { identityPortalDetail, resolveIdentityToken } from '@/lib/data/identity-portal';
import { resolveFavorites } from '@/lib/identity/favorites';
import { FavoritesBoard } from '@/components/identity/Favorites';

export const metadata = { title: 'Meus favoritos' };

export default async function IdentityFavoritesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveIdentityToken(token);
  if (!session) notFound();
  const detail = await identityPortalDetail(session);
  if (!detail) notFound();
  const items = resolveFavorites(detail);
  const typo = detail.stages.find((s) => s.stage_key === 'typography');
  const fontAssets = typo?.versions.flatMap((v) => v.assets) ?? [];
  // contexto mínimo: só precisamos das ações de favorito (qualquer etapa liberada serve)
  const anyStage = detail.stages.find((s) => s.status !== 'draft') ?? detail.stages[0];

  return (
    <div>
      <Link href={`/brand/review/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
        <ArrowLeft className="size-4" /> Visão geral
      </Link>
      <header className="mb-10">
        <p className="label mb-3 text-wine/70">Suas preferências</p>
        <h1 className="h-display text-5xl text-wine sm:text-6xl">Favoritos</h1>
        <p className="mt-3 max-w-xl text-sm text-ink/65">Aqui ficam os logos, paletas, cores, fontes e aplicações de que você gostou. <strong className="font-normal text-wine">Favoritar não significa aprovar</strong> — a aprovação acontece em cada etapa.</p>
      </header>
      <FavoritesBoard
        items={items}
        fontAssets={fontAssets}
        hrefBase={`/brand/review/${token}`}
        ctx={{ mode: 'client', token, stage: anyStage, allStages: detail.stages, favorites: detail.favorites, selections: detail.selections, annotations: [] }}
      />
    </div>
  );
}
