import Link from 'next/link';
import { Plus } from 'lucide-react';
import { listIdentities } from '@/lib/data/identity-admin';
import { IDENTITY_STATUSES, progressOf, type IdentityStatus } from '@/lib/identity/types';
import { ProgressBar, ProjectStatusBadge, StageChecklist } from '@/components/identity/ui';
import { Avatar, EmptyState, PageTitle } from '@/components/ui/Misc';
import { LinkButton } from '@/components/ui/Button';
import { cn, fmtDate } from '@/lib/utils';

export const metadata = { title: 'Identidades visuais' };

const FILTERS: { label: string; status?: IdentityStatus }[] = [
  { label: 'Todos' },
  { label: 'Em criação', status: 'in_creation' },
  { label: 'Aguardando aprovação', status: 'awaiting_approval' },
  { label: 'Alteração solicitada', status: 'changes_requested' },
  { label: 'Aprovados', status: 'approved' },
  { label: 'Finalizados', status: 'finalized' },
];

export default async function IdentitiesPage({ searchParams }: { searchParams: Promise<{ status?: string; cliente?: string }> }) {
  const sp = await searchParams;
  const filter = (IDENTITY_STATUSES as string[]).includes(sp.status ?? '') ? (sp.status as IdentityStatus) : undefined;
  const everything = await listIdentities();
  const all = sp.cliente ? everything.filter((p) => p.client_id === sp.cliente) : everything;
  const clientName = sp.cliente ? everything.find((p) => p.client_id === sp.cliente)?.client.company_name : undefined;
  const items = filter ? all.filter((p) => p.status === filter) : all;

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        eyebrow="Branding"
        title={clientName ? `Identidades · ${clientName}` : 'Identidades visuais'}
        actions={
          <LinkButton href={`/admin/identidades/new${sp.cliente ? `?client=${sp.cliente}` : ''}`}>
            <Plus className="size-4" /> Nova identidade visual
          </LinkButton>
        }
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.status ? all.filter((p) => p.status === f.status).length : all.length;
          const active = f.status === filter;
          return (
            <Link key={f.label} href={`/admin/identidades${f.status || sp.cliente ? '?' : ''}${[f.status && `status=${f.status}`, sp.cliente && `cliente=${sp.cliente}`].filter(Boolean).join('&')}`} className={cn('rounded-full border px-4 py-1.5 text-xs transition', active ? 'border-wine bg-wine text-white' : 'border-wine/30 text-wine hover:bg-blush')}>
              {f.label} <span className={active ? 'text-white/70' : 'text-ink/40'}>{count}</span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState title={all.length ? 'Nada neste filtro' : 'Nenhuma identidade visual ainda'}>
          {all.length ? 'Escolha outro filtro para ver os projetos.' : 'Crie o primeiro projeto de identidade visual para um cliente.'}
          {!all.length && (
            <div className="mt-4">
              <LinkButton href="/admin/identidades/new">Nova identidade visual</LinkButton>
            </div>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p, i) => {
            const { pct } = progressOf(p.stages);
            return (
              <Link key={p.id} href={`/admin/identidades/${p.id}`} style={{ animationDelay: `${i * 50}ms` }} className="card card-hover animate-rise block p-6">
                <div className="flex items-center gap-4">
                  <Avatar name={p.client.company_name} src={p.client.avatar_url} className="size-14 shrink-0 text-lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="h-display truncate text-2xl text-wine">{p.client.company_name}</h2>
                    <p className="truncate text-sm text-ink/65">{p.name}</p>
                  </div>
                  <ProjectStatusBadge status={p.status} className="hidden shrink-0 sm:inline-flex" />
                </div>
                <ProjectStatusBadge status={p.status} className="mt-4 sm:hidden" />
                <div className="mt-5">
                  <p className="label mb-2 text-wine/70">{pct}% concluído</p>
                  <ProgressBar stages={p.stages} showText={false} />
                </div>
                <div className="mt-4">
                  <StageChecklist stages={p.stages} />
                </div>
                <p className="mt-5 border-t border-wine/10 pt-3 text-xs text-ink/55">Última atualização: {fmtDate(p.updated_at.slice(0, 10), true)}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
