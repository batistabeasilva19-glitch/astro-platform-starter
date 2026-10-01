import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';
import { identityPortalDetail, resolveIdentityToken } from '@/lib/data/identity-portal';
import { STAGE_BY_KEY, STAGE_STATUS_META, progressOf } from '@/lib/identity/types';
import { ProgressBar, StageStatusBadge } from '@/components/identity/ui';
import { BrandElement } from '@/components/brand/Brand';
import { cn, firstName } from '@/lib/utils';

export default async function IdentityPortalHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await resolveIdentityToken(token);
  if (!session) notFound();
  const detail = await identityPortalDetail(session);
  if (!detail) notFound();
  const { project, stages } = detail;
  const { client } = session;
  const awaiting = stages.filter((s) => s.status === 'awaiting' && STAGE_BY_KEY[s.stage_key].approvable);
  const { approved, total } = progressOf(stages);

  return (
    <div>
      <section className="relative mb-10 overflow-hidden rounded-[2rem] bg-wine px-6 py-10 text-white sm:px-12 sm:py-14">
        <BrandElement name="sparkles" className="absolute right-6 top-6 w-14 opacity-70 sm:w-20" />
        <p className="label mb-4 text-white/70">{project.name}</p>
        <h1 className="script text-6xl text-blush sm:text-7xl">Olá, {firstName(client.contact_name || client.company_name)} ♡</h1>
        <p className="mt-5 max-w-xl text-[0.98rem] leading-relaxed text-white/90">
          Aqui você acompanha, etapa por etapa, a construção da identidade visual da sua marca. Veja cada apresentação com calma e use os botões para aprovar, pedir ajustes ou comentar.
        </p>
        {project.description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">{project.description}</p>}
        <div className="mt-8 max-w-md">
          <ProgressBar stages={stages} tone="white" />
        </div>
      </section>

      {project.status === 'finalized' && (
        <p className="mb-8 rounded-3xl bg-blush px-6 py-5 text-center text-wine">
          <span className="script text-3xl">Identidade visual finalizada ♡</span>
        </p>
      )}

      {awaiting.length > 0 && (
        <p className="mb-8 rounded-3xl border border-wine/20 bg-white px-6 py-5 text-[0.95rem]">
          <strong className="font-normal text-wine">{awaiting.length} {awaiting.length === 1 ? 'etapa espera' : 'etapas esperam'}</strong> a sua análise. {approved} de {total} já {approved === 1 ? 'foi aprovada' : 'foram aprovadas'}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {stages.map((s, i) => {
          const meta = STAGE_BY_KEY[s.stage_key];
          const Icon = meta.icon;
          const isFiles = s.stage_key === 'files';
          const visible = isFiles ? s.status === 'approved' : s.status !== 'draft';
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className={cn('flex size-11 items-center justify-center rounded-2xl', visible ? 'bg-blush text-wine' : 'bg-ink/5 text-ink/40')}>
                  <Icon className="size-5" />
                </span>
                <span className="label text-ink/40">{meta.number}</span>
              </div>
              <h2 className="h-display mt-4 text-2xl text-wine">{meta.label}</h2>
              <p className="mt-1 text-sm text-ink/60">{meta.hint}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                {isFiles ? (
                  <span className="text-xs text-ink/60">{visible ? 'Disponível para download' : 'Disponível ao final do projeto'}</span>
                ) : (
                  <StageStatusBadge status={s.status} audience="client" version={s.current_version} />
                )}
                {visible ? <ArrowRight className="size-4 text-wine transition group-hover:translate-x-1" /> : <Lock className="size-4 text-ink/30" />}
                <span className="sr-only">{STAGE_STATUS_META[s.status].symbol}</span>
              </div>
            </>
          );
          return visible ? (
            <Link key={s.id} href={`/identidade/${token}/${s.stage_key}`} style={{ animationDelay: `${i * 50}ms` }} className="group card card-hover animate-rise block p-6">
              {body}
            </Link>
          ) : (
            <Link key={s.id} href={`/identidade/${token}/${s.stage_key}`} style={{ animationDelay: `${i * 50}ms` }} className="card animate-rise block p-6 opacity-70">
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
