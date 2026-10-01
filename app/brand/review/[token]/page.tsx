import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Lock } from 'lucide-react';
import { identityPortalDetail, resolveIdentityToken } from '@/lib/data/identity-portal';
import { STAGE_BY_KEY, progressOf } from '@/lib/identity/types';
import { ProgressBar } from '@/components/identity/ui';
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
  const approvable = stages.filter((s) => STAGE_BY_KEY[s.stage_key].approvable);
  const { approved, total } = progressOf(stages);
  const awaiting = approvable.filter((s) => s.status === 'awaiting');
  const nextUp = approvable.find((s) => s.status === 'draft');
  const files = stages.find((s) => s.stage_key === 'files');
  const filesReady = !!files && files.versions.some((v) => v.assets.length > 0);

  return (
    <div>
      <section className="relative mb-12 overflow-hidden rounded-[2rem] bg-wine px-6 py-12 text-white sm:px-14 sm:py-16">
        <BrandElement name="sparkles" className="absolute right-6 top-6 w-14 opacity-70 sm:w-24" />
        <p className="label mb-5 text-white/70">{project.name}</p>
        <h1 className="script text-6xl text-blush sm:text-8xl">Olá, {firstName(client.contact_name || client.company_name)} ♡</h1>
        <p className="h-display mt-6 max-w-xl text-2xl leading-snug sm:text-4xl">Sua nova identidade está tomando forma.</p>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-white/85">Aqui você pode acompanhar cada etapa, comparar propostas e participar das decisões da sua nova marca.</p>
        {project.description && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">{project.description}</p>}
        <div className="mt-10 max-w-md">
          <p className="label mb-2 text-white/70">Progresso</p>
          <ProgressBar stages={stages} tone="white" />
        </div>
      </section>

      {project.status === 'finalized' && (
        <p className="mb-8 rounded-3xl bg-blush px-6 py-5 text-center text-wine"><span className="script text-3xl">Identidade visual finalizada ♡</span></p>
      )}
      {awaiting.length > 0 && (
        <p className="mb-8 rounded-3xl border border-wine/20 bg-white px-6 py-5 text-[0.95rem]">
          <strong className="font-normal text-wine">{awaiting.length} {awaiting.length === 1 ? 'etapa espera' : 'etapas esperam'}</strong> a sua opinião. {approved} de {total} já {approved === 1 ? 'foi aprovada' : 'foram aprovadas'}.
        </p>
      )}

      <ol className="divide-y divide-wine/10 overflow-hidden rounded-[2rem] border border-wine/15 bg-white">
        {approvable.map((s, i) => {
          const meta = STAGE_BY_KEY[s.stage_key];
          const Icon = meta.icon;
          const open = s.status !== 'draft';
          const state =
            s.status === 'approved' ? { sym: '✓', text: 'Aprovado', cls: 'text-wine' }
            : s.status === 'awaiting' ? { sym: '●', text: s.stage_key === 'final' ? 'Pronta para sua aprovação' : 'Aguardando sua opinião', cls: 'text-wine' }
            : s.status === 'changes_requested' ? { sym: '●', text: 'Alteração solicitada', cls: 'text-wine' }
            : { sym: '○', text: nextUp?.id === s.id ? 'Próxima etapa' : 'Em breve', cls: 'text-ink/45' };
          return (
            <li key={s.id} className="animate-rise" style={{ animationDelay: `${i * 45}ms` }}>
              <Link href={`/brand/review/${token}/${s.stage_key}`} className="group flex items-center gap-4 px-5 py-5 transition hover:bg-blush/50 sm:gap-6 sm:px-8">
                <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', open ? 'bg-blush text-wine' : 'bg-ink/5 text-ink/40')}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="label block text-wine/60">{meta.number}</span>
                  <span className="h-display block text-2xl text-wine sm:text-3xl">{meta.label}</span>
                  <span className="mt-0.5 block text-xs text-ink/55">{meta.hint}</span>
                </span>
                <span className={cn('hidden items-center gap-2 text-sm sm:flex', state.cls)}><span>{state.sym}</span>{state.text}</span>
                {open ? <ArrowRight className="size-4 shrink-0 text-wine transition group-hover:translate-x-1" /> : <Lock className="size-4 shrink-0 text-ink/30" />}
              </Link>
              <p className={cn('-mt-3 px-5 pb-4 pl-[5.25rem] text-xs sm:hidden', state.cls)}>{state.sym} {state.text}</p>
            </li>
          );
        })}
      </ol>

      {filesReady && (
        <Link href={`/brand/review/${token}/files`} className="card card-hover mt-6 flex items-center justify-between gap-4 p-6">
          <span>
            <span className="label block text-wine/60">Disponível</span>
            <span className="h-display text-2xl text-wine sm:text-3xl">Arquivos da sua marca</span>
          </span>
          <ArrowRight className="size-5 text-wine" />
        </Link>
      )}
      <p className="mt-8 text-center text-sm text-ink/55"><Link href={`/brand/review/${token}/favoritos`} className="text-wine underline-offset-4 hover:underline">Ver meus favoritos ♡</Link></p>
    </div>
  );
}
