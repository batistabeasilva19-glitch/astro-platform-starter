import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { identityPortalDetail, resolveIdentityToken } from '@/lib/data/identity-portal';
import { STAGE_BY_KEY, isStageKey } from '@/lib/identity/types';
import { PortalStage } from '@/components/identity/PortalStage';
import { StageStatusBadge } from '@/components/identity/ui';
import { cn } from '@/lib/utils';

export default async function IdentityStagePage({ params }: { params: Promise<{ token: string; etapa: string }> }) {
  const { token, etapa } = await params;
  if (!isStageKey(etapa)) notFound();
  const session = await resolveIdentityToken(token);
  if (!session) notFound();
  const detail = await identityPortalDetail(session);
  const stage = detail?.stages.find((s) => s.stage_key === etapa);
  if (!detail || !stage) notFound();
  const meta = STAGE_BY_KEY[etapa];
  const isFiles = etapa === 'files';
  // arquivos só existem para o cliente depois de publicados
  const hidden = isFiles && stage.status !== 'approved';

  return (
    <div>
      <Link href={`/identidade/${token}`} className="mb-6 inline-flex items-center gap-2 text-sm text-wine transition hover:gap-3">
        <ArrowLeft className="size-4" /> Todas as etapas
      </Link>

      <nav className="no-scrollbar -mx-1 mb-8 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Etapas">
        {detail.stages.map((s) => (
          <Link key={s.id} href={`/identidade/${token}/${s.stage_key}`} aria-current={s.stage_key === etapa ? 'page' : undefined} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition', s.stage_key === etapa ? 'border-wine bg-wine text-white' : 'border-wine/25 text-wine hover:bg-blush')}>
            {STAGE_BY_KEY[s.stage_key].number} {STAGE_BY_KEY[s.stage_key].short}
          </Link>
        ))}
      </nav>

      <header className="mb-10">
        <p className="label mb-3 text-wine/70">Etapa {meta.number}</p>
        <h1 className="h-display text-4xl text-wine sm:text-5xl">{meta.label}</h1>
        {!isFiles && (
          <div className="mt-4">
            <StageStatusBadge status={stage.status} audience="client" version={stage.current_version} />
          </div>
        )}
      </header>

      {hidden ? (
        <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
          <p className="h-display text-2xl text-wine">Seus arquivos chegam ao final ♡</p>
          <p className="max-w-md text-sm text-ink/60">Quando a identidade visual for finalizada, os arquivos para download aparecem aqui.</p>
        </div>
      ) : (
        <PortalStage key={stage.id} token={token} stage={stage} allStages={detail.stages} />
      )}
    </div>
  );
}
